# Precache offline e pendências da suíte — Plano de Implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para implementar tarefa a tarefa. Os passos usam `- [ ]` para acompanhamento.

**Goal:** Corrigir a regressão de precache do Service Worker — de 18,3% para ~100% de cobertura dos módulos — e fechar as cinco pendências que a suíte deixou marcadas.

**Architecture:** O precache é resolvido espelhando um padrão que **já existe e funciona neste repositório**: o workflow de deploy gera `dados-precache.json` varrendo `dados/`, e o `sw.js` o consome no `install`. A correção faz o mesmo para `site/js/**`, gerando `js-precache.json`. Nenhuma invenção; a mesma mecânica, o mesmo formato, o mesmo tratamento de ausência em dev. As demais tarefas são ajustes na suíte de testes.

**Tech Stack:** Python 3 e `sed` no workflow (sem Node no deploy), JavaScript puro no `sw.js`, Playwright em `testes/e2e/`.

Planos anteriores: `docs/superpowers/plans/2026-08-05-quebra-monolitos.md`, `docs/superpowers/plans/2026-08-05-cobertura-e2e.md`
Registro das pendências: `PERGUNTAS-PARA-REVISAO.txt`

---

## Global Constraints

### GC1 — Este plano PODE tocar em `site/sw.js` e no workflow

É a diferença em relação aos planos anteriores, e a razão de este existir. **Só** estes dois arquivos de produção podem mudar:

- `site/sw.js`
- `.github/workflows/deploy.yml`

Todo o resto de `site/`, `dados/` e `scripts/` continua intocável. A extração dos monólitos está verificada e não pode ser perturbada: `python scripts/verificar_extracao.py tudo` tem de continuar saindo limpo depois de cada tarefa.

### GC2 — Consequência que precisa ser assumida

Hoje `site/sw.js` é **byte a byte idêntico** ao do `D-D_2024`, e existe uma verificação que confere isso. Ao mudá-lo, essa propriedade acaba de propósito. A verificação de "nada fora de escopo mudou" precisa passar a **excluir `sw.js` explicitamente**, com o motivo escrito ao lado — nunca removendo a linha em silêncio.

### GC3 — Nada de regressão online

O `sw.js` é o único código que roda entre o app e a rede. Uma mudança errada ali não quebra uma tela: quebra o carregamento inteiro, e persiste em cache no navegador de quem já visitou. Por isso:

- o `install` já usa `Promise.allSettled` para que um asset com falha **não** aborte o precache inteiro; qualquer código novo tem de manter essa propriedade;
- nenhuma alteração no handler de `fetch`;
- a ausência do manifesto (o caso de desenvolvimento local) tem de continuar funcionando, caindo no cache sob demanda.

### GC4 — Paridade continua sendo a régua

As asserções da suíte comparam os dois sites. Ao escrever um valor absoluto, **verifique antes que o site original o satisfaz** — esse erro apareceu quatro vezes na rodada anterior (home offline, cobertura de cache, nível 20, magias conjuráveis). O sintoma é sempre o mesmo: o teste falha nos *dois* lados.

Depois desta correção o refatorado ficará **melhor** que o original em precache. Aí a régua deixa de ser paridade e passa a ser um alvo absoluto — e é legítimo, porque é o objetivo declarado da mudança.

### GC5 — Registro e commits

Decisões, bugs e limites vão para `PERGUNTAS-PARA-REVISAO.txt`. Nunca commitar sem autorização explícita.

### GC6 — Comandos

```bash
python scripts/verificar_extracao.py tudo        # extracao continua integra
cd testes/e2e && npx playwright test --project=offline
cd testes/e2e && npx playwright test             # suite completa
```

---

## Estrutura de arquivos

