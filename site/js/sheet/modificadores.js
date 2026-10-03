// ============================================================
// Modificadores temporários manuais (issue #83)
//
// Buffs que chegam de fora da ficha (Armadura Arcana lançada por um
// aliado, item que aumenta a CD de magia, magia de deslocamento de um
// companheiro) entram como entradas de `char.efeitos_magicos`, o array que
// os cálculos de CA, iniciativa, deslocamento e CD/ataque de magia já
// leem. Todas saem no Descanso Longo (`temporario: true`).
// ============================================================
import { abrirModal, escHtml } from '../utils.js';
import { char, salvar } from './estado.js';
import { renderFichaCompleta } from './ficha.js';

/**
 * Alvos que um modificador manual pode afetar. `velocidade` marca os que
 * usam a forma `tipo: 'deslocamento'` que o cálculo de velocidades já lê.
 */
export const ALVOS_MODIFICADOR = [
  { id: 'ca', rotulo: 'CA', unidade: 'pontos' },
  { id: 'iniciativa', rotulo: 'Iniciativa', unidade: 'pontos' },
  { id: 'deslocamento', rotulo: 'Deslocamento', unidade: 'metros', velocidade: 'base_bonus' },
  { id: 'voo', rotulo: 'Voo', unidade: 'metros', velocidade: 'voo' },
  { id: 'natacao', rotulo: 'Natação', unidade: 'metros', velocidade: 'natacao' },
  { id: 'escalada', rotulo: 'Escalada (igual ao deslocamento)', unidade: 'metros', velocidade: 'escalada' },
  { id: 'ataque_magia', rotulo: 'Ataque de magia', unidade: 'pontos' },
  { id: 'cd_magia', rotulo: 'CD de magia', unidade: 'pontos' },
];

/**
 * Monta a entrada de `efeitos_magicos` de um modificador manual.
 * @param {{nome?: string, alvo: string, valor: number|string}} dados
 * @returns {object|null} null se o alvo é desconhecido ou o valor não é um inteiro diferente de zero.
 */
export function criarModificadorManual({ nome, alvo, valor }) {
  const def = ALVOS_MODIFICADOR.find(a => a.id === alvo);
  const n = Number(valor);
  if (!def || !Number.isInteger(n) || n === 0 || valor === '' || valor === null) return null;
  const rotulo = String(nome || '').trim() || def.rotulo;
  if (def.velocidade) {
    return { nome: rotulo, tipo: 'deslocamento', tipo_velocidade: def.velocidade, valor_metros: n, manual: true, temporario: true };
  }
  return { nome: rotulo, tipo: 'modificador_manual', alvo, valor: n, manual: true, temporario: true };
}

/** Texto curto de um modificador manual na lista do modal (ex.: "CA +3"). */
function descreverModificador(ef) {
  const alvoId = ef.tipo === 'deslocamento'
    ? (ALVOS_MODIFICADOR.find(a => a.velocidade === ef.tipo_velocidade)?.id || 'deslocamento')
    : ef.alvo;
  const def = ALVOS_MODIFICADOR.find(a => a.id === alvoId);
  const valor = ef.tipo === 'deslocamento' ? ef.valor_metros : ef.valor;
  const sinal = valor > 0 ? '+' : '';
  return `${def?.rotulo || alvoId} ${sinal}${valor}${def?.unidade === 'metros' ? ' m' : ''}`;
}

/** Abre o modal "Modificadores Temporários": lista, remove e adiciona modificadores manuais. */
export function abrirModalModificadores() {
  const efeitos = char.efeitos_magicos || [];
  const manuais = efeitos.map((ef, i) => ({ ef, i })).filter(({ ef }) => ef.manual);
  const lista = manuais.length === 0
    ? '<div style="color:var(--text-muted);font-size:0.85rem;margin-bottom:8px">Nenhum modificador ativo.</div>'
    : manuais.map(({ ef, i }) => `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          <span style="flex:1;font-size:0.85rem"><strong>${escHtml(ef.nome)}</strong> — ${escHtml(descreverModificador(ef))}</span>
          <button type="button" class="btn btn-sm btn-danger btn-icon" data-modificador-remover="${i}" title="Remover">&times;</button>
        </div>`).join('');

  abrirModal('Modificadores Temporários', `
    <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:8px">
      Buffs que vêm de aliados ou de itens. Informe o ganho líquido (ex.: +3 de CA). São removidos no Descanso Longo.
    </div>
    ${lista}
    <div class="section-divider"><span>Adicionar</span></div>
    <div class="form-group">
      <label class="form-label" for="mod-alvo">O que muda</label>
      <select class="form-input" id="mod-alvo">
        ${ALVOS_MODIFICADOR.map(a => `<option value="${a.id}">${escHtml(a.rotulo)} (${a.unidade})</option>`).join('')}
      </select>
    </div>
    <div class="row gap-1">
      <div class="col">
        <label class="form-label" for="mod-valor">Valor</label>
        <input type="number" class="form-input" id="mod-valor" step="1" placeholder="Ex.: 3 ou -2">
      </div>
      <div class="col">
        <label class="form-label" for="mod-nome">Origem (opcional)</label>
        <input type="text" class="form-input" id="mod-nome" placeholder="Ex.: Armadura Arcana do aliado">
      </div>
    </div>
    <div id="mod-erro" style="display:none;color:var(--danger);font-size:0.8rem;margin-top:8px"></div>
  `, '<button class="btn btn-secondary" onclick="fecharModal()">Fechar</button><button class="btn btn-primary" id="btn-adicionar-modificador">Adicionar</button>');

  document.querySelectorAll('[data-modificador-remover]').forEach(btn => {
    btn.addEventListener('click', () => {
      const i = parseInt(btn.dataset.modificadorRemover);
      if (char.efeitos_magicos?.[i]?.manual) char.efeitos_magicos.splice(i, 1);
      salvar();
      renderFichaCompleta();
      window.fecharModal();
      abrirModalModificadores();
    });
  });

  document.getElementById('btn-adicionar-modificador')?.addEventListener('click', () => {
    const novo = criarModificadorManual({
      nome: document.getElementById('mod-nome')?.value,
      alvo: document.getElementById('mod-alvo')?.value,
      valor: document.getElementById('mod-valor')?.value,
    });
    if (!novo) {
      const erro = document.getElementById('mod-erro');
      if (erro) { erro.style.display = 'block'; erro.textContent = 'Informe um valor inteiro diferente de zero.'; }
      return;
    }
    if (!Array.isArray(char.efeitos_magicos)) char.efeitos_magicos = [];
    char.efeitos_magicos.push(novo);
    salvar();
    renderFichaCompleta();
    window.fecharModal();
    abrirModalModificadores();
  });
}
