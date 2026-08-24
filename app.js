'use strict';

/* ============================================================
 * Golf Swing Analysis
 * Load a video, play it back in slow motion and overlay lines
 * and circles. Runs completely locally in the browser – no
 * servers, no uploads.
 * ============================================================ */

// ---------- DOM ----------
const $ = (id) => document.getElementById(id);

const uploadScreen = $('upload-screen');
const playerScreen = $('player-screen');
const dropZone = $('drop-zone');
const videoInput = $('video-input');
const chooseFileBtn = $('choose-file-btn');
const glfInput = $('glf-input');
const chooseGlfBtn = $('choose-glf-btn');
const newVideoBtn = $('new-video-btn');

const video = $('video');
const canvas = $('overlay');
const ctx = canvas.getContext('2d');
const stage = $('stage');
const toolbar = $('toolbar');

const toolLineBtn = $('tool-line');
const toolCircleBtn = $('tool-circle');
const toolMoveBtn = $('tool-move');
const undoBtn = $('undo-btn');
const drawHint = $('draw-hint');

const playPauseBtn = $('play-pause');
const stepBackBtn = $('step-back');
const stepFwdBtn = $('step-fwd');
const timeDisplay = $('time-display');
const speedSlider = $('speed-slider');
const speedValue = $('speed-value');
const thicknessSlider = $('thickness-slider');
const thicknessValue = $('thickness-value');
const scrubber = $('scrubber');

const overlayToggle = $('overlay-toggle');
const overlayContent = $('overlay-content');
const overlayList = $('overlay-list');
const overlayEmpty = $('overlay-empty');
const exportBtn = $('export-btn');
const importBtn = $('import-btn');
const importInput = $('import-input');
const saveGlfBtn = $('save-glf-btn');
const glfStatus = $('glf-status');
const clearAllBtn = $('clear-all-btn');

const transportEl = $('transport');
const speedRowEl = $('speed-row');
const trimBanner = $('trim-banner');
const trimBannerText = $('trim-banner-text');
const trimEditBtn = $('trim-edit-btn');
const trimResetBtn = $('trim-reset-btn');
const trimPanel = $('trim-panel');
const trimStartInput = $('trim-start');
const trimEndInput = $('trim-end');
const trimSetStartBtn = $('trim-set-start');
const trimSetEndBtn = $('trim-set-end');
const trimPlayBtn = $('trim-play-btn');
const trimPlayRangeBtn = $('trim-play-range-btn');
const trimLengthEl = $('trim-length');
const trimSaveBtn = $('trim-save-btn');
const trimApplyBtn = $('trim-apply-btn');
const trimStatus = $('trim-status');

// ---------- State ----------
const COLORS = [
  '#ff3b30', '#ff9500', '#ffd60a', '#30d158',
  '#64d2ff', '#0a84ff', '#bf5af2', '#ffffff', '#1c1c1e',
];

const state = {
  tool: 'line',
  color: COLORS[0],
  thickness: 1,             // stroke width (1×–3×) for new shapes
  mode: 'trim',              // 'trim' (cut) | 'analysis' (analyze)
  trim: { start: 0, end: Infinity },
  recording: false,          // a recording is running (file export)
  previewing: false,         // range preview in trim mode
  overlays: [],          // [{id, type, label, color, start, end, visible, pts:[{x,y},{x,y}]}]
  history: [],           // overlay ids in creation order (for undo)
  nextId: 1,
  lineCount: 0,
  circleCount: 0,
  drawing: null,         // overlay currently being drawn (preview)
  drag: null,            // current drag {overlayId, handle, startPoint, startPts}
  hover: null,           // overlay id under the mouse cursor (move mode)
  pointerId: null,
  fps: 30,               // for single-frame stepping
  ar: 16 / 9,            // video aspect ratio
  objectUrl: null,
  sourceBlob: null,      // original video bytes (for .glf saving)
  videoName: null,
};

let pendingGlf = null;   // loaded .glf project, applied once metadata is ready

// ---------- Loading videos ----------
function loadFile(file) {
  if (!file.type.startsWith('video/')) {
    alert('Please select a video file (e.g., MP4).');
    return;
  }
  if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
  state.objectUrl = URL.createObjectURL(file);
  state.sourceBlob = file;
  state.videoName = file.name;
  pendingGlf = null;

  resetOverlays();
  video.src = state.objectUrl;

  uploadScreen.hidden = true;
  playerScreen.hidden = false;
  newVideoBtn.hidden = false;
  document.title = 'Golf Swing Analysis – ' + file.name;
}

function onLoadedMetadata() {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) {
    // No decodable frame: the browser cannot decode the codec of this file
    // (e.g. HEVC/H.265 from a phone camera, which Chrome on Linux cannot
    // play). Give clear feedback instead of a silently broken player.
    alert(
      'This video cannot be decoded by your browser. It is probably an ' +
      'unsupported format (e.g. HEVC/H.265 from a phone). Convert it to MP4 ' +
      '(H.264) and load it again.'
    );
    resetToUpload();
    return;
  }
  state.ar = w / h;
  canvas.width = w;
  canvas.height = h;
  if (isFinite(video.duration)) scrubber.max = Math.round(video.duration * 100);
  fitStage();
  estimateFps();
  if (pendingGlf) {
    const p = pendingGlf;
    pendingGlf = null;
    applyGlfProject(p.meta);
    return;
  }
  setMode('trim'); // trim first, then analyze
  // Show the first frame. Some files report an infinite/unknown duration
  // (broken WebM metadata); seeking such a file can freeze the page, so only
  // force the decode when the duration is known.
  if (video.currentTime === 0 && isFinite(video.duration)) {
    video.currentTime = 0.001; // force decode so the first frame is shown
  }
}

function fitStage() {
  const maxH = Math.max(240, window.innerHeight * 0.78);
  const maxW = stage.parentElement.clientWidth;
  let width = maxW;
  let height = width / state.ar;
  if (height > maxH) {
    height = maxH;
    width = height * state.ar;
  }
  stage.style.width = width + 'px';
  stage.style.height = height + 'px';
}

function estimateFps() {
  if (!('requestVideoFrameCallback' in video)) return;
  // Derive the real frame rate from the frame timestamps (average of 5 frames)
  let prevDisplay = null;
  let durations = [];
  const cb = (now, meta) => {
    const disp = meta.expectedDisplayTime;
    if (prevDisplay !== null && disp > prevDisplay) {
      const dur = disp - prevDisplay;
      if (dur > 0 && dur < 500) {
        durations.push(dur);
        if (durations.length >= 5) {
          const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
          const fps = Math.round(1000 / avg);
          if (fps >= 8 && fps <= 240) state.fps = fps;
          return;
        }
      }
    }
    prevDisplay = disp;
    video.requestVideoFrameCallback(cb);
  };
  video.requestVideoFrameCallback(cb);
}

