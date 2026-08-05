#!/usr/bin/env node
// `scripts/content/migrate-classes.mjs`: conversor determinístico das 12
// classes (e suas 4 subclasses cada) de D&D 2024 para o formato de conteúdo
// estruturado v1 (`dados/schemas/v1/class.schema.json`, `subclass.schema.json`,
// `feature.schema.json`, `effect.schema.json`).
//
// Fonte de verdade (LEGADO, nunca reescrita por este script):
//   - `site/js/dados-classes.js` (CLASSES_INFO): dado de vida, salvaguardas,
//     perícias, armaduras/armas, atributo de conjuração.
//   - `dados/classes/<slug>.json`: tabela de características por nível
//     (`tabela_caracteristicas`), características de classe (`caracteristicas`)
//     e as 4 subclasses com suas próprias características (`subclasses[]`).
//   - `tests/fixtures/content/dnd2024-id-inventory.json`: ids pré-reservados
//     para as 12 classes e 48 subclasses (Task 7) — este script NUNCA inventa
//     um slug diferente do já reservado.
//
// Modelo de saída: cada classe vira um ARQUIVO-COLEÇÃO
// (`collection.schema.json`: `{schemaVersion, type, items:[...]}`) contendo,
// na ordem: a entidade `class`, todas as entidades `feature` de classe
// (uma por característica de nível), as 4 entidades `subclass`, e todas as
// entidades `feature` de cada subclasse. Cada `feature` referencia seu
// concedente via `grantedBy` (id da classe ou subclasse) + `level` — não há
// um array "featureRefs" na entidade classe/subclasse porque o schema
// vigente (`unevaluatedProperties:false`) não permite esse campo; a relação
// é sempre reconstruída a partir de `grantedBy`. Pelo mesmo motivo, não há
// "officialHandlerRefs" na classe: mecânicas complexas viram um efeito
// individual `{type:"official-handler", handlerId}` dentro do array
// `effects` da entidade (classe ou feature) que a concede.
//
// Uso como CLI:
//   node scripts/content/migrate-classes.mjs
//     Constrói tudo em memória e imprime um resumo (staging, nada é escrito).
//   node scripts/content/migrate-classes.mjs --write
//     Escreve dados/pacotes/dnd2024/classes/<slug>.json para as 12 classes.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { slugify, buildContentId, loadIdInventory } from './content-id-map.mjs';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const legacyClassesDir = path.join(repoRoot, 'dados', 'classes');
const outputClassesDir = path.join(repoRoot, 'dados', 'pacotes', 'dnd2024', 'classes');
const idInventoryPath = path.join(repoRoot, 'tests', 'fixtures', 'content', 'dnd2024-id-inventory.json');
const armasCatalogPath = path.join(repoRoot, 'dados', 'equipamento', 'armas.json');
const armadurasCatalogPath = path.join(repoRoot, 'dados', 'equipamento', 'armaduras.json');

const NAMESPACE = 'dnd2024';
const SCHEMA_VERSION = '1.0.0';
const SOURCE_BOOK = "Livro do Jogador (2024)";

// Ordem canônica dos 12 arquivos legados (mesmo slug usado em
// `dados/classes/<slug>.json` e nos ids pré-reservados em
// `dnd2024-id-inventory.json`).
export const CLASS_SLUGS = [
  'barbaro', 'bardo', 'bruxo', 'clerigo', 'druida', 'feiticeiro',
  'guardiao', 'guerreiro', 'ladino', 'mago', 'monge', 'paladino',
];

// Progressão de conjuração por classe (`class.schema.json#/spellcasting`,
// enum fechado full/half/third/pact/none). Cavaleiro Místico (subclasse de
// Guerreiro) e Trapaceiro Arcano (subclasse de Ladino) são "third-caster" e
// são tratados à parte, na própria subclasse (a classe base não conjura).
const SPELLCASTING_PROGRESSION_BY_SLUG = {
  barbaro: null,
  bardo: 'full',
  bruxo: 'pact',
  clerigo: 'full',
  druida: 'full',
  feiticeiro: 'full',
  guardiao: 'half',
  guerreiro: null,
  ladino: null,
  mago: 'full',
  monge: null,
  paladino: 'half',
};

// Colunas da tabela de características que nunca viram efeito próprio:
// "Nível" e "Bônus de Proficiência" são cobertas pela tabela universal
// `dnd2024:ruleset:core#tables.proficiencyBonusByLevel`; "Características"/
// "Características de Classe" são apenas a lista-resumo, redundante com as
// entidades `feature` geradas a partir de `caracteristicas`.
const COLUMNS_SEMPRE_IGNORADAS = new Set([
  'Nível', 'Bônus de Proficiência', 'Características', 'Características de Classe',
]);

// Cavaleiro Místico (Guerreiro) e Trapaceiro Arcano (Ladino) usam a mesma
// progressão de conjurador 1/3 com espaços próprios (magia de meio-conjurador
// aplicada só a 1/3 dos níveis), tabela extraída de
// `site/js/levelup.js#getCavaleiroMisticoEspacos` (ground truth já usada em
// produção pelo sistema de level-up legado).
const THIRD_CASTER_SLOT_TABLE = {
  3: { 1: 2 }, 4: { 1: 3 },
  7: { 1: 4, 2: 2 }, 8: { 1: 4, 2: 2 },
  10: { 1: 4, 2: 3 },
  13: { 1: 4, 2: 3, 3: 2 },
  16: { 1: 4, 2: 3, 3: 3 },
  19: { 1: 4, 2: 3, 3: 3, 4: 1 },
};

/**
 * Lê e faz o parse de um arquivo JSON legado de classe.
 * @param {string} slug
 * @returns {Promise<object>}
 */
async function readLegacyClass(slug) {
  const raw = await readFile(path.join(legacyClassesDir, `${slug}.json`), 'utf8');
  return JSON.parse(raw);
}

/**
 * Converte um nome de atributo em português ("Força") no ContentId de
 * `ability` correspondente (`dnd2024:ability:forca`).
 * @param {string} nomeAtributo
 * @returns {string}
 */
function abilityId(nomeAtributo) {
  return buildContentId(NAMESPACE, 'ability', nomeAtributo.trim());
}

/**
 * Converte um nome de perícia em português no ContentId de `skill`
 * correspondente.
 * @param {string} nomePericia
 * @returns {string}
 */
function skillId(nomePericia) {
  return buildContentId(NAMESPACE, 'skill', nomePericia.trim());
}

/**
 * Separa um texto de "atributo primário" que pode citar 1 ou 2 atributos
 * unidos por " e "/" ou " (ex.: "Destreza e Sabedoria", "Força ou Destreza")
 * em uma lista de ids de `ability`. Nunca usa o texto como regra além de
 * extrair os nomes de atributo literais que ele cita.
 * @param {string} texto
 * @returns {string[]}
 */
function parsePrimaryAbilities(texto) {
  return texto
    .split(/\s+(?:e|ou)\s+/i)
    .map((parte) => parte.trim())
    .filter(Boolean)
    .map(abilityId);
}

/**
 * Carrega o catálogo REAL de armas/armaduras (`dados/equipamento/armas.json`,
 * `dados/equipamento/armaduras.json`) — a mesma fonte de verdade usada pela
 * ficha legada — para resolver categorias de treinamento
 * ("Leve"/"Marcial"/...) em itens concretos, em vez de deixar isso como
 * prosa solta.
 * @returns {Promise<{armas: object[], armaduras: object[]}>}
 */
async function carregarCatalogoEquipamento() {
  const armas = JSON.parse(await readFile(armasCatalogPath, 'utf8')).armas;
  const armaduras = JSON.parse(await readFile(armadurasCatalogPath, 'utf8')).armaduras;
  return { armas, armaduras };
}

/**
 * Resolve uma categoria de treinamento de armadura (`CLASSES_INFO.armaduras`,
 * ex.: `["Leve","Média","Escudo"]`) na lista de NOMES de armadura do
 * catálogo real que pertencem a essas categorias — `armaduras.json#categoria`
 * já usa exatamente os mesmos rótulos ("Leve"/"Média"/"Pesada"/"Escudo").
 * @param {string[]} categorias
 * @param {object[]} catalogoArmaduras
 * @returns {string[]}
 */
function nomesDeArmaduraPorCategoria(categorias, catalogoArmaduras) {
  return catalogoArmaduras.filter((a) => categorias.includes(a.categoria)).map((a) => a.nome);
}

/**
 * Resolve um texto de treinamento com armas (`CLASSES_INFO.armas`, ex.:
 * "Simples", "Marcial", "Marcial (Acuidade)", "Marcial (Leve)") na lista de
 * NOMES de arma do catálogo real que pertencem a essa categoria — e, quando
 * há um qualificador entre parênteses, filtra ainda pela propriedade citada
 * (`armas.json#propriedades`, ex.: "Acuidade, Arremesso ..., Leve"), a mesma
 * regra de maestria condicional já usada na ficha legada.
 * @param {string} texto
 * @param {object[]} catalogoArmas
 * @returns {string[]}
 */
function nomesDeArmaPorTexto(texto, catalogoArmas) {
  const m = texto.match(/^(Simples|Marcial)(?:\s*\(([^)]+)\))?$/);
  if (!m) return [];
  const [, base, qualificador] = m;
  let filtrado = catalogoArmas.filter((a) =>
    base === 'Simples' ? a.categoria.includes('Simples') : a.categoria.includes('Marciais'),
  );
  if (qualificador) {
    const propRegex = new RegExp(`\\b${qualificador}\\b`, 'i');
    filtrado = filtrado.filter((a) => propRegex.test(a.propriedades || ''));
  }
  return filtrado.map((a) => a.nome);
}

/**
 * Constrói um efeito `proficiency` para um item de arma/armadura já
 * reservado no inventário de ids de staging (`dnd2024-id-inventory.json`).
 * Lança se o nome não estiver reservado — preferível a inventar um id.
 * @param {string} nome
 * @param {'weapon'|'armor'} tipo
 * @param {object} idInventory
 * @param {string} idEfeito
 * @returns {object}
 */
function efeitoProficienciaItemReservado(nome, tipo, idInventory, idEfeito) {
  const reservado = idInventory.reserved[tipo].find((e) => e.name === nome);
  if (!reservado) {
    throw new Error(`migrate-classes: item "${nome}" (tipo "${tipo}") não está reservado em dnd2024-id-inventory.json.`);
  }
  return { id: idEfeito, type: 'proficiency', target: reservado.id, level: 'proficient' };
}

