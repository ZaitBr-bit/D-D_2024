// ============================================================
// Render principal da ficha
//
// renderFichaCompleta monta a pagina inteira chamando os renderSecao*
// dos demais modulos, e restaura o estado aberto/fechado dos <details>.
// Extraido de site/js/pages/sheet.js sem alteracao de comportamento.
// ============================================================
import { ATRIBUTOS_KEYS, ATRIBUTOS_NOMES, ATRIBUTO_NOME_PARA_KEY, CLASSES_INFO, PERICIAS } from '../dados-classes.js';
import { XP_POR_NIVEL } from '../levelup.js';
import { _renderSyncIndicadorHtml } from '../pages/sheet.js';
import { resolverPassivosTalentos } from '../talentos-effects.js';
import { bonusProficiencia, calcAtaqueMagia, calcBonusPericia, calcCA, calcCDMagia, calcMod, calcPVTotal, escHtml, fmtMod, getDeslocamento, getTamanho, semAcento } from '../utils.js';
import { renderSecaoCaracteristicas, renderSecaoSubclasse, renderSecaoTracosEspecie } from './caracteristicas.js';
import { getEstadoFuria, setupEventosSubclasseBarbaro } from './classes/barbaro.js';
import { getEstadoInspiracaoBardo } from './classes/bardo.js';
import { getEstadoRecursosBruxo } from './classes/bruxo.js';
import { getEstadoRecursosDruida } from './classes/druida.js';
import { getEstadoRecursosFeiticeiro } from './classes/feiticeiro.js';
import { getEstadoRecursosGuardiao } from './classes/guardiao.js';
import { getEstadoRecursosGuerreiro } from './classes/guerreiro.js';
import { getEstadoRecursosLadino } from './classes/ladino.js';
import { getEstadoRecursosMago } from './classes/mago.js';
import { getEstadoRecursosMonge } from './classes/monge.js';
import { getEstadoRecursosPaladino } from './classes/paladino.js';
import { setupEventosDetalhesColapso, setupEventosTruquesColapso } from './colapso.js';
import { calcVantagemDesvantagemPericia, forcaPrimordialAtiva, getAtaquesPorAcao, getDeslocamentoFinal, getModIniciativa, getTruquesExtraEstiloLuta, setupEventosVantagemDesvantagem, temArmaduraPesadaEquipada } from './combate.js';
import { renderSecaoCondicoes, renderSecaoDefesas, renderSecaoSentidos, setupEventosCondicoes, setupEventosDefesas } from './condicoes.js';
import { renderSecaoDetalhes } from './detalhes.js';
import { setupEventosEdicao } from './edicao.js';
import { ATRIBUTO_ESTILO, char, containerRef, definirPassivosTalentos, especiesCache, passivosTalentosCache, salvar, seloEdicao } from './estado.js';
import { setupEventosHabilidades } from './habilidades.js';
import { setupEventosDescanso, setupEventosHP, sincronizarBonusPvAnao, sincronizarBonusPvDraconico, sincronizarBonusPvVigoroso } from './hp-descanso.js';
import { getEstadoCarga, renderSecaoInventario, setupEventosInventarioSheet } from './inventario.js';
import { ehSubclasseConjuradora, renderSecaoMagias, setupEventosEspacosMagia } from './magias.js';
import { abrirModalRecuperarDadivaEpica, precisaRecuperarDadivaEpica, renderSecaoTalentos } from './talentos.js';

/** Salva o estado open/closed de todos os <details> no container */
function salvarEstadoDetails() {
  const estado = {};
  containerRef?.querySelectorAll('details').forEach((det, i) => {
    const id = det.dataset.detailsId || det.querySelector('summary')?.textContent?.trim() || `det_${i}`;
    estado[id] = det.open;
  });
  return estado;
}

/** Restaura o estado open/closed dos <details> salvos */
function restaurarEstadoDetails(estado) {
  if (!estado || Object.keys(estado).length === 0) return;
  containerRef?.querySelectorAll('details').forEach((det, i) => {
    const id = det.dataset.detailsId || det.querySelector('summary')?.textContent?.trim() || `det_${i}`;
    if (id in estado) det.open = estado[id];
  });
}

/**
 * Painel "Recursos do Mago" -- fica no topo da ficha, sempre aberto.
 *
 * Ele existe porque os botões das características vivem no card de
 * Características de Classe, que vem RECOLHIDO: medido em 2026-08-17, o
 * botão de escolher as magias da Maestria existia no DOM com
 * `isVisible() === false`. Enquanto este painel mostrava só rótulos
 * genéricos ("Assinatura 1") e uma frase solta sobre a Maestria, a escolha
 * feita pelo jogador não aparecia em lugar nenhum que ele estivesse
 * olhando -- daí a impressão de que a Maestria "não tinha seleção".
 *
 * Regra das duas características (PHB 2024):
 * - Assinatura Mágica: cada magia 1x por Descanso Curto/Longo, de graça.
 *   Por isso os botões desabilitam depois do uso.
 * - Maestria de Magias: à vontade, no círculo mais baixo, sem gastar
 *   espaço. Por isso os botões nunca desabilitam nem debitam nada.
 */
function renderPainelRecursosMago(estadoMago) {
  // Os `data-mago-acao` abaixo são escritos LITERALMENTE, um por botão, e
  // não montados por interpolação. O motor que cobra teste para cada
  // gatilho de tela (testes/regras/unidade/gatilhos-ui-cobertos.test.mjs)
  // varre o código atrás desses literais: um `data-mago-acao="${acao}"`
  // desaparece do inventário e o botão passa a escapar da regra em
  // silêncio. Aconteceu na primeira versão deste painel.
  const corpoBotao = (nome, usada) =>
    `${escHtml(nome)}${usada ? ' (usada)' : ''}`;
  const attrsBotao = (usada) =>
    `${usada ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''} ` +
    `title="${usada ? 'Já usada neste descanso' : 'Conjurar sem gastar espaço de magia'}"`;

  const temAssinaturas = !!(estadoMago.assinatura1 || estadoMago.assinatura2);
  const temMaestria = !!(estadoMago.maestriaMagia1 || estadoMago.maestriaMagia2);

  return `
    <div class="info-box info" id="painel-recursos-mago" style="margin-bottom:10px;display:flex;flex-direction:column;gap:6px">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
        <div style="font-size:0.85rem">
          <strong>Recursos do Mago:</strong>
          Recuperação Arcana: ${estadoMago.recuperacaoArcanaUsada ? 'Usada' : `Disponível (até ${estadoMago.recuperacaoArcanaMax}º combinado)`}
        </div>
        <div class="no-print" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
          <button class="btn btn-sm btn-accent" data-mago-acao="recuperacao-arcana" ${estadoMago.recuperacaoArcanaUsada ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Recuperação Arcana</button>
        </div>
      </div>

      ${estadoMago.maestriaMagiasAtiva ? `
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;border-top:1px solid var(--border-light);padding-top:6px">
          <div style="font-size:0.85rem">
            <strong>Maestria de Magias:</strong>
            ${temMaestria ? 'à vontade, sem gastar espaço' : '<span style="color:var(--warning)">nenhuma magia escolhida</span>'}
          </div>
          <div class="no-print" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
            ${estadoMago.maestriaMagia1 ? `<button class="btn btn-sm btn-primary" data-mago-acao="maestria-1" ${attrsBotao(false)}>${corpoBotao(estadoMago.maestriaMagia1, false)}</button>` : ''}
            ${estadoMago.maestriaMagia2 ? `<button class="btn btn-sm btn-primary" data-mago-acao="maestria-2" ${attrsBotao(false)}>${corpoBotao(estadoMago.maestriaMagia2, false)}</button>` : ''}
            <button class="btn btn-sm btn-accent" data-mago-acao="definir-maestria-magias">${temMaestria ? 'Trocar' : 'Escolher Magias'}</button>
          </div>
        </div>
      ` : ''}

      ${estadoMago.assinaturaMagicaAtiva ? `
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;border-top:1px solid var(--border-light);padding-top:6px">
          <div style="font-size:0.85rem">
            <strong>Assinatura Mágica:</strong>
            ${temAssinaturas ? '1x cada por Descanso Curto/Longo' : '<span style="color:var(--warning)">nenhuma magia escolhida</span>'}
          </div>
          <div class="no-print" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
            ${estadoMago.assinatura1 ? `<button class="btn btn-sm btn-primary" data-mago-acao="assinatura-1" ${attrsBotao(estadoMago.assinatura1Usada)}>${corpoBotao(estadoMago.assinatura1, estadoMago.assinatura1Usada)}</button>` : ''}
            ${estadoMago.assinatura2 ? `<button class="btn btn-sm btn-primary" data-mago-acao="assinatura-2" ${attrsBotao(estadoMago.assinatura2Usada)}>${corpoBotao(estadoMago.assinatura2, estadoMago.assinatura2Usada)}</button>` : ''}
            <button class="btn btn-sm btn-accent" data-mago-acao="definir-assinaturas">${temAssinaturas ? 'Trocar' : 'Escolher Magias'}</button>
          </div>
        </div>
      ` : ''}

      <div style="width:100%;font-size:0.78rem;color:var(--text-muted)">
        Grimório: preparar magias no Descanso Longo.
        ${estadoMago.memorizarMagiaAtivo ? ' Memorizar Magia: trocar 1 magia preparada no Descanso Curto.' : ''}
      </div>
    </div>
  `;
}

