# Cobertura E2E dos cinco fluxos restantes — Plano de Implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para implementar tarefa a tarefa. Os passos usam `- [ ]` para acompanhamento.

**Goal:** Levar a suíte de paridade de 293 para ~360 testes, cobrindo importação/exportação, offline com Service Worker, os passos 4 a 7 do criador, subir de nível do 1 ao 20, magias em uso e inventário.

**Architecture:** Todo teste novo segue o princípio já estabelecido — executar a mesma ação nos dois sites e comparar o resultado, em vez de escrever o valor esperado à mão. Duas peças novas destravam quase tudo: um *driver autocorretivo* que lê o `toast` de erro para saber o que o passo ainda exige, e um módulo de *fixtures* que semeia personagens ricos (com magias, inventário e moedas) pela fábrica do próprio app.

**Tech Stack:** Playwright 1.49 + Chromium, Node 22, módulos ES. Tudo confinado a `testes/e2e/`.

Spec da refatoração: `docs/superpowers/specs/2026-08-05-quebra-monolitos-design.md`

---

## Global Constraints

Valem para **todas** as tarefas. Toda tarefa as inclui implicitamente.

### GC1 — Nada fora de `testes/e2e/`

Nenhum arquivo de `site/`, `dados/`, `scripts/` ou da raiz pode ser alterado por este plano. A aplicação continua sem build e sem dependência de Node; `node_modules/` vive só em `testes/e2e/` e está no `.gitignore`.

Se um teste falhar por causa de um bug do produto, **o bug é anotado, não corrigido aqui**. Corrigir código de produção durante a escrita de teste é como o teste deixa de ser um teste.

### GC2 — Paridade, não expectativa escrita à mão

A asserção padrão compara os dois lados:

```js
const [a, b] = await Promise.all(lados.map((l) => instantaneoFicha(l.page)));
expect(primeiraDivergencia(a, b), 'descricao do que divergiu').toBeNull();
```

Escrever o valor esperado à mão só é aceitável quando o valor é uma *invariante do produto*, nunca um detalhe de render. Já cometi esse erro nesta suíte: inventei os nomes das seções da ficha e o teste falhou contra os dois sites. Quando precisar de um valor absoluto, primeiro afirme que o **original** o satisfaz, senão o teste passa a medir nada:

```js
expect(titulos[0].length, 'o original nao tem secoes; teste sem valor').toBeGreaterThan(3);
expect(titulos[1], 'conjunto de secoes difere').toEqual(titulos[0]);
```

### GC3 — Sem amostragem silenciosa

Se um teste cobrir um subconjunto (classes, níveis, espécies), o motivo tem de ser medido e escrito no comentário. Um corte sem motivo medido é um corte errado — foi o que aconteceu com os antecedentes, capados em 6 de 16 sem razão nenhuma.

### GC4 — Registro

Decisões tomadas sem consulta, bugs encontrados e limites aceitos vão para `PERGUNTAS-PARA-REVISAO.txt` na raiz, no formato `[data] Tarefa N - assunto / Contexto / Decisao`.

### GC5 — Comandos

```bash
cd testes/e2e
npx playwright test                       # suite inteira
npx playwright test importacao.spec.mjs   # um arquivo
npx playwright test --project=offline     # so o projeto offline (Tarefa 2)
```

Nunca commitar sem autorização explícita.

---

## Estrutura de arquivos

```
testes/e2e/
  helpers.mjs               MODIFICADO  T3 (driver autocorretivo), T5 (semear magias)
  fixtures.mjs              NOVO  T5     personagens ricos, derivados de dados/
  playwright.config.mjs     MODIFICADO  T2 (projeto `offline`)
  importacao.spec.mjs       NOVO  T1     exportar, importar, round-trip
  offline.spec.mjs          NOVO  T2     Service Worker e navegacao offline
  criacao-completa.spec.mjs NOVO  T3     passos 4 a 7 ate finalizar
  levelup.spec.mjs          NOVO  T4     subir do 1 ao 20
  magias-uso.spec.mjs       NOVO  T5     conjurar, concentracao, metamagia
  inventario.spec.mjs       NOVO  T6     arrastar, comprar, moedas
  README.md                 MODIFICADO  T7
```

---

## Task 1: Importação e exportação

**Risk:** low — dois botões, APIs de download e file chooser bem suportadas pelo Playwright; nada de estado compartilhado.

**Files:**
- Create: `testes/e2e/importacao.spec.mjs`

**Interfaces:**
- Consumes: `abrirParelha`, `semearPersonagem`, `abrirFichaSemeada`, `instantaneoFicha`, `primeiraDivergencia`, `relatorioErros` de `./helpers.mjs`.
- Produces: nada que outras tarefas usem.

**Contexto do produto** (já levantado, não precisa investigar):
- `#btn-exportar` chama `exportarTodos()`, monta um `Blob` e dispara `a.download = 'dnd_personagens_<timestamp>.json'`.
- `#btn-importar` cria um `<input type="file" accept=".json">` **dinamicamente** e chama `.click()` nele. O Playwright intercepta com `page.waitForEvent('filechooser')`.
- `importarPersonagens(texto)` devolve a quantidade importada, ou `-1` em erro.

- [ ] **Step 1: Escrever o teste de exportação**

```js
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import {
  abrirParelha, semearPersonagem, abrirFichaSemeada, instantaneoFicha,
  primeiraDivergencia, relatorioErros,
} from './helpers.mjs';

const PERSONAGEM = {
  nome: 'Exportavel', classe: 'Clérigo', especie: 'Anão',
  antecedente: 'Acólito', nivel: 7,
  atributos: { forca: 12, destreza: 10, constituicao: 15,
               inteligencia: 11, sabedoria: 17, carisma: 13 },
};

/** Clica em Exportar e devolve o JSON baixado, ja parseado. */
async function exportar(page) {
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 30_000 }),
    page.evaluate(() => document.getElementById('btn-exportar')?.click()),
  ]);
  return JSON.parse(readFileSync(await download.path(), 'utf-8'));
}

test('exportacao produz o mesmo JSON nos dois sites', async ({ context }) => {
  const lados = await abrirParelha(context, '');
  for (const l of lados) await semearPersonagem(l.page, PERSONAGEM, 'exp-1');
  for (const l of lados) await l.page.reload({ waitUntil: 'domcontentloaded' });

  const [a, b] = await Promise.all(lados.map((l) => exportar(l.page)));
  expect(b, 'JSON exportado difere do original').toEqual(a);
  expect(relatorioErros(lados), 'erros ao exportar').toBe('');
});
```

