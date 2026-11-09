/* =========================================================
   PLUIE - CATÁLOGO EN ESPAÑOL
   Categorías: Árabe, Diseñador, Nicho.
   Filtros: Categoría, Género, Precio, Marca (Tamaño eliminado).
   ========================================================= */
(() => {
  'use strict';

  /* ---------- Helpers ---------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const money = n => 'S/ ' + Number(n).toLocaleString('es-PE');
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fold = s => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const slug = s => fold(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const mobileQuery = window.matchMedia('(max-width: 960px)');

  /* ---------- Modelo del catálogo ---------- */
  const PRODUCTS = CATALOG_PRODUCTS;
  const BY_ID = new Map(PRODUCTS.map(p => [p.id, p]));
  const BRANDS = [...new Set(PRODUCTS.map(p => p.brand))].map(label => ({ id: slug(label), label }));
  const PRICE_RANGES = [
    { id: 'under-60', label: 'Menos de S/ 60', min: 0, max: 59.99 },
    { id: '60-100', label: 'S/ 60 a S/ 100', min: 60, max: 100 },
    { id: '100-250', label: 'S/ 100 a S/ 250', min: 100.01, max: 250 },
    { id: 'over-250', label: 'Más de S/ 250', min: 250.01, max: Infinity }
  ];
  const SORTS = ['featured', 'newest', 'price-desc', 'price-asc'];
  const GENDER_ADJ = { women: "Para mujer", men: "Para hombre", unisex: 'Unisex' };
  const FREE_SHIPPING_FROM = 150;
  const SHIPPING_FEE = 12;
  const SEARCH_INDEX = new Map(PRODUCTS.map(p => [p.id, fold([
    p.name, p.brand, p.concentration, CATALOG_CATEGORIES[p.category] || '', CATALOG_FAMILIES[p.family], CATALOG_GENDERS[p.gender], ...p.notes
  ].join(' '))]));

  const subtitle = p => `${p.concentration} · ${CATALOG_CATEGORIES[p.category] || ''} · ${GENDER_ADJ[p.gender]}`;

  /* ---------- Estado persistente ---------- */
  const store = {
    read(key, fallback) {
      try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
    },
    write(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* almacenamiento no disponible */ }
    }
  };

  let favs = new Set(store.read('pluie-catalog-favs', []).filter(id => BY_ID.has(id)));
  let bag = store.read('pluie-catalog-bag', []).filter(line => {
    const p = BY_ID.get(line.id);
    return p && p.sizes.some(s => s.ml === line.ml) && Number.isInteger(line.qty) && line.qty > 0;
  });

  /* ---------- Estado de la vista (refleja la URL) ---------- */
  const state = { category: [], line: '', gender: [], family: '', price: [], brand: [], sort: 'featured', q: '', fav: false, product: null };
  let pdpSize = null;

  function readURL() {
    const params = new URLSearchParams(location.search);
    const list = key => (params.get(key) || '').split(',').filter(Boolean);
    state.category = list('category').filter(c => c in CATALOG_CATEGORIES);
    state.line = params.get('line') || '';
    state.gender = list('gender').filter(g => g in CATALOG_GENDERS);
    state.family = params.get('family') in CATALOG_FAMILIES ? params.get('family') : '';
    state.price = list('price').filter(id => PRICE_RANGES.some(r => r.id === id));
    state.brand = list('brand').filter(id => BRANDS.some(b => b.id === id));
    state.sort = SORTS.includes(params.get('sort')) ? params.get('sort') : 'featured';
    state.q = (params.get('q') || '').trim().slice(0, 80);
    state.fav = params.get('fav') === '1';
    state.product = BY_ID.has(params.get('p')) ? params.get('p') : null;
  }

  function buildURL() {
    const params = new URLSearchParams();
    if (state.product) {
      params.set('p', state.product);
    } else {
      if (state.q) params.set('q', state.q);
      if (state.fav) params.set('fav', '1');
      if (state.category.length) params.set('category', state.category.join(','));
      if (state.line) params.set('line', state.line);
      if (state.gender.length) params.set('gender', state.gender.join(','));
      if (state.family) params.set('family', state.family);
      if (state.price.length) params.set('price', state.price.join(','));
      if (state.brand.length) params.set('brand', state.brand.join(','));
      if (state.sort !== 'featured') params.set('sort', state.sort);
    }
    const query = params.toString().replace(/%2C/g, ',');
    return 'catalog.html' + (query ? '?' + query : '');
  }

  const writeURL = (push = false) => history[push ? 'pushState' : 'replaceState'](null, '', buildURL());

  /* ---------- Filtrado ---------- */
  function evaluate(p) {
    if (state.category.length && !state.category.includes(p.category)) return null;
    if (state.line && p.line !== state.line) return null;
    if (state.gender.length && !state.gender.includes(p.gender)) return null;
    if (state.family && p.family !== state.family) return null;
    if (state.brand.length && !state.brand.includes(slug(p.brand))) return null;
    if (state.fav && !favs.has(p.id)) return null;
    if (state.q) {
      const haystack = SEARCH_INDEX.get(p.id);
      if (!fold(state.q).split(/\s+/).every(token => haystack.includes(token))) return null;
    }
    let sizes = p.sizes;
    if (state.price.length) {
      sizes = sizes.filter(s => state.price.some(id => {
        const r = PRICE_RANGES.find(range => range.id === id);
        return s.price >= r.min && s.price <= r.max;
      }));
    }
    if (!sizes.length) return null;
    return { p, sizes, price: Math.min(...sizes.map(s => s.price)) };
  }

  function results() {
    const list = PRODUCTS.map(evaluate).filter(Boolean);
    const by = {
      featured: (a, b) => a.p.rank - b.p.rank,
      newest: (a, b) => b.p.added.localeCompare(a.p.added),
      'price-desc': (a, b) => b.price - a.price || a.p.rank - b.p.rank,
      'price-asc': (a, b) => a.price - b.price || a.p.rank - b.p.rank
    };
    return list.sort(by[state.sort]);
  }

  const activeFilterCount = () =>
    state.category.length + (state.line ? 1 : 0) + state.gender.length + state.price.length + (state.fav ? 1 : 0) + (state.q ? 1 : 0);

  function clearFilters() {
    Object.assign(state, { category: [], line: '', gender: [], family: '', price: [], brand: [], q: '', fav: false });
    searchInput.value = '';
  }

  /* ---------- Elementos DOM ---------- */
  const plp = $('#plp');
  const pdp = $('#pdp');
  const grid = $('#product-grid');
  const emptyState = $('#empty-state');
  const titleText = $('#plp-title-text');
  const countEl = $('#plp-count');
  const chips = $('#active-chips');
  const plpBody = $('#plp-body');
  const plpBar = $('#plp-bar');
  const filters = $('#filters');
  const filtersToggle = $('#filters-toggle');
  const filtersToggleLabel = $('#filters-toggle-label');
  const filtersApply = $('#filters-apply');
  const sortSelect = $('#sort-select');
  const searchForm = $('#search-form');
  const searchInput = $('#search-input');
  const scrim = $('#scrim');
  const drawer = $('#bag-drawer');
  const addedPop = $('#added-pop');

  /* ---------- Tarjeta de producto ---------- */
  function cardHTML(entry) {
    const { p, sizes, price } = entry;
    const isFav = favs.has(p.id);
    const isOOS = Boolean(p.outOfStock);
    const sizeText = p.sizes.length > 1 ? `${p.sizes.length} tamaños` : `${p.sizes[0].ml} ml`;
    const priceText = sizes.length > 1 ? `Desde ${money(price)}` : money(price);

    let badgeHTML = '';
    if (isOOS) {
      badgeHTML = `<span class="card-badge badge-oos">No disponible</span>`;
    } else if (p.badge) {
      badgeHTML = `<span class="card-badge">${esc(p.badge)}</span>`;
    }

    return `
      <li class="card${isOOS ? ' is-out-of-stock' : ''}">
        <a class="card-link" href="catalog.html?p=${p.id}">
          <div class="card-media${p.cutout ? ' is-cutout' : ''}" data-initial="${esc(p.name.charAt(0))}">
            <img src="${p.image}" alt="${esc(p.brand + ' ' + p.name)}" width="768" height="768" decoding="sync" />
            ${badgeHTML}
          </div>
          <div class="card-info">
            <p class="card-brand">${esc(p.brand)}</p>
            <p class="card-name">${esc(p.name)}</p>
            <p class="card-sub">${esc(subtitle(p))}</p>
            <p class="card-sub">${sizeText}</p>
            <p class="card-price">${priceText} ${isOOS ? '<span class="oos-tag">Agotado</span>' : ''}</p>
          </div>
        </a>
        <button class="fav-btn${isFav ? ' is-on' : ''}" data-fav="${p.id}" aria-pressed="${isFav}" aria-label="${isFav ? 'Quitar de' : 'Añadir a'} favoritos: ${esc(p.name)}">
          <svg class="icon" aria-hidden="true"><use href="#i-heart${isFav ? '-fill' : ''}"/></svg>
        </button>
      </li>`;
  }

  /* ---------- Barra lateral de filtros (Categoría, Género, Precio) ---------- */
  const GROUPS = [
    { key: 'category', label: 'Categoría', options: Object.entries(CATALOG_CATEGORIES).map(([id, label]) => ({ id, label })) },
    { key: 'gender', label: 'Género', options: Object.entries(CATALOG_GENDERS).map(([id, label]) => ({ id, label })) },
    { key: 'price', label: 'Comprar por precio', options: PRICE_RANGES }
  ];

  function buildFilters() {
    $('#filter-groups').innerHTML = GROUPS.map(g => `
      <details class="filter-group" open>
        <summary><span>${g.label} <span class="group-count" data-count="${g.key}"></span></span><svg class="icon" aria-hidden="true"><use href="#i-chevron"/></svg></summary>
        <div class="filter-options">
          ${g.options.map(o => `
            <label class="check">
              <input type="checkbox" data-group="${g.key}" value="${o.id}" />
              <span class="box" aria-hidden="true"><svg class="icon"><use href="#i-check"/></svg></span>
              <span>${o.label}</span>
            </label>`).join('')}
        </div>
      </details>`).join('');
  }

  function syncFilters() {
    $$('#filter-groups input').forEach(input => {
      input.checked = (state[input.dataset.group] || []).map(String).includes(input.value);
    });
    GROUPS.forEach(g => {
      const n = (state[g.key] || []).length;
      $(`[data-count="${g.key}"]`).textContent = n ? `(${n})` : '';
    });
    sortSelect.value = state.sort;
  }

  /* ---------- Renderizado de listado ---------- */
  function listingTitle() {
    if (state.q) return `Resultados para "${state.q}"`;
    if (state.fav) return 'Mis favoritos';

    if (state.line) {
      const allLines = [...(CATALOG_LINES.arabe || []), ...(CATALOG_LINES.disenador || []), ...(CATALOG_LINES.nicho || []), ...(CATALOG_LINES.all || [])];
      const match = allLines.find(l => l.id === state.line);
      const lineName = match ? match.label.replace(/^[^\w\s\u00C0-\u00FF]+\s*/, '').replace(/\s*\(\d+\)/, '') : 'Colección';
      if (state.category.length === 1) {
        return `${CATALOG_CATEGORIES[state.category[0]]} · ${lineName}`;
      }
      return lineName;
    }

    const cat = state.category.length === 1 ? CATALOG_CATEGORIES[state.category[0]] : '';
    const gender = state.gender.length === 1 ? CATALOG_GENDERS[state.gender[0]] : '';
    const family = state.family ? CATALOG_FAMILIES[state.family] : '';

    if (cat && !family && !gender) {
      if (cat === 'Árabe') return 'Fragancias árabes';
      if (cat === 'Diseñador') return 'Perfumería de diseñador';
      if (cat === 'Nicho') return 'Perfumes nicho y de autor';
      return `Perfumes ${cat}`;
    }

    if (!gender && !family && !cat) return state.sort === 'newest' && !activeFilterCount() ? 'Novedades' : 'Fragancias';
    const parts = [cat ? `Perfumes ${cat.toLowerCase()}s` : 'Fragancias', family ? family.toLowerCase() : '', gender ? `para ${gender.toLowerCase()}` : ''];
    return parts.filter(Boolean).join(' ');
  }

  function renderChips() {
    const list = [];
    if (state.q) list.push({ label: `"${state.q}"`, clear: () => { state.q = ''; searchInput.value = ''; } });
    if (state.fav) list.push({ label: 'Favoritos', clear: () => { state.fav = false; } });
    if (state.line) {
      const allLines = [...(CATALOG_LINES.arabe || []), ...(CATALOG_LINES.disenador || []), ...(CATALOG_LINES.nicho || []), ...(CATALOG_LINES.all || [])];
      const match = allLines.find(l => l.id === state.line);
      const lineLabel = match ? match.label.replace(/\s*\(\d+\)/, '') : state.line;
      list.push({ label: lineLabel, clear: () => { state.line = ''; applyFilterChange(); } });
    }
    state.category.forEach(c => list.push({ label: CATALOG_CATEGORIES[c], clear: () => { state.category = state.category.filter(x => x !== c); state.line = ''; } }));
    if (state.family) list.push({ label: CATALOG_FAMILIES[state.family], clear: () => { state.family = ''; } });
    state.gender.forEach(g => list.push({ label: CATALOG_GENDERS[g], clear: () => { state.gender = state.gender.filter(x => x !== g); } }));
    state.price.forEach(id => list.push({ label: PRICE_RANGES.find(r => r.id === id).label, clear: () => { state.price = state.price.filter(x => x !== id); } }));

    chips.hidden = !list.length;
    chips.innerHTML = list.map((c, i) =>
      `<button class="chip" data-chip="${i}" aria-label="Quitar filtro ${esc(c.label)}">${esc(c.label)}<svg class="icon" aria-hidden="true"><use href="#i-close"/></svg></button>`
    ).join('') + (list.length > 1 ? '<button class="text-btn chip-clear" data-chip="all">Borrar todo</button>' : '');
    chips._handlers = list;
  }

  /* ---------- Píldoras de Colecciones y Subcategorías ---------- */
  const pillsTrack = $('#pills-track');

  function renderPills() {
    if (!pillsTrack) return;

    const isArabe = state.category.length === 1 && state.category[0] === 'arabe';
    const isDisenador = state.category.length === 1 && state.category[0] === 'disenador';
    const isNicho = state.category.length === 1 && state.category[0] === 'nicho';

    let pillsData = [];

    if (isArabe) {
      pillsData = CATALOG_LINES.arabe || [];
    } else if (isDisenador) {
      pillsData = CATALOG_LINES.disenador || [];
    } else if (isNicho) {
      pillsData = CATALOG_LINES.nicho || [];
    } else {
      pillsData = CATALOG_LINES.all || [];
    }

    pillsTrack.innerHTML = pillsData.map(pill => {
      let count = 0;
      let isActive = false;

      if (pill.id === 'all') {
        isActive = !state.line;
        count = PRODUCTS.filter(p => {
          if (isArabe) return p.category === 'arabe';
          if (isDisenador) return p.category === 'disenador';
          if (isNicho) return p.category === 'nicho';
          return true;
        }).length;
      } else if (pill.id === 'arabe' || pill.id === 'cat-arabe') {
        isActive = state.category.includes('arabe') && !state.line;
        count = PRODUCTS.filter(p => p.category === 'arabe').length;
      } else if (pill.id === 'disenador' || pill.id === 'cat-disenador') {
        isActive = state.category.includes('disenador') && !state.line;
        count = PRODUCTS.filter(p => p.category === 'disenador').length;
      } else if (pill.id === 'nicho' || pill.id === 'cat-nicho') {
        isActive = state.category.includes('nicho') && !state.line;
        count = PRODUCTS.filter(p => p.category === 'nicho').length;
      } else {
        isActive = state.line === pill.id;
        count = PRODUCTS.filter(p => p.line === pill.id).length;
      }

      const emojiSpan = pill.emoji ? `<span class="pill-emoji">${pill.emoji}</span>` : '';
      const pillType = pill.id === 'all'
        ? 'all'
        : (pill.id.startsWith('cat-') || ['arabe', 'disenador', 'nicho'].includes(pill.id) ? 'cat' : 'line');

      return `
        <button class="pill-btn${isActive ? ' is-active' : ''}" 
                role="tab" 
                aria-selected="${isActive}" 
                data-pill-id="${pill.id}"
                data-pill-type="${pillType}">
          ${emojiSpan}
          <span>${pill.label}</span>
          ${count > 0 ? `<span class="pill-count">${count}</span>` : ''}
        </button>
      `;
    }).join('');
  }

  function renderListing() {
    const list = results();
    titleText.textContent = listingTitle();
    countEl.textContent = `(${list.length})`;
    grid.innerHTML = list.map(cardHTML).join('');
    emptyState.hidden = list.length > 0;
    if (!list.length) {
      $('.empty-title', emptyState).textContent = state.fav && activeFilterCount() === 1
        ? 'Aún no tienes fragancias en favoritos.'
        : 'No encontramos fragancias con estos filtros.';
      $('p:not(.empty-title)', emptyState).textContent = state.fav && activeFilterCount() === 1
        ? 'Toca el corazón en cualquier perfume para guardarlo aquí.'
        : 'Prueba eliminando un filtro o buscando otro término.';
    }
    filtersApply.textContent = `Ver resultados (${list.length})`;
    syncFilters();
    renderChips();
    renderPills();
  }

  /* ---------- Detalle de producto (PDP) ---------- */
  function relatedTo(p) {
    return PRODUCTS.filter(x => x.id !== p.id)
      .map(x => ({ x, score: (x.category === p.category ? 3 : 0) + (x.family === p.family ? 2 : 0) + (x.gender === p.gender ? 1 : 0) }))
      .sort((a, b) => b.score - a.score || a.x.rank - b.x.rank)
      .slice(0, 4)
      .map(({ x }) => ({ p: x, sizes: x.sizes, price: Math.min(...x.sizes.map(s => s.price)) }));
  }

  function renderPDP() {
    const p = BY_ID.get(state.product);
    if (pdp.dataset.id !== p.id) {
      pdpSize = p.sizes.length === 1 ? p.sizes[0].ml : null;
    }
    pdp.dataset.id = p.id;
    const isFav = favs.has(p.id);
    const isOOS = Boolean(p.outOfStock);
    const chosen = p.sizes.find(s => s.ml === pdpSize);
    const minPrice = Math.min(...p.sizes.map(s => s.price));
    const priceText = chosen ? money(chosen.price) : (p.sizes.length > 1 ? `Desde ${money(minPrice)}` : money(minPrice));

    let badgeHTML = '';
    if (isOOS) {
      badgeHTML = `<p class="pdp-badge badge-oos">● No disponible</p>`;
    } else if (p.badge) {
      badgeHTML = `<p class="pdp-badge">${esc(p.badge)}</p>`;
    }

    pdp.innerHTML = `
      <nav class="crumbs" aria-label="Ruta de navegación">
        <a href="catalog.html">Fragancias</a><span aria-hidden="true">/</span>
        <a href="catalog.html?category=${p.category}">${CATALOG_CATEGORIES[p.category] || 'Perfumes'}</a><span aria-hidden="true">/</span>
        <span aria-current="page">${esc(p.name)}</span>
      </nav>
      <div class="pdp-grid">
        <div class="pdp-media${p.cutout ? ' is-cutout' : ''}" data-initial="${esc(p.name.charAt(0))}">
          <img src="${p.image}" alt="${esc(p.brand + ' ' + p.name)}" width="768" height="768" decoding="sync" />
        </div>
        <div class="pdp-info">
          ${badgeHTML}
          <p class="pdp-brand">${esc(p.brand)}</p>
          <h1 class="pdp-name">${esc(p.name)}</h1>
          <p class="pdp-sub">${esc(subtitle(p))}</p>
          <p class="pdp-price" id="pdp-price">${priceText} ${isOOS ? '<span class="oos-tag">Agotado</span>' : ''}</p>

          <fieldset class="size-picker">
            <legend>Seleccionar tamaño</legend>
            <div class="size-grid">
              ${p.sizes.map(s => `
                <button type="button" class="size-opt${s.ml === pdpSize ? ' is-active' : ''}" data-size="${s.ml}" aria-pressed="${s.ml === pdpSize}">
                  <span>${s.ml} ml</span><span class="size-opt-price">${money(s.price)}</span>
                </button>`).join('')}
            </div>
            <p class="size-error" id="size-error" hidden>Selecciona un tamaño para añadir la fragancia a tu bolsa.</p>
          </fieldset>

          <div class="pdp-actions">
            ${isOOS ? `
              <button class="btn btn-solid btn-block btn-lg btn-disabled" id="pdp-add" disabled aria-disabled="true">
                No disponible
              </button>
              <button class="btn btn-outline btn-block btn-lg" id="pdp-notify-btn">
                <svg class="icon" aria-hidden="true"><use href="#i-heart"/></svg>
                Avisarme cuando esté disponible
              </button>
              <div class="oos-notify-msg" id="oos-notify-msg" hidden>
                ✓ Te notificaremos en cuanto tengamos nuevas unidades de esta fragancia.
              </div>
            ` : `
              <button class="btn btn-solid btn-block btn-lg" id="pdp-add">Añadir a la bolsa</button>
              <button class="btn btn-outline btn-block btn-lg" id="pdp-fav" aria-pressed="${isFav}">
                ${isFav ? 'Guardado en favoritos' : 'Favorito'}
                <svg class="icon" aria-hidden="true"><use href="#i-heart${isFav ? '-fill' : ''}"/></svg>
              </button>
            `}
          </div>

          <p class="pdp-desc">${esc(p.desc)}</p>

          <h2 class="pdp-h2">Notas olfativas</h2>
          <ul class="pdp-notes">${p.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>

          <dl class="pdp-facts">
            <div><dt>Categoría</dt><dd>${CATALOG_CATEGORIES[p.category] || 'Perfume'}</dd></div>
            <div><dt>Familia</dt><dd>${CATALOG_FAMILIES[p.family]}</dd></div>
            <div><dt>Concentración</dt><dd>${esc(p.concentration)}</dd></div>
            <div><dt>Para</dt><dd>${CATALOG_GENDERS[p.gender]}</dd></div>
          </dl>

          <details class="pdp-more">
            <summary>Envíos y devoluciones <svg class="icon" aria-hidden="true"><use href="#i-chevron"/></svg></summary>
            <p>Envío estándar gratis en compras mayores a ${money(FREE_SHIPPING_FROM)}. En pedidos menores el costo de envío es de ${money(SHIPPING_FEE)}. Frascos sellados cuentan con garantía de devolución de hasta 30 días.</p>
          </details>
        </div>
      </div>
      <section class="related" aria-labelledby="related-title">
        <h2 class="related-title" id="related-title">También te podría gustar</h2>
        <ul class="product-grid related-grid">${relatedTo(p).map(cardHTML).join('')}</ul>
      </section>`;
  }

  /* ---------- Renderizado general ---------- */
  function render() {
    const onProduct = Boolean(state.product);
    plp.hidden = onProduct;
    pdp.hidden = !onProduct;
    if (onProduct) {
      renderPDP();
      document.title = `${BY_ID.get(state.product).name} — A2M`;
    } else {
      pdp.dataset.id = '';
      renderListing();
      document.title = `${listingTitle()} — A2M`;
    }
    if (document.activeElement !== searchInput) searchInput.value = state.q;
    updateHeaderCounts();
  }

  function updateHeaderCounts() {
    const favCount = $('#fav-count');
    favCount.textContent = favs.size;
    favCount.hidden = favs.size === 0;
    $('#fav-view-btn').setAttribute('aria-label', `Favoritos (${favs.size})`);
    $('#fav-view-btn').classList.toggle('is-active', state.fav && !state.product);

    const items = bag.reduce((n, line) => n + line.qty, 0);
    const bagCount = $('#bag-count');
    bagCount.textContent = items;
    bagCount.hidden = items === 0;
    $('#bag-btn').setAttribute('aria-label', `Bolsa (${items} ${items === 1 ? 'artículo' : 'artículos'})`);
  }

  /* ---------- Navegación ---------- */
  function scrollToListing() {
    const top = plpBar.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
  }

  function navigate(href, { scroll = 'top' } = {}) {
    closeLayer();
    history.pushState(null, '', href);
    readURL();
    render();
    if (scroll === 'top') window.scrollTo(0, 0);
    if (scroll === 'listing') scrollToListing();
  }

  document.addEventListener('click', e => {
    const link = e.target.closest('a[href^="catalog.html"]');
    if (!link || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    navigate(link.getAttribute('href'), { scroll: link.closest('.campaign') ? 'listing' : 'top' });
  });

  window.addEventListener('popstate', () => {
    closeLayer();
    readURL();
    render();
  });

  /* ---------- Interacciones de listado ---------- */
  function applyFilterChange() {
    writeURL(false);
    renderListing();
    document.title = `${listingTitle()} — A2M`;
    updateHeaderCounts();
  }

  $('#filter-groups').addEventListener('change', e => {
    const input = e.target.closest('input[data-group]');
    if (!input) return;
    const key = input.dataset.group;
    const value = input.value;
    state[key] = input.checked ? [...state[key], value] : state[key].filter(v => v !== value);
    if (key === 'category') state.line = '';
    applyFilterChange();
  });

  if (pillsTrack) {
    pillsTrack.addEventListener('click', e => {
      const btn = e.target.closest('.pill-btn');
      if (!btn) return;
      const id = btn.dataset.pillId;
      const type = btn.dataset.pillType;

      if (type === 'all') {
        state.line = '';
      } else if (type === 'cat') {
        const catId = id.replace('cat-', '');
        state.category = [catId];
        state.line = '';
      } else if (type === 'line') {
        state.line = state.line === id ? '' : id;
        const prod = PRODUCTS.find(p => p.line === id);
        if (prod && !state.category.includes(prod.category)) {
          state.category = [prod.category];
        }
      }

      applyFilterChange();
    });
  }

  sortSelect.addEventListener('change', () => {
    state.sort = sortSelect.value;
    applyFilterChange();
  });

  chips.addEventListener('click', e => {
    const btn = e.target.closest('[data-chip]');
    if (!btn) return;
    if (btn.dataset.chip === 'all') clearFilters();
    else chips._handlers[Number(btn.dataset.chip)].clear();
    applyFilterChange();
  });

  $('#empty-clear').addEventListener('click', () => { clearFilters(); applyFilterChange(); });
  $('#filters-clear').addEventListener('click', () => { clearFilters(); applyFilterChange(); });
  $('#filters-apply').addEventListener('click', closeLayer);
  $('#filters-close').addEventListener('click', closeLayer);

  function syncFilterToggle() {
    if (mobileQuery.matches) {
      filtersToggleLabel.textContent = 'Filtros';
      filtersToggle.setAttribute('aria-expanded', String(openLayer === filters));
    } else {
      const hiddenNow = plpBody.classList.contains('filters-hidden');
      filtersToggleLabel.textContent = hiddenNow ? 'Mostrar filtros' : 'Ocultar filtros';
      filtersToggle.setAttribute('aria-expanded', String(!hiddenNow));
    }
  }

  filtersToggle.addEventListener('click', () => {
    if (mobileQuery.matches) {
      openLayerEl(filters, $('#filters-close'));
    } else {
      plpBody.classList.toggle('filters-hidden');
    }
    syncFilterToggle();
  });
  mobileQuery.addEventListener('change', () => { if (openLayer === filters) closeLayer(); syncFilterToggle(); });

  /* ---------- Búsqueda ---------- */
  let searchTimer = 0;
  function runSearch() {
    const q = searchInput.value.trim().slice(0, 80);
    const inCollection = document.body.dataset.view === 'collection';
    if (q === state.q && !state.product && !inCollection) return;
    state.q = q;
    if (inCollection && q && window.A2M_WIPE) {
      window.A2M_WIPE.wipeTo('catalog');
    }
    if (state.product) {
      state.product = null;
      writeURL(true);
      render();
      window.scrollTo(0, 0);
    } else {
      applyFilterChange();
    }
  }
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(runSearch, 220);
  });
  searchForm.addEventListener('submit', e => {
    e.preventDefault();
    clearTimeout(searchTimer);
    runSearch();
    if (!state.product) scrollToListing();
  });
  searchInput.addEventListener('keydown', e => {
    if (e.key === 'Escape' && searchInput.value) {
      e.stopPropagation();
      searchInput.value = '';
      runSearch();
    }
  });

  /* ---------- Favoritos ---------- */
  function toggleFav(id) {
    favs.has(id) ? favs.delete(id) : favs.add(id);
    store.write('pluie-catalog-favs', [...favs]);
  }

  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-fav]');
    if (!btn) return;
    e.preventDefault();
    const id = btn.dataset.fav;
    toggleFav(id);
    const on = favs.has(id);
    btn.classList.toggle('is-on', on);
    btn.setAttribute('aria-pressed', String(on));
    btn.setAttribute('aria-label', `${on ? 'Quitar' : 'Añadir'} ${BY_ID.get(id).name} ${on ? 'de' : 'a'} favoritos`);
    $('use', btn).setAttribute('href', on ? '#i-heart-fill' : '#i-heart');
    if (state.fav && !state.product) renderListing();
    updateHeaderCounts();
  });

  $('#fav-view-btn').addEventListener('click', () => {
    const inCollection = document.body.dataset.view === 'collection';
    if (inCollection && window.A2M_WIPE) {
      clearFilters();
      state.product = null;
      state.fav = true;
      render();
      window.A2M_WIPE.wipeTo('catalog');
      return;
    }
    const leaving = state.fav && !state.product;
    clearFilters();
    state.product = null;
    state.fav = !leaving;
    writeURL(true);
    render();
    scrollToListing();
  });

  /* ---------- Detalle de producto (Eventos) ---------- */
  pdp.addEventListener('click', e => {
    const sizeBtn = e.target.closest('[data-size]');
    if (sizeBtn) {
      pdpSize = Number(sizeBtn.dataset.size);
      const p = BY_ID.get(state.product);
      $$('.size-opt', pdp).forEach(b => {
        const on = Number(b.dataset.size) === pdpSize;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-pressed', String(on));
      });
      $('#pdp-price').textContent = money(p.sizes.find(s => s.ml === pdpSize).price);
      $('#size-error').hidden = true;
      $('.size-picker', pdp).classList.remove('has-error');
      return;
    }
    if (e.target.closest('#pdp-notify-btn')) {
      const msg = $('#oos-notify-msg');
      if (msg) {
        msg.hidden = false;
        const btn = e.target.closest('#pdp-notify-btn');
        btn.disabled = true;
        btn.textContent = '✓ Solicitud de aviso registrada';
      }
      return;
    }
    if (e.target.closest('#pdp-add')) {
      const p = BY_ID.get(state.product);
      if (p && p.outOfStock) return;
      if (pdpSize === null) {
        $('#size-error').hidden = false;
        $('.size-picker', pdp).classList.add('has-error');
        $('.size-opt', pdp).focus();
        return;
      }
      addToBag(state.product, pdpSize);
      return;
    }
    if (e.target.closest('#pdp-fav')) {
      toggleFav(state.product);
      renderPDP();
      updateHeaderCounts();
      $('#pdp-fav').focus();
    }
  });

  /* ---------- Bolsa de compras ---------- */
  function saveBag() { store.write('pluie-catalog-bag', bag); }

  function addToBag(id, ml) {
    const p = BY_ID.get(id);
    if (p && p.outOfStock) return;
    const line = bag.find(l => l.id === id && l.ml === ml);
    if (line) line.qty = Math.min(10, line.qty + 1);
    else bag.push({ id, ml, qty: 1 });
    saveBag();
    updateHeaderCounts();
    showAdded(id, ml);
  }

  function linePrice(line) {
    return BY_ID.get(line.id).sizes.find(s => s.ml === line.ml).price * line.qty;
  }

  function renderBag() {
    const list = $('#bag-list');
    const foot = $('#bag-foot');
    $('#checkout-note').hidden = true;
    if (!bag.length) {
      list.innerHTML = `
        <div class="bag-empty">
          <p>Tu bolsa de compras está vacía.</p>
          <a class="btn btn-solid" href="catalog.html">Ver catálogo</a>
        </div>`;
      foot.hidden = true;
      return;
    }
    foot.hidden = false;
    const subtotal = bag.reduce((sum, line) => sum + linePrice(line), 0);
    const shipping = subtotal >= FREE_SHIPPING_FROM ? 0 : SHIPPING_FEE;
    const missing = FREE_SHIPPING_FROM - subtotal;

    list.innerHTML = (missing > 0
      ? `<p class="ship-hint">Agrega ${money(missing)} más para envío gratis.</p>`
      : `<p class="ship-hint is-done">¡Tu pedido tiene envío gratis!</p>`) +
      bag.map((line, i) => {
        const p = BY_ID.get(line.id);
        return `
          <div class="line">
            <a class="line-media${p.cutout ? ' is-cutout' : ''}" href="catalog.html?p=${p.id}" data-initial="${esc(p.name.charAt(0))}"><img src="${p.image}" alt="" width="120" height="120" decoding="sync" /></a>
            <div class="line-info">
              <div class="line-top">
                <a class="line-name" href="catalog.html?p=${p.id}">${esc(p.name)}</a>
                <span class="line-price">${money(linePrice(line))}</span>
              </div>
              <p class="line-sub">${esc(p.brand)}</p>
              <p class="line-sub">${line.ml} ml</p>
              <div class="line-actions">
                <label class="qty">
                  <span>Cant.</span>
                  <select data-qty="${i}" aria-label="Cantidad para ${esc(p.name)} ${line.ml} ml">
                    ${Array.from({ length: 10 }, (_, n) => `<option value="${n + 1}"${n + 1 === line.qty ? ' selected' : ''}>${n + 1}</option>`).join('')}
                  </select>
                  <svg class="icon" aria-hidden="true"><use href="#i-chevron"/></svg>
                </label>
                <button class="text-btn" data-remove="${i}">Eliminar</button>
              </div>
            </div>
          </div>`;
      }).join('');

    $('#bag-subtotal').textContent = money(subtotal);
    $('#bag-shipping').textContent = shipping ? money(shipping) : 'Gratis';
    $('#bag-total').textContent = money(subtotal + shipping);
  }

  $('#bag-list').addEventListener('change', e => {
    const select = e.target.closest('[data-qty]');
    if (!select) return;
    bag[Number(select.dataset.qty)].qty = Number(select.value);
    saveBag();
    renderBag();
    updateHeaderCounts();
    $(`[data-qty="${select.dataset.qty}"]`)?.focus();
  });

  $('#bag-list').addEventListener('click', e => {
    const btn = e.target.closest('[data-remove]');
    if (!btn) return;
    bag.splice(Number(btn.dataset.remove), 1);
    saveBag();
    renderBag();
    updateHeaderCounts();
    $('#bag-close').focus();
  });

  $('#bag-btn').addEventListener('click', () => { renderBag(); openLayerEl(drawer, $('#bag-close')); });
  $('#bag-close').addEventListener('click', closeLayer);

  // CHECKOUT: VINCULACIÓN CON POSTGRESQL Y PEDIDOS
  $('#checkout-btn').addEventListener('click', async () => {
    if (!bag.length) return;

    const user = window.A2M_AUTH ? window.A2M_AUTH.getUser() : null;

    // 1. Si no está logueado, pedir DNI
    if (!user) {
      closeLayer();
      if (window.A2M_AUTH) {
        window.A2M_AUTH.openAccount('Para procesar tu compra, ingresa o regístrate con tu DNI.');
      }
      return;
    }

    // 2. Si no ha guardado dirección de envío, pedirla
    if (!user.ciudad || !user.direccion) {
      closeLayer();
      if (window.A2M_AUTH) {
        window.A2M_AUTH.openAccount('Por favor completa tu dirección de entrega para despachar tu compra.');
      }
      return;
    }

    // 3. Crear orden
    const checkoutBtn = $('#checkout-btn');
    const noteEl = $('#checkout-note');
    const prevText = checkoutBtn.innerHTML;
    checkoutBtn.disabled = true;
    checkoutBtn.innerHTML = '<span>Procesando orden...</span>';
    if (noteEl) noteEl.hidden = true;

    try {
      const items = bag.map(line => {
        const p = BY_ID.get(line.id);
        const size = p.sizes.find(s => s.ml === line.ml) || p.sizes[0];
        return {
          id: p.id,
          name: p.name,
          brand: p.brand,
          ml: line.ml,
          price: size.price,
          qty: line.qty,
          image: p.image
        };
      });

      const subtotal = items.reduce((sum, it) => sum + (it.price * it.qty), 0);
      const shipping = subtotal >= FREE_SHIPPING_FROM ? 0 : SHIPPING_FEE;

      const res = await fetch('/api/pedidos/crear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          costoEnvio: shipping,
          metodoPago: 'PENDIENTE'
        })
      });

      const data = await res.json();
      if (res.ok && data.ok && data.pedido) {
        bag = [];
        saveBag();
        renderBag();
        updateHeaderCounts();
        closeLayer();
        syncProductsFromPostgreSQL();

        if (window.A2M_AUTH && window.A2M_AUTH.showOrderConfirmation) {
          window.A2M_AUTH.showOrderConfirmation(data.pedido);
        }
      } else if (noteEl) {
        noteEl.textContent = data.error || 'No se pudo procesar tu pedido.';
        noteEl.hidden = false;
      }
    } catch {
      if (noteEl) {
        noteEl.textContent = 'Error de conexión al procesar el pedido.';
        noteEl.hidden = false;
      }
    } finally {
      checkoutBtn.disabled = false;
      checkoutBtn.innerHTML = prevText;
    }
  });

  /* ---------- Popover de confirmación ---------- */
  let addedTimer = 0;
  function showAdded(id, ml) {
    const p = BY_ID.get(id);
    const size = p.sizes.find(s => s.ml === ml);
    $('#added-pop-item').innerHTML = `
      <div class="added-media${p.cutout ? ' is-cutout' : ''}" data-initial="${esc(p.name.charAt(0))}"><img src="${p.image}" alt="" width="96" height="96" /></div>
      <div>
        <p class="added-name">${esc(p.name)}</p>
        <p class="added-sub">${esc(p.brand)}</p>
        <p class="added-sub">${ml} ml</p>
        <p class="added-price">${money(size.price)}</p>
      </div>`;
    document.body.classList.remove('header-hidden');
    addedPop.hidden = false;
    requestAnimationFrame(() => addedPop.classList.add('is-open'));
    clearTimeout(addedTimer);
    addedTimer = setTimeout(hideAdded, 5000);
  }
  function hideAdded() {
    clearTimeout(addedTimer);
    addedPop.classList.remove('is-open');
    setTimeout(() => { if (!addedPop.classList.contains('is-open')) addedPop.hidden = true; }, 220);
  }
  $('#added-close').addEventListener('click', hideAdded);
  $('#added-view-bag').addEventListener('click', () => { hideAdded(); renderBag(); openLayerEl(drawer, $('#bag-close')); });
  addedPop.addEventListener('mouseenter', () => clearTimeout(addedTimer));
  addedPop.addEventListener('mouseleave', () => { addedTimer = setTimeout(hideAdded, 2500); });

  /* ---------- Capas modales (Bolsa y filtros móviles) ---------- */
  let openLayer = null;
  let returnFocus = null;
  let layerTimer = 0;

  function openLayerEl(el, focusEl) {
    if (openLayer === el) return;
    closeLayer(false);
    clearTimeout(layerTimer);
    returnFocus = document.activeElement;
    openLayer = el;
    el.hidden = false;
    scrim.hidden = false;
    document.body.classList.add('no-scroll');
    requestAnimationFrame(() => {
      el.classList.add('is-open');
      scrim.classList.add('is-open');
      focusEl?.focus();
    });
  }

  function closeLayer(restoreFocus = true) {
    if (!openLayer) return;
    const el = openLayer;
    openLayer = null;
    el.classList.remove('is-open');
    scrim.classList.remove('is-open');
    document.body.classList.remove('no-scroll');
    layerTimer = setTimeout(() => {
      if (openLayer) return;
      scrim.hidden = true;
      if (el === drawer) drawer.hidden = true;
    }, 300);
    if (restoreFocus && returnFocus && document.contains(returnFocus)) returnFocus.focus();
    syncFilterToggle();
  }

  scrim.addEventListener('click', () => closeLayer());

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (openLayer) closeLayer();
      else if (!addedPop.hidden) hideAdded();
      return;
    }
    if (e.key === 'Tab' && openLayer) {
      const focusable = $$('a[href], button:not([disabled]), select, input', openLayer).filter(el => el.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  /* ---------- Cabecera dinámica según scroll ---------- */
  let lastY = window.scrollY;
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    if (Math.abs(y - lastY) < 6) return;
    const hide = y > lastY && y > 160 && addedPop.hidden;
    document.body.classList.toggle('header-hidden', hide);
    lastY = y;
  }, { passive: true });

  /* ---------- Fallback para imágenes no cargadas ---------- */
  document.addEventListener('error', e => {
    if (e.target.tagName !== 'IMG') return;
    const holder = e.target.closest('[data-initial]');
    if (holder) holder.classList.add('img-missing');
  }, true);

  /* ---------- Inicialización ---------- */
  buildFilters();
  readURL();
  render();
  syncFilterToggle();

  // Sincronizar catálogo en tiempo real con PostgreSQL
  function parsePgNotes(rawNotes, fallback = []) {
    if (Array.isArray(rawNotes)) return rawNotes.filter(Boolean);
    if (typeof rawNotes === 'string' && rawNotes.trim()) {
      try {
        const parsed = JSON.parse(rawNotes);
        if (Array.isArray(parsed)) return parsed.filter(Boolean);
      } catch {
        return rawNotes.split(',').map(s => s.trim()).filter(Boolean);
      }
    }
    return fallback;
  }

  function updateSearchIndexFor(prod) {
    SEARCH_INDEX.set(prod.id, fold([
      prod.name, prod.brand, prod.concentration,
      CATALOG_CATEGORIES[prod.category] || '',
      CATALOG_FAMILIES[prod.family] || '',
      CATALOG_GENDERS[prod.gender] || '',
      ...(prod.notes || [])
    ].join(' ')));
  }

  async function syncProductsFromPostgreSQL() {
    try {
      const res = await fetch('/api/productos');
      const data = await res.json();
      if (res.ok && data.ok && Array.isArray(data.productos) && data.productos.length) {
        const pgIds = new Set(data.productos.map(p => p.id));

        // Quitar del catálogo público los perfumes eliminados desde el Admin
        for (let i = PRODUCTS.length - 1; i >= 0; i--) {
          const item = PRODUCTS[i];
          if (!pgIds.has(item.id)) {
            BY_ID.delete(item.id);
            SEARCH_INDEX.delete(item.id);
            PRODUCTS.splice(i, 1);
          }
        }

        data.productos.forEach(pgP => {
          const local = BY_ID.get(pgP.id);
          const priceNum = parseFloat(pgP.precio_soles);
          const parsedNotes = parsePgNotes(pgP.notas, local ? local.notes : []);
          const parsedSizes = Array.isArray(pgP.sizes) && pgP.sizes.length
            ? pgP.sizes.map(s => ({ ml: Number(s.ml) || 100, price: parseFloat(s.price) || priceNum }))
            : [{ ml: pgP.tamanio_ml || 100, price: priceNum }];
          if (parsedSizes[0]) parsedSizes[0].price = priceNum;

          if (local) {
            local.name = pgP.nombre || local.name;
            local.brand = pgP.marca || local.brand;
            local.category = pgP.categoria || local.category;
            if (pgP.linea) local.line = pgP.linea;
            local.concentration = pgP.concentracion || local.concentration;
            local.gender = pgP.genero || local.gender;
            local.family = pgP.familia || local.family;
            local.image = pgP.imagen_url || local.image;
            if (pgP.badge !== undefined && pgP.badge !== null) local.badge = pgP.badge;
            if (pgP.descripcion) local.desc = pgP.descripcion;
            if (parsedNotes.length) local.notes = parsedNotes;
            local.sizes = parsedSizes;
            local.stock = pgP.stock;
            local.outOfStock = Boolean(pgP.agotado || pgP.stock <= 0);
            updateSearchIndexFor(local);
          } else {
            const newProd = {
              id: pgP.id,
              name: pgP.nombre,
              brand: pgP.marca,
              category: pgP.categoria,
              line: pgP.linea || '',
              concentration: pgP.concentracion || 'Eau de parfum',
              gender: pgP.genero || 'unisex',
              family: pgP.familia || 'gourmand',
              sizes: parsedSizes,
              image: pgP.imagen_url || 'assets/catalog/khamrah.webp',
              badge: pgP.badge || '',
              rank: PRODUCTS.length + 1,
              added: pgP.created_at ? String(pgP.created_at).slice(0, 10) : '2026-11-06',
              stock: pgP.stock,
              outOfStock: Boolean(pgP.agotado || pgP.stock <= 0),
              notes: parsedNotes,
              desc: pgP.descripcion || ''
            };
            PRODUCTS.push(newProd);
            BY_ID.set(newProd.id, newProd);
            updateSearchIndexFor(newProd);
          }

          const brandSlug = slug(pgP.marca || '');
          if (brandSlug && !BRANDS.some(b => b.id === brandSlug)) {
            BRANDS.push({ id: brandSlug, label: pgP.marca });
          }
        });

        readURL();
        render();
      }
    } catch {
      // Silencioso: usa catálogo base si la API tarda
    }
  }
  syncProductsFromPostgreSQL();

  window.A2M_CATALOG = {
    addToBag,
    openBag: () => { renderBag(); openLayerEl(drawer, $('#bag-close')); },
    refreshProducts: syncProductsFromPostgreSQL
  };
})();
