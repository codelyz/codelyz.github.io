// Robô adversário: busca alfa-beta (negamax) com aprofundamento iterativo,
// busca de capturas (quiescência), tabela de transposição e ordenação de lances.
// Funciona com qualquer regra, porque só usa o motor para gerar e aplicar lances.
import { genPseudo, applyMove, legalMoves, legalAfter, isCapture, inCheck, mFrom, mTo, mPromo, mFlag, PASS, F_EP } from './engine.js';

const MATE = 1000000;
const MATE_LIMIT = MATE - 2000;
const INF = 2000000000;
const TIMEOUT = { timeout: true };
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export const LEVELS = {
  easy: { timeMs: 400, maxDepth: 2, noise: 150 },
  medium: { timeMs: 1300, maxDepth: 5, noise: 30 },
  hard: { timeMs: 3500, maxDepth: 40, noise: 0 },
};

function isLeaper(T) {
  return T.sets.some((s) => s.steps.some((st) => !st.ride && (Math.abs(st.dx) > 1 || Math.abs(st.dy) > 1)));
}

// Tabelas de posição, do ponto de vista das brancas (as pretas usam a casa espelhada)
function buildEval(G) {
  const { W, H, N } = G;
  const T = G.types.length;
  const pst = new Int16Array(T * N);
  const cx = (W - 1) / 2;
  const cy = (H - 1) / 2;
  const maxD = cx + cy || 1;
  for (let t = 0; t < T; t++) {
    const ty = G.types[t];
    const leaper = isLeaper(ty);
    for (let sq = 0; sq < N; sq++) {
      const x = sq % W;
      const y = Math.floor(sq / W);
      const d = Math.abs(x - cx) + Math.abs(y - cy);
      const central = ((maxD - d) / maxD) * 14;
      let v;
      if (ty.royal && G.royalMode === 1) {
        v = -y * 7 - (x === 0 || x === W - 1 ? 3 : 0);
      } else if (ty.pawn) {
        v = y * 5 + (cx - Math.abs(x - cx)) * 2;
        if (ty.promoTo.length) {
          const toGo = H - 1 - y;
          if (toGo <= 2) v += (3 - toGo) * 18;
        }
      } else {
        v = central * (leaper ? 1.5 : 1);
      }
      pst[t * N + sq] = Math.round(v);
    }
  }

  // Objetivo (Rei da colina, chegar à última fileira): quanto mais perto, melhor
  let goalW = null;
  let goalB = null;
  let goalPiece = null;
  if (G.goal) {
    goalPiece = new Uint8Array(T);
    for (let t = 0; t < T; t++) goalPiece[t] = !G.goal.pieces || G.goal.pieces[t] ? 1 : 0;
    goalW = new Int16Array(N);
    goalB = new Int16Array(N);
    const targets = [];
    if (!G.goal.lastRank) for (let sq = 0; sq < N; sq++) if (G.goal.mask[sq]) targets.push(sq);
    for (let sq = 0; sq < N; sq++) {
      const x = sq % W;
      const y = Math.floor(sq / W);
      if (G.goal.lastRank) {
        goalW[sq] = -(H - 1 - y) * 14;
        goalB[sq] = -y * 14;
      } else {
        let best = 99;
        for (const g of targets) best = Math.min(best, Math.max(Math.abs(g % W - x), Math.abs(Math.floor(g / W) - y)));
        goalW[sq] = goalB[sq] = -best * 14;
      }
    }
  }
  return { pst, goalW, goalB, goalPiece, invert: G.extinction === 'win' };
}

function evaluate(G, E, S) {
  const b = S.b;
  const N = G.N;
  const vals = G.evalValue;
  const pst = E.pst;
  let s = 0;
  for (let sq = 0; sq < N; sq++) {
    const c = b[sq];
    if (!c) continue;
    const t = (c & 63) - 1;
    if ((c & 64) === 0) {
      s += vals[t] + pst[t * N + sq];
      if (E.goalW && E.goalPiece[t]) s += E.goalW[sq];
    } else {
      s -= vals[t] + pst[t * N + (N - 1 - sq)];
      if (E.goalB && E.goalPiece[t]) s -= E.goalB[sq];
    }
  }
  if (E.invert) s = -s;
  return (S.turn === 0 ? s : -s) + 10;
}

export class Searcher {
  constructor(G) {
    this.G = G;
    this.E = buildEval(G);
    this.tt = new Map();
    this.history = new Int32Array(65536);
    this.killers = [];
    this.path = [];
    this.histSet = new Set();
    this.nodes = 0;
    this.deadline = 0;
  }

  evaluate(S) {
    return evaluate(this.G, this.E, S);
  }

