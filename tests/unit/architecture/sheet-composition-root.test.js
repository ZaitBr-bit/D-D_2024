// ============================================================
// Regra de arquitetura da FICHA (Task 33 — cutover público).
//
// Mesma disciplina que `creator-composition-root.test.js` estabeleceu na Task
// 28b, e pelo mesmo motivo: o valor do cutover não é ter trocado o arquivo uma
// vez, é o monólito não conseguir voltar aos poucos. Três garantias ESTÁTICAS
// (leitura do fonte, nunca execução — um import dinâmico dentro de um `if` que
// não roda em teste escaparia de qualquer checagem de runtime):
//
//   1. Nenhum arquivo de produção (`site/**`) alcança o placeholder de seção
//      do harness, nem qualquer outra coisa de `tests/`. Uma seção placeholder
//      no runtime público renderiza miolo vazio e engole todo evento: o
//      jogador veria "Inventário" sem itens e concluiria que perdeu o
//      equipamento.
//   2. O registro de produção cobre as SETE seções com implementações REAIS.
//   3. `pages/sheet.js` é FINO: sem template/`innerHTML`, sem regra de jogo,
//      sem parser de prosa, sem comparação de conteúdo por nome e sem estado
//      singleton de módulo — os cinco itens que o brief cita nominalmente e
//      que eram exatamente o que o monólito de ~18k linhas fazia.
// ============================================================
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { SHEET_SECTION_IDS, SHEET_SECTION_LABELS } from '../../../site/js/features/sheet/sheet-state.js';
import { createDefaultSectionRegistry, SECTION_FACTORIES } from '../../../site/js/features/sheet/sections/index.js';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const siteJs = path.join(repoRoot, 'site', 'js');

/** Nome do módulo-placeholder do harness, procurado em qualquer specifier. */
const PLACEHOLDER_MODULE = 'placeholder-sheet-section';

/** @type {Array<{relPath: string, source: string, code: string}>} */
let arquivosDeProducao = [];

/**
 * Remove comentários de bloco e de linha.
 *
 * A varredura precisa disso porque estes módulos DOCUMENTAM o placeholder e a
 * disciplina que o proíbe: casar a menção em prosa transformaria a explicação
 * em violação, e o incentivo passaria a ser apagar a explicação.
 * @param {string} source - fonte original.
 * @returns {string}
 */
