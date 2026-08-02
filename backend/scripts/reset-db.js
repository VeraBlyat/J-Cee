// Reset destructivo de la base: borra las tablas y las vuelve a crear desde
// schema.sql. Se usó para pasar de las contraseñas en texto plano al esquema
// con email + bcrypt, porque las contraseñas viejas no se pueden "des-hashear".
//
//   npm run db:reset -- --si-quiero-borrar-todo
//
// Pide esa bandera a propósito: `npm run migrate` es idempotente y seguro,
// este comando NO lo es y no queremos que se ejecute por accidente ni desde CI.
require('dotenv/config');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const CONFIRM_FLAG = '--si-quiero-borrar-todo';

// TODAS las tablas del esquema, de la más dependiente a la menos. Tiene que
// estar completa: si una tabla nueva queda afuera, el DROP ... CASCADE de las
// otras le borra la foreign key pero NO sus filas, y schema.sql tampoco la
// vuelve a crear porque usa CREATE TABLE IF NOT EXISTS. Resultado: filas
// huérfanas apuntando a ids que el SERIAL va a reutilizar, y sin la FK que lo
// impida (hashtags de otro video, suscripciones a usuarios que ya no existen).
const TABLES = [
  'comment_votes',
  'video_hashtags',
  'subscriptions',
  'comments',
  'videos',
  'hashtags',
  'users',
];

async function main() {
  if (!process.argv.includes(CONFIRM_FLAG)) {
    console.error(
      `Este comando BORRA todos los usuarios, videos y comentarios.\n` +
        `Si estás seguro, corrélo así:\n\n` +
        `  npm run db:reset -- ${CONFIRM_FLAG}\n`,
    );
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.error('Falta DATABASE_URL. Abortando sin tocar nada.');
    process.exit(1);
  }

  // Mostramos SIEMPRE a qué base apunta, sin la contraseña. Este comando se
  // corre pegando una connection string en la terminal, y equivocarse de
  // entorno es el error caro: conviene verlo escrito antes del borrado.
  const destino = new URL(process.env.DATABASE_URL);
  console.log(`\n  Servidor : ${destino.hostname}:${destino.port || 5432}`);
  console.log(`  Base     : ${destino.pathname.replace('/', '')}`);
  console.log(`  Usuario  : ${destino.username}\n`);

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl:
      process.env.DATABASE_SSL === 'true'
        ? { rejectUnauthorized: false }
        : undefined,
  });

  try {
    // Antes de borrar, mostramos qué se va a perder. Si el script se corrió
    // contra la base equivocada, este es el último momento para verlo.
    for (const table of TABLES) {
      try {
        const { rows } = await pool.query(
          `SELECT count(*)::int AS n FROM ${table}`,
        );
        console.log(`  ${table}: ${rows[0].n} filas`);
      } catch {
        console.log(`  ${table}: (no existe todavía)`);
      }
    }

    // CASCADE para que caigan también las FK entre ellas. El orden no importa
    // con CASCADE, pero las listamos de la más dependiente a la menos.
    await pool.query(`DROP TABLE IF EXISTS ${TABLES.join(', ')} CASCADE`);
    console.log('Tablas borradas.');

    const schemaPath = path.join(__dirname, '..', '..', 'schema.sql');
    await pool.query(fs.readFileSync(schemaPath, 'utf8'));
    console.log('Esquema nuevo aplicado (email + bcrypt).');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Error al resetear la base de datos:', err);
  process.exit(1);
});