function resetToUpload() {
  video.pause();
  if (state.objectUrl) {
    URL.revokeObjectURL(state.objectUrl);
    state.objectUrl = null;
  }
  video.removeAttribute('src');
  video.load();
  scrubPending = null;
  scrubSeeking = false;
  wasPlayingBeforeScrub = false;
  state.sourceBlob = null;
  state.videoName = null;
  pendingGlf = null;
  resetOverlays();
  stage.style.width = '';
  stage.style.height = '';
  canvas.width = 0;
  canvas.height = 0;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  scrubber.value = 0;
  timeDisplay.textContent = '0:00.0 · F1 / 0:00.0';
  playPauseBtn.textContent = '▶';
  state.trim.start = 0;
  state.trim.end = Infinity;
  state.recording = false;
  state.previewing = false;
  stopStepRepeat();
  trimStatus.hidden = true;
  trimPlayBtn.textContent = '▶ Play';
  uploadScreen.hidden = false;
  playerScreen.hidden = true;
  newVideoBtn.hidden = true;
  document.title = 'Golf Swing Analysis';
}

function resetOverlays() {
  state.overlays = [];
  state.history = [];
  state.nextId = 1;
  state.lineCount = 0;
  state.circleCount = 0;
  state.drawing = null;
  state.drag = null;
  state.hover = null;
  state.pointerId = null;
  renderOverlayList();
}

// ---------- Playback ----------
function togglePlay() {
  if (!video.src || state.recording) return;
  if (video.paused) {
    if (state.mode === 'analysis' && isFinite(state.trim.end) && video.currentTime >= state.trim.end) {
      video.currentTime = state.trim.start;
    }
    video.play().catch(() => {});
  } else {
    video.pause();
  }
}

function stepFrame(dir) {
  if (!video.src || !isFinite(video.duration) || state.recording) return;
  video.pause();
  const fps = Math.min(240, Math.max(8, state.fps));
  const dt = 1 / fps;
  let t = video.currentTime + dir * dt;
  if (state.mode === 'analysis') {
    t = Math.min(
      Math.max(t, state.trim.start),
      isFinite(state.trim.end) ? state.trim.end : video.duration
    );
  }
  video.currentTime = Math.min(Math.max(t, 0), video.duration);
}

let stepRepeatTimer = null;

function startStepRepeat(dir) {
  stopStepRepeat();
  stepFrame(dir);
  stepRepeatTimer = setInterval(() => stepFrame(dir), 100);
}

function stopStepRepeat() {
  if (stepRepeatTimer !== null) {
    clearInterval(stepRepeatTimer);
    stepRepeatTimer = null;
  }
}

function bindStepButton(btn, dir) {
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    startStepRepeat(dir);
  });
  btn.addEventListener('pointerup', stopStepRepeat);
  btn.addEventListener('pointercancel', stopStepRepeat);
  btn.addEventListener('pointerleave', stopStepRepeat);
}

// ---------- Timeline (smooth scrubbing) ----------
let scrubPending = null;      // pending target time while dragging
let scrubSeeking = false;     // a seek is currently in flight
let wasPlayingBeforeScrub = false;

function pushScrubSeek(t) {
  scrubPending = t;
  if (!scrubSeeking) {
    scrubSeeking = true;
    video.currentTime = scrubPending;
    scrubPending = null;
  }
}

function onSeeked() {
  scrubSeeking = false;
  if (scrubPending !== null) {
    scrubSeeking = true;
    video.currentTime = scrubPending;
    scrubPending = null;
  }
  draw();
}

function onScrubEnd() {
  if (wasPlayingBeforeScrub && !state.recording && video.src) {
    video.play().catch(() => {});
  }
  wasPlayingBeforeScrub = false;
}

function onTimeUpdate() {
  if (state.recording) return;
  if (state.previewing) {
    const dur = video.duration || 0;
    const e = isFinite(state.trim.end) ? Math.min(state.trim.end, dur) : dur;
    if (video.ended || video.currentTime >= e) {
      state.previewing = false;
      video.pause();
      video.currentTime = state.trim.start;
    }
  }
  if (state.mode === 'analysis' && isFinite(state.trim.end) && video.currentTime >= state.trim.end) {
    // End of the trim reached: jump back to the trim start for the analysis
    video.currentTime = state.trim.start;
  }
  updateScrubber();
  updateTimeDisplay();
}

function updateScrubber() {
  if (isFinite(video.duration)) scrubber.value = video.currentTime * 100;
}

function updateTimeDisplay() {
  const t = video.currentTime || 0;
  const d = video.duration || 0;
  const frame = Math.floor(t * state.fps) + 1;
  timeDisplay.textContent = isFinite(d)
    ? fmt(t) + ' · F' + frame + ' / ' + fmt(d)
    : fmt(t) + ' · F' + frame;
  timeDisplay.title = 'Frame rate: ' + state.fps + ' fps';
}

function fmt(s) {
  s = Math.max(0, s);
  const m = Math.floor(s / 60);
  const sec = s - m * 60;
  const whole = Math.floor(sec);
  const tenth = Math.floor((sec - whole) * 10);
  return m + ':' + String(whole).padStart(2, '0') + '.' + tenth;
}

// ---------- Tools ----------
function setTool(t) {
  state.tool = t;
  cancelDrawing();
  toolLineBtn.classList.toggle('active', t === 'line');
  toolCircleBtn.classList.toggle('active', t === 'circle');
  toolMoveBtn.classList.toggle('active', t === 'move');
  toolLineBtn.setAttribute('aria-pressed', t === 'line');
  toolCircleBtn.setAttribute('aria-pressed', t === 'circle');
  toolMoveBtn.setAttribute('aria-pressed', t === 'move');
  canvas.style.cursor = t === 'move' ? 'grab' : 'crosshair';
  drawHint.textContent =
    t === 'line'
      ? 'Line: tap/drag on the video – start point until you release'
      : t === 'circle'
        ? 'Circle: tap/drag on the video – center to radius'
        : 'Move: tap a handle – or grab the whole line/circle and drag';
  state.hover = null;
  draw();
}

function cancelDrawing() {
  if (state.drawing || state.drag) {
    state.drawing = null;
    state.drag = null;
    draw();
  }
}

function selectColor(c) {
  state.color = c;
  document.querySelectorAll('.swatch').forEach((s) => {
    s.classList.toggle('active', s.dataset.color === c);
  });
}

function buildColorRow() {
  const row = $('color-row');
  COLORS.forEach((c) => {
    const b = document.createElement('button');
    b.className = 'swatch';
    b.type = 'button';
    b.style.setProperty('--c', c);
    b.title = 'Color ' + c;
    b.dataset.color = c;
    b.addEventListener('click', () => selectColor(c));
    row.appendChild(b);
  });
  selectColor(state.color);
}

// ---------- Drawing on the canvas ----------
function toCanvas(e) {
  const rect = canvas.getBoundingClientRect();
  const x = Math.min(Math.max(e.clientX, rect.left), rect.right);
  const y = Math.min(Math.max(e.clientY, rect.top), rect.bottom);
  return {
    x: ((x - rect.left) * canvas.width) / rect.width,
    y: ((y - rect.top) * canvas.height) / rect.height,
  };
}