  // Escolhe um lance. hist: hashes das posições já jogadas (para evitar repetição).
  think(S, hist, levelOrOpts) {
    const G = this.G;
    const level = typeof levelOrOpts === 'string' ? LEVELS[levelOrOpts] : { ...LEVELS.medium, ...(levelOrOpts || {}) };
    const start = now();
    this.deadline = start + level.timeMs;
    this.nodes = 0;
    this.histSet = new Set(hist || []);
    this.histSet.delete(S.hash);
    this.path = [];
    this.killers = [];
    this.history.fill(0);
    if (this.tt.size > 300000) this.tt.clear();

    const root = legalMoves(G, S);
    if (!root.length) return null;
    if (root.length === 1) return { move: root[0], score: 0, depth: 0, nodes: 0 };

    const pre = root.map((m) => this.orderScore(S, m, 0, -1));
    let order = root.map((_, i) => i).sort((a, b) => pre[b] - pre[a]);
    let best = root[order[0]];
    let bestScore = -INF;
    let depthDone = 0;
    let scores = null;

    for (let d = 1; d <= level.maxDepth; d++) {
      let r;
      try {
        r = this.searchRoot(S, root, order, d, level.noise);
      } catch (e) {
        if (e !== TIMEOUT) throw e;
        break;
      }
      best = r.best;
      bestScore = r.score;
      scores = r.scores;
      order = r.order;
      depthDone = d;
      if (Math.abs(bestScore) > MATE_LIMIT) break;
      if (now() - start > level.timeMs * 0.55) break;
    }

    if (level.noise > 0 && scores && Math.abs(bestScore) < MATE_LIMIT) {
      const cands = [];
      for (let i = 0; i < root.length; i++) if (scores[i] !== undefined && scores[i] >= bestScore - level.noise) cands.push(i);
      if (cands.length > 1) {
        const i = cands[Math.floor(Math.random() * cands.length)];
        return { move: root[i], score: scores[i], depth: depthDone, nodes: this.nodes };
      }
    }
    return { move: best, score: bestScore, depth: depthDone, nodes: this.nodes };
  }

  searchRoot(S, root, order, depth, noise) {
    const G = this.G;
    let best = root[order[0]];
    let bestScore = -INF;
    const scores = [];
    this.path.push(S.hash);
    for (const i of order) {
      const m = root[i];
      const N = applyMove(G, S, m, false);
      const a = bestScore === -INF ? -INF : noise ? bestScore - noise : bestScore;
      let sc;
      if (N.turn === S.turn) sc = this.negamax(N, depth - 1, a, INF, 1);
      else sc = -this.negamax(N, depth - 1, -INF, -a, 1);
      scores[i] = sc;
      if (sc > bestScore) {
        bestScore = sc;
        best = m;
      }
    }
    this.path.pop();
    const newOrder = order.slice().sort((x, y) => scores[y] - scores[x]);
    return { best, score: bestScore, scores, order: newOrder };
  }

  terminal(S, ply) {
    const w = S.res.w;
    if (w === -1) return 0;
    return w === S.turn ? MATE - ply : -(MATE - ply);
  }

  repeated(S) {
    if (!this.G.repetition || S.ex) return false;
    if (this.histSet.has(S.hash)) return true;
    const p = this.path;
    for (let i = p.length - 1; i >= 0; i--) if (p[i] === S.hash) return true;
    return false;
  }

