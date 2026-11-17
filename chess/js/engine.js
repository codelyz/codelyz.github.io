// Motor de regras genérico do Xadrez Sob Medida.
// Lê um arquivo de regras (JSON), gera os lances legais e aplica os lances
// com todas as regras especiais (gatilhos). Não depende do navegador: roda
// também no Web Worker do robô e no Node (testes).
//
// Coordenadas: casa = y * W + x, com y = 0 na primeira fileira das brancas.
// Para as pretas, os movimentos são girados 180° ("para frente" é para baixo).

export const FORMAT = 'xadrez-sob-medida';
export const FORMAT_VERSION = 1;
export const MIN_SIZE = 4;
export const MAX_SIZE = 12;
export const MAX_PLY = 600;
export const FILES = 'abcdefghijkl';

const MOVE = 1;
const CAP = 2;

export const F_NORMAL = 0;
export const F_CASTLE = 1;
export const F_EP = 2;
export const F_PASS = 3;
export const PASS = F_PASS << 22;

export const mkMove = (from, to, promo = -1, flag = 0) => from | (to << 8) | ((promo + 1) << 16) | (flag << 22);
export const mFrom = (m) => m & 255;
export const mTo = (m) => (m >> 8) & 255;
export const mPromo = (m) => ((m >> 16) & 63) - 1;
export const mFlag = (m) => (m >> 22) & 3;

export const pType = (code) => (code & 63) - 1;
export const pColor = (code) => (code >> 6) & 1;
export const pMoved = (code) => (code >> 7) & 1;
const MOVED = 128;
const mk = (t, c, moved) => (t + 1) | (c << 6) | (moved ? MOVED : 0);

export class RuleError extends Error {
  constructor(msg) {
    super(msg);
    this.name = 'RuleError';
  }
}

// ---------------------------------------------------------------------------
// Vocabulário das regras (usado também pelo editor)
// ---------------------------------------------------------------------------

export const WHEN_LIST = ['always', 'firstMove', 'moved', 'enemyHalf', 'ownHalf', 'hasTag', 'noTag', 'extra', 'nearFriend', 'minRank', 'transformed'];
const WHEN_CODE = Object.fromEntries(WHEN_LIST.map((w, i) => [w, i]));
export const COND_LIST = ['notExtra', 'isExtra', 'firstMove', 'hasTag', 'noTag', 'minRank', 'enemyHalf', 'ownHalf', 'targetStronger', 'targetWeaker', 'transformed', 'notTransformed'];
export const EFFECT_LIST = ['becomeCaptured', 'become', 'revert', 'extraMove', 'explode', 'removeSelf', 'leaveBehind', 'recruit', 'addTag', 'removeTag', 'win', 'lose'];
// Quando a peça transformada volta ao normal sozinha
export const BACK_LIST = ['never', 'endTurn', 'nextMove', 'turns'];
export const EVENT_LIST = ['capture', 'quiet', 'any'];

// ---------------------------------------------------------------------------
// Normalização: aceita JSON incompleto e preenche os valores padrão
// ---------------------------------------------------------------------------

function clampInt(v, lo, hi, def) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return def;
  return Math.max(lo, Math.min(hi, n));
}
const oneOf = (v, list, def) => (list.includes(v) ? v : def);
const idList = (v) => (Array.isArray(v) ? v.map((x) => String(x).toUpperCase().slice(0, 1)).filter((x) => /^[A-Z]$/.test(x)) : []);
const tagName = (v) => String(v || '').trim().toLowerCase().slice(0, 24);

export function emptySetup(W, H) {
  return Array.from({ length: H }, () => String(W)).join('/');
}

function normalizeStep(st) {
  const s = st || {};
  const out = {
    dx: clampInt(s.dx, -11, 11, 0),
    dy: clampInt(s.dy, -11, 11, 0),
    kind: s.kind === 'ride' ? 'ride' : 'leap',
    mode: oneOf(s.mode, ['both', 'move', 'capture'], 'both'),
  };
  if (out.kind === 'ride') {
    out.range = clampInt(s.range, 0, 11, 0);
    if (s.hop) out.hop = true;
  }
  return out;
}

function normalizeSet(s) {
  const set = s || {};
  const out = { when: oneOf(set.when, WHEN_LIST, 'always') };
  if (set.replace && out.when !== 'always') out.replace = true;
  if (out.when === 'hasTag' || out.when === 'noTag') out.tag = tagName(set.tag) || 'marca';
  if (out.when === 'nearFriend') out.piece = set.piece ? String(set.piece).toUpperCase().slice(0, 1) : '';
  if (out.when === 'minRank') out.rank = clampInt(set.rank, 1, MAX_SIZE, 5);
  out.steps = (Array.isArray(set.steps) ? set.steps : []).map(normalizeStep).filter((st) => st.dx || st.dy);
  return out;
}

function normalizePiece(p, i) {
  const piece = p || {};
  const out = {
    id: String(piece.id || String.fromCharCode(65 + (i % 26))).toUpperCase().slice(0, 1),
    name: String(piece.name || 'Peça').slice(0, 30),
    icon: String(piece.icon || 'letter'),
    value: piece.value === null || piece.value === undefined || piece.value === 'auto' ? null : clampInt(piece.value, 0, 20000, 100),
    royal: !!piece.royal,
    pawn: !!piece.pawn,
    castling: !!piece.castling,
    castleRook: !!piece.castleRook,
    promotion: null,
    moves: (Array.isArray(piece.moves) ? piece.moves : []).map(normalizeSet),
  };
  if (piece.promotion && Array.isArray(piece.promotion.to) && piece.promotion.to.length) {
    out.promotion = { to: idList(piece.promotion.to), zone: clampInt(piece.promotion.zone, 1, 6, 1) };
    if (!out.promotion.to.length) out.promotion = null;
  }
  if (!out.moves.length) out.moves = [{ when: 'always', steps: [] }];
  return out;
}

function normalizeCondition(c) {
  const out = { type: oneOf(c && c.type, COND_LIST, 'notExtra') };
  if (out.type === 'hasTag' || out.type === 'noTag') out.tag = tagName(c.tag) || 'marca';
  if (out.type === 'minRank') out.rank = clampInt(c.rank, 1, MAX_SIZE, 8);
  return out;
}

