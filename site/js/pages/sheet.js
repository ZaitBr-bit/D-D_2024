// ============================================================
// Ficha de Personagem - Visualização e Edição
// ============================================================
import { CLASSES_INFO, PERICIAS, ATRIBUTOS_NOMES, ATRIBUTOS_KEYS, ATRIBUTO_NOME_PARA_KEY } from '../dados-classes.js';
import { getPersonagem, salvarPersonagem, removerPersonagem } from '../store.js';
import { getClasse, getMagiasClasse, getMagiasPorCirculo, getIndiceMagias, getArmas, getArmaduras, getEquipamentoAventura, getTalentos, getEspecies } from '../db.js';
import { calcMod, fmtMod, bonusProficiencia, calcCA, calcCDMagia, calcAtaqueMagia, calcPercepcaoPassiva, calcBonusPericia, calcPVTotal, getEspacosMagia, getTruquesConhecidos, getMagiaPreparadas, toast, abrirModal, mdParaHtml, semAcento, gerarId, detectarRecarga, ehHabilidadeAtiva } from '../utils.js';
import { podeSubirDeNivel, subirDeNivel, XP_POR_NIVEL, adicionarXP, obterTodasMagiasDominio } from '../levelup.js';

// Estilos visuais (cor e emoji) para cada atributo
const ATRIBUTO_ESTILO = {
  forca:        { emoji: '💪', cor: '#b71c1c' },
  destreza:     { emoji: '🏹', cor: '#1b5e20' },
  constituicao: { emoji: '🛡️', cor: '#e65100' },
  inteligencia: { emoji: '📖', cor: '#0d47a1' },
  sabedoria:    { emoji: '🔮', cor: '#4a148c' },
  carisma:      { emoji: '✨', cor: '#c62828' }
};

let char = null;
let containerRef = null;
let classeData = null;
let indiceMagiasCache = null;
let talentosCache = null;
let especiesCache = null;
let magiasDominioCache = null;

export async function renderSheet(container, charId) {
  containerRef = container;
  char = getPersonagem(charId);
  if (!char) {
    container.innerHTML = '<div class="empty-state"><h2>Personagem nao encontrado</h2><button class="btn btn-primary" onclick="navegar(\'home\')">Voltar</button></div>';
    return;
  }

  // Atualizar header
  document.getElementById('header-titulo').textContent = char.nome || 'Ficha';
  document.getElementById('header-acoes').innerHTML = `
    <button class="btn header-btn no-print" id="btn-print" title="Imprimir">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
    </button>
  `;

  // Carregar dados complementares
  classeData = await getClasse(char.classe);
  const indiceData = await getIndiceMagias();
  indiceMagiasCache = indiceData?.magias || [];
  talentosCache = await getTalentos();
  especiesCache = await getEspecies();

  // Pré-carregar magias de domínio e migrar dados legados
  magiasDominioCache = await obterTodasMagiasDominio(char.classe, char.subclasse, char.nivel);
  migrarMagiasDominio();

  // Inicializar grimório do mago se necessário
  if (char.classe === 'Mago' && !char.grimorio) {
    char.grimorio = [];
    // Migrar magias já preparadas para o grimório
    (char.magias_preparadas || []).forEach(m => {
      if (m.origem !== 'dominio' && !char.grimorio.find(g => g.nome === m.nome)) {
        char.grimorio.push({ nome: m.nome, circulo: m.circulo });
      }
    });
    salvar();
  }

  renderFichaCompleta();

  document.getElementById('btn-print')?.addEventListener('click', () => window.print());
}

function salvar() {
  salvarPersonagem(char);
}

/** Migra magias de domínio legadas adicionando origem: 'dominio' */
function migrarMagiasDominio() {
  if (!magiasDominioCache?.length || !char.magias_preparadas?.length) return;
  let alterado = false;
  const nomesDominio = new Set(magiasDominioCache.map(m => m.nome));
  char.magias_preparadas.forEach(m => {
    if (nomesDominio.has(m.nome) && m.origem !== 'dominio') {
      m.origem = 'dominio';
      alterado = true;
    }
  });
  if (alterado) salvar();
}

/** Salva o estado open/closed de todos os <details> no container */
function salvarEstadoDetails() {
  const estado = {};
  containerRef?.querySelectorAll('details').forEach((det, i) => {
    const id = det.querySelector('summary')?.textContent?.trim() || `det_${i}`;
    estado[id] = det.open;
  });
  return estado;
}

/** Restaura o estado open/closed dos <details> salvos */
function restaurarEstadoDetails(estado) {
  if (!estado || Object.keys(estado).length === 0) return;
  containerRef?.querySelectorAll('details').forEach((det, i) => {
    const id = det.querySelector('summary')?.textContent?.trim() || `det_${i}`;
    if (id in estado) det.open = estado[id];
  });
}

