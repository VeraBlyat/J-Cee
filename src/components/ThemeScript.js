// Aplica el tema ANTES de que el navegador pinte la primera vez.
//
// Va como script inline en el <head> a propósito: si lo hiciéramos en un
// efecto de React, la página se vería un instante en claro antes de pasar a
// oscuro. Ese parpadeo blanco es especialmente feo en una app de video.
const script = `
(function () {
  try {
    var guardado = localStorage.getItem('jcee-theme');
    var prefiereOscuro = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.dataset.theme = guardado || (prefiereOscuro ? 'dark' : 'light');
  } catch (e) {
    // Modo incógnito con storage bloqueado: el tema claro es un default sano.
    document.documentElement.dataset.theme = 'light';
  }
})();
`;

export default function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
