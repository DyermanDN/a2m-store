/**
 * A2M — GESTIÓN DE CUENTA, PERFIL DE ENTREGA Y PASARELA NIUBIZ / YAPE
 */

(() => {
  'use strict';

  // DOM Elements
  const userBtn = document.getElementById('user-btn');
  const userActiveDot = document.getElementById('user-active-dot');
  const accountDrawer = document.getElementById('account-drawer');
  const accountCloseBtn = document.getElementById('account-close');
  const scrim = document.getElementById('scrim');

  // Views
  const authView = document.getElementById('auth-view');
  const profileView = document.getElementById('profile-view');

  // Tabs
  const tabLogin = document.getElementById('tab-login');
  const tabRegister = document.getElementById('tab-register');

  // Forms
  const formLogin = document.getElementById('form-login');
  const formRegister = document.getElementById('form-register');
  const formProfile = document.getElementById('form-profile');

  // Inputs
  const inputLoginDni = document.getElementById('login-dni');
  const inputLoginPass = document.getElementById('login-password');
  const inputRegDni = document.getElementById('reg-dni');
  const inputRegPass = document.getElementById('reg-password');

  // Profile Inputs
  const profileDniDisplay = document.getElementById('profile-dni-display');
  const inputProfCiudad = document.getElementById('prof-ciudad');
  const inputProfDistrito = document.getElementById('prof-distrito');
  const inputProfDireccion = document.getElementById('prof-direccion');
  const inputProfReferencia = document.getElementById('prof-referencia');

  // Feedbacks
  const loginFeedback = document.getElementById('login-feedback');
  const regFeedback = document.getElementById('reg-feedback');
  const profileFeedback = document.getElementById('profile-feedback');

  // Action Buttons
  const btnLogout = document.getElementById('btn-logout');

  // State
  let currentUser = null;
  let userOrdersCache = [];
  let activeOrderForPayment = null;
  let selectedPayMethod = 'NIUBIZ_TARJETA';

  function enforceNumeric(input, maxLen) {
    if (!input) return;
    input.addEventListener('input', () => {
      input.value = input.value.replace(/\D/g, '').slice(0, maxLen);
    });
  }
  enforceNumeric(inputLoginDni, 8);
  enforceNumeric(inputRegDni, 8);

  function setFeedback(el, message, type = 'error') {
    if (!el) return;
    if (!message) {
      el.hidden = true;
      el.textContent = '';
      el.className = 'auth-feedback';
      return;
    }
    const text = typeof message === 'string' ? message : (message.message || JSON.stringify(message));
    el.hidden = false;
    el.textContent = text;
    el.className = `auth-feedback is-${type}`;
  }

  // Drawer Controls
  function openAccountDrawer(customNotice) {
    if (!accountDrawer) return;

    const bagDrawer = document.getElementById('bag-drawer');
    if (bagDrawer && bagDrawer.classList.contains('is-open')) {
      bagDrawer.classList.remove('is-open');
      bagDrawer.hidden = true;
    }

    accountDrawer.hidden = false;
    void accountDrawer.offsetWidth;
    accountDrawer.classList.add('is-open');
    document.body.classList.add('no-scroll');

    if (scrim) {
      scrim.hidden = false;
      void scrim.offsetWidth;
      scrim.classList.add('is-open');
    }

    if (customNotice) {
      if (currentUser) {
        setFeedback(profileFeedback, customNotice, 'error');
      } else {
        setFeedback(loginFeedback, customNotice, 'error');
      }
    }
  }

  function closeAccountDrawer() {
    if (!accountDrawer) return;
    accountDrawer.classList.remove('is-open');
    document.body.classList.remove('no-scroll');
    setTimeout(() => {
      if (!accountDrawer.classList.contains('is-open')) {
        accountDrawer.hidden = true;
      }
    }, 300);

    const bagDrawer = document.getElementById('bag-drawer');
    const isBagOpen = bagDrawer && bagDrawer.classList.contains('is-open');

    if (scrim && !isBagOpen) {
      scrim.classList.remove('is-open');
      setTimeout(() => {
        if (!accountDrawer.classList.contains('is-open') && (!bagDrawer || !bagDrawer.classList.contains('is-open'))) {
          scrim.hidden = true;
        }
      }, 300);
    }
  }

  function switchTab(target) {
    setFeedback(loginFeedback, null);
    setFeedback(regFeedback, null);

    if (target === 'register') {
      tabRegister.classList.add('is-active');
      tabRegister.setAttribute('aria-selected', 'true');
      tabLogin.classList.remove('is-active');
      tabLogin.setAttribute('aria-selected', 'false');

      formLogin.hidden = true;
      formRegister.hidden = false;
      if (inputRegDni) inputRegDni.focus();
    } else {
      tabLogin.classList.add('is-active');
      tabLogin.setAttribute('aria-selected', 'true');
      tabRegister.classList.remove('is-active');
      tabRegister.setAttribute('aria-selected', 'false');

      formRegister.hidden = true;
      formLogin.hidden = false;
      if (inputLoginDni) inputLoginDni.focus();
    }
  }

  function renderUserState(user) {
    currentUser = user;

    if (user) {
      if (userActiveDot) userActiveDot.hidden = false;
      if (authView) authView.hidden = true;
      if (profileView) profileView.hidden = false;

      if (profileDniDisplay) {
        profileDniDisplay.textContent = `DNI ${user.dni}`;
      }
      if (inputProfCiudad) inputProfCiudad.value = user.ciudad || '';
      if (inputProfDistrito) inputProfDistrito.value = user.distrito || '';
      if (inputProfDireccion) inputProfDireccion.value = user.direccion || '';
      if (inputProfReferencia) inputProfReferencia.value = user.referencia || '';

      setFeedback(profileFeedback, null);
      loadUserOrders();
    } else {
      if (userActiveDot) userActiveDot.hidden = true;
      if (authView) authView.hidden = false;
      if (profileView) profileView.hidden = true;

      if (formLogin) formLogin.reset();
      if (formRegister) formRegister.reset();
      switchTab('login');
    }
  }

  function formatStatusLabel(estado) {
    const map = {
      PENDIENTE: 'Pendiente de pago',
      PENDIENTE_PAGO: 'Pendiente de pago',
      PAGADO: 'Pagado',
      ENVIADO: 'Enviado',
      EN_CAMINO: 'En camino',
      ENTREGADO: 'Entregado',
      CANCELADO: 'Cancelado'
    };
    return map[estado] || estado;
  }

  async function loadUserOrders() {
    const listEl = document.getElementById('profile-orders-list');
    if (!listEl) return;
    try {
      const res = await fetch('/api/pedidos/mis-pedidos');
      const data = await res.json();
      if (res.ok && data.ok && Array.isArray(data.pedidos) && data.pedidos.length) {
        userOrdersCache = data.pedidos;
        listEl.innerHTML = data.pedidos.map(p => {
          const items = p.items || [];
          const itemsSummary = items.map(i => `${i.cantidad}× ${i.nombre_producto}`).join(', ');
          const dateStr = new Date(p.created_at).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
          const isPaid = p.estado === 'PAGADO' || p.estado === 'ENVIADO' || p.estado === 'EN_CAMINO' || p.estado === 'ENTREGADO';
          const isPending = p.estado === 'PENDIENTE' || p.estado === 'PENDIENTE_PAGO';
          return `
            <div class="profile-order-card">
              <div class="profile-order-header">
                <span class="profile-order-num">${p.numero_pedido}</span>
                <span class="order-status-badge${isPaid ? ' is-paid' : ''}">${formatStatusLabel(p.estado)}</span>
              </div>
              <div class="profile-order-items-summary">${itemsSummary || 'Fragancias'} · ${dateStr}</div>
              <div class="profile-order-foot">
                <span class="profile-order-total">S/ ${Number(p.total_soles).toFixed(2)}</span>
                ${isPending
                  ? `<button type="button" class="profile-order-pay-btn" data-pay-order-id="${p.id}">Completar pago →</button>`
                  : `<span style="font-size:12px; color:var(--muted);">${p.metodo_pago === 'YAPE' ? 'Pagado con Yape' : (p.metodo_pago === 'NIUBIZ_TARJETA' ? 'Pagado con Tarjeta' : '')}</span>`
                }
              </div>
            </div>
          `;
        }).join('');

        listEl.querySelectorAll('[data-pay-order-id]').forEach(btn => {
          btn.addEventListener('click', () => {
            const ord = userOrdersCache.find(o => String(o.id) === String(btn.dataset.payOrderId));
            if (ord) {
              closeAccountDrawer();
              openOrderModal(ord);
            }
          });
        });
      } else {
        listEl.innerHTML = '<p class="profile-hint">Aún no registras compras con tu cuenta.</p>';
      }
    } catch {
      listEl.innerHTML = '<p class="profile-hint">No se pudo cargar el historial de compras.</p>';
    }
  }

  async function checkSession() {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.user) {
          renderUserState(data.user);
          return;
        }
      }
      renderUserState(null);
    } catch {
      renderUserState(null);
    }
  }

  // Event Listeners
  if (userBtn) {
    userBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (currentUser && currentUser.rol === 'ADMIN') {
        window.location.href = 'admin.html';
        return;
      }
      openAccountDrawer();
    });
  }

  if (accountCloseBtn) {
    accountCloseBtn.addEventListener('click', closeAccountDrawer);
  }

  if (scrim) {
    scrim.addEventListener('click', () => {
      if (accountDrawer && accountDrawer.classList.contains('is-open')) {
        closeAccountDrawer();
      }
    });
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && accountDrawer && accountDrawer.classList.contains('is-open')) {
      closeAccountDrawer();
    }
  });

  if (tabLogin) {
    tabLogin.addEventListener('click', () => switchTab('login'));
  }
  if (tabRegister) {
    tabRegister.addEventListener('click', () => switchTab('register'));
  }

  // Login Submit
  if (formLogin) {
    formLogin.addEventListener('submit', async (e) => {
      e.preventDefault();
      setFeedback(loginFeedback, null);

      const dni = inputLoginDni.value.trim();
      const password = inputLoginPass.value;

      if (!/^\d{8}$/.test(dni)) {
        setFeedback(loginFeedback, 'El DNI debe contener 8 dígitos.');
        return;
      }

      const submitBtn = document.getElementById('btn-submit-login');
      if (submitBtn) submitBtn.disabled = true;

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dni, password })
        });
        const data = await res.json();

        if (res.ok && data.ok) {
          if (data.user && data.user.rol === 'ADMIN') {
            window.location.href = 'admin.html';
            return;
          }
          renderUserState(data.user);
        } else {
          setFeedback(loginFeedback, data.error || 'DNI o contraseña incorrectos.');
        }
      } catch {
        setFeedback(loginFeedback, 'No se pudo conectar con el servidor.');
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  // Register Submit
  if (formRegister) {
    formRegister.addEventListener('submit', async (e) => {
      e.preventDefault();
      setFeedback(regFeedback, null);

      const dni = inputRegDni.value.trim();
      const password = inputRegPass.value;

      if (!/^\d{8}$/.test(dni)) {
        setFeedback(regFeedback, 'El DNI debe contener 8 dígitos.');
        return;
      }
      if (password.length < 6) {
        setFeedback(regFeedback, 'La contraseña debe tener al menos 6 caracteres.');
        return;
      }

      const submitBtn = document.getElementById('btn-submit-register');
      if (submitBtn) submitBtn.disabled = true;

      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dni, password })
        });
        const data = await res.json();

        if (res.ok && data.ok) {
          renderUserState(data.user);
          setFeedback(profileFeedback, 'Cuenta creada. Completa tu dirección de envío para tus compras.', 'success');
        } else {
          setFeedback(regFeedback, data.error || 'No se pudo crear la cuenta.');
        }
      } catch {
        setFeedback(regFeedback, 'No se pudo conectar con el servidor.');
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  // Profile Update Submit
  if (formProfile) {
    formProfile.addEventListener('submit', async (e) => {
      e.preventDefault();
      setFeedback(profileFeedback, null);

      const ciudad = inputProfCiudad.value.trim();
      const distrito = inputProfDistrito.value.trim();
      const direccion = inputProfDireccion.value.trim();
      const referencia = inputProfReferencia.value.trim();

      const saveBtn = document.getElementById('btn-save-profile');
      if (saveBtn) saveBtn.disabled = true;

      try {
        const res = await fetch('/api/user/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ciudad, distrito, direccion, referencia })
        });
        const data = await res.json();

        if (res.ok && data.ok) {
          currentUser = data.user;
          setFeedback(profileFeedback, 'Dirección de entrega actualizada.', 'success');
        } else {
          setFeedback(profileFeedback, data.error || 'No se pudo guardar la dirección.');
        }
      } catch {
        setFeedback(profileFeedback, 'No se pudo conectar con el servidor.');
      } finally {
        if (saveBtn) saveBtn.disabled = false;
      }
    });
  }

  // Logout
  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      try {
        await fetch('/api/auth/logout', { method: 'POST' });
      } catch {
        // continue
      }
      renderUserState(null);
    });
  }

  // ==========================================
  // MODAL DE CHECKOUT & PAGO (NIUBIZ / YAPE)
  // ==========================================
  const orderScrim = document.getElementById('order-scrim');
  const orderModalBody = document.getElementById('order-modal-body');
  const orderTitle = document.getElementById('order-title');
  const orderSub = document.querySelector('.order-modal-sub');
  const btnPayOrder = document.getElementById('btn-pay-order');
  const btnCloseOrder = document.getElementById('btn-close-order');
  const btnCloseOrderIcon = document.getElementById('order-modal-close-icon');

  function formatCardNumber(val) {
    return val.replace(/\D/g, '').slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 ');
  }

  function formatExpiry(val) {
    const clean = val.replace(/\D/g, '').slice(0, 4);
    if (clean.length >= 3) return `${clean.slice(0, 2)}/${clean.slice(2)}`;
    return clean;
  }

  function renderPaymentModalContent(pedido, pagoConfirmado = null) {
    if (!orderModalBody) return;

    const dir = typeof pedido.direccion_envio === 'string'
      ? JSON.parse(pedido.direccion_envio || '{}')
      : (pedido.direccion_envio || {});
    const items = pedido.items || [];
    const subtotal = Number(pedido.subtotal_soles || pedido.total_soles).toFixed(2);
    const envio = Number(pedido.costo_envio_soles || 0).toFixed(2);
    const total = Number(pedido.total_soles).toFixed(2);
    const isPaid = pedido.estado === 'PAGADO' || Boolean(pagoConfirmado);

    if (orderTitle) {
      orderTitle.textContent = isPaid ? 'Comprobante de compra' : 'Resumen y pago';
    }
    if (orderSub) {
      orderSub.textContent = isPaid
        ? 'Tu pago fue procesado y tu pedido está listo para despacho.'
        : 'Verifica los detalles de tu entrega y elige tu medio de pago.';
    }

    const paymentSectionHTML = isPaid
      ? `
        <div class="receipt-box">
          <div class="receipt-head">
            <svg class="icon" aria-hidden="true" style="width:20px;height:20px;"><use href="#i-check"/></svg>
            <span>Pago aprobado en Soles</span>
          </div>
          <div class="receipt-grid">
            <div>
              <span>Medio utilizado</span>
              <strong>${(pagoConfirmado?.canal || pedido.metodo_pago) === 'YAPE' ? 'Yape' : 'Tarjeta (Niubiz)'}</strong>
            </div>
            <div>
              <span>Cód. Autorización</span>
              <strong>#${pagoConfirmado?.autorizacion_codigo || '849201'}</strong>
            </div>
            <div>
              <span>Operación</span>
              <strong>${pagoConfirmado?.transaction_id || pedido.numero_pedido}</strong>
            </div>
            <div>
              <span>Importe pagado</span>
              <strong>S/ ${total}</strong>
            </div>
          </div>
        </div>
      `
      : `
        <div class="pay-methods-section">
          <span class="form-label">Selecciona tu medio de pago</span>
          <div class="pay-method-tabs" role="tablist">
            <button type="button" class="pay-method-tab${selectedPayMethod === 'NIUBIZ_TARJETA' ? ' is-active' : ''}" data-method="NIUBIZ_TARJETA">
              <span>Tarjeta (Niubiz)</span>
            </button>
            <button type="button" class="pay-method-tab${selectedPayMethod === 'YAPE' ? ' is-active' : ''}" data-method="YAPE">
              <span class="yape-dot"></span>
              <span>Yape</span>
            </button>
          </div>

          <div id="pay-panel-card" class="pay-form-panel" ${selectedPayMethod === 'NIUBIZ_TARJETA' ? '' : 'hidden'}>
            <div class="form-group">
              <label for="card-number" class="form-label">Número de tarjeta (Visa o Mastercard)</label>
              <input type="text" id="card-number" class="form-input" placeholder="4557 8800 1234 5678" maxlength="19" inputmode="numeric" autocomplete="cc-number" />
            </div>
            <div class="form-row-2">
              <div class="form-group">
                <label for="card-exp" class="form-label">Vencimiento</label>
                <input type="text" id="card-exp" class="form-input" placeholder="MM/AA" maxlength="5" inputmode="numeric" autocomplete="cc-exp" />
              </div>
              <div class="form-group">
                <label for="card-cvv" class="form-label">CVV</label>
                <input type="password" id="card-cvv" class="form-input" placeholder="123" maxlength="4" inputmode="numeric" autocomplete="cc-csc" />
              </div>
            </div>
          </div>

          <div id="pay-panel-yape" class="pay-form-panel is-yape" ${selectedPayMethod === 'YAPE' ? '' : 'hidden'}>
            <p class="yape-instructions">Ingresa el número de celular afiliado a tu cuenta Yape y el código de aprobación de 6 dígitos desde tu aplicativo.</p>
            <div class="form-row-2">
              <div class="form-group">
                <label for="yape-phone" class="form-label">Celular Yape</label>
                <input type="text" id="yape-phone" class="form-input" placeholder="987 654 321" maxlength="9" inputmode="numeric" />
              </div>
              <div class="form-group">
                <label for="yape-otp" class="form-label">Código de aprobación</label>
                <input type="text" id="yape-otp" class="form-input" placeholder="6 dígitos" maxlength="6" inputmode="numeric" />
              </div>
            </div>
          </div>

          <div id="pay-feedback" class="auth-feedback" hidden></div>
        </div>
      `;

    orderModalBody.innerHTML = `
      <div class="order-info-grid">
        <div class="order-info-item">
          <span>Orden de compra</span>
          <span>${pedido.numero_pedido}</span>
        </div>
        <span class="order-status-badge${isPaid ? ' is-paid' : ''}">${formatStatusLabel(isPaid ? 'PAGADO' : pedido.estado)}</span>
      </div>

      <div class="order-dest-box">
        <p class="order-dest-title">Dirección de despacho</p>
        <p class="order-dest-address"><strong>${dir.direccion || ''}</strong>, ${dir.distrito || ''} — ${dir.ciudad || ''}</p>
        ${dir.referencia ? `<p class="order-dest-ref">Referencia: ${dir.referencia}</p>` : ''}
      </div>

      <div class="order-items-list">
        ${items.map(it => `
          <div class="order-item-row">
            <div class="order-item-detail">
              <span class="order-item-name">${it.nombre_producto}</span>
              <span class="order-item-qty">Cantidad: ${it.cantidad}</span>
            </div>
            <span class="order-item-price">S/ ${(Number(it.precio_unitario_soles) * Number(it.cantidad)).toFixed(2)}</span>
          </div>
        `).join('')}
      </div>

      <div class="order-totals-card">
        <div class="order-total-row">
          <span>Subtotal</span>
          <span>S/ ${subtotal}</span>
        </div>
        <div class="order-total-row">
          <span>Envío a domicilio</span>
          <span>${Number(envio) === 0 ? 'De cortesía' : `S/ ${envio}`}</span>
        </div>
        <div class="order-total-row is-total">
          <span>Total</span>
          <span>S/ ${total}</span>
        </div>
      </div>

      ${paymentSectionHTML}
    `;

    // Bind payment form events if not yet paid
    if (!isPaid) {
      const cardNumEl = document.getElementById('card-number');
      const cardExpEl = document.getElementById('card-exp');
      const cardCvvEl = document.getElementById('card-cvv');
      const yapePhoneEl = document.getElementById('yape-phone');
      const yapeOtpEl = document.getElementById('yape-otp');

      if (cardNumEl) {
        cardNumEl.addEventListener('input', () => { cardNumEl.value = formatCardNumber(cardNumEl.value); });
      }
      if (cardExpEl) {
        cardExpEl.addEventListener('input', () => { cardExpEl.value = formatExpiry(cardExpEl.value); });
      }
      enforceNumeric(cardCvvEl, 4);
      enforceNumeric(yapePhoneEl, 9);
      enforceNumeric(yapeOtpEl, 6);

      orderModalBody.querySelectorAll('.pay-method-tab').forEach(tab => {
        tab.addEventListener('click', () => {
          selectedPayMethod = tab.dataset.method;
          renderPaymentModalContent(pedido, null);
          updatePayButtonState(total, false);
        });
      });
    }

    updatePayButtonState(total, isPaid);
  }

  function updatePayButtonState(total, isPaid) {
    if (!btnPayOrder) return;
    if (isPaid) {
      btnPayOrder.hidden = true;
      if (btnCloseOrder) {
        btnCloseOrder.textContent = 'Finalizar y volver a la tienda';
        btnCloseOrder.className = 'btn btn-solid btn-block';
      }
    } else {
      btnPayOrder.hidden = false;
      if (btnCloseOrder) {
        btnCloseOrder.textContent = 'Pagar más tarde';
        btnCloseOrder.className = 'btn btn-outline btn-block';
      }
      if (selectedPayMethod === 'YAPE') {
        btnPayOrder.className = 'btn btn-solid btn-block btn-yape-pay';
        btnPayOrder.innerHTML = `<span>Yapear S/ ${total}</span>`;
      } else {
        btnPayOrder.className = 'btn btn-solid btn-block';
        btnPayOrder.innerHTML = `<span>Pagar S/ ${total} con Tarjeta</span>`;
      }
    }
  }

  async function submitOrderPayment() {
    if (!activeOrderForPayment || !btnPayOrder) return;
    const feedbackEl = document.getElementById('pay-feedback');
    setFeedback(feedbackEl, null);

    let datosPago = {};

    if (selectedPayMethod === 'NIUBIZ_TARJETA') {
      const rawCard = (document.getElementById('card-number')?.value || '').replace(/\D/g, '');
      const exp = (document.getElementById('card-exp')?.value || '').trim();
      const cvv = (document.getElementById('card-cvv')?.value || '').replace(/\D/g, '');

      if (rawCard.length < 15) {
        setFeedback(feedbackEl, 'Ingresa los 16 dígitos de tu tarjeta de crédito o débito.');
        return;
      }
      if (!/^\d{2}\/\d{2}$/.test(exp)) {
        setFeedback(feedbackEl, 'Ingresa la fecha de vencimiento en formato MM/AA.');
        return;
      }
      if (cvv.length < 3) {
        setFeedback(feedbackEl, 'Ingresa el código CVV de seguridad.');
        return;
      }
      datosPago = {
        ultimos4: rawCard.slice(-4),
        marca: rawCard.startsWith('4') ? 'VISA' : 'MASTERCARD'
      };
    } else {
      const phone = (document.getElementById('yape-phone')?.value || '').replace(/\D/g, '');
      const otp = (document.getElementById('yape-otp')?.value || '').replace(/\D/g, '');

      if (!/^9\d{8}$/.test(phone)) {
        setFeedback(feedbackEl, 'Ingresa un número de celular peruano válido (9 dígitos).');
        return;
      }
      if (otp.length !== 6) {
        setFeedback(feedbackEl, 'Ingresa el código de aprobación de 6 dígitos de tu app Yape.');
        return;
      }
      datosPago = { celular: phone };
    }

    btnPayOrder.disabled = true;
    btnPayOrder.innerHTML = '<span>Procesando pago seguro...</span>';

    try {
      const res = await fetch('/api/pagos/procesar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pedidoId: activeOrderForPayment.id || activeOrderForPayment.numero_pedido,
          canal: selectedPayMethod,
          datosPago
        })
      });
      const data = await res.json();

      if (res.ok && data.ok) {
        activeOrderForPayment = data.pedido;
        renderPaymentModalContent(data.pedido, data.pago);
        loadUserOrders();
      } else {
        setFeedback(feedbackEl, data.error || 'No se pudo procesar el pago.');
        updatePayButtonState(Number(activeOrderForPayment.total_soles).toFixed(2), false);
      }
    } catch {
      setFeedback(feedbackEl, 'Error de conexión al procesar la transacción.');
      updatePayButtonState(Number(activeOrderForPayment.total_soles).toFixed(2), false);
    } finally {
      btnPayOrder.disabled = false;
    }
  }

  function openOrderModal(pedido) {
    activeOrderForPayment = pedido;
    selectedPayMethod = 'NIUBIZ_TARJETA';
    loadUserOrders();
    if (!orderScrim) return;

    renderPaymentModalContent(pedido, null);

    if (btnPayOrder) {
      btnPayOrder.onclick = submitOrderPayment;
    }

    orderScrim.hidden = false;
    document.body.classList.add('no-scroll');
    void orderScrim.offsetWidth;
    orderScrim.classList.add('is-open');
  }

  function closeOrderModal() {
    if (!orderScrim) return;
    orderScrim.classList.remove('is-open');
    document.body.classList.remove('no-scroll');
    setTimeout(() => {
      if (!orderScrim.classList.contains('is-open')) {
        orderScrim.hidden = true;
      }
    }, 260);
  }

  if (btnCloseOrder) {
    btnCloseOrder.addEventListener('click', closeOrderModal);
  }
  if (btnCloseOrderIcon) {
    btnCloseOrderIcon.addEventListener('click', closeOrderModal);
  }

  if (orderScrim) {
    orderScrim.addEventListener('click', (e) => {
      if (e.target === orderScrim) closeOrderModal();
    });
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && orderScrim && orderScrim.classList.contains('is-open')) {
      closeOrderModal();
    }
  });

  window.A2M_AUTH = {
    getUser: () => currentUser,
    openAccount: openAccountDrawer,
    closeAccount: closeAccountDrawer,
    showOrderConfirmation: openOrderModal,
    refresh: checkSession
  };

  checkSession();
})();