function renderFichaCompleta() {
  const estadoDetails = salvarEstadoDetails();
  const info = CLASSES_INFO[char.classe] || {};
  const prof = bonusProficiencia(char.nivel);
  const ca = calcCA(char);
  const modDes = calcMod(char.atributos.destreza);
  const modCon = calcMod(char.atributos.constituicao);

  // Recalcular PV max se necessário
  if (char.pv_max <= 0 && info.dado_vida) {
    char.pv_max = calcPVTotal(info.dado_vida, char.nivel, modCon);
    char.pv_atual = char.pv_max;
    salvar();
  }

  const container = containerRef;
  container.innerHTML = `
    <!-- Cabeçalho do personagem -->
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:start;flex-wrap:wrap;gap:8px">
        <div>
          <h2 style="font-size:1.3rem;margin-bottom:2px" id="char-nome-display">${char.nome || 'Sem Nome'}</h2>
          <div style="font-size:0.9rem;color:var(--text-muted)">
            ${char.especie || ''} ${char.classe || ''} ${char.subclasse ? `(${char.subclasse})` : ''} &middot; Nivel ${char.nivel}
          </div>
          <div style="font-size:0.8rem;color:var(--text-muted)">Antecedente: ${char.antecedente || '–'}</div>
          <div style="font-size:0.8rem;color:var(--text-muted);margin-top:4px">
            XP: <span style="font-weight:600;color:var(--accent);cursor:pointer" id="xp-display" title="Clique para editar XP">${char.xp || 0}</span>
            ${char.nivel < 20 ? ` / ${XP_POR_NIVEL[char.nivel + 1]}` : ' (Nível Máximo)'}
          </div>
        </div>
        <div class="no-print" style="display:flex;gap:4px;flex-direction:column">
          <div style="display:flex;gap:4px">
            <button class="btn btn-sm btn-secondary" id="btn-edit-header">Editar</button>
          </div>
          ${char.nivel < 20 ? `
            <button class="btn btn-sm btn-accent" id="btn-levelup" style="font-weight:700">
              ⬆ Level Up! (Nivel ${char.nivel + 1})
            </button>
          ` : ''}
        </div>
      </div>
    </div>

    <!-- Stats combate -->
    <div class="card">
      <div class="stats-row">
        <div class="stat-box">
          <div class="stat-label">CA</div>
          <div class="stat-value">${ca}</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Iniciativa</div>
          <div class="stat-value">${fmtMod(modDes)}</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Deslocamento</div>
          <div class="stat-value">9m</div>
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

      <!-- HP -->
      <div style="display:flex;justify-content:center;align-items:center;gap:16px;flex-wrap:wrap">
        <div style="text-align:center">
          <div style="font-size:0.7rem;font-weight:700;text-transform:uppercase;color:var(--text-muted)">Pontos de Vida</div>
          <div style="font-size:1.3rem;font-weight:800;color:${char.pv_atual <= (char.pv_max_override || char.pv_max) * 0.25 ? 'var(--danger)' : char.pv_atual <= (char.pv_max_override || char.pv_max) * 0.5 ? 'var(--warning)' : 'var(--success)'}">
            ${char.pv_atual} / ${char.pv_max_override || char.pv_max}
          </div>
          ${char.pv_max_override && char.pv_max_override !== char.pv_max ? `<div style="font-size:0.7rem;color:var(--info)">(Base: ${char.pv_max} | Bônus: +${char.pv_max_override - char.pv_max})</div>` : ''}
          <div class="no-print" style="display:flex;gap:6px;justify-content:center;margin-top:6px">
            <button class="btn btn-sm btn-danger" id="hp-minus">Dano</button>
            <button class="btn btn-sm btn-success" id="hp-plus">Cura</button>
            <button class="btn btn-sm btn-secondary" id="hp-temp">PV Temp</button>
            <button class="btn btn-sm btn-secondary" id="hp-max-override" title="Sobrescrever PV Máximo">⚙ PV Max</button>
          </div>
        </div>
        <div style="text-align:center">
          <div style="font-size:0.7rem;font-weight:700;text-transform:uppercase;color:var(--text-muted)">PV Temporário</div>
          <div style="font-size:1rem;font-weight:700;color:var(--info)">${char.pv_temporario || 0}</div>
        </div>
        <div style="text-align:center">
          <div style="font-size:0.7rem;font-weight:700;text-transform:uppercase;color:var(--text-muted)">Dados de Vida</div>
          <div style="font-size:1rem;font-weight:700">${char.nivel - (char.dados_vida_usados || 0)} / ${char.nivel} 🎲d${info.dado_vida || '?'}🎲</div>
          <button class="btn btn-sm btn-secondary no-print" id="btn-usar-dv" style="margin-top:4px">Usar DV</button>
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
              <div class="atributo-nome" style="color:${attrStyle.cor || 'var(--text-muted)'}">${attrStyle.emoji || ''} ${nome}</div>
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
      <div class="salvaguardas-grid">
        ${ATRIBUTOS_KEYS.map(key => {
          const nome = ATRIBUTOS_NOMES[key];
          const mod = calcMod(char.atributos[key]);
          const proficiente = (char.salvaguardas_proficientes || []).includes(nome);
          const bonus = mod + (proficiente ? prof : 0);
          return `
            <div class="salva-item ${proficiente ? 'proficiente' : ''}">
              <div class="pericia-prof ${proficiente ? 'ativo' : ''}"></div>
              <span class="pericia-bonus">${fmtMod(bonus)}</span>
              <span class="pericia-nome">${nome}</span>
            </div>`;
        }).join('')}
      </div>
    </div>

    <!-- Perícias agrupadas por atributo -->
    <div class="card">
      <div class="card-header"><h2>Pericias</h2>
        <span style="font-size:0.75rem;color:var(--text-muted)">Percep. Passiva: ${calcPercepcaoPassiva(char)}</span>
      </div>
      <div class="pericias-por-atributo">
        ${(() => {
          const grupos = {};
          PERICIAS.forEach(p => {
            if (!grupos[p.atributo]) grupos[p.atributo] = [];
            grupos[p.atributo].push(p);
          });
          const ordemAtributos = ['Força', 'Destreza', 'Constituição', 'Inteligência', 'Sabedoria', 'Carisma'];
          return ordemAtributos.filter(attr => grupos[attr]).map(attr => {
            const key = ATRIBUTO_NOME_PARA_KEY[attr];
            const modVal = calcMod(char.atributos[key]);
            const estilo = ATRIBUTO_ESTILO[key] || {};
            return `
              <div class="pericias-grupo">
                <div class="pericias-grupo-header" style="border-left:3px solid ${estilo.cor || 'var(--border)'}">
                  <span style="color:${estilo.cor || 'var(--text-muted)'}">${estilo.emoji || ''} ${attr}</span>
                  <span class="pericias-grupo-mod">${fmtMod(modVal)}</span>
                </div>
                ${grupos[attr].map(p => {
                  const proficiente = (char.pericias_proficientes || []).includes(p.nome);
                  const expertise = (char.pericias_expertise || []).includes(p.nome);
                  const bonus = calcBonusPericia(char, p.nome);
                  return `
                  <div class="pericia-item">
                    <div class="pericia-prof ${proficiente ? (expertise ? 'expertise' : 'ativo') : ''}"></div>
                    <span class="pericia-bonus">${fmtMod(bonus)}</span>
                    <span class="pericia-nome">${p.nome}</span>
                  </div>`;
                }).join('')}
              </div>`;
          }).join('');
        })()}
      </div>
    </div>

    <!-- Talentos -->
    ${renderSecaoTalentos()}

    <!-- Características de Classe -->
    ${renderSecaoCaracteristicas()}

    <!-- Características de Subclasse -->
    ${renderSecaoSubclasse()}

    <!-- Traços da Espécie/Raça -->
    ${renderSecaoTracosEspecie()}

    <!-- Espaços de Magia e Magias -->
    ${info.conjurador ? renderSecaoMagias() : ''}

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

  // Restaurar estado dos details
  restaurarEstadoDetails(estadoDetails);
}

// --- HP e Dados de Vida ---

/** Gera HTML para seletor numérico com rolagem (estilo alarme iPhone) */
function numberPickerHtml(id, valor, min, max, label) {
  // Limitar itens no picker para performance (campo manual cobre valores maiores)
  const pickerMax = Math.min(max, min + 49);
  const items = [];
  for (let i = min; i <= pickerMax; i++) items.push(i);

  return `
    <div class="form-group" style="text-align:center">
      <label class="form-label">${label}</label>
      <div style="display:flex;align-items:center;justify-content:center;gap:16px;margin-top:8px">
        <div class="scroll-picker-wrapper" id="${id}-wrapper">
          <div class="scroll-picker-fade-top"></div>
          <div class="scroll-picker-highlight"></div>
          <div class="scroll-picker-fade-bottom"></div>
          <div class="scroll-picker-list" id="${id}-list">
            <div class="scroll-picker-spacer"></div>
            ${items.map(i => `<div class="scroll-picker-item" data-value="${i}">${i}</div>`).join('')}
            <div class="scroll-picker-spacer"></div>
          </div>
        </div>
        <div style="text-align:center">
          <div style="font-size:0.65rem;color:var(--text-muted);margin-bottom:4px;text-transform:uppercase">ou digite</div>
          <input type="number" class="form-input" id="${id}-manual"
            min="${min}" max="${max}" value="${valor}"
            style="width:80px;text-align:center;font-size:1.1rem;font-weight:700;padding:8px">
        </div>
      </div>
      <input type="hidden" id="${id}-val" value="${valor}" data-min="${min}" data-max="${max}">
    </div>
  `;
}

/** Configura eventos do scroll picker */
function setupNumberPicker(id) {
  const list = document.getElementById(`${id}-list`);
  const input = document.getElementById(`${id}-val`);
  const manual = document.getElementById(`${id}-manual`);
  if (!list || !input) return;

  const items = list.querySelectorAll('.scroll-picker-item');
  if (items.length === 0) return;

  const itemHeight = 40;
  const min = parseInt(input.dataset.min) || 0;
  const max = parseInt(input.dataset.max) || 999;
  const valor = parseInt(input.value) || min;

  // Posicionar no valor inicial
  const idxInicial = Math.min(Math.max(0, valor - min), items.length - 1);
  requestAnimationFrame(() => {
    list.scrollTop = idxInicial * itemHeight;
    atualizarDestaque(idxInicial);
  });

  // Atualizar ao scrollar
  let scrollRaf;
  list.addEventListener('scroll', () => {
    cancelAnimationFrame(scrollRaf);
    scrollRaf = requestAnimationFrame(() => {
      const idx = Math.round(list.scrollTop / itemHeight);
      const clampedIdx = Math.max(0, Math.min(idx, items.length - 1));
      const val = Math.min(max, Math.max(min, min + clampedIdx));
      input.value = val;
      if (manual && document.activeElement !== manual) manual.value = val;
      atualizarDestaque(clampedIdx);
    });
  });

  // Input manual (secundário)
  if (manual) {
    manual.addEventListener('change', () => {
      let val = parseInt(manual.value);
      if (isNaN(val)) return;
      val = Math.min(max, Math.max(min, val));
      manual.value = val;
      input.value = val;
      const idx = val - min;
      if (idx >= 0 && idx < items.length) {
        list.scrollTop = idx * itemHeight;
        atualizarDestaque(idx);
      }
    });
  }

  function atualizarDestaque(selIdx) {
    items.forEach((item, i) => {
      item.classList.toggle('selected', i === selIdx);
    });
  }
}

function setupEventosHP() {
  const pvMax = char.pv_max_override || char.pv_max;

  document.getElementById('hp-minus')?.addEventListener('click', () => {
    abrirModal('Dano Recebido',
      numberPickerHtml('input-dano', 1, 1, 999, 'Valor do dano'),
      '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-danger" id="btn-aplicar-dano">Aplicar Dano</button>'
    );
    setupNumberPicker('input-dano');
    document.getElementById('btn-aplicar-dano')?.addEventListener('click', () => {
      let dano = parseInt(document.getElementById('input-dano-val')?.value) || 0;
      if (dano <= 0) return;
      // Absorver pelo PV temporário primeiro
      if (char.pv_temporario > 0) {
        const absorvido = Math.min(dano, char.pv_temporario);
        char.pv_temporario -= absorvido;
        dano -= absorvido;
      }
      char.pv_atual = Math.max(0, char.pv_atual - dano);
      salvar();
      window.fecharModal();
      renderFichaCompleta();
    });
  });

  document.getElementById('hp-plus')?.addEventListener('click', () => {
    abrirModal('Cura',
      numberPickerHtml('input-cura', 1, 1, pvMax, 'Valor da cura'),
      '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-success" id="btn-aplicar-cura">Curar</button>'
    );
    setupNumberPicker('input-cura');
    document.getElementById('btn-aplicar-cura')?.addEventListener('click', () => {
      const cura = parseInt(document.getElementById('input-cura-val')?.value) || 0;
      if (cura <= 0) return;
      char.pv_atual = Math.min(pvMax, char.pv_atual + cura);
      // Reset death saves when healed from 0
      if (char.pv_atual > 0) {
        char.morte_sucessos = 0;
        char.morte_falhas = 0;
      }
      salvar();
      window.fecharModal();
      renderFichaCompleta();
    });
  });

  document.getElementById('hp-temp')?.addEventListener('click', () => {
    abrirModal('PV Temporário',
      numberPickerHtml('input-temp', char.pv_temporario || 0, 0, 999, 'Definir PV Temporário') +
      `<div style="font-size:0.8rem;color:var(--text-muted);margin-top:4px;text-align:center">PV temporário não se acumula. Use o maior valor.</div>`,
      '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-primary" id="btn-aplicar-temp">Aplicar</button>'
    );
    setupNumberPicker('input-temp');
    document.getElementById('btn-aplicar-temp')?.addEventListener('click', () => {
      char.pv_temporario = Math.max(0, parseInt(document.getElementById('input-temp-val')?.value) || 0);
      salvar();
      window.fecharModal();
      renderFichaCompleta();
    });
  });

  document.getElementById('hp-max-override')?.addEventListener('click', () => {
    abrirModal('Sobrescrever PV Máximo',
      `<div class="form-group">
        <label class="form-label">PV Máximo Base (fixo)</label>
        <div style="font-size:1rem;font-weight:700;margin-bottom:8px">${char.pv_max}</div>
      </div>
      <div class="form-group">
        <label class="form-label" for="input-pv-max-override">PV Máximo Atual (com bônus temporário)</label>
        <input type="number" class="form-input" id="input-pv-max-override" value="${char.pv_max_override || char.pv_max}" min="1" autofocus>
        <div style="font-size:0.8rem;color:var(--text-muted);margin-top:4px">
          Use para magias que aumentam PV máximo temporariamente (ex: Ajuda, Heróis do Banquete).
        </div>
      </div>`,
      `<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>
       <button class="btn btn-warning" id="btn-resetar-pv-max">Resetar</button>
       <button class="btn btn-primary" id="btn-aplicar-pv-max">Aplicar</button>`
    );
    document.getElementById('btn-resetar-pv-max')?.addEventListener('click', () => {
      delete char.pv_max_override;
      char.pv_atual = Math.min(char.pv_atual, char.pv_max);
      salvar();
      window.fecharModal();
      renderFichaCompleta();
    });
    document.getElementById('btn-aplicar-pv-max')?.addEventListener('click', () => {
      const novoMax = parseInt(document.getElementById('input-pv-max-override')?.value) || char.pv_max;
      if (novoMax !== char.pv_max) {
        char.pv_max_override = novoMax;
      } else {
        delete char.pv_max_override;
      }
      salvar();
      window.fecharModal();
      renderFichaCompleta();
    });
  });

  document.getElementById('btn-usar-dv')?.addEventListener('click', () => {
    const info = CLASSES_INFO[char.classe];
    if (!info) return;
    const dvRestantes = char.nivel - (char.dados_vida_usados || 0);
    if (dvRestantes <= 0) { toast('Sem dados de vida restantes', 'error'); return; }
    const modCon = calcMod(char.atributos.constituicao);

    abrirModal('Usar Dados de Vida',
      numberPickerHtml('input-qtd-dv', 1, 1, dvRestantes, 'Quantos dados de vida usar?') +
      `<div style="font-size:0.8rem;color:var(--text-muted);margin-top:4px;text-align:center">
          Restantes: ${dvRestantes} / ${char.nivel} (🎲d${info.dado_vida}🎲 + ${modCon} CON por dado)<br>
          <em>Apenas desconta os dados — use seus dados reais para cura.</em>
        </div>`,
      '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-primary" id="btn-aplicar-dv">Usar</button>'
    );
    setupNumberPicker('input-qtd-dv');
    document.getElementById('btn-aplicar-dv')?.addEventListener('click', () => {
      const qtd = Math.min(dvRestantes, Math.max(1, parseInt(document.getElementById('input-qtd-dv-val')?.value) || 1));
      char.dados_vida_usados = (char.dados_vida_usados || 0) + qtd;
      salvar();
      window.fecharModal();
      toast(`${qtd}x 🎲d${info.dado_vida}🎲 usado(s). Role os dados e aplique a cura manualmente.`, 'success');
      renderFichaCompleta();
    });
  });

  // Salvaguarda contra morte checkboxes
  document.querySelectorAll('[data-morte-sucesso]').forEach(cb => {
    cb.addEventListener('change', () => {
      const idx = parseInt(cb.dataset.morteSucesso);
      if (!char.morte_sucessos) char.morte_sucessos = 0;
      char.morte_sucessos = cb.checked ? idx + 1 : idx;
      salvar();
      renderFichaCompleta();
    });
  });
  document.querySelectorAll('[data-morte-falha]').forEach(cb => {
    cb.addEventListener('change', () => {
      const idx = parseInt(cb.dataset.morteFalha);
      if (!char.morte_falhas) char.morte_falhas = 0;
      char.morte_falhas = cb.checked ? idx + 1 : idx;
      salvar();
      renderFichaCompleta();
    });
  });
}

// --- Descansos ---
function restaurarHabilidades(tipoDescanso) {
  if (!char.usos_habilidades) return;
  const allFeats = [];
  // Coletar características da classe
  if (classeData?.caracteristicas) {
    classeData.caracteristicas.filter(c => c.nivel <= char.nivel).forEach(f => {
      allFeats.push({ key: `classe_${f.nome}`, descricao: f.descricao });
    });
  }
  // Coletar características da subclasse
  if (char.subclasse && classeData?.subclasses) {
    const sc = classeData.subclasses.find(s => s.nome === char.subclasse);
    if (sc?.caracteristicas) {
      sc.caracteristicas.filter(c => c.nivel <= char.nivel).forEach(f => {
        allFeats.push({ key: `subclasse_${f.nome}`, descricao: f.descricao });
      });
    }
  }
  // Coletar traços da espécie
  if (char.especie && especiesCache?.especies) {
    const esp = especiesCache.especies.find(e => e.nome === char.especie);
    if (esp?.tracos) {
      esp.tracos.forEach(t => {
        allFeats.push({ key: `especie_${t.nome}`, descricao: t.descricao });
      });
    }
  }
  allFeats.forEach(({ key, descricao }) => {
    const recarga = detectarRecarga(descricao);
    if (!recarga) return;
    if (tipoDescanso === 'longo') {
      // Long rest: reset all uses (handle both boolean and numeric tracking)
      char.usos_habilidades[key] = typeof char.usos_habilidades[key] === 'number' ? 0 : false;
    } else if (tipoDescanso === 'curto' && (recarga === 'curto' || recarga === 'curto_ou_longo')) {
      // Short rest: restore 1 use if numeric (reduce "used" count by 1), or reset if boolean
      if (typeof char.usos_habilidades[key] === 'number') {
        char.usos_habilidades[key] = Math.max(0, char.usos_habilidades[key] - 1);
      } else {
        char.usos_habilidades[key] = false;
      }
    }
  });
}

function setupEventosDescanso() {
  // FAB toggle
  document.getElementById('fab-toggle-descanso')?.addEventListener('click', () => {
    const menu = document.getElementById('fab-menu-descanso');
    if (menu) menu.style.display = menu.style.display === 'none' ? 'flex' : 'none';
  });

  document.getElementById('btn-descanso-curto')?.addEventListener('click', () => {
    const info = CLASSES_INFO[char.classe];
    const dvRestantes = char.nivel - (char.dados_vida_usados || 0);
    const pvMax = char.pv_max_override || char.pv_max;
    const modCon = calcMod(char.atributos.constituicao);
    const jaCheio = char.pv_atual >= pvMax;

    // Restaurar habilidades de descanso curto
    restaurarHabilidades('curto');
    salvar();

    // Se tem dados de vida restantes e nao esta com PV cheio, oferecer modal
    if (dvRestantes > 0 && !jaCheio && info?.dado_vida) {
      abrirModal('Descanso Curto',
        `<div class="info-box success" style="margin-bottom:12px">Habilidades de descanso curto restauradas!</div>` +
        numberPickerHtml('input-qtd-dv-curto', 0, 0, dvRestantes, 'Quantos dados de vida usar para cura?') +
        `<div style="font-size:0.8rem;color:var(--text-muted);margin-top:4px;text-align:center">
            Restantes: ${dvRestantes} / ${char.nivel} (d${info.dado_vida} + ${modCon} CON por dado)<br>
            <em>Apenas desconta os dados - use seus dados reais para cura.</em>
        </div>`,
        '<button class="btn btn-secondary" onclick="fecharModal()">Pular Cura</button><button class="btn btn-primary" id="btn-aplicar-dv-curto">Usar Dados de Vida</button>'
      );
      setupNumberPicker('input-qtd-dv-curto');
      document.getElementById('btn-aplicar-dv-curto')?.addEventListener('click', () => {
        const qtd = Math.min(dvRestantes, Math.max(0, parseInt(document.getElementById('input-qtd-dv-curto-val')?.value) || 0));
        if (qtd > 0) {
          char.dados_vida_usados = (char.dados_vida_usados || 0) + qtd;
          salvar();
          toast(`Descanso curto realizado! ${qtd}x d${info.dado_vida} usado(s). Role os dados e aplique a cura.`, 'success');
        } else {
          toast('Descanso curto realizado!', 'success');
        }
        window.fecharModal();
        renderFichaCompleta();
      });
    } else {
      toast('Descanso curto realizado!', 'success');
      renderFichaCompleta();
    }
  });

  document.getElementById('btn-descanso-longo')?.addEventListener('click', () => {
    const pvMax = char.pv_max_override || char.pv_max;
    char.pv_atual = pvMax;
    char.pv_temporario = 0;
    char.dados_vida_usados = Math.max(0, (char.dados_vida_usados || 0) - Math.max(1, Math.floor(char.nivel / 2)));
    // Reset death saves
    char.morte_sucessos = 0;
    char.morte_falhas = 0;
    // Restaurar espaços de magia
    if (char.espacos_magia) {
      Object.keys(char.espacos_magia).forEach(k => {
        char.espacos_magia[k].usados = 0;
      });
    }
    // Restaurar todas as habilidades
    restaurarHabilidades('longo');
    salvar();

    // Para classes com conjuração preparada, oferecer troca de magias
    const infoClasse = CLASSES_INFO[char.classe] || {};
    if (infoClasse.conjurador && infoClasse.tipo_conjuracao === 'preparadas') {
      abrirModal('Descanso Longo Concluído', `
        <div class="info-box success" style="margin-bottom:12px">
          PV, espaços de magia e habilidades restaurados!
        </div>
        <p style="font-size:0.9rem">Deseja trocar suas magias preparadas?</p>
        <p style="font-size:0.8rem;color:var(--text-muted)">
          Como ${char.classe}, você pode alterar sua lista de magias preparadas após um Descanso Longo.
        </p>
      `, `
        <button class="btn btn-secondary" id="btn-pular-troca">Manter Magias Atuais</button>
        <button class="btn btn-accent" id="btn-iniciar-troca">Trocar Magias</button>
      `);
      document.getElementById('btn-pular-troca')?.addEventListener('click', () => {
        window.fecharModal();
        renderFichaCompleta();
      });
      document.getElementById('btn-iniciar-troca')?.addEventListener('click', () => {
        window.fecharModal();
        mostrarTrocaMagias();
      });
    } else {
      toast('Descanso longo realizado! PV, espaços e habilidades restaurados', 'success');
      renderFichaCompleta();
    }
  });

  document.getElementById('btn-excluir-char')?.addEventListener('click', () => {
    abrirModal('Excluir Personagem',
      `<p>Excluir <strong>${char.nome}</strong> permanentemente?</p>`,
      '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-danger" id="btn-confirmar-del">Excluir</button>'
    );
    document.getElementById('btn-confirmar-del')?.addEventListener('click', () => {
      removerPersonagem(char.id);
      window.fecharModal();
      window.navegar('home');
    });
  });
}

// --- Habilidades (Ativas) ---
function setupEventosHabilidades() {
  // Toggle simples (1 uso)
  document.querySelectorAll('[data-toggle-uso]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const key = btn.dataset.toggleUso;
      if (!char.usos_habilidades) char.usos_habilidades = {};
      char.usos_habilidades[key] = !char.usos_habilidades[key];
      salvar();
      renderFichaCompleta();
    });
  });

  // Usar habilidade com múltiplos usos
  document.querySelectorAll('[data-usar-habilidade]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const key = btn.dataset.usarHabilidade;
      const usosMax = parseInt(btn.dataset.usosMax) || 1;
      if (!char.usos_habilidades) char.usos_habilidades = {};
      const atual = typeof char.usos_habilidades[key] === 'number' ? char.usos_habilidades[key] : 0;
      if (atual >= usosMax) {
        toast('Usos esgotados! Descanse para recuperar.', 'error');
        return;
      }
      char.usos_habilidades[key] = atual + 1;
      salvar();
      renderFichaCompleta();
    });
  });
}

// --- Edição do cabeçalho e detalhes ---
function setupEventosEdicao() {
  // Editar detalhes pessoais
  document.getElementById('btn-edit-detalhes')?.addEventListener('click', () => {
    const campos = [
      { key: 'aparencia', label: 'Aparencia' },
      { key: 'personalidade', label: 'Personalidade' },
      { key: 'ideais', label: 'Ideais' },
      { key: 'lacos', label: 'Lacos' },
      { key: 'defeitos', label: 'Defeitos' },
      { key: 'historia_personagem', label: 'Historia do Personagem' },
      { key: 'notas', label: 'Notas' }
    ];
    abrirModal('Editar Detalhes', `
      ${campos.map(c => `
        <div class="form-group">
          <label class="form-label" for="edit-${c.key}">${c.label}</label>
          <textarea class="form-textarea" id="edit-${c.key}" rows="2">${char[c.key] || ''}</textarea>
        </div>
      `).join('')}
    `, '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-primary" id="btn-salvar-detalhes">Salvar</button>');

    document.getElementById('btn-salvar-detalhes')?.addEventListener('click', () => {
      campos.forEach(c => {
        char[c.key] = document.getElementById(`edit-${c.key}`)?.value || '';
      });
      salvar();
      window.fecharModal();
      renderFichaCompleta();
    });
  });

  // Editar cabeçalho
  document.getElementById('btn-edit-header')?.addEventListener('click', () => {
    abrirModal('Editar Personagem', `
      <div class="form-group">
        <label class="form-label" for="edit-nome">Nome</label>
        <input type="text" class="form-input" id="edit-nome" value="${char.nome}">
      </div>
      <div class="row gap-1">
        <div class="col">
          <label class="form-label">Nivel</label>
          <div style="font-size:1rem;font-weight:700;padding:6px;background:var(--surface-variant);border-radius:4px">${char.nivel}</div>
          <div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px">Use Level Up para alterar</div>
        </div>
        <div class="col">
          <label class="form-label">Subclasse</label>
          <div style="font-size:1rem;font-weight:700;padding:6px;background:var(--surface-variant);border-radius:4px">${char.subclasse || '—'}</div>
          <div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px">Definida no Level Up</div>
        </div>
      </div>
      <div class="section-divider mt-2"><span>Atributos</span></div>
      <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:8px">
        Atributos são definidos na criação e alterados via Level Up (Aumento de Atributo). Não podem ser editados livremente.
      </div>
      <div class="atributos-grid">
        ${ATRIBUTOS_KEYS.map(key => `
          <div class="form-group" style="text-align:center">
            <label class="form-label">${ATRIBUTOS_NOMES[key]}</label>
            <div style="font-size:1.1rem;font-weight:700;padding:6px;background:var(--surface-variant);border-radius:4px">${char.atributos[key]}</div>
          </div>
        `).join('')}
      </div>
    `, '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-primary" id="btn-salvar-edit">Salvar</button>');

    document.getElementById('btn-salvar-edit')?.addEventListener('click', () => {
      char.nome = document.getElementById('edit-nome')?.value?.trim() || char.nome;

      salvar();
      window.fecharModal();
      document.getElementById('header-titulo').textContent = char.nome;
      renderFichaCompleta();
    });
  });

  // Editar XP
  document.getElementById('xp-display')?.addEventListener('click', () => {
    abrirModal('Gerenciar Pontos de Experiência', `
      <div class="form-group">
        <label class="form-label" for="edit-xp-atual">XP Atual</label>
        <input type="number" class="form-input" id="edit-xp-atual" value="${char.xp || 0}" min="0">
        <div style="font-size:0.8rem;color:var(--text-muted);margin-top:4px">
          Nivel Atual: ${char.nivel}${char.nivel < 20 ? ` | Próximo Nivel (${char.nivel + 1}): ${XP_POR_NIVEL[char.nivel + 1]} XP` : ' (Máximo)'}
        </div>
      </div>
      <div class="section-divider mt-2"><span>Adicionar XP</span></div>
      <div class="form-group">
        <label class="form-label" for="add-xp">Ganhar XP</label>
        <input type="number" class="form-input" id="add-xp" placeholder="Quantidade de XP para adicionar" min="0">
      </div>
    `, '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-primary" id="btn-salvar-xp">Salvar</button>');

    document.getElementById('btn-salvar-xp')?.addEventListener('click', () => {
      const novoXP = parseInt(document.getElementById('edit-xp-atual')?.value) || 0;
      const addXP = parseInt(document.getElementById('add-xp')?.value) || 0;
      
      char.xp = novoXP + addXP;
      
      salvar();
      window.fecharModal();
      
      // Verificar se pode subir de nível
      if (podeSubirDeNivel(char)) {
        toast(`XP atualizado! Você pode subir para o nível ${char.nivel + 1}!`, 'success');
      } else {
        toast('XP atualizado com sucesso!', 'success');
      }
      
      renderFichaCompleta();
    });
  });

  // Level Up
  document.getElementById('btn-levelup')?.addEventListener('click', async () => {
    await abrirModalLevelUp();
  });
}

// Modal de Level Up
async function abrirModalLevelUp() {
  const nivelNovo = char.nivel + 1;
  const modCon = calcMod(char.atributos.constituicao);
  const info = CLASSES_INFO[char.classe];
  const hpGanho = Math.floor(info.dado_vida / 2) + 1 + modCon;
  
  // Importar funções do levelup
  const { obterCaracteristicasNivel, obterCaracteristicasEspecieNivel, obterCaracteristicasSubclasseNivel, obterMagiasDominioNivel, concedeAumentoAtributo, exigeSubclasse } = await import('../levelup.js');
  
  const caracteristicas = await obterCaracteristicasNivel(char.classe, nivelNovo);
  const caracteristicasEspecie = await obterCaracteristicasEspecieNivel(char.especie, nivelNovo);
  const ganhaAumentoAtributo = concedeAumentoAtributo(char.classe, nivelNovo);
  const precisaSubclasse = exigeSubclasse(char.classe, nivelNovo) && !char.subclasse;
  
  // Obter características da subclasse para este nível (se já tem subclasse)
  const caracteristicasSubclasse = char.subclasse 
    ? await obterCaracteristicasSubclasseNivel(char.classe, char.subclasse, nivelNovo)
    : [];
  const magiasDominioNivel = char.subclasse
    ? await obterMagiasDominioNivel(char.classe, char.subclasse, nivelNovo)
    : [];
  
  // Carregar lista de subclasses da classe se necessário
  let subclassesDisponiveis = [];
  if (precisaSubclasse && classeData && classeData.subclasses) {
    subclassesDisponiveis = classeData.subclasses
      .filter(sc => !sc.nome.toLowerCase().startsWith('subclasses de'));
  }
  
  let conteudoModal = `
    <div style="text-align:center;margin-bottom:16px">
      <h3 style="color:var(--accent);margin:0">Nivel ${char.nivel} → Nivel ${nivelNovo}</h3>
      <div style="font-size:0.9rem;color:var(--text-muted);margin-top:4px">
        ${char.especie} ${char.classe}
      </div>
    </div>
    
    <div class="card" style="background:var(--surface-variant);margin-bottom:12px">
      <div style="font-weight:700;margin-bottom:8px;color:var(--accent)">Ganhos Automáticos</div>
      <ul style="margin:0;padding-left:20px;font-size:0.9rem">
        <li><strong>+${hpGanho} Pontos de Vida</strong> (d${info.dado_vida} médio + CON)</li>
        ${caracteristicas.length > 0 ? caracteristicas.map(c => `<li>${c}</li>`).join('') : '<li>Nenhuma característica nova neste nível</li>'}
        ${caracteristicasEspecie.length > 0 ? caracteristicasEspecie.map(c => `<li><strong>[Espécie]</strong> ${c.nome}</li>`).join('') : ''}
      </ul>
    </div>
  `;
  
  // Mostrar características da subclasse para este nível (se já tem subclasse)
  if (caracteristicasSubclasse.length > 0) {
    conteudoModal += `
      <div class="card" style="background:var(--surface-variant);margin-bottom:12px">
        <div style="font-weight:700;margin-bottom:8px;color:var(--accent)">Características de Subclasse — ${char.subclasse}</div>
        ${caracteristicasSubclasse.map(f => `
          <div style="margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid var(--border-light)">
            <div style="font-weight:600;font-size:0.9rem">${f.nome}</div>
            <div class="md-content" style="font-size:0.85rem;margin-top:2px">${mdParaHtml(f.descricao)}</div>
          </div>
        `).join('')}
      </div>
    `;
  }
  
  // Mostrar magias de domínio que serão adicionadas automaticamente
  if (magiasDominioNivel.length > 0) {
    conteudoModal += `
      <div class="card" style="background:var(--surface-variant);margin-bottom:12px">
        <div style="font-weight:700;margin-bottom:8px;color:var(--accent)">🔮 Magias de Domínio — Adicionadas Automaticamente</div>
        <ul style="margin:0;padding-left:20px;font-size:0.9rem">
          ${magiasDominioNivel.map(m => `<li><strong>${m.nome}</strong> (${m.circulo}º círculo)</li>`).join('')}
        </ul>
        <div style="font-size:0.8rem;color:var(--text-muted);margin-top:8px">
          Essas magias são sempre preparadas e não contam no limite de magias preparadas.
        </div>
      </div>
    `;
  }
  
  // Se precisa escolher subclasse
  if (precisaSubclasse) {
    conteudoModal += `
      <div class="form-group">
        <label class="form-label" style="color:var(--warning);font-weight:700">⚠ Escolha de Subclasse Obrigatória</label>
        <input type="hidden" id="levelup-subclasse" value="">
        <div id="levelup-subclasses-lista" style="display:flex;flex-direction:column;gap:8px;margin-top:8px">
          ${subclassesDisponiveis.map((sc, idx) => {
            const featsNivel3 = (sc.caracteristicas || []).filter(c => c.nivel === 3);
            return `
              <div class="levelup-subclasse-card" data-subclasse="${sc.nome}" data-idx="${idx}"
                   style="border:2px solid var(--border-light);border-radius:8px;padding:12px;cursor:pointer;transition:border-color 0.2s,background 0.2s">
                <div style="font-weight:700;font-size:1rem;margin-bottom:4px">${sc.nome}</div>
                <div style="font-size:0.82rem;color:var(--text-muted)">
                  ${featsNivel3.map(f => {
                    const descPlain = f.descricao.replace(/\|[^|]*\|/g, '').replace(/\*\*/g, '').trim();
                    const preview = descPlain.length > 120 ? descPlain.substring(0, 120) + '…' : descPlain;
                    return `<div style="margin-top:4px"><strong>${f.nome}:</strong> ${preview}</div>`;
                  }).join('')}
                </div>
              </div>
            `;
          }).join('')}
        </div>
        <div id="levelup-subclasse-detalhe" style="margin-top:12px;display:none;background:var(--surface-variant);border-radius:8px;padding:12px;font-size:0.85rem">
        </div>
        <div style="font-size:0.8rem;color:var(--text-muted);margin-top:8px">
          Clique em uma subclasse para selecioná-la e ver todos os detalhes.
        </div>
      </div>
    `;
  }
  
  // Se ganha aumento de atributo
  if (ganhaAumentoAtributo) {
    conteudoModal += `
      <div class="section-divider mt-2"><span>Aumento de Atributo</span></div>
      <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:8px">
        Você pode aumentar um atributo em +2, ou dois atributos em +1 cada (máximo 20).
      </div>
      <div class="atributos-grid">
        ${ATRIBUTOS_KEYS.map(key => `
          <div class="form-group" style="text-align:center">
            <label class="form-label" for="levelup-attr-${key}">${ATRIBUTOS_NOMES[key]}</label>
            <div style="font-size:0.8rem;margin-bottom:2px">${char.atributos[key]}</div>
            <select class="form-input" style="text-align:center" id="levelup-attr-${key}">
              <option value="0">+0</option>
              <option value="1">+1</option>
              <option value="2">+2</option>
            </select>
          </div>
        `).join('')}
      </div>
      <div style="font-size:0.8rem;color:var(--text-muted);margin-top:8px;text-align:center">
        Total de pontos: <span id="levelup-pontos-total" style="font-weight:700">0</span> / 2
      </div>
    `;
  }
  
  // --- Seção de seleção de magias no level up ---
  if (info.conjurador) {
    const tipoConj = info.tipo_conjuracao || 'preparadas';
    const tabela = classeData?.tabela_caracteristicas;
    const truquesAtual = tabela ? getTruquesConhecidos(tabela, char.nivel) : 0;
    const truquesNovo = tabela ? getTruquesConhecidos(tabela, nivelNovo) : 0;
    const truquesGanhos = truquesNovo - truquesAtual;

    const magiasAtual = tabela ? getMagiaPreparadas(tabela, char.nivel) : 0;
    const magiasNovo = tabela ? getMagiaPreparadas(tabela, nivelNovo) : 0;

    conteudoModal += `<div class="section-divider mt-2"><span>Magias</span></div>`;

    // Truques novos (para todas as classes conjuradoras)
    if (truquesGanhos > 0) {
      conteudoModal += `
        <div class="card" style="background:var(--surface-variant);margin-bottom:12px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
            <div style="font-weight:700;color:var(--accent)">Novos Truques (+${truquesGanhos})</div>
            <button class="btn btn-sm btn-accent" id="btn-lvlup-truques">Selecionar Truques</button>
          </div>
          <div id="lvlup-truques-resumo" style="font-size:0.85rem;color:var(--text-muted)">
            Nenhum truque selecionado. Selecione ${truquesGanhos}.
          </div>
          <div id="lvlup-truques-badges" style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px"></div>
        </div>
      `;
    }

    // Magias para classes de "conhecidas" (Bardo/Feiticeiro/Bruxo): ganham magias novas e podem trocar 1
    if (tipoConj === 'conhecidas') {
      const magiasGanhas = magiasNovo - magiasAtual;
      if (magiasGanhas > 0) {
        conteudoModal += `
          <div class="card" style="background:var(--surface-variant);margin-bottom:12px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
              <div style="font-weight:700;color:var(--accent)">Novas Magias Conhecidas (+${magiasGanhas})</div>
              <button class="btn btn-sm btn-accent" id="btn-lvlup-magias">Selecionar Magias</button>
            </div>
            <div id="lvlup-magias-resumo" style="font-size:0.85rem;color:var(--text-muted)">
              Nenhuma magia selecionada. Selecione ${magiasGanhas}.
            </div>
            <div id="lvlup-magias-badges" style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px"></div>
          </div>
        `;
      }
      // Troca opcional de 1 magia conhecida
      const magiasAtuais = (char.magias_preparadas || []).filter(m => m.circulo > 0 && m.origem !== 'dominio');
      if (magiasAtuais.length > 0) {
        conteudoModal += `
          <div class="card" style="background:var(--surface-variant);margin-bottom:12px">
            <div style="font-weight:700;margin-bottom:8px;color:var(--accent)">Trocar Magia (Opcional)</div>
            <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:8px">
              Você pode trocar 1 magia conhecida por outra da lista de ${char.classe}.
            </div>
            <select class="form-input" id="levelup-trocar-de" style="margin-bottom:8px">
              <option value="">Não trocar</option>
              ${magiasAtuais.map(m => `<option value="${m.nome}">${m.nome} (${m.circulo}º)</option>`).join('')}
            </select>
            <div id="levelup-trocar-para-container" style="display:none">
              <div class="search-box"><input type="text" id="busca-troca-levelup" placeholder="Buscar substituta..." class="form-input"></div>
              <div id="resultado-troca-levelup" style="max-height:25vh;overflow-y:auto;margin-bottom:8px"></div>
              <div style="font-size:0.8rem;color:var(--text-muted)">
                Trocar por: <span id="levelup-trocar-para-nome" style="font-weight:700;color:var(--accent)">—</span>
                <input type="hidden" id="levelup-trocar-para" value="">
                <input type="hidden" id="levelup-trocar-para-circ" value="">
              </div>
            </div>
          </div>
        `;
      }
    }

    // Mago: 2 magias grátis no grimório por level up
    if (char.classe === 'Mago') {
      conteudoModal += `
        <div class="card" style="background:var(--surface-variant);margin-bottom:12px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
            <div style="font-weight:700;color:var(--accent)">Grimório: +2 Magias Grátis</div>
            <button class="btn btn-sm btn-accent" id="btn-lvlup-grimorio">Selecionar Magias</button>
          </div>
          <div id="lvlup-grimorio-resumo" style="font-size:0.85rem;color:var(--text-muted)">
            Nenhuma magia selecionada. Selecione 2.
          </div>
          <div id="lvlup-grimorio-badges" style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px"></div>
        </div>
      `;
    }

    // Preparadas (Clérigo/Druida/Paladino/Guardião, exceto Mago): texto informativo
    if (tipoConj === 'preparadas' && char.classe !== 'Mago') {
      conteudoModal += `
        <div class="card" style="background:var(--surface-variant);margin-bottom:12px">
          <div style="font-size:0.85rem;color:var(--text-muted)">
            <strong>Magias Preparadas:</strong> ${magiasAtual} → ${magiasNovo}.
            Você pode trocar suas magias preparadas durante um descanso longo.
          </div>
        </div>
      `;
    }
  }
  
  conteudoModal += `
    <div style="margin-top:16px;padding:12px;background:var(--warning);color:#000;border-radius:4px;font-size:0.85rem">
      <strong>⚠ Importante:</strong> Esta ação não pode ser desfeita. Certifique-se de ter feito as escolhas corretas.
    </div>
  `;
  
  abrirModal(`⬆ Level Up para Nivel ${nivelNovo}`, conteudoModal, 
    '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-accent" id="btn-confirmar-levelup">Confirmar Level Up</button>');
  
  // Eventos de seleção de subclasse
  if (precisaSubclasse) {
    document.querySelectorAll('.levelup-subclasse-card').forEach(card => {
      card.addEventListener('click', () => {
        const nome = card.dataset.subclasse;
        const idx = parseInt(card.dataset.idx);
        document.getElementById('levelup-subclasse').value = nome;
        // Destacar card selecionado
        document.querySelectorAll('.levelup-subclasse-card').forEach(c => {
          c.style.borderColor = 'var(--border-light)';
          c.style.background = 'transparent';
        });
        card.style.borderColor = 'var(--accent)';
        card.style.background = 'var(--surface-variant)';
        // Mostrar detalhes completos da subclasse selecionada
        const sc = subclassesDisponiveis[idx];
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
  
  // Validação de pontos de atributo com bloqueio dinâmico
  if (ganhaAumentoAtributo) {
    const selects = ATRIBUTOS_KEYS.map(key => document.getElementById(`levelup-attr-${key}`));

    function atualizarOpcoesAtributos() {
      const valores = selects.map(s => parseInt(s?.value) || 0);
      const total = valores.reduce((sum, v) => sum + v, 0);

      document.getElementById('levelup-pontos-total').textContent = total;
      document.getElementById('levelup-pontos-total').style.color = total === 2 ? 'var(--success)' : (total > 2 ? 'var(--danger)' : 'inherit');

      // Bloquear opções que excedam o limite de 2 pontos ou que ultrapassem 20
      selects.forEach((sel, i) => {
        if (!sel) return;
        const key = ATRIBUTOS_KEYS[i];
        const valorSelecionado = parseInt(sel.value) || 0;
        const totalOutros = total - valorSelecionado;
        const pontosRestantes = 2 - totalOutros;
        const attrAtual = char.atributos[key];

        sel.querySelectorAll('option').forEach(opt => {
          const optVal = parseInt(opt.value);
          // Desabilitar se excede pontos restantes ou se atributo passaria de 20
          opt.disabled = optVal > pontosRestantes || (attrAtual + optVal) > 20;
        });
      });
    }

    selects.forEach(sel => {
      sel?.addEventListener('change', atualizarOpcoesAtributos);
    });

    // Aplicar bloqueio inicial
    atualizarOpcoesAtributos();
  }
  
  // --- Eventos de seleção de magias no level up ---
  if (info.conjurador) {
    const tipoConj = info.tipo_conjuracao || 'preparadas';
    const tabela = classeData?.tabela_caracteristicas;
    const truquesAtual = tabela ? getTruquesConhecidos(tabela, char.nivel) : 0;
    const truquesNovo = tabela ? getTruquesConhecidos(tabela, nivelNovo) : 0;
    const truquesGanhos = truquesNovo - truquesAtual;
    const magiasAtual = tabela ? getMagiaPreparadas(tabela, char.nivel) : 0;
    const magiasNovo = tabela ? getMagiaPreparadas(tabela, nivelNovo) : 0;
    const magiasGanhas = magiasNovo - magiasAtual;

    // Carregar magias da classe para buscas
    const magiasClasseData = await getMagiasClasse(char.classe);
    const listaMagiasClasse = achatarMagiasClasse(magiasClasseData);

    // Espaços disponíveis no novo nível
    const espacosNovo = tabela ? getEspacosMagia(tabela, nivelNovo) : {};
    const maxCirculoNovo = Math.max(...Object.keys(espacosNovo).map(Number), 0);

    // Sets para controlar seleções no level up
    const truquesSelecionados = new Set();
    const magiasSelecionadas = new Set();
    const grimorioSelecionados = new Set();

    // Nomes já possuídos pelo personagem
    const jaTemTruques = new Set((char.magias_conhecidas || []).map(m => m.nome));
    const jaTemMagias = new Set((char.magias_preparadas || []).map(m => m.nome));
    const jaTemGrimorio = new Set((char.grimorio || []).map(m => m.nome));

    // Atualizar resumo com badges no modal principal
    function atualizarResumoLvlUp(containerId, badgesId, selecionados, max) {
      const resumoEl = document.getElementById(containerId);
      const badgesEl = document.getElementById(badgesId);
      if (resumoEl) {
        if (selecionados.size === 0) {
          resumoEl.innerHTML = `<span style="color:var(--danger)">Nenhuma selecionada. Selecione ${max}.</span>`;
        } else if (selecionados.size < max) {
          resumoEl.innerHTML = `<span style="color:var(--warning-dark,orange)">${selecionados.size}/${max} selecionadas. Faltam ${max - selecionados.size}.</span>`;
        } else {
          resumoEl.innerHTML = `<span style="color:var(--success)">${selecionados.size}/${max} selecionadas.</span>`;
        }
      }
      if (badgesEl) {
        badgesEl.innerHTML = Array.from(selecionados).map(n =>
          `<span class="badge badge-accent" style="font-size:0.75rem">${n}</span>`
        ).join('');
      }
    }

    /**
     * Abre um sub-modal com grid de magias para seleção no level up
     * @param {string} titulo - Título do modal
     * @param {Array} listaMagias - Lista flat de magias disponíveis
     * @param {number} maxSelecoes - Máximo de seleções
     * @param {Set} selecionadosSet - Set de nomes já selecionados
     * @param {number|string} filtroCirculo - 0 para truques, 'magia' para magias, null para tudo
     * @param {Set} jaTemSet - Set de nomes que o personagem já possui
     * @param {string} resumoId - ID do elemento de resumo no modal pai
     * @param {string} badgesId - ID do elemento de badges no modal pai
     */
    function abrirGridSelecaoMagias(titulo, listaMagias, maxSelecoes, selecionadosSet, filtroCirculo, jaTemSet, resumoId, badgesId) {
      // Filtrar magias por círculo
      let magiasDisponiveis = listaMagias.filter(m => {
        if (filtroCirculo === 0) return m.circulo === 0;
        if (filtroCirculo === 'magia') return m.circulo > 0 && m.circulo <= maxCirculoNovo;
        return true;
      });

      // Remover as que já possui
      const disponiveis = magiasDisponiveis.filter(m => !jaTemSet.has(m.nome));

      // Ordenar: selecionados primeiro, depois por nome
      disponiveis.sort((a, b) => {
        const aS = selecionadosSet.has(a.nome) ? 0 : 1;
        const bS = selecionadosSet.has(b.nome) ? 0 : 1;
        return aS - bS || a.nome.localeCompare(b.nome);
      });

      const conteudo = `
        <div style="margin-bottom:8px;display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:0.85rem;color:var(--text-muted)">
            Selecionadas: <strong id="grid-sel-count">${selecionadosSet.size}</strong>/${maxSelecoes}
          </span>
          <div class="search-box" style="flex:1;margin-left:12px"><input type="text" id="grid-busca" placeholder="Buscar..." class="form-input" style="padding:6px 10px;font-size:0.85rem"></div>
        </div>
        <div id="grid-magias-container" style="max-height:55vh;overflow-y:auto">
          <div class="magias-grid" id="grid-magias"></div>
        </div>
      `;

      abrirModal(titulo, conteudo,
        '<button class="btn btn-secondary" onclick="fecharModal()">Confirmar Seleção</button>');

      function renderGrid() {
        const termo = semAcento(document.getElementById('grid-busca')?.value || '');
        let filtradas = disponiveis;
        if (termo.length >= 2) filtradas = disponiveis.filter(m => semAcento(m.nome).includes(termo));

        const cheio = selecionadosSet.size >= maxSelecoes;
        const gridEl = document.getElementById('grid-magias');
        if (!gridEl) return;

        gridEl.innerHTML = filtradas.map(m => {
          const sel = selecionadosSet.has(m.nome);
          const bloqueado = cheio && !sel;
          return `
            <div class="magia-card ${sel ? 'selecionada' : ''} ${bloqueado ? 'magia-card-bloqueada' : ''}"
                 data-grid-nome="${m.nome}" data-grid-circ="${m.circulo}"
                 style="${bloqueado ? 'opacity:0.35;cursor:default' : ''}">
              <span class="magia-card-check"></span>
              <div class="magia-card-nome">${m.nome}</div>
              <div class="magia-card-meta">
                <span>${m.circulo === 0 ? 'Truque' : m.circulo + 'º Círculo'}</span>
                <span>${m.escola || ''}</span>
                ${m.especial === 'C' ? '<span title="Concentração">C</span>' : ''}
              </div>
              <span class="magia-card-info" data-grid-info="${m.nome}" data-grid-info-circ="${m.circulo}" title="Ver detalhes">&#9432;</span>
            </div>`;
        }).join('');

        // Atualizar contador
        const cntEl = document.getElementById('grid-sel-count');
        if (cntEl) {
          cntEl.textContent = selecionadosSet.size;
          cntEl.style.color = selecionadosSet.size === maxSelecoes ? 'var(--success)' : (selecionadosSet.size > maxSelecoes ? 'var(--danger)' : 'inherit');
        }

        // Eventos de toggle no grid
        gridEl.querySelectorAll('[data-grid-nome]').forEach(card => {
          card.addEventListener('click', (e) => {
            if (e.target.closest('[data-grid-info]')) return;
            const nome = card.dataset.gridNome;
            if (selecionadosSet.has(nome)) {
              selecionadosSet.delete(nome);
            } else {
              if (selecionadosSet.size >= maxSelecoes) return;
              selecionadosSet.add(nome);
            }
            renderGrid();
            atualizarResumoLvlUp(resumoId, badgesId, selecionadosSet, maxSelecoes);
          });
        });

        // Info detalhes
        gridEl.querySelectorAll('[data-grid-info]').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const nome = btn.dataset.gridInfo;
            const circ = parseInt(btn.dataset.gridInfoCirc);
            const dados = await getMagiasPorCirculo(circ);
            const magia = dados?.magias?.find(m => m.nome === nome);
            if (!magia) return;
            abrirModal(magia.nome, `
              <div class="magia-meta" style="margin-bottom:8px;display:flex;flex-wrap:wrap;gap:8px;font-size:0.85rem">
                <span class="badge badge-primary">${circ === 0 ? 'Truque' : circ + 'º Círculo'}</span>
                <span class="badge badge-secondary">${magia.escola}</span>
                <span>${magia.tempo_conjuracao}</span> <span>${magia.alcance}</span>
                <span>${magia.componentes}</span> <span>${magia.duracao}</span>
              </div>
              <div class="md-content">${mdParaHtml(magia.descricao)}</div>
              ${magia.circulo_superior ? `<div class="info-box info mt-1"><strong>Em círculos superiores:</strong> ${magia.circulo_superior}</div>` : ''}
            `, '<button class="btn btn-primary" onclick="fecharModal()">Fechar</button>');
          });
        });
      }

      document.getElementById('grid-busca')?.addEventListener('input', renderGrid);
      renderGrid();
    }

    // Botão para abrir seleção de truques
    if (truquesGanhos > 0) {
      document.getElementById('btn-lvlup-truques')?.addEventListener('click', () => {
        abrirGridSelecaoMagias(
          `Selecionar Truques (+${truquesGanhos})`,
          listaMagiasClasse, truquesGanhos, truquesSelecionados,
          0, jaTemTruques, 'lvlup-truques-resumo', 'lvlup-truques-badges'
        );
      });
    }

    // Botão para abrir seleção de magias conhecidas
    if (tipoConj === 'conhecidas' && magiasGanhas > 0) {
      document.getElementById('btn-lvlup-magias')?.addEventListener('click', () => {
        abrirGridSelecaoMagias(
          `Selecionar Magias (+${magiasGanhas})`,
          listaMagiasClasse, magiasGanhas, magiasSelecionadas,
          'magia', jaTemMagias, 'lvlup-magias-resumo', 'lvlup-magias-badges'
        );
      });
    }

    // Setup troca de magia para classes conhecidas
    if (tipoConj === 'conhecidas') {
      const trocarDeEl = document.getElementById('levelup-trocar-de');
      const trocarParaContainer = document.getElementById('levelup-trocar-para-container');
      if (trocarDeEl && trocarParaContainer) {
        trocarDeEl.addEventListener('change', () => {
          if (trocarDeEl.value) {
            trocarParaContainer.style.display = 'block';
          } else {
            trocarParaContainer.style.display = 'none';
            document.getElementById('levelup-trocar-para').value = '';
            document.getElementById('levelup-trocar-para-nome').textContent = '—';
          }
        });

        const buscaTrocaEl = document.getElementById('busca-troca-levelup');
        const resultadoTrocaEl = document.getElementById('resultado-troca-levelup');
        if (buscaTrocaEl && resultadoTrocaEl) {
          function renderTroca() {
            const termo = semAcento(buscaTrocaEl.value || '');
            let matches = listaMagiasClasse.filter(m => m.circulo > 0 && m.circulo <= maxCirculoNovo && !jaTemMagias.has(m.nome));
            if (termo.length >= 2) matches = matches.filter(m => semAcento(m.nome).includes(termo));
            matches = matches.slice(0, 20);
            resultadoTrocaEl.innerHTML = `<div class="magias-grid">${matches.map(m => `
              <div class="magia-card" data-troca-nome="${m.nome}" data-troca-circ="${m.circulo}">
                <div class="magia-card-nome">${m.nome}</div>
                <div class="magia-card-meta">
                  <span>${m.circulo}º Círculo</span><span>${m.escola || ''}</span>
                  ${m.especial === 'C' ? '<span title="Concentração">C</span>' : ''}
                </div>
                <span class="magia-card-info" data-lvlup-info="${m.nome}" data-lvlup-circ="${m.circulo}" title="Ver detalhes">&#9432;</span>
              </div>
            `).join('')}</div>`;
            resultadoTrocaEl.querySelectorAll('[data-troca-nome]').forEach(el => {
              el.addEventListener('click', (e) => {
                if (e.target.closest('[data-lvlup-info]')) return;
                document.getElementById('levelup-trocar-para').value = el.dataset.trocaNome;
                document.getElementById('levelup-trocar-para-circ').value = el.dataset.trocaCirc;
                document.getElementById('levelup-trocar-para-nome').textContent = el.dataset.trocaNome;
                resultadoTrocaEl.innerHTML = '';
                buscaTrocaEl.value = '';
              });
            });
            resultadoTrocaEl.querySelectorAll('[data-lvlup-info]').forEach(btn => {
              btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const nome = btn.dataset.lvlupInfo;
                const circ = parseInt(btn.dataset.lvlupCirc);
                const dados = await getMagiasPorCirculo(circ);
                const magia = dados?.magias?.find(m => m.nome === nome);
                if (!magia) return;
                abrirModal(magia.nome, `
                  <div class="magia-meta" style="margin-bottom:8px;display:flex;flex-wrap:wrap;gap:8px;font-size:0.85rem">
                    <span class="badge badge-primary">${circ}º Círculo</span>
                    <span class="badge badge-secondary">${magia.escola}</span>
                    <span>${magia.tempo_conjuracao}</span> <span>${magia.alcance}</span>
                    <span>${magia.componentes}</span> <span>${magia.duracao}</span>
                  </div>
                  <div class="md-content">${mdParaHtml(magia.descricao)}</div>
                  ${magia.circulo_superior ? `<div class="info-box info mt-1"><strong>Em círculos superiores:</strong> ${magia.circulo_superior}</div>` : ''}
                `, '<button class="btn btn-primary" onclick="fecharModal()">Fechar</button>');
              });
            });
          }
          buscaTrocaEl.addEventListener('input', renderTroca);
          renderTroca();
        }
      }
    }

    // Botão para abrir seleção do grimório (Mago)
    if (char.classe === 'Mago') {
      document.getElementById('btn-lvlup-grimorio')?.addEventListener('click', () => {
        abrirGridSelecaoMagias(
          'Grimório: +2 Magias',
          listaMagiasClasse.filter(m => m.circulo > 0 && m.circulo <= maxCirculoNovo),
          2, grimorioSelecionados,
          null, jaTemGrimorio, 'lvlup-grimorio-resumo', 'lvlup-grimorio-badges'
        );
      });
    }

    // Armazenar referências para o confirm handler usar
    window._levelupMagias = { truquesSelecionados, magiasSelecionadas, grimorioSelecionados, tipoConj, truquesGanhos, magiasGanhas: tipoConj === 'conhecidas' ? magiasGanhas : 0, listaMagiasClasse };
  }
  
  // Confirmar level up
  document.getElementById('btn-confirmar-levelup')?.addEventListener('click', async () => {
    const opcoes = { ignorar_xp: true };
    
    // Validar subclasse se necessário
    if (precisaSubclasse) {
      const subclasse = document.getElementById('levelup-subclasse')?.value?.trim();
      if (!subclasse) {
        toast('Você deve escolher uma subclasse para continuar', 'error');
        return;
      }
      opcoes.subclasse = subclasse;
    }
    
    // Validar aumento de atributo se necessário
    if (ganhaAumentoAtributo) {
      const aumentos = {};
      let total = 0;
      ATRIBUTOS_KEYS.forEach(key => {
        const valor = parseInt(document.getElementById(`levelup-attr-${key}`)?.value) || 0;
        if (valor > 0) {
          aumentos[key] = valor;
          total += valor;
        }
      });
      
      if (total !== 2) {
        toast('Você deve distribuir exatamente 2 pontos de atributo', 'error');
        return;
      }
      
      opcoes.aumentos_atributo = aumentos;
    }
    
    // Validar e processar seleção de magias no level up
    const lm = window._levelupMagias;
    let truquesAdicionados = [];
    let magiasAdicionadas = [];
    let grimorioAdicionado = [];
    let magiaTrocadaDe = null;
    let magiaTrocadaPara = null;

    if (lm) {
      // Validar truques
      if (lm.truquesGanhos > 0 && lm.truquesSelecionados.size !== lm.truquesGanhos) {
        toast(`Selecione exatamente ${lm.truquesGanhos} truque(s)`, 'error');
        return;
      }
      // Validar magias conhecidas
      if (lm.magiasGanhas > 0 && lm.magiasSelecionadas.size !== lm.magiasGanhas) {
        toast(`Selecione exatamente ${lm.magiasGanhas} magia(s) conhecida(s)`, 'error');
        return;
      }
      // Validar grimório do Mago
      if (char.classe === 'Mago' && lm.grimorioSelecionados.size !== 2) {
        toast('Selecione exatamente 2 magias para o Grimório', 'error');
        return;
      }
      // Validar troca opcional (se escolheu trocar de, deve ter escolhido trocar para)
      const trocarDe = document.getElementById('levelup-trocar-de')?.value;
      const trocarPara = document.getElementById('levelup-trocar-para')?.value;
      if (trocarDe && !trocarPara) {
        toast('Escolha a magia substituta ou selecione "Não trocar"', 'error');
        return;
      }

      // Adicionar truques
      lm.truquesSelecionados.forEach(nome => {
        const m = lm.listaMagiasClasse.find(x => x.nome === nome);
        if (m && !char.magias_conhecidas.find(x => x.nome === nome)) {
          char.magias_conhecidas.push({ nome, circulo: 0 });
          truquesAdicionados.push(nome);
        }
      });

      // Adicionar magias conhecidas (Bardo/Feiticeiro/Bruxo)
      lm.magiasSelecionadas.forEach(nome => {
        const m = lm.listaMagiasClasse.find(x => x.nome === nome);
        if (m && !char.magias_preparadas.find(x => x.nome === nome)) {
          char.magias_preparadas.push({ nome, circulo: m.circulo });
          magiasAdicionadas.push(nome);
        }
      });

      // Adicionar ao grimório (Mago)
      lm.grimorioSelecionados.forEach(nome => {
        const m = lm.listaMagiasClasse.find(x => x.nome === nome);
        if (m) {
          if (!char.grimorio) char.grimorio = [];
          if (!char.grimorio.find(x => x.nome === nome)) {
            char.grimorio.push({ nome, circulo: m.circulo });
            grimorioAdicionado.push(nome);
          }
        }
      });

      // Trocar magia (classes conhecidas)
      if (trocarDe && trocarPara) {
        const trocaCirc = parseInt(document.getElementById('levelup-trocar-para-circ')?.value) || 1;
        const idx = char.magias_preparadas.findIndex(m => m.nome === trocarDe);
        if (idx !== -1) {
          magiaTrocadaDe = trocarDe;
          magiaTrocadaPara = trocarPara;
          char.magias_preparadas.splice(idx, 1);
          char.magias_preparadas.push({ nome: trocarPara, circulo: trocaCirc });
        }
      }

      delete window._levelupMagias;
    }
    
    // Executar level up
    const resultado = await subirDeNivel(char, opcoes);
    
    if (resultado.sucesso) {
      salvar();
      window.fecharModalTodos();
      
      // Mostrar resumo
      const resumo = `
        <div style="text-align:center">
          <h3 style="color:var(--success);margin:0">✓ Level Up Concluído!</h3>
          <div style="font-size:1.1rem;margin:12px 0">Nivel ${resultado.nivel_anterior} → <strong>Nivel ${resultado.nivel_novo}</strong></div>
          <ul style="text-align:left;margin:12px 0">
            <li>+${resultado.hp_ganho} HP (Total: ${char.pv_max})</li>
            ${resultado.subclasse_escolhida ? `<li>Subclasse: ${resultado.subclasse_escolhida}</li>` : ''}
            ${resultado.aumentos_aplicados ? `<li>Atributos aumentados</li>` : ''}
            ${(resultado.caracteristicas_subclasse || []).length > 0 ? resultado.caracteristicas_subclasse.map(f => `<li><strong>[${char.subclasse}]</strong> ${f.nome}</li>`).join('') : ''}
            ${(resultado.magias_dominio_adicionadas || []).length > 0 ? `<li>Magias de domínio adicionadas: ${resultado.magias_dominio_adicionadas.map(m => m.nome).join(', ')}</li>` : ''}
            ${truquesAdicionados.length > 0 ? `<li>Truques: +${truquesAdicionados.join(', ')}</li>` : ''}
            ${magiasAdicionadas.length > 0 ? `<li>Magias: +${magiasAdicionadas.join(', ')}</li>` : ''}
            ${grimorioAdicionado.length > 0 ? `<li>Grimório: +${grimorioAdicionado.join(', ')}</li>` : ''}
            ${magiaTrocadaDe ? `<li>Troca: ${magiaTrocadaDe} → ${magiaTrocadaPara}</li>` : ''}
          </ul>
        </div>
      `;
      
      abrirModal('Level Up Concluído!', resumo, '<button class="btn btn-primary" onclick="fecharModal()">OK</button>');
      
      renderFichaCompleta();
    } else {
      toast(resultado.erro || 'Erro ao fazer level up', 'error');
    }
  });
}

// --- Talentos ---
function renderSecaoTalentos() {
  if (!char.talentos?.length) return '';
  
  // Buscar descrições dos talentos no cache
  const todosOsTalentos = [];
  if (talentosCache?.por_categoria) {
    Object.values(talentosCache.por_categoria).forEach(lista => {
      lista.forEach(t => todosOsTalentos.push(t));
    });
  }
  
  return `
    <div class="card">
      <div class="card-header"><h2>Talentos</h2></div>
      ${char.talentos.map(t => {
        const nome = typeof t === 'string' ? t : t.nome;
        const talentoData = todosOsTalentos.find(td => td.nome === nome);
        const descricao = talentoData?.descricao || '';
        const beneficios = talentoData?.beneficios || [];
        
        return `
          <details style="margin-bottom:6px">
            <summary style="font-weight:600;cursor:pointer;font-size:0.9rem;padding:6px 0;border-bottom:1px solid var(--border-light)">
              ${nome}
              ${talentoData?.categoria ? `<span class="badge badge-secondary" style="font-size:0.65rem;margin-left:4px">${talentoData.categoria}</span>` : ''}
            </summary>
            <div style="padding:6px 0 6px 16px;font-size:0.85rem">
              ${descricao ? `<div class="md-content">${mdParaHtml(descricao)}</div>` : ''}
              ${beneficios.length > 0 ? `
                <div style="margin-top:6px">
                  ${beneficios.map(b => `
                    <div style="margin-bottom:4px">
                      <strong>${b.nome}:</strong> ${mdParaHtml(b.descricao)}
                    </div>
                  `).join('')}
                </div>
              ` : ''}
            </div>
          </details>
        `;
      }).join('')}
    </div>
  `;
}

// --- Características de Classe ---

/**
 * Detecta usos máximos de uma habilidade pela descrição.
 * Ex: "duas vezes" => 2, "três vezes" => 3
 */
function detectarUsosMaximos(descricao) {
  if (!descricao) return null;
  const d = descricao.toLowerCase();
  const numerosTexto = { 'uma': 1, 'duas': 2, 'dois': 2, 'três': 3, 'tres': 3, 'quatro': 4, 'cinco': 5, 'seis': 6 };
  for (const [texto, num] of Object.entries(numerosTexto)) {
    if (d.includes(`${texto} vezes`) || d.includes(`${texto} vez`)) return num;
  }
  const match = d.match(/(\d+)\s*vezes/);
  if (match) return parseInt(match[1]);
  return null;
}

/**
 * Detecta sub-habilidades (ex: **Centelha Divina.**, **Expulsar Mortos-Vivos.**)
 */
function detectarSubHabilidades(descricao) {
  if (!descricao) return [];
  const matches = descricao.matchAll(/\*\*([^*]+)\.\*\*/g);
  const subs = [];
  for (const match of matches) {
    const nome = match[1].trim();
    // Filtrar nomes genéricos ou de tabela
    if (nome.length > 2 && nome.length < 60 && !nome.includes('|') && !nome.includes('Nível')) {
      subs.push(nome);
    }
  }
  return subs;
}

function renderFeatureItem(f, source) {
  const recarga = detectarRecarga(f.descricao);
  // Features that are purely descriptive should always be passive
  const nomeNorm = semAcento(f.nome);
  const ativa = nomeNorm.includes('conjuracao') ? false : ehHabilidadeAtiva(f.descricao);
  const key = `${source}_${f.nome}`;
  if (!char.usos_habilidades) char.usos_habilidades = {};

  // Detectar usos máximos e sub-habilidades
  const usosMax = detectarUsosMaximos(f.descricao);
  const subHabilidades = detectarSubHabilidades(f.descricao);
  const temMultiplosUsos = usosMax && usosMax > 1 && recarga;

  // Para habilidades com múltiplos usos, usar contador
  let usosAtual = 0;
  if (temMultiplosUsos) {
    if (typeof char.usos_habilidades[key] === 'number') {
      usosAtual = char.usos_habilidades[key];
    } else if (char.usos_habilidades[key] === true) {
      usosAtual = usosMax; // Migrar de boolean para número
      char.usos_habilidades[key] = usosMax;
    }
  }
  const usado = temMultiplosUsos ? usosAtual >= usosMax : (char.usos_habilidades[key] || false);

  const recargaBadge = recarga
    ? `<span class="badge" style="font-size:0.65rem;margin-left:4px;background:${recarga === 'longo' ? 'var(--info)' : recarga === 'curto' ? 'var(--success)' : 'var(--warning)'};color:#fff">${recarga === 'longo' ? '🌙 Desc. Longo' : recarga === 'curto' ? '☀ Desc. Curto' : '☀🌙 Curto/Longo'}</span>`
    : '';
  const tipoBadge = ativa
    ? '<span class="badge" style="font-size:0.65rem;margin-left:4px;background:var(--accent);color:#fff">Ativa</span>'
    : '<span class="badge" style="font-size:0.65rem;margin-left:4px;background:var(--text-muted);color:#fff">Passiva</span>';

  // Renderizar controle de usos (fora do summary para acessibilidade)
  let usosHtmlSummary = '';
  let usosHtmlBody = '';
  if (temMultiplosUsos) {
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${usosMax - usosAtual}/${usosMax}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:4px;padding:4px 0 4px 16px">
        <button class="btn btn-sm" style="padding:2px 8px;font-size:0.7rem" data-usar-habilidade="${key}" data-usos-max="${usosMax}">
          ${usosAtual >= usosMax ? '✗ Esgotado' : 'Usar'}
        </button>
      </div>
    `;
  } else if (ativa && recarga) {
    usosHtmlBody = `
      <div class="no-print" style="padding:4px 0 4px 16px">
        <button class="btn btn-sm" style="padding:2px 8px;font-size:0.7rem;${usado ? 'opacity:0.5' : ''}" data-toggle-uso="${key}">
          ${usado ? '✗ Usado' : '✓ Disponível'}
        </button>
      </div>
    `;
  }

  return `
    <details style="margin-bottom:6px">
      <summary style="font-weight:600;cursor:pointer;font-size:0.9rem;display:flex;align-items:center;flex-wrap:wrap;gap:2px">
        <span class="badge badge-secondary" style="margin-right:4px">Nv.${f.nivel}</span>
        ${f.nome}
        ${tipoBadge}
        ${recargaBadge}
        ${usosHtmlSummary}
      </summary>
      ${usosHtmlBody}
      <div class="md-content" style="padding:6px 0 6px 16px;font-size:0.85rem">${mdParaHtml(f.descricao)}</div>
      ${subHabilidades.length > 0 ? `
        <div style="padding:4px 0 4px 16px;font-size:0.8rem;color:var(--text-muted)">
          <strong>Sub-habilidades:</strong> ${subHabilidades.join(', ')}
        </div>
      ` : ''}
    </details>
  `;
}

