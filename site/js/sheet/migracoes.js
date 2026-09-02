// ============================================================
// Migracoes de fichas legadas
//
// Rodam na abertura da ficha, antes do primeiro render. Cada uma
// converte um formato antigo de dado para o atual, sem efeito se ja
// estiver convertido.
// Extraido de site/js/pages/sheet.js sem alteracao de comportamento.
// ============================================================
import { CLASSES_INFO } from '../dados-classes.js';
import { PROFICIENCIAS_FIXAS_TALENTO } from '../regras-cobertura.js';
import { MAGIAS_LEGADO_ESPECIE, _concederMagiaAutomatica } from '../levelup.js';
import { getTruquesFixosAcumulados } from '../regras-conjuracao-subclasse.js';
import { classesDe } from '../regras-multiclasse.js';
import { getLimitesMagias } from '../utils.js';
import { char, indiceMagiasCache, magiasDominioCache, magiasSempreCache, salvar } from './estado.js';
import { getSubclasseConjuradoraConjuracao, magiaContaNoLimite } from './magias.js';
// superficiesDaFicha (Tarefa 3, sub-projeto "tela magias por classe"):
// substitui a leitura de char.classe/classeData/char.nivel (a classe
// INICIAL e o nível TOTAL, os espelhos) por classes[] de verdade em
// migrarSlotsMagiaLivre, abaixo -- ver o comentário dela para o porquê.
import { superficiesDaFicha } from './contexto-classe.js';

/** Migra magias de domínio legadas adicionando origem: 'dominio' */
export function migrarMagiasDominio() {
  if (!magiasDominioCache?.length || !char.magias_preparadas?.length) return;
  let alterado = false;
  const nomesDominio = new Set(magiasDominioCache.map(m => m.nome));
  char.magias_preparadas.forEach(m => {
    if (nomesDominio.has(m.nome) && m.origem !== 'dominio' && m.origem !== 'sempre' && m.origem !== 'especie_legado') {
      m.origem = 'dominio';
      alterado = true;
    }
  });
  if (alterado) salvar();
}

/** Migra magias sempre preparadas legadas adicionando origem: 'sempre' */
/**
 * Detecta retroativamente se o personagem tem menos magias manuais do que o
 * limite permite — situação causada por magias salvas com origem: 'sempre'
 * antes de a migração registrar os slots liberados.
 */
export function migrarSlotsMagiaLivre() {
  // sup: a PRIMEIRA superfície de conjuração de char.classes[] (mesmo
  // conceito de superficieAtiva() em sheet/grimorio.js e sheet/magias.js) --
  // nunca os espelhos char.classe/classeData/char.nivel. ANTES desta
  // conversão (Tarefa 3), um Guerreiro/Bardo (Guerreiro na ordem 0, sem
  // Conjuração) lia `CLASSES_INFO[char.classe]` do Guerreiro, `tipoConj`
  // caía em 'preparadas' por omissão e a função retornava sem NUNCA checar
  // o déficit de magias conhecidas do Bardo -- a migração inteira ficava
  // muda para esse personagem. Com `sup`, a primeira superfície QUE
  // CONJURA é o Bardo, e a checagem passa a rodar para ele.
  //
  // `sup.nivelClasse` (não char.nivel, o TOTAL) também corrige uma segunda
  // divergência: antes, um Bardo 5/Guerreiro 3 (total 8) confrontava a
  // tabela do Bardo no nível 8, inflando o déficit calculado acima do que
  // o livro concede a um Bardo de nível 5. Sem risco de perda: esta função
  // só ELEVA `char._slots_..._livre` quando o déficit calculado supera o
  // valor já gravado (`deficit > (char._slots_..._livre || 0)`, abaixo) --
  // nunca abaixa um valor que uma passagem anterior (mesmo com a conta
  // antiga, mais generosa) já tenha gravado.
  const sup = superficiesDaFicha(char)[0] || null;
  if (!sup) return; // nenhuma superfície de conjuração -- nada para checar
  const info = CLASSES_INFO[sup.classe];
  const subConj = getSubclasseConjuradoraConjuracao({ classe: sup.classe, subclasse: sup.subclasse, nivel: sup.nivelClasse });
  const tipoConj = info?.tipo_conjuracao || (subConj ? 'conhecidas' : 'preparadas');
  if (tipoConj !== 'conhecidas') return; // só Feiticeiro-like conta magias conhecidas fixas

  const tabela = sup.tabela;
  if (!tabela) return;

  // getLimitesMagias cai para a tabela da subclasse quando a da classe não
  // tem colunas de magia: sem isso o limite de um Trapaceiro Arcano/
  // Cavaleiro Místico era lido como 0 e a vaga nunca era oferecida -- foi o
  // que deixou sem saída os personagens que subiram para o nível 3 antes da
  // correção do fluxo de subida (que não pedia truque nem magia nenhuma).
  const limites = getLimitesMagias(tabela, sup.nivelClasse, subConj);
  let alterado = false;

  if (limites.preparadas > 0) {
    const atual = (char.magias_preparadas || []).filter(m => magiaContaNoLimite(m)).length;
    const deficit = limites.preparadas - atual;
    // Se o slot já foi contabilizado, não duplicar
    if (deficit > 0 && deficit > (char._slots_magia_livre || 0)) {
      char._slots_magia_livre = deficit;
      alterado = true;
    }
  }

  if (limites.truques > 0) {
    // Truques de espécie/talento não ocupam o limite de classe (mesma
    // separação que a seção Magias da ficha faz nos contadores).
    const origensForaDoLimite = ['especie', 'especie_legado', 'iniciado_em_magia',
      'tocado_por_fadas', 'tocado_pelas_sombras', 'conjurador_ritualista', 'telecinetico'];
    const atuais = (char.magias_conhecidas || [])
      .filter(m => m.circulo === 0 && !origensForaDoLimite.includes(m?.origem)).length;
    const deficit = limites.truques - atuais;
    if (deficit > 0 && deficit > (char._slots_truque_livre || 0)) {
      char._slots_truque_livre = deficit;
      alterado = true;
    }
  }

  if (alterado) salvar();
}

