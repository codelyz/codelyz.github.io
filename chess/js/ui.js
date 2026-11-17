// Pequenos utilitários de interface: criação de elementos, diálogos, avisos,
// seletor de peças e sons.

export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') {
        for (const [sk, sv] of Object.entries(v)) {
          if (sk.startsWith('--')) el.style.setProperty(sk, String(sv));
          else el.style[sk] = sv;
        }
      }
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else if (c instanceof Node) el.appendChild(c);
    else el.appendChild(document.createTextNode(String(c)));
  }
}

export const clear = (el) => {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
};

let uidCounter = 0;
export const uid = (p = 'id') => `${p}-${++uidCounter}`;

// Ícones de interface (traço, 24×24)
const IC = {
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  flip: '<path d="M7 4v16M7 4L3 8M7 4l4 4"/><path d="M17 20V4M17 20l-4-4M17 20l4-4"/>',
  hint: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5"/><path d="M5 20h14"/>',
  upload: '<path d="M12 20V9M7 14l5-5 5 5"/><path d="M5 4h14"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6"/><path d="M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a1 1 0 0 1 1-1h10"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  play: '<path d="M7 4l13 8-13 8z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  more: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  check: '<path d="M4 12l5 5L20 6"/>',
  warn: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/>',
  restart: '<path d="M4 12a8 8 0 1 0 2.3-5.6L4 8.7"/><path d="M4 4v4.7h4.7"/>',
  skip: '<path d="M5 5l10 7-10 7z"/><path d="M19 5v14"/>',
  file: '<path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4"/>',
  grid: '<rect x="4" y="4" width="16" height="16" rx="1"/><path d="M4 9.3h16M4 14.6h16M9.3 4v16M14.6 4v16"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  dot: '<circle cx="12" cy="12" r="4.5" fill="currentColor"/>',
  line: '<path d="M4 20L20 4M20 4h-6M20 4v6"/>',
  eraser: '<path d="M8 20h12M5.5 15.5l9-9 4 4-9 9H7z"/><path d="M10 11l4 4"/>',
  robot: '<rect x="5" y="8" width="14" height="11" rx="2"/><path d="M12 4v4M9 13h.01M15 13h.01M3 13v2M21 13v2"/>',
  people: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16 4a3 3 0 0 1 0 6M18 14c2 .8 3 3 3 6"/>',
  swap: '<path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>',
};

