import pkg from 'pg';
const { Client } = pkg;
import { pool } from '../db-postgres.mjs';

async function migrateData() {
  console.log('Connecting to local PostgreSQL...');
  const localClient = new Client({
    host: '127.0.0.1',
    port: 5432,
    user: 'postgres',
    password: 'Dyerman23',
    database: 'A2M'
  });

  try {
    await localClient.connect();
    console.log('Connected to local PostgreSQL.');

    const localUsers = await localClient.query('SELECT * FROM usuarios ORDER BY created_at ASC');
    console.log(`Found ${localUsers.rows.length} local users.`);

    for (const u of localUsers.rows) {
      const exists = await pool.query('SELECT id FROM usuarios WHERE dni = $1', [u.dni]);
      if (exists.rows.length === 0) {
        const res = await pool.query(`
          INSERT INTO usuarios (
            dni, password_hash, salt, nombres, telefono, ciudad, distrito, direccion, referencia, rol, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          RETURNING id, dni, rol
        `, [
          u.dni,
          u.password_hash,
          u.salt,
          u.nombres || '',
          u.telefono || '',
          u.ciudad || '',
          u.distrito || '',
          u.direccion || '',
          u.referencia || '',
          u.rol || 'CLIENTE',
          u.created_at || new Date(),
          u.updated_at || new Date()
        ]);
        console.log(`Migrated user DNI ${res.rows[0].dni} with role ${res.rows[0].rol} (ID: ${res.rows[0].id})`);
      } else {
        console.log(`User DNI ${u.dni} already exists in Supabase.`);
      }
    }

    console.log('All local users successfully synced to Supabase!');
  } catch (err) {
    console.error('Migration error:', err);
  } finally {
    try { await localClient.end(); } catch {}
    try { await pool.end(); } catch {}
  }
}

migrateData();
