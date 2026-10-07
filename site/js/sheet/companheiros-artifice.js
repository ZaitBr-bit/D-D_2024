// ============================================================
// Ficha: seção "Companheiros do Artífice" -- cartões do Defensor de Aço,
// Canhão Místico e Servo Homúnculo, com números calculados e PV atual.
// ============================================================
import { char, salvar } from './estado.js';
import { escHtml, toast, bonusProficiencia } from '../utils.js';
import { getCriaturasArtifice } from '../db.js';
import { nivelNa, nivelTotal } from '../regras-multiclasse.js';
import { modInt } from '../regras-artifice.js';
import {
  companheirosDisponiveis, estadoCompanheiros, estatisticasCriatura, maxInstancias, criarCompanheiro,
  dispensarCompanheiro, ajustarPVCompanheiro, usarRepararDefensor, reviverDefensor, vagasCanhao,
} from '../regras-criaturas-artifice.js';
import { consumirEspacoMagiaDisponivel } from './magias.js';
import { reservasDeEspacos } from './reservas-espacos.js';
import { renderFichaCompleta } from './ficha.js';
import { abrirModalPVCriatura } from './pv-criatura.js';

let _criaturas = [];

/** Carrega criaturas.json uma vez (chamado antes do primeiro render da ficha). */
export async function carregarCriaturasArtifice() {
  if (!_criaturas.length) _criaturas = (await getCriaturasArtifice())?.criaturas || [];
}

/** Círculo usado para o Servo Homúnculo: o da instância, ou 2. */
function circuloServo(inst) {
  return Number(inst?.circulo) || 2;
}

/** Cartão de uma instância de criatura. */
function cartao(criatura, i, inst) {
  const est = estatisticasCriatura(criatura, char, { circulo: circuloServo(inst) });
  const id = criatura.id;
  const ehCanhao = id === 'canhao-mistico';
  const nivel = nivelNa(char, 'Artífice') || 0;
  const destruido = id === 'defensor-de-aco' && inst.pv_atual <= 0;
  return `
    <div class="opcao-card" style="padding:10px 12px;margin-bottom:8px" data-companheiro-cartao="${escHtml(id)}">
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <strong>${escHtml(criatura.nome)}${maxInstancias(id, char) > 1 ? ` ${i + 1}` : ''}${id === 'servo-homunculo' ? ` (${circuloServo(inst)}º círculo)` : ''}</strong>
        <span class="badge badge-secondary">CA ${est.ca}</span>
        <span class="badge badge-secondary">PV ${inst.pv_atual}/${est.pvMax}</span>
        ${destruido ? '<span class="badge badge-secondary" style="color:var(--danger,#c0392b)">Destruído</span>' : ''}
        ${criatura.deslocamento ? `<span style="font-size:0.75rem;color:var(--text-muted)">${escHtml(criatura.deslocamento)}</span>` : ''}
      </div>
      <div style="font-size:0.8rem;margin-top:6px">${est.acoes.filter((a) => !a.nome.startsWith('Reparar')).map((a) => `<div><strong>${escHtml(a.nome)}.</strong> ${escHtml(a.texto)}</div>`).join('')}</div>
      ${(criatura.tracos || []).map((t) => `<div style="font-size:0.78rem;color:var(--text-muted)"><strong>${escHtml(t.nome)}.</strong> ${escHtml(t.descricao)}</div>`).join('')}
      ${est.reacoes.map((t) => `<div style="font-size:0.78rem;color:var(--text-muted)"><strong>${escHtml(t.nome)} (Reação).</strong> ${escHtml(t.texto)}</div>`).join('')}
      <div class="no-print" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:6px">
        <button class="btn btn-sm btn-danger"${destruido ? ' disabled' : ''} data-artifice-acao="companheiro-dano" data-companheiro="${escHtml(id)}" data-i="${i}" data-pv-max="${est.pvMax}">Dano</button>
        <button class="btn btn-sm btn-success"${destruido ? ' disabled' : ''} data-artifice-acao="companheiro-cura" data-companheiro="${escHtml(id)}" data-i="${i}" data-pv-max="${est.pvMax}">Cura</button>
        ${destruido ? '<button class="btn btn-sm btn-accent" data-artifice-acao="defensor-reviver">Reviver (gasta espaço)</button>' : ''}
        ${id === 'defensor-de-aco' && !destruido ? `<button class="btn btn-sm btn-accent" data-artifice-acao="defensor-reparar"${estadoCompanheiros(char).reparar_defensor_gastos >= 3 ? ' disabled' : ''}>Reparar (${Math.max(0, 3 - estadoCompanheiros(char).reparar_defensor_gastos)}/3)</button>` : ''}
        ${ehCanhao && nivel >= 9 ? `<button class="btn btn-sm btn-danger" data-artifice-acao="canhao-detonar" data-i="${i}">Detonar</button>` : ''}
        <button class="btn btn-sm btn-secondary" data-artifice-acao="companheiro-dispensar" data-companheiro="${escHtml(id)}" data-i="${i}">Dispensar</button>
      </div>
    </div>`;
}

