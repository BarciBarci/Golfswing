'use strict';

/* ============================================================
 * Golf-Schwunganalyse
 * Video laden, langsam abspielen und Linien/Kreise überlagern.
 * Läuft komplett lokal im Browser – keine Server, keine Uploads.
 * ============================================================ */

// ---------- DOM ----------
const $ = (id) => document.getElementById(id);

const uploadScreen = $('upload-screen');
const playerScreen = $('player-screen');
const dropZone = $('drop-zone');
const videoInput = $('video-input');
const chooseFileBtn = $('choose-file-btn');
const newVideoBtn = $('new-video-btn');

const video = $('video');
const canvas = $('overlay');
const ctx = canvas.getContext('2d');
const stage = $('stage');

const toolLineBtn = $('tool-line');
const toolCircleBtn = $('tool-circle');
const undoBtn = $('undo-btn');
const drawHint = $('draw-hint');

const playPauseBtn = $('play-pause');
const stepBackBtn = $('step-back');
const stepFwdBtn = $('step-fwd');
const timeDisplay = $('time-display');
const speedSlider = $('speed-slider');
const speedValue = $('speed-value');
const scrubber = $('scrubber');

const overlayToggle = $('overlay-toggle');
const overlayContent = $('overlay-content');
const overlayList = $('overlay-list');
const overlayEmpty = $('overlay-empty');
const exportBtn = $('export-btn');
const importBtn = $('import-btn');
const importInput = $('import-input');
const clearAllBtn = $('clear-all-btn');

// ---------- Zustand ----------
const COLORS = [
  '#ff3b30', '#ff9500', '#ffd60a', '#30d158',
  '#64d2ff', '#0a84ff', '#bf5af2', '#ffffff', '#1c1c1e',
];

const state = {
  tool: 'line',
  color: COLORS[0],
  overlays: [],          // [{id, type, label, color, start, end, visible, pts:[{x,y},{x,y}]}]
  history: [],           // Overlay-IDs in Erstellreihenfolge (für Rückgängig)
  nextId: 1,
  lineCount: 0,
  circleCount: 0,
  drawing: null,         // aktuell gezeichnetes Overlay (Vorschau)
  pointerId: null,
  fps: 30,               // für Einzelbild-Schritt
  ar: 16 / 9,            // Video-Seitenverhältnis
  objectUrl: null,
};

// ---------- Video laden ----------
function loadFile(file) {
  if (!file.type.startsWith('video/')) {
    alert('Bitte eine Videodatei auswählen (z. B. MP4).');
    return;
  }
  if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
  state.objectUrl = URL.createObjectURL(file);

  resetOverlays();
  video.src = state.objectUrl;

  uploadScreen.hidden = true;
  playerScreen.hidden = false;
  newVideoBtn.hidden = false;
  document.title = 'Golf-Schwunganalyse – ' + file.name;
}

function onLoadedMetadata() {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) return;
  state.ar = w / h;
  canvas.width = w;
  canvas.height = h;
  if (isFinite(video.duration)) scrubber.max = Math.round(video.duration * 100);
  fitStage();
  estimateFps();
  draw();
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
  const t0 = performance.now();
  let frames = 0;
  const cb = () => {
    frames++;
    const dt = performance.now() - t0;
    if (dt >= 1000) {
      state.fps = Math.max(1, Math.round(frames / (dt / 1000)));
      return;
    }
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
  resetOverlays();
  stage.style.width = '';
  stage.style.height = '';
  canvas.width = 0;
  canvas.height = 0;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  scrubber.value = 0;
  timeDisplay.textContent = '0:00.0 / 0:00.0';
  playPauseBtn.textContent = '▶';
  uploadScreen.hidden = false;
  playerScreen.hidden = true;
  newVideoBtn.hidden = true;
  document.title = 'Golf-Schwunganalyse';
}

