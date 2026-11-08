// ============================================================
// Ficha: Lâmina Maldita (Bruxo, Xanathar). Card com a Maldição, a Armadura
// de Maldições e o Espectro Amaldiçoado. A regra vive em regras-lamina-maldita.js.
// ============================================================
import { char, salvar } from './estado.js';
import { escHtml, toast } from '../utils.js';
import { getCriaturasXanathar } from '../db.js';
import { renderFichaCompleta } from './ficha.js';
import { abrirPopupSobreposto, fichaTecnica } from './familiar.js';
import { estaIncapacitado } from '../regras-condicoes.js';
import { nivelNa, nivelTotal } from '../regras-multiclasse.js';
import {
  alvoMorreu, amaldicoar, bonusAtaqueEspectro, curaAlvoMorreu, dispensarEspectro, ehLaminaMaldita,
  encerrarMaldicao, levantarEspectro, maldicaoAtiva, podeArmaduraMaldicoes, podeLevantarEspectro,
  podePassarMaldicao, pvTemporariosEspectro, resultadoArmaduraMaldicoes,
} from '../regras-lamina-maldita.js';

let _criaturas = [];

// Estado só de tela: escolha "curar ou passar" aberta e último resultado da Armadura.
let _escolhendoAlvo = false;
let _resultadoArmadura = '';

/** Carrega o Espectro do Xanathar uma vez (chamado antes do primeiro render da ficha). */
export async function carregarCriaturasLaminaMaldita() {
  if (!_criaturas.length) _criaturas = (await getCriaturasXanathar())?.criaturas || [];
}

/** Ficha técnica do Espectro, ou undefined se o dado não carregou. */
function espectro() {
  return _criaturas.find((c) => c.nome === 'Espectro');
}

/** Bônus de ataque do corpo a corpo do bloco da criatura (o "+4 para acertar"); 0 se não achar. */
function bonusBaseAtaque(c) {
  const m = /\+(\d+) para acertar/.exec(c?.acoes?.[0]?.descricao || '');
  return m ? Number(m[1]) : 0;
}

/** Botão de ação; desabilitado mostra o motivo no title. */
function botao(acao, rotulo, { classe = 'btn-secondary', motivo = '' } = {}) {
  const base = `class="btn btn-sm ${classe}"`;
  const off = motivo ? ` disabled title="${escHtml(motivo)}"` : '';
  const atr = {
    'amaldicoar': `<button ${base} data-lamina-maldita-acao="amaldicoar"${off}>${rotulo}</button>`,
    'alvo-morreu': `<button ${base} data-lamina-maldita-acao="alvo-morreu"${off}>${rotulo}</button>`,
    'curar': `<button ${base} data-lamina-maldita-acao="curar"${off}>${rotulo}</button>`,
    'passar': `<button ${base} data-lamina-maldita-acao="passar"${off}>${rotulo}</button>`,
    'encerrar': `<button ${base} data-lamina-maldita-acao="encerrar"${off}>${rotulo}</button>`,
    'armadura': `<button ${base} data-lamina-maldita-acao="armadura"${off}>${rotulo}</button>`,
    'levantar-espectro': `<button ${base} data-lamina-maldita-acao="levantar-espectro"${off}>${rotulo}</button>`,
    'dispensar-espectro': `<button ${base} data-lamina-maldita-acao="dispensar-espectro"${off}>${rotulo}</button>`,
  };
  return atr[acao];
}

/** Motivo de a Maldição não poder ser lançada agora; vazio se pode (leitura, sem gravar). */
function motivoSemAmaldicoar(estado) {
  if (estaIncapacitado(char.condicoes || [])) return 'Incapacitado: não é possível lançar a Maldição.';
  if (estado.maldicao_ativa) return 'A Maldição já está ativa.';
  if (estado.maldicao_usada) return 'Sem uso: recupere com um Descanso Curto ou Longo.';
  return '';
}

/** Card do Espectro levantado: PV temporários, ataque somado do Carisma e ficha técnica no clique. */
function cardEspectro(c) {
  const base = bonusBaseAtaque(c);
  const car = bonusAtaqueEspectro(char);
  return `
    <div class="opcao-card" data-lamina-maldita-espectro="1" style="padding:8px 10px;margin-top:8px;cursor:pointer" title="Clique para ver a ficha técnica">
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <strong>${escHtml(c.nome)}</strong>
        <span class="badge badge-secondary">CA ${escHtml(c.ca)}</span>
        <span class="badge badge-secondary">PV ${escHtml(c.pv)}</span>
      </div>
      <div style="font-size:0.8rem;margin-top:4px">PV temporários: ${pvTemporariosEspectro(char)}</div>
      <div style="font-size:0.8rem">${escHtml(c.acoes?.[0]?.nome || 'Ataque')}: +${base + car} para acertar (+${base} do bloco, +${car} de Carisma)</div>
      <div style="font-size:0.75rem;color:var(--text-muted)">${escHtml(c.deslocamento || '')}. Tem turnos próprios, obedece a comandos verbais e dissipa no fim do próximo Descanso Longo.</div>
      <div class="no-print" style="margin-top:6px">${botao('dispensar-espectro', 'Dispensar Espectro')}</div>
    </div>`;
}

