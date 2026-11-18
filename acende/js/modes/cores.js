// Modo "Cores": quatro amiguinhos com as cores dos botões do controle.
// Toque perto de um (a tela toda é alvo) ou aperte o botão correspondente: ele acorda, acende e canta.
// Segurar mantém aceso. Gatilhos (ou segurar o sol do meio) fazem o sol crescer de forma gradual.
import { Buddy, diamond, nearestSlot, drawBuddy, drawRipples, drawSun, background, NOTES } from '../draw.js';

export class CoresMode {
  constructor(app) {
    this.app = app;
    this.buddies = [0, 1, 2, 3].map((i) => new Buddy(i));
    this.sun = { level: 0, touchIds: new Set(), touchLevel: 0, bt: 10 };
    this.switchNext = 0;
    this.sparkT = 0;
    this.rumbleT = 0;
    this.L = diamond(app.w || 800, app.h || 600);
  }

  resize(w, h) { this.L = diamond(w, h); }

  press(e) {
    const { L, app } = this;
    if (e.source === 'touch') {
      if (Math.hypot(e.x - L.cx, e.y - L.cy) < L.sunHit) {
        this.sun.touchIds.add(e.id);
        this.sun.bt = 0;
        app.sound.bell(392, { gain: 0.16 });
        app.feedback(e, 0.3, 60);
        return;
      }
      this.hit(nearestSlot(L, e.x, e.y), e);
      return;
    }
    if (e.source === 'switch') {
      // Acionador único: acende um de cada vez, em roda, formando uma melodia.
      this.hit(this.switchNext, e);
      this.switchNext = (this.switchNext + 1) % 4;
      return;
    }
    if (e.slot == null) {
      // Start/Select/Home: todos acendem juntos.
      for (const b of this.buddies) b.hit(null, 0.8);
      app.sound.chord([NOTES[2], NOTES[1], NOTES[0]]);
      app.feedback(e, 0.6, 200);
      return;
    }
    this.hit(e.slot, e);
  }

  hit(slot, e) {
    const { app } = this;
    this.buddies[slot].hit(e.id ?? null);
    app.sound.bell(NOTES[slot]);
    app.feedback(e, 0.5, 110);
    if (!app.calm) {
      const [x, y] = this.L.pos[slot];
      app.fx.emit(x, y, {
        count: 7, colors: [app.palette()[slot], '#ffffff'], speed: [120, 260], size: [5, 10],
        life: [0.5, 0.9], gravity: 60, radius: this.L.r * 0.9,
      });
    }
  }

  release(e) {
    for (const b of this.buddies) b.unhold(e.id);
    this.sun.touchIds.delete(e.id);
  }

  releaseAll() {
    for (const b of this.buddies) b.holds.clear();
    this.sun.touchIds.clear();
  }

  pause() { this.app.sound.setDrone(0); this.releaseAll(); }

  update(dt, active) {
    const { app, sun } = this;
    for (const b of this.buddies) b.update(dt);

    sun.touchLevel = sun.touchIds.size ? Math.min(1, sun.touchLevel + dt * 0.9) : Math.max(0, sun.touchLevel - dt * 1.5);
    const trig = active ? app.input.trigger : 0;
    const target = active ? Math.max(trig, sun.touchLevel) : 0;
    sun.level += (target - sun.level) * Math.min(1, dt * 10);
    sun.bt += dt;
    if (active) app.sound.setDrone(sun.level, 196);

    // Vibração proporcional ao gatilho.
    this.rumbleT += dt;
    if (trig > 0.1 && this.rumbleT > 0.1) { this.rumbleT = 0; app.rumbleAll(trig * 0.6, 130); }

    if (sun.level > 0.85 && !app.calm) {
      this.sparkT += dt;
      if (this.sparkT > 0.12) {
        this.sparkT = 0;
        const r = this.L.sunR * (1 + sun.level * 1.1);
        app.fx.emit(this.L.cx, this.L.cy, {
          count: 2, colors: ['#FFE27A', '#ffffff'], speed: [90, 180], size: [4, 7], life: [0.5, 0.8], gravity: 0, radius: r * 1.4,
        });
      }
    }
  }

  draw(ctx, w, h, t) {
    const { L, app, sun } = this;
    const calm = app.calm;
    background(ctx, w, h, calm ? '#1a2048' : '#222b5e', '#0c0f2c');

    const sunScale = 1 + 0.15 * Math.exp(-sun.bt * 5) * Math.cos(sun.bt * 16);
    drawSun(ctx, L.cx, L.cy, L.sunR * (1 + sun.level * 1.1) * sunScale, {
      level: sun.level, t, awake: sun.level > 0.05 || sun.bt < 1 ? 1 : 0, calm,
    });

    const pal = app.palette();
    this.buddies.forEach((b, i) => {
      const [x, y] = L.pos[i];
      drawRipples(ctx, x, y, L.r, pal[i], b.ripples, calm);
      const breathe = 1 + 0.015 * Math.sin(t * 1.3 + i * 1.7);
      drawBuddy(ctx, x, y, L.r, pal[i], { light: b.light, awake: b.awake, scale: b.scale * breathe, calm, t, seed: i * 3 });
    });
  }
}
