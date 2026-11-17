// Confere a geração de lances com as contagens "perft" conhecidas do xadrez.
import { compileRules, initialState, legalMoves, applyMove, parseSetup, computeHash, pType, pColor, relRank } from '../js/engine.js';
import { PRESETS } from '../js/presets.js';

const classic = PRESETS.find((p) => p.id === 'classico');

function perft(G, S, depth) {
  const moves = legalMoves(G, S);
  if (depth === 1) return moves.length;
  let n = 0;
  for (const m of moves) n += perft(G, applyMove(G, S, m), depth - 1);
  return n;
}

// Monta uma posição: marca como "já moveu" os peões fora da casa inicial
// e as peças indicadas (sem direito a roque).
function position(setup, turn, movedSquares = []) {
  const G = compileRules({ ...classic, setup });
  const S = initialState(G);
  for (let sq = 0; sq < G.N; sq++) {
    const c = S.b[sq];
    if (!c) continue;
    const T = G.types[pType(c)];
    if (T.pawn && relRank(G, sq, pColor(c)) !== 2) S.b[sq] = c | 128;
  }
  for (const name of movedSquares) {
    const x = 'abcdefgh'.indexOf(name[0]);
    const y = parseInt(name.slice(1), 10) - 1;
    S.b[y * 8 + x] |= 128;
  }
  S.turn = turn;
  S.hash = computeHash(G, S);
  return { G, S };
}

const cases = [
  { name: 'Inicial', setup: classic.setup, turn: 0, expect: [20, 400, 8902, 197281] },
  { name: 'Kiwipete', setup: 't3r2t/p1ppdpb1/bc2pcp1/3PC3/1p2P3/2C2D1p/PPPBBPPP/T3R2T', turn: 0, expect: [48, 2039, 97862] },
  { name: 'Posição 3', setup: '8/2p5/3p4/RP5t/1T3p1r/8/4P1P1/8', turn: 0, moved: ['a5', 'h4', 'b4', 'h5'], expect: [14, 191, 2812, 43238] },
  { name: 'Posição 4', setup: 't3r2t/Pppp1ppp/1b3cbC/cP6/BBP1P3/d4C2/Pp1P2PP/T2D1TR1', turn: 0, moved: ['g1', 'f1', 'a1'], expect: [6, 264, 9467] },
];

let ok = true;
for (const c of cases) {
  const { G, S } = position(c.setup, c.turn, c.moved || []);
  for (let d = 1; d <= c.expect.length; d++) {
    const t0 = Date.now();
    const n = perft(G, S, d);
    const good = n === c.expect[d - 1];
    if (!good) ok = false;
    console.log(`${good ? 'OK ' : 'ERRO'} ${c.name} profundidade ${d}: ${n} (esperado ${c.expect[d - 1]}) ${Date.now() - t0}ms`);
  }
}
process.exit(ok ? 0 : 1);
