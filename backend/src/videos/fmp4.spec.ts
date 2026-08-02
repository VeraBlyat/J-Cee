import {
  headerBoxesOnly,
  mediaBoxesOnly,
  setBaseMediaDecodeTime,
  trackTimescales,
} from './fmp4';

// --- Helpers para armar cajas MP4 de mentira -------------------------------

function box(type: string, payload: Buffer = Buffer.alloc(0)): Buffer {
  const header = Buffer.alloc(8);
  header.writeUInt32BE(8 + payload.length, 0);
  header.write(type, 4, 'latin1');
  return Buffer.concat([header, payload]);
}

function container(type: string, ...children: Buffer[]): Buffer {
  return box(type, Buffer.concat(children));
}

function typesOf(buffer: Buffer): string[] {
  const types: string[] = [];
  let offset = 0;
  while (offset + 8 <= buffer.length) {
    const size = buffer.readUInt32BE(offset);
    types.push(buffer.toString('latin1', offset + 4, offset + 8));
    if (size < 8) break;
    offset += size;
  }
  return types;
}

// tkhd v0: version(1) flags(3) creation(4) modification(4) track_ID(4)
function tkhd(trackId: number): Buffer {
  const payload = Buffer.alloc(20);
  payload.writeUInt32BE(trackId, 12);
  return box('tkhd', payload);
}

// mdhd v0: version(1) flags(3) creation(4) modification(4) timescale(4)
function mdhd(timescale: number): Buffer {
  const payload = Buffer.alloc(20);
  payload.writeUInt32BE(timescale, 12);
  return box('mdhd', payload);
}

// tfhd: version(1) flags(3) track_ID(4)
function tfhd(trackId: number): Buffer {
  const payload = Buffer.alloc(8);
  payload.writeUInt32BE(trackId, 4);
  return box('tfhd', payload);
}

// tfdt v0: version(1) flags(3) baseMediaDecodeTime(4)
function tfdt(value = 0): Buffer {
  const payload = Buffer.alloc(8);
  payload.writeUInt32BE(value, 4);
  return box('tfdt', payload);
}

// tfdt v1: version(1) flags(3) baseMediaDecodeTime(8)
function tfdt64(value = 0): Buffer {
  const payload = Buffer.alloc(12);
  payload[0] = 1;
  payload.writeBigUInt64BE(BigInt(value), 4);
  return box('tfdt', payload);
}

function readTfdt(segment: Buffer): number[] {
  const values: number[] = [];
  const walk = (from: number, to: number) => {
    let offset = from;
    while (offset + 8 <= to) {
      const size = segment.readUInt32BE(offset);
      const type = segment.toString('latin1', offset + 4, offset + 8);
      if (size < 8) return;
      if (type === 'tfdt') {
        const version = segment[offset + 8];
        values.push(
          version === 1
            ? Number(segment.readBigUInt64BE(offset + 12))
            : segment.readUInt32BE(offset + 12),
        );
      }
      if (type === 'moof' || type === 'traf') walk(offset + 8, offset + size);
      offset += size;
    }
  };
  walk(0, segment.length);
  return values;
}

// --- Separación init / media ----------------------------------------------

describe('headerBoxesOnly', () => {
  it('conserva ftyp y moov, y descarta la media', () => {
    const input = Buffer.concat([
      box('ftyp'),
      box('moov', Buffer.alloc(64)),
      box('moof'),
      box('mdat', Buffer.alloc(128)),
      box('mfra'),
    ]);

    expect(typesOf(headerBoxesOnly(input))).toEqual(['ftyp', 'moov']);
  });

  it('mantiene el contenido del moov intacto', () => {
    const payload = Buffer.from('configuración-de-códec');
    const input = Buffer.concat([box('ftyp'), box('moov', payload), box('mdat')]);

    expect(headerBoxesOnly(input).subarray(8 + 8)).toEqual(payload);
  });

  it('corta si una caja declara un tamaño imposible', () => {
    const bad = Buffer.alloc(12);
    bad.writeUInt32BE(9999, 0);
    bad.write('moov', 4, 'latin1');

    expect(typesOf(headerBoxesOnly(Buffer.concat([box('ftyp'), bad])))).toEqual([
      'ftyp',
    ]);
  });

  it('no explota con un buffer vacío o basura', () => {
    expect(headerBoxesOnly(Buffer.alloc(0))).toHaveLength(0);
    expect(headerBoxesOnly(Buffer.from('xx'))).toHaveLength(0);
  });
});

