// ============================================================
// Ficha: Forma Selvagem do Druida.
//
// Ativar abre a tela de escolha entre as formas conhecidas (cards com ficha
// técnica em popup); escolhida a forma, a ficha mostra o card "Forma
// Selvagem" com destaque de ATIVA, os números da forma e os botões de trocar
// e sair. "Gerenciar formas conhecidas" escolhe, entre as Feras elegíveis do
// nível, as formas que o druida conhece. A regra vive em
// regras-forma-selvagem.js.
// ============================================================
import { char, salvar } from './estado.js';
import { seloFonte, ligarSelosFonte } from '../fontes.js';
import { abrirModal, calcMod, escHtml, semAcento, toast } from '../utils.js';
import { atributoEfetivo } from '../regras-atributos.js';
import { nivelNa, subclasseDe } from '../regras-multiclasse.js';
import { renderFichaCompleta } from './ficha.js';
import { abrirPopupSobreposto, cardForma, criaturasApendice, fichaTecnica } from './familiar.js';
import { consumirUsoFormaSelvagem, getEstadoRecursosDruida } from './classes/druida.js';
import {
  FORMAS_RECOMENDADAS, assumirForma, caNaForma, definirFormasConhecidas, duracaoHoras, estadoFormaSelvagem,
  formasConhecidas, formasElegiveis, limitesFormas, ndNumero, pvTemporariosDaForma, sairDaForma, temVoo,
} from '../regras-forma-selvagem.js';

/** Nível e subclasse do personagem NA classe Druida (nunca os espelhos). */
function contextoDruida() {
  return { nivel: nivelNa(char, 'Druida') || 0, subclasse: subclasseDe(char, 'Druida') || '' };
}

/**
 * Se a magia pode ser conjurada agora. Em Forma Selvagem o druida não
 * conjura (o Círculo da Lua é a exceção). Devolve o motivo do bloqueio, ou
 * null quando pode.
 * @returns {string|null}
 */
export function motivoSemConjuracaoEmForma() {
  const forma = estadoFormaSelvagem(char);
  if (!forma) return null;
  if (contextoDruida().subclasse === 'Círculo da Lua') return null;
  return `Em Forma Selvagem (${forma.forma}) você não pode conjurar magias. Saia da forma primeiro.`;
}

/**
 * Agrupa as formas por ND, do maior para o menor; dentro do grupo, em ordem
 * alfabética.
 * @param {Array<object>} formas Criaturas.
 * @returns {Array<[string, Array<object>]>} Pares [ND como texto, formas].
 */
export function gruposPorND(formas) {
  const mapa = new Map();
  for (const c of formas) {
    const nd = String(c.nd).split(' ')[0];
    if (!mapa.has(nd)) mapa.set(nd, []);
    mapa.get(nd).push(c);
  }
  return [...mapa.entries()]
    .sort((a, b) => ndNumero(b[0]) - ndNumero(a[0]))
    .map(([nd, lista]) => [nd, lista.sort((x, y) => x.nome.localeCompare(y.nome, 'pt-BR'))]);
}

/**
 * Seletor de formas em cards: o nome abre a ficha técnica em popup e o
 * círculo seleciona, até `max` formas.
 * @param {object} cfg
 * @param {string} cfg.titulo Título do modal.
 * @param {Array<object>} cfg.formas Criaturas oferecidas.
 * @param {string[]} cfg.selecionadas Nomes pré-selecionados.
 * @param {number} cfg.max Máximo de seleções.
 * @param {string} cfg.notaHtml HTML explicativo no topo.
 * @param {string} cfg.rotuloConfirmar Texto do botão de confirmar.
 * @param {string} cfg.idConfirmar Id do botão de confirmar.
 * @param {string} [cfg.extraHtml] HTML extra abaixo da nota (ex.: botão de gerenciar).
 * @param {number} [cfg.minimo] Mínimo de seleções para confirmar.
 * @param {(nomes: string[]) => void} cfg.aoConfirmar Recebe os nomes escolhidos.
 * @param {() => void} [cfg.aoLigarExtra] Liga os controles de `extraHtml`.
 */
