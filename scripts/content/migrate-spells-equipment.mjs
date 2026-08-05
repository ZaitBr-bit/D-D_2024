#!/usr/bin/env node
// `scripts/content/migrate-spells-equipment.mjs`: conversor determinístico
// das 391 magias, 38 armas, 13 armaduras, 82+5 itens de aventura/munição, 25
// ferramentas, ~31 serviços, ~25 montarias/veículos, 51 criaturas e 154
// termos de glossário de D&D 2024 para o formato de conteúdo estruturado v1
// (`spell.schema.json`, `weapon.schema.json`, `armor.schema.json`,
// `equipment.schema.json`, `creature.schema.json`,
// `glossary-entry.schema.json`, `spell-list.schema.json`).
//
// Fonte de verdade (LEGADO, nunca reescrita por este script):
//   - `dados/magias/{_indice.json,truques.json,circulo_1..9.json,por_classe/*.json}`
//   - `dados/equipamento/{armas,armaduras,equipamento_aventura,ferramentas,
//     servicos,montarias_veiculos}.json`
//   - `dados/apendices/{criaturas,glossario}.json`
//
// Princípio (mesmo de `migrate-classes.mjs`/`migrate-origins-feats.mjs`):
// nenhum fato mecânico é inventado por inferência sobre prosa livre. Os
// campos estruturados desta tarefa (círculo/escola/tempo/alcance/
// componentes/duração/concentração/ritual/classes de magia; categoria/dano/
// tipo de dano/propriedades/maestria/peso/custo de arma; categoria/CA base/
// Destreza/Força/furtividade/peso/custo de armadura; categoria/peso/custo de
// item; tamanho/tipo/ND/CA/PV de criatura) vêm de campos JÁ ESTRUTURADOS do
// legado (`circulo`, `dano`, `ca`, `nd`, ...) via um parser determinístico de
// um vocabulário FECHADO e pequeno (nomes de escola, tipos de dano de arma,
// propriedades, maestrias, moedas, tamanhos) — nunca de regex sobre a prosa
// de `descricao`. Nenhuma automação de efeito mecânico de magia existe hoje
// em `site/js` (esta é uma ficha/criador de personagem, não um simulador de
// combate — conferido em `site/js/regras-cobertura.js` e `site/js/db.js`
// antes de escrever este arquivo: não há cálculo de dano/CD de magia em
// nenhum lugar do runtime). Por isso, TODO texto mecânico de magia
// (`descricao` + `circulo_superior`, quando presente) vira um efeito
// `manual` explícito — nunca um fallback silencioso de "tipo desconhecido":
// é a mesma regra de conversão que `migrate-origins-feats.mjs` já usa para
// benefícios de talento sem tabela de enriquecimento estrutural.
//
// `ferramentas.json`/`servicos.json`/`montarias_veiculos.json` não têm um
// array de itens estruturado no legado (texto/tabelas de markdown) — as
// tabelas (`tabelas[].dados`) SÃO estruturadas e são a fonte usada aqui;
// `ferramentas.json` não tem nem isso (`tabelas: []`), então sua lista de 25
// ferramentas é uma tabela AUTORADA À MÃO neste arquivo (TOOLS_TABLE),
// transcrita campo a campo de `texto_completo` (custo/peso/atributo/uso
// vêm de cada bloco "#### Nome (custo)" do markdown) — mesmo padrão de
// `migrate-origins-feats.mjs#SPECIES_TABLE`.
//
// Uso como CLI:
//   node scripts/content/migrate-spells-equipment.mjs
//     Constrói tudo em memória e imprime um resumo (staging, nada é escrito).
//   node scripts/content/migrate-spells-equipment.mjs --write
//     Escreve os 20 catálogos + o fragmento de índice de staging.
//   node scripts/content/migrate-spells-equipment.mjs --check
//     Recompila em memória e compara byte a byte com os arquivos commitados.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { slugify, buildContentId } from './content-id-map.mjs';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const legacyMagiasDir = path.join(repoRoot, 'dados', 'magias');
const legacyEquipamentoDir = path.join(repoRoot, 'dados', 'equipamento');
const legacyApendicesDir = path.join(repoRoot, 'dados', 'apendices');
// Task 23b: `dados/classes/magias_*.json` é a única fonte legada da coluna
// `especial` das listas de magia por classe (marca "M" de material com custo
// ou consumido) — ver `marcarMaterialComCustoOuConsumido`.
const legacyClassesDir = path.join(repoRoot, 'dados', 'classes');

const pkgDir = path.join(repoRoot, 'dados', 'pacotes', 'dnd2024');
const spellsDir = path.join(pkgDir, 'spells');
const byClassDir = path.join(spellsDir, 'by-class');
const equipmentDir = path.join(pkgDir, 'equipment');
const appendicesDir = path.join(pkgDir, 'appendices');
const indexFragmentsDir = path.join(repoRoot, 'scripts', 'content', 'dnd2024-index-fragments');
const indexFragmentPath = path.join(indexFragmentsDir, 'spells-equipment-appendices.json');

const NAMESPACE = 'dnd2024';
const SCHEMA_VERSION = '1.0.0';
const SOURCE_BOOK = 'Livro do Jogador (2024)';

const spellId = (nome) => buildContentId(NAMESPACE, 'spell', nome);
const spellListId = (slugLocal) => `${NAMESPACE}:spell-list:${slugLocal}`;
const classId = (nome) => buildContentId(NAMESPACE, 'class', nome);
const weaponId = (nome) => buildContentId(NAMESPACE, 'weapon', nome);
const armorId = (nome) => buildContentId(NAMESPACE, 'armor', nome);
const equipmentId = (nome) => buildContentId(NAMESPACE, 'equipment', nome);
const creatureId = (nome) => buildContentId(NAMESPACE, 'creature', nome);
const glossaryId = (nome) => buildContentId(NAMESPACE, 'glossary-entry', nome);
const damageTypeId = (slug) => buildContentId(NAMESPACE, 'damage-type', slug);

/**
 * Serializa exatamente como `--write` grava em disco (2 espaços de
 * indentação + quebra de linha final), para que `--check` compare bytes
 * idênticos — mesma convenção de `migrate-classes.mjs`/`migrate-origins-feats.mjs`.
 * @param {object} valor
 * @returns {string}
 */
function serializar(valor) {
  return `${JSON.stringify(valor, null, 2)}\n`;
}

// -----------------------------------------------------------------------
// Utilitários de parse de string legada (vocabulário fechado, um valor
// legado -> um valor canônico, nunca inferência de prosa livre).
// -----------------------------------------------------------------------

/**
 * Converte um peso legado ("0,5 kg", "150 g", "—", "Varia", "1 kg (saco)")
 * para um número em kg, ou `undefined` quando o legado não tem peso fixo
 * ("—"/"Varia"/vazio) — nunca inventa um valor.
 * @param {string|undefined} texto
 * @returns {number|undefined}
 */
export function parsePeso(texto) {
  if (typeof texto !== 'string') return undefined;
  const limpo = texto.trim();
  if (limpo === '' || limpo === '—' || limpo === '-' || /^varia$/i.test(limpo)) return undefined;
  const match = /^([\d.,]+)\s*(kg|g)\b/.exec(limpo);
  if (!match) throw new Error(`migrate-spells-equipment: peso legado não reconhecido: "${texto}"`);
  const numero = Number(match[1].replace(/\./g, '').replace(',', '.'));
  return match[2] === 'g' ? numero / 1000 : numero;
}

const MOEDA_MAP = { PC: 'cp', PP: 'sp', PO: 'gp', PL: 'pp' };

/**
 * Converte um custo legado ("2 PO", "1.500 PO", "—", "Varia") para
 * `{amount, currency}` (vocabulário de moeda fechado a cp/sp/gp/pp, mesmo
 * `common.schema.json#/$defs/cost`), ou `undefined` quando o legado não tem
 * custo fixo. Aceita um sufixo textual após a moeda (ex.: "por quilômetro"),
 * devolvido separadamente em `suffix` para ser preservado em `description`
 * (campo de apresentação) em vez de descartado.
 * @param {string|undefined} texto
 * @returns {{cost: {amount:number, currency:string}|undefined, suffix: string|undefined}}
 */
export function parseCusto(texto) {
  if (typeof texto !== 'string') return { cost: undefined, suffix: undefined };
  const limpo = texto.trim();
  if (limpo === '' || limpo === '—' || limpo === '-' || /^varia$/i.test(limpo)) {
    return { cost: undefined, suffix: undefined };
  }
  const match = /^([\d.,]+)\s*(PC|PP|PO|PL)\b(.*)$/.exec(limpo);
  if (!match) throw new Error(`migrate-spells-equipment: custo legado não reconhecido: "${texto}"`);
  const amount = Number(match[1].replace(/\./g, '').replace(',', '.'));
  const currency = MOEDA_MAP[match[2]];
  const suffix = match[3].trim();
  return { cost: { amount, currency }, suffix: suffix.length > 0 ? suffix : undefined };
}

const ESCOLA_MAP = {
  Abjuração: 'abjuration',
  Adivinhação: 'divination',
  Encantamento: 'enchantment',
  Evocação: 'evocation',
  Ilusão: 'illusion',
  Invocação: 'conjuration',
  Necromancia: 'necromancy',
  Transmutação: 'transmutation',
};