function onPointerDown(e) {
  if (!video.src || state.mode !== 'analysis' || state.pointerId !== null) return;
  e.preventDefault();
  state.pointerId = e.pointerId;
  try {
    canvas.setPointerCapture(e.pointerId);
  } catch (err) {
    /* implicit capture is enough */
  }
  const p = toCanvas(e);
  if (state.tool === 'move') {
    const hit = hitTest(p);
    if (hit) {
      state.drag = {
        overlayId: hit.overlay.id,
        handle: hit.handle, // null = move the whole shape
        startPoint: p,
        startPts: hit.overlay.pts.map((pt) => ({ x: pt.x, y: pt.y })),
      };
      canvas.style.cursor = 'grabbing';
      draw();
    }
    return;
  }
  state.drawing = {
    id: state.nextId++,
    type: state.tool,
    color: state.color,
    width: state.thickness,
    start: 0,
    end: Infinity,
    visible: true,
    pts: [p, p],
  };
  draw();
}

function onPointerMove(e) {
  const p = toCanvas(e);
  if (state.pointerId !== e.pointerId) {
    // Hover (mouse without a pressed button): highlight the whole shape in move mode
    if (state.tool === 'move' && !state.drag && !state.drawing) {
      const hit = hitTest(p);
      const id = hit && hit.handle === null ? hit.overlay.id : null;
      if (state.hover !== id) {
        state.hover = id;
        draw();
      }
    }
    return;
  }
  e.preventDefault();
  if (state.drag) {
    const o = findOverlay(state.drag.overlayId);
    if (o) {
      if (state.drag.handle === null) {
        const dx = p.x - state.drag.startPoint.x;
        const dy = p.y - state.drag.startPoint.y;
        o.pts[0] = { x: state.drag.startPts[0].x + dx, y: state.drag.startPts[0].y + dy };
        o.pts[1] = { x: state.drag.startPts[1].x + dx, y: state.drag.startPts[1].y + dy };
      } else {
        o.pts[state.drag.handle] = p;
      }
      draw();
    }
    return;
  }
  if (state.drawing) {
    state.drawing.pts[1] = p;
    draw();
  }
}

function onPointerUp(e) {
  if (state.pointerId !== e.pointerId) return;
  state.pointerId = null;
  if (state.drag) {
    state.drag = null;
    canvas.style.cursor = 'grab';
    draw();
    return;
  }
  const d = state.drawing;
  state.drawing = null;
  if (d && isValid(d)) {
    const label =
      d.type === 'line' ? 'Line ' + ++state.lineCount : 'Circle ' + ++state.circleCount;
    d.label = label;
    state.overlays.push(d);
    state.history.push(d.id);
  }
  renderOverlayList();
  draw();
}

function isValid(d) {
  const [a, b] = d.pts;
  return Math.hypot(b.x - a.x, b.y - a.y) >= 5; // ignore tiny accidental taps
}

// ---------- Drawing ----------
function draw() {
  if (!video.src) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const t = video.currentTime || 0;
  const baseLw = Math.max(2, canvas.width / 300);
  for (const o of state.overlays) {
    if (!o.visible) continue;
    if (t < o.start || t > o.end) continue;
    const w = baseLw * (o.width || 1);
    if (state.tool === 'move' && !state.drag && state.hover === o.id) {
      paintOverlay(o, w * 2.4, false); // highlight under the cursor
    }
    paintOverlay(o, w, false);
  }
  if (state.drawing) paintOverlay(state.drawing, baseLw * (state.drawing.width || 1), true);
  if (state.tool === 'move') drawHandles();
}

function paintOverlay(o, lineWidth, preview) {
  ctx.strokeStyle = o.color;
  ctx.lineWidth = lineWidth;
  ctx.setLineDash(preview ? [10, 8] : []);
  ctx.beginPath();
  const [a, b] = o.pts;
  if (o.type === 'line') {
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
  } else {
    const r = Math.hypot(b.x - a.x, b.y - a.y);
    ctx.arc(a.x, a.y, r, 0, Math.PI * 2);
  }
  ctx.stroke();
}

// ---------- Moving points ----------
function cssToCanvas(px) {
  const rect = canvas.getBoundingClientRect();
  const scale = rect.width ? canvas.width / rect.width : 1;
  return px * scale;
}

function hitTest(p) {
  const threshold = cssToCanvas(24); // ~24 CSS pixels of touch tolerance
  const t = video.currentTime || 0;
  // Handles take priority over the whole shape
  let bestHandle = null;
  let bestHandleDist = Infinity;
  let bestWhole = null;
  let bestWholeDist = Infinity;
  for (const o of state.overlays) {
    if (!o.visible || t < o.start || t > o.end) continue;
    for (const hi of [0, 1]) {
      const d = Math.hypot(o.pts[hi].x - p.x, o.pts[hi].y - p.y);
      if (d < threshold && d < bestHandleDist) {
        bestHandleDist = d;
        bestHandle = { overlay: o, handle: hi };
      }
    }
    const wd = wholeHit(p, o, threshold);
    if (wd < bestWholeDist) {
      bestWholeDist = wd;
      bestWhole = { overlay: o, handle: null };
    }
  }
  return bestHandle || bestWhole;
}

function wholeHit(p, o, threshold) {
  const [a, b] = o.pts;
  if (o.type === 'line') {
    const d = distToSegment(p, a, b);
    return d < threshold ? d : Infinity;
  }
  const r = Math.hypot(b.x - a.x, b.y - a.y);
  const d = Math.hypot(p.x - a.x, p.y - a.y);
  // inside or slightly outside the circle edge counts as a hit
  return d <= r + threshold * 0.25 ? Math.abs(d - r) : Infinity;
}

function distToSegment(p, a, b) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const len2 = abx * abx + aby * aby;
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * abx), p.y - (a.y + t * aby));
}

function drawHandles() {
  const r = Math.max(3, cssToCanvas(6));
  const t = video.currentTime || 0;
  for (const o of state.overlays) {
    if (!o.visible || t < o.start || t > o.end) continue;
    for (const hi of [0, 1]) {
      const p = o.pts[hi];
      const active =
        state.drag && state.drag.overlayId === o.id && state.drag.handle === hi;
      ctx.beginPath();
      ctx.arc(p.x, p.y, active ? r * 1.5 : r, 0, Math.PI * 2);
      ctx.fillStyle = active ? '#ffffff' : 'rgba(255, 255, 255, 0.85)';
      ctx.fill();
      ctx.lineWidth = Math.max(1.5, cssToCanvas(1.5));
      ctx.strokeStyle = o.color;
      ctx.stroke();
    }
  }
}

// ---------- Animation loop (only while playing) ----------
let rafId = null;

