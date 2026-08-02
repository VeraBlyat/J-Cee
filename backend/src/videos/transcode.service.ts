import { execFile } from 'child_process';
import {
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  utimes,
  writeFile,
} from 'fs/promises';
import { join } from 'path';
import { promisify } from 'util';
import { Injectable, Logger } from '@nestjs/common';
import {
  headerBoxesOnly,
  mediaBoxesOnly,
  setBaseMediaDecodeTime,
  trackTimescales,
} from './fmp4';
import { Rendition, SEGMENT_SECONDS, segmentDuration } from './hls';

const execFileAsync = promisify(execFile);


export const UPLOAD_DIR = join(process.cwd(), 'uploads');

// Los segmentos generados al vuelo viven acá. Es caché descartable: se puede
// borrar entera en cualquier momento y se regenera sola.
//
// Va FUERA de uploads/ a propósito: Nest sirve esa carpeta como estática, así
// que una caché adentro quedaría accesible por URL directa, salteándose la
// validación de índice y de calidad que hace el controlador.
export const CACHE_DIR = join(process.cwd(), 'hls-cache');

// Cuántos FFmpeg podemos tener corriendo a la vez. Este es EL número que
// mantiene en pie el enfoque JIT: cada transcodificación quema una CPU casi
// entera, así que sin tope, diez espectadores tumban el servidor. Los pedidos
// que pasan el tope esperan en cola en vez de competir por CPU.
const MAX_CONCURRENT = Number(process.env.HLS_MAX_CONCURRENT || 2);

// Tope de la caché en disco. Al pasarse, se borran los segmentos usados hace
// más tiempo.
const CACHE_MAX_BYTES = Number(process.env.HLS_CACHE_MAX_BYTES || 2 * 1024 ** 3);

// Si un FFmpeg tarda más que esto, algo se colgó: lo matamos para no dejar el
// slot de concurrencia tomado para siempre.
const FFMPEG_TIMEOUT_MS = 60_000;

// Miniaturas: ancho fijo de 640 y alto automático (-2 lo redondea a par, que
// es lo que exige el encoder). Se usa igual para las generadas del video y
// para las que sube el usuario, así todas salen del mismo tamaño.
const THUMBNAIL_SCALE = 'scale=640:-2';

export interface VideoMetadata {
  durationSeconds: number;
  width: number;
  height: number;
}

@Injectable()
export class TranscodeService {
  private readonly logger = new Logger(TranscodeService.name);

  // Segmentos que se están generando ahora mismo, por clave. Si dos
  // espectadores piden el mismo segmento al mismo tiempo (pasa siempre: es el
  // mismo video, arrancan juntos), corremos UN solo FFmpeg y los dos esperan
  // la misma promesa.
  private readonly inFlight = new Map<string, Promise<string>>();

  private running = 0;
  private readonly waiting: Array<() => void> = [];

  // Contador para no barrer la caché en cada request.
  private writesSinceSweep = 0;

  // --- Metadata ---------------------------------------------------------

  // Lee duración y resolución del archivo. Además hace de validación: si
  // ffprobe no encuentra un stream de video, no era un video de verdad
  // (alguien renombró un .zip a .mp4).
  async probe(filePath: string): Promise<VideoMetadata> {
    const { stdout } = await execFileAsync(
      'ffprobe',
      [
        '-v', 'error',
        '-show_entries', 'format=duration',
        '-show_entries', 'stream=width,height,codec_type',
        '-of', 'json',
        filePath,
      ],
      { timeout: FFMPEG_TIMEOUT_MS },
    );

    const parsed = JSON.parse(stdout);
    const videoStream = (parsed.streams || []).find(
      (s: any) => s.codec_type === 'video',
    );
    const duration = Number(parsed.format?.duration);

    if (!videoStream || !videoStream.width || !videoStream.height) {
      throw new Error('El archivo no tiene un stream de video válido.');
    }
    if (!Number.isFinite(duration) || duration <= 0) {
      throw new Error('No se pudo determinar la duración del video.');
    }

    return {
      durationSeconds: duration,
      width: Number(videoStream.width),
      height: Number(videoStream.height),
    };
  }

  // --- Miniaturas --------------------------------------------------------

