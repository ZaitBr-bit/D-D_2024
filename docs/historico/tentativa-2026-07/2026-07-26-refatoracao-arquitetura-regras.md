# Refatoração da arquitetura de regras e conteúdo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refatorar o criador e a ficha para um núcleo de domínio, catálogo versionado e sessões isoladas, preservando o comportamento do baseline `e43c5ea`, os dados já salvos, a interface atual, o modo offline e o deploy estático no GitHub Pages.

**Architecture:** A aplicação continuará sendo uma SPA de módulos ES nativos. `core` define resultados, erros e IDs; `content` valida e resolve pacotes; `domain` contém consultas, comandos, efeitos e handlers puros; `features` coordena criador e ficha; `infra` implementa HTTP, armazenamento e sincronização; `ui` contém as adaptações DOM seguras; e `pages` fica restrito à composição das rotas. O modelo interno do personagem será canônico v2, mas a persistência continuará sendo um único registro plano compatível com o baseline.

**Tech Stack:** JavaScript ES2022 em módulos ES nativos, Node.js 22.17+, executor `node:test`, LinkeDOM 0.18.13 apenas para testes DOM Node, YAML 2.9.0 para validar workflows, Ajv 8.20.0, Playwright 1.62.0, Firebase SDK 12.16.0 apenas nos testes Node, Firebase Tools 15.24.0, Python 3.12+ somente para o extrator staging já existente, Java 21 somente para o Firestore Emulator, `localStorage`, Firestore, Service Worker e GitHub Actions/Pages.

## Global Constraints

- Não criar commits automaticamente. O responsável pela execução decide quando e como versionar cada checkpoint.
- Preservar alterações preexistentes no worktree; nunca reverter arquivos fora da tarefa em execução.
- Tratar o commit `e43c5ea` como baseline funcional e de compatibilidade.
- Manter `#home`, `#criar` e `#ficha/<id>`, a URL pública sob `site/`, o layout do artifact com `site/` e `dados/` irmãos e a chave principal `dnd_personagens`.
- Manter desenvolvimento local sem build. Node será obrigatório apenas para testes, validação e preparação do artifact.
- Não adicionar importador/editor de pacotes, multiclasse, novas regras, framework de UI ou execução de JavaScript de usuário.
- Fazer a migração por estrangulamento: adicionar o caminho novo, comprovar paridade e só então retirar o caminho legado correspondente.
- Em tarefas de risco alto, os testes de compatibilidade relacionados devem estar verdes antes da remoção de código ou dados legados.
- Uma consulta, projeção ou renderização nunca pode alterar nem persistir o personagem.
- Toda alteração de personagem deve produzir um novo objeto por comando explícito.
- Conteúdo vindo de JSON deve ser tratado como não confiável, mesmo quando fizer parte do pacote oficial.
- O token de capacidade `officialHandlers` é atribuído pelo composition root e nunca pode ser obtido de manifesto ou entidade JSON.
- O backup pré-migração usa exatamente `dnd_personagens_backup_refatoracao_v2`, é criado uma única vez e nunca é sobrescrito.
- Não atualizar screenshots em uma execução comum. Baselines visuais só mudam com o comando explícito documentado na Task 3.
- Ao concluir cada tarefa, executar primeiro o teste focal e depois o conjunto de regressão indicado.
- Os arquivos `dados/schemas/v1/*.schema.json` são criados como esqueleto na Task 5 e **estendidos incrementalmente** pelas tarefas que introduzem novos campos. Toda tarefa que introduz um campo novo em conteúdo, personagem canônico ou registro persistido deve declarar `Modify: dados/schemas/v1/<arquivo>.schema.json` no seu file list e adicionar o caso Ajv correspondente em `tests/contract/json-schemas.test.js`. Nenhum schema é "exaustivo" antes da tarefa que o completa explicitamente (Task 12 para o personagem, Task 22 para o conteúdo); até lá, tratar qualquer schema como esqueleto extensível, nunca como contrato fechado.
- **Regra de defaults de migração.** Uma migração nunca inventa valor de jogo. Campo legado ausente, `null` ou string vazia produz o equivalente vazio no canônico (`""`, `null`, `[]`, `{}`), preservando a ausência — nunca um valor plausível hardcoded. Defaults de jogo só existem em `createEmptyCharacter()` (criação) e nas consultas derivadas, nunca no decode/migração. Todo par legado→canônico cujo default não for o vazio deve estar listado nominalmente na tarefa que o implementa, com justificativa; um default hardcoded fora dessa lista é defeito de revisão. Todo teste de migração deve cobrir explicitamente o caso do campo ausente/vazio, não apenas o caso preenchido.

## Scope Check

O plano é deliberadamente um plano mestre porque catálogo, modelo persistido, regras, criador, ficha e PWA têm dependências sequenciais e compartilham os mesmos critérios de compatibilidade. Dividi-lo em planos independentes permitiria combinações intermediárias inválidas. Os 37 itens abaixo são checkpoints internos na mesma branch, não releases separados.

---

## Mapa final de arquivos

| Área | Arquivos principais |
|---|---|
| Ferramentas | `package.json`, `package-lock.json`, `scripts/*.mjs`, `playwright.config.js`, `firebase.json` |
| Núcleo | `site/js/core/{result,errors,content-id,validation}.js` |
| Catálogo | `site/js/content/{source,registry,capabilities,validation}.js`, `site/js/content/schemas/runtime-validators.js` |
| Dados canônicos | `dados/schemas/v1/*.schema.json`, `dados/pacotes/dnd2024/**` |
| Domínio | `site/js/domain/character/**`, `site/js/domain/effects/**`, `site/js/domain/commands/**`, `site/js/domain/rulesets/dnd2024/**` |
| Infraestrutura | `site/js/infra/content/**`, `site/js/infra/character/**`, `site/js/infra/sync/**`, `site/js/infra/firebase/**`, `site/js/infra/config.js` |
| Criador | `site/js/features/creator/{creator-session,creator-controller,finalize-character}.js`, `site/js/features/creator/steps/*.js` |
| Ficha | `site/js/features/sheet/{sheet-session,sheet-controller,sheet-view-model}.js`, `site/js/features/sheet/sections/*.js` |
| UI | `site/js/ui/{html,markdown,modal,toast,event-delegation}.js` |
| Entradas | `site/js/app.js`, `site/js/pages/{creator,sheet}.js` |
| Entrega | `site/sw.js`, `scripts/prepare-pages.mjs`, `.github/workflows/{ci,deploy}.yml` |
| Testes | `tests/{unit,contract,integration,firebase,e2e,fixtures}/**` |

## Marco 1 — Ferramentas e caracterização do baseline

### Task 1: Criar o harness Node e o servidor estático de testes

**Risk:** Medium — adiciona ferramentas de desenvolvimento e um servidor de teste, sem alterar o runtime publicado.

**Files:**

- Create: `package.json`
- Create: `package-lock.json`
- Create: `scripts/run-node-tests.mjs`
- Create: `scripts/check-syntax.mjs`
- Create: `scripts/serve-static.mjs`
- Create: `tests/unit/tooling/run-node-tests.test.js`
- Create: `tests/unit/tooling/serve-static.test.js`
- Create: `tests/integration/tooling/static-server-smoke.test.js`
- Modify: `.gitignore`

**Interfaces:**

```js
discoverTestFiles(roots): Promise<ReadonlyArray<string>>
parseServerArgs(argv): { root: string, host: string, port: number }
resolveRequestPath(root, requestUrl): ResolvedRequestPath
createStaticServer({ root, host, port }): Promise<StaticServerHandle>
```

`ResolvedRequestPath` é um discriminated union local do script (`{ ok: true, value } | { ok: false, code, message }`), pois o harness precede o `Result`/`AppError` da Task 4 e não depende do runtime servido.

`package.json` deve fixar exatamente:

```json
{
  "name": "fichas-de-nimb",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=22.17.0"
  },
  "scripts": {
    "check:syntax": "node scripts/check-syntax.mjs",
    "test:files": "node scripts/run-node-tests.mjs",
    "test:unit": "node scripts/run-node-tests.mjs tests/unit",
    "test:contract": "node scripts/run-node-tests.mjs tests/contract",
    "test:integration": "node scripts/run-node-tests.mjs tests/integration",
    "test:node": "node scripts/run-node-tests.mjs tests/unit tests/contract tests/integration",
    "serve:test": "node scripts/serve-static.mjs --root . --host 127.0.0.1 --port 4173"
  },
  "devDependencies": {
    "@playwright/test": "1.62.0",
    "ajv": "8.20.0",
    "ajv-formats": "3.0.1",
    "firebase": "12.16.0",
    "firebase-tools": "15.24.0",
    "linkedom": "0.18.13",
    "yaml": "2.9.0"
  }
}
```

- [ ] Escrever `run-node-tests.test.js` cobrindo arquivos e diretórios como entrada, deduplicação de roots/arquivos repetidos, ordenação determinística, descoberta recursiva apenas de `*.test.js`, raiz inexistente, recusa explícita quando a descoberta produz zero arquivos e propagação do exit code. Argumentos extras nunca são concatenados implicitamente às roots dos scripts `test:unit|contract|integration`.
- [ ] Escrever `serve-static.test.js` cobrindo `/`, `/site/`, MIME de `.js` e `.json`, query string, `404` e bloqueio de `..`.
- [ ] Escrever `static-server-smoke.test.js` para iniciar o servidor em porta efêmera, buscar `site/index.html` e um JSON real sob `dados/`, e encerrá-lo sem deixar handle aberto. Esse teste real cria desde a Task 1 a root `tests/integration`, usada pelo script fixo `test:node`.
- [ ] Executar `node --test tests/unit/tooling/run-node-tests.test.js tests/unit/tooling/serve-static.test.js`; o resultado RED esperado é `ERR_MODULE_NOT_FOUND` para os scripts ainda ausentes.
- [ ] Implementar os dois scripts sem dependência externa. O servidor deve servir a raiz do repositório, nunca aceitar path traversal e encerrar corretamente em `SIGINT`/`SIGTERM`.
- [ ] Implementar `check-syntax.mjs` para descobrir todos os `.js`/`.mjs` em `site/js`, `scripts` e `tests`, incluir explicitamente `site/sw.js` e todo `playwright*.config.js` existente na raiz, chamar `node --check` em ordem estável e devolver exit code diferente de zero ao primeiro erro.
- [ ] Executar `npm install`; confirmar que `package-lock.json` registra as sete versões exatas e não instala dependências no código servido em `site/`.
- [ ] Acrescentar apenas `node_modules/`, `test-results/`, `playwright-report/`, `.firebase/` e `_dist/` ao `.gitignore`.
- [ ] Executar `npm run test:files -- tests/unit/tooling tests/integration/tooling` e `npm run check:syntax`; ambos devem terminar com exit code `0`.

### Task 2: Congelar fixtures e oráculos de compatibilidade

**Risk:** High — estas fixtures passam a definir a compatibilidade do formato persistido e dos cálculos públicos.

**Files:**

- Create: `scripts/assert-baseline-commit.mjs`
- Create: `scripts/capture-baseline-oracles.mjs`
- Create: `tests/fixtures/characters/legacy-minimal.json`
- Create: `tests/fixtures/characters/baseline-field-inventory.json`
- Create: `tests/fixtures/characters/legacy-all-fields.json`
- Create: `tests/fixtures/characters/legacy-po.json`
- Create: `tests/fixtures/characters/legacy-edicoes.json`
- Create: `tests/fixtures/characters/legacy-all-classes.json`
- Create: `tests/fixtures/characters/legacy-known-casters.json`
- Create: `tests/fixtures/characters/legacy-prepared-casters.json`
- Create: `tests/fixtures/characters/legacy-custom-spells-items.json`
- Create: `tests/fixtures/characters/legacy-resources-edits.json`
- Create: `tests/fixtures/characters/legacy-migration-stages.json`
- Create: `tests/fixtures/characters/legacy-unknown-fields.json`
- Create: `tests/fixtures/characters/v2-baseline-compatible.json`
- Create: `tests/fixtures/characters/v2-identity-conflict.json`
- Create: `tests/fixtures/characters/future-v3.json`
- Create: `tests/fixtures/characters/near-limits.json`
- Create: `tests/fixtures/sync/legacy-queue.json`
- Create: `tests/fixtures/expected/derived-values.json`
- Create: `tests/fixtures/expected/command-transitions.json`
- Create: `tests/fixtures/expected/round-trips.json`
- Create: `tests/unit/tooling/assert-baseline-commit.test.js`
- Create: `tests/contract/baseline-fixtures.test.js`

**Fixture contract:**

```js
{
  fixtureVersion: 1,
  compatibilityBaseline: "e43c5ea",
  generatedAt: "2026-07-26T00:00:00.000Z",
  cases: []
}
```

- [ ] Escrever o teste de contrato exigindo casos anonimizados para as 12 classes, conjuradores conhecidos e preparados, itens e magias customizados atuais, recursos, edições, cada migração já existente, campos desconhecidos, schema futuro, fila legada e payload próximo dos limites.
- [ ] Fazer `tests/fixtures/sync/legacy-queue.json` declarar a chave exata `dnd_sync_queue` e conter upsert mais remoção pendente no shape atual.
- [ ] Fazer o teste rejeitar e-mail, UID Firebase, URLs de avatar externas e nomes reais nas fixtures.
- [ ] Executar `node --test tests/contract/baseline-fixtures.test.js`; o RED esperado é a lista dos arquivos de fixture ausentes.
- [ ] Implementar `assert-baseline-commit.mjs` para aceitar captura somente quando `git merge-base --is-ancestor e43c5ea HEAD` for verdadeiro, `git diff --quiet e43c5ea -- site dados` não apontar alteração e `git status --porcelain --untracked-files=all -- site dados` estiver vazio. Assim mudanças committed/staged/unstaged e arquivos untracked de runtime/dados bloqueiam update; mudanças apenas em docs/testes são permitidas.
- [ ] Em `assert-baseline-commit.test.js`, usar repositório temporário e cobrir baseline válido, ancestral ausente, alteração tracked committed/staged/unstaged, arquivo untracked em `site/`, arquivo untracked em `dados/` e mudança somente em docs/testes aceita.
- [ ] Preencher as fixtures a partir do comportamento atual, fixando relógio, IDs e resultados de dados aleatórios. `atualizado_em` precisa aparecer como entrada e saída para caracterizar a semântica atual.
- [ ] Implementar `capture-baseline-oracles.mjs` com modo somente leitura por padrão e escrita apenas com `--update`; antes de qualquer escrita, ele executa e aguarda `assert-baseline-commit.mjs`, e também recusa atualizar qualquer fixture cujo `compatibilityBaseline` não seja `e43c5ea`.
- [ ] Classificar em `baseline-field-inventory.json` todo campo encontrado no template e nos monólitos como `identity`, `build`, `state`, `override`, `metadata`, `compatibilityProjection` ou `legacyPassthrough`; campo não classificado deve falhar o teste.
- [ ] Incluir explicitamente `po`, `pv_temp`, `_slots_magia_livre`, `espacos_magia_extras`, `recursos`, `maestrias_arma`, `manobras_conhecidas`, `iniciado_em_magia`, `iniciado_em_magia_instancias`, `adepto_elemental_tipo`, `adepto_elemental_tipos`, bônus de PV, salvaguardas contra morte e timestamps.
- [ ] Fixar em `near-limits.json` o maior data URL de imagem produzido/aceito pelo fluxo baseline e os limites de payload local/remoto, sem incluir fotografia ou PII; testes de segurança posteriores não podem reduzir esse limite silenciosamente.
- [ ] Registrar em `derived-values.json` CA, PV, iniciativa, perícias passivas, carga, deslocamento, CD/ataque de magia, espaços, recursos e valores exibidos em tela/impressão/PDF. Cada caso separa `baselineObserved: { domainHelper, screen, print, pdf }`, `expectedUnified` e `baselineDifferences`. `expectedUnified` usa o helper público compartilhado existente quando houver e, na ausência dele, o valor da ficha principal; toda convergência posterior deve corresponder exatamente a essa política.
- [ ] Registrar em `command-transitions.json` dano, cura, PV temporário, descansos, concentração, condições, inventário, moedas, recursos, edições e level-up.
- [ ] Executar `npm run test:contract -- tests/contract/baseline-fixtures.test.js`; o resultado esperado é todos os casos aprovados sem aviso de PII.

### Task 3: Caracterizar a interface atual com Playwright

**Risk:** High — os testes e screenshots serão o oráculo da interface pública durante toda a refatoração.

**Files:**

- Create: `playwright.config.js`
- Create: `tests/e2e/helpers/app.js`
- Create: `tests/e2e/helpers/creator.js`
- Create: `tests/e2e/helpers/storage.js`
- Create: `tests/e2e/home.spec.js`
- Create: `tests/e2e/creator.spec.js`
- Create: `tests/e2e/sheet-vitals.spec.js`
- Create: `tests/e2e/sheet-rules.spec.js`
- Create: `tests/e2e/sheet-inventory.spec.js`
- Create: `tests/e2e/import-export.spec.js`
- Create: `tests/e2e/print-pdf.spec.js`
- Create: `tests/e2e/pwa.spec.js`
- Create: `tests/e2e/dom-baseline.spec.js`
- Create: `tests/e2e/visual.spec.js`
- Create: `scripts/run-dom-baseline.mjs`
- Create: `scripts/run-playwright-visual-linux.mjs`
- Create: `tests/contract/visual-baseline-workflow.test.js`
- Create: `.github/workflows/visual-baseline.yml`
- Generate explicitly: `tests/fixtures/dom-baseline/creator-steps.json`
- Generate explicitly: `tests/fixtures/dom-baseline/sheet-sections.json`
- Generate explicitly: `tests/e2e/__screenshots__/**`
- Modify: `package.json`

**Playwright matrix:**

```js
{
  testDir: "./tests/e2e",
  use: {
    baseURL: "http://127.0.0.1:4173/site/",
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    serviceWorkers: "allow",
    trace: "retain-on-failure"
  },
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.002,
      animations: "disabled"
    }
  },
  snapshotPathTemplate:
    "{testDir}/__screenshots__/{projectName}/{testFilePath}/{arg}{ext}"
}
```

Projetos obrigatórios: `chromium-desktop` em `1440×900` para a suíte funcional completa; `chromium-mobile` em `390×844` com toque para testes `@critical` e, na suíte visual separada, visuais móveis; `firefox-critical` e `webkit-critical` apenas para `@critical`. PWA, offline, downloads e PDF executam somente em `chromium-desktop`. O `webServer.command` será `npm run serve:test`.

O `playwright.config.js` codifica a matriz, não apenas a documenta: `chromium-mobile` usa `grep: /@critical|@visual/`; Firefox/WebKit usam `grep: /@critical/` e ignoram `pwa`, download/PDF e visual; os projetos não Chromium ignoram os specs exclusivos de Chromium. A suíte funcional sempre recebe `--grep-invert @visual`. Screenshots são gerados e comparados somente em Linux na imagem `mcr.microsoft.com/playwright:v1.62.0-noble`; uma execução comum no host nunca abre `visual.spec.js`.

- [ ] Escrever helpers que limpam Cache Storage/Service Workers, semeiam `localStorage` antes do primeiro script, congelam relógio/IDs, desabilitam animações e restauram o contexto após cada teste.
- [ ] Executar `npx playwright test tests/e2e/home.spec.js --project=chromium-desktop --reporter=line`; o RED esperado antes do harness é config/spec/helper ausente.
- [ ] Escrever testes RED para home vazia e preenchida, criação completa de Guerreiro e Mago, Draconato com linhagem, os três métodos de atributo hoje ativos (array padrão, point-buy e rolagem), permanência do modo manual desabilitado, equipamentos, grimório e magias.
- [ ] Escrever testes RED da ficha antiga cobrindo dano/cura/PV temporário/descansos, recursos de classe/subclasse, condições/defesas/concentração, moedas/compras/inventário, edição/salvamento/recarga e level-up.
- [ ] Escrever testes RED de importação/exportação e garantir que os downloads sejam parseáveis e preservem os campos das fixtures.
- [ ] Escrever testes RED de impressão e PDF que comparem valores derivados com `derived-values.json`; validar nome do arquivo e tamanho maior que zero.
- [ ] Caracterizar no baseline manifesto, registro/ativação do worker, inventário atual dos caches e recarga offline da home já visitada. As garantias novas para rotas não visitadas, precache completo e atualização atômica entram RED na Task 36.
- [ ] Em `dom-baseline.spec.js`, capturar, apenas com `UPDATE_DOM_BASELINE=1` e baseline `e43c5ea` comprovado, snapshots semânticos das regiões de cada passo do criador e de cada seção da ficha. Entram tag/estrutura, IDs, classes, textos, ordem e uma allowlist explícita de atributos públicos (`name`, tipo/estado/limites de form, acessibilidade, links e mídia normalizados). Atributos `on*`, hooks internos `data-action|data-command|data-intent`, estilo calculado e IDs/timestamps declarados como voláteis ficam fora; seu comportamento é coberto por E2E. O normalizador falha ao encontrar qualquer atributo não classificado na allowlist/denylist, para que a exclusão dos bindings não masque outras diferenças.
- [ ] Escrever screenshots `@visual` de home, cada passo do criador, ficha principal, modais críticos e layouts desktop/móvel. Mascarar somente versão, timestamps e IDs previamente declarados.
- [ ] Executar `npx playwright install chromium firefox webkit`.
- [ ] Implementar `run-dom-baseline.mjs` para definir `UPDATE_DOM_BASELINE=1` de forma cross-platform apenas com `--update`. O modo update chama primeiro `assert-baseline-commit.mjs`; o modo normal falha claramente se qualquer um dos dois oráculos estiver ausente. Gerar `creator-steps.json` e `sheet-sections.json` uma única vez contra `e43c5ea`, executar novamente sem `--update` e exigir comparação byte a byte. O config funcional ignora somente `dom-baseline.spec.js` quando `UPDATE_DOM_BASELINE !== "1"` e pelo menos um dos oráculos está ausente; no modo update ele nunca o ignora.
- [ ] Executar `npx playwright test --grep-invert @visual --reporter=line`; corrigir apenas os testes até toda a caracterização funcional passar contra o código do baseline, agora incluindo a comparação DOM.
- [ ] Implementar `run-playwright-visual-linux.mjs` para recusar qualquer plataforma diferente de Linux e executar por padrão `visual.spec.js` nos projetos `chromium-desktop` e `chromium-mobile`, encaminhando apenas opções permitidas. Quando receber `--update-snapshots`, ele obrigatoriamente executa e aguarda `assert-baseline-commit.mjs` antes de abrir o Playwright; comparação normal continua permitida depois de mudanças em `site/`/`dados/`. Acrescentar ao `package.json`: `"test:e2e": "playwright test --grep-invert @visual"`, `"test:e2e:critical": "playwright test --grep @critical --grep-invert @visual"`, `"test:e2e:dom": "node scripts/run-dom-baseline.mjs"`, `"test:e2e:update-dom": "node scripts/run-dom-baseline.mjs --update"`, `"test:e2e:visual": "node scripts/run-playwright-visual-linux.mjs"` e `"test:e2e:update-snapshots": "node scripts/run-playwright-visual-linux.mjs --update-snapshots"`.
- [ ] Gerar baselines visuais localmente, quando Docker existir, exclusivamente com `docker run --rm --init -v "${PWD}:/work" -v /work/node_modules -w /work mcr.microsoft.com/playwright:v1.62.0-noble bash -lc "npm ci && npm run test:e2e:update-snapshots"`. O volume anônimo evita substituir `node_modules` do host Windows por binários Linux, e o wrapper protegido impede atualização depois de qualquer mudança em `site/` ou `dados/`.
- [ ] Criar `visual-baseline.yml` read-only, acionado pelo primeiro push do próprio workflow na branch `refatoracao` com `paths: [".github/workflows/visual-baseline.yml"]`, por tags `visual-baseline-*` e também por `workflow_dispatch` quando o arquivo já existir na branch padrão. Path filters não se aplicam ao push de tag, permitindo retry; pushes posteriores que alterem `site/`/`dados/` não disparam continuamente esse workflow. Usar `permissions: contents: read`, checkout com `fetch-depth: 0`, Node `22.17.1` e container `mcr.microsoft.com/playwright:v1.62.0-noble`. O job executa o guard, captura os dois oráculos DOM e os screenshots pelos wrappers protegidos, roda novamente `test:e2e:dom` e `test:e2e:visual` sem update na mesma imagem Linux e só então publica `tests/fixtures/dom-baseline/*.json` + `tests/e2e/__screenshots__/**` como artifact; não possui permissão nem passo de commit/push.
- [ ] Em `visual-baseline-workflow.test.js`, usar `YAML.parse` para validar sintaxe e estrutura do workflow, inclusive branch/path exatos, trigger por tag, permissão read-only, imagem/Node exatos, history completo, guard antes de ambos os updates, comparações normais posteriores, artifact e ausência de escrita no repositório. Executar explicitamente `node --test tests/contract/visual-baseline-workflow.test.js` e `npm run check:syntax` antes de pedir o push.
- [ ] Como o host atual não possui Docker, o executor deve pedir ao usuário o checkpoint manual do harness/testes e o push da branch; esse push cria e dispara o workflow. Depois baixa o artifact para o worktree e roda as comparações normais; um novo tag correspondente permite retry sem alterar fonte. Se Docker e esse runner remoto não estiverem disponíveis, a Task 3 fica bloqueada e nenhuma mudança em `site/` ou `dados/` pode começar.
- [ ] Executar novamente `npm run test:e2e -- --reporter=line`; o resultado esperado é zero falhas, pelo menos um teste executado e nenhuma execução/atualização de screenshot. Aceitar a comparação `test:e2e:visual` verde registrada no mesmo job Linux que gerou o artifact (ou repeti-la em Docker Linux); esse gate é obrigatório antes da Task 4 e volta a ser executado no job Linux da Task 36.

## Marco 2 — Contratos, schemas e catálogo

### Task 4: Implementar Result, AppError, IDs e o teste de arquitetura

**Risk:** High — estabelece contratos usados por todas as camadas e torna a direção de dependências uma regra executável.

**Files:**

- Create: `site/js/core/result.js`
- Create: `site/js/core/errors.js`
- Create: `site/js/core/content-id.js`
- Create: `site/js/core/validation.js`
- Create: `site/js/core/semver.js`
- Create: `site/js/core/json-value.js`
- Create: `scripts/check-architecture.mjs`
- Create: `tests/unit/core/result.test.js`
- Create: `tests/unit/core/errors.test.js`
- Create: `tests/unit/core/content-id.test.js`
- Create: `tests/unit/core/validation.test.js`
- Create: `tests/unit/core/semver.test.js`
- Create: `tests/unit/core/json-value.test.js`
- Create: `tests/unit/architecture/dependencies.test.js`
- Modify: `package.json`

**Interfaces:**

```js
ok(value): Result
err(error): Result
isResult(value): boolean
createAppError({ code, scope, message, context }): AppError
serializeAppError(error): JsonObject
createAppWarning({ code, scope, message, context }): AppWarning
serializeAppWarning(warning): JsonObject
parseContentId(value): Result<ContentId, AppError>
formatContentId({ namespace, type, slug }): string
createValidationResult({ errors, warnings }): ValidationResult
mergeValidationResults(results): ValidationResult
parseSemVer(value): Result<SemVer, AppError>
compareSemVer(left, right): -1 | 0 | 1
cloneJsonValue(value): Result<JsonValue, AppError>
isJsonValue(value): boolean
```

