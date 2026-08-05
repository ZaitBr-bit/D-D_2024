// ============================================================
// ## Task 28b — o oráculo do CRIADOR mudou de papel (leia antes de mexer)
//
// O criador público deixou de ser o monólito legado. O oráculo antigo,
// `tests/fixtures/dom-baseline/creator-steps.json`, foi capturado do DOM que
// `site/js/pages/creator.js` produzia — e esse produtor NÃO EXISTE MAIS: não
// há como recapturá-lo, e compará-lo com o DOM novo seria comparar duas
// coisas diferentes de propósito.
//
// A saída é a MESMA da Task 22b para `db.js`: o artefato legado é CONGELADO
// como registro histórico (ninguém o regrava, ninguém o apaga — ele é a
// referência escrita contra a qual as divergências do criador novo foram
// justificadas, uma a uma, no cabeçalho de `tests/e2e/helpers/creator.js` e
// no relatório da Task 28b) e o criador NOVO ganha o seu próprio oráculo,
// `creator-steps-v2.json`.
//
// Por que um flag de atualização SEPARADO (`UPDATE_CREATOR_DOM_BASELINE=1`,
// via `npm run test:e2e:update-dom -- --update-creator`): o guard de
// `assert-baseline-commit.mjs` existe para garantir que o oráculo LEGADO só
// seja capturado no commit-baseline, com `site/` intacto. Ele continua valendo
// para a ficha (ainda legada) e para o criador legado congelado. O oráculo do
// criador novo é outra coisa — é um snapshot de regressão da arquitetura nova,
// que só existe FORA do commit-baseline —, então exigir aquele guard para
// gravá-lo seria impossível de satisfazer por construção.
// ============================================================
// Baseline semântico de DOM para o criador (cada passo do wizard) e para a
// ficha (cada seção/card). Este spec tem dois modos:
//
// - UPDATE_DOM_BASELINE=1 (só via `npm run test:e2e:update-dom -- --update`,
//   nunca à mão): grava tests/fixtures/dom-baseline/{creator-steps,
//   sheet-sections}.json a partir do DOM real, depois de confirmar (no
//   wrapper scripts/run-dom-baseline.mjs) que o repositório está no
//   commit-baseline e sem mudanças em site/dados.
// - Modo normal (padrão): recaptura o mesmo DOM e compara byte a byte com os
//   oráculos gravados — qualquer divergência estrutural (tag, id, classe,
//   texto, ordem, ou os atributos públicos permitidos) quebra o teste.
//
// O normalizador classifica cada atributo em ALLOW ou DENY; um atributo
// desconhecido (nem allow nem deny) faz o teste falhar imediatamente, para
// que novos atributos precisem ser classificados explicitamente aqui em vez
// de vazarem silenciosamente para dentro/fora do baseline. Valores voláteis
// declarados (ids gerados, timestamps ISO) são normalizados para um
// marcador fixo em vez de comparados literalmente — ver
// VOLATILE_VALUE_PATTERNS dentro de capturarRegiaoNoNavegador().
// ============================================================
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resetApp, goCreator, goFicha } from './helpers/app.js';
import {
  STEPS,
  esperarPasso,
  primeiroContentId,
  selecionarClasse,
  selecionarEspecie,
  selecionarAntecedente,
  escolherAtributosPointBuy,
  escolherEquipamentoPadrao,
  escolherMagiasSuficientes,
  preencherDetalhes,
  proximoPasso
} from './helpers/creator.js';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
// Oráculo LEGADO do criador: congelado (ver o cabeçalho deste arquivo). Não é
// mais capturado; continua no repositório como registro do DOM que o monólito
// produzia.
const CREATOR_LEGACY_FIXTURE = path.join(repoRoot, 'tests/fixtures/dom-baseline/creator-steps.json');
const CREATOR_FIXTURE = path.join(repoRoot, 'tests/fixtures/dom-baseline/creator-steps-v2.json');
// Oráculo LEGADO da ficha: congelado pela Task 33, exatamente como a Task 28b
// congelou o do criador e a Task 22b congelou `db.js`. Não é mais capturado;
// continua no repositório como registro do DOM que o monólito produzia, e é
// contra ele que as divergências estruturais da ficha nova foram justificadas
// (cabeçalho de `sheet-vitals`/`sheet-rules`/`sheet-inventory.spec.js` e
// addendum do relatório da Task 33).
const SHEET_LEGACY_FIXTURE = path.join(repoRoot, 'tests/fixtures/dom-baseline/sheet-sections.json');
const SHEET_FIXTURE = path.join(repoRoot, 'tests/fixtures/dom-baseline/sheet-sections-v2.json');
const UPDATE = process.env.UPDATE_DOM_BASELINE === '1';
const UPDATE_CREATOR = process.env.UPDATE_CREATOR_DOM_BASELINE === '1';
// Mesma razão do flag separado do criador: o guard de `assert-baseline-commit`
// exige `site/` intacto no commit-baseline, o que é impossível de satisfazer
// para um artefato que só existe DEPOIS do cutover.
const UPDATE_SHEET = process.env.UPDATE_SHEET_DOM_BASELINE === '1';

