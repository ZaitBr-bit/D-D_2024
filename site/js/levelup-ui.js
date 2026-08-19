// ============================================================
// Orquestrador do Level Up em Cards
// Fase 5: Integra flow + cards + eventos + submissão
// ============================================================
import {
  buildLevelUpContext, buildVisibleSteps, createInitialState, calcularConjuracao,
  carregarMagiasDisponiveis, ehConjuradorAtivo,
  proximoStep, stepAnterior, todosStepsCompletos, calcularSubclasseArcana
} from './levelup-flow.js';
import {
  renderCardGanhosNivel, renderCardSubclasse, renderCardASI,
  renderCardEscolhasClasse, renderCardMagias, renderCardManobrasGuerreiro, renderCardRevisao,
  OPCOES_ESTILO_LUTA_BASE
} from './levelup-cards.js';
import { montarSeletor, montarTroca } from './ui-opcoes.js';
import { deArmas, deEstilosLuta, deMagias, deManobras, deTalentos, motivoPreRequisito, rotuloPericia } from './opcoes-dominio.js';
import { collectOpcoes, validateAll } from './levelup-validations.js';
import { ATRIBUTOS_KEYS, ATRIBUTOS_NOMES, PERICIAS } from './dados-classes.js';
import { getArmas, getMagiasPorCirculo, getMagiasClasse, getMagiasRituais } from './db.js';
import { abrirModal, toast, mdParaHtml, semAcento, calcMod, escHtml, getEspacosMagia } from './utils.js';
import { subirDeNivel, obterAtributosASITalento, getLimiteASITalento, obterTalentosElegiveis } from './levelup.js';
import { abrirGridManobras } from './manobras-ui.js';
import { magiaContaNoLimite, truqueEhTrocavel } from './regras-origens-magia.js';
import {
  PERICIAS_TODAS as _PERICIAS_NOMES, FERRAMENTAS_TODAS as _FERRAMENTAS_TODAS,
  FERRAMENTAS_ARTESAO as _FERRAMENTAS_ARTESAO, INSTRUMENTOS_MUSICAIS as _INSTRUMENTOS,
  PERICIAS_ANALITICO as _PERICIAS_ANALITICO, PERICIAS_MENTE_AGUCADA as _PERICIAS_MENTE_AGUCADA,
  TIPOS_DANO_ADEPTO_ELEMENTAL as _TIPOS_DANO_ADEPTO_ELEMENTAL,
  ARMAS_SIMPLES_MARCIAIS as _ARMAS_SIMPLES_MARCIAIS,
  telecineticoPrecisaTruqueSubstituto as _telecineticoPrecisaTruqueSubstituto
} from './regras-cobertura.js';

// Referências injetadas pelo sheet.js
let _salvarFn = null;
let _renderFichaFn = null;
let _levelUpFluxoAtivo = false;
let _levelUpModalPrincipalAberto = false;

// As listas de perícias/ferramentas/ferramentas de artesão/instrumentos
// vêm de regras-cobertura.js (única fonte) para não divergir da validação
// central em validarEscolhasTalento — ver os aliases importados acima.

// ============================================================
// PONTO DE ENTRADA PRINCIPAL
// ============================================================

/**
 * Abre o modal de level up em formato de cards.
 * @param {Object} char - Personagem
 * @param {Object} classeData - Dados da classe carregados
 * @param {Object} helpers - Funções do sheet.js
 * @param {Object} caches - { talentosCache }
 * @param {Function} salvarFn - Função salvar()
 * @param {Function} renderFichaFn - Função renderFichaCompleta()
 */
export async function abrirLevelUpCards(char, classeData, helpers, caches, salvarFn, renderFichaFn) {
  if (_levelUpFluxoAtivo) return;

  _levelUpFluxoAtivo = true;
  _levelUpModalPrincipalAberto = false;
  _salvarFn = salvarFn;
  _renderFichaFn = renderFichaFn;

  try {
    const ctx = await buildLevelUpContext(char, classeData, helpers);
    const state = createInitialState();
    if (ctx.exigeDadivaEpica) state.asiModo = 'talento';

    // Carregar lista de magias disponíveis para uso interno. Quem só vira
    // conjurador ao escolher a subclasse (Cavaleiro Místico, Trapaceiro
    // Arcano) tem a lista recarregada em irParaStep, depois da escolha.
    if (ctx.ehConjurador) {
      await carregarMagiasDisponiveis(ctx, state);
    }

    renderModal(ctx, state, caches);
  } catch (err) {
    _levelUpFluxoAtivo = false;
    _levelUpModalPrincipalAberto = false;
    throw err;
  }
}

// ============================================================
// RENDERIZAÇÃO DO MODAL
// ============================================================

function renderModal(ctx, state, caches) {
  const steps = buildVisibleSteps(ctx, state);
  const step = steps[state.stepAtual];

  const titulo = `Nível ${ctx.nivelAtual} → Nível ${ctx.nivelNovo}`;

  // Barra de progresso
  const progressBar = `
    <div class="levelup-progress">
      ${steps.map((s, i) => {
        const ativo = i === state.stepAtual;
        const completo = s._completo && i !== state.stepAtual;
        const cls = ativo ? 'levelup-step-ativo' : completo ? 'levelup-step-completo' : 'levelup-step-pendente';
        return `<div class="levelup-step ${cls}" data-step-idx="${i}">
          <div class="levelup-step-num">${i + 1}</div>
          <div class="levelup-step-label">${s.titulo}</div>
        </div>`;
      }).join('')}
    </div>
  `;

  // Conteúdo do step atual
  let conteudo = '';
  switch (step.id) {
    case 'ganhos_nivel':
      conteudo = renderCardGanhosNivel(ctx, state);
      break;
    case 'escolha_subclasse':
      conteudo = renderCardSubclasse(ctx, state);
      break;
    case 'aumento_atributo':
      conteudo = renderCardASI(ctx, state, caches.talentosCache);
      break;
    case 'escolhas_classe':
      conteudo = renderCardEscolhasClasse(ctx, state);
      break;
    case 'selecao_magias':
      conteudo = renderCardMagias(ctx, state);
      break;
    case 'manobras_guerreiro':
      conteudo = renderCardManobrasGuerreiro(ctx, state);
      break;
    case 'revisao_confirmacao':
      conteudo = renderCardRevisao(ctx, state, steps);
      break;
  }

  const corpoHtml = progressBar + `<div id="levelup-step-body">${conteudo}</div>`;

  // Botões de navegação
  const ehPrimeiro = state.stepAtual === 0;
  const ehUltimo = state.stepAtual === steps.length - 1;

  let acoes = '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>';
  if (!ehPrimeiro) {
    acoes += '<button class="btn btn-secondary" id="btn-step-anterior">Anterior</button>';
  }
  if (ehUltimo) {
    acoes += `<button class="btn btn-accent" id="btn-confirmar-levelup">Confirmar Nível ${ctx.nivelNovo}</button>`;
  } else {
    acoes += '<button class="btn btn-accent" id="btn-step-proximo">Próximo</button>';
  }

  renderizarModalPrincipal(titulo, corpoHtml, acoes);

  // Bind de navegação e eventos do step
  bindNavegacao(ctx, state, caches);
  bindEventosStep(ctx, state, step, caches);
}

function renderizarModalPrincipal(titulo, corpoHtml, acoesHtml) {
  const overlay = document.getElementById('modal-overlay');
  const tituloEl = document.getElementById('modal-titulo');
  const corpoEl = document.getElementById('modal-corpo');
  const acoesEl = document.getElementById('modal-acoes');
  const containerEl = document.getElementById('modal-container');
  const modalAberto = overlay?.style?.display === 'flex';

  if (!_levelUpModalPrincipalAberto || !modalAberto || !tituloEl || !corpoEl || !acoesEl) {
    abrirModal(titulo, corpoHtml, acoesHtml, () => {
      _levelUpFluxoAtivo = false;
      _levelUpModalPrincipalAberto = false;
    });
    _levelUpModalPrincipalAberto = true;
    return;
  }

  // Atualiza o modal principal existente sem abrir sub-modais em cascata.
  tituloEl.textContent = titulo;
  corpoEl.innerHTML = corpoHtml;
  acoesEl.innerHTML = acoesHtml;
  if (containerEl) containerEl.scrollTop = 0;
}

// ============================================================
// NAVEGAÇÃO
// ============================================================

/**
 * Vai para um step, garantindo antes que a lista de magias corresponda à
 * subclasse escolhida NESTA sessão: quem vira conjurador ao escolher a
 * subclasse (Cavaleiro Místico, Trapaceiro Arcano) só passa a ter lista de
 * Mago depois da escolha, que acontece depois de o contexto ser montado.
 */
async function irParaStep(ctx, state, caches, indice) {
  state.stepAtual = indice;
  if (ctx.ehConjurador || ehConjuradorAtivo(ctx, state)) {
    try {
      await carregarMagiasDisponiveis(ctx, state);
    } catch (err) {
      console.error('Falha ao carregar a lista de magias do nível:', err);
    }
  }
  renderModal(ctx, state, caches);
}

function bindNavegacao(ctx, state, caches) {
  const steps = buildVisibleSteps(ctx, state);

  document.getElementById('btn-step-anterior')?.addEventListener('click', async () => {
    salvarStateDoDOM(ctx, state, steps[state.stepAtual]);
    await irParaStep(ctx, state, caches, stepAnterior(steps, state));
  });

  document.getElementById('btn-step-proximo')?.addEventListener('click', async () => {
    salvarStateDoDOM(ctx, state, steps[state.stepAtual]);
    await irParaStep(ctx, state, caches, proximoStep(steps, state));
  });

  document.getElementById('btn-confirmar-levelup')?.addEventListener('click', async () => {
    salvarStateDoDOM(ctx, state, steps[state.stepAtual]);
    await confirmarLevelUp(ctx, state, caches);
  });

  // Clique nos steps da barra de progresso
  document.querySelectorAll('.levelup-step[data-step-idx]').forEach(el => {
    el.addEventListener('click', async () => {
      salvarStateDoDOM(ctx, state, steps[state.stepAtual]);
      await irParaStep(ctx, state, caches, parseInt(el.dataset.stepIdx));
    });
  });
}

// ============================================================
// SALVAR STATE DO DOM (antes de navegar)
// ============================================================

