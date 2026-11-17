// Estrutura do app: navegação, tema, ajustes, arquivos e avisos para baixar as regras.
import { h, icon, btn, modal, confirmDialog, toast, segmented, toggle, setSound, sound } from './ui.js';
import { PRESETS, classicPieces } from './presets.js';
import { normalizeRules } from './engine.js';
import { library, settings, saveTextFile, rulesToText, fileNameFor, copyText, readFile, parseRulesText, shareLink, decodeShare, warmDownloads, storageWorks, fingerprint, IS_STANDALONE } from './store.js';
import { createLibrary } from './library.js';
import { createEditor } from './editor.js';
import { createPlay } from './play.js';

const app = {};
const views = {};
let current = 'library';
let navBtns = [];
let mainEl;
const clone = (o) => JSON.parse(JSON.stringify(o));

const LOGO = `<svg class="logo" viewBox="0 0 30 30" aria-hidden="true">
<rect class="logo-bg" x="1" y="1" width="28" height="28" rx="5"/>
<path class="logo-grid" d="M6.6 1v28M12.2 1v28M17.8 1v28M23.4 1v28M1 6.6h28M1 12.2h28M1 17.8h28M1 23.4h28"/>
<circle class="logo-dot" cx="20.6" cy="3.8" r="1.7"/><circle class="logo-dot" cx="9.4" cy="3.8" r="1.7"/><circle class="logo-dot" cx="26.2" cy="9.4" r="1.7"/><circle class="logo-dot" cx="3.8" cy="9.4" r="1.7"/>
<circle class="logo-dot" cx="26.2" cy="20.6" r="1.7"/><circle class="logo-dot" cx="3.8" cy="20.6" r="1.7"/><circle class="logo-dot" cx="20.6" cy="26.2" r="1.7"/><circle class="logo-dot" cx="9.4" cy="26.2" r="1.7"/>
<circle class="logo-me" cx="15" cy="15" r="3.6"/></svg>`;

// ---------------------------------------------------------------------------
// Tema
// ---------------------------------------------------------------------------