export function icon(name, cls = '') {
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${IC[name] || ''}</svg>`;
}

// Botão com ícone e texto
export function btn(label, opts = {}) {
  const b = h('button', {
    type: 'button',
    class: `btn ${opts.kind ? 'btn-' + opts.kind : ''} ${opts.small ? 'btn-sm' : ''} ${opts.class || ''}`.trim(),
    title: opts.title,
    'aria-label': opts.ariaLabel || (opts.iconOnly ? label : undefined),
    disabled: opts.disabled,
    onclick: opts.onClick,
  });
  b.innerHTML = (opts.icon ? icon(opts.icon) : '') + (opts.iconOnly ? '' : `<span>${escapeHtml(label)}</span>`);
  return b;
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// ---------------------------------------------------------------------------
// Diálogos (sem alert/confirm, que podem estar bloqueados)
// ---------------------------------------------------------------------------

export function modal({ title, body, actions = [], wide = false, onClose, dismissable = true }) {
  const dlg = h('dialog', { class: `dlg ${wide ? 'dlg-wide' : ''}`, 'aria-label': title });
  const close = (value) => {
    if (!dlg.isConnected) return;
    if (dlg.open && dlg.close) dlg.close();
    dlg.remove();
    if (onClose) onClose(value);
  };
  const head = h('div', { class: 'dlg-head' }, h('h2', { class: 'dlg-title' }, title));
  if (dismissable) {
    const x = h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Fechar', onclick: () => close(null) });
    x.innerHTML = icon('close');
    head.appendChild(x);
  }
  const content = h('div', { class: 'dlg-body' });
  if (typeof body === 'string') content.innerHTML = body;
  else if (body) content.appendChild(body);
  const foot = h('div', { class: 'dlg-foot' });
  actions.forEach((a) => {
    const b = btn(a.label, { kind: a.kind || 'ghost', icon: a.icon });
    b.addEventListener('click', async () => {
      const r = a.onClick ? await a.onClick(close) : undefined;
      if (r !== false) close(a.value !== undefined ? a.value : a.label);
    });
    foot.appendChild(b);
  });
  dlg.append(head, content);
  if (actions.length) dlg.appendChild(foot);
  dlg.addEventListener('cancel', (e) => {
    e.preventDefault();
    if (dismissable) close(null);
  });
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg && dismissable) close(null);
  });
  document.body.appendChild(dlg);
  if (dlg.showModal) dlg.showModal();
  else dlg.setAttribute('open', '');
  const focusTarget = foot.querySelector('.btn-primary') || foot.querySelector('button');
  if (focusTarget) setTimeout(() => focusTarget.focus(), 30);
  return { close, el: dlg, body: content };
}

export function confirmDialog({ title, text, ok = 'Confirmar', cancel = 'Cancelar', danger = false }) {
  return new Promise((resolve) => {
    modal({
      title,
      body: h('p', { class: 'dlg-text' }, text),
      actions: [
        { label: cancel, kind: 'ghost', value: false },
        { label: ok, kind: danger ? 'danger' : 'primary', value: true },
      ],
      onClose: (v) => resolve(v === true),
    });
  });
}

// ---------------------------------------------------------------------------
// Avisos rápidos
// ---------------------------------------------------------------------------

let toastBox = null;
export function toast(text, { kind = 'info', timeout = 3200, action } = {}) {
  if (!toastBox) {
    toastBox = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' });
    document.body.appendChild(toastBox);
  }
  const t = h('div', { class: `toast toast-${kind}` }, h('span', null, text));
  if (action) {
    const b = h('button', { type: 'button', class: 'toast-act', onclick: () => { action.onClick(); t.remove(); } }, action.label);
    t.appendChild(b);
  }
  toastBox.appendChild(t);
  setTimeout(() => {
    t.classList.add('out');
    setTimeout(() => t.remove(), 300);
  }, timeout);
}

// ---------------------------------------------------------------------------
// Seletor múltiplo (ex.: "qualquer peça" ou "Dama, Torre")
// ---------------------------------------------------------------------------

export function multiPick({ options, value, emptyLabel = 'qualquer peça', onChange, label }) {
  const wrap = h('details', { class: 'pick' });
  const summary = h('summary', { class: 'pick-sum', 'aria-label': label });
  const list = h('div', { class: 'pick-list', role: 'group' });
  const sel = new Set(value || []);
  const refresh = () => {
    const names = options.filter((o) => sel.has(o.value)).map((o) => o.label);
    summary.textContent = names.length ? names.join(', ') : emptyLabel;
  };
  const anyBox = h('label', { class: 'pick-opt' });
  const anyInput = h('input', { type: 'checkbox' });
  anyInput.checked = sel.size === 0;
  anyInput.addEventListener('change', () => {
    if (anyInput.checked) {
      sel.clear();
      list.querySelectorAll('input[data-v]').forEach((i) => (i.checked = false));
      refresh();
      onChange([...sel]);
    } else anyInput.checked = sel.size === 0;
  });
  anyBox.append(anyInput, h('span', null, emptyLabel[0].toUpperCase() + emptyLabel.slice(1)));
  list.appendChild(anyBox);
  options.forEach((o) => {
    const lb = h('label', { class: 'pick-opt' });
    const inp = h('input', { type: 'checkbox', dataset: { v: o.value } });
    inp.checked = sel.has(o.value);
    inp.addEventListener('change', () => {
      if (inp.checked) sel.add(o.value);
      else sel.delete(o.value);
      anyInput.checked = sel.size === 0;
      refresh();
      onChange([...sel]);
    });
    lb.append(inp, o.html ? h('span', { class: 'pick-ic', html: o.html }) : null, h('span', null, o.label));
    list.appendChild(lb);
  });
  wrap.append(summary, list);
  refresh();
  ensurePickListener();
  return wrap;
}

let pickListener = false;
// Fecha seletores e menus abertos ao tocar fora deles
export function ensurePickListener() {
  if (pickListener) return;
  pickListener = true;
  document.addEventListener('click', (e) => {
    document.querySelectorAll('details.pick[open], details.menu[open]').forEach((d) => {
      if (!d.contains(e.target)) d.open = false;
    });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    document.querySelectorAll('details.pick[open], details.menu[open]').forEach((d) => (d.open = false));
  });
}

export function select(options, value, onChange, attrs = {}) {
  const s = h('select', { class: 'sel', ...attrs });
  options.forEach((o) => {
    const opt = h('option', { value: o.value }, o.label);
    if (String(o.value) === String(value)) opt.selected = true;
    s.appendChild(opt);
  });
  s.addEventListener('change', () => onChange(s.value));
  return s;
}

// Controle segmentado (grupo de botões de rádio)
export function segmented(options, value, onChange, { label, small } = {}) {
  const g = h('div', { class: `seg ${small ? 'seg-sm' : ''}`, role: 'radiogroup', 'aria-label': label });
  const render = (v) => {
    g.querySelectorAll('button').forEach((b) => {
      const on = b.dataset.v === String(v);
      b.setAttribute('aria-checked', on ? 'true' : 'false');
      b.classList.toggle('on', on);
    });
  };
  options.forEach((o) => {
    const b = h('button', { type: 'button', role: 'radio', class: `seg-b ${o.cls || ''}`, dataset: { v: String(o.value) }, title: o.title });
    b.innerHTML = (o.icon ? icon(o.icon) : '') + (o.swatch ? `<i class="sw ${o.swatch}"></i>` : '') + `<span>${escapeHtml(o.label)}</span>`;
    b.addEventListener('click', () => {
      render(o.value);
      onChange(o.value);
    });
    g.appendChild(b);
  });
  render(value);
  g.setValue = render;
  return g;
}

export function toggle(labelText, checked, onChange, hint) {
  const id = uid('tg');
  const inp = h('input', { type: 'checkbox', id, class: 'tg-in' });
  inp.checked = !!checked;
  inp.addEventListener('change', () => onChange(inp.checked));
  return h(
    'div',
    { class: 'tg' },
    inp,
    h('label', { for: id, class: 'tg-lb' }, h('span', { class: 'tg-t' }, labelText), hint ? h('span', { class: 'tg-h' }, hint) : null),
  );
}

// ---------------------------------------------------------------------------
// Sons (Web Audio, bem curtos)
// ---------------------------------------------------------------------------

let actx = null;
let soundOn = true;
export function setSound(on) {
  soundOn = on;
}
function ctx() {
  if (!actx) {
    try {
      actx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      actx = null;
    }
  }
  if (actx && actx.state === 'suspended') actx.resume().catch(() => {});
  return actx;
}
function tone(freq, dur, type = 'sine', gain = 0.08, when = 0) {
  const c = ctx();
  if (!c) return;
  const t = c.currentTime + when;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(freq * 0.6, t + dur);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}
export const sound = {
  unlock() {
    if (soundOn) ctx();
  },
  move() {
    if (soundOn) tone(520, 0.07, 'triangle', 0.09);
  },
  capture() {
    if (!soundOn) return;
    tone(300, 0.12, 'square', 0.05);
    tone(180, 0.14, 'triangle', 0.08, 0.02);
  },
  special() {
    if (!soundOn) return;
    tone(660, 0.1, 'sine', 0.07);
    tone(880, 0.14, 'sine', 0.06, 0.08);
  },
  boom() {
    if (!soundOn) return;
    tone(120, 0.35, 'sawtooth', 0.06);
    tone(70, 0.4, 'square', 0.04, 0.03);
  },
  end() {
    if (!soundOn) return;
    tone(523, 0.16, 'sine', 0.07);
    tone(659, 0.16, 'sine', 0.07, 0.14);
    tone(784, 0.3, 'sine', 0.07, 0.28);
  },
};
