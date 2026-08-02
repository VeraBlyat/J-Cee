import {
  SEGMENT_SECONDS,
  buildMasterPlaylist,
  buildMediaPlaylist,
  findRendition,
  renditionsFor,
  segmentCount,
  segmentDuration,
} from './hls';

describe('escalera de calidades', () => {
  it('ofrece 360p y 720p para una fuente 1080p', () => {
    expect(renditionsFor(1080).map((r) => r.name)).toEqual(['360p', '720p']);
  });

  it('ofrece 360p y 720p para una fuente 720p exacta', () => {
    expect(renditionsFor(720).map((r) => r.name)).toEqual(['360p', '720p']);
  });

  it('no escala hacia arriba: una fuente 480p sólo da 360p', () => {
    expect(renditionsFor(480).map((r) => r.name)).toEqual(['360p']);
  });

  it('sirve en resolución nativa si la fuente es más chica que el escalón mínimo', () => {
    expect(renditionsFor(240).map((r) => r.name)).toEqual(['240p']);
  });

  it('no encuentra una calidad que no corresponde a la fuente', () => {
    expect(findRendition(480, '720p')).toBeNull();
    expect(findRendition(1080, '720p')).not.toBeNull();
  });
});

describe('cálculo de segmentos', () => {
  it('parte la duración en cachitos de SEGMENT_SECONDS', () => {
    expect(segmentCount(60)).toBe(60 / SEGMENT_SECONDS);
  });

  it('cuenta un segmento extra para el resto', () => {
    expect(segmentCount(20)).toBe(4); // 6 + 6 + 6 + 2
  });

  it('siempre hay al menos un segmento, aunque el video sea cortísimo', () => {
    expect(segmentCount(0.5)).toBe(1);
  });

  it('el último segmento es más corto que los demás', () => {
    expect(segmentDuration(20, 0)).toBe(6);
    expect(segmentDuration(20, 2)).toBe(6);
    expect(segmentDuration(20, 3)).toBe(2);
  });
});

describe('media playlist', () => {
  const playlist = buildMediaPlaylist(20);

  it('declara VOD y cierra con ENDLIST', () => {
    // Sin ENDLIST el player lo trata como transmisión en vivo y no deja hacer seek.
    expect(playlist).toContain('#EXT-X-PLAYLIST-TYPE:VOD');
    expect(playlist.trimEnd().endsWith('#EXT-X-ENDLIST')).toBe(true);
  });

  it('declara TARGETDURATION igual al largo de segmento', () => {
    expect(playlist).toContain(`#EXT-X-TARGETDURATION:${SEGMENT_SECONDS}`);
  });

  it('lista un segmento por cachito, numerados desde 0', () => {
    const segments = playlist.match(/^\d+\.m4s$/gm);
    expect(segments).toEqual(['0.m4s', '1.m4s', '2.m4s', '3.m4s']);
  });

  it('declara el segmento de init, que fMP4 necesita', () => {
    // Sin EXT-X-MAP el player no tiene las cabeceras de códec y no arranca.
    expect(playlist).toContain('#EXT-X-MAP:URI="init.mp4"');
    expect(playlist).toContain('#EXT-X-VERSION:7');
  });

  it('la suma de los EXTINF da la duración total del video', () => {
    const total = [...playlist.matchAll(/#EXTINF:([\d.]+),/g)].reduce(
      (sum, m) => sum + Number(m[1]),
      0,
    );
    expect(total).toBeCloseTo(20, 3);
  });
});

describe('master playlist', () => {
  it('lista una variante por calidad, con su resolución', () => {
    const master = buildMasterPlaylist(1920, 1080);

    expect(master).toContain('RESOLUTION=640x360');
    expect(master).toContain('RESOLUTION=1280x720');
  });

  it('usa URIs relativas a la carpeta del master', () => {
    // El master se sirve en /videos/:id/hls/master.m3u8, así que el player
    // resuelve estas URIs desde /videos/:id/hls/. Cualquier prefijo de más
    // termina en una ruta duplicada tipo /videos/1/hls/1/hls/360p/...
    const master = buildMasterPlaylist(1920, 1080);
    const uris = master.match(/^.+index\.m3u8$/gm);

    expect(uris).toEqual(['360p/index.m3u8', '720p/index.m3u8']);
  });

  it('mantiene el aspect ratio en anchos pares (libx264 los exige)', () => {
    // 1440x1080 es 4:3; a 360 de alto le corresponden 480 de ancho.
    const master = buildMasterPlaylist(1440, 1080);
    expect(master).toContain('RESOLUTION=480x360');

    for (const [, width] of master.matchAll(/RESOLUTION=(\d+)x/g)) {
      expect(Number(width) % 2).toBe(0);
    }
  });

  it('una fuente vertical (reel) no rompe el cálculo', () => {
    const master = buildMasterPlaylist(1080, 1920);
    expect(master).toContain('RESOLUTION=202x360');
    expect(master).toContain('RESOLUTION=406x720');
  });
});
