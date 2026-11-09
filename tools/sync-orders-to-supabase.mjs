import pkg from 'pg';
const { Client } = pkg;
import { pool } from '../db-postgres.mjs';

async function syncOrders() {
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

    // Map local user UUIDs to Supabase user IDs by DNI
    const localUsers = await localClient.query('SELECT id, dni FROM usuarios');
    const supaUsers = await pool.query('SELECT id, dni FROM usuarios');
    const supaUserMap = new Map();
    supaUsers.rows.forEach(u => supaUserMap.set(u.dni, u.id));
    const localIdToSupaId = new Map();
    localUsers.rows.forEach(lu => {
      const supaId = supaUserMap.get(lu.dni);
      if (supaId) localIdToSupaId.set(lu.id, supaId);
    });

    const localOrders = await localClient.query('SELECT * FROM pedidos ORDER BY created_at ASC');
    console.log(`Found ${localOrders.rows.length} local orders.`);

    for (const o of localOrders.rows) {
      const exists = await pool.query('SELECT id FROM pedidos WHERE numero_pedido = $1', [o.numero_pedido]);
      let supaOrderId;
      if (exists.rows.length === 0) {
        const supaUserId = localIdToSupaId.get(o.usuario_id) || 1;
        const res = await pool.query(`
          INSERT INTO pedidos (
            numero_pedido, usuario_id, subtotal_soles, costo_envio_soles, total_soles,
            estado, metodo_pago, direccion_envio, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING id, numero_pedido
        `, [
          o.numero_pedido,
          supaUserId,
          o.subtotal_soles,
          o.costo_envio_soles,
          o.total_soles,
          o.estado,
          o.metodo_pago,
          o.direccion_envio,
          o.created_at,
          o.updated_at
        ]);
        supaOrderId = res.rows[0].id;
        console.log(`Migrated order ${res.rows[0].numero_pedido} (Supabase ID: ${supaOrderId})`);
      } else {
        supaOrderId = exists.rows[0].id;
      }

      // Sync items for this order
      const localItems = await localClient.query('SELECT * FROM items_pedido WHERE pedido_id = $1', [o.id]);
      for (const item of localItems.rows) {
        const itemExists = await pool.query(
          'SELECT id FROM items_pedido WHERE pedido_id = $1 AND perfume_slug = $2',
          [supaOrderId, item.perfume_slug]
        );
        if (itemExists.rows.length === 0) {
          await pool.query(`
            INSERT INTO items_pedido (
              pedido_id, perfume_slug, nombre_producto, precio_unitario_soles, cantidad, imagen_url, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [
            supaOrderId,
            item.perfume_slug,
            item.nombre_producto,
            item.precio_unitario_soles,
            item.cantidad,
            item.imagen_url || '',
            item.created_at || new Date()
          ]);
        }
      }
    }

    console.log('Orders & items synchronized successfully!');
  } catch (err) {
    console.error('Orders sync error:', err);
  } finally {
    try { await localClient.end(); } catch {}
    try { await pool.end(); } catch {}
  }
}

syncOrders();