/**
 * Converte a string de componentes legada ("V, S, M (um sino...)") em
 * `{verbal, somatic, material, materialDescription}`. Extrai o conteúdo
 * entre parênteses (se houver) como `materialDescription` ANTES de separar
 * os tokens por vírgula, para não quebrar descrições de material que
 * contenham vírgulas internas (ex.: "M (incenso ... no valor de 10 ou mais
 * PO, que a magia consome)").
 * @param {string} texto
 * @returns {{verbal:boolean, somatic:boolean, material:boolean, materialDescription?:string}}
 */
export function parseComponentes(texto) {
  const parenMatch = /\(([\s\S]*)\)\s*$/.exec(texto);
  const materialDescription = parenMatch ? parenMatch[1] : undefined;
  const semParenteses = texto.replace(/\([\s\S]*\)\s*$/, '');
  const tokens = semParenteses
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
  const resultado = {
    verbal: tokens.includes('V'),
    somatic: tokens.includes('S'),
    material: tokens.includes('M'),
  };
  if (resultado.material && materialDescription) resultado.materialDescription = materialDescription;
  return resultado;
}

// -----------------------------------------------------------------------
// MAGIAS — dados/magias/{truques,circulo_1..9}.json (391 magias) +
// dados/magias/por_classe/*.json (8 listas de classe) + índice mestre.
// -----------------------------------------------------------------------

const SPELL_FILES = [
  ['truques.json', 'spells/cantrips.json'],
  ['circulo_1.json', 'spells/level-1.json'],
  ['circulo_2.json', 'spells/level-2.json'],
  ['circulo_3.json', 'spells/level-3.json'],
  ['circulo_4.json', 'spells/level-4.json'],
  ['circulo_5.json', 'spells/level-5.json'],
  ['circulo_6.json', 'spells/level-6.json'],
  ['circulo_7.json', 'spells/level-7.json'],
  ['circulo_8.json', 'spells/level-8.json'],
  ['circulo_9.json', 'spells/level-9.json'],
];

const BY_CLASS_FILES = ['bardo', 'bruxo', 'clerigo', 'druida', 'feiticeiro', 'guardiao', 'mago', 'paladino'];

/**
 * Constrói a entidade `spell` a partir de um registro legado completo
 * (`dados/magias/{truques,circulo_N}.json#magias[]`). Todo o texto mecânico
 * (`descricao` + `circulo_superior`, quando presente) vira efeito `manual`
 * explícito — nenhuma automação de dano/CD/condição existe hoje no runtime
 * para replicar (ver comentário de topo do arquivo).
 * @param {object} legado
 * @returns {object}
 */
function buildSpellEntity(legado) {
  const escola = ESCOLA_MAP[legado.escola];
  if (!escola) throw new Error(`migrate-spells-equipment: escola de magia legada desconhecida "${legado.escola}" (magia "${legado.nome}").`);
  const componentes = parseComponentes(legado.componentes);
  const effects = [{ id: 'descricao', type: 'manual', text: legado.descricao }];
  if (typeof legado.circulo_superior === 'string' && legado.circulo_superior.trim().length > 0) {
    effects.push({ id: 'aprimoramento', type: 'manual', text: legado.circulo_superior });
  }
  return {
    id: spellId(legado.nome),
    type: 'spell',
    schemaVersion: SCHEMA_VERSION,
    name: legado.nome,
    description: legado.descricao,
    source: { book: SOURCE_BOOK },
    level: legado.circulo,
    school: escola,
    castingTime: legado.tempo_conjuracao,
    range: legado.alcance,
    components: componentes,
    duration: legado.duracao,
    concentration: legado.duracao.startsWith('Concentração'),
    ritual: legado.tempo_conjuracao.includes('Ritual'),
    classes: legado.classes.map((nomeClasse) => classId(nomeClasse)),
    effects,
  };
}

/**
 * Carrega as 391 magias legadas (10 arquivos por círculo) e devolve, para
 * cada arquivo de saída, a coleção `{schemaVersion,type,items}` já pronta —
 * mais o array plano das 391 entidades (para o índice mestre/listas de
 * classe) e o mapa nome->entidade (para resolver as listas de classe).
 * @returns {Promise<{levelFiles: Array<{relPath:string, colecao:object}>, allSpells: object[], byName: Map<string,object>}>}
 */
async function construirMagias() {
  const levelFiles = [];
  const allSpells = [];
  const byName = new Map();
  for (const [arquivoLegado, relPath] of SPELL_FILES) {
    const legado = JSON.parse(await readFile(path.join(legacyMagiasDir, arquivoLegado), 'utf8'));
    const items = legado.magias.map((m) => {
      const entity = buildSpellEntity(m);
      if (byName.has(m.nome)) throw new Error(`migrate-spells-equipment: magia duplicada "${m.nome}".`);
      byName.set(m.nome, entity);
      allSpells.push(entity);
      return entity;
    });
    levelFiles.push({ relPath, colecao: { schemaVersion: SCHEMA_VERSION, type: 'spell', items } });
  }
  await marcarMaterialComCustoOuConsumido(byName);
  return { levelFiles, allSpells, byName };
}

/**
 * Marca `components.materialCostOrConsumed` nas magias cujo componente
 * material tem custo em moedas ou é consumido pela magia.
 *
 * De onde vem o valor: da coluna `especial` das tabelas de lista de magia por
 * classe (`dados/classes/magias_*.json`), onde a marca "M" significa
 * exatamente isso — magia com material COMUM não recebe a marca (dos 391
 * casos, 246 têm material sem marca). É a única fonte legada que carrega a
 * informação de forma discreta. Deliberadamente NÃO se infere por regex sobre
 * `materialDescription` ("no valor de ... PO", "que a magia consome"): a
 * medição feita na Task 23b mostrou 4 magias em que essa heurística e a
 * coluna do livro discordam, e adivinhar regra a partir de prosa é o
 * anti-padrão que esta refatoração remove.
 *
 * Ausência é preservada: magia sem material, ou que não aparece em nenhuma
 * lista de classe, simplesmente não recebe o campo (nunca `false` inventado).
 * @param {Map<string, object>} byName
 * @returns {Promise<void>}
 */
async function marcarMaterialComCustoOuConsumido(byName) {
  /** @type {Map<string, Map<boolean, string[]>>} magia -> marca -> classes que a declararam */
  const marcasPorMagia = new Map();
  for (const classeSlug of BY_CLASS_FILES) {
    const legado = JSON.parse(await readFile(path.join(legacyClassesDir, `magias_${classeSlug}.json`), 'utf8'));
    for (const linhas of Object.values(legado.lista_magias)) {
      for (const linha of linhas) {
        const entity = byName.get(linha.nome);
        if (!entity) throw new Error(`migrate-spells-equipment: magias_${classeSlug}.json cita magia inexistente "${linha.nome}".`);
        const marcado = String(linha.especial ?? '')
          .split(',')
          .map((t) => t.trim())
          .includes('M');
        if (marcado && entity.components.material !== true) {
          throw new Error(
            `migrate-spells-equipment: magia "${linha.nome}" está marcada com "M" em magias_${classeSlug}.json mas não tem componente material.`,
          );
        }
        if (!marcasPorMagia.has(linha.nome)) marcasPorMagia.set(linha.nome, new Map());
        const porMarca = marcasPorMagia.get(linha.nome);
        if (!porMarca.has(marcado)) porMarca.set(marcado, []);
        porMarca.get(marcado).push(classeSlug);
      }
    }
  }

  for (const [nome, porMarca] of marcasPorMagia) {
    let marca;
    if (porMarca.size === 1) {
      marca = [...porMarca.keys()][0];
    } else {
      // As 8 tabelas legadas discordam entre si sobre esta magia. NUNCA
      // resolver por maioria/união automática: a checagem da Task 23b mostrou
      // que a maioria acerta em dois casos e erra num terceiro (Praga de
      // Insetos). A resolução tem de ser declarada, item a item, com o motivo.
      const resolucao = M_INCONSISTENTE_NO_LEGADO[nome];
      if (resolucao === undefined) {
        throw new Error(
          `migrate-spells-equipment: as tabelas legadas discordam sobre a marca "M" de "${nome}" ` +
            `(${[...porMarca].map(([m, cs]) => `${m ? 'M' : 'sem M'}: ${cs.join('/')}`).join(' | ')}). ` +
            'Declare a resolução em M_INCONSISTENTE_NO_LEGADO, com o motivo.',
        );
      }
      marca = resolucao.materialCostOrConsumed;
    }
    if (marca) byName.get(nome).components.materialCostOrConsumed = true;
  }
}

/**
 * DIVERGÊNCIAS DELIBERADAS (Task 23b): magias em que as 8 tabelas de lista
 * por classe do legado (`dados/classes/magias_*.json`) DISCORDAM entre si
 * sobre a marca "M". Cada entrada resolve o conflito olhando para o verbete
 * canônico da magia (`dados/magias/circulo_N.json#componentes`), que é a
 * fonte primária, e registra por quê.
 *
 * Sem esta tabela, uma resolução automática (união ou maioria) escolheria
 * silenciosamente — e erraria em "Praga de Insetos", onde a maioria está
 * certa mas a união não, e o inverso poderia acontecer amanhã.
 * @type {Record<string, {materialCostOrConsumed: boolean, motivo: string}>}
 */
