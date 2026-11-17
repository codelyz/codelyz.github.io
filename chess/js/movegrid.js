// Diagrama de movimentos (grade 9×9 com a peça no centro) e o editor em grade.
import { h, icon, segmented, escapeHtml } from './ui.js';
import { pieceSVG } from './pieces.js';
import { stepLabel, MODE_TEXT } from './describe.js';

export const R = 4; // raio da grade (9×9)
const MODE_BIT = { both: 3, move: 1, capture: 2 };
const BIT_MODE = { 3: 'both', 1: 'move', 2: 'capture' };

// Calcula as marcas de cada casa da grade
function computeMarks(steps) {
  const marks = new Map(); // "dx,dy" -> { bits, leap, ride, hop }
  const lines = [];
  const mark = (dx, dy, bits, kind, hop) => {
    const k = `${dx},${dy}`;
    const m = marks.get(k) || { bits: 0, leap: false, ride: false, hop: false };
    m.bits |= bits;
    if (kind === 'leap') m.leap = true;
    else m.ride = true;
    if (hop) m.hop = true;
    marks.set(k, m);
  };
  for (const st of steps) {
    const bits = MODE_BIT[st.mode] || 3;
    if (st.kind === 'leap') {
      if (Math.abs(st.dx) <= R && Math.abs(st.dy) <= R) mark(st.dx, st.dy, bits, 'leap', false);
      continue;
    }
    let k = 1;
    let x = st.dx;
    let y = st.dy;
    const lim = st.range || 99;
    let lastX = 0;
    let lastY = 0;
    while (k <= lim && Math.abs(x) <= R && Math.abs(y) <= R) {
      mark(x, y, bits, 'ride', st.hop);
      lastX = x;
      lastY = y;
      x += st.dx;
      y += st.dy;
      k++;
    }
    if (lastX || lastY) lines.push({ x: lastX, y: lastY, bits, open: !st.range || st.range >= k, hop: !!st.hop });
  }
  return { marks, lines };
}

// Diagrama (somente leitura ou interativo)
export function moveDiagram({ steps, ghost = [], piece, color = 0, size = 'md', onCell, label }) {
  const { marks, lines } = computeMarks(steps);
  const ghostMarks = computeMarks(ghost).marks;
  const n = 2 * R + 1;
  const wrap = h('div', { class: `mg mg-${size}`, role: onCell ? 'grid' : 'img', 'aria-label': label || 'Diagrama de movimentos' });
  const grid = h('div', { class: 'mg-grid' });
  for (let row = 0; row < n; row++) {
    const dy = R - row;
    for (let col = 0; col < n; col++) {
      const dx = col - R;
      const m = marks.get(`${dx},${dy}`);
      const g = !m && ghostMarks.get(`${dx},${dy}`);
      const center = dx === 0 && dy === 0;
      const cls = ['mg-c', (dx + dy) % 2 ? 'mg-l' : 'mg-d'];
      let inner = '';
      if (center) {
        cls.push('mg-me');
        inner = piece ? pieceSVG(piece.icon, color, piece.id) : '';
      } else if (m) {
        cls.push('mk-' + BIT_MODE[m.bits], m.leap ? 'mk-leap' : 'mk-ride');
        if (m.hop) cls.push('mk-hop');
        inner = '<i></i>';
      } else if (g) {
        cls.push('mk-ghost', 'mk-' + BIT_MODE[g.bits], g.leap ? 'mk-leap' : 'mk-ride');
        inner = '<i></i>';
      }
      const attrs = { class: cls.join(' ') };
      let el;
      if (onCell && !center) {
        el = h('button', { ...attrs, type: 'button', 'aria-label': cellLabel(dx, dy, m), onclick: () => onCell(dx, dy) });
      } else {
        el = h('div', attrs);
      }
      el.innerHTML = inner;
      grid.appendChild(el);
    }
  }
  wrap.appendChild(grid);
  // linhas das peças que deslizam
  if (lines.length) {
    const svgLines = lines
      .map((l) => {
        const x2 = R + 0.5 + l.x;
        const y2 = R + 0.5 - l.y;
        const len = Math.hypot(l.x, l.y);
        const ux = l.x / len;
        const uy = -l.y / len;
        const arrow = l.open
          ? `<path class="mg-arrow" d="M${x2 + ux * 0.32} ${y2 + uy * 0.32} L${x2 - ux * 0.05 - uy * 0.2} ${y2 - uy * 0.05 + ux * 0.2} L${x2 - ux * 0.05 + uy * 0.2} ${y2 - uy * 0.05 - ux * 0.2}Z"/>`
          : '';
        return `<g class="ln-${BIT_MODE[l.bits]} ${l.hop ? 'ln-hop' : ''}"><line x1="${R + 0.5}" y1="${R + 0.5}" x2="${x2}" y2="${y2}"/>${arrow}</g>`;
      })
      .join('');
    const svg = h('div', { class: 'mg-lines', html: `<svg viewBox="0 0 ${n} ${n}" preserveAspectRatio="none" aria-hidden="true">${svgLines}</svg>` });
    wrap.appendChild(svg);
  }
  return wrap;
}

