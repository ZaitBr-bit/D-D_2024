// ============================================================
// Formulario do item customizado.
//
// O mesmo formulario servia dois modais (criar e editar), copiado, com a
// validacao duplicada -- cada campo novo tinha de ser escrito duas vezes,
// e a que faltasse sumia em silencio. Aqui ele e uma peca so; os modais
// de inventario.js montam o HTML e leem o resultado por estas funcoes.
// ============================================================
import { escHtml, fmtPeso, parsePeso } from '../utils.js';

// Formato aceito no campo Dano: 1d8, 2d6 Cortante, 1d4+2 Perfurante.
const REGEX_DANO = /^\d+d\d+(\s*[+\-]\s*\d+)?(\s+\w+)?$/i;

// As seis raridades do livro, na ordem crescente (Equipamento.md, capitulo
// de Itens Magicos). A setima opcao do seletor e a VAZIA: item que nao e
// magico nao tem raridade, e esse e o padrao de quem so quer anotar uma
// corda no inventario.
export const RARIDADES = ['Comum', 'Incomum', 'Rara', 'Muito Rara', 'Lendária', 'Artefato'];

/**
 * Valida os campos que tem regra, sem tocar no DOM.
 * @param {{nome?: string, dano?: string}} bruto
 * @returns {string[]} mensagens de erro; vazio quando esta tudo certo.
 */
export function validarItemCustomizado(bruto) {
  const erros = [];
  if (!bruto?.nome) erros.push('Informe um nome para o item.');
  if (bruto?.dano && !REGEX_DANO.test(bruto.dano)) {
    erros.push('Dano deve seguir o formato de dados: 1d8, 2d6 Cortante, 1d4+2 Perfurante');
  }
  return erros;
}
// SEM teto para bonus de CA e de ataque. Item customizado e o campo
// livre da mesa -- e o item da mesa nao cabe na faixa do item magico do
// livro (-5..+5 e -5..+10, o que estava aqui). Pior: a validacao barrava
// o item INTEIRO, entao uma armadura "CA 20" nao era gravada de forma
// nenhuma. O criador de personagem (creator/passo-equipamento.js) nunca
// teve esses limites: duas telas respondendo diferente para o mesmo
// campo. O `parseInt` que garante numero inteiro fica em
// `lerFormularioItemCustomizado`, na leitura de ic-ca e ic-atq.

/**
 * HTML dos campos do formulario. Sem item, vem vazio (criacao); com item,
 * vem preenchido (edicao).
 * @param {object|null} [item] Item do inventario a editar.
 * @returns {string} HTML pronto para o corpo do modal.
 */