describe('mediaBoxesOnly', () => {
  it('conserva moof y mdat, y descarta las cabeceras', () => {
    const input = Buffer.concat([
      box('ftyp'),
      box('moov', Buffer.alloc(64)),
      box('moof'),
      box('mdat', Buffer.alloc(128)),
      box('mfra'),
    ]);

    expect(typesOf(mediaBoxesOnly(input))).toEqual(['moof', 'mdat']);
  });

  it('conserva varios pares moof/mdat en orden', () => {
    const input = Buffer.concat([
      box('ftyp'),
      box('moov'),
      box('moof'),
      box('mdat'),
      box('moof'),
      box('mdat'),
      box('mfra'),
    ]);

    expect(typesOf(mediaBoxesOnly(input))).toEqual([
      'moof',
      'mdat',
      'moof',
      'mdat',
    ]);
  });

  it('acepta el styp opcional de los segmentos CMAF', () => {
    const input = Buffer.concat([box('styp'), box('moof'), box('mdat')]);
    expect(typesOf(mediaBoxesOnly(input))).toEqual(['styp', 'moof', 'mdat']);
  });

  it('init y media son complementarios: juntos dan el archivo entero', () => {
    const input = Buffer.concat([
      box('ftyp'),
      box('moov'),
      box('moof'),
      box('mdat'),
    ]);

    expect(
      headerBoxesOnly(input).length + mediaBoxesOnly(input).length,
    ).toBe(input.length);
  });
});

// --- Timescales ------------------------------------------------------------

describe('trackTimescales', () => {
  const init = Buffer.concat([
    box('ftyp'),
    container(
      'moov',
      container('trak', tkhd(1), container('mdia', mdhd(15360))),
      container('trak', tkhd(2), container('mdia', mdhd(48000))),
    ),
  ]);

  it('lee el timescale de cada track por su id', () => {
    // Video y audio usan escalas distintas: por eso el tfdt no se puede
    // corregir con un único factor para todo el segmento.
    expect(trackTimescales(init)).toEqual(
      new Map([
        [1, 15360],
        [2, 48000],
      ]),
    );
  });

  it('devuelve un mapa vacío si no hay moov', () => {
    expect(trackTimescales(box('ftyp')).size).toBe(0);
  });
});

// --- Corrección del tfdt ---------------------------------------------------

describe('setBaseMediaDecodeTime', () => {
  const timescales = new Map([
    [1, 15360],
    [2, 48000],
  ]);

  const segment = Buffer.concat([
    container(
      'moof',
      container('traf', tfhd(1), tfdt(0)),
      container('traf', tfhd(2), tfdt(0)),
    ),
    box('mdat', Buffer.alloc(32)),
  ]);

  it('convierte los segundos a las unidades de cada track', () => {
    // Sin esto, todos los segmentos dicen empezar en 0 y el player los apila
    // en el mismo punto de la línea de tiempo.
    const result = setBaseMediaDecodeTime(segment, 6, timescales);
    expect(readTfdt(result)).toEqual([6 * 15360, 6 * 48000]);
  });

  it('el segmento 0 queda en cero', () => {
    expect(readTfdt(setBaseMediaDecodeTime(segment, 0, timescales))).toEqual([
      0, 0,
    ]);
  });

  it('redondea los tiempos fraccionarios', () => {
    const result = setBaseMediaDecodeTime(segment, 2.5, timescales);
    expect(readTfdt(result)).toEqual([38400, 120000]);
  });

  it('soporta tfdt de 64 bits', () => {
    const wide = Buffer.concat([
      container('moof', container('traf', tfhd(1), tfdt64(0))),
      box('mdat'),
    ]);

    expect(readTfdt(setBaseMediaDecodeTime(wide, 12, timescales))).toEqual([
      12 * 15360,
    ]);
  });

  it('no toca el buffer original', () => {
    const copy = Buffer.from(segment);
    setBaseMediaDecodeTime(segment, 18, timescales);
    expect(segment).toEqual(copy);
  });

  it('deja el mdat intacto: sólo corrige timestamps', () => {
    const result = setBaseMediaDecodeTime(segment, 6, timescales);
    expect(result.length).toBe(segment.length);
    expect(typesOf(result)).toEqual(['moof', 'mdat']);
  });

  it('ignora tracks cuyo timescale desconoce', () => {
    const unknown = Buffer.concat([
      container('moof', container('traf', tfhd(99), tfdt(0))),
      box('mdat'),
    ]);

    expect(readTfdt(setBaseMediaDecodeTime(unknown, 6, timescales))).toEqual([0]);
  });
});