- [ ] Escrever testes de imutabilidade dos resultados, `AppError` e `AppWarning`, serialização sem `cause`/personagem completo, IDs ASCII minúsculos no formato `namespace:type:slug`, SemVer estrito e agregação determinística de validações.
- [ ] Fazer `cloneJsonValue` rejeitar `undefined`, funções, `Date`, ciclos e números não finitos.
- [ ] Escrever o teste de arquitetura para analisar imports estáticos e dinâmicos. Ele deve proibir `domain/**` de importar `infra`, `ui`, `features` ou `pages`, e proibir em `domain/**` os globais `window`, `document`, `localStorage`, `fetch` e `firebase`.
- [ ] Executar `node scripts/run-node-tests.mjs tests/unit/core tests/unit/architecture`; o RED esperado é `ERR_MODULE_NOT_FOUND`.
- [ ] Implementar os módulos com objetos congelados e erros estruturados; exceções ficam reservadas a defeitos inesperados.
- [ ] Implementar `check-architecture.mjs` com saída contendo arquivo, import proibido e regra violada.
- [ ] Acrescentar `"check:architecture": "node scripts/check-architecture.mjs"` ao `package.json`.
- [ ] Executar `npm run check:architecture` e `node scripts/run-node-tests.mjs tests/unit/core tests/unit/architecture`; ambos devem passar.
- [ ] Executar `npm run test:e2e:critical -- --project=chromium-desktop --reporter=line`; o baseline crítico deve continuar verde.

### Task 5: Definir JSON Schemas e validação runtime

**Risk:** High — schemas serão a fronteira para conteúdo não confiável e para o formato persistido v2.

**Files:**

- Create: `dados/schemas/v1/common.schema.json`
- Create: `dados/schemas/v1/manifest.schema.json`
- Create: `dados/schemas/v1/index.schema.json`
- Create: `dados/schemas/v1/collection.schema.json`
- Create: `dados/schemas/v1/choice.schema.json`
- Create: `dados/schemas/v1/ruleset.schema.json`
- Create: `dados/schemas/v1/ability.schema.json`
- Create: `dados/schemas/v1/skill.schema.json`
- Create: `dados/schemas/v1/condition.schema.json`
- Create: `dados/schemas/v1/damage-type.schema.json`
- Create: `dados/schemas/v1/language.schema.json`
- Create: `dados/schemas/v1/class.schema.json`
- Create: `dados/schemas/v1/subclass.schema.json`
- Create: `dados/schemas/v1/feature.schema.json`
- Create: `dados/schemas/v1/species.schema.json`
- Create: `dados/schemas/v1/background.schema.json`
- Create: `dados/schemas/v1/feat.schema.json`
- Create: `dados/schemas/v1/spell.schema.json`
- Create: `dados/schemas/v1/spell-list.schema.json`
- Create: `dados/schemas/v1/equipment.schema.json`
- Create: `dados/schemas/v1/weapon.schema.json`
- Create: `dados/schemas/v1/armor.schema.json`
- Create: `dados/schemas/v1/creature.schema.json`
- Create: `dados/schemas/v1/glossary-entry.schema.json`
- Create: `dados/schemas/v1/effect.schema.json`
- Create: `dados/schemas/v1/migration-map.schema.json`
- Create: `dados/schemas/v1/character-canonical-v2.schema.json`
- Create: `dados/schemas/v1/character-record-v2.schema.json`
- Create: `site/js/content/schemas/generated-validators.js`
- Create: `site/js/content/schemas/runtime-validators.js`
- Create: `site/js/content/validation.js`
- Create: `scripts/generate-schema-validators.mjs`
- Create: `scripts/validate-content.mjs`
- Create: `tests/unit/content/runtime-validation.test.js`
- Create: `tests/contract/json-schemas.test.js`
- Create: `tests/fixtures/content/invalid-entities.json`
- Modify: `package.json`

**Interfaces:**

```js
validateManifest(value): ValidationResult
validateIndex(value): ValidationResult
validateEntity(value): ValidationResult
validateEffect(value): ValidationResult
validateCanonicalCharacterV2(value): ValidationResult
validatePersistedCharacterRecordV2(value): ValidationResult
validateReferences({ manifest, index, entities }): ValidationResult
```

Cada função retorna:

```js
{
  valid: true,
  errors: [],
  warnings: []
}
```

O enum inicial de `effect.type` é exatamente `modifier`, `proficiency`, `language`, `defense`, `grant-spell`, `grant-item`, `resource`, `choice`, `condition`, `official-handler` e `manual`. `modifier.operation` aceita somente `set`, `add`, `multiply`, `min` e `max`. Condições aceitam apenas `level`, `choice`, `equipped`, `state-flag`, `all`, `any` e `not`, sem path de propriedade livre.

O enum de entidade comum é exatamente `ruleset`, `ability`, `skill`, `condition`, `damage-type`, `language`, `class`, `subclass`, `feature`, `species`, `background`, `feat`, `spell`, `spell-list`, `weapon`, `armor`, `equipment`, `creature`, `glossary-entry` e `migration-map`.

- [ ] Escrever schemas com `$id`, versão explícita, `additionalProperties` consciente por tipo, IDs qualificados, referências tipadas e vocabulário de efeitos fechado. O manifesto admite caminhos auxiliares tipados em `legacyAdapters`, sem capacidade/confiança. `character-canonical-v2` valida o modelo interno aninhado; `character-record-v2` valida exclusivamente o registro plano persistido.
- [ ] Definir `index.entries` como array ordenado de `{ id, type, path, pointer? }`, nunca como objeto indexado por ID. Escrever casos Ajv válidos e inválidos para cada schema, incluindo `type: "manual"` aceito, tipo de efeito desconhecido rejeitado e entrada integralmente repetida rejeitada por `uniqueItems`.
- [ ] Escrever testes de paridade entre Ajv e a validação runtime gerada para todas as fixtures.
- [ ] Executar `node --test tests/unit/content/runtime-validation.test.js tests/contract/json-schemas.test.js`; o RED esperado é ausência dos schemas e validadores.
- [ ] Implementar `generate-schema-validators.mjs` com Ajv standalone ESM e `ajv-formats`; o módulo gerado é versionado e não importa Ajv no navegador.
- [ ] Implementar `--check` para gerar em memória e falhar quando `generated-validators.js` estiver desatualizado, sem escrever.
- [ ] Implementar o wrapper runtime sobre os validadores gerados, devolvendo paths JSON e ordenação determinísticos.
- [ ] Implementar `validate-content.mjs` com Ajv 2020, carregamento de todos os schemas, validação de IDs/referências/unicidade antes de converter entries em mapa e exit code diferente de zero para qualquer erro. `validateReferences` e o script detectam semanticamente o mesmo `id` em duas entries mesmo quando `path`/`pointer` diferem; o teste cobre essa duplicata que JSON Schema puro não expressa. A checagem usa o array preservado, sem depender de `JSON.parse` de um objeto com chaves repetidas.
- [ ] Acrescentar `"generate:validators": "node scripts/generate-schema-validators.mjs --write"`, `"check:validators": "node scripts/generate-schema-validators.mjs --check"` e `"validate:data": "node scripts/validate-content.mjs"` ao `package.json`.
- [ ] Executar `npm run validate:data`; nesta tarefa ele deve validar os schemas e fixtures existentes, sem ainda exigir o pacote oficial futuro.
- [ ] Executar `npm run test:node`; o resultado esperado é zero falhas.

### Task 6: Implementar ContentSource, capacidades e ContentRegistry atômico

**Risk:** High — é a interface pública preparada para fontes customizadas futuras e a barreira contra handlers executáveis não autorizados.

**Files:**

- Create: `site/js/content/source.js`
- Create: `site/js/content/capabilities.js`
- Create: `site/js/content/official-handler-authorization.js`
- Create: `site/js/content/registry.js`
- Create: `site/js/content/reference-migrations.js`
- Create: `tests/helpers/memory-content-source.js`
- Create: `tests/unit/content/registry.test.js`
- Create: `tests/unit/content/reference-migrations.test.js`
- Create: `tests/unit/architecture/official-capability-imports.test.js`
- Create: `tests/contract/content-source.test.js`
- Create: `tests/fixtures/content/custom-sample-package.json`

**Exact contracts:**

```js
ContentRegistry({
  validator
})
  .registerSource(source, capabilities): Result<void, AppError>
  .initialize(): Promise<Result<void, AppError>>
  .list(type): ReadonlyArray<ContentEntity>
  .get(id): ContentEntity | null
  .resolve(reference, expectedType): Result<ContentEntity, AppError>
  .validateEntity(entity): ValidationResult
  .validatePackage(manifest, index, entities): ValidationResult

createContentRuntime({
  validator,
  handlerRegistry,
  issueOfficialHandlerAuthorization
}): {
  registry: ContentRegistry,
  officialHandlerInvoker: OfficialHandlerInvoker
}
OfficialHandlerInvoker
  .invoke(request): Result<OfficialHandlerResult, AppError>

assertContentSource(value): ValidationResult
createOfficialSourceCapabilities(): SourceCapabilities
hasOfficialHandlersCapability(capabilities): boolean
createOfficialHandlerAuthorizationChannel(): {
  issue,
  verify
}
findReferenceMigrationPath(manifest, fromVersion, toVersion):
  Result<ReadonlyArray<ReferenceMigration>, AppError>
migrateContentReference(reference, choiceRefs, migrationPath):
  Result<MigratedContentReference, AppError>
```

Uma fonte concreta deve oferecer exatamente:

```js
{
  loadManifest,
  loadIndex,
  loadEntity
}
```

com `Promise<Result<T, AppError>>` nos três métodos.

`SourceCapabilities` contém `namespace` concedido pelo composition root e, somente para a fonte oficial, o token opaco `officialHandlers`; não contém booleano ou string que um manifesto possa reproduzir.

- [ ] Escrever testes para registro, inicialização, listagem somente leitura, `get`, `resolve`, tipo incorreto, referência ausente e `CONTENT_VERSION_MIGRATION_REQUIRED`.
- [ ] Escrever testes de atomicidade: uma entidade inválida, referência quebrada ou ID duplicado não pode deixar nenhuma entidade daquela fonte ativa.
- [ ] Escrever testes que permitem apenas uma versão ativa por namespace e proíbem sobrescrita implícita entre fontes.
- [ ] Exigir `manifest.status === "ready"` em `initialize()`; pacote `"building"` pode ser validado pelas ferramentas de staging, mas nunca ativado no registry runtime.
- [ ] Escrever testes de cadeia de migração de referência/escolhas, incluindo migração identidade, lacuna, ciclo e ordem; sem cadeia válida, devolver `CONTENT_VERSION_MIGRATION_REQUIRED`.
- [ ] Escrever o contrato da fonte de memória e usar `custom-sample-package.json` para provar que todos os tipos passam pela mesma interface sem existir importador/UI.
- [ ] Escrever o teste de segurança em que um manifesto customizado declara namespace `dnd2024`, autoria oficial e `officialHandlers`; a invocação deve continuar rejeitada.
- [ ] Escrever testes do handshake com um handler registry fake explícito: `createContentRuntime` mantém a associação fonte→capability em fechamento, entrega `issue` apenas ao `OfficialHandlerInvoker` interno e entrega `verify` ao fake. O invoker emite autorização apenas quando a entidade ativa pertence a fonte oficial e declara exatamente aquele handler. Objeto literal, autorização reutilizada, entity/handler trocado e chamada direta são rejeitados. A injeção do `OfficialHandlerRegistry` real é testada na Task 15.
- [ ] Escrever regra de arquitetura que permita importar/chamar `createOfficialSourceCapabilities()` e `createOfficialHandlerAuthorizationChannel()` somente em `site/js/app-context.js` e nos testes de segurança. `official-content-registry.js`, fontes HTTP, domínio, manifestos e entidades não entram nessa allowlist.
- [ ] Executar `node --test tests/unit/content/registry.test.js tests/unit/content/reference-migrations.test.js tests/contract/content-source.test.js`; o RED esperado é `ERR_MODULE_NOT_FOUND`.
- [ ] Implementar staging privado durante `initialize()` e publicar mapas/listas congelados somente depois de validar o pacote inteiro.
- [ ] Manter o estado fonte→capability compartilhado com o invoker em uma factory/fechamento não exportado por `createContentRuntime`; o construtor público de `ContentRegistry` recebe somente `{ validator }` e não recebe handler nem `issue`.
- [ ] Manter o token de capacidade em fechamento de módulo; `createOfficialSourceCapabilities()` só será chamado pelo composition root e a regra de arquitetura deve tornar isso verificável. Nenhum dado JSON participa dessa decisão.
- [ ] Implementar autorizações opacas, de uso único e presas a `{ entityId, handlerId, operation }`. O `OfficialHandlerInvoker` separado compartilha por fechamento os mapas privados do runtime, emite a autorização e delega a `handlerRegistry.invokeAuthorized()`; o token/canal nunca entra em contexto, Result, log ou JSON. O `ContentRegistry` preserva exatamente seus sete métodos aprovados.
- [ ] Atribuir namespace reservado pelas capabilities do composition root e rejeitar manifesto que tente mudar ou reivindicar namespace alheio.
- [ ] Executar os três testes focais e `npm run check:architecture`; todos devem passar.

## Marco 3 — Pacote oficial estruturado

### Task 7: Criar manifesto, índice e ruleset oficial

**Risk:** High — inicia a nova fonte de verdade das regras e fixa IDs/versão que serão persistidos.

**Files:**

- Create: `dados/pacotes/dnd2024/manifest.json`
- Create: `dados/pacotes/dnd2024/index.json`
- Create: `dados/pacotes/dnd2024/rulesets/core.json`
- Create: `dados/pacotes/dnd2024/rulesets/abilities.json`
- Create: `dados/pacotes/dnd2024/rulesets/skills.json`
- Create: `dados/pacotes/dnd2024/rulesets/conditions.json`
- Create: `dados/pacotes/dnd2024/rulesets/damage-types.json`
- Create: `dados/pacotes/dnd2024/rulesets/languages.json`
- Create: `dados/pacotes/dnd2024/migrations/character-v1-aliases.json`
- Create: `scripts/content/content-id-map.mjs`
- Create: `scripts/content/build-index.mjs`
- Create: `tests/fixtures/content/dnd2024-inventory.json`
- Create: `tests/fixtures/content/dnd2024-id-inventory.json`
- Create: `tests/contract/dnd2024-package.test.js`
- Modify: `scripts/validate-content.mjs`

**Manifest shape:**

```json
{
  "id": "dnd2024",
  "name": "D&D 5.5 (2024)",
  "description": "Pacote de regras D&D 5.5 (2024) suportado pela aplicação.",
  "authors": [
    { "name": "Projeto Fichas de Nimb", "role": "maintainer" }
  ],
  "version": "1.0.0",
  "schemaVersion": "1.0.0",
  "status": "building",
  "entitySchemaVersions": {
    "ruleset": 1,
    "ability": 1,
    "skill": 1,
    "condition": 1,
    "damage-type": 1,
    "language": 1,
    "class": 1,
    "subclass": 1,
    "feature": 1,
    "species": 1,
    "background": 1,
    "feat": 1,
    "spell": 1,
    "spell-list": 1,
    "weapon": 1,
    "armor": 1,
    "equipment": 1,
    "creature": 1,
    "glossary-entry": 1,
    "migration-map": 1
  },
  "entities": [
    "ruleset",
    "ability",
    "skill",
    "condition",
    "damage-type",
    "language",
    "migration-map"
  ],
  "dependencies": [],
  "referenceMigrations": [],
  "legacyAdapters": {
    "characterV1Aliases": "dnd2024:migration-map:character-v1-aliases"
  }
}
```

O índice usa um array ordenado `entries`, no qual cada item tem `{ "id", "type", "path", "pointer" }`. `pointer` é omitido para arquivo de entidade única e obrigatório quando várias entidades compartilham o arquivo. O array é preservado até a verificação de unicidade; só depois disso pode ser convertido em mapa.

`entity.schemaVersion` (campo de cada entidade individual) e `manifest.entitySchemaVersions[type]` (campo do manifesto) devem usar o **mesmo tipo e ser exatamente iguais** para o mesmo tipo de entidade: ambos inteiros, incrementados só quando o shape daquele tipo de entidade muda de forma incompatível. `manifest.version`/`manifest.schemaVersion` (semver string) são conceitos distintos — versão do pacote e versão do formato do manifesto, não a versão de cada tipo de entidade. Caso a implementação real desta tarefa já tenha divergido disso (ex.: entidades com `schemaVersion` como string semver em vez de inteiro), registrar a divergência em `questions-for-review.txt` e reconciliar no mais tardar na Task 37; nenhuma tarefa nova deve introduzir mais dessa divergência.

- [ ] Escrever o teste do pacote exigindo `dnd2024:ruleset:core`, versão `1.0.0`, descrição não vazia, autoria estruturada, ref tipada para `dnd2024:migration-map:character-v1-aliases`, caminhos relativos sem travessia, ordem determinística e nenhum campo de confiança no manifesto. `description`/`authors` são somente apresentação não confiável, passam pelo mesmo escape/sanitização e nunca concedem namespace ou capacidade. Incluir um caso que afirma `entity.schemaVersion === manifest.entitySchemaVersions[entity.type]` para toda entidade do pacote.
- [ ] Escrever `dnd2024-inventory.json` com `activationStatus: "building"`, contagens ativas apenas do ruleset desta tarefa e as contagens finais esperadas separadas: 12 classes, 48 subclasses, número exato de features de classe/subclasse (gravado como inteiro assim que a Task 8 o apurar — nunca deixado como "auditado" em prosa), 11 espécies, 16 antecedentes, 75 talentos, 391 magias, 38 armas, 13 armaduras, 82 itens de aventura e o número exato de criaturas/glossário (idem, gravado como inteiro assim que a tarefa responsável o apurar). A partir do momento em que uma contagem é gravada como inteiro em `dnd2024-inventory.json`, ela é imutável sem revisão explícita; `status: "ready"` (Task 10) compara igualdade estrita contra esse número, nunca contra uma descrição em prosa.
- [ ] Executar `node --test tests/contract/dnd2024-package.test.js`; o RED esperado é pacote oficial ausente.
- [ ] Estruturar `core.json` e as cinco coleções auxiliares com IDs de atributos, perícias, salvaguardas, condições, danos, tamanhos, idiomas, moedas, array padrão, point-buy, progressão de proficiência, XP, descanso e tabelas básicas atualmente hardcoded.
- [ ] Implementar `content-id-map.mjs`, `dnd2024-id-inventory.json` e a entidade `character-v1-aliases.json` (`id: "dnd2024:migration-map:character-v1-aliases"`) com correspondência exata de nomes legados para IDs; o inventário fixa previamente os IDs que as tarefas de staging podem referenciar, e aliases servem somente à migração/fronteira legada.
- [ ] Implementar `build-index.mjs` para ler apenas os tipos ativos no manifesto, gerar array estável e falhar em ID duplicado; escrita só ocorre com `--write`, enquanto `--check` gera em memória e compara bytes com `index.json`.
- [ ] Atualizar `validate-content.mjs` para detectar automaticamente `dados/pacotes/*/manifest.json`. Em `status: "building"`, validar apenas entries/tipos ativos, proibir ativação runtime e comparar as contagens ativas; em `status: "ready"`, exigir inventário final, todo arquivo canônico indexado e zero referência quebrada.
- [ ] Executar `node scripts/content/build-index.mjs --write`, guardar o hash de `index.json`, executar `node scripts/content/build-index.mjs --check` e confirmar que bytes/hash não mudaram.
- [ ] Executar `npm run validate:data` e `npm run test:contract -- tests/contract/dnd2024-package.test.js`; o resultado esperado é aprovação explícita do pacote de staging `"building"`, sem tratá-lo como fonte runtime.

### Task 8: Migrar classes e subclasses para dados mecânicos estruturados

**Risk:** High — substitui regras atualmente espalhadas em constantes, prosa e comparações por nome para todas as classes.

**Files:**

- Create: `dados/pacotes/dnd2024/classes/barbaro.json`
- Create: `dados/pacotes/dnd2024/classes/bardo.json`
- Create: `dados/pacotes/dnd2024/classes/bruxo.json`
- Create: `dados/pacotes/dnd2024/classes/clerigo.json`
- Create: `dados/pacotes/dnd2024/classes/druida.json`
- Create: `dados/pacotes/dnd2024/classes/feiticeiro.json`
- Create: `dados/pacotes/dnd2024/classes/guardiao.json`
- Create: `dados/pacotes/dnd2024/classes/guerreiro.json`
- Create: `dados/pacotes/dnd2024/classes/ladino.json`
- Create: `dados/pacotes/dnd2024/classes/mago.json`
- Create: `dados/pacotes/dnd2024/classes/monge.json`
- Create: `dados/pacotes/dnd2024/classes/paladino.json`
- Create: `scripts/content/migrate-classes.mjs`
- Create: `scripts/content/audit-classes.mjs`
- Create: `scripts/content/dnd2024-index-fragments/classes.json`
- Create: `tests/contract/dnd2024-classes.test.js`
- Create: `tests/fixtures/expected/class-mechanics.json`

**Required class entity fields:**

```js
{
  id,
  type: "class",
  name,
  source: "dnd2024",
  schemaVersion: 1,
  hitDie,
  primaryAbilities,
  savingThrowProficiencyIds,
  proficiencyChoices,
  startingEquipmentChoices,
  levelTable,
  featureRefs,
  subclassChoice,
  spellcasting,
  effects,
  officialHandlerRefs,
  subclasses,
  features
}
```

- [ ] Escrever o teste de paridade para 12 classes e quatro subclasses por classe, comparando dado de vida, proficiências, perícias, equipamento inicial, escolhas, progressão, recursos, conjuração e todas as características do baseline.
- [ ] Fazer o teste rejeitar campos mecânicos inferidos apenas por `description`, listas separadas por vírgula ou nomes de exibição usados como identificadores.
- [ ] Executar `node --test tests/contract/dnd2024-classes.test.js`; o RED esperado lista as 12 entidades ausentes.
- [ ] Implementar `migrate-classes.mjs` como conversor determinístico para staging em memória; os arquivos canônicos só são escritos com `--write` e nunca recebem regras heurísticas não auditadas.
- [ ] Preencher IDs de feature, choice, resource e action estáveis. Cada item de `features` é uma entidade `type: "feature"` embutida no arquivo da classe/subclasse e indexada com `pointer`; `featureRefs` sempre resolve para uma dessas entries. Mecânicas simples usam efeitos declarativos; mecânicas complexas usam `officialHandlerRefs`; texto sem automação usa efeito `manual`.
- [ ] Estruturar todas as opções hoje mantidas em `CLASSES_INFO`, `CLASSES_ESCOLHAS`, `NIVEL_SUBCLASSE` e tabelas de `levelup.js`.
- [ ] Implementar `audit-classes.mjs` para comparar inventário, níveis 1–20, referências de magias/talentos, escolhas obrigatórias e presença de descrição sem usá-la como regra. Referências ainda não ativadas são verificadas contra o inventário de IDs de staging, nunca ignoradas.
- [ ] Gerar deterministicamente `dnd2024-index-fragments/classes.json`; cada subclasse embutida usa `pointer` explícito. Não alterar ainda o manifesto/índice ativo `"building"`.
- [ ] Executar `node scripts/content/audit-classes.mjs`, o teste focal, `node scripts/content/build-index.mjs --check` e `npm run validate:data`; a validação do pacote ativo continua verde e o audit de staging deve provar todas as referências declaradas.

### Task 9: Migrar espécies, antecedentes e talentos

**Risk:** High — essas entidades alimentam escolhas, bônus, concessões e regras hoje identificadas por nomes/prosa.

**Files:**

- Create: `dados/pacotes/dnd2024/species/catalog.json`
- Create: `dados/pacotes/dnd2024/backgrounds/catalog.json`
- Create: `dados/pacotes/dnd2024/feats/catalog.json`
- Create: `scripts/content/migrate-origins-feats.mjs`
- Create: `scripts/content/audit-origins-feats.mjs`
- Create: `scripts/content/dnd2024-index-fragments/origins-feats.json`
- Create: `tests/contract/dnd2024-origins-feats.test.js`
- Create: `tests/fixtures/expected/origins-feats-mechanics.json`

**Mechanical requirements:**

- Espécie: `sizeOptions`, `speedMeters`, sentidos, resistências, magias, recursos, choices e efeitos por ID.
- Antecedente: três atributos elegíveis, formatos de bônus permitidos, perícias, ferramenta/idioma, `featRef`, equipamento e moedas estruturados.
- Talento: categoria, repetibilidade, pré-requisitos, choices, concessões, recursos e efeitos estruturados.

- [ ] Escrever testes de paridade para 11 espécies, 16 antecedentes e 75 talentos.
- [ ] Cobrir explicitamente Draconato, Elfo, Gnomo, Golias, Humano, Tiferino e Kenku, além de todas as instâncias atuais de Iniciado em Magia.
- [ ] Fazer o teste rejeitar extração runtime de deslocamento/tamanho por regex, talento por nome e detecção de escolha a partir de descrição.
- [ ] Executar `node --test tests/contract/dnd2024-origins-feats.test.js`; o RED esperado é catálogo ausente.
- [ ] Implementar conversão para IDs estáveis e revisar manualmente toda regra que o script marcar como `manualReview`.
- [ ] Modelar escolhas incompatíveis e quantidades no próprio conteúdo, incluindo IDs independentes do texto mostrado.
- [ ] Converter regras atuais de `regras-cobertura.js` e `talentos-effects.js` em efeitos ou referências de handler, sem remover ainda as fachadas legadas.
- [ ] Gerar deterministicamente `dnd2024-index-fragments/origins-feats.json` sem alterar ainda o manifesto/índice ativo e executar `node scripts/content/audit-origins-feats.mjs`.
- [ ] Executar o teste focal, `node scripts/content/build-index.mjs --check` e `npm run validate:data`; nenhuma entidade de staging pode ficar com aviso `manualReview`, e referências a magias/equipamentos pendentes devem corresponder ao inventário de IDs esperado.

### Task 10: Migrar magias/equipamentos e tornar a extração staging-only

**Risk:** High — cobre 391 magias, dados econômicos e a ferramenta que hoje pode sobrescrever JSON runtime.

**Files:**

- Create: `dados/pacotes/dnd2024/spells/index.json`
- Create: `dados/pacotes/dnd2024/spells/cantrips.json`
- Create: `dados/pacotes/dnd2024/spells/level-1.json`
- Create: `dados/pacotes/dnd2024/spells/level-2.json`
- Create: `dados/pacotes/dnd2024/spells/level-3.json`
- Create: `dados/pacotes/dnd2024/spells/level-4.json`
- Create: `dados/pacotes/dnd2024/spells/level-5.json`
- Create: `dados/pacotes/dnd2024/spells/level-6.json`
- Create: `dados/pacotes/dnd2024/spells/level-7.json`
- Create: `dados/pacotes/dnd2024/spells/level-8.json`
- Create: `dados/pacotes/dnd2024/spells/level-9.json`
- Create: `dados/pacotes/dnd2024/spells/by-class/bardo.json`
- Create: `dados/pacotes/dnd2024/spells/by-class/bruxo.json`
- Create: `dados/pacotes/dnd2024/spells/by-class/clerigo.json`
- Create: `dados/pacotes/dnd2024/spells/by-class/druida.json`
- Create: `dados/pacotes/dnd2024/spells/by-class/feiticeiro.json`
- Create: `dados/pacotes/dnd2024/spells/by-class/guardiao.json`
- Create: `dados/pacotes/dnd2024/spells/by-class/mago.json`
- Create: `dados/pacotes/dnd2024/spells/by-class/paladino.json`
- Create: `dados/pacotes/dnd2024/equipment/weapons.json`
- Create: `dados/pacotes/dnd2024/equipment/armor.json`
- Create: `dados/pacotes/dnd2024/equipment/adventuring-gear.json`
- Create: `dados/pacotes/dnd2024/equipment/tools.json`
- Create: `dados/pacotes/dnd2024/equipment/services.json`
- Create: `dados/pacotes/dnd2024/equipment/mounts-vehicles.json`
- Create: `dados/pacotes/dnd2024/appendices/creatures.json`
- Create: `dados/pacotes/dnd2024/appendices/glossary.json`
- Create: `.python-version`
- Create: `scripts/content/migrate-spells-equipment.mjs`
- Create: `scripts/content/audit-spells-equipment.mjs`
- Create: `scripts/content/dnd2024-index-fragments/spells-equipment-appendices.json`
- Create: `scripts/run-extractor-contract.mjs`
- Create: `tests/contract/dnd2024-spells-equipment.test.js`
- Create: `tests/contract/extractor-safety.test.js`
- Modify: `_extrair_json.py`
- Modify: `.gitignore`
- Modify: `dados/pacotes/dnd2024/manifest.json`
- Modify: `dados/pacotes/dnd2024/index.json`
- Modify: `tests/fixtures/content/dnd2024-inventory.json`