function startLoop() {
  if (rafId !== null) return;
  const loop = () => {
    draw();
    updateScrubber();
    updateTimeDisplay();
    rafId = requestAnimationFrame(loop);
  };
  rafId = requestAnimationFrame(loop);
}

function stopLoop() {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

// ---------- Speed ----------
function updateSpeedUI() {
  const v = parseFloat(speedSlider.value);
  speedValue.textContent = v.toFixed(2) + '×';
  document.querySelectorAll('.chip').forEach((c) => {
    c.classList.toggle('active', Math.abs(parseFloat(c.dataset.speed) - v) < 0.001);
  });
}

// ---------- Stroke width ----------
function adjustThickness(delta) {
  const newT = Math.min(3, Math.max(1, state.thickness + delta));
  state.thickness = Math.round(newT * 10) / 10;
  thicknessSlider.value = state.thickness;
  thicknessValue.textContent = fmtWidth(state.thickness);
}

// ---------- Trim ----------
function setMode(m) {
  state.mode = m;
  const isTrim = m === 'trim';
  trimPanel.hidden = !isTrim;
  trimBanner.hidden = isTrim;
  transportEl.hidden = isTrim;
  speedRowEl.hidden = isTrim;
  toolbar.hidden = isTrim;
  drawHint.hidden = isTrim;
  canvas.style.cursor = isTrim ? 'default' : 'crosshair';
  video.pause();
  state.previewing = false;
  stopStepRepeat();
  updateTrimUI();
  if (!isTrim) {
    video.currentTime = Math.min(state.trim.start, video.duration || 0);
  }
  draw();
}

function parseTrimSeconds(v) {
  v = v.trim().replace(',', '.');
  if (v === '') return null;
  const n = Number(v);
  return isFinite(n) && n >= 0 ? n : null;
}

function fmtTrim(v) {
  return (Math.round(v * 10) / 10).toFixed(1);
}

function updateTrimUI() {
  updateTrimDisplay();
  if (!isFinite(video.duration)) return;
  const dur = video.duration;
  const s = Math.max(0, Math.min(state.trim.start, dur));
  const e = isFinite(state.trim.end) ? Math.min(state.trim.end, dur) : dur;
  trimStartInput.value = fmtTrim(s);
  trimEndInput.value = fmtTrim(e);
}

function updateTrimDisplay() {
  const dur = video.duration || 0;
  const durFinite = isFinite(dur);
  const s = Math.max(0, state.trim.start);
  const e = isFinite(state.trim.end) ? state.trim.end : dur;
  const eFinite = isFinite(e);
  if (state.mode === 'trim' && durFinite) {
    scrubber.min = 0;
    scrubber.max = Math.round(dur * 100);
    const sp = (s / dur) * 100;
    const ep = (Math.min(e, dur) / dur) * 100;
    scrubber.style.background =
      'linear-gradient(90deg, #3a4356 0%, #3a4356 ' + sp + '%, var(--accent) ' + sp +
      '%, var(--accent) ' + ep + '%, #3a4356 ' + ep + '%, #3a4356 100%)';
  } else if (state.mode === 'analysis' && durFinite && eFinite) {
    scrubber.min = Math.round(s * 100);
    scrubber.max = Math.round(Math.min(e, dur) * 100);
    scrubber.style.background = 'var(--accent)';
  }
  trimLengthEl.textContent = eFinite
    ? 'Length: ' + fmtTrim(Math.max(0, e - s)) + ' s'
    : 'Length: whole video';
  trimBannerText.textContent =
    s <= 0 && (!eFinite || e >= dur)
      ? 'No trim – analyzing the whole video'
      : 'Trim: ' + fmtTrim(s) + ' s to ' + (eFinite ? fmtTrim(e) + ' s' : 'end');
}

function onTrimInput() {
  if (state.mode !== 'trim' || state.recording) return;
  const dur = video.duration || 0;
  const s = parseTrimSeconds(trimStartInput.value);
  const e = parseTrimSeconds(trimEndInput.value);
  state.trim.start = s === null ? 0 : Math.min(Math.max(0, s), dur);
  state.trim.end = e === null ? Infinity : Math.min(Math.max(0, e), dur);
  updateTrimDisplay(); // don't overwrite the input fields, only update the display
}

function setTrimPosition(which) {
  if (state.mode !== 'trim' || state.recording) return;
  const dur = video.duration || 0;
  const t = Math.max(0, Math.min(video.currentTime, dur));
  const otherStart = parseTrimSeconds(trimStartInput.value);
  const otherEnd = parseTrimSeconds(trimEndInput.value);
  if (which === 'start') {
    const e = otherEnd === null ? dur : otherEnd;
    state.trim.start = Math.min(t, Math.max(0, e - 0.1));
  } else {
    const s = otherStart === null ? 0 : otherStart;
    state.trim.end = Math.max(t, Math.min(dur, s + 0.1));
  }
  updateTrimUI();
}

function onTrimPlay() {
  if (state.recording) return;
  if (video.paused) {
    video.play().catch(() => {});
  } else {
    video.pause();
  }
}

function onTrimPlayRange() {
  if (state.recording) return;
  const dur = video.duration || 0;
  const s = Math.max(0, Math.min(state.trim.start, dur));
  const e = isFinite(state.trim.end) ? Math.min(state.trim.end, dur) : dur;
  if (e - s < 0.1) return;
  state.previewing = true;
  video.pause();
  seekAndWait(s, () => {
    video.play().catch(() => {});
  });
}

function applyTrimAndAnalyze() {
  if (state.recording) return;
  const dur = video.duration || 0;
  let s = parseTrimSeconds(trimStartInput.value);
  let e = parseTrimSeconds(trimEndInput.value);
  if (s === null) s = 0;
  if (e === null) e = dur;
  s = Math.max(0, Math.min(s, dur));
  e = e > dur ? dur : e;
  if (e - s < 0.1) {
    alert('The selected range is too short (at least 0.1 s).');
    return;
  }
  state.trim.start = s;
  state.trim.end = e;
  trimStatus.hidden = true;
  setMode('analysis');
}

function setTrimButtonsDisabled(disabled) {
  [
    trimSetStartBtn, trimSetEndBtn, trimPlayBtn, trimPlayRangeBtn,
    trimSaveBtn, trimApplyBtn, trimStartInput, trimEndInput,
  ].forEach((el) => {
    el.disabled = disabled;
  });
  scrubber.disabled = disabled;
}

function pickMime() {
  // The recording is video-only, so use codec strings without an audio codec:
  // some browsers (Firefox) fail to mux a stream whose codecs string mentions
  // an audio codec when no audio track is present.
  const candidates = [
    'video/mp4;codecs=avc1.42E01E',
    'video/mp4',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return '';
}

function extFor(mime) {
  return mime && mime.indexOf('mp4') !== -1 ? 'mp4' : 'webm';
}

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// Seek to a position and only call done() once the seek has actually finished.
// Reading video.currentTime right after setting it returns the target value
// immediately, so a naive comparison cannot tell whether the seek completed.
function seekAndWait(target, done) {
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    video.removeEventListener('seeked', onSeek);
    clearInterval(pollTimer);
    clearTimeout(timeoutTimer);
    done();
  };
  const onSeek = () => finish();
  const pollTimer = setInterval(() => {
    if (!video.seeking && Math.abs(video.currentTime - target) < 0.02) {
      finish();
    }
  }, 25);
  const timeoutTimer = setTimeout(finish, 5000); // safety net
  video.addEventListener('seeked', onSeek);
  video.currentTime = target;
}

// Record the trimmed range in real time and resolve with the resulting blob.
// Captures the video element's own stream (video track only, no audio) – this
// is the one approach that works reliably in Chrome, Firefox and Safari.
// Note: videos that carry rotation metadata (phone cameras) may be recorded
// sideways in Chromium; converting such videos first (see the README) bakes the
// rotation in and records them upright.
// The function is designed to never hang: every path either resolves with the
// recorded video or rejects with an error.
function recordTrimmedRange(onProgress) {
  return new Promise((resolve, reject) => {
    if (typeof MediaRecorder === 'undefined' || typeof video.captureStream !== 'function') {
      reject(new Error('unsupported'));
      return;
    }
    const dur = video.duration || 0;
    const s = Math.max(0, Math.min(state.trim.start, dur));
    const e = isFinite(state.trim.end) ? Math.min(state.trim.end, dur) : dur;
    const eFinite = isFinite(e);
    if (e - s < 0.1) {
      reject(new Error('short'));
      return;
    }
    // End tolerance: stop shortly before the trim end. Relative to the range
    // length so very short ranges still record (5 % of the range, max 0.4 s).
    const tol = Math.min(0.4, Math.max(0.05, (e - s) * 0.05));
    const prevRate = video.playbackRate;
    const wasMuted = video.muted;
    video.pause();
    video.playbackRate = 1;
    // Mute during recording: muted autoplay is always allowed, so playback
    // works even on file:// pages where unmuted play() without a fresh user
    // gesture is blocked. (The recording is video-only anyway.)
    video.muted = true;

    let rec = null;
    let mime = '';
    let chunks = [];
    let settled = false;
    let stallTicks = 0;
    let lastPos = null;
    let sawAdvance = false;
    let resolveTimer = null;

    const cleanup = () => {
      clearTimeout(overallTimeout);
      if (resolveTimer !== null) {
        clearTimeout(resolveTimer);
        resolveTimer = null;
      }
      video.removeEventListener('ended', onEnded);
      video.muted = wasMuted;
    };

    // Single exit point: restore the video state and either resolve or reject.
    const settle = (blob, err) => {
      if (settled) return;
      settled = true;
      cleanup();
      video.playbackRate = prevRate;
      try {
        if (rec && rec.state !== 'inactive') rec.stop();
      } catch (err2) {
        /* ignore */
      }
      if (err) reject(err);
      else resolve(blob);
    };

    // Build the blob from everything recorded so far.
    const finish = () => {
      if (settled) return;
      const blob = new Blob(chunks, { type: (rec && rec.mimeType) || mime || 'video/webm' });
      if (!chunks.length || blob.size < 100) settle(null, new Error('empty'));
      else settle(blob, null);
    };

    const stopRecording = () => {
      video.pause();
      if (rec && rec.state !== 'inactive') {
        rec.stop();
        // Safety: MediaRecorder must always produce a result. If onstop does
        // not fire within 3 s (a known Chromium quirk), finish with the chunks
        // collected so far instead of hanging.
        if (resolveTimer === null) {
          resolveTimer = setTimeout(finish, 3000);
        }
      }
    };
    const onEnded = () => stopRecording();
    video.addEventListener('ended', onEnded);

    // Last safety net: never hang forever. If chunks exist, resolve with what
    // we have (a slightly short video beats a stuck progress bar).
    const overallTimeout = setTimeout(() => {
      if (settled) return;
      const blob = new Blob(chunks, { type: (rec && rec.mimeType) || mime || 'video/webm' });
      if (!chunks.length || blob.size < 100) settle(null, new Error('timeout'));
      else settle(blob, null);
    }, Math.max(30000, (e - s) * 2000 + 15000));

    const onTick = () => {
      if (settled) return;
      // Stop at the true end: the 'ended' event, or the position reaching the
      // trim end. Many videos report a duration slightly longer than the real
      // playable content, so allow a tolerance instead of demanding the exact
      // end position.
      if (video.ended || video.currentTime >= e - tol) {
        stopRecording();
        return;
      }
      const pos = video.currentTime;
      if (lastPos === null) {
        lastPos = pos;
      } else if (pos === lastPos) {
        stallTicks++;
        // Only treat a stall as a problem once the video has actually started
        // advancing. Decoder warm-up after play() can take a moment, so the
        // not-yet-started case gets a much longer allowance (3 s) than a stall
        // after playback has begun (~0.35 s).
        const threshold = sawAdvance ? 20 : 180;
        if (stallTicks > threshold) {
          if (!sawAdvance) {
            settle(null, new Error('playback'));
            return;
          }
          // Playback has stopped advancing. Near the trim end this simply
          // means the real content ended (the reported duration is too long) –
          // the recorded range is complete enough. The same applies when the
          // total duration is unknown (some WebM files report Infinity) and we
          // have already recorded a little bit. Further away from the end
          // playback was probably blocked.
          const pct = Math.min(100, Math.round(((pos - s) / (e - s)) * 100));
          if (pct >= 90 || pos >= e - tol || (!eFinite && pos > s + 0.3)) {
            stopRecording();
          } else {
            settle(null, new Error('playback'));
          }
          return;
        }
      } else {
        lastPos = pos;
        sawAdvance = true;
        stallTicks = 0;
      }
      const pct = eFinite
        ? Math.min(100, Math.round(((pos - s) / (e - s)) * 100))
        : Math.round((pos - s) * 10) / 10; // seconds when the total is unknown
      if (onProgress) onProgress(pct, !eFinite);
      requestAnimationFrame(onTick);
    };

    seekAndWait(s, () => {
      if (settled) return;
      // Create the stream only now: the video sits at the trim start and is
      // about to play. Keep only the video track, so no audio is mixed in.
      let src;
      try {
        src = new MediaStream(video.captureStream(30).getVideoTracks());
      } catch (err) {
        settle(null, err);
        return;
      }
      mime = pickMime();
      rec = new MediaRecorder(
        src,
        mime ? { mimeType: mime, videoBitsPerSecond: 8000000 } : { videoBitsPerSecond: 8000000 }
      );
      rec.ondataavailable = (ev) => {
        if (ev.data && ev.data.size) chunks.push(ev.data);
      };
      rec.onstop = () => {
        if (resolveTimer !== null) {
          clearTimeout(resolveTimer);
          resolveTimer = null;
        }
        finish();
      };
      try {
        rec.start(250);
        video.play().catch(() => settle(null, new Error('playback')));
        requestAnimationFrame(onTick);
      } catch (err) {
        settle(null, err);
      }
    });
  });
}

function exportTrimmedVideo() {
  if (state.recording) return;
  if (typeof MediaRecorder === 'undefined' || typeof canvas.captureStream !== 'function') {
    trimStatus.hidden = false;
    trimStatus.textContent =
      'Saving is not supported by this browser – just use “Apply & Analyze”.';
    return;
  }
  const dur = video.duration || 0;
  const s = Math.max(0, Math.min(state.trim.start, dur));
  const e = isFinite(state.trim.end) ? Math.min(state.trim.end, dur) : dur;
  if (e - s < 0.1) {
    trimStatus.hidden = false;
    trimStatus.textContent = 'The range is too short – check the start and end.';
    return;
  }

  state.recording = true;
  state.previewing = false;
  trimStatus.hidden = false;
  trimStatus.textContent = 'Preparing recording…';
  setTrimButtonsDisabled(true);

  recordTrimmedRange((pct, unknownEnd) => {
    trimStatus.textContent = unknownEnd
      ? 'Recording… ' + pct + ' s'
      : 'Recording range… ' + pct + ' %';
  })
    .then((blob) => {
      state.recording = false;
      setTrimButtonsDisabled(false);
      const fileName = 'golf-swing-trimmed.' + extFor(blob.type);
      downloadBlob(blob, fileName);
      trimStatus.textContent = 'File saved – applying the trim now.';
      applyTrimAndAnalyze();
    })
    .catch((err) => {
      state.recording = false;
      setTrimButtonsDisabled(false);
      const code = err && err.message;
      trimStatus.textContent =
        code === 'playback'
          ? 'Playback stalled – the video could not be played through. Please try again.'
          : code === 'timeout'
            ? 'Recording timed out – please try again.'
            : code === 'empty'
              ? 'Recording failed – no video data was captured. Please try again.'
              : 'Recording failed. Please try again.';
    });
}

// ---------- Overlay list ----------
function renderOverlayList() {
  overlayEmpty.hidden = state.overlays.length > 0;
  const collapsed = overlayContent.classList.contains('hidden');
  overlayToggle.textContent =
    'Overlays (' + state.overlays.length + ') ' + (collapsed ? '▸' : '▾');
  overlayToggle.setAttribute('aria-expanded', String(!collapsed));

  overlayList.innerHTML = '';
  for (const o of state.overlays) {
    const li = document.createElement('li');
    li.className = 'overlay-item';
    li.dataset.id = o.id;
    li.innerHTML =
      '<span class="ov-color" style="background:' + o.color + '"></span>' +
      '<span class="ov-name">' + (o.label || o.type) + '</span>' +
      '<span class="ov-time">from <input type="text" inputmode="decimal" data-field="start" value="' +
      fmtInput(o.start) + '" placeholder="0"></span>' +
      '<span class="ov-time">to <input type="text" inputmode="decimal" data-field="end" value="' +
      fmtInput(o.end) + '" placeholder="∞"></span>' +
      '<button class="ov-width-btn" data-width="-0.5" title="Thinner">−</button>' +
      '<span class="ov-width">' + fmtWidth(o.width || 1) + '</span>' +
      '<button class="ov-width-btn" data-width="0.5" title="Thicker">+</button>' +
      '<button class="ov-vis' + (o.visible ? '' : ' off') +
      '" title="Toggle visibility">' + (o.visible ? '👁' : '🚫') + '</button>' +
      '<button class="ov-del" title="Delete">✕</button>';
    overlayList.appendChild(li);
  }
}

function findOverlay(id) {
  return state.overlays.find((o) => o.id === id);
}

function onListClick(e) {
  const li = e.target.closest('.overlay-item');
  if (!li) return;
  const id = Number(li.dataset.id);
  const o = findOverlay(id);
  if (!o) return;

  if (e.target.classList.contains('ov-del')) {
    deleteOverlay(id);
    return;
  }
  if (e.target.classList.contains('ov-width-btn')) {
    const delta = Number(e.target.dataset.width);
    const newW = Math.min(3, Math.max(1, (o.width || 1) + delta));
    o.width = Math.round(newW * 10) / 10;
    li.querySelector('.ov-width').textContent = fmtWidth(o.width);
    draw();
    return;
  }
  if (e.target.classList.contains('ov-vis')) {
    o.visible = !o.visible;
    const btn = li.querySelector('.ov-vis');
    btn.textContent = o.visible ? '👁' : '🚫';
    btn.classList.toggle('off', !o.visible);
    draw();
  }
}

function onListInput(e) {
  const input = e.target.closest('input[data-field]');
  if (!input) return;
  const li = input.closest('.overlay-item');
  const o = findOverlay(Number(li.dataset.id));
  if (!o) return;
  const field = input.dataset.field;
  o[field] = parseSeconds(input.value, field);
  draw();
}

function onListChange(e) {
  const input = e.target.closest('input[data-field]');
  if (!input) return;
  // Normalize the input after leaving the field ('' = 0 or ∞)
  input.value = fmtInput(parseSeconds(input.value, input.dataset.field));
}

function parseSeconds(v, field) {
  v = v.trim().replace(',', '.');
  if (v === '') return field === 'start' ? 0 : Infinity;
  const n = Number(v);
  if (!isFinite(n) || n < 0) return field === 'start' ? 0 : Infinity;
  return n;
}

function fmtInput(v) {
  if (!isFinite(v) || v <= 0) return '';
  return String(Math.round(v * 100) / 100);
}

function fmtWidth(v) {
  return String(Math.round(v * 10) / 10) + '×';
}

function deleteOverlay(id) {
  state.overlays = state.overlays.filter((o) => o.id !== id);
  state.history = state.history.filter((h) => h !== id);
  renderOverlayList();
  draw();
}

function undo() {
  const id = state.history.pop();
  if (id === undefined) return;
  state.overlays = state.overlays.filter((o) => o.id !== id);
  renderOverlayList();
  draw();
}

// ---------- .glf project format ----------
function parseGlf(buf) {
  if (buf.byteLength < 8) throw new Error('format');
  const dv = new DataView(buf);
  const magic = String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3));
  if (magic !== 'GLF1') throw new Error('format');
  const metaLen = dv.getUint32(4, true);
  if (8 + metaLen > buf.byteLength) throw new Error('format');
  const meta = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 8, metaLen)));
  const videoBlob = new Blob([buf.slice(8 + metaLen)], { type: meta.videoMime || 'video/mp4' });
  return { meta, videoBlob };
}

function loadGlfFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = parseGlf(reader.result);
      pendingGlf = parsed;
      if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
      state.objectUrl = URL.createObjectURL(parsed.videoBlob);
      state.sourceBlob = parsed.videoBlob;
      state.videoName = parsed.meta.videoName || file.name;
      resetOverlays();
      video.src = state.objectUrl;
      uploadScreen.hidden = true;
      playerScreen.hidden = false;
      newVideoBtn.hidden = false;
      document.title = 'Golf Swing Analysis – ' + state.videoName;
    } catch (err) {
      alert('The file is not a valid .glf project.');
    }
  };
  reader.readAsArrayBuffer(file);
}

function applyGlfProject(meta) {
  const dur = video.duration || 0;
  if (isFinite(meta.fps) && meta.fps >= 8 && meta.fps <= 240) state.fps = meta.fps;
  state.trim.start =
    meta.trim && isFinite(meta.trim.start)
      ? Math.min(Math.max(0, meta.trim.start), dur)
      : 0;
  state.trim.end =
    meta.trim && isFinite(meta.trim.end) && meta.trim.end > 0
      ? Math.min(meta.trim.end, dur)
      : Infinity;
  state.overlays = [];
  state.history = [];
  state.nextId = 1;
  state.lineCount = 0;
  state.circleCount = 0;
  for (const o of meta.overlays || []) {
    const ov = overlayFromJson(o);
    if (ov) {
      state.overlays.push(ov);
      state.history.push(ov.id);
    }
  }
  renderOverlayList();
  if (isFinite(meta.speed)) {
    const sp = Math.min(1, Math.max(0.1, meta.speed));
    speedSlider.value = sp;
    video.playbackRate = sp;
    updateSpeedUI();
  }
  if (isFinite(meta.thickness)) {
    state.thickness = Math.min(3, Math.max(1, meta.thickness));
    thicknessSlider.value = state.thickness;
    thicknessValue.textContent = fmtWidth(state.thickness);
  }
  setMode('analysis');
}

