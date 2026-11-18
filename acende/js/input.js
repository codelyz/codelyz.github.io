// Entrada unificada: toque/mouse (Pointer Events), joystick (Gamepad API) e
// teclado/acionador (switch). Tudo vira os mesmos eventos:
//   press   { source, slot, id, x?, y?, pad? }   slot: 0 cima, 1 direita, 2 baixo, 3 esquerda, ou null
//   move    { source:'touch', id, x, y, dx, dy }
//   release { source, slot?, id }
//   nav     'up' | 'down' | 'left' | 'right' | 'select' | 'back' | 'escape' | 'other'  (quando um menu está aberto)
//   parent  (gesto do adulto: Select+Start ou Esc segurados)
// Além disso, input.stick {x,y,mag} e input.trigger (0..1) podem ser lidos a cada quadro.

// Mapeamento "standard" da Gamepad API.
// 0 A/✕ (baixo) · 1 B/○ (direita) · 2 X/□ (esquerda) · 3 Y/△ (cima)
// 4 LB · 5 RB · 6 LT · 7 RT · 8 Select · 9 Start · 10 L3 · 11 R3 · 12–15 direcional · 16 Home
const STD_SLOT = { 0: 2, 1: 1, 2: 3, 3: 0, 4: 3, 5: 1, 10: 2, 11: 0, 12: 0, 13: 2, 14: 3, 15: 1 };
const NAV_STD = { 12: 'up', 13: 'down', 14: 'left', 15: 'right', 0: 'select', 1: 'back' };
const KEY_SLOT = { ArrowUp: 0, KeyW: 0, ArrowRight: 1, KeyD: 1, ArrowDown: 2, KeyS: 2, ArrowLeft: 3, KeyA: 3 };
const SWITCH_KEYS = new Set(['Space', 'Enter', 'NumpadEnter']);
const DIRS = ['up', 'right', 'down', 'left'];
const DEAD = 0.2;
const PARENT_HOLD = 2; // segundos

function hashSlot(code) {
  let h = 0;
  for (let i = 0; i < code.length; i++) h = (h * 31 + code.charCodeAt(i)) >>> 0;
  return h % 4;
}

function btnValue(b) { return b == null ? 0 : typeof b === 'object' ? b.value : b; }

export class Input {
  constructor(surface) {
    this.surface = surface;
    this.handlers = {};
    this.prev = new Map();
    this.pointers = new Map();
    this.keysDown = new Set();
    this.stick = { x: 0, y: 0, mag: 0 };
    this.trigger = 0;
    this.stickSlot = null;
    this.uiActive = false;   // true quando a tela inicial ou o menu estão abertos
    this.parentHold = 0;
    this.escDownAt = 0;
    this.padCount = 0;
    this.lastPoll = 0;
    this._bind();
  }

  on(type, fn) { (this.handlers[type] ||= []).push(fn); }
  emit(type, e) { for (const fn of this.handlers[type] || []) fn(e); }

  _bind() {
    const s = this.surface;
    const pos = (e) => {
      const r = s.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    s.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try { s.setPointerCapture(e.pointerId); } catch { /* ok */ }
      const p = pos(e);
      this.pointers.set(e.pointerId, p);
      this.emit('press', { source: 'touch', slot: null, id: 'p' + e.pointerId, pointerType: e.pointerType, ...p });
    }, { passive: false });

    s.addEventListener('pointermove', (e) => {
      const last = this.pointers.get(e.pointerId);
      if (!last) return;
      const p = pos(e);
      this.pointers.set(e.pointerId, p);
      this.emit('move', { source: 'touch', id: 'p' + e.pointerId, ...p, dx: p.x - last.x, dy: p.y - last.y });
    });