function normalizeEffect(e) {
  const out = { type: oneOf(e && e.type, EFFECT_LIST, 'becomeCaptured') };
  if (out.type === 'become' || out.type === 'leaveBehind') out.piece = String(e.piece || '').toUpperCase().slice(0, 1);
  if (out.type === 'become' || out.type === 'becomeCaptured') {
    const back = oneOf(e.back, BACK_LIST, 'never');
    if (back !== 'never') out.back = back;
    if (back === 'turns') out.turns = clampInt(e.turns, 1, 20, 2);
  }
  if (out.type === 'extraMove') {
    out.same = e.same !== false;
    out.capture = oneOf(e.capture, ['any', 'only', 'none'], 'any');
    out.optional = e.optional !== false;
  }
  if (out.type === 'explode') {
    out.radius = clampInt(e.radius, 1, 3, 1);
    out.self = e.self !== false;
    out.sparePawns = e.sparePawns !== false;
    out.spareRoyal = !!e.spareRoyal;
    if (e.targets === 'enemy' || e.targets === 'own') out.targets = e.targets;
  }
  if (out.type === 'addTag' || out.type === 'removeTag') out.tag = tagName(e.tag) || 'marca';
  return out;
}

function normalizeTrigger(t) {
  const tr = t || {};
  return {
    event: oneOf(tr.event, EVENT_LIST, 'capture'),
    pieces: idList(tr.pieces),
    targets: idList(tr.targets),
    conditions: (Array.isArray(tr.conditions) ? tr.conditions : []).map(normalizeCondition),
    effects: (Array.isArray(tr.effects) ? tr.effects : []).map(normalizeEffect),
    enabled: tr.enabled !== false,
  };
}

function normalizeGoal(g) {
  if (!g || !g.mode) return null;
  const mode = oneOf(g.mode, ['squares', 'lastRank'], null);
  if (!mode) return null;
  const squares = Array.isArray(g.squares) ? g.squares.map((s) => String(s).toLowerCase()).filter((s) => /^[a-l](1[0-2]|[1-9])$/.test(s)) : [];
  return { mode, pieces: idList(g.pieces), squares };
}

export function normalizeRules(raw) {
  const r = JSON.parse(JSON.stringify(raw || {}));
  const W = clampInt(r.board && r.board.width, MIN_SIZE, MAX_SIZE, 8);
  const H = clampInt(r.board && r.board.height, MIN_SIZE, MAX_SIZE, 8);
  const v = r.victory || {};
  const o = r.options || {};
  return {
    format: FORMAT,
    version: FORMAT_VERSION,
    name: String(r.name || 'Variante sem nome').slice(0, 60),
    description: String(r.description || '').slice(0, 600),
    board: { width: W, height: H },
    pieces: (Array.isArray(r.pieces) ? r.pieces : []).slice(0, 40).map(normalizePiece),
    setup: typeof r.setup === 'string' && r.setup.trim() ? r.setup.trim() : emptySetup(W, H),
    victory: {
      royal: oneOf(v.royal, ['checkmate', 'capture', 'none'], 'checkmate'),
      stalemate: oneOf(v.stalemate, ['draw', 'loss', 'win'], 'draw'),
      extinction: oneOf(v.extinction, ['off', 'loss', 'win'], 'off'),
      goal: normalizeGoal(v.goal),
    },
    options: {
      castling: o.castling !== false,
      enPassant: o.enPassant !== false,
      forcedCapture: !!o.forcedCapture,
      fiftyMove: clampInt(o.fiftyMove, 0, 200, 50),
      repetition: clampInt(o.repetition, 0, 10, 3),
    },
    triggers: (Array.isArray(r.triggers) ? r.triggers : []).slice(0, 30).map(normalizeTrigger),
  };
}

// ---------------------------------------------------------------------------
// Posição inicial (formato tipo FEN: maiúsculas = brancas, minúsculas = pretas)
// ---------------------------------------------------------------------------

export function parseSetup(setup, W, H, idx) {
  const rows = String(setup).trim().split('/');
  if (rows.length !== H) throw new RuleError(`A posição inicial tem ${rows.length} fileiras, mas o tabuleiro tem ${H}.`);
  const b = new Uint8Array(W * H);
  for (let r = 0; r < H; r++) {
    const y = H - 1 - r;
    const row = rows[r];
    let x = 0;
    for (let i = 0; i < row.length; ) {
      const ch = row[i];
      if (ch >= '0' && ch <= '9') {
        let j = i;
        while (j < row.length && row[j] >= '0' && row[j] <= '9') j++;
        x += parseInt(row.slice(i, j), 10);
        i = j;
        continue;
      }
      const up = ch.toUpperCase();
      const t = idx.get(up);
      if (t === undefined) throw new RuleError(`A posição inicial usa a letra "${ch}", mas nenhuma peça tem essa letra.`);
      if (x >= W) throw new RuleError(`A fileira ${y + 1} da posição inicial tem casas demais.`);
      b[y * W + x] = mk(t, ch === up ? 0 : 1, 0);
      x++;
      i++;
    }
    if (x !== W) throw new RuleError(`A fileira ${y + 1} da posição inicial tem ${x} casas, mas deveria ter ${W}.`);
  }
  return b;
}

// cells: array W*H com null ou {id, color}
export function setupToCells(setup, W, H) {
  const cells = new Array(W * H).fill(null);
  const rows = String(setup || '').trim().split('/');
  for (let r = 0; r < Math.min(rows.length, H); r++) {
    const y = H - 1 - r;
    const row = rows[r];
    let x = 0;
    for (let i = 0; i < row.length && x < W; ) {
      const ch = row[i];
      if (ch >= '0' && ch <= '9') {
        let j = i;
        while (j < row.length && row[j] >= '0' && row[j] <= '9') j++;
        x += parseInt(row.slice(i, j), 10);
        i = j;
        continue;
      }
      const up = ch.toUpperCase();
      if (/[A-Z]/.test(up)) cells[y * W + x] = { id: up, color: ch === up ? 0 : 1 };
      x++;
      i++;
    }
  }
  return cells;
}

export function cellsToSetup(cells, W, H) {
  const rows = [];
  for (let y = H - 1; y >= 0; y--) {
    let row = '';
    let empty = 0;
    for (let x = 0; x < W; x++) {
      const c = cells[y * W + x];
      if (!c) {
        empty++;
        continue;
      }
      if (empty) row += empty;
      empty = 0;
      row += c.color ? c.id.toLowerCase() : c.id.toUpperCase();
    }
    if (empty) row += empty;
    rows.push(row);
  }
  return rows.join('/');
}

export const squareName = (G, sq) => FILES[sq % G.W] + (Math.floor(sq / G.W) + 1);
export function parseSquare(name, W, H) {
  const m = /^([a-l])(1[0-2]|[1-9])$/.exec(String(name).toLowerCase());
  if (!m) return -1;
  const x = FILES.indexOf(m[1]);
  const y = parseInt(m[2], 10) - 1;
  if (x >= W || y >= H) return -1;
  return y * W + x;
}

// ---------------------------------------------------------------------------
// Compilação
// ---------------------------------------------------------------------------

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return (t ^ (t >>> 14)) >>> 0;
  };
}

const MODE_BITS = { both: 3, move: MOVE, capture: CAP };

