// Desenho do terço (mesma geometria do app).
// ------------------------------------------------------------------ Geometria do terço (igual ao RosaryView.kt)
function catmull(ctrl, seg = 40) {
  const out = [], n = ctrl.length;
  for (let i = 0; i < n - 1; i++) {
    const p1 = ctrl[i], p2 = ctrl[i + 1];
    const p0 = i > 0 ? ctrl[i - 1] : [2 * p1[0] - p2[0], 2 * p1[1] - p2[1]];
    const p3 = i + 2 < n ? ctrl[i + 2] : [2 * p2[0] - p1[0], 2 * p2[1] - p1[1]];
    for (let s = 0; s < seg; s++) {
      const t = s / seg, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map(k => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3)));
    }
  }
  out.push(ctrl[n - 1]);
  return out;
}
function sampled(pts) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  let A = 0, cx = 0, cy = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], c = a[0] * b[1] - b[0] * a[1];
    A += c; cx += (a[0] + b[0]) * c; cy += (a[1] + b[1]) * c;
  }
  A /= 2;
  return {
    pts, cum, length: cum[cum.length - 1], minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys),
    centroid: [cx / (6 * A), cy / (6 * A)],
    at(s) {
      s = Math.max(0, Math.min(this.length, s));
      let lo = 0, hi = cum.length - 1;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] < s) lo = m; else hi = m; }
      const f = (s - cum[lo]) / Math.max(1e-6, cum[hi] - cum[lo]), a = pts[lo], b = pts[hi];
      return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
    },
  };
}
const RAW = [[178, 300], [215, 262], [243, 190], [232, 150], [205, 120], [190, 88], [170, 45], [140, 22], [115, 35], [108, 52], [100, 110], [95, 180], [105, 235], [135, 272], [178, 300]];
const OUTLINE = sampled(catmull(RAW.map(([x, y]) => [(x - 178) / 282 * 1.22, (y - 300) / 282]), 40));
const isBig = i => i === 1 || i === 5 || (i >= 7 && (i - 7) % 11 === 10);
const small = (d, k) => 7 + d * 11 + k;
const bigAfter = d => 7 + d * 11 + 10;

const BEAD = {
  light: { small: '#2B3467', big: '#E09A78', silver: '#B9B9C3', silverDark: '#7D7D8A', chain: '#B8A894' },
  dark: { small: '#7F8FD6', big: '#E8A585', silver: '#D0D0D8', silverDark: '#9A9AA6', chain: '#8D7B6A' },
};
const GOLD = '#C9A227', GOLDLIGHT = '#E8C76A';

