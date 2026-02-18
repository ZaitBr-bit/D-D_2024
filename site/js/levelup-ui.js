// ============================================================
// Orquestrador do Level Up em Cards
// Fase 5: Integra flow + cards + eventos + submissão
// ============================================================
import {
  buildLevelUpContext, buildVisibleSteps, createInitialState,
  proximoStep, stepAnterior, todosStepsCompletos
} from './levelup-flow.js';
import {
  renderCardGanhosNivel, renderCardSubclasse, renderCardASI,
  renderCardEscolhasClasse, renderCardMagias, renderCardRevisao
} from './levelup-cards.js';
import { collectOpcoes, validateAll } from './levelup-validations.js';
import { ATRIBUTOS_KEYS, ATRIBUTOS_NOMES, ATRIBUTO_NOME_PARA_KEY, PERICIAS } from './dados-classes.js';
import { getMagiasPorCirculo, getMagiasClasse } from './db.js';
import { abrirModal, fecharModal, toast, mdParaHtml, semAcento, calcMod, getEspacosMagia } from './utils.js';
import { subirDeNivel } from './levelup.js';

// Referências injetadas pelo sheet.js
let _salvarFn = null;
let _renderFichaFn = null;
let _levelUpFluxoAtivo = false;
let _levelUpModalPrincipalAberto = false;