function renderSecaoCaracteristicas() {
  if (!classeData?.caracteristicas?.length) return '';
  let feats = classeData.caracteristicas.filter(c => c.nivel <= char.nivel);
  if (!feats.length) return '';

  // Filtrar features de subclasses não selecionadas (evitar duplicatas)
  if (classeData.subclasses?.length) {
    const outrasSubclasses = classeData.subclasses.filter(s => s.nome !== char.subclasse);
    const featsOutras = new Set();
    outrasSubclasses.forEach(sc => {
      (sc.caracteristicas || []).forEach(f => featsOutras.add(f.nome));
    });
    // Manter somente features que não pertencem exclusivamente a outra subclasse
    const featsSelecionada = new Set();
    if (char.subclasse) {
      const scAtual = classeData.subclasses.find(s => s.nome === char.subclasse);
      (scAtual?.caracteristicas || []).forEach(f => featsSelecionada.add(f.nome));
    }
    feats = feats.filter(f => !featsOutras.has(f.nome) || featsSelecionada.has(f.nome));
  }

  const passivas = feats.filter(f => !ehHabilidadeAtiva(f.descricao));
  const ativas = feats.filter(f => ehHabilidadeAtiva(f.descricao));

  return `
    <div class="card print-break-before">
      <div class="card-header"><h2>Características de Classe</h2></div>
      ${ativas.length > 0 ? `
        <div class="section-divider"><span>Habilidades Ativas</span></div>
        ${ativas.map(f => renderFeatureItem(f, 'classe')).join('')}
      ` : ''}
      ${passivas.length > 0 ? `
        <div class="section-divider"><span>Habilidades Passivas</span></div>
        ${passivas.map(f => renderFeatureItem(f, 'classe')).join('')}
      ` : ''}
    </div>
  `;
}

