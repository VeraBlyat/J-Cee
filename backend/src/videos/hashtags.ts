// Normalización de hashtags. Es lógica pura: el formulario manda texto libre
// y de acá sale la lista canónica que se guarda en la tabla `hashtags`.

export const MAX_HASHTAGS = 10;
export const MAX_HASHTAG_LENGTH = 50; // igual que el VARCHAR(50) de la tabla

// Acepta las dos formas en que la gente escribe hashtags, mezcladas:
//   "#nextjs #nest-js, react"  →  ["nextjs", "nest-js", "react"]
//
// Se guardan en minúsculas y sin "#" para que #NextJS y #nextjs sean el mismo
// hashtag y el UNIQUE de la tabla haga lo que uno espera.
export function parseHashtags(input?: string | null): string[] {
  if (!input) return [];

  const seen = new Set<string>();

  for (const raw of input.split(/[\s,]+/)) {
    const tag = raw
      .trim()
      .toLowerCase()
      // Se quitan los "#" del principio (alguien puede escribir "##react") y
      // cualquier caracter que no sea letra, número, guion o guion bajo. Las
      // letras acentuadas y la ñ se conservan: "#programación" es válido.
      .replace(/^#+/, '')
      .replace(/[^\p{L}\p{N}_-]/gu, '');

    if (!tag || tag.length > MAX_HASHTAG_LENGTH) continue;

    seen.add(tag);
    if (seen.size >= MAX_HASHTAGS) break;
  }

  return [...seen];
}