function cellLabel(dx, dy, m) {
  const parts = [];
  if (dy) parts.push(`${Math.abs(dy)} ${dy > 0 ? 'para frente' : 'para trás'}`);
  if (dx) parts.push(`${Math.abs(dx)} ${dx > 0 ? 'à direita' : 'à esquerda'}`);
  const where = parts.join(' e ');
  return m ? `${where}: ${MODE_TEXT[BIT_MODE[m.bits]]}` : `${where}: vazio`;
}

// ---------------------------------------------------------------------------
// Edição
// ---------------------------------------------------------------------------

const gcd = (a, b) => (b ? gcd(b, a % b) : a);

export function symmetric(dx, dy, sym) {
  const list = [[dx, dy]];
  if (sym === 'mirror') list.push([-dx, dy]);
  if (sym === 'all') list.push([-dx, dy], [dx, -dy], [-dx, -dy], [dy, dx], [-dy, dx], [dy, -dx], [-dy, -dx]);
  const seen = new Set();
  return list.filter(([x, y]) => {
    const k = `${x},${y}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// Aplica a ferramenta escolhida a uma casa. Devolve a nova lista de passos.
export function applyTool(steps, dx, dy, tool) {
  const { kind, mode, sym, hop } = tool;
  let out = steps.slice();
  const variants = symmetric(dx, dy, sym);
  if (kind === 'erase') {
    for (const [vx, vy] of variants) {
      out = out.filter((s) => {
        if (s.kind === 'leap') return !(s.dx === vx && s.dy === vy);
        let k;
        if (s.dx !== 0) {
          if (vx % s.dx !== 0) return true;
          k = vx / s.dx;
          if (s.dy * k !== vy) return true;
        } else {
          if (vx !== 0 || vy % s.dy !== 0) return true;
          k = vy / s.dy;
        }
        if (k < 1) return true;
        return !(s.range === 0 || !s.range || k <= s.range);
      });
    }
    return out;
  }
  if (kind === 'leap') {
    const existing = out.find((s) => s.kind === 'leap' && s.dx === dx && s.dy === dy);
    if (existing && existing.mode === mode) {
      return out.filter((s) => !(s.kind === 'leap' && variants.some(([x, y]) => s.dx === x && s.dy === y)));
    }
    for (const [x, y] of variants) {
      out = out.filter((s) => !(s.kind === 'leap' && s.dx === x && s.dy === y));
      out.push({ dx: x, dy: y, kind: 'leap', mode });
    }
    return out;
  }
  // linha
  const g = gcd(Math.abs(dx), Math.abs(dy));
  const ux = dx / g;
  const uy = dy / g;
  const atEdge = Math.abs(dx + ux) > R || Math.abs(dy + uy) > R;
  const range = atEdge ? 0 : g;
  const existing = out.find((s) => s.kind === 'ride' && s.dx === ux && s.dy === uy);
  const dirs = symmetric(ux, uy, sym);
  if (existing && existing.mode === mode && (existing.range || 0) === range && !!existing.hop === !!hop) {
    return out.filter((s) => !(s.kind === 'ride' && dirs.some(([x, y]) => s.dx === x && s.dy === y)));
  }
  for (const [x, y] of dirs) {
    out = out.filter((s) => !(s.kind === 'ride' && s.dx === x && s.dy === y));
    const st = { dx: x, dy: y, kind: 'ride', mode };
    if (range) st.range = range;
    if (hop) st.hop = true;
    out.push(st);
  }
  return out;
}

// Ferramenta atual (fica guardada enquanto a página está aberta)
export const toolState = { kind: 'leap', mode: 'both', sym: 'all', hop: false };

export function toolPanel(onChange) {
  const box = h('div', { class: 'mg-tools' });
  const kinds = segmented(
    [
      { value: 'leap', label: 'Pular para a casa', icon: 'dot' },
      { value: 'ride', label: 'Andar em linha', icon: 'line' },
      { value: 'erase', label: 'Apagar', icon: 'eraser' },
    ],
    toolState.kind,
    (v) => {
      toolState.kind = v;
      hopRow.hidden = v !== 'ride';
      onChange();
    },
    { label: 'Ferramenta' },
  );
  const modes = segmented(
    [
      { value: 'both', label: 'Move e captura', swatch: 'sw-both' },
      { value: 'move', label: 'Só move', swatch: 'sw-move' },
      { value: 'capture', label: 'Só captura', swatch: 'sw-capture' },
    ],
    toolState.mode,
    (v) => {
      toolState.mode = v;
      onChange();
    },
    { label: 'Tipo de movimento' },
  );
  const syms = segmented(
    [
      { value: 'all', label: '8 direções' },
      { value: 'mirror', label: 'Espelhar lados' },
      { value: 'none', label: 'Só esta casa' },
    ],
    toolState.sym,
    (v) => {
      toolState.sym = v;
      onChange();
    },
    { label: 'Simetria', small: true },
  );
  const hopIn = h('input', { type: 'checkbox', id: 'mg-hop' });
  hopIn.checked = toolState.hop;
  hopIn.addEventListener('change', () => {
    toolState.hop = hopIn.checked;
    onChange();
  });
  const hopRow = h('label', { class: 'mg-hoprow', for: 'mg-hop' }, hopIn, h('span', null, 'Precisa pular por cima de uma peça (como o canhão do xadrez chinês)'));
  hopRow.hidden = toolState.kind !== 'ride';
  box.append(
    h('div', { class: 'mg-tool-group' }, h('span', { class: 'mg-tool-lb' }, 'Ferramenta'), kinds),
    h('div', { class: 'mg-tool-group' }, h('span', { class: 'mg-tool-lb' }, 'O que a peça faz lá'), modes),
    h('div', { class: 'mg-tool-group' }, h('span', { class: 'mg-tool-lb' }, 'Repetir em'), syms),
    hopRow,
  );
  return box;
}

// Lista editável dos passos (para ajuste fino)
export function stepList(steps, onChange) {
  const list = h('ul', { class: 'step-list' });
  steps.forEach((st, i) => {
    const modeSel = h('select', { class: 'sel sel-sm', 'aria-label': 'Tipo' });
    ['both', 'move', 'capture'].forEach((m) => {
      const o = h('option', { value: m }, MODE_TEXT[m]);
      if (st.mode === m) o.selected = true;
      modeSel.appendChild(o);
    });
    modeSel.addEventListener('change', () => {
      const next = steps.slice();
      next[i] = { ...st, mode: modeSel.value };
      onChange(next);
    });
    let rangeSel = null;
    if (st.kind === 'ride') {
      rangeSel = h('select', { class: 'sel sel-sm', 'aria-label': 'Alcance' });
      [0, 1, 2, 3, 4, 5, 6, 7].forEach((r) => {
        const o = h('option', { value: r }, r ? `até ${r}` : 'até a borda');
        if ((st.range || 0) === r) o.selected = true;
        rangeSel.appendChild(o);
      });
      rangeSel.addEventListener('change', () => {
        const next = steps.slice();
        const r = parseInt(rangeSel.value, 10);
        const ns = { ...st };
        if (r) ns.range = r;
        else delete ns.range;
        next[i] = ns;
        onChange(next);
      });
    }
    const del = h('button', { type: 'button', class: 'icon-btn', 'aria-label': `Apagar: ${stepLabel(st)}`, onclick: () => onChange(steps.filter((_, j) => j !== i)) });
    del.innerHTML = icon('close');
    list.appendChild(h('li', { class: `step mk-${st.mode}` }, h('i', { class: `step-sw sw-${st.mode}` }), h('span', { class: 'step-t' }, stepLabel(st)), modeSel, rangeSel, del));
  });
  if (!steps.length) list.appendChild(h('li', { class: 'step-empty' }, 'Nenhum movimento neste grupo. Toque nas casas da grade para criar.'));
  return list;
}

export function legendHTML() {
  return `<span class="lg"><i class="sw sw-both"></i>move e captura</span><span class="lg"><i class="sw sw-move"></i>só move</span><span class="lg"><i class="sw sw-capture"></i>só captura</span>`;
}

export { escapeHtml };
