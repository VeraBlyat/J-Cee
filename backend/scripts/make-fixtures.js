// Genera los videos de prueba que usa la colección de Postman.
//
// Se generan con FFmpeg en vez de commitearlos: son binarios de ~100 KB que
// no aportan nada al historial de git y que además se pueden recrear en un
// segundo. El backend ya exige FFmpeg para funcionar, así que si esto falla
// es porque falta una dependencia que igual haría fallar la app entera.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'tests', 'postman', 'fixtures');

// Chiquitos y cortos a propósito: la colección los sube de verdad y cada
// subida corre ffprobe. Un video largo haría lento el pipeline sin probar
// nada más.
const FIXTURES = [
  // Horizontal: video "normal", NO aparece en reels.
  { name: 'sample.mp4', size: '320x240', duration: 2 },
  // Vertical y corto: cumple el criterio de reel.
  { name: 'reel.mp4', size: '180x320', duration: 2 },
];

function generar({ name, size, duration }) {
  const destino = path.join(DIR, name);
  if (fs.existsSync(destino)) {
    console.log(`  ${name}: ya existe`);
    return;
  }

  execFileSync(
    'ffmpeg',
    [
      '-hide_banner',
      '-loglevel', 'error',
      '-f', 'lavfi',
      '-i', `testsrc=size=${size}:rate=15:duration=${duration}`,
      '-f', 'lavfi',
      '-i', `sine=frequency=440:duration=${duration}`,
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-shortest',
      destino,
      '-y',
    ],
    { stdio: 'inherit' },
  );

  const kb = Math.round(fs.statSync(destino).size / 1024);
  console.log(`  ${name}: generado (${size}, ${duration}s, ${kb} KB)`);
}

fs.mkdirSync(DIR, { recursive: true });
FIXTURES.forEach(generar);