const M_INCONSISTENTE_NO_LEGADO = {
  'Golpe Certeiro': {
    materialCostOrConsumed: true,
    motivo:
      'Material "uma arma ... que vale 1 ou mais PP" TEM custo; bruxo/feiticeiro/mago marcam M e só a tabela do bardo omite.',
  },
  'Praga de Insetos': {
    materialCostOrConsumed: false,
    motivo:
      'Material "um gafanhoto" NÃO tem custo nem é consumido; clérigo/druida acertam ("C") e só a tabela do feiticeiro marca "C, M".',
  },
  'Projeção Astral': {
    materialCostOrConsumed: true,
    motivo:
      'Material "um zircão no valor de 1.000 ou mais PO ... que a magia consome" tem custo E é consumido; bruxo/mago marcam M e só a tabela do clérigo não.',
  },
};

/**
 * Constrói as 8 listas de magia por classe (`spells/by-class/*.json`) e o
 * índice mestre com todas as 391 magias (`spells/index.json`) — cada
 * arquivo é uma `collection` de um único item `spell-list` (mesmo formato
 * usado por `species/catalog.json`/etc., um item por arquivo neste caso).
 * @param {Map<string,object>} byName
 * @returns {Promise<{byClassFiles: Array<{relPath:string, colecao:object}>, indexFile: {relPath:string, colecao:object}}>}
 */
async function construirListasDeClasse(byName) {
  const byClassFiles = [];
  for (const classeSlug of BY_CLASS_FILES) {
    const legado = JSON.parse(await readFile(path.join(legacyMagiasDir, 'por_classe', `${classeSlug}.json`), 'utf8'));
    const spells = legado.magias.map((m) => {
      const entity = byName.get(m.nome);
      if (!entity) throw new Error(`migrate-spells-equipment: lista de ${legado.classe} cita magia legada inexistente "${m.nome}".`);
      return entity.id;
    });
    const item = {
      id: spellListId(classeSlug),
      type: 'spell-list',
      schemaVersion: SCHEMA_VERSION,
      name: `Lista de Magias de ${legado.classe}`,
      description: `Todas as magias disponíveis para a classe ${legado.classe} em D&D 2024.`,
      source: { book: SOURCE_BOOK },
      spells,
    };
    byClassFiles.push({ relPath: `spells/by-class/${classeSlug}.json`, colecao: { schemaVersion: SCHEMA_VERSION, type: 'spell-list', items: [item] } });
  }

  const todasAsMagias = {
    id: spellListId('todas'),
    type: 'spell-list',
    schemaVersion: SCHEMA_VERSION,
    name: 'Índice de Todas as Magias',
    description: 'Lista mestre com as 391 magias de D&D 2024, independente de classe.',
    source: { book: SOURCE_BOOK },
    spells: [...byName.values()].map((e) => e.id),
  };
  const indexFile = { relPath: 'spells/index.json', colecao: { schemaVersion: SCHEMA_VERSION, type: 'spell-list', items: [todasAsMagias] } };

  return { byClassFiles, indexFile };
}

// -----------------------------------------------------------------------
// ARMAS — dados/equipamento/armas.json (38 armas)
// -----------------------------------------------------------------------

/**
 * Divide uma string por vírgulas de nível superior, ignorando vírgulas
 * dentro de parênteses (ex.: "Munição (Alcance 7,5/30; Agulha), Recarga" ->
 * ["Munição (Alcance 7,5/30; Agulha)", "Recarga"] — sem isso, uma vírgula
 * decimal brasileira dentro do parêntese de alcance quebraria o split
 * ingênuo por vírgula).
 * @param {string} texto
 * @returns {string[]}
 */
function splitRespeitandoParenteses(texto) {
  const partes = [];
  let atual = '';
  let profundidade = 0;
  for (const char of texto) {
    if (char === '(') profundidade += 1;
    if (char === ')') profundidade -= 1;
    if (char === ',' && profundidade === 0) {
      partes.push(atual);
      atual = '';
      continue;
    }
    atual += char;
  }
  partes.push(atual);
  return partes;
}

const WEAPON_DAMAGE_TYPE_MAP = { Perfurante: 'perfurante', Cortante: 'cortante', Contundente: 'contundente' };

const WEAPON_PROPERTY_MAP = {
  Acuidade: 'finesse',
  Arremesso: 'thrown',
  'Duas Mãos': 'two-handed',
  Extensão: 'reach',
  Leve: 'light',
  Munição: 'ammunition',
  Pesada: 'heavy',
  Recarga: 'loading',
  Versátil: 'versatile',
};

const WEAPON_MASTERY_MAP = {
  Ágil: 'nick',
  Afligir: 'vex',
  Derrubar: 'topple',
  Drenar: 'sap',
  Empurrar: 'push',
  Garantido: 'graze',
  Lentidão: 'slow',
  Trespassar: 'cleave',
};

/**
 * Extrai a lista de `properties` (enum fechado) de uma string legada de
 * propriedades de arma ("Acuidade, Arremesso (Alcance 6/18), Leve"). Cada
 * token é a palavra-chave antes de um eventual parêntese; "—" (sem
 * propriedades) devolve array vazio. O texto completo original (incluindo
 * alcance/dado alternativo entre parênteses) é preservado verbatim no campo
 * de apresentação `description` da entidade — nada é perdido, só o que não
 * cabe no vocabulário fechado do schema fica de fora da lista estruturada.
 * @param {string} texto
 * @returns {string[]}
 */
export function parsePropriedadesArma(texto) {
  // Mantida como a fatia "só a lista fechada" de `parseDetalhesDePropriedades`
  // (Task 23b), que passou a extrair também alcance/munição/dado versátil.
  return parseDetalhesDePropriedades(texto).properties;
}

/**
 * DIVERGÊNCIA DELIBERADA (Task 23b) — typo do legado corrigido aqui.
 *
 * Duas linhas de `dados/equipamento/armas.json` terminam com uma vírgula
 * sobrando, que o legado exibe literalmente na tabela:
 *   - `armas[12].propriedades` (Dardo): "Acuidade, Arremesso (Alcance 6/18),"
 *   - `armas[17].dano` (Espada Curta): "1d6 Perfurante,"
 * São erros de digitação da transcrição do livro, não conteúdo. O catálogo
 * grava a forma correta; a diferença resultante fica declarada, com contagem
 * exata, em `LEGACY_INTENTIONAL_DIVERGENCES` (site/js/infra/content/
 * legacy-db-projection.js) e é coberta pelos testes nomeados de
 * tests/contract/legacy-db-projection.test.js.
 * @param {string} texto
 * @returns {string}
 */
function removerVirgulaSobrandoDoLegado(texto) {
  return texto.replace(/,\s*$/, '');
}

/**
 * Extrai de uma string legada de propriedades de arma TODOS os campos
 * estruturados que ela carrega: a lista `properties` (enum fechado) e os
 * detalhes que o legado escondia entre parênteses — alcance
 * ("Arremesso (Alcance 6/18)"), tipo de munição ("Munição (Alcance 24/96;
 * Flecha)"), dado versátil ("Versátil (1d8)") e ressalva textual anexada a
 * uma propriedade ("Duas Mãos (a menos que montado)").
 *
 * Esse parsing acontece AQUI, no conversor (único lugar autorizado a ler
 * prosa legada), justamente para que `legacy-db-projection.js` possa
 * reconstruir a coluna `propriedades` a partir de campos estruturados, sem
 * voltar a parsear texto no caminho de leitura do runtime.
 * @param {string} texto
 * @returns {{properties: string[], range?: {normal: string, long: string}, ammunitionType?: string, versatileDamage?: string, propertyNotes?: Record<string, string>}}
 */
export function parseDetalhesDePropriedades(texto) {
  const limpo = removerVirgulaSobrandoDoLegado(texto.trim());
  const saida = { properties: [] };
  if (limpo === '' || limpo === '—') return saida;
  for (const bruto of splitRespeitandoParenteses(limpo).map((t) => t.trim()).filter(Boolean)) {
    const chave = bruto.split('(')[0].trim();
    const valor = WEAPON_PROPERTY_MAP[chave];
    if (!valor) throw new Error(`migrate-spells-equipment: propriedade de arma legada desconhecida "${chave}" (token "${bruto}" em "${texto}").`);
    saida.properties.push(valor);

    const parenteses = /\(([^)]*)\)/.exec(bruto);
    if (!parenteses) continue;
    const detalhe = parenteses[1].trim();

    if (valor === 'thrown' || valor === 'ammunition') {
      const alcance = /^Alcance\s+([^/;]+)\/([^;]+?)\s*(?:;\s*(.+))?$/.exec(detalhe);
      if (!alcance) throw new Error(`migrate-spells-equipment: detalhe de alcance legado não reconhecido "${detalhe}" (token "${bruto}").`);
      saida.range = { normal: alcance[1].trim(), long: alcance[2].trim() };
      if (alcance[3]) saida.ammunitionType = alcance[3].trim();
      continue;
    }
    if (valor === 'versatile') {
      saida.versatileDamage = detalhe;
      continue;
    }
    // Qualquer outra propriedade com parênteses é uma ressalva textual (hoje
    // só a Lança de Montaria). Preservada como nota tipada, nunca descartada.
    saida.propertyNotes = { ...(saida.propertyNotes ?? {}), [valor]: detalhe };
  }
  return saida;
}

/**
 * Constrói as 38 entidades `weapon` de `dados/equipamento/armas.json#armas[]`.
 * @returns {Promise<object[]>}
 */
