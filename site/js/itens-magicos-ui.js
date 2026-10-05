// ============================================================
// Tela dos itens mágicos do acervo: detalhe (descrição + tabelas) e, na
// Task 3, a categoria "Itens Mágicos" do modal Adicionar Item.
//
// Sem import de sheet/ nem creator/ (mesma regra de itens-seletor.js): o
// personagem e os callbacks chegam por parâmetro.
// ============================================================
import { abrirModal, escHtml, mdParaHtml, toast } from './utils.js';
import {
  filtrarAcervo, opcoesDeBase, montarItemInventario,
  RARIDADES_ORDEM, TIPOS_ACERVO, raridadesDoItem,
} from './itens-magicos-catalogo.js';

/**
 * Grava o item no inventário. Equipamento (Poção de Cura do Livro do
 * Jogador) e item mágico Consumível somam na linha de mesmo nome; o resto
 * entra como linha nova.
 */
export function adicionarAoInventario(personagem, novo) {
  personagem.inventario = personagem.inventario || [];
  const agrupa = novo.tipo === 'equipamento' || (novo.tipo === 'magico' && novo.dados?.tipo_item === 'Consumível');
  const existente = agrupa && personagem.inventario.find(i => i.nome === novo.nome && i.tipo === novo.tipo);
  if (existente) existente.quantidade = (existente.quantidade || 1) + 1;
  else personagem.inventario.push(novo);
}

/**
 * Controle de requisições incrementais: cada busca recebe um token novo e só a
 * resposta do token mais recente vale; respostas atrasadas de buscas
 * anteriores são ignoradas.
 * @returns {{nova: () => number, vigente: (token: number) => boolean}}
 */
export function criarGuardaRequisicao() {
  let atual = 0;
  return { nova: () => ++atual, vigente: (token) => token === atual };
}

/**
 * Aguarda a `promessa` e chama `aoReceber` (ou `aoFalhar`) só quando a busca
 * ainda é a mais recente do `guarda`. Devolve o token da busca.
 */
export function aplicarSeVigente(guarda, promessa, aoReceber, aoFalhar) {
  const token = guarda.nova();
  Promise.resolve(promessa).then((valor) => {
    if (guarda.vigente(token)) aoReceber(valor);
  }).catch((erro) => {
    if (guarda.vigente(token)) aoFalhar(erro);
  });
  return token;
}

/**
 * Renderiza a categoria "Itens Mágicos" em listaEl: filtros de raridade e tipo,
 * e a lista filtrada pelo texto. Os filtros ficam em `ctx.estado`
 * ({raridade, tipo}), criado a cada abertura do modal pelo chamador.
 */
export function renderCategoriaMagicos(listaEl, ctx) {
  const estado = ctx.estado || (ctx.estado = { raridade: '', tipo: '' });
  const filtroRaridade = estado.raridade;
  const filtroTipo = estado.tipo;
  const itens = filtrarAcervo(ctx.acervo, { texto: ctx.texto, raridade: filtroRaridade, tipo: filtroTipo });
  listaEl.innerHTML = `
    <div style="display:flex;gap:6px;margin-bottom:6px;flex-wrap:wrap">
      ${[['', 'Todas'], ...RARIDADES_ORDEM.map(r => [r, r])].map(([id, rotulo]) => `
        <button class="btn btn-sm btn-outline ${filtroRaridade === id ? 'active' : ''}" data-filtro-raridade="${escHtml(id)}">${escHtml(rotulo)}</button>`).join('')}
    </div>
    <select class="form-input" id="filtro-tipo-magico" style="margin-bottom:8px">
      <option value="">Todos os tipos</option>
      ${TIPOS_ACERVO.map(t => `<option value="${escHtml(t)}"${filtroTipo === t ? ' selected' : ''}>${escHtml(t)}</option>`).join('')}
    </select>
    ${itens.length === 0
      ? '<div style="color:var(--text-muted);text-align:center;padding:16px">Nenhum item encontrado</div>'
      : itens.map((it, i) => `
        <div class="inv-item" style="cursor:pointer" data-item-magico="${i}">
          <div style="flex:1">
            <div class="inv-item-nome">${escHtml(it.nome)}${it.requer_sintonizacao ? ' <span class="badge" style="font-size:0.6rem;background:#e0f2f1;color:#00695c">Sintonização</span>' : ''}</div>
            <div class="inv-item-detalhe">${escHtml(it.tipo)} | ${escHtml(raridadesDoItem(it).join(', '))}</div>
          </div>
        </div>`).join('')}`;
  listaEl.querySelectorAll('[data-filtro-raridade]').forEach(btn => btn.addEventListener('click', () => {
    estado.raridade = btn.dataset.filtroRaridade;
    renderCategoriaMagicos(listaEl, ctx);
  }));
  listaEl.querySelector('#filtro-tipo-magico')?.addEventListener('change', (e) => {
    estado.tipo = e.target.value;
    renderCategoriaMagicos(listaEl, ctx);
  });
  listaEl.querySelectorAll('[data-item-magico]').forEach(el => el.addEventListener('click', () => {
    abrirItemMagico(itens[parseInt(el.dataset.itemMagico)], ctx);
  }));
}

