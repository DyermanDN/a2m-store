// Opt-in local audit: /?perf=1. No telemetry or network requests.
if (new URLSearchParams(location.search).has('perf')) {
  let sample = null;
  let frameId = 0;
  let taskObserver;
  if (PerformanceObserver.supportedEntryTypes.includes('longtask')) {
    taskObserver = new PerformanceObserver(list => {
      if (sample) sample.longTasks.push(...list.getEntries().map(e => +e.duration.toFixed(1)));
    });
    taskObserver.observe({type:'longtask', buffered:false});
  }
  document.addEventListener('click', e => {
    const target = e.target.closest('button,[role="button"]');
    if (!target) return;
    cancelAnimationFrame(frameId);
    sample = {label:target.getAttribute('aria-label') || target.textContent.trim(), start:performance.now(), previous:0, frames:[], longTasks:[], firstFrameMs:null};
    function frame(now) {
      if (sample.firstFrameMs === null) sample.firstFrameMs = +(performance.now() - sample.start).toFixed(1);
      if (sample.previous) sample.frames.push(now - sample.previous);
      sample.previous = now;
      if (now - sample.start < 1500) { frameId = requestAnimationFrame(frame); return; }
      const sorted = [...sample.frames].sort((a,b)=>a-b);
      console.info('GALLERY_AUDIT '+JSON.stringify({label:sample.label, firstFrameMs:sample.firstFrameMs, frames:sorted.length, p95FrameMs:+(sorted[Math.floor(sorted.length*.95)] || 0).toFixed(1), maxFrameMs:+(sorted.at(-1)||0).toFixed(1), framesOver34ms:sorted.filter(t=>t>34).length, longTasks:sample.longTasks}));
      sample = null;
    }
    frameId = requestAnimationFrame(frame);
  }, {capture:true});
}