async function construirArmas() {
  const legado = JSON.parse(await readFile(path.join(legacyEquipamentoDir, 'armas.json'), 'utf8'));
  return legado.armas.map((a) => {
    const danoMatch = /^([0-9]+(?:d[0-9]+)?)\s+(\S+)/.exec(removerVirgulaSobrandoDoLegado(a.dano));
    if (!danoMatch) throw new Error(`migrate-spells-equipment: dano de arma legado não reconhecido: "${a.dano}" (arma "${a.nome}").`);
    const tipoDano = WEAPON_DAMAGE_TYPE_MAP[danoMatch[2]];
    if (!tipoDano) throw new Error(`migrate-spells-equipment: tipo de dano de arma legado desconhecido "${danoMatch[2]}" (arma "${a.nome}").`);
    const maestriaChave = a.maestria;
    const maestria = WEAPON_MASTERY_MAP[maestriaChave];
    if (!maestria) throw new Error(`migrate-spells-equipment: maestria de arma legada desconhecida "${maestriaChave}" (arma "${a.nome}").`);
    const { cost } = parseCusto(a.custo);
    const detalhes = parseDetalhesDePropriedades(a.propriedades);
    // `rangeCategory` vem da coluna `categoria` legada e NÃO é derivável de
    // `properties`: o Dardo tem Arremesso sem Munição e ainda assim é arma à
    // distância. Valor desconhecido lança, como todos os mapas deste arquivo.
    const sufixoCategoria = a.categoria.replace(/^Armas (Simples|Marciais)\s*/, '');
    const rangeCategory = { 'Corpo a Corpo': 'melee', 'à Distância': 'ranged' }[sufixoCategoria];
    if (!rangeCategory) throw new Error(`migrate-spells-equipment: categoria de arma legada desconhecida "${a.categoria}" (arma "${a.nome}").`);
    return {
      id: weaponId(a.nome),
      type: 'weapon',
      schemaVersion: SCHEMA_VERSION,
      name: a.nome,
      description: `Propriedades: ${removerVirgulaSobrandoDoLegado(a.propriedades)}. Maestria: ${a.maestria}.`,
      source: { book: SOURCE_BOOK },
      weaponCategory: a.categoria.startsWith('Armas Simples') ? 'simple' : 'martial',
      rangeCategory,
      damage: { dice: danoMatch[1], type: damageTypeId(tipoDano) },
      properties: detalhes.properties,
      ...(detalhes.range ? { range: detalhes.range } : {}),
      ...(detalhes.ammunitionType ? { ammunitionType: detalhes.ammunitionType } : {}),
      ...(detalhes.versatileDamage ? { versatileDamage: detalhes.versatileDamage } : {}),
      ...(detalhes.propertyNotes ? { propertyNotes: detalhes.propertyNotes } : {}),
      mastery: maestria,
      ...(parsePeso(a.peso) !== undefined ? { weight: parsePeso(a.peso) } : {}),
      ...(cost ? { cost } : {}),
    };
  });
}

// -----------------------------------------------------------------------
// ARMADURAS — dados/equipamento/armaduras.json (13 armaduras)
// -----------------------------------------------------------------------

const ARMOR_CATEGORY_MAP = { Leve: 'light', Média: 'medium', Pesada: 'heavy', Escudo: 'shield' };

/**
 * Converte o campo "ca" legado em `{baseArmorClass, addDexModifier,
 * maxDexBonus?}` (armadura) ou `{armorClassBonus}` (Escudo, "+2" — um bônus,
 * não uma CA base, por isso o schema tem um campo próprio para esse caso).
 * @param {string} texto
 * @returns {{baseArmorClass?:number, addDexModifier?:boolean, maxDexBonus?:number, armorClassBonus?:number}}
 */
export function parseCaArmadura(texto) {
  const bonusMatch = /^\+(\d+)$/.exec(texto.trim());
  if (bonusMatch) return { armorClassBonus: Number(bonusMatch[1]), addDexModifier: false };

  const flatMatch = /^(\d+)$/.exec(texto.trim());
  if (flatMatch) return { baseArmorClass: Number(flatMatch[1]), addDexModifier: false };

  const dexMatch = /^(\d+)\s*\+\s*[Mm]odificador de Des(?:\s*\(máx\.\s*(\d+)\))?$/.exec(texto.trim());
  if (dexMatch) {
    const resultado = { baseArmorClass: Number(dexMatch[1]), addDexModifier: true };
    if (dexMatch[2]) resultado.maxDexBonus = Number(dexMatch[2]);
    return resultado;
  }

  throw new Error(`migrate-spells-equipment: CA de armadura legada não reconhecida: "${texto}".`);
}

/**
 * Constrói as 13 entidades `armor` de
 * `dados/equipamento/armaduras.json#armaduras[]`.
 * @returns {Promise<object[]>}
 */
async function construirArmaduras() {
  const legado = JSON.parse(await readFile(path.join(legacyEquipamentoDir, 'armaduras.json'), 'utf8'));
  return legado.armaduras.map((a) => {
    const categoria = ARMOR_CATEGORY_MAP[a.categoria];
    if (!categoria) throw new Error(`migrate-spells-equipment: categoria de armadura legada desconhecida "${a.categoria}" (armadura "${a.nome}").`);
    const ca = parseCaArmadura(a.ca);
    const requisitoMatch = /^For\s+(\d+)$/.exec(a.requisito_forca.trim());
    const { cost } = parseCusto(a.custo);
    return {
      id: armorId(a.nome),
      type: 'armor',
      schemaVersion: SCHEMA_VERSION,
      name: a.nome,
      description: `CA: ${a.ca}. Requisito de Força: ${a.requisito_forca}. Furtividade: ${a.furtividade}.`,
      source: { book: SOURCE_BOOK },
      armorCategory: categoria,
      ...ca,
      ...(requisitoMatch ? { strengthRequirement: Number(requisitoMatch[1]) } : {}),
      stealthDisadvantage: a.furtividade.trim() === 'Desvantagem',
      ...(parsePeso(a.peso) !== undefined ? { weight: parsePeso(a.peso) } : {}),
      ...(cost ? { cost } : {}),
    };
  });
}

// -----------------------------------------------------------------------
// ITENS DE AVENTURA + MUNIÇÃO — dados/equipamento/equipamento_aventura.json
// (82 itens reservados + 5 tipos de munição, ids novos)
// -----------------------------------------------------------------------

const TIPO_USO_MAP = { consumivel: 'Consumível', equipamento: 'Equipamento' };

/**
 * Resolve `tipo_uso` legado (`dados/equipamento/equipamento_aventura.json`)
 * para a categoria de apresentação — a maioria dos 82 itens (70) não tem
 * esse campo (é opcional no legado), então `undefined` cai no default
 * "Equipamento"; qualquer OUTRO valor não reconhecido lança, na mesma linha
 * dos demais mapas de tradução deste arquivo (ESCOLA_MAP/WEAPON_PROPERTY_MAP/
 * WEAPON_MASTERY_MAP/ARMOR_CATEGORY_MAP) — nunca um `??`/fallback silencioso
 * que mascararia um valor legado novo/inesperado.
 * @param {string|undefined} tipoUso
 * @param {string} nomeItem
 * @returns {string}
 */
function resolverCategoriaAventura(tipoUso, nomeItem) {
  if (tipoUso === undefined) return 'Equipamento';
  const categoria = TIPO_USO_MAP[tipoUso];
  if (!categoria) throw new Error(`migrate-spells-equipment: tipo_uso legado desconhecido "${tipoUso}" (item "${nomeItem}").`);
  return categoria;
}

/**
 * Constrói uma entidade `equipment` genérica a partir de `{name, category,
 * weight, cost, description}` já resolvidos — usado por todo grupo de
 * equipamento desta tarefa (itens de aventura, munição, ferramentas,
 * serviços, montarias/veículos) para manter o mesmo formato de envelope.
 * @param {{name:string, category:string, weight?:number, cost?:{amount:number,currency:string}, description?:string}} campos
 * @returns {object}
 */
function buildEquipmentEntity({
  name,
  category,
  weight,
  cost,
  description,
  weightDisplay,
  costDisplay,
  ammunition,
  legacySections,
}) {
  return {
    id: equipmentId(name),
    type: 'equipment',
    schemaVersion: SCHEMA_VERSION,
    name,
    ...(description ? { description } : {}),
    source: { book: SOURCE_BOOK },
    category,
    ...(weight !== undefined ? { weight } : {}),
    ...(weightDisplay !== undefined ? { weightDisplay } : {}),
    ...(cost ? { cost } : {}),
    ...(costDisplay !== undefined ? { costDisplay } : {}),
    ...(ammunition ? { ammunition } : {}),
    ...(legacySections ? { legacySections } : {}),
  };
}

/**
 * Devolve o texto legado de PESO quando ele carrega algo que `weight`
 * (número em kg) não representa — "Varia" (sem valor) ou "1 kg (saco)"
 * (valor mais uma ressalva) — e `undefined` quando o texto é só o número,
 * caso em que a apresentação é derivável de `weight` e não há nada a
 * preservar.
 *
 * Sem default inventado: peso ausente continua ausente (não vira 0), e o que
 * se acrescenta é apenas o texto que o legado realmente escreveu.
 * @param {string|undefined} texto
 * @returns {string|undefined}
 */
function pesoDeExibicaoLegado(texto) {
  if (typeof texto !== 'string') return undefined;
  const limpo = texto.trim();
  if (limpo === '' || limpo === '—' || limpo === '-') return undefined;
  const match = /^([\d.,]+)\s*(kg|g)\b(.*)$/.exec(limpo);
  if (!match) return limpo; // "Varia" e afins: só o texto sobrevive.
  return match[3].trim().length > 0 ? limpo : undefined;
}