const MAGO = 'dnd2024:class:mago';
const ANDARILHO = 'dnd2024:background:andarilho';

// Chave de localStorage da flag de migração do fluxo de level-up. É repetida
// como LITERAL aqui, e não importada de
// `site/js/infra/preferences/local-storage-preferences-repository.js`, por uma
// razão dura: este spec precisa rodar TAMBÉM no commit-baseline `e43c5ea`
// (é assim que a variante `v2 = "false"` é capturada), e naquele commit
// `site/js/infra/**` não existe. O literal é amarrado ao módulo por
// `tests/unit/sheet/level-up-flow-view.test.js`, que falha se os dois
// divergirem — a duplicação é verificada, não confiada.

const derivedValues = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'tests/fixtures/expected/derived-values.json'), 'utf8')
);
const PERSONAGEM_BASE = derivedValues.cases.find((c) => c.id === 'pv-convergente').personagem;

/**
 * Roda inteiramente no contexto da página (é serializada via
 * `Function.prototype.toString`, então não pode fechar sobre variáveis
 * externas). Percorre `document.querySelector(selector)` e produz uma árvore
 * semântica: tag, classes (ordenadas), atributos públicos classificados, e
 * filhos (elementos + nós de texto não vazios), preservando a ordem do DOM.
 */
function capturarRegiaoNoNavegador({ selectorAll, index }) {
  // Valores voláteis: coisas que existem e mudam legitimamente entre
  // execuções (ids gerados por site/js/utils.js#gerarId — formato
  // "xxxx-xxxx-xxxx" hexadecimal — e timestamps ISO 8601) são normalizados
  // para um marcador fixo em vez de comparados literalmente, para que uma
  // diferença ali nunca quebre o baseline por acidente. Hoje nenhuma das
  // duas regiões capturadas (passos do criador com Math.random congelado,
  // seção da ficha com um id de fixture fixo — "dv01-dv01-dv01") contém um
  // valor volátil de verdade, mas o mecanismo já fica pronto: se uma seção
  // futura expuser um, ele é normalizado aqui em vez de virar nondeterminismo
  // silencioso no oráculo.
  const VOLATILE_VALUE_PATTERNS = [
    { nome: 'id-gerado', regex: /\b[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}\b/gi },
    { nome: 'timestamp-iso', regex: /\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z\b/g }
  ];
  function normalizarVolateis(valor) {
    let resultado = valor;
    for (const { nome, regex } of VOLATILE_VALUE_PATTERNS) {
      resultado = resultado.replace(regex, `<<volatile:${nome}>>`);
    }
    return resultado;
  }

  const ALLOW_EXACT = new Set([
    'id', 'name', 'type', 'value', 'checked', 'disabled', 'required', 'readonly', 'selected',
    'min', 'max', 'step', 'maxlength', 'minlength', 'placeholder', 'size', 'multiple', 'for', 'accept',
    'rows', 'cols',
    'title', 'alt', 'target', 'rel', 'colspan', 'rowspan', 'tabindex', 'role', 'href', 'src',
    // Ícones SVG inline (marcação estática, não estilo calculado): geometria e
    // apresentação declarativa fazem parte da estrutura pública do ícone.
    'width', 'height', 'viewbox', 'fill', 'stroke', 'stroke-width', 'stroke-linecap',
    'stroke-linejoin', 'fill-rule', 'clip-rule', 'd', 'points', 'cx', 'cy', 'r', 'x', 'y',
    'x1', 'x2', 'y1', 'y2', 'xmlns',
    // Task 33: a ficha nova marca as linhas de inventário como arrastáveis
    // (reordenação por `drag`/`drop`). `draggable` é ESTRUTURA pública — muda o
    // que o jogador consegue fazer com a linha —, não estilo, então entra na
    // allowlist em vez de ser normalizado para fora.
    'draggable'
  ]);
  const DENY_EXACT = new Set(['style', 'data-action', 'data-command', 'data-intent']);

  function classificarAtributo(nome) {
    if (DENY_EXACT.has(nome)) return 'deny';
    if (ALLOW_EXACT.has(nome)) return 'allow';
    if (/^on/i.test(nome)) return 'deny';
    if (/^aria-/.test(nome)) return 'allow';
    if (/^data-/.test(nome)) return 'allow';
    return null;
  }

  function normalizarUrl(valor) {
    try {
      const u = new URL(valor, window.location.href);
      return u.pathname + u.search + u.hash;
    } catch {
      return valor;
    }
  }

  function normalizarNo(no) {
    if (no.nodeType === Node.TEXT_NODE) {
      const texto = normalizarVolateis(no.textContent.replace(/\s+/g, ' ').trim());
      return texto ? { text: texto } : null;
    }
    if (no.nodeType !== Node.ELEMENT_NODE) return null;

    const attrs = {};
    for (const attr of Array.from(no.attributes)) {
      const nome = attr.name.toLowerCase();
      if (nome === 'class') continue;
      const categoria = classificarAtributo(nome);
      if (categoria === 'deny') continue;
      if (categoria === null) {
        throw new Error(
          `Atributo público não classificado (allowlist/denylist) em <${no.tagName.toLowerCase()}>: "${nome}"="${attr.value}"`
        );
      }
      const valorBruto = nome === 'href' || nome === 'src' ? normalizarUrl(attr.value) : attr.value;
      attrs[nome] = normalizarVolateis(valorBruto);
    }

    const filhos = Array.from(no.childNodes).map(normalizarNo).filter(Boolean);
    return {
      tag: no.tagName.toLowerCase(),
      classes: Array.from(no.classList).sort(),
      attrs,
      children: filhos
    };
  }

  const raiz = document.querySelectorAll(selectorAll)[index];
  if (!raiz) throw new Error(`Região não encontrada para captura de baseline: ${selectorAll}[${index}]`);
  return normalizarNo(raiz);
}