// --- Subclasse ---

function renderSecaoSubclasse() {
  if (!char.subclasse || !classeData?.subclasses?.length) return '';
  const sc = classeData.subclasses.find(s => s.nome === char.subclasse);
  if (!sc?.caracteristicas?.length) return '';
  const feats = sc.caracteristicas.filter(c => c.nivel <= char.nivel);
  if (!feats.length) return '';

  const passivas = feats.filter(f => !ehHabilidadeAtiva(f.descricao));
  const ativas = feats.filter(f => ehHabilidadeAtiva(f.descricao));

  return `
    <div class="card print-break-before">
      <div class="card-header"><h2>Subclasse — ${char.subclasse}</h2></div>
      ${ativas.length > 0 ? `
        <div class="section-divider"><span>Habilidades Ativas</span></div>
        ${ativas.map(f => renderFeatureItem(f, 'subclasse')).join('')}
      ` : ''}
      ${passivas.length > 0 ? `
        <div class="section-divider"><span>Habilidades Passivas</span></div>
        ${passivas.map(f => renderFeatureItem(f, 'subclasse')).join('')}
      ` : ''}
    </div>
  `;
}

// --- Traços da Espécie/Raça ---

function renderSecaoTracosEspecie() {
  if (!char.especie || !especiesCache?.especies) return '';
  const esp = especiesCache.especies.find(e => e.nome === char.especie);
  if (!esp?.tracos?.length) return '';

  // Filtrar traços escolhidos (se a espécie tem opções selecionáveis)
  const tracosEscolhidos = char.tracos_escolhidos || [];
  let tracosMostrar = esp.tracos;

  // Espécies com escolhas: mostrar traços fixos + apenas o traço escolhido
  const TRACOS_PAI = ['Ancestralidade Gigante', 'Linhagem Gnômica', 'Herança Dracônica', 'Linhagem Élfica', 'Legado Ínfero'];
  const TRACOS_ESCOLHA_GOLIAS = ['Arrepio do Gelo (Gigante do Gelo)', 'Queimadura de Fogo (Gigante de Fogo)', 'Resistência da Pedra (Gigante da Pedra)', 'Salto da Nuvem (Gigante das Nuvens)', 'Tombo da Colina (Gigante da Colina)', 'Trovão da Tempestade (Gigante da Tempestade)'];
  const TRACOS_ESCOLHA_GNOMO = ['Gnomo das Rochas', 'Gnomo do Bosque'];

  if (tracosEscolhidos.length > 0) {
    tracosMostrar = esp.tracos.filter(t => {
      if (TRACOS_PAI.includes(t.nome)) return false;
      if (TRACOS_ESCOLHA_GOLIAS.includes(t.nome) || TRACOS_ESCOLHA_GNOMO.includes(t.nome)) {
        return tracosEscolhidos.includes(t.nome);
      }
      return true;
    });
  }

  // Filter traits by level requirement (e.g., "A partir do nível 5")
  tracosMostrar = tracosMostrar.filter(t => {
    const match = t.descricao?.match(/a partir do n[ií]vel (\d+)/i);
    if (match) return char.nivel >= parseInt(match[1]);
    return true;
  });

  if (!tracosMostrar.length) return '';

  // Traits that inherit recharge from parent "Ancestralidade Gigante" (prof bonus, long rest)
  const TRACOS_HERDAM_ANCESTRALIDADE = ['Arrepio do Gelo (Gigante do Gelo)', 'Queimadura de Fogo (Gigante de Fogo)', 'Resistência da Pedra (Gigante da Pedra)', 'Salto da Nuvem (Gigante das Nuvens)', 'Tombo da Colina (Gigante da Colina)', 'Trovão da Tempestade (Gigante da Tempestade)'];

  // Determine active/passive considering inherited traits
  const ehAtivo = (t) => {
    if (TRACOS_HERDAM_ANCESTRALIDADE.includes(t.nome)) return true;
    return ehHabilidadeAtiva(t.descricao);
  };

  const passivos = tracosMostrar.filter(t => !ehAtivo(t));
  const ativos = tracosMostrar.filter(t => ehAtivo(t));

  return `
    <div class="card print-break-before">
      <div class="card-header"><h2>Traços de Espécie — ${char.especie}</h2></div>
      ${ativos.length > 0 ? `
        <div class="section-divider"><span>Habilidades Ativas</span></div>
        ${ativos.map(t => renderTracoEspecie(t, TRACOS_HERDAM_ANCESTRALIDADE.includes(t.nome))).join('')}
      ` : ''}
      ${passivos.length > 0 ? `
        <div class="section-divider"><span>Habilidades Passivas</span></div>
        ${passivos.map(t => renderTracoEspecie(t, false)).join('')}
      ` : ''}
    </div>
  `;
}