function salvarStateDoDOM(ctx, state, step) {
  if (!step) return;

  switch (step.id) {
    case 'ganhos_nivel': {
      const modo = document.querySelector('input[name="levelup-hp-modo"]:checked')?.value;
      if (modo) state.hpModo = modo;
      const rolado = parseInt(document.getElementById('levelup-hp-rolado')?.value) || 1;
      state.hpRolado = Math.max(1, Math.min(ctx.info.dado_vida, rolado));
      break;
    }
    case 'escolha_subclasse': {
      const novaSubclasse = document.getElementById('levelup-subclasse')?.value || '';
      if (novaSubclasse !== state.subclasse) {
        state.subclasseMagiasSelecionados = [];
      }
      state.subclasse = novaSubclasse;
      break;
    }
    case 'aumento_atributo': {
      const modo = document.querySelector('input[name="levelup-asi-modo"]:checked')?.value;
      if (modo) state.asiModo = modo;
      if (state.asiModo === 'atributo') {
        const aumentos = {};
        let total = 0;
        ATRIBUTOS_KEYS.forEach(key => {
          const v = parseInt(document.getElementById(`levelup-attr-${key}`)?.value) || 0;
          if (v > 0) { aumentos[key] = v; total += v; }
        });
        state.aumentos = aumentos;
        state.pontosDistribuidos = total;
      } else {
        // state.talento já vem preenchido pelo callback aoMudar de
        // montarSeletor (bindEventosASI) -- o select #levelup-talento-select
        // não existe mais. Ler `?.value || ''` daqui zeraria a escolha em
        // silêncio a cada navegação (armadilha descrita na Task 13).
        if (state.talento === 'Aumento no Valor de Atributo') {
          const aumentos = {};
          let total = 0;
          ATRIBUTOS_KEYS.forEach(key => {
            const valor = parseInt(document.getElementById(`levelup-talento-attr-${key}`)?.value) || 0;
            if (valor > 0) aumentos[key] = valor;
            total += valor;
          });
          state.aumentos = aumentos;
          state.pontosDistribuidos = total;
        }
        // ASI do talento
        const asiEl = document.getElementById('levelup-talento-asi');
        if (asiEl) state.talentoASI = asiEl.value || '';
        // Resiliente
        const resEl = document.getElementById('levelup-talento-resiliente');
        if (resEl) { state.resilienteAtributo = resEl.value || ''; state.talentoASI = resEl.value || ''; }
        // Escolhas genéricas de talento
        const selects = [...document.querySelectorAll('.escolha-talento-levelup')];
        if (selects.length > 0) {
          state.escolhasTalento = selects.map(s => s.value).filter(Boolean);
          // Tipo de escolha
          const primeiro = selects[0];
          if (primeiro?.dataset?.tipo) {
            state.talentoTipoEscolha = primeiro.dataset.tipo;
          }
        }
        // Tocado Por Fadas / Tocado Pelas Sombras (magia de 1º círculo) e
        // Mestre das Armas (arma): state.escolhasTalento já é gravado pelo
        // callback de montarSeletor (bindEscolhasTalento). Não ler do DOM
        // aqui -- os antigos #levelup-magia-escola-select e
        // .escolha-talento-levelup[data-tipo="mestre_armas"] não existem
        // mais, e `?.value || ''` apagaria a escolha em silêncio (mesma
        // armadilha da Task 10, Step 3).
        // Magias rituais do Conjurador Ritualista: viraram cards de
        // montarSeletor junto com a correção da lista vazia, e o callback
        // `aoMudar` já grava em state.escolhasTalento. Ler do DOM aqui
        // (`.levelup-ritual-check:checked`) devolveria lista vazia -- os
        // checkboxes não existem mais -- e a guarda `length > 0` que
        // protegia disso passaria a nunca gravar nada. Mesma armadilha do
        // Iniciado em Magia logo abaixo.
        // Dádiva da Resistência à Energia: coletar tipos de energia escolhidos
        const energiaSelects = [...document.querySelectorAll('.dadiva-energia-escolha')];
        if (energiaSelects.length > 0) {
          const tiposEscolhidos = energiaSelects.map(s => s.value).filter(Boolean);
          if (tiposEscolhidos.length > 0) {
            state.dadivaResistenciaEnergia = tiposEscolhidos;
          }
        }
        // Iniciado em Magia: cascata (lista + atributo + truques + magia).
        // Persistir aqui porque o DOM deste step é destruído ao avançar para a
        // revisão — confirmarLevelUp precisa ler de state, não do DOM.
        if (state.talento === 'Iniciado em Magia') {
          const imLista = document.getElementById('levelup-im-lista')?.value || '';
          const imAtributo = document.getElementById('levelup-im-atributo')?.value || '';
          // Truques: mesma situação da magia de 1º círculo logo abaixo --
          // viraram cards de montarSeletor, e o callback deles já grava em
          // state.iniciadoEmMagia.truques. Os checkboxes `.levelup-im-truque`
          // não existem mais; ler do DOM devolveria lista vazia e apagaria a
          // escolha a cada navegação entre passos.
          const imTruques = state.iniciadoEmMagia?.truques || [];
          // Magia de 1º círculo: state.iniciadoEmMagia.magia já é gravada
          // pelo callback de montarSeletor (bindEscolhasTalento) -- o select
          // #levelup-im-magia não existe mais. Ler `?.value || ''` aqui
          // apagaria a escolha em silêncio a cada navegação (a mesma
          // armadilha desta lista, só que para a magia em vez da lista/
          // atributo/truques, que continuam controles reais).
          const imMagia = state.iniciadoEmMagia?.magia || '';
          if (imLista || imAtributo || imTruques.length > 0 || imMagia) {
            state.iniciadoEmMagia = { lista: imLista, atributo: imAtributo, truques: imTruques, magia: imMagia };
            state.talentoTipoEscolha = 'iniciado_em_magia';
          }
        }
      }
      break;
    }
    case 'escolhas_classe': {
      state.bardoExpertise = [...document.querySelectorAll('[data-bardo-expertise]:checked')].map(el => el.dataset.bardoExpertise);
      state.guardiaoExpertise = [...document.querySelectorAll('[data-guardiao-expertise]:checked')].map(el => el.dataset.guardiaoExpertise);
      // Estilo de Luta: state.estiloLuta já é gravado pelo callback de
      // montarSeletor (levelup-cards.js/bindEventosEscolhasClasse, Task 10).
      // Não ler do DOM aqui -- os radios não existem mais (viraram cards),
      // e `document.querySelector(...)?.value || ''` apagaria a escolha.
      state.exploradorExpertise = document.querySelector('input[name="explorador_expertise"]:checked')?.value || '';
      state.exploradorIdiomas = [...document.querySelectorAll('[data-explorador-idioma]:checked')].map(el => el.dataset.exploradorIdioma);
      state.academicoExpertise = [...document.querySelectorAll('[data-academico-expertise]:checked')].map(el => el.dataset.academicoExpertise);
      break;
    }
    case 'selecao_magias': {
      // Troca de magia e de truque: state.trocarDe/trocarPara/trocarParaCirculo
      // e state.truqueTrocarDe/truqueTrocarPara já são gravados pelo callback
      // de montarTroca (levelup-ui.js/bindEventosMagias, Task 12). Não ler do
      // DOM aqui -- os selects não existem mais (viraram cards), e
      // `document.getElementById(...)?.value || ''` apagaria a escolha.
      break;
    }
    case 'manobras_guerreiro': {
      // Troca de manobra: state.manobraTrocarDe/manobraTrocarPara já são
      // gravados pelo callback de montarTroca
      // (levelup-ui.js/bindEventosManobrasGuerreiro, Task 12). Não ler do
      // DOM aqui -- o select não existe mais, e `?.value || ''` apagaria a
      // escolha.
      break;
    }
    case 'revisao_confirmacao': {
      // Troca de Estilo de Luta do Guerreiro e Especialização do Ladino
      // nível 6 (site/js/levelup-cards.js:renderCardTrocasOpcionais) vivem
      // dentro deste step, não em 'escolhas_classe' -- ver o comentário de
      // renderCardTrocasOpcionais para o porquê. Sem este case, os dois
      // <select>/checkboxes eram lidos do DOM errado (ou nunca lidos) e a
      // escolha do jogador se perdia em silêncio ao confirmar -- achado da
      // revisão final, corrigido aqui.
      // Estilo de Luta: state.estiloLutaTrocarDe/Para já são gravados pelo
      // callback de montarTroca (levelup-cards.js/bindEventosTrocasOpcionais,
      // Task 10). Não ler do DOM aqui -- os selects não existem mais, e
      // `?.value || ''` apagaria a escolha.
      const checkboxesLadino = document.querySelectorAll('[data-ladino-expertise]');
      if (checkboxesLadino.length > 0) {
        state.ladinoExpertise = [...checkboxesLadino].filter(el => el.checked).map(el => el.dataset.ladinoExpertise);
      }
      break;
    }
  }
}

// ============================================================
// EVENTOS POR STEP
// ============================================================

function bindEventosStep(ctx, state, step, caches) {
  switch (step.id) {
    case 'ganhos_nivel': bindEventosHP(ctx, state); break;
    case 'escolha_subclasse': bindEventosSubclasse(ctx, state); break;
    case 'aumento_atributo': bindEventosASI(ctx, state, caches); break;
    case 'escolhas_classe': bindEventosEscolhasClasse(ctx, state); break;
    case 'selecao_magias': bindEventosMagias(ctx, state); break;
    case 'manobras_guerreiro': bindEventosManobrasGuerreiro(ctx, state); break;
    case 'revisao_confirmacao': bindEventosTrocasOpcionais(ctx, state); break;
  }
}

// --- HP ---
function bindEventosHP(ctx, state) {
  const { info, modCon } = ctx;
  const hpRoladoInput = document.getElementById('levelup-hp-rolado');
  const hpPreviaRolado = document.getElementById('levelup-hp-previa-rolado');

  function atualizar() {
    const modo = document.querySelector('input[name="levelup-hp-modo"]:checked')?.value || 'fixo';
    if (hpRoladoInput) hpRoladoInput.disabled = modo !== 'rolado';
    if (hpRoladoInput && hpPreviaRolado) {
      const rolado = Math.max(1, Math.min(info.dado_vida, parseInt(hpRoladoInput.value) || 1));
      hpRoladoInput.value = String(rolado);
      hpPreviaRolado.textContent = `= +${Math.max(1, rolado + modCon)} PV`;
    }
  }

  document.querySelectorAll('input[name="levelup-hp-modo"]').forEach(r => r.addEventListener('change', atualizar));
  hpRoladoInput?.addEventListener('input', atualizar);
  atualizar();
}

// --- Subclasse ---
function bindEventosSubclasse(ctx, state) {
  document.querySelectorAll('#levelup-subclasses-lista .opcao-card').forEach(card => {
    card.addEventListener('click', () => {
      const nome = card.dataset.subclasse;
      const idx = parseInt(card.dataset.idx);
      document.getElementById('levelup-subclasse').value = nome;
      if (nome !== state.subclasse) {
        state.subclasseMagiasSelecionados = [];
      }
      state.subclasse = nome;

      document.querySelectorAll('#levelup-subclasses-lista .opcao-card').forEach(c => c.classList.remove('selecionada'));
      card.classList.add('selecionada');

      const sc = ctx.subclassesDisponiveis[idx];
      const detalheEl = document.getElementById('levelup-subclasse-detalhe');
      if (sc && detalheEl) {
        const feats = sc.caracteristicas || [];
        detalheEl.innerHTML = `
          <div style="font-weight:700;font-size:1rem;margin-bottom:8px;color:var(--accent)">${sc.nome}</div>
          ${feats.map(f => `
            <div style="margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid var(--border-light)">
              <div style="font-weight:600;font-size:0.9rem">${f.nome} <span style="color:var(--text-muted);font-weight:400">(Nível ${f.nivel})</span></div>
              <div class="md-content" style="margin-top:2px">${mdParaHtml(f.descricao)}</div>
            </div>
          `).join('')}
        `;
        detalheEl.style.display = 'block';
      }
    });
  });
}

// --- ASI / Talento ---
function bindEventosASI(ctx, state, caches) {
  const { char } = ctx;
  const divAtributos = document.getElementById('levelup-asi-atributos');
  const divTalento = document.getElementById('levelup-asi-talento');

  // Toggle entre atributo e talento
  document.querySelectorAll('input[name="levelup-asi-modo"]').forEach(r => {
    r.addEventListener('change', () => {
      state.asiModo = r.value;
      if (divAtributos) divAtributos.style.display = r.value === 'atributo' ? 'block' : 'none';
      if (divTalento) divTalento.style.display = r.value === 'talento' ? 'block' : 'none';
    });
  });

  // Validação de pontos de atributo
  ATRIBUTOS_KEYS.forEach(key => {
    document.getElementById(`levelup-attr-${key}`)?.addEventListener('change', () => {
      let total = 0;
      ATRIBUTOS_KEYS.forEach(k => {
        total += parseInt(document.getElementById(`levelup-attr-${k}`)?.value) || 0;
      });
      const el = document.getElementById('levelup-pontos-total');
      if (el) {
        el.textContent = total;
        el.style.color = total === 2 ? 'var(--success)' : total > 2 ? 'var(--danger)' : 'inherit';
      }
    });
  });

  // Escolha de talento: 75 opções com descrição longa. O card mostra os
  // NOMES dos benefícios como resumo e abre o texto completo sob demanda;
  // o filtro "só os que posso pegar" tira da frente o que o nível ainda não
  // alcança (13 Dádivas Épicas exigem nível 19).
  const nivelNovo = (char.nivel || 1) + 1;
  const talentosDisponiveis = obterTalentosElegiveis(char, caches.talentosCache, nivelNovo)
    .filter(talento => ctx.exigeDadivaEpica || talento.nome !== 'Aumento no Valor de Atributo');
  const talentoEl = document.getElementById('levelup-talento-lista');
  if (talentoEl) {
    // A lista se RECOLHE ao escolher: fica só o talento escolhido e um link
    // para reabrir. Sem isso, as escolhas que o talento exige (o atributo do
    // "Aumento no Valor de Atributo", as perícias do Habilidoso, a arma do
    // Mestre das Armas) nascem em `#levelup-talento-escolhas`, que vem DEPOIS
    // dos 45 cards -- fora da tela. O jogador escolhia o talento, não via a
    // pendência, tentava avançar e só então era barrado, sem entender por quê.
    // Recolhido, a escolha pendente é a única coisa na tela.
    const montarListaTalentos = (recolhida) => {
      const escolhida = recolhida
        ? talentosDisponiveis.filter(t => t.nome === state.talento)
        : talentosDisponiveis;

      montarSeletor(talentoEl, {
        opcoes: deTalentos(escolhida, {
        jaPossui: new Set((char.talentos || []).map(t => (typeof t === 'string' ? t : t.nome))),
        // motivoPreRequisito confere nível contra o personagem recebido --
        // aqui precisa ser o nível QUE ELE VAI TER (nivelNovo), não o atual,
        // senão toda Dádiva Épica que exige exatamente nível 19 apareceria
        // bloqueada bem no nível em que passa a ser elegível (mesmo cálculo
        // que obterTalentosElegiveis já usa acima para montar a lista).
          motivoIndisponivel: (t) => motivoPreRequisito(t, { ...char, nivel: nivelNovo }),
        }),
        densidade: 'densa',
        max: 1,
        // Recolhida não precisa de busca nem de filtro: há um card só.
        busca: !recolhida,
        // Rótulos IDÊNTICOS a `talento.categoria` (dados/talentos/talentos.json)
        // -- é contra esse valor exato que ui-opcoes.js compara `o.grupo` ao
        // filtrar (achado ao implementar: "Estilo de Luta"/"Dádiva Épica" sem
        // o prefixo "de " nunca batiam com nenhum grupo e zeravam a lista).
        filtros: recolhida ? [] : ['de Origem', 'Geral', 'de Estilo de Luta', 'de Dádiva Épica'],
        filtroElegiveis: !recolhida,
        selecionadas: state.talento ? [state.talento] : [],
        aoMudar: (sel) => {
          const anterior = state.talento;
          state.talento = sel[0] || '';
          // Desmarcar o card recolhido significa "quero escolher outro":
          // reabre a lista inteira em vez de deixar a tela vazia.
          if (recolhida && !state.talento) {
            const escolhasEl = document.getElementById('levelup-talento-escolhas');
            if (escolhasEl) escolhasEl.innerHTML = '';
            montarListaTalentos(false);
            return;
          }
          // Mesma chamada que o `change` do select fazia antigamente: ela
          // acha o talento no cache e monta as escolhas que ele exige
          // (perícias do Habilidoso, arma do Mestre das Armas etc.).
          if (state.talento) mostrarDetalhesTalento(state.talento, ctx, caches, state);
          // Recolher só na transição de "nenhum" para "escolhido" -- montar
          // de novo a cada disparo do callback destruiria os controles de
          // escolha que o jogador acabou de preencher.
          if (!recolhida && state.talento && state.talento !== anterior) {
            montarListaTalentos(true);
          }
        },
      });

      // Link para reabrir a lista, só quando ela está recolhida.
      if (recolhida) {
        const trocar = document.createElement('div');
        trocar.className = 'opcao-ver';
        trocar.style.textAlign = 'center';
        trocar.dataset.trocarTalento = '1';
        trocar.innerHTML = '&#8964; trocar talento';
        trocar.addEventListener('click', () => {
          state.talento = '';
          const escolhasEl = document.getElementById('levelup-talento-escolhas');
          if (escolhasEl) escolhasEl.innerHTML = '';
          montarListaTalentos(false);
        });
        talentoEl.appendChild(trocar);
      }
    };

    // Já recolhida na montagem se o jogador volta ao passo com o talento
    // escolhido -- ele não precisa reencontrar a escolha no meio da lista.
    montarListaTalentos(Boolean(state.talento));
    if (state.talento) mostrarDetalhesTalento(state.talento, ctx, caches, state);
  }
}