/**
 * Equivalente de `pesoDeExibicaoLegado` para CUSTO: preserva o texto quando
 * ele não é um valor monetário estruturado ("Varia").
 * @param {string|undefined} texto
 * @returns {string|undefined}
 */
function custoDeExibicaoLegado(texto) {
  if (typeof texto !== 'string') return undefined;
  const limpo = texto.trim();
  if (limpo === '' || limpo === '—' || limpo === '-') return undefined;
  return /^([\d.,]+)\s*(PC|PP|PO|PL)\b/.test(limpo) ? undefined : limpo;
}

/**
 * Constrói os 82 itens de aventura reservados + 5 tipos de munição (ids
 * novos, não reservados — nada em Tasks 8/9 referencia munição avulsa).
 * @returns {Promise<object[]>}
 */
async function construirItensDeAventura() {
  const legado = JSON.parse(await readFile(path.join(legacyEquipamentoDir, 'equipamento_aventura.json'), 'utf8'));
  // O legado publica `descricoes` como um bloco solto no topo do arquivo: um
  // mapa "título do verbete" -> prosa, sem dizer a que item cada verbete
  // pertence. Task 23b reancora cada verbete ao seu item (a associação é do
  // próprio livro: o primeiro é do Foco Arcano, os três seguintes são do
  // Óleo), para que a informação deixe de ser um apêndice órfão. A tabela é
  // explícita de propósito — inferir o dono por heurística de texto seria
  // exatamente o parsing de prosa que esta refatoração remove.
  const DONO_DA_SECAO = {
    'Um Bruxo canaliza magia através de um Foco Arcano': 'Foco Arcano',
    'Cobrindo uma Criatura ou um Objeto': 'Óleo',
    'Cobrindo um Espaço': 'Óleo',
    'Combustível': 'Óleo',
  };
  const secoesPorItem = new Map();
  for (const [titulo, texto] of Object.entries(legado.descricoes ?? {})) {
    const dono = DONO_DA_SECAO[titulo];
    if (!dono) throw new Error(`migrate-spells-equipment: verbete de "descricoes" sem item dono mapeado: "${titulo}".`);
    if (!secoesPorItem.has(dono)) secoesPorItem.set(dono, []);
    secoesPorItem.get(dono).push({ title: titulo, text: texto });
  }
  const nomesDeItem = new Set(legado.itens.map((item) => item.nome));
  for (const dono of secoesPorItem.keys()) {
    if (!nomesDeItem.has(dono)) throw new Error(`migrate-spells-equipment: item dono de verbete inexistente em itens[]: "${dono}".`);
  }

  const itens = legado.itens.map((item) => {
    const { cost } = parseCusto(item.custo);
    return buildEquipmentEntity({
      name: item.nome,
      category: resolverCategoriaAventura(item.tipo_uso, item.nome),
      weight: parsePeso(item.peso),
      weightDisplay: pesoDeExibicaoLegado(item.peso),
      cost,
      costDisplay: custoDeExibicaoLegado(item.custo),
      description: item.descricao,
      legacySections: secoesPorItem.get(item.nome),
    });
  });
  const municao = legado.municao.map((m) => {
    const { cost } = parseCusto(m.custo);
    return buildEquipmentEntity({
      name: m.tipo,
      category: 'Munição',
      weight: parsePeso(m.peso),
      weightDisplay: pesoDeExibicaoLegado(m.peso),
      cost,
      costDisplay: custoDeExibicaoLegado(m.custo),
      description: `Munição vendida em conjuntos de ${m.quantidade}, armazenada em: ${m.armazenamento}.`,
      ammunition: { quantity: m.quantidade, storage: m.armazenamento },
    });
  });
  return [...itens, ...municao];
}

// -----------------------------------------------------------------------
// FERRAMENTAS — dados/equipamento/ferramentas.json (texto livre; sem
// `tabelas[]` estruturado). As 25 ferramentas abaixo são transcritas à mão,
// campo a campo, de cada bloco "#### Nome (custo)" de `texto_completo`
// (custo/peso/atributo/uso/fabricação já são campos claramente delimitados
// no próprio markdown — não é inferência de regra, é transcrição de uma
// tabela que o legado só não materializou como array de objetos).
//
// Duas normalizações deliberadas em relação ao markdown legado bruto (ambas
// documentadas aqui e nas próprias linhas de `TOOLS_TABLE` abaixo):
//   1. "Suprimentos de Pintor" tem um erro de digitação no legado
//      ("**Usar Objetor:**", não "**Usar Objeto:**") — transcrito como
//      `usarObjeto` normal (mesmo campo de todas as outras 24 ferramentas),
//      corrigindo o typo, não preservando-o.
//   2. "Suprimentos de Calígrafo": `fabricacao` legado é
//      "*Pergaminho Mágico*, Tinta" (itálico markdown ao redor de
//      "Pergaminho Mágico") — transcrito sem os asteriscos, mesma limpeza de
//      formatação que `limpar_texto()` já aplica em `_extrair_json.py` para
//      negrito/itálico em qualquer outro texto extraído.
// -----------------------------------------------------------------------

