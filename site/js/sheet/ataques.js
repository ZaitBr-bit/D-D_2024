// ============================================================
// Seção Ataques: lista as armas equipadas com Atq, dano e mãos ocupadas.
// Usa o mesmo cálculo da linha do inventário (ataque-calculo.js).
// ============================================================
import { escHtml, fmtMod, toast } from '../utils.js';
import { char, salvar } from './estado.js';
import { renderFichaCompleta } from './ficha.js';
import { calcularAtaqueItem, htmlSeloAtributoArma } from './ataque-calculo.js';
import { ehArmaDeAtaque, ehItemDeMao, ehItemVersatilDeMao, maosOcupadas, maosEmUso, maosTotais, excedeMaos, avisoRecarga, danoVersatil, verificarEquipar } from '../regras-ataque.js';
import { ehNecromante, estadoNecromante, livroEmpunhado, nivelDoMago } from '../regras-necromante.js';
import { abrirDetalheLivro } from './necromante.js';
import { abrirModalMaos } from './maos-ui.js';
import { sheetBadgeProf, sheetTemProfArma } from './condicoes.js';
import { mostrarDetalheItemSheet } from './inventario.js';

/** Armas equipadas (ativas) do personagem, na ordem do inventário. */
function armasEquipadas() {
  return (char.inventario || []).filter(i => i.equipado && !i.destruido && (i.quantidade ?? 1) > 0 && ehArmaDeAtaque(i) && i.dados);
}

/** Itens mágicos de mão (varinha, bastão, cajado e afins) equipados: ocupam 1 mão cada. */
function itensDeMaoEquipados() {
  return (char.inventario || []).filter(i => i.equipado && !i.destruido && (i.quantidade ?? 1) > 0 && ehItemDeMao(i));
}

/** Linha de um item de mão equipado: nome, mãos ocupadas, botão de empunhadura (bastão e cajado) e a nota de que precisa estar na mão para usar. */
function htmlLinhaItemDeMao(item, idx) {
  const maos = maosOcupadas(item);
  const botao = ehItemVersatilDeMao(item)
    ? `<button class="btn btn-sm btn-secondary no-print" data-ataque-empunhar="${idx}">${item.dados.empunhadura === 'duas' ? 'Empunhar com uma mão' : 'Empunhar com duas mãos'}</button>`
    : '';
  return `<div class="ataque-item" style="padding:6px 0;border-bottom:1px solid var(--border-light);display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap">
    <div style="flex:1;min-width:0;cursor:pointer" data-ataque-info="${idx}" title="Ver detalhes"><strong>${escHtml(item.nome)}</strong>
      <span class="badge badge-secondary" style="font-size:0.65rem">${maos} ${maos === 1 ? 'mão' : 'mãos'}</span>
      <div style="font-size:0.75rem;color:var(--text-muted)">Item de mão: precisa estar na mão para usar o efeito${botao ? '; versátil (uma ou duas mãos)' : ''}.</div></div>
    ${botao}</div>`;
}

/** HTML de uma linha de ataque: nome, Atq, dano, mãos e botão de empunhadura se versátil. */
function htmlLinhaAtaque(item, idx) {
  const calc = calcularAtaqueItem(item);
  const maos = maosOcupadas(item);
  const versatil = danoVersatil(item);
  const botao = versatil
    ? `<button class="btn btn-sm btn-secondary no-print" data-ataque-empunhar="${idx}">${item.dados.empunhadura === 'duas' ? 'Empunhar com uma mão' : 'Empunhar com duas mãos'}</button>`
    : '';
  // Selos como na linha do inventário: proficiência e raridade/sintonização de arma mágica do acervo.
  const profBadge = sheetBadgeProf(sheetTemProfArma({ categoria: item.dados.categoria || '', propriedades: item.dados.propriedades || '' }));
  let magicoBadge = '';
  if (item.dados.magico_id) {
    if (item.dados.raridade) magicoBadge += `<span class="badge" style="font-size:0.6rem;background:#f3e5f5;color:#6a1b9a;border:1px solid #ce93d8">${escHtml(item.dados.raridade)}</span> `;
    if (item.dados.requer_sintonizacao) magicoBadge += `<span class="badge" style="font-size:0.6rem;background:#e0f2f1;color:#00695c;border:1px solid #80cbc4">Sintonização</span> `;
  }
  return `<div class="ataque-item" style="padding:6px 0;border-bottom:1px solid var(--border-light);display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap">
    <div style="flex:1;min-width:0;cursor:pointer" data-ataque-info="${idx}" title="Ver detalhes"><strong>${escHtml(item.nome)}</strong>
      ${profBadge}${magicoBadge}
      <span class="badge badge-secondary" style="font-size:0.65rem">Atq ${fmtMod(calc.bonusAtq)}</span>
      ${htmlSeloAtributoArma(calc)}
      <span class="badge" style="font-size:0.65rem">Dano ${escHtml(calc.danoExibicao)}</span>
      <span class="badge badge-secondary" style="font-size:0.65rem">${maos} ${maos === 1 ? 'mão' : 'mãos'}</span>
      <div style="font-size:0.75rem;color:var(--text-muted)">${escHtml(item.dados.propriedades || '')}</div></div>
    ${botao}</div>`;
}

