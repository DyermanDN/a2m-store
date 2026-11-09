const FRAGRANCES = [
  {
    "id": "lost-cherry",
    "name": "Lost Cherry",
    "price": 405,
    "notes": [
      "Cereza negra",
      "Almendra amarga",
      "Rosa",
      "Haba tonka tostada"
    ],
    "desc": "La cereza negra y la almendra amarga se abren hacia un corazón floral exquisito. Un fondo cálido de haba tonka y maderas nobles aporta profundidad a este gourmand de autor.",
    "glowColor": [
      212,
      120,
      105
    ],
    "index": 0,
    "category": "TOM FORD · EAU DE PARFUM",
    "prices": {
      "50ml": 405
    },
    "defaultSize": "50ml"
  },
  {
    "id": "rose-prick",
    "name": "Rose Prick",
    "price": 405,
    "notes": [
      "Rosa de Bulgaria",
      "Pimienta de Sichuan",
      "Pachulí",
      "Haba tonka"
    ],
    "desc": "Un ramo de rosas contrastado con pimienta de Sichuan y suavizado por la calidez del haba tonka. El pachulí aporta un elegante contrapunto terroso.",
    "glowColor": [
      230,
      190,
      172
    ],
    "index": 1,
    "category": "TOM FORD · EAU DE PARFUM",
    "prices": {
      "50ml": 405
    },
    "defaultSize": "50ml"
  },
  {
    "id": "tobacco-vanille",
    "name": "Tobacco Vanille",
    "price": 300,
    "notes": [
      "Hoja de tabaco",
      "Vainilla",
      "Cacao",
      "Haba tonka"
    ],
    "desc": "Tabaco especiado combinado con cremosa vainilla y notas de cacao. Rico, cálido y envolvente, con la atmósfera sosegada de un salón privado al anochecer.",
    "glowColor": [
      224,
      177,
      114
    ],
    "index": 2,
    "category": "TOM FORD · EAU DE PARFUM",
    "prices": {
      "50ml": 300
    },
    "defaultSize": "50ml"
  },
  {
    "id": "neroli-portofino",
    "name": "Neroli Portofino",
    "price": 300,
    "notes": [
      "Neroli",
      "Bergamota",
      "Mandarina",
      "Azahar"
    ],
    "desc": "Cítricos vibrantes y neroli que evocan la luz de la Riviera Italiana. La flor de azahar brinda a esta composición fresca un delicado acabado floral.",
    "glowColor": [
      130,
      199,
      214
    ],
    "index": 3,
    "category": "TOM FORD · EAU DE PARFUM",
    "prices": {
      "50ml": 300
    },
    "defaultSize": "50ml"
  },
  {
    "id": "oud-wood",
    "name": "Oud Wood",
    "price": 300,
    "notes": [
      "Oud",
      "Cardamomo",
      "Sándalo",
      "Ámbar"
    ],
    "desc": "Maderas ahumadas y cardamomo que dan paso a una base ambarina y acogedora. Una composición sofisticada de textura rica y calidez persistente.",
    "glowColor": [
      179,
      194,
      169
    ],
    "index": 4,
    "category": "TOM FORD · EAU DE PARFUM",
    "prices": {
      "50ml": 300
    },
    "defaultSize": "50ml"
  }
];

// State
let litBayIndex = -1;
let selectedBayIndex = null; // Currently zoomed-in bottle index (null when in gallery overview)
let selectedSize = '50ml';
let bag = [];
let autoTourTimer = null;
let isAutoTour = false;

// DOM Elements
const viewport = document.getElementById('gallery-viewport');
const cameraStage = document.getElementById('camera-stage');
const bays = Array.from(document.querySelectorAll('.fragrance-bay'));
const detailCard = document.getElementById('detail-card');
const detailCategory = document.getElementById('detail-category');
const detailTitle = document.getElementById('detail-title');
const detailDesc = document.getElementById('detail-desc');
const detailNotes = document.getElementById('detail-notes');
const detailPrice = document.getElementById('detail-price');
const addToBagBtn = document.getElementById('add-to-bag-btn');
const detailCloseBtn = document.getElementById('detail-close');
const backGalleryBtn = document.getElementById('back-gallery-btn');
const sizeBtns = Array.from(document.querySelectorAll('.size-btn'));
const bagCountEl = document.getElementById('bag-count');
const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
const bayPrices = bays.map(bay => bay.querySelector('.plinth-price'));
const displays = bays.map(bay => bay.querySelector('.product-display'));
let geometry = [];
let sceneSize = {width:innerWidth, height:innerHeight};
let resizeFrame = 0;