// Aliases de nome ENTRE o texto de equipamento inicial legado
// (`dados/classes/<slug>.json#tracos_basicos["Equipamento Inicial"]`) e o
// nome reservado em `dnd2024-id-inventory.json` — só para os casos em que a
// fonte legada usa uma variante de nome já documentada em OUTRO lugar do
// próprio código-fonte legado (não uma adivinhação nova): o comentário de
// `site/js/pages/creator.js#KITS_EXPANSAO` já registra "Kit de Explorador"
// (Druida) como alias de "Kit de Explorador de Masmorras".
const ALIASES_ITEM_EQUIPAMENTO = new Map([
  ['kit de explorador', 'Kit de Explorador de Masmorras'],
]);

/**
 * Tenta resolver um fragmento de texto de item de equipamento inicial
 * (ex.: "Foco Arcano (orbe)", "Kit de Aventureiro", "4 Machadinhas",
 * "Armadura de Couro") em `{quantidade, itemId}` contra os ids reservados de
 * weapon/armor/equipment. Nunca inventa um id: se não conseguir resolver com
 * confiança (nome exato, nome sem sufixo parentético, singular/plural
 * simples, o alias documentado acima, ou o prefixo "Armadura de " — o
 * catálogo reserva armaduras pelo nome curto, ex. `dnd2024:armor:couro`
 * para "Couro", mas o texto de equipamento inicial legado sempre escreve
 * "Armadura de Couro"/"Armadura de Couro Batido"), devolve `null` e o
 * fragmento permanece só no `label` textual da opção — mais honesto do que
 * uma referência forçada/errada.
 * @param {{quantidade: number, texto: string}} fragmento
 * @param {object} idInventory
 * @returns {{quantidade: number, itemId: string, type: string}|null}
 */
function resolverItemDeEquipamentoInicial(fragmento, idInventory) {
  const semParenteses = fragmento.texto.replace(/\s*\([^)]*\)\s*$/, '').trim();
  const candidatos = [fragmento.texto, semParenteses];
  const semS = semParenteses.endsWith('s') ? semParenteses.slice(0, -1) : null;
  if (semS) candidatos.push(semS);
  const semPrefixoArmadura = semParenteses.replace(/^Armadura de\s+/i, '').trim();
  if (semPrefixoArmadura !== semParenteses) candidatos.push(semPrefixoArmadura);
  const aliasado = ALIASES_ITEM_EQUIPAMENTO.get(normalizarNomeCaracteristica(semParenteses));
  if (aliasado) candidatos.push(aliasado);

  for (const tipo of ['weapon', 'armor', 'equipment']) {
    for (const candidato of candidatos) {
      const reservado = idInventory.reserved[tipo].find((e) => e.name === candidato);
      if (reservado) return { quantidade: fragmento.quantidade, itemId: reservado.id, type: tipo };
    }
  }
  return null;
}

/**
 * Separa o texto de UMA opção de equipamento inicial (já sem o prefixo
 * "(A)"/"(B)"/"(C)") em fragmentos `{quantidade, texto}` — trata a vírgula
 * como separador e, no último item da lista, também a conjunção " e "
 * (padrão fixo observado nas 12 classes: "item1, item2 e itemN").
 * @param {string} texto
 * @returns {Array<{quantidade: number, texto: string}>}
 */
function separarFragmentosDeEquipamento(texto) {
  const partes = texto.split(',').map((s) => s.trim()).filter(Boolean);
  if (partes.length > 0) {
    const ultimo = partes.pop();
    partes.push(...ultimo.split(/\s+e\s+/).map((s) => s.trim()).filter(Boolean));
  }
  return partes.map((segmento) => {
    const m = segmento.match(/^(\d+)\s+(.+)$/);
    return m ? { quantidade: parseInt(m[1], 10), texto: m[2].trim() } : { quantidade: 1, texto: segmento };
  });
}

/**
 * Agrupa um mapa nível->valor em "runs" contíguas de valor idêntico, cada
 * uma como `{min, max, value}` (`max` omitido na última run, em aberto até
 * o fim da progressão). Usado para não repetir um efeito idêntico em todo
 * nível em que o valor não mudou — cada run vira um único efeito
 * `when:{kind:"level", min, max?}`.
 *
 * PRECONDIÇÃO verificada em runtime (lança se violada): a última chave de
 * `porNivel` deve ser o nível 20 — só assim é seguro omitir `max` da última
 * run (valor "em aberto até o fim da progressão"). Confirmado manualmente
 * contra as 12 tabelas legadas que essa precondição vale para toda coluna
 * que passa por esta função (a única exceção — as colunas "1".."9" de
 * espaços de magia do Bruxo, que param de crescer antes do nível 20 porque
 * a Magia de Pacto tem seu próprio teto de círculo — é tratada à parte, por
 * `gerarEfeitoMagiaDePacto`, e nunca chega a passar por aqui).
 * @param {Map<number, *>} porNivel
 * @returns {Array<{min: number, max?: number, value: *}>}
 */
function condensarRuns(porNivel) {
  const niveis = [...porNivel.keys()].sort((a, b) => a - b);
  if (niveis.length > 0 && niveis[niveis.length - 1] !== 20) {
    throw new Error(
      `migrate-classes: condensarRuns() recebeu uma coluna cujo último nível populado é ${niveis[niveis.length - 1]}, não 20 — ` +
        'a regra de "última run em aberto até o nível 20" não é segura para esta coluna; trate-a explicitamente antes de chamar condensarRuns().',
    );
  }
  const runs = [];
  for (const nivel of niveis) {
    const valor = porNivel.get(nivel);
    const ultima = runs[runs.length - 1];
    if (ultima && ultima.value === valor && ultima._proximoEsperado === nivel) {
      ultima.max = nivel;
      ultima._proximoEsperado = nivel + 1;
      continue;
    }
    runs.push({ min: nivel, max: nivel, value: valor, _proximoEsperado: nivel + 1 });
  }
  // A última run de cada progressão fica em aberto (sem "max") — o valor
  // vale até o nível 20, e omitir "max" evita ter que saber de antemão até
  // que nível a classe existe.
  if (runs.length > 0) {
    delete runs[runs.length - 1].max;
  }
  for (const run of runs) delete run._proximoEsperado;
  return runs;
}

/**
 * Constrói a expressão de condição `when:{kind:"level", min, max?}` a partir
 * de uma run de `condensarRuns`.
 * @param {{min: number, max?: number}} run
 * @returns {object}
 */
function whenLevel(run) {
  const when = { kind: 'level', min: run.min };
  if (run.max !== undefined) when.max = run.max;
  return when;
}

/**
 * Extrai, para cada nível da `tabela_caracteristicas`, o mapa coluna->valor
 * numérico (ignorando células vazias "—"/"-").
 * @param {object[]} tabela
 * @returns {Map<string, Map<number, number|string>>} coluna -> (nível -> valor)
 */
function coletarColunas(tabela) {
  const porColuna = new Map();
  for (const linha of tabela) {
    const nivel = parseInt(linha['Nível'], 10);
    for (const [coluna, valorBruto] of Object.entries(linha)) {
      if (COLUMNS_SEMPRE_IGNORADAS.has(coluna)) continue;
      const valor = (valorBruto ?? '').toString().trim();
      if (valor === '' || valor === '—' || valor === '-') continue;
      if (!porColuna.has(coluna)) porColuna.set(coluna, new Map());
      const numerico = Number(valor);
      porColuna.get(coluna).set(nivel, Number.isFinite(numerico) && /^-?\d+$/.test(valor) ? numerico : valor);
    }
  }
  return porColuna;
}

// Colunas cujo significado é um BÔNUS/MODIFICADOR (não um recurso consumível
// com limite de usos) — viram `effect.type:"modifier"`, não `"resource"`.
// Mapeado por nome de coluna EXATO como aparece nos arquivos legados
// (`dados/classes/*.json`), reaproveitado por qualquer classe que tenha essa
// coluna (a mesma coluna, com o mesmo nome, sempre representa a mesma
// mecânica em todo o jogo).
const COLUNAS_MODIFICADOR = new Map([
  ['Dano da Fúria', 'damage.rage-bonus'],
  ['Ataque Furtivo', 'damage.sneak-attack'],
  ['Artes Marciais', 'damage.martial-arts-die'],
  ['Movimento sem Armadura', 'speed.unarmored-movement'],
]);

/**
 * Gera os efeitos declarativos (`resource`/`modifier`) derivados das
 * colunas numéricas/estruturadas de `tabela_caracteristicas`, condensando
 * cada coluna em runs por nível. Cada valor vem diretamente de uma célula da
 * tabela — nunca de texto de `descricao` — por isso é seguro tratá-lo como
 * dado estruturado.
 * @param {object[]} tabela
 * @param {{skipColumns?: string[]}} [opcoes]
 * @returns {object[]} lista de efeitos (`effect.schema.json`)
 */
function gerarEfeitosDeColunas(tabela, opcoes = {}) {
  const ignoradas = new Set(opcoes.skipColumns || []);
  const porColuna = coletarColunas(tabela);
  const efeitos = [];
  for (const [coluna, porNivel] of porColuna) {
    if (ignoradas.has(coluna)) continue;
    const runs = condensarRuns(porNivel);
    const alvoModificador = COLUNAS_MODIFICADOR.get(coluna);
    // Uma coluna com DUAS OU MAIS faixas de nível é um "ladder": as faixas se
    // sucedem, nunca se somam. `priority = run.min` deixa a ordenação
    // explícita (faixa de nível maior é aplicada por último) e
    // `stackKey`/`stackable:false` impedem que dois valores da mesma coluna
    // acumulem — tanto em `resource` quanto em `modifier`, porque a semântica
    // de "não acumula" é do DADO, não do tipo de efeito, e o motor filtra por
    // `stackKey` antes de somar/aplicar o `set` vencedor. Coluna de faixa única
    // não recebe nada: a ausência dos campos continua significando
    // "priority 0, sempre acumula".
    const eLadder = runs.length > 1;
    const chaveDeEmpilhamento = slugify(coluna);
    for (const run of runs) {
      if (alvoModificador) {
        efeitos.push({
          id: `${chaveDeEmpilhamento}-${run.min}`,
          type: 'modifier',
          when: whenLevel(run),
          target: alvoModificador,
          operation: 'set',
          value: run.value,
          ...(eLadder ? { priority: run.min, stackKey: chaveDeEmpilhamento, stackable: false } : {}),
        });
      } else {
        efeitos.push({
          id: `${chaveDeEmpilhamento}-${run.min}`,
          type: 'resource',
          when: whenLevel(run),
          resource: chaveDeEmpilhamento,
          max: run.value,
          ...(eLadder ? { priority: run.min, stackKey: chaveDeEmpilhamento, stackable: false } : {}),
        });
      }
    }
  }
  return efeitos;
}

