// ============================================================
// Campo de preço informado ao adicionar um item (valor + moeda no rodapé do
// modal). Compartilhado pelo modal do item mágico e pelo de item
// personalizado. O valor não é guardado no item: só debita a carteira.
// ============================================================
import { DENOMINACOES, ICONE_MOEDA, interpretarPrecoInformado, pagarCusto, podePagarCusto } from './moedas.js';
import { escHtml, toast } from './utils.js';

/**
 * HTML do bloco de preço para o rodapé de um modal. Ids derivados de `idBase`:
 * `bloco-<idBase>`, `<idBase>-qtd` e `<idBase>-moeda` (moeda padrão: PO).
 * @param {string} idBase Prefixo dos ids dos elementos.
 * @param {string} [rotulo] Texto do rótulo do campo.
 * @returns {string}
 */
export function htmlCampoPrecoInformado(idBase, rotulo = 'Preço') {
  const opcoesMoeda = DENOMINACOES
    .map(t => `<option value="${t}"${t === 'po' ? ' selected' : ''}>${ICONE_MOEDA[t]} ${t.toUpperCase()}</option>`).join('');
  return `<div id="bloco-${idBase}" style="display:flex;align-items:center;gap:6px;margin-right:auto">
       <label for="${idBase}-qtd" style="font-size:0.75rem;white-space:nowrap">${escHtml(rotulo)}</label>
       <input type="number" class="form-input" id="${idBase}-qtd" min="0" step="1" placeholder="0" style="width:80px">
       <select class="form-input" id="${idBase}-moeda" style="width:auto">${opcoesMoeda}</select>
     </div>`;
}

/**
 * Lê o campo de preço de `idBase`, valida e cobra da carteira do personagem,
 * emitindo os toasts de erro. Vazio ou 0 = sem cobrança (ok, sufixo vazio).
 * Valor malformado ("1-" em input number vira value '' com badInput) e saldo
 * insuficiente devolvem ok:false sem alterar a carteira.
 * @param {string} idBase Prefixo dos ids usado em htmlCampoPrecoInformado.
 * @param {{moedas: object}} personagem Personagem cuja carteira é debitada.
 * @param {string} nomeItem Nome do item, usado nas mensagens.
 * @returns {{ok: boolean, sufixo: string}} sufixo = " por N PO" quando cobrou.
 */
export function cobrarPrecoInformado(idBase, personagem, nomeItem) {
  const campo = document.getElementById(`${idBase}-qtd`);
  if (campo?.validity?.badInput) {
    toast('Informe um valor inteiro maior ou igual a zero.', 'error');
    return { ok: false, sufixo: '' };
  }
  const preco = interpretarPrecoInformado(campo?.value, document.getElementById(`${idBase}-moeda`)?.value);
  if (!preco.ok) { toast(preco.erro, 'error'); return { ok: false, sufixo: '' }; }
  if (!preco.custo) return { ok: true, sufixo: '' };
  if (!podePagarCusto(personagem.moedas, preco.custo)) {
    toast(`Saldo insuficiente para pagar ${preco.custo} por ${nomeItem}!`, 'error');
    return { ok: false, sufixo: '' };
  }
  const pagamento = pagarCusto(personagem.moedas, preco.custo);
  // Guarda defensiva: podePagarCusto já passou; sem sucesso não grava moedas.
  if (!pagamento.sucesso) {
    toast(`Não foi possível pagar ${preco.custo} por ${nomeItem}.`, 'error');
    return { ok: false, sufixo: '' };
  }
  personagem.moedas = pagamento.moedas;
  return { ok: true, sufixo: ` por ${preco.custo}` };
}
