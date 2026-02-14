// ============================================================
// Ficha de Personagem - Visualização e Edição
// ============================================================
import { CLASSES_INFO, PERICIAS, ATRIBUTOS_NOMES, ATRIBUTOS_KEYS, ATRIBUTO_NOME_PARA_KEY } from '../dados-classes.js';
import { getPersonagem, salvarPersonagem, removerPersonagem } from '../store.js';
import { getClasse, getMagiasClasse, getMagiasPorCirculo, getIndiceMagias, getArmas, getArmaduras, getEquipamentoAventura } from '../db.js';
import { calcMod, fmtMod, bonusProficiencia, calcCA, calcCDMagia, calcAtaqueMagia, calcPercepcaoPassiva, calcBonusPericia, calcPVTotal, getEspacosMagia, getTruquesConhecidos, getMagiaPreparadas, toast, abrirModal, mdParaHtml, semAcento, gerarId } from '../utils.js';
import { podeSubirDeNivel, subirDeNivel, XP_POR_NIVEL, adicionarXP } from '../levelup.js';

let char = null;
let containerRef = null;
let classeData = null;
let indiceMagiasCache = null;

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

  renderFichaCompleta();

  document.getElementById('btn-print')?.addEventListener('click', () => window.print());
}

function salvar() {
  salvarPersonagem(char);
}