// Layout offsets are independent of the camera transform. Measure only at
// startup/resizing, never reset a running transform to measure on a click.
function measureScene() {
  sceneSize = {width:viewport.clientWidth, height:viewport.clientHeight};
  geometry = bays.map(bay => {
    const bottle = bay.querySelector('.bottle-stage');
    let x = 0, y = 0, node = bottle;
    while (node && node !== cameraStage) {
      x += node.offsetLeft;
      y += node.offsetTop;
      node = node.offsetParent;
    }
    return {x:x + bottle.offsetWidth / 2, y:y + bottle.offsetHeight * .67,
      originX:x + bottle.offsetWidth / 2,
      originY:y + bay.querySelector('.product-display').offsetHeight / 2,
      height:bottle.offsetHeight};
  });
}

/* =========================================================
   SPOTLIGHT & CAMERA ZOOM CONTROLLER
   ========================================================= */
function setSpotlight(index) {
  if (index === litBayIndex || !bays[index]) return;
  bays[litBayIndex]?.classList.remove('is-lit');
  litBayIndex = index;
  bays[index].classList.add('is-lit');
}

function selectFragrance(index) {
  const item = FRAGRANCES[index];
  if (!item) return;

  if (selectedBayIndex !== null && selectedBayIndex !== index) {
    displays[selectedBayIndex].style.transform = '';
    bays[selectedBayIndex].classList.remove('is-selected');
    bays[selectedBayIndex].setAttribute('aria-expanded', 'false');
  }
  selectedBayIndex = index;
  selectedSize = item.defaultSize;
  setSpotlight(index);

  bays[index].classList.add('is-selected');
  bays[index].setAttribute('aria-expanded', 'true');
  viewport.classList.add('is-zoomed');

  // Populate Detail Card
  detailCategory.textContent = item.category;
  detailTitle.textContent = item.name;
  detailDesc.textContent = item.desc;
  detailNotes.innerHTML = item.notes
    .map(n => `<span class="note-pill">${n}</span>`)
    .join('');

  updateSizeUI();
  detailCard.classList.add('is-visible');

  // Immediate state update. A later close cannot be overwritten by a queued zoom.
  applyCameraZoom(index);
  syncRain();
}

function applyCameraZoom(index) {
  if (index === null) {
    displays.forEach(display => { display.style.transform = ''; });
    return;
  }

  const focus = geometry[index];
  if (!focus) return;
  const {width:vw, height:vh} = sceneSize;
  const isMobile = vw <= 900;
  const scale = isMobile ? 1.3 : Math.min(1.65, vh / 450);
  const focusX = focus.x;
  const focusY = focus.y;
  const desiredScreenX = isMobile ? vw * .5 : (vw - 420) * .5;
  const desiredScreenY = isMobile ? vh * .28 : vh * .49;

  const originX = focus.originX;
  const originY = focus.originY;

  const tx = desiredScreenX - originX - (focusX - originX) * scale;
  const ty = desiredScreenY - originY - (focusY - originY) * scale;

  displays[index].style.transform = `translate3d(${tx.toFixed(1)}px, ${ty.toFixed(1)}px, 0px) scale(${scale})`;
}

function closeDetailView() {
  if (selectedBayIndex === null) return;
  displays[selectedBayIndex].style.transform = '';
  selectedBayIndex = null;
  viewport.classList.remove('is-zoomed');
  detailCard.classList.remove('is-visible');
  bays.forEach(bay => { bay.classList.remove('is-selected'); bay.setAttribute('aria-expanded', 'false'); });
  syncRain();
}

function updateSizeUI() {
  if (selectedBayIndex === null) return;
  const item = FRAGRANCES[selectedBayIndex];
  const price = item.prices[selectedSize];

  sizeBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.size === selectedSize);
  });

  detailPrice.textContent = `S/ ${price}`;
  bayPrices[selectedBayIndex].textContent = `S/ ${price}`;
  addToBagBtn.textContent = `Añadir a la bolsa — S/ ${price}`;
}

