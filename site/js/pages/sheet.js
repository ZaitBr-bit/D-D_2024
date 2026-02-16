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
  return magia?.origem !== 'dominio' && magia?.origem !== 'sempre';
}

function magiaEhEspecial(magia) {
  return !magiaContaNoLimite(magia);
}

function rotuloOrigemMagia(magia) {
  if (magia?.origem === 'dominio') return 'Domínio';
  if (magia?.origem === 'sempre') return 'Sempre Preparada';
  return '';
}

function ehBardoComSegredosMagicos() {
  return char?.classe === 'Bardo' && (char?.nivel || 1) >= 10;
}

function temArmaduraPesadaEquipada() {
  const inv = char?.inventario || [];
  return inv.some(i => i.equipado && i.tipo === 'armadura' && (i.dados?.categoria || '').toLowerCase() === 'pesada');
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

  return {
    ativa: !!char.recursos.furia_ativa,
    usosGastos: char.recursos.furia_usos_gastos,
    usosMax: prog.furiasMax,
    usosDisponiveis,
    dano: prog.danoFuria,
    maestriasMax: prog.maestriasMax
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
    exaustao: Math.max(0, char.exaustao || 0)
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

  return {
    astuciaUsada: !!char.recursos.bruxo.astucia_usada,
    pacto: char.recursos.bruxo.pacto || '',
    invocacoes: char.recursos.bruxo.invocacoes,
    invocacoesMax: progressao.invocacoesMax,
    arcanum: char.recursos.bruxo.arcanum,
    circulosArcanum,
    mestreMisticoAtivo: (char.nivel || 1) >= 20
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

  const prog = getProgressaoDruida() || { formaSelvagemMax: 0 };
  const usosDisponiveis = Math.max(0, prog.formaSelvagemMax - char.recursos.druida.forma_selvagem_usos_gastos);

  return {
    formaSelvagemAtiva: !!char.recursos.druida.forma_selvagem_ativa,
    companheiroSelvagemAtivo: !!char.recursos.druida.companheiro_selvagem_ativo,
    usosGastos: char.recursos.druida.forma_selvagem_usos_gastos,
    usosMax: prog.formaSelvagemMax,
    usosDisponiveis,
    ressurgimentoSlotRecuperadoHoje: !!char.recursos.druida.ressurgimento_slot_recuperado_hoje,
    arquidruidaAtivo: (char.nivel || 1) >= 20,
    ressurgimentoAtivo: (char.nivel || 1) >= 5
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
    if (nome) opcoes.push({ nome, prerequisito, repetivel });
  }

  return opcoes;
}

function avaliarPrerequisitoInvocacaoBruxo(prerequisito) {
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

  const estado = getEstadoRecursosBruxo();
  const pacto = estado?.pacto || '';
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

  return { ok, motivo: motivos.join(', ') };
}

function abrirModalRecursosBruxo() {
  if (char?.classe !== 'Bruxo') return;
  const estado = getEstadoRecursosBruxo();
  const opcoes = extrairOpcoesInvocacoesBruxo();
  const mapaOpcoes = new Map(opcoes.map(o => [semAcento(o.nome), o]));

  abrirModal('Recursos do Bruxo', `
    <div class="form-group">
      <label class="form-label">Pacto</label>
      <select class="form-select" id="bruxo-pacto">
        <option value="">Não selecionado</option>
        <option value="Pacto da Lâmina" ${estado.pacto === 'Pacto da Lâmina' ? 'selected' : ''}>Pacto da Lâmina</option>
        <option value="Pacto da Corrente" ${estado.pacto === 'Pacto da Corrente' ? 'selected' : ''}>Pacto da Corrente</option>
        <option value="Pacto do Tomo" ${estado.pacto === 'Pacto do Tomo' ? 'selected' : ''}>Pacto do Tomo</option>
      </select>
    </div>

    <div class="form-group">
      <label class="form-label">Invocações Místicas (${estado.invocacoes.length}/${estado.invocacoesMax})</label>
      <textarea class="form-textarea" id="bruxo-invocacoes" rows="6" placeholder="Uma invocação por linha">${estado.invocacoes.join('\n')}</textarea>
      <div style="font-size:0.75rem;color:var(--text-muted)">Pré-requisitos conhecidos são validados automaticamente (nível e pacto). Duplicatas só são aceitas quando a invocação é Repetível.</div>
    </div>

    <div class="section-divider"><span>Arcana Mística</span></div>
    ${[6, 7, 8, 9].map(c => {
      const desbloqueado = estado.circulosArcanum.includes(c);
      const dado = estado.arcanum[c] || { magia: '', usado: false };
      return `
        <div class="form-group" style="opacity:${desbloqueado ? 1 : 0.5}">
          <label class="form-label">${c}º círculo ${desbloqueado ? '' : '(bloqueado)'}</label>
          <input class="form-input" id="bruxo-arcanum-${c}" ${desbloqueado ? '' : 'disabled'} value="${dado.magia || ''}" placeholder="Nome da magia de arcanum">
        </div>
      `;
    }).join('')}
  `,
  '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-primary" id="btn-salvar-bruxo-recursos">Salvar</button>');

  document.getElementById('btn-salvar-bruxo-recursos')?.addEventListener('click', () => {
    const novoPacto = document.getElementById('bruxo-pacto')?.value || '';
    const invTexto = document.getElementById('bruxo-invocacoes')?.value || '';
    const invLinhas = invTexto.split('\n').map(v => v.trim()).filter(Boolean);

    if (invLinhas.length > estado.invocacoesMax) {
      toast(`Você pode ter no máximo ${estado.invocacoesMax} invocações neste nível.`, 'error');
      return;
    }

    const usadas = new Map();
    for (const nome of invLinhas) {
      const chave = semAcento(nome);
      const opcao = mapaOpcoes.get(chave);
      if (!opcao) {
        toast(`Invocação não reconhecida: ${nome}`, 'error');
        return;
      }

      const ja = usadas.get(chave) || 0;
      if (ja >= 1 && !opcao.repetivel) {
        toast(`A invocação ${opcao.nome} não é repetível.`, 'error');
        return;
      }

      const validacao = avaliarPrerequisitoInvocacaoBruxo(opcao.prerequisito);
      if (!validacao.ok) {
        toast(`Pré-requisito não atendido para ${opcao.nome}: ${validacao.motivo}`, 'error');
        return;
      }

      usadas.set(chave, ja + 1);
    }

    char.recursos.bruxo.pacto = novoPacto;
    char.recursos.bruxo.invocacoes = invLinhas;

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
    metabolismoUsado: r.metabolismo_usado
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

  return {
    nivel,
    recuperacaoArcanaMax,
    recuperacaoArcanaUsada: r.recuperacao_arcana_usada,
    memorizarMagiaAtivo,
    maestriaMagiasAtiva,
    assinaturaMagicaAtiva,
    assinatura1Usada: r.assinatura_magia_1_usada,
    assinatura2Usada: r.assinatura_magia_2_usada
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

  return `${String(final).replace('.', ',')} metros`;
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
  magiasSempreCache = await obterTodasMagiasSemprePreparadas(char.classe, char.subclasse, char.nivel);
  migrarMagiasDominio();
  migrarMagiasSemprePreparadas();
  migrarEscolhasClasseLegadas();

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

  // Higienização de legado: remove entradas inválidas de "sempre" no Guardião
  // que tenham sido salvas por parsing antigo de markdown.
  if (char.classe === 'Guardião') {
    char.magias_preparadas = char.magias_preparadas.filter(m => {
      if (m?.origem !== 'sempre') return true;
      if (nomesSempre.has(m.nome)) return true;
      alterado = true;
      return false;
    });
  }

  char.magias_preparadas.forEach(m => {
    if (nomesSempre.has(m.nome) && m.origem !== 'dominio' && m.origem !== 'sempre') {
      m.origem = 'sempre';
      alterado = true;
    }
  });
  if (alterado) salvar();
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
          <div style="font-size:0.8rem;color:var(--text-muted)">Antecedente: ${char.antecedente || '–'}</div>
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
      <!-- Inspiração Heroica -->
      <div class="info-box ${char.inspiracao_heroica ? 'success' : 'info'}" style="margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
        <div style="font-size:0.85rem">
          <strong>Inspiração Heroica:</strong> ${char.inspiracao_heroica ? 'Disponível' : 'Indisponível'}
        </div>
        <div class="no-print" style="display:flex;gap:6px;align-items:center">
          ${char.inspiracao_heroica
            ? '<button class="btn btn-sm btn-accent" id="btn-usar-inspiracao-heroica">Usar (d20 extra)</button>'
            : '<button class="btn btn-sm btn-secondary" id="btn-ganhar-inspiracao-heroica">Conceder</button>'}
        </div>
      </div>

      ${estadoFuria ? `
        <div class="info-box ${estadoFuria.ativa ? 'danger' : 'info'}" style="margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
          <div style="font-size:0.85rem">
            <strong>Fúria:</strong> ${estadoFuria.ativa ? 'Ativa' : 'Inativa'}
            &nbsp;|&nbsp; Usos: ${estadoFuria.usosDisponiveis}/${estadoFuria.usosMax}
            &nbsp;|&nbsp; Dano: +${estadoFuria.dano}
            ${temArmaduraPesadaEquipada() ? '&nbsp;|&nbsp;<span style="color:var(--danger)">Armadura pesada equipada</span>' : ''}
          </div>
          <div class="no-print" style="display:flex;gap:6px;align-items:center">
            <button class="btn btn-sm ${estadoFuria.ativa ? 'btn-secondary' : 'btn-danger'}" data-furia-toggle="${estadoFuria.ativa ? 'desativar' : 'ativar'}">
              ${estadoFuria.ativa ? 'Encerrar Fúria' : 'Entrar em Fúria'}
            </button>
            ${char.nivel >= 15 ? `<button class="btn btn-sm btn-secondary" data-furia-iniciativa="1">Rolar Iniciativa (recuperar Fúrias)</button>` : ''}
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
          const incapacitado = (char.condicoes || []).includes('Incapacitado');
          const vantagemFuria = nome === 'Força' && !!getEstadoFuria()?.ativa;
          const vantagemSentidoPerigo = nome === 'Destreza' && char.classe === 'Bárbaro' && char.nivel >= 2 && !incapacitado;
          const temVantagem = vantagemFuria || vantagemSentidoPerigo;
          return `
            <div class="salva-item ${proficiente ? 'proficiente' : ''}">
              <div class="pericia-prof ${proficiente ? 'ativo' : ''}"></div>
              <span class="pericia-bonus">${fmtMod(bonus)}</span>
              <span class="pericia-nome">${nome}${temVantagem ? ' <span style="font-size:0.65rem;color:var(--success);font-weight:700">(Vant.)</span>' : ''}</span>
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

    <!-- Perícias agrupadas por atributo -->
    <div class="card">
      <div class="card-header"><h2>Pericias</h2></div>
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
                  const bonus = calcBonusPericia(char, p.nome, {
                    emFuria: !!getEstadoFuria()?.ativa,
                    forcaPrimordialAtiva: forcaPrimordialAtiva()
                  });
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
    ${(info.conjurador || ehSubclasseConjuradora() || getTruquesExtraEstiloLuta() > 0) ? renderSecaoMagias() : ''}

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
  setupEventosCondicoes();
  setupEventosDefesas();

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
  // Inspiração Heroica
  document.getElementById('btn-usar-inspiracao-heroica')?.addEventListener('click', () => {
    char.inspiracao_heroica = false;
    salvar();
    renderFichaCompleta();
    toast('Inspiração Heroica usada! Role um d20 adicional.', 'success');
  });
  document.getElementById('btn-ganhar-inspiracao-heroica')?.addEventListener('click', () => {
    char.inspiracao_heroica = true;
    salvar();
    renderFichaCompleta();
    toast('Inspiração Heroica concedida!', 'success');
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
    }

    // Bardo: a partir do nível 5, descanso curto restaura todos os usos
    if (char.classe === 'Bardo' && (char.nivel || 1) >= 5) {
      if (!char.recursos) char.recursos = {};
      char.recursos.inspiracao_bardo_usos_gastos = 0;
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

    // Bárbaro: descanso longo restaura todos os usos e encerra Fúria
    if (char.classe === 'Bárbaro') {
      if (!char.recursos) char.recursos = {};
      char.recursos.furia_usos_gastos = 0;
      char.recursos.furia_ativa = false;
      char.recursos.furia_persistente_usada = false;
    }

    // Bardo: descanso longo restaura todos os usos de Inspiração
    if (char.classe === 'Bardo') {
      if (!char.recursos) char.recursos = {};
      char.recursos.inspiracao_bardo_usos_gastos = 0;
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
      }
      if (typeof char.exaustao !== 'number') char.exaustao = 0;
      char.exaustao = Math.max(0, char.exaustao - 1);
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
      }
    }

    // Monge: descanso longo restaura pontos de foco e metabolismo
    if (char.classe === 'Monge') {
      const estado = getEstadoRecursosMonge();
      if (estado) {
        char.recursos.monge.pontos_foco_gastos = 0;
        char.recursos.monge.metabolismo_usado = false;
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
      }
    }

    // Inspiração Heroica: Humanos (traço "Eficiente") ganham no descanso longo
    if (char.especie === 'Humano') {
      char.inspiracao_heroica = true;
    }

    salvar();

    // Verificar se a classe tem Maestria em Arma e/ou troca de magias preparadas
    const infoClasse = CLASSES_INFO[char.classe] || {};
    const classesMaestria = ['Bárbaro', 'Guerreiro', 'Guardião', 'Paladino', 'Ladino'];
    const temMaestria = classesMaestria.includes(char.classe);
    const temTrocaMagia = (infoClasse.conjurador && infoClasse.tipo_conjuracao === 'preparadas') || ehSubclasseConjuradora();

    if (temMaestria || temTrocaMagia) {
      // Montar conteúdo do modal conforme opções disponíveis
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
        conteudoModal += `
          <p style="font-size:0.9rem">Deseja trocar suas magias preparadas?</p>
          <p style="font-size:0.8rem;color:var(--text-muted)">
            Como ${char.classe}, você pode alterar sua lista de magias preparadas após um Descanso Longo.
          </p>
        `;
      }

      let botoesModal = '<button class="btn btn-secondary" id="btn-pular-troca-dl">Manter Tudo</button>';
      if (temMaestria) {
        botoesModal += '<button class="btn btn-accent" id="btn-trocar-maestrias-dl">Trocar Maestrias</button>';
      }
      if (temTrocaMagia) {
        botoesModal += '<button class="btn btn-primary" id="btn-trocar-magias-dl">Trocar Magias</button>';
      }

      abrirModal('Descanso Longo Concluído', conteudoModal, botoesModal);

      document.getElementById('btn-pular-troca-dl')?.addEventListener('click', () => {
        window.fecharModal();
        renderFichaCompleta();
      });
      document.getElementById('btn-trocar-maestrias-dl')?.addEventListener('click', async () => {
        window.fecharModal();
        // Após trocar maestrias, oferecer troca de magias se disponível
        await abrirModalTrocaMaestriaDescanso(temTrocaMagia ? () => mostrarTrocaMagias() : null);
      });
      document.getElementById('btn-trocar-magias-dl')?.addEventListener('click', () => {
        window.fecharModal();
        // Após trocar magias, oferecer troca de maestrias se disponível
        mostrarTrocaMagias(temMaestria ? () => abrirModalTrocaMaestriaDescanso() : null);
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
        abrirModal('Opções de Metamagia', `
          <div class="form-group">
            <label class="form-label" for="metamagias-texto">Uma opção por linha</label>
            <textarea class="form-textarea" id="metamagias-texto" rows="8" placeholder="Ex: Magia Acelerada">${(estado.metamagias || []).join('\n')}</textarea>
          </div>
        `, '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-primary" id="btn-salvar-metamagia">Salvar</button>');

        document.getElementById('btn-salvar-metamagia')?.addEventListener('click', () => {
          const linhas = (document.getElementById('metamagias-texto')?.value || '').split('\n').map(v => v.trim()).filter(Boolean);
          char.recursos.feiticeiro.metamagias = linhas;
          salvar();
          window.fecharModal();
          renderFichaCompleta();
        });
        return;
      }

      if (acao === 'metamagia-gastar') {
        abrirModal('Gastar Pontos de Feitiçaria', `
          <div class="form-group">
            <label class="form-label" for="metamagia-custo">Custo em PF</label>
            <input type="number" class="form-input" id="metamagia-custo" value="1" min="1" max="20">
          </div>
        `, '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-primary" id="btn-gastar-metamagia">Gastar</button>');

        document.getElementById('btn-gastar-metamagia')?.addEventListener('click', () => {
          const custo = Math.max(1, parseInt(document.getElementById('metamagia-custo')?.value) || 1);
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
        abrirModal('Revelação em Carne', `
          <div class="form-group">
            <label class="form-label" for="revelacao-custo">Pontos de Feitiçaria gastos</label>
            <input type="number" class="form-input" id="revelacao-custo" value="1" min="1" max="10">
          </div>
        `, '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-primary" id="btn-revelacao-carne">Ativar</button>');
        document.getElementById('btn-revelacao-carne')?.addEventListener('click', () => {
          const custo = Math.max(1, parseInt(document.getElementById('revelacao-custo')?.value) || 1);
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
        abrirModal('Bastião da Lei', `
          <div class="form-group">
            <label class="form-label" for="bastiao-custo">PF gastos (1 a 5)</label>
            <input type="number" class="form-input" id="bastiao-custo" value="1" min="1" max="5">
          </div>
        `, '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-primary" id="btn-bastiao-lei">Criar</button>');
        document.getElementById('btn-bastiao-lei')?.addEventListener('click', () => {
          const custo = Math.max(1, Math.min(5, parseInt(document.getElementById('bastiao-custo')?.value) || 1));
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
          <div style="margin-bottom:12px">
            <label style="font-size:0.85rem;font-weight:600">Quantidade de PV a restaurar:</label>
            <input type="number" id="maos-consagradas-qtd" min="1" max="${estado.maosAtuais}" value="1" style="width:100%;padding:8px;border-radius:var(--radius);border:1px solid var(--border);margin-top:4px">
          </div>
          <div style="font-size:0.8rem;color:var(--text-muted)">
            Remover Envenenado: gasta 5 PV da reserva sem restaurar PV.
            ${estado.toqueRestauradorAtivo ? '<br>Toque Restaurador: remover condição por 5 PV adicionais.' : ''}
          </div>
        `, `
          <button class="btn btn-secondary" onclick="window.fecharModal()">Cancelar</button>
          <button class="btn btn-accent" id="btn-maos-confirmar">Curar</button>
          <button class="btn btn-primary" id="btn-maos-envenenado" ${estado.maosAtuais < 5 ? 'disabled style="opacity:0.5"' : ''}>Remover Envenenado (5 PV)</button>
        `);
        document.getElementById('btn-maos-confirmar')?.addEventListener('click', () => {
          const qtd = Math.min(parseInt(document.getElementById('maos-consagradas-qtd')?.value) || 1, estado.maosAtuais);
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
      } else {
        char.recursos.furia_ativa = false;
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
    const tipoConj = info.tipo_conjuracao || 'preparadas';
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
    const tipoConj = info.tipo_conjuracao || 'preparadas';
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
  let recarga = detectarRecarga(f.descricao);
  // Features that are purely descriptive should always be passive
  const nomeNorm = semAcento(f.nome);
  const ativa = nomeNorm.includes('conjuracao') ? false : ehHabilidadeAtiva(f.descricao);
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

  // Druida: deteccao de Forma Selvagem para handler dedicado
  const ehFormaSelvagem = char.classe === 'Druida' && f.nome === 'Forma Selvagem';
  const estadoDruida = ehFormaSelvagem ? getEstadoRecursosDruida() : null;

  // Bardo: deteccao de Inspiracao de Bardo para handler dedicado
  const ehInspiracaoBardo = char.classe === 'Bardo' && f.nome === 'Inspiração de Bardo';
  const estadoInspiracaoBardo = ehInspiracaoBardo ? getEstadoInspiracaoBardo() : null;

  // Bruxo: deteccao de Astucia Magica para handler dedicado
  const ehAstuciaBruxo = char.classe === 'Bruxo' && f.nome === 'Astúcia Mágica';
  const estadoBruxoFeature = ehAstuciaBruxo ? getEstadoRecursosBruxo() : null;

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
    ehTrapacaBencao || ehTrapacaInvocar || ehVidaPreservar
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

    // Evita duplicidade com seção de subclasse ativa
    if (char.subclasse) {
      const scAtual = classeData.subclasses.find(s => s.nome === char.subclasse);
      const featsSC = new Set((scAtual?.caracteristicas || []).filter(c => c.nivel <= char.nivel).map(c => `${c.nivel}|${c.nome}`));
      feats = feats.filter(f => !featsSC.has(`${f.nivel}|${f.nome}`));
    }
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
  const subConj = getSubclasseConjuradoraConjuracao();
  const tipoConj = info.tipo_conjuracao || (subConj ? 'preparadas' : 'preparadas');
  const truques = (char.magias_conhecidas || []).filter(m => m.circulo === 0);
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
                      ${ehEspecial ? `<span class="badge-dominio" title="${origemLabel}">&#9733;</span> ` : ''}${m.nome}
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
                    <button class="btn btn-sm ${todosEsgotados ? 'btn-secondary' : 'btn-primary'}" data-conjurar="${m.nome}" data-conj-circ="${m.circulo}" ${todosEsgotados ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Conjurar</button>
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
                  <button class="btn btn-sm btn-primary" data-conjurar="${m.nome}" data-conj-circ="0">Conjurar</button>
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
      char.espacos_magia[circ].usados++;

      if (char.classe === 'Feiticeiro' && semAcento(char.subclasse || '') === semAcento('Feitiçaria Selvagem')) {
        const estadoFeiticeiro = getEstadoRecursosFeiticeiro();
        if (estadoFeiticeiro && !estadoFeiticeiro.subclasses.selvagem.mares_caos_disponivel) {
          char.recursos.feiticeiro.subclasses.selvagem.mares_caos_disponivel = true;
          char.recursos.feiticeiro.subclasses.selvagem.surto_pendente_automatico = true;
        }
      }

      salvar();
      const baseCirc = btn.dataset.conjCirc;
      const upcast = parseInt(circ) > parseInt(baseCirc);
      if (char.classe === 'Feiticeiro' && semAcento(char.subclasse || '') === semAcento('Feitiçaria Selvagem') && char.recursos?.feiticeiro?.subclasses?.selvagem?.surto_pendente_automatico) {
        toast(`${nome} conjurada${upcast ? ` no ${circ}º círculo` : ''}! Surto de Magia Selvagem automático pendente.`, 'success');
      } else {
        toast(`${nome} conjurada${upcast ? ` no ${circ}º círculo` : ''}!`, 'success');
      }
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
  const subConj = getSubclasseConjuradoraConjuracao();
  const tipoConj = info.tipo_conjuracao || 'preparadas';
  const labelMg = tipoConj === 'conhecidas' ? 'Conhecida' : 'Preparada';
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

  abrirModal('Gerenciar Magias', `
    <div style="margin-bottom:8px;display:flex;flex-wrap:wrap;gap:6px;font-size:0.78rem">
      <span class="magia-contador ${(char.magias_conhecidas || []).filter(m => m.circulo === 0).length >= maxTruq ? 'contador-cheio' : ''}" id="gm-contador-truques">
        Truques: ${(char.magias_conhecidas || []).filter(m => m.circulo === 0).length}/${maxTruq}
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
    <div id="resultado-magias" style="max-height:50vh;overflow-y:auto"></div>
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

      html += `<div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:8px">${labelMg}s: ${normais.length}/${maxPrep} | Clique para remover</div>`;

      if (filtradasDom.length > 0) {
        html += `<div style="font-size:0.75rem;font-weight:700;color:var(--secondary);margin:8px 0 4px">Magias Especiais</div>`;
        html += `<div class="magias-grid">${filtradasDom.map(m => `
          <div class="magia-card selecionada magia-dominio" style="opacity:0.7;cursor:default">
            <span class="magia-card-check"></span>
            <div class="magia-card-nome"><span class="badge-dominio">&#9733;</span> ${m.nome}</div>
            <div class="magia-card-meta"><span>${rotuloOrigemMagia(m)}</span></div>
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
        const isDominio = (char.magias_preparadas || []).find(p => p.nome === m.nome && magiaEhEspecial(p));
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
              ${isDominio ? '<span>Especial</span>' : ''}
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
          ${magia.circulo_superior ? `<div class="info-box info mt-1"><strong>Em círculos superiores:</strong> ${magia.circulo_superior}</div>` : ''}
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
    const numTruques = (char.magias_conhecidas || []).filter(m => m.circulo === 0).length;
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
          html += `<div style="font-size:0.75rem;font-weight:700;color:var(--secondary);margin:4px 0">Magias Especiais</div>`;
          // Garantir que domínio apareca mesmo se nao esta em magiasDisponiveis
          const domNomes = [...nomesDominio];
          const filtDomNomes = termo.length >= 2 ? domNomes.filter(n => semAcento(n).includes(termo)) : domNomes;
          html += `<div class="magias-grid">${filtDomNomes.map(nome => `
            <div class="magia-card selecionada magia-dominio" style="opacity:0.7;cursor:default">
              <span class="magia-card-check"></span>
              <div class="magia-card-nome"><span class="badge-dominio">&#9733;</span> ${nome}</div>
              <div class="magia-card-meta"><span>Especial</span></div>
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
              ${isDominio ? '<span>Especial</span>' : ''}
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
  'Enfeitiçado': 'Nao pode atacar quem o enfeiticou nem o ter como alvo de efeitos nocivos. Quem o enfeiticou tem Vantagem em testes de interacao social contra voce.',
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

  return `
    <div class="card" style="${temCondicao ? 'border-color:var(--warning)' : ''}">
      <div class="card-header">
        <h2>Condicoes${temCondicao ? ` (${condicoes.length})` : ''}</h2>
        <button class="btn btn-sm btn-secondary no-print" id="btn-gerenciar-condicoes">Gerenciar</button>
      </div>
      ${temCondicao ? `
        <div style="display:flex;flex-wrap:wrap;gap:6px;padding:4px 0">
          ${condicoes.map(c => {
            const info = CONDICOES_DD.find(cd => cd.nome === c) || { icone: '?', cor: '#666' };
            const desc = CONDICOES_DESCRICAO[c] || '';
            return `<span class="badge" style="font-size:0.75rem;padding:4px 8px;background:${info.cor};color:#fff;cursor:help" title="${desc}">${info.icone} ${c}</span>`;
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
      ` : '<div style="color:var(--text-muted);font-size:0.85rem;text-align:center;padding:8px">Nenhuma condicao ativa</div>'}
    </div>
  `;
}

/** Renderiza secao de defesas (resistencias, vulnerabilidades, imunidades) */
function renderSecaoDefesas() {
  const resistencias = char.resistencias || [];
  const vulnerabilidades = char.vulnerabilidades || [];
  const imunidades = char.imunidades || [];
  const temDefesa = resistencias.length > 0 || vulnerabilidades.length > 0 || imunidades.length > 0;

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

  if (resistencias.length > 0) {
    html += `<div style="margin-bottom:4px"><span style="font-size:0.75rem;font-weight:700;color:var(--info)">Resistencias:</span> <span style="font-size:0.8rem">${resistencias.join(', ')}</span></div>`;
  }
  if (vulnerabilidades.length > 0) {
    html += `<div style="margin-bottom:4px"><span style="font-size:0.75rem;font-weight:700;color:var(--danger)">Vulnerabilidades:</span> <span style="font-size:0.8rem">${vulnerabilidades.join(', ')}</span></div>`;
  }
  if (imunidades.length > 0) {
    html += `<div style="margin-bottom:4px"><span style="font-size:0.75rem;font-weight:700;color:var(--success)">Imunidades:</span> <span style="font-size:0.8rem">${imunidades.join(', ')}</span></div>`;
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
  document.getElementById('btn-gerenciar-condicoes')?.addEventListener('click', () => {
    const condicoesAtuais = new Set(char.condicoes || []);

    const html = `
      <div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center">
        ${CONDICOES_DD.map(c => {
          const ativa = condicoesAtuais.has(c.nome);
          const desc = CONDICOES_DESCRICAO[c.nome] || '';
          return `
            <div class="selection-card ${ativa ? 'selected' : ''}" data-condicao-toggle="${c.nome}" 
                 style="min-width:130px;max-width:170px;cursor:pointer;text-align:center;border:2px solid ${ativa ? c.cor : 'var(--border-light)'};${ativa ? `background:${c.cor}15` : ''}" 
                 title="${desc}">
              <div style="font-size:1.2rem">${c.icone}</div>
              <div style="font-size:0.8rem;font-weight:600">${c.nome}</div>
            </div>
          `;
        }).join('')}
      </div>
      <div style="font-size:0.75rem;color:var(--text-muted);margin-top:8px;text-align:center">Clique para ativar/desativar. Multiplas condicoes podem estar ativas ao mesmo tempo.</div>
    `;

    abrirModal('Gerenciar Condicoes', html,
      '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-primary" id="btn-salvar-condicoes">Salvar</button>'
    );

    // Eventos de toggle
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
      });
    });

    document.getElementById('btn-salvar-condicoes')?.addEventListener('click', () => {
      const novas = [];
      document.querySelectorAll('[data-condicao-toggle].selected').forEach(el => {
        novas.push(el.dataset.condicaoToggle);
      });
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
    <div class="inv-item ${item.equipado ? 'inv-item-equipado' : ''} ${isZeroQtd ? 'inv-item-zerado' : ''}" data-idx="${idx}" draggable="true">
      <div class="inv-drag-handle no-print" title="Arrastar para reordenar">&#9776;</div>
      <div style="flex:1;cursor:pointer" data-info-inv-sheet="${idx}" title="Ver detalhes">
        <div class="inv-item-nome">
          ${item.nome} ${profBadge} ${maestriaBadge} ${ataqueInfo} ${vantagemInfo} ${danoAutoInfo} ${tipoBadge} ${customBadges}
        </div>
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
