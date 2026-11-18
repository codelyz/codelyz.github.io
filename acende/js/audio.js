// Todos os sons são sintetizados na hora (Web Audio): nenhum arquivo de áudio,
// volume limitado por um compressor e envelopes suaves (sem estalos fortes).

export class Sound {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.volume = 0.6;
    this.voices = 0;
    this.last = new Map();
    this.drone = null;
    this.droneLevel = 0;
    this.noise = null;
  }

  /** Cria/retoma o AudioContext. Precisa ser chamado a partir de um toque ou tecla. */
  ensure() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const ctx = new AC({ latencyHint: 'interactive' });
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -20;
        comp.knee.value = 14;
        comp.ratio.value = 6;
        comp.attack.value = 0.003;
        comp.release.value = 0.25;
        const master = ctx.createGain();
        master.gain.value = this.volume * 0.55;
        master.connect(comp);
        comp.connect(ctx.destination);
        this.ctx = ctx;
        this.master = master;

        const len = Math.floor(ctx.sampleRate * 0.05);
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
        this.noise = buf;
      }
      if (this.ctx.state !== 'running') {
        const p = this.ctx.resume?.();
        if (p && p.catch) p.catch(() => {});
        // "Destrava" o áudio em iOS antigos tocando um buffer vazio.
        const s = this.ctx.createBufferSource();
        s.buffer = this.ctx.createBuffer(1, 1, 22050);
        s.connect(this.ctx.destination);
        s.start(0);
      }
    } catch { /* sem áudio: o app continua funcionando só com luzes */ }
  }

  get ready() { return !!this.ctx && this.ctx.state === 'running'; }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.setTargetAtTime(v * 0.55, this.ctx.currentTime, 0.05);
  }

  _ok(key, gap = 0.07) {
    if (!this.ready || this.volume <= 0 || this.voices > 18) return false;
    if (key) {
      const now = this.ctx.currentTime;
      if (now - (this.last.get(key) ?? -1) < gap) return false;
      this.last.set(key, now);
    }
    return true;
  }

  tone(freq, { dur = 0.6, type = 'sine', gain = 0.3, attack = 0.012, when = 0, slideTo = 0 } = {}) {
    const ctx = this.ctx;
    const t = ctx.currentTime + when + 0.005;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur * 0.7);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.03);
    this.voices++;
    o.onended = () => {
      this.voices--;
      try { o.disconnect(); g.disconnect(); } catch { /* ok */ }
    };
  }

  _noise(gain = 0.05, highpass = 2500) {
    const ctx = this.ctx;
    const s = ctx.createBufferSource();
    s.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = highpass;
    const g = ctx.createGain();
    g.gain.value = gain;
    s.connect(f); f.connect(g); g.connect(this.master);
    s.start();
    this.voices++;
    s.onended = () => { this.voices--; };
  }

  /** Sino suave: a nota de cada botão. */
  bell(freq, { gain = 0.3, when = 0, dur = 0.9 } = {}) {
    if (!this._ok('b' + freq, 0.06)) return;
    this.tone(freq, { gain, when, dur });
    this.tone(freq * 2, { type: 'triangle', gain: gain * 0.18, when, dur: dur * 0.5 });
  }

  chord(freqs, { gain = 0.12, spread = 0.06 } = {}) {
    if (!this._ok('chord', 0.2)) return;
    freqs.forEach((f, i) => this.tone(f, { gain, when: i * spread, dur: 0.9 }));
  }

  pop(size = 0.5) {
    if (!this._ok('pop', 0.03)) return;
    const f = 950 - 550 * size + Math.random() * 120;
    this.tone(f, { dur: 0.11, gain: 0.26, attack: 0.004, slideTo: f * 0.45 });
    this._noise(0.05, 2500);
  }

  bloop(scale = 1) {
    if (!this._ok('bloop', 0.06)) return;
    const f = 250 + Math.random() * 120;
    this.tone(f, { dur: 0.2, gain: 0.16 * scale, attack: 0.01, slideTo: f * 2.1 });
  }

  bloopDeep() {
    if (!this._ok('bloopd', 0.1)) return;
    this.tone(170, { dur: 0.4, gain: 0.2, slideTo: 340 });
  }

  celebrate(base) {
    if (!this._ok('cel', 0.3)) return;
    [1, 1.25, 1.5, 2].forEach((m, i) => {
      this.tone(base * m, { gain: 0.2, when: i * 0.09, dur: 0.6 });
      this.tone(base * m * 2, { type: 'triangle', gain: 0.04, when: i * 0.09, dur: 0.35 });
    });
    this.tone(base * 2.5, { gain: 0.08, when: 0.4, dur: 0.8 });
  }

  fanfare() {
    if (!this._ok('fan', 0.5)) return;
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => this.tone(f, { gain: 0.15, when: 0.5 + i * 0.12, dur: 0.7 }));
    [523.25, 659.25, 783.99].forEach((f) => this.tone(f, { type: 'triangle', gain: 0.07, when: 1.15, dur: 1.4 }));
  }

  chimeUp() {
    if (!this._ok('up', 0.3)) return;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone(f, { gain: 0.18, when: i * 0.12, dur: 0.8 }));
  }

  chimeDown() {
    if (!this._ok('down', 0.3)) return;
    [783.99, 659.25, 523.25, 392].forEach((f, i) => this.tone(f, { type: 'triangle', gain: 0.16, when: i * 0.16, dur: 1.0 }));
  }

  twinkle(gain = 0.08) {
    if (!this._ok('tw', 0.08)) return;
    const notes = [1046.5, 1174.7, 1318.5, 1568, 1760];
    this.tone(notes[(Math.random() * notes.length) | 0], { gain, dur: 0.45 });
  }

  connected() {
    if (!this._ok('con', 1)) return;
    this.tone(783.99, { gain: 0.12, dur: 0.4 });
    this.tone(1046.5, { gain: 0.12, when: 0.12, dur: 0.6 });
  }

  lullaby() {
    if (!this._ok('lul', 3)) return;
    [[659.25, 0], [587.33, 0.55], [523.25, 1.1], [392, 1.75], [523.25, 2.5]]
      .forEach(([f, w]) => this.tone(f, { gain: 0.12, when: w, dur: 1.2, attack: 0.05 }));
  }

  /** Som contínuo que acompanha um valor analógico (gatilho ou toque segurado). */
  setDrone(level, base = 220) {
    if (!this.ready) return;
    level = Math.max(0, Math.min(1, level));
    if (level === 0 && this.droneLevel === 0) return;
    if (level !== 0 && Math.abs(level - this.droneLevel) < 0.01) return;
    this.droneLevel = level;
    const ctx = this.ctx;
    if (!this.drone) {
      const o = ctx.createOscillator();
      const f = ctx.createBiquadFilter();
      const g = ctx.createGain();
      o.type = 'triangle';
      f.type = 'lowpass';
      f.frequency.value = 600;
      g.gain.value = 0;
      o.connect(f); f.connect(g); g.connect(this.master);
      o.start();
      this.drone = { o, f, g };
    }
    const t = ctx.currentTime;
    this.drone.g.gain.setTargetAtTime(level * 0.14, t, 0.05);
    this.drone.o.frequency.setTargetAtTime(base * (1 + level * 0.6), t, 0.06);
    this.drone.f.frequency.setTargetAtTime(400 + level * 1600, t, 0.06);
  }
}
