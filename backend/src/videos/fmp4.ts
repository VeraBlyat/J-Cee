// Manipulación de cajas MP4, para partir lo que genera FFmpeg en las dos
// mitades que HLS con fMP4 necesita, y para corregir los timestamps.
//
// Un MP4 es una secuencia de "cajas" anidadas: 4 bytes de tamaño (big-endian),
// 4 bytes de tipo ASCII, y el contenido. Las que nos importan:
//
//   ftyp  qué variante de MP4 es
//   moov  configuración de los códecs (una vez, en init.mp4)
//     trak → tkhd (track_ID)  +  mdia → mdhd (timescale del track)
//   moof  cabecera de un fragmento
//     traf → tfhd (a qué track pertenece)  +  tfdt (en qué momento arranca)
//   mdat  los frames

interface Box {
  type: string;
  start: number; // offset del inicio de la caja
  end: number; // offset del final
  contentStart: number; // offset del primer byte de contenido
}

// Recorre las cajas de un nivel. No entra en las anidadas: para eso se vuelve
// a llamar con el rango de contenido de la caja contenedora.
function* boxesIn(buffer: Buffer, from = 0, to = buffer.length): Generator<Box> {
  let offset = from;

  while (offset + 8 <= to) {
    const size = buffer.readUInt32BE(offset);

    // size 0 significa "hasta el final" y size 1 usa un tamaño de 64 bits.
    // No los generamos nosotros, y ante algo así es más seguro frenar que
    // seguir leyendo a ciegas.
    if (size < 8 || offset + size > to) return;

    yield {
      type: buffer.toString('latin1', offset + 4, offset + 8),
      start: offset,
      end: offset + size,
      contentStart: offset + 8,
    };
    offset += size;
  }
}

function filterBoxes(buffer: Buffer, keepTypes: string[]): Buffer {
  const keep: Buffer[] = [];
  for (const box of boxesIn(buffer)) {
    if (keepTypes.includes(box.type)) {
      keep.push(buffer.subarray(box.start, box.end));
    }
  }
  return Buffer.concat(keep);
}

// Las cabeceras, para init.mp4.
export function headerBoxesOnly(buffer: Buffer): Buffer {
  return filterBoxes(buffer, ['ftyp', 'moov']);
}

// La media, para los segmentos. El player antepone el init a CADA segmento,
// así que si el segmento trajera su propio moov el decoder se reiniciaría en
// cada cachito. Se descarta también el "mfra" del final, un índice que sólo
// tiene sentido en un archivo completo.
export function mediaBoxesOnly(buffer: Buffer): Buffer {
  return filterBoxes(buffer, ['styp', 'moof', 'mdat']);
}

// --- Timescales -----------------------------------------------------------

// Lee, del moov de un init, el timescale de cada track. Hace falta para
// convertir segundos a las unidades de tiempo de cada pista: el video y el
// audio usan escalas distintas (típico: 15360 y 48000).
export function trackTimescales(initSegment: Buffer): Map<number, number> {
  const result = new Map<number, number>();

  for (const top of boxesIn(initSegment)) {
    if (top.type !== 'moov') continue;

    for (const moovChild of boxesIn(initSegment, top.contentStart, top.end)) {
      if (moovChild.type !== 'trak') continue;

      let trackId: number | null = null;
      let timescale: number | null = null;

      for (const trakChild of boxesIn(
        initSegment,
        moovChild.contentStart,
        moovChild.end,
      )) {
        if (trakChild.type === 'tkhd') {
          const version = initSegment[trakChild.contentStart];
          // Tras version(1) + flags(3) vienen creation y modification, de 4
          // bytes en la versión 0 y de 8 en la versión 1.
          const offset = trakChild.contentStart + 4 + (version === 1 ? 16 : 8);
          trackId = initSegment.readUInt32BE(offset);
        } else if (trakChild.type === 'mdia') {
          for (const mdiaChild of boxesIn(
            initSegment,
            trakChild.contentStart,
            trakChild.end,
          )) {
            if (mdiaChild.type !== 'mdhd') continue;
            const version = initSegment[mdiaChild.contentStart];
            const offset = mdiaChild.contentStart + 4 + (version === 1 ? 16 : 8);
            timescale = initSegment.readUInt32BE(offset);
          }
        }
      }

      if (trackId !== null && timescale) result.set(trackId, timescale);
    }
  }

  return result;
}

// --- Corrección del tfdt --------------------------------------------------

// Reescribe el baseMediaDecodeTime de cada fragmento para que apunte a la
// posición GLOBAL del segmento dentro del video.
//
// Es imprescindible y no es opcional: cada segmento se encodea por separado,
// así que FFmpeg le pone timestamps arrancando en cero, y ni -output_ts_offset
// ni -copyts se lo llevan al muxer MP4. Con todos los segmentos declarando que
// empiezan en 0, el player los apila a todos en el mismo lugar de la línea de
// tiempo y sólo se ve el primero.
export function setBaseMediaDecodeTime(
  segment: Buffer,
  startSeconds: number,
  timescales: Map<number, number>,
): Buffer {
  // Trabajamos sobre una copia: el buffer de entrada puede estar cacheado.
  const out = Buffer.from(segment);

  for (const top of boxesIn(out)) {
    if (top.type !== 'moof') continue;

    for (const moofChild of boxesIn(out, top.contentStart, top.end)) {
      if (moofChild.type !== 'traf') continue;

      let trackId: number | null = null;
      let tfdt: Box | null = null;

      for (const trafChild of boxesIn(
        out,
        moofChild.contentStart,
        moofChild.end,
      )) {
        if (trafChild.type === 'tfhd') {
          // version(1) + flags(3), y enseguida el track_ID.
          trackId = out.readUInt32BE(trafChild.contentStart + 4);
        } else if (trafChild.type === 'tfdt') {
          tfdt = trafChild;
        }
      }

      if (trackId === null || !tfdt) continue;

      const timescale = timescales.get(trackId);
      if (!timescale) continue;

      const version = out[tfdt.contentStart];
      const value = Math.round(startSeconds * timescale);
      const valueOffset = tfdt.contentStart + 4;

      if (version === 1) {
        out.writeBigUInt64BE(BigInt(value), valueOffset);
      } else {
        // La versión 0 usa 32 bits. Alcanza para ~77 horas de video a un
        // timescale de 15360, así que no vale la pena reescribir la caja
        // entera para agrandarla.
        out.writeUInt32BE(Math.min(value, 0xffffffff), valueOffset);
      }
    }
  }

  return out;
}
