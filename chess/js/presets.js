// Variantes prontas e modelos de movimento usados pelo editor.

export const ORTH = [[0, 1], [1, 0], [0, -1], [-1, 0]];
export const DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
export const KNIGHT = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];

// Salto em L com medidas quaisquer: anda "a" casas e vira "b" (as 8 direções)
export function lShape(a, b) {
  const seen = new Set();
  const out = [];
  for (const [x, y] of [[b, a], [a, b], [a, -b], [b, -a], [-b, -a], [-a, -b], [-a, b], [-b, a]]) {
    const k = `${x},${y}`;
    if ((x || y) && !seen.has(k)) {
      seen.add(k);
      out.push([x, y]);
    }
  }
  return out;
}
export const CAMEL = lShape(3, 1);
export const ZEBRA = lShape(3, 2);
export const GIRAFFE = lShape(4, 1);

export const ride = (dirs, range = 0, mode = 'both') => dirs.map(([dx, dy]) => (range ? { dx, dy, kind: 'ride', range, mode } : { dx, dy, kind: 'ride', mode }));
export const leap = (dirs, mode = 'both') => dirs.map(([dx, dy]) => ({ dx, dy, kind: 'leap', mode }));

// Modelos de movimento (botões "+ Torre", "+ Cavalo"...)
export const MOVE_TEMPLATES = {
  rook: { label: 'Torre', steps: () => ride(ORTH) },
  bishop: { label: 'Bispo', steps: () => ride(DIAG) },
  queen: { label: 'Dama', steps: () => ride([...ORTH, ...DIAG]) },
  knight: { label: 'Cavalo', steps: () => leap(KNIGHT) },
  king: { label: 'Rei', steps: () => leap([...ORTH, ...DIAG]) },
  camel: { label: 'Camelo (3 + 1)', steps: () => leap(CAMEL) },
  zebra: { label: 'Zebra (3 + 2)', steps: () => leap(ZEBRA) },
  giraffe: { label: 'Girafa (4 + 1)', steps: () => leap(GIRAFFE) },
  nightrider: { label: 'Cavalo em linha', steps: () => ride(KNIGHT) },
};

export function pawnMoves() {
  return [
    { when: 'always', steps: [...leap([[0, 1]], 'move'), ...leap([[1, 1], [-1, 1]], 'capture')] },
    { when: 'firstMove', steps: ride([[0, 1]], 2, 'move') },
  ];
}

// Peças do xadrez clássico (letras em português: R D T B C P)
export function classicPieces(promoTo = ['D', 'T', 'B', 'C']) {
  return [
    { id: 'R', name: 'Rei', icon: 'king', value: 0, royal: true, castling: true, moves: [{ when: 'always', steps: leap([...ORTH, ...DIAG]) }] },
    { id: 'D', name: 'Dama', icon: 'queen', value: 900, moves: [{ when: 'always', steps: ride([...ORTH, ...DIAG]) }] },
    { id: 'T', name: 'Torre', icon: 'rook', value: 500, castleRook: true, moves: [{ when: 'always', steps: ride(ORTH) }] },
    { id: 'B', name: 'Bispo', icon: 'bishop', value: 330, moves: [{ when: 'always', steps: ride(DIAG) }] },
    { id: 'C', name: 'Cavalo', icon: 'knight', value: 320, moves: [{ when: 'always', steps: leap(KNIGHT) }] },
    { id: 'P', name: 'Peão', icon: 'pawn', value: 100, pawn: true, promotion: { to: promoTo, zone: 1 }, moves: pawnMoves() },
  ];
}

export const CLASSIC_SETUP = 'tcbdrbct/pppppppp/8/8/8/8/PPPPPPPP/TCBDRBCT';

const base = (over) => ({
  format: 'xadrez-sob-medida',
  version: 1,
  board: { width: 8, height: 8 },
  pieces: classicPieces(),
  setup: CLASSIC_SETUP,
  victory: { royal: 'checkmate', stalemate: 'draw', extinction: 'off', goal: null },
  options: { castling: true, enPassant: true, forcedCapture: false, fiftyMove: 50, repetition: 3 },
  triggers: [],
  ...over,
});