const TOOLS_TABLE = [
  { nome: 'Ferramentas de Carpinteiro', custo: '8 PO', peso: '3 kg', atributo: 'Força', usarObjeto: 'Selar ou abrir uma porta ou recipiente (CD 20)', fabricacao: 'Aríete Portável, Baliza, Barril, Baú, Cajado, Clava, Clava Grande, Escada, Tocha' },
  { nome: 'Ferramentas de Cartógrafo', custo: '15 PO', peso: '3 kg', atributo: 'Sabedoria', usarObjeto: 'Elaborar o mapa de uma pequena área (CD 15)', fabricacao: 'Mapa' },
  { nome: 'Ferramentas de Coureiro', custo: '5 PO', peso: '2,5 kg', atributo: 'Destreza', usarObjeto: 'Moldar a estética de um item de couro (CD 10)', fabricacao: 'Algibeira, Aljava, Armadura de Couro, Armadura de Couro Batido, Cantil, Chicote, Estojo de Mapa ou Pergaminho, Estojo de Virotes de Besta, Funda, Gibão de Peles, Mochila, Pergaminho' },
  { nome: 'Ferramentas de Entalhador', custo: '1 PO', peso: '2,5 kg', atributo: 'Destreza', usarObjeto: 'Entalhar um padrão em madeira (CD 10)', fabricacao: 'Armas à Distância (exceto Funda, Mosquete e Pistola), Cajado, Caneta Tinteiro, Clava, Clava Grande, Dardos, Flechas, Foco Arcano, Foco Druídico, Virotes' },
  { nome: 'Ferramentas de Ferreiro', custo: '20 PO', peso: '4 kg', atributo: 'Força', usarObjeto: 'Forçar a abertura de uma porta ou recipiente (CD 20)', fabricacao: 'qualquer arma Corpo a Corpo (exceto Cajado, Chicote, Clava, Clava Grande), armadura Média (exceto Gibão de Peles), armadura Pesada, Arpéu e Gancho, Balas de Arma de Fogo, Balas de Funda, Balde, Corrente, Esferas de Metal, Estacas de Ferro, Estrepes, Panela de Ferro, Pé de Cabra' },
  { nome: 'Ferramentas de Funileiro', custo: '50 PO', peso: '5 kg', atributo: 'Destreza', usarObjeto: 'Monte um item Minúsculo composto de sucata, que se desfaz em 1 minuto (CD 20)', fabricacao: 'Apito Sinalizador, Armadilha de Caça, Cadeado ou Fechadura, Caixa para Fogo, Espelho, Grilhões, Lanterna Coberta, Lanterna Foca-Facho, Mosquete, Pá, Pistola, Pote, Sino' },
  { nome: 'Ferramentas de Joalheiro', custo: '25 PO', peso: '1 kg', atributo: 'Inteligência', usarObjeto: 'Discernir o valor de uma gema (CD 15)', fabricacao: 'Foco Arcano, Símbolo Sagrado' },
  { nome: 'Ferramentas de Oleiro', custo: '10 PO', peso: '1,5 kg', atributo: 'Inteligência', usarObjeto: 'Discernir como um objeto de cerâmica foi manuseado nas últimas 24 horas (CD 15)', fabricacao: 'Jarro, Lâmpada' },
  { nome: 'Ferramentas de Pedreiro', custo: '10 PO', peso: '4 kg', atributo: 'Força', usarObjeto: 'Cinzelar um símbolo ou buraco na pedra (CD 10)', fabricacao: 'Roldana e Polias' },
  { nome: 'Ferramentas de Sapateiro', custo: '5 PO', peso: '2,5 kg', atributo: 'Destreza', usarObjeto: 'Modificar calçado para conceder Vantagem no próximo teste de Destreza (Acrobacia) do usuário (CD 10)', fabricacao: 'Kit de Escalada' },
  { nome: 'Ferramentas de Tecelão', custo: '1 PO', peso: '2,5 kg', atributo: 'Destreza', usarObjeto: 'Reparar um rasgo em uma roupa (CD 10) ou costurar um ornamento Minúsculo (CD 10)', fabricacao: 'Armadura Acolchoada, Cesta, Cobertor, Saco de Dormir, Roupas Finas, Rede, Túnica, Corda, Saca, Cordão, Tenda, Roupas de Viagem' },
  { nome: 'Ferramentas de Vidreiro', custo: '30 PO', peso: '2,5 kg', atributo: 'Inteligência', usarObjeto: 'Discernir como um objeto de vidro foi manuseado nas últimas 24 horas (CD 15)', fabricacao: 'Frasco, Jarro, Luneta, Lupa' },
  { nome: 'Suprimentos de Alquimista', custo: '50 PO', peso: '4 kg', atributo: 'Inteligência', usarObjeto: 'Identificar uma substância (CD 15) ou iniciar um incêndio (CD 15)', fabricacao: 'Ácido, Bolsa de Componentes, Fogo Alquímico, Óleo, Papel, Perfume' },
  { nome: 'Suprimentos de Calígrafo', custo: '10 PO', peso: '2,5 kg', atributo: 'Destreza', usarObjeto: 'Escrever texto com uma caligrafia que protege contra falsificação (CD 15)', fabricacao: 'Pergaminho Mágico, Tinta' },
  { nome: 'Suprimentos de Cervejeiro', custo: '20 PO', peso: '4,5 kg', atributo: 'Inteligência', usarObjeto: 'Detectar bebida envenenada (CD 15) ou identificar álcool (CD 10)', fabricacao: 'Antitoxina' },
  { nome: 'Suprimentos de Pintor', custo: '10 PO', peso: '2,5 kg', atributo: 'Sabedoria', usarObjeto: 'Fazer uma pintura reconhecível de algo que você viu (CD 10)', fabricacao: 'Foco Druídico, Símbolo Sagrado' },
  { nome: 'Utensílios de Cozinheiro', custo: '1 PO', peso: '4 kg', atributo: 'Sabedoria', usarObjeto: 'Melhorar o sabor dos alimentos (CD 10) ou detectar alimentos estragados ou envenenados (CD 15)', fabricacao: 'Rações' },
  { nome: 'Ferramentas de Ladrão', custo: '25 PO', peso: '0,5 kg', atributo: 'Destreza', usarObjeto: 'Abrir uma fechadura (CD 15) ou desarmar uma armadilha (CD 15)' },
  { nome: 'Ferramentas de Navegador', custo: '25 PO', peso: '1 kg', atributo: 'Sabedoria', usarObjeto: 'Traçar uma rota (CD 10) ou determinar a posição observando as estrelas (CD 15)' },
  { nome: 'Instrumento Musical', custo: 'Varia', peso: 'Varia', atributo: 'Carisma', usarObjeto: 'Tocar uma música conhecida (CD 10) ou improvisar uma música (CD 15)', variantes: 'Alaúde (35 PO, 1 kg), Flauta (2 PO, 0,5 kg), Flauta de Pan (12 PO, 1 kg), Gaita de Foles (30 PO, 3 kg), Lira (30 PO, 1 kg), Oboé (2 PO, 0,5 kg), Tambor (6 PO, 1,5 kg), Trombeta (3 PO, 1 kg), Violino (30 PO, 0,5 kg), Xilofone (25 PO, 5 kg)' },
  { nome: 'Kit de Disfarce', custo: '25 PO', peso: '1,5 kg', atributo: 'Carisma', usarObjeto: 'Aplicar maquiagem (CD 10)', fabricacao: 'Fantasia' },
  { nome: 'Kit de Falsificação', custo: '15 PO', peso: '2,5 kg', atributo: 'Destreza', usarObjeto: 'Imitar 10 ou menos palavras escritas de outra pessoa (CD 15) ou duplicar um selo de cera (CD 20)' },
  { nome: 'Kit de Herbalismo', custo: '5 PO', peso: '1,5 kg', atributo: 'Inteligência', usarObjeto: 'Identificar uma planta (CD 10)', fabricacao: 'Antitoxina, Kit de Curandeiro, Poção de Cura, Vela' },
  { nome: 'Kit de Jogos', custo: 'Varia', peso: '—', atributo: 'Sabedoria', usarObjeto: 'Discernir se alguém está trapaceando (CD 10) ou ganhar o jogo (CD 20)', variantes: 'Dados (1 PP), Xadrez-do-Dragão (1 PO), Baralho (5 PP), Conjunto do Jogo dos Três Dragões (1 PO)' },
  { nome: 'Kit de Veneno', custo: '50 PO', peso: '1 kg', atributo: 'Inteligência', usarObjeto: 'Detectar um objeto envenenado (CD 10)', fabricacao: 'Veneno Básico' },
];

/**
 * Constrói as 25 entidades `equipment` de ferramenta a partir de
 * `TOOLS_TABLE` (ver comentário da seção acima).
 * @returns {object[]}
 */
function construirFerramentas() {
  return TOOLS_TABLE.map((t) => {
    const { cost } = parseCusto(t.custo);
    const partesDescricao = [`Atributo: ${t.atributo}.`, `Usar Objeto: ${t.usarObjeto}.`];
    if (t.fabricacao) partesDescricao.push(`Fabricação: ${t.fabricacao}.`);
    if (t.variantes) partesDescricao.push(`Variantes: ${t.variantes}.`);
    return buildEquipmentEntity({
      name: t.nome,
      category: 'Ferramenta',
      weight: parsePeso(t.peso),
      cost,
      description: partesDescricao.join(' '),
    });
  });
}

// -----------------------------------------------------------------------
// SERVIÇOS — dados/equipamento/servicos.json (`tabelas[]` estruturado)
// -----------------------------------------------------------------------

/**
 * Máquina de estado de agrupamento de subgrupo, compartilhada por
 * `converterTabelaItemCusto` (serviços) e `construirMontariasVeiculos`
 * (arreios): uma linha com custo vazio é um CABEÇALHO de subgrupo (ex.:
 * "Alojamento por Dia", "Sela"), mas só as linhas seguintes cujo NOME está
 * na lista de membros conhecidos daquele cabeçalho pertencem ao grupo — a
 * primeira linha cujo nome não é um membro conhecido encerra o grupo
 * imediatamente (reseta o estado), mesmo que nenhum novo cabeçalho tenha
 * aparecido ainda.
 *
 * Sem essa checagem de pertencimento, "tudo depois de um cabeçalho até o
 * próximo cabeçalho" mis-agrupava linhas legadas não relacionadas que
 * aparecem intercaladas sem cabeçalho próprio — ex.: em
 * `dados/equipamento/servicos.json#tabelas[0]`, "Cerveja (caneca)"/"Pão
 * (fatia)"/"Queijo (fatia)" vêm logo após as 6 linhas de "Alojamento por
 * Dia" mas NÃO são preços de hospedagem, e em
 * `dados/equipamento/montarias_veiculos.json#tabelas[1]`, "Trenó"/"Vagão"
 * vêm logo após as 3 linhas de "Sela" mas não são tipos de sela.
 * @param {Record<string, string[]>} membrosPorGrupo mapa cabeçalho -> lista de nomes de linha que pertencem a esse subgrupo (autorado à mão, lendo a tabela legada linha a linha — não inferido)
 * @returns {{registrarCabecalho(nome: string): void, resolverNome(nomeBase: string): string}}
 */
function criarAgrupadorDeSubgrupo(membrosPorGrupo) {
  let grupoAtual;
  let membrosAtuais;
  return {
    registrarCabecalho(nome) {
      const membros = membrosPorGrupo[nome];
      if (!membros) {
        throw new Error(`migrate-spells-equipment: cabeçalho de subgrupo desconhecido "${nome}" — adicione seus membros em membrosPorGrupo antes de gerar entidades.`);
      }
      grupoAtual = nome;
      membrosAtuais = new Set(membros);
    },
    resolverNome(nomeBase) {
      if (grupoAtual && membrosAtuais.has(nomeBase)) {
        return `${grupoAtual} — ${nomeBase}`;
      }
      // Linha fora do grupo conhecido: encerra o agrupamento agora (não só
      // no próximo cabeçalho) e devolve o nome sem prefixo.
      grupoAtual = undefined;
      membrosAtuais = undefined;
      return nomeBase;
    },
  };
}

// Membros conhecidos de cada subgrupo de
// `dados/equipamento/servicos.json#tabelas[0]` (autorado à mão, lendo a
// tabela linha a linha) — os mesmos 6 níveis de despesa se repetem em
// "Alojamento por Dia" e "Refeições" com custos diferentes; "Vinho
// (garrafa)" tem seu próprio par Comum/Bom.
const GRUPO_MEMBROS_SERVICOS_HOSPEDAGEM = {
  'Alojamento por Dia': ['Desvalido', 'Pobre', 'Modesto', 'Confortável', 'Abastado', 'Aristocrático'],
  'Refeições': ['Desvalido', 'Pobre', 'Modesto', 'Confortável', 'Abastado', 'Aristocrático'],
  'Vinho (garrafa)': ['Comum', 'Bom'],
};

/**
 * Converte uma tabela `{cabecalhos:["Item","Custo"], dados:[...]}` em
 * entidades `equipment`, tratando linhas com `Custo === ""` como cabeçalho
 * de subgrupo (ver `criarAgrupadorDeSubgrupo`). Nenhuma linha é descartada
 * silenciosamente: toda linha com custo não-vazio vira uma entidade, e
 * `membrosPorGrupo` é obrigatório sempre que a tabela tiver algum
 * cabeçalho de subgrupo (linha de custo vazio) — sem entrada correspondente
 * lança, em vez de agrupar tudo silenciosamente (mesmo espírito de falha
 * alta e cedo já usado pelas demais tabelas de tradução deste arquivo).
 * @param {{cabecalhos:string[], dados: object[]}} tabela
 * @param {string} categoria
 * @param {Record<string, string[]>} [membrosPorGrupo]
 * @returns {object[]}
 */