- [ ] **Step 2: Rodar só este teste**

Run: `cd testes/e2e && npx playwright test importacao.spec.mjs --reporter=line`
Expected: 1 passed. Se falhar por timeout do download, o botão pode estar fora da viewport — o `evaluate(...click())` já contorna isso; se ainda falhar, confira que a home tem personagens (o botão pode não ser renderizado com a lista vazia).

- [ ] **Step 3: Acrescentar o round-trip original → refatorado**

Este é o teste que realmente importa: prova que uma exportação feita no site antigo abre no novo.

```js
test('round-trip: exportar no original, importar no refatorado', async ({ context }) => {
  const lados = await abrirParelha(context, '');
  const [original, refatorado] = lados;

  // 1. Semeia so no original e exporta de la.
  await semearPersonagem(original.page, PERSONAGEM, 'rt-1');
  await original.page.reload({ waitUntil: 'domcontentloaded' });
  const [download] = await Promise.all([
    original.page.waitForEvent('download', { timeout: 30_000 }),
    original.page.evaluate(() => document.getElementById('btn-exportar')?.click()),
  ]);
  const arquivo = await download.path();

  // 2. Importa no refatorado, que comeca com localStorage vazio.
  const [chooser] = await Promise.all([
    refatorado.page.waitForEvent('filechooser', { timeout: 30_000 }),
    refatorado.page.evaluate(() => document.getElementById('btn-importar')?.click()),
  ]);
  await chooser.setFiles(arquivo);
  await refatorado.page.waitForTimeout(1000);

  // 3. O personagem importado tem de existir com os mesmos dados.
  const importado = await refatorado.page.evaluate(async () => {
    const store = await import('./js/store.js');
    return store.listarPersonagens().map((p) => ({ id: p.id, nome: p.nome,
      classe: p.classe, especie: p.especie, nivel: p.nivel }));
  });
  expect(importado.length, 'nada foi importado no refatorado').toBe(1);
  expect(importado[0]).toMatchObject({
    nome: 'Exportavel', classe: 'Clérigo', especie: 'Anão', nivel: 7,
  });
  expect(relatorioErros(lados), 'erros no round-trip').toBe('');
});
```

- [ ] **Step 4: Acrescentar o round-trip inverso e a paridade da ficha importada**

```js
test('round-trip inverso e ficha identica apos importar', async ({ context }) => {
  const lados = await abrirParelha(context, '');
  const [original, refatorado] = lados;

  // Exporta do REFATORADO e importa no ORIGINAL -- a direcao que prova que
  // uma ficha criada no site novo continua abrindo no antigo.
  await semearPersonagem(refatorado.page, PERSONAGEM, 'rti-1');
  await refatorado.page.reload({ waitUntil: 'domcontentloaded' });
  const [download] = await Promise.all([
    refatorado.page.waitForEvent('download', { timeout: 30_000 }),
    refatorado.page.evaluate(() => document.getElementById('btn-exportar')?.click()),
  ]);
  const [chooser] = await Promise.all([
    original.page.waitForEvent('filechooser', { timeout: 30_000 }),
    original.page.evaluate(() => document.getElementById('btn-importar')?.click()),
  ]);
  await chooser.setFiles(await download.path());
  await original.page.waitForTimeout(1000);

  // Agora os dois tem o mesmo personagem: a ficha tem de renderizar igual.
  for (const l of lados) {
    await l.page.goto(l.base + '#ficha/rti-1', { waitUntil: 'domcontentloaded' });
    await l.page.waitForTimeout(1500);
  }
  const [a, b] = await Promise.all(lados.map((l) => instantaneoFicha(l.page)));
  expect(primeiraDivergencia(a, b), 'ficha importada difere').toBeNull();
});
```

- [ ] **Step 5: Validar o arquivo inteiro**

Run: `cd testes/e2e && npx playwright test importacao.spec.mjs --reporter=line`
Expected: `3 passed`.

---

## Task 2: Offline e Service Worker

**Risk:** medium — exige um projeto Playwright com Service Worker **permitido**, ao contrário de todos os outros; cache mal isolado entre execuções produz falso verde.

**Files:**
- Modify: `testes/e2e/playwright.config.mjs`
- Create: `testes/e2e/offline.spec.mjs`

**Interfaces:**
- Consumes: `ORIG`, `NOVO` de `./helpers.mjs`.
- Produces: o projeto Playwright chamado `offline`, rodável com `--project=offline`.

**Contexto do produto:**
- `site/sw.js` é byte a byte idêntico ao original.
- `STATIC_ASSETS` é uma lista **manual de 12 arquivos JS**, já incompleta no original (que tem 22 módulos) e agora bem mais (61).
- O handler de `fetch` para `.js` é **rede primeiro com cache sob demanda**: todo módulo que passa por ele é cacheado. Como `app.js` importa o grafo inteiro estaticamente, abrir a home uma vez cacheia tudo.
- **É isso que este teste existe para provar.** Hoje é raciocínio, não medição.

- [ ] **Step 1: Acrescentar o projeto `offline` à configuração**

Os projetos existentes continuam com `serviceWorkers: 'block'`; só este permite.

```js
  projects: [
    {
      name: 'paridade',
      testIgnore: 'offline.spec.mjs',
      use: { serviceWorkers: 'block' },
    },
    {
      name: 'offline',
      testMatch: 'offline.spec.mjs',
      // O unico projeto que permite Service Worker. Roda serial porque cada
      // teste manipula cache global do dominio.
      use: { serviceWorkers: 'allow' },
      fullyParallel: false,
      workers: 1,
    },
  ],
```

Manter `fullyParallel: true` e `workers: 4` no nível raiz para o projeto `paridade`.

- [ ] **Step 2: Escrever o helper de instalação do Service Worker**