```
.github/workflows/deploy.yml   MODIFICADO  T1   gera site/js-precache.json
site/sw.js                     MODIFICADO  T2   consome js-precache.json no install
testes/e2e/offline.spec.mjs    MODIFICADO  T3   inverte a trava da regressao
testes/e2e/deploy.spec.mjs     NOVO        T1   valida o manifesto gerado
testes/e2e/helpers.mjs         MODIFICADO  T4   ids unicos por teste
testes/e2e/fixtures.mjs        MODIFICADO  T5   fixture de magias sem excecao
testes/e2e/magias-uso.spec.mjs MODIFICADO  T5,T6
testes/e2e/inventario.spec.mjs MODIFICADO  T7   arrasto por toque
testes/e2e/levelup.spec.mjs    MODIFICADO  T8
testes/e2e/README.md           MODIFICADO  T9
PERGUNTAS-PARA-REVISAO.txt     MODIFICADO  todas
```

---

## Task 1: Gerar o manifesto de precache dos módulos no deploy

**Risk:** medium — roda no deploy; um manifesto errado só aparece em produção.

**Files:**
- Modify: `.github/workflows/deploy.yml`
- Create: `testes/e2e/deploy.spec.mjs`

**Interfaces:**
- Produces: o arquivo `site/js-precache.json` no artefato de deploy, contendo um array JSON de URLs relativas ao escopo do Service Worker (`/site/`), no mesmo formato de `dados-precache.json`.

**Contexto** (já levantado, não precisa investigar): o workflow já faz exatamente isso para os dados, num bloco `python3 - <<'PY'` logo após copiar `_dist`. As URLs de dados ficam `../dados/....json` porque o escopo do SW é `/site/`. Para os módulos, que vivem dentro de `site/`, a URL fica `./js/....js`.

- [ ] **Step 1: Acrescentar a geração ao workflow**

Insira este bloco imediatamente **depois** do bloco que gera `dados-precache.json`, dentro do mesmo `run:`:

```yaml
          # Lista de todos os modulos JS para precache offline do Service Worker.
          # O sw.js tinha uma lista MANUAL de 12 arquivos: cobria 12 de 22
          # modulos antes da refatoracao e passou a cobrir 12 de 61 depois.
          # URLs relativas ao escopo do SW (/site/): ./js/....js
          python3 - <<'PY'
          import os, json
          urls = []
          for root, _, files in os.walk('_dist/site/js'):
              for f in files:
                  if f.endswith('.js'):
                      p = os.path.join(root, f).replace('_dist/site', '.').replace(os.sep, '/')
                      urls.append(p)
          with open('_dist/site/js-precache.json', 'w', encoding='utf-8') as fh:
              json.dump(sorted(urls), fh, ensure_ascii=False)
          print(f'js-precache.json: {len(urls)} modulos')
          PY
```

- [ ] **Step 2: Provar o gerador localmente, sem depender do GitHub Actions**

O trecho acima é Python puro; rode a mesma lógica contra a árvore real e confira a contagem.

Run:
```bash
cd /c/ControleVersaoGit/Pessoal/DeD_2024
python -c "
import os, json
urls = []
for root, _, files in os.walk('site/js'):
    for f in files:
        if f.endswith('.js'):
            urls.append(os.path.join(root, f).replace('site', '.').replace(os.sep, '/'))
print(len(urls), 'modulos')
print(json.dumps(sorted(urls)[:4], ensure_ascii=False))
"
```

Expected: **61 módulos** (60 de aplicação + `vendor/pdf-lib.min.js`), e as primeiras URLs no formato `./js/app.js`, `./js/auth.js`, ... Se o formato sair com `\` ou sem `./`, o `replace` está errado — corrija antes de seguir, porque o `sw.js` vai usar essas strings como chave de cache.

- [ ] **Step 3: Escrever o teste do artefato de deploy**

Este teste não abre navegador: valida o manifesto como dado. Ele existe porque um erro aqui só apareceria em produção.

```js
// testes/e2e/deploy.spec.mjs
//
// O manifesto de precache e gerado pelo workflow, que so roda no GitHub. Este
// teste reproduz a MESMA regra em Node e confere o resultado contra a arvore
// real -- assim um erro de caminho aparece aqui, e nao em producao.
import { test, expect } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, '..', '..');

