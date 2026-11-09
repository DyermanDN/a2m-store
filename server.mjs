import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  initDatabase,
  ensureDbReady,
  registerUser,
  loginUser,
  createSession,
  getUserByToken,
  deleteSession,
  updateUserProfile,
  createOrder,
  processOrderPayment,
  getUserOrders,
  getAllProductsAdmin,
  getActiveProductsPublic,
  createProduct,
  updateProduct,
  quickUpdateStock,
  quickUpdatePrice,
  toggleProductOutOfStock,
  deleteProduct,
  getAdminStats,
  getAllOrdersAdmin,
  updateOrderStatus
} from './db-postgres.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '3456', 10);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8'
};

function parseCookies(req) {
  const list = {};
  const rc = req.headers.cookie;
  if (rc) {
    rc.split(';').forEach(cookie => {
      const parts = cookie.split('=');
      list[parts.shift().trim()] = decodeURI(parts.join('='));
    });
  }
  return list;
}

function getAuthToken(req) {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  const cookies = parseCookies(req);
  return cookies.session_token || null;
}

function getCookieHeader(req, token) {
  const isSecure = req.headers['x-forwarded-proto'] === 'https' || process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
  return `session_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}${isSecure ? '; Secure' : ''}`;
}

function getClearCookieHeader(req) {
  const isSecure = req.headers['x-forwarded-proto'] === 'https' || process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
  return `session_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${isSecure ? '; Secure' : ''}`;
}

function sendJson(res, statusCode, data, extraHeaders = {}) {
  const json = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(json),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    ...extraHeaders
  });
  res.end(json);
}

function parseJsonBody(req) {
  if (req.body && typeof req.body === 'object') {
    return Promise.resolve(req.body);
  }
  if (typeof req.body === 'string' && req.body.trim()) {
    try {
      return Promise.resolve(JSON.parse(req.body));
    } catch {
      return Promise.resolve({});
    }
  }
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1e6) { // 1MB limit
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body.trim()) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Formato JSON inválido'));
      }
    });
    req.on('error', reject);
  });
}

