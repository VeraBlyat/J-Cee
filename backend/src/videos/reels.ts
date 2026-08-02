// Qué cuenta como reel.
//
// No hay un flag en la base a propósito: un reel se DERIVA de la metadata que
// ya leemos con ffprobe al subir. Así los videos verticales que ya estaban
// aparecen solos en la sección, sin migración ni que nadie los marque a mano,
// y no puede existir un video marcado como reel que en realidad es horizontal.

// Vertical: más alto que ancho. Los cuadrados (1:1) no entran; se ven mal en
// una pantalla completa vertical.
export const REEL_MAX_DURATION_SECONDS = 90;

// Cuántos se mandan por página. El feed es infinito, pero cargar de a 100
// videos sería tirar ancho de banda: nadie llega tan abajo de una sentada.
export const REELS_PAGE_SIZE = 10;

// Normaliza los parámetros de paginación que llegan por query string, que
// pueden traer cualquier cosa.
export function paginationFrom(limit?: string, offset?: string) {
  const parsedLimit = Number(limit);
  const parsedOffset = Number(offset);

  return {
    limit:
      Number.isInteger(parsedLimit) && parsedLimit > 0
        ? Math.min(parsedLimit, 50) // tope duro: nadie pide 10.000 de una
        : REELS_PAGE_SIZE,
    offset:
      Number.isInteger(parsedOffset) && parsedOffset > 0 ? parsedOffset : 0,
  };
}
