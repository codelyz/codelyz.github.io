import { Input } from './input.js';
import { Sound } from './audio.js';
import { Particles } from './fx.js';
import { loadSettings, saveSettings } from './settings.js';
import { PALETTES, drawMoon, starPath } from './draw.js';
import { CoresMode } from './modes/cores.js';
import { SigaMode } from './modes/siga.js';
import { BolhasMode } from './modes/bolhas.js';
import { DiaNoiteMode } from './modes/dianoite.js';

const MODES = {
  cores: { cls: CoresMode, name: 'Cores' },
  siga: { cls: SigaMode, name: 'Siga a luz' },
  bolhas: { cls: BolhasMode, name: 'Bolhas' },
  dianoite: { cls: DiaNoiteMode, name: 'Dia e noite' },
};
const HOLD_MS = 2000;

const $ = (id) => document.getElementById(id);
const canvas = $('stage');
const ctx = canvas.getContext('2d');
const startEl = $('start'), menuEl = $('menu'), gear = $('gear');
const toastEl = $('toast'), audioHint = $('audioHint'), endChip = $('endChip');

const settings = loadSettings();
const sound = new Sound();
sound.setVolume(settings.volume);
const input = new Input(canvas);
const fx = new Particles();

// Objeto compartilhado com os modos.
const app = {
  w: 0, h: 0, t: 0,
  settings, sound, input, fx,
  padKind: 'xbox',
  get calm() { return !!settings.calm; },
  palette() {
    const k = settings.palette === 'auto' ? app.padKind : settings.palette;
    return PALETTES[k] || PALETTES.xbox;
  },
  feedback(e, strength = 0.5, ms = 120) {
    if (!settings.vibration || !e) return;
    if (e.source === 'pad') input.rumble(e.pad, strength, ms);
    else if (e.source === 'touch' && e.pointerType === 'touch' && navigator.vibrate) {
      try { navigator.vibrate(Math.max(8, Math.round(ms * 0.12))); } catch { /* ok */ }
    }
  },
  rumbleAll(strength, ms) { if (settings.vibration) input.rumble(null, strength, ms); },
};

let state = 'start';          // start | play | menu | ended
let menuFrom = null;
let mode = null;
let modeKey = MODES[settings.mode] ? settings.mode : 'cores';
let elapsed = 0;
let dpr = 1;

/* ---------------- Tela final (a lua dorme) ---------------- */
const endScene = {
  fade: 0, zs: [], zt: 0,
  stars: Array.from({ length: 50 }, () => ({ x: Math.random(), y: Math.random() * 0.8, s: 1 + Math.random() * 2.5, ph: Math.random() * 6.28 })),
  reset() { this.fade = 0; this.zs = []; this.zt = 0; },
  press(e) {
    if (e.source === 'touch') fx.emit(e.x, e.y, { count: 4, colors: ['#fff6c8'], speed: [30, 80], size: [3, 6], gravity: -20, life: [0.8, 1.2] });
  },
  update(dt) {
    this.fade = Math.min(1, this.fade + dt / 2.5);
    this.zt += dt;
    if (this.zt > 1.6) { this.zt = 0; this.zs.push({ age: 0 }); }
    for (const z of this.zs) z.age += dt;
    this.zs = this.zs.filter((z) => z.age < 4);
  },
  draw(c, w, h, t) {
    const m = Math.min(w, h);
    c.save();
    c.globalAlpha = this.fade;
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#0b1030');
    g.addColorStop(1, '#1c2452');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    for (const s of this.stars) {
      c.fillStyle = `rgba(255,250,220,${0.35 + 0.3 * Math.sin(t * 0.6 + s.ph)})`;
      starPath(c, s.x * w, s.y * h, s.s * (m / 400), 4, 0.45, 0);
      c.fill();
    }
    const cx = w / 2, cy = h * 0.45, r = m * 0.16;
    drawMoon(c, cx, cy + Math.sin(t * 0.8) * m * 0.008, r, { glow: 0.2, t });
    c.font = `700 ${Math.round(m * 0.05)}px ui-rounded, system-ui, sans-serif`;
    c.textAlign = 'center';
    for (const z of this.zs) {
      c.fillStyle = `rgba(255,255,255,${(1 - z.age / 4) * 0.8})`;
      c.fillText('z', cx + r * 0.9 + z.age * m * 0.05 + Math.sin(z.age * 2) * m * 0.02, cy - r * 0.6 - z.age * m * 0.07);
    }
    c.restore();
  },
};