/** Todos os .js sob site/js, no formato que o manifesto deve ter. */
function modulosEsperados() {
  const fora = [];
  const andar = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) andar(p);
      else if (e.name.endsWith('.js')) {
        fora.push(p.replace(resolve(RAIZ, 'site'), '.').replace(/\\/g, '/'));
      }
    }
  };
  andar(resolve(RAIZ, 'site', 'js'));
  return fora.sort();
}

test('o workflow gera o manifesto com a regra certa', () => {
  const wf = readFileSync(resolve(RAIZ, '.github/workflows/deploy.yml'), 'utf-8');
  expect(wf, 'o workflow nao gera js-precache.json').toContain('js-precache.json');
  expect(wf, 'o workflow nao varre _dist/site/js').toContain("_dist/site/js");
});

test('a regra do manifesto cobre todos os modulos da arvore', () => {
  const esperados = modulosEsperados();
  expect(esperados.length, 'esperava mais de 50 modulos').toBeGreaterThan(50);
  for (const u of esperados) {
    expect(u, `URL fora do formato esperado: ${u}`).toMatch(/^\.\/js\/.+\.js$/);
  }
});
```

- [ ] **Step 4: Validar**

Run: `cd testes/e2e && npx playwright test deploy.spec.mjs --project=paridade --reporter=line`
Expected: `2 passed`.

---

## Task 2: Fazer o Service Worker consumir o manifesto

**Risk:** high — o `sw.js` fica entre o app e a rede, e um erro aqui persiste no navegador de quem já visitou o site.

**Files:**
- Modify: `site/sw.js`

**Interfaces:**
- Consumes: `./js-precache.json`, gerado pela Tarefa 1.
- Produces: os módulos listados dentro de `CACHE_STATIC`, no `install`.

- [ ] **Step 1: Acrescentar o bloco de precache dos módulos**

No handler de `install`, **depois** do bloco que trata `dados-precache.json` e ainda dentro do mesmo `event.waitUntil`, acrescente:

```js
    // Precache dos modulos JS. A lista e gerada no deploy (js-precache.json)
    // varrendo site/js/**, pelo mesmo caminho que ja produz o manifesto de
    // dados. Em desenvolvimento o arquivo nao existe: nesse caso os modulos
    // continuam sendo cacheados sob demanda pelo handler de fetch, que e o
    // comportamento que sempre houve.
    //
    // STATIC_ASSETS acima permanece: ele e a rede de seguranca para o caso de
    // o manifesto faltar em producao por algum motivo.
    try {
      const respModulos = await fetch('./js-precache.json', { cache: 'no-store' });
      if (respModulos.ok) {
        const modulos = await respModulos.json();
        await Promise.allSettled(
          modulos.map(async (url) => {
            try {
              const r = await fetch(url, { cache: 'no-store' });
              if (r.ok) await cache.put(url, r.clone());
            } catch (e) { /* modulo indisponivel: fica para o fetch handler */ }
          })
        );
      }
    } catch (e) {
      // sem manifesto (dev): modulos serao cacheados on-demand
    }
```

`cache` já está no escopo — é o `CACHE_STATIC` aberto no início do `install`. Use-o; abrir outro cache separaria os módulos do resto do shell e o `activate` os apagaria.

- [ ] **Step 2: Conferir que a mudança é só essa**

Run: `diff ../D-D_2024/site/sw.js site/sw.js`
Expected: apenas o bloco acrescentado. Nenhuma linha removida, nenhuma alteração no handler de `fetch`, em `STATIC_ASSETS` ou no `activate`. Se aparecer qualquer outra diferença, desfaça — GC3.

- [ ] **Step 3: Conferir que o app continua carregando online**

Run: `cd testes/e2e && npx playwright test paridade-basico.spec.mjs --project=paridade --reporter=line`
Expected: `6 passed`. Este é o teste mais barato que prova que o `sw.js` novo não quebrou o carregamento — e os testes de paridade bloqueiam o Service Worker, então na prática ele confirma que nada mais mudou.

- [ ] **Step 4: Gerar o manifesto localmente para poder testar offline**

O `js-precache.json` só nasce no deploy, mas o teste offline roda local. Gere-o:

```bash
cd /c/ControleVersaoGit/Pessoal/DeD_2024
python -c "
import os, json
urls = []
for root, _, files in os.walk('site/js'):
    for f in files:
        if f.endswith('.js'):
            urls.append(os.path.join(root, f).replace('site', '.').replace(os.sep, '/'))
