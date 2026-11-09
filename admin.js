/* ==========================================================================
   A2M — LÓGICA DEL CATÁLOGO Y PEDIDOS (VISTA DE BOUTIQUE LIMPIA Y SIMPLE)
   ========================================================================== */

(function () {
  'use strict';

  function esc(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  let products = [];
  let orders = [];
  let activeCategory = 'all';
  let pendingDeleteId = null;

  // Elementos del DOM
  const statProds = document.getElementById('stat-prods');
  const statStock = document.getElementById('stat-stock');
  const statOos = document.getElementById('stat-oos');
  const statOrders = document.getElementById('stat-orders');
  const statSales = document.getElementById('stat-sales');
  const adminDniBadge = document.getElementById('admin-dni-badge');

  const countAll = document.getElementById('count-all');
  const countArabe = document.getElementById('count-arabe');
  const countDisenador = document.getElementById('count-disenador');
  const countNicho = document.getElementById('count-nicho');
  const countOrders = document.getElementById('count-orders');

  const viewProds = document.getElementById('view-prods');
  const viewOrders = document.getElementById('view-orders');
  const prodsGrid = document.getElementById('prods-grid');
  const ordersList = document.getElementById('orders-list');
  const searchBoxWrap = document.getElementById('search-box-wrap');
  const inputSearch = document.getElementById('input-search');

  // Modal
  const modalScrim = document.getElementById('modal-prod-scrim');
  const modalScrollBody = document.getElementById('modal-scrollable-body');
  const modalTitle = document.getElementById('modal-prod-title');
  const formProd = document.getElementById('form-product');
  const btnCreateProd = document.getElementById('btn-create-prod');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const btnCancelModal = document.getElementById('btn-cancel-modal');
  const btnLogout = document.getElementById('btn-admin-logout');

  // Campos del formulario
  const fId = document.getElementById('prod-edit-id');
  const fNombre = document.getElementById('prod-nombre');
  const fMarca = document.getElementById('prod-marca');
  const fCat = document.getElementById('prod-categoria');
  const fPrecio = document.getElementById('prod-precio');
  const fStock = document.getElementById('prod-stock');
  const fImg = document.getElementById('prod-imagen');
  const fFileUpload = document.getElementById('prod-file-upload');
  const fNotas = document.getElementById('prod-notas');
  const fDesc = document.getElementById('prod-desc');
  const prevImg = document.getElementById('preview-img');

  const CAT_LABELS = {
    arabe: 'Árabe',
    disenador: 'Diseñador',
    nicho: 'Nicho'
  };

  function showToast(msg) {
    const existing = document.querySelector('.admin-toast');
    if (existing) existing.remove();
    const t = document.createElement('div');
    t.className = 'admin-toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }

  // 1. Verificar sesión de Administrador
  async function checkAdminSession() {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      if (!res.ok || !data.ok || !data.user || data.user.rol !== 'ADMIN') {
        renderAdminLoginOverlay();
        return false;
      }
      adminDniBadge.textContent = `DNI ${data.user.dni}`;
      return true;
    } catch {
      renderAdminLoginOverlay();
      return false;
    }
  }

  function renderAdminLoginOverlay() {
    const main = document.querySelector('.admin-main');
    if (!main) return;

    main.innerHTML = `
      <div style="max-width: 400px; margin: 64px auto; background: #fff; border: 1px solid var(--line); border-radius: 16px; padding: 36px 32px;">
        <h2 style="font-family: var(--font-serif); font-size: 28px; font-weight: 500; margin-bottom: 6px;">Acceso de administrador</h2>
        <p style="color: var(--muted); font-size: 13.5px; margin-bottom: 22px;">Ingresa con tu DNI para gestionar el catálogo y los pedidos.</p>

        <form id="form-admin-direct-login" style="display: flex; flex-direction: column; gap: 14px;">
          <div class="field-group">
            <label for="admin-login-dni">DNI</label>
            <input type="text" id="admin-login-dni" class="field-input" placeholder="72772860" maxlength="8" required />
          </div>
          <div class="field-group">
            <label for="admin-login-pass">Contraseña</label>
            <input type="password" id="admin-login-pass" class="field-input" placeholder="••••••••" required />
          </div>
          <div id="admin-login-error" style="color: var(--red); font-size: 13px;" hidden></div>
          <button type="submit" class="btn-primary" style="width: 100%; margin-top: 4px;">Entrar</button>
        </form>
      </div>
    `;

    const directForm = document.getElementById('form-admin-direct-login');
    const errBox = document.getElementById('admin-login-error');
    const dniInput = document.getElementById('admin-login-dni');
    dniInput.addEventListener('input', () => {
      dniInput.value = dniInput.value.replace(/\D/g, '').slice(0, 8);
    });

    directForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      errBox.hidden = true;
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dni: dniInput.value.trim(),
            password: document.getElementById('admin-login-pass').value
          })
        });
        const data = await res.json();
        if (res.ok && data.ok && data.user.rol === 'ADMIN') {
          window.location.reload();
        } else {
          errBox.textContent = data.error || 'Credenciales no válidas.';
          errBox.hidden = false;
        }
      } catch {
        errBox.textContent = 'Error de conexión.';
        errBox.hidden = false;
      }
    });
  }

  // 2. Cargar resumen
  async function loadStats() {
    try {
      const res = await fetch('/api/admin/stats');
      const data = await res.json();
      if (res.ok && data.ok && data.stats) {
        const s = data.stats;
        statProds.textContent = s.totalProductos;
        statStock.textContent = s.totalStock;
        statOos.textContent = s.totalAgotados;
        statOrders.textContent = s.totalPedidos;
        if (countOrders) countOrders.textContent = s.totalPedidos;
        statSales.textContent = `S/ ${s.totalVentas.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;
      }
    } catch {}
  }

  // 3. Cargar y renderizar perfumes en grilla limpia
  async function loadProducts() {
    try {
      const res = await fetch('/api/admin/productos');
      const data = await res.json();
      if (res.ok && data.ok) {
        products = data.productos || [];
        updateCounts();
        renderProducts();
      }
    } catch {
      prodsGrid.innerHTML = `<div class="empty-state">No se pudo cargar el catálogo.</div>`;
    }
  }

  function updateCounts() {
    if (countAll) countAll.textContent = products.length;
    if (countArabe) countArabe.textContent = products.filter(p => p.categoria === 'arabe').length;
    if (countDisenador) countDisenador.textContent = products.filter(p => p.categoria === 'disenador').length;
    if (countNicho) countNicho.textContent = products.filter(p => p.categoria === 'nicho').length;
  }

  function parseNotes(notasField) {
    if (Array.isArray(notasField)) return notasField.filter(Boolean);
    if (typeof notasField === 'string' && notasField.trim()) {
      try {
        const parsed = JSON.parse(notasField);
        if (Array.isArray(parsed)) return parsed.filter(Boolean);
      } catch {
        return notasField.split(',').map(s => s.trim()).filter(Boolean);
      }
    }
    return [];
  }

  function renderProducts() {
    const q = inputSearch.value.trim().toLowerCase();

    const filtered = products.filter(p => {
      const matchesCat = activeCategory === 'all' || p.categoria === activeCategory;
      const matchesSearch = !q || p.nombre.toLowerCase().includes(q) || p.marca.toLowerCase().includes(q);
      return matchesCat && matchesSearch;
    });

    if (!filtered.length) {
      prodsGrid.innerHTML = `<div class="empty-state">No se encontraron perfumes.</div>`;
      return;
    }

    prodsGrid.innerHTML = filtered.map(p => {
      const isOut = Boolean(p.agotado || p.stock <= 0);
      const notes = parseNotes(p.notas);
      const isConfirming = pendingDeleteId === p.id;

      return `
        <article class="perfume-card" data-id="${esc(p.id)}">
          <div class="card-media">
            <button type="button" class="card-status-pill ${isOut ? 'is-out' : 'is-in'} btn-toggle-oos" data-id="${esc(p.id)}" title="Clic para cambiar disponibilidad">
              ${isOut ? 'Agotado' : `${p.stock} en stock`}
            </button>
            <span class="card-cat-tag">${esc(CAT_LABELS[p.categoria] || p.categoria)}</span>
            <img src="${esc(p.imagen_url)}" alt="${esc(p.nombre)}" onerror="this.src='assets/catalog/khamrah.webp'" />
          </div>

          <div class="card-body">
            <span class="card-brand">${esc(p.marca)}</span>
            <div class="card-title-row">
              <h3 class="card-title">${esc(p.nombre)}</h3>
              <span class="card-price">S/ ${parseFloat(p.precio_soles).toFixed(2)}</span>
            </div>
            ${notes.length ? `<p class="card-notes">${esc(notes.slice(0, 3).join(' · '))}</p>` : ''}
          </div>

          <div class="card-footer">
            <div class="card-stock-Quick">
              <button type="button" class="stock-btn btn-stock-step" data-id="${esc(p.id)}" data-delta="-1" title="Restar 1">−</button>
              <span class="stock-count">${p.stock} uds</span>
              <button type="button" class="stock-btn btn-stock-step" data-id="${esc(p.id)}" data-delta="1" title="Sumar 1">+</button>
            </div>

            <div class="card-actions">
              <button type="button" class="card-btn-edit btn-edit-prod" data-id="${esc(p.id)}">Editar</button>
              <button type="button" class="card-btn-del btn-del-prod${isConfirming ? ' is-confirming' : ''}" data-id="${esc(p.id)}">
                ${isConfirming ? '¿Borrar?' : 'Eliminar'}
              </button>
            </div>
          </div>
        </article>
      `;
    }).join('');
  }

  // Eventos en las tarjetas de perfumes
  prodsGrid.addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const id = btn.dataset.id;
    const prod = products.find(p => p.id === id);
    if (!prod) return;

    // Subir / bajar stock rápido
    if (btn.classList.contains('btn-stock-step')) {
      const delta = parseInt(btn.dataset.delta, 10);
      const newStock = Math.max(0, (parseInt(prod.stock, 10) || 0) + delta);
      const res = await fetch(`/api/admin/productos/${encodeURIComponent(id)}/stock`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock: newStock })
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        prod.stock = data.producto.stock;
        prod.agotado = data.producto.agotado;
        renderProducts();
        loadStats();
      }
      return;
    }

    // Cambiar Agotado / Disponible
    if (btn.classList.contains('btn-toggle-oos')) {
      const res = await fetch(`/api/admin/productos/${encodeURIComponent(id)}/toggle-agotado`, { method: 'PATCH' });
      const data = await res.json();
      if (res.ok && data.ok) {
        prod.agotado = data.producto.agotado;
        renderProducts();
        loadStats();
      }
      return;
    }

    // Abrir modal de edición
    if (btn.classList.contains('btn-edit-prod')) {
      openEditModal(prod);
      return;
    }

    // Eliminar perfume
    if (btn.classList.contains('btn-del-prod')) {
      if (pendingDeleteId !== id) {
        pendingDeleteId = id;
        renderProducts();
        setTimeout(() => {
          if (pendingDeleteId === id) {
            pendingDeleteId = null;
            renderProducts();
          }
        }, 3500);
        return;
      }
      pendingDeleteId = null;
      const res = await fetch(`/api/admin/productos/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (res.ok) {
        products = products.filter(p => p.id !== id);
        updateCounts();
        renderProducts();
        loadStats();
        showToast('Perfume eliminado.');
      }
    }
  });

  // 4. Modal limpio de Agregar / Editar
  fImg.addEventListener('input', () => {
    prevImg.src = fImg.value.trim() || 'assets/catalog/khamrah.webp';
  });

  fFileUpload.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const max = 600;
        let w = img.width;
        let h = img.height;
        if (w > max || h > max) {
          if (w > h) { h = Math.round((h * max) / w); w = max; }
          else { w = Math.round((w * max) / h); h = max; }
        }
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/webp', 0.85);
        fImg.value = dataUrl;
        prevImg.src = dataUrl;
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });

  function openCreateModal() {
    modalTitle.textContent = 'Agregar perfume';
    fId.value = '';
    formProd.reset();
    fCat.value = activeCategory !== 'all' ? activeCategory : 'arabe';
    fImg.value = 'assets/catalog/khamrah.webp';
    prevImg.src = 'assets/catalog/khamrah.webp';
    fStock.value = '15';

    modalScrim.hidden = false;
    document.body.classList.add('modal-open');
    if (modalScrollBody) modalScrollBody.scrollTop = 0;
    requestAnimationFrame(() => modalScrim.classList.add('is-open'));
  }

  function openEditModal(prod) {
    modalTitle.textContent = 'Editar perfume';
    fId.value = prod.id;
    fNombre.value = prod.nombre || '';
    fMarca.value = prod.marca || '';
    fCat.value = prod.categoria || 'arabe';
    fPrecio.value = parseFloat(prod.precio_soles || 0).toFixed(2);
    fStock.value = prod.stock ?? 0;
    fImg.value = prod.imagen_url || 'assets/catalog/khamrah.webp';
    prevImg.src = fImg.value;
    fNotas.value = parseNotes(prod.notas).join(', ');
    fDesc.value = prod.descripcion || '';

    modalScrim.hidden = false;
    document.body.classList.add('modal-open');
    if (modalScrollBody) modalScrollBody.scrollTop = 0;
    requestAnimationFrame(() => modalScrim.classList.add('is-open'));
  }

  function closeModal() {
    modalScrim.classList.remove('is-open');
    document.body.classList.remove('modal-open');
    setTimeout(() => { modalScrim.hidden = true; }, 200);
  }

  btnCreateProd.addEventListener('click', openCreateModal);
  btnCloseModal.addEventListener('click', closeModal);
  btnCancelModal.addEventListener('click', closeModal);
  modalScrim.addEventListener('click', (e) => {
    if (e.target === modalScrim) closeModal();
  });

  formProd.addEventListener('submit', async (e) => {
    e.preventDefault();
    const editId = fId.value.trim();
    const notasArray = fNotas.value
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    const payload = {
      nombre: fNombre.value.trim(),
      marca: fMarca.value.trim(),
      categoria: fCat.value,
      precio_soles: parseFloat(fPrecio.value),
      stock: parseInt(fStock.value, 10),
      imagen_url: fImg.value.trim(),
      notas: notasArray,
      descripcion: fDesc.value.trim()
    };

    const url = editId ? `/api/admin/productos/${encodeURIComponent(editId)}` : '/api/admin/productos';
    const method = editId ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (res.ok && data.ok) {
      closeModal();
      await loadProducts();
      await loadStats();
      showToast(editId ? 'Cambios guardados.' : 'Perfume agregado.');
    } else {
      showToast(data.error || 'No se pudo guardar.');
    }
  });

  // 5. Pedidos de clientes
  async function loadOrders() {
    try {
      const res = await fetch('/api/admin/pedidos');
      const data = await res.json();
      if (res.ok && data.ok) {
        orders = data.pedidos || [];
        if (countOrders) countOrders.textContent = orders.length;
        renderOrders();
      }
    } catch {
      ordersList.innerHTML = `<div class="empty-state">No se pudieron cargar los pedidos.</div>`;
    }
  }

  function renderOrders() {
    if (!orders.length) {
      ordersList.innerHTML = `<div class="empty-state">Aún no hay pedidos registrados.</div>`;
      return;
    }

    ordersList.innerHTML = orders.map(o => {
      const fecha = new Date(o.created_at).toLocaleDateString('es-PE', {
        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
      });
      const itemsText = (o.items || []).map(i => `${i.cantidad}× ${esc(i.nombre_producto)}`).join('<br>');
      const pagoInfo = o.pago_info || null;
      const isPaidStatus = o.estado === 'PAGADO' || o.estado === 'ENVIADO' || o.estado === 'EN_CAMINO' || o.estado === 'ENTREGADO';
      const canal = pagoInfo
        ? `${pagoInfo.canal === 'YAPE' ? 'Yape' : 'Tarjeta'} · #${esc(pagoInfo.autorizacion_codigo)}`
        : (isPaidStatus ? 'Pagado' : (o.estado === 'CANCELADO' ? 'Cancelado' : 'Pago pendiente'));

      let dir = {};
      if (typeof o.direccion_envio === 'string') {
        try {
          dir = JSON.parse(o.direccion_envio || '{}');
        } catch {
          dir = { direccion: o.direccion_envio };
        }
      } else if (o.direccion_envio && typeof o.direccion_envio === 'object') {
        dir = o.direccion_envio;
      }

      const dirCalle = dir.direccion || o.direccion || 'Sin dirección especificada';
      const dirZona = [dir.distrito || o.distrito_envio, dir.ciudad || o.ciudad_envio].filter(Boolean).join(', ');
      const dirRef = dir.referencia || o.referencia_envio || '';
      const isPending = o.estado === 'PENDIENTE' || o.estado === 'PENDIENTE_PAGO';
      const isShipped = o.estado === 'ENVIADO' || o.estado === 'EN_CAMINO';

      return `
        <article class="order-row-card">
          <div class="order-col-id">
            <strong>${esc(o.numero_pedido)}</strong>
            <span>${esc(fecha)} · DNI ${esc(o.cliente_dni || dir.dni || '')}</span>
          </div>

          <div class="order-col-address">
            <strong>${esc(dirCalle)}</strong>
            <span>${esc(dirZona)}${dirRef ? ` — ${esc(dirRef)}` : ''}</span>
          </div>

          <div class="order-col-items">
            ${itemsText || '—'}
          </div>

          <div class="order-col-total">
            <strong>S/ ${parseFloat(o.total_soles).toFixed(2)}</strong>
            <span>${canal}</span>
          </div>

          <div>
            <select class="field-input field-input-sm select-order-status" data-order-id="${o.id}">
              <option value="PENDIENTE" ${isPending ? 'selected' : ''}>Pendiente</option>
              <option value="PAGADO" ${o.estado === 'PAGADO' ? 'selected' : ''}>Pagado</option>
              <option value="ENVIADO" ${isShipped ? 'selected' : ''}>Enviado</option>
              <option value="ENTREGADO" ${o.estado === 'ENTREGADO' ? 'selected' : ''}>Entregado</option>
              <option value="CANCELADO" ${o.estado === 'CANCELADO' ? 'selected' : ''}>Cancelado</option>
            </select>
          </div>
        </article>
      `;
    }).join('');
  }

  ordersList.addEventListener('change', async (e) => {
    if (!e.target.classList.contains('select-order-status')) return;
    const orderId = e.target.dataset.orderId;
    const estado = e.target.value;
    const res = await fetch(`/api/admin/pedidos/${encodeURIComponent(orderId)}/estado`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado })
    });
    if (res.ok) {
      showToast('Estado actualizado.');
      await Promise.all([loadOrders(), loadProducts(), loadStats()]);
    }
  });

  // 6. Navegación por pestañas
  document.querySelector('.admin-tabs').addEventListener('click', (e) => {
    const tab = e.target.closest('.nav-tab');
    if (!tab) return;

    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('is-active'));
    tab.classList.add('is-active');

    if (tab.dataset.view === 'orders') {
      viewProds.hidden = true;
      viewOrders.hidden = false;
      searchBoxWrap.hidden = true;
      loadOrders();
    } else {
      viewProds.hidden = false;
      viewOrders.hidden = true;
      searchBoxWrap.hidden = false;
      activeCategory = tab.dataset.cat || 'all';
      renderProducts();
    }
  });

  inputSearch.addEventListener('input', renderProducts);

  btnLogout.addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = 'catalog.html';
  });

  async function init() {
    const ok = await checkAdminSession();
    if (!ok) return;
    await Promise.all([loadStats(), loadProducts(), loadOrders()]);
  }

  init();
})();