export function htmlFormularioItemCustomizado(item = null) {
  const d = item?.dados || {};
  const attr = (v) => String(v ?? '').replace(/"/g, '&quot;');
  const num = (v) => (parseInt(v) || '') === '' ? '' : String(parseInt(v));
  return `
    <div class="form-group"><label class="form-label" for="ic-nome">Nome</label><input type="text" class="form-input" id="ic-nome" value="${attr(item?.nome || '')}"></div>
    <div class="form-group"><label class="form-label" for="ic-desc">Descricao</label><textarea class="form-textarea" id="ic-desc" rows="2">${escHtml(item?.descricao || '')}</textarea></div>
    <div class="row gap-1">
      <div class="col">
        <label class="form-label" for="ic-ca">Bonus CA</label>
        <input type="number" class="form-input" id="ic-ca" value="${num(d.bonus_ca)}" placeholder="0" step="1">
        <div style="font-size:0.65rem;color:var(--text-muted)">soma na CA quando equipado</div>
      </div>
      <div class="col">
        <label class="form-label" for="ic-ca-base">CA Base</label>
        <input type="number" class="form-input" id="ic-ca-base" value="${num(d.ca_base)}" placeholder="—" min="0" step="1">
        <div style="font-size:0.65rem;color:var(--text-muted)">define a CA (ex.: 20). Não soma Destreza</div>
      </div>
      <div class="col">
        <label class="form-label" for="ic-dano">Dano</label>
        <input type="text" class="form-input" id="ic-dano" value="${attr(d.dano || '')}" placeholder="1d8 Cortante">
        <div style="font-size:0.65rem;color:var(--text-muted)">Ex: 2d6 Cortante</div>
      </div>
      <div class="col">
        <label class="form-label" for="ic-atq">Bonus Atq</label>
        <input type="number" class="form-input" id="ic-atq" value="${num(d.bonus_ataque)}" placeholder="0" step="1">
        <div style="font-size:0.65rem;color:var(--text-muted)">soma na jogada de ataque</div>
      </div>
    </div>
    <div class="form-group" style="margin-top:8px">
      <label class="form-label" for="ic-peso">Peso (opcional)</label>
      <input type="number" class="form-input" id="ic-peso" value="${parsePeso(d.peso) || ''}" placeholder="0" min="0" step="0.1" style="max-width:140px">
      <div style="font-size:0.65rem;color:var(--text-muted)">em kg (ex: 0,5)</div>
    </div>
    <div class="row gap-1" style="margin-top:8px">
      <div class="col">
        <label class="form-label" for="ic-raridade">Raridade</label>
        <select class="form-input" id="ic-raridade">
          <option value=""${!d.raridade ? ' selected' : ''}>—</option>
          ${RARIDADES.map(r => `<option value="${r}"${d.raridade === r ? ' selected' : ''}>${r}</option>`).join('')}
        </select>
        <div style="font-size:0.65rem;color:var(--text-muted)">vazio = item nao magico</div>
      </div>
      <div class="col">
        <label class="form-label" for="ic-preco">Preco</label>
        <input type="text" class="form-input" id="ic-preco" value="${attr(d.preco || '')}" placeholder="150 PO">
        <div style="font-size:0.65rem;color:var(--text-muted)">texto livre (ex.: 150 PO)</div>
      </div>
    </div>
    <div class="form-group" style="margin-top:8px">
      <label class="form-label" style="display:flex;align-items:center;gap:6px;cursor:pointer">
        <input type="checkbox" id="ic-sintonizacao"${d.requer_sintonizacao ? ' checked' : ''}>
        Requer Sintonizacao
      </label>
      <div style="font-size:0.65rem;color:var(--text-muted)">voce pode estar sintonizado a no maximo 3 itens</div>
    </div>
    <div id="ic-erros" style="display:none;color:var(--danger);font-size:0.8rem;margin-top:8px"></div>
  `;
}

/**
 * Le os campos do formulario aberto e valida. Quando ha erro, escreve na
 * caixa #ic-erros e devolve ok:false -- quem chama so precisa desistir.
 * @returns {{ok: boolean, erros: string[], valores: object}}
 */
export function lerFormularioItemCustomizado() {
  const val = (id) => document.getElementById(id)?.value?.trim() || '';
  const nome = val('ic-nome');
  const descricao = val('ic-desc');
  const dano = val('ic-dano');
  const ca = parseInt(document.getElementById('ic-ca')?.value) || 0;
  const atq = parseInt(document.getElementById('ic-atq')?.value) || 0;
  // Campo VAZIO grava vazio, e nao 0: "sem CA base" e diferente de "CA base
  // zero", e so o vazio deixa o item fora da conta do piso.
  const caBaseRaw = val('ic-ca-base');
  const caBase = caBaseRaw === '' ? '' : String(parseInt(caBaseRaw) || 0);
  const pesoRaw = val('ic-peso');
  const pesoNum = pesoRaw ? parseFloat(pesoRaw.replace(',', '.')) : 0;

  const erros = validarItemCustomizado({ nome, dano });
  const errosEl = document.getElementById('ic-erros');
  if (erros.length > 0) {
    if (errosEl) { errosEl.style.display = 'block'; errosEl.innerHTML = erros.join('<br>'); }
    return { ok: false, erros, valores: null };
  }
  if (errosEl) errosEl.style.display = 'none';

  return {
    ok: true,
    erros: [],
    valores: {
      nome,
      descricao,
      dados: {
        bonus_ca: String(ca),
        ca_base: caBase,
        dano,
        bonus_ataque: String(atq),
        peso: pesoNum > 0 ? `${fmtPeso(pesoNum)} kg` : '',
        raridade: val('ic-raridade'),
        preco: val('ic-preco'),
        requer_sintonizacao: !!document.getElementById('ic-sintonizacao')?.checked,
      },
    },
  };
}
