// Cores, layout e personagens desenhados no canvas.

// Cores na ordem das posições: cima, direita, baixo, esquerda.
// Xbox: Y amarelo, B vermelho, A verde, X azul. PlayStation: △ verde, ○ vermelho, ✕ azul, □ rosa.
export const PALETTES = {
  xbox: ['#FFC83D', '#F0524B', '#4CC35A', '#3E8EF7'],
  playstation: ['#38C98D', '#F25C78', '#5E8BF7', '#E58AD8'],
};

// Escala pentatônica (dó maior): qualquer combinação soa bem.
export const NOTES = [783.99, 659.25, 523.25, 587.33]; // cima Sol5, direita Mi5, baixo Dó5, esquerda Ré5

export const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const TAU = Math.PI * 2;

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function mix(a, b, t) { return a.map((v, i) => Math.round(v + (b[i] - v) * t)); }
export function rgba(c, a = 1) { return `rgba(${c[0]},${c[1]},${c[2]},${a})`; }
export function hslToRgb(h, s, l) {
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

/**
 * Quatro círculos em losango, como os botões de um controle.
 * Em telas alongadas (celular em pé ou deitado) os círculos crescem para aproveitar o espaço.
 * `top` reserva uma faixa no alto (ex.: estrelinhas de progresso).
 */
export function diamond(w, h, top = 0) {
  const H = h - top;
  const m = Math.min(w, H);
  const cx = w / 2, cy = top + H / 2;
  const long = Math.max(w, H);
  const t = clamp((long / m - 1.6) / 0.4); // tablets ficam como estão; celulares ganham círculos maiores
  const r = m * (0.16 + 0.035 * t);
  const shortOff = Math.min(m * 0.3, m * 0.47 - r);
  const longOff = Math.min(long * 0.32, Math.max(shortOff * 1.25, r * 2.3));
  const [dx, dy] = w >= H ? [longOff, shortOff] : [shortOff, longOff];
  return {
    m, cx, cy, r,
    sunR: m * 0.06,
    sunHit: Math.max(m * 0.1, 44),
    pos: [[cx, cy - dy], [cx + dx, cy], [cx, cy + dy], [cx - dx, cy]],
  };
}

export function nearestSlot(L, x, y) {
  let best = 0, bd = Infinity;
  L.pos.forEach(([px, py], i) => {
    const d = (px - x) ** 2 + (py - y) ** 2;
    if (d < bd) { bd = d; best = i; }
  });
  return best;
}

export function background(ctx, w, h, inner, outer) {
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.hypot(w, h) / 2);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/** Estado de um "amiguinho" (círculo com rosto) que acende e apaga. */
export class Buddy {
  constructor(slot) {
    this.slot = slot;
    this.light = 0;
    this.holds = new Set();
    this.awake = 0;
    this.awakeTimer = 0;
    this.bt = 10;
    this.amp = 0.14;
    this.ripples = [];
  }
  hit(id, strength = 1) {
    this.light = Math.max(this.light, strength);
    if (id != null) this.holds.add(id);
    this.bt = 0;
    this.amp = 0.14 * strength;
    this.ripples.push({ age: 0 });
    if (this.ripples.length > 4) this.ripples.shift();
    this.awakeTimer = 1.6;
  }
  unhold(id) { this.holds.delete(id); }
  update(dt) {
    // Enquanto segurado, fica aceso; ao soltar, apaga devagar (nunca pisca de forma brusca).
    if (this.holds.size) this.light = Math.max(this.light, 0.9);
    else this.light = Math.max(0, this.light - dt * 1.25);
    this.awakeTimer -= dt;
    const want = this.light > 0.05 || this.awakeTimer > 0 || this.holds.size ? 1 : 0;
    this.awake += (want - this.awake) * Math.min(1, dt * (want ? 12 : 2.5));
    this.bt += dt;
    for (const r of this.ripples) r.age += dt;
    this.ripples = this.ripples.filter((r) => r.age < 1.1);
  }
  get scale() { return 1 + this.amp * Math.exp(-this.bt * 5) * Math.cos(this.bt * 16); }
}

export function drawRipples(ctx, x, y, r, hex, ripples, calm) {
  const c = hexToRgb(hex);
  for (const rp of ripples) {
    const k = rp.age / 1.1;
    ctx.strokeStyle = rgba(c, (1 - k) * (calm ? 0.25 : 0.5));
    ctx.lineWidth = Math.max(2, r * 0.06 * (1 - k));
    ctx.beginPath();
    ctx.arc(x, y, r * (1 + k * 0.9), 0, TAU);
    ctx.stroke();
  }
}

export function drawFace(ctx, x, y, r, { awake = 0, joy = 0, t = 0, seed = 0, ink = 'rgba(28,22,48,.85)', cheeks = true } = {}) {
  const ex = r * 0.3, ey = y - r * 0.1, er = r * 0.085;
  let open = clamp((awake - 0.25) / 0.75);
  const bp = (t * 0.31 + seed * 0.17) % 4.2; // piscadinha de vez em quando
  if (open > 0 && bp < 0.13) open *= 0.1;
  ctx.fillStyle = ink;
  ctx.strokeStyle = ink;
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(1.5, r * 0.045);
  for (const sx of [-1, 1]) {
    const cx = x + sx * ex;
    if (open < 0.18) {
      ctx.beginPath();
      ctx.arc(cx, ey - er * 0.3, er * 1.05, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.ellipse(cx, ey, er, er * (0.35 + 0.75 * open), 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      ctx.beginPath();
      ctx.arc(cx + er * 0.3, ey - er * 0.35 * open, er * 0.32, 0, TAU);
      ctx.fill();
      ctx.fillStyle = ink;
    }
  }
  if (cheeks && awake > 0.05) {
    ctx.fillStyle = `rgba(255,120,150,${0.32 * awake})`;
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(x + sx * r * 0.52, y + r * 0.12, r * 0.11, r * 0.07, 0, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = ink;
  }
  const my = y + r * 0.2;
  if (joy > 0.45) {
    const mr = r * (0.1 + 0.1 * joy);
    ctx.beginPath();
    ctx.moveTo(x - mr, my);
    ctx.arc(x, my, mr, 0, Math.PI);
    ctx.closePath();
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = 'rgba(255,120,140,.95)';
    ctx.beginPath();
    ctx.ellipse(x, my + mr * 0.85, mr * 0.55, mr * 0.4, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  } else {
    const mw = r * (0.12 + 0.1 * awake);
    ctx.beginPath();
    ctx.arc(x, my - mw * 0.5, mw, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.stroke();
  }
}

const NIGHT = [22, 26, 64];

export function drawBuddy(ctx, x, y, r, hex, { light = 0, awake = 0, scale = 1, calm = false, t = 0, seed = 0 } = {}) {
  light = clamp(light);
  const base = hexToRgb(hex);
  const dim = mix(base, NIGHT, 0.5);
  const body = mix(dim, base, clamp(0.12 + light * 0.88));
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  if (light > 0.02) {
    const gr = r * (calm ? 1.7 : 2.3);
    const g = ctx.createRadialGradient(0, 0, r * 0.7, 0, 0, gr);
    g.addColorStop(0, rgba(base, (calm ? 0.35 : 0.6) * light));
    g.addColorStop(1, rgba(base, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, gr, 0, TAU);
    ctx.fill();
  }
  const bg = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
  bg.addColorStop(0, rgba(mix(body, [255, 255, 255], 0.28 + light * 0.2)));
  bg.addColorStop(1, rgba(mix(body, NIGHT, 0.12)));
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fill();
  ctx.lineWidth = Math.max(2, r * 0.04);
  ctx.strokeStyle = `rgba(255,255,255,${0.1 + light * 0.3})`;
  ctx.stroke();
  ctx.fillStyle = `rgba(255,255,255,${0.14 + light * 0.22})`;
  ctx.beginPath();
  ctx.ellipse(-r * 0.38, -r * 0.5, r * 0.26, r * 0.13, -0.6, 0, TAU);
  ctx.fill();
  drawFace(ctx, 0, 0, r, { awake, joy: light, t, seed });
  ctx.restore();
}

export function drawSun(ctx, x, y, r, { level = 0, t = 0, awake = 1, calm = false } = {}) {
  const rays = 12, rot = t * 0.25;
  const len = r * (0.35 + 0.65 * level);
  const gr = r * (1.8 + 1.2 * level);
  const g = ctx.createRadialGradient(x, y, r * 0.8, x, y, gr);
  g.addColorStop(0, `rgba(255,200,60,${(calm ? 0.2 : 0.35) + 0.3 * level})`);
  g.addColorStop(1, 'rgba(255,200,60,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, gr, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = `rgba(255,205,70,${0.75 + 0.25 * level})`;
  ctx.lineWidth = Math.max(2, r * 0.16);
  ctx.lineCap = 'round';
  for (let i = 0; i < rays; i++) {
    const a = rot + (i * TAU) / rays;
    const l = len * (i % 2 ? 0.7 : 1);
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * r * 1.22, y + Math.sin(a) * r * 1.22);
    ctx.lineTo(x + Math.cos(a) * (r * 1.22 + l), y + Math.sin(a) * (r * 1.22 + l));
    ctx.stroke();
  }
  const bg = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
  bg.addColorStop(0, '#FFEC9A');
  bg.addColorStop(1, '#FFB52E');
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  drawFace(ctx, x, y, r, { awake, joy: level, t, seed: 3, ink: 'rgba(120,60,10,.85)' });
}

export function drawMoon(ctx, x, y, r, { glow = 0, t = 0 } = {}) {
  const gr = r * (1.8 + glow);
  const g = ctx.createRadialGradient(x, y, r * 0.8, x, y, gr);
  g.addColorStop(0, `rgba(240,235,200,${0.22 + 0.35 * glow})`);
  g.addColorStop(1, 'rgba(240,235,200,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, gr, 0, TAU);
  ctx.fill();
  const bg = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
  bg.addColorStop(0, '#FFF9E2');
  bg.addColorStop(1, '#E6D8A8');
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(200,180,130,.35)';
  for (const [dx, dy, s] of [[0.42, -0.42, 0.16], [-0.5, 0.42, 0.12], [0.5, 0.45, 0.09]]) {
    ctx.beginPath();
    ctx.arc(x + dx * r, y + dy * r, s * r, 0, TAU);
    ctx.fill();
  }
  drawFace(ctx, x, y, r, { awake: 0, joy: 0, t, ink: 'rgba(90,80,60,.75)' });
}

export function drawCloud(ctx, x, y, s, alpha) {
  if (alpha <= 0.01) return;
  ctx.fillStyle = `rgba(255,255,255,${alpha})`;
  ctx.beginPath();
  for (const [ox, oy, rr] of [[0, 0, 0.55], [0.55, 0.08, 0.42], [-0.55, 0.12, 0.38], [0.1, 0.22, 0.45]]) {
    ctx.moveTo(x + ox * s + rr * s, y + oy * s); // subcaminhos separados: sem emendas visíveis
    ctx.arc(x + ox * s, y + oy * s, rr * s, 0, TAU);
  }
  ctx.fill();
}

export function starPath(ctx, x, y, r, points = 5, inset = 0.5, rot = 0) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = rot - Math.PI / 2 + (i * Math.PI) / points;
    const rr = i % 2 ? r * inset : r;
    const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath();
}