function mostrarDetalhesTalento(nome, ctx, caches, state) {
  const detalheEl = document.getElementById('levelup-talento-detalhe');
  const escolhasEl = document.getElementById('levelup-talento-escolhas');
  // O painel de detalhe deixou de existir (o texto completo abre dentro do
  // card agora, via montarSeletor/ui-opcoes.js), mas as ESCOLHAS do talento
  // continuam vindo daqui -- por isso a guarda não pode mais exigir
  // detalheEl.
  if (!nome) return;

  // Buscar dados do talento no cache
  let talentoData = null;
  if (caches.talentosCache?.por_categoria) {
    for (const lista of Object.values(caches.talentosCache.por_categoria)) {
      const found = lista.find(t => t.nome === nome);
      if (found) { talentoData = found; break; }
    }
  }

  if (!talentoData) {
    if (detalheEl) detalheEl.style.display = 'none';
    if (escolhasEl) escolhasEl.innerHTML = '';
    return;
  }

  // Descrição do talento -- só escreve se o painel ainda existir (a tela de
  // subida de nível não tem mais #levelup-talento-detalhe; o texto completo
  // já aparece no "ver detalhes" do card).
  if (detalheEl) {
    detalheEl.innerHTML = `
      <div style="font-weight:700;margin-bottom:4px">${talentoData.nome}</div>
      <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:6px">${talentoData.prerequisito || ''}</div>
      ${(talentoData.beneficios || []).map(b =>
        `<div style="margin-bottom:4px"><strong>${b.nome}:</strong> ${mdParaHtml(b.descricao)}</div>`
      ).join('')}
    `;
    detalheEl.style.display = 'block';
  }

  // Escolhas específicas do talento
  if (escolhasEl) {
    escolhasEl.innerHTML = renderEscolhasTalento(nome, talentoData, ctx, state);
    bindEscolhasTalento(nome, talentoData, ctx, state);
    bindDistribuicaoASITalento();
  }
}

// Aviso quando a filtragem de "já possui" deixa menos opções elegíveis do
// que o número de escolhas exigidas (personagem já proficiente em quase
// tudo do pool). Evita renderizar um formulário que nunca poderá ser
// concluído sem explicar o motivo.
function _avisoOpcoesInsuficientes(disponiveis, exigidas) {
  if (disponiveis >= exigidas) return '';
  return `<div class="info-box warning" style="font-size:0.8rem;margin-top:4px">Restam apenas ${disponiveis} opção(ões) elegível(is) — o personagem já é proficiente em todo o resto. Não é possível completar as ${exigidas} escolhas exigidas.</div>`;
}

