// Testes de comportamento das variantes prontas.
import { compileRules, initialState, legalMoves, applyMove, gameStatus, moveText, squareName, parseSquare, computeHash, pType, pColor, PASS, mFrom, mTo } from '../js/engine.js';
import { PRESETS } from '../js/presets.js';

const preset = (id) => PRESETS.find((p) => p.id === id);
let failures = 0;
function check(cond, msg) {
  console.log(`${cond ? 'OK ' : 'ERRO'} ${msg}`);
  if (!cond) failures++;
}

function setupGame(id, setup, turn = 0) {
  const rules = setup ? { ...preset(id), setup } : preset(id);
  const G = compileRules(rules);
  const S = initialState(G);
  S.turn = turn;
  S.hash = computeHash(G, S);
  return { G, S };
}
function find(G, S, from, to) {
  const f = parseSquare(from, G.W, G.H);
  const t = parseSquare(to, G.W, G.H);
  return legalMoves(G, S).find((m) => mFrom(m) === f && mTo(m) === t && m !== PASS);
}
function play(G, S, from, to) {
  const m = find(G, S, from, to);
  if (m === undefined) throw new Error(`lance ilegal ${from}-${to}`);
  return applyMove(G, S, m, true);
}
const pieceAt = (G, S, name) => {
  const c = S.b[parseSquare(name, G.W, G.H)];
  return c ? (pColor(c) ? G.types[pType(c)].id.toLowerCase() : G.types[pType(c)].id) : '.';
};

// --- Vampiro ---------------------------------------------------------------
{
  const { G, S } = setupGame('vampiro', 't3r3/8/8/3d4/8/4C3/8/4R3');
  let N = play(G, S, 'e3', 'd5');
  check(pieceAt(G, N, 'd5') === 'D', 'Vampiro: Cavalo que captura a Dama vira Dama');
  check(N.turn === 0 && N.ex && N.ex.same, 'Vampiro: ganha lance extra com a mesma peça');
  check(N.ev.some((e) => e.type === 'become'), 'Vampiro: evento de transformação registrado');
  const extra = legalMoves(G, N);
  check(extra.includes(PASS), 'Vampiro: lance extra é opcional (pode passar)');
  check(extra.filter((m) => m !== PASS).every((m) => mFrom(m) === parseSquare('d5', 8, 8)), 'Vampiro: só a peça que capturou pode jogar o lance extra');
  N = play(G, N, 'd5', 'a8');
  check(pieceAt(G, N, 'a8') === 'D', 'Vampiro: captura no lance extra não transforma de novo');
  check(N.turn === 1 && !N.ex, 'Vampiro: depois do lance extra a vez passa');
  const { G: G2, S: S2 } = setupGame('vampiro', '4r3/8/8/8/8/8/3d4/4R3');
  const kx = play(G2, S2, 'e1', 'd2');
  check(pieceAt(G2, kx, 'd2') === 'R' && kx.turn === 1, 'Vampiro: o Rei captura sem se transformar');
}

// --- Atômico ---------------------------------------------------------------
{
  const { G, S } = setupGame('atomico', '3cr3/8/8/8/8/8/8/3DR3');
  const N = play(G, S, 'd1', 'd8');
  check(N.res && N.res.w === 0 && N.res.r === 'royalCaptured', 'Atômico: explosão ao lado do Rei vence');
  check(pieceAt(G, N, 'd8') === '.' && pieceAt(G, N, 'e8') === '.', 'Atômico: quem captura e o vizinho somem');
  const { G: G2, S: S2 } = setupGame('atomico', '4r3/8/8/8/8/8/3c4/4R3');
  check(find(G2, S2, 'e1', 'd2') === undefined, 'Atômico: o Rei não pode capturar (explodiria a si mesmo)');
  const { G: G3, S: S3 } = setupGame('atomico', '4r3/8/8/8/8/8/3c4/3DR3');
  check(find(G3, S3, 'd1', 'd2') === undefined, 'Atômico: captura que explode o próprio Rei é ilegal');
  const { G: G4, S: S4 } = setupGame('atomico', '4r3/8/8/8/8/1p6/2c5/3D3R');
  const N4 = play(G4, S4, 'd1', 'c2');
  check(pieceAt(G4, N4, 'b3') === 'p' && pieceAt(G4, N4, 'c2') === '.', 'Atômico: peões vizinhos sobrevivem');
}