**Structured fields:**

- Magia: círculo, escola, tempo, alcance, componentes, duração, concentração, ritual, listas, alvo/área e efeitos.
- Arma: categoria, dano, tipo de dano, propriedades, maestria, peso em kg e custo em cobre.
- Armadura: categoria, CA base, modificador permitido, limite de Destreza, Força mínima, furtividade, peso e custo.
- Demais itens: tipo, quantidade, uso, peso, custo e descrição.
- Criatura/glossário: IDs estáveis e todos os campos informativos hoje retornados por `getCriaturas()`/`getGlossario()`, sem promover texto a regra mecânica.

- [ ] Escrever testes para inventário completo, listas de classe, nomes/IDs únicos, criaturas/glossário e equivalência dos campos mostrados pelo criador/ficha e pelos exports de apêndices de `db.js`.
- [ ] Cobrir efeitos de magias atualmente automatizados; converter o restante explicitamente para `manual`, nunca por fallback de tipo desconhecido.
- [ ] Executar os dois testes de contrato; o RED esperado aponta os catálogos e a proteção da extração ausentes.
- [ ] Implementar conversão de custo/peso uma única vez no script, mantendo os valores originais em campos de apresentação quando necessário.
- [ ] Estruturar equipamento inicial por referência e quantidade, eliminando singularização e parsing de opções no runtime canônico.
- [ ] Alterar `_extrair_json.py` para exigir `--source` e `--output`, aceitar como fonte real `Informacoes Separadas/D&D 5.5 - Livro do Jogador (2024) 5.3.7.md` e recusar saída dentro de `dados/pacotes/dnd2024`.
- [ ] Fixar `.python-version` em `3.12` como versão preferencial/reproduzida no CI. Implementar `run-extractor-contract.mjs` para localizar primeiro CPython 3.12 (`py -3.12` no Windows ou `python3.12` nos demais sistemas), depois `py -3`/`python3`/`python`, aceitar qualquer CPython `>=3.12.0 <4.0.0` após consultar sua versão real e expor o executável ao teste. O Python 3.13 do host atual deve passar. Acrescentar `"test:extractor": "node scripts/run-extractor-contract.mjs"` ao `package.json`; o app, o servidor local e o build Pages não dependem de Python.
- [ ] Fazer a extração escrever em `.tmp/content-staging/` somente após validar toda a fonte; falha não pode criar saída parcial. Acrescentar `.tmp/` ao `.gitignore`.
- [ ] Gerar o fragmento de magias/equipamentos/apêndices, unir deterministicamente os três fragmentos de staging ao índice base, mudar o manifesto para `status: "ready"` e listar todos os tipos. Alterar `dnd2024-inventory.json` para `activationStatus: "ready"`.
- [ ] Executar `node scripts/content/build-index.mjs --write`, `node scripts/content/build-index.mjs --check` e `node scripts/content/audit-spells-equipment.mjs`; a segunda geração não pode mudar bytes.
- [ ] Executar `npm run validate:data`, `node --test tests/contract/dnd2024-spells-equipment.test.js`, `npm run test:extractor` e `git diff --check`; todos os arquivos canônicos devem estar indexados, todas as referências resolvidas e todos os testes devem passar.

### Task 11: Implementar a fonte HTTP oficial e a projeção de dados compatível

**Risk:** High — prepara o novo caminho de leitura e todas as projeções legadas, mas ainda não muda o runtime público enquanto os handlers oficiais estão incompletos.

**Files:**

- Create: `site/js/infra/config.js`
- Create: `site/js/app-context.js`
- Create: `site/js/infra/content/http-content-source.js`
- Create: `site/js/infra/content/official-content-registry.js`
- Create: `site/js/infra/content/legacy-db-projection.js`
- Create: `tests/unit/infra/http-content-source.test.js`
- Create: `tests/contract/legacy-db-projection.test.js`
- Create: `tests/integration/app-context-content.test.js`

**Interfaces:**

```js
export const OFFICIAL_CONTENT_BASE_URL =
  new URL("../../../dados/pacotes/dnd2024/", import.meta.url);

HttpContentSource({ baseUrl, fetchFn })
  .loadManifest(): Promise<Result<ContentManifest, AppError>>
  .loadIndex(): Promise<Result<ContentIndex, AppError>>
  .loadEntity(id): Promise<Result<unknown, AppError>>

createOfficialContentRuntime({
  fetchFn,
  handlerRegistry,
  capabilities,
  issueOfficialHandlerAuthorization
}):
  Promise<Result<{
    registry: ContentRegistry,
    officialHandlerInvoker: OfficialHandlerInvoker
  }, AppError>>
appContext.initializeContent({ signal? }):
  Promise<Result<ContentRegistry, AppError>>
projectLegacyDbResult(operation, entities): unknown
```

- [ ] Escrever testes com `fetchFn` controlado para sucesso, 404, JSON inválido, offline, cache por caminho, coleção com `pointer` e nenhuma chamada direta a `window.fetch`.
- [ ] Aceitar somente paths POSIX relativos em ASCII com segmentos allowlisted e extensão `.json`; rejeitar `..`, `.`, barra invertida, `%`, URL absoluta, query e fragmento. Cobrir explicitamente `%2e%2e/evil.json`, `.%2e/evil.json`, `%2e./evil.json`, separadores percent-encoded e escapes malformados.
- [ ] Depois de `new URL(path, baseUrl)`, exigir protocolo/origin iguais aos da base e `pathname` estritamente dentro do `pathname` normalizado de `OFFICIAL_CONTENT_BASE_URL`; a validação final é obrigatória mesmo após a allowlist textual.
- [ ] Escrever testes que comparam cada export atual de `db.js` com a projeção equivalente do catálogo usando as fixtures do baseline.
- [ ] Em `app-context-content.test.js`, provar que o composition root separa `issue`/`verify`, ativa o catálogo com o adapter deny-all e rejeita invocação de handler com `OFFICIAL_HANDLER_UNAVAILABLE` até o wiring real da Task 15.
- [ ] Executar `node --test tests/unit/infra/http-content-source.test.js tests/contract/legacy-db-projection.test.js`; o RED esperado é módulos ausentes.
- [ ] Implementar URL-base relativa a `import.meta.url`; não usar `sed`, host absoluto nem pressupor domínio raiz.
- [ ] Implementar cache de promises por caminho e invalidar a entrada quando o carregamento falhar, permitindo retry.
- [ ] Receber a capacidade oficial por injeção; fonte e factory do runtime não importam nem conhecem a factory do token de confiança.
- [ ] Criar o composition root mínimo em `app-context.js`: ele é o único módulo de produção que chama `createOfficialSourceCapabilities()` e cria `{ issue, verify }`. Ele constrói o handler registry injetando somente `verify` (adapter deny-all explícito nesta tarefa, substituído pelo registry real na Task 15), passa somente `issue` como `issueOfficialHandlerAuthorization` ao `createOfficialContentRuntime`, mantém registry/invoker como portas distintas e expõe inicialização lazy/injetável para testes. Repositório, sync e controllers serão acrescentados nas tarefas posteriores.
- [ ] Implementar `legacy-db-projection.js` preservando nomes, assinaturas, null/array e shapes de todos os exports atuais, inclusive criaturas e glossário, mas manter `site/js/db.js` inalterado nesta tarefa.
- [ ] Executar todos os testes Node e a suíte funcional `@critical`; o app público continua usando os JSON legados até a cobertura total de handlers e o cutover explícito da Task 22.

**Nota de risco entre tarefas:** os testes desta tarefa comparam a projeção contra `db.js` só via fixtures (`tests/contract/legacy-db-projection.test.js`), nunca contra o caminho HTTP real dentro do app rodando. Nenhuma tarefa entre a 12 e a 21 volta a exercitar esse caminho — a Task 22 é a primeira a ligar a projeção ao app vivo. Divergências de `default` entre `db.js` e a projeção (um `null` virando `[]`, um campo ausente virando string vazia, uma ordenação diferente) ficam invisíveis até lá. Ver o checklist de "comparação-sombra" adicionado à Task 22 antes do cutover — essa comparação é obrigatória e não pode ser pulada só porque os testes desta tarefa estão verdes.

## Marco 4 — Modelo canônico, migrações e persistência

### Task 12: Implementar modelo canônico v2, codec, migração e backup

**Risk:** High — altera a interpretação e a serialização de todas as fichas existentes.

**Files:**

- Create: `site/js/domain/character/model.js`
- Create: `site/js/domain/character/validation.js`
- Create: `site/js/infra/character/legacy-alias-resolver.js`
- Create: `site/js/infra/character/legacy-instance-id.js`
- Create: `site/js/infra/character/migrations/v1-to-v2.js`
- Create: `site/js/infra/character/migration-runner.js`
- Create: `site/js/infra/character/character-codec.js`
- Create: `site/js/infra/character/pre-migration-backup.js`
- Create: `tests/unit/character/model.test.js`
- Create: `tests/unit/character/migration-v1-v2.test.js`
- Create: `tests/unit/character/legacy-instance-id.test.js`
- Create: `tests/unit/character/character-codec.test.js`
- Create: `tests/unit/character/pre-migration-backup.test.js`
- Create: `tests/contract/baseline-record-compatibility.test.js`

**Interfaces:**

```js
export const CHARACTER_SCHEMA_VERSION = 2;
export const COMPATIBILITY_BASELINE = "e43c5ea";

createEmptyCharacter({ id, now, rulesetRef }): CanonicalCharacter
validateCanonicalCharacter(character, context): ValidationResult
detectCharacterRecordVersion(rawRecord):
  Result<{ kind: "legacy" | "current" | "future", version: number }, AppError>
migrateCharacterRecord(rawRecord, context):
  Result<CharacterMigrationResult, AppError>
decodeCharacterRecord(rawRecord, context):
  Result<EditableCharacterEnvelope | ReadOnlyCharacterEnvelope, AppError>
encodeCharacterRecord(character, context):
  Result<PersistedCharacterV2, AppError>

export const PRE_MIGRATION_BACKUP_KEY =
  "dnd_personagens_backup_refatoracao_v2";
createPreMigrationBackupService({ storage, tokenFactory })
  .ensure(rawCharactersJson, { safetyExportAuthorization? }):
  Result<{ created: boolean }, AppError>
  .validate(): ValidationResult
  .export(): Result<string, AppError>
  .inspectRestore():
    Result<{ confirmationToken, characterCount, byteLength }, AppError>
  .restore({ confirmationToken, confirmed }):
    Result<void, AppError>
  .prepareSafetyExport(rawCharactersJson):
    Result<{
      jsonText,
      confirmationToken,
      characterCount,
      byteLength
    }, AppError>
  .authorizeMigrationAfterSafetyExport({
    rawCharactersJson,
    confirmationToken,
    confirmed
  }): Result<SafetyExportAuthorization, AppError>

createLegacyAliasResolver(characterV1Aliases): LegacyAliasResolver
deriveLegacyInstanceId({
  characterId,
  collection,
  originalIndex,
  normalizedName
}): string
visitCharacterContentReferences(character):
  ReadonlyArray<{ pointer: string, id: ContentId, packageVersion: string }>
```

Tokens/autorizações de confirmação são opacos, vinculados aos bytes atuais e de uso único; uma nova inspeção, alteração do backup, alteração de `dnd_personagens` por outra aba ou tentativa de restore/migração invalida o anterior. `inspectRestore()` captura tanto os bytes do backup quanto o revision token dos bytes de destino, e `restore()` só substitui o destino se ambos ainda coincidirem. Não há TTL nem relógio oculto. `SafetyExportAuthorization` só permite a persistência migrada quando criar o backup falhou e o usuário baixou e confirmou explicitamente a exportação bruta; não é serializada nem reutilizável.

**Canonical shape:**

```js
{
  schemaVersion: 2,
  identity: {
    id: "char-fixed-id",
    name: "Nome",
    image: "",
    alignment: "",
    size: "", // vazio quando o legado/usuário não escolheu; NUNCA defaultar para "medium" ou qualquer outro valor — ver Regra de defaults de migração nas Global Constraints
    appearance: "",
    personality: "",
    ideals: "",
    bonds: "",
    flaws: "",
    backstory: "",
    notes: ""
  },
  build: {
    contentScopes: {
      dnd2024: { packageVersion: "1.0.0" }
    },
    rulesetRef: { id: "dnd2024:ruleset:core", packageVersion: "1.0.0" },
    classRef: { id: "dnd2024:class:guerreiro", packageVersion: "1.0.0" },
    subclassRef: null,
    speciesRef: { id: "dnd2024:species:anao", packageVersion: "1.0.0" },
    backgroundRef: {
      id: "dnd2024:background:soldado",
      packageVersion: "1.0.0"
    },
    choices: { "dnd2024:choice:example": ["dnd2024:option:example"] },
    // build.abilityGeneration.method é a ÚNICA fonte do método de geração de atributos
    // (enum fechado: "standard" | "pointbuy" | "rolled" | "manual").
    // metadata.creationConfig é um passthrough legado genérico (configuracao_criacao),
    // não um lugar alternativo para o método — não duplicar o valor lá.
    abilityGeneration: {
      method: "standard",
      base: {
        forca: 15,
        destreza: 14,
        constituicao: 13,
        inteligencia: 12,
        sabedoria: 10,
        carisma: 8
      },
      rolls: []
    },
    featRefs: [],
    legacyGrants: {
      skillProficiencyIds: [],
      skillExpertiseIds: [],
      savingThrowProficiencyIds: [],
      languageIds: ["dnd2024:language:comum"],
      toolProficiencyIds: [],
      instrumentProficiencyIds: [],
      otherProficiencies: [],
      resistanceIds: [],
      vulnerabilityIds: [],
      immunityIds: []
    },
    options: {
      encumbranceAffectsMovement: false
    }
  },
  state: {
    level: 1,
    xp: 0,
    // hitPointRolls NÃO faz parte do schema construído por esta tarefa (Task 12) —
    // ver nota abaixo do exemplo: é acrescentado pela Task 23, seguindo a regra de
    // extensão incremental de schemas das Global Constraints.
    abilities: {
      forca: 10,
      destreza: 10,
      constituicao: 10,
      inteligencia: 10,
      sabedoria: 10,
      carisma: 10
    },
    hitPoints: { current: 1, temporary: 0 },
    hitDice: { used: 0 },
    deathSaves: { successes: 0, failures: 0 },
    exhaustion: 0,
    heroicInspiration: false,
    resources: {
      "dnd2024:resource:example": {
        current: 2,
        sourceInstanceId: "legacy:resources:0000:example"
      }
    },
    spells: {
      known: [{
        instanceId: "legacy:spells:0000:missil-magico",
        spellRef: {
          id: "dnd2024:spell:missil-magico",
          packageVersion: "1.0.0"
        },
        sourceInstanceId: "legacy:spell-sources:0000:class"
      }],
      prepared: [],
      spellbook: [],
      slots: { "1": { used: 0 } },
      pactSlots: { used: 0 },
      concentration: null
    },
    inventory: [{
      instanceId: "legacy:inventory:0000:espada-longa",
      itemRef: {
        id: "dnd2024:weapon:espada-longa",
        packageVersion: "1.0.0"
      },
      customDefinition: null,
      quantity: 1,
      equipped: true,
      expended: 0,
      sourceInstanceId: "legacy:item-sources:0000:class"
    }],
    wallet: { pc: 0, pp: 0, pe: 0, po: 0, pl: 0 },
    conditions: [],
    activeEffects: [],
    usageFlags: {}
  },
  overrides: {
    "state.hitPoints.maximum": {
      value: 12,
      original: 10,
      editedAt: "2026-07-26T00:00:00.000Z",
      source: "manual"
    }
  },
  extensions: {
    legacyPassthrough: { campo_legado_preservado: true }
  },
  metadata: {
    createdAt: "2026-07-26T00:00:00.000Z",
    updatedAt: "2026-07-26T00:00:00.000Z",
    creationConfig: {} // passthrough genérico do `configuracao_criacao` legado; não é fonte do método de geração de atributos (ver `build.abilityGeneration.method` acima)
  }
}
```

O exemplo é representativo, não exaustivo: a Task 5 criou `character-canonical-v2.schema.json`/`character-record-v2.schema.json` como esqueleto mínimo (ver Global Constraints), e **é esta tarefa (Task 12) que os estende** até cobrirem exaustivamente o modelo abaixo — a exaustividade só passa a valer, e a ser exigida por teste, a partir daqui. O canônico também cobre `maestrias_arma`, `manobras_conhecidas`, escolhas especiais de classe/espécie/talento, magias e itens customizados por `customDefinition`, origem/proveniência de cada concessão, slots extras (incluindo `_slots_magia_livre`/`espacos_magia_extras`) e recursos e flags de uso específicos das 12 classes. PV rolados por nível (`state.hitPointRolls`) **não** fazem parte do schema construído por esta tarefa — é a Task 23 quem estende `character-canonical-v2.schema.json` para acrescentar esse campo quando implementar progressão/level-up, seguindo a regra de extensão incremental das Global Constraints; não tentar adivinhar ou pré-construir esse campo aqui. Detalhes pessoais ficam em `identity`; proficiências/idiomas/defesas legadas sem origem reconstruível ficam em `build.legacyGrants`; moedas, morte, exaustão, dados de vida, condições, inventário, magia e usos ficam em `state`.

Todo `ContentId` do personagem tem versão definida. Objetos `ContentRef` carregam `packageVersion` explicitamente; IDs nus em arrays, chaves de mapa e escolhas herdam a versão pelo namespace em `build.contentScopes`. Namespace ausente/duplicado ou versão explícita divergente do scope é erro. `visitCharacterContentReferences()` percorre por contrato todos os campos tipados dos schemas, inclusive `legacyGrants.*Ids`, chaves/valores de `choices`, `state.conditions`, recursos, efeitos ativos, magias, inventário, maestrias, manobras e concessões; nenhuma busca genérica por string é permitida.

Máximos de PV, dados de vida, recursos e slots são derivados do ruleset/conteúdo e não são fonte no canônico. Um máximo manual vai para `overrides`; o encoder ainda emite os campos planos de máximo exigidos pelo baseline como projeção descartável. Se algum cache derivado for introduzido, ele deve ter `{ cacheVersion, rulesetVersion, value }`, ser ignorado pelo schema de fonte e poder ser removido sem perda.

- [ ] Escrever testes RED para v1 sem `_schema`, v2, schema futuro, objeto inválido e cada fixture da Task 2.
- [ ] Escrever testes de migração pura, sequencial, idempotente e sem mudança de `atualizado_em`; executar duas vezes deve produzir deep equality.
- [ ] Escrever testes de referência: ID estável prevalece, nome legado é projeção e divergência válida gera `CHARACTER_CONTENT_REFERENCE_CONFLICT`. Para versão de pacote divergente, aplicar a cadeia da Task 6 a cada ocorrência devolvida por `visitCharacterContentReferences()`, inclusive IDs nus/chaves de mapa; somente cadeia ausente, ambígua ou que falhe deixa a ficha somente leitura com `CONTENT_VERSION_MIGRATION_REQUIRED`.
- [ ] Criar um fixture sentinela com ao menos uma referência em cada campo permitido pelo schema e provar que o visitor não omite nenhuma, migra IDs e chaves de mapa deterministicamente e rejeita colisões pós-migração em vez de sobrescrever uma entrada.
- [ ] Aplicar a migração por scope de forma atômica: migrar todas as ocorrências do namespace, validar novamente, atualizar `build.contentScopes[namespace]` e cada `ContentRef.packageVersion` apenas ao final. Qualquer omissão, colisão ou erro mantém o registro bruto/original somente leitura, sem mistura de versões.
- [ ] Escrever round-trip de todo campo conhecido do baseline e de `extensions.legacyPassthrough`; arrays grandes devem existir uma única vez no registro plano.
- [ ] Cobrir normalização legada de moedas, edições, grimório, origem de magia, `_slots_magia_livre`, `espacos_magia_extras`, truques/magias de espécie, escolhas de classe, `Adestrar Animais`, talento versátil, perícias de espécie/talento, Iniciado em Magia e Adepto Elemental.
- [ ] Escrever teste de colisão entre passthrough e campo reservado v2; o resultado deve preservar o bruto e ficar somente leitura/exportável.
- [ ] Escrever testes de backup: chave exata, criação única, nunca sobrescrever, JSON validável, exportar e bloquear migração quando `setItem` falhar por quota. `restore` deve rejeitar sem `confirmed: true`, token desconhecido/consumido, backup alterado depois de `inspectRestore()`, destino `dnd_personagens` alterado por outra instância/aba e JSON inválido; somente confirmação válida com destination revision ainda atual substitui `dnd_personagens`.
- [ ] Testar a alternativa sem espaço da especificação: preparar download da lista bruta mesmo sem backup armazenado, rejeitar autorização sem confirmação/bytes idênticos, e permitir uma única tentativa de persistência migrada depois da confirmação explícita. Se a escrita v2 também falhar, os bytes brutos continuam intactos e uma nova exportação/confirmacão é exigida.
- [ ] Executar os cinco testes focais; o RED esperado é ausência do modelo/codec.
- [ ] Usar `dados/pacotes/dnd2024/migrations/character-v1-aliases.json` como única fonte de aliases para ruleset, classe, subclasse, espécie, antecedente, talento, magia e equipamento. `legacy-alias-resolver.js` apenas consome esse mapa injetado e possui teste de paridade; não duplica aliases em JavaScript. Normalização aproximada não é permitida no codec v2.
- [ ] Atribuir `instanceId` determinístico a inventário, magias, fontes e concessões legadas no formato `legacy:<collection>:<originalIndex-padded>:<normalized-slug>`. O ID usa o índice do array bruto antes de qualquer ordenação, é persistido no primeiro encode v2 e deve permanecer idempotente em migração repetida, inclusive para duplicatas com mesmo nome.
- [ ] Implementar `encodeCharacterRecord` como registro plano com campos do baseline mais `_schema`, `content_refs`, `content_scopes`, `choice_refs` e `overrides`, sem duplicar inventário, magias ou recursos. `content_scopes` (projeção de `build.contentScopes`) é obrigatório no registro persistido — sem ele, um registro migrado para uma versão de pacote nova regride para a versão antiga no próximo decode e ids já migrados podem falhar por alias ausente. `content_refs` deve cobrir **todo** campo que `visitCharacterContentReferences()` visita (incluindo `build.maneuverRefs` e `state.spells.spellbook[*].spellRef`), derivado do próprio visitor — nunca uma lista mantida à mão separadamente, para essa cobertura não poder divergir silenciosamente.
- [ ] Reservar no schema persistido o campo local opcional `_local_sync: { lastMutationId }`, sem colocá-lo no modelo canônico validado (ele nunca deve passar por `validateCanonicalCharacterV2`, que é fechado por `additionalProperties: false` — mantê-lo num envelope separado, ao lado do personagem canônico, não como propriedade dele). O repositório pode anexá-lo ao registro de `localStorage` para reconciliar o outbox; encoder de exportação e gateway remoto o removem. O baseline deve continuar lendo/editando o registro e o round-trip v2 deve preservar o campo enquanto ele estiver no storage.
- [ ] Manter `edicoes` como projeção compatível de `overrides`, **nas duas direções**: ao ler uma edição feita pelo baseline, reconciliar campo plano e override sem perder autoria/data (leitura); e ao codificar um override criado no app novo, projetá-lo de volta para o campo plano `edicoes` correspondente (escrita) — sem a direção de escrita, uma edição feita no app novo fica invisível/revertida na próxima leitura pelo baseline. O mesmo vale para `build.choices`: `escolhas_classe`/`escolhas_antecedente` devem ser regeneradas a partir de `choice_refs` no encode, e o decode nunca pode deixar `choice_refs` desatualizado sobrescrever uma escolha editada nos campos planos.
- [ ] Quando uma reparação v1 for ambígua, criar override explícito com warning; nunca escolher silenciosamente.
- [ ] Para schema superior a 2, devolver `{ mode: "read-only", rawRecord, detectedVersion }` sem normalizar, salvar ou reduzir versão.
- [ ] Executar `node scripts/run-node-tests.mjs tests/unit/character tests/contract/baseline-record-compatibility.test.js` e `npm run validate:data`; todos devem passar.

### Task 13: Implementar repositório local, importação/exportação e fachada store

**Risk:** High — substitui o caminho de leitura/escrita de `dnd_personagens` e precisa ser transacional sob quota/conflito.

**Files:**

- Create: `site/js/infra/character/local-storage-character-repository.js`
- Create: `site/js/infra/character/import-export-service.js`
- Create: `site/js/infra/character/legacy-character-projection.js`
- Create: `site/js/infra/preferences/local-storage-preferences-repository.js`
- Create: `tests/helpers/memory-storage.js`
- Create: `tests/unit/infra/local-storage-character-repository.test.js`
- Create: `tests/unit/infra/legacy-character-projection.test.js`
- Create: `tests/unit/infra/local-storage-preferences-repository.test.js`
- Create: `tests/integration/character-import-export.test.js`
- Create: `tests/e2e/storage-migration.spec.js`
- Modify: `site/js/store.js`
- Modify: `site/js/app.js`
- Modify: `site/js/pages/home.js`

**Repository contract:**

```js
export const LEGACY_CLOUD_BACKUP_KEY = "dnd_personagens_backup";

LocalStorageCharacterRepository({ storage, codec, backupService, clock })
  .initialize({ safetyExportAuthorization? }):
    Result<RepositoryInitialization, AppError>
  .list(): Result<{
    characters: ReadonlyArray<CharacterEnvelope>,
    storageRevisionToken: string
  }, AppError>
  .get(id): Result<CharacterEnvelope | null, AppError>
  .save(character, { expectedRevisionToken, reason, localSyncMutationId? }):
    Result<CharacterEnvelope, AppError>
  .remove(id, { expectedRevisionToken }): Result<void, AppError>
  .replaceAll(records: ReadonlyArray<StorableCharacter>, {
    expectedStorageRevisionToken,
    reason
  }):
    Result<{ storageRevisionToken: string }, AppError>

importCharacterRecords(jsonText, context):
  Result<CharacterImportReport, AppError>
exportCharacterRecords(characters, context): Result<string, AppError>

projectLegacyCharacterEnvelope(envelope): LegacyCharacterRecord
acceptLegacyCharacterMutation(record, context):
  Result<CanonicalCharacter, AppError>
createLegacyStoreFacade({ repository }): {
  list,
  get,
  save,
  remove
}

LocalStoragePreferencesRepository({ storage })
  .getCurrencyRates():
    Result<PreferenceRead<CurrencyRates | null>, AppError>
  .setCurrencyRates(rates): Result<void, AppError>
  .resetCurrencyRates(): Result<void, AppError>
  .getPurchaseEquippedDefault():
    Result<PreferenceRead<boolean>, AppError>
  .setPurchaseEquippedDefault(value): Result<void, AppError>
  .getSheetCollapse(characterId):
    Result<PreferenceRead<SheetCollapseState>, AppError>
  .setSheetCollapse(characterId, value): Result<void, AppError>
  .getLevelUpFlowV2():
    Result<PreferenceRead<boolean>, AppError>
  .setLevelUpFlowV2(value): Result<void, AppError>

resolveLevelUpFlowV2({ globalFeatureFlags, preferences }):
  Result<PreferenceRead<boolean>, AppError>
```