/**
 * Gera os efeitos de espaços de magia (`spell-slot-N`) a partir das colunas
 * numéricas "1".."9" de conjuradores plenos/meio-conjuradores. Cada célula
 * já é o total de espaços daquele círculo naquele nível — dado estruturado
 * da tabela oficial, não inferido de texto.
 * @param {object[]} tabela
 * @returns {object[]}
 */
function gerarEfeitosDeEspacosDeMagia(tabela) {
  const efeitos = [];
  for (let circulo = 1; circulo <= 9; circulo++) {
    const coluna = String(circulo);
    const porNivel = new Map();
    for (const linha of tabela) {
      const bruta = (linha[coluna] ?? '').toString().trim();
      if (bruta === '' || bruta === '—' || bruta === '-') continue;
      const nivel = parseInt(linha['Nível'], 10);
      porNivel.set(nivel, Number(bruta));
    }
    if (porNivel.size === 0) continue;
    // Mesma regra de ladder de `gerarEfeitosDeColunas`: o total de espaços de
    // um círculo é substituído a cada faixa de nível, nunca somado.
    const runsCirculo = condensarRuns(porNivel);
    const eLadder = runsCirculo.length > 1;
    for (const run of runsCirculo) {
      efeitos.push({
        id: `spell-slot-${circulo}-${run.min}`,
        type: 'resource',
        when: whenLevel(run),
        resource: `spell-slot-${circulo}`,
        max: run.value,
        recovery: 'long-rest',
        ...(eLadder ? { priority: run.min, stackKey: `spell-slot-${circulo}`, stackable: false } : {}),
      });
    }
  }
  return efeitos;
}

// --- Task 20: ladders de recurso das classes marciais ---------------------
//
// Cada entrada é `{resource, degraus: [[min, max|null, valor], ...]}`. O
// `max: null` significa "daqui para cima". `priority` é sempre o nível mínimo
// da faixa e `stackable: false` + `stackKey` garantem que só a faixa mais
// alta vale (mesma convenção da Task 15 para os ladders vindos de coluna).
const LADDERS_MARCIAIS_DE_CLASSE = Object.freeze({
  guerreiro: [
    { resource: 'surto-de-acao', degraus: [[2, 16, 1], [17, null, 2]] },
    { resource: 'indomavel', degraus: [[9, 12, 1], [13, 16, 2], [17, null, 3]] },
  ],
  ladino: [{ resource: 'golpe-de-sorte', degraus: [[20, null, 1]] }],
});

// Ladders de recurso de SUBCLASSE (a proveniência é a subclasse, não a
// classe): Dados de Superioridade do Mestre da Batalha (sheet.js:1130-1133) e
// Dados Psiônicos do Combatente Psíquico / Adaga Espiritual
// (sheet.js:1160-1168 e 2280-2288 — a mesma escada nas duas subclasses).
const DADOS_PSIONICOS_DEGRAUS = Object.freeze([
  [3, 4, 4],
  [5, 8, 6],
  [9, 12, 8],
  [13, 16, 10],
  [17, null, 12],
]);
const LADDERS_MARCIAIS_DE_SUBCLASSE = Object.freeze({
  'Mestre da Batalha': [
    { resource: 'dados-de-superioridade', degraus: [[3, 6, 4], [7, 14, 5], [15, null, 6]] },
  ],
  'Combatente Psíquico': [{ resource: 'dados-psionicos', degraus: DADOS_PSIONICOS_DEGRAUS }],
  'Adaga Espiritual': [{ resource: 'dados-psionicos', degraus: DADOS_PSIONICOS_DEGRAUS }],
});

// --- Task 21: ladders de recurso das classes divinas/primitivas ------------
//
// Mãos Consagradas do Paladino é a ÚNICA reserva das quatro classes desta
// tarefa que o baseline calcula em código (`5 * nivel`,
// `site/js/pages/sheet.js:1984`, commit e43c5ea) em vez de ler de uma coluna
// de `tabela_caracteristicas`. Como é uma função linear do nível, ela é
// totalmente expressável no vocabulário declarativo — uma faixa por nível —
// e por isso vem para o CONTEÚDO, e não para o handler. Assim `class-paladino`
// resolve o teto pelo motor de efeitos da Task 15, exatamente como as demais
// classes, sem reimplementar a tabela.
//
// Os outros recursos das quatro classes (`canalizar-divindade` do Clérigo e do
// Paladino, `forma-selvagem` do Druida, `inimigo-favorito` do Guardião) JÁ vêm
// de coluna e portanto já eram gerados por `gerarEfeitosDeColunas`.
const MAOS_CONSAGRADAS_DEGRAUS = Object.freeze(
  Array.from({ length: 20 }, (_, indice) => {
    const nivel = indice + 1;
    return Object.freeze([nivel, nivel === 20 ? null : nivel, 5 * nivel]);
  }),
);
const LADDERS_DIVINOS_PRIMAIS_DE_CLASSE = Object.freeze({
  paladino: [{ resource: 'maos-consagradas', degraus: MAOS_CONSAGRADAS_DEGRAUS }],
});

// --- Task 22a: ladders de recurso das classes arcanas ----------------------
//
// Três reservas arcanas NÃO vêm de coluna de `tabela_caracteristicas` e o
// baseline as calcula em código:
//
//   - Inspiração de Bardo: `Math.max(1, calcMod(carisma))` usos
//     (`site/js/pages/sheet.js:458-459`, commit e43c5ea). A coluna "Dados de
//     Inspiração" da tabela carrega o DADO (D6..D12), não a contagem de usos —
//     por isso o efeito `resource` `dados-de-inspiracao` já existente NÃO é a
//     reserva gastável, e um recurso próprio (`inspiracao-de-bardo`) precisa
//     ser declarado.
//   - Feitiçaria Inata: 2 usos fixos (`sheet.js:996`).
//   - Restauração Feiticeira/Passos Feéricos/Sorte do Tenebroso/Restaurar
//     Equilíbrio: `Math.max(1, calcMod(carisma))` (`sheet.js:791`, `5924`).
//
// O teto por modificador de atributo é expresso como NOME DE VARIÁVEL
// (`carismaModifierMin1`), resolvido em runtime por `resolveNumericValue`
// contra `context.variables` — que a Task 22a passou a popular de verdade a
// partir do personagem (`domain/character/queries/context-variables.js`).
// Nenhum número de atributo é congelado aqui.
const LUZ_MEDICINAL_DEGRAUS = Object.freeze(
  Array.from({ length: 20 }, (_, indice) => {
    const nivel = indice + 1;
    return Object.freeze([nivel, nivel === 20 ? null : nivel, 1 + nivel]);
  }),
);

const LADDERS_ARCANOS_DE_CLASSE = Object.freeze({
  bardo: [{ resource: 'inspiracao-de-bardo', degraus: [[1, null, 'carismaModifierMin1']] }],
  feiticeiro: [{ resource: 'feiticaria-inata', degraus: [[1, null, 2]] }],
});

// Ladders de recurso de SUBCLASSE arcana (proveniência = subclasse).
const LADDERS_ARCANOS_DE_SUBCLASSE = Object.freeze({
  // sheet.js:806 — `passosFeericosMax: modCar` (nível 3+).
  'Patrono Arquifada': [{ resource: 'passos-feericos', degraus: [[3, null, 'carismaModifierMin1']] }],
  // sheet.js:811 — `luzMedicinalDadosMax: 1 + nivel` (nível 3+).
  'Patrono Celestial': [{ resource: 'luz-medicinal', degraus: LUZ_MEDICINAL_DEGRAUS.slice(2) }],
  // sheet.js:817 — `sorteTenebrosoMax: modCar` (nível 6+, "A Sorte do Próprio Tenebroso").
  'Patrono Ínfero': [{ resource: 'sorte-do-tenebroso', degraus: [[6, null, 'carismaModifierMin1']] }],
  // sheet.js:5924 — `max = Math.max(1, calcMod(carisma))` (nível 3+).
  'Feitiçaria Mecânica': [{ resource: 'restaurar-equilibrio', degraus: [[3, null, 'carismaModifierMin1']] }],
});

/**
 * Expande uma lista de ladders declarados acima em efeitos `resource`.
 * @param {string} chave - slug da classe ou nome da subclasse (só para diagnóstico)
 * @param {Array<{resource: string, degraus: Array<Array<number|null>>}> | undefined} ladders
 * @returns {Array<object>}
 */
function gerarLadderDeRecurso(chave, ladders) {
  void chave;
  const efeitos = [];
  for (const ladder of ladders ?? []) {
    // Faixa ÚNICA não é ladder: sem duas faixas concorrendo não há o que
    // desempilhar, e marcar `stackKey`/`stackable` aqui violaria a convenção
    // da Task 15 ("ausência = sempre acumula", ver dnd2024-classes.test.js).
    const eLadder = ladder.degraus.length > 1;
    for (const [min, max, valor] of ladder.degraus) {
      efeitos.push({
        id: `${ladder.resource}-${min}`,
        type: 'resource',
        when: max === null ? { kind: 'level', min } : { kind: 'level', min, max },
        resource: ladder.resource,
        max: valor,
        ...(eLadder ? { priority: min, stackKey: ladder.resource, stackable: false } : {}),
      });
    }
  }
  return efeitos;
}

/**
 * Constrói o efeito `official-handler` para o Bruxo (Magia de Pacto): todos
 * os espaços de magia são do MESMO círculo simultaneamente (diferente de
 * qualquer outro conjurador), então não cabe no vocabulário declarativo de
 * `spell-slot-N` — é uma mecânica complexa demais para modelagem
 * declarativa, coberta pelo escape-hatch `official-handler` (ver comentário
 * de `effect.schema.json#/$defs/officialHandlerEffect`). `params` guarda a
 * tabela nível->{slots,circulo} extraída diretamente das colunas
 * "Espacos de Magia"/"Nivel do Espaco" da tabela oficial.
 * @param {object[]} tabela
 * @returns {object}
 */
