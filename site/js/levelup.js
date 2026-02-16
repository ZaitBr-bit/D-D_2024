// ============================================================
// Sistema de Level-Up D&D 2024
// ============================================================
import { CLASSES_INFO } from './dados-classes.js';
import { getClasse, getEspecies, getIndiceMagias } from './db.js';
import { calcMod, bonusProficiencia, getEspacosMagia, getTruquesConhecidos, getMagiaPreparadas } from './utils.js';

/**
 * Retorna os espaços de magia do Cavaleiro Místico para o nível atual.
 * Progressão de conjurador de 1/3 com espaços próprios.
 */
function getCavaleiroMisticoEspacos(nivel) {
  if (nivel < 3) return {};
  // Tabela de progressão do Cavaleiro Místico (nível do Guerreiro → espaços)
  const tabela = {
    3:  { 1: { total: 2, usados: 0 } },
    4:  { 1: { total: 3, usados: 0 } },
    7:  { 1: { total: 4, usados: 0 }, 2: { total: 2, usados: 0 } },
    8:  { 1: { total: 4, usados: 0 }, 2: { total: 2, usados: 0 } },
    10: { 1: { total: 4, usados: 0 }, 2: { total: 3, usados: 0 } },
    13: { 1: { total: 4, usados: 0 }, 2: { total: 3, usados: 0 }, 3: { total: 2, usados: 0 } },
    16: { 1: { total: 4, usados: 0 }, 2: { total: 3, usados: 0 }, 3: { total: 3, usados: 0 } },
    19: { 1: { total: 4, usados: 0 }, 2: { total: 3, usados: 0 }, 3: { total: 3, usados: 0 }, 4: { total: 1, usados: 0 } }
  };

  const niveis = Object.keys(tabela).map(Number).sort((a, b) => a - b);
  let entrada = {};
  for (const n of niveis) {
    if (n <= nivel) entrada = tabela[n];
  }
  return entrada;
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
 * Verifica se o nível exige escolha de Explorador Hábil (Guardião nv2: 1 expertise + 2 idiomas)
 */
export function exigeExploradorHabil(classe, nivel) {
  return classe === 'Guardião' && nivel === 2;
}

/**
 * Verifica se o nível exige escolha de Acadêmico (Mago nv2: 2 expertise em perícias de conhecimento)
 */
export function exigeAcademico(classe, nivel) {
  return classe === 'Mago' && nivel === 2;
}

/**
 * Extrai magias sempre preparadas de tabelas markdown no nível alvo.
 * Ex.: | 5 | *Passo Nebuloso* |
 */
function extrairMagiasSemprePreparadasTabela(descricao, nivelAlvo) {
  if (!descricao || !nivelAlvo) return [];
  const texto = descricao.toLowerCase();
  if (!texto.includes('sempre') || !texto.includes('preparad')) return [];

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
 * Ex.: "Você sempre tem a magia *Marca do Predador* preparada."
 */
function extrairMagiasSemprePreparadasTexto(descricao) {
  if (!descricao) return [];
  const texto = descricao.toLowerCase();
  if (!texto.includes('sempre') || !texto.includes('preparad')) return [];

  // Se a descricao contem uma tabela markdown, pular - a funcao de tabela cuida disso
  if (/\|\s*\d+\s*\|/.test(descricao) || /\|\s*\*\d+\*\s*\|/.test(descricao)) return [];

  // Extrair apenas de frases que contenham "sempre" + "preparad" + itálico juntos
  // Ex.: "Você sempre tem a magia *Destruição Divina* preparada."
  const nomes = [];
  // Dividir em frases/parágrafos (por ponto final, quebra de linha dupla, ou **negrito**)
  const frases = descricao.split(/(?:\.\s|\n\n|\*\*)/);
  for (const frase of frases) {
    const fl = frase.toLowerCase();
    if (!fl.includes('sempre') || !fl.includes('preparad')) continue;
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
export async function obterMagiasSemprePreparadasNivel(classe, subclasse, nivel) {
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
      extrairMagiasSemprePreparadasTabela(f.descricao, nivel).forEach(n => nomes.add(n));
    });

  // Características da classe de níveis anteriores (apenas tabela, para linhas que escalam por nível)
  featsClasse
    .filter(c => c.nivel < nivel)
    .forEach(f => {
      extrairMagiasSemprePreparadasTabela(f.descricao, nivel).forEach(n => nomes.add(n));
    });

  // Características da subclasse no nível
  if (subclasse) {
    const sc = (classeData.subclasses || []).find(s => s.nome === subclasse);
    const featsSubclasse = sc?.caracteristicas || [];

    featsSubclasse
      .filter(c => c.nivel === nivel)
      .forEach(f => {
        extrairMagiasSemprePreparadasTexto(f.descricao).forEach(n => nomes.add(n));
        extrairMagiasSemprePreparadasTabela(f.descricao, nivel).forEach(n => nomes.add(n));
      });

    featsSubclasse
      .filter(c => c.nivel < nivel)
      .forEach(f => {
        extrairMagiasSemprePreparadasTabela(f.descricao, nivel).forEach(n => nomes.add(n));
      });
  }

  if (nomes.size === 0) return [];

  const indice = await getIndiceMagias();
  const idx = indice?.magias || [];
  return [...nomes]
    .map(nome => {
      const m = idx.find(x => x.nome === nome);
      return m ? { nome, circulo: m.circulo || 1 } : null;
    })
    .filter(Boolean);
}

/**
 * Obtém todas as magias sempre preparadas até o nível atual.
 */
export async function obterTodasMagiasSemprePreparadas(classe, subclasse, nivelAtual) {
  const todas = [];
  for (let nivel = 1; nivel <= (nivelAtual || 1); nivel++) {
    const magias = await obterMagiasSemprePreparadasNivel(classe, subclasse, nivel);
    todas.push(...magias);
  }
  return todas;
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
    c.nivel === 3 && /^magias?\s+de/i.test((c.nome || '').trim())
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
  const caracteristicasEspecie = await obterCaracteristicasEspecieNivel(personagem.especie, novoNivel);
  
  // Verificar se precisa escolher subclasse
  const precisaSubclasse = exigeSubclasse(personagem.classe, novoNivel) && !personagem.subclasse;
  
  // Verificar se ganha aumento de atributo
  const ganhaAumentoAtributo = concedeAumentoAtributo(personagem.classe, novoNivel);
  const exigeEspecializacao = exigeEspecializacaoBardo(personagem.classe, novoNivel);
  const exigeEspecializacaoGuardiaoNivel = exigeEspecializacaoGuardiao(personagem.classe, novoNivel);
  const exigeEstiloLutaNivel = exigeEstiloLuta(personagem.classe, novoNivel);
  const exigeExploradorHabilNivel = exigeExploradorHabil(personagem.classe, novoNivel);
  const exigeAcademicoNivel = exigeAcademico(personagem.classe, novoNivel);
  
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

  // Validar Acadêmico (Mago nível 2: 2 expertise)
  if (exigeAcademicoNivel) {
    const selecionadas = Array.isArray(opcoes.academico_expertise) ? opcoes.academico_expertise : [];
    if (selecionadas.length !== 2) {
      return {
        sucesso: false,
        pendente: true,
        tipo_pendencia: 'academico',
        mensagem: 'É necessário escolher 2 perícias para Acadêmico do Mago'
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

  // Cavaleiro Místico: atualizar espaços de magia da subclasse
  if (personagem.classe === 'Guerreiro' && personagem.subclasse === 'Cavaleiro Místico' && novoNivel >= 3) {
    const tabelaCM = getCavaleiroMisticoEspacos(novoNivel);
    Object.keys(tabelaCM).forEach(circulo => {
      if (personagem.espacos_magia[circulo]) {
        personagem.espacos_magia[circulo].total = tabelaCM[circulo].total;
        if (personagem.espacos_magia[circulo].usados > tabelaCM[circulo].total) {
          personagem.espacos_magia[circulo].usados = tabelaCM[circulo].total;
        }
      } else {
        personagem.espacos_magia[circulo] = tabelaCM[circulo];
      }
    });
    // Remover círculos que não existem mais
    Object.keys(personagem.espacos_magia).forEach(circulo => {
      if (!tabelaCM[circulo]) {
        delete personagem.espacos_magia[circulo];
      }
    });
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

  // Adicionar automaticamente magias sempre preparadas
  const magiasSempre = await obterMagiasSemprePreparadasNivel(personagem.classe, subclasseAtual, novoNivel);
  if (magiasSempre.length > 0) {
    if (!personagem.magias_preparadas) personagem.magias_preparadas = [];
    for (const magia of magiasSempre) {
      if (!personagem.magias_preparadas.find(m => m.nome === magia.nome)) {
        personagem.magias_preparadas.push({ ...magia, origem: 'sempre' });
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

    // Aplicar escolhas do talento (Habilidoso/Artifista/Músico)
    if (Array.isArray(opcoes.escolhas_talento_levelup) && opcoes.escolhas_talento_levelup.length > 0) {
      if (!personagem.escolhas_talento) personagem.escolhas_talento = {};
      const chave = `levelup_${novoNivel}`;
      personagem.escolhas_talento[chave] = opcoes.escolhas_talento_levelup;
      escolhasTalentoLevelup = opcoes.escolhas_talento_levelup;

      // Aplicar pericias do Habilidoso nas proficiencias
      if (opcoes.talento === 'Habilidoso') {
        if (!personagem.pericias_proficientes) personagem.pericias_proficientes = [];
        const _periciasNomes = [
          'Acrobacia','Arcanismo','Atletismo','Atuação','Enganação','Furtividade',
          'História','Intimidação','Intuição','Investigação','Lidar com Animais',
          'Medicina','Natureza','Percepção','Persuasão','Prestidigitação',
          'Religião','Sobrevivência'
        ];
        for (const escolha of opcoes.escolhas_talento_levelup) {
          if (_periciasNomes.includes(escolha) && !personagem.pericias_proficientes.includes(escolha)) {
            personagem.pericias_proficientes.push(escolha);
          }
        }
      }
    }

    // Aplicar bonus de PV do Vigoroso (dobro do nivel ao obter)
    if (opcoes.talento === 'Vigoroso') {
      const bonusVigoroso = novoNivel * 2;
      personagem.pv_max = (personagem.pv_max || 0) + bonusVigoroso;
      personagem.pv_atual = Math.min(personagem.pv_atual + bonusVigoroso, personagem.pv_max);
      personagem.bonus_pv_vigoroso_aplicado = bonusVigoroso;
    }

    // Aplicar ASI do talento (Adepto Elemental, Agressor, etc.)
    if (opcoes.talento_asi) {
      const chaveAttr = opcoes.talento_asi;
      const valorAtual = personagem.atributos[chaveAttr] || 10;
      personagem.atributos[chaveAttr] = Math.min(20, valorAtual + 1);
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

    // Aplicar Tocado Por Fadas / Tocado Pelas Sombras (magia extra)
    if (opcoes.talento_tipo_escolha === 'tocado_fadas' || opcoes.talento_tipo_escolha === 'tocado_sombras') {
      const nomeMagia = opcoes.escolhas_talento_levelup?.[0];
      if (nomeMagia) {
        if (!personagem.magias_preparadas) personagem.magias_preparadas = [];
        const origem = opcoes.talento_tipo_escolha === 'tocado_fadas' ? 'tocado_por_fadas' : 'tocado_pelas_sombras';
        if (!personagem.magias_preparadas.find(m => m.nome === nomeMagia)) {
          personagem.magias_preparadas.push({ nome: nomeMagia, circulo: 1, origem });
        }
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
      // Adicionar magia de 1o círculo às preparadas
      if (im.magia) {
        if (!personagem.magias_preparadas) personagem.magias_preparadas = [];
        if (!personagem.magias_preparadas.find(m => m.nome === im.magia)) {
          personagem.magias_preparadas.push({ nome: im.magia, circulo: 1, origem: 'iniciado_em_magia' });
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

  // Aplicar Acadêmico do Mago (nível 2: 2 expertise acadêmicas)
  let academicoAplicado = [];
  if (exigeAcademicoNivel) {
    if (!personagem.pericias_expertise) personagem.pericias_expertise = [];
    const selecionadas = (opcoes.academico_expertise || []).filter(Boolean);
    for (const pericia of selecionadas) {
      if (!personagem.pericias_expertise.includes(pericia)) {
        personagem.pericias_expertise.push(pericia);
        academicoAplicado.push(pericia);
      }
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
    subclasse_escolhida: precisaSubclasse ? opcoes.subclasse : null,
    aumento_atributo: ganhaAumentoAtributo,
    aumentos_aplicados: opcoes.aumentos_atributo || null,
    talento_aplicado: opcoes.talento || null,
    talento_asi_aplicado: opcoes.talento_asi || null,
    escolhas_talento_levelup: escolhasTalentoLevelup,
    expertise_bardo_aplicada: expertiseBardoAplicada,
    expertise_guardiao_aplicada: expertiseGuardiaoAplicada,
    estilo_luta_aplicado: estiloLutaAplicado,
    explorador_habil_aplicado: exploradorHabilAplicado,
    academico_aplicado: academicoAplicado
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