```js
import { test, expect } from '@playwright/test';
import { ORIG, NOVO } from './helpers.mjs';

/**
 * Abre o site, espera o Service Worker ativar e o app carregar. Devolve a
 * pagina pronta para ir offline.
 *
 * Limpa caches e registros ANTES, senao uma execucao anterior pode servir
 * modulos velhos e o teste passa medindo o passado.
 */
async function instalarSW(context, base) {
  const page = await context.newPage();
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));
    const chaves = await caches.keys();
    await Promise.all(chaves.map((k) => caches.delete(k)));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => navigator.serviceWorker.controller !== null
       || navigator.serviceWorker.ready.then(() => true),
    null, { timeout: 30_000 });
  await page.evaluate(() => navigator.serviceWorker.ready);
  // O grafo inteiro e importado no boot; esperar a rede acalmar garante que
  // o handler de fetch cacheou todos os modulos.
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  return page;
}
```

- [ ] **Step 3: Escrever o teste de navegação offline nos dois sites**

```js
for (const [nome, base] of [['original', ORIG], ['refatorado', NOVO]]) {
  test(`${nome}: home abre offline depois de instalado`, async ({ context }) => {
    const page = await instalarSW(context, base);
    const erros = [];
    page.on('pageerror', (e) => erros.push(e.message));

    await context.setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const tamanho = await page.evaluate(
      () => (document.getElementById('app-content')?.innerHTML || '').trim().length);
    await context.setOffline(false);

    expect(erros, `${nome}: erros offline`).toEqual([]);
    expect(tamanho, `${nome}: home vazia offline`).toBeGreaterThan(100);
  });

  test(`${nome}: criador abre offline depois de instalado`, async ({ context }) => {
    const page = await instalarSW(context, base);
    const erros = [];
    page.on('pageerror', (e) => erros.push(e.message));

    await context.setOffline(true);
    await page.goto(base + '#criar', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);

    const temWizard = await page.evaluate(
      () => document.querySelectorAll('.wizard-step').length);
    await context.setOffline(false);

    expect(erros, `${nome}: erros no criador offline`).toEqual([]);
    expect(temWizard, `${nome}: wizard nao renderizou offline`).toBeGreaterThan(0);
  });
}
```

- [ ] **Step 4: Escrever o teste que compara a cobertura de cache dos dois**

É aqui que uma regressão de precache apareceria: se o refatorado precisar de módulos que não entram no cache, ele terá menos entradas ou faltará alguma.

```js
test('todos os modulos JS carregados ficam em cache nos dois sites', async ({ context }) => {
  const resultados = {};
  for (const [nome, base] of [['original', ORIG], ['refatorado', NOVO]]) {
    const page = await instalarSW(context, base);
    resultados[nome] = await page.evaluate(async () => {
      // Modulos que o app REALMENTE carregou nesta sessao.
      const carregados = performance.getEntriesByType('resource')
        .map((e) => e.name)
        .filter((u) => u.endsWith('.js') && !u.includes('gstatic'));
      // Quais deles o Service Worker guardou.
      const chaves = await caches.keys();
      const emCache = new Set();
      for (const k of chaves) {
        const c = await caches.open(k);
        for (const req of await c.keys()) emCache.add(req.url);
      }
      const faltando = carregados.filter((u) => !emCache.has(u));
      return { carregados: carregados.length, faltando };
    });
    await page.close();
  }

  // A afirmacao nao e "os dois tem o mesmo numero de modulos" -- o refatorado
  // tem 61 e o original 22, por construcao. E que NENHUM modulo carregado
  // ficou de fora do cache, nos dois.
  expect(resultados.original.faltando,
    'original deixou modulos fora do cache').toEqual([]);
  expect(resultados.refatorado.faltando,
    'refatorado deixou modulos fora do cache').toEqual([]);
  expect(resultados.refatorado.carregados,
    'refatorado carregou menos modulos que o esperado').toBeGreaterThan(50);
});
```

- [ ] **Step 5: Validar**

Run: `cd testes/e2e && npx playwright test --project=offline --reporter=line`
Expected: `5 passed`. Se `faltando` vier não-vazio no refatorado e vazio no original, é **regressão real de precache** — anote em `PERGUNTAS-PARA-REVISAO.txt` e pare; a correção é assunto próprio, fora do escopo deste plano (GC1).

- [ ] **Step 6: Confirmar que o projeto de paridade não regrediu**

Run: `cd testes/e2e && npx playwright test --project=paridade --reporter=line`
Expected: `293 passed`.

---

## Task 3: Driver autocorretivo e criação completa

**Risk:** medium — o driver é usado por esta e pela Tarefa 4; se ele for frágil, dois arquivos ficam intermitentes.

**Files:**
- Modify: `testes/e2e/helpers.mjs`
- Create: `testes/e2e/criacao-completa.spec.mjs`

**Interfaces:**
- Consumes: `assentar`, `instantaneo`, `primeiraDivergencia`, `confirmarModal`, `nosDois` de `./helpers.mjs`.
- Produces, em `./helpers.mjs`:
  - `lerToastErro(page): Promise<string|null>` — texto do último toast de erro visível, ou `null`.
  - `satisfazerPasso(page, opcoes?): Promise<boolean>` — preenche o passo atual até ele aceitar avançar; devolve `true` se avançou.
  - `passoAtual(page): Promise<number>` — índice do passo ativo, ou `-1`.

**Contexto do produto:**
- `toast(msg, tipo)` cria `<div class="toast error">` dentro de `#toast-container` e o remove após **3000 ms**. O texto diz exatamente o que falta: `"Selecione 2 perícias da classe (0 selecionadas)"`, `"Distribua todos os valores do Conjunto Padrão (3/6 atribuídos)"`.
- O passo de atributos usa `<select>` e `input[type="radio"]` — **não** usa arrastar.
- `#btn-next` avança; a barra de passos expõe `.wizard-step.active[data-step]`.

- [ ] **Step 1: Acrescentar os três helpers a `helpers.mjs`**