`StorableCharacter` é `{ mode: "editable", character } | { mode: "read-only", rawRecord, detectedVersion, warnings }`. O primeiro é validado/encodado como v2; o segundo só pode vir do codec/importador e é reemitido byte semanticamente idêntico, sem downgrade. Ambos os modos de `CharacterEnvelope` contêm `revisionToken` e `recordFingerprint`; no modo editável eles acompanham `character`, e no read-only acompanham `rawRecord`, `detectedVersion` e `warnings`. `revisionToken` é a precondição opaca de escrita, permanece apenas em memória e nunca é persistido/exportado. `recordFingerprint` é um SHA-256 não autorizador dos bytes exatos, pode ser copiado somente para o outbox interno e nunca entra em ficha, export ou cloud. Criação exige `expectedRevisionToken: null`; atualização/remoção exigem o token retornado por `get/list`; importação/replace exige `expectedStorageRevisionToken`. Remover um registro futuro usa seu token sem tentar decode adicional, encode ou downgrade. Antes de escrever, o repositório relê e compara a serialização atual, eliminando colisões de timestamp no mesmo milissegundo e recusando revisões stale entre abas. `reason` é `"user"`, `"migration"` ou `"sync"`; apenas `"user"` atualiza `atualizado_em`, enquanto migração estrutural o preserva. `localSyncMutationId`, quando presente, é validado, gravado somente em `_local_sync.lastMutationId` e devolvido apenas como metadado do envelope editável; nunca entra no canônico.

`PreferenceRead<T>` é `{ value: T, warnings: ReadonlyArray<AppWarning> }`. As preferências mantêm exatamente os formatos/chaves atuais: `dnd_taxas_moeda`, `dnd_comprar_ativo_padrao` (`"1"|"0"`), `sheet_collapse_<id>` e `feature.levelup.flow.v2`. Para level-up, tanto a flag global quanto o storage leem, sem distinguir caixa/espaços, `1|true|on|sim` como true e `0|false|off|nao|não` como false; a escrita canônica continua sendo somente `"true"|"false"`. Defaults exatos: taxas `null` (motor usa tabela padrão), compra equipada `false`, colapso `{ equipados: false, mochila: false, esgotados: false, detalhes: false, truques: true }` e level-up v2 `true`. `window.__FEATURE_FLAGS__.LEVELUP_FLOW_V2` válido continua tendo precedência; valor global ausente/inválido cai para storage, e somente storage ausente/inválido usa o default. Valores inválidos retornam warning e nunca são regravados silenciosamente.

- [ ] Escrever testes com `memory-storage` para inicialização explícita, lista/get sem efeitos, criação, atualização, remoção, conflito de revisão, quota e falha de serialização.
- [ ] Classificar quota como `LOCAL_STORAGE_QUOTA_EXCEEDED`, distinta de corrupção, validação e conflito.
- [ ] Escrever teste de JSON local corrompido; o repositório deve retornar erro e manter os bytes exportáveis, nunca tratar corrupção como lista vazia.
- [ ] Provar que `list()` e `get()` nunca escrevem em armazenamento e que um save falho mantém exatamente os bytes anteriores.
- [ ] Testar duas escritas no mesmo milissegundo: token da primeira leitura conflita depois da primeira escrita mesmo com `atualizado_em` igual. Token nunca é persistido nem exportado; fingerprint é determinístico, muda com qualquer byte e só aparece no envelope/outbox permitido.
- [ ] Testar a fachada legada com duas instâncias/abas: ela associa cada objeto plano devolvido ao `revisionToken` por `WeakMap` privado para save e mantém também `Map<id, revisionToken>` privado, populado exclusivamente por `list/get`, para a assinatura histórica `remove(id)`. Objeto existente clonado ou sem associação falha com conflito/reload em vez de reler token atual; remove sem token previamente observado ou com token stale também falha. Objeto novo marcado pela factory usa token `null`; save bem-sucedido atualiza ambos os mapas e remove bem-sucedido apaga a entrada por ID. Nenhum Symbol/token aparece em JSON, export ou enumeração.
- [ ] Testar remoção concorrente de envelope editável e de v3 read-only; a segunda aba recebe conflito quando usa token stale, e a remoção válida do raw future não tenta encodá-lo nem alterar seus bytes antes de excluir.
- [ ] Escrever integração de importação para array legado, v2, duplicado, inválido, schema futuro, passthrough, conflito reservado e payload grande.
- [ ] Preservar a semântica atual de importação parcial: JSON/shape de arquivo inválido falha sem escrita; em array válido, registros válidos são aceitos e registros inválidos são rejeitados individualmente. Definir retorno como `Result<{ imported, duplicates: [{ index, id, kind: "existing" | "payload", firstIndex? }], readOnly, rejected: [{ index, id, errors }], warnings }, AppError>` e mostrar/exportar o relatório; a primeira ocorrência válida de um ID vence, como no baseline, e nenhuma rejeição/duplicata pode ser silenciosa. O merge de editáveis e raw read-only aceitos é persistido por uma única escrita atômica; falha mantém todos os bytes anteriores.
- [ ] Testar importação/replace/export de v3 read-only preservando exatamente todas as propriedades e arrays, sem passar pelo encoder v2, junto de um v2 válido na mesma escrita.
- [ ] Testar que exportação editável e payload remoto removem `_local_sync`, enquanto leitura/save local preservam o marcador validado; colisão desse nome no passthrough é reservada e nunca sobrescrita silenciosamente.
- [ ] Testar todas as preferências/defaults com reload, valores corrompidos + warning, precedência da feature flag global, falha de quota e isolamento de colapso por personagem. Nenhuma migração pode renomear, apagar ou reformatar essas chaves.
- [ ] Preservar e testar separadamente `backupPersonagensLocais()`/`restaurarPersonagensLocais()` com `LEGACY_CLOUD_BACKUP_KEY`: criar a cópia pré-login somente quando a chave está ausente, nunca sobrescrevê-la, restaurar os bytes do backup em `dnd_personagens` e remover a chave apenas depois de restore bem-sucedido. Esse fluxo nunca lê, sobrescreve ou remove `dnd_personagens_backup_refatoracao_v2`; os dois backups coexistem e não podem ser confundidos.
- [ ] Executar os testes Node focais; o RED esperado é módulo ausente.
- [ ] Implementar `initialize()` para ler bytes brutos, criar/validar o backup antes da primeira persistência v2, migrar em memória, validar tudo e escrever uma única vez.
- [ ] Se o backup ou a escrita falhar, manter registros brutos disponíveis para exportação e bloquear qualquer adoção parcial.
- [ ] Converter `store.js` em fachada de compatibilidade sobre `createLegacyStoreFacade`, preservando assinaturas/retornos atuais e adicionando `initializeCharacterStorage({ safetyExportAuthorization? }): Promise<Result<...>>`, `exportarBackupRefatoracao()`, `restaurarBackupRefatoracao()`, `prepararExportacaoBrutaSeguranca()` e `confirmarExportacaoBrutaSeguranca()`. Enquanto criador/ficha legados existirem, leituras devolvem somente a projeção plana associada ao token e saves legados passam por `acceptLegacyCharacterMutation`; o modelo canônico não é duplicado no storage.
- [ ] Delegar as exportações atuais de taxas e compra equipada ao novo repositório e expor a mesma porta para colapso da ficha/feature flag de level-up. O monólito ainda pode usar diretamente as mesmas chaves até o cutover, mas não pode criar um segundo formato nem migrá-las.
- [ ] Remover migrações e saves implícitos de `listarPersonagens()`. No boot, `app.js` aguarda `appContext.initializeContent()`, obtém registry + entidade de aliases, constrói codec/repository e só então aguarda `initializeCharacterStorage()` antes de renderizar a primeira rota; falha em qualquer etapa mostra estado recuperável e não inicia controllers.
- [ ] Adaptar `home.js` para mostrar erro/readonly/warnings e o relatório de rejeições sem alterar o caminho normal. Se o backup existe, oferecer baixar/validar/restaurar `dnd_personagens_backup_refatoracao_v2`, com preview/token e confirmação. Se a criação falhou e a chave não existe, oferecer “Exportar dados brutos” e, somente após download + confirmação, repetir a inicialização com `SafetyExportAuthorization`; nunca mostrar restore de backup inexistente.
- [ ] Executar `node --test tests/unit/infra/local-storage-character-repository.test.js tests/integration/character-import-export.test.js`.
- [ ] Executar `npx playwright test tests/e2e/storage-migration.spec.js tests/e2e/home.spec.js tests/e2e/import-export.spec.js --project=chromium-desktop --reporter=line`; todas as fixtures devem permanecer exportáveis e recarregáveis.

### Task 14: Separar fila de sync e testar o gateway Firestore real no Emulator

**Risk:** High — envolve compatibilidade da fila persistida, conflitos remotos e a garantia de nunca tocar o projeto Firebase real nos testes.

**Files:**

- Create: `firebase.json`
- Create: `.java-version`
- Create: `scripts/check-firebase-prerequisites.mjs`
- Create: `tests/firebase/firestore.rules`
- Create: `site/js/infra/firebase/firebase-browser.js`
- Create: `site/js/infra/firebase/firestore-character-gateway.js`
- Create: `site/js/infra/sync/sync-queue.js`
- Create: `site/js/infra/sync/merge-character-records.js`
- Create: `site/js/infra/sync/durable-character-mutation.js`
- Create: `tests/unit/sync/sync-queue.test.js`
- Create: `tests/unit/sync/merge-character-records.test.js`
- Create: `tests/unit/sync/durable-character-mutation.test.js`
- Create: `tests/firebase/firestore-character-gateway.test.js`
- Create: `tests/firebase/sync-queue-firestore.test.js`
- Create: `tests/contract/firebase-emulator-workflow.test.js`
- Create: `.github/workflows/firebase-emulator-check.yml`
- Modify: `site/js/auth.js`
- Modify: `site/js/sync.js`
- Modify: `site/js/pages/home.js`
- Modify: `package.json`

**Interfaces:**

```js
export const SYNC_QUEUE_KEY = "dnd_sync_queue";
export const REMOTE_BACKUP_COLLECTION = "personagens_backup_v1";

createFirestoreCharacterGateway({ db, uid, api, codec }): FirestoreCharacterGateway
gateway.list():
  Promise<Result<ReadonlyArray<RemoteCharacterEnvelope>, AppError>>
gateway.upsert(characterEnvelope):
  Promise<Result<{ characterId: string, updatedAt: string, remoteBackup: "created" | "already-existed" | "not-applicable" }, AppError>>
gateway.remove(characterId):
  Promise<Result<void, AppError>>
createSyncQueue({
  storage,
  gateway,
  characterRepository,
  connectivity,
  scheduler,
  codec
}): SyncQueue
syncQueue.initialize(): Result<SyncSnapshot, AppError>
syncQueue.enqueueUpsert(characterEnvelope):
  Result<{ jobId: string, snapshot: SyncSnapshot }, AppError>
syncQueue.enqueueRemoval({ characterId, updatedAt }):
  Result<{ jobId: string, snapshot: SyncSnapshot }, AppError>
syncQueue.prepareMutation({
  mutationId,
  operation,
  character?,
  characterId,
  expectedRevisionToken
}): Result<{ preparationId: string, snapshot: SyncSnapshot }, AppError>
syncQueue.confirmPrepared(preparationId):
  Result<{ jobId: string, snapshot: SyncSnapshot }, AppError>
syncQueue.reconcilePrepared():
  Result<SyncSnapshot, AppError>
syncQueue.getSnapshot(): Readonly<SyncSnapshot>
syncQueue.flush(): Promise<Result<SyncSnapshot, AppError>>
syncQueue.retry(failureId): Promise<Result<SyncSnapshot, AppError>>
syncQueue.subscribe(listener): () => void
syncQueue.dispose(): void
createDurableCharacterMutation({
  repository,
  syncQueue,
  mutationIdFactory
}): DurableCharacterMutation
durableMutation.save(character, options):
  Result<{ envelope: CharacterEnvelope, syncState: "queued" | "reconciliation-needed" }, AppError>
durableMutation.remove(characterId, options):
  Result<{ syncState: "queued" | "reconciliation-needed" }, AppError>
mergeCharacterRecords({
  localRecords,
  remoteRecords,
  pendingDeletionIds
}): CharacterMergeResult
```

`CharacterMergeResult` é `{ merged: ReadonlyArray<StorableCharacter>, toUpsert: ReadonlyArray<characterId>, toRemoveLocally: ReadonlyArray<characterId>, warnings: ReadonlyArray<AppWarning> }`. `merged` é a lista final a adotar localmente; `toUpsert` é exatamente o subconjunto onde o local venceu por ser estritamente mais novo — esses IDs precisam ser reenfileirados para reenvio, não apenas adotados. Um merge que devolve só `merged` sem `toUpsert` é incompleto: o registro mais novo do usuário fica adotado localmente mas nunca chega ao servidor.

`SyncSnapshot = { status: "idle" | "sincronizando" | "ok" | "erro" | "offline", pending: number, prepared: number, failures: ReadonlyArray<{ failureId, characterId, operation, code, retryable, occurredAt }>, lastSyncedAt: string | null }`. Mapeamento determinístico para `status`: `failures.length > 0` domina e produz `"erro"` mesmo com `pending === 0`; senão, sem conectividade produz `"offline"`; senão `pending > 0 || prepared > 0` produz `"sincronizando"`; senão `pending === 0 && failures.length === 0` produz `"ok"`. `failureId` é derivado da identidade persistida do job (não um contador em memória), para sobreviver a reload e permitir `retry(failureId)` depois de recarregar a página.

`enqueueUpsert`/`enqueueRemoval` só retornam sucesso depois de persistir a fila localmente. Para mutações novas, `DurableCharacterMutation` grava antes um job `prepared` não enviável, tenta o repository e só então o confirma. O job contém `mutationId`, operação e precondição; upsert confirmado é reconhecido por `_local_sync.lastMutationId`, e remoção confirmada pela ausência do registro que possuía o revision token esperado. Assim, uma falha ao regravar a fila depois do save não perde o intent: `initialize/reconcilePrepared` o promove ou classifica conflito de forma determinística. Um prepare que falha não permite save; um save que falha deixa o job não enviável e reconciliável/descartável. Essa preparação interna não altera o fluxo observável aprovado: somente depois do save local o estado é adotado e o job pode ir à rede.

`flush` faz rede fora do caminho de save; falhas recebem `failureId` estável, aparecem em `SyncSnapshot.failures` e alimentam `retry`. Depois de `dispose`, scheduler/subscriptions não executam nova tentativa.

O gateway decodifica cada documento remoto pelo codec antes de devolvê-lo; `upsert` aceita somente envelope editável validado/encodável e nunca reduz schema futuro. Ao adotar merge remoto, a fila chama `characterRepository.list()`, calcula o merge e usa `replaceAll(..., { expectedStorageRevisionToken, reason: "sync" })`. Conflito relê/recalcula ou permanece como falha retryable; não existe escrita local direta que contorne o token.

**Backup remoto pré-migração** (mesma motivação e o mesmo desenho do `PreMigrationBackupService` local da Task 12, para fechar a assimetria: hoje só o `localStorage` tem rede de segurança antes de uma gravação v2 sobrescrever o dado anterior — o documento remoto em `users/{uid}/personagens/{charId}` não tem). Antes do **primeiro** `upsert` v2 de cada personagem, `gateway.upsert()` verifica se já existe `users/{uid}/${REMOTE_BACKUP_COLLECTION}/{charId}`; se não existir e o documento em `users/{uid}/personagens/{charId}` já existir (isto é, há algo a perder), copia esse documento **verbatim, sem decodificar nem transformar**, para o backup, na mesma escrita atômica (`WriteBatch`/transação) que grava o documento v2 — as duas escritas têm que ter sucesso juntas, ou nenhuma acontece. Uma vez criado, o backup nunca é sobrescrito nem atualizado (mesma semântica "criado uma única vez" do backup local); se o personagem nunca foi sincronizado antes (documento remoto ainda não existe), não há nada para copiar e `upsert` prossegue direto (`remoteBackup: "not-applicable"`). Se a escrita do backup falhar, `upsert` falha inteiro (fail-closed) — nunca grava o v2 sem o backup ter sido garantido primeiro. A restauração deste backup é um caminho manual/operacional (leitura direta do documento pelo console do Firebase ou por um script futuro), não uma função exposta na UI nesta tarefa — o objetivo aqui é garantir que o dado pré-migração remoto sempre exista em algum lugar recuperável, não construir um fluxo de restore completo para ele.

- [ ] Fixar `.java-version` em `21` e configurar Emulator Firestore em `127.0.0.1:8085`, projeto obrigatório `demo-dnd-refactor` e rules de teste separadas das regras de produção.
- [ ] Em `tests/firebase/firestore.rules`, isolar `users/{uid}/personagens_backup_v1/{charId}` pelo mesmo dono de `users/{uid}/personagens/{charId}`, mas permitir apenas `create` (documento inexistente) a partir do client; negar `update` e `delete` explicitamente, para que nem um bug no client nem um usuário mal-intencionado consigam apagar/alterar o próprio backup depois de criado. Testar as quatro combinações (create em documento ausente, create em documento já existente, update, delete) contra o Emulator.
- [ ] Fazer o preflight externo abortar com erro claro se Java 21 não estiver ativo ou `firebase.json`/project configurado não for `demo-dnd-refactor`. Já dentro de `firestore-character-gateway.test.js`, sob `emulators:exec`, abortar se `FIRESTORE_EMULATOR_HOST` estiver ausente ou o project ID não começar por `demo-`.
- [ ] No setup do teste com o SDK Web, chamar `connectFirestoreEmulator(db, "127.0.0.1", 8085)` imediatamente depois de `getFirestore()` e antes de qualquer leitura/escrita; a variável de ambiente é guard adicional, não o mecanismo de conexão.
- [ ] Escrever testes do gateway para upsert, listagem, remoção, documento grande demais e isolamento de `users/{uid}/personagens`.
- [ ] Testar assinaturas/Results do gateway, decode v1/v2/futuro na listagem, recusa de upsert read-only e preservação de erro estruturado sem lançar por falha operacional.
- [ ] Testar o backup remoto pré-migração contra o Emulator real: primeiro upsert de um personagem já existente remotamente cria `users/{uid}/personagens_backup_v1/{charId}` com os bytes exatos do documento anterior; segundo upsert do mesmo personagem não recria nem sobrescreve o backup; upsert de um personagem nunca sincronizado antes não cria backup (`remoteBackup: "not-applicable"`); a criação do backup e a gravação do documento v2 acontecem na mesma escrita atômica — simular falha da escrita do backup (regra de segurança negando o subcaminho, por exemplo) e confirmar que o documento v2 também não é gravado, nunca uma gravação parcial.
- [ ] Classificar limite remoto como `REMOTE_DOCUMENT_TOO_LARGE`; o registro permanece local e a fila retém o erro sincronizável.
- [ ] Escrever testes da fila para upsert, remoção, retry, offline, fila legada `{ id, dados, tentativas }`, erro remoto, serialização v2 e remoção pendente que não reaparece.
- [ ] Semear a fixture legada exatamente em `localStorage["dnd_sync_queue"]` e migrar in-place/atomicamente, preservando inclusive `{ acao: "remover" }`; proibir segunda chave, perda de pendência ou limpeza antes de persistência válida. Um job legado migrado nasce **já confirmado/enviável** (nunca em estado `prepared`), com `mutationId: null` e `expectedRevisionToken: null`; `reconcilePrepared` pula (não classifica como conflito) qualquer job com `mutationId === null`, já que ele nunca passou pelo protocolo de preparo desta tarefa.
- [ ] Escopar a fila por `uid`: cada job persistido registra o `uid` que o originou; `initialize()`/`flush()` recusam e colocam em quarentena (não descartam, não enviam) qualquer job cujo `uid` divirja do usuário atualmente autenticado. Testar explicitamente logout com fila não vazia seguido de login como outro usuário — nenhum job do usuário anterior pode ser enviado para o `users/{uid}/personagens` do novo usuário.
- [ ] Limitar a no máximo um job não confirmado (`prepared`) por `characterId`: uma segunda preparação para o mesmo personagem coalesce sobre a existente em vez de criar um job irmão. Testar duas gravações offline consecutivas do mesmo personagem e confirmar que isso não produz um conflito espúrio no reload.
- [ ] Fixar a regra de `atualizado_em` ausente/inválido no merge: comparação usa `Date.parse` com guarda `Number.isFinite`; um lado com `atualizado_em` ausente, vazio ou não-ISO nunca é tratado como "mais antigo" nem como "mais novo" por default — é um conflito retido como falha retryable (nunca um vencedor silencioso). Testar explicitamente os casos ausente, string vazia e valor não-ISO dos dois lados.
- [ ] Testar contrato operacional completo: initialize idempotente, enqueue durável antes de retorno, subscription ordenada, snapshot congelado, `failureId` estável, flush concorrente coalescido, retry, scheduler cancelado e dispose.
- [ ] Testar o protocolo preparado para upsert e remoção: falha de prepare impede escrita local; falha local nunca libera o job; save local válido + falha de `confirmPrepared` mantém o estado adotável e, após reload, `reconcilePrepared` recupera o intent pelo mutation ID/ausência. Uma mutação concorrente com outro marker vira conflito explícito, nunca envio ou descarte silencioso.
- [ ] Passar todo documento v1 vindo do Firestore e todo upsert v1 já persistido na fila pelo mesmo codec/migrador v1→v2 da Task 12 antes de merge ou envio. Testar migração idempotente, schema futuro somente leitura/exportável e falha sem escrita parcial.
- [ ] Escrever merge por `atualizado_em`: local estritamente mais novo vence e é reenviado; em empate ou remoto mais novo, remoto vence, preservando o baseline.
- [ ] Testar adoção remota através do repository com `expectedStorageRevisionToken`, incluindo conflito concorrente entre merge e escrita de outra aba; nenhuma atualização local pode ser perdida ou escrita por acesso direto ao storage.
- [ ] Executar `node scripts/run-node-tests.mjs tests/unit/sync`; o RED esperado é módulos ausentes.
- [ ] Implementar gateway por injeção da API Firebase; o módulo de domínio/queue não importa SDK nem URL CDN.
- [ ] Manter `auth.js` como fachada browser que carrega os módulos CDN atuais e injeta as operações no gateway; não alterar login Google nem configuração de produção.
- [ ] Converter `sync.js` em fachada sobre a nova fila, preservando status `idle | sincronizando | ok | erro | offline` e as exportações existentes.
- [ ] Em `sync-queue-firestore.test.js`, ligar `SyncQueue`/repository de memória ao gateway real do Emulator, semear `dnd_sync_queue` no shape legado, provar migração + upsert, remoção pendente que não reaparece e as duas direções do conflito por `atualizado_em`.
- [ ] Acrescentar `"test:firebase:preflight": "node scripts/check-firebase-prerequisites.mjs"` e `"test:firebase": "npm run test:firebase:preflight && firebase emulators:exec --only firestore --project demo-dnd-refactor \"node --test tests/firebase/firestore-character-gateway.test.js tests/firebase/sync-queue-firestore.test.js\""` ao `package.json`. O preflight não exige `FIRESTORE_EMULATOR_HOST`, pois essa variável só é injetada no processo filho. O CI/fallback remoto instala Java 21; localmente o comando falha com instrução objetiva em vez de usar Java 8 por acidente.
- [ ] Criar `firebase-emulator-check.yml` read-only, acionado pelo primeiro push do próprio workflow na branch `refatoracao` com `paths: [".github/workflows/firebase-emulator-check.yml"]`, por tags `firebase-emulator-*` e também por `workflow_dispatch` quando disponível. Usar checkout com `fetch-depth: 0`, Node `22.17.1`, `actions/setup-java` com Temurin 21, `npm ci`, `npm run test:firebase` e upload dos logs do Emulator; não incluir credencial, commit, push ou projeto que não comece por `demo-`.
- [ ] Em `firebase-emulator-workflow.test.js`, usar `YAML.parse` e afirmar estruturalmente branch/path exatos, trigger por tag, permissões `contents: read`, checkout completo, versões exatas, comando e ausência de segredo/deploy; incluir entrada YAML inválida e provar que o parser falha. Executar explicitamente `node --test tests/contract/firebase-emulator-workflow.test.js` e `npm run check:syntax` antes de pedir o push.
- [ ] Como o host atual possui Java 8, executar localmente `npm run test:firebase:preflight` e exigir a falha orientativa. O executor então pede ao usuário um checkpoint/push manual e usa o resultado verde de `firebase-emulator-check.yml`; um novo tag correspondente permite retry sem alterar fonte. Com Java 21 local, pode executar diretamente `npm run test:firebase`. Sem um desses resultados com zero falhas e somente o projeto `demo-dnd-refactor`, a Task 14 permanece bloqueada.
- [ ] Executar `node scripts/run-node-tests.mjs tests/unit/sync` e os E2E `home.spec.js`/`storage-migration.spec.js`; falha de sync não pode reverter um save local válido.

## Marco 5 — Domínio puro de regras e comandos

### Task 15: Implementar o motor determinístico de efeitos declarativos

**Risk:** High — processa conteúdo não confiável e passa a controlar valores derivados e concessões.

**Files:**

- Create: `site/js/domain/effects/effect-predicates.js`
- Create: `site/js/domain/effects/collect-effects.js`
- Create: `site/js/domain/effects/resolve-effects.js`
- Create: `site/js/domain/effects/apply-grants.js`
- Create: `site/js/domain/effects/official-handler-registry.js`
- Create: `site/js/domain/effects/index.js`
- Modify: `site/js/app-context.js`
- Modify: `dados/schemas/v1/effect.schema.json`
- Modify: `dados/pacotes/dnd2024/classes/*.json`, `dados/pacotes/dnd2024/species/catalog.json`, `dados/pacotes/dnd2024/backgrounds/catalog.json`, `dados/pacotes/dnd2024/feats/catalog.json` (acrescentar `priority`/`stackKey`/`stackable` aos efeitos que já existem)
- Create: `tests/unit/domain/effect-predicates.test.js`
- Create: `tests/unit/domain/effect-ordering.test.js`
- Create: `tests/unit/domain/effect-grants.test.js`
- Create: `tests/unit/domain/official-handler-security.test.js`

**Interfaces:**

```js
validateEffectSemantics(effect, context): ValidationResult
evaluateEffectCondition(condition, context): Result<boolean, AppError>
collectCharacterEffects(character, context):
  Result<ReadonlyArray<ResolvedEffect>, AppError>
resolveNumericTarget({ target, baseValue, effects, context }):
  Result<number, AppError>
resolveSetTarget({ target, baseIds, effects, context }):
  Result<ReadonlySet<string>, AppError>
applyGrantEffects(character, effects, context):
  Result<{
    character: CanonicalCharacter,
    applied: ReadonlyArray<GrantChange>,
    warnings: ReadonlyArray<AppWarning>
  }, AppError>
revokeGrantEffects(character, { sourceInstanceIds }, context):
  Result<{
    character: CanonicalCharacter,
    removed: ReadonlyArray<GrantChange>,
    warnings: ReadonlyArray<AppWarning>
  }, AppError>
```

`OfficialHandlerRegistry({ verifyAuthorization })` oferece `register(handlerId, handler)` e `invokeAuthorized({ authorization, handlerId, entityId, operation, payload, context })`. Não existe `invoke` público sem autorização; chamadas de domínio usam a porta separada `OfficialHandlerInvoker.invoke(request)` criada pelo runtime da Task 6.

**Extensão obrigatória de `effect.schema.json` nesta tarefa** (ver Global Constraints — schemas são estendidos incrementalmente): acrescentar a todos os `$defs` de efeito `priority` (`integer`, opcional, ausência equivale a `0`) e, para efeitos de conjunto/concessão (`proficiency`, `language`, `defense`, `grant-spell`, `grant-item`, `resource`, `condition`), `stackKey` (mesmo `pattern` de `localSlug` usado em `modifierEffect.target`, opcional) e `stackable` (`boolean`, default `true`). Ausência de `stackKey` significa que o efeito **sempre acumula** e nunca é filtrado por deduplicação. Regravar os fragmentos de efeito já gerados pelas Tasks 8–10 (`dados/pacotes/dnd2024/classes/*.json` e os catálogos de espécie/antecedente/talento) para incluir esses campos onde a mecânica real do baseline exigir ordenação ou não-acúmulo explícito, e reexecutar `npm run validate:data`. Levantar em `tests/fixtures/expected/class-mechanics.json`/`origins-feats-mechanics.json` todo efeito do baseline que hoje não acumula (ex.: dois bônus da mesma fonte não somam) e exigir `stackKey` explícito nesses casos; um efeito sem `stackKey` que deveria não acumular é falha de teste.

