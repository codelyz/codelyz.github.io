// Guarda as variantes no navegador, baixa e abre arquivos de regras e
// cria links de compartilhamento.
import { normalizeRules, compileRules } from './engine.js';

const LS_LIB = 'xsm.biblioteca.v1';
const LS_SET = 'xsm.ajustes.v1';
const LS_GAME = 'xsm.partida.v1';

export const IS_STANDALONE = typeof window !== 'undefined' && !!window.__XSM_STANDALONE__;

let storageOk = true;
function lsGet(key, def) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : def;
  } catch {
    storageOk = false;
    return def;
  }
}
function lsSet(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
    return true;
  } catch {
    storageOk = false;
    return false;
  }
}
export const storageWorks = () => storageOk;

export function hashString(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

export const fingerprint = (rules) => hashString(JSON.stringify(normalizeRules(rules)));

export function slugify(name) {
  return (
    String(name || 'regras')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50) || 'regras'
  );
}

const newUid = () => 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// ---------------------------------------------------------------------------
// Biblioteca de variantes do usuário
// ---------------------------------------------------------------------------

export const library = {
  items: [],
  load() {
    const raw = lsGet(LS_LIB, []);
    this.items = Array.isArray(raw) ? raw.filter((it) => it && it.uid && it.rules) : [];
    return this.items;
  },
  persist() {
    return lsSet(LS_LIB, this.items);
  },
  get(uid) {
    return this.items.find((it) => it.uid === uid) || null;
  },
  add(rules, { origin = 'new', saved = false } = {}) {
    const r = normalizeRules(rules);
    const item = { uid: newUid(), rules: r, origin, createdAt: Date.now(), updatedAt: Date.now(), savedHash: saved ? fingerprint(r) : null, savedAt: saved ? Date.now() : null };
    this.items.unshift(item);
    this.persist();
    return item;
  },
  update(uid, rules) {
    const it = this.get(uid);
    if (!it) return null;
    it.rules = rules;
    it.updatedAt = Date.now();
    this.persist();
    return it;
  },
  remove(uid) {
    this.items = this.items.filter((it) => it.uid !== uid);
    this.persist();
  },
  isDirty(it) {
    return !!it && it.savedHash !== fingerprint(it.rules);
  },
  markSaved(uid) {
    const it = this.get(uid);
    if (!it) return;
    it.savedHash = fingerprint(it.rules);
    it.savedAt = Date.now();
    this.persist();
  },
  anyDirty() {
    return this.items.some((it) => this.isDirty(it));
  },
};

// ---------------------------------------------------------------------------
// Ajustes e partida em andamento
// ---------------------------------------------------------------------------

const DEFAULT_SETTINGS = { theme: 'auto', board: 'tinta', sound: true, coords: true, mode: 'ai', side: 'white', level: 'medium', introDone: false };

export const settings = {
  data: { ...DEFAULT_SETTINGS },
  load() {
    this.data = { ...DEFAULT_SETTINGS, ...lsGet(LS_SET, {}) };
    return this.data;
  },
  set(patch) {
    Object.assign(this.data, patch);
    lsSet(LS_SET, this.data);
  },
};

export const savedGame = {
  load: () => lsGet(LS_GAME, null),
  save: (g) => lsSet(LS_GAME, g),
  clear: () => {
    try {
      localStorage.removeItem(LS_GAME);
    } catch {
      /* sem armazenamento */
    }
  },
};

// ---------------------------------------------------------------------------
// Baixar arquivo
// ---------------------------------------------------------------------------

let downloadsCap = null;
// Na versão publicada como artefato do Claude, os downloads passam por uma capacidade própria.
export function warmDownloads() {
  if (downloadsCap || typeof window === 'undefined') return;
  if (window.claude && typeof window.claude.use === 'function') {
    downloadsCap = window.claude.use('downloads').catch(() => null);
  }
}