/** Botões de criação de um companheiro (canhão: grátis ou, depois de usada a criação grátis, gastando espaço). */
function botoesCriar(id, e) {
  if (id === 'canhao-mistico') {
    return e.canhao_gratis_usado
      ? `<button class="btn btn-sm btn-secondary" data-artifice-acao="companheiro-criar-espaco" data-companheiro="${escHtml(id)}">${vagasCanhao(char) > 1 ? 'Criar 2 canhões gastando 2 espaços' : 'Criar gastando espaço'}</button>`
      : `<button class="btn btn-sm btn-accent" data-artifice-acao="companheiro-criar" data-companheiro="${escHtml(id)}">${vagasCanhao(char) > 1 ? 'Criar 2 canhões (grátis)' : 'Criar canhão (grátis)'}</button>`;
  }
  if (id === 'servo-homunculo') {
    return `<select class="form-input" style="width:auto" id="servo-circulo">${[2, 3, 4, 5].map((c) => `<option value="${c}">${c}º círculo</option>`).join('')}</select>
           <button class="btn btn-sm btn-accent" data-artifice-acao="companheiro-criar" data-companheiro="${escHtml(id)}">Registrar servo</button>
           <span style="font-size:0.75rem;color:var(--text-muted)">Magia já lançada na lista de magias</span>`;
  }
  return `<button class="btn btn-sm btn-accent" data-artifice-acao="companheiro-criar" data-companheiro="${escHtml(id)}">Criar</button>`;
}

/** HTML da seção; vazio quando o personagem não tem companheiro disponível. */
export function renderSecaoCompanheirosArtifice() {
  const ids = companheirosDisponiveis(char);
  if (!ids.length || !_criaturas.length) return '';
  const e = estadoCompanheiros(char);
  const blocos = ids.map((id) => {
    const criatura = _criaturas.find((c) => c.id === id);
    if (!criatura) return '';
    const lista = e.companheiros[id] || [];
    const criar = lista.length < maxInstancias(id, char) ? botoesCriar(id, e) : '';
    return `${lista.map((inst, i) => cartao(criatura, i, inst)).join('')}<div class="no-print" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">${criar}</div>`;
  }).join('');
  return `
    <div class="card" id="secao-companheiros-artifice">
      <div class="card-header"><h2>Companheiros do Artífice</h2></div>
      <div style="padding:8px 12px">${blocos}</div>
    </div>`;
}

/** PV máximo da instância (para criar e aplicar PV). */
function pvMaxDe(id, inst) {
  const criatura = _criaturas.find((c) => c.id === id);
  return criatura ? estatisticasCriatura(criatura, char, { circulo: circuloServo(inst) }).pvMax : 0;
}

/**
 * Cria o companheiro. O espaço de magia só é gasto quando o canhão já usou a
 * criação grátis e ainda há vaga; devolve false (sem gastar nada) se não puder criar.
 */