```js
/** Indice do passo ativo do wizard, ou -1 se nao houver wizard na tela. */
export async function passoAtual(page) {
  return page.evaluate(() => {
    const el = document.querySelector('.wizard-step.active');
    return el ? Number(el.dataset.step) : -1;
  });
}

/**
 * Texto do ultimo toast de erro visivel, ou null.
 *
 * O app remove o toast depois de 3 segundos, entao leia logo apos a acao.
 * E este texto que diz o que o passo ainda exige -- ele e a interface entre
 * o produto e o driver, e por isso o driver nao precisa saber nada sobre
 * classes ou especies.
 */
export async function lerToastErro(page) {
  return page.evaluate(() => {
    const toasts = document.querySelectorAll('#toast-container .toast.error');
    return toasts.length ? toasts[toasts.length - 1].textContent.trim() : null;
  });
}

/**
 * Preenche o passo atual ate ele aceitar avancar.
 *
 * A cada volta: tenta avancar; se o app recusar com um toast, marca MAIS UMA
 * opcao ainda nao escolhida e tenta de novo. Converge porque cada volta
 * escolhe algo novo; para quando nao ha mais nada a escolher.
 *
 * @returns {Promise<boolean>} true se o passo avancou.
 */
export async function satisfazerPasso(page, { maxVoltas = 30 } = {}) {
  const inicial = await passoAtual(page);
  for (let volta = 0; volta < maxVoltas; volta++) {
    await page.evaluate(() => document.getElementById('btn-next')?.click());
    await page.waitForTimeout(350);
    if (await passoAtual(page) !== inicial) return true;

    const marcou = await page.evaluate(() => {
      const raiz = document.getElementById('wizard-content');
      if (!raiz) return false;
      // 1. campos de texto vazios (nome do personagem)
      for (const inp of raiz.querySelectorAll('input[type="text"]')) {
        if (!inp.value.trim()) {
          inp.value = 'Heroi de Teste';
          inp.dispatchEvent(new Event('input', { bubbles: true }));
          inp.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }
      }
      // 2. selects ainda sem valor
      for (const sel of raiz.querySelectorAll('select')) {
        if (!sel.value && sel.options.length > 1) {
          sel.selectedIndex = 1;
          sel.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }
      }
      // 3. radios sem escolha no grupo
      const grupos = new Set(
        [...raiz.querySelectorAll('input[type="radio"]')].map((r) => r.name));
      for (const g of grupos) {
        const opcoes = [...raiz.querySelectorAll(`input[type="radio"][name="${g}"]`)];
        if (!opcoes.some((o) => o.checked)) { opcoes[0].click(); return true; }
      }
      // 4. checkboxes ainda desmarcados
      for (const c of raiz.querySelectorAll('input[type="checkbox"]')) {
        if (!c.checked && !c.disabled) { c.click(); return true; }
      }
      // 5. cards de selecao ainda nao escolhidos
      for (const card of raiz.querySelectorAll('.selection-card')) {
        if (!card.classList.contains('selected')) { card.click(); return true; }
      }
      return false;
    });
    if (!marcou) return false;  // nao ha mais o que escolher e nao avancou
    await page.waitForTimeout(200);
  }
  return false;
}
```

- [ ] **Step 2: Testar o driver isoladamente contra o site original**

Antes de usá-lo em paridade, prove que ele funciona no site que sabidamente funciona. Um driver quebrado passaria nos dois lados e o teste mediria nada.

```js
import { test, expect } from '@playwright/test';
import {
  abrirParelha, assentar, instantaneo, primeiraDivergencia, confirmarModal,
  nosDois, relatorioErros, satisfazerPasso, passoAtual, lerToastErro,
} from './helpers.mjs';

test('o driver completa a criacao no site ORIGINAL', async ({ context }) => {
  const lados = await abrirParelha(context, '#criar');
  const original = lados[0];

  await original.page.click('[data-classe="Guerreiro"]');
  await confirmarModal(original.page, 'popup-confirmar-classe');

  for (let i = 0; i < 10; i++) {
    if (!await satisfazerPasso(original.page)) break;
    await assentar(original.page).catch(() => {});
    // Passos de especie e antecedente abrem modal ao clicar no card.
    const temModal = await original.page.locator('#modal-overlay').isVisible();
    if (temModal) {
      for (const id of ['popup-confirmar-especie', 'popup-confirmar-antecedente']) {
        if (await original.page.locator('#' + id).count()) {
          await confirmarModal(original.page, id).catch(() => {});
          break;
        }
      }
    }
  }

  const passo = await passoAtual(original.page);
  const toast = await lerToastErro(original.page);
  // O driver tem de chegar pelo menos ao passo 4 (Atributos, indice 3).
  expect(passo, `o driver empacou no passo ${passo}. Ultimo toast: ${toast}`)
    .toBeGreaterThanOrEqual(3);
});
```

Run: `cd testes/e2e && npx playwright test criacao-completa.spec.mjs --reporter=line`
Expected: 1 passed. Se falhar, a mensagem diz em que passo empacou e qual foi o toast — ajuste a lista de widgets do `satisfazerPasso` até passar. **Não** adicione lógica específica de classe: se um widget não é coberto pelas 5 categorias, acrescente a categoria.

- [ ] **Step 3: Escrever a criação completa em lockstep**

```js
/** Roda a criacao inteira nos dois lados, comparando a cada passo. */
async function criarEmLockstep(lados, classe, especie) {
  await nosDois(lados, async (page) => {
    await page.click(`[data-classe="${classe}"]`);
    await confirmarModal(page, 'popup-confirmar-classe');
  });

  for (let i = 0; i < 12; i++) {
    const antes = await Promise.all(lados.map((l) => passoAtual(l.page)));
    await nosDois(lados, async (page) => {
      await satisfazerPasso(page);
      await assentar(page).catch(() => {});
      if (await page.locator('#modal-overlay').isVisible()) {
        for (const id of ['popup-confirmar-especie', 'popup-confirmar-antecedente']) {
          if (await page.locator('#' + id).count()) {
            await confirmarModal(page, id).catch(() => {});
            break;
          }
        }
      }
    });
    const depois = await Promise.all(lados.map((l) => passoAtual(l.page)));

    expect(depois[1],
      `passo divergiu: original ${depois[0]}, refatorado ${depois[1]}`)
      .toBe(depois[0]);

    const [a, b] = await Promise.all(lados.map((l) => instantaneo(l.page)));
    expect(primeiraDivergencia(a, b), `DOM divergiu no passo ${depois[0]}`).toBeNull();

    if (depois[0] === antes[0]) return depois[0];  // empacou igual nos dois
  }
  return passoAtual(lados[0].page);
}

test('criacao completa: Guerreiro/Humano em lockstep', async ({ context }) => {
  const lados = await abrirParelha(context, '#criar');
  const passoFinal = await criarEmLockstep(lados, 'Guerreiro', 'Humano');
  expect(passoFinal, 'nao passou do passo 3 nem no original').toBeGreaterThanOrEqual(3);
  expect(relatorioErros(lados), 'erros durante a criacao').toBe('');
});

test('criacao completa: Mago/Elfo (conjurador) em lockstep', async ({ context }) => {
  const lados = await abrirParelha(context, '#criar');
  const passoFinal = await criarEmLockstep(lados, 'Mago', 'Elfo');
  expect(passoFinal, 'nao passou do passo 3 nem no original').toBeGreaterThanOrEqual(3);
  expect(relatorioErros(lados), 'erros durante a criacao').toBe('');
});
```