/* ---------------- Tamanho do canvas ---------------- */
function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth || window.innerWidth;
  const h = canvas.clientHeight || window.innerHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  app.w = w;
  app.h = h;
  mode?.resize?.(w, h);
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));

/* ---------------- Modos ---------------- */
function setMode(key) {
  if (!MODES[key]) key = 'cores';
  mode?.pause?.();
  sound.setDrone(0);
  fx.clear();
  modeKey = key;
  settings.mode = key;
  saveSettings(settings);
  mode = new MODES[key].cls(app);
  mode.resize?.(app.w, app.h);
  refreshMenu();
}

/* ---------------- Estados ---------------- */
function showStart() {
  state = 'start';
  input.uiActive = true;
  startEl.hidden = false;
  gear.hidden = true;
  $('startMode').textContent = `· ${MODES[modeKey].name}`;
  $('startBtn').focus({ preventScroll: true });
}

function startPlay(gesture) {
  if (state !== 'start' && state !== 'menu') return;
  sound.ensure();
  if (gesture) requestFs();
  startEl.hidden = true;
  menuEl.hidden = true;
  menuFrom = null;
  input.uiActive = false;
  state = 'play';
  elapsed = 0;
  endScene.reset();
  endChip.hidden = true;
  gear.hidden = false;
  document.activeElement?.blur?.();
  keepAwake();
  setTimeout(checkAudio, 600);
}

function endSession() {
  state = 'ended';
  mode?.pause?.();
  sound.setDrone(0);
  sound.lullaby();
  endScene.reset();
  endChip.hidden = false;
  releaseAwake();
}

function openMenu() {
  if (state === 'menu') return;
  menuFrom = state;
  mode?.pause?.();
  sound.setDrone(0);
  state = 'menu';
  input.uiActive = true;
  startEl.hidden = true;
  menuEl.hidden = false;
  endChip.hidden = true;
  refreshMenu();
  $('closeMenu').textContent = menuFrom === 'start' ? 'Voltar' : menuFrom === 'ended' ? 'Brincar de novo' : 'Voltar a brincar';
  const current = menuEl.querySelector(`.mode-card[data-mode="${modeKey}"]`);
  (current || $('closeMenu')).focus({ preventScroll: true });
}

function closeMenu(fromModePick) {
  const from = menuFrom;
  menuEl.hidden = true;
  if (from === 'start') {
    menuFrom = null;
    if (fromModePick) { state = 'start'; startPlay(true); }
    else showStart();
    return;
  }
  menuFrom = null;
  input.uiActive = false;
  if (from === 'ended') { elapsed = 0; endScene.reset(); }
  state = 'play';
  gear.hidden = false;
  document.activeElement?.blur?.();
  keepAwake();
}

/* ---------------- Entrada ---------------- */
input.on('press', (e) => {
  if (state === 'ended') { endScene.press(e); return; }
  if (state !== 'play') return;
  mode.press(e);
});
input.on('move', (e) => { if (state === 'play') mode.move?.(e); });
input.on('release', (e) => { if (state === 'play') mode.release?.(e); });
input.on('releaseall', () => mode?.releaseAll?.());
input.on('parent', () => { if (state === 'play' || state === 'ended') openMenu(); });
input.on('nav', (dir) => navigate(dir));
input.on('padconnect', (gp) => {
  app.padKind = detectPadKind();
  toast(`🎮 ${shortName(gp.id)} conectado`);
  sound.connected();
  refreshMenu();
});
input.on('paddisconnect', () => { app.padKind = detectPadKind(); toast('🎮 Controle desconectado'); refreshMenu(); });

// Qualquer toque/tecla na página destrava o áudio (exigência dos navegadores).
for (const ev of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']) {
  document.addEventListener(ev, () => {
    sound.ensure();
    if (!audioHint.hidden) setTimeout(checkAudio, 150);
  }, { capture: true, passive: true });
}
document.addEventListener('pointerdown', () => document.body.classList.remove('nav'), { capture: true });
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && state === 'play') { keepAwake(); sound.ensure(); }
  if (document.visibilityState === 'hidden') { input.releaseAll(); sound.setDrone(0); }
});

