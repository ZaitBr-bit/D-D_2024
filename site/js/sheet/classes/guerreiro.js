// ============================================================
// Progressao e recursos do Guerreiro
//
// Consultado pela ficha, pelos descansos e pelas habilidades ativas.
// Extraido de site/js/pages/sheet.js sem alteracao de comportamento.
// ============================================================
import { getConjuracaoSubclasse } from '../../regras-conjuracao-subclasse.js';
import { bonusProficiencia, calcMod } from '../../utils.js';
import { char, classeData } from '../estado.js';

// Progressão e recursos do Guerreiro
export function getProgressaoGuerreiro() {
  if (char?.classe !== 'Guerreiro' || !classeData?.tabela_caracteristicas) return null;
  const row = classeData.tabela_caracteristicas.find(r => parseInt(r['Nível']) === (char.nivel || 1));
  if (!row) return null;
  return {
    recuperarFolegoMax: parseInt(row['Recuperar Fôlego']) || 2,
    maestriasMax: parseInt(row['Maestria em Arma']) || 3
  };
}

export function getEstadoRecursosGuerreiro() {
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
  if (!Array.isArray(char.manobras_conhecidas)) char.manobras_conhecidas = [];

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
  let manobrasEsperadas = 0;
  if (ehMestreBatalha && nivel >= 3) {
    manobrasEsperadas = 3;
    if (nivel >= 15) manobrasEsperadas = 9;
    else if (nivel >= 10) manobrasEsperadas = 7;
    else if (nivel >= 7) manobrasEsperadas = 5;
  }
  const manobrasConhecidasLista = char.manobras_conhecidas || [];
  const manobrasConhecidas = manobrasConhecidasLista.length;
  const manobrasPendentes = Math.max(0, manobrasEsperadas - manobrasConhecidas);
  const opcoesManobraTexto = classeData?.subclasses?.find(sc => sc.nome === 'Mestre da Batalha')?.opcoes_manobra || [];
  const manobrasComDescricao = manobrasConhecidasLista.map(nome => {
    const op = opcoesManobraTexto.find(o => o.nome === nome);
    return { nome, descricao: op?.descricao || '' };
  });
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
    manobrasEsperadas,
    manobrasPendentes,
    manobrasComDescricao,
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

/**
 * Tabela de conjuração do Cavaleiro Místico (subclasse do Guerreiro) para o
 * personagem aberto na ficha.
 *
 * `opcoes` permite consultar uma combinação diferente da gravada -- mesma
 * necessidade do Trapaceiro Arcano (ver sheet/classes/ladino.js): na subida
 * para o nível 3 a subclasse ainda não está em `char`.
 */
export function getCavaleiroMisticoConjuracao(opcoes = {}) {
  const classe = opcoes.classe ?? char?.classe;
  const subclasse = opcoes.subclasse ?? char?.subclasse;
  const nivel = opcoes.nivel ?? char?.nivel ?? 1;
  return getConjuracaoSubclasse(classe, subclasse === 'Cavaleiro Místico' ? subclasse : null, nivel);
}