function converterTabelaItemCusto(tabela, categoria, membrosPorGrupo = {}) {
  const [colunaItem, colunaCusto] = tabela.cabecalhos;
  const entidades = [];
  const agrupador = criarAgrupadorDeSubgrupo(membrosPorGrupo);
  for (const linha of tabela.dados) {
    const custoTexto = linha[colunaCusto] ?? '';
    if (custoTexto.trim() === '') {
      agrupador.registrarCabecalho(linha[colunaItem]);
      continue;
    }
    const { cost, suffix } = parseCusto(custoTexto);
    const nome = agrupador.resolverNome(linha[colunaItem]);
    entidades.push(buildEquipmentEntity({ name: nome, category: categoria, cost, description: suffix ? `Custo: ${custoTexto}.` : undefined }));
  }
  return entidades;
}

/**
 * Constrói as entidades `equipment` de `dados/equipamento/servicos.json`:
 * despesas de estilo de vida/hospedagem/comida, viagem, trabalhadores e
 * conjuração sob encomenda — as 4 tabelas estruturadas do legado.
 * @returns {Promise<object[]>}
 */
async function construirServicos() {
  const legado = JSON.parse(await readFile(path.join(legacyEquipamentoDir, 'servicos.json'), 'utf8'));
  const [hospedagem, viagem, trabalhadores, conjuracao] = legado.tabelas;

  const entidadesHospedagem = converterTabelaItemCusto(hospedagem, 'Serviço', GRUPO_MEMBROS_SERVICOS_HOSPEDAGEM);
  const entidadesViagem = converterTabelaItemCusto(viagem, 'Serviço');
  const entidadesTrabalhadores = converterTabelaItemCusto(trabalhadores, 'Serviço');

  const entidadesConjuracao = conjuracao.dados.map((linha) => {
    const { cost } = parseCusto(linha.Custo);
    return buildEquipmentEntity({
      name: `Conjuração sob Encomenda — Círculo ${linha['Círculo da Magia']}`,
      category: 'Serviço',
      cost,
      description: `Disponibilidade: ${linha.Disponibilidade}.`,
    });
  });

  return [...entidadesHospedagem, ...entidadesViagem, ...entidadesTrabalhadores, ...entidadesConjuracao];
}

// -----------------------------------------------------------------------
// MONTARIAS E VEÍCULOS — dados/equipamento/montarias_veiculos.json
// (`tabelas[]` estruturado)
// -----------------------------------------------------------------------

/**
 * Constrói as entidades `equipment` de
 * `dados/equipamento/montarias_veiculos.json`: montarias/animais de carga
 * (capacidade de carga em vez de peso próprio — vai para `description`, o
 * schema de equipamento não tem um campo de capacidade de carga),
 * arreios/veículos de tração (com o mesmo padrão de subgrupo "Sela" da
 * função de serviços) e embarcações (várias colunas mecânicas sem campo
 * próprio no schema — preservadas em `description`, campo de apresentação).
 * @returns {Promise<object[]>}
 */
async function construirMontariasVeiculos() {
  const legado = JSON.parse(await readFile(path.join(legacyEquipamentoDir, 'montarias_veiculos.json'), 'utf8'));
  const [montarias, arreios, embarcacoes] = legado.tabelas;

  const entidadesMontarias = montarias.dados.map((linha) => {
    const { cost } = parseCusto(linha.Custo);
    return buildEquipmentEntity({
      name: linha.Item,
      category: 'Montaria',
      cost,
      description: `Capacidade de Carga: ${linha['Capacidade de Carga']}.`,
    });
  });

  // "Sela" é o único cabeçalho de subgrupo desta tabela (linha com Custo
  // vazio); "Trenó"/"Vagão" vêm logo depois de seus 3 membros mas NÃO são
  // tipos de sela (ver comentário de `criarAgrupadorDeSubgrupo`).
  const entidadesArreios = [];
  const agrupadorArreios = criarAgrupadorDeSubgrupo({ Sela: ['Exótica', 'Militar', 'Viagem'] });
  for (const linha of arreios.dados) {
    const custoTexto = linha.Custo ?? '';
    if (custoTexto.trim() === '') {
      agrupadorArreios.registrarCabecalho(linha.Item);
      continue;
    }
    const { cost } = parseCusto(custoTexto);
    const nome = agrupadorArreios.resolverNome(linha.Item);
    entidadesArreios.push(buildEquipmentEntity({ name: nome, category: 'Veículo/Arreio', weight: parsePeso(linha.Peso), cost }));
  }

  const entidadesEmbarcacoes = embarcacoes.dados.map((linha) => {
    const { cost } = parseCusto(linha.Custo);
    return buildEquipmentEntity({
      name: linha.Embarcação,
      category: 'Veículo',
      cost,
      description: `Deslocamento: ${linha.Deslocamento}. Tripulação: ${linha.Tripulação}. Passageiros: ${linha.Passageiros}. Carga: ${linha['Carga (Toneladas)']} toneladas. CA: ${linha.CA}. PV: ${linha.PV}. Limiar de Dano: ${linha['Limiar de Dano']}.`,
    });
  });

  return [...entidadesMontarias, ...entidadesArreios, ...entidadesEmbarcacoes];
}

// -----------------------------------------------------------------------
// CRIATURAS — dados/apendices/criaturas.json (51 criaturas)
// -----------------------------------------------------------------------

const CREATURE_SIZE_MAP = {
  Minúsculo: 'tiny',
  Minúscula: 'tiny',
  Pequeno: 'small',
  Pequena: 'small',
  Médio: 'medium',
  Média: 'medium',
  Grande: 'large',
  Enorme: 'huge',
  Gigantesco: 'gargantuan',
  Gigantesca: 'gargantuan',
};

/**
 * Extrai `{size, creatureType}` de `tipo_tamanho` legado ("Fera Grande, Sem
 * Alinhamento", "Ínfero Minúsculo (Diabo), Ordeiro e Mau") — o alinhamento
 * (depois da vírgula) não tem campo próprio no schema de criatura e fica só
 * em `description` (via `texto_completo`, já preservado verbatim).
 * @param {string} texto
 * @returns {{size:string, creatureType:string}}
 */
export function parseTipoTamanhoCriatura(texto) {
  const match = /^(.+?)\s+(Minúsculo|Minúscula|Pequeno|Pequena|Médio|Média|Grande|Enorme|Gigantesco|Gigantesca)(\s*\([^)]+\))?,/.exec(texto);
  if (!match) throw new Error(`migrate-spells-equipment: tipo_tamanho de criatura legado não reconhecido: "${texto}".`);
  const [, tipoBase, tamanhoLegado, subtipoParenteses] = match;
  return { size: CREATURE_SIZE_MAP[tamanhoLegado], creatureType: subtipoParenteses ? `${tipoBase}${subtipoParenteses}` : tipoBase };
}

/**
 * Converte o "nd" legado ("1/4 (XP 50; BP +2)") em um número de Nível de
 * Desafio (fração decimal, ex.: 0.25) — `challengeRating` do schema é
 * `number`, não uma string fracionária.
 * @param {string} texto
 * @returns {number}
 */
export function parseNivelDesafio(texto) {
  const match = /^(\d+)(?:\/(\d+))?/.exec(texto.trim());
  if (!match) throw new Error(`migrate-spells-equipment: ND de criatura legado não reconhecido: "${texto}".`);
  return match[2] ? Number(match[1]) / Number(match[2]) : Number(match[1]);
}

/**
 * Constrói as 51 entidades `creature` de
 * `dados/apendices/criaturas.json#criaturas[]`. Todo campo informativo hoje
 * devolvido por `getCriaturas()` (atributos, perícias, sentidos, idiomas,
 * traços, ações, iniciativa, deslocamento) é preservado verbatim em
 * `description` via `texto_completo` — nenhum desses campos tem um slot
 * próprio no schema (`unevaluatedProperties:false`), e nada disso é uma
 * regra mecânica automatizável, então nada é promovido a efeito estruturado
 * além dos 5 campos que o schema realmente modela.
 * @returns {Promise<object[]>}
 */
async function construirCriaturas() {
  const legado = JSON.parse(await readFile(path.join(legacyApendicesDir, 'criaturas.json'), 'utf8'));
  return legado.criaturas.map((c) => {
    const { size, creatureType } = parseTipoTamanhoCriatura(c.tipo_tamanho);
    const pvMatch = /^(\d+)/.exec(c.pv);
    if (!pvMatch) throw new Error(`migrate-spells-equipment: PV de criatura legado não reconhecido: "${c.pv}" (criatura "${c.nome}").`);
    const caMatch = /^(\d+)/.exec(c.ca);
    if (!caMatch) throw new Error(`migrate-spells-equipment: CA de criatura legada não reconhecida: "${c.ca}" (criatura "${c.nome}").`);
    return {
      id: creatureId(c.nome),
      type: 'creature',
      schemaVersion: SCHEMA_VERSION,
      name: c.nome,
      description: c.texto_completo,
      source: { book: SOURCE_BOOK },
      size,
      creatureType,
      challengeRating: parseNivelDesafio(c.nd),
      armorClass: Number(caMatch[1]),
      hitPoints: Number(pvMatch[1]),
    };
  });
}