/** Navegação por joystick/setas na tela inicial e no menu. */
function navigate(dir) {
  const root = state === 'start' ? startEl : state === 'menu' ? menuEl : null;
  if (!root) return;
  document.body.classList.add('nav');
  if (state === 'start') {
    if (dir === 'other' || dir === 'back') { startPlay(false); return; }
    if (dir === 'escape') return;
  } else {
    if (dir === 'back' || dir === 'escape') { closeMenu(false); return; }
    if (dir === 'other') return;
  }
  const items = [...root.querySelectorAll('button, input, summary')].filter((el) => el.offsetParent !== null && !el.disabled);
  const cur = document.activeElement;
  if (!items.includes(cur)) { items[0]?.focus(); return; }
  if (dir === 'select') { if (cur.type !== 'range') cur.click(); return; }
  if (cur.type === 'range' && (dir === 'left' || dir === 'right')) {
    cur.value = String(Math.min(1, Math.max(0, +cur.value + (dir === 'right' ? 0.1 : -0.1))));
    cur.dispatchEvent(new Event('input', { bubbles: true }));
    cur.dispatchEvent(new Event('change', { bubbles: true }));
    return;
  }
  const r0 = cur.getBoundingClientRect();
  const c0 = { x: r0.left + r0.width / 2, y: r0.top + r0.height / 2 };
  let best = null, bestScore = Infinity;
  for (const el of items) {
    if (el === cur) continue;
    const r = el.getBoundingClientRect();
    const dx = r.left + r.width / 2 - c0.x, dy = r.top + r.height / 2 - c0.y;
    const main = dir === 'up' ? -dy : dir === 'down' ? dy : dir === 'left' ? -dx : dx;
    const side = dir === 'up' || dir === 'down' ? Math.abs(dx) : Math.abs(dy);
    if (main <= 4) continue;
    const score = main + side * 2.5;
    if (score < bestScore) { bestScore = score; best = el; }
  }
  if (best) { best.focus({ preventScroll: true }); best.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
}

/* ---------------- Botão do adulto (segurar) ---------------- */
let holdStart = 0, holdRaf = 0;
function holdTick() {
  const p = Math.min(1, (performance.now() - holdStart) / HOLD_MS);
  gear.style.setProperty('--p', p.toFixed(3));
  if (p >= 1) { cancelHold(); openMenu(); return; }
  holdRaf = requestAnimationFrame(holdTick);
}
function cancelHold() {
  cancelAnimationFrame(holdRaf);
  holdStart = 0;
  gear.classList.remove('holding');
  gear.style.setProperty('--p', 0);
}
gear.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  e.stopPropagation();
  holdStart = performance.now();
  gear.classList.add('holding');
  holdTick();
});
for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) gear.addEventListener(ev, cancelHold);
gear.addEventListener('contextmenu', (e) => e.preventDefault());

/* ---------------- Menu ---------------- */
$('startBtn').addEventListener('click', () => startPlay(true));
$('startMenuBtn').addEventListener('click', () => openMenu());
$('closeMenu').addEventListener('click', () => closeMenu(false));

menuEl.querySelectorAll('.mode-card').forEach((btn) => {
  btn.addEventListener('click', () => { setMode(btn.dataset.mode); closeMenu(true); });
});

const vol = $('volume');
vol.addEventListener('input', () => { settings.volume = +vol.value; sound.setVolume(settings.volume); saveSettings(settings); });
vol.addEventListener('change', () => { sound.ensure(); sound.bell(659.25, { gain: 0.25 }); });

function bindSeg(id, key, parse) {
  $(id).querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
    settings[key] = parse(b.dataset.v);
    saveSettings(settings);
    refreshMenu();
  }));
}
bindSeg('sessionSeg', 'sessionMin', Number);
bindSeg('paletteSeg', 'palette', String);

function bindToggle(id, key, onChange) {
  $(id).addEventListener('click', () => {
    settings[key] = !settings[key];
    saveSettings(settings);
    refreshMenu();
    onChange?.(settings[key]);
  });
}
bindToggle('vibToggle', 'vibration', (on) => { if (on) app.rumbleAll(0.5, 160); });
bindToggle('calmToggle', 'calm');

$('fsBtn').addEventListener('click', () => {
  if (isFs()) { (document.exitFullscreen || document.webkitExitFullscreen)?.call(document); }
  else requestFs();
  setTimeout(refreshMenu, 300);
});

