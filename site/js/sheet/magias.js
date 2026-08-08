// ============================================================
// Magias: secao, espacos, concentracao, metamagia e efeitos
//
// Tambem cobre as magias personalizadas do jogador.
// Extraido de site/js/pages/sheet.js sem alteracao de comportamento.
// ============================================================
import { ATRIBUTO_NOME_PARA_KEY, CLASSES_INFO } from '../dados-classes.js';
import { getMagiasClasse, getMagiasPorCirculo } from '../db.js';
import { abrirModal, bonusProficiencia, calcMod, escHtml, getBonusTruquesOrdem, getMagiaPreparadas, getTruquesConhecidos, mdParaHtml, semAcento, toast } from '../utils.js';
import { getEstadoFuria } from './classes/barbaro.js';
import { renderSecaoPactoBruxo } from './classes/bruxo.js';
import { gastarPontosFeiticaria, getEstadoRecursosFeiticeiro } from './classes/feiticeiro.js';
import { getCavaleiroMisticoConjuracao } from './classes/guerreiro.js';
import { getTrapaceiroArcanoConjuracao } from './classes/ladino.js';
import { _truquesColapsados } from './colapso.js';
import { ehBardoComSegredosMagicos, getTruquesExtraEstiloLuta } from './combate.js';
import { char, classeData, indiceMagiasCache, salvar } from './estado.js';
import { renderFichaCompleta } from './ficha.js';
import { abrirPreenchimentoSlotMagia, mostrarBuscaGrimorio, mostrarBuscaMagia, mostrarFormMagiaCustom } from './grimorio.js';
import { abrirModalAdicionarTalento, abrirModalEditarIniciadoEmMagia } from './talentos.js';

export function magiaContaNoLimite(magia) {
  const origensEspeciais = ['dominio', 'sempre', 'especie_legado', 'iniciado_em_magia', 'tocado_por_fadas', 'tocado_pelas_sombras', 'conjurador_ritualista'];
  return !origensEspeciais.includes(magia?.origem);
}

export function magiaEhEspecial(magia) {
  return !magiaContaNoLimite(magia);
}

export function rotuloOrigemMagia(magia) {
  if (magia?.origem === 'dominio') return 'Domínio';
  if (magia?.origem === 'sempre') return 'Sempre Preparada';
  if (magia?.origem === 'especie_legado') return 'Sempre Preparada';
  if (magia?.origem === 'iniciado_em_magia') return 'Iniciado em Magia';
  if (magia?.origem === 'tocado_por_fadas') return 'Tocado Por Fadas';
  if (magia?.origem === 'tocado_pelas_sombras') return 'Tocado Pelas Sombras';
  if (magia?.origem === 'conjurador_ritualista') return 'Conjurador Ritualista';
  return '';
}

// Mantém registros antigos de magias personalizadas compatíveis com a mesma
// visão usada pela lista de magias, sem alterar os dados persistidos da ficha.
export function normalizarMagiaPersonalizada(m, indice) {
  const magia = m && typeof m === 'object' ? m : {};
  return {
    ...magia,
    nome: String(magia.nome || ''),
    circulo: Number(magia.circulo) || 0,
    escola: String(magia.escola || ''),
    tempo_conjuracao: String(magia.tempo_conjuracao || ''),
    alcance: String(magia.alcance || ''),
    componentes: String(magia.componentes || ''),
    duracao: String(magia.duracao || ''),
    descricao: String(magia.descricao || ''),
    dano: String(magia.dano || ''),
    ritual: Boolean(magia.ritual),
    personalizada: true,
    origem: 'Personalizada'
  };
}

function renderDetalhesMagiaPersonalizada(magia) {
  const meta = [magia.escola, magia.tempo_conjuracao, magia.alcance, magia.componentes, magia.duracao]
    .filter(Boolean)
    .map(escHtml)
    .join(' | ');
  const dano = magia.dano ? `<div style="margin-top:6px"><strong>Dano / efeito:</strong> ${mdParaHtml(magia.dano)}</div>` : '';
  return `
    ${meta ? `<div class="magia-meta" style="margin-bottom:4px">${meta}</div>` : ''}
    ${magia.descricao ? `<div class="md-content">${mdParaHtml(magia.descricao)}</div>` : ''}
    ${dano}
  `;
}

function renderLinhaMagiaPersonalizada(magia, indice, opts = {}) {
  const { naoPreparada = false } = opts;
  const tags = [];
  if (magia.escola) tags.push(`<span class="magia-tag tag-escola">${escHtml(magia.escola)}</span>`);
  if (magia.tempo_conjuracao) {
    const tempo = String(magia.tempo_conjuracao);
    const tempoNormalizado = tempo.toLowerCase();
    const classeTempo = tempoNormalizado === 'ação' || tempoNormalizado === 'acao'
      ? 'tag-acao'
      : tempoNormalizado.includes('ação bônus') || tempoNormalizado.includes('acao bonus')
        ? 'tag-acao-bonus'
        : tempoNormalizado.includes('reação') || tempoNormalizado.includes('reacao') ? 'tag-reacao' : 'tag-tempo';
    const rotuloTempo = classeTempo === 'tag-acao' ? 'Ação'
      : classeTempo === 'tag-acao-bonus' ? 'Ação Bônus'
        : classeTempo === 'tag-reacao' ? 'Reação' : tempo;
    tags.push(`<span class="magia-tag ${classeTempo}">${escHtml(rotuloTempo)}</span>`);
  }
  if (magia.duracao) {
    const duracao = String(magia.duracao);
    const duracaoNormalizada = duracao.toLowerCase();
    if (duracaoNormalizada.includes('concentra')) tags.push('<span class="magia-tag tag-conc">Conc.</span>');
    else if (duracaoNormalizada.includes('instant')) tags.push('<span class="magia-tag tag-inst">Inst.</span>');
    else tags.push(`<span class="magia-tag tag-dur">${escHtml(duracao.replace(/^até\s+/i, ''))}</span>`);
  }
  if (magia.alcance) {
    const alcance = String(magia.alcance);
    const alcanceNormalizado = alcance.toLowerCase();
    const rotuloAlcance = alcanceNormalizado === 'pessoal' ? 'Pessoal' : alcanceNormalizado === 'toque' ? 'Toque' : alcance;
    tags.push(`<span class="magia-tag tag-alcance">${escHtml(rotuloAlcance)}</span>`);
  }
  const ritual = magia.ritual
    ? ' <span class="badge" style="font-size:0.6rem;background:var(--secondary);color:#fff">Ritual</span>'
    : '';
  const circulosDisponiveis = Object.keys(char?.espacos_magia || {})
    .map(Number)
    .filter(circulo => circulo >= magia.circulo)
    .sort((a, b) => a - b);
  const temUpcast = magia.circulo > 0 && circulosDisponiveis.length > 1;
  const todosEsgotados = magia.circulo > 0 && (
    circulosDisponiveis.length === 0
    || circulosDisponiveis.every(circulo => {
      const espaco = char.espacos_magia[circulo];
      return (espaco?.usados || 0) >= (espaco?.total || 0);
    })
  );
  const controlesConjuracao = magia.circulo === 0
    ? `<button class="btn btn-sm btn-cantrip" data-lancar-magia-custom="${indice}">Lançar</button>`
    : naoPreparada
      ? `
        <span style="font-size:0.65rem;color:var(--text-muted);font-style:italic">Não preparada</span>
        ${magia.ritual ? `<button class="btn btn-sm btn-secondary" data-conjurar-ritual-custom="${indice}" title="Conjurar como Ritual (sem gastar espaço)">Ritual</button>` : ''}
      `
      : `
      ${temUpcast ? `
        <select class="form-input" data-conj-select-custom="${indice}" style="width:auto;padding:2px 4px;font-size:0.75rem">
          ${circulosDisponiveis.map(circulo => `<option value="${circulo}"${circulo === magia.circulo ? ' selected' : ''}>${circulo}º</option>`).join('')}
        </select>
      ` : ''}
      <button class="btn btn-sm ${todosEsgotados ? 'btn-secondary' : 'btn-primary'}"
              data-conjurar-magia-custom="${indice}"
              data-conj-circ="${circulosDisponiveis[0] || magia.circulo}"
              ${todosEsgotados ? 'disabled' : ''}>Conjurar</button>
      ${magia.ritual ? `<button class="btn btn-sm btn-secondary" data-conjurar-ritual-custom="${indice}" title="Conjurar como Ritual (sem gastar espaço)">Ritual</button>` : ''}
    `;
  return `
    <div class="magia-item magia-personalizada" data-magia-custom-index="${indice}" data-magia-circ="${magia.circulo}">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <div class="magia-nome">${escHtml(magia.nome)} <span class="badge badge-secondary" style="font-size:0.6rem">Personalizada</span>${ritual}</div>
          <div class="magia-meta"><span>${magia.circulo === 0 ? 'Truque' : `${magia.circulo}º Círculo`}</span></div>
          ${tags.length ? `<div class="magia-tags">${tags.join('')}</div>` : ''}
        </div>
        <div class="no-print" style="display:flex;align-items:center;gap:4px">
          ${controlesConjuracao}
          <button class="btn btn-sm btn-secondary btn-icon" data-editar-magia-custom="${indice}" title="Editar magia personalizada">&#9998;</button>
          <button class="btn btn-sm btn-danger btn-icon" data-remover-magia-custom="${indice}" title="Remover magia personalizada">&times;</button>
        </div>
      </div>
      <div class="magia-desc"></div>
    </div>`;
}

function magiaPersonalizadaEhConcentracao(magia) {
  return /concentra/i.test(String(magia?.duracao || ''));
}

function registrarConcentracaoMagiaPersonalizada(magia, circulo) {
  if (!magiaPersonalizadaEhConcentracao(magia)) return;
  if (!char.efeitos_magicos) char.efeitos_magicos = [];
  char.efeitos_magicos = char.efeitos_magicos.filter(efeito => !efeito.concentracao);
  char.efeitos_magicos.push({
    nome: magia.nome,
    tipo: 'concentracao_generica',
    concentracao: true,
    circulo: Number(circulo) || 0,
    rotulo: `Concentrando em ${magia.nome}`
  });
}

function conjurarMagiaPersonalizada(indice, circuloSelecionado) {
  const registro = (char?.magias_customizadas || [])[indice];
  if (!registro) return false;

  const magia = normalizarMagiaPersonalizada(registro, indice);
  const circuloBase = Number(magia.circulo);
  const circulo = Number(circuloSelecionado);
  if (circuloBase <= 0 || !Number.isInteger(circulo) || circulo < circuloBase) {
    toast('Círculo inválido para esta magia.', 'error');
    return false;
  }

  const espaco = char?.espacos_magia?.[circulo];
  if (!espaco || (espaco.usados || 0) >= (espaco.total || 0)) {
    toast(`Sem espaços de ${circulo}º círculo!`, 'error');
    return false;
  }

  espaco.usados = (espaco.usados || 0) + 1;
  registrarConcentracaoMagiaPersonalizada(magia, circulo);
  salvar();
  renderFichaCompleta();
  toast(`${magia.nome} conjurada${circulo > circuloBase ? ` no ${circulo}º círculo` : ''}!`, 'success');
  return true;
}

// Retorna a tabela de conjuração da subclasse ativa (Cavaleiro Místico ou Trapaceiro Arcano)
export function getSubclasseConjuradoraConjuracao() {
  return getCavaleiroMisticoConjuracao() || getTrapaceiroArcanoConjuracao();
}

// Verifica se a subclasse atual concede conjuração
export function ehSubclasseConjuradora() {
  const nivel = char?.nivel || 1;
  if (nivel < 3) return false;
  return (char?.classe === 'Guerreiro' && char?.subclasse === 'Cavaleiro Místico')
      || (char?.classe === 'Ladino' && char?.subclasse === 'Trapaceiro Arcano');
}

export function consumirEspacoMagiaDisponivel(circuloMinimo = 1) {
  if (!char?.espacos_magia) return 0;
  const circulos = Object.keys(char.espacos_magia).map(Number).filter(c => c >= circuloMinimo).sort((a, b) => a - b);
  for (const c of circulos) {
    const slot = char.espacos_magia[c];
    if (!slot) continue;
    const disponiveis = Math.max(0, (slot.total || 0) - (slot.usados || 0));
    if (disponiveis > 0) {
      slot.usados = (slot.usados || 0) + 1;
      return c;
    }
  }
  return 0;
}

export function recuperarEspacoMagia(circulo = 1) {
  const slot = char?.espacos_magia?.[circulo];
  if (!slot || (slot.usados || 0) <= 0) return false;
  slot.usados -= 1;
  return true;
}

// --- Magias ---

/**
 * Converte a estrutura aninhada do JSON de magias da classe
 * { lista_magias: { "Truques": [...], "1º Círculo": [...], ... } }
 * para uma lista plana [{ nome, circulo, escola, especial }, ...]
 */
