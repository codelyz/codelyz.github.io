// Descrições em português das regras, para o resumo da partida e para o editor.

export const nameOf = (rules, id) => {
  const p = rules.pieces.find((x) => x.id === id);
  return p ? p.name : id || '?';
};

export function listNames(rules, ids, any = 'qualquer peça') {
  if (!ids || !ids.length) return any;
  const all = rules.pieces.map((p) => p.id);
  const missing = all.filter((id) => !ids.includes(id));
  if (ids.length >= 3 && missing.length && missing.length <= 2) {
    return `${any} (menos ${joinOr(missing.map((id) => nameOf(rules, id)), 'e')})`;
  }
  return joinOr(ids.map((id) => nameOf(rules, id)));
}

function joinOr(list, word = 'ou') {
  if (list.length <= 1) return list.join('');
  return list.slice(0, -1).join(', ') + ` ${word} ` + list[list.length - 1];
}

export const WHEN_OPTIONS = [
  { value: 'firstMove', label: 'No primeiro lance da peça' },
  { value: 'moved', label: 'Depois que a peça já se moveu' },
  { value: 'enemyHalf', label: 'No campo do adversário' },
  { value: 'ownHalf', label: 'No próprio campo' },
  { value: 'minRank', label: 'A partir de uma fileira' },
  { value: 'hasTag', label: 'Quando a peça tem uma marca' },
  { value: 'noTag', label: 'Quando a peça não tem uma marca' },
  { value: 'nearFriend', label: 'Ao lado de uma peça aliada' },
  { value: 'extra', label: 'Só no lance extra' },
  { value: 'transformed', label: 'Enquanto está transformada' },
];

export const BACK_OPTIONS = [
  { value: 'never', label: 'não volta sozinha' },
  { value: 'endTurn', label: 'volta no fim da vez' },
  { value: 'nextMove', label: 'volta depois do próximo lance dela' },
  { value: 'turns', label: 'volta depois de alguns lances seus' },
];

export function setLabel(rules, set) {
  switch (set.when) {
    case 'always':
      return 'Sempre';
    case 'firstMove':
      return '1º lance';
    case 'moved':
      return 'Já se moveu';
    case 'enemyHalf':
      return 'Campo inimigo';
    case 'ownHalf':
      return 'Próprio campo';
    case 'minRank':
      return `Fileira ${set.rank}+`;
    case 'hasTag':
      return `Com "${set.tag}"`;
    case 'noTag':
      return `Sem "${set.tag}"`;
    case 'nearFriend':
      return set.piece ? `Ao lado de ${nameOf(rules, set.piece)}` : 'Ao lado de aliada';
    case 'extra':
      return 'Lance extra';
    case 'transformed':
      return 'Transformada';
    default:
      return set.when;
  }
}

export function setSentence(rules, set) {
  switch (set.when) {
    case 'always':
      return 'sempre';
    case 'firstMove':
      return 'no primeiro lance da peça';
    case 'moved':
      return 'depois que a peça já se moveu';
    case 'enemyHalf':
      return 'quando está no campo do adversário';
    case 'ownHalf':
      return 'quando está no próprio campo';
    case 'minRank':
      return `a partir da fileira ${set.rank}`;
    case 'hasTag':
      return `quando tem a marca "${set.tag}"`;
    case 'noTag':
      return `quando não tem a marca "${set.tag}"`;
    case 'nearFriend':
      return set.piece ? `quando está ao lado de ${nameOf(rules, set.piece)} aliado(a)` : 'quando está ao lado de uma peça aliada';
    case 'extra':
      return 'só no lance extra';
    case 'transformed':
      return 'enquanto está transformada';
    default:
      return set.when;
  }
}