export function compileRules(raw) {
  const r = normalizeRules(raw);
  const W = r.board.width;
  const H = r.board.height;
  const N = W * H;
  if (!r.pieces.length) throw new RuleError('Crie pelo menos uma peça.');

  const idx = new Map();
  r.pieces.forEach((p) => {
    if (!/^[A-Z]$/.test(p.id)) throw new RuleError(`A peça "${p.name}" precisa de uma letra de A a Z.`);
    if (idx.has(p.id)) throw new RuleError(`Duas peças usam a letra ${p.id}. Cada peça precisa de uma letra diferente.`);
    idx.set(p.id, idx.size);
  });

  const tags = [];
  const tagBit = (name) => {
    const n = tagName(name);
    if (!n) return 0;
    let i = tags.indexOf(n);
    if (i < 0) {
      if (tags.length >= 30) throw new RuleError('Use no máximo 30 marcas diferentes.');
      tags.push(n);
      i = tags.length - 1;
    }
    return 1 << i;
  };
  const typeOf = (id, where) => {
    const i = idx.get(String(id || '').toUpperCase());
    if (i === undefined) throw new RuleError(`${where}: escolha uma peça que exista.`);
    return i;
  };
  const maskOf = (ids) => {
    if (!ids || !ids.length) return null;
    const m = new Uint8Array(r.pieces.length);
    ids.forEach((id) => {
      const i = idx.get(id);
      if (i !== undefined) m[i] = 1;
    });
    return m;
  };

  let anyFirstMoveTrigger = false;
  let usesTransform = r.pieces.some((p) => p.moves.some((s) => s.when === 'transformed'));

  const types = r.pieces.map((p) => {
    const sets = p.moves.map((s) => ({
      cond: WHEN_CODE[s.when],
      replace: !!s.replace,
      arg: s.when === 'hasTag' || s.when === 'noTag' ? tagBit(s.tag) : s.when === 'nearFriend' ? (s.piece ? (idx.has(s.piece) ? idx.get(s.piece) : -2) : -1) : s.when === 'minRank' ? s.rank : 0,
      steps: s.steps.map((st) => ({
        dx: st.dx,
        dy: st.dy,
        ride: st.kind === 'ride',
        range: st.kind === 'ride' ? st.range || 0 : 1,
        mode: MODE_BITS[st.mode],
        hop: !!st.hop,
      })),
    }));
    return {
      id: p.id,
      name: p.name,
      icon: p.icon,
      royal: !!p.royal,
      pawn: !!p.pawn,
      castling: !!p.castling,
      castleRook: !!p.castleRook,
      promoTo: p.promotion ? p.promotion.to.map((id) => idx.get(id)).filter((x) => x !== undefined) : [],
      promoZone: p.promotion ? p.promotion.zone : 1,
      sets,
      hasCond: sets.some((s) => s.cond !== 0),
      hasReplace: sets.some((s) => s.replace),
      value: 0,
      autoValue: 0,
      userValue: p.value,
    };
  });

  types.forEach((T) => {
    T.autoValue = autoValue(T, W, H);
    T.value = T.userValue === null ? T.autoValue : T.userValue;
  });

  const triggers = r.triggers
    .filter((t) => t.enabled && t.effects.length)
    .map((t, ti) => {
      const where = `Regra especial ${ti + 1}`;
      return {
        event: t.event === 'capture' ? 0 : t.event === 'quiet' ? 1 : 2,
        pieceMask: maskOf(t.pieces),
        targetMask: t.event === 'capture' ? maskOf(t.targets) : null,
        conds: t.conditions.map((c) => {
          if (c.type === 'firstMove') anyFirstMoveTrigger = true;
          if (c.type === 'transformed' || c.type === 'notTransformed') usesTransform = true;
          return { type: c.type, bit: c.tag ? tagBit(c.tag) : 0, rank: c.rank || 0 };
        }),
        effects: t.effects.map((e) => {
          const out = { ...e };
          if (e.type === 'become' || e.type === 'leaveBehind') out.t = typeOf(e.piece, where);
          if (e.type === 'addTag' || e.type === 'removeTag') out.bit = tagBit(e.tag);
          if (e.type === 'extraMove') out.cap = e.capture === 'only' ? 1 : e.capture === 'none' ? 2 : 0;
          if (e.type === 'become' || e.type === 'becomeCaptured' || e.type === 'revert') usesTransform = true;
          out.backCode = e.back === 'endTurn' ? 1 : e.back === 'nextMove' ? 2 : e.back === 'turns' ? 3 : 0;
          out.side = e.targets === 'enemy' ? 1 : e.targets === 'own' ? 2 : 0;
          return out;
        }),
      };
    });

  const setupBoard = parseSetup(r.setup, W, H, idx);
  const hasRoyal = [false, false];
  for (let sq = 0; sq < N; sq++) {
    const c = setupBoard[sq];
    if (c && types[pType(c)].royal) hasRoyal[pColor(c)] = true;
  }

  const royalMode = r.victory.royal === 'none' || !types.some((T) => T.royal) ? 0 : r.victory.royal === 'checkmate' ? 1 : 2;

  let goal = null;
  if (r.victory.goal) {
    const g = r.victory.goal;
    const mask = new Uint8Array(N);
    let count = 0;
    if (g.mode === 'squares') {
      g.squares.forEach((s) => {
        const sq = parseSquare(s, W, H);
        if (sq >= 0) {
          mask[sq] = 1;
          count++;
        }
      });
    }
    if (g.mode === 'lastRank' || count) goal = { lastRank: g.mode === 'lastRank', mask, pieces: maskOf(g.pieces) };
  }

  const X = new Int8Array(N);
  const Y = new Int8Array(N);
  for (let sq = 0; sq < N; sq++) {
    X[sq] = sq % W;
    Y[sq] = Math.floor(sq / W);
  }

  const rnd = mulberry32(0x5eed1234 ^ (N * 7919));
  const Z1 = new Int32Array(N * 256);
  const Z2 = new Int32Array(N * 256);
  for (let i = 0; i < Z1.length; i++) {
    Z1[i] = rnd();
    Z2[i] = rnd();
  }

  const movedMatters = new Uint8Array(types.length);
  types.forEach((T, i) => {
    movedMatters[i] = T.castling || T.castleRook || anyFirstMoveTrigger || T.sets.some((s) => s.cond === 1 || s.cond === 2) ? 1 : 0;
  });

  const evalValue = new Int32Array(types.length);
  types.forEach((T, i) => {
    if (T.royal && royalMode === 1) evalValue[i] = 0;
    else if (T.royal && royalMode === 2) evalValue[i] = 4000;
    else evalValue[i] = T.value || T.autoValue;
  });

  return {
    rules: r,
    W,
    H,
    N,
    X,
    Y,
    types,
    idx,
    tags,
    royalMode,
    stalemate: r.victory.stalemate,
    extinction: r.victory.extinction,
    goal,
    castling: r.options.castling,
    enPassant: r.options.enPassant,
    forcedCapture: r.options.forcedCapture,
    fifty: r.options.fiftyMove,
    repetition: r.options.repetition,
    triggers,
    usesTags: tags.length > 0,
    usesTransform,
    hasRoyal,
    setupBoard,
    Z1,
    Z2,
    movedMatters,
    evalValue,
  };
}