export function achatarMagiasClasse(magiasClasseData) {
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

export async function obterMagiasDisponiveisClasseAtual() {
  // Subclasses conjuradoras (Cavaleiro Místico e Trapaceiro Arcano) usam a lista de magias do Mago
  let classeParaMagias = char.classe;
  if (ehSubclasseConjuradora()) {
    classeParaMagias = 'Mago';
  }
  const magiasClasseData = await getMagiasClasse(classeParaMagias);
  const base = achatarMagiasClasse(magiasClasseData);

  // Combatente Druídico: incluir truques de Druida
  const estiloLuta = char.escolhas_classe?.estilo_luta?.[0] || '';
  if (estiloLuta === 'Combatente Druídico') {
    const druidaData = await getMagiasClasse('Druida');
    const druidaTruques = achatarMagiasClasse(druidaData).filter(m => m.circulo === 0);
    const mapa = new Map();
    base.forEach(m => mapa.set(`${m.nome}|${m.circulo || 0}`, m));
    druidaTruques.forEach(m => { if (!mapa.has(`${m.nome}|0`)) mapa.set(`${m.nome}|0`, m); });
    // Retornar base + truques de druida, mantendo magias de circulo da base
    const resultado = [...mapa.values()];
    if (!ehBardoComSegredosMagicos()) return resultado;
  }

  // Combatente Abençoado: incluir truques de Clérigo
  if (estiloLuta === 'Combatente Abençoado') {
    const clerigoData = await getMagiasClasse('Clérigo');
    const clerigoTruques = achatarMagiasClasse(clerigoData).filter(m => m.circulo === 0);
    const mapa = new Map();
    base.forEach(m => mapa.set(`${m.nome}|${m.circulo || 0}`, m));
    clerigoTruques.forEach(m => { if (!mapa.has(`${m.nome}|0`)) mapa.set(`${m.nome}|0`, m); });
    const resultado = [...mapa.values()];
    if (!ehBardoComSegredosMagicos()) return resultado;
  }

  if (!ehBardoComSegredosMagicos()) return base;

  const extrasClasses = ['Clérigo', 'Druida', 'Mago'];
  const extras = [];
  for (const classe of extrasClasses) {
    const data = await getMagiasClasse(classe);
    extras.push(...achatarMagiasClasse(data));
  }

  const mapa = new Map();
  [...base, ...extras].forEach(m => {
    const chave = `${m.nome}|${m.circulo || 0}`;
    if (!mapa.has(chave)) mapa.set(chave, m);
  });

  return [...mapa.values()];
}

// Prioridade de ordenacao: Acao=0, Acao Bonus=1, Reacao=2, outros=3
function prioridadeConjuracao(nomeMagia) {
  const info = indiceMagiasCache?.find(m => m.nome === nomeMagia);
  if (!info?.tempo_conjuracao) return 3;
  const tc = info.tempo_conjuracao.toLowerCase();
  if (tc === 'ação' || tc === 'acao') return 0;
  if (tc.includes('ação bônus') || tc.includes('acao bonus')) return 1;
  if (tc.includes('reação') || tc.includes('reacao')) return 2;
  return 3;
}

// Retorna badges HTML compactos com metadados da magia (tipo, tempo, alcance, duração)
export function badgesMagiaRapidos(nomeMagia) {
  if (!indiceMagiasCache?.length) return '';
  const info = indiceMagiasCache.find(m => m.nome === nomeMagia);
  if (!info) return '';

  const badges = [];

  // Escola
  if (info.escola) {
    badges.push(`<span class="magia-tag tag-escola">${info.escola}</span>`);
  }

  // Tempo de conjuração - cores diferentes por tipo
  if (info.tempo_conjuracao) {
    const tc = info.tempo_conjuracao.toLowerCase();
    let label = info.tempo_conjuracao;
    let tagClass = 'tag-tempo';
    if (tc === 'ação' || tc === 'acao') { label = 'Ação'; tagClass = 'tag-acao'; }
    else if (tc.includes('ação bônus') || tc.includes('acao bonus')) { label = 'Ação Bônus'; tagClass = 'tag-acao-bonus'; }
    else if (tc.includes('reação') || tc.includes('reacao')) { label = 'Reação'; tagClass = 'tag-reacao'; }
    badges.push(`<span class="magia-tag ${tagClass}">${label}</span>`);
  }

  // Duração - concentração ou instantâneo
  if (info.duracao) {
    const dur = info.duracao.toLowerCase();
    if (dur.includes('concentra')) {
      badges.push(`<span class="magia-tag tag-conc">Conc.</span>`);
    } else if (dur.includes('instant')) {
      badges.push(`<span class="magia-tag tag-inst">Inst.</span>`);
    } else {
      badges.push(`<span class="magia-tag tag-dur">${info.duracao.replace('até ', '').replace('Até ', '')}</span>`);
    }
  }

  // Alcance
  if (info.alcance) {
    const alc = info.alcance.toLowerCase();
    let label = info.alcance;
    if (alc === 'pessoal') label = 'Pessoal';
    else if (alc === 'toque') label = 'Toque';
    badges.push(`<span class="magia-tag tag-alcance">${label}</span>`);
  }

  return `<div class="magia-tags">${badges.join('')}</div>`;
}

export function renderSecaoMagias() {
  const info = CLASSES_INFO[char.classe];
  const subConj = getSubclasseConjuradoraConjuracao();
  const tipoConj = info.tipo_conjuracao || (subConj ? 'conhecidas' : 'preparadas');
  const magiasPersonalizadas = (char.magias_customizadas || []).map((magia, indice) => ({
    ...normalizarMagiaPersonalizada(magia, indice),
    indicePersonalizada: indice
  }));
  const truquesPersonalizados = magiasPersonalizadas.filter(m => m.circulo === 0);
  const todosTruques = [
    ...(char.magias_conhecidas || []).filter(m => m.circulo === 0),
    ...truquesPersonalizados
  ];
  const truquesEspecie = todosTruques.filter(m => m.origem === 'especie');
  const _origensTalento = ['iniciado_em_magia', 'tocado_por_fadas', 'tocado_pelas_sombras', 'conjurador_ritualista'];
  const truquesTalento = todosTruques.filter(m => _origensTalento.includes(m.origem));
  const truquesSempre = todosTruques.filter(m => m.origem === 'sempre');
  const truquesClasse = todosTruques.filter(m => !m.personalizada && m.origem !== 'especie' && m.origem !== 'sempre' && !_origensTalento.includes(m.origem));
  const preparadas = char.magias_preparadas || [];
  const espacos = char.espacos_magia || {};

  // Calcular limites de magias preparadas/conhecidas e truques
  // Para subclasses conjuradoras (Cavaleiro Místico / Trapaceiro Arcano), usar tabela da subclasse
  let maxPreparadas = classeData?.tabela_caracteristicas
    ? getMagiaPreparadas(classeData.tabela_caracteristicas, char.nivel) : 0;
  let maxTruques = classeData?.tabela_caracteristicas
    ? getTruquesConhecidos(classeData.tabela_caracteristicas, char.nivel) : 0;

  // Fallback para subclasses conjuradoras se a tabela principal não tem colunas de magias
  if (subConj && maxPreparadas === 0) {
    maxPreparadas = subConj.preparadas || 0;
  }
  if (subConj && maxTruques === 0) {
    maxTruques = subConj.truques || 0;
  }
  // Truques extras de Combatente Druídico / Abençoado
  maxTruques += getTruquesExtraEstiloLuta();
  // Truques extras do Clérigo Taumaturgo / Druida Xamã (utils.js, mesma
  // função que o criador usa -- antes só o criador somava esse bônus, e a
  // ficha calculava o limite sem ele)
  maxTruques += getBonusTruquesOrdem(char);

  // Contar magias preparadas excluindo as especiais (não contam no limite)
  const preparadasNormais = preparadas.filter(m => magiaContaNoLimite(m));
  const preparadasEspeciais = preparadas.filter(m => magiaEhEspecial(m));
  const numPreparadas = preparadasNormais.length;

  // Label dinâmico baseado no tipo de conjuração
  const labelMagias = tipoConj === 'conhecidas' ? 'Magias Conhecidas' : 'Magias Preparadas';

  // Agrupar magias preparadas por círculo
  const preparadasPorCirculo = {};
  preparadas.forEach(m => {
    const circ = m.circulo || 1;
    if (!preparadasPorCirculo[circ]) preparadasPorCirculo[circ] = [];
    const item = m.personalizada
      ? (magiasPersonalizadas.find(mp => mp.nome === m.nome && mp.circulo === circ) || m)
      : m;
    preparadasPorCirculo[circ].push(item);
  });

  // Verificar se é Mago (para grimório)
  const ehMago = char.classe === 'Mago';
  const grimorio = char.grimorio || [];
  const grimorioPorCirculo = grimorio.reduce((grupos, magia) => {
    const circulo = Number(magia.circulo);
    if (!grupos[circulo]) grupos[circulo] = [];
    grupos[circulo].push(magia);
    return grupos;
  }, {});
  Object.values(grimorioPorCirculo).forEach(magias => magias.sort((a, b) => {
    const ritualA = /ritual/i.test(indiceMagiasCache?.find(magia => magia.nome === a.nome)?.tempo_conjuracao || '');
    const ritualB = /ritual/i.test(indiceMagiasCache?.find(magia => magia.nome === b.nome)?.tempo_conjuracao || '');
    return Number(ritualA) - Number(ritualB) || a.nome.localeCompare(b.nome, 'pt-BR');
  }));

  // Mapa de truques modificados por invocacoes do Bruxo (para indicacao visual)
  const truquesModificadosMapa = {};
  if (char?.classe === 'Bruxo' && char.recursos?.bruxo?.invocacoes) {
    const INV_TRUQUE_LABELS = {
      'Explosão Agonizante': '+Carisma ao dano',
      'Explosão Repulsiva': 'Empurra 3m',
      'Lança Mística': 'Alcance aumentado'
    };
    for (const inv of char.recursos.bruxo.invocacoes) {
      const nomeInv = typeof inv === 'string' ? inv : inv.nome;
      const truque = inv?.truque;
      if (truque && INV_TRUQUE_LABELS[nomeInv]) {
        if (!truquesModificadosMapa[truque]) truquesModificadosMapa[truque] = [];
        truquesModificadosMapa[truque].push({ invocacao: nomeInv, efeito: INV_TRUQUE_LABELS[nomeInv] });
      }
    }
  }

  return `
    <div class="card print-break-before">
      <div class="card-header">
        <h2>Magias</h2>
        <div class="no-print" style="display:flex;gap:4px">
          <button class="btn btn-sm btn-accent" id="btn-add-magia">+ Magia</button>
          <button class="btn btn-sm btn-secondary" id="btn-add-magia-custom">Magia Personalizada</button>
        </div>
      </div>
      ${(char._slots_magia_livre || 0) > 0 && tipoConj === 'conhecidas' ? `
        <div class="info-box warning no-print" style="margin:0 0 8px;font-size:0.85rem;display:flex;align-items:center;justify-content:space-between;gap:8px">
          <span>Você tem <strong>${char._slots_magia_livre}</strong> vaga(s) de magia conhecida disponível(is) por ajuste automático.</span>
          <button class="btn btn-sm btn-primary" id="btn-preencher-slot-magia">Escolher</button>
        </div>
      ` : ''}

      <!-- Contador de magias preparadas/conhecidas e truques -->
      <div class="magia-contadores" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px">
        ${maxTruques > 0 ? `
          <div class="magia-contador ${truquesClasse.length > maxTruques ? 'contador-excedido' : truquesClasse.length === maxTruques ? 'contador-cheio' : ''}">
            <span class="contador-label">Truques</span>
            <span class="contador-valor">${truquesClasse.length} / ${maxTruques}</span>
          </div>
        ` : ''}
        ${truquesEspecie.length > 0 ? `
          <div class="magia-contador contador-dominio">
            <span class="contador-label">Truques (Espécie)</span>
            <span class="contador-valor">${truquesEspecie.length}</span>
          </div>
        ` : ''}
        ${truquesTalento.length > 0 ? `
          <div class="magia-contador contador-dominio">
            <span class="contador-label">Truques (Talento)</span>
            <span class="contador-valor">${truquesTalento.length}</span>
          </div>
        ` : ''}
        ${truquesSempre.length > 0 ? `
          <div class="magia-contador contador-dominio">
            <span class="contador-label">Truques (Subclasse)</span>
            <span class="contador-valor">${truquesSempre.length}</span>
          </div>
        ` : ''}
        ${maxPreparadas > 0 ? `
          <div class="magia-contador ${numPreparadas > maxPreparadas ? 'contador-excedido' : numPreparadas === maxPreparadas ? 'contador-cheio' : ''}">
            <span class="contador-label">${labelMagias}</span>
            <span class="contador-valor">${numPreparadas} / ${maxPreparadas}</span>
          </div>
        ` : ''}
        ${preparadasEspeciais.length > 0 ? `
          <div class="magia-contador contador-dominio">
            <span class="contador-label">Especiais</span>
            <span class="contador-valor">${preparadasEspeciais.length}</span>
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
          ${Object.entries(espacos).map(([circ, data]) => {
            const _extrasCirculo = (char.espacos_magia_extras || {})[circ] || 0;
            const _baseTotal = data.total - _extrasCirculo;
            return `
            <div class="slots-grupo">
              <label>${circ}&ordm; Círculo</label>
              <div style="display:flex;gap:4px">
                ${Array.from({ length: data.total }, (_, i) => `
                  <div class="slot-bolha ${i < data.usados ? 'usado' : ''} ${i >= _baseTotal ? 'slot-extra' : ''}" data-slot-circ="${circ}" data-slot-idx="${i}"></div>
                `).join('')}
              </div>
              <span style="font-size:0.75rem;color:var(--text-muted)">
                ${data.total - data.usados}/${data.total}
                ${_extrasCirculo > 0 ? `<span style="color:var(--accent)">(+${_extrasCirculo} FM)</span>` : ''}
              </span>
            </div>`;
          }).join('')}
        </div>
      ` : ''}

      <!-- Dádivas do Pacto (Bruxo) -->
      ${renderSecaoPactoBruxo()}

      <!-- Magias Preparadas por Círculo -->
      ${Object.keys(preparadasPorCirculo).sort((a, b) => parseInt(a) - parseInt(b)).map(circ => {
        const magias = preparadasPorCirculo[circ];
        return `
        <details data-details-id="magias-circulo-${circ}" style="margin-bottom:8px">
          <summary style="font-weight:700;cursor:pointer;padding:6px 0;border-bottom:1px solid var(--border-light)">
            ${circ}º Círculo (${magias.length})
          </summary>
          <div style="padding-top:4px">
            ${magias.filter(m => !m.personalizada).slice().sort((a, b) => prioridadeConjuracao(a.nome) - prioridadeConjuracao(b.nome)).map(m => {
              const ehEspecial = magiaEhEspecial(m);
              const origemLabel = rotuloOrigemMagia(m);
              const circulos = Object.keys(espacos).filter(c => parseInt(c) >= m.circulo).sort((a, b) => parseInt(a) - parseInt(b));
              const temUpcast = circulos.length > 1;
              const todosEsgotados = circulos.every(c => (espacos[c]?.usados || 0) >= (espacos[c]?.total || 0));
              return `
              <div class="magia-item preparada ${ehEspecial ? 'magia-dominio' : ''}" data-magia-nome="${m.nome}" data-magia-circ="${m.circulo}">
                <div style="display:flex;justify-content:space-between;align-items:center">
                  <div>
                    <div class="magia-nome">
                      ${ehEspecial ? `<span class="badge-dominio">&#9733;</span> ` : ''}${m.nome}
                    </div>
                    ${badgesMagiaRapidos(m.nome)}
                    ${ehEspecial ? `<div style="font-size:0.65rem;color:var(--secondary);font-weight:600;margin-top:1px">${origemLabel}</div>` : ''}
                  </div>
                  <div class="no-print" style="display:flex;align-items:center;gap:4px">
                    ${temUpcast ? `
                      <select class="form-input" data-conj-select="${m.nome}" style="width:auto;padding:2px 4px;font-size:0.75rem">
                        ${circulos.map(c => `<option value="${c}"${c == m.circulo ? ' selected' : ''}>${c}º</option>`).join('')}
                      </select>
                    ` : ''}
                    ${(m.gratis_usado === false) ? `<button class="btn btn-sm btn-accent" data-conjurar-gratis="${m.nome}">Grátis</button>` : ''}
                    <button class="btn btn-sm ${todosEsgotados ? 'btn-secondary' : 'btn-primary'}" data-conjurar="${m.nome}" data-conj-circ="${circulos[0] || m.circulo}" ${todosEsgotados ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Conjurar</button>
                  </div>
                </div>
                <div class="magia-desc"></div>
              </div>`;
            }).join('')}
            ${magias.filter(m => m.personalizada).slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).map(m => renderLinhaMagiaPersonalizada(m, m.indicePersonalizada)).join('')}
          </div>
        </details>`;
      }).join('')}

      <!-- Truques -->
      ${todosTruques.length > 0 ? `
        <details id="details-truques"${_truquesColapsados ? '' : ' open'} style="margin-bottom:8px">
          <summary style="font-weight:700;cursor:pointer;padding:6px 0;border-bottom:1px solid var(--border-light)">
            Truques (${truquesClasse.length}${maxTruques ? ' / ' + maxTruques : ''}${truquesEspecie.length > 0 ? ` + ${truquesEspecie.length} espécie` : ''}${truquesTalento.length > 0 ? ` + ${truquesTalento.length} talento` : ''}${truquesSempre.length > 0 ? ` + ${truquesSempre.length} subclasse` : ''})
          </summary>
          <div style="padding-top:4px">
            ${truquesEspecie.slice().sort((a, b) => prioridadeConjuracao(a.nome) - prioridadeConjuracao(b.nome)).map(m => `
              <div class="magia-item magia-dominio" data-magia-nome="${m.nome}" data-magia-circ="0">
                <div style="display:flex;justify-content:space-between;align-items:center">
                  <div>
                    <div class="magia-nome"><span class="badge-dominio">&#9733;</span> ${m.nome}</div>
                    ${badgesMagiaRapidos(m.nome)}
                    <div style="font-size:0.65rem;color:var(--secondary);font-weight:600;margin-top:1px">Espécie</div>
                  </div>
                  <button class="btn btn-sm btn-cantrip" data-lancar-truque="${m.nome}">Lançar</button>
                </div>
                <div class="magia-desc"></div>
              </div>
            `).join('')}
            ${truquesTalento.slice().sort((a, b) => prioridadeConjuracao(a.nome) - prioridadeConjuracao(b.nome)).map(m => `
              <div class="magia-item magia-dominio" data-magia-nome="${m.nome}" data-magia-circ="0">
                <div style="display:flex;justify-content:space-between;align-items:center">
                  <div>
                    <div class="magia-nome"><span class="badge-dominio">&#9733;</span> ${m.nome}</div>
                    ${badgesMagiaRapidos(m.nome)}
                    <div style="font-size:0.65rem;color:var(--secondary);font-weight:600;margin-top:1px">${rotuloOrigemMagia(m)}</div>
                  </div>
                  <button class="btn btn-sm btn-cantrip" data-lancar-truque="${m.nome}">Lançar</button>
                </div>
                <div class="magia-desc"></div>
              </div>
            `).join('')}
            ${truquesSempre.slice().sort((a, b) => prioridadeConjuracao(a.nome) - prioridadeConjuracao(b.nome)).map(m => `
              <div class="magia-item magia-dominio" data-magia-nome="${m.nome}" data-magia-circ="0">
                <div style="display:flex;justify-content:space-between;align-items:center">
                  <div>
                    <div class="magia-nome"><span class="badge-dominio">&#9733;</span> ${m.nome}</div>
                    ${badgesMagiaRapidos(m.nome)}
                    <div style="font-size:0.65rem;color:var(--secondary);font-weight:600;margin-top:1px">Subclasse</div>
                  </div>
                  <button class="btn btn-sm btn-cantrip" data-lancar-truque="${m.nome}">Lançar</button>
                </div>
                <div class="magia-desc"></div>
              </div>
            `).join('')}
            ${truquesClasse.slice().sort((a, b) => prioridadeConjuracao(a.nome) - prioridadeConjuracao(b.nome)).map(m => {
              const mods = truquesModificadosMapa[m.nome] || [];
              const modHtml = mods.length > 0
                ? `<div style="font-size:0.6rem;color:var(--accent);font-weight:600;margin-top:1px">${mods.map(mod => `${mod.invocacao}: ${mod.efeito}`).join(' | ')}</div>`
                : '';
              return `
              <div class="magia-item ${mods.length > 0 ? 'magia-dominio' : ''}" data-magia-nome="${m.nome}" data-magia-circ="0">
                <div style="display:flex;justify-content:space-between;align-items:center">
                  <div>
                    <div class="magia-nome">${mods.length > 0 ? '<span class="badge-dominio">&#9889;</span> ' : ''}${m.nome}</div>
                    ${badgesMagiaRapidos(m.nome)}
                    ${modHtml}
                  </div>
                  <button class="btn btn-sm btn-cantrip" data-lancar-truque="${m.nome}">Lançar</button>
                </div>
                <div class="magia-desc"></div>
              </div>`;
            }).join('')}
            ${truquesPersonalizados.slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).map(m => renderLinhaMagiaPersonalizada(m, m.indicePersonalizada)).join('')}
          </div>
        </details>
      ` : ''}

      <!-- Grimório do Mago -->
      ${ehMago && grimorio.length > 0 ? `
        <details data-details-id="grimorio-mago" style="margin-bottom:8px">
          <summary style="font-weight:700;cursor:pointer;padding:6px 0;border-bottom:1px solid var(--border-light);color:var(--accent)">
            Grimório (${grimorio.length} magias)
          </summary>
          <div style="padding-top:4px;font-size:0.8rem;color:var(--text-muted);margin-bottom:6px">
            Livro de Magias. Prepare magias a partir daqui (limite: ${maxPreparadas}). Magias com marcador Ritual podem ser conjuradas sem preparar.
          </div>
          <div style="padding-top:4px">
            ${Object.keys(grimorioPorCirculo).sort((a, b) => Number(a) - Number(b)).map(circ => {
              const magiasDoCirculo = grimorioPorCirculo[circ];
              return `
              <details data-details-id="grimorio-mago-circulo-${circ}" open style="margin-bottom:10px">
                <summary class="section-divider" style="margin:4px 0 6px;cursor:pointer"><span>${circ}º Círculo (${magiasDoCirculo.length})</span></summary>
                ${magiasDoCirculo.map(m => {
              const jaPreparada = preparadas.some(p => p.nome === m.nome);
              const infoMagia = indiceMagiasCache?.find(im => im.nome === m.nome);
              const ehRitual = infoMagia?.tempo_conjuracao && /ritual/i.test(infoMagia.tempo_conjuracao);
              const circulos = Object.keys(espacos).filter(c => parseInt(c) >= m.circulo).sort((a, b) => parseInt(a) - parseInt(b));
              const temUpcast = circulos.length > 1;
              const todosEsgotados = circulos.every(c => (espacos[c]?.usados || 0) >= (espacos[c]?.total || 0));
              return `
              <div class="magia-item ${jaPreparada ? 'preparada' : ''} ${ehRitual && !jaPreparada ? 'magia-dominio' : ''}" data-magia-nome="${m.nome}" data-magia-circ="${m.circulo}">
                <div style="display:flex;justify-content:space-between;align-items:center">
                  <div style="opacity:${jaPreparada || ehRitual ? '1' : '0.7'}">
                    <div class="magia-nome">${m.nome} ${jaPreparada ? '<span class="badge badge-success" style="font-size:0.6rem">Preparada</span>' : ''}${ehRitual ? ' <span class="badge" style="font-size:0.6rem;background:var(--secondary);color:#fff">Ritual</span>' : ''}</div>
                    <div class="magia-meta"><span>${m.circulo}º Círculo</span></div>
                    ${!jaPreparada && !ehRitual ? '<div style="font-size:0.65rem;color:var(--text-muted);font-style:italic">Não preparada</div>' : ''}
                  </div>
                  <div class="no-print" style="display:flex;gap:4px;align-items:center">
                    ${jaPreparada ? `
                      ${temUpcast ? `
                        <select class="form-input" data-conj-select="${m.nome}" style="width:auto;padding:2px 4px;font-size:0.75rem">
                          ${circulos.map(c => `<option value="${c}"${c == m.circulo ? ' selected' : ''}>${c}º</option>`).join('')}
                        </select>
                      ` : ''}
                      <button class="btn btn-sm ${todosEsgotados ? 'btn-secondary' : 'btn-primary'}" data-conjurar="${m.nome}" data-conj-circ="${circulos[0] || m.circulo}" ${todosEsgotados ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Conjurar</button>
                      <button class="btn btn-sm btn-secondary" data-despreparar-grimorio="${m.nome}" title="Despreparar">✕</button>
                    ` : `
                      <button class="btn btn-sm btn-accent" data-preparar-grimorio="${m.nome}" data-prep-circ="${m.circulo}">Preparar</button>
                      ${ehRitual ? `<button class="btn btn-sm btn-secondary" data-conjurar-pacto="${m.nome}" title="Conjurar como Ritual (sem gastar espaço)">Ritual</button>` : ''}
                    `}
                    <button class="btn btn-sm btn-danger btn-icon" data-remover-grimorio="${m.nome}" title="Remover do grimório">&times;</button>
                  </div>
                </div>
                <div class="magia-desc"></div>
              </div>`;
                }).join('')}
              </details>`;
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

      <!-- Magias Customizadas (círculo > 0) não preparadas: garante local visível para editar/remover -->
      ${(() => {
        const naoPreparadas = magiasPersonalizadas.filter(m => m.circulo > 0 && !preparadas.some(p => p.nome === m.nome));
        return naoPreparadas.length > 0 ? `
        <details data-details-id="magias-customizadas-circulo" style="margin-bottom:8px">
          <summary style="font-weight:700;cursor:pointer;padding:6px 0;border-bottom:1px solid var(--border-light);color:var(--accent)">
            Magias Customizadas (${naoPreparadas.length})
          </summary>
          <div style="padding-top:4px">
            ${naoPreparadas.slice().sort((a, b) => a.circulo - b.circulo || a.nome.localeCompare(b.nome, 'pt-BR')).map(m => renderLinhaMagiaPersonalizada(m, m.indicePersonalizada, { naoPreparada: true })).join('')}
          </div>
        </details>
      ` : '';
      })()}
    </div>
  `;
}

// Mapa unificado de magias com efeitos mecanicos quando conjuradas
// Opcoes de Metamagia (Feiticeiro) - constante global para uso no cast engine e config
export const OPCOES_METAMAGIA = [
  { nome: 'Magia Acelerada', custo: 2, desc: 'Ao conjurar uma magia com tempo de 1 ação, gaste 2 PF para mudar para Ação Bônus.', validar: (info) => info && /^Ação$/i.test((info.tempo_conjuracao || '').trim()), combina: false },
  { nome: 'Magia Agravada', custo: 2, desc: 'Ao conjurar com teste de resistência, gaste 2 PF para dar Desvantagem na salvaguarda.', validar: null, combina: false },
  { nome: 'Magia Buscadora', custo: 1, desc: 'Jogada de ataque com magia que erra: gaste 1 PF para re-jogar (deve usar o novo resultado).', validar: null, combina: true },
  { nome: 'Magia Cautelosa', custo: 1, desc: 'Ao conjurar com salvaguarda, gaste 1 PF e escolha criaturas = mod. Car. que passam automaticamente.', validar: null, combina: false },
  { nome: 'Magia Distante', custo: 1, desc: 'Magia com alcance 1,5m+: gaste 1 PF para dobrar. Alcance Toque vira 9m.', validar: (info) => info && info.alcance && !/pessoal/i.test(info.alcance), combina: false },
  { nome: 'Magia Duplicada', custo: 1, desc: 'Magia que mira apenas uma criatura e não tem auto-alcance: gaste 1 PF para mirar uma segunda.', validar: (info) => info && info.alcance && !/pessoal/i.test(info.alcance), combina: false },
  { nome: 'Magia Persistente', custo: 1, desc: 'Ao conjurar com Concentração e duração 1 min+: gaste 1 PF, não requer Concentração por 1 min.', validar: (info) => info && /concentra/i.test(info.duracao || ''), combina: false },
  { nome: 'Magia Potencializada', custo: 1, desc: 'Ao rolar dano de magia: gaste 1 PF para re-jogar até mod. Car. dados de dano (deve usar novos).', validar: null, combina: true },
  { nome: 'Magia Sutil', custo: 1, desc: 'Ao conjurar: gaste 1 PF para conjurar sem componentes Verbais ou Somáticos.', validar: (info) => info && /[VS]/.test(info.componentes || 'V, S'), combina: false },
  { nome: 'Magia Transmutada', custo: 1, desc: 'Ao conjurar com dano: gaste 1 PF para trocar tipo de dano por Ácido/Elétrico/Gélido/Ígneo/Trovejante/Venenoso.', validar: null, combina: false }
];

const MAGIAS_EFEITO = {
  // --- Efeitos de CA (ja implementados) ---
  'Armadura Arcana':  { tipo_efeito: 'base', valor: 13, concentracao: false, permite_self: true, permite_outro: true, rotulo: 'CA = 13 + Des' },
  'Escudo Arcano':    { tipo_efeito: 'bonus', valor: 5, concentracao: false, permite_self: true, permite_outro: false, rotulo: '+5 CA (1 rodada)' },
  'Escudo da Fé':     { tipo_efeito: 'bonus', valor: 2, concentracao: true, permite_self: true, permite_outro: true, rotulo: '+2 CA (concentração)' },
  'Pele-Casca':       { tipo_efeito: 'minimo', valor: 17, concentracao: true, permite_self: true, permite_outro: true, rotulo: 'CA mín. 17 (concentração)' },
  'Vínculo de Proteção': { tipo_efeito: null, concentracao: false, permite_self: false, permite_outro: true, rotulo: 'Apenas outro alvo' },
  'Celeridade':       { tipo_efeito: 'bonus', valor: 2, concentracao: true, permite_self: true, permite_outro: true, rotulo: '+2 CA (concentração)' },
  'Lentidão':         { tipo_efeito: null, concentracao: true, permite_self: false, permite_outro: true, rotulo: 'Apenas inimigos' },

  // --- PV Temporarios ---
  'Vitalidade Vazia': { tipo: 'pv_temp', media: 9, concentracao: false, permite_self: true, permite_outro: false, rotulo: 'PV Temp: 2d4+4 (média 9)' },

  // --- Reflexos (copias ilusorias) ---
  'Reflexos': { tipo: 'reflexos', copias: 3, concentracao: false, permite_self: true, permite_outro: false, rotulo: '3 Cópias Ilusórias' },

  // --- Penalidade de ataque contra o conjurador ---
  'Proteção Contra Lâminas': { tipo: 'penalidade_ataque', valor: '1d4', concentracao: true, permite_self: true, permite_outro: false, rotulo: 'Atacantes -1d4 (concentração)', truque: true },

  // --- Condicoes ---
  'Invisibilidade':       { tipo: 'condicao', condicao: 'Invisível', encerra_ao_atacar: true, concentracao: true, permite_self: true, permite_outro: true, rotulo: 'Invisível (encerra ao atacar)' },
  'Invisibilidade Maior': { tipo: 'condicao', condicao: 'Invisível', encerra_ao_atacar: false, concentracao: true, permite_self: true, permite_outro: true, rotulo: 'Invisível (não encerra ao atacar)' },
  'Despistar':            { tipo: 'condicao', condicao: 'Invisível + Cópia', encerra_ao_atacar: true, concentracao: true, permite_self: true, permite_outro: false, rotulo: 'Invisível + Cópia Ilusória' },
  'Forma Gasosa':         { tipo: 'condicao', condicao: 'Forma Gasosa', concentracao: true, permite_self: true, permite_outro: true, rotulo: 'Forma Gasosa (voo 3m, resistências, não ataca)' },
  'Santuário':            { tipo: 'condicao', condicao: 'Santuário', encerra_ao_atacar: true, concentracao: false, permite_self: true, permite_outro: true, rotulo: 'Santuário (encerra ao atacar/conjurar)' },
  'Simular Morte':        { tipo: 'condicao', condicao: 'Simular Morte', concentracao: false, permite_self: true, permite_outro: true, rotulo: 'Aparenta estar morto' },
  'Mesclar-se às Rochas': { tipo: 'condicao', condicao: 'Mesclado às Rochas', concentracao: false, permite_self: true, permite_outro: false, rotulo: 'Fundido em rocha/terra' },

  // --- Resistencia temporaria ---
  'Proteção Contra Energia': { tipo: 'resistencia', tipos_dano: null, selecionar_tipo: ['Ácido', 'Elétrico', 'Gélido', 'Ígneo', 'Trovejante'], concentracao: true, permite_self: true, permite_outro: true, rotulo: 'Resistência a 1 tipo (escolher)' },
  'Pele-Rocha':              { tipo: 'resistencia', tipos_dano: ['Contundente', 'Cortante', 'Perfurante'], concentracao: true, permite_self: true, permite_outro: true, rotulo: 'Resist. Contundente/Cortante/Perfurante' },

  // --- Resistencia + imunidade veneno ---
  'Proteção Contra Veneno': { tipo: 'composto', efeitos: [
    { tipo: 'resistencia', tipos_dano: ['Venenoso'] },
    { tipo: 'buff_save_condicao', condicao: 'Envenenado', bonus: 'vantagem' },
    { tipo: 'remover_condicao', condicao: 'Envenenado' }
  ], concentracao: false, permite_self: true, permite_outro: true, rotulo: 'Resist. Venenoso + Vant. SG Envenenado' },

  // --- Protecao contra entidades ---
  'Proteção Contra o Bem e o Mal': { tipo: 'protecao', concentracao: true, permite_self: true, permite_outro: true, rotulo: 'Proteção vs Aber./Cel./Elem./Feér./Ínf./M-V' },

  // --- Aura de pureza ---
  'Aura de Pureza': { tipo: 'composto', efeitos: [
    { tipo: 'resistencia', tipos_dano: ['Venenoso'] },
    { tipo: 'vantagem_sg_condicoes', condicoes: ['Amedrontado', 'Atordoado', 'Cego', 'Enfeitiçado', 'Envenenado', 'Paralisado', 'Surdo'] }
  ], concentracao: true, permite_self: true, permite_outro: false, rotulo: 'Aura 9m: Resist. Venenoso + Vant. SG condições' },

  // --- Buff d20 ---
  'Bênção': { tipo: 'buff_d20', bonus: '+1d4', aplica_em: ['ataque', 'salvaguarda'], concentracao: true, permite_self: true, permite_outro: true, rotulo: '+1d4 ataques e salvaguardas' },

  // --- Buff arma ---
  'Arma Mágica':   { tipo: 'buff_arma', bonus_ataque: 1, bonus_dano: 1, concentracao: false, permite_self: true, permite_outro: true, rotulo: '+1 ataque e dano (arma)' },
  'Arma Elemental': { tipo: 'buff_arma', bonus_ataque: 1, dano_extra: '1d4', selecionar_tipo: ['Ácido', 'Elétrico', 'Gélido', 'Ígneo', 'Trovejante'], concentracao: true, permite_self: true, permite_outro: true, rotulo: '+1 ataque + 1d4 elemental (arma)' },
  'Aljava Veloz':   { tipo: 'buff_arma', mecanica: 'ataque_bonus', concentracao: true, permite_self: true, permite_outro: false, rotulo: '2 ataques ranged como Ação Bônus' },

  // --- Buff salvaguarda contra magias ---
  'Círculo de Poder': { tipo: 'buff_d20', bonus: 'vantagem', aplica_em: ['salvaguarda_magias'], concentracao: true, permite_self: true, permite_outro: false, rotulo: 'Aura 9m: Vant. SG vs magias' },
  'Aura Sagrada': { tipo: 'composto', efeitos: [
    { tipo: 'buff_d20', bonus: 'vantagem', aplica_em: ['salvaguarda'] },
    { tipo: 'desv_ataques_contra_mim' }
  ], concentracao: true, permite_self: true, permite_outro: false, rotulo: 'Aura: Vant. TODAS SG + Desv. ataques contra' },

  // --- Buff deslocamento ---
  'Passos Largos':           { tipo: 'deslocamento', tipo_velocidade: 'base_bonus', valor_metros: 3, concentracao: false, permite_self: true, permite_outro: true, rotulo: '+3m deslocamento' },
  'Retirada Acelerada':      { tipo: 'deslocamento', tipo_velocidade: 'dash_acao_bonus', concentracao: true, permite_self: true, permite_outro: false, rotulo: 'Disparada como Ação Bônus' },
  'Escalada de Aranha':      { tipo: 'deslocamento', tipo_velocidade: 'escalada', concentracao: true, permite_self: true, permite_outro: true, rotulo: 'Escalada = deslocamento base' },
  'Levitação':               { tipo: 'deslocamento', tipo_velocidade: 'levitacao', valor_metros: 6, concentracao: true, permite_self: true, permite_outro: true, rotulo: 'Levitação (6m vertical/turno)' },
  'Voo':                     { tipo: 'deslocamento', tipo_velocidade: 'voo', valor_metros: 18, concentracao: true, permite_self: true, permite_outro: true, rotulo: 'Voo 18m' },
  'Movimentação Livre':      { tipo: 'deslocamento', tipo_velocidade: 'nao_impedido', concentracao: false, permite_self: true, permite_outro: true, rotulo: 'Sem restrição de movimento' },
  'Caminhar Sobre as Águas': { tipo: 'deslocamento', tipo_velocidade: 'sobre_liquidos', concentracao: false, permite_self: true, permite_outro: true, rotulo: 'Caminhar sobre líquidos' },
  'Caminhar no Vento':       { tipo: 'deslocamento', tipo_velocidade: 'voo', valor_metros: 48, concentracao: false, permite_self: true, permite_outro: true, rotulo: 'Voo 48m (8h)' },

  // --- Buff pericia ---
  'Passo Sem Rastro':  { tipo: 'bonus_pericia', pericia: 'Furtividade', bonus: 10, concentracao: true, permite_self: true, permite_outro: false, rotulo: 'Aura 9m: +10 Furtividade' },
  'Aprimorar Atributo': { tipo: 'bonus_pericia', selecionar_atributo: ['Força', 'Destreza', 'Inteligência', 'Sabedoria', 'Carisma'], bonus: 'vantagem', concentracao: true, permite_self: true, permite_outro: true, rotulo: 'Vant. testes do atributo (escolher)' },

  // --- Cura PV ---
  'Cura Completa':          { tipo: 'cura_pv', valor: 70, remove_condicoes: ['Cego', 'Envenenado', 'Surdo'], concentracao: false, permite_self: true, permite_outro: true, rotulo: 'Cura 70 PV + remove Cego/Envenenado/Surdo' },
  'Cura Completa em Massa': { tipo: 'cura_pv', valor: 70, remove_condicoes: ['Cego', 'Envenenado', 'Surdo'], concentracao: false, permite_self: true, permite_outro: true, rotulo: 'Cura 70 PV (até 6 criaturas)' },
  'Reviver os Mortos':      { tipo: 'cura_pv', valor: 1, penalidade: -4, concentracao: false, permite_self: false, permite_outro: true, rotulo: 'Revive com 1 PV (penalidade -4 d20)' },
  'Ressurreição':           { tipo: 'cura_pv', valor: 'max', penalidade: -4, concentracao: false, permite_self: false, permite_outro: true, rotulo: 'Revive com PV máx (penalidade -4 d20)' },

  // --- Cura condicao ---
  'Restauração Menor': { tipo: 'cura_condicao', condicoes: ['Cego', 'Envenenado', 'Paralisado', 'Surdo'], concentracao: false, permite_self: true, permite_outro: true, rotulo: 'Remove 1 condição' },
  'Restauração Maior': { tipo: 'cura_condicao', efeitos: ['Exaustão (1 nível)', 'Enfeitiçado', 'Petrificado', 'Maldição', 'Redução de atributo', 'Redução de PV máximos'], concentracao: false, permite_self: true, permite_outro: true, rotulo: 'Remove 1 efeito severo' },
  'Limpar a Mente': { tipo: 'composto', efeitos: [
    { tipo: 'imunidade_condicao', condicao: 'Enfeitiçado' },
    { tipo: 'resistencia', tipos_dano: ['Psíquico'] }
  ], concentracao: false, permite_self: true, permite_outro: true, rotulo: 'Imune Enfeitiçado + Resist. Psíquico (24h)' },

  // --- Efeitos compostos ---
  'Armadura de Agathys': { tipo: 'composto', escala_circulo: true, efeitos: [
    { tipo: 'pv_temp', formula_circ: 5 },
    { tipo: 'dano_reativo', dano_circ: 5, tipo_dano: 'Gélido' }
  ], concentracao: false, permite_self: true, permite_outro: false, rotulo: 'PV Temp + Dano Gélido reativo (5×círculo)' },

  'Heroísmo': { tipo: 'composto', efeitos: [
    { tipo: 'pv_temp_por_turno', valor: 'mod_conj' },
    { tipo: 'imunidade_condicao', condicao: 'Amedrontado' }
  ], concentracao: true, permite_self: true, permite_outro: true, rotulo: 'PV Temp/turno + Imune Amedrontado' },

  'Escudo Ardente': { tipo: 'composto', selecionar_variante: {
    'Escudo Quente (Resist. Gélido, dano 2d8 Ígneo)': { resistencia: 'Gélido', dano_reativo: '2d8 Ígneo' },
    'Escudo Frio (Resist. Ígneo, dano 2d8 Gélido)': { resistencia: 'Ígneo', dano_reativo: '2d8 Gélido' }
  }, concentracao: false, permite_self: true, permite_outro: false, rotulo: 'Resist. + Dano reativo (Quente/Frio)' },

  'Aura de Vida': { tipo: 'composto', efeitos: [
    { tipo: 'resistencia', tipos_dano: ['Necrótico'] },
    { tipo: 'protecao_pv_max' }
  ], concentracao: true, permite_self: true, permite_outro: false, rotulo: 'Aura 9m: Resist. Necrótico + PV máx protegidos' },

  'Banquete de Heróis': { tipo: 'composto', efeitos: [
    { tipo: 'resistencia', tipos_dano: ['Venenoso'] },
    { tipo: 'imunidade_condicao', condicao: 'Amedrontado' },
    { tipo: 'imunidade_condicao', condicao: 'Envenenado' },
    { tipo: 'bonus_pv_max', media: 11 }
  ], concentracao: false, permite_self: true, permite_outro: true, rotulo: 'Resist. Venenoso + Imunidades + PV máx +2d10 (24h)' }
};

// Retorna o nome da magia de concentracao ativa (ou null)
export function getConcentracaoAtiva() {
  const efMag = char.efeitos_magicos || [];
  const ef = efMag.find(e => e.concentracao);
  return ef ? ef.nome.replace(/ \(.*\)$/, '') : null;
}

// Verifica se uma magia e de concentracao (via MAGIAS_EFEITO ou indiceMagiasCache)
function ehMagiaConcentracao(nomeMagia) {
  const config = MAGIAS_EFEITO[nomeMagia];
  if (config) return !!config.concentracao;
  const info = indiceMagiasCache?.find(m => m.nome === nomeMagia);
  if (info?.duracao) return /concentra/i.test(info.duracao);
  return false;
}

// Busca info de magia no cache do indice para validacao de metamagia
function getInfoMagiaParaMetamagia(nomeMagia) {
  if (!indiceMagiasCache?.length) return null;
  return indiceMagiasCache.find(m => m.nome === nomeMagia) || null;
}

// Modal de seleção de metamagia durante a conjuração (Feiticeiro)
function mostrarModalMetamagiaConjuracao(nomeMagia, circulo, onSelecao) {
  const estado = getEstadoRecursosFeiticeiro();
  if (!estado) { onSelecao([], {}); return; }

  const metamagiasConhecidas = estado.metamagias || [];
  if (metamagiasConhecidas.length === 0) { onSelecao([], {}); return; }

  const infoMagia = getInfoMagiaParaMetamagia(nomeMagia);
  const feiticariaEncarnada = estado.feiticariaInataAtiva;
  const nivelChar = char.nivel || 1;
  const temApoteose = nivelChar >= 20;
  const apoteoseGratisUsado = char.recursos?.feiticeiro?.apoteose_gratis_usado_turno || false;

  // Maximo de metamagias por conjuracao (regra base: 1, Encarnada: 2)
  // Excecao: Buscadora e Potencializada podem combinar com outra opcao
  const maxPorConjuracao = feiticariaEncarnada ? 2 : 1;

  const opcoesDisponiveis = OPCOES_METAMAGIA.filter(o => metamagiasConhecidas.includes(o.nome));
  const selecionadas = new Set();

  function calcularCustos() {
    let custoTotal = 0;
    let gratisUsado = false;
    for (const nome of selecionadas) {
      const op = OPCOES_METAMAGIA.find(o => o.nome === nome);
      if (!op) continue;
      if (temApoteose && !apoteoseGratisUsado && !gratisUsado) {
        gratisUsado = true;
      } else {
        custoTotal += op.custo;
      }
    }
    return { custoTotal, gratisUsado };
  }

  function podeAdicionarOpcao(nomeOpcao) {
    if (selecionadas.has(nomeOpcao)) return true; // remover sempre pode
    const op = OPCOES_METAMAGIA.find(o => o.nome === nomeOpcao);
    if (!op) return false;

    // Verificar elegibilidade da opcao para esta magia
    if (op.validar && !op.validar(infoMagia)) return false;

    if (selecionadas.size < maxPorConjuracao) return true;

    // Acima do limite base: verificar combinacao Buscadora/Potencializada
    if (selecionadas.size >= 2) return false;
    // Tamanho == maxPorConjuracao (1 sem Encarnada): permitir apenas combinacao
    const selArray = [...selecionadas];
    const todasCombinaveis = selArray.every(n => OPCOES_METAMAGIA.find(x => x.nome === n)?.combina);
    return op.combina && todasCombinaveis;
  }

  function renderModalMetaConjuracao() {
    const pfAtuais = estado.pontosMax - (char.recursos.feiticeiro.pontos_feiticaria_gastos || 0);
    const { custoTotal } = calcularCustos();

    let html = `<div style="text-align:center;margin-bottom:8px">
      <strong>${nomeMagia}</strong> (${circulo}º Círculo)
      <div style="font-size:0.8rem;color:var(--text-muted);margin-top:4px">PF disponíveis: <strong>${pfAtuais}</strong>${custoTotal > 0 ? ` | Custo: <strong style="color:var(--danger)">${custoTotal} PF</strong>` : ''}</div>
      <div style="font-size:0.75rem;color:var(--text-muted)">Máx. ${maxPorConjuracao} opç${maxPorConjuracao > 1 ? 'ões' : 'ão'} por conjuração${feiticariaEncarnada ? ' (Feitiçaria Encarnada)' : ''}${temApoteose && !apoteoseGratisUsado ? ' | Apoteose: 1ª grátis' : ''}</div>
    </div>`;

    html += '<div style="display:flex;flex-direction:column;gap:6px">';
    for (const op of opcoesDisponiveis) {
      const sel = selecionadas.has(op.nome);
      const elegivel = !op.validar || op.validar(infoMagia);
      const podeCombinar = podeAdicionarOpcao(op.nome);

      // Custo efetivo para exibicao
      let custoExibir = op.custo;
      if (temApoteose && !apoteoseGratisUsado) {
        const { gratisUsado } = calcularCustos();
        if (!gratisUsado && !sel && selecionadas.size === 0) custoExibir = 0;
        if (sel && selecionadas.size === 1 && !gratisUsado) custoExibir = 0;
      }

      const { custoTotal: custoAtual } = calcularCustos();
      const semPF = !sel && custoExibir > 0 && (custoAtual + op.custo) > pfAtuais;
      const bloqueado = (!elegivel || (!sel && !podeCombinar) || semPF) && !sel;

      html += `
        <div data-meta-cast="${op.nome}"
             style="padding:8px 10px;border-radius:6px;border:1px solid ${sel ? 'var(--primary)' : 'var(--border-light)'};background:${sel ? 'var(--bg-active, rgba(var(--primary-rgb,59,130,246),0.1))' : 'var(--bg-card)'};${bloqueado ? 'opacity:0.4;cursor:not-allowed;' : 'cursor:pointer;'}">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div>
              <strong style="font-size:0.85rem">${sel ? '✓ ' : ''}${op.nome}</strong>
              ${!elegivel ? '<span style="font-size:0.65rem;color:var(--danger);margin-left:4px">(N/A para esta magia)</span>' : ''}
              ${semPF ? '<span style="font-size:0.65rem;color:var(--danger);margin-left:4px">(PF insuf.)</span>' : ''}
            </div>
            <span style="font-size:0.75rem;color:var(--text-muted)">${custoExibir === 0 ? 'Grátis' : op.custo + ' PF'}</span>
          </div>
          <div style="font-size:0.72rem;color:var(--text-muted);margin-top:2px">${op.desc}</div>
        </div>`;
    }
    html += '</div>';
    return html;
  }

  abrirModal('Metamagia', `
    <div id="metamagia-cast-container">${renderModalMetaConjuracao()}</div>
  `, `
    <button class="btn btn-secondary" id="meta-cast-pular">Sem Metamagia</button>
    <button class="btn btn-primary" id="meta-cast-aplicar">Aplicar e Conjurar</button>
  `);

  function attachMetaCastListeners() {
    document.querySelectorAll('[data-meta-cast]').forEach(el => {
      el.addEventListener('click', () => {
        const nome = el.dataset.metaCast;
        if (selecionadas.has(nome)) {
          selecionadas.delete(nome);
        } else {
          if (!podeAdicionarOpcao(nome)) {
            if (selecionadas.size >= maxPorConjuracao) {
              toast(`Máx. ${maxPorConjuracao} metamagia(s) por conjuração.`, 'error');
            }
            return;
          }
          selecionadas.add(nome);
        }
        const container = document.getElementById('metamagia-cast-container');
        if (container) container.innerHTML = renderModalMetaConjuracao();
        attachMetaCastListeners();
      });
    });
  }
  attachMetaCastListeners();

  document.getElementById('meta-cast-pular')?.addEventListener('click', () => {
    window.fecharModal();
    onSelecao([], {});
  });

  document.getElementById('meta-cast-aplicar')?.addEventListener('click', () => {
    const selecionadasArray = [...selecionadas];
    if (selecionadasArray.length === 0) {
      window.fecharModal();
      onSelecao([], {});
      return;
    }

    // Se Magia Transmutada foi selecionada, perguntar tipo de dano
    if (selecionadasArray.includes('Magia Transmutada')) {
      const tipos = ['Ácido', 'Elétrico', 'Gélido', 'Ígneo', 'Trovejante', 'Venenoso'];
      const container = document.getElementById('metamagia-cast-container');
      if (container) {
        container.innerHTML = `
          <div style="text-align:center;margin-bottom:12px">
            <strong>Magia Transmutada</strong>
            <div style="font-size:0.8rem;color:var(--text-muted)">Escolha o novo tipo de dano:</div>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center">
            ${tipos.map(t => `<button class="btn btn-secondary" data-meta-dano="${t}">${t}</button>`).join('')}
          </div>`;
        tipos.forEach(t => {
          document.querySelector(`[data-meta-dano="${t}"]`)?.addEventListener('click', () => {
            window.fecharModal();
            onSelecao(selecionadasArray, { tipo_dano_transmutado: t });
          });
        });
      }
      return;
    }

    window.fecharModal();
    onSelecao(selecionadasArray, {});
  });
}

// Aplica efeito mecanico de uma opcao de metamagia na conjuracao
function _aplicarEfeitoMetamagia(metaNome, nomeMagia, circ) {
  if (!char.efeitos_magicos) char.efeitos_magicos = [];

  switch (metaNome) {
    case 'Magia Persistente': {
      // Remover flag de concentracao do efeito da magia recem-aplicada
      const efConc = char.efeitos_magicos.find(e => {
        const base = e.nome.replace(/ \(.*\)$/, '');
        return base === nomeMagia && e.concentracao;
      });
      if (efConc) {
        efConc.concentracao = false;
        efConc.metamagia_persistente = true;
        efConc.rotulo = (efConc.rotulo || '') + ' [Persistente]';
      }
      break;
    }
    case 'Magia Cautelosa': {
      const modCar = Math.max(1, calcMod(char.atributos.carisma));
      char.efeitos_magicos.push({
        nome: `${nomeMagia} (Cautelosa)`,
        tipo: 'metamagia_info',
        concentracao: false,
        circulo: parseInt(circ) || 0,
        rotulo: `Cautelosa: ${modCar} criatura(s) passam auto na SG`,
        temporario: true
      });
      break;
    }
    case 'Magia Agravada': {
      char.efeitos_magicos.push({
        nome: `${nomeMagia} (Agravada)`,
        tipo: 'metamagia_info',
        concentracao: false,
        circulo: parseInt(circ) || 0,
        rotulo: 'Agravada: Desvantagem na salvaguarda',
        temporario: true
      });
      break;
    }
    case 'Magia Distante': {
      char.efeitos_magicos.push({
        nome: `${nomeMagia} (Distante)`,
        tipo: 'metamagia_info',
        concentracao: false,
        circulo: parseInt(circ) || 0,
        rotulo: 'Distante: Alcance dobrado',
        temporario: true
      });
      break;
    }
    case 'Magia Duplicada': {
      char.efeitos_magicos.push({
        nome: `${nomeMagia} (Duplicada)`,
        tipo: 'metamagia_info',
        concentracao: false,
        circulo: parseInt(circ) || 0,
        rotulo: 'Duplicada: +1 alvo adicional',
        temporario: true
      });
      break;
    }
    case 'Magia Buscadora': {
      char.efeitos_magicos.push({
        nome: `${nomeMagia} (Buscadora)`,
        tipo: 'metamagia_info',
        concentracao: false,
        circulo: parseInt(circ) || 0,
        rotulo: 'Buscadora: Re-jogar ataque se errar',
        temporario: true
      });
      break;
    }
    case 'Magia Potencializada': {
      const modCar = Math.max(1, calcMod(char.atributos.carisma));
      char.efeitos_magicos.push({
        nome: `${nomeMagia} (Potencializada)`,
        tipo: 'metamagia_info',
        concentracao: false,
        circulo: parseInt(circ) || 0,
        rotulo: `Potencializada: Re-jogar até ${modCar} dado(s) de dano`,
        temporario: true
      });
      break;
    }
    case 'Magia Transmutada': {
      // Tipo de dano eh registrado via opcoesMeta.tipo_dano_transmutado no historico
      break;
    }
    // Magia Acelerada e Magia Sutil: efeitos puramente informativos, sem estado adicional
  }
}

// Processa todas as metamagias selecionadas para uma conjuracao, gasta PF e aplica efeitos
function _processarMetamagiasConjuracao(metamagiasAplicadas, opcoesMeta, nomeMagia, circ) {
  const estado = getEstadoRecursosFeiticeiro();
  if (!estado) return '';

  const temApoteose = (char.nivel || 1) >= 20;
  let gratisUsada = false;
  const detalhes = [];

  // Limpar efeitos temporarios de metamagia anteriores
  if (char.efeitos_magicos) {
    char.efeitos_magicos = char.efeitos_magicos.filter(e => !e.temporario);
  }

  for (const metaNome of metamagiasAplicadas) {
    const op = OPCOES_METAMAGIA.find(o => o.nome === metaNome);
    if (!op) continue;

    // Custo (Apoteose Arcana: primeira gratis por turno)
    let custo = op.custo;
    if (temApoteose && !(char.recursos.feiticeiro.apoteose_gratis_usado_turno) && !gratisUsada) {
      custo = 0;
      gratisUsada = true;
      char.recursos.feiticeiro.apoteose_gratis_usado_turno = true;
    }

    if (custo > 0) {
      if (!gastarPontosFeiticaria(custo)) {
        toast(`PF insuficientes para ${metaNome}.`, 'error');
        continue;
      }
    }

    _aplicarEfeitoMetamagia(metaNome, nomeMagia, circ);

    let detalheExtra = '';
    if (metaNome === 'Magia Transmutada' && opcoesMeta?.tipo_dano_transmutado) {
      detalheExtra = ` → ${opcoesMeta.tipo_dano_transmutado}`;
    }
    detalhes.push(`${metaNome}${detalheExtra}${custo > 0 ? ` (-${custo} PF)` : ' (grátis)'}`);
  }

  // Registrar no historico de metamagias
  if (!char.recursos.feiticeiro.metamagia_historico) char.recursos.feiticeiro.metamagia_historico = [];
  char.recursos.feiticeiro.metamagia_historico.push({
    magia: nomeMagia,
    circulo: parseInt(circ),
    metamagias: [...metamagiasAplicadas],
    opcoes: opcoesMeta || {},
    timestamp: Date.now()
  });
  // Manter apenas ultimos 20 registros
  if (char.recursos.feiticeiro.metamagia_historico.length > 20) {
    char.recursos.feiticeiro.metamagia_historico = char.recursos.feiticeiro.metamagia_historico.slice(-20);
  }

  return detalhes.length > 0 ? ` [${detalhes.join(', ')}]` : '';
}

// Modal de confirmacao para substituir concentracao ativa
function confirmarSubstituirConcentracao(magiaAtual, magiaNova, onConfirmar, onCancelar) {
  const magiaAtualSegura = escHtml(String(magiaAtual || ''));
  const magiaNovaSegura = escHtml(String(magiaNova || ''));
  abrirModal('Substituir Concentração', `
    <div style="text-align:center;margin-bottom:12px">
      <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:8px">Você está concentrado em:</div>
      <div style="font-size:1.1rem;font-weight:700;color:var(--warning);margin-bottom:12px">${magiaAtualSegura}</div>
      <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:4px">Conjurar <strong>${magiaNovaSegura}</strong> cancelará a concentração atual.</div>
      <div style="font-size:0.8rem;color:var(--danger);margin-top:8px">Deseja continuar?</div>
    </div>
    <div style="display:flex;gap:8px;justify-content:center;margin-top:16px">
      <button class="btn btn-danger" id="conc-confirmar">Sim, conjurar ${magiaNovaSegura}</button>
      <button class="btn btn-secondary" id="conc-cancelar">Cancelar</button>
    </div>
  `, '');
  document.getElementById('conc-confirmar')?.addEventListener('click', () => { window.fecharModal(); onConfirmar(); });
  document.getElementById('conc-cancelar')?.addEventListener('click', () => { window.fecharModal(); if (onCancelar) onCancelar(); });
}

// Aplica efeito mecanico da magia no personagem. Retorna {detalhe} para toast ou null.
function aplicarEfeitoMagico(nomeMagia, circ, opcoes) {
  if (!opcoes) opcoes = {};
  const config = MAGIAS_EFEITO[nomeMagia];
  if (!config) return null;
  if (!char.efeitos_magicos) char.efeitos_magicos = [];
  const concentracao = config.concentracao;

  // Se for concentracao, remover efeitos de concentracao anteriores
  if (concentracao) {
    char.efeitos_magicos = char.efeitos_magicos.filter(e => !e.concentracao);
  }
  // Remover efeito duplicado da mesma magia (e filhos compostos)
  char.efeitos_magicos = char.efeitos_magicos.filter(e => {
    const base = e.nome.replace(/ \(.*\)$/, '');
    return base !== nomeMagia;
  });

  const tipo = config.tipo || null;
  const circuloNum = parseInt(circ) || 0;

  // --- Efeitos de CA (tipo_efeito legado) ---
  if (config.tipo_efeito && ['bonus', 'base', 'minimo'].includes(config.tipo_efeito)) {
    char.efeitos_magicos.push({ nome: nomeMagia, tipo_efeito: config.tipo_efeito, valor: config.valor, concentracao: concentracao, circulo: circuloNum });
    return null;
  }

  // --- PV Temporarios ---
  if (tipo === 'pv_temp') {
    const valor = config.media || 0;
    char.pv_temporario = Math.max(char.pv_temporario || 0, valor);
    return { detalhe: `+${valor} PV Temporários` };
  }

  // --- Reflexos ---
  if (tipo === 'reflexos') {
    char.efeitos_magicos.push({ nome: nomeMagia, tipo: 'reflexos', copias: config.copias, concentracao: concentracao, circulo: circuloNum, rotulo: config.rotulo });
    return null;
  }

  // --- Penalidade ataque contra o conjurador ---
  if (tipo === 'penalidade_ataque') {
    char.efeitos_magicos.push({ nome: nomeMagia, tipo: 'penalidade_ataque_contra_mim', valor: config.valor, concentracao: concentracao, circulo: circuloNum, rotulo: config.rotulo });
    return null;
  }

  // --- Condicao ---
  if (tipo === 'condicao') {
    char.efeitos_magicos.push({ nome: nomeMagia, tipo: 'condicao', condicao: config.condicao, encerra_ao_atacar: config.encerra_ao_atacar || false, concentracao: concentracao, circulo: circuloNum, rotulo: config.rotulo });
    return null;
  }

  // --- Resistencia ---
  if (tipo === 'resistencia') {
    const tipos_dano = opcoes.tipo_selecionado ? [opcoes.tipo_selecionado] : config.tipos_dano;
    char.efeitos_magicos.push({ nome: nomeMagia, tipo: 'resistencia', tipos_dano: tipos_dano, concentracao: concentracao, circulo: circuloNum, rotulo: tipos_dano ? `Resist. ${tipos_dano.join(', ')}` : config.rotulo });
    return null;
  }

  // --- Protecao contra entidades ---
  if (tipo === 'protecao') {
    char.efeitos_magicos.push({ nome: nomeMagia, tipo: 'protecao_bem_e_mal', concentracao: concentracao, circulo: circuloNum, rotulo: config.rotulo });
    return null;
  }

  // --- Buff d20 ---
  if (tipo === 'buff_d20') {
    char.efeitos_magicos.push({ nome: nomeMagia, tipo: 'buff_d20', bonus: config.bonus, aplica_em: config.aplica_em, concentracao: concentracao, circulo: circuloNum, rotulo: config.rotulo });
    return null;
  }

  // --- Buff arma ---
  if (tipo === 'buff_arma') {
    const entry = { nome: nomeMagia, tipo: 'buff_arma', concentracao: concentracao, circulo: circuloNum, rotulo: config.rotulo };
    if (config.bonus_ataque) entry.bonus_ataque = config.bonus_ataque;
    if (config.bonus_dano) entry.bonus_dano = config.bonus_dano;
    if (config.dano_extra) { entry.dano_extra = config.dano_extra; if (opcoes.tipo_selecionado) entry.tipo_dano_extra = opcoes.tipo_selecionado; }
    if (config.mecanica) entry.mecanica = config.mecanica;
    char.efeitos_magicos.push(entry);
    return null;
  }

  // --- Deslocamento ---
  if (tipo === 'deslocamento') {
    char.efeitos_magicos.push({ nome: nomeMagia, tipo: 'deslocamento', tipo_velocidade: config.tipo_velocidade, valor_metros: config.valor_metros || 0, concentracao: concentracao, circulo: circuloNum, rotulo: config.rotulo });
    return null;
  }

  // --- Buff pericia ---
  if (tipo === 'bonus_pericia') {
    const atributo = opcoes.atributo_selecionado || null;
    char.efeitos_magicos.push({ nome: nomeMagia, tipo: 'bonus_pericia', pericia: config.pericia || null, atributo: atributo, bonus: config.bonus, concentracao: concentracao, circulo: circuloNum, rotulo: atributo ? `Vant. testes de ${atributo}` : config.rotulo });
    return null;
  }

  // --- Cura PV ---
  if (tipo === 'cura_pv') {
    const pvMax = char.pv_max_override || char.pv_max;
    let cura;
    if (config.valor === 'max') {
      cura = pvMax - (char.pv_atual || 0);
      char.pv_atual = pvMax;
    } else {
      cura = config.valor;
      char.pv_atual = Math.min((char.pv_atual || 0) + cura, pvMax);
    }
    if (config.remove_condicoes) {
      config.remove_condicoes.forEach(c => { char.condicoes = (char.condicoes || []).filter(cond => cond !== c); });
    }
    if (config.penalidade) {
      char.efeitos_magicos.push({ nome: nomeMagia, tipo: 'penalidade_d20', valor: config.penalidade, concentracao: false, circulo: circuloNum, rotulo: `${config.penalidade} em d20 (reduz 1/Descanso Longo)` });
    }
    return { detalhe: `${config.valor === 'max' ? 'PV ao máximo' : `+${cura} PV`}${config.remove_condicoes ? ', condições removidas' : ''}` };
  }

  // --- Cura condicao ---
  if (tipo === 'cura_condicao') {
    if (opcoes.condicao_removida) {
      if (opcoes.condicao_removida === 'Exaustão (1 nível)') {
        char.exaustao = Math.max(0, (char.exaustao || 0) - 1);
        if (char.exaustao === 0) char.condicoes = (char.condicoes || []).filter(c => c !== 'Exaustão');
      } else if (opcoes.condicao_removida === 'Redução de PV máximos') {
        delete char.pv_max_override;
      } else {
        const nomeCondicao = opcoes.condicao_removida.replace(' (1 nível)', '');
        char.condicoes = (char.condicoes || []).filter(c => c !== nomeCondicao);
      }
      return { detalhe: `${opcoes.condicao_removida} removida` };
    }
    return null;
  }

  // --- Efeito composto ---
  if (tipo === 'composto') {
    const efeitos = config.efeitos || [];
    // Variante selecionada (ex: Escudo Ardente)
    if (config.selecionar_variante && opcoes.variante_selecionada) {
      const v = config.selecionar_variante[opcoes.variante_selecionada];
      if (v) {
        if (v.resistencia) char.efeitos_magicos.push({ nome: nomeMagia, tipo: 'resistencia', tipos_dano: [v.resistencia], concentracao: concentracao, circulo: circuloNum, rotulo: `Resist. ${v.resistencia}` });
        if (v.dano_reativo) char.efeitos_magicos.push({ nome: nomeMagia + ' (Reativo)', tipo: 'dano_reativo', dano: v.dano_reativo, concentracao: concentracao, circulo: circuloNum, rotulo: `Dano reativo: ${v.dano_reativo}` });
      }
      return null;
    }
    // Processar sub-efeitos
    for (const ef of efeitos) {
      if (ef.tipo === 'pv_temp') {
        const valor = ef.formula_circ ? ef.formula_circ * circuloNum : (ef.media || 0);
        char.pv_temporario = Math.max(char.pv_temporario || 0, valor);
      } else if (ef.tipo === 'dano_reativo') {
        const dano = ef.dano_circ ? ef.dano_circ * circuloNum : ef.dano;
        char.efeitos_magicos.push({ nome: nomeMagia + ' (Reativo)', tipo: 'dano_reativo', dano: `${dano} ${ef.tipo_dano}`, concentracao: concentracao, circulo: circuloNum, rotulo: `Dano reativo: ${dano} ${ef.tipo_dano}` });
      } else if (ef.tipo === 'pv_temp_por_turno') {
        let valor = 0;
        if (ef.valor === 'mod_conj') {
          const infoClasse = CLASSES_INFO[char.classe];
          if (infoClasse?.atributo_conjuracao) { const key = ATRIBUTO_NOME_PARA_KEY[infoClasse.atributo_conjuracao]; valor = calcMod(char.atributos[key]); }
        }
        valor = Math.max(1, valor);
        char.efeitos_magicos.push({ nome: nomeMagia, tipo: 'pv_temp_por_turno', valor: valor, concentracao: concentracao, circulo: circuloNum, rotulo: `+${valor} PV Temp/turno` });
        char.pv_temporario = Math.max(char.pv_temporario || 0, valor);
      } else if (ef.tipo === 'imunidade_condicao') {
        char.efeitos_magicos.push({ nome: nomeMagia, tipo: 'imunidade_condicao', condicao: ef.condicao, concentracao: concentracao, circulo: circuloNum, rotulo: `Imune: ${ef.condicao}` });
      } else if (ef.tipo === 'resistencia') {
        char.efeitos_magicos.push({ nome: nomeMagia, tipo: 'resistencia', tipos_dano: ef.tipos_dano, concentracao: concentracao, circulo: circuloNum, rotulo: `Resist. ${ef.tipos_dano.join(', ')}` });
      } else if (ef.tipo === 'remover_condicao') {
        char.condicoes = (char.condicoes || []).filter(c => c !== ef.condicao);
      } else if (ef.tipo === 'buff_save_condicao') {
        char.efeitos_magicos.push({ nome: nomeMagia, tipo: 'buff_save_condicao', condicao: ef.condicao, bonus: ef.bonus, concentracao: concentracao, circulo: circuloNum, rotulo: `Vant. SG ${ef.condicao}` });
      } else if (ef.tipo === 'vantagem_sg_condicoes') {
        char.efeitos_magicos.push({ nome: nomeMagia, tipo: 'vantagem_sg_condicoes', condicoes: ef.condicoes, concentracao: concentracao, circulo: circuloNum, rotulo: 'Vant. SG contra condições' });
      } else if (ef.tipo === 'buff_d20') {
        char.efeitos_magicos.push({ nome: nomeMagia, tipo: 'buff_d20', bonus: ef.bonus, aplica_em: ef.aplica_em, concentracao: concentracao, circulo: circuloNum, rotulo: config.rotulo });
      } else if (ef.tipo === 'desv_ataques_contra_mim') {
        char.efeitos_magicos.push({ nome: nomeMagia + ' (Desv.)', tipo: 'desv_ataques_contra_mim', concentracao: concentracao, circulo: circuloNum, rotulo: 'Inimigos: Desv. ataques contra você' });
      } else if (ef.tipo === 'protecao_pv_max') {
        char.efeitos_magicos.push({ nome: nomeMagia, tipo: 'protecao_pv_max', concentracao: concentracao, circulo: circuloNum, rotulo: 'PV máximos protegidos' });
      } else if (ef.tipo === 'bonus_pv_max') {
        const bonusPV = ef.media || 11;
        char.pv_max_override = (char.pv_max_override || char.pv_max) + bonusPV;
        char.pv_atual = (char.pv_atual || 0) + bonusPV;
        char.efeitos_magicos.push({ nome: nomeMagia + ' (PV Máx)', tipo: 'bonus_pv_max', valor: bonusPV, concentracao: concentracao, circulo: circuloNum, rotulo: `PV máx +${bonusPV}` });
      }
    }
    return null;
  }
  return null;
}

// Modal de selecao de alvo (self/outro)
function mostrarModalAlvoMagia(nomeMagia, circ, onEscolha) {
  const config = MAGIAS_EFEITO[nomeMagia];
  if (!config) { onEscolha('self'); return; }
  if (config.permite_self && !config.permite_outro) { onEscolha('self'); return; }
  if (!config.permite_self && config.permite_outro) { onEscolha('outro'); return; }

  abrirModal('Alvo da Magia', `
    <div style="text-align:center;margin-bottom:12px">
      <strong>${nomeMagia}</strong> (${circ}º Círculo)
      <div style="font-size:0.8rem;color:var(--text-muted);margin-top:4px">${config.rotulo}</div>
    </div>
    <div style="display:flex;gap:8px;justify-content:center">
      <button class="btn btn-primary" id="alvo-self">Em mim</button>
      <button class="btn btn-secondary" id="alvo-outro">Outra criatura</button>
    </div>
  `, '');
  document.getElementById('alvo-self')?.addEventListener('click', () => { window.fecharModal(); onEscolha('self'); });
  document.getElementById('alvo-outro')?.addEventListener('click', () => { window.fecharModal(); onEscolha('outro'); });
}

// Modal de selecao de opcao (tipo de dano, atributo, variante)
function mostrarModalSelecaoMagia(nomeMagia, circ, listaOpcoes, titulo, onSelecao) {
  const html = `
    <div style="text-align:center;margin-bottom:12px">
      <strong>${nomeMagia}</strong> (${circ}º Círculo)
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center">
      ${listaOpcoes.map((op, i) => `<button class="btn btn-secondary" data-sel-idx="${i}">${op}</button>`).join('')}
    </div>
  `;
  abrirModal(titulo, html, '');
  listaOpcoes.forEach((op, i) => {
    document.querySelector(`[data-sel-idx="${i}"]`)?.addEventListener('click', () => { window.fecharModal(); onSelecao(op); });
  });
}

// Modal de selecao de condicao a remover (Restauracao Menor/Maior)
function mostrarModalCuraCondicao(nomeMagia, circ, opcoesRemover, onSelecao) {
  const condicoesAtivas = char.condicoes || [];
  let disponiveis;
  if (nomeMagia === 'Restauração Maior') {
    disponiveis = opcoesRemover;
  } else {
    disponiveis = opcoesRemover.filter(c => condicoesAtivas.includes(c));
  }
  if (disponiveis.length === 0) {
    toast(`${nomeMagia}: Nenhuma condição removível encontrada.`, 'info');
    return;
  }
  const html = `
    <div style="text-align:center;margin-bottom:12px">
      <strong>${nomeMagia}</strong> (${circ}º Círculo)<br>
      <span style="font-size:0.8rem;color:var(--text-muted)">Selecione a condição a remover:</span>
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center">
      ${disponiveis.map((c, i) => `<button class="btn btn-secondary" data-cura-idx="${i}">${c}</button>`).join('')}
    </div>
  `;
  abrirModal('Remover Condição', html, '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>');
  disponiveis.forEach((c, i) => {
    document.querySelector(`[data-cura-idx="${i}"]`)?.addEventListener('click', () => { window.fecharModal(); onSelecao(c); });
  });
}

export function setupEventosEspacosMagia() {
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

  // Sortudo: gastar ponto de sorte
  document.querySelectorAll('[data-sortudo-acao]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!char.recursos) char.recursos = {};
      if (!char.recursos.sortudo) char.recursos.sortudo = { pontos_gastos: 0 };
      const total = bonusProficiencia(char.nivel);
      if (char.recursos.sortudo.pontos_gastos >= total) return;
      char.recursos.sortudo.pontos_gastos++;
      const acao = btn.dataset.sortudoAcao;
      const disponiveis = total - char.recursos.sortudo.pontos_gastos;
      if (acao === 'vantagem') {
        toast(`Sortudo: Vantagem ativada! Role novamente e use o melhor resultado. (${disponiveis} ponto(s) restante(s))`, 'success');
      } else {
        toast(`Sortudo: Desvantagem imposta ao atacante como Reação! (${disponiveis} ponto(s) restante(s))`, 'success');
      }
      salvar();
      renderFichaCompleta();
    });
  });

  // Conjurar magia (gasta slot)
  document.querySelectorAll('[data-conjurar]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();

      const estadoFuria = getEstadoFuria();
      if (estadoFuria?.ativa) {
        toast('Não é possível conjurar magias enquanto a Fúria estiver ativa.', 'error');
        return;
      }

      const nome = btn.dataset.conjurar;
      const selectEl = btn.parentElement?.querySelector(`[data-conj-select="${nome}"]`);
      const circ = selectEl ? selectEl.value : btn.dataset.conjCirc;
      if (!char.espacos_magia[circ]) return;
      if (char.espacos_magia[circ].usados >= char.espacos_magia[circ].total) {
        toast(`Sem espaços de ${circ}º círculo!`, 'error');
        return;
      }

      // Verificar conflito de concentracao ANTES de prosseguir
      const magiaEhConc = ehMagiaConcentracao(nome);
      const concAtiva = getConcentracaoAtiva();
      const temConflitoConc = magiaEhConc && concAtiva && concAtiva !== nome;

      const _prosseguirConjuracao = () => {

      const config = MAGIAS_EFEITO[nome];
      if (config) {
        const precisaAlvo = config.permite_self && config.permite_outro;
        const autoSelf = config.permite_self && !config.permite_outro;

        const prosseguir = (aplicarSelf) => {
          if (!aplicarSelf) {
            _executarConjuracao(nome, circ, btn.dataset.conjCirc, false, undefined, _metasAplicadas, _opcoesMetaConj);
            return;
          }
          // Verificar modais de selecao necessarios
          if (config.selecionar_tipo) {
            mostrarModalSelecaoMagia(nome, circ, config.selecionar_tipo, 'Escolher Tipo', (tipo) => {
              _executarConjuracao(nome, circ, btn.dataset.conjCirc, true, { tipo_selecionado: tipo }, _metasAplicadas, _opcoesMetaConj);
            });
          } else if (config.selecionar_atributo) {
            mostrarModalSelecaoMagia(nome, circ, config.selecionar_atributo, 'Escolher Atributo', (attr) => {
              _executarConjuracao(nome, circ, btn.dataset.conjCirc, true, { atributo_selecionado: attr }, _metasAplicadas, _opcoesMetaConj);
            });
          } else if (config.selecionar_variante) {
            mostrarModalSelecaoMagia(nome, circ, Object.keys(config.selecionar_variante), 'Escolher Variante', (v) => {
              _executarConjuracao(nome, circ, btn.dataset.conjCirc, true, { variante_selecionada: v }, _metasAplicadas, _opcoesMetaConj);
            });
          } else if (config.tipo === 'cura_condicao') {
            const lista = config.condicoes || config.efeitos || [];
            mostrarModalCuraCondicao(nome, circ, lista, (c) => {
              _executarConjuracao(nome, circ, btn.dataset.conjCirc, true, { condicao_removida: c }, _metasAplicadas, _opcoesMetaConj);
            });
          } else {
            _executarConjuracao(nome, circ, btn.dataset.conjCirc, true, undefined, _metasAplicadas, _opcoesMetaConj);
          }
        };

        if (precisaAlvo) {
          mostrarModalAlvoMagia(nome, circ, (alvo) => prosseguir(alvo === 'self'));
        } else {
          prosseguir(autoSelf);
        }
        return;
      }

      // Magia sem efeito especifico - apenas gasta slot e mostra toast
      _executarConjuracao(nome, circ, btn.dataset.conjCirc, false, undefined, _metasAplicadas, _opcoesMetaConj);

      }; // fim de _prosseguirConjuracao

      // Estado de metamagia para esta conjuracao (Feiticeiro)
      let _metasAplicadas = [];
      let _opcoesMetaConj = {};

      const _iniciarConjuracaoComMetamagia = () => {
        if (char.classe === 'Feiticeiro' && (char.nivel || 1) >= 2) {
          const estadoFeit = getEstadoRecursosFeiticeiro();
          if (estadoFeit && estadoFeit.metamagias.length > 0 && estadoFeit.pontosAtuais > 0) {
            mostrarModalMetamagiaConjuracao(nome, circ, (metas, opcoesMeta) => {
              _metasAplicadas = metas || [];
              _opcoesMetaConj = opcoesMeta || {};
              _prosseguirConjuracao();
            });
            return;
          }
          // Feedback quando metamagia é pulada por falta de PF
          if (estadoFeit && estadoFeit.metamagias.length > 0 && estadoFeit.pontosAtuais === 0) {
            toast('Metamagia indisponível: sem Pontos de Feitiçaria.', 'info');
          }
        }
        _prosseguirConjuracao();
      };

      // Se ha conflito de concentracao, pedir confirmacao
      if (temConflitoConc) {
        confirmarSubstituirConcentracao(concAtiva, nome, _iniciarConjuracaoComMetamagia);
      } else {
        _iniciarConjuracaoComMetamagia();
      }
    });
  });

  function _executarConjuracao(nome, circ, baseCirc, aplicarEfeitoSelf, opcoes, metamagiasAplicadas, opcoesMeta) {
    char.espacos_magia[circ].usados++;

    if (char.classe === 'Feiticeiro' && semAcento(char.subclasse || '') === semAcento('Feitiçaria Selvagem')) {
      const estadoFeiticeiro = getEstadoRecursosFeiticeiro();
      if (estadoFeiticeiro && !estadoFeiticeiro.subclasses.selvagem.mares_caos_disponivel) {
        char.recursos.feiticeiro.subclasses.selvagem.mares_caos_disponivel = true;
        char.recursos.feiticeiro.subclasses.selvagem.surto_pendente_automatico = true;
      }
    }

    let resultado = null;
    if (aplicarEfeitoSelf) {
      resultado = aplicarEfeitoMagico(nome, circ, opcoes);
    }

    // Rastrear concentracao de magias sem mecanica no MAGIAS_EFEITO
    const magiaTemConc = ehMagiaConcentracao(nome);
    if (magiaTemConc && !aplicarEfeitoSelf) {
      if (!char.efeitos_magicos) char.efeitos_magicos = [];
      // Remover concentracoes anteriores
      char.efeitos_magicos = char.efeitos_magicos.filter(e => !e.concentracao);
      // Registrar concentracao generica
      char.efeitos_magicos.push({ nome: nome, tipo: 'concentracao_generica', concentracao: true, circulo: parseInt(circ) || 0, rotulo: `Concentrando em ${nome}` });
    }

    // Processar metamagias aplicadas (Feiticeiro)
    let metaTexto = '';
    if (metamagiasAplicadas && metamagiasAplicadas.length > 0 && char.classe === 'Feiticeiro') {
      metaTexto = _processarMetamagiasConjuracao(metamagiasAplicadas, opcoesMeta, nome, circ);
    }

    salvar();
    const upcast = parseInt(circ) > parseInt(baseCirc);
    const sufixoAlvo = aplicarEfeitoSelf ? ' (em você)' : '';
    const detalhe = resultado?.detalhe ? ` — ${resultado.detalhe}` : '';
    if (char.classe === 'Feiticeiro' && semAcento(char.subclasse || '') === semAcento('Feitiçaria Selvagem') && char.recursos?.feiticeiro?.subclasses?.selvagem?.surto_pendente_automatico) {
      toast(`${nome} conjurada${upcast ? ` no ${circ}º círculo` : ''}${sufixoAlvo}${detalhe}${metaTexto}! Surto de Magia Selvagem automático pendente.`, 'success');
    } else {
      toast(`${nome} conjurada${upcast ? ` no ${circ}º círculo` : ''}${sufixoAlvo}${detalhe}${metaTexto}!`, 'success');
    }
    renderFichaCompleta();
  }

  // Rastreia concentração genérica (magias de concentração sem mecânica própria em
  // MAGIAS_EFEITO aplicada a si mesmo) — mesmo padrão usado na conjuração normal (não-grátis)
  function _rastrearConcentracaoGenerica(nome, circulo) {
    if (!ehMagiaConcentracao(nome)) return;
    if (!char.efeitos_magicos) char.efeitos_magicos = [];
    char.efeitos_magicos = char.efeitos_magicos.filter(e => !e.concentracao);
    char.efeitos_magicos.push({ nome, tipo: 'concentracao_generica', concentracao: true, circulo: circulo || 0, rotulo: `Concentrando em ${nome}` });
  }

  // Função auxiliar para conjuração gratuita (talentos)
  function _executarConjuracaoGratis(entrada, nome) {
    entrada.gratis_usado = true;

    // Aplicar efeito mágico se existir
    const config = MAGIAS_EFEITO[nome];
    let efeitoAplicadoSelf = false;
    if (config) {
      const precisaAlvo = config.permite_self && config.permite_outro;
      const autoSelf = config.permite_self && !config.permite_outro;

      if (precisaAlvo) {
        mostrarModalAlvoMagia(nome, entrada.circulo, (alvo) => {
          if (alvo === 'self') {
            aplicarEfeitoMagico(nome, entrada.circulo);
          } else {
            // Efeito aplicado em outra criatura: aplicarEfeitoMagico já cuida da
            // concentração quando o alvo é self; quando é "outro", rastrear aqui
            _rastrearConcentracaoGenerica(nome, entrada.circulo);
          }
          toast(`${nome} conjurada gratuitamente (talento)!`, 'success');
          salvar();
          renderFichaCompleta();
        });
        return;
      }
      if (autoSelf) { aplicarEfeitoMagico(nome, entrada.circulo); efeitoAplicadoSelf = true; }
    }

    // Concentração genérica (só quando o efeito não foi aplicado a si mesmo acima —
    // aplicarEfeitoMagico já cuida da concentração nesse caso)
    if (!efeitoAplicadoSelf) {
      _rastrearConcentracaoGenerica(nome, entrada.circulo);
    }

    toast(`${nome} conjurada gratuitamente (talento)!`, 'success');
    salvar();
    renderFichaCompleta();
  }

  // Conjurar magia gratuitamente (talentos: 1x por descanso longo)
  document.querySelectorAll('[data-conjurar-gratis]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();

      const estadoFuria = getEstadoFuria();
      if (estadoFuria?.ativa) {
        toast('Não é possível conjurar magias enquanto a Fúria estiver ativa.', 'error');
        return;
      }

      const nome = btn.dataset.conjurarGratis;
      const entrada = char.magias_preparadas.find(m => m.nome === nome && m.gratis_usado === false);
      if (!entrada) return;

      // Verificar conflito de concentração
      const magiaEhConc = ehMagiaConcentracao(nome);
      const concAtiva = getConcentracaoAtiva();
      if (magiaEhConc && concAtiva && concAtiva !== nome) {
        confirmar(
          `Você já está concentrando em <strong>${escHtml(concAtiva)}</strong>. Deseja perder a concentração e conjurar <strong>${escHtml(nome)}</strong> gratuitamente?`,
          () => {
            removerConcentracao();
            _executarConjuracaoGratis(entrada, nome);
          }
        );
        return;
      }

      _executarConjuracaoGratis(entrada, nome);
    });
  });

  // Lancar truque (nao gasta espaco de magia)
  document.querySelectorAll('[data-lancar-truque]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const estadoFuria = getEstadoFuria();
      if (estadoFuria?.ativa) {
        toast('Não é possível conjurar magias enquanto a Fúria estiver ativa.', 'error');
        return;
      }
      const nome = btn.dataset.lancarTruque;

      // Verificar conflito de concentracao antes de executar
      const truqueEhConc = ehMagiaConcentracao(nome);
      const concAtiva = getConcentracaoAtiva();
      const temConflitoConc = truqueEhConc && concAtiva && concAtiva !== nome;

      const _executarTruque = () => {
        // Truque com efeito mecanico (ex: Protecao Contra Laminas)
        const config = MAGIAS_EFEITO[nome];
        if (config && config.truque && config.permite_self) {
          aplicarEfeitoMagico(nome, 0);
          salvar();
          renderFichaCompleta();
          toast(`${nome} lançado (em você)!`, 'success');
          return;
        }
        // Truque de concentracao sem mecanica: rastrear genericamente
        if (truqueEhConc) {
          if (!char.efeitos_magicos) char.efeitos_magicos = [];
          char.efeitos_magicos = char.efeitos_magicos.filter(e => !e.concentracao);
          char.efeitos_magicos.push({ nome: nome, tipo: 'concentracao_generica', concentracao: true, circulo: 0, rotulo: `Concentrando em ${nome}` });
          salvar();
          renderFichaCompleta();
        }
        toast(`${nome} lançado!`, 'success');
      };

      if (temConflitoConc) {
        confirmarSubstituirConcentracao(concAtiva, nome, _executarTruque);
      } else {
        _executarTruque();
      }
    });
  });

  document.querySelectorAll('[data-conjurar-magia-custom]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const estadoFuria = getEstadoFuria();
      if (estadoFuria?.ativa) {
        toast('Não é possível conjurar magias enquanto a Fúria estiver ativa.', 'error');
        return;
      }

      const indice = Number(btn.dataset.conjurarMagiaCustom);
      const magia = normalizarMagiaPersonalizada((char.magias_customizadas || [])[indice], indice);
      const select = btn.parentElement?.querySelector(`[data-conj-select-custom="${indice}"]`);
      const circulo = Number(select?.value || btn.dataset.conjCirc);
      const executar = () => conjurarMagiaPersonalizada(indice, circulo);
      const concentracaoAtiva = getConcentracaoAtiva();

      if (magiaPersonalizadaEhConcentracao(magia) && concentracaoAtiva && concentracaoAtiva !== magia.nome) {
        confirmarSubstituirConcentracao(concentracaoAtiva, magia.nome, executar);
      } else {
        executar();
      }
    });
  });

  document.querySelectorAll('[data-lancar-magia-custom]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const estadoFuria = getEstadoFuria();
      if (estadoFuria?.ativa) {
        toast('Não é possível conjurar magias enquanto a Fúria estiver ativa.', 'error');
        return;
      }

      const indice = Number(btn.dataset.lancarMagiaCustom);
      const registro = (char.magias_customizadas || [])[indice];
      if (!registro) return;
      const magia = normalizarMagiaPersonalizada(registro, indice);
      if (magia.circulo !== 0) return;

      const executar = () => {
        registrarConcentracaoMagiaPersonalizada(magia, 0);
        salvar();
        renderFichaCompleta();
        toast(`${magia.nome} lançado!`, 'success');
      };
      const concentracaoAtiva = getConcentracaoAtiva();
      if (magiaPersonalizadaEhConcentracao(magia) && concentracaoAtiva && concentracaoAtiva !== magia.nome) {
        confirmarSubstituirConcentracao(concentracaoAtiva, magia.nome, executar);
      } else {
        executar();
      }
    });
  });

  document.querySelectorAll('[data-conjurar-ritual-custom]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const estadoFuria = getEstadoFuria();
      if (estadoFuria?.ativa) {
        toast('Não é possível conjurar magias enquanto a Fúria estiver ativa.', 'error');
        return;
      }

      const indice = Number(btn.dataset.conjurarRitualCustom);
      const registro = (char.magias_customizadas || [])[indice];
      if (!registro) return;
      const magia = normalizarMagiaPersonalizada(registro, indice);
      if (!magia.ritual || magia.circulo <= 0) return;

      const executar = () => {
        registrarConcentracaoMagiaPersonalizada(magia, magia.circulo);
        salvar();
        renderFichaCompleta();
        toast(`${magia.nome} conjurada como Ritual (sem gastar espaço).`, 'success');
      };
      const concentracaoAtiva = getConcentracaoAtiva();
      if (magiaPersonalizadaEhConcentracao(magia) && concentracaoAtiva && concentracaoAtiva !== magia.nome) {
        confirmarSubstituirConcentracao(concentracaoAtiva, magia.nome, executar);
      } else {
        executar();
      }
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
            ${magia.circulo_superior ? `<div class="info-box info" style="margin-top:4px"><strong>Circulos superiores:</strong><div class="md-content">${mdParaHtml(magia.circulo_superior)}</div></div>` : ''}
          `;
        }
      }
      item.classList.add('expandida');
    });
  });

  document.querySelectorAll('.magia-item[data-magia-custom-index]').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.closest('button') || e.target.closest('select')) return;
      const indice = Number(item.dataset.magiaCustomIndex);
      const magia = normalizarMagiaPersonalizada((char.magias_customizadas || [])[indice], indice);
      const descEl = item.querySelector('.magia-desc');
      if (item.classList.contains('expandida')) {
        item.classList.remove('expandida');
        return;
      }
      if (descEl && !descEl.innerHTML.trim()) descEl.innerHTML = renderDetalhesMagiaPersonalizada(magia);
      item.classList.add('expandida');
    });
  });

  // Adicionar magia do livro
  document.getElementById('btn-add-magia')?.addEventListener('click', () => mostrarBuscaMagia());

  // Adicionar talento manualmente
  document.getElementById('btn-add-talento')?.addEventListener('click', () => abrirModalAdicionarTalento());
  document.querySelectorAll('[data-talento-recurso]').forEach(btn => {
    btn.addEventListener('click', () => {
      const recursos = char.recursos?.talentos;
      if (!recursos) return;
      switch (btn.dataset.talentoRecurso) {
        case 'ritual-rapido':
          recursos.conjurador_ritualista.ritual_rapido_usado =
            !recursos.conjurador_ritualista.ritual_rapido_usado;
          break;
        case 'recuperacao-ate-morte':
          recursos.dadiva_recuperacao.ate_a_morte_usado =
            !recursos.dadiva_recuperacao.ate_a_morte_usado;
          break;
        case 'recuperacao-dado':
          recursos.dadiva_recuperacao.dados_vitalidade_gastos =
            Math.min(10, (recursos.dadiva_recuperacao.dados_vitalidade_gastos || 0) + 1);
          break;
        case 'dadiva-destino':
          recursos.dadiva_destino.usado = !recursos.dadiva_destino.usado;
          break;
        case 'dadiva-proeza':
          recursos.dadiva_proeza_combate.usado_no_turno =
            !recursos.dadiva_proeza_combate.usado_no_turno;
          break;
        default:
          return;
      }
      salvar();
      renderFichaCompleta();
    });
  });

  // Substituição de Magia (Iniciado em Magia): trocar truques/magia de uma instância
  document.querySelectorAll('[data-editar-im]').forEach(btn => {
    btn.addEventListener('click', () => abrirModalEditarIniciadoEmMagia(parseInt(btn.dataset.editarIm)));
  });

  // Preencher slot de magia liberado por ajuste automático (bug de magia passiva duplicada)
  document.getElementById('btn-preencher-slot-magia')?.addEventListener('click', () => abrirPreenchimentoSlotMagia());

  // Adicionar magia customizada
  document.getElementById('btn-add-magia-custom')?.addEventListener('click', () => mostrarFormMagiaCustom());

  document.querySelectorAll('[data-editar-magia-custom]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = Number(btn.dataset.editarMagiaCustom);
      if (Number.isInteger(idx) && (char.magias_customizadas || [])[idx]) mostrarFormMagiaCustom(idx);
    });
  });

  // Remover magia customizada
  document.querySelectorAll('[data-remover-magia-custom]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = Number(btn.dataset.removerMagiaCustom);
      const magia = (char.magias_customizadas || [])[idx];
      if (!magia) return;
      abrirModal(
        'Remover magia personalizada',
        `<p>Remover <strong>${escHtml(String(magia.nome || 'esta magia'))}</strong>?</p><p style="font-size:0.8rem;color:var(--text-muted)">Esta ação não altera seus espaços de magia nem as demais magias.</p>`,
        '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-danger" id="btn-confirmar-remover-magia-custom">Remover</button>'
      );
      document.getElementById('btn-confirmar-remover-magia-custom')?.addEventListener('click', () => {
        const atual = (char.magias_customizadas || [])[idx];
        if (!atual) {
          fecharModal();
          return;
        }
        const nome = String(atual.nome || 'Magia personalizada');
        if (char.classe === 'Mago' && Array.isArray(char.grimorio)) {
          const idxGrimorio = char.grimorio.findIndex(m => m?.nome === atual.nome);
          if (idxGrimorio >= 0) char.grimorio.splice(idxGrimorio, 1);
        }
        char.magias_preparadas = (char.magias_preparadas || []).filter(m => !(m.personalizada && m.nome === atual.nome));
        char.magias_customizadas.splice(idx, 1);
        fecharModal();
        salvar();
        renderFichaCompleta();
        toast(`${nome} removida.`, 'success');
      });
    });
  });

  // Grimório: preparar magia do grimório (com validação de limite)
  document.querySelectorAll('[data-preparar-grimorio]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const nome = btn.dataset.prepararGrimorio;
      const circ = parseInt(btn.dataset.prepCirc);
      if (char.magias_preparadas.find(m => m.nome === nome)) return;

      // Validar limite de magias preparadas
      const tabela = classeData?.tabela_caracteristicas;
      const maxPrep = tabela ? getMagiaPreparadas(tabela, char.nivel) : 99;
      const preparadasNormais = (char.magias_preparadas || []).filter(m => magiaContaNoLimite(m));
      if (preparadasNormais.length >= maxPrep) {
        toast(`Limite de magias preparadas atingido (${maxPrep}). Desprepare uma magia primeiro.`, 'error');
        return;
      }

      const ehCustomizadaCirculo = (char.magias_customizadas || []).some(m => m?.nome === nome && Number(m.circulo) > 0);
      char.magias_preparadas.push({ nome, circulo: circ, ...(ehCustomizadaCirculo ? { personalizada: true } : {}) });
      salvar();
      renderFichaCompleta();
      toast(`${nome} preparada a partir do grimório (${preparadasNormais.length + 1}/${maxPrep})`, 'success');
    });
  });

  // Grimório: despreparar magia (mantém no grimório)
  document.querySelectorAll('[data-despreparar-grimorio]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const nome = btn.dataset.desprepararGrimorio;
      char.magias_preparadas = (char.magias_preparadas || []).filter(m => m.nome !== nome);
      salvar();
      renderFichaCompleta();
      toast(`${nome} despreparada (permanece no grimório)`, 'info');
    });
  });

  // Grimório: remover magia do grimório
  document.querySelectorAll('[data-remover-grimorio]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const nome = btn.dataset.removerGrimorio;
      abrirModal('Remover magia do grimório',
        `<p>Remover <strong>${escHtml(nome)}</strong> do grimório?</p><p style="font-size:0.8rem;color:var(--text-muted)">A magia também deixará sua lista de magias preparadas.</p>`,
        '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-danger" id="btn-confirmar-remover-grimorio">Remover</button>'
      );
      document.getElementById('btn-confirmar-remover-grimorio')?.addEventListener('click', () => {
        // Também remover das preparadas se estava preparada
        char.magias_preparadas = (char.magias_preparadas || []).filter(m => m.nome !== nome);
        char.grimorio = (char.grimorio || []).filter(m => m.nome !== nome);
        fecharModal();
        salvar();
        renderFichaCompleta();
        toast(`${nome} removida do grimório`, 'success');
      });
    });
  });

  // Grimório: botão de copiar magia
  document.getElementById('btn-add-grimorio')?.addEventListener('click', () => mostrarBuscaGrimorio());
}