/** Se a linha do livro de magias aparece: Necromante de nível 3 ou mais. */
function temLinhaDoLivro() {
  return ehNecromante(char) && nivelDoMago(char) >= 3;
}

/** Linha do livro de magias do Necromante: ocupa 1 mão enquanto empunhado; botão Empunhar/Guardar. */
function htmlLinhaLivro() {
  const empunhado = livroEmpunhado(char);
  return `<div class="ataque-item" id="ataque-livro" style="padding:6px 0;border-bottom:1px solid var(--border-light);display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap">
    <div style="flex:1;min-width:0;cursor:pointer" data-ataque-livro-info="1" title="Ver detalhes"><strong>Livro de magias</strong>
      <span class="badge badge-secondary" style="font-size:0.65rem">1 mão</span>
      <span class="badge ${empunhado ? 'badge-success' : 'badge-secondary'}" style="font-size:0.65rem">${empunhado ? 'Empunhado' : 'Guardado'}</span>
      <div style="font-size:0.75rem;color:var(--text-muted)">Poder Sepulcral, Servos Fortalecidos e Mestre da Morte exigem o livro na mão. Toque para ver o que cada um faz e onde é usado.</div></div>
    <button class="btn btn-sm btn-secondary no-print" data-ataque-livro-acao="alternar">${empunhado ? 'Guardar o livro' : 'Empunhar o livro'}</button></div>`;
}

/** Seção Ataques; devolve string vazia quando não há arma equipada nem livro do Necromante. */
export function renderSecaoAtaques() {
  const armas = armasEquipadas();
  const livro = temLinhaDoLivro();
  const itensMao = itensDeMaoEquipados();
  if (armas.length === 0 && !livro && itensMao.length === 0) return '';
  const avisos = [];
  if (excedeMaos(char)) avisos.push(`Mãos excedidas (${maosEmUso(char)} de ${maosTotais(char)}): desequipe um item.`);
  const recarga = avisoRecarga(char);
  if (recarga) avisos.push(recarga);
  return `<div class="card mt-3" id="secao-ataques">
    <div class="card-header" style="display:flex;justify-content:space-between;align-items:center">
      <h3 class="card-title">Ataques</h3>
      <button class="btn btn-sm btn-secondary no-print" id="btn-ataques-maos">Mãos (${maosEmUso(char)}/${maosTotais(char)})</button>
    </div>
    ${avisos.map(a => `<div class="aviso" style="font-size:0.8rem;color:#842029;margin:4px 0">${escHtml(a)}</div>`).join('')}
    ${livro ? htmlLinhaLivro() : ''}
    ${armas.map(a => htmlLinhaAtaque(a, char.inventario.indexOf(a))).join('')}
    ${itensMao.map(i => htmlLinhaItemDeMao(i, char.inventario.indexOf(i))).join('')}
  </div>`;
}

/** Liga o botão de mãos e a troca de empunhadura das armas versáteis. */
export function setupEventosAtaques() {
  document.getElementById('btn-ataques-maos')?.addEventListener('click', () => abrirModalMaos());
  document.querySelectorAll('[data-ataque-livro-info]').forEach(el => el.addEventListener('click', () => abrirDetalheLivro()));
  // Livro de magias do Necromante: empunhar exige uma mão livre; guardar sempre pode.
  document.querySelectorAll('[data-ataque-livro-acao]').forEach(btn => btn.addEventListener('click', () => {
    const e = estadoNecromante(char);
    if (!e.livro_empunhado && maosEmUso(char) + 1 > maosTotais(char)) {
      toast('Sem mãos livres para empunhar o livro de magias: desequipe uma arma ou escudo.', 'error');
      return;
    }
    e.livro_empunhado = !e.livro_empunhado;
    salvar();
    renderFichaCompleta();
  }));
  // Nome da arma abre o mesmo detalhe do inventário (inclui o seletor de atributo).
  document.querySelectorAll('[data-ataque-info]').forEach(el => el.addEventListener('click', () => {
    const item = char.inventario[parseInt(el.dataset.ataqueInfo)];
    if (item) mostrarDetalheItemSheet(item);
  }));
  document.querySelectorAll('[data-ataque-empunhar]').forEach(btn => btn.addEventListener('click', () => {
    const item = char.inventario[parseInt(btn.dataset.ataqueEmpunhar)];
    if (!item) return;
    const passando = item.dados.empunhadura !== 'duas';
    if (passando) {
      // Duas mãos exige a segunda mão livre: verifica com a empunhadura nova antes de gravar.
      item.dados.empunhadura = 'duas';
      const v = verificarEquipar(char, item);
      if (!v.ok) { delete item.dados.empunhadura; toast(v.motivo, 'error'); return; }
      if (v.aviso) toast(v.aviso, 'info');
    } else {
      delete item.dados.empunhadura;
    }
    salvar();
    renderFichaCompleta();
  }));
}
