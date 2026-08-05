// ============================================================
// Regra de arquitetura do CRIADOR (Task 28).
//
// Duas garantias ESTÁTICAS (leitura do fonte, não execução):
//
//   1. Nenhum arquivo de produção (`site/**`) importa
//      `tests/e2e/harness/placeholder-creator-step.js`. O placeholder é um
//      passo que aceita avançar sem validar nada; no runtime público ele
//      seria um wizard que pula etapas em silêncio. Só o harness de teste
//      pode importá-lo — e o harness vive fora de `site/`, então nunca é
//      publicado no artifact do Pages.
//
//   2. O registro de produção cobre os SETE passos com implementações REAIS,
//      todas vindas de `site/js/features/creator/steps/**`. Uma implementação
//      "quase pronta" no caminho público é pior do que uma recusa: o jogador
//      cria um personagem incompleto e só descobre na ficha.
//
// A verificação é por leitura de fonte (e não por `try { import }`) de
// propósito: um import dinâmico dentro de um `if` que nunca roda em teste
// escaparia de qualquer checagem de runtime.
// ============================================================
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { CREATOR_STEP_IDS } from '../../../site/js/features/creator/creator-state.js';
import { buildRealCreatorSteps, createDefaultStepRegistry } from '../../../site/js/features/creator/steps/index.js';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const siteJs = path.join(repoRoot, 'site', 'js');

/** Nome do módulo-placeholder, procurado em qualquer forma de specifier. */
const PLACEHOLDER_MODULE = 'placeholder-creator-step';

/** @type {Array<{relPath: string, source: string, code: string}>} */
let arquivosDeProducao = [];

/**
 * Remove comentários de bloco e de linha.
 *
 * A varredura precisa disso porque estes módulos DOCUMENTAM o placeholder e a
 * disciplina que o proíbe: casar a menção em prosa transformaria o comentário
 * explicativo em violação, e o incentivo passaria a ser apagar a explicação.
 * @param {string} source
 * @returns {string}
 */