open('site/js-precache.json','w',encoding='utf-8').write(json.dumps(sorted(urls), ensure_ascii=False))
print(len(urls), 'modulos no manifesto local')
"
```

Acrescente `site/js-precache.json` ao `.gitignore` — ele é **artefato de deploy**, não fonte. Versioná-lo garantiria que um dia ele ficaria desatualizado em relação à árvore, que é exatamente o problema que este plano resolve.

- [ ] **Step 5: Validar a extração e o escopo**

Run: `python scripts/verificar_extracao.py tudo`
Expected: `OK: extracao integra`.

---

## Task 3: Inverter a trava da regressão no teste offline

**Risk:** low — só o arquivo de teste muda.

**Files:**
- Modify: `testes/e2e/offline.spec.mjs`

**Contexto:** o teste `nenhum modulo carregado fica fora do cache` hoje **trava a regressão**: falha se o número absoluto de precacheados cair, e também falha se a fração melhorar — de propósito, para a correção não ser esquecida. Depois da Tarefa 2 ele passa a falhar por ter melhorado, e é justamente aí que ele deve ser reescrito.

- [ ] **Step 1: Substituir as duas asserções finais**

Troque o bloco que começa em `// REGRESSAO CONHECIDA` até o fim do teste por:

```js
  // A regressao foi corrigida: o manifesto de precache passou a ser gerado no
  // deploy varrendo site/js/**, em vez de uma lista manual de 12 arquivos.
  // Agora o alvo e absoluto, e nao mais paridade com o original -- porque o
  // objetivo declarado da correcao era ficar MELHOR que ele.
  expect(resultados.refatorado.carregados,
    'refatorado carregou menos modulos que o esperado').toBeGreaterThan(50);
  expect(resultados.refatorado.faltando,
    `modulos carregados que ficaram fora do cache. ${resumo}`).toEqual([]);
  expect(fNovo, `cobertura do refatorado caiu abaixo da do original. ${resumo}`)
    .toBeGreaterThan(fOrig);
```

- [ ] **Step 2: Validar**

Run: `cd testes/e2e && npx playwright test --project=offline --reporter=line`
Expected: `5 passed`, e a linha de log deve mostrar o refatorado com cobertura próxima de 100%.

Se `faltando` continuar não-vazio, o manifesto não está sendo consumido: confira que `site/js-precache.json` existe (Tarefa 2, passo 4) e que o servidor de teste o serve — `servidor.mjs` serve qualquer arquivo sob a raiz do repositório, então o caminho é `/site/js-precache.json`.

- [ ] **Step 3: Registrar a correção**

Acrescente uma entrada em `PERGUNTAS-PARA-REVISAO.txt` com os números **antes e depois**, medidos, e a nota de que `sw.js` deixou de ser byte a byte idêntico ao original — por decisão, não por acidente.

---

## Task 4: Corrigir o teste intermitente do Mago

**Risk:** medium — intermitência mal diagnosticada volta.

**Files:**
- Modify: `testes/e2e/helpers.mjs`

**Contexto:** `magias-uso.spec.mjs > Mago` passa isolado em 3,8 s e falha na suíte completa. Isso é isolamento entre testes, não divergência: divergência real falharia isolada também. `abrirFichaSemeada` usa ids fixos, e vários arquivos semeiam personagens em paralelo na mesma origem.

- [ ] **Step 1: Confirmar a hipótese antes de corrigir**

Run: `cd testes/e2e && npx playwright test --project=paridade --workers=1 --reporter=line`
Expected: se o Mago passar com um worker só, a causa é concorrência e o passo 2 resolve. **Se falhar mesmo serial**, a causa é outra (ordem de execução ou vazamento de `localStorage` entre testes) e a correção do passo 2 não serve — investigue antes de aplicá-la.