/** Card recolhível da Lâmina Maldita; vazio fora do Patrono Lâmina Maldita nível 3+. */
export function renderSecaoLaminaMaldita() {
  if (!ehLaminaMaldita(char)) return '';
  // Leitura sem criar estado: o render não grava na ficha.
  const estado = char.recursos?.lamina_maldita || {};
  const nivel = nivelNa(char, 'Bruxo') || 0;
  const ativa = maldicaoAtiva(char);
  const escolhendo = _escolhendoAlvo && ativa;
  const c = espectro();
  const motivoMaldicao = motivoSemAmaldicoar(estado);
  const espectroAtivo = !!estado.espectro_ativo;
  const semMaldicao = 'Exige a Maldição ativa.';

  const maldicao = `
    <div class="no-print" style="display:flex;gap:6px;flex-wrap:wrap">
      ${botao('amaldicoar', 'Amaldiçoar (Ação Bônus)', { classe: 'btn-primary', motivo: motivoMaldicao })}
      ${botao('alvo-morreu', 'Alvo amaldiçoado morreu', { motivo: ativa ? '' : semMaldicao })}
      ${ativa ? botao('encerrar', 'Encerrar') : ''}
      ${nivel >= 10 ? botao('armadura', 'Armadura de Maldições (1d6)', { motivo: podeArmaduraMaldicoes(char) ? '' : semMaldicao }) : ''}
    </div>
    ${escolhendo ? `
    <div class="no-print info-box info" style="font-size:0.8rem;margin-top:8px">
      O alvo morreu: recupere ${curaAlvoMorreu(char)} PV (nível de Bruxo + mod. Carisma) e a Maldição termina${podePassarMaldicao(char) ? ', ou passe-a a outra criatura sem curar' : ''}.
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">
        ${botao('curar', 'Curar e encerrar', { classe: 'btn-success' })}
        ${podePassarMaldicao(char) ? botao('passar', 'Passar a Maldição') : ''}
      </div>
    </div>` : ''}
    ${_resultadoArmadura ? `<div data-lamina-maldita-resultado style="font-size:0.85rem;margin-top:8px"><strong>Armadura de Maldições:</strong> ${escHtml(_resultadoArmadura)}</div>` : ''}`;

  const motivoEspectro = espectroAtivo ? 'O Espectro já está em campo.' : (podeLevantarEspectro(char) ? '' : 'Sem uso: recupere com um Descanso Longo.');
  const blocoEspectro = nivel >= 6 ? `
    <div style="margin-top:10px;padding-top:8px;border-top:1px solid var(--border-light)">
      <div style="font-size:0.8rem;font-weight:700;margin-bottom:4px">Espectro Amaldiçoado</div>
      <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:6px">Ao matar um humanoide: o espírito vira um Espectro a seu serviço (1 vez por Descanso Longo).</div>
      <div class="no-print">${botao('levantar-espectro', 'Levantar Espectro', { motivo: motivoEspectro })}</div>
      ${espectroAtivo && c ? cardEspectro(c) : ''}
    </div>` : '';

  return `
  <div class="card">
    <details class="card-recolhivel" data-details-id="lamina-maldita">
      <summary class="card-header card-recolhivel-titulo">
        <h2>Lâmina Maldita</h2>
        <span class="badge ${ativa ? 'badge-success' : 'badge-secondary'}" style="margin-left:auto">${ativa ? 'Maldição ativa' : 'Inativa'}</span>
        <span class="card-recolhivel-chevron no-print">&#9660;</span>
      </summary>
      <div style="padding:8px 10px">
        <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:6px">
          Maldição: +${2 + Math.floor(((nivelTotal(char) || 1) - 1) / 4)} de dano e crítico em 19–20 contra o alvo; dura 1 minuto.
        </div>
        ${maldicao}
        ${blocoEspectro}
      </div>
    </details>
  </div>`;
}

/** Aplica a cura em PV atuais com teto no máximo e zera as salvaguardas contra a morte. */
function curarPersonagem(cura) {
  const pvMax = char.pv_max_override || char.pv_max;
  const antes = char.pv_atual || 0;
  char.pv_atual = Math.min(pvMax, antes + cura);
  if (char.pv_atual > 0) { char.morte_sucessos = 0; char.morte_falhas = 0; }
  return char.pv_atual - antes;
}

/** Liga os botões do card da Lâmina Maldita. */
export function setupEventosLaminaMaldita() {
  document.querySelector('[data-lamina-maldita-espectro]')?.addEventListener('click', (ev) => {
    if (ev.target.closest('button')) return;
    const c = espectro();
    if (c) abrirPopupSobreposto('Espectro', fichaTecnica(c));
  });
  document.querySelectorAll('[data-lamina-maldita-acao]').forEach((btn) => {
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const acao = btn.dataset.laminaMalditaAcao;
      _resultadoArmadura = acao === 'armadura' ? _resultadoArmadura : '';
      if (acao === 'alvo-morreu') {
        _escolhendoAlvo = true;
        renderFichaCompleta();
        return;
      }
      _escolhendoAlvo = false;
      if (acao === 'amaldicoar') {
        const r = amaldicoar(char);
        if (!r.ok) { toast(r.motivo, 'error'); return; }
      } else if (acao === 'curar' || acao === 'passar') {
        const r = alvoMorreu(char, acao === 'passar');
        if (r.passou) toast('Maldição passada a outra criatura; continua ativa.', 'info');
        else if (r.cura) toast(`Alvo amaldiçoado morreu: você recuperou ${curarPersonagem(r.cura)} PV.`, 'success');
      } else if (acao === 'encerrar') {
        encerrarMaldicao(char);
      } else if (acao === 'armadura') {
        const d6 = Math.floor(Math.random() * 6) + 1;
        _resultadoArmadura = `1d6 = ${d6}: o ataque ${resultadoArmaduraMaldicoes(d6)}.`;
      } else if (acao === 'levantar-espectro') {
        const r = levantarEspectro(char);
        if (!r.ok) { toast(r.motivo, 'error'); return; }
      } else if (acao === 'dispensar-espectro') {
        dispensarEspectro(char);
      }
      salvar();
      renderFichaCompleta();
    });
  });
}