function resetOverlays() {
  state.overlays = [];
  state.history = [];
  state.nextId = 1;
  state.lineCount = 0;
  state.circleCount = 0;
  state.drawing = null;
  state.pointerId = null;
  renderOverlayList();
}

// ---------- Wiedergabe ----------
function togglePlay() {
  if (!video.src) return;
  if (video.paused) {
    video.play().catch(() => {});
  } else {
    video.pause();
  }
}

function stepFrame(dir) {
  if (!video.src || !isFinite(video.duration)) return;
  video.pause();
  const dt = 1 / state.fps;
  video.currentTime = Math.min(
    Math.max(video.currentTime + dir * dt, 0),
    video.duration
  );
}

function onTimeUpdate() {
  updateScrubber();
  updateTimeDisplay();
}

function updateScrubber() {
  if (isFinite(video.duration)) scrubber.value = video.currentTime * 100;
}

function updateTimeDisplay() {
  const t = video.currentTime || 0;
  const d = video.duration || 0;
  timeDisplay.textContent = fmt(t) + ' / ' + fmt(d);
}

function fmt(s) {
  s = Math.max(0, s);
  const m = Math.floor(s / 60);
  const sec = s - m * 60;
  const whole = Math.floor(sec);
  const tenth = Math.floor((sec - whole) * 10);
  return m + ':' + String(whole).padStart(2, '0') + '.' + tenth;
}

// ---------- Werkzeuge ----------
function setTool(t) {
  state.tool = t;
  cancelDrawing();
  toolLineBtn.classList.toggle('active', t === 'line');
  toolCircleBtn.classList.toggle('active', t === 'circle');
  toolLineBtn.setAttribute('aria-pressed', t === 'line');
  toolCircleBtn.setAttribute('aria-pressed', t === 'circle');
  drawHint.textContent =
    t === 'line'
      ? 'Linie: auf das Video tippen/ziehen – Startpunkt bis Loslassen'
      : 'Kreis: auf das Video tippen/ziehen – Mitte bis Radius';
}

function cancelDrawing() {
  if (state.drawing) {
    state.drawing = null;
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
    b.title = 'Farbe ' + c;
    b.dataset.color = c;
    b.addEventListener('click', () => selectColor(c));
    row.appendChild(b);
  });
  selectColor(state.color);
}

// ---------- Zeichnen auf dem Canvas ----------
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
  if (!video.src || state.pointerId !== null) return;
  e.preventDefault();
  state.pointerId = e.pointerId;
  try {
    canvas.setPointerCapture(e.pointerId);
  } catch (err) {
    /* impliziter Capture reicht */
  }
  const p = toCanvas(e);
  state.drawing = {
    id: state.nextId++,
    type: state.tool,
    color: state.color,
    start: 0,
    end: Infinity,
    visible: true,
    pts: [p, p],
  };
  draw();
}

function onPointerMove(e) {
  if (state.pointerId !== e.pointerId || !state.drawing) return;
  e.preventDefault();
  state.drawing.pts[1] = toCanvas(e);
  draw();
}

function onPointerUp(e) {
  if (state.pointerId !== e.pointerId) return;
  state.pointerId = null;
  const d = state.drawing;
  state.drawing = null;
  if (d && isValid(d)) {
    const label =
      d.type === 'line' ? 'Linie ' + ++state.lineCount : 'Kreis ' + ++state.circleCount;
    d.label = label;
    state.overlays.push(d);
    state.history.push(d.id);
  }
  renderOverlayList();
  draw();
}

function isValid(d) {
  const [a, b] = d.pts;
  return Math.hypot(b.x - a.x, b.y - a.y) >= 5; // kleine Tippfehler ignorieren
}

// ---------- Zeichnen ----------
function draw() {
  if (!video.src) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const t = video.currentTime || 0;
  const lw = Math.max(2, canvas.width / 300);
  for (const o of state.overlays) {
    if (!o.visible) continue;
    if (t < o.start || t > o.end) continue;
    paintOverlay(o, lw, false);
  }
  if (state.drawing) paintOverlay(state.drawing, lw, true);
}