export const PRESETS = [
  base({
    id: 'classico',
    name: 'Xadrez clássico',
    description: 'As regras de sempre, com roque, en passant e promoção. Bom ponto de partida para criar a sua variante.',
  }),
  base({
    id: 'vampiro',
    name: 'Xadrez vampiro',
    description: 'Quem captura vira a peça capturada e pode fazer mais um lance com ela. Se capturar de novo nesse lance extra, não ganha outro bônus nem se transforma outra vez. O Rei não se transforma.',
    triggers: [
      {
        event: 'capture',
        pieces: ['D', 'T', 'B', 'C', 'P'],
        targets: [],
        conditions: [{ type: 'notExtra' }],
        effects: [{ type: 'becomeCaptured' }, { type: 'extraMove', same: true, capture: 'any', optional: true }],
      },
    ],
  }),
  base({
    id: 'vampiro-temporario',
    name: 'Vampiro temporário',
    description: 'Como o xadrez vampiro, mas a transformação dura pouco: a peça vira a capturada só para fazer o lance extra e, no fim da vez, volta a ser o que era.',
    triggers: [
      {
        event: 'capture',
        pieces: ['D', 'T', 'B', 'C', 'P'],
        targets: [],
        conditions: [{ type: 'notExtra' }],
        effects: [{ type: 'becomeCaptured', back: 'endTurn' }, { type: 'extraMove', same: true, capture: 'any', optional: true }],
      },
    ],
  }),
  base({
    id: 'atomico',
    name: 'Xadrez atômico',
    description: 'Toda captura explode: somem a peça que capturou e as peças vizinhas dos dois lados, menos os peões. Explodir o Rei adversário vence a partida.',
    options: { castling: true, enPassant: true, forcedCapture: false, fiftyMove: 50, repetition: 3 },
    triggers: [
      {
        event: 'capture',
        pieces: [],
        targets: [],
        conditions: [],
        effects: [{ type: 'explode', radius: 1, self: true, sparePawns: true, spareRoyal: false }],
      },
    ],
  }),
  base({
    id: 'perde-ganha',
    name: 'Perde-ganha',
    description: 'Vence quem perder todas as peças primeiro. Capturar é obrigatório, o Rei é uma peça comum e o peão também pode virar Rei.',
    pieces: classicPieces(['D', 'T', 'B', 'C', 'R']).map((p) => (p.id === 'R' ? { ...p, royal: false, castling: false, value: null } : p)),
    victory: { royal: 'none', stalemate: 'win', extinction: 'win', goal: null },
    options: { castling: false, enPassant: true, forcedCapture: true, fiftyMove: 50, repetition: 3 },
  }),
  base({
    id: 'rei-da-colina',
    name: 'Rei da colina',
    description: 'Além do xeque-mate, vence quem levar o Rei a uma das quatro casas centrais.',
    victory: { royal: 'checkmate', stalemate: 'draw', extinction: 'off', goal: { mode: 'squares', pieces: ['R'], squares: ['d4', 'e4', 'd5', 'e5'] } },
  }),
  base({
    id: 'veteranos',
    name: 'Veteranos',
    description: 'Uma peça que captura ganha a marca "veterana" e passa a andar também como o Rei, uma casa para qualquer lado. Mostra como mudar movimentos em certas condições.',
    pieces: classicPieces().map((p) =>
      p.id === 'R'
        ? p
        : { ...p, moves: [...p.moves, { when: 'hasTag', tag: 'veterana', steps: leap([...ORTH, ...DIAG]) }] },
    ),
    triggers: [
      {
        event: 'capture',
        pieces: ['D', 'T', 'B', 'C', 'P'],
        targets: [],
        conditions: [{ type: 'noTag', tag: 'veterana' }],
        effects: [{ type: 'addTag', tag: 'veterana' }],
      },
    ],
  }),
  base({
    id: 'recrutamento',
    name: 'Recrutamento',
    description: 'A peça capturada troca de lado: ela aparece para quem capturou, na casa de onde a peça saiu.',
    triggers: [
      {
        event: 'capture',
        pieces: [],
        targets: [],
        conditions: [],
        effects: [{ type: 'recruit' }],
      },
    ],
  }),
  base({
    id: 'capablanca',
    name: 'Capablanca 10×8',
    description: 'Tabuleiro 10×8 com duas peças novas: o Arcebispo (Bispo + Cavalo) e o Marechal (Torre + Cavalo).',
    board: { width: 10, height: 8 },
    pieces: [
      ...classicPieces(['D', 'M', 'A', 'T', 'B', 'C']),
      { id: 'A', name: 'Arcebispo', icon: 'star', value: 800, moves: [{ when: 'always', steps: [...ride(DIAG), ...leap(KNIGHT)] }] },
      { id: 'M', name: 'Marechal', icon: 'shield', value: 870, moves: [{ when: 'always', steps: [...ride(ORTH), ...leap(KNIGHT)] }] },
    ],
    setup: 'tcabdrbmct/pppppppppp/10/10/10/10/PPPPPPPPPP/TCABDRBMCT',
  }),
  base({
    id: 'camelos',
    name: 'Camelos',
    description: 'Os cavalos dão lugar a camelos, que saltam num L mais longo: três casas para um lado e uma para o outro.',
    pieces: classicPieces().map((p) => (p.id === 'C' ? { ...p, name: 'Camelo', icon: 'camel', value: 290, moves: [{ when: 'always', steps: leap(CAMEL) }] } : p)),
  }),
  base({
    id: 'zoologico',
    name: 'Zoológico',
    description: 'Um exército de animais. O Leão é o rei, a Coruja anda como a Dama, o Elefante como a Torre e a Águia como o Bispo. Camelo, Zebra e Girafa saltam em L longos, e os Sapos são os peões.',
    pieces: [
      { id: 'L', name: 'Leão', icon: 'lion', value: 0, royal: true, castling: true, moves: [{ when: 'always', steps: leap([...ORTH, ...DIAG]) }] },
      { id: 'O', name: 'Coruja', icon: 'owl', value: 900, moves: [{ when: 'always', steps: ride([...ORTH, ...DIAG]) }] },
      { id: 'E', name: 'Elefante', icon: 'elephant', value: 500, castleRook: true, moves: [{ when: 'always', steps: ride(ORTH) }] },
      { id: 'A', name: 'Águia', icon: 'eagle', value: 330, moves: [{ when: 'always', steps: ride(DIAG) }] },
      { id: 'C', name: 'Camelo', icon: 'camel', value: 290, moves: [{ when: 'always', steps: leap(CAMEL) }] },
      { id: 'Z', name: 'Zebra', icon: 'zebra', value: 280, moves: [{ when: 'always', steps: leap(ZEBRA) }] },
      { id: 'G', name: 'Girafa', icon: 'giraffe', value: 350, moves: [{ when: 'always', steps: [...leap(GIRAFFE), ...leap([...ORTH, ...DIAG])] }] },
      { id: 'S', name: 'Sapo', icon: 'frog', value: 100, pawn: true, promotion: { to: ['O', 'E', 'A', 'C', 'Z', 'G'], zone: 1 }, moves: pawnMoves() },
    ],
    setup: 'ecaolgze/ssssssss/8/8/8/8/SSSSSSSS/ECAOLGZE',
  }),
  base({
    id: 'mini-6x6',
    name: 'Minixadrez 6×6',
    description: 'Partida rápida num tabuleiro 6×6, sem bispos, sem roque e com o peão andando só uma casa.',
    board: { width: 6, height: 6 },
    pieces: classicPieces(['D', 'T', 'C']).filter((p) => p.id !== 'B').map((p) =>
      p.id === 'P' ? { ...p, moves: [p.moves[0]] } : p.id === 'R' ? { ...p, castling: false } : p,
    ),
    setup: 'tcdrct/pppppp/6/6/PPPPPP/TCDRCT',
    options: { castling: false, enPassant: false, forcedCapture: false, fiftyMove: 50, repetition: 3 },
  }),
];