**Vocabulário único de "alvos derivados"** (usado por `modifierEffect.target`, por `overrides` do personagem canônico — Task 12 — e pela allowlist de edição — Task 17): o path do efeito (ex.: `hp.maximum`, `ac`, `speed.walk`, `ability.forca.score`) é a **única** representação canônica. `overrides` no personagem usa exatamente o mesmo vocabulário de path do efeito (não `state.hitPoints.maximum` nem qualquer variante ad hoc), e a Task 17 deriva sua allowlist de edição da mesma lista fechada, nunca duplicando-a. Qualquer path de exemplo em outra tarefa do plano que divirja desse vocabulário (ex.: `"state.hitPoints.maximum"` na Task 12) deve ser lido como o path do efeito equivalente (`"hp.maximum"`), não copiado literalmente.

`resolveSetTarget` cobre três operações, não apenas união: `add-ids` (acrescenta, sujeito a `stackKey`/`stackable`), `remove-ids` (subtrai por ID) e `replace-ids` (substitui o conjunto inteiro na prioridade em que ocorre). Dentro do mesmo grupo de precedência, `remove-ids` na mesma prioridade que um `add-ids` do mesmo ID é erro (ambíguo), não escolha implícita por ordem de array. O grupo de override manual deve poder remover um ID concedido por um grupo de prioridade menor (ex.: classe) — testar esse caso explicitamente.

`revokeGrantEffects` é o inverso exato de `applyGrantEffects`, indexado pelos mesmos `sourceInstanceId`s aplicados. Aplicar e depois revogar as mesmas concessões, com a mesma proveniência, deve produzir deep equality com o personagem anterior à aplicação. IDs de proveniência usados em `applyGrantEffects`/`revokeGrantEffects` devem ser determinísticos (mesma família de fórmula que `legacy:<collection>:<index>:<slug>` da Task 12) — um ID gerado aleatoriamente a cada recomputo faz "grants idempotentes" duplicarem a cada chamada em vez de convergir.

- [ ] Escrever testes para os quatro grupos de precedência: base; classe/espécie/antecedente/talento; equipamento/temporário; override manual.
- [ ] Dentro de um grupo, testar `priority` crescente e desempate por ID estável; prioridades maiores são aplicadas por último.
- [ ] Fixar e testar a resolução numérica de cada grupo: resolver `set` válido pela ordem de prioridade; filtrar `stackKey`; somar todos os `add`; somente depois aplicar todos os `multiply` na ordem estável; por fim aplicar o maior limite inferior de `min` e o menor limite superior de `max`. `min > max` e dois `set` conflitantes na mesma prioridade são erros, não escolhas implícitas.
- [ ] Testar que todos os `add` precedem todos os `multiply` mesmo quando as prioridades se intercalam, que limites mais restritivos vencem, além das três operações de conjunto (`add-ids`/`remove-ids`/`replace-ids`) e `stackKey` acumulável/não acumulável.
- [ ] Testar predicados fechados, paths permitidos, valores serializáveis e bloqueio de `__proto__`, `prototype` e `constructor`.
- [ ] Testar grants idempotentes de proficiência, idioma, resistência, magia, item e recurso, sempre com proveniência por source/instance ID determinístico.
- [ ] Testar `revokeGrantEffects` como inverso exato de `applyGrantEffects`: aplicar e revogar as mesmas concessões pela mesma proveniência produz deep equality com o estado anterior; revogar concessões de uma fonte não afeta concessões de outra fonte.
- [ ] Manter o resultado de grants independente de `CommandResult`, que só nasce na Task 17; os comandos posteriores adaptam `{ character, applied/removed, warnings }` para seus próprios `events/affected`.
- [ ] Testar `manual` como projeção sem mutação e tipo desconhecido como erro.
- [ ] Testar handler oficial válido e as recusas para fonte sem capacidade, manifesto falsificado, entity ID alheio, action ID não registrado, autorização forjada/reutilizada ou presa a outra operação.
- [ ] Executar os quatro testes; o RED esperado é ausência dos módulos.
- [ ] Implementar sem `eval`, `Function`, acesso livre a paths ou mutação dos argumentos.
- [ ] Fazer o `OfficialHandlerInvoker` consultar por fechamento a capacidade interna associada à entidade no catálogo e emitir a autorização de uso único; `OfficialHandlerRegistry` apenas verifica/consome essa autorização. Substituir no `app-context.js` o adapter deny-all da Task 11 pelo registry real construído com `verify`, mantendo `issue` somente no runtime/invoker. Testar aqui o wiring real `issue`→invoker e `verify`→registry. Namespace, autoria e campos JSON não participam da autorização.
- [ ] Executar os testes focais, `npm run check:architecture` e `npm run validate:data`; todos devem passar.

### Task 16: Extrair as consultas puras de personagem

**Risk:** High — substitui cálculos replicados em `utils.js`, criador, ficha, impressão e PDF.

**Files:**

- Create: `site/js/domain/character/queries/abilities.js`
- Create: `site/js/domain/character/queries/hit-points.js`
- Create: `site/js/domain/character/queries/combat.js`
- Create: `site/js/domain/character/queries/proficiencies.js`
- Create: `site/js/domain/character/queries/movement.js`
- Create: `site/js/domain/character/queries/defenses.js`
- Create: `site/js/domain/character/queries/senses.js`
- Create: `site/js/infra/character/legacy-query-adapter.js`
- Create: `site/js/domain/character/queries/skills.js`
- Create: `site/js/domain/character/queries/index.js`
- Create: `tests/unit/domain/character-queries.test.js`
- Create: `tests/unit/infra/legacy-query-adapter.test.js`
- Create: `tests/contract/derived-values-parity.test.js`
- Modify: `site/js/utils.js`

**Interfaces:**

```js
getAbilityModifier(character, abilityId, context): Result<number, AppError>
getProficiencyBonus(character, context): Result<number, AppError>
getHitPointProjection(character, context): Result<HitPointProjection, AppError>
getArmorClass(character, context): Result<number, AppError>
getInitiative(character, context): Result<number, AppError>
getMovement(character, context): Result<MovementProjection, AppError>
getSkillProjection(character, skillId, context):
  Result<SkillProjection, AppError>
getDefenses(character, context): Result<DefenseProjection, AppError>
getSenses(character, context): Result<SensesProjection, AppError>
```

`HitPointProjection`, `MovementProjection`, `SkillProjection`, `DefenseProjection` e `SensesProjection` não são shapes livres: cada campo que essas projeções expõem deve corresponder a uma chave nomeada em `tests/fixtures/expected/derived-values.json` (criar `tests/fixtures/expected/sheet-view-model-keys.json` derivado dele, se ainda não existir, como lista única de chaves). Tasks 29 e 33 consomem essas mesmas projeções e não podem inventar campos que não estejam nessa lista nem readaptar o personagem diretamente para obter um valor ausente — se um valor necessário (CD de magia, percepção passiva, capacidade de carga restante) não está numa projeção existente, a lista é estendida aqui, não contornada depois.

`legacy-query-adapter.js` **deve** ser implementado por cima de `decodeCharacterRecord` (Task 12) e apenas reformatar sua saída — nunca reimplementar normalização de campos legados (`pv_temp`/`pv_temporario` e equivalentes) de forma independente do codec. Um teste explícito compara `legacy-query-adapter`'s saída com `decodeCharacterRecord(...).character` para cada fixture legada da Task 2, incluindo `legacy-unknown-fields.json` e as duas grafias de PV temporário.

`getMovement` recebe `context.encumbranceLevel`, calculado exclusivamente pela projeção de inventário da Task 19 (`getInventoryProjection`) — Task 16 não reimplementa soma de peso/capacidade de carga; se a Task 19 ainda não existir quando esta tarefa for executada, `getMovement` aceita `context.encumbranceLevel` como parâmetro já calculado e o teste de paridade usa um valor fixado pela fixture, nunca um cálculo local duplicado.

- [ ] Escrever testes que congelam profundamente personagem e contexto e falham se qualquer consulta mutar os argumentos.
- [ ] Comparar todas as fixtures com `tests/fixtures/expected/derived-values.json`, usando `expectedUnified`; preservar `baselineObserved` apenas como auditoria das divergências antigas.
- [ ] Testar o adapter de `infra` projetando o registro plano recebido pelos consumidores antigos para o canônico sem persistir, sem criar recursos e sem duplicar arrays; queries de domínio nunca recebem nem conhecem o shape legado diretamente. Testar que o adapter é deep-equal a `decodeCharacterRecord(...).character` para toda fixture legada da Task 2.
- [ ] Cobrir armaduras, escudos, defesa sem armadura, exaustão, carga, sobrecarga, tamanhos, sentidos, resistências, perícias/expertise e overrides.
- [ ] Executar os testes focais; o RED esperado é módulos ausentes.
- [ ] Extrair cada cálculo da implementação atual e substituir lookup textual por IDs/parâmetros do ruleset.
- [ ] Não inicializar recursos, ajustar PV, salvar nem corrigir registros durante consulta.
- [ ] Manter em `utils.js` apenas reexports/adaptadores de assinatura para consumidores ainda legados; marcar esses adapters para revisão/remoção na Task 37.
- [ ] Executar os testes focais e `npx playwright test tests/e2e/sheet-vitals.spec.js --project=chromium-desktop --reporter=line`; valores e aparência devem permanecer iguais.

### Task 17: Implementar comandos de PV, descanso, condições e edições

**Risk:** High — concentra mutações de estado de uso diário e precisa preservar todas as transições do baseline.

**Files:**

- Create: `site/js/domain/commands/command-result.js`
- Create: `site/js/domain/commands/command-dispatcher.js`
- Create: `site/js/domain/commands/hit-points.js`
- Create: `site/js/domain/commands/rest.js`
- Create: `site/js/domain/commands/conditions.js`
- Create: `site/js/domain/commands/edit-character.js`
- Create: `tests/unit/domain/hit-points-commands.test.js`
- Create: `tests/unit/domain/rest-commands.test.js`
- Create: `tests/unit/domain/condition-commands.test.js`
- Create: `tests/unit/domain/edit-character-command.test.js`
- Create: `tests/contract/command-transition-parity.test.js`

**Command contract:**

```js
{
  ok: true,
  character: nextCharacter,
  events: [],
  affected: []
}
```

ou:

```js
{
  ok: false,
  character: originalCharacter,
  events: [],
  affected: [],
  error
}
```

`executeCharacterCommand(character, command, context)` é o único dispatcher público. `affected` está presente e é sempre um array (nunca `undefined`) em **ambos** os branches — vazio na falha, por definição, já que nada mudou. Cada elemento de `affected` é o mesmo path canônico usado pelo vocabulário de alvos derivados da Task 15 (ex.: `"hp.current"`, `"state.conditions"`) — nunca um ID de seção de UI. A Task 29 (`sheet-command-map.js`) é quem mapeia esses paths para `dirtySections`, com um teste garantindo que todo path emitido pelas Tasks 17/18/19 tem pelo menos uma seção registrada.

**Allowlist de edição** (comando `edit-character`): os paths editáveis são exatamente os classificados como `override` em `tests/fixtures/characters/baseline-field-inventory.json` (Task 2), expressos no vocabulário de alvos derivados da Task 15 — não uma lista nova inventada aqui. `overrides` no personagem canônico usa esse mesmo vocabulário de path (ex.: `"hp.maximum"`, não `"state.hitPoints.maximum"`).

