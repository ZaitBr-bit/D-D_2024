// ============================================================
// Condicoes, defesas, sentidos e proficiencias
// Extraido de site/js/pages/sheet.js sem alteracao de comportamento.
// ============================================================
import { CLASSES_INFO } from '../dados-classes.js';
import { abrirModal, calcIntuicaoPassiva, calcInvestigacaoPassiva, calcPercepcaoPassiva, toast } from '../utils.js';
import { getEstadoFuria } from './classes/barbaro.js';
import { getEstadoRecursosGuardiao } from './classes/guardiao.js';
import { getEstadoRecursosPaladino } from './classes/paladino.js';
import { char, especiesCache, salvar } from './estado.js';
import { renderFichaCompleta } from './ficha.js';
import { getConcentracaoAtiva } from './magias.js';

// --- Proficiência de armas/armaduras na ficha ---

/** Verifica se o personagem tem proficiência com uma arma */
export function sheetTemProfArma(arma) {
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
export function sheetTemProfArmadura(armadura) {
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
export function sheetBadgeProf(proficiente) {
  return proficiente
    ? '<span class="badge badge-prof-sm">Prof</span>'
    : '<span class="badge badge-no-prof-sm">Sem Prof</span>';
}

// --- Constantes de condicoes do D&D 5.5 ---
const CONDICOES_DD = [
  { nome: 'Amedrontado', icone: '😨', cor: '#8e44ad' },
  { nome: 'Atordoado', icone: '💫', cor: '#e67e22' },
  { nome: 'Caído', icone: '🧎', cor: '#95a5a6' },
  { nome: 'Cego', icone: '🕶️', cor: '#2c3e50' },
  { nome: 'Contido', icone: '🔗', cor: '#7f8c8d' },
  { nome: 'Enfeitiçado', icone: '💜', cor: '#9b59b6' },
  { nome: 'Envenenado', icone: '🧪', cor: '#27ae60' },
  { nome: 'Exaustão', icone: '😴', cor: '#e74c3c' },
  { nome: 'Imobilizado', icone: '⛓️', cor: '#34495e' },
  { nome: 'Incapacitado', icone: '🚫', cor: '#c0392b' },
  { nome: 'Inconsciente', icone: '💤', cor: '#1a1a2e' },
  { nome: 'Invisível', icone: '👻', cor: '#3498db' },
  { nome: 'Paralisado', icone: '⚡', cor: '#f39c12' },
  { nome: 'Petrificado', icone: '🗿', cor: '#6c757d' },
  { nome: 'Surdo', icone: '🔇', cor: '#566573' }
];

// Descricoes oficiais baseadas no glossario do Livro do Jogador 2024
const CONDICOES_DESCRICAO = {
  'Amedrontado': 'Desvantagem em testes de atributo e jogadas de ataque enquanto a fonte do medo estiver na linha de visao. Nao pode se aproximar voluntariamente da fonte do medo.',
  'Atordoado': 'Incapacitado (sem acoes, bonus ou reacoes; sem Concentracao; sem fala). Falha automatica em salvaguardas de Forca e Destreza. Jogadas de ataque contra voce tem Vantagem.',
  'Caído': 'Unicas opcoes de movimento: rastejar ou gastar metade do Deslocamento para se levantar. Desvantagem em jogadas de ataque. Ataques contra voce tem Vantagem a 1,5m; caso contrario, tem Desvantagem.',
  'Cego': 'Nao pode ver. Falha automatica em testes que dependam de visao. Ataques contra voce tem Vantagem, seus ataques tem Desvantagem.',
  'Contido': 'Deslocamento 0 e nao pode aumentar. Ataques contra voce tem Vantagem, seus ataques tem Desvantagem. Desvantagem em salvaguardas de Destreza.',
  'Enfeitiçado': 'Nao pode atacar quem o enfeiticou nem o ter como alvo de ataques ou efeitos magicos. Quem o enfeiticou tem Vantagem em qualquer teste de atributo para interacoes sociais com voce.',
  'Envenenado': 'Desvantagem em jogadas de ataque e testes de atributo.',
  'Exaustão': 'Cumulativa (niveis 1-6). Testes de D20 reduzidos em 2x nivel. Deslocamento reduzido em 1,5m x nivel. Nivel 6 = morte. Descanso Longo remove 1 nivel.',
  'Imobilizado': 'Deslocamento 0 e nao pode aumentar. Desvantagem em jogadas de ataque contra qualquer alvo que nao seja o imobilizador. O imobilizador pode arrastar/carregar voce (custo +1m por metro).',
  'Incapacitado': 'Nao pode executar acoes, Acoes Bonus ou Reacoes. Concentracao interrompida. Nao pode falar. Desvantagem na Iniciativa se surpreso.',
  'Inconsciente': 'Caido e Incapacitado, solta tudo que segura. Deslocamento 0. Falha automatica em SG de For e Des. Ataques tem Vantagem; corpo a corpo a 1,5m e Acerto Critico. Alheio ao redor.',
  'Invisível': 'Nao e afetado por efeitos que exijam visao. Ataques contra voce tem Desvantagem, seus ataques tem Vantagem (exceto se o atacante puder ve-lo). Vantagem na Iniciativa.',
  'Paralisado': 'Incapacitado. Deslocamento 0. Falha automatica em SG de For e Des. Ataques contra voce tem Vantagem; corpo a corpo a 1,5m e Acerto Critico.',
  'Petrificado': 'Transformado em substancia solida. Incapacitado. Deslocamento 0. Peso x10, nao envelhece. Falha em SG de For e Des. Ataques contra voce tem Vantagem. Resistencia a todo dano. Imune a Envenenado.',
  'Surdo': 'Nao pode ouvir. Falha automatica em testes que dependam de audicao.'
};

// --- Tipos de dano do D&D ---
const TIPOS_DANO = [
  'Ácido', 'Contundente', 'Cortante', 'Elétrico', 'Energético',
  'Gélido', 'Ígneo', 'Necrótico', 'Perfurante', 'Psíquico',
  'Radiante', 'Trovejante', 'Venenoso'
];

/** Renderiza secao de condicoes ativas */
export function renderSecaoCondicoes() {
  const condicoes = char.condicoes || [];
  const temCondicao = condicoes.length > 0;

  // Verificar imunidades da Furia Irracional (Berserker 6+)
  const estadoFuriaImune = getEstadoFuria();
  const furiaIrracionalAtiva = estadoFuriaImune?.ativa && estadoFuriaImune?.furiaIrracional;

  // Verificar imunidades de Auras do Paladino
  const _epCondicoes = getEstadoRecursosPaladino();
  const auraCoragemImune = _epCondicoes?.auraCoragemAtiva && !furiaIrracionalAtiva;
  const auraDevocaoImune = _epCondicoes?.auraDevocaoAtiva && !furiaIrracionalAtiva;

  // Imunidades e efeitos de magias ativas
  const efMag = char.efeitos_magicos || [];
  const imunidadesMagia = efMag.filter(e => e.tipo === 'imunidade_condicao').map(e => ({ condicao: e.condicao, fonte: e.nome.replace(/ \(.*\)$/, '') }));
  const condicoesMagia = efMag.filter(e => e.tipo === 'condicao').map(e => ({ condicao: e.condicao, fonte: e.nome, rotulo: e.rotulo }));
  const efeitosAtivos = efMag.filter(e => ['penalidade_ataque_contra_mim', 'protecao_bem_e_mal', 'buff_d20', 'buff_arma', 'deslocamento', 'bonus_pericia', 'reflexos', 'dano_reativo', 'pv_temp_por_turno', 'buff_save_condicao', 'vantagem_sg_condicoes', 'desv_ataques_contra_mim', 'protecao_pv_max', 'penalidade_d20'].includes(e.tipo));
  // Deduplicar por nome base
  const efeitosVistos = new Set();
  const efeitosUnicos = efeitosAtivos.filter(e => { const base = e.nome.replace(/ \(.*\)$/, ''); if (efeitosVistos.has(base)) return false; efeitosVistos.add(base); return true; });

  return `
    <div class="card" style="${temCondicao ? 'border-color:var(--warning)' : ''}">
      <div class="card-header">
        <h2>Condicoes${temCondicao ? ` (${condicoes.length})` : ''}</h2>
        <button class="btn btn-sm btn-secondary no-print" id="btn-gerenciar-condicoes">Gerenciar</button>
      </div>
      ${(() => {
        const concAtiva = getConcentracaoAtiva();
        if (!concAtiva) return '';
        return `
          <div style="display:flex;align-items:center;gap:8px;padding:6px 10px;margin-bottom:6px;background:linear-gradient(90deg, rgba(193,122,0,0.1), transparent);border-left:3px solid var(--warning);border-radius:var(--radius-sm)">
            <span style="font-size:0.85rem;font-weight:700;color:var(--warning)">Concentrando:</span>
            <span style="font-size:0.85rem;font-weight:600">${concAtiva}</span>
            <button class="btn btn-sm btn-secondary no-print" style="margin-left:auto;font-size:0.65rem;padding:2px 8px" data-quebrar-concentracao="1">Quebrar</button>
          </div>
        `;
      })()}
      ${furiaIrracionalAtiva ? `
        <div style="display:flex;flex-wrap:wrap;gap:6px;padding:4px 0;margin-bottom:4px">
          <span class="badge" style="font-size:0.7rem;padding:3px 7px;background:var(--success);color:#fff">Imune: Amedrontado (Furia Irracional)</span>
          <span class="badge" style="font-size:0.7rem;padding:3px 7px;background:var(--success);color:#fff">Imune: Enfeitiçado (Furia Irracional)</span>
        </div>
      ` : ''}
      ${auraCoragemImune ? `
        <div style="display:flex;flex-wrap:wrap;gap:6px;padding:4px 0;margin-bottom:4px">
          <span class="badge" style="font-size:0.7rem;padding:3px 7px;background:var(--success);color:#fff">Imune: Amedrontado (Aura de Coragem)</span>
        </div>
      ` : ''}
      ${auraDevocaoImune ? `
        <div style="display:flex;flex-wrap:wrap;gap:6px;padding:4px 0;margin-bottom:4px">
          <span class="badge" style="font-size:0.7rem;padding:3px 7px;background:var(--success);color:#fff">Imune: Enfeitiçado (Aura de Devoção)</span>
        </div>
      ` : ''}
      ${imunidadesMagia.length > 0 ? `
        <div style="display:flex;flex-wrap:wrap;gap:6px;padding:4px 0;margin-bottom:4px">
          ${imunidadesMagia.map(im => `<span class="badge" style="font-size:0.7rem;padding:3px 7px;background:var(--success);color:#fff">Imune: ${im.condicao} (${im.fonte})</span>`).join('')}
        </div>
      ` : ''}
      ${condicoesMagia.length > 0 ? `
        <div style="display:flex;flex-wrap:wrap;gap:6px;padding:4px 0;margin-bottom:4px">
          ${condicoesMagia.map(cm => `<span class="badge" style="font-size:0.7rem;padding:3px 7px;background:var(--accent);color:#fff" title="${cm.rotulo || cm.condicao}">${cm.condicao} (${cm.fonte})</span>`).join('')}
        </div>
      ` : ''}
      ${efeitosUnicos.length > 0 ? `
        <div style="display:flex;flex-wrap:wrap;gap:6px;padding:4px 0;margin-bottom:4px">
          ${efeitosUnicos.map(ef => `<span class="badge" style="font-size:0.7rem;padding:3px 7px;background:var(--info);color:#fff" title="${ef.rotulo || ef.nome}">${ef.rotulo || ef.nome}${ef.concentracao ? ' (C)' : ''}</span>`).join('')}
        </div>
      ` : ''}
      ${temCondicao ? `
        <div style="display:flex;flex-wrap:wrap;gap:6px;padding:4px 0">
          ${condicoes.map(c => {
            const info = CONDICOES_DD.find(cd => cd.nome === c) || { icone: '?', cor: '#666' };
            const desc = CONDICOES_DESCRICAO[c] || '';
            return `<span class="badge" style="font-size:0.75rem;padding:4px 8px;background:${info.cor};color:#fff;cursor:pointer" data-condicao-info="${c}">${info.icone} ${c}</span>`;
          }).join('')}
        </div>
        ${condicoes.includes('Exaustão') ? `
          <div style="display:flex;align-items:center;gap:8px;margin-top:4px;font-size:0.8rem">
            <span style="color:var(--danger);font-weight:600">Nivel de Exaustao:</span>
            <button class="btn btn-sm btn-icon no-print" data-exaustao-ajuste="-1" style="padding:1px 6px;font-size:0.8rem">-</button>
            <span style="font-weight:700;min-width:20px;text-align:center">${char.exaustao || 0}</span>
            <button class="btn btn-sm btn-icon no-print" data-exaustao-ajuste="1" style="padding:1px 6px;font-size:0.8rem">+</button>
            <span style="font-size:0.7rem;color:var(--text-muted)">(-${(char.exaustao || 0) * 2} em d20 e CD)</span>
          </div>
        ` : ''}
      ` : `${(condicoesMagia.length + efeitosUnicos.length + imunidadesMagia.length) === 0 ? '<div style="color:var(--text-muted);font-size:0.85rem;text-align:center;padding:8px">Nenhuma condicao ativa</div>' : ''}`}
    </div>
  `;
}

/** Renderiza secao de defesas (resistencias, vulnerabilidades, imunidades) */
export function renderSecaoDefesas() {
  const resistencias = [...(char.resistencias || [])];
  const vulnerabilidades = char.vulnerabilidades || [];
  const imunidades = [...(char.imunidades || [])];

  // Resistencias dinamicas da Furia ativa
  const _efDef = getEstadoFuria();
  const resistenciasFuriaAtivas = (_efDef?.ativa && _efDef?.resistencias) ? _efDef.resistencias : [];
  const resistenciasTotais = [...resistencias];
  resistenciasFuriaAtivas.forEach(r => {
    if (!resistenciasTotais.includes(r)) resistenciasTotais.push(r);
  });

  // Resistencias e imunidades temporarias de efeitos magicos
  const efeitosMag = char.efeitos_magicos || [];
  const resistenciasMagicas = [];
  const imunidadesMagicas = [];
  efeitosMag.forEach(e => {
    if (e.tipo === 'resistencia' && e.tipos_dano) {
      e.tipos_dano.forEach(t => { if (!resistenciasTotais.includes(t) && !resistenciasMagicas.includes(t)) resistenciasMagicas.push(t); });
    }
    if (e.tipo === 'imunidade_condicao') {
      const txt = `${e.condicao} (${e.nome.replace(/ \(.*\)$/, '')})`;
      if (!imunidadesMagicas.includes(txt)) imunidadesMagicas.push(txt);
    }
  });
  resistenciasMagicas.forEach(r => { if (!resistenciasTotais.includes(r)) resistenciasTotais.push(r); });

  const temDefesa = resistenciasTotais.length > 0 || vulnerabilidades.length > 0 || imunidades.length > 0 || imunidadesMagicas.length > 0;

  if (!temDefesa) {
    return `
      <div class="card">
        <div class="card-header">
          <h2>Defesas</h2>
          <button class="btn btn-sm btn-secondary no-print" id="btn-gerenciar-defesas">Gerenciar</button>
        </div>
        <div style="color:var(--text-muted);font-size:0.85rem;text-align:center;padding:8px">Nenhuma defesa configurada</div>
      </div>
    `;
  }

  let html = `
    <div class="card">
      <div class="card-header">
        <h2>Defesas</h2>
        <button class="btn btn-sm btn-secondary no-print" id="btn-gerenciar-defesas">Gerenciar</button>
      </div>
  `;

  if (resistenciasTotais.length > 0) {
    const fixas = resistencias;
    const temporariasFuria = resistenciasFuriaAtivas.filter(r => !fixas.includes(r));
    const temporariasMagia = resistenciasMagicas.filter(r => !fixas.includes(r) && !temporariasFuria.includes(r));
    let textoRes = '';
    if (fixas.length > 0) textoRes += fixas.join(', ');
    if (temporariasFuria.length > 0) {
      if (textoRes) textoRes += ', ';
      textoRes += temporariasFuria.map(r => `<span style="color:var(--danger);font-weight:600" title="Fúria ativa">${r} (Fúria)</span>`).join(', ');
    }
    if (temporariasMagia.length > 0) {
      if (textoRes) textoRes += ', ';
      textoRes += temporariasMagia.map(r => `<span style="color:var(--accent);font-weight:600" title="Efeito mágico">${r} (Magia)</span>`).join(', ');
    }
    if (fixas.length === 0 && temporariasFuria.length > 0 && temporariasMagia.length === 0) {
      textoRes = temporariasFuria.map(r => `<span style="color:var(--danger);font-weight:600" title="Fúria ativa">${r} (Fúria)</span>`).join(', ');
    }
    html += `<div style="margin-bottom:4px"><span style="font-size:0.75rem;font-weight:700;color:var(--info)">Resistencias:</span> <span style="font-size:0.8rem">${textoRes}</span></div>`;
  }
  if (vulnerabilidades.length > 0) {
    html += `<div style="margin-bottom:4px"><span style="font-size:0.75rem;font-weight:700;color:var(--danger)">Vulnerabilidades:</span> <span style="font-size:0.8rem">${vulnerabilidades.join(', ')}</span></div>`;
  }
  if (imunidades.length > 0 || imunidadesMagicas.length > 0) {
    const todasImunidades = [...imunidades.map(i => i), ...imunidadesMagicas.map(i => `<span style="color:var(--accent);font-weight:600">${i}</span>`)];
    html += `<div style="margin-bottom:4px"><span style="font-size:0.75rem;font-weight:700;color:var(--success)">Imunidades:</span> <span style="font-size:0.8rem">${todasImunidades.join(', ')}</span></div>`;
  }

  html += '</div>';
  return html;
}

/** Renderiza secao de sentidos passivos */
export function renderSecaoSentidos() {
  const percepcao = calcPercepcaoPassiva(char);
  const intuicao = calcIntuicaoPassiva(char);
  const investigacao = calcInvestigacaoPassiva(char);

  // Verificar visao no escuro pela especie
  let visaoEscuro = '';
  if (especiesCache?.especies) {
    const esp = especiesCache.especies.find(e => e.nome === char.especie);
    if (esp?.tracos) {
      const tracoVE = esp.tracos.find(t => t.nome === 'Visão no Escuro');
      if (tracoVE) {
        const matchAlcance = tracoVE.descricao?.match(/alcance de (\d+)/i);
        visaoEscuro = matchAlcance ? `${matchAlcance[1]} m` : '18 m';
      }
      // Drow tem visao no escuro superior (36m) via linhagem
      const tracosEscolhidos = char.tracos_escolhidos || [];
      if (tracosEscolhidos.includes('Drow')) {
        visaoEscuro = '36 m';
      }
    }
  }

  // Guardiao nivel 18+: Sentidos Selvagens (Visao as Cegas 9m)
  let sentidoExtra = '';
  const estadoG = char.classe === 'Guardião' ? getEstadoRecursosGuardiao() : null;
  if (estadoG?.sentidosSelvagensAtivo) {
    sentidoExtra = 'Visao as Cegas 9 m';
  }

  return `
    <div class="card">
      <div class="card-header"><h2>Sentidos Passivos</h2></div>
      <div class="salvaguardas-grid" style="grid-template-columns: repeat(auto-fit, minmax(140px, 1fr))">
        <div class="salva-item" style="justify-content:center;gap:8px">
          <span class="pericia-bonus">${percepcao}</span>
          <span class="pericia-nome">Percepcao</span>
        </div>
        <div class="salva-item" style="justify-content:center;gap:8px">
          <span class="pericia-bonus">${intuicao}</span>
          <span class="pericia-nome">Intuicao</span>
        </div>
        <div class="salva-item" style="justify-content:center;gap:8px">
          <span class="pericia-bonus">${investigacao}</span>
          <span class="pericia-nome">Investigacao</span>
        </div>
        ${visaoEscuro ? `
        <div class="salva-item" style="justify-content:center;gap:8px">
          <span class="pericia-bonus">${visaoEscuro}</span>
          <span class="pericia-nome">Visao no Escuro</span>
        </div>
        ` : ''}
        ${sentidoExtra ? `
        <div class="salva-item" style="justify-content:center;gap:8px">
          <span class="pericia-bonus">${sentidoExtra.replace(/\D+$/, '').trim()}</span>
          <span class="pericia-nome">${sentidoExtra.includes('Cegas') ? 'Visao as Cegas' : sentidoExtra}</span>
        </div>
        ` : ''}
      </div>
    </div>
  `;
}

/** Setup de eventos para gerenciar condicoes */
export function setupEventosCondicoes() {
  // Clicar na badge de condicao para ver descricao
  document.querySelectorAll('[data-condicao-info]').forEach(el => {
    el.addEventListener('click', () => {
      const nome = el.dataset.condicaoInfo;
      const info = CONDICOES_DD.find(c => c.nome === nome);
      const desc = CONDICOES_DESCRICAO[nome] || 'Sem descricao disponivel.';
      abrirModal(`${info?.icone || ''} ${nome}`, `<div style="font-size:0.9rem;line-height:1.6">${desc}</div>`,
        '<button class="btn btn-primary" onclick="fecharModal()">Fechar</button>');
    });
  });

  document.getElementById('btn-gerenciar-condicoes')?.addEventListener('click', () => {
    const condicoesAtuais = new Set(char.condicoes || []);
    // Verificar imunidades da Fúria Irracional
    const _estadoFI = getEstadoFuria();
    const _furiaImune = _estadoFI?.ativa && _estadoFI?.furiaIrracional;
    const _condicoesImunes = _furiaImune ? ['Amedrontado', 'Enfeitiçado'] : [];
    // Verificar imunidades de Auras do Paladino
    const _epCond = getEstadoRecursosPaladino();
    if (_epCond?.auraCoragemAtiva && !_condicoesImunes.includes('Amedrontado')) {
      _condicoesImunes.push('Amedrontado');
    }
    if (_epCond?.auraDevocaoAtiva && !_condicoesImunes.includes('Enfeitiçado')) {
      _condicoesImunes.push('Enfeitiçado');
    }
    // Fontes de imunidade para exibição
    const _fontesImunidade = {};
    if (_furiaImune) { _fontesImunidade['Amedrontado'] = 'Furia Irracional'; _fontesImunidade['Enfeitiçado'] = 'Furia Irracional'; }
    if (_epCond?.auraCoragemAtiva && !_fontesImunidade['Amedrontado']) _fontesImunidade['Amedrontado'] = 'Aura de Coragem';
    if (_epCond?.auraDevocaoAtiva && !_fontesImunidade['Enfeitiçado']) _fontesImunidade['Enfeitiçado'] = 'Aura de Devoção';

    const html = `
      <div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center">
        ${CONDICOES_DD.map(c => {
          const ativa = condicoesAtuais.has(c.nome);
          const imune = _condicoesImunes.includes(c.nome);
          const desc = CONDICOES_DESCRICAO[c.nome] || '';
          return `
            <div class="selection-card ${ativa ? 'selected' : ''} ${imune ? 'disabled' : ''}" data-condicao-toggle="${c.nome}" 
                 style="min-width:130px;max-width:170px;cursor:pointer;text-align:center;border:2px solid ${ativa ? c.cor : 'var(--border-light)'};${ativa ? `background:${c.cor}15` : ''}${imune ? ';opacity:0.4;pointer-events:none' : ''}">
              <div style="font-size:1.2rem">${c.icone}</div>
              <div style="font-size:0.8rem;font-weight:600">${c.nome}</div>
              ${imune ? `<div style="font-size:0.65rem;color:var(--success)">Imune (${_fontesImunidade[c.nome] || 'Imunidade'})</div>` : ''}
            </div>
          `;
        }).join('')}
      </div>
      <div id="condicao-desc-area" style="font-size:0.8rem;color:var(--text);margin-top:8px;padding:8px 10px;border-radius:6px;background:var(--bg-card);border:1px solid var(--border-light);min-height:20px;display:none"></div>
      <div style="font-size:0.75rem;color:var(--text-muted);margin-top:8px;text-align:center">Clique para ativar/desativar. Segure para ver descricao.</div>
    `;

    abrirModal('Gerenciar Condicoes', html,
      '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-primary" id="btn-salvar-condicoes">Salvar</button>'
    );

    // Eventos de toggle + mostrar descricao
    document.querySelectorAll('[data-condicao-toggle]').forEach(el => {
      el.addEventListener('click', () => {
        const nome = el.dataset.condicaoToggle;
        if (el.classList.contains('selected')) {
          el.classList.remove('selected');
          el.style.borderColor = 'var(--border-light)';
          el.style.background = '';
        } else {
          el.classList.add('selected');
          const info = CONDICOES_DD.find(c => c.nome === nome);
          el.style.borderColor = info?.cor || 'var(--accent)';
          el.style.background = `${info?.cor || 'var(--accent)'}15`;
        }
        // Mostrar descricao da condicao clicada
        const descArea = document.getElementById('condicao-desc-area');
        if (descArea) {
          const desc = CONDICOES_DESCRICAO[nome] || '';
          if (desc) {
            descArea.innerHTML = `<strong>${nome}:</strong> ${desc}`;
            descArea.style.display = 'block';
          }
        }
      });
    });

    document.getElementById('btn-salvar-condicoes')?.addEventListener('click', () => {
      const novas = [];
      document.querySelectorAll('[data-condicao-toggle].selected').forEach(el => {
        novas.push(el.dataset.condicaoToggle);
      });

      // Bloquear condições imunes (Fúria Irracional, Aura de Coragem, Aura de Devoção)
      const bloqueadas = novas.filter(c => _condicoesImunes.includes(c));
      if (bloqueadas.length > 0) {
        const fontes = [...new Set(bloqueadas.map(c => _fontesImunidade[c] || 'Imunidade'))].join(' / ');
        toast(`Imunidade ativa (${fontes}): ${bloqueadas.join(' e ')}`, 'error');
        return;
      }

      char.condicoes = novas;
      // Se Exaustao foi removida, zerar nivel
      if (!novas.includes('Exaustão') && char.exaustao > 0) {
        char.exaustao = 0;
      }
      // Se Exaustao foi adicionada e nivel era 0, colocar 1
      if (novas.includes('Exaustão') && (!char.exaustao || char.exaustao <= 0)) {
        char.exaustao = 1;
      }
      salvar();
      window.fecharModal();
      renderFichaCompleta();
    });
  });

  // Ajuste de nivel de exaustao
  document.querySelectorAll('[data-exaustao-ajuste]').forEach(btn => {
    btn.addEventListener('click', () => {
      const delta = parseInt(btn.dataset.exaustaoAjuste);
      if (!char.exaustao) char.exaustao = 0;
      char.exaustao = Math.max(0, Math.min(6, char.exaustao + delta));
      // Se zerou, remover condicao
      if (char.exaustao <= 0) {
        char.condicoes = (char.condicoes || []).filter(c => c !== 'Exaustão');
        char.exaustao = 0;
      }
      salvar();
      renderFichaCompleta();
    });
  });
}

/** Setup de eventos para gerenciar defesas */
export function setupEventosDefesas() {
  document.getElementById('btn-gerenciar-defesas')?.addEventListener('click', () => {
    const resistencias = new Set(char.resistencias || []);
    const vulnerabilidades = new Set(char.vulnerabilidades || []);
    const imunidades = new Set(char.imunidades || []);

    const renderCategoria = (titulo, cor, dataPrefix, selecionados) => {
      return `
        <div style="margin-bottom:12px">
          <div style="font-size:0.85rem;font-weight:700;color:${cor};margin-bottom:6px">${titulo}</div>
          <div style="display:flex;flex-wrap:wrap;gap:4px">
            ${TIPOS_DANO.map(tipo => {
              const ativo = selecionados.has(tipo);
              return `<span class="badge ${ativo ? '' : 'badge-secondary'}" style="cursor:pointer;padding:4px 8px;font-size:0.75rem;${ativo ? `background:${cor};color:#fff` : ''}" data-defesa-toggle="${dataPrefix}" data-tipo="${tipo}">${tipo}</span>`;
            }).join('')}
          </div>
        </div>
      `;
    };

    const html = renderCategoria('Resistencias (metade do dano)', 'var(--info)', 'resistencia', resistencias)
      + renderCategoria('Vulnerabilidades (dobro do dano)', 'var(--danger)', 'vulnerabilidade', vulnerabilidades)
      + renderCategoria('Imunidades (ignora dano)', 'var(--success)', 'imunidade', imunidades);

    abrirModal('Gerenciar Defesas', html,
      '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-primary" id="btn-salvar-defesas">Salvar</button>'
    );

    document.querySelectorAll('[data-defesa-toggle]').forEach(el => {
      el.addEventListener('click', () => {
        const cat = el.dataset.defesaToggle;
        const tipo = el.dataset.tipo;
        if (el.classList.contains('badge-secondary')) {
          el.classList.remove('badge-secondary');
          const cores = { resistencia: 'var(--info)', vulnerabilidade: 'var(--danger)', imunidade: 'var(--success)' };
          el.style.background = cores[cat] || 'var(--accent)';
          el.style.color = '#fff';
        } else {
          el.classList.add('badge-secondary');
          el.style.background = '';
          el.style.color = '';
        }
      });
    });

    document.getElementById('btn-salvar-defesas')?.addEventListener('click', () => {
      const novasR = [], novasV = [], novasI = [];
      document.querySelectorAll('[data-defesa-toggle]').forEach(el => {
        if (el.classList.contains('badge-secondary')) return;
        const cat = el.dataset.defesaToggle;
        const tipo = el.dataset.tipo;
        if (cat === 'resistencia') novasR.push(tipo);
        else if (cat === 'vulnerabilidade') novasV.push(tipo);
        else if (cat === 'imunidade') novasI.push(tipo);
      });
      char.resistencias = novasR;
      char.vulnerabilidades = novasV;
      char.imunidades = novasI;
      salvar();
      window.fecharModal();
      renderFichaCompleta();
    });
  });
}