async function capturarRegiao(page, selectorAll, index = 0) {
  // Cada passo carrega seus dados antes de popular `#wizard-content`; sem
  // esperar, a captura corre o risco de pegar a região ainda vazia — um
  // estado transitório, não uma diferença estrutural real.
  //
  // Task 28b: a espera pelo widget `#im-magias-area-<idx>` ("Iniciado em
  // Magia", que o monólito populava de forma tardia e fire-and-forget) saiu
  // junto com o monólito. O criador novo não tem carga fora do ciclo da
  // sessão: quando o passo renderiza, ele já renderizou por inteiro.
  await page.waitForFunction(
    ({ selectorAll: sel, index: idx }) => {
      const raiz = document.querySelectorAll(sel)[idx];
      return !!raiz && raiz.children.length > 0;
    },
    { selectorAll, index }
  );
  return page.evaluate(capturarRegiaoNoNavegador, { selectorAll, index });
}

/** Grava (modo update) ou compara byte a byte (modo normal) contra o oráculo. */
function compararOuGravar(fixturePath, capturado, gravar = UPDATE) {
  const canonical = JSON.stringify(capturado, null, 2) + '\n';
  if (gravar) {
    fs.mkdirSync(path.dirname(fixturePath), { recursive: true });
    fs.writeFileSync(fixturePath, canonical, 'utf8');
    return;
  }
  if (!fs.existsSync(fixturePath)) {
    throw new Error(
      `Oráculo de DOM baseline ausente: ${fixturePath}. Rode "npm run test:e2e:update-dom" primeiro.`
    );
  }
  const existente = fs.readFileSync(fixturePath, 'utf8');
  expect(canonical).toBe(existente);
}

// `chaveDoCard` (slug do <h2> de `#app-content .card`) foi REMOVIDO na Task 33:
// a ficha nova não tem `.card`, ela tem SEÇÕES com id canônico
// (`[data-sheet-section]`), que é uma chave melhor — estável por identidade e
// não por posição/texto. O oráculo legado, que usa as chaves antigas, continua
// congelado em `sheet-sections.json`.

