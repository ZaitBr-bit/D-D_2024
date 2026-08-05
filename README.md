# D&D 5.5 — Criador de Ficha (Fichas de Nimb)

Aplicação web (PWA) para criar e gerenciar fichas de personagem de D&D 5.5
(2024). SPA estática em JavaScript puro (ES modules), **sem build/bundler**.
Funciona offline via Service Worker e sincroniza opcionalmente na nuvem
(Firestore) quando logado.

Este README descreve a arquitetura FINAL após a refatoração
(plano em `docs/superpowers/plans/2026-07-26-refatoracao-arquitetura-regras.md`).
Documentação detalhada por tema em `docs/`:

- `docs/architecture/content-packages.md` — pacotes de conteúdo, schemas e o contrato para fontes futuras.
- `docs/architecture/character-storage-v2.md` — registro v2, migração, backup e modo somente leitura.
- `docs/testing.md` — toda a matriz de testes e checks (o que roda onde).
- `docs/deploy-pwa.md` — pipeline de deploy no GitHub Pages e o Service Worker transacional.

---

## Como rodar

Runtime local **não precisa de Node** — qualquer servidor estático na raiz do
repositório serve:

```powershell
# fallback sem Node (python -m http.server) — abre navegador só com -AbrirNavegador
pwsh -File iniciar_servidor.ps1

# ou, com Node instalado, o mesmo servidor usado pelos testes:
pwsh -File iniciar_servidor.ps1 -UsarNode
# (equivalente a: npm run serve:test  ->  http://127.0.0.1:4173/site/)
```

Node (`>= 22.17`, ver `.nvmrc`) é obrigatório apenas para **testes, validação e
geração do artifact de deploy**:

```bash
npm ci                       # dependências de desenvolvimento
```

### Comandos principais

| Comando | O que faz |
|---|---|
| `npm run check:syntax` | `node --check` em todo JS (site, scripts, tests, configs Playwright) |
| `npm run check:architecture` | direção de camadas, domínio puro, capacidades oficiais restritas |
| `npm run check:entrypoints` | `pages/creator.js`/`pages/sheet.js` continuam composition roots finos |
| `npm run check:inline-handlers` | nenhum handler inline; globais `window.*` só da allowlist |
| `npm run check:validators` / `generate:validators` | validadores Ajv standalone gerados dos schemas |
| `npm run validate:data` | valida `dados/pacotes/**` contra `dados/schemas/v1/**` |
| `npm run test:node` | unit + contract + integration + deploy (Node puro) |
| `npm run test:extractor` | contrato do extrator Python (`_extrair_json.py`) |
| `npm run test:firebase` | testes contra o Firestore **Emulator** (requer Java 21) |
| `npm run test:e2e` | Playwright funcional (Chromium/Firefox/WebKit) |
| `npm run test:e2e:compat` | round-trip com o app BASELINE `e43c5ea` materializado |
| `npm run test:e2e:pwa` | instalação transacional do Service Worker |
| `npm run test:e2e:visual` | screenshots — só na imagem Linux pinada do Playwright |
| `npm run build:pages -- --out _dist --version vX` | artifact determinístico do GitHub Pages |
| `npm run verify:pages -- --dir _dist` | verificação independente do artifact |
| `npm run verify` | tudo acima que é funcional, em sequência (sem o gate visual) |

---

## Arquitetura (`site/js/`)

Camadas com direção de dependência verificada por `check:architecture`
(`core -> content -> domain -> infra/features/ui -> pages`):

```
site/js/
├── app.js               # shell: boot, hash router (rotas lazy via import())
├── app-context.js       # COMPOSITION ROOT: catálogo, repositório, sync, capacidades oficiais
├── core/                # Result/AppError, ContentId, semver, hash-router
├── content/             # ContentRegistry, validação (Ajv gerado), capacidades de fonte
├── domain/              # REGRAS PURAS: personagem canônico v2, comandos, efeitos,
│   │                    #   progressão, magias, inventário, handlers dnd2024
│   └── (proibido: DOM, rede, storage, Firebase — verificado estaticamente)
├── infra/               # portas concretas: codec v2, repositório localStorage,
│   │                    #   projeção legada, sync/Firestore, imagem, RNG, PWA
├── features/            # criador (7 passos + sessão) e ficha (seções + sessão)
├── ui/                  # primitivas seguras: escapeHtml, delegação, modal, toast
└── pages/               # ENTRYPOINTS FINOS: creator.js (renderCreator),
                         #   sheet.js (renderSheet), home.js
```