function renderTracoEspecie(traco, herdaAncestralidade = false) {
  let recarga = detectarRecarga(traco.descricao);
  let ativa = ehHabilidadeAtiva(traco.descricao);

  // Traits inheriting from "Ancestralidade Gigante": prof bonus uses, long rest
  if (herdaAncestralidade && !recarga) {
    recarga = 'longo';
    ativa = true;
  }

  const key = `especie_${traco.nome}`;
  if (!char.usos_habilidades) char.usos_habilidades = {};

  let usosMax = detectarUsosMaximos(traco.descricao) || (recarga ? bonusProficiencia(char.nivel) : null);
  const temMultiplosUsos = usosMax && usosMax > 1 && recarga;

  let usosAtual = 0;
  if (temMultiplosUsos) {
    if (typeof char.usos_habilidades[key] === 'number') {
      usosAtual = char.usos_habilidades[key];
    } else if (char.usos_habilidades[key] === true) {
      usosAtual = usosMax;
      char.usos_habilidades[key] = usosMax;
    }
  }
  const usado = temMultiplosUsos ? usosAtual >= usosMax : (char.usos_habilidades[key] || false);

  const recargaBadge = recarga
    ? `<span class="badge" style="font-size:0.65rem;margin-left:4px;background:${recarga === 'longo' ? 'var(--info)' : recarga === 'curto' ? 'var(--success)' : 'var(--warning)'};color:#fff">${recarga === 'longo' ? '🌙 Desc. Longo' : recarga === 'curto' ? '☀ Desc. Curto' : '☀🌙 Curto/Longo'}</span>`
    : '';
  const tipoBadge = ativa
    ? '<span class="badge" style="font-size:0.65rem;margin-left:4px;background:var(--accent);color:#fff">Ativa</span>'
    : '<span class="badge" style="font-size:0.65rem;margin-left:4px;background:var(--text-muted);color:#fff">Passiva</span>';

  let usosHtmlSummary = '';
  let usosHtmlBody = '';
  if (temMultiplosUsos) {
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${usosMax - usosAtual}/${usosMax}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:4px;padding:4px 0 4px 16px">
        <button class="btn btn-sm" style="padding:2px 8px;font-size:0.7rem" data-usar-habilidade="${key}" data-usos-max="${usosMax}">
          ${usosAtual >= usosMax ? '✗ Esgotado' : 'Usar'}
        </button>
      </div>
    `;
  } else if (ativa && recarga) {
    usosHtmlBody = `
      <div class="no-print" style="padding:4px 0 4px 16px">
        <button class="btn btn-sm" style="padding:2px 8px;font-size:0.7rem;${usado ? 'opacity:0.5' : ''}" data-toggle-uso="${key}">
          ${usado ? '✗ Usado' : '✓ Disponível'}
        </button>
      </div>
    `;
  }

  return `
    <details style="margin-bottom:6px">
      <summary style="font-weight:600;cursor:pointer;font-size:0.9rem;display:flex;align-items:center;flex-wrap:wrap;gap:2px">
        ${traco.nome}
        ${tipoBadge}
        ${recargaBadge}
        ${usosHtmlSummary}
      </summary>
      ${usosHtmlBody}
      <div class="md-content" style="padding:6px 0 6px 16px;font-size:0.85rem">${mdParaHtml(traco.descricao)}</div>
    </details>
  `;
}

// --- Magias ---

/**
 * Converte a estrutura aninhada do JSON de magias da classe
 * { lista_magias: { "Truques": [...], "1º Círculo": [...], ... } }
 * para uma lista plana [{ nome, circulo, escola, especial }, ...]
 */
function achatarMagiasClasse(magiasClasseData) {
  const lista = magiasClasseData?.lista_magias || {};
  const resultado = [];
  for (const [chave, magias] of Object.entries(lista)) {
    let circulo = 0;
    if (chave === 'Truques') {
      circulo = 0;
    } else {
      const match = chave.match(/^(\d+)/);
      if (match) circulo = parseInt(match[1]);
    }
    (magias || []).forEach(m => {
      const obj = typeof m === 'string' ? { nome: m } : { ...m };
      obj.circulo = circulo;
      resultado.push(obj);
    });
  }
  return resultado;
}

// Retorna badges HTML compactos com metadados da magia (tipo, tempo, alcance, duração)
function badgesMagiaRapidos(nomeMagia) {
  if (!indiceMagiasCache?.length) return '';
  const info = indiceMagiasCache.find(m => m.nome === nomeMagia);
  if (!info) return '';

  const badges = [];

  // Escola
  if (info.escola) {
    badges.push(`<span class="magia-tag tag-escola">${info.escola}</span>`);
  }

  // Tempo de conjuração - ícone simplificado
  if (info.tempo_conjuracao) {
    const tc = info.tempo_conjuracao.toLowerCase();
    let icone = '';
    let label = info.tempo_conjuracao;
    if (tc === 'ação' || tc === 'acao') { icone = 'A'; label = 'Ação'; }
    else if (tc.includes('ação bônus') || tc.includes('acao bonus')) { icone = 'AB'; label = 'Ação Bônus'; }
    else if (tc === 'reação' || tc === 'reacao') { icone = 'R'; label = 'Reação'; }
    else if (tc.includes('minuto')) { icone = 'M'; }
    else if (tc.includes('hora')) { icone = 'H'; }
    badges.push(`<span class="magia-tag tag-tempo" title="${label}">${icone || label}</span>`);
  }

  // Duração - concentração ou instantâneo
  if (info.duracao) {
    const dur = info.duracao.toLowerCase();
    if (dur.includes('concentra')) {
      badges.push(`<span class="magia-tag tag-conc" title="${info.duracao}">Conc.</span>`);
    } else if (dur.includes('instant')) {
      badges.push(`<span class="magia-tag tag-inst" title="${info.duracao}">Inst.</span>`);
    } else {
      badges.push(`<span class="magia-tag tag-dur" title="${info.duracao}">${info.duracao.replace('até ', '').replace('Até ', '')}</span>`);
    }
  }

  // Alcance
  if (info.alcance) {
    const alc = info.alcance.toLowerCase();
    let label = info.alcance;
    if (alc === 'pessoal') label = 'Pessoal';
    else if (alc === 'toque') label = 'Toque';
    badges.push(`<span class="magia-tag tag-alcance" title="Alcance: ${info.alcance}">${label}</span>`);
  }

  return `<div class="magia-tags">${badges.join('')}</div>`;
}

function renderSecaoMagias() {
  const info = CLASSES_INFO[char.classe];
  const tipoConj = info.tipo_conjuracao || 'preparadas';
  const truques = (char.magias_conhecidas || []).filter(m => m.circulo === 0);
  const preparadas = char.magias_preparadas || [];
  const espacos = char.espacos_magia || {};

  // Calcular limites de magias preparadas/conhecidas e truques
  const maxPreparadas = classeData?.tabela_caracteristicas
    ? getMagiaPreparadas(classeData.tabela_caracteristicas, char.nivel) : 0;
  const maxTruques = classeData?.tabela_caracteristicas
    ? getTruquesConhecidos(classeData.tabela_caracteristicas, char.nivel) : 0;

  // Contar magias preparadas excluindo as de domínio (que não contam no limite)
  const preparadasNormais = preparadas.filter(m => m.origem !== 'dominio');
  const preparadasDominio = preparadas.filter(m => m.origem === 'dominio');
  const numPreparadas = preparadasNormais.length;

  // Label dinâmico baseado no tipo de conjuração
  const labelMagias = tipoConj === 'conhecidas' ? 'Magias Conhecidas' : 'Magias Preparadas';

  // Agrupar magias preparadas por círculo
  const preparadasPorCirculo = {};
  preparadas.forEach(m => {
    const circ = m.circulo || 1;
    if (!preparadasPorCirculo[circ]) preparadasPorCirculo[circ] = [];
    preparadasPorCirculo[circ].push(m);
  });

  // Verificar se é Mago (para grimório)
  const ehMago = char.classe === 'Mago';
  const grimorio = char.grimorio || [];

  return `
    <div class="card print-break-before">
      <div class="card-header">
        <h2>Magias</h2>
        <div class="no-print" style="display:flex;gap:4px">
          <button class="btn btn-sm btn-accent" id="btn-add-magia">+ Magia</button>
          <button class="btn btn-sm btn-secondary" id="btn-add-magia-custom">+ Custom</button>
        </div>
      </div>

      <!-- Contador de magias preparadas/conhecidas e truques -->
      <div class="magia-contadores" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px">
        ${maxTruques > 0 ? `
          <div class="magia-contador ${truques.length > maxTruques ? 'contador-excedido' : truques.length === maxTruques ? 'contador-cheio' : ''}">
            <span class="contador-label">Truques</span>
            <span class="contador-valor">${truques.length} / ${maxTruques}</span>
          </div>
        ` : ''}
        ${maxPreparadas > 0 ? `
          <div class="magia-contador ${numPreparadas > maxPreparadas ? 'contador-excedido' : numPreparadas === maxPreparadas ? 'contador-cheio' : ''}">
            <span class="contador-label">${labelMagias}</span>
            <span class="contador-valor">${numPreparadas} / ${maxPreparadas}</span>
          </div>
        ` : ''}
        ${preparadasDominio.length > 0 ? `
          <div class="magia-contador contador-dominio">
            <span class="contador-label">Domínio</span>
            <span class="contador-valor">${preparadasDominio.length}</span>
          </div>
        ` : ''}
        ${ehMago ? `
          <div class="magia-contador" style="background:var(--accent);color:#fff">
            <span class="contador-label">Grimório</span>
            <span class="contador-valor">${grimorio.length}</span>
          </div>
        ` : ''}
      </div>

      <!-- Espaços de magia -->
      ${Object.keys(espacos).length > 0 ? `
        <div style="margin-bottom:12px">
          ${Object.entries(espacos).map(([circ, data]) => `
            <div class="slots-grupo">
              <label>${circ}&ordm; Círculo</label>
              <div style="display:flex;gap:4px">
                ${Array.from({ length: data.total }, (_, i) => `
                  <div class="slot-bolha ${i < data.usados ? 'usado' : ''}" data-slot-circ="${circ}" data-slot-idx="${i}"></div>
                `).join('')}
              </div>
              <span style="font-size:0.75rem;color:var(--text-muted)">${data.total - data.usados}/${data.total}</span>
            </div>
          `).join('')}
        </div>
      ` : ''}

      <!-- Magias Preparadas por Círculo -->
      ${Object.keys(preparadasPorCirculo).sort((a, b) => parseInt(a) - parseInt(b)).map(circ => {
        const magias = preparadasPorCirculo[circ];
        return `
        <details style="margin-bottom:8px">
          <summary style="font-weight:700;cursor:pointer;padding:6px 0;border-bottom:1px solid var(--border-light)">
            ${circ}º Círculo (${magias.length})
          </summary>
          <div style="padding-top:4px">
            ${magias.map(m => {
              const ehDominio = m.origem === 'dominio';
              const circulos = Object.keys(espacos).filter(c => parseInt(c) >= m.circulo).sort((a, b) => parseInt(a) - parseInt(b));
              const temUpcast = circulos.length > 1;
              const todosEsgotados = circulos.every(c => (espacos[c]?.usados || 0) >= (espacos[c]?.total || 0));
              return `
              <div class="magia-item preparada ${ehDominio ? 'magia-dominio' : ''}" data-magia-nome="${m.nome}" data-magia-circ="${m.circulo}">
                <div style="display:flex;justify-content:space-between;align-items:center">
                  <div>
                    <div class="magia-nome">
                      ${ehDominio ? '<span class="badge-dominio" title="Magia de Domínio - Sempre Preparada">&#9733;</span> ' : ''}${m.nome}
                    </div>
                    ${badgesMagiaRapidos(m.nome)}
                    ${ehDominio ? '<div style="font-size:0.65rem;color:var(--secondary);font-weight:600;margin-top:1px">Sempre Preparada (Domínio)</div>' : ''}
                  </div>
                  <div class="no-print" style="display:flex;align-items:center;gap:4px">
                    ${temUpcast ? `
                      <select class="form-input" data-conj-select="${m.nome}" style="width:auto;padding:2px 4px;font-size:0.75rem">
                        ${circulos.map(c => `<option value="${c}"${c == m.circulo ? ' selected' : ''}>${c}º</option>`).join('')}
                      </select>
                    ` : ''}
                    <button class="btn btn-sm ${todosEsgotados ? 'btn-secondary' : 'btn-primary'}" data-conjurar="${m.nome}" data-conj-circ="${m.circulo}" ${todosEsgotados ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Conjurar</button>
                    ${!ehDominio ? `<button class="btn btn-sm btn-danger btn-icon btn-magia-remover no-print" data-remover-magia="${m.nome}" title="Remover magia">&times;</button>` : ''}
                  </div>
                </div>
                <div class="magia-desc"></div>
              </div>`;
            }).join('')}
          </div>
        </details>`;
      }).join('')}

      <!-- Magias customizadas -->
      ${(char.magias_customizadas || []).length > 0 ? `
        <details style="margin-bottom:8px">
          <summary style="font-weight:700;cursor:pointer;padding:6px 0;border-bottom:1px solid var(--border-light)">
            Magias Customizadas (${char.magias_customizadas.length})
          </summary>
          <div style="padding-top:4px">
            ${char.magias_customizadas.map((m, i) => `
              <div class="magia-item">
                <div style="display:flex;justify-content:space-between;align-items:center">
                  <div>
                    <div class="magia-nome">${m.nome}</div>
                    <div class="magia-meta">
                      <span>${m.circulo === 0 ? 'Truque' : m.circulo + 'º Círculo'}</span>
                      <span>${m.escola || ''}</span>
                    </div>
                  </div>
                  <button class="btn btn-sm btn-danger btn-icon no-print" data-remover-magia-custom="${i}">&times;</button>
                </div>
                <div class="magia-desc" style="display:block">${mdParaHtml(m.descricao || '')}</div>
              </div>
            `).join('')}
          </div>
        </details>
      ` : ''}

      <!-- Truques -->
      ${truques.length > 0 ? `
        <details open style="margin-bottom:8px">
          <summary style="font-weight:700;cursor:pointer;padding:6px 0;border-bottom:1px solid var(--border-light)">
            Truques (${truques.length}${maxTruques ? ' / ' + maxTruques : ''})
          </summary>
          <div style="padding-top:4px">
            ${truques.map(m => `
              <div class="magia-item" data-magia-nome="${m.nome}" data-magia-circ="0">
                <div style="display:flex;justify-content:space-between;align-items:center">
                  <div>
                    <div class="magia-nome">${m.nome}</div>
                    ${badgesMagiaRapidos(m.nome)}
                  </div>
                  <button class="btn btn-sm btn-danger btn-icon btn-magia-remover no-print" data-remover-truque="${m.nome}" title="Remover truque">&times;</button>
                </div>
                <div class="magia-desc"></div>
              </div>
            `).join('')}
          </div>
        </details>
      ` : ''}

      <!-- Grimório do Mago -->
      ${ehMago && grimorio.length > 0 ? `
        <details style="margin-bottom:8px">
          <summary style="font-weight:700;cursor:pointer;padding:6px 0;border-bottom:1px solid var(--border-light);color:var(--accent)">
            Grimório (${grimorio.length} magias)
          </summary>
          <div style="padding-top:4px;font-size:0.8rem;color:var(--text-muted);margin-bottom:6px">
            Magias copiadas no grimório. Prepare a partir daqui durante um Descanso Longo.
          </div>
          <div style="padding-top:4px">
            ${grimorio.map(m => {
              const jaPreparada = preparadas.some(p => p.nome === m.nome);
              return `
              <div class="magia-item ${jaPreparada ? 'preparada' : ''}" data-magia-nome="${m.nome}" data-magia-circ="${m.circulo}" style="opacity:${jaPreparada ? '1' : '0.7'}">
                <div style="display:flex;justify-content:space-between;align-items:center">
                  <div>
                    <div class="magia-nome">${m.nome} ${jaPreparada ? '<span class="badge badge-success" style="font-size:0.6rem">Preparada</span>' : ''}</div>
                    <div class="magia-meta"><span>${m.circulo}º Círculo</span></div>
                  </div>
                  <div class="no-print" style="display:flex;gap:4px">
                    ${!jaPreparada ? `<button class="btn btn-sm btn-accent" data-preparar-grimorio="${m.nome}" data-prep-circ="${m.circulo}">Preparar</button>` : ''}
                    <button class="btn btn-sm btn-danger btn-icon" data-remover-grimorio="${m.nome}" title="Remover do grimório">&times;</button>
                  </div>
                </div>
                <div class="magia-desc"></div>
              </div>`;
            }).join('')}
          </div>
          <div class="no-print" style="margin-top:8px">
            <button class="btn btn-sm btn-accent" id="btn-add-grimorio">+ Copiar Magia para Grimório</button>
            <div style="font-size:0.7rem;color:var(--text-muted);margin-top:4px">Custo: 50 PO por círculo da magia (2h por círculo)</div>
          </div>
        </details>
      ` : ''}
      ${ehMago && grimorio.length === 0 ? `
        <div class="no-print" style="padding:8px;text-align:center;color:var(--text-muted);font-size:0.85rem;border:1px dashed var(--border);border-radius:var(--radius);margin-bottom:8px">
          Grimório vazio. <button class="btn btn-sm btn-accent" id="btn-add-grimorio">+ Copiar magia</button>
        </div>
      ` : ''}
    </div>
  `;
}

function setupEventosEspacosMagia() {
  // Clicar nas bolhas de espaço de magia
  document.querySelectorAll('.slot-bolha').forEach(el => {
    el.addEventListener('click', () => {
      const circ = el.dataset.slotCirc;
      const idx = parseInt(el.dataset.slotIdx);
      if (!char.espacos_magia[circ]) return;
      if (idx < char.espacos_magia[circ].usados) {
        // Restaurar este slot
        char.espacos_magia[circ].usados = idx;
      } else {
        // Gastar até este slot
        char.espacos_magia[circ].usados = idx + 1;
      }
      salvar();
      renderFichaCompleta();
    });
  });

  // Conjurar magia (gasta slot)
  document.querySelectorAll('[data-conjurar]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const nome = btn.dataset.conjurar;
      const selectEl = btn.parentElement?.querySelector(`[data-conj-select="${nome}"]`);
      const circ = selectEl ? selectEl.value : btn.dataset.conjCirc;
      if (!char.espacos_magia[circ]) return;
      if (char.espacos_magia[circ].usados >= char.espacos_magia[circ].total) {
        toast(`Sem espaços de ${circ}º círculo!`, 'error');
        return;
      }
      char.espacos_magia[circ].usados++;
      salvar();
      const baseCirc = btn.dataset.conjCirc;
      const upcast = parseInt(circ) > parseInt(baseCirc);
      toast(`${nome} conjurada${upcast ? ` no ${circ}º círculo` : ''}!`, 'success');
      renderFichaCompleta();
    });
  });

  // Expandir detalhes da magia ao clicar
  document.querySelectorAll('.magia-item[data-magia-nome]').forEach(item => {
    item.addEventListener('click', async (e) => {
      if (e.target.closest('button') || e.target.closest('select')) return;
      const nome = item.dataset.magiaNome;
      const circ = parseInt(item.dataset.magiaCirc);
      const descEl = item.querySelector('.magia-desc');

      if (item.classList.contains('expandida')) {
        item.classList.remove('expandida');
        return;
      }

      // Carregar descrição se vazia
      if (!descEl.innerHTML.trim()) {
        const dados = await getMagiasPorCirculo(circ);
        const magia = dados?.magias?.find(m => m.nome === nome);
        if (magia) {
          descEl.innerHTML = `
            <div class="magia-meta" style="margin-bottom:4px">
              <span>${magia.escola}</span> | <span>${magia.tempo_conjuracao}</span> |
              <span>${magia.alcance}</span> | <span>${magia.componentes}</span> |
              <span>${magia.duracao}</span>
            </div>
            <div class="md-content">${mdParaHtml(magia.descricao)}</div>
            ${magia.circulo_superior ? `<div class="info-box info" style="margin-top:4px"><strong>Circulos superiores:</strong> ${magia.circulo_superior}</div>` : ''}
          `;
        }
      }
      item.classList.add('expandida');
    });
  });

  // Adicionar magia do livro
  document.getElementById('btn-add-magia')?.addEventListener('click', () => mostrarBuscaMagia());

  // Adicionar magia customizada
  document.getElementById('btn-add-magia-custom')?.addEventListener('click', () => mostrarFormMagiaCustom());

  // Remover magia customizada
  document.querySelectorAll('[data-remover-magia-custom]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.removerMagiaCustom);
      char.magias_customizadas.splice(idx, 1);
      salvar();
      renderFichaCompleta();
    });
  });

  // Remover/despreparar magia
  document.querySelectorAll('[data-remover-magia]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const nome = btn.dataset.removerMagia;
      const idx = char.magias_preparadas.findIndex(m => m.nome === nome);
      if (idx >= 0) {
        char.magias_preparadas.splice(idx, 1);
        salvar();
        renderFichaCompleta();
        toast(`${nome} removida das preparadas`, 'success');
      }
    });
  });

  // Remover truque
  document.querySelectorAll('[data-remover-truque]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const nome = btn.dataset.removerTruque;
      const idx = char.magias_conhecidas.findIndex(m => m.nome === nome);
      if (idx >= 0) {
        char.magias_conhecidas.splice(idx, 1);
        salvar();
        renderFichaCompleta();
        toast(`${nome} removido`, 'success');
      }
    });
  });

  // Grimório: preparar magia do grimório
  document.querySelectorAll('[data-preparar-grimorio]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const nome = btn.dataset.prepararGrimorio;
      const circ = parseInt(btn.dataset.prepCirc);
      if (!char.magias_preparadas.find(m => m.nome === nome)) {
        char.magias_preparadas.push({ nome, circulo: circ });
        salvar();
        renderFichaCompleta();
        toast(`${nome} preparada a partir do grimório`, 'success');
      }
    });
  });

  // Grimório: remover magia do grimório
  document.querySelectorAll('[data-remover-grimorio]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const nome = btn.dataset.removerGrimorio;
      // Também remover das preparadas se estava preparada
      char.magias_preparadas = (char.magias_preparadas || []).filter(m => m.nome !== nome);
      char.grimorio = (char.grimorio || []).filter(m => m.nome !== nome);
      salvar();
      renderFichaCompleta();
      toast(`${nome} removida do grimório`, 'success');
    });
  });

  // Grimório: botão de copiar magia
  document.getElementById('btn-add-grimorio')?.addEventListener('click', () => mostrarBuscaGrimorio());
}

async function mostrarBuscaMagia() {
  const info = CLASSES_INFO[char.classe] || {};
  const tipoConj = info.tipo_conjuracao || 'preparadas';
  const labelMg = tipoConj === 'conhecidas' ? 'Conhecida' : 'Preparada';
  const tabela = classeData?.tabela_caracteristicas;
  const maxPrep = tabela ? getMagiaPreparadas(tabela, char.nivel) : 99;
  const maxTruq = tabela ? getTruquesConhecidos(tabela, char.nivel) : 99;

  // Espaços de magia para determinar círculos disponíveis
  const espacosNivel = tabela ? getEspacosMagia(tabela, char.nivel) : {};
  const circulosDisponiveis = Object.keys(espacosNivel).map(Number).sort((a, b) => a - b);
  const maxCirculo = circulosDisponiveis.length > 0 ? Math.max(...circulosDisponiveis) : 9;

  // Carregar magias da classe (pré-carrega tudo)
  const magiasClasseData = await getMagiasClasse(char.classe);
  const magiasClasse = achatarMagiasClasse(magiasClasseData);

  // Magias já possuídas
  const jaPreparadas = new Set((char.magias_preparadas || []).map(m => m.nome));
  const jaConhecidas = new Set((char.magias_conhecidas || []).map(m => m.nome));
  const preparadasNormais = (char.magias_preparadas || []).filter(m => m.origem !== 'dominio');

  // Separar por círculo
  const truquesClasse = magiasClasse.filter(m => m.circulo === 0);
  const magiasCirculo = {};
  for (let c = 1; c <= maxCirculo; c++) {
    const doCirculo = magiasClasse.filter(m => m.circulo === c);
    if (doCirculo.length > 0) magiasCirculo[c] = doCirculo;
  }

  // Tabs: Preparadas, Truques, 1º, 2º, ...
  const tabs = ['preparadas', 'truques'];
  Object.keys(magiasCirculo).forEach(c => tabs.push(c));

  abrirModal('Gerenciar Magias', `
    <div style="margin-bottom:8px;display:flex;flex-wrap:wrap;gap:6px;font-size:0.78rem">
      <span class="magia-contador ${(char.magias_conhecidas || []).filter(m => m.circulo === 0).length >= maxTruq ? 'contador-cheio' : ''}">
        Truques: ${(char.magias_conhecidas || []).filter(m => m.circulo === 0).length}/${maxTruq}
      </span>
      <span class="magia-contador ${preparadasNormais.length >= maxPrep ? 'contador-cheio' : preparadasNormais.length > maxPrep ? 'contador-excedido' : ''}">
        ${labelMg}s: ${preparadasNormais.length}/${maxPrep}
      </span>
    </div>
    <div class="tabs" id="tabs-gerenciar-magias" style="margin-bottom:8px;overflow-x:auto;white-space:nowrap">
      <div class="tab active" data-tab-mg="preparadas">${labelMg}s Atuais</div>
      <div class="tab" data-tab-mg="truques">Truques</div>
      ${Object.keys(magiasCirculo).map(c => `<div class="tab" data-tab-mg="${c}">${c}º Círculo</div>`).join('')}
    </div>
    <div class="search-box"><input type="text" id="busca-magia-add" placeholder="Buscar magia..." class="form-input"></div>
    <div id="resultado-magias" style="max-height:50vh;overflow-y:auto"></div>
  `, '', () => renderFichaCompleta());

  const resultadoEl = document.getElementById('resultado-magias');
  let tabAtiva = 'preparadas';

  function renderTab() {
    const termo = semAcento(document.getElementById('busca-magia-add')?.value || '');
    let html = '';

    if (tabAtiva === 'preparadas') {
      // Mostrar magias preparadas/conhecidas atuais (para remover)
      const dominio = (char.magias_preparadas || []).filter(m => m.origem === 'dominio');
      const normais = (char.magias_preparadas || []).filter(m => m.origem !== 'dominio');
      const filtradas = termo.length >= 2 ? normais.filter(m => semAcento(m.nome).includes(termo)) : normais;
      const filtradasDom = termo.length >= 2 ? dominio.filter(m => semAcento(m.nome).includes(termo)) : dominio;

      html += `<div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:8px">${labelMg}s: ${normais.length}/${maxPrep} | Clique para remover</div>`;

      if (filtradasDom.length > 0) {
        html += `<div style="font-size:0.75rem;font-weight:700;color:var(--secondary);margin:8px 0 4px">Domínio (sempre preparadas)</div>`;
        html += `<div class="magias-grid">${filtradasDom.map(m => `
          <div class="magia-card selecionada magia-dominio" style="opacity:0.7;cursor:default">
            <span class="magia-card-check"></span>
            <div class="magia-card-nome"><span class="badge-dominio">&#9733;</span> ${m.nome}</div>
            <div class="magia-card-meta"><span>Domínio</span></div>
            <span class="magia-card-info" data-detalhe-magia="${m.nome}" data-detalhe-circ="${m.circulo}" title="Ver detalhes">&#9432;</span>
          </div>
        `).join('')}</div>`;
      }

      if (filtradas.length > 0) {
        html += `<div class="magias-grid">${filtradas.map(m => `
          <div class="magia-card selecionada" style="cursor:pointer" data-remover-prep="${m.nome}">
            <span class="magia-card-check"></span>
            <div class="magia-card-nome">${m.nome}</div>
            <div class="magia-card-meta">
              <span>${m.circulo || 0}º Círculo</span>
            </div>
            <span class="magia-card-info" data-detalhe-magia="${m.nome}" data-detalhe-circ="${m.circulo}" title="Ver detalhes">&#9432;</span>
          </div>
        `).join('')}</div>`;
      } else if (normais.length === 0) {
        html += `<div style="text-align:center;color:var(--text-muted);padding:16px">Nenhuma magia ${labelMg.toLowerCase()} ainda.</div>`;
      }
    } else if (tabAtiva === 'truques') {
      // Truques: grid da classe com toggle
      const truquesAtuais = (char.magias_conhecidas || []).filter(m => m.circulo === 0);
      const numTruq = truquesAtuais.length;
      html += `<div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:8px">Truques: ${numTruq}/${maxTruq}</div>`;

      const selecionadosSet = new Set(truquesAtuais.map(m => m.nome));
      let lista = [...truquesClasse];
      lista.sort((a, b) => {
        const aSel = selecionadosSet.has(a.nome) ? 0 : 1;
        const bSel = selecionadosSet.has(b.nome) ? 0 : 1;
        return aSel - bSel || a.nome.localeCompare(b.nome);
      });
      if (termo.length >= 2) lista = lista.filter(m => semAcento(m.nome).includes(termo));
      const cheioTruq = numTruq >= maxTruq;

      html += `<div class="magias-grid">${lista.map(m => {
        const sel = selecionadosSet.has(m.nome);
        const bloqueado = cheioTruq && !sel;
        return `
          <div class="magia-card ${sel ? 'selecionada' : ''} ${bloqueado ? 'magia-card-bloqueada' : ''}"
               data-toggle-truque="${m.nome}" style="${bloqueado ? 'opacity:0.35;' : ''}">
            <span class="magia-card-check"></span>
            <div class="magia-card-nome">${m.nome}</div>
            <div class="magia-card-meta">
              <span>${m.escola || ''}</span>
              ${m.especial === 'C' ? '<span title="Concentração">C</span>' : ''}
            </div>
            <span class="magia-card-info" data-detalhe-magia="${m.nome}" data-detalhe-circ="0" title="Ver detalhes">&#9432;</span>
          </div>`;
      }).join('')}</div>`;
    } else {
      // Magias de um círculo específico — grid
      const circ = parseInt(tabAtiva);
      const magiasDoCirc = magiasCirculo[circ] || [];
      const selecionadasSet = new Set((char.magias_preparadas || []).filter(m => m.circulo === circ).map(m => m.nome));
      const numAtual = preparadasNormais.length;
      const cheio = numAtual >= maxPrep;

      html += `<div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:8px">${labelMg}s: ${numAtual}/${maxPrep}${cheio ? ' <span style="color:var(--danger)">(Limite atingido)</span>' : ''}</div>`;

      let lista = [...magiasDoCirc];
      lista.sort((a, b) => {
        const aSel = selecionadasSet.has(a.nome) ? 0 : 1;
        const bSel = selecionadasSet.has(b.nome) ? 0 : 1;
        return aSel - bSel || a.nome.localeCompare(b.nome);
      });
      if (termo.length >= 2) lista = lista.filter(m => semAcento(m.nome).includes(termo));

      html += `<div class="magias-grid">${lista.map(m => {
        const sel = selecionadasSet.has(m.nome);
        const isDominio = (char.magias_preparadas || []).find(p => p.nome === m.nome && p.origem === 'dominio');
        const bloqueado = cheio && !sel && !isDominio;
        return `
          <div class="magia-card ${sel ? 'selecionada' : ''} ${isDominio ? 'magia-dominio' : ''} ${bloqueado ? 'magia-card-bloqueada' : ''}"
               ${isDominio ? '' : `data-toggle-magia="${m.nome}" data-toggle-circ="${circ}"`}
               style="${bloqueado ? 'opacity:0.35;' : ''}${isDominio ? 'opacity:0.7;' : ''}">
            <span class="magia-card-check"></span>
            <div class="magia-card-nome">${isDominio ? '<span class="badge-dominio">&#9733;</span> ' : ''}${m.nome}</div>
            <div class="magia-card-meta">
              <span>${m.escola || ''}</span>
              ${m.especial === 'C' ? '<span title="Concentração">C</span>' : ''}
              ${isDominio ? '<span>Domínio</span>' : ''}
            </div>
            <span class="magia-card-info" data-detalhe-magia="${m.nome}" data-detalhe-circ="${circ}" title="Ver detalhes">&#9432;</span>
          </div>`;
      }).join('')}</div>`;
    }

    resultadoEl.innerHTML = html;
    bindEventosTab();
  }

  function bindEventosTab() {
    // Remover magia preparada
    resultadoEl.querySelectorAll('[data-remover-prep]').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('[data-detalhe-magia]')) return;
        const nome = el.dataset.removerPrep;
        const idx = char.magias_preparadas.findIndex(m => m.nome === nome);
        if (idx >= 0) {
          char.magias_preparadas.splice(idx, 1);
          salvar();
          toast(`${nome} removida`, 'success');
          atualizarContadores();
          renderTab();
        }
      });
    });

    // Toggle truque
    resultadoEl.querySelectorAll('[data-toggle-truque]').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('[data-detalhe-magia]')) return;
        const nome = el.dataset.toggleTruque;
        const idx = (char.magias_conhecidas || []).findIndex(m => m.nome === nome);
        if (idx >= 0) {
          char.magias_conhecidas.splice(idx, 1);
          salvar();
          toast(`${nome} removido`, 'success');
        } else {
          const numAtual = (char.magias_conhecidas || []).filter(m => m.circulo === 0).length;
          if (numAtual >= maxTruq) { toast(`Limite de ${maxTruq} truques atingido`, 'error'); return; }
          char.magias_conhecidas.push({ nome, circulo: 0 });
          salvar();
          toast(`${nome} adicionado`, 'success');
        }
        atualizarContadores();
        renderTab();
      });
    });

    // Toggle magia de círculo
    resultadoEl.querySelectorAll('[data-toggle-magia]').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('[data-detalhe-magia]')) return;
        const nome = el.dataset.toggleMagia;
        const circ = parseInt(el.dataset.toggleCirc);
        const idx = char.magias_preparadas.findIndex(m => m.nome === nome);
        if (idx >= 0) {
          // Remover
          char.magias_preparadas.splice(idx, 1);
          salvar();
          toast(`${nome} removida`, 'success');
        } else {
          // Adicionar — verificar limite
          const numAtual = (char.magias_preparadas || []).filter(m => m.origem !== 'dominio').length;
          if (numAtual >= maxPrep) { toast(`Limite de ${maxPrep} magias atingido. Remova uma antes de adicionar.`, 'error'); return; }
          char.magias_preparadas.push({ nome, circulo: circ });
          // Mago: também adicionar ao grimório
          if (char.classe === 'Mago') {
            if (!char.grimorio) char.grimorio = [];
            if (!char.grimorio.find(m => m.nome === nome)) {
              char.grimorio.push({ nome, circulo: circ });
            }
          }
          salvar();
          toast(`${nome} adicionada`, 'success');
        }
        atualizarContadores();
        renderTab();
      });
    });

    // Botão de detalhes da magia
    resultadoEl.querySelectorAll('[data-detalhe-magia]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const nome = btn.dataset.detalheMagia;
        const circ = parseInt(btn.dataset.detalheCirc);
        const dados = await getMagiasPorCirculo(circ);
        const magia = dados?.magias?.find(m => m.nome === nome);
        if (!magia) { toast('Detalhes não encontrados', 'error'); return; }
        // Abrir sub-modal com detalhes
        const detalhesHtml = `
          <div class="magia-meta" style="margin-bottom:8px;display:flex;flex-wrap:wrap;gap:8px;font-size:0.85rem">
            <span class="badge badge-primary">${circ === 0 ? 'Truque' : circ + 'º Círculo'}</span>
            <span class="badge badge-secondary">${magia.escola}</span>
            <span>${magia.tempo_conjuracao}</span>
            <span>${magia.alcance}</span>
            <span>${magia.componentes}</span>
            <span>${magia.duracao}</span>
          </div>
          <div class="md-content">${mdParaHtml(magia.descricao)}</div>
          ${magia.circulo_superior ? `<div class="info-box info mt-1"><strong>Em círculos superiores:</strong> ${magia.circulo_superior}</div>` : ''}
          ${(magia.classes || []).length > 0 ? `<div style="font-size:0.8rem;color:var(--text-muted);margin-top:8px">Classes: ${magia.classes.join(', ')}</div>` : ''}
        `;
        abrirModal(magia.nome, detalhesHtml, '<button class="btn btn-primary" onclick="fecharModal()">Fechar</button>');
      });
    });
  }

  function atualizarContadores() {
    // Atualizar contadores no modal
    const contadorEl = resultadoEl.closest('.modal-body')?.querySelector('.magia-contadores') || resultadoEl.parentElement?.querySelector('.magia-contadores');
    // Recalcular a partir do char
    preparadasNormais.length = 0;
    (char.magias_preparadas || []).filter(m => m.origem !== 'dominio').forEach(m => preparadasNormais.push(m));
  }

  // Tabs
  document.querySelectorAll('#tabs-gerenciar-magias .tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('#tabs-gerenciar-magias .tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      tabAtiva = tab.dataset.tabMg;
      document.getElementById('busca-magia-add').value = '';
      renderTab();
    });
  });

  // Busca
  document.getElementById('busca-magia-add')?.addEventListener('input', renderTab);

  // Renderizar tab inicial (preparadas atuais)
  renderTab();
}