- [ ] **Step 4: Cobrir as 12 classes**

Sem amostragem: são 12 criações a ~8 s cada, ~1,6 min com 4 workers.

```js
import { classes } from './dados.mjs';

for (const classe of classes()) {
  test(`criacao em lockstep: ${classe}`, async ({ context }) => {
    const lados = await abrirParelha(context, '#criar');
    const passo = await criarEmLockstep(lados, classe, 'Humano');
    expect(passo, `${classe}: nem o original passou do passo 3`).toBeGreaterThanOrEqual(3);
    expect(relatorioErros(lados), `erros criando ${classe}`).toBe('');
  });
}
```

- [ ] **Step 5: Validar**

Run: `cd testes/e2e && npx playwright test criacao-completa.spec.mjs --reporter=line`
Expected: `15 passed`.

- [ ] **Step 6: Registrar até onde o driver chegou**

Anote em `PERGUNTAS-PARA-REVISAO.txt` o passo final que o driver alcança em cada classe. Se ele não completar a criação (não chegar a `finalizar()`), isso é um **limite conhecido e escrito**, não uma omissão — GC3.

---

## Task 4: Subir de nível do 1 ao 20

**Risk:** medium — 20 subidas encadeadas por classe; um passo que trave deixa o teste longo antes de falhar.

**Files:**
- Create: `testes/e2e/levelup.spec.mjs`

**Interfaces:**
- Consumes: `abrirParelha`, `abrirFichaSemeada`, `instantaneoFicha`, `primeiraDivergencia`, `relatorioErros`, `confirmarModal` de `./helpers.mjs`; `classes` de `./dados.mjs`.

**Contexto do produto:**
- `#btn-levelup` chama `abrirModalLevelUp()`, que usa o fluxo v2 em cards. A feature flag `feature.levelup.flow.v2` tem padrão **ativado**; se estiver desligada, aparece um modal com `#btn-enable-levelup-v2`.
- O fluxo pede escolhas (ASI ou talento, subclasse, magias) conforme o nível.

- [ ] **Step 1: Escrever o helper que sobe um nível**

```js
import { test, expect } from '@playwright/test';
import {
  abrirParelha, abrirFichaSemeada, instantaneoFicha, primeiraDivergencia,
  relatorioErros,
} from './helpers.mjs';
import { classes } from './dados.mjs';

const ATRIBUTOS = { forca: 15, destreza: 14, constituicao: 14,
                    inteligencia: 13, sabedoria: 12, carisma: 10 };

/**
 * Sobe UM nivel pela interface, resolvendo as escolhas que aparecerem.
 * Devolve o nivel do personagem depois da tentativa.
 */
async function subirUmNivel(page) {
  await page.evaluate(() => {
    // Garante o fluxo v2 ligado: o modal de flag desviaria o teste.
    localStorage.setItem('feature.levelup.flow.v2', '1');
    document.getElementById('btn-levelup')?.click();
  });
  await page.waitForTimeout(600);

  // Resolve ate 15 telas de escolha do fluxo em cards.
  for (let i = 0; i < 15; i++) {
    const visivel = await page.locator('#modal-overlay').isVisible();
    if (!visivel) break;
    const agiu = await page.evaluate(() => {
      const modal = document.getElementById('modal-corpo');
      const acoes = document.getElementById('modal-acoes');
      if (!modal) return false;
      for (const card of modal.querySelectorAll('.selection-card')) {
        if (!card.classList.contains('selected')) { card.click(); return true; }
      }
      for (const sel of modal.querySelectorAll('select')) {
        if (!sel.value && sel.options.length > 1) {
          sel.selectedIndex = 1;
          sel.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }
      }
      // Botao primario de avancar/confirmar do modal.
      const botao = acoes?.querySelector('.btn-primary, .btn-success, .btn-accent');
      if (botao && !botao.disabled) { botao.click(); return true; }
      return false;
    });
    if (!agiu) break;
    await page.waitForTimeout(400);
  }

  await page.evaluate(() => window.fecharModal?.());
  await page.waitForTimeout(400);
  return page.evaluate(async () => {
    const store = await import('./js/store.js');
    return store.listarPersonagens()[0]?.nivel ?? -1;
  });
}
```

- [ ] **Step 2: Provar o helper no site original antes de usá-lo em paridade**

```js
test('subir de nivel funciona no site ORIGINAL', async ({ context }) => {
  const lados = await abrirParelha(context);
  await abrirFichaSemeada(lados, {
    nome: 'Sobe Nivel', classe: 'Guerreiro', especie: 'Humano',
    antecedente: 'Soldado', nivel: 1, atributos: ATRIBUTOS,
  }, 'lvl-orig');

  const antes = 1;
  const depois = await subirUmNivel(lados[0].page);
  expect(depois, `o original nao subiu de ${antes}`).toBeGreaterThan(antes);
});
```

Run: `cd testes/e2e && npx playwright test levelup.spec.mjs --reporter=line -g ORIGINAL`
Expected: 1 passed. Se falhar, o helper está errado — corrija antes de seguir, senão os testes de paridade passariam sem subir nada.

- [ ] **Step 3: Escrever a subida encadeada 1 → 20 em lockstep**