export function renderEscolhasTalento(nome, talentoData, ctx, state = {}) {
  const { char } = ctx;
  let html = '';

  if (nome === 'Aumento no Valor de Atributo') {
    html += `
      <div style="font-weight:600;font-size:0.85rem;margin-top:8px">Aumento de Atributo</div>
      <div style="font-size:0.8rem;color:var(--text-muted);margin:4px 0 8px">
        Aumente um atributo em +2, ou dois em +1 cada (máximo 20).
      </div>
      <div class="atributos-grid">
        ${ATRIBUTOS_KEYS.map(key => {
          const atual = Number(char.atributos?.[key]);
          return `
            <div class="form-group" style="text-align:center">
              <label class="form-label" for="levelup-talento-attr-${key}">${ATRIBUTOS_NOMES[key]}</label>
              <div style="font-size:0.8rem;margin-bottom:2px">${atual}</div>
              <select class="form-input levelup-talento-asi-distribuicao" style="text-align:center" id="levelup-talento-attr-${key}" data-atributo="${key}">
                <option value="0">+0</option>
                <option value="1" ${(state.aumentos?.[key] || 0) === 1 ? 'selected' : ''} ${atual >= 20 ? 'disabled' : ''}>+1</option>
                <option value="2" ${(state.aumentos?.[key] || 0) === 2 ? 'selected' : ''} ${atual >= 19 ? 'disabled' : ''}>+2</option>
              </select>
            </div>`;
        }).join('')}
      </div>
      <div style="font-size:0.8rem;color:var(--text-muted);margin-top:8px;text-align:center">
        Total de pontos: <span id="levelup-talento-pontos-total" style="font-weight:700">${state.pontosDistribuidos || 0}</span> / 2
      </div>`;
  }

  // ASI embutido no talento
  const atributosASI = obterAtributosASITalento(talentoData).map(chave => ({ nome: ATRIBUTOS_NOMES[chave], chave }));
  const limiteASI = getLimiteASITalento(talentoData);
  if (atributosASI.length > 0) {
    html += `<div style="font-weight:600;font-size:0.85rem;margin-top:8px">Aumento de Atributo (+1)</div>`;
    if (atributosASI.length === 1) {
      html += `<div class="info-box info" style="font-size:0.8rem">+1 em ${atributosASI[0].nome} (automático)</div>`;
      html += `<input type="hidden" id="levelup-talento-asi" value="${atributosASI[0].chave}">`;
    } else {
      html += `<select id="levelup-talento-asi" class="form-input" style="width:100%;margin:4px 0">`;
      html += `<option value="">-- Escolha o atributo --</option>`;
      atributosASI.forEach(a => {
        const v = char.atributos[a.chave] || 10;
        const jaTemSalvaguarda = nome === 'Resiliente' && (char.salvaguardas_proficientes || []).includes(a.nome);
        const bloqueado = v >= limiteASI || jaTemSalvaguarda;
        html += `<option value="${a.chave}" ${state.talentoASI === a.chave ? 'selected' : ''} ${bloqueado ? 'disabled' : ''}>${a.nome} (atual: ${v})${v >= limiteASI ? ' - máximo' : jaTemSalvaguarda ? ' - já proficiente em salvaguarda' : ''}</option>`;
      });
      html += `</select>`;
    }
  }

  // Habilidoso/Artifista/Músico: uma proficiência repetida não concede nada
  // nesta edição (só Especialização dobra, e ela vem de talentos que a
  // concedem explicitamente — Analítico/Mente Aguçada). Por isso as opções
  // já possuídas pelo personagem saem da lista, no mesmo padrão que
  // 'Especialista em Perícia' já usa logo abaixo (_PERICIAS_NOMES.filter).
  if (nome === 'Habilidoso') {
    const periciasProf = char.pericias_proficientes || [];
    const ferramentasProf = char.proficiencias_ferramentas || [];
    const periciasDisponiveis = _PERICIAS_NOMES.filter(p => !periciasProf.includes(p));
    const ferramentasDisponiveis = _FERRAMENTAS_TODAS.filter(f => !ferramentasProf.includes(f));
    html += `<div style="font-weight:600;font-size:0.85rem;margin-top:8px">Proficiências (3)</div>`;
    html += _avisoOpcoesInsuficientes(periciasDisponiveis.length + ferramentasDisponiveis.length, 3);
    for (let i = 0; i < 3; i++) {
      const selecionada = state.escolhasTalento?.[i] || '';
      html += `<select class="escolha-talento-levelup form-input" style="width:100%;margin:4px 0"><option value="">-- Escolha ${i + 1} --</option>`;
      html += `<optgroup label="Perícias">${periciasDisponiveis.map(p => `<option value="${p}" ${selecionada === p ? 'selected' : ''}>${rotuloPericia(p)}</option>`).join('')}</optgroup>`;
      html += `<optgroup label="Ferramentas">${ferramentasDisponiveis.map(f => `<option value="${f}" ${selecionada === f ? 'selected' : ''}>${f}</option>`).join('')}</optgroup>`;
      html += `</select>`;
    }
  }

  if (nome === 'Artifista') {
    const ferramentasProf = char.proficiencias_ferramentas || [];
    const ferramentasDisponiveis = _FERRAMENTAS_ARTESAO.filter(f => !ferramentasProf.includes(f));
    html += `<div style="font-weight:600;font-size:0.85rem;margin-top:8px">Ferramentas de Artesão (3)</div>`;
    html += _avisoOpcoesInsuficientes(ferramentasDisponiveis.length, 3);
    for (let i = 0; i < 3; i++) {
      const selecionada = state.escolhasTalento?.[i] || '';
      html += `<select class="escolha-talento-levelup form-input" style="width:100%;margin:4px 0"><option value="">-- Escolha ${i + 1} --</option>`;
      html += ferramentasDisponiveis.map(f => `<option value="${f}" ${selecionada === f ? 'selected' : ''}>${f}</option>`).join('');
      html += `</select>`;
    }
  }

  if (nome === 'Músico') {
    const instrumentosProf = char.proficiencias_instrumentos || [];
    const instrumentosDisponiveis = _INSTRUMENTOS.filter(f => !instrumentosProf.includes(f));
    html += `<div style="font-weight:600;font-size:0.85rem;margin-top:8px">Instrumentos (3)</div>`;
    html += _avisoOpcoesInsuficientes(instrumentosDisponiveis.length, 3);
    for (let i = 0; i < 3; i++) {
      const selecionada = state.escolhasTalento?.[i] || '';
      html += `<select class="escolha-talento-levelup form-input" style="width:100%;margin:4px 0"><option value="">-- Escolha ${i + 1} --</option>`;
      html += instrumentosDisponiveis.map(f => `<option value="${f}" ${selecionada === f ? 'selected' : ''}>${f}</option>`).join('');
      html += `</select>`;
    }
  }

  // Analítico/Mente Aguçada: "Se não tiver proficiência na perícia
  // escolhida, você a adquire; se já for proficiente, adquire
  // Especialização" (Talentos.md §Analítico/§Mente Aguçada). Ou seja, só a
  // perícia que já tem proficiência E Especialização não concede nada — as
  // outras duas (sem nada, ou proficiência sem Especialização) continuam
  // válidas e por isso NÃO entram no mesmo filtro de Habilidoso/Artifista/
  // Músico acima.
  if (nome === 'Analítico') {
    // Talentos.md §Analítico: Intuição, Investigação ou Percepção.
    const periciasExpertise = char.pericias_expertise || [];
    const periciasProf = char.pericias_proficientes || [];
    const ops = _PERICIAS_ANALITICO.filter(p => !(periciasProf.includes(p) && periciasExpertise.includes(p)));
    html += `<div style="font-weight:600;font-size:0.85rem;margin-top:8px">Perícia (1)</div>`;
    html += _avisoOpcoesInsuficientes(ops.length, 1);
    html += `<select class="escolha-talento-levelup form-input" data-tipo="analitico" style="width:100%;margin:4px 0"><option value="">-- Escolha --</option>`;
    html += ops.map(p => `<option value="${p}">${rotuloPericia(p)}</option>`).join('');
    html += `</select>`;
  }

  if (nome === 'Mente Aguçada') {
    // Talentos.md §Mente Aguçada: Arcanismo, História, Investigação,
    // Natureza ou Religião.
    const periciasExpertise = char.pericias_expertise || [];
    const periciasProf = char.pericias_proficientes || [];
    const ops = _PERICIAS_MENTE_AGUCADA.filter(p => !(periciasProf.includes(p) && periciasExpertise.includes(p)));
    html += `<div style="font-weight:600;font-size:0.85rem;margin-top:8px">Perícia (1)</div>`;
    html += _avisoOpcoesInsuficientes(ops.length, 1);
    html += `<select class="escolha-talento-levelup form-input" data-tipo="mente_agucada" style="width:100%;margin:4px 0"><option value="">-- Escolha --</option>`;
    html += ops.map(p => `<option value="${p}">${rotuloPericia(p)}</option>`).join('');
    html += `</select>`;
  }

  if (nome === 'Especialista em Perícia') {
    const profs = char.pericias_proficientes || [];
    const exps = new Set(char.pericias_expertise || []);
    html += `<div style="font-weight:600;font-size:0.85rem;margin-top:8px">Proficiência</div>`;
    html += `<select class="escolha-talento-levelup form-input" data-tipo="proficiencia" style="width:100%;margin:4px 0"><option value="">-- Proficiência --</option>`;
    html += _PERICIAS_NOMES.filter(p => !profs.includes(p)).map(p => `<option value="${p}" ${state.escolhasTalento?.[0] === p ? 'selected' : ''}>${rotuloPericia(p)}</option>`).join('');
    html += `</select>`;
    html += `<div style="font-weight:600;font-size:0.85rem;margin-top:8px">Especialização</div>`;
    html += `<select class="escolha-talento-levelup form-input" data-tipo="expertise" style="width:100%;margin:4px 0"><option value="">-- Especialização --</option>`;
    html += profs.filter(p => !exps.has(p)).map(p => `<option value="${p}" ${state.escolhasTalento?.[1] === p ? 'selected' : ''}>${rotuloPericia(p)}</option>`).join('');
    html += `</select>`;
  }

  if (nome === 'Dádiva da Proficiência em Perícia') {
    const proficientes = char.pericias_proficientes || [];
    const expertise = new Set(char.pericias_expertise || []);
    const elegiveis = proficientes.filter(pericia => !expertise.has(pericia));
    const selecionada = state.escolhasTalento?.[0] || '';
    html += `<div style="font-weight:600;font-size:0.85rem;margin-top:8px">Especialização em Perícia</div>`;
    html += `<select class="escolha-talento-levelup form-input" data-tipo="dadiva_proficiencia_pericia" style="width:100%;margin:4px 0">`;
    html += `<option value="">-- Escolha uma perícia proficiente --</option>`;
    html += elegiveis.map(pericia => `<option value="${pericia}" ${selecionada === pericia ? 'selected' : ''}>${rotuloPericia(pericia)}</option>`).join('');
    html += `</select>`;
  }

  if (nome === 'Adepto Elemental') {
    // Talentos.md §Adepto Elemental: Ácido, Elétrico, Gélido, Ígneo ou
    // Trovejante.
    const tipos = _TIPOS_DANO_ADEPTO_ELEMENTAL;
    const usados = ctx.helpers.obterTiposAdeptoElementalUsados?.() || [];
    html += `<div style="font-weight:600;font-size:0.85rem;margin-top:8px">Tipo de Dano</div>`;
    html += `<select class="escolha-talento-levelup form-input" data-tipo="adepto_elemental" style="width:100%;margin:4px 0"><option value="">-- Tipo --</option>`;
    tipos.forEach(t => {
      const desab = usados.includes(t) ? 'disabled' : '';
      html += `<option value="${t}" ${desab}>${t}${usados.includes(t) ? ' (já escolhido)' : ''}</option>`;
    });
    html += `</select>`;
  }

  if (nome === 'Mestre das Armas') {
    // Talentos.md §Mestre das Armas: "Propriedade de Maestria" — uma arma
    // Simples ou Marcial à escolha (o pré-requisito de proficiência com a
    // arma não é filtrado aqui pelo mesmo motivo documentado em
    // validarEscolhasTalento: o personagem não guarda proficiência de arma
    // por item). Já a MAESTRIA em si é filtrada: fica bloqueada a arma em
    // que o personagem já tem maestria (char.maestrias_arma), pois uma
    // maestria repetida não concede nada -- ver deArmas em
    // opcoes-dominio.js. Dano e maestria de cada arma só existem no JSON
    // (getArmas()), por isso a lista real é montada assincronamente em
    // bindEscolhasTalento; aqui só o placeholder.
    const maestriasAtuais = char.maestrias_arma || [];
    const armasDisponiveis = _ARMAS_SIMPLES_MARCIAIS.filter(a => !maestriasAtuais.includes(a));
    html += `<div style="font-weight:600;font-size:0.85rem;margin-top:8px">Propriedade de Maestria (Arma)</div>`;
    html += _avisoOpcoesInsuficientes(armasDisponiveis.length, 1);
    html += `<div id="lvlup-mestre-armas-lista">Carregando...</div>`;
  }

  // Telecinético: só aparece para quem JÁ conhece Mãos Mágicas -- regra da
  // casa documentada em telecineticoPrecisaTruqueSubstituto
  // (regras-cobertura.js). Quem não tem continua sem escolha nenhuma além
  // do atributo, e este bloco não renderiza nada.
  if (nome === 'Telecinético' && _telecineticoPrecisaTruqueSubstituto(char)) {
    html += `<div style="font-weight:600;font-size:0.85rem;margin-top:8px">Truque no lugar de Mãos Mágicas</div>`;
    html += `<div style="font-size:0.8rem;color:var(--text-muted);margin:4px 0 8px">
      Você já conhece <strong>Mãos Mágicas</strong>. Escolha outro truque da lista de Mago.
    </div>`;
    html += `<div id="lvlup-telecinetico-truque-lista">Carregando...</div>`;
    // Será populado assincronamente em bindEscolhasTalento
  }

  if (nome === 'Tocado Por Fadas' || nome === 'Tocado Pelas Sombras') {
    const label = nome === 'Tocado Por Fadas' ? 'Adivinhação ou Encantamento' : 'Ilusão ou Necromancia';
    html += `<div style="font-weight:600;font-size:0.85rem;margin-top:8px">Magia de 1º Círculo (${label})</div>`;
    html += `<div id="lvlup-magia-escola-lista">Carregando...</div>`;
    // Será populado assincronamente em bindEscolhasTalento
  }

  if (nome === 'Conjurador Ritualista') {
    html += `<div style="font-weight:600;font-size:0.85rem;margin-top:8px">Magias Rituais</div>`;
    html += `<div id="levelup-rituais-container">Carregando...</div>`;
    // Será populado assincronamente em bindEscolhasTalento
  }

  if (nome === 'Iniciado em Magia') {
    const listasUsadas = ctx.helpers.obterListasIniciadoEmMagiaUsadas?.() || [];
    // Regra 2024: apenas listas de Clérigo, Druida ou Mago
    const listasDisponiveis = ['Clérigo', 'Druida', 'Mago']
      .filter(l => !listasUsadas.includes(l));
    html += `
      <div style="font-weight:600;font-size:0.85rem;margin-top:8px">Lista de Magias</div>
      <select id="levelup-im-lista" class="form-input" style="width:100%;margin:4px 0">
        <option value="">-- Lista --</option>
        ${listasDisponiveis.map(l => `<option value="${l}" ${state.iniciadoEmMagia?.lista === l ? 'selected' : ''}>${l}</option>`).join('')}
      </select>
      <div id="levelup-im-atributo-container" style="display:none"></div>
      <div id="levelup-im-truques-container" style="display:none"></div>
      <div id="levelup-im-magia-container" style="display:none"></div>
    `;
  }

  // Dádiva da Resistência à Energia: escolher 2 tipos de energia
  if (nome === 'Dádiva da Resistência à Energia') {
    const tiposEnergia = ['Ácido', 'Elétrico', 'Gélido', 'Ígneo', 'Necrótico', 'Psíquico', 'Radiante', 'Trovejante', 'Venenoso'];
    html += `<div style="font-weight:600;font-size:0.85rem;margin-top:8px">Resistências à Energia (2)</div>`;
    for (let i = 0; i < 2; i++) {
      html += `<select class="dadiva-energia-escolha form-input" style="width:100%;margin:4px 0"><option value="">-- Tipo ${i + 1} --</option>`;
      html += tiposEnergia.map(t => `<option value="${t}" ${state.dadivaResistenciaEnergia?.[i] === t ? 'selected' : ''}>${t}</option>`).join('');
      html += `</select>`;
    }
  }

  return html;
}

function bindDistribuicaoASITalento() {
  const atualizar = () => {
    const total = [...document.querySelectorAll('.levelup-talento-asi-distribuicao')]
      .reduce((soma, select) => soma + (parseInt(select.value) || 0), 0);
    const el = document.getElementById('levelup-talento-pontos-total');
    if (el) {
      el.textContent = total;
      el.style.color = total === 2 ? 'var(--success)' : total > 2 ? 'var(--danger)' : 'inherit';
    }
  };
  document.querySelectorAll('.levelup-talento-asi-distribuicao')
    .forEach(select => select.addEventListener('change', atualizar));
}

function configurarSelectsTalentoExclusivos() {
  const selects = [...document.querySelectorAll('.escolha-talento-levelup')];
  if (selects.length < 2) return;
  const opcoesOriginais = new Map(selects.map(select => [select, select.innerHTML]));
  const vistos = new Set();
  selects.forEach(select => {
    if (select.value && vistos.has(select.value)) select.value = '';
    if (select.value) vistos.add(select.value);
  });
  const atualizar = () => {
    const escolhidas = selects.map(select => select.value).filter(Boolean);
    selects.forEach(select => {
      const propria = select.value;
      const temporario = document.createElement('select');
      temporario.innerHTML = opcoesOriginais.get(select);
      temporario.querySelectorAll('option').forEach(opcao => {
        if (opcao.value && opcao.value !== propria && escolhidas.includes(opcao.value)) opcao.remove();
      });
      temporario.querySelectorAll('optgroup').forEach(grupo => {
        if (!grupo.querySelector('option')) grupo.remove();
      });
      select.innerHTML = temporario.innerHTML;
      select.value = propria;
    });
  };
  selects.forEach(select => select.addEventListener('change', atualizar));
  atualizar();
}

