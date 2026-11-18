// Modo "Dia e noite": qualquer toque ou botão troca o dia pela noite (e vice-versa).
// O sol se põe, a lua sobe, as estrelas aparecem e a janela da casinha acende.
// A troca leva 1,6 s e não pode se repetir antes disso: nada de piscar a tela inteira.
// O gatilho aumenta os raios do sol (de dia) ou o brilho da lua e das estrelas (de noite).
import { clamp, mix, rgba, drawSun, drawMoon, drawCloud, starPath, TAU } from '../draw.js';

const DAY = { top: [110, 198, 255], bot: [205, 239, 255], hill1: [154, 217, 126], hill2: [108, 196, 106] };
const NIGHT = { top: [11, 19, 64], bot: [42, 49, 112], hill1: [43, 74, 85], hill2: [31, 58, 68] };
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

function quad(p0, p1, p2, u) { return (1 - u) * (1 - u) * p0 + 2 * u * (1 - u) * p1 + u * u * p2; }

export class DiaNoiteMode {
  constructor(app) {
    this.app = app;
    this.p = 0; this.from = 0; this.to = 0; this.tt = 1;
    this.dur = 1.6;
    this.lastToggle = -99;
    this.level = 0;
    this.bt = 10;
    this.stars = Array.from({ length: 70 }, () => ({
      x: Math.random(), y: Math.random() * 0.62, s: 0.6 + Math.random() * 1.6, ph: Math.random() * TAU, sp: 0.5 + Math.random() * 0.8,
    }));
    this.clouds = Array.from({ length: 4 }, (_, i) => ({
      x: i / 4 + Math.random() * 0.1, y: 0.08 + Math.random() * 0.28, s: 0.7 + Math.random() * 0.6, v: 0.006 + Math.random() * 0.006,
    }));
    this.resize(app.w || 800, app.h || 600);
  }

  resize(w, h) { this.m = Math.min(w, h); }

  positions(W, H) {
    const p = this.p, q = 1 - p;
    return {
      sun: { x: W * (0.5 + 0.42 * p), y: H * (0.3 + 0.85 * p * p) },
      moon: { x: W * (0.5 - 0.42 * q), y: H * (0.3 + 0.85 * q * q) },
    };
  }

  press(e) {
    const { app } = this;
    if (app.t - this.lastToggle >= this.dur) {
      this.from = this.p;
      this.to = this.to ? 0 : 1;
      this.tt = 0;
      this.lastToggle = app.t;
      this.bt = 0;
      if (this.to) app.sound.chimeDown(); else app.sound.chimeUp();
      app.feedback(e, 0.5, 200);
    } else {
      const pos = this.positions(app.w, app.h);
      const pt = e.source === 'touch' ? e : (this.to ? pos.moon : pos.sun);
      if (!app.calm) {
        app.fx.emit(pt.x, pt.y, { count: 6, colors: ['#fff6b0', '#ffffff', '#ffd1f0'], speed: [60, 160], size: [4, 8], life: [0.5, 0.9], gravity: 40 });
      }
      app.sound.twinkle();
      app.feedback(e, 0.2, 50);
    }
  }

  pause() { this.app.sound.setDrone(0); }

  update(dt, active) {
    if (this.tt < 1) {
      this.tt = Math.min(1, this.tt + dt / this.dur);
      this.p = this.from + (this.to - this.from) * ease(this.tt);
    }
    const trg = active ? this.app.input.trigger : 0;
    this.level += (trg - this.level) * Math.min(1, dt * 8);
    if (active) this.app.sound.setDrone(this.level * 0.5, this.p > 0.5 ? 175 : 262);
    this.bt += dt;
    for (const c of this.clouds) { c.x += c.v * dt; if (c.x > 1.25) c.x = -0.25; }
  }

  hillY(W, H, xFrac, which) {
    // Encontra o y da curva da colina em x (amostragem simples).
    const [a, c, b] = which === 1 ? [H * 0.78, H * 0.6, H * 0.72] : [H * 0.88, H * 0.66, H * 0.84];
    const cx = which === 1 ? 0.35 : 0.7;
    let best = 0, bd = Infinity;
    for (let i = 0; i <= 60; i++) {
      const u = i / 60;
      const x = quad(0, cx * W, W, u);
      const d = Math.abs(x - xFrac * W);
      if (d < bd) { bd = d; best = quad(a, c, b, u); }
    }
    return best;
  }