const DIR8 = {
  '0,1': 'para frente',
  '0,-1': 'para trás',
  '1,0': 'para a direita',
  '-1,0': 'para a esquerda',
  '1,1': 'na diagonal frente-direita',
  '-1,1': 'na diagonal frente-esquerda',
  '1,-1': 'na diagonal trás-direita',
  '-1,-1': 'na diagonal trás-esquerda',
};

function offsetText(dx, dy) {
  const parts = [];
  if (dy) parts.push(`${Math.abs(dy)} ${dy > 0 ? 'para frente' : 'para trás'}`);
  if (dx) parts.push(`${Math.abs(dx)} ${dx > 0 ? 'à direita' : 'à esquerda'}`);
  return parts.join(' e ');
}

export const MODE_TEXT = { both: 'move e captura', move: 'só move', capture: 'só captura' };

export function stepLabel(st) {
  if (st.kind === 'leap') return `Salta ${offsetText(st.dx, st.dy)}`;
  const d = DIR8[`${st.dx},${st.dy}`];
  const base = d ? `Anda ${d}` : `Anda em saltos de ${offsetText(st.dx, st.dy)}`;
  const unit = d ? 'casa' : 'salto';
  const range = st.range ? `, até ${st.range} ${st.range === 1 ? unit : unit + 's'}` : ', até a borda';
  return base + range + (st.hop ? ', pulando uma peça' : '');
}