function abrirSeletorFormas(cfg) {
  const selecionadas = new Set(cfg.selecionadas || []);
  const minimo = cfg.minimo ?? 1;
  let busca = '';
  const criaturaDe = (nome) => criaturasApendice().find((c) => c.nome === nome);

  const desenhar = () => {
    const corpo = document.getElementById('forma-selvagem-selecao');
    if (!corpo) return;
    const lista = cfg.formas.filter((c) => !busca || semAcento(c.nome).includes(semAcento(busca)));
    corpo.innerHTML = `
      ${cfg.notaHtml}
      ${cfg.extraHtml || ''}
      <div style="font-size:0.8rem;color:var(--text-muted);margin:6px 0">Selecionadas: <strong>${selecionadas.size}</strong> / ${cfg.max}</div>
      <div class="search-box" style="margin-bottom:6px"><input type="text" id="forma-selvagem-busca" placeholder="Buscar forma..." class="form-input" value="${escHtml(busca)}"></div>
      ${gruposPorND(lista).map(([nd, formas]) => `
        <div style="font-size:0.75rem;font-weight:700;color:var(--secondary);margin:10px 0 4px" data-forma-grupo-nd="${escHtml(nd)}">ND ${escHtml(nd)} · ${formas.length}</div>
        <div class="opcao-grid densa">${formas.map((c) => cardForma(c, selecionadas.has(c.nome))).join('')}</div>`).join('')}
      ${lista.length ? '' : '<div style="font-size:0.8rem;color:var(--text-muted)">Nenhuma forma encontrada.</div>'}`;
    ligarSelosFonte(corpo);
    const botao = document.getElementById(cfg.idConfirmar);
    const pode = selecionadas.size >= minimo;
    if (botao) { botao.disabled = !pode; botao.style.opacity = pode ? '' : '0.5'; }

    const alternar = (nome) => {
      if (selecionadas.has(nome)) selecionadas.delete(nome);
      else if (cfg.max === 1) { selecionadas.clear(); selecionadas.add(nome); }
      else if (selecionadas.size >= cfg.max) { toast(`Limite de ${cfg.max} formas. Desmarque uma antes.`, 'error'); return; }
      else selecionadas.add(nome);
      desenhar();
    };
    corpo.querySelectorAll('[data-familiar-toggle]').forEach((el) => el.addEventListener('click', (e) => {
      e.stopPropagation();
      alternar(el.dataset.familiarToggle);
    }));
    corpo.querySelectorAll('[data-familiar-info]').forEach((el) => el.addEventListener('click', (e) => {
      e.stopPropagation();
      const c = criaturaDe(el.dataset.familiarInfo);
      if (!c) return;
      abrirPopupSobreposto(c.nome, `
        <p style="font-size:0.8rem;color:var(--text-muted)">${escHtml(c.tipo_tamanho)} · ND ${escHtml(String(c.nd).split(' ')[0])}${temVoo(c) ? ' · Voo' : ''} ${seloFonte(c.fonte)}</p>${fichaTecnica(c)}`,
      { rotulo: selecionadas.has(c.nome) ? 'Desmarcar esta forma' : 'Escolher esta forma', aoClicar: () => alternar(c.nome) });
    }));
    document.getElementById('forma-selvagem-busca')?.addEventListener('input', (e) => {
      busca = e.target.value;
      desenhar();
      const campo = document.getElementById('forma-selvagem-busca');
      campo?.focus();
      campo?.setSelectionRange(busca.length, busca.length);
    });
    cfg.aoLigarExtra?.();
  };

  abrirModal(cfg.titulo, '<div id="forma-selvagem-selecao"></div>',
    '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>'
    + `<button class="btn btn-primary" id="${cfg.idConfirmar}" disabled>${cfg.rotuloConfirmar}</button>`);
  desenhar();
  document.getElementById(cfg.idConfirmar)?.addEventListener('click', () => {
    if (selecionadas.size < minimo) return;
    window.fecharModal();
    cfg.aoConfirmar([...selecionadas]);
  });
}

/**
 * Tela de formas conhecidas: o druida escolhe, entre as Feras elegíveis, as
 * formas que conhece (até o limite do nível).
 * @param {() => void} [aoFim] Chamado depois de salvar.
 */