function refreshMenu() {
  menuEl.querySelectorAll('.mode-card').forEach((b) => b.classList.toggle('on', b.dataset.mode === modeKey));
  vol.value = String(settings.volume);
  $('sessionSeg').querySelectorAll('button').forEach((b) => b.classList.toggle('on', Number(b.dataset.v) === Number(settings.sessionMin)));
  $('paletteSeg').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === settings.palette));
  $('vibToggle').setAttribute('aria-checked', String(!!settings.vibration));
  $('calmToggle').setAttribute('aria-checked', String(!!settings.calm));
  const fsOk = !!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen);
  $('fsBtn').hidden = !fsOk;
  $('fsBtn').textContent = isFs() ? 'Sair da tela cheia' : 'Entrar em tela cheia';
  refreshStatus();
}

function refreshStatus() {
  const el = $('status');
  el.textContent = '';
  const pads = connectedPads();
  const padTxt = pads.length
    ? pads.map((p) => shortName(p.id) + (p.mapping === 'standard' ? '' : ' (mapeamento genérico)')).join(', ')
    : 'nenhum detectado. Conecte e aperte qualquer botão dele.';
  const soundTxt = !sound.ctx ? 'liga no primeiro toque' : sound.ready ? 'ligado' : 'bloqueado (toque na tela)';
  const limit = Number(settings.sessionMin);
  const left = limit > 0
    ? (menuFrom === 'play' ? `${Math.max(1, Math.ceil((limit * 60 - elapsed) / 60))} min restantes de ${limit}` : `${limit} min por sessão`)
    : 'sem limite';
  const vib = settings.vibration ? (pads.some((p) => p.vibrationActuator) ? 'ligada' : 'ligada (este navegador/controle pode não vibrar)') : 'desligada';
  for (const [label, value] of [['Controle', padTxt], ['Som', soundTxt], ['Tempo', left], ['Vibração', vib]]) {
    const b = document.createElement('b');
    b.textContent = label + ': ';
    el.append(b, document.createTextNode(value), document.createElement('br'));
  }
}

/* ---------------- Utilidades ---------------- */
function connectedPads() {
  try { return [...(navigator.getGamepads?.() || [])].filter((p) => p && p.connected); } catch { return []; }
}
function detectPadKind() {
  return connectedPads().some((gp) => /054c|playstation|dualsense|dualshock|sony/i.test(gp.id)) ? 'playstation' : 'xbox';
}
function shortName(id = '') {
  const s = id.replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim();
  return (s || 'Controle').slice(0, 40);
}

let toastTimer = 0;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.hidden = false;
  requestAnimationFrame(() => toastEl.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.classList.remove('show');
    setTimeout(() => { toastEl.hidden = true; }, 400);
  }, 2600);
}

function checkAudio() {
  const blocked = state === 'play' && settings.volume > 0 && !sound.ready;
  audioHint.hidden = !blocked;
}

function isFs() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }
function requestFs() {
  const el = document.documentElement;
  const fn = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!fn || isFs()) return;
  try { const p = fn.call(el, { navigationUI: 'hide' }); if (p && p.catch) p.catch(() => {}); } catch { /* ok */ }
}

let wakeLock = null;
async function keepAwake() {
  try {
    if ('wakeLock' in navigator && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    }
  } catch { /* ok */ }
}
function releaseAwake() { try { wakeLock?.release(); } catch { /* ok */ } wakeLock = null; }

/* ---------------- Loop principal ---------------- */
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  app.t += dt;
  input.poll(now);

  if (state === 'play') {
    elapsed += dt;
    const limit = Number(settings.sessionMin);
    if (limit > 0 && elapsed >= limit * 60) endSession();
  }

  const active = state === 'play';
  mode.update(dt, active);
  fx.update(dt);

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  mode.draw(ctx, app.w, app.h, app.t);
  fx.draw(ctx);
  if (state === 'ended' || (state === 'menu' && menuFrom === 'ended')) {
    endScene.update(dt);
    endScene.draw(ctx, app.w, app.h, app.t);
    if (state === 'ended') fx.draw(ctx);
  }
  requestAnimationFrame(frame);
}

/* ---------------- Início ---------------- */
resize();
setMode(modeKey);
showStart();
requestAnimationFrame((t) => { last = t; frame(t); });

if ('serviceWorker' in navigator && (location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname))) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => {}); });
}

// Exposto só para testes e depuração no console.
window.__acende = { app, get state() { return state; }, get mode() { return mode; }, get elapsed() { return elapsed; }, setMode, openMenu, startPlay };