function gerarEfeitoMagiaDePacto(tabela) {
  const porNivel = {};
  for (const linha of tabela) {
    const nivel = parseInt(linha['Nível'], 10);
    const slots = parseInt(linha['Espacos de Magia'], 10);
    const circulo = parseInt(linha['Nivel do Espaco'], 10);
    if (Number.isFinite(slots) && Number.isFinite(circulo)) {
      porNivel[nivel] = { slots, circulo };
    }
  }
  return {
    id: 'magia-de-pacto',
    type: 'official-handler',
    handlerId: 'pact-magic-slots',
    params: { table: porNivel },
  };
}

/**
 * Constrói o efeito `official-handler` de conjuração 1/3 (Cavaleiro
 * Místico/Trapaceiro Arcano), a partir de `THIRD_CASTER_SLOT_TABLE`.
 * @returns {object}
 */
function gerarEfeitoConjuracaoUmTerco() {
  return {
    id: 'conjuracao-um-terco',
    type: 'official-handler',
    handlerId: 'third-caster-slots',
    params: { table: THIRD_CASTER_SLOT_TABLE },
  };
}

/**
 * Constrói o efeito de escolha de perícias de classe
 * (`CLASSES_INFO[classe].pericias_opcoes` + `num_pericias`).
 * `pericias_opcoes === null` significa "qualquer perícia" (Bardo) — nesse
 * caso as opções são as 18 perícias do ruleset.
 * @param {{pericias_opcoes: string[]|null, num_pericias: number}} info
 * @param {string[]} todasPericias
 * @returns {object}
 */
function gerarEfeitoEscolhaPericias(info, todasPericias) {
  const opcoes = info.pericias_opcoes ?? todasPericias;
  return {
    id: 'pericias-de-classe',
    type: 'choice',
    choice: {
      id: 'pericias-de-classe',
      prompt: `Escolha ${info.num_pericias} perícia(s)`,
      min: info.num_pericias,
      max: info.num_pericias,
      options: opcoes.map((nome) => ({
        id: slugify(nome),
        label: nome,
        grants: [{ type: 'proficiency', target: skillId(nome), level: 'proficient' }],
      })),
    },
  };
}

/**
 * Constrói o efeito de escolha de equipamento inicial. O texto legado
 * ("Escolha A ou B: (A) ... ; ou (B) ...") é estruturado em opções
 * rotuladas (`choice.options[].label`), e cada item da opção é resolvido
 * contra os ids de weapon/armor/equipment já RESERVADOS em
 * `dnd2024-id-inventory.json` (391/38/13/82 ids reservados na Task 7
 * exatamente para essa referência de staging — "referências ainda não
 * ativadas são verificadas contra o inventário de ids de staging, nunca
 * ignoradas") — nunca um id inventado. Fragmentos que não resolvem com
 * confiança (quantia em moeda, "à sua escolha", nome sem correspondência
 * reservada) permanecem apenas no `label` textual da opção, nunca
 * silenciosamente descartados.
 * @param {string} slug
 * @param {string} textoEquipamento
 * @param {object} idInventory
 * @param {string[]} avisos array de saída — todo fragmento que não é um
 *   valor em moeda (padrão "N PO", reconhecidamente não-item) e ainda assim
 *   não resolve contra o inventário reservado é reportado aqui, nunca
 *   silenciosamente descartado (mesma regra de `construirEfeitosDeMagiaSemprePreparada`).
 * @returns {object}
 */
function gerarEfeitoEquipamentoInicial(slug, textoEquipamento, idInventory, avisos) {
  const opcoes = [...textoEquipamento.matchAll(/\(([A-C])\)\s*([^;]+?)(?=;|$)/g)]
    .map((m) => ({ letra: m[1], texto: m[2].trim().replace(/\s*ou\s*$/i, '').trim() }));
  return {
    id: 'equipamento-inicial',
    type: 'choice',
    choice: {
      id: 'equipamento-inicial',
      prompt: 'Escolha seu equipamento inicial',
      min: 1,
      max: 1,
      options: opcoes.map((opcao) => {
        const fragmentos = separarFragmentosDeEquipamento(opcao.texto);
        const grants = [];
        for (const fragmento of fragmentos) {
          const resolvido = resolverItemDeEquipamentoInicial(fragmento, idInventory);
          if (!resolvido) {
            // "N PO" é reconhecidamente moeda, não item — não é um gap, não
            // vira aviso. `separarFragmentosDeEquipamento` já separou o "N"
            // para `fragmento.quantidade`, então aqui o texto restante é só
            // "PO". Qualquer outro fragmento não resolvido É um gap real
            // (nome sem correspondência reservada, "à sua escolha", etc.) e
            // precisa ficar visível, não silenciosamente descartado.
            if (fragmento.texto !== 'PO') {
              avisos.push(`${slug}: item de equipamento inicial "${fragmento.texto}" (opção ${opcao.letra}) não resolveu contra nenhum id reservado de weapon/armor/equipment`);
            }
            continue;
          }
          grants.push({
            type: 'grant-item',
            item: resolvido.itemId,
            ...(resolvido.quantidade > 1 ? { quantity: resolvido.quantidade } : {}),
          });
        }
        return { id: `opcao-${opcao.letra.toLowerCase()}`, label: opcao.texto, grants };
      }),
    },
  };
}

/**
 * Constrói o efeito de escolha de subclasse, gated no nível registrado em
 * `NIVEL_SUBCLASSE` (`site/js/dados-classes.js`) — hoje 3 para as 12
 * classes, mas lido de lá (não hardcoded aqui) para que esta função
 * continue correta se essa tabela um dia divergir por classe. As opções
 * apenas rotulam as 4 subclasses; a concessão real da subclasse não está no
 * vocabulário fechado de `effect.schema.json` (não existe "grant-subclass")
 * — quem lê o character record resolve a escolha via o campo `class` das
 * entidades `subclass`, não via `grants`.
 * @param {Array<{id: string, name: string}>} subclasses
 * @param {string} nomeClasse
 * @param {number} nivelSubclasse `NIVEL_SUBCLASSE[nomeClasse]`
 * @returns {object}
 */
function gerarEfeitoEscolhaSubclasse(subclasses, nomeClasse, nivelSubclasse) {
  return {
    id: 'subclasse',
    type: 'choice',
    when: { kind: 'level', min: nivelSubclasse },
    choice: {
      id: 'subclasse',
      prompt: `Escolha sua subclasse de ${nomeClasse}`,
      min: 1,
      max: 1,
      options: subclasses.map((s) => ({ id: slugify(s.name), label: s.name, grants: [] })),
    },
  };
}

/**
 * Gera um efeito `manual` (texto sem automação) com o texto informado.
 * @param {string} id
 * @param {string} texto
 * @returns {object}
 */
function efeitoManual(id, texto) {
  return { id, type: 'manual', text: texto };
}

/**
 * Constrói os `grants` de uma opção de `CLASSES_ESCOLHAS` a partir do seu
 * `efeito` estruturado (só Clérigo/Druida têm essa chave — as demais
 * escolhas, ex.: Estilo de Luta, têm apenas `nome`/`descricao` em prosa e
 * ficam com `grants: []`, mesma regra de "texto sem automação" já usada em
 * equipamento inicial). `efeito.armaduras`/`efeito.armas` são resolvidos
 * contra o catálogo real (mesma técnica de treinamento de armadura/arma da
 * classe); `efeito.truques_extra` vira um `modifier` declarativo.
 * @param {{efeito?: {armaduras?: string[], armas?: string[], truques_extra?: number}}} opcao
 * @param {{armas: object[], armaduras: object[]}} catalogoEquipamento
 * @param {object} idInventory
 * @returns {object[]}
 */
function construirGrantsDeOpcaoDeEscolha(opcao, catalogoEquipamento, idInventory) {
  const efeito = opcao.efeito;
  if (!efeito) return [];
  const grants = [];
  for (const nomeArmadura of nomesDeArmaduraPorCategoria(efeito.armaduras || [], catalogoEquipamento.armaduras)) {
    grants.push(efeitoProficienciaItemReservado(nomeArmadura, 'armor', idInventory, `armadura-${slugify(nomeArmadura)}`));
  }
  for (const textoArma of efeito.armas || []) {
    for (const nomeArma of nomesDeArmaPorTexto(textoArma, catalogoEquipamento.armas)) {
      grants.push(efeitoProficienciaItemReservado(nomeArma, 'weapon', idInventory, `arma-${slugify(nomeArma)}`));
    }
  }
  if (typeof efeito.truques_extra === 'number' && efeito.truques_extra > 0) {
    grants.push({
      id: 'truques-extra',
      type: 'modifier',
      target: 'spell-slot.cantrips-bonus',
      operation: 'add',
      value: efeito.truques_extra,
    });
  }
  return grants;
}

/**
 * Constrói os efeitos de escolha obrigatória de classe registrados em
 * `CLASSES_ESCOLHAS` (`site/js/pages/creator.js`) — Ordem Divina (Clérigo),
 * Ordem Primal (Druida), Estilo de Luta (Guerreiro/Guardião/Paladino),
 * Acadêmico (Mago). `tipo:"pericias"` (Ladino/Guardião "Especialista": 1-2
 * perícias entre as que o personagem JÁ tem proficiência) não é enumerável
 * estaticamente — vira `official-handler`, mecânica complexa demais para o
 * vocabulário declarativo, exatamente o caso de uso do escape-hatch.
 * @param {string} nomeClasse
 * @param {object} classesEscolhas `CLASSES_ESCOLHAS` de `site/js/pages/creator.js`
 * @param {{armas: object[], armaduras: object[]}} catalogoEquipamento
 * @param {object} idInventory
 * @returns {object[]}
 */
function gerarEfeitosDeClassesEscolhas(nomeClasse, classesEscolhas, catalogoEquipamento, idInventory) {
  const config = classesEscolhas[nomeClasse];
  if (!config) return [];

  const efeitos = [];
  for (const [chave, entrada] of Object.entries(config)) {
    const nivelMinimo = parseInt(entrada.nivelMinimo || 1, 10);
    const idBase = slugify(chave);

    if (entrada.tipo === 'pericias') {
      efeitos.push({
        id: `escolha-${idBase}`,
        type: 'official-handler',
        when: { kind: 'level', min: nivelMinimo },
        handlerId: 'expertise-from-proficient-skills',
        params: { count: entrada.maxEscolhas, title: entrada.titulo },
      });
      continue;
    }

    const opcoesFonte = entrada.tipo === 'pericias_fixas'
      ? entrada.opcoes_fixas.map((nome) => ({ nome }))
      : entrada.opcoes || [];
    const nivelExpertise = entrada.tipo === 'pericias_fixas' ? 'expertise' : 'proficient';

    efeitos.push({
      id: `escolha-${idBase}`,
      type: 'choice',
      when: { kind: 'level', min: nivelMinimo },
      choice: {
        id: idBase,
        prompt: entrada.titulo,
        min: entrada.maxEscolhas,
        max: entrada.maxEscolhas,
        options: opcoesFonte.map((opcao) => ({
          id: slugify(opcao.nome),
          label: opcao.descricao ? `${opcao.nome}: ${opcao.descricao}` : opcao.nome,
          grants: entrada.tipo === 'pericias_fixas'
            ? [{ type: 'proficiency', target: skillId(opcao.nome), level: nivelExpertise }]
            : construirGrantsDeOpcaoDeEscolha(opcao, catalogoEquipamento, idInventory),
        })),
      },
    });
  }
  return efeitos;
}