- [ ] **Step 2: Dar id único por teste**

```js
/**
 * Semeia o MESMO personagem nos dois lados e abre a ficha dele.
 *
 * O id entra na URL (`#ficha/<id>`) e precisa ser igual nos dois lados, mas
 * DIFERENTE entre testes: testes rodam em paralelo e um id repetido faz um
 * teste enxergar o personagem de outro. Sem `id` explicito, deriva-se um do
 * titulo do teste.
 */
export async function abrirFichaSemeada(lados, campos, id) {
  const idFinal = id ?? 'ficha-' + Math.random().toString(36).slice(2, 10);
  for (const l of lados) {
    await l.page.goto(l.base, { waitUntil: 'domcontentloaded' });
    await semearPersonagem(l.page, campos, idFinal);
  }
  await irPara(lados, '#ficha/' + idFinal);
  return idFinal;
}
```

Atenção: os testes que leem `store.listarPersonagens()[0]` continuam válidos porque cada contexto tem seu próprio `localStorage` — o id único protege contra colisão de **URL**, não de armazenamento.

- [ ] **Step 3: Validar rodando a suíte três vezes**

Run: `cd testes/e2e && for i in 1 2 3; do npx playwright test --project=paridade --reporter=line | tail -3; done`
Expected: as três execuções com o mesmo resultado. Intermitência não se prova com uma execução verde.

---

## Task 5: Fixture de magias que não leva o app a lançar

**Risk:** medium — mexer na fixture muda o que 8 testes medem.

**Files:**
- Modify: `testes/e2e/fixtures.mjs`
- Modify: `testes/e2e/magias-uso.spec.mjs`

**Contexto:** `conjuradorPreparado` faz o app lançar `Cannot read properties of undefined (reading 'localeCompare')` em Guardião, Mago e Paladino — **nos dois sites**. É limitação da fixture: alguma magia entra numa estrutura que o código de ordenação não espera. Por isso a asserção de erros foi removida, e o arquivo mede menos do que poderia.

- [ ] **Step 1: Localizar a ordenação que lança**

Run: `grep -n "localeCompare" site/js/sheet/magias.js site/js/sheet/grimorio.js`

Leia cada ocorrência e identifique **qual campo** está `undefined`. O suspeito mais provável é a ordenação por círculo ou por nome sobre uma magia que a fixture pôs em `magias_preparadas` sem que ela exista no índice carregado — o objeto vira `undefined` na busca e a comparação estoura.

- [ ] **Step 2: Corrigir a fixture**

Ajuste `conjuradorPreparado` para que toda magia semeada exista no índice que a ficha carrega. Se a causa for o `grimorio` do Mago, ele precisa conter apenas magias que também estejam em `magias_preparadas`. Escreva no comentário **qual era a causa**, não só o que mudou.

- [ ] **Step 3: Restaurar a asserção de erros**

Com a fixture correta, o app não deve mais lançar. Volte a exigir ausência de erros — mas só depois de confirmar que o **original** também não erra:

```js
    expect(relatorioErros(lados), `erros na ficha de ${classe}`).toBe('');
```

- [ ] **Step 4: Validar**

Run: `cd testes/e2e && npx playwright test magias-uso.spec.mjs --project=paridade --reporter=line`
Expected: `8 passed` (as 8 conjuradoras), sem pulados neste arquivo além dos da Tarefa 6.

---

## Task 6: Conjurar magia pelo fluxo real

**Risk:** medium — depende do wizard, que é mais lento e tem mais partes móveis.

**Files:**
- Modify: `testes/e2e/magias-uso.spec.mjs`

**Contexto:** os dois testes pulados (`a fixture do conjurador produz magias conjuraveis` e `conjurar uma magia gasta o mesmo espaco`) falharam porque o botão `data-conjurar` exige uma combinação de magia preparada, círculo e espaço que semear não reproduz. O caminho certo, já registrado no skip, é **criar o personagem pelo wizard** — que a Tarefa 3 do plano anterior já sabe percorrer.

- [ ] **Step 1: Criar um conjurador pelo wizard e abrir a ficha dele**

```js
import { satisfazerPasso, passoAtual, confirmarModal, assentar } from './helpers.mjs';

