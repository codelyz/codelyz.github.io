// Desenhos das peças (SVG próprio, viewBox 100×100).
// Classes: b = corpo, dl = detalhe em linha, df = detalhe preenchido.

const BASE = '<rect class="b" x="22" y="80" width="56" height="11" rx="4"/>';

export const ICONS = {
  king: {
    group: 'classic',
    label: 'Rei',
    body:
      '<path class="b" d="M46 8h8v7h7v7h-7v9h-8v-9h-7v-7h7z"/>' +
      '<path class="b" d="M27 40C38 31 62 31 73 40L66 68H34Z"/>' +
      '<rect class="b" x="31" y="68" width="38" height="9" rx="3"/>' +
      BASE,
  },
  queen: {
    group: 'classic',
    label: 'Dama',
    body:
      '<path class="b" d="M20 34L32 67H68L80 34L64 50L62 28L54 48L50 22L46 48L38 28L36 50Z"/>' +
      '<circle class="b" cx="20" cy="31" r="4.5"/><circle class="b" cx="38" cy="25" r="4.5"/><circle class="b" cx="50" cy="18" r="5"/><circle class="b" cx="62" cy="25" r="4.5"/><circle class="b" cx="80" cy="31" r="4.5"/>' +
      '<rect class="b" x="30" y="67" width="40" height="10" rx="3"/>' +
      BASE,
  },
  rook: {
    group: 'classic',
    label: 'Torre',
    body:
      '<path class="b" d="M28 13h10v8h7v-8h10v8h7v-8h10v21H28z"/>' +
      '<rect class="b" x="31" y="34" width="38" height="7" rx="2"/>' +
      '<path class="b" d="M35 41h30l3 39H32z"/>' +
      BASE,
  },
  bishop: {
    group: 'classic',
    label: 'Bispo',
    body:
      '<circle class="b" cx="50" cy="12" r="5"/>' +
      '<path class="b" d="M50 18C61 26 68 36 68 46C68 54 61 59 50 59C39 59 32 54 32 46C32 36 39 26 50 18Z"/>' +
      '<path class="dl" d="M57 30L46 44"/>' +
      '<rect class="b" x="35" y="59" width="30" height="7" rx="3"/>' +
      '<path class="b" d="M39 66h22l5 14H34z"/>' +
      BASE,
  },
  knight: {
    group: 'classic',
    label: 'Cavalo',
    body:
      '<path class="b" d="M30 80L34 61C28 59 23 56 21 51C19 46 21 42 25 40L41 25L44 11L51 20C67 22 77 36 76 54C75 65 72 73 70 80Z"/>' +
      '<path class="dl" d="M56 25C66 31 71 43 70 57"/>' +
      '<circle class="df" cx="41" cy="33" r="2.8"/>' +
      '<circle class="df" cx="26" cy="46" r="1.7"/>' +
      BASE,
  },
  pawn: {
    group: 'classic',
    label: 'Peão',
    body:
      '<circle class="b" cx="50" cy="27" r="13"/>' +
      '<rect class="b" x="36" y="42" width="28" height="7" rx="3"/>' +
      '<path class="b" d="M39 49h22l7 31H32z"/>' +
      BASE,
  },
  star: {
    label: 'Estrela',
    body: '<path class="b" d="M50 14L57.4 33.9L78.5 34.7L61.9 47.9L67.6 68.3L50 56.5L32.4 68.3L38.1 47.9L21.5 34.7L42.6 33.9Z"/><rect class="b" x="36" y="70" width="28" height="10" rx="3"/>' + BASE,
  },
  shield: {
    label: 'Escudo',
    body: '<path class="b" d="M50 12L75 21V43C75 60 64 70 50 77C36 70 25 60 25 43V21Z"/><path class="dl" d="M50 21V68M33 34H67"/>' + BASE,
  },
  diamond: {
    label: 'Losango',
    body: '<path class="b" d="M50 10L73 44L50 78L27 44Z"/><path class="dl" d="M27 44H73M50 10V78"/>' + BASE,
  },
  bolt: {
    label: 'Raio',
    body: '<path class="b" d="M58 9L29 48H47L40 79L71 37H53Z"/>' + BASE,
  },
  moon: {
    label: 'Lua',
    body: '<path class="b" d="M48.1 16A30 30 0 1 0 75.8 57.4A25 25 0 1 1 48.1 16Z"/>' + BASE,
  },
  flame: {
    label: 'Chama',
    body:
      '<path class="b" d="M50 9C58 23 72 31 70 52C68 68 58 77 50 77C40 77 30 68 30 54C30 42 38 36 41 24C45 32 47 36 51 38C54 30 53 20 50 9Z"/>' +
      '<path class="df" d="M50 48C55 54 58 60 55 66C53 70 47 70 45 66C42 60 46 55 50 48Z"/>' +
      BASE,
  },
  bat: {
    label: 'Morcego',
    group: 'animal',
    body:
      '<path class="b" d="M50 33C47 28 45 26 43 28C41 22 37 20 31 22C29 30 23 32 14 30C18 40 18 49 14 57C22 53 31 55 37 61C41 55 46 55 50 62C54 55 59 55 63 61C69 55 78 53 86 57C82 49 82 40 86 30C77 32 71 30 69 22C63 20 59 22 57 28C55 26 53 28 50 33Z"/>' +
      '<path class="b" d="M44 30L46 21L49 28M56 30L54 21L51 28"/>' +
      '<rect class="b" x="38" y="68" width="24" height="12" rx="3"/>' +
      BASE,
  },
  hexagon: {
    label: 'Hexágono',
    body: '<path class="b" d="M50 13L76 28V58L50 73L24 58V28Z"/><path class="dl" d="M50 13V43M24 58L50 43L76 58"/>' + BASE,
  },
  eye: {
    label: 'Olho',
    body: '<path class="b" d="M13 45C28 24 72 24 87 45C72 66 28 66 13 45Z"/><circle class="df" cx="50" cy="45" r="10"/><rect class="b" x="38" y="66" width="24" height="14" rx="3"/>' + BASE,
  },
  arrow: {
    label: 'Seta',
    body: '<path class="b" d="M50 9L77 40H61V80H39V40H23Z"/>' + BASE,
  },
  crown: {
    label: 'Coroa',
    body: '<path class="b" d="M24 32L32 68H68L76 32L62 48L50 24L38 48Z"/><circle class="b" cx="24" cy="29" r="4.5"/><circle class="b" cx="50" cy="20" r="5"/><circle class="b" cx="76" cy="29" r="4.5"/><rect class="b" x="31" y="68" width="38" height="10" rx="3"/>' + BASE,
  },
  cannon: {
    label: 'Canhão',
    body:
      '<path class="b" d="M16 54L66 28C71 25 76 27 78 32C80 37 77 41 72 43L24 66Z"/>' +
      '<circle class="b" cx="36" cy="63" r="13"/><circle class="df" cx="36" cy="63" r="3.2"/>' +
      BASE,
  },
  // ---------------------------------------------------------------- animais
  camel: {
    label: 'Camelo',
    group: 'animal',
    body:
      '<path class="b" d="M13 31C13 26 17 22 22 22L24 17L27 22C30 24 31 29 31 35L34 41C36 31 40 23 45 23C50 23 51 33 54 35C57 33 59 23 65 23C72 23 77 33 80 41L85 47L81 50L80 80H73L71 59H42L40 80H33L31 52C26 48 24 42 22 36L14 35Z"/>' +
      '<circle class="df" cx="21" cy="27" r="2"/>' +
      BASE,
  },
  zebra: {
    label: 'Zebra',
    group: 'animal',
    body:
      '<path class="b" d="M30 80L34 61C28 59 23 56 21 51C19 46 21 42 25 40L41 25L44 11L51 20C67 22 77 36 76 54C75 65 72 73 70 80Z"/>' +
      '<path class="dl" d="M47 29L55 24M48 41L66 30M49 53L73 42M50 65L75 57M51 76L71 71"/>' +
      '<path class="dl" d="M52 21C62 22 70 30 74 40"/>' +
      '<circle class="df" cx="38" cy="34" r="2.6"/>' +
      BASE,
  },
  elephant: {
    label: 'Elefante',
    group: 'animal',
    body:
      '<path class="b" d="M40 17C52 9 72 13 77 29C79 40 75 52 70 58V80H41L43 64C40 61 38 57 36 54C36 62 36 70 32 76C28 80 21 78 21 72C21 67 26 67 27 70C29 64 28 50 28 42C28 31 32 22 40 17Z"/>' +
      '<path class="b" d="M51 25C63 20 77 28 76 43C75 54 64 59 55 53C52 45 50 35 51 25Z"/>' +
      '<path class="dl" d="M36 50C38 56 44 58 49 56"/>' +
      '<circle class="df" cx="43" cy="31" r="2.6"/>' +
      BASE,
  },
  lion: {
    label: 'Leão',
    group: 'animal',
    body:
      '<path class="b" d="M50.0 12.0 L55.6 19.6 L63.9 15.2 L65.6 24.5 L75.0 24.0 L72.5 33.2 L81.2 36.9 L75.0 44.0 L81.2 51.1 L72.5 54.8 L75.0 64.0 L65.6 63.5 L63.9 72.8 L55.6 68.4 L50.0 76.0 L44.4 68.4 L36.1 72.8 L34.4 63.5 L25.0 64.0 L27.5 54.8 L18.8 51.1 L25.0 44.0 L18.8 36.9 L27.5 33.2 L25.0 24.0 L34.4 24.5 L36.1 15.2 L44.4 19.6Z"/>' +
      '<circle class="b" cx="50" cy="45" r="17"/>' +
      '<circle class="df" cx="43.5" cy="41" r="2.5"/><circle class="df" cx="56.5" cy="41" r="2.5"/>' +
      '<path class="df" d="M46 48H54L50 53Z"/>' +
      '<path class="dl" d="M50 53C49 57 45 58 42 56M50 53C51 57 55 58 58 56"/>' +
      '<rect class="b" x="38" y="72" width="24" height="8" rx="2"/>' +
      BASE,
  },
  giraffe: {
    label: 'Girafa',
    group: 'animal',
    body:
      '<path class="b" d="M21 23C23 17 31 15 37 16L38 8H42L41 16H44L45 8H49L48 18C52 22 52 28 50 32L63 72L71 80H40L45 72L38 38C34 37 30 35 26 33C20 33 18 28 21 23Z"/>' +
      '<circle class="df" cx="34" cy="22" r="2.2"/>' +
      '<circle class="df" cx="47" cy="47" r="3.2"/><circle class="df" cx="53" cy="58" r="3.4"/><circle class="df" cx="47" cy="66" r="2.8"/><circle class="df" cx="44" cy="37" r="2.4"/>' +
      BASE,
  },
  owl: {
    label: 'Coruja',
    group: 'animal',
    body:
      '<path class="b" d="M28 27L33 12L42 22C47 20 53 20 58 22L67 12L72 27C78 37 78 52 74 62C70 72 61 78 50 78C39 78 30 72 26 62C22 52 22 37 28 27Z"/>' +
      '<circle class="dl" cx="40" cy="39" r="8"/><circle class="dl" cx="60" cy="39" r="8"/>' +
      '<circle class="df" cx="40" cy="39" r="3.4"/><circle class="df" cx="60" cy="39" r="3.4"/>' +
      '<path class="df" d="M46 48H54L50 55Z"/>' +
      '<path class="dl" d="M31 54C35 63 41 68 46 70M69 54C65 63 59 68 54 70"/>' +
      BASE,
  },
  eagle: {
    label: 'Águia',
    group: 'animal',
    body:
      '<path class="b" d="M13 46C13 38 19 32 28 30C34 21 46 15 58 17C71 19 79 30 79 44C79 56 73 66 71 80H37C41 70 44 62 44 55L36 53C31 55 25 55 22 51C19 51 16 50 13 46Z"/>' +
      '<path class="dl" d="M27 42L37 44M38 30L55 27M51 63L59 56M55 73L65 65"/>' +
      '<circle class="df" cx="46" cy="34" r="3"/>' +
      BASE,
  },
  snake: {
    label: 'Cobra',
    group: 'animal',
    body:
      '<ellipse class="b" cx="50" cy="72" rx="29" ry="8"/>' +
      '<ellipse class="b" cx="51" cy="62" rx="20" ry="6.5"/>' +
      '<path class="b" d="M55 60C59 50 60 44 58 37C64 33 66 24 62 18C58 12 50 12 46 16C42 22 42 30 48 36C48 44 46 52 42 60Z"/>' +
      '<circle class="df" cx="50" cy="23" r="2"/><circle class="df" cx="57" cy="23" r="2"/>' +
      '<path class="dl" d="M48 30C51 32 55 32 58 30"/>' +
      BASE,
  },
  frog: {
    label: 'Sapo',
    group: 'animal',
    body:
      '<path class="b" d="M20 66C16 52 24 41 34 37C30 29 34 21 42 22C46 23 48 28 48 32H52C52 28 54 23 58 22C66 21 70 29 66 37C76 41 84 52 80 66C78 74 66 78 50 78C34 78 22 74 20 66Z"/>' +
      '<circle class="df" cx="41" cy="29" r="3.2"/><circle class="df" cx="59" cy="29" r="3.2"/>' +
      '<path class="dl" d="M35 52C43 59 57 59 65 52"/>' +
      '<path class="dl" d="M27 70L22 77M73 70L78 77"/>' +
      BASE,
  },
  rabbit: {
    label: 'Coelho',
    group: 'animal',
    body:
      '<path class="b" d="M37 40C31 26 31 10 37 6C43 4 47 18 46 38Z"/>' +
      '<path class="b" d="M63 40C69 26 69 10 63 6C57 4 53 18 54 38Z"/>' +
      '<rect class="b" x="40" y="68" width="20" height="12" rx="2"/>' +
      '<ellipse class="b" cx="50" cy="53" rx="21" ry="19"/>' +
      '<path class="dl" d="M39 31C37 21 38 14 40 12M61 31C63 21 62 14 60 12"/>' +
      '<circle class="df" cx="43" cy="50" r="2.6"/><circle class="df" cx="57" cy="50" r="2.6"/>' +
      '<path class="df" d="M47 57H53L50 60.5Z"/>' +
      '<path class="dl" d="M38 60L28 58M38 64L28 66M62 60L72 58M62 64L72 66"/>' +
      BASE,
  },
  bear: {
    label: 'Urso',
    group: 'animal',
    body:
      '<circle class="b" cx="31" cy="25" r="9"/><circle class="b" cx="69" cy="25" r="9"/>' +
      '<rect class="b" x="37" y="66" width="26" height="14" rx="2"/>' +
      '<circle class="b" cx="50" cy="46" r="24"/>' +
      '<ellipse class="dl" cx="50" cy="56" rx="10" ry="8"/>' +
      '<ellipse class="df" cx="50" cy="52" rx="4.2" ry="3"/>' +
      '<circle class="df" cx="41" cy="41" r="2.6"/><circle class="df" cx="59" cy="41" r="2.6"/>' +
      '<path class="dl" d="M50 55V59M45 61C48 63 52 63 55 61"/>' +
      BASE,
  },
  cat: {
    label: 'Gato',
    group: 'animal',
    body:
      '<rect class="b" x="38" y="68" width="24" height="12" rx="2"/>' +
      '<path class="b" d="M26 61C22 50 24 40 28 34L26 12L42 26C47 25 53 25 58 26L74 12L72 34C76 40 78 50 74 61C70 71 61 75 50 75C39 75 30 71 26 61Z"/>' +
      '<ellipse class="df" cx="40" cy="46" rx="3" ry="4.4"/><ellipse class="df" cx="60" cy="46" rx="3" ry="4.4"/>' +
      '<path class="df" d="M47 55H53L50 58.5Z"/>' +
      '<path class="dl" d="M50 58.5C49 62 45 63 43 61M50 58.5C51 62 55 63 57 61M37 56L25 54M37 60L25 62M63 56L75 54M63 60L75 62"/>' +
      BASE,
  },
  fox: {
    label: 'Raposa',
    group: 'animal',
    body:
      '<rect class="b" x="40" y="68" width="20" height="12" rx="2"/>' +
      '<path class="b" d="M18 30L24 8L42 24C47 22 53 22 58 24L76 8L82 30C84 42 76 54 64 62L50 76L36 62C24 54 16 42 18 30Z"/>' +
      '<path class="dl" d="M28 42L42 56M72 42L58 56M27 16L34 26M73 16L66 26"/>' +
      '<circle class="df" cx="40" cy="38" r="2.6"/><circle class="df" cx="60" cy="38" r="2.6"/>' +
      '<circle class="df" cx="50" cy="71" r="3"/>' +
      BASE,
  },
  turtle: {
    label: 'Tartaruga',
    group: 'animal',
    body:
      '<path class="b" d="M29 66L27 78H36L38 66ZM64 66L62 78H71L73 66Z"/>' +
      '<path class="b" d="M78 58C82 51 91 51 93 57C94 63 88 66 81 66Z"/>' +
      '<path class="b" d="M20 67C20 45 33 32 50 32C67 32 80 45 80 67Z"/>' +
      '<path class="dl" d="M37 46L50 40L63 46V58L50 63L37 58ZM50 40V33M37 46L28 42M63 46L72 42M37 58L30 66M63 58L70 66M50 63V67"/>' +
      '<circle class="df" cx="88" cy="57" r="1.7"/>' +
      BASE,
  },
  fish: {
    label: 'Peixe',
    group: 'animal',
    body:
      '<rect class="b" x="44" y="58" width="12" height="22" rx="2"/>' +
      '<path class="b" d="M12 42C25 24 52 20 70 34L87 21L82 42L87 63L70 50C52 64 25 60 12 42Z"/>' +
      '<circle class="df" cx="27" cy="39" r="3"/>' +
      '<path class="dl" d="M39 30C44 37 44 47 39 54M54 30L60 26M57 37L64 33"/>' +
      BASE,
  },
  letter: {
    label: 'Letra',
    body: '<circle class="b" cx="50" cy="45" r="31"/>' + BASE,
  },
};

export const ICON_KEYS = Object.keys(ICONS);
export const ICON_GROUPS = [
  { id: 'classic', label: 'Peças clássicas' },
  { id: 'animal', label: 'Animais' },
  { id: 'symbol', label: 'Símbolos' },
];
export const iconGroup = (k) => (ICONS[k] && ICONS[k].group) || 'symbol';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// SVG de uma peça. color: 0 brancas, 1 pretas.
export function pieceSVG(icon, color, letter = '?') {
  const def = ICONS[icon] || ICONS.letter;
  let inner = def.body;
  if (!ICONS[icon] || icon === 'letter') {
    inner += `<text class="lt" x="50" y="47" text-anchor="middle" dominant-baseline="central">${esc(letter)}</text>`;
  }
  return `<svg class="pc ${color ? 'pb' : 'pw'}" viewBox="0 0 100 100" aria-hidden="true">${inner}</svg>`;
}

// SVG de uma peça a partir do tipo compilado ou da peça das regras
export function pieceSVGFor(piece, color) {
  return pieceSVG(piece.icon, color, piece.id);
}