export async function handleApiRequest(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    res.end();
    return;
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(req.url || '/', 'http://localhost');
  } catch {
    res.writeHead(400); res.end('Bad request'); return;
  }

  // Support Vercel rewrite params (?__api_path=...), headers, or standard pathname
  let rawPath = parsedUrl.searchParams.get('__api_path') ||
                req.headers['x-matched-path'] ||
                req.headers['x-forwarded-url'] ||
                parsedUrl.pathname;

  let pathname = decodeURIComponent(rawPath.split('?')[0]);
  if (!pathname.startsWith('/')) pathname = '/' + pathname;
  if (!pathname.startsWith('/api')) {
    pathname = '/api' + pathname;
  }

  try {
    await ensureDbReady();
  } catch (dbErr) {
    console.warn('Database initialization warning:', dbErr.message);
  }

  try {
    // 1. REGISTRO (DNI + Contraseña)
    if (pathname === '/api/auth/register' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const { dni, password } = body;
      const user = await registerUser(dni, password);
      const { token } = await createSession(user.id);

      const cookieHeader = getCookieHeader(req, token);
      return sendJson(res, 201, {
        ok: true,
        message: 'Registro exitoso en A2M',
        user,
        token
      }, { 'Set-Cookie': cookieHeader });
    }

    // 2. LOGIN (DNI + Contraseña)
    if (pathname === '/api/auth/login' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const { dni, password } = body;
      const user = await loginUser(dni, password);
      const { token } = await createSession(user.id);

      const cookieHeader = getCookieHeader(req, token);
      return sendJson(res, 200, {
        ok: true,
        message: 'Bienvenido a A2M',
        user,
        token
      }, { 'Set-Cookie': cookieHeader });
    }

    // 3. OBTENER PERFIL ACTUAL (ME)
    if (pathname === '/api/auth/me' && req.method === 'GET') {
      const token = getAuthToken(req);
      const user = await getUserByToken(token);
      if (!user) {
        return sendJson(res, 401, { ok: false, error: 'No autenticado' });
      }
      return sendJson(res, 200, { ok: true, user });
    }

    // 4. LOGOUT (Cerrar Sesión)
    if (pathname === '/api/auth/logout' && req.method === 'POST') {
      const token = getAuthToken(req);
      if (token) await deleteSession(token);
      const clearCookie = getClearCookieHeader(req);
      return sendJson(res, 200, { ok: true, message: 'Sesión cerrada' }, { 'Set-Cookie': clearCookie });
    }

      // 5. ACTUALIZAR PERFIL / LUGAR DE ENVÍO (ciudad, distrito, direccion, referencia)
      if (pathname === '/api/user/profile' && (req.method === 'PUT' || req.method === 'POST')) {
        const token = getAuthToken(req);
        const currentUser = await getUserByToken(token);
        if (!currentUser) {
          return sendJson(res, 401, { ok: false, error: 'No autorizado. Inicia sesión.' });
        }

        const body = await parseJsonBody(req);
        const updated = await updateUserProfile(currentUser.id, {
          ciudad: body.ciudad,
          distrito: body.distrito,
          direccion: body.direccion,
          referencia: body.referencia,
          nombres: body.nombres,
          telefono: body.telefono
        });

        return sendJson(res, 200, {
          ok: true,
          message: 'Datos de envío guardados correctamente',
          user: updated
        });
      }

      // 6. CREAR PEDIDO (Guardar compra en PostgreSQL)
      if (pathname === '/api/pedidos/crear' && req.method === 'POST') {
        const token = getAuthToken(req);
        const currentUser = await getUserByToken(token);
        if (!currentUser) {
          return sendJson(res, 401, {
            ok: false,
            error: 'Debes iniciar sesión con tu DNI para procesar tu pedido.',
            code: 'AUTH_REQUIRED'
          });
        }

        const body = await parseJsonBody(req);
        if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
          return sendJson(res, 400, { ok: false, error: 'La bolsa de compras está vacía.' });
        }

        const pedido = await createOrder({
          userId: currentUser.id,
          items: body.items,
          costoEnvio: body.costoEnvio || 0,
          metodoPago: body.metodoPago || 'PENDIENTE'
        });

        return sendJson(res, 201, {
          ok: true,
          message: '¡Pedido registrado con éxito en A2M!',
          pedido
        });
      }

      // 7. LISTAR MIS PEDIDOS
      if (pathname === '/api/pedidos/mis-pedidos' && req.method === 'GET') {
        const token = getAuthToken(req);
        const currentUser = await getUserByToken(token);
        if (!currentUser) {
          return sendJson(res, 401, { ok: false, error: 'No autorizado' });
        }

        const pedidos = await getUserOrders(currentUser.id);
        return sendJson(res, 200, { ok: true, pedidos });
      }

      // 7.5. PROCESAR PAGO DE PEDIDO (Niubiz Tarjeta / Yape)
      if (pathname === '/api/pagos/procesar' && req.method === 'POST') {
        const token = getAuthToken(req);
        const currentUser = await getUserByToken(token);
        if (!currentUser) {
          return sendJson(res, 401, { ok: false, error: 'Inicia sesión para completar el pago.' });
        }

        const body = await parseJsonBody(req);
        const resultado = await processOrderPayment({
          userId: currentUser.id,
          pedidoId: body.pedidoId,
          canal: body.canal || 'NIUBIZ_TARJETA',
          datosPago: body.datosPago || {}
        });

        return sendJson(res, 200, {
          ok: true,
          message: 'Pago aprobado correctamente',
          ...resultado
        });
      }

      // 8. CATÁLOGO PÚBLICO EN TIEMPO REAL (PostgreSQL)
      if (pathname === '/api/productos' && req.method === 'GET') {
        const prods = await getActiveProductsPublic();
        return sendJson(res, 200, { ok: true, productos: prods });
      }

      // ==========================================
      // RUTAS ADMINISTRADOR (Requieren rol = 'ADMIN')
      // ==========================================
      if (pathname.startsWith('/api/admin/')) {
        const token = getAuthToken(req);
        const currentUser = await getUserByToken(token);
        if (!currentUser || currentUser.rol !== 'ADMIN') {
          return sendJson(res, 403, {
            ok: false,
            error: 'Acceso restringido. Solo administradores autorizados de A2M.'
          });
        }

        // Estadísticas generales
        if (pathname === '/api/admin/stats' && req.method === 'GET') {
          const stats = await getAdminStats();
          return sendJson(res, 200, { ok: true, stats });
        }

        // Listar todos los productos
        if (pathname === '/api/admin/productos' && req.method === 'GET') {
          const productos = await getAllProductsAdmin();
          return sendJson(res, 200, { ok: true, productos });
        }

        // Crear nuevo producto
        if (pathname === '/api/admin/productos' && req.method === 'POST') {
          const body = await parseJsonBody(req);
          const nuevo = await createProduct(body);
          return sendJson(res, 201, { ok: true, message: 'Fragancia agregada con éxito', producto: nuevo });
        }

        // Acciones sobre un producto específico por ID (/api/admin/productos/:id/...)
        const prodMatch = pathname.match(/^\/api\/admin\/productos\/([^/]+)(?:\/(stock|precio|toggle-agotado))?$/);
        if (prodMatch) {
          const prodId = decodeURIComponent(prodMatch[1]);
          const action = prodMatch[2];

          // Actualizar stock rápido (+ / - / valor exacto)
          if (action === 'stock' && (req.method === 'PATCH' || req.method === 'POST')) {
            const body = await parseJsonBody(req);
            const updated = await quickUpdateStock(prodId, body.stock);
            return sendJson(res, 200, { ok: true, message: 'Stock actualizado', producto: updated });
          }

          // Actualizar precio rápido
          if (action === 'precio' && (req.method === 'PATCH' || req.method === 'POST')) {
            const body = await parseJsonBody(req);
            const updated = await quickUpdatePrice(prodId, body.precio);
            return sendJson(res, 200, { ok: true, message: 'Precio actualizado', producto: updated });
          }

          // Alternar disponibilidad (Agotado / Disponible)
          if (action === 'toggle-agotado' && (req.method === 'PATCH' || req.method === 'POST')) {
            const updated = await toggleProductOutOfStock(prodId);
            return sendJson(res, 200, { ok: true, message: 'Disponibilidad actualizada', producto: updated });
          }

          // Actualizar campos completos del producto
          if (!action && (req.method === 'PUT' || req.method === 'POST')) {
            const body = await parseJsonBody(req);
            const updated = await updateProduct(prodId, body);
            return sendJson(res, 200, { ok: true, message: 'Fragancia actualizada correctamente', producto: updated });
          }

          // Eliminar producto
          if (!action && req.method === 'DELETE') {
            await deleteProduct(prodId);
            return sendJson(res, 200, { ok: true, message: 'Fragancia eliminada' });
          }
        }

        // Listar todos los pedidos de clientes para el admin
        if (pathname === '/api/admin/pedidos' && req.method === 'GET') {
          const pedidos = await getAllOrdersAdmin();
          return sendJson(res, 200, { ok: true, pedidos });
        }

        // Actualizar estado de pedido
        const orderMatch = pathname.match(/^\/api\/admin\/pedidos\/([^/]+)\/estado$/);
        if (orderMatch && (req.method === 'PUT' || req.method === 'POST')) {
          const orderId = decodeURIComponent(orderMatch[1]);
          const body = await parseJsonBody(req);
          const updated = await updateOrderStatus(orderId, body.estado);
          return sendJson(res, 200, { ok: true, message: 'Estado de pedido actualizado', pedido: updated });
        }

        return sendJson(res, 404, { ok: false, error: 'Acción de administrador no encontrada' });
      }

      // 404 API Endpoint
      return sendJson(res, 404, { ok: false, error: 'Ruta API no encontrada' });

    } catch (apiErr) {
      const statusCode = apiErr.message && (
        apiErr.message.includes('DNI') ||
        apiErr.message.includes('contraseña') ||
        apiErr.message.includes('registrado') ||
        apiErr.message.includes('incorrectos') ||
        apiErr.message.includes('Stock') ||
        apiErr.message.includes('agotada') ||
        apiErr.message.includes('dirección')
      ) ? 400 : 500;
      return sendJson(res, statusCode, { ok: false, error: apiErr.message || 'Error interno' });
    }
}