// Valor estimado de uma peça escrita no formato das regras (usado pelo editor)
export function pieceAutoValue(piece, W, H) {
  const np = normalizePiece(piece, 0);
  const T = {
    sets: np.moves.map((s) => ({
      cond: WHEN_CODE[s.when],
      steps: s.steps.map((st) => ({ dx: st.dx, dy: st.dy, ride: st.kind === 'ride', range: st.kind === 'ride' ? st.range || 0 : 1, mode: MODE_BITS[st.mode], hop: !!st.hop })),
    })),
  };
  return autoValue(T, W, H);
}

// Valor estimado de uma peça: média de casas alcançáveis num tabuleiro com
// 30% das casas ocupadas (peças que deslizam são bloqueadas com frequência).
function autoValue(T, W, H) {
  const P_FREE = 0.7;
  let total = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let sum = 0;
      for (const set of T.sets) {
        const w = set.cond === 0 ? 1 : set.cond === 1 ? 0.15 : 0.5;
        for (const st of set.steps) {
          const mw = st.mode === 3 ? 1 : st.mode === MOVE ? 0.6 : 0.4;
          let tx = x + st.dx;
          let ty = y + st.dy;
          if (!st.ride) {
            if (tx >= 0 && tx < W && ty >= 0 && ty < H) sum += w * mw;
            continue;
          }
          let k = 1;
          let p = 1;
          const lim = st.range || 99;
          while (k <= lim && tx >= 0 && tx < W && ty >= 0 && ty < H) {
            sum += w * mw * p * (st.hop ? 0.35 : 1);
            p *= P_FREE;
            tx += st.dx;
            ty += st.dy;
            k++;
          }
        }
      }
      total += sum;
    }
  }
  const mob = total / (W * H);
  return Math.max(10, Math.round((50 + 50 * mob) / 5) * 5);
}

// ---------------------------------------------------------------------------
// Estado
// ---------------------------------------------------------------------------

export function initialState(G) {
  const S = {
    b: G.setupBoard.slice(),
    tg: new Int32Array(G.N),
    tf: new Int32Array(G.N),
    turn: 0,
    ep: -1,
    epV: -1,
    ex: null,
    half: 0,
    ply: 0,
    res: null,
    hash: 0,
    ev: null,
  };
  S.hash = computeHash(G, S);
  return S;
}

function cloneState(G, S) {
  return {
    b: S.b.slice(),
    tg: G.usesTags ? S.tg.slice() : S.tg,
    tf: G.usesTransform ? S.tf.slice() : S.tf,
    turn: S.turn,
    ep: S.ep,
    epV: S.epV,
    ex: S.ex,
    half: S.half,
    ply: S.ply,
    res: S.res,
    hash: S.hash,
    ev: null,
  };
}

export function serializeState(S) {
  return { b: Array.from(S.b), tg: Array.from(S.tg), tf: Array.from(S.tf), turn: S.turn, ep: S.ep, epV: S.epV, ex: S.ex, half: S.half, ply: S.ply, res: S.res, hash: S.hash };
}

export function deserializeState(o) {
  return {
    b: Uint8Array.from(o.b),
    tg: Int32Array.from(o.tg),
    tf: o.tf ? Int32Array.from(o.tf) : new Int32Array(o.b.length),
    turn: o.turn,
    ep: o.ep,
    epV: o.epV,
    ex: o.ex || null,
    half: o.half,
    ply: o.ply,
    res: o.res || null,
    hash: o.hash,
    ev: null,
  };
}

export function computeHash(G, S) {
  const b = S.b;
  const tg = S.tg;
  const Z1 = G.Z1;
  const Z2 = G.Z2;
  let h1 = S.turn ? 0x2545f491 : 0;
  let h2 = S.turn ? 0x4f6cdd1d : 0;
  for (let sq = 0, base = 0; sq < G.N; sq++, base += 256) {
    let c = b[sq];
    if (!c) continue;
    if (!G.movedMatters[(c & 63) - 1]) c &= ~MOVED;
    h1 ^= Z1[base + c];
    h2 ^= Z2[base + c];
    const f = S.tf[sq];
    if (f) {
      h1 ^= Math.imul(f + sq * 0x51ed, 0x9e3779b1);
      h2 ^= Math.imul(f ^ (sq * 0x2c1b), 0x7feb352d);
    }
    const t = tg[sq];
    if (t) {
      h1 ^= Math.imul(t + sq * 0x9e37, 0x85ebca6b);
      h2 ^= Math.imul(t ^ (sq * 0x7f4a), 0xc2b2ae35);
    }
  }
  if (S.ep >= 0) {
    h1 ^= Z1[S.ep * 256];
    h2 ^= Z2[S.ep * 256];
  }
  if (S.ex) {
    const k = (S.ex.sq + 2) * 16 + S.ex.cap * 4 + (S.ex.same ? 2 : 0) + (S.ex.optional ? 1 : 0);
    h1 ^= Math.imul(k, 0x27d4eb2d) ^ 0x3c6ef372;
    h2 ^= Math.imul(k, 0x165667b1) ^ 0x1b873593;
  }
  return (h1 >>> 0) * 2097152 + ((h2 >>> 0) & 0x1fffff);
}

// ---------------------------------------------------------------------------
// Geração de lances
// ---------------------------------------------------------------------------

export const relRank = (G, sq, c) => (c === 0 ? G.Y[sq] + 1 : G.H - G.Y[sq]);

function setActive(G, S, set, sq, c, code, inExtra) {
  switch (set.cond) {
    case 0:
      return true;
    case 1:
      return !(code & MOVED);
    case 2:
      return !!(code & MOVED);
    case 3:
      return relRank(G, sq, c) > Math.ceil(G.H / 2);
    case 4:
      return relRank(G, sq, c) <= Math.floor(G.H / 2);
    case 5:
      return (S.tg[sq] & set.arg) !== 0;
    case 6:
      return (S.tg[sq] & set.arg) === 0;
    case 7:
      return inExtra;
    case 8: {
      if (set.arg === -2) return false;
      const x = G.X[sq];
      const y = G.Y[sq];
      for (let dy = -1; dy <= 1; dy++) {
        const ty = y + dy;
        if (ty < 0 || ty >= G.H) continue;
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const tx = x + dx;
          if (tx < 0 || tx >= G.W) continue;
          const o = S.b[ty * G.W + tx];
          if (o && ((o >> 6) & 1) === c && (set.arg < 0 || (o & 63) - 1 === set.arg)) return true;
        }
      }
      return false;
    }
    case 9:
      return relRank(G, sq, c) >= set.arg;
    case 10:
      return S.tf[sq] !== 0;
    default:
      return false;
  }
}