function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`;
}
function drawBead(ctx, x, y, r, color, state) {
  if (state === 'current') {
    const R = r * 1.4;
    circle(ctx, x, y, R, GOLDLIGHT);
    ctx.lineWidth = Math.max(1, R * 0.14); ctx.strokeStyle = GOLD; ctx.beginPath(); ctx.arc(x, y, R, 0, 7); ctx.stroke();
    circle(ctx, x - R * 0.32, y - R * 0.32, R * 0.34, 'rgba(255,255,255,0.6)');
  } else if (state === 'done') {
    circle(ctx, x, y, r, color);
    circle(ctx, x - r * 0.32, y - r * 0.32, r * 0.32, 'rgba(255,255,255,0.35)');
  } else {
    circle(ctx, x, y, r, rgba(color, 0.28));
  }
}
function circle(ctx, x, y, r, fill) { ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
function drawMedal(ctx, x, y, s, pal, state) {
  const w = s * 2.2, h = s * 2.8, a = state === 'pending' ? 0.55 : 1;
  ctx.fillStyle = state === 'current' ? GOLDLIGHT : rgba(pal.silver, a);
  ctx.beginPath(); ctx.ellipse(x, y, w / 2, h / 2, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = rgba(pal.silverDark, a); ctx.lineWidth = s * 0.2; ctx.stroke();
  const ink = rgba(pal.silverDark, a);
  circle(ctx, x, y - s * 0.55, s * 0.26, ink);
  ctx.fillStyle = ink; ctx.beginPath(); ctx.moveTo(x, y - s * 0.35); ctx.lineTo(x + s * 0.55, y + s * 0.95); ctx.lineTo(x - s * 0.55, y + s * 0.95); ctx.closePath(); ctx.fill();
}
function drawCrucifix(ctx, cx, top, h, pal, state) {
  const color = state === 'current' ? GOLDLIGHT : state === 'done' ? pal.silver : rgba(pal.silver, 0.75);
  const th = h * 0.11, armY = top + h * 0.28, ah = h * 0.30, bud = th * 0.95;
  const ends = [[cx, top], [cx, top + h], [cx - ah, armY], [cx + ah, armY]];
  const line = (c, w) => {
    ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx, top); ctx.lineTo(cx, top + h); ctx.moveTo(cx - ah, armY); ctx.lineTo(cx + ah, armY); ctx.stroke();
  };
  line(pal.silverDark, th * 1.35); ends.forEach(([x, y]) => circle(ctx, x, y, bud * 1.2, pal.silverDark));
  line(color, th); ends.forEach(([x, y]) => circle(ctx, x, y, bud, color));
  circle(ctx, cx, armY, th * 0.55, pal.silverDark);
}

/** Desenha o terço completo num canvas de w×h (px CSS) e devolve o centro do laço. */
function drawRosary(canvas, w, h, current, visitedUntil, mode, dpr) {
  canvas.width = w * dpr; canvas.height = h * dpr; canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  const ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr);
  const pal = BEAD[mode], c = OUTLINE;
  const pad = Math.min(w, h) * 0.035, totalH = -c.minY + 0.35 + 0.175 + 0.03, totalW = c.maxX - c.minX + 0.06;
  const scale = Math.min((h - 2 * pad) / totalH, (w - 2 * pad) / totalW);
  const mx = w / 2 - (c.minX + c.maxX) / 2 * scale, top = (h - totalH * scale) / 2, my = top + (-c.minY + 0.015) * scale;
  const map = p => [mx + p[0] * scale, my + p[1] * scale];
  const unit = c.length / (2.6 + 50 + 6.8), up = unit * scale, sr = up * 0.42, br = up * 0.68;
  const pos = []; pos[6] = [mx, my];
  let acc = 1.3;
  for (let i = 7; i < 61; i++) { const wt = isBig(i) ? 1.7 : 1; acc += wt / 2; pos[i] = map(c.at(acc * unit)); acc += wt / 2; }
  [[5, .085], [4, .14], [3, .185], [2, .23], [1, .29]].forEach(([i, f]) => pos[i] = [mx, my + scale * f]);
  const crossTop = my + scale * 0.35, crossH = scale * 0.175; pos[0] = [mx, crossTop + crossH * 0.3];
  // fio
  ctx.strokeStyle = rgba(pal.chain, 0.6); ctx.lineWidth = Math.max(1.2, sr * 0.22);
  ctx.beginPath(); c.pts.forEach((p, i) => { const q = map(p); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx, crossTop); ctx.stroke();
  // brilho
  const [hx, hy] = pos[current], hr = br * 2.3;
  const g = ctx.createRadialGradient(hx, hy, 0, hx, hy, hr); g.addColorStop(0, rgba(GOLDLIGHT, 0.42)); g.addColorStop(1, rgba(GOLDLIGHT, 0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(hx, hy, hr, 0, 7); ctx.fill();
  const state = i => i === current ? 'current' : visitedUntil(i) ? 'done' : 'pending';
  for (let i = 1; i < 61; i++) {
    if (i === 6) continue;
    drawBead(ctx, pos[i][0], pos[i][1], isBig(i) ? br : sr, isBig(i) ? pal.big : pal.small, state(i));
  }
  drawMedal(ctx, mx, my, br, pal, state(6));
  drawCrucifix(ctx, mx, crossTop, crossH, pal, state(0));
  const cen = map(c.centroid);
  return { cx: cen[0], cy: cen[1], inner: (c.maxX - c.minX) * scale * 0.55 };
}