function mostrarFormMagiaCustom() {
  abrirModal('Magia Customizada', `
    <div class="form-group">
      <label class="form-label" for="mc-nome">Nome</label>
      <input type="text" class="form-input" id="mc-nome" placeholder="Nome da magia">
    </div>
    <div class="row gap-1">
      <div class="col">
        <label class="form-label" for="mc-circulo">Circulo</label>
        <select class="form-select" id="mc-circulo">
          <option value="0">Truque</option>
          ${[1,2,3,4,5,6,7,8,9].map(i => `<option value="${i}">${i}o Circulo</option>`).join('')}
        </select>
      </div>
      <div class="col">
        <label class="form-label" for="mc-escola">Escola</label>
        <input type="text" class="form-input" id="mc-escola" placeholder="Ex: Evocacao">
      </div>
    </div>
    <div class="row gap-1">
      <div class="col"><label class="form-label" for="mc-tempo">Tempo de Conjuracao</label><input type="text" class="form-input" id="mc-tempo" value="Acao"></div>
      <div class="col"><label class="form-label" for="mc-alcance">Alcance</label><input type="text" class="form-input" id="mc-alcance" value="9 metros"></div>
    </div>
    <div class="row gap-1">
      <div class="col"><label class="form-label" for="mc-comp">Componentes</label><input type="text" class="form-input" id="mc-comp" value="V, S"></div>
      <div class="col"><label class="form-label" for="mc-duracao">Duracao</label><input type="text" class="form-input" id="mc-duracao" value="Instantanea"></div>
    </div>
    <div class="form-group">
      <label class="form-label" for="mc-desc">Descricao</label>
      <textarea class="form-textarea" id="mc-desc" rows="4" placeholder="Descricao da magia..."></textarea>
    </div>
    <div class="form-group">
      <label class="form-label" for="mc-dano">Dano / Efeito</label>
      <input type="text" class="form-input" id="mc-dano" placeholder="Ex: 3d6 fogo">
    </div>
  `, '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-primary" id="btn-salvar-mc">Adicionar</button>');

  document.getElementById('btn-salvar-mc')?.addEventListener('click', () => {
    const nome = document.getElementById('mc-nome')?.value?.trim();
    if (!nome) { toast('Informe um nome', 'error'); return; }

    if (!char.magias_customizadas) char.magias_customizadas = [];
    char.magias_customizadas.push({
      nome,
      circulo: parseInt(document.getElementById('mc-circulo')?.value) || 0,
      escola: document.getElementById('mc-escola')?.value || '',
      tempo_conjuracao: document.getElementById('mc-tempo')?.value || '',
      alcance: document.getElementById('mc-alcance')?.value || '',
      componentes: document.getElementById('mc-comp')?.value || '',
      duracao: document.getElementById('mc-duracao')?.value || '',
      descricao: document.getElementById('mc-desc')?.value || '',
      dano: document.getElementById('mc-dano')?.value || ''
    });
    salvar();
    window.fecharModal();
    renderFichaCompleta();
    toast(`${nome} adicionada!`, 'success');
  });
}

/** Busca de magia para copiar no Grimório do Mago */
async function mostrarBuscaGrimorio() {
  const indice = await getIndiceMagias();
  const magias = (indice?.magias || []).filter(m => m.circulo > 0 && (m.classes || []).includes('Mago'));

  abrirModal('Copiar Magia para o Grimório', `
    <div class="info-box warning" style="margin-bottom:8px">
      <strong>Custo:</strong> 50 PO por círculo da magia | <strong>Tempo:</strong> 2h por círculo<br>
      <small>Disponível: ${char.po || 0} PO</small>
    </div>
    <div class="search-box"><input type="text" id="busca-grimorio" placeholder="Buscar magia de Mago..." class="form-input" autofocus></div>
    <div id="resultado-grimorio" style="max-height:50vh;overflow-y:auto"></div>
  `);

  const resultadoEl = document.getElementById('resultado-grimorio');
  document.getElementById('busca-grimorio')?.addEventListener('input', (e) => {
    const termo = semAcento(e.target.value);
    if (termo.length < 2) { resultadoEl.innerHTML = ''; return; }

    const jaNoGrimorio = new Set((char.grimorio || []).map(m => m.nome));
    let matches = magias.filter(m => semAcento(m.nome).includes(termo) && !jaNoGrimorio.has(m.nome)).slice(0, 20);

    resultadoEl.innerHTML = matches.map(m => {
      const custo = m.circulo * 50;
      const temPO = (char.po || 0) >= custo;
      return `
      <div class="magia-item" style="cursor:pointer${!temPO ? ';opacity:0.5' : ''}" data-grim-nome="${m.nome}" data-grim-circ="${m.circulo}" data-grim-custo="${custo}">
        <div class="magia-nome">${m.nome}</div>
        <div class="magia-meta">
          <span>${m.circulo}º Círculo</span>
          <span>${m.escola}</span>
          <span style="font-weight:600;color:${temPO ? 'var(--success)' : 'var(--danger)'}">Custo: ${custo} PO</span>
        </div>
      </div>`;
    }).join('');

    resultadoEl.querySelectorAll('[data-grim-nome]').forEach(el => {
      el.addEventListener('click', () => {
        const nome = el.dataset.grimNome;
        const circ = parseInt(el.dataset.grimCirc);
        const custo = parseInt(el.dataset.grimCusto);
        if ((char.po || 0) < custo) {
          toast(`PO insuficiente! Necessário: ${custo} PO`, 'error');
          return;
        }
        if (!char.grimorio) char.grimorio = [];
        char.grimorio.push({ nome, circulo: circ });
        char.po = (char.po || 0) - custo;
        salvar();
        window.fecharModal();
        renderFichaCompleta();
        toast(`${nome} copiada para o grimório! (-${custo} PO)`, 'success');
      });
    });
  });
}