```js
test('Guerreiro: subir do nivel 1 ao 20 mantendo paridade', async ({ context }) => {
  test.setTimeout(300_000);
  const lados = await abrirParelha(context);
  await abrirFichaSemeada(lados, {
    nome: 'Escalada', classe: 'Guerreiro', especie: 'Humano',
    antecedente: 'Soldado', nivel: 1, atributos: ATRIBUTOS,
  }, 'lvl-guerreiro');

  for (let alvo = 2; alvo <= 20; alvo++) {
    const niveis = [];
    for (const l of lados) niveis.push(await subirUmNivel(l.page));

    expect(niveis[1], `nivel divergiu ao subir para ${alvo}: ` +
      `original ${niveis[0]}, refatorado ${niveis[1]}`).toBe(niveis[0]);

    const [a, b] = await Promise.all(lados.map((l) => instantaneoFicha(l.page)));
    expect(primeiraDivergencia(a, b), `ficha divergiu no nivel ${niveis[0]}`).toBeNull();

    if (niveis[0] < alvo) break;  // empacou igual nos dois: limite conhecido
  }
  expect(relatorioErros(lados), 'erros durante as subidas').toBe('');
});
```

- [ ] **Step 4: Repetir para um conjurador e um híbrido**

Três classes, não as 12: cada subida 1→20 leva ~2 min, e o que muda entre classes já está coberto por `classes.spec.mjs`, que renderiza **todas as 12 em todos os 20 níveis**. O que este teste acrescenta é a *transição* entre níveis, e as três formas de progressão (marcial puro, conjurador pleno, subclasse conjuradora) cobrem os caminhos distintos. Escreva esse motivo no comentário — GC3.

```js
// Guerreiro ja coberto acima (marcial puro + subclasse conjuradora no 3).
for (const classe of ['Mago', 'Paladino']) {
  test(`${classe}: subir do nivel 1 ao 20 mantendo paridade`, async ({ context }) => {
    test.setTimeout(300_000);
    const lados = await abrirParelha(context);
    await abrirFichaSemeada(lados, {
      nome: `Escalada ${classe}`, classe, especie: 'Humano',
      antecedente: 'Soldado', nivel: 1, atributos: ATRIBUTOS,
    }, `lvl-${classe.toLowerCase()}`);

    for (let alvo = 2; alvo <= 20; alvo++) {
      const niveis = [];
      for (const l of lados) niveis.push(await subirUmNivel(l.page));
      expect(niveis[1], `${classe}: nivel divergiu ao subir para ${alvo}`).toBe(niveis[0]);
      const [a, b] = await Promise.all(lados.map((l) => instantaneoFicha(l.page)));
      expect(primeiraDivergencia(a, b), `${classe}: ficha divergiu no nivel ${niveis[0]}`).toBeNull();
      if (niveis[0] < alvo) break;
    }
    expect(relatorioErros(lados), `erros subindo ${classe}`).toBe('');
  });
}
```

- [ ] **Step 5: Validar**

Run: `cd testes/e2e && npx playwright test levelup.spec.mjs --reporter=line`
Expected: `4 passed`. Anote em `PERGUNTAS-PARA-REVISAO.txt` até que nível cada classe chegou, se alguma parar antes do 20.

---

## Task 5: Magias em uso

**Risk:** medium — depende de semear um conjurador com magias e espaços coerentes; fixture errada faz o teste medir uma ficha vazia nos dois lados e passar sem valor.

**Files:**
- Create: `testes/e2e/fixtures.mjs`
- Create: `testes/e2e/magias-uso.spec.mjs`

**Interfaces:**
- Produces, em `./fixtures.mjs`:
  - `conjuradorPreparado(classe, nivel): object` — campos para `abrirFichaSemeada`, com truques, magias preparadas e espaços preenchidos.
- Consumes: `abrirParelha`, `abrirFichaSemeada`, `instantaneoFicha`, `primeiraDivergencia`, `relatorioErros` de `./helpers.mjs`.

**Contexto do produto:**
- Campos do schema (de `criarPersonagemVazio`): `magias_conhecidas`, `magias_preparadas`, `grimorio`, `espacos_magia`, `magias_customizadas`.
- Botões de conjuração na ficha usam `data-conjurar`, `data-conjurar-pacto`, `data-conjurar-gratis`, `data-conjurar-magia-custom`, `data-conjurar-ritual-custom`.

- [ ] **Step 1: Escrever a fixture do conjurador**

Os nomes de magia vêm de `dados/magias/`, não inventados — uma magia inexistente renderizaria vazio nos dois lados e o teste passaria medindo nada.

```js
// testes/e2e/fixtures.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, '..', '..');

/** Nomes de magia de um circulo, lidos de dados/magias/circulo_N.json. */
export function magiasDoCirculo(circulo, quantas) {
  const caminho = resolve(RAIZ, `dados/magias/circulo_${circulo}.json`);
  const d = JSON.parse(readFileSync(caminho, 'utf-8'));
  const lista = Array.isArray(d) ? d : (d.magias || []);
  const nomes = lista.map((m) => m.nome).filter(Boolean);
  if (nomes.length < quantas) {
    throw new Error(
      `circulo ${circulo}: pedi ${quantas} magias, ha ${nomes.length}`);
  }
  return nomes.slice(0, quantas);
}

/**
 * Conjurador com truques, magias preparadas e espacos coerentes com o nivel.
 * Os espacos seguem a tabela de conjurador pleno do livro.
 */
export function conjuradorPreparado(classe, nivel) {
  const truques = magiasDoCirculo(0, 3);
  const primeiro = magiasDoCirculo(1, 4);
  const segundo = nivel >= 3 ? magiasDoCirculo(2, 3) : [];
  const espacos = { 1: { total: 4, usados: 0 } };
  if (nivel >= 3) espacos[2] = { total: 3, usados: 0 };
  if (nivel >= 5) espacos[3] = { total: 2, usados: 0 };

  return {
    nome: `${classe} conjurando`,
    classe,
    especie: 'Humano',
    antecedente: 'Sábio',
    nivel,
    atributos: { forca: 10, destreza: 14, constituicao: 14,
                 inteligencia: 17, sabedoria: 15, carisma: 13 },
    magias_conhecidas: [...truques, ...primeiro, ...segundo],
    magias_preparadas: [...primeiro, ...segundo],
    grimorio: classe === 'Mago' ? [...primeiro, ...segundo] : [],
    espacos_magia: espacos,
  };
}
```