function renderFichaCompleta() {
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
          <div class="counter no-print">
            <button class="counter-btn" id="hp-minus">-</button>
            <span class="counter-value" style="color:${char.pv_atual <= char.pv_max * 0.25 ? 'var(--danger)' : char.pv_atual <= char.pv_max * 0.5 ? 'var(--warning)' : 'var(--success)'}">
              ${char.pv_atual}
            </span>
            <button class="counter-btn" id="hp-plus">+</button>
          </div>
          <div style="font-size:0.75rem;color:var(--text-muted)">/ ${char.pv_max}</div>
          <!-- Para impressão -->
          <div class="hidden" style="font-size:1.3rem;font-weight:800">${char.pv_atual} / ${char.pv_max}</div>
        </div>
        <div style="text-align:center">
          <div style="font-size:0.7rem;font-weight:700;text-transform:uppercase;color:var(--text-muted)">PV Temporario</div>
          <div class="counter no-print">
            <button class="counter-btn" id="temp-minus">-</button>
            <span class="counter-value">${char.pv_temporario || 0}</span>
            <button class="counter-btn" id="temp-plus">+</button>
          </div>
        </div>
        <div style="text-align:center">
          <div style="font-size:0.7rem;font-weight:700;text-transform:uppercase;color:var(--text-muted)">Dados de Vida</div>
          <div style="font-size:1rem;font-weight:700">${char.nivel - (char.dados_vida_usados || 0)}d${info.dado_vida || '?'} / ${char.nivel}</div>
          <button class="btn btn-sm btn-secondary no-print" id="btn-usar-dv" style="margin-top:4px">Usar DV</button>
        </div>
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
          return `
            <div class="atributo-box ${isPrimario ? 'destaque' : ''}">
              <div class="atributo-nome">${nome}</div>
              <div class="atributo-mod">${fmtMod(mod)}</div>
              <div class="atributo-valor">${val}</div>
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

    <!-- Perícias -->
    <div class="card">
      <div class="card-header"><h2>Pericias</h2>
        <span style="font-size:0.75rem;color:var(--text-muted)">Percep. Passiva: ${calcPercepcaoPassiva(char)}</span>
      </div>
      <div class="pericias-lista">
        ${PERICIAS.map(p => {
          const proficiente = (char.pericias_proficientes || []).includes(p.nome);
          const expertise = (char.pericias_expertise || []).includes(p.nome);
          const bonus = calcBonusPericia(char, p.nome);
          return `
            <div class="pericia-item">
              <div class="pericia-prof ${proficiente ? (expertise ? 'expertise' : 'ativo') : ''}"></div>
              <span class="pericia-bonus">${fmtMod(bonus)}</span>
              <span class="pericia-nome">${p.nome} <small style="color:var(--text-light)">(${p.atributo.substring(0, 3)})</small></span>
            </div>`;
        }).join('')}
      </div>
    </div>

    <!-- Talentos -->
    ${renderSecaoTalentos()}

    <!-- Características de Classe -->
    ${renderSecaoCaracteristicas()}

    <!-- Espaços de Magia e Magias -->
    ${info.conjurador ? renderSecaoMagias() : ''}

    <!-- Inventário -->
    ${renderSecaoInventario()}

    <!-- Detalhes pessoais -->
    ${renderSecaoDetalhes()}

    <!-- Ações da ficha -->
    <div class="card no-print mt-3">
      <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
        <button class="btn btn-accent" id="btn-descanso-curto">Descanso Curto</button>
        <button class="btn btn-accent" id="btn-descanso-longo">Descanso Longo</button>
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
}

// --- HP e Dados de Vida ---
function setupEventosHP() {
  document.getElementById('hp-minus')?.addEventListener('click', () => {
    abrirModal('Dano Recebido',
      '<div class="form-group"><label class="form-label">Valor do dano</label><input type="number" class="form-input" id="input-dano" value="1" min="1" autofocus></div>',
      '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-danger" id="btn-aplicar-dano">Aplicar Dano</button>'
    );
    document.getElementById('btn-aplicar-dano')?.addEventListener('click', () => {
      let dano = parseInt(document.getElementById('input-dano')?.value) || 0;
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
      '<div class="form-group"><label class="form-label">Valor da cura</label><input type="number" class="form-input" id="input-cura" value="1" min="1" autofocus></div>',
      '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-success" id="btn-aplicar-cura">Curar</button>'
    );
    document.getElementById('btn-aplicar-cura')?.addEventListener('click', () => {
      const cura = parseInt(document.getElementById('input-cura')?.value) || 0;
      char.pv_atual = Math.min(char.pv_max, char.pv_atual + cura);
      salvar();
      window.fecharModal();
      renderFichaCompleta();
    });
  });

  document.getElementById('temp-minus')?.addEventListener('click', () => {
    char.pv_temporario = Math.max(0, (char.pv_temporario || 0) - 1);
    salvar();
    renderFichaCompleta();
  });

  document.getElementById('temp-plus')?.addEventListener('click', () => {
    char.pv_temporario = (char.pv_temporario || 0) + 1;
    salvar();
    renderFichaCompleta();
  });

  document.getElementById('btn-usar-dv')?.addEventListener('click', () => {
    const info = CLASSES_INFO[char.classe];
    if (!info) return;
    const dvRestantes = char.nivel - (char.dados_vida_usados || 0);
    if (dvRestantes <= 0) { toast('Sem dados de vida restantes', 'error'); return; }
    const modCon = calcMod(char.atributos.constituicao);
    const media = Math.floor(info.dado_vida / 2) + 1;
    const cura = Math.max(1, media + modCon);
    char.pv_atual = Math.min(char.pv_max, char.pv_atual + cura);
    char.dados_vida_usados = (char.dados_vida_usados || 0) + 1;
    salvar();
    toast(`Curou ${cura} PV (d${info.dado_vida}+${modCon})`, 'success');
    renderFichaCompleta();
  });
}

// --- Descansos ---
function setupEventosDescanso() {
  document.getElementById('btn-descanso-curto')?.addEventListener('click', () => {
    toast('Descanso curto realizado', 'success');
  });

  document.getElementById('btn-descanso-longo')?.addEventListener('click', () => {
    char.pv_atual = char.pv_max;
    char.pv_temporario = 0;
    char.dados_vida_usados = Math.max(0, (char.dados_vida_usados || 0) - Math.floor(char.nivel / 2));
    // Restaurar espaços de magia
    if (char.espacos_magia) {
      Object.keys(char.espacos_magia).forEach(k => {
        char.espacos_magia[k].usados = 0;
      });
    }
    salvar();
    toast('Descanso longo realizado! PV e espacos restaurados', 'success');
    renderFichaCompleta();
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
          <label class="form-label">${c.label}</label>
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
        <label class="form-label">Nome</label>
        <input type="text" class="form-input" id="edit-nome" value="${char.nome}">
      </div>
      <div class="row gap-1">
        <div class="col">
          <label class="form-label">Nivel</label>
          <input type="number" class="form-input" id="edit-nivel" value="${char.nivel}" min="1" max="20">
        </div>
        <div class="col">
          <label class="form-label">Subclasse</label>
          <select class="form-input" id="edit-sub">
            <option value="">-- Nenhuma --</option>
            ${(classeData?.subclasses || [])
              .map(sc => sc.nome)
              .filter(nome => !nome.toLowerCase().startsWith('subclasses de'))
              .map(nome => `<option value="${nome}" ${char.subclasse === nome ? 'selected' : ''}>${nome}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="section-divider mt-2"><span>Atributos</span></div>
      <div class="atributos-grid">
        ${ATRIBUTOS_KEYS.map(key => `
          <div class="form-group" style="text-align:center">
            <label class="form-label">${ATRIBUTOS_NOMES[key]}</label>
            <input type="number" class="form-input" style="text-align:center;font-weight:700" id="edit-attr-${key}" value="${char.atributos[key]}" min="1" max="30">
          </div>
        `).join('')}
      </div>
    `, '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-primary" id="btn-salvar-edit">Salvar</button>');

    document.getElementById('btn-salvar-edit')?.addEventListener('click', () => {
      char.nome = document.getElementById('edit-nome')?.value?.trim() || char.nome;
      const novoNivel = parseInt(document.getElementById('edit-nivel')?.value) || char.nivel;
      char.subclasse = document.getElementById('edit-sub')?.value?.trim() || '';

      // Se mudou de nível, recalcular
      if (novoNivel !== char.nivel) {
        char.nivel = novoNivel;
        char.dados_vida_total = novoNivel;
        const info = CLASSES_INFO[char.classe];
        if (info) {
          const modCon = calcMod(char.atributos.constituicao);
          char.pv_max = calcPVTotal(info.dado_vida, novoNivel, modCon);
          char.pv_atual = Math.min(char.pv_atual, char.pv_max);
        }
        // Recalcular espaços de magia
        if (info?.conjurador && classeData?.tabela_caracteristicas) {
          char.espacos_magia = getEspacosMagia(classeData.tabela_caracteristicas, novoNivel);
        }
      }

      ATRIBUTOS_KEYS.forEach(key => {
        const val = parseInt(document.getElementById(`edit-attr-${key}`)?.value);
        if (val) char.atributos[key] = val;
      });

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
        <label class="form-label">XP Atual</label>
        <input type="number" class="form-input" id="edit-xp-atual" value="${char.xp || 0}" min="0">
        <div style="font-size:0.8rem;color:var(--text-muted);margin-top:4px">
          Nivel Atual: ${char.nivel}${char.nivel < 20 ? ` | Próximo Nivel (${char.nivel + 1}): ${XP_POR_NIVEL[char.nivel + 1]} XP` : ' (Máximo)'}
        </div>
      </div>
      <div class="section-divider mt-2"><span>Adicionar XP</span></div>
      <div class="form-group">
        <label class="form-label">Ganhar XP</label>
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
            <div style="font-size:0.85rem;margin-top:2px">${f.descricao}</div>
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
                  ${featsNivel3.map(f => `<div style="margin-top:4px"><strong>${f.nome}:</strong> ${f.descricao.length > 120 ? f.descricao.substring(0, 120) + '…' : f.descricao}</div>`).join('')}
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
            <label class="form-label">${ATRIBUTOS_NOMES[key]}</label>
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
                <div style="margin-top:2px">${f.descricao}</div>
              </div>
            `).join('')}
          `;
          detalheEl.style.display = 'block';
        }
      });
    });
  }
  
  // Validação de pontos de atributo
  if (ganhaAumentoAtributo) {
    const selects = ATRIBUTOS_KEYS.map(key => document.getElementById(`levelup-attr-${key}`));
    selects.forEach(sel => {
      sel?.addEventListener('change', () => {
        const total = selects.reduce((sum, s) => sum + (parseInt(s?.value) || 0), 0);
        document.getElementById('levelup-pontos-total').textContent = total;
        document.getElementById('levelup-pontos-total').style.color = total === 2 ? 'var(--success)' : (total > 2 ? 'var(--danger)' : 'inherit');
      });
    });
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
    
    // Executar level up
    const resultado = await subirDeNivel(char, opcoes);
    
    if (resultado.sucesso) {
      salvar();
      window.fecharModal();
      
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
            ${(resultado.magias_dominio_adicionadas || []).length > 0 ? `<li>🔮 Magias de domínio adicionadas: ${resultado.magias_dominio_adicionadas.map(m => m.nome).join(', ')}</li>` : ''}
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
  return `
    <div class="card">
      <div class="card-header"><h2>Talentos</h2></div>
      ${char.talentos.map(t => `
        <div style="padding:6px 0;border-bottom:1px solid var(--border-light)">
          <strong style="font-size:0.9rem">${t}</strong>
        </div>
      `).join('')}
    </div>
  `;
}

// --- Características de Classe ---
function renderSecaoCaracteristicas() {
  if (!classeData?.caracteristicas?.length) return '';
  const feats = classeData.caracteristicas.filter(c => c.nivel <= char.nivel);
  if (!feats.length) return '';

  return `
    <div class="card print-break-before">
      <div class="card-header"><h2>Caracteristicas de Classe</h2></div>
      ${feats.map(f => `
        <details style="margin-bottom:6px">
          <summary style="font-weight:600;cursor:pointer;font-size:0.9rem">
            <span class="badge badge-secondary" style="margin-right:4px">Nv.${f.nivel}</span>
            ${f.nome}
          </summary>
          <div class="md-content" style="padding:6px 0 6px 16px;font-size:0.85rem">${mdParaHtml(f.descricao)}</div>
        </details>
      `).join('')}
    </div>
  `;
}

// --- Magias ---

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
  const truques = (char.magias_conhecidas || []).filter(m => m.circulo === 0);
  const preparadas = char.magias_preparadas || [];
  const espacos = char.espacos_magia || {};

  return `
    <div class="card print-break-before">
      <div class="card-header">
        <h2>Magias</h2>
        <div class="no-print" style="display:flex;gap:4px">
          <button class="btn btn-sm btn-accent" id="btn-add-magia">+ Magia</button>
          <button class="btn btn-sm btn-secondary" id="btn-add-magia-custom">+ Custom</button>
        </div>
      </div>

      <!-- Espaços de magia -->
      ${Object.keys(espacos).length > 0 ? `
        <div style="margin-bottom:12px">
          ${Object.entries(espacos).map(([circ, data]) => `
            <div class="slots-grupo">
              <label>${circ}&ordm; Circulo</label>
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

      <!-- Truques -->
      ${truques.length > 0 ? `
        <div class="section-divider"><span>Truques</span></div>
        ${truques.map(m => `
          <div class="magia-item" data-magia-nome="${m.nome}" data-magia-circ="0">
            <div class="magia-nome">${m.nome}</div>
            ${badgesMagiaRapidos(m.nome)}
            <div class="magia-desc"></div>
          </div>
        `).join('')}
      ` : ''}

      <!-- Magias Preparadas -->
      ${preparadas.length > 0 ? `
        <div class="section-divider"><span>Magias Preparadas</span></div>
        ${preparadas.map(m => `
          <div class="magia-item preparada" data-magia-nome="${m.nome}" data-magia-circ="${m.circulo}">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <div>
                <div class="magia-nome">${m.nome}</div>
                ${badgesMagiaRapidos(m.nome)}
              </div>
              <button class="btn btn-sm btn-primary no-print" data-conjurar="${m.nome}" data-conj-circ="${m.circulo}">Conjurar</button>
            </div>
            <div class="magia-desc"></div>
          </div>
        `).join('')}
      ` : ''}

      <!-- Magias customizadas -->
      ${(char.magias_customizadas || []).length > 0 ? `
        <div class="section-divider"><span>Magias Customizadas</span></div>
        ${char.magias_customizadas.map((m, i) => `
          <div class="magia-item">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <div>
                <div class="magia-nome">${m.nome}</div>
                <div class="magia-meta">
                  <span>${m.circulo === 0 ? 'Truque' : m.circulo + 'o Circulo'}</span>
                  <span>${m.escola || ''}</span>
                </div>
              </div>
              <button class="btn btn-sm btn-danger btn-icon no-print" data-remover-magia-custom="${i}">&times;</button>
            </div>
            <div class="magia-desc" style="display:block">${mdParaHtml(m.descricao || '')}</div>
          </div>
        `).join('')}
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
      const circ = btn.dataset.conjCirc;
      if (!char.espacos_magia[circ]) return;
      if (char.espacos_magia[circ].usados >= char.espacos_magia[circ].total) {
        toast(`Sem espacos de ${circ}o circulo!`, 'error');
        return;
      }
      char.espacos_magia[circ].usados++;
      salvar();
      toast(`${btn.dataset.conjurar} conjurada!`, 'success');
      renderFichaCompleta();
    });
  });

  // Expandir detalhes da magia ao clicar
  document.querySelectorAll('.magia-item[data-magia-nome]').forEach(item => {
    item.addEventListener('click', async (e) => {
      if (e.target.closest('button')) return;
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
}

async function mostrarBuscaMagia() {
  const indice = await getIndiceMagias();
  const magias = indice?.magias || [];

  abrirModal('Adicionar Magia', `
    <div class="search-box"><input type="text" id="busca-magia-add" placeholder="Buscar magia..." class="form-input" autofocus></div>
    <div style="display:flex;gap:4px;margin-bottom:8px;flex-wrap:wrap">
      <label class="form-check"><input type="radio" name="tipo-magia" value="preparada" checked> Preparada</label>
      <label class="form-check"><input type="radio" name="tipo-magia" value="conhecida"> Conhecida (truque)</label>
    </div>
    <div id="resultado-magias" style="max-height:50vh;overflow-y:auto"></div>
  `);

  const resultadoEl = document.getElementById('resultado-magias');
  document.getElementById('busca-magia-add')?.addEventListener('input', (e) => {
    const termo = semAcento(e.target.value);
    if (termo.length < 2) { resultadoEl.innerHTML = ''; return; }
    const matches = magias.filter(m => semAcento(m.nome).includes(termo)).slice(0, 20);
    resultadoEl.innerHTML = matches.map(m => `
      <div class="magia-item" style="cursor:pointer" data-add-nome="${m.nome}" data-add-circ="${m.circulo}">
        <div class="magia-nome">${m.nome}</div>
        <div class="magia-meta">
          <span>${m.circulo === 0 ? 'Truque' : m.circulo + 'o Circulo'}</span>
          <span>${m.escola}</span>
          <span>${(m.classes || []).join(', ')}</span>
        </div>
      </div>
    `).join('');

    resultadoEl.querySelectorAll('[data-add-nome]').forEach(el => {
      el.addEventListener('click', () => {
        const nome = el.dataset.addNome;
        const circ = parseInt(el.dataset.addCirc);
        const tipo = document.querySelector('[name="tipo-magia"]:checked')?.value;
        if (tipo === 'conhecida' || circ === 0) {
          if (!char.magias_conhecidas.find(m => m.nome === nome)) {
            char.magias_conhecidas.push({ nome, circulo: circ });
          }
        } else {
          if (!char.magias_preparadas.find(m => m.nome === nome)) {
            char.magias_preparadas.push({ nome, circulo: circ });
          }
        }
        salvar();
        window.fecharModal();
        renderFichaCompleta();
        toast(`${nome} adicionada!`, 'success');
      });
    });
  });
}

function mostrarFormMagiaCustom() {
  abrirModal('Magia Customizada', `
    <div class="form-group">
      <label class="form-label">Nome</label>
      <input type="text" class="form-input" id="mc-nome" placeholder="Nome da magia">
    </div>
    <div class="row gap-1">
      <div class="col">
        <label class="form-label">Circulo</label>
        <select class="form-select" id="mc-circulo">
          <option value="0">Truque</option>
          ${[1,2,3,4,5,6,7,8,9].map(i => `<option value="${i}">${i}o Circulo</option>`).join('')}
        </select>
      </div>
      <div class="col">
        <label class="form-label">Escola</label>
        <input type="text" class="form-input" id="mc-escola" placeholder="Ex: Evocacao">
      </div>
    </div>
    <div class="row gap-1">
      <div class="col"><label class="form-label">Tempo de Conjuracao</label><input type="text" class="form-input" id="mc-tempo" value="Acao"></div>
      <div class="col"><label class="form-label">Alcance</label><input type="text" class="form-input" id="mc-alcance" value="9 metros"></div>
    </div>
    <div class="row gap-1">
      <div class="col"><label class="form-label">Componentes</label><input type="text" class="form-input" id="mc-comp" value="V, S"></div>
      <div class="col"><label class="form-label">Duracao</label><input type="text" class="form-input" id="mc-duracao" value="Instantanea"></div>
    </div>
    <div class="form-group">
      <label class="form-label">Descricao</label>
      <textarea class="form-textarea" id="mc-desc" rows="4" placeholder="Descricao da magia..."></textarea>
    </div>
    <div class="form-group">
      <label class="form-label">Dano / Efeito</label>
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

  // Separar equipados e não equipados
  const equipados = [];
  const naoEquipados = [];
  inv.forEach((item, idx) => {
    if (item.equipado) equipados.push(idx);
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
          : renderSheetInvLista(equipados, naoEquipados)
        }
      </div>
    </div>
  `;
}

/** Renderiza a lista do inventário separada por seções */
function renderSheetInvLista(equipados, naoEquipados) {
  let html = '';

  if (equipados.length > 0) {
    html += '<div class="inv-secao-titulo"><span>Equipados</span></div>';
    html += equipados.map(idx => renderSheetInvItem(char.inventario[idx], idx)).join('');
  }

  if (naoEquipados.length > 0) {
    html += '<div class="inv-secao-titulo"><span>Mochila</span></div>';
    html += naoEquipados.map(idx => renderSheetInvItem(char.inventario[idx], idx)).join('');
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

  return `
    <div class="inv-item ${item.equipado ? 'inv-item-equipado' : ''}" data-idx="${idx}" draggable="true">
      <div class="inv-drag-handle no-print" title="Arrastar para reordenar">&#9776;</div>
      <div style="flex:1;cursor:pointer" data-info-inv-sheet="${idx}" title="Ver detalhes">
        <div class="inv-item-nome">
          ${item.nome} ${profBadge} ${ataqueInfo}
          ${item.quantidade > 1 ? `<span style="color:var(--text-muted)">(x${item.quantidade})</span>` : ''}
        </div>
        <div class="inv-item-detalhe">
          ${item.tipo === 'arma' ? `${item.dados?.dano || ''} | ${item.dados?.propriedades || ''}` : ''}
          ${item.tipo === 'armadura' ? `CA: ${item.dados?.ca || ''} | ${item.dados?.categoria || ''}` : ''}
          ${item.tipo === 'escudo' ? `CA: ${item.dados?.ca || ''} | Escudo` : ''}
          ${item.tipo === 'equipamento' ? `${item.dados?.custo || ''} ${item.dados?.peso ? '| ' + item.dados.peso : ''}` : ''}
          ${item.tipo === 'customizado' ? `${item.descricao || ''}` : ''}
          ${item.tipo === 'generico' ? `${item.descricao || ''}` : ''}
        </div>
      </div>
      <div class="inv-item-acoes no-print">
        <button class="btn btn-sm btn-icon inv-btn-mover" data-sheet-move="${idx}" data-dir="up" title="Mover para cima">&uarr;</button>
        <button class="btn btn-sm btn-icon inv-btn-mover" data-sheet-move="${idx}" data-dir="down" title="Mover para baixo">&darr;</button>
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

  // Equipar/desequipar (re-renderiza para reorganizar seções)
  document.querySelectorAll('[data-sheet-equip]').forEach(cb => {
    cb.addEventListener('change', () => {
      const idx = parseInt(cb.dataset.sheetEquip);
      if (char.inventario[idx]) {
        char.inventario[idx].equipado = cb.checked;
        salvar();
        reRenderSheetInv();
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

  // Mover item para cima/baixo
  document.querySelectorAll('[data-sheet-move]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.sheetMove);
      const dir = btn.dataset.dir;
      const inv = char.inventario;

      if (dir === 'up' && idx > 0) {
        [inv[idx], inv[idx - 1]] = [inv[idx - 1], inv[idx]];
      } else if (dir === 'down' && idx < inv.length - 1) {
        [inv[idx], inv[idx + 1]] = [inv[idx + 1], inv[idx]];
      }
      salvar();
      reRenderSheetInv();
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
      <div class="form-group"><label class="form-label">Nome</label><input type="text" class="form-input" id="ic-nome"></div>
      <div class="form-group"><label class="form-label">Descricao</label><textarea class="form-textarea" id="ic-desc" rows="2"></textarea></div>
      <div class="row gap-1">
        <div class="col"><label class="form-label">Bonus CA</label><input type="number" class="form-input" id="ic-ca" value="0"></div>
        <div class="col"><label class="form-label">Dano</label><input type="text" class="form-input" id="ic-dano" placeholder="1d8 Cortante"></div>
        <div class="col"><label class="form-label">Bonus Atq</label><input type="number" class="form-input" id="ic-atq" value="0"></div>
      </div>
    `, '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-primary" id="btn-add-ic">Adicionar</button>');

    document.getElementById('btn-add-ic')?.addEventListener('click', () => {
      const nome = document.getElementById('ic-nome')?.value?.trim();
      if (!nome) { toast('Informe um nome', 'error'); return; }
      char.inventario.push({
        nome,
        tipo: 'customizado',
        quantidade: 1,
        equipado: false,
        descricao: document.getElementById('ic-desc')?.value || '',
        dados: {
          bonus_ca: document.getElementById('ic-ca')?.value || '0',
          dano: document.getElementById('ic-dano')?.value || '',
          bonus_ataque: document.getElementById('ic-atq')?.value || '0'
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
      <div class="form-group"><label class="form-label">PO</label><input type="number" class="form-input" id="edit-po" value="${char.po || 0}" min="0"></div>
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
  inv.forEach((item, idx) => {
    if (item.equipado) equipados.push(idx);
    else naoEquipados.push(idx);
  });

  invEl.innerHTML = inv.length === 0
    ? '<div style="color:var(--text-muted);text-align:center;padding:12px;font-size:0.85rem">Inventario vazio</div>'
    : renderSheetInvLista(equipados, naoEquipados);

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
    equipAvent: equipData?.itens || []
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
  } else {
    const d = item.dados || {};
    if (d.custo || d.peso) {
      corpo += `<div style="font-size:0.85rem"><strong>Custo:</strong> ${d.custo || '—'} | <strong>Peso:</strong> ${d.peso || '—'}</div>`;
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
  const ITENS_MUNICAO = ['Flechas', 'Virotes', 'Balas de Funda', 'Balas de Arma de Fogo', 'Dardos'];

  const consumiveis = dados.equipAvent.filter(i => ITENS_CONSUMIVEIS.some(c => i.nome.includes(c)));
  const municao = dados.equipAvent.filter(i => ITENS_MUNICAO.some(c => i.nome.includes(c)));
  const outrosEquip = dados.equipAvent.filter(i =>
    !ITENS_CONSUMIVEIS.some(c => i.nome.includes(c)) &&
    !ITENS_MUNICAO.some(c => i.nome.includes(c))
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
          badge: '', badgeCat: '',
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

    // Eventos de seleção
    listaEl.querySelectorAll('[data-add-cat]').forEach(el => {
      el.addEventListener('click', () => {
        const item = itens[parseInt(el.dataset.addCat)];
        if (!item) return;

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