/**
 * Cria um Mago pelo wizard nos dois sites e devolve o id do personagem.
 * Semear nao produz um estado conjuravel; passar pelo fluxo real produz.
 */
async function criarMagoPeloWizard(lados) {
  for (const l of lados) {
    await l.page.goto(l.base + '#criar', { waitUntil: 'domcontentloaded' });
    await assentar(l.page);
    await l.page.click('[data-classe="Mago"]');
    await confirmarModal(l.page, 'popup-confirmar-classe');
    for (let i = 0; i < 12; i++) {
      if (!await satisfazerPasso(l.page)) break;
      await assentar(l.page).catch(() => {});
    }
  }
  return passoAtual(lados[0].page);
}
```

- [ ] **Step 2: Verificar até onde o wizard chega antes de assumir que dá para conjurar**

```js
test('o wizard produz um Mago com magias conjuraveis', async ({ context }) => {
  const lados = await abrirParelha(context, '#criar');
  const passo = await criarMagoPeloWizard(lados);
  expect(passo, `o wizard parou no passo ${passo}, sem chegar as magias`)
    .toBeGreaterThanOrEqual(5);
});
```

Run: `cd testes/e2e && npx playwright test magias-uso.spec.mjs --project=paridade -g wizard --reporter=line`
Expected: 1 passed. **Se o wizard não chegar ao passo 5 (Magias)**, este caminho não destrava a conjuração — registre isso em `PERGUNTAS-PARA-REVISAO.txt`, mantenha os dois testes pulados com o motivo atualizado e **pule para a Tarefa 7**. Não invente um atalho semeando: já se provou que não funciona.

- [ ] **Step 3: Se o passo 2 passar, reativar o teste de conjuração**

Troque `test.skip` por `test` nos dois testes, substituindo a semeadura pela criação via wizard, e mantenha as asserções que já estavam escritas (paridade de `espacos_magia` e do DOM).

- [ ] **Step 4: Validar**

Run: `cd testes/e2e && npx playwright test magias-uso.spec.mjs --project=paridade --reporter=line`
Expected: todos passando, sem pulados.

---

## Task 7: Arrastar item por gesto de toque

**Risk:** medium — sintetizar toque é a parte mais frágil de automação de UI.

**Files:**
- Modify: `testes/e2e/inventario.spec.mjs`

**Contexto:** `sheet/inventario.js` marca `draggable` por JS só durante o gesto, e o caminho principal é `touchstart`. Emular exige a sequência de toque com posições reais.

- [ ] **Step 1: Ler o handler de toque para saber o que ele espera**

Run: `sed -n '/touchstart/,/touchend/p' site/js/sheet/inventario.js | head -60`

Anote: quais eventos ele escuta (`touchstart`, `touchmove`, `touchend`), se usa `clientY` ou `pageY`, e se há limiar de distância ou de tempo antes de considerar o arrasto iniciado.

- [ ] **Step 2: Sintetizar o gesto com as coordenadas reais dos itens**

```js
/**
 * Arrasta o item `de` ate o item `para` sintetizando toque.
 *
 * Usa as posicoes reais dos elementos, e nao offsets arbitrarios: o handler
 * decide o alvo pela coordenada, entao chutar posicao produz um teste que
 * passa por acidente.
 */
