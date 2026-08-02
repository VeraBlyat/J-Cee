import { REELS_PAGE_SIZE, paginationFrom } from './reels';

describe('paginationFrom', () => {
  it('usa el tamaño de página por defecto sin parámetros', () => {
    expect(paginationFrom()).toEqual({ limit: REELS_PAGE_SIZE, offset: 0 });
  });

  it('respeta valores válidos', () => {
    expect(paginationFrom('5', '20')).toEqual({ limit: 5, offset: 20 });
  });

  it('pone un tope duro al limit', () => {
    // Sin tope, un ?limit=100000 haría que la base arme una respuesta enorme.
    expect(paginationFrom('100000').limit).toBe(50);
  });

  it('ignora basura y vuelve a los valores por defecto', () => {
    for (const basura of ['abc', '-5', '0', '1.5', '', 'null']) {
      expect(paginationFrom(basura, basura)).toEqual({
        limit: REELS_PAGE_SIZE,
        offset: 0,
      });
    }
  });

  it('ignora un intento de inyección en el query string', () => {
    // Igual van como parámetros a la consulta, pero cuanto antes se descarte
    // la basura, mejor.
    expect(paginationFrom('1; DROP TABLE videos', '5 OR 1=1')).toEqual({
      limit: REELS_PAGE_SIZE,
      offset: 0,
    });
  });
});