/**
 * Concede os truques que a subclasse dá de graça (Mãos Mágicas do
 * Trapaceiro Arcano) a fichas que subiram de nível antes de o fluxo de
 * subida passar a concedê-los.
 *
 * Percorre TODAS as classes do personagem (classesDe), consultando cada
 * uma com a SUA PRÓPRIA subclasse e o SEU PRÓPRIO nível -- nunca os
 * espelhos `char.classe`/`char.subclasse`/`char.nivel`, que só enxergam a
 * classe INICIAL e o nível TOTAL. Num Mago 5/Ladino 3 (Trapaceiro Arcano) o
 * espelho aponta para o Mago; ler só o espelho nunca concederia Mãos
 * Mágicas. `getTruquesFixosAcumulados` já se recusa a cruzar classe de uma
 * entrada com subclasse de outra (guarda `def.classe !== classe`), então
 * consultar cada entrada com seu próprio par preserva essa propriedade.
 */
export function migrarTruquesFixosSubclasse() {
  const fixos = classesDe(char)
    .flatMap((c) => getTruquesFixosAcumulados(c.classe, c.subclasse, c.nivel || 1));
  if (fixos.length === 0) return;
  if (!char.magias_conhecidas) char.magias_conhecidas = [];
  let alterado = false;
  for (const nome of fixos) {
    if (!char.magias_conhecidas.some(m => m.nome === nome)) {
      char.magias_conhecidas.push({ nome, circulo: 0, origem: 'subclasse_fixa' });
      alterado = true;
    }
  }
  if (alterado) salvar();
}

export function migrarMagiasSemprePreparadas() {
  if (!char.magias_preparadas?.length) return;
  let alterado = false;
  let slotsLiberados = 0;
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
    if (nomesSempre.has(m.nome) && m.origem !== 'dominio' && m.origem !== 'sempre' && m.origem !== 'especie_legado') {
      m.origem = 'sempre';
      slotsLiberados++;
      alterado = true;
    }
  });

  // Se havia magias sem origem que agora são "sempre", o jogador perdeu uma
  // escolha manual — marcar para que a UI ofereça preencher o slot.
  if (slotsLiberados > 0) {
    char._slots_magia_livre = (char._slots_magia_livre || 0) + slotsLiberados;
    alterado = true;
  }

  // Realocar truques sempre-preparados salvos errado como magias de 1º círculo
  // (bug antigo: circulo 0 virava 1 e caía em magias_preparadas)
  const circuloPorNome = new Map((magiasSempreCache || []).map(m => [m.nome, m.circulo]));
  const realocar = char.magias_preparadas.filter(m => m.origem === 'sempre' && circuloPorNome.get(m.nome) === 0);
  if (realocar.length > 0) {
    if (!char.magias_conhecidas) char.magias_conhecidas = [];
    for (const m of realocar) {
      if (!char.magias_conhecidas.find(x => x.nome === m.nome)) {
        char.magias_conhecidas.push({ nome: m.nome, circulo: 0, origem: 'sempre' });
      }
    }
    char.magias_preparadas = char.magias_preparadas.filter(m => !(m.origem === 'sempre' && circuloPorNome.get(m.nome) === 0));
    alterado = true;
  }

  if (alterado) salvar();
}

