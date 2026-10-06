// ============================================================
// Seção Ataques: lista as armas equipadas com Atq, dano e mãos ocupadas.
// Usa o mesmo cálculo da linha do inventário (ataque-calculo.js).
// ============================================================
import { escHtml, fmtMod, toast } from '../utils.js';
import { char, salvar } from './estado.js';
import { renderFichaCompleta } from './ficha.js';
import { calcularAtaqueItem, htmlSeloAtributoArma } from './ataque-calculo.js';
import { ehArmaDeAtaque, maosOcupadas, maosEmUso, maosTotais, excedeMaos, avisoRecarga, danoVersatil, verificarEquipar } from '../regras-ataque.js';
import { abrirModalMaos } from './maos-ui.js';
import { sheetBadgeProf, sheetTemProfArma } from './condicoes.js';
import { mostrarDetalheItemSheet } from './inventario.js';

/** Armas equipadas (ativas) do personagem, na ordem do inventário. */
function armasEquipadas() {
  return (char.inventario || []).filter(i => i.equipado && !i.destruido && (i.quantidade ?? 1) > 0 && ehArmaDeAtaque(i) && i.dados);
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

/** Seção Ataques; devolve string vazia quando não há arma equipada. */
export function renderSecaoAtaques() {
  const armas = armasEquipadas();
  if (armas.length === 0) return '';
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
    ${armas.map(a => htmlLinhaAtaque(a, char.inventario.indexOf(a))).join('')}
  </div>`;
}

/** Liga o botão de mãos e a troca de empunhadura das armas versáteis. */
export function setupEventosAtaques() {
  document.getElementById('btn-ataques-maos')?.addEventListener('click', () => abrirModalMaos());
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
    } else {
      delete item.dados.empunhadura;
    }
    salvar();
    renderFichaCompleta();
  }));
}
