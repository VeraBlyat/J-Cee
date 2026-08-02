import { MAX_HASHTAGS, parseHashtags } from './hashtags';

describe('parseHashtags', () => {
  it('separa por espacios y quita el numeral', () => {
    expect(parseHashtags('#nextjs #nestjs')).toEqual(['nextjs', 'nestjs']);
  });

  it('acepta separación por comas', () => {
    expect(parseHashtags('nextjs, nestjs,react')).toEqual([
      'nextjs',
      'nestjs',
      'react',
    ]);
  });

  it('mezcla ambos formatos y espacios de más', () => {
    expect(parseHashtags('  #nextjs,  nestjs   #react ')).toEqual([
      'nextjs',
      'nestjs',
      'react',
    ]);
  });

  it('normaliza a minúsculas para que #NextJS y #nextjs sean el mismo', () => {
    expect(parseHashtags('#NextJS #NEXTJS #nextjs')).toEqual(['nextjs']);
  });

  it('elimina duplicados conservando el orden de aparición', () => {
    expect(parseHashtags('react vue react svelte')).toEqual([
      'react',
      'vue',
      'svelte',
    ]);
  });

  it('conserva acentos y ñ', () => {
    expect(parseHashtags('#programación #diseño')).toEqual([
      'programación',
      'diseño',
    ]);
  });

  it('conserva guiones, guiones bajos y números', () => {
    expect(parseHashtags('#next-js #node_18 #css3')).toEqual([
      'next-js',
      'node_18',
      'css3',
    ]);
  });

  it('descarta signos de puntuación pegados', () => {
    expect(parseHashtags('#react! ¿#vue?')).toEqual(['react', 'vue']);
  });

  it('tolera numerales repetidos', () => {
    expect(parseHashtags('##react')).toEqual(['react']);
  });

  it('ignora entradas que quedan vacías al limpiarlas', () => {
    expect(parseHashtags('# ## !!! ,,,')).toEqual([]);
  });

  it('descarta hashtags más largos que la columna de la tabla', () => {
    // La columna es VARCHAR(50); si dejáramos pasar uno más largo, el INSERT
    // reventaría con un 500 en vez de ignorarlo.
    const largo = 'a'.repeat(51);
    expect(parseHashtags(`#ok #${largo}`)).toEqual(['ok']);
    expect(parseHashtags(`#${'a'.repeat(50)}`)).toEqual(['a'.repeat(50)]);
  });

  it(`corta en ${MAX_HASHTAGS} hashtags`, () => {
    const muchos = Array.from({ length: 20 }, (_, i) => `#tag${i}`).join(' ');
    expect(parseHashtags(muchos)).toHaveLength(MAX_HASHTAGS);
  });

  it('devuelve una lista vacía sin entrada', () => {
    expect(parseHashtags(undefined)).toEqual([]);
    expect(parseHashtags(null)).toEqual([]);
    expect(parseHashtags('')).toEqual([]);
  });
});