- **Entradas públicas**: `renderCreator(container)` e
  `renderSheet(container, charId)`, chamadas pelo router
  (`core/hash-router.js`) e devolvendo `Result<disposer, AppError>`.
- **Fachadas de compatibilidade** mantidas finas e cobertas por teste:
  `db.js` (projeção do catálogo no shape legado), `moedas.js` (delega a
  `domain/inventory/wallet.js`), `dados-classes.js` (constantes usadas por
  home/utils). Nenhuma tem regra própria.
- Conteúdo oficial é resolvido pelo `ContentRegistry` a partir de
  **`dados/pacotes/dnd2024`** — a única fonte mecânica de runtime. Os JSON
  legados (`dados/classes/**` etc.) permanecem no repositório apenas como
  oráculo de teste/referência histórica; um teste E2E prova que o app nunca
  os requisita.

## Dados e schemas

```
dados/
├── pacotes/dnd2024/     # PACOTE OFICIAL versionado (manifest, index, entidades)
├── schemas/v1/          # JSON Schemas de todas as entidades + registro v2
├── classes/, magias/, equipamento/, ...   # JSON legados (só oráculo de teste)
```

Ver `docs/architecture/content-packages.md` para o contrato completo
(manifesto, `entitySchemaVersions`, índice determinístico, migrações de
referência) e `docs/architecture/character-storage-v2.md` para o registro de
personagem (v2 = registro plano legado + canais reservados `_schema`,
`content_refs`, `overrides`, `pv_rolagens`, `_local_sync`), incluindo
backup/restauração e o modo **somente leitura/exportável** para schemas
futuros.

---

## Testes

Matriz completa em `docs/testing.md`. Resumo do que cada gate cobre:

- **Node** (`test:node`): domínio, codec, contratos de paridade com o legado
  (oráculos em `tests/helpers/legacy-*.js` + fixtures congeladas do commit
  `e43c5ea`), estrutura dos workflows.
- **Firebase** (`test:firebase`): Firestore Emulator (Java 21; o preflight
  recusa com instrução clara quando falta).
- **E2E** (`test:e2e`): fluxo real no navegador — home, criador, ficha,
  impressão/PDF, import/export, storage, segurança/CSP, rotas lazy.
- **Compat** (`test:e2e:compat`): materializa o app LEGADO do commit
  `e43c5ea` (via `git show`, sem tocar o worktree) e faz o round-trip
  criar → exportar → editar no baseline → reimportar, sem perda.
- **PWA** (`test:e2e:pwa`): instalação transacional do SW, offline e update.
- **Visual** (`test:e2e:visual`): screenshots, exclusivamente na imagem
  `mcr.microsoft.com/playwright:v1.62.0-noble` (Linux) — nunca no host.

---

## Deploy (GitHub Pages)

Pipeline determinístico, sem `sed`/cópias manuais (detalhes em
`docs/deploy-pwa.md`):

1. `npm run build:pages -- --out _dist --version <versão>` gera o artifact
   (marcador `__DEPLOY_VERSION__` substituído, manifesto de precache com
   SHA-256 real).
2. `npm run verify:pages -- --dir _dist` verifica o artifact de forma
   independente.
3. `.github/workflows/deploy.yml` publica SOMENTE se o workflow reutilizável
   `ci.yml` (jobs Node/dados, Firestore Emulator e browser) passar.

O Service Worker (`site/sw.js`) instala de forma transacional: cache-first
estrito pelo manifesto de precache + cache separado sob demanda; a versão só
vira depois de todo o precache validado.

---

## Convenções gerais

- Comentários e UI em **pt-BR**; funções novas sempre com comentário do que fazem.
- Sem framework: markup nasce em `features/**` com as primitivas de `ui/**`
  (`escapeHtml`, delegação por `data-action`); **nenhum handler inline** e
  nenhum global `window.*` novo (gate `check:inline-handlers`).
- CSP sem `'unsafe-inline'` em `script-src` (mantido apenas em `style-src`).
- Compatibilidade com fichas antigas é garantida pelo codec v2 + testes de
  round-trip; nunca descarte campo desconhecido (passthrough).
- Não commitar automaticamente (política do repositório).
