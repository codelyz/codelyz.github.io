// Gera dist/xadrez-sob-medida.html: o app inteiro num arquivo só (estilos, fontes,
// código e o robô embutidos). Serve para abrir direto do computador, sem servidor.
// Uso: node tools/build-standalone.mjs
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

function parseModule(name) {
  const src = read(`js/${name}.js`);
  const imports = [];
  let code = src.replace(/import\s*\{([^}]*)\}\s*from\s*'\.\/([\w-]+)\.js';?/g, (_, names, from) => {
    imports.push(from);
    const mapped = names
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean)
      .map((n) => {
        const [a, b] = n.split(/\s+as\s+/);
        return b ? `${a.trim()}: ${b.trim()}` : a.trim();
      })
      .join(', ');
    return `const { ${mapped} } = __m['${from}'];`;
  });
  const exports = [];
  code = code.replace(/^export\s+(async\s+)?function(\*?)\s+([\w$]+)/gm, (m, a, star, n) => {
    exports.push(n);
    return m.replace(/^export\s+/, '');
  });
  code = code.replace(/^export\s+(const|let|var|class)\s+([\w$]+)/gm, (m, k, n) => {
    exports.push(n);
    return m.replace(/^export\s+/, '');
  });
  code = code.replace(/^export\s*\{([^}]*)\};?/gm, (_, names) => {
    names.split(',').map((x) => x.trim()).filter(Boolean).forEach((n) => exports.push(n));
    return '';
  });
  if (/^\s*(import|export)\s/m.test(code)) throw new Error(`Sobrou import/export em ${name}.js`);
  return { name, imports, exports: [...new Set(exports)], code };
}

function bundle(entry) {
  const mods = new Map();
  const order = [];
  const visit = (name, stack = []) => {
    if (stack.includes(name)) throw new Error(`Dependência circular: ${[...stack, name].join(' -> ')}`);
    if (mods.has(name)) return;
    const m = parseModule(name);
    mods.set(name, m);
    m.imports.forEach((d) => visit(d, [...stack, name]));
    order.push(m);
  };
  visit(entry);
  let out = 'const __m = {};\n';
  for (const m of order) {
    out += `__m['${m.name}'] = (() => {\n${m.code}\nreturn { ${m.exports.join(', ')} };\n})();\n`;
  }
  return out;
}

const b64 = (p) => fs.readFileSync(path.join(root, p)).toString('base64');
let css = read('css/app.css');
css = css.replace(/url\('\.\.\/fonts\/([\w-]+\.woff)'\)/g, (_, f) => `url(data:font/woff;base64,${b64('fonts/' + f)})`);

const app = bundle('main').replace(/'img\/para-will\.jpg'/g, `'data:image/jpeg;base64,${b64('img/para-will.jpg')}'`);
const worker = bundle('ai-worker');
for (const [n, c] of [['app', app], ['robô', worker], ['css', css]]) {
  if (/<\/script/i.test(c) || /<\/style/i.test(c)) throw new Error(`O código de ${n} contém uma tag de fechamento proibida.`);
}
const icon = `data:image/svg+xml;base64,${b64('icons/icon.svg')}`;

const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Xadrez Sob Medida</title>
<meta name="description" content="Crie as suas próprias regras de xadrez e jogue contra o robô.">
<meta name="theme-color" content="#eef1f5">
<link rel="icon" href="${icon}">
<style>
${css}
</style>
<script>window.__XSM_STANDALONE__ = true;</script>
<script type="text/plain" id="ai-worker-src">
${worker}
</script>
<script type="module">
${app}
</script>
</head>
<body>
<noscript><p style="padding:24px">O Xadrez Sob Medida precisa de JavaScript ligado para funcionar.</p></noscript>
</body>
</html>
`;

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
const outFile = path.join(root, 'dist', 'xadrez-sob-medida.html');
fs.writeFileSync(outFile, html);
console.log(`Gerado ${path.relative(root, outFile)} (${(html.length / 1024).toFixed(0)} KB)`);
