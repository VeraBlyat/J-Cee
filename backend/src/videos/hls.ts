// Lógica pura de HLS: la escalera de calidades y la generación de playlists.
// No toca disco ni ejecuta FFmpeg, así que se puede testear sin dependencias.

// Duración de cada "cachito". Tiene que ser el mismo número acá y en el
// comando de FFmpeg: la playlist promete segmentos de N segundos y el
// transcodificador tiene que entregar exactamente eso, o el player se
// desincroniza al hacer seek.
export const SEGMENT_SECONDS = 6;

export interface Rendition {
  name: string; // "360p" — también es el segmento de la URL
  height: number;
  videoBitrate: number; // bits/s, para el atributo BANDWIDTH del master
  audioBitrate: number;
}

// Escalera fija. El ancho lo calcula FFmpeg con scale=-2:<height>, que
// mantiene el aspect ratio y fuerza un número par (libx264 lo exige).
const LADDER: Rendition[] = [
  { name: '360p', height: 360, videoBitrate: 800_000, audioBitrate: 96_000 },
  { name: '720p', height: 720, videoBitrate: 2_800_000, audioBitrate: 128_000 },
];

// Nunca escalamos hacia arriba: reencodear un 480p a 720p gasta CPU y espacio
// para agregar cero información. Si el video es más chico que el escalón más
// bajo, lo servimos en su resolución nativa.
export function renditionsFor(sourceHeight: number): Rendition[] {
  const usable = LADDER.filter((r) => r.height <= sourceHeight);
  if (usable.length > 0) return usable;

  return [
    {
      name: `${sourceHeight}p`,
      height: sourceHeight,
      videoBitrate: 400_000,
      audioBitrate: 96_000,
    },
  ];
}

export function findRendition(
  sourceHeight: number,
  name: string,
): Rendition | null {
  return renditionsFor(sourceHeight).find((r) => r.name === name) || null;
}

// Cuántos segmentos entran en el video. El último es más corto que los demás.
export function segmentCount(durationSeconds: number): number {
  return Math.max(1, Math.ceil(durationSeconds / SEGMENT_SECONDS));
}

export function segmentDuration(
  durationSeconds: number,
  index: number,
): number {
  const remaining = durationSeconds - index * SEGMENT_SECONDS;
  return Math.min(SEGMENT_SECONDS, Math.max(0, remaining));
}

// Master playlist: le dice al player qué calidades hay disponibles para que
// elija sola según el ancho de banda que mida.
export function buildMasterPlaylist(
  sourceWidth: number,
  sourceHeight: number,
): string {
  const lines = ['#EXTM3U', '#EXT-X-VERSION:3'];

  for (const r of renditionsFor(sourceHeight)) {
    // El ancho de cada rendition, redondeado a par igual que hace FFmpeg.
    const width = Math.round((sourceWidth * r.height) / sourceHeight / 2) * 2;
    const bandwidth = r.videoBitrate + r.audioBitrate;

    lines.push(
      `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${width}x${r.height},CODECS="avc1.4d401f,mp4a.40.2"`,
      // URI relativa a la carpeta del master (.../videos/:id/hls/), así que
      // va sin prefijo. Si acá pusiéramos la ruta completa, el player la
      // resolvería DESDE esa carpeta y terminaría pidiendo
      // /videos/1/hls/1/hls/360p/index.m3u8.
      `${r.name}/index.m3u8`,
    );
  }

  return lines.join('\n') + '\n';
}

// Playlist de una calidad: la lista de segmentos. Acá está el truco de JIT —
// listamos segmentos que TODAVÍA NO EXISTEN. Se calculan con aritmética sobre
// la duración, y recién se transcodifican cuando el player los pide.
// Usamos segmentos fMP4 (CMAF), no MPEG-TS. Con TS, empalmar segmentos
// encodeados por separado deja discontinuidades de timestamp en cada corte
// (medido: 17 warnings de DTS y paquetes corruptos en un video de 20s); con
// fMP4 el mismo video empalma con cero. Cuesta un segmento de init aparte
// (EXT-X-MAP), que trae sólo las cabeceras de códec.
export function buildMediaPlaylist(durationSeconds: number): string {
  const count = segmentCount(durationSeconds);

  const lines = [
    '#EXTM3U',
    '#EXT-X-VERSION:7', // 7 es el mínimo que soporta EXT-X-MAP con fMP4
    `#EXT-X-TARGETDURATION:${SEGMENT_SECONDS}`,
    '#EXT-X-MEDIA-SEQUENCE:0',
    '#EXT-X-PLAYLIST-TYPE:VOD', // VOD: el player sabe que puede hacer seek libremente
    '#EXT-X-MAP:URI="init.mp4"',
  ];

  for (let i = 0; i < count; i++) {
    lines.push(`#EXTINF:${segmentDuration(durationSeconds, i).toFixed(3)},`);
    lines.push(`${i}.m4s`);
  }

  lines.push('#EXT-X-ENDLIST'); // sin esto el player lo trata como un vivo
  return lines.join('\n') + '\n';
}
