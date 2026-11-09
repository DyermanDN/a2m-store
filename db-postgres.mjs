import pkg from 'pg';
const { Pool } = pkg;
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env if present (without requiring external dotenv package)
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}
loadEnv();

const isRemoteDb = Boolean(
  (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost') && !process.env.DATABASE_URL.includes('127.0.0.1')) ||
  (process.env.PGHOST && process.env.PGHOST !== 'localhost' && process.env.PGHOST !== '127.0.0.1') ||
  process.env.NODE_ENV === 'production' ||
  process.env.VERCEL === '1'
);

const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      max: isRemoteDb ? 5 : 10,
      idleTimeoutMillis: 30000,
      ssl: isRemoteDb ? { rejectUnauthorized: false } : undefined
    }
  : {
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || 'postgres',
      host: process.env.PGHOST || 'localhost',
      port: parseInt(process.env.PGPORT || '5432', 10),
      database: process.env.PGDATABASE || 'postgres',
      max: 10,
      idleTimeoutMillis: 30000,
      ssl: isRemoteDb ? { rejectUnauthorized: false } : undefined
    };

export const pool = new Pool(poolConfig);

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

export async function testConnection() {
  const client = await pool.connect();
  try {
    const res = await client.query('SELECT current_database(), current_user, version()');
    return { ok: true, data: res.rows[0] };
  } finally {
    client.release();
  }
}

