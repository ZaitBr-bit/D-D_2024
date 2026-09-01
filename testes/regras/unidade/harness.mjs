// ============================================================
// Harness dos testes de unidade: stubs de globais de navegador,
// import dos módulos do app direto do disco e a mecânica de
// lacunas conhecidas.
// ============================================================
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
import { lacuna } from '../lacunas-conhecidas.mjs';
import { TRACOS_BASICOS } from '../catalogo/classes.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
export const RAIZ = resolve(AQUI, '..', '..', '..');

// Instala os globais de navegador que os módulos do app tocam ao serem
// importados. utils.js:639 faz `window.fecharModal = ...` no top-level,
// e é importado por regras-cobertura.js, talentos-effects.js e store.js —
// sem `window` o import lança ReferenceError. `document` acompanha porque
// utils.js manipula DOM em toasts/modais. Se um módulo passar a exigir
// outra global, acrescente o stub AQUI (e só aqui).
function instalarStubs() {
  if (globalThis.localStorage) return;
  const mapa = new Map();
  globalThis.localStorage = {
    getItem: (c) => (mapa.has(c) ? mapa.get(c) : null),
    setItem: (c, v) => mapa.set(c, String(v)),
    removeItem: (c) => mapa.delete(c),
    clear: () => mapa.clear(),
  };
  globalThis.window = globalThis;
  globalThis.document = {
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: () => ({
      style: {}, classList: { add() {}, remove() {} },
      appendChild() {}, setAttribute() {},
    }),
    body: { appendChild() {} },
  };
  // site/js/db.js:15 carrega dados/ por `fetch('../dados/...')`. Em Node o
  // fetch global existe, mas rejeita caminho relativo -- sem este stub,
  // getClasse() devolve null e todo motor que dirige subirDeNivel() passaria
  // testando um personagem que nunca sobe. Resolve o caminho relativo contra
  // o disco e devolve o mínimo da interface Response que db.js consome.
  //
  // Achado M3 da revisão final: `db.js:15` chama
  // `fetch(caminho, { cache: 'no-store' })` -- este stub recebe só `url`
  // (segundo argumento, `{ cache: 'no-store' }`, descartado de propósito).
  // Isso é seguro porque `db.js` não lê a Response de nenhuma forma que
  // dependa da opção de cache -- ele só chama `.ok`, `.status` e `.json()`
  // no objeto que este stub devolve, os três já cobertos abaixo; a opção
  // `cache` existe só para o `fetch` real de navegador (evitar servir uma
  // versão em cache do JSON durante o desenvolvimento), sem efeito
  // observável em Node, onde não há cache HTTP de navegador para
  // desativar.
  globalThis.fetch = async (url) => {
    const relativo = String(url).replace(/^\.\.\//, '');
    const caminho = resolve(RAIZ, relativo);
    const texto = readFileSync(caminho, 'utf-8');
    return { ok: true, status: 200, json: async () => JSON.parse(texto) };
  };
}

let _cache = null;

// Importa (uma vez) os módulos do app usados pelos motores de teste.
// levelup.js (obterAtributosASITalento) e creator/comum.js
// (talentoExigeEscolhas) entram aqui -- achado M9: eram importados por
// caminho relativo direto em escolhas.test.mjs, funcionando só porque uma
// linha anterior já tinha chamado modulosApp() (e portanto instalarStubs())
// antes. "AQUI (e só aqui)" vale para todo import de módulo do app usado
// pelos motores, não só para os stubs.
export async function modulosApp() {
  if (_cache) return _cache;
  instalarStubs();
  const importar = (rel) => import(pathToFileURL(resolve(RAIZ, rel)).href);
  // levelupFlow/sheetEstado/sheetMagias entram aqui para o motor das
  // subclasses conjuradoras (Cavaleiro Místico e Trapaceiro Arcano): o
  // contexto de subida de nível (levelup-flow.js) recebe da ficha as
  // funções que leem as tabelas dessas subclasses, e reescrevê-las no teste
  // não confrontaria nada -- são as MESMAS funções que sheet/edicao.js
  // injeta, apontadas para o personagem do teste via
  // sheetEstado.definirChar().
  const [regras, efeitos, store, levelup, criador, utils, dadosClasses, db, equip,
         levelupFlow, sheetEstado, sheetMagias, sheetMigracoes, sheetGrimorio,
         sheetMago, notasVersao, versao,
         levelupCards, regrasSubclasseEscolhas, regrasOrigensMagia,
         regrasConjuracaoSubclasse, regrasSalvaguardas, fichaEdicoes, fichaEdicaoValidacoes,
         multiclasse, home, multiclasseConjuracao, multiclasseProgressao, contextoClasse,
         sheetCaracteristicas, sheetFicha, proficiencias, magiaClasse, regrasPreparoMagias,
         // As 11 classes restantes (Mago ja entra acima, como sheetMago, para o
         // motor de subclasses conjuradoras) -- reunidas em sheetClasses logo
         // abaixo, uma entrada por classe, para os oraculos de multiclasse-render
         // (Tarefa 1) chamarem sheetClasses.clerigo.getProgressaoClerigo() etc.
         // sem um import por classe em cada arquivo de teste.
         classeBarbaro, classeBardo, classeBruxo, classeClerigo, classeDruida,
         classeFeiticeiro, classeGuardiao, classeGuerreiro, classeLadino,
         classeMonge, classePaladino,
         // Tarefa 3 do sub-projeto 3b: renderFeatureItem, registrado sob a
         // chave `sheetHabilidades` para os oraculos 9-13 de
         // multiclasse-render.test.mjs chamarem
         // sheetHabilidades.renderFeatureItem(f, source, ctx).
         sheetHabilidades,
         // Tarefa 5 do sub-projeto 3d: o TETO UNICO de maestrias
         // (sheetMaestrias.tetoMaestrias / classesComMaestria) e o gate do
         // Descanso Longo que o consome (sheetHpDescanso.setupEventosDescanso).
         sheetMaestrias, sheetHpDescanso] = await Promise.all([
    importar('site/js/regras-cobertura.js'),
    importar('site/js/talentos-effects.js'),
    importar('site/js/store.js'),
    importar('site/js/levelup.js'),
    importar('site/js/creator/comum.js'),
    importar('site/js/utils.js'),
    importar('site/js/dados-classes.js'),
    importar('site/js/db.js'),
    importar('site/js/regras-equipamento.js'),
    importar('site/js/levelup-flow.js'),
    importar('site/js/sheet/estado.js'),
    importar('site/js/sheet/magias.js'),
    importar('site/js/sheet/migracoes.js'),
    importar('site/js/sheet/grimorio.js'),
    importar('site/js/sheet/classes/mago.js'),
    importar('site/js/notas-versao.js'),
    importar('site/js/versao.js'),
    importar('site/js/levelup-cards.js'),
    importar('site/js/regras-subclasse-escolhas.js'),
    importar('site/js/regras-origens-magia.js'),
    importar('site/js/regras-conjuracao-subclasse.js'),
    importar('site/js/regras-salvaguardas.js'),
    importar('site/js/ficha-edicoes.js'),
    importar('site/js/ficha-edicao-validacoes.js'),
    importar('site/js/regras-multiclasse.js'),
    importar('site/js/pages/home.js'),
    importar('site/js/regras-multiclasse-conjuracao.js'),
    importar('site/js/regras-multiclasse-progressao.js'),
    importar('site/js/sheet/contexto-classe.js'),
    // Rodada 1 de correcao da Tarefa 2: o oraculo 6 original testava so
    // montarContextos + um filtro reimplementado dentro do proprio teste,
    // nunca o RENDER de verdade -- nao pegava, por exemplo, `ctx.subclasse`
    // trocado por `char.subclasse` dentro de caracteristicas.js. Este
    // import permite chamar renderSecaoCaracteristicas()/
    // renderSecaoSubclasse() de verdade, via sheetEstado.definirChar() e
    // sheetEstado.definirClassesData().
    importar('site/js/sheet/caracteristicas.js'),
    // Correcao final do sub-projeto 3a: renderFichaCompleta() de verdade, para
    // medir o PONTO DE CHAMADA do conserto (ficha.js chamando
    // migrarMulticlasse() a cada render), nao so a funcao de reconciliacao
    // isolada -- ver multiclasse-contexto.test.mjs, oraculo final.
    importar('site/js/sheet/ficha.js'),
    // Tarefa 1 do subprojeto de proficiencias por classe nova: modulo puro
    // que junta armadura/arma/pericia/ferramenta/instrumento por classe,
    // lendo `classes[]` em vez do espelho `char.classe`. Consumido pelos
    // oraculos de multiclasse-proficiencias.test.mjs via
    // `proficiencias.concessoesDaClasse` etc.
    importar('site/js/regras-multiclasse-proficiencias.js'),
    // Tarefa 1 do sub-projeto 2026-08-29-magia-sabe-a-classe: a peca pura
    // "de que classe e esta magia preparada?", consumida pelos oraculos de
    // magia-classe.test.mjs via magiaClasse.classeDaMagiaPreparada() e
    // magiaClasse.nomesDaListaDeMagias().
    importar('site/js/regras-magia-classe.js'),
    // Tarefa 1 do sub-projeto 2026-08-29-troca-por-classe-descanso: a peca
    // pura "quais trocas de magia/truque este personagem tem direito no
    // Descanso Longo?", consumida pelos oraculos de
    // troca-descanso-por-classe.test.mjs via
    // regrasPreparoMagias.trocasDoDescansoLongo(personagem, superficies).
    importar('site/js/regras-preparo-magias.js'),
    importar('site/js/sheet/classes/barbaro.js'),
    importar('site/js/sheet/classes/bardo.js'),
    importar('site/js/sheet/classes/bruxo.js'),
    importar('site/js/sheet/classes/clerigo.js'),
    importar('site/js/sheet/classes/druida.js'),
    importar('site/js/sheet/classes/feiticeiro.js'),
    importar('site/js/sheet/classes/guardiao.js'),
    importar('site/js/sheet/classes/guerreiro.js'),
    importar('site/js/sheet/classes/ladino.js'),
    importar('site/js/sheet/classes/monge.js'),
    importar('site/js/sheet/classes/paladino.js'),
    importar('site/js/sheet/habilidades.js'),
    importar('site/js/sheet/maestrias.js'),
    importar('site/js/sheet/hp-descanso.js'),
  ]);
  // Um modulo de classe por nome de ARQUIVO (minusculo, sem acento -- ex.:
  // sheetClasses.clerigo, sheetClasses.paladino), e nao pelo nome que o app
  // usa em `char.classe` ('Clérigo', 'Paladino'). Consumido pelos oraculos de
  // multiclasse-render.test.mjs via sheetClasses.<classe>.
  const sheetClasses = {
    barbaro: classeBarbaro, bardo: classeBardo, bruxo: classeBruxo,
    clerigo: classeClerigo, druida: classeDruida, feiticeiro: classeFeiticeiro,
    guardiao: classeGuardiao, guerreiro: classeGuerreiro, ladino: classeLadino,
    mago: sheetMago, monge: classeMonge, paladino: classePaladino,
  };
  _cache = { regras, efeitos, store, levelup, criador, utils, dadosClasses, db, equip,
             levelupFlow, sheetEstado, sheetMagias, sheetMigracoes, sheetGrimorio,
             sheetMago, notasVersao, versao, levelupCards, regrasSubclasseEscolhas,
             regrasOrigensMagia, regrasConjuracaoSubclasse, regrasSalvaguardas,
             fichaEdicoes, fichaEdicaoValidacoes, multiclasse, home, multiclasseConjuracao,
             multiclasseProgressao, contextoClasse, sheetCaracteristicas, sheetFicha,
             proficiencias, magiaClasse, regrasPreparoMagias, sheetClasses, sheetHabilidades,
             sheetMaestrias, sheetHpDescanso };
  return _cache;
}

// Achata dados/talentos/talentos.json em uma lista de 75 talentos.
export function lerTalentosDados() {
  const d = JSON.parse(readFileSync(resolve(RAIZ, 'dados/talentos/talentos.json'), 'utf-8'));
  const lista = [];
  for (const grupo of Object.values(d.por_categoria)) lista.push(...grupo);
  return lista;
}

// Títulos `### Nome` de Talentos.md — para conferir as citações do catálogo.
export function lerTitulosLivro() {
  const md = readFileSync(
    resolve(RAIZ, 'Informacoes Separadas', 'Talentos.md'), 'utf-8');
  return new Set([...md.matchAll(/^###\s+(.+?)\s*$/gm)].map((m) => m[1]));
}

// Lê qualquer arquivo de `Informacoes Separadas/` como texto bruto -- usado
// por motores que citam mais de um arquivo do livro (ex.:
// ficha-transversal.test.mjs, cujas CITACOES apontam para "Criação de
// Personagens.md", "Abreviações e Definição de Regras.md" e "Magias.md"),
// onde uma função só-um-arquivo como lerTitulosLivro/lerHeadingsAntecedente
// não serve.
export function lerConteudoLivro(nomeArquivo) {
  return readFileSync(resolve(RAIZ, 'Informacoes Separadas', nomeArquivo), 'utf-8');
}

// Achata dados/origens/antecedentes.json na lista de 16 antecedentes que o
// app realmente consome em runtime -- é este arquivo, não o livro, que o
// motor de unidade de antecedentes confronta contra o catálogo curado.
export function lerAntecedentesDados() {
  const d = JSON.parse(readFileSync(resolve(RAIZ, 'dados/origens/antecedentes.json'), 'utf-8'));
  return d.antecedentes;
}

// Títulos `## Nome` de Antecedente.md -- para conferir as citações do
// catálogo de antecedentes. Nível de heading diferente de Talentos.md
// (`###`) porque Antecedente.md usa `##` para cada seção de antecedente
// (e também para "Antecedentes de Personagens"/"Espécies de Personagem",
// que não são antecedentes -- o teste de citação só confere que toda
// citação do catálogo aponta para um heading real, não que todo heading é
// um antecedente).
export function lerHeadingsAntecedente() {
  const md = readFileSync(
    resolve(RAIZ, 'Informacoes Separadas', 'Antecedente.md'), 'utf-8');
  return new Set([...md.matchAll(/^##\s+(.+?)\s*$/gm)].map((m) => m[1]));
}

// As 12 classes de dados/classes/, indexadas pelo nome que o app usa
// ('Bárbaro', não 'barbaro'). O diretório também tem 8 arquivos
// `magias_<classe>.json`, que são listas de magias e NÃO classes -- por isso
// a lista de arquivos é explícita em vez de um readdir filtrado: um arquivo
// novo no diretório não deve entrar aqui em silêncio.
const ARQUIVOS_CLASSE = {
  'Bárbaro': 'barbaro.json', 'Bardo': 'bardo.json', 'Bruxo': 'bruxo.json',
  'Clérigo': 'clerigo.json', 'Druida': 'druida.json', 'Feiticeiro': 'feiticeiro.json',
  'Guardião': 'guardiao.json', 'Guerreiro': 'guerreiro.json', 'Ladino': 'ladino.json',
  'Mago': 'mago.json', 'Monge': 'monge.json', 'Paladino': 'paladino.json',
};

// Lê os JSONs de dados/classes/ e devolve um mapa nome-da-classe -> objeto
// completo, para os motores confrontarem contra as tabelas do livro.
export function lerClassesDados() {
  const mapa = new Map();
  for (const [nome, arquivo] of Object.entries(ARQUIVOS_CLASSE)) {
    mapa.set(nome, JSON.parse(
      readFileSync(resolve(RAIZ, 'dados/classes', arquivo), 'utf-8')));
  }
  return mapa;
}

// Títulos de Classes.md -- para conferir as citações do catálogo de classes.
// Diferente de Talentos.md (só `###`) e Antecedente.md (só `##`), este
// arquivo mistura os três níveis para o mesmo tipo de seção: a tabela do
// Bárbaro é `## Características de Classe de Bárbaro` (linha 38) e a do Bardo
// é `### Características de Classe de Bardo` (linha 369); as subclasses são
// `# Subclasses de Bárbaro` (185) mas `## Subclasses de Druida` (2333). Um
// regex de um nível só produziria falhas que pareceriam catálogo errado.
export function lerHeadingsClasses() {
  const md = readFileSync(
    resolve(RAIZ, 'Informacoes Separadas', 'Classes.md'), 'utf-8');
  return new Set([...md.matchAll(/^#{1,3}\s+(.+?)\s*$/gm)].map((m) => m[1]));
}

// Personagem mínimo dos testes de validação/passivos. Nível 4 (bônus
// de proficiência +2) e duas perícias proficientes, porque algumas
// validações exigem proficiência prévia (Dádiva da Proficiência em Perícia).
export async function charBase() {
  const { store } = await modulosApp();
  const p = store.criarPersonagemVazio();
  p.nivel = 4;
  p.pericias_proficientes = ['Atletismo', 'História'];
  return p;
}

// Mecânica de lacunas: sem lacuna registrada, roda o confronto
// normalmente; com lacuna, exige que ele FALHE — se passar, o app foi
// corrigido e a entrada precisa sair da lista.
export async function comLacuna(talento, teste, fn) {
  const pendente = lacuna(talento, teste);
  if (!pendente) return fn();
  try {
    await fn();
  } catch {
    return; // falha esperada, documentada em lacunas-conhecidas.mjs
  }
  throw new Error(
    `Lacuna corrigida: remova { talento: '${talento}', teste: '${teste}' } de lacunas-conhecidas.mjs`);
}

// ============================================================
// Driver `escadaDeNivel()`: sobe um personagem de verdade, nível a
// nível, chamando subirDeNivel() (site/js/levelup.js) e resolvendo cada
// pendência com uma escolha canônica -- ver
// .superpowers/sdd/2026-08-07-regras-classes-niveis/task-7-brief.md.
// ============================================================

// Os 15 valores de `tipo_pendencia` que subirDeNivel (site/js/levelup.js,
// linhas 948-1187) pode devolver. A lista é explícita, e o driver abaixo
// LANÇA ao ver um tipo fora dela: se o app ganhar uma pendência nova, o
// motor comportamental precisa parar e alguém precisa decidir a escolha
// canônica -- um `default` mudo faria o personagem parar de subir e os
// testes continuarem verdes sobre um nível que nunca foi alcançado.
export const PENDENCIAS_CONHECIDAS = [
  'subclasse', 'dadiva_epica', 'aumento_atributo', 'talento_asi',
  'dadiva_proficiencia_pericia', 'dadiva_resistencia_energia',
  'escolhas_talento', 'bardo_expertise', 'guardiao_expertise',
  'estilo_luta', 'explorador_habil', 'manobras_guerreiro', 'grimorio',
  'subclasse_magias_arcana', 'academico',
  // Os 12 tipos que regras-subclasse-escolhas.js criou (Plano 4). Escritos
  // por extenso de proposito: a tabela nao pode ser importada no topo deste
  // arquivo (ela puxa utils.js, que toca `window` antes de instalarStubs()
  // rodar). A coerencia entre as duas listas e cobrada por
  // `pendencias-subclasse-coerencia.test.mjs`, que roda DEPOIS do shim.
  'subclasse_pericias_bonus', 'subclasse_descobertas_magicas',
  'subclasse_estudioso_ferramenta', 'subclasse_estudioso_pericia',
  'subclasse_glamour_pericia', 'subclasse_estilo_luta_extra',
  'subclasse_terreno', 'subclasse_aspecto_selvagem',
  'subclasse_afinidade_elemental', 'subclasse_presa_cacador',
  'subclasse_taticas_defensivas', 'subclasse_companheiro_primal',
  // O 13o: o ramo SUBSTITUTO das Ilusoes Aprimoradas (Classes.md:5074),
  // que so aparece para o Ilusionista que ja conhece Ilusao Menor. Nenhuma
  // escada da suite semeia esse truque, entao ele nunca dispara aqui -- mas
  // uma escada nova que semeie (um Gnomo do Bosque, por exemplo) precisa
  // encontrar o driver preparado, e nao um erro de "pendencia desconhecida".
  'subclasse_truque_substituto',
];

// Personagem-semente de cada classe. Diferente de charBase() (fixture
// genérica dos motores de talentos), aqui a fixture precisa satisfazer os
// pré-requisitos do LIVRO da classe sob teste -- erro 5 do
// GUIA-PROXIMOS-DOMINIOS.md: atributos 10 fazem escolhas sumirem da tela
// e o teste passa verde sem testar nada. Atributo primário alto e quatro
// perícias proficientes -- conferido contra o app (achado de revisão):
// só 'academico' (levelup.js:1231-1233) exige proficiência prévia na
// perícia escolhida; 'bardo_expertise'/'guardiao_expertise'/
// 'explorador_habil' conferem apenas ARIDADE (quantas perícias vieram),
// não se são proficientes. As quatro perícias aqui bastam para os dois
// casos -- dão o prerequisito exigido por 'academico' e também alimentam
// proximasPericias() (mais abaixo) com candidatas suficientes para as
// pendências de Especialização repetidas (Bardo nv2+9, Guardião nv2+9).
export async function personagemSemente(classe) {
  const { store } = await modulosApp();
  const p = store.criarPersonagemVazio();
  p.classe = classe;
  p.nivel = 1;
  p.atributos = {
    forca: 15, destreza: 15, constituicao: 14,
    inteligencia: 15, sabedoria: 15, carisma: 15,
  };
  p.atributos_base = { ...p.atributos };
  p.pericias_proficientes = ['Atletismo', 'Percepção', 'Arcanismo', 'História'];
  // PV de nível 1 = dado de vida cheio + mod. CON (+2 com Constituição 14),
  // e o dado de vida vem do CATÁLOGO (o livro), não de CLASSES_INFO. Se
  // CLASSES_INFO divergir do livro -- exatamente o que o motor estrutural
  // procura --, semear a fixture com ele faria o motor comportamental
  // falhar no PV de toda a escada, escondendo a causa real atrás de 19
  // níveis de erro acumulado.
  p.pv_max = TRACOS_BASICOS[classe].dadoVida + 2;
  p.pv_atual = p.pv_max;
  return p;
}

/**
 * Monta um personagem multiclasse direto, sem passar por subirDeNivel.
 * É o que permite testar ficha e magias (sub-projetos 3 e 4) antes de o
 * fluxo de subida de nível saber multiclassar (sub-projeto 5).
 *
 * Os atributos são 15 em tudo, de propósito: satisfazem o pré-requisito
 * de 13+ de qualquer combinação de classes, então nenhum teste falha por
 * um pré-requisito que ele não estava tentando medir.
 *
 * O dado de vida vem do CATÁLOGO (o livro), não de CLASSES_INFO -- mesma
 * razão de personagemSemente: semear com CLASSES_INFO esconderia
 * justamente a divergência que os motores procuram.
 *
 * @param {Array<{classe: string, nivel: number, subclasse?: string}>} roteiro
 * @returns {Promise<object>} personagem pronto, com espelhos sincronizados.
 */
export async function personagemMulticlasse(roteiro) {
  const { store, multiclasse } = await modulosApp();
  const p = store.criarPersonagemVazio();
  p.atributos = {
    forca: 15, destreza: 15, constituicao: 14,
    inteligencia: 15, sabedoria: 15, carisma: 15,
  };
  p.atributos_base = { ...p.atributos };
  p.classes = roteiro.map((r, i) => ({
    classe: r.classe,
    subclasse: r.subclasse || '',
    nivel: r.nivel,
    ordem: i,
  }));
  p.schema_versao = multiclasse.SCHEMA_VERSAO_ATUAL;
  multiclasse.sincronizarEspelhos(p);

  // PV: dado cheio APENAS no 1º nível total, que pertence à classe
  // inicial (livro:2041); todos os demais níveis usam a média, inclusive
  // o primeiro nível de cada classe adicional.
  const modCon = 2;
  const inicial = roteiro[0];
  let pv = TRACOS_BASICOS[inicial.classe].dadoVida + modCon;
  for (const r of roteiro) {
    const faces = TRACOS_BASICOS[r.classe].dadoVida;
    const media = Math.floor(faces / 2) + 1;
    const niveisNaMedia = r === inicial ? r.nivel - 1 : r.nivel;
    pv += niveisNaMedia * (media + modCon);
  }
  p.pv_max = pv;
  p.pv_atual = pv;
  return p;
}

// Manobras novas do Mestre da Batalha. subirDeNivel (levelup.js:1136) só
// confere a QUANTIDADE (`novasManobras.length !== qtdNova`), não os nomes
// -- ainda assim a escada escolhe nomes reais de
// subclasses[].opcoes_manobra, para não gravar lixo no personagem que as
// asserções depois leem.
//
// IMPORTANT (achado de revisão): a dedup ORIGINAL comparava os objetos de
// `opcoes_manobra` por IDENTIDADE (`.includes(m)`), o que só funciona
// porque `classeData` é buscado uma única vez por chamada de
// escadaDeNivel -- os mesmos objetos permanecem em memória do nível 3 ao
// 15. Se o personagem fosse serializado entre níveis (o app real faz
// isso), a comparação por referência quebraria e `disponiveis` voltaria a
// conter TODAS as manobras a cada nível, sempre as N primeiras -- o
// Guerreiro terminaria com 3 manobras em vez de 9 sem `subirDeNivel`
// nunca lançar (a validação do app só confere QUANTIDADE, não quais).
// Comparar por `.nome` -- um valor primitivo que sobrevive a
// serialização -- é o que torna a dedup real.
function escolherManobras(p, classeData, quantidade) {
  const mestre = (classeData.subclasses || [])
    .find((sc) => sc.nome === 'Mestre da Batalha');
  const nomesConhecidos = new Set(
    (p.manobras_conhecidas || []).map((m) => (typeof m === 'string' ? m : m?.nome)));
  const disponiveis = (mestre?.opcoes_manobra || [])
    .filter((m) => !nomesConhecidos.has(m.nome));
  if (disponiveis.length < quantidade) {
    throw new Error(`manobras insuficientes em dados/: precisa de ` +
      `${quantidade}, restam ${disponiveis.length}`);
  }
  return disponiveis.slice(0, quantidade);
}

// Magias de Mago para o grimório (pendência 'grimorio') ou para a dádiva de
// escola da subclasse arcana (pendência 'subclasse_magias_arcana').
// subirDeNivel (levelup.js:1157-1168 e 1186-1222) exige uma quantidade
// EXATA de magias distintas, presentes em dados/magias/_indice.json com
// 'Mago' em `classes`, de círculo > 0 para o qual o personagem terá espaço
// no novo nível, e ainda ausentes do grimório -- reproduzir esses filtros
// aqui é o que impede a escada de travar num nível qualquer com uma
// mensagem genérica.
//
// ACHADO: a validação de 'subclasse_magias_arcana' (levelup.js:1202) exige
// ADICIONALMENTE que `magia.escola === escolaSubclasseArcana` -- sem
// filtrar por escola aqui, a escada travava no Mago nível 3 com a mesma
// pendência reaparecendo (as magias escolhidas por escolherMagiasMago sem
// filtro de escola nunca batiam com "Abjuração", "Evocação" etc., e o app
// devolvia 'subclasse_magias_arcana' de novo -- ver task-7-report.md).
// `excluirNomes` evita colidir com o que a pendência 'grimorio' já
// selecionou no MESMO nível: as duas concorrem pela mesma checagem "ainda
// ausente do grimório" dentro de uma única chamada de subirDeNivel.
async function escolherMagiasMago(p, classeData, novoNivel, quantidade,
                                  { escola = null, excluirNomes = [] } = {}) {
  const { utils } = await modulosApp();
  const indice = JSON.parse(readFileSync(
    resolve(RAIZ, 'dados/magias/_indice.json'), 'utf-8'));
  const espacos = utils.getEspacosMagia(classeData.tabela_caracteristicas, novoNivel);
  const jaNoGrimorio = new Set([
    ...(p.grimorio || []).map((m) => m?.nome),
    ...excluirNomes,
  ]);
  const candidatas = (indice?.magias || []).filter((m) =>
    Array.isArray(m.classes) && m.classes.includes('Mago') &&
    m.circulo > 0 && (espacos[m.circulo]?.total || 0) > 0 &&
    !jaNoGrimorio.has(m.nome) &&
    (!escola || m.escola === escola));
  if (candidatas.length < quantidade) {
    throw new Error(`magias de Mago${escola ? ` (escola ${escola})` : ''} ` +
      `insuficientes no nível ${novoNivel}: precisa de ${quantidade}, ` +
      `restam ${candidatas.length} candidatas`);
  }
  return candidatas.slice(0, quantidade).map((m) => m.nome);
}

// Perícias para uma Especialização (bardo_expertise, guardiao_expertise,
// explorador_habil). Essas três pendências disparam MAIS DE UMA VEZ na
// escada em subida (Bardo: nível 2 e 9; Guardião: nível 2 -- explorador_habil
// -- e nível 9 -- guardiao_expertise), e a validação do app só confere
// ARIDADE (`selecionadas.length !== N`, levelup.js:1059/1071), não QUAIS
// perícias -- repetir a mesma perícia na segunda chamada não lança erro
// nenhum, só grava um no-op silencioso (a gravação deduplica,
// levelup.js:1495-1515). Escolher perícias ainda sem Especialização
// (preferindo as proficientes, regra real do livro) é o que torna cada
// chamada uma escolha que concede algo de verdade.
function proximasPericias(p, quantidade, dadosClasses) {
  const jaTem = new Set(p.pericias_expertise || []);
  const proficientesLivres = (p.pericias_proficientes || []).filter((per) => !jaTem.has(per));
  const todasLivres = dadosClasses.PERICIAS.map((per) => per.nome).filter((per) => !jaTem.has(per));
  const candidatas = [...new Set([...proficientesLivres, ...todasLivres])];
  if (candidatas.length < quantidade) {
    throw new Error(`perícias insuficientes para Especialização: precisa de ` +
      `${quantidade}, restam ${candidatas.length} sem Especialização`);
  }
  return candidatas.slice(0, quantidade);
}

// Escolha canônica de cada pendência. Nenhum `default` mudo: um tipo sem
// ramo cai no `throw` final, e escadaDeNivel já barrou os desconhecidos
// antes de chegar aqui.
//
// ACHADO (formato descoberto lendo levelup.js, não suposto -- o brief da
// tarefa sugeria `opcoes.talento = 'Dádiva do Aumento no Valor de
// Atributo'` para 'dadiva_epica', mas esse talento NÃO existe em
// dados/talentos/talentos.json; os únicos "Dádiva do X" são Ataque
// Irresistível, Destino e Espírito da Noite. No nível 19 concedeAumentoAtributo
// também é true para as 12 classes (a tabela inclui 19), então
// requerDadivaEpica e ganhaAumentoAtributo disparam juntos -- a escolha
// canônica que funciona é reaproveitar o talento genérico 'Aumento no
// Valor de Atributo' (Repetível, sem pré-requisito de nível acima de 4)
// tanto para 'dadiva_epica' quanto para 'aumento_atributo'/'talento_asi'.
// Definir só `opcoes.talento` aqui é suficiente para silenciar
// 'dadiva_epica'; o app então reavalia o ganho de atributo e devolve
// 'talento_asi' pedindo a distribuição, que o ramo abaixo já resolve.
async function resolverPendencia(tipo, opcoes, p, classeData, ATRIBUTOS,
                                 levelup, subclasseAlvo, nivel) {
  const primeiroAtributoAbaixoDe20 = () =>
    ATRIBUTOS.find((a) => (p.atributos[a] ?? 10) <= 18) || 'constituicao';

  switch (tipo) {
    case 'subclasse':
      opcoes.subclasse = subclasseAlvo;
      return;
    case 'aumento_atributo':
    case 'talento_asi':
      opcoes.talento = 'Aumento no Valor de Atributo';
      opcoes.aumentos_atributo = { [primeiroAtributoAbaixoDe20()]: 2 };
      return;
    case 'dadiva_epica':
      // Ver ACHADO acima: reaproveita o talento genérico de ASI. Não
      // define `aumentos_atributo` aqui de propósito -- a validação do
      // app só cobra a distribuição na pendência seguinte ('talento_asi'),
      // que já tem ramo próprio.
      // AVISO PARA A TASK 8: esta escolha canônica satisfaz a pendência
      // 'dadiva_epica' com o talento genérico de ASI, não com uma Dádiva
      // Épica de verdade (nenhum "Dádiva do/da X" é escolhido). Nenhum
      // personagem produzido por escadaDeNivel() recebe uma Dádiva Épica
      // real -- um motor que precise afirmar "nível 19 concede Dádiva
      // Épica" não pode se apoiar neste caminho (ver task-7-report.md).
      opcoes.talento = 'Aumento no Valor de Atributo';
      return;
    case 'dadiva_proficiencia_pericia':
      // Só dispara quando opcoes.talento === 'Dádiva da Proficiência em
      // Perícia' (levelup.js:987-990); a escada nunca escolhe esse
      // talento (ver ACHADO acima), então este ramo é defesa contra
      // mudança futura -- ver task-7-report.md, Step 6.
      opcoes.dadiva_proficiencia_pericia = 'Atletismo';
      return;
    case 'dadiva_resistencia_energia':
      // Mesmo caso de 'dadiva_proficiencia_pericia': só dispara com
      // opcoes.talento === 'Dádiva da Resistência à Energia'
      // (levelup.js:1016-1021), que a escada nunca escolhe. Defesa.
      opcoes.dadiva_resistencia_energia = ['Ácido', 'Gélido'];
      return;
    case 'escolhas_talento':
      // validarEscolhasTalento (regras-cobertura.js:217) só exige algo
      // para talentos com regra própria; 'Aumento no Valor de Atributo'
      // não tem `getRegraTalento` registrada, então este ramo não
      // dispara na escada. Defesa -- ver task-7-report.md, Step 6.
      opcoes.escolhas_talento = {};
      return;
    case 'bardo_expertise': {
      const { dadosClasses } = await modulosApp();
      opcoes.bardo_expertise = proximasPericias(p, 2, dadosClasses);
      return;
    }
    case 'guardiao_expertise': {
      const { dadosClasses } = await modulosApp();
      opcoes.guardiao_expertise = proximasPericias(p, 2, dadosClasses);
      return;
    }
    case 'estilo_luta':
      opcoes.estilo_luta = 'Defensivo';
      return;
    case 'explorador_habil': {
      const { dadosClasses } = await modulosApp();
      opcoes.explorador_expertise = proximasPericias(p, 1, dadosClasses)[0];
      // IMPORTANT (achado de revisão): o ramo original só definia
      // `explorador_expertise`. subirDeNivel (levelup.js:1118-1127) não
      // exige `explorador_idiomas` para liberar a pendência, mas a
      // aplicação (levelup.js:1631-1647) só concede os 2 idiomas da
      // Explorador Hábil SE eles vierem em `opcoes` -- sem isso o
      // Guardião termina o nível 20 com só o idioma inicial
      // ('Comum') e a característica nunca concede nada. O app não
      // valida os nomes contra uma lista canônica (só empilha
      // strings ainda ausentes de `personagem.idiomas`), por isso dois
      // nomes de idioma reais do livro bastam aqui.
      opcoes.explorador_idiomas = ['Anão', 'Élfico'];
      return;
    }
    case 'manobras_guerreiro':
      opcoes.manobras_novas = escolherManobras(p, classeData,
        levelup.getQuantidadeNovasManobras(nivel));
      return;
    case 'grimorio':
      opcoes.grimorio_selecionados = await escolherMagiasMago(p, classeData, nivel, 2);
      return;
    case 'subclasse_magias_arcana': {
      // Quantidade e escola exigida vêm da PRÓPRIA mensagem da pendência
      // ("Selecione N magia(s) de <Escola> para o Grimório",
      // levelup.js:1216) -- não são supostas, porque a quantidade varia
      // por nível (2 no bônus inicial do nível 3, 1 nos recorrentes) e a
      // escola varia por subclasse (Abjurador -> Abjuração, etc.).
      const { quantidade, escola } = opcoes._subclasseArcana;
      opcoes.subclasse_magias_selecionadas = await escolherMagiasMago(
        p, classeData, nivel, quantidade,
        { escola, excluirNomes: opcoes.grimorio_selecionados || [] });
      return;
    }
    case 'academico':
      opcoes.academico_expertise = ['Arcanismo'];
      return;
    case 'subclasse_descobertas_magicas': {
      // Ramo dedicado porque a lista de opcoes desta linha e ASSINCRONA: o
      // livro deixa escolher "duas magias a sua escolha" de qualquer lista
      // (Classes.md:770), entao nao ha lista literal na tabela -- as opcoes
      // vem do indice de magias. Reaproveita o mesmo seletor que o grimorio
      // do Mago usa, para o teste escolher nomes de magia REAIS e nao
      // strings inventadas que a validacao futura recusaria.
      opcoes.subclasse_descobertas_magicas =
        (await escolherMagiasMago(p, classeData, nivel, 2)).slice(0, 2);
      return;
    }
  }

  // Escolhas de subclasse (regras-subclasse-escolhas.js): o driver responde
  // com as N primeiras opcoes VALIDAS da propria tabela -- nao um valor
  // qualquer, e sim o mesmo conjunto que a tela oferece, para o teste medir
  // o caminho real. Descobertas Magicas tem lista assincrona (vazia aqui), e
  // por isso recebe nomes de magia reais do indice, resolvidos pelo chamador.
  if (await responderLinhaDeSubclasse(opcoes, tipo, p, nivel)) return;
  throw new Error(`resolverPendencia sem ramo para "${tipo}" ` +
    `(classe ${p.classe}, nível ${nivel})`);
}

/**
 * Responde uma pendencia que veio de uma linha de ESCOLHAS_SUBCLASSE_APP,
 * com as N primeiras opcoes VALIDAS que o personagem ainda nao tem -- nao um
 * valor qualquer, e sim o mesmo conjunto que a tela oferece, para o teste
 * medir o caminho real. Devolve `false` quando o tipo nao e de linha de
 * subclasse, para o chamador seguir com o proprio erro.
 *
 * Existe como funcao unica porque os DOIS drivers de subida (escadaDeNivel e
 * subirAteNivel) precisam da mesma resposta: quando as duas copias
 * divergiam, um cenario passava por um caminho e travava pelo outro.
 */
async function responderLinhaDeSubclasse(opcoes, tipo, p, nivelNaClasse) {
  const tabela = _cache?.regrasSubclasseEscolhas;
  if (!tabela) return false;
  // `opcoes.subclasse || p.subclasse`: no nivel 3 a subclasse esta sendo
  // escolhida NESTA chamada e ainda nao foi gravada no personagem -- mesmo
  // idioma de levelup.js:966. Os truques conhecidos entram porque uma linha
  // pode ter dois ramos conforme o personagem ja conheca o truque que ela
  // concede (Ilusoes Aprimoradas, Classes.md:5074) -- sem eles o driver
  // procuraria o ramo automatico e nunca acharia o `tipo` do substituto.
  const linha = tabela.linhasDaSubclasseNoNivel(
    opcoes.subclasse || p.subclasse, nivelNaClasse, tabela.truquesConhecidosDe(p))
    .find((l) => l.tipo === tipo);
  if (!linha) return false;

  // Escolhe opcoes que o personagem AINDA NAO TEM: responder com as N
  // primeiras da lista faria o converso (Grupo 6) medir crescimento zero
  // quando a semente ja e proficiente nelas -- o teste acusaria "nenhum
  // mecanismo respondeu" por culpa do driver, nao do app.
  const jaTem = new Set(linha.destino === 'pericias_proficientes'
    ? (p.pericias_proficientes || [])
    : linha.destino === 'proficiencias_ferramentas'
      ? (p.proficiencias_ferramentas || [])
      : linha.destino === 'truque_de_subclasse'
        ? tabela.truquesConhecidosDe(p)
        : []);
  // Lista ASSINCRONA (truques de Mago, magias das tres listas do livro): as
  // opcoes vem de dados/classes/, e `opcoesDaLinha` devolve [] de proposito.
  // Resolvedor sem `circuloMaximo` (este driver nao calcula um) cai no
  // padrao Infinity de resolverDescobertasMagicas e, ordenado por circulo,
  // as N primeiras opcoes virariam truques -- destino errado para uma linha
  // que grava em magias_preparadas. Falha alto em vez de medir isso em
  // silencio: precisa de ramo dedicado, como 'subclasse_descobertas_magicas'
  // em resolverPendencia, acima.
  if (tabela.resolvedorDaLinha(linha)) throw new Error(`responderLinhaDeSubclasse: a linha "${tipo}" tem resolvedor assincrono e precisa de um circuloMaximo que este driver nao calcula -- adicione um ramo dedicado em vez de cair aqui sem teto.`);
  const disponiveis = tabela.opcoesDaLinha(linha).filter((o) => !jaTem.has(o));
  if (disponiveis.length < linha.quantidade) {
    throw new Error(
      `responderLinhaDeSubclasse: a linha "${tipo}" ofereceu ${disponiveis.length} ` +
      `opcao(oes) para ${linha.quantidade} exigida(s) -- o driver precisa de um ` +
      `ramo dedicado para ela`);
  }
  opcoes[linha.campo] = disponiveis.slice(0, linha.quantidade);
  return true;
}

// Sobe um personagem da classe do nível 1 ao 20 chamando subirDeNivel de
// verdade, resolvendo cada pendência com uma escolha canônica. Depois de
// cada subida bem-sucedida chama aoSubir(personagem, nivel, pendencias)
// -- é onde o motor comportamental faz suas asserções, e `pendencias` é a
// lista de tipo_pendencia que o app EXIGIU naquele nível (o motor
// confronta essa lista contra a tabela do livro).
//
// `opcoesEscada.subclasse` força uma subclasse específica; por padrão a
// escada usa a primeira de dados/classes/, o que deixa duas pendências
// fora do caminho (ver Step 6 desta tarefa, no relatório).
//
// Falha ALTO E CLARO em cinco situações, todas as que fariam um teste
// passar sem afirmar nada: pendência de tipo desconhecido, pendência que
// se repete depois de resolvida (a escolha canônica não serviu), nível
// que não sobe depois do limite de tentativas, nível do personagem
// diferente do esperado apesar de `sucesso: true`, e `ateNivel` fora de
// 2..20 (MENOR 6 da revisão de 2026-08-17: sem esta checagem, `<= 1`
// pulava o laço em silêncio e devolvia um personagem de nível 1 sem
// avisar, e `> 20` morria bem mais abaixo com `XP_POR_NIVEL[21]`
// `undefined`, uma mensagem que não aponta para a causa real).
export async function escadaDeNivel(classe, aoSubir, opcoesEscada = {}) {
  const { levelup, db } = await modulosApp();
  const classeData = await db.getClasse(classe);
  const personagem = await personagemSemente(classe);
  const subclasseAlvo = opcoesEscada.subclasse || classeData.subclasses[0].nome;
  // CRITICAL (achado de revisão): levelup.js:1282 grava
  // `personagem.subclasse = opcoes.subclasse` sem conferir contra
  // `classeData.subclasses`, e obterCaracteristicasSubclasseNivel devolve
  // [] silenciosamente para um nome desconhecido -- um typo em
  // `opcoesEscada.subclasse` ("Mestre de Batalha" em vez de "Mestre da
  // Batalha") produzia um personagem de nível 20 SEM nenhuma
  // característica de subclasse, com `subirDeNivel` retornando sucesso o
  // tempo todo. Exatamente o cap silencioso que esta tarefa existe para
  // impedir, e ele batia no único encaminhamento escrito do Step 6
  // (segundo passe do Guerreiro com subclasse forçada). Validar aqui,
  // antes do laço, com a lista de nomes válidos na mensagem.
  const nomesSubclasseValidos = (classeData.subclasses || []).map((sc) => sc.nome);
  if (!nomesSubclasseValidos.includes(subclasseAlvo)) {
    throw new Error(`${classe}: subclasse "${subclasseAlvo}" não existe em ` +
      `dados/classes/ -- válidas: ${nomesSubclasseValidos.join(', ')}`);
  }
  const ATRIBUTOS = ['forca', 'destreza', 'constituicao',
                     'inteligencia', 'sabedoria', 'carisma'];

  // `opcoesEscada.ateNivel` para quem precisa do personagem parado num
  // nível intermediário -- o teste converso do domínio Subclasses sobe
  // duas escadas (uma até `e.nivel - 1`, outra até `e.nivel`) para
  // comparar o personagem imediatamente antes e depois de UMA
  // característica. Padrão 20 preserva o comportamento de TODOS os
  // chamadores existentes (nenhum passa `ateNivel` hoje).
  const ateNivel = opcoesEscada.ateNivel ?? 20;
  // MENOR 6 (revisão de 2026-08-17): valida ANTES do laço -- um `ateNivel`
  // fora de 2..20 é erro de quem chama, e o harness precisa recusar alto e
  // claro, no espírito das outras quatro validações desta função (ver
  // comentário do docblock acima).
  if (!Number.isInteger(ateNivel) || ateNivel < 2 || ateNivel > 20) {
    throw new Error(`escadaDeNivel: opcoesEscada.ateNivel precisa ser um ` +
      `inteiro entre 2 e 20 (recebido ${JSON.stringify(ateNivel)}) -- <= 1 ` +
      `pularia o laço em silêncio, > 20 morreria em XP_POR_NIVEL[${ateNivel}] ` +
      `indefinido`);
  }
  for (let nivel = 2; nivel <= ateNivel; nivel++) {
    personagem.xp = levelup.XP_POR_NIVEL[nivel];
    const opcoes = {};
    const vistas = new Set();
    let resultado = null;

    for (let tentativa = 0; tentativa <= PENDENCIAS_CONHECIDAS.length; tentativa++) {
      resultado = await levelup.subirDeNivel(personagem, opcoes);
      if (resultado.sucesso) break;
      if (!resultado.pendente) {
        throw new Error(`${classe} nv${nivel}: subirDeNivel falhou sem pendência: ` +
          `${resultado.erro ?? JSON.stringify(resultado)}`);
      }
      const tipo = resultado.tipo_pendencia;
      if (!PENDENCIAS_CONHECIDAS.includes(tipo)) {
        throw new Error(`${classe} nv${nivel}: tipo_pendencia desconhecido ` +
          `"${tipo}" — acrescente-o a PENDENCIAS_CONHECIDAS e defina a ` +
          `escolha canônica em escadaDeNivel`);
      }
      if (vistas.has(tipo)) {
        throw new Error(`${classe} nv${nivel}: pendência "${tipo}" reapareceu ` +
          `depois de resolvida — a escolha canônica não foi aceita: ` +
          `${resultado.mensagem}`);
      }
      vistas.add(tipo);
      // 'subclasse_magias_arcana' precisa saber QUANTAS magias e de QUE
      // ESCOLA a mensagem pede (quantidade varia por nível -- 2 no bônus
      // inicial do nível 3, 1 nos recorrentes; escola varia por
      // subclasse); a única fonte confiável é a própria mensagem da
      // pendência ("Selecione N magia(s) de <Escola> para o Grimório",
      // levelup.js:1216), já que subirDeNivel não devolve nenhum dos dois
      // valores em outro campo do resultado.
      if (tipo === 'subclasse_magias_arcana') {
        const m = String(resultado.mensagem).match(/Selecione (\d+) magia\(s\) de (.+) para o Grimório/);
        if (!m) {
          throw new Error(`${classe} nv${nivel}: mensagem de ` +
            `'subclasse_magias_arcana' em formato inesperado: ${resultado.mensagem}`);
        }
        opcoes._subclasseArcana = { quantidade: parseInt(m[1], 10), escola: m[2] };
      }
      await resolverPendencia(tipo, opcoes, personagem, classeData,
        ATRIBUTOS, levelup, subclasseAlvo, nivel);
    }

    if (!resultado?.sucesso) {
      throw new Error(`${classe} nv${nivel}: não subiu — ` +
        `${JSON.stringify(resultado)}`);
    }
    if (personagem.nivel !== nivel) {
      throw new Error(`${classe}: subirDeNivel disse sucesso mas o nível é ` +
        `${personagem.nivel}, esperado ${nivel}`);
    }
    // Reforça a validação de pré-laço: se a pendência 'subclasse' acabou
    // de ser resolvida neste nível, confirma que o app REALMENTE gravou
    // `subclasseAlvo` (e não silenciosamente nada, ou outra coisa).
    if (vistas.has('subclasse') && personagem.subclasse !== subclasseAlvo) {
      throw new Error(`${classe} nv${nivel}: pendência 'subclasse' resolvida ` +
        `mas personagem.subclasse é "${personagem.subclasse}", esperado "${subclasseAlvo}"`);
    }
    await aoSubir(personagem, nivel, [...vistas]);
  }
  return personagem;
}

// ============================================================
// `subirAteNivel()`: auxiliar determinístico da Tarefa 2 do sub-projeto 5
// (.superpowers/sdd/2026-08-26-multiclasse-subida-nivel/task-2-brief.md).
// Diferente de `escadaDeNivel()` (acima), que já sabe a lista fechada de
// pendências e falha alto para qualquer tipo fora dela, este auxiliar é o
// que as Tarefas 3a/3b/3c/5/7/10 vão reaproveitar para subir um
// personagem MULTICLASSE -- por isso já passa `opcoes.classe`, mesmo que
// `subirDeNivel` ainda ignore esse campo hoje (só passa a honrá-lo na
// Tarefa 3a). Para classe única isso é inócuo.
// ============================================================

// ACHADO (Step 3 desta tarefa): o brief original sugeria
// `opcoes.talento = 'Dádiva da Sorte'` para 'dadiva_epica', mas esse
// talento NÃO existe em dados/talentos/talentos.json -- conferido com
// grep, e o mesmo achado já está documentado no comentário de
// `resolverPendencia` (função irmã, acima, escrita numa tarefa anterior):
// os únicos "Dádiva do X" são Ataque Irresistível, Destino e Espírito da
// Noite, nenhum "Dádiva da Sorte". Usar o nome inexistente faria
// `subirDeNivel` devolver `{ sucesso:false, erro: 'Talento selecionado
// não encontrado.' }` -- um ERRO, não uma pendência -- e `subirAteNivel`
// lançaria imediatamente no nível 19 das 12 classes. A correção
// reaproveita o mesmo talento genérico de ASI ('Aumento no Valor de
// Atributo', Repetível) que já resolve 'aumento_atributo': definir só
// `opcoes.talento` já silencia 'dadiva_epica', e a subida seguinte
// devolve 'talento_asi' pedindo a distribuição, que o ramo abaixo trata.
//
// Preenche UMA resposta em `opcoes` para a pendencia recebida, sempre com
// a primeira opcao valida. Lanca para tipo desconhecido: e essa excecao
// que revela, por medicao, quais pendencias existem de verdade -- a lista
// escrita de cabeca sempre sai incompleta.
//
// Assincrona: os ramos de magia (grimorio/subclasse arcana) e de perícias
// (Especialização/Explorador Hábil) precisam de `dadosClasses`/`utils`,
// obtidos via modulosApp() -- memoizada, então chamá-la aqui não recarrega
// nada. Reaproveita escolherMagiasMago/proximasPericias (definidas acima,
// já usadas por escadaDeNivel) em vez de reimplementar os mesmos filtros.

// Pool determinístico de magias de 1º círculo com o marcador Ritual
// (conferidas em dados/magias/circulo_1.json, campo tempo_conjuracao) para
// responder à pendência 'ritual_bonus_proficiencia' do Conjurador
// Ritualista. Onze nomes bastam com folga: o Bônus de Proficiência sobe no
// máximo 4 vezes numa carreira inteira (níveis 5, 9, 13, 17 -- livro:2047),
// e a característica de aquisição soma no máximo mais 6 (o próprio Bônus
// de Proficiência do nível em que o talento é escolhido).
const RITUAIS_1_CIRCULO = [
  'Alarme', 'Compreender Idiomas', 'Convocar Familiar', 'Detectar Magia',
  'Detectar Veneno e Doença', 'Disco Flutuante de Tenser', 'Escrita Ilusória',
  'Falar com Animais', 'Identificar', 'Purificar Alimentos e Bebidas',
  'Servo Invisível',
];

async function responderPendencia(opcoes, tipo, personagem, classeData, nomeClasse) {
  // Pendências chegam ANTES de o nível avançar (subirDeNivel só grava o
  // novo nível depois que todas as pendências do nível são resolvidas) --
  // por isso o nível que a resposta precisa considerar é sempre
  // nivel_atual + 1.
  //
  // NA CLASSE, não TOTAL. `personagem.nivel` é o ESPELHO do nível total;
  // tudo que este auxiliar decide (quais magias cabem no grimório, qual
  // linha de ESCOLHAS_SUBCLASSE_APP dispara, quantas magias a dádiva de
  // escola concede) é regra de nível NA CLASSE que sobe -- a mesma
  // separação que `contextoDeSubida` faz no motor. MEDIDO: com o total,
  // `subirAteNivel(barbaro5, 'Mago', 6)` escolhia magias de 3º círculo
  // (tabela do Mago no nível 6) para um Mago 1, `subirDeNivel` recusava, e
  // o auxiliar lançava "pendência não resolvida: grimorio" -- exatamente o
  // que impedia qualquer cenário com CONJURADORA como segunda classe (o
  // buraco de cobertura por onde o Critical desta revisão passou).
  // Para classe única, nivelNa === personagem.nivel: nada se move.
  const { multiclasse } = await modulosApp();
  const classeQueSobe = nomeClasse || personagem.classe;
  const novoNivel = multiclasse.nivelNa(personagem, classeQueSobe) + 1;

  switch (tipo) {
    case 'subclasse':
      opcoes.subclasse = (classeData?.subclasses || [])
        .filter((sc) => !sc.nome.toLowerCase().startsWith('subclasses de'))[0]?.nome;
      return;
    case 'aumento_atributo':
      opcoes.talento = 'Aumento no Valor de Atributo';
      opcoes.aumentos_atributo = { constituicao: 2 };
      return;
    case 'dadiva_epica':
      // Ver ACHADO acima: reaproveita o talento genérico de ASI -- não é o
      // que o brief sugeria de cabeça, mas o que a mensagem de erro medida
      // exige.
      opcoes.talento = 'Aumento no Valor de Atributo';
      return;
    case 'talento_asi': {
      // A resposta fixa de 'aumento_atributo' (sempre +2 em Constituição)
      // esbarra no teto de 20 depois de algumas subidas -- esta pendência
      // pede OUTRA distribuição. Primeiro atributo (ordem fixa) que ainda
      // comporta +2 sem estourar 20; Constituição sobra como último
      // recurso porque costuma ser o primeiro a saturar.
      const ATRIBUTOS = ['forca', 'destreza', 'constituicao', 'inteligencia', 'sabedoria', 'carisma'];
      const atributo = ATRIBUTOS.find((a) => (personagem.atributos?.[a] ?? 10) <= 18) || 'constituicao';
      opcoes.talento = 'Aumento no Valor de Atributo';
      opcoes.aumentos_atributo = { [atributo]: 2 };
      return;
    }
    case 'estilo_luta':
      opcoes.estilo_luta = 'Defensivo';
      return;
    case 'explorador_habil': {
      const { dadosClasses } = await modulosApp();
      opcoes.explorador_expertise = proximasPericias(personagem, 1, dadosClasses)[0];
      // levelup.js só concede os 2 idiomas de Explorador Hábil SE eles
      // vierem em `opcoes` (mesmo achado documentado em resolverPendencia).
      opcoes.explorador_idiomas = ['Anão', 'Élfico'];
      return;
    }
    case 'bardo_expertise': {
      const { dadosClasses } = await modulosApp();
      opcoes.bardo_expertise = proximasPericias(personagem, 2, dadosClasses);
      return;
    }
    case 'guardiao_expertise': {
      const { dadosClasses } = await modulosApp();
      opcoes.guardiao_expertise = proximasPericias(personagem, 2, dadosClasses);
      return;
    }
    case 'academico':
      // Acadêmico exige proficiência PRÉVIA na perícia escolhida
      // (levelup.js) -- o personagem sintético de personagemInicialDeClasse
      // não parte com nenhuma, então concede Arcanismo aqui (a perícia de
      // assinatura do Mago) antes de responder à pendência.
      if (!personagem.pericias_proficientes) personagem.pericias_proficientes = [];
      if (!personagem.pericias_proficientes.includes('Arcanismo')) {
        personagem.pericias_proficientes.push('Arcanismo');
      }
      opcoes.academico_expertise = ['Arcanismo'];
      return;
    case 'ritual_bonus_proficiencia': {
      // Crescimento do Conjurador Ritualista (Talentos.md:370). Reusa
      // ritualBonusPendente -- a MESMA função que subirDeNivel chama --
      // para saber quantas magias faltam e quais já foram escolhidas; o
      // `+1` repete a conta de nivelTotalNovo que contextoDeSubida fez
      // para gerar esta pendência (nivelTotal(personagem) + 1), porque o
      // espelho `personagem.nivel` ainda não avançou neste ponto.
      const { regras } = await modulosApp();
      const pendente = regras.ritualBonusPendente(personagem, multiclasse.nivelTotal(personagem) + 1);
      // `nomesPreparados` (TODAS as preparadas, de qualquer origem), nao
      // `jaEscolhidas` (so as do talento): desde o Important 1 da revisao
      // final, o guard do motor recusa um nome ja preparado por outra via
      // -- responder com um deles esgotaria as 12 tentativas de
      // subirAteNivel com um erro que nao aponta para a causa.
      const jaTem = new Set(pendente.nomesPreparados);
      const escolha = RITUAIS_1_CIRCULO.filter((m) => !jaTem.has(m)).slice(0, pendente.faltam);
      if (escolha.length !== pendente.faltam) {
        throw new Error(`responderPendencia: RITUAIS_1_CIRCULO esgotado para o ` +
          `Conjurador Ritualista (faltam ${pendente.faltam}, disponíveis ${escolha.length})`);
      }
      opcoes.rituais_bonus_proficiencia = escolha;
      return;
    }
    case 'proficiencias_classe_nova': {
      // Proficiencias reduzidas ao entrar numa classe NOVA (livro:2051,
      // sub-projeto proprio de multiclasse-proficiencias). Sem este caso,
      // QUALQUER escada que entrasse em Bardo/Guardiao/Ladino como
      // classe ADICIONAL esgotava as 12 tentativas de subirAteNivel e
      // lancava -- so nao aparecia porque nenhuma escada multiclasse da
      // suite entrava numa dessas tres classes (achado da revisao do
      // Task 3). Responde com a primeira opcao ainda nao possuida, mesmo
      // padrao de `proximasPericias` acima.
      const { proficiencias, regras } = await modulosApp();
      const concessoes = proficiencias.concessoesAoEntrarEm(nomeClasse);
      if (concessoes.pericias > 0) {
        const jaTem = new Set(personagem.pericias_proficientes || []);
        const escolha = concessoes.opcoesPericia.find((per) => !jaTem.has(per));
        if (!escolha) {
          throw new Error(`responderPendencia: nenhuma pericia livre em ` +
            `opcoesPericia de ${nomeClasse} -- personagem ja proficiente em todas`);
        }
        opcoes.pericia_classe_nova = escolha;
      }
      if (concessoes.instrumentos > 0) {
        // `regras` = regras-cobertura.js, fonte unica de INSTRUMENTOS_MUSICAIS
        // (mesma constante que levelup.js agora valida a escolha contra).
        const jaTemInstrumento = new Set(personagem.proficiencias_instrumentos || []);
        const instrumento = regras.INSTRUMENTOS_MUSICAIS.find((i) => !jaTemInstrumento.has(i));
        if (!instrumento) {
          throw new Error('responderPendencia: nenhum instrumento livre em INSTRUMENTOS_MUSICAIS');
        }
        opcoes.instrumento_classe_nova = instrumento;
      }
      return;
    }
    case 'grimorio': {
      // Livro (Classes.md, característica Conjuração do Mago): SEIS magias
      // de 1º círculo no nível 1 de Mago -- criação ou multiclasse --, DUAS
      // nos níveis seguintes. `novoNivel` aqui é o NA CLASSE (comentário
      // acima), então só é 1 quando Mago entra como classe nova (residuo-1
      // desta tarefa; mesmo número de levelup.js/grimorioQtd).
      const qtdGrimorio = novoNivel === 1 ? 6 : 2;
      opcoes.grimorio_selecionados = await escolherMagiasMago(personagem, classeData, novoNivel, qtdGrimorio);
      return;
    }
    case 'subclasse_magias_arcana': {
      const { dadosClasses } = await modulosApp();
      const subclasseAtual = opcoes.subclasse || personagem.subclasse;
      const escola = dadosClasses.ESCOLAS_SUBCLASSE_MAGO[subclasseAtual];
      // Quantidade fixa pela regra do livro (levelup.js:
      // qtdMagiasSubclasseArcana): 2 no bônus de entrada na subclasse
      // (nível 3), 1 em cada bônus recorrente depois disso -- a pendência
      // só aparece quando a quantidade é > 0, então fora do nível 3 ela só
      // pode ser 1.
      const quantidade = novoNivel === 3 ? 2 : 1;
      opcoes.subclasse_magias_selecionadas = await escolherMagiasMago(
        personagem, classeData, novoNivel, quantidade,
        { escola, excluirNomes: opcoes.grimorio_selecionados || [] });
      return;
    }
    case 'prerequisito_classe':
      // Este driver NUNCA dispensa um pre-requisito de multiclasse (livro:2033)
      // em silencio. Uma escolha canonica generica aqui (sempre marcar
      // `dispensar_prerequisito`) contaminaria toda a rede de nao-regressao
      // que as tarefas deste sub-projeto ja usam -- um teste que semear um
      // personagem sem o 13+ certo passaria a subir de nivel do mesmo jeito,
      // sem ninguem decidir isso de proposito. Quem precisar caracterizar o
      // caminho da dispensa monta a chamada com `opcoes.dispensar_prerequisito`
      // fora deste auxiliar (ver multiclasse-subida.test.mjs).
      throw new Error(
        `responderPendencia: pré-requisito de multiclasse não atendido para ` +
        `${personagem.classe} nível ${personagem.nivel} -- este driver nunca dispensa ` +
        `pré-requisito automaticamente; monte a chamada com ` +
        `opcoes.dispensar_prerequisito explicitamente.`);
  }

  // Escolhas de subclasse vindas da tabela declarativa
  // (regras-subclasse-escolhas.js): responde com as N primeiras opções
  // VÁLIDAS que o personagem ainda não tem -- mesmo mecanismo do fallback
  // genérico de `resolverPendencia`, acima.
  await modulosApp();
  if (await responderLinhaDeSubclasse(opcoes, tipo, personagem, novoNivel)) return;

  throw new Error(
    `responderPendencia: tipo "${tipo}" sem tratamento (classe ${personagem.classe}, ` +
    `nível ${personagem.nivel}). Acrescente o ramo -- não silencie.`);
}

/**
 * Sobe `personagem` ate `nivelAlvo` na classe indicada, respondendo cada
 * pendencia com a PRIMEIRA opcao valida -- deterministico de proposito:
 * o mesmo roteiro tem de produzir sempre o mesmo personagem, senao o
 * snapshot de caracterizacao acusa diferenca que nao e regressao.
 *
 * Nao reimplementa regra nenhuma: chama `subirDeNivel` de verdade e so
 * preenche o que ela pedir. Lanca -- nunca engole -- quando a pendencia e
 * de um tipo que este auxiliar nao conhece: um `return` silencioso ali
 * congelaria um personagem parado no meio da escada e todo oraculo
 * construido sobre ele mediria a coisa errada.
 *
 * @param {object} personagem Mutado no lugar.
 * @param {string} nomeClasse Classe em que os niveis entram.
 * @param {number} nivelAlvo Nivel TOTAL a alcancar.
 * @returns {Promise<object>} o proprio personagem, ja no nivel alvo.
 */
export async function subirAteNivel(personagem, nomeClasse, nivelAlvo) {
  const { levelup, db } = await modulosApp();
  const classeData = await db.getClasse(nomeClasse);
  let guarda = 0;
  while ((personagem.nivel || 0) < nivelAlvo) {
    if (++guarda > 100) {
      throw new Error(`subirAteNivel: ${nomeClasse} travou no nível ${personagem.nivel}`);
    }
    const opcoes = { ignorar_xp: true, classe: nomeClasse };
    // Ate 12 rodadas por nivel: cada `pendente` acrescenta UMA resposta e
    // tenta de novo. Doze e o teto de pendencias que um nivel pode
    // acumular hoje (subclasse + ASI + estilo + manobras + expertise +
    // truques + magias + grimorio + subclasse arcana + escolhas de
    // subclasse); estourar significa pendencia nova sem tratamento aqui.
    for (let tentativa = 0; tentativa < 12; tentativa++) {
      const r = await levelup.subirDeNivel(personagem, opcoes);
      if (r.sucesso) break;
      if (!r.pendente) throw new Error(`subirAteNivel: ${nomeClasse} nível ${personagem.nivel}: ${r.erro}`);
      await responderPendencia(opcoes, r.tipo_pendencia, personagem, classeData, nomeClasse);
      if (tentativa === 11) {
        throw new Error(`subirAteNivel: pendência não resolvida: ${r.tipo_pendencia}`);
      }
    }
  }
  return personagem;
}

/**
 * Personagem de nivel 1 numa classe, com atributos fixos. Semente
 * COMPARTILHADA entre o gerador do snapshot de caracterizacao e o teste
 * que o confere: se cada um montasse o seu, a primeira diferenca de
 * semente viraria "regressao" e ninguem acharia a causa.
 * Atributos em 15 para nenhum pre-requisito de talento barrar a escada.
 * @param {string} classe Nome da classe inicial.
 * @returns {Promise<object>} personagem de nivel 1.
 */
export async function personagemInicialDeClasse(classe) {
  return personagemMulticlasse([{ classe, nivel: 1 }]);
}

/** Reduz o personagem aos campos que a subida de nivel altera. */
export function fotoDaSubida(p) {
  return {
    nivel: p.nivel, classe: p.classe, subclasse: p.subclasse,
    classes: p.classes, pv_max: p.pv_max,
    dados_vida: p.dados_vida, dados_vida_total: p.dados_vida_total,
    espacos_magia: p.espacos_magia, atributos: p.atributos,
    pericias_proficientes: p.pericias_proficientes,
    pericias_expertise: p.pericias_expertise,
    escolhas_classe: p.escolhas_classe, talentos: p.talentos,
    manobras_conhecidas: p.manobras_conhecidas,
    magias_conhecidas: p.magias_conhecidas,
    magias_preparadas: p.magias_preparadas,
    grimorio: p.grimorio,
  };
}