export function bindEscolhasTalento(nome, talentoData, ctx, state = {}) {
  if (['Habilidoso', 'Artifista', 'Músico'].includes(nome)) configurarSelectsTalentoExclusivos();
  // Mestre das Armas: carregar armas (dano/propriedades/maestria) assincronamente.
  if (nome === 'Mestre das Armas') {
    getArmas().then(dadosArmas => {
      const el = document.getElementById('lvlup-mestre-armas-lista');
      if (!el) return;
      const descricoesMaestria = new Map(
        (dadosArmas?.propriedades || []).map(p => [p.nome, p.descricao]));
      const armasElegiveis = (dadosArmas?.armas || [])
        .filter(a => _ARMAS_SIMPLES_MARCIAIS.includes(a.nome));
      // Mestre das Armas: a escolha é uma arma, e o que importa é qual
      // maestria ela concede -- dado que o select escondia.
      montarSeletor(el, {
        opcoes: deArmas(armasElegiveis, {
          jaTem: new Set(ctx.char.maestrias_arma || []),
          descricoesMaestria,
        }),
        densidade: 'densa', max: 1, busca: true,
        selecionadas: state.escolhasTalento?.[0] ? [state.escolhasTalento[0]] : [],
        aoMudar: (sel) => {
          state.escolhasTalento = sel[0] ? [sel[0]] : [];
          state.talentoTipoEscolha = 'mestre_armas';
        },
      });
    });
  }

  // Telecinético com Mãos Mágicas já conhecida: carregar os truques de Mago
  // assincronamente (mesma fonte que Iniciado em Magia usa --
  // getMagiasClasse devolve { lista_magias: { Truques: [...] } }).
  if (nome === 'Telecinético' && _telecineticoPrecisaTruqueSubstituto(ctx.char)) {
    getMagiasClasse('Mago').then(dadosMagias => {
      const el = document.getElementById('lvlup-telecinetico-truque-lista');
      if (!el) return;
      // As entradas de `lista_magias.Truques` podem vir como string pura ou
      // objeto -- mesma normalização feita no fluxo de Iniciado em Magia.
      const truques = (dadosMagias?.lista_magias?.['Truques'] || [])
        .map(m => (typeof m === 'string' ? { nome: m } : m))
        // `circulo: 0` é forçado porque a lista por classe não traz o campo,
        // e sem ele deMagias (opcoes-dominio.js) agruparia como "NaNº Círculo".
        .map(m => ({ ...m, circulo: 0 }));
      montarSeletor(el, {
        opcoes: deMagias(truques, {
          // Bloqueia o que o personagem já conhece -- inclusive a própria
          // Mãos Mágicas, que é justamente o motivo desta tela existir.
          jaTem: new Set((ctx.char.magias_conhecidas || []).map(m => m.nome)),
        }),
        densidade: 'densa', max: 1, busca: true,
        selecionadas: state.escolhasTalento?.[0] ? [state.escolhasTalento[0]] : [],
        aoMudar: (sel) => {
          state.escolhasTalento = sel[0] ? [sel[0]] : [];
          state.talentoTipoEscolha = 'telecinetico_truque';
        },
      });
    });
  }

  // Tocado Por Fadas / Sombras: carregar magias assincronamente
  if (nome === 'Tocado Por Fadas' || nome === 'Tocado Pelas Sombras') {
    const escolas = nome === 'Tocado Por Fadas' ? ['Adivinhação', 'Encantamento'] : ['Ilusão', 'Necromancia'];
    getMagiasPorCirculo(1).then(dados => {
      const magias = (dados?.magias || []).filter(m => escolas.includes(m.escola));
      const el = document.getElementById('lvlup-magia-escola-lista');
      if (!el) return;
      // Círculo e escola passam a aparecer sem clicar.
      montarSeletor(el, {
        opcoes: deMagias(magias),
        densidade: 'densa', max: 1, busca: true,
        selecionadas: state.escolhasTalento?.[0] ? [state.escolhasTalento[0]] : [],
        aoMudar: (sel) => { state.escolhasTalento = sel[0] ? [sel[0]] : []; },
      });
    });
  }

  // Conjurador Ritualista: carregar magias rituais.
  //
  // A lista nascia VAZIA (o rótulo "Selecione N magias rituais" aparecia e
  // nada abaixo dele, e confirmar batia no aviso "Escolha exatamente N
  // magias rituais distintas"): o código varria `magias/circulo_N.json`
  // procurando `m.ritual` ou `m.especial === 'R'`, mas aquele acervo não
  // carrega marcador nenhum -- o Ritual só existe em
  // `classes/magias_<classe>.json`. Quem sabe achar isso é
  // `getMagiasRituais` (db.js), que ainda cobre os marcadores combinados
  // ('R, M', 'C, R') que a comparação `=== 'R'` perdia. São 11 magias.
  if (nome === 'Conjurador Ritualista') {
    const bonusProf = Math.floor((ctx.char.nivel || 1) / 4) + 2;
    getMagiasRituais(1).then(rituais => {
      const container = document.getElementById('levelup-rituais-container');
      if (!container) return;
      container.innerHTML = `
        <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:4px">Selecione ${bonusProf} magias rituais de 1º círculo:</div>
        <div id="levelup-rituais-lista"></div>
      `;
      // Cards, como todo ponto de escolha com dados: o jogador precisa ver
      // escola e descrição para escolher entre Identificar e Alarme. Os
      // checkboxes antigos (.levelup-ritual-check) não existem mais -- quem
      // lê a escolha lê de `state.escolhasTalento`, gravado aqui.
      montarSeletor(document.getElementById('levelup-rituais-lista'), {
        opcoes: deMagias(rituais),
        densidade: 'densa', max: bonusProf, busca: true,
        selecionadas: (state.escolhasTalento || []).filter(n => rituais.some(m => m.nome === n)),
        aoMudar: (sel) => { state.escolhasTalento = [...sel]; },
      });
    });
  }

  // Iniciado em Magia: cascata de seleções
  if (nome === 'Iniciado em Magia') {
    const selLista = document.getElementById('levelup-im-lista');
    selLista?.addEventListener('change', async () => {
      const lista = selLista.value;
      if (!lista) return;

      // Atributo: Inteligência, Sabedoria ou Carisma à escolha (padrão sugerido pela lista)
      const attrPadrao = state.iniciadoEmMagia?.lista === lista && state.iniciadoEmMagia?.atributo
        ? state.iniciadoEmMagia.atributo
        : ({ 'Clérigo': 'sabedoria', 'Druida': 'sabedoria', 'Mago': 'inteligencia' }[lista] || 'carisma');
      const attrContainer = document.getElementById('levelup-im-atributo-container');
      if (attrContainer) {
        attrContainer.innerHTML = `
          <div style="font-weight:600;font-size:0.85rem;margin-top:8px">Atributo de Conjuração</div>
          <select id="levelup-im-atributo" class="form-input" style="width:100%;margin:4px 0">
            ${['inteligencia', 'sabedoria', 'carisma'].map(k => `<option value="${k}" ${k === attrPadrao ? 'selected' : ''}>${ATRIBUTOS_NOMES[k]}</option>`).join('')}
          </select>
        `;
        attrContainer.style.display = 'block';
      }

      // Carregar truques da lista (JSON tem formato { classe, lista_magias: { 'Truques': [...], '1º Círculo': [...] } })
      const dadosMagias = await getMagiasClasse(lista);
      if (selLista.value !== lista) return; // usuário trocou a lista antes desta resposta chegar
      const listaMagias = dadosMagias?.lista_magias || {};
      const truquesLista = (listaMagias['Truques'] || []).map(m => typeof m === 'string' ? { nome: m } : m);
      // `circulo: 1` forçado aqui porque as entradas de `lista_magias['1º
      // Círculo']` (dados/classes/magias_*.json) não trazem esse campo --
      // é o balde em que já estão que diz o círculo, não um campo próprio.
      // deMagias (opcoes-dominio.js) precisa dele para o resumo do card
      // ("1º Círculo · Escola"); sem isto o card mostrava "undefinedº
      // Círculo" (achado ao converter para montarSeletor, Task 14).
      const magiasCirc1 = (listaMagias['1º Círculo'] || [])
        .map(m => typeof m === 'string' ? { nome: m } : m)
        .map(m => ({ ...m, circulo: 1 }));

      // Truques/magias já conhecidos por outra fonte — impede escolher duplicata sem ganho
      const jaTemTruqueIM = new Set((ctx.char.magias_conhecidas || []).filter(m => m.circulo === 0).map(m => m.nome));
      const jaTemMagiaIM = new Set([
        ...(ctx.char.magias_preparadas || []).map(m => m.nome),
        ...(ctx.char.magias_conhecidas || []).filter(m => m.circulo === 1).map(m => m.nome)
      ]);

      const truquesContainer = document.getElementById('levelup-im-truques-container');
      if (truquesContainer) {
        // Truques do Iniciado em Magia em cards, como o resto do app: em
        // checkbox o jogador escolhia dois truques vendo só o nome, sem
        // escola nem descrição. `circulo: 0` é injetado porque a lista da
        // classe (`lista_magias.Truques`) não traz o campo, e sem ele o card
        // não sabe onde buscar o texto completo do "ver detalhes".
        truquesContainer.innerHTML = `
          <div style="font-weight:600;font-size:0.85rem;margin-top:8px">Truques (2)</div>
          <div id="lvlup-im-truques-lista"></div>
        `;
        truquesContainer.style.display = 'block';

        const truquesRestaurados = state.iniciadoEmMagia?.lista === lista
          ? (state.iniciadoEmMagia?.truques || []) : [];
        montarSeletor(document.getElementById('lvlup-im-truques-lista'), {
          opcoes: deMagias(
            truquesLista.map(m => ({ ...m, circulo: 0 })),
            { jaTem: new Set([...jaTemTruqueIM].filter(n => !truquesRestaurados.includes(n))) }
          ),
          densidade: 'densa',
          max: 2,
          busca: true,
          selecionadas: truquesRestaurados,
          aoMudar: (sel) => {
            state.iniciadoEmMagia = { ...(state.iniciadoEmMagia || {}), lista, truques: sel };
          },
        });
      }

      const magiaContainer = document.getElementById('levelup-im-magia-container');
      if (magiaContainer) {
        magiaContainer.innerHTML = `
          <div style="font-weight:600;font-size:0.85rem;margin-top:8px">Magia de 1º Círculo (1)</div>
          <div id="lvlup-im-magia-lista"></div>
        `;
        magiaContainer.style.display = 'block';

        // A magia já conhecida por outra fonte fica bloqueada -- exceto a
        // que o próprio jogador já tinha escolhido para esta MESMA lista
        // (restauração ao navegar de volta): sem a exclusão abaixo, a
        // própria escolha do jogador voltaria marcada como indisponível.
        const jaTemParaCard = new Set(jaTemMagiaIM);
        const magiaRestaurada = state.iniciadoEmMagia?.lista === lista ? state.iniciadoEmMagia?.magia : '';
        if (magiaRestaurada) jaTemParaCard.delete(magiaRestaurada);

        // Magia de 1º Círculo: círculo e escola passam a aparecer sem clicar.
        montarSeletor(document.getElementById('lvlup-im-magia-lista'), {
          opcoes: deMagias(magiasCirc1, { jaTem: jaTemParaCard }),
          densidade: 'densa', max: 1, busca: true,
          selecionadas: magiaRestaurada ? [magiaRestaurada] : [],
          aoMudar: (sel) => {
            if (!state.iniciadoEmMagia) state.iniciadoEmMagia = {};
            state.iniciadoEmMagia.magia = sel[0] || '';
          },
        });
      }
    });
    if (selLista?.value) selLista.dispatchEvent(new Event('change'));
  }
}

// Limita um grupo de checkboxes a `max` marcados, atualizando o contador na
// tela -- compartilhado por bindEventosEscolhasClasse (Bardo/Guardião/
// Explorador Hábil/Acadêmico) e bindEventosTrocasOpcionais (Ladino nível 6),
// que vivem em steps diferentes do assistente de subida de nível.
function limitarCheckboxes(seletor, max, contadorId) {
  document.querySelectorAll(seletor).forEach(cb => {
    cb.addEventListener('change', () => {
      const selecionados = document.querySelectorAll(seletor + ':checked');
      if (selecionados.length > max) { cb.checked = false; return; }
      const cnt = document.getElementById(contadorId);
      if (cnt) cnt.textContent = selecionados.length;
    });
  });
}

// --- Escolhas de Classe ---
function bindEventosEscolhasClasse(ctx, state) {
  limitarCheckboxes('[data-bardo-expertise]', 2, 'levelup-bardo-expertise-count');
  limitarCheckboxes('[data-guardiao-expertise]', 2, 'levelup-guardiao-expertise-count');
  limitarCheckboxes('[data-explorador-idioma]', 2, 'levelup-explorador-idiomas-count');
  limitarCheckboxes('[data-academico-expertise]', 1, 'levelup-academico-count');

  // Escolha de Estilo de Luta (Task 10): card em vez do grid de radios
  // antigo. Guardião e Paladino ganham uma opção extra de dádiva de
  // conjuração (Combatente Druídico/Abençoado) além das 10 base.
  const escolhaEl = document.getElementById('lvlup-estilo-luta-escolha');
  if (escolhaEl) {
    const opcoesBase = [...OPCOES_ESTILO_LUTA_BASE];
    if (ctx.char.classe === 'Guardião') opcoesBase.push({ nome: 'Combatente Druídico', descricao: 'Aprende 2 truques de Druida (Sabedoria)' });
    if (ctx.char.classe === 'Paladino') opcoesBase.push({ nome: 'Combatente Abençoado', descricao: 'Aprende 2 truques de Clérigo (Carisma)' });
    montarSeletor(escolhaEl, {
      opcoes: deEstilosLuta(opcoesBase),
      densidade: 'ampla',
      max: 1,
      selecionadas: state.estiloLuta ? [state.estiloLuta] : [],
      aoMudar: (sel) => { state.estiloLuta = sel[0] || ''; },
    });
  }

  // Escolhas de subclasse: cada <select> grava em state.escolhasSubclasse[campo].
  // Quando a linha pede mais de uma opcao, os seletores compartilham o campo e
  // o valor vai como lista, na ordem dos indices -- e o mesmo formato que a
  // guarda de subirDeNivel espera.
  for (const el of document.querySelectorAll('[data-subclasse-escolha]')) {
    el.addEventListener('change', () => {
      const campo = el.dataset.subclasseEscolha;
      const irmaos = [...document.querySelectorAll(`[data-subclasse-escolha="${campo}"]`)];
      if (!state.escolhasSubclasse) state.escolhasSubclasse = {};
      state.escolhasSubclasse[campo] = irmaos.map((sel) => sel.value).filter(Boolean);
      // Sem chamar validateAll aqui: os outros binds deste arquivo também
      // só atualizam o state, e a validação roda uma vez em confirmarLevelUp
      // (levelup-ui.js:1572), com ctx e state. Chamá-la sem argumentos aqui
      // lançava TypeError dentro do listener.
    });
  }
}

