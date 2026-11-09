(() => {
  'use strict';

  const switcher = document.getElementById('segmented-switch');
  const btnCollection = document.getElementById('btn-collection');
  const btnCatalog = document.getElementById('btn-catalog');
  const wipeLine = document.getElementById('wipe-line');
  const catalogPane = document.getElementById('view-catalog');
  const brandLogo = document.getElementById('brand-home-btn');

  if (!switcher || !btnCollection || !btnCatalog || !wipeLine || !catalogPane) return;

  const initialView = document.body.dataset.view || 'collection';
  document.documentElement.dataset.view = initialView;

  let isWiping = false;
  let activeCatalogAnim = null;
  let activeLineAnim = null;

  // Snappy luxury timing: 320ms with Apple-grade exponential ease-out
  const DURATION = 320;
  const EASING = 'cubic-bezier(0.16, 1, 0.3, 1)';

  function applyViewImmediate(view) {
    document.documentElement.dataset.view = view;
    document.body.dataset.view = view;
    switcher.dataset.active = view;
    btnCollection.classList.toggle('is-active', view === 'collection');
    btnCatalog.classList.toggle('is-active', view === 'catalog');
    btnCollection.setAttribute('aria-selected', String(view === 'collection'));
    btnCatalog.setAttribute('aria-selected', String(view === 'catalog'));

    if (view === 'catalog') {
      catalogPane.style.clipPath = 'none';
      catalogPane.style.pointerEvents = 'auto';
    } else {
      catalogPane.style.clipPath = 'inset(0 100% 0 0)';
      catalogPane.style.pointerEvents = 'none';
      window.scrollTo(0, 0);
    }
    if (window.syncRain) window.syncRain();
  }

  async function wipeTo(targetView) {
    if (isWiping) return;
    const currentView = document.body.dataset.view || 'collection';
    if (targetView === currentView) {
      if (targetView === 'catalog') window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    isWiping = true;
    document.body.classList.add('is-wiping');

    // Pause canvas rain to save GPU bandwidth during wipe
    if (window.syncRain) window.syncRain();

    // Trigger sliding pill immediately
    switcher.dataset.active = targetView;
    btnCollection.classList.toggle('is-active', targetView === 'collection');
    btnCatalog.classList.toggle('is-active', targetView === 'catalog');
    btnCollection.setAttribute('aria-selected', String(targetView === 'collection'));
    btnCatalog.setAttribute('aria-selected', String(targetView === 'catalog'));

    const toCatalog = targetView === 'catalog';

    // Hardware-accelerated keyframes:
    // toCatalog: reveals catalog left-to-right (0% to 100%)
    // toCollection: peels catalog right-to-left (100% to 0%)
    const catalogKeyframes = toCatalog
      ? [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)' }]
      : [{ clipPath: 'inset(0 0% 0 0)' }, { clipPath: 'inset(0 100% 0 0)' }];

    const lineKeyframes = toCatalog
      ? [{ transform: 'translate3d(0, 0, 0)' }, { transform: 'translate3d(100vw, 0, 0)' }]
      : [{ transform: 'translate3d(100vw, 0, 0)' }, { transform: 'translate3d(0, 0, 0)' }];

    const animOptions = {
      duration: DURATION,
      easing: EASING,
      fill: 'forwards'
    };

    // Offload both animations directly to GPU compositor thread
    activeCatalogAnim = catalogPane.animate(catalogKeyframes, animOptions);
    activeLineAnim = wipeLine.animate(lineKeyframes, animOptions);

    try {
      await Promise.all([activeCatalogAnim.finished, activeLineAnim.finished]);
    } catch {
      // Handled if cancelled
    }

    activeCatalogAnim.cancel();
    activeLineAnim.cancel();

    // Set final settled states
    document.documentElement.dataset.view = targetView;
    document.body.dataset.view = targetView;
    document.body.classList.remove('is-wiping');

    if (toCatalog) {
      catalogPane.style.clipPath = 'none';
      catalogPane.style.pointerEvents = 'auto';
    } else {
      catalogPane.style.clipPath = 'inset(0 100% 0 0)';
      catalogPane.style.pointerEvents = 'none';
      window.scrollTo(0, 0);
    }

    history.pushState(null, '', toCatalog ? 'catalog.html' : 'index.html');

    // Resume rain if back in collection
    if (window.syncRain) window.syncRain();

    isWiping = false;
  }

  btnCollection.addEventListener('click', (e) => {
    e.preventDefault();
    wipeTo('collection');
  });

  btnCatalog.addEventListener('click', (e) => {
    e.preventDefault();
    wipeTo('catalog');
  });

  if (brandLogo) {
    brandLogo.addEventListener('click', (e) => {
      e.preventDefault();
      wipeTo('collection');
    });
  }

  window.addEventListener('popstate', () => {
    const isCat = location.pathname.endsWith('catalog.html') || location.search.includes('view=catalog');
    wipeTo(isCat ? 'catalog' : 'collection');
  });

  window.A2M_WIPE = { wipeTo, applyViewImmediate };
})();
