// ============================================================
// Sistema de Level-Up D&D 2024
// ============================================================
import { CLASSES_INFO, ESCOLAS_SUBCLASSE_MAGO } from './dados-classes.js';
import { getClasse, getEspecies, getIndiceMagias, getTalentos } from './db.js';
import { getEspacosSubclasseConjuradora, getTruquesFixosSubclasse } from './regras-conjuracao-subclasse.js';
import { calcMod, bonusProficiencia, getEspacosMagia, getTruquesConhecidos, getMagiaPreparadas } from './utils.js';
import { aplicarDeltaSistema } from './ficha-edicoes.js';
import { aplicarEfeitoTalento, validarEscolhasTalento } from './regras-cobertura.js';
import {
  linhasDaSubclasseNoNivel, opcoesDaLinha,
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

function _personagemTemConjuracao(personagem) {
  if (CLASSES_INFO[personagem?.classe]?.conjurador) return true;
  if (personagem?.classe === 'Guerreiro' && personagem?.subclasse === 'Cavaleiro Místico') return true;
  if (personagem?.classe === 'Ladino' && personagem?.subclasse === 'Trapaceiro Arcano') return true;
  return personagem?.caracteristica_conjuracao === true || personagem?.magia_de_pacto === true;
}

export function talentoElegivelParaPersonagem(personagem, talento, nivel = personagem?.nivel || 1, opcoes = {}) {
  if (!personagem || !talento) return false;
  const prerequisito = talento.prerequisito || '';
  const texto = _normalizarTextoRegra(prerequisito);
  const minimo = Number(texto.match(/nivel\s*(\d+)/)?.[1] || 0);
  if (nivel < minimo) return false;
  if (!_atributosAtendemPrerequisito(personagem, prerequisito)) return false;

  const info = CLASSES_INFO[personagem.classe] || {};
  const exigeConjuracao = /caracteristica (?:de )?conjuracao/.test(texto) || texto.includes('magia de pacto');
  if (exigeConjuracao && !_personagemTemConjuracao(personagem)) {
    return false;
  }

  const armaduras = new Set([
    ...(info.armaduras || []),
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
  if (!exigeDadivaEpica(personagem?.classe, 19) || Number(personagem?.nivel) < 19) {
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
 * Calcula HP ganho ao subir de nível (fixo ou rolagem)
 * @param {string} classe - Nome da classe
 * @param {number} modCon - Modificador de Constituição
 * @param {Object} opcoes - Opções de cálculo ({ hp_modo: 'fixo'|'rolado', hp_rolado: number })
 * @returns {number} HP ganho
 */
export function calcularHPGanhoComOpcao(classe, modCon, opcoes = {}) {
  const info = CLASSES_INFO[classe];
  if (!info || !info.dado_vida) return 0;

  const modo = opcoes.hp_modo === 'rolado' ? 'rolado' : 'fixo';
  if (modo === 'rolado') {
    const rolado = parseInt(opcoes.hp_rolado);
    if (!Number.isNaN(rolado) && rolado >= 1 && rolado <= info.dado_vida) {
      return Math.max(1, rolado + modCon);
    }
  }

  return calcularHPGanho(classe, modCon);
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
 * Atualiza os espaços de magia do personagem baseado no novo nível
 */
export async function atualizarEspacosMagia(personagem, classeData) {
  if (!classeData || !classeData.tabela_caracteristicas) return;
  
  const espacos = getEspacosMagia(classeData.tabela_caracteristicas, personagem.nivel);
  
  // Garantir que espacos_magia exista
  if (!personagem.espacos_magia) personagem.espacos_magia = {};
  
  // Preservar espaços usados se já existirem, caso contrário resetar
  Object.keys(espacos).forEach(circulo => {
    if (personagem.espacos_magia[circulo]) {
      // Atualizar apenas o total, manter os usados
      personagem.espacos_magia[circulo].total = espacos[circulo].total;
      // Se usados for maior que o novo total, ajustar
      if (personagem.espacos_magia[circulo].usados > espacos[circulo].total) {
        personagem.espacos_magia[circulo].usados = espacos[circulo].total;
      }
    } else {
      // Novo círculo
      personagem.espacos_magia[circulo] = espacos[circulo];
    }
  });
  
  // Remover círculos que não existem mais no novo nível (não deveria acontecer)
  Object.keys(personagem.espacos_magia).forEach(circulo => {
    if (!espacos[circulo]) {
      delete personagem.espacos_magia[circulo];
    }
  });
}

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
 * Função principal de level-up
 * @param {Object} personagem - Objeto do personagem
 * @param {Object} opcoes - Opções para o level-up
 * @returns {Object} Resultado do level-up com informações sobre o que mudou
 */
export async function subirDeNivel(personagem, opcoes = {}) {
  const nivelAnterior = personagem.nivel || 1;
  const novoNivel = nivelAnterior + 1;
  
  if (novoNivel > 20) {
    return { sucesso: false, erro: 'Nível máximo já alcançado (20)' };
  }
  
  if (!opcoes.ignorar_xp && !podeSubirDeNivel(personagem)) {
    const xpNecessario = XP_POR_NIVEL[novoNivel];
    const xpAtual = personagem.xp || 0;
    return {
      sucesso: false,
      erro: `XP insuficiente. Necessário: ${xpNecessario}, Atual: ${xpAtual}`
    };
  }
  
  // Carregar dados da classe
  const classeData = await getClasse(personagem.classe);
  if (!classeData) {
    return { sucesso: false, erro: 'Dados da classe não encontrados' };
  }
  
  // Calcular ganho de HP
  const modConAntes = calcMod(personagem.atributos.constituicao);
  const hpGanho = calcularHPGanhoComOpcao(personagem.classe, modConAntes, opcoes);
  
  // Obter características do novo nível
  const caracteristicas = await obterCaracteristicasNivel(personagem.classe, novoNivel);
  const caracteristicasEspecie = await obterCaracteristicasEspecieNivel(personagem.especie, novoNivel, personagem.tracos_escolhidos);
  
  // Verificar se precisa escolher subclasse
  const precisaSubclasse = exigeSubclasse(personagem.classe, novoNivel) && !personagem.subclasse;
  
  // Verificar se ganha aumento de atributo
  const ganhaAumentoAtributo = concedeAumentoAtributo(personagem.classe, novoNivel);
  const requerDadivaEpica = exigeDadivaEpica(personagem.classe, novoNivel);
  const exigeEspecializacao = exigeEspecializacaoBardo(personagem.classe, novoNivel);
  const exigeEspecializacaoGuardiaoNivel = exigeEspecializacaoGuardiao(personagem.classe, novoNivel);
  const exigeEstiloLutaNivel = exigeEstiloLuta(personagem.classe, novoNivel);
  const exigeTrocaEstiloLutaGuerreiroNivel = exigeTrocaEstiloLutaGuerreiro(personagem.classe, novoNivel);
  const exigeEspecializacaoLadinoNivel = exigeEspecializacaoLadino(personagem.classe, novoNivel);
  const exigeExploradorHabilNivel = exigeExploradorHabil(personagem.classe, novoNivel);
  const exigeAcademicoNivel = exigeAcademico(personagem.classe, novoNivel);
  const exigeGrimorioMago = personagem.classe === 'Mago' && novoNivel > 1;
  const subclasseEfetivaManobras = opcoes.subclasse || personagem.subclasse;
  const exigeManobrasNivel = exigeManobrasGuerreiro(personagem.classe, subclasseEfetivaManobras, novoNivel);
  let magiasGrimorioSelecionadas = [];
  // Versado em [Escola] (subclasse do Mago): magias grátis de escola no grimório.
  const escolaSubclasseArcana = personagem.classe === 'Mago' && Object.prototype.hasOwnProperty.call(ESCOLAS_SUBCLASSE_MAGO, subclasseEfetivaManobras)
    ? ESCOLAS_SUBCLASSE_MAGO[subclasseEfetivaManobras] : null;
  let qtdMagiasSubclasseArcana = 0;
  if (escolaSubclasseArcana) {
    const ganhouNovoCirculoNivel = ganhouNovoCirculoDeEspacos(classeData.tabela_caracteristicas, nivelAnterior, novoNivel);
    if (novoNivel === 3) {
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
    if (!talentoElegivelParaPersonagem(personagem, talentoData, novoNivel)) {
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

    const validacaoCobertura = validarEscolhasTalento(
      personagem,
      opcoes.talento,
      montarEscolhasCoberturaTalento(opcoes)
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
    const qtdNova = getQuantidadeNovasManobras(novoNivel);
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

  // Validar Acadêmico (Mago nível 2: 1 expertise em perícia acadêmica já proficiente)
  // Validar novas magias do grimório antes de alterar o personagem.
  if (exigeGrimorioMago) {
    const selecionadas = Array.isArray(opcoes.grimorio_selecionados)
      ? opcoes.grimorio_selecionados.filter(nome => typeof nome === 'string' && nome)
      : [];
    const espacosNovoNivel = getEspacosMagia(classeData.tabela_caracteristicas, novoNivel);
    const nomesNoGrimorio = new Set((personagem.grimorio || []).map(magia => magia?.nome));
    const indice = await getIndiceMagias();
    const magiasPorNome = new Map((indice?.magias || []).map(magia => [magia.nome, magia]));
    const escolhasValidas = selecionadas.length === 2 && new Set(selecionadas).size === 2 &&
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
        mensagem: 'Selecione 2 magias novas de Mago para o Grimório em círculos para os quais você possui espaços'
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
    const espacosNovoNivel = getEspacosMagia(classeData.tabela_caracteristicas, novoNivel);
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
        const circuloMaxPermitido = Math.max(circuloMaxInicial, circuloMaxRecorrente >= 1 && novoNivel === 3 ? circuloMaxRecorrente : 0);
        return magia.circulo <= (novoNivel === 3 ? circuloMaxPermitido : circuloMaxRecorrente) &&
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
  // `opcoes.subclasse || personagem.subclasse` -- mesmo idioma de :966. No
  // nivel 3 a subclasse esta sendo escolhida NESTA chamada e so e gravada em
  // personagem.subclasse mais abaixo (:1303); ler so o personagem faria as
  // escolhas de nivel 3 (a maioria delas) nunca dispararem.
  const subclasseEfetiva = opcoes.subclasse || personagem.subclasse;
  const escolhasSubclasseNivel = linhasDaSubclasseNoNivel(subclasseEfetiva, novoNivel)
    .filter((l) => l.tipo);
  for (const linha of escolhasSubclasseNivel) {
    const bruto = opcoes[linha.campo];
    const escolhido = (Array.isArray(bruto) ? bruto : [bruto]).filter(Boolean);
    const validas = opcoesDaLinha(linha);
    // `validas` vem vazia quando a lista e assincrona (Descobertas Magicas,
    // que escolhe de qualquer lista de magias): ali a validacao e so de
    // quantidade, e isso esta declarado no README da suite.
    const foraDaLista = validas.length > 0 && escolhido.some((v) => !validas.includes(v));
    const repetida = new Set(escolhido).size !== escolhido.length;
    if (escolhido.length !== linha.quantidade || foraDaLista || repetida) {
      return {
        sucesso: false,
        pendente: true,
        tipo_pendencia: linha.tipo,
        mensagem: `${linha.rotulo}: escolha ${linha.quantidade} opcao(oes) valida(s), sem repetir.`
      };
    }
  }

  // Aplicar mudanças ao personagem
  personagem.nivel = novoNivel;
  personagem.pv_max += hpGanho;
  personagem.pv_atual += hpGanho; // Também aumenta PV atual (cura ao subir de nível)
  personagem.dados_vida_total = novoNivel;
  
  // Atualizar bônus de proficiência (se mudou)
  const bonusAnterior = bonusProficiencia(nivelAnterior);
  const bonusNovo = bonusProficiencia(novoNivel);
  const bonusMudou = bonusNovo !== bonusAnterior;
  
  // Atualizar espaços de magia se for conjurador
  const info = CLASSES_INFO[personagem.classe];
  if (info && info.conjurador) {
    await atualizarEspacosMagia(personagem, classeData);
  }

  // Aplicar escolha de subclasse
  if (precisaSubclasse && opcoes.subclasse) {
    personagem.subclasse = opcoes.subclasse;
  }

  // Subclasses conjuradoras (Cavaleiro Místico, Trapaceiro Arcano):
  // espaços de magia e truques concedidos pela característica.
  //
  // Este bloco tem de vir DEPOIS da gravação da subclasse acima: as duas
  // subclasses começam a conjurar no nível 3, o MESMO em que são
  // escolhidas, e enquanto ele rodava antes `personagem.subclasse` ainda
  // estava vazia -- nenhum dos dois recebia espaço de magia ao virar
  // conjurador (o Cavaleiro Místico só ganhava no nível 4, e o Trapaceiro
  // Arcano nunca, porque a condição citava só o Cavaleiro).
  const espacosSubclasse = getEspacosSubclasseConjuradora(
    personagem.classe, personagem.subclasse, novoNivel);
  if (Object.keys(espacosSubclasse).length > 0) {
    if (!personagem.espacos_magia) personagem.espacos_magia = {};
    Object.keys(espacosSubclasse).forEach(circulo => {
      const total = espacosSubclasse[circulo].total;
      if (personagem.espacos_magia[circulo]) {
        personagem.espacos_magia[circulo].total = total;
        if (personagem.espacos_magia[circulo].usados > total) {
          personagem.espacos_magia[circulo].usados = total;
        }
      } else {
        personagem.espacos_magia[circulo] = espacosSubclasse[circulo];
      }
    });
    // Remover círculos que não existem mais
    Object.keys(personagem.espacos_magia).forEach(circulo => {
      if (!espacosSubclasse[circulo]) {
        delete personagem.espacos_magia[circulo];
      }
    });

    // Truques concedidos pela subclasse (Mãos Mágicas do Trapaceiro
    // Arcano): entram como truque de classe normal, porque contam no
    // limite da tabela da subclasse. A tela de seleção já desconta esses
    // truques da quantidade que pede ao jogador (levelup-flow.js).
    const truquesFixos = getTruquesFixosSubclasse(
      personagem.classe, personagem.subclasse, novoNivel);
    if (truquesFixos.length > 0) {
      if (!personagem.magias_conhecidas) personagem.magias_conhecidas = [];
      for (const nome of truquesFixos) {
        if (!personagem.magias_conhecidas.some(m => m.nome === nome)) {
          personagem.magias_conhecidas.push({ nome, circulo: 0, origem: 'subclasse_fixa' });
        }
      }
    }
  }

  // Obter características de subclasse para este nível
  const subclasseAtual = personagem.subclasse;
  const caracteristicasSubclasse = await obterCaracteristicasSubclasseNivel(personagem.classe, subclasseAtual, novoNivel);

  // Concessoes automaticas de subclasse: o livro concede sem perguntar nada
  // ("Voce adquire proficiencia em X"), e o app precisa conceder sem
  // perguntar nada. Antes desta tabela, cinco caracteristicas do livro
  // simplesmente nunca eram aplicadas -- nem aqui, nem na ficha, nem no
  // assistente -- e o jogador nao tinha como saber que faltava algo.
  for (const linha of linhasDaSubclasseNoNivel(subclasseAtual, novoNivel)) {
    if (linha.automatica) aplicarConcessaoAutomatica(personagem, linha);
  }

  // ...e as escolhas que o jogador acabou de fazer, validadas na guarda acima.
  for (const linha of escolhasSubclasseNivel) {
    aplicarEscolhaSubclasse(personagem, linha, opcoes[linha.campo]);
  }
  
  // Adicionar automaticamente magias de domínio/subclasse
  const magiasDominio = await obterMagiasDominioNivel(personagem.classe, subclasseAtual, novoNivel);
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
  const magiasSempre = (await obterMagiasSemprePreparadasNivel(personagem.classe, subclasseAtual, novoNivel, opcaoSubclasse))
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

  // Regra retroativa de Constituição: se o modificador de CON aumentar,
  // PV máximos aumentam em +1 por nível para cada +1 de modificador.
  const modConDepois = calcMod(personagem.atributos.constituicao);
  let bonusConRetroativo = 0;
  if (modConDepois > modConAntes) {
    bonusConRetroativo = (modConDepois - modConAntes) * novoNivel;
    personagem.pv_max += bonusConRetroativo;
    personagem.pv_atual += bonusConRetroativo;
  }
  
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
      const chave = `levelup_${novoNivel}`;
      personagem.escolhas_talento[chave] = opcoes.escolhas_talento_levelup;
      escolhasTalentoLevelup = opcoes.escolhas_talento_levelup;

      if (opcoes.talento === 'Dádiva da Proficiência em Perícia') {
        aplicarDadivaProficiencia(personagem, opcoes);
      }
    }

    // Aplicar bonus de PV do Vigoroso (dobro do nivel ao obter)
    if (opcoes.talento === 'Vigoroso') {
      const bonusVigoroso = novoNivel * 2;
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

    // Aplicar Tocado Por Fadas / Tocado Pelas Sombras (magia escolhida + magia parceira)
    if (opcoes.talento_tipo_escolha === 'tocado_fadas' || opcoes.talento_tipo_escolha === 'tocado_sombras') {
      const nomeMagia = opcoes.escolhas_talento_levelup?.[0];
      if (!personagem.magias_preparadas) personagem.magias_preparadas = [];
      const origem = opcoes.talento_tipo_escolha === 'tocado_fadas' ? 'tocado_por_fadas' : 'tocado_pelas_sombras';
      // Magia escolhida (1º círculo)
      if (nomeMagia && !personagem.magias_preparadas.find(m => m.nome === nomeMagia)) {
        personagem.magias_preparadas.push({ nome: nomeMagia, circulo: 1, origem, gratis_usado: false });
      }
      // Magia parceira sempre-preparada (2º círculo): Passo Nebuloso para Fadas, Invisibilidade para Sombras
      const nomeParceiro = opcoes.talento_tipo_escolha === 'tocado_fadas' ? 'Passo Nebuloso' : 'Invisibilidade';
      if (!personagem.magias_preparadas.find(m => m.nome === nomeParceiro)) {
        personagem.magias_preparadas.push({ nome: nomeParceiro, circulo: 2, origem, gratis_usado: false });
      }
    }

    // Aplicar Conjurador Ritualista (magias rituais)
    if (opcoes.talento_tipo_escolha === 'conjurador_ritualista') {
      if (!personagem.magias_preparadas) personagem.magias_preparadas = [];
      for (const nomeMagia of (opcoes.escolhas_talento_levelup || [])) {
        if (!personagem.magias_preparadas.find(m => m.nome === nomeMagia)) {
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

  // Campeão Primitivo (Bárbaro nível 20): FOR e CON +4 (máx 25)
  if (personagem.classe === 'Bárbaro' && novoNivel === 20) {
    personagem.atributos.forca = Math.min(25, (personagem.atributos.forca || 10) + 4);
    personagem.atributos.constituicao = Math.min(25, (personagem.atributos.constituicao || 10) + 4);
    // Recalcular PV com novo mod de CON (retroativo para todos os níveis)
    const modConCampeao = calcMod(personagem.atributos.constituicao);
    if (modConCampeao > modConDepois) {
      const bonusCampeao = (modConCampeao - modConDepois) * novoNivel;
      personagem.pv_max += bonusCampeao;
      personagem.pv_atual += bonusCampeao;
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
    nivel_anterior: nivelAnterior,
    nivel_novo: novoNivel,
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