let themeSetByApp = false;
const media = typeof matchMedia !== 'undefined' ? matchMedia('(prefers-color-scheme: dark)') : null;
function effectiveTheme() {
  const attr = document.documentElement.getAttribute('data-theme');
  if (attr === 'dark' || attr === 'light') return attr;
  return media && media.matches ? 'dark' : 'light';
}
function applyTheme() {
  const t = settings.data.theme;
  const html = document.documentElement;
  if (t === 'light' || t === 'dark') {
    html.setAttribute('data-theme', t);
    themeSetByApp = true;
  } else if (themeSetByApp) {
    html.removeAttribute('data-theme');
    themeSetByApp = false;
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', effectiveTheme() === 'dark' ? '#1d2826' : '#eef1f5');
  const tb = document.getElementById('theme-btn');
  if (tb) {
    const dark = effectiveTheme() === 'dark';
    tb.innerHTML = icon(dark ? 'sun' : 'moon');
    tb.setAttribute('aria-label', dark ? 'Usar tema claro' : 'Usar tema escuro');
    tb.title = dark ? 'Tema claro' : 'Tema escuro';
  }
}
function applyBoardTheme() {
  document.documentElement.setAttribute('data-board', settings.data.board || 'tinta');
}

// ---------------------------------------------------------------------------
// Estrutura
// ---------------------------------------------------------------------------

const NAV = [
  { id: 'library', label: 'Variantes', icon: 'grid' },
  { id: 'play', label: 'Jogar', icon: 'play' },
  { id: 'editor', label: 'Criar regras', icon: 'edit' },
];

function buildShell() {
  const brand = h('a', { class: 'brand', href: '#', 'aria-label': 'Xadrez Sob Medida, início', onclick: (e) => {
    e.preventDefault();
    navigate('library');
  } });
  brand.innerHTML = `${LOGO}<span class="brand-t">Xadrez Sob Medida</span>`;
  const nav = h('nav', { class: 'nav', 'aria-label': 'Seções' });
  const bottom = h('nav', { class: 'bottom-nav', 'aria-label': 'Seções' });
  navBtns = [];
  NAV.forEach((n) => {
    [nav, bottom].forEach((container) => {
      const b = h('button', { type: 'button', class: 'nav-b', dataset: { v: n.id }, onclick: () => navigate(n.id) });
      b.innerHTML = `${icon(n.icon)}<span>${n.label}</span><i class="nav-dot" hidden></i>`;
      container.appendChild(b);
      navBtns.push(b);
    });
  });
  const themeBtn = h('button', { type: 'button', class: 'icon-btn', id: 'theme-btn', onclick: () => {
    settings.set({ theme: effectiveTheme() === 'dark' ? 'light' : 'dark' });
    applyTheme();
  } });
  const gearBtn = h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Ajustes', title: 'Ajustes', onclick: openSettings });
  gearBtn.innerHTML = icon('gear');
  const header = h('header', { class: 'top' }, brand, nav, h('div', { class: 'top-act' }, themeBtn, gearBtn));
  mainEl = h('main', { class: 'main', id: 'main' });
  const skip = h('a', { class: 'skip', href: '#main' }, 'Pular para o conteúdo');
  document.body.replaceChildren(skip, header, mainEl, bottom);
}

function navigate(to, opts = {}) {
  const leaving = current;
  const go = () => {
    current = to;
    if (to !== 'play' && views.play) views.play.stop();
    if (to === 'library') {
      views.library.render();
      mainEl.replaceChildren(views.library.el);
    } else if (to === 'editor') {
      if (opts.uid) views.editor.open(opts.uid, opts.tab);
      else if (!views.editor.current() || !library.get(views.editor.current())) views.editor.showEmpty();
      else views.editor.open(views.editor.current());
      mainEl.replaceChildren(views.editor.el);
    } else if (to === 'play') {
      if (!views.play.has() && !views.play.restore()) {
        mainEl.replaceChildren(emptyPlay());
      } else {
        mainEl.replaceChildren(views.play.el);
        views.play.resume();
      }
    }
    navBtns.forEach((b) => {
      const on = b.dataset.v === to;
      b.classList.toggle('on', on);
      if (on) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });
    updateDirtyDots();
    if (!opts.keepScroll) window.scrollTo(0, 0);
  };
  if (leaving === 'editor' && to !== 'editor' && !opts.skipWarn) {
    warnUnsaved(views.editor.current(), go);
  } else go();
}

function emptyPlay() {
  return h(
    'section',
    { class: 'view play-empty sheet' },
    h('h1', { class: 'h-title' }, 'Nenhuma partida em andamento'),
    h('p', { class: 'lead' }, 'Escolha uma variante para começar.'),
    h('div', { class: 'ed-start' }, ...PRESETS.slice(0, 4).map((p) => btn(p.name, { kind: 'ghost', icon: 'play', onClick: () => app.playPreset(p.id) })), btn('Ver todas as variantes', { kind: 'primary', onClick: () => navigate('library') })),
  );
}

function updateDirtyDots() {
  const dirty = library.anyDirty();
  navBtns.forEach((b) => {
    const dot = b.querySelector('.nav-dot');
    if (dot) dot.hidden = !(dirty && (b.dataset.v === 'library' || b.dataset.v === 'editor'));
  });
}

// ---------------------------------------------------------------------------
// Avisos para baixar
// ---------------------------------------------------------------------------

const warned = new Map(); // uid -> fingerprint já avisada
function warnUnsaved(uid, then) {
  const item = uid && library.get(uid);
  if (!item || !library.isDirty(item) || warned.get(uid) === fingerprint(item.rules)) {
    then();
    return;
  }
  warned.set(uid, fingerprint(item.rules));
  modal({
    title: 'Baixar as regras antes de sair?',
    body: h('p', { class: 'dlg-text' }, `"${item.rules.name}" ainda não foi baixada. Ela fica guardada só neste navegador, que pode apagar os dados. Baixe o arquivo .json para não perder o seu trabalho.`),
    actions: [
      { label: 'Agora não', kind: 'ghost', value: 'skip' },
      {
        label: 'Baixar regras',
        kind: 'primary',
        icon: 'download',
        value: 'dl',
        onClick: async () => {
          await app.download(uid);
        },
      },
    ],
    onClose: () => then(),
  });
}

let lastReminder = Date.now();
function reminderTick() {
  if (current !== 'editor') return;
  const uid = views.editor.current();
  const item = uid && library.get(uid);
  if (!item || !library.isDirty(item)) return;
  const now = Date.now();
  if (now - lastReminder < 5 * 60 * 1000 || now - item.updatedAt > 10 * 60 * 1000) return;
  lastReminder = now;
  toast('Lembrete: estas regras ainda não foram baixadas.', { kind: 'warn', timeout: 8000, action: { label: 'Baixar', onClick: () => app.download(uid) } });
}

// ---------------------------------------------------------------------------
// Ações do app (usadas pelas telas)
// ---------------------------------------------------------------------------

app.onLibraryChange = () => updateDirtyDots();

app.download = async (uid) => {
  const item = library.get(uid);
  if (!item) return;
  const text = rulesToText(item.rules);
  const name = fileNameFor(item.rules);
  const r = await saveTextFile(name, text);
  if (r.ok) {
    library.markSaved(uid);
    toast(`Regras baixadas: ${name}. Para jogar de novo depois, use "Abrir arquivo".`, { timeout: 5000 });
    refreshAfterSave();
    return true;
  }
  if (r.declined) {
    toast('Download cancelado. As regras continuam sem cópia.', { kind: 'warn' });
    return false;
  }
  if (r.busy) {
    toast('Já existe um download esperando confirmação.', { kind: 'warn' });
    return false;
  }
  copyDialog(uid, name, text);
  return false;
};

function refreshAfterSave() {
  updateDirtyDots();
  if (current === 'library') views.library.render();
  if (current === 'editor' && views.editor.current()) views.editor.open(views.editor.current());
}

function copyDialog(uid, name, text) {
  const ta = h('textarea', { class: 'json', rows: 10, readonly: true, 'aria-label': 'Regras em JSON' });
  ta.value = text;
  modal({
    title: 'Guarde o texto das regras',
    wide: true,
    body: h('div', null, h('p', { class: 'dlg-text' }, `Este navegador não deixou baixar o arquivo. Copie o texto abaixo e salve num arquivo chamado ${name}. Depois é só abrir esse arquivo aqui.`), ta),
    actions: [
      { label: 'Fechar', kind: 'ghost' },
      {
        label: 'Copiar e marcar como guardada',
        kind: 'primary',
        icon: 'copy',
        onClick: async () => {
          const ok = await copyText(text);
          if (!ok) {
            ta.select();
            toast('Não deu para copiar sozinho. O texto está selecionado: copie manualmente.', { kind: 'warn' });
            return false;
          }
          library.markSaved(uid);
          toast('Texto copiado. Cole num arquivo .json para guardar.');
          refreshAfterSave();
          return true;
        },
      },
    ],
  });
}

app.share = async (uid) => {
  const item = library.get(uid);
  if (!item) return;
  const link = await shareLink(item.rules);
  const ok = await copyText(link);
  const inp = h('input', { class: 'inp', value: link, readonly: true, 'aria-label': 'Link' });
  modal({
    title: ok ? 'Link copiado' : 'Link de compartilhamento',
    body: h('div', null, h('p', { class: 'dlg-text' }, 'Quem abrir este link recebe uma cópia das regras e pode jogar na hora. O link não substitui o arquivo: baixe as regras para guardar.'), inp),
    actions: [{ label: 'Fechar', kind: 'primary' }],
  });
  setTimeout(() => inp.select(), 50);
};

app.duplicate = (uid) => {
  const item = library.get(uid);
  if (!item) return;
  const r = clone(item.rules);
  r.name = `${r.name} (cópia)`.slice(0, 60);
  const n = library.add(r, { origin: 'copy' });
  navigate('editor', { uid: n.uid, skipWarn: true });
  toast('Cópia criada. Ela ainda não foi baixada.');
};

app.remove = async (uid) => {
  const item = library.get(uid);
  if (!item) return;
  const dirty = library.isDirty(item);
  const ok = await confirmDialog({
    title: `Excluir "${item.rules.name}"?`,
    text: dirty ? 'Atenção: esta variante nunca foi baixada. Se excluir, ela se perde para sempre.' : 'A variante sai deste navegador. O arquivo que você baixou continua com você.',
    ok: 'Excluir',
    danger: true,
  });
  if (!ok) return;
  library.remove(uid);
  if (views.editor.current() === uid) views.editor.showEmpty();
  toast('Variante excluída.');
  navigate(current === 'editor' ? 'library' : current, { skipWarn: true, keepScroll: true });
};

app.copyPreset = (id) => {
  const p = PRESETS.find((x) => x.id === id) || PRESETS[0];
  const r = clone(p);
  delete r.id;
  r.name = `${p.name} (minha versão)`.slice(0, 60);
  const item = library.add(r, { origin: `preset:${id}` });
  navigate('editor', { uid: item.uid, skipWarn: true });
  toast('Pronto para editar. As mudanças ficam neste navegador até você baixar o arquivo.', { timeout: 5500 });
};

app.newBlank = () => {
  const r = normalizeRules({
    name: 'Nova variante',
    description: '',
    board: { width: 8, height: 8 },
    pieces: classicPieces(),
    setup: '4r3/8/8/8/8/8/8/4R3',
  });
  const item = library.add(r, { origin: 'new' });
  navigate('editor', { uid: item.uid, tab: 'setup', skipWarn: true });
  toast('Tabuleiro só com os Reis. Coloque as peças na aba Posição inicial.', { timeout: 5000 });
};

app.pickFile = (cb) => {
  const inp = h('input', { type: 'file', accept: '.json,application/json', style: { display: 'none' } });
  inp.addEventListener('change', () => {
    if (inp.files && inp.files[0]) cb(inp.files[0]);
    inp.remove();
  });
  document.body.appendChild(inp);
  inp.click();
};

async function importFile(file) {
  try {
    const { rules, problem } = parseRulesText(await readFile(file));
    const item = library.add(rules, { origin: 'file', saved: true });
    navigate('editor', { uid: item.uid, skipWarn: true });
    toast(problem ? `Arquivo aberto, mas falta corrigir: ${problem}` : `"${rules.name}" aberta.`, { kind: problem ? 'warn' : 'info', timeout: 5000 });
  } catch (e) {
    toast(e.message, { kind: 'warn', timeout: 5000 });
  }
}
app.openFile = () => app.pickFile(importFile);

app.edit = (uid) => navigate('editor', { uid });

app.editSource = async (source, rules) => {
  if (source && source.kind === 'mine' && library.get(source.id)) {
    navigate('editor', { uid: source.id });
    return;
  }
  const ok = await confirmDialog({ title: 'Editar uma cópia?', text: 'As variantes prontas não mudam. Vou criar uma cópia sua para editar.', ok: 'Criar cópia' });
  if (!ok) return;
  const r = clone(rules);
  r.name = `${r.name} (minha versão)`.slice(0, 60);
  const item = library.add(r, { origin: 'copy' });
  navigate('editor', { uid: item.uid, skipWarn: true });
};

app.playItem = (uid) => {
  const item = library.get(uid);
  if (!item) return;
  const go = () => app.newGameDialog({ source: { kind: 'mine', id: uid }, rules: item.rules, name: item.rules.name });
  if (current === 'editor') warnUnsaved(uid, go);
  else go();
};

app.playPreset = (id) => {
  const p = PRESETS.find((x) => x.id === id);
  if (p) app.newGameDialog({ source: { kind: 'preset', id }, rules: p, name: p.name });
};

app.newGameDialog = ({ source, rules, name }) => {
  const s = settings.data;
  const opts = { mode: s.mode || 'ai', side: s.side || 'white', level: s.level || 'medium' };
  const sideRow = h('div', { class: 'field-block' }, h('span', { class: 'mg-tool-lb' }, 'Suas peças'), segmented(
    [
      { value: 'white', label: 'Brancas' },
      { value: 'black', label: 'Pretas' },
      { value: 'random', label: 'Sorteio' },
    ],
    opts.side,
    (v) => (opts.side = v),
    { label: 'Suas peças' },
  ));
  const levelRow = h('div', { class: 'field-block' }, h('span', { class: 'mg-tool-lb' }, 'Nível do robô'), segmented(
    [
      { value: 'easy', label: 'Fácil' },
      { value: 'medium', label: 'Médio' },
      { value: 'hard', label: 'Difícil' },
    ],
    opts.level,
    (v) => (opts.level = v),
    { label: 'Nível do robô' },
  ));
  const sync = () => {
    sideRow.hidden = opts.mode !== 'ai';
    levelRow.hidden = opts.mode === 'local';
  };
  const modeRow = h('div', { class: 'field-block' }, h('span', { class: 'mg-tool-lb' }, 'Quem joga'), segmented(
    [
      { value: 'ai', label: 'Contra o robô', icon: 'robot' },
      { value: 'local', label: 'Duas pessoas', icon: 'people' },
      { value: 'auto', label: 'Robô contra robô', icon: 'robot' },
    ],
    opts.mode,
    (v) => {
      opts.mode = v;
      sync();
    },
    { label: 'Quem joga' },
  ));
  sync();
  modal({
    title: `Jogar: ${name || rules.name}`,
    body: h('div', { class: 'newgame' }, modeRow, sideRow, levelRow),
    actions: [
      { label: 'Cancelar', kind: 'ghost' },
      {
        label: 'Começar partida',
        kind: 'primary',
        icon: 'play',
        onClick: () => {
          sound.unlock();
          settings.set({ mode: opts.mode, side: opts.side, level: opts.level });
          const human = opts.side === 'random' ? (Math.random() < 0.5 ? 0 : 1) : opts.side === 'black' ? 1 : 0;
          const ok = views.play.start({ source, rules: clone(rules), name: name || rules.name, mode: opts.mode, human, level: opts.level });
          if (!ok) return false;
          navigate('play', { skipWarn: true });
          return true;
        },
      },
    ],
  });
};

function openSettings() {
  const s = settings.data;
  const body = h(
    'div',
    { class: 'settings' },
    h('div', { class: 'field-block' }, h('span', { class: 'mg-tool-lb' }, 'Tema'), segmented(
      [
        { value: 'auto', label: 'Automático' },
        { value: 'light', label: 'Claro' },
        { value: 'dark', label: 'Escuro' },
      ],
      s.theme,
      (v) => {
        settings.set({ theme: v });
        applyTheme();
      },
      { label: 'Tema' },
    )),
    h('div', { class: 'field-block' }, h('span', { class: 'mg-tool-lb' }, 'Cores do tabuleiro'), segmented(
      [
        { value: 'tinta', label: 'Tinta', swatch: 'bsw bsw-tinta' },
        { value: 'madeira', label: 'Madeira', swatch: 'bsw bsw-madeira' },
        { value: 'verde', label: 'Verde', swatch: 'bsw bsw-verde' },
        { value: 'marmore', label: 'Mármore', swatch: 'bsw bsw-marmore' },
      ],
      s.board,
      (v) => {
        settings.set({ board: v });
        applyBoardTheme();
      },
      { label: 'Cores do tabuleiro' },
    )),
    toggle('Mostrar coordenadas (a–h, 1–8)', s.coords, (v) => {
      settings.set({ coords: v });
      views.play.refreshSettings();
    }),
    toggle('Sons', s.sound, (v) => {
      settings.set({ sound: v });
      setSound(v);
    }),
    !storageWorks() ? h('p', { class: 'prob' }, 'Este navegador não está guardando dados desta página. Baixe suas regras sempre que terminar de editar.') : null,
  );
  modal({ title: 'Ajustes', body, actions: [{ label: 'Pronto', kind: 'primary' }] });
}

// ---------------------------------------------------------------------------
// Início
// ---------------------------------------------------------------------------

async function handleShareLink() {
  const m = /^#v=([A-Za-z0-9_-]+)$/.exec(location.hash);
  if (!m) return;
  try {
    const { rules, problem } = await decodeShare(m[1]);
    history.replaceState(null, '', location.pathname + location.search);
    const item = library.add(rules, { origin: 'link' });
    views.library.render();
    modal({
      title: `Você recebeu: ${rules.name}`,
      body: h('p', { class: 'dlg-text' }, `${rules.description || 'Uma variante de xadrez.'} ${problem ? `Atenção: ${problem}` : ''} A variante foi guardada neste navegador. Baixe o arquivo se quiser manter uma cópia.`),
      actions: [
        { label: 'Ver as regras', kind: 'ghost', onClick: () => navigate('editor', { uid: item.uid, skipWarn: true }) },
        { label: 'Jogar agora', kind: 'primary', icon: 'play', onClick: () => app.playItem(item.uid) },
      ],
    });
  } catch (e) {
    toast(`Não foi possível abrir o link: ${e.message}`, { kind: 'warn', timeout: 6000 });
  }
}

function init() {
  settings.load();
  library.load();
  setSound(settings.data.sound);
  buildShell();
  applyTheme();
  applyBoardTheme();
  if (media && media.addEventListener) media.addEventListener('change', applyTheme);

  views.library = createLibrary(app);
  views.editor = createEditor(app);
  views.play = createPlay(app);

  navigate('library', { skipWarn: true });
  handleShareLink();

  // arrastar arquivo para a página
  window.addEventListener('dragover', (e) => {
    if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) {
      e.preventDefault();
      document.body.classList.add('dropping');
    }
  });
  window.addEventListener('dragleave', (e) => {
    if (!e.relatedTarget) document.body.classList.remove('dropping');
  });
  window.addEventListener('drop', (e) => {
    document.body.classList.remove('dropping');
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (!f) return;
    e.preventDefault();
    importFile(f);
  });

  // aviso do navegador ao fechar com regras não baixadas
  window.addEventListener('beforeunload', (e) => {
    if (library.anyDirty()) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  setInterval(reminderTick, 60 * 1000);
  setTimeout(warmDownloads, 0);
  setTimeout(() => {
    if (!storageWorks()) toast('Este navegador não está guardando dados. Baixe suas regras sempre que terminar.', { kind: 'warn', timeout: 8000 });
  }, 800);

  if ('serviceWorker' in navigator && !IS_STANDALONE && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

init();