function paintOverlay(o, lw, preview) {
  ctx.strokeStyle = o.color;
  ctx.lineWidth = lw;
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

// ---------- Animationsschleife (nur während Wiedergabe) ----------
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

// ---------- Geschwindigkeit ----------
function updateSpeedUI() {
  const v = parseFloat(speedSlider.value);
  speedValue.textContent = v.toFixed(2).replace('.', ',') + '×';
  document.querySelectorAll('.chip').forEach((c) => {
    c.classList.toggle('active', Math.abs(parseFloat(c.dataset.speed) - v) < 0.001);
  });
}

// ---------- Überlagerungs-Liste ----------
function renderOverlayList() {
  overlayEmpty.hidden = state.overlays.length > 0;
  const collapsed = overlayContent.classList.contains('hidden');
  overlayToggle.textContent =
    'Überlagerungen (' + state.overlays.length + ') ' + (collapsed ? '▸' : '▾');
  overlayToggle.setAttribute('aria-expanded', String(!collapsed));

  overlayList.innerHTML = '';
  for (const o of state.overlays) {
    const li = document.createElement('li');
    li.className = 'overlay-item';
    li.dataset.id = o.id;
    li.innerHTML =
      '<span class="ov-color" style="background:' + o.color + '"></span>' +
      '<span class="ov-name">' + (o.label || o.type) + '</span>' +
      '<span class="ov-time">von <input type="text" inputmode="decimal" data-field="start" value="' +
      fmtInput(o.start) + '" placeholder="0"></span>' +
      '<span class="ov-time">bis <input type="text" inputmode="decimal" data-field="end" value="' +
      fmtInput(o.end) + '" placeholder="∞"></span>' +
      '<button class="ov-vis' + (o.visible ? '' : ' off') +
      '" title="Sichtbarkeit umschalten">' + (o.visible ? '👁' : '🚫') + '</button>' +
      '<button class="ov-del" title="Löschen">✕</button>';
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
  // Eingabe nach dem Verlassen des Feldes normalisieren ('' = 0 bzw. ∞)
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

// ---------- Export / Import ----------
function exportOverlays() {
  if (!state.overlays.length) {
    alert('Keine Überlagerungen zum Exportieren vorhanden.');
    return;
  }
  const data = {
    app: 'golf-schwunganalyse',
    version: 1,
    overlays: state.overlays.map((o) => ({
      id: o.id,
      type: o.type,
      label: o.label,
      color: o.color,
      start: o.start,
      end: o.end,
      visible: o.visible,
      pts: o.pts,
    })),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'golf-schwunganalyse-ueberlagerungen.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
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
        if (!o || !o.type || !Array.isArray(o.pts) || o.pts.length !== 2) continue;
        imported.push({
          id: state.nextId++,
          type: o.type === 'circle' ? 'circle' : 'line',
          label:
            o.type === 'circle'
              ? 'Kreis ' + ++state.circleCount
              : 'Linie ' + ++state.lineCount,
          color: /^#[0-9a-fA-F]{6}$/.test(o.color || '') ? o.color : COLORS[0],
          start: isFinite(o.start) && o.start > 0 ? o.start : 0,
          end: isFinite(o.end) && o.end > 0 ? o.end : Infinity,
          visible: o.visible !== false,
          pts: [
            { x: Number(o.pts[0].x) || 0, y: Number(o.pts[0].y) || 0 },
            { x: Number(o.pts[1].x) || 0, y: Number(o.pts[1].y) || 0 },
          ],
        });
      }
      state.overlays.push(...imported);
      state.history.push(...imported.map((o) => o.id));
      renderOverlayList();
      draw();
      alert(imported.length + ' Überlagerung(en) importiert.');
    } catch (err) {
      alert('Import fehlgeschlagen: Datei ist kein gültiges Überlagerungs-JSON.');
    }
  };
  reader.readAsText(file);
}

// ---------- Tastatur ----------
function onKeydown(e) {
  if (e.target.matches('input, textarea')) return;
  if (e.code === 'Space') {
    if (e.target.closest('button')) return; // native Button-Aktivierung nutzen
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
  } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    undo();
  }
}