export async function initDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        dni VARCHAR(8) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        nombres TEXT DEFAULT '',
        telefono TEXT DEFAULT '',
        ciudad TEXT DEFAULT '',
        distrito TEXT DEFAULT '',
        direccion TEXT DEFAULT '',
        referencia TEXT DEFAULT '',
        rol VARCHAR(20) DEFAULT 'CLIENTE',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS sesiones (
        token TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS productos (
        id TEXT PRIMARY KEY,
        nombre TEXT NOT NULL,
        marca TEXT NOT NULL DEFAULT 'A2M Atelier',
        categoria VARCHAR(30) NOT NULL DEFAULT 'arabe',
        linea TEXT DEFAULT '',
        concentracion TEXT DEFAULT 'Eau de parfum',
        genero VARCHAR(20) DEFAULT 'unisex',
        familia VARCHAR(30) DEFAULT 'gourmand',
        precio_soles NUMERIC(10, 2) NOT NULL DEFAULT 0,
        tamanio_ml INTEGER DEFAULT 100,
        sizes JSONB DEFAULT '[]'::jsonb,
        stock INTEGER NOT NULL DEFAULT 15,
        agotado BOOLEAN NOT NULL DEFAULT false,
        imagen_url TEXT DEFAULT 'assets/catalog/khamrah.webp',
        badge TEXT DEFAULT '',
        descripcion TEXT DEFAULT '',
        notas JSONB DEFAULT '[]'::jsonb,
        activo BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS pedidos (
        id SERIAL PRIMARY KEY,
        numero_pedido VARCHAR(40) UNIQUE NOT NULL,
        usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
        subtotal_soles NUMERIC(10, 2) NOT NULL DEFAULT 0,
        costo_envio_soles NUMERIC(10, 2) NOT NULL DEFAULT 0,
        total_soles NUMERIC(10, 2) NOT NULL DEFAULT 0,
        estado VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE',
        metodo_pago VARCHAR(40) DEFAULT 'PENDIENTE',
        direccion_envio JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS items_pedido (
        id SERIAL PRIMARY KEY,
        pedido_id INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
        perfume_slug TEXT NOT NULL,
        nombre_producto TEXT NOT NULL,
        precio_unitario_soles NUMERIC(10, 2) NOT NULL DEFAULT 0,
        cantidad INTEGER NOT NULL DEFAULT 1,
        imagen_url TEXT DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS pagos_niubiz (
        id SERIAL PRIMARY KEY,
        pedido_id INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
        transaction_id VARCHAR(64) UNIQUE NOT NULL,
        transaction_token VARCHAR(64) NOT NULL,
        autorizacion_codigo VARCHAR(20) NOT NULL,
        monto NUMERIC(10, 2) NOT NULL DEFAULT 0,
        moneda VARCHAR(10) DEFAULT 'PEN',
        canal VARCHAR(30) DEFAULT 'NIUBIZ_TARJETA',
        estado_transaccion VARCHAR(30) DEFAULT 'AUTHORIZED',
        payload_respuesta JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_usuarios_dni ON usuarios(dni);
      CREATE INDEX IF NOT EXISTS idx_sesiones_token ON sesiones(token);
      CREATE INDEX IF NOT EXISTS idx_pedidos_usuario ON pedidos(usuario_id);
      CREATE INDEX IF NOT EXISTS idx_items_pedido ON items_pedido(pedido_id);
      CREATE INDEX IF NOT EXISTS idx_productos_categoria ON productos(categoria);
    `);

    // Si la tabla productos está vacía, poblarla automáticamente con el catálogo inicial
    const prodCount = await client.query('SELECT COUNT(*) FROM productos');
    if (parseInt(prodCount.rows[0].count, 10) === 0) {
      const candidates = [
        path.join(__dirname, 'catalog-data.js'),
        path.join(process.cwd(), 'catalog-data.js')
      ];
      const catalogDataPath = candidates.find(p => fs.existsSync(p));
      if (catalogDataPath) {
        const code = fs.readFileSync(catalogDataPath, 'utf8');
        const sandbox = { window: {} };
        vm.runInNewContext(code, sandbox);
        const initialProducts = sandbox.window.CATALOG_PRODUCTS || [];

        for (const p of initialProducts) {
          const defaultSize = Array.isArray(p.sizes) && p.sizes.length ? p.sizes[0] : { ml: 100, price: 60 };
          const isOos = Boolean(p.outOfStock);
          const stock = isOos ? 0 : 15;
          await client.query(`
            INSERT INTO productos (
              id, nombre, marca, categoria, linea, concentracion, genero, familia,
              precio_soles, tamanio_ml, sizes, stock, agotado, imagen_url, badge,
              descripcion, notas, activo
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, true)
            ON CONFLICT (id) DO NOTHING
          `, [
            p.id,
            p.name,
            p.brand,
            p.category,
            p.line || '',
            p.concentration || 'Eau de parfum',
            p.gender || 'unisex',
            p.family || 'gourmand',
            defaultSize.price,
            defaultSize.ml,
            JSON.stringify(p.sizes || [defaultSize]),
            stock,
            isOos,
            p.image || 'assets/catalog/khamrah.webp',
            p.badge || '',
            p.desc || '',
            JSON.stringify(p.notes || [])
          ]);
        }
      }
    }
  } finally {
    client.release();
  }
}

let dbReady = false;
let dbInitPromise = null;
export async function ensureDbReady() {
  if (dbReady) return;
  if (isRemoteDb) {
    dbReady = true;
    return;
  }
  if (!dbInitPromise) {
    dbInitPromise = initDatabase().then(() => {
      dbReady = true;
    }).catch(err => {
      dbInitPromise = null;
      console.warn('PostgreSQL initialization warning:', err.message);
    });
  }
  return dbInitPromise;
}

export async function registerUser(dni, password) {
  const cleanDni = String(dni || '').trim();
  if (!/^\d{8}$/.test(cleanDni)) {
    throw new Error('El DNI debe contener exactamente 8 dígitos numéricos.');
  }
  if (!password || String(password).length < 6) {
    throw new Error('La contraseña debe tener al menos 6 caracteres.');
  }

  // Check if DNI already registered
  const existing = await pool.query('SELECT id FROM usuarios WHERE dni = $1', [cleanDni]);
  if (existing.rows.length > 0) {
    throw new Error('Este DNI ya se encuentra registrado en A2M.');
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = hashPassword(password, salt);

  const insert = await pool.query(`
    INSERT INTO usuarios (dni, password_hash, salt)
    VALUES ($1, $2, $3)
    RETURNING id, dni, ciudad, distrito, direccion, referencia
  `, [cleanDni, passwordHash, salt]);

  return insert.rows[0];
}

export async function loginUser(dni, password) {
  const cleanDni = String(dni || '').trim();
  if (!cleanDni || !password) {
    throw new Error('Ingresa tu DNI y contraseña.');
  }

  const res = await pool.query('SELECT * FROM usuarios WHERE dni = $1', [cleanDni]);
  if (res.rows.length === 0) {
    throw new Error('DNI o contraseña incorrectos.');
  }

  const user = res.rows[0];
  const testHash = hashPassword(password, user.salt);
  const storedBuf = Buffer.from(user.password_hash, 'hex');
  const testBuf = Buffer.from(testHash, 'hex');

  if (storedBuf.length !== testBuf.length || !crypto.timingSafeEqual(storedBuf, testBuf)) {
    throw new Error('DNI o contraseña incorrectos.');
  }

  return {
    id: user.id,
    dni: user.dni,
    ciudad: user.ciudad || '',
    distrito: user.distrito || '',
    direccion: user.direccion || '',
    referencia: user.referencia || '',
    nombres: user.nombres || '',
    telefono: user.telefono || '',
    rol: user.rol || 'CLIENTE'
  };
}

export async function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  await pool.query(`
    INSERT INTO sesiones (token, user_id, expires_at)
    VALUES ($1, $2, $3)
  `, [token, userId, expiresAt]);

  return { token, expiresAt };
}

export async function getUserByToken(token) {
  if (!token) return null;

  const res = await pool.query(`
    SELECT s.token, s.expires_at, u.id, u.dni, u.ciudad, u.distrito, u.direccion, u.referencia, u.nombres, u.telefono, u.rol
    FROM sesiones s
    JOIN usuarios u ON u.id = s.user_id
    WHERE s.token = $1
  `, [token]);

  if (res.rows.length === 0) return null;

  const session = res.rows[0];
  if (new Date(session.expires_at) < new Date()) {
    await deleteSession(token);
    return null;
  }

  return {
    id: session.id,
    dni: session.dni,
    ciudad: session.ciudad || '',
    distrito: session.distrito || '',
    direccion: session.direccion || '',
    referencia: session.referencia || '',
    nombres: session.nombres || '',
    telefono: session.telefono || '',
    rol: session.rol || 'CLIENTE'
  };
}

export async function deleteSession(token) {
  if (!token) return;
  await pool.query('DELETE FROM sesiones WHERE token = $1', [token]);
}

export async function updateUserProfile(userId, { ciudad, distrito, direccion, referencia, nombres, telefono }) {
  const res = await pool.query(`
    UPDATE usuarios
    SET ciudad = COALESCE($1, ciudad),
        distrito = COALESCE($2, distrito),
        direccion = COALESCE($3, direccion),
        referencia = COALESCE($4, referencia),
        nombres = COALESCE($5, nombres),
        telefono = COALESCE($6, telefono),
        updated_at = NOW()
    WHERE id = $7
    RETURNING id, dni, ciudad, distrito, direccion, referencia, nombres, telefono
  `, [
    ciudad !== undefined ? String(ciudad).trim() : null,
    distrito !== undefined ? String(distrito).trim() : null,
    direccion !== undefined ? String(direccion).trim() : null,
    referencia !== undefined ? String(referencia).trim() : null,
    nombres !== undefined ? String(nombres).trim() : null,
    telefono !== undefined ? String(telefono).trim() : null,
    userId
  ]);

  return res.rows[0];
}

export async function createOrder({ userId, items, costoEnvio = 0, metodoPago = 'PENDIENTE' }) {
  if (!items || !items.length) {
    throw new Error('La bolsa de compras no contiene artículos.');
  }

  // Fetch current user and delivery address
  const uRes = await pool.query('SELECT * FROM usuarios WHERE id = $1', [userId]);
  if (uRes.rows.length === 0) {
    throw new Error('Usuario no encontrado.');
  }
  const user = uRes.rows[0];

  if (!user.direccion || !user.ciudad) {
    throw new Error('Debes registrar tu dirección de entrega en tu perfil antes de continuar.');
  }

  const direccionEnvio = {
    dni: user.dni,
    nombres: user.nombres || '',
    telefono: user.telefono || '',
    ciudad: user.ciudad,
    distrito: user.distrito,
    direccion: user.direccion,
    referencia: user.referencia
  };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Validar stock y precios reales desde PostgreSQL antes de crear el pedido
    const verifiedItems = [];
    let subtotal = 0;

    for (const it of items) {
      const slug = String(it.id || it.slug || 'fragancia').trim();
      const qty = Math.max(1, parseInt(it.qty || it.cantidad || 1, 10));
      const requestedMl = parseInt(it.ml || 0, 10);

      const prodRes = await client.query(
        'SELECT id, nombre, precio_soles, sizes, stock, agotado, imagen_url FROM productos WHERE id = $1 FOR UPDATE',
        [slug]
      );

      let unitPrice = parseFloat(it.price || it.precio || 0);
      let prodName = it.name || it.nombre || 'Fragancia A2M';
      let prodImg = it.image || it.imagen || '';

      if (prodRes.rows.length > 0) {
        const dbProd = prodRes.rows[0];
        if (dbProd.agotado || dbProd.stock < qty) {
          throw new Error(
            dbProd.stock <= 0
              ? `La fragancia "${dbProd.nombre}" se encuentra agotada.`
              : `Stock insuficiente para "${dbProd.nombre}" (disponibles: ${dbProd.stock} uds).`
          );
        }

        prodName = dbProd.nombre || prodName;
        prodImg = dbProd.imagen_url || prodImg;
        unitPrice = parseFloat(dbProd.precio_soles) || unitPrice;

        if (Array.isArray(dbProd.sizes) && dbProd.sizes.length > 0 && requestedMl > 0) {
          const matchedSize = dbProd.sizes.find(s => parseInt(s.ml, 10) === requestedMl);
          if (matchedSize && !isNaN(parseFloat(matchedSize.price))) {
            unitPrice = parseFloat(matchedSize.price);
          }
        }
      }

      subtotal += unitPrice * qty;
      verifiedItems.push({ slug, name: prodName, price: unitPrice, qty, img: prodImg });
    }

    const envioSoles = subtotal >= 150 ? 0 : parseFloat(costoEnvio || 0);
    const total = subtotal + envioSoles;

    // Generar número de pedido único evitando colisiones si se borraron filas previas
    const seqRes = await client.query('SELECT COALESCE(MAX(id), 0) + 1 AS next_seq FROM pedidos');
    const orderSeq = String(seqRes.rows[0].next_seq).padStart(4, '0');
    const numeroPedido = `A2M-2026-${orderSeq}`;

    const orderRes = await client.query(`
      INSERT INTO pedidos (
        numero_pedido, usuario_id, subtotal_soles, costo_envio_soles, total_soles, estado, metodo_pago, direccion_envio
      )
      VALUES ($1, $2, $3, $4, $5, 'PENDIENTE', $6, $7)
      RETURNING *
    `, [numeroPedido, userId, subtotal, envioSoles, total, metodoPago, JSON.stringify(direccionEnvio)]);

    const pedido = orderRes.rows[0];
    const insertedItems = [];

    for (const vIt of verifiedItems) {
      const itRes = await client.query(`
        INSERT INTO items_pedido (pedido_id, perfume_slug, nombre_producto, precio_unitario_soles, cantidad, imagen_url)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [pedido.id, vIt.slug, vIt.name, vIt.price, vIt.qty, vIt.img]);

      // Descontar stock automáticamente del inventario
      await client.query(`
        UPDATE productos
        SET stock = GREATEST(0, stock - $1),
            agotado = CASE WHEN GREATEST(0, stock - $1) = 0 THEN true ELSE agotado END,
            updated_at = NOW()
        WHERE id = $2
      `, [vIt.qty, vIt.slug]);

      insertedItems.push(itRes.rows[0]);
    }

    await client.query('COMMIT');

    return {
      ...pedido,
      items: insertedItems
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function processOrderPayment({ userId, pedidoId, canal = 'NIUBIZ_TARJETA', datosPago = {} }) {
  if (!pedidoId) {
    throw new Error('Identificador de pedido requerido.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const pedRes = await client.query(
      'SELECT * FROM pedidos WHERE (id::text = $1 OR numero_pedido = $1) AND usuario_id = $2 FOR UPDATE',
      [String(pedidoId), userId]
    );

    if (pedRes.rows.length === 0) {
      throw new Error('No se encontró el pedido para procesar el pago.');
    }

    const pedido = pedRes.rows[0];
    if (pedido.estado === 'PAGADO') {
      throw new Error('Este pedido ya fue pagado anteriormente.');
    }

    const canalClean = String(canal).toUpperCase().includes('YAPE') ? 'YAPE' : 'NIUBIZ_TARJETA';
    const txId = `NBZ-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
    const txToken = crypto.randomBytes(16).toString('hex');
    const authCode = Math.floor(100000 + Math.random() * 900000).toString();

    const safePayload = {
      canal: canalClean,
      ultimos4: datosPago.ultimos4 || null,
      marca_tarjeta: datosPago.marca || null,
      celular_yape: datosPago.celular ? String(datosPago.celular).replace(/\d(?=\d{3})/g, '*') : null,
      fecha_proceso: new Date().toISOString()
    };

    const pagoRes = await client.query(`
      INSERT INTO pagos_niubiz (
        pedido_id, transaction_id, transaction_token, autorizacion_codigo,
        monto, moneda, canal, estado_transaccion, payload_respuesta
      )
      VALUES ($1, $2, $3, $4, $5, 'PEN', $6, 'AUTHORIZED', $7)
      RETURNING *
    `, [pedido.id, txId, txToken, authCode, pedido.total_soles, canalClean, JSON.stringify(safePayload)]);

    const updPedido = await client.query(`
      UPDATE pedidos
      SET estado = 'PAGADO',
          metodo_pago = $1,
          updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `, [canalClean, pedido.id]);

    const itemsRes = await client.query('SELECT * FROM items_pedido WHERE pedido_id = $1', [pedido.id]);

    await client.query('COMMIT');

    return {
      pedido: {
        ...updPedido.rows[0],
        items: itemsRes.rows
      },
      pago: pagoRes.rows[0]
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getUserOrders(userId) {
  const res = await pool.query(`
    SELECT p.*,
      COALESCE(
        json_agg(
          json_build_object(
            'id', i.id,
            'perfume_slug', i.perfume_slug,
            'nombre_producto', i.nombre_producto,
            'precio_unitario_soles', i.precio_unitario_soles,
            'cantidad', i.cantidad,
            'imagen_url', i.imagen_url
          )
        ) FILTER (WHERE i.id IS NOT NULL), '[]'
      ) as items
    FROM pedidos p
    LEFT JOIN items_pedido i ON i.pedido_id = p.id
    WHERE p.usuario_id = $1
    GROUP BY p.id
    ORDER BY p.created_at DESC
  `, [userId]);

  return res.rows;
}

// ==========================================
// ADMINISTRADOR: GESTIÓN DE PRODUCTOS & STOCK
// ==========================================

export async function getAllProductsAdmin() {
  const res = await pool.query(`
    SELECT * FROM productos
    ORDER BY categoria ASC, nombre ASC
  `);
  return res.rows;
}

export async function getActiveProductsPublic() {
  const res = await pool.query(`
    SELECT * FROM productos
    WHERE activo = true
    ORDER BY categoria ASC, nombre ASC
  `);
  return res.rows;
}

export async function createProduct(prod) {
  const cleanName = String(prod.nombre || '').trim();
  if (!cleanName) throw new Error('El nombre de la fragancia es obligatorio.');

  const cleanBrand = String(prod.marca || 'A2M Atelier').trim();
  const cleanCat = String(prod.categoria || 'arabe').trim().toLowerCase();
  const cleanLine = String(prod.linea || '').trim();
  const precio = parseFloat(prod.precio_soles || prod.precio || 0);
  if (isNaN(precio) || precio <= 0) throw new Error('Ingresa un precio válido en Soles (S/.).');

  const stock = parseInt(prod.stock !== undefined ? prod.stock : 15, 10);
  const isAgotado = Boolean(prod.agotado || stock <= 0);

  // Generate unique slug id
  let baseSlug = prod.id || cleanName.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  if (!baseSlug) baseSlug = `perfume-${Date.now()}`;

  // Ensure unique ID
  const existRes = await pool.query('SELECT id FROM productos WHERE id = $1', [baseSlug]);
  let finalId = baseSlug;
  if (existRes.rows.length > 0) {
    finalId = `${baseSlug}-${Date.now().toString().slice(-4)}`;
  }

  const imageUrl = prod.imagen_url || 'assets/catalog/khamrah.webp';
  const sizes = Array.isArray(prod.sizes) && prod.sizes.length ? prod.sizes : [{ ml: prod.tamanio_ml || 100, price: precio }];
  const notas = Array.isArray(prod.notas) ? prod.notas : (prod.notas ? String(prod.notas).split(',').map(s => s.trim()) : []);

  const res = await pool.query(`
    INSERT INTO productos (
      id, nombre, marca, categoria, linea, concentracion, genero, familia,
      precio_soles, tamanio_ml, sizes, stock, agotado, imagen_url, badge,
      descripcion, notas, activo
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, true)
    RETURNING *
  `, [
    finalId,
    cleanName,
    cleanBrand,
    cleanCat,
    cleanLine,
    prod.concentracion || 'Eau de parfum',
    prod.genero || 'unisex',
    prod.familia || 'gourmand',
    precio,
    prod.tamanio_ml || 100,
    JSON.stringify(sizes),
    stock,
    isAgotado,
    imageUrl,
    prod.badge || '',
    prod.descripcion || '',
    JSON.stringify(notas)
  ]);

  return res.rows[0];
}

export async function updateProduct(id, fields) {
  const u = fields;
  const precio = u.precio_soles !== undefined ? parseFloat(u.precio_soles) : (u.precio !== undefined ? parseFloat(u.precio) : undefined);
  const stock = u.stock !== undefined ? parseInt(u.stock, 10) : undefined;
  const agotado = u.agotado !== undefined ? Boolean(u.agotado) : (stock !== undefined ? stock <= 0 : undefined);
  const notasArr = u.notas !== undefined
    ? (Array.isArray(u.notas) ? u.notas : String(u.notas).split(',').map(s => s.trim()).filter(Boolean))
    : null;

  const res = await pool.query(`
    UPDATE productos
    SET nombre = COALESCE($1, nombre),
        marca = COALESCE($2, marca),
        categoria = COALESCE($3, categoria),
        linea = COALESCE($4, linea),
        precio_soles = COALESCE($5, precio_soles),
        sizes = CASE
          WHEN $5::numeric IS NOT NULL AND jsonb_typeof(sizes) = 'array' AND jsonb_array_length(sizes) > 0
          THEN jsonb_set(sizes, '{0,price}', to_jsonb($5::numeric), false)
          WHEN $5::numeric IS NOT NULL
          THEN jsonb_build_array(jsonb_build_object('ml', COALESCE(tamanio_ml, 100), 'price', $5::numeric))
          ELSE sizes
        END,
        stock = COALESCE($6, stock),
        agotado = COALESCE($7, agotado),
        descripcion = COALESCE($8, descripcion),
        imagen_url = COALESCE($9, imagen_url),
        badge = COALESCE($10, badge),
        concentracion = COALESCE($11, concentracion),
        familia = COALESCE($12, familia),
        notas = COALESCE($13::jsonb, notas),
        updated_at = NOW()
    WHERE id = $14
    RETURNING *
  `, [
    u.nombre !== undefined ? String(u.nombre).trim() : null,
    u.marca !== undefined ? String(u.marca).trim() : null,
    u.categoria !== undefined ? String(u.categoria).trim().toLowerCase() : null,
    u.linea !== undefined ? String(u.linea).trim() : null,
    !isNaN(precio) ? precio : null,
    !isNaN(stock) ? stock : null,
    agotado !== undefined ? agotado : null,
    u.descripcion !== undefined ? String(u.descripcion).trim() : null,
    u.imagen_url !== undefined ? String(u.imagen_url).trim() : null,
    u.badge !== undefined ? String(u.badge).trim() : null,
    u.concentracion !== undefined ? String(u.concentracion).trim() : null,
    u.familia !== undefined ? String(u.familia).trim().toLowerCase() : null,
    notasArr !== null ? JSON.stringify(notasArr) : null,
    id
  ]);

  if (res.rows.length === 0) throw new Error('Producto no encontrado.');
  return res.rows[0];
}

export async function quickUpdateStock(id, newStock) {
  const stock = Math.max(0, parseInt(newStock, 10));
  const isAgotado = (stock === 0);

  const res = await pool.query(`
    UPDATE productos
    SET stock = $1,
        agotado = $2,
        updated_at = NOW()
    WHERE id = $3
    RETURNING *
  `, [stock, isAgotado, id]);

  if (res.rows.length === 0) throw new Error('Producto no encontrado.');
  return res.rows[0];
}

export async function quickUpdatePrice(id, newPrice) {
  const precio = parseFloat(newPrice);
  if (isNaN(precio) || precio <= 0) throw new Error('Precio inválido.');

  const res = await pool.query(`
    UPDATE productos
    SET precio_soles = $1,
        sizes = CASE
          WHEN jsonb_typeof(sizes) = 'array' AND jsonb_array_length(sizes) > 0
          THEN jsonb_set(sizes, '{0,price}', to_jsonb($1::numeric), false)
          ELSE jsonb_build_array(jsonb_build_object('ml', COALESCE(tamanio_ml, 100), 'price', $1::numeric))
        END,
        updated_at = NOW()
    WHERE id = $2
    RETURNING *
  `, [precio, id]);

  if (res.rows.length === 0) throw new Error('Producto no encontrado.');
  return res.rows[0];
}

export async function toggleProductOutOfStock(id) {
  const res = await pool.query(`
    UPDATE productos
    SET agotado = NOT agotado,
        updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `, [id]);

  if (res.rows.length === 0) throw new Error('Producto no encontrado.');
  return res.rows[0];
}

export async function deleteProduct(id) {
  const res = await pool.query('DELETE FROM productos WHERE id = $1 RETURNING id, nombre', [id]);
  if (res.rows.length === 0) throw new Error('Producto no encontrado.');
  return res.rows[0];
}

export async function getAdminStats() {
  const prods = await pool.query(`
    SELECT 
      COUNT(*) as total_productos,
      COALESCE(SUM(stock), 0) as total_stock,
      COUNT(*) FILTER (WHERE agotado = true OR stock = 0) as total_agotados
    FROM productos
    WHERE activo = true
  `);

  const orders = await pool.query(`
    SELECT 
      COUNT(*) as total_pedidos,
      COALESCE(SUM(total_soles), 0) as total_ventas
    FROM pedidos
  `);

  return {
    totalProductos: parseInt(prods.rows[0].total_productos, 10),
    totalStock: parseInt(prods.rows[0].total_stock, 10),
    totalAgotados: parseInt(prods.rows[0].total_agotados, 10),
    totalPedidos: parseInt(orders.rows[0].total_pedidos, 10),
    totalVentas: parseFloat(orders.rows[0].total_ventas)
  };
}

export async function getAllOrdersAdmin() {
  const res = await pool.query(`
    SELECT p.*,
      COALESCE(u.dni, 'Sin DNI') as cliente_dni,
      (
        SELECT json_build_object(
          'transaction_id', pn.transaction_id,
          'autorizacion_codigo', pn.autorizacion_codigo,
          'canal', pn.canal
        )
        FROM pagos_niubiz pn
        WHERE pn.pedido_id = p.id
        ORDER BY pn.created_at DESC
        LIMIT 1
      ) as pago_info,
      COALESCE(
        json_agg(
          json_build_object(
            'id', i.id,
            'perfume_slug', i.perfume_slug,
            'nombre_producto', i.nombre_producto,
            'precio_unitario_soles', i.precio_unitario_soles,
            'cantidad', i.cantidad,
            'imagen_url', i.imagen_url
          )
        ) FILTER (WHERE i.id IS NOT NULL), '[]'
      ) as items
    FROM pedidos p
    LEFT JOIN usuarios u ON u.id = p.usuario_id
    LEFT JOIN items_pedido i ON i.pedido_id = p.id
    GROUP BY p.id, u.dni
    ORDER BY p.created_at DESC
  `);

  return res.rows;
}

export async function updateOrderStatus(orderId, nuevoEstado) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const curRes = await client.query('SELECT * FROM pedidos WHERE id = $1 FOR UPDATE', [orderId]);
    if (curRes.rows.length === 0) {
      throw new Error('Pedido no encontrado.');
    }

    const prevEstado = curRes.rows[0].estado;

    // Si el pedido pasa a CANCELADO desde otro estado, reponer el stock automáticamente
    if (prevEstado !== 'CANCELADO' && nuevoEstado === 'CANCELADO') {
      await client.query(`
        UPDATE productos p
        SET stock = p.stock + i.cantidad,
            agotado = CASE WHEN (p.stock + i.cantidad) > 0 THEN false ELSE p.agotado END,
            updated_at = NOW()
        FROM items_pedido i
        WHERE i.pedido_id = $1 AND p.id = i.perfume_slug
      `, [orderId]);
    } else if (prevEstado === 'CANCELADO' && nuevoEstado !== 'CANCELADO') {
      // Si se reactiva un pedido cancelado, volver a descontar el stock
      await client.query(`
        UPDATE productos p
        SET stock = GREATEST(0, p.stock - i.cantidad),
            agotado = CASE WHEN GREATEST(0, p.stock - i.cantidad) = 0 THEN true ELSE p.agotado END,
            updated_at = NOW()
        FROM items_pedido i
        WHERE i.pedido_id = $1 AND p.id = i.perfume_slug
      `, [orderId]);
    }

    const res = await client.query(`
      UPDATE pedidos
      SET estado = $1,
          updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `, [nuevoEstado, orderId]);

    await client.query('COMMIT');
    return res.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}