/* =========================================================
   EVENT LISTENERS FOR BAYS & CONTROLS
   ========================================================= */
bays.forEach((bay, index) => {
  bay.addEventListener('mouseenter', () => {
    if (selectedBayIndex === null && !isAutoTour) {
      setSpotlight(index);
    }
  });

  bay.addEventListener('focus', () => {
    if (selectedBayIndex === null) {
      setSpotlight(index);
    }
  });

  bay.addEventListener('click', (e) => {
    e.stopPropagation();
    stopAutoTour();
    if (selectedBayIndex === index) {
      closeDetailView();
    } else {
      selectFragrance(index);
    }
  });

  bay.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      stopAutoTour();
      if (selectedBayIndex === index) {
        closeDetailView();
      } else {
        selectFragrance(index);
      }
    }
  });
});

// Clicking background when zoomed out/in
viewport.addEventListener('click', (e) => {
  if (selectedBayIndex !== null && !e.target.closest('.detail-card')) {
    stopAutoTour();
    closeDetailView();
  }
});

detailCloseBtn.addEventListener('click', () => { stopAutoTour(); closeDetailView(); });
backGalleryBtn.addEventListener('click', () => { stopAutoTour(); closeDetailView(); });

sizeBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    selectedSize = btn.dataset.size;
    updateSizeUI();
  });
});

// Keyboard navigation (Left/Right arrows, Escape)
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    stopAutoTour();
    closeAllModals();
    if (selectedBayIndex !== null) closeDetailView();
  } else if (e.key === 'ArrowRight') {
    if (Object.values(modals).some(m => m.classList.contains('is-open'))) return;
    e.preventDefault();
    stopAutoTour();
    const next = ((selectedBayIndex ?? litBayIndex) + 1) % FRAGRANCES.length;
    if (selectedBayIndex !== null) {
      selectFragrance(next);
    } else {
      setSpotlight(next);
    }
  } else if (e.key === 'ArrowLeft') {
    if (Object.values(modals).some(m => m.classList.contains('is-open'))) return;
    e.preventDefault();
    stopAutoTour();
    const prev = ((selectedBayIndex ?? litBayIndex) - 1 + FRAGRANCES.length) % FRAGRANCES.length;
    if (selectedBayIndex !== null) {
      selectFragrance(prev);
    } else {
      setSpotlight(prev);
    }
  }
});

function scheduleResize() {
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(() => {
    measureScene();
    resizeRain();
    if (selectedBayIndex !== null) applyCameraZoom(selectedBayIndex);
    syncRain();
  });
}
window.addEventListener('resize', scheduleResize, {passive:true});
new ResizeObserver(scheduleResize).observe(viewport);

/* =========================================================
   AUTO-TOUR DEMO MODE (REPRODUCES REEL CHOREOGRAPHY)
   ========================================================= */
const tourBtn = document.getElementById('tour-toggle-btn');

function startAutoTour() {
  if (isAutoTour) return;
  isAutoTour = true;
  if (tourBtn) {
    tourBtn.classList.add('is-playing');
    const label = tourBtn.querySelector('.tour-label');
    if (label) label.textContent = 'Pausar recorrido';
  }

  const sequence = [
    () => { closeDetailView(); setSpotlight(2); },
    () => { setSpotlight(1); },
    () => { selectFragrance(1); },
    () => { closeDetailView(); setSpotlight(0); },
    () => { selectFragrance(0); },
    () => { closeDetailView(); setSpotlight(2); },
    () => { selectFragrance(2); },
    () => { closeDetailView(); setSpotlight(3); },
    () => { selectFragrance(4); }
  ];

  let step = 0;
  sequence[step]();
  autoTourTimer = setInterval(() => {
    step = (step + 1) % sequence.length;
    sequence[step]();
  }, 2400);
}

function stopAutoTour() {
  if (!isAutoTour) return;
  isAutoTour = false;
  clearInterval(autoTourTimer);
  autoTourTimer = null;
  if (tourBtn) {
    tourBtn.classList.remove('is-playing');
    const label = tourBtn.querySelector('.tour-label');
    if (label) label.textContent = 'Recorrido guiado';
  }
}