function usesReplace(G, S, T, sq, c, code, inExtra) {
  if (!T.hasReplace) return false;
  for (const set of T.sets) if (set.replace && setActive(G, S, set, sq, c, code, inExtra)) return true;
  return false;
}

// Marcador para não repetir o mesmo destino quando dois movimentos levam à mesma casa
const SEEN = new Int32Array(256);
let seenStamp = 0;

// Gera os lances de uma peça. capOnly: só capturas (e promoções).
function genPiece(G, S, sq, out, capOnly, inExtra) {
  const b = S.b;
  const code = b[sq];
  const t = (code & 63) - 1;
  const c = (code >> 6) & 1;
  const T = G.types[t];
  const W = G.W;
  const H = G.H;
  const x = G.X[sq];
  const y = G.Y[sq];
  const sgn = c ? -1 : 1;
  const rep = usesReplace(G, S, T, sq, c, code, inExtra);
  const canEp = G.enPassant && T.pawn && S.ep >= 0 && S.epV >= 0 && b[S.epV] && ((b[S.epV] >> 6) & 1) !== c;
  const promo = T.promoTo.length > 0;
  const promoLimit = H - T.promoZone;
  // No modo xeque-mate o Rei nunca é capturado (nem num lance extra depois de um xeque)
  const noRoyalCap = G.royalMode === 1;
  if (++seenStamp > 2000000000) {
    SEEN.fill(0);
    seenStamp = 1;
  }
  const stamp = seenStamp;

  const push = (to, flag) => {
    if (SEEN[to] === stamp) return;
    SEEN[to] = stamp;
    if (promo && relRank(G, to, c) > promoLimit) {
      for (const p of T.promoTo) out.push(sq | (to << 8) | ((p + 1) << 16) | (flag << 22));
    } else {
      out.push(sq | (to << 8) | (flag << 22));
    }
  };
  const pushQuiet = (to) => {
    if (!capOnly) push(to, 0);
    else if (promo && relRank(G, to, c) > promoLimit) push(to, 0);
  };

  for (const set of T.sets) {
    if (rep && !set.replace) continue;
    if (set.cond !== 0 && !setActive(G, S, set, sq, c, code, inExtra)) continue;
    for (const st of set.steps) {
      const dx = st.dx * sgn;
      const dy = st.dy * sgn;
      let tx = x + dx;
      let ty = y + dy;
      if (!st.ride) {
        if (tx < 0 || tx >= W || ty < 0 || ty >= H) continue;
        const to = ty * W + tx;
        const occ = b[to];
        if (occ === 0) {
          if (st.mode & MOVE) pushQuiet(to);
          else if (canEp && to === S.ep && st.mode & CAP) push(to, F_EP);
        } else if (((occ >> 6) & 1) !== c && st.mode & CAP && !(noRoyalCap && G.types[(occ & 63) - 1].royal)) push(to, 0);
        continue;
      }
      const lim = st.range || 99;
      let k = 1;
      let screened = false;
      while (k <= lim && tx >= 0 && tx < W && ty >= 0 && ty < H) {
        const to = ty * W + tx;
        const occ = b[to];
        if (occ === 0) {
          if (!st.hop || screened) {
            if (st.mode & MOVE) pushQuiet(to);
            else if (canEp && to === S.ep && st.mode & CAP) push(to, F_EP);
          }
        } else if (st.hop && !screened) {
          screened = true;
        } else {
          if (((occ >> 6) & 1) !== c && st.mode & CAP && !(noRoyalCap && G.types[(occ & 63) - 1].royal)) push(to, 0);
          break;
        }
        tx += dx;
        ty += dy;
        k++;
      }
    }
  }

  if (!capOnly && T.castling && G.castling && !(code & MOVED)) {
    for (let dir = -1; dir <= 1; dir += 2) {
      let tx = x + dir;
      while (tx >= 0 && tx < W && b[y * W + tx] === 0) tx += dir;
      if (tx < 0 || tx >= W) continue;
      const rc = b[y * W + tx];
      if (((rc >> 6) & 1) !== c || rc & MOVED || !G.types[(rc & 63) - 1].castleRook) continue;
      if (Math.abs(tx - x) < 3) continue;
      out.push(sq | ((y * W + x + 2 * dir) << 8) | (F_CASTLE << 22));
    }
  }
}

// Lances pseudo-legais (sem verificar se o rei fica em xeque)
export function genPseudo(G, S, out, capOnly = false) {
  const ex = S.ex;
  const inExtra = !!ex;
  const start = out.length;
  if (ex && ex.same) {
    if (ex.sq >= 0 && S.b[ex.sq] && ((S.b[ex.sq] >> 6) & 1) === S.turn) genPiece(G, S, ex.sq, out, capOnly || ex.cap === 1, true);
  } else {
    const b = S.b;
    const turn = S.turn;
    for (let sq = 0; sq < G.N; sq++) {
      const code = b[sq];
      if (code && ((code >> 6) & 1) === turn) genPiece(G, S, sq, out, capOnly || (ex && ex.cap === 1), inExtra);
    }
  }
  if (ex && ex.cap) {
    // filtra as capturas conforme o lance extra
    let w = start;
    for (let i = start; i < out.length; i++) {
      const m = out[i];
      const isCap = isCapture(S, m);
      if ((ex.cap === 1 && isCap) || (ex.cap === 2 && !isCap)) out[w++] = m;
    }
    out.length = w;
  }
  return out;
}

export function isCapture(S, m) {
  const f = (m >> 22) & 3;
  if (f === F_EP) return true;
  if (f !== F_NORMAL) return false;
  return S.b[(m >> 8) & 255] !== 0;
}

