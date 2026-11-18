// Modo "Bolhas": tocar sopra uma bolha; tocar numa bolha estoura; arrastar deixa um rastro de bolhinhas.
// No joystick: botões sopram bolhas coloridas pela varinha, o analógico move a varinha
// e o gatilho enche uma bolha gigante (quanto mais aperta, maior).
import { clamp, hexToRgb, hslToRgb, mix, rgba, drawCloud, TAU } from '../draw.js';

export class BolhasMode {
  constructor(app) {
    this.app = app;
    this.bubbles = [];
    this.trails = new Map();
    this.blowers = new Map();
    this.wand = { x: 0, y: 0, vis: 0, last: -99, puff: 0 };
    this.big = null;
    this.sparkT = 0;
    this.clouds = Array.from({ length: 5 }, () => ({
      x: Math.random(), y: 0.06 + Math.random() * 0.5, s: 0.6 + Math.random() * 0.8, v: 0.004 + Math.random() * 0.006,
    }));
    this.resize(app.w || 800, app.h || 600);
  }

  resize(w, h) {
    this.m = Math.min(w, h);
    this.k = this.m / 600;
    if (!this.wand.x) { this.wand.x = w / 2; this.wand.y = h * 0.62; }
    this.wand.x = clamp(this.wand.x, 0, w);
    this.wand.y = clamp(this.wand.y, 0, h);
  }

  get max() { return this.app.calm ? 24 : 48; }

  spawn(x, y, r, color = null, vyMul = 1, hue = Math.random() * 360) {
    while (this.bubbles.length >= this.max) this.burst(this.bubbles.shift(), true);
    const k = this.k;
    const sizeK = 1.25 - Math.min(1, r / (this.m * 0.2)) * 0.5; // bolhas grandes sobem mais devagar
    this.bubbles.push({
      x, y, r, color, hue,
      vx: (Math.random() - 0.5) * 40 * k,
      vy: -(38 + Math.random() * 42) * k * vyMul * sizeK,
      ph: Math.random() * TAU, age: 0, life: 8 + Math.random() * 6,
    });
  }

  blowFromWand(color, r) {
    const w = this.wand;
    this.spawn(w.x, w.y - r * 0.6, r, color);
    w.last = this.app.t;
    w.puff = 1;
  }