/** Adiciona truques concedidos pela espécie que estejam faltando */
export function migrarTruquesEspecie() {
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

/**
 * Migração retroativa: concede a magia de Legado Ínfero (Tiferino) / Linhagem
 * Élfica (Elfo) dos níveis 3 e 5 para fichas que já estavam nesses níveis antes
 * de essa concessão automática existir em subirDeNivel (Task 4). Idempotente,
 * no mesmo padrão de migrarTruquesEspecie.
 */
export function migrarMagiasLegadoEspecie() {
  if (!char.especie || !char.nivel) return;
  const legadoEscolhido = (char.tracos_escolhidos || [])[0];
  const tabelaLegado = MAGIAS_LEGADO_ESPECIE[char.especie]?.[legadoEscolhido];
  if (!tabelaLegado) return;

  if (!char.magias_preparadas) char.magias_preparadas = [];
  let alterado = false;
  for (const [nivelStr, nomeMagia] of Object.entries(tabelaLegado)) {
    const nivel = Number(nivelStr);
    if (nivel > char.nivel) continue;
    const jaTem = char.magias_preparadas.find(m => m.nome === nomeMagia && m.origem === 'especie_legado');
    if (jaTem) continue;
    const magiaIdx = (indiceMagiasCache || []).find(m => m.nome === nomeMagia);
    const circulo = magiaIdx?.circulo ?? (nivel === 3 ? 1 : 2);
    _concederMagiaAutomatica(char.magias_preparadas, { nome: nomeMagia, circulo }, 'especie_legado');
    alterado = true;
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
export function migrarEscolhasClasseLegadas() {
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
export function migrarNomePericiaLidarAnimais() {
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
export function migrarTalentoVersatilHumano() {
  if (char.especie !== 'Humano' || !char.talento_versatil) return;
  if (!char.talentos) char.talentos = [];
  if (!char.talentos.includes(char.talento_versatil)) {
    char.talentos.push(char.talento_versatil);
    salvar();
  }
}

/** Garante que a pericia de especie (Habil/Sentidos Aguçados) esteja nas proficiencias */
export function migrarPericiaEspecie() {
  if (!char.pericia_especie) return;
  if (!char.pericias_proficientes) char.pericias_proficientes = [];
  if (!char.pericias_proficientes.includes(char.pericia_especie)) {
    char.pericias_proficientes.push(char.pericia_especie);
    salvar();
  }
}

/** Garante que pericias de especie (array, ex: Kenku) estejam nas proficiencias */
export function migrarPericiasEspecie() {
  if (!char.pericias_especie?.length) return;
  if (!char.pericias_proficientes) char.pericias_proficientes = [];
  let changed = false;
  char.pericias_especie.forEach(p => {
    if (p && !char.pericias_proficientes.includes(p)) {
      char.pericias_proficientes.push(p);
      changed = true;
    }
  });
  if (changed) salvar();
}

/** Garante que pericias de talentos (Habilidoso) estejam nas proficiencias */
export function migrarPericiasTalentos() {
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

/**
 * Concede retroativamente as proficiências fixas dos talentos que a ficha
 * já tem gravados. Fichas salvas ANTES de 2026-08-19 têm o talento em
 * char.talentos mas nunca receberam a proficiência: aplicarEfeitoTalento
 * não tinha o ramo, e o efeito só existia numa saída derivada que ninguém
 * lia. Aditiva e idempotente -- não remove nada e não duplica.
 */
export function migrarProficienciasTalentos() {
  const nomes = new Set((char.talentos || [])
    .map(t => (typeof t === 'string' ? t : t?.nome))
    .filter(Boolean));
  let mudou = false;
  for (const [talento, concessao] of Object.entries(PROFICIENCIAS_FIXAS_TALENTO)) {
    if (!nomes.has(talento)) continue;
    const destinos = [
      ['proficiencias_extra', concessao.extras],
      ['proficiencias_ferramentas', concessao.ferramentas],
    ];
    for (const [campo, itens] of destinos) {
      if (!itens) continue;
      if (!Array.isArray(char[campo])) char[campo] = [];
      for (const item of itens) {
        if (!char[campo].includes(item)) {
          char[campo].push(item);
          mudou = true;
        }
      }
    }
  }
  if (mudou) salvar();
}

// Import colocado aqui (e não no bloco do topo) de propósito: inserir uma
// linha no bloco de imports desloca a numeração de todo o arquivo abaixo,
// e testes/regras/catalogo/magias-preparo.mjs guarda uma exceção chaveada
// pela linha exata de `origensForaDoLimite` em migrarSlotsMagiaLivre
// (EXCECOES_LISTA_ORIGEM['sheet/migracoes.js:93'] -- linha 93 desde a
// Tarefa 3, que já deslocou este trecho ao converter migrarSlotsMagiaLivre
// para ler classes[] via superficiesDaFicha; o import de
// superficiesDaFicha foi ao bloco do topo mesmo assim, porque o
// deslocamento de `origensForaDoLimite` já vinha do corpo da função
// convertida, não do import). Mantendo este import ao lado do único trecho
// que o usa, a numeração do resto do arquivo não muda de novo por causa
// dele.
import { migrarParaMulticlasse } from '../regras-multiclasse.js';

/**
 * Migra a ficha aberta para o modelo de multiclasse.
 * Casca fina no idioma das outras migrações (sem parâmetro, lendo o
 * `char` global e salvando); a lógica está em regras-multiclasse.js,
 * que é pura e testável fora do navegador.
 */
export function migrarMulticlasse() {
  if (migrarParaMulticlasse(char)) salvar();
}

// Import colocado aqui pelo mesmo motivo do de migrarParaMulticlasse, logo
// acima: nao deslocar a numeracao do arquivo (ver o comentario daquele
// import) -- soma-se a ele, entao nao precisa repetir o raciocinio.
import { migrarEspacosDeMagia } from '../regras-multiclasse-conjuracao.js';

/**
 * Migra os espacos de magia da ficha aberta para a forma por FONTE
 * (conjuracao/pacto). Casca fina no idioma das outras migracoes (sem
 * parametro, lendo o `char` global e salvando); a logica pura -- e o
 * porque de so `usados` sobreviver -- esta em
 * regras-multiclasse-conjuracao.js (migrarEspacosDeMagia), testavel fora
 * do navegador.
 */
export function migrarEspacosMagia() {
  if (migrarEspacosDeMagia(char)) salvar();
}

// Imports colocados aqui pelo mesmo motivo dos dois acima (nao deslocar a
// numeracao do arquivo -- ver o comentario de migrarParaMulticlasse): esta
// e a ULTIMA migracao do arquivo, entao os imports dela tambem entram no
// fim, ao lado do unico trecho que os usa.
import { classeDaMagiaPreparada, nomesDaListaDeMagias } from '../regras-magia-classe.js';
import { superficiesDeConjuracao } from '../regras-multiclasse-conjuracao.js';
import { getMagiasClasse } from '../db.js';
import { classesData } from './estado.js';

/**
 * Migra `magias_preparadas[]` de fichas gravadas ANTES de o campo `classe`
 * existir (Tarefas 1 e 2 deste sub-projeto), carimbando cada entrada com a
 * classe dona -- quando isso pode ser afirmado sem chutar.
 *
 * O campo e OPCIONAL de proposito, nunca um palpite: medido sobre os 8
 * arquivos dados/classes/magias_*.json, so 24,6% das 391 magias distintas
 * existem numa UNICA classe, e as duplas mais jogadas sao as piores
 * (Feiticeiro/Mago compartilham 95% da lista menor, Bruxo/Mago 89%,
 * Bardo/Mago 74%). Um carimbo errado e pior que nenhum: o app passaria a
 * exibir limite por classe com confianca e errado, e some a possibilidade
 * de saber que nao se sabe. O criterio inteiro mora em
 * `classeDaMagiaPreparada` (regras-magia-classe.js) -- esta funcao so
 * alimenta ela com os dados certos (personagem e, quando ha multiclasse,
 * `listasPorClasse`) e grava exatamente o que ela devolver, nunca
 * reimplementando nem "melhorando" a regra.
 *
 * PRIMEIRA MIGRACAO ASSINCRONA do arquivo: todas as outras decidem so com
 * o que ja esta em memoria (char e os caches montados na abertura da
 * ficha); esta, no caso multiclasse, precisa das listas de magias de cada
 * classe (dados/classes/magias_<classe>.json), que vem de disco via
 * getMagiasClasse -- e so quando ha DUAS OU MAIS superficies de
 * conjuracao, porque classe unica nunca consulta lista nenhuma
 * (classeDaMagiaPreparada responde pela superficie unica direto, RULING
 * R-B do brief da Tarefa 1) e classe unica e a maioria esmagadora das
 * fichas. O inicializador que chama esta funcao (pages/sheet.js) ja e
 * async, entao o `await` aqui nao muda a forma de quem a chama.
 *
 * Idempotente e nunca sobrescreve: uma entrada que ja tem `classe` (string
 * nao vazia) e pulada sem ser reavaliada, e uma segunda passagem nao altera
 * nada. Roda em TODA abertura de ficha -- por isso a saida barata, logo no
 * inicio, evita ate montar `listasPorClasse` quando nao ha nada para fazer.
 *
 * @returns {Promise<boolean>} true se carimbou alguma entrada.
 */
export async function migrarMagiaClasse() {
  const preparadas = char.magias_preparadas;
  if (!preparadas?.length) return false;

  // Saida barata: se toda entrada ja tem `classe` (string nao vazia) ou e
  // isenta (magiaContaNoLimite falso -- dominio, sempre, talento etc., que
  // nunca saem do orcamento de uma classe), nao ha nada para fazer. Confere
  // ANTES de tocar em disco: esta migracao roda a cada abertura de ficha, e
  // nao pode custar 8 leituras de JSON para nao fazer nada na maioria delas.
  const faltaCarimbar = (m) =>
    magiaContaNoLimite(m) && !(typeof m.classe === 'string' && m.classe.trim() !== '');
  if (!preparadas.some(faltaCarimbar)) return false;

  const superficies = superficiesDeConjuracao(char, classesData);
  // Classe unica NAO carrega lista nenhuma: classeDaMagiaPreparada resolve
  // pela superficie unica sem consultar listasPorClasse (RULING R-B), e
  // classe unica e o caso comum. So multiclasse (duas ou mais superficies)
  // justifica o custo de ir a disco.
  let listasPorClasse = null;
  if (superficies.length >= 2) {
    listasPorClasse = new Map();
    // A CHAVE e o nome da LISTA (`listaMagias` da superficie), nao o nome
    // da classe -- Cavaleiro Mistico e Trapaceiro Arcano tem `classe`
    // 'Guerreiro'/'Ladino' mas preparam da lista 'Mago'. Set para nao
    // buscar a mesma lista duas vezes quando duas superficies a
    // compartilham.
    for (const nomeLista of new Set(superficies.map((s) => s.listaMagias))) {
      const json = await getMagiasClasse(nomeLista);
      // json nulo (arquivo inexistente) simplesmente nao entra no mapa --
      // as magias dessa superficie ficam sem carimbo, que e correto: nao
      // sabemos.
      if (json) listasPorClasse.set(nomeLista, nomesDaListaDeMagias(json));
    }
  }

  let alterado = false;
  for (const magia of preparadas) {
    // Nunca sobrescreve um carimbo que ja existe.
    if (typeof magia.classe === 'string' && magia.classe.trim() !== '') continue;
    const classe = classeDaMagiaPreparada(char, magia, { mapaDados: classesData, listasPorClasse });
    // Nunca grava valor vazio: so grava quando classeDaMagiaPreparada
    // devolve uma string (nunca null/''/undefined) -- senao a entrada fica
    // exatamente como estava, sem a chave.
    if (classe) {
      magia.classe = classe;
      alterado = true;
    }
  }
  if (alterado) salvar();
  return alterado;
}

/**
 * Issue #46: tira de `char.magias_preparadas` as entradas de magia
 * customizada que fichas antigas gravaram ao clicar "Preparar".
 *
 * A customizada de círculo 1+ passou a ser SEMPRE preparada e DERIVADA de
 * `char.magias_customizadas` -- essa é agora a única morada do fato. A
 * entrada duplicada em `magias_preparadas` faria a ficha desenhar a mesma
 * magia duas vezes (uma derivada, uma gravada), que é o defeito que a folha
 * impressa já tinha (impressao.js varre as duas listas).
 *
 * LASTRO, e por que ele importa: só sai a entrada que casa nome E círculo
 * com um registro de `magias_customizadas` -- a mesma disciplina de
 * `magiaPersonalizadaDaFicha` (sheet/grimorio.js). Uma entrada marcada
 * `personalizada` sem lastro é MARCA ERRADA, não a magia do jogador: ou ele
 * removeu a customizada e a preparada ficou para trás, ou a marca caiu numa
 * homônima do acervo. Essa entrada FICA, perdendo só a marca -- apagá-la
 * seria perda de dado silenciosa numa migração que roda em toda abertura.
 *
 * `Number(...) || 0` nos dois lados: o formulário de Magia Personalizada
 * gravava o círculo como string em ficha antiga (mesmo saneamento de
 * `normalizarMagiaPersonalizada`, sheet/magias.js).
 *
 * ENTRADA CONCEDIDA (com `origem`) NÃO É CANDIDATA DE CAMINHO NENHUM, e a
 * guarda que garante isso vem ANTES dos dois -- não dentro de um deles. Ela
 * fica na ficha, perdendo só a marca `personalizada` quando a carregar. O
 * porquê, e os dois mecanismos que fazem a marca conviver com `origem` na
 * mesma entrada, estão no comentário da guarda, no laço.
 *
 * SÃO DOIS CAMINHOS DE REMOÇÃO, deliberadamente independentes:
 *
 * 1. ENTRADA COM A MARCA e com lastro. A marca É a prova de origem -- só o
 *    cartão da magia personalizada a grava -- e por isso este caminho não
 *    consulta o acervo: ele continua funcionando com o índice vazio.
 *
 *    A RESSALVA HONESTA, para quem varrer isto atrás de perda de dado: em
 *    ficha ANTIGA a marca podia estar errada. O gravador do painel Grimório
 *    (sheet/magias.js) carimbava `personalizada` casando SÓ PELO NOME com
 *    `magias_customizadas`, sem conferir círculo -- então a preparação
 *    legítima da magia do LIVRO saía marcada quando o jogador tivesse uma
 *    customizada homônima. Esse gravador foi removido (issue #46), mas o
 *    carimbo persistido não. Quando o círculo também bate, este caminho
 *    remove uma preparação do livro. Fica assim de propósito: a perda é
 *    RECUPERÁVEL COM UM CLIQUE -- a magia do livro continua no acervo (e, no
 *    Mago, em `char.grimorio`, que `migrarCopiasCustomizadasDoGrimorio`
 *    preserva justamente por ser homônima do acervo), então basta preparar de
 *    novo. Endurecer o critério aqui custaria a limpeza que a migração existe
 *    para fazer, e o dado do jogador -- a customizada -- não corre risco.
 *
 * 2. ENTRADA CRUA, sem marca nenhuma (residual achado quando a Task 5
 *    rodou). Ficha MUITO antiga, de antes das issues #27/#33, em que o
 *    jogador preparou a customizada pelo grimório numa época em que o
 *    gravador não carimbava nada. Sem a marca não há prova de origem, e
 *    remover por nome+círculo apagaria a preparação LEGÍTIMA da magia do
 *    livro homônima -- o mesmo defeito de perda silenciosa que o caminho 1
 *    evita com o lastro. O desempate é o de
 *    `migrarCopiasCustomizadasDoGrimorio` (abaixo, no mesmo arquivo): só sai
 *    a entrada cujo nome NÃO existe no acervo naquele círculo, a única em
 *    que a origem é inequívoca. Havendo homônima, a entrada fica e renderiza
 *    como magia do livro, que é estado coerente.
 *
 *    A RESSALVA HONESTA deste caminho: varridos os gravadores que escrevem em
 *    `magias_preparadas` SEM `origem` (creator/passo-magias.js, levelup-ui.js,
 *    sheet/grimorio.js e sheet/magias.js), TODOS tiram o nome e o círculo da
 *    lista da classe ou do acervo. Isso PRESSUPÕE que as listas por classe
 *    concordem com o índice, e há UMA divergência medida neste checkout:
 *    `dados/magias/por_classe/druida.json` traz "De Carne para Pedra" no
 *    círculo 5, enquanto `_indice.json` e `circulo_6.json` a têm no 6 -- então
 *    a Druida que a preparou pela lista da classe grava círculo 5, que o
 *    acervo não tem. Esse é o único caminho medido para uma entrada legítima
 *    cair em "não existe no acervo naquele círculo"; o outro, teórico, é uma
 *    magia renomeada ou retirada do índice entre dois salvamentos. Nos dois, a
 *    remoção ainda exige a coincidência de o personagem ter uma customizada de
 *    MESMO nome e MESMO círculo -- por isso ficam declaradas, não consertadas.
 *    A divergência do JSON é achado à parte, do dono do produto: NÃO a
 *    conserte aqui de passagem.
 *
 * NA DÚVIDA, PRESERVA: o acervo vem de `indiceMagiasCache` (populado por
 * `definirIndiceMagias` em sheet.js antes das migrações), e não de um fetch,
 * pelo mesmo motivo detalhado em `migrarCopiasCustomizadasDoGrimorio` --
 * índice vazio ou ausente significa "não sei o que o livro tem", não "o
 * livro não tem nenhuma delas". Sem acervo o caminho 2 é PULADO por
 * inteiro; o caminho 1, que não depende dele, segue removendo.
 *
 * @returns {boolean} true se alterou alguma entrada.
 */
export function migrarMagiasCustomizadasSemprePreparadas() {
  const preparadas = Array.isArray(char?.magias_preparadas) ? char.magias_preparadas : [];
  if (preparadas.length === 0) return false;

  // SO CIRCULO 1+ e lastro, mesmo filtro da funcao irma
  // `migrarCopiasCustomizadasDoGrimorio` (abaixo). A premissa inteira desta
  // migracao -- "agora tem morada unica, derivada no render" -- vale so para
  // circulo 1+: sheet/magias.js:715 deriva
  // `magiasPersonalizadas.filter(m => m.circulo > 0)` para as preparadas, e a
  // customizada de circulo 0 vai para o bloco de TRUQUES (linha 573), que e
  // outra coisa. Remover uma preparada por lastro de circulo 0 a apagaria SEM
  // NADA no lugar. `circulo` ausente, `null` ou string nao numerica cai em 0
  // pelo saneamento e e igualmente ignorado.
  const customizadas = (Array.isArray(char?.magias_customizadas) ? char.magias_customizadas : [])
    .filter(m => (Number(m?.circulo) || 0) > 0);
  const temLastro = (nome, circulo) => customizadas.some(m =>
    m?.nome === nome && (Number(m?.circulo) || 0) === (Number(circulo) || 0));

  // Saida barata, e ela precisa cobrir TODA mutacao possivel: esta migracao
  // roda a cada abertura de ficha de todo mundo, e sair barato quando ha o que
  // fazer e perda silenciosa. `temMarca` alcanca as tres mutacoes que dependem
  // da marca -- o caminho 1 (marca + lastro, remove), a marca orfa (fica,
  // perde o carimbo) e a entrada CONCEDIDA que carrega a marca (fica, perde o
  // carimbo, ver a guarda no laco). `temCandidataCrua` alcanca o caminho 2, que
  // so existe se a ficha tiver alguma magia customizada de circulo 1+ e alguma
  // entrada sem marca E SEM `origem` (com `origem` a guarda preserva, entao ela
  // nunca e candidata e nao pode manter a funcao acordada). Sem nenhum dos
  // dois nao ha o que fazer, e nem o acervo chega a ser indexado.
  //
  // A SAIDA BARATA NAO E A GUARDA, e nao substitui a do laco: basta a ficha ter
  // outra candidata crua qualquer para ela nao disparar, a funcao seguir, e a
  // entrada concedida ser apagada pelo laco. Os oraculos de
  // `magia-customizada-sempre-preparada.test.mjs` carregam de proposito uma
  // segunda entrada removivel, para medir a guarda e nao este curto-circuito.
  const temMarca = preparadas.some(m => m?.personalizada);
  const temCandidataCrua = customizadas.length > 0
    && preparadas.some(m => !m?.personalizada && !m?.origem && temLastro(m?.nome, m?.circulo));
  if (!temMarca && !temCandidataCrua) return false;

  // Nomes do acervo por circulo, com a MESMA normalizacao `Number(...) || 0`
  // dos dois lados do lastro. So e montado quando ha candidata crua: um
  // personagem sem entrada crua nao paga a varredura do indice.
  const acervo = Array.isArray(indiceMagiasCache) ? indiceMagiasCache : [];
  const nomesDoAcervo = new Map();
  if (temCandidataCrua && acervo.length > 0) {
    for (const magia of acervo) {
      const circulo = Number(magia?.circulo) || 0;
      if (!nomesDoAcervo.has(circulo)) nomesDoAcervo.set(circulo, new Set());
      nomesDoAcervo.get(circulo).add(magia?.nome);
    }
  }

  /**
   * Caminho 2: decide se a entrada CRUA so pode ter vindo da magia
   * customizada. Devolve false em todo "nao sei" -- indice vazio/ausente ou
   * circulo que o indice nao conhece -- porque aqui o desconhecido nunca
   * pode terminar em remocao.
   */
  const ehCustomizadaInequivoca = (magia) => {
    if (nomesDoAcervo.size === 0) return false;
    if (!temLastro(magia?.nome, magia?.circulo)) return false;
    const nomesDoCirculo = nomesDoAcervo.get(Number(magia?.circulo) || 0);
    // Escrito sem `?.` de proposito: `!undefined` seria REMOVER.
    if (!nomesDoCirculo) return false;
    return !nomesDoCirculo.has(magia?.nome);
  };

  let alterado = false;
  const mantidas = [];
  for (const magia of preparadas) {
    // GUARDA DE CONCESSAO -- ANTES DOS DOIS CAMINHOS, e nao dentro de um deles.
    //
    // ENTRADA CONCEDIDA nao e candidata de caminho nenhum. Quem escreve
    // `origem` e mecanismo de CONCESSAO (dominio, sempre, especie_legado,
    // iniciado_em_magia, subclasse_escolha, tocado_por_fadas,
    // maestria_magias, assinatura_magica...), nunca o gravador do grimorio que
    // esta migracao existe para limpar -- aquele grava `{ nome, circulo,
    // classe }`, sem `origem`. Pular entrada carimbada nao perde nada do que
    // os dois caminhos procuram.
    //
    // POR QUE A GUARDA VEM ANTES DO RAMO DA MARCA, e nao dentro do ramo que
    // nao a tem: A MARCA E `origem` CONVIVEM na mesma entrada, por dois
    // mecanismos independentes.
    //   1. `_concederMagiaAutomatica` (levelup.js:1064) casa POR NOME e, achando
    //      entrada existente, so carimba `origem`/`circulo` -- a marca
    //      `personalizada` que a ficha antiga gravou sobrevive ao carimbo.
    //   2. `migrarMagiasDominio` e `migrarMagiasSemprePreparadas` (acima, neste
    //      arquivo) carimbam `origem` POR NOME SO, em entradas existentes, e
    //      rodam em pages/sheet.js DEZ LINHAS ANTES desta migracao, na mesma
    //      abertura de ficha. Nenhuma delas pula entrada com a marca.
    // Medido: Clerigo com a sua propria "Bencao" de 1o circulo em
    // `magias_customizadas` e `{nome:'Bencao', circulo:1, origem:'dominio',
    // personalizada:true}` em `magias_preparadas` -- com a guarda so no ramo do
    // caminho 2, o caminho 1 apagava a entrada, com `salvar()`, em silencio.
    //
    // O QUE SE PERDIA era a CONCESSAO, nao a magia: o rotulo, a isencao do
    // limite de preparadas e, com ela, uma vaga do orcamento. A magia
    // customizada continua desenhada (derivada de `magias_customizadas`), entao
    // o jogador nao percebe o que sumiu. E a perda e DEFINITIVA: concessao so
    // entra em level-up, e migrarMagiasDominio apenas carimba entradas
    // existentes -- nunca readiciona.
    //
    // O caminho 2 ja precisava da guarda por outro motivo, que continua valendo:
    // o desempate dele e o acervo, e levelup.js:966 grava a magia concedida com
    // `circulo: magiaIdx?.circulo || 1` -- esse `|| 1` transforma circulo 0 em
    // 1. Sete concessoes de subclasse sao truques do livro (Chama Sagrada e Luz
    // no Patrono Celestial; Fagulha Estelar no Circulo da Lua; Raio de Fogo,
    // Raio de Gelo e Toque Chocante no Circulo da Terra; Raio de Gelo no Circulo
    // do Mar) -- o acervo as tem no circulo 0 e a entrada diz 1, entao "nao
    // existe no acervo naquele circulo" e VERDADEIRO para elas.
    //
    // A MARCA, ESSA, SAI: `sheet/grimorio.js` (`entradaEhDoCartao`) documenta
    // como invariante que nenhuma entrada de `magias_preparadas` carrega mais
    // `personalizada`, e se apoia nisso. Apagar a marca aqui nao mexe em
    // orcamento nenhum: TODA origem que hoje chega a `magias_preparadas` esta em
    // ORIGENS_MAGIA_ISENTA (regras-origens-magia.js), entao a entrada segue
    // isenta do limite pela `origem`, sem depender da marca.
    //
    // CONTRAPARTIDA aceita: migrarMagiasDominio/migrarMagiasSemprePreparadas
    // carimbam por nome so. Uma entrada legitimamente customizada cujo nome
    // esteja na tabela de dominio sai carimbada e passa a ser preservada aqui.
    // Isso e limpeza perdida, nao dado perdido -- o lado certo do trade "na
    // duvida, preserva".
    if (magia?.origem) {
      if (magia.personalizada) {
        delete magia.personalizada;
        alterado = true;
      }
      mantidas.push(magia);
      continue;
    }
    if (!magia?.personalizada) {
      if (ehCustomizadaInequivoca(magia)) {
        // Gravada por um gravador que nao marcava: hoje e derivada de
        // magias_customizadas, e a entrada crua some.
        alterado = true;
        continue;
      }
      // Preservar NAO e carimbar: a marca que nao estava la nao e inventada.
      mantidas.push(magia);
      continue;
    }
    if (temLastro(magia.nome, magia.circulo)) {
      // Virou derivada de magias_customizadas: a entrada gravada some.
      alterado = true;
      continue;
    }
    // Marca orfa: a entrada fica, sem a marca.
    delete magia.personalizada;
    alterado = true;
    mantidas.push(magia);
  }

  if (!alterado) return false;
  char.magias_preparadas = mantidas;
  salvar();
  return true;
}

/**
 * Issue #46: remove do grimório do Mago a cópia paga de uma magia
 * customizada (issue #42).
 *
 * Com a customizada sempre preparada, a cópia não compra mais nada -- e
 * desenha uma segunda linha da mesma magia na seção Grimório, com
 * Preparar/Despreparar que a regra nova torna sem efeito.
 *
 * A RESSALVA DA HOMÔNIMA é o coração desta migração. O grimório grava
 * `{ nome, circulo }` cru (sheet/grimorio.js), SEM marca que separe a cópia
 * da customizada de uma magia do acervo. Remover por nome+círculo apagaria,
 * num Mago que criou a SUA "Bênção" e comprou a "Bênção" do livro, a cópia
 * legítima que ele pagou 50 PO por círculo para ter. Por isso só sai a
 * entrada cujo nome NÃO existe no acervo naquele círculo -- a única em que a
 * origem é inequívoca. Havendo homônima, a linha fica: ela renderiza como
 * magia do livro, que é estado coerente, e o "×" da própria linha deixa o
 * jogador removê-la à mão.
 *
 * O ACERVO VEM DE `indiceMagiasCache`, NÃO DE UM FETCH (achado Critical 1 da
 * revisão -- é também o motivo de esta função ser síncrona, ao contrário da
 * primeira versão). Consultar `getMagiasPorCirculo` passava por `fetchJSON`
 * (../db.js), que engole num único `catch` a rejeição de rede, o 404 e o JSON
 * malformado e devolve `null` -- deixando a FALHA DE CARGA indistinguível de
 * "o acervo não tem essa magia". Com a rede caída o conjunto de nomes vinha
 * vazio, "não existe no acervo" passava a valer para tudo, e a ressalva que
 * existe para proteger virava remoção geral: o Mago perdia o grimório
 * inteiro, e o `salvar()` abaixo enfileirava a versão mutilada para
 * sobrescrever a cópia boa na nuvem assim que a conexão voltasse. Lendo o
 * cache que sheet.js já populou (`definirIndiceMagias`) antes das migrações,
 * o "não sei" fica DETECTÁVEL -- índice vazio é distinguível de "esse círculo
 * não tem essa magia" -- e o I/O some de uma função que roda em TODA abertura
 * de ficha.
 *
 * Sem devolução de PO, nos dois casos (decisão do dono do produto).
 *
 * @returns {boolean} true se removeu alguma entrada.
 */
export function migrarCopiasCustomizadasDoGrimorio() {
  const grimorio = Array.isArray(char?.grimorio) ? char.grimorio : [];
  if (grimorio.length === 0) return false;

  const customizadas = (Array.isArray(char?.magias_customizadas) ? char.magias_customizadas : [])
    .filter(m => (Number(m?.circulo) || 0) > 0);
  if (customizadas.length === 0) return false;

  // NA DUVIDA, PRESERVA. Indice vazio ou ausente nao significa "o acervo nao
  // tem nenhuma dessas magias", significa "nao sei o que o acervo tem" -- e
  // numa funcao que destroi dado pago em PO nenhum caminho desconhecido pode
  // terminar em remocao.
  const acervo = Array.isArray(indiceMagiasCache) ? indiceMagiasCache : [];
  if (acervo.length === 0) return false;

  // Candidatas: entradas do grimorio que casam nome E circulo com uma
  // customizada.
  const casaCustomizada = (entrada) => customizadas.some(m =>
    m?.nome === entrada?.nome
    && (Number(m?.circulo) || 0) === (Number(entrada?.circulo) || 0));

  // Nomes do acervo agrupados por circulo, com a MESMA normalizacao
  // `Number(...) || 0` usada nos dois lados do casamento acima.
  const nomesDoAcervo = new Map();
  for (const magia of acervo) {
    const circulo = Number(magia?.circulo) || 0;
    if (!nomesDoAcervo.has(circulo)) nomesDoAcervo.set(circulo, new Set());
    nomesDoAcervo.get(circulo).add(magia?.nome);
  }

  /** Decide se a entrada do grimorio so pode ter vindo da magia customizada. */
  const ehCopiaInequivoca = (entrada) => {
    if (!casaCustomizada(entrada)) return false;
    const nomesDoCirculo = nomesDoAcervo.get(Number(entrada?.circulo) || 0);
    // Circulo que o indice nao conhece: mesmo "nao sei" da guarda acima,
    // escrito sem `?.` de proposito -- `!undefined` seria REMOVER.
    if (!nomesDoCirculo) return false;
    return !nomesDoCirculo.has(entrada?.nome);
  };

  const mantidas = grimorio.filter(m => !ehCopiaInequivoca(m));
  if (mantidas.length === grimorio.length) return false;
  char.grimorio = mantidas;
  salvar();
  return true;
}