// A peça em sq ataca a casa target? (ignora en passant e roque)
function attacksSquare(G, S, sq, target) {
  const b = S.b;
  const code = b[sq];
  const t = (code & 63) - 1;
  const c = (code >> 6) & 1;
  const T = G.types[t];
  const sgn = c ? -1 : 1;
  const ddx = G.X[target] - G.X[sq];
  const ddy = G.Y[target] - G.Y[sq];
  const rep = usesReplace(G, S, T, sq, c, code, false);
  for (const set of T.sets) {
    if (rep && !set.replace) continue;
    if (set.cond !== 0 && !setActive(G, S, set, sq, c, code, false)) continue;
    for (const st of set.steps) {
      if (!(st.mode & CAP)) continue;
      const dx = st.dx * sgn;
      const dy = st.dy * sgn;
      if (!st.ride) {
        if (dx === ddx && dy === ddy) return true;
        continue;
      }
      let k;
      if (dx !== 0) {
        if (ddx % dx !== 0) continue;
        k = ddx / dx;
        if (dy * k !== ddy) continue;
      } else {
        if (ddx !== 0 || dy === 0 || ddy % dy !== 0) continue;
        k = ddy / dy;
      }
      if (k < 1 || (st.range && k > st.range)) continue;
      const step = dy * G.W + dx;
      let blockers = 0;
      for (let i = 1; i < k; i++) if (b[sq + i * step] !== 0) blockers++;
      if (st.hop ? blockers === 1 : blockers === 0) return true;
    }
  }
  return false;
}

export function isAttacked(G, S, target, byColor) {
  const b = S.b;
  for (let sq = 0; sq < G.N; sq++) {
    const code = b[sq];
    if (code && ((code >> 6) & 1) === byColor && sq !== target && attacksSquare(G, S, sq, target)) return true;
  }
  return false;
}

// Todas as peças reais da cor existem e nenhuma está atacada
export function royalSafe(G, S, color) {
  if (!G.hasRoyal[color]) return true;
  const b = S.b;
  let found = 0;
  for (let sq = 0; sq < G.N; sq++) {
    const code = b[sq];
    if (code && ((code >> 6) & 1) === color && G.types[(code & 63) - 1].royal) {
      found++;
      if (isAttacked(G, S, sq, 1 - color)) return false;
    }
  }
  return found > 0;
}

export function inCheck(G, S, color) {
  if (G.royalMode !== 1 || !G.hasRoyal[color]) return false;
  const b = S.b;
  for (let sq = 0; sq < G.N; sq++) {
    const code = b[sq];
    if (code && ((code >> 6) & 1) === color && G.types[(code & 63) - 1].royal && isAttacked(G, S, sq, 1 - color)) return true;
  }
  return false;
}

function royalCount(G, S, color) {
  let n = 0;
  for (let sq = 0; sq < G.N; sq++) {
    const code = S.b[sq];
    if (code && ((code >> 6) & 1) === color && G.types[(code & 63) - 1].royal) n++;
  }
  return n;
}

// Verifica um lance já aplicado (N = estado depois do lance).
export function legalAfter(G, S, m, N) {
  if (G.royalMode !== 1 || !G.hasRoyal[S.turn]) return true;
  const me = S.turn;
  if (((m >> 22) & 3) === F_CASTLE) {
    const from = m & 255;
    const to = (m >> 8) & 255;
    if (G.types[(S.b[from] & 63) - 1].royal) {
      if (isAttacked(G, S, from, 1 - me)) return false;
      const mid = (from + to) >> 1;
      if (isAttacked(G, S, mid, 1 - me)) return false;
    }
  }
  if (N.res && N.res.w === me) return royalCount(G, N, me) > 0;
  return royalSafe(G, N, me);
}

export function legalMoves(G, S) {
  if (S.res) return [];
  const pseudo = genPseudo(G, S, []);
  let out = [];
  for (const m of pseudo) {
    const N = applyMove(G, S, m, false);
    if (legalAfter(G, S, m, N)) out.push(m);
  }
  if (G.forcedCapture) {
    const caps = out.filter((m) => isCapture(S, m));
    if (caps.length) out = caps;
  }
  if (S.ex && (S.ex.optional || out.length === 0)) out.push(PASS);
  return out;
}

// ---------------------------------------------------------------------------
// Aplicação de lances e gatilhos
// ---------------------------------------------------------------------------

function trigCondsHold(G, N, tr, ctx) {
  for (const cd of tr.conds) {
    switch (cd.type) {
      case 'notExtra':
        if (ctx.wasExtra) return false;
        break;
      case 'isExtra':
        if (!ctx.wasExtra) return false;
        break;
      case 'firstMove':
        if (!ctx.firstMove) return false;
        break;
      case 'hasTag':
        if (ctx.sq < 0 || !(N.tg[ctx.sq] & cd.bit)) return false;
        break;
      case 'noTag':
        if (ctx.sq >= 0 && N.tg[ctx.sq] & cd.bit) return false;
        break;
      case 'minRank':
        if (relRank(G, ctx.to, ctx.color) < cd.rank) return false;
        break;
      case 'enemyHalf':
        if (relRank(G, ctx.to, ctx.color) <= Math.ceil(G.H / 2)) return false;
        break;
      case 'ownHalf':
        if (relRank(G, ctx.to, ctx.color) > Math.floor(G.H / 2)) return false;
        break;
      case 'targetStronger':
        if (ctx.capType < 0 || !(G.types[ctx.capType].value > G.types[ctx.moverType].value)) return false;
        break;
      case 'targetWeaker':
        if (ctx.capType < 0 || !(G.types[ctx.capType].value < G.types[ctx.moverType].value)) return false;
        break;
      case 'transformed':
        if (!ctx.wasTransformed) return false;
        break;
      case 'notTransformed':
        if (ctx.wasTransformed) return false;
        break;
      default:
        return false;
    }
  }
  return true;
}

function removeAt(N, sq, log, why) {
  const code = N.b[sq];
  if (!code) return;
  if (log) log.push({ type: 'removed', sq, code, why });
  N.b[sq] = 0;
  N.tg[sq] = 0;
  N.tf[sq] = 0;
}

// Transforma a peça em ctx.sq, lembrando qual era a peça original
function transformAt(G, N, ctx, newT, ef, log) {
  const sq = ctx.sq;
  if (sq < 0) return;
  const oldT = (N.b[sq] & 63) - 1;
  if (oldT === newT) return;
  N.b[sq] = mk(newT, ctx.color, 1);
  if (log) log.push({ type: 'become', sq, from: oldT, to: newT });
  if (!G.usesTransform) return;
  const cur = N.tf[sq];
  const orig = cur ? (cur & 63) - 1 : oldT;
  if (orig === newT) N.tf[sq] = 0;
  else N.tf[sq] = (orig + 1) | (ef.backCode << 6) | ((ef.backCode === 3 ? Math.min(255, ef.turns + 1) : 0) << 8);
  ctx.transformed = true;
}

// Desfaz a transformação da peça em sq
function revertAt(N, sq, log) {
  const cur = N.tf[sq];
  const code = N.b[sq];
  N.tf[sq] = 0;
  if (!cur || !code) return;
  const orig = (cur & 63) - 1;
  const now = (code & 63) - 1;
  N.b[sq] = mk(orig, (code >> 6) & 1, 1);
  if (log) log.push({ type: 'revert', sq, from: now, to: orig });
}

