// Marca como administrador a un usuario ya registrado, buscándolo por email.
//
//   npm run db:make-admin -- toby@ejemplo.com
//
// Para qué existe: `is_admin` sólo se puede cambiar desde PATCH /api/admin/users,
// que está detrás de AdminGuard. O sea que hace falta ser admin para nombrar a
// otro admin. Sobre una base recién reseteada no hay ninguno, así que sin este
// script el panel de administración queda inaccesible para siempre.
//
// Se corre UNA vez después del reset de producción, cuando la primera cuenta ya
// se registró desde la web. De ahí en adelante los admins se nombran desde el
// panel, como siempre.
require('dotenv/config');
const { Pool } = require('pg');

async function main() {
  // process.argv[2] es el primer argumento después del script. Con
  // `npm run db:make-admin -- x@y.com`, npm ya se comió el "--".
  const email = (process.argv[2] || '').trim().toLowerCase();

  if (!email) {
    console.error(
      'Falta el email.\n\n  npm run db:make-admin -- usuario@ejemplo.com\n',
    );
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.error('Falta DATABASE_URL. Abortando sin tocar nada.');
    process.exit(1);
  }

  // Mismo criterio que reset-db.js: este comando se corre pegando una
  // connection string en la terminal, así que mostramos contra qué base va
  // (sin la contraseña) antes de escribir.
  const destino = new URL(process.env.DATABASE_URL);
  console.log(`\n  Servidor : ${destino.hostname}:${destino.port || 5432}`);
  console.log(`  Base     : ${destino.pathname.replace('/', '')}\n`);

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl:
      process.env.DATABASE_SSL === 'true'
        ? { rejectUnauthorized: false }
        : undefined,
  });

  try {
    // El email se normaliza igual que en AuthService (trim + minúsculas), por
    // eso alcanza con comparar directo contra la columna.
    const { rows } = await pool.query(
      `UPDATE users SET is_admin = TRUE
       WHERE email = $1
       RETURNING id, username, email`,
      [email],
    );

    if (rows.length === 0) {
      console.error(
        `No hay ningún usuario con el email "${email}".\n` +
          'Registrate primero desde la web y volvé a correr este comando.',
      );
      process.exit(1);
    }

    const user = rows[0];
    console.log(
      `Listo: ${user.username} <${user.email}> (id ${user.id}) ahora es admin.`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Error al marcar el usuario como admin:', err);
  process.exit(1);
});