/** Modal de troca de magias preparadas (usado no descanso longo para classes preparadas) */
async function mostrarTrocaMagias() {
  const info = CLASSES_INFO[char.classe] || {};
  const maxPreparadas = classeData?.tabela_caracteristicas
    ? getMagiaPreparadas(classeData.tabela_caracteristicas, char.nivel) : 0;
  const ehMago = char.classe === 'Mago';

  // Espaços de magia para determinar círculos disponíveis
  const espacosNivel = classeData?.tabela_caracteristicas
    ? getEspacosMagia(classeData.tabela_caracteristicas, char.nivel) : {};
  const maxCirculo = Math.max(...Object.keys(espacosNivel).map(Number), 0);

  // Buscar lista de magias disponíveis (classe ou grimório)
  let magiasDisponiveis = [];
  if (ehMago) {
    magiasDisponiveis = (char.grimorio || []).map(m => ({ ...m }));
  } else {
    const magiasClasseData = await getMagiasClasse(char.classe);
    magiasDisponiveis = achatarMagiasClasse(magiasClasseData).filter(m => m.circulo > 0);
  }

  // Identificar magias de domínio (não removíveis)
  const nomesDominio = new Set((char.magias_preparadas || []).filter(m => m.origem === 'dominio').map(m => m.nome));

  // Set temporário com magias selecionadas (excluindo domínio)
  const selecionadasSet = new Set((char.magias_preparadas || []).filter(m => m.origem !== 'dominio').map(m => m.nome));
  // Mapa nome->circulo para reconstruir ao confirmar
  const circuloMap = {};
  magiasDisponiveis.forEach(m => { circuloMap[m.nome] = m.circulo; });
  (char.magias_preparadas || []).forEach(m => { circuloMap[m.nome] = m.circulo; });

  // Separar por círculo
  const magiasCirculo = {};
  for (let c = 1; c <= maxCirculo; c++) {
    const doCirculo = magiasDisponiveis.filter(m => m.circulo === c);
    if (doCirculo.length > 0) magiasCirculo[c] = doCirculo;
  }

  // Tabs
  const tabs = ['selecionadas'];
  Object.keys(magiasCirculo).forEach(c => tabs.push(c));
  let tabAtiva = 'selecionadas';

  abrirModal('Trocar Magias Preparadas', `
    <div style="margin-bottom:8px">
      <span class="magia-contador ${selecionadasSet.size >= maxPreparadas ? 'contador-cheio' : selecionadasSet.size > maxPreparadas ? 'contador-excedido' : ''}">
        Preparadas: <strong id="troca-contador">${selecionadasSet.size}</strong>/${maxPreparadas}
      </span>
      ${nomesDominio.size > 0 ? `<span style="font-size:0.75rem;color:var(--secondary);margin-left:8px">+ ${nomesDominio.size} de Domínio</span>` : ''}
    </div>
    <div class="tabs" id="tabs-troca-magias" style="margin-bottom:8px;overflow-x:auto;white-space:nowrap">
      <div class="tab active" data-tab-troca="selecionadas">Selecionadas</div>
      ${Object.keys(magiasCirculo).map(c => `<div class="tab" data-tab-troca="${c}">${c}º Círculo</div>`).join('')}
    </div>
    <div class="search-box"><input type="text" id="busca-troca-magia" placeholder="Buscar magia..." class="form-input"></div>
    <div id="resultado-troca" style="max-height:50vh;overflow-y:auto"></div>
  `, '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-primary" id="btn-confirmar-troca">Confirmar</button>');

  const resultadoEl = document.getElementById('resultado-troca');

  function atualizarContadorTroca() {
    const el = document.getElementById('troca-contador');
    if (el) {
      el.textContent = selecionadasSet.size;
      el.style.color = selecionadasSet.size === maxPreparadas ? 'var(--success)' : (selecionadasSet.size > maxPreparadas ? 'var(--danger)' : 'inherit');
    }
  }

  function renderTabTroca() {
    const termo = semAcento(document.getElementById('busca-troca-magia')?.value || '');
    let html = '';

    if (tabAtiva === 'selecionadas') {
      // Magias atualmente selecionadas para preparar
      html += `<div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:8px">Clique para remover</div>`;

      if (nomesDominio.size > 0) {
        const domMagias = magiasDisponiveis.filter(m => nomesDominio.has(m.nome));
        const filtDom = termo.length >= 2 ? domMagias.filter(m => semAcento(m.nome).includes(termo)) : domMagias;
        if (filtDom.length > 0 || (termo.length < 2 && nomesDominio.size > 0)) {
          html += `<div style="font-size:0.75rem;font-weight:700;color:var(--secondary);margin:4px 0">Domínio (sempre preparadas)</div>`;
          // Garantir que domínio apareca mesmo se nao esta em magiasDisponiveis
          const domNomes = [...nomesDominio];
          const filtDomNomes = termo.length >= 2 ? domNomes.filter(n => semAcento(n).includes(termo)) : domNomes;
          html += `<div class="magias-grid">${filtDomNomes.map(nome => `
            <div class="magia-card selecionada magia-dominio" style="opacity:0.7;cursor:default">
              <span class="magia-card-check"></span>
              <div class="magia-card-nome"><span class="badge-dominio">&#9733;</span> ${nome}</div>
              <div class="magia-card-meta"><span>Domínio</span></div>
              <span class="magia-card-info" data-troca-info="${nome}" data-troca-info-circ="${circuloMap[nome] || 1}" title="Ver detalhes">&#9432;</span>
            </div>
          `).join('')}</div>`;
        }
      }

      const selNomes = [...selecionadasSet];
      const filtSel = termo.length >= 2 ? selNomes.filter(n => semAcento(n).includes(termo)) : selNomes;
      if (filtSel.length > 0) {
        html += `<div class="magias-grid">${filtSel.map(nome => `
          <div class="magia-card selecionada" style="cursor:pointer" data-troca-toggle="${nome}">
            <span class="magia-card-check"></span>
            <div class="magia-card-nome">${nome}</div>
            <div class="magia-card-meta"><span>${circuloMap[nome] || '?'}º Círculo</span></div>
            <span class="magia-card-info" data-troca-info="${nome}" data-troca-info-circ="${circuloMap[nome] || 1}" title="Ver detalhes">&#9432;</span>
          </div>
        `).join('')}</div>`;
      } else if (selecionadasSet.size === 0) {
        html += `<div style="text-align:center;color:var(--text-muted);padding:16px">Nenhuma magia selecionada. Use as tabs de círculo para adicionar.</div>`;
      }
    } else {
      // Magias de um círculo específico
      const circ = parseInt(tabAtiva);
      const magiasDoCirc = magiasCirculo[circ] || [];
      const cheio = selecionadasSet.size >= maxPreparadas;

      html += `<div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:8px">Preparadas: ${selecionadasSet.size}/${maxPreparadas}${cheio ? ' <span style="color:var(--danger)">(Limite)</span>' : ''}</div>`;

      let lista = [...magiasDoCirc];
      lista.sort((a, b) => {
        const aS = selecionadasSet.has(a.nome) ? 0 : 1;
        const bS = selecionadasSet.has(b.nome) ? 0 : 1;
        return aS - bS || a.nome.localeCompare(b.nome);
      });
      if (termo.length >= 2) lista = lista.filter(m => semAcento(m.nome).includes(termo));

      html += `<div class="magias-grid">${lista.map(m => {
        const sel = selecionadasSet.has(m.nome);
        const isDominio = nomesDominio.has(m.nome);
        const bloqueado = cheio && !sel && !isDominio;
        return `
          <div class="magia-card ${sel || isDominio ? 'selecionada' : ''} ${isDominio ? 'magia-dominio' : ''} ${bloqueado ? 'magia-card-bloqueada' : ''}"
               ${isDominio ? '' : `data-troca-toggle="${m.nome}"`}
               style="${bloqueado ? 'opacity:0.35;' : ''}${isDominio ? 'opacity:0.7;cursor:default;' : ''}">
            <span class="magia-card-check"></span>
            <div class="magia-card-nome">${isDominio ? '<span class="badge-dominio">&#9733;</span> ' : ''}${m.nome}</div>
            <div class="magia-card-meta">
              <span>${m.escola || ''}</span>
              ${m.especial === 'C' ? '<span title="Concentração">C</span>' : ''}
              ${isDominio ? '<span>Domínio</span>' : ''}
            </div>
            <span class="magia-card-info" data-troca-info="${m.nome}" data-troca-info-circ="${circ}" title="Ver detalhes">&#9432;</span>
          </div>`;
      }).join('')}</div>`;
    }

    resultadoEl.innerHTML = html;
    bindEventosTroca();
  }

  function bindEventosTroca() {
    // Toggle seleção
    resultadoEl.querySelectorAll('[data-troca-toggle]').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('[data-troca-info]')) return;
        const nome = el.dataset.trocaToggle;
        if (selecionadasSet.has(nome)) {
          selecionadasSet.delete(nome);
        } else {
          if (selecionadasSet.size >= maxPreparadas) {
            toast(`Limite de ${maxPreparadas} magias! Remova uma antes.`, 'error');
            return;
          }
          selecionadasSet.add(nome);
        }
        atualizarContadorTroca();
        renderTabTroca();
      });
    });

    // Info detalhes
    resultadoEl.querySelectorAll('[data-troca-info]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const nome = btn.dataset.trocaInfo;
        const circ = parseInt(btn.dataset.trocaInfoCirc);
        const dados = await getMagiasPorCirculo(circ);
        const magia = dados?.magias?.find(m => m.nome === nome);
        if (!magia) { toast('Detalhes não encontrados', 'error'); return; }
        abrirModal(magia.nome, `
          <div class="magia-meta" style="margin-bottom:8px;display:flex;flex-wrap:wrap;gap:8px;font-size:0.85rem">
            <span class="badge badge-primary">${circ === 0 ? 'Truque' : circ + 'º Círculo'}</span>
            <span class="badge badge-secondary">${magia.escola}</span>
            <span>${magia.tempo_conjuracao}</span> <span>${magia.alcance}</span>
            <span>${magia.componentes}</span> <span>${magia.duracao}</span>
          </div>
          <div class="md-content">${mdParaHtml(magia.descricao)}</div>
          ${magia.circulo_superior ? `<div class="info-box info mt-1"><strong>Em círculos superiores:</strong> ${magia.circulo_superior}</div>` : ''}
        `, '<button class="btn btn-primary" onclick="fecharModal()">Fechar</button>');
      });
    });
  }

  // Tabs
  document.querySelectorAll('#tabs-troca-magias .tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('#tabs-troca-magias .tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      tabAtiva = tab.dataset.tabTroca;
      document.getElementById('busca-troca-magia').value = '';
      renderTabTroca();
    });
  });

  // Busca
  document.getElementById('busca-troca-magia')?.addEventListener('input', renderTabTroca);

  // Confirmar troca
  document.getElementById('btn-confirmar-troca')?.addEventListener('click', () => {
    char.magias_preparadas = [
      ...(char.magias_preparadas || []).filter(m => m.origem === 'dominio'),
      ...[...selecionadasSet].map(nome => ({ nome, circulo: circuloMap[nome] || 1 }))
    ];
    salvar();
    window.fecharModal();
    renderFichaCompleta();
    toast('Magias preparadas atualizadas!', 'success');
  });

  renderTabTroca();
}

// --- Proficiência de armas/armaduras na ficha ---

/** Verifica se o personagem tem proficiência com uma arma */
function sheetTemProfArma(arma) {
  const info = CLASSES_INFO[char.classe];
  if (!info) return false;
  const cat = (arma.categoria || '').toLowerCase();
  const extras = (char.proficiencias_extra || []).map(p => p.toLowerCase());

  if (info.armas.includes('Marcial') && cat.includes('marciai')) return true;
  if (info.armas.includes('Simples') && cat.includes('simples')) return true;
  if (extras.includes('armas marciais') && cat.includes('marciai')) return true;
  if (extras.includes('armas simples') && cat.includes('simples')) return true;
  if (info.armas.some(a => a.includes('Acuidade')) && cat.includes('marciai') && (arma.propriedades || '').toLowerCase().includes('acuidade')) return true;
  if (info.armas.some(a => a.includes('Leve')) && cat.includes('marciai') && (arma.propriedades || '').toLowerCase().includes('leve')) return true;
  return false;
}

/** Verifica se o personagem tem proficiência com uma armadura */
function sheetTemProfArmadura(armadura) {
  const info = CLASSES_INFO[char.classe];
  if (!info) return false;
  const cat = (armadura.categoria || '').toLowerCase();
  const nome = (armadura.nome || '').toLowerCase();
  const extras = (char.proficiencias_extra || []).map(p => p.toLowerCase());

  if (nome === 'escudo') return info.armaduras.includes('Escudo') || extras.includes('escudo');
  if (info.armaduras.includes('Pesada') && cat === 'pesada') return true;
  if (info.armaduras.includes('Média') && (cat === 'média' || cat === 'media')) return true;
  if (info.armaduras.includes('Leve') && cat === 'leve') return true;
  if (extras.includes('armadura pesada') && cat === 'pesada') return true;
  if (extras.includes('armadura média') && (cat === 'média' || cat === 'media')) return true;
  return false;
}

/** Badge de proficiência compacta */
function sheetBadgeProf(proficiente) {
  return proficiente
    ? '<span class="badge badge-prof-sm">Prof</span>'
    : '<span class="badge badge-no-prof-sm">Sem Prof</span>';
}

// --- Inventário na ficha ---
function renderSecaoInventario() {
  const inv = char.inventario || [];

  // Separar equipados, não equipados, e zerados
  const equipados = [];
  const naoEquipados = [];
  const zerados = [];
  inv.forEach((item, idx) => {
    if ((item.quantidade ?? 1) <= 0) zerados.push(idx);
    else if (item.equipado) equipados.push(idx);
    else naoEquipados.push(idx);
  });

  return `
    <div class="card">
      <div class="card-header">
        <h2>Inventario</h2>
        <div class="no-print" style="display:flex;gap:4px;align-items:center">
          <span style="font-weight:700;color:var(--secondary);font-size:0.9rem;cursor:pointer" id="btn-edit-po" title="Editar PO">${char.po || 0} PO</span>
          <button class="btn btn-sm btn-accent" id="btn-add-inv">+ Item</button>
          <button class="btn btn-sm btn-secondary" id="btn-add-inv-custom">+ Custom</button>
        </div>
      </div>
      <div id="sheet-inventario">
        ${inv.length === 0
          ? '<div style="color:var(--text-muted);text-align:center;padding:12px;font-size:0.85rem">Inventario vazio</div>'
          : renderSheetInvLista(equipados, naoEquipados, zerados)
        }
      </div>
    </div>
  `;
}

/** Renderiza a lista do inventário separada por seções */
function renderSheetInvLista(equipados, naoEquipados, zerados) {
  let html = '';

  if (equipados.length > 0) {
    html += '<div class="inv-secao-titulo"><span>Equipados</span></div>';
    html += equipados.map(idx => renderSheetInvItem(char.inventario[idx], idx)).join('');
  }

  if (naoEquipados.length > 0) {
    html += '<div class="inv-secao-titulo"><span>Mochila</span></div>';
    html += naoEquipados.map(idx => renderSheetInvItem(char.inventario[idx], idx)).join('');
  }

  if (zerados && zerados.length > 0) {
    html += '<div class="inv-secao-titulo"><span>Esgotados</span></div>';
    html += zerados.map(idx => renderSheetInvItem(char.inventario[idx], idx)).join('');
  }

  return html;
}

/** Renderiza um item do inventário na ficha */
function renderSheetInvItem(item, idx) {
  // Badge de proficiência
  let profBadge = '';
  if (item.tipo === 'arma' && item.dados?.categoria) {
    profBadge = sheetBadgeProf(sheetTemProfArma({ categoria: item.dados.categoria, propriedades: item.dados.propriedades || '' }));
  }
  if ((item.tipo === 'armadura' || item.tipo === 'escudo') && item.dados?.categoria) {
    profBadge = sheetBadgeProf(sheetTemProfArmadura({ categoria: item.dados.categoria, nome: item.nome }));
  }

  // Badge de tipo de uso (consumível, equipamento, etc.)
  let tipoBadge = '';
  const tipoUso = item.dados?.tipo_uso || '';
  if (tipoUso === 'consumivel') {
    tipoBadge = '<span class="badge" style="font-size:0.6rem;background:#e8f5e9;color:#2e7d32;border:1px solid #a5d6a7">Consumível</span>';
  }

  // Calcular bônus de ataque para armas
  let ataqueInfo = '';
  if (item.tipo === 'arma' && item.dados) {
    const info = CLASSES_INFO[char.classe];
    const prof = bonusProficiencia(char.nivel);
    const props = (item.dados.propriedades || '').toLowerCase();
    const cat = (item.dados.categoria || '').toLowerCase();
    const isAcuidade = props.includes('acuidade');
    const isDistancia = cat.includes('dist');

    let modAtq;
    if (isAcuidade) {
      modAtq = Math.max(calcMod(char.atributos.forca), calcMod(char.atributos.destreza));
    } else if (isDistancia) {
      modAtq = calcMod(char.atributos.destreza);
    } else {
      modAtq = calcMod(char.atributos.forca);
    }

    const temProf = sheetTemProfArma({ categoria: item.dados.categoria, propriedades: item.dados.propriedades || '' });
    const bonusAtq = modAtq + (temProf ? prof : 0);
    ataqueInfo = `<span class="badge badge-secondary" style="font-size:0.65rem">Atq ${fmtMod(bonusAtq)}</span>`;
  }

  // Descrição curta do item
  const descCurta = item.dados?.descricao || item.descricao || '';
  const descPreview = descCurta && item.tipo === 'equipamento'
    ? `<div class="inv-item-detalhe" style="font-size:0.7rem;color:var(--text-muted);margin-top:1px">${descCurta.length > 80 ? descCurta.substring(0, 80) + '…' : descCurta}</div>`
    : '';

  // Badge e info extra para itens customizados
  let customBadges = '';
  if (item.tipo === 'customizado') {
    const bca = parseInt(item.dados?.bonus_ca) || 0;
    const batq = parseInt(item.dados?.bonus_ataque) || 0;
    if (bca !== 0) customBadges += `<span class="badge" style="font-size:0.6rem;background:#e8eaf6;color:#3949ab;border:1px solid #9fa8da">CA ${bca > 0 ? '+' : ''}${bca}</span> `;
    if (batq !== 0) customBadges += `<span class="badge badge-secondary" style="font-size:0.65rem">Atq ${batq > 0 ? '+' : ''}${batq}</span> `;
    if (item.dados?.dano) customBadges += `<span class="badge" style="font-size:0.6rem;background:#fce4ec;color:#c62828;border:1px solid #ef9a9a">${item.dados.dano}</span> `;
  }

  const isZeroQtd = (item.quantidade ?? 1) <= 0;

  return `
    <div class="inv-item ${item.equipado ? 'inv-item-equipado' : ''} ${isZeroQtd ? 'inv-item-zerado' : ''}" data-idx="${idx}" draggable="true">
      <div class="inv-drag-handle no-print" title="Arrastar para reordenar">&#9776;</div>
      <div style="flex:1;cursor:pointer" data-info-inv-sheet="${idx}" title="Ver detalhes">
        <div class="inv-item-nome">
          ${item.nome} ${profBadge} ${ataqueInfo} ${tipoBadge} ${customBadges}
        </div>
        <div class="inv-item-detalhe">
          ${item.tipo === 'arma' ? `${item.dados?.dano || ''} | ${item.dados?.propriedades || ''}` : ''}
          ${item.tipo === 'armadura' ? `CA: ${item.dados?.ca || ''} | ${item.dados?.categoria || ''}` : ''}
          ${item.tipo === 'escudo' ? `CA: ${item.dados?.ca || ''} | Escudo` : ''}
          ${item.tipo === 'equipamento' ? `${item.dados?.custo || ''} ${item.dados?.peso ? '| ' + item.dados.peso : ''}` : ''}
          ${item.tipo === 'customizado' ? `${item.descricao ? (item.descricao.length > 60 ? item.descricao.substring(0, 60) + '...' : item.descricao) : ''}` : ''}
          ${item.tipo === 'generico' ? `${item.descricao || ''}` : ''}
        </div>
        ${descPreview}
      </div>
      <div class="inv-item-acoes no-print" style="align-items:center">
        <div class="inv-qty-control" style="display:flex;align-items:center;gap:2px">
          <button class="btn btn-sm btn-icon" data-qty-minus="${idx}" style="font-size:0.7rem;padding:1px 5px">−</button>
          <span style="min-width:20px;text-align:center;font-size:0.8rem;font-weight:700" data-qty-display="${idx}">${item.quantidade ?? 1}</span>
          <button class="btn btn-sm btn-icon" data-qty-plus="${idx}" style="font-size:0.7rem;padding:1px 5px">+</button>
        </div>
        <label class="form-check inv-equip-label" title="Equipar/Desequipar">
          <input type="checkbox" data-sheet-equip="${idx}" ${item.equipado ? 'checked' : ''}> Eq.
        </label>
        <button class="btn btn-sm btn-danger btn-icon" data-sheet-rem-inv="${idx}">&times;</button>
      </div>
    </div>
  `;
}

function setupEventosInventarioSheet() {
  const invContainer = document.getElementById('sheet-inventario');

  // Equipar/desequipar — re-renderiza a ficha completa para atualizar CA e stats
  document.querySelectorAll('[data-sheet-equip]').forEach(cb => {
    cb.addEventListener('change', () => {
      const idx = parseInt(cb.dataset.sheetEquip);
      if (char.inventario[idx]) {
        char.inventario[idx].equipado = cb.checked;
        salvar();
        // Re-renderizar ficha inteira para recalcular CA e outros stats
        renderFichaCompleta();
      }
    });
  });

  // Remover item (com confirmação)
  document.querySelectorAll('[data-sheet-rem-inv]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.sheetRemInv);
      const item = char.inventario[idx];
      if (!item) return;
      abrirModal('Remover Item', `
        <p>Deseja realmente remover <strong>${item.nome}</strong>${item.quantidade > 1 ? ` (x${item.quantidade})` : ''} do inventário?</p>
      `, `
        <button class="btn btn-danger" id="btn-confirmar-rem-inv-sheet">Remover</button>
        <button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>
      `);
      document.getElementById('btn-confirmar-rem-inv-sheet')?.addEventListener('click', () => {
        char.inventario.splice(idx, 1);
        salvar();
        fecharModal();
        reRenderSheetInv();
      });
    });
  });

  // Quantidade +/-
  document.querySelectorAll('[data-qty-plus]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.qtyPlus);
      if (char.inventario[idx]) {
        char.inventario[idx].quantidade = (char.inventario[idx].quantidade ?? 1) + 1;
        salvar();
        reRenderSheetInv();
      }
    });
  });
  document.querySelectorAll('[data-qty-minus]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.qtyMinus);
      if (char.inventario[idx]) {
        const novaQtd = Math.max(0, (char.inventario[idx].quantidade ?? 1) - 1);
        char.inventario[idx].quantidade = novaQtd;
        salvar();
        reRenderSheetInv();
      }
    });
  });

  // Ver detalhes do item ao clicar
  document.querySelectorAll('[data-info-inv-sheet]').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('input') || e.target.closest('button')) return;
      const idx = parseInt(el.dataset.infoInvSheet);
      const item = char.inventario[idx];
      if (item) mostrarDetalheItemSheet(item);
    });
  });

  // Drag and drop
  setupSheetDragDrop();

  // Adicionar item (por categorias)
  document.getElementById('btn-add-inv')?.addEventListener('click', () => mostrarSeletorCategoria());

  // Item customizado
  document.getElementById('btn-add-inv-custom')?.addEventListener('click', () => {
    abrirModal('Item Customizado', `
      <div class="form-group"><label class="form-label" for="ic-nome">Nome</label><input type="text" class="form-input" id="ic-nome"></div>
      <div class="form-group"><label class="form-label" for="ic-desc">Descricao</label><textarea class="form-textarea" id="ic-desc" rows="2"></textarea></div>
      <div class="row gap-1">
        <div class="col">
          <label class="form-label" for="ic-ca">Bonus CA</label>
          <input type="number" class="form-input" id="ic-ca" value="0" min="-5" max="5">
          <div style="font-size:0.65rem;color:var(--text-muted)">-5 a +5</div>
        </div>
        <div class="col">
          <label class="form-label" for="ic-dano">Dano</label>
          <input type="text" class="form-input" id="ic-dano" placeholder="1d8 Cortante">
          <div style="font-size:0.65rem;color:var(--text-muted)">Ex: 2d6 Cortante</div>
        </div>
        <div class="col">
          <label class="form-label" for="ic-atq">Bonus Atq</label>
          <input type="number" class="form-input" id="ic-atq" value="0" min="-5" max="10">
          <div style="font-size:0.65rem;color:var(--text-muted)">-5 a +10</div>
        </div>
      </div>
      <div id="ic-erros" style="display:none;color:var(--danger);font-size:0.8rem;margin-top:8px"></div>
    `, '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-primary" id="btn-add-ic">Adicionar</button>');

    document.getElementById('btn-add-ic')?.addEventListener('click', () => {
      const nome = document.getElementById('ic-nome')?.value?.trim();
      const desc = document.getElementById('ic-desc')?.value?.trim() || '';
      const ca = parseInt(document.getElementById('ic-ca')?.value) || 0;
      const danoVal = document.getElementById('ic-dano')?.value?.trim() || '';
      const atq = parseInt(document.getElementById('ic-atq')?.value) || 0;
      const errosEl = document.getElementById('ic-erros');
      const erros = [];

      if (!nome) erros.push('Informe um nome para o item.');

      // Validar dano no formato de dados (ex: 1d6, 2d8 Cortante, 1d4+2 Perfurante)
      if (danoVal) {
        const regexDano = /^\d+d\d+(\s*[+\-]\s*\d+)?(\s+\w+)?$/i;
        if (!regexDano.test(danoVal)) {
          erros.push('Dano deve seguir o formato de dados: 1d8, 2d6 Cortante, 1d4+2 Perfurante');
        }
      }

      // Validar bonus CA (-5 a +5)
      if (ca < -5 || ca > 5) {
        erros.push('Bonus de CA deve ser entre -5 e +5.');
      }

      // Validar bonus Ataque (-5 a +10)
      if (atq < -5 || atq > 10) {
        erros.push('Bonus de Ataque deve ser entre -5 e +10.');
      }

      if (erros.length > 0) {
        if (errosEl) { errosEl.style.display = 'block'; errosEl.innerHTML = erros.join('<br>'); }
        return;
      }

      char.inventario.push({
        nome,
        tipo: 'customizado',
        quantidade: 1,
        equipado: false,
        descricao: desc,
        dados: {
          bonus_ca: String(ca),
          dano: danoVal,
          bonus_ataque: String(atq)
        }
      });
      salvar();
      window.fecharModal();
      renderFichaCompleta();
      toast(`${nome} adicionado!`, 'success');
    });
  });

  // Editar PO
  document.getElementById('btn-edit-po')?.addEventListener('click', () => {
    abrirModal('Pecas de Ouro', `
      <div class="form-group"><label class="form-label" for="edit-po">PO</label><input type="number" class="form-input" id="edit-po" value="${char.po || 0}" min="0"></div>
    `, '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-primary" id="btn-salvar-po">Salvar</button>');
    document.getElementById('btn-salvar-po')?.addEventListener('click', () => {
      char.po = parseInt(document.getElementById('edit-po')?.value) || 0;
      salvar();
      window.fecharModal();
      renderFichaCompleta();
    });
  });
}