// Fim da vez de uma cor: volta automática "no fim da vez" e contagem de lances
function endTurnFor(G, N, color, log) {
  if (!G.usesTransform) return;
  for (let sq = 0; sq < G.N; sq++) {
    const t = N.tf[sq];
    if (!t) continue;
    const code = N.b[sq];
    if (!code || ((code >> 6) & 1) !== color) continue;
    const mode = (t >> 6) & 3;
    if (mode === 1) revertAt(N, sq, log);
    else if (mode === 3) {
      const left = ((t >> 8) & 255) - 1;
      if (left <= 0) revertAt(N, sq, log);
      else N.tf[sq] = (t & 255) | (left << 8);
    }
  }
}

function applyEffect(G, N, ef, ctx, log) {
  const W = G.W;
  switch (ef.type) {
    case 'becomeCaptured':
      if (ctx.capType >= 0) transformAt(G, N, ctx, ctx.capType, ef, log);
      break;
    case 'become':
      transformAt(G, N, ctx, ef.t, ef, log);
      break;
    case 'revert':
      if (ctx.sq >= 0 && N.tf[ctx.sq]) revertAt(N, ctx.sq, log);
      break;
    case 'extraMove':
      ctx.extra = { same: ef.same, cap: ef.cap, optional: ef.optional };
      break;
    case 'explode': {
      const cx = G.X[ctx.to];
      const cy = G.Y[ctx.to];
      const r = ef.radius || 1;
      const hit = [];
      for (let dy = -r; dy <= r; dy++) {
        const ty = cy + dy;
        if (ty < 0 || ty >= G.H) continue;
        for (let dx = -r; dx <= r; dx++) {
          const tx = cx + dx;
          if (tx < 0 || tx >= W) continue;
          const sq = ty * W + tx;
          if (sq === ctx.to) continue;
          const code = N.b[sq];
          if (!code) continue;
          const T2 = G.types[(code & 63) - 1];
          const own = ((code >> 6) & 1) === ctx.color;
          if ((ef.side === 1 && own) || (ef.side === 2 && !own)) continue;
          if (ef.sparePawns && T2.pawn) continue;
          if (ef.spareRoyal && T2.royal) continue;
          hit.push(sq);
        }
      }
      if (log) log.push({ type: 'explode', sq: ctx.to, radius: r });
      hit.forEach((sq) => removeAt(N, sq, log, 'explode'));
      if (ef.self && ctx.sq === ctx.to) {
        removeAt(N, ctx.sq, log, 'explode');
        ctx.sq = -1;
      }
      break;
    }
    case 'removeSelf':
      if (ctx.sq >= 0) {
        removeAt(N, ctx.sq, log, 'self');
        ctx.sq = -1;
      }
      break;
    case 'leaveBehind':
      if (N.b[ctx.from] === 0) {
        N.b[ctx.from] = mk(ef.t, ctx.color, 1);
        N.tf[ctx.from] = 0;
        if (log) log.push({ type: 'spawn', sq: ctx.from, t: ef.t });
      }
      break;
    case 'recruit':
      if (ctx.capType >= 0 && !G.types[ctx.capType].royal && N.b[ctx.from] === 0) {
        N.b[ctx.from] = mk(ctx.capType, ctx.color, 1);
        N.tf[ctx.from] = 0;
        if (log) log.push({ type: 'spawn', sq: ctx.from, t: ctx.capType, recruit: true });
      }
      break;
    case 'addTag':
      if (ctx.sq >= 0 && !(N.tg[ctx.sq] & ef.bit)) {
        N.tg[ctx.sq] |= ef.bit;
        if (log) log.push({ type: 'tag', sq: ctx.sq, tag: ef.tag });
      }
      break;
    case 'removeTag':
      if (ctx.sq >= 0 && N.tg[ctx.sq] & ef.bit) {
        N.tg[ctx.sq] &= ~ef.bit;
        if (log) log.push({ type: 'untag', sq: ctx.sq, tag: ef.tag });
      }
      break;
    case 'win':
      ctx.win = true;
      break;
    case 'lose':
      ctx.lose = true;
      break;
    default:
      break;
  }
}

function countPieces(G, S, color) {
  let n = 0;
  for (let sq = 0; sq < G.N; sq++) {
    const code = S.b[sq];
    if (code && ((code >> 6) & 1) === color) n++;
  }
  return n;
}