  hit(x, y) {
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      if ((b.x - x) ** 2 + (b.y - y) ** 2 < (b.r * 1.1) ** 2) return b;
    }
    return null;
  }

  pop(b, e) {
    const i = this.bubbles.indexOf(b);
    if (i >= 0) this.bubbles.splice(i, 1);
    this.burst(b);
    this.app.sound.pop(clamp(b.r / (this.m * 0.2)));
    this.app.feedback(e, 0.3, 60);
  }

  burst(b, silent = false) {
    const k = this.k;
    this.app.fx.emit(b.x, b.y, {
      count: silent || this.app.calm ? 4 : 10,
      colors: b.color ? [b.color, '#ffffff'] : ['#ffffff', '#cfe8ff', '#ffd6f0'],
      speed: [60 * k, 170 * k], size: [1.5 + 2 * k, 2 + 4.5 * k], life: [0.35, 0.6],
      gravity: 160 * k, shape: 'dot', radius: b.r * 0.85,
    });
  }

  press(e) {
    const { app, m } = this;
    if (e.source === 'touch') {
      const b = this.hit(e.x, e.y);
      if (b) this.pop(b, e);
      else {
        this.spawn(e.x, e.y, m * (0.055 + Math.random() * 0.05));
        app.sound.bloop();
        app.feedback(e, 0.2, 40);
      }
      this.trails.set(e.id, { acc: 0 });
      return;
    }
    if (e.source === 'stick') return; // o analógico move a varinha
    const pal = app.palette();
    const color = e.slot != null ? pal[e.slot] : pal[(Math.random() * 4) | 0];
    if (e.source === 'switch') this.spawn(app.w * (0.2 + Math.random() * 0.6), app.h * 0.92, m * (0.06 + Math.random() * 0.05), color);
    else this.blowFromWand(color, m * (0.05 + Math.random() * 0.04));
    app.sound.bloop();
    app.feedback(e, 0.35, 90);
    this.blowers.set(e.id, { t: 0, color, src: e.source });
  }

  move(e) {
    const tr = this.trails.get(e.id);
    if (!tr) return;
    const b = this.hit(e.x, e.y);
    if (b) this.pop(b, e);
    tr.acc += Math.hypot(e.dx, e.dy);
    if (tr.acc > this.m * 0.09) {
      tr.acc = 0;
      this.spawn(e.x, e.y, this.m * (0.025 + Math.random() * 0.03));
      this.app.sound.bloop(0.5);
    }
  }

  release(e) { this.trails.delete(e.id); this.blowers.delete(e.id); }
  releaseAll() { this.trails.clear(); this.blowers.clear(); }
  pause() { this.releaseAll(); if (this.big) this.releaseBig(); this.app.sound.setDrone(0); }

  releaseBig() {
    const b = this.big;
    this.big = null;
    this.spawn(b.x, b.y, b.r, null, 0.6, b.hue);
    this.app.sound.bloopDeep();
    this.app.sound.setDrone(0);
  }

  update(dt, active) {
    const { app, m, k } = this;
    const inp = app.input, w = this.wand;

    if (active && inp.stick.mag > 0) {
      w.x = clamp(w.x + inp.stick.x * m * 1.2 * dt, m * 0.05, app.w - m * 0.05);
      w.y = clamp(w.y + inp.stick.y * m * 1.2 * dt, m * 0.08, app.h - m * 0.05);
      w.last = app.t;
      if (!app.calm) {
        this.sparkT += dt;
        if (this.sparkT > 0.06) {
          this.sparkT = 0;
          app.fx.emit(w.x, w.y, { count: 1, colors: ['#ffffff', '#fff3a0'], speed: [10, 40], size: [3, 6], life: [0.4, 0.7], gravity: -20 });
        }
      }
    }
    const want = active && (inp.padCount > 0 || app.t - w.last < 5) ? 1 : 0;
    w.vis += (want - w.vis) * Math.min(1, dt * 4);
    w.puff = Math.max(0, w.puff - dt * 3);

    // Segurar um botão continua soprando bolhinhas.
    for (const bl of this.blowers.values()) {
      bl.t += dt;
      if (bl.t > 0.3) {
        bl.t = 0;
        if (bl.src === 'switch') this.spawn(app.w * (0.2 + Math.random() * 0.6), app.h * 0.92, m * (0.03 + Math.random() * 0.03), bl.color);
        else this.blowFromWand(bl.color, m * (0.025 + Math.random() * 0.025));
      }
    }

    // Gatilho: bolha gigante proporcional à pressão.
    const trg = active ? inp.trigger : 0;
    if (trg > 0.06) {
      if (!this.big) this.big = { r: m * 0.02, hue: Math.random() * 360, x: w.x, y: w.y, age: 1, ph: 0, color: null };
      const target = m * (0.03 + 0.18 * trg);
      this.big.r += (target - this.big.r) * Math.min(1, dt * 5);
      this.big.x = w.x;
      this.big.y = w.y - this.big.r - m * 0.02;
      w.last = app.t;
      app.sound.setDrone(trg * 0.6, 220);
      if (this.big.r > m * 0.2) this.releaseBig();
    } else if (this.big) this.releaseBig();

    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      b.age += dt;
      b.x += (b.vx + Math.sin(b.age * 1.7 + b.ph) * 16 * k) * dt;
      b.y += b.vy * dt;
      b.vx *= Math.exp(-0.6 * dt);
      if (b.y + b.r < -10) this.bubbles.splice(i, 1);
      else if (b.age > b.life) { this.bubbles.splice(i, 1); this.burst(b, true); } // some sozinha, sem som
    }

    for (const c of this.clouds) { c.x += c.v * dt; if (c.x > 1.3) c.x = -0.3; }
  }

  draw(ctx, W, H, t) {
    const calm = this.app.calm;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, calm ? '#7aaedc' : '#86c8ff');
    g.addColorStop(1, calm ? '#e6cde0' : '#ffd9ec');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    for (const c of this.clouds) drawCloud(ctx, c.x * W, c.y * H, this.m * 0.12 * c.s, 0.45);

    for (const b of this.bubbles) drawBubble(ctx, b, t);
    if (this.big) drawBubble(ctx, this.big, t);

    const w = this.wand;
    if (w.vis > 0.01) {
      const r = this.m * 0.045 * (1 + 0.18 * w.puff);
      ctx.save();
      ctx.globalAlpha = w.vis;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#ffb347';
      ctx.lineWidth = this.m * 0.014;
      ctx.beginPath();
      ctx.moveTo(w.x + r * 0.75, w.y + r * 0.75);
      ctx.lineTo(w.x + r * 2.1, w.y + r * 2.6);
      ctx.stroke();
      const gl = ctx.createRadialGradient(w.x, w.y, r * 0.6, w.x, w.y, r * 2);
      gl.addColorStop(0, 'rgba(255,255,255,.45)');
      gl.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gl;
      ctx.beginPath(); ctx.arc(w.x, w.y, r * 2, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = this.m * 0.012;
      ctx.beginPath(); ctx.arc(w.x, w.y, r, 0, TAU); ctx.stroke();
      ctx.restore();
    }
  }
}

function drawBubble(ctx, b, t) {
  const grow = Math.min(1, b.age / 0.18);
  const e = 1 - Math.pow(1 - grow, 3);
  const r = b.r * (0.3 + 0.7 * e);
  const wob = Math.sin(t * 3 + b.ph) * 0.035;
  const tint = b.color ? hexToRgb(b.color) : hslToRgb((b.hue + t * 25) % 360, 0.8, 0.7);
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.scale(1 + wob, 1 - wob);
  const g = ctx.createRadialGradient(-r * 0.25, -r * 0.3, r * 0.1, 0, 0, r);
  g.addColorStop(0, 'rgba(255,255,255,0.06)');
  g.addColorStop(0.7, rgba(tint, b.color ? 0.22 : 0.1));
  g.addColorStop(1, rgba(tint, b.color ? 0.6 : 0.42));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fill();
  ctx.lineWidth = Math.max(1.5, r * 0.045);
  ctx.strokeStyle = rgba(mix(tint, [255, 255, 255], 0.3), 0.75);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.85)';
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(2, r * 0.09);
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.7, Math.PI * 1.12, Math.PI * 1.42);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.9)';
  ctx.beginPath();
  ctx.arc(r * 0.38, r * 0.42, Math.max(1.5, r * 0.06), 0, TAU);
  ctx.fill();
  ctx.restore();
}