export function abrirGerenciarFormas(aoFim) {
  const { nivel, subclasse } = contextoDruida();
  const lim = limitesFormas(nivel, subclasse);
  if (!lim) { toast('A Forma Selvagem começa no nível 2 de Druida.', 'error'); return; }
  const elegiveis = formasElegiveis(criaturasApendice(), nivel, subclasse);
  const nomesElegiveis = new Set(elegiveis.map((c) => c.nome));
  const atuais = formasConhecidas(char, lim.conhecidas).filter((n) => nomesElegiveis.has(n));
  const inicial = atuais.length ? atuais : FORMAS_RECOMENDADAS.filter((n) => nomesElegiveis.has(n)).slice(0, lim.conhecidas);
  abrirSeletorFormas({
    titulo: 'Formas conhecidas',
    formas: elegiveis,
    selecionadas: inicial,
    max: lim.conhecidas,
    minimo: 1,
    notaHtml: `<div class="info-box info" style="font-size:0.8rem">
      Você conhece até <strong>${lim.conhecidas}</strong> formas Animais: Feras de ND até ${lim.nd < 1 ? '1/' + Math.round(1 / lim.nd) : lim.nd}${lim.voo ? ', com ou sem voo' : ', sem Deslocamento de Voo'}.
      Ao completar um Descanso Longo você pode trocar uma delas. Recomendadas pelo livro: ${FORMAS_RECOMENDADAS.join(', ')}.</div>`,
    rotuloConfirmar: 'Salvar formas',
    idConfirmar: 'btn-salvar-formas-conhecidas',
    aoConfirmar: (nomes) => {
      definirFormasConhecidas(char, nomes, lim.conhecidas);
      salvar();
      renderFichaCompleta();
      toast(`${nomes.length} forma(s) conhecida(s) salva(s).`, 'success');
      aoFim?.();
    },
  });
}

/**
 * Ativar (ou trocar) a Forma Selvagem: escolhe entre as formas conhecidas e
 * gasta um uso. Sem formas conhecidas, abre antes a tela de formas conhecidas.
 */