export function renderFichaCompleta() {
  // Recalcula os passivos de talentos ANTES de qualquer leitura do cache.
  //
  // `passivosTalentosCache` (sheet/estado.js) era escrito num unico lugar:
  // `renderSheet` (pages/sheet.js), que so roda ao carregar/navegar para a
  // ficha. Toda via que muta `char.talentos` (ou `char.nivel`, que entra no
  // bonus de proficiencia de Alerta/Envenenador/Telecinetico) e depois so
  // chama `renderFichaCompleta()` deixava o cache velho -- o talento
  // aparecia na lista, mas nenhum efeito passivo dele entrava ate um F5.
  // Era o caso do botao "+ Talento" da ficha (sheet/talentos.js,
  // `persistirTalento`), do Iniciado em Magia e das invocacoes do Bruxo.
  // Recalcular aqui cobre todas essas vias de uma vez, porque nenhuma
  // delas altera a ficha sem passar por este render. O custo e uma
  // varredura de Set sobre a lista de talentos por render.
  definirPassivosTalentos(resolverPassivosTalentos(char));

  const estadoDetails = salvarEstadoDetails();
  const info = CLASSES_INFO[char.classe] || {};
  const prof = bonusProficiencia(char.nivel);
  const ca = calcCA(char, passivosTalentosCache);
  const modCon = calcMod(char.atributos.constituicao);
  const iniciativa = getModIniciativa();
  const ataquesPorAcao = getAtaquesPorAcao();
  const estadoFuria = getEstadoFuria();
  const estadoInspiracao = getEstadoInspiracaoBardo();
  const estadoBruxo = getEstadoRecursosBruxo();
  const estadoDruida = getEstadoRecursosDruida();
  const estadoGuardiao = getEstadoRecursosGuardiao();
  const estadoFeiticeiro = getEstadoRecursosFeiticeiro();
  const estadoGuerreiro = getEstadoRecursosGuerreiro();
  const estadoPaladino = getEstadoRecursosPaladino();
  const estadoMonge = getEstadoRecursosMonge();
  const estadoLadino = getEstadoRecursosLadino();
  const estadoMago = getEstadoRecursosMago();

  sincronizarBonusPvDraconico();
  sincronizarBonusPvAnao();
  sincronizarBonusPvVigoroso();

  // Recalcular PV max se necessário
  if (char.pv_max <= 0 && info.dado_vida) {
    char.pv_max = calcPVTotal(info.dado_vida, char.nivel, modCon);
    char.pv_atual = char.pv_max;
    salvar();
  }

  // Calcular deslocamento e tamanho a partir dos dados da espécie
  const _espData = especiesCache?.especies?.find(e => e.nome === char.especie);
  const _deslocamentoBase = _espData ? getDeslocamento(_espData.texto_completo) : '9 metros';
  const _deslocamento = getDeslocamentoFinal(_deslocamentoBase);
  const _deslMatch = _deslocamento.match(/^([\d,\.]+)\s*metros(.*)$/);
  const _deslNumero = _deslMatch ? _deslMatch[1] : _deslocamento;
  const _deslExtra = _deslMatch ? (_deslMatch[2] || '').trim() : '';
  const _tamanho = char.tamanho || (_espData ? getTamanho(_espData.texto_completo) : 'Médio');
  const _deslSobrecarga = !!(char?.config?.sobrecarga_afeta_deslocamento && getEstadoCarga().sobrecarregado);

  const container = containerRef;
  container.innerHTML = `
    <!-- Cabeçalho do personagem -->
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:start;flex-wrap:wrap;gap:8px">
        <div style="display:flex;align-items:start;gap:10px;flex:1;min-width:0">
          <div style="flex:1;min-width:0">
            <h2 style="font-size:1.3rem;margin-bottom:2px" id="char-nome-display">${escHtml(char.nome) || 'Sem Nome'}</h2>
            <div style="font-size:0.9rem;color:var(--text-muted)">
              ${escHtml(char.especie || '')} ${escHtml(char.classe || '')} ${char.subclasse ? `(${escHtml(char.subclasse)})` : ''} &middot; Nível ${char.nivel}
            </div>
            <div style="font-size:0.8rem;color:var(--text-muted)">Antecedente: ${escHtml(char.antecedente || '–')}${char.alinhamento ? ' | Alinhamento: ' + escHtml(char.alinhamento) : ''}</div>
            <div style="font-size:0.8rem;color:var(--text-muted)">Tamanho: ${escHtml(_tamanho)}${(char.idiomas && char.idiomas.length) ? ' | Idiomas: ' + char.idiomas.map(escHtml).join(', ') : ''}</div>
            ${(estadoGuardiao && estadoGuardiao.sentidosSelvagensAtivo) ? '<div style="font-size:0.8rem;color:var(--text-muted)">Sentidos: Visão às Cegas 9 m</div>' : ''}
            ${(estadoGuardiao && estadoGuardiao.exaustao > 0) ? `<div style="font-size:0.8rem;color:var(--danger)">Exaustão: ${estadoGuardiao.exaustao}</div>` : ''}
            <div style="font-size:0.8rem;color:var(--text-muted);margin-top:4px">
              XP: <span style="font-weight:600;color:var(--accent);cursor:pointer" id="xp-display" title="Clique para editar XP">${char.xp || 0}</span>
              ${char.nivel < 20 ? ` / ${XP_POR_NIVEL[char.nivel + 1]}` : ' (Nível Máximo)'}
            </div>
          </div>
          ${char.imagem ? `<div class="char-avatar" style="width:64px;height:64px;font-size:1.6rem;flex-shrink:0"><img src="${escHtml(char.imagem)}" alt=""></div>` : ''}
        </div>
        <div class="no-print" style="display:flex;gap:4px;flex-direction:column">
          <div style="display:flex;gap:4px">
            <button class="btn btn-sm btn-secondary" id="btn-editar-ficha">Editar ficha</button>
            <button class="btn btn-sm btn-primary" id="btn-print" title="Gerar PDF da ficha" style="gap:4px">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 15h6M9 18h6M9 12h2"/></svg> Gerar PDF
            </button>
          </div>
          ${_renderSyncIndicadorHtml()}
          ${char.nivel < 20 ? `
            <button class="btn btn-sm btn-accent" id="btn-levelup" style="font-weight:700">
              ⬆ Subir de Nível (Nível ${char.nivel + 1})
            </button>
          ` : ''}
        </div>
      </div>
    </div>

    ${precisaRecuperarDadivaEpica() ? `
      <div class="info-box warning no-print" style="margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
        <div style="font-size:0.85rem">
          <strong>Escolha de nível 19 pendente:</strong> registre a Dádiva Épica ou outro talento recebido nesse nível.
        </div>
        <button class="btn btn-sm btn-accent" id="btn-recuperar-dadiva-epica">Registrar talento de nível 19</button>
      </div>
    ` : ''}

    <!-- Stats combate -->
    <div class="card">
      ${estadoFuria ? `
        <div class="info-box ${estadoFuria.ativa ? 'danger' : 'info'}" style="margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
          <div style="font-size:0.85rem">
            <strong>Fúria:</strong> ${estadoFuria.ativa ? 'Ativa' : 'Inativa'}
            &nbsp;|&nbsp; Usos: ${estadoFuria.usosDisponiveis}/${estadoFuria.usosMax}
            &nbsp;|&nbsp; Dano: +${estadoFuria.dano}
            ${estadoFuria.ativa ? `&nbsp;|&nbsp; <span style="color:var(--success);font-weight:600">Resist: ${estadoFuria.resistencias.join(', ')}</span>` : ''}
            ${estadoFuria.ativa ? '&nbsp;|&nbsp; <span style="color:var(--success)">Vant. FOR</span>' : ''}
            ${estadoFuria.ativa ? '&nbsp;|&nbsp; <span style="color:var(--warning)">Sem Magias/Concentração</span>' : ''}
            ${temArmaduraPesadaEquipada() ? '&nbsp;|&nbsp;<span style="color:var(--danger)">Armadura pesada equipada</span>' : ''}
            ${estadoFuria.temForcaIndomavel ? '&nbsp;|&nbsp; <span style="font-size:0.75rem;color:var(--accent)" title="Piso de Força: se o total do teste/salvaguarda de FOR for menor que seu valor de FOR, use o valor de FOR">Força Indomável</span>' : ''}
            ${estadoFuria.furiaImplacavel ? `&nbsp;|&nbsp; <span style="font-size:0.75rem;color:var(--info)" title="Se reduzido a 0 PV com Fúria ativa: SG CON CD ${estadoFuria.furiaImplacavelCD}. Sucesso = PV = ${(char.nivel || 1) * 2}">Implacável CD ${estadoFuria.furiaImplacavelCD}</span>` : ''}
          </div>
          <div class="no-print" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
            <button class="btn btn-sm ${estadoFuria.ativa ? 'btn-secondary' : 'btn-danger'}" data-furia-toggle="${estadoFuria.ativa ? 'desativar' : 'ativar'}">
              ${estadoFuria.ativa ? 'Encerrar Fúria' : 'Entrar em Fúria'}
            </button>
            ${char.nivel >= 15 ? `<button class="btn btn-sm btn-secondary" data-furia-iniciativa="1">Rolar Iniciativa (recuperar Fúrias)</button>` : ''}
            ${estadoFuria.furiaImplacavel && estadoFuria.ativa ? `<button class="btn btn-sm btn-info" data-furia-implacavel="1">Fúria Implacável</button>` : ''}
          </div>
        </div>
      ` : ''}

      ${estadoInspiracao ? `
        <div class="info-box info" style="margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
          <div style="font-size:0.85rem">
            <strong>Inspiração de Bardo:</strong> d${estadoInspiracao.dado}
            &nbsp;|&nbsp; Usos: ${estadoInspiracao.usosDisponiveis}/${estadoInspiracao.usosMax}
            &nbsp;|&nbsp; Recarga: ${estadoInspiracao.recuperaCurto ? 'Descanso Curto/Longo' : 'Descanso Longo'}
          </div>
          <div class="no-print" style="display:flex;gap:6px;align-items:center">
            <button class="btn btn-sm btn-accent" data-inspiracao-acao="usar" ${estadoInspiracao.usosDisponiveis <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Inspiração</button>
            ${(char.nivel || 1) >= 18 ? '<button class="btn btn-sm btn-secondary" data-inspiracao-acao="iniciativa">Rolar Iniciativa (recuperar até 2)</button>' : ''}
          </div>
        </div>
      ` : ''}

      ${estadoBruxo ? `
        <div class="info-box info" style="margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
          <div style="font-size:0.85rem">
            <strong>Recursos do Bruxo:</strong>
            Astúcia Mágica: ${estadoBruxo.astuciaUsada ? 'Usada' : 'Disponível'}
            &nbsp;|&nbsp; Invocações: ${estadoBruxo.invocacoes.length}/${estadoBruxo.invocacoesMax}
            &nbsp;|&nbsp; Pacto: ${estadoBruxo.pacto || 'Não definido'}
            ${estadoBruxo.invocacoes.length > 0 ? `
              <div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px">
                ${estadoBruxo.invocacoes.map(inv => {
                  const nome = typeof inv === 'string' ? inv : inv.nome;
                  const extra = inv?.truque ? ` (${inv.truque})` : inv?.talento ? ` (${inv.talento})` : '';
                  return `<span class="badge" style="font-size:0.65rem;margin:1px 2px;background:var(--bg-card);border:1px solid var(--border-light)">${nome}${extra}</span>`;
                }).join('')}
              </div>
            ` : ''}
          </div>
          <div class="no-print" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
            <button class="btn btn-sm btn-accent" data-bruxo-astucia-acao="usar" ${estadoBruxo.astuciaUsada ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Astúcia Mágica</button>
            <button class="btn btn-sm btn-secondary" data-bruxo-recursos="abrir">Gerenciar Pacto/Invocações/Arcanum</button>
          </div>
          ${estadoBruxo.circulosArcanum.length > 0 ? `
            <div style="width:100%;font-size:0.78rem;color:var(--text-muted)">
              Arcana Mística:
              ${estadoBruxo.circulosArcanum.map(c => {
                const dado = estadoBruxo.arcanum[c] || { magia: '', usado: false };
                return `<span style="margin-right:10px">${c}º: ${dado.magia || 'não definida'} (${dado.usado ? 'usada' : 'disponível'}) <button class="btn btn-sm btn-secondary no-print" style="padding:0 6px;line-height:1.4" data-bruxo-arcanum-toggle="${c}">${dado.usado ? 'Restaurar' : 'Marcar uso'}</button></span>`;
              }).join('')}
            </div>
          ` : ''}
        </div>
      ` : ''}

      ${estadoDruida ? `
        <div class="info-box info" style="margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
          <div style="font-size:0.85rem">
            <strong>Recursos do Druida:</strong>
            Forma Selvagem: ${estadoDruida.usosDisponiveis}/${estadoDruida.usosMax}
            &nbsp;|&nbsp; Estado: ${estadoDruida.formaSelvagemAtiva ? 'Ativa' : 'Inativa'}
            &nbsp;|&nbsp; Companheiro Selvagem: ${estadoDruida.companheiroSelvagemAtivo ? 'Ativo' : 'Inativo'}
            ${(char.nivel || 1) >= 5 ? `&nbsp;|&nbsp; Ressurgimento (slot 1º): ${estadoDruida.ressurgimentoSlotRecuperadoHoje ? 'Já usado' : 'Disponível'}` : ''}
          </div>
          <div class="no-print" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
            <button class="btn btn-sm ${estadoDruida.formaSelvagemAtiva ? 'btn-secondary' : 'btn-accent'}" data-druida-forma-acao="${estadoDruida.formaSelvagemAtiva ? 'encerrar' : 'ativar'}" ${(estadoDruida.usosDisponiveis <= 0 && !estadoDruida.formaSelvagemAtiva) ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>
              ${estadoDruida.formaSelvagemAtiva ? 'Encerrar Forma Selvagem' : 'Ativar Forma Selvagem'}
            </button>
            <button class="btn btn-sm btn-secondary" data-druida-companheiro-acao="toggle" ${(estadoDruida.usosDisponiveis <= 0 && !estadoDruida.companheiroSelvagemAtivo && !Object.keys(char.espacos_magia || {}).length) ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>
              ${estadoDruida.companheiroSelvagemAtivo ? 'Dispensar Companheiro Selvagem' : 'Invocar Companheiro Selvagem'}
            </button>
            ${estadoDruida.ressurgimentoAtivo ? `<button class="btn btn-sm btn-primary" data-druida-ressurgimento-acao="recuperar-forma" ${estadoDruida.usosDisponiveis > 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Ressurgimento: recuperar Forma</button>` : ''}
            ${estadoDruida.ressurgimentoAtivo ? `<button class="btn btn-sm btn-primary" data-druida-ressurgimento-acao="recuperar-slot" ${(estadoDruida.ressurgimentoSlotRecuperadoHoje || estadoDruida.usosDisponiveis <= 0) ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Ressurgimento: recuperar slot 1º</button>` : ''}
            ${estadoDruida.arquidruidaAtivo ? `<button class="btn btn-sm btn-secondary" data-druida-iniciativa="1">Iniciativa (Arquidruida)</button>` : ''}
          </div>
        </div>
      ` : ''}

      ${estadoGuardiao ? `
        <div class="info-box info" style="margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
          <div style="font-size:0.85rem">
            <strong>Recursos do Guardião:</strong>
            Marca do Caçador: ${estadoGuardiao.marcaPredadorAtiva ? 'Ativa' : 'Inativa'}
            &nbsp;|&nbsp; Inimigo Favorito: ${estadoGuardiao.inimigoFavoritoDisponiveis}/${estadoGuardiao.inimigoFavoritoMax}
            &nbsp;|&nbsp; Dano da Marca: ${estadoGuardiao.marcaPredadorDado}
            ${estadoGuardiao.incansavelAtivo ? `&nbsp;|&nbsp; Incansável: ${estadoGuardiao.incansavelDisponiveis}/${estadoGuardiao.incansavelMax}` : ''}
            ${estadoGuardiao.veuNaturezaAtivo ? `&nbsp;|&nbsp; Véu da Natureza: ${estadoGuardiao.veuNaturezaDisponiveis}/${estadoGuardiao.veuNaturezaMax}` : ''}
          </div>
          <div class="no-print" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
            <button class="btn btn-sm btn-accent" data-guardiao-acao="${estadoGuardiao.marcaPredadorAtiva ? 'encerrar-marca' : 'usar-marca'}" ${(!estadoGuardiao.marcaPredadorAtiva && estadoGuardiao.inimigoFavoritoDisponiveis <= 0) ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>
              ${estadoGuardiao.marcaPredadorAtiva ? 'Encerrar Marca' : 'Marca sem Espaço'}
            </button>
            ${estadoGuardiao.incansavelAtivo ? `<button class="btn btn-sm btn-secondary" data-guardiao-acao="incansavel" ${estadoGuardiao.incansavelDisponiveis <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Incansável</button>` : ''}
            ${estadoGuardiao.veuNaturezaAtivo ? `<button class="btn btn-sm btn-secondary" data-guardiao-acao="veu" ${estadoGuardiao.veuNaturezaDisponiveis <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Véu da Natureza</button>` : ''}
          </div>
          <div style="width:100%;font-size:0.78rem;color:var(--text-muted)">
            ${estadoGuardiao.predadorImplacavelAtivo ? 'Predador Implacável: sofrer dano não quebra sua Concentração de Marca do Caçador. ' : ''}
            ${estadoGuardiao.cacadorPrecisoAtivo ? 'Caçador Preciso: ataques contra alvo marcado têm vantagem. ' : ''}
            ${estadoGuardiao.sentidosSelvagensAtivo ? 'Sentidos Selvagens: Visão às Cegas 9 m.' : ''}
          </div>
        </div>
      ` : ''}

      ${estadoFeiticeiro ? `
        <div class="info-box info" style="margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
          <div style="font-size:0.85rem">
            <strong>Recursos do Feiticeiro:</strong>
            Pontos de Feitiçaria: ${estadoFeiticeiro.pontosAtuais}/${estadoFeiticeiro.pontosMax}
            &nbsp;|&nbsp; Feitiçaria Inata: ${estadoFeiticeiro.feiticariaInataUsosDisponiveis}/${estadoFeiticeiro.feiticariaInataUsosMax}
            &nbsp;|&nbsp; Estado: ${estadoFeiticeiro.feiticariaInataAtiva ? 'Ativa' : 'Inativa'}
            ${semAcento(char.subclasse || '') === semAcento('Feitiçaria Selvagem') ? `&nbsp;|&nbsp; Marés do Caos: ${estadoFeiticeiro.subclasses.selvagem.mares_caos_disponivel ? 'Disponível' : 'Indisponível'}` : ''}
            ${semAcento(char.subclasse || '') === semAcento('Feitiçaria Dracônica') ? `&nbsp;|&nbsp; Afinidade: ${estadoFeiticeiro.subclasses.draconica.afinidade_elemental || 'Não definida'}` : ''}
          </div>
          <div class="no-print" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
            <button class="btn btn-sm ${estadoFeiticeiro.feiticariaInataAtiva ? 'btn-secondary' : 'btn-accent'}" data-feiticeiro-acao="${estadoFeiticeiro.feiticariaInataAtiva ? 'encerrar-feiticaria-inata' : 'ativar-feiticaria-inata'}">
              ${estadoFeiticeiro.feiticariaInataAtiva ? 'Encerrar Feitiçaria Inata' : 'Ativar Feitiçaria Inata'}
            </button>
            ${char.nivel >= 5 ? `<button class="btn btn-sm btn-primary" data-feiticeiro-acao="restauracao-feiticeira" ${estadoFeiticeiro.restauracaoFeiticeiraUsada ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Restauração Feiticeira</button>` : ''}
            <button class="btn btn-sm btn-secondary" data-feiticeiro-acao="metamagia-config">Metamagia</button>
          </div>
          ${semAcento(char.subclasse || '') === semAcento('Feitiçaria Selvagem') && estadoFeiticeiro.subclasses.selvagem.surto_pendente_automatico ? `
            <div style="width:100%;font-size:0.78rem;color:var(--warning)">
              Surto de Magia Selvagem automático pendente na próxima conjuração com espaço.
              <button class="btn btn-sm btn-secondary no-print" style="margin-left:6px" data-feiticeiro-acao="surto-resolvido">Marcar resolvido</button>
            </div>
          ` : ''}
        </div>
      ` : ''}

      ${estadoGuerreiro && (estadoGuerreiro.ehMestreBatalha || estadoGuerreiro.ehCombatentePsiquico) ? `
        <div class="info-box info" style="margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
          <div style="font-size:0.85rem">
            <strong>Recursos do Guerreiro (${escHtml(char.subclasse)}):</strong>
            ${estadoGuerreiro.ehMestreBatalha ? `
              Dados de Superioridade: ${estadoGuerreiro.dadosSuperioridadeDisponiveis}/${estadoGuerreiro.dadosSuperioridadeMax} (${estadoGuerreiro.tipoDadoSuperioridade})
              &nbsp;|&nbsp; CD: ${estadoGuerreiro.cdSuperioridade}
              &nbsp;|&nbsp; Manobras: ${estadoGuerreiro.manobrasConhecidas}/${estadoGuerreiro.manobrasEsperadas}
              ${estadoGuerreiro.manobrasPendentes > 0 ? `<span style="color:var(--danger)">(${estadoGuerreiro.manobrasPendentes} pendente(s) — ver banner abaixo)</span>` : ''}
              ${estadoGuerreiro.conhecaInimigoAtivo ? `&nbsp;|&nbsp; Conheça Inimigo: ${estadoGuerreiro.conhecaInimigoUsado ? 'Usado' : 'Disponível'}` : ''}
            ` : ''}
            ${estadoGuerreiro.ehCombatentePsiquico ? `
              Dados Psiônicos: ${estadoGuerreiro.dadosPsionicosDisponiveisG}/${estadoGuerreiro.dadosPsionicosMaxG} (${estadoGuerreiro.tipoDadoPsionicoG})
              &nbsp;|&nbsp; Mov. Telecinético: ${estadoGuerreiro.movimentoTelecineticoUsado ? 'Usado' : 'Disponível'}
              ${estadoGuerreiro.adeptoTelecineticoAtivo ? `&nbsp;|&nbsp; Salto: ${estadoGuerreiro.saltoImpulsaoUsado ? 'Usado' : 'Disponível'}` : ''}
              ${estadoGuerreiro.baluarteEnergiaAtivo ? `&nbsp;|&nbsp; Baluarte: ${estadoGuerreiro.baluarteUsado ? 'Usado' : 'Disponível'}` : ''}
              ${estadoGuerreiro.mestreTelecineticoAtivo ? `&nbsp;|&nbsp; Telecinese: ${estadoGuerreiro.mestreTelecineticoUsado ? 'Usada' : 'Disponível'}` : ''}
            ` : ''}
          </div>
          <div class="no-print" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
            ${estadoGuerreiro.ehMestreBatalha && estadoGuerreiro.manobrasComDescricao.length === 0 ? `
              <button class="btn btn-sm btn-primary" data-guerreiro-acao="usar-superioridade" ${estadoGuerreiro.dadosSuperioridadeDisponiveis <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Dado Superioridade</button>
            ` : ''}
            ${estadoGuerreiro.ehCombatentePsiquico ? `
              <button class="btn btn-sm btn-primary" data-guerreiro-acao="golpe-psionico" ${estadoGuerreiro.dadosPsionicosDisponiveisG <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Golpe Psiônico</button>
              <button class="btn btn-sm btn-accent" data-guerreiro-acao="vinculo-protetivo" ${estadoGuerreiro.dadosPsionicosDisponiveisG <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Vínculo Protetivo</button>
            ` : ''}
          </div>
          <div style="width:100%;font-size:0.78rem;color:var(--text-muted)">
            ${estadoGuerreiro.ehMestreBatalha && estadoGuerreiro.implacavelAtivo ? 'Implacável: 1x/turno, 1d8 grátis em vez de gastar dado. ' : ''}
            ${estadoGuerreiro.ehCombatentePsiquico && estadoGuerreiro.resguardoMentalAtivo ? 'Resguardo Mental: Resistência a dano Psíquico. Gaste dado para encerrar Amedrontado/Enfeitiçado. ' : ''}
          </div>
        </div>
        ${estadoGuerreiro.ehMestreBatalha && estadoGuerreiro.manobrasComDescricao.length > 0 ? `
          <div style="width:100%;margin-top:6px;font-size:0.78rem">
            ${estadoGuerreiro.manobrasComDescricao.map(m => `
              <details style="margin-bottom:2px">
                <summary style="cursor:pointer;font-weight:600">${escHtml(m.nome)}</summary>
                <div style="color:var(--text-muted);padding-left:12px">${escHtml(m.descricao)}</div>
              </details>
            `).join('')}
          </div>
        ` : ''}
        ${estadoGuerreiro.ehMestreBatalha && estadoGuerreiro.manobrasPendentes > 0 ? `
          <div class="info-box warning" style="margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;gap:8px">
            <span style="font-size:0.85rem">Você tem <strong>${estadoGuerreiro.manobrasPendentes}</strong> manobra(s) pendente(s) de escolha (Mestre da Batalha).</span>
            <button class="btn btn-sm btn-accent no-print" id="btn-escolher-manobras-pendentes">Escolher agora</button>
          </div>
        ` : ''}
      ` : ''}

      ${estadoPaladino ? `
        <div class="info-box info" style="margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
          <div style="font-size:0.85rem">
            <strong>Recursos do Paladino:</strong>
            Mãos Consagradas: ${estadoPaladino.maosAtuais}/${estadoPaladino.maosMax} PV
            ${estadoPaladino.canalizarMax > 0 ? `&nbsp;|&nbsp; Canalizar Divindade: ${estadoPaladino.canalizarDisponiveis}/${estadoPaladino.canalizarMax}` : ''}
            ${estadoPaladino.destruicaoGratuitaAtiva ? `&nbsp;|&nbsp; Destruição Gratuita: ${estadoPaladino.destruicaoGratuitaUsada ? 'Usada' : 'Disponível'}` : ''}
            ${estadoPaladino.auraProtecaoAtiva ? `&nbsp;|&nbsp; Aura: +${estadoPaladino.bonusAura} Salvaguardas (${estadoPaladino.auraRaio}m)` : ''}
          </div>
          <div class="no-print" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
            <button class="btn btn-sm btn-accent" data-paladino-acao="maos-consagradas" ${estadoPaladino.maosAtuais <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Mãos Consagradas</button>
            ${estadoPaladino.canalizarMax > 0 ? `<button class="btn btn-sm btn-secondary" data-paladino-acao="canalizar" ${estadoPaladino.canalizarDisponiveis <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Canalizar Divindade</button>` : ''}
            ${estadoPaladino.destruicaoGratuitaAtiva ? `<button class="btn btn-sm btn-primary" data-paladino-acao="destruicao-gratuita" ${estadoPaladino.destruicaoGratuitaUsada ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Destruição Gratuita</button>` : ''}
          </div>
          <div style="width:100%;font-size:0.78rem;color:var(--text-muted)">
            ${estadoPaladino.golpesRadiantesAtivo ? 'Golpes Radiantes: +1d8 Radiante em ataques corpo a corpo. ' : ''}
            ${estadoPaladino.auraCoragemAtiva ? 'Aura de Coragem: Imunidade a Amedrontado na aura. ' : ''}
            ${estadoPaladino.auraDevocaoAtiva ? 'Aura de Devoção: Imunidade a Enfeitiçado na aura. ' : ''}
            ${estadoPaladino.toqueRestauradorAtivo ? 'Toque Restaurador: remover condições com 5 PV da reserva. ' : ''}
          </div>
        </div>
      ` : ''}

      ${estadoMonge ? `
        <div class="info-box info" style="margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
          <div style="font-size:0.85rem">
            <strong>Recursos do Monge:</strong>
            Artes Marciais: d${estadoMonge.dadoArtesMarciais}
            ${estadoMonge.pontosMax > 0 ? `&nbsp;|&nbsp; Pontos de Foco: ${estadoMonge.pontosAtuais}/${estadoMonge.pontosMax}` : ''}
            &nbsp;|&nbsp; CD Foco: ${estadoMonge.cdFoco}
            ${estadoMonge.bonusMovimento > 0 ? `&nbsp;|&nbsp; Mov. Bônus: +${String(estadoMonge.bonusMovimento).replace('.', ',')}m` : ''}
          </div>
          <div class="no-print" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
            ${estadoMonge.pontosMax > 0 ? `<button class="btn btn-sm btn-accent" data-monge-acao="gastar-ponto" ${estadoMonge.pontosAtuais <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Gastar Ponto de Foco</button>` : ''}
            ${estadoMonge.golpeAtordoanteAtivo ? `<button class="btn btn-sm btn-primary" data-monge-acao="golpe-atordoante" ${estadoMonge.pontosAtuais <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Golpe Atordoante</button>` : ''}
            ${!estadoMonge.metabolismoUsado ? `<button class="btn btn-sm btn-secondary" data-monge-acao="metabolismo">Metabolismo Incomum</button>` : ''}
          </div>
          <div style="width:100%;font-size:0.78rem;color:var(--text-muted)">
            ${estadoMonge.desviarAtivo ? `Desviar Ataques: reduz ${estadoMonge.desviarReducao} de dano. ` : ''}
            ${estadoMonge.quedaLentaAtiva ? `Queda Lenta: reduz ${estadoMonge.quedaReducao} dano de queda. ` : ''}
            ${estadoMonge.evasaoAtiva ? 'Evasão: salvaguarda Des sucesso = 0 dano. ' : ''}
            ${estadoMonge.sobreviventeAtivo ? 'Proficiência em todas as salvaguardas. ' : ''}
            ${estadoMonge.defesaSuperiorAtiva ? 'Defesa Superior: 3 PF = resist. a todos exceto Energético. ' : ''}
          </div>
        </div>
      ` : ''}

      ${estadoLadino ? `
        <div class="info-box info" style="margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
          <div style="font-size:0.85rem">
            <strong>Recursos do Ladino${estadoLadino.ehAdagaEspiritual ? ' (Adaga Espiritual)' : ''}:</strong>
            Ataque Furtivo: ${estadoLadino.furtivoTexto}
            ${estadoLadino.golpeAstutoAtivo ? `&nbsp;|&nbsp; CD Golpe Astuto: ${estadoLadino.cdGolpeAstuto}` : ''}
            ${estadoLadino.golpeSorteAtivo ? `&nbsp;|&nbsp; Golpe de Sorte: ${estadoLadino.golpeSorteUsado ? 'Usado' : 'Disponível'}` : ''}
            ${estadoLadino.ehAdagaEspiritual ? `
              &nbsp;|&nbsp; Dados Psionicos: ${estadoLadino.dadosPsionicosDisponiveisL}/${estadoLadino.dadosPsionicosMaxL} (${estadoLadino.tipoDadoPsionicoL})
              &nbsp;|&nbsp; CD Psionico: ${estadoLadino.cdPsionicaAdaga}
              &nbsp;|&nbsp; Sussurros: ${estadoLadino.sussurrosGratisUsado ? 'Gratis Usado' : 'Gratis Disponivel'}
              ${estadoLadino.veuPsiquicoAtivo ? `&nbsp;|&nbsp; Veu: ${estadoLadino.veuPsiquicoUsado ? 'Usado' : 'Disponivel'}` : ''}
              ${estadoLadino.rasgarMenteAtivo ? `&nbsp;|&nbsp; Rasgar Mente: ${estadoLadino.rasgarMenteUsado ? 'Usado' : 'Disponivel'}` : ''}
            ` : ''}
          </div>
          <div class="no-print" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
            ${estadoLadino.golpeSorteAtivo ? `<button class="btn btn-sm btn-accent" data-ladino-acao="golpe-sorte" ${estadoLadino.golpeSorteUsado ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Golpe de Sorte</button>` : ''}
            ${estadoLadino.ehAdagaEspiritual ? `
              <button class="btn btn-sm btn-primary" data-ladino-acao="gastar-dado-psionico" ${estadoLadino.dadosPsionicosDisponiveisL <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Gastar Dado Psionico</button>
              ${estadoLadino.veuPsiquicoAtivo ? `<button class="btn btn-sm btn-secondary" data-ladino-acao="veu-psiquico" ${estadoLadino.veuPsiquicoUsado && estadoLadino.dadosPsionicosDisponiveisL <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>${estadoLadino.veuPsiquicoUsado ? 'Veu (dado)' : 'Veu Psiquico'}</button>` : ''}
            ` : ''}
          </div>
          <div style="width:100%;font-size:0.78rem;color:var(--text-muted)">
            ${estadoLadino.acaoArdilosaAtiva ? 'Ação Ardilosa: Correr/Desengajar/Esconder como Ação Bônus. ' : ''}
            ${estadoLadino.miraFirmeAtiva ? 'Mira Firme: Vantagem no ataque (sem mover). ' : ''}
            ${estadoLadino.esquivaSobrenaturalAtiva ? 'Esquiva Sobrenatural: Reação = metade do dano. ' : ''}
            ${estadoLadino.evasaoAtiva ? 'Evasão: Des sucesso = 0 dano. ' : ''}
            ${estadoLadino.talentoConfiavelAtivo ? 'Talento Confiável: d20 <= 9 conta como 10 em proficiências. ' : ''}
            ${estadoLadino.menteEscorregadiaAtiva ? 'Mente Escorregadia: Prof. salvaguardas Sab/Car. ' : ''}
            ${estadoLadino.elusivoAtivo ? 'Elusivo: ninguém tem Vantagem contra você. ' : ''}
            ${estadoLadino.ehAdagaEspiritual ? 'Laminas Psiquicas: 1d6 Psiquico (Acuidade, Arremesso 18/36m). Acao Bonus: 2o ataque 1d4. ' : ''}
            ${estadoLadino.ehAdagaEspiritual && estadoLadino.laminasAlmaAtivas ? 'Golpes Teleguiados: dado ao errar ataque. Teleporte Psiquico: gasta dado. ' : ''}
          </div>
        </div>
      ` : ''}

      ${estadoMago ? renderPainelRecursosMago(estadoMago) : ''}

      <div class="stats-row">
        <div class="stat-box">
          <div class="stat-label">CA</div>
          <div class="stat-value">${ca}</div>
          ${(() => {
            const efs = char.efeitos_magicos || [];
            // Deduplicar por nome base (compostos geram filhos com " (Reativo)" etc.)
            // Excluir concentracao_generica (so aparece no indicador de condicoes)
            const vistos = new Set();
            const unicos = efs.filter(ef => {
              if (ef.tipo === 'concentracao_generica') return false;
              const base = ef.nome.replace(/ \(.*\)$/, ''); if (vistos.has(base)) return false; vistos.add(base); return true;
            });
            if (unicos.length === 0) return '';
            return `<div style="font-size:0.6rem;margin-top:2px">${unicos.map(ef => {
              const base = ef.nome.replace(/ \(.*\)$/, '');
              const tooltip = ef.rotulo || ef.nome;
              return `<span class="no-print" style="display:inline-flex;align-items:center;gap:2px;background:var(--accent);color:#fff;padding:1px 5px;border-radius:8px;margin:1px;cursor:pointer;font-size:0.6rem" data-remover-efeito="${base}" title="${tooltip}">${base}${ef.concentracao ? ' (C)' : ''} &times;</span>`;
            }).join('')}</div>`;
          })()}
        </div>
        <div class="stat-box">
          <div class="stat-label">Iniciativa</div>
          <div class="stat-value">${fmtMod(iniciativa.valor)}</div>
          ${iniciativa.vantagem ? '<div style="font-size:0.65rem;color:var(--success);font-weight:700">Vantagem</div>' : ''}
        </div>
        <div class="stat-box" ${_deslSobrecarga ? 'style="cursor:pointer;position:relative" onclick="window.avisarSobrecargaDeslocamento()"' : ''}>
          <div class="stat-label">Deslocamento</div>
          <div class="stat-value">${_deslNumero}<br><span class="stat-unit">metros</span></div>
          ${_deslExtra ? `<div style="font-size:0.6rem;color:var(--text-muted)">${_deslExtra}</div>` : ''}
          ${_deslSobrecarga ? '<div class="no-print" style="position:absolute;bottom:2px;left:0;right:0;font-size:0.55rem;color:var(--danger);font-weight:700">&#9888; Sobrecarga</div>' : ''}
        </div>
        <div class="stat-box">
          <div class="stat-label">Ataques</div>
          <div class="stat-value">${ataquesPorAcao}</div>
          <div style="font-size:0.65rem;color:var(--text-muted)">por Ação Atacar</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Prof.</div>
          <div class="stat-value">+${prof}</div>
        </div>
        ${info.conjurador ? `
          <div class="stat-box">
            <div class="stat-label">CD Magia</div>
            <div class="stat-value">${calcCDMagia(char)}</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">Atq. Magia</div>
            <div class="stat-value">${fmtMod(calcAtaqueMagia(char))}</div>
          </div>
        ` : ''}
      </div>

      <!-- Proficiencias de Armas e Armaduras -->
      ${(() => {
        // Mesclar proficiencias base da classe com extras (subclasse, talentos, etc.)
        const extras = (char.proficiencias_extra || []).map(p => p.toLowerCase());
        const armadurasProf = [...info.armaduras];
        const armasProf = [...info.armas];
        const armadurasExtras = [];
        const armasExtras = [];
        // Mapear proficiencias extras para categorias
        for (const extra of extras) {
          if (extra === 'armadura pesada' && !armadurasProf.includes('Pesada')) { armadurasProf.push('Pesada'); armadurasExtras.push('Pesada'); }
          else if ((extra === 'armadura média' || extra === 'armadura media') && !armadurasProf.includes('Média')) { armadurasProf.push('Média'); armadurasExtras.push('Média'); }
          else if (extra === 'armadura leve' && !armadurasProf.includes('Leve')) { armadurasProf.push('Leve'); armadurasExtras.push('Leve'); }
          else if (extra === 'escudo' && !armadurasProf.includes('Escudo')) { armadurasProf.push('Escudo'); armadurasExtras.push('Escudo'); }
          else if (extra === 'armas marciais' && !armasProf.includes('Marcial')) { armasProf.push('Marcial'); armasExtras.push('Marcial'); }
          else if (extra === 'armas simples' && !armasProf.includes('Simples')) { armasProf.push('Simples'); armasExtras.push('Simples'); }
        }
        return `
      <div class="prof-equip-row">
        <div class="prof-equip-group">
          <span class="prof-equip-label">Armaduras:</span>
          ${armadurasProf.length > 0
            ? armadurasProf.map(a => `<span class="prof-equip-badge prof-equip-armadura${armadurasExtras.includes(a) ? ' prof-equip-extra' : ''}">${a}${armadurasExtras.includes(a) ? '*' : ''}</span>`).join('')
            : '<span class="prof-equip-badge prof-equip-nenhuma">Nenhuma</span>'
          }
        </div>
        <div class="prof-equip-group">
          <span class="prof-equip-label">Armas:</span>
          ${armasProf.map(a => `<span class="prof-equip-badge prof-equip-arma${armasExtras.includes(a) ? ' prof-equip-extra' : ''}">${a}${armasExtras.includes(a) ? '*' : ''}</span>`).join('')}
        </div>
        ${armadurasExtras.length > 0 || armasExtras.length > 0 ? '<div style="width:100%;font-size:0.6rem;color:var(--text-muted);text-align:center;margin-top:2px">* Concedida por subclasse/talento</div>' : ''}
      </div>`;
      })()}

      <!-- HP / Inspiracao Heroica -->
      <div class="hp-section">
        <!-- Coluna principal: PV -->
        <div class="hp-main">
          <div class="hp-pv-display">
            <div class="hp-pv-label">Pontos de Vida</div>
            <div class="hp-pv-value" style="color:${char.pv_atual <= (char.pv_max_override || char.pv_max) * 0.25 ? 'var(--danger)' : char.pv_atual <= (char.pv_max_override || char.pv_max) * 0.5 ? 'var(--warning)' : 'var(--success)'}">
              ${char.pv_atual} / ${char.pv_max_override || char.pv_max}
            </div>
            ${char.pv_max_override && char.pv_max_override !== char.pv_max ? `<div style="font-size:0.7rem;color:var(--info)">(Base: ${char.pv_max} | Bonus: +${char.pv_max_override - char.pv_max})</div>` : ''}
          </div>
          <div class="no-print hp-buttons">
            <button class="btn btn-sm btn-danger" id="hp-minus">Dano</button>
            <button class="btn btn-sm btn-success" id="hp-plus">Cura</button>
            <button class="btn btn-sm btn-secondary" id="hp-temp">PV Temp</button>
            <button class="btn btn-sm btn-secondary" id="hp-max-override" title="Sobrescrever PV Máximo">&#9881; PV Max</button>
          </div>
        </div>
        <!-- Coluna secundaria: PV Temp + Dados de Vida -->
        <div class="hp-secondary">
          <div class="hp-sub-box hp-temp-box">
            <div class="hp-sub-label">PV Temporario</div>
            <div class="hp-sub-value" style="color:var(--info)">${char.pv_temporario || 0}</div>
          </div>
          <div class="hp-sub-box hp-dv-box">
            <div class="hp-sub-label">Dados de Vida</div>
            <div class="hp-sub-value">${char.nivel - (char.dados_vida_usados || 0)} / ${char.nivel} <span style="font-size:0.8em;color:var(--text-muted)">d${info.dado_vida || '?'}</span></div>
            <button class="btn btn-sm btn-secondary no-print" id="btn-usar-dv" style="margin-top:4px;font-size:0.72rem;padding:3px 8px">Usar DV</button>
          </div>
        </div>
        <!-- Inspiracao Heroica -->
        <div id="inspiracao-toggle" class="no-print hp-inspiracao ${char.inspiracao_heroica ? 'hp-inspiracao-ativa' : ''}" title="Inspiração Heroica">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="${char.inspiracao_heroica ? '#fff' : 'var(--text-muted)'}" stroke="none">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
          </svg>
          <span class="hp-inspiracao-texto">${char.inspiracao_heroica ? 'Inspirada!' : 'Inspiracao'}</span>
        </div>
      </div>

      ${char.pv_atual <= 0 ? `
      <!-- Salvaguarda Contra Morte -->
      <div style="margin-top:12px;padding:12px;border:2px solid var(--danger);border-radius:var(--radius);background:rgba(192,57,43,0.05)">
        <div style="font-size:0.8rem;font-weight:700;text-transform:uppercase;color:var(--danger);text-align:center;margin-bottom:8px">☠ Salvaguarda Contra Morte</div>
        <div style="display:flex;justify-content:center;gap:24px">
          <div style="text-align:center">
            <div style="font-size:0.7rem;font-weight:600;color:var(--success);margin-bottom:4px">Sucessos</div>
            <div style="display:flex;gap:6px;justify-content:center">
              ${[0,1,2].map(i => `<label class="morte-check" style="cursor:pointer"><input type="checkbox" data-morte-sucesso="${i}" ${(char.morte_sucessos || 0) > i ? 'checked' : ''} style="display:none"><span class="morte-bolha ${(char.morte_sucessos || 0) > i ? 'morte-sucesso' : ''}"></span></label>`).join('')}
            </div>
          </div>
          <div style="text-align:center">
            <div style="font-size:0.7rem;font-weight:600;color:var(--danger);margin-bottom:4px">Falhas</div>
            <div style="display:flex;gap:6px;justify-content:center">
              ${[0,1,2].map(i => `<label class="morte-check" style="cursor:pointer"><input type="checkbox" data-morte-falha="${i}" ${(char.morte_falhas || 0) > i ? 'checked' : ''} style="display:none"><span class="morte-bolha ${(char.morte_falhas || 0) > i ? 'morte-falha' : ''}"></span></label>`).join('')}
            </div>
          </div>
        </div>
      </div>
      ` : ''}
    </div>

    <!-- FAB Descanso (flutuante) -->
    <div id="fab-descanso" class="fab-descanso no-print">
      <button class="fab-btn" id="fab-toggle-descanso" title="Descanso">🏕️</button>
      <div class="fab-menu" id="fab-menu-descanso" style="display:none">
        <button class="btn btn-accent btn-sm" id="btn-descanso-curto">☀ Descanso Curto</button>
        <button class="btn btn-accent btn-sm" id="btn-descanso-longo">🌙 Descanso Longo</button>
      </div>
    </div>

    <!-- Atributos -->
    <div class="card">
      <div class="card-header"><h2>Atributos</h2></div>
      <div class="atributos-grid">
        ${ATRIBUTOS_KEYS.map(key => {
          const nome = ATRIBUTOS_NOMES[key];
          const val = char.atributos[key];
          const mod = calcMod(val);
          const isPrimario = info.atributo_primario?.includes(nome);
          const isConjuracao = info.conjurador && info.atributo_conjuracao === nome;
          const attrStyle = ATRIBUTO_ESTILO[key] || {};
          return `
            <div class="atributo-box ${isPrimario ? 'destaque' : ''}" style="border-color:${attrStyle.cor || 'var(--border)'}">
              <div class="atributo-nome" style="color:${attrStyle.cor || 'var(--text-muted)'}">${attrStyle.emoji || ''} ${nome}${seloEdicao(`atributos.${key}`)}</div>
              <div class="atributo-mod" style="color:${attrStyle.cor || 'var(--primary)'}">${fmtMod(mod)}</div>
              <div class="atributo-valor">${val}</div>
              ${isConjuracao ? '<div style="font-size:0.6rem;font-weight:700;color:var(--accent);margin-top:2px">🔮 Conjuração</div>' : ''}
            </div>`;
        }).join('')}
      </div>
    </div>

    <!-- Salvaguardas -->
    <div class="card">
      <div class="card-header"><h2>Salvaguardas</h2></div>
      ${char.especie === 'Pequenino' ? '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px"><span class="badge" style="font-size:0.7rem;padding:3px 8px;background:var(--success);color:#fff" title="Ao tirar 1 natural em qualquer d20, re-jogue e use o novo resultado.">Sorte: Re-roll nat 1</span></div>' : ''}
      ${(() => {
        // Calcular imunidades a condições para exibir na seção
        const _imunidades = [];
        const _ef = getEstadoFuria();
        if (_ef?.ativa && _ef?.furiaIrracional) {
          _imunidades.push({ condicao: 'Amedrontado', fonte: 'Furia Irracional' });
          _imunidades.push({ condicao: 'Enfeitiçado', fonte: 'Furia Irracional' });
        }
        const _ep = getEstadoRecursosPaladino();
        if (_ep?.auraCoragemAtiva) {
          if (!_imunidades.find(i => i.condicao === 'Amedrontado')) {
            _imunidades.push({ condicao: 'Amedrontado', fonte: 'Aura de Coragem' });
          }
        }
        if (_ep?.auraDevocaoAtiva) {
          if (!_imunidades.find(i => i.condicao === 'Enfeitiçado')) {
            _imunidades.push({ condicao: 'Enfeitiçado', fonte: 'Aura de Devoção' });
          }
        }
        return _imunidades.length > 0 ? `
          <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px">
            ${_imunidades.map(i => `<span class="badge" style="font-size:0.65rem;padding:2px 6px;background:var(--success);color:#fff" title="${i.fonte}">Imune: ${i.condicao} (${i.fonte})</span>`).join('')}
          </div>` : '';
      })()}
      <div class="salvaguardas-grid">
        ${ATRIBUTOS_KEYS.map(key => {
          const nome = ATRIBUTOS_NOMES[key];
          const mod = calcMod(char.atributos[key]);
          const proficiente = (char.salvaguardas_proficientes || []).includes(nome);
          const bonus = mod + (proficiente ? prof : 0);
          const condicoes = char.condicoes || [];
          const incapacitado = condicoes.includes('Incapacitado');

          // Fontes de vantagem em salvaguardas
          const fontsVant = [];
          if (nome === 'Força' && !!getEstadoFuria()?.ativa) fontsVant.push('Furia');
          if (nome === 'Destreza' && char.classe === 'Bárbaro' && char.nivel >= 2 && !incapacitado) fontsVant.push('Sentido de Perigo');
          // Gnomo: Astucia de Gnomo - Vantagem em salv. INT, SAB, CAR
          if (char.especie === 'Gnomo' && ['Inteligência', 'Sabedoria', 'Carisma'].includes(nome)) fontsVant.push('Astucia de Gnomo');
          // Elfo: Ancestralidade Feerica - Vantagem em salv. contra Enfeiticado
          if (char.especie === 'Elfo' && condicoes.includes('Enfeitiçado')) fontsVant.push('Ancestralidade Feerica');
          // Anao: Resistencia a Toxinas - Vantagem em salv. contra Envenenado
          if (char.especie === 'Anão' && condicoes.includes('Envenenado')) fontsVant.push('Resistencia a Toxinas');
          // Pequenino: Corajoso - Vantagem em salv. contra Amedrontado
          if (char.especie === 'Pequenino' && condicoes.includes('Amedrontado')) fontsVant.push('Corajoso');

          // Fontes de desvantagem em salvaguardas
          const fontsDesv = [];
          if (nome === 'Destreza' && condicoes.includes('Contido')) fontsDesv.push('Contido');

          const temVant = fontsVant.length > 0;
          const temDesv = fontsDesv.length > 0;
          let indicadorSalv = '';
          if (temVant && temDesv) {
            indicadorSalv = `<span class="pericia-vd-badge neutro" data-vd-info="Vantagem (${fontsVant.join(', ')}) e Desvantagem (${fontsDesv.join(', ')}) se anulam">—</span>`;
          } else if (temVant) {
            indicadorSalv = `<span class="pericia-vd-badge vantagem" data-vd-info="Vantagem: ${fontsVant.join(', ')}">V</span>`;
          } else if (temDesv) {
            indicadorSalv = `<span class="pericia-vd-badge desvantagem" data-vd-info="Desvantagem: ${fontsDesv.join(', ')}">D</span>`;
          }
          return `
            <div class="salva-item ${proficiente ? 'proficiente' : ''}">
              <div class="pericia-prof ${proficiente ? 'ativo' : ''}"></div>
              <span class="pericia-bonus">${fmtMod(bonus)}</span>
              <span class="pericia-nome" style="flex:1">${nome}</span>
              ${indicadorSalv}
            </div>`;
        }).join('')}
      </div>
    </div>

    <!-- Condicoes ativas do personagem -->
    ${renderSecaoCondicoes()}

    <!-- Defesas: Resistencias, Vulnerabilidades, Imunidades -->
    ${renderSecaoDefesas()}

    <!-- Sentidos Passivos -->
    ${renderSecaoSentidos()}

    <!-- Pericias em ordem customizada -->
    <div class="card">
      <div class="card-header"><h2>Pericias</h2></div>
      <div class="pericias-lista-custom">
        ${(() => {
          // Ordem customizada de exibicao das pericias
          const ordemPericias = [
            'Percepção', 'Intuição', 'Investigação', 'Religião', 'História',
            'Prestidigitação', 'Furtividade', 'Persuasão', 'Atletismo', 'Medicina',
            'Acrobacia', 'Enganação', 'Arcanismo', 'Sobrevivência', 'Natureza',
            'Atuação', 'Intimidação', 'Lidar com Animais'
          ];
          return ordemPericias.map(nome => {
            const p = PERICIAS.find(x => x.nome === nome);
            if (!p) return '';
            const key = ATRIBUTO_NOME_PARA_KEY[p.atributo];
            const estilo = ATRIBUTO_ESTILO[key] || {};
            const proficiente = (char.pericias_proficientes || []).includes(p.nome);
            const expertise = (char.pericias_expertise || []).includes(p.nome);
            const bonus = calcBonusPericia(char, p.nome, {
              emFuria: !!getEstadoFuria()?.ativa,
              forcaPrimordialAtiva: forcaPrimordialAtiva()
            });
            const vd = calcVantagemDesvantagemPericia(p.nome);
            const temVant = vd.vantagens.length > 0;
            const temDesv = vd.desvantagens.length > 0;
            let indicador = '';
            if (temVant && temDesv) {
              indicador = `<span class="pericia-vd-badge neutro" data-vd-info="Vantagem (${vd.vantagens.join(', ')}) e Desvantagem (${vd.desvantagens.join(', ')}) se anulam">—</span>`;
            } else if (temVant) {
              indicador = `<span class="pericia-vd-badge vantagem" data-vd-info="Vantagem: ${vd.vantagens.join(', ')}">V</span>`;
            } else if (temDesv) {
              indicador = `<span class="pericia-vd-badge desvantagem" data-vd-info="Desvantagem: ${vd.desvantagens.join(', ')}">D</span>`;
            }
            return `
            <div class="pericia-item" style="border-left:3px solid ${estilo.cor || 'var(--border)'}">
              <div class="pericia-prof ${proficiente ? (expertise ? 'expertise' : 'ativo') : ''}"></div>
              <span class="pericia-bonus">${fmtMod(bonus)}</span>
              <span class="pericia-nome">${p.nome}</span>
              <span class="pericia-atributo-tag" style="color:${estilo.cor || 'var(--text-muted)'}">${p.atributo.substring(0,3).toUpperCase()}</span>
              ${indicador}
            </div>`;
          }).join('');
        })()}
      </div>
    </div>

    <!-- Talentos -->
    ${renderSecaoTalentos()}

    <!-- Sortudo: Pontos de Sorte -->
    ${passivosTalentosCache?.flags?.sortudo ? (() => {
      if (!char.recursos) char.recursos = {};
      if (!char.recursos.sortudo) char.recursos.sortudo = { pontos_gastos: 0 };
      const total = bonusProficiencia(char.nivel);
      const disponiveis = Math.max(0, total - (char.recursos.sortudo.pontos_gastos || 0));
      return `
    <div class="card" style="border-left:3px solid var(--accent)">
      <div class="card-header" style="padding-bottom:4px"><h2 style="font-size:0.95rem">Sortudo — Pontos de Sorte</h2></div>
      <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:6px">${disponiveis}/${total} disponível(is) · Recarrega no Descanso Longo</div>
      <div class="no-print" style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn btn-sm btn-primary" data-sortudo-acao="vantagem" ${disponiveis <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Gastar: Vantagem</button>
        <button class="btn btn-sm btn-secondary" data-sortudo-acao="desvantagem" ${disponiveis <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Gastar: Desvantagem (reação)</button>
      </div>
    </div>`;
    })() : ''}

    <!-- Características de Classe -->
    ${renderSecaoCaracteristicas()}

    <!-- Características de Subclasse -->
    ${renderSecaoSubclasse()}

    <!-- Traços da Espécie/Raça -->
    ${renderSecaoTracosEspecie()}

    <!-- Espaços de Magia e Magias -->
    ${(info.conjurador || ehSubclasseConjuradora() || getTruquesExtraEstiloLuta() > 0 || char.iniciado_em_magia?.lista || (char.iniciado_em_magia_instancias?.length > 0) || (char.magias_customizadas?.length > 0)) ? renderSecaoMagias() : ''}

    <!-- Inventário -->
    ${renderSecaoInventario()}

    <!-- Detalhes pessoais -->
    ${renderSecaoDetalhes()}

    <!-- Ações da ficha -->
    <div class="card no-print mt-3">
      <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
        <button class="btn btn-danger btn-sm" id="btn-excluir-char">Excluir Personagem</button>
      </div>
    </div>
  `;

  // --- Eventos ---
  setupEventosHP();
  setupEventosDescanso();
  setupEventosEdicao();
  setupEventosInventarioSheet();
  setupEventosEspacosMagia();
  setupEventosHabilidades();
  setupEventosSubclasseBarbaro();
  setupEventosCondicoes();
  setupEventosDefesas();
  setupEventosVantagemDesvantagem();
  setupEventosDetalhesColapso();
  setupEventosTruquesColapso();
  document.getElementById('btn-recuperar-dadiva-epica')
    ?.addEventListener('click', abrirModalRecuperarDadivaEpica);

  // Restaurar estado dos details
  restaurarEstadoDetails(estadoDetails);
}