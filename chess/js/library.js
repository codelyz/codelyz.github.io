// Tela inicial: variantes do usuário e variantes prontas.
import { h, icon, btn, escapeHtml } from './ui.js';
import { setupToCells } from './engine.js';
import { pieceSVG } from './pieces.js';
import { PRESETS } from './presets.js';
import { library, IS_STANDALONE } from './store.js';
import { menuButton } from './editor.js';

// Miniatura do tabuleiro inicial
export function miniBoard(rules) {
  const { width: W, height: H } = rules.board;
  const cells = setupToCells(rules.setup, W, H);
  const el = h('div', { class: 'mini', style: { '--bw': W, '--bh': H }, 'aria-hidden': 'true' });
  let html = '';
  for (let vy = 0; vy < H; vy++) {
    for (let vx = 0; vx < W; vx++) {
      const y = H - 1 - vy;
      const c = cells[y * W + vx];
      const p = c && rules.pieces.find((q) => q.id === c.id);
      html += `<i class="${(vx + y) % 2 ? 'ml' : 'md'}">${p ? pieceSVG(p.icon, c.color, p.id) : ''}</i>`;
    }
  }
  el.innerHTML = html;
  return el;
}

export function createLibrary(app) {
  const root = h('section', { class: 'view library', 'aria-labelledby': 'lib-title' });

  function render() {
    const mine = library.items;
    const intro = h(
      'div',
      { class: 'lib-hero' },
      h('div', { class: 'lib-hero-text' }, h('h1', { class: 'h-display', id: 'lib-title' }, 'Invente as regras. Jogue contra o robô.'), h('p', { class: 'lead' }, 'Mude como cada peça anda, crie peças novas e regras especiais como a do xadrez vampiro. O robô lê as suas regras e joga com elas na hora.')),
      h(
        'div',
        { class: 'lib-hero-act' },
        btn('Criar variante', { kind: 'primary', icon: 'plus', onClick: () => app.copyPreset('classico') }),
        btn('Abrir arquivo', { kind: 'ghost', icon: 'upload', onClick: () => app.openFile() }),
      ),
    );

    const mineSec = h('section', { class: 'lib-sec', 'aria-labelledby': 'lib-mine' }, h('h2', { class: 'h-sec2', id: 'lib-mine' }, 'Suas variantes'));
    if (!mine.length) {
      mineSec.appendChild(h('p', { class: 'empty-note' }, 'Você ainda não criou nenhuma. Toque em "Criar variante" ou em "Copiar e editar" numa variante pronta.'));
    } else {
      const dirtyCount = mine.filter((it) => library.isDirty(it)).length;
      if (dirtyCount) {
        mineSec.appendChild(
          h(
            'div',
            { class: 'unsaved' },
            h(
              'p',
              null,
              h('strong', null, dirtyCount === 1 ? '1 variante ainda não foi baixada. ' : `${dirtyCount} variantes ainda não foram baixadas. `),
              dirtyCount === 1 ? 'Ela fica só neste navegador. Baixe o arquivo para não perder.' : 'Elas ficam só neste navegador. Baixe os arquivos para não perder.',
            ),
          ),
        );
      }
      const list = h('ul', { class: 'lib-list' });
      mine.forEach((it) => list.appendChild(row(it.rules, { item: it })));
      mineSec.appendChild(list);
    }

    const presetSec = h('section', { class: 'lib-sec', 'aria-labelledby': 'lib-pre' }, h('h2', { class: 'h-sec2', id: 'lib-pre' }, 'Variantes prontas'));
    const plist = h('ul', { class: 'lib-list' });
    PRESETS.forEach((p) => plist.appendChild(row(p, { preset: p })));
    presetSec.appendChild(plist);

    const drop = h('p', { class: 'drop-hint' }, h('span', { html: icon('file') }), 'Também dá para arrastar um arquivo de regras (.json) para esta página.');
    const dedic = h(
      'figure',
      { class: 'dedic' },
      h('img', { src: 'img/para-will.jpg', alt: 'Will jogando xadrez, em pixel art', width: 314, height: 314, loading: 'lazy' }),
      h('figcaption', null, 'Para Will'),
    );
    root.replaceChildren(intro, mineSec, presetSec, drop, dedic);
  }

  function row(rules, { item, preset }) {
    const dirty = item && library.isDirty(item);
    const status = item
      ? h('span', { class: `pill ${dirty ? 'pill-warn' : 'pill-ok'}`, html: dirty ? `${icon('warn')}<span>Não baixada</span>` : `${icon('check')}<span>Baixada</span>` })
      : null;
    const size = `${rules.board.width}×${rules.board.height}`;
    const special = (rules.triggers || []).filter((t) => t.enabled !== false).length;
    const meta = [size, `${rules.pieces.length} ${rules.pieces.length === 1 ? 'tipo de peça' : 'tipos de peça'}`, special ? `${special} ${special === 1 ? 'regra especial' : 'regras especiais'}` : null].filter(Boolean).join(', ');

    const actions = h('div', { class: 'lib-act' });
    if (item) {
      actions.append(
        btn('Jogar', { kind: 'primary', small: true, icon: 'play', onClick: () => app.playItem(item.uid) }),
        btn('Editar', { kind: 'ghost', small: true, icon: 'edit', onClick: () => app.edit(item.uid) }),
        menuButton([
          { label: dirty ? 'Baixar regras (não baixadas)' : 'Baixar regras de novo', icon: 'download', onClick: () => app.download(item.uid) },
          !IS_STANDALONE && { label: 'Copiar link de compartilhamento', icon: 'link', onClick: () => app.share(item.uid) },
          { label: 'Duplicar', icon: 'copy', onClick: () => app.duplicate(item.uid) },
          { label: 'Excluir', icon: 'trash', danger: true, onClick: () => app.remove(item.uid) },
        ]),
      );
      if (dirty) actions.prepend(btn('Baixar', { kind: 'mark', small: true, icon: 'download', onClick: () => app.download(item.uid) }));
    } else {
      actions.append(
        btn('Jogar', { kind: 'primary', small: true, icon: 'play', onClick: () => app.playPreset(preset.id) }),
        btn('Copiar e editar', { kind: 'ghost', small: true, icon: 'edit', onClick: () => app.copyPreset(preset.id) }),
      );
    }
    return h(
      'li',
      { class: `lib-row sheet ${dirty ? 'is-dirty' : ''}` },
      miniBoard(rules),
      h(
        'div',
        { class: 'lib-info' },
        h('div', { class: 'lib-title-row' }, h('h3', { class: 'lib-name' }, rules.name), status),
        h('p', { class: 'lib-desc' }, rules.description || 'Sem descrição.'),
        h('p', { class: 'lib-meta' }, meta),
        actions,
      ),
    );
  }

  return { el: root, render };
}

export { escapeHtml };
