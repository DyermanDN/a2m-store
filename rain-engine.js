// Lightweight ambience on a separate, unscaled surface. No layout reads,
// gradients or new objects in the animation loop; never animate behind a dialog.
const rainCanvas = document.getElementById('rain-canvas');
const rainContext = rainCanvas.getContext('2d', {alpha:true});
let rainFrame = 0;
let rainLastTime = 0;
let rainWidth = 0;
let rainHeight = 0;
let rainDrops = [];

function resizeRain() {
  if (!rainContext) return;
  rainWidth = sceneSize.width;
  rainHeight = sceneSize.height;
  const resolution = Math.min(1, 1280 / rainWidth);
  rainCanvas.width = Math.round(rainWidth * resolution);
  rainCanvas.height = Math.round(rainHeight * resolution);
  rainContext.setTransform(resolution, 0, 0, resolution, 0, 0);
  rainDrops = Array.from({length:rainWidth < 700 ? 30 : 55}, () => ({
    x:Math.random() * rainWidth,
    y:Math.random() * rainHeight,
    speed:65 + Math.random() * 55,
    length:8 + Math.random() * 15
  }));
}

function paintRain(time) {
  rainFrame = requestAnimationFrame(paintRain);
  const elapsed = time - rainLastTime;
  if (elapsed < 1000 / 30) return;
  const delta = Math.min(elapsed / 1000, .08);
  rainLastTime = time;
  rainContext.clearRect(0, 0, rainWidth, rainHeight);
  rainContext.lineWidth = .75;
  rainContext.strokeStyle = '#efd6b566';
  rainContext.beginPath();
  for (const drop of rainDrops) {
    drop.y += drop.speed * delta;
    if (drop.y > rainHeight - 75) {
      drop.y = 120 + Math.random() * 30;
      drop.x = Math.random() * rainWidth;
    }
    if (drop.y < 120) continue;
    rainContext.moveTo(drop.x, drop.y);
    rainContext.lineTo(drop.x, drop.y - drop.length);
  }
  rainContext.stroke();
}

function syncRain() {
  cancelAnimationFrame(rainFrame);
  rainFrame = 0;
  if (!rainContext || document.hidden || motionPreference.matches ||
      document.body?.dataset.view === 'catalog' ||
      document.body?.classList.contains('is-wiping') ||
      Object.values(modals).filter(Boolean).some(modal => modal.classList.contains('is-open'))) return;
  rainLastTime = performance.now();
  rainFrame = requestAnimationFrame(paintRain);
}

window.syncRain = syncRain;

function initializeRain() {
  if (!rainContext) return;
  resizeRain();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopAutoTour();
    syncRain();
  });
  motionPreference.addEventListener('change', syncRain);
  syncRain();
}