async function saveGlf() {
  if (state.recording) return;
  if (!state.sourceBlob) {
    alert('No video loaded – please open a video first.');
    return;
  }
  const dur = video.duration || 0;
  const s = Math.max(0, Math.min(state.trim.start, dur));
  const e = isFinite(state.trim.end) ? Math.min(state.trim.end, dur) : dur;
  const needsTrim = e - s > 0.1 && (s > 0.01 || e < dur - 0.01);

  let videoBlob = state.sourceBlob;
  let shift = 0;
  let trimMeta = {
    start: state.trim.start,
    end: isFinite(state.trim.end) ? state.trim.end : null,
  };

  if (needsTrim) {
    // Embed the trimmed video instead of the full one
    if (typeof MediaRecorder === 'undefined' || typeof canvas.captureStream !== 'function') {
      alert(
        'Embedding the trimmed video needs recording support, which this browser lacks. ' +
        'Use “Save as file” first and then continue with the trimmed video.'
      );
      return;
    }
    glfStatus.hidden = false;
    glfStatus.textContent = 'Preparing trimmed video…';
    state.recording = true;
    try {
      videoBlob = await recordTrimmedRange((pct, unknownEnd) => {
        glfStatus.textContent = unknownEnd
          ? 'Preparing trimmed video… ' + pct + ' s'
          : 'Preparing trimmed video… ' + pct + ' %';
      });
    } catch (err) {
      state.recording = false;
      const code = err && err.message;
      glfStatus.textContent =
        code === 'playback'
          ? 'Playback stalled – the video could not be played through. Please try again.'
          : code === 'timeout'
            ? 'Creating the trimmed video timed out – please try again.'
            : code === 'empty'
              ? 'Could not create the trimmed video – no video data was captured. Please try again.'
              : 'Could not create the trimmed video.';
      return;
    }
    state.recording = false;
    shift = s;
    trimMeta = { start: 0, end: null }; // the embedded video is already trimmed
  }

  const meta = {
    app: 'golf-swing-analysis',
    version: 1,
    videoName: state.videoName || 'video',
    videoMime: videoBlob.type || 'video/mp4',
    fps: state.fps,
    speed: parseFloat(speedSlider.value),
    thickness: state.thickness,
    trim: trimMeta,
    overlays: state.overlays.map((o) => ({
      id: o.id,
      type: o.type,
      label: o.label,
      color: o.color,
      width: o.width,
      start: Math.max(0, (o.start || 0) - shift),
      end: isFinite(o.end) ? Math.max(0, o.end - shift) : Infinity,
      visible: o.visible,
      pts: o.pts,
    })),
  };
  const metaBytes = new TextEncoder().encode(JSON.stringify(meta));
  const header = new ArrayBuffer(8 + metaBytes.byteLength);
  const dv = new DataView(header);
  new Uint8Array(header, 0, 4).set([0x47, 0x4c, 0x46, 0x31]); // magic “GLF1”
  dv.setUint32(4, metaBytes.byteLength, true);
  new Uint8Array(header, 8, metaBytes.byteLength).set(metaBytes);
  const blob = new Blob([header, videoBlob], { type: 'application/octet-stream' });
  downloadBlob(blob, 'swing-analysis.glf');
  glfStatus.hidden = true;
}

