// ============================================================
// Sistema de Level-Up D&D 2024
// ============================================================
import { CLASSES_INFO } from './dados-classes.js';
import { getClasse, getEspecies, getIndiceMagias } from './db.js';
import { calcMod, bonusProficiencia, getEspacosMagia, getTruquesConhecidos, getMagiaPreparadas } from './utils.js';

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
  if (!row || !row['Características']) return [];
  
  const caracteristicas = row['Características'];
  if (caracteristicas === '—' || caracteristicas === '-') return [];
  
  // Dividir por vírgula e limpar espaços
  return caracteristicas.split(',').map(c => c.trim()).filter(c => c);
}

/**
 * Verifica se o nível concede Aumento de Atributo
 */
export function concedeAumentoAtributo(classe, nivel) {
  const aumentos = {
    'Clérigo': [4, 8, 12, 16],
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
 * Obtém características de espécie que desbloqueiam em níveis específicos
 */
export async function obterCaracteristicasEspecieNivel(especie, nivel) {
  const especiesData = await getEspecies();
  const especieData = especiesData?.especies?.find(e => e.nome === especie);
  
  if (!especieData) return [];
  
  const caracteristicas = [];
  
  // Golias: Forma Grande no nível 5
  if (especie === 'Golias' && nivel === 5) {
    caracteristicas.push({
      nome: 'Forma Grande',
      descricao: 'A partir do nível 5, você pode alterar seu tamanho para Grande como uma Ação Bônus.'
    });
  }
  
  // Aasimar: Revelação Celestial no nível 3
  if (especie === 'Aasimar' && nivel === 3) {
    caracteristicas.push({
      nome: 'Revelação Celestial',
      descricao: 'No nível 3, você pode se transformar como uma Ação Bônus.'
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
  
  // Encontrar a feature de magias de domínio (nível 3)
  const magiasFeat = sc.caracteristicas.find(c => 
    c.nivel === 3 && c.nome.toLowerCase().startsWith('magias de')
  );
  if (!magiasFeat) return [];
  
  // Parsear tabela markdown para extrair magias por nível
  // Formato: | 3 | *Magia1, Magia2, Magia3* |
  const linhas = magiasFeat.descricao.split('\n');
  const nomesMagias = [];
  
  for (const linha of linhas) {
    // Procurar linhas da tabela com nível e magias
    const match = linha.match(/\|\s*(\d+)\s*\|\s*\*([^*]+)\*\s*\|/);
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
  const modCon = calcMod(personagem.atributos.constituicao);
  const hpGanho = calcularHPGanho(personagem.classe, modCon);
  
  // Obter características do novo nível
  const caracteristicas = await obterCaracteristicasNivel(personagem.classe, novoNivel);
  const caracteristicasEspecie = await obterCaracteristicasEspecieNivel(personagem.especie, novoNivel);
  
  // Verificar se precisa escolher subclasse
  const precisaSubclasse = exigeSubclasse(personagem.classe, novoNivel) && !personagem.subclasse;
  
  // Verificar se ganha aumento de atributo
  const ganhaAumentoAtributo = concedeAumentoAtributo(personagem.classe, novoNivel);
  
  // Se precisa de escolhas do jogador e não foram fornecidas, retornar pendências
  if (precisaSubclasse && !opcoes.subclasse) {
    return {
      sucesso: false,
      pendente: true,
      tipo_pendencia: 'subclasse',
      mensagem: 'É necessário escolher uma subclasse para avançar para o nível 3'
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
  
  // Obter características de subclasse para este nível
  const subclasseAtual = personagem.subclasse;
  const caracteristicasSubclasse = await obterCaracteristicasSubclasseNivel(personagem.classe, subclasseAtual, novoNivel);
  
  // Adicionar automaticamente magias de domínio/subclasse
  const magiasDominio = await obterMagiasDominioNivel(personagem.classe, subclasseAtual, novoNivel);
  if (magiasDominio.length > 0) {
    if (!personagem.magias_preparadas) personagem.magias_preparadas = [];
    for (const magia of magiasDominio) {
      if (!personagem.magias_preparadas.find(m => m.nome === magia.nome)) {
        personagem.magias_preparadas.push({ ...magia, origem: 'dominio' });
      }
    }
  }
  
  // Aplicar aumentos de atributo
  if (ganhaAumentoAtributo && opcoes.aumentos_atributo) {
    for (const [atributo, valor] of Object.entries(opcoes.aumentos_atributo)) {
      if (personagem.atributos[atributo]) {
        personagem.atributos[atributo] += valor;
        // Cap em 20
        if (personagem.atributos[atributo] > 20) {
          personagem.atributos[atributo] = 20;
        }
      }
    }
  }
  
  // Aplicar talento (se escolhido ao invés de aumento)
  if (ganhaAumentoAtributo && opcoes.talento) {
    if (!personagem.talentos) personagem.talentos = [];
    personagem.talentos.push(opcoes.talento);
  }
  
  // Retornar resumo do level-up
  return {
    sucesso: true,
    nivel_anterior: nivelAnterior,
    nivel_novo: novoNivel,
    hp_ganho: hpGanho,
    bonus_proficiencia: bonusNovo,
    bonus_mudou: bonusMudou,
    caracteristicas: caracteristicas,
    caracteristicas_especie: caracteristicasEspecie,
    caracteristicas_subclasse: caracteristicasSubclasse,
    magias_dominio_adicionadas: magiasDominio,
    subclasse_escolhida: precisaSubclasse ? opcoes.subclasse : null,
    aumento_atributo: ganhaAumentoAtributo,
    aumentos_aplicados: opcoes.aumentos_atributo || null,
    talento_aplicado: opcoes.talento || null
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
