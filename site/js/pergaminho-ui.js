// ============================================================
// Grade de escolha da magia do Pergaminho Mágico (issue #103): busca,
// card fixo "Em branco" (padrão) e um card por magia do círculo.
// Usada ao adicionar (itens-magicos-ui.js) e ao trocar (sheet/inventario.js).
// ============================================================
import { abrirModal, circuloSuperiorHtml, classesDaMagiaHtml, escHtml, mdParaHtml, semAcento, toast } from './utils.js';
import { getIndiceMagias, getMagiasPorCirculo } from './db.js';

/**
 * Carrega as magias do índice. Falha de carregamento avisa com toast de erro
 * e devolve lista vazia: a grade fica só com "Em branco".
 * @returns {Promise<Array<{nome: string, circulo: number, escola?: string}>>}
 */
export async function carregarMagiasIndicePergaminho() {
  let indice = null;
  try { indice = await getIndiceMagias(); } catch { indice = null; }
  if (!Array.isArray(indice?.magias)) {
    toast('Não foi possível carregar as magias.', 'error');
    return [];
  }
  return indice.magias;
}

/**
 * HTML da busca e da grade. O primeiro card é "Em branco" (valor ''), fixo e
 * nunca filtrado pela busca; vem selecionado quando `selecionada` é ''.
 * @param {Array<{nome: string, circulo: number, escola?: string}>} magias Magias do círculo, já filtradas.
 * @param {string} [selecionada] Nome da magia atual ('' = Em branco).
 * @returns {string}
 */
export function htmlSeletorMagiaPergaminho(magias, selecionada = '') {
  const lista = [...magias].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  return `
    <div class="search-box" style="margin-top:6px"><input type="text" id="pergaminho-busca" class="form-input" placeholder="Buscar magia..."></div>
    <div id="pergaminho-cards" class="opcao-grid densa" style="max-height:40dvh;overflow-y:auto">
      <div class="opcao-card${selecionada === '' ? ' selecionada' : ''}" data-magia-pergaminho="">
        <span class="opcao-check"></span>
        <div class="opcao-nome">Em branco</div>
        <div class="opcao-resumo"><span>Sem magia definida</span></div>
      </div>
      ${lista.map(m => `
      <div class="opcao-card${m.nome === selecionada ? ' selecionada' : ''}" data-magia-pergaminho="${escHtml(m.nome)}" data-circulo="${m.circulo}">
        <span class="opcao-check"></span>
        <div class="opcao-nome">${escHtml(m.nome)}</div>
        <div class="opcao-resumo"><span>${escHtml(m.escola || '')}</span></div>
      </div>`).join('')}
    </div>`;
}

/**
 * Abre, como sub-modal empilhado, os detalhes de uma magia (círculo, escola,
 * metadados, descrição, círculo superior e classes). Não altera o seletor.
 * Sem a magia nos dados, avisa com toast de erro.
 */
async function abrirDetalhesMagiaPergaminho(nome, circulo) {
  const dados = await getMagiasPorCirculo(circulo);
  const magia = dados?.magias?.find(m => m.nome === nome);
  if (!magia) { toast('Detalhes não encontrados', 'error'); return; }
  const detalhesHtml = `
    <div class="magia-meta" style="margin-bottom:8px;display:flex;flex-wrap:wrap;gap:8px;font-size:0.85rem">
      <span class="badge badge-primary">${circulo === 0 ? 'Truque' : circulo + 'º Círculo'}</span>
      <span class="badge badge-secondary">${escHtml(magia.escola)}</span>
      <span>${escHtml(magia.tempo_conjuracao)}</span>
      <span>${escHtml(magia.alcance)}</span>
      <span>${escHtml(magia.componentes)}</span>
      <span>${escHtml(magia.duracao)}</span>
    </div>
    <div class="md-content">${mdParaHtml(magia.descricao)}</div>
    ${magia.circulo_superior ? `<div class="info-box info mt-1"><div class="md-content">${circuloSuperiorHtml(magia.circulo_superior, circulo)}</div></div>` : ''}
    ${classesDaMagiaHtml(magia.classes)}`;
  abrirModal(magia.nome, detalhesHtml, '<button class="btn btn-primary" onclick="fecharModal()">Fechar</button>');
}

/**
 * Liga a grade dentro de `raiz`: o círculo (.opcao-check) move a seleção (um
 * por vez); o corpo do card de magia abre os detalhes sem mexer na seleção;
 * "Em branco" não tem detalhes e seleciona por qualquer parte do card. A busca
 * esconde os cards de magia que não casam, sem esconder "Em branco".
 */
export function ligarSeletorMagiaPergaminho(raiz) {
  const cards = [...raiz.querySelectorAll('[data-magia-pergaminho]')];
  /** Marca `alvo` como o único card selecionado. */
  const selecionar = (alvo) => cards.forEach(o => o.classList.toggle('selecionada', o === alvo));
  cards.forEach(c => {
    c.querySelector('.opcao-check')?.addEventListener('click', (e) => {
      e.stopPropagation();
      selecionar(c);
    });
    c.addEventListener('click', () => {
      if (c.dataset.magiaPergaminho === '') { selecionar(c); return; }
      abrirDetalhesMagiaPergaminho(c.dataset.magiaPergaminho, Number(c.dataset.circulo));
    });
  });
  raiz.querySelector('#pergaminho-busca')?.addEventListener('input', (e) => {
    const termo = semAcento(e.target.value || '');
    cards.forEach(c => {
      if (c.dataset.magiaPergaminho === '') return;
      c.style.display = !termo || semAcento(c.dataset.magiaPergaminho).includes(termo) ? '' : 'none';
    });
  });
}

/** Magia marcada na grade de `raiz` ({nome, circulo}), ou null quando é "Em branco". */
export function magiaSelecionadaPergaminho(raiz) {
  const marcado = raiz.querySelector('[data-magia-pergaminho].selecionada');
  const nome = marcado?.dataset.magiaPergaminho || '';
  return nome ? { nome, circulo: Number(marcado.dataset.circulo) } : null;
}