/**
 * Desambigua ids de feature que colidiriam (mesmo nome em níveis
 * diferentes, ex.: "Aumento no Valor de Atributo" nos níveis 4/8/12/16) —
 * acrescenta o nível ao slug de toda entrada cujo slug base se repete.
 * @param {Array<{nivel: number, nome: string}>} caracteristicas
 * @param {string} prefixo
 * @returns {Map<number, string>} índice (posição na lista) -> slug final
 */
function gerarSlugsUnicos(caracteristicas, prefixo) {
  const slugBase = caracteristicas.map((c) => slugify(c.nome));
  const contagem = new Map();
  for (const s of slugBase) contagem.set(s, (contagem.get(s) || 0) + 1);
  return caracteristicas.map((c, i) => {
    const base = slugBase[i];
    return contagem.get(base) > 1 ? `${prefixo}-${base}-${c.nivel}` : `${prefixo}-${base}`;
  });
}

/**
 * Remove de `caracteristicas` (lista de features "de classe") qualquer
 * entrada cujo NOME também apareça em alguma subclasse — em 10 dos 12
 * arquivos legados (`dados/classes/*.json`), `caracteristicas` vem com
 * features de subclasse duplicadas anexadas ao final (defeito de dado já
 * conhecido: `site/js/levelup.js#obterMagiasSemprePreparadasNivel` já
 * trabalha em torno dele com a mesma técnica — mapear nome de feature para
 * o conjunto de subclasses que a possuem, e excluir da lista "de classe"
 * qualquer nome que só pertença a subclasse). Barbaro/Guerreiro não têm essa
 * duplicação; para eles esta função é uma no-op.
 * @param {Array<{nivel: number, nome: string, descricao: string}>} caracteristicas
 * @param {Array<{nome: string, caracteristicas: Array<{nome: string}>}>} subclasses
 * @returns {Array<{nivel: number, nome: string, descricao: string}>}
 */
function filtrarFeaturesDeClasse(caracteristicas, subclasses) {
  const nomesDeSubclasse = new Set();
  for (const sub of subclasses) {
    for (const c of sub.caracteristicas) nomesDeSubclasse.add(c.nome);
  }
  return caracteristicas.filter((c) => !nomesDeSubclasse.has(c.nome));
}

/**
 * Normaliza um nome de característica para comparação: remove acentos,
 * baixa a caixa, remove um sufixo parentético final (ex.: "Arcana Mística
 * (6º círculo)" -> "arcana mistica") e colapsa espaços. NÃO faz stemming —
 * plural/singular é tratado à parte em `resolverNomeDaTabela`, para manter
 * a normalização auditável e não "adivinhar" equivalências.
 * @param {string} nome
 * @returns {string}
 */