// JSON legível: objetos pequenos (como cada movimento) ficam numa linha só
function pretty(v, ind = '') {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  const next = ind + '  ';
  if (Array.isArray(v)) {
    if (!v.length) return '[]';
    if (v.every((x) => x === null || typeof x !== 'object')) return '[' + v.map((x) => JSON.stringify(x)).join(', ') + ']';
    return '[\n' + v.map((x) => next + pretty(x, next)).join(',\n') + '\n' + ind + ']';
  }
  const keys = Object.keys(v).filter((k) => v[k] !== undefined);
  if (!keys.length) return '{}';
  const flat = keys.every((k) => v[k] === null || typeof v[k] !== 'object' || (Array.isArray(v[k]) && v[k].every((x) => x === null || typeof x !== 'object')));
  const one = '{ ' + keys.map((k) => JSON.stringify(k) + ': ' + pretty(v[k], next)).join(', ') + ' }';
  if (flat && one.length <= 96) return one;
  return '{\n' + keys.map((k) => next + JSON.stringify(k) + ': ' + pretty(v[k], next)).join(',\n') + '\n' + ind + '}';
}

export function rulesToText(rules) {
  return pretty(normalizeRules(rules)) + '\n';
}

export function fileNameFor(rules) {
  return slugify(rules.name) + '.json';
}

// Devolve { ok: true } quando o arquivo foi entregue ao navegador,
// { ok: false, declined } quando a pessoa recusou, ou { ok: false, copy: true }
// quando só resta copiar o texto.
export async function saveTextFile(filename, text) {
  warmDownloads();
  if (downloadsCap) {
    const dl = await downloadsCap;
    if (dl) {
      try {
        await dl.save({ filename, data: text });
        return { ok: true };
      } catch (e) {
        if (e && e.code === 'declined') return { ok: false, declined: true };
        if (e && e.code === 'rate_limited') return { ok: false, busy: true };
      }
    }
  }
  // Dentro de um quadro (como a pré-visualização do Claude) o navegador bloqueia downloads
  let inFrame = true;
  try {
    inFrame = window.top !== window.self;
  } catch {
    inFrame = true;
  }
  if (IS_STANDALONE && inFrame) return { ok: false, copy: true };
  try {
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 1500);
    return { ok: true };
  } catch {
    return { ok: false, copy: true };
  }
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Abrir arquivo de regras
// ---------------------------------------------------------------------------

export function parseRulesText(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('O arquivo não é um JSON válido.');
  }
  if (!data || typeof data !== 'object' || !Array.isArray(data.pieces)) throw new Error('Este arquivo não parece ser um arquivo de regras do Xadrez Sob Medida.');
  const rules = normalizeRules(data);
  let problem = null;
  try {
    compileRules(rules);
  } catch (e) {
    problem = e.message;
  }
  return { rules, problem };
}

export function readFile(file) {
  return new Promise((resolve, reject) => {
    if (file.size > 2_000_000) {
      reject(new Error('O arquivo é grande demais para ser um arquivo de regras.'));
      return;
    }
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
    fr.readAsText(file);
  });
}

// ---------------------------------------------------------------------------
// Link de compartilhamento (regras compactadas no endereço)
// ---------------------------------------------------------------------------

function b64urlFromBytes(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function bytesFromB64url(s) {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out;
}

export async function encodeShare(rules) {
  const json = JSON.stringify(normalizeRules(rules));
  const bytes = new TextEncoder().encode(json);
  if (typeof CompressionStream !== 'undefined') {
    try {
      const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
      const buf = new Uint8Array(await new Response(stream).arrayBuffer());
      return 'z' + b64urlFromBytes(buf);
    } catch {
      /* usa sem compressão */
    }
  }
  return 'j' + b64urlFromBytes(bytes);
}

export async function decodeShare(code) {
  const kind = code[0];
  const bytes = bytesFromB64url(code.slice(1));
  let json;
  if (kind === 'z') {
    if (typeof DecompressionStream === 'undefined') throw new Error('Este navegador não consegue abrir links compactados.');
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    json = new TextDecoder().decode(await new Response(stream).arrayBuffer());
  } else {
    json = new TextDecoder().decode(bytes);
  }
  return parseRulesText(json);
}

export async function shareLink(rules) {
  const code = await encodeShare(rules);
  return location.origin + location.pathname + '#v=' + code;
}