// --- Perde-ganha -----------------------------------------------------------
{
  const { G, S } = setupGame('perde-ganha', '8/8/8/3p4/4P3/8/8/R7');
  const moves = legalMoves(G, S);
  check(moves.length === 1 && moveText(G, S, moves[0]) === 'e4xd5', 'Perde-ganha: captura obrigatória');
  const { G: G2, S: S2 } = setupGame('perde-ganha', '8/8/8/3p4/4P3/8/8/8');
  const N = play(G2, S2, 'e4', 'd5');
  check(N.res && N.res.w === 1 && N.res.r === 'emptied', 'Perde-ganha: quem fica sem peças vence');
  const { G: G3, S: S3 } = setupGame('perde-ganha', '4r3/8/8/8/8/8/8/4D3');
  check(find(G3, S3, 'e1', 'e8') !== undefined, 'Perde-ganha: o Rei pode ser capturado');
}

// --- Rei da colina ---------------------------------------------------------
{
  const { G, S } = setupGame('rei-da-colina', '4r3/8/8/8/8/3R4/8/8');
  const N = play(G, S, 'd3', 'd4');
  check(N.res && N.res.w === 0 && N.res.r === 'goal', 'Rei da colina: Rei no centro vence');
}

// --- Veteranos -------------------------------------------------------------
{
  const { G, S } = setupGame('veteranos', '4r3/8/8/3p4/8/4C3/8/4R3');
  const before = legalMoves(G, S).length;
  const N = play(G, S, 'e3', 'd5');
  check(N.tg[parseSquare('d5', 8, 8)] !== 0, 'Veteranos: quem captura ganha a marca');
  const black = legalMoves(G, N);
  const N2 = applyMove(G, N, black.find((m) => moveText(G, N, m) === 'Re8-f8') ?? black[0]);
  const knightMoves = legalMoves(G, N2).filter((m) => mFrom(m) === parseSquare('d5', 8, 8)).map((m) => squareName(G, mTo(m)));
  check(knightMoves.includes('d6') && knightMoves.includes('e5'), 'Veteranos: Cavalo marcado anda também como Rei');
  check(before > 0, 'Veteranos: compila');
}

// --- Recrutamento ----------------------------------------------------------
{
  const { G, S } = setupGame('recrutamento', '4r3/8/8/3c4/8/4C3/8/4R3');
  const N = play(G, S, 'e3', 'd5');
  check(pieceAt(G, N, 'e3') === 'C' && pieceAt(G, N, 'd5') === 'C', 'Recrutamento: a capturada volta do seu lado na casa de origem');
}

// --- Capablanca e 6×6 ------------------------------------------------------
{
  const { G, S } = setupGame('capablanca');
  check(legalMoves(G, S).length === 28, `Capablanca: 28 lances iniciais (${legalMoves(G, S).length})`);
  const { G: G2, S: S2 } = setupGame('mini-6x6');
  check(legalMoves(G2, S2).length === 10, `6×6: 10 lances iniciais (${legalMoves(G2, S2).length})`);
}

// --- Xeque-mate, afogamento, repetição -------------------------------------
{
  const { G, S } = setupGame('classico', 'r7/8/8/2D5/8/8/8/R7');
  let N = play(G, S, 'c5', 'c7');
  let st = gameStatus(G, N, [N.hash]);
  check(st.over && st.w === -1 && st.r === 'stalemate', 'Clássico: afogamento é empate');
  const { G: G2, S: S2 } = setupGame('classico', 'r7/8/1R6/8/8/8/8/7D');
  N = play(G2, S2, 'h1', 'h8');
  st = gameStatus(G2, N, [N.hash]);
  check(st.over && st.w === 0 && st.r === 'mate', 'Clássico: xeque-mate');
  // repetição: cavalos indo e voltando
  const { G: G3, S: S3 } = setupGame('classico');
  let cur = S3;
  const hist = [cur.hash];
  const seq = [['g1', 'f3'], ['g8', 'f6'], ['f3', 'g1'], ['f6', 'g8'], ['g1', 'f3'], ['g8', 'f6'], ['f3', 'g1'], ['f6', 'g8']];
  for (const [a, b] of seq) {
    cur = play(G3, cur, a, b);
    hist.push(cur.hash);
  }
  st = gameStatus(G3, cur, hist);
  check(st.over && st.r === 'repetition', 'Clássico: tripla repetição empata');
}