export const PRESET_IDS = PRESETS.map((p) => p.id);

// Exemplos para inserir no editor de regras especiais
export const TRIGGER_EXAMPLES = [
  {
    label: 'Vampiro',
    hint: 'Quem captura vira a capturada e ganha um lance',
    make: (ids) => ({
      event: 'capture',
      pieces: ids.nonRoyal,
      targets: [],
      conditions: [{ type: 'notExtra' }],
      effects: [{ type: 'becomeCaptured' }, { type: 'extraMove', same: true, capture: 'any', optional: true }],
    }),
  },
  {
    label: 'Voltar ao normal',
    hint: 'Peça transformada que captura de novo volta a ser a original',
    make: () => ({ event: 'capture', pieces: [], targets: [], conditions: [{ type: 'transformed' }], effects: [{ type: 'revert' }] }),
  },
  {
    label: 'Explosão',
    hint: 'Captura explode as peças vizinhas',
    make: () => ({
      event: 'capture',
      pieces: [],
      targets: [],
      conditions: [],
      effects: [{ type: 'explode', radius: 1, self: true, sparePawns: true, spareRoyal: false }],
    }),
  },
  {
    label: 'Kamikaze',
    hint: 'Quem captura também sai do tabuleiro',
    make: (ids) => ({ event: 'capture', pieces: ids.nonRoyal, targets: [], conditions: [], effects: [{ type: 'removeSelf' }] }),
  },
  {
    label: 'Recrutar',
    hint: 'A capturada troca de lado',
    make: () => ({ event: 'capture', pieces: [], targets: [], conditions: [], effects: [{ type: 'recruit' }] }),
  },
  {
    label: 'Captura dupla',
    hint: 'Depois de capturar, pode capturar de novo',
    make: (ids) => ({
      event: 'capture',
      pieces: ids.nonRoyal,
      targets: [],
      conditions: [{ type: 'notExtra' }],
      effects: [{ type: 'extraMove', same: true, capture: 'only', optional: true }],
    }),
  },
  {
    label: 'Promoção no meio',
    hint: 'Peão que chega ao campo inimigo vira outra peça',
    make: (ids) => ({
      event: 'any',
      pieces: ids.pawn ? [ids.pawn] : [],
      targets: [],
      conditions: [{ type: 'enemyHalf' }],
      effects: [{ type: 'become', piece: ids.strongest || ids.any }],
    }),
  },
];