if (tourBtn) {
  tourBtn.addEventListener('click', () => {
    if (isAutoTour) stopAutoTour();
    else startAutoTour();
  });
}

/* =========================================================
   SHOPPING BAG & NAVIGATION MODALS (UNIFIED WITH CATALOG BAG)
   ========================================================= */
function renderBag() {
  // Unified bag state is managed by catalog.js
}

addToBagBtn.addEventListener('click', () => {
  if (selectedBayIndex === null) return;
  const item = FRAGRANCES[selectedBayIndex];
  const mlNum = parseInt(selectedSize, 10) || 50;

  if (window.A2M_CATALOG && typeof window.A2M_CATALOG.addToBag === 'function') {
    window.A2M_CATALOG.addToBag(item.id, mlNum);
  }

  const originalText = addToBagBtn.textContent;
  addToBagBtn.textContent = 'Añadido a la bolsa ✓';
  setTimeout(() => {
    if (selectedBayIndex !== null) updateSizeUI();
    else addToBagBtn.textContent = originalText;
  }, 1100);
});

// Modals (Bag)
const modals = {
  maison: document.getElementById('modal-maison'),
  boutiques: document.getElementById('modal-boutiques'),
  bag: document.getElementById('modal-bag')
};

function closeAllModals() {
  stopAutoTour();
  Object.values(modals).filter(Boolean).forEach(m => m.classList.remove('is-open'));
  syncRain();
}

const openBagBtn = document.getElementById('open-bag-btn');
if (openBagBtn) {
  openBagBtn.addEventListener('click', () => {
    closeAllModals();
    renderBag();
    if (modals.bag) modals.bag.classList.add('is-open');
    syncRain();
  });
}

document.getElementById('brand-home-btn').addEventListener('click', () => {
  stopAutoTour();
  closeAllModals();
  closeDetailView();
  setSpotlight(2);
});

document.querySelectorAll('[data-close-modal]').forEach(btn => {
  btn.addEventListener('click', closeAllModals);
});

Object.values(modals).filter(Boolean).forEach(modal => {
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeAllModals();
  });
});

/* =========================================================
   WEB AUDIO API: PROCEDURAL RAIN & GALLERY AMBIANCE
   ========================================================= */
let audioCtx = null;
let isSoundPlaying = false;
let masterGain = null;
const soundBtn = document.getElementById('sound-toggle-btn');

function toggleRainSound() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContextClass();

    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.01;
    masterGain.connect(audioCtx.destination);

    // Create 3-second looping stereo pink-filtered rain noise buffer
    const bufferSize = audioCtx.sampleRate * 3;
    const noiseBuffer = audioCtx.createBuffer(2, bufferSize, audioCtx.sampleRate);

    for (let chIdx = 0; chIdx < 2; chIdx++) {
      const output = noiseBuffer.getChannelData(chIdx);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.025;
        b6 = white * 0.115926;
      }
    }

    const rainSource = audioCtx.createBufferSource();
    rainSource.buffer = noiseBuffer;
    rainSource.loop = true;

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1150;
    filter.Q.value = 0.65;

    rainSource.connect(filter);
    filter.connect(masterGain);
    rainSource.start(0);

    // Subtle warm harmonic drone pad (D minor 9th whisper)
    [146.83, 220.0, 261.63, 329.63].forEach((freq) => {
      const osc = audioCtx.createOscillator();
      const oscGain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      oscGain.gain.value = 0.012;
      osc.connect(oscGain);
      oscGain.connect(masterGain);
      osc.start();
    });
  }

  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  isSoundPlaying = !isSoundPlaying;
  if (soundBtn) {
    soundBtn.classList.toggle('is-playing', isSoundPlaying);
    soundBtn.setAttribute('aria-pressed', String(isSoundPlaying));
  }

  const now = audioCtx.currentTime;
  masterGain.gain.cancelScheduledValues(now);
  masterGain.gain.setValueAtTime(masterGain.gain.value, now);
  masterGain.gain.linearRampToValueAtTime(isSoundPlaying ? 0.32 : 0.0001, now + 0.6);
}

if (soundBtn) soundBtn.addEventListener('click', toggleRainSound);

// Initialize geometry once before accepting interactions.
measureScene();
setSpotlight(2);
initializeRain();