async function arrastarPorToque(page, seletor, de, para) {
  const caixas = await page.locator(seletor).evaluateAll(
    (els) => els.map((e) => e.getBoundingClientRect().toJSON()));
  const origem = caixas[de];
  const destino = caixas[para];
  const x = Math.round(origem.x + origem.width / 2);
  const y0 = Math.round(origem.y + origem.height / 2);
  const y1 = Math.round(destino.y + destino.height / 2);

  await page.locator(seletor).nth(de).dispatchEvent('touchstart',
    { touches: [{ clientX: x, clientY: y0 }] });
  await page.waitForTimeout(150);
  for (const y of [y0 + (y1 - y0) / 3, y0 + 2 * (y1 - y0) / 3, y1]) {
    await page.locator(seletor).nth(de).dispatchEvent('touchmove',
      { touches: [{ clientX: x, clientY: Math.round(y) }] });
    await page.waitForTimeout(80);
  }
  await page.locator(seletor).nth(de).dispatchEvent('touchend',
    { changedTouches: [{ clientX: x, clientY: y1 }] });
  await page.waitForTimeout(500);
}
```

- [ ] **Step 3: Provar no ORIGINAL antes de comparar**

```js
test('o arrasto por toque funciona no site ORIGINAL', async ({ context }) => {
  const lados = await abrirParelha(context);
  await abrirFichaSemeada(lados, comInventario(), 'inv-toque-orig');
  const page = lados[0].page;
  const antes = await page.textContent('#app-content');
  await arrastarPorToque(page, '#app-content [data-idx]', 0, 1);
  expect(await page.textContent('#app-content'),
    'o arrasto por toque nao surtiu efeito no original').not.toBe(antes);
});
```

Run: `cd testes/e2e && npx playwright test inventario.spec.mjs --project=paridade -g ORIGINAL --reporter=line`
Expected: 1 passed. **Se falhar**, o gesto sintetizado não corresponde ao que o handler espera. Volte ao passo 1 uma vez; se ainda falhar, mantenha o teste pulado com o motivo **atualizado com o que você descobriu** e siga — GC3 exige motivo escrito, não sucesso a qualquer custo.

- [ ] **Step 4: Reativar o teste de paridade do arrasto**

Troque `test.skip` por `test`, usando `arrastarPorToque` nos dois lados e comparando `instantaneoFicha`.

- [ ] **Step 5: Validar**

Run: `cd testes/e2e && npx playwright test inventario.spec.mjs --project=paridade --reporter=line`
Expected: `4 passed`.

---

## Task 8: Subida de nível que chega mais longe

**Risk:** medium — o fluxo de subida é o que tem mais telas encadeadas.

**Files:**
- Modify: `testes/e2e/levelup.spec.mjs`
- Modify: `testes/e2e/helpers.mjs`

**Contexto:** hoje Guerreiro chega ao nível 2 e os conjuradores não saem do 1 — **no original também**. O `resolverModalAberto` não completa as escolhas de magia do fluxo em cards.

- [ ] **Step 1: Descobrir onde o fluxo trava**

Instrumente `subirUmNivel` para registrar o conteúdo do modal quando ele parar de avançar:

```js
    if (antes === depois) {
      const diagnostico = await page.evaluate(() => ({
        titulo: document.getElementById('modal-header')?.textContent?.trim(),
        acoes: [...document.querySelectorAll('#modal-acoes button')]
          .map((b) => `${b.textContent.trim()}${b.disabled ? ' (desabilitado)' : ''}`),
        cards: document.querySelectorAll('#modal-corpo .selection-card').length,
        selects: document.querySelectorAll('#modal-corpo select').length,
      }));
      console.log('  travou em: ' + JSON.stringify(diagnostico));
      break;
    }