function semComentarios(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/**
 * Lista recursivamente os `.js` de um diretório.
 * @param {string} dir - diretório raiz.
 * @returns {Promise<Array<string>>}
 */
async function listarJs(dir) {
  const encontrados = [];
  for (const entrada of await readdir(dir, { withFileTypes: true })) {
    const completo = path.join(dir, entrada.name);
    if (entrada.isDirectory()) {
      encontrados.push(...(await listarJs(completo)));
    } else if (entrada.name.endsWith('.js')) {
      encontrados.push(completo);
    }
  }
  return encontrados;
}

before(async () => {
  const caminhos = await listarJs(siteJs);
  arquivosDeProducao = await Promise.all(
    caminhos.map(async (completo) => {
      const source = await readFile(completo, 'utf8');
      return {
        relPath: path.relative(repoRoot, completo).split(path.sep).join('/'),
        source,
        code: semComentarios(source),
      };
    }),
  );
  assert.ok(arquivosDeProducao.length > 50, 'a varredura precisa alcançar o código de produção de verdade');
});

describe('ficha: o placeholder de teste nunca entra no runtime público', () => {
  test('nenhum arquivo de site/** menciona o módulo-placeholder de seção', () => {
    const infratores = arquivosDeProducao.filter((arquivo) => arquivo.code.includes(PLACEHOLDER_MODULE)).map((arquivo) => arquivo.relPath);
    assert.deepEqual(infratores, [], `estes arquivos de produção referenciam "${PLACEHOLDER_MODULE}": ${infratores.join(', ')}`);
  });

  test('o placeholder de seção continua existindo, e fora de site/', async () => {
    const harness = path.join(repoRoot, 'tests', 'e2e', 'harness', 'placeholder-sheet-section.js');
    const conteudo = await readFile(harness, 'utf8');
    assert.ok(conteudo.length > 0, 'o placeholder precisa existir — só que fora de site/');
    assert.equal(
      arquivosDeProducao.some((arquivo) => arquivo.relPath.includes(PLACEHOLDER_MODULE)),
      false,
    );
  });
});

describe('ficha: o registro de produção é COMPLETO e REAL', () => {
  test('há uma fábrica REAL para cada seção canônica, e nenhuma sobrando', () => {
    assert.deepEqual(Object.keys(SECTION_FACTORIES).sort(), [...SHEET_SECTION_IDS].sort());
  });

  test('as sete seções são construídas na ordem canônica', () => {
    const registry = createDefaultSectionRegistry();
    assert.equal(registry.ok, true, registry.ok ? '' : registry.error.code);
    assert.deepEqual([...registry.value.sectionIds()], [...SHEET_SECTION_IDS]);
  });

  test('cada seção do registro implementa o contrato completo e é congelada', () => {
    const registry = createDefaultSectionRegistry();
    assert.equal(registry.ok, true);
    for (const sectionId of SHEET_SECTION_IDS) {
      const section = registry.value.get(sectionId);
      assert.notEqual(section, null, `seção "${sectionId}" ausente`);
      for (const metodo of ['select', 'render', 'toIntent']) {
        assert.equal(typeof section[metodo], 'function', `seção "${sectionId}" sem "${metodo}"`);
      }
      assert.ok(Object.isFrozen(section), `seção "${sectionId}" precisa ser congelada`);
    }
  });

  test('`sections/index.js` importa cada seção de um módulo próprio', async () => {
    const fonte = await readFile(path.join(siteJs, 'features/sheet/sections/index.js'), 'utf8');
    for (const modulo of [
      'summary-combat-section.js',
      'resources-features-section.js',
      'feats-progression-section.js',
      'spells-spellbook-section.js',
      'conditions-defenses-senses-section.js',
      'inventory-load-coins-section.js',
      'personal-details-section.js',
    ]) {
      assert.ok(fonte.includes(`./${modulo}`), `sections/index.js não importa "./${modulo}"`);
    }
    assert.equal(semComentarios(fonte).includes(PLACEHOLDER_MODULE), false);
  });

  test('toda seção canônica tem RÓTULO de jogador — nenhum cabeçalho mostra o id cru', () => {
    // O harness desenhava o próprio id no cabeçalho. Numa ficha pública isso é
    // "conditions-defenses-senses" na cara do jogador.
    for (const sectionId of SHEET_SECTION_IDS) {
      const rotulo = SHEET_SECTION_LABELS[sectionId];
      assert.equal(typeof rotulo, 'string', `seção "${sectionId}" sem rótulo`);
      assert.notEqual(rotulo, sectionId, `o rótulo de "${sectionId}" é o próprio id`);
      assert.ok(rotulo.length > 0);
    }
    assert.deepEqual(Object.keys(SHEET_SECTION_LABELS).sort(), [...SHEET_SECTION_IDS].sort());
  });
});

// ============================================================
// O COMPOSITION ROOT PÚBLICO.
//
// A verificação é ESTÁTICA porque o módulo não é importável em Node: ele
// depende de `window.localStorage` (via `store.js`) e do `fetch` do catálogo.
// O COMPORTAMENTO — montar, devolver o disposer, recusar sem porta — é coberto
// pelos specs E2E da ficha.
// ============================================================
describe('ficha: o composition root público é FINO', () => {
  const COMPOSITION_ROOT = 'pages/sheet.js';

  /** @returns {Promise<string>} o fonte sem comentários. */
  async function codigoDoRoot() {
    return semComentarios(await readFile(path.join(siteJs, COMPOSITION_ROOT), 'utf8'));
  }

  test('não escreve markup: sem innerHTML, sem template de HTML e sem construir nós', async () => {
    const codigo = await codigoDoRoot();
    assert.equal(codigo.includes('innerHTML'), false, 'o composition root nunca escreve markup');
    assert.equal(codigo.includes('insertAdjacentHTML'), false);
    assert.equal(codigo.includes('outerHTML'), false);
    assert.equal(/`[^`]*<\s*\/?[a-z]/i.test(codigo), false, 'nenhum template literal montando HTML');
    assert.equal(/\bcreateElement\b/.test(codigo), false, 'o composition root não constrói nós');
  });

  test('não guarda estado singleton de módulo', async () => {
    // O monólito tinha `char`, `classeData`, `containerRef`, os caches de
    // magias/talentos/espécies e `_syncSubscribed` — dez variáveis de módulo
    // compartilhadas por TODAS as fichas abertas. Era a causa raiz do
    // vazamento entre fichas que a sessão por instância (Task 25) resolveu.
    const codigo = await codigoDoRoot();
    assert.equal(/^(let|var)\s+/m.test(codigo), false, 'nenhum estado mutável no escopo do módulo');
  });

  test('não contém regra de jogo (nome de classe/espécie, tabela ou derivado)', async () => {
    const codigo = await codigoDoRoot();
    for (const nome of ['Mago', 'Guerreiro', 'Bárbaro', 'Ladino', 'Clérigo', 'Druida', 'Bruxo', 'Draconato', 'Elfo', 'Anão']) {
      assert.equal(codigo.includes(nome), false, `nome de conteúdo "${nome}" no composition root`);
    }
    for (const simbolo of [
      'CLASSES_INFO',
      'PERICIAS',
      'ATRIBUTOS_NOMES',
      'STANDARD_ARRAY',
      'POINT_BUY',
      'XP_POR_NIVEL',
      'MAGIAS_EFEITO',
      'OPCOES_METAMAGIA',
      'TIPOS_DANO',
      'CONDICOES_DD',
      'calcMod',
      'calcCA',
      'calcCDMagia',
      'calcPVTotal',
      'bonusProficiencia',
      'getEspacosMagia',
      'getTruquesConhecidos',
      'getMagiaPreparadas',
      'getCapacidadeCarga',
      'getDeslocamento',
      'getTamanho',
    ]) {
      assert.equal(codigo.includes(simbolo), false, `regra/derivado "${simbolo}" no composition root`);
    }
  });

  test('não faz parser de prosa nem comparação de conteúdo', async () => {
    const codigo = await codigoDoRoot();
    // Parser de prosa: o monólito extraía deslocamento, tamanho e recarga de
    // TEXTO com regex sobre `texto_completo`.
    assert.equal(/\.match\s*\(/.test(codigo), false, 'nenhum parsing de texto no composition root');
    assert.equal(/\/[^/\n*][^\n]*\/[gimsuy]*\.test\s*\(/.test(codigo), false, 'nenhuma regex de conteúdo');
    assert.equal(codigo.includes('mdParaHtml'), false, 'nenhum render de markdown');
    assert.equal(codigo.includes('semAcento'), false, 'nenhuma normalização de nome para comparação');
    // Comparação de CONTEÚDO por nome: `=== 'Mago'` e afins. A checagem casa
    // qualquer comparação de igualdade com literal que comece em maiúscula
    // acentuada/latina — o formato dos nomes de exibição do catálogo.
    assert.equal(/[=!]==\s*'[A-ZÁÂÃÀÉÊÍÓÔÕÚÇ]/.test(codigo), false, 'comparação com nome de conteúdo');
  });

  test('não importa nenhum dos módulos legados de regra/conteúdo', async () => {
    const codigo = await codigoDoRoot();
    for (const modulo of ['../db.js', '../dados-classes.js', '../regras-cobertura.js', '../moedas.js', '../ficha-edicoes.js', '../levelup.js']) {
      assert.equal(codigo.includes(modulo), false, `o composition root ainda importa "${modulo}"`);
    }
  });

  test('exporta APENAS `renderSheet`, com a assinatura preservada', async () => {
    const codigo = semComentarios(await readFile(path.join(siteJs, COMPOSITION_ROOT), 'utf8'));
    const exportados = [...codigo.matchAll(/^export\s+(?:async\s+)?function\s+([\w$]+)/gm)].map((achado) => achado[1]);
    assert.deepEqual(exportados, ['renderSheet'], 'a página da ficha expõe uma única entrada');
    assert.ok(
      /export\s+async\s+function\s+renderSheet\s*\(\s*container\s*,\s*charId\s*\)/.test(codigo),
      'a assinatura `renderSheet(container, charId)` precisa ser preservada',
    );
    assert.ok(codigo.includes('mountSheet('), 'o composition root precisa montar pelo controller');
  });

  test('devolve um DISPOSER que descarta a ficha E os controles de saída', async () => {
    const codigo = await codigoDoRoot();
    assert.ok(codigo.includes('mounted.value'), 'o disposer de `mountSheet` precisa ser capturado');
    assert.ok(codigo.includes('descartarFicha()'), 'o disposer devolvido precisa desmontar a ficha');
    assert.ok(codigo.includes('descartarAcoes()'), 'o disposer devolvido precisa retirar os controles do cabeçalho');
  });

  test('monta as SETE seções reais e RECUSA quando alguma porta falta', async () => {
    const codigo = await codigoDoRoot();
    assert.ok(codigo.includes('createDefaultSectionRegistry'), 'o registro vem das seções reais, não é montado à mão');
    assert.equal(codigo.includes('createPlaceholderSection'), false);
    for (const recusa of ['conteudo.ok !== true', 'sectionRegistry.ok !== true', 'repository === null', 'mounted.ok !== true']) {
      assert.ok(codigo.includes(recusa), `falta a recusa explícita para: ${recusa}`);
    }
  });

  test('liga as portas que a ficha de um conjurador EXIGE', async () => {
    const codigo = await codigoDoRoot();
    // Sem estas duas, a ficha abre e MENTE: os espaços de magia aparecem como
    // desconhecidos e o descanso de um personagem com classe falha.
    assert.ok(codigo.includes('createSpellcastingTableProducer'), 'o produtor de `context.spellcasting` precisa estar ligado');
    assert.ok(codigo.includes('getOfficialHandlerInvoker()'), 'a porta de handlers oficiais precisa estar ligada');
    // E sem estas duas nada é salvo nem sincronizado.
    assert.ok(codigo.includes('createDurableCharacterMutation'), 'o protocolo durável precisa estar ligado');
    assert.ok(codigo.includes('portaDeFilaDaFicha'), 'a fila de sincronização precisa estar ligada');
    assert.ok(codigo.includes('preferences'), 'o repositório de preferências precisa estar ligado');
  });

  test('continua pequeno: fiação, não implementação', async () => {
    const fonte = await readFile(path.join(siteJs, COMPOSITION_ROOT), 'utf8');
    const linhasDeCodigo = semComentarios(fonte)
      .split('\n')
      .filter((linha) => linha.trim().length > 0).length;
    assert.ok(linhasDeCodigo < 160, `o composition root tem ${linhasDeCodigo} linhas de código; acima de 160 ele deixou de ser fiação`);
  });

  test('o monólito legado foi PRESERVADO como oráculo, fora de site/', async () => {
    // A Task 33 não apagou o baseline: ela o congelou, como a Task 22b fez com
    // `db.js`. `tests/contract/spell-parity.test.js` continua medindo a
    // migração contra o CÓDIGO REAL do monólito.
    const oraculo = await readFile(path.join(repoRoot, 'tests', 'helpers', 'legacy-sheet-source.js'), 'utf8');
    assert.ok(oraculo.includes('const MAGIAS_EFEITO = {'), 'o oráculo perdeu o mapa de automações de magia');
    assert.ok(oraculo.includes('OPCOES_METAMAGIA'), 'o oráculo perdeu as opções de metamagia');
    assert.ok(oraculo.split('\n').length > 17000, 'o oráculo não é o monólito inteiro');
    assert.equal(
      arquivosDeProducao.some((arquivo) => arquivo.code.includes('legacy-sheet-source')),
      false,
      'nenhum módulo de produção pode importar o oráculo congelado',
    );
  });
});

describe('ficha: os controles de saída não escondem regra nem markup', () => {
  test('`sheet-output-actions.js` só materializa a saída JÁ montada pelas funções puras', async () => {
    const codigo = semComentarios(await readFile(path.join(siteJs, 'features/sheet/sheet-output-actions.js'), 'utf8'));
    // Um único `innerHTML`, e ele recebe a saída de `renderPrintHtml` (que já
    // escapa todo texto de jogador). Nenhuma string é interpolada em markup.
    assert.equal((codigo.match(/innerHTML/g) ?? []).length, 1, 'só o overlay de impressão pode receber markup');
    assert.ok(codigo.includes('overlay.innerHTML = markup;'), 'o markup precisa vir pronto de `renderPrintHtml`');
    assert.equal(/`[^`]*<\s*\/?[a-z]/i.test(codigo), false, 'nenhum template literal montando HTML');
    assert.equal(/^(let|var)\s+/m.test(codigo), false, 'nenhum estado mutável no escopo do módulo');
  });
});