  negamax(S, depth, alpha, beta, ply) {
    if ((++this.nodes & 1023) === 0 && now() > this.deadline) throw TIMEOUT;
    const G = this.G;
    if (S.res) return this.terminal(S, ply);
    if (this.repeated(S)) return 0;
    if (ply >= 64) return this.evaluate(S);

    const inChk = G.royalMode === 1 && inCheck(G, S, S.turn);
    if (inChk && ply < 24) depth++;
    if (depth <= 0) return this.quiesce(S, alpha, beta, ply, 0);

    const alpha0 = alpha;
    const key = S.hash;
    const e = this.tt.get(key);
    let ttMove = -1;
    if (e) {
      ttMove = e.m;
      if (e.d >= depth) {
        let s = e.s;
        if (s > MATE_LIMIT) s -= ply;
        else if (s < -MATE_LIMIT) s += ply;
        if (e.f === 0) return s;
        if (e.f === 1 && s >= beta) return s;
        if (e.f === 2 && s <= alpha) return s;
      }
    }

    let moves = genPseudo(G, S, []);
    let rest = null;
    if (G.forcedCapture) {
      const caps = moves.filter((m) => isCapture(S, m));
      if (caps.length) {
        rest = moves.filter((m) => !isCapture(S, m));
        moves = caps;
      }
    }
    if (S.ex && S.ex.optional) moves.push(PASS);

    let best = -INF;
    let bestMove = -1;
    let legal = 0;
    this.path.push(key);
    for (let pass = 0; pass < 2; pass++) {
      const n = moves.length;
      const sc0 = new Int32Array(n);
      for (let i = 0; i < n; i++) sc0[i] = this.orderScore(S, moves[i], ply, ttMove);
      for (let i = 0; i < n; i++) {
        let bi = i;
        for (let j = i + 1; j < n; j++) if (sc0[j] > sc0[bi]) bi = j;
        if (bi !== i) {
          const tm = moves[i];
          moves[i] = moves[bi];
          moves[bi] = tm;
          const ts = sc0[i];
          sc0[i] = sc0[bi];
          sc0[bi] = ts;
        }
        const m = moves[i];
        const N = applyMove(G, S, m, false);
        if (m !== PASS && G.royalMode === 1 && !legalAfter(G, S, m, N)) continue;
        legal++;
        const quiet = m !== PASS && !isCapture(S, m) && mPromo(m) < 0;
        const reduce = depth >= 3 && legal > 4 && !inChk && quiet ? (legal > 12 ? 2 : 1) : 0;
        let sc;
        if (N.turn === S.turn) {
          sc = this.negamax(N, depth - 1 - reduce, alpha, beta, ply + 1);
          if (reduce && sc > alpha) sc = this.negamax(N, depth - 1, alpha, beta, ply + 1);
        } else {
          sc = -this.negamax(N, depth - 1 - reduce, -beta, -alpha, ply + 1);
          if (reduce && sc > alpha) sc = -this.negamax(N, depth - 1, -beta, -alpha, ply + 1);
        }
        if (sc > best) {
          best = sc;
          bestMove = m;
        }
        if (sc > alpha) alpha = sc;
        if (alpha >= beta) {
          if (quiet) {
            const k = this.killers[ply] || (this.killers[ply] = [-1, -1]);
            if (k[0] !== m) {
              k[1] = k[0];
              k[0] = m;
            }
            const hi = (mFrom(m) << 8) | mTo(m);
            this.history[hi] = Math.min(600000, this.history[hi] + depth * depth);
          }
          break;
        }
      }
      if (legal > 0 || !rest) break;
      moves = rest;
      rest = null;
    }
    this.path.pop();

    if (legal === 0) {
      if (S.ex) {
        const N = applyMove(G, S, PASS, false);
        return N.turn === S.turn ? this.negamax(N, depth - 1, alpha, beta, ply + 1) : -this.negamax(N, depth - 1, -beta, -alpha, ply + 1);
      }
      if (inChk) return -(MATE - ply);
      const st = G.stalemate;
      return st === 'draw' ? 0 : st === 'loss' ? -(MATE - ply) : MATE - ply;
    }

    let s = best;
    if (s > MATE_LIMIT) s += ply;
    else if (s < -MATE_LIMIT) s -= ply;
    this.tt.set(key, { d: depth, s, f: best <= alpha0 ? 2 : best >= beta ? 1 : 0, m: bestMove });
    return best;
  }

  quiesce(S, alpha, beta, ply, qd) {
    if ((++this.nodes & 1023) === 0 && now() > this.deadline) throw TIMEOUT;
    const G = this.G;
    if (S.res) return this.terminal(S, ply);
    const stand = this.evaluate(S);
    if (qd >= 8 || ply >= 80) return stand;
    const forced = G.forcedCapture;
    if (!forced) {
      if (stand >= beta) return stand;
      if (stand > alpha) alpha = stand;
    }
    const moves = genPseudo(G, S, [], true);
    if (!moves.length) return stand;
    const n = moves.length;
    const sc0 = new Int32Array(n);
    for (let i = 0; i < n; i++) sc0[i] = this.orderScore(S, moves[i], ply, -1);
    let best = forced ? -INF : stand;
    let any = false;
    for (let i = 0; i < n; i++) {
      let bi = i;
      for (let j = i + 1; j < n; j++) if (sc0[j] > sc0[bi]) bi = j;
      if (bi !== i) {
        const tm = moves[i];
        moves[i] = moves[bi];
        moves[bi] = tm;
        const ts = sc0[i];
        sc0[i] = sc0[bi];
        sc0[bi] = ts;
      }
      const m = moves[i];
      const N = applyMove(G, S, m, false);
      if (G.royalMode === 1 && !legalAfter(G, S, m, N)) continue;
      any = true;
      const sc = N.turn === S.turn ? this.quiesce(N, alpha, beta, ply + 1, qd + 1) : -this.quiesce(N, -beta, -alpha, ply + 1, qd + 1);
      if (sc > best) best = sc;
      if (sc > alpha) alpha = sc;
      if (alpha >= beta) break;
    }
    if (forced && !any) return stand;
    return best;
  }

  orderScore(S, m, ply, ttMove) {
    if (m === ttMove) return 100000000;
    if (m === PASS) return -1000;
    const G = this.G;
    const vals = G.evalValue;
    const from = mFrom(m);
    const to = mTo(m);
    const victim = mFlag(m) === F_EP ? S.b[S.epV] : S.b[to];
    let s = 0;
    if (victim) {
      const vt = (victim & 63) - 1;
      const at = (S.b[from] & 63) - 1;
      s = 10000000 + vals[vt] * 16 - (vals[at] >> 4);
      if (G.extinction === 'win') s = 10000000 - vals[vt] + (vals[at] >> 2);
    }
    const p = mPromo(m);
    if (p >= 0) s += 9000000 + vals[p];
    if (s) return s;
    const k = this.killers[ply];
    if (k) {
      if (k[0] === m) return 8000000;
      if (k[1] === m) return 7999999;
    }
    return this.history[(from << 8) | to];
  }
}