  // Saca un fotograma del video y lo guarda como JPEG. Se usa cuando el
  // usuario no sube su propia miniatura.
  async generateThumbnail(
    sourcePath: string,
    targetPath: string,
    durationSeconds: number,
  ): Promise<void> {
    // Al 10% de la duración, no en el segundo 0: muchos videos arrancan con
    // negro o un fundido, y esa miniatura no dice nada. El tope de 10 s es
    // para que en un video largo no tarde una eternidad en llegar hasta ahí.
    const at = Math.min(durationSeconds * 0.1, 10);

    await execFileAsync(
      'ffmpeg',
      [
        '-hide_banner',
        '-loglevel', 'error',
        '-ss', String(at),
        '-i', sourcePath,
        '-frames:v', '1',
        '-vf', THUMBNAIL_SCALE,
        '-q:v', '4', // 1 es la mejor calidad y 31 la peor; 4 es buen equilibrio
        '-f', 'image2',
        targetPath,
        '-y',
      ],
      { timeout: FFMPEG_TIMEOUT_MS, maxBuffer: 10 * 1024 * 1024 },
    );
  }

  // Convierte la imagen que subió el usuario a NUESTRO formato de miniatura.
  // Lanza si el archivo no es una imagen de verdad.
  //
  // Reencodear en vez de sólo validar y guardar el original es a propósito:
  //
  //  - Es la única validación confiable. ffprobe deduce el formato por la
  //    extensión: a un archivo de texto llamado "foto.png" le responde
  //    codec_name=png y sale con código 0. Sólo al decodificarlo se cae.
  //  - Normaliza el tamaño y el formato, así la grilla no termina cargando
  //    un PNG de 8 MB.
  //  - Descarta los metadatos del original (EXIF con geolocalización, por
  //    ejemplo) y nunca servimos con content-type de imagen bytes que subió
  //    un usuario sin tocar.
  async convertToThumbnail(
    sourcePath: string,
    targetPath: string,
  ): Promise<void> {
    await execFileAsync(
      'ffmpeg',
      [
        '-hide_banner',
        '-loglevel', 'error',
        '-i', sourcePath,
        '-frames:v', '1', // por si suben un GIF animado
        '-vf', THUMBNAIL_SCALE,
        '-q:v', '4',
        '-f', 'image2',
        targetPath,
        '-y',
      ],
      { timeout: FFMPEG_TIMEOUT_MS, maxBuffer: 10 * 1024 * 1024 },
    );

    // ffmpeg puede salir con 0 y dejar un archivo vacío si no decodificó nada.
    const info = await stat(targetPath);
    if (info.size === 0) {
      throw new Error('La imagen no se pudo decodificar.');
    }
  }

  // --- Segmentos bajo demanda -------------------------------------------

  // Devuelve la ruta en disco de un segmento listo para servir. Si ya está en
  // caché lo devuelve al toque; si no, lo transcodifica (respetando el tope de
  // concurrencia) y lo guarda.
  async segmentPath(
    videoId: number,
    sourcePath: string,
    rendition: Rendition,
    index: number,
    durationSeconds: number,
  ): Promise<string> {
    const dir = join(CACHE_DIR, String(videoId), rendition.name);
    const target = join(dir, `${index}.m4s`);

    return this.cachedOrBuild(
      `${videoId}/${rendition.name}/${index}`,
      target,
      async () => {
        // Los timescales salen del init, así que tiene que existir antes. Se
        // resuelve ACÁ, fuera del semáforo: si lo pidiéramos ya teniendo un
        // slot tomado, con el tope al límite nos trabaríamos esperando un
        // FFmpeg que no puede arrancar.
        const initFile = await this.initPath(videoId, sourcePath, rendition);
        const timescales = trackTimescales(await readFile(initFile));

        return this.transcodeSegment(
          target,
          dir,
          sourcePath,
          rendition,
          index,
          durationSeconds,
          timescales,
        );
      },
    );
  }

