import { starPath, TAU } from './draw.js';

const rand = ([a, b]) => a + Math.random() * (b - a);

/** Partículas leves (estrelinhas e gotinhas) com limite de quantidade. */
export class Particles {
  constructor(max = 320) {
    this.items = [];
    this.max = max;
  }
  clear() { this.items.length = 0; }
  emit(x, y, {
    count = 8, colors = ['#ffffff'], speed = [80, 220], life = [0.6, 1.1], size = [4, 9],
    gravity = 120, shape = 'star', spread = TAU, angle = 0, drag = 1.5, radius = 0,
  } = {}) {
    for (let i = 0; i < count; i++) {
      if (this.items.length >= this.max) this.items.shift();
      const a = angle + (Math.random() - 0.5) * spread;
      const sp = rand(speed);
      this.items.push({
        x: x + Math.cos(a) * radius, y: y + Math.sin(a) * radius,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: rand(life), age: 0, size: rand(size),
        color: colors[(Math.random() * colors.length) | 0],
        shape, rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 6, gravity, drag,
      });
    }
  }
  update(dt) {
    const list = this.items;
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.age += dt;
      if (p.age >= p.life) { list.splice(i, 1); continue; }
      const k = Math.exp(-p.drag * dt);
      p.vx *= k; p.vy *= k;
      p.vy += p.gravity * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
  }
  draw(ctx) {
    for (const p of this.items) {
      const k = p.age / p.life;
      ctx.globalAlpha = 1 - k * k;
      ctx.fillStyle = p.color;
      const s = p.size * (1 - k * 0.4);
      if (p.shape === 'star') starPath(ctx, p.x, p.y, s, 5, 0.48, p.rot);
      else { ctx.beginPath(); ctx.arc(p.x, p.y, s, 0, TAU); }
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}