- [ ] Escrever testes de não mutação e referência lógica original em toda falha.
- [ ] Cobrir dano com absorção de PV temporário, cura, definição de PV temporário, override de máximo, dados de vida, descanso curto/longo e salvaguardas contra morte conforme baseline.
- [ ] Cobrir adicionar/remover condição por ID e recargas estruturadas de recursos.
- [ ] Cobrir edições somente na allowlist derivada de `baseline-field-inventory.json`; bloquear prototype pollution, valores não finitos e paths de identidade canônica sem comando específico.
- [ ] Implementar e testar o **write-back** do override para o campo plano legado, não só a leitura: ao codificar (Task 12's `encodeCharacterRecord`) um override criado por este comando, projetá-lo de volta para o campo plano `edicoes`/campo de máximo correspondente, com a mesma autoria/data. Testar, por caminho alistado (não "representativo"): `edit-character` → `encode` → leitura pelo app baseline (`e43c5ea`) → salvamento pelo baseline → `decode` no app novo preserva valor, autor e data. Um override que só existe na leitura e nunca é escrito de volta é falha desta tarefa, não um detalhe futuro.
- [ ] Comparar todas as transições com `command-transitions.json`.
- [ ] Executar os testes focais; o RED esperado é dispatcher ausente.
- [ ] Implementar comandos como funções puras que clonam somente ramos alterados e emitem eventos sem persistir.
- [ ] Descanso pode invocar handlers oficiais autorizados, mas não pode buscar descrição nem comparar nome de classe.
- [ ] Adaptar temporariamente `ficha-edicoes.js` e `ficha-edicao-validacoes.js` para delegar aos comandos, preservando exports públicos.
- [ ] Executar os testes focais e E2E de vitals/regras; todos devem passar.

### Task 18: Implementar domínio de magias, concentração e metamagia

**Risk:** High — regras de seleção/conjuração são numerosas e hoje estão duplicadas no criador, ficha e level-up.

**Files:**

- Create: `site/js/domain/spells/spellcasting-queries.js`
- Create: `site/js/domain/spells/spell-selection.js`
- Create: `site/js/domain/spells/cast-spell.js`
- Create: `site/js/domain/spells/concentration.js`
- Create: `site/js/domain/spells/metamagic.js`
- Create: `site/js/domain/spells/spell-effects.js`
- Create: `site/js/domain/spells/index.js`
- Create: `tests/unit/domain/spellcasting-queries.test.js`
- Create: `tests/unit/domain/spell-selection.test.js`
- Create: `tests/unit/domain/cast-spell.test.js`
- Create: `tests/unit/domain/concentration-metamagic.test.js`
- Create: `tests/contract/spell-parity.test.js`

**Interfaces:**

```js
getSpellcastingProjection(character, context):
  Result<SpellcastingProjection, AppError>
validateSpellSelection(character, selection, context):
  Result<void, AppError>
castSpell(character, request, context): CommandResult
setConcentration(character, request, context): CommandResult
endConcentration(character, request, context): CommandResult
```

`request` de conjuração é `{ spellId: ContentId, sourceInstanceId: string, slotSource: { kind: "spell-slot", level: number } | { kind: "pact-slot" } | { kind: "at-will" }, metamagicIds: ReadonlyArray<ContentId>, replaceConcentration: boolean, targets: ReadonlyArray<TargetRef> }`. `slotSource` é obrigatório e discrimina explicitamente entre o pool `state.spells.slots` e o pool separado `state.spells.pactSlots` (Task 12) — `slotLevel` sozinho é ambíguo para um Bruxo, que tem os dois pools simultaneamente. `metamagicIds`/`targets` têm default `[]` (nunca `undefined`); `replaceConcentration` tem default `false`.

- [ ] Testar magia conhecida, preparada, concedida, de grimório e ritual; círculo/slot; lista/atributo; duplicidade por fonte e instâncias independentes de Iniciado em Magia.
- [ ] Testar `slotSource: { kind: "pact-slot" }` consumindo exclusivamente `state.spells.pactSlots` e nunca `state.spells.slots`, mesmo quando o nível numérico coincide; testar `{ kind: "spell-slot", level }` sem espaço correspondente devolvendo erro explícito, nunca decrementando um valor inexistente para negativo.
- [ ] Testar Mago nível 1 com seis magias no grimório e quatro preparadas dentro dele.
- [ ] Testar concentração existente retornando `CONCENTRATION_REPLACEMENT_REQUIRED` sem mutação; somente request confirmado substitui.
- [ ] Testar metamagia conhecida, compatibilidade da magia, custo e pontos disponíveis.
- [ ] Testar cada automação atual de magia contra o oráculo; automação não modelada precisa estar explicitamente `manual`.
- [ ] Executar os testes focais; o RED esperado é módulos ausentes.
- [ ] Implementar queries/comandos somente com IDs e campos mecânicos do catálogo.
- [ ] Registrar os comandos no dispatcher e manter adapters temporários onde `sheet.js`/`levelup.js` ainda chamarem funções antigas.
- [ ] Executar os testes focais, `creator.spec.js` filtrado para Mago e `sheet-rules.spec.js` filtrado para magias/concentração.

### Task 19: Implementar domínio de inventário, carga e moedas

**Risk:** High — itens atuais usam índices/nome e custos/pesos textuais; a migração não pode perder itens customizados.

**Files:**

- Create: `site/js/domain/inventory/inventory-queries.js`
- Create: `site/js/domain/inventory/inventory-commands.js`
- Create: `site/js/domain/inventory/equipment-rules.js`
- Create: `site/js/domain/inventory/wallet.js`
- Create: `site/js/domain/inventory/index.js`
- Create: `tests/unit/domain/inventory-queries.test.js`
- Create: `tests/unit/domain/inventory-commands.test.js`
- Create: `tests/unit/domain/wallet.test.js`
- Create: `tests/contract/inventory-parity.test.js`
- Modify: `site/js/moedas.js`

**Interfaces:**

```js
getInventoryProjection(character, context):
  Result<InventoryProjection, AppError>
addInventoryItem(character, request, context): CommandResult
removeInventoryItem(character, request, context): CommandResult
changeItemQuantity(character, request, context): CommandResult
equipItem(character, request, context): CommandResult
reorderInventory(character, request, context): CommandResult
changeWallet(character, request, context, { currencyRates? }): CommandResult
```

`changeWallet` recebe `context.currencyRates: CurrencyRates | null` explicitamente — nunca lê `localStorage` diretamente (proibido em `domain/**` pela Task 4) nem hardcoda a tabela padrão dentro de `wallet.js`. Quando `currencyRates` é `null`, o comando usa a tabela padrão definida no ruleset oficial (`dnd2024:ruleset:core`, moedas), nunca uma constante JavaScript paralela. `site/js/infra/preferences/local-storage-preferences-repository.js` (Task 13) é quem lê `dnd_taxas_moeda` e injeta o valor em `context` antes de chamar o comando — a ligação entre preferência e comando é feita na camada de `features`/`infra`, nunca dentro do domínio.

`customDefinition` de item legado/customizado carrega tanto os campos numéricos convertidos (`weightKg`, `costCopper`) quanto os campos textuais originais (`peso`, `custo` ou equivalentes). Editar o item pelo domínio regenera a projeção textual deterministicamente a partir dos numéricos — nunca deixa o texto legado congelado enquanto o numérico muda.

- [ ] Escrever testes garantindo ID próprio por instância, quantidade inteira não negativa e reorder como permutação exata dos IDs atuais.
- [ ] Testar proficiência/categoria/requisito estruturado, peso, capacidade, sobrecarga, customizados permitidos e preservação de campos legados.
- [ ] Testar as cinco denominações, pagamentos, conversões e impossibilidade de saldo negativo com a tabela padrão; testar também com `currencyRates` customizado explicitamente injetado, provando que uma taxa não padrão muda o resultado da conversão — uma implementação que ignora `currencyRates` deve falhar este teste, não apenas "poder" recebê-lo.
- [ ] Comparar carga, custo e transições com as fixtures de baseline.
- [ ] Executar os testes focais; o RED esperado é módulos ausentes.
- [ ] Implementar parsing textual somente no adaptador de item legado/customizado identificado; item oficial canônico já usa `weightKg` e `costCopper`. Testar o ciclo `parse(texto) → editar → formatar → parse` como estável (idempotente) para cada item customizado de `legacy-custom-spells-items.json`.
- [ ] Fazer `moedas.js` reexportar/delegar para o domínio durante a transição.
- [ ] Registrar comandos no dispatcher e executar testes focais.
- [ ] Executar `npx playwright test tests/e2e/sheet-inventory.spec.js --project=chromium-desktop --reporter=line`; compra, quantidade, equipar, reordenação e reload devem permanecer equivalentes.

### Task 20: Migrar handlers marciais — Bárbaro, Guerreiro, Ladino e Monge

**Risk:** High — remove quatro famílias extensas de regras específicas do monólito.

**Files:**

- Create: `site/js/domain/rulesets/dnd2024/handlers/class-handler.js`
- Create: `site/js/domain/rulesets/dnd2024/handlers/barbaro.js`
- Create: `site/js/domain/rulesets/dnd2024/handlers/guerreiro.js`
- Create: `site/js/domain/rulesets/dnd2024/handlers/ladino.js`
- Create: `site/js/domain/rulesets/dnd2024/handlers/monge.js`
- Create: `site/js/domain/rulesets/dnd2024/handlers/register-martial-handlers.js`
- Create: `tests/unit/domain/handlers/barbaro.test.js`
- Create: `tests/unit/domain/handlers/guerreiro.test.js`
- Create: `tests/unit/domain/handlers/ladino.test.js`
- Create: `tests/unit/domain/handlers/monge.test.js`
- Create: `tests/fixtures/expected/class-actions/martial.json`

**Handler contract** (vale, verbatim, para as Tasks 20, 21 e 22 — nenhuma reimplementa ou reinterpreta):

```js
{
  id: string,
  project(character, context): Result<HandlerProjection, AppError>,
  contributeEffects(character, context): Result<ReadonlyArray<Effect>, AppError>,
  execute(character, { actionId, payload }, context): CommandResult,
  onRest(character, { kind: "short" | "long" }, context): CommandResult
}
```

`kind` de `onRest` é exatamente `"short" | "long"` (strings em inglês, nunca `"curto"`/`"longo"` nem `"descanso-curto"`) — todo handler das três tarefas e o dispatcher de descanso da Task 17 devem comparar contra esses dois literais exatos. Um `tests/contract/handler-contract.test.js` compartilhado (criado nesta tarefa, reexecutado nas Tasks 21 e 22) prova que todo handler registrado satisfaz a assinatura acima, incluindo os tipos de retorno.

**Propriedade de `state.resources`/`usageFlags`:** esses dois mapas são compartilhados por proveniência (classe, subclasse, espécie, antecedente, talento, item), não por classe. Um handler só pode ler/escrever as chaves cujo `sourceInstanceId` corresponde à sua própria proveniência; o dispatcher mescla as fatias devolvidas por cada handler, e nenhum handler pode substituir o mapa inteiro. Testar por handler: uma fixture carregando um recurso de fonte alheia (ex.: carga de talento num personagem cujo handler de classe está sendo testado) deve permanecer byte-idêntica depois de qualquer ação/descanso desse handler.

**Recurso ausente em `project`:** quando um personagem migrado não tem entrada para um recurso que a classe concede, `project` devolve `{ current: null, missing: true }` para esse recurso (renderizado como "não inicializado") — nunca infere um valor plausível (máximo = "descansado", zero = "nunca usado"). Somente comandos de progressão/migração podem materializar o valor inicial. Testar com `legacy-migration-stages.json`.

- [ ] Escrever testes para cada recurso, ação e recarga atualmente visível das quatro classes e suas 16 subclasses, usando IDs de ação das entidades canônicas.
- [ ] Validar classe/subclasse, nível mínimo, escolha adquirida, recurso suficiente, payload e capacidade oficial em toda execução.
- [ ] Provar que `project` e `contributeEffects` não criam estado ausente; defaults surgem apenas na criação, migração ou progressão. Testar explicitamente o caso de recurso ausente (`{ current: null, missing: true }`) com `legacy-migration-stages.json`.
- [ ] Testar isolamento de proveniência: um handler nunca lê nem sobrescreve uma chave de `state.resources`/`usageFlags` cujo `sourceInstanceId` pertence a outra fonte.
- [ ] Comparar projeções/transições com `martial.json`.
- [ ] Executar os quatro testes; o RED esperado é handlers ausentes.
- [ ] Extrair regras de `sheet.js` e `levelup.js`; manter texto de apresentação nos dados e algoritmo puro no handler somente quando o vocabulário declarativo não bastar.
- [ ] Registrar os handlers no `OfficialHandlerRegistry` por ID estável e rejeitar IDs não declarados no conteúdo.
- [ ] Executar `tests/contract/handler-contract.test.js` (criado nesta tarefa) contra os quatro handlers, os testes focais e o subconjunto Playwright de recursos das quatro classes.

### Task 21: Migrar handlers divinos/primitivos — Clérigo, Druida, Guardião e Paladino

**Risk:** High — combina recursos, formas, ordens, auras e conjuração preparada.

**Files:**

- Create: `site/js/domain/rulesets/dnd2024/handlers/clerigo.js`
- Create: `site/js/domain/rulesets/dnd2024/handlers/druida.js`
- Create: `site/js/domain/rulesets/dnd2024/handlers/guardiao.js`
- Create: `site/js/domain/rulesets/dnd2024/handlers/paladino.js`
- Create: `site/js/domain/rulesets/dnd2024/handlers/register-divine-primal-handlers.js`
- Create: `tests/unit/domain/handlers/clerigo.test.js`
- Create: `tests/unit/domain/handlers/druida.test.js`
- Create: `tests/unit/domain/handlers/guardiao.test.js`
- Create: `tests/unit/domain/handlers/paladino.test.js`
- Create: `tests/fixtures/expected/class-actions/divine-primal.json`

- [ ] Escrever testes para as quatro classes e suas 16 subclasses, incluindo ordens, Canalizar Divindade/Natureza, Forma Selvagem, Inimigo Favorito, Imposição de Mãos, auras, recursos e recargas.
- [ ] Cobrir magias sempre preparadas, fontes independentes, concentração e descanso sem duplicar as regras do domínio de magias.
- [ ] Executar os testes; o RED esperado é handlers ausentes.
- [ ] Converter efeitos recorrentes para dados declarativos e manter somente mecânicas não representáveis nos handlers.
- [ ] Eliminar lookup por `"Clérigo"`, `"Druida"`, `"Guardião"`, `"Paladino"` e nomes de subclasse dentro dos novos módulos; decisões usam refs/IDs.
- [ ] Registrar handlers com o mesmo contrato da Task 20 (`kind` de `onRest` exatamente `"short"`/`"long"`, isolamento de `state.resources`/`usageFlags` por proveniência, recurso ausente projetado como `{ current: null, missing: true }`).
- [ ] Executar testes focais, `tests/contract/handler-contract.test.js` contra estes quatro handlers, `spell-parity.test.js` e o subconjunto Playwright destas quatro classes.

### Task 22a: Migrar handlers arcanos — Bardo, Bruxo, Feiticeiro e Mago

**Ordem de execução (decisão registrada em `questions-for-review.txt`, item 6,
2026-08-03 — a Task 22 original foi dividida em 22a/22b com a Task 23 entre
elas):** 22a → **Task 23** → 22b. O cutover de `db.js` (antigo escopo final
da Task 22) foi extraído para a **Task 22b**, que só roda depois da Task 23
ter enriquecido o catálogo com os dados de progressão que faltam para
`legacy-db-projection.js` atingir paridade total. Esta tarefa (22a) cobre só
os quatro handlers arcanos e a plumbing de `context.variables`; não toca
`db.js` nem escreve o shadow spec.

**Risk:** High — cobre inspirações, pacto/invocações, feitiçaria/metamagia e grimório.

**Files:**

- Create: `site/js/domain/rulesets/dnd2024/handlers/bardo.js`
- Create: `site/js/domain/rulesets/dnd2024/handlers/bruxo.js`
- Create: `site/js/domain/rulesets/dnd2024/handlers/feiticeiro.js`
- Create: `site/js/domain/rulesets/dnd2024/handlers/mago.js`
- Create: `site/js/domain/rulesets/dnd2024/handlers/register-arcane-handlers.js`
- Create: `site/js/domain/rulesets/dnd2024/handlers/register-all.js`
- Create: `tests/unit/domain/handlers/bardo.test.js`
- Create: `tests/unit/domain/handlers/bruxo.test.js`
- Create: `tests/unit/domain/handlers/feiticeiro.test.js`
- Create: `tests/unit/domain/handlers/mago.test.js`
- Create: `tests/fixtures/expected/class-actions/arcane.json`
- Create: `tests/contract/official-handler-coverage.test.js`
- Create: `tests/e2e/content-loading.spec.js`
- Modify: `site/js/infra/content/official-content-registry.js`
- Modify: `site/js/app-context.js`
- Modify: `site/js/domain/effects/effect-predicates.js` (ou módulo equivalente já revisado nas Tasks 15/16 — expor `context.variables` com os modificadores de atributo resolvidos ao motor de efeitos; decisão 2 do item 6 em `questions-for-review.txt`)

**`context.variables` (decisão 2, item 6 de `questions-for-review.txt`):**
nenhum caminho de produção hoje popula modificadores de atributo para o motor
de efeitos (`resolveNumericValue("D6")` retorna `EFFECT_VALUE_NOT_NUMERIC`).
Isso bloqueia Inspiração de Bardo (`max(1, mod. Carisma)`, as 5 ações de
subclasse inteiras) e Feitiçaria Inata de Mago, além do backlog já
documentado como concern C5 nas Tasks 20/21 (10+ subclasses com teto de
recurso escalado por modificador). Construir a plumbing real (não uma
constante hardcoded) que resolve `context.variables.<atributo>Modifier` a
partir do personagem e do sistema de habilidades já existente (Task 16),
disponibilizada a todo handler via o mesmo `context` que já carrega
`registry`/`currencyRates`/etc.

- [ ] Escrever testes para quatro classes e 16 subclasses, incluindo Inspiração, Magia de Pacto, invocações, pontos de feitiçaria, metamagia, recuperação arcana, grimório e recargas.
- [ ] Cobrir slots de pacto separados, magias sempre preparadas e fonte de conjuração sem misturar estado entre instâncias.
- [ ] Implementar `context.variables` com os modificadores de atributo resolvidos (decisão 2) e testar as ações antes bloqueadas (Inspiração de Bardo, Feitiçaria Inata de Mago) com valor real, não mockado.
- [ ] Escrever contrato que exige correspondência exata entre todo `officialHandlerRef` DE CLASSE do pacote (Bardo/Bruxo/Feiticeiro/Mago) e um handler registrado, e que proíbe handler órfão dentro desse escopo. IDs não-de-classe que pertencem à Task 23 (`asi-or-feat`, `grant-feat`, `expertise-from-proficient-skills`, etc.) entram numa allowlist nomeada explícita no próprio teste (decisão 3, item 6 de `questions-for-review.txt`), documentando que são responsabilidade da Task 23 — a Task 23 remove essa allowlist ao registrar os handlers correspondentes.
- [ ] Executar os testes; o RED esperado é handlers ausentes/cobertura incompleta.
- [ ] Implementar e registrar os handlers pelo composition root com a capacidade oficial.
- [ ] Não duplicar seleção, concentração ou gasto de slots; handlers delegam ao domínio de magias.
- [ ] Executar todos os testes de handlers, `official-handler-coverage.test.js`, `npm run validate:data` e `content-loading.spec.js` junto dos fluxos Chromium de criador/ficha. Não tocar `db.js` nem escrever o shadow spec nesta tarefa — isso é a Task 22b.

### Task 22b: Cutover de `db.js` para a projeção de conteúdo legado

**Pré-requisito obrigatório:** Task 23 **e** Task 23b completas (decisão E,
item 7 de `questions-for-review.txt`, 2026-08-03 — o escopo de fechamento de
lacunas foi dividido entre as duas: Task 23 fecha `getClasse`/progressão,
Task 23b fecha as 7 operações restantes) — juntas fazem
`assertLegacyProjectionReadyForCutover()` parar de lançar (`ready === false`
hoje, ver `questions-for-review.txt` itens 5, 6 e 7). Não dispatch esta
tarefa enquanto esse guard não passar a `ready === true` para as 10
operações de `PUBLIC_RUNTIME_LEGACY_OPERATIONS`.

**Risk:** High — ponto de não-retorno: remove os JSON legados do caminho de leitura do app vivo.

**Files:**

- Create: `tests/e2e/legacy-db-shadow.spec.js`
- Modify: `site/js/db.js`
- Modify: `tests/contract/official-handler-coverage.test.js` (remover a allowlist de IDs não-de-classe da Task 22a à medida que a Task 23 os registra)

- [ ] Confirmar `legacyProjectionCutoverReadiness().ready === true` antes de qualquer mudança em `db.js`; se ainda `false`, tratar como BLOCKED e escalar (não redefinir o guard, não afrouxar `LEGACY_PROJECTION_GAPS`).
- [ ] Criar `tests/e2e/legacy-db-shadow.spec.js`. Em modo shadow (flag de teste, nunca publicada), o app carrega `db.js` legado **e** `legacy-db-projection.js` simultaneamente e afirma deep-equality export a export em runtime — não só contra fixtures — para pelo menos um fluxo completo de criação de personagem (percorrendo todas as 12 classes, não uma amostra) e um fluxo completo de abertura de ficha existente. A comparação cobre explicitamente `null` vs `undefined` vs `[]` vs `""` por export, já que é exatamente esse tipo de divergência de default que passa despercebido em testes só-fixture. Uma divergência aqui bloqueia o cutover — não pode ser adiada.
- [ ] Somente depois de `official-handler-coverage.test.js` (sem a allowlist temporária) **e** `legacy-db-shadow.spec.js` verdes, converter `db.js` na fachada fina sobre `legacy-db-projection.js` e o registry compartilhado do `app-context`, preservando todos os exports atuais.
- [ ] Executar `legacy-db-projection.test.js`, `legacy-db-shadow.spec.js`, `npm run validate:data` e `content-loading.spec.js` junto dos fluxos Chromium de criador/ficha.
- [ ] Confirmar nas requisições Playwright que somente `dados/pacotes/dnd2024/**` alimenta conteúdo e regras normais, incluindo criaturas/glossário; os JSON legados não devem ser requisitados depois deste cutover.

### Task 23: Migrar progressão, talentos e fachadas de regras legadas

**Risk:** High — level-up combina dados, escolhas, recursos, magias e estado persistido para todas as classes.

**Escopo adicional (decisão 1, item 6 de `questions-for-review.txt`,
2026-08-03 — reordenação 22a → 23 → 23b → 22b):** esta tarefa também fecha a
fatia de `legacy-db-projection.js` que é responsabilidade de progressão —
`getClasse` — deixando as outras 7 operações (dívida de conteúdo das Tasks
8/9/10) para a **Task 23b** (decisão E, item 7 de `questions-for-review.txt`,
2026-08-03).

**Revisão de escopo pós-execução (decisões A/B, item 7, e decisão G, item 8 de
`questions-for-review.txt`, 2026-08-03):** a primeira tentativa desta tarefa
mostrou que `tabela_caracteristicas`/`texto_completo`/`tracos_basicos`/
`caracteristicas` não são deriváveis do catálogo sem duplicar dado (rótulos
de apresentação escritos à mão no legado, característica já modelada como
entidade `feature`). A decisão A (item 7) foi fechada nesta tarefa: fazer
`character-codec.js` persistir `state.hitPointRolls` de verdade (round-trip
completo — sem isso um personagem que sobe de nível e é salvo perde o
histórico). A decisão B (item 7) também foi fechada nesta tarefa: registrar
no `official-handler-coverage.test.js` (Task 22a) os marcadores de dado que
a allowlist temporária da Task 22a documentou (`asi-or-feat`, `grant-feat`,
`expertise-from-proficient-skills`, etc.) — como esses IDs são consumidos
como **dado estrutural** pela matriz de progressão (não como handler
invocável), a reclassificação correta é movê-los para a
`DATA_ONLY_HANDLER_ALLOWLIST` (mesma categoria de `pact-magic-slots` da Task
22a), não criar um handler para cada um.

A decisão D original (item 7 — migrar `levelup.js`/`levelup-flow.js`/
`levelup-ui.js` para fechar `getClasse` por remoção de consumidor) foi
**revertida pela decisão G (item 8)**: a varredura real mostrou que
`levelup-ui.js` não consome esses campos — os consumidores reais são
`sheet.js` (~30 ocorrências) e `creator.js` (6), fora da file list desta
task e agendados para reescrita completa nas Tasks 25-32. Migrá-los agora
seria trabalho descartável e de alto risco sem cobertura Playwright. A
fatia de `getClasse` (presentation + reconciliação de `caracteristicas`)
passa para a **Task 23b**, ao lado das outras 7 operações — como um bloco
`legacyPresentation` verbatim, dívida temporária documentada para remoção
quando as Tasks 25-32 eliminarem os consumidores.

Ao final desta tarefa: domínio de progressão completo, persistência real de
`state.hitPointRolls`, allowlist unificada. `getClasse` continua com lacuna
(fechada pela Task 23b, junto das outras 7 operações) — `ready === true`
só vale depois da Task 23b.

**Files:**

- Create: `site/js/domain/progression/progression-queries.js`
- Create: `site/js/domain/progression/level-up.js`
- Create: `site/js/domain/progression/feat-choices.js`
- Create: `site/js/domain/progression/index.js`
- Create: `tests/unit/domain/progression-queries.test.js`
- Create: `tests/unit/domain/level-up.test.js`
- Create: `tests/unit/domain/feat-choices.test.js`
- Create: `tests/contract/level-up-parity.test.js`
- Modify: `dados/schemas/v1/character-canonical-v2.schema.json` (acrescentar `state.hitPointRolls`)
- Modify: `site/js/infra/character/character-codec.js` (round-trip real de `state.hitPointRolls` — decisão A; chave nova no registro legado plano, ex. `pv_rolagens`)
- Modify: `tests/contract/baseline-record-compatibility.test.js` e `RESERVED_RECORD_KEYS` (acompanhar a chave nova do codec)
- Modify: `site/js/levelup.js`
- Modify: `site/js/levelup-flow.js`
- Modify: `site/js/levelup-validations.js`
- Modify: `site/js/talentos-effects.js`
- Modify: `site/js/regras-cobertura.js`
- Modify: `site/js/dados-classes.js`
- Modify: `tests/contract/official-handler-coverage.test.js` (mover marcadores de dado da Task 23 para `DATA_ONLY_HANDLER_ALLOWLIST` — decisão B)

**Interfaces:**

```js
getLevelUpOptions(character, context): Result<LevelUpProjection, AppError>
validateLevelUp(character, selection, context): Result<void, AppError>
applyLevelUp(character, selection, context): CommandResult
applyFeatChoice(character, selection, context): CommandResult
```

- [ ] Escrever matriz para cada classe nos níveis 1–20, subclasse no nível correto, ASI/talento, dádiva épica, escolhas, PV, recursos, proficiências e magias.
- [ ] Estender `dados/schemas/v1/character-canonical-v2.schema.json` (`Modify:` — ver Global Constraints, extensão incremental de schemas) acrescentando `state.hitPointRolls: ReadonlyArray<{ level: number, rolled: number | null, method: "roll" | "average" | "fixed" }>`. Este campo não existe no schema construído pela Task 12; é responsabilidade desta tarefa criá-lo — e persistir de verdade (decisão A), não só declarar no schema.
- [ ] Implementar e testar PV por nível usando `state.hitPointRolls`: cada level-up acrescenta uma entrada `{ level, rolled, method }`; PV máximo é **sempre recomputado** a partir de `hitPointRolls` + modificador de CONSTITUIÇÃO + bônus de conteúdo, nunca lido de um valor congelado. Testar explicitamente que subir CONSTITUIÇÃO (via ASI) depois de já ter rolado PV em níveis anteriores recalcula corretamente o máximo, e que isso não gera um `override` manual espúrio (`overrides` continua reservado só para ajuste explícito do usuário, nunca para um valor que o próprio motor deveria recomputar).
- [ ] Testar pré-requisitos, talentos repetíveis, limites de atributo, escolhas exatas e rollback total em seleção inválida.
- [ ] Comparar transições com fixtures do baseline, sem adicionar multiclasse.
- [ ] Executar os testes focais; o RED esperado é progressão nova ausente.
- [ ] Implementar criação/level-up de recursos por IDs estruturados; render e consulta continuam sem inicialização implícita.
- [ ] Transformar os seis arquivos legados listados em `Files:` em fachadas finas para o domínio, preservando exports ainda usados pelos controllers antigos. `levelup-ui.js`, `sheet.js` e `creator.js` NÃO fazem parte desta migração (decisão G, item 8 — consumidores reais de `tabela_caracteristicas`/`texto_completo`/`tracos_basicos`, fora de escopo, aguardam a reescrita das Tasks 25-32).
- [ ] Executar testes de progressão/handlers e o fluxo Playwright de level-up para todas as classes fixture (se o ambiente permitir — o CLI do Playwright pode falhar em diretórios com `&` no caminho; documentar se não for possível executar).
- [ ] Executar `rg -n "parse|descricao|nome" site/js/domain/progression site/js/domain/rulesets/dnd2024/handlers`; revisar cada ocorrência e garantir que nenhuma decide mecânica por prosa ou nome de exibição.

### Task 23b: Fechar lacunas remanescentes do catálogo para cutover de `db.js`

**Origem (decisão E, item 7 de `questions-for-review.txt`, 2026-08-03):**
quando a Task 23 foi executada, `legacyProjectionCutoverReadiness()` revelou
lacuna em 8 das 10 operações de `PUBLIC_RUNTIME_LEGACY_OPERATIONS`. As 7
não-`getClasse` são dívida de conteúdo das Tasks 8/9/10, fora do escopo de
progressão — por isso viraram uma task própria em vez de expandir a Task 23.

**Escopo ampliado (decisão G, item 8 de `questions-for-review.txt`,
2026-08-03):** `getClasse` também entra aqui. A Task 23 tentou fechá-la
migrando os consumidores para o domínio, mas descobriu que os consumidores
reais (`sheet.js`, `creator.js`) estão fora de escopo e serão reescritos
pelas Tasks 25-32 — migrá-los agora seria trabalho descartável. Esta tarefa
fecha `getClasse` pelo caminho original: um bloco `legacyPresentation`
verbatim no catálogo (cópia de `tabela_caracteristicas`/`texto_completo`/
`tracos_basicos`, mais `caracteristicas` reconciliada — 171 características
ausentes na projeção, 9 extras, ~134 divergências de nome/descrição por
ordem, ver `questions-for-review.txt` item 5). **Documentar explicitamente
esse bloco como dívida temporária** (comentário no schema/conversor +
entrada no ledger) a ser removida quando as Tasks 25-32 eliminarem os
consumidores — não é o modelo de domínio permanente, é o preço de manter o
cutover no cronograma atual do plano sem reescrever `sheet.js`/`creator.js`
fora de ordem.

**Risk:** High — mesma classe da Task 23: gate de cutover de `db.js` depende deste fechamento.

**Pré-requisito:** Task 23 completa.

**Lacunas a fechar** (contagens medidas na execução da Task 23; reconferir
contra `LEGACY_PROJECTION_GAPS` no início desta tarefa, pode ter mudado):
`getClasse` (`tabela_caracteristicas`/`texto_completo`/`tracos_basicos`/
`caracteristicas`, ver acima), `getMagiasClasse` (20), `getAntecedentes` (7),
`getEspecies` (2), `getTalentos` (10), `getArmas` (4), `getArmaduras` (1),
`getEquipamentoAventura` (5).

**Bugs reais do legado já identificados dentro dessas lacunas** (aplicar a
mesma divergência-deliberada-documentada já usada nas Tasks 13/17/20/21 —
corrigir o bug real, nunca reproduzi-lo no catálogo novo, com comentário
citando a fonte legada + campo no fixture + teste nomeado):
- `getArmas`: uma arma com typo de dano no legado (`"1d6 Perfurante,"`).
- `getArmaduras`: caixa inconsistente de `modificador de Des` entre armaduras no legado.
- `getMagiasClasse`: `dados/classes/magias_*.json` e `dados/magias/por_classe/*.json` discordam entre si sobre o círculo de pelo menos uma magia — reconciliar qual fonte é a correta antes de propagar ao catálogo.

**Files:**

- Modify: `site/js/infra/content/legacy-db-projection.js` (fechar `LEGACY_PROJECTION_GAPS` das 8 operações listadas)
- Modify: `scripts/content/migrate-classes.mjs` e/ou os conversores de talentos/antecedentes/espécies/equipamento equivalentes (enriquecer o catálogo com os campos que faltam, nunca editar os JSON de `dados/pacotes/dnd2024/**` à mão)
- Modify: `dados/schemas/v1/class.schema.json` (ou equivalente — campo `legacyPresentation` para `getClasse`, com `description` documentando que é dívida temporária)
- Modify: `tests/contract/legacy-db-projection.test.js` (atualizar o teste-guarda de cutover para `ready === true` quando as 10 operações estiverem fechadas)

- [ ] Para `getClasse`: acrescentar `legacyPresentation` ao schema de classe (extensão incremental, com caso Ajv), popular via conversor a partir dos JSON legados verbatim, documentar como dívida temporária removível pós Tasks 25-32.
- [ ] Para as outras 7 operações: fechar a lacuna por enriquecimento determinístico do conversor de conteúdo (nunca por edição manual do JSON gerado).
- [ ] Para os 3 bugs reais do legado identificados acima, corrigir e documentar como divergência deliberada (comentário + fixture + teste nomeado), não reproduzir.
- [ ] Confirmar `legacyProjectionCutoverReadiness().ready === true` para as 10 operações de `PUBLIC_RUNTIME_LEGACY_OPERATIONS` ao final — este é o gate de saída que libera a Task 22b.
- [ ] Atualizar conscientemente o teste-guarda de cutover em `tests/contract/legacy-db-projection.test.js` (ele afirma hoje `ready === false`; a atualização é esperada e documenta a mudança de estado).
- [ ] Executar `npm run test:node`, `check:syntax`, `check:architecture`, `validate:data`, `migrate-classes --check` (ou o `--check` equivalente de cada conversor tocado).

## Marco 6 — Fronteira de UI segura

### Task 24: Criar primitivas DOM seguras e remover handlers inline do shell

**Risk:** High — troca sinks HTML e o serviço de modal sem poder alterar markup, callbacks ou Markdown visível.

**Files:**

- Create: `site/js/ui/html.js`
- Create: `site/js/ui/markdown.js`
- Create: `site/js/ui/modal.js`
- Create: `site/js/ui/toast.js`
- Create: `site/js/ui/event-delegation.js`
- Create: `tests/helpers/test-dom.js`
- Create: `tests/fixtures/security/malicious-content.json`
- Create: `tests/unit/ui/html.test.js`
- Create: `tests/unit/ui/markdown.test.js`
- Create: `tests/unit/ui/modal.test.js`
- Create: `tests/e2e/security-content.spec.js`
- Modify: `site/js/utils.js`
- Modify: `site/js/app.js`
- Modify: `site/index.html`

**Interfaces:**

```js
escapeHtml(value): string
escapeHtmlAttribute(value): string
setSafeText(element, value): void
resolveSafeUrl(value, { kind, baseUrl }): Result<URL, AppError>
renderSafeMarkdown(documentRef, text): DocumentFragment
delegate(root, eventName, selector, handler): () => void
applyUiEventDecision(event, decision): void
createModalService(elements): ModalService
```

`ModalService.open({ title, content, actions, onClose })` recebe nós/fragmentos, devolve um handle com `close(reason)` e mantém a pilha atual.

`UiEventDecision<TIntent>` é `{ intent: TIntent | null, preventDefault: boolean, stopPropagation: boolean }`. Somente o controller chama `preventDefault()`/`stopPropagation()` e abre modal depois de aplicar a decisão; renderizadores/steps/seções apenas descrevem a intenção.

`resolveSafeUrl`'s `kind` é um enum fechado, não uma string livre: `"character-image" | "google-avatar" | "app-link"` — os três allowlists mencionados no checklist abaixo. `near-limits.json` (Task 2) deve conter uma chave nomeada explicitamente `characterImageMaxBytes` (ou o nome real já fixado por aquela tarefa — usar exatamente esse nome em `resolveSafeUrl`, nunca um literal duplicado); se o nome divergir entre as duas tarefas, o limite de imagem silenciosamente vira `undefined` (sem limite nenhum) ou rejeita tudo.

- [ ] Escrever payloads com `script`, `onerror`, `javascript:`, SVG/data URL, tag malformada, link externo e tentativas de sair da raiz.
- [ ] Testar texto, atributo, URL por modo, Markdown permitido e remoção de HTML cru; nenhuma string de conteúdo pode virar handler/evento. O modo `character-image` aceita somente `data:image/png|jpeg|webp;base64` com bytes válidos e o limite máximo lido pela chave nomeada de `near-limits.json` na Task 2; rejeita SVG, MIME divergente, payload truncado e demais `data:` sem invalidar uma imagem aceita pelo baseline.
- [ ] **Oráculo de fidelidade do Markdown** (além dos payloads de ataque acima, que só provam que conteúdo malicioso é bloqueado, não que conteúdo legítimo sobrevive): rodar o `mdParaHtml` atual do baseline e o novo `renderSafeMarkdown` sobre toda string de descrição em `dados/pacotes/dnd2024/**` (391 magias, features de classe/subclasse, glossário) e exigir equivalência de DOM normalizado, com uma lista explícita e revisada de diferenças permitidas (mesma política `baselineDifferences` da Task 2) — nunca uma comparação vazia ou "parece razoável". Um renderizador que remove/altera formatação legítima silenciosamente (não só payloads de ataque) deve falhar este teste.
- [ ] Testar pilha, fechar fora, Escape, foco, onClose único e cancelamento sem mutação de transação.
- [ ] Executar os testes unitários; o RED esperado é módulos ausentes.
- [ ] Implementar Markdown escapando primeiro a entrada e criando apenas tags/atributos de allowlist; não usar sanitização por blacklist.
- [ ] Implementar `test-dom.js` sobre LinkeDOM para criar/restaurar `window`, `document`, eventos e fragmentos isolados em cada teste Node. Foco real, drag-and-drop, download e comportamento de navegador permanecem cobertos por Playwright, não simulados como equivalentes.
- [ ] Implementar URL de conteúdo somente local; manter allowlists explícitas separadas para imagem persistida do personagem, avatar Google e links fixos da aplicação.
- [ ] Converter `utils.js` em fachada para `escHtml`, `mdParaHtml`, modal e toast enquanto consumidores legados existem.
- [ ] Remover `onclick` do botão de fechar modal, da página não encontrada e do modal de reporte; registrar listeners no shell.
- [ ] Executar `node scripts/run-node-tests.mjs tests/unit/ui` e `npx playwright test tests/e2e/security-content.spec.js --project=chromium-desktop --reporter=line`; comparar o visual afetado apenas pelo comando Linux separado da Task 3/CI.
- [ ] Não remover ainda `'unsafe-inline'` de `script-src`; a Task 37 fará isso somente depois de zerar todos os handlers inline.

## Marco 7 — CreatorSession e sete passos

### Task 25: Implementar CreatorSession, contrato de passos e controller

**Risk:** High — substitui estado singleton, navegação, carregamento assíncrono e transações dos modais.

**Files:**

- Modify: `site/js/app-context.js`
- Create: `site/js/features/creator/creator-session.js`
- Create: `site/js/features/creator/creator-state.js`
- Create: `site/js/features/creator/creator-intents.js`
- Create: `site/js/features/creator/creator-invalidation.js`
- Create: `site/js/features/creator/selection-transaction.js`
- Create: `site/js/features/creator/creator-controller.js`
- Create: `site/js/features/creator/creator-view.js`
- Create: `site/js/features/creator/steps/creator-step.js`
- Create: `site/js/features/creator/steps/step-registry.js`
- Create: `site/js/features/creator/steps/index.js`
- Create: `tests/unit/creator/creator-session.test.js`
- Create: `tests/unit/creator/creator-invalidation.test.js`
- Create: `tests/unit/creator/selection-transaction.test.js`
- Create: `tests/integration/creator-controller.test.js`
- Modify: `tests/integration/app-context-content.test.js`
- Create: `tests/integration/app-context.test.js`
- Create: `tests/e2e/harness/creator.html`
- Create: `tests/e2e/harness/creator-harness.js`
- Create: `tests/e2e/harness/placeholder-creator-step.js`
- Create: `tests/e2e/creator-step-harness.spec.js`

**Session contract:**

```js
createCreatorSession({ draft, registry, rules, stepRegistry, rng, clock })
session.initialize({ signal }): Promise<Result<CreatorSnapshot, AppError>>
session.getSnapshot(): Readonly<CreatorSnapshot>
session.dispatch(intent): Promise<Result<CreatorSnapshot, AppError>>
session.next(): Promise<Result<CreatorSnapshot, AppError>>
session.previous(): Result<CreatorSnapshot, AppError>
session.goToVisited(stepId): Result<CreatorSnapshot, AppError>
session.finalize(): Result<CanonicalCharacter, AppError>
session.subscribe(listener): () => void
session.dispose(): void

mountCreator(ports): Promise<Result<() => void, AppError>>
```

**Step contract:**

```js
{
  id,
  load(context): Promise<Result<StepData, AppError>>,
  render(context): string,
  bind(context): {
    eventTypes: ReadonlyArray<string>,
    toIntent(event): UiEventDecision<CreatorIntent>
  },
  validate(context): ValidationResult,
  invalidate(context): Result<InvalidationPatch, AppError>
}
```

- `bind` preserva o contrato aprovado, mas é declarativo: devolve um descritor congelado e nunca chama `addEventListener`. O controller agrega `eventTypes` e mantém os listeners delegados na raiz; `toIntent` fica encapsulado no descritor do passo.

`InvalidationPatch = { clearedStepIds: ReadonlyArray<string>, revokedProvenanceIds: ReadonlyArray<string>, preservedSlices: ReadonlyArray<string> }`. `revokedProvenanceIds` alimenta diretamente `revokeGrantEffects` (Task 15) — os IDs de proveniência aqui devem ser exatamente os `sourceInstanceId`s que `applyGrantEffects` usou, para o inverso funcionar. `preservedSlices` enumera as fatias do draft que este `invalidate` explicitamente NÃO limpa (ex.: `"manualInventoryChanges"`, `"walletChanges"`), tornando a preservação uma decisão positiva de cada step, não um silêncio interpretável como "também limpar". Todo step desta e das Tasks 26-28 devolve exatamente esse shape — não um shape ad hoc por step.

`render(context): string` **nunca** é HTML montado por interpolação de template literal direta sobre conteúdo do catálogo (nomes, descrições — Global Constraints: conteúdo JSON é não confiável). Todo valor derivado de conteúdo passa pelos helpers seguros de `site/js/ui/html.js` (Task 24: `escapeHtml`/`escapeHtmlAttribute`/`setSafeText`) antes de entrar na string retornada; a montagem final ainda pode ser string porque o controller a insere via um caminho já validado, mas o *conteúdo interpolado* dentro dela nunca é cru. Isso vale para todo step (Tasks 25-28) e toda seção da ficha (Tasks 29-32), cujo `render` tem a mesma assinatura. Reexecutar `tests/e2e/security-content.spec.js` (Task 24) a cada task 26-32 com uma fixture de conteúdo malicioso indo por esse caminho especificamente — não só pelos sinks genéricos testados na Task 24.

- [ ] Escrever testes para duas sessões simultâneas sem vazamento de draft, cache, step, modal ou listener.
- [ ] Testar `load` com `AbortSignal` e generation; resposta antiga depois de troca de passo/classe é descartada.
- [ ] Testar `render`/`validate` sem mutação e seletores limitados a `context.root`; testar com uma fixture de step/seção usando conteúdo malicioso (nome/descrição de catálogo) que o resultado de `render` nunca contém o payload cru — só a versão escapada.
- [ ] Testar `bind`/`toIntent` para descritor imutável, eventos suportados/ignorados e decisões de submit/drag/drop. O controller instala um único conjunto de listeners delegados na raiz, aplica `preventDefault`/`stopPropagation`, encaminha a intent ao step ativo e abre modais como efeito de controller; steps não registram listeners nem recebem o serviço de modal.
- [ ] Testar modal begin/update/commit/cancel; apenas commit altera o draft.
- [ ] Fixar a matriz: classe invalida `startingEquipmentSelection`/`startingCurrencyGrant`/escolhas/perícias/progressão/recursos de classe, mas **nunca** `manualInventoryChanges`/`walletChanges` (itens e moedas adicionados manualmente pelo usuário sobrevivem a qualquer troca de passo, inclusive troca de classe — não só troca de opção inicial dentro da mesma classe, ver Task 27); espécie invalida apenas suas concessões; antecedente invalida bônus/perícias/ferramenta/talento/equipamento; atributos invalidam derivados; equipamento e magias invalidam somente sua proveniência; detalhes não invalidam outro passo.
- [ ] Testar o placeholder de `InvalidationPatch` fixado nesta tarefa contra os sete IDs de step, provando que o dispatcher lida com o shape pinado antes de qualquer step real existir.
- [ ] Executar os testes; o RED esperado é módulos ausentes.
- [ ] Implementar estado congelado, proveniência de cada concessão e listeners com disposer.
- [ ] Estender `app-context.js` (composition root criado na Task 11, handlers reais ligados na Task 15) acrescentando repository e sync queue às portas já existentes, inicializando cada uma uma única vez, com overrides injetáveis em teste e sem expor tokens de confiança.
- [ ] Implementar `mountCreator({ container, session, repository, syncQueue, modal, notifier, navigate, imageProcessor })`; sucesso devolve um disposer idempotente que cancela loads, fecha modais próprios, remove listeners e chama `session.dispose()`.
- [ ] Criar harness HTML/JS servido somente de `tests/e2e/harness`, fora do artifact Pages, para montar controller/step registry novos com portas em memória antes do cutover público. Registrar `placeholder-creator-step.js` válido para cada step ainda não migrado; placeholders não existem em `site/`, não finalizam personagem e são substituídos progressivamente nas Tasks 26–28. O harness identifica no DOM qual módulo foi montado.
- [ ] Executar testes focais, `npm run check:architecture` e o smoke Playwright de rota do criador legado.

### Task 26: Migrar passos Classe, Espécie e Antecedente

**Risk:** High — esses passos definem identidade de conteúdo e grande parte das invalidações posteriores.

**Files:**

- Create: `site/js/features/creator/steps/class-step.js`
- Create: `site/js/features/creator/steps/species-step.js`
- Create: `site/js/features/creator/steps/background-step.js`
- Create: `tests/unit/creator/class-step.test.js`
- Create: `tests/unit/creator/species-step.test.js`
- Create: `tests/unit/creator/background-step.test.js`
- Create: `tests/integration/creator-content-steps.test.js`

- [ ] Escrever testes de seleção, validação, confirmação/cancelamento e troca após visitar passos seguintes.
- [ ] Cobrir todas as escolhas especiais de classe, as espécies com linhagem/traço e antecedentes com ferramenta/instrumento/idioma/talento.
- [ ] Comparar HTML semântico, textos, classes e ordem com `tests/fixtures/dom-baseline/creator-steps.json` capturado na Task 3; não adicionar wrapper visual.
- [ ] Executar os testes; o RED esperado é steps ausentes.
- [ ] Implementar cards pelo catálogo e refs; remover destes steps `NIVEL_SUBCLASSE`, `CLASSES_ESCOLHAS`, `ESPECIES_TRACOS_ESCOLHA` e parsing textual.
- [ ] Aplicar escolhas somente ao confirmar modal e remover apenas concessões com a proveniência da seleção substituída.
- [ ] Registrar os três steps no step registry.
- [ ] Executar testes focais e `creator-step-harness.spec.js` para os três primeiros passos, inclusive Draconato e cancelamento de modal; executar separadamente o `creator.spec.js` público como regressão do monólito ainda ativo.

### Task 27: Migrar passos Atributos e Equipamento

**Risk:** High — combina RNG, point-buy, perícias, concessões iniciais, inventário manual e moedas.

**Files:**

- Create: `site/js/features/creator/steps/abilities-step.js`
- Create: `site/js/features/creator/steps/equipment-step.js`
- Create: `tests/unit/creator/abilities-step.test.js`
- Create: `tests/unit/creator/equipment-step.test.js`
- Create: `tests/integration/creator-abilities-equipment.test.js`

- [ ] Testar array padrão sem reutilização, point-buy 8–15/27 pontos e 4d6 descartando o menor com RNG injetado. Caracterizar e preservar o modo manual atual como visível porém desabilitado; esta refatoração não o ativa.
- [ ] Testar bônus de antecedente exatamente `+2/+1` distintos ou `+1/+1/+1`, perícias de classe e não duplicação de concessões.
- [ ] Testar opções estruturadas de equipamento de cada classe/antecedente, instrumento, item customizado, quantidade/equipar, carga e moedas.
- [ ] Testar troca de opção inicial preservando itens/moedas adicionados manualmente. Testar também, explicitamente, o caso mais amplo já fixado na matriz de invalidação da Task 25: comprar um item customizado e adicionar moedas manualmente, depois voltar e **trocar de classe** (não só trocar a opção inicial dentro da mesma classe) — `manualInventoryChanges`/`walletChanges` sobrevivem intactos a essa troca também, já que `startingEquipmentSelection`/`startingCurrencyGrant` são a única fatia que a invalidação de classe pode limpar.
- [ ] Executar os testes; o RED esperado é steps ausentes.
- [ ] Implementar atributos com regras do ruleset e equipamento com comandos da Task 19; nenhuma opção oficial é parseada de prosa.
- [ ] Manter no estado fatias separadas `startingEquipmentSelection`, `startingCurrencyGrant`, `manualInventoryChanges` e `walletChanges`.
- [ ] Registrar steps e executar testes focais mais `creator-step-harness.spec.js` dos três métodos ativos, da permanência do manual desabilitado e de equipamento; executar o `creator.spec.js` público apenas como regressão até o cutover da Task 28.

### Task 28: Migrar Magias/Detalhes, finalizar (sem cutover público)

**Ordem de execução (decisão item 13 de `questions-for-review.txt`, 2026-08-04
— a Task 28 original foi dividida em 28/28b):** os critérios de aceite da
Task 28 original colidiam de verdade — "suíte funcional completa sem
atualizar baselines" é impossível ao mesmo tempo que "substituir
`pages/creator.js`", porque `tests/e2e/dom-baseline.spec.js` grava o DOM do
criador LEGADO por passo e `tests/e2e/helpers/creator.js`/`creator.spec.js`
são escritos contra seletores do legado. Esta task (28) entrega os 2 últimos
passos, `finalizeCharacter` e a ordem de persistência — **sem** tocar
`pages/creator.js`. O cutover público em si (e a atualização consciente dos
baselines/helpers/specs do criador) é a **Task 28b**.

**Risk:** High — conclui os passos reais e a lógica de persistência que a Task 28b vai ligar ao caminho público.

**Files:**

- Create: `site/js/features/creator/steps/spells-step.js`
- Create: `site/js/features/creator/steps/details-step.js`
- Create: `site/js/features/creator/finalize-character.js`
- Create: `site/js/infra/random/crypto-rng.js` (provedor de RNG real para produção — Important 4 da Task 27, `session.rng` nunca implementado fora de testes até aqui)
- Create: `tests/unit/creator/spells-step.test.js`
- Create: `tests/unit/creator/details-step.test.js`
- Create: `tests/unit/creator/finalize-character.test.js`
- Create: `tests/unit/creator/crypto-rng.test.js`
- Create: `tests/integration/creator-persistence.test.js`
- Create: `tests/unit/architecture/creator-composition-root.test.js` (teste estático — antecipado desta task, o cutover real da Task 28b ainda precisa satisfazê-lo)

**Finalize contract:**

```js
finalizeCharacter(draftSelections, context):
  Result<CanonicalCharacter, AppError>
```

- [ ] Testar Mago, demais conjuradores, Iniciado em Magia múltiplo, grimório, preparadas, duplicatas e resposta assíncrona obsoleta.
- [ ] Testar nome, imagem por porta injetada, tamanho, idioma, alinhamento e todos os campos pessoais. `identity.size` de um personagem finalizado sem escolha explícita de tamanho é `""` — **nunca** `"medium"` nem qualquer outro valor hardcoded (mesma regra da Task 12/Global Constraints); o tamanho exibido na ficha é sempre a projeção derivada da espécie escolhida (Task 16/`queries`), nunca um valor congelado na finalização. Testar explicitamente Golias e Halfling (tamanhos não-médios) para confirmar que `finalizeCharacter` não injeta `"medium"` por baixo. `domain/character/model.js#createEmptyCharacter` também usa `size:'medium'` internamente (dívida decidida no item 13 de `questions-for-review.txt`) — corrigir a origem, não só a normalização na saída de `finalizeCharacter`.
- [ ] Provar pureza e idempotência de `finalizeCharacter` por deep equality e congelamento da entrada.
- [ ] Testar ordem controller com o port da Task 14: finalizar, preparar intent não enviável, salvar local com mutation ID, adotar, confirmar/reconciliar enqueue durável, notificar e navegar. O controller não espera a tentativa remota; o prepare interno não é visível nem pode ser enviado antes do save.
- [ ] Simular falha de prepare e falha local; draft/último passo permanecem intactos, sem job enviável nem navegação. Simular também save local válido + falha ao confirmar a fila: o personagem fica salvo/adotado, o job preparado continua durável, a UI informa “salvo localmente, sincronização pendente”, oferece retry e só então pode navegar, sem alegar sync concluído. Após reload, a reconciliação recupera o intent. Depois de enqueue válido, falha remota assíncrona pela subscription mantém estado local e status de erro/retry.
- [ ] Executar os testes; o RED esperado é steps/finalizer ausentes.
- [ ] Implementar ambos os steps com o domínio compartilhado e registrar no fluxo de sete etapas (todos os 7 reais, mas ainda só acessíveis via harness — `pages/creator.js` continua legado até a Task 28b).
- [ ] Injetar `createCryptoRng()` real na sessão que o harness/Task 28b vai montar (o composition root PÚBLICO ainda não existe nesta task, mas o provedor real precisa estar pronto para a Task 28b usar).
- [ ] Executar `npm run test:node`, os testes focais e o harness E2E completo (`creator-step-harness.spec.js`) com os 7 steps reais.

### Task 28b: Cutover público do criador

**Pré-requisito:** Task 28 completa (7 steps reais, `finalizeCharacter`, RNG de produção, ordem de persistência).

**Risk:** High — ponto de não-retorno equivalente ao da Task 22b, mas para o caminho público do criador: substitui `pages/creator.js` e o DOM que os usuários reais veem.

**Escopo:** ao contrário da Task 22b (onde o oráculo legado — `db.js`/`dados/**` — foi preservado como fixture de teste sem tocar seu conteúdo), aqui o DOM do criador muda de propósito: `tests/e2e/dom-baseline.spec.js`, `tests/e2e/helpers/creator.js` e `creator.spec.js` precisam ser **atualizados conscientemente** para refletir a nova arquitetura (mesmo padrão já usado para atualizar o teste-guarda de cutover na Task 23b — a atualização é esperada e documenta a mudança de estado, não um afrouxamento). Cada divergência de DOM entre o legado e o novo (estrutura, atributos `data-*`, classes) precisa ser justificada por escrito, não silenciosa.

**Files:**

- Modify: `site/js/pages/creator.js` (substituir por composition root fino)
- Modify: `tests/e2e/dom-baseline.spec.js` (baseline do criador atualizado conscientemente para a nova arquitetura)
- Modify: `tests/e2e/helpers/creator.js` (page object atualizado para os seletores/fluxo novos)
- Modify: `tests/e2e/creator.spec.js` (specs públicos do criador sobre o composition root novo)

- [ ] Fazer o composition root público rejeitar registry incompleto ou qualquer placeholder; somente o harness de testes pode importar `tests/e2e/harness/placeholder-creator-step.js` (o teste estático já existe desde a Task 28 — `tests/unit/architecture/creator-composition-root.test.js` — este é o ponto em que `creator.js` real precisa satisfazê-lo).
- [ ] Substituir `pages/creator.js` por composition root fino, preservando `export async function renderCreator(container)`.
- [ ] Fazer `renderCreator(container)` devolver o disposer de `mountCreator` em sucesso; consumidores antigos podem ignorar o retorno, e o router passa a utilizá-lo.
- [ ] Verificar por teste estático que `creator.js` não contém template, `innerHTML`, regra, comparação de classe/espécie nem estado de módulo.
- [ ] Atualizar conscientemente `dom-baseline.spec.js`/`tests/e2e/helpers/creator.js`/`creator.spec.js` para a nova arquitetura, documentando cada divergência estrutural real vs. o legado.
- [ ] Executar `npm run test:node` e a suíte funcional completa do criador em Chromium e critical em Firefox/WebKit. Comparar screenshots desktop/móvel somente no comando Linux separado; atualizar baselines visuais é esperado aqui (documentar a atualização), diferente do resto do plano.

## Marco 8 — SheetSession, seções e saída compartilhada

### Task 29: Implementar SheetSession, SheetViewModel e controller

**Risk:** High — estabelece o fluxo transacional de todas as ações da ficha e a projeção única usada por tela/PDF.

**Files:**

- Create: `site/js/features/sheet/sheet-session.js`
- Create: `site/js/features/sheet/sheet-state.js`
- Create: `site/js/features/sheet/sheet-command-map.js`
- Create: `site/js/features/sheet/sheet-view-model.js`
- Create: `site/js/features/sheet/sheet-controller.js`
- Create: `site/js/features/sheet/sheet-view.js`
- Create: `site/js/features/sheet/sections/section-registry.js`
- Create: `tests/unit/sheet/sheet-session.test.js`
- Create: `tests/unit/sheet/sheet-view-model.test.js`
- Create: `tests/unit/sheet/section-registry.test.js`
- Create: `tests/integration/sheet-controller.test.js`
- Create: `tests/integration/sheet-session-isolation.test.js`
- Create: `tests/e2e/harness/sheet.html`
- Create: `tests/e2e/harness/sheet-harness.js`
- Create: `tests/e2e/sheet-section-harness.spec.js`

**Session contract:**

```js
createSheetSession({
  characterId,
  registry,
  repository,
  syncQueue,
  durableMutation,
  commandDispatcher,
  projectSheet,
  preferences
})
session.initialize({ signal }): Promise<Result<SheetSnapshot, AppError>>
session.dispatch(command):
  Promise<Result<{ snapshot, dirtySections, events }, AppError>>
session.retry(failureId): Promise<Result<SheetSnapshot, AppError>>
session.setUiState(patch): Result<SheetSnapshot, AppError>
session.subscribe(listener): () => void
session.dispose(): void

mountSheet(ports): Promise<Result<() => void, AppError>>
```

**Section contract:**

```js
{
  id,
  select(viewModel),
  render(projection, uiState),
  toIntent(event, { root, projection, uiState }):
    UiEventDecision<SheetIntent>
}
```

`sheet-command-map.js` é o único dono do mapeamento entre os paths canônicos que `CommandResult.affected` emite (Task 17/18/19, vocabulário de alvos derivados da Task 15) e os IDs de `dirtySections`. `SheetViewModel` não é um shape livre: toda chave que ele expõe corresponde a uma chave em `tests/fixtures/expected/sheet-view-model-keys.json` (Task 16); a Task 33 (impressão/PDF) só pode ler campos dessa lista — nunca acessar `character`/`projection` bruto para obter um valor "que faltou" no ViewModel.

- [ ] Escrever testes para init editável, ficha ausente, schema futuro somente leitura, referência quebrada e dispose/cancelamento.
- [ ] Testar `sheet-command-map.js`: todo path canônico que as Tasks 17/18/19 emitem em `affected` mapeia para pelo menos uma seção registrada; um path sem seção correspondente é falha de teste, não um `dirtySections` vazio silencioso.
- [ ] Testar fila serial de comandos concorrentes e `expectedRevisionToken`, inclusive duas escritas no mesmo milissegundo.
- [ ] Simular comando válido + falha local: candidato descartado, estado confirmado mantido, nenhuma sync e retry disponível.
- [ ] Simular save local válido + enqueue durável: `dispatch()` termina com estado adotado, sem esperar a rede. Depois, simular falha remota assíncrona entregue pela subscription/status da sync queue; não há rollback e retry continua disponível.
- [ ] Simular save local válido + falha de `confirmPrepared`: `dispatch()` devolve sucesso local com status `reconciliation-needed`, adota/renderiza o estado, não alega sync concluído e mantém retry. Recriar sessão/fila deve promover o intent preparado e sincronizá-lo sem duplicar comando ou perder remoção; conflito concorrente permanece explícito.
- [ ] Testar duas sessões abertas sem compartilhar personagem, cache, UI state ou listeners.
- [ ] Construir expected `SheetViewModel` para todas as fixtures e comparar com `derived-values.json`.
- [ ] Garantir deep freeze e zero escrita/mutação em `buildSheetViewModel`.
- [ ] Executar os testes; o RED esperado é módulos ausentes.
- [ ] Implementar controller com um conjunto de listeners delegados na raiz, conversão por `section.toIntent()`, aplicação central de `UiEventDecision`, modais como efeito do controller e rerender apenas de `dirtySections`; nenhuma seção registra listener próprio nem recebe o modal.
- [ ] Fazer `mountSheet()` devolver disposer idempotente que cancela init/comandos pendentes, fecha modais próprios, remove listeners/subscriptions e chama `session.dispose()`.
- [ ] Implementar o ViewModel completo com identidade, progressão, atributos, combate/PV, salvaguardas, perícias, recursos, features, talentos, magias, condições, defesas, sentidos, inventário/moedas/carga, detalhes e dados imprimíveis.
- [ ] Usar somente `state.hitPoints.temporary` no ViewModel; adapters legados resolvem `pv_temp`/`pv_temporario` antes dessa camada.
- [ ] Consumir `LocalStoragePreferencesRepository` para taxas, compra equipada, `sheet_collapse_<id>` e feature flag de level-up; provar reload e isolamento sem misturar preferências ao personagem.
- [ ] Criar harness HTML/JS servido somente de `tests/e2e/harness`, fora do artifact Pages, para montar `SheetSession`, ViewModel e seções novas com repositório/sync em memória antes do cutover de `pages/sheet.js`.
- [ ] Executar testes focais e `npm run check:architecture`.

### Task 30: Migrar resumo, combate, recursos, características e progressão

**Risk:** High — concentra o cabeçalho e as ações específicas de todas as classes.

**Files:**

- Create: `site/js/features/sheet/sections/summary-combat-section.js`
- Create: `site/js/features/sheet/sections/resources-features-section.js`
- Create: `site/js/features/sheet/sections/feats-progression-section.js`
- Create: `site/js/features/sheet/sections/level-up-flow-view.js`
- Create: `tests/unit/sheet/summary-combat-section.test.js`
- Create: `tests/unit/sheet/resources-features-section.test.js`
- Create: `tests/unit/sheet/feats-progression-section.test.js`
- Create: `tests/unit/sheet/level-up-flow-view.test.js`
- Create: `tests/integration/sheet-core-sections.test.js`

- [ ] Consumir `tests/fixtures/dom-baseline/sheet-sections.json` capturado na Task 3 e escrever testes para os mesmos IDs, classes, textos e ordem; esta tarefa não pode regenerar o oracle.
- [ ] Testar dano, cura, PV temporário, dados de vida, descansos, morte, atributos, perícias, ataques, CA, deslocamento e edição permitida.
- [ ] Testar projeção/ação/recarga **de toda** ação registrada no catálogo, não uma amostra: para cada `officialHandlerRef`/ID de ação presente em `dados/pacotes/dnd2024/**` (mesma fonte de IDs que `official-handler-coverage.test.js` da Task 22, reaproveitada aqui para as duas listas não poderem divergir), a seção correspondente deve renderizar um elemento carregando esse ID de ação, e disparar essa ação deve devolver `ok: true` ou um erro de validação **declarado** — nunca um clique que silenciosamente não faz nada porque nenhum handler registrado casa com o `data-action`.
- [ ] Testar talentos, XP e level-up com modal cancelado/confirmado sem alteração parcial.
- [ ] Antes de testar os dois modos abaixo, capturar em `tests/fixtures/dom-baseline/sheet-sections.json` (Task 3) — usando o mesmo processo `UPDATE_DOM_BASELINE=1` contra o baseline `e43c5ea`, se ainda não existir — uma variante rotulada com `feature.levelup.flow.v2` semeado como `"false"`; essa captura nunca foi feita na Task 3 porque a flag ainda não existia como conceito ali. `level-up-flow-view.js` é comparado contra essa variante capturada, não apenas executado sem travar.
- [ ] Testar os dois modos existentes: flag v2 `true` renderiza o fluxo em cards; flag `false` renderiza o fluxo legado compatível por `level-up-flow-view.js`, comparado por DOM contra a variante capturada acima. Ambos usam os mesmos comandos canônicos, e remover arquivos legados na Task 37 não pode remover o modo `false` nem pode se basear só em "a suíte E2E não travou" (ver Task 37).
- [ ] Executar os testes; o RED esperado é seções ausentes.
- [ ] Implementar seções como renderizadores de projeção + emissores de comandos; nenhuma seção recebe repository nem registro persistido.
- [ ] Usar `data-action`, IDs estáveis e event delegation; rerender de uma seção não remove handlers das demais.
- [ ] Integrar as três seções no registry sem wrapper visual adicional.
- [ ] Executar testes focais e `sheet-section-harness.spec.js` nas três seções novas; executar `sheet-vitals.spec.js`/recursos públicos apenas como regressão do monólito e deixar comparação visual pública para o cutover da Task 33.

### Task 31: Migrar magias, grimório, concentração, condições, defesas e sentidos

**Risk:** High — substitui modais complexos e várias regras hoje calculadas dentro da renderização.

**Files:**

- Create: `site/js/features/sheet/sections/spells-spellbook-section.js`
- Create: `site/js/features/sheet/sections/conditions-defenses-senses-section.js`
- Create: `tests/unit/sheet/spells-spellbook-section.test.js`
- Create: `tests/unit/sheet/conditions-defenses-senses-section.test.js`
- Create: `tests/integration/sheet-spells-conditions.test.js`

- [ ] Escrever testes de preparar/despreparar, grimório, conjurar, slot/pacto, concessão, metamagia e efeito manual/declarativo.
- [ ] Testar concentração: cancelar modal não muda nada; confirmar substituição envia um único comando.
- [ ] Testar condições, vantagem/desvantagem, resistências, imunidades, vulnerabilidades e sentidos para as fixtures.
- [ ] Comparar markup e textos com baseline, incluindo estados vazios/erro.
- [ ] Executar os testes; o RED esperado é seções ausentes.
- [ ] Implementar seções somente sobre `SheetViewModel` e intents; detalhes das magias usam Markdown seguro.
- [ ] Remover da nova seção qualquer tabela `MAGIAS_EFEITO`, regex de descrição ou comparação por nome.
- [ ] Integrar no registry e executar testes focais mais `sheet-section-harness.spec.js` de magias/concentração/condições; executar o E2E público correspondente apenas como regressão até a Task 33.

### Task 32: Migrar inventário, carga, moedas e detalhes pessoais

**Risk:** High — cobre drag-and-drop, modais de compra/customização, imagens e edição persistida.

**Files:**

- Create: `site/js/features/sheet/sections/inventory-load-coins-section.js`
- Create: `site/js/features/sheet/sections/personal-details-section.js`
- Create: `tests/unit/sheet/inventory-load-coins-section.test.js`
- Create: `tests/unit/sheet/personal-details-section.test.js`
- Create: `tests/integration/sheet-inventory-details.test.js`

- [ ] Escrever testes DOM para itens ativos/esgotados, equipar, quantidade, remover, reorder, compra, moedas, taxas, carga e itens customizados.
- [ ] Drag-and-drop deve emitir permutação de instance IDs, nunca índices.
- [ ] Escrever testes de edição de nome/imagem/alinhamento/campos pessoais, sanitização e falha do image processor.
- [ ] Simular cancelamento de todos os modais sem mutação e falha local sem adoção do candidato.
- [ ] Executar os testes; o RED esperado é seções ausentes.
- [ ] Reutilizar integralmente queries/comandos da Task 19 e portas seguras de UI.
- [ ] Integrar as seções e executar testes focais mais `sheet-section-harness.spec.js` para inventário/detalhes, incluindo reload das quatro preferências legadas. Executar `sheet-inventory.spec.js` público como regressão e deixar os visuais desktop/móvel da implementação nova para a Task 33.

### Task 33: Unificar impressão/PDF e reduzir `sheet.js`

**Risk:** High — troca a saída PDF e conclui a substituição do maior monólito.

**Files:**

- Create: `site/js/features/sheet/print/print-view.js`
- Create: `site/js/features/sheet/pdf/pdf-lib-loader.js`
- Create: `site/js/features/sheet/pdf/pdf-drawing-plan.js`
- Create: `site/js/features/sheet/pdf/pdf-lib-backend.js`
- Create: `site/js/features/sheet/pdf/pdf-renderer.js`
- Create: `site/js/features/sheet/pdf/download-pdf.js`
- Create: `tests/unit/sheet/print-view.test.js`
- Create: `tests/unit/sheet/pdf-drawing-plan.test.js`
- Create: `tests/unit/sheet/pdf-lib-loader.test.js`
- Create: `tests/unit/sheet/pdf-renderer.test.js`
- Create: `tests/unit/sheet/download-pdf.test.js`
- Create: `tests/helpers/recording-pdf-backend.js`
- Create: `tests/contract/sheet-output-parity.test.js`
- Create: `tests/integration/sheet-persistence.test.js`
- Modify: `site/js/pages/sheet.js`

**Interfaces:**

```js
renderPrintHtml(viewModel, ports): string
createPdfDrawingPlan(viewModel): ReadonlyArray<PdfDrawOperation>
createPdfLibBackend(PDFLib, { fonts, assets }): PdfDrawingBackend
PdfDrawingBackend
  .render(operations):
    Promise<Result<Uint8Array, AppError>>
createRecordingPdfBackend()
  .render(operations):
    Promise<Result<Uint8Array, AppError>>
  .getOperations(): ReadonlyArray<PdfDrawOperation>
renderPdf(viewModel, { backend }):
  Promise<Result<Uint8Array, AppError>>
loadPdfLib({ documentRef, globalRef, scriptUrl }):
  Promise<Result<PDFLibNamespace, AppError>>
downloadPdf(viewModel, ports): Promise<Result<void, AppError>>
```

- [ ] Escrever teste que extrai os valores de tela e print e compara as operações semânticas capturadas por um `RecordingPdfBackend`. Exigir igualdade com `expectedUnified` para PV temporário/máximo, CA, atributos, perícias, ataques, recursos, magias, inventário e moedas sem tentar inferir texto dos bytes finais. Uma diferença frente a `baselineObserved` só é aceita se estiver listada em `baselineDifferences` e convergir exatamente pela política da Task 2.
- [ ] Testar drawing plan puro, contrato compartilhado do backend, backend gravador, PDF sem DOMParser/HTML intermediário, bytes válidos no backend real, nome atual do download, overlay, deduplicação de loads e retry após erro do loader.
- [ ] Testar impressão com `@media print`, mesmas seções e diferenças apenas de layout.
- [ ] Testar save/reload de cada família de comando pelo repository real em memória.
- [ ] Executar testes; o RED esperado é nova saída ausente.
- [ ] Implementar tela/print/drawing plan diretamente sobre o mesmo `SheetViewModel`. Manter compatibilidade com o vendor UMD atual: o default de `pdf-lib-loader.js` é `new URL("../../../vendor/pdf-lib.min.js", import.meta.url)`, ele injeta uma única vez o `<script>` com essa URL, resolve `window.PDFLib`, compartilha promise concorrente e permite retry após erro; não usar path relativo ao documento nem `import()` como se o arquivo fosse ESM. **Nota entre tarefas:** essa URL injetada via `<script>` não é alcançável pelo grafo de completude do precache da Task 35 (não é import estático nem referência HTML/CSS) — a Task 35 já foi instruída a incluir `site/vendor/**` explicitamente, mas se a Task 35 já tiver sido executada antes desta quando o plano for seguido fora de ordem, confirmar manualmente que `pdf-lib.min.js` está no manifesto antes de considerar esta tarefa concluída.
- [ ] Substituir `pages/sheet.js` por composition root fino, preservando `export async function renderSheet(container, charId)`.
- [ ] Fazer `renderSheet(container, charId)` devolver o disposer de `mountSheet`; consumidores antigos podem ignorar o retorno, e o router o utiliza.
- [ ] Verificar estaticamente que `sheet.js` não contém template, `innerHTML`, regra, parser de prosa, comparação de conteúdo ou estado singleton.
- [ ] Executar todos os testes Node e Playwright funcional completo da ficha/PDF/print. Comparar screenshots somente no comando Linux separado; nenhum valor ou screenshot pode divergir sem revisão explícita.

## Marco 9 — Carregamento, artifact e PWA

### Task 34: Tornar as rotas lazy e cancelar navegações obsoletas

**Risk:** High — altera o boot público e precisa preservar hashes, back/home, erros e descarte das páginas anteriores.

**Files:**

- Create: `site/js/core/hash-router.js`
- Create: `tests/unit/core/hash-router.test.js`
- Create: `tests/e2e/routes-lazy.spec.js`
- Modify: `site/js/app.js`
- Modify: `site/js/pages/home.js`
- Modify: `site/js/pages/creator.js`
- Modify: `site/js/pages/sheet.js`

**Router contract:**

```js
createHashRouter({
  routes,
  getHash,
  setHash,
  subscribeHashChange,
  contentRoot,
  onRouteState,
  renderError
})
router.start(): () => void
router.navigate(route): void
router.process(): Promise<Result<void, AppError>>
```

Cada route entry contém `load: () => import(...)` e `exportName`. Todo módulo de rota (`renderHome`, `renderCreator`, `renderSheet`) exporta a mesma assinatura de retorno — `Result<() => void, AppError>`, nunca `void`/`undefined` implícito — com um disposer no-op (`() => {}`) quando a página não tem nada para limpar. `renderHome` (modificado nesta tarefa) também passa a devolver esse Result; o router chama o disposer da rota anterior exatamente uma vez antes de montar a próxima, e uma rota que "esquece" de devolver disposer não pode virar `undefined()` lançando exceção no meio da navegação.

- [ ] Escrever teste unitário para parse de `#home`, `#criar`, `#ficha/<id>`, rota inválida, `setHash`, subscription, geração e disposer. O router não acessa `window`, `location` ou `history` fora das portas injetadas.
- [ ] Testar que o disposer de cada uma das três rotas (incluindo `renderHome`, ainda que hoje não precise limpar nada) é chamado exatamente uma vez antes da próxima rota renderizar; uma rota sem disposer próprio devolve o no-op explícito, nunca `undefined`.
- [ ] Configurar `routes-lazy.spec.js` com `test.use({ serviceWorkers: "block" })` e limpar caches antes do teste; assim o precache não mascara a rede lazy. Provar que abrir home não baixa `creator.js`, `sheet.js` nem seus grafos antes de navegar.
- [ ] Testar deep link direto para ficha/criador, voltar, home e alternância rápida; apenas a última geração pode renderizar.
- [ ] Testar erro de import/initialize com mensagem recuperável e sem handler inline.
- [ ] Executar os testes; o RED esperado mostra imports estáticos atuais e resposta obsoleta.
- [ ] Implementar `AbortController` por navegação, generation guard, adapters browser de `getHash/setHash/subscribeHashChange` no composition root e chamada idempotente do disposer devolvido pela página anterior.
- [ ] Manter os mesmos hashes, títulos, ícone/botão voltar e globais temporários ainda necessários.
- [ ] Executar testes focais e a suíte `@critical` nos quatro projetos Playwright.

### Task 35: Gerar artifact Pages e manifesto de precache determinísticos

**Risk:** High — qualquer erro de caminho ou arquivo omitido quebra deploy/offline em subpath.

**Files:**

- Create: `.nvmrc`
- Create: `scripts/lib/sha256.mjs`
- Create: `scripts/lib/precache-manifest.mjs`
- Create: `scripts/prepare-pages.mjs`
- Create: `scripts/verify-pages-artifact.mjs`
- Create: `tests/deploy/precache-manifest.test.js`
- Create: `tests/deploy/pages-artifact.test.js`
- Modify: `site/index.html`
- Modify: `site/sw.js`
- Modify: `package.json`
- Modify: `.gitignore`

**Commands:**

```text
npm run build:pages -- --out _dist --version verify-1
npm run verify:pages -- --dir _dist
```

O gerador produz `_dist/site/precache-manifest.json`:

```json
{
  "schemaVersion": 1,
  "deployVersion": "verify-1",
  "staticAssets": [
    {
      "url": "./index.html",
      "sha256": "0000000000000000000000000000000000000000000000000000000000000000"
    }
  ],
  "dataAssets": [
    {
      "url": "../dados/pacotes/dnd2024/manifest.json",
      "sha256": "0000000000000000000000000000000000000000000000000000000000000000"
    }
  ]
}
```

Cada entrada é `{ url, sha256 }`; os 64 zeros acima mostram apenas o formato, e o gerador sempre os substitui pelo SHA-256 real dos bytes finais já copiados/injetados. `precache-manifest.json` não se autoenumera: o worker o carrega e armazena separadamente depois de validar schema/versão, evitando hash recursivo.

- [ ] Fixar `.nvmrc` em `22.17.1`.
- [ ] Escrever teste RED que detecta a lista manual incompleta do worker atual; o RED esperado lista assets alcançáveis ausentes e ausência de hashes.
- [ ] Exigir layout `_dist/index.html`, `_dist/site/**` e `_dist/dados/**`, sem alterar os arquivos-fonte.
- [ ] Gerar entries ordenadas com `/`, relativas ao escopo do worker; incluir todo HTML/JS/CSS/imagem/fonte/JSON publicável de `site`, especialmente `site/manifest.json`, favicon, **todo `site/vendor/**` (inclusive `pdf-lib.min.js`, carregado pela Task 33 via injeção de `<script>` — um `new URL(...)` passado a um elemento `<script>` criado dinamicamente não é alcançável pelo grafo de imports/HTML/CSS e precisa de uma regra de inclusão explícita, não implícita)** e demais assets locais alcançáveis de HTML/CSS/imports, além de todos os schemas e todo JSON alcançável pelos manifestos/índices do pacote oficial. Calcular SHA-256 após todas as transformações do artifact.
- [ ] Testar especificamente que remover o `<link rel="manifest">` do grafo, omitir `site/manifest.json`, omitir `site/vendor/pdf-lib.min.js` ou qualquer ícone referenciado faz a completude falhar; `precache-manifest.json` continua fora da autoenumeração.
- [ ] Rejeitar duplicata, URL externa, query, fragmento, path absoluto e travessia fora de `../dados`.
- [ ] Testar que duas execuções com mesmos inputs/versão geram bytes idênticos.
- [ ] Testar `verify-pages-artifact` removendo, adicionando e adulterando um asset em cópia temporária; recalcular apenas tamanho/data não pode enganar o verificador, e cada divergência de SHA-256 deve falhar.
- [ ] Implementar injeção da versão por marcador exato tanto no header quanto na cópia de `site/sw.js`, sem `sed`, e geração do manifesto sem Python inline. O worker publicado contém `const DEPLOY_VERSION = "<versão>"`, para recuperar os nomes dos caches mesmo depois de cold start offline; os fontes permanecem com um único marcador auditável.
- [ ] Acrescentar `"build:pages": "node scripts/prepare-pages.mjs"` e `"verify:pages": "node scripts/verify-pages-artifact.mjs"` ao `package.json`.
- [ ] Executar os dois testes, os dois comandos acima e `git diff --check`; o artifact deve ser válido e `_dist/` continuar ignorado.

### Task 36: Migrar Service Worker e workflows; validar subpath/offline/update

**Risk:** High — envolve instalação/ativação atômica, caches persistentes e publicação.

**Files:**

- Create: `site/js/infra/pwa/service-worker-client.js`
- Create: `playwright.pwa.config.js`
- Create: `tests/e2e/helpers/versioned-pages-server.js`
- Create: `tests/e2e/pwa-precache.spec.js`
- Create: `tests/e2e/pwa-offline.spec.js`
- Create: `tests/e2e/pwa-update.spec.js`
- Create: `tests/deploy/workflows.test.js`
- Create: `.github/workflows/ci.yml`
- Modify: `site/sw.js`
- Modify: `site/js/app.js`
- Modify: `playwright.config.js`
- Modify: `scripts/check-syntax.mjs`
- Modify: `.github/workflows/deploy.yml`
- Modify: `package.json`

**PWA contracts:**

```js
registerServiceWorker({ canReload, onUpdate, onError }):
  Promise<Result<ServiceWorkerRegistration, AppError>>
```

Caches: `dnd-ficha-static-v<deployVersion>` e `dnd-ficha-data-v<deployVersion>`.

- [ ] Escrever testes serializados que servem artifacts sob `/D-D_2024/site/`, com versões `test-v1`, `test-v2` e `test-broken`.
- [ ] Configurar em `playwright.pwa.config.js` `testMatch` somente para `pwa-precache.spec.js`, `pwa-offline.spec.js` e `pwa-update.spec.js`, além de um único projeto `pwa-pages`, Chromium desktop, `baseURL: "http://127.0.0.1:4174/D-D_2024/site/"`, `serviceWorkers: "allow"` e o servidor de artifacts versionados na porta 4174. Esses specs não reutilizam o `baseURL` `/site/` do config comum e nunca coletam visual/funcional/compat.
- [ ] Fazer `playwright.config.js` ignorar `pwa-precache|pwa-offline|pwa-update`; esses specs rodam exclusivamente pelo config PWA. O `pwa.spec.js` de caracterização baseline continua no projeto Chromium comum.
- [ ] Confirmar em teste que `check-syntax.mjs` descobriu e validou `playwright.pwa.config.js`.
- [ ] Visitar apenas home, ficar offline e abrir criador/ficha não visitados; módulos dinâmicos e dados oficiais precisam vir do precache. Incluir explicitamente exportar PDF offline de uma ficha não visitada antes de ficar offline — `site/vendor/pdf-lib.min.js` (Task 33/35) só é coberto pelo precache se a Task 35 o incluiu corretamente; esta é a única execução automatizada de ponta a ponta que provaria uma regressão aí.
- [ ] Confirmar cada URL/hash do manifesto no Cache Storage, manifesto/worker ativos e `localStorage` intacto. Adulterar bytes mantendo a mesma URL e exigir falha de instalação por `PWA_ASSET_INTEGRITY_MISMATCH`.
- [ ] Atualizar v1→v2, aplicar `SKIP_WAITING`, manter personagens e remover somente caches v1 da aplicação — mas só depois de confirmar por `clients.matchAll()` que nenhum client segue controlado pelo worker v1; havendo cliente v1 ainda controlado (outra aba aberta), adiar a remoção para a próxima ativação em vez de apagar os caches que essa aba pode continuar precisando. Com rotas lazy (Task 34), uma aba v1 pode importar dinamicamente um módulo de rota ainda não carregado a qualquer momento depois da ativação de outra aba em v2 — remover os caches v1 cedo demais quebra esse `import()` no meio da navegação, misturando exatamente o v1/v2 que este item pretende impedir.
- [ ] Testar duas páginas abertas simultaneamente: aplicar a atualização em uma (via `SKIP_WAITING` + reload), manter a outra sem recarregar, e então navegar na segunda para uma rota lazy ainda não importada por ela. Confirmar que essa navegação não falha e não mistura bytes v1/v2, seja porque os caches v1 ainda existem (client v1 detectado) seja porque a segunda aba já foi reclamada por `clients.claim()` de forma consistente.
- [ ] Simular servidor já em v2 enquanto o worker v1 continua ativo e o worker v2 está waiting; mesmo com respostas HTTP cacheáveis/stale, cada módulo, navegação e JSON observado pelo cliente deve continuar 100% v1 até a ativação, e passar integralmente a v2 somente após `SKIP_WAITING` + reload controlado.
- [ ] Em `test-broken`, falhar instalação e manter o worker/cache v2; não ativar cache parcial.
- [ ] Criar cache estrangeiro e provar que activate/clear não o remove. O filtro de limpeza usa os prefixos `dnd-ficha-static-v`/`dnd-ficha-data-v` mais o sufixo da `deployVersion` ativa — um cache com um desses prefixos mas versão antiga é da própria aplicação e deve ser removido (respeitando a checagem de `clients.matchAll()` acima); um cache com nome fora desses dois prefixos (ex.: `outro-app-v1`) é estrangeiro e nunca é tocado. Os caches numéricos do worker anterior a esta tarefa (`dnd-ficha-static-v0`, `v1`, ... — ver `site/sw.js` atual) já casam com esse prefixo e são removidos normalmente na primeira ativação da versão nova; nenhuma migração especial é necessária para eles além da checagem de clients acima.
- [ ] Para JSON ausente offline, exigir resposta 503 JSON estruturada; nunca `200 null`. Requests não GET e Firebase/Google não são cacheados.
- [ ] Executar testes PWA contra worker atual; o RED esperado é manifesto incompleto, cache não atômico e fallback `null`.
- [ ] Implementar install transacional sem “rename” inexistente: buscar `precache-manifest.json` e cada asset com `fetch(..., { cache: "no-store" })`, exigir `manifest.deployVersion === DEPLOY_VERSION`, abrir os caches finais da nova versão, calcular SHA-256 com `crypto.subtle`, comparar com o manifesto e fazer `put`. Os testes servem deliberadamente headers cacheáveis e uma resposta stale para provar que o HTTP cache não participa. O worker/cache antigo continua ativo durante todo o install. Se qualquer fetch/schema/versão/hash/put falhar, apagar somente os dois caches da nova versão e rejeitar `event.waitUntil`; o worker novo não ativa. Resolver o install apenas depois de todos os assets e o manifesto terem sido gravados.
- [ ] No worker publicado, servir cache-first imutável para toda URL listada no manifesto da `deployVersion` ativa, inclusive navegação/shell, módulos e `../dados`; o cache ativo nunca é atualizado com bytes de rede. Rede e cache on-demand ficam restritos ao modo `dev` ou a URLs fora do manifesto. Asset obrigatório ausente no cache é erro estruturado, não fallback de rede que misture versões.
- [ ] Em desenvolvimento sem manifesto gerado e com marcador de versão não resolvido, usar versão explícita `dev`, manter shell mínimo e cache sob demanda; nunca criar cache cujo nome contenha literalmente o marcador.
- [ ] Extrair registro/update/reload seguro para `service-worker-client.js`, preservando espera por fechamento de modal.
- [ ] Criar `ci.yml` reutilizável (`workflow_call`) e também acionado em PR/push, com checkout `fetch-depth: 0` em todo job que executa scripts do repositório, Node exato `22.17.1`, Python `3.12` para o contrato do extrator, job Node/data/deploy, Firestore Emulator com Java 21 e job browser na imagem `mcr.microsoft.com/playwright:v1.62.0-noble`. O job browser executa funcional, visual e PWA; screenshots nunca são atualizados. O history completo já fica disponível para o round-trip com `e43c5ea` acrescentado na Task 37.
- [ ] Fazer `deploy.yml` chamar o workflow reutilizável em um job `verify` e declarar `needs: verify` no job de publicação. Só depois ele usa Node `22.17.1`, `npm ci`, checks, `npm run build:pages -- --out _dist --version "${{ github.sha }}-${{ github.run_number }}"` e `npm run verify:pages -- --dir _dist`; upload/deploy continuam somente na `main`. Assim o deploy não publica quando Firebase, browser, visual ou PWA falham.
- [ ] Escrever `workflows.test.js` usando `YAML.parse` sobre cada `.github/workflows/*.yml`, com fixture textual de YAML inválido que precisa falhar. Asserir estruturalmente triggers, permissões, jobs/`uses`/`needs`, checkout `fetch-depth: 0`, versões exatas, matriz obrigatória e layout/commands versionados; proibir preparação por `cp`, Python inline ou `sed`. Regex isolada não pode ser a validação de sintaxe/estrutura.
- [ ] Acrescentar `"test:deploy": "node scripts/run-node-tests.mjs tests/deploy"` e `"test:e2e:pwa": "playwright test --config=playwright.pwa.config.js --project=pwa-pages --workers=1"` ao `package.json`.
- [ ] Executar `npm run test:e2e:pwa`, `npm run test:deploy` e um build/verify local; todos devem passar. Executar `npm run test:e2e:visual` no job/container Linux fixado.

## Marco 10 — Limpeza e verificação de release

### Task 37: Remover caminhos legados internos, documentar e executar toda a matriz

**Risk:** High — a remoção final pode atingir imports usados apenas em rotas/offline ou compatibilidade com saves antigos.

**Files:**

- Create: `scripts/check-thin-entrypoints.mjs`
- Create: `scripts/check-inline-handlers.mjs`
- Create: `scripts/materialize-baseline.mjs`
- Create: `scripts/run-baseline-roundtrip.mjs`
- Create: `playwright.compat.config.js`
- Create: `tests/e2e/helpers/baseline-app.js`
- Create: `tests/e2e/baseline-roundtrip.spec.js`
- Create: `docs/architecture/content-packages.md`
- Create: `docs/architecture/character-storage-v2.md`
- Create: `docs/testing.md`
- Create: `docs/deploy-pwa.md`
- Modify: `README.md`
- Modify: `iniciar_servidor.ps1`
- Modify: `playwright.config.js`
- Modify: `scripts/check-syntax.mjs`
- Modify: `site/index.html`
- Modify: `site/js/db.js`
- Modify: `site/js/store.js`
- Modify: `site/js/sync.js`
- Modify: `site/js/auth.js`
- Modify: `site/js/utils.js`
- Modify: `.github/workflows/ci.yml`
- Review and conditionally delete after zero imports: `site/js/dados-classes.js`
- Review and conditionally delete after zero imports: `site/js/regras-cobertura.js`
- Review and conditionally delete after zero imports: `site/js/talentos-effects.js`
- Review and conditionally delete after zero imports: `site/js/ficha-edicoes.js`
- Review and conditionally delete after zero imports: `site/js/ficha-edicao-validacoes.js`
- Review and conditionally delete after zero imports: `site/js/levelup.js`
- Review and conditionally delete after zero imports: `site/js/levelup-flow.js`
- Review and conditionally delete after zero imports: `site/js/levelup-cards.js`
- Review and conditionally delete after zero imports: `site/js/levelup-ui.js`
- Review and conditionally delete after zero imports: `site/js/levelup-validations.js`
- Review and conditionally delete after zero imports: `site/js/manobras-ui.js`
- Review and conditionally delete after zero imports: `site/js/moedas.js`
- Modify: `package.json`

- [ ] Escrever `check-thin-entrypoints.mjs` exigindo que `pages/creator.js` e `pages/sheet.js` exportem apenas suas entradas, componham dependências e não contenham template, regras, nomes de conteúdo ou singleton.
- [ ] Escrever `check-inline-handlers.mjs` para falhar em `on*=` no HTML/template e atribuições `window.*` não registradas em allowlist temporária.
- [ ] Executar os dois checks antes da limpeza; o RED esperado lista fachadas/entrypoints ainda espessos e cada handler inline remanescente, sem modificar arquivos.
- [ ] Materializar `e43c5ea` em `.tmp/baseline-e43c5ea/` usando `git ls-tree`/`git show`, sem checkout/reset e sem alterar o worktree. Recusar execução se o diretório já existir, para nunca apagar conteúdo preexistente do usuário.
- [ ] Fazer o config comum ignorar `baseline-roundtrip.spec.js`. Configurar `playwright.compat.config.js` com `testMatch` somente para `baseline-roundtrip.spec.js` e dois `webServer`: app novo em `127.0.0.1:4173` e baseline materializado em `127.0.0.1:4175`, ambos via `scripts/serve-static.mjs`; somente Chromium desktop executa essa suíte.
- [ ] Confirmar em teste que `check-syntax.mjs` descobriu e validou `playwright.compat.config.js`.
- [ ] Implementar `run-baseline-roundtrip.mjs` para materializar o baseline, iniciar Playwright com o config compatível e remover apenas `.tmp/baseline-e43c5ea` validado ao terminar. Acrescentar `"test:e2e:compat": "node scripts/run-baseline-roundtrip.mjs"` ao `package.json`.
- [ ] No E2E de round-trip: criar/exportar v2 no app novo; no app baseline, aplicar **todas** as edições abaixo (não uma amostra como "campo compatível" — este é o único gate de ponta a ponta do plano inteiro para os riscos abaixo, e depois dele o código legado é apagado sem caminho de volta): (a) um override em cada path da allowlist de edição da Task 17 pela UI de edição do baseline; (b) o peso/custo textual de um item de inventário customizado; (c) preparar/despreparar uma magia; (d) uma alteração de moeda; (e) o uso de um recurso de classe; (f) confirmar explicitamente que `_local_sync.lastMutationId` sobrevive ao salvamento do baseline **ou**, se o baseline o descartar, que `reconcilePrepared` (Task 14) lida com isso sem duplicar um upsert. Depois de cada edição, reimportar no app novo e confirmar refs canônicas, passthrough, `edicoes`/overrides (nas duas direções — Task 17), inventário (incluindo o texto regenerado), magias e recursos sem perda.
- [ ] Testar novamente backup export/restore e schema futuro somente leitura/exportável.
- [ ] Executar `rg -n \"onclick=|onchange=|oninput=|onsubmit=\" site`; migrar todas as ocorrências restantes para event delegation e então remover `'unsafe-inline'` de `script-src`. Manter `style-src 'unsafe-inline'` conforme escopo aprovado.
- [ ] Para cada fachada legada candidata a remoção, usar o mesmo grafo de imports estáticos **e dinâmicos** que `check-architecture.mjs` (Task 4) já constrói — não `rg` sozinho, que não enxerga `import()` computado nem atribuição a `window.*`. Combinar com o allowlist de `check-inline-handlers.mjs` (`window.*` ainda necessário, Task 34) antes de considerar um arquivo órfão. Um candidato só é apagado depois de provado inalcançável pelos dois mecanismos; se houver compatibilidade pública necessária, mantê-la fina e coberta por teste, sem regra/estado próprio.
- [ ] Antes de remover qualquer `levelup-*.js`, executar E2E com `feature.levelup.flow.v2` em `true` e `false`; o modo compatível novo deve cobrir ambos. A flag e seu modo `false` não são removidos por esta refatoração.
- [ ] Confirmar que runtime não requisita os JSON legados. Mantê-los somente como referência histórica auditável ou removê-los quando não forem usados por conversores; `dados/pacotes/dnd2024` permanece a única fonte mecânica runtime.
- [ ] Se a divergência `entity.schemaVersion` (inteiro) vs `manifest.entitySchemaVersions[type]` sinalizada na Task 7 ainda não tiver sido reconciliada por nenhuma tarefa intermediária, reconciliar agora e acrescentar o teste de igualdade estrita entre os dois a `dnd2024-package.test.js`; remover a entrada correspondente de `questions-for-review.txt` só depois do teste passar.
- [ ] Atualizar README com arquitetura final, comandos, `../dados` correto, pacote oficial, schema v2, backup, Emulator, Playwright e deploy. Remover toda menção à substituição de path por `sed`.
- [ ] Atualizar `iniciar_servidor.ps1` para remover a dependência de `.venv`, manter `python -m http.server` como fallback de runtime local sem Node e aceitar opt-in para o servidor Node de testes. Abrir navegador somente quando solicitado por parâmetro; Node continua obrigatório apenas para testes/validação/artifact.
- [ ] Documentar contratos de pacote/conteúdo futuro sem anunciar importador/editor existente.
- [ ] Acrescentar `"check:entrypoints": "node scripts/check-thin-entrypoints.mjs"`, `"check:inline-handlers": "node scripts/check-inline-handlers.mjs"` e `"verify": "npm run check:syntax && npm run check:architecture && npm run check:validators && npm run validate:data && npm run check:entrypoints && npm run check:inline-handlers && npm run test:node && npm run test:extractor && npm run test:deploy && npm run test:firebase && npm run test:e2e && npm run test:e2e:compat && npm run test:e2e:pwa"` ao `package.json`. `verify` é funcional e não executa snapshots no host; o gate visual permanece separado e obrigatório no Linux fixado.
- [ ] Acrescentar `test:e2e:compat` ao job browser reutilizável e ao contrato de workflow; exigir novamente checkout `fetch-depth: 0`, pois `materialize-baseline.mjs` depende de `git show e43c5ea`. Acrescentar também `check:entrypoints` e `check:inline-handlers` ao job Node reutilizável e às asserções estruturais de `workflows.test.js`; o deploy permanece dependente desses checks e do job browser.
- [ ] Executar, nesta ordem. A linha Firebase requer Java 21; no host atual com Java 8, executar o preflight local para confirmar a recusa e deixar somente esse item pendente para o job remoto descrito abaixo:

```text
npm ci
npm run check:syntax
npm run check:architecture
npm run check:validators
npm run validate:data
npm run check:entrypoints
npm run check:inline-handlers
npm run test:node
npm run test:extractor
npm run test:deploy
npm run test:firebase
npm run build:pages -- --out _dist --version final-verification
npm run verify:pages -- --dir _dist
npm run test:e2e -- --reporter=line
npm run test:e2e:compat
npm run test:e2e:pwa
git diff --check
git status --short
```

- [ ] Com Java 21 ativo, confirmar zero falhas locais no bloco acima. Se Java 21 não estiver disponível, pedir ao usuário o checkpoint/push manual e anexar o job Firestore/Java 21 verde de `ci.yml` para o mesmo SHA de `HEAD`; nenhuma mudança em runtime/dados pode ocorrer depois desse SHA sem repetir o gate. Sem execução local ou esse resultado remoto, a verificação Firebase não está concluída.
- [ ] Na imagem Linux `mcr.microsoft.com/playwright:v1.62.0-noble`, executar `npm ci && npm run test:e2e:visual`; alternativamente anexar o job browser reutilizável verde da Task 36 para o mesmo SHA. Sem esse resultado Linux, a regressão visual não está concluída.
- [ ] Confirmar zero falhas, zero snapshots atualizados, nenhum acesso ao Firebase real e nenhum arquivo `_dist`, `.tmp`, report ou credencial incluído no diff.
- [ ] Fazer verificação manual apenas do prompt nativo de instalação PWA; manifesto, worker, update e offline já devem estar automatizados.
- [ ] Não criar commit, tag, PR ou deploy. Entregar o worktree testado para decisão do usuário.

## Critérios finais de saída

- Todos os critérios da especificação aprovada em `docs/superpowers/specs/2026-07-26-refatoracao-arquitetura-regras-design.md` estão mapeados para ao menos um teste acima.
- `renderCreator(container)` e `renderSheet(container, charId)` continuam sendo as entradas públicas.
- O domínio não conhece DOM, rede, armazenamento ou Firebase.
- Conteúdo oficial é versionado, validado e resolvido pela mesma interface preparada para fontes futuras.
- Fichas legadas, v2 e futuras seguem os modos editável/somente leitura previstos e nunca perdem dados silenciosamente.
- Home, criador, ficha, impressão, PDF, sync, PWA e GitHub Pages passam na matriz automatizada.
- Nenhum commit ou deploy é feito automaticamente.