function normalizarNomeCaracteristica(nome) {
  return nome
    .replace(/\s*\([^)]*\)\s*$/, '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Aliases EXPLÍCITOS e documentados entre o nome usado na CÉLULA da tabela
// de progressão (`tabela_caracteristicas`, coluna "Características"/
// "Características de Classe") e o nome usado no CABEÇALHO com descrição
// completa em `caracteristicas[]`, para os casos em que a fonte legada usa
// grafias diferentes para a MESMA característica (confirmado lendo a
// descrição completa de cada um — não é uma adivinhação heurística, é uma
// reconciliação de uma inconsistência de nomenclatura já presente no dado
// de origem). Chave: `${slug da classe}::${normalizarNomeCaracteristica(nome da tabela)}`.
// Valor: `normalizarNomeCaracteristica(nome em caracteristicas[])`.
const ALIASES_TABELA_PARA_CARACTERISTICA = new Map([
  // Ladino nível 1: a célula da tabela diz "Especialização", a descrição
  // completa (mesmo nível, mesma mecânica de Expertise) está sob "Especialista".
  ['ladino::especializacao', 'especialista'],
  // Bardo nível 9: mesma mecânica de Expertise, descrita sob "Especialista" (nível 2).
  ['bardo::especializacao', 'especialista'],
  // Ladino nível 1: "Gíria dos Ladrões" (tabela, plural) vs "Gíria do
  // Ladrão" (descrição completa, singular) — mesma característica.
  ['ladino::giria dos ladroes', 'giria do ladrao'],
  // Bruxo nível 1: "Opções de Invocações Místicas" (tabela) é a mesma
  // característica descrita como "Invocações Místicas".
  ['bruxo::opcoes de invocacoes misticas', 'invocacoes misticas'],
  // Feiticeiro nível 2: "Opções de Metamagia" (tabela) é a mesma
  // característica descrita como "Metamagia".
  ['feiticeiro::opcoes de metamagia', 'metamagia'],
  // Monge nível 6: "Ataques Potencializados" (tabela) é a mesma
  // característica descrita como "Golpes Potencializados".
  ['monge::ataques potencializados', 'golpes potencializados'],
  // Monge nível 10: "Autocura" (tabela) é a mesma característica descrita
  // como "Restauro Pessoal".
  ['monge::autocura', 'restauro pessoal'],
]);

/**
 * Expande `caracteristicas` (que, por classe, traz UMA descrição por nome —
 * mesmo quando a característica é adquirida de novo em vários níveis, ex.:
 * "Aumento no Valor de Atributo" nos níveis 4/8/12/16) usando
 * `tabela_caracteristicas` como fonte de verdade de EM QUAIS NÍVEIS cada
 * característica é realmente concedida. Isso é o mesmo algoritmo que
 * `site/js/levelup.js#obterCaracteristicasNivel` já usa em produção: ler a
 * coluna "Características (de Classe)" da linha do nível e casar cada nome
 * contra a lista detalhada — a diferença é que aqui isso é feito para os 20
 * níveis de uma vez, não nível a nível sob demanda.
 *
 * Lança `Error` se algum nome da tabela não conseguir ser resolvido a uma
 * descrição conhecida (nem por igualdade normalizada, nem pelo alias
 * explícito acima) — preferível a silenciosamente perder uma característica.
 * @param {string} slug
 * @param {object[]} tabela `tabela_caracteristicas`
 * @param {Array<{nivel: number, nome: string, descricao: string}>} caracteristicasDeClasse já filtradas de contaminação de subclasse
 * @returns {Array<{nivel: number, nome: string, descricao: string}>}
 */
function expandirCaracteristicasPelaTabela(slug, tabela, caracteristicasDeClasse) {
  const colName = 'Características de Classe' in (tabela[0] || {}) ? 'Características de Classe' : 'Características';

  // nome normalizado -> entrada canônica (nome/descrição reais).
  const porNomeNormalizado = new Map();
  for (const c of caracteristicasDeClasse) {
    porNomeNormalizado.set(normalizarNomeCaracteristica(c.nome), c);
  }

  const expandido = [];
  const naoResolvidos = [];
  for (const row of tabela) {
    const nivel = parseInt(row['Nível'], 10);
    const celula = (row[colName] || '').toString().trim();
    if (celula === '' || celula === '—' || celula === '-') continue;
    // Dentro da MESMA linha (nível), duas entradas da célula podem resolver
    // para a MESMA característica canônica — ex.: Feiticeiro nível 2 lista
    // "Metamagia, Opções de Metamagia" na mesma célula, e ambas resolvem
    // para a característica "Metamagia". Sem isso, geraria duas features
    // idênticas no mesmo nível.
    const resolvidosNestaLinha = new Set();
    for (const nomeBruto of celula.split(',').map((s) => s.trim()).filter(Boolean)) {
      const norm = normalizarNomeCaracteristica(nomeBruto);
      if (norm.startsWith('subclasse') || norm.startsWith('caracteristica de subclasse')) continue;

      let alvo = porNomeNormalizado.get(norm);
      if (!alvo) {
        const aliasKey = `${slug}::${norm}`;
        const aliasNorm = ALIASES_TABELA_PARA_CARACTERISTICA.get(aliasKey);
        if (aliasNorm) alvo = porNomeNormalizado.get(aliasNorm);
      }
      if (!alvo) {
        // Plural/singular simples (só "s" final) como último recurso, antes
        // de desistir — ex.: "Golpes Abençoados Aprimorado" (tabela) vs
        // "Golpes Abençoados Aprimorados" (descrição).
        const semS = norm.endsWith('s') ? norm.slice(0, -1) : `${norm}s`;
        alvo = porNomeNormalizado.get(semS);
      }
      if (!alvo) {
        naoResolvidos.push(`${slug} nível ${nivel}: "${nomeBruto}" (normalizado "${norm}") sem descrição correspondente em caracteristicas[]`);
        continue;
      }
      if (resolvidosNestaLinha.has(alvo.nome)) continue;
      resolvidosNestaLinha.add(alvo.nome);
      expandido.push({ nivel, nome: alvo.nome, descricao: alvo.descricao });
    }
  }

  if (naoResolvidos.length > 0) {
    throw new Error(`migrate-classes: características da tabela de progressão sem descrição correspondente:\n  - ${naoResolvidos.join('\n  - ')}`);
  }

  return expandido;
}

// Extração de "magias sempre preparadas" de uma descrição de feature — porte
// FIEL das duas funções já em produção em `site/js/levelup.js`
// (`extrairMagiasSemprePreparadasTabela`/`extrairMagiasSemprePreparadasTexto`),
// usadas para automatizar exatamente a mesma coisa na ficha legada (ex.: as
// "Magias de Domínio" dos domínios de Clérigo, listadas em uma tabela
// markdown dentro da própria descrição da feature). Reaproveitar a MESMA
// regra de extração (em vez de inventar uma nova) garante paridade com o
// que a ficha legada já automatiza.

/**
 * Extrai `nível de personagem -> [nomes de magia]` de uma tabela markdown
 * dentro da descrição (ex.: "| 3 | *Arma Espiritual, Escudo da Fé* |").
 * @param {string} descricao
 * @returns {Map<number, string[]>}
 */
function extrairMagiasDeTabela(descricao) {
  const porNivel = new Map();
  if (!descricao) return porNivel;
  // MESMO portão que `site/js/levelup.js#extrairMagiasSemprePreparadasTabela`
  // usa antes de tentar casar QUALQUER tabela markdown: sem as palavras
  // "sempre"+"preparad" na descrição, a tabela quase certamente não é uma
  // tabela de magias (monge/feiticeiro/druida têm várias outras tabelas de
  // 2 colunas com número na 1ª coluna — progressão de dado, resistência
  // elemental, etc. — que o regex genérico também casaria sem este portão).
  const textoBaixo = descricao.toLowerCase();
  if (!textoBaixo.includes('sempre') || !textoBaixo.includes('preparad')) return porNivel;
  for (const linha of descricao.split('\n')) {
    const m = linha.match(/^\|\s*\**(\d+)\**\s*\|\s*(.+?)\s*\|\s*$/);
    if (!m) continue;
    const nivel = parseInt(m[1], 10);
    const colunaMagias = (m[2] || '').trim();
    const nomesItalico = [...colunaMagias.matchAll(/\*([^*]+)\*/g)].map((x) => (x[1] || '').trim()).filter(Boolean);
    const nomes = (nomesItalico.length ? nomesItalico.flatMap((n) => n.split(',')) : colunaMagias.split(','))
      .map((n) => n.replace(/[*_`]/g, '').trim())
      .filter(Boolean);
    if (nomes.length > 0) porNivel.set(nivel, [...(porNivel.get(nivel) || []), ...nomes]);
  }
  return porNivel;
}

/**
 * Extrai nomes de magia de prosa corrida "você sempre tem a magia
 * *X* preparada" (quando a descrição NÃO tem uma tabela markdown — a
 * função de tabela já cobre esse caso).
 * @param {string} descricao
 * @returns {string[]}
 */
function extrairMagiasDeProsa(descricao) {
  if (!descricao) return [];
  const texto = descricao.toLowerCase();
  if (!texto.includes('sempre') || !texto.includes('preparad')) return [];
  if (/\|\s*\d+\s*\|/.test(descricao) || /\|\s*\*\d+\*\s*\|/.test(descricao)) return [];
  const nomes = [];
  for (const frase of descricao.split(/(?:\.\s|\n\n|\*\*)/)) {
    const fl = frase.toLowerCase();
    if (!fl.includes('sempre') || !fl.includes('preparad')) continue;
    for (const match of frase.matchAll(/\*([^*]+)\*/g)) {
      const nome = (match[1] || '').trim();
      if (!nome || nome.includes('|') || nome.length < 2) continue;
      if (nome.includes('º') || nome.includes('Círculo') || nome.includes('Nível')) continue;
      nomes.push(nome);
    }
  }
  return nomes;
}

/**
 * Constrói efeitos `grant-spell` (`alwaysPrepared:true`) a partir de uma
 * descrição de feature, resolvendo cada nome de magia contra os 391 ids de
 * `spell` reservados em `dnd2024-id-inventory.json`. Nomes que não casam
 * exatamente com nenhum reservado são reportados em `avisos` (nunca
 * ignorados silenciosamente) e não geram efeito.
 * @param {string} descricao
 * @param {number} nivelDaFeature nível em que a feature (e portanto a tabela) começa
 * @param {object} idInventory
 * @param {string[]} avisos array de saída para nomes não resolvidos
 * @returns {object[]}
 */
function construirEfeitosDeMagiaSemprePreparada(descricao, nivelDaFeature, idInventory, avisos) {
  const porNivelDaTabela = extrairMagiasDeTabela(descricao);
  const porNivel = new Map(porNivelDaTabela);
  if (porNivel.size === 0) {
    const nomesDeProsa = extrairMagiasDeProsa(descricao);
    if (nomesDeProsa.length > 0) porNivel.set(nivelDaFeature, nomesDeProsa);
  }
  if (porNivel.size === 0) return [];

  const efeitos = [];
  for (const [nivel, nomes] of porNivel) {
    for (const nome of nomes) {
      const reservado = idInventory.reserved.spell.find((s) => s.name === nome);
      if (!reservado) {
        avisos.push(`magia "${nome}" (nível ${nivel}) citada em descrição não está reservada em dnd2024-id-inventory.json`);
        continue;
      }
      efeitos.push({
        id: `grant-spell-${slugify(nome)}`,
        type: 'grant-spell',
        when: { kind: 'level', min: nivel },
        spell: reservado.id,
        alwaysPrepared: true,
      });
    }
  }
  return efeitos;
}

/**
 * Constrói as entidades `feature` (uma por `caracteristicas[]`) concedidas
 * por `grantedByRef` (id de classe ou subclasse).
 * @param {Array<{nivel: number, nome: string, descricao: string}>} caracteristicas
 * @param {string} grantedByRef
 * @param {string} prefixoId
 * @param {object} idInventory
 * @param {string[]} avisos array de saída para nomes de magia não resolvidos
 * @returns {object[]}
 */
function construirFeatures(caracteristicas, grantedByRef, prefixoId, idInventory, avisos) {
  const slugs = gerarSlugsUnicos(caracteristicas, prefixoId);
  return caracteristicas.map((c, i) => {
    const effects = [efeitoManual('descricao', c.descricao)];
    if (c.nome === 'Aumento no Valor de Atributo') {
      effects.push({ id: 'asi-ou-talento', type: 'official-handler', handlerId: 'asi-or-feat', params: {} });
    } else if (c.nome === 'Dádiva Épica') {
      effects.push({ id: 'dadiva-epica', type: 'official-handler', handlerId: 'asi-or-feat', params: { epicBoon: true } });
    }
    effects.push(...construirEfeitosDeMagiaSemprePreparada(c.descricao, c.nivel, idInventory, avisos));
    return {
      id: `${NAMESPACE}:feature:${slugs[i]}`,
      type: 'feature',
      schemaVersion: SCHEMA_VERSION,
      name: c.nome,
      description: c.descricao,
      source: { book: SOURCE_BOOK },
      grantedBy: grantedByRef,
      level: c.nivel,
      effects,
    };
  });
}

/**
 * Constrói, em memória, a coleção completa de uma classe (entidade `class`
 * + suas features + 4 `subclass` + features de cada subclasse).
 * @param {string} slug
 * @param {object} classesInfo `CLASSES_INFO` de `site/js/dados-classes.js`
 * @param {string[]} todasPericias nomes das 18 perícias (para "qualquer perícia")
 * @param {Array<{id: string, name: string}>} subclassesReservadas entradas reservadas de `dnd2024-id-inventory.json` para esta classe
 * @param {object} idInventory `dnd2024-id-inventory.json` completo (para resolver itens/armas/armaduras reservados)
 * @param {{armas: object[], armaduras: object[]}} catalogoEquipamento `dados/equipamento/{armas,armaduras}.json`
 * @param {object} classesEscolhas `CLASSES_ESCOLHAS` de `site/js/dados-classes.js`
 * @param {object} nivelSubclasseTabela `NIVEL_SUBCLASSE` de `site/js/dados-classes.js`
 * @param {string[]} [avisos] array de saída para avisos não-fatais (ex.: nome de magia citado em descrição sem id reservado correspondente) — nunca ignorados, sempre reportados aqui para quem chamar decidir o que fazer.
 * @returns {Promise<object>} `{schemaVersion, type:"class", items:[...]}`
 */
export async function construirColecaoDaClasse(slug, classesInfo, todasPericias, subclassesReservadas, idInventory, catalogoEquipamento, classesEscolhas, nivelSubclasseTabela, avisos = []) {
  const legado = await readLegacyClass(slug);
  const info = classesInfo[legado.nome];
  if (!info) {
    throw new Error(`migrate-classes: CLASSES_INFO não tem entrada para "${legado.nome}" (slug "${slug}").`);
  }
  const nivelSubclasse = nivelSubclasseTabela[legado.nome];
  if (!Number.isInteger(nivelSubclasse)) {
    throw new Error(`migrate-classes: NIVEL_SUBCLASSE não tem entrada para "${legado.nome}" (slug "${slug}").`);
  }

  const classId = buildContentId(NAMESPACE, 'class', legado.nome);
  const progression = SPELLCASTING_PROGRESSION_BY_SLUG[slug];

  const classEffects = [
    gerarEfeitoEscolhaPericias(info, todasPericias),
    gerarEfeitoEquipamentoInicial(slug, legado.tracos_basicos['Equipamento Inicial'], idInventory, avisos),
    gerarEfeitoEscolhaSubclasse(subclassesReservadas, legado.nome, nivelSubclasse),
  ];
  // Treinamento com armadura/armas: cada categoria (ex.: "Leve", "Marcial
  // (Acuidade)") é resolvida em efeitos `proficiency` individuais contra o
  // catálogo real (`dados/equipamento/{armas,armaduras}.json`), nunca
  // deixada como lista solta separada por vírgula em texto `manual`.
  for (const nomeArmadura of nomesDeArmaduraPorCategoria(info.armaduras || [], catalogoEquipamento.armaduras)) {
    classEffects.push(efeitoProficienciaItemReservado(nomeArmadura, 'armor', idInventory, `treinamento-armadura-${slugify(nomeArmadura)}`));
  }
  for (const textoArma of info.armas || []) {
    for (const nomeArma of nomesDeArmaPorTexto(textoArma, catalogoEquipamento.armas)) {
      classEffects.push(efeitoProficienciaItemReservado(nomeArma, 'weapon', idInventory, `proficiencia-arma-${slugify(nomeArma)}`));
    }
  }
  // As colunas numéricas "1".."9" (círculos de magia) são tratadas à parte
  // por `gerarEfeitosDeEspacosDeMagia`/`gerarEfeitoMagiaDePacto` — precisam
  // ser ignoradas aqui para QUALQUER classe conjuradora (não só Bruxo,
  // correção de bug: antes só Bruxo pulava essas colunas, então as outras 7
  // classes conjuradoras (Bardo/Clérigo/Druida/Feiticeiro/Guardião/Mago/
  // Paladino) emitiam cada espaço de magia DUAS vezes — uma vez aqui como
  // `resource:"1"`..`"9"` sem `recovery` (lixo, coluna numérica genérica) e
  // de novo, corretamente, como `resource:"spell-slot-N"` com
  // `recovery:"long-rest"`).
  const CIRCULOS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
  const colunasIgnoradasDaClasse = progression
    ? (slug === 'bruxo' ? [...CIRCULOS, 'Espacos de Magia', 'Nivel do Espaco'] : CIRCULOS)
    : [];
  classEffects.push(...gerarEfeitosDeColunas(legado.tabela_caracteristicas, { skipColumns: colunasIgnoradasDaClasse }));
  if (progression === 'pact') {
    classEffects.push(gerarEfeitoMagiaDePacto(legado.tabela_caracteristicas));
  } else if (progression === 'full' || progression === 'half') {
    classEffects.push(...gerarEfeitosDeEspacosDeMagia(legado.tabela_caracteristicas));
  }

  // Escolhas obrigatórias de classe fora da progressão padrão de nível
  // (`CLASSES_ESCOLHAS` de `site/js/dados-classes.js`, movido de
  // `site/js/pages/creator.js` na Task 8): Ordem Divina/Primal, Estilo de
  // Luta, Acadêmico, e (via `tipo:"pericias"`) Especialista/Especialização
  // do Ladino e Explorador Hábil do Guardião.
  classEffects.push(...gerarEfeitosDeClassesEscolhas(legado.nome, classesEscolhas, catalogoEquipamento, idInventory));

  // Segunda Especialização do Bardo (nível 9) e do Guardião (nível 9,
  // `site/js/levelup.js#exigeEspecializacaoBardo`/`exigeEspecializacaoGuardiao`):
  // mecânica idêntica à de `tipo:"pericias"` acima (perícia já proficiente
  // vira Especialização), mas em um segundo nível que NÃO está registrado em
  // `CLASSES_ESCOLHAS` (só a primeira ocorrência está) — replicado aqui
  // separadamente para não perder essa segunda escolha obrigatória.
  if (legado.nome === 'Bardo') {
    classEffects.push({
      id: 'escolha-especializacao-nivel-9',
      type: 'official-handler',
      when: { kind: 'level', min: 9 },
      handlerId: 'expertise-from-proficient-skills',
      params: { count: 2, title: 'Especialização (2ª vez)' },
    });
  }
  if (legado.nome === 'Guardião') {
    classEffects.push({
      id: 'escolha-especialista-nivel-9',
      type: 'official-handler',
      when: { kind: 'level', min: 9 },
      handlerId: 'expertise-from-proficient-skills',
      params: { count: 1, title: 'Especialista (2ª vez)' },
    });
  }

  // --- Tasks 20/21: handlers de classe -------------------------------------
  //
  // As quatro classes marciais (Bárbaro, Guerreiro, Ladino, Monge — Task 20) e
  // as quatro divinas/primitivas (Clérigo, Druida, Guardião, Paladino —
  // Task 21) têm recargas PARCIAIS e ações que combinam gasto de recurso com
  // flag de uso (ex.: `site/js/pages/sheet.js:4357` — descanso curto devolve
  // exatamente 1 uso de Fúria; `sheet.js:4379-4382` e `4464-4467` — descanso
  // curto devolve exatamente 1 uso de Canalizar Divindade), coisa que o
  // vocabulário declarativo `resourceEffect.recovery` ("restaura ao máximo")
  // não expressa. Por isso a entidade de classe DECLARA um handler oficial por
  // id estável; o handler em si vive em
  // `site/js/domain/rulesets/dnd2024/handlers/*` e só é registrado pelo
  // composition root (`site/js/app-context.js`).
  const HANDLER_DE_CLASSE_POR_SLUG = {
    barbaro: 'class-barbaro',
    guerreiro: 'class-guerreiro',
    ladino: 'class-ladino',
    monge: 'class-monge',
    clerigo: 'class-clerigo',
    druida: 'class-druida',
    guardiao: 'class-guardiao',
    paladino: 'class-paladino',
    // Task 22a: as quatro classes arcanas.
    bardo: 'class-bardo',
    bruxo: 'class-bruxo',
    feiticeiro: 'class-feiticeiro',
    mago: 'class-mago',
  };
  if (Object.hasOwn(HANDLER_DE_CLASSE_POR_SLUG, slug)) {
    classEffects.push({
      id: 'handler-de-classe',
      type: 'official-handler',
      handlerId: HANDLER_DE_CLASSE_POR_SLUG[slug],
      params: {},
    });
  }

  // Ladders de recurso das classes marciais que o baseline mantinha como
  // escada `if (nivel >= N)` embutida em `sheet.js`, e não numa coluna de
  // `tabela_caracteristicas` (por isso `gerarEfeitosDeColunas` não os
  // levanta). Trazê-los para o conteúdo é o que impede o handler da Task 20
  // de reimplementar a tabela em código.
  //   - Surto de Ação: 1 uso (nv2) / 2 usos (nv17) — sheet.js:1119
  //   - Indomável: 1/2/3 usos (nv9/13/17) — sheet.js:1121-1125
  //   - Golpe de Sorte do Ladino: 1 uso no nv20 — sheet.js:2245
  classEffects.push(...gerarLadderDeRecurso(slug, LADDERS_MARCIAIS_DE_CLASSE[slug]));

  // Task 21: Mãos Consagradas do Paladino (`5 * nivel`, sheet.js:1984) — ver
  // LADDERS_DIVINOS_PRIMAIS_DE_CLASSE.
  classEffects.push(...gerarLadderDeRecurso(slug, LADDERS_DIVINOS_PRIMAIS_DE_CLASSE[slug]));

  // Task 22a: Inspiração de Bardo e Feitiçaria Inata — ver
  // LADDERS_ARCANOS_DE_CLASSE.
  classEffects.push(...gerarLadderDeRecurso(slug, LADDERS_ARCANOS_DE_CLASSE[slug]));

  // `description` (entityBase) é opcional e fica de fora aqui de propósito:
  // `legado.texto_completo` é o capítulo inteiro do livro (milhares de
  // caracteres, prosa de ambientação), não uma descrição curta de entidade —
  // incluí-lo violaria a mesma regra de "não usar texto solto como dado
  // estruturado" que rege os efeitos.
  const classEntity = {
    id: classId,
    type: 'class',
    schemaVersion: SCHEMA_VERSION,
    name: legado.nome,
    source: { book: SOURCE_BOOK },
    hitDie: `d${info.dado_vida}`,
    primaryAbility: parsePrimaryAbilities(info.atributo_primario),
    savingThrowProficiencies: info.salvaguardas.map(abilityId),
    effects: classEffects,
  };
  if (progression) {
    classEntity.spellcasting = { ability: abilityId(info.atributo_conjuracao), progression };
  }

  // DÍVIDA TEMPORÁRIA (Task 23b) — ver a `description` de `legacyPresentation`
  // em dados/schemas/v1/class.schema.json.
  //
  // Cópia VERBATIM do arquivo legado inteiro, sem nenhuma reconciliação com o
  // catálogo. É deliberado: `site/js/pages/sheet.js` e `.../creator.js` ainda
  // leem `getClasse()` no formato do arquivo legado, e reescrevê-los está fora
  // de escopo até as Tasks 25-32. Tentar "corrigir" qualquer campo aqui
  // quebraria a paridade que é justamente o objetivo deste bloco — os defeitos
  // do legado são copiados junto, de propósito. A modelagem de verdade destes
  // mesmos dados está nas entidades `feature`/`subclass` construídas abaixo e
  // nas consultas de site/js/domain/progression/progression-queries.js.
  //
  // Remover este bloco (e o ramo correspondente de `projetarClasse`) quando as
  // Tasks 25-32 eliminarem os consumidores legados.
  classEntity.legacyPresentation = structuredClone(legado);

  const caracteristicasDeClasse = filtrarFeaturesDeClasse(legado.caracteristicas, legado.subclasses);
  const caracteristicasExpandidas = expandirCaracteristicasPelaTabela(slug, legado.tabela_caracteristicas, caracteristicasDeClasse);
  const classFeatures = construirFeatures(caracteristicasExpandidas, classId, slug, idInventory, avisos);

  const items = [classEntity, ...classFeatures];

  for (const legadoSub of legado.subclasses) {
    const reservada = subclassesReservadas.find((s) => s.name === legadoSub.nome);
    if (!reservada) {
      throw new Error(`migrate-classes: subclasse "${legadoSub.nome}" (classe "${legado.nome}") não está reservada em dnd2024-id-inventory.json.`);
    }
    const subclassEntity = {
      id: reservada.id,
      type: 'subclass',
      schemaVersion: SCHEMA_VERSION,
      name: legadoSub.nome,
      source: { book: SOURCE_BOOK },
      class: classId,
    };
    // Conjuração 1/3 do Cavaleiro Místico (Guerreiro) e Trapaceiro Arcano
    // (Ladino): a classe base não conjura, mas essas duas subclasses sim.
    if (
      (slug === 'guerreiro' && legadoSub.nome === 'Cavaleiro Místico') ||
      (slug === 'ladino' && legadoSub.nome === 'Trapaceiro Arcano')
    ) {
      subclassEntity.effects = [gerarEfeitoConjuracaoUmTerco()];
    }
    // Manobras do Mestre da Batalha (Guerreiro): quantidade de NOVAS
    // manobras aprendidas nos níveis 3/7/10/15
    // (`site/js/levelup.js#exigeManobrasGuerreiro`/`getQuantidadeNovasManobras`)
    // — mecânica de escolha entre um catálogo de manobras que não é
    // enumerável aqui (não faz parte do escopo desta tarefa: talentos/
    // manobras são conteúdo próprio), então vira `official-handler` na
    // subclasse, gated por nível, com a contagem de novas manobras em `params`.
    if (slug === 'guerreiro' && legadoSub.nome === 'Mestre da Batalha') {
      subclassEntity.effects = [
        ...(subclassEntity.effects || []),
        {
          id: 'manobras-conhecidas',
          type: 'official-handler',
          handlerId: 'combat-maneuvers-known',
          params: { newManeuversByLevel: { 3: 3, 7: 2, 10: 2, 15: 2 } },
        },
      ];
    }
    // Task 20: ladders de recurso de subclasse (Dados de Superioridade /
    // Dados Psiônicos), ver LADDERS_MARCIAIS_DE_SUBCLASSE.
    const laddersDeSubclasse = [
      ...gerarLadderDeRecurso(legadoSub.nome, LADDERS_MARCIAIS_DE_SUBCLASSE[legadoSub.nome]),
      // Task 22a: reservas de subclasse arcana, ver LADDERS_ARCANOS_DE_SUBCLASSE.
      ...gerarLadderDeRecurso(legadoSub.nome, LADDERS_ARCANOS_DE_SUBCLASSE[legadoSub.nome]),
    ];
    if (laddersDeSubclasse.length > 0) {
      subclassEntity.effects = [...(subclassEntity.effects || []), ...laddersDeSubclasse];
    }
    items.push(subclassEntity);
    items.push(...construirFeatures(legadoSub.caracteristicas, reservada.id, slugify(legadoSub.nome), idInventory, avisos));
  }

  return { schemaVersion: SCHEMA_VERSION, type: 'class', items };
}

/**
 * Constrói, em memória, as 12 coleções de classe. Não escreve nada em disco
 * — é o modo "staging" usado tanto pelo CLI sem `--write` quanto pelos
 * testes de contrato e por `audit-classes.mjs`.
 *
 * O `Map` devolvido carrega uma propriedade adicional `.avisos` (array de
 * string) com todo aviso não-fatal coletado durante a construção (ex.: nome
 * de magia citado em descrição de feature sem id `spell` reservado
 * correspondente) — nunca descartado silenciosamente, sempre reportado para
 * quem chamar decidir o que fazer (CLI imprime, `audit-classes.mjs` reporta).
 * @returns {Promise<Map<string, object> & {avisos: string[]}>} slug -> coleção
 */
export async function construirTodasAsClasses() {
  const { CLASSES_INFO, PERICIAS, CLASSES_ESCOLHAS, NIVEL_SUBCLASSE } = await import('../../site/js/dados-classes.js');
  const idInventory = await loadIdInventory(idInventoryPath);
  const catalogoEquipamento = await carregarCatalogoEquipamento();
  const todasPericias = PERICIAS.map((p) => p.nome);

  const avisos = [];
  const resultado = new Map();
  for (const slug of CLASS_SLUGS) {
    const legado = await readLegacyClass(slug);
    const classId = buildContentId(NAMESPACE, 'class', legado.nome);
    const subclassesReservadas = idInventory.reserved.subclass.filter((s) => s.class === classId);
    resultado.set(
      slug,
      await construirColecaoDaClasse(slug, CLASSES_INFO, todasPericias, subclassesReservadas, idInventory, catalogoEquipamento, CLASSES_ESCOLHAS, NIVEL_SUBCLASSE, avisos),
    );
  }
  resultado.avisos = avisos;
  return resultado;
}

// Diretório de staging para fragmentos de índice de tipos ainda não ativos
// no manifesto (`manifest.entities` não inclui "class"/"subclass"/"feature"
// nesta tarefa) — mesmo padrão de staging que a Task 7 já usa para conteúdo
// que existe em disco mas ainda não é indexado/ativado. `build-index.mjs`
// NÃO lê este diretório; ele só passa a existir quando uma tarefa futura
// promover "class"/"subclass"/"feature" a tipo ativo no manifesto e mesclar
// este fragmento no `index.json` real do pacote.
const indexFragmentsDir = path.join(repoRoot, 'scripts', 'content', 'dnd2024-index-fragments');

/**
 * Constrói, em memória, o fragmento de índice (`index.schema.json#/entries`)
 * de todas as entidades emitidas pelas 12 coleções de classe. Diferente de
 * `build-index.mjs#buildIndexForPackage` — que, para um arquivo-coleção,
 * assume tipo homogêneo (usa `content.type` do envelope para toda entrada)
 * — aqui cada `items[i]` pode ter seu PRÓPRIO tipo (class/subclass/feature
 * misturados no mesmo arquivo), então o tipo de cada entry vem do próprio
 * item (`item.type`), nunca do envelope da coleção.
 *
 * ATENÇÃO — AÇÃO NECESSÁRIA EM TAREFA FUTURA: quando "class"/"subclass"/
 * "feature" forem promovidos a tipo ativo em `manifest.entities` e este
 * fragmento for mesclado no `index.json` real do pacote, `build-index.mjs`
 * PRECISA ser atualizado para tratar coleções heterogêneas do mesmo jeito
 * que esta função já trata (tipo por item, não por envelope) — do
 * contrário, `build-index.mjs --write`/`--check` vai rotular toda
 * feature/subclass destes arquivos como `type:"class"` (o `content.type` do
 * envelope), silenciosamente errado. Não corrigido aqui porque
 * `build-index.mjs` pertence à Task 7 (já revisada) e mudar seu
 * comportamento de indexação ativa está fora do escopo desta tarefa
 * (classes ainda não são um tipo ativo).
 * @param {Map<string, object>} colecoes slug -> coleção (de `construirTodasAsClasses`)
 * @returns {{schemaVersion: string, entries: Array<object>}}
 */
export function construirFragmentoDeIndice(colecoes) {
  const entries = [];
  // Ordem determinística: por slug de classe (mesma ordem de CLASS_SLUGS),
  // depois pela posição de cada item dentro do array `items` do arquivo —
  // igual à regra documentada em `dados/schemas/v1/index.schema.json`.
  for (const slug of CLASS_SLUGS) {
    const colecao = colecoes.get(slug);
    colecao.items.forEach((item, i) => {
      entries.push({ id: item.id, type: item.type, path: `classes/${slug}.json`, pointer: `/items/${i}` });
    });
  }
  return { schemaVersion: SCHEMA_VERSION, entries };
}

/**
 * Serializa uma coleção/fragmento exatamente como `--write` grava em disco
 * (JSON com indentação de 2 espaços + quebra de linha final) — usado tanto
 * por `--write` quanto por `--check`, para que a comparação de drift compare
 * bytes idênticos aos que `--write` produziria.
 * @param {object} valor
 * @returns {string}
 */
function serializar(valor) {
  return `${JSON.stringify(valor, null, 2)}\n`;
}

/**
 * Modo `--check` (mesmo padrão de `build-index.mjs --check`): reconstrói
 * tudo em memória e compara byte a byte com os 12 arquivos canônicos
 * (`dados/pacotes/dnd2024/classes/*.json`) e o fragmento de índice de
 * staging (`scripts/content/dnd2024-index-fragments/classes.json`)
 * REALMENTE commitados em disco. Sem isso, nada garantia que os arquivos
 * escritos por uma rodada anterior de `--write` ainda refletissem o
 * conversor atual — o teste de contrato e `audit-classes.mjs` só liam o
 * resultado em memória de `construirTodasAsClasses()`, nunca os arquivos em
 * disco de fato.
 * @param {Map<string, object>} colecoes
 * @returns {Promise<{ok: boolean, diffs: string[]}>}
 */
export async function verificarDrift(colecoes) {
  const diffs = [];

  for (const [slug, colecao] of colecoes) {
    const destino = path.join(outputClassesDir, `${slug}.json`);
    const esperado = serializar(colecao);
    let atual;
    try {
      atual = await readFile(destino, 'utf8');
    } catch (error) {
      diffs.push(`${path.relative(repoRoot, destino)} não existe (${error.code}). Rode --write.`);
      continue;
    }
    if (atual !== esperado) {
      diffs.push(`${path.relative(repoRoot, destino)} está desatualizado em relação ao conversor. Rode --write.`);
    }
  }

  const fragmento = construirFragmentoDeIndice(colecoes);
  const destinoFragmento = path.join(indexFragmentsDir, 'classes.json');
  const esperadoFragmento = serializar(fragmento);
  try {
    const atualFragmento = await readFile(destinoFragmento, 'utf8');
    if (atualFragmento !== esperadoFragmento) {
      diffs.push(`${path.relative(repoRoot, destinoFragmento)} está desatualizado em relação ao conversor. Rode --write.`);
    }
  } catch (error) {
    diffs.push(`${path.relative(repoRoot, destinoFragmento)} não existe (${error.code}). Rode --write.`);
  }

  return { ok: diffs.length === 0, diffs };
}

async function main() {
  const write = process.argv.includes('--write');
  const check = process.argv.includes('--check');
  if (write && check) {
    throw new Error('migrate-classes: use --write OU --check, não os dois.');
  }
  const colecoes = await construirTodasAsClasses();

  if (write) {
    await mkdir(outputClassesDir, { recursive: true });
    for (const [slug, colecao] of colecoes) {
      const destino = path.join(outputClassesDir, `${slug}.json`);
      await writeFile(destino, serializar(colecao), 'utf8');
      process.stdout.write(`migrate-classes: escrito ${path.relative(repoRoot, destino)} (${colecao.items.length} entidade(s)).\n`);
    }

    await mkdir(indexFragmentsDir, { recursive: true });
    const fragmento = construirFragmentoDeIndice(colecoes);
    const destinoFragmento = path.join(indexFragmentsDir, 'classes.json');
    await writeFile(destinoFragmento, serializar(fragmento), 'utf8');
    process.stdout.write(
      `migrate-classes: escrito ${path.relative(repoRoot, destinoFragmento)} (${fragmento.entries.length} entrada(s) de staging).\n`,
    );
    if (colecoes.avisos.length > 0) {
      process.stdout.write(`migrate-classes: ${colecoes.avisos.length} aviso(s) não-fatal(is):\n`);
      for (const aviso of colecoes.avisos) process.stdout.write(`  - ${aviso}\n`);
    }
    return;
  }

  if (check) {
    const { ok, diffs } = await verificarDrift(colecoes);
    if (!ok) {
      process.stderr.write(`migrate-classes: ${diffs.length} arquivo(s) desatualizado(s):\n`);
      for (const diff of diffs) process.stderr.write(`  - ${diff}\n`);
      process.exitCode = 1;
      return;
    }
    process.stdout.write('migrate-classes: --check OK, todos os arquivos canônicos e o fragmento de índice refletem o conversor.\n');
    return;
  }

  let totalItems = 0;
  for (const [slug, colecao] of colecoes) {
    totalItems += colecao.items.length;
    process.stdout.write(`migrate-classes: [staging] ${slug} — ${colecao.items.length} entidade(s).\n`);
  }
  process.stdout.write(`migrate-classes: staging completo, ${colecoes.size} classe(s), ${totalItems} entidade(s) no total. Use --write para persistir.\n`);
}

const isDirectCliInvocation =
  typeof process.argv[1] === 'string' &&
  path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1]);
if (isDirectCliInvocation) {
  main().catch((error) => {
    process.stderr.write(`migrate-classes: erro fatal: ${error.stack || error.message}\n`);
    process.exitCode = 1;
  });
}