  // Segmento de init (EXT-X-MAP): trae sólo ftyp+moov, o sea las cabeceras de
  // códec, sin un solo frame de video. El player lo pide una vez por calidad y
  // lo antepone a cada segmento, así que NO puede contener media: si la
  // trajera, se reproduciría repetida antes de cada cachito.
  async initPath(
    videoId: number,
    sourcePath: string,
    rendition: Rendition,
  ): Promise<string> {
    const dir = join(CACHE_DIR, String(videoId), rendition.name);
    const target = join(dir, 'init.mp4');

    return this.cachedOrBuild(`${videoId}/${rendition.name}/init`, target, () =>
      this.buildInitSegment(target, dir, sourcePath, rendition),
    );
  }

  // Caché + deduplicación, compartido por segmentos e init.
  private async cachedOrBuild(
    key: string,
    target: string,
    build: () => Promise<string>,
  ): Promise<string> {
    if (await this.isCached(target)) return target;

    const pending = this.inFlight.get(key);
    if (pending) return pending;

    const job = build().finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, job);
    return job;
  }

  private async isCached(target: string): Promise<boolean> {
    try {
      await stat(target);
      // Marcamos el acceso para que la limpieza LRU sepa que sigue en uso.
      const now = new Date();
      await utimes(target, now, now).catch(() => {});
      return true;
    } catch {
      return false;
    }
  }

  private async transcodeSegment(
    target: string,
    dir: string,
    sourcePath: string,
    rendition: Rendition,
    index: number,
    durationSeconds: number,
    timescales: Map<number, number>,
  ): Promise<string> {
    await this.acquireSlot();
    const startedAt = Date.now();

    try {
      await mkdir(dir, { recursive: true });

      const start = index * SEGMENT_SECONDS;
      const length = segmentDuration(durationSeconds, index);

      // Escribimos a un temporal y recién al final renombramos. rename() es
      // atómico, así que otro request nunca puede encontrarse un .ts a medio
      // escribir y servirlo roto.
      const tmp = `${target}.${process.pid}.tmp`;

      await execFileAsync(
        'ffmpeg',
        [
          '-hide_banner',
          '-loglevel', 'error',

          // -ss ANTES de -i: FFmpeg salta directo al keyframe previo en vez de
          // decodificar el video entero desde el principio. Es la diferencia
          // entre que un segmento del minuto 40 tarde 1s o 40s.
          '-ss', String(start),
          '-i', sourcePath,
          '-t', String(length),

          ...this.encodingArgs(rendition),

          // Corre los timestamps a la posición global del segmento. Sin esto
          // todos empiezan en 0 y el player los apila encima al hacer seek.
          '-output_ts_offset', String(start),

          // fMP4 fragmentado. default_base_moof es lo que permite que el
          // segmento se interprete sin haber leído los anteriores.
          '-movflags', 'empty_moov+default_base_moof+frag_keyframe+omit_tfhd_offset',
          '-f', 'mp4',
          tmp,
          '-y',
        ],
        { timeout: FFMPEG_TIMEOUT_MS, maxBuffer: 10 * 1024 * 1024 },
      );

      // Dos correcciones sobre lo que escribió FFmpeg:
      //  1. dejar sólo la media (las cabeceras ya viajaron en init.mp4);
      //  2. reescribir el tfdt con la posición global, porque cada segmento se
      //     encodea por separado y sale creyendo que empieza en el segundo 0.
      const media = mediaBoxesOnly(await readFile(tmp));
      await writeFile(tmp, setBaseMediaDecodeTime(media, start, timescales));
      await rename(tmp, target);

      this.logger.debug(
        `segmento ${rendition.name}/${index} del video listo en ${Date.now() - startedAt}ms`,
      );

      void this.maybeSweepCache();
      return target;
    } finally {
      this.releaseSlot();
    }
  }

  private async buildInitSegment(
    target: string,
    dir: string,
    sourcePath: string,
    rendition: Rendition,
  ): Promise<string> {
    await this.acquireSlot();

    try {
      await mkdir(dir, { recursive: true });
      const tmp = `${target}.${process.pid}.tmp`;

      // Encodeamos una rebanada mínima y después nos quedamos sólo con las
      // cabeceras. Pedirle a FFmpeg directamente un archivo sin frames
      // (-frames:v 0) escribe el moov correcto pero termina con error, y no
      // queremos construir el init a partir de un comando que "falla bien".
      await execFileAsync(
        'ffmpeg',
        [
          '-hide_banner',
          '-loglevel', 'error',
          '-i', sourcePath,
          '-t', '0.1',

          ...this.encodingArgs(rendition),

          '-movflags', 'empty_moov+default_base_moof',
          '-f', 'mp4',
          tmp,
          '-y',
        ],
        { timeout: FFMPEG_TIMEOUT_MS, maxBuffer: 10 * 1024 * 1024 },
      );

      await writeFile(tmp, headerBoxesOnly(await readFile(tmp)));
      await rename(tmp, target);
      return target;
    } finally {
      this.releaseSlot();
    }
  }

  // Parámetros de encoding compartidos por el init y los segmentos. Tienen que
  // ser IDÉNTICOS en los dos: el init declara la configuración de códec contra
  // la que el player va a decodificar todos los segmentos.
  private encodingArgs(rendition: Rendition): string[] {
    return [
      '-vf', `scale=-2:${rendition.height}`,
      '-c:v', 'libx264',
      '-preset', 'veryfast', // en JIT el tiempo de encode ES la latencia
      '-crf', '23',
      '-maxrate', String(rendition.videoBitrate),
      '-bufsize', String(rendition.videoBitrate * 2),
      '-pix_fmt', 'yuv420p',

      // Keyframe SÓLO en el primer frame, para que el segmento se pueda
      // decodificar sin depender del anterior.
      // OJO con la expresión: "gte(t,0)" es verdadera para todos los frames y
      // hace que FFmpeg encodee todo en all-intra (medido: 1,4 MB por segmento
      // de 6 s en 720p, y un par moof/mdat por frame). "eq(n,0)" es el primer
      // frame y nada más.
      '-force_key_frames', 'expr:eq(n,0)',

      '-c:a', 'aac',
      '-b:a', String(rendition.audioBitrate),
      '-ac', '2',
      '-ar', '48000',
    ];
  }

  // --- Semáforo ---------------------------------------------------------

  private acquireSlot(): Promise<void> {
    if (this.running < MAX_CONCURRENT) {
      this.running++;
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.waiting.push(() => {
        this.running++;
        resolve();
      });
    });
  }

  private releaseSlot() {
    this.running--;
    this.waiting.shift()?.();
  }

  // --- Limpieza de la caché ---------------------------------------------

  // Borra la caché de un video (al eliminarlo, o si se re-sube el archivo).
  async dropCache(videoId: number) {
    await rm(join(CACHE_DIR, String(videoId)), {
      recursive: true,
      force: true,
    }).catch(() => {});
  }

  // Barremos cada tanto, no en cada segmento: recorrer el árbol entero en cada
  // request sería peor que el problema que resuelve.
  private async maybeSweepCache() {
    if (++this.writesSinceSweep < 50) return;
    this.writesSinceSweep = 0;

    try {
      const files: Array<{ path: string; size: number; atime: number }> = [];
      let total = 0;

      const walk = async (dir: string) => {
        const entries = await readdir(dir, { withFileTypes: true }).catch(
          () => [],
        );
        for (const entry of entries) {
          const full = join(dir, entry.name);
          if (entry.isDirectory()) {
            await walk(full);
          } else if (entry.name.endsWith('.m4s')) {
            // Sólo podamos segmentos: los init.mp4 pesan ~1 KB y volver a
            // generarlos obligaría al player a reinicializar el decoder.
            const info = await stat(full).catch(() => null);
            if (!info) continue;
            files.push({
              path: full,
              size: info.size,
              atime: info.mtimeMs,
            });
            total += info.size;
          }
        }
      };
      await walk(CACHE_DIR);

      if (total <= CACHE_MAX_BYTES) return;

      // Los más viejos primero: los que hace más tiempo que nadie mira.
      files.sort((a, b) => a.atime - b.atime);
      for (const file of files) {
        if (total <= CACHE_MAX_BYTES) break;
        await rm(file.path, { force: true }).catch(() => {});
        total -= file.size;
      }
      this.logger.log('Caché HLS podada por superar el tope de tamaño.');
    } catch (err) {
      // La limpieza es best-effort: si falla, seguimos sirviendo igual.
      this.logger.warn(`No se pudo podar la caché HLS: ${String(err)}`);
    }
  }
}