  draw(ctx, W, H, t) {
    const { p, m, app } = this;
    const calm = app.calm;

    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, rgba(mix(DAY.top, NIGHT.top, p)));
    sky.addColorStop(1, rgba(mix(DAY.bot, NIGHT.bot, p)));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    if (p > 0.01) {
      const boost = 1 + this.level * 0.7;
      for (const s of this.stars) {
        const a = clamp(p * (0.55 + 0.45 * Math.sin(t * s.sp + s.ph)) * (0.8 + this.level * 0.4));
        ctx.fillStyle = `rgba(255,250,220,${a})`;
        starPath(ctx, s.x * W, s.y * H, s.s * (m / 300) * boost, 4, 0.45, 0);
        ctx.fill();
      }
    }

    const { sun, moon } = this.positions(W, H);
    const bounce = 1 + 0.12 * Math.exp(-this.bt * 5) * Math.cos(this.bt * 14);
    const R = m * 0.1;
    if (p > 0.01) drawMoon(ctx, moon.x, moon.y, R * (this.to ? bounce : 1), { glow: this.level, t });
    if (p < 0.99) drawSun(ctx, sun.x, sun.y, R * (this.to ? 1 : bounce), { level: this.level, t, awake: 1 - p, calm });

    for (const c of this.clouds) drawCloud(ctx, c.x * W, c.y * H, m * 0.11 * c.s, (1 - p) * 0.9);

    // Colinas
    ctx.fillStyle = rgba(mix(DAY.hill1, NIGHT.hill1, p));
    ctx.beginPath();
    ctx.moveTo(0, H * 0.78);
    ctx.quadraticCurveTo(W * 0.35, H * 0.6, W, H * 0.72);
    ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
    ctx.fill();
    ctx.fillStyle = rgba(mix(DAY.hill2, NIGHT.hill2, p));
    ctx.beginPath();
    ctx.moveTo(0, H * 0.88);
    ctx.quadraticCurveTo(W * 0.7, H * 0.66, W, H * 0.84);
    ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
    ctx.fill();

    // Casinha com janela que acende à noite
    const hx = W * 0.66;
    const baseY = this.hillY(W, H, 0.66, 2) + m * 0.012;
    const hw = m * 0.17, hh = m * 0.12;
    const x0 = hx - hw / 2, y0 = baseY - hh;
    ctx.fillStyle = rgba(mix([255, 236, 210], [92, 92, 132], p));
    ctx.fillRect(x0, y0, hw, hh);
    ctx.fillStyle = rgba(mix([232, 92, 82], [112, 52, 66], p));
    ctx.beginPath();
    ctx.moveTo(x0 - hw * 0.1, y0 + 1);
    ctx.lineTo(hx, y0 - hh * 0.75);
    ctx.lineTo(x0 + hw * 1.1, y0 + 1);
    ctx.closePath();
    ctx.fill();
    const wx = x0 + hw * 0.16, wy = y0 + hh * 0.22, ws = hw * 0.28;
    if (p > 0.02) {
      const gl = ctx.createRadialGradient(wx + ws / 2, wy + ws / 2, ws * 0.2, wx + ws / 2, wy + ws / 2, ws * (calm ? 1.6 : 2.4));
      gl.addColorStop(0, `rgba(255,214,107,${0.55 * p})`);
      gl.addColorStop(1, 'rgba(255,214,107,0)');
      ctx.fillStyle = gl;
      ctx.beginPath(); ctx.arc(wx + ws / 2, wy + ws / 2, ws * 2.4, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = rgba(mix([180, 225, 255], [255, 214, 107], p));
    ctx.fillRect(wx, wy, ws, ws);
    ctx.strokeStyle = rgba(mix([255, 255, 255], [120, 90, 60], p), 0.9);
    ctx.lineWidth = Math.max(1.5, ws * 0.08);
    ctx.strokeRect(wx, wy, ws, ws);
    ctx.beginPath();
    ctx.moveTo(wx + ws / 2, wy); ctx.lineTo(wx + ws / 2, wy + ws);
    ctx.moveTo(wx, wy + ws / 2); ctx.lineTo(wx + ws, wy + ws / 2);
    ctx.stroke();
    ctx.fillStyle = rgba(mix([170, 110, 70], [80, 55, 45], p));
    const dw = hw * 0.22, dh = hh * 0.55;
    ctx.fillRect(x0 + hw * 0.62, baseY - dh, dw, dh);
  }
}