export async function handleAppRequest(req, res) {
  let parsedUrl;
  try {
    parsedUrl = new URL(req.url || '/', 'http://localhost');
  } catch {
    res.writeHead(400); res.end('Bad request'); return;
  }

  const pathname = decodeURIComponent(parsedUrl.pathname);

  if (pathname.startsWith('/api/')) {
    return handleApiRequest(req, res);
  }

  // ==========================================
  // STATIC FILE SERVING
  // ==========================================
  const relPath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  let filePath = path.resolve(__dirname, relPath);
  if (!filePath.startsWith(__dirname + path.sep)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  fs.stat(filePath, (err, stat) => {
    if (!err && stat.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
      return fs.stat(filePath, (err2, stat2) => {
        if (err2 || !stat2.isFile()) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Not found');
          return;
        }
        serveFile(filePath, stat2);
      });
    }

    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    serveFile(filePath, stat);
  });

  function serveFile(targetPath, fileStat) {
    const ext = path.extname(targetPath).toLowerCase();
    const etag = `W/"${fileStat.size}-${fileStat.mtimeMs}"`;
    const isMediaAsset = ['.webp', '.png', '.jpg', '.woff2', '.svg'].includes(ext);
    const headers = {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': isMediaAsset ? 'public, max-age=3600' : 'no-cache',
      'ETag': etag
    };
    if (req.headers['if-none-match'] === etag) {
      res.writeHead(304, headers); res.end(); return;
    }
    if (req.method === 'HEAD') {
      res.writeHead(200, { ...headers, 'Content-Length': fileStat.size }); res.end(); return;
    }
    fs.readFile(targetPath, (readError, data) => {
      if (readError) { res.writeHead(500); res.end('Unable to read file'); return; }
      res.writeHead(200, { ...headers, 'Content-Length': data.length });
      res.end(data);
    });
  }
}

export const server = http.createServer(handleAppRequest);
export default handleAppRequest;

if (!process.env.VERCEL) {
  initDatabase()
    .then(() => {
      console.log('PostgreSQL schema verified & ready.');
    })
    .catch((err) => {
      console.warn('Warning: Could not auto-initialize PostgreSQL schema:', err.message);
    })
    .finally(() => {
      server.listen(PORT, '0.0.0.0', () => {
        console.log(`A2M Server + API running at http://localhost:${PORT}`);
      });
    });
}
