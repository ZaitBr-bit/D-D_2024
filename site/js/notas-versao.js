// ============================================================
// Modal de notas de versão. Só monta HTML a partir de versao.js --
// nenhum dado de release mora aqui.
// ============================================================
import { abrirModal, escHtml } from './utils.js';
import { VERSAO_ATUAL, NOTAS_VERSAO } from './versao.js';

/** Monta a lista de itens de um grupo (melhoria ou correção). */
function _grupoHtml(grupo) {
  const itens = grupo.itens
    .map((i) => `<li class="nv-item">${escHtml(i)}</li>`)
    .join('');
  return `
    <div class="nv-grupo">
      <h4 class="nv-grupo-titulo">${escHtml(grupo.grupo)}</h4>
      <ul class="nv-lista">${itens}</ul>
    </div>`;
}

/**
 * Monta uma versão como <details>. A versão atual vem aberta e com
 * marcador; as demais vêm recolhidas -- é o comportamento pedido
 * (lista recolhida, com um marcador apontando para a atual).
 */
function _versaoHtml(v) {
  const ehAtual = v.versao === VERSAO_ATUAL;
  const marcador = ehAtual
    ? '<span class="nv-marcador" title="Versão que você está usando">▶ atual</span>'
    : '';
  const secoes = [
    ...v.melhorias.map(_grupoHtml),
    ...v.correcoes.map(_grupoHtml),
  ].join('');
  return `
    <details class="nv-versao${ehAtual ? ' nv-versao-atual' : ''}" ${ehAtual ? 'open' : ''}>
      <summary class="nv-versao-cabecalho">
        <span class="nv-versao-numero">${escHtml(v.versao)}</span>
        <span class="nv-versao-data">${escHtml(v.data)}</span>
        ${marcador}
      </summary>
      <p class="nv-resumo">${escHtml(v.resumo)}</p>
      ${secoes}
    </details>`;
}

/**
 * Abre o modal com a lista de versões. O número de build do GitHub
 * (invisível no header, span #build-numero) entra no rodapé só como
 * diagnóstico -- é ele que identifica a build para relatar problema,
 * enquanto a versão de cima é a numeração manual do site.
 */
export function abrirNotasVersao() {
  const build = document.getElementById('build-numero')?.textContent?.trim() || '';
  const rodape = build
    ? `<p class="nv-build">Build de distribuição: <code>${escHtml(build)}</code></p>`
    : '';
  const corpo = `
    <div class="nv-container">
      ${NOTAS_VERSAO.map(_versaoHtml).join('')}
      ${rodape}
    </div>`;
  abrirModal('Notas de versão', corpo);
}