- [ ] **Step 2: Verificar que a fixture produz uma ficha com magias visíveis**

Sem isso, todo o resto da tarefa pode passar medindo uma seção vazia.

```js
import { test, expect } from '@playwright/test';
import {
  abrirParelha, abrirFichaSemeada, instantaneoFicha, primeiraDivergencia,
  relatorioErros,
} from './helpers.mjs';
import { conjuradorPreparado } from './fixtures.mjs';

test('a fixture do conjurador produz magias na tela', async ({ context }) => {
  const lados = await abrirParelha(context);
  await abrirFichaSemeada(lados, conjuradorPreparado('Mago', 5), 'mag-fix');

  for (const l of lados) {
    const botoes = await l.page.locator('[data-conjurar]').count();
    expect(botoes, `${l.nome}: nenhuma magia conjuravel na ficha`).toBeGreaterThan(0);
  }
});
```

Run: `cd testes/e2e && npx playwright test magias-uso.spec.mjs --reporter=line -g fixture`
Expected: 1 passed. Se der 0 botões, os nomes de magia ou os campos do schema estão errados — corrija a fixture antes de seguir.

- [ ] **Step 3: Escrever o teste de conjurar e gastar espaço**

```js
test('conjurar uma magia gasta o mesmo espaco nos dois', async ({ context }) => {
  const lados = await abrirParelha(context);
  await abrirFichaSemeada(lados, conjuradorPreparado('Mago', 5), 'mag-conj');

  for (const l of lados) {
    await l.page.evaluate(() => document.querySelector('[data-conjurar]')?.click());
    await l.page.waitForTimeout(700);
    // Alguns caminhos abrem modal de circulo ou de alvo; confirmar o primeiro
    // botao primario disponivel.
    if (await l.page.locator('#modal-overlay').isVisible()) {
      await l.page.evaluate(() => {
        const b = document.querySelector('#modal-acoes .btn-primary, #modal-acoes .btn-success');
        b?.click();
      });
      await l.page.waitForTimeout(500);
    }
  }

  const [a, b] = await Promise.all(lados.map((l) => instantaneoFicha(l.page)));
  expect(primeiraDivergencia(a, b), 'ficha divergiu apos conjurar').toBeNull();

  const espacos = await Promise.all(lados.map((l) => l.page.evaluate(async () => {
    const store = await import('./js/store.js');
    return store.listarPersonagens()[0]?.espacos_magia;
  })));
  expect(espacos[1], 'espacos de magia divergiram').toEqual(espacos[0]);
});
```

- [ ] **Step 4: Cobrir as 8 classes conjuradoras**

```js
import { conjuradoras } from './dados.mjs';

for (const classe of conjuradoras()) {
  test(`${classe}: secao de magias identica com magias preparadas`, async ({ context }) => {
    const lados = await abrirParelha(context);
    await abrirFichaSemeada(lados, conjuradorPreparado(classe, 5),
      `mag-${classe.normalize('NFD').replace(/[^a-z]/gi, '').toLowerCase()}`);

    const [a, b] = await Promise.all(lados.map((l) => instantaneoFicha(l.page)));
    expect(primeiraDivergencia(a, b), `${classe}: ficha com magias difere`).toBeNull();
    expect(relatorioErros(lados), `erros na ficha de ${classe}`).toBe('');
  });
}
```

- [ ] **Step 5: Validar**

Run: `cd testes/e2e && npx playwright test magias-uso.spec.mjs --reporter=line`
Expected: `11 passed` (1 fixture + 1 conjurar + 8 conjuradoras + 1 do passo 3).

---

## Task 6: Inventário, compra e moedas

**Risk:** medium — arrastar-e-soltar HTML5 é a única interação da suíte que o Playwright pode não emular de primeira.

**Files:**
- Modify: `testes/e2e/fixtures.mjs`
- Create: `testes/e2e/inventario.spec.mjs`

**Interfaces:**
- Produces, em `./fixtures.mjs`: `comInventario(): object` — personagem com itens e moedas.
- Consumes: os mesmos helpers das tarefas anteriores.

**Contexto do produto:**
- O arrastar usa HTML5 padrão: `dragstart`, `dragover`, `drop`, `dragend`. Há também `touchstart` (caminho móvel) em `site/js/sheet/inventario.js`.
- Campos do schema: `inventario` (array) e `moedas` (carteira).

- [ ] **Step 1: Acrescentar a fixture com inventário**

```js
/** Personagem com itens equipados, na mochila e moedas para comprar. */
export function comInventario() {
  return {
    nome: 'Mercador', classe: 'Ladino', especie: 'Pequenino',
    antecedente: 'Criminoso', nivel: 4,
    atributos: { forca: 10, destreza: 17, constituicao: 14,
                 inteligencia: 13, sabedoria: 12, carisma: 14 },
    inventario: [
      { nome: 'Adaga', qtd: 2, peso: '0,5 kg', equipado: true },
      { nome: 'Corda de Cânhamo', qtd: 1, peso: '5 kg', equipado: false },
      { nome: 'Rações', qtd: 5, peso: '1 kg', equipado: false },
    ],
    moedas: { po: 50, pp: 20, pc: 100, pe: 0, pl: 0 },
  };
}
```

- [ ] **Step 2: Verificar que a fixture rende itens na tela**

```js
test('a fixture de inventario produz itens na tela', async ({ context }) => {
  const lados = await abrirParelha(context);
  await abrirFichaSemeada(lados, comInventario(), 'inv-fix');
  for (const l of lados) {
    const texto = await l.page.textContent('#app-content');
    expect(texto, `${l.nome}: item da fixture nao aparece`).toContain('Adaga');
  }
});
```

Run: `cd testes/e2e && npx playwright test inventario.spec.mjs --reporter=line -g fixture`
Expected: 1 passed. Se a Adaga não aparecer, o formato dos itens do `inventario` está errado — compare com um personagem real do seu `localStorage` antes de seguir.

- [ ] **Step 3: Testar paridade do inventário renderizado e das moedas**

