// Tela de jogo: tabuleiro, lances, robô, dicas, desfazer e resumo das regras.
import { h, btn, modal, toast, sound, escapeHtml } from './ui.js';
import { compileRules, initialState, applyMove, gameStatus, moveText, mFrom, mTo, mPromo, mFlag, PASS, F_PASS, pType, pColor, RESULT_TEXT, isCapture, squareName } from './engine.js';
import { pieceSVG } from './pieces.js';
import { createBoard } from './board.js';
import { createAI } from './ai-client.js';
import { moveDiagram } from './movegrid.js';
import { triggerSentence, victoryLines, pieceLines, setLabel } from './describe.js';
import { savedGame, settings, hashString } from './store.js';

const LEVEL_TEXT = { easy: 'fácil', medium: 'médio', hard: 'difícil' };
const COLOR = ['brancas', 'pretas'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function createPlay(app) {
  const root = h('section', { class: 'view play', 'aria-label': 'Partida' });
  const ai = createAI();
  const board = createBoard({ label: 'Tabuleiro da partida' });
  let P = null;
  let ui = null;

  // ---------------------------------------------------------------------------
  // Início e restauração
  // ---------------------------------------------------------------------------

  function start({ source, rules, name, mode = 'ai', human = 0, level = 'medium', moves = [], sideTab }) {
    let G;
    try {
      G = compileRules(rules);
    } catch (e) {
      toast(`Estas regras ainda têm um problema: ${e.message}`, { kind: 'warn', timeout: 6000 });
      return false;
    }
    ai.cancel();
    const S0 = initialState(G);
    P = {
      source,
      name: name || rules.name,
      rules: G.rules,
      rulesKey: hashString(JSON.stringify(G.rules)),
      G,
      states: [S0],
      moves: [],
      texts: [],
      news: [],
      hist: [S0.hash],
      mode,
      human,
      level,
      flipped: mode === 'ai' && human === 1,
      status: gameStatus(G, S0, [S0.hash]),
      selected: -1,
      hint: null,
      thinking: false,
      token: 0,
      paused: false,
      over: false,
      result: null,
      overlayHidden: false,
      sideTab: sideTab || 'rules',
    };
    // refaz os lances de uma partida salva
    for (const m of moves) {
      if (!P.status.moves.includes(m)) break;
      pushMove(m, false);
      if (P.over) break;
    }
    build();
    persist();
    setTimeout(maybeAI, 400);
    return true;
  }

  function restore() {
    const g = savedGame.load();
    if (!g || !g.rules) return false;
    return start({ ...g, sideTab: 'moves' });
  }

  function persist() {
    if (!P) return;
    savedGame.save({ source: P.source, name: P.name, rules: P.rules, moves: P.moves, mode: P.mode, human: P.human, level: P.level });
  }

  const current = () => P.states[P.states.length - 1];

  // ---------------------------------------------------------------------------
  // Lances
  // ---------------------------------------------------------------------------

  function pushMove(m, live) {
    const G = P.G;
    const S = current();
    const text = moveText(G, S, m);
    const N = applyMove(G, S, m, true);
    P.states.push(N);
    P.moves.push(m);
    P.hist.push(N.hash);
    P.status = gameStatus(G, N, P.hist);
    const suffix = P.status.over && P.status.r === 'mate' ? '#' : P.status.check ? '+' : '';
    P.texts.push({ text: text + suffix, color: S.turn });
    P.news = live ? describeEvents(S, N) : [];
    if (P.status.over) {
      P.over = true;
      P.result = { w: P.status.w, r: P.status.r };
    }
    return N;
  }

  function play(m) {
    const S = current();
    const N = pushMove(m, true);
    P.selected = -1;
    P.hint = null;
    P.overlayHidden = false;
    // animação
    let anim = null;
    if (mFlag(m) !== F_PASS) {
      anim = { from: mFrom(m), to: mTo(m) };
      const c = (N.ev || []).find((e) => e.type === 'castle');
      if (c) {
        anim.rookFrom = c.from;
        anim.rookTo = c.to;
      }
    }
    // efeitos
    const ev = N.ev || [];
    const boom = ev.find((e) => e.type === 'explode');
    if (boom) {
      board.burst(boom.sq, boom.radius);
      sound.boom();
      ev.filter((e) => e.type === 'removed' && e.why === 'explode').forEach((e) => board.ping(e.sq, 'fx-hit'));
    } else if (ev.some((e) => e.type === 'become' || e.type === 'revert' || e.type === 'spawn' || e.type === 'tag' || e.type === 'promote')) sound.special();
    else if (ev.some((e) => e.type === 'capture')) sound.capture();
    else sound.move();
    ev.filter((e) => e.type === 'become' || e.type === 'revert' || e.type === 'spawn' || e.type === 'tag').forEach((e) => setTimeout(() => board.ping(e.sq, 'fx-ping'), 180));
    if (P.over) setTimeout(() => sound.end(), 250);
    update(anim);
    persist();
    if (!P.over) setTimeout(maybeAI, 60);
    else if (S) app.onGameEnd && app.onGameEnd();
  }

  function describeEvents(S, N) {
    const G = P.G;
    const who = S.turn;
    const out = [];
    for (const e of N.ev || []) {
      if (e.type === 'become') out.push(`${cap(G.types[e.from].name)} virou ${G.types[e.to].name}.`);
      if (e.type === 'revert') out.push(`${cap(G.types[e.from].name)} voltou a ser ${G.types[e.to].name}.`);
      if (e.type === 'explode') out.push(explosionText(N, e, who));
      if (e.type === 'promote') out.push(`Promoção: ${G.types[e.t].name}.`);
      if (e.type === 'spawn') out.push(e.recruit ? `${cap(G.types[e.t].name)} mudou de lado.` : `Apareceu ${G.types[e.t].name} das ${COLOR[who]}.`);
      if (e.type === 'tag') out.push(`A peça ganhou a marca "${e.tag}".`);
      if (e.type === 'untag') out.push(`A peça perdeu a marca "${e.tag}".`);
      if (e.type === 'pass') out.push(`As ${COLOR[who]} passaram o lance extra.`);
      if (e.type === 'extra') out.push('Ganhou um lance extra!');
    }
    return out;
  }

  // "Explosão em f7: as pretas perderam Rei e Bispo; as brancas, Cavalo (o que capturou)."
  function explosionText(N, boom, who) {
    const G = P.G;
    const evs = N.ev;
    const lost = [[], []];
    evs.filter((e) => e.type === 'capture').forEach((e) => lost[pColor(e.code)].push(G.types[pType(e.code)].name + ' (a capturada)'));
    evs.filter((e) => e.type === 'removed' && e.why === 'explode').forEach((e) => {
      const name = G.types[pType(e.code)].name + (e.sq === boom.sq ? ' (o que capturou)' : '');
      lost[pColor(e.code)].push(name);
    });
    const list = (a) => (a.length <= 1 ? a.join('') : a.slice(0, -1).join(', ') + ' e ' + a[a.length - 1]);
    const parts = [];
    const enemy = 1 - who;
    if (lost[enemy].length) parts.push(`as ${COLOR[enemy]} perderam ${list(lost[enemy])}`);
    if (lost[who].length) parts.push(`as ${COLOR[who]} perderam ${list(lost[who])}`);
    const where = squareName(G, boom.sq);
    let t = `Explosão em ${where}: ${parts.join('; ')}.`;
    const neighbors = evs.filter((e) => e.type === 'removed' && e.why === 'explode' && e.sq !== boom.sq).length;
    if (!neighbors) {
      const bx = boom.sq % G.W;
      const by = Math.floor(boom.sq / G.W);
      let pawnNear = false;
      for (let sq = 0; sq < G.N; sq++) {
        const c = N.b[sq];
        if (c && sq !== boom.sq && Math.abs((sq % G.W) - bx) <= boom.radius && Math.abs(Math.floor(sq / G.W) - by) <= boom.radius && G.types[pType(c)].pawn) pawnNear = true;
      }
      t += pawnNear ? ' Os peões vizinhos não explodem.' : ' Não havia outras peças por perto.';
    }
    return t;
  }

  function isHumanTurn() {
    if (!P || P.over || P.thinking) return false;
    if (P.mode === 'local') return true;
    if (P.mode === 'auto') return false;
    return current().turn === P.human;
  }

  const movesFrom = (sq) => P.status.moves.filter((m) => m !== PASS && mFrom(m) === sq);
  const movesTo = (from, to) => P.status.moves.filter((m) => m !== PASS && mFrom(m) === from && mTo(m) === to);
  const mine = (sq) => {
    const c = current().b[sq];
    return c && pColor(c) === current().turn;
  };

  board.canDrag = (sq) => isHumanTurn() && mine(sq) && movesFrom(sq).length > 0;
  board.onClick = (sq, info = {}) => {
    if (!isHumanTurn()) return;
    sound.unlock();
    if (P.selected >= 0 && sq !== P.selected && !info.dragStart) {
      const ms = movesTo(P.selected, sq);
      if (ms.length) {
        choose(ms);
        return;
      }
    }
    if (mine(sq) && movesFrom(sq).length) P.selected = P.selected === sq && !info.dragStart ? -1 : sq;
    else P.selected = -1;
    updateMarks();
  };
  board.onDrop = (from, to) => {
    if (!isHumanTurn()) return false;
    const ms = movesTo(from, to);
    if (!ms.length) {
      P.selected = from;
      updateMarks();
      return false;
    }
    if (ms.length > 1) {
      choose(ms);
      return false;
    }
    play(ms[0]);
    return true;
  };

  function choose(ms) {
    if (ms.length === 1) {
      play(ms[0]);
      return;
    }
    const G = P.G;
    const color = current().turn;
    const grid = h('div', { class: 'promo-grid' });
    let dlg;
    ms.forEach((m) => {
      const t = mPromo(m);
      const T = t >= 0 ? G.types[t] : G.types[pType(current().b[mFrom(m)])];
      const b = h('button', {
        type: 'button',
        class: 'promo-pick',
        onclick: () => {
          dlg.close();
          play(m);
        },
      });
      b.innerHTML = `${pieceSVG(T.icon, color, T.id)}<span>${escapeHtml(T.name)}</span>`;
      grid.appendChild(b);
    });
    dlg = modal({ title: 'Promover para qual peça?', body: grid, onClose: () => updateMarks() });
  }

  async function maybeAI() {
    if (!P || P.over || P.paused) return;
    const S = current();
    const aiTurn = P.mode === 'auto' || (P.mode === 'ai' && S.turn !== P.human);
    if (!aiTurn || P.thinking) return;
    const token = ++P.token;
    P.thinking = true;
    updateStatus();
    const t0 = performance.now();
    try {
      const level = P.mode === 'auto' ? P.level : P.level;
      const r = await ai.think(P.rules, P.rulesKey, S, P.hist, level);
      const wait = Math.max(0, (P.mode === 'auto' ? 450 : 300) - (performance.now() - t0));
      if (wait) await sleep(wait);
      if (!P || token !== P.token) return;
      P.thinking = false;
      const legal = P.status.moves;
      const m = r && legal.includes(r.move) ? r.move : legal[0];
      if (m === undefined) {
        updateStatus();
        return;
      }
      play(m);
    } catch (e) {
      if (!P || token !== P.token) return;
      P.thinking = false;
      updateStatus();
      if (e.message !== 'cancelado') toast(`O robô teve um problema: ${e.message}`, { kind: 'warn' });
    }
  }

  function cancelAI() {
    if (!P) return;
    P.token++;
    P.thinking = false;
    ai.cancel();
  }

  function undo() {
    if (!P || P.moves.length === 0) return;
    cancelAI();
    const popOne = () => {
      P.states.pop();
      P.moves.pop();
      P.texts.pop();
      P.hist.pop();
    };
    popOne();
    if (P.mode === 'ai') while (P.moves.length && current().turn !== P.human) popOne();
    P.over = false;
    P.result = null;
    P.news = [];
    P.selected = -1;
    P.hint = null;
    P.status = gameStatus(P.G, current(), P.hist);
    if (P.status.over) {
      P.over = true;
      P.result = { w: P.status.w, r: P.status.r };
    }
    update();
    persist();
    if (P.mode !== 'ai') setTimeout(maybeAI, 300);
  }

  async function hint() {
    if (!isHumanTurn()) return;
    const S = current();
    ui.hintBtn.disabled = true;
    ui.status.textContent = 'Procurando um bom lance…';
    try {
      const r = await ai.think(P.rules, P.rulesKey, S, P.hist, { timeMs: 900, maxDepth: 5, noise: 0 });
      if (!P || current() !== S) return;
      if (r && r.move !== null && r.move !== undefined) {
        if (r.move === PASS) toast('A dica é passar o lance extra.');
        else P.hint = [mFrom(r.move), mTo(r.move)];
      }
    } catch {
      /* sem dica */
    }
    ui.hintBtn.disabled = false;
    update();
  }

  function passExtra() {
    if (!isHumanTurn() || !P.status.moves.includes(PASS)) return;
    play(PASS);
  }

  function resign() {
    if (!P || P.over) return;
    cancelAI();
    const loser = P.mode === 'ai' ? P.human : current().turn;
    P.over = true;
    P.result = { w: 1 - loser, r: 'resign' };
    update();
  }

  // ---------------------------------------------------------------------------
  // Interface
  // ---------------------------------------------------------------------------

  function build() {
    const G = P.G;
    board.setCoords(settings.data.coords);
    board.setSize(G.W, G.H);
    board.setFlipped(P.flipped);

    const status = h('p', { class: 'status-main', 'aria-live': 'polite' });
    const news = h('p', { class: 'status-news', 'aria-live': 'polite' });
    const overlay = h('div', { class: 'over', hidden: true });
    const passBtn = btn('Passar o lance extra', { kind: 'mark', icon: 'skip', onClick: passExtra });
    const pauseBtn = btn('Pausar', { kind: 'ghost', icon: 'pause', onClick: () => {
      P.paused = !P.paused;
      if (!P.paused) maybeAI();
      update();
    } });
    const undoBtn = btn('Voltar lance', { kind: 'ghost', icon: 'undo', onClick: undo });
    const hintBtn = btn('Dica', { kind: 'ghost', icon: 'hint', onClick: hint });
    const flipBtn = btn('Virar tabuleiro', { kind: 'ghost', icon: 'flip', iconOnly: true, onClick: () => {
      P.flipped = !P.flipped;
      board.setFlipped(P.flipped);
      update();
    } });
    const newBtn = btn('Nova partida', { kind: 'primary', icon: 'restart', onClick: () => app.newGameDialog({ source: P.source, rules: P.rules, name: P.name }) });
    const resignBtn = btn('Desistir', { kind: 'ghost', icon: 'flag', onClick: resign });

    const modeText =
      P.mode === 'ai'
        ? `Você joga com as ${COLOR[P.human]} contra o robô (nível ${LEVEL_TEXT[P.level]})`
        : P.mode === 'local'
          ? 'Duas pessoas no mesmo aparelho'
          : `Robô contra robô (nível ${LEVEL_TEXT[P.level]})`;

    const tabs = h('div', { class: 'tabs tabs-sm', role: 'tablist', 'aria-label': 'Informações da partida' });
    const sideBody = h('div', { class: 'side-body', role: 'tabpanel' });
    const tabDefs = [
      { id: 'rules', label: 'Regras' },
      { id: 'pieces', label: 'Peças' },
      { id: 'moves', label: 'Lances' },
    ];
    const tabBtns = tabDefs.map((t) => {
      const b = h('button', { type: 'button', role: 'tab', class: 'tab', onclick: () => {
        P.sideTab = t.id;
        renderSide();
      } }, t.label);
      tabs.appendChild(b);
      return b;
    });

    ui = { status, news, overlay, passBtn, pauseBtn, undoBtn, hintBtn, flipBtn, newBtn, resignBtn, sideBody, tabBtns, tabDefs };

    const editBtn = P.source ? btn('Editar regras', { kind: 'ghost', small: true, icon: 'edit', onClick: () => app.editSource(P.source, P.rules) }) : null;

    root.replaceChildren(
      h(
        'div',
        { class: 'play-main' },
        h('div', { class: 'play-head' }, h('div', null, h('h1', { class: 'h-title' }, P.name), h('p', { class: 'muted' }, modeText)), editBtn),
        h('div', { class: 'status' }, status, news),
        h('div', { class: 'board-frame board-play' }, board.el, overlay),
        h('div', { class: 'play-ctrl' }, passBtn, undoBtn, hintBtn, pauseBtn, flipBtn, resignBtn, newBtn),
      ),
      h('aside', { class: 'play-side sheet' }, tabs, sideBody),
    );
    update();
    renderSide();
  }

  function pieceListFor(S) {
    const G = P.G;
    const list = [];
    for (let sq = 0; sq < G.N; sq++) {
      const c = S.b[sq];
      if (!c) continue;
      const T = G.types[pType(c)];
      const color = pColor(c);
      const tagged = S.tg[sq] !== 0;
      const orig = S.tf && S.tf[sq] ? G.types[(S.tf[sq] & 63) - 1] : null;
      let html = pieceSVG(T.icon, color, T.id);
      if (orig) html += `<span class="pc-orig" title="Era ${escapeHtml(orig.name)}">${pieceSVG(orig.icon, color, orig.id)}</span>`;
      list.push({ sq, key: `${T.icon}|${color}|${T.id}|${tagged ? 1 : 0}|${orig ? orig.id : ''}`, html, tagged });
    }
    return list;
  }

  function update(anim) {
    if (!P || !ui) return;
    const S = current();
    board.setPieces(pieceListFor(S), anim);
    updateMarks();
    updateStatus();
    renderOverlay();
    if (P.sideTab === 'moves') renderSide();
  }

  function updateMarks() {
    const G = P.G;
    const S = current();
    const last = P.moves.length ? P.moves[P.moves.length - 1] : null;
    const marks = {};
    if (last !== null && mFlag(last) !== F_PASS) {
      marks.lastFrom = mFrom(last);
      marks.lastTo = mTo(last);
    }
    if (P.selected >= 0) {
      marks.selected = P.selected;
      marks.targets = movesFrom(P.selected).map((m) => ({ sq: mTo(m), cap: isCapture(S, m) }));
    }
    if (P.status.check) {
      marks.check = [];
      for (let sq = 0; sq < G.N; sq++) {
        const c = S.b[sq];
        if (c && pColor(c) === S.turn && G.types[pType(c)].royal) marks.check.push(sq);
      }
    }
    if (G.goal && !G.goal.lastRank) {
      marks.goal = [];
      for (let sq = 0; sq < G.N; sq++) if (G.goal.mask[sq]) marks.goal.push(sq);
    }
    if (S.ex && S.ex.same && S.ex.sq >= 0) marks.extra = S.ex.sq;
    if (P.hint) marks.hint = P.hint;
    board.setMarks(marks);
  }

  function updateStatus() {
    if (!ui) return;
    const S = current();
    let text;
    if (P.over) {
      text = resultTitle() + '. ' + (RESULT_TEXT[P.result.r] || '');
    } else if (P.thinking) {
      text = P.mode === 'auto' ? `Robô das ${COLOR[S.turn]} pensando…` : 'O robô está pensando…';
    } else if (P.paused) {
      text = 'Pausado.';
    } else {
      const whose = P.mode === 'ai' ? (S.turn === P.human ? 'Sua vez' : 'Vez do robô') : `Vez das ${COLOR[S.turn]}`;
      if (S.ex) text = `${whose}: lance extra${S.ex.same ? ' com a peça marcada' : ''}${S.ex.cap === 1 ? ', só capturando' : S.ex.cap === 2 ? ', sem capturar' : ''}${S.ex.optional ? '. Se preferir, passe.' : '.'}`;
      else text = `${P.status.check ? 'Xeque! ' : ''}${whose}${P.mode === 'ai' ? ` (${COLOR[S.turn]})` : ''}.`;
    }
    ui.status.textContent = text;
    ui.status.classList.toggle('thinking', !!P.thinking);
    ui.status.classList.toggle('check', !!P.status.check && !P.over);
    ui.news.textContent = P.news.join(' ');
    const humanTurn = isHumanTurn();
    ui.passBtn.hidden = !(humanTurn && P.status.moves.includes(PASS));
    ui.pauseBtn.hidden = P.mode !== 'auto' || P.over;
    ui.pauseBtn.querySelector('span').textContent = P.paused ? 'Continuar' : 'Pausar';
    ui.undoBtn.disabled = P.moves.length === 0 || P.mode === 'auto';
    ui.hintBtn.hidden = P.mode === 'auto';
    ui.hintBtn.disabled = !humanTurn;
    ui.resignBtn.hidden = P.over || P.mode === 'auto';
  }

  function resultTitle() {
    const w = P.result.w;
    if (w === -1) return 'Empate';
    if (P.mode === 'ai') return w === P.human ? 'Você venceu' : 'O robô venceu';
    return `Vitória das ${COLOR[w]}`;
  }

  function renderOverlay() {
    const o = ui.overlay;
    o.hidden = !P.over || P.overlayHidden;
    if (o.hidden) return;
    const won = P.mode === 'ai' && P.result.w === P.human;
    o.replaceChildren(
      h(
        'div',
        { class: `over-card ${won ? 'won' : ''}` },
        h('p', { class: 'over-title' }, resultTitle()),
        h('p', { class: 'over-sub' }, RESULT_TEXT[P.result.r] || ''),
        h(
          'div',
          { class: 'over-btns' },
          btn('Jogar de novo', { kind: 'primary', icon: 'restart', onClick: () => start({ source: P.source, rules: P.rules, name: P.name, mode: P.mode, human: P.human, level: P.level, sideTab: P.sideTab }) }),
          btn('Ver o tabuleiro', { kind: 'ghost', onClick: () => {
            P.overlayHidden = true;
            renderOverlay();
          } }),
        ),
      ),
    );
  }

  function renderSide() {
    if (!ui) return;
    ui.tabBtns.forEach((b, i) => {
      const on = ui.tabDefs[i].id === P.sideTab;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    const r = P.rules;
    const body = ui.sideBody;
    if (P.sideTab === 'moves') {
      const rows = [];
      let row = null;
      let lastColor = -1;
      let n = 0;
      P.texts.forEach((t) => {
        if (t.color === 0 && lastColor !== 0) {
          n++;
          row = { n, w: [], b: [] };
          rows.push(row);
        } else if (!row) {
          n++;
          row = { n, w: [], b: [] };
          rows.push(row);
        }
        (t.color === 0 ? row.w : row.b).push(t.text);
        lastColor = t.color;
      });
      const ol = h('ol', { class: 'moves' });
      rows.forEach((rw) => ol.appendChild(h('li', null, h('span', { class: 'mv-n' }, `${rw.n}.`), h('span', { class: 'mv-w' }, rw.w.join(', ') || '…'), h('span', { class: 'mv-b' }, rw.b.join(', ')))));
      body.replaceChildren(P.texts.length ? ol : h('p', { class: 'muted' }, 'Nenhum lance ainda. As brancas começam.'));
      ol.lastChild && ol.lastChild.scrollIntoView && setTimeout(() => (body.scrollTop = body.scrollHeight), 0);
      return;
    }
    if (P.sideTab === 'pieces') {
      const list = h('div', { class: 'legend' });
      r.pieces.forEach((p) => {
        const sets = p.moves.filter((s) => s.steps.length);
        const diagrams = h('div', { class: 'legend-dg' });
        sets.forEach((s) => {
          const d = moveDiagram({ steps: s.steps, piece: p, size: 'sm', label: `${p.name}: ${setLabel(r, s)}` });
          diagrams.appendChild(h('figure', { class: 'legend-fig' }, d, h('figcaption', null, setLabel(r, s))));
        });
        list.appendChild(
          h(
            'article',
            { class: 'legend-it' },
            h('h3', { class: 'legend-h' }, h('span', { class: 'legend-ic', html: pieceSVG(p.icon, 0, p.id) }), `${p.name}`, h('span', { class: 'legend-l' }, p.id)),
            diagrams,
            h('ul', { class: 'rule-lines' }, ...pieceLines(r, p).map((l) => h('li', null, l))),
          ),
        );
      });
      body.replaceChildren(list);
      return;
    }
    const special = r.triggers.filter((t) => t.enabled && t.effects.length);
    body.replaceChildren(
      r.description ? h('p', { class: 'rule-desc' }, r.description) : '',
      h('h3', { class: 'h-sec' }, 'Como vencer'),
      h('ul', { class: 'rule-lines' }, ...victoryLines(r).map((l) => h('li', null, l))),
      h('h3', { class: 'h-sec' }, 'Regras especiais'),
      special.length ? h('ul', { class: 'rule-lines rule-special' }, ...special.map((t) => h('li', null, triggerSentence(r, t)))) : h('p', { class: 'muted' }, 'Nenhuma. As peças seguem só os seus movimentos.'),
    );
  }

  return {
    el: root,
    start,
    restore,
    has: () => !!P,
    stop: () => cancelAI(),
    resume: () => {
      if (P && !P.over) setTimeout(maybeAI, 200);
    },
    refreshSettings: () => {
      if (!P) return;
      board.setCoords(settings.data.coords);
      update();
    },
    source: () => (P ? P.source : null),
  };
}

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