// -----------------------------------------------------------------------
// GLOSSÁRIO — dados/apendices/glossario.json (154 termos)
// -----------------------------------------------------------------------

/**
 * Constrói as 154 entidades `glossary-entry` de
 * `dados/apendices/glossario.json#termos[]`. `term`/`definition` são o
 * `nome`/`descricao` legados verbatim — glossário é, por definição
 * (`glossary-entry.schema.json`), texto informativo "sem impacto mecânico
 * direto"; não há nada a estruturar além disso.
 * @returns {Promise<object[]>}
 */
async function construirGlossario() {
  const legado = JSON.parse(await readFile(path.join(legacyApendicesDir, 'glossario.json'), 'utf8'));
  return legado.termos.map((t) => ({
    id: glossaryId(t.nome),
    type: 'glossary-entry',
    schemaVersion: SCHEMA_VERSION,
    name: t.nome,
    source: { book: SOURCE_BOOK },
    term: t.nome,
    definition: t.descricao,
  }));
}

// -----------------------------------------------------------------------
// Orquestração: monta todos os catálogos + o fragmento de índice de staging.
// -----------------------------------------------------------------------

/**
 * Monta, em memória, todos os catálogos desta tarefa: 10 arquivos de nível
 * de magia + 8 listas de classe + 1 índice mestre de magias, armas,
 * armaduras, itens de aventura, ferramentas, serviços, montarias/veículos,
 * criaturas e glossário — mais o array de "arquivo -> coleção" usado tanto
 * para `--write`/`--check` quanto para o fragmento de índice.
 * @returns {Promise<{arquivos: Array<{relPath:string, colecao:object}>}>}
 */
export async function construirCatalogos() {
  const { levelFiles, allSpells, byName } = await construirMagias();
  if (allSpells.length !== 391) throw new Error(`migrate-spells-equipment: esperava 391 magias, encontrado ${allSpells.length}.`);

  const { byClassFiles, indexFile } = await construirListasDeClasse(byName);

  const armas = await construirArmas();
  if (armas.length !== 38) throw new Error(`migrate-spells-equipment: esperava 38 armas, encontrado ${armas.length}.`);

  const armaduras = await construirArmaduras();
  if (armaduras.length !== 13) throw new Error(`migrate-spells-equipment: esperava 13 armaduras, encontrado ${armaduras.length}.`);

  const itensDeAventura = await construirItensDeAventura();
  const ferramentas = construirFerramentas();
  const servicos = await construirServicos();
  const montariasVeiculos = await construirMontariasVeiculos();

  const criaturas = await construirCriaturas();
  if (criaturas.length !== 51) throw new Error(`migrate-spells-equipment: esperava 51 criaturas, encontrado ${criaturas.length}.`);

  const glossario = await construirGlossario();
  if (glossario.length !== 154) throw new Error(`migrate-spells-equipment: esperava 154 termos de glossário, encontrado ${glossario.length}.`);

  const arquivos = [
    ...levelFiles,
    indexFile,
    ...byClassFiles,
    { relPath: 'equipment/weapons.json', colecao: { schemaVersion: SCHEMA_VERSION, type: 'weapon', items: armas } },
    { relPath: 'equipment/armor.json', colecao: { schemaVersion: SCHEMA_VERSION, type: 'armor', items: armaduras } },
    { relPath: 'equipment/adventuring-gear.json', colecao: { schemaVersion: SCHEMA_VERSION, type: 'equipment', items: itensDeAventura } },
    { relPath: 'equipment/tools.json', colecao: { schemaVersion: SCHEMA_VERSION, type: 'equipment', items: ferramentas } },
    { relPath: 'equipment/services.json', colecao: { schemaVersion: SCHEMA_VERSION, type: 'equipment', items: servicos } },
    { relPath: 'equipment/mounts-vehicles.json', colecao: { schemaVersion: SCHEMA_VERSION, type: 'equipment', items: montariasVeiculos } },
    { relPath: 'appendices/creatures.json', colecao: { schemaVersion: SCHEMA_VERSION, type: 'creature', items: criaturas } },
    { relPath: 'appendices/glossary.json', colecao: { schemaVersion: SCHEMA_VERSION, type: 'glossary-entry', items: glossario } },
  ];

  // Nenhum id duplicado entre TODOS os arquivos de equipamento (itens de
  // aventura, munição, ferramentas, serviços, montarias/veículos podem, em
  // tese, colidir de slug) — falha alta e cedo, mesma regra de
  // `build-index.mjs#registerEntry`.
  const idsVistos = new Map();
  for (const { relPath, colecao } of arquivos) {
    for (const item of colecao.items) {
      if (idsVistos.has(item.id)) {
        throw new Error(`migrate-spells-equipment: id duplicado "${item.id}" em "${relPath}" (já em "${idsVistos.get(item.id)}").`);
      }
      idsVistos.set(item.id, relPath);
    }
  }

  return { arquivos };
}

/**
 * Fragmento de índice de staging, no mesmo formato que `build-index.mjs`
 * produziria se `spell`/`spell-list`/`weapon`/`armor`/`equipment`/
 * `creature`/`glossary-entry` já fossem tipos ativos no manifesto (mesmo
 * padrão de `migrate-classes.mjs`/`migrate-origins-feats.mjs`).
 * @param {{arquivos: Array<{relPath:string, colecao:object}>}} catalogos
 * @returns {{schemaVersion: string, entries: object[]}}
 */
export function construirFragmentoDeIndice(catalogos) {
  const entries = [];
  for (const { relPath, colecao } of catalogos.arquivos) {
    colecao.items.forEach((item, i) => {
      entries.push({ id: item.id, type: item.type, path: relPath, pointer: `/items/${i}` });
    });
  }
  return { schemaVersion: SCHEMA_VERSION, entries };
}

/**
 * Modo `--check`: reconstrói tudo em memória e compara byte a byte com os
 * catálogos e o fragmento de índice REALMENTE commitados em disco.
 * @param {{arquivos: Array<{relPath:string, colecao:object}>}} catalogos
 * @returns {Promise<{ok: boolean, diffs: string[]}>}
 */
export async function verificarDrift(catalogos) {
  const diffs = [];
  for (const { relPath, colecao } of catalogos.arquivos) {
    const destino = path.join(pkgDir, ...relPath.split('/'));
    const esperado = serializar(colecao);
    try {
      const atual = await readFile(destino, 'utf8');
      if (atual !== esperado) diffs.push(`${path.relative(repoRoot, destino)} está desatualizado em relação ao conversor. Rode --write.`);
    } catch (error) {
      diffs.push(`${path.relative(repoRoot, destino)} não existe (${error.code}). Rode --write.`);
    }
  }

  const fragmento = construirFragmentoDeIndice(catalogos);
  const esperadoFragmento = serializar(fragmento);
  try {
    const atualFragmento = await readFile(indexFragmentPath, 'utf8');
    if (atualFragmento !== esperadoFragmento) diffs.push(`${path.relative(repoRoot, indexFragmentPath)} está desatualizado em relação ao conversor. Rode --write.`);
  } catch (error) {
    diffs.push(`${path.relative(repoRoot, indexFragmentPath)} não existe (${error.code}). Rode --write.`);
  }

  return { ok: diffs.length === 0, diffs };
}

async function main() {
  const write = process.argv.includes('--write');
  const check = process.argv.includes('--check');
  if (write && check) throw new Error('migrate-spells-equipment: use --write OU --check, não os dois.');

  const catalogos = await construirCatalogos();
  const totalItens = catalogos.arquivos.reduce((soma, { colecao }) => soma + colecao.items.length, 0);

  if (write) {
    await mkdir(spellsDir, { recursive: true });
    await mkdir(byClassDir, { recursive: true });
    await mkdir(equipmentDir, { recursive: true });
    await mkdir(appendicesDir, { recursive: true });
    await mkdir(indexFragmentsDir, { recursive: true });

    for (const { relPath, colecao } of catalogos.arquivos) {
      const destino = path.join(pkgDir, ...relPath.split('/'));
      await writeFile(destino, serializar(colecao), 'utf8');
    }
    const fragmento = construirFragmentoDeIndice(catalogos);
    await writeFile(indexFragmentPath, serializar(fragmento), 'utf8');

    process.stdout.write(`migrate-spells-equipment: escrito ${catalogos.arquivos.length} arquivo(s), ${totalItens} entidade(s), fragmento(${fragmento.entries.length}).\n`);
    return;
  }

  if (check) {
    const { ok, diffs } = await verificarDrift(catalogos);
    if (!ok) {
      process.stderr.write(`migrate-spells-equipment: ${diffs.length} arquivo(s) desatualizado(s):\n`);
      for (const diff of diffs) process.stderr.write(`  - ${diff}\n`);
      process.exitCode = 1;
      return;
    }
    process.stdout.write('migrate-spells-equipment: --check OK, catálogos e fragmento de índice refletem o conversor.\n');
    return;
  }

  process.stdout.write(`migrate-spells-equipment: [staging] ${catalogos.arquivos.length} arquivo(s), ${totalItens} entidade(s). Use --write para persistir.\n`);
}

const isDirectCliInvocation =
  typeof process.argv[1] === 'string' &&
  path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1]);
if (isDirectCliInvocation) {
  main().catch((error) => {
    process.stderr.write(`migrate-spells-equipment: erro fatal: ${error.stack || error.message}\n`);
    process.exitCode = 1;
  });
}