```js
test('inventario e moedas renderizam igual', async ({ context }) => {
  const lados = await abrirParelha(context);
  await abrirFichaSemeada(lados, comInventario(), 'inv-render');
  const [a, b] = await Promise.all(lados.map((l) => instantaneoFicha(l.page)));
  expect(primeiraDivergencia(a, b), 'inventario difere').toBeNull();
  expect(relatorioErros(lados), 'erros no inventario').toBe('');
});
```

- [ ] **Step 4: Testar o arrastar-e-soltar**

Primeiro com a API do Playwright; se ela não disparar os handlers, caia para os eventos manuais. Prove no original antes de comparar.

```js
/**
 * Arrasta um item para outro. Tenta `dragTo`; se o DOM nao mudar, dispara os
 * eventos HTML5 a mao com um DataTransfer real.
 */
async function arrastar(page, origemSel, destinoSel) {
  const antes = await page.textContent('#app-content');
  await page.locator(origemSel).dragTo(page.locator(destinoSel)).catch(() => {});
  await page.waitForTimeout(500);
  if (await page.textContent('#app-content') !== antes) return true;

  await page.evaluate(([o, d]) => {
    const origem = document.querySelector(o);
    const destino = document.querySelector(d);
    if (!origem || !destino) return;
    const dt = new DataTransfer();
    origem.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
    destino.dispatchEvent(new DragEvent('dragover', { bubbles: true, dataTransfer: dt }));
    destino.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: dt }));
    origem.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: dt }));
  }, [origemSel, destinoSel]);
  await page.waitForTimeout(500);
  return await page.textContent('#app-content') !== antes;
}

test('arrastar item reordena igual nos dois', async ({ context }) => {
  const lados = await abrirParelha(context);
  await abrirFichaSemeada(lados, comInventario(), 'inv-drag');

  const itens = '[draggable="true"]';
  const mudou = [];
  for (const l of lados) {
    const n = await l.page.locator(itens).count();
    if (n < 2) { mudou.push('sem itens arrastaveis'); continue; }
    mudou.push(await arrastar(l.page, `${itens} >> nth=0`, `${itens} >> nth=1`));
  }

  expect(mudou[0], 'o arrastar nao funcionou nem no original; teste sem valor')
    .toBe(true);
  expect(mudou[1], 'o arrastar nao surtiu efeito no refatorado').toBe(mudou[0]);

  const [a, b] = await Promise.all(lados.map((l) => instantaneoFicha(l.page)));
  expect(primeiraDivergencia(a, b), 'inventario divergiu apos arrastar').toBeNull();
});
```

- [ ] **Step 5: Validar**

Run: `cd testes/e2e && npx playwright test inventario.spec.mjs --reporter=line`
Expected: `4 passed`. Se o arrastar não funcionar nem no original, o teste falha com a mensagem certa — nesse caso registre em `PERGUNTAS-PARA-REVISAO.txt` que o arrastar não é automatizável por este caminho e marque o teste com `test.skip`, com o motivo escrito. Um `skip` sem motivo escrito é omissão silenciosa (GC3).

---

## Task 7: Consolidação

**Risk:** low — documentação e uma execução completa.

**Files:**
- Modify: `testes/e2e/README.md`
- Modify: `PERGUNTAS-PARA-REVISAO.txt`

- [ ] **Step 1: Rodar a suíte inteira e medir**

Run: `cd testes/e2e && npx playwright test --reporter=line`
Expected: todos passando. Anote o total de testes e o tempo.

- [ ] **Step 2: Atualizar a tabela do README**

Acrescente as cinco linhas novas à tabela "O que cada arquivo cobre":

```markdown
| `importacao.spec.mjs` | Exportar, importar e round-trip nos dois sentidos entre os sites |
| `offline.spec.mjs` | Service Worker: instalação, navegação offline e cobertura de cache dos módulos |
| `criacao-completa.spec.mjs` | Criação em lockstep nas 12 classes, com driver que lê o toast para saber o que falta |
| `levelup.spec.mjs` | Subida do nível 1 ao 20 em três classes, comparando a ficha a cada nível |
| `magias-uso.spec.mjs` | Conjuração e espaços de magia nas 8 classes conjuradoras |
| `inventario.spec.mjs` | Inventário, moedas e arrastar-e-soltar |
```

Atualize também o comando `npm test` com o novo total e tempo, e a seção "Rodar" com `--project=offline`.

- [ ] **Step 3: Substituir a lista de "ainda não coberto"**

Em `PERGUNTAS-PARA-REVISAO.txt`, a entrada `[2026-08-05] Cobertura de teste` lista o que faltava. Acrescente uma entrada nova dizendo o que passou a ser coberto e o que **continua** de fora, com o motivo medido de cada exclusão — não edite a entrada antiga, o registro é cronológico.

- [ ] **Step 4: Confirmar que nada fora de `testes/e2e/` mudou**

Run: `git status --porcelain | grep -v "^?? testes/e2e/\|^ M testes/e2e/\|^ M PERGUNTAS-PARA-REVISAO.txt"`
Expected: sem saída além do que já estava modificado antes deste plano.

---

## Autorrevisão

**Cobertura dos cinco casos pedidos:** importação/exportação → Tarefa 1. Offline/Service Worker → Tarefa 2. Passos 4 a 7 do criador → Tarefa 3. Subir de nível 1→20 → Tarefa 4. Magias em uso → Tarefa 5. Inventário → Tarefa 6. Todos com tarefa própria.

**Consistência de nomes entre tarefas:** `passoAtual`, `lerToastErro` e `satisfazerPasso` são definidos na Tarefa 3 e usados na 3 e na 4. `conjuradorPreparado` e `magiasDoCirculo` são definidos na Tarefa 5; `comInventario` na 6, no mesmo `fixtures.mjs`. `arrastar` e `subirUmNivel` são locais do seu arquivo. Nenhuma tarefa usa símbolo que outra não defina.

**Riscos declarados:** as Tarefas 3, 4, 5 e 6 exigem, cada uma, provar o mecanismo **no site original antes** de compará-lo — sem isso um helper quebrado passaria nos dois lados e o teste mediria nada. Foi assim que três testes desta suíte já nasceram errados; os passos de prova estão explícitos.
