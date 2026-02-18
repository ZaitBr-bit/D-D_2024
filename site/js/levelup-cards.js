// ============================================================
// Renderização de Cards do Level Up - Steps dinâmicos
// Fase 3: Render de cards
// ============================================================
import { CLASSES_INFO, ATRIBUTOS_KEYS, ATRIBUTOS_NOMES, ATRIBUTO_NOME_PARA_KEY } from './dados-classes.js';
import { getMagiasClasse, getMagiasPorCirculo } from './db.js';
import { calcMod, bonusProficiencia, mdParaHtml, semAcento, toast, abrirModal } from './utils.js';

// ============================================================
// CARD: Ganhos do Nível
// ============================================================
export function renderCardGanhosNivel(ctx, state) {
  const { info, nivelNovo, modCon, hpGanhoFixo, caracteristicas, caracteristicasEspecie,
          caracteristicasSubclasse, magiasDominioNivel, bonusNovo, bonusMudou, char } = ctx;

  let html = '';

  // Card de PV
  html += `
    <div class="levelup-card">
      <div class="levelup-card-header">Pontos de Vida</div>
      <div class="levelup-card-body">
        <div style="display:flex;flex-direction:column;gap:8px;font-size:0.9rem">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
            <input type="radio" name="levelup-hp-modo" value="fixo" ${state.hpModo === 'fixo' ? 'checked' : ''}>
            <span>Valor fixo: <strong>+${hpGanhoFixo} PV</strong> (média do d${info.dado_vida} + CON)</span>
          </label>
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;flex-wrap:wrap">
            <input type="radio" name="levelup-hp-modo" value="rolado" ${state.hpModo === 'rolado' ? 'checked' : ''}>
            <span>Rolagem: d${info.dado_vida} + CON</span>
            <input type="number" class="form-input" id="levelup-hp-rolado" min="1" max="${info.dado_vida}" step="1"
                   value="${state.hpRolado}" style="width:88px" ${state.hpModo !== 'rolado' ? 'disabled' : ''}>
            <span id="levelup-hp-previa-rolado" style="font-size:0.85rem;color:var(--text-muted)">
              = +${Math.max(1, state.hpRolado + modCon)} PV
            </span>
          </label>
        </div>
      </div>
    </div>
  `;

  // Card de ganhos automáticos
  html += `
    <div class="levelup-card">
      <div class="levelup-card-header">Ganhos Automáticos</div>
      <div class="levelup-card-body">
        <ul class="levelup-list">
          ${bonusMudou ? `<li><strong>Bônus de Proficiência:</strong> +${bonusNovo}</li>` : ''}
          ${caracteristicas.length > 0 ? caracteristicas.map(c => `<li>${c}</li>`).join('') : '<li style="color:var(--text-muted)">Nenhuma característica nova neste nível</li>'}
          ${caracteristicasEspecie.map(c => `<li><span class="badge badge-sm">Espécie</span> ${c.nome}</li>`).join('')}
        </ul>
      </div>
    </div>
  `;

  // Card de características de subclasse
  if (caracteristicasSubclasse.length > 0) {
    html += `
      <div class="levelup-card">
        <div class="levelup-card-header">Subclasse — ${char.subclasse}</div>
        <div class="levelup-card-body">
          ${caracteristicasSubclasse.map(f => `
            <div style="margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid var(--border-light)">
              <div style="font-weight:600;font-size:0.9rem">${f.nome}</div>
              <div class="md-content" style="font-size:0.85rem;margin-top:2px">${mdParaHtml(f.descricao)}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // Card de magias de domínio
  if (magiasDominioNivel.length > 0) {
    html += `
      <div class="levelup-card">
        <div class="levelup-card-header">Magias de Domínio — Automáticas</div>
        <div class="levelup-card-body">
          <ul class="levelup-list">
            ${magiasDominioNivel.map(m => `<li><strong>${m.nome}</strong> (${m.circulo}º círculo)</li>`).join('')}
          </ul>
          <div style="font-size:0.8rem;color:var(--text-muted);margin-top:8px">
            Sempre preparadas, não contam no limite.
          </div>
        </div>
      </div>
    `;
  }

  return html;
}

// ============================================================
// CARD: Escolha de Subclasse
// ============================================================
export function renderCardSubclasse(ctx, state) {
  const { subclassesDisponiveis } = ctx;
  if (!subclassesDisponiveis.length) return '';

  return `
    <div class="levelup-card">
      <div class="levelup-card-header" style="color:var(--warning)">Escolha de Subclasse (Obrigatória)</div>
      <div class="levelup-card-body">
        <input type="hidden" id="levelup-subclasse" value="${state.subclasse || ''}">
        <div id="levelup-subclasses-lista" style="display:flex;flex-direction:column;gap:8px">
          ${subclassesDisponiveis.map((sc, idx) => {
            const featsNivel3 = (sc.caracteristicas || []).filter(c => c.nivel === 3);
            const selecionada = state.subclasse === sc.nome;
            return `
              <div class="levelup-subclasse-card ${selecionada ? 'selecionada' : ''}" data-subclasse="${sc.nome}" data-idx="${idx}">
                <div style="font-weight:700;font-size:1rem;margin-bottom:4px">${sc.nome}</div>
                <div style="font-size:0.82rem;color:var(--text-muted)">
                  ${featsNivel3.map(f => {
                    const descPlain = f.descricao.replace(/\|[^|]*\|/g, '').replace(/\*\*/g, '').trim();
                    const preview = descPlain.length > 120 ? descPlain.substring(0, 120) + '...' : descPlain;
                    return `<div style="margin-top:4px"><strong>${f.nome}:</strong> ${preview}</div>`;
                  }).join('')}
                </div>
              </div>
            `;
          }).join('')}
        </div>
        <div id="levelup-subclasse-detalhe" style="margin-top:12px;display:${state.subclasse ? 'block' : 'none'};background:var(--surface-variant);border-radius:8px;padding:12px;font-size:0.85rem"></div>
      </div>
    </div>
  `;
}

// ============================================================
// CARD: Aumento de Atributo / Talento
// ============================================================
export function renderCardASI(ctx, state, talentosCache) {
  const { char } = ctx;

  // Montar lista de talentos disponíveis
  const talentosDisponiveis = [];
  if (talentosCache?.por_categoria) {
    Object.values(talentosCache.por_categoria).forEach(lista => {
      lista.forEach(t => {
        const preq = (t.prerequisito || '').toLowerCase();
        const ehNivel4 = preq.includes('nível 4') || preq.includes('nivel 4');
        const ehOrigem = t.categoria === 'de Origem';
        if (ehNivel4 || ehOrigem) {
          if (t.nome === 'Aumento no Valor de Atributo') return;
          const jaTem = (char.talentos || []).some(ct => (typeof ct === 'string' ? ct : ct.nome) === t.nome);
          const repetivel = (t.beneficios || []).some(b => b.nome === 'Repetível');
          if (jaTem && !repetivel) return;
          talentosDisponiveis.push(t);
        }
      });
    });
  }
  talentosDisponiveis.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  // Agrupar por categoria
  const porCat = {};
  talentosDisponiveis.forEach(t => {
    const cat = t.categoria || 'Outros';
    if (!porCat[cat]) porCat[cat] = [];
    porCat[cat].push(t);
  });

  return `
    <div class="levelup-card">
      <div class="levelup-card-header">Aumento de Atributo ou Talento</div>
      <div class="levelup-card-body">
        <div style="display:flex;gap:12px;margin-bottom:10px">
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:0.9rem">
            <input type="radio" name="levelup-asi-modo" value="atributo" ${state.asiModo === 'atributo' ? 'checked' : ''}> Aumentar Atributos
          </label>
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:0.9rem">
            <input type="radio" name="levelup-asi-modo" value="talento" ${state.asiModo === 'talento' ? 'checked' : ''}> Escolher Talento
          </label>
        </div>

        <div id="levelup-asi-atributos" style="display:${state.asiModo === 'atributo' ? 'block' : 'none'}">
          <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:8px">
            Aumente um atributo em +2, ou dois em +1 cada (máximo 20).
          </div>
          <div class="atributos-grid">
            ${ATRIBUTOS_KEYS.map(key => `
              <div class="form-group" style="text-align:center">
                <label class="form-label" for="levelup-attr-${key}">${ATRIBUTOS_NOMES[key]}</label>
                <div style="font-size:0.8rem;margin-bottom:2px">${char.atributos[key]}</div>
                <select class="form-input" style="text-align:center" id="levelup-attr-${key}">
                  <option value="0" ${(state.aumentos[key] || 0) === 0 ? 'selected' : ''}>+0</option>
                  <option value="1" ${(state.aumentos[key] || 0) === 1 ? 'selected' : ''}>+1</option>
                  <option value="2" ${(state.aumentos[key] || 0) === 2 ? 'selected' : ''}>+2</option>
                </select>
              </div>
            `).join('')}
          </div>
          <div style="font-size:0.8rem;color:var(--text-muted);margin-top:8px;text-align:center">
            Total de pontos: <span id="levelup-pontos-total" style="font-weight:700">${state.pontosDistribuidos}</span> / 2
          </div>
        </div>

        <div id="levelup-asi-talento" style="display:${state.asiModo === 'talento' ? 'block' : 'none'}">
          <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:8px">
            Escolha um talento em vez de aumentar atributos.
          </div>
          <select id="levelup-talento-select" class="form-input" style="width:100%;margin-bottom:8px">
            <option value="">-- Selecione um talento --</option>
            ${Object.entries(porCat).map(([cat, lista]) => `
              <optgroup label="${cat}">
                ${lista.map(t => `<option value="${t.nome}" ${state.talento === t.nome ? 'selected' : ''}>${t.nome}</option>`).join('')}
              </optgroup>
            `).join('')}
          </select>
          <div id="levelup-talento-detalhe" style="background:var(--surface-variant);border-radius:8px;padding:12px;font-size:0.85rem;display:none"></div>
          <div id="levelup-talento-escolhas"></div>
        </div>
      </div>
    </div>
  `;
}

// ============================================================
// CARD: Escolhas de Classe (Expertise, Estilo de Luta, etc.)
// ============================================================
export function renderCardEscolhasClasse(ctx, state) {
  const { char, precisaExpertiseBardo, precisaExpertiseGuardiao, precisaEstiloLuta, precisaExploradorHabil, precisaAcademico } = ctx;
  let html = '';

  // Especialização do Bardo
  if (precisaExpertiseBardo) {
    const proficientes = char.pericias_proficientes || [];
    const expertiseAtual = new Set(char.pericias_expertise || []);
    const elegiveis = proficientes.filter(p => !expertiseAtual.has(p));
    html += `
      <div class="levelup-card">
        <div class="levelup-card-header">Especialização do Bardo</div>
        <div class="levelup-card-body">
          <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:8px">
            Selecione 2 perícias proficientes para Especialização.
          </div>
          <div id="levelup-bardo-expertise" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:6px">
            ${elegiveis.map(p => `
              <label class="form-check levelup-check-label">
                <input type="checkbox" data-bardo-expertise="${p}" ${state.bardoExpertise.includes(p) ? 'checked' : ''}> ${p}
              </label>
            `).join('')}
          </div>
          <div class="levelup-counter">
            Selecionadas: <span id="levelup-bardo-expertise-count" style="font-weight:700">${state.bardoExpertise.length}</span>/2
          </div>
        </div>
      </div>
    `;
  }

  // Especialista do Guardião
  if (precisaExpertiseGuardiao) {
    const proficientes = char.pericias_proficientes || [];
    const expertiseAtual = new Set(char.pericias_expertise || []);
    const elegiveis = proficientes.filter(p => !expertiseAtual.has(p));
    html += `
      <div class="levelup-card">
        <div class="levelup-card-header">Especialista do Guardião</div>
        <div class="levelup-card-body">
          <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:8px">
            Selecione 2 perícias proficientes para Especialização.
          </div>
          <div id="levelup-guardiao-expertise" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:6px">
            ${elegiveis.map(p => `
              <label class="form-check levelup-check-label">
                <input type="checkbox" data-guardiao-expertise="${p}" ${state.guardiaoExpertise.includes(p) ? 'checked' : ''}> ${p}
              </label>
            `).join('')}
          </div>
          <div class="levelup-counter">
            Selecionadas: <span id="levelup-guardiao-expertise-count" style="font-weight:700">${state.guardiaoExpertise.length}</span>/2
          </div>
        </div>
      </div>
    `;
  }

  // Estilo de Luta
  if (precisaEstiloLuta) {
    const opcoesBase = [
      { nome: 'Arquearia', descricao: '+2 em ataques à distância com armas' },
      { nome: 'Arremesso', descricao: '+2 de dano com armas de Arremesso' },
      { nome: 'Armas Grandes', descricao: 'Trata 1-2 como 3 nos dados de dano (duas mãos)' },
      { nome: 'Duas Armas', descricao: 'Adiciona mod. ao dano da mão secundária' },
      { nome: 'Desarmado', descricao: 'Dano desarmado d6/d8+For' },
      { nome: 'Defensivo', descricao: '+1 CA usando armadura' },
      { nome: 'Duelismo', descricao: '+2 dano com uma arma em uma mão' },
      { nome: 'Interceptação', descricao: 'Reduz dano a aliado em 1d10+Prof' },
      { nome: 'Luta às Cegas', descricao: 'Visão Cega 3m, 9m se cego' },
      { nome: 'Protetivo', descricao: 'Impõe desvantagem em ataques contra aliados' }
    ];
    if (char.classe === 'Guardião') opcoesBase.push({ nome: 'Combatente Druídico', descricao: 'Aprende 2 truques de Druida (Sabedoria)' });
    if (char.classe === 'Paladino') opcoesBase.push({ nome: 'Combatente Abençoado', descricao: 'Aprende 2 truques de Clérigo (Carisma)' });

    html += `
      <div class="levelup-card">
        <div class="levelup-card-header">Estilo de Luta</div>
        <div class="levelup-card-body">
          <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:8px">
            Escolha um Estilo de Luta. A escolha é permanente.
          </div>
          <div id="levelup-estilo-luta" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:6px">
            ${opcoesBase.map(opt => `
              <label class="form-check levelup-check-label" style="cursor:pointer">
                <input type="radio" name="estilo_luta" value="${opt.nome}" ${state.estiloLuta === opt.nome ? 'checked' : ''}>
                <div>
                  <div style="font-weight:600;font-size:0.85rem">${opt.nome}</div>
                  <div style="font-size:0.75rem;color:var(--text-muted)">${opt.descricao}</div>
                </div>
              </label>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  // Explorador Hábil
  if (precisaExploradorHabil) {
    const proficientes = char.pericias_proficientes || [];
    const expertiseAtual = new Set(char.pericias_expertise || []);
    const elegiveisExp = proficientes.filter(p => !expertiseAtual.has(p));
    const idiomasDisponiveis = [
      'Língua de Sinais Comum', 'Dracônico', 'Anão', 'Élfico',
      'Gigante', 'Gnômico', 'Goblin', 'Pequenino', 'Orc'
    ];
    const idiomasJaPossuidos = new Set(char.idiomas || []);
    const idiomasElegiveis = idiomasDisponiveis.filter(i => !idiomasJaPossuidos.has(i));

    html += `
      <div class="levelup-card">
        <div class="levelup-card-header">Explorador Hábil</div>
        <div class="levelup-card-body">
          <div style="font-weight:600;font-size:0.85rem;margin-bottom:4px">Especialização (1 perícia):</div>
          <div id="levelup-explorador-expertise" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:6px;margin-bottom:12px">
            ${elegiveisExp.map(p => `
              <label class="form-check levelup-check-label" style="cursor:pointer">
                <input type="radio" name="explorador_expertise" value="${p}" ${state.exploradorExpertise === p ? 'checked' : ''}> ${p}
              </label>
            `).join('')}
          </div>
          <div style="font-weight:600;font-size:0.85rem;margin-bottom:4px">Idiomas (2):</div>
          <div id="levelup-explorador-idiomas" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:6px">
            ${idiomasElegiveis.map(i => `
              <label class="form-check levelup-check-label" style="cursor:pointer">
                <input type="checkbox" data-explorador-idioma="${i}" ${state.exploradorIdiomas.includes(i) ? 'checked' : ''}> ${i}
              </label>
            `).join('')}
          </div>
          <div class="levelup-counter">
            Idiomas: <span id="levelup-explorador-idiomas-count" style="font-weight:700">${state.exploradorIdiomas.length}</span>/2
          </div>
        </div>
      </div>
    `;
  }

  // Acadêmico
  if (precisaAcademico) {
    const periciasAcademicas = ['Arcanismo', 'História', 'Investigação', 'Medicina', 'Natureza', 'Religião'];
    const expertiseAtual = new Set(char.pericias_expertise || []);
    const elegiveisAc = periciasAcademicas.filter(p => !expertiseAtual.has(p));

    html += `
      <div class="levelup-card">
        <div class="levelup-card-header">Acadêmico</div>
        <div class="levelup-card-body">
          <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:8px">
            Selecione 2 perícias de conhecimento para Especialização.
          </div>
          <div id="levelup-academico" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:6px">
            ${elegiveisAc.map(p => `
              <label class="form-check levelup-check-label">
                <input type="checkbox" data-academico-expertise="${p}" ${state.academicoExpertise.includes(p) ? 'checked' : ''}> ${p}
              </label>
            `).join('')}
          </div>
          <div class="levelup-counter">
            Selecionadas: <span id="levelup-academico-count" style="font-weight:700">${state.academicoExpertise.length}</span>/2
          </div>
        </div>
      </div>
    `;
  }

  return html;
}

// ============================================================
// CARD: Seleção de Magias
// ============================================================
export function renderCardMagias(ctx, state) {
  const { char, conjuracao, info } = ctx;
  if (!conjuracao) return '';

  const { truquesGanhos, tipoConj, magiasGanhas, magiasNovo, magiasAtual, ehMago } = conjuracao;
  let html = '';

  // Truques
  if (truquesGanhos > 0) {
    html += `
      <div class="levelup-card">
        <div class="levelup-card-header">Novos Truques (+${truquesGanhos})</div>
        <div class="levelup-card-body">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
            <div id="lvlup-truques-resumo" style="font-size:0.85rem;color:var(--text-muted)">
              ${state.truquesSelecionados.length === 0
                ? `<span style="color:var(--danger)">Nenhum selecionado. Selecione ${truquesGanhos}.</span>`
                : `<span style="color:${state.truquesSelecionados.length === truquesGanhos ? 'var(--success)' : 'var(--warning-dark,orange)'}">${state.truquesSelecionados.length}/${truquesGanhos}</span>`
              }
            </div>
            <button class="btn btn-sm btn-accent" id="btn-lvlup-truques">Selecionar</button>
          </div>
          <div id="lvlup-truques-badges" style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">
            ${state.truquesSelecionados.map(n => `<span class="badge badge-accent" style="font-size:0.75rem">${n}</span>`).join('')}
          </div>
        </div>
      </div>
    `;
  }

  // Magias conhecidas (Bardo/Feiticeiro/Bruxo)
  if (tipoConj === 'conhecidas' && magiasGanhas > 0) {
    html += `
      <div class="levelup-card">
        <div class="levelup-card-header">Novas Magias Conhecidas (+${magiasGanhas})</div>
        <div class="levelup-card-body">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
            <div id="lvlup-magias-resumo" style="font-size:0.85rem;color:var(--text-muted)">
              ${state.magiasSelecionadas.length === 0
                ? `<span style="color:var(--danger)">Nenhuma selecionada. Selecione ${magiasGanhas}.</span>`
                : `<span style="color:${state.magiasSelecionadas.length === magiasGanhas ? 'var(--success)' : 'var(--warning-dark,orange)'}">${state.magiasSelecionadas.length}/${magiasGanhas}</span>`
              }
            </div>
            <button class="btn btn-sm btn-accent" id="btn-lvlup-magias">Selecionar</button>
          </div>
          <div id="lvlup-magias-badges" style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">
            ${state.magiasSelecionadas.map(n => `<span class="badge badge-accent" style="font-size:0.75rem">${n}</span>`).join('')}
          </div>
        </div>
      </div>
    `;
  }

  // Troca de magia (classes conhecidas)
  if (tipoConj === 'conhecidas') {
    const magiasAtuais = (char.magias_preparadas || []).filter(m => {
      const origensEspeciais = ['dominio', 'sempre', 'iniciado_em_magia', 'tocado_por_fadas', 'tocado_pelas_sombras', 'conjurador_ritualista'];
      return m.circulo > 0 && !origensEspeciais.includes(m?.origem);
    });
    if (magiasAtuais.length > 0) {
      html += `
        <div class="levelup-card">
          <div class="levelup-card-header">Trocar Magia (Opcional)</div>
          <div class="levelup-card-body">
            <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:8px">
              Troque 1 magia conhecida por outra da lista de ${char.classe}.
            </div>
            <select class="form-input" id="levelup-trocar-de" style="margin-bottom:8px">
              <option value="">Não trocar</option>
              ${magiasAtuais.map(m => `<option value="${m.nome}" ${state.trocarDe === m.nome ? 'selected' : ''}>${m.nome} (${m.circulo}º)</option>`).join('')}
            </select>
            <div id="levelup-trocar-para-container" style="display:${state.trocarDe ? 'block' : 'none'}">
              <div class="search-box"><input type="text" id="busca-troca-levelup" placeholder="Buscar substituta..." class="form-input"></div>
              <div id="resultado-troca-levelup" style="max-height:25vh;overflow-y:auto;margin-bottom:8px"></div>
              <div style="font-size:0.8rem;color:var(--text-muted)">
                Trocar por: <span id="levelup-trocar-para-nome" style="font-weight:700;color:var(--accent)">${state.trocarPara || '—'}</span>
                <input type="hidden" id="levelup-trocar-para" value="${state.trocarPara}">
                <input type="hidden" id="levelup-trocar-para-circ" value="${state.trocarParaCirculo}">
              </div>
            </div>
          </div>
        </div>
      `;
    }
  }

  // Grimório do Mago
  if (ehMago) {
    html += `
      <div class="levelup-card">
        <div class="levelup-card-header">Grimório: +2 Magias</div>
        <div class="levelup-card-body">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
            <div id="lvlup-grimorio-resumo" style="font-size:0.85rem;color:var(--text-muted)">
              ${state.grimorioSelecionados.length === 0
                ? '<span style="color:var(--danger)">Nenhuma selecionada. Selecione 2.</span>'
                : `<span style="color:${state.grimorioSelecionados.length === 2 ? 'var(--success)' : 'var(--warning-dark,orange)'}">${state.grimorioSelecionados.length}/2</span>`
              }
            </div>
            <button class="btn btn-sm btn-accent" id="btn-lvlup-grimorio">Selecionar</button>
          </div>
          <div id="lvlup-grimorio-badges" style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">
            ${state.grimorioSelecionados.map(n => `<span class="badge badge-accent" style="font-size:0.75rem">${n}</span>`).join('')}
          </div>
        </div>
      </div>
    `;
  }

  // Preparadas (informativo)
  if (tipoConj === 'preparadas' && char.classe !== 'Mago') {
    html += `
      <div class="levelup-card">
        <div class="levelup-card-header">Magias Preparadas</div>
        <div class="levelup-card-body">
          <div style="font-size:0.85rem;color:var(--text-muted)">
            <strong>${magiasAtual} &rarr; ${magiasNovo}</strong>.
            Troque magias preparadas durante um descanso longo.
          </div>
        </div>
      </div>
    `;
  }

  return html;
}

// ============================================================
// CARD: Revisão e Confirmação
// ============================================================
export function renderCardRevisao(ctx, state, steps) {
  const { nivelNovo, hpGanhoFixo, modCon, info, char } = ctx;
  const incompletos = steps.filter(s => s.obrigatorio && !s._completo && s.id !== 'revisao_confirmacao');

  // Calcular HP que será ganho
  const hpGanho = state.hpModo === 'rolado'
    ? Math.max(1, state.hpRolado + modCon)
    : hpGanhoFixo;

  let html = `
    <div class="levelup-card">
      <div class="levelup-card-header">Resumo da Subida para Nível ${nivelNovo}</div>
      <div class="levelup-card-body">
        <ul class="levelup-list">
          <li><strong>HP:</strong> +${hpGanho} PV (${state.hpModo === 'rolado' ? `rolagem ${state.hpRolado}` : 'fixo'})</li>
  `;

  if (state.subclasse) html += `<li><strong>Subclasse:</strong> ${state.subclasse}</li>`;

  if (ctx.ganhaASI) {
    if (state.asiModo === 'atributo' && state.pontosDistribuidos > 0) {
      const resumoAttr = Object.entries(state.aumentos)
        .filter(([, v]) => v > 0)
        .map(([k, v]) => `${ATRIBUTOS_NOMES[k]} +${v}`)
        .join(', ');
      html += `<li><strong>Atributos:</strong> ${resumoAttr || 'Nenhum'}</li>`;
    } else if (state.asiModo === 'talento' && state.talento) {
      html += `<li><strong>Talento:</strong> ${state.talento}</li>`;
    }
  }

  if (state.bardoExpertise.length > 0) html += `<li><strong>Especialização Bardo:</strong> ${state.bardoExpertise.join(', ')}</li>`;
  if (state.guardiaoExpertise.length > 0) html += `<li><strong>Especialista Guardião:</strong> ${state.guardiaoExpertise.join(', ')}</li>`;
  if (state.estiloLuta) html += `<li><strong>Estilo de Luta:</strong> ${state.estiloLuta}</li>`;
  if (state.exploradorExpertise) html += `<li><strong>Explorador Hábil:</strong> ${state.exploradorExpertise}, Idiomas: ${state.exploradorIdiomas.join(', ')}</li>`;
  if (state.academicoExpertise.length > 0) html += `<li><strong>Acadêmico:</strong> ${state.academicoExpertise.join(', ')}</li>`;
  if (state.truquesSelecionados.length > 0) html += `<li><strong>Truques:</strong> ${state.truquesSelecionados.join(', ')}</li>`;
  if (state.magiasSelecionadas.length > 0) html += `<li><strong>Magias:</strong> ${state.magiasSelecionadas.join(', ')}</li>`;
  if (state.grimorioSelecionados.length > 0) html += `<li><strong>Grimório:</strong> ${state.grimorioSelecionados.join(', ')}</li>`;
  if (state.trocarDe && state.trocarPara) html += `<li><strong>Troca:</strong> ${state.trocarDe} &rarr; ${state.trocarPara}</li>`;

  html += `</ul>`;

  if (incompletos.length > 0) {
    html += `
      <div style="margin-top:12px;padding:10px;background:var(--danger);color:#fff;border-radius:var(--radius-sm);font-size:0.85rem">
        <strong>Pendências:</strong>
        <ul style="margin:4px 0 0 16px">
          ${incompletos.map(s => `<li>${s.titulo}</li>`).join('')}
        </ul>
      </div>
    `;
  } else {
    html += `
      <div style="margin-top:12px;padding:10px;background:var(--success);color:#fff;border-radius:var(--radius-sm);font-size:0.85rem">
        Todas as escolhas estão completas. Pronto para confirmar!
      </div>
    `;
  }

  html += `</div></div>`;
  return html;
}

