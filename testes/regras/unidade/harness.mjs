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
         sheetMago] = await Promise.all([
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
  ]);
  _cache = { regras, efeitos, store, levelup, criador, utils, dadosClasses, db, equip,
             levelupFlow, sheetEstado, sheetMagias, sheetMigracoes, sheetGrimorio,
             sheetMago };
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
  }
  throw new Error(`resolverPendencia sem ramo para "${tipo}" ` +
    `(classe ${p.classe}, nível ${nivel})`);
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
// Falha ALTO E CLARO em quatro situações, todas as que fariam um teste
// passar sem afirmar nada: pendência de tipo desconhecido, pendência que
// se repete depois de resolvida (a escolha canônica não serviu), nível
// que não sobe depois do limite de tentativas, e nível do personagem
// diferente do esperado apesar de `sucesso: true`.
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

  for (let nivel = 2; nivel <= 20; nivel++) {
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