    const up = (e) => {
      if (!this.pointers.has(e.pointerId)) return;
      const p = pos(e);
      this.pointers.delete(e.pointerId);
      this.emit('release', { source: 'touch', id: 'p' + e.pointerId, ...p });
    };
    s.addEventListener('pointerup', up);
    s.addEventListener('pointercancel', up);
    s.addEventListener('lostpointercapture', up);
    s.addEventListener('contextmenu', (e) => e.preventDefault());

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape') {
        if (!e.repeat) {
          this.escDownAt = performance.now();
          if (this.uiActive) this.emit('nav', 'escape');
        }
        e.preventDefault();
        return;
      }
      if (this.uiActive) {
        const nav = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }[e.code];
        // Setas navegam, a não ser num controle deslizante (ele usa as próprias setas).
        if (nav && !(document.activeElement?.type === 'range' && (nav === 'left' || nav === 'right'))) {
          e.preventDefault();
          this.emit('nav', nav);
        }
        return; // Enter/Espaço/Tab funcionam normalmente nos botões
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      e.preventDefault();
      if (e.repeat || this.keysDown.has(e.code)) return;
      this.keysDown.add(e.code);
      const id = 'k' + e.code;
      if (SWITCH_KEYS.has(e.code)) this.emit('press', { source: 'switch', slot: null, id });
      else this.emit('press', { source: 'key', slot: KEY_SLOT[e.code] ?? hashSlot(e.code), id });
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Escape') this.escDownAt = 0;
      if (this.keysDown.delete(e.code) && !this.uiActive) {
        this.emit('release', { source: SWITCH_KEYS.has(e.code) ? 'switch' : 'key', id: 'k' + e.code });
      }
    });

    window.addEventListener('blur', () => this.releaseAll());

    window.addEventListener('gamepadconnected', (e) => this.emit('padconnect', e.gamepad));
    window.addEventListener('gamepaddisconnected', (e) => {
      this.prev.delete(e.gamepad.index);
      this.emit('paddisconnect', e.gamepad);
    });
  }

  releaseAll() {
    this.keysDown.clear();
    this.pointers.clear();
    this.escDownAt = 0;
    this.emit('releaseall');
  }

  /** Lê os controles. Chamado uma vez por quadro (a Gamepad API não dispara eventos de botão). */
  poll(now) {
    const dt = this.lastPoll ? Math.min(0.1, (now - this.lastPoll) / 1000) : 0;
    this.lastPoll = now;

    let pads = [];
    try { pads = navigator.getGamepads ? Array.from(navigator.getGamepads()) : []; } catch { pads = []; }

    let sx = 0, sy = 0, smag = 0, trig = 0, selStart = false, count = 0;
    for (const gp of pads) {
      if (!gp || !gp.connected) continue;
      count++;
      const std = gp.mapping === 'standard';
      const prev = this.prev.get(gp.index) || [];
      const cur = [];
      gp.buttons.forEach((b, i) => {
        const v = btnValue(b);
        const pressed = typeof b === 'object' ? (b.pressed || v > 0.5) : v > 0.5;
        cur[i] = pressed;
        if (std && (i === 6 || i === 7)) return; // gatilhos: tratados como analógicos
        if (pressed !== !!prev[i]) this._padButton(gp, i, std, pressed);
      });
      this.prev.set(gp.index, cur);
      if (std) {
        trig = Math.max(trig, btnValue(gp.buttons[6]), btnValue(gp.buttons[7]));
        if (cur[8] && cur[9]) selStart = true;
      }
      // Em controles sem mapeamento padrão, só os eixos 0/1 são confiáveis.
      const axesPairs = std ? [[0, 1], [2, 3]] : [[0, 1]];
      for (const [ax, ay] of axesPairs) {
        const x = gp.axes[ax] || 0, y = gp.axes[ay] || 0;
        const m = Math.hypot(x, y);
        if (m > smag && m <= 1.5) { smag = m; sx = x; sy = y; }
      }
    }
    this.padCount = count;

    const m = smag < DEAD ? 0 : Math.min(1, (smag - DEAD) / (1 - DEAD));
    this.stick = m ? { x: (sx / smag) * m, y: (sy / smag) * m, mag: m } : { x: 0, y: 0, mag: 0 };
    this.trigger = trig < 0.04 ? 0 : Math.min(1, trig);

    // Analógico empurrado até o fim conta como "apertar" o botão daquela direção.
    let slot = null;
    const quadrant = Math.abs(sx) > Math.abs(sy) ? (sx > 0 ? 1 : 3) : (sy > 0 ? 2 : 0);
    if (m > 0.7) slot = quadrant;
    else if (m > 0.45 && this.stickSlot !== null) slot = this.stickSlot;
    if (slot !== this.stickSlot) {
      if (this.stickSlot !== null && !this.uiActive) this.emit('release', { source: 'stick', slot: this.stickSlot, id: 'stick' });
      if (slot !== null) {
        if (this.uiActive) this.emit('nav', DIRS[slot]);
        else this.emit('press', { source: 'stick', slot, id: 'stick' });
      }
      this.stickSlot = slot;
    }

    // Gestos do adulto
    if (selStart) {
      if (this.parentHold >= 0) {
        this.parentHold += dt;
        if (this.parentHold > PARENT_HOLD) { this.parentHold = -1; this.emit('parent'); }
      }
    } else this.parentHold = 0;

    if (this.escDownAt && now - this.escDownAt > PARENT_HOLD * 1000 * 0.75) {
      this.escDownAt = 0;
      if (!this.uiActive) this.emit('parent');
    }
  }

  _padButton(gp, i, std, down) {
    if (this.uiActive) {
      if (!down) return;
      const nav = std ? (NAV_STD[i] || 'other') : (i === 0 ? 'select' : i === 1 ? 'back' : 'other');
      this.emit('nav', nav);
      return;
    }
    const slot = std ? (i in STD_SLOT ? STD_SLOT[i] : null) : i % 4;
    this.emit(down ? 'press' : 'release', { source: 'pad', slot, pad: gp.index, button: i, id: `g${gp.index}-${i}` });
  }

  /** Vibração do controle (Chrome/Edge). Silenciosamente ignorada onde não existe. */
  rumble(padIndex, strength = 0.5, ms = 120) {
    let pads = [];
    try { pads = navigator.getGamepads ? Array.from(navigator.getGamepads()) : []; } catch { return; }
    const list = padIndex == null ? pads : [pads[padIndex]];
    for (const gp of list) {
      const act = gp && gp.vibrationActuator;
      if (!act || !act.playEffect) continue;
      try {
        const p = act.playEffect('dual-rumble', {
          startDelay: 0, duration: ms,
          weakMagnitude: Math.min(1, strength), strongMagnitude: Math.min(1, strength * 0.6),
        });
        if (p && p.catch) p.catch(() => {});
      } catch { /* ok */ }
    }
  }
}