function semComentarios(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/**
 * Lista recursivamente os `.js` de um diretório.
 * @param {string} dir
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
    caminhos.map(async (completo) => ({
      relPath: path.relative(repoRoot, completo).split(path.sep).join('/'),
      source: await readFile(completo, 'utf8'),
      code: semComentarios(await readFile(completo, 'utf8')),
    })),
  );
  assert.ok(arquivosDeProducao.length > 50, 'a varredura precisa alcançar o código de produção de verdade');
});

describe('criador: o placeholder de teste nunca entra no runtime público', () => {
  test('nenhum arquivo de site/** menciona o módulo-placeholder', () => {
    const infratores = arquivosDeProducao
      .filter((arquivo) => arquivo.code.includes(PLACEHOLDER_MODULE))
      .map((arquivo) => arquivo.relPath);
    assert.deepEqual(
      infratores,
      [],
      `estes arquivos de produção referenciam "${PLACEHOLDER_MODULE}": ${infratores.join(', ')}`,
    );
  });

  test('nenhum arquivo de site/** importa qualquer coisa de tests/', () => {
    // Uma varredura mais ampla: o caminho público não pode depender de
    // NADA da árvore de testes, nem para "só um helper".
    const padrao = /\bfrom\s*(['"`])([^'"`]*\btests\/[^'"`]*)\1/g;
    const infratores = [];
    for (const arquivo of arquivosDeProducao) {
      padrao.lastIndex = 0;
      let achado;
      while ((achado = padrao.exec(arquivo.code)) !== null) {
        infratores.push(`${arquivo.relPath} -> ${achado[2]}`);
      }
    }
    assert.deepEqual(infratores, [], `imports de produção apontando para tests/: ${infratores.join(', ')}`);
  });

  test('o próprio placeholder continua fora de site/ (não é publicado)', async () => {
    const harness = path.join(repoRoot, 'tests', 'e2e', 'harness', 'placeholder-creator-step.js');
    const conteudo = await readFile(harness, 'utf8');
    assert.ok(conteudo.length > 0, 'o placeholder precisa existir — só que fora de site/');
    assert.equal(
      arquivosDeProducao.some((arquivo) => arquivo.relPath.includes(PLACEHOLDER_MODULE)),
      false,
    );
  });
});

describe('criador: o registro de produção é COMPLETO e REAL', () => {
  test('os sete passos são construídos e nenhum é placeholder', () => {
    const construidos = buildRealCreatorSteps();
    assert.equal(construidos.ok, true, construidos.ok ? '' : construidos.error.code);
    assert.deepEqual(
      construidos.value.map((step) => step.id),
      [...CREATOR_STEP_IDS],
    );
  });

  test('cada passo do registro implementa o contrato completo', () => {
    const registry = createDefaultStepRegistry();
    assert.equal(registry.ok, true, registry.ok ? '' : registry.error.code);
    for (const stepId of CREATOR_STEP_IDS) {
      const step = registry.value.get(stepId);
      assert.notEqual(step, null, `passo "${stepId}" ausente`);
      for (const metodo of ['load', 'render', 'bind', 'validate', 'invalidate']) {
        assert.equal(typeof step[metodo], 'function', `passo "${stepId}" sem "${metodo}"`);
      }
      assert.ok(Object.isFrozen(step), `passo "${stepId}" precisa ser congelado`);
    }
  });

  test('`steps/index.js` importa cada passo de um módulo próprio em features/creator/steps', async () => {
    const fonte = await readFile(path.join(siteJs, 'features/creator/steps/index.js'), 'utf8');
    for (const modulo of [
      'class-step.js',
      'species-step.js',
      'background-step.js',
      'abilities-step.js',
      'equipment-step.js',
      'spells-step.js',
      'details-step.js',
    ]) {
      assert.ok(fonte.includes(`./${modulo}`), `steps/index.js não importa "./${modulo}"`);
    }
    assert.equal(semComentarios(fonte).includes(PLACEHOLDER_MODULE), false);
  });
});

// ============================================================
// O COMPOSITION ROOT PÚBLICO (Task 28b).
//
// `site/js/pages/creator.js` deixou de ser o monólito do wizard e passou a
// ser só fiação. Estas asserções são o que impede o monólito de voltar aos
// poucos: markup, regra de jogo e estado de módulo são exatamente as três
// coisas que ele tinha e que a arquitetura nova moveu para
// `features/creator/**`.
//
// A verificação é ESTÁTICA (leitura do fonte) porque o módulo não é
// importável em Node: ele depende de `window.localStorage` (via `store.js`)
// e do `fetch` do catálogo. O comportamento — montar, devolver o disposer,
// recusar sem porta — é coberto pelos specs E2E do criador.
// ============================================================
describe('criador: o composition root público é FINO', () => {
  const COMPOSITION_ROOT = 'pages/creator.js';

  /** @returns {Promise<string>} o fonte sem comentários. */
  async function codigoDoRoot() {
    return semComentarios(await readFile(path.join(siteJs, COMPOSITION_ROOT), 'utf8'));
  }

  test('não escreve markup: sem innerHTML e sem template literal de HTML', async () => {
    const codigo = await codigoDoRoot();
    assert.equal(codigo.includes('innerHTML'), false, 'o composition root nunca escreve markup');
    assert.equal(codigo.includes('insertAdjacentHTML'), false);
    assert.equal(codigo.includes('outerHTML'), false);
    // Template literal contendo uma tag: é assim que o monólito montava tela.
    assert.equal(/`[^`]*<\s*\/?[a-z]/i.test(codigo), false, 'nenhum template literal montando HTML');
    // Nem por nós: montar tela é da view/`ui/**`, não daqui.
    assert.equal(/\bcreateElement\b/.test(codigo), false, 'o composition root não constrói nós');
  });

  test('não guarda estado de módulo mutável', async () => {
    const codigo = await codigoDoRoot();
    assert.equal(/^(let|var)\s+/m.test(codigo), false, 'nenhum estado mutável no escopo do módulo');
  });

  test('não contém regra de jogo (nome de classe/espécie, tabela ou derivado)', async () => {
    const codigo = await codigoDoRoot();

    // Nomes de exibição do catálogo: o monólito comparava por eles
    // (`if (personagem.classe === 'Mago')`). Nenhum pode aparecer aqui.
    for (const nome of ['Mago', 'Guerreiro', 'Bárbaro', 'Ladino', 'Clérigo', 'Druida', 'Draconato', 'Elfo', 'Anão', 'Gnomo']) {
      assert.equal(codigo.includes(nome), false, `nome de conteúdo "${nome}" no composition root`);
    }
    // Tabelas e derivados do monólito.
    for (const simbolo of [
      'STANDARD_ARRAY',
      'POINT_BUY',
      'CLASSES_INFO',
      'CLASSES_ESCOLHAS',
      'NIVEL_SUBCLASSE',
      'PERICIAS',
      'calcMod',
      'calcPVNivel1',
      'bonusProficiencia',
      'getEspacosMagia',
      'getTruquesConhecidos',
      'getMagiaPreparadas',
      'getTamanho',
      'getDeslocamento',
    ]) {
      assert.equal(codigo.includes(simbolo), false, `regra/derivado "${simbolo}" no composition root`);
    }
  });

  test('não importa nenhum dos módulos legados de regra/conteúdo', async () => {
    const codigo = await codigoDoRoot();
    for (const modulo of ['../db.js', '../dados-classes.js', '../regras-cobertura.js', '../moedas.js', '../ficha-edicoes.js']) {
      assert.equal(codigo.includes(modulo), false, `o composition root ainda importa "${modulo}"`);
    }
  });

  test('exporta APENAS `renderCreator` e devolve o disposer do mount', async () => {
    const fonte = await readFile(path.join(siteJs, COMPOSITION_ROOT), 'utf8');
    const codigo = semComentarios(fonte);
    const exportados = [...codigo.matchAll(/^export\s+(?:async\s+)?function\s+([\w$]+)/gm)].map((achado) => achado[1]);
    assert.deepEqual(exportados, ['renderCreator'], 'a página do criador expõe uma única entrada');
    assert.ok(codigo.includes('mountCreator('), 'o composition root precisa montar pelo controller');
    assert.ok(
      /return\s+ok\(mounted\.value\);/.test(codigo),
      'em sucesso, `renderCreator` devolve Result ok(disposer) com o disposer de `mountCreator` (Task 34)',
    );
  });

  test('monta os SETE passos reais e RECUSA quando alguma porta falta', async () => {
    const codigo = await codigoDoRoot();
    assert.ok(codigo.includes('createDefaultStepRegistry'), 'o registro vem dos passos reais, não é montado à mão');
    assert.equal(codigo.includes('createPlaceholderStep'), false);
    // Cada porta obrigatória tem uma recusa explícita associada.
    for (const recusa of ['stepRegistry.ok !== true', 'repository === null', 'mounted.ok !== true', 'conteudo.ok !== true']) {
      assert.ok(codigo.includes(recusa), `falta a recusa explícita para: ${recusa}`);
    }
    assert.ok(codigo.includes('createCryptoRng()'), 'o RNG de produção precisa estar ligado');
  });

  test('continua pequeno: fiação, não implementação', async () => {
    const fonte = await readFile(path.join(siteJs, COMPOSITION_ROOT), 'utf8');
    const linhasDeCodigo = semComentarios(fonte)
      .split('\n')
      .filter((linha) => linha.trim().length > 0).length;
    assert.ok(
      linhasDeCodigo < 160,
      `o composition root tem ${linhasDeCodigo} linhas de código; acima de 160 ele deixou de ser fiação`,
    );
  });
});

describe('criador: os passos novos não escondem regra em template', () => {
  // A checagem espelha (para os DOIS passos desta task) a disciplina que o
  // composition root público vai exigir: nada de `innerHTML`, nada de
  // `addEventListener`, nada de estado de módulo mutável.
  for (const modulo of ['features/creator/steps/spells-step.js', 'features/creator/steps/details-step.js']) {
    test(`${modulo}: sem innerHTML, sem addEventListener e sem estado de módulo`, async () => {
      const codigo = semComentarios(await readFile(path.join(siteJs, modulo), 'utf8'));
      assert.equal(codigo.includes('innerHTML'), false, 'um passo nunca escreve no DOM');
      assert.equal(codigo.includes('addEventListener'), false, 'o binding precisa ser declarativo');
      // Estado de MÓDULO é `let`/`var` na coluna 0; `let` indentado é variável
      // local dentro de função, o que é legítimo.
      assert.equal(/^(let|var)\s+/m.test(codigo), false, 'nenhum estado mutável no escopo do módulo');
      assert.equal(/\bdocument\b/.test(codigo), false, 'um passo não conhece o documento');
    });
  }
});