test.describe('DOM baseline', () => {
  test('passos do criador (arquitetura nova) — estrutura semântica estável', async ({ page }) => {
    const captura = {};

    await resetApp(page, { characters: [] });
    await goCreator(page);
    captura.classe = await capturarRegiao(page, '#wizard-content');

    await selecionarClasse(page, MAGO);
    await proximoPasso(page);
    captura.especie = await capturarRegiao(page, '#wizard-content');

    const especie = await primeiroContentId(page, 'grid-especies');
    await selecionarEspecie(page, especie);
    await proximoPasso(page);
    captura.antecedente = await capturarRegiao(page, '#wizard-content');

    // "Andarilho" pelo mesmo motivo do spec legado: vários antecedentes (ex.:
    // Acólito) concedem "Iniciado em Magia", cuja lista de magias o catálogo
    // ainda não referencia de forma estruturada (Task 28, C2). Manter a
    // captura livre dessa lacuna mantém o oráculo sobre a ESTRUTURA do passo.
    await selecionarAntecedente(page, ANDARILHO);
    await proximoPasso(page);
    captura.atributos = await capturarRegiao(page, '#wizard-content');

    await escolherAtributosPointBuy(page);
    await proximoPasso(page);
    captura.equipamento = await capturarRegiao(page, '#wizard-content');

    await escolherEquipamentoPadrao(page);
    await proximoPasso(page);
    captura.magias = await capturarRegiao(page, '#wizard-content');

    await escolherMagiasSuficientes(page);
    await proximoPasso(page);
    await esperarPasso(page, 'detalhes');
    captura.detalhes = await capturarRegiao(page, '#wizard-content');

    compararOuGravar(CREATOR_FIXTURE, captura, UPDATE_CREATOR);
  });

  test('o oráculo LEGADO do criador continua preservado (Task 28b)', () => {
    // O produtor daquele DOM não existe mais, então o arquivo não é
    // recapturável nem comparável. Ele é mantido como REGISTRO: é contra ele
    // que cada divergência estrutural do criador novo foi justificada. Este
    // teste existe para que apagá-lo (ou esvaziá-lo) seja uma falha, e não um
    // detalhe que passa numa limpeza de arquivos "órfãos".
    expect(fs.existsSync(CREATOR_LEGACY_FIXTURE)).toBe(true);
    const legado = JSON.parse(fs.readFileSync(CREATOR_LEGACY_FIXTURE, 'utf8'));
    expect(Object.keys(legado)).toEqual(STEPS);
  });

  test('o oráculo LEGADO da ficha continua preservado (Task 33)', () => {
    // Mesmo papel do oráculo legado do criador: o produtor daquele DOM não
    // existe mais, então o arquivo não é recapturável nem comparável. Apagá-lo
    // (ou esvaziá-lo) tem de ser uma FALHA, não um detalhe que passa numa
    // limpeza de arquivos "órfãos".
    expect(fs.existsSync(SHEET_LEGACY_FIXTURE)).toBe(true);
    const legado = JSON.parse(fs.readFileSync(SHEET_LEGACY_FIXTURE, 'utf8'));
    expect(Object.keys(legado).length).toBeGreaterThan(0);
    // A variante do fluxo de level-up legado (Task 30) faz parte do registro.
    expect(Object.hasOwn(legado, 'levelup-flow-v2-false')).toBe(true);
  });

  test('seções da ficha NOVA — estrutura semântica estável', async ({ page }) => {
    // ATUALIZADO NA TASK 33 (cutover da ficha).
    //
    // O oráculo antigo capturava `#app-content .card`, a unidade de layout do
    // monólito. A ficha nova não tem `.card`: ela desenha SEÇÕES com identidade
    // estável (`[data-sheet-section="<id>"]`), que é justamente o que torna o
    // rerender PARCIAL possível. Capturar por seção é o análogo direto — e mais
    // estável, porque a chave é o id canônico e não a posição do card.
    //
    // A variante `levelup-flow-v2-false` NÃO é recapturada aqui: no baseline
    // ela era um modal do monólito (`#btn-enable-levelup-v2`); na ficha nova o
    // modo legado do fluxo é `sections/level-up-flow-view.js`, cujo oráculo é o
    // do arquivo congelado. Ela continua registrada lá.
    await resetApp(page, { characters: [PERSONAGEM_BASE] });
    await goFicha(page, PERSONAGEM_BASE.id);
    await page.waitForLoadState('networkidle');

    const secoes = page.locator('#app-content [data-sheet-section]');
    const total = await secoes.count();
    expect(total).toBeGreaterThan(0);

    const captura = {};
    for (let i = 0; i < total; i += 1) {
      const chave = await secoes.nth(i).getAttribute('data-sheet-section');
      captura[chave] = await capturarRegiao(page, '#app-content [data-sheet-section]', i);
    }

    compararOuGravar(SHEET_FIXTURE, captura, UPDATE_SHEET);
  });
});