function criarPelaFicha(id, gastouEspaco) {
  const e = estadoCompanheiros(char);
  const circulo = id === 'servo-homunculo' ? Number(document.getElementById('servo-circulo')?.value || 2) : 2;
  if (id === 'canhao-mistico') {
    const vaga = (e.companheiros[id] || []).length < maxInstancias(id, char);
    if (!vaga) { toast('Não é possível criar agora.', 'error'); return false; }
    if (gastouEspaco && !e.canhao_gratis_usado) { toast('A criação grátis ainda está disponível.', 'error'); return false; }
    if (!gastouEspaco && e.canhao_gratis_usado) { toast('A criação grátis já foi usada neste Descanso Longo.', 'error'); return false; }
    if (gastouEspaco) {
      // Um espaço por canhão criado; confere todos antes de gastar qualquer um.
      const necessarios = vagasCanhao(char);
      const disponiveis = reservasDeEspacos().filter((r) => r.fonte === 'conjuracao').reduce((s, r) => s + r.disponiveis, 0);
      if (disponiveis < necessarios) { toast(`Sem espaço de magia suficiente (${necessarios} necessário(s)).`, 'error'); return false; }
      for (let k = 0; k < necessarios; k++) consumirEspacoMagiaDisponivel(1);
    }
  }
  if (!criarCompanheiro(char, id, pvMaxDe(id, { circulo }), { circulo, gastouEspaco })) { toast('Não é possível criar agora.', 'error'); return false; }
  return true;
}

/** Reviver o Defensor de Aço em 0 PV: gasta um espaço de magia e restaura todos os PV. Falha sem gastar nada se ele não está em 0 PV ou não há espaço. */
function reviverPelaFicha() {
  const inst = (estadoCompanheiros(char).companheiros['defensor-de-aco'] || [])[0];
  if (!inst || inst.pv_atual > 0) { toast('O defensor não está destruído.', 'error'); return false; }
  if (!consumirEspacoMagiaDisponivel(1)) { toast('Sem espaço de magia disponível.', 'error'); return false; }
  reviverDefensor(char, pvMaxDe('defensor-de-aco', inst));
  toast('Defensor de Aço restaurado com todos os PV.', 'success');
  return true;
}

/** Liga os botões da seção (o listener geral de setupEventosArtifice ignora estas ações). */
export function setupEventosCompanheirosArtifice() {
  document.querySelectorAll('#secao-companheiros-artifice [data-artifice-acao]').forEach((btn) => {
    btn.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const acao = btn.dataset.artificeAcao;
      const id = btn.dataset.companheiro;
      const i = Number(btn.dataset.i);
      if (acao === 'companheiro-criar' || acao === 'companheiro-criar-espaco') {
        if (!criarPelaFicha(id, acao === 'companheiro-criar-espaco')) return;
      } else if (acao === 'companheiro-dispensar') {
        dispensarCompanheiro(char, id, i);
      } else if (acao === 'companheiro-dano' || acao === 'companheiro-cura') {
        // Mesmo modal de dano/cura do personagem; grava e redesenha só ao confirmar.
        const dano = acao === 'companheiro-dano';
        const pvMax = Number(btn.dataset.pvMax);
        const criatura = _criaturas.find((c) => c.id === id);
        abrirModalPVCriatura({
          nome: criatura?.nome || 'Companheiro', tipo: dano ? 'dano' : 'cura', pvMax,
          aoAplicar: (valor) => {
            ajustarPVCompanheiro(char, id, i, dano ? -valor : valor, pvMax);
            salvar();
            renderFichaCompleta();
          },
        });
        return;
      } else if (acao === 'defensor-reparar') {
        if (!usarRepararDefensor(char)) { toast('Reparar esgotado até o Descanso Longo.', 'error'); return; }
        toast('Reparar: 2d8 + mod. Int PV (role e aplique).', 'info');
      } else if (acao === 'defensor-reviver') {
        if (!reviverPelaFicha()) return;
      } else if (acao === 'canhao-detonar') {
        dispensarCompanheiro(char, 'canhao-mistico', i);
        const cdDetonar = 8 + bonusProficiencia(nivelTotal(char)) + modInt(char);
        toast(`Quando o canhão sofre dano, Detonar (Reação, você a até 18 m dele): criaturas a até 6 m do canhão fazem salvaguarda de Destreza (CD ${cdDetonar}); 3d10 de dano Energético (metade no sucesso).`, 'info');
      } else return;
      salvar();
      renderFichaCompleta();
    });
  });
}