// --- Voltar ao normal depois de transformar ---------------------------------
{
  const vamp = preset('vampiro');
  const withBack = (back, extra = {}) => ({
    ...vamp,
    triggers: [{ ...vamp.triggers[0], effects: [{ type: 'becomeCaptured', back, ...extra }, vamp.triggers[0].effects[1]] }],
  });
  const make = (rules, setup) => {
    const G = compileRules({ ...rules, setup });
    const S = initialState(G);
    return { G, S };
  };
  // fim da vez: joga o lance extra e volta
  let { G, S } = make(withBack('endTurn'), 't3r3/8/8/3d4/8/4C3/8/4R3');
  let N = play(G, S, 'e3', 'd5');
  check(pieceAt(G, N, 'd5') === 'D' && N.tf[parseSquare('d5', 8, 8)] !== 0, 'Volta no fim da vez: vira Dama e lembra o original');
  N = play(G, N, 'd5', 'd2');
  check(pieceAt(G, N, 'd2') === 'C' && N.ev.some((e) => e.type === 'revert'), 'Volta no fim da vez: depois do lance extra volta a ser Cavalo');
  // fim da vez: passando o lance extra também volta
  ({ G, S } = make(withBack('endTurn'), 't3r3/8/8/3d4/8/4C3/8/4R3'));
  N = play(G, S, 'e3', 'd5');
  N = applyMove(G, N, PASS, true);
  check(pieceAt(G, N, 'd5') === 'C' && N.turn === 1, 'Volta no fim da vez: passar o lance extra também desfaz');
  // depois do próximo lance dela
  ({ G, S } = make(withBack('nextMove'), 't3r3/8/8/3d4/8/4C3/8/4R3'));
  N = play(G, S, 'e3', 'd5');
  N = applyMove(G, N, PASS, true);
  check(pieceAt(G, N, 'd5') === 'D', 'Próximo lance: continua Dama depois de passar');
  N = play(G, N, 'e8', 'f8');
  N = play(G, N, 'd5', 'h5');
  check(pieceAt(G, N, 'h5') === 'C', 'Próximo lance: anda como Dama e depois volta a ser Cavalo');
  // depois de N lances
  ({ G, S } = make(withBack('turns', { turns: 2 }), 't3r3/8/8/3d4/8/4C3/8/4R3'));
  N = applyMove(G, play(G, S, 'e3', 'd5'), PASS, true);
  N = play(G, play(G, N, 'e8', 'f8'), 'e1', 'f1');
  check(pieceAt(G, N, 'd5') === 'D', 'N lances: ainda Dama depois de 1 lance');
  N = play(G, play(G, N, 'f8', 'e8'), 'f1', 'e1');
  check(pieceAt(G, N, 'd5') === 'C', 'N lances: volta depois de 2 lances');
  // por outra regra: transformada que captura de novo volta ao normal
  const byRule = {
    ...vamp,
    triggers: [
      { ...vamp.triggers[0], conditions: [{ type: 'notExtra' }, { type: 'notTransformed' }], effects: [{ type: 'becomeCaptured' }] },
      { event: 'capture', pieces: [], targets: [], conditions: [{ type: 'transformed' }], effects: [{ type: 'revert' }] },
    ],
  };
  ({ G, S } = make(byRule, 't3r3/8/8/3d4/8/4C3/8/4R3'));
  N = play(G, S, 'e3', 'd5');
  N = play(G, N, 'a8', 'a5');
  N = play(G, N, 'd5', 'a5');
  check(pieceAt(G, N, 'a5') === 'C', 'Por outra regra: ao capturar de novo, volta a ser Cavalo');
  // movimento só enquanto transformada
  const gr = compileRules({ ...vamp, setup: '4r3/8/8/8/8/8/8/R3C3', pieces: vamp.pieces.map((p) => (p.id === 'C' ? { ...p, moves: [...p.moves, { when: 'transformed', steps: [{ dx: 0, dy: 1, kind: 'ride', mode: 'both' }] }] } : p)) });
  check(gr.usesTransform, 'Condição de movimento "transformada" compila');
}

// --- Explosão só no adversário ----------------------------------------------
{
  const at = preset('atomico');
  const rules = { ...at, setup: '3cr3/8/8/8/8/8/8/3DR3', triggers: [{ ...at.triggers[0], effects: [{ ...at.triggers[0].effects[0], targets: 'enemy', self: false }] }] };
  const G = compileRules({ ...rules, setup: 'r7/8/8/8/2c5/2pT4/2B5/R7' });
  const S = initialState(G);
  const N = play(G, S, 'd3', 'c3');
  check(pieceAt(G, N, 'c4') === '.' && pieceAt(G, N, 'c2') === 'B' && pieceAt(G, N, 'c3') === 'T', 'Explosão só no adversário: poupa as suas peças e a que capturou');
}

// --- Camelos e Zoológico -----------------------------------------------------
{
  const { G, S } = setupGame('camelos');
  check(legalMoves(G, S).length === 20, `Camelos: 20 lances iniciais (${legalMoves(G, S).length})`);
  const c = legalMoves(G, S).filter((m) => mFrom(m) === parseSquare('b1', 8, 8)).map((m) => squareName(G, mTo(m))).sort().join(',');
  check(c === 'a4,c4', `Camelo em b1 salta para a4 e c4 (${c})`);
  const { G: G2, S: S2 } = setupGame('zoologico');
  check(legalMoves(G2, S2).length > 16, `Zoológico: compila e tem lances (${legalMoves(G2, S2).length})`);
}

console.log(failures ? `\n${failures} falha(s)` : '\nTodos os testes de variantes passaram');
process.exit(failures ? 1 : 0);