// Reconhece padrões conhecidos para um resumo curto ("como Torre + Cavalo")
const KEY = (st) => `${st.kind}:${st.dx},${st.dy}:${st.kind === 'ride' ? st.range || 0 : 1}:${st.mode}:${st.hop ? 1 : 0}`;
function lDirs(a, b) {
  const seen = new Set();
  return [[b, a], [a, b], [a, -b], [b, -a], [-b, -a], [-a, -b], [-a, b], [-b, a]].filter(([x, y]) => {
    const k = `${x},${y}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
const lKeys = (a, b) => lDirs(a, b).map(([dx, dy]) => `leap:${dx},${dy}:1:both:0`);

const PATTERNS = [
  { name: 'Dama', keys: [[0, 1], [1, 0], [0, -1], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]].map(([dx, dy]) => `ride:${dx},${dy}:0:both:0`) },
  { name: 'Torre', keys: [[0, 1], [1, 0], [0, -1], [-1, 0]].map(([dx, dy]) => `ride:${dx},${dy}:0:both:0`) },
  { name: 'Bispo', keys: [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([dx, dy]) => `ride:${dx},${dy}:0:both:0`) },
  { name: 'Rei', keys: [[0, 1], [1, 0], [0, -1], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]].map(([dx, dy]) => `leap:${dx},${dy}:1:both:0`) },
  { name: 'Cavalo', keys: [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]].map(([dx, dy]) => `leap:${dx},${dy}:1:both:0`) },
  { name: 'Camelo', keys: lKeys(3, 1) },
  { name: 'Zebra', keys: lKeys(3, 2) },
  { name: 'Girafa', keys: lKeys(4, 1) },
  { name: 'Cavalo em linha', keys: [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]].map(([dx, dy]) => `ride:${dx},${dy}:0:both:0`) },
  { phrase: 'anda 1 casa para frente, para trás ou para os lados', keys: [[0, 1], [1, 0], [0, -1], [-1, 0]].map(([dx, dy]) => `leap:${dx},${dy}:1:both:0`) },
  { phrase: 'anda 1 casa na diagonal', keys: [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([dx, dy]) => `leap:${dx},${dy}:1:both:0`) },
];

export function stepsSummary(steps) {
  if (!steps.length) return 'não se move';
  const keys = new Set(steps.map(KEY));
  const found = [];
  const phrases = [];
  for (const p of PATTERNS) {
    if (p.keys.every((k) => keys.has(k))) {
      if (p.name) found.push(p.name);
      else phrases.push(p.phrase);
      p.keys.forEach((k) => keys.delete(k));
    }
  }
  const pawnKeys = ['leap:0,1:1:move:0', 'leap:1,1:1:capture:0', 'leap:-1,1:1:capture:0'];
  if (pawnKeys.every((k) => keys.has(k))) {
    found.push('Peão');
    pawnKeys.forEach((k) => keys.delete(k));
  }
  // saltos simétricos sem nome (ex.: L de 4 + 3, 2 casas em linha reta)
  for (let a = 1; a <= 11; a++) {
    for (let b = 0; b <= a; b++) {
      const ks = lKeys(a, b);
      if (!ks.every((k) => keys.has(k))) continue;
      ks.forEach((k) => keys.delete(k));
      if (b === 0) phrases.push(`salta ${a} casas em linha reta (por cima das peças)`);
      else if (a === b) phrases.push(`salta ${a} casas na diagonal (por cima das peças)`);
      else phrases.push(`salta em L de ${a} + ${b}`);
    }
  }
  const seen = new Set();
  const rest = steps.filter((st) => {
    const k = KEY(st);
    if (!keys.has(k) || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  // agrupa linhas simétricas (4 diagonais ou 4 retas com o mesmo alcance)
  const groups = [
    { dirs: [[1, 1], [1, -1], [-1, 1], [-1, -1]], text: 'na diagonal' },
    { dirs: [[0, 1], [1, 0], [0, -1], [-1, 0]], text: 'em linha reta para qualquer lado' },
  ];
  let left = rest;
  for (const g of groups) {
    const tried = new Set();
    for (;;) {
      const first = left.find((st) => st.kind === 'ride' && !tried.has(st) && g.dirs.some(([x, y]) => st.dx === x && st.dy === y));
      if (!first) break;
      tried.add(first);
      const same = (st) => st.kind === 'ride' && (st.range || 0) === (first.range || 0) && st.mode === first.mode && !!st.hop === !!first.hop;
      const members = g.dirs.map(([x, y]) => left.find((st) => same(st) && st.dx === x && st.dy === y));
      if (members.some((m) => !m)) continue;
      left = left.filter((st) => !members.includes(st));
      const range = first.range ? `, até ${first.range} ${first.range === 1 ? 'casa' : 'casas'}` : '';
      phrases.push(`anda ${g.text}${range}${first.hop ? ', pulando uma peça' : ''}${first.mode !== 'both' ? ` (${MODE_TEXT[first.mode]})` : ''}`);
    }
  }
  const parts = [];
  if (found.length) parts.push('anda como ' + found.join(' + '));
  parts.push(...phrases);
  if (left.length && left.length <= 3) parts.push(...left.map(stepPhrase));
  else if (left.length) parts.push(`tem ${left.length} movimentos próprios`);
  return joinOr(parts, 'e');
}

function stepPhrase(st) {
  const s = stepLabel(st);
  return s[0].toLowerCase() + s.slice(1) + (st.mode !== 'both' ? ` (${MODE_TEXT[st.mode]})` : '');
}

export function pieceLines(rules, p) {
  const lines = [];
  p.moves.forEach((set) => {
    const sum = stepsSummary(set.steps);
    if (set.when === 'always') lines.push(`${capitalize(sum)}.`);
    else lines.push(`${capitalize(setSentence(rules, set))}, ${set.replace ? 'em vez disso, ' : 'também '}${sum}.`);
  });
  if (p.royal) lines.push(rules.victory.royal === 'capture' ? 'É o Rei: se for capturado, o jogador perde.' : rules.victory.royal === 'checkmate' ? 'É o Rei: não pode ficar em xeque.' : '');
  if (p.castling && rules.options.castling) lines.push('Pode fazer roque.');
  if (p.promotion && p.promotion.to.length) lines.push(`Na ${p.promotion.zone > 1 ? `zona das últimas ${p.promotion.zone} fileiras` : 'última fileira'} vira ${joinOr(p.promotion.to.map((id) => nameOf(rules, id)))}.`);
  if (p.pawn && rules.options.enPassant) lines.push('Pode capturar e ser capturado en passant.');
  return lines.filter(Boolean);
}

const capitalize = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export const EVENT_OPTIONS = [
  { value: 'capture', label: 'captura' },
  { value: 'quiet', label: 'se move sem capturar' },
  { value: 'any', label: 'faz qualquer lance' },
];

export const COND_OPTIONS = [
  { value: 'notExtra', label: 'não é um lance extra' },
  { value: 'isExtra', label: 'é um lance extra' },
  { value: 'firstMove', label: 'é o primeiro lance da peça' },
  { value: 'enemyHalf', label: 'a peça chegou ao campo do adversário' },
  { value: 'ownHalf', label: 'a peça está no próprio campo' },
  { value: 'minRank', label: 'a peça chegou a uma fileira' },
  { value: 'hasTag', label: 'a peça tem uma marca' },
  { value: 'noTag', label: 'a peça não tem uma marca' },
  { value: 'targetStronger', label: 'a capturada vale mais' },
  { value: 'targetWeaker', label: 'a capturada vale menos' },
  { value: 'transformed', label: 'a peça já estava transformada' },
  { value: 'notTransformed', label: 'a peça não estava transformada' },
];

export const EFFECT_OPTIONS = [
  { value: 'becomeCaptured', label: 'vira a peça capturada' },
  { value: 'become', label: 'vira outra peça' },
  { value: 'revert', label: 'volta a ser a peça original' },
  { value: 'extraMove', label: 'ganha um lance extra' },
  { value: 'explode', label: 'explode' },
  { value: 'removeSelf', label: 'sai do tabuleiro' },
  { value: 'leaveBehind', label: 'deixa uma peça para trás' },
  { value: 'recruit', label: 'recruta a capturada' },
  { value: 'addTag', label: 'ganha uma marca' },
  { value: 'removeTag', label: 'perde uma marca' },
  { value: 'win', label: 'o jogador vence' },
  { value: 'lose', label: 'o jogador perde' },
];

export function condText(rules, c) {
  switch (c.type) {
    case 'notExtra':
      return 'não for um lance extra';
    case 'isExtra':
      return 'for um lance extra';
    case 'firstMove':
      return 'for o primeiro lance da peça';
    case 'enemyHalf':
      return 'a peça terminar no campo do adversário';
    case 'ownHalf':
      return 'a peça terminar no próprio campo';
    case 'minRank':
      return `a peça chegar à fileira ${c.rank} ou além`;
    case 'hasTag':
      return `a peça tiver a marca "${c.tag}"`;
    case 'noTag':
      return `a peça não tiver a marca "${c.tag}"`;
    case 'targetStronger':
      return 'a capturada valer mais que a peça que capturou';
    case 'targetWeaker':
      return 'a capturada valer menos que a peça que capturou';
    case 'transformed':
      return 'a peça já estiver transformada';
    case 'notTransformed':
      return 'a peça não estiver transformada';
    default:
      return c.type;
  }
}

export function effectText(rules, e) {
  switch (e.type) {
    case 'becomeCaptured':
      return 'a peça vira a peça capturada' + backText(e);
    case 'become':
      return `a peça vira ${nameOf(rules, e.piece)}` + backText(e);
    case 'revert':
      return 'a peça volta a ser a original';
    case 'extraMove': {
      const who = e.same ? 'a mesma peça faz mais um lance' : 'o jogador faz mais um lance';
      const cap = e.capture === 'only' ? ', só capturando' : e.capture === 'none' ? ', sem capturar' : '';
      return who + cap + (e.optional ? ' (se quiser)' : ' (obrigatório)');
    }
    case 'explode': {
      const spare = [e.sparePawns ? 'os peões' : null, e.spareRoyal ? 'o Rei' : null].filter(Boolean);
      const whose = e.targets === 'enemy' ? 'as peças do adversário' : e.targets === 'own' ? 'as suas peças' : 'as peças';
      return `explode: somem ${whose} a ${e.radius === 1 ? '1 casa' : `até ${e.radius} casas`} de distância${spare.length ? `, menos ${spare.join(' e ')}` : ''}${e.self ? ', e a própria peça também' : ''}`;
    }
    case 'removeSelf':
      return 'a peça que se moveu sai do tabuleiro';
    case 'leaveBehind':
      return `aparece ${nameOf(rules, e.piece)} na casa de onde a peça saiu`;
    case 'recruit':
      return 'a capturada troca de lado e aparece na casa de onde a peça saiu';
    case 'addTag':
      return `a peça ganha a marca "${e.tag}"`;
    case 'removeTag':
      return `a peça perde a marca "${e.tag}"`;
    case 'win':
      return 'o jogador vence a partida';
    case 'lose':
      return 'o jogador perde a partida';
    default:
      return e.type;
  }
}

function backText(e) {
  if (e.back === 'endTurn') return ' (volta ao normal no fim da vez)';
  if (e.back === 'nextMove') return ' (volta ao normal depois do próximo lance dela)';
  if (e.back === 'turns') return ` (volta ao normal depois de ${e.turns} ${e.turns === 1 ? 'lance seu' : 'lances seus'})`;
  return '';
}

export function triggerSentence(rules, t) {
  const who = listNames(rules, t.pieces);
  let s = `Quando ${who} ${t.event === 'capture' ? 'captura' : t.event === 'quiet' ? 'se move sem capturar' : 'faz um lance'}`;
  if (t.event === 'capture' && t.targets.length) s += ` ${listNames(rules, t.targets)}`;
  if (t.conditions.length) s += `, se ${t.conditions.map((c) => condText(rules, c)).join(' e ')}`;
  s += ': ' + (t.effects.length ? t.effects.map((e) => effectText(rules, e)).join('; ') : 'nada acontece') + '.';
  return s;
}

export function victoryLines(rules) {
  const v = rules.victory;
  const o = rules.options;
  const lines = [];
  const royal = rules.pieces.filter((p) => p.royal).map((p) => p.name);
  if (v.royal === 'checkmate' && royal.length) lines.push(`Vence quem der xeque-mate. Peça que nunca pode ficar em xeque: ${joinOr(royal)}.`);
  else if (v.royal === 'capture' && royal.length) lines.push(`Vence quem capturar a peça ${joinOr(royal)} do adversário. Pode ficar em xeque, mas é arriscado.`);
  else lines.push('Não há Rei especial: nenhuma peça precisa ser protegida.');
  if (v.goal) {
    const who = listNames(rules, v.goal.pieces, 'qualquer peça');
    if (v.goal.mode === 'lastRank') lines.push(`Também vence quem levar ${who} até a última fileira.`);
    else if (v.goal.squares.length) lines.push(`Também vence quem levar ${who} a ${v.goal.squares.length === 1 ? 'esta casa' : 'uma destas casas'}: ${v.goal.squares.join(', ')}.`);
  }
  if (v.extinction === 'loss') lines.push('Quem ficar sem peças perde.');
  if (v.extinction === 'win') lines.push('Quem ficar sem peças vence.');
  lines.push(v.stalemate === 'draw' ? 'Sem lances possíveis e sem xeque: empate.' : v.stalemate === 'loss' ? 'Quem ficar sem lances possíveis perde.' : 'Quem ficar sem lances possíveis vence.');
  if (o.forcedCapture) lines.push('Capturar é obrigatório quando possível.');
  if (o.fiftyMove) lines.push(`Empate depois de ${o.fiftyMove} lances de cada lado sem captura nem lance de peão.`);
  if (o.repetition) lines.push(`Empate quando a mesma posição aparece ${o.repetition} vezes.`);
  return lines;
}
