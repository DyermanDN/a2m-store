# Gallery performance verification

2026-11-03. Reference: the user's local 14.93-second, 360 × 640 video.

## Changes

- The architecture stays stationary. Only the selected photo and pedestal animate using `transform`, for 320 ms. Product details fade in over 140 ms (previous camera transition: 1,150 ms).
- Geometry is measured at startup and on resize using untransformed offsets. Clicking does not reset transforms, read bounding rectangles, or force layout. Opening and immediately closing cannot leave a queued animation that reopens the view.
- Removed animated blur, brightness, drop-shadow and backdrop filters. The soft light uses gradients, with no blur filter. Product photographs stay opaque; lighting layers sit behind them.
- The ambient canvas sits outside the animated content, draws at most 28 batched streaks at 24 fps, and uses a maximum width of 1280 pixels. It stops entirely with details/modals open, a hidden document or reduced-motion preference.
- Real product PNG originals are retained; WebP delivery assets total 249,130 bytes versus 4,397,497 bytes for the original PNGs (94.3% smaller). No generated replacement bottles.
- The local server returns the WebP MIME type and validates cached files with ETags. Verified `200 image/webp`, then `304` for the unchanged product asset.

## Measured locally

Opt-in instrumentation: `/?perf=1`; console entries are prefixed `GALLERY_AUDIT`.
Same 1280 × 720 browser surface and same Lost Cherry opening interaction, sampled for approximately 1.5 seconds:

| Measurement | Before | Optimized |
| --- | ---: | ---: |
| Animation-frame callbacks | 12 | 89 |
| 95th percentile frame interval | 266.8 ms | 55.6 ms |
| Maximum frame interval | 266.8 ms | 88.8 ms |
| Frame intervals over 34 ms | 11 | 5 |

The optimized first callback arrived in 31.9 ms. The original first-callback number used an incompatible timestamp and is deliberately excluded. These are local browser measurements, not a universal FPS guarantee or a field-performance score. Some frame spikes remain in this automation environment. `longtask` observations were empty in both runs; the improvement targets rendering/compositing work rather than asserting a JavaScript long-task problem.

## Regression checks

`/tools/regression.html`: 17 checks passed for decoded photos, all five product selections, rapid switching and closing, correct final selection after interruption, bag totals/removal, Escape, and resizing to 390×844, 320×640 and 1024×700 with no horizontal overflow and visible products/details.

The ambient canvas has no per-frame DOM measurements. Resize measurements are coalesced into one animation-frame callback. JavaScript syntax checks passed for app, rain engine and server.

Backups of the pre-optimization files are in `backups/pre-performance/`.