// Constantes para escolhas de talentos
const _PERICIAS_NOMES = [
  'Acrobacia','Arcanismo','Atletismo','Atuação','Enganação','Furtividade',
  'História','Intimidação','Intuição','Investigação','Lidar com Animais',
  'Medicina','Natureza','Percepção','Persuasão','Prestidigitação',
  'Religião','Sobrevivência'
];
const _FERRAMENTAS_TODAS = [
  'Ferramentas de Carpinteiro','Ferramentas de Cartógrafo','Ferramentas de Coureiro',
  'Ferramentas de Entalhador','Ferramentas de Ferreiro','Ferramentas de Funileiro',
  'Ferramentas de Joalheiro','Ferramentas de Oleiro','Ferramentas de Pedreiro',
  'Ferramentas de Sapateiro','Ferramentas de Tecelão','Ferramentas de Vidreiro',
  'Suprimentos de Alquimista','Suprimentos de Calígrafo','Suprimentos de Cervejeiro',
  'Suprimentos de Pintor','Utensílios de Cozinheiro',
  'Ferramentas de Ladrão','Ferramentas de Navegador',
  'Kit de Disfarce','Kit de Falsificação','Kit de Herbalismo','Kit de Veneno'
];
const _INSTRUMENTOS = [
  'Alaúde','Flauta','Flauta de Pan','Gaita de Foles','Lira',
  'Oboé','Tambor','Trombeta','Violino','Xilofone'
];
const _FERRAMENTAS_ARTESAO = [
  'Ferramentas de Carpinteiro','Ferramentas de Cartógrafo','Ferramentas de Coureiro',
  'Ferramentas de Entalhador','Ferramentas de Ferreiro','Ferramentas de Funileiro',
  'Ferramentas de Joalheiro','Ferramentas de Oleiro','Ferramentas de Pedreiro',
  'Ferramentas de Sapateiro','Ferramentas de Tecelão','Ferramentas de Vidreiro',
  'Suprimentos de Alquimista','Suprimentos de Calígrafo','Suprimentos de Cervejeiro',
  'Suprimentos de Pintor','Utensílios de Cozinheiro'
];

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

    // Carregar lista de magias disponíveis para uso interno
    if (ctx.ehConjurador && helpers.obterMagiasDisponiveisClasseAtual) {
      ctx._listaMagiasClasse = await helpers.obterMagiasDisponiveisClasseAtual();
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

function bindNavegacao(ctx, state, caches) {
  const steps = buildVisibleSteps(ctx, state);

  document.getElementById('btn-step-anterior')?.addEventListener('click', () => {
    salvarStateDoDOM(ctx, state, steps[state.stepAtual]);
    state.stepAtual = stepAnterior(steps, state);
    renderModal(ctx, state, caches);
  });

  document.getElementById('btn-step-proximo')?.addEventListener('click', () => {
    salvarStateDoDOM(ctx, state, steps[state.stepAtual]);
    state.stepAtual = proximoStep(steps, state);
    renderModal(ctx, state, caches);
  });

  document.getElementById('btn-confirmar-levelup')?.addEventListener('click', async () => {
    salvarStateDoDOM(ctx, state, steps[state.stepAtual]);
    await confirmarLevelUp(ctx, state);
  });

  // Clique nos steps da barra de progresso
  document.querySelectorAll('.levelup-step[data-step-idx]').forEach(el => {
    el.addEventListener('click', () => {
      salvarStateDoDOM(ctx, state, steps[state.stepAtual]);
      state.stepAtual = parseInt(el.dataset.stepIdx);
      renderModal(ctx, state, caches);
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
      state.subclasse = document.getElementById('levelup-subclasse')?.value || '';
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
        state.talento = document.getElementById('levelup-talento-select')?.value || '';
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
        // Escolhas especiais de magia
        const selMagia = document.getElementById('levelup-magia-escola-select');
        if (selMagia?.value) state.escolhasTalento = [selMagia.value];
        // Magias rituais
        const rituais = [...document.querySelectorAll('.levelup-ritual-check:checked')];
        if (rituais.length > 0) state.escolhasTalento = rituais.map(cb => cb.value);
      }
      break;
    }
    case 'escolhas_classe': {
      state.bardoExpertise = [...document.querySelectorAll('[data-bardo-expertise]:checked')].map(el => el.dataset.bardoExpertise);
      state.guardiaoExpertise = [...document.querySelectorAll('[data-guardiao-expertise]:checked')].map(el => el.dataset.guardiaoExpertise);
      state.estiloLuta = document.querySelector('input[name="estilo_luta"]:checked')?.value || '';
      state.exploradorExpertise = document.querySelector('input[name="explorador_expertise"]:checked')?.value || '';
      state.exploradorIdiomas = [...document.querySelectorAll('[data-explorador-idioma]:checked')].map(el => el.dataset.exploradorIdioma);
      state.academicoExpertise = [...document.querySelectorAll('[data-academico-expertise]:checked')].map(el => el.dataset.academicoExpertise);
      break;
    }
    case 'selecao_magias': {
      state.trocarDe = document.getElementById('levelup-trocar-de')?.value || '';
      state.trocarPara = document.getElementById('levelup-trocar-para')?.value || '';
      state.trocarParaCirculo = parseInt(document.getElementById('levelup-trocar-para-circ')?.value) || 0;
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
  document.querySelectorAll('.levelup-subclasse-card').forEach(card => {
    card.addEventListener('click', () => {
      const nome = card.dataset.subclasse;
      const idx = parseInt(card.dataset.idx);
      document.getElementById('levelup-subclasse').value = nome;
      state.subclasse = nome;

      document.querySelectorAll('.levelup-subclasse-card').forEach(c => c.classList.remove('selecionada'));
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

  // Select de talento
  const selTalento = document.getElementById('levelup-talento-select');
  selTalento?.addEventListener('change', () => {
    const nome = selTalento.value;
    state.talento = nome;
    mostrarDetalhesTalento(nome, ctx, caches);
  });

  // Se já tem talento selecionado, mostrar detalhes
  if (state.talento) {
    mostrarDetalhesTalento(state.talento, ctx, caches);
  }
}

function mostrarDetalhesTalento(nome, ctx, caches) {
  const detalheEl = document.getElementById('levelup-talento-detalhe');
  const escolhasEl = document.getElementById('levelup-talento-escolhas');
  if (!nome || !detalheEl) return;

  // Buscar dados do talento no cache
  let talentoData = null;
  if (caches.talentosCache?.por_categoria) {
    for (const lista of Object.values(caches.talentosCache.por_categoria)) {
      const found = lista.find(t => t.nome === nome);
      if (found) { talentoData = found; break; }
    }
  }

  if (!talentoData) {
    detalheEl.style.display = 'none';
    if (escolhasEl) escolhasEl.innerHTML = '';
    return;
  }

  // Descrição do talento
  detalheEl.innerHTML = `
    <div style="font-weight:700;margin-bottom:4px">${talentoData.nome}</div>
    <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:6px">${talentoData.prerequisito || ''}</div>
    ${(talentoData.beneficios || []).map(b =>
      `<div style="margin-bottom:4px"><strong>${b.nome}:</strong> ${mdParaHtml(b.descricao)}</div>`
    ).join('')}
  `;
  detalheEl.style.display = 'block';

  // Escolhas específicas do talento
  if (escolhasEl) {
    escolhasEl.innerHTML = renderEscolhasTalento(nome, talentoData, ctx);
    bindEscolhasTalento(nome, talentoData, ctx);
  }
}

function _extrairAtributosASI(talentoData) {
  if (!talentoData?.beneficios) return [];
  const benASI = talentoData.beneficios.find(b => b.nome === 'Aumento no Valor de Atributo');
  if (!benASI?.descricao) return [];
  const mapa = {
    'Força': 'forca', 'Destreza': 'destreza', 'Constituição': 'constituicao',
    'Inteligência': 'inteligencia', 'Sabedoria': 'sabedoria', 'Carisma': 'carisma'
  };
  const encontrados = [];
  for (const [nome, chave] of Object.entries(mapa)) {
    if (benASI.descricao.includes(nome)) encontrados.push({ nome, chave });
  }
  return encontrados;
}

function renderEscolhasTalento(nome, talentoData, ctx) {
  const { char } = ctx;
  let html = '';

  // ASI embutido no talento
  const atributosASI = _extrairAtributosASI(talentoData);
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
        html += `<option value="${a.chave}" ${v >= 20 ? 'disabled' : ''}>${a.nome} (atual: ${v})${v >= 20 ? ' - máximo' : ''}</option>`;
      });
      html += `</select>`;
    }
  }

  if (nome === 'Habilidoso') {
    html += `<div style="font-weight:600;font-size:0.85rem;margin-top:8px">Proficiências (3)</div>`;
    for (let i = 0; i < 3; i++) {
      html += `<select class="escolha-talento-levelup form-input" style="width:100%;margin:4px 0"><option value="">-- Escolha ${i + 1} --</option>`;
      html += `<optgroup label="Perícias">${_PERICIAS_NOMES.map(p => `<option value="${p}">${p}</option>`).join('')}</optgroup>`;
      html += `<optgroup label="Ferramentas">${_FERRAMENTAS_TODAS.map(f => `<option value="${f}">${f}</option>`).join('')}</optgroup>`;
      html += `</select>`;
    }
  }

  if (nome === 'Artifista') {
    html += `<div style="font-weight:600;font-size:0.85rem;margin-top:8px">Ferramentas de Artesão (3)</div>`;
    for (let i = 0; i < 3; i++) {
      html += `<select class="escolha-talento-levelup form-input" style="width:100%;margin:4px 0"><option value="">-- Escolha ${i + 1} --</option>`;
      html += _FERRAMENTAS_ARTESAO.map(f => `<option value="${f}">${f}</option>`).join('');
      html += `</select>`;
    }
  }

  if (nome === 'Músico') {
    html += `<div style="font-weight:600;font-size:0.85rem;margin-top:8px">Instrumentos (3)</div>`;
    for (let i = 0; i < 3; i++) {
      html += `<select class="escolha-talento-levelup form-input" style="width:100%;margin:4px 0"><option value="">-- Escolha ${i + 1} --</option>`;
      html += _INSTRUMENTOS.map(f => `<option value="${f}">${f}</option>`).join('');
      html += `</select>`;
    }
  }

  if (nome === 'Analítico') {
    const ops = ['Investigação', 'Intuição', 'Medicina'];
    html += `<div style="font-weight:600;font-size:0.85rem;margin-top:8px">Perícia (1)</div>`;
    html += `<select class="escolha-talento-levelup form-input" data-tipo="analitico" style="width:100%;margin:4px 0"><option value="">-- Escolha --</option>`;
    html += ops.map(p => `<option value="${p}">${p}</option>`).join('');
    html += `</select>`;
  }

  if (nome === 'Mente Aguçada') {
    const ops = ['Arcanismo', 'História', 'Investigação', 'Natureza', 'Religião'];
    html += `<div style="font-weight:600;font-size:0.85rem;margin-top:8px">Perícia (1)</div>`;
    html += `<select class="escolha-talento-levelup form-input" data-tipo="mente_agucada" style="width:100%;margin:4px 0"><option value="">-- Escolha --</option>`;
    html += ops.map(p => `<option value="${p}">${p}</option>`).join('');
    html += `</select>`;
  }

  if (nome === 'Especialista em Perícia') {
    const profs = char.pericias_proficientes || [];
    const exps = new Set(char.pericias_expertise || []);
    html += `<div style="font-weight:600;font-size:0.85rem;margin-top:8px">Proficiência</div>`;
    html += `<select class="escolha-talento-levelup form-input" data-tipo="proficiencia" style="width:100%;margin:4px 0"><option value="">-- Proficiência --</option>`;
    html += _PERICIAS_NOMES.filter(p => !profs.includes(p)).map(p => `<option value="${p}">${p}</option>`).join('');
    html += `</select>`;
    html += `<div style="font-weight:600;font-size:0.85rem;margin-top:8px">Especialização</div>`;
    html += `<select class="escolha-talento-levelup form-input" data-tipo="expertise" style="width:100%;margin:4px 0"><option value="">-- Especialização --</option>`;
    html += profs.filter(p => !exps.has(p)).map(p => `<option value="${p}">${p}</option>`).join('');
    html += `</select>`;
  }

  if (nome === 'Resiliente') {
    html += `<div style="font-weight:600;font-size:0.85rem;margin-top:8px">Atributo para Salvaguarda</div>`;
    html += `<select id="levelup-talento-resiliente" class="form-input" style="width:100%;margin:4px 0"><option value="">-- Atributo --</option>`;
    const salvJa = new Set(char.salvaguardas_proficiente || []);
    ATRIBUTOS_KEYS.forEach(k => {
      const desab = salvJa.has(k) ? 'disabled' : '';
      html += `<option value="${k}" ${desab}>${ATRIBUTOS_NOMES[k]}${salvJa.has(k) ? ' (já proficiente)' : ''}</option>`;
    });
    html += `</select>`;
  }

  if (nome === 'Adepto Elemental') {
    const tipos = ['Ácido', 'Frio', 'Fogo', 'Elétrico', 'Trovão'];
    const usados = ctx.helpers.obterTiposAdeptoElementalUsados?.() || [];
    html += `<div style="font-weight:600;font-size:0.85rem;margin-top:8px">Tipo de Dano</div>`;
    html += `<select class="escolha-talento-levelup form-input" style="width:100%;margin:4px 0"><option value="">-- Tipo --</option>`;
    tipos.forEach(t => {
      const desab = usados.includes(t) ? 'disabled' : '';
      html += `<option value="${t}" ${desab}>${t}${usados.includes(t) ? ' (já escolhido)' : ''}</option>`;
    });
    html += `</select>`;
  }

  if (nome === 'Tocado Por Fadas' || nome === 'Tocado Pelas Sombras') {
    const escola = nome === 'Tocado Por Fadas' ? 'Encantamento' : 'Necromancia';
    html += `<div style="font-weight:600;font-size:0.85rem;margin-top:8px">Magia de 1º Círculo (${escola})</div>`;
    html += `<select id="levelup-magia-escola-select" class="form-input" style="width:100%;margin:4px 0"><option value="">Carregando...</option></select>`;
    // Será populado assincronamente em bindEscolhasTalento
  }

  if (nome === 'Conjurador Ritualista') {
    html += `<div style="font-weight:600;font-size:0.85rem;margin-top:8px">Magias Rituais</div>`;
    html += `<div id="levelup-rituais-container">Carregando...</div>`;
    // Será populado assincronamente em bindEscolhasTalento
  }

  if (nome === 'Iniciado em Magia') {
    const listasUsadas = ctx.helpers.obterListasIniciadoEmMagiaUsadas?.() || [];
    const listasDisponiveis = ['Bardo', 'Bruxo', 'Clérigo', 'Druida', 'Feiticeiro', 'Mago']
      .filter(l => !listasUsadas.includes(l));
    html += `
      <div style="font-weight:600;font-size:0.85rem;margin-top:8px">Lista de Magias</div>
      <select id="levelup-im-lista" class="form-input" style="width:100%;margin:4px 0">
        <option value="">-- Lista --</option>
        ${listasDisponiveis.map(l => `<option value="${l}">${l}</option>`).join('')}
      </select>
      <div id="levelup-im-atributo-container" style="display:none"></div>
      <div id="levelup-im-truques-container" style="display:none"></div>
      <div id="levelup-im-magia-container" style="display:none"></div>
    `;
  }

  return html;
}

function bindEscolhasTalento(nome, talentoData, ctx) {
  // Tocado Por Fadas / Sombras: carregar magias assincronamente
  if (nome === 'Tocado Por Fadas' || nome === 'Tocado Pelas Sombras') {
    const escola = nome === 'Tocado Por Fadas' ? 'Encantamento' : 'Necromancia';
    getMagiasPorCirculo(1).then(dados => {
      const magias = (dados?.magias || []).filter(m => m.escola === escola);
      const sel = document.getElementById('levelup-magia-escola-select');
      if (sel) {
        sel.innerHTML = `<option value="">-- Selecione --</option>` +
          magias.map(m => `<option value="${m.nome}">${m.nome}</option>`).join('');
      }
    });
  }

  // Conjurador Ritualista: carregar magias rituais
  if (nome === 'Conjurador Ritualista') {
    const bonusProf = Math.floor((ctx.char.nivel || 1) / 4) + 2;
    Promise.all([1, 2, 3, 4, 5, 6, 7, 8, 9].map(c => getMagiasPorCirculo(c))).then(todosCirculos => {
      const rituais = [];
      todosCirculos.forEach(dados => {
        (dados?.magias || []).forEach(m => {
          if ((m.ritual || m.especial === 'R') && m.circulo <= 1) rituais.push(m);
        });
      });
      const container = document.getElementById('levelup-rituais-container');
      if (container) {
        container.innerHTML = `
          <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:4px">Selecione ${bonusProf} magias rituais de 1º círculo:</div>
          ${rituais.map(m => `
            <label style="display:flex;align-items:center;gap:6px;padding:4px 0;font-size:0.85rem">
              <input type="checkbox" class="levelup-ritual-check" value="${m.nome}"> ${m.nome}
            </label>
          `).join('')}
        `;
      }
    });
  }

  // Iniciado em Magia: cascata de seleções
  if (nome === 'Iniciado em Magia') {
    const selLista = document.getElementById('levelup-im-lista');
    selLista?.addEventListener('change', async () => {
      const lista = selLista.value;
      if (!lista) return;

      // Atributo
      const attrMap = {
        'Bardo': 'Carisma', 'Bruxo': 'Carisma', 'Feiticeiro': 'Carisma',
        'Clérigo': 'Sabedoria', 'Druida': 'Sabedoria', 'Mago': 'Inteligência'
      };
      const atributoConjuracao = attrMap[lista] || 'Carisma';
      const chaveAttr = ATRIBUTO_NOME_PARA_KEY[atributoConjuracao] || 'carisma';
      const attrContainer = document.getElementById('levelup-im-atributo-container');
      if (attrContainer) {
        attrContainer.innerHTML = `
          <div style="font-size:0.85rem;margin:4px 0">Atributo: <strong>${atributoConjuracao}</strong></div>
          <input type="hidden" id="levelup-im-atributo" value="${chaveAttr}">
        `;
        attrContainer.style.display = 'block';
      }

      // Carregar truques da lista
      const magiasLista = await getMagiasClasse(lista.toLowerCase());
      const truquesLista = (magiasLista || []).filter(m => m.circulo === 0);
      const magiasCirc1 = (magiasLista || []).filter(m => m.circulo === 1);

      const truquesContainer = document.getElementById('levelup-im-truques-container');
      if (truquesContainer) {
        truquesContainer.innerHTML = `
          <div style="font-weight:600;font-size:0.85rem;margin-top:8px">Truques (2)</div>
          <div style="max-height:20vh;overflow-y:auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:4px;margin:4px 0">
            ${truquesLista.map(m => `
              <label style="display:flex;align-items:center;gap:4px;font-size:0.82rem;padding:2px 4px;border:1px solid var(--border-light);border-radius:4px">
                <input type="checkbox" class="levelup-im-truque" value="${m.nome}"> ${m.nome}
              </label>
            `).join('')}
          </div>
          <div style="font-size:0.8rem;color:var(--text-muted)">Selecionados: <span id="levelup-im-truques-count">0</span>/2</div>
        `;
        truquesContainer.style.display = 'block';

        // Limitar a 2 truques
        truquesContainer.querySelectorAll('.levelup-im-truque').forEach(cb => {
          cb.addEventListener('change', () => {
            const selecionados = truquesContainer.querySelectorAll('.levelup-im-truque:checked');
            if (selecionados.length > 2) { cb.checked = false; return; }
            const cnt = document.getElementById('levelup-im-truques-count');
            if (cnt) cnt.textContent = selecionados.length;
          });
        });
      }

      const magiaContainer = document.getElementById('levelup-im-magia-container');
      if (magiaContainer) {
        magiaContainer.innerHTML = `
          <div style="font-weight:600;font-size:0.85rem;margin-top:8px">Magia de 1º Círculo (1)</div>
          <select id="levelup-im-magia" class="form-input" style="width:100%;margin:4px 0">
            <option value="">-- Selecione --</option>
            ${magiasCirc1.map(m => `<option value="${m.nome}">${m.nome}</option>`).join('')}
          </select>
        `;
        magiaContainer.style.display = 'block';
      }
    });
  }
}

// --- Escolhas de Classe ---
function bindEventosEscolhasClasse(ctx, state) {
  // Limitar checkboxes de expertise a 2
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

  limitarCheckboxes('[data-bardo-expertise]', 2, 'levelup-bardo-expertise-count');
  limitarCheckboxes('[data-guardiao-expertise]', 2, 'levelup-guardiao-expertise-count');
  limitarCheckboxes('[data-explorador-idioma]', 2, 'levelup-explorador-idiomas-count');
  limitarCheckboxes('[data-academico-expertise]', 2, 'levelup-academico-count');
}

// --- Magias ---
function bindEventosMagias(ctx, state) {
  const conj = ctx.conjuracao;
  if (!conj) return;
  const listaMagiasClasse = ctx._listaMagiasClasse || [];
  const maxCirculoNovo = conj.maxCirculoNovo || 0;

  // Sets compartilhados (usam o state como referência)
  const truquesSel = new Set(state.truquesSelecionados);
  const magiasSel = new Set(state.magiasSelecionadas);
  const grimorioSel = new Set(state.grimorioSelecionados);

  const jaTemTruques = new Set((ctx.char.magias_conhecidas || []).map(m => m.nome));
  const jaTemMagias = new Set((ctx.char.magias_preparadas || []).map(m => m.nome));
  const jaTemGrimorio = new Set((ctx.char.grimorio || []).map(m => m.nome));

  function sincronizarSetsParaState() {
    state.truquesSelecionados = [...truquesSel];
    state.magiasSelecionadas = [...magiasSel];
    state.grimorioSelecionados = [...grimorioSel];
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

  function abrirGridSelecao(titulo, maxSel, selSet, filtroCirc, jaTemSet, resumoId, badgesId) {
    let disponiveis = listaMagiasClasse.filter(m => {
      if (filtroCirc === 0) return m.circulo === 0;
      if (filtroCirc === 'magia') return m.circulo > 0 && m.circulo <= maxCirculoNovo;
      return true;
    }).filter(m => !jaTemSet.has(m.nome));

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
        <div class="magias-grid" id="grid-magias"></div>
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

      gridEl.innerHTML = filtradas.map(m => {
        const sel = selSet.has(m.nome);
        const bloqueado = cheio && !sel;
        return `
          <div class="magia-card ${sel ? 'selecionada' : ''} ${bloqueado ? 'magia-card-bloqueada' : ''}"
               data-grid-nome="${m.nome}" data-grid-circ="${m.circulo}"
               style="${bloqueado ? 'opacity:0.35;cursor:default' : ''}">
            <span class="magia-card-check" data-grid-check="${m.nome}"></span>
            <div class="magia-card-nome" data-grid-info="${m.nome}" data-grid-info-circ="${m.circulo}">${m.nome}</div>
            <div class="magia-card-meta">
              <span>${m.circulo === 0 ? 'Truque' : m.circulo + 'º Círculo'}</span>
              <span>${m.escola || ''}</span>
              ${m.especial === 'C' ? '<span>Conc.</span>' : ''}
            </div>
          </div>`;
      }).join('');

      const cntEl = document.getElementById('grid-sel-count');
      if (cntEl) {
        cntEl.textContent = selSet.size;
        cntEl.style.color = selSet.size === maxSel ? 'var(--success)' : 'inherit';
      }

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
      abrirGridSelecao('Grimório: +2 Magias', 2, grimorioSel, 'magia', jaTemGrimorio, 'lvlup-grimorio-resumo', 'lvlup-grimorio-badges');
    });
  }

  // Troca de magia
  const selTrocarDe = document.getElementById('levelup-trocar-de');
  selTrocarDe?.addEventListener('change', () => {
    const container = document.getElementById('levelup-trocar-para-container');
    if (container) container.style.display = selTrocarDe.value ? 'block' : 'none';
    montarBuscaTroca(ctx, selTrocarDe.value, listaMagiasClasse, maxCirculoNovo);
  });
}

function montarBuscaTroca(ctx, nomeTroca, listaMagiasClasse, maxCirculoNovo) {
  if (!nomeTroca) return;

  const buscaInput = document.getElementById('busca-troca-levelup');
  const resultadoEl = document.getElementById('resultado-troca-levelup');
  if (!buscaInput || !resultadoEl) return;

  const disponiveis = listaMagiasClasse.filter(m =>
    m.circulo > 0 && m.circulo <= maxCirculoNovo &&
    m.nome !== nomeTroca &&
    !(ctx.char.magias_preparadas || []).some(p => p.nome === m.nome)
  ).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  function renderResultados() {
    const termo = semAcento(buscaInput.value || '');
    const filtradas = termo.length >= 2
      ? disponiveis.filter(m => semAcento(m.nome).includes(termo))
      : disponiveis.slice(0, 20);

    resultadoEl.innerHTML = filtradas.map(m => `
      <div class="troca-magia-item" data-troca-nome="${m.nome}" data-troca-circ="${m.circulo}"
           style="padding:6px 8px;cursor:pointer;border-bottom:1px solid var(--border-light);font-size:0.85rem;display:flex;justify-content:space-between;align-items:center">
        <span>${m.nome}</span>
        <span style="font-size:0.75rem;color:var(--text-muted)">${m.circulo}º</span>
      </div>
    `).join('');

    resultadoEl.querySelectorAll('.troca-magia-item').forEach(el => {
      el.addEventListener('click', () => {
        const nome = el.dataset.trocaNome;
        const circ = el.dataset.trocaCirc;
        document.getElementById('levelup-trocar-para').value = nome;
        document.getElementById('levelup-trocar-para-circ').value = circ;
        const nomeEl = document.getElementById('levelup-trocar-para-nome');
        if (nomeEl) nomeEl.textContent = nome;
      });
    });
  }

  buscaInput.addEventListener('input', renderResultados);
  renderResultados();
}

// ============================================================
// CONFIRMAÇÃO / SUBMISSÃO
// ============================================================

async function confirmarLevelUp(ctx, state) {
  const erro = validateAll(ctx, state);
  if (erro) { toast(erro, 'error'); return; }

  // Validar e coletar dados de Iniciado em Magia
  if (ctx.ganhaASI && state.asiModo === 'talento' && state.talento === 'Iniciado em Magia') {
    const lista = document.getElementById('levelup-im-lista')?.value;
    const atributo = document.getElementById('levelup-im-atributo')?.value;
    const truques = [...document.querySelectorAll('.levelup-im-truque:checked')].map(cb => cb.value);
    const magia = document.getElementById('levelup-im-magia')?.value;
    if (!lista || !atributo || truques.length < 2 || !magia) {
      toast('Preencha todas as escolhas de Iniciado em Magia', 'error');
      return;
    }
    state.iniciadoEmMagia = { lista, atributo, truques, magia };
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
  }

  const opcoes = collectOpcoes(ctx, state);
  const { char } = ctx;

  // Processar magias antes de subirDeNivel (igual ao original)
  let truquesAdicionados = [];
  let magiasAdicionadas = [];
  let grimorioAdicionado = [];
  let magiaTrocadaDe = null;
  let magiaTrocadaPara = null;
  const listaMagiasClasse = ctx._listaMagiasClasse || [];

  if (ctx.ehConjurador) {
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

    // Grimório
    state.grimorioSelecionados.forEach(nome => {
      const m = listaMagiasClasse.find(x => x.nome === nome);
      if (m) {
        if (!char.grimorio) char.grimorio = [];
        if (!char.grimorio.find(x => x.nome === nome)) {
          char.grimorio.push({ nome, circulo: m.circulo });
          grimorioAdicionado.push(nome);
        }
      }
    });

    // Troca
    if (state.trocarDe && state.trocarPara) {
      const idx = char.magias_preparadas?.findIndex(m => m.nome === state.trocarDe);
      if (idx !== undefined && idx !== -1) {
        magiaTrocadaDe = state.trocarDe;
        magiaTrocadaPara = state.trocarPara;
        char.magias_preparadas.splice(idx, 1);
        char.magias_preparadas.push({ nome: state.trocarPara, circulo: state.trocarParaCirculo });
      }
    }
  }

  // Executar level up
  const resultado = await subirDeNivel(char, opcoes);

  if (resultado.sucesso) {
    _salvarFn?.();
    window.fecharModalTodos?.();

    // Resumo
    const resumo = montarResumoFinal(resultado, char, truquesAdicionados, magiasAdicionadas, grimorioAdicionado, magiaTrocadaDe, magiaTrocadaPara);
    abrirModal('Subida de Nível Concluída!', resumo, '<button class="btn btn-primary" onclick="fecharModal()">OK</button>');
    _renderFichaFn?.();
  } else {
    toast(resultado.erro || 'Erro ao subir de nível', 'error');
  }
}

function montarResumoFinal(resultado, char, truquesAdicionados, magiasAdicionadas, grimorioAdicionado, magiaTrocadaDe, magiaTrocadaPara) {
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
  if (resultado.estilo_luta_aplicado) itens.push(`Estilo de Luta: ${resultado.estilo_luta_aplicado}`);
  if (resultado.explorador_habil_aplicado?.expertise) itens.push(`Explorador Hábil: ${resultado.explorador_habil_aplicado.expertise}`);
  if ((resultado.explorador_habil_aplicado?.idiomas || []).length > 0) itens.push(`Idiomas: ${resultado.explorador_habil_aplicado.idiomas.join(', ')}`);
  if ((resultado.academico_aplicado || []).length > 0) itens.push(`Acadêmico: ${resultado.academico_aplicado.join(', ')}`);
  
  if (truquesAdicionados.length > 0) itens.push(`Truques: +${truquesAdicionados.join(', ')}`);
  if (magiasAdicionadas.length > 0) itens.push(`Magias: +${magiasAdicionadas.join(', ')}`);
  if (grimorioAdicionado.length > 0) itens.push(`Grimório: +${grimorioAdicionado.join(', ')}`);
  if (magiaTrocadaDe) itens.push(`Troca: ${magiaTrocadaDe} ${iconArrow} ${magiaTrocadaPara}`);

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