// ---------- Initialisierung ----------
function init() {
  buildColorRow();

  chooseFileBtn.addEventListener('click', () => videoInput.click());
  videoInput.addEventListener('change', () => {
    if (videoInput.files[0]) loadFile(videoInput.files[0]);
    videoInput.value = '';
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
    if (f) loadFile(f);
  });

  toolLineBtn.addEventListener('click', () => setTool('line'));
  toolCircleBtn.addEventListener('click', () => setTool('circle'));
  undoBtn.addEventListener('click', undo);

  playPauseBtn.addEventListener('click', togglePlay);
  stepBackBtn.addEventListener('click', () => stepFrame(-1));
  stepFwdBtn.addEventListener('click', () => stepFrame(1));

  speedSlider.addEventListener('input', () => {
    video.playbackRate = parseFloat(speedSlider.value);
    updateSpeedUI();
  });
  document.querySelectorAll('.chip').forEach((ch) =>
    ch.addEventListener('click', () => {
      speedSlider.value = ch.dataset.speed;
      video.playbackRate = parseFloat(ch.dataset.speed);
      updateSpeedUI();
    })
  );

  scrubber.addEventListener('input', () => {
    if (isFinite(video.duration)) {
      video.currentTime = parseFloat(scrubber.value) / 100;
      draw();
      updateTimeDisplay();
    }
  });

  video.addEventListener('loadedmetadata', onLoadedMetadata);
  video.addEventListener('timeupdate', onTimeUpdate);
  video.addEventListener('seeked', draw);
  video.addEventListener('play', () => {
    playPauseBtn.textContent = '⏸';
    startLoop();
  });
  video.addEventListener('pause', () => {
    playPauseBtn.textContent = '▶';
    stopLoop();
  });
  video.addEventListener('ended', () => {
    playPauseBtn.textContent = '▶';
    stopLoop();
  });
  video.addEventListener('error', () =>
    alert('Das Video konnte nicht geladen werden. Bitte Format prüfen (z. B. MP4/H.264).')
  );

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  overlayToggle.addEventListener('click', () => {
    const hidden = overlayContent.classList.toggle('hidden');
    overlayToggle.textContent =
      'Überlagerungen (' + state.overlays.length + ') ' + (hidden ? '▸' : '▾');
    overlayToggle.setAttribute('aria-expanded', String(!hidden));
  });
  overlayList.addEventListener('click', onListClick);
  overlayList.addEventListener('input', onListInput);
  overlayList.addEventListener('change', onListChange);

  exportBtn.addEventListener('click', exportOverlays);
  importBtn.addEventListener('click', () => importInput.click());
  importInput.addEventListener('change', () => {
    if (importInput.files[0]) importOverlays(importInput.files[0]);
    importInput.value = '';
  });
  clearAllBtn.addEventListener('click', () => {
    if (state.overlays.length && confirm('Alle Überlagerungen löschen?')) {
      resetOverlays();
      draw();
    }
  });

  document.addEventListener('keydown', onKeydown);
  window.addEventListener('resize', fitStage);

  // Desktop: Liste standardmäßig offen, Mobil: zugeklappt
  if (window.matchMedia('(min-width: 901px)').matches) {
    overlayContent.classList.remove('hidden');
    overlayToggle.setAttribute('aria-expanded', 'true');
    overlayToggle.textContent = 'Überlagerungen (0) ▾';
  }

  ctx.lineCap = 'round';
  updateSpeedUI();
  setTool('line');
}

init();
