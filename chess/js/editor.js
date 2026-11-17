// Editor de regras: peças e movimentos, regras especiais, posição inicial,
// condições de vitória e o arquivo JSON.
import { h, icon, btn, modal, confirmDialog, toast, multiPick, select, segmented, toggle, escapeHtml, ensurePickListener } from './ui.js';
import { normalizeRules, compileRules, initialState, legalMoves, setupToCells, cellsToSetup, squareName, parseSquare, pieceAutoValue, MIN_SIZE, MAX_SIZE } from './engine.js';
import { ICONS, ICON_KEYS, ICON_GROUPS, iconGroup, pieceSVG } from './pieces.js';
import { moveDiagram, toolPanel, toolState, applyTool, stepList, legendHTML } from './movegrid.js';
import { MOVE_TEMPLATES, pawnMoves, TRIGGER_EXAMPLES, PRESETS, lShape, leap, ride } from './presets.js';
import { WHEN_OPTIONS, BACK_OPTIONS, setLabel, EVENT_OPTIONS, COND_OPTIONS, EFFECT_OPTIONS, triggerSentence, victoryLines, nameOf, stepsSummary } from './describe.js';
import { createBoard } from './board.js';
import { library, rulesToText, parseRulesText, readFile, copyText, IS_STANDALONE } from './store.js';

const TABS = [
  { id: 'pieces', label: 'Peças' },
  { id: 'triggers', label: 'Regras especiais' },
  { id: 'setup', label: 'Posição inicial' },
  { id: 'victory', label: 'Vitória e opções' },
  { id: 'json', label: 'Arquivo' },
];
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const clone = (o) => JSON.parse(JSON.stringify(o));

// ---------------------------------------------------------------------------
// Mudanças estruturais nas regras
// ---------------------------------------------------------------------------

function renamePieceId(rules, oldId, newId) {
  const map = (id) => (id === oldId ? newId : id);
  rules.pieces.forEach((p) => {
    if (p.id === oldId) p.id = newId;
    if (p.promotion) p.promotion.to = p.promotion.to.map(map);
    p.moves.forEach((s) => {
      if (s.piece) s.piece = map(s.piece);
    });
  });
  const lo = oldId.toLowerCase();
  rules.setup = rules.setup.replace(/[A-Za-z]/g, (ch) => (ch === oldId ? newId : ch === lo ? newId.toLowerCase() : ch));
  rules.triggers.forEach((t) => {
    t.pieces = t.pieces.map(map);
    t.targets = t.targets.map(map);
    t.effects.forEach((e) => {
      if (e.piece) e.piece = map(e.piece);
    });
  });
  if (rules.victory.goal) rules.victory.goal.pieces = rules.victory.goal.pieces.map(map);
}

function removePieceId(rules, id) {
  const { width: W, height: H } = rules.board;
  rules.pieces = rules.pieces.filter((p) => p.id !== id);
  rules.pieces.forEach((p) => {
    if (p.promotion) {
      p.promotion.to = p.promotion.to.filter((x) => x !== id);
      if (!p.promotion.to.length) p.promotion = null;
    }
    p.moves.forEach((s) => {
      if (s.when === 'nearFriend' && s.piece === id) s.piece = '';
    });
  });
  rules.setup = cellsToSetup(setupToCells(rules.setup, W, H).map((c) => (c && c.id === id ? null : c)), W, H);
  rules.triggers.forEach((t) => {
    const hadPieces = t.pieces.length;
    const hadTargets = t.targets.length;
    t.pieces = t.pieces.filter((x) => x !== id);
    t.targets = t.targets.filter((x) => x !== id);
    if ((hadPieces && !t.pieces.length) || (hadTargets && !t.targets.length)) t.enabled = false;
    t.effects = t.effects.filter((e) => e.piece !== id);
  });
  if (rules.victory.goal) rules.victory.goal.pieces = rules.victory.goal.pieces.filter((x) => x !== id);
}

function resizeBoard(rules, W2, H2) {
  const { width: W, height: H } = rules.board;
  const cells = setupToCells(rules.setup, W, H);
  const out = new Array(W2 * H2).fill(null);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const c = cells[y * W + x];
      if (!c || x >= W2) continue;
      // brancas presas embaixo, pretas presas em cima
      const ny = y < H / 2 ? y : y + (H2 - H);
      if (ny < 0 || ny >= H2) continue;
      out[ny * W2 + x] = c;
    }
  }
  rules.board = { width: W2, height: H2 };
  rules.setup = cellsToSetup(out, W2, H2);
  if (rules.victory.goal) rules.victory.goal.squares = rules.victory.goal.squares.filter((s) => parseSquare(s, W2, H2) >= 0);
}

function freeLetter(rules, prefer) {
  const used = new Set(rules.pieces.map((p) => p.id));
  const first = String(prefer || '').toUpperCase().normalize('NFD').replace(/[^A-Z]/g, '')[0];
  if (first && !used.has(first)) return first;
  return [...LETTERS].find((l) => !used.has(l)) || null;
}

// ---------------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------------

