// ============================================================
// Sistema de Level-Up D&D 2024
// ============================================================
import { CLASSES_INFO, ESCOLAS_SUBCLASSE_MAGO } from './dados-classes.js';
import { getClasse, getEspecies, getIndiceMagias, getTalentos, getMagiasRituais } from './db.js';
import { getTruquesFixosSubclasse } from './regras-conjuracao-subclasse.js';
import { calcMod, bonusProficiencia, getEspacosMagia, getTruquesConhecidos, getMagiaPreparadas } from './utils.js';
import { aplicarDeltaSistema, garantirEstadoEdicoes } from './ficha-edicoes.js';
import { aplicarEfeitoTalento, validarEscolhasTalento, INSTRUMENTOS_MUSICAIS, ritualBonusPendente } from './regras-cobertura.js';
import { contextoDeSubida, pvGanhoAoSubir } from './regras-multiclasse-progressao.js';
import { classesDe, migrarParaMulticlasse, sincronizarEspelhos } from './regras-multiclasse.js';
import { conjuraPorAlgumaClasse } from './regras-multiclasse-conjuracao.js';
import { armadurasDoPersonagem, concessoesAoEntrarEm } from './regras-multiclasse-proficiencias.js';
import {
  linhasDaSubclasseNoNivel, opcoesDaLinha, truquesConhecidosDe,
  aplicarEscolhaSubclasse, aplicarConcessaoAutomatica,
} from './regras-subclasse-escolhas.js';

const _ATRIBUTOS_ASI_TALENTO = {
  'Força': 'forca', 'Destreza': 'destreza', 'Constituição': 'constituicao',
  'Inteligência': 'inteligencia', 'Sabedoria': 'sabedoria', 'Carisma': 'carisma'
};
const _PERICIAS_TODAS = [
  'Acrobacia', 'Arcanismo', 'Atletismo', 'Atuação', 'Enganação', 'Furtividade',
  'História', 'Intimidação', 'Intuição', 'Investigação', 'Lidar com Animais',
  'Medicina', 'Natureza', 'Percepção', 'Persuasão', 'Prestidigitação',
  'Religião', 'Sobrevivência'
];

export function obterAtributosASITalento(talento) {
  const beneficio = talento?.beneficios?.find(b => b.nome === 'Aumento no Valor de Atributo');
  if (!beneficio?.descricao) return [];
  const atributosNomeados = Object.entries(_ATRIBUTOS_ASI_TALENTO)
    .filter(([nome]) => beneficio.descricao.includes(nome))
    .map(([, chave]) => chave);
  if (atributosNomeados.length > 0) return atributosNomeados;

  // Textos como "um valor de atributo à sua escolha" não citam nomes,
  // mas permitem qualquer um dos seis atributos.
  if (/um valor de atributo à sua escolha|escolha um atributo/i.test(beneficio.descricao)) {
    return Object.values(_ATRIBUTOS_ASI_TALENTO);
  }
  return [];
}

export function getLimiteASITalento(talento) {
  const beneficio = talento?.beneficios?.find(b => b.nome === 'Aumento no Valor de Atributo');
  return /máximo 30/i.test(beneficio?.descricao || '') ? 30 : 20;
}

export function aplicarASITalento(personagem, talento, atributo) {
  const elegiveis = obterAtributosASITalento(talento);
  if (elegiveis.length === 0) return { sucesso: true, aplicado: false };
  if (!atributo || !elegiveis.includes(atributo)) {
    return { sucesso: false, erro: 'Escolha um atributo elegível para o talento.' };
  }
  const atual = Number(personagem?.atributos?.[atributo]);
  const limite = getLimiteASITalento(talento);
  if (!Number.isFinite(atual) || atual >= limite) {
    return { sucesso: false, erro: `O atributo escolhido deve estar abaixo de ${limite}.` };
  }
  aplicarDeltaSistema(personagem, `atributos.${atributo}`, 1, limite);
  return { sucesso: true, aplicado: true };
}

function encontrarTalentoPorNome(dadosTalentos, nome) {
  for (const lista of Object.values(dadosTalentos?.por_categoria || {})) {
    const talento = lista.find(item => item.nome === nome);
    if (talento) return talento;
  }
  return null;
}

export const CLASSES_COM_DADIVA_EPICA = [
  'Bárbaro', 'Bardo', 'Bruxo', 'Clérigo', 'Druida', 'Feiticeiro',
  'Guardião', 'Guerreiro', 'Ladino', 'Mago', 'Monge', 'Paladino'
];

export function exigeDadivaEpica(classe, nivel) {
  return nivel === 19 && CLASSES_COM_DADIVA_EPICA.includes(classe);
}

