// ============================================================
// Ficha de Personagem - Visualização e Edição
// ============================================================
import { CLASSES_INFO, PERICIAS, ATRIBUTOS_NOMES, ATRIBUTOS_KEYS, ATRIBUTO_NOME_PARA_KEY } from '../dados-classes.js';
import { getPersonagem, salvarPersonagem, removerPersonagem } from '../store.js';
import { getClasse, getMagiasClasse, getMagiasPorCirculo, getIndiceMagias, getArmas, getArmaduras, getEquipamentoAventura, getTalentos, getEspecies } from '../db.js';
import { calcMod, fmtMod, bonusProficiencia, calcCA, calcCDMagia, calcAtaqueMagia, calcPercepcaoPassiva, calcIntuicaoPassiva, calcInvestigacaoPassiva, calcBonusPericia, calcPVTotal, getEspacosMagia, getTruquesConhecidos, getMagiaPreparadas, toast, abrirModal, mdParaHtml, semAcento, gerarId, detectarRecarga, ehHabilidadeAtiva, getDeslocamento, getTamanho } from '../utils.js';
import { podeSubirDeNivel, subirDeNivel, XP_POR_NIVEL, adicionarXP, obterTodasMagiasDominio, obterTodasMagiasSemprePreparadas, exigeEspecializacaoBardo, exigeEspecializacaoGuardiao, exigeEstiloLuta, exigeExploradorHabil, exigeAcademico } from '../levelup.js';

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
let magiasSempreCache = null;

function magiaContaNoLimite(magia) {
  const origensEspeciais = ['dominio', 'sempre', 'iniciado_em_magia', 'tocado_por_fadas', 'tocado_pelas_sombras', 'conjurador_ritualista'];
  return !origensEspeciais.includes(magia?.origem);
}

function magiaEhEspecial(magia) {
  return !magiaContaNoLimite(magia);
}

function rotuloOrigemMagia(magia) {
  if (magia?.origem === 'dominio') return 'Domínio';
  if (magia?.origem === 'sempre') return 'Sempre Preparada';
  if (magia?.origem === 'iniciado_em_magia') return 'Iniciado em Magia';
  if (magia?.origem === 'tocado_por_fadas') return 'Tocado Por Fadas';
  if (magia?.origem === 'tocado_pelas_sombras') return 'Tocado Pelas Sombras';
  if (magia?.origem === 'conjurador_ritualista') return 'Conjurador Ritualista';
  return '';
}

function ehBardoComSegredosMagicos() {
  return char?.classe === 'Bardo' && (char?.nivel || 1) >= 10;
}

function temArmaduraPesadaEquipada() {
  const inv = char?.inventario || [];
  return inv.some(i => i.equipado && i.tipo === 'armadura' && (i.dados?.categoria || '').toLowerCase() === 'pesada');
}

/** Verifica se a armadura equipada impoe Desvantagem em Furtividade */
function armaduraImpoeFurtividadeDesv() {
  const inv = char?.inventario || [];
  return inv.some(i => i.equipado && i.tipo === 'armadura' && i.dados?.furtividade === 'Desvantagem');
}

/**
 * Calcula vantagem/desvantagem para uma pericia especifica.
 * Retorna { vantagens: string[], desvantagens: string[] } com as fontes.
 */
function calcVantagemDesvantagemPericia(nomePericia) {
  const vantagens = [];
  const desvantagens = [];
  const condicoes = char.condicoes || [];

  // --- Condicoes que impoem Desvantagem em todos os testes de atributo ---
  if (condicoes.includes('Amedrontado')) desvantagens.push('Amedrontado');
  if (condicoes.includes('Envenenado')) desvantagens.push('Envenenado');

  // --- Armadura equipada com Desvantagem em Furtividade ---
  if (nomePericia === 'Furtividade' && armaduraImpoeFurtividadeDesv()) {
    desvantagens.push('Armadura');
  }

  // --- Barbaro em Furia: Vantagem em testes de Forca ---
  const pericia = PERICIAS.find(p => p.nome === nomePericia);
  const emFuria = !!getEstadoFuria()?.ativa;
  if (emFuria && pericia?.atributo === 'Força') {
    vantagens.push('Furia');
  }

  // --- Guerreiro/Campeao nivel 3+: Vantagem em Atletismo ---
  if (nomePericia === 'Atletismo' && char.classe === 'Guerreiro' && char.subclasse === 'Campeão' && (char.nivel || 1) >= 3) {
    vantagens.push('Atleta Extraordinario');
  }

  // --- Golias - Forma Grande (nivel 5+, quando ativa): Vantagem em testes de Forca ---
  if (pericia?.atributo === 'Força' && char.especie === 'Golias' && (char.nivel || 1) >= 5) {
    const usosFormaGrande = char.usos_habilidades?.['Forma Grande'];
    if (usosFormaGrande?.ativa) {
      vantagens.push('Forma Grande');
    }
  }

  // --- Efeitos magicos: bonus_pericia com bonus='vantagem' (Aprimorar Atributo) ---
  const efMag = char.efeitos_magicos || [];
  efMag.forEach(e => {
    if (e.tipo === 'bonus_pericia' && e.bonus === 'vantagem' && e.atributo && pericia?.atributo === e.atributo) {
      vantagens.push(e.nome.replace(/ \(.*\)$/, ''));
    }
  });

  return { vantagens, desvantagens };
}

function getProgressaoBarbaro() {
  if (char?.classe !== 'Bárbaro' || !classeData?.tabela_caracteristicas) return null;
  const row = classeData.tabela_caracteristicas.find(r => parseInt(r['Nível']) === (char.nivel || 1));
  if (!row) return null;
  return {
    furiasMax: parseInt(row['Fúrias']) || 0,
    danoFuria: parseInt(String(row['Dano da Fúria'] || '0').replace('+', '')) || 0,
    maestriasMax: parseInt(row['Maestria em Arma']) || 0
  };
}

function getEstadoFuria() {
  if (char?.classe !== 'Bárbaro') return null;
  if (!char.recursos) char.recursos = {};
  if (typeof char.recursos.furia_ativa !== 'boolean') char.recursos.furia_ativa = false;
  if (typeof char.recursos.furia_usos_gastos !== 'number') char.recursos.furia_usos_gastos = 0;

  const prog = getProgressaoBarbaro() || { furiasMax: 0, danoFuria: 0, maestriasMax: 0 };
  const usosDisponiveis = Math.max(0, prog.furiasMax - char.recursos.furia_usos_gastos);
  const nivel = char.nivel || 1;

  // Fúria Irracional: Berserker nível 6+ — Imunidade a Amedrontado e Enfeitiçado durante Fúria
  const temFuriaIrracional = char.subclasse === 'Trilha do Berserker' && nivel >= 6;

  // Resistências durante a Fúria
  let resistenciasFuria = ['Contundente', 'Cortante', 'Perfurante'];
  // Coração Selvagem - Urso: Resistência a todos os tipos exceto Energético, Necrótico, Psíquico, Radiante
  if (char.subclasse === 'Trilha do Coração Selvagem' && nivel >= 3 && char.recursos.furia_animal === 'Urso') {
    resistenciasFuria = ['Ácido', 'Contundente', 'Cortante', 'Elétrico', 'Gélido', 'Ígneo', 'Perfurante', 'Trovejante', 'Venenoso'];
  }

  // Fanático nv14 - Fúria dos Deuses: Resistência adicional a Necrótico, Psíquico, Radiante
  const furiaDeusesAtiva = char.subclasse === 'Trilha do Fanático' && nivel >= 14 && !!char.recursos.furia_deuses_ativa;
  if (furiaDeusesAtiva) {
    ['Necrótico', 'Psíquico', 'Radiante'].forEach(t => {
      if (!resistenciasFuria.includes(t)) resistenciasFuria.push(t);
    });
  }

  // Fúria Implacável (nível 11+): CD para não cair a 0 PV
  if (typeof char.recursos.furia_implacavel_cd !== 'number') char.recursos.furia_implacavel_cd = 10;

  // Bote Instintivo (nível 7+)
  const temBoteInstintivo = nivel >= 7;

  // Força Indomável (nível 18+)
  const temForcaIndomavel = nivel >= 18;

  return {
    ativa: !!char.recursos.furia_ativa,
    usosGastos: char.recursos.furia_usos_gastos,
    usosMax: prog.furiasMax,
    usosDisponiveis,
    dano: prog.danoFuria,
    maestriasMax: prog.maestriasMax,
    furiaIrracional: temFuriaIrracional,
    resistencias: resistenciasFuria,
    temBoteInstintivo,
    temForcaIndomavel,
    furiaImplacavelCD: char.recursos.furia_implacavel_cd,
    furiaImplacavel: nivel >= 11,
    furiaDeusesAtiva,
    animalFuria: char.recursos.furia_animal || null,
    subclasse: char.subclasse
  };
}

function getProgressaoBardo() {
  if (char?.classe !== 'Bardo' || !classeData?.tabela_caracteristicas) return null;
  const row = classeData.tabela_caracteristicas.find(r => parseInt(r['Nível']) === (char.nivel || 1));
  if (!row) return null;
  const dadoStr = String(row['Dados de Inspiração'] || 'D6');
  const dado = parseInt(dadoStr.replace(/[^\d]/g, '')) || 6;
  return { dado };
}

function getEstadoInspiracaoBardo() {
  if (char?.classe !== 'Bardo') return null;
  if (!char.recursos) char.recursos = {};
  if (typeof char.recursos.inspiracao_bardo_usos_gastos !== 'number') char.recursos.inspiracao_bardo_usos_gastos = 0;

  const modCar = calcMod(char.atributos.carisma);
  const usosMax = Math.max(1, modCar);
  const usosDisponiveis = Math.max(0, usosMax - char.recursos.inspiracao_bardo_usos_gastos);
  const recuperaCurto = (char.nivel || 1) >= 5;
  const prog = getProgressaoBardo() || { dado: 6 };

  return {
    usosMax,
    usosGastos: char.recursos.inspiracao_bardo_usos_gastos,
    usosDisponiveis,
    dado: prog.dado,
    recuperaCurto
  };
}

/**
 * Retorna quantidade de truques extras concedidos pelo Estilo de Luta
 * (Combatente Druídico = +2 truques de Druida, Combatente Abençoado = +2 truques de Clérigo)
 */
function getTruquesExtraEstiloLuta() {
  const estilo = char?.escolhas_classe?.estilo_luta?.[0] || '';
  if (estilo === 'Combatente Druídico' || estilo === 'Combatente Abençoado') return 2;
  return 0;
}

function getProgressaoGuardiao() {
  if (char?.classe !== 'Guardião' || !classeData?.tabela_caracteristicas) return null;
  const row = classeData.tabela_caracteristicas.find(r => parseInt(r['Nível']) === (char.nivel || 1));
  if (!row) return null;
  return {
    inimigoFavoritoMax: parseInt(row['Inimigo Favorito']) || 0
  };
}

function getEstadoRecursosGuardiao() {
  if (char?.classe !== 'Guardião') return null;
  if (!char.recursos) char.recursos = {};
  if (!char.recursos.guardiao) {
    char.recursos.guardiao = {
      inimigo_favorito_usos_gastos: 0,
      marca_predador_ativa: false,
      incansavel_usos_gastos: 0,
      veu_natureza_usos_gastos: 0
    };
  }

  const r = char.recursos.guardiao;
  if (typeof r.inimigo_favorito_usos_gastos !== 'number') r.inimigo_favorito_usos_gastos = 0;
  if (typeof r.marca_predador_ativa !== 'boolean') r.marca_predador_ativa = false;
  if (typeof r.incansavel_usos_gastos !== 'number') r.incansavel_usos_gastos = 0;
  if (typeof r.veu_natureza_usos_gastos !== 'number') r.veu_natureza_usos_gastos = 0;
  if (typeof char.exaustao !== 'number') char.exaustao = 0;

  // Subclasses do Guardião
  if (!r.subclasses) r.subclasses = {};
  // Andarilho Feérico
  if (!r.subclasses.andarilho) {
    r.subclasses.andarilho = { reforcos_feericos_usado: false, andarilho_nebuloso_usos_gastos: 0 };
  }
  if (typeof r.subclasses.andarilho.reforcos_feericos_usado !== 'boolean') r.subclasses.andarilho.reforcos_feericos_usado = false;
  if (typeof r.subclasses.andarilho.andarilho_nebuloso_usos_gastos !== 'number') r.subclasses.andarilho.andarilho_nebuloso_usos_gastos = 0;
  // Caçador
  if (!r.subclasses.cacador) {
    r.subclasses.cacador = { presa_escolha: '', taticas_escolha: '' };
  }
  if (typeof r.subclasses.cacador.presa_escolha !== 'string') r.subclasses.cacador.presa_escolha = '';
  if (typeof r.subclasses.cacador.taticas_escolha !== 'string') r.subclasses.cacador.taticas_escolha = '';
  // Senhor das Feras
  if (!r.subclasses.feras) {
    r.subclasses.feras = { companheiro_tipo: '' };
  }
  if (typeof r.subclasses.feras.companheiro_tipo !== 'string') r.subclasses.feras.companheiro_tipo = '';
  // Vigilante das Sombras
  if (!r.subclasses.vigilante) {
    r.subclasses.vigilante = { golpe_terrivel_usos_gastos: 0 };
  }
  if (typeof r.subclasses.vigilante.golpe_terrivel_usos_gastos !== 'number') r.subclasses.vigilante.golpe_terrivel_usos_gastos = 0;

  const prog = getProgressaoGuardiao() || { inimigoFavoritoMax: 0 };
  const modSab = Math.max(1, calcMod(char.atributos.sabedoria));
  const nivel = char.nivel || 1;

  const inimigoFavoritoDisponiveis = Math.max(0, prog.inimigoFavoritoMax - r.inimigo_favorito_usos_gastos);
  const incansavelDisponiveis = Math.max(0, modSab - r.incansavel_usos_gastos);
  const veuDisponiveis = Math.max(0, modSab - r.veu_natureza_usos_gastos);

  return {
    nivel,
    modSab,
    inimigoFavoritoMax: prog.inimigoFavoritoMax,
    inimigoFavoritoDisponiveis,
    marcaPredadorAtiva: !!r.marca_predador_ativa,
    marcaPredadorDado: nivel >= 20 ? 'd10' : 'd6',
    incansavelAtivo: nivel >= 10,
    incansavelMax: modSab,
    incansavelDisponiveis,
    predadorImplacavelAtivo: nivel >= 13,
    veuNaturezaAtivo: nivel >= 14,
    veuNaturezaMax: modSab,
    veuNaturezaDisponiveis: veuDisponiveis,
    cacadorPrecisoAtivo: nivel >= 17,
    sentidosSelvagensAtivo: nivel >= 18,
    exaustao: Math.max(0, char.exaustao || 0),
    // Subclasses - propriedades computadas
    reforcosFeericosUsado: !!r.subclasses.andarilho.reforcos_feericos_usado,
    andarilhoNebulosoMax: modSab,
    andarilhoNebulosoDisponiveis: Math.max(0, modSab - r.subclasses.andarilho.andarilho_nebuloso_usos_gastos),
    presaCacadorEscolha: r.subclasses.cacador.presa_escolha || '',
    taticasDefensivasEscolha: r.subclasses.cacador.taticas_escolha || '',
    companheiroTipo: r.subclasses.feras.companheiro_tipo || '',
    golpeTerrivelMax: modSab,
    golpeTerrivelDisponiveis: Math.max(0, modSab - r.subclasses.vigilante.golpe_terrivel_usos_gastos)
  };
}

function getProgressaoClerigo() {
  if (char?.classe !== 'Clérigo' || !classeData?.tabela_caracteristicas) return null;
  const row = classeData.tabela_caracteristicas.find(r => parseInt(r['Nível']) === (char.nivel || 1));
  if (!row) return null;
  return {
    canalizarDivindadeMax: parseInt(row['Canalizar Divindade']) || 0
  };
}

function getEstadoRecursosClerigo() {
  if (char?.classe !== 'Clérigo') return null;
  if (!char.recursos) char.recursos = {};
  if (!char.recursos.clerigo) char.recursos.clerigo = {};

  const prog = getProgressaoClerigo() || { canalizarDivindadeMax: 0 };
  if (typeof char.recursos.clerigo.canalizar_divindade_usos_gastos !== 'number') {
    char.recursos.clerigo.canalizar_divindade_usos_gastos = 0;
  }
  if (typeof char.recursos.clerigo.intervencao_divina_bloqueada !== 'boolean') {
    char.recursos.clerigo.intervencao_divina_bloqueada = false;
  }
  if (typeof char.recursos.clerigo.intervencao_divina_descansos_restantes !== 'number') {
    char.recursos.clerigo.intervencao_divina_descansos_restantes = 0;
  }
  if (!char.recursos.clerigo.subclasses) {
    char.recursos.clerigo.subclasses = {
      guerra: {
        sacerdote_guerra_usos_gastos: 0
      },
      luz: {
        labareda_protetora_usos_gastos: 0,
        coroa_luz_usos_gastos: 0
      },
      trapaca: {
        bencao_trapaceiro_ativa: false,
        invocar_duplicidade_ativa: false
      },
      vida: {}
    };
  }

  if (typeof char.recursos.clerigo.subclasses?.guerra?.sacerdote_guerra_usos_gastos !== 'number') {
    char.recursos.clerigo.subclasses.guerra.sacerdote_guerra_usos_gastos = 0;
  }
  if (typeof char.recursos.clerigo.subclasses?.luz?.labareda_protetora_usos_gastos !== 'number') {
    char.recursos.clerigo.subclasses.luz.labareda_protetora_usos_gastos = 0;
  }
  if (typeof char.recursos.clerigo.subclasses?.luz?.coroa_luz_usos_gastos !== 'number') {
    char.recursos.clerigo.subclasses.luz.coroa_luz_usos_gastos = 0;
  }
  if (typeof char.recursos.clerigo.subclasses?.trapaca?.bencao_trapaceiro_ativa !== 'boolean') {
    char.recursos.clerigo.subclasses.trapaca.bencao_trapaceiro_ativa = false;
  }
  if (typeof char.recursos.clerigo.subclasses?.trapaca?.invocar_duplicidade_ativa !== 'boolean') {
    char.recursos.clerigo.subclasses.trapaca.invocar_duplicidade_ativa = false;
  }

  const usosDisponiveis = Math.max(0, prog.canalizarDivindadeMax - char.recursos.clerigo.canalizar_divindade_usos_gastos);

  return {
    canalizarDivindadeMax: prog.canalizarDivindadeMax,
    canalizarDivindadeUsosGastos: char.recursos.clerigo.canalizar_divindade_usos_gastos,
    canalizarDivindadeUsosDisponiveis: usosDisponiveis,
    intervencaoDivinaBloqueada: !!char.recursos.clerigo.intervencao_divina_bloqueada,
    intervencaoDivinaDescansosRestantes: char.recursos.clerigo.intervencao_divina_descansos_restantes
  };
}

function getEstadoSubclassesClerigo() {
  if (char?.classe !== 'Clérigo') return null;
  const estado = getEstadoRecursosClerigo();
  if (!estado) return null;

  const modSab = Math.max(1, calcMod(char.atributos.sabedoria));
  const sub = char.recursos.clerigo.subclasses;

  const sacerdoteMax = modSab;
  const sacerdoteGastos = sub.guerra.sacerdote_guerra_usos_gastos;

  const labaredaMax = modSab;
  const labaredaGastos = sub.luz.labareda_protetora_usos_gastos;

  const coroaMax = modSab;
  const coroaGastos = sub.luz.coroa_luz_usos_gastos;

  return {
    guerra: {
      sacerdoteUsosMax: sacerdoteMax,
      sacerdoteUsosGastos: sacerdoteGastos,
      sacerdoteUsosDisponiveis: Math.max(0, sacerdoteMax - sacerdoteGastos)
    },
    luz: {
      labaredaUsosMax: labaredaMax,
      labaredaUsosGastos: labaredaGastos,
      labaredaUsosDisponiveis: Math.max(0, labaredaMax - labaredaGastos),
      coroaUsosMax: coroaMax,
      coroaUsosGastos: coroaGastos,
      coroaUsosDisponiveis: Math.max(0, coroaMax - coroaGastos)
    },
    trapaca: {
      bencaoTrapaceiroAtiva: !!sub.trapaca.bencao_trapaceiro_ativa,
      invocarDuplicidadeAtiva: !!sub.trapaca.invocar_duplicidade_ativa
    }
  };
}

function getProgressaoBruxo() {
  if (char?.classe !== 'Bruxo' || !classeData?.tabela_caracteristicas) return null;
  const row = classeData.tabela_caracteristicas.find(r => parseInt(r['Nível']) === (char.nivel || 1));
  if (!row) return null;
  return {
    invocacoesMax: parseInt(row['Invocações']) || 0
  };
}

function getCirculosArcanumDesbloqueados() {
  const nivel = char?.nivel || 1;
  const circulos = [];
  if (nivel >= 11) circulos.push(6);
  if (nivel >= 13) circulos.push(7);
  if (nivel >= 15) circulos.push(8);
  if (nivel >= 17) circulos.push(9);
  return circulos;
}

function getEstadoRecursosBruxo() {
  if (char?.classe !== 'Bruxo') return null;
  if (!char.recursos) char.recursos = {};
  if (!char.recursos.bruxo) {
    char.recursos.bruxo = {
      astucia_usada: false,
      pacto: '',
      invocacoes: [],
      arcanum: {
        6: { magia: '', usado: false },
        7: { magia: '', usado: false },
        8: { magia: '', usado: false },
        9: { magia: '', usado: false }
      }
    };
  }

  if (!Array.isArray(char.recursos.bruxo.invocacoes)) char.recursos.bruxo.invocacoes = [];

  // Migracao: converter strings antigas para objetos {nome, truque?}
  char.recursos.bruxo.invocacoes = char.recursos.bruxo.invocacoes.map(inv => {
    if (typeof inv === 'string') return { nome: inv };
    if (inv && typeof inv === 'object' && inv.nome) return inv;
    return null;
  }).filter(Boolean);

  // Migracao: se pacto estava definido separadamente mas nao esta nas invocacoes, incluir
  const PACTOS_VALIDOS = ['Pacto da Corrente', 'Pacto da Lâmina', 'Pacto do Tomo'];
  const pactoAtual = char.recursos.bruxo.pacto || '';
  const nomesInvocacoes = char.recursos.bruxo.invocacoes.map(i => i.nome);
  if (pactoAtual && PACTOS_VALIDOS.includes(pactoAtual) && !nomesInvocacoes.includes(pactoAtual)) {
    char.recursos.bruxo.invocacoes.unshift({ nome: pactoAtual });
  }
  // Derivar pacto do array de invocacoes
  const pactoDerivado = PACTOS_VALIDOS.find(p => char.recursos.bruxo.invocacoes.some(i => i.nome === p)) || '';
  if (pactoDerivado !== char.recursos.bruxo.pacto) {
    char.recursos.bruxo.pacto = pactoDerivado;
  }

  if (!char.recursos.bruxo.arcanum) {
    char.recursos.bruxo.arcanum = {
      6: { magia: '', usado: false },
      7: { magia: '', usado: false },
      8: { magia: '', usado: false },
      9: { magia: '', usado: false }
    };
  }

  [6, 7, 8, 9].forEach(c => {
    if (!char.recursos.bruxo.arcanum[c]) {
      char.recursos.bruxo.arcanum[c] = { magia: '', usado: false };
    }
    if (typeof char.recursos.bruxo.arcanum[c].usado !== 'boolean') {
      char.recursos.bruxo.arcanum[c].usado = false;
    }
    if (typeof char.recursos.bruxo.arcanum[c].magia !== 'string') {
      char.recursos.bruxo.arcanum[c].magia = '';
    }
  });

  const progressao = getProgressaoBruxo() || { invocacoesMax: 0 };
  const circulosArcanum = getCirculosArcanumDesbloqueados();

  // Inicializar dados do Pacto do Tomo (truques e rituais escolhidos)
  if (!char.recursos.bruxo.pacto_tomo) {
    char.recursos.bruxo.pacto_tomo = { truques: [], rituais: [] };
  }
  if (!Array.isArray(char.recursos.bruxo.pacto_tomo.truques)) char.recursos.bruxo.pacto_tomo.truques = [];
  if (!Array.isArray(char.recursos.bruxo.pacto_tomo.rituais)) char.recursos.bruxo.pacto_tomo.rituais = [];

  // Inicializar recursos de subclasses do Bruxo
  if (!char.recursos.bruxo.subclasses) {
    char.recursos.bruxo.subclasses = {
      arquifada: { passos_feericos_usos_gastos: 0, fuga_nevoa_usada: false, defesas_sedutoras_usada: false },
      celestial: { luz_medicinal_dados_gastos: 0, vinganca_calcinante_usada: false },
      grande_antigo: { combatente_clarividente_usado: false },
      infero: { sorte_tenebroso_usos_gastos: 0, resistencia_infera_escolha: '', lancar_inferno_usado: false }
    };
  }
  const sub = char.recursos.bruxo.subclasses;
  if (!sub.arquifada) sub.arquifada = { passos_feericos_usos_gastos: 0, fuga_nevoa_usada: false, defesas_sedutoras_usada: false };
  if (!sub.celestial) sub.celestial = { luz_medicinal_dados_gastos: 0, vinganca_calcinante_usada: false };
  if (!sub.grande_antigo) sub.grande_antigo = { combatente_clarividente_usado: false };
  if (!sub.infero) sub.infero = { sorte_tenebroso_usos_gastos: 0, resistencia_infera_escolha: '', lancar_inferno_usado: false };
  if (typeof sub.arquifada.passos_feericos_usos_gastos !== 'number') sub.arquifada.passos_feericos_usos_gastos = 0;
  if (typeof sub.arquifada.fuga_nevoa_usada !== 'boolean') sub.arquifada.fuga_nevoa_usada = false;
  if (typeof sub.arquifada.defesas_sedutoras_usada !== 'boolean') sub.arquifada.defesas_sedutoras_usada = false;
  if (typeof sub.celestial.luz_medicinal_dados_gastos !== 'number') sub.celestial.luz_medicinal_dados_gastos = 0;
  if (typeof sub.celestial.vinganca_calcinante_usada !== 'boolean') sub.celestial.vinganca_calcinante_usada = false;
  if (typeof sub.grande_antigo.combatente_clarividente_usado !== 'boolean') sub.grande_antigo.combatente_clarividente_usado = false;
  if (typeof sub.infero.sorte_tenebroso_usos_gastos !== 'number') sub.infero.sorte_tenebroso_usos_gastos = 0;
  if (typeof sub.infero.lancar_inferno_usado !== 'boolean') sub.infero.lancar_inferno_usado = false;

  const nivel = char.nivel || 1;
  const modCar = Math.max(1, calcMod(char.atributos.carisma));

  return {
    astuciaUsada: !!char.recursos.bruxo.astucia_usada,
    pacto: char.recursos.bruxo.pacto || '',
    invocacoes: char.recursos.bruxo.invocacoes,
    invocacoesMax: progressao.invocacoesMax,
    arcanum: char.recursos.bruxo.arcanum,
    circulosArcanum,
    mestreMisticoAtivo: nivel >= 20,
    pactoTomo: char.recursos.bruxo.pacto_tomo,
    nivel,
    modCar,
    subclasses: sub,
    // Arquifada
    passosFeericosMax: modCar,
    passosFeericosDisponiveis: Math.max(0, modCar - sub.arquifada.passos_feericos_usos_gastos),
    fugaNeVoaUsada: !!sub.arquifada.fuga_nevoa_usada,
    defesasSedutorasUsada: !!sub.arquifada.defesas_sedutoras_usada,
    // Celestial
    luzMedicinalDadosMax: 1 + nivel,
    luzMedicinalDadosDisponiveis: Math.max(0, (1 + nivel) - sub.celestial.luz_medicinal_dados_gastos),
    vingancaCalcinanteUsada: !!sub.celestial.vinganca_calcinante_usada,
    // Grande Antigo
    combatenteClarividenteUsado: !!sub.grande_antigo.combatente_clarividente_usado,
    // Ínfero
    sorteTenebrosoMax: modCar,
    sorteTenebrosoDisponiveis: Math.max(0, modCar - sub.infero.sorte_tenebroso_usos_gastos),
    resistenciaInferaEscolha: sub.infero.resistencia_infera_escolha || '',
    lancarInfernoUsado: !!sub.infero.lancar_inferno_usado
  };
}

function getProgressaoDruida() {
  if (char?.classe !== 'Druida' || !classeData?.tabela_caracteristicas) return null;
  const row = classeData.tabela_caracteristicas.find(r => parseInt(r['Nível']) === (char.nivel || 1));
  if (!row) return null;
  return {
    formaSelvagemMax: parseInt(row['Forma Selvagem']) || 0
  };
}

function getEstadoRecursosDruida() {
  if (char?.classe !== 'Druida') return null;
  if (!char.recursos) char.recursos = {};
  if (!char.recursos.druida) {
    char.recursos.druida = {
      forma_selvagem_usos_gastos: 0,
      forma_selvagem_ativa: false,
      companheiro_selvagem_ativo: false,
      ressurgimento_slot_recuperado_hoje: false
    };
  }

  if (typeof char.recursos.druida.forma_selvagem_usos_gastos !== 'number') char.recursos.druida.forma_selvagem_usos_gastos = 0;
  if (typeof char.recursos.druida.forma_selvagem_ativa !== 'boolean') char.recursos.druida.forma_selvagem_ativa = false;
  if (typeof char.recursos.druida.companheiro_selvagem_ativo !== 'boolean') char.recursos.druida.companheiro_selvagem_ativo = false;
  if (typeof char.recursos.druida.ressurgimento_slot_recuperado_hoje !== 'boolean') char.recursos.druida.ressurgimento_slot_recuperado_hoje = false;

  // Subclasses do Druida
  if (!char.recursos.druida.subclasses) char.recursos.druida.subclasses = {};
  // Circulo da Lua
  if (!char.recursos.druida.subclasses.lua) {
    char.recursos.druida.subclasses.lua = { passo_lunar_usos_gastos: 0 };
  }
  if (typeof char.recursos.druida.subclasses.lua.passo_lunar_usos_gastos !== 'number') char.recursos.druida.subclasses.lua.passo_lunar_usos_gastos = 0;
  // Circulo da Terra
  if (!char.recursos.druida.subclasses.terra) {
    char.recursos.druida.subclasses.terra = { recuperacao_natural_magia_usada: false, recuperacao_natural_slots_usada: false };
  }
  if (typeof char.recursos.druida.subclasses.terra.recuperacao_natural_magia_usada !== 'boolean') char.recursos.druida.subclasses.terra.recuperacao_natural_magia_usada = false;
  if (typeof char.recursos.druida.subclasses.terra.recuperacao_natural_slots_usada !== 'boolean') char.recursos.druida.subclasses.terra.recuperacao_natural_slots_usada = false;
  // Circulo das Estrelas
  if (!char.recursos.druida.subclasses.estrelas) {
    char.recursos.druida.subclasses.estrelas = { mapa_estelar_usos_gastos: 0, pressagio_cosmico_usos_gastos: 0, pressagio_tipo: '', constelacao_ativa: '' };
  }
  if (typeof char.recursos.druida.subclasses.estrelas.mapa_estelar_usos_gastos !== 'number') char.recursos.druida.subclasses.estrelas.mapa_estelar_usos_gastos = 0;
  if (typeof char.recursos.druida.subclasses.estrelas.pressagio_cosmico_usos_gastos !== 'number') char.recursos.druida.subclasses.estrelas.pressagio_cosmico_usos_gastos = 0;
  if (typeof char.recursos.druida.subclasses.estrelas.pressagio_tipo !== 'string') char.recursos.druida.subclasses.estrelas.pressagio_tipo = '';
  if (typeof char.recursos.druida.subclasses.estrelas.constelacao_ativa !== 'string') char.recursos.druida.subclasses.estrelas.constelacao_ativa = '';

  const prog = getProgressaoDruida() || { formaSelvagemMax: 0 };
  const usosDisponiveis = Math.max(0, prog.formaSelvagemMax - char.recursos.druida.forma_selvagem_usos_gastos);
  const modSab = Math.max(1, calcMod(char.atributos?.sabedoria || 10));

  return {
    formaSelvagemAtiva: !!char.recursos.druida.forma_selvagem_ativa,
    companheiroSelvagemAtivo: !!char.recursos.druida.companheiro_selvagem_ativo,
    usosGastos: char.recursos.druida.forma_selvagem_usos_gastos,
    usosMax: prog.formaSelvagemMax,
    usosDisponiveis,
    ressurgimentoSlotRecuperadoHoje: !!char.recursos.druida.ressurgimento_slot_recuperado_hoje,
    arquidruidaAtivo: (char.nivel || 1) >= 20,
    ressurgimentoAtivo: (char.nivel || 1) >= 5,
    // Subclasses - propriedades computadas
    passoLunarMax: modSab,
    passoLunarDisponiveis: Math.max(0, modSab - char.recursos.druida.subclasses.lua.passo_lunar_usos_gastos),
    recuperacaoNaturalMagiaUsada: !!char.recursos.druida.subclasses.terra.recuperacao_natural_magia_usada,
    recuperacaoNaturalSlotsUsada: !!char.recursos.druida.subclasses.terra.recuperacao_natural_slots_usada,
    mapaEstelarMax: modSab,
    mapaEstelarDisponiveis: Math.max(0, modSab - char.recursos.druida.subclasses.estrelas.mapa_estelar_usos_gastos),
    pressagioMax: modSab,
    pressagioDisponiveis: Math.max(0, modSab - char.recursos.druida.subclasses.estrelas.pressagio_cosmico_usos_gastos),
    pressagioTipo: char.recursos.druida.subclasses.estrelas.pressagio_tipo || '',
    constelacaoAtiva: char.recursos.druida.subclasses.estrelas.constelacao_ativa || ''
  };
}

function consumirUsoFormaSelvagem(qtd = 1) {
  const estado = getEstadoRecursosDruida();
  if (!estado || qtd <= 0 || estado.usosDisponiveis < qtd) return false;
  char.recursos.druida.forma_selvagem_usos_gastos += qtd;
  return true;
}

function recuperarUmUsoFormaSelvagem() {
  const estado = getEstadoRecursosDruida();
  if (!estado || estado.usosDisponiveis >= estado.usosMax) return false;
  char.recursos.druida.forma_selvagem_usos_gastos = Math.max(0, char.recursos.druida.forma_selvagem_usos_gastos - 1);
  return true;
}

function getProgressaoFeiticeiro() {
  if (char?.classe !== 'Feiticeiro' || !classeData?.tabela_caracteristicas) return null;
  const row = classeData.tabela_caracteristicas.find(r => parseInt(r['Nível']) === (char.nivel || 1));
  if (!row) return null;
  const pontosStr = String(row['Pontos de Feitiçaria'] || '0').trim();
  const pontosMax = pontosStr === '—' ? 0 : (parseInt(pontosStr) || 0);
  return { pontosMax };
}

function getEstadoRecursosFeiticeiro() {
  if (char?.classe !== 'Feiticeiro') return null;
  if (!char.recursos) char.recursos = {};
  if (!char.recursos.feiticeiro) {
    char.recursos.feiticeiro = {
      pontos_feiticaria_gastos: 0,
      feiticaria_inata_usos_gastos: 0,
      feiticaria_inata_ativa: false,
      restauracao_feiticeira_usada: false,
      metamagias: [],
      subclasses: {
        aberrante: {
          telepatia_ativa: false,
          telepatia_duracao_min: 0,
          revelacao_carne_ativa: false
        },
        draconica: {
          afinidade_elemental: '',
          asas_ativas: false,
          asas_usada_desde_descanso: false,
          companheiro_draconico_usado: false,
          bonus_pv_aplicado: 0
        },
        mecanica: {
          restaurar_equilibrio_usos_gastos: 0,
          transe_ordem_ativo: false,
          transe_ordem_usado_desde_descanso: false,
          bastiao_dados: 0
        },
        selvagem: {
          mares_caos_disponivel: true,
          surto_pendente_automatico: false,
          surto_controlado_usado: false
        }
      }
    };
  }

  const r = char.recursos.feiticeiro;
  if (typeof r.pontos_feiticaria_gastos !== 'number') r.pontos_feiticaria_gastos = 0;
  if (typeof r.feiticaria_inata_usos_gastos !== 'number') r.feiticaria_inata_usos_gastos = 0;
  if (typeof r.feiticaria_inata_ativa !== 'boolean') r.feiticaria_inata_ativa = false;
  if (typeof r.restauracao_feiticeira_usada !== 'boolean') r.restauracao_feiticeira_usada = false;
  if (!Array.isArray(r.metamagias)) r.metamagias = [];
  if (!r.subclasses) r.subclasses = {};
  if (!r.subclasses.aberrante) r.subclasses.aberrante = { telepatia_ativa: false, telepatia_duracao_min: 0, revelacao_carne_ativa: false };
  if (!r.subclasses.draconica) r.subclasses.draconica = { afinidade_elemental: '', asas_ativas: false, asas_usada_desde_descanso: false, companheiro_draconico_usado: false, bonus_pv_aplicado: 0 };
  if (!r.subclasses.mecanica) r.subclasses.mecanica = { restaurar_equilibrio_usos_gastos: 0, transe_ordem_ativo: false, transe_ordem_usado_desde_descanso: false, bastiao_dados: 0 };
  if (!r.subclasses.selvagem) r.subclasses.selvagem = { mares_caos_disponivel: true, surto_pendente_automatico: false, surto_controlado_usado: false };

  const prog = getProgressaoFeiticeiro() || { pontosMax: 0 };
  const pontosAtuais = Math.max(0, prog.pontosMax - r.pontos_feiticaria_gastos);
  const usosInataMax = 2;
  const usosInataDisponiveis = Math.max(0, usosInataMax - r.feiticaria_inata_usos_gastos);
  const modCar = Math.max(1, calcMod(char.atributos.carisma));

  return {
    pontosMax: prog.pontosMax,
    pontosAtuais,
    pontosGastos: r.pontos_feiticaria_gastos,
    feiticariaInataAtiva: !!r.feiticaria_inata_ativa,
    feiticariaInataUsosMax: usosInataMax,
    feiticariaInataUsosDisponiveis: usosInataDisponiveis,
    restauracaoFeiticeiraUsada: !!r.restauracao_feiticeira_usada,
    metamagias: r.metamagias,
    modCar,
    subclasses: r.subclasses
  };
}

function gastarPontosFeiticaria(qtd) {
  const estado = getEstadoRecursosFeiticeiro();
  if (!estado || qtd <= 0 || estado.pontosAtuais < qtd) return false;
  char.recursos.feiticeiro.pontos_feiticaria_gastos += qtd;
  return true;
}

function recuperarPontosFeiticaria(qtd) {
  const estado = getEstadoRecursosFeiticeiro();
  if (!estado || qtd <= 0) return false;
  char.recursos.feiticeiro.pontos_feiticaria_gastos = Math.max(0, char.recursos.feiticeiro.pontos_feiticaria_gastos - qtd);
  return true;
}

function sincronizarBonusPvDraconico() {
  if (char?.classe !== 'Feiticeiro') return;
  const estado = getEstadoRecursosFeiticeiro();
  if (!estado) return;

  const ehDraconica = semAcento(char.subclasse || '') === semAcento('Feitiçaria Dracônica');
  const esperado = ehDraconica && (char.nivel || 1) >= 3 ? ((char.nivel || 1) + 2) : 0;
  const aplicado = char.recursos.feiticeiro.subclasses.draconica.bonus_pv_aplicado || 0;

  if (esperado === aplicado) return;

  const diff = esperado - aplicado;
  char.pv_max = Math.max(1, (char.pv_max || 1) + diff);
  char.pv_atual = Math.max(0, Math.min((char.pv_max_override || char.pv_max), (char.pv_atual || 0) + diff));
  char.recursos.feiticeiro.subclasses.draconica.bonus_pv_aplicado = esperado;
  salvar();
}

/** Sincroniza bonus de PV da Tenacidade Anã (+1 por nivel) */
function sincronizarBonusPvAnao() {
  const ehAnao = char?.especie === 'Anão';
  const esperado = ehAnao ? (char.nivel || 1) : 0;
  const aplicado = char.bonus_pv_anao_aplicado || 0;

  if (esperado === aplicado) return;

  const diff = esperado - aplicado;
  char.pv_max = Math.max(1, (char.pv_max || 1) + diff);
  char.pv_atual = Math.max(0, Math.min((char.pv_max_override || char.pv_max), (char.pv_atual || 0) + diff));
  char.bonus_pv_anao_aplicado = esperado;
  salvar();
}

/** Sincroniza bonus de PV do talento Vigoroso (+2 por nivel) */
function sincronizarBonusPvVigoroso() {
  const temVigoroso = (char.talentos || []).some(t => (typeof t === 'string' ? t : t.nome) === 'Vigoroso');
  const esperado = temVigoroso ? (char.nivel || 1) * 2 : 0;
  const aplicado = char.bonus_pv_vigoroso_aplicado || 0;

  if (esperado === aplicado) return;

  const diff = esperado - aplicado;
  char.pv_max = Math.max(1, (char.pv_max || 1) + diff);
  char.pv_atual = Math.max(0, Math.min((char.pv_max_override || char.pv_max), (char.pv_atual || 0) + diff));
  char.bonus_pv_vigoroso_aplicado = esperado;
  salvar();
}

// Progressão e recursos do Guerreiro
function getProgressaoGuerreiro() {
  if (char?.classe !== 'Guerreiro' || !classeData?.tabela_caracteristicas) return null;
  const row = classeData.tabela_caracteristicas.find(r => parseInt(r['Nível']) === (char.nivel || 1));
  if (!row) return null;
  return {
    recuperarFolegoMax: parseInt(row['Recuperar Fôlego']) || 2,
    maestriasMax: parseInt(row['Maestria em Arma']) || 3
  };
}

function getEstadoRecursosGuerreiro() {
  if (char?.classe !== 'Guerreiro') return null;
  if (!char.recursos) char.recursos = {};
  if (!char.recursos.guerreiro) {
    char.recursos.guerreiro = {
      recuperar_folego_usos_gastos: 0,
      surto_acao_usos_gastos: 0,
      indomavel_usos_gastos: 0
    };
  }

  // Inicializar recursos de subclasses do Guerreiro
  if (!char.recursos.guerreiro.subclasses) {
    char.recursos.guerreiro.subclasses = {
      mestre_batalha: {
        dados_superioridade_gastos: 0,
        conheca_inimigo_usado: false
      },
      combatente_psiquico: {
        dados_psionicos_gastos: 0,
        movimento_telecinetico_usado: false,
        salto_impulsao_usado: false,
        baluarte_usado: false,
        mestre_telecinetico_usado: false
      }
    };
  }
  const sub = char.recursos.guerreiro.subclasses;
  if (!sub.mestre_batalha) sub.mestre_batalha = { dados_superioridade_gastos: 0, conheca_inimigo_usado: false };
  if (!sub.combatente_psiquico) sub.combatente_psiquico = { dados_psionicos_gastos: 0, movimento_telecinetico_usado: false, salto_impulsao_usado: false, baluarte_usado: false, mestre_telecinetico_usado: false };

  const mb = sub.mestre_batalha;
  const cp = sub.combatente_psiquico;
  if (typeof mb.dados_superioridade_gastos !== 'number') mb.dados_superioridade_gastos = 0;
  if (typeof mb.conheca_inimigo_usado !== 'boolean') mb.conheca_inimigo_usado = false;
  if (typeof cp.dados_psionicos_gastos !== 'number') cp.dados_psionicos_gastos = 0;
  if (typeof cp.movimento_telecinetico_usado !== 'boolean') cp.movimento_telecinetico_usado = false;
  if (typeof cp.salto_impulsao_usado !== 'boolean') cp.salto_impulsao_usado = false;
  if (typeof cp.baluarte_usado !== 'boolean') cp.baluarte_usado = false;
  if (typeof cp.mestre_telecinetico_usado !== 'boolean') cp.mestre_telecinetico_usado = false;

  const r = char.recursos.guerreiro;
  if (typeof r.recuperar_folego_usos_gastos !== 'number') r.recuperar_folego_usos_gastos = 0;
  if (typeof r.surto_acao_usos_gastos !== 'number') r.surto_acao_usos_gastos = 0;
  if (typeof r.indomavel_usos_gastos !== 'number') r.indomavel_usos_gastos = 0;

  const prog = getProgressaoGuerreiro() || { recuperarFolegoMax: 2, maestriasMax: 3 };
  const nivel = char.nivel || 1;

  // Surto de Ação: 1 uso até nível 16, 2 usos a partir do nível 17
  const surtoMax = nivel >= 17 ? 2 : 1;
  // Indomável: 1 uso a partir do nível 9, 2 a partir do 13, 3 a partir do 17
  let indomavelMax = 0;
  if (nivel >= 17) indomavelMax = 3;
  else if (nivel >= 13) indomavelMax = 2;
  else if (nivel >= 9) indomavelMax = 1;

  // --- Mestre da Batalha ---
  const ehMestreBatalha = char.subclasse === 'Mestre da Batalha';
  let dadosSuperioridadeMax = 0, tipoDadoSuperioridade = 'd8';
  if (ehMestreBatalha && nivel >= 3) {
    // Quantidade: 4 (lv3), 5 (lv7), 6 (lv15)
    if (nivel >= 15) dadosSuperioridadeMax = 6;
    else if (nivel >= 7) dadosSuperioridadeMax = 5;
    else dadosSuperioridadeMax = 4;
    // Tipo: d8 (lv3), d10 (lv10), d12 (lv18)
    if (nivel >= 18) tipoDadoSuperioridade = 'd12';
    else if (nivel >= 10) tipoDadoSuperioridade = 'd10';
  }
  const cdSuperioridade = ehMestreBatalha
    ? 8 + Math.max(calcMod(char.atributos?.forca || 10), calcMod(char.atributos?.destreza || 10)) + bonusProficiencia(nivel)
    : 0;
  let manobrasConhecidas = 0;
  if (ehMestreBatalha && nivel >= 3) {
    manobrasConhecidas = 3;
    if (nivel >= 15) manobrasConhecidas = 9;
    else if (nivel >= 10) manobrasConhecidas = 7;
    else if (nivel >= 7) manobrasConhecidas = 5;
  }
  const conhecaInimigoAtivo = ehMestreBatalha && nivel >= 7;
  const implacavelAtivo = ehMestreBatalha && nivel >= 15;

  // --- Combatente Psíquico ---
  const ehCombatentePsiquico = char.subclasse === 'Combatente Psíquico';
  let dadosPsionicosMaxG = 0, tipoDadoPsionicoG = 'd6';
  if (ehCombatentePsiquico && nivel >= 3) {
    if (nivel >= 17) { dadosPsionicosMaxG = 12; tipoDadoPsionicoG = 'd12'; }
    else if (nivel >= 13) { dadosPsionicosMaxG = 10; tipoDadoPsionicoG = 'd10'; }
    else if (nivel >= 11) { dadosPsionicosMaxG = 8; tipoDadoPsionicoG = 'd10'; }
    else if (nivel >= 9) { dadosPsionicosMaxG = 8; tipoDadoPsionicoG = 'd8'; }
    else if (nivel >= 5) { dadosPsionicosMaxG = 6; tipoDadoPsionicoG = 'd8'; }
    else { dadosPsionicosMaxG = 4; tipoDadoPsionicoG = 'd6'; }
  }
  const adeptoTelecineticoAtivo = ehCombatentePsiquico && nivel >= 7;
  const resguardoMentalAtivo = ehCombatentePsiquico && nivel >= 10;
  const baluarteEnergiaAtivo = ehCombatentePsiquico && nivel >= 15;
  const mestreTelecineticoAtivo = ehCombatentePsiquico && nivel >= 18;

  return {
    nivel,
    recuperarFolegoMax: prog.recuperarFolegoMax,
    recuperarFolegoDisponiveis: Math.max(0, prog.recuperarFolegoMax - r.recuperar_folego_usos_gastos),
    recuperarFolegoGastos: r.recuperar_folego_usos_gastos,
    surtoMax,
    surtoDisponiveis: Math.max(0, surtoMax - r.surto_acao_usos_gastos),
    surtoGastos: r.surto_acao_usos_gastos,
    indomavelMax,
    indomavelDisponiveis: Math.max(0, indomavelMax - r.indomavel_usos_gastos),
    indomavelGastos: r.indomavel_usos_gastos,
    maestriasMax: prog.maestriasMax,
    // Mestre da Batalha
    ehMestreBatalha,
    dadosSuperioridadeMax,
    dadosSuperioridadeDisponiveis: Math.max(0, dadosSuperioridadeMax - mb.dados_superioridade_gastos),
    dadosSuperioridadeGastos: mb.dados_superioridade_gastos,
    tipoDadoSuperioridade,
    cdSuperioridade,
    manobrasConhecidas,
    conhecaInimigoAtivo,
    conhecaInimigoUsado: mb.conheca_inimigo_usado,
    implacavelAtivo,
    // Combatente Psíquico
    ehCombatentePsiquico,
    dadosPsionicosMaxG,
    dadosPsionicosDisponiveisG: Math.max(0, dadosPsionicosMaxG - cp.dados_psionicos_gastos),
    dadosPsionicosGastosG: cp.dados_psionicos_gastos,
    tipoDadoPsionicoG,
    movimentoTelecineticoUsado: cp.movimento_telecinetico_usado,
    adeptoTelecineticoAtivo,
    saltoImpulsaoUsado: cp.salto_impulsao_usado,
    resguardoMentalAtivo,
    baluarteEnergiaAtivo,
    baluarteUsado: cp.baluarte_usado,
    mestreTelecineticoAtivo,
    mestreTelecineticoUsado: cp.mestre_telecinetico_usado,
    subclasses: sub
  };
}

// Tabela de conjuração do Cavaleiro Místico (subclasse do Guerreiro)
function getCavaleiroMisticoConjuracao() {
  if (char?.classe !== 'Guerreiro' || char?.subclasse !== 'Cavaleiro Místico') return null;
  const nivel = char.nivel || 1;
  if (nivel < 3) return null;

  // Tabela: truques, preparadas (magias conhecidas), espaços por círculo
  const tabela = {
    3:  { truques: 2, preparadas: 3,  espacos: {1: 2} },
    4:  { truques: 2, preparadas: 4,  espacos: {1: 3} },
    5:  { truques: 2, preparadas: 4,  espacos: {1: 3} },
    7:  { truques: 2, preparadas: 5,  espacos: {1: 4, 2: 2} },
    8:  { truques: 2, preparadas: 6,  espacos: {1: 4, 2: 2} },
    10: { truques: 3, preparadas: 7,  espacos: {1: 4, 2: 3} },
    11: { truques: 3, preparadas: 8,  espacos: {1: 4, 2: 3} },
    13: { truques: 3, preparadas: 9,  espacos: {1: 4, 2: 3, 3: 2} },
    14: { truques: 3, preparadas: 10, espacos: {1: 4, 2: 3, 3: 2} },
    16: { truques: 3, preparadas: 11, espacos: {1: 4, 2: 3, 3: 3} },
    19: { truques: 3, preparadas: 12, espacos: {1: 4, 2: 3, 3: 3, 4: 1} },
    20: { truques: 3, preparadas: 13, espacos: {1: 4, 2: 3, 3: 3, 4: 1} }
  };

  // Encontrar a entrada mais próxima (menor ou igual ao nível atual)
  const niveis = Object.keys(tabela).map(Number).sort((a, b) => a - b);
  let entrada = null;
  for (const n of niveis) {
    if (n <= nivel) entrada = tabela[n];
  }
  return entrada;
}

// Tabela de conjuração do Trapaceiro Arcano (subclasse do Ladino)
// Mesma progressão de espaços que o Cavaleiro Místico (1/3 conjurador), mas truques diferentes
function getTrapaceiroArcanoConjuracao() {
  if (char?.classe !== 'Ladino' || char?.subclasse !== 'Trapaceiro Arcano') return null;
  const nivel = char.nivel || 1;
  if (nivel < 3) return null;

  // Truques: 3 até nível 9 (Mãos Mágicas + 2), 4 a partir do nível 10 (Mãos Mágicas + 3)
  const tabela = {
    3:  { truques: 3, preparadas: 3,  espacos: {1: 2} },
    4:  { truques: 3, preparadas: 4,  espacos: {1: 3} },
    5:  { truques: 3, preparadas: 4,  espacos: {1: 3} },
    7:  { truques: 3, preparadas: 5,  espacos: {1: 4, 2: 2} },
    8:  { truques: 3, preparadas: 6,  espacos: {1: 4, 2: 2} },
    10: { truques: 4, preparadas: 7,  espacos: {1: 4, 2: 3} },
    11: { truques: 4, preparadas: 8,  espacos: {1: 4, 2: 3} },
    13: { truques: 4, preparadas: 9,  espacos: {1: 4, 2: 3, 3: 2} },
    14: { truques: 4, preparadas: 10, espacos: {1: 4, 2: 3, 3: 2} },
    16: { truques: 4, preparadas: 11, espacos: {1: 4, 2: 3, 3: 3} },
    19: { truques: 4, preparadas: 12, espacos: {1: 4, 2: 3, 3: 3, 4: 1} },
    20: { truques: 4, preparadas: 13, espacos: {1: 4, 2: 3, 3: 3, 4: 1} }
  };

  const niveis = Object.keys(tabela).map(Number).sort((a, b) => a - b);
  let entrada = null;
  for (const n of niveis) {
    if (n <= nivel) entrada = tabela[n];
  }
  return entrada;
}

// Retorna a tabela de conjuração da subclasse ativa (Cavaleiro Místico ou Trapaceiro Arcano)
function getSubclasseConjuradoraConjuracao() {
  return getCavaleiroMisticoConjuracao() || getTrapaceiroArcanoConjuracao();
}

// Verifica se a subclasse atual concede conjuração
function ehSubclasseConjuradora() {
  const nivel = char?.nivel || 1;
  if (nivel < 3) return false;
  return (char?.classe === 'Guerreiro' && char?.subclasse === 'Cavaleiro Místico')
      || (char?.classe === 'Ladino' && char?.subclasse === 'Trapaceiro Arcano');
}

function consumirEspacoMagiaDisponivel(circuloMinimo = 1) {
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

function recuperarEspacoMagia(circulo = 1) {
  const slot = char?.espacos_magia?.[circulo];
  if (!slot || (slot.usados || 0) <= 0) return false;
  slot.usados -= 1;
  return true;
}

function recuperarEspacosMagiaBruxo(parcial = false) {
  if (char?.classe !== 'Bruxo' || !char.espacos_magia) return 0;
  const chaves = Object.keys(char.espacos_magia);
  if (chaves.length === 0) return 0;

  const usadosAntes = chaves.reduce((acc, c) => acc + (char.espacos_magia[c]?.usados || 0), 0);
  if (usadosAntes <= 0) return 0;

  if (!parcial) {
    chaves.forEach(c => { char.espacos_magia[c].usados = 0; });
    return usadosAntes;
  }

  const totalMax = chaves.reduce((acc, c) => acc + (char.espacos_magia[c]?.total || 0), 0);
  let recuperar = Math.ceil(totalMax / 2);
  if ((char.nivel || 1) >= 20) recuperar = totalMax;
  recuperar = Math.min(recuperar, usadosAntes);

  let restante = recuperar;
  for (const c of chaves.sort((a, b) => Number(b) - Number(a))) {
    if (restante <= 0) break;
    const usados = char.espacos_magia[c]?.usados || 0;
    if (usados <= 0) continue;
    const reduz = Math.min(usados, restante);
    char.espacos_magia[c].usados -= reduz;
    restante -= reduz;
  }

  return recuperar - restante;
}

function extrairOpcoesInvocacoesBruxo() {
  if (char?.classe !== 'Bruxo') return [];
  const texto = classeData?.texto_completo || '';
  const marcadorInicio = '## Opções de Invocações Místicas';
  const inicio = texto.indexOf(marcadorInicio);
  if (inicio < 0) return [];

  let secao = texto.slice(inicio + marcadorInicio.length);
  const fim = secao.indexOf('## Lista de Magias de Bruxo');
  if (fim >= 0) secao = secao.slice(0, fim);

  const opcoes = [];
  const regex = /###\s+([^\n]+)\n([\s\S]*?)(?=\n###\s+|$)/g;
  let match;
  while ((match = regex.exec(secao)) !== null) {
    const nome = (match[1] || '').trim();
    const corpo = match[2] || '';
    const prereqMatch = corpo.match(/\*Pré-requisitos?:\s*([^*]+)\*/i);
    const prerequisito = prereqMatch ? prereqMatch[1].trim() : '';
    const repetivel = /\*\*Repetível\.\*\*/i.test(corpo) || /Repetível\./i.test(corpo);
    // Extrair descricao limpa (sem linha de pre-requisito e sem marcador de repetivel)
    let descricao = corpo
      .replace(/\*Pré-requisitos?:\s*[^*]+\*/gi, '')
      .replace(/\*\*Repetível\.\*\*/gi, '')
      .replace(/Repetível\./gi, '')
      .replace(/^\s*\n/gm, '')
      .trim();
    if (nome) opcoes.push({ nome, prerequisito, repetivel, descricao });
  }

  return opcoes;
}

// Função legada removida - usar avaliarPrerequisitoInvocacaoBruxoComSel()

// Obtém magias disponíveis do Bruxo por círculo para Arcana Mística
async function obterMagiasArcanumPorCirculo(circulo) {
  const magiasClasseData = await getMagiasClasse('Bruxo');
  const todas = achatarMagiasClasse(magiasClasseData);
  return todas.filter(m => m.circulo === circulo).sort((a, b) => a.nome.localeCompare(b.nome));
}

async function abrirModalRecursosBruxo() {
  if (char?.classe !== 'Bruxo') return;
  const estado = getEstadoRecursosBruxo();
  const opcoes = extrairOpcoesInvocacoesBruxo();
  const nivel = char.nivel || 1;

  // Separar pactos das demais invocações
  const PACTOS = ['Pacto da Corrente', 'Pacto da Lâmina', 'Pacto do Tomo'];
  const invPactos = opcoes.filter(o => PACTOS.includes(o.nome));
  const invNormais = opcoes.filter(o => !PACTOS.includes(o.nome));

  // Estado atual: invocações selecionadas (incluindo pacto) — array para suportar repetíveis
  const invSelecionadas = [...estado.invocacoes];

  // Carregar magias para Arcana Mística (assíncrono)
  const magiasArcanum = {};
  for (const c of [6, 7, 8, 9]) {
    if (estado.circulosArcanum.includes(c)) {
      magiasArcanum[c] = await obterMagiasArcanumPorCirculo(c);
    }
  }

  // Funcao auxiliar para extrair nivel de pre-requisito
  function nivelPrereqInv(o) {
    const m = o.prerequisito.match(/N[ií]vel\s*(\d+)/i);
    return m ? parseInt(m[1]) : 0;
  }

  // Agrupar invocacoes por categoria de nivel
  const grupos = [
    { label: 'Pacto (Invocacao de Nivel 1)', items: invPactos },
    { label: 'Sem pre-requisito de nivel', items: invNormais.filter(o => nivelPrereqInv(o) === 0) },
    { label: 'Nivel 2+', items: invNormais.filter(o => { const n = nivelPrereqInv(o); return n >= 2 && n < 5; }) },
    { label: 'Nivel 5+', items: invNormais.filter(o => { const n = nivelPrereqInv(o); return n >= 5 && n < 7; }) },
    { label: 'Nivel 7+', items: invNormais.filter(o => { const n = nivelPrereqInv(o); return n >= 7 && n < 9; }) },
    { label: 'Nivel 9+', items: invNormais.filter(o => { const n = nivelPrereqInv(o); return n >= 9 && n < 12; }) },
    { label: 'Nivel 12+', items: invNormais.filter(o => { const n = nivelPrereqInv(o); return n >= 12 && n < 15; }) },
    { label: 'Nivel 15+', items: invNormais.filter(o => nivelPrereqInv(o) >= 15) }
  ].filter(g => g.items.length > 0);

  // Contar ocorrencias de cada invocacao no array de objetos {nome, truque?}
  function contarInv(arr, nome) { return arr.filter(o => o.nome === nome).length; }
  // Extrair apenas nomes para validacao de pre-requisitos
  function nomesDoArr(arr) { return arr.map(o => o.nome); }

  // Invocacoes que requerem selecao de parametro extra (truque ou talento)
  // tipo: 'truque' ou 'talento' -> determina qual campo salvar no objeto e qual lista exibir
  const INV_PARAMETRO = {
    'Explosão Agonizante': { tipo: 'truque', campo: 'truque', desc: 'Truque de dano: +modificador de Carisma ao dano', placeholder: '-- Escolha um truque --' },
    'Explosão Repulsiva': { tipo: 'truque', campo: 'truque', desc: 'Truque com rolagem de ataque: empurra alvo 3m', placeholder: '-- Escolha um truque --' },
    'Lança Mística': { tipo: 'truque', campo: 'truque', desc: 'Truque de dano (alcance 3m+): aumenta alcance', placeholder: '-- Escolha um truque --' },
    'Lições dos Grandes Antigos': { tipo: 'talento', campo: 'talento', desc: 'Escolha um Talento de Origem', placeholder: '-- Escolha um talento --' }
  };

  // Talentos de Origem carregados do JSON (cache local)
  let talentosOrigemCache = null;
  async function obterTalentosOrigem() {
    if (talentosOrigemCache) return talentosOrigemCache;
    try {
      const data = await getTalentos();
      talentosOrigemCache = (data?.por_categoria?.['de Origem'] || []).map(t => t.nome).sort();
    } catch (e) {
      talentosOrigemCache = [];
    }
    return talentosOrigemCache;
  }

  // Obter truques conhecidos do personagem
  function obterTruquesParaSelecao() {
    const truques = (char.magias_conhecidas || []).filter(m => m.circulo === 0);
    return truques.map(m => m.nome).sort();
  }

  // Obter opcoes para o parametro de uma invocacao
  // Para talentos, filtra os ja escolhidos em outras instancias
  function obterOpcoesParametro(nomeInv, invArr, idxAtual) {
    const config = INV_PARAMETRO[nomeInv];
    if (!config) return [];
    if (config.tipo === 'truque') return obterTruquesParaSelecao();
    if (config.tipo === 'talento') {
      const lista = talentosOrigemCache || [];
      // Filtrar talentos ja escolhidos em OUTRAS instancias desta invocacao
      const jaEscolhidos = new Set();
      let count = 0;
      for (const inv of invArr) {
        if (inv.nome === nomeInv) {
          if (count !== idxAtual && inv.talento) jaEscolhidos.add(inv.talento);
          count++;
        }
      }
      return lista.filter(t => !jaEscolhidos.has(t));
    }
    return [];
  }

  function renderCard(o, invArr) {
    const qtd = contarInv(invArr, o.nome);
    const sel = qtd > 0;
    const validacao = avaliarPrerequisitoInvocacaoBruxoComSel(o.prerequisito, new Set(nomesDoArr(invArr)));
    const bloqueado = !validacao.ok && !sel;
    const ehPacto = PACTOS.includes(o.nome);
    const configParam = INV_PARAMETRO[o.nome] || null;
    // Pre-requisito resumido
    let preResumo = '';
    if (o.prerequisito && !ehPacto) {
      preResumo = o.prerequisito.replace(/Bruxo\s*/gi, '').replace(/ou superior/gi, '+');
    }
    // Seletor de parametro para invocacoes que requerem escolha (truque ou talento)
    let paramHtml = '';
    if (configParam && sel) {
      const instancias = invArr.filter(i => i.nome === o.nome);
      paramHtml = instancias.map((inst, idx) => {
        const selVal = inst[configParam.campo] || '';
        const opcoesDisp = obterOpcoesParametro(o.nome, invArr, idx);
        return `
          <div style="margin-top:4px;padding-top:4px;border-top:1px dashed var(--border-light)" data-inv-param-wrapper="${o.nome}" data-inv-param-idx="${idx}">
            <label style="font-size:0.6rem;color:var(--text-muted);display:block">${configParam.desc}${qtd > 1 ? ` (#${idx+1})` : ''}</label>
            <select class="form-select" style="font-size:0.7rem;padding:2px 4px;margin-top:2px" data-inv-param-sel="${o.nome}" data-inv-param-selidx="${idx}" data-inv-param-campo="${configParam.campo}">
              <option value="">${configParam.placeholder}</option>
              ${opcoesDisp.map(t => `<option value="${t}" ${selVal === t ? 'selected' : ''}>${t}</option>`).join('')}
            </select>
          </div>`;
      }).join('');
    }
    // Descricao formatada (exibida ao clicar no nome)
    const descHtml = mdParaHtml(o.descricao || 'Sem descricao disponivel.');
    return `
      <div class="magia-card ${sel ? 'selecionada' : ''} ${bloqueado ? 'magia-card-bloqueada' : ''} ${ehPacto ? 'magia-dominio' : ''}"
           data-inv-card="${o.nome}" style="${bloqueado ? 'opacity:0.35;cursor:not-allowed;' : ''};position:relative">
        <div style="display:flex;align-items:center;gap:6px">
          <span class="magia-card-check" data-inv-toggle="${o.nome}" style="cursor:pointer;flex-shrink:0"></span>
          <div style="flex:1;min-width:0">
            <div class="magia-card-nome" data-inv-info="${o.nome}" style="cursor:pointer">${ehPacto ? '<span class="badge-dominio">&#9733;</span> ' : ''}${o.nome}${qtd > 1 ? ` <span class="badge" style="font-size:0.6rem;background:var(--accent);color:#fff">x${qtd}</span>` : ''}</div>
            <div class="magia-card-meta">
              ${preResumo ? `<span style="font-size:0.65rem">${preResumo}</span>` : ''}
              ${o.repetivel ? '<span style="font-size:0.65rem;color:var(--accent)">Repetivel</span>' : ''}
            </div>
          </div>
        </div>
        ${paramHtml}
        <div class="inv-desc-inline" data-inv-desc="${o.nome}" style="display:none;margin-top:6px;padding:6px 8px;border-top:1px solid var(--border-light);font-size:0.75rem;color:var(--text-muted)">
          ${o.prerequisito ? `<div style="font-size:0.7rem;color:var(--secondary);font-weight:600;margin-bottom:4px">${o.prerequisito}</div>` : ''}
          <div class="md-content">${descHtml}</div>
        </div>
      </div>`;
  }

  function buildInvocacoesHtml(invArr) {
    let html = '';
    html += `<div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:8px">
      Selecionadas: <strong>${invArr.length}</strong> / ${estado.invocacoesMax}
      ${invArr.length > estado.invocacoesMax ? '<span style="color:var(--danger)"> (excedido!)</span>' : ''}
    </div>`;
    for (const grupo of grupos) {
      html += `<div style="font-size:0.75rem;font-weight:700;color:var(--secondary);margin:10px 0 4px">${grupo.label}</div>`;
      html += `<div class="magias-grid">${grupo.items.map(o => renderCard(o, invArr)).join('')}</div>`;
    }
    return html;
  }

  // Arcana Mística HTML
  let arcanumHtml = '';
  if (estado.circulosArcanum.length > 0 || nivel >= 11) {
    arcanumHtml += '<div class="section-divider"><span>Arcana Mística</span></div>';
    for (const c of [6, 7, 8, 9]) {
      const desbloqueado = estado.circulosArcanum.includes(c);
      const dado = estado.arcanum[c] || { magia: '', usado: false };
      const magias = magiasArcanum[c] || [];
      arcanumHtml += `
        <div class="form-group" style="opacity:${desbloqueado ? 1 : 0.5}">
          <label class="form-label">${c}º Círculo ${desbloqueado ? '' : '(Bloqueado)'}</label>
          ${desbloqueado ? `
            <select class="form-select" id="bruxo-arcanum-${c}">
              <option value="">-- Selecione uma magia --</option>
              ${magias.map(m => `<option value="${m.nome}" ${dado.magia === m.nome ? 'selected' : ''}>${m.nome}</option>`).join('')}
            </select>
          ` : `
            <select class="form-select" disabled>
              <option value="">Desbloqueado no nível ${c === 6 ? 11 : c === 7 ? 13 : c === 8 ? 15 : 17}</option>
            </select>
          `}
        </div>`;
    }
  }

  abrirModal('Recursos do Bruxo', `
    <div class="section-divider"><span>Invocaçoes Misticas</span></div>
    <div class="search-box" style="margin-bottom:8px"><input type="text" id="busca-inv-bruxo" placeholder="Buscar invocacao..." class="form-input"></div>
    <div id="bruxo-inv-grid" style="max-height:55vh;overflow-y:auto"></div>
    ${arcanumHtml}
  `,
  '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-primary" id="btn-salvar-bruxo-recursos">Salvar</button>');

  // Estado mutável das selecionadas (array para repetíveis)
  const gridEl = document.getElementById('bruxo-inv-grid');

  function renderGrid() {
    const termo = semAcento(document.getElementById('busca-inv-bruxo')?.value || '');
    if (termo.length >= 2) {
      const gruposFiltrados = grupos.map(g => ({
        ...g,
        items: g.items.filter(o => semAcento(o.nome).includes(termo))
      })).filter(g => g.items.length > 0);
      let html = `<div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:8px">
        Selecionadas: <strong>${invSelecionadas.length}</strong> / ${estado.invocacoesMax}
      </div>`;
      for (const grupo of gruposFiltrados) {
        html += `<div style="font-size:0.75rem;font-weight:700;color:var(--secondary);margin:10px 0 4px">${grupo.label}</div>`;
        html += `<div class="magias-grid">${grupo.items.map(o => renderCard(o, invSelecionadas)).join('')}</div>`;
      }
      gridEl.innerHTML = html;
    } else {
      gridEl.innerHTML = buildInvocacoesHtml(invSelecionadas);
    }
    attachInvToggleListeners();
  }

  function attachInvToggleListeners() {
    // Toggle de selecao ao clicar no checkbox
    gridEl.querySelectorAll('[data-inv-toggle]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const nome = el.dataset.invToggle;
        const opcao = opcoes.find(o => o.nome === nome);
        if (!opcao) return;

        const qtdAtual = contarInv(invSelecionadas, nome);
        if (qtdAtual > 0) {
          // Desselecionar (remover uma ocorrencia)
          const idx = invSelecionadas.findIndex(o => o.nome === nome);
          if (idx >= 0) invSelecionadas.splice(idx, 1);
        } else {
          // Validar pre-requisito
          const validacao = avaliarPrerequisitoInvocacaoBruxoComSel(opcao.prerequisito, new Set(nomesDoArr(invSelecionadas)));
          if (!validacao.ok) {
            toast(`Pre-requisito nao atendido: ${validacao.motivo}`, 'error');
            return;
          }
          if (invSelecionadas.length >= estado.invocacoesMax) {
            toast(`Limite de ${estado.invocacoesMax} invocacoes atingido.`, 'error');
            return;
          }
          // Se e pacto, remover outro pacto selecionado
          if (PACTOS.includes(nome)) {
            PACTOS.forEach(p => {
              const idx = invSelecionadas.findIndex(o => o.nome === p);
              if (idx >= 0) invSelecionadas.splice(idx, 1);
            });
          }
          invSelecionadas.push({ nome });
        }
        renderGrid();
      });
    });

    // Para repetiveis: adicionar botao +1 ao card
    gridEl.querySelectorAll('[data-inv-card]').forEach(el => {
      const nome = el.dataset.invCard;
      const opcao = opcoes.find(o => o.nome === nome);
      if (!opcao?.repetivel) return;
      const qtd = contarInv(invSelecionadas, nome);
      if (qtd >= 1) {
        const metaDiv = el.querySelector('.magia-card-meta');
        if (metaDiv) {
          const addBtn = document.createElement('span');
          addBtn.style.cssText = 'font-size:0.7rem;cursor:pointer;padding:1px 6px;border:1px solid var(--accent);border-radius:4px;color:var(--accent);margin-left:4px';
          addBtn.textContent = '+1';
          addBtn.title = 'Adicionar outra ocorrência (Repetível)';
          addBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (invSelecionadas.length >= estado.invocacoesMax) {
              toast(`Limite de ${estado.invocacoesMax} invocacoes atingido.`, 'error');
              return;
            }
            invSelecionadas.push({ nome });
            renderGrid();
          });
          metaDiv.appendChild(addBtn);
        }
      }
    });

    // Clicar no nome da invocacao mostra/oculta descricao inline
    gridEl.querySelectorAll('[data-inv-info]').forEach(nomeEl => {
      nomeEl.addEventListener('click', (e) => {
        e.stopPropagation();
        const nome = nomeEl.dataset.invInfo;
        const card = nomeEl.closest('[data-inv-card]');
        if (!card) return;
        const descEl = card.querySelector(`[data-inv-desc="${nome}"]`);
        if (!descEl) return;
        // Ocultar outras descricoes abertas
        gridEl.querySelectorAll('.inv-desc-inline').forEach(d => {
          if (d !== descEl) d.style.display = 'none';
        });
        // Toggle da descricao clicada
        descEl.style.display = descEl.style.display === 'none' ? 'block' : 'none';
      });
    });

    // Listeners dos selects de parametro (truque ou talento)
    gridEl.querySelectorAll('[data-inv-param-sel]').forEach(sel => {
      sel.addEventListener('click', (e) => e.stopPropagation());
      sel.addEventListener('change', (e) => {
        e.stopPropagation();
        const nome = sel.dataset.invParamSel;
        const idx = parseInt(sel.dataset.invParamSelidx);
        const campo = sel.dataset.invParamCampo;
        let count = 0;
        for (let i = 0; i < invSelecionadas.length; i++) {
          if (invSelecionadas[i].nome === nome) {
            if (count === idx) {
              const novoObj = { ...invSelecionadas[i] };
              if (sel.value) { novoObj[campo] = sel.value; }
              else { delete novoObj[campo]; }
              invSelecionadas[i] = novoObj;
              if (campo === 'talento') renderGrid();
              break;
            }
            count++;
          }
        }
      });
    });
  }

  // Pre-carregar talentos de origem (para Licoes dos Grandes Antigos)
  await obterTalentosOrigem();

  renderGrid();

  // Busca
  document.getElementById('busca-inv-bruxo')?.addEventListener('input', () => renderGrid());

  // Salvar
  document.getElementById('btn-salvar-bruxo-recursos')?.addEventListener('click', () => {
    const invFinais = invSelecionadas.map(o => ({...o}));

    // Determinar pacto a partir das invocacoes selecionadas
    const pactoSelecionado = PACTOS.find(p => invSelecionadas.some(o => o.nome === p)) || '';

    char.recursos.bruxo.pacto = pactoSelecionado;
    char.recursos.bruxo.invocacoes = invFinais;

    // Salvar Arcana Mística
    [6, 7, 8, 9].forEach(c => {
      const desbloqueado = estado.circulosArcanum.includes(c);
      if (!desbloqueado) {
        char.recursos.bruxo.arcanum[c] = { magia: '', usado: false };
      } else {
        const magia = (document.getElementById(`bruxo-arcanum-${c}`)?.value || '').trim();
        const usadoAntes = !!char.recursos.bruxo.arcanum[c]?.usado;
        char.recursos.bruxo.arcanum[c] = { magia, usado: usadoAntes };
      }
    });

    salvar();
    window.fecharModal();
    renderFichaCompleta();
  });
}

// Modal para gerenciar truques e rituais do Pacto do Tomo
function abrirModalPactoDoTomo() {
  if (char?.classe !== 'Bruxo') return;
  const estado = getEstadoRecursosBruxo();
  if (!estado || estado.pacto !== 'Pacto do Tomo') return;

  const tomoData = estado.pactoTomo || { truques: [], rituais: [] };
  const truquesSel = [...tomoData.truques]; // [{nome, classe}]
  const rituaisSel = [...tomoData.rituais]; // [{nome, classe}]

  // Filtrar truques de TODAS as classes que o personagem ainda nao tem preparados
  const truquesJaPreparados = new Set((char.magias_conhecidas || []).filter(m => m.circulo === 0).map(m => m.nome));
  const todosTruquesIndice = indiceMagiasCache.filter(m => m.circulo === 0);
  // Filtrar rituais de 1o circulo de TODAS as classes (magias com "Ritual" no tempo_conjuracao e que o personagem nao tem)
  const jaPreparados = new Set((char.magias_preparadas || []).map(m => m.nome));
  const todosRituais1 = indiceMagiasCache.filter(m =>
    m.circulo === 1 &&
    m.tempo_conjuracao && /ritual/i.test(m.tempo_conjuracao)
  );

  // Listar todas as classes disponveis nos truques/rituais
  const classesComTruques = [...new Set(todosTruquesIndice.flatMap(m => m.classes || []))].sort();
  const classesComRituais = [...new Set(todosRituais1.flatMap(m => m.classes || []))].sort();

  function renderTruquesGrid(filtroClasse) {
    let itens = todosTruquesIndice;
    if (filtroClasse) itens = itens.filter(m => (m.classes || []).includes(filtroClasse));
    return itens.sort((a, b) => a.nome.localeCompare(b.nome)).map(m => {
      const sel = truquesSel.find(t => t.nome === m.nome);
      const jaTem = truquesJaPreparados.has(m.nome) && !sel;
      const cheio = truquesSel.length >= 3 && !sel;
      return `
        <div class="magia-card ${sel ? 'selecionada' : ''} ${cheio || jaTem ? 'magia-card-bloqueada' : ''}"
             data-tomo-truque="${m.nome}" data-tomo-truque-classes="${(m.classes || []).join(',')}"
             style="${cheio || jaTem ? 'opacity:0.35;cursor:not-allowed;' : 'cursor:pointer;'}">
          <span class="magia-card-check"></span>
          <div class="magia-card-nome" style="font-size:0.75rem">${m.nome}</div>
          <div class="magia-card-meta"><span style="font-size:0.6rem">${(m.classes || []).join(', ')}</span></div>
        </div>`;
    }).join('');
  }

  function renderRituaisGrid(filtroClasse) {
    let itens = todosRituais1;
    if (filtroClasse) itens = itens.filter(m => (m.classes || []).includes(filtroClasse));
    return itens.sort((a, b) => a.nome.localeCompare(b.nome)).map(m => {
      const sel = rituaisSel.find(r => r.nome === m.nome);
      const jaTem = jaPreparados.has(m.nome) && !sel;
      const cheio = rituaisSel.length >= 2 && !sel;
      return `
        <div class="magia-card ${sel ? 'selecionada' : ''} ${cheio || jaTem ? 'magia-card-bloqueada' : ''}"
             data-tomo-ritual="${m.nome}" data-tomo-ritual-classes="${(m.classes || []).join(',')}"
             style="${cheio || jaTem ? 'opacity:0.35;cursor:not-allowed;' : 'cursor:pointer;'}">
          <span class="magia-card-check"></span>
          <div class="magia-card-nome" style="font-size:0.75rem">${m.nome}</div>
          <div class="magia-card-meta"><span style="font-size:0.6rem">${(m.classes || []).join(', ')} | Ritual</span></div>
        </div>`;
    }).join('');
  }

  function renderConteudo() {
    const filtroTruque = document.getElementById('tomo-filtro-classe-truque')?.value || '';
    const filtroRitual = document.getElementById('tomo-filtro-classe-ritual')?.value || '';
    return `
      <div class="section-divider"><span>Truques do Livro das Sombras (${truquesSel.length}/3)</span></div>
      <div style="margin-bottom:6px">
        <select class="form-select" id="tomo-filtro-classe-truque" style="font-size:0.75rem;padding:3px 6px">
          <option value="">Todas as classes</option>
          ${classesComTruques.map(c => `<option value="${c}" ${filtroTruque === c ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
      </div>
      <div class="magias-grid" id="tomo-truques-grid" style="max-height:25vh;overflow-y:auto">${renderTruquesGrid(filtroTruque)}</div>

      <div class="section-divider"><span>Rituais de 1o Circulo (${rituaisSel.length}/2)</span></div>
      <div style="margin-bottom:6px">
        <select class="form-select" id="tomo-filtro-classe-ritual" style="font-size:0.75rem;padding:3px 6px">
          <option value="">Todas as classes</option>
          ${classesComRituais.map(c => `<option value="${c}" ${filtroRitual === c ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
      </div>
      <div class="magias-grid" id="tomo-rituais-grid" style="max-height:25vh;overflow-y:auto">${renderRituaisGrid(filtroRitual)}</div>
    `;
  }

  abrirModal('Livro das Sombras - Pacto do Tomo', `<div id="tomo-conteudo">${renderConteudo()}</div>`,
    '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-primary" id="btn-salvar-tomo">Salvar</button>');

  function attachTomoListeners() {
    // Filtros
    document.getElementById('tomo-filtro-classe-truque')?.addEventListener('change', () => {
      document.getElementById('tomo-conteudo').innerHTML = renderConteudo();
      attachTomoListeners();
    });
    document.getElementById('tomo-filtro-classe-ritual')?.addEventListener('change', () => {
      document.getElementById('tomo-conteudo').innerHTML = renderConteudo();
      attachTomoListeners();
    });

    // Toggle truques
    document.querySelectorAll('[data-tomo-truque]').forEach(el => {
      el.addEventListener('click', () => {
        const nome = el.dataset.tomoTruque;
        const classes = el.dataset.tomoTruqueClasses || '';
        const idx = truquesSel.findIndex(t => t.nome === nome);
        if (idx >= 0) {
          truquesSel.splice(idx, 1);
        } else {
          if (truquesSel.length >= 3) {
            toast('Limite de 3 truques do Livro das Sombras atingido.', 'error');
            return;
          }
          truquesSel.push({ nome, classe: classes.split(',')[0] || '' });
        }
        document.getElementById('tomo-conteudo').innerHTML = renderConteudo();
        attachTomoListeners();
      });
    });

    // Toggle rituais
    document.querySelectorAll('[data-tomo-ritual]').forEach(el => {
      el.addEventListener('click', () => {
        const nome = el.dataset.tomoRitual;
        const classes = el.dataset.tomoRitualClasses || '';
        const idx = rituaisSel.findIndex(r => r.nome === nome);
        if (idx >= 0) {
          rituaisSel.splice(idx, 1);
        } else {
          if (rituaisSel.length >= 2) {
            toast('Limite de 2 rituais do Livro das Sombras atingido.', 'error');
            return;
          }
          rituaisSel.push({ nome, classe: classes.split(',')[0] || '' });
        }
        document.getElementById('tomo-conteudo').innerHTML = renderConteudo();
        attachTomoListeners();
      });
    });
  }

  attachTomoListeners();

  document.getElementById('btn-salvar-tomo')?.addEventListener('click', () => {
    char.recursos.bruxo.pacto_tomo = {
      truques: [...truquesSel],
      rituais: [...rituaisSel]
    };
    salvar();
    window.fecharModal();
    renderFichaCompleta();
  });
}

// Avalia pré-requisito considerando pacto derivado do selSet (não do char salvo)
function avaliarPrerequisitoInvocacaoBruxoComSel(prerequisito, selSet) {
  if (!prerequisito) return { ok: true, motivo: '' };
  let ok = true;
  const motivos = [];
  const texto = prerequisito;

  const nivelMatch = texto.match(/Bruxo\s*N[ií]vel\s*(\d+)/i);
  if (nivelMatch) {
    const nivelMin = parseInt(nivelMatch[1]);
    if ((char?.nivel || 1) < nivelMin) {
      ok = false;
      motivos.push(`requer nível ${nivelMin}`);
    }
  }

  // Inferir pacto a partir das invocações selecionadas
  const PACTOS = ['Pacto da Corrente', 'Pacto da Lâmina', 'Pacto do Tomo'];
  const pacto = PACTOS.find(p => selSet.has(p)) || '';
  if (/Pacto da Lâmina/i.test(texto) && pacto !== 'Pacto da Lâmina') {
    ok = false;
    motivos.push('requer Pacto da Lâmina');
  }
  if (/Pacto da Corrente/i.test(texto) && pacto !== 'Pacto da Corrente') {
    ok = false;
    motivos.push('requer Pacto da Corrente');
  }
  if (/Pacto do Tomo/i.test(texto) && pacto !== 'Pacto do Tomo') {
    ok = false;
    motivos.push('requer Pacto do Tomo');
  }

  // Invocações que requerem outra invocação (ex: Lâmina Devoradora requer Lâmina Sedenta)
  if (/Lâmina Sedenta/i.test(texto) && !selSet.has('Lâmina Sedenta')) {
    ok = false;
    motivos.push('requer Lâmina Sedenta');
  }

  return { ok, motivo: motivos.join(', ') };
}

// ============================================================
// Progressão e recursos do Paladino
// ============================================================
function getProgressaoPaladino() {
  if (char?.classe !== 'Paladino' || !classeData?.tabela_caracteristicas) return null;
  const row = classeData.tabela_caracteristicas.find(r => parseInt(r['Nível']) === (char.nivel || 1));
  if (!row) return null;
  const cdStr = String(row['Canalizar Divindade'] || '—');
  const canalizarMax = parseInt(cdStr) || 0;
  return { canalizarMax };
}

function getEstadoRecursosPaladino() {
  if (char?.classe !== 'Paladino') return null;
  if (!char.recursos) char.recursos = {};
  if (!char.recursos.paladino) {
    char.recursos.paladino = {
      maos_consagradas_gastos: 0,
      canalizar_divindade_usos_gastos: 0,
      destruicao_gratuita_usada: false
    };
  }

  const r = char.recursos.paladino;
  if (typeof r.maos_consagradas_gastos !== 'number') r.maos_consagradas_gastos = 0;
  if (typeof r.canalizar_divindade_usos_gastos !== 'number') r.canalizar_divindade_usos_gastos = 0;
  if (typeof r.destruicao_gratuita_usada !== 'boolean') r.destruicao_gratuita_usada = false;

  const nivel = char.nivel || 1;
  const prog = getProgressaoPaladino() || { canalizarMax: 0 };

  // Mãos Consagradas: reserva = 5 × nível
  const maosMax = 5 * nivel;
  const maosAtuais = Math.max(0, maosMax - r.maos_consagradas_gastos);

  // Canalizar Divindade (nível 3+)
  const canalizarMax = prog.canalizarMax;
  const canalizarDisponiveis = Math.max(0, canalizarMax - r.canalizar_divindade_usos_gastos);

  // Destruição gratuita (nível 2+, 1x/descanso longo)
  const destruicaoGratuitaAtiva = nivel >= 2;

  // Aura de Proteção (nível 6+)
  const modCar = Math.max(1, calcMod(char.atributos.carisma));
  const auraProtecaoAtiva = nivel >= 6;
  const auraRaio = nivel >= 18 ? 9 : 3;

  // Aura de Coragem (nível 10+)
  const auraCoragemAtiva = nivel >= 10;

  // Aura de Devoção (Juramento da Devoção, nível 7+)
  const auraDevocaoAtiva = char.subclasse === 'Juramento da Devoção' && nivel >= 7;

  // Golpes Radiantes (nível 11+)
  const golpesRadiantesAtivo = nivel >= 11;

  // Toque Restaurador (nível 14+)
  const toqueRestauradorAtivo = nivel >= 14;

  return {
    nivel,
    maosMax,
    maosAtuais,
    maosGastos: r.maos_consagradas_gastos,
    canalizarMax,
    canalizarDisponiveis,
    canalizarGastos: r.canalizar_divindade_usos_gastos,
    destruicaoGratuitaAtiva,
    destruicaoGratuitaUsada: r.destruicao_gratuita_usada,
    auraProtecaoAtiva,
    auraRaio,
    bonusAura: modCar,
    auraCoragemAtiva,
    auraDevocaoAtiva,
    golpesRadiantesAtivo,
    toqueRestauradorAtivo
  };
}

// ============================================================
// Progressão e recursos do Monge
// ============================================================
function getProgressaoMonge() {
  if (char?.classe !== 'Monge' || !classeData?.tabela_caracteristicas) return null;
  const row = classeData.tabela_caracteristicas.find(r => parseInt(r['Nível']) === (char.nivel || 1));
  if (!row) return null;
  const dadoStr = String(row['Artes Marciais'] || '1d6');
  const dado = parseInt(dadoStr.replace(/[^\d]/g, '')) || 6;
  const pontos = parseInt(row['Pontos de Foco']) || 0;
  const movTexto = String(row['Movimento sem Armadura'] || '—');
  const movMatch = movTexto.match(/[\+]?\s*(\d+(?:[\.,]\d+)?)/);
  const bonusMovimento = movMatch ? parseFloat(movMatch[1].replace(',', '.')) : 0;
  return { dado, pontosMax: pontos, bonusMovimento };
}

function getEstadoRecursosMonge() {
  if (char?.classe !== 'Monge') return null;
  if (!char.recursos) char.recursos = {};
  if (!char.recursos.monge) {
    char.recursos.monge = {
      pontos_foco_gastos: 0,
      metabolismo_usado: false
    };
  }

  const r = char.recursos.monge;
  if (typeof r.pontos_foco_gastos !== 'number') r.pontos_foco_gastos = 0;
  if (typeof r.metabolismo_usado !== 'boolean') r.metabolismo_usado = false;

  const nivel = char.nivel || 1;
  const prog = getProgressaoMonge() || { dado: 6, pontosMax: 0, bonusMovimento: 0 };

  const pontosMax = prog.pontosMax;
  const pontosAtuais = Math.max(0, pontosMax - r.pontos_foco_gastos);

  // CD de Foco: 8 + prof + mod Sabedoria
  const cdFoco = 8 + bonusProficiencia(nivel) + calcMod(char.atributos.sabedoria);

  // Desviar Ataques (nível 3+): 1d10 + mod Des + nível
  const desviarAtivo = nivel >= 3;
  const desviarReducao = `1d10 + ${calcMod(char.atributos.destreza)} + ${nivel}`;

  // Queda Lenta (nível 4+): reduz 5 × nível
  const quedaLentaAtiva = nivel >= 4;
  const quedaReducao = 5 * nivel;

  // Golpe Atordoante (nível 5+)
  const golpeAtordoanteAtivo = nivel >= 5;

  // Evasão (nível 7+)
  const evasaoAtiva = nivel >= 7;

  // Sobrevivente Disciplinado (nível 14+)
  const sobreviventeAtivo = nivel >= 14;

  // Defesa Superior (nível 18+)
  const defesaSuperiorAtiva = nivel >= 18;

  // Subclasses de Monge
  if (!r.subclasses) r.subclasses = {};
  const sub = char.subclasse || '';
  const sabMod = calcMod(char.atributos.sabedoria);
  let subData = {};

  if (sub === 'Combatente da Mão Espalmada') {
    if (!r.subclasses.mao_espalmada) r.subclasses.mao_espalmada = {};
    const s = r.subclasses.mao_espalmada;
    if (typeof s.integridade_usos_gastos !== 'number') s.integridade_usos_gastos = 0;
    if (typeof s.palma_vibrante_ativa !== 'boolean') s.palma_vibrante_ativa = false;
    const integridadeMax = Math.max(1, sabMod);
    subData = {
      integridadeMax,
      integridadeDisponiveis: integridadeMax - s.integridade_usos_gastos,
      integridadeAtiva: nivel >= 6,
      palmaVibranteAtiva: s.palma_vibrante_ativa,
      palmaVibranteNivel: nivel >= 17
    };
  }

  if (sub === 'Combatente da Misericórdia') {
    if (!r.subclasses.misericordia) r.subclasses.misericordia = {};
    const s = r.subclasses.misericordia;
    if (typeof s.torrente_usos_gastos !== 'number') s.torrente_usos_gastos = 0;
    if (typeof s.misericordia_final_usada !== 'boolean') s.misericordia_final_usada = false;
    const torrenteMax = Math.max(1, sabMod);
    subData = {
      torrenteMax,
      torrenteDisponiveis: torrenteMax - s.torrente_usos_gastos,
      torrenteAtiva: nivel >= 11,
      misericordiaFinalUsada: s.misericordia_final_usada,
      misericordiaFinalAtiva: nivel >= 17
    };
  }

  if (sub === 'Combatente dos Elementos') {
    if (!r.subclasses.elementos) r.subclasses.elementos = {};
    const s = r.subclasses.elementos;
    if (typeof s.sintonia_ativa !== 'boolean') s.sintonia_ativa = false;
    subData = {
      sintoniaAtiva: s.sintonia_ativa
    };
  }

  return {
    nivel,
    dadoArtesMarciais: prog.dado,
    pontosMax,
    pontosAtuais,
    pontosGastos: r.pontos_foco_gastos,
    cdFoco,
    bonusMovimento: prog.bonusMovimento,
    desviarAtivo,
    desviarReducao,
    quedaLentaAtiva,
    quedaReducao,
    golpeAtordoanteAtivo,
    evasaoAtiva,
    sobreviventeAtivo,
    defesaSuperiorAtiva,
    metabolismoUsado: r.metabolismo_usado,
    ...subData
  };
}

// ============================================================
// Progressão e recursos do Ladino
// ============================================================
function getProgressaoLadino() {
  if (char?.classe !== 'Ladino' || !classeData?.tabela_caracteristicas) return null;
  const row = classeData.tabela_caracteristicas.find(r => parseInt(r['Nível']) === (char.nivel || 1));
  if (!row) return null;
  const furtStr = String(row['Ataque Furtivo'] || '1d6');
  const furtMatch = furtStr.match(/(\d+)d(\d+)/);
  const furtivoDados = furtMatch ? parseInt(furtMatch[1]) : Math.ceil((char.nivel || 1) / 2);
  return { furtivoDados };
}

function getEstadoRecursosLadino() {
  if (char?.classe !== 'Ladino') return null;
  if (!char.recursos) char.recursos = {};
  if (!char.recursos.ladino) {
    char.recursos.ladino = {
      golpe_sorte_usado: false
    };
  }

  // Inicializar recursos de subclasses do Ladino
  if (!char.recursos.ladino.subclasses) {
    char.recursos.ladino.subclasses = {
      adaga_espiritual: {
        dados_psionicos_gastos: 0,
        sussurros_gratis_usado: false,
        veu_psiquico_usado: false,
        rasgar_mente_usado: false
      }
    };
  }
  const subL = char.recursos.ladino.subclasses;
  if (!subL.adaga_espiritual) subL.adaga_espiritual = { dados_psionicos_gastos: 0, sussurros_gratis_usado: false, veu_psiquico_usado: false, rasgar_mente_usado: false };

  const ae = subL.adaga_espiritual;
  if (typeof ae.dados_psionicos_gastos !== 'number') ae.dados_psionicos_gastos = 0;
  if (typeof ae.sussurros_gratis_usado !== 'boolean') ae.sussurros_gratis_usado = false;
  if (typeof ae.veu_psiquico_usado !== 'boolean') ae.veu_psiquico_usado = false;
  if (typeof ae.rasgar_mente_usado !== 'boolean') ae.rasgar_mente_usado = false;

  const r = char.recursos.ladino;
  if (typeof r.golpe_sorte_usado !== 'boolean') r.golpe_sorte_usado = false;

  const nivel = char.nivel || 1;
  const prog = getProgressaoLadino() || { furtivoDados: Math.ceil(nivel / 2) };

  // CD Golpe Astuto: 8 + mod Des + prof
  const cdGolpeAstuto = 8 + calcMod(char.atributos.destreza) + bonusProficiencia(nivel);

  // Ação Ardilosa (nível 2+)
  const acaoArdilosaAtiva = nivel >= 2;

  // Mira Firme (nível 3+)
  const miraFirmeAtiva = nivel >= 3;

  // Golpe Astuto (nível 5+)
  const golpeAstutoAtivo = nivel >= 5;

  // Esquiva Sobrenatural (nível 5+)
  const esquivaSobrenaturalAtiva = nivel >= 5;

  // Evasão (nível 7+)
  const evasaoAtiva = nivel >= 7;

  // Talento Confiável (nível 7+)
  const talentoConfiavelAtivo = nivel >= 7;

  // Golpe Astuto Aprimorado (nível 11+)
  const golpeAprimoradoAtivo = nivel >= 11;

  // Golpes Sujos (nível 14+)
  const golpesSujosAtivo = nivel >= 14;

  // Mente Escorregadia (nível 15+)
  const menteEscorregadiaAtiva = nivel >= 15;

  // Elusivo (nível 18+)
  const elusivoAtivo = nivel >= 18;

  // Golpe de Sorte (nível 20)
  const golpeSorteAtivo = nivel >= 20;

  // --- Adaga Espiritual ---
  const ehAdagaEspiritual = char.subclasse === 'Adaga Espiritual';
  let dadosPsionicosMaxL = 0, tipoDadoPsionicoL = 'd6';
  if (ehAdagaEspiritual && nivel >= 3) {
    if (nivel >= 17) { dadosPsionicosMaxL = 12; tipoDadoPsionicoL = 'd12'; }
    else if (nivel >= 13) { dadosPsionicosMaxL = 10; tipoDadoPsionicoL = 'd10'; }
    else if (nivel >= 11) { dadosPsionicosMaxL = 8; tipoDadoPsionicoL = 'd10'; }
    else if (nivel >= 9) { dadosPsionicosMaxL = 8; tipoDadoPsionicoL = 'd8'; }
    else if (nivel >= 5) { dadosPsionicosMaxL = 6; tipoDadoPsionicoL = 'd8'; }
    else { dadosPsionicosMaxL = 4; tipoDadoPsionicoL = 'd6'; }
  }
  // CD psiônica do Adaga Espiritual: 8 + mod Des + prof
  const cdPsionicaAdaga = ehAdagaEspiritual ? 8 + calcMod(char.atributos?.destreza || 10) + bonusProficiencia(nivel) : 0;
  const laminasAlmaAtivas = ehAdagaEspiritual && nivel >= 9;
  const veuPsiquicoAtivo = ehAdagaEspiritual && nivel >= 13;
  const rasgarMenteAtivo = ehAdagaEspiritual && nivel >= 17;

  return {
    nivel,
    furtivoDados: prog.furtivoDados,
    furtivoTexto: `${prog.furtivoDados}d6`,
    cdGolpeAstuto,
    acaoArdilosaAtiva,
    miraFirmeAtiva,
    golpeAstutoAtivo,
    esquivaSobrenaturalAtiva,
    evasaoAtiva,
    talentoConfiavelAtivo,
    golpeAprimoradoAtivo,
    golpesSujosAtivo,
    menteEscorregadiaAtiva,
    elusivoAtivo,
    golpeSorteAtivo,
    golpeSorteUsado: r.golpe_sorte_usado,
    // Adaga Espiritual
    ehAdagaEspiritual,
    dadosPsionicosMaxL,
    dadosPsionicosDisponiveisL: Math.max(0, dadosPsionicosMaxL - ae.dados_psionicos_gastos),
    dadosPsionicosGastosL: ae.dados_psionicos_gastos,
    tipoDadoPsionicoL,
    cdPsionicaAdaga,
    sussurrosGratisUsado: ae.sussurros_gratis_usado,
    laminasAlmaAtivas,
    veuPsiquicoAtivo,
    veuPsiquicoUsado: ae.veu_psiquico_usado,
    rasgarMenteAtivo,
    rasgarMenteUsado: ae.rasgar_mente_usado,
    subclasses: subL
  };
}

// ============================================================
// Progressão e recursos do Mago
// ============================================================
function getEstadoRecursosMago() {
  if (char?.classe !== 'Mago') return null;
  if (!char.recursos) char.recursos = {};
  if (!char.recursos.mago) {
    char.recursos.mago = {
      recuperacao_arcana_usada: false,
      assinatura_magia_1_usada: false,
      assinatura_magia_2_usada: false
    };
  }

  const r = char.recursos.mago;
  if (typeof r.recuperacao_arcana_usada !== 'boolean') r.recuperacao_arcana_usada = false;
  if (typeof r.assinatura_magia_1_usada !== 'boolean') r.assinatura_magia_1_usada = false;
  if (typeof r.assinatura_magia_2_usada !== 'boolean') r.assinatura_magia_2_usada = false;

  const nivel = char.nivel || 1;

  // Recuperação Arcana: recupera círculos combinados <= metade do nível (arredondado para cima), máx 5º círculo
  const recuperacaoArcanaMax = Math.ceil(nivel / 2);

  // Memorizar Magia (nível 5+)
  const memorizarMagiaAtivo = nivel >= 5;

  // Maestria de Magias (nível 18+)
  const maestriaMagiasAtiva = nivel >= 18;

  // Assinatura Mágica (nível 20): 2 magias de 3º círculo, 1x cada por descanso curto/longo
  const assinaturaMagicaAtiva = nivel >= 20;

  const intMod = Math.floor(((char.atributos?.inteligencia || 10) - 10) / 2);

  // Subclasses de Mago
  if (!r.subclasses) r.subclasses = {};
  const sub = char.subclasse || '';
  let subData = {};

  if (sub === 'Abjurador') {
    if (!r.subclasses.abjurador) r.subclasses.abjurador = {};
    const s = r.subclasses.abjurador;
    if (typeof s.protecao_criada !== 'boolean') s.protecao_criada = false;
    if (typeof s.protecao_pv_atual !== 'number') s.protecao_pv_atual = 0;
    const protecaoMax = (nivel * 2) + intMod;
    subData = {
      protecaoCriada: s.protecao_criada,
      protecaoPvAtual: Math.min(s.protecao_pv_atual, protecaoMax),
      protecaoPvMax: protecaoMax
    };
  }

  if (sub === 'Adivinhador') {
    if (!r.subclasses.adivinhador) r.subclasses.adivinhador = {};
    const s = r.subclasses.adivinhador;
    const numDados = nivel >= 14 ? 3 : 2;
    if (typeof s.prodigio_dado_1 !== 'number') s.prodigio_dado_1 = 0;
    if (typeof s.prodigio_dado_1_usado !== 'boolean') s.prodigio_dado_1_usado = false;
    if (typeof s.prodigio_dado_2 !== 'number') s.prodigio_dado_2 = 0;
    if (typeof s.prodigio_dado_2_usado !== 'boolean') s.prodigio_dado_2_usado = false;
    if (typeof s.prodigio_dado_3 !== 'number') s.prodigio_dado_3 = 0;
    if (typeof s.prodigio_dado_3_usado !== 'boolean') s.prodigio_dado_3_usado = false;
    if (typeof s.terceiro_olho_usado !== 'boolean') s.terceiro_olho_usado = false;
    if (typeof s.terceiro_olho_escolha !== 'string') s.terceiro_olho_escolha = '';
    subData = {
      numDadosProdigio: numDados,
      prodigioDado1: s.prodigio_dado_1,
      prodigioDado1Usado: s.prodigio_dado_1_usado,
      prodigioDado2: s.prodigio_dado_2,
      prodigioDado2Usado: s.prodigio_dado_2_usado,
      prodigioDado3: s.prodigio_dado_3,
      prodigioDado3Usado: s.prodigio_dado_3_usado,
      terceiroOlhoUsado: s.terceiro_olho_usado,
      terceiroOlhoEscolha: s.terceiro_olho_escolha,
      terceiroOlhoAtivo: nivel >= 10
    };
  }

  if (sub === 'Evocador') {
    if (!r.subclasses.evocador) r.subclasses.evocador = {};
    const s = r.subclasses.evocador;
    if (typeof s.sobrecarga_usos !== 'number') s.sobrecarga_usos = 0;
    subData = {
      sobrecargaUsos: s.sobrecarga_usos,
      sobrecargaAtiva: nivel >= 14
    };
  }

  if (sub === 'Ilusionista') {
    if (!r.subclasses.ilusionista) r.subclasses.ilusionista = {};
    const s = r.subclasses.ilusionista;
    if (typeof s.feerica_usada !== 'boolean') s.feerica_usada = false;
    if (typeof s.fera_usada !== 'boolean') s.fera_usada = false;
    if (typeof s.autoimagem_usada !== 'boolean') s.autoimagem_usada = false;
    subData = {
      feericaUsada: s.feerica_usada,
      feraUsada: s.fera_usada,
      autoimagemUsada: s.autoimagem_usada,
      criaturasEspectraisAtiva: nivel >= 6,
      autoimagemAtiva: nivel >= 10
    };
  }

  return {
    nivel,
    intMod,
    recuperacaoArcanaMax,
    recuperacaoArcanaUsada: r.recuperacao_arcana_usada,
    memorizarMagiaAtivo,
    maestriaMagiasAtiva,
    assinaturaMagicaAtiva,
    assinatura1Usada: r.assinatura_magia_1_usada,
    assinatura2Usada: r.assinatura_magia_2_usada,
    ...subData
  };
}

function getDeslocamentoFinal(baseDeslocamento) {
  const texto = String(baseDeslocamento || '9 metros');
  const match = texto.match(/(\d+(?:[\.,]\d+)?)/);
  const base = match ? parseFloat(match[1].replace(',', '.')) : 9;

  let final = base;
  if (char?.classe === 'Bárbaro' && (char?.nivel || 1) >= 5 && !temArmaduraPesadaEquipada()) {
    final += 3;
  }
  if (char?.classe === 'Guardião' && (char?.nivel || 1) >= 6 && !temArmaduraPesadaEquipada()) {
    final += 3;
  }
  // Monge: Movimento sem Armadura (nível 2+, sem armadura e sem escudo)
  if (char?.classe === 'Monge' && (char?.nivel || 1) >= 2) {
    const inv = char?.inventario || [];
    const temArmadura = inv.some(i => i.equipado && i.tipo === 'armadura' && i.nome !== 'Escudo');
    const temEscudo = inv.some(i => i.equipado && (i.nome === 'Escudo' || i.tipo === 'escudo'));
    if (!temArmadura && !temEscudo) {
      const progMonge = getProgressaoMonge();
      if (progMonge) final += progMonge.bonusMovimento;
    }
  }

  // Exaustao: Deslocamento reduzido em 1,5m x nivel de exaustao
  if (char?.exaustao > 0) {
    final -= 1.5 * char.exaustao;
    if (final < 0) final = 0;
  }

  // Efeitos magicos de deslocamento (ex: Passos Largos +3m, Voo 18m)
  const efMag = char?.efeitos_magicos || [];
  const extras = [];
  for (const ef of efMag) {
    if (ef.tipo === 'deslocamento') {
      if (ef.tipo_velocidade === 'base_bonus' && ef.valor_metros) {
        final += ef.valor_metros;
      } else if (ef.tipo_velocidade === 'voo' && ef.valor_metros) {
        extras.push(`Voo ${ef.valor_metros}m`);
      } else if (ef.tipo_velocidade === 'escalada') {
        extras.push(`Escalada ${final}m`);
      } else if (ef.tipo_velocidade === 'levitacao' && ef.valor_metros) {
        extras.push(`Levitação ${ef.valor_metros}m`);
      }
    }
  }

  let resultado = `${String(final).replace('.', ',')} metros`;
  if (extras.length) resultado += ` (${extras.join(', ')})`;
  return resultado;
}

function getAtaquesPorAcao() {
  const nivel = char?.nivel || 1;
  if (char?.classe === 'Guerreiro') {
    if (nivel >= 20) return 4;
    if (nivel >= 11) return 3;
    if (nivel >= 5) return 2;
  }
  if (char?.classe === 'Bárbaro' && nivel >= 5) return 2;
  if (char?.classe === 'Guardião' && nivel >= 5) return 2;
  if (char?.classe === 'Paladino' && nivel >= 5) return 2;
  if (char?.classe === 'Monge' && nivel >= 5) return 2;
  if (char?.classe === 'Bardo' && char?.subclasse === 'Colégio da Bravura' && nivel >= 6) return 2;
  return 1;
}

function getModIniciativa() {
  const base = calcMod(char.atributos.destreza);
  // Bárbaro nível 7+ (Instinto Selvagem) ou Guerreiro/Campeão nível 3+ (Atleta Extraordinário)
  const vantagem = (char?.classe === 'Bárbaro' && (char?.nivel || 1) >= 7)
    || (char?.classe === 'Guerreiro' && char?.subclasse === 'Campeão' && (char?.nivel || 1) >= 3);
  return { valor: base, vantagem };
}

function forcaPrimordialAtiva() {
  return char?.classe === 'Bárbaro' && (char?.nivel || 1) >= 3;
}

function ataqueImprudenteAtivo() {
  return !!char?.recursos?.ataque_imprudente_ativo;
}

export async function renderSheet(container, charId) {
  containerRef = container;
  char = getPersonagem(charId);
  if (!char) {
    container.innerHTML = '<div class="empty-state"><h2>Personagem nao encontrado</h2><button class="btn btn-primary" onclick="navegar(\'home\')">Voltar</button></div>';
    return;
  }

  // Atualizar header
  document.getElementById('header-titulo').textContent = char.nome || 'Ficha';
  document.getElementById('header-acoes').innerHTML = '';

  // Carregar dados complementares
  classeData = await getClasse(char.classe);
  const indiceData = await getIndiceMagias();
  indiceMagiasCache = indiceData?.magias || [];
  talentosCache = await getTalentos();
  especiesCache = await getEspecies();

  // Pré-carregar magias de domínio e migrar dados legados
  magiasDominioCache = await obterTodasMagiasDominio(char.classe, char.subclasse, char.nivel);
  magiasSempreCache = await obterTodasMagiasSemprePreparadas(char.classe, char.subclasse, char.nivel);
  migrarMagiasDominio();
  migrarMagiasSemprePreparadas();
  migrarTruquesEspecie();
  migrarEscolhasClasseLegadas();
  migrarNomePericiaLidarAnimais();
  migrarTalentoVersatilHumano();
  migrarPericiaEspecie();
  migrarPericiasTalentos();
  migrarIniciadoEmMagiaInstancias();
  migrarAdeptoElementalTipos();

  // Inicializar grimório do mago se necessário
  if (char.classe === 'Mago' && !char.grimorio) {
    char.grimorio = [];
    // Migrar magias já preparadas para o grimório
    (char.magias_preparadas || []).forEach(m => {
      if (magiaContaNoLimite(m) && !char.grimorio.find(g => g.nome === m.nome)) {
        char.grimorio.push({ nome: m.nome, circulo: m.circulo });
      }
    });
    salvar();
  }

  // Sincronizar espaços de magia de conjuradores regulares
  const _infoClasse = CLASSES_INFO[char.classe];
  if (_infoClasse?.conjurador && classeData?.tabela_caracteristicas) {
    const _espacosCorretos = getEspacosMagia(classeData.tabela_caracteristicas, char.nivel);
    if (!char.espacos_magia) char.espacos_magia = {};
    // Atualizar totais conforme tabela da classe
    Object.keys(_espacosCorretos).forEach(circ => {
      if (!char.espacos_magia[circ]) {
        char.espacos_magia[circ] = { total: _espacosCorretos[circ].total, usados: 0 };
      } else {
        char.espacos_magia[circ].total = _espacosCorretos[circ].total;
        if (char.espacos_magia[circ].usados > char.espacos_magia[circ].total) {
          char.espacos_magia[circ].usados = char.espacos_magia[circ].total;
        }
      }
    });
    // Remover circulos que nao existem mais neste nivel
    Object.keys(char.espacos_magia).forEach(circ => {
      if (!_espacosCorretos[circ]) {
        delete char.espacos_magia[circ];
      }
    });
    salvar();
  }

  // Sincronizar espaços de magia de subclasses conjuradoras (Cavaleiro Místico / Trapaceiro Arcano)
  if (ehSubclasseConjuradora()) {
    const conjSub = getSubclasseConjuradoraConjuracao();
    if (conjSub) {
      if (!char.espacos_magia) char.espacos_magia = {};
      // Atualizar totais com base na tabela de progressão
      Object.entries(conjSub.espacos).forEach(([circ, total]) => {
        if (!char.espacos_magia[circ]) {
          char.espacos_magia[circ] = { total, usados: 0 };
        } else {
          char.espacos_magia[circ].total = total;
        }
      });
      // Remover círculos que não estão na progressão
      Object.keys(char.espacos_magia).forEach(circ => {
        if (!conjSub.espacos[circ]) {
          delete char.espacos_magia[circ];
        }
      });
      salvar();
    }
  }

  renderFichaCompleta();

  document.getElementById('btn-print')?.addEventListener('click', () => imprimirFicha());
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
    if (nomesDominio.has(m.nome) && m.origem !== 'dominio' && m.origem !== 'sempre') {
      m.origem = 'dominio';
      alterado = true;
    }
  });
  if (alterado) salvar();
}

/** Migra magias sempre preparadas legadas adicionando origem: 'sempre' */
function migrarMagiasSemprePreparadas() {
  if (!char.magias_preparadas?.length) return;
  let alterado = false;
  const nomesSempre = new Set((magiasSempreCache || []).map(m => m.nome));

  // Higienização: remove magias marcadas como "sempre" que não estão mais
  // na lista real de magias sempre preparadas (corrige parsing antigo/errado)
  char.magias_preparadas = char.magias_preparadas.filter(m => {
    if (m?.origem !== 'sempre') return true;
    if (nomesSempre.has(m.nome)) return true;
    alterado = true;
    return false;
  });

  char.magias_preparadas.forEach(m => {
    if (nomesSempre.has(m.nome) && m.origem !== 'dominio' && m.origem !== 'sempre') {
      m.origem = 'sempre';
      alterado = true;
    }
  });
  if (alterado) salvar();
}

/** Adiciona truques concedidos pela espécie que estejam faltando */
function migrarTruquesEspecie() {
  if (!char.especie) return;
  const truques = obterTruquesEspecieFicha(char.especie, char.tracos_escolhidos || []);
  if (truques.length === 0) return;

  if (!char.magias_conhecidas) char.magias_conhecidas = [];
  let alterado = false;
  for (const nome of truques) {
    if (!char.magias_conhecidas.find(m => m.nome === nome)) {
      char.magias_conhecidas.push({ nome, circulo: 0, origem: 'especie' });
      alterado = true;
    }
  }
  if (alterado) salvar();
}

/** Retorna truques concedidos pela espécie/traço escolhido */
function obterTruquesEspecieFicha(especie, tracosEscolhidos) {
  const truques = [];
  const escolha = (tracosEscolhidos || [])[0] || '';

  if (especie === 'Aasimar') {
    truques.push('Luz');
  } else if (especie === 'Gnomo') {
    if (escolha === 'Gnomo das Rochas') {
      truques.push('Prestidigitação Arcana', 'Reparar');
    } else if (escolha === 'Gnomo do Bosque') {
      truques.push('Ilusão Menor');
    }
  } else if (especie === 'Tiferino') {
    truques.push('Taumaturgia');
    const legadoTruque = { 'Abissal': 'Rajada de Veneno', 'Ctônico': 'Toque Necrótico', 'Infernal': 'Raio de Fogo' };
    if (legadoTruque[escolha]) truques.push(legadoTruque[escolha]);
  } else if (especie === 'Elfo') {
    const linhagemTruque = { 'Alto Elfo': 'Prestidigitação Arcana', 'Drow': 'Luzes Dançantes', 'Elfo Silvestre': 'Arte Druídica' };
    if (linhagemTruque[escolha]) truques.push(linhagemTruque[escolha]);
  }

  return truques;
}

/** Migra escolhas_classe legadas aplicando expertise e idiomas mecanicamente */
function migrarEscolhasClasseLegadas() {
  if (!char.escolhas_classe) return;
  let alterado = false;
  if (!char.pericias_expertise) char.pericias_expertise = [];

  // Aplicar especialista (Ladino / Guardião) -> pericias_expertise
  const especialista = char.escolhas_classe.especialista || [];
  especialista.forEach(p => {
    if (!char.pericias_expertise.includes(p)) {
      char.pericias_expertise.push(p);
      alterado = true;
    }
  });

  // Aplicar acadêmico (Mago) -> pericias_expertise
  const academico = char.escolhas_classe.academico || [];
  academico.forEach(p => {
    if (!char.pericias_expertise.includes(p)) {
      char.pericias_expertise.push(p);
      alterado = true;
    }
  });

  if (alterado) salvar();
}

/** Migra nome legado da pericia 'Adestrar Animais' para 'Lidar com Animais' (Livro do Jogador 2024) */
function migrarNomePericiaLidarAnimais() {
  let alterado = false;
  const substituir = (arr) => {
    if (!arr) return;
    const idx = arr.indexOf('Adestrar Animais');
    if (idx !== -1) { arr[idx] = 'Lidar com Animais'; alterado = true; }
  };
  substituir(char.pericias_proficientes);
  substituir(char.pericias_expertise);
  if (alterado) salvar();
}

/** Migra talento Versatil do Humano: garante que esteja no array de talentos */
function migrarTalentoVersatilHumano() {
  if (char.especie !== 'Humano' || !char.talento_versatil) return;
  if (!char.talentos) char.talentos = [];
  if (!char.talentos.includes(char.talento_versatil)) {
    char.talentos.push(char.talento_versatil);
    salvar();
  }
}

/** Garante que a pericia de especie (Habil/Sentidos Aguçados) esteja nas proficiencias */
function migrarPericiaEspecie() {
  if (!char.pericia_especie) return;
  if (!char.pericias_proficientes) char.pericias_proficientes = [];
  if (!char.pericias_proficientes.includes(char.pericia_especie)) {
    char.pericias_proficientes.push(char.pericia_especie);
    salvar();
  }
}

/** Garante que pericias de talentos (Habilidoso) estejam nas proficiencias */
function migrarPericiasTalentos() {
  if (!char.escolhas_talento) return;
  if (!char.pericias_proficientes) char.pericias_proficientes = [];
  const PERICIAS_NOMES = [
    'Acrobacia', 'Lidar com Animais', 'Arcanismo', 'Atletismo', 'Atuação',
    'Enganação', 'Furtividade', 'História', 'Intimidação', 'Intuição',
    'Investigação', 'Medicina', 'Natureza', 'Percepção', 'Persuasão',
    'Prestidigitação', 'Religião', 'Sobrevivência'
  ];
  let changed = false;
  // Iterar sobre todos os contextos (antecedente, versatil, levelup_N)
  Object.keys(char.escolhas_talento).forEach(ctx => {
    const escolhas = char.escolhas_talento[ctx] || [];
    escolhas.forEach(e => {
      // So pericias, nao ferramentas
      if (PERICIAS_NOMES.includes(e) && !char.pericias_proficientes.includes(e)) {
        char.pericias_proficientes.push(e);
        changed = true;
      }
    });
  });
  if (changed) salvar();
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
  const _tamanho = char.tamanho || (_espData ? getTamanho(_espData.texto_completo) : 'Médio');

  const container = containerRef;
  container.innerHTML = `
    <!-- Cabeçalho do personagem -->
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:start;flex-wrap:wrap;gap:8px">
        <div>
          <h2 style="font-size:1.3rem;margin-bottom:2px" id="char-nome-display">${char.nome || 'Sem Nome'}</h2>
          <div style="font-size:0.9rem;color:var(--text-muted)">
            ${char.especie || ''} ${char.classe || ''} ${char.subclasse ? `(${char.subclasse})` : ''} &middot; Nível ${char.nivel}
          </div>
          <div style="font-size:0.8rem;color:var(--text-muted)">Antecedente: ${char.antecedente || '–'}${char.alinhamento ? ' | Alinhamento: ' + char.alinhamento : ''}</div>
          <div style="font-size:0.8rem;color:var(--text-muted)">Tamanho: ${_tamanho}${(char.idiomas && char.idiomas.length) ? ' | Idiomas: ' + char.idiomas.join(', ') : ''}</div>
          ${(estadoGuardiao && estadoGuardiao.sentidosSelvagensAtivo) ? '<div style="font-size:0.8rem;color:var(--text-muted)">Sentidos: Visão às Cegas 9 m</div>' : ''}
          ${(estadoGuardiao && estadoGuardiao.exaustao > 0) ? `<div style="font-size:0.8rem;color:var(--danger)">Exaustão: ${estadoGuardiao.exaustao}</div>` : ''}
          <div style="font-size:0.8rem;color:var(--text-muted);margin-top:4px">
            XP: <span style="font-weight:600;color:var(--accent);cursor:pointer" id="xp-display" title="Clique para editar XP">${char.xp || 0}</span>
            ${char.nivel < 20 ? ` / ${XP_POR_NIVEL[char.nivel + 1]}` : ' (Nível Máximo)'}
          </div>
        </div>
        <div class="no-print" style="display:flex;gap:4px;flex-direction:column">
          <div style="display:flex;gap:4px">
            <button class="btn btn-sm btn-secondary" id="btn-edit-header">Editar</button>
            <button class="btn btn-sm btn-primary" id="btn-print" title="Imprimir ou Salvar como PDF" style="gap:4px">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
              Imprimir
            </button>
          </div>
          ${char.nivel < 20 ? `
            <button class="btn btn-sm btn-accent" id="btn-levelup" style="font-weight:700">
              ⬆ Subir de Nível (Nível ${char.nivel + 1})
            </button>
          ` : ''}
        </div>
      </div>
    </div>

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
            Marca do Predador: ${estadoGuardiao.marcaPredadorAtiva ? 'Ativa' : 'Inativa'}
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
            ${estadoGuardiao.predadorImplacavelAtivo ? 'Predador Implacável: sofrer dano não quebra sua Concentração de Marca do Predador. ' : ''}
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
            <strong>Recursos do Guerreiro (${char.subclasse}):</strong>
            ${estadoGuerreiro.ehMestreBatalha ? `
              Dados de Superioridade: ${estadoGuerreiro.dadosSuperioridadeDisponiveis}/${estadoGuerreiro.dadosSuperioridadeMax} (${estadoGuerreiro.tipoDadoSuperioridade})
              &nbsp;|&nbsp; CD: ${estadoGuerreiro.cdSuperioridade}
              &nbsp;|&nbsp; Manobras: ${estadoGuerreiro.manobrasConhecidas}
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
            ${estadoGuerreiro.ehMestreBatalha ? `
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

      ${estadoMago ? `
        <div class="info-box info" style="margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
          <div style="font-size:0.85rem">
            <strong>Recursos do Mago:</strong>
            Recuperação Arcana: ${estadoMago.recuperacaoArcanaUsada ? 'Usada' : `Disponível (até ${estadoMago.recuperacaoArcanaMax}º combinado)`}
            ${estadoMago.assinaturaMagicaAtiva ? `&nbsp;|&nbsp; Assinatura 1: ${estadoMago.assinatura1Usada ? 'Usada' : 'Disponível'} | Assinatura 2: ${estadoMago.assinatura2Usada ? 'Usada' : 'Disponível'}` : ''}
          </div>
          <div class="no-print" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
            <button class="btn btn-sm btn-accent" data-mago-acao="recuperacao-arcana" ${estadoMago.recuperacaoArcanaUsada ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Recuperação Arcana</button>
            ${estadoMago.assinaturaMagicaAtiva ? `
              <button class="btn btn-sm btn-primary" data-mago-acao="assinatura-1" ${estadoMago.assinatura1Usada ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Assinatura 1</button>
              <button class="btn btn-sm btn-primary" data-mago-acao="assinatura-2" ${estadoMago.assinatura2Usada ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Assinatura 2</button>
            ` : ''}
          </div>
          <div style="width:100%;font-size:0.78rem;color:var(--text-muted)">
            Grimório: preparar magias no Descanso Longo.
            ${estadoMago.memorizarMagiaAtivo ? ' Memorizar Magia: trocar 1 magia preparada no Descanso Curto.' : ''}
            ${estadoMago.maestriaMagiasAtiva ? ' Maestria: 1ª e 2ª sem espaço no círculo base.' : ''}
          </div>
        </div>
      ` : ''}

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
        <div class="stat-box">
          <div class="stat-label">Deslocamento</div>
          <div class="stat-value">${_deslocamento}</div>
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

    <!-- Características de Classe -->
    ${renderSecaoCaracteristicas()}

    <!-- Características de Subclasse -->
    ${renderSecaoSubclasse()}

    <!-- Traços da Espécie/Raça -->
    ${renderSecaoTracosEspecie()}

    <!-- Espaços de Magia e Magias -->
    ${(info.conjurador || ehSubclasseConjuradora() || getTruquesExtraEstiloLuta() > 0 || char.iniciado_em_magia?.lista || (char.iniciado_em_magia_instancias?.length > 0)) ? renderSecaoMagias() : ''}

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

  // Restaurar estado dos details
  restaurarEstadoDetails(estadoDetails);
}

/** Setup de eventos para badges de Vantagem/Desvantagem (toque mobile) */
function setupEventosVantagemDesvantagem() {
  document.querySelectorAll('[data-vd-info]').forEach(el => {
    el.addEventListener('click', () => {
      toast(el.dataset.vdInfo, 'info');
    });
  });
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
    const furia = getEstadoFuria();
    const podeResistirFuria = !!(furia?.ativa && char.classe === 'Bárbaro');

    abrirModal('Dano Recebido',
      numberPickerHtml('input-dano', 1, 1, 999, 'Valor do dano') +
      (podeResistirFuria
        ? `<label class="form-check" style="justify-content:center;margin-top:8px">
             <input type="checkbox" id="input-resistencia-furia"> Aplicar Resistência da Fúria (contundente/cortante/perfurante)
           </label>`
        : ''),
      '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-danger" id="btn-aplicar-dano">Aplicar Dano</button>'
    );
    setupNumberPicker('input-dano');
    document.getElementById('btn-aplicar-dano')?.addEventListener('click', () => {
      let dano = parseInt(document.getElementById('input-dano-val')?.value) || 0;
      if (dano <= 0) return;

      const aplicarResistenciaFuria = !!document.getElementById('input-resistencia-furia')?.checked;
      if (aplicarResistenciaFuria) {
        dano = Math.floor(dano / 2);
      }

      // Absorver pelo PV temporário primeiro
      if (char.pv_temporario > 0) {
        const absorvido = Math.min(dano, char.pv_temporario);
        char.pv_temporario -= absorvido;
        dano -= absorvido;
      }
      char.pv_atual = Math.max(0, char.pv_atual - dano);
      const estadoGuardiao = getEstadoRecursosGuardiao();
      if (estadoGuardiao?.predadorImplacavelAtivo && estadoGuardiao?.marcaPredadorAtiva && dano > 0) {
        toast('Predador Implacável: sua concentração de Marca do Predador não é quebrada por dano.', 'info');
      }
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
    const pvBase = char.pv_max;
    const pvAtual = char.pv_max_override || pvBase;
    abrirModal('Sobrescrever PV Máximo',
      `<div style="font-size:0.85rem;color:var(--text-muted);text-align:center;margin-bottom:8px">PV Máximo Base (fixo): <strong>${pvBase}</strong></div>` +
      numberPickerHtml('input-pv-max', pvAtual, 1, Math.max(pvBase + 50, pvAtual + 20), 'PV Máximo Atual') +
      `<div style="font-size:0.8rem;color:var(--text-muted);margin-top:4px;text-align:center">
          Use para magias que aumentam PV máximo temporariamente (ex: Ajuda, Heróis do Banquete).
        </div>`,
      `<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>
       <button class="btn btn-warning" id="btn-resetar-pv-max">Resetar</button>
       <button class="btn btn-primary" id="btn-aplicar-pv-max">Aplicar</button>`
    );
    setupNumberPicker('input-pv-max');
    document.getElementById('btn-resetar-pv-max')?.addEventListener('click', () => {
      delete char.pv_max_override;
      char.pv_atual = Math.min(char.pv_atual, char.pv_max);
      salvar();
      window.fecharModal();
      renderFichaCompleta();
    });
    document.getElementById('btn-aplicar-pv-max')?.addEventListener('click', () => {
      const novoMax = parseInt(document.getElementById('input-pv-max-val')?.value) || char.pv_max;
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
  // Remover efeitos magicos ativos (badges)
  document.querySelectorAll('[data-remover-efeito]').forEach(el => {
    el.addEventListener('click', () => {
      const nome = el.dataset.removerEfeito;
      // Reverter bonus de PV maximo de efeitos compostos (ex: Banquete de Herois)
      const efsPVMax = (char.efeitos_magicos || []).filter(e => {
        const base = e.nome.replace(/ \(.*\)$/, '');
        return base === nome && e.tipo === 'bonus_pv_max';
      });
      for (const ef of efsPVMax) {
        if (char.pv_max_override) {
          char.pv_max_override -= ef.valor || 0;
          if (char.pv_max_override <= char.pv_max) delete char.pv_max_override;
          char.pv_atual = Math.min(char.pv_atual, char.pv_max_override || char.pv_max);
        }
      }
      // Remover todos os efeitos com mesmo nome base (filhos compostos)
      char.efeitos_magicos = (char.efeitos_magicos || []).filter(e => {
        const base = e.nome.replace(/ \(.*\)$/, '');
        return base !== nome;
      });
      salvar();
      renderFichaCompleta();
      toast(`Efeito de ${nome} removido.`, 'info');
    });
  });

  // Quebrar concentracao manualmente
  document.querySelectorAll('[data-quebrar-concentracao]').forEach(el => {
    el.addEventListener('click', () => {
      const concAtiva = getConcentracaoAtiva();
      if (!concAtiva) return;
      // Reverter bonus de PV maximo se necessario
      const efsPVMax = (char.efeitos_magicos || []).filter(e => e.concentracao && e.tipo === 'bonus_pv_max');
      for (const ef of efsPVMax) {
        if (char.pv_max_override) {
          char.pv_max_override -= ef.valor || 0;
          if (char.pv_max_override <= char.pv_max) delete char.pv_max_override;
          char.pv_atual = Math.min(char.pv_atual, char.pv_max_override || char.pv_max);
        }
      }
      char.efeitos_magicos = (char.efeitos_magicos || []).filter(e => !e.concentracao);
      salvar();
      renderFichaCompleta();
      toast(`Concentração em ${concAtiva} encerrada.`, 'info');
    });
  });

  // Inspiração Heroica (toggle estrela)
  document.getElementById('inspiracao-toggle')?.addEventListener('click', () => {
    char.inspiracao_heroica = !char.inspiracao_heroica;
    salvar();
    renderFichaCompleta();
    toast(char.inspiracao_heroica ? 'Inspiração Heroica concedida!' : 'Inspiração Heroica usada! Role um d20 adicional.', 'success');
  });

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

    // Bárbaro: recupera 1 uso de Fúria no descanso curto
    if (char.classe === 'Bárbaro') {
      if (!char.recursos) char.recursos = {};
      char.recursos.furia_usos_gastos = Math.max(0, (char.recursos.furia_usos_gastos || 0) - 1);
      char.recursos.furia_implacavel_cd = 10; // Resetar CD da Fúria Implacável
    }

    // Bardo: a partir do nível 5, descanso curto restaura todos os usos
    if (char.classe === 'Bardo' && (char.nivel || 1) >= 5) {
      if (!char.recursos) char.recursos = {};
      char.recursos.inspiracao_bardo_usos_gastos = 0;
    }

    // Bardo Glamour: Majestade Inquebrável recarrega em descanso curto ou longo
    if (char.classe === 'Bardo' && char.subclasse === 'Colégio do Glamour') {
      if (!char.recursos) char.recursos = {};
      if (char.recursos.bardo?.subclasses?.glamour) {
        char.recursos.bardo.subclasses.glamour.majestade_inquebravel_usada = false;
      }
    }

    // Clérigo: descanso curto recupera 1 uso de Canalizar Divindade
    if (char.classe === 'Clérigo') {
      const estadoClerigo = getEstadoRecursosClerigo();
      if (estadoClerigo) {
        char.recursos.clerigo.canalizar_divindade_usos_gastos = Math.max(
          0,
          (char.recursos.clerigo.canalizar_divindade_usos_gastos || 0) - 1
        );

        // Domínio da Guerra: Sacerdote da Guerra recarrega em descanso curto ou longo
        if (char.subclasse === 'Domínio da Guerra') {
          char.recursos.clerigo.subclasses.guerra.sacerdote_guerra_usos_gastos = 0;
        }

        // Domínio da Luz (nível 6+): Labareda Protetora recarrega em descanso curto ou longo
        if (char.subclasse === 'Domínio da Luz' && (char.nivel || 1) >= 6) {
          char.recursos.clerigo.subclasses.luz.labareda_protetora_usos_gastos = 0;
        }
      }
    }

    // Bruxo: descanso curto recupera todos os espaços de Magia de Pacto
    if (char.classe === 'Bruxo') {
      recuperarEspacosMagiaBruxo(false);
      // Subclasses: Combatente Clarividente (Grande Antigo) recarrega em curto
      if (char.subclasse === 'Patrono O Grande Antigo' && char.recursos.bruxo?.subclasses?.grande_antigo) {
        char.recursos.bruxo.subclasses.grande_antigo.combatente_clarividente_usado = false;
      }
    }

    // Druida: descanso curto recupera 1 uso de Forma Selvagem
    if (char.classe === 'Druida') {
      recuperarUmUsoFormaSelvagem();
    }

    // Guerreiro: descanso curto recupera 1 uso de Recuperar Fôlego e restaura Surto de Ação
    if (char.classe === 'Guerreiro') {
      const estadoGuerreiro = getEstadoRecursosGuerreiro();
      if (estadoGuerreiro) {
        // Recuperar Fôlego: recupera 1 uso em descanso curto
        char.recursos.guerreiro.recuperar_folego_usos_gastos = Math.max(
          0,
          (char.recursos.guerreiro.recuperar_folego_usos_gastos || 0) - 1
        );
        // Surto de Ação: restaura todos os usos em descanso curto
        char.recursos.guerreiro.surto_acao_usos_gastos = 0;

        // Mestre da Batalha: restaura TODOS os dados de superioridade no descanso curto
        if (char.subclasse === 'Mestre da Batalha') {
          char.recursos.guerreiro.subclasses.mestre_batalha.dados_superioridade_gastos = 0;
        }

        // Combatente Psíquico: recupera 1 dado psiônico no descanso curto
        if (char.subclasse === 'Combatente Psíquico') {
          char.recursos.guerreiro.subclasses.combatente_psiquico.dados_psionicos_gastos = Math.max(
            0,
            (char.recursos.guerreiro.subclasses.combatente_psiquico.dados_psionicos_gastos || 0) - 1
          );
          // Restaura habilidades 1/descanso curto
          char.recursos.guerreiro.subclasses.combatente_psiquico.movimento_telecinetico_usado = false;
          char.recursos.guerreiro.subclasses.combatente_psiquico.salto_impulsao_usado = false;
        }
      }
    }

    // Feiticeiro: descanso curto não restaura automaticamente PF,
    // mas encerra efeitos temporários de 1 minuto para evitar estado preso.
    if (char.classe === 'Feiticeiro') {
      const estadoFeiticeiro = getEstadoRecursosFeiticeiro();
      if (estadoFeiticeiro) {
        char.recursos.feiticeiro.feiticaria_inata_ativa = false;
        char.recursos.feiticeiro.subclasses.aberrante.telepatia_ativa = false;
        char.recursos.feiticeiro.subclasses.aberrante.telepatia_duracao_min = 0;
        char.recursos.feiticeiro.subclasses.aberrante.revelacao_carne_ativa = false;
        char.recursos.feiticeiro.subclasses.draconica.asas_ativas = false;
        char.recursos.feiticeiro.subclasses.mecanica.transe_ordem_ativo = false;
      }
    }

    // Paladino: descanso curto recupera 1 uso de Canalizar Divindade
    if (char.classe === 'Paladino') {
      const estado = getEstadoRecursosPaladino();
      if (estado && estado.canalizarMax > 0) {
        char.recursos.paladino.canalizar_divindade_usos_gastos = Math.max(
          0,
          (char.recursos.paladino.canalizar_divindade_usos_gastos || 0) - 1
        );
      }
    }

    // Monge: descanso curto restaura todos os pontos de foco
    if (char.classe === 'Monge') {
      const estado = getEstadoRecursosMonge();
      if (estado) {
        char.recursos.monge.pontos_foco_gastos = 0;
        // Subclasses de Monge: descanso curto
        if (char.recursos.monge.subclasses) {
          // Elementos: Sintonia desativa
          if (char.subclasse === 'Combatente dos Elementos' && char.recursos.monge.subclasses.elementos) {
            char.recursos.monge.subclasses.elementos.sintonia_ativa = false;
          }
        }
      }
    }

    // Ladino: descanso curto restaura Golpe de Sorte (nível 20)
    if (char.classe === 'Ladino') {
      const estado = getEstadoRecursosLadino();
      if (estado) {
        char.recursos.ladino.golpe_sorte_usado = false;

        // Adaga Espiritual: recupera 1 dado psiônico no descanso curto
        if (char.subclasse === 'Adaga Espiritual') {
          char.recursos.ladino.subclasses.adaga_espiritual.dados_psionicos_gastos = Math.max(
            0,
            (char.recursos.ladino.subclasses.adaga_espiritual.dados_psionicos_gastos || 0) - 1
          );
        }
      }
    }

    // Mago: descanso curto permite Memorizar Magia (nível 5+) e restaura assinaturas (nível 20)
    if (char.classe === 'Mago') {
      const estado = getEstadoRecursosMago();
      if (estado) {
        // Assinatura Mágica recupera em descanso curto ou longo
        if (estado.assinaturaMagicaAtiva) {
          char.recursos.mago.assinatura_magia_1_usada = false;
          char.recursos.mago.assinatura_magia_2_usada = false;
        }
        // Subclasses de Mago: descanso curto
        if (char.recursos.mago.subclasses) {
          // Adivinhador: O Terceiro Olho restaura
          if (char.subclasse === 'Adivinhador' && char.recursos.mago.subclasses.adivinhador) {
            char.recursos.mago.subclasses.adivinhador.terceiro_olho_usado = false;
          }
          // Ilusionista: Autoimagem Ilusória restaura
          if (char.subclasse === 'Ilusionista' && char.recursos.mago.subclasses.ilusionista) {
            char.recursos.mago.subclasses.ilusionista.autoimagem_usada = false;
          }
        }
      }
    }

    // Guardião: Incansável (nível 10+) reduz exaustão em 1 no descanso curto
    if (char.classe === 'Guardião' && (char.nivel || 1) >= 10) {
      if (typeof char.exaustao !== 'number') char.exaustao = 0;
      if (char.exaustao > 0) {
        char.exaustao = Math.max(0, char.exaustao - 1);
      }
    }

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
    // Reverter bonus de PV maximo de efeitos magicos antes de limpar
    const efsPVMax = (char.efeitos_magicos || []).filter(e => e.tipo === 'bonus_pv_max');
    for (const ef of efsPVMax) {
      if (char.pv_max_override) {
        char.pv_max_override -= ef.valor || 0;
        if (char.pv_max_override <= char.pv_max) delete char.pv_max_override;
      }
    }
    const pvMax = char.pv_max_override || char.pv_max;
    char.pv_atual = pvMax;
    char.pv_temporario = 0;
    // Regra 2024: Descanso Longo recupera TODOS os Dados de Vida
    char.dados_vida_usados = 0;
    // Reset death saves
    char.morte_sucessos = 0;
    char.morte_falhas = 0;
    // Regra 2024: Exaustao reduzida em 1 nivel no Descanso Longo (todas as classes)
    if (typeof char.exaustao !== 'number') char.exaustao = 0;
    if (char.exaustao > 0) {
      char.exaustao = Math.max(0, char.exaustao - 1);
      if (char.exaustao === 0) {
        char.condicoes = (char.condicoes || []).filter(c => c !== 'Exaustão');
      }
    }
    // Restaurar espaços de magia
    if (char.espacos_magia) {
      Object.keys(char.espacos_magia).forEach(k => {
        char.espacos_magia[k].usados = 0;
      });
    }
    // Limpar efeitos mágicos ativos
    char.efeitos_magicos = [];
    // Restaurar todas as habilidades
    restaurarHabilidades('longo');

    // Bárbaro: descanso longo restaura todos os usos e encerra Fúria
    if (char.classe === 'Bárbaro') {
      if (!char.recursos) char.recursos = {};
      char.recursos.furia_usos_gastos = 0;
      char.recursos.furia_ativa = false;
      char.recursos.furia_persistente_usada = false;
      char.recursos.furia_implacavel_cd = 10; // Resetar CD da Fúria Implacável
      char.recursos.furia_animal = null; // Limpar animal do Coração Selvagem
      char.recursos.furia_deuses_ativa = false; // Limpar Fúria dos Deuses do Fanático
      char.recursos.furia_deuses_usada = false;
      char.recursos.presenca_intimidante_usada = false; // Berserker nv10
      char.recursos.presenca_zelosa_usada = false; // Fanático nv10
    }

    // Bardo: descanso longo restaura todos os usos de Inspiração
    if (char.classe === 'Bardo') {
      if (!char.recursos) char.recursos = {};
      char.recursos.inspiracao_bardo_usos_gastos = 0;

      // Glamour: restaurar todos os recursos de subclasse
      if (char.subclasse === 'Colégio do Glamour' && char.recursos.bardo?.subclasses?.glamour) {
        char.recursos.bardo.subclasses.glamour.magia_fascinante_usada = false;
        char.recursos.bardo.subclasses.glamour.manto_majestade_usado = false;
        char.recursos.bardo.subclasses.glamour.majestade_inquebravel_usada = false;
      }
    }

    // Guerreiro: descanso longo restaura todos os recursos
    if (char.classe === 'Guerreiro') {
      const estadoGuerreiro = getEstadoRecursosGuerreiro();
      if (estadoGuerreiro) {
        char.recursos.guerreiro.recuperar_folego_usos_gastos = 0;
        char.recursos.guerreiro.surto_acao_usos_gastos = 0;
        char.recursos.guerreiro.indomavel_usos_gastos = 0;

        // Mestre da Batalha: restaura todos os dados de superioridade e Conheça Seu Inimigo
        if (char.subclasse === 'Mestre da Batalha') {
          char.recursos.guerreiro.subclasses.mestre_batalha.dados_superioridade_gastos = 0;
          char.recursos.guerreiro.subclasses.mestre_batalha.conheca_inimigo_usado = false;
        }

        // Combatente Psíquico: restaura todos os dados psiônicos e habilidades
        if (char.subclasse === 'Combatente Psíquico') {
          char.recursos.guerreiro.subclasses.combatente_psiquico.dados_psionicos_gastos = 0;
          char.recursos.guerreiro.subclasses.combatente_psiquico.movimento_telecinetico_usado = false;
          char.recursos.guerreiro.subclasses.combatente_psiquico.salto_impulsao_usado = false;
          char.recursos.guerreiro.subclasses.combatente_psiquico.baluarte_usado = false;
          char.recursos.guerreiro.subclasses.combatente_psiquico.mestre_telecinetico_usado = false;
        }
      }
    }

    // Clérigo: Intervenção Divina
    if (char.classe === 'Clérigo') {
      const estadoClerigo = getEstadoRecursosClerigo();
      if (estadoClerigo) {
        // Recupera totalmente Canalizar Divindade no descanso longo
        char.recursos.clerigo.canalizar_divindade_usos_gastos = 0;

        const restantes = char.recursos.clerigo.intervencao_divina_descansos_restantes || 0;
        if (restantes > 0) {
          char.recursos.clerigo.intervencao_divina_descansos_restantes = Math.max(0, restantes - 1);
          char.recursos.clerigo.intervencao_divina_bloqueada = char.recursos.clerigo.intervencao_divina_descansos_restantes > 0;
        } else {
          char.recursos.clerigo.intervencao_divina_bloqueada = false;
        }

        // Reset de recursos de subclasses
        char.recursos.clerigo.subclasses.guerra.sacerdote_guerra_usos_gastos = 0;
        char.recursos.clerigo.subclasses.luz.labareda_protetora_usos_gastos = 0;
        char.recursos.clerigo.subclasses.luz.coroa_luz_usos_gastos = 0;
        char.recursos.clerigo.subclasses.trapaca.bencao_trapaceiro_ativa = false;
        char.recursos.clerigo.subclasses.trapaca.invocar_duplicidade_ativa = false;
      }
    }

    // Bruxo: descanso longo restaura Astúcia Mágica e usos de Arcana Mística
    if (char.classe === 'Bruxo') {
      const estado = getEstadoRecursosBruxo();
      if (estado) {
        char.recursos.bruxo.astucia_usada = false;
        estado.circulosArcanum.forEach(c => {
          if (!char.recursos.bruxo.arcanum[c]) char.recursos.bruxo.arcanum[c] = { magia: '', usado: false };
          char.recursos.bruxo.arcanum[c].usado = false;
        });

        // Subclasses: restaurar todos os recursos de subclasse
        if (char.subclasse === 'Patrono Arquifada') {
          char.recursos.bruxo.subclasses.arquifada.passos_feericos_usos_gastos = 0;
          char.recursos.bruxo.subclasses.arquifada.fuga_nevoa_usada = false;
          char.recursos.bruxo.subclasses.arquifada.defesas_sedutoras_usada = false;
        }
        if (char.subclasse === 'Patrono Celestial') {
          char.recursos.bruxo.subclasses.celestial.luz_medicinal_dados_gastos = 0;
          char.recursos.bruxo.subclasses.celestial.vinganca_calcinante_usada = false;
        }
        if (char.subclasse === 'Patrono O Grande Antigo') {
          char.recursos.bruxo.subclasses.grande_antigo.combatente_clarividente_usado = false;
        }
        if (char.subclasse === 'Patrono Ínfero') {
          char.recursos.bruxo.subclasses.infero.sorte_tenebroso_usos_gastos = 0;
          char.recursos.bruxo.subclasses.infero.lancar_inferno_usado = false;
          // resistencia_infera_escolha NÃO é resetada — é uma escolha persistente
        }
      }
    }

    // Druida: descanso longo restaura Forma Selvagem e limpa travas de recursos
    if (char.classe === 'Druida') {
      const estado = getEstadoRecursosDruida();
      if (estado) {
        char.recursos.druida.forma_selvagem_usos_gastos = 0;
        char.recursos.druida.forma_selvagem_ativa = false;
        char.recursos.druida.companheiro_selvagem_ativo = false;
        char.recursos.druida.ressurgimento_slot_recuperado_hoje = false;

        // Subclasses: restaurar todos os recursos de subclasse
        if (char.subclasse === 'Círculo da Lua') {
          char.recursos.druida.subclasses.lua.passo_lunar_usos_gastos = 0;
        }
        if (char.subclasse === 'Círculo da Terra') {
          char.recursos.druida.subclasses.terra.recuperacao_natural_magia_usada = false;
          char.recursos.druida.subclasses.terra.recuperacao_natural_slots_usada = false;
        }
        if (char.subclasse === 'Círculo das Estrelas') {
          char.recursos.druida.subclasses.estrelas.mapa_estelar_usos_gastos = 0;
          char.recursos.druida.subclasses.estrelas.pressagio_cosmico_usos_gastos = 0;
          // constelacao_ativa e pressagio_tipo NÃO são resetados — são escolhas persistentes
        }
      }
    }

    // Guardião: descanso longo restaura usos da classe e encerra efeitos temporários
    if (char.classe === 'Guardião') {
      const estado = getEstadoRecursosGuardiao();
      if (estado) {
        char.recursos.guardiao.inimigo_favorito_usos_gastos = 0;
        char.recursos.guardiao.incansavel_usos_gastos = 0;
        char.recursos.guardiao.veu_natureza_usos_gastos = 0;
        char.recursos.guardiao.marca_predador_ativa = false;

        // Subclasses: restaurar todos os recursos de subclasse
        if (char.subclasse === 'Andarilho Feérico') {
          char.recursos.guardiao.subclasses.andarilho.reforcos_feericos_usado = false;
          char.recursos.guardiao.subclasses.andarilho.andarilho_nebuloso_usos_gastos = 0;
        }
        // Caçador: presa_escolha e taticas_escolha NÃO resetam — são escolhas que podem mudar em descansos
        // Senhor das Feras: companheiro_tipo NÃO reseta — é escolha persistente
        if (char.subclasse === 'Vigilante das Sombras') {
          char.recursos.guardiao.subclasses.vigilante.golpe_terrivel_usos_gastos = 0;
        }
      }
    }

    // Feiticeiro: descanso longo restaura pontos e usos por descanso longo
    if (char.classe === 'Feiticeiro') {
      const estadoFeiticeiro = getEstadoRecursosFeiticeiro();
      if (estadoFeiticeiro) {
        char.recursos.feiticeiro.pontos_feiticaria_gastos = 0;
        char.recursos.feiticeiro.feiticaria_inata_usos_gastos = 0;
        char.recursos.feiticeiro.feiticaria_inata_ativa = false;
        char.recursos.feiticeiro.restauracao_feiticeira_usada = false;

        char.recursos.feiticeiro.subclasses.aberrante.telepatia_ativa = false;
        char.recursos.feiticeiro.subclasses.aberrante.telepatia_duracao_min = 0;
        char.recursos.feiticeiro.subclasses.aberrante.revelacao_carne_ativa = false;

        char.recursos.feiticeiro.subclasses.draconica.asas_ativas = false;
        char.recursos.feiticeiro.subclasses.draconica.asas_usada_desde_descanso = false;
        char.recursos.feiticeiro.subclasses.draconica.companheiro_draconico_usado = false;

        char.recursos.feiticeiro.subclasses.mecanica.restaurar_equilibrio_usos_gastos = 0;
        char.recursos.feiticeiro.subclasses.mecanica.transe_ordem_ativo = false;
        char.recursos.feiticeiro.subclasses.mecanica.transe_ordem_usado_desde_descanso = false;
        char.recursos.feiticeiro.subclasses.mecanica.bastiao_dados = 0;

        char.recursos.feiticeiro.subclasses.selvagem.mares_caos_disponivel = true;
        char.recursos.feiticeiro.subclasses.selvagem.surto_pendente_automatico = false;
        char.recursos.feiticeiro.subclasses.selvagem.surto_controlado_usado = false;
      }
    }

    // Paladino: descanso longo restaura todos os recursos
    if (char.classe === 'Paladino') {
      const estado = getEstadoRecursosPaladino();
      if (estado) {
        char.recursos.paladino.maos_consagradas_gastos = 0;
        char.recursos.paladino.canalizar_divindade_usos_gastos = 0;
        char.recursos.paladino.destruicao_gratuita_usada = false;

        // Glória: restaurar recursos de subclasse
        if (char.subclasse === 'Juramento de Glória' && char.recursos.paladino.subclasses?.gloria) {
          char.recursos.paladino.subclasses.gloria.defesa_gloriosa_usos_gastos = 0;
          char.recursos.paladino.subclasses.gloria.lenda_viva_usada = false;
        }
        // Vingança: restaurar recursos de subclasse
        if (char.subclasse === 'Juramento de Vingança' && char.recursos.paladino.subclasses?.vinganca) {
          char.recursos.paladino.subclasses.vinganca.anjo_vingador_usado = false;
        }
        // Anciões: restaurar recursos de subclasse
        if (char.subclasse === 'Juramento dos Anciões' && char.recursos.paladino.subclasses?.ancioes) {
          char.recursos.paladino.subclasses.ancioes.sentinela_imortal_usada = false;
          char.recursos.paladino.subclasses.ancioes.campeao_ancestral_usado = false;
        }
      }
    }

    // Monge: descanso longo restaura pontos de foco e metabolismo
    if (char.classe === 'Monge') {
      const estado = getEstadoRecursosMonge();
      if (estado) {
        char.recursos.monge.pontos_foco_gastos = 0;
        char.recursos.monge.metabolismo_usado = false;
        // Subclasses de Monge: descanso longo
        if (char.recursos.monge.subclasses) {
          // Mão Espalmada
          if (char.subclasse === 'Combatente da Mão Espalmada' && char.recursos.monge.subclasses.mao_espalmada) {
            char.recursos.monge.subclasses.mao_espalmada.integridade_usos_gastos = 0;
            char.recursos.monge.subclasses.mao_espalmada.palma_vibrante_ativa = false;
          }
          // Misericórdia
          if (char.subclasse === 'Combatente da Misericórdia' && char.recursos.monge.subclasses.misericordia) {
            char.recursos.monge.subclasses.misericordia.torrente_usos_gastos = 0;
            char.recursos.monge.subclasses.misericordia.misericordia_final_usada = false;
          }
          // Elementos
          if (char.subclasse === 'Combatente dos Elementos' && char.recursos.monge.subclasses.elementos) {
            char.recursos.monge.subclasses.elementos.sintonia_ativa = false;
          }
        }
      }
    }

    // Ladino: descanso longo restaura golpe de sorte
    if (char.classe === 'Ladino') {
      const estado = getEstadoRecursosLadino();
      if (estado) {
        char.recursos.ladino.golpe_sorte_usado = false;

        // Adaga Espiritual: restaura todos os dados psiônicos e habilidades
        if (char.subclasse === 'Adaga Espiritual') {
          char.recursos.ladino.subclasses.adaga_espiritual.dados_psionicos_gastos = 0;
          char.recursos.ladino.subclasses.adaga_espiritual.sussurros_gratis_usado = false;
          char.recursos.ladino.subclasses.adaga_espiritual.veu_psiquico_usado = false;
          char.recursos.ladino.subclasses.adaga_espiritual.rasgar_mente_usado = false;
        }
      }
    }

    // Mago: descanso longo restaura recuperação arcana e assinaturas
    if (char.classe === 'Mago') {
      const estado = getEstadoRecursosMago();
      if (estado) {
        char.recursos.mago.recuperacao_arcana_usada = false;
        char.recursos.mago.assinatura_magia_1_usada = false;
        char.recursos.mago.assinatura_magia_2_usada = false;
        // Subclasses de Mago: descanso longo
        if (char.recursos.mago.subclasses) {
          // Abjurador: Proteção Arcana pode ser criada novamente
          if (char.subclasse === 'Abjurador' && char.recursos.mago.subclasses.abjurador) {
            char.recursos.mago.subclasses.abjurador.protecao_criada = false;
            char.recursos.mago.subclasses.abjurador.protecao_pv_atual = 0;
          }
          // Adivinhador: Prodígio re-rola dados + O Terceiro Olho restaura
          if (char.subclasse === 'Adivinhador' && char.recursos.mago.subclasses.adivinhador) {
            const s = char.recursos.mago.subclasses.adivinhador;
            const n = (char.nivel || 1) >= 14 ? 3 : 2;
            s.prodigio_dado_1 = Math.floor(Math.random() * 20) + 1;
            s.prodigio_dado_1_usado = false;
            s.prodigio_dado_2 = Math.floor(Math.random() * 20) + 1;
            s.prodigio_dado_2_usado = false;
            if (n >= 3) {
              s.prodigio_dado_3 = Math.floor(Math.random() * 20) + 1;
              s.prodigio_dado_3_usado = false;
            }
            s.terceiro_olho_usado = false;
          }
          // Evocador: Sobrecarga reseta contador
          if (char.subclasse === 'Evocador' && char.recursos.mago.subclasses.evocador) {
            char.recursos.mago.subclasses.evocador.sobrecarga_usos = 0;
          }
          // Ilusionista: Criaturas Espectrais + Autoimagem restauram
          if (char.subclasse === 'Ilusionista' && char.recursos.mago.subclasses.ilusionista) {
            char.recursos.mago.subclasses.ilusionista.feerica_usada = false;
            char.recursos.mago.subclasses.ilusionista.fera_usada = false;
            char.recursos.mago.subclasses.ilusionista.autoimagem_usada = false;
          }
        }
      }
    }

    // Inspiração Heroica: Humanos (traço "Eficiente") ganham no descanso longo
    if (char.especie === 'Humano') {
      char.inspiracao_heroica = true;
    }

    salvar();

    // Verificar se a classe tem Maestria em Arma e/ou troca de magias
    const infoClasse = CLASSES_INFO[char.classe] || {};
    const classesMaestria = ['Bárbaro', 'Guerreiro', 'Guardião', 'Paladino', 'Ladino'];
    const temMaestria = classesMaestria.includes(char.classe);
    const ehSubConj = ehSubclasseConjuradora();
    // Diferenciar troca completa (preparadas) vs troca unica (conhecidas/subclasse)
    const temTrocaPreparadas = infoClasse.conjurador && infoClasse.tipo_conjuracao === 'preparadas' && !ehSubConj;
    const temTrocaConhecida = (infoClasse.conjurador && infoClasse.tipo_conjuracao === 'conhecidas') || ehSubConj;
    const temTrocaMagia = temTrocaPreparadas || temTrocaConhecida;

    if (temMaestria || temTrocaMagia) {
      // Montar conteudo do modal conforme opcoes disponiveis
      let conteudoModal = `
        <div class="info-box success" style="margin-bottom:12px">
          PV, espaços de magia e habilidades restaurados!
        </div>
      `;
      if (temMaestria) {
        const trocaUma = ['Bárbaro', 'Guerreiro'].includes(char.classe);
        conteudoModal += `
          <p style="font-size:0.9rem">Deseja trocar suas maestrias de arma?</p>
          <p style="font-size:0.8rem;color:var(--text-muted);margin-bottom:8px">
            Como ${char.classe}, você pode ${trocaUma ? 'alterar <strong>uma</strong> escolha de' : 'alterar suas escolhas de'} maestria após um Descanso Longo.
          </p>
        `;
      }
      if (temTrocaMagia) {
        if (temTrocaConhecida) {
          conteudoModal += `
            <p style="font-size:0.9rem">Deseja trocar uma magia conhecida?</p>
            <p style="font-size:0.8rem;color:var(--text-muted)">
              Como ${char.classe}${ehSubConj ? ' (' + char.subclasse + ')' : ''}, você pode trocar <strong>1 magia conhecida</strong> por outra da lista de classe após um Descanso Longo.
            </p>
          `;
        } else {
          conteudoModal += `
            <p style="font-size:0.9rem">Deseja trocar suas magias preparadas?</p>
            <p style="font-size:0.8rem;color:var(--text-muted)">
              Como ${char.classe}, você pode alterar sua lista de magias preparadas após um Descanso Longo.
            </p>
          `;
        }
      }

      let botoesModal = '<button class="btn btn-secondary" id="btn-pular-troca-dl">Manter Tudo</button>';
      if (temMaestria) {
        botoesModal += '<button class="btn btn-accent" id="btn-trocar-maestrias-dl">Trocar Maestrias</button>';
      }
      if (temTrocaMagia) {
        botoesModal += '<button class="btn btn-primary" id="btn-trocar-magias-dl">Trocar Magias</button>';
      }

      abrirModal('Descanso Longo Concluído', conteudoModal, botoesModal);

      // Funcao auxiliar para abrir o modal de troca correto
      const abrirTrocaMagias = (callbackPos) => {
        if (temTrocaConhecida) {
          mostrarTrocaMagiaConhecida(callbackPos);
        } else {
          mostrarTrocaMagias(callbackPos);
        }
      };

      document.getElementById('btn-pular-troca-dl')?.addEventListener('click', () => {
        window.fecharModal();
        renderFichaCompleta();
      });
      document.getElementById('btn-trocar-maestrias-dl')?.addEventListener('click', async () => {
        window.fecharModal();
        // Apos trocar maestrias, oferecer troca de magias se disponivel
        await abrirModalTrocaMaestriaDescanso(temTrocaMagia ? () => abrirTrocaMagias() : null);
      });
      document.getElementById('btn-trocar-magias-dl')?.addEventListener('click', () => {
        window.fecharModal();
        // Apos trocar magias, oferecer troca de maestrias se disponivel
        abrirTrocaMagias(temMaestria ? () => abrirModalTrocaMaestriaDescanso() : null);
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

  // Aasimar: Mãos Curativas - botão de cura com rolagem de PB d4s
  document.querySelectorAll('[data-maos-curativas]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (char.especie !== 'Aasimar') return;
      const key = 'especie_Mãos Curativas';
      if (!char.usos_habilidades) char.usos_habilidades = {};
      if (char.usos_habilidades[key]) {
        toast('Mãos Curativas já usado. Descanse para recuperar.', 'error');
        return;
      }
      const pb = bonusProficiencia(char.nivel || 1);
      // Simular rolagem de PB d4s
      let total = 0;
      const resultados = [];
      for (let i = 0; i < pb; i++) {
        const roll = Math.floor(Math.random() * 4) + 1;
        resultados.push(roll);
        total += roll;
      }
      char.usos_habilidades[key] = true;
      // Mostrar resultado para o jogador aplicar
      abrirModal('Mãos Curativas', `
        <div style="text-align:center;padding:16px">
          <div style="font-size:1.2rem;font-weight:700;margin-bottom:8px">Cura: ${total} PV</div>
          <div style="font-size:0.85rem;color:var(--text-muted)">${pb}d4 = [${resultados.join(', ')}]</div>
          <div style="font-size:0.8rem;color:var(--text-muted);margin-top:8px">Toque em uma criatura para curar.</div>
        </div>
      `, '<button class="btn btn-primary" onclick="fecharModal()">OK</button>');
      salvar();
      renderFichaCompleta();
    });
  });

  // Recursos específicos do Clérigo
  document.querySelectorAll('[data-clerigo-cd-acao]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (char.classe !== 'Clérigo') return;

      const estado = getEstadoRecursosClerigo();
      if (!estado || estado.canalizarDivindadeUsosDisponiveis <= 0) {
        toast('Sem usos de Canalizar Divindade disponíveis.', 'error');
        return;
      }

      const acao = btn.dataset.clerigoCdAcao;
      const modSab = calcMod(char.atributos.sabedoria);
      const dadosCentelha = (char.nivel >= 18) ? '4d8' : (char.nivel >= 13) ? '3d8' : (char.nivel >= 7) ? '2d8' : '1d8';

      // Consome 1 uso
      char.recursos.clerigo.canalizar_divindade_usos_gastos += 1;

      if (acao === 'centelha') {
        toast(`Centelha Divina usada (${dadosCentelha} + ${fmtMod(modSab)}).`, 'success');
      } else if (acao === 'expulsar') {
        toast('Expulsar Mortos-Vivos usado.', 'success');
      } else if (acao === 'fulminar') {
        toast(`Fulminar Mortos-Vivos usado (${Math.max(1, modSab)}d8).`, 'success');
      }

      salvar();
      renderFichaCompleta();
    });
  });

  document.querySelectorAll('[data-clerigo-golpes-opcao]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (char.classe !== 'Clérigo') return;
      if (!char.recursos) char.recursos = {};
      if (!char.recursos.clerigo) char.recursos.clerigo = {};

      char.recursos.clerigo.golpes_abencoados_opcao = btn.dataset.clerigoGolpesOpcao;
      salvar();
      renderFichaCompleta();
    });
  });

  document.querySelectorAll('[data-clerigo-intervencao]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (char.classe !== 'Clérigo') return;
      if (!char.recursos) char.recursos = {};
      if (!char.recursos.clerigo) char.recursos.clerigo = {};

      const acao = btn.dataset.clerigoIntervencao;
      const bloqueada = !!char.recursos.clerigo.intervencao_divina_bloqueada;
      const restantes = char.recursos.clerigo.intervencao_divina_descansos_restantes || 0;

      if (bloqueada) {
        if (restantes > 0) {
          toast(`Intervenção Divina bloqueada por ${restantes} descanso(s) longo(s).`, 'error');
        } else {
          toast('Intervenção Divina já foi usada e recarrega em descanso longo.', 'error');
        }
        return;
      }

      if (acao === 'desejo') {
        const cooldown = Math.floor(Math.random() * 3) + Math.floor(Math.random() * 3) + 2; // 2d4
        char.recursos.clerigo.intervencao_divina_descansos_restantes = cooldown;
        char.recursos.clerigo.intervencao_divina_bloqueada = true;
        toast(`Intervenção Divina Maior usada com Desejo. Recarrega em ${cooldown} descanso(s) longo(s).`, 'success');
      } else {
        char.recursos.clerigo.intervencao_divina_descansos_restantes = 0;
        char.recursos.clerigo.intervencao_divina_bloqueada = true;
        toast('Intervenção Divina usada. Recarrega no próximo descanso longo.', 'success');
      }

      salvar();
      renderFichaCompleta();
    });
  });

  document.querySelectorAll('[data-clerigo-subclasse-acao]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (char.classe !== 'Clérigo') return;

      const acao = btn.dataset.clerigoSubclasseAcao;
      const estadoClerigo = getEstadoRecursosClerigo();
      const estadoSub = getEstadoSubclassesClerigo();
      if (!estadoClerigo || !estadoSub) return;

      // Ações que consomem Canalizar Divindade
      const usaCanalizar = [
        'guerra_ataque_direcionado',
        'guerra_bencao_deus',
        'luz_brilho_amanhecer',
        'trapaca_invocar_duplicidade',
        'vida_preservar_vida'
      ].includes(acao);

      if (usaCanalizar && estadoClerigo.canalizarDivindadeUsosDisponiveis <= 0) {
        toast('Sem usos de Canalizar Divindade disponíveis.', 'error');
        return;
      }

      switch (acao) {
        case 'guerra_ataque_direcionado':
          char.recursos.clerigo.canalizar_divindade_usos_gastos += 1;
          toast('Ataque Direcionado usado.', 'success');
          break;

        case 'guerra_bencao_deus':
          char.recursos.clerigo.canalizar_divindade_usos_gastos += 1;
          toast('Bênção do Deus da Guerra usada.', 'success');
          break;

        case 'guerra_sacerdote_guerra':
          if (estadoSub.guerra.sacerdoteUsosDisponiveis <= 0) {
            toast('Sem usos de Sacerdote da Guerra disponíveis.', 'error');
            return;
          }
          char.recursos.clerigo.subclasses.guerra.sacerdote_guerra_usos_gastos += 1;
          toast('Sacerdote da Guerra usado.', 'success');
          break;

        case 'luz_brilho_amanhecer':
          char.recursos.clerigo.canalizar_divindade_usos_gastos += 1;
          toast('Brilho do Amanhecer usado.', 'success');
          break;

        case 'luz_labareda_protetora':
          if (estadoSub.luz.labaredaUsosDisponiveis <= 0) {
            toast('Sem usos de Labareda Protetora disponíveis.', 'error');
            return;
          }
          char.recursos.clerigo.subclasses.luz.labareda_protetora_usos_gastos += 1;
          toast('Labareda Protetora usada.', 'success');
          break;

        case 'luz_coroa_luz':
          if (estadoSub.luz.coroaUsosDisponiveis <= 0) {
            toast('Sem usos de Coroa de Luz disponíveis.', 'error');
            return;
          }
          char.recursos.clerigo.subclasses.luz.coroa_luz_usos_gastos += 1;
          toast('Coroa de Luz usada.', 'success');
          break;

        case 'trapaca_bencao_toggle':
          char.recursos.clerigo.subclasses.trapaca.bencao_trapaceiro_ativa = !char.recursos.clerigo.subclasses.trapaca.bencao_trapaceiro_ativa;
          toast(
            char.recursos.clerigo.subclasses.trapaca.bencao_trapaceiro_ativa
              ? 'Bênção do Trapaceiro ativada.'
              : 'Bênção do Trapaceiro encerrada.',
            'success'
          );
          break;

        case 'trapaca_invocar_duplicidade':
          if (!char.recursos.clerigo.subclasses.trapaca.invocar_duplicidade_ativa) {
            char.recursos.clerigo.canalizar_divindade_usos_gastos += 1;
            char.recursos.clerigo.subclasses.trapaca.invocar_duplicidade_ativa = true;
            toast('Invocar Duplicidade ativada.', 'success');
          } else {
            char.recursos.clerigo.subclasses.trapaca.invocar_duplicidade_ativa = false;
            toast('Invocar Duplicidade encerrada.', 'success');
          }
          break;

        case 'vida_preservar_vida':
          char.recursos.clerigo.canalizar_divindade_usos_gastos += 1;
          toast(`Preservar a Vida usado (pool de ${5 * (char.nivel || 1)} PV).`, 'success');
          break;

        default:
          return;
      }

      salvar();
      renderFichaCompleta();
    });
  });

  // Bruxo: subclasses interativas
  document.querySelectorAll('[data-bruxo-subclasse-acao]').forEach(el => {
    const handler = (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (char.classe !== 'Bruxo') return;
      const estado = getEstadoRecursosBruxo();
      if (!estado) return;
      const acao = el.dataset.bruxoSubclasseAcao;
      const sub = char.recursos.bruxo.subclasses;

      // Passos Feéricos
      if (acao === 'passos_feericos') {
        if (estado.passosFeericosDisponiveis <= 0) { toast('Sem usos de Passos Feéricos.', 'error'); return; }
        sub.arquifada.passos_feericos_usos_gastos += 1;
        toast(`Passos Feéricos! Teletransporte 9m. Restantes: ${estado.passosFeericosDisponiveis - 1}/${estado.passosFeericosMax}`, 'success');
      }
      // Fuga em Névoa
      if (acao === 'fuga_nevoa') {
        if (sub.arquifada.fuga_nevoa_usada) { toast('Fuga em Névoa já usada.', 'error'); return; }
        sub.arquifada.fuga_nevoa_usada = true;
        toast('Fuga em Névoa! Reação: Passo Nebuloso + efeito Desvanecedor ou Terrível.', 'success');
      }
      if (acao === 'fuga_nevoa_restaurar') {
        sub.arquifada.fuga_nevoa_usada = false;
        toast('Fuga em Névoa restaurada (Espaço de Pacto gasto).', 'success');
      }
      // Defesas Sedutoras
      if (acao === 'defesas_sedutoras') {
        if (sub.arquifada.defesas_sedutoras_usada) { toast('Defesas Sedutoras já usada.', 'error'); return; }
        sub.arquifada.defesas_sedutoras_usada = true;
        toast('Defesas Sedutoras! Atacante deve fazer salvaguarda Sabedoria ou ficar Enfeitiçado.', 'success');
      }
      if (acao === 'defesas_sedutoras_restaurar') {
        sub.arquifada.defesas_sedutoras_usada = false;
        toast('Defesas Sedutoras restaurada (Espaço de Pacto gasto).', 'success');
      }
      // Luz Medicinal
      if (acao === 'luz_medicinal') {
        if (estado.luzMedicinalDadosDisponiveis <= 0) { toast('Sem dados de Luz Medicinal.', 'error'); return; }
        sub.celestial.luz_medicinal_dados_gastos += 1;
        toast(`Luz Medicinal! d6 de cura usado. Restantes: ${estado.luzMedicinalDadosDisponiveis - 1}/${estado.luzMedicinalDadosMax}`, 'success');
      }
      // Vingança Calcinante
      if (acao === 'vinganca_calcinante') {
        if (sub.celestial.vinganca_calcinante_usada) { toast('Vingança Calcinante já usada.', 'error'); return; }
        sub.celestial.vinganca_calcinante_usada = true;
        const modCar = Math.max(1, calcMod(char.atributos.carisma));
        toast(`Vingança Calcinante! 2d8+${modCar} dano Radiante em criaturas a 9m.`, 'success');
      }
      // Combatente Clarividente
      if (acao === 'combatente_clarividente') {
        if (sub.grande_antigo.combatente_clarividente_usado) { toast('Combatente Clarividente já usado.', 'error'); return; }
        sub.grande_antigo.combatente_clarividente_usado = true;
        toast('Combatente Clarividente! Vantagem em todos os ataques neste turno.', 'success');
      }
      if (acao === 'combatente_clarividente_restaurar') {
        sub.grande_antigo.combatente_clarividente_usado = false;
        toast('Combatente Clarividente restaurado (Espaço de Pacto gasto).', 'success');
      }
      // Sorte do Tenebroso
      if (acao === 'sorte_tenebroso') {
        if (estado.sorteTenebrosoDisponiveis <= 0) { toast('Sem usos de Sorte do Tenebroso.', 'error'); return; }
        sub.infero.sorte_tenebroso_usos_gastos += 1;
        toast(`Sorte do Tenebroso! +1d10 ao resultado. Restantes: ${estado.sorteTenebrosoDisponiveis - 1}/${estado.sorteTenebrosoMax}`, 'success');
      }
      // Lançar no Inferno
      if (acao === 'lancar_inferno') {
        if (sub.infero.lancar_inferno_usado) { toast('Lançar no Inferno já usado.', 'error'); return; }
        sub.infero.lancar_inferno_usado = true;
        toast('Lançar no Inferno! Alvo faz salvaguarda Carisma: 8d10 Psíquico + 8d10 Ígneo.', 'success');
      }
      if (acao === 'lancar_inferno_restaurar') {
        sub.infero.lancar_inferno_usado = false;
        toast('Lançar no Inferno restaurado (Espaço de Pacto gasto).', 'success');
      }

      salvar();
      renderFichaCompleta();
    };
    // Selector para Resistência Ínfera
    if (el.tagName === 'SELECT') {
      el.addEventListener('change', (e) => {
        e.stopPropagation();
        if (char.classe !== 'Bruxo') return;
        const estado = getEstadoRecursosBruxo();
        if (!estado) return;
        char.recursos.bruxo.subclasses.infero.resistencia_infera_escolha = el.value;
        toast(`Resistência Ínfera: ${el.value || 'Nenhuma'}`, 'success');
        salvar();
        renderFichaCompleta();
      });
    } else {
      el.addEventListener('click', handler);
    }
  });

  // Guardião: subclasses interativas
  document.querySelectorAll('[data-guardiao-subclasse-acao]').forEach(el => {
    const handler = (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (char.classe !== 'Guardião') return;
      const estado = getEstadoRecursosGuardiao();
      if (!estado) return;
      const acao = el.dataset.guardiaoSubclasseAcao;
      const sub = char.recursos.guardiao.subclasses;

      // Reforços Feéricos
      if (acao === 'reforcos_feericos') {
        if (sub.andarilho.reforcos_feericos_usado) { toast('Reforços Feéricos já usado.', 'error'); return; }
        sub.andarilho.reforcos_feericos_usado = true;
        toast('Reforços Feéricos! Convocar Feérico sem slot, sem Material, sem Concentração (1 min).', 'success');
      }
      // Andarilho Nebuloso
      if (acao === 'andarilho_nebuloso') {
        if (estado.andarilhoNebulosoDisponiveis <= 0) { toast('Sem usos de Andarilho Nebuloso.', 'error'); return; }
        sub.andarilho.andarilho_nebuloso_usos_gastos += 1;
        toast(`Passo Nebuloso sem slot! Teleporte 9m + 1 criatura. Restantes: ${estado.andarilhoNebulosoDisponiveis - 1}/${estado.andarilhoNebulosoMax}`, 'success');
      }
      // Golpe Terrível
      if (acao === 'golpe_terrivel') {
        if (estado.golpeTerrivelDisponiveis <= 0) { toast('Sem usos de Golpe Terrível.', 'error'); return; }
        sub.vigilante.golpe_terrivel_usos_gastos += 1;
        const dano = (char.nivel || 1) >= 11 ? '2d8' : '2d6';
        toast(`Golpe Terrível! ${dano} Psíquico adicional. Restantes: ${estado.golpeTerrivelDisponiveis - 1}/${estado.golpeTerrivelMax}`, 'success');
      }

      salvar();
      renderFichaCompleta();
    };
    // SELECTs: presa, táticas, companheiro
    if (el.tagName === 'SELECT') {
      el.addEventListener('change', (e) => {
        e.stopPropagation();
        if (char.classe !== 'Guardião') return;
        const estado = getEstadoRecursosGuardiao();
        if (!estado) return;
        const acao = el.dataset.guardiaoSubclasseAcao;
        if (acao === 'presa_escolha') {
          char.recursos.guardiao.subclasses.cacador.presa_escolha = el.value;
          toast(`Presa do Caçador: ${el.value || 'Nenhuma'}`, 'success');
        }
        if (acao === 'taticas_escolha') {
          char.recursos.guardiao.subclasses.cacador.taticas_escolha = el.value;
          toast(`Táticas Defensivas: ${el.value || 'Nenhuma'}`, 'success');
        }
        if (acao === 'companheiro_tipo') {
          char.recursos.guardiao.subclasses.feras.companheiro_tipo = el.value;
          toast(`Companheiro Primal: ${el.value || 'Nenhum'}`, 'success');
        }
        salvar();
        renderFichaCompleta();
      });
    } else {
      el.addEventListener('click', handler);
    }
  });

  // Druida: subclasses interativas
  document.querySelectorAll('[data-druida-subclasse-acao]').forEach(el => {
    const handler = (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (char.classe !== 'Druida') return;
      const estado = getEstadoRecursosDruida();
      if (!estado) return;
      const acao = el.dataset.druidaSubclasseAcao;
      const sub = char.recursos.druida.subclasses;

      // Passo Lunar
      if (acao === 'passo_lunar') {
        if (estado.passoLunarDisponiveis <= 0) { toast('Sem usos de Passo Lunar.', 'error'); return; }
        sub.lua.passo_lunar_usos_gastos += 1;
        toast(`Passo Lunar! Teleporte 9m + Vantagem no próximo ataque. Restantes: ${estado.passoLunarDisponiveis - 1}/${estado.passoLunarMax}`, 'success');
      }
      if (acao === 'passo_lunar_restaurar') {
        if (estado.passoLunarDisponiveis >= estado.passoLunarMax) { toast('Passo Lunar já está completo.', 'error'); return; }
        sub.lua.passo_lunar_usos_gastos = Math.max(0, sub.lua.passo_lunar_usos_gastos - 1);
        toast('Passo Lunar restaurado (slot de 2º círculo+ gasto).', 'success');
      }
      // Recuperação Natural — magia grátis
      if (acao === 'recuperacao_magia') {
        if (sub.terra.recuperacao_natural_magia_usada) { toast('Magia de círculo grátis já usada.', 'error'); return; }
        sub.terra.recuperacao_natural_magia_usada = true;
        toast('Recuperação Natural — magia de círculo druídico conjurada sem slot!', 'success');
      }
      // Recuperação Natural — slots (desc curto)
      if (acao === 'recuperacao_slots') {
        if (sub.terra.recuperacao_natural_slots_usada) { toast('Recuperação de slots já usada neste descanso longo.', 'error'); return; }
        sub.terra.recuperacao_natural_slots_usada = true;
        const metadeNivel = Math.ceil((char.nivel || 1) / 2);
        toast(`Recuperação Natural — recupere até ${metadeNivel} círculos de slots (nenhum 6+). Marque manualmente nos slots.`, 'success');
      }
      // Mapa Estelar — Raio Guia grátis
      if (acao === 'mapa_estelar') {
        if (estado.mapaEstelarDisponiveis <= 0) { toast('Sem usos grátis de Raio Guia.', 'error'); return; }
        sub.estrelas.mapa_estelar_usos_gastos += 1;
        toast(`Raio Guia conjurado sem slot! Restantes: ${estado.mapaEstelarDisponiveis - 1}/${estado.mapaEstelarMax}`, 'success');
      }
      // Presságio Cósmico — usar reação
      if (acao === 'pressagio_usar') {
        if (estado.pressagioDisponiveis <= 0) { toast('Sem usos de Presságio Cósmico.', 'error'); return; }
        sub.estrelas.pressagio_cosmico_usos_gastos += 1;
        const tipo = estado.pressagioTipo === 'prosperidade' ? '+1d6' : estado.pressagioTipo === 'infortunio' ? '-1d6' : '1d6';
        toast(`Presságio Cósmico! Reação: ${tipo} ao teste. Restantes: ${estado.pressagioDisponiveis - 1}/${estado.pressagioMax}`, 'success');
      }

      salvar();
      renderFichaCompleta();
    };
    // SELECTs: constelação e tipo de presságio
    if (el.tagName === 'SELECT') {
      el.addEventListener('change', (e) => {
        e.stopPropagation();
        if (char.classe !== 'Druida') return;
        const estado = getEstadoRecursosDruida();
        if (!estado) return;
        const acao = el.dataset.druidaSubclasseAcao;
        if (acao === 'constelacao_escolha') {
          char.recursos.druida.subclasses.estrelas.constelacao_ativa = el.value;
          toast(`Constelação ativa: ${el.value || 'Nenhuma'}`, 'success');
        }
        if (acao === 'pressagio_tipo') {
          char.recursos.druida.subclasses.estrelas.pressagio_tipo = el.value;
          const label = el.value === 'prosperidade' ? 'Prosperidade (+1d6)' : el.value === 'infortunio' ? 'Infortúnio (-1d6)' : 'Nenhum';
          toast(`Presságio Cósmico: ${label}`, 'success');
        }
        salvar();
        renderFichaCompleta();
      });
    } else {
      el.addEventListener('click', handler);
    }
  });

  // Bardo: subclasses interativas (Glamour)
  document.querySelectorAll('[data-bardo-subclasse-acao]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (char.classe !== 'Bardo') return;
      if (!char.recursos) char.recursos = {};
      if (!char.recursos.bardo) char.recursos.bardo = {};
      if (!char.recursos.bardo.subclasses) char.recursos.bardo.subclasses = {};
      if (!char.recursos.bardo.subclasses.glamour) char.recursos.bardo.subclasses.glamour = {};

      const acao = btn.dataset.bardoSubclasseAcao;
      const glamour = char.recursos.bardo.subclasses.glamour;

      switch (acao) {
        case 'glamour_magia_fascinante':
          if (glamour.magia_fascinante_usada) {
            toast('Magia Fascinante já usada.', 'error');
            return;
          }
          glamour.magia_fascinante_usada = true;
          toast('Magia Fascinante ativada! Criaturas Enfeitiçadas por 1 minuto.', 'success');
          break;

        case 'glamour_magia_fascinante_restaurar': {
          // Gastar 1 uso de Inspiração Bárdica para restaurar
          const estadoInsp = getEstadoInspiracaoBardo();
          if (!estadoInsp || estadoInsp.usosDisponiveis <= 0) {
            toast('Sem usos de Inspiração Bárdica para restaurar.', 'error');
            return;
          }
          char.recursos.inspiracao_bardo_usos_gastos += 1;
          glamour.magia_fascinante_usada = false;
          toast('Magia Fascinante restaurada (1 uso de Inspiração gasto).', 'success');
          break;
        }

        case 'glamour_manto_majestade':
          if (glamour.manto_majestade_usado) {
            toast('Manto de Majestade já usado.', 'error');
            return;
          }
          glamour.manto_majestade_usado = true;
          toast('Manto de Majestade ativado por 1 minuto! Comando como Ação Bônus.', 'success');
          break;

        case 'glamour_majestade_inquebravel':
          if (glamour.majestade_inquebravel_usada) {
            toast('Majestade Inquebrável já usada.', 'error');
            return;
          }
          glamour.majestade_inquebravel_usada = true;
          toast('Majestade Inquebrável usada! Aparência restaurada + Santuário.', 'success');
          break;

        default:
          return;
      }

      salvar();
      renderFichaCompleta();
    });
  });

  document.querySelectorAll('[data-feiticeiro-acao]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (char.classe !== 'Feiticeiro') return;

      const estado = getEstadoRecursosFeiticeiro();
      if (!estado) return;
      const acao = btn.dataset.feiticeiroAcao;

      if (acao === 'ativar-feiticaria-inata') {
        if (estado.feiticariaInataUsosDisponiveis > 0) {
          char.recursos.feiticeiro.feiticaria_inata_usos_gastos += 1;
          char.recursos.feiticeiro.feiticaria_inata_ativa = true;
          toast('Feitiçaria Inata ativada por 1 minuto.', 'success');
        } else if ((char.nivel || 1) >= 7 && gastarPontosFeiticaria(2)) {
          char.recursos.feiticeiro.feiticaria_inata_ativa = true;
          toast('Feitiçaria Inata ativada com Feitiçaria Encarnada (-2 PF).', 'success');
        } else {
          toast('Sem usos de Feitiçaria Inata disponíveis.', 'error');
          return;
        }
      }

      if (acao === 'encerrar-feiticaria-inata') {
        char.recursos.feiticeiro.feiticaria_inata_ativa = false;
        toast('Feitiçaria Inata encerrada.', 'info');
      }

      if (acao === 'restauracao-feiticeira') {
        if ((char.nivel || 1) < 5) {
          toast('Restauração Feiticeira exige nível 5.', 'error');
          return;
        }
        if (char.recursos.feiticeiro.restauracao_feiticeira_usada) {
          toast('Restauração Feiticeira já foi usada neste descanso longo.', 'error');
          return;
        }
        const rec = Math.floor((char.nivel || 1) / 2);
        const recuperavel = Math.min(rec, estado.pontosMax - estado.pontosAtuais);
        if (recuperavel <= 0) {
          toast('Seus Pontos de Feitiçaria já estão no máximo.', 'info');
          return;
        }
        recuperarPontosFeiticaria(recuperavel);
        char.recursos.feiticeiro.restauracao_feiticeira_usada = true;
        toast(`Restauração Feiticeira recuperou ${recuperavel} PF.`, 'success');
      }

      if (acao === 'converter-slot-ponto') {
        abrirModal('Converter Slot em Pontos de Feitiçaria', `
          <div class="form-group">
            <label class="form-label" for="slot-para-pf">Círculo do espaço de magia</label>
            <select class="form-input" id="slot-para-pf">
              ${Object.keys(char.espacos_magia || {}).map(c => `<option value="${c}">${c}º círculo</option>`).join('')}
            </select>
          </div>
        `, '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-primary" id="btn-slot-para-pf">Converter</button>');

        document.getElementById('btn-slot-para-pf')?.addEventListener('click', () => {
          const c = parseInt(document.getElementById('slot-para-pf')?.value) || 1;
          const slot = char.espacos_magia?.[c];
          const estAtual = getEstadoRecursosFeiticeiro();
          if (!slot || (slot.usados || 0) >= (slot.total || 0)) {
            toast(`Sem espaço de ${c}º círculo disponível.`, 'error');
            return;
          }
          if (!estAtual || estAtual.pontosAtuais + c > estAtual.pontosMax) {
            toast('Conversão excede o máximo de Pontos de Feitiçaria.', 'error');
            return;
          }
          slot.usados += 1;
          recuperarPontosFeiticaria(c);
          salvar();
          window.fecharModal();
          toast(`Espaço de ${c}º círculo convertido em ${c} PF.`, 'success');
          renderFichaCompleta();
        });
        return;
      }

      if (acao === 'converter-ponto-slot') {
        const custos = { 1: 2, 2: 3, 3: 5, 4: 6, 5: 7 };
        abrirModal('Criar Espaço de Magia', `
          <div class="form-group">
            <label class="form-label" for="pf-para-slot">Círculo do espaço (máx. 5º)</label>
            <select class="form-input" id="pf-para-slot">
              ${[1, 2, 3, 4, 5].filter(c => (char.nivel || 1) >= (c === 1 ? 2 : c === 2 ? 3 : c === 3 ? 5 : c === 4 ? 7 : 9)).map(c => `<option value="${c}">${c}º círculo (custo ${custos[c]} PF)</option>`).join('')}
            </select>
          </div>
        `, '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-primary" id="btn-pf-para-slot">Criar</button>');

        document.getElementById('btn-pf-para-slot')?.addEventListener('click', () => {
          const c = parseInt(document.getElementById('pf-para-slot')?.value) || 1;
          const custo = custos[c] || 2;
          if (!gastarPontosFeiticaria(custo)) {
            toast('Pontos de Feitiçaria insuficientes.', 'error');
            return;
          }
          if (!char.espacos_magia[c]) char.espacos_magia[c] = { total: 0, usados: 0 };
          char.espacos_magia[c].total += 1;
          salvar();
          window.fecharModal();
          toast(`Espaço de ${c}º círculo criado por ${custo} PF.`, 'success');
          renderFichaCompleta();
        });
        return;
      }

      if (acao === 'metamagia-config') {
        // Opções de Metamagia com seletor visual
        const OPCOES_METAMAGIA = [
          { nome: 'Magia Acelerada', custo: 2, desc: 'Ao conjurar uma magia com tempo de 1 ação, gaste 2 PF para mudar para Ação Bônus.' },
          { nome: 'Magia Agravada', custo: 2, desc: 'Ao conjurar com teste de resistência, gaste 2 PF para dar Desvantagem na salvaguarda.' },
          { nome: 'Magia Buscadora', custo: 1, desc: 'Jogada de ataque com magia que erra: gaste 1 PF para re-jogar (deve usar o novo resultado).' },
          { nome: 'Magia Cautelosa', custo: 1, desc: 'Ao conjurar com salvaguarda, gaste 1 PF e escolha criaturas = mod. Car. que passam automaticamente.' },
          { nome: 'Magia Distante', custo: 1, desc: 'Magia com alcance 1,5m+: gaste 1 PF para dobrar. Alcance Toque vira 9m.' },
          { nome: 'Magia Duplicada', custo: 1, desc: 'Magia que mira apenas uma criatura e não tem auto-alcance: gaste 1 PF para mirar uma segunda.' },
          { nome: 'Magia Persistente', custo: 1, desc: 'Ao conjurar com Concentração e duração 1 min+: gaste 1 PF, não requer Concentração por 1 min.' },
          { nome: 'Magia Potencializada', custo: 1, desc: 'Ao rolar dano de magia: gaste 1 PF para re-jogar até mod. Car. dados de dano (deve usar novos).' },
          { nome: 'Magia Sutil', custo: 1, desc: 'Ao conjurar: gaste 1 PF para conjurar sem componentes Verbais ou Somáticos.' },
          { nome: 'Magia Transmutada', custo: 1, desc: 'Ao conjurar com dano: gaste 1 PF para trocar tipo de dano por Ácido/Elétrico/Gélido/Ígneo/Trovejante/Venenoso.' }
        ];
        const nivel = char.nivel || 1;
        const maxMeta = (nivel >= 17 ? 6 : nivel >= 10 ? 4 : 2);
        const metasSelecionadas = new Set(estado.metamagias || []);

        function renderMetaGrid(selSet) {
          let html = `<div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:8px">
            Selecionadas: <strong>${selSet.size}</strong> / ${maxMeta}
            ${selSet.size > maxMeta ? '<span style="color:var(--danger)"> (excedido!)</span>' : ''}
          </div>`;
          html += `<div class="magias-grid">${OPCOES_METAMAGIA.map(o => {
            const sel = selSet.has(o.nome);
            const cheio = selSet.size >= maxMeta && !sel;
            return `
              <div class="magia-card ${sel ? 'selecionada' : ''} ${cheio ? 'magia-card-bloqueada' : ''}"
                   data-meta-toggle="${o.nome}" style="${cheio ? 'opacity:0.35;' : 'cursor:pointer;'}">
                <span class="magia-card-check"></span>
                <div class="magia-card-nome">${o.nome}
                  <span class="btn-info-meta" data-meta-info="${o.nome}" title="Ver descricao" style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background:var(--secondary);color:#fff;font-size:0.7rem;font-weight:700;cursor:pointer;margin-left:4px;vertical-align:middle;flex-shrink:0;-webkit-tap-highlight-color:transparent">i</span>
                </div>
                <div class="magia-card-meta">
                  <span style="font-size:0.65rem">${o.custo} PF</span>
                </div>
              </div>`;
          }).join('')}</div>`;
          return html;
        }

        abrirModal('Opcoes de Metamagia', `
          <div id="metamagia-grid">${renderMetaGrid(metasSelecionadas)}</div>
          <div id="metamagia-desc" style="font-size:0.78rem;color:var(--text-muted);margin-top:8px;padding:8px 10px;border-radius:6px;background:var(--bg-card);border:1px solid var(--border-light);min-height:20px;display:none"></div>
        `, '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-primary" id="btn-salvar-metamagia">Salvar</button>');

        function attachMetaListeners() {
          document.querySelectorAll('[data-meta-toggle]').forEach(el => {
            el.addEventListener('click', () => {
              const nome = el.dataset.metaToggle;
              if (metasSelecionadas.has(nome)) {
                metasSelecionadas.delete(nome);
              } else {
                if (metasSelecionadas.size >= maxMeta) {
                  toast(`Limite de ${maxMeta} opções de Metamagia atingido.`, 'error');
                  return;
                }
                metasSelecionadas.add(nome);
              }
              document.getElementById('metamagia-grid').innerHTML = renderMetaGrid(metasSelecionadas);
              attachMetaListeners();
            });
          });
          // Botoes de informacao (i) para metamagia
          document.querySelectorAll('[data-meta-info]').forEach(btn => {
            btn.addEventListener('click', (e) => {
              e.stopPropagation();
              const nome = btn.dataset.metaInfo;
              const opcao = OPCOES_METAMAGIA.find(o => o.nome === nome);
              const descEl = document.getElementById('metamagia-desc');
              if (!opcao || !descEl) return;
              if (descEl.style.display !== 'none' && descEl.dataset.metaAtual === nome) {
                descEl.style.display = 'none';
                descEl.dataset.metaAtual = '';
                return;
              }
              descEl.innerHTML = `<strong>${opcao.nome}</strong> <span style="font-size:0.7rem;color:var(--secondary)">(${opcao.custo} PF)</span><br>${opcao.desc}`;
              descEl.style.display = 'block';
              descEl.dataset.metaAtual = nome;
            });
          });
        }
        attachMetaListeners();

        document.getElementById('btn-salvar-metamagia')?.addEventListener('click', () => {
          char.recursos.feiticeiro.metamagias = [...metasSelecionadas];
          salvar();
          window.fecharModal();
          renderFichaCompleta();
        });
        return;
      }

      if (acao === 'metamagia-gastar') {
        abrirModal('Gastar Pontos de Feitiçaria',
          numberPickerHtml('metamagia-custo', 1, 1, 20, 'Custo em PF'),
          '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-primary" id="btn-gastar-metamagia">Gastar</button>'
        );
        setupNumberPicker('metamagia-custo');

        document.getElementById('btn-gastar-metamagia')?.addEventListener('click', () => {
          const custo = Math.max(1, parseInt(document.getElementById('metamagia-custo-val')?.value) || 1);
          if (!gastarPontosFeiticaria(custo)) {
            toast('Pontos de Feitiçaria insuficientes.', 'error');
            return;
          }
          salvar();
          window.fecharModal();
          toast(`Metamagia usada (${custo} PF).`, 'success');
          renderFichaCompleta();
        });
        return;
      }

      if (acao === 'fala-telepatica') {
        char.recursos.feiticeiro.subclasses.aberrante.telepatia_ativa = true;
        char.recursos.feiticeiro.subclasses.aberrante.telepatia_duracao_min = char.nivel || 1;
        toast(`Fala Telepática ativada por ${char.nivel || 1} minuto(s).`, 'success');
      }

      if (acao === 'revelacao-carne') {
        abrirModal('Revelação em Carne',
          numberPickerHtml('revelacao-custo', 1, 1, 10, 'Pontos de Feitiçaria gastos'),
          '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-primary" id="btn-revelacao-carne">Ativar</button>'
        );
        setupNumberPicker('revelacao-custo');
        document.getElementById('btn-revelacao-carne')?.addEventListener('click', () => {
          const custo = Math.max(1, parseInt(document.getElementById('revelacao-custo-val')?.value) || 1);
          if (!gastarPontosFeiticaria(custo)) {
            toast('Pontos de Feitiçaria insuficientes.', 'error');
            return;
          }
          char.recursos.feiticeiro.subclasses.aberrante.revelacao_carne_ativa = true;
          salvar();
          window.fecharModal();
          toast(`Revelação em Carne ativada (${custo} benefício(s)).`, 'success');
          renderFichaCompleta();
        });
        return;
      }

      if (acao === 'afinidade-elemental') {
        abrirModal('Afinidade Elemental', `
          <div class="form-group">
            <label class="form-label" for="draconica-afinidade">Tipo de dano</label>
            <select class="form-input" id="draconica-afinidade">
              ${['Ácido', 'Elétrico', 'Gélido', 'Ígneo', 'Venenoso'].map(t => `<option value="${t}" ${(estado.subclasses.draconica.afinidade_elemental || '') === t ? 'selected' : ''}>${t}</option>`).join('')}
            </select>
          </div>
        `, '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-primary" id="btn-salvar-afinidade">Salvar</button>');
        document.getElementById('btn-salvar-afinidade')?.addEventListener('click', () => {
          char.recursos.feiticeiro.subclasses.draconica.afinidade_elemental = document.getElementById('draconica-afinidade')?.value || '';
          salvar();
          window.fecharModal();
          renderFichaCompleta();
        });
        return;
      }

      if (acao === 'ativar-asas-dragao') {
        const dr = char.recursos.feiticeiro.subclasses.draconica;
        if (!dr.asas_usada_desde_descanso) {
          dr.asas_usada_desde_descanso = true;
          dr.asas_ativas = true;
          toast('Asas de Dragão ativadas.', 'success');
        } else if (gastarPontosFeiticaria(3)) {
          dr.asas_ativas = true;
          toast('Asas de Dragão restauradas com 3 PF.', 'success');
        } else {
          toast('Sem uso disponível e PF insuficientes (3 PF).', 'error');
          return;
        }
      }

      if (acao === 'desativar-asas-dragao') {
        char.recursos.feiticeiro.subclasses.draconica.asas_ativas = false;
        toast('Asas de Dragão recolhidas.', 'info');
      }

      if (acao === 'companheiro-draconico') {
        const dr = char.recursos.feiticeiro.subclasses.draconica;
        if (dr.companheiro_draconico_usado) {
          toast('Companheiro Dracônico já foi usado neste descanso longo.', 'error');
          return;
        }
        dr.companheiro_draconico_usado = true;
        toast('Companheiro Dracônico usado: Invocar Dragão sem gasto de espaço.', 'success');
      }

      if (acao === 'restaurar-equilibrio') {
        const mec = char.recursos.feiticeiro.subclasses.mecanica;
        const max = Math.max(1, calcMod(char.atributos.carisma));
        if ((mec.restaurar_equilibrio_usos_gastos || 0) >= max) {
          toast('Sem usos de Restaurar Equilíbrio.', 'error');
          return;
        }
        mec.restaurar_equilibrio_usos_gastos += 1;
        toast('Restaurar Equilíbrio usado.', 'success');
      }

      if (acao === 'bastiao-lei') {
        abrirModal('Bastião da Lei',
          numberPickerHtml('bastiao-custo', 1, 1, 5, 'PF gastos (1 a 5)'),
          '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-primary" id="btn-bastiao-lei">Criar</button>'
        );
        setupNumberPicker('bastiao-custo');
        document.getElementById('btn-bastiao-lei')?.addEventListener('click', () => {
          const custo = Math.max(1, Math.min(5, parseInt(document.getElementById('bastiao-custo-val')?.value) || 1));
          if (!gastarPontosFeiticaria(custo)) {
            toast('Pontos de Feitiçaria insuficientes.', 'error');
            return;
          }
          char.recursos.feiticeiro.subclasses.mecanica.bastiao_dados = custo;
          salvar();
          window.fecharModal();
          toast(`Bastião da Lei criado com ${custo}d8.`, 'success');
          renderFichaCompleta();
        });
        return;
      }

      if (acao === 'ativar-transe-ordem') {
        const mec = char.recursos.feiticeiro.subclasses.mecanica;
        if (!mec.transe_ordem_usado_desde_descanso) {
          mec.transe_ordem_usado_desde_descanso = true;
          mec.transe_ordem_ativo = true;
          toast('Transe da Ordem ativado.', 'success');
        } else if (gastarPontosFeiticaria(5)) {
          mec.transe_ordem_ativo = true;
          toast('Transe da Ordem reativado com 5 PF.', 'success');
        } else {
          toast('Sem uso disponível e PF insuficientes (5 PF).', 'error');
          return;
        }
      }

      if (acao === 'desativar-transe-ordem') {
        char.recursos.feiticeiro.subclasses.mecanica.transe_ordem_ativo = false;
        toast('Transe da Ordem encerrado.', 'info');
      }

      if (acao === 'mares-caos') {
        const sel = char.recursos.feiticeiro.subclasses.selvagem;
        if (!sel.mares_caos_disponivel) {
          toast('Marés do Caos indisponível até conjurar magia com espaço ou descanso longo.', 'error');
          return;
        }
        sel.mares_caos_disponivel = false;
        toast('Marés do Caos usado. A próxima magia com espaço ativa surto automático e recarrega Marés do Caos.', 'success');
      }

      if (acao === 'distorcer-sorte') {
        if (!gastarPontosFeiticaria(1)) {
          toast('Pontos de Feitiçaria insuficientes.', 'error');
          return;
        }
        toast('Distorcer a Sorte usado (-1 PF).', 'success');
      }

      if (acao === 'surto-controlado') {
        const sel = char.recursos.feiticeiro.subclasses.selvagem;
        if (sel.surto_controlado_usado) {
          toast('Surto Controlado já usado neste descanso longo.', 'error');
          return;
        }
        sel.surto_controlado_usado = true;
        toast('Surto Controlado marcado como usado.', 'success');
      }

      if (acao === 'surto-resolvido') {
        char.recursos.feiticeiro.subclasses.selvagem.surto_pendente_automatico = false;
        toast('Surto de Magia Selvagem marcado como resolvido.', 'success');
      }

      salvar();
      renderFichaCompleta();
    });
  });

  // Inspiração de Bardo (recurso de classe)
  document.querySelectorAll('[data-inspiracao-acao]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (char.classe !== 'Bardo') return;
      if (!char.recursos) char.recursos = {};
      if (typeof char.recursos.inspiracao_bardo_usos_gastos !== 'number') {
        char.recursos.inspiracao_bardo_usos_gastos = 0;
      }

      const acao = btn.dataset.inspiracaoAcao;
      const modCar = calcMod(char.atributos.carisma);
      const usosMax = Math.max(1, modCar);

      if (acao === 'usar') {
        if (char.recursos.inspiracao_bardo_usos_gastos >= usosMax) {
          toast('Sem usos de Inspiração de Bardo disponíveis.', 'error');
          return;
        }
        char.recursos.inspiracao_bardo_usos_gastos += 1;
        toast('Inspiração de Bardo consumida.', 'success');
      }

      if (acao === 'iniciativa' && (char.nivel || 1) >= 18) {
        const usosAtuais = Math.max(0, usosMax - char.recursos.inspiracao_bardo_usos_gastos);
        const alvo = Math.min(2, usosMax);
        if (usosAtuais < alvo) {
          char.recursos.inspiracao_bardo_usos_gastos = usosMax - alvo;
          toast('Inspiração Superior aplicada ao rolar iniciativa.', 'success');
        } else {
          toast('Você já possui 2 ou mais usos disponíveis.', 'info');
        }
      }

      salvar();
      renderFichaCompleta();
    });
  });

  document.querySelectorAll('[data-bruxo-astucia-acao]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();

      if (char.classe !== 'Bruxo') return;
      const estado = getEstadoRecursosBruxo();
      if (!estado) return;
      if (estado.astuciaUsada) {
        toast('Astúcia Mágica já foi usada até o próximo descanso longo.', 'error');
        return;
      }

      const recuperados = recuperarEspacosMagiaBruxo(true);
      if (recuperados <= 0) {
        toast('Nenhum espaço de Magia de Pacto gasto para recuperar.', 'error');
        return;
      }

      char.recursos.bruxo.astucia_usada = true;
      salvar();
      toast(`Astúcia Mágica recuperou ${recuperados} espaço(s) de Magia de Pacto.`, 'success');
      renderFichaCompleta();
    });
  });

  document.querySelectorAll('[data-bruxo-arcanum-toggle]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (char.classe !== 'Bruxo') return;
      const circ = parseInt(btn.dataset.bruxoArcanumToggle);
      if (!circ || ![6, 7, 8, 9].includes(circ)) return;
      const estado = getEstadoRecursosBruxo();
      if (!estado?.circulosArcanum.includes(circ)) return;
      if (!char.recursos.bruxo.arcanum[circ]) char.recursos.bruxo.arcanum[circ] = { magia: '', usado: false };
      char.recursos.bruxo.arcanum[circ].usado = !char.recursos.bruxo.arcanum[circ].usado;
      salvar();
      renderFichaCompleta();
    });
  });

  document.querySelectorAll('[data-bruxo-recursos]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      abrirModalRecursosBruxo();
    });
  });

  // Gerenciar selecoes do Pacto do Tomo
  document.querySelectorAll('[data-pacto-tomo-gerenciar]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      abrirModalPactoDoTomo();
    });
  });

  // Conjurar magias de Pacto (sem gastar espaco)
  document.querySelectorAll('[data-conjurar-pacto]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const nomeMagia = btn.dataset.conjurarPacto;
      toast(`${nomeMagia} conjurada (via Pacto, sem gastar espaco).`, 'success');
    });
  });

  document.querySelectorAll('[data-druida-forma-acao]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (char.classe !== 'Druida') return;

      const acao = btn.dataset.druidaFormaAcao;
      const estado = getEstadoRecursosDruida();
      if (!estado) return;

      if (acao === 'ativar') {
        if (!consumirUsoFormaSelvagem(1)) {
          toast('Sem usos de Forma Selvagem disponíveis.', 'error');
          return;
        }
        char.recursos.druida.forma_selvagem_ativa = true;
        toast('Forma Selvagem ativada.', 'success');
      } else {
        char.recursos.druida.forma_selvagem_ativa = false;
        toast('Forma Selvagem encerrada.', 'success');
      }

      salvar();
      renderFichaCompleta();
    });
  });

  document.querySelectorAll('[data-druida-companheiro-acao]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (char.classe !== 'Druida') return;

      const estado = getEstadoRecursosDruida();
      if (!estado) return;

      if (estado.companheiroSelvagemAtivo) {
        char.recursos.druida.companheiro_selvagem_ativo = false;
        toast('Companheiro Selvagem dispensado.', 'success');
        salvar();
        renderFichaCompleta();
        return;
      }

      if (consumirUsoFormaSelvagem(1)) {
        char.recursos.druida.companheiro_selvagem_ativo = true;
        toast('Companheiro Selvagem invocado (consumiu 1 uso de Forma Selvagem).', 'success');
      } else {
        const circulo = consumirEspacoMagiaDisponivel(1);
        if (!circulo) {
          toast('Sem uso de Forma Selvagem ou espaço de magia disponível para invocar o companheiro.', 'error');
          return;
        }
        char.recursos.druida.companheiro_selvagem_ativo = true;
        toast(`Companheiro Selvagem invocado (consumiu 1 espaço de ${circulo}º círculo).`, 'success');
      }

      salvar();
      renderFichaCompleta();
    });
  });

  document.querySelectorAll('[data-druida-ressurgimento-acao]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (char.classe !== 'Druida' || (char.nivel || 1) < 5) return;

      const estado = getEstadoRecursosDruida();
      if (!estado) return;
      const acao = btn.dataset.druidaRessurgimentoAcao;

      if (acao === 'recuperar-forma') {
        if (estado.usosDisponiveis > 0) {
          toast('Você ainda tem usos de Forma Selvagem disponíveis.', 'error');
          return;
        }
        const circuloConsumido = consumirEspacoMagiaDisponivel(1);
        if (!circuloConsumido) {
          toast('Nenhum espaço de magia disponível para recuperar Forma Selvagem.', 'error');
          return;
        }
        char.recursos.druida.forma_selvagem_usos_gastos = Math.max(0, char.recursos.druida.forma_selvagem_usos_gastos - 1);
        toast(`Ressurgimento Selvagem: recuperou 1 uso de Forma Selvagem (gasto de espaço ${circuloConsumido}º).`, 'success');
      }

      if (acao === 'recuperar-slot') {
        if (estado.ressurgimentoSlotRecuperadoHoje) {
          toast('Você já recuperou um espaço de 1º círculo com Ressurgimento neste descanso longo.', 'error');
          return;
        }
        if (!consumirUsoFormaSelvagem(1)) {
          toast('Sem usos de Forma Selvagem disponíveis para converter.', 'error');
          return;
        }
        if (!recuperarEspacoMagia(1)) {
          char.recursos.druida.forma_selvagem_usos_gastos = Math.max(0, char.recursos.druida.forma_selvagem_usos_gastos - 1);
          toast('Nenhum espaço de 1º círculo gasto para recuperar.', 'error');
          return;
        }
        char.recursos.druida.ressurgimento_slot_recuperado_hoje = true;
        toast('Ressurgimento Selvagem: espaço de 1º círculo recuperado.', 'success');
      }

      salvar();
      renderFichaCompleta();
    });
  });

  document.querySelectorAll('[data-druida-iniciativa]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (char.classe !== 'Druida' || (char.nivel || 1) < 20) return;
      const estado = getEstadoRecursosDruida();
      if (!estado) return;
      if (estado.usosDisponiveis > 0) {
        toast('Arquidruida só recupera uso ao rolar iniciativa se você não tiver usos restantes.', 'info');
        return;
      }
      char.recursos.druida.forma_selvagem_usos_gastos = Math.max(0, char.recursos.druida.forma_selvagem_usos_gastos - 1);
      salvar();
      toast('Arquidruida: 1 uso de Forma Selvagem recuperado ao rolar iniciativa.', 'success');
      renderFichaCompleta();
    });
  });

  document.querySelectorAll('[data-guardiao-acao]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (char.classe !== 'Guardião') return;

      const estado = getEstadoRecursosGuardiao();
      if (!estado) return;
      const acao = btn.dataset.guardiaoAcao;

      if (acao === 'usar-marca') {
        if (estado.inimigoFavoritoDisponiveis <= 0) {
          toast('Sem usos de Inimigo Favorito disponíveis.', 'error');
          return;
        }
        char.recursos.guardiao.inimigo_favorito_usos_gastos += 1;
        char.recursos.guardiao.marca_predador_ativa = true;
        toast('Marca do Predador ativada sem gastar espaço de magia.', 'success');
      }

      if (acao === 'encerrar-marca') {
        char.recursos.guardiao.marca_predador_ativa = false;
        toast('Marca do Predador encerrada.', 'info');
      }

      if (acao === 'incansavel') {
        if (!estado.incansavelAtivo) return;
        if (estado.incansavelDisponiveis <= 0) {
          toast('Sem usos de Incansável disponíveis.', 'error');
          return;
        }
        abrirModal('Incansável',
          numberPickerHtml('input-guardiao-incansavel', 1, 1, 8, 'Resultado do d8') +
          `<div style="font-size:0.8rem;color:var(--text-muted);margin-top:6px;text-align:center">PV temporário = d8 + Sabedoria (${fmtMod(calcMod(char.atributos.sabedoria))})</div>`,
          '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-primary" id="btn-aplicar-incansavel">Aplicar</button>'
        );
        setupNumberPicker('input-guardiao-incansavel');
        document.getElementById('btn-aplicar-incansavel')?.addEventListener('click', () => {
          const d8 = parseInt(document.getElementById('input-guardiao-incansavel-val')?.value) || 1;
          const temp = Math.max(1, d8 + calcMod(char.atributos.sabedoria));
          char.pv_temporario = Math.max(char.pv_temporario || 0, temp);
          char.recursos.guardiao.incansavel_usos_gastos += 1;
          salvar();
          window.fecharModal();
          toast(`Incansável aplicado: ${temp} PV temporários.`, 'success');
          renderFichaCompleta();
        });
        return;
      }

      if (acao === 'veu') {
        if (!estado.veuNaturezaAtivo) return;
        if (estado.veuNaturezaDisponiveis <= 0) {
          toast('Sem usos de Véu da Natureza disponíveis.', 'error');
          return;
        }
        char.recursos.guardiao.veu_natureza_usos_gastos += 1;
        toast('Véu da Natureza usado (Invisível até o final do próximo turno).', 'success');
      }

      salvar();
      renderFichaCompleta();
    });
  });

  // Recursos do Guerreiro: Recuperar Fôlego, Surto de Ação, Indomável
  // Handler: Paladino
  document.querySelectorAll('[data-paladino-acao]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (char.classe !== 'Paladino') return;
      const estado = getEstadoRecursosPaladino();
      if (!estado) return;
      const acao = btn.dataset.paladinoAcao;

      if (acao === 'maos-consagradas') {
        if (estado.maosAtuais <= 0) {
          toast('Reserva de Mãos Consagradas esgotada.', 'error');
          return;
        }
        // Abrir modal para definir quantidade de PV a usar
        abrirModal('Mãos Consagradas', `
          <div class="info-box info" style="margin-bottom:12px">
            Reserva disponível: <strong>${estado.maosAtuais} PV</strong> de ${estado.maosMax}
          </div>
          ` + numberPickerHtml('maos-consagradas-qtd', 1, 1, estado.maosAtuais, 'Quantidade de PV a restaurar') + `
          <div style="font-size:0.8rem;color:var(--text-muted)">
            Remover Envenenado: gasta 5 PV da reserva sem restaurar PV.
            ${estado.toqueRestauradorAtivo ? '<br>Toque Restaurador: remover condição por 5 PV adicionais.' : ''}
          </div>
        `, `
          <button class="btn btn-secondary" onclick="window.fecharModal()">Cancelar</button>
          <button class="btn btn-accent" id="btn-maos-confirmar">Curar</button>
          <button class="btn btn-primary" id="btn-maos-envenenado" ${estado.maosAtuais < 5 ? 'disabled style="opacity:0.5"' : ''}>Remover Envenenado (5 PV)</button>
        `);
        setupNumberPicker('maos-consagradas-qtd');
        document.getElementById('btn-maos-confirmar')?.addEventListener('click', () => {
          const qtd = Math.min(parseInt(document.getElementById('maos-consagradas-qtd-val')?.value) || 1, estado.maosAtuais);
          char.recursos.paladino.maos_consagradas_gastos += qtd;
          toast(`Mãos Consagradas: ${qtd} PV de cura aplicados.`, 'success');
          salvar();
          window.fecharModal();
          renderFichaCompleta();
        });
        document.getElementById('btn-maos-envenenado')?.addEventListener('click', () => {
          if (estado.maosAtuais < 5) return;
          char.recursos.paladino.maos_consagradas_gastos += 5;
          toast('Condição Envenenado removida (5 PV gastos da reserva).', 'success');
          salvar();
          window.fecharModal();
          renderFichaCompleta();
        });
        return;
      }

      if (acao === 'canalizar') {
        if (estado.canalizarDisponiveis <= 0) {
          toast('Sem usos de Canalizar Divindade disponíveis.', 'error');
          return;
        }
        char.recursos.paladino.canalizar_divindade_usos_gastos += 1;
        toast('Canalizar Divindade usado! Sentido Divino ou opção de subclasse ativado.', 'success');
      }

      if (acao === 'destruicao-gratuita') {
        if (estado.destruicaoGratuitaUsada) {
          toast('Destruição gratuita já usada neste descanso.', 'error');
          return;
        }
        char.recursos.paladino.destruicao_gratuita_usada = true;
        toast('Destruição Divina conjurada sem gastar espaço de magia!', 'success');
      }

      salvar();
      renderFichaCompleta();
    });
  });

  // Handler: Paladino subclasses (Glória, Vingança, Anciões)
  document.querySelectorAll('[data-paladino-subclasse-acao]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (char.classe !== 'Paladino') return;
      const estado = getEstadoRecursosPaladino();
      if (!estado) return;
      if (!char.recursos.paladino.subclasses) char.recursos.paladino.subclasses = {};

      const acao = btn.dataset.paladinoSubclasseAcao;

      // Ações que consomem Canalizar Divindade
      const usaCanalizar = [
        'gloria_atleta', 'gloria_destruicao_inspiradora',
        'vinganca_voto_inimizade', 'ancioes_ira_natureza'
      ].includes(acao);

      if (usaCanalizar && estado.canalizarDisponiveis <= 0) {
        toast('Sem usos de Canalizar Divindade disponíveis.', 'error');
        return;
      }

      switch (acao) {
        // === Glória ===
        case 'gloria_atleta':
          char.recursos.paladino.canalizar_divindade_usos_gastos += 1;
          toast('Atleta Inigualável ativado! 10min: Vantagem em Acrobacia/Atletismo + salto longo sem corrida.', 'success');
          break;

        case 'gloria_destruicao_inspiradora': {
          char.recursos.paladino.canalizar_divindade_usos_gastos += 1;
          const nivel = char.nivel || 1;
          const dReforco = nivel >= 11 ? '2d6' : '1d6';
          toast(`Destruição Inspiradora usada! Aliados atacantes causam +${dReforco} Radiante no turno extra.`, 'success');
          break;
        }

        case 'gloria_defesa_gloriosa': {
          if (!char.recursos.paladino.subclasses.gloria) char.recursos.paladino.subclasses.gloria = {};
          const modCar = calcMod(char.atributos.carisma);
          const maxUsos = Math.max(1, modCar);
          const gastos = char.recursos.paladino.subclasses.gloria.defesa_gloriosa_usos_gastos || 0;
          if (gastos >= maxUsos) {
            toast('Sem usos de Defesa Gloriosa disponíveis.', 'error');
            return;
          }
          char.recursos.paladino.subclasses.gloria.defesa_gloriosa_usos_gastos = gastos + 1;
          toast('Defesa Gloriosa usada! Reação: +mod CAR à CA ou aliado ganha PV temp.', 'success');
          break;
        }

        case 'gloria_lenda_viva': {
          if (!char.recursos.paladino.subclasses.gloria) char.recursos.paladino.subclasses.gloria = {};
          if (char.recursos.paladino.subclasses.gloria.lenda_viva_usada) {
            toast('Lenda Viva já usada.', 'error');
            return;
          }
          char.recursos.paladino.subclasses.gloria.lenda_viva_usada = true;
          toast('Lenda Viva ativada! 1min: Emanação 3m, Vantagem ataques/salvaguardas de aliados + Desvantagem contra eles.', 'success');
          break;
        }

        // === Vingança ===
        case 'vinganca_voto_inimizade':
          char.recursos.paladino.canalizar_divindade_usos_gastos += 1;
          toast('Voto de Inimizade ativado! 1min: Vantagem em ataques contra alvo inimigo.', 'success');
          break;

        case 'vinganca_anjo_vingador': {
          if (!char.recursos.paladino.subclasses.vinganca) char.recursos.paladino.subclasses.vinganca = {};
          if (char.recursos.paladino.subclasses.vinganca.anjo_vingador_usado) {
            toast('Anjo Vingador já usado.', 'error');
            return;
          }
          char.recursos.paladino.subclasses.vinganca.anjo_vingador_usado = true;
          toast('Anjo Vingador ativado! 10min: Voo 18m + Emanação 9m de Amedrontar.', 'success');
          break;
        }

        // === Anciões ===
        case 'ancioes_ira_natureza':
          char.recursos.paladino.canalizar_divindade_usos_gastos += 1;
          toast('Ira da Natureza usada! Vinhas prendem criaturas em área de 4,5m (Vines of Constraint).', 'success');
          break;

        case 'ancioes_sentinela_imortal': {
          if (!char.recursos.paladino.subclasses.ancioes) char.recursos.paladino.subclasses.ancioes = {};
          if (char.recursos.paladino.subclasses.ancioes.sentinela_imortal_usada) {
            toast('Sentinela Imortal já usada.', 'error');
            return;
          }
          const nivel = char.nivel || 1;
          const cura = 3 * nivel;
          char.recursos.paladino.subclasses.ancioes.sentinela_imortal_usada = true;
          char.pv_atual = Math.min(1, char.pv_atual) || 1;
          toast(`Sentinela Imortal! Ao cair a 0 PV: fica com 1 PV + conjure Cura de Ferimentos (${cura} PV) sem gastar slot.`, 'success');
          break;
        }

        case 'ancioes_campeao_ancestral': {
          if (!char.recursos.paladino.subclasses.ancioes) char.recursos.paladino.subclasses.ancioes = {};
          if (char.recursos.paladino.subclasses.ancioes.campeao_ancestral_usado) {
            toast('Campeão Ancestral já usado.', 'error');
            return;
          }
          char.recursos.paladino.subclasses.ancioes.campeao_ancestral_usado = true;
          toast('Campeão Ancestral ativado! 1min: Desv. salvaguardas de inimigos, magias como Bônus, +10 PV por turno.', 'success');
          break;
        }

        default:
          return;
      }

      salvar();
      renderFichaCompleta();
    });
  });

  // Handler: Monge
  document.querySelectorAll('[data-monge-acao]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (char.classe !== 'Monge') return;
      const estado = getEstadoRecursosMonge();
      if (!estado) return;
      const acao = btn.dataset.mongeAcao;

      if (acao === 'gastar-ponto') {
        if (estado.pontosAtuais <= 0) {
          toast('Sem Pontos de Foco disponíveis.', 'error');
          return;
        }
        char.recursos.monge.pontos_foco_gastos += 1;
        toast(`Ponto de Foco gasto. Restantes: ${estado.pontosAtuais - 1}/${estado.pontosMax}`, 'success');
      }

      if (acao === 'golpe-atordoante') {
        if (estado.pontosAtuais <= 0) {
          toast('Sem Pontos de Foco para Golpe Atordoante.', 'error');
          return;
        }
        char.recursos.monge.pontos_foco_gastos += 1;
        toast(`Golpe Atordoante! Alvo faz salvaguarda de Constituição CD ${estado.cdFoco}. Restantes: ${estado.pontosAtuais - 1}/${estado.pontosMax}`, 'success');
      }

      if (acao === 'metabolismo') {
        if (estado.metabolismoUsado) {
          toast('Metabolismo Incomum já usado neste descanso.', 'error');
          return;
        }
        // Restaurar todos os pontos de foco
        char.recursos.monge.pontos_foco_gastos = 0;
        char.recursos.monge.metabolismo_usado = true;
        const cura = `${char.nivel || 1} + 1d${estado.dadoArtesMarciais}`;
        toast(`Metabolismo Incomum ativado! Pontos de Foco restaurados. Cura: ${cura} PV.`, 'success');
      }

      salvar();
      renderFichaCompleta();
    });
  });

  // Monge: subclasses
  document.querySelectorAll('[data-monge-subclasse-acao]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (char.classe !== 'Monge') return;
      const estado = getEstadoRecursosMonge();
      if (!estado) return;
      const acao = el.dataset.mongeSubclasseAcao;
      const sub = char.subclasse || '';

      // Mão Espalmada
      if (sub === 'Combatente da Mão Espalmada' && char.recursos.monge.subclasses?.mao_espalmada) {
        const s = char.recursos.monge.subclasses.mao_espalmada;
        if (acao === 'integridade_usar') {
          if (estado.integridadeDisponiveis <= 0) {
            toast('Sem usos de Integridade Corporal disponíveis.', 'error');
            return;
          }
          s.integridade_usos_gastos += 1;
          toast(`Integridade Corporal: cure 1d${estado.dadoArtesMarciais} + mod SAB PV! Restantes: ${estado.integridadeDisponiveis - 1}/${estado.integridadeMax}`, 'success');
        }
        if (acao === 'palma_ativar') {
          if (estado.pontosAtuais < 4) {
            toast('Pontos de Foco insuficientes (necessário 4).', 'error');
            return;
          }
          char.recursos.monge.pontos_foco_gastos += 4;
          s.palma_vibrante_ativa = true;
          toast('Palma Vibrante ativada! Vibrações imperceptíveis iniciadas no alvo.', 'success');
        }
        if (acao === 'palma_encerrar') {
          s.palma_vibrante_ativa = false;
          toast(`Palma Vibrante encerrada! Alvo faz salvaguarda de Constituição CD ${estado.cdFoco} — 10d12 Energético em falha.`, 'warning');
        }
        if (acao === 'palma_cancelar') {
          s.palma_vibrante_ativa = false;
          toast('Vibrações encerradas inofensivamente.', 'info');
        }
      }

      // Misericórdia
      if (sub === 'Combatente da Misericórdia' && char.recursos.monge.subclasses?.misericordia) {
        const s = char.recursos.monge.subclasses.misericordia;
        if (acao === 'torrente_usar') {
          if (estado.torrenteDisponiveis <= 0) {
            toast('Sem usos de Torrente de Cura e Dolo disponíveis.', 'error');
            return;
          }
          s.torrente_usos_gastos += 1;
          toast(`Torrente de Cura e Dolo: Cura/Dolo grátis na Torrente de Golpes! Restantes: ${estado.torrenteDisponiveis - 1}/${estado.torrenteMax}`, 'success');
        }
        if (acao === 'misericordia_final') {
          if (s.misericordia_final_usada) {
            toast('Mão da Misericórdia Final já usada neste descanso.', 'error');
            return;
          }
          if (estado.pontosAtuais < 5) {
            toast('Pontos de Foco insuficientes (necessário 5).', 'error');
            return;
          }
          char.recursos.monge.pontos_foco_gastos += 5;
          s.misericordia_final_usada = true;
          toast('Mão da Misericórdia Final! Criatura revivida com 4d10 + mod SAB PV.', 'success');
        }
      }

      // Elementos
      if (sub === 'Combatente dos Elementos' && char.recursos.monge.subclasses?.elementos) {
        const s = char.recursos.monge.subclasses.elementos;
        if (acao === 'sintonia_toggle') {
          if (s.sintonia_ativa) {
            s.sintonia_ativa = false;
            toast('Sintonia Elemental desativada.', 'info');
          } else {
            if (estado.pontosAtuais < 1) {
              toast('Sem Pontos de Foco disponíveis.', 'error');
              return;
            }
            char.recursos.monge.pontos_foco_gastos += 1;
            s.sintonia_ativa = true;
            toast(`Sintonia Elemental ativada! Ataques Elementais + Extensão 3m por 10 min. PF restantes: ${estado.pontosAtuais - 1}`, 'success');
          }
        }
      }

      salvar();
      renderFichaCompleta();
    });
  });

  // Handler: Ladino
  document.querySelectorAll('[data-ladino-acao]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (char.classe !== 'Ladino') return;
      const estado = getEstadoRecursosLadino();
      if (!estado) return;
      const acao = btn.dataset.ladinoAcao;

      if (acao === 'golpe-sorte') {
        if (estado.golpeSorteUsado) {
          toast('Golpe de Sorte já usado neste descanso.', 'error');
          return;
        }
        char.recursos.ladino.golpe_sorte_usado = true;
        toast('Golpe de Sorte usado! O resultado do Teste de D20 se torna 20.', 'success');
      }

      // --- Adaga Espiritual ---
      if (acao === 'gastar-dado-psionico') {
        if (estado.dadosPsionicosDisponiveisL <= 0) {
          toast('Sem Dados de Energia Psiônica disponíveis.', 'error');
          return;
        }
        char.recursos.ladino.subclasses.adaga_espiritual.dados_psionicos_gastos += 1;
        toast(`Dado de Energia Psiônica gasto! (${estado.tipoDadoPsionicoL})`, 'success');
      }

      if (acao === 'sussurros') {
        if (estado.sussurrosGratisUsado) {
          if (estado.dadosPsionicosDisponiveisL <= 0) {
            toast('Sem Dados de Energia Psiônica para Sussurros Psíquicos.', 'error');
            return;
          }
          char.recursos.ladino.subclasses.adaga_espiritual.dados_psionicos_gastos += 1;
          toast(`Sussurros Psíquicos ativados! Role 1${estado.tipoDadoPsionicoL} = horas de telepatia (dado gasto).`, 'success');
        } else {
          char.recursos.ladino.subclasses.adaga_espiritual.sussurros_gratis_usado = true;
          toast(`Sussurros Psíquicos ativados gratuitamente! Role 1${estado.tipoDadoPsionicoL} = horas de telepatia.`, 'success');
        }
      }

      if (acao === 'teleporte-psiquico') {
        if (estado.dadosPsionicosDisponiveisL <= 0) {
          toast('Sem Dados de Energia Psiônica para Teleporte Psíquico.', 'error');
          return;
        }
        char.recursos.ladino.subclasses.adaga_espiritual.dados_psionicos_gastos += 1;
        toast(`Teleporte Psíquico! Role 1${estado.tipoDadoPsionicoL} x 3 = metros de teleporte.`, 'success');
      }

      if (acao === 'veu-psiquico') {
        if (estado.veuPsiquicoUsado) {
          if (estado.dadosPsionicosDisponiveisL <= 0) {
            toast('Sem Dados de Energia Psiônica para recuperar Véu Psíquico.', 'error');
            return;
          }
          char.recursos.ladino.subclasses.adaga_espiritual.dados_psionicos_gastos += 1;
          char.recursos.ladino.subclasses.adaga_espiritual.veu_psiquico_usado = false;
          toast('Véu Psíquico recuperado gastando 1 dado!', 'success');
        } else {
          char.recursos.ladino.subclasses.adaga_espiritual.veu_psiquico_usado = true;
          toast('Véu Psíquico ativado! Invisível por 1 hora (encerra ao causar dano ou forçar salvaguarda).', 'success');
        }
      }

      if (acao === 'rasgar-mente') {
        if (estado.rasgarMenteUsado) {
          if (estado.dadosPsionicosDisponiveisL < 3) {
            toast('Precisa de 3 Dados de Energia Psiônica para recuperar Rasgar Mente.', 'error');
            return;
          }
          char.recursos.ladino.subclasses.adaga_espiritual.dados_psionicos_gastos += 3;
          char.recursos.ladino.subclasses.adaga_espiritual.rasgar_mente_usado = false;
          toast('Rasgar Mente recuperado gastando 3 dados!', 'success');
        } else {
          char.recursos.ladino.subclasses.adaga_espiritual.rasgar_mente_usado = true;
          toast(`Rasgar Mente usado! Alvo faz salvaguarda Sab CD ${estado.cdPsionicaAdaga} ou fica Atordoado por 1 min.`, 'success');
        }
      }

      salvar();
      renderFichaCompleta();
    });
  });

  // Handler: Mago
  document.querySelectorAll('[data-mago-acao]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (char.classe !== 'Mago') return;
      const estado = getEstadoRecursosMago();
      if (!estado) return;
      const acao = btn.dataset.magoAcao;

      if (acao === 'recuperacao-arcana') {
        if (estado.recuperacaoArcanaUsada) {
          toast('Recuperação Arcana já usada hoje.', 'error');
          return;
        }
        // Abrir modal para escolher quais espaços recuperar
        const maxCirculo = Math.min(5, estado.recuperacaoArcanaMax);
        let opcoesHtml = '';
        for (let c = 1; c <= maxCirculo; c++) {
          const slot = char.espacos_magia?.[c];
          if (!slot) continue;
          const usados = slot.usados || 0;
          if (usados <= 0) continue;
          opcoesHtml += `
            <label style="display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:0.85rem">
              <input type="number" class="recuperar-slot" data-circulo="${c}" min="0" max="${usados}" value="0" style="width:60px;padding:4px;border-radius:var(--radius);border:1px solid var(--border)">
              ${c}º Círculo (${usados} gastos)
            </label>`;
        }
        if (!opcoesHtml) {
          toast('Nenhum espaço de magia gasto para recuperar.', 'info');
          return;
        }
        abrirModal('Recuperação Arcana', `
          <div class="info-box info" style="margin-bottom:12px">
            Recupere espaços gastos. Círculos combinados devem ser ≤ <strong>${estado.recuperacaoArcanaMax}</strong>. Máximo 5º círculo.
          </div>
          ${opcoesHtml}
          <div id="recuperar-total" style="font-size:0.8rem;margin-top:8px;color:var(--text-muted)">Total: 0 / ${estado.recuperacaoArcanaMax}</div>
        `, `
          <button class="btn btn-secondary" onclick="window.fecharModal()">Cancelar</button>
          <button class="btn btn-accent" id="btn-recuperar-confirmar">Recuperar</button>
        `);
        // Atualizar total em tempo real
        const atualizarTotal = () => {
          let total = 0;
          document.querySelectorAll('.recuperar-slot').forEach(inp => {
            total += (parseInt(inp.value) || 0) * parseInt(inp.dataset.circulo);
          });
          const el = document.getElementById('recuperar-total');
          if (el) el.textContent = `Total: ${total} / ${estado.recuperacaoArcanaMax}`;
        };
        document.querySelectorAll('.recuperar-slot').forEach(inp => inp.addEventListener('input', atualizarTotal));
        document.getElementById('btn-recuperar-confirmar')?.addEventListener('click', () => {
          let total = 0;
          const slots = [];
          document.querySelectorAll('.recuperar-slot').forEach(inp => {
            const qtd = parseInt(inp.value) || 0;
            const circ = parseInt(inp.dataset.circulo);
            if (qtd > 0) {
              total += qtd * circ;
              slots.push({ circulo: circ, qtd });
            }
          });
          if (total <= 0) {
            toast('Selecione ao menos 1 espaço para recuperar.', 'error');
            return;
          }
          if (total > estado.recuperacaoArcanaMax) {
            toast(`Total (${total}) excede o máximo (${estado.recuperacaoArcanaMax}).`, 'error');
            return;
          }
          // Aplicar recuperação
          slots.forEach(s => {
            const slot = char.espacos_magia?.[s.circulo];
            if (slot) slot.usados = Math.max(0, (slot.usados || 0) - s.qtd);
          });
          char.recursos.mago.recuperacao_arcana_usada = true;
          const detalhes = slots.map(s => `${s.qtd}x ${s.circulo}º`).join(', ');
          toast(`Recuperação Arcana: ${detalhes} restaurados!`, 'success');
          salvar();
          window.fecharModal();
          renderFichaCompleta();
        });
        return;
      }

      if (acao === 'assinatura-1') {
        if (estado.assinatura1Usada) {
          toast('Assinatura Mágica 1 já usada neste descanso.', 'error');
          return;
        }
        char.recursos.mago.assinatura_magia_1_usada = true;
        toast('Assinatura Mágica 1 conjurada no 3º círculo sem gastar espaço!', 'success');
      }

      if (acao === 'assinatura-2') {
        if (estado.assinatura2Usada) {
          toast('Assinatura Mágica 2 já usada neste descanso.', 'error');
          return;
        }
        char.recursos.mago.assinatura_magia_2_usada = true;
        toast('Assinatura Mágica 2 conjurada no 3º círculo sem gastar espaço!', 'success');
      }

      salvar();
      renderFichaCompleta();
    });
  });

  // Mago: subclasses
  document.querySelectorAll('[data-mago-subclasse-acao]').forEach(el => {
    const handler = (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (char.classe !== 'Mago') return;
      const estado = getEstadoRecursosMago();
      if (!estado) return;
      const acao = el.dataset.magoSubclasseAcao;
      const sub = char.subclasse || '';

      // Abjurador: Proteção Arcana
      if (sub === 'Abjurador' && char.recursos.mago.subclasses?.abjurador) {
        const s = char.recursos.mago.subclasses.abjurador;
        if (acao === 'protecao_criar') {
          if (s.protecao_criada) {
            toast('Proteção Arcana já criada neste descanso.', 'error');
            return;
          }
          s.protecao_criada = true;
          s.protecao_pv_atual = estado.protecaoPvMax;
          toast(`Proteção Arcana criada com ${estado.protecaoPvMax} PV!`, 'success');
        }
        if (acao === 'protecao_dano') {
          abrirModal('Dano na Proteção Arcana',
            numberPickerHtml('input-protecao-dano', 1, 1, 999, 'Valor do dano') +
            `<div style="font-size:0.8rem;color:var(--text-muted);margin-top:8px">PV atuais da proteção: <strong>${s.protecao_pv_atual}</strong></div>`,
            '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-danger" id="btn-protecao-dano-ok">Aplicar Dano</button>'
          );
          setupNumberPicker('input-protecao-dano');
          document.getElementById('btn-protecao-dano-ok')?.addEventListener('click', () => {
            const dano = parseInt(document.getElementById('input-protecao-dano-val')?.value) || 0;
            if (dano <= 0) return;
            const pvAntes = s.protecao_pv_atual;
            s.protecao_pv_atual = Math.max(0, s.protecao_pv_atual - dano);
            const excedente = dano > pvAntes ? dano - pvAntes : 0;
            toast(`Proteção absorveu ${Math.min(dano, pvAntes)} de dano. PV: ${s.protecao_pv_atual}${excedente > 0 ? ` | ${excedente} de dano excedente passa para você!` : ''}`, s.protecao_pv_atual > 0 ? 'info' : 'warning');
            salvar();
            window.fecharModal();
            renderFichaCompleta();
          });
          return;
        }
        if (acao === 'protecao_restaurar') {
          abrirModal('Restaurar Proteção Arcana',
            numberPickerHtml('input-protecao-slot', 1, 1, 9, 'Círculo do espaço de magia') +
            `<div style="font-size:0.8rem;color:var(--text-muted);margin-top:8px">Restaura <strong>2x o círculo</strong> em PV da proteção.</div>`,
            '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-accent" id="btn-protecao-rest-ok">Restaurar</button>'
          );
          setupNumberPicker('input-protecao-slot');
          document.getElementById('btn-protecao-rest-ok')?.addEventListener('click', () => {
            const circulo = parseInt(document.getElementById('input-protecao-slot-val')?.value) || 0;
            if (circulo < 1) return;
            const restaurar = circulo * 2;
            s.protecao_pv_atual = Math.min(estado.protecaoPvMax, s.protecao_pv_atual + restaurar);
            toast(`Proteção restaurou ${restaurar} PV! Atual: ${s.protecao_pv_atual}/${estado.protecaoPvMax}`, 'success');
            salvar();
            window.fecharModal();
            renderFichaCompleta();
          });
          return;
        }
      }

      // Adivinhador: Prodígio e O Terceiro Olho
      if (sub === 'Adivinhador' && char.recursos.mago.subclasses?.adivinhador) {
        const s = char.recursos.mago.subclasses.adivinhador;
        if (acao === 'prodigio_rolar') {
          const n = estado.numDadosProdigio;
          s.prodigio_dado_1 = Math.floor(Math.random() * 20) + 1;
          s.prodigio_dado_1_usado = false;
          s.prodigio_dado_2 = Math.floor(Math.random() * 20) + 1;
          s.prodigio_dado_2_usado = false;
          if (n >= 3) {
            s.prodigio_dado_3 = Math.floor(Math.random() * 20) + 1;
            s.prodigio_dado_3_usado = false;
          }
          const valores = [s.prodigio_dado_1, s.prodigio_dado_2];
          if (n >= 3) valores.push(s.prodigio_dado_3);
          toast(`Prodígio: dados rolados — ${valores.join(', ')}!`, 'success');
        }
        if (acao === 'prodigio_usar_1') {
          if (s.prodigio_dado_1_usado) { toast('Dado já usado.', 'error'); return; }
          s.prodigio_dado_1_usado = true;
          toast(`Prodígio: usou dado ${s.prodigio_dado_1}!`, 'success');
        }
        if (acao === 'prodigio_usar_2') {
          if (s.prodigio_dado_2_usado) { toast('Dado já usado.', 'error'); return; }
          s.prodigio_dado_2_usado = true;
          toast(`Prodígio: usou dado ${s.prodigio_dado_2}!`, 'success');
        }
        if (acao === 'prodigio_usar_3') {
          if (s.prodigio_dado_3_usado) { toast('Dado já usado.', 'error'); return; }
          s.prodigio_dado_3_usado = true;
          toast(`Prodígio: usou dado ${s.prodigio_dado_3}!`, 'success');
        }
        if (acao === 'terceiro_olho_usar') {
          if (s.terceiro_olho_usado) { toast('O Terceiro Olho já está ativo.', 'error'); return; }
          if (!s.terceiro_olho_escolha) { toast('Escolha um benefício primeiro.', 'error'); return; }
          s.terceiro_olho_usado = true;
          toast(`O Terceiro Olho: ${s.terceiro_olho_escolha} ativado!`, 'success');
        }
      }

      // Evocador: Sobrecarga
      if (sub === 'Evocador' && char.recursos.mago.subclasses?.evocador) {
        const s = char.recursos.mago.subclasses.evocador;
        if (acao === 'sobrecarga_usar') {
          s.sobrecarga_usos += 1;
          if (s.sobrecarga_usos === 1) {
            toast('Sobrecarga! Dano máximo na magia — sem efeito adverso.', 'success');
          } else {
            const dado = s.sobrecarga_usos;
            toast(`Sobrecarga! Dano máximo — você sofre ${dado}d12 x círculo de dano Necrótico!`, 'warning');
          }
        }
      }

      // Ilusionista: Criaturas Espectrais e Autoimagem Ilusória
      if (sub === 'Ilusionista' && char.recursos.mago.subclasses?.ilusionista) {
        const s = char.recursos.mago.subclasses.ilusionista;
        if (acao === 'espectrais_feerica') {
          if (s.feerica_usada) { toast('Convocar Feérico grátis já usado.', 'error'); return; }
          s.feerica_usada = true;
          toast('Convocar Feérico conjurado gratuitamente! PV pela metade.', 'success');
        }
        if (acao === 'espectrais_fera') {
          if (s.fera_usada) { toast('Invocar Fera grátis já usado.', 'error'); return; }
          s.fera_usada = true;
          toast('Invocar Fera conjurado gratuitamente! PV pela metade.', 'success');
        }
        if (acao === 'autoimagem_usar') {
          if (s.autoimagem_usada) { toast('Autoimagem Ilusória já usada.', 'error'); return; }
          s.autoimagem_usada = true;
          toast('Autoimagem Ilusória usada! O ataque erra automaticamente.', 'success');
        }
        if (acao === 'autoimagem_restaurar') {
          if (!s.autoimagem_usada) { toast('Autoimagem Ilusória já está disponível.', 'info'); return; }
          s.autoimagem_usada = false;
          toast('Autoimagem Ilusória restaurada (gasto slot de 2º+ círculo).', 'success');
        }
      }

      salvar();
      renderFichaCompleta();
    };
    if (el.tagName === 'SELECT') {
      el.addEventListener('change', (e) => {
        e.stopPropagation();
        if (char.classe !== 'Mago') return;
        const acao = el.dataset.magoSubclasseAcao;
        if (acao === 'terceiro_olho_escolha') {
          if (!char.recursos?.mago?.subclasses?.adivinhador) return;
          char.recursos.mago.subclasses.adivinhador.terceiro_olho_escolha = el.value;
          salvar();
          renderFichaCompleta();
        }
      });
    } else {
      el.addEventListener('click', handler);
    }
  });

  document.querySelectorAll('[data-guerreiro-acao]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (char.classe !== 'Guerreiro') return;

      const estado = getEstadoRecursosGuerreiro();
      if (!estado) return;
      const acao = btn.dataset.guerreiroAcao;

      if (acao === 'usar-folego') {
        if (estado.recuperarFolegoDisponiveis <= 0) {
          toast('Sem usos de Recuperar Folego disponíveis.', 'error');
          return;
        }
        char.recursos.guerreiro.recuperar_folego_usos_gastos += 1;
        const cura = `1d10 + ${char.nivel || 1}`;
        toast(`Recuperar Folego usado! Role ${cura} e aplique a cura.`, 'success');
      }

      if (acao === 'usar-surto') {
        if (estado.surtoDisponiveis <= 0) {
          toast('Sem usos de Surto de Ação disponíveis.', 'error');
          return;
        }
        char.recursos.guerreiro.surto_acao_usos_gastos += 1;
        toast('Surto de Ação usado! Você tem 1 ação adicional (exceto Usar Magia).', 'success');
      }

      if (acao === 'usar-indomavel') {
        if (estado.indomavelDisponiveis <= 0) {
          toast('Sem usos de Indomável disponíveis.', 'error');
          return;
        }
        char.recursos.guerreiro.indomavel_usos_gastos += 1;
        toast(`Indomável usado! Rejogue a salvaguarda com bônus de +${char.nivel || 1}.`, 'success');
      }

      // --- Mestre da Batalha ---
      if (acao === 'usar-superioridade') {
        if (estado.dadosSuperioridadeDisponiveis <= 0) {
          toast('Sem Dados de Superioridade disponíveis.', 'error');
          return;
        }
        char.recursos.guerreiro.subclasses.mestre_batalha.dados_superioridade_gastos += 1;
        toast(`Dado de Superioridade gasto! Role 1${estado.tipoDadoSuperioridade} para a manobra. CD: ${estado.cdSuperioridade}.`, 'success');
      }

      if (acao === 'conheca-inimigo') {
        if (estado.conhecaInimigoUsado) {
          toast('Conheça Seu Inimigo já usado neste descanso.', 'error');
          return;
        }
        char.recursos.guerreiro.subclasses.mestre_batalha.conheca_inimigo_usado = true;
        toast('Conheça Seu Inimigo usado! Examine imunidades, resistências e vulnerabilidades do alvo.', 'success');
      }

      if (acao === 'conheca-inimigo-dado') {
        if (estado.dadosSuperioridadeDisponiveis <= 0) {
          toast('Sem Dados de Superioridade para recuperar Conheça Seu Inimigo.', 'error');
          return;
        }
        char.recursos.guerreiro.subclasses.mestre_batalha.dados_superioridade_gastos += 1;
        char.recursos.guerreiro.subclasses.mestre_batalha.conheca_inimigo_usado = false;
        toast('Conheça Seu Inimigo recuperado gastando 1 Dado de Superioridade!', 'success');
      }

      // --- Combatente Psíquico ---
      if (acao === 'golpe-psionico') {
        if (estado.dadosPsionicosDisponiveisG <= 0) {
          toast('Sem Dados de Energia Psiônica disponíveis.', 'error');
          return;
        }
        char.recursos.guerreiro.subclasses.combatente_psiquico.dados_psionicos_gastos += 1;
        const modInt = calcMod(char.atributos?.inteligencia || 10);
        toast(`Golpe Psiônico! Role 1${estado.tipoDadoPsionicoG}+${modInt} dano Energético extra.`, 'success');
      }

      if (acao === 'vinculo-protetivo') {
        if (estado.dadosPsionicosDisponiveisG <= 0) {
          toast('Sem Dados de Energia Psiônica disponíveis.', 'error');
          return;
        }
        char.recursos.guerreiro.subclasses.combatente_psiquico.dados_psionicos_gastos += 1;
        const modInt = calcMod(char.atributos?.inteligencia || 10);
        toast(`Vínculo Protetivo! Role 1${estado.tipoDadoPsionicoG}+${modInt} para reduzir o dano (Reação).`, 'success');
      }

      if (acao === 'movimento-telecinetico') {
        if (estado.movimentoTelecineticoUsado) {
          if (estado.dadosPsionicosDisponiveisG <= 0) {
            toast('Sem Dados de Energia Psiônica para recuperar Movimento Telecinético.', 'error');
            return;
          }
          char.recursos.guerreiro.subclasses.combatente_psiquico.dados_psionicos_gastos += 1;
          char.recursos.guerreiro.subclasses.combatente_psiquico.movimento_telecinetico_usado = false;
          toast('Movimento Telecinético recuperado gastando 1 dado!', 'success');
        } else {
          char.recursos.guerreiro.subclasses.combatente_psiquico.movimento_telecinetico_usado = true;
          toast('Movimento Telecinético usado! Transporte um objeto ou criatura até 9m.', 'success');
        }
      }

      if (acao === 'salto-impulsao') {
        if (estado.saltoImpulsaoUsado) {
          if (estado.dadosPsionicosDisponiveisG <= 0) {
            toast('Sem Dados de Energia Psiônica para recuperar Salto com Impulsão.', 'error');
            return;
          }
          char.recursos.guerreiro.subclasses.combatente_psiquico.dados_psionicos_gastos += 1;
          char.recursos.guerreiro.subclasses.combatente_psiquico.salto_impulsao_usado = false;
          toast('Salto com Impulsão Psíquica recuperado gastando 1 dado!', 'success');
        } else {
          char.recursos.guerreiro.subclasses.combatente_psiquico.salto_impulsao_usado = true;
          toast('Salto com Impulsão usado! Voo = 2x Deslocamento até o final do turno.', 'success');
        }
      }

      if (acao === 'baluarte') {
        if (estado.baluarteUsado) {
          if (estado.dadosPsionicosDisponiveisG <= 0) {
            toast('Sem Dados de Energia Psiônica para recuperar Baluarte de Energia.', 'error');
            return;
          }
          char.recursos.guerreiro.subclasses.combatente_psiquico.dados_psionicos_gastos += 1;
          char.recursos.guerreiro.subclasses.combatente_psiquico.baluarte_usado = false;
          toast('Baluarte de Energia recuperado gastando 1 dado!', 'success');
        } else {
          char.recursos.guerreiro.subclasses.combatente_psiquico.baluarte_usado = true;
          const modInt = calcMod(char.atributos?.inteligencia || 10);
          toast(`Baluarte de Energia ativado! Até ${Math.max(1, modInt)} criaturas ganham Cobertura Parcial por 1 min.`, 'success');
        }
      }

      if (acao === 'mestre-telecinetico') {
        if (estado.mestreTelecineticoUsado) {
          if (estado.dadosPsionicosDisponiveisG <= 0) {
            toast('Sem Dados de Energia Psiônica para recuperar Mestre Telecinético.', 'error');
            return;
          }
          char.recursos.guerreiro.subclasses.combatente_psiquico.dados_psionicos_gastos += 1;
          char.recursos.guerreiro.subclasses.combatente_psiquico.mestre_telecinetico_usado = false;
          toast('Mestre Telecinético recuperado gastando 1 dado!', 'success');
        } else {
          char.recursos.guerreiro.subclasses.combatente_psiquico.mestre_telecinetico_usado = true;
          toast('Telecinese conjurada sem espaço! INT como atributo de conjuração. Ataque com arma como Ação Bônus.', 'success');
        }
      }

      salvar();
      renderFichaCompleta();
    });
  });

  document.querySelectorAll('[data-furia-toggle]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();

      const acao = btn.dataset.furiaToggle;
      const estado = getEstadoFuria();
      if (!estado) return;

      if (!char.recursos) char.recursos = {};

      if (acao === 'ativar') {
        if (temArmaduraPesadaEquipada()) {
          toast('Não é possível entrar em Fúria com armadura pesada equipada.', 'error');
          return;
        }
        if (estado.usosDisponiveis <= 0) {
          toast('Sem usos de Fúria disponíveis.', 'error');
          return;
        }
        if (char.recursos.furia_ativa) {
          toast('A Fúria já está ativa.', 'error');
          return;
        }
        char.recursos.furia_ativa = true;
        char.recursos.furia_usos_gastos = (char.recursos.furia_usos_gastos || 0) + 1;
        // Reseta flag de Concentração Fanática para nova sessão de Fúria
        char.recursos.concentracao_fanatica_usada = false;

        // Fúria Irracional (Berserker 6+): remove Amedrontado e Enfeitiçado ao ativar
        if (estado.furiaIrracional) {
          const condicoesImunes = ['Amedrontado', 'Enfeitiçado'];
          const removidas = (char.condicoes || []).filter(c => condicoesImunes.includes(c));
          if (removidas.length > 0) {
            char.condicoes = (char.condicoes || []).filter(c => !condicoesImunes.includes(c));
            toast(`Fúria Irracional: ${removidas.join(' e ')} removida(s)!`, 'success');
          }
        }

        // Bote Instintivo (nível 7+): lembrete ao ativar Fúria
        if (estado.temBoteInstintivo) {
          toast('Bote Instintivo: você pode se mover até metade do seu Deslocamento como parte desta Ação Bônus.', 'info');
        }

        // Coração Selvagem (nível 3+): solicitar escolha de animal
        if (char.subclasse === 'Trilha do Coração Selvagem' && (char.nivel || 1) >= 3) {
          _abrirEscolhaAnimalFuria();
        }

        // Árvore do Mundo (nível 3+): Surto de Vitalidade — PVT = nível ao ativar
        if (char.subclasse === 'Trilha da Árvore do Mundo' && (char.nivel || 1) >= 3) {
          const pvtSurto = char.nivel || 1;
          char.pv_temporario = Math.max(char.pv_temporario || 0, pvtSurto);
          toast(`Surto de Vitalidade: +${pvtSurto} PV Temporários!`, 'success');
        }
      } else {
        char.recursos.furia_ativa = false;
        // Limpar escolha de animal da Fúria ao encerrar
        if (char.subclasse === 'Trilha do Coração Selvagem') {
          char.recursos.furia_animal = null;
        }
        // Desativar Fúria dos Deuses ao encerrar
        if (char.recursos.furia_deuses_ativa) {
          char.recursos.furia_deuses_ativa = false;
        }
      }

      salvar();
      renderFichaCompleta();
    });
  });

  document.querySelectorAll('[data-config-maestrias]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      e.preventDefault();
      await abrirModalMaestrias();
    });
  });

  document.querySelectorAll('[data-imprudente-toggle]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (!char.recursos) char.recursos = {};
      char.recursos.ataque_imprudente_ativo = btn.dataset.imprudenteToggle === 'ativar';
      salvar();
      renderFichaCompleta();
    });
  });

  document.querySelectorAll('[data-furia-iniciativa]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (char.classe !== 'Bárbaro' || char.nivel < 15) return;
      if (!char.recursos) char.recursos = {};
      if (char.recursos.furia_persistente_usada) {
        toast('Fúria Persistente já foi usada desde o último descanso longo.', 'error');
        return;
      }
      char.recursos.furia_usos_gastos = 0;
      char.recursos.furia_persistente_usada = true;
      salvar();
      toast('Fúrias recuperadas pela Fúria Persistente.', 'success');
      renderFichaCompleta();
    });
  });

  // Fúria Implacável (nível 11+): botão para usar quando cair a 0 PV
  document.querySelectorAll('[data-furia-implacavel]').forEach(btn => {
    btn.addEventListener('click', () => {
      const estado = getEstadoFuria();
      if (!estado?.ativa || !estado.furiaImplacavel) return;
      if (!char.recursos) char.recursos = {};
      const cd = char.recursos.furia_implacavel_cd || 10;
      const nivel = char.nivel || 1;
      const pvRecuperados = nivel * 2;

      abrirModal('Fúria Implacável',
        `<div style="text-align:center;font-size:0.9rem;line-height:1.6">
          <p>Você foi reduzido a <strong>0 PV</strong> com a Fúria ativa.</p>
          <p>Realize uma <strong>Salvaguarda de Constituição CD ${cd}</strong>.</p>
          <p>Em caso de sucesso, seus PV mudam para <strong>${pvRecuperados}</strong>.</p>
          <p style="color:var(--text-muted);font-size:0.8rem">A cada uso adicional, a CD aumenta em 5. Reseta no Descanso Curto/Longo.</p>
        </div>`,
        `<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>
         <button class="btn btn-danger" id="btn-furia-implacavel-falha">Falha</button>
         <button class="btn btn-success" id="btn-furia-implacavel-sucesso">Sucesso</button>`
      );

      document.getElementById('btn-furia-implacavel-sucesso')?.addEventListener('click', () => {
        char.pv_atual = pvRecuperados;
        char.recursos.furia_implacavel_cd = cd + 5;
        salvar();
        window.fecharModal();
        toast(`Fúria Implacável! PV restaurados para ${pvRecuperados}. Próxima CD: ${cd + 5}`, 'success');
        renderFichaCompleta();
      });

      document.getElementById('btn-furia-implacavel-falha')?.addEventListener('click', () => {
        char.recursos.furia_implacavel_cd = cd + 5;
        salvar();
        window.fecharModal();
        toast(`Fúria Implacável falhou. Próxima CD: ${cd + 5}`, 'error');
        renderFichaCompleta();
      });
    });
  });
}

/** Abre modal para escolha de animal ao ativar Fúria (Coração Selvagem) */
function _abrirEscolhaAnimalFuria() {
  const nivel = char.nivel || 1;
  let opcoes = [
    { id: 'Águia', label: 'Águia', desc: 'Correr e Desengajar como Ação Bônus ao ativar e durante a Fúria.' },
    { id: 'Lobo', label: 'Lobo', desc: 'Aliados têm Vantagem em ataques contra inimigos a até 1,5m de você.' },
    { id: 'Urso', label: 'Urso', desc: 'Resistência a todos os tipos de dano exceto Energético, Necrótico, Psíquico e Radiante.' }
  ];

  // Poder dos Selvagens (nível 14+): opções adicionais
  if (nivel >= 14) {
    opcoes.push(
      { id: 'Carneiro', label: 'Carneiro', desc: 'Pode impor Caído em criaturas Grandes ou menores com ataque corpo a corpo.' },
      { id: 'Falcão', label: 'Falcão', desc: 'Voo igual ao Deslocamento (sem armadura).' },
      { id: 'Leão', label: 'Leão', desc: 'Inimigos a 1,5m têm Desvantagem em ataques contra alvos que não sejam você.' }
    );
  }

  const html = `
    <div style="display:flex;flex-direction:column;gap:8px">
      <p style="font-size:0.85rem;color:var(--text-muted);text-align:center">Escolha o espírito animal para esta Fúria:</p>
      ${opcoes.map(o => `
        <button class="btn btn-secondary" data-animal-furia="${o.id}" style="text-align:left;padding:8px 12px">
          <strong>${o.label}</strong><br>
          <span style="font-size:0.8rem;color:var(--text-muted)">${o.desc}</span>
        </button>
      `).join('')}
    </div>
  `;

  abrirModal('Fúria dos Selvagens', html, '');

  document.querySelectorAll('[data-animal-furia]').forEach(btn => {
    btn.addEventListener('click', () => {
      const animal = btn.dataset.animalFuria;
      if (!char.recursos) char.recursos = {};
      char.recursos.furia_animal = animal;
      salvar();
      window.fecharModal();
      toast(`Espírito de ${animal} ativado!`, 'success');
      renderFichaCompleta();
    });
  });
}

/** Setup de eventos para subclasses do Bárbaro (Fanático, Coração Selvagem, etc.) */
function setupEventosSubclasseBarbaro() {
  // Campeão dos Deuses (Fanático nv3): usar d12 para cura
  document.querySelectorAll('[data-campeao-deuses]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (char.classe !== 'Bárbaro' || char.subclasse !== 'Trilha do Fanático') return;
      if (!char.recursos) char.recursos = {};
      const nivel = char.nivel || 1;
      const dadosMax = nivel >= 17 ? 7 : nivel >= 12 ? 6 : nivel >= 6 ? 5 : 4;
      const gastos = char.recursos.campeao_deuses_gastos || 0;
      if (gastos >= dadosMax) {
        toast('Sem dados de cura disponíveis. Descanse para recuperar.', 'error');
        return;
      }
      // Modal para escolher quantos dados gastar
      const disponiveis = dadosMax - gastos;
      const pvMax = char.pv_max_override || char.pv_max;
      abrirModal('Campeão dos Deuses - Cura',
        `<div style="text-align:center;font-size:0.9rem">
          <p>Dados disponíveis: <strong>${disponiveis}d12</strong></p>
          <p>Como Ação Bônus, gaste dados e recupere PV igual ao total.</p>
          <div style="margin-top:8px">
            <label class="form-label">Quantos d12 gastar?</label>
            <input type="number" id="input-campeao-dados" min="1" max="${disponiveis}" value="1" style="width:60px;text-align:center;padding:4px;border-radius:4px;border:1px solid var(--border)">
          </div>
          <p style="font-size:0.8rem;color:var(--text-muted);margin-top:8px">O resultado será simulado automaticamente (role fisicamente se preferir)</p>
        </div>`,
        '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-success" id="btn-campeao-curar">Curar</button>'
      );
      document.getElementById('btn-campeao-curar')?.addEventListener('click', () => {
        const qtd = Math.min(disponiveis, Math.max(1, parseInt(document.getElementById('input-campeao-dados')?.value) || 1));
        // Simular rolagem
        let total = 0;
        for (let i = 0; i < qtd; i++) total += Math.floor(Math.random() * 12) + 1;
        char.recursos.campeao_deuses_gastos = gastos + qtd;
        char.pv_atual = Math.min(pvMax, char.pv_atual + total);
        salvar();
        window.fecharModal();
        toast(`Campeão dos Deuses: ${qtd}d12 = ${total} PV recuperados!`, 'success');
        renderFichaCompleta();
      });
    });
  });

  // Concentração Fanática (Fanático nv6): marcar como usada
  document.querySelectorAll('[data-concentracao-fanatica]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!char.recursos) char.recursos = {};
      if (char.recursos.concentracao_fanatica_usada) {
        toast('Concentração Fanática já usada nesta Fúria.', 'error');
        return;
      }
      char.recursos.concentracao_fanatica_usada = true;
      const danoFuria = getEstadoFuria()?.dano || 0;
      salvar();
      toast(`Concentração Fanática usada! Re-role a salvaguarda com +${danoFuria}.`, 'success');
      renderFichaCompleta();
    });
  });

  // Presença Zelosa (Fanático nv10): usar ou restaurar gastando Fúria
  document.querySelectorAll('[data-presenca-zelosa]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!char.recursos) char.recursos = {};
      const acao = btn.dataset.presencaZelosa;
      if (acao === 'usar') {
        if (char.recursos.presenca_zelosa_usada) {
          toast('Presença Zelosa já usada.', 'error');
          return;
        }
        char.recursos.presenca_zelosa_usada = true;
        salvar();
        toast('Presença Zelosa ativada! Até 10 aliados: Vantagem em ataques e salvaguardas até o início do próximo turno.', 'success');
        renderFichaCompleta();
      } else if (acao === 'restaurar') {
        // Gastar 1 uso de Fúria para restaurar
        const estado = getEstadoFuria();
        if (!estado || estado.usosDisponiveis <= 0) {
          toast('Sem usos de Fúria para restaurar Presença Zelosa.', 'error');
          return;
        }
        char.recursos.furia_usos_gastos = (char.recursos.furia_usos_gastos || 0) + 1;
        char.recursos.presenca_zelosa_usada = false;
        salvar();
        toast('Presença Zelosa restaurada (1 uso de Fúria gasto).', 'success');
        renderFichaCompleta();
      }
    });
  });

  // Fúria dos Deuses (Fanático nv14): toggle forma divina
  document.querySelectorAll('[data-furia-deuses]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!char.recursos) char.recursos = {};
      const acao = btn.dataset.furiaDeuses;
      if (acao === 'ativar') {
        if (char.recursos.furia_deuses_usada) {
          toast('Fúria dos Deuses já usada. Recarrega no Descanso Longo.', 'error');
          return;
        }
        char.recursos.furia_deuses_ativa = true;
        char.recursos.furia_deuses_usada = true;
        salvar();
        toast('Fúria dos Deuses ativada! Resistência: Necrótico/Psíquico/Radiante + Voo + Revivificação', 'success');
        renderFichaCompleta();
      } else {
        char.recursos.furia_deuses_ativa = false;
        salvar();
        toast('Forma divina encerrada.', 'info');
        renderFichaCompleta();
      }
    });
  });

  // Aspecto dos Selvagens (Coração Selvagem nv6): escolha persistente
  document.querySelectorAll('[data-aspecto-selvagem]').forEach(sel => {
    sel.addEventListener('change', (e) => {
      if (!char.recursos) char.recursos = {};
      char.recursos.aspecto_selvagem = e.target.value || null;
      salvar();
      toast(`Aspecto dos Selvagens: ${e.target.value || 'nenhum'}`, 'success');
      renderFichaCompleta();
    });
  });

  // Berserker: Presença Intimidante (nv10) — usar ou restaurar gastando Fúria
  document.querySelectorAll('[data-berserker-acao]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!char.recursos) char.recursos = {};
      const acao = btn.dataset.berserkerAcao;
      if (acao === 'presenca-intimidante') {
        if (char.recursos.presenca_intimidante_usada) {
          toast('Presença Intimidante já usada.', 'error');
          return;
        }
        char.recursos.presenca_intimidante_usada = true;
        const modFor = calcMod(char.atributos.forca);
        const cd = 8 + bonusProficiencia(char.nivel || 1) + modFor;
        salvar();
        toast(`Presença Intimidante ativada! CD ${cd}. Criaturas escolhidas ficam Amedrontadas.`, 'success');
        renderFichaCompleta();
      } else if (acao === 'presenca-restaurar') {
        const estado = getEstadoFuria();
        if (!estado || estado.usosDisponiveis <= 0) {
          toast('Sem usos de Fúria para restaurar Presença Intimidante.', 'error');
          return;
        }
        char.recursos.furia_usos_gastos = (char.recursos.furia_usos_gastos || 0) + 1;
        char.recursos.presenca_intimidante_usada = false;
        salvar();
        toast('Presença Intimidante restaurada (1 uso de Fúria gasto).', 'success');
        renderFichaCompleta();
      }
    });
  });
}

async function abrirModalMaestrias() {
  // Classes que possuem Maestria em Arma
  const classesMaestria = ['Bárbaro', 'Guerreiro', 'Guardião', 'Paladino', 'Ladino'];
  if (!classesMaestria.includes(char.classe)) return;

  // Obter quantidade máxima de maestrias conforme a classe
  let maestriasMax = 2; // Valor fixo para Guardião, Paladino e Ladino
  if (char.classe === 'Bárbaro') {
    const prog = getProgressaoBarbaro();
    maestriasMax = prog?.maestriasMax || 2;
  } else if (char.classe === 'Guerreiro') {
    const prog = getProgressaoGuerreiro();
    maestriasMax = prog?.maestriasMax || 3;
  }

  const dados = await carregarDadosEquipSheet();
  // Filtrar armas conforme regras de proficiência por classe
  const todasArmas = dados?.armas || [];
  const armas = todasArmas
    .filter(a => {
      const cat = (a.categoria || '').toLowerCase();
      const ehSimples = cat.includes('simples');
      const ehMarcial = cat.includes('marcial');
      if (!ehSimples && !ehMarcial) return false;

      // Bárbaro: apenas Corpo a Corpo (Simples ou Marcial)
      if (char.classe === 'Bárbaro') {
        return cat.includes('corpo a corpo');
      }
      // Ladino: Simples + Marciais com propriedade Acuidade
      if (char.classe === 'Ladino') {
        if (ehSimples) return true;
        const props = (a.propriedades || []).map(p => p.toLowerCase());
        return props.some(p => p.includes('acuidade'));
      }
      // Guerreiro, Guardião, Paladino: todas Simples e Marciais
      return true;
    })
    .map(a => a.nome)
    .sort((a, b) => a.localeCompare(b));

  const selecionadas = new Set(char.maestrias_arma || []);

  const renderLista = (filtro = '') => {
    const termo = semAcento(filtro || '');
    const visiveis = termo.length >= 2
      ? armas.filter(n => semAcento(n).includes(termo))
      : armas;

    return `
      <div style="font-size:0.85rem;margin-bottom:8px">
        Selecionadas: <strong id="maestria-count">${selecionadas.size}</strong> / ${maestriasMax}
      </div>
      <div style="max-height:45vh;overflow:auto;border:1px solid var(--border-light);border-radius:8px;padding:8px" id="maestria-lista">
        ${visiveis.map(nome => {
          const marcada = selecionadas.has(nome);
          return `
            <label class="form-check" style="justify-content:flex-start;margin:0 0 6px 0;opacity:${!marcada && selecionadas.size >= maestriasMax ? 0.5 : 1}">
              <input type="checkbox" data-maestria-nome="${nome}" ${marcada ? 'checked' : ''}>
              ${nome}
            </label>
          `;
        }).join('')}
      </div>
    `;
  };

  abrirModal(`Maestrias em Arma (${char.classe})`, `
    <div class="search-box"><input type="text" id="maestria-busca" class="form-input" placeholder="Buscar arma..."></div>
    <div id="maestria-conteudo">${renderLista('')}</div>
    <div style="font-size:0.75rem;color:var(--text-muted);margin-top:8px">
      Regra: você conhece ${maestriasMax} maestria(s) neste nível.
    </div>
  `, '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-primary" id="btn-salvar-maestrias">Salvar</button>');

  const bindLista = () => {
    document.querySelectorAll('[data-maestria-nome]').forEach(cb => {
      cb.addEventListener('change', () => {
        const nome = cb.dataset.maestriaNome;
        if (cb.checked) {
          if (selecionadas.size >= maestriasMax) {
            cb.checked = false;
            toast(`Você só pode selecionar ${maestriasMax} maestria(s).`, 'error');
            return;
          }
          selecionadas.add(nome);
        } else {
          selecionadas.delete(nome);
        }
        const count = document.getElementById('maestria-count');
        if (count) count.textContent = String(selecionadas.size);
      });
    });
  };

  bindLista();

  document.getElementById('maestria-busca')?.addEventListener('input', (e) => {
    const termo = e.target.value || '';
    const conteudo = document.getElementById('maestria-conteudo');
    if (!conteudo) return;
    conteudo.innerHTML = renderLista(termo);
    bindLista();
  });

  document.getElementById('btn-salvar-maestrias')?.addEventListener('click', () => {
    char.maestrias_arma = [...selecionadas].sort((a, b) => a.localeCompare(b));
    salvar();
    window.fecharModal();
    renderFichaCompleta();
  });
}

// Modal de troca de maestria no descanso longo
// Bárbaro/Guerreiro: troca apenas UMA arma por descanso longo
// Guardião/Paladino/Ladino: pode trocar TODAS as armas
async function abrirModalTrocaMaestriaDescanso(callbackPosTroca = null) {
  const classesMaestria = ['Bárbaro', 'Guerreiro', 'Guardião', 'Paladino', 'Ladino'];
  if (!classesMaestria.includes(char.classe)) return;

  // Guardião, Paladino e Ladino podem trocar todas as escolhas
  if (['Guardião', 'Paladino', 'Ladino'].includes(char.classe)) {
    await abrirModalMaestrias();
    if (callbackPosTroca) callbackPosTroca();
    return;
  }

  // Bárbaro e Guerreiro: trocar apenas UMA arma
  let maestriasMax = 2;
  if (char.classe === 'Bárbaro') {
    const prog = getProgressaoBarbaro();
    maestriasMax = prog?.maestriasMax || 2;
  } else if (char.classe === 'Guerreiro') {
    const prog = getProgressaoGuerreiro();
    maestriasMax = prog?.maestriasMax || 3;
  }

  const atuais = char.maestrias_arma || [];
  if (atuais.length === 0) {
    // Sem maestrias definidas, abrir modal completo
    await abrirModalMaestrias();
    return;
  }

  const dados = await carregarDadosEquipSheet();
  const todasArmas = dados?.armas || [];
  // Filtrar armas disponiveis conforme classe
  const armasDisponiveis = todasArmas
    .filter(a => {
      const cat = (a.categoria || '').toLowerCase();
      const ehSimples = cat.includes('simples');
      const ehMarcial = cat.includes('marcial');
      if (!ehSimples && !ehMarcial) return false;
      if (char.classe === 'Bárbaro') return cat.includes('corpo a corpo');
      return true;
    })
    .map(a => a.nome)
    .filter(n => !atuais.includes(n))
    .sort((a, b) => a.localeCompare(b));

  let armaTrocar = '';
  let armaSubstituta = '';

  const renderConteudo = () => {
    return `
      <p style="font-size:0.85rem;margin-bottom:12px">
        Como ${char.classe}, você pode trocar <strong>uma</strong> escolha de maestria por Descanso Longo.
      </p>
      <div style="margin-bottom:12px">
        <label class="form-label" style="font-size:0.85rem">Qual arma deseja remover?</label>
        <select id="maestria-remover" class="form-input" style="font-size:0.85rem">
          <option value="">-- Selecionar --</option>
          ${atuais.map(n => `<option value="${n}" ${armaTrocar === n ? 'selected' : ''}>${n}</option>`).join('')}
        </select>
      </div>
      <div>
        <label class="form-label" style="font-size:0.85rem">Qual arma adicionar no lugar?</label>
        <input type="text" id="maestria-filtro-nova" class="form-input" placeholder="Buscar arma..." style="font-size:0.85rem;margin-bottom:6px">
        <div style="max-height:30vh;overflow:auto;border:1px solid var(--border-light);border-radius:8px;padding:8px" id="maestria-nova-lista">
          ${armasDisponiveis.map(n => `
            <label class="form-check" style="justify-content:flex-start;margin:0 0 4px 0">
              <input type="radio" name="maestria-nova" value="${n}" ${armaSubstituta === n ? 'checked' : ''}>
              ${n}
            </label>
          `).join('')}
        </div>
      </div>
      <div style="font-size:0.75rem;color:var(--text-muted);margin-top:8px">
        Maestrias atuais: ${atuais.join(', ')}
      </div>
    `;
  };

  abrirModal(`Trocar Maestria (${char.classe})`, renderConteudo(),
    '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-primary" id="btn-confirmar-troca-maestria">Trocar</button>'
  );

  // Filtrar lista ao digitar
  document.getElementById('maestria-filtro-nova')?.addEventListener('input', (e) => {
    const termo = semAcento(e.target.value || '');
    const lista = document.getElementById('maestria-nova-lista');
    if (!lista) return;
    const filtradas = termo.length >= 2
      ? armasDisponiveis.filter(n => semAcento(n).includes(termo))
      : armasDisponiveis;
    lista.innerHTML = filtradas.map(n => `
      <label class="form-check" style="justify-content:flex-start;margin:0 0 4px 0">
        <input type="radio" name="maestria-nova" value="${n}" ${armaSubstituta === n ? 'checked' : ''}>
        ${n}
      </label>
    `).join('');
  });

  document.getElementById('btn-confirmar-troca-maestria')?.addEventListener('click', () => {
    const remover = document.getElementById('maestria-remover')?.value;
    const nova = document.querySelector('input[name="maestria-nova"]:checked')?.value;

    if (!remover || !nova) {
      toast('Selecione a arma a remover e a arma substituta.', 'error');
      return;
    }

    const novaLista = atuais.filter(n => n !== remover);
    novaLista.push(nova);
    char.maestrias_arma = novaLista.sort((a, b) => a.localeCompare(b));
    salvar();
    window.fecharModal();
    toast(`Maestria trocada: ${remover} → ${nova}`, 'success');
    renderFichaCompleta();
    // Encadear próxima ação (ex.: troca de magias após maestria)
    if (callbackPosTroca) callbackPosTroca();
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
      <div class="form-group">
        <label class="form-label" for="edit-alinhamento">Alinhamento</label>
        <select class="form-input" id="edit-alinhamento">
          <option value="">— Nenhum —</option>
          <option value="Ordeiro e Bom"${char.alinhamento === 'Ordeiro e Bom' ? ' selected' : ''}>Ordeiro e Bom</option>
          <option value="Neutro e Bom"${char.alinhamento === 'Neutro e Bom' ? ' selected' : ''}>Neutro e Bom</option>
          <option value="Caótico e Bom"${char.alinhamento === 'Caótico e Bom' ? ' selected' : ''}>Caótico e Bom</option>
          <option value="Ordeiro e Neutro"${char.alinhamento === 'Ordeiro e Neutro' ? ' selected' : ''}>Ordeiro e Neutro</option>
          <option value="Neutro"${char.alinhamento === 'Neutro' ? ' selected' : ''}>Neutro</option>
          <option value="Caótico e Neutro"${char.alinhamento === 'Caótico e Neutro' ? ' selected' : ''}>Caótico e Neutro</option>
          <option value="Ordeiro e Mau"${char.alinhamento === 'Ordeiro e Mau' ? ' selected' : ''}>Ordeiro e Mau</option>
          <option value="Neutro e Mau"${char.alinhamento === 'Neutro e Mau' ? ' selected' : ''}>Neutro e Mau</option>
          <option value="Caótico e Mau"${char.alinhamento === 'Caótico e Mau' ? ' selected' : ''}>Caótico e Mau</option>
        </select>
      </div>
      <div class="row gap-1">
        <div class="col">
          <label class="form-label">Nivel</label>
          <div style="font-size:1rem;font-weight:700;padding:6px;background:var(--surface-variant);border-radius:4px">${char.nivel}</div>
          <div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px">Use Subir de Nível para alterar</div>
        </div>
        <div class="col">
          <label class="form-label">Subclasse</label>
          <div style="font-size:1rem;font-weight:700;padding:6px;background:var(--surface-variant);border-radius:4px">${char.subclasse || '—'}</div>
          <div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px">Definida ao subir de nível</div>
        </div>
      </div>
      <div class="section-divider mt-2"><span>Atributos</span></div>
      <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:8px">
        Atributos são definidos na criação e alterados ao subir de nível (Aumento de Atributo). Não podem ser editados livremente.
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
      char.alinhamento = document.getElementById('edit-alinhamento')?.value || '';

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
          Nível Atual: ${char.nivel}${char.nivel < 20 ? ` | Próximo Nível (${char.nivel + 1}): ${XP_POR_NIVEL[char.nivel + 1]} XP` : ' (Máximo)'}
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

// Modal de subir de nível
async function abrirModalLevelUp() {
  const nivelNovo = char.nivel + 1;
  const modCon = calcMod(char.atributos.constituicao);
  const info = CLASSES_INFO[char.classe];
  const hpGanhoFixo = Math.max(1, Math.floor(info.dado_vida / 2) + 1 + modCon);
  
  // Importar funções do levelup
  const { obterCaracteristicasNivel, obterCaracteristicasEspecieNivel, obterCaracteristicasSubclasseNivel, obterMagiasDominioNivel, concedeAumentoAtributo, exigeSubclasse } = await import('../levelup.js');
  
  const caracteristicas = await obterCaracteristicasNivel(char.classe, nivelNovo);
  const caracteristicasEspecie = await obterCaracteristicasEspecieNivel(char.especie, nivelNovo);
  const ganhaAumentoAtributo = concedeAumentoAtributo(char.classe, nivelNovo);
  const precisaSubclasse = exigeSubclasse(char.classe, nivelNovo) && !char.subclasse;
  const precisaExpertiseBardo = exigeEspecializacaoBardo(char.classe, nivelNovo);
  const precisaExpertiseGuardiao = exigeEspecializacaoGuardiao(char.classe, nivelNovo);
  const precisaEstiloLuta = exigeEstiloLuta(char.classe, nivelNovo);
  const precisaExploradorHabil = exigeExploradorHabil(char.classe, nivelNovo);
  const precisaAcademico = exigeAcademico(char.classe, nivelNovo);
  const pendencias = [];
  if (precisaSubclasse) pendencias.push('Escolher subclasse');
  if (ganhaAumentoAtributo) pendencias.push('Distribuir 2 pontos de atributo');
  if (precisaExpertiseBardo) pendencias.push('Escolher 2 perícias para Especialização do Bardo');
  if (precisaExpertiseGuardiao) pendencias.push('Escolher 2 perícias para Especialista do Guardião');
  if (precisaEstiloLuta) pendencias.push('Escolher Estilo de Luta');
  if (precisaExploradorHabil) pendencias.push('Escolher perícia e idiomas (Explorador Hábil)');
  if (precisaAcademico) pendencias.push('Escolher 2 perícias para Acadêmico do Mago');
  if (info.conjurador) pendencias.push('Revisar opções de magias deste nível');
  
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
      <h3 style="color:var(--accent);margin:0">Nível ${char.nivel} → Nível ${nivelNovo}</h3>
      <div style="font-size:0.9rem;color:var(--text-muted);margin-top:4px">
        ${char.especie} ${char.classe}
      </div>
    </div>

    <div class="card" style="background:var(--surface-variant);margin-bottom:12px">
      <div style="font-weight:700;margin-bottom:8px;color:var(--accent)">Resumo desta subida</div>
      ${pendencias.length > 0 ? `
        <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:6px">Antes de confirmar, você precisa:</div>
        <ul style="margin:0;padding-left:20px;font-size:0.9rem">
          ${pendencias.map(p => `<li>${p}</li>`).join('')}
        </ul>
      ` : `<div style="font-size:0.9rem;color:var(--success)">Nenhuma escolha obrigatória pendente.</div>`}
    </div>
    
    <div class="card" style="background:var(--surface-variant);margin-bottom:12px">
      <div style="font-weight:700;margin-bottom:8px;color:var(--accent)">Ganhos automáticos ao confirmar</div>
      <ul style="margin:0;padding-left:20px;font-size:0.9rem">
        <li><strong>Bônus de Proficiência:</strong> atualizado automaticamente quando aplicável</li>
        ${caracteristicas.length > 0 ? caracteristicas.map(c => `<li>${c}</li>`).join('') : '<li>Nenhuma característica nova neste nível</li>'}
        ${caracteristicasEspecie.length > 0 ? caracteristicasEspecie.map(c => `<li><strong>[Espécie]</strong> ${c.nome}</li>`).join('') : ''}
      </ul>
    </div>

    <div class="card" style="background:var(--surface-variant);margin-bottom:12px">
      <div style="font-weight:700;margin-bottom:8px;color:var(--accent)">Pontos de Vida ao subir de nível</div>
      <div style="display:flex;flex-direction:column;gap:8px;font-size:0.9rem">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
          <input type="radio" name="levelup-hp-modo" value="fixo" checked>
          <span>Valor fixo recomendado: <strong id="levelup-hp-previa-fixo">+${hpGanhoFixo} PV</strong> (média do d${info.dado_vida} + CON)</span>
        </label>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;flex-wrap:wrap">
          <input type="radio" name="levelup-hp-modo" value="rolado">
          <span>Usar rolagem: d${info.dado_vida} + CON</span>
          <input type="number" class="form-input" id="levelup-hp-rolado" min="1" max="${info.dado_vida}" step="1" value="1" style="width:88px" disabled>
          <span id="levelup-hp-previa-rolado" style="font-size:0.85rem;color:var(--text-muted)">Resultado aplicado: +${Math.max(1, 1 + modCon)} PV</span>
        </label>
      </div>
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
  
  // Se ganha aumento de atributo (ou talento)
  if (ganhaAumentoAtributo) {
    // Montar lista de talentos disponiveis (Geral nivel 4+)
    const _talentosDisponiveis = [];
    if (talentosCache?.por_categoria) {
      Object.values(talentosCache.por_categoria).forEach(lista => {
        lista.forEach(t => {
          // Pré-requisito "Nível 4 ou superior" ou sem pré-requisito (Origem)
          const preq = (t.prerequisito || '').toLowerCase();
          const ehNivel4 = preq.includes('nível 4') || preq.includes('nivel 4');
          const ehOrigem = t.categoria === 'de Origem';
          if (ehNivel4 || ehOrigem) {
            // Excluir talentos "Aumento no Valor de Atributo" (já coberto pela opção de atributos)
            if (t.nome === 'Aumento no Valor de Atributo') return;
            // Excluir talentos que o personagem ja possui (exceto repetiveis)
            const jaTemTalento = (char.talentos || []).some(ct => (typeof ct === 'string' ? ct : ct.nome) === t.nome);
            const ehRepetivel = (t.beneficios || []).some(b => b.nome === 'Repetível');
            if (jaTemTalento && !ehRepetivel) return;
            _talentosDisponiveis.push(t);
          }
        });
      });
    }
    _talentosDisponiveis.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

    conteudoModal += `
      <div class="section-divider mt-2"><span>Aumento de Atributo ou Talento</span></div>
      <div style="display:flex;gap:12px;margin-bottom:10px">
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:0.9rem">
          <input type="radio" name="levelup-asi-modo" value="atributo" checked> Aumentar Atributos
        </label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:0.9rem">
          <input type="radio" name="levelup-asi-modo" value="talento"> Escolher Talento
        </label>
      </div>

      <div id="levelup-asi-atributos">
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
      </div>

      <div id="levelup-asi-talento" style="display:none">
        <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:8px">
          Escolha um talento em vez de aumentar atributos.
        </div>
        <select id="levelup-talento-select" class="form-input" style="width:100%;margin-bottom:8px">
          <option value="">-- Selecione um talento --</option>
          ${(() => {
            const porCat = {};
            _talentosDisponiveis.forEach(t => {
              const cat = t.categoria || 'Outros';
              if (!porCat[cat]) porCat[cat] = [];
              porCat[cat].push(t);
            });
            return Object.entries(porCat).map(([cat, lista]) => `
              <optgroup label="${cat}">
                ${lista.map(t => `<option value="${t.nome}">${t.nome}</option>`).join('')}
              </optgroup>
            `).join('');
          })()}
        </select>
        <div id="levelup-talento-detalhe" style="background:var(--surface-variant);border-radius:8px;padding:12px;font-size:0.85rem;display:none"></div>
        <div id="levelup-talento-escolhas"></div>
      </div>
    `;
  }

  if (precisaExpertiseBardo) {
    const proficientes = (char.pericias_proficientes || []);
    const expertiseAtual = new Set(char.pericias_expertise || []);
    const elegiveis = proficientes.filter(p => !expertiseAtual.has(p));

    conteudoModal += `
      <div class="section-divider mt-2"><span>Especialização do Bardo</span></div>
      <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:8px">
        Selecione exatamente 2 perícias já proficientes para receber Especialização.
      </div>
      <div id="levelup-bardo-expertise" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:6px">
        ${elegiveis.map(p => `
          <label class="form-check" style="display:flex;align-items:center;gap:6px;padding:6px 8px;border:1px solid var(--border-light);border-radius:6px">
            <input type="checkbox" data-bardo-expertise="${p}"> ${p}
          </label>
        `).join('')}
      </div>
      <div style="font-size:0.8rem;color:var(--text-muted);margin-top:8px;text-align:center">
        Selecionadas: <span id="levelup-bardo-expertise-count" style="font-weight:700">0</span>/2
      </div>
    `;
  }

  if (precisaExpertiseGuardiao) {
    const proficientes = (char.pericias_proficientes || []);
    const expertiseAtual = new Set(char.pericias_expertise || []);
    const elegiveis = proficientes.filter(p => !expertiseAtual.has(p));

    conteudoModal += `
      <div class="section-divider mt-2"><span>Especialista do Guardião</span></div>
      <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:8px">
        Selecione exatamente 2 perícias já proficientes para receber Especialização.
      </div>
      <div id="levelup-guardiao-expertise" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:6px">
        ${elegiveis.map(p => `
          <label class="form-check" style="display:flex;align-items:center;gap:6px;padding:6px 8px;border:1px solid var(--border-light);border-radius:6px">
            <input type="checkbox" data-guardiao-expertise="${p}"> ${p}
          </label>
        `).join('')}
      </div>
      <div style="font-size:0.8rem;color:var(--text-muted);margin-top:8px;text-align:center">
        Selecionadas: <span id="levelup-guardiao-expertise-count" style="font-weight:700">0</span>/2
      </div>
    `;
  }

  // --- Estilo de Luta (Guardião nv2, Paladino nv2) ---
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
    // Variante especial por classe
    if (char.classe === 'Guardião') {
      opcoesBase.push({ nome: 'Combatente Druídico', descricao: 'Aprende 2 truques de Druida (Sabedoria)' });
    }
    if (char.classe === 'Paladino') {
      opcoesBase.push({ nome: 'Combatente Abençoado', descricao: 'Aprende 2 truques de Clérigo (Carisma)' });
    }

    conteudoModal += `
      <div class="section-divider mt-2"><span>Estilo de Luta</span></div>
      <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:8px">
        Escolha um Estilo de Luta. A escolha é permanente.
      </div>
      <div id="levelup-estilo-luta" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:6px">
        ${opcoesBase.map(opt => `
          <label class="form-check" style="display:flex;align-items:center;gap:6px;padding:6px 8px;border:1px solid var(--border-light);border-radius:6px;cursor:pointer">
            <input type="radio" name="estilo_luta" value="${opt.nome}" data-estilo-luta="${opt.nome}">
            <div>
              <div style="font-weight:600;font-size:0.85rem">${opt.nome}</div>
              <div style="font-size:0.75rem;color:var(--text-muted)">${opt.descricao}</div>
            </div>
          </label>
        `).join('')}
      </div>
    `;
  }

  // --- Explorador Hábil (Guardião nv2: 1 expertise + 2 idiomas) ---
  if (precisaExploradorHabil) {
    const proficientes = (char.pericias_proficientes || []);
    const expertiseAtual = new Set(char.pericias_expertise || []);
    const elegiveisExp = proficientes.filter(p => !expertiseAtual.has(p));

    const idiomasDisponiveis = [
      'Língua de Sinais Comum', 'Dracônico', 'Anão', 'Élfico',
      'Gigante', 'Gnômico', 'Goblin', 'Pequenino', 'Orc'
    ];
    const idiomasJaPossuidos = new Set(char.idiomas || []);
    const idiomasElegiveis = idiomasDisponiveis.filter(i => !idiomasJaPossuidos.has(i));

    conteudoModal += `
      <div class="section-divider mt-2"><span>Explorador Hábil</span></div>
      <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:8px">
        Escolha 1 perícia para Especialização e 2 idiomas.
      </div>
      <div style="font-weight:600;font-size:0.85rem;margin-bottom:4px">Especialização (1 perícia):</div>
      <div id="levelup-explorador-expertise" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:6px;margin-bottom:12px">
        ${elegiveisExp.map(p => `
          <label class="form-check" style="display:flex;align-items:center;gap:6px;padding:6px 8px;border:1px solid var(--border-light);border-radius:6px;cursor:pointer">
            <input type="radio" name="explorador_expertise" value="${p}" data-explorador-expertise="${p}"> ${p}
          </label>
        `).join('')}
      </div>
      <div style="font-weight:600;font-size:0.85rem;margin-bottom:4px">Idiomas (2):</div>
      <div id="levelup-explorador-idiomas" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:6px">
        ${idiomasElegiveis.map(i => `
          <label class="form-check" style="display:flex;align-items:center;gap:6px;padding:6px 8px;border:1px solid var(--border-light);border-radius:6px;cursor:pointer">
            <input type="checkbox" data-explorador-idioma="${i}"> ${i}
          </label>
        `).join('')}
      </div>
      <div style="font-size:0.8rem;color:var(--text-muted);margin-top:8px;text-align:center">
        Idiomas selecionados: <span id="levelup-explorador-idiomas-count" style="font-weight:700">0</span>/2
      </div>
    `;
  }

  // --- Acadêmico (Mago nv2: 2 expertise em perícias de conhecimento) ---
  if (precisaAcademico) {
    const periciasAcademicas = ['Arcanismo', 'História', 'Investigação', 'Medicina', 'Natureza', 'Religião'];
    const expertiseAtual = new Set(char.pericias_expertise || []);
    const elegiveisAc = periciasAcademicas.filter(p => !expertiseAtual.has(p));

    conteudoModal += `
      <div class="section-divider mt-2"><span>Acadêmico</span></div>
      <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:8px">
        Selecione 2 perícias de conhecimento para Especialização.
      </div>
      <div id="levelup-academico" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:6px">
        ${elegiveisAc.map(p => `
          <label class="form-check" style="display:flex;align-items:center;gap:6px;padding:6px 8px;border:1px solid var(--border-light);border-radius:6px">
            <input type="checkbox" data-academico-expertise="${p}"> ${p}
          </label>
        `).join('')}
      </div>
      <div style="font-size:0.8rem;color:var(--text-muted);margin-top:8px;text-align:center">
        Selecionadas: <span id="levelup-academico-count" style="font-weight:700">0</span>/2
      </div>
    `;
  }
  
  // --- Seção de seleção de magias no level up ---
  const ehSubConj = ehSubclasseConjuradora();
  if (info.conjurador || ehSubConj) {
    // Subclasses conjuradoras (Cavaleiro Mistico, Trapaceiro Arcano) sao tipo "conhecidas"
    const tipoConj = info.tipo_conjuracao || (ehSubConj ? 'conhecidas' : 'preparadas');
    const tabela = classeData?.tabela_caracteristicas;
    let truquesAtual = tabela ? getTruquesConhecidos(tabela, char.nivel) : 0;
    let truquesNovo = tabela ? getTruquesConhecidos(tabela, nivelNovo) : 0;
    let magiasAtual = tabela ? getMagiaPreparadas(tabela, char.nivel) : 0;
    let magiasNovo = tabela ? getMagiaPreparadas(tabela, nivelNovo) : 0;

    // Para subclasses conjuradoras, calcular limites a partir da tabela da subclasse
    if (ehSubConj) {
      const subAtual = getSubclasseConjuradoraConjuracao();
      // Calcular para o nível novo temporariamente
      const nivelOriginal = char.nivel;
      char.nivel = nivelNovo;
      const subNovo = getSubclasseConjuradoraConjuracao();
      char.nivel = nivelOriginal;

      truquesAtual = subAtual?.truques || 0;
      truquesNovo = subNovo?.truques || 0;
      magiasAtual = subAtual?.preparadas || 0;
      magiasNovo = subNovo?.preparadas || 0;
    }
    const truquesGanhos = truquesNovo - truquesAtual;

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
      const magiasAtuais = (char.magias_preparadas || []).filter(m => m.circulo > 0 && magiaContaNoLimite(m));
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
      <strong>Importante:</strong> Revise suas escolhas antes de confirmar. Após confirmar, a ficha será atualizada para o novo nível.
    </div>
  `;
  
  abrirModal(`⬆ Subir para Nível ${nivelNovo}`, conteudoModal, 
    '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-accent" id="btn-confirmar-levelup">Confirmar subida para Nível ' + nivelNovo + '</button>');

  // Eventos do modo de ganho de PV
  const hpModoRadios = document.querySelectorAll('input[name="levelup-hp-modo"]');
  const hpRoladoInput = document.getElementById('levelup-hp-rolado');
  const hpPreviaRolado = document.getElementById('levelup-hp-previa-rolado');

  function atualizarEstadoHpRolado() {
    const modo = document.querySelector('input[name="levelup-hp-modo"]:checked')?.value || 'fixo';
    if (hpRoladoInput) hpRoladoInput.disabled = modo !== 'rolado';
  }

  function atualizarPreviaHpRolado() {
    if (!hpRoladoInput || !hpPreviaRolado) return;
    const rolado = parseInt(hpRoladoInput.value) || 1;
    const clamp = Math.max(1, Math.min(info.dado_vida, rolado));
    hpRoladoInput.value = String(clamp);
    hpPreviaRolado.textContent = `Resultado aplicado: +${Math.max(1, clamp + modCon)} PV`;
  }

  hpModoRadios.forEach(r => r.addEventListener('change', atualizarEstadoHpRolado));
  hpRoladoInput?.addEventListener('input', atualizarPreviaHpRolado);
  atualizarEstadoHpRolado();
  atualizarPreviaHpRolado();
  
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
  // Variavel para rastrear modo atual (atributo ou talento)
  let _levelupAsiModo = 'atributo';
  if (ganhaAumentoAtributo) {
    // Handler para toggle entre atributo e talento
    const radiosAsi = document.querySelectorAll('input[name="levelup-asi-modo"]');
    const divAtributos = document.getElementById('levelup-asi-atributos');
    const divTalento = document.getElementById('levelup-asi-talento');
    radiosAsi.forEach(r => {
      r.addEventListener('change', () => {
        _levelupAsiModo = r.value;
        if (divAtributos) divAtributos.style.display = r.value === 'atributo' ? 'block' : 'none';
        if (divTalento) divTalento.style.display = r.value === 'talento' ? 'block' : 'none';
      });
    });

    // Handler para select de talento — mostrar descricao e escolhas
    const selTalento = document.getElementById('levelup-talento-select');
    const detalheEl = document.getElementById('levelup-talento-detalhe');
    const escolhasEl = document.getElementById('levelup-talento-escolhas');

    // Constantes para escolhas de talentos (mesmo padrao de creator.js)
    const _PERICIAS_NOMES_LU = [
      'Acrobacia','Arcanismo','Atletismo','Atuação','Enganação','Furtividade',
      'História','Intimidação','Intuição','Investigação','Lidar com Animais',
      'Medicina','Natureza','Percepção','Persuasão','Prestidigitação',
      'Religião','Sobrevivência'
    ];
    const _FERRAMENTAS_TODAS_LU = [
      'Ferramentas de Carpinteiro','Ferramentas de Cartógrafo','Ferramentas de Coureiro',
      'Ferramentas de Entalhador','Ferramentas de Ferreiro','Ferramentas de Funileiro',
      'Ferramentas de Joalheiro','Ferramentas de Oleiro','Ferramentas de Pedreiro',
      'Ferramentas de Sapateiro','Ferramentas de Tecelão','Ferramentas de Vidreiro',
      'Suprimentos de Alquimista','Suprimentos de Calígrafo','Suprimentos de Cervejeiro',
      'Suprimentos de Pintor','Utensílios de Cozinheiro',
      'Ferramentas de Ladrão','Ferramentas de Navegador',
      'Kit de Disfarce','Kit de Falsificação','Kit de Herbalismo','Kit de Veneno'
    ];
    const _INSTRUMENTOS_LU = [
      'Alaúde','Flauta','Flauta de Pan','Gaita de Foles','Lira',
      'Oboé','Tambor','Trombeta','Violino','Xilofone'
    ];
    const _FERRAMENTAS_ARTESAO_LU = [
      'Ferramentas de Carpinteiro','Ferramentas de Cartógrafo','Ferramentas de Coureiro',
      'Ferramentas de Entalhador','Ferramentas de Ferreiro','Ferramentas de Funileiro',
      'Ferramentas de Joalheiro','Ferramentas de Oleiro','Ferramentas de Pedreiro',
      'Ferramentas de Sapateiro','Ferramentas de Tecelão','Ferramentas de Vidreiro',
      'Suprimentos de Alquimista','Suprimentos de Calígrafo','Suprimentos de Cervejeiro',
      'Suprimentos de Pintor','Utensílios de Cozinheiro'
    ];

    /** Extrai atributos permitidos de um beneficio de ASI do talento */
    function _extrairAtributosAsiTalento(talentoData) {
      if (!talentoData?.beneficios) return [];
      const benASI = talentoData.beneficios.find(b => b.nome === 'Aumento no Valor de Atributo');
      if (!benASI?.descricao) return [];
      const desc = benASI.descricao;
      // Mapa de nomes PT -> chave interna
      const mapa = {
        'Força': 'forca', 'Destreza': 'destreza', 'Constituição': 'constituicao',
        'Inteligência': 'inteligencia', 'Sabedoria': 'sabedoria', 'Carisma': 'carisma'
      };
      const encontrados = [];
      for (const [nome, chave] of Object.entries(mapa)) {
        if (desc.includes(nome)) encontrados.push({ nome, chave });
      }
      return encontrados;
    }

    /** Gera HTML de selects de escolha para talento no level-up */
    function _renderEscolhasTalentoLevelup(talentoNome, talentoData) {
      const prefix = 'escolha-talento-levelup';
      let html = '';

      // Aumento de Atributo embutido no talento (+1 em atributo especifico)
      const atributosASI = _extrairAtributosAsiTalento(talentoData);
      if (atributosASI.length > 0) {
        html += `<div class="section-divider" style="margin-top:8px"><span>Aumento de Atributo (+1)</span></div>`;
        if (atributosASI.length === 1) {
          // Apenas um atributo possivel - selecao automatica
          html += `<div class="info-box info" style="font-size:0.8rem">+1 em ${atributosASI[0].nome} (automático)</div>`;
          html += `<input type="hidden" id="levelup-talento-asi" value="${atributosASI[0].chave}">`;
        } else {
          html += `<div class="info-box info" style="font-size:0.8rem">Escolha qual atributo aumentar em +1 (máximo 20).</div>`;
          html += `<select id="levelup-talento-asi" class="form-input" style="width:100%;margin:4px 0">`;
          html += `<option value="">-- Escolha o atributo --</option>`;
          atributosASI.forEach(a => {
            const valorAtual = char.atributos[a.chave] || 10;
            const desabilitado = valorAtual >= 20 ? 'disabled' : '';
            html += `<option value="${a.chave}" ${desabilitado}>${a.nome} (atual: ${valorAtual})${valorAtual >= 20 ? ' - máximo' : ''}</option>`;
          });
          html += `</select>`;
        }
      }

      if (talentoNome === 'Habilidoso') {
        html += `<div class="section-divider" style="margin-top:8px"><span>Escolhas — Habilidoso</span></div>`;
        html += `<div class="info-box info" style="font-size:0.8rem">Escolha 3 perícias ou ferramentas para adquirir proficiência.</div>`;
        for (let i = 0; i < 3; i++) {
          html += `<select class="${prefix}" data-idx="${i}" style="width:100%;padding:6px;border-radius:var(--radius-sm);border:1px solid var(--border);font-size:0.85rem;margin:4px 0">`;
          html += `<option value="">-- Escolha ${i + 1} --</option>`;
          html += `<optgroup label="Perícias">`;
          _PERICIAS_NOMES_LU.forEach(p => { html += `<option value="${p}">${p}</option>`; });
          html += `</optgroup><optgroup label="Ferramentas">`;
          _FERRAMENTAS_TODAS_LU.forEach(f => { html += `<option value="${f}">${f}</option>`; });
          html += `</optgroup></select>`;
        }
      }
      if (talentoNome === 'Artifista') {
        html += `<div class="section-divider" style="margin-top:8px"><span>Escolhas — Artifista</span></div>`;
        html += `<div class="info-box info" style="font-size:0.8rem">Escolha 3 Ferramentas de Artesão para adquirir proficiência.</div>`;
        for (let i = 0; i < 3; i++) {
          html += `<select class="${prefix}" data-idx="${i}" style="width:100%;padding:6px;border-radius:var(--radius-sm);border:1px solid var(--border);font-size:0.85rem;margin:4px 0">`;
          html += `<option value="">-- Escolha ${i + 1} --</option>`;
          _FERRAMENTAS_ARTESAO_LU.forEach(f => { html += `<option value="${f}">${f}</option>`; });
          html += `</select>`;
        }
      }
      if (talentoNome === 'Músico') {
        html += `<div class="section-divider" style="margin-top:8px"><span>Escolhas — Músico</span></div>`;
        html += `<div class="info-box info" style="font-size:0.8rem">Escolha 3 Instrumentos Musicais para adquirir proficiência.</div>`;
        for (let i = 0; i < 3; i++) {
          html += `<select class="${prefix}" data-idx="${i}" style="width:100%;padding:6px;border-radius:var(--radius-sm);border:1px solid var(--border);font-size:0.85rem;margin:4px 0">`;
          html += `<option value="">-- Escolha ${i + 1} --</option>`;
          _INSTRUMENTOS_LU.forEach(inst => { html += `<option value="${inst}">${inst}</option>`; });
          html += `</select>`;
        }
      }

      // Analítico: escolher 1 perícia de [Intuição, Investigação, Percepção]
      if (talentoNome === 'Analítico') {
        const _periciasAnalitico = ['Intuição', 'Investigação', 'Percepção'];
        html += `<div class="section-divider" style="margin-top:8px"><span>Escolhas — Analítico</span></div>`;
        html += `<div class="info-box info" style="font-size:0.8rem">Escolha 1 perícia. Se não tiver proficiência, adquire; se já for proficiente, adquire Especialização.</div>`;
        html += `<select class="${prefix}" data-idx="0" style="width:100%;padding:6px;border-radius:var(--radius-sm);border:1px solid var(--border);font-size:0.85rem;margin:4px 0">`;
        html += `<option value="">-- Escolha a perícia --</option>`;
        _periciasAnalitico.forEach(p => {
          const temProf = (char.pericias_proficientes || []).includes(p);
          const temExp = (char.pericias_expertise || []).includes(p);
          let info = '';
          if (temExp) info = ' (já tem Especialização)';
          else if (temProf) info = ' → Especialização';
          else info = ' → Proficiência';
          html += `<option value="${p}" ${temExp ? 'disabled' : ''}>${p}${info}</option>`;
        });
        html += `</select>`;
      }

      // Mente Aguçada: escolher 1 perícia de [Arcanismo, História, Investigação, Natureza, Religião]
      if (talentoNome === 'Mente Aguçada') {
        const _periciasMente = ['Arcanismo', 'História', 'Investigação', 'Natureza', 'Religião'];
        html += `<div class="section-divider" style="margin-top:8px"><span>Escolhas — Mente Aguçada</span></div>`;
        html += `<div class="info-box info" style="font-size:0.8rem">Escolha 1 perícia. Se não tiver proficiência, adquire; se já for proficiente, adquire Especialização.</div>`;
        html += `<select class="${prefix}" data-idx="0" style="width:100%;padding:6px;border-radius:var(--radius-sm);border:1px solid var(--border);font-size:0.85rem;margin:4px 0">`;
        html += `<option value="">-- Escolha a perícia --</option>`;
        _periciasMente.forEach(p => {
          const temProf = (char.pericias_proficientes || []).includes(p);
          const temExp = (char.pericias_expertise || []).includes(p);
          let info = '';
          if (temExp) info = ' (já tem Especialização)';
          else if (temProf) info = ' → Especialização';
          else info = ' → Proficiência';
          html += `<option value="${p}" ${temExp ? 'disabled' : ''}>${p}${info}</option>`;
        });
        html += `</select>`;
      }

      // Especialista em Perícia: 1 perícia para proficiência + 1 perícia proficiente para expertise
      if (talentoNome === 'Especialista em Perícia') {
        html += `<div class="section-divider" style="margin-top:8px"><span>Escolhas — Especialista em Perícia</span></div>`;
        html += `<div class="info-box info" style="font-size:0.8rem">Escolha 1 perícia para Proficiência e 1 perícia já proficiente para Especialização.</div>`;
        html += `<select class="${prefix}" data-idx="0" data-tipo="proficiencia" style="width:100%;padding:6px;border-radius:var(--radius-sm);border:1px solid var(--border);font-size:0.85rem;margin:4px 0">`;
        html += `<option value="">-- Proficiência em --</option>`;
        _PERICIAS_NOMES_LU.forEach(p => {
          const temProf = (char.pericias_proficientes || []).includes(p);
          html += `<option value="${p}" ${temProf ? 'disabled' : ''}>${p}${temProf ? ' (já proficiente)' : ''}</option>`;
        });
        html += `</select>`;
        html += `<select class="${prefix}" data-idx="1" data-tipo="expertise" style="width:100%;padding:6px;border-radius:var(--radius-sm);border:1px solid var(--border);font-size:0.85rem;margin:4px 0">`;
        html += `<option value="">-- Especialização em --</option>`;
        const proficientes = (char.pericias_proficientes || []);
        const jaExpert = (char.pericias_expertise || []);
        proficientes.forEach(p => {
          const temExp = jaExpert.includes(p);
          html += `<option value="${p}" ${temExp ? 'disabled' : ''}>${p}${temExp ? ' (já tem Especialização)' : ''}</option>`;
        });
        html += `</select>`;
      }

      // Resiliente: escolher 1 atributo sem proficiência em salvaguarda
      if (talentoNome === 'Resiliente') {
        const _attrResiliente = [
          { nome: 'Força', chave: 'forca' }, { nome: 'Destreza', chave: 'destreza' },
          { nome: 'Constituição', chave: 'constituicao' }, { nome: 'Inteligência', chave: 'inteligencia' },
          { nome: 'Sabedoria', chave: 'sabedoria' }, { nome: 'Carisma', chave: 'carisma' }
        ];
        html += `<div class="section-divider" style="margin-top:8px"><span>Escolhas — Resiliente</span></div>`;
        html += `<div class="info-box info" style="font-size:0.8rem">Escolha um atributo sem proficiência em salvaguarda. Você ganha +1 no atributo e proficiência na salvaguarda.</div>`;
        html += `<select id="levelup-talento-resiliente" class="${prefix}" data-idx="0" style="width:100%;padding:6px;border-radius:var(--radius-sm);border:1px solid var(--border);font-size:0.85rem;margin:4px 0">`;
        html += `<option value="">-- Escolha o atributo --</option>`;
        _attrResiliente.forEach(a => {
          const temSalv = (char.salvaguardas_proficientes || []).includes(a.nome);
          const valorAtual = char.atributos[a.chave] || 10;
          html += `<option value="${a.chave}" ${temSalv ? 'disabled' : ''}>${a.nome} (atual: ${valorAtual})${temSalv ? ' - já proficiente' : ''}</option>`;
        });
        html += `</select>`;
      }

      // Adepto Elemental: escolher tipo de dano para Domínio Elemental
      if (talentoNome === 'Adepto Elemental') {
        const _tiposDano = ['Ácido', 'Elétrico', 'Gélido', 'Ígneo', 'Trovejante'];
        const tiposUsados = obterTiposAdeptoElementalUsados();
        const tiposDisponiveis = _tiposDano.filter(t => !tiposUsados.includes(t));
        html += `<div class="section-divider" style="margin-top:8px"><span>Escolhas — Domínio Elemental</span></div>`;
        if (tiposUsados.length > 0) {
          html += `<div class="info-box warning" style="font-size:0.8rem">Tipos já escolhidos: <strong>${tiposUsados.join(', ')}</strong>. Você deve escolher um tipo diferente.</div>`;
        }
        html += `<div class="info-box info" style="font-size:0.8rem">Escolha o tipo de dano do seu Domínio Elemental.</div>`;
        html += `<select class="${prefix}" data-idx="0" style="width:100%;padding:6px;border-radius:var(--radius-sm);border:1px solid var(--border);font-size:0.85rem;margin:4px 0">`;
        html += `<option value="">-- Tipo de dano --</option>`;
        tiposDisponiveis.forEach(t => { html += `<option value="${t}">${t}</option>`; });
        html += `</select>`;
      }

      // Tocado Por Fadas: escolher 1 magia de 1o círculo de Adivinhação ou Encantamento
      if (talentoNome === 'Tocado Por Fadas') {
        html += `<div class="section-divider" style="margin-top:8px"><span>Escolhas — Tocado Por Fadas</span></div>`;
        html += `<div class="info-box info" style="font-size:0.8rem">Escolha 1 magia de 1o círculo da escola de Adivinhação ou Encantamento.</div>`;
        html += `<div id="levelup-tocado-fadas-area" class="${prefix}" data-idx="0" data-tipo="magia-escola" data-escolas="Adivinhação,Encantamento">Carregando magias...</div>`;
      }

      // Tocado Pelas Sombras: escolher 1 magia de 1o círculo de Ilusão ou Necromancia
      if (talentoNome === 'Tocado Pelas Sombras') {
        html += `<div class="section-divider" style="margin-top:8px"><span>Escolhas — Tocado Pelas Sombras</span></div>`;
        html += `<div class="info-box info" style="font-size:0.8rem">Escolha 1 magia de 1o círculo da escola de Ilusão ou Necromancia.</div>`;
        html += `<div id="levelup-tocado-sombras-area" class="${prefix}" data-idx="0" data-tipo="magia-escola" data-escolas="Ilusão,Necromancia">Carregando magias...</div>`;
      }

      // Conjurador Ritualista: escolher magias de 1o círculo com Ritual
      if (talentoNome === 'Conjurador Ritualista') {
        const bonusProf = calcBonusProficiencia(char.nivel || 1);
        html += `<div class="section-divider" style="margin-top:8px"><span>Escolhas — Conjurador Ritualista</span></div>`;
        html += `<div class="info-box info" style="font-size:0.8rem">Escolha ${bonusProf} magias de 1o círculo com o marcador Ritual das listas de Clérigo, Druida ou Mago.</div>`;
        html += `<div id="levelup-ritualista-area" class="${prefix}" data-idx="0" data-tipo="ritual" data-quantidade="${bonusProf}">Carregando magias...</div>`;
      }

      // Iniciado em Magia: 2 truques + 1 magia 1o círculo + lista + atributo
      if (talentoNome === 'Iniciado em Magia') {
        const _listasIM = ['Clérigo', 'Druida', 'Mago'];
        const listasUsadas = obterListasIniciadoEmMagiaUsadas();
        const listasDisponiveis = _listasIM.filter(l => !listasUsadas.includes(l));
        const _attrIM = ['Inteligência', 'Sabedoria', 'Carisma'];
        html += `<div class="section-divider" style="margin-top:8px"><span>Escolhas — Iniciado em Magia</span></div>`;
        if (listasUsadas.length > 0) {
          html += `<div class="info-box warning" style="font-size:0.8rem">Listas já escolhidas: <strong>${listasUsadas.join(', ')}</strong>. Você deve escolher uma lista diferente.</div>`;
        }
        html += `<div class="info-box info" style="font-size:0.8rem">Escolha a lista de magias, atributo de conjuração, 2 truques e 1 magia de 1o círculo.</div>`;
        html += `<div style="display:flex;flex-wrap:wrap;gap:8px;margin:4px 0">`;
        html += `<div style="flex:1;min-width:140px"><label style="font-size:0.75rem;font-weight:600">Lista de Magias</label>`;
        html += `<select id="levelup-im-lista" class="form-input" style="width:100%"><option value="">Selecione...</option>`;
        listasDisponiveis.forEach(l => { html += `<option value="${l}">${l}</option>`; });
        html += `</select></div>`;
        html += `<div style="flex:1;min-width:140px"><label style="font-size:0.75rem;font-weight:600">Atributo de Conjuração</label>`;
        html += `<select id="levelup-im-atributo" class="form-input" style="width:100%"><option value="">Selecione...</option>`;
        _attrIM.forEach(a => { html += `<option value="${a}">${a}</option>`; });
        html += `</select></div></div>`;
        html += `<div id="levelup-im-area" class="${prefix}" data-idx="0" data-tipo="iniciado-magia">Selecione uma lista de magias acima</div>`;
      }
      return html;
    }

    // Carrega magias de 1o círculo filtradas por escola (Tocado Por Fadas / Tocado Pelas Sombras)
    async function _carregarMagiasPorEscola(talentoNome) {
      const isFadas = talentoNome === 'Tocado Por Fadas';
      const escolas = isFadas ? ['Adivinhação', 'Encantamento'] : ['Ilusão', 'Necromancia'];
      const areaId = isFadas ? 'levelup-tocado-fadas-area' : 'levelup-tocado-sombras-area';
      const area = document.getElementById(areaId);
      if (!area) return;

      try {
        const dados = await getMagiasPorCirculo(1);
        const magiasFiltradas = (dados?.magias || []).filter(m => escolas.includes(m.escola));
        if (magiasFiltradas.length === 0) {
          area.innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:8px">Nenhuma magia encontrada</div>';
          return;
        }
        let html = `<select id="levelup-magia-escola-select" class="form-input" style="width:100%;margin:4px 0">`;
        html += `<option value="">-- Escolha a magia --</option>`;
        magiasFiltradas.sort((a, b) => a.nome.localeCompare(b.nome)).forEach(m => {
          html += `<option value="${m.nome}">${m.nome} (${m.escola})</option>`;
        });
        html += `</select>`;
        area.innerHTML = html;
      } catch (e) {
        area.innerHTML = '<div style="color:var(--danger);font-size:0.8rem">Erro ao carregar magias</div>';
      }
    }

    // Carrega magias rituais de 1o círculo das listas de Clérigo, Druida e Mago
    async function _carregarMagiasRitual() {
      const area = document.getElementById('levelup-ritualista-area');
      if (!area) return;
      const qtd = parseInt(area.dataset.quantidade) || 2;

      try {
        // Carregar magias das 3 listas e filtrar as com Ritual
        const [clerigoData, druidaData, magoData, c1Data] = await Promise.all([
          getMagiasClasse('Clérigo'), getMagiasClasse('Druida'), getMagiasClasse('Mago'),
          getMagiasPorCirculo(1)
        ]);

        // Identificar magias de 1o círculo que são Ritual
        const magiasRitual = (c1Data?.magias || []).filter(m =>
          m.tempo_conjuracao && m.tempo_conjuracao.toLowerCase().includes('ritual')
        );

        // Filtrar apenas as que pertencem às listas de Clérigo, Druida ou Mago
        const _achatarLista = (data) => {
          const lista = data?.lista_magias?.['1º Círculo'] || [];
          return lista.map(m => typeof m === 'string' ? m : m.nome);
        };
        const nomesClasse = new Set([..._achatarLista(clerigoData), ..._achatarLista(druidaData), ..._achatarLista(magoData)]);
        const rituaisDisponiveis = magiasRitual.filter(m => nomesClasse.has(m.nome)).sort((a, b) => a.nome.localeCompare(b.nome));

        if (rituaisDisponiveis.length === 0) {
          area.innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:8px">Nenhuma magia ritual encontrada</div>';
          return;
        }

        let html = `<div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:4px">Selecione ${qtd} magias rituais:</div>`;
        html += `<div style="display:flex;flex-direction:column;gap:4px">`;
        rituaisDisponiveis.forEach(m => {
          // Identificar classes que possuem essa magia
          const classes = (m.classes || []).filter(c => ['Clérigo', 'Druida', 'Mago'].includes(c));
          html += `<label style="display:flex;align-items:center;gap:6px;padding:4px 6px;border-radius:var(--radius-sm);border:1px solid var(--border-light);cursor:pointer;font-size:0.85rem">
            <input type="checkbox" class="levelup-ritual-check" value="${m.nome}">
            <span>${m.nome}</span>
            <span style="font-size:0.7rem;color:var(--text-muted);margin-left:auto">${m.escola} | ${classes.join(', ')}</span>
          </label>`;
        });
        html += `</div>`;
        area.innerHTML = html;

        // Controlar limite de seleção
        area.querySelectorAll('.levelup-ritual-check').forEach(cb => {
          cb.addEventListener('change', () => {
            const selecionados = area.querySelectorAll('.levelup-ritual-check:checked').length;
            if (selecionados > qtd) {
              cb.checked = false;
              toast(`Máximo de ${qtd} magias rituais`, 'error');
            }
          });
        });
      } catch (e) {
        area.innerHTML = '<div style="color:var(--danger);font-size:0.8rem">Erro ao carregar magias</div>';
      }
    }

    // Setup para Iniciado em Magia no level-up (2 truques + 1 magia + lista + atributo)
    function _setupIniciadoEmMagiaLevelup() {
      // Estado temporário para seleções
      window._levelupIM = { lista: '', atributo: '', truques: [], magia: '' };

      document.getElementById('levelup-im-lista')?.addEventListener('change', async (e) => {
        window._levelupIM.lista = e.target.value;
        window._levelupIM.truques = [];
        window._levelupIM.magia = '';
        await _renderMagiasIMLevelup();
      });

      document.getElementById('levelup-im-atributo')?.addEventListener('change', (e) => {
        window._levelupIM.atributo = e.target.value;
      });
    }

    async function _renderMagiasIMLevelup() {
      const area = document.getElementById('levelup-im-area');
      if (!area) return;
      const im = window._levelupIM;
      if (!im?.lista) {
        area.innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:8px">Selecione uma lista de magias acima</div>';
        return;
      }

      try {
        const dados = await getMagiasClasse(im.lista);
        const listaMagias = dados?.lista_magias || {};
        const truquesDisp = (listaMagias['Truques'] || []).map(m => typeof m === 'string' ? { nome: m } : m).sort((a, b) => (a.nome || a).localeCompare(b.nome || b));
        const c1Disp = (listaMagias['1º Círculo'] || []).map(m => typeof m === 'string' ? { nome: m } : m).sort((a, b) => (a.nome || a).localeCompare(b.nome || b));

        area.innerHTML = `
          <div style="margin-top:8px">
            <div style="font-size:0.8rem;font-weight:600;margin-bottom:4px">Truques (${im.truques.length}/2):</div>
            <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px">
              ${truquesDisp.map(m => {
                const nome = m.nome || m;
                const sel = im.truques.includes(nome);
                return `<span class="badge levelup-im-truque" data-nome="${nome}" style="cursor:pointer;padding:3px 8px;font-size:0.78rem;border:1px solid ${sel ? 'var(--accent)' : 'var(--border-light)'};background:${sel ? 'var(--accent)15' : 'transparent'};color:${sel ? 'var(--accent)' : 'var(--text)'}">${nome}</span>`;
              }).join('')}
            </div>
            <div style="font-size:0.8rem;font-weight:600;margin-bottom:4px">Magia de 1o Círculo (${im.magia ? '1' : '0'}/1):</div>
            <select id="levelup-im-magia-select" class="form-input" style="width:100%">
              <option value="">-- Escolha a magia --</option>
              ${c1Disp.map(m => {
                const nome = m.nome || m;
                return `<option value="${nome}" ${im.magia === nome ? 'selected' : ''}>${nome}${m.escola ? ` (${m.escola})` : ''}</option>`;
              }).join('')}
            </select>
          </div>
        `;

        // Eventos dos truques
        area.querySelectorAll('.levelup-im-truque').forEach(el => {
          el.addEventListener('click', () => {
            const nome = el.dataset.nome;
            const idx = im.truques.indexOf(nome);
            if (idx >= 0) { im.truques.splice(idx, 1); }
            else if (im.truques.length >= 2) { toast('Máximo de 2 truques para Iniciado em Magia', 'error'); return; }
            else { im.truques.push(nome); }
            _renderMagiasIMLevelup();
          });
        });

        // Evento da magia de 1o círculo
        document.getElementById('levelup-im-magia-select')?.addEventListener('change', (e) => {
          im.magia = e.target.value;
        });
      } catch (e) {
        area.innerHTML = '<div style="color:var(--danger);font-size:0.8rem">Erro ao carregar magias</div>';
      }
    }

    if (selTalento) {
      selTalento.addEventListener('change', () => {
        const nome = selTalento.value;
        if (!nome) {
          if (detalheEl) { detalheEl.innerHTML = ''; detalheEl.style.display = 'none'; }
          if (escolhasEl) escolhasEl.innerHTML = '';
          return;
        }
        // Buscar dados do talento no cache
        let td = null;
        if (talentosCache?.por_categoria) {
          for (const lista of Object.values(talentosCache.por_categoria)) {
            td = lista.find(t => t.nome === nome);
            if (td) break;
          }
        }
        // Mostrar descricao
        if (detalheEl && td) {
          let html = '';
          if (td.descricao) html += `<div class="md-content">${mdParaHtml(td.descricao)}</div>`;
          if (td.beneficios?.length) {
            html += '<div style="margin-top:6px">';
            td.beneficios.forEach(b => {
              html += `<div style="margin-bottom:4px"><strong>${b.nome}:</strong> ${mdParaHtml(b.descricao)}</div>`;
            });
            html += '</div>';
          }
          detalheEl.innerHTML = html;
          detalheEl.style.display = 'block';
        }
        // Mostrar escolhas se necessario
        if (escolhasEl) {
          escolhasEl.innerHTML = _renderEscolhasTalentoLevelup(nome, td);

          // Carregar magias assíncronas para talentos que exigem seleção de magias
          if (nome === 'Tocado Por Fadas' || nome === 'Tocado Pelas Sombras') {
            _carregarMagiasPorEscola(nome);
          }
          if (nome === 'Conjurador Ritualista') {
            _carregarMagiasRitual();
          }
          if (nome === 'Iniciado em Magia') {
            _setupIniciadoEmMagiaLevelup();
          }
        }
      });
    }

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

  if (precisaExpertiseBardo) {
    const checks = [...document.querySelectorAll('[data-bardo-expertise]')];
    const countEl = document.getElementById('levelup-bardo-expertise-count');

    const atualizarCount = () => {
      const marcadas = checks.filter(c => c.checked).length;
      if (countEl) {
        countEl.textContent = String(marcadas);
        countEl.style.color = marcadas === 2 ? 'var(--success)' : (marcadas > 2 ? 'var(--danger)' : 'inherit');
      }
      checks.forEach(c => {
        if (!c.checked) c.disabled = marcadas >= 2;
      });
    };

    checks.forEach(c => c.addEventListener('change', atualizarCount));
    atualizarCount();
  }

  if (precisaExpertiseGuardiao) {
    const checks = [...document.querySelectorAll('[data-guardiao-expertise]')];
    const countEl = document.getElementById('levelup-guardiao-expertise-count');

    const atualizarCount = () => {
      const marcadas = checks.filter(c => c.checked).length;
      if (countEl) {
        countEl.textContent = String(marcadas);
        countEl.style.color = marcadas === 2 ? 'var(--success)' : (marcadas > 2 ? 'var(--danger)' : 'inherit');
      }
      checks.forEach(c => {
        if (!c.checked) c.disabled = marcadas >= 2;
      });
    };

    checks.forEach(c => c.addEventListener('change', atualizarCount));
    atualizarCount();
  }

  // Handler: Explorador Hábil - idiomas (max 2)
  if (precisaExploradorHabil) {
    const checksIdiomas = [...document.querySelectorAll('[data-explorador-idioma]')];
    const countIdiomasEl = document.getElementById('levelup-explorador-idiomas-count');

    const atualizarCountIdiomas = () => {
      const marcadas = checksIdiomas.filter(c => c.checked).length;
      if (countIdiomasEl) {
        countIdiomasEl.textContent = String(marcadas);
        countIdiomasEl.style.color = marcadas === 2 ? 'var(--success)' : (marcadas > 2 ? 'var(--danger)' : 'inherit');
      }
      checksIdiomas.forEach(c => {
        if (!c.checked) c.disabled = marcadas >= 2;
      });
    };

    checksIdiomas.forEach(c => c.addEventListener('change', atualizarCountIdiomas));
    atualizarCountIdiomas();
  }

  // Handler: Acadêmico - expertise (max 2)
  if (precisaAcademico) {
    const checksAcademico = [...document.querySelectorAll('[data-academico-expertise]')];
    const countAcademicoEl = document.getElementById('levelup-academico-count');

    const atualizarCountAcademico = () => {
      const marcadas = checksAcademico.filter(c => c.checked).length;
      if (countAcademicoEl) {
        countAcademicoEl.textContent = String(marcadas);
        countAcademicoEl.style.color = marcadas === 2 ? 'var(--success)' : (marcadas > 2 ? 'var(--danger)' : 'inherit');
      }
      checksAcademico.forEach(c => {
        if (!c.checked) c.disabled = marcadas >= 2;
      });
    };

    checksAcademico.forEach(c => c.addEventListener('change', atualizarCountAcademico));
    atualizarCountAcademico();
  }

  // --- Eventos de seleção de magias no level up ---
  if (info.conjurador || ehSubConj) {
    // Subclasses conjuradoras (Cavaleiro Mistico, Trapaceiro Arcano) sao tipo "conhecidas"
    const tipoConj = info.tipo_conjuracao || (ehSubConj ? 'conhecidas' : 'preparadas');
    const tabela = classeData?.tabela_caracteristicas;
    let truquesAtual = tabela ? getTruquesConhecidos(tabela, char.nivel) : 0;
    let truquesNovo = tabela ? getTruquesConhecidos(tabela, nivelNovo) : 0;
    let magiasAtual = tabela ? getMagiaPreparadas(tabela, char.nivel) : 0;
    let magiasNovo = tabela ? getMagiaPreparadas(tabela, nivelNovo) : 0;

    // Para subclasses conjuradoras, calcular limites a partir da tabela da subclasse
    if (ehSubConj) {
      const subAtual = getSubclasseConjuradoraConjuracao();
      const nivelOriginal = char.nivel;
      char.nivel = nivelNovo;
      const subNovo = getSubclasseConjuradoraConjuracao();
      char.nivel = nivelOriginal;

      truquesAtual = subAtual?.truques || 0;
      truquesNovo = subNovo?.truques || 0;
      magiasAtual = subAtual?.preparadas || 0;
      magiasNovo = subNovo?.preparadas || 0;
    }
    const truquesGanhos = truquesNovo - truquesAtual;
    const magiasGanhas = magiasNovo - magiasAtual;

    // Carregar magias da classe para buscas
    const listaMagiasClasse = await obterMagiasDisponiveisClasseAtual();

    // Espaços disponíveis no novo nível
    let espacosNovo = tabela ? getEspacosMagia(tabela, nivelNovo) : {};
    // Fallback para subclasses conjuradoras
    if (ehSubConj && Object.keys(espacosNovo).length === 0) {
      const nivelOriginal = char.nivel;
      char.nivel = nivelNovo;
      const subNovo = getSubclasseConjuradoraConjuracao();
      char.nivel = nivelOriginal;
      espacosNovo = subNovo?.espacos || {};
    }
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
              <span class="magia-card-check" data-grid-check="${m.nome}"></span>
              <div class="magia-card-nome" data-grid-info="${m.nome}" data-grid-info-circ="${m.circulo}">${m.nome}</div>
              <div class="magia-card-meta">
                <span>${m.circulo === 0 ? 'Truque' : m.circulo + 'º Círculo'}</span>
                <span>${m.escola || ''}</span>
                ${m.especial === 'C' ? '<span>Conc.</span>' : ''}
              </div>
            </div>`;
        }).join('');

        // Atualizar contador
        const cntEl = document.getElementById('grid-sel-count');
        if (cntEl) {
          cntEl.textContent = selecionadosSet.size;
          cntEl.style.color = selecionadosSet.size === maxSelecoes ? 'var(--success)' : (selecionadosSet.size > maxSelecoes ? 'var(--danger)' : 'inherit');
        }

        // Eventos: clicar no check faz toggle, clicar no nome/card abre detalhes
        gridEl.querySelectorAll('[data-grid-check]').forEach(check => {
          check.addEventListener('click', (e) => {
            e.stopPropagation();
            const nome = check.dataset.gridCheck;
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

        // Clicar no nome/card abre detalhes da magia
        gridEl.querySelectorAll('[data-grid-info]').forEach(el => {
          el.addEventListener('click', async (e) => {
            e.stopPropagation();
            const nome = el.dataset.gridInfo;
            const circ = parseInt(el.dataset.gridInfoCirc);
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
              ${magia.circulo_superior ? `<div class="info-box info mt-1"><strong>Em circulos superiores:</strong><div class="md-content">${mdParaHtml(magia.circulo_superior)}</div></div>` : ''}
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
                <div class="magia-card-nome" data-lvlup-info="${m.nome}" data-lvlup-circ="${m.circulo}">${m.nome}</div>
                <div class="magia-card-meta">
                  <span>${m.circulo}º Círculo</span><span>${m.escola || ''}</span>
                  ${m.especial === 'C' ? '<span>Conc.</span>' : ''}
                </div>
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
                  ${magia.circulo_superior ? `<div class="info-box info mt-1"><strong>Em círculos superiores:</strong><div class="md-content">${mdParaHtml(magia.circulo_superior)}</div></div>` : ''}
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

    // Definir modo de ganho de PV
    const hpModo = document.querySelector('input[name="levelup-hp-modo"]:checked')?.value || 'fixo';
    opcoes.hp_modo = hpModo;
    if (hpModo === 'rolado') {
      const hpRolado = parseInt(document.getElementById('levelup-hp-rolado')?.value);
      if (Number.isNaN(hpRolado) || hpRolado < 1 || hpRolado > info.dado_vida) {
        toast(`Informe uma rolagem válida entre 1 e ${info.dado_vida}`, 'error');
        return;
      }
      opcoes.hp_rolado = hpRolado;
    }
    
    // Validar subclasse se necessário
    if (precisaSubclasse) {
      const subclasse = document.getElementById('levelup-subclasse')?.value?.trim();
      if (!subclasse) {
        toast('Você deve escolher uma subclasse para continuar', 'error');
        return;
      }
      opcoes.subclasse = subclasse;
    }
    
    // Validar aumento de atributo OU talento
    if (ganhaAumentoAtributo) {
      if (_levelupAsiModo === 'atributo') {
        // Modo: aumento de atributos
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
      } else {
        // Modo: escolher talento
        const talentoNome = document.getElementById('levelup-talento-select')?.value;
        if (!talentoNome) {
          toast('Selecione um talento', 'error');
          return;
        }
        opcoes.talento = talentoNome;

        // Validar ASI do talento (Adepto Elemental, Agressor, etc.)
        const asiEl = document.getElementById('levelup-talento-asi');
        if (asiEl && !asiEl.value) {
          toast('Selecione o atributo para o aumento do talento', 'error');
          return;
        }
        if (asiEl?.value) {
          opcoes.talento_asi = asiEl.value;
        }

        // Validar escolhas do talento (Habilidoso/Artifista/Músico)
        const _talentoExige = ['Habilidoso', 'Artifista', 'Músico'].includes(talentoNome);
        if (_talentoExige) {
          const selects = [...document.querySelectorAll('.escolha-talento-levelup')];
          const valores = selects.map(s => s.value);
          if (valores.some(v => !v)) {
            toast('Preencha todas as escolhas do talento', 'error');
            return;
          }
          const unicos = new Set(valores);
          if (unicos.size !== valores.length) {
            toast('As escolhas do talento não podem ser duplicadas', 'error');
            return;
          }
          opcoes.escolhas_talento_levelup = valores;
        }

        // Validar Analítico / Mente Aguçada (1 perícia)
        if (talentoNome === 'Analítico' || talentoNome === 'Mente Aguçada') {
          const sel = document.querySelector('.escolha-talento-levelup');
          if (!sel?.value) {
            toast(`Selecione a perícia para ${talentoNome}`, 'error');
            return;
          }
          opcoes.escolhas_talento_levelup = [sel.value];
          opcoes.talento_tipo_escolha = talentoNome === 'Analítico' ? 'analitico' : 'mente_agucada';
        }

        // Validar Especialista em Perícia (proficiência + expertise)
        if (talentoNome === 'Especialista em Perícia') {
          const selProf = document.querySelector('.escolha-talento-levelup[data-tipo="proficiencia"]');
          const selExp = document.querySelector('.escolha-talento-levelup[data-tipo="expertise"]');
          if (!selProf?.value || !selExp?.value) {
            toast('Preencha as escolhas de Especialista em Perícia', 'error');
            return;
          }
          opcoes.escolhas_talento_levelup = [selProf.value, selExp.value];
          opcoes.talento_tipo_escolha = 'especialista_pericia';
        }

        // Validar Resiliente (atributo para salvaguarda)
        if (talentoNome === 'Resiliente') {
          const selRes = document.getElementById('levelup-talento-resiliente');
          if (!selRes?.value) {
            toast('Selecione o atributo para Resiliente', 'error');
            return;
          }
          opcoes.talento_asi = selRes.value;
          opcoes.talento_tipo_escolha = 'resiliente';
          opcoes.resiliente_atributo = selRes.value;
        }

        // Validar Adepto Elemental (tipo de dano)
        if (talentoNome === 'Adepto Elemental') {
          const selDano = document.querySelector('.escolha-talento-levelup');
          if (!selDano?.value) {
            toast('Adepto Elemental: selecione o tipo de dano', 'error');
            return;
          }
          // Validar que o tipo não foi usado anteriormente
          const tiposUsados = obterTiposAdeptoElementalUsados();
          if (tiposUsados.includes(selDano.value)) {
            toast(`Adepto Elemental: o tipo "${selDano.value}" já foi escolhido anteriormente. Escolha um tipo diferente.`, 'error');
            return;
          }
          opcoes.escolhas_talento_levelup = [selDano.value];
          opcoes.talento_tipo_escolha = 'adepto_elemental';
        }

        // Validar Tocado Por Fadas / Tocado Pelas Sombras (1 magia)
        if (talentoNome === 'Tocado Por Fadas' || talentoNome === 'Tocado Pelas Sombras') {
          const selMagia = document.getElementById('levelup-magia-escola-select');
          if (!selMagia?.value) {
            toast(`Selecione a magia para ${talentoNome}`, 'error');
            return;
          }
          opcoes.escolhas_talento_levelup = [selMagia.value];
          opcoes.talento_tipo_escolha = talentoNome === 'Tocado Por Fadas' ? 'tocado_fadas' : 'tocado_sombras';
        }

        // Validar Conjurador Ritualista (N magias rituais)
        if (talentoNome === 'Conjurador Ritualista') {
          const checks = [...document.querySelectorAll('.levelup-ritual-check:checked')];
          const bonusProf = calcBonusProficiencia(char.nivel || 1);
          if (checks.length !== bonusProf) {
            toast(`Selecione exatamente ${bonusProf} magias rituais`, 'error');
            return;
          }
          opcoes.escolhas_talento_levelup = checks.map(cb => cb.value);
          opcoes.talento_tipo_escolha = 'conjurador_ritualista';
        }

        // Validar Iniciado em Magia (lista + atributo + 2 truques + 1 magia)
        if (talentoNome === 'Iniciado em Magia') {
          const im = window._levelupIM;
          if (!im?.lista) { toast('Iniciado em Magia: selecione a lista de magias', 'error'); return; }
          // Validar que a lista não foi usada anteriormente
          const listasUsadas = obterListasIniciadoEmMagiaUsadas();
          if (listasUsadas.includes(im.lista)) {
            toast(`Iniciado em Magia: a lista "${im.lista}" já foi escolhida anteriormente. Escolha uma lista diferente.`, 'error');
            return;
          }
          if (!im?.atributo) { toast('Iniciado em Magia: selecione o atributo de conjuração', 'error'); return; }
          if ((im?.truques || []).length < 2) { toast('Iniciado em Magia: selecione 2 truques', 'error'); return; }
          if (!im?.magia) { toast('Iniciado em Magia: selecione 1 magia de 1o círculo', 'error'); return; }
          opcoes.talento_tipo_escolha = 'iniciado_em_magia';
          opcoes.iniciado_em_magia = { lista: im.lista, atributo: im.atributo, truques: [...im.truques], magia: im.magia };
        }
      }
    }

    if (precisaExpertiseBardo) {
      const escolhidas = [...document.querySelectorAll('[data-bardo-expertise]:checked')]
        .map(el => el.getAttribute('data-bardo-expertise'));
      if (escolhidas.length !== 2) {
        toast('Selecione exatamente 2 perícias para Especialização do Bardo', 'error');
        return;
      }
      opcoes.bardo_expertise = escolhidas;
    }

    if (precisaExpertiseGuardiao) {
      const escolhidas = [...document.querySelectorAll('[data-guardiao-expertise]:checked')]
        .map(el => el.getAttribute('data-guardiao-expertise'));
      if (escolhidas.length !== 2) {
        toast('Selecione exatamente 2 perícias para Especialista do Guardião', 'error');
        return;
      }
      opcoes.guardiao_expertise = escolhidas;
    }

    // Validar Estilo de Luta
    if (precisaEstiloLuta) {
      const estiloRadio = document.querySelector('input[name="estilo_luta"]:checked');
      if (!estiloRadio) {
        toast('Selecione um Estilo de Luta', 'error');
        return;
      }
      opcoes.estilo_luta = estiloRadio.value;
    }

    // Validar Explorador Hábil
    if (precisaExploradorHabil) {
      const expertiseRadio = document.querySelector('input[name="explorador_expertise"]:checked');
      if (!expertiseRadio) {
        toast('Selecione 1 perícia para Especialização (Explorador Hábil)', 'error');
        return;
      }
      opcoes.explorador_expertise = expertiseRadio.value;

      const idiomasEscolhidos = [...document.querySelectorAll('[data-explorador-idioma]:checked')]
        .map(el => el.getAttribute('data-explorador-idioma'));
      if (idiomasEscolhidos.length !== 2) {
        toast('Selecione exatamente 2 idiomas (Explorador Hábil)', 'error');
        return;
      }
      opcoes.explorador_idiomas = idiomasEscolhidos;
    }

    // Validar Acadêmico do Mago
    if (precisaAcademico) {
      const escolhidas = [...document.querySelectorAll('[data-academico-expertise]:checked')]
        .map(el => el.getAttribute('data-academico-expertise'));
      if (escolhidas.length !== 2) {
        toast('Selecione exatamente 2 perícias para Acadêmico do Mago', 'error');
        return;
      }
      opcoes.academico_expertise = escolhidas;
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
          <h3 style="color:var(--success);margin:0">✓ Subida de Nível Concluída!</h3>
          <div style="font-size:1.1rem;margin:12px 0">Nível ${resultado.nivel_anterior} → <strong>Nível ${resultado.nivel_novo}</strong></div>
          <ul style="text-align:left;margin:12px 0">
            <li>+${resultado.hp_ganho} HP (${resultado.hp_modo === 'rolado' ? `rolagem ${resultado.hp_rolado}` : 'valor fixo'})</li>
            ${resultado.bonus_con_retroativo > 0 ? `<li>+${resultado.bonus_con_retroativo} HP (ajuste retroativo de Constituição)</li>` : ''}
            <li>Total de PV: ${char.pv_max}</li>
            ${resultado.subclasse_escolhida ? `<li>Subclasse: ${resultado.subclasse_escolhida}</li>` : ''}
            ${resultado.aumentos_aplicados ? `<li>Atributos aumentados</li>` : ''}
            ${resultado.talento_aplicado ? `<li>Talento: ${resultado.talento_aplicado}${(resultado.escolhas_talento_levelup || []).length > 0 ? ' (' + resultado.escolhas_talento_levelup.join(', ') + ')' : ''}${resultado.talento_asi_aplicado ? ' (+1 ' + ({forca:'Força',destreza:'Destreza',constituicao:'Constituição',inteligencia:'Inteligência',sabedoria:'Sabedoria',carisma:'Carisma'}[resultado.talento_asi_aplicado] || resultado.talento_asi_aplicado) + ')' : ''}</li>` : ''}
            ${(resultado.caracteristicas_subclasse || []).length > 0 ? resultado.caracteristicas_subclasse.map(f => `<li><strong>[${char.subclasse}]</strong> ${f.nome}</li>`).join('') : ''}
            ${(resultado.magias_dominio_adicionadas || []).length > 0 ? `<li>Magias de domínio adicionadas: ${resultado.magias_dominio_adicionadas.map(m => m.nome).join(', ')}</li>` : ''}
            ${(resultado.magias_sempre_adicionadas || []).length > 0 ? `<li>Magias sempre preparadas adicionadas: ${resultado.magias_sempre_adicionadas.map(m => m.nome).join(', ')}</li>` : ''}
            ${(resultado.expertise_bardo_aplicada || []).length > 0 ? `<li>Especialização: ${resultado.expertise_bardo_aplicada.join(', ')}</li>` : ''}
            ${(resultado.expertise_guardiao_aplicada || []).length > 0 ? `<li>Especialista do Guardião: ${resultado.expertise_guardiao_aplicada.join(', ')}</li>` : ''}
            ${resultado.estilo_luta_aplicado ? `<li>Estilo de Luta: ${resultado.estilo_luta_aplicado}</li>` : ''}
            ${(resultado.estilo_luta_aplicado === 'Combatente Druídico' || resultado.estilo_luta_aplicado === 'Combatente Abençoado') ? `<li style="color:var(--accent)">Use <strong>Gerenciar Magias</strong> para selecionar seus 2 truques bônus de ${resultado.estilo_luta_aplicado === 'Combatente Druídico' ? 'Druida' : 'Clérigo'}</li>` : ''}
            ${resultado.explorador_habil_aplicado?.expertise ? `<li>Explorador Hábil - Especialização: ${resultado.explorador_habil_aplicado.expertise}</li>` : ''}
            ${(resultado.explorador_habil_aplicado?.idiomas || []).length > 0 ? `<li>Explorador Hábil - Idiomas: ${resultado.explorador_habil_aplicado.idiomas.join(', ')}</li>` : ''}
            ${(resultado.academico_aplicado || []).length > 0 ? `<li>Acadêmico: ${resultado.academico_aplicado.join(', ')}</li>` : ''}
            ${truquesAdicionados.length > 0 ? `<li>Truques: +${truquesAdicionados.join(', ')}</li>` : ''}
            ${magiasAdicionadas.length > 0 ? `<li>Magias: +${magiasAdicionadas.join(', ')}</li>` : ''}
            ${grimorioAdicionado.length > 0 ? `<li>Grimório: +${grimorioAdicionado.join(', ')}</li>` : ''}
            ${magiaTrocadaDe ? `<li>Troca: ${magiaTrocadaDe} → ${magiaTrocadaPara}</li>` : ''}
          </ul>
        </div>
      `;
      
      abrirModal('Subida de Nível Concluída!', resumo, '<button class="btn btn-primary" onclick="fecharModal()">OK</button>');
      
      renderFichaCompleta();
    } else {
      toast(resultado.erro || 'Erro ao subir de nível', 'error');
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
        // Busca exata primeiro; se não encontrar, tenta pelo nome base (sem parênteses)
        let talentoData = todosOsTalentos.find(td => td.nome === nome);
        if (!talentoData) {
          const nomeBase = nome.replace(/\s*\(.*\)$/, '').trim();
          talentoData = todosOsTalentos.find(td => td.nome === nomeBase);
        }
        const descricao = talentoData?.descricao || '';
        const beneficios = talentoData?.beneficios || [];

        // Informações de escolhas específicas do talento
        let infoEscolhas = '';
        if (nome === 'Iniciado em Magia') {
          // Formato novo: array de instâncias
          const instancias = char.iniciado_em_magia_instancias || [];
          // Formato legado (pré-migração)
          const legado = char.iniciado_em_magia?.lista ? [char.iniciado_em_magia] : [];
          const todas = instancias.length > 0 ? instancias : legado;
          if (todas.length > 0) {
            infoEscolhas = todas.map((im, idx) => `<div class="info-box info" style="font-size:0.8rem;margin-top:6px">
              ${todas.length > 1 ? `<strong>Instância ${idx + 1}:</strong> ` : ''}
              <strong>Lista:</strong> ${im.lista} | <strong>Atributo:</strong> ${im.atributo || '—'}
              <br><strong>Truques:</strong> ${(im.truques || []).join(', ') || '—'}
              <br><strong>Magia 1o Círculo:</strong> ${im.magia || '—'}
            </div>`).join('');
          }
        }
        if (nome === 'Adepto Elemental') {
          // Formato novo: array de tipos
          const tipos = char.adepto_elemental_tipos || [];
          // Formato legado (pré-migração)
          const legado = char.adepto_elemental_tipo ? [char.adepto_elemental_tipo] : [];
          const todos = tipos.length > 0 ? tipos : legado;
          if (todos.length > 0) {
            infoEscolhas = `<div class="info-box info" style="font-size:0.8rem;margin-top:6px"><strong>Domínio Elemental:</strong> ${todos.join(', ')}</div>`;
          }
        }
        // Talentos com escolhas de proficiencias/ferramentas/instrumentos
        if (['Habilidoso', 'Artifista', 'Músico'].includes(nome) && char.escolhas_talento) {
          const entradas = [];
          const ctxLabels = { antecedente: 'Antecedente', versatil: 'Versátil' };
          for (const [ctx, escolhas] of Object.entries(char.escolhas_talento)) {
            if (!Array.isArray(escolhas) || escolhas.length === 0) continue;
            // Filtrar: contexto versatil pertence ao talento_versatil
            if (ctx === 'versatil' && char.talento_versatil !== nome) continue;
            // Contexto antecedente: sem como saber qual talento, mostra se o nome atual esta nos talentos
            // e o talento_versatil nao e o mesmo (evita duplicar)
            if (ctx === 'antecedente' && char.talento_versatil === nome) {
              // So mostrar se Habilidoso aparece mais de 1 vez nos talentos
              const count = char.talentos.filter(t => (typeof t === 'string' ? t : t.nome) === nome).length;
              if (count <= 1) continue;
            }
            let label = ctxLabels[ctx] || ctx;
            if (ctx.startsWith('levelup_')) {
              label = `Nível ${ctx.replace('levelup_', '')}`;
            }
            entradas.push({ label, escolhas });
          }
          if (entradas.length > 0) {
            const rotulo = nome === 'Artifista' ? 'Ferramentas' : nome === 'Músico' ? 'Instrumentos' : 'Proficiências';
            infoEscolhas += entradas.map(e =>
              `<div class="info-box info" style="font-size:0.8rem;margin-top:6px"><strong>${e.label} — ${rotulo}:</strong> ${e.escolhas.join(', ')}</div>`
            ).join('');
          }
        }
        
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
              ${infoEscolhas}
            </div>
          </details>
        `;
      }).join('')}
    </div>
  `;
}

/** Migra formato antigo de Iniciado em Magia (objeto) para array de instâncias */
function migrarIniciadoEmMagiaInstancias() {
  if (char.iniciado_em_magia && typeof char.iniciado_em_magia === 'object' && !Array.isArray(char.iniciado_em_magia)) {
    if (char.iniciado_em_magia.lista) {
      if (!char.iniciado_em_magia_instancias) char.iniciado_em_magia_instancias = [];
      // Evitar duplicata se já migrou
      const jaExiste = char.iniciado_em_magia_instancias.some(i => i.lista === char.iniciado_em_magia.lista);
      if (!jaExiste) {
        char.iniciado_em_magia_instancias.push({ ...char.iniciado_em_magia });
      }
    }
    delete char.iniciado_em_magia;
    salvar();
  }
}

/** Migra formato antigo de Adepto Elemental (string) para array de tipos */
function migrarAdeptoElementalTipos() {
  if (char.adepto_elemental_tipo && typeof char.adepto_elemental_tipo === 'string') {
    if (!char.adepto_elemental_tipos) char.adepto_elemental_tipos = [];
    if (!char.adepto_elemental_tipos.includes(char.adepto_elemental_tipo)) {
      char.adepto_elemental_tipos.push(char.adepto_elemental_tipo);
    }
    delete char.adepto_elemental_tipo;
    salvar();
  }
}

/** Retorna listas de magias já usadas pelo talento Iniciado em Magia */
function obterListasIniciadoEmMagiaUsadas() {
  const usadas = [];
  // Formato novo (array de instâncias)
  if (Array.isArray(char.iniciado_em_magia_instancias)) {
    char.iniciado_em_magia_instancias.forEach(i => { if (i.lista) usadas.push(i.lista); });
  }
  // Formato legado (objeto único, caso migração ainda não rodou)
  if (char.iniciado_em_magia?.lista && !usadas.includes(char.iniciado_em_magia.lista)) {
    usadas.push(char.iniciado_em_magia.lista);
  }
  return usadas;
}

/** Retorna tipos de dano já usados pelo talento Adepto Elemental */
function obterTiposAdeptoElementalUsados() {
  const usados = [];
  // Formato novo (array)
  if (Array.isArray(char.adepto_elemental_tipos)) {
    usados.push(...char.adepto_elemental_tipos);
  }
  // Formato legado (string única, caso migração ainda não rodou)
  if (char.adepto_elemental_tipo && !usados.includes(char.adepto_elemental_tipo)) {
    usados.push(char.adepto_elemental_tipo);
  }
  return usados;
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
  let recarga = detectarRecarga(f.descricao);
  // Features that are purely descriptive should always be passive
  const nomeNorm = semAcento(f.nome);
  const ativa = ehHabilidadeAtiva(f.descricao, f.nome);
  const key = `${source}_${f.nome}`;
  if (!char.usos_habilidades) char.usos_habilidades = {};

  // Detectar usos máximos e sub-habilidades
  let usosMax = detectarUsosMaximos(f.descricao);
  const subHabilidades = detectarSubHabilidades(f.descricao);
  const ehCanalizarDivindadeClerigo = char.classe === 'Clérigo' && f.nome === 'Canalizar Divindade';
  const ehGolpesAbencoadosClerigo = char.classe === 'Clérigo' && f.nome === 'Golpes Abençoados';
  const ehIntervencaoDivinaClerigo = char.classe === 'Clérigo' && f.nome === 'Intervenção Divina';
  const ehIntervencaoDivinaMaiorClerigo = char.classe === 'Clérigo' && f.nome === 'Intervenção Divina Maior';

  const ehSubclasseClerigo = char.classe === 'Clérigo' && source === 'subclasse';
  const ehGuerraAtaqueDirecionado = ehSubclasseClerigo && char.subclasse === 'Domínio da Guerra' && f.nome === 'Ataque Direcionado';
  const ehGuerraSacerdote = ehSubclasseClerigo && char.subclasse === 'Domínio da Guerra' && f.nome === 'Sacerdote da Guerra';
  const ehGuerraBencaoDeus = ehSubclasseClerigo && char.subclasse === 'Domínio da Guerra' && f.nome === 'Bênção do Deus da Guerra';
  const ehLuzBrilho = ehSubclasseClerigo && char.subclasse === 'Domínio da Luz' && f.nome === 'Brilho do Amanhecer';
  const ehLuzLabareda = ehSubclasseClerigo && char.subclasse === 'Domínio da Luz' && f.nome === 'Labareda Protetora';
  const ehLuzCoroa = ehSubclasseClerigo && char.subclasse === 'Domínio da Luz' && f.nome === 'Coroa de Luz';
  const ehTrapacaBencao = ehSubclasseClerigo && char.subclasse === 'Domínio da Trapaça' && f.nome === 'Bênção do Trapaceiro';
  const ehTrapacaInvocar = ehSubclasseClerigo && char.subclasse === 'Domínio da Trapaça' && f.nome === 'Invocar Duplicidade';
  const ehVidaPreservar = ehSubclasseClerigo && char.subclasse === 'Domínio da Vida' && f.nome === 'Preservar a Vida';

  const ehInimigoFavoritoGuardiao = char.classe === 'Guardião' && f.nome === 'Inimigo Favorito';
  const ehIncansavelGuardiao = char.classe === 'Guardião' && f.nome === 'Incansável';
  const ehVeuNaturezaGuardiao = char.classe === 'Guardião' && f.nome === 'Véu da Natureza';
  const ehMaestriaGuardiao = char.classe === 'Guardião' && f.nome === 'Maestria em Arma';
  const estadoGuardiao = (ehInimigoFavoritoGuardiao || ehIncansavelGuardiao || ehVeuNaturezaGuardiao || ehMaestriaGuardiao) ? getEstadoRecursosGuardiao() : null;

  // Guardião: subclasses — detecção de features
  const ehGuardiao = char.classe === 'Guardião';
  const ehSubclasseGuardiao = ehGuardiao && source === 'subclasse';
  // Andarilho Feérico
  const ehAndarilhoReforcos = ehSubclasseGuardiao && char.subclasse === 'Andarilho Feérico' && f.nome === 'Reforços Feéricos';
  const ehAndarilhoNebuloso = ehSubclasseGuardiao && char.subclasse === 'Andarilho Feérico' && f.nome === 'Andarilho Nebuloso';
  // Caçador
  const ehCacadorPresa = ehSubclasseGuardiao && char.subclasse === 'Caçador' && f.nome === 'Presa do Caçador';
  const ehCacadorTaticas = ehSubclasseGuardiao && char.subclasse === 'Caçador' && f.nome === 'Táticas Defensivas';
  // Senhor das Feras
  const ehFerasCompanheiro = ehSubclasseGuardiao && char.subclasse === 'Senhor das Feras' && f.nome === 'Companheiro Primal';
  // Vigilante das Sombras
  const ehVigilanteEmboscador = ehSubclasseGuardiao && char.subclasse === 'Vigilante das Sombras' && f.nome === 'Emboscador das Sombras';
  const estadoGuardiaoSub = (ehAndarilhoReforcos || ehAndarilhoNebuloso || ehCacadorPresa || ehCacadorTaticas || ehFerasCompanheiro || ehVigilanteEmboscador) ? getEstadoRecursosGuardiao() : null;

  // Druida: deteccao de Forma Selvagem para handler dedicado
  const ehFormaSelvagem = char.classe === 'Druida' && f.nome === 'Forma Selvagem';
  const estadoDruida = ehFormaSelvagem ? getEstadoRecursosDruida() : null;

  // Druida: subclasses — detecção de features
  const ehDruida = char.classe === 'Druida';
  const ehSubclasseDruida = ehDruida && source === 'subclasse';
  // Círculo da Lua
  const ehLuaPassoLunar = ehSubclasseDruida && char.subclasse === 'Círculo da Lua' && f.nome === 'Passo Lunar';
  // Círculo da Terra
  const ehTerraRecuperacao = ehSubclasseDruida && char.subclasse === 'Círculo da Terra' && f.nome === 'Recuperação Natural';
  // Círculo das Estrelas
  const ehEstrelasForma = ehSubclasseDruida && char.subclasse === 'Círculo das Estrelas' && f.nome === 'Forma Estrelada';
  const ehEstrelasMapa = ehSubclasseDruida && char.subclasse === 'Círculo das Estrelas' && f.nome === 'Mapa Estelar';
  const ehEstrelasPresagio = ehSubclasseDruida && char.subclasse === 'Círculo das Estrelas' && f.nome === 'Presságio Cósmico';
  const estadoDruidaSub = (ehLuaPassoLunar || ehTerraRecuperacao || ehEstrelasMapa || ehEstrelasPresagio || ehEstrelasForma) ? getEstadoRecursosDruida() : null;

  // Bardo: deteccao de Inspiracao de Bardo para handler dedicado
  const ehInspiracaoBardo = char.classe === 'Bardo' && f.nome === 'Inspiração de Bardo';
  const estadoInspiracaoBardo = ehInspiracaoBardo ? getEstadoInspiracaoBardo() : null;

  // Bruxo: deteccao de Astucia Magica para handler dedicado
  const ehAstuciaBruxo = char.classe === 'Bruxo' && f.nome === 'Astúcia Mágica';
  const estadoBruxoFeature = ehAstuciaBruxo ? getEstadoRecursosBruxo() : null;

  // Bruxo: subclasses — detecção de features
  const ehBruxo = char.classe === 'Bruxo';
  const ehSubclasseBruxo = ehBruxo && source === 'subclasse';
  // Patrono Arquifada
  const ehArquifadaPassos = ehSubclasseBruxo && char.subclasse === 'Patrono Arquifada' && f.nome === 'Passos Feéricos';
  const ehArquifadaFuga = ehSubclasseBruxo && char.subclasse === 'Patrono Arquifada' && f.nome === 'Fuga em Névoa';
  const ehArquifadaDefesas = ehSubclasseBruxo && char.subclasse === 'Patrono Arquifada' && f.nome === 'Defesas Sedutoras';
  const ehArquifadaMagiaSedutora = ehSubclasseBruxo && char.subclasse === 'Patrono Arquifada' && f.nome === 'Magia Sedutora';
  // Patrono Celestial
  const ehCelestialLuz = ehSubclasseBruxo && char.subclasse === 'Patrono Celestial' && f.nome === 'Luz Medicinal';
  const ehCelestialAlma = ehSubclasseBruxo && char.subclasse === 'Patrono Celestial' && f.nome === 'Alma Radiante';
  const ehCelestialResiliencia = ehSubclasseBruxo && char.subclasse === 'Patrono Celestial' && f.nome === 'Resiliência Celestial';
  const ehCelestialVinganca = ehSubclasseBruxo && char.subclasse === 'Patrono Celestial' && f.nome === 'Vingança Calcinante';
  // Patrono O Grande Antigo
  const ehAntigoCombatente = ehSubclasseBruxo && char.subclasse === 'Patrono O Grande Antigo' && f.nome === 'Combatente Clarividente';
  const ehAntigoDanacao = ehSubclasseBruxo && char.subclasse === 'Patrono O Grande Antigo' && f.nome === 'Danação Mística';
  const ehAntigoEscudo = ehSubclasseBruxo && char.subclasse === 'Patrono O Grande Antigo' && f.nome === 'Escudo Mental';
  // Patrono Ínfero
  const ehInferoBencao = ehSubclasseBruxo && char.subclasse === 'Patrono Ínfero' && f.nome === 'Bênção do Tenebroso';
  const ehInferoSorte = ehSubclasseBruxo && char.subclasse === 'Patrono Ínfero' && f.nome === 'A Sorte do Próprio Tenebroso';
  const ehInferoResistencia = ehSubclasseBruxo && char.subclasse === 'Patrono Ínfero' && f.nome === 'Resistência Ínfera';
  const ehInferoLancar = ehSubclasseBruxo && char.subclasse === 'Patrono Ínfero' && f.nome === 'Lançar no Inferno';
  const estadoBruxoSub = (ehArquifadaPassos || ehArquifadaFuga || ehArquifadaDefesas || ehCelestialLuz || ehCelestialVinganca || ehAntigoCombatente || ehInferoSorte || ehInferoResistencia || ehInferoLancar) ? getEstadoRecursosBruxo() : null;

  const ehFeiticeiro = char.classe === 'Feiticeiro';
  const subclasseFeiticeiro = semAcento(char.subclasse || '');
  const ehFeiticariaInata = ehFeiticeiro && f.nome === 'Feitiçaria Inata';
  const ehFonteMagia = ehFeiticeiro && f.nome === 'Fonte de Magia';
  const ehMetamagia = ehFeiticeiro && f.nome === 'Metamagia';
  const ehRestauracaoFeiticeira = ehFeiticeiro && f.nome === 'Restauração Feiticeira';
  const ehFalaTelepatica = ehFeiticeiro && subclasseFeiticeiro === semAcento('Feitiçaria Aberrante') && f.nome === 'Fala Telepática';
  const ehRevelacaoCarne = ehFeiticeiro && subclasseFeiticeiro === semAcento('Feitiçaria Aberrante') && f.nome === 'Revelação em Carne';
  const ehAfinidadeElemental = ehFeiticeiro && subclasseFeiticeiro === semAcento('Feitiçaria Dracônica') && f.nome === 'Afinidade Elemental';
  const ehAsasDragao = ehFeiticeiro && subclasseFeiticeiro === semAcento('Feitiçaria Dracônica') && f.nome === 'Asas de Dragão';
  const ehCompanheiroDraconico = ehFeiticeiro && subclasseFeiticeiro === semAcento('Feitiçaria Dracônica') && f.nome === 'Companheiro Dracônico';
  const ehRestaurarEquilibrio = ehFeiticeiro && subclasseFeiticeiro === semAcento('Feitiçaria Mecânica') && f.nome === 'Restaurar Equilíbrio';
  const ehBastiaoLei = ehFeiticeiro && subclasseFeiticeiro === semAcento('Feitiçaria Mecânica') && f.nome === 'Bastião da Lei';
  const ehTranseOrdem = ehFeiticeiro && subclasseFeiticeiro === semAcento('Feitiçaria Mecânica') && f.nome === 'Transe da Ordem';
  const ehMaresCaos = ehFeiticeiro && subclasseFeiticeiro === semAcento('Feitiçaria Selvagem') && f.nome === 'Marés do Caos';
  const ehDistorcerSorte = ehFeiticeiro && subclasseFeiticeiro === semAcento('Feitiçaria Selvagem') && f.nome === 'Distorcer a Sorte';
  const ehSurtoControlado = ehFeiticeiro && subclasseFeiticeiro === semAcento('Feitiçaria Selvagem') && f.nome === 'Surto Controlado';

  const estadoFeiticeiro = ehFeiticeiro ? getEstadoRecursosFeiticeiro() : null;

  // Guerreiro: detecção de habilidades dedicadas
  const ehGuerreiro = char.classe === 'Guerreiro';
  const ehRecuperarFolegoGuerreiro = ehGuerreiro && f.nome === 'Recuperar Fôlego';
  const ehSurtoAcaoGuerreiro = ehGuerreiro && f.nome === 'Surto de Ação';
  const ehIndomavelGuerreiro = ehGuerreiro && f.nome === 'Indomável';
  const ehMaestriaGuerreiro = ehGuerreiro && f.nome === 'Maestria em Arma';
  // Mestre da Batalha
  const ehSuperioridadeCombate = ehGuerreiro && char.subclasse === 'Mestre da Batalha' && f.nome === 'Superioridade em Combate';
  const ehConhecaInimigo = ehGuerreiro && char.subclasse === 'Mestre da Batalha' && f.nome === 'Conheça Seu Inimigo';
  // Combatente Psíquico
  const ehPoderPsionicoGuerreiro = ehGuerreiro && char.subclasse === 'Combatente Psíquico' && f.nome === 'Poder Psiônico';
  const ehAdeptoTelecinetico = ehGuerreiro && char.subclasse === 'Combatente Psíquico' && f.nome === 'Adepto Telecinético';
  const ehBaluarteEnergia = ehGuerreiro && char.subclasse === 'Combatente Psíquico' && f.nome === 'Baluarte de Energia';
  const ehMestreTelecinetico = ehGuerreiro && char.subclasse === 'Combatente Psíquico' && f.nome === 'Mestre Telecinético';
  const estadoGuerreiro = ehGuerreiro ? getEstadoRecursosGuerreiro() : null;

  // Paladino: detecção de habilidades dedicadas
  const ehPaladino = char.classe === 'Paladino';
  const ehMaosConsagradasPaladino = ehPaladino && f.nome === 'Mãos Consagradas';
  const ehCanalizarPaladino = ehPaladino && f.nome === 'Canalizar Divindade';
  const ehDestruicaoPaladino = ehPaladino && f.nome === 'Destruição do Paladino';
  const ehAuraProtecaoPaladino = ehPaladino && f.nome === 'Aura de Proteção';
  const ehGolpesRadiantesPaladino = ehPaladino && f.nome === 'Golpes Radiantes';
  const ehMaestriaPaladino = ehPaladino && f.nome === 'Maestria em Arma';
  const estadoPaladino = ehPaladino ? getEstadoRecursosPaladino() : null;

  // Monge: detecção de habilidades dedicadas
  const ehMonge = char.classe === 'Monge';
  const ehArtesMarciais = ehMonge && f.nome === 'Artes Marciais';
  const ehPontosFoco = ehMonge && f.nome === 'Foco do Monge';
  const ehDesviarAtaques = ehMonge && (f.nome === 'Defletir Ataques' || f.nome === 'Defletir Energia');
  const ehGolpeAtordoante = ehMonge && f.nome === 'Golpe Atordoante';
  const estadoMonge = ehMonge ? getEstadoRecursosMonge() : null;
  // Subclasses de Monge
  const ehSubclasseMonge = ehMonge && source === 'subclasse';
  // Mão Espalmada
  const ehEspalmadaIntegridade = ehSubclasseMonge && char.subclasse === 'Combatente da Mão Espalmada' && f.nome === 'Integridade Corporal';
  const ehEspalmadaPalma = ehSubclasseMonge && char.subclasse === 'Combatente da Mão Espalmada' && f.nome === 'Palma Vibrante';
  // Misericórdia
  const ehMisericordiaTorrente = ehSubclasseMonge && char.subclasse === 'Combatente da Misericórdia' && f.nome === 'Torrente de Cura e Dolo';
  const ehMisericordiaFinal = ehSubclasseMonge && char.subclasse === 'Combatente da Misericórdia' && f.nome === 'Mão da Misericórdia Final';
  // Elementos
  const ehElementosSintonia = ehSubclasseMonge && char.subclasse === 'Combatente dos Elementos' && f.nome === 'Sintonia Elemental';
  const estadoMongeSub = (ehEspalmadaIntegridade || ehEspalmadaPalma || ehMisericordiaTorrente || ehMisericordiaFinal || ehElementosSintonia) ? getEstadoRecursosMonge() : null;

  // Ladino: detecção de habilidades dedicadas
  const ehLadino = char.classe === 'Ladino';
  const ehAtaqueFurtivo = ehLadino && f.nome === 'Ataque Furtivo';
  const ehGolpeSorte = ehLadino && f.nome === 'Golpe de Sorte';
  const ehMaestriaLadino = ehLadino && f.nome === 'Maestria em Arma';
  // Adaga Espiritual
  const ehPoderPsionicoLadino = ehLadino && char.subclasse === 'Adaga Espiritual' && f.nome === 'Poder Psiônico';
  const ehLaminasAlma = ehLadino && char.subclasse === 'Adaga Espiritual' && f.nome === 'Lâminas da Alma';
  const ehVeuPsiquico = ehLadino && char.subclasse === 'Adaga Espiritual' && f.nome === 'Véu Psíquico';
  const ehRasgarMente = ehLadino && char.subclasse === 'Adaga Espiritual' && f.nome === 'Rasgar Mente';
  const estadoLadino = ehLadino ? getEstadoRecursosLadino() : null;

  // Mago: detecção de habilidades dedicadas
  const ehMago = char.classe === 'Mago';
  const ehRecuperacaoArcana = ehMago && f.nome === 'Recuperação Arcana';
  const ehAssinaturaMagica = ehMago && f.nome === 'Assinatura Mágica';
  const estadoMago = ehMago ? getEstadoRecursosMago() : null;
  // Subclasses de Mago
  const ehSubclasseMago = ehMago && source === 'subclasse';
  // Abjurador
  const ehAbjuradorProtecao = ehSubclasseMago && char.subclasse === 'Abjurador' && f.nome === 'Proteção Arcana';
  // Adivinhador
  const ehAdivinhadorProdigio = ehSubclasseMago && char.subclasse === 'Adivinhador' && f.nome === 'Prodígio';
  const ehAdivinhadorTerceiroOlho = ehSubclasseMago && char.subclasse === 'Adivinhador' && f.nome === 'O Terceiro Olho';
  // Evocador
  const ehEvocadorSobrecarga = ehSubclasseMago && char.subclasse === 'Evocador' && f.nome === 'Sobrecarga';
  // Ilusionista
  const ehIlusionistaEspectrais = ehSubclasseMago && char.subclasse === 'Ilusionista' && f.nome === 'Criaturas Espectrais';
  const ehIlusionistaAutoimagem = ehSubclasseMago && char.subclasse === 'Ilusionista' && f.nome === 'Autoimagem Ilusória';
  const estadoMagoSub = (ehAbjuradorProtecao || ehAdivinhadorProdigio || ehAdivinhadorTerceiroOlho || ehEvocadorSobrecarga || ehIlusionistaEspectrais || ehIlusionistaAutoimagem) ? getEstadoRecursosMago() : null;

  if (ehLuzLabareda && (char.nivel || 1) >= 6) recarga = 'curto_ou_longo';

  if (ehCanalizarDivindadeClerigo) {
    const prog = getProgressaoClerigo();
    if (prog?.canalizarDivindadeMax) usosMax = prog.canalizarDivindadeMax;
  }

  const temMultiplosUsos = usosMax && usosMax > 1 && recarga;
  const ehFuriaBarbaro = char.classe === 'Bárbaro' && f.nome === 'Fúria';
  const ehMaestriaBarbaro = char.classe === 'Bárbaro' && f.nome === 'Maestria em Arma';
  const ehAtaqueImprudente = char.classe === 'Bárbaro' && f.nome === 'Ataque Imprudente';
  const estadoFuria = ehFuriaBarbaro ? getEstadoFuria() : null;

  // Subclasses do Bárbaro
  const ehBarbaro = char.classe === 'Bárbaro';
  const ehCampeaoDeuses = ehBarbaro && char.subclasse === 'Trilha do Fanático' && f.nome === 'Campeão dos Deuses';
  const ehFuriaDivina = ehBarbaro && char.subclasse === 'Trilha do Fanático' && f.nome === 'Fúria Divina';
  const ehConcentracaoFanatica = ehBarbaro && char.subclasse === 'Trilha do Fanático' && f.nome === 'Concentração Fanática';
  const ehFuriaDeuses = ehBarbaro && char.subclasse === 'Trilha do Fanático' && f.nome === 'Fúria dos Deuses';
  const ehPresencaZelosa = ehBarbaro && char.subclasse === 'Trilha do Fanático' && f.nome === 'Presença Zelosa';
  const ehFuriaSelvagens = ehBarbaro && char.subclasse === 'Trilha do Coração Selvagem' && f.nome === 'Fúria dos Selvagens';
  const ehAspectoSelvagens = ehBarbaro && char.subclasse === 'Trilha do Coração Selvagem' && f.nome === 'Aspecto dos Selvagens';
  const ehPoderSelvagens = ehBarbaro && char.subclasse === 'Trilha do Coração Selvagem' && f.nome === 'Poder dos Selvagens';
  const ehVitalidadeArvore = ehBarbaro && char.subclasse === 'Trilha da Árvore do Mundo' && f.nome === 'Vitalidade da Árvore';
  const ehPercorrerArvore = ehBarbaro && char.subclasse === 'Trilha da Árvore do Mundo' && f.nome === 'Percorrer a Árvore';

  // Bárbaro: Golpe Brutal (nível 9+) e Golpe Brutal Aprimorado (13/17)
  const ehGolpeBrutal = ehBarbaro && (f.nome === 'Golpe Brutal' || f.nome === 'Golpe Brutal Aprimorado');

  // Bárbaro: Berserker — detecção de features de nível alto
  const ehBerserker = ehBarbaro && char.subclasse === 'Trilha do Berserker';
  const ehFrenesi = ehBerserker && f.nome === 'Frenesi';
  const ehFuriaIrracional = ehBerserker && f.nome === 'Fúria Irracional';
  const ehRetaliacao = ehBerserker && f.nome === 'Retaliação';
  const ehPresencaIntimidante = ehBerserker && f.nome === 'Presença Intimidante';

  // Bardo: detecção de habilidades de classe
  const ehBardo = char.classe === 'Bardo';
  const ehContraEncantamento = ehBardo && f.nome === 'Contra-Encantamento';
  const ehPalavrasCriacao = ehBardo && f.nome === 'Palavras de Criação';

  // Bardo: subclasses — detecção de features
  const ehSubclasseBardo = ehBardo && source === 'subclasse';
  // Colégio da Bravura
  const ehBravuraInspiracaoCombate = ehSubclasseBardo && char.subclasse === 'Colégio da Bravura' && f.nome === 'Inspiração em Combate';
  const ehBravuraMagiaBatalha = ehSubclasseBardo && char.subclasse === 'Colégio da Bravura' && f.nome === 'Magia de Batalha';
  // Colégio da Dança
  const ehDancaGingaFascinante = ehSubclasseBardo && char.subclasse === 'Colégio da Dança' && f.nome === 'Ginga Fascinante';
  const ehDancaGingadoCoordenado = ehSubclasseBardo && char.subclasse === 'Colégio da Dança' && f.nome === 'Gingado Coordenado';
  const ehDancaMovimentoInspirador = ehSubclasseBardo && char.subclasse === 'Colégio da Dança' && f.nome === 'Movimento Inspirador';
  const ehDancaEvasaoLiderada = ehSubclasseBardo && char.subclasse === 'Colégio da Dança' && f.nome === 'Evasão Liderada';
  // Colégio do Conhecimento
  const ehConhecimentoPalavrasInterrupcao = ehSubclasseBardo && char.subclasse === 'Colégio do Conhecimento' && f.nome === 'Palavras de Interrupção';
  const ehConhecimentoProficienciasBonus = ehSubclasseBardo && char.subclasse === 'Colégio do Conhecimento' && f.nome === 'Proficiências Bônus';
  const ehConhecimentoDescobertasMagicas = ehSubclasseBardo && char.subclasse === 'Colégio do Conhecimento' && f.nome === 'Descobertas Mágicas';
  const ehConhecimentoPericiaInigualavel = ehSubclasseBardo && char.subclasse === 'Colégio do Conhecimento' && f.nome === 'Perícia Inigualável';
  // Colégio do Glamour
  const ehGlamourMagiaFascinante = ehSubclasseBardo && char.subclasse === 'Colégio do Glamour' && f.nome === 'Magia Fascinante';
  const ehGlamourMantoInspiracao = ehSubclasseBardo && char.subclasse === 'Colégio do Glamour' && f.nome === 'Manto de Inspiração';
  const ehGlamourMantoMajestade = ehSubclasseBardo && char.subclasse === 'Colégio do Glamour' && f.nome === 'Manto de Majestade';
  const ehGlamourMajestadeInquebravel = ehSubclasseBardo && char.subclasse === 'Colégio do Glamour' && f.nome === 'Majestade Inquebrável';

  // Clérigo: features de nível alto faltantes
  const ehGuerraAvatarGuerra = ehSubclasseClerigo && char.subclasse === 'Domínio da Guerra' && f.nome === 'Avatar da Guerra';
  const ehTrapacaDuplicidadeAprimorada = ehSubclasseClerigo && char.subclasse === 'Domínio da Trapaça' && f.nome === 'Duplicidade Aprimorada';
  const ehVidaCurandeiroAbencoado = ehSubclasseClerigo && char.subclasse === 'Domínio da Vida' && f.nome === 'Curandeiro Abençoado';
  const ehVidaCuraSuprema = ehSubclasseClerigo && char.subclasse === 'Domínio da Vida' && f.nome === 'Cura Suprema';
  const ehLuzLabaredaAprimorada = ehSubclasseClerigo && char.subclasse === 'Domínio da Luz' && f.nome === 'Labareda Protetora Aprimorada';
  const ehTrapacaTransposicao = ehSubclasseClerigo && char.subclasse === 'Domínio da Trapaça' && f.nome === 'Transposição do Trapaceiro';

  // Guerreiro: Campeão — detecção de features
  const ehCampeao = ehGuerreiro && char.subclasse === 'Campeão';
  const ehCriticoAprimorado = ehCampeao && f.nome === 'Crítico Aprimorado';
  const ehAtletaExtraordinario = ehCampeao && f.nome === 'Atleta Extraordinário';
  const ehEstiloLutaAdicional = ehCampeao && f.nome === 'Estilo de Luta Adicional';
  const ehCombatenteHeroico = ehCampeao && f.nome === 'Combatente Heroico';
  const ehCriticoSuperior = ehCampeao && f.nome === 'Crítico Superior';
  const ehSobrevivente = ehCampeao && f.nome === 'Sobrevivente';

  // Ladino: subclasses — detecção de features
  const ehSubclasseLadino = ehLadino && source === 'subclasse';
  // Ladrão
  const ehLadrao = ehLadino && char.subclasse === 'Ladrão';
  const ehAndarilhoTelhados = ehSubclasseLadino && ehLadrao && f.nome === 'Andarilho de Telhados';
  const ehMaoLeve = ehSubclasseLadino && ehLadrao && f.nome === 'Mão Leve';
  const ehFurtividadeSuprema = ehSubclasseLadino && ehLadrao && f.nome === 'Furtividade Suprema';
  const ehUsarDispositivoMagico = ehSubclasseLadino && ehLadrao && f.nome === 'Usar Dispositivo Mágico';
  const ehReflexosLadrao = ehSubclasseLadino && ehLadrao && f.nome === 'Reflexos de Ladrão';
  // Assassino
  const ehAssassino = ehLadino && char.subclasse === 'Assassino';
  const ehAssassinar = ehSubclasseLadino && ehAssassino && f.nome === 'Assassinar';
  const ehFerramentasAssassino = ehSubclasseLadino && ehAssassino && f.nome === 'Ferramentas de Assassino';
  const ehEspecialistaInfiltracao = ehSubclasseLadino && ehAssassino && f.nome === 'Especialista em Infiltração';
  const ehArmasVenenosas = ehSubclasseLadino && ehAssassino && f.nome === 'Armas Venenosas';
  const ehGolpeMortal = ehSubclasseLadino && ehAssassino && f.nome === 'Golpe Mortal';

  // Paladino: subclasses — detecção de features
  const ehSubclassePaladino = ehPaladino && source === 'subclasse';
  // Juramento da Glória
  const ehGloria = ehPaladino && char.subclasse === 'Juramento da Glória';
  const ehGloriaAtletaInigualavel = ehSubclassePaladino && ehGloria && f.nome === 'Atleta Inigualável';
  const ehGloriaDestruicaoInspiradora = ehSubclassePaladino && ehGloria && f.nome === 'Destruição Inspiradora';
  const ehGloriaAuraVivacidade = ehSubclassePaladino && ehGloria && f.nome === 'Aura de Vivacidade';
  const ehGloriaDefesaGloriosa = ehSubclassePaladino && ehGloria && f.nome === 'Defesa Gloriosa';
  const ehGloriaLendaViva = ehSubclassePaladino && ehGloria && f.nome === 'Lenda Viva';
  // Juramento da Vingança
  const ehVinganca = ehPaladino && char.subclasse === 'Juramento da Vingança';
  const ehVingancaVotoInimizade = ehSubclassePaladino && ehVinganca && f.nome === 'Voto de Inimizade';
  const ehVingancaVingadorImplacavel = ehSubclassePaladino && ehVinganca && f.nome === 'Vingador Implacável';
  const ehVingancaAlmaVingativa = ehSubclassePaladino && ehVinganca && f.nome === 'Alma Vingativa';
  const ehVingancaAnjoVingador = ehSubclassePaladino && ehVinganca && f.nome === 'Anjo Vingador';
  // Juramento dos Anciões
  const ehAncioes = ehPaladino && char.subclasse === 'Juramento dos Anciões';
  const ehAncioesIraNatureza = ehSubclassePaladino && ehAncioes && f.nome === 'A Ira da Natureza';
  const ehAncioesAuraResistencia = ehSubclassePaladino && ehAncioes && f.nome === 'Aura de Resistência';
  const ehAncioesSentinelaImortal = ehSubclassePaladino && ehAncioes && f.nome === 'Sentinela Imortal';
  const ehAncioesCampeaoAncestral = ehSubclassePaladino && ehAncioes && f.nome === 'Campeão Ancestral';

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
  const estadoClerigo = (ehCanalizarDivindadeClerigo || ehIntervencaoDivinaClerigo || ehIntervencaoDivinaMaiorClerigo || ehGolpesAbencoadosClerigo)
    ? getEstadoRecursosClerigo()
    : null;
  const estadoSubclassesClerigo = (
    ehGuerraAtaqueDirecionado || ehGuerraSacerdote || ehGuerraBencaoDeus ||
    ehLuzBrilho || ehLuzLabareda || ehLuzCoroa ||
    ehTrapacaBencao || ehTrapacaInvocar || ehVidaPreservar ||
    ehGuerraAvatarGuerra || ehTrapacaDuplicidadeAprimorada || ehVidaCurandeiroAbencoado ||
    ehVidaCuraSuprema || ehLuzLabaredaAprimorada || ehTrapacaTransposicao
  ) ? getEstadoSubclassesClerigo() : null;

  const recargaBadge = recarga
    ? `<span class="badge" style="font-size:0.65rem;margin-left:4px;background:${recarga === 'longo' ? 'var(--info)' : recarga === 'curto' ? 'var(--success)' : 'var(--warning)'};color:#fff">${recarga === 'longo' ? '🌙 Desc. Longo' : recarga === 'curto' ? '☀ Desc. Curto' : '☀🌙 Curto/Longo'}</span>`
    : '';
  const tipoBadge = ativa
    ? '<span class="badge" style="font-size:0.65rem;margin-left:4px;background:var(--accent);color:#fff">Ativa</span>'
    : '<span class="badge" style="font-size:0.65rem;margin-left:4px;background:var(--text-muted);color:#fff">Passiva</span>';

  // Renderizar controle de usos (fora do summary para acessibilidade)
  let usosHtmlSummary = '';
  let usosHtmlBody = '';

  if (ehFuriaBarbaro && estadoFuria) {
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoFuria.usosDisponiveis}/${estadoFuria.usosMax}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm ${estadoFuria.ativa ? 'btn-secondary' : 'btn-danger'}" data-furia-toggle="${estadoFuria.ativa ? 'desativar' : 'ativar'}">
          ${estadoFuria.ativa ? 'Encerrar Fúria' : 'Entrar em Fúria'}
        </button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Dano da Fúria: +${estadoFuria.dano}</span>
      </div>
    `;
  } else if (ehMaestriaBarbaro) {
    const prog = getProgressaoBarbaro() || { maestriasMax: 0 };
    const total = (char.maestrias_arma || []).length;
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${total}/${prog.maestriasMax}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-accent" data-config-maestrias="1">Definir Maestrias</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">${(char.maestrias_arma || []).join(', ') || 'Nenhuma selecionada'}</span>
      </div>
    `;
  } else if (ehAtaqueImprudente) {
    const ativo = ataqueImprudenteAtivo();
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm ${ativo ? 'btn-warning' : 'btn-secondary'}" data-imprudente-toggle="${ativo ? 'desativar' : 'ativar'}">
          ${ativo ? 'Desativar Ataque Imprudente' : 'Ativar Ataque Imprudente'}
        </button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Ajuste manual por turno</span>
      </div>
    `;
  } else if (ehCampeaoDeuses) {
    // Campeão dos Deuses (Fanático nv3): pool de d12 cura
    const nivel = char.nivel || 1;
    const dadosMax = nivel >= 17 ? 7 : nivel >= 12 ? 6 : nivel >= 6 ? 5 : 4;
    if (!char.recursos) char.recursos = {};
    if (typeof char.recursos.campeao_deuses_gastos !== 'number') char.recursos.campeao_deuses_gastos = 0;
    const dadosDisp = Math.max(0, dadosMax - char.recursos.campeao_deuses_gastos);
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${dadosDisp}/${dadosMax} d12</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-accent" data-campeao-deuses="usar" ${dadosDisp <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar d12 (Curar)</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Ação Bônus: gaste dados, role e recupere PV</span>
      </div>
    `;
  } else if (ehFuriaDivina) {
    // Fúria Divina: dano extra por turno durante Fúria
    const nivel = char.nivel || 1;
    const danoExtra = `1d6+${Math.floor(nivel / 2)}`;
    const furiaAtiva = !!getEstadoFuria()?.ativa;
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem;color:${furiaAtiva ? 'var(--success)' : 'var(--text-muted)'}">
        ${furiaAtiva ? `<strong>Ativo:</strong> +${danoExtra} dano Necrótico ou Radiante (1o alvo por turno)` : 'Requer Fúria ativa'}
      </div>
    `;
  } else if (ehConcentracaoFanatica) {
    // Concentração Fanática: 1x por Fúria, re-roll salvaguarda
    if (!char.recursos) char.recursos = {};
    const usada = !!char.recursos.concentracao_fanatica_usada;
    const furiaAtiva = !!getEstadoFuria()?.ativa;
    const danoFuria = getEstadoFuria()?.dano || 0;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        ${furiaAtiva ? `
          <button class="btn btn-sm ${usada ? 'btn-secondary' : 'btn-accent'}" data-concentracao-fanatica="usar" ${usada ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar (Re-roll +${danoFuria})</button>
          <span style="font-size:0.75rem;color:var(--text-muted)">${usada ? 'Já usada nesta Fúria' : '1x por Fúria: re-roll salvaguarda falha com bônus'}</span>
        ` : '<span style="font-size:0.75rem;color:var(--text-muted)">Requer Fúria ativa</span>'}
      </div>
    `;
  } else if (ehFuriaDeuses) {
    // Fúria dos Deuses (Fanático nv14): forma divina
    if (!char.recursos) char.recursos = {};
    const ativa = !!char.recursos.furia_deuses_ativa;
    const furiaAtiva = !!getEstadoFuria()?.ativa;
    const usada = !!char.recursos.furia_deuses_usada;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        ${furiaAtiva ? `
          <button class="btn btn-sm ${ativa ? 'btn-secondary' : 'btn-danger'}" data-furia-deuses="${ativa ? 'desativar' : 'ativar'}" ${(!ativa && usada) ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>
            ${ativa ? 'Encerrar Forma Divina' : 'Ativar Forma Divina'}
          </button>
          ${ativa ? '<span style="font-size:0.75rem;color:var(--success)">Resist: Necrótico, Psíquico, Radiante | Voo | Revivificação</span>' : ''}
          ${usada && !ativa ? '<span style="font-size:0.75rem;color:var(--text-muted)">Já usada (desc. longo)</span>' : ''}
        ` : '<span style="font-size:0.75rem;color:var(--text-muted)">Requer Fúria ativa</span>'}
      </div>
    `;
  } else if (ehPresencaZelosa) {
    // Presença Zelosa (Fanático nv10): buff aliados
    if (!char.recursos) char.recursos = {};
    const usada = !!char.recursos.presenca_zelosa_usada;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm ${usada ? 'btn-secondary' : 'btn-accent'}" data-presenca-zelosa="usar" ${usada ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Presença Zelosa</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">${usada ? 'Usada (desc. longo ou gastar Fúria)' : 'Até 10 aliados: Vant. em ataques e salvaguardas'}</span>
        ${usada ? '<button class="btn btn-sm btn-warning" data-presenca-zelosa="restaurar">Restaurar (gastar Fúria)</button>' : ''}
      </div>
    `;
  } else if (ehFuriaSelvagens) {
    // Fúria dos Selvagens: mostrar animal ativo
    const animal = char.recursos?.furia_animal;
    const furiaAtiva = !!getEstadoFuria()?.ativa;
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem;color:${furiaAtiva && animal ? 'var(--success)' : 'var(--text-muted)'}">
        ${furiaAtiva && animal ? `<strong>Espírito ativo:</strong> ${animal}` : 'Escolha ao ativar Fúria: Águia, Lobo ou Urso'}
        ${(char.nivel || 1) >= 14 ? ' (+ Carneiro, Falcão, Leão)' : ''}
      </div>
    `;
  } else if (ehAspectoSelvagens) {
    // Aspecto dos Selvagens: escolha persistente
    if (!char.recursos) char.recursos = {};
    const aspecto = char.recursos.aspecto_selvagem || null;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <select data-aspecto-selvagem="escolha" style="padding:4px 8px;border-radius:4px;border:1px solid var(--border);font-size:0.8rem;background:var(--bg-card);color:var(--text)">
          <option value="" ${!aspecto ? 'selected' : ''}>Escolher...</option>
          <option value="Coruja" ${aspecto === 'Coruja' ? 'selected' : ''}>Coruja (Visão no Escuro 18m)</option>
          <option value="Pantera" ${aspecto === 'Pantera' ? 'selected' : ''}>Pantera (Escalada = Deslocamento)</option>
          <option value="Salmão" ${aspecto === 'Salmão' ? 'selected' : ''}>Salmão (Natação = Deslocamento)</option>
        </select>
        <span style="font-size:0.75rem;color:var(--text-muted)">Alterar no Descanso Longo</span>
      </div>
    `;
  } else if (ehVitalidadeArvore) {
    // Vitalidade da Árvore: info sobre PVT ao ativar + cura por turno
    const furiaAtiva = !!getEstadoFuria()?.ativa;
    const danoFuria = getEstadoFuria()?.dano || 0;
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem;color:${furiaAtiva ? 'var(--success)' : 'var(--text-muted)'}">
        ${furiaAtiva ? `<strong>Ativo:</strong> Surto: PVT = nível (${char.nivel})  |  Força Revigorante: ${danoFuria}d6 PVT a aliado por turno` : 'PVT ao ativar Fúria + d6 x dano da Fúria PVT a aliado/turno'}
      </div>
    `;
  } else if (ehGolpeBrutal) {
    // Golpe Brutal (9) / Golpe Brutal Aprimorado (13/17)
    const nivel = char.nivel || 1;
    const dadosDano = nivel >= 17 ? '2d10' : '1d10';
    const efeitosDisponiveis = ['Golpe Debilitador (-4,5m Desloc.)', 'Golpe Poderoso (empurrar 4,5m)'];
    if (nivel >= 13) {
      efeitosDisponiveis.push('Golpe Atordoante (Desv. prox. salv.)');
      efeitosDisponiveis.push('Golpe Destruidor (+5 prox. ataque aliado)');
    }
    const numEfeitos = nivel >= 17 ? 2 : 1;
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--accent);font-weight:600;margin-bottom:4px">+${dadosDano} dano (renunciar Vantagem do Ataque Imprudente)</div>
        <div style="color:var(--text-muted);font-size:0.75rem">Efeitos disponíveis (escolha ${numEfeitos}):</div>
        <ul style="margin:2px 0 0 16px;padding:0;font-size:0.75rem;color:var(--text-muted)">
          ${efeitosDisponiveis.map(e => `<li>${e}</li>`).join('')}
        </ul>
      </div>
    `;
  } else if (ehFrenesi) {
    // Berserker: Frenesi (nv3) — dano extra com Ataque Imprudente durante Fúria
    const nivel = char.nivel || 1;
    const bonusDanoFuria = nivel >= 16 ? 4 : nivel >= 9 ? 3 : 2;
    const furiaAtiva = !!getEstadoFuria()?.ativa;
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem;color:${furiaAtiva ? 'var(--success)' : 'var(--text-muted)'}">
        ${furiaAtiva ? `<strong>Ativo:</strong> +${bonusDanoFuria}d6 dano extra (1o alvo por turno com Ataque Imprudente)` : 'Requer Fúria ativa + Ataque Imprudente'}
      </div>
    `;
  } else if (ehRetaliacao) {
    // Berserker: Retaliação (nv10) — reação passiva
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--accent);font-weight:600">Reação — Passiva</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">
          Ao sofrer dano de criatura a até 1,5m: ataque corpo a corpo contra ela como Reação.
        </div>
      </div>
    `;
  } else if (ehPresencaIntimidante) {
    // Berserker: Presença Intimidante (nv14) — 1x/longo ou gasta Fúria
    if (!char.recursos) char.recursos = {};
    const usada = !!char.recursos.presenca_intimidante_usada;
    const nivel = char.nivel || 1;
    const modFor = calcMod(char.atributos.forca);
    const cdPresenca = 8 + modFor + bonusProficiencia(nivel);
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${usada ? 'Usada' : 'Disponível'}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm ${usada ? 'btn-secondary' : 'btn-danger'}" data-berserker-acao="presenca-intimidante" ${usada ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Presença Intimidante</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">CD ${cdPresenca} (SAB) | Amedrontado 1 min</span>
        ${usada ? '<button class="btn btn-sm btn-warning" data-berserker-acao="presenca-restaurar">Restaurar (gastar Fúria)</button>' : ''}
      </div>
    `;
    recarga = 'longo';
  } else if (ehContraEncantamento) {
    // Contra-Encantamento (Bardo nível 7): reação ilimitada
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--accent);font-weight:600">Reação — Uso Ilimitado</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">
          Quando você ou criatura a até 9m falhar em salvaguarda contra Amedrontado/Enfeitiçado:
          re-role a salvaguarda com Vantagem.
        </div>
      </div>
    `;
  } else if (ehPalavrasCriacao) {
    // Palavras de Criação (Bardo nível 20): magias sempre preparadas
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--accent);font-weight:600">Magias Sempre Preparadas</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">
          <strong>Palavra de Poder: Matar</strong> e <strong>Palavra de Poder: Salvar</strong><br>
          Pode escolher uma segunda criatura a até 3m do alvo original.
        </div>
      </div>
    `;
  } else if (ehBravuraInspiracaoCombate) {
    // Bravura: Inspiração em Combate (nv3) — informativo
    const dadoInsp = getEstadoInspiracaoBardo()?.dado || 6;
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--accent);font-weight:600">Uso de Inspiração de Bardo em Combate</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">
          <strong>Defesa:</strong> Reação — +d${dadoInsp} na CA contra 1 ataque<br>
          <strong>Ofensa:</strong> +d${dadoInsp} no dano ao acertar um ataque com arma
        </div>
      </div>
    `;
  } else if (ehBravuraMagiaBatalha) {
    // Bravura: Magia de Batalha (nv14) — informativo
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--accent);font-weight:600">Passiva</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">
          Após conjurar magia (ação), pode fazer 1 ataque com arma como Ação Bônus.
        </div>
      </div>
    `;
  } else if (ehDancaGingaFascinante) {
    // Dança: Ginga Fascinante (nv3) — exibir CA alternativa
    const modDes = calcMod(char.atributos.destreza);
    const modCar = calcMod(char.atributos.carisma);
    const caGinga = 10 + modDes + modCar;
    const dadoInsp = getEstadoInspiracaoBardo()?.dado || 6;
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--accent);font-weight:600">CA Desarmada: ${caGinga} (10 + DES ${modDes >= 0 ? '+' : ''}${modDes} + CAR ${modCar >= 0 ? '+' : ''}${modCar})</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">
          Sem armadura/escudo: Vantagem em Atuação (dança)<br>
          Dano desarmado: d${dadoInsp} + DES | Ao gastar Inspiração: golpe desarmado incluso
        </div>
      </div>
    `;
  } else if (ehDancaGingadoCoordenado) {
    // Dança: Gingado Coordenado (nv6) — gasta Inspiração
    const dadoInsp = getEstadoInspiracaoBardo()?.dado || 6;
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--accent);font-weight:600">Gasta 1 Inspiração de Bardo</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">
          Ao jogar Iniciativa: +d${dadoInsp} na Iniciativa para você e aliados em 9m.
        </div>
      </div>
    `;
  } else if (ehDancaMovimentoInspirador) {
    // Dança: Movimento Inspirador (nv6) — reação + gasta Inspiração
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--accent);font-weight:600">Reação — Gasta 1 Inspiração</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">
          Quando inimigo encerra turno a 1,5m: move metade do Deslocamento sem provocar.<br>
          Aliado em 9m também move (sem provocar).
        </div>
      </div>
    `;
  } else if (ehDancaEvasaoLiderada) {
    // Dança: Evasão Liderada (nv14) — passiva
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--accent);font-weight:600">Passiva (não funciona Incapacitado)</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">
          Evasão: sucesso DEX = 0 dano, falha = metade.<br>
          Compartilha com criaturas a 1,5m que fizerem a salvaguarda.
        </div>
      </div>
    `;
  } else if (ehConhecimentoPalavrasInterrupcao) {
    // Conhecimento: Palavras de Interrupção (nv3) — usa Inspiração + Reação
    const dadoInsp = getEstadoInspiracaoBardo()?.dado || 6;
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--accent);font-weight:600">Reação — Gasta 1 Inspiração de Bardo</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">
          Criatura a 18m: subtraia d${dadoInsp} do resultado de dano, teste de atributo ou ataque.
        </div>
      </div>
    `;
  } else if (ehConhecimentoProficienciasBonus) {
    // Conhecimento: Proficiências Bônus (nv3) — passiva
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--accent);font-weight:600">Passiva — +3 Perícias</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">
          Escolha 3 perícias adicionais para se tornar proficiente.
        </div>
      </div>
    `;
  } else if (ehConhecimentoDescobertasMagicas) {
    // Conhecimento: Descobertas Mágicas (nv6) — passiva
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--accent);font-weight:600">Passiva — 2 Magias de Qualquer Lista</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">
          Aprenda 2 magias de qualquer lista (Clérigo, Druida, Mago).<br>
          Sempre preparadas. Trocáveis ao subir de nível.
        </div>
      </div>
    `;
  } else if (ehConhecimentoPericiaInigualavel) {
    // Conhecimento: Perícia Inigualável (nv14) — usa Inspiração
    const dadoInsp = getEstadoInspiracaoBardo()?.dado || 6;
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--accent);font-weight:600">Gasta 1 Inspiração de Bardo (não gasta se ainda falhar)</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">
          Ao falhar teste de atributo ou ataque: +d${dadoInsp} ao d20.
          Se ainda falhar, não gasta a Inspiração.
        </div>
      </div>
    `;
  } else if (ehGlamourMagiaFascinante) {
    // Glamour: Magia Fascinante (nv3) — 1x/longo ou gasta Inspiração
    if (!char.recursos) char.recursos = {};
    if (!char.recursos.bardo) char.recursos.bardo = { subclasses: { glamour: {} } };
    if (!char.recursos.bardo.subclasses) char.recursos.bardo.subclasses = { glamour: {} };
    if (!char.recursos.bardo.subclasses.glamour) char.recursos.bardo.subclasses.glamour = {};
    const usada = !!char.recursos.bardo.subclasses.glamour.magia_fascinante_usada;
    const nivel = char.nivel || 1;
    const cdFeitico = 8 + calcMod(char.atributos.carisma) + bonusProficiencia(nivel);
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${usada ? 'Usada' : 'Disponível'}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm ${usada ? 'btn-secondary' : 'btn-accent'}" data-bardo-subclasse-acao="glamour_magia_fascinante" ${usada ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Magia Fascinante</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">CD ${cdFeitico} (SAB) | Amedrontado/Enfeitiçado 1 min</span>
        ${usada ? '<button class="btn btn-sm btn-warning" data-bardo-subclasse-acao="glamour_magia_fascinante_restaurar">Restaurar (gastar Inspiração)</button>' : ''}
      </div>
    `;
    recarga = 'longo';
  } else if (ehGlamourMantoInspiracao) {
    // Glamour: Manto de Inspiração (nv3) — gasta Inspiração de Bardo
    const dadoInsp = getEstadoInspiracaoBardo()?.dado || 6;
    const modCar = Math.max(1, calcMod(char.atributos.carisma));
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--accent);font-weight:600">Ação Bônus — Gasta 1 Inspiração de Bardo</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">
          Até ${modCar} criaturas em 18m recebem ${2 * dadoInsp} PV temporários.<br>
          + Reação para mover sem provocar Ataques de Oportunidade.
        </div>
      </div>
    `;
  } else if (ehGlamourMantoMajestade) {
    // Glamour: Manto de Majestade (nv6) — 1x/longo
    if (!char.recursos) char.recursos = {};
    if (!char.recursos.bardo) char.recursos.bardo = { subclasses: { glamour: {} } };
    if (!char.recursos.bardo.subclasses) char.recursos.bardo.subclasses = { glamour: {} };
    if (!char.recursos.bardo.subclasses.glamour) char.recursos.bardo.subclasses.glamour = {};
    const usado = !!char.recursos.bardo.subclasses.glamour.manto_majestade_usado;
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${usado ? 'Usado' : 'Disponível'}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm ${usado ? 'btn-secondary' : 'btn-accent'}" data-bardo-subclasse-acao="glamour_manto_majestade" ${usado ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Ativar Manto de Majestade</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Ação Bônus: Comando sem espaço + aura 1 min</span>
      </div>
    `;
    recarga = 'longo';
  } else if (ehGlamourMajestadeInquebravel) {
    // Glamour: Majestade Inquebrável (nv14) — 1x/curto ou longo
    if (!char.recursos) char.recursos = {};
    if (!char.recursos.bardo) char.recursos.bardo = { subclasses: { glamour: {} } };
    if (!char.recursos.bardo.subclasses) char.recursos.bardo.subclasses = { glamour: {} };
    if (!char.recursos.bardo.subclasses.glamour) char.recursos.bardo.subclasses.glamour = {};
    const usada = !!char.recursos.bardo.subclasses.glamour.majestade_inquebravel_usada;
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${usada ? 'Usada' : 'Disponível'}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm ${usada ? 'btn-secondary' : 'btn-accent'}" data-bardo-subclasse-acao="glamour_majestade_inquebravel" ${usada ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Majestade Inquebrável</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Ação Bônus: 1 min, atacantes fazem salv. CAR ou falham</span>
      </div>
    `;
    recarga = 'curto_ou_longo';
  } else if (ehInimigoFavoritoGuardiao && estadoGuardiao) {
    // Inimigo Favorito: usa o mesmo data-guardiao-acao do info-box
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoGuardiao.inimigoFavoritoDisponiveis}/${estadoGuardiao.inimigoFavoritoMax}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm ${estadoGuardiao.marcaPredadorAtiva ? 'btn-secondary' : 'btn-accent'}" data-guardiao-acao="${estadoGuardiao.marcaPredadorAtiva ? 'encerrar-marca' : 'usar-marca'}" ${(!estadoGuardiao.marcaPredadorAtiva && estadoGuardiao.inimigoFavoritoDisponiveis <= 0) ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>
          ${estadoGuardiao.marcaPredadorAtiva ? 'Encerrar Marca' : 'Ativar Marca (sem espaço)'}
        </button>
        ${estadoGuardiao.marcaPredadorAtiva ? `<span style="font-size:0.75rem;color:var(--success)">Marca ativa (${estadoGuardiao.marcaPredadorDado})</span>` : ''}
      </div>
    `;
  } else if (ehIncansavelGuardiao && estadoGuardiao && estadoGuardiao.incansavelAtivo) {
    // Incansavel: usa o mesmo data-guardiao-acao do info-box
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoGuardiao.incansavelDisponiveis}/${estadoGuardiao.incansavelMax}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-secondary" data-guardiao-acao="incansavel" ${estadoGuardiao.incansavelDisponiveis <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Incansavel</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">d8 + mod Sabedoria PV temporarios</span>
      </div>
    `;
  } else if (ehVeuNaturezaGuardiao && estadoGuardiao && estadoGuardiao.veuNaturezaAtivo) {
    // Veu da Natureza: usa o mesmo data-guardiao-acao do info-box
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoGuardiao.veuNaturezaDisponiveis}/${estadoGuardiao.veuNaturezaMax}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-secondary" data-guardiao-acao="veu" ${estadoGuardiao.veuNaturezaDisponiveis <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Veu da Natureza</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Invisivel ate o final do proximo turno</span>
      </div>
    `;
  } else if (ehFormaSelvagem && estadoDruida) {
    // Forma Selvagem: usa o mesmo data-druida-forma-acao do info-box
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoDruida.usosDisponiveis}/${estadoDruida.usosMax}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm ${estadoDruida.formaSelvagemAtiva ? 'btn-secondary' : 'btn-accent'}" data-druida-forma-acao="${estadoDruida.formaSelvagemAtiva ? 'desativar' : 'ativar'}" ${(!estadoDruida.formaSelvagemAtiva && estadoDruida.usosDisponiveis <= 0) ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>
          ${estadoDruida.formaSelvagemAtiva ? 'Encerrar Forma Selvagem' : 'Ativar Forma Selvagem'}
        </button>
      </div>
    `;
  } else if (ehInspiracaoBardo && estadoInspiracaoBardo) {
    // Inspiracao de Bardo: usa o mesmo data-inspiracao-acao do info-box
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoInspiracaoBardo.usosDisponiveis}/${estadoInspiracaoBardo.usosMax}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-accent" data-inspiracao-acao="usar" ${estadoInspiracaoBardo.usosDisponiveis <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Inspiracao (d${estadoInspiracaoBardo.dado})</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Recupera ${estadoInspiracaoBardo.recuperaCurto ? 'Descanso Curto' : 'Descanso Longo'}</span>
      </div>
    `;
  } else if (ehAstuciaBruxo && estadoBruxoFeature) {
    // Astucia Magica: usa o mesmo data-bruxo-astucia-acao do info-box
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoBruxoFeature.astuciaUsada ? 'Usada' : 'Disponivel'}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-accent" data-bruxo-astucia-acao="usar" ${estadoBruxoFeature.astuciaUsada ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Astucia Magica</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Recupera no Descanso Longo</span>
      </div>
    `;
  } else if (ehArquifadaPassos && estadoBruxoSub) {
    // Patrono Arquifada nv3: Passos Feéricos — CHA mod usos/longo
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoBruxoSub.passosFeericosDisponiveis}/${estadoBruxoSub.passosFeericosMax}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-accent" data-bruxo-subclasse-acao="passos_feericos" ${estadoBruxoSub.passosFeericosDisponiveis <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Passos Feéricos</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Teletransportar 9m + Passo Provocante ou Revigorante</span>
      </div>
    `;
    recarga = 'longo';
  } else if (ehArquifadaFuga && estadoBruxoSub) {
    // Patrono Arquifada nv6: Fuga em Névoa — 1/longo ou gastar espaço de Pacto
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoBruxoSub.fugaNeVoaUsada ? 'Usada' : 'Disponível'}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm ${estadoBruxoSub.fugaNeVoaUsada ? 'btn-secondary' : 'btn-accent'}" data-bruxo-subclasse-acao="fuga_nevoa" ${estadoBruxoSub.fugaNeVoaUsada ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Fuga em Névoa</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Reação: Passo Nebuloso + Desvanecedor ou Terrível</span>
        ${estadoBruxoSub.fugaNeVoaUsada ? '<button class="btn btn-sm btn-warning" data-bruxo-subclasse-acao="fuga_nevoa_restaurar">Restaurar (gastar Espaço de Pacto)</button>' : ''}
      </div>
    `;
    recarga = 'longo';
  } else if (ehArquifadaDefesas && estadoBruxoSub) {
    // Patrono Arquifada nv10: Defesas Sedutoras — imune Enfeitiçado + reação 1/longo
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoBruxoSub.defesasSedutorasUsada ? 'Usada' : 'Disponível'}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm ${estadoBruxoSub.defesasSedutorasUsada ? 'btn-secondary' : 'btn-accent'}" data-bruxo-subclasse-acao="defesas_sedutoras" ${estadoBruxoSub.defesasSedutorasUsada ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Defesas Sedutoras</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Reação: Enfeitiçar atacante | Imune a Enfeitiçado</span>
        ${estadoBruxoSub.defesasSedutorasUsada ? '<button class="btn btn-sm btn-warning" data-bruxo-subclasse-acao="defesas_sedutoras_restaurar">Restaurar (gastar Espaço de Pacto)</button>' : ''}
      </div>
    `;
    recarga = 'longo';
  } else if (ehArquifadaMagiaSedutora) {
    // Patrono Arquifada nv14: Magia Sedutora — passiva
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--accent);font-weight:600">Passiva</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">
          Após conjurar Encantamento ou Ilusão: Passo Nebuloso grátis (sem espaço, sem ação).
        </div>
      </div>
    `;
  } else if (ehCelestialLuz && estadoBruxoSub) {
    // Patrono Celestial nv3: Luz Medicinal — pool de d6s = 1 + nível
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoBruxoSub.luzMedicinalDadosDisponiveis}/${estadoBruxoSub.luzMedicinalDadosMax} d6</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-accent" data-bruxo-subclasse-acao="luz_medicinal" ${estadoBruxoSub.luzMedicinalDadosDisponiveis <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Luz Medicinal</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Ação Bônus: gaste d6s para curar a até 18m</span>
      </div>
    `;
    recarga = 'longo';
  } else if (ehCelestialAlma) {
    // Patrono Celestial nv6: Alma Radiante — passiva
    const modCar = Math.max(1, calcMod(char.atributos.carisma));
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--accent);font-weight:600">Passiva — Resistência + Dano Extra</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">
          Resistência a dano Radiante.<br>
          Ao causar dano Ígneo ou Radiante: +${modCar} (mod CAR) ao dano.
        </div>
      </div>
    `;
  } else if (ehCelestialResiliencia) {
    // Patrono Celestial nv10: Resiliência Celestial — passiva
    const nivel = char.nivel || 1;
    const modCar = Math.max(1, calcMod(char.atributos.carisma));
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--accent);font-weight:600">Passiva — PV Temporários</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">
          Ao terminar Descanso Curto/Longo ou usar Recuperação Arcana: receba ${modCar}+${nivel} PVT (mod CAR + nível).
        </div>
      </div>
    `;
  } else if (ehCelestialVinganca && estadoBruxoSub) {
    // Patrono Celestial nv14: Vingança Calcinante — 1/longo
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoBruxoSub.vingancaCalcinanteUsada ? 'Usada' : 'Disponível'}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm ${estadoBruxoSub.vingancaCalcinanteUsada ? 'btn-secondary' : 'btn-danger'}" data-bruxo-subclasse-acao="vinganca_calcinante" ${estadoBruxoSub.vingancaCalcinanteUsada ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Vingança Calcinante</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Quando aliado faz salvaguarda contra morte: 2d8+CAR Radiante em 9m</span>
      </div>
    `;
    recarga = 'longo';
  } else if (ehAntigoCombatente && estadoBruxoSub) {
    // Patrono O Grande Antigo nv6: Combatente Clarividente — 1/curto ou gastar Pacto
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoBruxoSub.combatenteClarividenteUsado ? 'Usado' : 'Disponível'}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm ${estadoBruxoSub.combatenteClarividenteUsado ? 'btn-secondary' : 'btn-accent'}" data-bruxo-subclasse-acao="combatente_clarividente" ${estadoBruxoSub.combatenteClarividenteUsado ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Combatente Clarividente</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Ação Bônus: Vantagem em ataques 1 turno</span>
        ${estadoBruxoSub.combatenteClarividenteUsado ? '<button class="btn btn-sm btn-warning" data-bruxo-subclasse-acao="combatente_clarividente_restaurar">Restaurar (gastar Espaço de Pacto)</button>' : ''}
      </div>
    `;
    recarga = 'curto_ou_longo';
  } else if (ehAntigoDanacao) {
    // Patrono O Grande Antigo nv10: Danação Mística — passiva (aprimora Maldição)
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--accent);font-weight:600">Passiva — Aprimora Maldição</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">
          Maldição não requer Concentração. Dano adicional Psíquico = bônus de proficiência.<br>
          Transferência: ao abater alvo, mova para criatura a até 9m.
        </div>
      </div>
    `;
  } else if (ehAntigoEscudo) {
    // Patrono O Grande Antigo nv10: Escudo Mental — passiva
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--accent);font-weight:600">Passiva — Resistência Psíquica</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">
          Resistência a dano Psíquico. Ao sofrer dano Psíquico: reflexão do dano de volta ao atacante.
        </div>
      </div>
    `;
  } else if (ehInferoBencao) {
    // Patrono Ínfero nv3: Bênção do Tenebroso — passiva
    const modCar = Math.max(1, calcMod(char.atributos.carisma));
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--accent);font-weight:600">Passiva — PV Temporários ao Abater</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">
          Ao reduzir criatura hostil a 0 PV: receba ${modCar}+${char.nivel || 1} PVT (mod CAR + nível).
        </div>
      </div>
    `;
  } else if (ehInferoSorte && estadoBruxoSub) {
    // Patrono Ínfero nv6: A Sorte do Próprio Tenebroso — CHA mod usos/longo
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoBruxoSub.sorteTenebrosoDisponiveis}/${estadoBruxoSub.sorteTenebrosoMax}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-accent" data-bruxo-subclasse-acao="sorte_tenebroso" ${estadoBruxoSub.sorteTenebrosoDisponiveis <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Sorte (+1d10)</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Ao falhar teste de atributo ou salvaguarda: +1d10</span>
      </div>
    `;
    recarga = 'longo';
  } else if (ehInferoResistencia && estadoBruxoSub) {
    // Patrono Ínfero nv10: Resistência Ínfera — escolher tipo no descanso
    const escolha = estadoBruxoSub.resistenciaInferaEscolha;
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${escolha || 'Nenhuma'}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <select data-bruxo-subclasse-acao="resistencia_infera_escolha" style="padding:4px 8px;border-radius:4px;border:1px solid var(--border);font-size:0.8rem;background:var(--bg-card);color:var(--text)">
          <option value="" ${!escolha ? 'selected' : ''}>Escolher...</option>
          <option value="Contundente" ${escolha === 'Contundente' ? 'selected' : ''}>Contundente</option>
          <option value="Cortante" ${escolha === 'Cortante' ? 'selected' : ''}>Cortante</option>
          <option value="Perfurante" ${escolha === 'Perfurante' ? 'selected' : ''}>Perfurante</option>
          <option value="Ácido" ${escolha === 'Ácido' ? 'selected' : ''}>Ácido</option>
          <option value="Elétrico" ${escolha === 'Elétrico' ? 'selected' : ''}>Elétrico</option>
          <option value="Gélido" ${escolha === 'Gélido' ? 'selected' : ''}>Gélido</option>
          <option value="Ígneo" ${escolha === 'Ígneo' ? 'selected' : ''}>Ígneo</option>
          <option value="Necrótico" ${escolha === 'Necrótico' ? 'selected' : ''}>Necrótico</option>
          <option value="Radiante" ${escolha === 'Radiante' ? 'selected' : ''}>Radiante</option>
          <option value="Trovejante" ${escolha === 'Trovejante' ? 'selected' : ''}>Trovejante</option>
          <option value="Venenoso" ${escolha === 'Venenoso' ? 'selected' : ''}>Venenoso</option>
        </select>
        <span style="font-size:0.75rem;color:var(--text-muted)">Alterar ao terminar Descanso Curto ou Longo</span>
      </div>
    `;
  } else if (ehInferoLancar && estadoBruxoSub) {
    // Patrono Ínfero nv14: Lançar no Inferno — 1/longo ou gastar Pacto
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoBruxoSub.lancarInfernoUsado ? 'Usado' : 'Disponível'}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm ${estadoBruxoSub.lancarInfernoUsado ? 'btn-secondary' : 'btn-danger'}" data-bruxo-subclasse-acao="lancar_inferno" ${estadoBruxoSub.lancarInfernoUsado ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Lançar no Inferno</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">8d10 Psíquico + 8d10 Ígneo (aparência do Inferno)</span>
        ${estadoBruxoSub.lancarInfernoUsado ? '<button class="btn btn-sm btn-warning" data-bruxo-subclasse-acao="lancar_inferno_restaurar">Restaurar (gastar Espaço de Pacto)</button>' : ''}
      </div>
    `;
    recarga = 'longo';
  } else if (ehLuaPassoLunar && estadoDruidaSub) {
    // Círculo da Lua nv10: Passo Lunar — SAB mod/longo, recuperável com slot 2+
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoDruidaSub.passoLunarDisponiveis}/${estadoDruidaSub.passoLunarMax}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-accent" data-druida-subclasse-acao="passo_lunar" ${estadoDruidaSub.passoLunarDisponiveis <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Passo Lunar</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Teleporte 9m + Vantagem no próximo ataque</span>
        ${estadoDruidaSub.passoLunarDisponiveis < estadoDruidaSub.passoLunarMax ? '<button class="btn btn-sm btn-warning" data-druida-subclasse-acao="passo_lunar_restaurar">Restaurar (gastar slot 2+)</button>' : ''}
      </div>
    `;
    recarga = 'longo';
  } else if (ehTerraRecuperacao && estadoDruidaSub) {
    // Círculo da Terra nv6: Recuperação Natural — 1 magia grátis/longo + slots/curto(1/longo)
    const magiaStatus = estadoDruidaSub.recuperacaoNaturalMagiaUsada ? 'Usada' : 'Disponível';
    const slotsStatus = estadoDruidaSub.recuperacaoNaturalSlotsUsada ? 'Usada' : 'Disponível';
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">Magia: ${magiaStatus} | Slots: ${slotsStatus}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm ${estadoDruidaSub.recuperacaoNaturalMagiaUsada ? 'btn-secondary' : 'btn-accent'}" data-druida-subclasse-acao="recuperacao_magia" ${estadoDruidaSub.recuperacaoNaturalMagiaUsada ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Conjurar Magia Grátis</button>
        <button class="btn btn-sm ${estadoDruidaSub.recuperacaoNaturalSlotsUsada ? 'btn-secondary' : 'btn-warning'}" data-druida-subclasse-acao="recuperacao_slots" ${estadoDruidaSub.recuperacaoNaturalSlotsUsada ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Recuperar Slots (Desc. Curto)</button>
      </div>
    `;
    recarga = 'longo';
  } else if (ehEstrelasForma && estadoDruidaSub) {
    // Círculo das Estrelas nv3: Forma Estrelada — escolha de constelação
    const constelacao = estadoDruidaSub.constelacaoAtiva;
    usosHtmlSummary = constelacao ? `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">Ativa: ${constelacao}</span>` : '';
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <span style="font-size:0.8rem;font-weight:600">Constelação:</span>
        <select data-druida-subclasse-acao="constelacao_escolha" style="padding:4px 8px;border-radius:4px;border:1px solid var(--border);font-size:0.8rem;background:var(--bg-card);color:var(--text)">
          <option value="" ${!constelacao ? 'selected' : ''}>Nenhuma</option>
          <option value="Arqueiro" ${constelacao === 'Arqueiro' ? 'selected' : ''}>Arqueiro (1d8 Radiante + SAB)</option>
          <option value="Dragão" ${constelacao === 'Dragão' ? 'selected' : ''}>Dragão (mín 10 em INT/SAB/CON conc.)</option>
          <option value="Taça" ${constelacao === 'Taça' ? 'selected' : ''}>Taça (1d8 + SAB cura extra)</option>
        </select>
        <span style="font-size:0.75rem;color:var(--text-muted)">Gasta 1 uso de Forma Selvagem</span>
      </div>
    `;
  } else if (ehEstrelasMapa && estadoDruidaSub) {
    // Círculo das Estrelas nv3: Mapa Estelar — SAB mod Raio Guia grátis/longo
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoDruidaSub.mapaEstelarDisponiveis}/${estadoDruidaSub.mapaEstelarMax}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-accent" data-druida-subclasse-acao="mapa_estelar" ${estadoDruidaSub.mapaEstelarDisponiveis <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Conjurar Raio Guia (grátis)</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Raio Guia sem gastar espaço de magia</span>
      </div>
    `;
    recarga = 'longo';
  } else if (ehEstrelasPresagio && estadoDruidaSub) {
    // Círculo das Estrelas nv6: Presságio Cósmico — SAB mod reações/longo + tipo par/ímpar
    const tipo = estadoDruidaSub.pressagioTipo;
    const tipoLabel = tipo === 'prosperidade' ? 'Prosperidade (+1d6)' : tipo === 'infortunio' ? 'Infortúnio (-1d6)' : 'Não definido';
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoDruidaSub.pressagioDisponiveis}/${estadoDruidaSub.pressagioMax} | ${tipoLabel}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-accent" data-druida-subclasse-acao="pressagio_usar" ${estadoDruidaSub.pressagioDisponiveis <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Presságio</button>
        <select data-druida-subclasse-acao="pressagio_tipo" style="padding:4px 8px;border-radius:4px;border:1px solid var(--border);font-size:0.8rem;background:var(--bg-card);color:var(--text)">
          <option value="" ${!tipo ? 'selected' : ''}>Escolher tipo</option>
          <option value="prosperidade" ${tipo === 'prosperidade' ? 'selected' : ''}>Prosperidade (par, +1d6)</option>
          <option value="infortunio" ${tipo === 'infortunio' ? 'selected' : ''}>Infortúnio (ímpar, -1d6)</option>
        </select>
      </div>
    `;
    recarga = 'longo';
  } else if (ehAndarilhoReforcos && estadoGuardiaoSub) {
    // Andarilho Feérico nv11: Reforços Feéricos — 1 conjuração grátis/longo
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoGuardiaoSub.reforcosFeericosUsado ? 'Usado' : 'Disponível'}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm ${estadoGuardiaoSub.reforcosFeericosUsado ? 'btn-secondary' : 'btn-accent'}" data-guardiao-subclasse-acao="reforcos_feericos" ${estadoGuardiaoSub.reforcosFeericosUsado ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Convocar Feérico (grátis)</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Sem Material, sem slot, sem Concentração (1 min)</span>
      </div>
    `;
    recarga = 'longo';
  } else if (ehAndarilhoNebuloso && estadoGuardiaoSub) {
    // Andarilho Feérico nv15: Andarilho Nebuloso — SAB mod Passo Nebuloso grátis/longo
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoGuardiaoSub.andarilhoNebulosoDisponiveis}/${estadoGuardiaoSub.andarilhoNebulosoMax}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-accent" data-guardiao-subclasse-acao="andarilho_nebuloso" ${estadoGuardiaoSub.andarilhoNebulosoDisponiveis <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Passo Nebuloso (grátis)</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Teleporte 9m + pode levar 1 criatura a 1,5m</span>
      </div>
    `;
    recarga = 'longo';
  } else if (ehCacadorPresa && estadoGuardiaoSub) {
    // Caçador nv3: Presa do Caçador — escolha
    const escolha = estadoGuardiaoSub.presaCacadorEscolha;
    usosHtmlSummary = escolha ? `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${escolha}</span>` : '';
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <span style="font-size:0.8rem;font-weight:600">Opção ativa:</span>
        <select data-guardiao-subclasse-acao="presa_escolha" style="padding:4px 8px;border-radius:4px;border:1px solid var(--border);font-size:0.8rem;background:var(--bg-card);color:var(--text)">
          <option value="" ${!escolha ? 'selected' : ''}>Escolher</option>
          <option value="Assassino de Colossos" ${escolha === 'Assassino de Colossos' ? 'selected' : ''}>Assassino de Colossos (+1d8 se PV < máx)</option>
          <option value="Destruidor de Hordas" ${escolha === 'Destruidor de Hordas' ? 'selected' : ''}>Destruidor de Hordas (ataque extra 1,5m)</option>
        </select>
      </div>
    `;
  } else if (ehCacadorTaticas && estadoGuardiaoSub) {
    // Caçador nv7: Táticas Defensivas — escolha
    const escolha = estadoGuardiaoSub.taticasDefensivasEscolha;
    usosHtmlSummary = escolha ? `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${escolha}</span>` : '';
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <span style="font-size:0.8rem;font-weight:600">Tática ativa:</span>
        <select data-guardiao-subclasse-acao="taticas_escolha" style="padding:4px 8px;border-radius:4px;border:1px solid var(--border);font-size:0.8rem;background:var(--bg-card);color:var(--text)">
          <option value="" ${!escolha ? 'selected' : ''}>Escolher</option>
          <option value="Defesa Contra Ataques Múltiplos" ${escolha === 'Defesa Contra Ataques Múltiplos' ? 'selected' : ''}>Defesa Contra Ataques Múltiplos</option>
          <option value="Escapar de Hordas" ${escolha === 'Escapar de Hordas' ? 'selected' : ''}>Escapar de Hordas (Desv. em OA)</option>
        </select>
      </div>
    `;
  } else if (ehFerasCompanheiro && estadoGuardiaoSub) {
    // Senhor das Feras nv3: Companheiro Primal — tipo de fera
    const tipo = estadoGuardiaoSub.companheiroTipo;
    usosHtmlSummary = tipo ? `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">Fera: ${tipo}</span>` : '';
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <span style="font-size:0.8rem;font-weight:600">Tipo de Fera:</span>
        <select data-guardiao-subclasse-acao="companheiro_tipo" style="padding:4px 8px;border-radius:4px;border:1px solid var(--border);font-size:0.8rem;background:var(--bg-card);color:var(--text)">
          <option value="" ${!tipo ? 'selected' : ''}>Escolher</option>
          <option value="Fera da Terra" ${tipo === 'Fera da Terra' ? 'selected' : ''}>Fera da Terra (12m, Escalada 12m)</option>
          <option value="Fera do Céu" ${tipo === 'Fera do Céu' ? 'selected' : ''}>Fera do Céu (Voo 18m)</option>
          <option value="Fera do Mar" ${tipo === 'Fera do Mar' ? 'selected' : ''}>Fera do Mar (Natação 18m)</option>
        </select>
      </div>
    `;
  } else if (ehVigilanteEmboscador && estadoGuardiaoSub) {
    // Vigilante das Sombras nv3: Emboscador — Golpe Terrível SAB mod/longo
    const dano = (char.nivel || 1) >= 11 ? '2d8' : '2d6';
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoGuardiaoSub.golpeTerrivelDisponiveis}/${estadoGuardiaoSub.golpeTerrivelMax}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-accent" data-guardiao-subclasse-acao="golpe_terrivel" ${estadoGuardiaoSub.golpeTerrivelDisponiveis <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Golpe Terrível</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">${dano} Psíquico (1/turno) + SAB em Iniciativa</span>
      </div>
    `;
    recarga = 'longo';
  } else if (ehCanalizarDivindadeClerigo && estadoClerigo) {
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoClerigo.canalizarDivindadeUsosDisponiveis}/${estadoClerigo.canalizarDivindadeMax}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-primary" data-clerigo-cd-acao="centelha" ${estadoClerigo.canalizarDivindadeUsosDisponiveis <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Centelha Divina</button>
        <button class="btn btn-sm btn-secondary" data-clerigo-cd-acao="expulsar" ${estadoClerigo.canalizarDivindadeUsosDisponiveis <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Expulsar Mortos-Vivos</button>
        ${char.nivel >= 5 ? `<button class="btn btn-sm btn-accent" data-clerigo-cd-acao="fulminar" ${estadoClerigo.canalizarDivindadeUsosDisponiveis <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Fulminar Mortos-Vivos</button>` : ''}
      </div>
    `;
  } else if (ehGolpesAbencoadosClerigo && estadoClerigo) {
    const opcaoAtual = char.recursos?.clerigo?.golpes_abencoados_opcao || '';
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm ${opcaoAtual === 'Conjuração Poderosa' ? 'btn-accent' : 'btn-secondary'}" data-clerigo-golpes-opcao="Conjuração Poderosa">Conjuração Poderosa</button>
        <button class="btn btn-sm ${opcaoAtual === 'Golpe Divino' ? 'btn-accent' : 'btn-secondary'}" data-clerigo-golpes-opcao="Golpe Divino">Golpe Divino</button>
      </div>
    `;
  } else if (ehIntervencaoDivinaClerigo && estadoClerigo) {
    const bloqueada = estadoClerigo.intervencaoDivinaBloqueada;
    const restantes = estadoClerigo.intervencaoDivinaDescansosRestantes;
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${bloqueada ? 'Em recarga' : 'Disponível'}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm ${bloqueada ? 'btn-secondary' : 'btn-primary'}" data-clerigo-intervencao="normal" ${bloqueada ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Intervenção Divina</button>
        ${bloqueada && restantes > 0 ? `<span style="font-size:0.75rem;color:var(--warning)">Recarrega em ${restantes} descanso(s) longo(s)</span>` : ''}
      </div>
    `;
  } else if (ehIntervencaoDivinaMaiorClerigo && estadoClerigo) {
    const bloqueada = estadoClerigo.intervencaoDivinaBloqueada;
    const restantes = estadoClerigo.intervencaoDivinaDescansosRestantes;
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${bloqueada ? 'Em recarga' : 'Disponível'}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm ${bloqueada ? 'btn-secondary' : 'btn-primary'}" data-clerigo-intervencao="normal" ${bloqueada ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Intervenção (normal)</button>
        <button class="btn btn-sm ${bloqueada ? 'btn-secondary' : 'btn-danger'}" data-clerigo-intervencao="desejo" ${bloqueada ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Intervenção Maior (Desejo)</button>
        ${bloqueada && restantes > 0 ? `<span style="font-size:0.75rem;color:var(--warning)">Recarrega em ${restantes} descanso(s) longo(s)</span>` : ''}
      </div>
    `;
  } else if (ehGuerraAtaqueDirecionado && estadoClerigo && estadoSubclassesClerigo) {
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">CD ${estadoClerigo.canalizarDivindadeUsosDisponiveis}/${estadoClerigo.canalizarDivindadeMax}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-primary" data-clerigo-subclasse-acao="guerra_ataque_direcionado" ${estadoClerigo.canalizarDivindadeUsosDisponiveis <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Ataque Direcionado</button>
      </div>
    `;
  } else if (ehGuerraSacerdote && estadoSubclassesClerigo) {
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoSubclassesClerigo.guerra.sacerdoteUsosDisponiveis}/${estadoSubclassesClerigo.guerra.sacerdoteUsosMax}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-primary" data-clerigo-subclasse-acao="guerra_sacerdote_guerra" ${estadoSubclassesClerigo.guerra.sacerdoteUsosDisponiveis <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Sacerdote da Guerra</button>
      </div>
    `;
  } else if (ehGuerraBencaoDeus && estadoClerigo) {
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">CD ${estadoClerigo.canalizarDivindadeUsosDisponiveis}/${estadoClerigo.canalizarDivindadeMax}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-primary" data-clerigo-subclasse-acao="guerra_bencao_deus" ${estadoClerigo.canalizarDivindadeUsosDisponiveis <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Bênção do Deus da Guerra</button>
      </div>
    `;
  } else if (ehLuzBrilho && estadoClerigo) {
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">CD ${estadoClerigo.canalizarDivindadeUsosDisponiveis}/${estadoClerigo.canalizarDivindadeMax}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-primary" data-clerigo-subclasse-acao="luz_brilho_amanhecer" ${estadoClerigo.canalizarDivindadeUsosDisponiveis <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Brilho do Amanhecer</button>
      </div>
    `;
  } else if (ehLuzLabareda && estadoSubclassesClerigo) {
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoSubclassesClerigo.luz.labaredaUsosDisponiveis}/${estadoSubclassesClerigo.luz.labaredaUsosMax}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-primary" data-clerigo-subclasse-acao="luz_labareda_protetora" ${estadoSubclassesClerigo.luz.labaredaUsosDisponiveis <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Labareda Protetora</button>
      </div>
    `;
  } else if (ehLuzCoroa && estadoSubclassesClerigo) {
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoSubclassesClerigo.luz.coroaUsosDisponiveis}/${estadoSubclassesClerigo.luz.coroaUsosMax}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-primary" data-clerigo-subclasse-acao="luz_coroa_luz" ${estadoSubclassesClerigo.luz.coroaUsosDisponiveis <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Coroa de Luz</button>
      </div>
    `;
  } else if (ehTrapacaBencao && estadoSubclassesClerigo) {
    const ativaBencao = estadoSubclassesClerigo.trapaca.bencaoTrapaceiroAtiva;
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${ativaBencao ? 'Ativa' : 'Inativa'}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm ${ativaBencao ? 'btn-secondary' : 'btn-primary'}" data-clerigo-subclasse-acao="trapaca_bencao_toggle">${ativaBencao ? 'Encerrar Bênção' : 'Ativar Bênção'}</button>
      </div>
    `;
  } else if (ehTrapacaInvocar && estadoClerigo && estadoSubclassesClerigo) {
    const ativaDup = estadoSubclassesClerigo.trapaca.invocarDuplicidadeAtiva;
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${ativaDup ? 'Ativa' : 'Inativa'}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm ${ativaDup ? 'btn-secondary' : 'btn-primary'}" data-clerigo-subclasse-acao="trapaca_invocar_duplicidade" ${(estadoClerigo.canalizarDivindadeUsosDisponiveis <= 0 && !ativaDup) ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>${ativaDup ? 'Encerrar Duplicidade' : 'Invocar Duplicidade'}</button>
        ${!ativaDup ? `<span style="font-size:0.75rem;color:var(--text-muted)">Consome 1 Canalizar Divindade</span>` : ''}
      </div>
    `;
  } else if (ehVidaPreservar && estadoClerigo) {
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">CD ${estadoClerigo.canalizarDivindadeUsosDisponiveis}/${estadoClerigo.canalizarDivindadeMax}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-primary" data-clerigo-subclasse-acao="vida_preservar_vida" ${estadoClerigo.canalizarDivindadeUsosDisponiveis <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Preservar a Vida</button>
      </div>
    `;
  } else if (ehGuerraAvatarGuerra) {
    // Guerra nv17: Avatar da Guerra — resistências passivas
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--accent);font-weight:600">Passiva — Resistências Permanentes</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">
          Resistência a dano <strong>Contundente</strong>, <strong>Cortante</strong> e <strong>Perfurante</strong>.
        </div>
      </div>
    `;
  } else if (ehVidaCurandeiroAbencoado) {
    // Vida nv6: Curandeiro Abençoado — passiva
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--accent);font-weight:600">Passiva — Autocura</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">
          Ao curar outros com espaço de magia: você recupera 2 + círculo do espaço PV.
        </div>
      </div>
    `;
  } else if (ehVidaCuraSuprema) {
    // Vida nv17: Cura Suprema — passiva
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--accent);font-weight:600">Passiva — Dados Maximizados</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">
          Ao restaurar PV com magia ou Canalizar Divindade: use o <strong>valor máximo</strong> dos dados
          (ex: 2d6 = 12, 4d8 = 32).
        </div>
      </div>
    `;
  } else if (ehTrapacaDuplicidadeAprimorada) {
    // Trapaça nv17: Duplicidade Aprimorada — aprimora Invocar Duplicidade
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--accent);font-weight:600">Passiva — Aprimora Invocar Duplicidade</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">
          Aliados também ganham Vantagem em ataques vs criatura perto da ilusão.<br>
          Ao encerrar a duplicidade: cure PV = nível de Clérigo (${char.nivel || 1}).
        </div>
      </div>
    `;
  } else if (ehTrapacaTransposicao) {
    // Trapaça nv6: Transposição do Trapaceiro — passiva
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--accent);font-weight:600">Passiva — Parte de Invocar Duplicidade</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">
          Ao criar ou mover a ilusão: teleporte trocando de lugar com ela.
        </div>
      </div>
    `;
  } else if (ehLuzLabaredaAprimorada) {
    // Luz nv6: Labareda Protetora Aprimorada — aprimora Labareda
    const modSab = Math.max(1, calcMod(char.atributos.sabedoria));
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--accent);font-weight:600">Passiva — Aprimora Labareda Protetora</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">
          Restaura usos em Descanso Curto ou Longo.<br>
          Ao usar: concede 2d6+${modSab} PV temporários ao alvo protegido.
        </div>
      </div>
    `;
  } else if (ehFeiticariaInata && estadoFeiticeiro) {
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoFeiticeiro.feiticariaInataUsosDisponiveis}/${estadoFeiticeiro.feiticariaInataUsosMax}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm ${estadoFeiticeiro.feiticariaInataAtiva ? 'btn-secondary' : 'btn-primary'}" data-feiticeiro-acao="${estadoFeiticeiro.feiticariaInataAtiva ? 'encerrar-feiticaria-inata' : 'ativar-feiticaria-inata'}" ${(estadoFeiticeiro.feiticariaInataUsosDisponiveis <= 0 && !estadoFeiticeiro.feiticariaInataAtiva && (char.nivel || 1) < 7) ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>${estadoFeiticeiro.feiticariaInataAtiva ? 'Encerrar' : 'Ativar'}</button>
      </div>
    `;
  } else if (ehFonteMagia && estadoFeiticeiro) {
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">PF ${estadoFeiticeiro.pontosAtuais}/${estadoFeiticeiro.pontosMax}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-secondary" data-feiticeiro-acao="converter-slot-ponto">Slot → PF</button>
        <button class="btn btn-sm btn-secondary" data-feiticeiro-acao="converter-ponto-slot">PF → Slot</button>
      </div>
    `;
  } else if (ehMetamagia && estadoFeiticeiro) {
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoFeiticeiro.metamagias.length} opção(ões)</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-secondary" data-feiticeiro-acao="metamagia-config">Gerenciar Metamagia</button>
        <button class="btn btn-sm btn-primary" data-feiticeiro-acao="metamagia-gastar">Gastar PF</button>
      </div>
    `;
  } else if (ehRestauracaoFeiticeira && estadoFeiticeiro) {
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoFeiticeiro.restauracaoFeiticeiraUsada ? 'Usada' : 'Disponível'}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-primary" data-feiticeiro-acao="restauracao-feiticeira" ${estadoFeiticeiro.restauracaoFeiticeiraUsada ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Recuperar PF</button>
      </div>
    `;
  } else if (ehFalaTelepatica) {
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-primary" data-feiticeiro-acao="fala-telepatica">Iniciar Telepatia</button>
      </div>
    `;
  } else if (ehRevelacaoCarne) {
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-primary" data-feiticeiro-acao="revelacao-carne">Ativar Revelação em Carne</button>
      </div>
    `;
  } else if (ehAfinidadeElemental && estadoFeiticeiro) {
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoFeiticeiro.subclasses.draconica.afinidade_elemental || 'Não definida'}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-primary" data-feiticeiro-acao="afinidade-elemental">Definir Afinidade</button>
      </div>
    `;
  } else if (ehAsasDragao && estadoFeiticeiro) {
    const ativa = !!estadoFeiticeiro.subclasses.draconica.asas_ativas;
    const usada = !!estadoFeiticeiro.subclasses.draconica.asas_usada_desde_descanso;
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${ativa ? 'Ativas' : (usada ? 'Gasta' : 'Disponível')}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm ${ativa ? 'btn-secondary' : 'btn-primary'}" data-feiticeiro-acao="${ativa ? 'desativar-asas-dragao' : 'ativar-asas-dragao'}">${ativa ? 'Recolher Asas' : 'Abrir Asas'}</button>
      </div>
    `;
  } else if (ehCompanheiroDraconico && estadoFeiticeiro) {
    const usada = !!estadoFeiticeiro.subclasses.draconica.companheiro_draconico_usado;
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${usada ? 'Gasto' : 'Disponível'}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-primary" data-feiticeiro-acao="companheiro-draconico" ${usada ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Conjurar Invocar Dragão (grátis)</button>
      </div>
    `;
  } else if (ehRestaurarEquilibrio && estadoFeiticeiro) {
    const max = estadoFeiticeiro.modCar;
    const gastos = estadoFeiticeiro.subclasses.mecanica.restaurar_equilibrio_usos_gastos || 0;
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${Math.max(0, max - gastos)}/${max}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-primary" data-feiticeiro-acao="restaurar-equilibrio" ${gastos >= max ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Restaurar Equilíbrio</button>
      </div>
    `;
  } else if (ehBastiaoLei && estadoFeiticeiro) {
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">Escudo: ${estadoFeiticeiro.subclasses.mecanica.bastiao_dados || 0}d8</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-primary" data-feiticeiro-acao="bastiao-lei">Criar Bastião da Lei</button>
      </div>
    `;
  } else if (ehTranseOrdem && estadoFeiticeiro) {
    const ativo = !!estadoFeiticeiro.subclasses.mecanica.transe_ordem_ativo;
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${ativo ? 'Ativo' : 'Inativo'}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm ${ativo ? 'btn-secondary' : 'btn-primary'}" data-feiticeiro-acao="${ativo ? 'desativar-transe-ordem' : 'ativar-transe-ordem'}">${ativo ? 'Encerrar Transe' : 'Ativar Transe'}</button>
      </div>
    `;
  } else if (ehMaresCaos && estadoFeiticeiro) {
    const disponivel = !!estadoFeiticeiro.subclasses.selvagem.mares_caos_disponivel;
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${disponivel ? 'Disponível' : 'Indisponível'}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-primary" data-feiticeiro-acao="mares-caos" ${!disponivel ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Marés do Caos</button>
      </div>
    `;
  } else if (ehDistorcerSorte && estadoFeiticeiro) {
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-primary" data-feiticeiro-acao="distorcer-sorte" ${estadoFeiticeiro.pontosAtuais < 1 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Distorcer a Sorte (-1 PF)</button>
      </div>
    `;
  } else if (ehSurtoControlado && estadoFeiticeiro) {
    const usado = !!estadoFeiticeiro.subclasses.selvagem.surto_controlado_usado;
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${usado ? 'Gasto' : 'Disponível'}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-primary" data-feiticeiro-acao="surto-controlado" ${usado ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Surto Controlado</button>
      </div>
    `;
  } else if (ehRecuperarFolegoGuerreiro && estadoGuerreiro) {
    // Recuperar Fôlego: botão dedicado com contador de usos
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoGuerreiro.recuperarFolegoDisponiveis}/${estadoGuerreiro.recuperarFolegoMax}</span>`;
    const curaFormula = `1d10 + ${char.nivel || 1}`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-primary" data-guerreiro-acao="usar-folego" ${estadoGuerreiro.recuperarFolegoDisponiveis <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Recuperar Folego</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Cura: ${curaFormula} PV (Acao Bonus)</span>
      </div>
    `;
    recarga = 'curto_ou_longo';
  } else if (ehSurtoAcaoGuerreiro && estadoGuerreiro) {
    // Surto de Ação: botão de usar com controle
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoGuerreiro.surtoDisponiveis}/${estadoGuerreiro.surtoMax}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-accent" data-guerreiro-acao="usar-surto" ${estadoGuerreiro.surtoDisponiveis <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Surto de Acao</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">1 acao adicional (exceto Usar Magia)</span>
      </div>
    `;
    recarga = 'curto_ou_longo';
  } else if (ehIndomavelGuerreiro && estadoGuerreiro && estadoGuerreiro.indomavelMax > 0) {
    // Indomável: botão de usar com contador
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoGuerreiro.indomavelDisponiveis}/${estadoGuerreiro.indomavelMax}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-danger" data-guerreiro-acao="usar-indomavel" ${estadoGuerreiro.indomavelDisponiveis <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Indomavel</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Bonus: +${char.nivel || 1} na salvaguarda</span>
      </div>
    `;
    recarga = 'longo';
  } else if (ehSuperioridadeCombate && estadoGuerreiro && estadoGuerreiro.dadosSuperioridadeMax > 0) {
    // Mestre da Batalha: Dados de Superioridade
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoGuerreiro.dadosSuperioridadeDisponiveis}/${estadoGuerreiro.dadosSuperioridadeMax} ${estadoGuerreiro.tipoDadoSuperioridade}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-primary" data-guerreiro-acao="usar-superioridade" ${estadoGuerreiro.dadosSuperioridadeDisponiveis <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Dado de Superioridade</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">CD: ${estadoGuerreiro.cdSuperioridade} | Manobras: ${estadoGuerreiro.manobrasConhecidas}</span>
      </div>
      ${estadoGuerreiro.implacavelAtivo ? '<div style="font-size:0.72rem;color:var(--text-muted);padding:2px 0 0 16px">Implacável: 1x/turno role 1d8 grátis em vez de gastar dado.</div>' : ''}
    `;
    recarga = 'curto_ou_longo';
  } else if (ehConhecaInimigo && estadoGuerreiro) {
    // Mestre da Batalha: Conheça Seu Inimigo (nível 7+)
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoGuerreiro.conhecaInimigoUsado ? 'Usado' : 'Disponível'}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-accent" data-guerreiro-acao="conheca-inimigo" ${estadoGuerreiro.conhecaInimigoUsado ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Conheça Seu Inimigo</button>
        <button class="btn btn-sm btn-secondary" data-guerreiro-acao="conheca-inimigo-dado" ${estadoGuerreiro.dadosSuperioridadeDisponiveis <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Recuperar (gasta 1 Dado)</button>
      </div>
    `;
    recarga = 'longo';
  } else if (ehPoderPsionicoGuerreiro && estadoGuerreiro && estadoGuerreiro.dadosPsionicosMaxG > 0) {
    // Combatente Psíquico: Dados de Energia Psiônica
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoGuerreiro.dadosPsionicosDisponiveisG}/${estadoGuerreiro.dadosPsionicosMaxG} ${estadoGuerreiro.tipoDadoPsionicoG}</span>`;
    const semDados = estadoGuerreiro.dadosPsionicosDisponiveisG <= 0;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-primary" data-guerreiro-acao="golpe-psionico" ${semDados ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Golpe Psiônico</button>
        <button class="btn btn-sm btn-accent" data-guerreiro-acao="vinculo-protetivo" ${semDados ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Vínculo Protetivo</button>
        <button class="btn btn-sm btn-secondary" data-guerreiro-acao="movimento-telecinetico" ${estadoGuerreiro.movimentoTelecineticoUsado && semDados ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>${estadoGuerreiro.movimentoTelecineticoUsado ? 'Mov. Telecinético (gasta dado)' : 'Mov. Telecinético (grátis)'}</button>
      </div>
      <div style="font-size:0.72rem;color:var(--text-muted);padding:2px 0 0 16px">
        Golpe: +${estadoGuerreiro.tipoDadoPsionicoG}+mod INT dano Energético | Vínculo: Reação, reduz dano em ${estadoGuerreiro.tipoDadoPsionicoG}+mod INT
      </div>
    `;
    recarga = 'curto_ou_longo';
  } else if (ehAdeptoTelecinetico && estadoGuerreiro) {
    // Combatente Psíquico: Adepto Telecinético (nível 7)
    const semDados = estadoGuerreiro.dadosPsionicosDisponiveisG <= 0;
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoGuerreiro.saltoImpulsaoUsado ? 'Salto Usado' : 'Salto Disponível'}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-accent" data-guerreiro-acao="salto-impulsao" ${estadoGuerreiro.saltoImpulsaoUsado && semDados ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>${estadoGuerreiro.saltoImpulsaoUsado ? 'Salto Psíquico (gasta dado)' : 'Salto Psíquico (grátis)'}</button>
      </div>
      <div style="font-size:0.72rem;color:var(--text-muted);padding:2px 0 0 16px">
        Estocada: alvo faz salv. FOR ou cai Caído/empurrado 3m. Salto: Ação Bônus, Voo = 2x Deslocamento no turno.
      </div>
    `;
    recarga = 'curto_ou_longo';
  } else if (ehBaluarteEnergia && estadoGuerreiro) {
    // Combatente Psíquico: Baluarte de Energia (nível 15)
    const semDados = estadoGuerreiro.dadosPsionicosDisponiveisG <= 0;
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoGuerreiro.baluarteUsado ? 'Usado' : 'Disponível'}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-primary" data-guerreiro-acao="baluarte" ${estadoGuerreiro.baluarteUsado && semDados ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>${estadoGuerreiro.baluarteUsado ? 'Usar Baluarte (gasta dado)' : 'Usar Baluarte (grátis)'}</button>
      </div>
    `;
    recarga = 'longo';
  } else if (ehMestreTelecinetico && estadoGuerreiro) {
    // Combatente Psíquico: Mestre Telecinético (nível 18)
    const semDados = estadoGuerreiro.dadosPsionicosDisponiveisG <= 0;
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoGuerreiro.mestreTelecineticoUsado ? 'Usado' : 'Disponível'}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-primary" data-guerreiro-acao="mestre-telecinetico" ${estadoGuerreiro.mestreTelecineticoUsado && semDados ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>${estadoGuerreiro.mestreTelecineticoUsado ? 'Telecinese (gasta dado)' : 'Conjurar Telecinese (grátis)'}</button>
      </div>
    `;
    recarga = 'longo';
  } else if (ehMaestriaGuerreiro && estadoGuerreiro) {
    // Maestria em Arma: mostra contador de maestrias
    const total = (char.maestrias_arma || []).length;
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${total}/${estadoGuerreiro.maestriasMax}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-accent" data-config-maestrias="1">Definir Maestrias</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">${(char.maestrias_arma || []).join(', ') || 'Nenhuma selecionada'}</span>
      </div>
    `;
  } else if (ehCriticoAprimorado) {
    // Campeão nv3: Crítico em 19-20
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--danger);font-weight:600">Acerto Crítico em 19-20</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">
          Com armas e Ataques Desarmados, resultados 19 ou 20 no d20 são Acertos Críticos.
        </div>
      </div>
    `;
  } else if (ehAtletaExtraordinario) {
    // Campeão nv3: Atleta Extraordinário — passiva
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--accent);font-weight:600">Passiva</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">
          Vantagem em Iniciativa e testes de Atletismo.<br>
          Após Acerto Crítico: move metade do Deslocamento sem provocar.
        </div>
      </div>
    `;
  } else if (ehCombatenteHeroico) {
    // Campeão nv10: Combatente Heroico — passiva
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--accent);font-weight:600">Passiva — A Cada Turno</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">
          No início de cada turno em combate, se não tiver <strong>Inspiração Heroica</strong>: concede a si mesmo.
        </div>
      </div>
    `;
  } else if (ehCriticoSuperior) {
    // Campeão nv15: Crítico em 18-20
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--danger);font-weight:600">Acerto Crítico em 18-20</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">
          Substitui Crítico Aprimorado. Resultados 18, 19 ou 20 no d20 são Acertos Críticos.
        </div>
      </div>
    `;
  } else if (ehSobrevivente) {
    // Campeão nv18: Sobrevivente — duas passivas
    const modCon = calcMod(char.atributos.constituicao);
    const curaInicio = 5 + modCon;
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--danger);font-weight:600">Passiva — Desafie a Morte + Regeneração Heroica</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">
          <strong>Desafie a Morte:</strong> Vantagem em Salvaguardas Contra Morte. 18-20 = resultado 20.<br>
          <strong>Regeneração Heroica:</strong> Início do turno, se Sangrando e com 1+ PV: recupera ${curaInicio} PV (5 + mod CON).
        </div>
      </div>
    `;
  } else if (ehEstiloLutaAdicional) {
    // Campeão nv7: Estilo de Luta Adicional — passiva
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--accent);font-weight:600">Passiva — Talento Adicional</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">
          Ganhe outro talento de Estilo de Luta à sua escolha.
        </div>
      </div>
    `;
  } else if (ehMaestriaGuardiao) {
    // Guardião: Maestria em Arma fixa em 2
    const total = (char.maestrias_arma || []).length;
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${total}/2</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-accent" data-config-maestrias="1">Definir Maestrias</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">${(char.maestrias_arma || []).join(', ') || 'Nenhuma selecionada'}</span>
      </div>
    `;
  } else if (ehMaestriaPaladino) {
    // Paladino: Maestria em Arma fixa em 2
    const total = (char.maestrias_arma || []).length;
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${total}/2</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-accent" data-config-maestrias="1">Definir Maestrias</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">${(char.maestrias_arma || []).join(', ') || 'Nenhuma selecionada'}</span>
      </div>
    `;
  } else if (ehMaestriaLadino) {
    // Ladino: Maestria em Arma fixa em 2
    const total = (char.maestrias_arma || []).length;
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${total}/2</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-accent" data-config-maestrias="1">Definir Maestrias</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">${(char.maestrias_arma || []).join(', ') || 'Nenhuma selecionada'}</span>
      </div>
    `;
  } else if (ehPoderPsionicoLadino && estadoLadino && estadoLadino.dadosPsionicosMaxL > 0) {
    // Adaga Espiritual: Dados de Energia Psiônica
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoLadino.dadosPsionicosDisponiveisL}/${estadoLadino.dadosPsionicosMaxL} ${estadoLadino.tipoDadoPsionicoL}</span>`;
    const semDadosL = estadoLadino.dadosPsionicosDisponiveisL <= 0;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-primary" data-ladino-acao="gastar-dado-psionico">Gastar Dado Psiônico</button>
        <button class="btn btn-sm btn-secondary" data-ladino-acao="sussurros" ${estadoLadino.sussurrosGratisUsado && semDadosL ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>${estadoLadino.sussurrosGratisUsado ? 'Sussurros (gasta dado)' : 'Sussurros Psíquicos (grátis)'}</button>
      </div>
      <div style="font-size:0.72rem;color:var(--text-muted);padding:2px 0 0 16px">
        Aptidão Reforçada: ao falhar perícia, role dado (gasto só se acertar). Sussurros: telepatia por ${estadoLadino.tipoDadoPsionicoL} horas.
      </div>
    `;
    recarga = 'curto_ou_longo';
  } else if (ehLaminasAlma && estadoLadino) {
    // Adaga Espiritual: Lâminas da Alma (nível 9)
    const semDadosL = estadoLadino.dadosPsionicosDisponiveisL <= 0;
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">Dados: ${estadoLadino.dadosPsionicosDisponiveisL}/${estadoLadino.dadosPsionicosMaxL}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-accent" data-ladino-acao="teleporte-psiquico" ${semDadosL ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Teleporte Psíquico</button>
      </div>
      <div style="font-size:0.72rem;color:var(--text-muted);padding:2px 0 0 16px">
        Golpes Teleguiados: ao errar ataque com Lâmina, role dado (gasto só se acertar). Teleporte: gasta dado, teleporta 3x resultado metros.
      </div>
    `;
  } else if (ehVeuPsiquico && estadoLadino) {
    // Adaga Espiritual: Véu Psíquico (nível 13)
    const semDadosL = estadoLadino.dadosPsionicosDisponiveisL <= 0;
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoLadino.veuPsiquicoUsado ? 'Usado' : 'Disponível'}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-primary" data-ladino-acao="veu-psiquico" ${estadoLadino.veuPsiquicoUsado && semDadosL ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>${estadoLadino.veuPsiquicoUsado ? 'Véu Psíquico (gasta dado)' : 'Véu Psíquico (grátis)'}</button>
      </div>
    `;
    recarga = 'longo';
  } else if (ehRasgarMente && estadoLadino) {
    // Adaga Espiritual: Rasgar Mente (nível 17)
    const semDadosL = estadoLadino.dadosPsionicosDisponiveisL < 3;
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoLadino.rasgarMenteUsado ? 'Usado' : 'Disponível'}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-danger" data-ladino-acao="rasgar-mente" ${estadoLadino.rasgarMenteUsado && semDadosL ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>${estadoLadino.rasgarMenteUsado ? 'Rasgar Mente (gasta 3 dados)' : 'Rasgar Mente (grátis)'}</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">CD: ${estadoLadino.cdPsionicaAdaga} (Sab) | Atordoado 1 min</span>
      </div>
    `;
    recarga = 'longo';
  } else if (ehAndarilhoTelhados) {
    // Ladrão nv3: Andarilho de Telhados — passiva
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--accent);font-weight:600">Passiva</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">
          Deslocamento de Escalada = Deslocamento normal (${char.deslocamento || 9}m).<br>
          Saltos usam Destreza em vez de Força.
        </div>
      </div>
    `;
  } else if (ehMaoLeve) {
    // Ladrão nv3: Mão Leve — passiva
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--accent);font-weight:600">Passiva — Ação Bônus</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">
          Prestidigitação (abrir fechadura, desarmar, roubar) ou Usar Objeto/item mágico como Ação Bônus.
        </div>
      </div>
    `;
  } else if (ehFurtividadeSuprema) {
    // Ladrão nv9: Furtividade Suprema — custo em dados de Ataque Furtivo
    const dadosFurtivo = estadoLadino?.furtivoDados || Math.ceil((char.nivel || 1) / 2);
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--accent);font-weight:600">Golpe Astuto: Ataque Escondido (1d6)</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">
          Custo: 1d6 do Ataque Furtivo (${dadosFurtivo}d6 → ${dadosFurtivo - 1}d6).<br>
          O ataque não encerra Invisibilidade se terminar turno com Cobertura 3/4 ou Total.
        </div>
      </div>
    `;
  } else if (ehUsarDispositivoMagico) {
    // Ladrão nv13: Usar Dispositivo Mágico — passiva
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--accent);font-weight:600">Passiva</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">
          Sintonize até <strong>4 itens mágicos</strong> (em vez de 3).<br>
          6 no d6: não gasta cargas de itens. Pode usar Pergaminhos Mágicos (INT para conjuração).
        </div>
      </div>
    `;
  } else if (ehReflexosLadrao) {
    // Ladrão nv17: Reflexos de Ladrão — passiva
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--danger);font-weight:600">Passiva — 2 Turnos na 1a Rodada</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">
          1a rodada de combate: age na Iniciativa normal <strong>e</strong> na Iniciativa -10.
        </div>
      </div>
    `;
  } else if (ehAssassinar) {
    // Assassino nv3: Assassinar — passiva
    const nivel = char.nivel || 1;
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--danger);font-weight:600">Passiva — 1a Rodada</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">
          Vantagem em Iniciativa. 1a rodada: Vantagem em ataques vs criaturas que não agiram.<br>
          Ataque Furtivo acerta: <strong>+${nivel} dano</strong> do tipo da arma (= nível de Ladino).
        </div>
      </div>
    `;
  } else if (ehFerramentasAssassino) {
    // Assassino nv3: Ferramentas de Assassino — passiva
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--accent);font-weight:600">Passiva — Proficiências</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">
          Proficiência com <strong>Kit de Disfarce</strong> e <strong>Kit de Veneno</strong>.
        </div>
      </div>
    `;
  } else if (ehEspecialistaInfiltracao) {
    // Assassino nv9: Especialista em Infiltração — passiva
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--accent);font-weight:600">Passiva</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">
          <strong>Mimetismo Magistral:</strong> Imita fala/caligrafia após 1h estudando.<br>
          <strong>Mira Móvel:</strong> Mira Firme não zera seu Deslocamento.
        </div>
      </div>
    `;
  } else if (ehArmasVenenosas) {
    // Assassino nv13: Armas Venenosas — aprimora Golpe Astuto
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--accent);font-weight:600">Aprimora Golpe Astuto — Opção Envenenar</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">
          +2d6 dano Venenoso a cada falha na salvaguarda (ignora Resistência a Venenoso).
        </div>
      </div>
    `;
  } else if (ehGolpeMortal) {
    // Assassino nv17: Golpe Mortal — passiva 1a rodada
    const nivel = char.nivel || 1;
    const modDes = calcMod(char.atributos.destreza);
    const cdGolpeMortal = 8 + modDes + bonusProficiencia(nivel);
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--danger);font-weight:600">Passiva — 1a Rodada</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">
          Ataque Furtivo acerta na 1a rodada: salvaguarda CON <strong>CD ${cdGolpeMortal}</strong> ou dano dobrado.
        </div>
      </div>
    `;
  } else if (ehMaosConsagradasPaladino && estadoPaladino) {
    // Mãos Consagradas: mostra reserva de PV
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoPaladino.maosAtuais}/${estadoPaladino.maosMax} PV</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-accent" data-paladino-acao="maos-consagradas" ${estadoPaladino.maosAtuais <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Mãos Consagradas</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Ação Bônus | Reserva: ${estadoPaladino.maosAtuais} PV</span>
      </div>
    `;
    recarga = 'longo';
  } else if (ehCanalizarPaladino && estadoPaladino && estadoPaladino.canalizarMax > 0) {
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoPaladino.canalizarDisponiveis}/${estadoPaladino.canalizarMax}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-accent" data-paladino-acao="canalizar" ${estadoPaladino.canalizarDisponiveis <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Canalizar Divindade</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Recupera 1 uso por Descanso Curto</span>
      </div>
    `;
    recarga = 'curto_ou_longo';
  } else if (ehDestruicaoPaladino && estadoPaladino) {
    usosHtmlSummary = estadoPaladino.destruicaoGratuitaAtiva ? `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoPaladino.destruicaoGratuitaUsada ? 'Usada' : 'Disponível'}</span>` : '';
    usosHtmlBody = estadoPaladino.destruicaoGratuitaAtiva ? `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-primary" data-paladino-acao="destruicao-gratuita" ${estadoPaladino.destruicaoGratuitaUsada ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Destruição Gratuita (sem espaço)</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">1x por Descanso Longo</span>
      </div>
    ` : '';
    recarga = 'longo';
  } else if (ehAuraProtecaoPaladino && estadoPaladino && estadoPaladino.auraProtecaoAtiva) {
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">+${estadoPaladino.bonusAura} (${estadoPaladino.auraRaio}m)</span>`;
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem;color:var(--text-muted)">
        Bônus nas salvaguardas = mod Carisma (+${estadoPaladino.bonusAura}) para você e aliados em ${estadoPaladino.auraRaio}m.
        ${estadoPaladino.auraCoragemAtiva ? ' Inclui imunidade a Amedrontado.' : ''}
      </div>
    `;
  } else if (ehGolpesRadiantesPaladino && estadoPaladino && estadoPaladino.golpesRadiantesAtivo) {
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">+1d8 Radiante</span>`;
  } else if (ehGloriaAtletaInigualavel && estadoPaladino) {
    // Glória nv3: Atleta Inigualável — usa Canalizar Divindade
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">CD ${estadoPaladino.canalizarDisponiveis}/${estadoPaladino.canalizarMax}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-primary" data-paladino-subclasse-acao="gloria_atleta" ${estadoPaladino.canalizarDisponiveis <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Ativar Atleta Inigualável</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Ação Bônus: 1h Vant. Atletismo/Acrobacia, +3m saltos</span>
      </div>
    `;
    recarga = 'curto_ou_longo';
  } else if (ehGloriaDestruicaoInspiradora && estadoPaladino) {
    // Glória nv3: Destruição Inspiradora — usa Canalizar Divindade após Destruição Divina
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">CD ${estadoPaladino.canalizarDisponiveis}/${estadoPaladino.canalizarMax}</span>`;
    const nivel = char.nivel || 1;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-primary" data-paladino-subclasse-acao="gloria_destruicao_inspiradora" ${estadoPaladino.canalizarDisponiveis <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Destruição Inspiradora</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Após Destruição Divina: 2d8+${nivel} PVT entre aliados em 9m</span>
      </div>
    `;
    recarga = 'curto_ou_longo';
  } else if (ehGloriaAuraVivacidade) {
    // Glória nv7: Aura de Vivacidade — passiva
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--accent);font-weight:600">Passiva — Aura</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">
          +3m no seu Deslocamento. Aliados na Aura de Proteção: +3m Deslocamento até fim do próximo turno.
        </div>
      </div>
    `;
  } else if (ehGloriaDefesaGloriosa && estadoPaladino) {
    // Glória nv15: Defesa Gloriosa — mod CAR/longo
    if (!char.recursos) char.recursos = {};
    if (!char.recursos.paladino.subclasses) char.recursos.paladino.subclasses = {};
    if (!char.recursos.paladino.subclasses.gloria) char.recursos.paladino.subclasses.gloria = {};
    const rg = char.recursos.paladino.subclasses.gloria;
    if (typeof rg.defesa_gloriosa_usos_gastos !== 'number') rg.defesa_gloriosa_usos_gastos = 0;
    const modCar = Math.max(1, calcMod(char.atributos.carisma));
    const dispDefesa = Math.max(0, modCar - rg.defesa_gloriosa_usos_gastos);
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${dispDefesa}/${modCar}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-accent" data-paladino-subclasse-acao="gloria_defesa_gloriosa" ${dispDefesa <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Defesa Gloriosa</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Reação: +CAR na CA de alvo em 3m; se falhar, contra-ataque</span>
      </div>
    `;
    recarga = 'longo';
  } else if (ehGloriaLendaViva && estadoPaladino) {
    // Glória nv20: Lenda Viva — 1x/longo
    if (!char.recursos) char.recursos = {};
    if (!char.recursos.paladino.subclasses) char.recursos.paladino.subclasses = {};
    if (!char.recursos.paladino.subclasses.gloria) char.recursos.paladino.subclasses.gloria = {};
    const usada = !!char.recursos.paladino.subclasses.gloria.lenda_viva_usada;
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${usada ? 'Usada' : 'Disponível'}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm ${usada ? 'btn-secondary' : 'btn-danger'}" data-paladino-subclasse-acao="gloria_lenda_viva" ${usada ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Ativar Lenda Viva</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Ação Bônus 10min: Vant. CAR, ataque errado vira acerto, re-roll salv.</span>
      </div>
    `;
    recarga = 'longo';
  } else if (ehVingancaVotoInimizade && estadoPaladino) {
    // Vingança nv3: Voto de Inimizade — usa Canalizar Divindade
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">CD ${estadoPaladino.canalizarDisponiveis}/${estadoPaladino.canalizarMax}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-primary" data-paladino-subclasse-acao="vinganca_voto_inimizade" ${estadoPaladino.canalizarDisponiveis <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Ativar Voto de Inimizade</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Vantagem em ataques contra 1 criatura em 9m por 1 min</span>
      </div>
    `;
    recarga = 'curto_ou_longo';
  } else if (ehVingancaVingadorImplacavel) {
    // Vingança nv7: Vingador Implacável — passiva
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--accent);font-weight:600">Passiva — Reação</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">
          Ao acertar Ataque de Oportunidade: reduz Deslocamento do alvo a 0.<br>
          Move metade do seu Deslocamento sem provocar.
        </div>
      </div>
    `;
  } else if (ehVingancaAlmaVingativa) {
    // Vingança nv15: Alma Vingativa — passiva reação
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--accent);font-weight:600">Passiva — Reação</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">
          Quando criatura sob Voto de Inimizade acerta ou erra ataque:<br>
          contra-ataque corpo a corpo como Reação.
        </div>
      </div>
    `;
  } else if (ehVingancaAnjoVingador && estadoPaladino) {
    // Vingança nv20: Anjo Vingador — 1x/longo
    if (!char.recursos) char.recursos = {};
    if (!char.recursos.paladino.subclasses) char.recursos.paladino.subclasses = {};
    if (!char.recursos.paladino.subclasses.vinganca) char.recursos.paladino.subclasses.vinganca = {};
    const usado = !!char.recursos.paladino.subclasses.vinganca.anjo_vingador_usado;
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${usado ? 'Usado' : 'Disponível'}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm ${usado ? 'btn-secondary' : 'btn-danger'}" data-paladino-subclasse-acao="vinganca_anjo_vingador" ${usado ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Ativar Anjo Vingador</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Ação Bônus 10min: Amedrontado na aura, Voo 18m</span>
      </div>
    `;
    recarga = 'longo';
  } else if (ehAncioesIraNatureza && estadoPaladino) {
    // Anciões nv3: A Ira da Natureza — usa Canalizar Divindade
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">CD ${estadoPaladino.canalizarDisponiveis}/${estadoPaladino.canalizarMax}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-primary" data-paladino-subclasse-acao="ancioes_ira_natureza" ${estadoPaladino.canalizarDisponiveis <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Ira da Natureza</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Emanação 4,5m: salv. FOR ou Contido 1 min</span>
      </div>
    `;
    recarga = 'curto_ou_longo';
  } else if (ehAncioesAuraResistencia) {
    // Anciões nv7: Aura de Resistência — passiva
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem">
        <div style="color:var(--accent);font-weight:600">Passiva — Aura</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">
          Você + aliados na Aura de Proteção: <strong>Resistência</strong> a dano Necrótico, Psíquico e Radiante.
        </div>
      </div>
    `;
  } else if (ehAncioesSentinelaImortal && estadoPaladino) {
    // Anciões nv15: Sentinela Imortal — 1x/longo
    if (!char.recursos) char.recursos = {};
    if (!char.recursos.paladino.subclasses) char.recursos.paladino.subclasses = {};
    if (!char.recursos.paladino.subclasses.ancioes) char.recursos.paladino.subclasses.ancioes = {};
    const usada = !!char.recursos.paladino.subclasses.ancioes.sentinela_imortal_usada;
    const nivel = char.nivel || 1;
    const cura = 3 * nivel;
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${usada ? 'Usada' : 'Disponível'}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm ${usada ? 'btn-secondary' : 'btn-accent'}" data-paladino-subclasse-acao="ancioes_sentinela_imortal" ${usada ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Sentinela Imortal</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Ao cair a 0 PV: fica com 1 PV + ${cura} cura</span>
      </div>
    `;
    recarga = 'longo';
  } else if (ehAncioesCampeaoAncestral && estadoPaladino) {
    // Anciões nv20: Campeão Ancestral — 1x/longo
    if (!char.recursos) char.recursos = {};
    if (!char.recursos.paladino.subclasses) char.recursos.paladino.subclasses = {};
    if (!char.recursos.paladino.subclasses.ancioes) char.recursos.paladino.subclasses.ancioes = {};
    const usado = !!char.recursos.paladino.subclasses.ancioes.campeao_ancestral_usado;
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${usado ? 'Usado' : 'Disponível'}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm ${usado ? 'btn-secondary' : 'btn-danger'}" data-paladino-subclasse-acao="ancioes_campeao_ancestral" ${usado ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Ativar Campeão Ancestral</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Ação Bônus 1min: Desv. salv. inimigos, magias como Bônus, +10 PV/turno</span>
      </div>
    `;
    recarga = 'longo';
  } else if (ehArtesMarciais && estadoMonge) {
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">d${estadoMonge.dadoArtesMarciais}</span>`;
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem;color:var(--text-muted)">
        Dado de dano: d${estadoMonge.dadoArtesMarciais} | Ataque Desarmado como Ação Bônus | Usar Destreza para ataque/dano
      </div>
    `;
  } else if (ehPontosFoco && estadoMonge && estadoMonge.pontosMax > 0) {
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoMonge.pontosAtuais}/${estadoMonge.pontosMax}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-accent" data-monge-acao="gastar-ponto" ${estadoMonge.pontosAtuais <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Gastar Ponto</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">CD ${estadoMonge.cdFoco} | Recupera todos no Descanso Curto</span>
      </div>
    `;
    recarga = 'curto_ou_longo';
  } else if (ehDesviarAtaques && estadoMonge && estadoMonge.desviarAtivo) {
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">Reduz ${estadoMonge.desviarReducao}</span>`;
  } else if (ehGolpeAtordoante && estadoMonge && estadoMonge.golpeAtordoanteAtivo) {
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">CD ${estadoMonge.cdFoco}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-primary" data-monge-acao="golpe-atordoante" ${estadoMonge.pontosAtuais <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Golpe Atordoante (1 PF)</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Salvaguarda Constituição CD ${estadoMonge.cdFoco}</span>
      </div>
    `;
  } else if (ehEspalmadaIntegridade && estadoMongeSub && estadoMongeSub.integridadeAtiva) {
    const disp = estadoMongeSub.integridadeDisponiveis;
    const max = estadoMongeSub.integridadeMax;
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${disp} / ${max}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm ${disp <= 0 ? 'btn-secondary' : 'btn-accent'}" data-monge-subclasse-acao="integridade_usar" ${disp <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Integridade Corporal</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Cura: 1d${estadoMongeSub.dadoArtesMarciais} + SAB | Ação Bônus | ${disp}/${max} usos | Descanso Longo</span>
      </div>
    `;
  } else if (ehEspalmadaPalma && estadoMongeSub && estadoMongeSub.palmaVibranteNivel) {
    const ativa = estadoMongeSub.palmaVibranteAtiva;
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${ativa ? 'Vibrações Ativas' : 'Inativa'}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        ${!ativa ? `<button class="btn btn-sm btn-accent" data-monge-subclasse-acao="palma_ativar" ${estadoMongeSub.pontosAtuais < 4 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Ativar Palma Vibrante (4 PF)</button>` : ''}
        ${ativa ? '<button class="btn btn-sm btn-danger" data-monge-subclasse-acao="palma_encerrar">Encerrar Vibrações (10d12 Energético)</button>' : ''}
        ${ativa ? '<button class="btn btn-sm btn-secondary" data-monge-subclasse-acao="palma_cancelar">Cancelar Inofensivamente</button>' : ''}
        <span style="font-size:0.75rem;color:var(--text-muted)">Salvaguarda Constituição CD ${estadoMongeSub.cdFoco} | 1 alvo por vez</span>
      </div>
    `;
  } else if (ehMisericordiaTorrente && estadoMongeSub && estadoMongeSub.torrenteAtiva) {
    const disp = estadoMongeSub.torrenteDisponiveis;
    const max = estadoMongeSub.torrenteMax;
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${disp} / ${max}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm ${disp <= 0 ? 'btn-secondary' : 'btn-accent'}" data-monge-subclasse-acao="torrente_usar" ${disp <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Torrente de Cura e Dolo</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Cura/Dolo grátis na Torrente | ${disp}/${max} usos | Descanso Longo</span>
      </div>
    `;
  } else if (ehMisericordiaFinal && estadoMongeSub && estadoMongeSub.misericordiaFinalAtiva) {
    const usado = estadoMongeSub.misericordiaFinalUsada;
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${usado ? 'Usada' : 'Disponível'}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm ${usado ? 'btn-secondary' : 'btn-accent'}" data-monge-subclasse-acao="misericordia_final" ${usado || estadoMongeSub.pontosAtuais < 5 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Mão da Misericórdia Final (5 PF)</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Reviver criatura | 4d10+SAB PV | 1x/Descanso Longo</span>
      </div>
    `;
  } else if (ehElementosSintonia && estadoMongeSub) {
    const ativa = estadoMongeSub.sintoniaAtiva;
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${ativa ? 'Ativa' : 'Inativa'}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm ${ativa ? 'btn-warning' : 'btn-accent'}" data-monge-subclasse-acao="sintonia_toggle">${ativa ? 'Desativar Sintonia' : 'Ativar Sintonia (1 PF)'}</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">10 min | Ataques Elementais + Extensão 3m${(char.nivel || 1) >= 11 ? ' | Natação + Voo' : ''}</span>
      </div>
    `;
  } else if (ehAtaqueFurtivo && estadoLadino) {
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoLadino.furtivoTexto}</span>`;
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem;color:var(--text-muted)">
        Dano extra: ${estadoLadino.furtivoTexto} | 1x/turno com Vantagem ou aliado adjacente ao alvo
        ${estadoLadino.golpeAstutoAtivo ? `<br>Golpe Astuto (CD ${estadoLadino.cdGolpeAstuto}): Envenenar/Retirada/Tropeço (removem dados do Furtivo)` : ''}
        ${estadoLadino.golpeAprimoradoAtivo ? '<br>Golpe Astuto Aprimorado: 2 efeitos simultâneos' : ''}
        ${estadoLadino.golpesSujosAtivo ? '<br>Golpes Sujos: Aturdir (2d6) / Nocaute (6d6) / Obscurecer (3d6)' : ''}
      </div>
    `;
  } else if (ehGolpeSorte && estadoLadino && estadoLadino.golpeSorteAtivo) {
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoLadino.golpeSorteUsado ? 'Usado' : 'Disponível'}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-accent" data-ladino-acao="golpe-sorte" ${estadoLadino.golpeSorteUsado ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Golpe de Sorte</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Falha vira 20 | 1x por Descanso Curto/Longo</span>
      </div>
    `;
    recarga = 'curto_ou_longo';
  } else if (ehRecuperacaoArcana && estadoMago) {
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${estadoMago.recuperacaoArcanaUsada ? 'Usada' : 'Disponível'}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-accent" data-mago-acao="recuperacao-arcana" ${estadoMago.recuperacaoArcanaUsada ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Recuperação Arcana</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Até ${estadoMago.recuperacaoArcanaMax}º combinado | Máx 5º círculo | Descanso Curto</span>
      </div>
    `;
    recarga = 'longo';
  } else if (ehAssinaturaMagica && estadoMago && estadoMago.assinaturaMagicaAtiva) {
    const disp1 = estadoMago.assinatura1Usada ? 'Usada' : 'Pronta';
    const disp2 = estadoMago.assinatura2Usada ? 'Usada' : 'Pronta';
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${disp1} / ${disp2}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-primary" data-mago-acao="assinatura-1" ${estadoMago.assinatura1Usada ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Assinatura 1</button>
        <button class="btn btn-sm btn-primary" data-mago-acao="assinatura-2" ${estadoMago.assinatura2Usada ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Assinatura 2</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">3º círculo sem espaço | Curto/Longo</span>
      </div>
    `;
    recarga = 'curto_ou_longo';
  } else if (ehAbjuradorProtecao && estadoMagoSub) {
    const pv = estadoMagoSub.protecaoPvAtual;
    const pvMax = estadoMagoSub.protecaoPvMax;
    const criada = estadoMagoSub.protecaoCriada;
    const pctPv = pvMax > 0 ? Math.round((pv / pvMax) * 100) : 0;
    usosHtmlSummary = criada ? `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${pv} / ${pvMax} PV</span>` : `<span style="font-size:0.7rem;font-weight:600;margin-left:auto;color:var(--text-muted)">Não Criada</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;flex-direction:column;gap:6px;padding:4px 0 4px 16px">
        ${criada ? `
          <div style="display:flex;align-items:center;gap:8px">
            <div style="flex:1;background:var(--bg-tertiary);border-radius:4px;height:14px;overflow:hidden">
              <div style="width:${pctPv}%;height:100%;background:${pv > pvMax/2 ? 'var(--accent)' : pv > 0 ? '#e67e22' : '#e74c3c'};transition:width 0.3s"></div>
            </div>
            <span style="font-size:0.75rem;font-weight:600;min-width:60px">${pv} / ${pvMax}</span>
          </div>
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            <button class="btn btn-sm btn-danger" data-mago-subclasse-acao="protecao_dano">Sofrer Dano</button>
            <button class="btn btn-sm btn-accent" data-mago-subclasse-acao="protecao_restaurar">Restaurar PV (Abjuração/Slot)</button>
          </div>
        ` : `
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            <button class="btn btn-sm btn-accent" data-mago-subclasse-acao="protecao_criar">Criar Proteção (${pvMax} PV)</button>
            <span style="font-size:0.75rem;color:var(--text-muted)">Conjure Abjuração com slot | 1x/Descanso Longo</span>
          </div>
        `}
      </div>
    `;
  } else if (ehAdivinhadorProdigio && estadoMagoSub) {
    const n = estadoMagoSub.numDadosProdigio;
    const dados = [
      { valor: estadoMagoSub.prodigioDado1, usado: estadoMagoSub.prodigioDado1Usado },
      { valor: estadoMagoSub.prodigioDado2, usado: estadoMagoSub.prodigioDado2Usado }
    ];
    if (n >= 3) dados.push({ valor: estadoMagoSub.prodigioDado3, usado: estadoMagoSub.prodigioDado3Usado });
    const todosRolados = dados.every(d => d.valor > 0);
    const disponiveis = dados.filter(d => d.valor > 0 && !d.usado).length;
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${disponiveis} / ${n} disponíveis</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;flex-direction:column;gap:6px;padding:4px 0 4px 16px">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          ${dados.map((d, i) => `
            <div style="display:flex;align-items:center;gap:4px;padding:4px 8px;background:var(--bg-tertiary);border-radius:var(--radius);border:1px solid ${d.usado ? 'var(--border)' : 'var(--accent)'}">
              <span style="font-size:1.1rem;font-weight:700;color:${d.usado ? 'var(--text-muted)' : 'var(--accent)'}${d.valor === 0 ? ';opacity:0.4' : ''}">${d.valor || '?'}</span>
              ${d.valor > 0 && !d.usado ? '<button class="btn btn-sm btn-accent" data-mago-subclasse-acao="prodigio_usar_' + (i+1) + '" style="padding:2px 6px;font-size:0.7rem">Usar</button>' : ''}
              ${d.usado ? '<span style="font-size:0.65rem;color:var(--text-muted)">usado</span>' : ''}
            </div>
          `).join('')}
        </div>
        ${!todosRolados ? '<button class="btn btn-sm btn-primary" data-mago-subclasse-acao="prodigio_rolar">Rolar Dados de Prodígio</button>' : ''}
        <span style="font-size:0.75rem;color:var(--text-muted)">${n}d20 | Substitui Teste de D20 | Descanso Longo</span>
      </div>
    `;
  } else if (ehAdivinhadorTerceiroOlho && estadoMagoSub && estadoMagoSub.terceiroOlhoAtivo) {
    const usado = estadoMagoSub.terceiroOlhoUsado;
    const escolha = estadoMagoSub.terceiroOlhoEscolha;
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${usado ? (escolha || 'Usado') : 'Disponível'}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <select data-mago-subclasse-acao="terceiro_olho_escolha" style="padding:4px 8px;border-radius:var(--radius);border:1px solid var(--border);background:var(--bg-secondary);color:var(--text-primary);font-size:0.8rem">
          <option value="">Escolher...</option>
          <option value="Compreensão Superior" ${escolha === 'Compreensão Superior' ? 'selected' : ''}>Compreensão Superior</option>
          <option value="Ver o Invisível" ${escolha === 'Ver o Invisível' ? 'selected' : ''}>Ver o Invisível</option>
          <option value="Visão no Escuro" ${escolha === 'Visão no Escuro' ? 'selected' : ''}>Visão no Escuro</option>
        </select>
        <button class="btn btn-sm ${usado ? 'btn-secondary' : 'btn-accent'}" data-mago-subclasse-acao="terceiro_olho_usar" ${usado ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Ativar</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Ação Bônus | Descanso Curto/Longo</span>
      </div>
    `;
    recarga = 'curto_ou_longo';
  } else if (ehEvocadorSobrecarga && estadoMagoSub && estadoMagoSub.sobrecargaAtiva) {
    const usos = estadoMagoSub.sobrecargaUsos;
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${usos}x usada</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-accent" data-mago-subclasse-acao="sobrecarga_usar">Usar Sobrecarga</button>
        <span style="font-size:0.75rem;color:${usos > 0 ? '#e74c3c' : 'var(--text-muted)'};font-weight:${usos > 0 ? '600' : '400'}">
          ${usos === 0 ? '1ª vez: sem dano' : 'Próximo uso: ' + (usos + 1) + 'd12 x círculo (Necrótico)'}
        </span>
      </div>
    `;
  } else if (ehIlusionistaEspectrais && estadoMagoSub && estadoMagoSub.criaturasEspectraisAtiva) {
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${!estadoMagoSub.feericaUsada || !estadoMagoSub.feraUsada ? 'Disponível' : 'Usadas'}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm ${estadoMagoSub.feericaUsada ? 'btn-secondary' : 'btn-accent'}" data-mago-subclasse-acao="espectrais_feerica" ${estadoMagoSub.feericaUsada ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Convocar Feérico (Grátis)</button>
        <button class="btn btn-sm ${estadoMagoSub.feraUsada ? 'btn-secondary' : 'btn-accent'}" data-mago-subclasse-acao="espectrais_fera" ${estadoMagoSub.feraUsada ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Invocar Fera (Grátis)</button>
        <span style="font-size:0.75rem;color:var(--text-muted)">PV pela metade | Descanso Longo</span>
      </div>
    `;
  } else if (ehIlusionistaAutoimagem && estadoMagoSub && estadoMagoSub.autoimagemAtiva) {
    const usado = estadoMagoSub.autoimagemUsada;
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${usado ? 'Usada' : 'Disponível'}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:6px;padding:4px 0 4px 16px;flex-wrap:wrap">
        <button class="btn btn-sm ${usado ? 'btn-secondary' : 'btn-accent'}" data-mago-subclasse-acao="autoimagem_usar" ${usado ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Usar Autoimagem</button>
        ${usado ? '<button class="btn btn-sm btn-warning" data-mago-subclasse-acao="autoimagem_restaurar">Restaurar (gastar slot 2+)</button>' : ''}
        <span style="font-size:0.75rem;color:var(--text-muted)">Reação | Descanso Curto/Longo | Slot 2+</span>
      </div>
    `;
    recarga = 'curto_ou_longo';
  } else if (f.nome === 'Estilo de Luta') {
    // Exibir o estilo de luta escolhido com seu efeito
    const estiloEscolhido = char.escolhas_classe?.estilo_luta?.[0] || '';
    if (estiloEscolhido) {
      const efeitosEstilo = {
        'Arquearia': '+2 nas jogadas de ataque com armas à distância',
        'Defesa Cega': 'Sentido cego de 3m (exige proficiência)',
        'Defensivo': '+1 de CA ao usar armadura',
        'Duelismo': '+2 de dano com arma de uma mão (sem outra arma)',
        'Armas Grandes': 're-rolar 1 ou 2 no dano de armas de duas mãos',
        'Intercessão': '-1d10+prof do dano em aliado adjacente (reação)',
        'Arremesso': 'saca e arremessa com +2 de dano',
        'Combate sem Arma': '1d6+FOR de dano desarmado',
        'Combate com Duas Armas': '+mod de atributo no dano da arma secundária',
        'Combatente Druídico': '2 truques de Druida (Sabedoria)',
        'Combatente Abençoado': '2 truques de Clérigo (Carisma)'
      };
      const efeito = efeitosEstilo[estiloEscolhido] || '';
      usosHtmlBody = `
        <div style="display:flex;align-items:center;gap:8px;padding:4px 0 4px 16px;flex-wrap:wrap">
          <span class="badge badge-accent" style="font-size:0.8rem">${estiloEscolhido}</span>
          ${efeito ? `<span style="font-size:0.75rem;color:var(--text-muted)">${efeito}</span>` : ''}
        </div>
      `;
    }
  } else if (f.nome === 'Ordem Divina' || f.nome === 'Ordem Primal') {
    // Exibir somente a opcao escolhida (Protetor/Taumaturgo/Xama)
    const _chaveOrdem = f.nome === 'Ordem Divina' ? 'ordem_divina' : 'ordem_primal';
    const _ordemEscolhida = char[_chaveOrdem] || char.escolhas_classe?.[_chaveOrdem]?.[0] || '';
    if (_ordemEscolhida) {
      const _regexOpcao = new RegExp(`\\*\\*${_ordemEscolhida}\\.\\*\\*\\s*(.+?)(?=\\n\\*\\*|$)`, 's');
      const _matchOpcao = f.descricao.match(_regexOpcao);
      const _descOpcao = _matchOpcao ? _matchOpcao[1].trim() : '';
      usosHtmlBody = `
        <div style="display:flex;align-items:center;gap:8px;padding:4px 0 4px 16px;flex-wrap:wrap">
          <span class="badge badge-accent" style="font-size:0.8rem">${_ordemEscolhida}</span>
          <span style="font-size:0.8rem">${_descOpcao}</span>
        </div>
      `;
    }
  }

  if (!usosHtmlBody && temMultiplosUsos) {
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${usosMax - usosAtual}/${usosMax}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:4px;padding:4px 0 4px 16px">
        <button class="btn btn-sm" style="padding:2px 8px;font-size:0.7rem" data-usar-habilidade="${key}" data-usos-max="${usosMax}">
          ${usosAtual >= usosMax ? '✗ Esgotado' : 'Usar'}
        </button>
      </div>
    `;
  } else if (!usosHtmlBody && ativa && recarga) {
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
      ${(f.nome === 'Ordem Divina' || f.nome === 'Ordem Primal') && (char.ordem_divina || char.ordem_primal || char.escolhas_classe?.ordem_divina?.length || char.escolhas_classe?.ordem_primal?.length)
        ? '' : `<div class="md-content" style="padding:6px 0 6px 16px;font-size:0.85rem">${mdParaHtml(f.descricao)}</div>`}
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

    // Evita duplicidade com seção de subclasse ativa
    if (char.subclasse) {
      const scAtual = classeData.subclasses.find(s => s.nome === char.subclasse);
      const featsSC = new Set((scAtual?.caracteristicas || []).filter(c => c.nivel <= char.nivel).map(c => `${c.nivel}|${c.nome}`));
      feats = feats.filter(f => !featsSC.has(`${f.nivel}|${f.nome}`));
    }
  }

  const passivas = feats.filter(f => !ehHabilidadeAtiva(f.descricao, f.nome));
  const ativas = feats.filter(f => ehHabilidadeAtiva(f.descricao, f.nome));

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

  const passivas = feats.filter(f => !ehHabilidadeAtiva(f.descricao, f.nome));
  const ativas = feats.filter(f => ehHabilidadeAtiva(f.descricao, f.nome));

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

// Descrições mecânicas dos sub-traços de espécies com opcoes
const SUBTRACOS_ESPECIE = {
  'Tiferino': {
    'Abissal': {
      descBase: 'Você tem Resistência a dano Venenoso. Você também conhece o truque *Rajada de Veneno*.',
      magias: { 3: 'Raio Nauseante', 5: 'Paralisar Pessoa' }
    },
    'Ctônico': {
      descBase: 'Você tem Resistência a dano Necrótico. Você também conhece o truque *Toque Necrótico*.',
      magias: { 3: 'Vitalidade Vazia', 5: 'Raio do Enfraquecimento' }
    },
    'Infernal': {
      descBase: 'Você tem Resistência a dano Ígneo. Você também conhece o truque *Raio de Fogo*.',
      magias: { 3: 'Repreensão Diabólica', 5: 'Escuridão' }
    }
  },
  'Elfo': {
    'Alto Elfo': {
      descBase: 'Você conhece o truque *Prestidigitação Arcana*. Sempre que completar um Descanso Longo, você pode substituir este truque por um truque diferente da lista de magias de Mago.',
      magias: { 3: 'Detectar Magia', 5: 'Passo Nebuloso' }
    },
    'Drow': {
      descBase: 'O alcance da sua Visão no Escuro aumenta para 36 metros. Você também conhece o truque *Luzes Dançantes*.',
      magias: { 3: 'Fogo das Fadas', 5: 'Escuridão' }
    },
    'Elfo Silvestre': {
      descBase: 'Seu Deslocamento aumenta para 10,5 metros. Você também conhece o truque *Arte Druídica*.',
      magias: { 3: 'Passos Largos', 5: 'Passos Sem Rastro' }
    }
  },
  'Draconato': {
    'Azul': { descBase: 'Ancestral: Dragão Azul. Tipo de dano: Elétrico.' },
    'Branco': { descBase: 'Ancestral: Dragão Branco. Tipo de dano: Gélido.' },
    'Bronze': { descBase: 'Ancestral: Dragão Bronze. Tipo de dano: Elétrico.' },
    'Cobre': { descBase: 'Ancestral: Dragão Cobre. Tipo de dano: Ácido.' },
    'Latão': { descBase: 'Ancestral: Dragão Latão. Tipo de dano: Ígneo.' },
    'Negro': { descBase: 'Ancestral: Dragão Negro. Tipo de dano: Ácido.' },
    'Ouro': { descBase: 'Ancestral: Dragão Ouro. Tipo de dano: Ígneo.' },
    'Prata': { descBase: 'Ancestral: Dragão Prata. Tipo de dano: Gélido.' },
    'Verde': { descBase: 'Ancestral: Dragão Verde. Tipo de dano: Venenoso.' },
    'Vermelho': { descBase: 'Ancestral: Dragão Vermelho. Tipo de dano: Ígneo.' }
  }
};

// Títulos dos traços-pai para exibição do sub-traço
const TITULO_TRACO_PAI = {
  'Tiferino': 'Legado Ínfero',
  'Elfo': 'Linhagem Élfica',
  'Draconato': 'Herança Dracônica'
};

/**
 * Gera um traço sintético para espécies com opcoes (sem sub-traço no JSON).
 * Monta a descrição com base no nível do personagem.
 */
function gerarTracoSinteticoEspecie(especie, tracosEscolhidos, nivel) {
  const mapa = SUBTRACOS_ESPECIE[especie];
  if (!mapa) return null;
  const escolha = tracosEscolhidos[0];
  if (!escolha || !mapa[escolha]) return null;

  const info = mapa[escolha];
  const tituloPai = TITULO_TRACO_PAI[especie] || '';
  let desc = info.descBase;

  // Adicionar magias desbloqueadas por nível
  if (info.magias) {
    const magiasDesbloqueadas = [];
    for (const [nv, nomeMagia] of Object.entries(info.magias)) {
      if (nivel >= parseInt(nv)) {
        magiasDesbloqueadas.push(`*${nomeMagia}* (nível ${nv})`);
      }
    }
    if (magiasDesbloqueadas.length > 0) {
      desc += `\n\nMagias sempre preparadas: ${magiasDesbloqueadas.join(', ')}. Essas magias podem ser conjuradas uma vez sem gastar um espaço de magia, restaurando ao completar um Descanso Longo.`;
    }
  }

  return {
    nome: `${tituloPai} — ${escolha}`,
    descricao: desc
  };
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

    // Adicionar traço sintético para espécies com opcoes (sem sub-traço no JSON)
    const tracoSintetico = gerarTracoSinteticoEspecie(char.especie, tracosEscolhidos, char.nivel);
    if (tracoSintetico) {
      tracosMostrar.push(tracoSintetico);
    }
  }

  // Filtrar traços por requisito de nível (ex: "A partir do nível 5", "No nível 3")
  tracosMostrar = tracosMostrar.filter(t => {
    // Campo explícito de nível mínimo (sub-traços que dependem de um traço pai)
    if (typeof t.nivel_minimo === 'number' && char.nivel < t.nivel_minimo) return false;
    const match = t.descricao?.match(/(?:a partir do |no )n[ií]vel (\d+)/i);
    if (match) return char.nivel >= parseInt(match[1]);
    return true;
  });

  if (!tracosMostrar.length) return '';

  // Traços que herdam recarga do pai "Ancestralidade Gigante" (bônus prof, descanso longo)
  const TRACOS_HERDAM_ANCESTRALIDADE = ['Arrepio do Gelo (Gigante do Gelo)', 'Queimadura de Fogo (Gigante de Fogo)', 'Resistência da Pedra (Gigante da Pedra)', 'Salto da Nuvem (Gigante das Nuvens)', 'Tombo da Colina (Gigante da Colina)', 'Trovão da Tempestade (Gigante da Tempestade)'];

  // Sub-traços da Revelação Celestial (Aasimar) — ativas, mas uso controlado pelo pai
  const TRACOS_REVELACAO_CELESTIAL = ['Asas Celestiais', 'Manto Necrótico', 'Transfiguração Radiante'];

  // Determinar ativa/passiva considerando traços herdados
  const ehAtivo = (t) => {
    if (TRACOS_HERDAM_ANCESTRALIDADE.includes(t.nome)) return true;
    if (TRACOS_REVELACAO_CELESTIAL.includes(t.nome)) return true;
    return ehHabilidadeAtiva(t.descricao);
  };

  const passivos = tracosMostrar.filter(t => !ehAtivo(t));
  const ativos = tracosMostrar.filter(t => ehAtivo(t));

  return `
    <div class="card print-break-before">
      <div class="card-header"><h2>Traços de Espécie — ${char.especie}</h2></div>
      ${ativos.length > 0 ? `
        <div class="section-divider"><span>Habilidades Ativas</span></div>
        ${ativos.map(t => renderTracoEspecie(t, TRACOS_HERDAM_ANCESTRALIDADE.includes(t.nome), TRACOS_REVELACAO_CELESTIAL.includes(t.nome))).join('')}
      ` : ''}
      ${passivos.length > 0 ? `
        <div class="section-divider"><span>Habilidades Passivas</span></div>
        ${passivos.map(t => renderTracoEspecie(t, false)).join('')}
      ` : ''}
    </div>
  `;
}

function renderTracoEspecie(traco, herdaAncestralidade = false, ehSubRevelacao = false) {
  let recarga = detectarRecarga(traco.descricao);
  let ativa = ehHabilidadeAtiva(traco.descricao);

  // Traits inheriting from "Ancestralidade Gigante": prof bonus uses, long rest
  if (herdaAncestralidade && !recarga) {
    recarga = 'longo';
    ativa = true;
  }

  // Sub-traços da Revelação Celestial: ativos mas sem controle de uso próprio
  if (ehSubRevelacao) {
    ativa = true;
  }

  const key = `especie_${traco.nome}`;
  if (!char.usos_habilidades) char.usos_habilidades = {};

  // Deteccao de traits especificas de especie para UI customizada
  const ehSortePequenino = char.especie === 'Pequenino' && traco.nome === 'Sorte';
  const ehVigorImplacavel = char.especie === 'Orc' && traco.nome === 'Vigor Implacável';
  const ehAtaqueSopro = char.especie === 'Draconato' && traco.nome === 'Ataque de Sopro';
  const ehMaosCurativas = char.especie === 'Aasimar' && traco.nome === 'Mãos Curativas';

  let usosMax = detectarUsosMaximos(traco.descricao) || (recarga ? bonusProficiencia(char.nivel) : null);

  // Correcao de usos para traits que sao 1x/descanso (sem numero explicito na descricao)
  if (ehVigorImplacavel) usosMax = 1;
  if (ehMaosCurativas) usosMax = 1;

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

  // --- Bodies customizados para traits de especie ---

  if (ehSortePequenino) {
    // Sorte: passiva, sem uso a rastrear - apenas destaque visual
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem;color:var(--accent);font-weight:600">
        Automatica: ao tirar 1 natural em qualquer d20, re-jogue e use o novo resultado.
      </div>
    `;
  } else if (ehAtaqueSopro) {
    // Ataque de Sopro: multi-uso (prof bonus), custom body com dano e CD
    const nivel = char.nivel || 1;
    const dadosSopro = nivel >= 17 ? '4d10' : nivel >= 11 ? '3d10' : nivel >= 5 ? '2d10' : '1d10';
    const herancaMap = {
      'Azul': 'Eletrico', 'Branco': 'Gelido', 'Bronze': 'Eletrico',
      'Cobre': 'Acido', 'Latao': 'Igneo', 'Negro': 'Acido',
      'Ouro': 'Igneo', 'Prata': 'Gelido', 'Verde': 'Venenoso', 'Vermelho': 'Igneo'
    };
    const dragao = (char.tracos_escolhidos || [])[0] || '';
    const tipoDano = herancaMap[dragao] || '???';
    const cdSopro = 8 + calcMod(char.atributos?.constituicao || 10) + bonusProficiencia(nivel);
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${usosMax - usosAtual}/${usosMax}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="padding:4px 0 4px 16px;display:flex;flex-direction:column;gap:4px">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <button class="btn btn-sm" style="padding:2px 8px;font-size:0.7rem" data-usar-habilidade="${key}" data-usos-max="${usosMax}">
            ${usosAtual >= usosMax ? '✗ Esgotado' : 'Usar Sopro'}
          </button>
          <span style="font-size:0.75rem;font-weight:600;color:var(--accent)">${dadosSopro} ${tipoDano}</span>
          <span style="font-size:0.75rem;color:var(--text-muted)">CD ${cdSopro} (Salv. DES)</span>
        </div>
        <span style="font-size:0.7rem;color:var(--text-muted)">Cone 4,5m ou Linha 9m x 1,5m</span>
      </div>
    `;
  } else if (ehMaosCurativas) {
    // Maos Curativas: 1x/descanso longo, cura PB d4s
    const pb = bonusProficiencia(char.nivel || 1);
    usosHtmlBody = `
      <div class="no-print" style="padding:4px 0 4px 16px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <button class="btn btn-sm" style="padding:2px 8px;font-size:0.7rem;${usado ? 'opacity:0.5' : ''}" data-maos-curativas="1">
          ${usado ? '✗ Usado' : 'Curar (' + pb + 'd4)'}
        </button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Toque | Acao Usar Magia | ${pb}d4 PV</span>
      </div>
    `;
  } else if (ehVigorImplacavel) {
    // Vigor Implacavel: 1x/descanso longo
    usosHtmlBody = `
      <div class="no-print" style="padding:4px 0 4px 16px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <button class="btn btn-sm" style="padding:2px 8px;font-size:0.7rem;${usado ? 'opacity:0.5' : ''}" data-toggle-uso="${key}">
          ${usado ? '✗ Usado' : '✓ Disponivel'}
        </button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Ao cair a 0 PV: fica com 1 PV.</span>
      </div>
    `;
  } else if (temMultiplosUsos) {
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

  // Informacoes de escolhas vinculadas ao traco
  let infoEscolhaTraco = '';
  if ((traco.nome === 'Hábil' || traco.nome === 'Sentidos Aguçados') && char.pericia_especie) {
    infoEscolhaTraco = `<div class="info-box info" style="font-size:0.8rem;margin-top:6px"><strong>Pericia escolhida:</strong> ${char.pericia_especie}</div>`;
  }
  if (traco.nome === 'Versátil' && char.talento_versatil) {
    // Mostrar o talento escolhido e, se houver escolhas associadas (ex: Habilidoso), tambem
    let detalheVersatil = `<strong>Talento escolhido:</strong> ${char.talento_versatil}`;
    const escolhasVersatil = char.escolhas_talento?.versatil;
    if (escolhasVersatil?.length > 0) {
      detalheVersatil += `<br><strong>Proficiencias:</strong> ${escolhasVersatil.join(', ')}`;
    }
    infoEscolhaTraco = `<div class="info-box info" style="font-size:0.8rem;margin-top:6px">${detalheVersatil}</div>`;
  }

  return `
    <details style="margin-bottom:6px">
      <summary style="font-weight:600;cursor:pointer;font-size:0.9rem;display:flex;align-items:center;flex-wrap:wrap;gap:2px">
        ${traco.nome}
        ${ehSortePequenino ? '<span class="badge" style="font-size:0.65rem;margin-left:4px;background:var(--success);color:#fff">Re-roll nat 1</span>' : tipoBadge}
        ${recargaBadge}
        ${usosHtmlSummary}
      </summary>
      ${usosHtmlBody}
      <div class="md-content" style="padding:6px 0 6px 16px;font-size:0.85rem">${mdParaHtml(traco.descricao)}</div>
      ${infoEscolhaTraco}
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

async function obterMagiasDisponiveisClasseAtual() {
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
function badgesMagiaRapidos(nomeMagia) {
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

// Renderiza a secao de Dadivas do Pacto dentro da area de magias (somente Bruxo)
function renderSecaoPactoBruxo() {
  if (char?.classe !== 'Bruxo') return '';
  const estado = getEstadoRecursosBruxo();
  if (!estado) return '';
  const pacto = estado.pacto;
  if (!pacto) return '';

  let html = '<details open style="margin-bottom:8px;border-left:3px solid var(--secondary);padding-left:8px">';
  html += '<summary style="font-weight:700;cursor:pointer;padding:6px 0;border-bottom:1px solid var(--border-light);color:var(--secondary)">';
  html += `Dadivas do Pacto - ${pacto}`;
  html += '</summary><div style="padding-top:6px">';

  if (pacto === 'Pacto da Corrente') {
    html += `
      <div class="magia-item magia-dominio" style="border-left:3px solid var(--secondary)">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <div class="magia-nome"><span class="badge-dominio">&#9733;</span> Convocar Familiar</div>
            <div style="font-size:0.7rem;color:var(--text-muted)">Conjuracao | Acao | 1 hora | 9 metros</div>
            <div style="font-size:0.65rem;color:var(--secondary);font-weight:600;margin-top:1px">Pacto da Corrente (sem gastar espaco de magia)</div>
          </div>
          <button class="btn btn-sm btn-primary" data-conjurar-pacto="Convocar Familiar">Conjurar</button>
        </div>
        <div style="font-size:0.72rem;color:var(--text-muted);margin-top:4px">
          Formas especiais: Cobra Peconhenta, Diabrete, Esfinge Maravilhosa, Esqueleto, Pseudodragao, Quasit, Slaad Girino, Sprite.
          <br>Ao executar acao Atacar, voce pode renunciar um ataque para que o familiar ataque como Reacao.
        </div>
      </div>`;
  }

  if (pacto === 'Pacto da Lâmina') {
    html += `
      <div class="magia-item magia-dominio" style="border-left:3px solid var(--secondary)">
        <div>
          <div class="magia-nome"><span class="badge-dominio">&#9733;</span> Arma de Pacto</div>
          <div style="font-size:0.65rem;color:var(--secondary);font-weight:600;margin-top:1px">Pacto da Lamina</div>
        </div>
        <div style="font-size:0.72rem;color:var(--text-muted);margin-top:4px">
          <strong>Acao Bonus:</strong> Conjurar arma Corpo a Corpo (Simples ou Marcial) ou vincular-se a uma arma magica.
          <br>Usa modificador de Carisma para ataque e dano (em vez de Forca/Destreza).
          <br>Pode causar dano Necrotico, Psiquico ou Radiante (ou o tipo normal).
          <br>Pode usar a arma como Foco de Conjuracao.
        </div>
      </div>`;
  }

  if (pacto === 'Pacto do Tomo') {
    const tomoData = estado.pactoTomo || { truques: [], rituais: [] };
    // Circulo do slot de pacto do Bruxo (o unico circulo onde ele tem espacos)
    const circuloPacto = Object.keys(char.espacos_magia || {}).sort((a, b) => Number(b) - Number(a))[0] || '1';
    const slotPacto = char.espacos_magia?.[circuloPacto];
    const slotEsgotado = slotPacto ? slotPacto.usados >= slotPacto.total : true;
    // Detectar conflitos: magias do Tomo que o personagem ja possui por outros meios
    const truquesConhecidos = new Set((char.magias_conhecidas || []).filter(m => m.circulo === 0).map(m => m.nome));
    const magiasPreparadas = new Set((char.magias_preparadas || []).map(m => m.nome));
    const truquesConflito = tomoData.truques.filter(t => truquesConhecidos.has(t.nome));
    const rituaisConflito = tomoData.rituais.filter(r => magiasPreparadas.has(r.nome));
    const temConflito = truquesConflito.length > 0 || rituaisConflito.length > 0;

    html += `
      <div class="magia-item magia-dominio" style="border-left:3px solid var(--secondary)">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <div class="magia-nome"><span class="badge-dominio">&#9733;</span> Livro das Sombras</div>
            <div style="font-size:0.65rem;color:var(--secondary);font-weight:600;margin-top:1px">Pacto do Tomo</div>
          </div>
          <button class="btn btn-sm btn-secondary no-print" data-pacto-tomo-gerenciar="1">Gerenciar</button>
        </div>
        <div style="font-size:0.72rem;color:var(--text-muted);margin-top:4px">
          3 truques de qualquer classe + 2 magias de 1o circulo com marcador Ritual (de qualquer classe).
          <br>Funciona como Foco de Conjuracao. Reaparece ao final de Descanso Curto ou Longo.
        </div>
        ${temConflito ? `
          <div class="info-box warning" style="font-size:0.65rem;margin-top:6px;padding:4px 8px">
            Conflito: as magias do Livro devem ser magias que voce ainda nao tem preparadas.
            Abra "Gerenciar" para substituir: ${[...truquesConflito.map(t => t.nome), ...rituaisConflito.map(r => r.nome)].join(', ')}.
          </div>
        ` : ''}
        ${tomoData.truques.length > 0 ? `
          <div style="margin-top:6px">
            <div style="font-size:0.7rem;font-weight:700;color:var(--secondary)">Truques do Livro das Sombras:</div>
            ${tomoData.truques.map(t => {
              const conflito = truquesConhecidos.has(t.nome);
              return `
              <div class="magia-item ${conflito ? '' : ''}" data-magia-nome="${t.nome}" data-magia-circ="0" style="margin:2px 0;padding:4px 8px;border-left:2px solid ${conflito ? 'var(--danger)' : 'var(--accent)'};cursor:pointer">
                <div style="display:flex;justify-content:space-between;align-items:center">
                  <div>
                    <div class="magia-nome" style="font-size:0.8rem">${t.nome} <span style="font-size:0.6rem;color:var(--text-muted)">(${t.classe || '?'})</span>${conflito ? ' <span style="font-size:0.6rem;color:var(--danger);font-weight:700">Duplicado</span>' : ''}</div>
                    ${t.nome ? badgesMagiaRapidos(t.nome) : ''}
                  </div>
                  <button class="btn btn-sm btn-primary no-print" data-conjurar-pacto="${t.nome}" style="font-size:0.7rem;flex-shrink:0">Conjurar</button>
                </div>
                <div class="magia-desc" style="margin-top:4px;font-size:0.78rem;color:var(--text-muted)"></div>
              </div>`;
            }).join('')}
          </div>
        ` : ''}
        ${tomoData.rituais.length > 0 ? `
          <div style="margin-top:6px">
            <div style="font-size:0.7rem;font-weight:700;color:var(--secondary)">Rituais do Livro das Sombras:</div>
            ${tomoData.rituais.map(r => {
              const conflito = magiasPreparadas.has(r.nome);
              return `
              <div class="magia-item" data-magia-nome="${r.nome}" data-magia-circ="1" style="margin:2px 0;padding:4px 8px;border-left:2px solid ${conflito ? 'var(--danger)' : 'var(--accent)'};cursor:pointer">
                <div style="display:flex;justify-content:space-between;align-items:center">
                  <div>
                    <div class="magia-nome" style="font-size:0.8rem">${r.nome} <span style="font-size:0.6rem;color:var(--text-muted)">(${r.classe || '?'}) - Ritual</span>${conflito ? ' <span style="font-size:0.6rem;color:var(--danger);font-weight:700">Duplicado</span>' : ''}</div>
                    ${r.nome ? badgesMagiaRapidos(r.nome) : ''}
                  </div>
                  <div class="no-print" style="display:flex;gap:4px;flex-shrink:0">
                    <button class="btn btn-sm ${slotEsgotado ? 'btn-secondary' : 'btn-primary'}" data-conjurar="${r.nome}" data-conj-circ="${circuloPacto}" style="font-size:0.7rem" ${slotEsgotado ? 'disabled style="font-size:0.7rem;opacity:0.5;cursor:not-allowed"' : ''}>Conjurar (${circuloPacto}o)</button>
                    <button class="btn btn-sm btn-secondary" data-conjurar-pacto="${r.nome}" style="font-size:0.7rem">Ritual</button>
                  </div>
                </div>
                <div class="magia-desc" style="margin-top:4px;font-size:0.78rem;color:var(--text-muted)"></div>
              </div>`;
            }).join('')}
          </div>
        ` : ''}
      </div>`;
  }

  // Mostrar truques modificados por invocacoes (Explosao Agonizante, Repulsiva, Lanca Mistica)
  const INV_TRUQUE_DISPLAY = {
    'Explosão Agonizante': { efeito: '+modificador de Carisma ao dano', cor: 'var(--danger)' },
    'Explosão Repulsiva': { efeito: 'Empurra o alvo 3 metros para longe', cor: 'var(--accent)' },
    'Lança Mística': { efeito: 'Alcance do truque aumentado', cor: 'var(--secondary)' }
  };
  const truquesModificados = [];
  for (const inv of estado.invocacoes) {
    const nomeInv = typeof inv === 'string' ? inv : inv.nome;
    const truque = inv?.truque;
    const info = INV_TRUQUE_DISPLAY[nomeInv];
    if (info && truque) {
      truquesModificados.push({ invocacao: nomeInv, truque, ...info });
    }
  }
  if (truquesModificados.length > 0) {
    html += '<div style="margin-top:8px">';
    html += '<div style="font-size:0.7rem;font-weight:700;color:var(--secondary);margin-bottom:4px">Truques Modificados por Invocacoes:</div>';
    for (const tm of truquesModificados) {
      html += `
        <div class="magia-item" style="margin:2px 0;padding:4px 8px;border-left:3px solid ${tm.cor}">
          <div class="magia-nome" style="font-size:0.8rem">${tm.truque} <span style="font-size:0.6rem;font-weight:700;color:${tm.cor}">[${tm.invocacao}]</span></div>
          <div style="font-size:0.65rem;color:var(--text-muted)">${tm.efeito}</div>
        </div>`;
    }
    html += '</div>';
  }

  // Mostrar talentos obtidos via invocacoes (Licoes dos Grandes Antigos)
  const talentosViaInvocacao = [];
  for (const inv of estado.invocacoes) {
    const nomeInv = typeof inv === 'string' ? inv : inv.nome;
    const talento = inv?.talento;
    if (semAcento(nomeInv) === semAcento('Lições dos Grandes Antigos') && talento) {
      talentosViaInvocacao.push({ invocacao: nomeInv, talento });
    }
  }
  if (talentosViaInvocacao.length > 0) {
    html += '<div style="margin-top:8px">';
    html += '<div style="font-size:0.7rem;font-weight:700;color:var(--secondary);margin-bottom:4px">Talentos via Invocacoes:</div>';
    for (const ti of talentosViaInvocacao) {
      html += `
        <div class="magia-item" style="margin:2px 0;padding:4px 8px;border-left:3px solid var(--accent)">
          <div class="magia-nome" style="font-size:0.8rem">${ti.talento} <span style="font-size:0.6rem;color:var(--text-muted)">(Talento de Origem)</span></div>
          <div style="font-size:0.65rem;color:var(--text-muted)">${ti.invocacao}</div>
        </div>`;
    }
    html += '</div>';
  }

  // Mostrar invocacoes que concedem magias (exceto pactos)
  const invocacoesComMagia = extrairInvocacoesMagicasBruxo(estado.invocacoes);
  if (invocacoesComMagia.length > 0) {
    html += '<div style="margin-top:8px">';
    html += '<div style="font-size:0.7rem;font-weight:700;color:var(--secondary);margin-bottom:4px">Magias via Invocacoes:</div>';
    for (const inv of invocacoesComMagia) {
      const infoMagia = indiceMagiasCache?.find(m => m.nome === inv.magia);
      const circ = infoMagia?.circulo ?? 1;
      html += `
        <div class="magia-item" data-magia-nome="${inv.magia}" data-magia-circ="${circ}" style="margin:2px 0;padding:4px 8px;border-left:2px solid var(--secondary);cursor:pointer">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div>
              <div class="magia-nome" style="font-size:0.8rem">${inv.magia}</div>
              ${inv.magia ? badgesMagiaRapidos(inv.magia) : ''}
              <div style="font-size:0.6rem;color:var(--text-muted)">${inv.invocacao} (sem gastar espaco)</div>
            </div>
            <button class="btn btn-sm btn-primary no-print" data-conjurar-pacto="${inv.magia}" style="font-size:0.7rem;flex-shrink:0">Conjurar</button>
          </div>
          <div class="magia-desc" style="margin-top:4px;font-size:0.78rem;color:var(--text-muted)"></div>
        </div>`;
    }
    html += '</div>';
  }

  html += '</div></details>';
  return html;
}

// Extrai invocacoes que concedem magias sem gastar espaco de magia
function extrairInvocacoesMagicasBruxo(invocacoesSelecionadas) {
  // Mapa de invocacoes que concedem magias conhecidas (nome_invocacao -> magia_concedida)
  const MAPA_INVOCACOES_MAGIA = {
    'Armadura de Sombras': 'Armadura Arcana',
    'Mascara das Muitas Faces': 'Disfarcar-se',
    'Visoes Nebulosas': 'Imagem Silenciosa',
    'Salto Sobrenatural': 'Salto',
    'Passo Ascendente': 'Levitacao',
    'Mestre das Infindaveis Formas': 'Alterar-se',
    'Uno com as Sombras': 'Invisibilidade',
    'Presente das Profundezas': 'Respirar na Agua',
    'Visoes de Reinos Distantes': 'Olho Arcano',
    'Lamento das Sepulturas': 'Falar com Mortos',
    'Vigor Infero': 'Vitalidade Vazia'
  };
  const resultado = [];
  for (const inv of invocacoesSelecionadas) {
    // Suporta tanto string quanto objeto {nome, truque?}
    const nomeInv = typeof inv === 'string' ? inv : inv.nome;
    const invNorm = semAcento(nomeInv);
    for (const [nomeMap, magia] of Object.entries(MAPA_INVOCACOES_MAGIA)) {
      if (semAcento(nomeMap) === invNorm) {
        resultado.push({ invocacao: nomeInv, magia });
      }
    }
  }
  return resultado;
}

function renderSecaoMagias() {
  const info = CLASSES_INFO[char.classe];
  const subConj = getSubclasseConjuradoraConjuracao();
  const tipoConj = info.tipo_conjuracao || (subConj ? 'conhecidas' : 'preparadas');
  const todosTruques = (char.magias_conhecidas || []).filter(m => m.circulo === 0);
  const truquesEspecie = todosTruques.filter(m => m.origem === 'especie');
  const _origensTalento = ['iniciado_em_magia', 'tocado_por_fadas', 'tocado_pelas_sombras', 'conjurador_ritualista'];
  const truquesTalento = todosTruques.filter(m => _origensTalento.includes(m.origem));
  const truquesClasse = todosTruques.filter(m => m.origem !== 'especie' && !_origensTalento.includes(m.origem));
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
    preparadasPorCirculo[circ].push(m);
  });

  // Verificar se é Mago (para grimório)
  const ehMago = char.classe === 'Mago';
  const grimorio = char.grimorio || [];

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
          <button class="btn btn-sm btn-secondary" id="btn-add-magia-custom">+ Custom</button>
        </div>
      </div>

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

      <!-- Dádivas do Pacto (Bruxo) -->
      ${renderSecaoPactoBruxo()}

      <!-- Magias Preparadas por Círculo -->
      ${Object.keys(preparadasPorCirculo).sort((a, b) => parseInt(a) - parseInt(b)).map(circ => {
        const magias = preparadasPorCirculo[circ];
        return `
        <details style="margin-bottom:8px">
          <summary style="font-weight:700;cursor:pointer;padding:6px 0;border-bottom:1px solid var(--border-light)">
            ${circ}º Círculo (${magias.length})
          </summary>
          <div style="padding-top:4px">
            ${magias.slice().sort((a, b) => prioridadeConjuracao(a.nome) - prioridadeConjuracao(b.nome)).map(m => {
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
                    <button class="btn btn-sm ${todosEsgotados ? 'btn-secondary' : 'btn-primary'}" data-conjurar="${m.nome}" data-conj-circ="${circulos[0] || m.circulo}" ${todosEsgotados ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Conjurar</button>
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
      ${todosTruques.length > 0 ? `
        <details open style="margin-bottom:8px">
          <summary style="font-weight:700;cursor:pointer;padding:6px 0;border-bottom:1px solid var(--border-light)">
            Truques (${truquesClasse.length}${maxTruques ? ' / ' + maxTruques : ''}${truquesEspecie.length > 0 ? ` + ${truquesEspecie.length} espécie` : ''}${truquesTalento.length > 0 ? ` + ${truquesTalento.length} talento` : ''})
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
            Livro de Magias. Prepare magias a partir daqui (limite: ${maxPreparadas}). Magias com marcador Ritual podem ser conjuradas sem preparar.
          </div>
          <div style="padding-top:4px">
            ${grimorio.slice().sort((a, b) => prioridadeConjuracao(a.nome) - prioridadeConjuracao(b.nome)).map(m => {
              const jaPreparada = preparadas.some(p => p.nome === m.nome);
              const infoMagia = indiceMagiasCache?.find(im => im.nome === m.nome);
              const ehRitual = infoMagia?.tempo_conjuracao && /ritual/i.test(infoMagia.tempo_conjuracao);
              const circulos = Object.keys(espacos).filter(c => parseInt(c) >= m.circulo).sort((a, b) => parseInt(a) - parseInt(b));
              const temUpcast = circulos.length > 1;
              const todosEsgotados = circulos.every(c => (espacos[c]?.usados || 0) >= (espacos[c]?.total || 0));
              return `
              <div class="magia-item ${jaPreparada ? 'preparada' : ''} ${ehRitual && !jaPreparada ? 'magia-dominio' : ''}" data-magia-nome="${m.nome}" data-magia-circ="${m.circulo}" style="opacity:${jaPreparada || ehRitual ? '1' : '0.7'}">
                <div style="display:flex;justify-content:space-between;align-items:center">
                  <div>
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

// Mapa unificado de magias com efeitos mecanicos quando conjuradas
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
function getConcentracaoAtiva() {
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

// Modal de confirmacao para substituir concentracao ativa
function confirmarSubstituirConcentracao(magiaAtual, magiaNova, onConfirmar, onCancelar) {
  abrirModal('Substituir Concentração', `
    <div style="text-align:center;margin-bottom:12px">
      <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:8px">Você está concentrado em:</div>
      <div style="font-size:1.1rem;font-weight:700;color:var(--warning);margin-bottom:12px">${magiaAtual}</div>
      <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:4px">Conjurar <strong>${magiaNova}</strong> cancelará a concentração atual.</div>
      <div style="font-size:0.8rem;color:var(--danger);margin-top:8px">Deseja continuar?</div>
    </div>
    <div style="display:flex;gap:8px;justify-content:center;margin-top:16px">
      <button class="btn btn-danger" id="conc-confirmar">Sim, conjurar ${magiaNova}</button>
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
            _executarConjuracao(nome, circ, btn.dataset.conjCirc, false);
            return;
          }
          // Verificar modais de selecao necessarios
          if (config.selecionar_tipo) {
            mostrarModalSelecaoMagia(nome, circ, config.selecionar_tipo, 'Escolher Tipo', (tipo) => {
              _executarConjuracao(nome, circ, btn.dataset.conjCirc, true, { tipo_selecionado: tipo });
            });
          } else if (config.selecionar_atributo) {
            mostrarModalSelecaoMagia(nome, circ, config.selecionar_atributo, 'Escolher Atributo', (attr) => {
              _executarConjuracao(nome, circ, btn.dataset.conjCirc, true, { atributo_selecionado: attr });
            });
          } else if (config.selecionar_variante) {
            mostrarModalSelecaoMagia(nome, circ, Object.keys(config.selecionar_variante), 'Escolher Variante', (v) => {
              _executarConjuracao(nome, circ, btn.dataset.conjCirc, true, { variante_selecionada: v });
            });
          } else if (config.tipo === 'cura_condicao') {
            const lista = config.condicoes || config.efeitos || [];
            mostrarModalCuraCondicao(nome, circ, lista, (c) => {
              _executarConjuracao(nome, circ, btn.dataset.conjCirc, true, { condicao_removida: c });
            });
          } else {
            _executarConjuracao(nome, circ, btn.dataset.conjCirc, true);
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
      _executarConjuracao(nome, circ, btn.dataset.conjCirc, false);

      }; // fim de _prosseguirConjuracao

      // Se ha conflito de concentracao, pedir confirmacao
      if (temConflitoConc) {
        confirmarSubstituirConcentracao(concAtiva, nome, _prosseguirConjuracao);
      } else {
        _prosseguirConjuracao();
      }
    });
  });

  function _executarConjuracao(nome, circ, baseCirc, aplicarEfeitoSelf, opcoes) {
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

    salvar();
    const upcast = parseInt(circ) > parseInt(baseCirc);
    const sufixoAlvo = aplicarEfeitoSelf ? ' (em você)' : '';
    const detalhe = resultado?.detalhe ? ` — ${resultado.detalhe}` : '';
    if (char.classe === 'Feiticeiro' && semAcento(char.subclasse || '') === semAcento('Feitiçaria Selvagem') && char.recursos?.feiticeiro?.subclasses?.selvagem?.surto_pendente_automatico) {
      toast(`${nome} conjurada${upcast ? ` no ${circ}º círculo` : ''}${sufixoAlvo}${detalhe}! Surto de Magia Selvagem automático pendente.`, 'success');
    } else {
      toast(`${nome} conjurada${upcast ? ` no ${circ}º círculo` : ''}${sufixoAlvo}${detalhe}!`, 'success');
    }
    renderFichaCompleta();
  }

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

      char.magias_preparadas.push({ nome, circulo: circ });
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
  const subConj = getSubclasseConjuradoraConjuracao();
  const tipoConj = info.tipo_conjuracao || (subConj ? 'conhecidas' : 'preparadas');
  const labelMg = tipoConj === 'conhecidas' ? 'Conhecida' : 'Preparada';
  // Classes "conhecidas" (Bardo, Bruxo, Feiticeiro) e subclasses conjuradoras: somente consulta
  const somenteConsulta = tipoConj === 'conhecidas';
  const tabela = classeData?.tabela_caracteristicas;
  let maxPrep = tabela ? getMagiaPreparadas(tabela, char.nivel) : 99;
  let maxTruq = tabela ? getTruquesConhecidos(tabela, char.nivel) : 99;

  // Fallback para subclasses conjuradoras
  if (subConj && maxPrep === 99) {
    maxPrep = subConj.preparadas || 99;
  }
  if (subConj && maxTruq === 99) {
    maxTruq = subConj.truques || 99;
  }
  // Truques extras de Combatente Druídico / Abençoado
  maxTruq += getTruquesExtraEstiloLuta();

  // Espaços de magia para determinar círculos disponíveis
  let espacosNivel = tabela ? getEspacosMagia(tabela, char.nivel) : {};
  // Fallback para subclasses conjuradoras
  if (subConj && Object.keys(espacosNivel).length === 0) {
    espacosNivel = subConj.espacos || {};
  }
  const circulosDisponiveis = Object.keys(espacosNivel).map(Number).sort((a, b) => a - b);
  const maxCirculo = circulosDisponiveis.length > 0 ? Math.max(...circulosDisponiveis) : 9;

  // Carregar magias da classe (pré-carrega tudo)
  const magiasClasse = await obterMagiasDisponiveisClasseAtual();

  // Magias já possuídas
  const jaPreparadas = new Set((char.magias_preparadas || []).map(m => m.nome));
  const jaConhecidas = new Set((char.magias_conhecidas || []).map(m => m.nome));
  const preparadasNormais = (char.magias_preparadas || []).filter(m => magiaContaNoLimite(m));

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

  abrirModal(somenteConsulta ? 'Consultar Magias' : 'Gerenciar Magias', `
    ${somenteConsulta ? '<div class="info-box info" style="margin-bottom:8px;font-size:0.85rem">Magias conhecidas sao definidas na <strong>subida de nivel</strong>. Use o <strong>Descanso Longo</strong> para trocar 1 magia.</div>' : ''}
    <div style="margin-bottom:8px;display:flex;flex-wrap:wrap;gap:6px;font-size:0.78rem">
      <span class="magia-contador ${(char.magias_conhecidas || []).filter(m => m.circulo === 0 && m.origem !== 'especie').length >= maxTruq ? 'contador-cheio' : ''}" id="gm-contador-truques">
        Truques: ${(char.magias_conhecidas || []).filter(m => m.circulo === 0 && m.origem !== 'especie').length}/${maxTruq}
      </span>
      <span class="magia-contador ${preparadasNormais.length >= maxPrep ? 'contador-cheio' : preparadasNormais.length > maxPrep ? 'contador-excedido' : ''}" id="gm-contador-preparadas">
        ${labelMg}s: ${preparadasNormais.length}/${maxPrep}
      </span>
    </div>
    <div class="tabs" id="tabs-gerenciar-magias" style="margin-bottom:8px;overflow-x:auto;white-space:nowrap">
      <div class="tab active" data-tab-mg="preparadas">${labelMg}s Atuais</div>
      <div class="tab" data-tab-mg="truques">Truques</div>
      ${Object.keys(magiasCirculo).map(c => `<div class="tab" data-tab-mg="${c}">${c}º Círculo</div>`).join('')}
    </div>
    <div class="search-box"><input type="text" id="busca-magia-add" placeholder="Buscar magia..." class="form-input"></div>
    <div id="resultado-magias" style="min-height:35dvh;max-height:50dvh;overflow-y:auto"></div>
  `, '', () => renderFichaCompleta());

  const resultadoEl = document.getElementById('resultado-magias');
  let tabAtiva = 'preparadas';

  function renderTab() {
    const termo = semAcento(document.getElementById('busca-magia-add')?.value || '');
    let html = '';

    if (tabAtiva === 'preparadas') {
      // Mostrar magias preparadas/conhecidas atuais (para remover)
      const especiais = (char.magias_preparadas || []).filter(m => magiaEhEspecial(m));
      const normais = (char.magias_preparadas || []).filter(m => magiaContaNoLimite(m));
      const filtradas = termo.length >= 2 ? normais.filter(m => semAcento(m.nome).includes(termo)) : normais;
      const filtradasDom = termo.length >= 2 ? especiais.filter(m => semAcento(m.nome).includes(termo)) : especiais;

      html += `<div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:8px">${labelMg}s: ${normais.length}/${maxPrep}${somenteConsulta ? '' : ' | Use o <strong>check</strong> para (des)marcar'}</div>`;

      if (filtradasDom.length > 0) {
        html += `<div style="font-size:0.75rem;font-weight:700;color:var(--secondary);margin:8px 0 4px">Magias Especiais</div>`;
        html += `<div class="magias-grid">${filtradasDom.map(m => `
          <div class="magia-card selecionada magia-dominio" style="opacity:0.7;cursor:default">
            <span class="magia-card-check"></span>
            <div class="magia-card-nome" data-detalhe-magia="${m.nome}" data-detalhe-circ="${m.circulo}" style="cursor:pointer"><span class="badge-dominio">&#9733;</span> ${m.nome}</div>
            <div class="magia-card-meta"><span>${rotuloOrigemMagia(m)}</span></div>
          </div>
        `).join('')}</div>`;
      }

      if (filtradas.length > 0) {
        html += `<div class="magias-grid">${filtradas.map(m => `
          <div class="magia-card selecionada">
            <span class="magia-card-check" ${somenteConsulta ? '' : `data-remover-check="${m.nome}" style="cursor:pointer"`}></span>
            <div class="magia-card-nome" data-detalhe-magia="${m.nome}" data-detalhe-circ="${m.circulo}" style="cursor:pointer">${m.nome}</div>
            <div class="magia-card-meta">
              <span>${m.circulo || 0}º Circulo</span>
            </div>
          </div>
        `).join('')}</div>`;
      } else if (normais.length === 0) {
        html += `<div style="text-align:center;color:var(--text-muted);padding:16px">Nenhuma magia ${labelMg.toLowerCase()} ainda.</div>`;
      }
    } else if (tabAtiva === 'truques') {
      // Truques: grid da classe com toggle
      const truquesAtuais = (char.magias_conhecidas || []).filter(m => m.circulo === 0);
      const truquesEsp = truquesAtuais.filter(m => m.origem === 'especie');
      const numTruq = truquesAtuais.length - truquesEsp.length;
      html += `<div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:8px">Truques: ${numTruq}/${maxTruq}${truquesEsp.length > 0 ? ` (+${truquesEsp.length} espécie)` : ''}</div>`;

      const selecionadosSet = new Set(truquesAtuais.map(m => m.nome));
      const truquesEspSet = new Set(truquesEsp.map(m => m.nome));

      // Exibir truques de espécie (não removíveis) primeiro
      if (truquesEsp.length > 0) {
        let listaEsp = truquesEsp;
        if (termo.length >= 2) listaEsp = listaEsp.filter(m => semAcento(m.nome).includes(termo));
        html += `<div style="font-size:0.75rem;font-weight:700;color:var(--secondary);margin:8px 0 4px">Truques de Espécie</div>`;
        html += `<div class="magias-grid">${listaEsp.map(m => `
          <div class="magia-card selecionada magia-dominio" style="opacity:0.7;cursor:default">
            <span class="magia-card-check"></span>
            <div class="magia-card-nome" data-detalhe-magia="${m.nome}" data-detalhe-circ="0" style="cursor:pointer"><span class="badge-dominio">&#9733;</span> ${m.nome}</div>
            <div class="magia-card-meta"><span>Especie</span></div>
          </div>
        `).join('')}</div>`;
      }

      let lista = [...truquesClasse];
      lista.sort((a, b) => {
        const aSel = selecionadosSet.has(a.nome) ? 0 : 1;
        const bSel = selecionadosSet.has(b.nome) ? 0 : 1;
        return aSel - bSel || a.nome.localeCompare(b.nome);
      });
      // Filtrar truques de espécie da lista de classe (evitar duplicatas)
      lista = lista.filter(m => !truquesEspSet.has(m.nome));
      if (termo.length >= 2) lista = lista.filter(m => semAcento(m.nome).includes(termo));
      const cheioTruq = numTruq >= maxTruq;

      html += `<div class="magias-grid">${lista.map(m => {
        const sel = selecionadosSet.has(m.nome);
        const bloqueado = cheioTruq && !sel;
        return `
          <div class="magia-card ${sel ? 'selecionada' : ''} ${bloqueado ? 'magia-card-bloqueada' : ''}"
               ${somenteConsulta ? '' : `data-toggle-truque="${m.nome}"`} style="${bloqueado ? 'opacity:0.35;' : ''}">
            <span class="magia-card-check" ${somenteConsulta ? '' : `data-truque-check="${m.nome}" style="cursor:pointer"`}></span>
            <div class="magia-card-nome" data-detalhe-magia="${m.nome}" data-detalhe-circ="0" style="cursor:pointer">${m.nome}</div>
            <div class="magia-card-meta">
              <span>${m.escola || ''}</span>
              ${m.especial === 'C' ? '<span>Conc.</span>' : ''}
            </div>
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
        const isDominio = (char.magias_preparadas || []).find(p => p.nome === m.nome && magiaEhEspecial(p));
        const bloqueado = cheio && !sel && !isDominio;
        return `
          <div class="magia-card ${sel ? 'selecionada' : ''} ${isDominio ? 'magia-dominio' : ''} ${bloqueado ? 'magia-card-bloqueada' : ''}"
               style="${bloqueado ? 'opacity:0.35;' : ''}${isDominio ? 'opacity:0.7;' : ''}">
            <span class="magia-card-check" ${isDominio || somenteConsulta ? '' : `data-circ-check="${m.nome}" data-circ-check-val="${circ}" style="cursor:pointer"`}></span>
            <div class="magia-card-nome" data-detalhe-magia="${m.nome}" data-detalhe-circ="${circ}" style="cursor:pointer">${isDominio ? '<span class="badge-dominio">&#9733;</span> ' : ''}${m.nome}</div>
            <div class="magia-card-meta">
              <span>${m.escola || ''}</span>
              ${m.especial === 'C' ? '<span>Conc.</span>' : ''}
              ${isDominio ? '<span>Especial</span>' : ''}
            </div>
          </div>`;
      }).join('')}</div>`;
    }

    resultadoEl.innerHTML = html;
    bindEventosTab();
  }

  function bindEventosTab() {
    // Remover magia preparada (via check na aba "Preparadas Atuais")
    resultadoEl.querySelectorAll('[data-remover-check]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const nome = el.dataset.removerCheck;
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

    // Toggle truque (via check)
    resultadoEl.querySelectorAll('[data-truque-check]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const nome = el.dataset.truqueCheck;
        // Não permitir remover truques de espécie
        const entradaExistente = (char.magias_conhecidas || []).find(m => m.nome === nome);
        if (entradaExistente && entradaExistente.origem === 'especie') return;
        const idx = (char.magias_conhecidas || []).findIndex(m => m.nome === nome);
        if (idx >= 0) {
          char.magias_conhecidas.splice(idx, 1);
          salvar();
          toast(`${nome} removido`, 'success');
        } else {
          const numAtual = (char.magias_conhecidas || []).filter(m => m.circulo === 0 && m.origem !== 'especie').length;
          if (numAtual >= maxTruq) { toast(`Limite de ${maxTruq} truques atingido`, 'error'); return; }
          char.magias_conhecidas.push({ nome, circulo: 0 });
          salvar();
          toast(`${nome} adicionado`, 'success');
        }
        atualizarContadores();
        renderTab();
      });
    });

    // Toggle magia de circulo (via check)
    resultadoEl.querySelectorAll('[data-circ-check]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const nome = el.dataset.circCheck;
        const circ = parseInt(el.dataset.circCheckVal);
        const idx = char.magias_preparadas.findIndex(m => m.nome === nome);
        if (idx >= 0) {
          // Remover
          char.magias_preparadas.splice(idx, 1);
          salvar();
          toast(`${nome} removida`, 'success');
        } else {
          // Adicionar — verificar limite
          const numAtual = (char.magias_preparadas || []).filter(m => magiaContaNoLimite(m)).length;
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
          ${magia.circulo_superior ? `<div class="info-box info mt-1"><strong>Em círculos superiores:</strong><div class="md-content">${mdParaHtml(magia.circulo_superior)}</div></div>` : ''}
          ${(magia.classes || []).length > 0 ? `<div style="font-size:0.8rem;color:var(--text-muted);margin-top:8px">Classes: ${magia.classes.join(', ')}</div>` : ''}
        `;
        abrirModal(magia.nome, detalhesHtml, '<button class="btn btn-primary" onclick="fecharModal()">Fechar</button>');
      });
    });
  }

  function atualizarContadores() {
    // Recalcular preparadas normais a partir do char
    preparadasNormais.length = 0;
    (char.magias_preparadas || []).filter(m => magiaContaNoLimite(m)).forEach(m => preparadasNormais.push(m));

    // Atualizar contador de truques no topo do modal
    // Excluir truques de espécie do contador de classe
    const numTruques = (char.magias_conhecidas || []).filter(m => m.circulo === 0 && m.origem !== 'especie').length;
    const contTruques = document.getElementById('gm-contador-truques');
    if (contTruques) {
      contTruques.textContent = `Truques: ${numTruques}/${maxTruq}`;
      contTruques.className = `magia-contador ${numTruques >= maxTruq ? 'contador-cheio' : ''}`;
    }

    // Atualizar contador de preparadas no topo do modal
    const contPrep = document.getElementById('gm-contador-preparadas');
    if (contPrep) {
      contPrep.textContent = `${labelMg}s: ${preparadasNormais.length}/${maxPrep}`;
      contPrep.className = `magia-contador ${preparadasNormais.length >= maxPrep ? 'contador-cheio' : preparadasNormais.length > maxPrep ? 'contador-excedido' : ''}`;
    }
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
    <div id="resultado-grimorio" style="min-height:35dvh;max-height:50dvh;overflow-y:auto"></div>
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
async function mostrarTrocaMagias(callbackPosTroca = null) {
  const info = CLASSES_INFO[char.classe] || {};
  const subConj = getSubclasseConjuradoraConjuracao();
  let maxPreparadas = classeData?.tabela_caracteristicas
    ? getMagiaPreparadas(classeData.tabela_caracteristicas, char.nivel) : 0;
  // Fallback para subclasses conjuradoras
  if (subConj && maxPreparadas === 0) {
    maxPreparadas = subConj.preparadas || 0;
  }
  const ehMago = char.classe === 'Mago';

  // Espaços de magia para determinar círculos disponíveis
  let espacosNivel = classeData?.tabela_caracteristicas
    ? getEspacosMagia(classeData.tabela_caracteristicas, char.nivel) : {};
  if (subConj && Object.keys(espacosNivel).length === 0) {
    espacosNivel = subConj.espacos || {};
  }
  const maxCirculo = Math.max(...Object.keys(espacosNivel).map(Number), 0);

  // Buscar lista de magias disponíveis (classe ou grimório)
  let magiasDisponiveis = [];
  if (ehMago) {
    magiasDisponiveis = (char.grimorio || []).map(m => ({ ...m }));
  } else {
    magiasDisponiveis = (await obterMagiasDisponiveisClasseAtual()).filter(m => m.circulo > 0);
  }

  // Identificar magias de domínio (não removíveis)
  const nomesDominio = new Set((char.magias_preparadas || []).filter(m => magiaEhEspecial(m)).map(m => m.nome));

  // Set temporário com magias selecionadas (excluindo domínio)
  const selecionadasSet = new Set((char.magias_preparadas || []).filter(m => magiaContaNoLimite(m)).map(m => m.nome));
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
    <div id="resultado-troca" style="min-height:35dvh;max-height:50dvh;overflow-y:auto"></div>
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
      html += `<div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:8px">Use o <strong>check</strong> para (des)marcar. Toque no <strong>nome</strong> para ver detalhes.</div>`;

      if (nomesDominio.size > 0) {
        const domMagias = magiasDisponiveis.filter(m => nomesDominio.has(m.nome));
        const filtDom = termo.length >= 2 ? domMagias.filter(m => semAcento(m.nome).includes(termo)) : domMagias;
        if (filtDom.length > 0 || (termo.length < 2 && nomesDominio.size > 0)) {
          html += `<div style="font-size:0.75rem;font-weight:700;color:var(--secondary);margin:4px 0">Magias Especiais</div>`;
          // Garantir que domínio apareca mesmo se nao esta em magiasDisponiveis
          const domNomes = [...nomesDominio];
          const filtDomNomes = termo.length >= 2 ? domNomes.filter(n => semAcento(n).includes(termo)) : domNomes;
          html += `<div class="magias-grid">${filtDomNomes.map(nome => `
            <div class="magia-card selecionada magia-dominio" style="opacity:0.7;cursor:default">
              <span class="magia-card-check"></span>
              <div class="magia-card-nome" data-troca-info="${nome}" data-troca-info-circ="${circuloMap[nome] || 1}"><span class="badge-dominio">&#9733;</span> ${nome}</div>
              <div class="magia-card-meta"><span>Especial</span></div>
            </div>
          `).join('')}</div>`;
        }
      }

      const selNomes = [...selecionadasSet];
      const filtSel = termo.length >= 2 ? selNomes.filter(n => semAcento(n).includes(termo)) : selNomes;
      if (filtSel.length > 0) {
        html += `<div class="magias-grid">${filtSel.map(nome => `
          <div class="magia-card selecionada" style="cursor:pointer" data-troca-toggle="${nome}">
            <span class="magia-card-check" data-troca-check="${nome}"></span>
            <div class="magia-card-nome" data-troca-info="${nome}" data-troca-info-circ="${circuloMap[nome] || 1}">${nome}</div>
            <div class="magia-card-meta"><span>${circuloMap[nome] || '?'}º Círculo</span></div>
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
            <span class="magia-card-check" ${isDominio ? '' : `data-troca-check="${m.nome}"`}></span>
            <div class="magia-card-nome" data-troca-info="${m.nome}" data-troca-info-circ="${circ}">${isDominio ? '<span class="badge-dominio">&#9733;</span> ' : ''}${m.nome}</div>
            <div class="magia-card-meta">
              <span>${m.escola || ''}</span>
              ${m.especial === 'C' ? '<span>Conc.</span>' : ''}
              ${isDominio ? '<span>Especial</span>' : ''}
            </div>
          </div>`;
      }).join('')}</div>`;
    }

    resultadoEl.innerHTML = html;
    bindEventosTroca();
  }

  function bindEventosTroca() {
    // Toggle seleção ao clicar no check
    resultadoEl.querySelectorAll('[data-troca-check]').forEach(chk => {
      chk.addEventListener('click', (e) => {
        e.stopPropagation();
        const nome = chk.dataset.trocaCheck;
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

    // Info detalhes ao clicar no nome
    resultadoEl.querySelectorAll('[data-troca-info]').forEach(el => {
      el.addEventListener('click', async (e) => {
        e.stopPropagation();
        const nome = el.dataset.trocaInfo;
        const circ = parseInt(el.dataset.trocaInfoCirc);
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
          ${magia.circulo_superior ? `<div class="info-box info mt-1"><strong>Em círculos superiores:</strong><div class="md-content">${mdParaHtml(magia.circulo_superior)}</div></div>` : ''}
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
      ...(char.magias_preparadas || []).filter(m => magiaEhEspecial(m)),
      ...[...selecionadasSet].map(nome => ({ nome, circulo: circuloMap[nome] || 1 }))
    ];
    salvar();
    window.fecharModal();
    renderFichaCompleta();
    toast('Magias preparadas atualizadas!', 'success');
    // Encadear próxima ação (ex.: troca de maestrias após magias)
    if (callbackPosTroca) callbackPosTroca();
  });

  renderTabTroca();
}

/** Modal de troca de 1 magia conhecida (Descanso Longo - Bardo, Feiticeiro, Bruxo, subclasses conjuradoras) */
async function mostrarTrocaMagiaConhecida(callbackPosTroca = null) {
  const subConj = getSubclasseConjuradoraConjuracao();

  // Espacos de magia para determinar circulos disponiveis
  let espacosNivel = classeData?.tabela_caracteristicas
    ? getEspacosMagia(classeData.tabela_caracteristicas, char.nivel) : {};
  if (subConj && Object.keys(espacosNivel).length === 0) {
    espacosNivel = subConj.espacos || {};
  }
  const maxCirculo = Math.max(...Object.keys(espacosNivel).map(Number), 0);

  // Magias conhecidas atuais (apenas as que contam no limite e tem circulo > 0)
  const magiasAtuais = (char.magias_preparadas || []).filter(m => m.circulo > 0 && magiaContaNoLimite(m));

  if (magiasAtuais.length === 0) {
    toast('Nenhuma magia conhecida para trocar', 'error');
    if (callbackPosTroca) callbackPosTroca();
    else renderFichaCompleta();
    return;
  }

  // Carregar magias disponiveis da classe
  const magiasClasse = await obterMagiasDisponiveisClasseAtual();
  const jaTemSet = new Set((char.magias_preparadas || []).map(m => m.nome));

  let magiaRemover = null;
  let magiaAdicionar = null;
  let circuloAdicionar = null;

  const nomeClasse = char.subclasse && ehSubclasseConjuradora() ? `${char.classe} (${char.subclasse})` : char.classe;

  abrirModal('Trocar Magia Conhecida', `
    <div class="info-box info" style="margin-bottom:12px;font-size:0.85rem">
      Apos um Descanso Longo, voce pode trocar <strong>1 magia conhecida</strong> por outra da lista de ${nomeClasse}.
    </div>

    <div style="margin-bottom:12px">
      <label class="form-label" style="font-weight:700;color:var(--accent)">Magia a remover:</label>
      <select class="form-input" id="troca-conhecida-remover" style="margin-bottom:4px">
        <option value="">Selecione uma magia...</option>
        ${magiasAtuais.map(m => `<option value="${m.nome}" data-circ="${m.circulo}">${m.nome} (${m.circulo}\u00ba Circulo)</option>`).join('')}
      </select>
    </div>

    <div id="troca-conhecida-adicionar-container" style="display:none">
      <label class="form-label" style="font-weight:700;color:var(--accent)">Nova magia:</label>
      <div class="search-box" style="margin-bottom:8px"><input type="text" id="busca-troca-conhecida" placeholder="Buscar magia..." class="form-input"></div>
      <div id="resultado-troca-conhecida" style="max-height:35vh;overflow-y:auto;margin-bottom:8px"></div>
      <div style="font-size:0.85rem;color:var(--text-muted)">
        Selecionada: <strong id="troca-conhecida-nome" style="color:var(--accent)">\u2014</strong>
      </div>
    </div>
  `, `<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>
     <button class="btn btn-secondary" id="btn-pular-troca-conhecida">Nao Trocar</button>
     <button class="btn btn-primary" id="btn-confirmar-troca-conhecida" disabled>Confirmar Troca</button>`);

  const containerAdicionar = document.getElementById('troca-conhecida-adicionar-container');
  const resultadoEl = document.getElementById('resultado-troca-conhecida');
  const confirmarBtn = document.getElementById('btn-confirmar-troca-conhecida');

  function renderListaSubstituta() {
    const termo = semAcento(document.getElementById('busca-troca-conhecida')?.value || '');
    // Filtrar magias da classe que podem ser escolhidas
    let disponiveis = magiasClasse.filter(m =>
      m.circulo > 0 && m.circulo <= maxCirculo &&
      !jaTemSet.has(m.nome) && m.nome !== magiaRemover
    );
    if (termo.length >= 2) disponiveis = disponiveis.filter(m => semAcento(m.nome).includes(termo));
    disponiveis = disponiveis.slice(0, 30);

    resultadoEl.innerHTML = `<div class="magias-grid">${disponiveis.map(m => `
      <div class="magia-card ${m.nome === magiaAdicionar ? 'selecionada' : ''}" data-selecionar-troca="${m.nome}" data-selecionar-circ="${m.circulo}" style="cursor:pointer">
        <span class="magia-card-check"></span>
        <div class="magia-card-nome" data-troca-detalhe="${m.nome}" data-troca-detalhe-circ="${m.circulo}" style="cursor:pointer">${m.nome}</div>
        <div class="magia-card-meta">
          <span>${m.circulo}\u00ba Circulo</span><span>${m.escola || ''}</span>
          ${m.especial === 'C' ? '<span>Conc.</span>' : ''}
        </div>
      </div>
    `).join('')}</div>`;

    // Selecionar magia substituta
    resultadoEl.querySelectorAll('[data-selecionar-troca]').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('[data-troca-detalhe]')) return;
        magiaAdicionar = el.dataset.selecionarTroca;
        circuloAdicionar = parseInt(el.dataset.selecionarCirc);
        document.getElementById('troca-conhecida-nome').textContent = magiaAdicionar;
        confirmarBtn.disabled = false;
        renderListaSubstituta();
      });
    });

    // Detalhes da magia
    resultadoEl.querySelectorAll('[data-troca-detalhe]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const nome = btn.dataset.trocaDetalhe;
        const circ = parseInt(btn.dataset.trocaDetalheCirc);
        const dados = await getMagiasPorCirculo(circ);
        const magia = dados?.magias?.find(m => m.nome === nome);
        if (!magia) return;
        abrirModal(magia.nome, `
          <div class="magia-meta" style="margin-bottom:8px;display:flex;flex-wrap:wrap;gap:8px;font-size:0.85rem">
            <span class="badge badge-primary">${circ}\u00ba Circulo</span>
            <span class="badge badge-secondary">${magia.escola}</span>
            <span>${magia.tempo_conjuracao}</span> <span>${magia.alcance}</span>
            <span>${magia.componentes}</span> <span>${magia.duracao}</span>
          </div>
          <div class="md-content">${mdParaHtml(magia.descricao)}</div>
          ${magia.circulo_superior ? `<div class="info-box info mt-1"><strong>Em circulos superiores:</strong><div class="md-content">${mdParaHtml(magia.circulo_superior)}</div></div>` : ''}
        `, '<button class="btn btn-primary" onclick="fecharModal()">Fechar</button>');
      });
    });
  }

  // Quando selecionar magia a remover
  document.getElementById('troca-conhecida-remover')?.addEventListener('change', (e) => {
    magiaRemover = e.target.value || null;
    magiaAdicionar = null;
    circuloAdicionar = null;
    document.getElementById('troca-conhecida-nome').textContent = '\u2014';
    confirmarBtn.disabled = true;
    if (magiaRemover) {
      containerAdicionar.style.display = 'block';
      renderListaSubstituta();
    } else {
      containerAdicionar.style.display = 'none';
    }
  });

  // Busca
  document.getElementById('busca-troca-conhecida')?.addEventListener('input', renderListaSubstituta);

  // Nao trocar
  document.getElementById('btn-pular-troca-conhecida')?.addEventListener('click', () => {
    window.fecharModal();
    if (callbackPosTroca) callbackPosTroca();
    else renderFichaCompleta();
  });

  // Confirmar troca
  confirmarBtn?.addEventListener('click', () => {
    if (!magiaRemover || !magiaAdicionar) return;
    const idx = char.magias_preparadas.findIndex(m => m.nome === magiaRemover);
    if (idx >= 0) {
      char.magias_preparadas.splice(idx, 1);
      char.magias_preparadas.push({ nome: magiaAdicionar, circulo: circuloAdicionar });
      salvar();
      toast(`Trocou ${magiaRemover} por ${magiaAdicionar}`, 'success');
    }
    window.fecharModal();
    if (callbackPosTroca) callbackPosTroca();
    else renderFichaCompleta();
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
function renderSecaoCondicoes() {
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
function renderSecaoDefesas() {
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
function renderSecaoSentidos() {
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
function setupEventosCondicoes() {
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
function setupEventosDefesas() {
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
  let danoAutoInfo = '';
  let vantagemInfo = '';
  let danoExibicao = item.dados?.dano || '';
  if (item.tipo === 'arma' && item.dados) {
    const info = CLASSES_INFO[char.classe];
    const prof = bonusProficiencia(char.nivel);
    const props = (item.dados.propriedades || '').toLowerCase();
    const cat = (item.dados.categoria || '').toLowerCase();
    const isAcuidade = props.includes('acuidade');
    const isDistancia = cat.includes('dist');

    let modAtq;
    let usaForcaNoAtaque = false;
    if (isAcuidade) {
      const modFor = calcMod(char.atributos.forca);
      const modDes = calcMod(char.atributos.destreza);
      usaForcaNoAtaque = modFor >= modDes;
      modAtq = Math.max(modFor, modDes);
    } else if (isDistancia) {
      modAtq = calcMod(char.atributos.destreza);
    } else {
      modAtq = calcMod(char.atributos.forca);
      usaForcaNoAtaque = true;
    }

    const temProf = sheetTemProfArma({ categoria: item.dados.categoria, propriedades: item.dados.propriedades || '' });
    const bonusAtq = modAtq + (temProf ? prof : 0);
    ataqueInfo = `<span class="badge badge-secondary" style="font-size:0.65rem">Atq ${fmtMod(bonusAtq)}</span>`;
    if (ataqueImprudenteAtivo() && usaForcaNoAtaque) {
      vantagemInfo = '<span class="badge" style="font-size:0.6rem;background:#fff3cd;color:#8a6d3b;border:1px solid #ffeeba">Vantagem (Imprudente)</span>';
    }
    const estadoGuardiao = getEstadoRecursosGuardiao();
    if (estadoGuardiao?.cacadorPrecisoAtivo && estadoGuardiao?.marcaPredadorAtiva) {
      vantagemInfo = '<span class="badge" style="font-size:0.6rem;background:#e3f2fd;color:#0d47a1;border:1px solid #90caf9">Vantagem (Caçador Preciso)</span>';
    }

    const danoBase = item.dados?.dano || '';
    const matchDano = danoBase.match(/^(\d+d\d+)(\s*[+\-]\s*\d+)?(.*)$/i);
    if (matchDano) {
      const dado = matchDano[1];
      const modExistente = matchDano[2];
      const sufixo = matchDano[3] || '';
      const estadoFuria = getEstadoFuria();
      const bonusFuria = estadoFuria?.ativa && usaForcaNoAtaque ? (estadoFuria.dano || 0) : 0;
      const bonusTotalDano = modAtq + bonusFuria;

      if (modExistente) {
        const modBase = parseInt(String(modExistente).replace(/\s+/g, '')) || 0;
        const modFinal = modBase + bonusFuria;
        const sinal = modFinal >= 0 ? `+${modFinal}` : `${modFinal}`;
        danoExibicao = `${dado}${sinal}${sufixo}`.replace(/\s+/g, ' ').trim();
      } else if (bonusTotalDano !== 0) {
        const sinal = bonusTotalDano >= 0 ? `+${bonusTotalDano}` : `${bonusTotalDano}`;
        danoExibicao = `${dado}${sinal}${sufixo}`.replace(/\s+/g, ' ').trim();
      } else {
        danoExibicao = danoBase;
      }
      danoAutoInfo = `<span class="badge" style="font-size:0.6rem;background:#fce4ec;color:#c62828;border:1px solid #ef9a9a">Dano ${danoExibicao}</span>`;
    }
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

  // Badge de maestria com a arma
  let maestriaBadge = '';
  if (item.tipo === 'arma' && item.dados?.maestria) {
    const temMaestria = (char.maestrias_arma || []).some(m => m === item.nome);
    if (temMaestria) {
      maestriaBadge = `<span class="badge" style="font-size:0.6rem;background:#fff8e1;color:#e65100;border:1px solid #ffcc80;font-weight:700">Maestria: ${item.dados.maestria}</span>`;
    }
  }

  const isZeroQtd = (item.quantidade ?? 1) <= 0;

  return `
    <div class="inv-item ${item.equipado ? 'inv-item-equipado' : ''} ${isZeroQtd ? 'inv-item-zerado' : ''}" data-idx="${idx}">
      <div class="inv-drag-handle no-print" title="Arrastar para reordenar">&#9776;</div>
      <div style="flex:1;min-width:0;cursor:pointer" data-info-inv-sheet="${idx}" title="Ver detalhes">
        <div class="inv-item-nome">
          ${item.nome} ${profBadge}
        </div>
        ${(ataqueInfo || danoAutoInfo || vantagemInfo || maestriaBadge || tipoBadge || customBadges)
          ? `<div class="inv-item-badges" style="display:flex;flex-wrap:wrap;gap:3px;margin-top:2px">${ataqueInfo}${danoAutoInfo}${vantagemInfo}${maestriaBadge}${tipoBadge}${customBadges}</div>`
          : ''
        }
        <div class="inv-item-detalhe">
          ${item.tipo === 'arma' ? `${danoExibicao} | ${item.dados?.propriedades || ''}` : ''}
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

        if (char.classe === 'Bárbaro' && temArmaduraPesadaEquipada()) {
          if (!char.recursos) char.recursos = {};
          char.recursos.furia_ativa = false;
        }

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

  // Adicionar item (por categorias) - usar onclick direto para evitar empilhar handlers em re-renders
  const btnAddInv = document.getElementById('btn-add-inv');
  if (btnAddInv) btnAddInv.onclick = () => mostrarSeletorCategoria();

  // Item customizado
  const btnAddCustom = document.getElementById('btn-add-inv-custom');
  if (btnAddCustom) btnAddCustom.onclick = () => {
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
  };

  // Editar PO
  document.getElementById('btn-edit-po')?.addEventListener('click', () => {
    abrirModal('Peças de Ouro', `
      <div style="text-align:center;margin-bottom:12px">
        <div style="font-size:1.3rem;font-weight:700;color:var(--primary)">${char.po || 0} PO</div>
        <div style="font-size:0.75rem;color:var(--text-muted)">Saldo atual</div>
      </div>
      <div style="display:flex;gap:8px;align-items:flex-end;margin-bottom:12px">
        <div class="form-group" style="flex:1;margin-bottom:0">
          <label class="form-label" for="edit-po-qtd">Quantidade</label>
          <input type="number" class="form-input" id="edit-po-qtd" value="0" min="0">
        </div>
        <button class="btn btn-success btn-sm" id="btn-po-add" style="height:40px">+ Adicionar</button>
        <button class="btn btn-danger btn-sm" id="btn-po-sub" style="height:40px">- Remover</button>
      </div>
      <div style="border-top:1px solid var(--border-light);padding-top:8px;margin-top:4px">
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label" for="edit-po-total">Definir valor total</label>
          <input type="number" class="form-input" id="edit-po-total" value="${char.po || 0}" min="0">
        </div>
      </div>
    `, '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-primary" id="btn-salvar-po">Salvar Total</button>');

    document.getElementById('btn-po-add')?.addEventListener('click', () => {
      const qtd = parseInt(document.getElementById('edit-po-qtd')?.value) || 0;
      if (qtd <= 0) return;
      char.po = (char.po || 0) + qtd;
      salvar();
      window.fecharModal();
      renderFichaCompleta();
      toast(`+${qtd} PO adicionadas! Total: ${char.po} PO`, 'success');
    });

    document.getElementById('btn-po-sub')?.addEventListener('click', () => {
      const qtd = parseInt(document.getElementById('edit-po-qtd')?.value) || 0;
      if (qtd <= 0) return;
      if (qtd > (char.po || 0)) {
        toast('PO insuficiente!', 'error');
        return;
      }
      char.po = (char.po || 0) - qtd;
      salvar();
      window.fecharModal();
      renderFichaCompleta();
      toast(`-${qtd} PO removidas! Total: ${char.po} PO`, 'success');
    });

    document.getElementById('btn-salvar-po')?.addEventListener('click', () => {
      char.po = parseInt(document.getElementById('edit-po-total')?.value) || 0;
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

/** Drag and drop no inventário da ficha (desktop e mobile) */
function setupSheetDragDrop() {
  const listaEl = document.getElementById('sheet-inventario');
  if (!listaEl) return;

  let dragIdx = null;

  // ---- Eventos de mouse (desktop): drag inicia apenas pelo handle ----
  listaEl.querySelectorAll('.inv-item[data-idx]').forEach(el => {
    const handle = el.querySelector('.inv-drag-handle');
    if (handle) {
      handle.addEventListener('mousedown', () => {
        el.setAttribute('draggable', 'true');
      });
    }

    el.addEventListener('dragstart', (e) => {
      // Seguranca: so permite drag se iniciado pelo handle
      if (!el.getAttribute('draggable')) { e.preventDefault(); return; }
      dragIdx = parseInt(el.dataset.idx);
      el.classList.add('inv-item-dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    el.addEventListener('dragend', () => {
      el.classList.remove('inv-item-dragging');
      el.removeAttribute('draggable');
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

  // ---- Eventos de toque (mobile): drag inicia apenas pelo handle ----
  let touchDragEl = null;
  let touchClone = null;
  let touchOffsetX = 0;
  let touchOffsetY = 0;

  listaEl.querySelectorAll('.inv-item[data-idx]').forEach(el => {
    el.addEventListener('touchstart', (e) => {
      // So inicia drag se o toque for no handle de organizacao
      if (!e.target.closest('.inv-drag-handle')) return;
      const touch = e.touches[0];
      dragIdx = parseInt(el.dataset.idx);
      touchDragEl = el;

      const rect = el.getBoundingClientRect();
      touchOffsetX = touch.clientX - rect.left;
      touchOffsetY = touch.clientY - rect.top;

      // Criar clone visual para arrastar
      touchClone = el.cloneNode(true);
      touchClone.style.cssText = `
        position: fixed;
        left: ${rect.left}px;
        top: ${rect.top}px;
        width: ${rect.width}px;
        opacity: 0.85;
        pointer-events: none;
        z-index: 9999;
        background: var(--bg-card);
        border: 2px solid var(--primary);
        border-radius: var(--radius-sm);
        box-shadow: 0 4px 16px rgba(0,0,0,0.25);
      `;
      document.body.appendChild(touchClone);
      el.classList.add('inv-item-dragging');
    }, { passive: true });

    el.addEventListener('touchmove', (e) => {
      if (!touchClone || !touchDragEl) return;
      e.preventDefault();
      const touch = e.touches[0];

      // Mover clone
      touchClone.style.left = `${touch.clientX - touchOffsetX}px`;
      touchClone.style.top = `${touch.clientY - touchOffsetY}px`;

      // Destacar item abaixo do toque
      listaEl.querySelectorAll('.inv-item').forEach(item => item.classList.remove('inv-item-dragover'));
      touchClone.style.display = 'none';
      const elementoAbaixo = document.elementFromPoint(touch.clientX, touch.clientY);
      touchClone.style.display = '';
      const alvo = elementoAbaixo?.closest('.inv-item[data-idx]');
      if (alvo && alvo !== touchDragEl) {
        alvo.classList.add('inv-item-dragover');
      }
    }, { passive: false });

    el.addEventListener('touchend', (e) => {
      if (!touchDragEl) return;
      const touch = e.changedTouches[0];

      // Identificar destino
      touchClone.style.display = 'none';
      const elementoAbaixo = document.elementFromPoint(touch.clientX, touch.clientY);
      touchClone.style.display = '';
      const alvo = elementoAbaixo?.closest('.inv-item[data-idx]');

      if (alvo && alvo !== touchDragEl) {
        const dropIdx = parseInt(alvo.dataset.idx);
        if (dragIdx !== null && dragIdx !== dropIdx) {
          const [item] = char.inventario.splice(dragIdx, 1);
          char.inventario.splice(dropIdx, 0, item);
          salvar();
          reRenderSheetInv();
        }
      }

      // Limpar
      if (touchClone) { touchClone.remove(); touchClone = null; }
      touchDragEl.classList.remove('inv-item-dragging');
      listaEl.querySelectorAll('.inv-item').forEach(item => item.classList.remove('inv-item-dragover'));
      touchDragEl = null;
      dragIdx = null;
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
    <div id="lista-inv-cat" style="min-height:35dvh;max-height:50dvh;overflow-y:auto"></div>
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
          // Verificar se o personagem tem maestria com esta arma
          const temMaestriaArma = (char.maestrias_arma || []).includes(a.nome);
          const maestriaBadgeAdd = temMaestriaArma && a.maestria
            ? `<span class="badge" style="font-size:0.6rem;background:#fff8e1;color:#e65100;border:1px solid #ffcc80;font-weight:700">Maestria: ${a.maestria}</span>`
            : '';
          return {
            nome: a.nome,
            detalhe: `${a.dano} | ${a.propriedades || '\u2014'}`,
            detalhe2: `Maestria: ${a.maestria || '\u2014'} | ${a.custo} | ${a.peso || '\u2014'}`,
            badge: sheetBadgeProf(prof) + (maestriaBadgeAdd ? ' ' + maestriaBadgeAdd : ''),
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

// ============================================================
// IMPRESSAO DE FICHA - Versao formatada para impressao
// ============================================================

/**
 * Pre-carrega descricoes de todas as magias do personagem
 * para uso no HTML de impressao.
 */
async function carregarDescricoesMagias() {
  const cache = {};
  const todasMagias = [];

  // Truques conhecidos
  (char.magias_conhecidas || []).forEach(m => {
    if (!cache[m.nome]) todasMagias.push({ nome: m.nome, circulo: m.circulo || 0 });
  });
  // Magias preparadas
  (char.magias_preparadas || []).forEach(m => {
    if (!cache[m.nome]) todasMagias.push({ nome: m.nome, circulo: m.circulo || 1 });
  });
  // Magias customizadas (ja tem descricao inline)
  // Grimorio
  (char.grimorio || []).forEach(m => {
    if (!cache[m.nome] && !todasMagias.find(t => t.nome === m.nome)) {
      todasMagias.push({ nome: m.nome, circulo: m.circulo || 1 });
    }
  });
  // Magias do pacto do bruxo
  if (char.classe === 'Bruxo') {
    const estado = getEstadoRecursosBruxo();
    if (estado?.pacto === 'Pacto do Tomo') {
      (char.recursos?.bruxo?.livro_sombras?.truques || []).forEach(nome => {
        if (!todasMagias.find(t => t.nome === nome)) todasMagias.push({ nome, circulo: 0 });
      });
      (char.recursos?.bruxo?.livro_sombras?.rituais || []).forEach(r => {
        const nome = typeof r === 'string' ? r : r.nome;
        const circ = typeof r === 'string' ? 1 : (r.circulo || 1);
        if (!todasMagias.find(t => t.nome === nome)) todasMagias.push({ nome, circulo: circ });
      });
    }
    // Magias de invocacoes
    if (estado?.invocacoes) {
      for (const inv of estado.invocacoes) {
        const nomeInv = typeof inv === 'string' ? inv : inv.nome;
        const magiasInv = inv?.magias || [];
        magiasInv.forEach(m => {
          const nome = typeof m === 'string' ? m : m.nome;
          const circ = typeof m === 'string' ? 1 : (m.circulo || 1);
          if (!todasMagias.find(t => t.nome === nome)) todasMagias.push({ nome, circulo: circ });
        });
      }
    }
  }

  // Carregar por circulo (agrupar pedidos)
  const circulosPedidos = new Set(todasMagias.map(m => m.circulo));
  const dadosPorCirculo = {};
  for (const circ of circulosPedidos) {
    const dados = await getMagiasPorCirculo(circ);
    if (dados?.magias) dadosPorCirculo[circ] = dados.magias;
  }

  // Montar cache
  todasMagias.forEach(m => {
    if (cache[m.nome]) return;
    const lista = dadosPorCirculo[m.circulo] || [];
    const magia = lista.find(x => x.nome === m.nome);
    if (magia) cache[m.nome] = magia;
  });

  return cache;
}

/**
 * Gera o HTML de uma magia expandida para impressao.
 */
function htmlMagiaImpressao(nome, circulo, cacheMagias, origemExtra) {
  const magia = cacheMagias[nome];
  const infoIdx = indiceMagiasCache?.find(m => m.nome === nome);

  let meta = '';
  let desc = '';
  let upcast = '';

  if (magia) {
    meta = [magia.escola, magia.tempo_conjuracao, magia.alcance, magia.componentes, magia.duracao]
      .filter(Boolean).join(' | ');
    desc = mdParaHtml(magia.descricao || '');
    if (magia.circulo_superior) {
      upcast = `<div class="print-spell-upcast"><strong>Circulos superiores:</strong> ${mdParaHtml(magia.circulo_superior)}</div>`;
    }
  } else if (infoIdx) {
    meta = [infoIdx.escola, infoIdx.tempo_conjuracao, infoIdx.alcance, infoIdx.duracao]
      .filter(Boolean).join(' | ');
  }

  const circLabel = circulo === 0 ? 'Truque' : `${circulo}º Círculo`;
  const origemBadge = origemExtra ? ` <span class="print-feature-badge">${origemExtra}</span>` : '';

  return `
    <div class="print-spell">
      <div class="print-spell-name">${nome} <span style="font-weight:400;font-size:7pt;color:#666">(${circLabel})</span>${origemBadge}</div>
      ${meta ? `<div class="print-spell-meta">${meta}</div>` : ''}
      ${desc ? `<div class="print-spell-desc"><div class="md-content">${desc}</div></div>` : ''}
      ${upcast}
    </div>
  `;
}

/**
 * Gera o HTML completo de impressao da ficha.
 */
async function gerarHtmlImpressao() {
  const info = CLASSES_INFO[char.classe] || {};
  const prof = bonusProficiencia(char.nivel);
  const ca = calcCA(char);
  const modCon = calcMod(char.atributos.constituicao);
  const iniciativa = getModIniciativa();
  const ataquesPorAcao = getAtaquesPorAcao();

  // Dados da especie
  const _espData = especiesCache?.especies?.find(e => e.nome === char.especie);
  const _deslocamentoBase = _espData ? getDeslocamento(_espData.texto_completo) : '9 metros';
  const _deslocamento = getDeslocamentoFinal(_deslocamentoBase);
  const _tamanho = char.tamanho || (_espData ? getTamanho(_espData.texto_completo) : 'Medio');

  // Pre-carregar descricoes de magias
  const cacheMagias = await carregarDescricoesMagias();

  // ===================== PAGINA 1 =====================
  let pag1 = '';

  // --- Cabecalho ---
  pag1 += `
    <div class="print-char-header">
      <div class="print-char-name">${char.nome || 'Sem Nome'}</div>
      <div class="print-char-sub">
        ${char.especie || ''} ${char.classe || ''} ${char.subclasse ? `(${char.subclasse})` : ''} &mdash; Nivel ${char.nivel}
        ${char.antecedente ? ` | Antecedente: ${char.antecedente}` : ''}
        ${char.alinhamento ? ` | ${char.alinhamento}` : ''}
      </div>
      <div class="print-char-sub">
        Tamanho: ${_tamanho}${(char.idiomas?.length) ? ' | Idiomas: ' + char.idiomas.join(', ') : ''}
      </div>
    </div>
  `;

  // --- HP ---
  pag1 += `
    <div class="print-hp-row">
      <div class="print-hp-item">
        <div class="print-hp-label">PV Atual</div>
        <div class="print-hp-value">${char.pv_atual ?? 0}</div>
      </div>
      <div class="print-hp-item">
        <div class="print-hp-label">PV Max</div>
        <div class="print-hp-value">${char.pv_max ?? 0}</div>
      </div>
      <div class="print-hp-item">
        <div class="print-hp-label">PV Temporario</div>
        <div class="print-hp-value">${char.pv_temp ?? 0}</div>
      </div>
      <div class="print-hp-item">
        <div class="print-hp-label">Dado de Vida</div>
        <div class="print-hp-value">${char.dados_vida_disponiveis ?? char.nivel}/${char.nivel} d${info.dado_vida || '?'}</div>
      </div>
    </div>
  `;

  // --- Stats de combate ---
  let statsHtml = `
    <div class="print-stat-box"><div class="print-stat-label">CA</div><div class="print-stat-value">${ca}</div></div>
    <div class="print-stat-box"><div class="print-stat-label">Iniciativa</div><div class="print-stat-value">${fmtMod(iniciativa.valor)}</div></div>
    <div class="print-stat-box"><div class="print-stat-label">Deslocamento</div><div class="print-stat-value">${_deslocamento}</div></div>
    <div class="print-stat-box"><div class="print-stat-label">Ataques</div><div class="print-stat-value">${ataquesPorAcao}</div></div>
    <div class="print-stat-box"><div class="print-stat-label">Proficiencia</div><div class="print-stat-value">+${prof}</div></div>
  `;
  if (info.conjurador) {
    statsHtml += `
      <div class="print-stat-box"><div class="print-stat-label">CD Magia</div><div class="print-stat-value">${calcCDMagia(char)}</div></div>
      <div class="print-stat-box"><div class="print-stat-label">Atq Magia</div><div class="print-stat-value">${fmtMod(calcAtaqueMagia(char))}</div></div>
    `;
  }
  pag1 += `<div class="print-stats-row">${statsHtml}</div>`;

  // --- Proficiencias de Armaduras e Armas ---
  {
    const extras = (char.proficiencias_extra || []).map(p => p.toLowerCase());
    const armadurasProf = [...(info.armaduras || [])];
    const armasProf = [...(info.armas || [])];
    const armadurasExtras = [];
    const armasExtras = [];
    for (const extra of extras) {
      if (extra === 'armadura pesada' && !armadurasProf.includes('Pesada')) { armadurasProf.push('Pesada'); armadurasExtras.push('Pesada'); }
      else if ((extra === 'armadura média' || extra === 'armadura media') && !armadurasProf.includes('Média')) { armadurasProf.push('Média'); armadurasExtras.push('Média'); }
      else if (extra === 'armadura leve' && !armadurasProf.includes('Leve')) { armadurasProf.push('Leve'); armadurasExtras.push('Leve'); }
      else if (extra === 'escudo' && !armadurasProf.includes('Escudo')) { armadurasProf.push('Escudo'); armadurasExtras.push('Escudo'); }
      else if (extra === 'armas marciais' && !armasProf.includes('Marcial')) { armasProf.push('Marcial'); armasExtras.push('Marcial'); }
      else if (extra === 'armas simples' && !armasProf.includes('Simples')) { armasProf.push('Simples'); armasExtras.push('Simples'); }
    }
    pag1 += `
      <div class="print-prof-row">
        <div class="print-prof-group">
          <span class="print-prof-label">Armaduras:</span>
          ${armadurasProf.length > 0
            ? armadurasProf.map(a => `<span class="print-prof-badge print-prof-armadura${armadurasExtras.includes(a) ? ' print-prof-extra' : ''}">${a}${armadurasExtras.includes(a) ? '*' : ''}</span>`).join('')
            : '<span class="print-prof-badge print-prof-nenhuma">Nenhuma</span>'
          }
        </div>
        <div class="print-prof-group">
          <span class="print-prof-label">Armas:</span>
          ${armasProf.map(a => `<span class="print-prof-badge print-prof-arma${armasExtras.includes(a) ? ' print-prof-extra' : ''}">${a}${armasExtras.includes(a) ? '*' : ''}</span>`).join('')}
        </div>
        ${armadurasExtras.length > 0 || armasExtras.length > 0 ? '<div class="print-prof-nota">* Concedida por subclasse/talento</div>' : ''}
      </div>
    `;
  }

  // --- Atributos ---
  pag1 += `
    <div class="print-section">
      <div class="print-section-title">Atributos</div>
      <div class="print-attr-grid">
        ${ATRIBUTOS_KEYS.map(key => {
          const nome = ATRIBUTOS_NOMES[key];
          const val = char.atributos[key];
          const mod = calcMod(val);
          return `
            <div class="print-attr-box">
              <div class="print-attr-name">${nome}</div>
              <div class="print-attr-mod">${fmtMod(mod)}</div>
              <div class="print-attr-val">${val}</div>
            </div>`;
        }).join('')}
      </div>
    </div>
  `;

  // --- Salvaguardas ---
  pag1 += `
    <div class="print-section">
      <div class="print-section-title">Salvaguardas</div>
      <div class="print-saves-grid">
        ${ATRIBUTOS_KEYS.map(key => {
          const nome = ATRIBUTOS_NOMES[key];
          const mod = calcMod(char.atributos[key]);
          const proficiente = (char.salvaguardas_proficientes || []).includes(nome);
          const bonus = mod + (proficiente ? prof : 0);
          return `
            <div class="print-save-item">
              <div class="print-save-prof ${proficiente ? 'ativo' : ''}"></div>
              <span class="print-save-bonus">${fmtMod(bonus)}</span>
              <span>${nome}</span>
            </div>`;
        }).join('')}
      </div>
    </div>
  `;

  // --- Sentidos passivos ---
  const percepcao = calcPercepcaoPassiva(char);
  const intuicao = calcIntuicaoPassiva(char);
  const investigacao = calcInvestigacaoPassiva(char);
  let visaoEscuro = '';
  if (especiesCache?.especies) {
    const esp = especiesCache.especies.find(e => e.nome === char.especie);
    if (esp?.tracos) {
      const tracoVE = esp.tracos.find(t => t.nome === 'Visao no Escuro' || t.nome === 'Visão no Escuro');
      if (tracoVE) {
        const matchAlc = tracoVE.descricao?.match(/alcance de (\d+)/i);
        visaoEscuro = matchAlc ? `${matchAlc[1]} m` : '18 m';
      }
      if ((char.tracos_escolhidos || []).includes('Drow')) visaoEscuro = '36 m';
    }
  }
  pag1 += `
    <div class="print-section">
      <div class="print-section-title">Sentidos Passivos</div>
      <div class="print-senses-grid">
        <div class="print-sense-item"><div class="print-sense-value">${percepcao}</div><div class="print-sense-label">Percepcao</div></div>
        <div class="print-sense-item"><div class="print-sense-value">${intuicao}</div><div class="print-sense-label">Intuicao</div></div>
        <div class="print-sense-item"><div class="print-sense-value">${investigacao}</div><div class="print-sense-label">Investigacao</div></div>
        ${visaoEscuro ? `<div class="print-sense-item"><div class="print-sense-value">${visaoEscuro}</div><div class="print-sense-label">Visao no Escuro</div></div>` : ''}
      </div>
    </div>
  `;

  // --- Defesas ---
  const resistencias = [...(char.resistencias || [])];
  const vulnerabilidades = char.vulnerabilidades || [];
  const imunidades = char.imunidades || [];
  if (resistencias.length > 0 || vulnerabilidades.length > 0 || imunidades.length > 0) {
    pag1 += `<div class="print-section"><div class="print-section-title">Defesas</div><div class="print-defenses">`;
    if (resistencias.length > 0) pag1 += `<div><strong>Resistencias:</strong> ${resistencias.join(', ')}</div>`;
    if (vulnerabilidades.length > 0) pag1 += `<div><strong>Vulnerabilidades:</strong> ${vulnerabilidades.join(', ')}</div>`;
    if (imunidades.length > 0) pag1 += `<div><strong>Imunidades:</strong> ${imunidades.join(', ')}</div>`;
    pag1 += `</div></div>`;
  }

  // --- Pericias ---
  const ordemAtributos = ['Forca', 'Destreza', 'Constituicao', 'Inteligencia', 'Sabedoria', 'Carisma'];
  pag1 += `
    <div class="print-section">
      <div class="print-section-title">Pericias</div>
      <div class="print-skills-grid">
        ${['Percepção','Intuição','Investigação','Religião','História','Prestidigitação','Furtividade','Persuasão','Atletismo','Medicina','Acrobacia','Enganação','Arcanismo','Sobrevivência','Natureza','Atuação','Intimidação','Lidar com Animais'].map(nome => {
          const p = PERICIAS.find(x => x.nome === nome);
          if (!p) return '';
          const proficiente = (char.pericias_proficientes || []).includes(p.nome);
          const expertise = (char.pericias_expertise || []).includes(p.nome);
          const bonus = calcBonusPericia(char, p.nome, {
            emFuria: false,
            forcaPrimordialAtiva: false
          });
          let profClass = '';
          if (expertise) profClass = 'expertise';
          else if (proficiente) profClass = 'ativo';
          return `
            <div class="print-skill-item">
              <div class="print-skill-prof ${profClass}"></div>
              <span class="print-skill-bonus">${fmtMod(bonus)}</span>
              <span class="print-skill-name">${p.nome}</span>
            </div>`;
        }).join('')}
      </div>
    </div>
  `;

  // --- Itens equipados ---
  const inv = char.inventario || [];
  const equipados = inv.filter(i => i.equipado && (i.quantidade ?? 1) > 0);
  if (equipados.length > 0) {
    pag1 += `<div class="print-section"><div class="print-section-title">Equipamento</div><div class="print-equip-list">`;
    equipados.forEach(item => {
      let detalhe = '';
      if (item.tipo === 'arma') {
        const props = item.dados?.propriedades || '';
        const dano = item.dados?.dano || '';
        detalhe = [dano, props].filter(Boolean).join(' | ');
      } else if (item.tipo === 'armadura') {
        detalhe = `CA: ${item.dados?.ca || '?'} | ${item.dados?.categoria || ''}`;
      } else if (item.tipo === 'escudo') {
        detalhe = `CA: ${item.dados?.ca || '?'}`;
      } else if (item.tipo === 'customizado') {
        const bca = parseInt(item.dados?.bonus_ca) || 0;
        const batq = parseInt(item.dados?.bonus_ataque) || 0;
        const parts = [];
        if (bca !== 0) parts.push(`CA ${bca > 0 ? '+' : ''}${bca}`);
        if (batq !== 0) parts.push(`Atq ${batq > 0 ? '+' : ''}${batq}`);
        if (item.dados?.dano) parts.push(item.dados.dano);
        detalhe = parts.join(' | ') || (item.descricao || '');
      }
      const qtd = (item.quantidade ?? 1) > 1 ? ` x${item.quantidade}` : '';
      pag1 += `
        <div class="print-equip-item">
          <span class="print-equip-name">${item.nome}${qtd}</span>
          <span class="print-equip-detail">${detalhe}</span>
        </div>`;
    });
    pag1 += `</div></div>`;
  }

  // ===================== PAGINA 2+ (Talentos, Caracteristicas, Tracos) =====================
  let pag2 = '';

  // --- Talentos ---
  if (char.talentos?.length) {
    const todosOsTalentos = [];
    if (talentosCache?.por_categoria) {
      Object.values(talentosCache.por_categoria).forEach(lista => lista.forEach(t => todosOsTalentos.push(t)));
    }

    pag2 += `<div class="print-section"><div class="print-section-title">Talentos</div>`;
    char.talentos.forEach(t => {
      const nome = typeof t === 'string' ? t : t.nome;
      let talentoData = todosOsTalentos.find(td => td.nome === nome);
      if (!talentoData) {
        const nomeBase = nome.replace(/\s*\(.*\)$/, '').trim();
        talentoData = todosOsTalentos.find(td => td.nome === nomeBase);
      }
      const descricao = talentoData?.descricao || '';
      const beneficios = talentoData?.beneficios || [];
      const catBadge = talentoData?.categoria ? `<span class="print-feature-badge">${talentoData.categoria}</span>` : '';

      let infoEscolhas = '';
      if (nome === 'Iniciado em Magia') {
        const instancias = char.iniciado_em_magia_instancias || [];
        if (instancias.length > 0) {
          infoEscolhas = instancias.map((im, idx) =>
            `<div style="margin-top:1mm;font-size:7.5pt;border:0.5px solid #ccc;padding:1mm 2mm;border-radius:2px">
              ${instancias.length > 1 ? `<strong>Instancia ${idx + 1}:</strong> ` : ''}
              <strong>Lista:</strong> ${im.lista} | <strong>Atributo:</strong> ${im.atributo || '—'}
              | <strong>Truques:</strong> ${(im.truques || []).join(', ') || '—'}
              | <strong>Magia:</strong> ${im.magia || '—'}
            </div>`
          ).join('');
        }
      }
      if (nome === 'Adepto Elemental') {
        const tipos = char.adepto_elemental_tipos || [];
        if (tipos.length > 0) {
          infoEscolhas = `<div style="margin-top:1mm;font-size:7.5pt"><strong>Dominio Elemental:</strong> ${tipos.join(', ')}</div>`;
        }
      }

      pag2 += `
        <div class="print-feature">
          <div class="print-feature-name">${nome} ${catBadge}</div>
          ${descricao ? `<div class="print-feature-desc"><div class="md-content">${mdParaHtml(descricao)}</div></div>` : ''}
          ${beneficios.length > 0 ? beneficios.map(b =>
            `<div class="print-feature-desc"><strong>${b.nome}:</strong> ${mdParaHtml(b.descricao)}</div>`
          ).join('') : ''}
          ${infoEscolhas}
        </div>`;
    });
    pag2 += `</div>`;
  }

  // --- Caracteristicas de Classe ---
  if (classeData?.caracteristicas?.length) {
    let feats = classeData.caracteristicas.filter(c => c.nivel <= char.nivel);

    // Filtrar features de subclasses nao selecionadas
    if (classeData.subclasses?.length) {
      const outrasSubclasses = classeData.subclasses.filter(s => s.nome !== char.subclasse);
      const featsOutras = new Set();
      outrasSubclasses.forEach(sc => (sc.caracteristicas || []).forEach(f => featsOutras.add(f.nome)));
      const featsSelecionada = new Set();
      if (char.subclasse) {
        const scAtual = classeData.subclasses.find(s => s.nome === char.subclasse);
        (scAtual?.caracteristicas || []).forEach(f => featsSelecionada.add(f.nome));
      }
      feats = feats.filter(f => !featsOutras.has(f.nome) || featsSelecionada.has(f.nome));
      if (char.subclasse) {
        const scAtual = classeData.subclasses.find(s => s.nome === char.subclasse);
        const featsSC = new Set((scAtual?.caracteristicas || []).filter(c => c.nivel <= char.nivel).map(c => `${c.nivel}|${c.nome}`));
        feats = feats.filter(f => !featsSC.has(`${f.nivel}|${f.nome}`));
      }
    }

    if (feats.length > 0) {
      pag2 += `<div class="print-section"><div class="print-section-title">Caracteristicas de Classe</div>`;
      feats.forEach(f => {
        // Para Ordem Divina/Primal, exibir somente a opcao selecionada
        let descPrint = f.descricao || '';
        if (f.nome === 'Ordem Divina' || f.nome === 'Ordem Primal') {
          const _chvOrd = f.nome === 'Ordem Divina' ? 'ordem_divina' : 'ordem_primal';
          const _ordEsc = char[_chvOrd] || char.escolhas_classe?.[_chvOrd]?.[0] || '';
          if (_ordEsc) {
            const _rxOrd = new RegExp(`\\*\\*${_ordEsc}\\.\\*\\*\\s*(.+?)(?=\\n\\*\\*|$)`, 's');
            const _mOrd = descPrint.match(_rxOrd);
            descPrint = _mOrd ? `**${_ordEsc}.** ${_mOrd[1].trim()}` : descPrint;
          }
        }
        pag2 += `
          <div class="print-feature">
            <div class="print-feature-name">${f.nome} <span style="font-weight:400;font-size:7pt;color:#666">(Nivel ${f.nivel})</span></div>
            ${descPrint ? `<div class="print-feature-desc"><div class="md-content">${mdParaHtml(descPrint)}</div></div>` : ''}
          </div>`;
      });
      pag2 += `</div>`;
    }
  }

  // --- Caracteristicas de Subclasse ---
  if (char.subclasse && classeData?.subclasses?.length) {
    const sc = classeData.subclasses.find(s => s.nome === char.subclasse);
    const feats = sc?.caracteristicas?.filter(c => c.nivel <= char.nivel) || [];
    if (feats.length > 0) {
      pag2 += `<div class="print-section"><div class="print-section-title">Subclasse &mdash; ${char.subclasse}</div>`;
      feats.forEach(f => {
        pag2 += `
          <div class="print-feature">
            <div class="print-feature-name">${f.nome} <span style="font-weight:400;font-size:7pt;color:#666">(Nivel ${f.nivel})</span></div>
            ${f.descricao ? `<div class="print-feature-desc"><div class="md-content">${mdParaHtml(f.descricao)}</div></div>` : ''}
          </div>`;
      });
      pag2 += `</div>`;
    }
  }

  // --- Tracos de Especie (usa multi-colunas para aproveitar espaco) ---
  if (_espData?.tracos?.length) {
    const tracosEscolhidos = char.tracos_escolhidos || [];
    let tracosMostrar = [..._espData.tracos];

    // Mesma logica de filtragem da ficha (renderSecaoTracosEspecie)
    const _TRACOS_PAI_PRINT = ['Ancestralidade Gigante', 'Linhagem Gnômica', 'Herança Dracônica', 'Linhagem Élfica', 'Legado Ínfero'];
    const _TRACOS_ESCOLHA_GOLIAS_PRINT = ['Arrepio do Gelo (Gigante do Gelo)', 'Queimadura de Fogo (Gigante de Fogo)', 'Resistência da Pedra (Gigante da Pedra)', 'Salto da Nuvem (Gigante das Nuvens)', 'Tombo da Colina (Gigante da Colina)', 'Trovão da Tempestade (Gigante da Tempestade)'];
    const _TRACOS_ESCOLHA_GNOMO_PRINT = ['Gnomo das Rochas', 'Gnomo do Bosque'];

    if (tracosEscolhidos.length > 0) {
      tracosMostrar = _espData.tracos.filter(t => {
        // Remover tracos-pai (sao substituidos pelo traco sintetico ou pela escolha)
        if (_TRACOS_PAI_PRINT.includes(t.nome)) return false;
        // Golias/Gnomo: manter apenas o traco escolhido
        if (_TRACOS_ESCOLHA_GOLIAS_PRINT.includes(t.nome) || _TRACOS_ESCOLHA_GNOMO_PRINT.includes(t.nome)) {
          return tracosEscolhidos.includes(t.nome);
        }
        return true;
      });

      // Filtrar sub-tracos nao escolhidos (Tiferino, Elfo, Draconato)
      if (SUBTRACOS_ESPECIE[char.especie]) {
        const opcoes = SUBTRACOS_ESPECIE[char.especie];
        const escolhido = tracosEscolhidos.find(e => opcoes[e]);
        if (escolhido) {
          const naoEscolhidos = Object.keys(opcoes).filter(k => k !== escolhido);
          tracosMostrar = tracosMostrar.filter(t => !naoEscolhidos.some(ne => t.nome.includes(ne)));
        }
      }

      // Adicionar traco sintetico para especies com opcoes (Tiferino, Elfo, Draconato)
      const tracoSintetico = gerarTracoSinteticoEspecie(char.especie, tracosEscolhidos, char.nivel);
      if (tracoSintetico) {
        tracosMostrar.push(tracoSintetico);
      }
    }

    // Filtrar por nivel
    tracosMostrar = tracosMostrar.filter(t => {
      if (typeof t.nivel_minimo === 'number' && char.nivel < t.nivel_minimo) return false;
      const match = t.descricao?.match(/(?:a partir do |no )n[ií]vel (\d+)/i);
      if (match) return char.nivel >= parseInt(match[1]);
      return true;
    });

    if (tracosMostrar.length > 0) {
      pag2 += `<div class="print-section"><div class="print-section-title">Tracos de Especie &mdash; ${char.especie}</div><div class="print-multi-col">`;
      tracosMostrar.forEach(t => {
        pag2 += `
          <div class="print-feature">
            <div class="print-feature-name">${t.nome}</div>
            ${t.descricao ? `<div class="print-feature-desc"><div class="md-content">${mdParaHtml(t.descricao)}</div></div>` : ''}
          </div>`;
      });
      pag2 += `</div></div>`;
    }
  }

  // ===================== PAGINAS DE MAGIAS =====================
  let pagMagias = '';
  const temMagias = info.conjurador || ehSubclasseConjuradora() || (char.magias_conhecidas?.length > 0) || (char.magias_preparadas?.length > 0);

  if (temMagias) {
    // Espacos de magia
    const espacos = char.espacos_magia || {};
    if (Object.keys(espacos).length > 0) {
      pagMagias += `<div class="print-section"><div class="print-section-title">Espacos de Magia</div>`;
      pagMagias += `<div style="display:flex;gap:4mm;flex-wrap:wrap;margin-bottom:2mm">`;
      Object.entries(espacos).forEach(([circ, data]) => {
        const restantes = data.total - (data.usados || 0);
        pagMagias += `<div style="text-align:center"><div style="font-weight:700;font-size:10pt">${restantes}/${data.total}</div><div style="font-size:6.5pt;color:#666">${circ}º Círculo</div></div>`;
      });
      pagMagias += `</div></div>`;
    }

    // Bruxo: slots de pacto
    if (char.classe === 'Bruxo') {
      const estadoBruxo = getEstadoRecursosBruxo();
      if (estadoBruxo) {
        const slotsBruxo = estadoBruxo.slotsTotal || 0;
        const usadosBruxo = char.bruxo_slots_usados || 0;
        const restBruxo = slotsBruxo - usadosBruxo;
        const circBruxo = estadoBruxo.slotsCirculo || 1;
        pagMagias += `<div style="font-size:8pt;margin-bottom:2mm"><strong>Espaços de Pacto:</strong> ${restBruxo}/${slotsBruxo} (${circBruxo}º Círculo)</div>`;
      }
    }

    // Truques - usar layout em colunas para melhor aproveitamento
    const todosTruques = (char.magias_conhecidas || []).filter(m => m.circulo === 0);
    if (todosTruques.length > 0) {
      pagMagias += `<div class="print-section"><div class="print-section-title">Truques</div><div class="print-multi-col">`;
      todosTruques.forEach(m => {
        const origem = rotuloOrigemMagia(m);
        pagMagias += htmlMagiaImpressao(m.nome, 0, cacheMagias, origem);
      });
      pagMagias += `</div></div>`;
    }

    // Magias do Pacto do Tomo (Bruxo)
    if (char.classe === 'Bruxo') {
      const estado = getEstadoRecursosBruxo();
      if (estado?.pacto === 'Pacto do Tomo') {
        const truquesPacto = char.recursos?.bruxo?.livro_sombras?.truques || [];
        const rituaisPacto = char.recursos?.bruxo?.livro_sombras?.rituais || [];

        if (truquesPacto.length > 0) {
          pagMagias += `<div class="print-section"><div class="print-section-title">Livro das Sombras - Truques</div><div class="print-multi-col">`;
          truquesPacto.forEach(nome => {
            pagMagias += htmlMagiaImpressao(nome, 0, cacheMagias, 'Livro das Sombras');
          });
          pagMagias += `</div></div>`;
        }

        if (rituaisPacto.length > 0) {
          pagMagias += `<div class="print-section"><div class="print-section-title">Livro das Sombras - Rituais</div><div class="print-multi-col">`;
          rituaisPacto.forEach(r => {
            const nome = typeof r === 'string' ? r : r.nome;
            const circ = typeof r === 'string' ? 1 : (r.circulo || 1);
            pagMagias += htmlMagiaImpressao(nome, circ, cacheMagias, 'Ritual');
          });
          pagMagias += `</div></div>`;
        }
      }
    }

    // Magias preparadas por circulo
    const preparadas = char.magias_preparadas || [];
    const preparadasPorCirculo = {};
    preparadas.forEach(m => {
      const circ = m.circulo || 1;
      if (!preparadasPorCirculo[circ]) preparadasPorCirculo[circ] = [];
      preparadasPorCirculo[circ].push(m);
    });

    Object.keys(preparadasPorCirculo).sort((a, b) => parseInt(a) - parseInt(b)).forEach(circ => {
      const magias = preparadasPorCirculo[circ];
      pagMagias += `<div class="print-section"><div class="print-section-title">${circ}º Círculo (${magias.length} magias)</div><div class="print-multi-col">`;
      magias.forEach(m => {
        const origem = rotuloOrigemMagia(m);
        pagMagias += htmlMagiaImpressao(m.nome, parseInt(circ), cacheMagias, origem);
      });
      pagMagias += `</div></div>`;
    });

    // Magias customizadas
    const customizadas = char.magias_customizadas || [];
    if (customizadas.length > 0) {
      pagMagias += `<div class="print-section"><div class="print-section-title">Magias Customizadas</div><div class="print-multi-col">`;
      customizadas.forEach(m => {
        const circLabel = m.circulo === 0 ? 'Truque' : `${m.circulo}º Círculo`;
        pagMagias += `
          <div class="print-spell">
            <div class="print-spell-name">${m.nome} <span style="font-weight:400;font-size:7pt;color:#666">(${circLabel})</span></div>
            ${m.escola ? `<div class="print-spell-meta">${m.escola}${m.tempo_conjuracao ? ' | ' + m.tempo_conjuracao : ''}${m.alcance ? ' | ' + m.alcance : ''}${m.duracao ? ' | ' + m.duracao : ''}</div>` : ''}
            <div class="print-spell-desc"><div class="md-content">${mdParaHtml(m.descricao || '')}</div></div>
          </div>`;
      });
      pagMagias += `</div></div>`;
    }
  }

  // ===================== ULTIMAS PAGINAS (Inventario + Detalhes) =====================
  let pagFinal = '';

  // --- Inventario (itens NAO equipados) ---
  const naoEquipados = inv.filter(i => !i.equipado && (i.quantidade ?? 1) > 0);
  if (naoEquipados.length > 0 || (char.po ?? 0) > 0) {
    pagFinal += `<div class="print-section"><div class="print-section-title">Inventario (Mochila)</div>`;
    if ((char.po ?? 0) > 0) {
      pagFinal += `<div style="font-size:8.5pt;font-weight:700;margin-bottom:1mm">Ouro: ${char.po} PO</div>`;
    }
    naoEquipados.forEach(item => {
      let detalhe = '';
      if (item.tipo === 'arma') detalhe = [item.dados?.dano, item.dados?.propriedades].filter(Boolean).join(' | ');
      else if (item.tipo === 'armadura') detalhe = `CA: ${item.dados?.ca || '?'} | ${item.dados?.categoria || ''}`;
      else if (item.tipo === 'escudo') detalhe = `CA: ${item.dados?.ca || '?'}`;
      else if (item.tipo === 'equipamento') detalhe = [item.dados?.custo, item.dados?.peso].filter(Boolean).join(' | ');
      else if (item.tipo === 'customizado') detalhe = item.descricao || '';
      else detalhe = item.descricao || '';
      const qtd = (item.quantidade ?? 1) > 1 ? ` (x${item.quantidade})` : '';
      pagFinal += `
        <div class="print-inv-item">
          <span class="print-inv-name">${item.nome}${qtd}</span>
          <span class="print-inv-detail">${detalhe}</span>
        </div>`;
    });
    pagFinal += `</div>`;
  }

  // --- Detalhes pessoais ---
  const camposDetalhe = [
    { key: 'aparencia', label: 'Aparencia' },
    { key: 'personalidade', label: 'Personalidade' },
    { key: 'ideais', label: 'Ideais' },
    { key: 'lacos', label: 'Lacos' },
    { key: 'defeitos', label: 'Defeitos' },
    { key: 'historia_personagem', label: 'Historia' },
    { key: 'notas', label: 'Notas' }
  ];
  const camposPreenchidos = camposDetalhe.filter(c => char[c.key]);
  if (camposPreenchidos.length > 0) {
    pagFinal += `<div class="print-section"><div class="print-section-title">Detalhes</div>`;
    camposPreenchidos.forEach(c => {
      pagFinal += `
        <div class="print-detail-field">
          <div class="print-detail-label">${c.label}</div>
          <div class="print-detail-value">${char[c.key]}</div>
        </div>`;
    });
    pagFinal += `</div>`;
  }

  // ===================== MONTAR PAGINAS =====================
  // Pagina 1 sempre sozinha
  let html = `<div class="print-page">${pag1}</div>`;

  // Magias vem antes de talentos/caracteristicas para referencia rapida
  if (pagMagias) {
    html += `<div class="print-page">${pagMagias}</div>`;
  }

  // Talentos, caracteristicas, tracos de especie
  if (pag2) {
    html += `<div class="print-page">${pag2}</div>`;
  }

  // Paginas finais: inventario + detalhes
  if (pagFinal) {
    html += `<div class="print-page">${pagFinal}</div>`;
  }

  return html;
}

/**
 * Prepara e executa a impressao da ficha de personagem.
 * Gera um overlay dedicado com layout otimizado para impressao.
 */
let _printOverlayAtivo = false;
async function imprimirFicha() {
  // Evitar dupla invocacao
  if (_printOverlayAtivo) {
    // Se o overlay anterior ficou preso, limpar e continuar
    const velho = document.getElementById('print-overlay');
    if (velho) velho.remove();
    _printOverlayAtivo = false;
  }

  toast('Preparando impressao...', 'info');

  try {
    const html = await gerarHtmlImpressao();

    // Criar overlay de impressao
    const overlay = document.createElement('div');
    overlay.id = 'print-overlay';
    overlay.innerHTML = html;
    document.body.appendChild(overlay);
    _printOverlayAtivo = true;

    // Funcao de limpeza reutilizavel
    const limparOverlay = () => {
      const el = document.getElementById('print-overlay');
      if (el) el.remove();
      _printOverlayAtivo = false;
      // Remover listeners para evitar acumulo
      window.removeEventListener('afterprint', limparOverlay);
    };

    // Registrar cleanup ANTES de chamar window.print()
    window.addEventListener('afterprint', limparOverlay);

    // Aguardar renderizacao do DOM
    await new Promise(r => setTimeout(r, 200));

    // Imprimir
    window.print();

    // Fallback: se afterprint nao disparar em 5s, limpar manualmente
    setTimeout(() => {
      if (_printOverlayAtivo) limparOverlay();
    }, 5000);
  } catch (err) {
    console.error('Erro ao preparar impressao:', err);
    toast('Erro ao preparar impressao', 'danger');
    // Limpar overlay em caso de erro
    const el = document.getElementById('print-overlay');
    if (el) el.remove();
    _printOverlayAtivo = false;
  }
}
