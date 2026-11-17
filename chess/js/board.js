// Tabuleiro: desenha casas e peças, anima lances e trata toque, clique e arraste.
import { h } from './ui.js';
import { FILES } from './engine.js';

export function createBoard({ paint = false, label = 'Tabuleiro' } = {}) {
  const root = h('div', { class: 'board', role: 'grid', 'aria-label': label });
  const sqLayer = h('div', { class: 'b-squares' });
  const pcLayer = h('div', { class: 'b-pieces' });
  const fxLayer = h('div', { class: 'b-fx' });
  root.append(sqLayer, pcLayer, fxLayer);

  let W = 0;
  let H = 0;
  let flipped = false;
  let coords = true;
  let squares = [];
  const pieces = new Map(); // casa -> { el, key }

  const api = {
    el: root,
    onClick: null, // (sq) => void
    onDrop: null, // (from, to) => boolean
    canDrag: null, // (sq) => boolean
    onPaint: null, // (sq, phase) => void
  };

  const view = (sq) => {
    const x = sq % W;
    const y = Math.floor(sq / W);
    return flipped ? { vx: W - 1 - x, vy: y } : { vx: x, vy: H - 1 - y };
  };
  const fromView = (vx, vy) => (flipped ? vy * W + (W - 1 - vx) : (H - 1 - vy) * W + vx);

  function place(el, sq) {
    const { vx, vy } = view(sq);
    el.style.transform = `translate(${vx * 100}%, ${vy * 100}%)`;
  }

  function build() {
    root.style.setProperty('--bw', W);
    root.style.setProperty('--bh', H);
    sqLayer.innerHTML = '';
    squares = new Array(W * H);
    for (let vy = 0; vy < H; vy++) {
      for (let vx = 0; vx < W; vx++) {
        const sq = fromView(vx, vy);
        const x = sq % W;
        const y = Math.floor(sq / W);
        const el = h('div', { class: `sq ${(x + y) % 2 ? 'sq-l' : 'sq-d'}`, dataset: { sq } });
        if (coords) {
          if (vy === H - 1) el.appendChild(h('span', { class: 'co co-f' }, FILES[x]));
          if (vx === 0) el.appendChild(h('span', { class: 'co co-r' }, String(y + 1)));
        }
        squares[sq] = el;
        sqLayer.appendChild(el);
      }
    }
    pieces.forEach((p, sq) => place(p.el, sq));
  }

  api.setSize = (w, hh) => {
    if (w === W && hh === H) return;
    W = w;
    H = hh;
    pieces.forEach((p) => p.el.remove());
    pieces.clear();
    build();
  };
  api.setFlipped = (f) => {
    if (!!f === flipped) return;
    flipped = !!f;
    build();
  };
  api.setCoords = (c) => {
    if (!!c === coords) return;
    coords = !!c;
    build();
  };
  api.size = () => ({ W, H });

  // list: [{ sq, key, html, tagged }], anim: { from, to, rookFrom, rookTo }
  api.setPieces = (list, anim) => {
    if (anim && anim.from !== undefined && pieces.has(anim.from) && anim.from !== anim.to) {
      const moving = pieces.get(anim.from);
      pieces.delete(anim.from);
      const victim = pieces.get(anim.to);
      if (victim) fadeOut(victim.el);
      pieces.set(anim.to, moving);
      place(moving.el, anim.to);
      moving.el.classList.add('moving');
      setTimeout(() => moving.el.classList.remove('moving'), 260);
      if (anim.rookFrom !== undefined && pieces.has(anim.rookFrom)) {
        const r = pieces.get(anim.rookFrom);
        pieces.delete(anim.rookFrom);
        pieces.set(anim.rookTo, r);
        place(r.el, anim.rookTo);
      }
    }
    const want = new Map(list.map((p) => [p.sq, p]));
    for (const [sq, p] of [...pieces]) {
      if (!want.has(sq)) {
        fadeOut(p.el);
        pieces.delete(sq);
      }
    }
    for (const [sq, p] of want) {
      const cur = pieces.get(sq);
      if (cur && cur.key === p.key) continue;
      if (cur) {
        cur.el.innerHTML = p.html;
        cur.el.classList.toggle('tagged', !!p.tagged);
        cur.key = p.key;
        cur.el.classList.remove('morph');
        void cur.el.offsetWidth;
        cur.el.classList.add('morph');
        continue;
      }
      const el = h('div', { class: `pcw ${p.tagged ? 'tagged' : ''}`, html: p.html });
      place(el, sq);
      if (anim) el.classList.add('appear');
      pcLayer.appendChild(el);
      pieces.set(sq, { el, key: p.key });
    }
  };

  function fadeOut(el) {
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 260);
  }

  // marks: { selected, lastFrom, lastTo, targets:[{sq,cap}], check:[], goal:[], extra, hint:[from,to], tagged:[] }
  api.setMarks = (marks = {}) => {
    for (const el of squares) if (el) el.classList.remove('sel', 'last', 'tgt', 'tgt-cap', 'chk', 'goal', 'extra', 'hint');
    const add = (sq, c) => {
      if (sq !== undefined && sq !== null && sq >= 0 && squares[sq]) squares[sq].classList.add(c);
    };
    add(marks.lastFrom, 'last');
    add(marks.lastTo, 'last');
    add(marks.selected, 'sel');
    (marks.targets || []).forEach((t) => add(t.sq, t.cap ? 'tgt-cap' : 'tgt'));
    (marks.check || []).forEach((sq) => add(sq, 'chk'));
    (marks.goal || []).forEach((sq) => add(sq, 'goal'));
    add(marks.extra, 'extra');
    (marks.hint || []).forEach((sq) => add(sq, 'hint'));
  };

  api.burst = (sq, radius = 1) => {
    const { vx, vy } = view(sq);
    const fx = h('div', { class: 'fx-boom' });
    fx.style.left = `${((vx - radius) / W) * 100}%`;
    fx.style.top = `${((vy - radius) / H) * 100}%`;
    fx.style.width = `${((2 * radius + 1) / W) * 100}%`;
    fx.style.height = `${((2 * radius + 1) / H) * 100}%`;
    fxLayer.appendChild(fx);
    setTimeout(() => fx.remove(), 700);
  };
  api.ping = (sq, cls = 'fx-ping') => {
    const { vx, vy } = view(sq);
    const fx = h('div', { class: cls });
    fx.style.left = `${(vx / W) * 100}%`;
    fx.style.top = `${(vy / H) * 100}%`;
    fx.style.width = `${100 / W}%`;
    fx.style.height = `${100 / H}%`;
    fxLayer.appendChild(fx);
    setTimeout(() => fx.remove(), 900);
  };

  // --- entrada ------------------------------------------------------------
  function sqAt(ev) {
    const r = root.getBoundingClientRect();
    const vx = Math.floor(((ev.clientX - r.left) / r.width) * W);
    const vy = Math.floor(((ev.clientY - r.top) / r.height) * H);
    if (vx < 0 || vy < 0 || vx >= W || vy >= H) return -1;
    return fromView(vx, vy);
  }

  let drag = null;
  root.addEventListener('pointerdown', (ev) => {
    if (ev.button !== undefined && ev.button !== 0) return;
    const sq = sqAt(ev);
    if (sq < 0) return;
    if (paint) {
      drag = { paint: true, last: sq };
      root.setPointerCapture(ev.pointerId);
      if (api.onPaint) api.onPaint(sq, 'down');
      ev.preventDefault();
      return;
    }
    const p = pieces.get(sq);
    const draggable = p && api.canDrag && api.canDrag(sq);
    drag = { from: sq, x: ev.clientX, y: ev.clientY, moved: false, el: draggable ? p.el : null };
    if (draggable) {
      root.setPointerCapture(ev.pointerId);
      ev.preventDefault();
    }
  });
  root.addEventListener('pointermove', (ev) => {
    if (!drag) return;
    if (drag.paint) {
      const sq = sqAt(ev);
      if (sq >= 0 && sq !== drag.last) {
        drag.last = sq;
        if (api.onPaint) api.onPaint(sq, 'move');
      }
      return;
    }
    if (!drag.el) return;
    const dist = Math.hypot(ev.clientX - drag.x, ev.clientY - drag.y);
    if (!drag.moved && dist < 6) return;
    if (!drag.moved) {
      drag.moved = true;
      drag.el.classList.add('drag');
      if (api.onClick) api.onClick(drag.from, { dragStart: true });
    }
    const r = root.getBoundingClientRect();
    const cw = r.width / W;
    const ch = r.height / H;
    drag.el.style.transform = `translate(${ev.clientX - r.left - cw / 2}px, ${ev.clientY - r.top - ch / 2}px)`;
  });
  const end = (ev) => {
    if (!drag) return;
    const d = drag;
    drag = null;
    if (d.paint) {
      if (api.onPaint) api.onPaint(d.last, 'up');
      return;
    }
    if (d.moved && d.el) {
      d.el.classList.remove('drag');
      const to = ev.type === 'pointercancel' ? -1 : sqAt(ev);
      const ok = to >= 0 && to !== d.from && api.onDrop ? api.onDrop(d.from, to) : false;
      if (!ok) {
        const cur = [...pieces].find(([, p]) => p.el === d.el);
        if (cur) place(d.el, cur[0]);
      }
      return;
    }
    if (ev.type !== 'pointercancel' && api.onClick) api.onClick(d.from, {});
  };
  root.addEventListener('pointerup', end);
  root.addEventListener('pointercancel', end);
  root.addEventListener('contextmenu', (e) => e.preventDefault());

  return api;
}