// Aplica o lance m ao estado S e devolve um novo estado.
// log = true registra os eventos (capturas, transformações...) em N.ev para a interface.
export function applyMove(G, S, m, log = false) {
  const N = cloneState(G, S);
  const ev = log ? [] : null;
  N.ev = ev;
  const flag = (m >> 22) & 3;
  const me = S.turn;
  N.ex = null;
  if (flag === F_PASS) {
    N.turn = 1 - me;
    N.ply = S.ply + 1;
    if (ev) ev.push({ type: 'pass' });
    endTurnFor(G, N, me, ev);
    N.hash = computeHash(G, N);
    return N;
  }
  const from = m & 255;
  const to = (m >> 8) & 255;
  const promo = ((m >> 16) & 63) - 1;
  const b = N.b;
  const code = b[from];
  const moverType = (code & 63) - 1;
  const T = G.types[moverType];
  let capType = -1;
  let capSq = -1;

  if (flag === F_EP) {
    capSq = S.epV;
    capType = (b[capSq] & 63) - 1;
    if (ev) ev.push({ type: 'capture', sq: capSq, code: b[capSq] });
    b[capSq] = 0;
    N.tg[capSq] = 0;
    N.tf[capSq] = 0;
  } else if (b[to] !== 0) {
    capSq = to;
    capType = (b[to] & 63) - 1;
    if (ev) ev.push({ type: 'capture', sq: to, code: b[to] });
  }

  const tagsMoving = G.usesTags ? N.tg[from] : 0;
  b[to] = code | MOVED;
  b[from] = 0;
  if (G.usesTags) {
    N.tg[to] = tagsMoving;
    N.tg[from] = 0;
  }
  const prevTf = G.usesTransform ? N.tf[from] : 0;
  const prevBack = (prevTf >> 6) & 3;
  if (G.usesTransform) {
    N.tf[to] = N.tf[from];
    N.tf[from] = 0;
  }

  if (flag === F_CASTLE) {
    const dir = G.X[to] > G.X[from] ? 1 : -1;
    let rx = G.X[to] + dir;
    const y = G.Y[from];
    while (rx >= 0 && rx < G.W && b[y * G.W + rx] === 0) rx += dir;
    const rFrom = y * G.W + rx;
    const rTo = y * G.W + G.X[from] + dir;
    if (rx >= 0 && rx < G.W) {
      b[rTo] = b[rFrom] | MOVED;
      b[rFrom] = 0;
      if (G.usesTags) {
        N.tg[rTo] = N.tg[rFrom];
        N.tg[rFrom] = 0;
      }
      if (G.usesTransform) {
        N.tf[rTo] = N.tf[rFrom];
        N.tf[rFrom] = 0;
      }
      if (ev) ev.push({ type: 'castle', from: rFrom, to: rTo });
    }
  }

  if (promo >= 0) {
    b[to] = mk(promo, me, 1);
    N.tf[to] = 0;
    if (ev) ev.push({ type: 'promote', sq: to, t: promo });
  }

  const ctx = {
    from,
    to,
    sq: to,
    color: me,
    moverType,
    capType,
    capSq,
    wasExtra: !!S.ex,
    firstMove: !(code & MOVED),
    extra: null,
    win: false,
    lose: false,
    transformed: false,
    wasTransformed: prevTf !== 0,
  };

  const trs = G.triggers;
  for (let i = 0; i < trs.length; i++) {
    const tr = trs[i];
    if (tr.event === 0 && capType < 0) continue;
    if (tr.event === 1 && capType >= 0) continue;
    if (tr.pieceMask && !tr.pieceMask[moverType]) continue;
    if (tr.targetMask && !tr.targetMask[capType]) continue;
    if (tr.conds.length && !trigCondsHold(G, N, tr, ctx)) continue;
    for (const ef of tr.effects) applyEffect(G, N, ef, ctx, ev);
  }

  // volta automática "depois do próximo lance dela"
  if (prevBack === 2 && ctx.sq >= 0 && !ctx.transformed && N.tf[ctx.sq]) revertAt(N, ctx.sq, ev);

  // en passant: peão (ou peça com a marca de peão) que andou 2+ casas em linha reta
  N.ep = -1;
  N.epV = -1;
  if (T.pawn && flag === F_NORMAL && capType < 0 && ctx.sq === to && G.X[from] === G.X[to]) {
    const dyAbs = Math.abs(G.Y[to] - G.Y[from]);
    if (dyAbs >= 2) {
      N.ep = to + (me === 0 ? -G.W : G.W);
      N.epV = to;
    }
  }

  N.half = capType >= 0 || T.pawn ? 0 : S.half + 1;
  N.ply = S.ply + 1;

  // resultado imediato
  let res = null;
  if (ctx.lose) res = { w: 1 - me, r: 'rule' };
  else if (ctx.win) res = { w: me, r: 'rule' };
  if (!res && G.royalMode !== 0) {
    if (G.hasRoyal[me] && royalCount(G, N, me) === 0) res = { w: 1 - me, r: 'royalLost' };
    else if (G.hasRoyal[1 - me] && royalCount(G, N, 1 - me) === 0) res = { w: me, r: 'royalCaptured' };
  }
  if (!res && G.goal && ctx.sq >= 0) {
    const nt = (b[ctx.sq] & 63) - 1;
    if (!G.goal.pieces || G.goal.pieces[nt]) {
      const reached = G.goal.lastRank ? relRank(G, ctx.sq, me) === G.H : G.goal.mask[ctx.sq] === 1;
      if (reached) res = { w: me, r: 'goal' };
    }
  }
  if (!res && G.extinction !== 'off') {
    const mine = countPieces(G, N, me);
    const theirs = countPieces(G, N, 1 - me);
    if (G.extinction === 'loss') {
      if (theirs === 0) res = { w: me, r: 'extinct' };
      else if (mine === 0) res = { w: 1 - me, r: 'extinct' };
    } else {
      if (mine === 0) res = { w: me, r: 'emptied' };
      else if (theirs === 0) res = { w: 1 - me, r: 'emptied' };
    }
  }
  if (!res && G.fifty && N.half >= G.fifty * 2) res = { w: -1, r: 'fifty' };
  N.res = res;

  if (ctx.extra && !res && (!ctx.extra.same || ctx.sq >= 0)) {
    N.ex = { sq: ctx.extra.same ? ctx.sq : -1, same: ctx.extra.same, cap: ctx.extra.cap, optional: ctx.extra.optional };
    N.turn = me;
    if (ev) ev.push({ type: 'extra', sq: N.ex.sq });
  } else {
    N.turn = 1 - me;
    endTurnFor(G, N, me, ev);
  }

  N.hash = computeHash(G, N);
  return N;
}

// ---------------------------------------------------------------------------
// Situação da partida
// ---------------------------------------------------------------------------

// hist: lista de hashes das posições já ocorridas (incluindo a atual)
export function gameStatus(G, S, hist) {
  if (S.res) return { over: true, w: S.res.w, r: S.res.r, moves: [], check: false };
  const moves = legalMoves(G, S);
  const check = inCheck(G, S, S.turn);
  if (moves.length === 0) {
    if (check) return { over: true, w: 1 - S.turn, r: 'mate', moves, check };
    const st = G.stalemate;
    return { over: true, w: st === 'draw' ? -1 : st === 'loss' ? 1 - S.turn : S.turn, r: 'stalemate', moves, check };
  }
  if (G.repetition && hist && !S.ex) {
    let n = 0;
    for (const h of hist) if (h === S.hash) n++;
    if (n >= G.repetition) return { over: true, w: -1, r: 'repetition', moves: [], check };
  }
  if (S.ply >= MAX_PLY) return { over: true, w: -1, r: 'limit', moves: [], check };
  return { over: false, moves, check };
}

export const RESULT_TEXT = {
  mate: 'Xeque-mate',
  stalemate: 'Afogamento (sem lances)',
  royalCaptured: 'Rei capturado',
  royalLost: 'Rei perdido',
  goal: 'Objetivo alcançado',
  extinct: 'Sem peças no tabuleiro',
  emptied: 'Ficou sem peças',
  rule: 'Regra especial',
  fifty: 'Regra dos lances sem captura',
  repetition: 'Posição repetida',
  limit: 'Limite de lances',
  resign: 'Desistência',
};

// Texto curto do lance, por exemplo "Cb1-c3", "e4xd5", "O-O", "e7-e8=D"
export function moveText(G, S, m) {
  const flag = mFlag(m);
  if (flag === F_PASS) return 'passa';
  const from = mFrom(m);
  const to = mTo(m);
  if (flag === F_CASTLE) return G.X[to] > G.X[from] ? 'O-O' : 'O-O-O';
  const T = G.types[pType(S.b[from])];
  const cap = flag === F_EP || S.b[to] !== 0;
  let s = (T.pawn ? '' : T.id) + squareName(G, from) + (cap ? 'x' : '-') + squareName(G, to);
  const p = mPromo(m);
  if (p >= 0) s += '=' + G.types[p].id;
  return s;
}

export function moveKey(m) {
  return mFrom(m) + ':' + mTo(m) + ':' + mPromo(m) + ':' + mFlag(m);
}