export function iniciarFormaSelvagem() {
  const estado = getEstadoRecursosDruida();
  if (!estado) return;
  const { nivel, subclasse } = contextoDruida();
  const lim = limitesFormas(nivel, subclasse);
  if (!lim) { toast('A Forma Selvagem começa no nível 2 de Druida.', 'error'); return; }
  if (estado.usosDisponiveis <= 0) { toast('Sem usos de Forma Selvagem disponíveis.', 'error'); return; }

  const elegiveis = formasElegiveis(criaturasApendice(), nivel, subclasse);
  const nomesElegiveis = new Set(elegiveis.map((c) => c.nome));
  const conhecidas = formasConhecidas(char, lim.conhecidas).filter((n) => nomesElegiveis.has(n));
  if (!conhecidas.length) { abrirGerenciarFormas(() => iniciarFormaSelvagem()); return; }

  const atual = estadoFormaSelvagem(char);
  const horas = duracaoHoras(nivel);
  const pvTemp = pvTemporariosDaForma(nivel, subclasse);
  abrirSeletorFormas({
    titulo: 'Forma Selvagem',
    formas: elegiveis.filter((c) => conhecidas.includes(c.nome)),
    selecionadas: [],
    max: 1,
    notaHtml: `
      ${atual ? `<div class="info-box warning" style="font-size:0.8rem;margin-bottom:8px">Você já está em Forma Selvagem (${escHtml(atual.forma)}). Assumir outra forma gasta outro uso.</div>` : ''}
      <div class="info-box info" style="font-size:0.8rem">
        Ação Bônus. Gasta <strong>1 uso</strong> (${estado.usosDisponiveis} restante(s)). Dura <strong>${horas} h</strong>;
        você ganha <strong>${pvTemp} PV temporários</strong> e não conjura magias${subclasse === 'Círculo da Lua' ? ' (exceto as do Círculo da Lua)' : ''}.
        Suas estatísticas de jogo passam a ser as da Fera; você mantém PV, Dados de Vida, Int, Sab e Car.</div>`,
    extraHtml: `<div style="margin-top:6px"><button class="btn btn-sm btn-secondary" id="btn-gerenciar-formas">Gerenciar formas conhecidas (${conhecidas.length}/${lim.conhecidas})</button></div>`,
    aoLigarExtra: () => document.getElementById('btn-gerenciar-formas')?.addEventListener('click', () => {
      window.fecharModal();
      abrirGerenciarFormas(() => iniciarFormaSelvagem());
    }),
    rotuloConfirmar: 'Assumir forma',
    idConfirmar: 'btn-confirmar-forma-selvagem',
    aoConfirmar: ([nome]) => {
      const criatura = criaturasApendice().find((c) => c.nome === nome);
      if (!criatura) return;
      if (!consumirUsoFormaSelvagem(1)) { toast('Sem usos de Forma Selvagem disponíveis.', 'error'); return; }
      const r = assumirForma(char, criatura, { nivel, subclasse });
      salvar();
      renderFichaCompleta();
      toast(`Forma Selvagem ATIVA: ${r.forma}. +${r.pvTemporarios} PV temporários, por ${r.horas} h. Você não conjura magias.`, 'success');
      // Leva a tela ao card da forma ativa, que fica no topo da ficha.
      document.getElementById('card-forma-selvagem')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
  });
}

/** Sai da Forma Selvagem (Ação Bônus). */
export function encerrarFormaSelvagem() {
  if (!sairDaForma(char)) return;
  salvar();
  renderFichaCompleta();
  toast('Você saiu da Forma Selvagem.', 'success');
}

/**
 * Card "Forma Selvagem ATIVA", logo abaixo do cabeçalho da ficha. Vazio
 * quando o druida não está em forma.
 * @returns {string} HTML do card.
 */
export function renderSecaoFormaSelvagem() {
  const forma = estadoFormaSelvagem(char);
  if (!forma) return '';
  const c = criaturasApendice().find((x) => x.nome === forma.forma);
  const { subclasse } = contextoDruida();
  const modSab = calcMod(atributoEfetivo(char, 'sabedoria') || 10);
  const lua = subclasse === 'Círculo da Lua';
  return `
    <div class="card" id="card-forma-selvagem" style="border:2px solid var(--success)">
      <div class="card-header"><h2>Forma Selvagem</h2>
        <span class="badge" style="background:var(--success);color:#fff;font-size:0.8rem">ATIVA · ${escHtml(forma.forma)}</span></div>
      <div class="opcao-card" data-forma-selvagem-ficha="1" style="padding:10px 12px;cursor:pointer" title="Clique para ver a ficha técnica da forma">
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <strong>${escHtml(forma.forma)}</strong>
          ${c ? `<span class="badge badge-secondary">${escHtml(c.tipo_tamanho)}</span>
          <span class="badge badge-secondary">CA ${caNaForma(c, subclasse, modSab)}</span>
          <span class="badge badge-secondary">${escHtml(c.deslocamento || '')}</span>
          <span class="badge badge-secondary">ND ${escHtml(String(c.nd).split(' ')[0])}</span>` : ''}
          <span class="badge badge-secondary">PV temp. ${char.pv_temporario || 0}</span>
        </div>
        <div style="font-size:0.78rem;color:var(--text-muted);margin-top:4px">
          Suas estatísticas de jogo são as da Fera${lua ? ' (CA mínima 13 + Sabedoria)' : ''}; você mantém PV, Dados de Vida, Int, Sab e Car, idiomas e talentos.
          Dura ${forma.horas} h, até você usar Forma Selvagem de novo, ficar Incapacitado ou morrer.
          ${lua ? 'Círculo da Lua: você conjura as magias do Círculo na forma.' : '<strong>Você não conjura magias nesta forma.</strong>'}
        </div>
        <div class="no-print" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">
          <button class="btn btn-sm btn-accent" data-druida-forma-acao="ativar" title="Gasta outro uso de Forma Selvagem">Trocar de forma</button>
          <button class="btn btn-sm btn-secondary" data-druida-forma-acao="encerrar" title="Ação Bônus">Sair da forma</button>
        </div>
      </div>
    </div>`;
}

/** Liga o clique do card para abrir a ficha técnica da forma. */
export function setupEventosFormaSelvagem() {
  document.querySelectorAll('[data-forma-selvagem-ficha]').forEach((el) => el.addEventListener('click', (e) => {
    if (e.target.closest('button')) return;
    const forma = estadoFormaSelvagem(char);
    const c = forma && criaturasApendice().find((x) => x.nome === forma.forma);
    if (!c) return;
    abrirPopupSobreposto(`Forma Selvagem: ${c.nome}`,
      `<p style="font-size:0.8rem;color:var(--text-muted)">${escHtml(c.tipo_tamanho)} · ND ${escHtml(String(c.nd).split(' ')[0])}</p>${fichaTecnica(c)}`);
  }));
}