/**
 * Modal de um item mágico: descrição, escolha da variante (quando há) e da
 * arma/armadura-base (quando há), e o botão de adicionar. Sem a escolha
 * obrigatória, avisa e não grava nada.
 */
export function abrirItemMagico(item, ctx) {
  if (!item) return;
  const variantes = item.variantes || [];
  const opcoes = item.base ? opcoesDeBase(item.base, ctx.catalogos) : [];
  const corpo = `
    ${htmlCorpoItemMagico({ linha_tipo: item.linha_tipo, descricao_magica: item.descricao, tabelas: item.tabelas })}
    ${variantes.length ? `
      <div style="margin-top:10px;font-weight:700;font-size:0.85rem">Variante</div>
      ${variantes.map(v => `
        <label style="display:flex;gap:6px;align-items:center;font-size:0.85rem">
          <input type="radio" name="variante-magica" value="${escHtml(v.id)}"> ${escHtml(v.nome)} <span style="color:var(--text-muted)">(${escHtml(v.raridade)})</span>
        </label>`).join('')}` : ''}
    ${opcoes.length ? `
      <div style="margin-top:10px;font-weight:700;font-size:0.85rem">${item.base.tipo === 'arma' ? 'Arma-base' : 'Armadura-base'}</div>
      <select class="form-input" id="base-item-magico">
        ${opcoes.length > 1 ? '<option value="">Escolha...</option>' : ''}
        ${opcoes.map(a => `<option value="${escHtml(a.nome)}">${escHtml(a.nome)}</option>`).join('')}
      </select>` : ''}
    <div style="margin-top:8px;font-size:0.75rem;color:var(--text-muted)">Item mágico entra sem custo.</div>`;
  abrirModal(item.nome, corpo,
    `<button class="btn btn-secondary" onclick="fecharModal()">Voltar</button>
     <button class="btn btn-primary" id="btn-confirmar-item-magico">Adicionar ao Inventário</button>`);
  document.getElementById('btn-confirmar-item-magico')?.addEventListener('click', () => {
    const idVariante = document.querySelector('input[name="variante-magica"]:checked')?.value;
    const variante = variantes.find(v => v.id === idVariante) || null;
    const nomeBase = document.getElementById('base-item-magico')?.value;
    const base = opcoes.find(a => a.nome === nomeBase) || null;
    if (variantes.length && !variante) { toast('Escolha a variante do item.', 'error'); return; }
    if (item.base && !base) { toast(`Escolha a ${item.base.tipo === 'arma' ? 'arma' : 'armadura'}-base.`, 'error'); return; }
    const novo = montarItemInventario({ item, variante, base, equipamentoPHB: ctx.equipamentoPHB });
    if (!novo) { toast('Não foi possível montar o item.', 'error'); return; }
    adicionarAoInventario(ctx.personagem, novo);
    window.fecharModal();
    ctx.aoAdicionar();
    toast(`${novo.nome} adicionado!`, 'success');
  });
}

/** HTML das tabelas de um item mágico ({titulo, cabecalhos, dados}) como <table>. */
export function htmlTabelasItemMagico(tabelas = []) {
  return (tabelas || []).map(t => `
    ${t.titulo ? `<div style="font-weight:700;font-size:0.8rem;margin:8px 0 4px">${escHtml(t.titulo)}</div>` : ''}
    <div class="table-wrapper"><table>
      <tr>${(t.cabecalhos || []).map(c => `<th>${escHtml(c)}</th>`).join('')}</tr>
      ${(t.dados || []).map(linha => `<tr>${linha.map(c => `<td>${escHtml(c)}</td>`).join('')}</tr>`).join('')}
    </table></div>`).join('');
}

/** Corpo do detalhe de um item mágico: linha de tipo, descrição (markdown) e tabelas. */
export function htmlCorpoItemMagico(d = {}) {
  return `
    ${d.linha_tipo ? `<div style="font-size:0.8rem;font-style:italic;margin-bottom:6px">${escHtml(d.linha_tipo)}</div>` : ''}
    ${d.descricao_magica ? `<div class="md-content" style="font-size:0.85rem">${mdParaHtml(d.descricao_magica)}</div>` : ''}
    ${htmlTabelasItemMagico(d.tabelas)}`;
}
