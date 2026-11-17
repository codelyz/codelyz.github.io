// Testes do robô: vence um jogador aleatório e termina partidas em todas as variantes.
import { compileRules, initialState, applyMove, gameStatus, moveText, RESULT_TEXT } from '../js/engine.js';
import { Searcher } from '../js/ai.js';
import { PRESETS } from '../js/presets.js';

function playGame(G, players, maxPly = 300) {
  let S = initialState(G);
  const hist = [S.hash];
  const searchers = [new Searcher(G), new Searcher(G)];
  let totalNodes = 0, totalMs = 0, moves = 0;
  while (true) {
    const st = gameStatus(G, S, hist);
    if (st.over) return { w: st.w, r: st.r, ply: S.ply, nps: totalMs ? Math.round(totalNodes / totalMs * 1000) : 0 };
    if (S.ply >= maxPly) return { w: -1, r: 'cap', ply: S.ply };
    const p = players[S.turn];
    let m;
    if (p === 'random') m = st.moves[Math.floor(Math.random() * st.moves.length)];
    else {
      const t0 = Date.now();
      const r = searchers[S.turn].think(S, hist, p);
      totalMs += Date.now() - t0; totalNodes += r.nodes; moves++;
      m = r.move;
      if (!st.moves.includes(m)) throw new Error('robô escolheu lance ilegal: ' + moveText(G, S, m));
    }
    S = applyMove(G, S, m);
    hist.push(S.hash);
  }
}

const fast = { timeMs: 150, maxDepth: 3, noise: 0 };
let fails = 0;
// 1) robô contra aleatório no clássico
{
  const G = compileRules(PRESETS[0]);
  let wins = 0;
  for (let i = 0; i < 4; i++) {
    const r = playGame(G, i % 2 ? ['random', fast] : [fast, 'random']);
    const aiColor = i % 2 ? 1 : 0;
    if (r.w === aiColor) wins++;
    console.log(`Clássico jogo ${i + 1}: ${r.w === aiColor ? 'robô venceu' : 'robô não venceu'} (${RESULT_TEXT[r.r] || r.r}, ${r.ply} lances, ${r.nps} nós/s)`);
  }
  if (wins < 3) { fails++; console.log('ERRO robô venceu só', wins); }
}
// 2) robô contra robô em todas as variantes
for (const p of PRESETS) {
  const G = compileRules(p);
  const t0 = Date.now();
  const r = playGame(G, [fast, fast], 200);
  console.log(`${p.name}: ${r.w === -1 ? 'empate' : r.w === 0 ? 'brancas' : 'pretas'} (${RESULT_TEXT[r.r] || r.r}) em ${r.ply} lances, ${((Date.now() - t0) / 1000).toFixed(1)}s, ${r.nps || '?'} nós/s`);
}
// 3) encontra mate em 1
{
  const G = compileRules({ ...PRESETS[0], setup: 'r7/8/1R6/8/8/8/7D/8' });
  const S = initialState(G);
  const r = new Searcher(G).think(S, [S.hash], { timeMs: 500, maxDepth: 4, noise: 0 });
  const ok = moveText(G, S, r.move) === 'Dh2-h8' ;
  console.log(`${ok ? 'OK ' : 'ERRO'} mate em 1: ${moveText(G, S, r.move)} score ${r.score}`);
  if (!ok) fails++;
}
process.exit(fails ? 1 : 0);