// ---------- Export / Import ----------
function exportOverlays() {
  if (!state.overlays.length) {
    alert('No overlays to export.');
    return;
  }
  const data = {
    app: 'golf-swing-analysis',
    version: 1,
    overlays: state.overlays.map((o) => ({
      id: o.id,
      type: o.type,
      label: o.label,
      color: o.color,
      start: o.start,
      end: o.end,
      visible: o.visible,
      width: o.width,
      pts: o.pts,
    })),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'golf-swing-analysis-overlays.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function overlayFromJson(o) {
  if (!o || !o.type || !Array.isArray(o.pts) || o.pts.length !== 2) return null;
  const isCircle = o.type === 'circle';
  return {
    id: state.nextId++,
    type: isCircle ? 'circle' : 'line',
    label: isCircle ? 'Circle ' + ++state.circleCount : 'Line ' + ++state.lineCount,
    color: /^#[0-9a-fA-F]{6}$/.test(o.color || '') ? o.color : COLORS[0],
    width: isFinite(o.width) ? Math.min(3, Math.max(1, o.width)) : 1,
    start: isFinite(o.start) && o.start > 0 ? o.start : 0,
    end: isFinite(o.end) && o.end > 0 ? o.end : Infinity,
    visible: o.visible !== false,
    pts: [
      { x: Number(o.pts[0].x) || 0, y: Number(o.pts[0].y) || 0 },
      { x: Number(o.pts[1].x) || 0, y: Number(o.pts[1].y) || 0 },
    ],
  };
}

function importOverlays(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      const arr = Array.isArray(data) ? data : data.overlays;
      if (!Array.isArray(arr)) throw new Error('format');
      const imported = [];
      for (const o of arr) {
        const ov = overlayFromJson(o);
        if (ov) imported.push(ov);
      }
      state.overlays.push(...imported);
      state.history.push(...imported.map((o) => o.id));
      renderOverlayList();
      draw();
      alert(imported.length + ' overlay(s) imported.');
    } catch (err) {
      alert('Import failed: the file is not a valid overlay JSON.');
    }
  };
  reader.readAsText(file);
}

