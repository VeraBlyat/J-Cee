require('dotenv/config');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function main() {
  const schemaPath = path.join(__dirname, '..', '..', 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await pool.query(sql);
    console.log('Migraciones aplicadas correctamente.');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Error al migrar la base de datos:', err);
  process.exit(1);
});