// --- Trocas opcionais (Estilo de Luta do Guerreiro / Especialização do
// Ladino nível 6) -- vivem no step 'revisao_confirmacao'
// (levelup-cards.js:renderCardTrocasOpcionais), não em 'escolhas_classe'.
// Achado da revisão final: os dois cards renderizavam, mas nenhum evento
// os ligava nesse step (bindEventosStep não tinha case 'revisao_confirmacao'
// nenhum), então o select "para" nascia desabilitado para sempre e os
// checkboxes do Ladino nunca contavam nem limitavam -- a escolha do
// jogador nunca chegava a virar opcoes.* no confirmar.
function bindEventosTrocasOpcionais(ctx, state) {
  limitarCheckboxes('[data-ladino-expertise]', 2, 'levelup-ladino-expertise-count');

  // Troca de Estilo de Luta do Guerreiro (Task 10): um card com o estilo
  // atual e a grade dos demais. O "sai" tem um item só, então montarTroca
  // mostra "Trocar este" em vez de uma escolha falsa entre uma opção e
  // "Não trocar".
  const trocaEl = document.getElementById('lvlup-estilo-luta-troca');
  if (trocaEl) {
    const estiloAtual = (ctx.char.escolhas_classe?.estilo_luta || [])[0] || '';
    montarTroca(trocaEl, {
      // `selecionado`: mesmo motivo do `selecionado` da troca de magia, em
      // bindEventosMagias (achado do revisor, Task 12 Rodada 2) -- esta
      // troca (Task 10) ficou de fora daquela correção porque o lado "sai"
      // aqui tem um item só e usa o card de apresentação, que não dispara
      // `aoMudar` na montagem; sem isso, a tela remontava mostrando "Trocar
      // este" como se nada tivesse sido escolhido, enquanto o state (e a
      // validação do confirmar) ainda tinham a troca (achado da revisão
      // final, Critical C1).
      sai: {
        rotulo: 'Seu estilo atual',
        opcoes: deEstilosLuta(OPCOES_ESTILO_LUTA_BASE.filter(o => o.nome === estiloAtual)),
        selecionado: state.estiloLutaTrocarDe || null,
      },
      entra: {
        rotulo: 'Substituir por',
        densidade: 'ampla',
        opcoes: deEstilosLuta(OPCOES_ESTILO_LUTA_BASE, { jaTem: new Set([estiloAtual]) }),
        selecionado: state.estiloLutaTrocarPara || null,
      },
      aoMudar: ({ sai, entra }) => {
        state.estiloLutaTrocarDe = sai || '';
        state.estiloLutaTrocarPara = entra || '';
      },
    });
  }
}

// --- Magias ---
function bindEventosMagias(ctx, state) {
  const conj = calcularConjuracao(ctx, state);
  if (!conj) return;
  const listaMagiasClasse = ctx._listaMagiasClasse || [];
  const maxCirculoNovo = conj.maxCirculoNovo || 0;

  // Sets compartilhados (usam o state como referência)
  const truquesSel = new Set(state.truquesSelecionados);
  const magiasSel = new Set(state.magiasSelecionadas);
  const grimorioSel = new Set(state.grimorioSelecionados);
  const subclasseArcanaSel = new Set(state.subclasseMagiasSelecionados);

  const jaTemTruques = new Set((ctx.char.magias_conhecidas || []).map(m => m.nome));
  const jaTemMagias = new Set([
    ...(ctx.char.magias_preparadas || []).map(m => m.nome),
    ...(ctx.magiasDominioNivel || []).map(m => m.nome),
    ...(ctx.magiasSempreNivel || []).map(m => m.nome)
  ]);
  const jaTemGrimorio = new Set((ctx.char.grimorio || []).map(m => m.nome));

  function sincronizarSetsParaState() {
    state.truquesSelecionados = [...truquesSel];
    state.magiasSelecionadas = [...magiasSel];
    state.grimorioSelecionados = [...grimorioSel];
    state.subclasseMagiasSelecionados = [...subclasseArcanaSel];
  }

  function atualizarResumo(containerId, badgesId, set, max) {
    const resumo = document.getElementById(containerId);
    const badges = document.getElementById(badgesId);
    if (resumo) {
      if (set.size === 0) resumo.innerHTML = `<span style="color:var(--danger)">Nenhum selecionado. Selecione ${max}.</span>`;
      else if (set.size < max) resumo.innerHTML = `<span style="color:var(--warning-dark,orange)">${set.size}/${max}</span>`;
      else resumo.innerHTML = `<span style="color:var(--success)">${set.size}/${max}</span>`;
    }
    if (badges) {
      badges.innerHTML = [...set].map(n => `<span class="badge badge-accent" style="font-size:0.75rem">${n}</span>`).join('');
    }
  }

  function abrirGridSelecao(titulo, maxSel, selSet, filtroCirc, jaTemSet, resumoId, badgesId, escolaFiltro = null, circuloMaxOverride = null) {
    const circulosExpandidos = new Set();
    const circulosComEstadoDefinido = new Set();
    const circuloLimite = circuloMaxOverride != null ? circuloMaxOverride : maxCirculoNovo;
    let disponiveis = listaMagiasClasse.filter(m => {
      if (filtroCirc === 0) return m.circulo === 0;
      if (filtroCirc === 'magia') return m.circulo > 0 && m.circulo <= circuloLimite;
      return true;
    }).filter(m => !jaTemSet.has(m.nome))
      .filter(m => !escolaFiltro || m.escola === escolaFiltro);

    disponiveis.sort((a, b) => {
      const aS = selSet.has(a.nome) ? 0 : 1;
      const bS = selSet.has(b.nome) ? 0 : 1;
      return aS - bS || a.nome.localeCompare(b.nome, 'pt-BR');
    });

    const conteudo = `
      <div style="margin-bottom:8px;display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:0.85rem;color:var(--text-muted)">Selecionadas: <strong id="grid-sel-count">${selSet.size}</strong>/${maxSel}</span>
        <div class="search-box" style="flex:1;margin-left:12px"><input type="text" id="grid-busca" placeholder="Buscar..." class="form-input" style="padding:6px 10px;font-size:0.85rem"></div>
      </div>
      <div id="grid-magias-container" style="max-height:55vh;overflow-y:auto">
        <div id="grid-magias"></div>
      </div>
    `;

    abrirModal(titulo, conteudo, '<button class="btn btn-secondary" onclick="fecharModal()">Confirmar Seleção</button>');

    function renderGrid() {
      const termo = semAcento(document.getElementById('grid-busca')?.value || '');
      let filtradas = disponiveis;
      if (termo.length >= 2) filtradas = disponiveis.filter(m => semAcento(m.nome).includes(termo));

      const cheio = selSet.size >= maxSel;
      const gridEl = document.getElementById('grid-magias');
      if (!gridEl) return;

      const magiasPorCirculo = new Map();
      filtradas.forEach(m => {
        if (!magiasPorCirculo.has(m.circulo)) magiasPorCirculo.set(m.circulo, []);
        magiasPorCirculo.get(m.circulo).push(m);
      });
      gridEl.innerHTML = filtradas.length === 0
        ? '<div style="text-align:center;color:var(--text-muted);padding:16px">Nenhuma magia encontrada.</div>'
        : [...magiasPorCirculo.entries()].sort(([a], [b]) => a - b).map(([circulo, magias]) => `
          <details data-grid-circulo="${circulo}" ${termo.length >= 2 || circulosExpandidos.has(circulo) || (circulo === 0 && !circulosComEstadoDefinido.has(circulo)) ? 'open' : ''} style="margin:8px 0">
            <summary class="section-divider" style="margin:0;cursor:pointer"><span>${circulo === 0 ? 'Truques' : `${circulo}º Círculo`} (${magias.length})</span></summary>
            <div class="opcao-grid densa">${magias.map(m => {
        const sel = selSet.has(m.nome);
        const bloqueado = cheio && !sel;
        return `
          <div class="opcao-card ${sel ? 'selecionada' : ''} ${bloqueado ? 'bloqueada' : ''}"
               data-grid-nome="${m.nome}" data-grid-circ="${m.circulo}"
               style="${bloqueado ? 'opacity:0.35;cursor:default' : ''}">
            <span class="opcao-check" data-grid-check="${m.nome}"></span>
            <div class="opcao-nome" data-grid-info="${m.nome}" data-grid-info-circ="${m.circulo}">${m.nome}</div>
            <div class="opcao-resumo">
              <span>${m.circulo === 0 ? 'Truque' : m.circulo + 'º Círculo'}</span>
              <span>${m.escola || ''}</span>
              ${m.especial === 'C' ? '<span>Conc.</span>' : ''}
            </div>
          </div>`;
      }).join('')}</div>
          </details>`).join('');

      const cntEl = document.getElementById('grid-sel-count');
      if (cntEl) {
        cntEl.textContent = selSet.size;
        cntEl.style.color = selSet.size === maxSel ? 'var(--success)' : 'inherit';
      }

      gridEl.querySelectorAll('[data-grid-circulo]').forEach(grupo => {
        grupo.addEventListener('toggle', () => {
          const circulo = Number(grupo.dataset.gridCirculo);
          circulosComEstadoDefinido.add(circulo);
          if (grupo.open) circulosExpandidos.add(circulo);
          else circulosExpandidos.delete(circulo);
        });
      });

      gridEl.querySelectorAll('[data-grid-check]').forEach(check => {
        check.addEventListener('click', (e) => {
          e.stopPropagation();
          const n = check.dataset.gridCheck;
          if (selSet.has(n)) selSet.delete(n);
          else if (selSet.size < maxSel) selSet.add(n);
          sincronizarSetsParaState();
          renderGrid();
          atualizarResumo(resumoId, badgesId, selSet, maxSel);
        });
      });

      gridEl.querySelectorAll('[data-grid-info]').forEach(el => {
        el.addEventListener('click', async (e) => {
          e.stopPropagation();
          const n = el.dataset.gridInfo;
          const circ = parseInt(el.dataset.gridInfoCirc);
          const dados = await getMagiasPorCirculo(circ);
          const magia = dados?.magias?.find(m => m.nome === n);
          if (!magia) return;
          abrirModal(magia.nome, `
            <div style="margin-bottom:8px;display:flex;flex-wrap:wrap;gap:8px;font-size:0.85rem">
              <span class="badge badge-primary">${circ === 0 ? 'Truque' : circ + 'º Círculo'}</span>
              <span class="badge badge-secondary">${magia.escola}</span>
              <span>${magia.tempo_conjuracao}</span> <span>${magia.alcance}</span>
              <span>${magia.componentes}</span> <span>${magia.duracao}</span>
            </div>
            <div class="md-content">${mdParaHtml(magia.descricao)}</div>
            ${magia.circulo_superior ? `<div class="info-box info mt-1"><strong>Em círculos superiores:</strong><div class="md-content">${mdParaHtml(magia.circulo_superior)}</div></div>` : ''}
          `, '<button class="btn btn-primary" onclick="fecharModal()">Fechar</button>');
        });
      });
    }

    document.getElementById('grid-busca')?.addEventListener('input', renderGrid);
    renderGrid();
  }

  // Botões de seleção
  if (conj.truquesGanhos > 0) {
    document.getElementById('btn-lvlup-truques')?.addEventListener('click', () => {
      abrirGridSelecao(`Selecionar Truques (+${conj.truquesGanhos})`, conj.truquesGanhos, truquesSel, 0, jaTemTruques, 'lvlup-truques-resumo', 'lvlup-truques-badges');
    });
  }
  if (conj.tipoConj === 'conhecidas' && conj.magiasGanhas > 0) {
    document.getElementById('btn-lvlup-magias')?.addEventListener('click', () => {
      abrirGridSelecao(`Selecionar Magias (+${conj.magiasGanhas})`, conj.magiasGanhas, magiasSel, 'magia', jaTemMagias, 'lvlup-magias-resumo', 'lvlup-magias-badges');
    });
  }
  if (conj.ehMago) {
    document.getElementById('btn-lvlup-grimorio')?.addEventListener('click', () => {
      const jaTemSet = new Set([...jaTemGrimorio, ...subclasseArcanaSel]);
      abrirGridSelecao('Grimório: +2 Magias', 2, grimorioSel, 'magia', jaTemSet, 'lvlup-grimorio-resumo', 'lvlup-grimorio-badges');
    });
  }
  const subclasseArcana = calcularSubclasseArcana(ctx, state);
  if (subclasseArcana) {
    document.getElementById('btn-lvlup-subclasse-arcana')?.addEventListener('click', () => {
      const jaTemSet = new Set([...jaTemGrimorio, ...grimorioSel]);
      abrirGridSelecao(
        `${subclasseArcana.escola}: +${subclasseArcana.quantidade} Magia(s)`,
        subclasseArcana.quantidade,
        subclasseArcanaSel,
        'magia',
        jaTemSet,
        'lvlup-subclasse-arcana-resumo',
        'lvlup-subclasse-arcana-badges',
        subclasseArcana.escola,
        subclasseArcana.circuloMax
      );
    });
  }

  // Troca de magia conhecida (Task 12): o que sai são as magias preparadas
  // do personagem (fora as de origem especial -- domínio, sempre preparadas
  // etc., que não são escolha do jogador), o que entra é a lista de magias
  // da classe dentro do círculo máximo já alcançado. `magiasAtuais` só tem
  // {nome,circulo,origem} salvos no personagem -- deMagias() precisa dos
  // dados completos (escola, duração) para mostrar círculo/escola/
  // concentração nos dois lados, por isso busca em `listaMagiasClasse`.
  // ------------------------------------------------------------
  // Trocas MULTIPLAS na subida de nivel.
  //
  // Ao avancar um nivel o jogador pode trocar quantas magias e truques
  // quiser (decisao de produto, ver regras-preparo-magias.js); o Descanso
  // Longo e que fica com uma so. O componente `montarTroca` (ui-opcoes.js)
  // monta UM par, e e usado tambem por maestrias e manobras -- entao em vez
  // de reescreve-lo, este bloco o reaproveita: as trocas ja confirmadas
  // viram linhas acima dele, e um botao "Adicionar outra troca" empurra o
  // par atual para a lista e remonta o componente vazio.
  //
  // O par atual NAO precisa ser confirmado pelo botao para valer: quem
  // escolher uma troca so e terminar o nivel tem a troca aplicada do mesmo
  // jeito (ver a aplicacao, mais abaixo). O botao existe para a SEGUNDA.

  /** Desenha as trocas ja confirmadas, cada uma com um botao de desfazer. */
  function _desenharTrocasFeitas(el, lista, rotulo, aoRemover) {
    if (!el) return;
    if (!lista.length) { el.innerHTML = ''; return; }
    el.innerHTML = lista.map((t, i) => `
      <div class="opcao-passo resolvido" style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
        <strong style="color:var(--primary)">${escHtml(t.de)}</strong>
        <span style="color:var(--text-muted)">&rarr;</span>
        <strong style="color:var(--primary)">${escHtml(t.para)}</strong>
        <span class="opcao-passo-alterar" data-desfazer-troca="${i}" style="margin-left:auto">desfazer</span>
      </div>`).join('');
    el.querySelectorAll('[data-desfazer-troca]').forEach((btn) => {
      btn.addEventListener('click', () => {
        lista.splice(Number(btn.dataset.desfazerTroca), 1);
        aoRemover();
      });
    });
    el.insertAdjacentHTML('afterbegin',
      `<div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:4px">${escHtml(rotulo)}</div>`);
  }

  /** Botao que empurra o par atual para a lista e limpa o componente. */
  function _botaoAdicionarTroca(el, aoAdicionar) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-sm btn-secondary';
    btn.style.marginTop = '6px';
    btn.textContent = '+ Adicionar outra troca';
    btn.addEventListener('click', aoAdicionar);
    el.appendChild(btn);
  }

  const trocaMagiaEl = document.getElementById('levelup-troca-magia');
  if (trocaMagiaEl) {
    // Montado numa funcao porque precisa ser REFEITO a cada troca
    // adicionada ou desfeita: quem ja saiu nao pode sair de novo, e quem ja
    // entrou nao pode entrar duas vezes.
    const montarBlocoTrocaMagia = () => {
      const jaSairam = new Set(state.trocasMagia.map((t) => t.de));
      const jaEntraram = new Set(state.trocasMagia.map((t) => t.para));

      const magiasAtuaisNomes = new Set((ctx.char.magias_preparadas || [])
        .filter(m => m.circulo > 0 && magiaContaNoLimite(m) && !jaSairam.has(m.nome))
        .map(m => m.nome));
      // As que ENTRARAM por uma troca anterior tambem podem sair numa
      // seguinte -- o jogador mudou de ideia -- mas so depois de aplicadas.
      // Aqui elas ainda nao estao em `magias_preparadas`, entao entram pela
      // lista da classe.
      const magiasAtuaisCompletas = listaMagiasClasse.filter(m => magiasAtuaisNomes.has(m.nome));
      // Fonte do lado "entra": o Mago so pode preparar o que esta no grimorio
      // (mesma regra de sheet/grimorio.js/mostrarTrocaMagias no Descanso Longo
      // e de normalizarGrimorioMago); as demais classes usam a lista da classe.
      // Sem isto, abrir a troca para classes preparadas (2026-08-13) deixaria
      // o Mago preparar magia que nao esta no livro dele.
      const fonteEntra = conj.ehMago
        ? (ctx.char.grimorio || []).map(m => ({ ...m }))
        : listaMagiasClasse;

      _desenharTrocasFeitas(
        document.getElementById('levelup-trocas-magia-feitas'),
        state.trocasMagia, 'Trocas já feitas:', montarBlocoTrocaMagia);

      montarTroca(trocaMagiaEl, {
        // `selecionado`: restaura a troca já escolhida antes deste bind ser
        // refeito do zero -- ex.: "Anterior" e "Próximo" de volta a este
        // passo. Sem isso, montarTroca (ui-opcoes.js) apagava a escolha em
        // silêncio ao remontar (achado do revisor, Task 12 Rodada 2).
        sai: { rotulo: 'Qual magia sai?', opcoes: deMagias(magiasAtuaisCompletas), selecionado: state.trocarDe || null },
        entra: {
          rotulo: 'Qual entra no lugar?', densidade: 'densa', busca: true,
          opcoes: deMagias(
            fonteEntra.filter(m => m.circulo > 0 && m.circulo <= maxCirculoNovo),
            { jaTem: new Set([...jaTemMagias, ...magiasSel, ...jaEntraram]) }
          ),
          selecionado: state.trocarPara || null,
        },
        aoMudar: ({ sai, entra }) => {
          state.trocarDe = sai || '';
          state.trocarPara = entra || '';
          state.trocarParaCirculo = entra ? (fonteEntra.find(m => m.nome === entra)?.circulo || 0) : 0;
          if (state.trocarDe && state.trocarPara) {
            _botaoAdicionarTroca(trocaMagiaEl, () => {
              state.trocasMagia.push({
                de: state.trocarDe, para: state.trocarPara, circulo: state.trocarParaCirculo,
              });
              state.trocarDe = ''; state.trocarPara = ''; state.trocarParaCirculo = 0;
              montarBlocoTrocaMagia();
            });
          }
        },
      });
    };
    montarBlocoTrocaMagia();
  }

  // Troca de truque (Task 12): mesma forma da troca de magia, restrita a
  // círculo 0 e sem limite de círculo máximo.
  const trocaTruqueEl = document.getElementById('levelup-troca-truque');
  if (trocaTruqueEl) {
    const montarBlocoTrocaTruque = () => {
      const jaSairam = new Set(state.trocasTruque.map((t) => t.de));
      const jaEntraram = new Set(state.trocasTruque.map((t) => t.para));

      const truquesAtuaisNomes = new Set((ctx.char.magias_conhecidas || [])
        .filter(m => m.circulo === 0 && truqueEhTrocavel(m) && !jaSairam.has(m.nome))
        .map(m => m.nome));
      const truquesAtuaisCompletos = listaMagiasClasse.filter(m => truquesAtuaisNomes.has(m.nome));

      _desenharTrocasFeitas(
        document.getElementById('levelup-trocas-truque-feitas'),
        state.trocasTruque, 'Trocas já feitas:', montarBlocoTrocaTruque);

      montarTroca(trocaTruqueEl, {
        // `selecionado`: mesmo motivo do `selecionado` da troca de magia,
        // acima (achado do revisor, Task 12 Rodada 2).
        sai: { rotulo: 'Qual truque sai?', opcoes: deMagias(truquesAtuaisCompletos), selecionado: state.truqueTrocarDe || null },
        entra: {
          rotulo: 'Qual entra no lugar?', densidade: 'densa', busca: true,
          opcoes: deMagias(
            listaMagiasClasse.filter(m => m.circulo === 0),
            { jaTem: new Set([...jaTemTruques, ...truquesSel, ...jaEntraram]) }
          ),
          selecionado: state.truqueTrocarPara || null,
        },
        aoMudar: ({ sai, entra }) => {
          state.truqueTrocarDe = sai || '';
          state.truqueTrocarPara = entra || '';
          if (state.truqueTrocarDe && state.truqueTrocarPara) {
            _botaoAdicionarTroca(trocaTruqueEl, () => {
              state.trocasTruque.push({ de: state.truqueTrocarDe, para: state.truqueTrocarPara });
              state.truqueTrocarDe = ''; state.truqueTrocarPara = '';
              montarBlocoTrocaTruque();
            });
          }
        },
      });
    };
    montarBlocoTrocaTruque();
  }
}

