# Matriz de testes e verificação

Comando agregador: **`npm run verify`** — roda todos os gates FUNCIONAIS na
ordem abaixo. O gate VISUAL fica fora do `verify` de propósito: ele é
obrigatório, mas só roda no Linux pinado (ver última seção).

| Gate | Comando | Requisitos | O que prova |
|---|---|---|---|
| Sintaxe | `check:syntax` | Node | `node --check` em todo JS, incl. `playwright*.config.js` |
| Arquitetura | `check:architecture` | Node | direção de camadas; domínio sem DOM/rede/storage/Firebase; capacidades oficiais restritas ao composition root |
| Entrypoints | `check:entrypoints` | Node | `pages/creator.js`/`pages/sheet.js` finos: só a entrada pública, sem template/regra/estado |
| Handlers inline | `check:inline-handlers` | Node | nenhum `on*=` em `site/**`; `window.*` só na allowlist congelada |
| Validadores | `check:validators` | Node | validadores Ajv gerados sem drift dos schemas |
| Dados | `validate:data` | Node | `dados/pacotes/**` válido contra `dados/schemas/v1/**` |
| Node | `test:node` | Node | unit + contract + integration + deploy (inclui paridade com oráculos legados congelados do commit `e43c5ea`) |
| Extrator | `test:extractor` | Node + Python 3.12 | contrato do `_extrair_json.py` |
| Deploy | `test:deploy` | Node | pipeline `build:pages`/`verify:pages`, precache, estrutura dos workflows |
| Firebase | `test:firebase` | Node + **Java 21** | gateway/fila contra o Firestore **Emulator** (preflight recusa com instrução se faltar Java) |
| E2E | `test:e2e` | Playwright | fluxos reais: home, criador (7 passos), ficha, impressão/PDF, import/export, storage, segurança/CSP, rotas lazy |
| Compat | `test:e2e:compat` | Playwright + histórico git (`fetch-depth: 0`) | round-trip com o app BASELINE `e43c5ea` (ver abaixo) |
| PWA | `test:e2e:pwa` | Playwright | instalação transacional do SW, precache por SHA-256, offline, update (o spec de duas abas tem `test.skip` em win32 — 1 skipped é esperado no Windows) |
| Visual | `test:e2e:visual` | imagem Linux `mcr.microsoft.com/playwright:v1.62.0-noble` | screenshots (nunca atualizados em CI) |

## Round-trip de compatibilidade (`test:e2e:compat`)

`scripts/run-baseline-roundtrip.mjs`:

1. materializa a aplicação legada completa do commit `e43c5ea` em
   `.tmp/baseline-e43c5ea/` (`scripts/materialize-baseline.mjs`, via
   `git ls-tree`/`git cat-file` — sem checkout, sem tocar o worktree; RECUSA
   se o diretório já existir);
2. roda `tests/e2e/baseline-roundtrip.spec.js` com
   `playwright.compat.config.js` (dois servidores: app novo em `:4173`,
   baseline em `:4175`; só Chromium desktop);
3. remove apenas a materialização validada pelo marcador
   `.materialized-from`.

O spec cobre: criação real pela UI nova (Clérigo e Bárbaro), override de
`hp.maximum` nas DUAS direções, item customizado com peso textual,
preparar/despreparar magia, moedas, uso de recurso de classe (Fúria),
sobrevivência de `_local_sync.lastMutationId` ao salvamento do baseline, e a
reimportação sem perda (refs canônicas, passthrough, inventário, magias,
recursos).

## Oráculos legados

O código legado removido do runtime continua vivo como **oráculo de teste**:

- `tests/helpers/legacy-db-source.js` (o antigo `db.js` carregador de JSON);
- `tests/helpers/legacy-sheet-source.js` (o monólito da ficha);
- `tests/helpers/legacy-edicoes-source.js` (o antigo `ficha-edicoes.js`);
- fixtures congeladas em `tests/fixtures/**` (gerador único:
  `scripts/generate-baseline-fixtures.mjs`).

## Onde cada coisa roda no CI

`.github/workflows/ci.yml` (reutilizável, chamado também pelo deploy):

- **node-data-deploy**: checks estáticos + `test:node` + extrator + artifact;
- **firestore-emulator**: `test:firebase` com Java 21;
- **browser** (imagem Playwright pinada): `test:e2e`, `test:e2e:compat`
  (checkout com `fetch-depth: 0`, exigido pelo materializador), `test:e2e:pwa`
  e `test:e2e:visual`.

`tests/deploy/workflows.test.js` trava a estrutura desses workflows.

## Verificação manual (única)

O prompt NATIVO de instalação da PWA (banner "Adicionar à tela inicial") não
é automatizável de forma confiável — manifesto, SW, update e offline já são
cobertos por `test:e2e:pwa`. Roteiro manual: servir o artifact (`build:pages`
+ `verify:pages`, ou o Pages publicado) via HTTPS, abrir no Chrome Android ou
desktop, e confirmar que o navegador oferece a instalação e que o app abre
standalone depois de instalado.