function _normalizarTextoRegra(texto) {
  return (texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function _atributosAtendemPrerequisito(personagem, prerequisito) {
  const texto = _normalizarTextoRegra(prerequisito);
  const nomes = {
    forca: 'forca', destreza: 'destreza', constituicao: 'constituicao',
    inteligencia: 'inteligencia', sabedoria: 'sabedoria', carisma: 'carisma'
  };
  const citados = Object.entries(nomes)
    .filter(([nome]) => new RegExp(`\\b${nome}\\b`).test(texto))
    .map(([, chave]) => Number(personagem?.atributos?.[chave]));
  if (!texto.includes('13 ou superior') || citados.length === 0) return true;
  return citados.some(valor => Number.isFinite(valor) && valor >= 13);
}

/**
 * True quando o personagem conjura por ALGUMA classe -- usado na
 * elegibilidade de talentos que exigem "a caracteristica Conjuracao".
 * Lia o espelho da classe INICIAL e os quatro ramos escritos a mao; um
 * Barbaro 5/Mago 1 dava falso e perdia talentos a que tem direito.
 */
function _personagemTemConjuracao(personagem) {
  return conjuraPorAlgumaClasse(personagem)
    || personagem?.caracteristica_conjuracao === true
    || personagem?.magia_de_pacto === true;
}

export function talentoElegivelParaPersonagem(personagem, talento, nivel = personagem?.nivel || 1, opcoes = {}) {
  if (!personagem || !talento) return false;
  const prerequisito = talento.prerequisito || '';
  const texto = _normalizarTextoRegra(prerequisito);
  const minimo = Number(texto.match(/nivel\s*(\d+)/)?.[1] || 0);
  if (nivel < minimo) return false;
  if (!_atributosAtendemPrerequisito(personagem, prerequisito)) return false;

  const exigeConjuracao = /caracteristica (?:de )?conjuracao/.test(texto) || texto.includes('magia de pacto');
  if (exigeConjuracao && !_personagemTemConjuracao(personagem)) {
    return false;
  }

  // `proficiencias_extra` é o campo REAL onde o app grava treinamento
  // extra de armadura -- por talento (PROFICIENCIAS_FIXAS_TALENTO,
  // regras-cobertura.js) e por concessão de subclasse
  // (regras-subclasse-escolhas.js:52, Colégio da Bravura). Ele guarda o
  // rótulo completo ("Armadura Média", "Escudo"), enquanto esta checagem
  // compara contra a categoria nua ("media", "escudo"), então o prefixo
  // "Armadura " sai antes de normalizar. "Armas Marciais" também mora
  // nesse array e entra aqui como ruído inofensivo -- nenhum
  // pré-requisito de armadura casa com ele.
  //
  // `proficiencias_armaduras` e `treinamentos_armadura` continuam sendo
  // lidos por compatibilidade com fichas importadas, mas nenhuma linha de
  // site/js/ jamais escreveu nos dois -- eram os únicos campos que este
  // portão lia até 2026-08-19, e é por isso que a cadeia
  // Leves -> Médias -> Pesadas nunca subia: o talento concedia num campo
  // e o portão olhava outro.
  const armaduras = new Set([
    // UNIAO das classes, nao o espelho: um Mago 5/Guerreiro 1 tem direito
    // a pedir talento que exige "treinamento com armadura pesada" pelo
    // Guerreiro, e ate aqui o portao so olhava o Mago (livro:2051).
    ...armadurasDoPersonagem(personagem),
    ...(personagem.proficiencias_extra || [])
      .map(p => String(p).replace(/^Armadura\s+/i, '')),
    ...(personagem.proficiencias_armaduras || []),
    ...(personagem.treinamentos_armadura || [])
  ].map(_normalizarTextoRegra));
  if (texto.includes('treinamento com armadura leve') && !armaduras.has('leve')) return false;
  if (texto.includes('treinamento com armadura media') && !armaduras.has('media')) return false;
  if (texto.includes('treinamento com armadura pesada') && !armaduras.has('pesada')) return false;
  if (texto.includes('treinamento com escudo') && !armaduras.has('escudo')) return false;
  if (texto.includes('caracteristica de estilo de luta') && !personagem?.escolhas_classe?.estilo_luta?.length) return false;

  const jaTem = (personagem.talentos || []).some(item =>
    (typeof item === 'string' ? item : item?.nome) === talento.nome);
  const repetivel = (talento.beneficios || []).some(beneficio => beneficio.nome === 'Repetível');
  return opcoes.permitirExistente === true || !jaTem || repetivel;
}

export function obterTalentosElegiveis(personagem, dadosTalentos, nivel, opcoes = {}) {
  return Object.values(dadosTalentos?.por_categoria || {})
    .flat()
    .filter(talento => talentoElegivelParaPersonagem(personagem, talento, nivel, opcoes))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

function validarDistribuicaoASI(personagem, aumentos, limite = 20) {
  if (!aumentos || typeof aumentos !== 'object' || Array.isArray(aumentos)) return false;
  let total = 0;
  for (const [atributo, valor] of Object.entries(aumentos)) {
    const atual = Number(personagem?.atributos?.[atributo]);
    if (!Object.values(_ATRIBUTOS_ASI_TALENTO).includes(atributo) ||
        !Number.isInteger(valor) || valor < 1 || valor > 2 ||
        !Number.isFinite(atual) || atual + valor > limite) return false;
    total += valor;
  }
  return total === 2;
}

function validarEscolhaDadivaProficiencia(personagem, opcoes) {
  const escolhas = opcoes?.escolhas_talento_levelup;
  const pericia = Array.isArray(escolhas) && escolhas.length === 1 ? escolhas[0] : '';
  return _PERICIAS_TODAS.includes(pericia) &&
    (personagem?.pericias_proficientes || []).includes(pericia) &&
    !(personagem?.pericias_expertise || []).includes(pericia);
}

function montarEscolhasCoberturaTalento(opcoes = {}) {
  return {
    atributo: opcoes.talento_asi || opcoes.resiliente_atributo || opcoes.iniciado_em_magia?.atributo,
    talento_asi: opcoes.talento_asi,
    selecoes: Array.isArray(opcoes.escolhas_talento_levelup)
      ? [...opcoes.escolhas_talento_levelup]
      : [],
    iniciado_em_magia: opcoes.iniciado_em_magia,
    magia: opcoes.escolhas_talento_levelup?.[0],
    rituais: opcoes.talento_tipo_escolha === 'conjurador_ritualista'
      ? [...(opcoes.escolhas_talento_levelup || [])]
      : undefined,
    energias: opcoes.dadiva_resistencia_energia
  };
}

function aplicarDadivaProficiencia(personagem, opcoes) {
  const pericia = opcoes.escolhas_talento_levelup[0];
  if (!personagem.pericias_proficientes) personagem.pericias_proficientes = [];
  if (!personagem.pericias_expertise) personagem.pericias_expertise = [];
  for (const nome of _PERICIAS_TODAS) {
    if (!personagem.pericias_proficientes.includes(nome)) personagem.pericias_proficientes.push(nome);
  }
  if (!personagem.pericias_expertise.includes(pericia)) personagem.pericias_expertise.push(pericia);
}

export function talentoPermitidoNaRecuperacaoDadiva(talento) {
  return talento?.nome === 'Aumento no Valor de Atributo' ||
    talento?.nome === 'Dádiva da Proficiência em Perícia';
}

export function registrarDadivaEpicaLegada(personagem, opcoes, dadosTalentos) {
  // `exigeDadivaEpica(classe, 19)` com o literal 19 so testa PERTENCIMENTO
  // a CLASSES_COM_DADIVA_EPICA -- o segundo argumento sempre bate o
  // `nivel === 19` da propria funcao, entao o nivel NUNCA entra nesta
  // checagem; quem barra por nivel e o `Number(personagem?.nivel) < 19`
  // logo abaixo (nivel TOTAL, correto: mesmo gate que
  // `precisaRecuperarDadivaEpica`, sheet/talentos.js:19-23, usa como
  // `>= 19`). CLASSES_COM_DADIVA_EPICA lista as 12 classes do jogo, entao
  // esta checagem e trivialmente verdadeira para qualquer personagem com
  // classe valida -- ler so o espelho `personagem.classe` (a classe
  // INICIAL) nunca mudou a resposta. Trocado por `classesDe` mesmo assim,
  // so para tirar a leitura de espelho do arquivo (evita precisar de
  // excecao declarada no guarda estatico de alcance); o literal 19 fica
  // como estava, para o comportamento continuar byte a byte o mesmo.
  const temClasseComDadivaEpica = classesDe(personagem)
    .some(c => exigeDadivaEpica(c.classe, 19));
  if (!temClasseComDadivaEpica || Number(personagem?.nivel) < 19) {
    return { sucesso: false, erro: 'O personagem não possui a escolha de Dádiva Épica de nível 19.' };
  }
  if (personagem?.escolhas_classe?.dadiva_epica_nivel_19) {
    return { sucesso: false, erro: 'A escolha de nível 19 já foi registrada.' };
  }

  const talento = encontrarTalentoPorNome(dadosTalentos, opcoes?.talento);
  if (!talento || !talentoPermitidoNaRecuperacaoDadiva(talento) ||
      !talentoElegivelParaPersonagem(personagem, talento, 19)) {
    return { sucesso: false, erro: 'Talento inválido ou com pré-requisitos não atendidos.' };
  }

  if (talento.nome === 'Aumento no Valor de Atributo') {
    if (!validarDistribuicaoASI(personagem, opcoes.aumentos_atributo, 20)) {
      return { sucesso: false, erro: 'Distribua +2 em um atributo ou +1 em dois atributos, até o máximo 20.' };
    }
  } else {
    const atributosASI = obterAtributosASITalento(talento);
    const atributo = opcoes.talento_asi;
    const atual = Number(personagem?.atributos?.[atributo]);
    const limite = getLimiteASITalento(talento);
    if (atributosASI.length > 0 &&
        (!atributo || !atributosASI.includes(atributo) || !Number.isFinite(atual) || atual >= limite)) {
      return { sucesso: false, erro: `Escolha um atributo elegível abaixo de ${limite} para o talento.` };
    }
  }
  if (talento.nome === 'Dádiva da Proficiência em Perícia' &&
      !validarEscolhaDadivaProficiencia(personagem, opcoes)) {
    return { sucesso: false, erro: 'Escolha uma perícia em que já possua proficiência e ainda não tenha Especialização.' };
  }
  if (talento.nome === 'Dádiva da Resistência à Energia') {
    const tipos = opcoes?.dadiva_resistencia_energia;
    if (!Array.isArray(tipos) || tipos.length !== 2 || new Set(tipos).size !== 2) {
      return { sucesso: false, erro: 'Selecione 2 tipos de energia diferentes.' };
    }
  }

  if (talento.nome === 'Aumento no Valor de Atributo') {
    for (const [atributo, valor] of Object.entries(opcoes.aumentos_atributo)) {
      aplicarDeltaSistema(personagem, `atributos.${atributo}`, valor, 20);
    }
  } else {
    const resultadoASI = aplicarASITalento(personagem, talento, opcoes.talento_asi);
    if (!resultadoASI.sucesso) return resultadoASI;
  }

  if (talento.nome === 'Dádiva da Fortitude') {
    personagem.pv_max = (personagem.pv_max || 0) + 40;
    personagem.pv_atual = Math.min((personagem.pv_atual || 0) + 40, personagem.pv_max);
    personagem.bonus_pv_dadiva_fortitude = 40;
  }
  if (talento.nome === 'Dádiva da Proficiência em Perícia') {
    aplicarDadivaProficiencia(personagem, opcoes);
  }
  if (!personagem.talentos) personagem.talentos = [];
  personagem.talentos.push(talento.nome);

  if (Array.isArray(opcoes.escolhas_talento_levelup) && opcoes.escolhas_talento_levelup.length > 0) {
    if (!personagem.escolhas_talento) personagem.escolhas_talento = {};
    personagem.escolhas_talento.dadiva_epica_nivel_19 = [...opcoes.escolhas_talento_levelup];
  }
  if (opcoes.dadiva_resistencia_energia) {
    if (!personagem.talentos_parametros) personagem.talentos_parametros = {};
    personagem.talentos_parametros.dadiva_resistencia_energia = [...opcoes.dadiva_resistencia_energia];
  }
  if (!personagem.escolhas_classe) personagem.escolhas_classe = {};
  personagem.escolhas_classe.dadiva_epica_nivel_19 = talento.nome;
  return { sucesso: true, talento: talento.nome };
}

/**
 * Tabela de XP necessário para cada nível (D&D 2024)
 */
export const XP_POR_NIVEL = {
  1: 0,
  2: 300,
  3: 900,
  4: 2700,
  5: 6500,
  6: 14000,
  7: 23000,
  8: 34000,
  9: 48000,
  10: 64000,
  11: 85000,
  12: 100000,
  13: 120000,
  14: 140000,
  15: 165000,
  16: 195000,
  17: 225000,
  18: 265000,
  19: 305000,
  20: 355000
};

/**
 * Calcula o nível baseado no XP atual
 */
export function calcularNivelPorXP(xp) {
  let nivel = 1;
  for (let lvl = 20; lvl >= 1; lvl--) {
    if (xp >= XP_POR_NIVEL[lvl]) {
      nivel = lvl;
      break;
    }
  }
  return nivel;
}

/**
 * Verifica se o personagem tem XP suficiente para subir de nível
 */
export function podeSubirDeNivel(personagem) {
  const nivelAtual = personagem.nivel || 1;
  if (nivelAtual >= 20) return false;
  
  const xpAtual = personagem.xp || 0;
  const xpNecessario = XP_POR_NIVEL[nivelAtual + 1];
  
  return xpAtual >= xpNecessario;
}

/**
 * Calcula HP ganho ao subir de nível
 * @param {string} classe - Nome da classe
 * @param {number} modCon - Modificador de Constituição
 * @returns {number} HP ganho
 */
export function calcularHPGanho(classe, modCon) {
  const info = CLASSES_INFO[classe];
  if (!info || !info.dado_vida) return 0;
  
  // Valor fixo: metade do dado + 1 + modificador CON
  const dadoVida = info.dado_vida;
  const hpFixo = Math.floor(dadoVida / 2) + 1 + modCon;
  
  return Math.max(1, hpFixo); // Mínimo de 1 HP
}

/**
 * Obtém as características que o personagem ganha em um nível específico
 */
export async function obterCaracteristicasNivel(classe, nivel) {
  const classeData = await getClasse(classe);
  if (!classeData || !classeData.tabela_caracteristicas) return [];
  
  const row = classeData.tabela_caracteristicas.find(r => parseInt(r['Nível']) === nivel);
  if (!row) return [];

  const caracteristicas = row['Características de Classe'] ?? row['Características'];
  if (!caracteristicas) return [];
  if (caracteristicas === '—' || caracteristicas === '-') return [];
  
  // Dividir por vírgula e limpar espaços
  return caracteristicas.split(',').map(c => c.trim()).filter(c => c);
}

/**
 * Verifica se o nível concede Aumento de Atributo
 */
export function concedeAumentoAtributo(classe, nivel) {
  const aumentos = {
    'Clérigo': [4, 8, 12, 16, 19],
    'Bárbaro': [4, 8, 12, 16, 19],
    'Bardo': [4, 8, 12, 16, 19],
    'Bruxo': [4, 8, 12, 16, 19],
    'Druida': [4, 8, 12, 16, 19],
    'Feiticeiro': [4, 8, 12, 16, 19],
    'Guardião': [4, 8, 12, 16, 19],
    'Guerreiro': [4, 6, 8, 12, 14, 16, 19],
    'Ladino': [4, 8, 10, 12, 16, 19],
    'Mago': [4, 8, 12, 16, 19],
    'Monge': [4, 8, 12, 16, 19],
    'Paladino': [4, 8, 12, 16, 19]
  };
  
  return (aumentos[classe] || []).includes(nivel);
}

/**
 * Capstones de atributo: as duas características de nível 20 do livro que
 * somam valores de atributo direto na ficha, sem escolha do jogador.
 *
 * Não confundir com o Aumento no Valor de Atributo comum (`concedeAumentoAtributo`
 * acima): aquele é escolhido pelo jogador e tem teto 20; estes são automáticos e
 * têm teto 25. Usar o teto errado é o engano fácil aqui.
 */
export const CAPSTONES_ATRIBUTO = {
  // "Seus valores de Força e Constituição aumentam em 4, até um máximo de 25."
  'Bárbaro': { caracteristica: 'Campeão Primitivo', atributos: ['forca', 'constituicao'], ganho: 4 },
  // "Seus valores de Destreza e Sabedoria aumentam em 4, até no máximo 25."
  'Monge': { caracteristica: 'Corpo e Mente', atributos: ['destreza', 'sabedoria'], ganho: 4 }
};

/** Teto dos capstones de atributo (o ASI comum para em 20; estes vão a 25) */
export const TETO_CAPSTONE_ATRIBUTO = 25;

/**
 * Soma `ganho` a cada atributo da lista, aparando no teto 25.
 * Devolve o personagem para encadear; muta o objeto recebido.
 */
export function aplicarCapstoneAtributo(personagem, atributos, ganho) {
  for (const atributo of atributos) {
    const atual = personagem.atributos[atributo] || 10;
    personagem.atributos[atributo] = Math.min(TETO_CAPSTONE_ATRIBUTO, atual + ganho);
  }
  return personagem;
}

/**
 * Verifica se o nível exige seleção de subclasse
 */
export function exigeSubclasse(classe, nivel) {
  // A maioria das classes escolhe subclasse no nível 3
  const niveisSubclasse = {
    'Clérigo': 3,
    'Bárbaro': 3,
    'Bardo': 3,
    'Bruxo': 3,
    'Druida': 3,
    'Feiticeiro': 3,
    'Guardião': 3,
    'Guerreiro': 3,
    'Ladino': 3,
    'Mago': 3,
    'Monge': 3,
    'Paladino': 3
  };
  
  return nivel === niveisSubclasse[classe];
}

/**
 * Verifica se o nível exige escolha de Especialização do Bardo
 */
export function exigeEspecializacaoBardo(classe, nivel) {
  return classe === 'Bardo' && (nivel === 2 || nivel === 9);
}

/**
 * Verifica se o nível exige escolha de Especialista do Guardião
 */
export function exigeEspecializacaoGuardiao(classe, nivel) {
  return classe === 'Guardião' && nivel === 9;
}

/**
 * Verifica se o nível exige escolha de Estilo de Luta (Guardião nv2, Paladino nv2)
 */
export function exigeEstiloLuta(classe, nivel) {
  return (classe === 'Guardião' || classe === 'Paladino') && nivel === 2;
}

/**
 * Verifica se o nível oferece a chance de trocar o Estilo de Luta do
 * Guerreiro (Classes.md:3812: "Sempre que atinge um nível de Guerreiro,
 * você pode substituir o talento que escolheu por um talento diferente
 * de Estilo de Luta"). Vale em todo nível >= 2 -- o nível 1 já é
 * atendido no assistente de criação (CLASSES_ESCOLHAS.Guerreiro.estilo_luta,
 * site/js/creator/comum.js), um fluxo separado deste.
 */
export function exigeTrocaEstiloLutaGuerreiro(classe, nivel) {
  return classe === 'Guerreiro' && nivel >= 2;
}

/**
 * Verifica se o nível concede a Especialização adicional do Ladino
 * (Classes.md:4188: no nível 6, Especialização em mais 2 perícias nas
 * quais já é proficiente, à escolha do jogador -- a primeira leva de 2
 * já é atendida no assistente de criação, nível 1,
 * CLASSES_ESCOLHAS.Ladino.especialista).
 */
export function exigeEspecializacaoLadino(classe, nivel) {
  return classe === 'Ladino' && nivel === 6;
}

/**
 * Verifica se o nível exige escolha de Manobras (Mestre da Batalha)
 */
export function exigeManobrasGuerreiro(classe, subclasse, nivel) {
  return classe === 'Guerreiro' && subclasse === 'Mestre da Batalha' &&
         [3, 7, 10, 15].includes(nivel);
}

/**
 * Quantidade de NOVAS manobras aprendidas neste nível (não é o total acumulado)
 */
export function getQuantidadeNovasManobras(nivel) {
  if (nivel === 3) return 3;
  if (nivel === 7 || nivel === 10 || nivel === 15) return 2;
  return 0;
}

/**
 * Verifica se o nível exige escolha de Explorador Hábil (Guardião nv2: 1 expertise + 2 idiomas)
 */
export function exigeExploradorHabil(classe, nivel) {
  return classe === 'Guardião' && nivel === 2;
}

/**
 * Verifica se o nível exige escolha de Acadêmico (Mago nv2: 1 expertise em perícia de conhecimento)
 */
export function exigeAcademico(classe, nivel) {
  return classe === 'Mago' && nivel === 2;
}

/**
 * Recorta o trecho da descricao que pertence a uma opcao nomeada em negrito
 * ("**Terreno Polar**"), ate o proximo cabecalho em negrito do mesmo tipo.
 * Devolve '' quando a opcao nao aparece no texto.
 */
function recortarBlocoDaOpcao(descricao, opcao) {
  const linhas = descricao.split('\n');
  const ehCabecalho = (l) => /^\*\*[^*]+\*\*\s*$/.test(l.trim());
  const casa = (l) => ehCabecalho(l)
    && l.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
        .includes(String(opcao).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''));
  const inicio = linhas.findIndex(casa);
  if (inicio === -1) return '';
  let fim = linhas.length;
  for (let i = inicio + 1; i < linhas.length; i++) {
    if (ehCabecalho(linhas[i])) { fim = i; break; }
  }
  return linhas.slice(inicio, fim).join('\n');
}

/**
 * Extrai magias sempre preparadas de tabelas markdown no nível alvo.
 * Ex.: | 5 | *Passo Nebuloso* |
 */
function extrairMagiasSemprePreparadasTabela(descricao, nivelAlvo, opcaoEscolhida) {
  if (!descricao || !nivelAlvo) return [];
  // Caracteristica com MAIS DE UMA tabela de nivel oferece tabelas
  // ALTERNATIVAS (Magias do Circulo da Terra tem quatro, uma por terreno) e
  // qual vale depende de uma escolha do jogador. Com a escolha em maos,
  // recorta so a tabela dela; sem a escolha, devolve vazio -- somar as
  // quatro entregaria 12 magias no nivel 3 onde o livro concede 3,
  // misturando terrenos que o personagem nunca escolheu.
  const cabecalhos = descricao.match(/\|[^|\n]*[Nn][íi]vel[^|\n]*\|/g) || [];
  if (cabecalhos.length > 1) {
    if (!opcaoEscolhida) return [];
    descricao = recortarBlocoDaOpcao(descricao, opcaoEscolhida);
    if (!descricao) return [];
  }
  const texto = descricao.toLowerCase();
  // A palavra "sempre" NAO e o invariante da concessao -- varias frases do
  // livro concedem sem ela ("voce tem a lista de magias preparadas",
  // Circulo da Lua/do Mar/Vigilante das Sombras), e outras a usam para
  // qualificar a FREQUENCIA de uma escolha, nao a preparacao ("Sempre que
  // completar um Descanso Longo, escolha um tipo de terreno"). O que
  // realmente marca a concessao e "preparad" + nome de magia em italico.
  if (!texto.includes('preparad')) return [];

  const nomes = new Set();
  const linhas = descricao.split('\n');

  for (const linha of linhas) {
    const m = linha.match(/^\|\s*\**(\d+)\**\s*\|\s*(.+?)\s*\|\s*$/);
    if (!m) continue;

    const nivelLinha = parseInt(m[1], 10);
    if (nivelLinha !== nivelAlvo) continue;

    const colunaMagias = (m[2] || '').trim();
    const nomesItalico = [...colunaMagias.matchAll(/\*([^*]+)\*/g)]
      .map(x => (x[1] || '').trim())
      .filter(Boolean);

    // Separar por virgula caso italico envolva multiplas magias (ex: *Magia1, Magia2*)
    const nomesLinha = (nomesItalico.length ? nomesItalico.flatMap(n => n.split(',')) : colunaMagias.split(','))
      .map(n => n.replace(/[*_`]/g, '').trim())
      .filter(Boolean);

    nomesLinha.forEach(n => nomes.add(n));
  }

  return [...nomes];
}

/**
 * Extrai magias sempre preparadas descritas em texto corrido.
 * Ex.: "Você sempre tem a magia *Marca do Caçador* preparada."
 */
function extrairMagiasSemprePreparadasTexto(descricao) {
  if (!descricao) return [];
  const texto = descricao.toLowerCase();
  // Mesma razao da funcao irma acima: o invariante e "preparad", nao "sempre".
  if (!texto.includes('preparad')) return [];

  // Se a descricao contem uma tabela DE NIVEL, pular -- a funcao de tabela
  // cuida disso. A guarda anterior desistia diante de QUALQUER tabela
  // markdown com numero na primeira coluna, e por isso engolia o Mapa
  // Estelar (Circulo das Estrelas), cuja unica tabela e "1d6 | Formato do
  // Mapa" -- aparencia do objeto, nada a ver com magia. O que distingue as
  // duas e o cabecalho: tabela de nivel diz "Nivel" nele.
  if (/\|[^|\n]*[Nn][íi]vel[^|\n]*\|/.test(descricao)) return [];

  // Extrair apenas de frases que contenham "sempre" + "preparad" + itálico juntos
  // Ex.: "Você sempre tem a magia *Destruição Divina* preparada."
  const nomes = [];
  // Dividir em frases/parágrafos (por ponto final, quebra de linha dupla, ou **negrito**)
  const frases = descricao.split(/(?:\.\s|\n\n|\*\*)/);
  for (const frase of frases) {
    const fl = frase.toLowerCase();
    // A frase de concessao do Mapa Estelar (Classes.md:2493) comeca com
    // "Enquanto estiver segurando o mapa, voce tem as magias *Orientacao* e
    // *Raio Guia* preparadas" -- exigir "sempre" AQUI, na mesma frase,
    // descartava a concessao inteira.
    if (!fl.includes('preparad')) continue;
    // Extrair nomes em itálico dentro desta frase
    const regex = /\*([^*]+)\*/g;
    let match;
    while ((match = regex.exec(frase)) !== null) {
      const nome = (match[1] || '').trim();
      if (!nome) continue;
      if (nome.includes('|')) continue;
      if (nome.length < 2) continue;
      // Descartar headers/textos longos que não são nomes de magias
      if (nome.includes('º') || nome.includes('Círculo') || nome.includes('Nível')) continue;
      nomes.push(nome);
    }
  }
  return nomes;
}

/**
 * Obtém magias sempre preparadas concedidas no nível atual.
 */
export async function obterMagiasSemprePreparadasNivel(classe, subclasse, nivel, opcaoEscolhida) {
  const classeData = await getClasse(classe);
  if (!classeData) return [];

  const nomes = new Set();

  // Montar mapa: nome de feature -> conjunto de subclasses que a possuem
  // Usado para excluir features de classe que pertencem a OUTRAS subclasses
  const featParaSubclasses = new Map();
  if (classeData.subclasses) {
    for (const s of classeData.subclasses) {
      for (const c of (s.caracteristicas || [])) {
        if (!featParaSubclasses.has(c.nome)) featParaSubclasses.set(c.nome, new Set());
        featParaSubclasses.get(c.nome).add(s.nome);
      }
    }
  }

  const featsClasse = (classeData.caracteristicas || []).filter(f => {
    const subs = featParaSubclasses.get(f.nome);
    // Se a feature não existe em nenhuma subclasse, manter (é feature de classe)
    if (!subs) return true;
    // Se existe em subclasses, manter apenas se pertence à subclasse escolhida
    return subs.has(subclasse);
  });

  // Características da classe no nível atual (texto corrido + tabela)
  featsClasse
    .filter(c => c.nivel === nivel)
    .forEach(f => {
      extrairMagiasSemprePreparadasTexto(f.descricao).forEach(n => nomes.add(n));
      extrairMagiasSemprePreparadasTabela(f.descricao, nivel, opcaoEscolhida).forEach(n => nomes.add(n));
    });

  // Características da classe de níveis anteriores (apenas tabela, para linhas que escalam por nível)
  featsClasse
    .filter(c => c.nivel < nivel)
    .forEach(f => {
      extrairMagiasSemprePreparadasTabela(f.descricao, nivel, opcaoEscolhida).forEach(n => nomes.add(n));
    });

  // Características da subclasse no nível
  if (subclasse) {
    const sc = (classeData.subclasses || []).find(s => s.nome === subclasse);
    const featsSubclasse = sc?.caracteristicas || [];

    featsSubclasse
      .filter(c => c.nivel === nivel)
      .forEach(f => {
        extrairMagiasSemprePreparadasTexto(f.descricao).forEach(n => nomes.add(n));
        extrairMagiasSemprePreparadasTabela(f.descricao, nivel, opcaoEscolhida).forEach(n => nomes.add(n));
      });

    featsSubclasse
      .filter(c => c.nivel < nivel)
      .forEach(f => {
        extrairMagiasSemprePreparadasTabela(f.descricao, nivel, opcaoEscolhida).forEach(n => nomes.add(n));
      });
  }

  if (nomes.size === 0) return [];

  const indice = await getIndiceMagias();
  const idx = indice?.magias || [];
  return [...nomes]
    .map(nome => {
      const m = idx.find(x => x.nome === nome);
      return m ? { nome, circulo: (m.circulo ?? 1) } : null;
    })
    .filter(Boolean);
}

/**
 * Obtém todas as magias sempre preparadas até o nível atual.
 */
export async function obterTodasMagiasSemprePreparadas(classe, subclasse, nivelAtual, opcaoEscolhida) {
  const todas = [];
  for (let nivel = 1; nivel <= (nivelAtual || 1); nivel++) {
    const magias = await obterMagiasSemprePreparadasNivel(classe, subclasse, nivel, opcaoEscolhida);
    todas.push(...magias);
  }
  return todas;
}

// Magias concedidas automaticamente por espécie nos níveis 3 e 5 (Legado Ínfero do
// Tiferino, Linhagem Élfica do Elfo). Mesmos nomes usados em site/js/pages/sheet.js
// (SUBTRACOS_ESPECIE) e site/js/pages/creator.js (obterTruquesEspecie) para os truques
// de nível 1 dessas mesmas espécies/escolhas.
export const MAGIAS_LEGADO_ESPECIE = {
  'Tiferino': {
    'Abissal': { 3: 'Raio Nauseante', 5: 'Paralisar Pessoa' },
    'Ctônico': { 3: 'Vitalidade Vazia', 5: 'Raio do Enfraquecimento' },
    'Infernal': { 3: 'Repreensão Diabólica', 5: 'Escuridão' }
  },
  'Elfo': {
    'Alto Elfo': { 3: 'Detectar Magia', 5: 'Passo Nebuloso' },
    'Drow': { 3: 'Fogo das Fadas', 5: 'Escuridão' },
    'Elfo Silvestre': { 3: 'Passos Largos', 5: 'Passo Sem Rastro' }
  }
};

// Nome do traço-pai exibido no level-up para cada espécie da tabela acima — mesmo
// mapeamento de TITULO_TRACO_PAI em site/js/pages/sheet.js:11260-11264.
const TITULO_LEGADO_ESPECIE = {
  'Tiferino': 'Legado Ínfero',
  'Elfo': 'Linhagem Élfica'
};

/**
 * Obtém características de espécie que desbloqueiam em níveis específicos
 */
export async function obterCaracteristicasEspecieNivel(especie, nivel, tracosEscolhidos = []) {
  const especiesData = await getEspecies();
  const especieData = especiesData?.especies?.find(e => e.nome === especie);

  if (!especieData) return [];

  const caracteristicas = [];

  // Traços que só passam a valer num nível: derivados do DADO, não de ramos
  // por nome de espécie.
  //
  // Antes havia dois `if` escritos à mão -- um para Golias/Forma Grande (nv5),
  // outro para Aasimar/Revelação Celestial (nv3) -- e um comentário dizendo
  // "Adicione outras espécies conforme necessário". O Voo Dracônico do
  // Draconato (Espécies.md:106, "No nível 5 do personagem") nunca foi
  // adicionado, e um ramo que não existe não falha: só não anuncia nada. O
  // jogador chegava ao nível 5 sem aviso de que ganhou voo.
  //
  // A regex é a MESMA que a ficha já usa para esconder o traço antes do nível
  // (site/js/sheet/caracteristicas.js:201) -- as duas telas passam a concordar
  // por construção, em vez de por coincidência. Medido sobre as 11 espécies de
  // dados/: casa em exatamente três traços, os dois que já eram anunciados
  // mais o que faltava.
  const RE_NIVEL_DO_TRACO = /(?:a partir do |no )n[ií]vel (\d+)/i;
  for (const traco of (especieData.tracos || [])) {
    const m = traco.descricao?.match(RE_NIVEL_DO_TRACO);
    if (m && Number(m[1]) === nivel) {
      caracteristicas.push({ nome: traco.nome, descricao: traco.descricao });
    }
  }

  // Tiferino (Legado Ínfero) / Elfo (Linhagem Élfica): magia automática nos níveis 3 e 5
  const legadoEscolhido = (tracosEscolhidos || [])[0];
  const nomeMagiaLegado = MAGIAS_LEGADO_ESPECIE[especie]?.[legadoEscolhido]?.[nivel];
  if (nomeMagiaLegado) {
    const indice = await getIndiceMagias();
    const magiaIdx = (indice?.magias || []).find(m => m.nome === nomeMagiaLegado);
    const tituloPai = TITULO_LEGADO_ESPECIE[especie] || especie;
    caracteristicas.push({
      nome: `${tituloPai} — ${legadoEscolhido}`,
      descricao: `Você aprende automaticamente a magia *${nomeMagiaLegado}*, que fica sempre preparada. Pode conjurá-la uma vez sem gastar um espaço de magia; esse uso gratuito é restaurado ao completar um Descanso Longo.`,
      magiaConcedida: { nome: nomeMagiaLegado, circulo: magiaIdx?.circulo ?? (nivel === 3 ? 1 : 2) }
    });
  }

  // Adicione outras espécies conforme necessário

  return caracteristicas;
}

/**
 * Obtém características da subclasse que o personagem ganha em um nível específico
 * @param {string} classe - Nome da classe
 * @param {string} subclasse - Nome da subclasse escolhida
 * @param {number} nivel - Nível do personagem
 * @returns {Array} Lista de features da subclasse para esse nível
 */
export async function obterCaracteristicasSubclasseNivel(classe, subclasse, nivel) {
  if (!subclasse) return [];
  
  const classeData = await getClasse(classe);
  if (!classeData || !classeData.subclasses) return [];
  
  const sc = classeData.subclasses.find(s => s.nome === subclasse);
  if (!sc || !sc.caracteristicas) return [];
  
  return sc.caracteristicas.filter(c => c.nivel === nivel);
}

/**
 * Extrai magias de domínio da descrição da feature de magias da subclasse
 * Parseia a tabela markdown para retornar as magias do nível atual
 * @param {string} classe - Nome da classe
 * @param {string} subclasse - Nome da subclasse
 * @param {number} nivel - Nível do personagem
 * @returns {Array} Lista de { nome, circulo } das magias de domínio para esse nível
 */
export async function obterMagiasDominioNivel(classe, subclasse, nivel) {
  if (!subclasse) return [];
  
  const classeData = await getClasse(classe);
  if (!classeData || !classeData.subclasses) return [];
  
  const sc = classeData.subclasses.find(s => s.nome === subclasse);
  if (!sc || !sc.caracteristicas) return [];
  
  // Encontrar a feature de magias de dominio (nivel 3). O livro usa
  // "Magias DE Dominio" (Clerigo), mas tambem "Magias DO Circulo da Lua",
  // "Magias DO Vigilante das Sombras", "Magias DA ..." -- o filtro antigo
  // exigia "de" e por isso deixava essas de fora, com a rota inteira morta.
  const magiasFeat = sc.caracteristicas.find(c =>
    c.nivel === 3 && /^magias?\s+d[aeo]s?\s/i.test((c.nome || '').trim())
  );
  if (!magiasFeat) return [];

  // Uma caracteristica com MAIS DE UMA tabela de nivel oferece tabelas
  // ALTERNATIVAS, e qual delas vale depende de uma escolha do jogador que
  // esta funcao nao recebe -- Magias do Circulo da Terra tem quatro (uma por
  // terreno: arido, polar, temperado, tropical) e o livro manda escolher UMA
  // a cada Descanso Longo. Somar as quatro entregaria 12 magias no nivel 3
  // onde o livro concede 3, misturando terrenos que o personagem nao
  // escolheu. Enquanto a escolha de terreno nao for modelada, a resposta
  // honesta e lista vazia, nao um palpite. Medido: das caracteristicas de
  // nivel 3 cujo nome casa o filtro acima, so Circulo da Terra tem mais de
  // uma tabela de nivel.
  const tabelasDeNivel = (magiasFeat.descricao.match(/\|[^|\n]*[Nn][íi]vel[^|\n]*\|/g) || []).length;
  if (tabelasDeNivel > 1) return [];

  // Parsear tabela markdown para extrair magias por nível
  // Formato: | 3 | *Magia1, Magia2, Magia3* |
  const linhas = magiasFeat.descricao.split('\n');
  const nomesMagias = [];
  
  for (const linha of linhas) {
    // Procurar linhas da tabela com nível e magias
    // O nivel pode vir em italico na tabela do livro ("| *3* | *Marca do
    // Cacador, Perdicao* |", Magias do Juramento da Vinganca) -- a funcao
    // irma extrairMagiasSemprePreparadasTabela (:510) ja tolerava os
    // asteriscos; esta nao, e por isso essa unica trilha do Paladino ficava
    // de fora da rota de dominio enquanto as outras tres entravam.
    const match = linha.match(/\|\s*\**(\d+)\**\s*\|\s*\*([^*]+)\*\s*\|/);
    if (match) {
      const nivelMagia = parseInt(match[1]);
      if (nivelMagia === nivel) {
        const nomes = match[2].split(',').map(n => n.trim()).filter(n => n);
        nomesMagias.push(...nomes);
      }
    }
  }
  
  if (nomesMagias.length === 0) return [];
  
  // Buscar círculo real de cada magia no índice
  const indice = await getIndiceMagias();
  const indiceMagias = indice?.magias || [];
  
  return nomesMagias.map(nome => {
    const magiaIdx = indiceMagias.find(m => m.nome === nome);
    return { nome, circulo: magiaIdx?.circulo || 1 };
  });
}

/**
 * Mapa "nome da magia -> circulo real", lido do indice de magias.
 *
 * Existe para as escolhas de subclasse que gravam em `magias_preparadas`
 * (Descobertas Magicas): a tabela de regra, sendo sincrona, nao tem como
 * descobrir sozinha se o jogador escolheu um truque ou uma magia de 3o
 * circulo. Nome ausente do indice fica FORA do mapa de proposito -- quem
 * grava decide o que fazer com a falta (hoje, o mesmo `1` de sempre), em vez
 * de receber um zero silencioso que viraria "truque".
 *
 * @param {string[]} nomes
 * @returns {Promise<Object<string, number>>}
 */
async function _circulosDoIndice(nomes) {
  if (!nomes.length) return {};
  const indice = await getIndiceMagias();
  const indiceMagias = indice?.magias || [];
  const mapa = {};
  for (const nome of nomes) {
    const magiaIdx = indiceMagias.find(m => m.nome === nome);
    if (magiaIdx && typeof magiaIdx.circulo === 'number') mapa[nome] = magiaIdx.circulo;
  }
  return mapa;
}

/**
 * Obtém TODAS as magias de domínio/subclasse para todos os níveis até o nível atual
 * @param {string} classe
 * @param {string} subclasse
 * @param {number} nivelAtual
 * @returns {Array} Lista de { nome, circulo } de todas as magias de domínio
 */
export async function obterTodasMagiasDominio(classe, subclasse, nivelAtual) {
  if (!subclasse) return [];
  const todas = [];
  // Magias de domínio são concedidas nos níveis 3, 5, 7, 9
  for (const nivel of [3, 5, 7, 9]) {
    if (nivel > nivelAtual) break;
    const magias = await obterMagiasDominioNivel(classe, subclasse, nivel);
    todas.push(...magias);
  }
  return todas;
}

/**
 * Monta os caches de magias automáticas (domínio e sempre preparadas) de
 * TODAS as classes do personagem, cada uma no nível DELA.
 *
 * Existe porque esses dois caches não são só exibição: `magiasSempreCache`
 * é o crivo de `migrarMagiasSemprePreparadas` (sheet/migracoes.js), que
 * REMOVE de `char.magias_preparadas` toda entrada `origem: 'sempre'`
 * ausente dele e persiste a remoção. Montá-lo pelos ESPELHOS
 * (`char.classe`/`char.subclasse`/`char.nivel`, que apontam sempre para a
 * classe INICIAL e para o nível TOTAL) apagava, na reabertura da ficha,
 * toda magia sempre preparada concedida por uma segunda classe -- e, no
 * sentido inverso, marcava como "sempre" magias do nível TOTAL quando a
 * classe inicial era a conjuradora. Por classe e no nível da classe, os
 * dois lados fecham.
 *
 * `opcaoEscolhida` (o terreno do Círculo da Terra) é repassada porque é o
 * mesmo argumento que o PRODUTOR usa ao conceder (subirDeNivel, no bloco
 * de magias sempre preparadas): cache e produtor precisam enxergar a
 * mesma lista, senão a higienização volta a apagar o que a subida deu.
 *
 * @param {object} personagem Personagem (usa classes[], com fallback de espelho em classesDe).
 * @returns {Promise<{dominio: Array, sempre: Array}>} listas de { nome, circulo } acumuladas.
 */
export async function obterMagiasAutomaticasDoPersonagem(personagem) {
  const dominio = [];
  const sempre = [];
  const opcaoSubclasse = personagem?.escolhas_classe?.circulo_terra_terreno;
  for (const c of classesDe(personagem)) {
    dominio.push(...await obterTodasMagiasDominio(c.classe, c.subclasse, c.nivel));
    sempre.push(...await obterTodasMagiasSemprePreparadas(c.classe, c.subclasse, c.nivel, opcaoSubclasse));
  }
  return { dominio, sempre };
}

// ESPACOS DE MAGIA NAO SAO MAIS GRAVADOS AQUI. Desde o sub-projeto 4 o
// TOTAL e derivado da regra a cada leitura por montarReservasDeEspacos
// (sheet/reservas-espacos.js); `char.espacos_magia` guarda so `usados`,
// por fonte e circulo. `atualizarEspacosMagia` escrevia chaves NUMERICAS
// de circulo -- a forma antiga -- e era a unica coisa que ainda produzia
// a forma hibrida que o docblock daquele arquivo nomeia como o unico caso
// desprotegido. O laco que movia o circulo de pacto do Bruxo (1 -> 2 -> 3)
// saiu junto: a reserva derivada ja responde o circulo certo pelo nivel de
// Bruxo.

/**
 * Adiciona uma magia concedida automaticamente (domínio/sempre-preparada) a uma lista.
 * Se a magia já existe na lista (ex.: escolhida manualmente antes da característica
 * que a concede automaticamente existir), promove a entrada existente em vez de
 * ignorá-la - senão ela fica presa contando no limite normal de magias preparadas.
 */
export function _concederMagiaAutomatica(lista, magia, origem) {
  const existente = lista.find(m => m.nome === magia.nome);
  if (existente) {
    existente.origem = origem;
    existente.circulo = magia.circulo;
  } else {
    lista.push({ ...magia, origem });
  }
}

/**
 * Verdadeiro quando o personagem adquire acesso a um círculo de espaços de
 * magia que não possuía no nível anterior (ex.: nível 3 = 2º círculo pela
 * primeira vez). Usado pelo bônus recorrente de "Versado em [Escola]".
 */
function ganhouNovoCirculoDeEspacos(tabelaCaracteristicas, nivelAnterior, novoNivel) {
  const espacosAntes = nivelAnterior >= 1 ? getEspacosMagia(tabelaCaracteristicas, nivelAnterior) : {};
  const espacosDepois = getEspacosMagia(tabelaCaracteristicas, novoNivel);
  return Object.entries(espacosDepois).some(([circulo, dados]) => {
    const totalDepois = dados?.total || 0;
    const totalAntes = espacosAntes[circulo]?.total || 0;
    return totalDepois > 0 && totalAntes === 0;
  });
}

/**
 * Ajusta PV maximo e atual quando o modificador de Constituicao muda.
 *
 * Regra retroativa do livro: cada +1 de modificador vale +1 PV por nivel ja
 * conquistado. Vale nos DOIS sentidos -- modificador que cai subtrai a mesma
 * conta --, para que desfazer uma edicao manual desfaca tambem o PV que ela
 * concedeu. O PV maximo nunca fica abaixo de 1; o PV atual acompanha o delta
 * efetivamente aplicado, sem passar do teto nem cair abaixo de 0 -- 0 PV e
 * estado legitimo (inconsciente) e nao pode ser "corrigido" para 1.
 *
 * @param {object} personagem - Personagem a ajustar (usa `nivel` como multiplicador).
 * @param {number} modAntes - Modificador de Constituicao antes da mudanca.
 * @param {number} modDepois - Modificador de Constituicao depois da mudanca.
 * @returns {number} Delta de PV efetivamente aplicado ao maximo (0 se nada mudou).
 */
export function aplicarPvRetroativoPorCon(personagem, modAntes, modDepois) {
  if (!personagem || modDepois === modAntes) return 0;
  const nivel = personagem.nivel || 1;
  const maxAntes = personagem.pv_max || 1;
  personagem.pv_max = Math.max(1, maxAntes + (modDepois - modAntes) * nivel);
  const aplicado = personagem.pv_max - maxAntes;
  const teto = personagem.pv_max_override || personagem.pv_max;
  const atualAntes = personagem.pv_atual ?? 0;
  // Piso 0, nao 1: pv_atual === 0 e estado legitimo (inconsciente/caindo),
  // nao um erro a corrigir. Um piso de 1 ressuscitaria em silencio um
  // personagem a 0 PV cujo modificador de Constituicao caisse (edicao
  // manual para baixo, ou reversao de uma edicao que subiu CON). Por isso um
  // personagem JA a 0 fica em 0 nos dois sentidos -- so cura de verdade tira
  // alguem de 0, nunca um recalculo de atributo. Fora desse caso, o piso
  // geral e 0 (nunca negativo) e o teto continua valendo.
  personagem.pv_atual = atualAntes === 0 ? 0 : Math.max(0, Math.min(teto, atualAntes + aplicado));
  return aplicado;
}

/**
 * Traduz as opcoes de PV da TELA de level-up para o vocabulario que
 * `pvGanhoAoSubir` (regras-multiclasse-progressao.js) entende.
 *
 * Sao dois vocabularios diferentes, e essa e a unica ponte entre eles: a UI
 * grava `hp_modo: 'rolado'` + `hp_rolado` (levelup-validations.js:30-32),
 * enquanto a funcao de regra le apenas `opcoes.rolado`. Repassar `opcoes`
 * cru faria `rolado` chegar `undefined` e o modo "rolar" morreria EM
 * SILENCIO -- o jogador pediria a rolagem e receberia sempre a media. A
 * caracterizacao nao pegaria: a escada de teste nunca rola.
 *
 * Valor nao numerico ou fora de [1, faces] e DESCARTADO, caindo na media --
 * e o que a subida sempre fez, antes do sub-projeto 5, pela funcao de PV
 * que ela usava (removida na Tarefa 3b, quando ficou sem chamador).
 * Repassar o valor cru seria pior que inutil: `pvGanhoAoSubir` PRENDE o
 * valor no intervalo, e um "99" digitado a mao viraria dado cheio em vez
 * de media.
 *
 * @param {Object} opcoes Opcoes da subida, no formato da tela.
 * @param {number} faces Faces do dado de vida da classe que sobe.
 * @returns {{rolado?: number}} Opcoes no formato de pvGanhoAoSubir.
 */
function opcoesPvDaSubida(opcoes, faces) {
  if (opcoes.hp_modo !== 'rolado') return {};
  const rolado = parseInt(opcoes.hp_rolado);
  if (Number.isNaN(rolado) || rolado < 1 || rolado > faces) return {};
  return { rolado };
}

/**
 * Monta a mensagem da pendencia 'ritual_bonus_proficiencia' (crescimento
 * do Conjurador Ritualista, Talentos.md:370).
 *
 * RAMIFICA DE PROPOSITO. O portao e um INVARIANTE (contagem de magias do
 * talento x Bonus de Proficiencia do nivel TOTAL), entao ele dispara em
 * DOIS casos diferentes, e a mensagem antiga afirmava o primeiro nos dois
 * (achado Important 2 da revisao final -- a tela contava ao jogador uma
 * regra que nao tinha acontecido):
 *
 *   1. o Bonus de Proficiencia subiu NESTA subida (niveis 5, 9, 13 e 17
 *      do total, livro:2047) -- e o evento que o talento descreve;
 *   2. a ficha ja estava em DIVIDA antes desta subida (cruzou um patamar
 *      quando o crescimento ainda nao existia, ou perdeu uma magia para
 *      outra tela) e o Bonus de Proficiencia nao mudou aqui.
 *
 * @param {{deve: number, tem: number, faltam: number}} pendente Saida de
 *   `ritualBonusPendente` para o nivel TOTAL NOVO.
 * @param {number} nivelTotalAnterior Nivel TOTAL de ANTES desta subida --
 *   e a comparacao dele com `pendente.deve` que separa os dois casos.
 * @returns {string} Mensagem verdadeira nos dois casos.
 */
function montarMensagemRitualBonus(pendente, nivelTotalAnterior) {
  const quantas = pendente.faltam === 1
    ? '1 magia ritual de 1º círculo'
    : `${pendente.faltam} magias rituais de 1º círculo distintas`;
  const subiuAgora = pendente.deve > bonusProficiencia(nivelTotalAnterior);
  return subiuAgora
    ? `Seu Bônus de Proficiência subiu para +${pendente.deve}: escolha ${quantas} para o Conjurador Ritualista.`
    : `O Conjurador Ritualista mantém ${pendente.deve} magias rituais de 1º círculo sempre preparadas ` +
      `(Bônus de Proficiência +${pendente.deve}) e sua ficha tem ${pendente.tem}: escolha ${quantas}.`;
}

/**
 * Função principal de level-up
 * @param {Object} personagem - Objeto do personagem
 * @param {Object} opcoes - Opções para o level-up
 * @returns {Object} Resultado do level-up com informações sobre o que mudou
 */
export async function subirDeNivel(personagem, opcoes = {}) {
  // A classe em que o nivel entra. Sem `opcoes.classe`, e a classe INICIAL
  // -- o comportamento de antes do sub-projeto 5, preservado para todo
  // chamador que ainda nao passa a escolha (testes e2e existentes, e o
  // proprio wizard ate a Tarefa 6).
  const classeQueSobe = opcoes.classe || personagem.classe;
  // NORMALIZA A FICHA LEGADA ANTES DE LER QUALQUER NIVEL.
  //
  // `classes[]` e a fonte da verdade dos dois niveis, e quase sempre ja
  // existe: migrarMulticlasse() roda na abertura da ficha (pages/sheet.js).
  // Mas nao e garantido -- `store.criarPersonagemVazio()` monta so os
  // espelhos, e `subirDeNivel` tambem e chamada direto, sem passar pela
  // ficha (toda a suite de regras faz isso).
  //
  // Tem de vir ANTES de `contextoDeSubida`, nao so antes da gravacao: os
  // dois leem o mesmo estado por caminhos diferentes, e o migrador repara
  // um `nivel` ausente ou 0 com o piso de 1 (`Number(p.nivel) || 1`)
  // enquanto `nivelTotal()` leria 0. Migrando depois, uma ficha com
  // `nivel: 0` era relatada como indo ao nivel 1 e terminava no 2 --
  // o resumo e o personagem discordavam.
  //
  // Delega ao MIGRADOR, o unico caminho de criacao autorizado (idempotente,
  // e ainda preserva o gasto legado de dado de vida). Montar o array a mao
  // aqui abriria um SEGUNDO caminho de criacao, que divergiria dele em
  // silencio.
  //
  // E o migrador PODE RECUSAR: ele devolve false sem criar nada quando nao
  // ha de onde migrar, isto e, quando o espelho `p.classe` esta vazio
  // (regras-multiclasse.js) -- exatamente o que `store.criarPersonagemVazio()`
  // produz (`classe: ''`). Uma ficha assim com `opcoes.classe` preenchida
  // passa pela checagem de `getClasse` (a classe pedida existe no catalogo)
  // e so morreria la embaixo, num TypeError de `classes.find`. Entao
  // FALHA FECHADA aqui, com erro nomeado -- mesma direcao de erro que
  // `podeEntrarEm` e `pvGanhoAoSubir` (regras-multiclasse-progressao.js) ja
  // adotam para entrada que nao da para honrar. Hoje o caminho e alcancavel
  // por `harness.subirAteNivel` (sempre passa `opcoes.classe`) e passa a ser
  // alcancavel pela UI na Tarefa 6.
  if (!Array.isArray(personagem.classes) || personagem.classes.length === 0) {
    migrarParaMulticlasse(personagem);
  }
  if (!Array.isArray(personagem.classes) || personagem.classes.length === 0) {
    return { sucesso: false, erro: 'Personagem sem classe: nao ha em que classe entrar o nivel' };
  }
  // OS DOIS NIVEIS, separados de proposito. `nivelNaClasse*` manda em tudo
  // que a CLASSE concede naquele patamar dela (caracteristicas, subclasse
  // no 3o, Aumento no Valor de Atributo, Dadiva Epica, estilo de luta,
  // manobras, expertise, grimorio). `nivelTotal*` manda no que o livro
  // amarra ao PERSONAGEM inteiro: teto de 20 e XP (livro:2037), Bonus de
  // Proficiencia (livro:2047) e caracteristicas de ESPECIE, cujo texto diz
  // "No nivel 5 DO PERSONAGEM" (Especies.md:106). Em classe unica os dois
  // sao o mesmo numero -- por isso cada uso abaixo foi decidido um a um, e
  // nenhum guarda automatico pega uma troca errada entre eles.
  const sub = contextoDeSubida(personagem, classeQueSobe);
  const nivelTotalAnterior = sub.nivelTotalAnterior;
  const nivelTotalNovo = sub.nivelTotalNovo;
  const nivelNaClasseAnterior = sub.nivelNaClasseAnterior;
  const nivelNaClasseNovo = sub.nivelNaClasseNovo;

  if (nivelTotalNovo > 20) {
    return { sucesso: false, erro: 'Nível máximo já alcançado (20)' };
  }

  if (!opcoes.ignorar_xp && !podeSubirDeNivel(personagem)) {
    const xpNecessario = XP_POR_NIVEL[nivelTotalNovo];
    const xpAtual = personagem.xp || 0;
    return {
      sucesso: false,
      erro: `XP insuficiente. Necessário: ${xpNecessario}, Atual: ${xpAtual}`
    };
  }

  // Pre-requisito de multiclasse (livro:2033): 13+ no atributo primario da
  // classe NOVA e de todas as atuais. `sub.permitido` (contextoDeSubida,
  // que delega a podeEntrarEm) ja vem sempre true para uma classe que o
  // personagem JA TEM -- o pre-requisito e so para se qualificar a uma
  // classe nova. O app bloqueia por padrao, mas o dono do produto decidiu
  // um escape explicito: `opcoes.dispensar_prerequisito`, porque muitas
  // mesas dispensam essa regra. Sem ele, recusa como pendencia -- mesmo
  // formato dos outros `tipo_pendencia`, para a tela poder responder com a
  // escolha do jogador (o botao "usar mesmo assim", levelup-cards.js).
  if (!sub.permitido && !opcoes.dispensar_prerequisito) {
    return {
      sucesso: false,
      pendente: true,
      tipo_pendencia: 'prerequisito_classe',
      mensagem: `Pré-requisito de multiclasse não atendido para ${sub.classe}.`,
      faltando: sub.faltando,
    };
  }

  // Carregar dados da classe QUE SOBE -- nao o espelho `personagem.classe`,
  // que num multiclasse aponta sempre para a classe inicial.
  const classeData = await getClasse(sub.classe);
  if (!classeData) {
    return { sucesso: false, erro: 'Dados da classe não encontrados' };
  }

  // Calcular ganho de PV pelo dado da CLASSE QUE SOBE.
  //
  // ORDEM OBRIGATORIA: `pvGanhoAoSubir` le o estado ANTERIOR a insercao em
  // `classes[]` -- e `nivelTotal(char) === 0` que ela usa para reconhecer o
  // 1o nivel do personagem e conceder o dado CHEIO (livro:2041). Esta linha
  // roda MUITO antes do bloco de aplicacao, entao a ordem esta garantida;
  // nao mova o calculo para perto da gravacao.
  //
  // `modConAntes` continua sendo calculado aqui porque alimenta
  // `aplicarPvRetroativoPorCon` mais abaixo -- `pvGanhoAoSubir` deriva o
  // seu proprio modificador do personagem.
  const modConAntes = calcMod(personagem.atributos.constituicao);
  const hpGanho = pvGanhoAoSubir(personagem, sub.classe, opcoesPvDaSubida(opcoes, sub.dadoVida));

  // Obter características do novo nível
  const caracteristicas = await obterCaracteristicasNivel(sub.classe, nivelNaClasseNovo);
  const caracteristicasEspecie = await obterCaracteristicasEspecieNivel(personagem.especie, nivelTotalNovo, personagem.tracos_escolhidos);

  // Verificar se precisa escolher subclasse
  const precisaSubclasse = exigeSubclasse(sub.classe, nivelNaClasseNovo) && !sub.subclasse;

  // Verificar se ganha aumento de atributo
  const ganhaAumentoAtributo = concedeAumentoAtributo(sub.classe, nivelNaClasseNovo);
  const requerDadivaEpica = exigeDadivaEpica(sub.classe, nivelNaClasseNovo);
  const exigeEspecializacao = exigeEspecializacaoBardo(sub.classe, nivelNaClasseNovo);
  const exigeEspecializacaoGuardiaoNivel = exigeEspecializacaoGuardiao(sub.classe, nivelNaClasseNovo);
  const exigeEstiloLutaNivel = exigeEstiloLuta(sub.classe, nivelNaClasseNovo);
  const exigeTrocaEstiloLutaGuerreiroNivel = exigeTrocaEstiloLutaGuerreiro(sub.classe, nivelNaClasseNovo);
  const exigeEspecializacaoLadinoNivel = exigeEspecializacaoLadino(sub.classe, nivelNaClasseNovo);
  const exigeExploradorHabilNivel = exigeExploradorHabil(sub.classe, nivelNaClasseNovo);
  const exigeAcademicoNivel = exigeAcademico(sub.classe, nivelNaClasseNovo);
  // RESÍDUO CORRIGIDO: exigia `nivelNaClasseNovo > 1`, então nunca disparava
  // no 1º nível DE MAGO -- e esse nível só chega aqui por multiclasse (a
  // criação nunca passa por subirDeNivel). O livro (Classes.md:4552-4556,
  // "Como um Personagem Multiclasse" do Mago) manda conceder as
  // características de nível 1 de Mago, e o Livro de Magias é uma delas
  // (Conjuração) -- negar a pendência deixava char.grimorio vazio para
  // sempre num Mago entrado por multiclasse. Em classe única nada muda:
  // subirDeNivel só é chamado a partir do 2º nível NA CLASSE (o 1º vem da
  // criação), então nivelNaClasseNovo nunca é 1 nesse caminho.
  const exigeGrimorioMago = sub.classe === 'Mago';
  // Quantidade de magias novas do Grimório neste nível: SEIS no 1º nível
  // de Mago (Classes.md, característica Conjuração -- "Ele começa com seis
  // magias de mago 1º círculo à sua escolha"), DUAS nos níveis seguintes
  // (crescimento normal, valor medido de antes desta correção). Mesmo
  // número que o criador já usa (creator/passo-magias.js:78).
  const grimorioQtd = nivelNaClasseNovo === 1 ? 6 : 2;
  const subclasseEfetivaManobras = opcoes.subclasse || sub.subclasse;
  const exigeManobrasNivel = exigeManobrasGuerreiro(sub.classe, subclasseEfetivaManobras, nivelNaClasseNovo);
  let magiasGrimorioSelecionadas = [];
  // Versado em [Escola] (subclasse do Mago): magias grátis de escola no grimório.
  const escolaSubclasseArcana = sub.classe === 'Mago' && Object.prototype.hasOwnProperty.call(ESCOLAS_SUBCLASSE_MAGO, subclasseEfetivaManobras)
    ? ESCOLAS_SUBCLASSE_MAGO[subclasseEfetivaManobras] : null;
  let qtdMagiasSubclasseArcana = 0;
  if (escolaSubclasseArcana) {
    const ganhouNovoCirculoNivel = ganhouNovoCirculoDeEspacos(classeData.tabela_caracteristicas, nivelNaClasseAnterior, nivelNaClasseNovo);
    if (nivelNaClasseNovo === 3) {
      qtdMagiasSubclasseArcana += 2; // bônus inicial de entrada na subclasse (já cobre o 2º círculo do próprio nível 3)
    } else if (ganhouNovoCirculoNivel) {
      qtdMagiasSubclasseArcana += 1; // bônus recorrente, apenas nos níveis seguintes que desbloqueiam novo círculo
    }
  }
  const exigeMagiasSubclasseArcana = qtdMagiasSubclasseArcana > 0;
  let magiasSubclasseArcanaSelecionadas = [];
  
  // Se precisa de escolhas do jogador e não foram fornecidas, retornar pendências
  if (precisaSubclasse && !opcoes.subclasse) {
    return {
      sucesso: false,
      pendente: true,
      tipo_pendencia: 'subclasse',
      mensagem: 'É necessário escolher uma subclasse para avançar para o nível 3'
    };
  }
  
  if (requerDadivaEpica && !opcoes.talento) {
    return {
      sucesso: false,
      pendente: true,
      tipo_pendencia: 'dadiva_epica',
      mensagem: 'É necessário escolher uma Dádiva Épica ou outro talento'
    };
  }

  if (ganhaAumentoAtributo && !opcoes.aumentos_atributo && !opcoes.talento) {
    return {
      sucesso: false,
      pendente: true,
      tipo_pendencia: 'aumento_atributo',
      mensagem: 'É necessário escolher aumento de atributos ou um talento'
    };
  }

  // Validação central: chamadas sem UI também precisam respeitar o ASI do talento.
  let talentoData = null;
  if (ganhaAumentoAtributo && opcoes.talento) {
    talentoData = encontrarTalentoPorNome(await getTalentos(), opcoes.talento);
    if (!talentoData) return { sucesso: false, erro: 'Talento selecionado não encontrado.' };
    // Pre-requisito de talento e do PERSONAGEM ("nivel 4+"), nao da classe.
    if (!talentoElegivelParaPersonagem(personagem, talentoData, nivelTotalNovo)) {
      return { sucesso: false, erro: 'O personagem não atende aos pré-requisitos do talento selecionado.' };
    }

    const ehASIPadrao = opcoes.talento === 'Aumento no Valor de Atributo';
    if (ehASIPadrao && !validarDistribuicaoASI(personagem, opcoes.aumentos_atributo, 20)) {
      return { sucesso: false, pendente: true, tipo_pendencia: 'talento_asi', mensagem: 'Distribua +2 em um atributo ou +1 em dois atributos, até o máximo 20.' };
    }
    if (!ehASIPadrao && opcoes.aumentos_atributo) {
      return { sucesso: false, erro: 'A distribuição direta de atributos só é válida com o talento Aumento no Valor de Atributo.' };
    }
    if (opcoes.talento === 'Dádiva da Proficiência em Perícia' &&
        !validarEscolhaDadivaProficiencia(personagem, opcoes)) {
      return { sucesso: false, pendente: true, tipo_pendencia: 'dadiva_proficiencia_pericia', mensagem: 'Escolha uma perícia em que já possua proficiência e ainda não tenha Especialização.' };
    }
    if (opcoes.talento === 'Dádiva da Resistência à Energia') {
      const tipos = opcoes.dadiva_resistencia_energia;
      if (!Array.isArray(tipos) || tipos.length !== 2 || new Set(tipos).size !== 2) {
        return { sucesso: false, pendente: true, tipo_pendencia: 'dadiva_resistencia_energia', mensagem: 'Selecione 2 tipos de energia diferentes.' };
      }
    }

    const atributosASI = obterAtributosASITalento(talentoData);
    const atributo = opcoes.talento_asi;
    const atual = Number(personagem?.atributos?.[atributo]);
    const limiteASI = getLimiteASITalento(talentoData);
    if (atributosASI.length > 0 && (!atributo || !atributosASI.includes(atributo) || !Number.isFinite(atual) || atual >= limiteASI)) {
      return { sucesso: false, pendente: true, tipo_pendencia: 'talento_asi', mensagem: `Escolha um atributo elegível abaixo de ${limiteASI} para o talento.` };
    }
    if (opcoes.talento === 'Resiliente') {
      const nomesAtributo = { forca: 'Força', destreza: 'Destreza', constituicao: 'Constituição', inteligencia: 'Inteligência', sabedoria: 'Sabedoria', carisma: 'Carisma' };
      if ((personagem.salvaguardas_proficientes || []).includes(nomesAtributo[atributo])) {
        return { sucesso: false, pendente: true, tipo_pendencia: 'talento_asi', mensagem: 'Escolha um atributo sem proficiência em salvaguarda para Resiliente.' };
      }
    }

    // `nivelTotalNovo` explicito: aqui `personagem.nivel` ainda e o TOTAL
    // ANTERIOR (sincronizarEspelhos so roda mais abaixo, dentro desta
    // mesma funcao) -- sem isto, Conjurador Ritualista contaria pelo
    // Bonus de Proficiencia de ANTES da subida sempre que ela cruzar um
    // patamar (so alcancavel em multiclasse: ASI e por nivel DE CLASSE).
    const validacaoCobertura = validarEscolhasTalento(
      personagem,
      opcoes.talento,
      montarEscolhasCoberturaTalento(opcoes),
      nivelTotalNovo
    );
    if (!validacaoCobertura.valido) {
      return {
        sucesso: false,
        pendente: true,
        tipo_pendencia: 'escolhas_talento',
        mensagem: validacaoCobertura.erro
      };
    }
  }

  if (ganhaAumentoAtributo && opcoes.aumentos_atributo && !opcoes.talento &&
      !validarDistribuicaoASI(personagem, opcoes.aumentos_atributo, 20)) {
    return { sucesso: false, erro: 'A distribuição de atributos é inválida.' };
  }

  if (exigeEspecializacao) {
    const selecionadas = Array.isArray(opcoes.bardo_expertise) ? opcoes.bardo_expertise : [];
    if (selecionadas.length !== 2) {
      return {
        sucesso: false,
        pendente: true,
        tipo_pendencia: 'bardo_expertise',
        mensagem: 'É necessário escolher 2 perícias para Especialização do Bardo'
      };
    }
  }

  if (exigeEspecializacaoGuardiaoNivel) {
    const selecionadas = Array.isArray(opcoes.guardiao_expertise) ? opcoes.guardiao_expertise : [];
    if (selecionadas.length !== 2) {
      return {
        sucesso: false,
        pendente: true,
        tipo_pendencia: 'guardiao_expertise',
        mensagem: 'É necessário escolher 2 perícias para Especialista do Guardião'
      };
    }
  }

  // Validar Estilo de Luta (Guardião/Paladino nível 2)
  if (exigeEstiloLutaNivel) {
    if (!opcoes.estilo_luta) {
      return {
        sucesso: false,
        pendente: true,
        tipo_pendencia: 'estilo_luta',
        mensagem: 'É necessário escolher um Estilo de Luta'
      };
    }
  }

  // Troca de Estilo de Luta do Guerreiro (Classes.md:3812): a cada nível
  // o Guerreiro PODE substituir o Estilo de Luta escolhido por outro --
  // não é obrigatório (o jogador pode manter o que já tem), e por isso
  // NUNCA bloqueia a subida de nível por si só (diferente da escolha
  // obrigatória de Guardião/Paladino, acima). Segue o mesmo padrão de
  // manobra_trocar_de/manobra_trocar_para (mais abaixo, no bloco de
  // Manobras do Mestre da Batalha): só passa a validar quando o jogador
  // começa a preencher um dos dois campos sem o outro (troca incompleta).
  // Reaproveita o tipo_pendencia 'estilo_luta' pela mesma razão que a
  // manobra reaproveita 'manobras_guerreiro' -- é a MESMA escolha de
  // classe, só que em modo de correção em vez de aquisição.
  if (exigeTrocaEstiloLutaGuerreiroNivel) {
    const estiloLutaTrocarDe = opcoes.estilo_luta_trocar_de || null;
    const estiloLutaTrocarPara = opcoes.estilo_luta_trocar_para || null;
    if ((estiloLutaTrocarDe && !estiloLutaTrocarPara) || (!estiloLutaTrocarDe && estiloLutaTrocarPara)) {
      return {
        sucesso: false,
        pendente: true,
        tipo_pendencia: 'estilo_luta',
        mensagem: 'Troca de Estilo de Luta incompleta: escolha o estilo de origem e o de destino'
      };
    }
  }

  // Validar Explorador Hábil (Guardião nível 2: 1 expertise + 2 idiomas)
  if (exigeExploradorHabilNivel) {
    if (!opcoes.explorador_expertise) {
      return {
        sucesso: false,
        pendente: true,
        tipo_pendencia: 'explorador_habil',
        mensagem: 'É necessário escolher 1 perícia para Especialização (Explorador Hábil)'
      };
    }
  }

  // Validar Manobras do Mestre da Batalha (níveis 3, 7, 10, 15)
  if (exigeManobrasNivel) {
    const qtdNova = getQuantidadeNovasManobras(nivelNaClasseNovo);
    const novasManobras = Array.isArray(opcoes.manobras_novas) ? opcoes.manobras_novas : [];
    const manobraTrocarDe = opcoes.manobra_trocar_de || null;
    const manobraTrocarPara = opcoes.manobra_trocar_para || null;

    if (novasManobras.length !== qtdNova) {
      return {
        sucesso: false,
        pendente: true,
        tipo_pendencia: 'manobras_guerreiro',
        mensagem: `É necessário escolher ${qtdNova} manobra(s) nova(s) para o Mestre da Batalha`
      };
    }
    if ((manobraTrocarDe && !manobraTrocarPara) || (!manobraTrocarDe && manobraTrocarPara)) {
      return {
        sucesso: false,
        pendente: true,
        tipo_pendencia: 'manobras_guerreiro',
        mensagem: 'Troca de manobra incompleta: escolha a manobra de origem e a de destino'
      };
    }
  }

  // PROFICIENCIAS DE CLASSE NOVA (livro:2051). So no PRIMEIRO nivel
  // naquela classe -- `ehPrimeiroNivelNaClasse`, e nunca
  // `ehPrimeiroNivelDoPersonagem`: os dois campos existem separados
  // exatamente por isto (regras-multiclasse-progressao.js:107).
  //
  // A classe INICIAL nao passa por aqui: as pericias dela vem do criador,
  // completas. Este bloco so ve classes adquiridas depois.
  const concessoesNovas = sub.ehPrimeiroNivelNaClasse && !sub.ehPrimeiroNivelDoPersonagem
    ? concessoesAoEntrarEm(sub.classe)
    : null;
  if (concessoesNovas) {
    if (concessoesNovas.pericias > 0) {
      const escolhida = opcoes.pericia_classe_nova;
      const jaTem = (personagem.pericias_proficientes || []).includes(escolhida);
      // MENSAGEM POR MOTIVO, nao uma so para os tres. Mandar "escolha 1
      // pericia nova" para quem foi recusado por JA POSSUIR a pericia manda
      // o chamador fazer algo que a tela nem oferece (o select filtra as
      // ja-possuidas). Mesmo padrao que regras-cobertura.js ja usa para
      // Habilidoso/Artifista/Musico, que sofrem do mesmo problema.
      if (jaTem) {
        return {
          sucesso: false,
          pendente: true,
          tipo_pendencia: 'proficiencias_classe_nova',
          mensagem: `Escolha uma perícia de ${sub.classe} em que ainda não tenha proficiência.`,
        };
      }
      if (escolhida && !concessoesNovas.opcoesPericia.includes(escolhida)) {
        return {
          sucesso: false,
          pendente: true,
          tipo_pendencia: 'proficiencias_classe_nova',
          mensagem: `"${escolhida}" não está na lista de perícias que ${sub.classe} concede em multiclasse.`,
        };
      }
      if (!escolhida) {
        return {
          sucesso: false,
          pendente: true,
          tipo_pendencia: 'proficiencias_classe_nova',
          mensagem: `Escolha 1 perícia nova concedida por ${sub.classe}.`,
        };
      }
    }
    if (concessoesNovas.instrumentos > 0) {
      const instrumento = opcoes.instrumento_classe_nova;
      const jaTemInstrumento = (personagem.proficiencias_instrumentos || []).includes(instrumento);
      // MINOR 2 da revisao: faltava conferir o instrumento contra uma
      // lista valida -- a pericia ja e conferida contra
      // `concessoesNovas.opcoesPericia` alguns paragrafos acima, mas o
      // instrumento so checava presenca e "ja tem". Sem isto, quem chama
      // o motor direto (sem passar pela tela) gravava qualquer string em
      // `proficiencias_instrumentos`.
      // Tres motivos, tres mensagens -- ver o comentario da pericia acima.
      if (jaTemInstrumento) {
        return {
          sucesso: false,
          pendente: true,
          tipo_pendencia: 'proficiencias_classe_nova',
          mensagem: `Escolha um Instrumento Musical em que ainda não tenha proficiência para ${sub.classe}.`,
        };
      }
      if (instrumento && !INSTRUMENTOS_MUSICAIS.includes(instrumento)) {
        return {
          sucesso: false,
          pendente: true,
          tipo_pendencia: 'proficiencias_classe_nova',
          mensagem: `"${instrumento}" não é um Instrumento Musical do livro.`,
        };
      }
      if (!instrumento) {
        return {
          sucesso: false,
          pendente: true,
          tipo_pendencia: 'proficiencias_classe_nova',
          mensagem: `Escolha 1 Instrumento Musical concedido por ${sub.classe}.`,
        };
      }
    }
  }

  // CRESCIMENTO DO CONJURADOR RITUALISTA (Talentos.md:370).
  //
  // `sub.nivelTotalNovo` e obrigatorio aqui: `personagem.nivel` ainda e o
  // nivel ANTERIOR neste ponto (sincronizarEspelhos so roda no fim desta
  // funcao), entao medir pelo espelho perderia exatamente a subida que
  // cruza o patamar -- o unico caso que interessa.
  const ritualPendente = ritualBonusPendente(personagem, sub.nivelTotalNovo);
  // HOISTED para fora do `if` -- achado da revisao (fix round 2): a
  // gravacao (mais abaixo) tem de consumir EXATAMENTE o que este guard
  // aprovou, nunca reler `opcoes.rituais_bonus_proficiencia` bruto de
  // novo. Mesmo padrao que `magiasGrimorioSelecionadas` (declarada bem
  // acima, atribuida so depois de validar, consumida na gravacao) --
  // sem essa reutilizacao, um array com nomes validos MAIS entradas
  // vazias/nao-string passava pela contagem do guard (que filtra e
  // conta so os `faltam` validos) mas a gravacao, lendo o array cru de
  // novo, gravava tambem a entrada vazia -- permanente e silencioso,
  // numa ficha sem "descer de nivel".
  let magiasRitualBonusSelecionadas = [];
  if (ritualPendente.faltam > 0) {
    // Normaliza ANTES de qualquer outra checagem -- achado de revisao:
    // `new Set(escolhidas)`/`.some(...)` rodavam antes do proprio
    // `Array.isArray`, entao um valor nao-array truthy (string, numero,
    // objeto) lancava TypeError em vez de devolver a pendencia. Mesmo
    // padrao de normalizacao que o bloco de grimorio usa logo abaixo
    // (`selecionadas`), inclusive descartando entradas vazias/nao-string
    // no mesmo passo -- substitui o antigo `.some((m) => !m)`.
    const escolhidas = Array.isArray(opcoes.rituais_bonus_proficiencia)
      ? opcoes.rituais_bonus_proficiencia.filter((nome) => typeof nome === 'string' && nome)
      : [];
    const distintas = new Set(escolhidas);
    // Recusa qualquer nome JA PREPARADO na ficha, de qualquer origem --
    // `nomesPreparados`, nao `jaEscolhidas` (achado Important 1 da
    // revisao final). Com `jaEscolhidas` (so as do proprio talento), uma
    // magia ritual ja preparada por outra via -- preparacao normal de
    // Mago/Clerigo/Druida, magia de dominio, Tocado Pelas Sombras --
    // passava por aqui e a gravacao logo abaixo, que deduplica por
    // `nome` + `origem`, empurrava uma SEGUNDA entrada com o mesmo nome:
    // ficha com a magia repetida, vaga de preparacao gasta numa magia que
    // o talento da de graca, "despreparar" apagando as duas de uma vez e
    // a troca de magias do assistente (levelup-ui.js, casa por `nome`)
    // podendo remover justo a entrada do talento -- tudo permanente, numa
    // ficha sem "descer de nivel". Ver o comentario de `nomesPreparados`
    // em regras-cobertura.js para por que o conserto e a OFERTA e nao a
    // deduplicacao da gravacao. Sobra folga: 11 rituais de 1o circulo no
    // acervo contra um `deve` maximo de 6.
    const repetindoPreparada = escolhidas.some((m) => ritualPendente.nomesPreparados.includes(m));
    // As magias validas sao as que o TALENTO PODE conceder (Talentos.md:370):
    // 1o circulo, com o marcador Ritual. `getMagiasRituais(1)` e a MESMA
    // fonte que a tela de escolha usa para montar as opcoes -- nunca
    // reimplementar o filtro aqui, ou tela e motor podem divergir sobre o
    // que e valido (db.js:126 documenta que nao existe campo `ritual`
    // booleano no acervo; so `tempo_conjuracao` contendo "ritual" marca a
    // magia). Sem esta checagem, `subirDeNivel` aceitava qualquer string --
    // inclusive uma magia de outro circulo ou sem Ritual nenhum -- e a
    // gravacao entrava como sempre-preparada para sempre, sem sinal
    // nenhum ao jogador (nao ha "descer de nivel" nesta ficha).
    const rituaisValidos = new Set((await getMagiasRituais(1)).map((m) => m.nome));
    const todasValidas = escolhidas.every((nome) => rituaisValidos.has(nome));
    if (escolhidas.length !== ritualPendente.faltam ||
        distintas.size !== ritualPendente.faltam || repetindoPreparada || !todasValidas) {
      return {
        sucesso: false,
        pendente: true,
        tipo_pendencia: 'ritual_bonus_proficiencia',
        mensagem: montarMensagemRitualBonus(ritualPendente, nivelTotalAnterior),
      };
    }
    magiasRitualBonusSelecionadas = escolhidas;
  }

  // Validar Acadêmico (Mago nível 2: 1 expertise em perícia acadêmica já proficiente)
  // Validar novas magias do grimório antes de alterar o personagem.
  if (exigeGrimorioMago) {
    const selecionadas = Array.isArray(opcoes.grimorio_selecionados)
      ? opcoes.grimorio_selecionados.filter(nome => typeof nome === 'string' && nome)
      : [];
    const espacosNovoNivel = getEspacosMagia(classeData.tabela_caracteristicas, nivelNaClasseNovo);
    const nomesNoGrimorio = new Set((personagem.grimorio || []).map(magia => magia?.nome));
    const indice = await getIndiceMagias();
    const magiasPorNome = new Map((indice?.magias || []).map(magia => [magia.nome, magia]));
    const escolhasValidas = selecionadas.length === grimorioQtd && new Set(selecionadas).size === grimorioQtd &&
      selecionadas.every(nome => {
        const magia = magiasPorNome.get(nome);
        return magia && Array.isArray(magia.classes) && magia.classes.includes('Mago') &&
          magia.circulo > 0 && (espacosNovoNivel[magia.circulo]?.total || 0) > 0 &&
          !nomesNoGrimorio.has(nome);
      });
    if (!escolhasValidas) {
      return {
        sucesso: false,
        pendente: true,
        tipo_pendencia: 'grimorio',
        mensagem: `Selecione ${grimorioQtd} magias novas de Mago para o Grimório em círculos para os quais você possui espaços`
      };
    }
    magiasGrimorioSelecionadas = selecionadas.map(nome => {
      const magia = magiasPorNome.get(nome);
      return { nome: magia.nome, circulo: magia.circulo };
    });
  }

  // Validar magias grátis de "Versado em [Escola]" (subclasse arcana do Mago)
  if (exigeMagiasSubclasseArcana) {
    const selecionadas = Array.isArray(opcoes.subclasse_magias_selecionadas)
      ? opcoes.subclasse_magias_selecionadas.filter(nome => typeof nome === 'string' && nome)
      : [];
    const espacosNovoNivel = getEspacosMagia(classeData.tabela_caracteristicas, nivelNaClasseNovo);
    const circuloMaxInicial = 2;
    const circuloMaxRecorrente = Math.max(...Object.keys(espacosNovoNivel)
      .filter(c => (espacosNovoNivel[c]?.total || 0) > 0).map(Number), 0);
    const nomesNoGrimorioArcana = new Set([...(personagem.grimorio || []), ...magiasGrimorioSelecionadas].map(magia => magia?.nome));
    const indiceArcana = await getIndiceMagias();
    const magiasPorNomeArcana = new Map((indiceArcana?.magias || []).map(magia => [magia.nome, magia]));
    const escolhasValidasArcana = selecionadas.length === qtdMagiasSubclasseArcana &&
      new Set(selecionadas).size === qtdMagiasSubclasseArcana &&
      selecionadas.every(nome => {
        const magia = magiasPorNomeArcana.get(nome);
        if (!magia || !Array.isArray(magia.classes) || !magia.classes.includes('Mago')) return false;
        if (magia.escola !== escolaSubclasseArcana) return false;
        if (magia.circulo <= 0 || nomesNoGrimorioArcana.has(nome)) return false;
        // No nível 3 com bônus duplo (inicial + recorrente), o círculo máximo permitido
        // é o maior entre os dois limites (2 do bônus inicial, ou o círculo com espaços
        // do bônus recorrente, o que for maior nesse nível).
        const circuloMaxPermitido = Math.max(circuloMaxInicial, circuloMaxRecorrente >= 1 && nivelNaClasseNovo === 3 ? circuloMaxRecorrente : 0);
        return magia.circulo <= (nivelNaClasseNovo === 3 ? circuloMaxPermitido : circuloMaxRecorrente) &&
          (espacosNovoNivel[magia.circulo]?.total || 0) > 0;
      });
    if (!escolhasValidasArcana) {
      return {
        sucesso: false,
        pendente: true,
        tipo_pendencia: 'subclasse_magias_arcana',
        mensagem: `Selecione ${qtdMagiasSubclasseArcana} magia(s) de ${escolaSubclasseArcana} para o Grimório`
      };
    }
    magiasSubclasseArcanaSelecionadas = selecionadas.map(nome => {
      const magia = magiasPorNomeArcana.get(nome);
      return { nome: magia.nome, circulo: magia.circulo };
    });
  }

  if (exigeAcademicoNivel) {
    const selecionadas = Array.isArray(opcoes.academico_expertise) ? opcoes.academico_expertise.filter(Boolean) : [];
    const periciasAcademicas = new Set(['Arcanismo', 'História', 'Investigação', 'Medicina', 'Natureza', 'Religião']);
    const proficientes = new Set(personagem.pericias_proficientes || []);
    const expertiseAtual = new Set(personagem.pericias_expertise || []);
    const pericia = selecionadas[0];
    if (selecionadas.length !== 1 || !periciasAcademicas.has(pericia) ||
        !proficientes.has(pericia) || expertiseAtual.has(pericia)) {
      return {
        sucesso: false,
        pendente: true,
        tipo_pendencia: 'academico',
        mensagem: 'Escolha 1 perícia elegível e já proficiente para Acadêmico do Mago'
      };
    }
  }
  
  // Escolhas de construcao que uma caracteristica de SUBCLASSE exige neste
  // nivel. Um laco so, alimentado por regras-subclasse-escolhas.js -- antes
  // disso o app tinha 15 tipos de pendencia escritos um a um, nenhum deles
  // cobrindo estas 12 caracteristicas, e o jogador terminava o nivel sem
  // aviso nenhum e sem a regra do livro aplicada.
  // `opcoes.subclasse || sub.subclasse` -- mesmo idioma do bloco de
  // Manobras, acima. No nivel 3 a subclasse esta sendo escolhida NESTA
  // chamada e so e gravada mais abaixo; ler so o estado anterior faria as
  // escolhas de nivel 3 (a maioria delas) nunca dispararem.
  // `sub.subclasse` e a subclasse DAQUELA classe, nao o espelho: num
  // Mago 5/Guerreiro 3 o espelho aponta para o Mago.
  const subclasseEfetiva = opcoes.subclasse || sub.subclasse;
  // Os truques que o personagem tem AGORA, antes desta subida escrever
  // qualquer coisa nele. Uma caracteristica pode ter dois ramos conforme o
  // personagem ja conhecer ou nao o truque que ela concede (Ilusoes
  // Aprimoradas, Classes.md:5074), e a GUARDA e a APLICACAO tem de escolher
  // o mesmo ramo: tirar duas fotos em momentos diferentes desta funcao faria
  // a guarda cobrar uma escolha que a aplicacao ignora, ou o contrario.
  const truquesAntesDaSubida = truquesConhecidosDe(personagem);
  const escolhasSubclasseNivel = linhasDaSubclasseNoNivel(subclasseEfetiva, nivelNaClasseNovo,
    truquesAntesDaSubida).filter((l) => l.tipo);
  for (const linha of escolhasSubclasseNivel) {
    const bruto = opcoes[linha.campo];
    const escolhido = (Array.isArray(bruto) ? bruto : [bruto]).filter(Boolean);
    const validas = opcoesDaLinha(linha);
    // `validas` vem vazia quando a lista e ASSINCRONA -- Descobertas
    // Magicas, cujas opcoes sao as listas de magia de Clerigo/Druida/Mago,
    // resolvidas por `opcoesDaLinhaAsync` (regras-subclasse-escolhas.js).
    // LIMITE CONHECIDO: para essas linhas a validacao aqui e so de
    // quantidade e distincao; quem oferece a lista certa e a tela.
    const foraDaLista = validas.length > 0 && escolhido.some((v) => !validas.includes(v));
    const repetida = new Set(escolhido).size !== escolhido.length;
    // "um truque de Mago DIFERENTE a sua escolha" (Classes.md:5074): um
    // truque que o personagem JA conhece nao concede nada -- a gravacao
    // deduplica por nome -- e a caracteristica inteira se perderia em
    // silencio, que e a issue #30 por outra porta. A tela nao oferece esses
    // nomes (o resolvedor os filtra); esta guarda fecha a mesma porta para
    // quem chama o motor direto, sem tela nenhuma.
    const jaConhecido = linha.destino === 'truque_de_subclasse' &&
      escolhido.some((v) => truquesAntesDaSubida.has(v));
    if (escolhido.length !== linha.quantidade || foraDaLista || repetida || jaConhecido) {
      return {
        sucesso: false,
        pendente: true,
        tipo_pendencia: linha.tipo,
        mensagem: `${linha.rotulo}: escolha ${linha.quantidade} opcao(oes) valida(s), sem repetir.`
      };
    }
  }

  // Aplicar mudanças ao personagem.
  //
  // A subida grava em `classes[]`, a FONTE DA VERDADE -- nunca mais no
  // espelho `personagem.nivel`. O array ja foi garantido no topo da funcao
  // (normalizacao da ficha legada, via migrador).
  let entradaDaClasse = personagem.classes.find((c) => c.classe === sub.classe);
  if (entradaDaClasse) {
    entradaDaClasse.nivel += 1;
  } else {
    entradaDaClasse = {
      classe: sub.classe, subclasse: '', nivel: 1, ordem: personagem.classes.length,
    };
    personagem.classes.push(entradaDaClasse);

    // Proficiencias reduzidas da classe nova (livro:2051).
    //
    // ARMADURA E ARMA NAO ENTRAM AQUI DE PROPOSITO: sao DERIVADAS de
    // `classes[]` por regras-multiclasse-proficiencias.js a cada leitura.
    // Grava-las tambem criaria uma segunda fonte da verdade para a mesma
    // regra -- o bug raiz que o cabecalho de regras-equipamento.js
    // registra. O que se grava aqui e so o que NAO da para derivar:
    // escolhas do jogador e ferramentas fixas.
    //
    // MINOR 1 da revisao: reusa `concessoesNovas` (calculado la em cima,
    // junto da pendencia) em vez de rederivar `concessoesAoEntrarEm(sub.classe)`.
    // Antes deste conserto os dois calculos podiam divergir -- a pendencia
    // rodava so com `ehPrimeiroNivelNaClasse && !ehPrimeiroNivelDoPersonagem`,
    // mas a escrita rodava sempre que a classe fosse nova em `classes[]`,
    // sem checar esse mesmo gate. Reusar a MESMA variavel fecha essa
    // divergencia: se a pendencia nao validou nada (bloco pulado), a
    // escrita tambem nao roda.
    if (concessoesNovas) {
      for (const ferramenta of concessoesNovas.ferramentas) {
        if (!Array.isArray(personagem.proficiencias_ferramentas)) personagem.proficiencias_ferramentas = [];
        if (!personagem.proficiencias_ferramentas.includes(ferramenta)) {
          personagem.proficiencias_ferramentas.push(ferramenta);
        }
      }
      if (concessoesNovas.pericias > 0 && opcoes.pericia_classe_nova) {
        if (!Array.isArray(personagem.pericias_proficientes)) personagem.pericias_proficientes = [];
        if (!personagem.pericias_proficientes.includes(opcoes.pericia_classe_nova)) {
          personagem.pericias_proficientes.push(opcoes.pericia_classe_nova);
        }
      }
      if (concessoesNovas.instrumentos > 0 && opcoes.instrumento_classe_nova) {
        if (!Array.isArray(personagem.proficiencias_instrumentos)) personagem.proficiencias_instrumentos = [];
        if (!personagem.proficiencias_instrumentos.includes(opcoes.instrumento_classe_nova)) {
          personagem.proficiencias_instrumentos.push(opcoes.instrumento_classe_nova);
        }
      }
    }
  }

  // Pre-requisito dispensado: fica registrado no personagem. Reusa o
  // registro generico de edicoes (char.edicoes, versionado, ja atravessa
  // sync e import) em vez de campo novo -- um campo novo entraria na
  // mesma janela de rollout que docs/PERGUNTAS-PENDENTES.txt ja registra
  // como pendencia aberta para espacos_magia e dados_vida.
  //
  // A CHAVE NAO PODE COMECAR COM "classes." -- `char.classes` e um ARRAY,
  // a fonte da verdade, e `reverterEdicao` (ficha-edicoes.js) escreve na
  // marca generica com `escreverCaminho`, que faz `atual[chave] ??= {}`
  // em cada segmento do caminho pontuado. Uma chave `classes.Paladino...`
  // faria esse `reduce` criar uma propriedade NOMEADA ("Paladino") sobre o
  // array -- Array.isArray continua true, mas char.classes ganharia uma
  // chave que nao e indice, corrompendo a fonte da verdade em memoria (nao
  // sobrevive a um JSON.stringify, mas ate recarregar a ficha ja e
  // suficiente para causar estrago). `prerequisitoDispensado.<Classe>` nao
  // aponta para nenhum campo real do personagem, entao o mesmo `reduce` so
  // cria um objeto inerte e novo -- inofensivo mesmo se `reverterEdicao`
  // for chamado com esta chave.
  //
  // O formato da entrada tambem segue o mesmo contrato de `aplicarEdicao`
  // (`original`, `editadoEm`): sem `original` uma entrada desta marca nao
  // se distingue de uma entrada corrompida por outro caminho -- aqui o
  // valor "original" e sempre `null` porque nao ha campo anterior a
  // restaurar, so a AUSENCIA da marca.
  //
  // A MARCA E PERMANENTE E NAO E REAVALIADA: se o jogador depois subir o
  // atributo que faltava para 13+, o selo continua -- ele registra que
  // AQUELE NIVEL foi adquirido sem o pre-requisito, um fato historico, nao
  // o estado atual da ficha. Reavaliar exigiria saber em que nivel cada
  // classe entrou, informacao que `classes[]` nao guarda, e produziria um
  // selo que aparece e some sozinho, pior que nenhum (ver
  // sheet/estado.js:seloPrerequisitoDispensado). Quem quiser remove: um
  // botao discreto ao lado do selo, na ficha (nao na impressao), que chama
  // o mesmo `reverterEdicao` generico que limpa qualquer entrada de
  // char.edicoes (sheet/edicao.js).
  if (opcoes.dispensar_prerequisito && !sub.permitido) {
    const edicoes = garantirEstadoEdicoes(personagem);
    edicoes.campos[`prerequisitoDispensado.${sub.classe}`] = {
      original: null, editadoEm: new Date().toISOString(), faltando: sub.faltando, origem: 'manual',
    };
  }

  // A subclasse escolhida NESTE nivel entra na entrada DAQUELA classe, nao
  // no espelho: um Mago 5/Guerreiro 3 escolhe a subclasse de GUERREIRO, e
  // sobrescrever `personagem.subclasse` apagaria a do Mago.
  // `sincronizarEspelhos`, logo abaixo, reflete no espelho quando -- e so
  // quando -- esta e a classe inicial.
  if (precisaSubclasse && opcoes.subclasse) {
    entradaDaClasse.subclasse = opcoes.subclasse;
  }

  // Recomputa `nivel`, `classe`, `subclasse` e as reservas de dado de vida
  // por TIPO, preservando o `usados` do jogador. `dados_vida_total` saiu
  // daqui: passa a ser derivado das reservas por esta mesma funcao.
  sincronizarEspelhos(personagem);

  personagem.pv_max += hpGanho;
  personagem.pv_atual += hpGanho; // Também aumenta PV atual (cura ao subir de nível)

  // Atualizar bônus de proficiência (se mudou). O Bonus de Proficiencia sai
  // do nivel TOTAL do personagem, nunca do nivel na classe (livro:2047).
  const bonusAnterior = bonusProficiencia(nivelTotalAnterior);
  const bonusNovo = bonusProficiencia(nivelTotalNovo);
  const bonusMudou = bonusNovo !== bonusAnterior;

  // A subclasse DA CLASSE QUE SOBE, ja com a escolha gravada logo acima --
  // nao o espelho `personagem.subclasse`, que num Mago 5/Guerreiro 3 aponta
  // para o Mago. Tudo daqui para baixo (truques fixos de subclasse,
  // caracteristicas de subclasse, magias de dominio e sempre preparadas)
  // le esta variavel, e a condicao e a MESMA da gravacao acima.
  const subclasseAtual = (precisaSubclasse && opcoes.subclasse) ? opcoes.subclasse : sub.subclasse;

  // ESPACOS DE MAGIA DE SUBCLASSE CONJURADORA (Cavaleiro Mistico,
  // Trapaceiro Arcano) NAO SAO MAIS GRAVADOS AQUI -- o total e derivado da
  // regra a cada leitura por montarReservasDeEspacos (sheet/reservas-espacos.js).
  // Saiu junto o laco que apagava circulos "que nao existem mais": nada
  // grava mais chave NUMERICA de circulo, entao nao ha o que limpar.
  //
  // Os TRUQUES fixos continuam: nao sao espaco de magia, e sim concessao da
  // caracteristica (Maos Magicas do Trapaceiro Arcano). Entram como truque
  // de classe normal, porque contam no limite da tabela da subclasse -- a
  // tela de selecao ja desconta esses truques da quantidade que pede ao
  // jogador (levelup-flow.js).
  //
  // A guarda `getEspacosSubclasseConjuradora(...).length > 0` que embrulhava
  // esta concessao saiu com o resto do bloco: `getTruquesFixosSubclasse` ja
  // devolve lista vazia sozinha quando nao ha o que conceder. Conferido por
  // medicao sobre as 13 classes x 2 subclasses conjuradoras x 20 niveis --
  // nao existe combinacao com truque fixo e sem espaco, logo a remocao da
  // guarda nao muda comportamento em nenhum ponto alcancavel.
  //
  // Continua vindo DEPOIS da gravacao da subclasse, acima: as duas
  // subclasses comecam a conjurar no nivel 3, o MESMO em que sao
  // escolhidas, e ler o estado anterior faria o Trapaceiro Arcano nunca
  // receber Maos Magicas.
  const truquesFixos = getTruquesFixosSubclasse(
    sub.classe, subclasseAtual, nivelNaClasseNovo);
  if (truquesFixos.length > 0) {
    if (!personagem.magias_conhecidas) personagem.magias_conhecidas = [];
    for (const nome of truquesFixos) {
      if (!personagem.magias_conhecidas.some(m => m.nome === nome)) {
        personagem.magias_conhecidas.push({ nome, circulo: 0, origem: 'subclasse_fixa' });
      }
    }
  }

  // Obter características de subclasse para este nível
  const caracteristicasSubclasse = await obterCaracteristicasSubclasseNivel(sub.classe, subclasseAtual, nivelNaClasseNovo);

  // Concessoes automaticas de subclasse: o livro concede sem perguntar nada
  // ("Voce adquire proficiencia em X"), e o app precisa conceder sem
  // perguntar nada. Antes desta tabela, cinco caracteristicas do livro
  // simplesmente nunca eram aplicadas -- nem aqui, nem na ficha, nem no
  // assistente -- e o jogador nao tinha como saber que faltava algo.
  // `truquesAntesDaSubida` e a MESMA foto que a guarda usou, algumas centenas
  // de linhas acima: e ela que decide entre os dois ramos das Ilusoes
  // Aprimoradas (conceder Ilusao Menor, ou o truque substituto que o jogador
  // escolheu). Tirar outra foto aqui leria um personagem que esta funcao ja
  // comecou a mudar, e o ramo poderia sair diferente do que foi validado.
  for (const linha of linhasDaSubclasseNoNivel(subclasseAtual, nivelNaClasseNovo,
                                               truquesAntesDaSubida)) {
    if (linha.automatica) aplicarConcessaoAutomatica(personagem, linha);
  }

  // ...e as escolhas que o jogador acabou de fazer, validadas na guarda acima.
  //
  // As linhas que gravam em `magias_preparadas` (Descobertas Magicas, do
  // Colegio do Conhecimento) precisam do CIRCULO de cada magia escolhida --
  // o livro deixa escolher "um truque ou uma magia" (Classes.md:770), entao
  // nao ha circulo unico a supor. O circulo real vem do indice de magias,
  // pela mesma via ja usada por obterMagiasDominioNivel e pelas magias de
  // legado de especie, algumas centenas de linhas acima.
  const nomesParaCirculo = escolhasSubclasseNivel
    .filter((l) => l.destino === 'magias_preparadas')
    .flatMap((l) => (Array.isArray(opcoes[l.campo]) ? opcoes[l.campo] : [opcoes[l.campo]]))
    .filter(Boolean);
  const circulos = await _circulosDoIndice(nomesParaCirculo);
  for (const linha of escolhasSubclasseNivel) {
    aplicarEscolhaSubclasse(personagem, linha, opcoes[linha.campo], { circulos });
  }
  
  // Adicionar automaticamente magias de domínio/subclasse
  const magiasDominio = await obterMagiasDominioNivel(sub.classe, subclasseAtual, nivelNaClasseNovo);
  if (magiasDominio.length > 0) {
    if (!personagem.magias_preparadas) personagem.magias_preparadas = [];
    for (const magia of magiasDominio) {
      _concederMagiaAutomatica(personagem.magias_preparadas, magia, 'dominio');
    }
  }

  // Adicionar automaticamente magias sempre preparadas (truques vão para magias_conhecidas)
  // Excluir magias já concedidas por Domínio - a mesma magia pode aparecer em ambas as
  // listas porque o texto de "Magias de Domínio" também casa com o parser de "sempre
  // preparada"; Domínio deve ganhar (mantém origem: 'dominio', não 'sempre').
  // O terreno escolhido (Circulo da Terra) recorta a tabela certa entre as
  // quatro alternativas -- sem ele o extrator devolve vazio de proposito.
  const opcaoSubclasse = personagem.escolhas_classe?.circulo_terra_terreno;
  const magiasSempre = (await obterMagiasSemprePreparadasNivel(sub.classe, subclasseAtual, nivelNaClasseNovo, opcaoSubclasse))
    .filter(magia => !magiasDominio.some(d => d.nome === magia.nome));
  if (magiasSempre.length > 0) {
    if (!personagem.magias_preparadas) personagem.magias_preparadas = [];
    if (!personagem.magias_conhecidas) personagem.magias_conhecidas = [];
    for (const magia of magiasSempre) {
      if (magia.circulo === 0) {
        _concederMagiaAutomatica(personagem.magias_conhecidas, magia, 'sempre');
      } else {
        _concederMagiaAutomatica(personagem.magias_preparadas, magia, 'sempre');
      }
    }
  }

  // Magia de Legado Ínfero (Tiferino) / Linhagem Élfica (Elfo), níveis 3 e 5:
  // sempre preparada, uso gratuito 1x/Descanso Longo
  const magiaLegadoEspecie = caracteristicasEspecie.find(c => c.magiaConcedida)?.magiaConcedida || null;
  if (magiaLegadoEspecie) {
    if (!personagem.magias_preparadas) personagem.magias_preparadas = [];
    // Origem própria 'especie_legado' (não 'sempre'): a origem 'sempre' é
    // higienizada em migrarMagiasSemprePreparadas (site/js/pages/sheet.js), que
    // remove qualquer magia 'sempre' ausente de magiasSempreCache — cache que só
    // conhece magias sempre-preparadas de classe/subclasse, nunca as de legado de
    // espécie. Usar uma origem distinta evita que a magia de legado seja apagada
    // ao reabrir a ficha.
    _concederMagiaAutomatica(personagem.magias_preparadas, magiaLegadoEspecie, 'especie_legado');
  }

  // Aplicar aumentos de atributo
  if (ganhaAumentoAtributo && opcoes.aumentos_atributo) {
    for (const [atributo, valor] of Object.entries(opcoes.aumentos_atributo)) {
      if (personagem.atributos[atributo] !== undefined) {
        aplicarDeltaSistema(personagem, `atributos.${atributo}`, valor, 20);
      }
    }
  }

  // Regra retroativa de Constituição: se o modificador de CON mudar, os PV
  // máximos acompanham em +1 por nível para cada +1 de modificador. A conta
  // mora em aplicarPvRetroativoPorCon porque a edição manual da ficha usa a
  // MESMA regra, inclusive no sentido inverso ao reverter.
  const modConDepois = calcMod(personagem.atributos.constituicao);
  const bonusConRetroativo = aplicarPvRetroativoPorCon(personagem, modConAntes, modConDepois);
  
  // Aplicar talento (se escolhido ao invés de aumento)
  let escolhasTalentoLevelup = [];
  if (ganhaAumentoAtributo && opcoes.talento) {
    if (!personagem.talentos) personagem.talentos = [];
    personagem.talentos.push(opcoes.talento);

    // Registrar escolhas do talento (Habilidoso/Artifista/Músico/etc.) para
    // persistência e histórico. A APLICAÇÃO da proficiência em si (perícia/
    // ferramenta/instrumento) NÃO é feita aqui -- fica só a cargo de
    // aplicarEfeitoTalento (regras-cobertura.js, chamado mais abaixo), que é
    // o único lugar que conhece a regra "já possuída não conta" adicionada a
    // validarEscolhasTalento. Até 2026-08-06 este bloco tinha uma cópia
    // própria (hardcoded) da aplicação de Habilidoso/Artifista/Músico, que
    // rodava ANTES de aplicarEfeitoTalento -- então quando
    // validarEscolhasTalento passou a rejeitar proficiência repetida, a
    // segunda aplicação (dentro de aplicarEfeitoTalento) via o personagem já
    // mutado pela primeira e rejeitava a própria escolha que acabara de
    // aplicar. Duas fontes da verdade para o mesmo efeito é o bug raiz --
    // não "restaurar" a cópia hardcoded removida abaixo.
    if (Array.isArray(opcoes.escolhas_talento_levelup) && opcoes.escolhas_talento_levelup.length > 0) {
      if (!personagem.escolhas_talento) personagem.escolhas_talento = {};
      // Chave do EVENTO de subida, exibida como "Nivel N" na ficha
      // (sheet/talentos.js) -- nivel do personagem, nao da classe: e o que
      // a identifica sem colidir quando duas classes concedem ASI no
      // mesmo nivel DELAS.
      const chave = `levelup_${nivelTotalNovo}`;
      personagem.escolhas_talento[chave] = opcoes.escolhas_talento_levelup;
      escolhasTalentoLevelup = opcoes.escolhas_talento_levelup;

      if (opcoes.talento === 'Dádiva da Proficiência em Perícia') {
        aplicarDadivaProficiencia(personagem, opcoes);
      }
    }

    // Aplicar bonus de PV do Vigoroso (dobro do nivel ao obter)
    if (opcoes.talento === 'Vigoroso') {
      // Vigoroso: "o dobro do seu nivel DE PERSONAGEM" -- total, nao classe.
      const bonusVigoroso = nivelTotalNovo * 2;
      personagem.pv_max = (personagem.pv_max || 0) + bonusVigoroso;
      personagem.pv_atual = Math.min(personagem.pv_atual + bonusVigoroso, personagem.pv_max);
      personagem.bonus_pv_vigoroso_aplicado = bonusVigoroso;
    }

    // Aplicar Dádiva da Fortitude: +40 PV máximo
    if (opcoes.talento === 'Dádiva da Fortitude') {
      personagem.pv_max = (personagem.pv_max || 0) + 40;
      personagem.pv_atual = Math.min((personagem.pv_atual || 0) + 40, personagem.pv_max);
      personagem.bonus_pv_dadiva_fortitude = 40;
    }

    // Persistir parâmetros de dádivas épicas (ex.: tipos de energia escolhidos)
    if (opcoes.dadiva_resistencia_energia) {
      if (!personagem.talentos_parametros) personagem.talentos_parametros = {};
      personagem.talentos_parametros.dadiva_resistencia_energia = opcoes.dadiva_resistencia_energia;
    }

    // Aplicar o ASI exatamente uma vez, após todas as validações.
    if (talentoData) {
      const resultadoASI = aplicarASITalento(personagem, talentoData, opcoes.talento_asi);
      if (!resultadoASI.sucesso) return { sucesso: false, erro: resultadoASI.erro };
    }

    const resultadoCoberturaTalento = aplicarEfeitoTalento(
      personagem,
      opcoes.talento,
      montarEscolhasCoberturaTalento(opcoes)
    );
    if (!resultadoCoberturaTalento.sucesso) {
      return { sucesso: false, erro: resultadoCoberturaTalento.erro };
    }

    if (requerDadivaEpica) {
      if (!personagem.escolhas_classe) personagem.escolhas_classe = {};
      personagem.escolhas_classe.dadiva_epica_nivel_19 = opcoes.talento;
    }

    // Aplicar Analítico / Mente Aguçada (proficiência ou expertise)
    if (opcoes.talento_tipo_escolha === 'analitico' || opcoes.talento_tipo_escolha === 'mente_agucada') {
      const pericia = opcoes.escolhas_talento_levelup?.[0];
      if (pericia) {
        if (!personagem.pericias_proficientes) personagem.pericias_proficientes = [];
        if (!personagem.pericias_expertise) personagem.pericias_expertise = [];
        if (personagem.pericias_proficientes.includes(pericia)) {
          // Já proficiente: adquire Especialização
          if (!personagem.pericias_expertise.includes(pericia)) {
            personagem.pericias_expertise.push(pericia);
          }
        } else {
          // Sem proficiência: adquire Proficiência
          personagem.pericias_proficientes.push(pericia);
        }
      }
    }

    // Aplicar Especialista em Perícia (1 proficiência + 1 expertise)
    if (opcoes.talento_tipo_escolha === 'especialista_pericia') {
      const [profPericia, expPericia] = opcoes.escolhas_talento_levelup || [];
      if (profPericia) {
        if (!personagem.pericias_proficientes) personagem.pericias_proficientes = [];
        if (!personagem.pericias_proficientes.includes(profPericia)) {
          personagem.pericias_proficientes.push(profPericia);
        }
      }
      if (expPericia) {
        if (!personagem.pericias_expertise) personagem.pericias_expertise = [];
        if (!personagem.pericias_expertise.includes(expPericia)) {
          personagem.pericias_expertise.push(expPericia);
        }
      }
    }

    // Aplicar Resiliente (proficiência em salvaguarda do atributo escolhido)
    if (opcoes.talento_tipo_escolha === 'resiliente' && opcoes.resiliente_atributo) {
      if (!personagem.salvaguardas_proficientes) personagem.salvaguardas_proficientes = [];
      const _mapaAttrNome = {
        'forca': 'Força', 'destreza': 'Destreza', 'constituicao': 'Constituição',
        'inteligencia': 'Inteligência', 'sabedoria': 'Sabedoria', 'carisma': 'Carisma'
      };
      const nomeAttr = _mapaAttrNome[opcoes.resiliente_atributo];
      if (nomeAttr && !personagem.salvaguardas_proficientes.includes(nomeAttr)) {
        personagem.salvaguardas_proficientes.push(nomeAttr);
      }
    }

    // Aplicar Adepto Elemental (tipo de dano) — push no array de tipos
    if (opcoes.talento_tipo_escolha === 'adepto_elemental') {
      const tipoEscolhido = opcoes.escolhas_talento_levelup?.[0] || '';
      if (tipoEscolhido) {
        if (!personagem.adepto_elemental_tipos) personagem.adepto_elemental_tipos = [];
        if (!personagem.adepto_elemental_tipos.includes(tipoEscolhido)) {
          personagem.adepto_elemental_tipos.push(tipoEscolhido);
        }
      }
    }

    // ATENÇÃO, MANTENEDOR: este bloco (e o de Conjurador Ritualista logo
    // abaixo) é um ESPELHO da mesma regra que `aplicarEfeitoTalento`
    // (regras-cobertura.js) já aplica -- não é a fonte da verdade.
    //
    // Rastreamento de chamada feito na revisão da issue #31 (rodada 1):
    // dentro desta mesma função, `aplicarEfeitoTalento` roda algumas linhas
    // acima (ver `resultadoCoberturaTalento`), DENTRO DO MESMO
    // `if (ganhaAumentoAtributo && opcoes.talento) { ... }` que envolve os
    // dois blocos abaixo, sem nenhum `return` entre um e outro nesse
    // caminho, e lendo o MESMO dado (`opcoes.escolhas_talento_levelup?.[0]`,
    // via `montarEscolhasCoberturaTalento`). Ou seja: quando estes blocos
    // rodam, a promoção da magia/ritual já preparado pela classe já
    // aconteceu -- eles só encontram a entrada já corrigida e não fazem
    // nada. HOJE, portanto, os dois blocos são INERTES: não existe caminho
    // conhecido do app em que removê-los mudaria o resultado, e por isso
    // NENHUM teste consegue nascer vermelho por causa só deles (ver
    // task-4-report.md, rodada 1 -- não force um teste aqui, ele vai
    // nascer verde e não estará medindo nada).
    //
    // Mesmo assim os dois ficam CORRIGIDOS com o mesmo padrão find-ou-
    // promove de `aplicarEfeitoTalento` (em vez de deletados ou deixados
    // com o bug), como defesa: se um dia a ordem das duas chamadas mudar
    // (ou aplicarEfeitoTalento parar de rodar aqui), o bug de #31 -- a
    // magia ESCOLHIDA pelo jogador não ficar sempre preparada/grátis
    // quando já preparada por outra via -- não reaparece em silêncio.
    // Consolidar as duas cópias (apagar o espelho, chamar só
    // aplicarEfeitoTalento) é decisão estrutural, com tarefa e oráculo
    // próprios -- não esta rodada.

    // Aplicar Tocado Por Fadas / Tocado Pelas Sombras (magia escolhida + magia parceira)
    if (opcoes.talento_tipo_escolha === 'tocado_fadas' || opcoes.talento_tipo_escolha === 'tocado_sombras') {
      const nomeMagia = opcoes.escolhas_talento_levelup?.[0];
      if (!personagem.magias_preparadas) personagem.magias_preparadas = [];
      const origem = opcoes.talento_tipo_escolha === 'tocado_fadas' ? 'tocado_por_fadas' : 'tocado_pelas_sombras';
      // As duas magias ficam sempre preparadas e com uso gratis (mesma regra
      // do livro para as duas). Se a magia ja estiver preparada (ex.:
      // concedida pela classe), promove a entrada existente em vez de pular
      // -- o `if (... && !find(...))` anterior pulava, deixando a entrada
      // sem origem/gratis_usado (issue #31).
      // Magia escolhida (1º círculo)
      if (nomeMagia) {
        const existente = personagem.magias_preparadas.find(m => m.nome === nomeMagia);
        if (existente) {
          existente.origem = origem;
          existente.gratis_usado = false;
        } else {
          personagem.magias_preparadas.push({ nome: nomeMagia, circulo: 1, origem, gratis_usado: false });
        }
      }
      // Magia parceira sempre-preparada (2º círculo): Passo Nebuloso para Fadas, Invisibilidade para Sombras
      const nomeParceiro = opcoes.talento_tipo_escolha === 'tocado_fadas' ? 'Passo Nebuloso' : 'Invisibilidade';
      const existenteParceiro = personagem.magias_preparadas.find(m => m.nome === nomeParceiro);
      if (existenteParceiro) {
        existenteParceiro.origem = origem;
        existenteParceiro.gratis_usado = false;
      } else {
        personagem.magias_preparadas.push({ nome: nomeParceiro, circulo: 2, origem, gratis_usado: false });
      }
    }

    // Aplicar Conjurador Ritualista (magias rituais) -- espelho de
    // aplicarEfeitoTalento, mesmo caso do bloco de Tocado acima (ver o
    // comentário grande logo antes dele: hoje inerte, corrigido por
    // defesa, sem oráculo dedicado possível).
    if (opcoes.talento_tipo_escolha === 'conjurador_ritualista') {
      if (!personagem.magias_preparadas) personagem.magias_preparadas = [];
      for (const nomeMagia of (opcoes.escolhas_talento_levelup || [])) {
        // Promove a entrada existente (ritual ja preparado pela classe) em
        // vez de pular -- mesmo furo do bloco de Tocado (issue #31).
        const existente = personagem.magias_preparadas.find(m => m.nome === nomeMagia);
        if (existente) {
          existente.origem = 'conjurador_ritualista';
        } else {
          personagem.magias_preparadas.push({ nome: nomeMagia, circulo: 1, origem: 'conjurador_ritualista' });
        }
      }
    }

    // Aplicar Iniciado em Magia (lista + atributo + truques + magia) — push no array de instâncias
    if (opcoes.talento_tipo_escolha === 'iniciado_em_magia' && opcoes.iniciado_em_magia) {
      const im = opcoes.iniciado_em_magia;
      if (!personagem.iniciado_em_magia_instancias) personagem.iniciado_em_magia_instancias = [];
      const novaInstancia = {
        lista: im.lista,
        atributo: im.atributo,
        truques: [...(im.truques || [])],
        magia: im.magia
      };
      // Só adiciona se a lista ainda não foi usada
      if (!personagem.iniciado_em_magia_instancias.some(i => i.lista === im.lista)) {
        personagem.iniciado_em_magia_instancias.push(novaInstancia);
      }
      // Adicionar truques às magias conhecidas
      if (!personagem.magias_conhecidas) personagem.magias_conhecidas = [];
      for (const nome of (im.truques || [])) {
        if (!personagem.magias_conhecidas.find(m => m.nome === nome)) {
          personagem.magias_conhecidas.push({ nome, circulo: 0, origem: 'iniciado_em_magia' });
        }
      }
      // Adicionar magia de 1o círculo às preparadas (com flag de uso gratuito por descanso longo)
      if (im.magia) {
        if (!personagem.magias_preparadas) personagem.magias_preparadas = [];
        const existenteIM = personagem.magias_preparadas.find(m => m.nome === im.magia);
        if (existenteIM) {
          existenteIM.origem = 'iniciado_em_magia';
          existenteIM.gratis_usado = false;
        } else {
          personagem.magias_preparadas.push({ nome: im.magia, circulo: 1, origem: 'iniciado_em_magia', gratis_usado: false });
        }
      }
    }
  }

  // CRESCIMENTO DO CONJURADOR RITUALISTA -- fora do bloco de aquisicao do
  // talento acima (que so roda quando `opcoes.talento` e escolhido NESTE
  // nivel): o crescimento se aplica em QUALQUER subida que cruze um
  // patamar de Bonus de Proficiencia, mesmo em niveis sem ASI/talento.
  //
  // As magias do CRESCIMENTO entram com a mesma origem das da aquisicao:
  // e o mesmo beneficio do mesmo talento, e a contagem de
  // `ritualBonusPendente` depende de as duas levas ficarem indistintas.
  //
  // Consome `magiasRitualBonusSelecionadas` (hoisted acima do guard),
  // NUNCA `opcoes.rituais_bonus_proficiencia` de novo -- achado da
  // revisao (fix round 2): reler a opcao crua aqui deixava a gravacao
  // aceitar entradas que o guard tinha filtrado fora (vazias/nao-string),
  // porque o guard validava so uma COPIA filtrada, nao o array que a
  // gravacao consumia. Mesmo padrao de `magiasGrimorioSelecionadas`.
  //
  // A deduplicacao por `nome` + `origem` abaixo continua, mas depois do
  // Important 1 ela e so REFORCO: o guard ja recusa qualquer nome
  // presente em `nomesPreparados` (qualquer origem), entao nenhuma
  // entrada com esse nome pode existir quando a gravacao chega aqui.
  if (ritualPendente.faltam > 0) {
    if (!Array.isArray(personagem.magias_preparadas)) personagem.magias_preparadas = [];
    for (const nome of magiasRitualBonusSelecionadas) {
      const jaEsta = personagem.magias_preparadas.some((m) => m?.nome === nome
        && m?.origem === 'conjurador_ritualista');
      if (!jaEsta) {
        personagem.magias_preparadas.push({ nome, circulo: 1, origem: 'conjurador_ritualista' });
      }
    }
  }

  // Aplicar Especialização do Bardo (2 escolhas nos níveis 2 e 9)
  let expertiseBardoAplicada = [];
  if (exigeEspecializacao) {
    if (!personagem.pericias_expertise) personagem.pericias_expertise = [];
    const selecionadas = (opcoes.bardo_expertise || []).filter(Boolean);
    for (const pericia of selecionadas) {
      if (!personagem.pericias_expertise.includes(pericia)) {
        personagem.pericias_expertise.push(pericia);
        expertiseBardoAplicada.push(pericia);
      }
    }
  }

  // Aplicar Especialista do Guardião (2 escolhas no nível 9)
  let expertiseGuardiaoAplicada = [];
  if (exigeEspecializacaoGuardiaoNivel) {
    if (!personagem.pericias_expertise) personagem.pericias_expertise = [];
    const selecionadas = (opcoes.guardiao_expertise || []).filter(Boolean);
    for (const pericia of selecionadas) {
      if (!personagem.pericias_expertise.includes(pericia)) {
        personagem.pericias_expertise.push(pericia);
        expertiseGuardiaoAplicada.push(pericia);
      }
    }
  }

  // Aplicar Estilo de Luta (Guardião/Paladino nível 2)
  let estiloLutaAplicado = null;
  if (exigeEstiloLutaNivel && opcoes.estilo_luta) {
    if (!personagem.escolhas_classe) personagem.escolhas_classe = {};
    personagem.escolhas_classe.estilo_luta = [opcoes.estilo_luta];
    estiloLutaAplicado = opcoes.estilo_luta;
  }

  // Aplicar troca de Estilo de Luta do Guerreiro. Como a validação acima
  // nunca exige esta escolha (é sempre opcional), a aplicação só faz algo
  // quando o jogador de fato preencheu os dois lados da troca. Também
  // aceita a gravação direta de opcoes.estilo_luta quando o personagem
  // ainda não tem NENHUM Estilo de Luta registrado -- caso defensivo (não
  // deveria acontecer com um personagem criado pelo assistente, que já
  // concede um no nível 1), sem exigir nada: se não vier, simplesmente
  // não aplica nada neste nível.
  let estiloLutaTrocaAplicada = null;
  if (exigeTrocaEstiloLutaGuerreiroNivel) {
    if (!personagem.escolhas_classe) personagem.escolhas_classe = {};
    const jaTinhaEstiloLuta = !!personagem.escolhas_classe.estilo_luta?.length;
    if (!jaTinhaEstiloLuta && opcoes.estilo_luta) {
      personagem.escolhas_classe.estilo_luta = [opcoes.estilo_luta];
      estiloLutaAplicado = opcoes.estilo_luta;
    } else if (opcoes.estilo_luta_trocar_de && opcoes.estilo_luta_trocar_para) {
      const atuais = personagem.escolhas_classe.estilo_luta || [];
      const idx = atuais.indexOf(opcoes.estilo_luta_trocar_de);
      if (idx >= 0) {
        atuais[idx] = opcoes.estilo_luta_trocar_para;
        estiloLutaTrocaAplicada = { de: opcoes.estilo_luta_trocar_de, para: opcoes.estilo_luta_trocar_para };
      }
    }
  }

  // Aplicar Especialização adicional do Ladino (nível 6: +2 perícias já
  // proficientes, à escolha do jogador -- Classes.md:4188). Diferente de
  // Especialização do Bardo/Especialista do Guardião, esta escolha NÃO é
  // implementada como pendência bloqueante: o motor de testes de unidade
  // (testes/regras/unidade/harness.mjs, PENDENCIAS_CONHECIDAS) enumera um
  // conjunto FECHADO de tipos de pendência que subirDeNivel pode devolver,
  // e reaproveitar 'bardo_expertise'/'guardiao_expertise' para o Ladino
  // quebraria a asserção de classes-progressao.test.mjs que confere que
  // essas duas pendências NUNCA disparam fora de Bardo/Guardião. Por isso
  // a escolha é sempre aplicada diretamente: quando opcoes.ladino_expertise
  // vier com perícias válidas (já proficientes, ainda sem Especialização),
  // usa essas; o que faltar para completar 2 é preenchido automaticamente
  // com as próximas perícias proficientes elegíveis -- a subida de nível
  // nunca fica bloqueada esperando esta escolha.
  let expertiseLadinoAplicada = [];
  if (exigeEspecializacaoLadinoNivel) {
    if (!personagem.pericias_expertise) personagem.pericias_expertise = [];
    const jaExpertise = new Set(personagem.pericias_expertise);
    const proficientes = personagem.pericias_proficientes || [];
    const informadas = (Array.isArray(opcoes.ladino_expertise) ? opcoes.ladino_expertise : [])
      .filter(pericia => proficientes.includes(pericia) && !jaExpertise.has(pericia));
    const automaticas = proficientes.filter(pericia => !jaExpertise.has(pericia) && !informadas.includes(pericia));
    const escolhidas = [...new Set([...informadas, ...automaticas])].slice(0, 2);
    for (const pericia of escolhidas) {
      if (!personagem.pericias_expertise.includes(pericia)) {
        personagem.pericias_expertise.push(pericia);
        expertiseLadinoAplicada.push(pericia);
      }
    }
  }

  // Aplicar Explorador Hábil (Guardião nível 2: 1 expertise + 2 idiomas)
  let exploradorHabilAplicado = { expertise: null, idiomas: [] };
  if (exigeExploradorHabilNivel) {
    if (!personagem.pericias_expertise) personagem.pericias_expertise = [];
    if (opcoes.explorador_expertise && !personagem.pericias_expertise.includes(opcoes.explorador_expertise)) {
      personagem.pericias_expertise.push(opcoes.explorador_expertise);
      exploradorHabilAplicado.expertise = opcoes.explorador_expertise;
    }
    if (Array.isArray(opcoes.explorador_idiomas) && opcoes.explorador_idiomas.length > 0) {
      if (!personagem.idiomas) personagem.idiomas = [];
      opcoes.explorador_idiomas.forEach(idioma => {
        if (!personagem.idiomas.includes(idioma)) {
          personagem.idiomas.push(idioma);
          exploradorHabilAplicado.idiomas.push(idioma);
        }
      });
    }
  }

  // Aplicar Manobras do Mestre da Batalha
  let manobrasNovasAplicadas = [];
  let manobraTrocaAplicada = null;
  if (exigeManobrasNivel) {
    if (!Array.isArray(personagem.manobras_conhecidas)) personagem.manobras_conhecidas = [];
    for (const nome of opcoes.manobras_novas) {
      if (!personagem.manobras_conhecidas.includes(nome)) {
        personagem.manobras_conhecidas.push(nome);
        manobrasNovasAplicadas.push(nome);
      }
    }

    if (opcoes.manobra_trocar_de && opcoes.manobra_trocar_para) {
      const idx = personagem.manobras_conhecidas.indexOf(opcoes.manobra_trocar_de);
      if (idx >= 0) {
        personagem.manobras_conhecidas[idx] = opcoes.manobra_trocar_para;
        manobraTrocaAplicada = { de: opcoes.manobra_trocar_de, para: opcoes.manobra_trocar_para };
      }
    }
  }

  // Aplicar Acadêmico do Mago (nível 2: 1 expertise acadêmica)
  let academicoAplicado = [];
  if (exigeAcademicoNivel) {
    if (!personagem.pericias_expertise) personagem.pericias_expertise = [];
    const pericia = opcoes.academico_expertise[0];
    if (!personagem.pericias_expertise.includes(pericia)) {
      personagem.pericias_expertise.push(pericia);
      academicoAplicado.push(pericia);
    }
  }

  // Capstones de atributo do nível 20: Campeão Primitivo (Bárbaro, FOR e CON)
  // e Corpo e Mente (Monge, DES e SAB), ambos +4 com teto 25.
  //
  // Até 2026-08-20 só o do Bárbaro existia, escrito à mão aqui -- o do Monge
  // nunca foi implementado (issue #19): a ficha exibia o texto certo da
  // característica e nunca somava os +4. Uma tabela em vez de um `if` por
  // classe é o que impede a próxima característica desse tipo de nascer
  // esquecida do mesmo jeito.
  // O capstone e o nivel 20 DA CLASSE (esta na tabela de classe do livro);
  // ja o recalculo de PV abaixo e retroativo a TODOS os niveis do
  // personagem, e por isso multiplica pelo nivel total.
  const capstone = nivelNaClasseNovo === 20 ? CAPSTONES_ATRIBUTO[sub.classe] : null;
  if (capstone) {
    aplicarCapstoneAtributo(personagem, capstone.atributos, capstone.ganho);
    // Recalcular PV com novo mod de CON (retroativo para todos os níveis).
    // Inerte quando o capstone não mexe em Constituição, como o do Monge.
    const modConCapstone = calcMod(personagem.atributos.constituicao);
    if (modConCapstone > modConDepois) {
      const bonusCapstone = (modConCapstone - modConDepois) * nivelTotalNovo;
      personagem.pv_max += bonusCapstone;
      personagem.pv_atual += bonusCapstone;
    }
  }

  // As duas magias de nível entram no grimório somente após todas as outras
  // validações e aplicações do level-up terem sido concluídas com sucesso.
  if (exigeGrimorioMago) {
    if (!Array.isArray(personagem.grimorio)) personagem.grimorio = [];
    personagem.grimorio.push(...magiasGrimorioSelecionadas);
  }
  if (exigeMagiasSubclasseArcana) {
    if (!Array.isArray(personagem.grimorio)) personagem.grimorio = [];
    personagem.grimorio.push(...magiasSubclasseArcanaSelecionadas);
  }

  // Retornar resumo do level-up
  return {
    sucesso: true,
    nivel_anterior: nivelTotalAnterior,
    nivel_novo: nivelTotalNovo,
    hp_ganho: hpGanho,
    hp_modo: opcoes.hp_modo === 'rolado' ? 'rolado' : 'fixo',
    hp_rolado: opcoes.hp_modo === 'rolado' ? (parseInt(opcoes.hp_rolado) || null) : null,
    bonus_con_retroativo: bonusConRetroativo,
    bonus_proficiencia: bonusNovo,
    bonus_mudou: bonusMudou,
    caracteristicas: caracteristicas,
    caracteristicas_especie: caracteristicasEspecie,
    caracteristicas_subclasse: caracteristicasSubclasse,
    magias_dominio_adicionadas: magiasDominio,
    magias_sempre_adicionadas: magiasSempre,
    magia_legado_especie_adicionada: magiaLegadoEspecie,
    subclasse_escolhida: precisaSubclasse ? opcoes.subclasse : null,
    aumento_atributo: ganhaAumentoAtributo,
    aumentos_aplicados: opcoes.aumentos_atributo || null,
    talento_aplicado: opcoes.talento || null,
    talento_asi_aplicado: opcoes.talento_asi || null,
    escolhas_talento_levelup: escolhasTalentoLevelup,
    expertise_bardo_aplicada: expertiseBardoAplicada,
    expertise_guardiao_aplicada: expertiseGuardiaoAplicada,
    expertise_ladino_aplicada: expertiseLadinoAplicada,
    estilo_luta_aplicado: estiloLutaAplicado,
    estilo_luta_troca_aplicada: estiloLutaTrocaAplicada,
    explorador_habil_aplicado: exploradorHabilAplicado,
    academico_aplicado: academicoAplicado,
    grimorio_adicionado: magiasGrimorioSelecionadas,
    subclasse_magias_adicionadas: magiasSubclasseArcanaSelecionadas,
    manobras_novas_aplicadas: manobrasNovasAplicadas,
    manobra_troca_aplicada: manobraTrocaAplicada
  };
}

/**
 * Adiciona XP ao personagem e verifica se subiu de nível
 */
export function adicionarXP(personagem, xp) {
  if (!personagem.xp) personagem.xp = 0;
  personagem.xp += xp;
  
  const nivelCalculado = calcularNivelPorXP(personagem.xp);
  const podeSubir = nivelCalculado > personagem.nivel;
  
  return {
    xp_atual: personagem.xp,
    nivel_atual: personagem.nivel,
    pode_subir: podeSubir,
    niveis_disponiveis: podeSubir ? (nivelCalculado - personagem.nivel) : 0
  };
}