/** Re-renderiza apenas a lista do inventário sem refazer a ficha toda */
function reRenderSheetInv() {
  const invEl = document.getElementById('sheet-inventario');
  if (!invEl) { renderFichaCompleta(); return; }

  const inv = char.inventario || [];
  const equipados = [];
  const naoEquipados = [];
  const zerados = [];
  inv.forEach((item, idx) => {
    if ((item.quantidade ?? 1) <= 0) zerados.push(idx);
    else if (item.equipado) equipados.push(idx);
    else naoEquipados.push(idx);
  });

  invEl.innerHTML = inv.length === 0
    ? '<div style="color:var(--text-muted);text-align:center;padding:12px;font-size:0.85rem">Inventario vazio</div>'
    : renderSheetInvLista(equipados, naoEquipados, zerados);

  // Re-bind eventos
  setupEventosInventarioSheet();
}

/** Drag and drop no inventário da ficha */
function setupSheetDragDrop() {
  const listaEl = document.getElementById('sheet-inventario');
  if (!listaEl) return;

  let dragIdx = null;

  listaEl.querySelectorAll('.inv-item[draggable]').forEach(el => {
    el.addEventListener('dragstart', (e) => {
      dragIdx = parseInt(el.dataset.idx);
      el.classList.add('inv-item-dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    el.addEventListener('dragend', () => {
      el.classList.remove('inv-item-dragging');
      listaEl.querySelectorAll('.inv-item').forEach(item => item.classList.remove('inv-item-dragover'));
      dragIdx = null;
    });

    el.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      el.classList.add('inv-item-dragover');
    });

    el.addEventListener('dragleave', () => {
      el.classList.remove('inv-item-dragover');
    });

    el.addEventListener('drop', (e) => {
      e.preventDefault();
      const dropIdx = parseInt(el.dataset.idx);
      if (dragIdx !== null && dragIdx !== dropIdx) {
        const [item] = char.inventario.splice(dragIdx, 1);
        char.inventario.splice(dropIdx, 0, item);
        salvar();
        reRenderSheetInv();
      }
    });
  });
}

// --- Seletor de itens por categoria ---

/** Cache local dos dados de equipamento */
let _cacheEquipSheet = null;

async function carregarDadosEquipSheet() {
  if (_cacheEquipSheet) return _cacheEquipSheet;
  const [armasData, armadurasData, equipData] = await Promise.all([
    getArmas(), getArmaduras(), getEquipamentoAventura()
  ]);
  _cacheEquipSheet = {
    armas: armasData?.armas || [],
    propriedadesArmas: armasData?.propriedades || [],
    armaduras: armadurasData?.armaduras || [],
    equipAvent: equipData?.itens || [],
    municao: (equipData?.municao || []).map(m => ({
      nome: m.tipo,
      custo: m.custo || '',
      peso: m.peso || '',
      descricao: `Quantidade: ${m.quantidade || '—'} | Armazenamento: ${m.armazenamento || '—'}`
    }))
  };
  return _cacheEquipSheet;
}

/** Mostra popup com detalhes completos de um item do inventário */
async function mostrarDetalheItemSheet(item) {
  if (!item) return;
  const dados = await carregarDadosEquipSheet();
  const propsDescs = dados.propriedadesArmas || [];
  let corpo = '';

  if (item.tipo === 'arma') {
    const d = item.dados || {};
    corpo += `<div class="row" style="font-size:0.85rem;gap:8px;margin-bottom:10px">`;
    if (d.categoria) corpo += `<div class="col"><strong>Categoria:</strong> ${d.categoria}</div>`;
    if (d.dano) corpo += `<div class="col"><strong>Dano:</strong> ${d.dano}</div>`;
    corpo += `</div>`;

    if (d.maestria) corpo += `<div style="font-size:0.85rem;margin-bottom:6px"><strong>Maestria:</strong> ${d.maestria}</div>`;
    if (d.custo || d.peso) corpo += `<div style="font-size:0.85rem;margin-bottom:6px"><strong>Custo:</strong> ${d.custo || '—'} | <strong>Peso:</strong> ${d.peso || '—'}</div>`;

    // Descrições das propriedades
    if (d.propriedades) {
      const propsNomes = d.propriedades.split(',').map(p => p.trim().replace(/\s*\(.*\)/, ''));
      const propsComDesc = propsNomes
        .map(nome => {
          const prop = propsDescs.find(p => semAcento(p.nome).toLowerCase() === semAcento(nome).toLowerCase());
          return prop ? { nome: prop.nome, descricao: prop.descricao } : null;
        })
        .filter(Boolean);

      if (propsComDesc.length > 0) {
        corpo += `<div class="section-divider mt-1"><span>Propriedades</span></div>`;
        corpo += propsComDesc.map(p => `
          <details style="margin-bottom:4px">
            <summary style="font-weight:600;cursor:pointer;font-size:0.85rem">${p.nome}</summary>
            <div class="md-content" style="padding:4px 0;font-size:0.8rem">${mdParaHtml(p.descricao)}</div>
          </details>
        `).join('');
      }

      if (d.maestria) {
        const maestriaDesc = propsDescs.find(p => semAcento(p.nome).toLowerCase() === semAcento(d.maestria).toLowerCase());
        if (maestriaDesc) {
          corpo += `<div class="section-divider mt-1"><span>Maestria: ${d.maestria}</span></div>`;
          corpo += `<div class="md-content" style="font-size:0.8rem">${mdParaHtml(maestriaDesc.descricao)}</div>`;
        }
      }
    }
  } else if (item.tipo === 'armadura' || item.tipo === 'escudo') {
    const d = item.dados || {};
    corpo += `<div style="font-size:0.85rem;margin-bottom:6px">`;
    if (d.categoria) corpo += `<strong>Categoria:</strong> ${d.categoria}<br>`;
    if (d.ca) corpo += `<strong>Classe de Armadura:</strong> ${d.ca}<br>`;
    if (d.requisito_forca && d.requisito_forca !== '—') corpo += `<strong>Requisito de Força:</strong> ${d.requisito_forca}<br>`;
    if (d.furtividade && d.furtividade !== '—') corpo += `<strong>Furtividade:</strong> ${d.furtividade}<br>`;
    if (d.custo || d.peso) corpo += `<strong>Custo:</strong> ${d.custo || '—'} | <strong>Peso:</strong> ${d.peso || '—'}`;
    corpo += `</div>`;
  } else if (item.tipo === 'customizado') {
    const d = item.dados || {};
    const bonusCa = parseInt(d.bonus_ca) || 0;
    const bonusAtq = parseInt(d.bonus_ataque) || 0;
    const dano = d.dano || '';

    corpo += `<div style="font-size:0.85rem;margin-bottom:6px"><span class="badge" style="font-size:0.7rem;background:#f3e5f5;color:#6a1b9a">Item Customizado</span></div>`;

    if (bonusCa || dano || bonusAtq) {
      corpo += `<div style="font-size:0.85rem;margin-bottom:6px">`;
      if (bonusCa) corpo += `<strong>Bonus CA:</strong> ${bonusCa > 0 ? '+' : ''}${bonusCa}<br>`;
      if (dano) corpo += `<strong>Dano:</strong> ${dano}<br>`;
      if (bonusAtq) corpo += `<strong>Bonus Ataque:</strong> ${bonusAtq > 0 ? '+' : ''}${bonusAtq}`;
      corpo += `</div>`;
    }

    if (item.descricao) {
      corpo += `<div class="md-content" style="margin-top:6px;font-size:0.85rem">${mdParaHtml(item.descricao)}</div>`;
    }
  } else {
    const d = item.dados || {};
    if (d.tipo_uso) {
      const tipoLabel = d.tipo_uso === 'consumivel' ? '🧪 Consumível' : '🎒 Equipamento';
      corpo += `<div style="font-size:0.85rem;margin-bottom:6px"><span class="badge" style="font-size:0.7rem;background:${d.tipo_uso === 'consumivel' ? '#e8f5e9;color:#2e7d32' : '#e3f2fd;color:#1565c0'}">${tipoLabel}</span></div>`;
    }
    if (d.custo || d.peso) {
      corpo += `<div style="font-size:0.85rem"><strong>Custo:</strong> ${d.custo || '—'} | <strong>Peso:</strong> ${d.peso || '—'}</div>`;
    }
    if (d.descricao) {
      corpo += `<div class="md-content" style="margin-top:6px;font-size:0.85rem">${mdParaHtml(d.descricao)}</div>`;
    }
    if (item.descricao) {
      corpo += `<div class="md-content" style="margin-top:6px;font-size:0.85rem">${mdParaHtml(item.descricao)}</div>`;
    }
  }

  if (!corpo.trim()) corpo = '<div style="color:var(--text-muted)">Sem informações adicionais disponíveis.</div>';

  abrirModal(item.nome, corpo);
}

/** Abre o seletor de itens dividido por categorias */
async function mostrarSeletorCategoria() {
  const dados = await carregarDadosEquipSheet();

  // Categorias de itens consumíveis / poções do equipamento de aventura
  const ITENS_CONSUMIVEIS = ['Ácido', 'Água Benta', 'Antitoxina', 'Fogo Alquímico', 'Óleo', 'Veneno Básico'];

  const consumiveis = dados.equipAvent.filter(i => ITENS_CONSUMIVEIS.some(c => i.nome.includes(c)));
  const municao = dados.municao || [];
  const outrosEquip = dados.equipAvent.filter(i =>
    !ITENS_CONSUMIVEIS.some(c => i.nome.includes(c))
  );

  const categorias = [
    { id: 'armas', label: 'Armas', icon: '&#9876;' },
    { id: 'armaduras', label: 'Armaduras', icon: '&#128737;' },
    { id: 'consumiveis', label: 'Consumiveis', icon: '&#9878;' },
    { id: 'municao', label: 'Municao', icon: '&#10148;' },
    { id: 'equipamento', label: 'Equipamento', icon: '&#128188;' }
  ];

  const html = `
    <div class="search-box"><input type="text" id="busca-inv-cat" placeholder="Buscar item..." class="form-input"></div>
    <div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap">
      ${categorias.map(c => `
        <button class="btn btn-sm btn-outline filtro-inv-cat ${c.id === 'armas' ? 'active' : ''}" data-cat="${c.id}">
          <span>${c.icon}</span> ${c.label}
        </button>
      `).join('')}
    </div>
    <div id="lista-inv-cat" style="max-height:50vh;overflow-y:auto"></div>
  `;

  abrirModal('Adicionar Item', html);

  let catAtual = 'armas';

  function renderCategoria(cat, filtroTexto) {
    const listaEl = document.getElementById('lista-inv-cat');
    if (!listaEl) return;

    let itens = [];
    switch (cat) {
      case 'armas':
        itens = dados.armas.map(a => {
          const prof = sheetTemProfArma(a);
          return {
            nome: a.nome,
            detalhe: `${a.dano} | ${a.propriedades || '\u2014'}`,
            detalhe2: `Maestria: ${a.maestria || '\u2014'} | ${a.custo} | ${a.peso || '\u2014'}`,
            badge: sheetBadgeProf(prof),
            badgeCat: `<span class="badge badge-secondary">${a.categoria?.includes('Dist') ? 'Dist\u00e2ncia' : 'Corpo'}</span>`,
            prof,
            dados: a,
            tipo: 'arma'
          };
        });
        // Proficientes primeiro
        itens.sort((a, b) => (a.prof ? 0 : 1) - (b.prof ? 0 : 1));
        break;
      case 'armaduras':
        itens = dados.armaduras.map(a => {
          const prof = sheetTemProfArmadura(a);
          const extras = [];
          if (a.requisito_forca && a.requisito_forca !== '\u2014') extras.push(`For: ${a.requisito_forca}`);
          if (a.furtividade && a.furtividade !== '\u2014') extras.push(`Furt.: ${a.furtividade}`);
          return {
            nome: a.nome,
            detalhe: `CA: ${a.ca}${extras.length ? ' | ' + extras.join(' | ') : ''}`,
            detalhe2: `${a.custo} | ${a.peso || '\u2014'}`,
            badge: sheetBadgeProf(prof),
            badgeCat: `<span class="badge badge-secondary">${a.categoria}</span>`,
            prof,
            dados: a,
            tipo: a.nome === 'Escudo' ? 'escudo' : 'armadura'
          };
        });
        itens.sort((a, b) => (a.prof ? 0 : 1) - (b.prof ? 0 : 1));
        break;
      case 'consumiveis':
        itens = consumiveis.map(i => ({
          nome: i.nome,
          detalhe: `${i.custo} | ${i.peso || '\u2014'}`,
          detalhe2: i.descricao ? (i.descricao.length > 80 ? i.descricao.substring(0, 80) + '…' : i.descricao) : '',
          badge: '<span class="badge" style="font-size:0.6rem;background:#e8f5e9;color:#2e7d32">Consumível</span>',
          badgeCat: '',
          dados: i,
          tipo: 'equipamento'
        }));
        break;
      case 'municao':
        itens = municao.map(i => ({
          nome: i.nome,
          detalhe: `${i.custo} | ${i.peso || '\u2014'}`,
          badge: '', badgeCat: '',
          dados: i,
          tipo: 'equipamento'
        }));
        break;
      case 'equipamento':
        itens = outrosEquip.map(i => ({
          nome: i.nome,
          detalhe: `${i.custo} | ${i.peso || '\u2014'}`,
          badge: '', badgeCat: '',
          dados: i,
          tipo: 'equipamento'
        }));
        break;
    }

    // Filtrar por texto
    if (filtroTexto) {
      itens = itens.filter(i => semAcento(i.nome).includes(filtroTexto));
    }

    listaEl.innerHTML = itens.length === 0
      ? '<div style="color:var(--text-muted);text-align:center;padding:16px">Nenhum item encontrado</div>'
      : itens.map((it, i) => `
        <div class="inv-item ${it.prof === false ? 'item-sem-prof' : ''}" style="cursor:pointer" data-add-cat="${i}">
          <div style="flex:1">
            <div class="inv-item-nome">${it.nome} ${it.badge}</div>
            <div class="inv-item-detalhe">${it.detalhe}</div>
            ${it.detalhe2 ? `<div class="inv-item-detalhe" style="font-size:0.7rem;opacity:0.7">${it.detalhe2}</div>` : ''}
          </div>
          ${it.badgeCat || ''}
        </div>
      `).join('');

    // Eventos de seleção - mostrar descrição antes de adicionar
    listaEl.querySelectorAll('[data-add-cat]').forEach(el => {
      el.addEventListener('click', () => {
        const item = itens[parseInt(el.dataset.addCat)];
        if (!item) return;

        // Construir descrição completa do item
        let descCorpo = '';
        const d = item.dados || {};
        if (item.tipo === 'arma') {
          descCorpo += `<div style="font-size:0.85rem;margin-bottom:6px">`;
          if (d.categoria) descCorpo += `<strong>Categoria:</strong> ${d.categoria}<br>`;
          if (d.dano) descCorpo += `<strong>Dano:</strong> ${d.dano}<br>`;
          if (d.maestria) descCorpo += `<strong>Maestria:</strong> ${d.maestria}<br>`;
          if (d.propriedades) descCorpo += `<strong>Propriedades:</strong> ${d.propriedades}<br>`;
          if (d.custo || d.peso) descCorpo += `<strong>Custo:</strong> ${d.custo || '—'} | <strong>Peso:</strong> ${d.peso || '—'}`;
          descCorpo += `</div>`;
        } else if (item.tipo === 'armadura' || item.tipo === 'escudo') {
          descCorpo += `<div style="font-size:0.85rem;margin-bottom:6px">`;
          if (d.categoria) descCorpo += `<strong>Categoria:</strong> ${d.categoria}<br>`;
          if (d.ca) descCorpo += `<strong>CA:</strong> ${d.ca}<br>`;
          if (d.custo || d.peso) descCorpo += `<strong>Custo:</strong> ${d.custo || '—'} | <strong>Peso:</strong> ${d.peso || '—'}`;
          descCorpo += `</div>`;
        } else {
          if (d.custo || d.peso) descCorpo += `<div style="font-size:0.85rem;margin-bottom:6px"><strong>Custo:</strong> ${d.custo || '—'} | <strong>Peso:</strong> ${d.peso || '—'}</div>`;
          if (d.descricao) descCorpo += `<div class="md-content" style="font-size:0.85rem">${mdParaHtml(d.descricao)}</div>`;
        }
        if (!descCorpo.trim()) descCorpo = '<div style="color:var(--text-muted)">Sem descrição disponível.</div>';

        abrirModal(item.nome,
          descCorpo,
          `<button class="btn btn-secondary" onclick="fecharModal()">Voltar</button>
           <button class="btn btn-primary" id="btn-confirmar-add-item">Adicionar ao Inventário</button>`
        );

        document.getElementById('btn-confirmar-add-item')?.addEventListener('click', () => {
          const novoItem = {
            nome: item.nome,
            tipo: item.tipo,
            quantidade: 1,
            equipado: false,
            descricao: item.tipo === 'arma' ? `${item.dados.dano}` : item.tipo === 'armadura' ? `CA: ${item.dados.ca}` : '',
            dados: { ...item.dados }
          };

          // Verificar se já existe no inventário (agrupar)
          const existente = char.inventario.find(inv => inv.nome === item.nome && inv.tipo === item.tipo);
          if (existente && ['equipamento', 'generico'].includes(item.tipo)) {
            existente.quantidade = (existente.quantidade || 1) + 1;
          } else {
            char.inventario.push(novoItem);
          }

          salvar();
          window.fecharModal();
          renderFichaCompleta();
          toast(`${item.nome} adicionado!`, 'success');
        });
      });
    });
  }

  // Renderizar categoria inicial
  renderCategoria(catAtual, '');

  // Eventos de troca de categoria
  document.querySelectorAll('.filtro-inv-cat').forEach(btn => {
    btn.addEventListener('click', () => {
      catAtual = btn.dataset.cat;
      document.querySelectorAll('.filtro-inv-cat').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const termo = semAcento(document.getElementById('busca-inv-cat')?.value || '');
      renderCategoria(catAtual, termo);
    });
  });

  // Busca por texto
  document.getElementById('busca-inv-cat')?.addEventListener('input', (e) => {
    const termo = semAcento(e.target.value);
    renderCategoria(catAtual, termo);
  });
}

// --- Detalhes pessoais ---
function renderSecaoDetalhes() {
  const campos = [
    { key: 'aparencia', label: 'Aparencia' },
    { key: 'personalidade', label: 'Personalidade' },
    { key: 'ideais', label: 'Ideais' },
    { key: 'lacos', label: 'Lacos' },
    { key: 'defeitos', label: 'Defeitos' },
    { key: 'historia_personagem', label: 'Historia' },
    { key: 'notas', label: 'Notas' }
  ];

  const temConteudo = campos.some(c => char[c.key]);
  if (!temConteudo) return `
    <div class="card no-print">
      <div class="card-header"><h2>Detalhes</h2></div>
      <div style="text-align:center;color:var(--text-muted);font-size:0.85rem;padding:8px">
        Nenhum detalhe preenchido.
        <button class="btn btn-sm btn-secondary mt-1" id="btn-edit-detalhes">Editar</button>
      </div>
    </div>
  `;

  return `
    <div class="card">
      <div class="card-header"><h2>Detalhes</h2>
        <button class="btn btn-sm btn-secondary no-print" id="btn-edit-detalhes">Editar</button>
      </div>
      ${campos.filter(c => char[c.key]).map(c => `
        <div style="margin-bottom:8px">
          <div style="font-size:0.75rem;font-weight:700;text-transform:uppercase;color:var(--text-muted)">${c.label}</div>
          <div style="font-size:0.85rem">${char[c.key]}</div>
        </div>
      `).join('')}
    </div>
  `;
}