export function createEditor(app) {
  const root = h('section', { class: 'view editor', 'aria-labelledby': 'ed-title' });
  let E = null;

  function open(uid, tab) {
    const item = library.get(uid);
    if (!item) {
      E = null;
      renderEmpty();
      return;
    }
    const same = E && E.uid === uid;
    E = {
      uid,
      rules: normalizeRules(item.rules),
      tab: tab || (same ? E.tab : 'pieces'),
      pieceIdx: same ? E.pieceIdx : 0,
      setIdx: same ? E.setIdx : 0,
      brush: same ? E.brush : null,
      problem: null,
      warnings: [],
      G: null,
    };
    validate();
    render();
  }

  function validate() {
    E.problem = null;
    E.warnings = [];
    E.G = null;
    try {
      const G = compileRules(E.rules);
      E.G = G;
      const r = E.rules;
      if (r.victory.royal !== 'none' && !r.pieces.some((p) => p.royal)) E.warnings.push('Nenhuma peça está marcada como Rei, então não existe xeque-mate. Marque uma peça como Rei ou escolha outra forma de vencer.');
      else if (r.victory.royal !== 'none' && G.hasRoyal[0] !== G.hasRoyal[1]) E.warnings.push(`Só as ${G.hasRoyal[0] ? 'brancas' : 'pretas'} têm Rei na posição inicial.`);
      r.pieces.forEach((p) => {
        if (!p.moves.some((s) => s.steps.length)) E.warnings.push(`${p.name} não tem nenhum movimento.`);
      });
      const S = initialState(G);
      if (!legalMoves(G, S).length) E.warnings.push('As brancas não têm nenhum lance na posição inicial.');
      if (r.victory.goal && r.victory.goal.mode === 'squares' && !r.victory.goal.squares.length) E.warnings.push('O objetivo extra precisa de pelo menos uma casa marcada (aba Vitória e opções).');
      const cells = setupToCells(r.setup, r.board.width, r.board.height);
      if (!cells.some((c) => c && c.color === 0) || !cells.some((c) => c && c.color === 1)) E.warnings.push('Coloque peças dos dois lados na posição inicial.');
    } catch (e) {
      E.problem = e.message;
    }
  }

  // Salva no navegador e atualiza avisos. rerender: redesenha a aba atual.
  function commit({ rerender = true } = {}) {
    library.update(E.uid, clone(E.rules));
    validate();
    updateStatus();
    if (rerender) renderTab();
    app.onLibraryChange();
  }

  // --- estrutura ------------------------------------------------------------
  let statusPill;
  let unsavedBar;
  let problemBox;
  let tabPanel;
  let tabBtns = [];

  function renderEmpty() {
    root.replaceChildren(
      h(
        'div',
        { class: 'ed-empty sheet' },
        h('h1', { class: 'h-title', id: 'ed-title' }, 'Criar regras'),
        h('p', { class: 'lead' }, 'Comece de uma variante pronta e mude o que quiser, ou monte tudo do zero.'),
        h(
          'div',
          { class: 'ed-start' },
          ...PRESETS.slice(0, 4).map((p) => btn(`Partir de: ${p.name}`, { kind: 'ghost', onClick: () => app.copyPreset(p.id) })),
          btn('Tabuleiro em branco', { kind: 'ghost', icon: 'grid', onClick: () => app.newBlank() }),
          btn('Abrir arquivo de regras', { kind: 'ghost', icon: 'upload', onClick: () => app.openFile() }),
        ),
      ),
    );
  }

  function render() {
    const r = E.rules;
    const nameIn = h('input', { class: 'ed-name', id: 'ed-title', value: r.name, maxlength: 60, 'aria-label': 'Nome da variante', spellcheck: 'false' });
    nameIn.addEventListener('input', () => {
      E.rules.name = nameIn.value || 'Variante sem nome';
      commit({ rerender: false });
    });
    const descIn = h('textarea', { class: 'ed-desc', rows: 2, maxlength: 600, placeholder: 'Descreva a ideia da variante em uma ou duas frases.', 'aria-label': 'Descrição' });
    descIn.value = r.description;
    descIn.addEventListener('input', () => {
      E.rules.description = descIn.value;
      commit({ rerender: false });
    });

    statusPill = h('span', { class: 'pill' });
    unsavedBar = h('div', { class: 'unsaved', role: 'status' });
    problemBox = h('div', { class: 'problems', 'aria-live': 'polite' });

    const actions = h(
      'div',
      { class: 'ed-actions' },
      btn('Baixar regras', { kind: 'primary', icon: 'download', onClick: () => app.download(E.uid) }),
      btn('Jogar', { kind: 'ghost', icon: 'play', onClick: () => app.playItem(E.uid) }),
      menuButton([
        !IS_STANDALONE && { label: 'Copiar link de compartilhamento', icon: 'link', onClick: () => app.share(E.uid) },
        { label: 'Duplicar variante', icon: 'copy', onClick: () => app.duplicate(E.uid) },
        { label: 'Excluir variante', icon: 'trash', danger: true, onClick: () => app.remove(E.uid) },
      ]),
    );

    const tabs = h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Partes das regras' });
    tabBtns = TABS.map((t) => {
      const b = h('button', { type: 'button', role: 'tab', class: 'tab', id: `tab-${t.id}`, 'aria-controls': 'ed-panel', onclick: () => switchTab(t.id) }, t.label);
      tabs.appendChild(b);
      return b;
    });
    tabPanel = h('div', { class: 'ed-panel', id: 'ed-panel', role: 'tabpanel' });

    root.replaceChildren(
      h('div', { class: 'ed-head sheet' }, h('div', { class: 'ed-head-top' }, nameIn, statusPill), descIn, actions, unsavedBar),
      problemBox,
      tabs,
      tabPanel,
    );
    updateStatus();
    renderTab();
  }

  function switchTab(id) {
    E.tab = id;
    renderTab();
  }

  function updateStatus() {
    const item = library.get(E.uid);
    const dirty = library.isDirty(item);
    statusPill.className = `pill ${dirty ? 'pill-warn' : 'pill-ok'}`;
    statusPill.innerHTML = dirty ? `${icon('warn')}<span>Não baixada</span>` : `${icon('check')}<span>Baixada</span>`;
    unsavedBar.hidden = !dirty;
    unsavedBar.replaceChildren();
    if (dirty) {
      unsavedBar.append(
        h('p', null, h('strong', null, 'Estas regras ainda não foram baixadas. '), 'Por enquanto elas ficam só neste navegador, que pode apagá-las. Baixe o arquivo para guardar ou enviar a alguém.'),
        btn('Baixar agora', { kind: 'mark', icon: 'download', onClick: () => app.download(E.uid) }),
      );
    }
    problemBox.replaceChildren();
    if (E.problem) {
      problemBox.append(h('div', { class: 'prob prob-err' }, h('span', { html: icon('warn') }), h('p', null, h('strong', null, 'Para jogar, corrija: '), E.problem)));
    }
    E.warnings.forEach((w) => problemBox.append(h('div', { class: 'prob' }, h('span', { html: icon('warn') }), h('p', null, w))));
  }

  function renderTab() {
    tabBtns.forEach((b, i) => {
      const on = TABS[i].id === E.tab;
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      b.classList.toggle('on', on);
    });
    let content;
    switch (E.tab) {
      case 'triggers':
        content = renderTriggers();
        break;
      case 'setup':
        content = renderSetup();
        break;
      case 'victory':
        content = renderVictory();
        break;
      case 'json':
        content = renderJSON();
        break;
      default:
        content = renderPieces();
    }
    tabPanel.replaceChildren(content);
  }

  // =========================================================================
  // Peças
  // =========================================================================

  function renderPieces() {
    const r = E.rules;
    if (E.pieceIdx >= r.pieces.length) E.pieceIdx = Math.max(0, r.pieces.length - 1);
    const list = h('div', { class: 'pc-list', role: 'listbox', 'aria-label': 'Peças' });
    r.pieces.forEach((p, i) => {
      const b = h('button', {
        type: 'button',
        role: 'option',
        'aria-selected': i === E.pieceIdx ? 'true' : 'false',
        class: `pc-chip ${i === E.pieceIdx ? 'on' : ''}`,
        onclick: () => {
          E.pieceIdx = i;
          E.setIdx = 0;
          renderTab();
        },
      });
      b.innerHTML = `<span class="pc-chip-ic">${pieceSVG(p.icon, 0, p.id)}</span><span class="pc-chip-n">${escapeHtml(p.name)}</span><span class="pc-chip-l">${p.id}</span>`;
      list.appendChild(b);
    });
    list.appendChild(btn('Nova peça', { kind: 'ghost', icon: 'plus', small: true, onClick: addPiece }));

    const p = r.pieces[E.pieceIdx];
    const body = p ? pieceEditor(p) : h('p', { class: 'muted' }, 'Crie a primeira peça.');
    return h('div', { class: 'pc-tab' }, list, body);
  }

  function addPiece() {
    const r = E.rules;
    if (r.pieces.length >= 26) {
      toast('Use no máximo 26 peças diferentes.');
      return;
    }
    const id = freeLetter(r, 'N');
    r.pieces.push({ id, name: 'Nova peça', icon: 'letter', value: null, royal: false, pawn: false, castling: false, castleRook: false, promotion: null, moves: [{ when: 'always', steps: MOVE_TEMPLATES.king.steps() }] });
    E.pieceIdx = r.pieces.length - 1;
    E.setIdx = 0;
    commit();
    toast(`Peça criada com a letra ${id}. Desenhe os movimentos na grade e coloque-a na posição inicial.`, { timeout: 5000 });
  }

  function pieceEditor(p) {
    const r = E.rules;
    const { width: W, height: H } = r.board;

    // --- identidade
    const iconBtn = h('button', { type: 'button', class: 'pc-iconbtn', 'aria-label': `Desenho da peça: ${ICONS[p.icon] ? ICONS[p.icon].label : 'Letra'}. Trocar`, onclick: () => pickIcon(p) });
    iconBtn.innerHTML = `${pieceSVG(p.icon, 0, p.id)}${pieceSVG(p.icon, 1, p.id)}<span>Trocar desenho</span>`;

    const nameIn = h('input', { class: 'inp', id: 'pc-name', value: p.name, maxlength: 30 });
    nameIn.addEventListener('input', () => {
      p.name = nameIn.value || 'Peça';
      commit({ rerender: false });
      const chip = tabPanel.querySelector('.pc-chip.on .pc-chip-n');
      if (chip) chip.textContent = p.name;
    });
    nameIn.addEventListener('change', () => renderTab());

    const letterIn = h('input', { class: 'inp inp-letter', id: 'pc-letter', value: p.id, maxlength: 1, autocapitalize: 'characters', spellcheck: 'false' });
    letterIn.addEventListener('change', () => {
      const v = letterIn.value.toUpperCase().normalize('NFD').replace(/[^A-Z]/g, '');
      if (!v || v === p.id) {
        letterIn.value = p.id;
        return;
      }
      if (r.pieces.some((q) => q !== p && q.id === v)) {
        toast(`A letra ${v} já é usada por ${nameOf(r, v)}.`, { kind: 'warn' });
        letterIn.value = p.id;
        return;
      }
      renamePieceId(r, p.id, v);
      commit();
    });

    const auto = p.value === null;
    const autoVal = pieceAutoValue(p, W, H);
    const valIn = h('input', { class: 'inp inp-num', id: 'pc-value', type: 'number', min: 0, max: 20000, step: 10, value: auto ? autoVal : p.value, disabled: auto });
    valIn.addEventListener('change', () => {
      p.value = Math.max(0, Math.min(20000, Math.round(Number(valIn.value) || 0)));
      commit({ rerender: false });
    });
    const autoIn = h('input', { type: 'checkbox', id: 'pc-auto' });
    autoIn.checked = auto;
    autoIn.addEventListener('change', () => {
      p.value = autoIn.checked ? null : autoVal;
      commit();
    });

    const ident = h(
      'div',
      { class: 'pc-ident' },
      iconBtn,
      h('div', { class: 'field' }, h('label', { for: 'pc-name' }, 'Nome'), nameIn),
      h('div', { class: 'field field-xs' }, h('label', { for: 'pc-letter' }, 'Letra'), letterIn),
      h(
        'div',
        { class: 'field field-sm' },
        h('label', { for: 'pc-value' }, 'Valor para o robô'),
        valIn,
        h('label', { class: 'mini-check', for: 'pc-auto' }, autoIn, h('span', null, 'Calcular sozinho')),
      ),
    );

    // --- movimentos
    if (E.setIdx >= p.moves.length) E.setIdx = 0;
    const set = p.moves[E.setIdx];
    const setTabs = h('div', { class: 'set-tabs', role: 'tablist', 'aria-label': 'Grupos de movimentos' });
    p.moves.forEach((s, i) => {
      const b = h('button', {
        type: 'button',
        role: 'tab',
        'aria-selected': i === E.setIdx ? 'true' : 'false',
        class: `set-tab ${i === E.setIdx ? 'on' : ''} ${s.when !== 'always' ? 'cond' : ''}`,
        onclick: () => {
          E.setIdx = i;
          renderTab();
        },
      });
      b.textContent = setLabel(r, s);
      setTabs.appendChild(b);
    });
    setTabs.appendChild(
      btn('Movimento sob condição', {
        kind: 'ghost',
        icon: 'plus',
        small: true,
        title: 'Movimentos que só valem em certas situações',
        onClick: () => {
          p.moves.push({ when: 'enemyHalf', steps: [] });
          E.setIdx = p.moves.length - 1;
          commit();
        },
      }),
    );

    const ghost = set.when === 'always' ? [] : p.moves.filter((s) => s.when === 'always').flatMap((s) => s.steps);
    const diagram = moveDiagram({
      steps: set.steps,
      ghost,
      piece: p,
      size: 'lg',
      label: `Movimentos de ${p.name}`,
      onCell: (dx, dy) => {
        set.steps = applyTool(set.steps, dx, dy, toolState);
        commit();
      },
    });

    const tpl = h('div', { class: 'tpl' }, h('span', { class: 'mg-tool-lb' }, 'Somar movimentos prontos'));
    Object.values(MOVE_TEMPLATES).forEach((t) => {
      tpl.appendChild(
        btn(`+ ${t.label}`, {
          kind: 'chip',
          small: true,
          onClick: () => {
            const add = t.steps();
            const key = (s) => `${s.kind}:${s.dx},${s.dy}`;
            const have = new Set(set.steps.map(key));
            set.steps = [...set.steps.filter((s) => !add.some((a) => key(a) === key(s))), ...add];
            if (add.every((a) => have.has(key(a)))) toast('Esses movimentos já estavam lá.');
            commit();
          },
        }),
      );
    });
    tpl.appendChild(
      btn('Igual ao Peão', {
        kind: 'chip',
        small: true,
        title: 'Anda uma casa para frente, duas no primeiro lance e captura na diagonal',
        onClick: async () => {
          if (p.moves.some((s) => s.steps.length) && !(await confirmDialog({ title: 'Usar movimentos do Peão?', text: `Os movimentos atuais de ${p.name} serão trocados pelos do Peão.`, ok: 'Trocar' }))) return;
          p.moves = pawnMoves();
          E.setIdx = 0;
          commit();
        },
      }),
    );
    tpl.appendChild(
      btn('Limpar este grupo', {
        kind: 'chip',
        small: true,
        onClick: () => {
          set.steps = [];
          commit();
        },
      }),
    );

    // salto em L com medidas escolhidas
    const lA = select([1, 2, 3, 4].map((n) => ({ value: n, label: `${n} ${n === 1 ? 'casa' : 'casas'}` })), E.lA || 3, (v) => (E.lA = parseInt(v, 10)), { class: 'sel sel-sm', 'aria-label': 'Anda quantas casas' });
    const lB = select([0, 1, 2, 3, 4].map((n) => ({ value: n, label: n ? `${n} para o lado` : 'nenhuma para o lado' })), E.lB === undefined ? 1 : E.lB, (v) => (E.lB = parseInt(v, 10)), { class: 'sel sel-sm', 'aria-label': 'Vira quantas casas' });
    const addL = (asRide) => {
      const a = E.lA || 3;
      const b = E.lB === undefined ? 1 : E.lB;
      const dirs = lShape(Math.max(a, b), Math.min(a, b));
      const add = asRide ? ride(dirs, 0, toolState.mode) : leap(dirs, toolState.mode);
      const key = (st) => `${st.kind}:${st.dx},${st.dy}`;
      set.steps = [...set.steps.filter((st) => !add.some((x) => key(x) === key(st))), ...add];
      commit();
    };
    const customL = h(
      'div',
      { class: 'tpl tpl-l' },
      h('span', { class: 'mg-tool-lb' }, 'Salto em L sob medida (como o Camelo, que anda 3 e vira 1)'),
      h('span', null, 'Anda'),
      lA,
      h('span', null, 'e vira'),
      lB,
      btn('Somar salto', { kind: 'chip', small: true, onClick: () => addL(false) }),
      btn('Somar em linha', { kind: 'chip', small: true, title: 'Repete o mesmo L várias vezes na mesma direção', onClick: () => addL(true) }),
    );

    const tools = toolPanel(() => {});
    const condBox = set.when !== 'always' ? conditionEditor(p, set) : null;

    const steps = h('details', { class: 'steps-box' }, h('summary', null, `Lista de movimentos deste grupo (${set.steps.length})`));
    steps.appendChild(
      stepList(set.steps, (next) => {
        set.steps = next;
        commit();
      }),
    );
    steps.addEventListener('toggle', () => (E.stepsOpen = steps.open));
    steps.open = !!E.stepsOpen;

    const summary = h('p', { class: 'mg-sum' }, `Resumo: ${stepsSummary(set.steps)}.`);

    const moveBox = h(
      'section',
      { class: 'sheet mv-box', 'aria-label': 'Movimentos' },
      h('div', { class: 'mv-head' }, h('h3', { class: 'h-sec' }, 'Movimentos'), setTabs),
      condBox,
      h(
        'div',
        { class: 'mv-body' },
        h('div', { class: 'mv-grid-col' }, diagram, h('p', { class: 'mg-note', html: `${legendHTML()}` }), h('p', { class: 'mg-note' }, 'Para cima é para frente. As pretas usam o mesmo desenho virado.'), summary),
        h('div', { class: 'mv-tools-col' }, tools, tpl, customL),
      ),
      steps,
    );

    // --- características
    const traits = h('section', { class: 'sheet traits', 'aria-label': 'Características' }, h('h3', { class: 'h-sec' }, 'Características'));
    traits.appendChild(
      toggle('É o Rei', p.royal, (v) => {
        p.royal = v;
        if (v && !r.pieces.some((q) => q !== p && q.castling)) p.castling = p.castling || false;
        commit();
      }, 'Se levar xeque-mate (ou for capturado, conforme a forma de vencer), o jogador perde.'),
    );
    traits.appendChild(
      toggle('Faz roque', p.castling, (v) => {
        p.castling = v;
        commit();
      }, 'Anda duas casas na direção de uma peça de roque que ainda não se moveu, e ela pula para o outro lado.'),
    );
    traits.appendChild(
      toggle('É peça de roque (como a Torre)', p.castleRook, (v) => {
        p.castleRook = v;
        commit();
      }),
    );
    traits.appendChild(
      toggle('Segue a regra do en passant', p.pawn, (v) => {
        p.pawn = v;
        commit();
      }, 'Ao andar duas casas em linha reta, pode ser capturada en passant. Também pode capturar assim.'),
    );

    const promoOn = !!(p.promotion && p.promotion.to.length);
    traits.appendChild(
      toggle('Promove no fim do tabuleiro', promoOn, (v) => {
        p.promotion = v ? { to: r.pieces.filter((q) => q !== p && !q.royal).slice(0, 4).map((q) => q.id), zone: 1 } : null;
        if (v && !p.promotion.to.length) p.promotion = null;
        commit();
      }),
    );
    if (promoOn) {
      const box = h('div', { class: 'promo-box' }, h('p', { class: 'muted' }, 'Pode virar:'));
      const choices = h('div', { class: 'promo-choices' });
      r.pieces
        .filter((q) => q !== p)
        .forEach((q) => {
          const id = `promo-${q.id}`;
          const inp = h('input', { type: 'checkbox', id });
          inp.checked = p.promotion.to.includes(q.id);
          inp.addEventListener('change', () => {
            const set2 = new Set(p.promotion.to);
            if (inp.checked) set2.add(q.id);
            else set2.delete(q.id);
            p.promotion.to = r.pieces.map((x) => x.id).filter((x) => set2.has(x));
            if (!p.promotion.to.length) p.promotion = null;
            commit();
          });
          choices.appendChild(h('label', { class: 'promo-opt', for: id }, inp, h('span', { class: 'pick-ic', html: pieceSVG(q.icon, 0, q.id) }), h('span', null, q.name)));
        });
      box.appendChild(choices);
      box.appendChild(
        h(
          'div',
          { class: 'field-inline' },
          h('label', { for: 'promo-zone' }, 'Onde promove'),
          select(
            [
              { value: 1, label: 'Na última fileira' },
              { value: 2, label: 'Nas 2 últimas fileiras' },
              { value: 3, label: 'Nas 3 últimas fileiras' },
            ],
            p.promotion.zone,
            (v) => {
              p.promotion.zone = parseInt(v, 10);
              commit();
            },
            { id: 'promo-zone' },
          ),
        ),
      );
      traits.appendChild(box);
    }

    const foot = h(
      'div',
      { class: 'pc-foot' },
      btn('Duplicar peça', {
        kind: 'ghost',
        icon: 'copy',
        small: true,
        onClick: () => {
          if (r.pieces.length >= 26) return toast('Use no máximo 26 peças diferentes.');
          const c = clone(p);
          c.id = freeLetter(r, p.name);
          c.name = `${p.name} 2`;
          c.royal = false;
          r.pieces.splice(E.pieceIdx + 1, 0, c);
          E.pieceIdx++;
          commit();
        },
      }),
      btn('Excluir peça', {
        kind: 'danger-ghost',
        icon: 'trash',
        small: true,
        onClick: async () => {
          if (!(await confirmDialog({ title: `Excluir ${p.name}?`, text: 'A peça também sai da posição inicial, das promoções e das regras especiais.', ok: 'Excluir', danger: true }))) return;
          removePieceId(r, p.id);
          E.pieceIdx = Math.max(0, E.pieceIdx - 1);
          commit();
        },
      }),
    );

    return h('div', { class: 'pc-edit' }, h('section', { class: 'sheet' }, ident), moveBox, traits, foot);
  }

  function conditionEditor(p, set) {
    const r = E.rules;
    const box = h('div', { class: 'cond-box' });
    const whenSel = select(WHEN_OPTIONS, set.when, (v) => {
      set.when = v;
      if ((v === 'hasTag' || v === 'noTag') && !set.tag) set.tag = 'marca';
      if (v === 'minRank' && !set.rank) set.rank = Math.ceil(r.board.height / 2) + 1;
      if (v === 'nearFriend' && set.piece === undefined) set.piece = '';
      commit();
    }, { id: 'set-when', 'aria-label': 'Quando vale' });
    const row = h('div', { class: 'cond-row' }, h('label', { for: 'set-when' }, 'Este grupo vale'), whenSel);
    if (set.when === 'hasTag' || set.when === 'noTag') {
      const tagIn = h('input', { class: 'inp inp-tag', value: set.tag || '', maxlength: 24, 'aria-label': 'Nome da marca' });
      tagIn.addEventListener('change', () => {
        set.tag = tagIn.value.trim().toLowerCase() || 'marca';
        commit();
      });
      row.append(h('span', null, 'marca'), tagIn);
    }
    if (set.when === 'minRank') {
      row.append(
        select(
          Array.from({ length: r.board.height }, (_, i) => ({ value: i + 1, label: `fileira ${i + 1}` })),
          set.rank,
          (v) => {
            set.rank = parseInt(v, 10);
            commit();
          },
          { 'aria-label': 'Fileira' },
        ),
      );
    }
    if (set.when === 'nearFriend') {
      row.append(
        select([{ value: '', label: 'qualquer peça' }, ...r.pieces.map((q) => ({ value: q.id, label: q.name }))], set.piece || '', (v) => {
          set.piece = v;
          commit();
        }, { 'aria-label': 'Peça aliada' }),
      );
    }
    box.append(
      row,
      toggle('Substitui os movimentos de sempre', !!set.replace, (v) => {
        set.replace = v;
        commit();
      }, set.replace ? 'Quando a condição vale, a peça anda só como este grupo.' : 'Desligado: estes movimentos se somam aos de sempre.'),
      btn('Excluir este grupo', {
        kind: 'danger-ghost',
        icon: 'trash',
        small: true,
        onClick: () => {
          p.moves.splice(E.setIdx, 1);
          E.setIdx = 0;
          commit();
        },
      }),
    );
    return box;
  }

  function pickIcon(p) {
    const body = h('div', { class: 'icon-groups' });
    let dlg;
    ICON_GROUPS.forEach((g) => {
      const grid = h('div', { class: 'icon-grid' });
      body.append(h('h3', { class: 'h-sec icon-group-h' }, g.label), grid);
      ICON_KEYS.filter((k) => iconGroup(k) === g.id).forEach((k) => addOpt(grid, k));
    });
    function addOpt(grid, k) {
      const b = h('button', {
        type: 'button',
        class: `icon-opt ${p.icon === k ? 'on' : ''}`,
        'aria-label': ICONS[k].label,
        onclick: () => {
          p.icon = k;
          dlg.close();
          commit();
        },
      });
      b.innerHTML = `<span class="io-pcs">${pieceSVG(k, 0, p.id)}${pieceSVG(k, 1, p.id)}</span><span>${ICONS[k].label}</span>`;
      grid.appendChild(b);
    }
    dlg = modal({ title: `Desenho de ${p.name}`, body, wide: true });
  }

  // =========================================================================
  // Regras especiais
  // =========================================================================

  function pieceOptions() {
    return E.rules.pieces.map((q) => ({ value: q.id, label: q.name, html: pieceSVG(q.icon, 0, q.id) }));
  }

  function renderTriggers() {
    const r = E.rules;
    const wrap = h('div', { class: 'trg-tab' });
    wrap.appendChild(
      h(
        'div',
        { class: 'sheet trg-intro' },
        h('p', null, 'Uma regra especial diz o que acontece depois de um lance. Por exemplo: quando uma peça captura, ela vira a peça capturada.'),
        h(
          'div',
          { class: 'tpl' },
          h('span', { class: 'mg-tool-lb' }, 'Começar de um exemplo'),
          ...TRIGGER_EXAMPLES.map((ex) =>
            btn(ex.label, {
              kind: 'chip',
              small: true,
              title: ex.hint,
              onClick: () => {
                const royal = r.pieces.filter((q) => q.royal).map((q) => q.id);
                const pawn = r.pieces.find((q) => q.pawn);
                const strongest = r.pieces.filter((q) => !q.royal).sort((a, b) => (b.value || 0) - (a.value || 0))[0];
                const ids = { nonRoyal: royal.length ? r.pieces.filter((q) => !q.royal).map((q) => q.id) : [], pawn: pawn && pawn.id, strongest: strongest && strongest.id, any: r.pieces[0] && r.pieces[0].id };
                r.triggers.push(normalizeRules({ ...r, triggers: [ex.make(ids)] }).triggers[0]);
                commit();
                toast(`Regra "${ex.label}" adicionada no fim da lista.`);
              },
            }),
          ),
        ),
      ),
    );
    if (!r.triggers.length) wrap.appendChild(h('p', { class: 'empty-note' }, 'Nenhuma regra especial ainda. Use um exemplo acima ou crie uma do zero.'));
    r.triggers.forEach((t, i) => wrap.appendChild(triggerCard(t, i)));
    wrap.appendChild(
      btn('Nova regra especial', {
        kind: 'ghost',
        icon: 'plus',
        onClick: () => {
          r.triggers.push({ event: 'capture', pieces: [], targets: [], conditions: [], effects: [{ type: 'becomeCaptured' }], enabled: true });
          commit();
        },
      }),
    );
    return wrap;
  }

  function triggerCard(t, i) {
    const r = E.rules;
    const preview = h('p', { class: 'rule-text' }, triggerSentence(r, t));
    const soft = () => {
      commit({ rerender: false });
      preview.textContent = triggerSentence(r, t);
    };

    const head = h(
      'div',
      { class: 'rc-head' },
      h('h3', { class: 'h-sec' }, `Regra especial ${i + 1}`),
      toggle('Ativa', t.enabled, (v) => {
        t.enabled = v;
        commit();
      }),
      h(
        'div',
        { class: 'rc-tools' },
        iconButton('copy', 'Duplicar regra', () => {
          r.triggers.splice(i + 1, 0, clone(t));
          commit();
        }),
        iconButton('trash', 'Excluir regra', async () => {
          if (!(await confirmDialog({ title: 'Excluir esta regra especial?', text: triggerSentence(r, t), ok: 'Excluir', danger: true }))) return;
          r.triggers.splice(i, 1);
          commit();
        }),
      ),
    );

    // Quando ...
    const when = h(
      'div',
      { class: 'rc-row' },
      h('span', { class: 'rc-kw' }, 'Quando'),
      multiPick({
        options: pieceOptions(),
        value: t.pieces,
        label: 'Qual peça',
        onChange: (v) => {
          t.pieces = v;
          soft();
        },
      }),
      select(EVENT_OPTIONS, t.event, (v) => {
        t.event = v;
        if (v !== 'capture') {
          t.targets = [];
          t.effects = t.effects.filter((e) => e.type !== 'becomeCaptured' && e.type !== 'recruit');
        }
        commit();
      }, { 'aria-label': 'O que acontece' }),
    );
    if (t.event === 'capture') {
      when.appendChild(
        multiPick({
          options: pieceOptions(),
          value: t.targets,
          label: 'Qual peça é capturada',
          onChange: (v) => {
            t.targets = v;
            soft();
          },
        }),
      );
    }

    // e se ...
    const conds = h('div', { class: 'rc-row rc-list' }, h('span', { class: 'rc-kw' }, 'e se'));
    t.conditions.forEach((c, ci) => {
      const chip = h('span', { class: 'rc-chip' }, h('span', null, (COND_OPTIONS.find((o) => o.value === c.type) || {}).label || c.type));
      if (c.type === 'hasTag' || c.type === 'noTag') {
        const inp = h('input', { class: 'inp inp-tag', value: c.tag || '', maxlength: 24, 'aria-label': 'Nome da marca' });
        inp.addEventListener('input', () => {
          c.tag = inp.value.trim().toLowerCase() || 'marca';
          soft();
        });
        chip.appendChild(inp);
      }
      if (c.type === 'minRank') {
        chip.appendChild(
          select(Array.from({ length: r.board.height }, (_, k) => ({ value: k + 1, label: `fileira ${k + 1}` })), c.rank, (v) => {
            c.rank = parseInt(v, 10);
            soft();
          }, { class: 'sel sel-sm', 'aria-label': 'Fileira' }),
        );
      }
      chip.appendChild(
        iconButton('close', 'Tirar condição', () => {
          t.conditions.splice(ci, 1);
          commit();
        }),
      );
      conds.appendChild(chip);
    });
    const avail = COND_OPTIONS.filter((o) => (t.event === 'capture' || (o.value !== 'targetStronger' && o.value !== 'targetWeaker')) && !t.conditions.some((c) => c.type === o.value));
    conds.appendChild(
      addSelect('+ condição', avail, (v) => {
        const c = { type: v };
        if (v === 'hasTag' || v === 'noTag') c.tag = 'marca';
        if (v === 'minRank') c.rank = r.board.height;
        t.conditions.push(c);
        commit();
      }),
    );
    if (!t.conditions.length) conds.appendChild(h('span', { class: 'muted rc-none' }, 'sempre'));

    // então ...
    const effs = h('div', { class: 'rc-effects' }, h('span', { class: 'rc-kw' }, 'então'));
    t.effects.forEach((e, ei) => effs.appendChild(effectRow(t, e, ei, soft)));
    const effAvail = EFFECT_OPTIONS.filter((o) => t.event === 'capture' || (o.value !== 'becomeCaptured' && o.value !== 'recruit'));
    effs.appendChild(
      addSelect('+ efeito', effAvail, (v) => {
        const e = { type: v };
        if (v === 'become' || v === 'leaveBehind') e.piece = (r.pieces.find((q) => !q.royal) || r.pieces[0]).id;
        if (v === 'extraMove') Object.assign(e, { same: true, capture: 'any', optional: true });
        if (v === 'explode') Object.assign(e, { radius: 1, self: true, sparePawns: true, spareRoyal: false });
        if (v === 'addTag' || v === 'removeTag') e.tag = 'marca';
        t.effects.push(e);
        commit();
      }),
    );

    return h('article', { class: `sheet rule-card ${t.enabled ? '' : 'off'}` }, head, when, conds, effs, preview);
  }

  function effectRow(t, e, ei, soft) {
    const r = E.rules;
    const row = h('div', { class: 'eff' }, h('span', { class: 'eff-t' }, (EFFECT_OPTIONS.find((o) => o.value === e.type) || {}).label || e.type));
    const pieceSel = (key) =>
      select(r.pieces.map((q) => ({ value: q.id, label: q.name })), e[key], (v) => {
        e[key] = v;
        soft();
      }, { class: 'sel sel-sm', 'aria-label': 'Peça' });
    if (e.type === 'become' || e.type === 'leaveBehind') row.appendChild(pieceSel('piece'));
    if (e.type === 'become' || e.type === 'becomeCaptured') {
      const turnsSel = select(
        Array.from({ length: 10 }, (_, k) => ({ value: k + 1, label: `${k + 1} ${k ? 'lances' : 'lance'}` })),
        e.turns || 2,
        (v) => {
          e.turns = parseInt(v, 10);
          soft();
        },
        { class: 'sel sel-sm', 'aria-label': 'Quantos lances' },
      );
      turnsSel.hidden = e.back !== 'turns';
      row.append(
        select(BACK_OPTIONS, e.back || 'never', (v) => {
          if (v === 'never') delete e.back;
          else e.back = v;
          if (v === 'turns' && !e.turns) e.turns = 2;
          if (v !== 'turns') delete e.turns;
          turnsSel.hidden = v !== 'turns';
          soft();
        }, { class: 'sel sel-sm', 'aria-label': 'Quando volta ao normal' }),
        turnsSel,
      );
    }
    if (e.type === 'extraMove') {
      row.append(
        select(
          [
            { value: 'same', label: 'com a mesma peça' },
            { value: 'any', label: 'com qualquer peça' },
          ],
          e.same ? 'same' : 'any',
          (v) => {
            e.same = v === 'same';
            soft();
          },
          { class: 'sel sel-sm', 'aria-label': 'Qual peça joga' },
        ),
        select(
          [
            { value: 'any', label: 'pode capturar' },
            { value: 'only', label: 'só capturando' },
            { value: 'none', label: 'sem capturar' },
          ],
          e.capture,
          (v) => {
            e.capture = v;
            soft();
          },
          { class: 'sel sel-sm', 'aria-label': 'Captura no lance extra' },
        ),
        miniCheck('pode passar a vez', e.optional, (v) => {
          e.optional = v;
          soft();
        }),
      );
    }
    if (e.type === 'explode') {
      row.append(
        select(
          [
            { value: 1, label: 'vizinhas (1 casa)' },
            { value: 2, label: 'até 2 casas' },
          ],
          e.radius,
          (v) => {
            e.radius = parseInt(v, 10);
            soft();
          },
          { class: 'sel sel-sm', 'aria-label': 'Alcance' },
        ),
        select(
          [
            { value: 'all', label: 'peças dos dois lados' },
            { value: 'enemy', label: 'só peças do adversário' },
            { value: 'own', label: 'só as suas peças' },
          ],
          e.targets || 'all',
          (v) => {
            if (v === 'all') delete e.targets;
            else e.targets = v;
            soft();
          },
          { class: 'sel sel-sm', 'aria-label': 'Quem explode' },
        ),
        miniCheck('a própria peça também', e.self, (v) => {
          e.self = v;
          soft();
        }),
        miniCheck('poupa peões', e.sparePawns, (v) => {
          e.sparePawns = v;
          soft();
        }),
        miniCheck('poupa o Rei', e.spareRoyal, (v) => {
          e.spareRoyal = v;
          soft();
        }),
      );
    }
    if (e.type === 'addTag' || e.type === 'removeTag') {
      const inp = h('input', { class: 'inp inp-tag', value: e.tag || '', maxlength: 24, 'aria-label': 'Nome da marca' });
      inp.addEventListener('input', () => {
        e.tag = inp.value.trim().toLowerCase() || 'marca';
        soft();
      });
      row.appendChild(inp);
    }
    const tools = h('span', { class: 'eff-tools' });
    if (ei > 0)
      tools.appendChild(
        iconButton('upload', 'Subir', () => {
          t.effects.splice(ei - 1, 0, t.effects.splice(ei, 1)[0]);
          commit();
        }),
      );
    tools.appendChild(
      iconButton('close', 'Tirar efeito', () => {
        t.effects.splice(ei, 1);
        commit();
      }),
    );
    row.appendChild(tools);
    return row;
  }

  // =========================================================================
  // Posição inicial
  // =========================================================================

  function renderSetup() {
    const r = E.rules;
    const { width: W, height: H } = r.board;
    let cells = setupToCells(r.setup, W, H);
    if (!E.brush || (E.brush.id && !r.pieces.some((p) => p.id === E.brush.id))) E.brush = r.pieces[0] ? { id: r.pieces[0].id, color: 0 } : { erase: true };

    const sizeRow = h(
      'div',
      { class: 'size-row' },
      h('span', { class: 'mg-tool-lb' }, 'Tamanho do tabuleiro'),
      select(rangeOpts(MIN_SIZE, MAX_SIZE, 'colunas'), W, (v) => {
        resizeBoard(r, parseInt(v, 10), H);
        commit();
      }, { 'aria-label': 'Colunas' }),
      h('span', null, '×'),
      select(rangeOpts(MIN_SIZE, MAX_SIZE, 'fileiras'), H, (v) => {
        resizeBoard(r, W, parseInt(v, 10));
        commit();
      }, { 'aria-label': 'Fileiras' }),
    );

    const palette = h('div', { class: 'palette', role: 'toolbar', 'aria-label': 'Peças para colocar' });
    const paintBtn = (brush, html, label) => {
      const on = brush.erase ? !!E.brush.erase : E.brush.id === brush.id && E.brush.color === brush.color;
      const b = h('button', { type: 'button', class: `pal ${on ? 'on' : ''}`, 'aria-pressed': on ? 'true' : 'false', 'aria-label': label, title: label });
      b.innerHTML = html;
      b.addEventListener('click', () => {
        E.brush = brush;
        palette.querySelectorAll('.pal').forEach((x) => {
          x.classList.remove('on');
          x.setAttribute('aria-pressed', 'false');
        });
        b.classList.add('on');
        b.setAttribute('aria-pressed', 'true');
      });
      return b;
    };
    [0, 1].forEach((color) => {
      const row = h('div', { class: 'pal-row' }, h('span', { class: 'pal-lb' }, color ? 'Pretas' : 'Brancas'));
      r.pieces.forEach((p) => row.appendChild(paintBtn({ id: p.id, color }, pieceSVG(p.icon, color, p.id), `${p.name} ${color ? 'preta' : 'branca'}`)));
      palette.appendChild(row);
    });
    palette.appendChild(h('div', { class: 'pal-row' }, paintBtn({ erase: true }, icon('eraser'), 'Apagar casas')));

    const board = createBoard({ paint: true, label: 'Posição inicial' });
    board.setSize(W, H);
    const draw = () => {
      const list = [];
      cells.forEach((c, sq) => {
        if (!c) return;
        const p = r.pieces.find((x) => x.id === c.id);
        if (p) list.push({ sq, key: `${p.icon}|${c.color}|${p.id}`, html: pieceSVG(p.icon, c.color, p.id) });
      });
      board.setPieces(list);
      const goal = r.victory.goal && r.victory.goal.mode === 'squares' ? r.victory.goal.squares.map((s) => parseSquare(s, W, H)) : [];
      board.setMarks({ goal });
    };
    draw();
    let action = null;
    board.onPaint = (sq, phase) => {
      if (phase === 'down') {
        const c = cells[sq];
        if (E.brush.erase) action = 'erase';
        else action = c && c.id === E.brush.id && c.color === E.brush.color ? 'erase' : 'place';
      }
      if (phase === 'up') {
        r.setup = cellsToSetup(cells, W, H);
        commit({ rerender: false });
        countLine.textContent = countText(cells);
        return;
      }
      if (action === 'erase') cells[sq] = null;
      else if (action === 'place') cells[sq] = { id: E.brush.id, color: E.brush.color };
      draw();
    };

    const mirror = (fromColor) => {
      cells = cells.map((c) => (c && c.color !== fromColor ? null : c));
      const next = cells.slice();
      for (let sq = 0; sq < W * H; sq++) {
        const c = cells[sq];
        if (c && c.color === fromColor) {
          const x = sq % W;
          const y = Math.floor(sq / W);
          const t = (H - 1 - y) * W + x;
          if (!next[t]) next[t] = { id: c.id, color: 1 - fromColor };
        }
      }
      cells = next;
      r.setup = cellsToSetup(cells, W, H);
      commit();
    };

    const countLine = h('p', { class: 'muted' }, countText(cells));
    const buttons = h(
      'div',
      { class: 'setup-btns' },
      btn('Copiar brancas para as pretas', { kind: 'ghost', small: true, icon: 'swap', title: 'Coloca as pretas como espelho das brancas', onClick: () => mirror(0) }),
      btn('Copiar pretas para as brancas', { kind: 'ghost', small: true, icon: 'swap', onClick: () => mirror(1) }),
      btn('Esvaziar tabuleiro', {
        kind: 'ghost',
        small: true,
        icon: 'eraser',
        onClick: async () => {
          if (!(await confirmDialog({ title: 'Esvaziar o tabuleiro?', text: 'Todas as peças saem da posição inicial.', ok: 'Esvaziar' }))) return;
          r.setup = cellsToSetup(new Array(W * H).fill(null), W, H);
          commit();
        },
      }),
    );

    return h(
      'div',
      { class: 'setup-tab' },
      h('div', { class: 'setup-board' }, h('div', { class: 'board-frame' }, board.el), countLine),
      h('div', { class: 'sheet setup-side' }, sizeRow, h('p', { class: 'muted' }, 'Escolha uma peça e toque nas casas. Tocar de novo na mesma peça tira ela. Dá para arrastar para preencher várias casas.'), palette, buttons),
    );
  }

  function countText(cells) {
    const w = cells.filter((c) => c && c.color === 0).length;
    const b = cells.filter((c) => c && c.color === 1).length;
    return `Brancas com ${w} ${w === 1 ? 'peça' : 'peças'}, pretas com ${b}.`;
  }

  // =========================================================================
  // Vitória e opções
  // =========================================================================

  function renderVictory() {
    const r = E.rules;
    const v = r.victory;
    const o = r.options;
    const wrap = h('div', { class: 'vic-tab' });

    const royal = h(
      'section',
      { class: 'sheet' },
      h('h3', { class: 'h-sec' }, 'Como se vence'),
      segmented(
        [
          { value: 'checkmate', label: 'Xeque-mate' },
          { value: 'capture', label: 'Capturar o Rei' },
          { value: 'none', label: 'Sem Rei' },
        ],
        v.royal,
        (val) => {
          v.royal = val;
          commit();
        },
        { label: 'Forma de vencer' },
      ),
      h(
        'p',
        { class: 'muted' },
        v.royal === 'checkmate'
          ? 'O Rei nunca pode ficar em xeque. Vence quem der xeque-mate.'
          : v.royal === 'capture'
            ? 'Pode deixar o Rei em xeque, mas quem capturar o Rei vence.'
            : 'Nenhuma peça é especial. Use as regras abaixo para decidir quem vence.',
      ),
    );
    wrap.appendChild(royal);

    // objetivo
    const goalMode = v.goal ? v.goal.mode : 'none';
    const goal = h(
      'section',
      { class: 'sheet' },
      h('h3', { class: 'h-sec' }, 'Objetivo extra'),
      h(
        'div',
        { class: 'field-inline' },
        h('label', { for: 'goal-mode' }, 'Também vence quem'),
        select(
          [
            { value: 'none', label: 'não há objetivo extra' },
            { value: 'squares', label: 'chega a casas marcadas' },
            { value: 'lastRank', label: 'chega à última fileira' },
          ],
          goalMode,
          (val) => {
            if (val === 'none') v.goal = null;
            else {
              const royalIds = r.pieces.filter((p) => p.royal).map((p) => p.id);
              v.goal = { mode: val, pieces: v.goal ? v.goal.pieces : royalIds, squares: v.goal ? v.goal.squares : [] };
            }
            commit();
          },
          { id: 'goal-mode' },
        ),
      ),
    );
    if (v.goal) {
      goal.appendChild(
        h(
          'div',
          { class: 'field-inline' },
          h('span', null, 'com'),
          multiPick({
            options: pieceOptions(),
            value: v.goal.pieces,
            label: 'Com qual peça',
            onChange: (val) => {
              v.goal.pieces = val;
              commit({ rerender: false });
            },
          }),
        ),
      );
      if (v.goal.mode === 'squares') {
        const { width: W, height: H } = r.board;
        const b = createBoard({ paint: true, label: 'Casas-objetivo' });
        b.setSize(W, H);
        const cells = setupToCells(r.setup, W, H);
        b.setPieces(
          cells
            .map((c, sq) => {
              if (!c) return null;
              const p = r.pieces.find((x) => x.id === c.id);
              return p ? { sq, key: `${p.icon}|${c.color}|${p.id}`, html: pieceSVG(p.icon, c.color, p.id) } : null;
            })
            .filter(Boolean),
        );
        const marks = () => b.setMarks({ goal: v.goal.squares.map((s) => parseSquare(s, W, H)) });
        marks();
        let adding = true;
        b.onPaint = (sq, phase) => {
          const name = squareName({ W }, sq);
          if (phase === 'down') adding = !v.goal.squares.includes(name);
          if (phase === 'up') {
            commit({ rerender: false });
            sqText.textContent = v.goal.squares.length ? `Casas marcadas: ${v.goal.squares.join(', ')}` : 'Nenhuma casa marcada ainda.';
            return;
          }
          const has = v.goal.squares.includes(name);
          if (adding && !has) v.goal.squares.push(name);
          if (!adding && has) v.goal.squares = v.goal.squares.filter((s) => s !== name);
          marks();
        };
        const sqText = h('p', { class: 'muted' }, v.goal.squares.length ? `Casas marcadas: ${v.goal.squares.join(', ')}` : 'Nenhuma casa marcada ainda.');
        goal.append(h('p', { class: 'muted' }, 'Toque nas casas para marcar ou desmarcar.'), h('div', { class: 'board-frame board-sm' }, b.el), sqText);
      }
    }
    wrap.appendChild(goal);

    const ends = h(
      'section',
      { class: 'sheet' },
      h('h3', { class: 'h-sec' }, 'Finais especiais'),
      h(
        'div',
        { class: 'field-inline' },
        h('label', { for: 'stale' }, 'Quem fica sem lances (afogamento)'),
        select(
          [
            { value: 'draw', label: 'empata' },
            { value: 'loss', label: 'perde' },
            { value: 'win', label: 'vence' },
          ],
          v.stalemate,
          (val) => {
            v.stalemate = val;
            commit({ rerender: false });
          },
          { id: 'stale' },
        ),
      ),
      h(
        'div',
        { class: 'field-inline' },
        h('label', { for: 'ext' }, 'Quem fica sem nenhuma peça'),
        select(
          [
            { value: 'off', label: 'não muda nada' },
            { value: 'loss', label: 'perde' },
            { value: 'win', label: 'vence' },
          ],
          v.extinction,
          (val) => {
            v.extinction = val;
            commit({ rerender: false });
          },
          { id: 'ext' },
        ),
      ),
    );
    wrap.appendChild(ends);

    const opts = h(
      'section',
      { class: 'sheet' },
      h('h3', { class: 'h-sec' }, 'Regras gerais'),
      toggle('Roque', o.castling, (val) => {
        o.castling = val;
        commit({ rerender: false });
      }, 'Vale para as peças marcadas com "Faz roque" e "É peça de roque".'),
      toggle('En passant', o.enPassant, (val) => {
        o.enPassant = val;
        commit({ rerender: false });
      }),
      toggle('Captura obrigatória', o.forcedCapture, (val) => {
        o.forcedCapture = val;
        commit({ rerender: false });
      }, 'Se der para capturar, o jogador precisa capturar.'),
      h(
        'div',
        { class: 'field-inline' },
        h('label', { for: 'fifty' }, 'Empate sem capturas nem lances de peão depois de'),
        select([{ value: 0, label: 'nunca' }, ...[25, 50, 75, 100].map((n) => ({ value: n, label: `${n} lances` }))], o.fiftyMove, (val) => {
          o.fiftyMove = parseInt(val, 10);
          commit({ rerender: false });
        }, { id: 'fifty' }),
      ),
      h(
        'div',
        { class: 'field-inline' },
        h('label', { for: 'rep' }, 'Empate quando a mesma posição aparece'),
        select([{ value: 0, label: 'nunca' }, ...[2, 3, 4, 5].map((n) => ({ value: n, label: `${n} vezes` }))], o.repetition, (val) => {
          o.repetition = parseInt(val, 10);
          commit({ rerender: false });
        }, { id: 'rep' }),
      ),
    );
    wrap.appendChild(opts);

    wrap.appendChild(h('section', { class: 'sheet rule-summary' }, h('h3', { class: 'h-sec' }, 'Resumo'), h('ul', { class: 'rule-lines' }, ...victoryLines(r).map((l) => h('li', null, l)))));
    return wrap;
  }

  // =========================================================================
  // Arquivo JSON
  // =========================================================================

  function renderJSON() {
    const ta = h('textarea', { class: 'json', spellcheck: 'false', 'aria-label': 'Regras em JSON', rows: 24 });
    ta.value = rulesToText(E.rules);
    const err = h('p', { class: 'json-err', role: 'alert' });
    return h(
      'div',
      { class: 'sheet json-tab' },
      h('p', { class: 'muted' }, 'Este é o conteúdo do arquivo que você baixa. Dá para editar aqui mesmo e aplicar.'),
      ta,
      err,
      h(
        'div',
        { class: 'setup-btns' },
        btn('Aplicar mudanças', {
          kind: 'primary',
          icon: 'check',
          onClick: () => {
            try {
              const { rules, problem } = parseRulesText(ta.value);
              E.rules = rules;
              commit();
              toast(problem ? `Aplicado, mas falta corrigir: ${problem}` : 'Mudanças aplicadas.', { kind: problem ? 'warn' : 'info' });
            } catch (e) {
              err.textContent = e.message;
            }
          },
        }),
        btn('Copiar texto', {
          kind: 'ghost',
          icon: 'copy',
          onClick: async () => toast((await copyText(ta.value)) ? 'Texto copiado.' : 'Não deu para copiar. Selecione o texto e copie manualmente.'),
        }),
        btn('Baixar arquivo', { kind: 'ghost', icon: 'download', onClick: () => app.download(E.uid) }),
        btn('Trocar por um arquivo…', {
          kind: 'ghost',
          icon: 'upload',
          onClick: () =>
            app.pickFile(async (file) => {
              try {
                const { rules, problem } = parseRulesText(await readFile(file));
                E.rules = rules;
                commit();
                toast(problem ? `Arquivo aberto, mas falta corrigir: ${problem}` : 'Arquivo aberto nesta variante.');
              } catch (e) {
                toast(e.message, { kind: 'warn' });
              }
            }),
        }),
      ),
    );
  }

  // --- auxiliares -----------------------------------------------------------

  function iconButton(name, label, onClick) {
    const b = h('button', { type: 'button', class: 'icon-btn', 'aria-label': label, title: label, onclick: onClick });
    b.innerHTML = icon(name);
    return b;
  }
  function addSelect(placeholder, options, onPick) {
    const s = h('select', { class: 'sel sel-add', 'aria-label': placeholder });
    s.appendChild(h('option', { value: '' }, placeholder));
    options.forEach((o) => s.appendChild(h('option', { value: o.value }, o.label)));
    s.addEventListener('change', () => {
      if (s.value) onPick(s.value);
    });
    return s;
  }
  function miniCheck(label, checked, onChange) {
    const id = `mc-${Math.random().toString(36).slice(2, 8)}`;
    const inp = h('input', { type: 'checkbox', id });
    inp.checked = !!checked;
    inp.addEventListener('change', () => onChange(inp.checked));
    return h('label', { class: 'mini-check', for: id }, inp, h('span', null, label));
  }
  function rangeOpts(a, b, unit) {
    const out = [];
    for (let i = a; i <= b; i++) out.push({ value: i, label: `${i} ${unit}` });
    return out;
  }

  return {
    el: root,
    open,
    current: () => (E ? E.uid : null),
    showEmpty: () => {
      E = null;
      renderEmpty();
    },
  };
}

// Menu simples (⋯)
export function menuButton(items) {
  const wrap = h('details', { class: 'menu' });
  const sum = h('summary', { class: 'btn btn-ghost', 'aria-label': 'Mais opções' });
  sum.innerHTML = icon('more') + '<span>Mais</span>';
  const list = h('div', { class: 'menu-list', role: 'menu' });
  items.filter(Boolean).forEach((it) => {
    const b = h('button', { type: 'button', role: 'menuitem', class: `menu-it ${it.danger ? 'danger' : ''}` });
    b.innerHTML = icon(it.icon) + `<span>${escapeHtml(it.label)}</span>`;
    b.addEventListener('click', () => {
      wrap.open = false;
      it.onClick();
    });
    list.appendChild(b);
  });
  wrap.append(sum, list);
  ensurePickListener();
  return wrap;
}