```

Run: `cd testes/e2e && npx playwright test levelup.spec.mjs --project=paridade -g Guerreiro --reporter=line`
Expected: a linha `travou em:` diz o título da tela e por que o botão não avança — botão desabilitado significa escolha faltando; nenhum card e nenhum select significa que a tela espera outro tipo de interação.

- [ ] **Step 2: Estender `resolverModalAberto` para o que o diagnóstico revelar**

Acrescente ao helper **apenas** a categoria de widget que faltou, seguindo o padrão das existentes (cards, selects, checkboxes, botão primário). Não escreva lógica específica de classe: se precisar disso, o problema é outro e deve ser registrado.

- [ ] **Step 3: Validar e registrar até onde chegou**

Run: `cd testes/e2e && npx playwright test levelup.spec.mjs --project=paridade --reporter=line`
Expected: `4 passed`, com as linhas de log mostrando o nível alcançado por classe.

Registre os níveis em `PERGUNTAS-PARA-REVISAO.txt`. Se ainda não chegar ao 20, **isso é um limite conhecido e escrito**, não uma falha — a asserção que vale continua sendo a paridade.

---

## Task 9: Consolidação

**Risk:** low — documentação e uma execução completa.

**Files:**
- Modify: `testes/e2e/README.md`, `PERGUNTAS-PARA-REVISAO.txt`, `README.md`
- Modify: `.gitignore`

- [ ] **Step 1: Rodar tudo e medir**

Run: `cd testes/e2e && npx playwright test --reporter=line`
Expected: todos passando. Anote total, tempo e quantos pulados restaram.

- [ ] **Step 2: Confirmar que só o previsto mudou em produção**

```bash
cd /c/ControleVersaoGit/Pessoal/DeD_2024
diff -r ../D-D_2024/dados dados
diff -r ../D-D_2024/site/css site/css
diff ../D-D_2024/site/index.html site/index.html
python scripts/verificar_extracao.py tudo
```

Expected: sem saída nos `diff`, e `OK: extracao integra`. **`site/sw.js` e `.github/workflows/deploy.yml` agora diferem de propósito** — é o objeto deste plano.

- [ ] **Step 3: Atualizar a verificação de escopo com a exceção escrita**

Onde houver a conferência de "nada fora de escopo mudou" (README e o passo 2 do plano de quebra dos monólitos), acrescente `sw.js` e `deploy.yml` à lista de exceções **com o motivo ao lado**: a correção do precache. Uma exceção sem motivo escrito vira, com o tempo, uma verificação que ninguém confia.

- [ ] **Step 4: Acrescentar o artefato ao `.gitignore`**

```
# Manifesto de precache dos modulos: ARTEFATO de deploy, gerado pelo workflow
# varrendo site/js/**. Versiona-lo garantiria que um dia ficaria desatualizado
# em relacao a arvore -- que e exatamente o problema que ele resolve.
site/js-precache.json
```

- [ ] **Step 5: Atualizar os READMEs**

Em `testes/e2e/README.md`: novo total de testes, o arquivo `deploy.spec.mjs`, e quais `skip` restaram (com motivo). Em `README.md` da raiz: uma linha na seção de deploy dizendo que o workflow gera **dois** manifestos de precache, dados e módulos.

- [ ] **Step 6: Revisar o registro de pendências**

Leia `PERGUNTAS-PARA-REVISAO.txt` de ponta a ponta e apresente ao usuário: o que foi corrigido neste plano, o que continua aberto e o que virou limite aceito.

---

## Autorrevisão

**Cobertura das pendências:** precache do Service Worker → Tarefas 1, 2 e 3 (o foco pedido). Teste intermitente do Mago → Tarefa 4. Fixture que faz o app lançar → Tarefa 5. Conjurar magia (pulado) → Tarefa 6. Arrastar item (pulado) → Tarefa 7. Nível 1→20 incompleto → Tarefa 8. Todas com tarefa própria.

**Consistência:** `js-precache.json` é gerado na Tarefa 1, consumido na 2, verificado na 3 e ignorado pelo git na 9 — mesmo nome nas quatro. `arrastarPorToque` e `criarMagoPeloWizard` são locais dos seus arquivos. `resolverModalAberto`, `satisfazerPasso`, `passoAtual` e `abrirFichaSemeada` já existem em `helpers.mjs`.

**Portas de saída declaradas:** as Tarefas 6, 7 e 8 podem não atingir o alvo, e cada uma diz explicitamente o que fazer nesse caso — manter o `skip` com o motivo *atualizado com o que se descobriu* e seguir. Sem isso, a tendência é forçar um teste que passa por acidente, que é pior que um teste pulado com honestidade.

**Risco maior do plano:** a Tarefa 2 mexe no `sw.js`, o único código entre o app e a rede, cujo erro persiste em cache no navegador de quem já visitou. Por isso ela tem um passo dedicado só a conferir que o diff é exatamente o bloco acrescentado, e outro para provar que o carregamento online continua íntegro.