// --- Manobras (Mestre da Batalha) ---
function bindEventosManobrasGuerreiro(ctx, state) {
  const mg = ctx.manobrasGuerreiro;
  if (!mg) return;

  const manobrasSel = new Set(state.manobrasNovasSelecionadas);
  const jaTemManobras = new Set(mg.manobrasConhecidasAtuais);
  const candidatasNovas = mg.opcoesDisponiveis.filter(m => !jaTemManobras.has(m.nome));

  function sincronizarSetParaState() {
    state.manobrasNovasSelecionadas = [...manobrasSel];
  }

  function atualizarResumoManobras() {
    const resumo = document.getElementById('lvlup-manobras-resumo');
    const badges = document.getElementById('lvlup-manobras-badges');
    if (resumo) {
      if (manobrasSel.size === 0) resumo.innerHTML = `<span style="color:var(--danger)">Nenhuma selecionada. Selecione ${mg.qtdNova}.</span>`;
      else if (manobrasSel.size < mg.qtdNova) resumo.innerHTML = `<span style="color:var(--warning-dark,orange)">${manobrasSel.size}/${mg.qtdNova}</span>`;
      else resumo.innerHTML = `<span style="color:var(--success)">${manobrasSel.size}/${mg.qtdNova}</span>`;
    }
    if (badges) badges.innerHTML = [...manobrasSel].map(n => `<span class="badge badge-accent" style="font-size:0.75rem">${n}</span>`).join('');
  }

  document.getElementById('btn-lvlup-manobras')?.addEventListener('click', () => {
    abrirGridManobras(`Selecionar Manobras (+${mg.qtdNova})`, mg.qtdNova, candidatasNovas, manobrasSel, () => {
      sincronizarSetParaState();
      atualizarResumoManobras();
    });
  });

  // Troca de manobra conhecida (Task 12): as manobras já são cards com
  // descrição no grid principal (abrirGridManobras acima) -- esta troca
  // usava select, incoerência que este componente elimina. `sai` vem de
  // `mg.opcoesDisponiveis` (nomes de `manobrasConhecidasAtuais` só têm o
  // nome salvo no personagem; a lista completa da subclasse tem a
  // descrição) filtrado pelos nomes já conhecidos.
  const trocaManobraEl = document.getElementById('levelup-troca-manobra');
  if (trocaManobraEl) {
    const manobrasConhecidasCompletas = mg.opcoesDisponiveis.filter(m => jaTemManobras.has(m.nome));
    montarTroca(trocaManobraEl, {
      // `selecionado`: mesmo motivo do `selecionado` da troca de magia, em
      // bindEventosMagias acima (achado do revisor, Task 12 Rodada 2).
      sai: { rotulo: 'Qual manobra sai?', opcoes: deManobras(manobrasConhecidasCompletas), selecionado: state.manobraTrocarDe || null },
      entra: {
        rotulo: 'Qual entra no lugar?', densidade: 'densa', busca: true,
        opcoes: deManobras(mg.opcoesDisponiveis, { jaTem: new Set([...jaTemManobras, ...manobrasSel]) }),
        selecionado: state.manobraTrocarPara || null,
      },
      aoMudar: ({ sai, entra }) => {
        state.manobraTrocarDe = sai || '';
        state.manobraTrocarPara = entra || '';
      },
    });
  }
}

// ============================================================
// CONFIRMAÇÃO / SUBMISSÃO
// ============================================================

