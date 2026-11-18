// Modo "Siga a luz": um amiguinho acorda e brilha devagar, chamando.
// Apertou nele: festa! Apertar outro também responde (baixinho): aqui não existe erro.
// A cada 5 acertos, todos acendem em onda com uma musiquinha.
import { Buddy, diamond, nearestSlot, drawBuddy, drawRipples, background, starPath, NOTES } from '../draw.js';

export class SigaMode {
  constructor(app) {
    this.app = app;
    this.buddies = [0, 1, 2, 3].map((i) => new Buddy(i));
    this.target = (Math.random() * 4) | 0;
    this.phase = 'call';      // call | party | rest
    this.timer = 0;
    this.sinceCall = 0;
    this.streak = 0;
    this.wave = null;
    this.resize(app.w || 800, app.h || 600);
  }

  // Reserva uma faixa no alto para as estrelinhas de progresso.
  resize(w, h) { this.L = diamond(w, h, Math.max(Math.min(w, h) * 0.1, 52)); }

  press(e) {
    const { app } = this;
    let slot = e.slot;
    if (e.source === 'touch') slot = nearestSlot(this.L, e.x, e.y);
    // Acionador único (espaço/Enter): sempre "acerta", para quem só tem um botão.
    if (e.source === 'switch') slot = this.phase === 'call' ? this.target : (Math.random() * 4) | 0;
    if (slot == null) {
      for (const b of this.buddies) b.hit(null, 0.5);
      app.sound.chord([NOTES[2], NOTES[1], NOTES[0]], { gain: 0.08 });
      app.feedback(e, 0.3, 120);
      return;
    }
    if (this.phase === 'call' && slot === this.target) { this.success(e); return; }
    this.buddies[slot].hit(e.id ?? null, 0.55);
    app.sound.bell(NOTES[slot], { gain: 0.15 });
    app.feedback(e, 0.25, 70);
  }

  success(e) {
    const { app, L } = this;
    const slot = this.target;
    const b = this.buddies[slot];
    b.hit(e.id ?? null, 1);
    b.amp = 0.22;
    this.streak++;
    app.sound.celebrate(NOTES[slot]);
    app.feedback(e, 0.8, 260);
    const [x, y] = L.pos[slot];
    const pal = app.palette();
    app.fx.emit(x, y, {
      count: app.calm ? 8 : 22, colors: [pal[slot], '#ffffff', '#FFE27A', pal[(slot + 2) % 4]],
      speed: [180, 420], size: [6, 12], life: [0.7, 1.2], gravity: 160, radius: L.r * 0.9,
    });
    this.phase = 'party';
    this.timer = 1.5;
    if (this.streak % 5 === 0) {
      this.wave = { t: 0, next: 0 };
      app.sound.fanfare();
      this.timer = 2.8;
    }
  }

  release(e) { for (const b of this.buddies) b.unhold(e.id); }
  releaseAll() { for (const b of this.buddies) b.holds.clear(); }
  pause() { this.releaseAll(); }

  update(dt, active) {
    const { app } = this;
    for (const b of this.buddies) b.update(dt);
    this.timer -= dt;

    if (this.phase === 'party' && this.timer <= 0) { this.phase = 'rest'; this.timer = 0.7; }
    else if (this.phase === 'rest' && this.timer <= 0) {
      let next = (Math.random() * 3) | 0;
      if (next >= this.target) next++;
      this.target = next;
      this.phase = 'call';
      this.sinceCall = 0;
      const tb = this.buddies[next];
      tb.bt = 0; tb.amp = 0.08;
      if (active) app.sound.bell(NOTES[next], { gain: 0.08 });
    }

    if (this.phase === 'call') {
      this.sinceCall += dt;
      const tb = this.buddies[this.target];
      // "Respira" a ~0,55 Hz: chama atenção sem piscar.
      const call = 0.3 + 0.32 * (0.5 - 0.5 * Math.cos(Math.PI * 2 * 0.55 * this.sinceCall));
      tb.light = Math.max(tb.light, call);
      tb.awakeTimer = Math.max(tb.awakeTimer, 0.5);
      // Se ninguém apertar por um tempo, dá pulinhos de convite.
      if (this.sinceCall > 10 && (this.sinceCall - 10) % 3 < dt) { tb.bt = 0; tb.amp = 0.1; }
    }

    if (this.wave) {
      this.wave.t += dt;
      const order = [0, 1, 2, 3, 0, 1, 2, 3];
      while (this.wave.next < order.length && this.wave.t > this.wave.next * 0.16) {
        const i = order[this.wave.next++];
        this.buddies[i].hit(null, 1);
        const [x, y] = this.L.pos[i];
        if (!app.calm) app.fx.emit(x, y, { count: 6, colors: [app.palette()[i], '#ffffff'], speed: [120, 260], radius: this.L.r * 0.9 });
      }
      if (this.wave.next >= order.length) this.wave = null;
    }
  }

  draw(ctx, w, h, t) {
    const { L, app } = this;
    const calm = app.calm;
    background(ctx, w, h, calm ? '#211c4a' : '#2b2263', '#110c2c');
    const pal = app.palette();
    this.buddies.forEach((b, i) => {
      const [x, y] = L.pos[i];
      drawRipples(ctx, x, y, L.r, pal[i], b.ripples, calm);
      drawBuddy(ctx, x, y, L.r, pal[i], { light: b.light, awake: b.awake, scale: b.scale, calm, t, seed: i * 3 });
    });

    // Estrelinhas de progresso (5 por rodada).
    const n = this.streak % 5 === 0 && this.streak > 0 && this.wave ? 5 : this.streak % 5;
    const top = Math.max(Math.min(w, h) * 0.1, 52);
    const s = Math.max(9, Math.min(w, h) * 0.026), gap = s * 2.8;
    const y0 = top * 0.5;
    for (let i = 0; i < 5; i++) {
      const x = w / 2 + (i - 2) * gap;
      starPath(ctx, x, y0, s, 5, 0.5, 0);
      if (i < n) { ctx.fillStyle = '#FFD54A'; ctx.fill(); }
      else { ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 2; ctx.stroke(); }
    }
  }
}