// ---------- Keyboard ----------
function onKeydown(e) {
  if (e.target.matches('input, textarea')) return;
  if (e.code === 'Space') {
    if (e.target.closest('button')) return; // use the native button activation
    e.preventDefault();
    togglePlay();
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault();
    stepFrame(-1);
  } else if (e.key === 'ArrowRight') {
    e.preventDefault();
    stepFrame(1);
  } else if (e.key === 'Escape') {
    cancelDrawing();
  } else if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 'l') {
    setTool('line');
  } else if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 'c') {
    setTool('circle');
  } else if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 'm') {
    setTool('move');
  } else if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === '[') {
    adjustThickness(-0.5);
  } else if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key === ']') {
    adjustThickness(0.5);
  } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    undo();
  }
}

// ---------- Initialization ----------
function init() {
  buildColorRow();

  chooseFileBtn.addEventListener('click', () => videoInput.click());
  videoInput.addEventListener('change', () => {
    if (videoInput.files[0]) loadFile(videoInput.files[0]);
    videoInput.value = '';
  });
  chooseGlfBtn.addEventListener('click', () => glfInput.click());
  glfInput.addEventListener('change', () => {
    if (glfInput.files[0]) loadGlfFile(glfInput.files[0]);
    glfInput.value = '';
  });
  newVideoBtn.addEventListener('click', resetToUpload);

  ['dragover', 'dragenter'].forEach((ev) =>
    dropZone.addEventListener(ev, (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    })
  );
  ['dragleave', 'drop'].forEach((ev) =>
    dropZone.addEventListener(ev, (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
    })
  );
  dropZone.addEventListener('drop', (e) => {
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (!f) return;
    if (f.name.toLowerCase().endsWith('.glf')) {
      loadGlfFile(f);
    } else {
      loadFile(f);
    }
  });

  toolLineBtn.addEventListener('click', () => setTool('line'));
  toolCircleBtn.addEventListener('click', () => setTool('circle'));
  toolMoveBtn.addEventListener('click', () => setTool('move'));
  undoBtn.addEventListener('click', undo);

  playPauseBtn.addEventListener('click', togglePlay);
  bindStepButton(stepBackBtn, -1);
  bindStepButton(stepFwdBtn, 1);

  trimSetStartBtn.addEventListener('click', () => setTrimPosition('start'));
  trimSetEndBtn.addEventListener('click', () => setTrimPosition('end'));
  trimPlayBtn.addEventListener('click', onTrimPlay);
  trimPlayRangeBtn.addEventListener('click', onTrimPlayRange);
  trimSaveBtn.addEventListener('click', exportTrimmedVideo);
  trimApplyBtn.addEventListener('click', applyTrimAndAnalyze);
  trimEditBtn.addEventListener('click', () => setMode('trim'));
  trimResetBtn.addEventListener('click', () => {
    state.trim.start = 0;
    state.trim.end = Infinity;
    updateTrimUI();
  });
  trimStartInput.addEventListener('input', onTrimInput);
  trimEndInput.addEventListener('input', onTrimInput);
  trimStartInput.addEventListener('change', () => {
    if (state.mode === 'trim') updateTrimUI(); // normalize when leaving the field
  });
  trimEndInput.addEventListener('change', () => {
    if (state.mode === 'trim') updateTrimUI();
  });

  speedSlider.addEventListener('input', () => {
    video.playbackRate = parseFloat(speedSlider.value);
    updateSpeedUI();
  });
  thicknessSlider.addEventListener('input', () => {
    state.thickness = parseFloat(thicknessSlider.value);
    thicknessValue.textContent = fmtWidth(state.thickness);
  });
  document.querySelectorAll('.chip').forEach((ch) =>
    ch.addEventListener('click', () => {
      speedSlider.value = ch.dataset.speed;
      video.playbackRate = parseFloat(ch.dataset.speed);
      updateSpeedUI();
    })
  );

  scrubber.addEventListener('pointerdown', (e) => {
    try {
      scrubber.setPointerCapture(e.pointerId);
    } catch (err) {
      /* implicit capture is enough */
    }
    wasPlayingBeforeScrub = !video.paused;
  });
  scrubber.addEventListener('pointerup', onScrubEnd);
  scrubber.addEventListener('pointercancel', onScrubEnd);
  scrubber.addEventListener('input', () => {
    if (state.recording || !isFinite(video.duration)) return;
    if (!video.paused) video.pause(); // pause while dragging
    pushScrubSeek(parseFloat(scrubber.value) / 100);
    updateTimeDisplay();
  });

  video.addEventListener('loadedmetadata', onLoadedMetadata);
  video.addEventListener('timeupdate', onTimeUpdate);
  video.addEventListener('seeked', onSeeked);
  video.addEventListener('play', () => {
    playPauseBtn.textContent = '⏸';
    if (state.mode === 'trim') trimPlayBtn.textContent = '⏸ Pause';
    startLoop();
  });
  video.addEventListener('pause', () => {
    playPauseBtn.textContent = '▶';
    if (state.mode === 'trim') trimPlayBtn.textContent = '▶ Play';
    stopLoop();
  });
  video.addEventListener('ended', () => {
    playPauseBtn.textContent = '▶';
    if (state.mode === 'trim') trimPlayBtn.textContent = '▶ Play';
    stopLoop();
  });
  video.addEventListener('error', () =>
    alert('The video could not be loaded. Please check the format (e.g., MP4/H.264).')
  );

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('pointerleave', () => {
    if (state.hover !== null) {
      state.hover = null;
      draw();
    }
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  overlayToggle.addEventListener('click', () => {
    const hidden = overlayContent.classList.toggle('hidden');
    overlayToggle.textContent =
      'Overlays (' + state.overlays.length + ') ' + (hidden ? '▸' : '▾');
    overlayToggle.setAttribute('aria-expanded', String(!hidden));
  });
  overlayList.addEventListener('click', onListClick);
  overlayList.addEventListener('input', onListInput);
  overlayList.addEventListener('change', onListChange);

  exportBtn.addEventListener('click', exportOverlays);
  saveGlfBtn.addEventListener('click', saveGlf);
  importBtn.addEventListener('click', () => importInput.click());
  importInput.addEventListener('change', () => {
    if (importInput.files[0]) importOverlays(importInput.files[0]);
    importInput.value = '';
  });
  clearAllBtn.addEventListener('click', () => {
    if (state.overlays.length && confirm('Delete all overlays?')) {
      resetOverlays();
      draw();
    }
  });

  document.addEventListener('keydown', onKeydown);
  window.addEventListener('resize', fitStage);

  // Desktop: list open by default, mobile: collapsed
  if (window.matchMedia('(min-width: 901px)').matches) {
    overlayContent.classList.remove('hidden');
    overlayToggle.setAttribute('aria-expanded', 'true');
    overlayToggle.textContent = 'Overlays (0) ▾';
  }

  ctx.lineCap = 'round';
  thicknessValue.textContent = fmtWidth(state.thickness);
  updateSpeedUI();
  setTool('line');
}

init();