export async function confirmarLevelUp(ctx, state, caches) {
  if (state.confirmando) return;
  const erro = validateAll(ctx, state);
  if (erro) { toast(erro, 'error'); return; }

  if (ctx.ganhaASI && state.asiModo === 'talento') {
    const talentoData = Object.values(caches.talentosCache?.por_categoria || {})
      .flat().find(talento => talento.nome === state.talento);
    const atributosASI = obterAtributosASITalento(talentoData);
    const atributo = state.talentoASI;
    const valorAtual = Number(ctx.char.atributos?.[atributo]);
    const limiteASI = getLimiteASITalento(talentoData);
    if (atributosASI.length > 0 && (!atributo || !atributosASI.includes(atributo) || !Number.isFinite(valorAtual) || valorAtual >= limiteASI)) {
      toast(`Escolha um atributo elegível abaixo de ${limiteASI} para o talento.`, 'error');
      return;
    }
  }

  // Validar dados de Iniciado em Magia (já persistidos em state por salvarStateDoDOM;
  // o DOM do step de talento não existe mais nesta etapa de revisão).
  if (ctx.ganhaASI && state.asiModo === 'talento' && state.talento === 'Iniciado em Magia') {
    const im = state.iniciadoEmMagia;
    if (!im || !im.lista || !im.atributo || (im.truques?.length || 0) < 2 || !im.magia) {
      toast('Preencha todas as escolhas de Iniciado em Magia', 'error');
      return;
    }
  }

  // Coletar tipo de escolha para talentos especiais
  if (ctx.ganhaASI && state.asiModo === 'talento') {
    const talNome = state.talento;
    if (talNome === 'Analítico') state.talentoTipoEscolha = 'analitico';
    if (talNome === 'Mente Aguçada') state.talentoTipoEscolha = 'mente_agucada';
    if (talNome === 'Especialista em Perícia') state.talentoTipoEscolha = 'especialista_pericia';
    if (talNome === 'Resiliente') state.talentoTipoEscolha = 'resiliente';
    if (talNome === 'Adepto Elemental') state.talentoTipoEscolha = 'adepto_elemental';
    if (talNome === 'Tocado Por Fadas') state.talentoTipoEscolha = 'tocado_fadas';
    if (talNome === 'Tocado Pelas Sombras') state.talentoTipoEscolha = 'tocado_sombras';
    if (talNome === 'Conjurador Ritualista') state.talentoTipoEscolha = 'conjurador_ritualista';
    if (talNome === 'Iniciado em Magia') state.talentoTipoEscolha = 'iniciado_em_magia';
    if (talNome === 'Dádiva da Resistência à Energia') state.talentoTipoEscolha = 'dadiva_resistencia_energia';
    if (talNome === 'Dádiva da Proficiência em Perícia') state.talentoTipoEscolha = 'dadiva_proficiencia_pericia';
  }

  state.confirmando = true;
  const opcoes = collectOpcoes(ctx, state);
  const { char } = ctx;

  // Processar magias antes de subirDeNivel (igual ao original)
  let truquesAdicionados = [];
  let magiasAdicionadas = [];
  let grimorioAdicionado = [];
  // Listas, e nao um par: a subida de nivel aceita quantas trocas o jogador
  // quiser (decisao de produto, ver regras-preparo-magias.js).
  const trocasMagiaAplicadas = [];
  const trocasTruqueAplicadas = [];
  const listaMagiasClasse = ctx._listaMagiasClasse || [];

  // Reativo à subclasse escolhida agora: sem isto, as magias e truques
  // escolhidos por quem vira conjurador neste nível eram descartados em
  // silêncio na hora de confirmar.
  if (ehConjuradorAtivo(ctx, state)) {
    // Truques
    state.truquesSelecionados.forEach(nome => {
      const m = listaMagiasClasse.find(x => x.nome === nome);
      if (m && !char.magias_conhecidas?.find(x => x.nome === nome)) {
        if (!char.magias_conhecidas) char.magias_conhecidas = [];
        char.magias_conhecidas.push({ nome, circulo: 0 });
        truquesAdicionados.push(nome);
      }
    });

    // Magias conhecidas
    state.magiasSelecionadas.forEach(nome => {
      const m = listaMagiasClasse.find(x => x.nome === nome);
      if (m && !char.magias_preparadas?.find(x => x.nome === nome)) {
        if (!char.magias_preparadas) char.magias_preparadas = [];
        char.magias_preparadas.push({ nome, circulo: m.circulo });
        magiasAdicionadas.push(nome);
      }
    });

    // Trocas de magia. `state.trocasMagia` guarda as confirmadas pelo botao
    // "Adicionar outra troca"; o par pendente entra no fim, se estiver
    // completo -- quem faz UMA troca so nunca clica naquele botao, e nao
    // pode perder a troca por causa disso.
    const todasTrocasMagia = [
      ...state.trocasMagia,
      ...(state.trocarDe && state.trocarPara
        ? [{ de: state.trocarDe, para: state.trocarPara, circulo: state.trocarParaCirculo }]
        : []),
    ];
    for (const troca of todasTrocasMagia) {
      const idx = char.magias_preparadas?.findIndex(m => m.nome === troca.de);
      if (idx !== undefined && idx !== -1) {
        trocasMagiaAplicadas.push(troca);
        char.magias_preparadas.splice(idx, 1);
        char.magias_preparadas.push({ nome: troca.para, circulo: troca.circulo });
      }
    }

    // Trocas de truque -- mesma forma das de magia, acima.
    const todasTrocasTruque = [
      ...state.trocasTruque,
      ...(state.truqueTrocarDe && state.truqueTrocarPara
        ? [{ de: state.truqueTrocarDe, para: state.truqueTrocarPara }]
        : []),
    ];
    for (const troca of todasTrocasTruque) {
      const idx = char.magias_conhecidas?.findIndex(m => m.nome === troca.de);
      if (idx !== undefined && idx !== -1) {
        trocasTruqueAplicadas.push(troca);
        char.magias_conhecidas.splice(idx, 1);
        char.magias_conhecidas.push({ nome: troca.para, circulo: 0 });
      }
    }
  }

  // Executar level up
  const resultado = await subirDeNivel(char, opcoes);

  if (resultado.sucesso) {
    grimorioAdicionado = (resultado.grimorio_adicionado || []).map(magia => magia.nome);
    const subclasseMagiasAdicionadas = (resultado.subclasse_magias_adicionadas || []).map(magia => magia.nome);
    _salvarFn?.();
    window.fecharModalTodos?.();

    // Resumo
    const resumo = montarResumoFinal(resultado, char, truquesAdicionados, magiasAdicionadas, grimorioAdicionado, trocasMagiaAplicadas, subclasseMagiasAdicionadas, trocasTruqueAplicadas);
    abrirModal('Subida de Nível Concluída!', resumo, '<button class="btn btn-primary" onclick="fecharModal()">OK</button>');
    _renderFichaFn?.();
  } else {
    state.confirmando = false;
    toast(resultado.erro || resultado.mensagem || 'Erro ao subir de nível', 'error');
  }
}

function montarResumoFinal(resultado, char, truquesAdicionados, magiasAdicionadas, grimorioAdicionado, trocasMagia = [], subclasseMagiasAdicionadas = [], trocasTruque = []) {
  const attrNomes = { forca: 'Força', destreza: 'Destreza', constituicao: 'Constituição', inteligencia: 'Inteligência', sabedoria: 'Sabedoria', carisma: 'Carisma' };

  // Icones SVG inline
  const iconHeart = `<svg width="18" height="18" viewBox="0 0 24 24" fill="var(--danger)" stroke="none" style="vertical-align:middle;margin-right:4px"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`;
  const iconArrow = `<span style="color:var(--text-light);margin:0 8px">➜</span>`;
  const iconCheck = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="margin-right:8px;vertical-align:middle;flex-shrink:0"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

  // Lista de novidades
  const itens = [];
  
  if (resultado.subclasse_escolhida) itens.push(`Subclasse: <strong>${resultado.subclasse_escolhida}</strong>`);
  if (resultado.aumentos_aplicados) itens.push(`Atributos aumentados`);
  
  if (resultado.talento_aplicado) {
    let t = `Talento: <strong>${resultado.talento_aplicado}</strong>`;
    if ((resultado.escolhas_talento_levelup || []).length > 0) t += ` (${resultado.escolhas_talento_levelup.join(', ')})`;
    if (resultado.talento_asi_aplicado) t += ` (+1 ${attrNomes[resultado.talento_asi_aplicado] || resultado.talento_asi_aplicado})`;
    itens.push(t);
  }

  (resultado.caracteristicas_subclasse || []).forEach(f => itens.push(`<strong>[${char.subclasse}]</strong> ${f.nome}`));
  if ((resultado.magias_dominio_adicionadas || []).length > 0) itens.push(`Magias de domínio: ${resultado.magias_dominio_adicionadas.map(m => m.nome).join(', ')}`);
  if ((resultado.magias_sempre_adicionadas || []).length > 0) itens.push(`Magias sempre preparadas: ${resultado.magias_sempre_adicionadas.map(m => m.nome).join(', ')}`);
  if ((resultado.expertise_bardo_aplicada || []).length > 0) itens.push(`Especialização Bardo: ${resultado.expertise_bardo_aplicada.join(', ')}`);
  if ((resultado.expertise_guardiao_aplicada || []).length > 0) itens.push(`Especialista Guardião: ${resultado.expertise_guardiao_aplicada.join(', ')}`);
  if ((resultado.expertise_ladino_aplicada || []).length > 0) itens.push(`Especialização Ladino: ${resultado.expertise_ladino_aplicada.join(', ')}`);
  if (resultado.estilo_luta_aplicado) itens.push(`Estilo de Luta: ${resultado.estilo_luta_aplicado}`);
  if (resultado.estilo_luta_troca_aplicada) itens.push(`Troca de Estilo de Luta: ${resultado.estilo_luta_troca_aplicada.de} ${iconArrow} ${resultado.estilo_luta_troca_aplicada.para}`);
  if (resultado.explorador_habil_aplicado?.expertise) itens.push(`Explorador Hábil: ${resultado.explorador_habil_aplicado.expertise}`);
  if ((resultado.explorador_habil_aplicado?.idiomas || []).length > 0) itens.push(`Idiomas: ${resultado.explorador_habil_aplicado.idiomas.join(', ')}`);
  if ((resultado.academico_aplicado || []).length > 0) itens.push(`Acadêmico: ${resultado.academico_aplicado.join(', ')}`);
  
  if (truquesAdicionados.length > 0) itens.push(`Truques: +${truquesAdicionados.join(', ')}`);
  if (magiasAdicionadas.length > 0) itens.push(`Magias: +${magiasAdicionadas.join(', ')}`);
  if (grimorioAdicionado.length > 0) itens.push(`Grimório: +${grimorioAdicionado.join(', ')}`);
  if (subclasseMagiasAdicionadas.length > 0) {
    const label = resultado.subclasse_escolhida ? `Magias de Subclasse (${resultado.subclasse_escolhida})` : 'Magias de Subclasse';
    itens.push(`${label}: +${subclasseMagiasAdicionadas.join(', ')}`);
  }
  // Uma linha por troca: o resumo mostrava um par so, e agora pode haver
  // varias -- calar as demais faria o jogador confirmar o que nao viu.
  for (const t of trocasMagia) itens.push(`Troca: ${t.de} ${iconArrow} ${t.para}`);
  for (const t of trocasTruque) itens.push(`Troca de truque: ${t.de} ${iconArrow} ${t.para}`);

  // HTML Final
  return `
    <div style="text-align:center; padding: 0 8px;">
      
      <!-- Nível -->
      <div style="font-size:1.4rem; margin:16px 0; color:var(--primary); font-weight:600; display:flex; align-items:center; justify-content:center; gap:8px;">
        <span style="color:var(--text-muted);font-size:1rem">Nível ${resultado.nivel_anterior}</span>
        ${iconArrow}
        <span style="font-size:1.6rem">Nível ${resultado.nivel_novo}</span>
      </div>

      <!-- Card de HP -->
      <div style="background:var(--bg-input); border-radius:var(--radius); padding:12px; margin-bottom:20px; border:1px solid var(--border-light); display:inline-block; min-width:200px">
        <div style="color:var(--success); font-weight:bold; font-size:1.1rem; margin-bottom:4px">
          +${resultado.hp_ganho} HP
        </div>
        <div style="font-size:0.9rem; color:var(--text-muted)">
          ${resultado.hp_mode === 'rolado' ? `(Rolado: ${resultado.hp_rolado})` : '(Valor Fixo)'}
          ${resultado.bonus_con_retroativo > 0 ? `<br><small>+${resultado.bonus_con_retroativo} (CON Retroativo)</small>` : ''}
        </div>
        <div style="margin-top:8px; border-top:1px solid var(--border); paddingTop:4px; font-weight:600; color:var(--text)">
          ${iconHeart} Total: ${char.pv_max} PV
        </div>
      </div>

      <!-- Lista de Features -->
      ${itens.length > 0 ? `
        <div style="text-align:left; background:var(--bg-card); border:1px solid var(--border-light); border-radius:var(--radius); padding:16px;">
          <h4 style="margin:0 0 12px 0; font-size:1rem; color:var(--primary); border-bottom:1px solid var(--border-light); padding-bottom:8px">Novas Características</h4>
          <ul style="list-style:none; padding:0; margin:0">
            ${itens.map(txt => `<li style="margin-bottom:8px; display:flex; align-items:flex-start; line-height:1.4">${iconCheck}<span>${txt}</span></li>`).join('')}
          </ul>
        </div>
      ` : ''}

    </div>
  `;
}
