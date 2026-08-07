# D&D 5.5 — Criador de Ficha (Fichas de Nimb)

Aplicação web (PWA) para criar e gerenciar fichas de personagem de D&D 5.5 (2024).
SPA estática em JavaScript puro (ES modules), sem build/bundler. Funciona offline
via Service Worker e sincroniza opcionalmente na nuvem (Firestore) quando logado.

Este README documenta a arquitetura do site para acelerar futuras implementações.

---

## Como rodar

```powershell
# servidor local (raiz do repo)
pwsh -File iniciar_servidor.ps1
```

Serve `site/index.html`. Sem etapa de build — editar JS e recarregar a página.

Validar a integridade dos módulos da ficha e do criador:

```bash
python scripts/verificar_extracao.py tudo
```

A **aplicação** não tem dependência de Node — nem para desenvolver, nem para
publicar: não existe etapa de build, e o workflow de deploy usa apenas Python e
`sed`. Node aparece num único lugar, isolado: a suíte de testes em
`testes/e2e/`, cujo `node_modules/` está no `.gitignore`. Ver
**[Testes](#testes)**.

**Precache offline:** o workflow gera **dois** manifestos que o Service Worker
consome no `install` — `dados-precache.json` (varrendo `dados/`) e
`js-precache.json` (varrendo `site/js/**`). Eles são artefatos de deploy e não
são versionados: uma lista fixa no repositório ficaria desatualizada em
relação à árvore, que é exatamente o problema que eles resolvem.

**Deploy:** GitHub Pages. O workflow monta `_dist` com `index.html`, `site/` e
`dados/` como irmãos — a mesma estrutura do repositório — e por isso o
`BASE_PATH = '../dados'` do `db.js` resolve igual em dev e em produção.
**Não há reescrita de caminho**: os únicos `sed` do workflow injetam a versão
do cache no `sw.js` e o número da versão no header. (Este parágrafo já afirmou
o contrário; era impreciso e foi corrigido em 2026-08-05.)

Detalhes do pipeline, como conferir se um deploy foi mesmo ao ar e o que fazer
quando ele falha estão em **[Deploy e manutenção](#deploy-e-manutenção)**.

---

## Estrutura de pastas

```
D&D/
├── index.html               # redireciona/entra no app (raiz)
├── iniciar_servidor.ps1     # servidor local de desenvolvimento
├── _extrair_json.py         # utilitário de extração de dados (gera dados/*.json)
├── site/                    # APP servido
│   ├── index.html           # shell da SPA (header, #app-content, modal-overlay)
│   ├── manifest.json        # PWA
│   ├── sw.js                # Service Worker (cache offline)
│   ├── css/app.css          # estilos globais (usa CSS vars: --primary, --danger, ...)
│   └── js/                  # ver "Módulos JS" abaixo
├── dados/                   # dados de jogo em JSON (fonte de verdade do conteúdo)
│   ├── classes/             # <classe>.json, magias_<classe>.json
│   ├── origens/             # especies.json, antecedentes.json
│   ├── talentos/            # talentos.json
│   ├── equipamento/         # armas, armaduras, equipamento_aventura, ferramentas,
│   │                        #   servicos, montarias_veiculos
│   ├── magias/              # _indice.json, truques.json, circulo_N.json, por_classe/
│   └── apendices/           # criaturas.json, glossario.json
├── Informacoes Separadas/   # regras em Markdown (referência humana, não consumidas em runtime)
│   ├── Equipamento.md
│   └── Abreviações e Definição de Regras.md   # ex.: "Capacidade de Carga" (linha ~228)
├── testes/e2e/              # suíte Playwright de paridade — ver "Testes"
│   ├── *.spec.mjs           # 10 arquivos, 329 testes
│   ├── helpers.mjs          # driver de UI: criador, ficha e subida de nível
│   ├── fixtures.mjs         # personagens semeados via store.criarPersonagemVazio()
│   ├── dados.mjs            # lê dados/ e dados-classes.js (cobertura cresce sozinha)
│   ├── servidor.mjs         # servidor estático (8801 = original, 8802 = refatorado)
│   ├── checar_esm.mjs       # força o parser de módulo ES em todos os JS
│   ├── playwright.config.mjs
│   └── regras/              # specs da suíte de regras (vivem aqui pelo node_modules)
├── testes/regras/           # suíte de regras de negócio — ver "Testes"
│   ├── catalogo/            # 75 talentos + 16 antecedentes curados do livro, com citação
│   ├── unidade/             # 6 motores em node:test, sem dependência
│   ├── lacunas-conhecidas.mjs   # divergências app-vs-livro já encontradas
│   └── GUIA-PROXIMOS-DOMINIOS.md  # ler antes de cobrir um domínio novo
├── scripts/                 # verificação da quebra dos monólitos
│   ├── verificar_extracao.py
│   ├── baseline/            # sheet.js e creator.js pré-quebra, para comparação
│   └── excecoes/            # divergências aceitas e justificadas
└── docs/superpowers/plans/  # planos de implementação
```

---

## Módulos JS (`site/js/`)

Tudo é **ES module** (`import`/`export`). O ponto de entrada é `app.js`, carregado
por `site/index.html` como `<script type="module">`.

| Arquivo | Responsabilidade | Tamanho |
|---|---|---|
| `app.js` | Router SPA (hash), init, registro do Service Worker, FAB reportar bug | pequeno |
| `pages/home.js` | Tela inicial: lista de personagens, import/export, login | médio |
| `pages/creator.js` | Entrada da rota do criador: monta o estado inicial e chama o wizard | 23 linhas |
| `pages/sheet.js` | Entrada da rota da ficha: carrega o personagem, roda as migrações e chama o render | 188 linhas |
| `creator/*.js` | Wizard de criação, um arquivo por passo — ver tabela abaixo | 9 arquivos |
| `sheet/*.js` | Ficha do personagem, um arquivo por assunto — ver tabela abaixo | 30 arquivos |
| `store.js` | Persistência em `localStorage` + `criarPersonagemVazio()` (schema do personagem) | médio |
| `db.js` | Carregador de `dados/*.json` com cache em memória (`fetchJSON`) | pequeno |
| `sync.js` | Fila de sincronização em nuvem (retry, status online/offline) | médio |
| `auth.js` | Login e I/O com Firestore | médio |
| `utils.js` | Helpers puros: cálculos (`calcMod`, `calcCA`, `bonusProficiencia`...), `parseMetros`-like, `getDeslocamento`, `getTamanho`, `abrirModal`, `toast`, `escHtml`, markdown | ~550 linhas |
| `levelup*.js` | Fluxo, UI, cards e validações de subida de nível | vários |
| `talentos-effects.js` | Efeitos passivos de talentos (cache aplicado na ficha) | médio |
| `manobras-ui.js` | UI de manobras de combate | pequeno |
| `dados-classes.js` | Constantes: `CLASSES_INFO`, `PERICIAS`, `ATRIBUTOS_*`, `STANDARD_ARRAY`, point-buy | médio |

### Ficha (`site/js/sheet/`)

Cortado **por assunto**, não por camada: render, eventos e regras de um mesmo
tema ficam no mesmo arquivo. Para mexer em magias, abra `magias.js`; para mexer
no Bárbaro, `classes/barbaro.js`.

| Arquivo | Responsabilidade | Linhas |
|---|---|---|
| `estado.js` | `char`, `containerRef`, `classeData` e os 6 caches, mais `salvar` e os selos de edição | 87 |
| `colapso.js` | Quais seções estão recolhidas, persistido por personagem | 68 |
| `migracoes.js` | As 12 migrações de fichas legadas, rodadas na abertura | 264 |
| `ficha.js` | `renderFichaCompleta`: monta a página chamando os `renderSecao*` | 812 |
| `hp-descanso.js` | PV, dados de vida, descanso curto e longo | 1.137 |
| `habilidades.js` | Habilidades ativas e itens de característica | 4.688 |
| `combate.js` | Deslocamento, ataques, iniciativa, perícias, carga | 268 |
| `maestrias.js` | Modais de maestria em arma (Bárbaro, Guerreiro, Guardião) | 239 |
| `edicao.js` | Modal de edição da ficha e subida de nível | 482 |
| `talentos.js` | Seção de talentos, Iniciado em Magia, Dádiva Épica | 711 |
| `caracteristicas.js` | Características de classe, subclasse e traços de espécie | 400 |
| `magias.js` | Seção de magias, espaços, concentração, metamagia, magias personalizadas | 2.089 |
| `grimorio.js` | Buscas e trocas de magia, grimório do Mago | 1.241 |
| `condicoes.js` | Condições, defesas, sentidos e proficiências | 528 |
| `inventario.js` | Inventário, arrasta-e-solta, seletores, itens personalizados | 1.298 |
| `detalhes.js` | Detalhes pessoais | 46 |
| `impressao.js` | Versão formatada para impressão | 842 |
| `pdf.js` | Geração do PDF | 379 |
| `classes/*.js` | Progressão e recursos de cada uma das 12 classes | 30 a 1.018 |

`habilidades.js` continua grande de propósito: `renderFeatureItem` e
`setupEventosHabilidades` calculam as flags por classe no topo e as costuram
dentro de um único template literal, então quebrá-las exigiria reescrever a
montagem do HTML. Ver a seção 5.3 da spec.

### Criador (`site/js/creator/`)

| Arquivo | Responsabilidade | Linhas |
|---|---|---|
| `wizard.js` | `personagem`, `stepAtual`, `dadosCache`, `containerRef`, navegação, validação e finalização | 615 |
| `comum.js` | Tabelas de escolha e helpers de talento e espécie | 475 |
| `passo-classe.js` | Passo 1 | 280 |
| `passo-especie.js` | Passo 2 | 442 |
| `passo-antecedente.js` | Passo 3 | 200 |
| `passo-atributos.js` | Passo 4: rolagem, array padrão, compra por pontos, manual | 634 |
| `passo-equipamento.js` | Passo 5 | 1.007 |
| `passo-magias.js` | Passo 6 | 608 |
| `passo-detalhes.js` | Passo 7 | 400 |

### Estado compartilhado: live binding

`sheet/estado.js` e `creator/wizard.js` exportam o estado mutável como
`export let`. Quem importa enxerga sempre o valor atual — é *live binding* de
módulo ES, não uma cópia.

**Só o módulo dono pode reatribuir.** Gravar num nome importado é erro de
sintaxe: o arquivo inteiro para de carregar. Por isso `renderSheet` e
`renderCreator` usam setters (`definirChar`, `definirStep`, ...) em vez de
atribuir direto. `scripts/verificar_extracao.py` checa isso a cada execução.

### Dependências entre módulos (típico)

```
app.js  → pages/{home,creator,sheet}.js
pages/sheet.js   → sheet/{estado,migracoes,ficha}.js → sheet/**
pages/creator.js → creator/wizard.js → creator/passo-*.js
sheet/**, creator/** → db.js (dados), store.js (persistência),
                       utils.js (helpers), dados-classes.js (constantes)
store.js → sync.js → auth.js
```

Ciclos de import entre módulos da ficha são esperados e seguros: declarações de
função são *hoisted* e nenhum módulo chama nada durante a avaliação de topo.

`utils.js` é o lugar certo para **helpers puros reutilizados** pelo criador e
pela ficha. Cuidado: o criador usa a variável `personagem` e a ficha usa `char`
— helpers puros devem receber dados por parâmetro, não ler globais.

### Verificar a integridade da extração

```bash
python scripts/verificar_extracao.py tudo
```

Compara cada declaração contra `scripts/baseline/` e confere presença,
integridade byte a byte, duplicação, símbolos sem import, imports quebrados e
gravação em binding importado. Ver
`docs/superpowers/specs/2026-08-05-quebra-monolitos-design.md`.

---

## Router (app.js)

Baseado em `window.location.hash`. Rotas:

| Hash | Página | Função |
|---|---|---|
| `#home` (default) | Home | `renderHome(content)` |
| `#criar` | Wizard | `renderCreator(content, param)` |
| `#ficha/<id>` | Ficha | `renderSheet(content, param)` — `param` é o id do personagem |

`navegar(rota)` (global `window.navegar`) muda o hash; `processarRota()` despacha.
Cada render recebe o container `#app-content` e reescreve seu `innerHTML`.

---

## Modelo de dados do personagem

Criado por `store.js:criarPersonagemVazio()`. Persistido como array em
`localStorage['dnd_personagens']` (backup em `dnd_personagens_backup`, fila de sync em
`dnd_sync_queue`). Campos principais:

```js
{
  id, nome, imagem, nivel, xp, exaustao,
  classe, subclasse, especie, antecedente, alinhamento,
  tracos_escolhidos: [], escolhas_classe: {}, escolhas_antecedente: {},
  atributos:       { forca, destreza, constituicao, inteligencia, sabedoria, carisma }, // VALORES (ex: 15)
  atributos_base:  { ... },
  pv_max, pv_atual, pv_temporario, dados_vida_total, dados_vida_usados,
  pericias_proficientes: [], pericias_expertise: [], salvaguardas_proficientes: [],
  inventario: [ /* ver abaixo */ ],
  po: 0,                       // peças de ouro
  magias_conhecidas: [], magias_preparadas: [], grimorio: [], espacos_magia: {},
  talentos: [], efeitos_magicos: [], usos_habilidades: {},
  idiomas: ['Comum'],
  tamanho: '',                 // 'Pequeno' | 'Médio' | 'Grande' | 'Médio ou Pequeno' | ''
  condicoes: [], resistencias: [], vulnerabilidades: [], imunidades: [],
  recursos: { furia_ativa, ... },   // estado de recursos de classe em uso
  config: { ... },             // configurações opcionais da ficha (flags de regras)
  criado_em, atualizado_em
}
```

> Atributos guardam o **valor** (ex. 15). O modificador vem de `calcMod(valor)` (utils.js).

### Item de inventário

`char.inventario` é um array. Cada item:

```js
{
  nome: 'Espada Longa',
  tipo: 'arma' | 'armadura' | 'escudo' | 'equipamento' | 'customizado' | 'generico',
  quantidade: 1,          // qtd <= 0 => seção "Esgotados"
  equipado: false,
  descricao: '',
  dados: {                // varia por tipo; campos vindos dos JSON de dados
    // arma:        dano, propriedades, maestria, categoria, peso, custo
    // armadura:    ca, categoria, requisito_forca, furtividade, peso, custo
    // equipamento: custo, peso, tipo_uso, descricao
    // customizado: bonus_ca, dano, bonus_ataque   (+ peso opcional em kg, string "X kg")
  }
}
```

**Peso** vem como string nos JSON: `"0,5 kg"`, `"250 g"`, `"1 kg (saco)"`, `"—"`,
`"Varia"`. Sempre normalizar antes de calcular (vírgula decimal; gramas → kg).

---

## Carregamento de dados (db.js)

`fetchJSON(caminho)` busca `dados/<caminho>` com cache em memória. Funções prontas:
`getClasse`, `getMagiasClasse`, `getAntecedentes`, `getEspecies`, `getTalentos`,
`getArmas`, `getArmaduras`, `getEquipamentoAventura`, `getFerramentas`,
`getIndiceMagias`, `getMagiasPorCirculo`, `getMagia`, `buscarMagias`, `getCriaturas`,
`getGlossario`. `precarregarDadosCriacao()` pré-aquece o essencial do wizard.

Nomes de arquivo de classe/magia são normalizados sem acento (`á→a`, `ã→a`, ...).

Formato dos JSON de equipamento: objeto com contagem + array nomeado
(ex. `armas.json` = `{ total, armas: [...] }`; `equipamento_aventura.json` =
`{ total_itens, itens: [...] }`).

---

## Persistência e sincronização

- **Local:** `store.js` grava/lê `localStorage`. `salvarPersonagem()` atualiza
  `atualizado_em` e enfileira sync. `importarPersonagens()` valida estrutura mínima
  (`_validarPersonagem`) antes de aceitar.
- **Nuvem:** `sync.js` mantém fila persistente (`dnd_sync_queue`), com retry
  (`MAX_TENTATIVAS = 3`, `RETRY_DELAY_MS = 5000`) e status
  `idle | sincronizando | ok | erro | offline`. Só sobe se logado (`auth.js`/Firestore).
- **Offline/PWA:** `sw.js` cacheia o app. `app.js` aplica atualizações do SW
  automaticamente e recarrega "quando seguro" (sem modal aberto).

---

## Padrões de UI

- **Sem framework.** Render por template string → `element.innerHTML = ...`; eventos
  religados após cada render (`addEventListener` / `element.onclick`). Padrão comum:
  `data-*` no HTML + `querySelectorAll('[data-x]')` numa função `setupEventos...()`.
- **Modais:** `abrirModal(titulo, corpoHtml, rodapeHtml)` e `window.fecharModal()`
  (utils.js). Suportam pilha; clicar fora fecha.
- **Feedback:** `toast(mensagem, tipo)` — tipos usados: `'success'`, `'error'`,
  `'info'` (e `''`).
- **Estilo:** CSS variables em `css/app.css` (`--primary`, `--secondary`, `--accent`,
  `--danger`, `--success`, `--text-muted`, `--border-light`, `--bg-hover`). Classe
  `no-print` esconde elementos na impressão da ficha.
- **Escapar entrada do usuário** com `escHtml()` ao interpolar em HTML.
- **Funções globais** (`window.x`) só quando chamadas por `onclick=""` inline; caso
  contrário mantenha no escopo do módulo.

---

## Cálculos-chave (onde mexer)

- **Modificador:** `calcMod(valor)` — utils.js.
- **Proficiência:** `bonusProficiencia(nivel)` — utils.js.
- **CA:** `calcCA(...)` — utils.js.
- **Deslocamento:** base da espécie via `getDeslocamento(texto)` (utils.js);
  valor final (classe/talentos/efeitos/exaustão) via `getDeslocamentoFinal(base)`
  em sheet.js (~L2249). Usado no painel da ficha (~L2843) e na impressão (~L15374).
- **Tamanho:** `getTamanho(texto)` (utils.js) ou `char.tamanho`.
- **Painel de inventário:** `renderSecaoInventario()` (sheet.js ~L14167),
  itens por `renderSheetInvItem()` (~L14240), eventos em
  `setupEventosInventarioSheet()` (~L14396).
- **Item custom:** modal na ficha em `btn-add-inv-custom` (sheet.js ~L14500);
  no wizard em `mostrarFormCustomItem()` (creator.js ~L3355).
- **Wizard de tamanho/capacidade:** etapa "Detalhes" do creator.js (~L4091),
  cards `[data-tamanho-card]`.

---

## Regras de conteúdo (referência)

As regras completas estão em `Informacoes Separadas/*.md` (Markdown, leitura humana).
Ex.: **Capacidade de Carga** = Força × multiplicador de tamanho
(`Abreviações e Definição de Regras.md`, ~linha 228). Os JSON em `dados/` são a fonte
consumida em runtime; os `.md` alimentam o entendimento das regras ao implementar.

---

## Testes

Três verificações independentes, que respondem perguntas diferentes:

| Verificação | Comando | Pergunta que responde |
|---|---|---|
| Extração dos monólitos | `python scripts/verificar_extracao.py tudo` | "os módulos ainda batem com o baseline?" — estático, sem navegador |
| Paridade E2E | `cd testes/e2e && npm test` | "a tela é a mesma do repositório original?" — Playwright, 329 testes |
| Regras de negócio | `cd testes/e2e && npm run test:regras` | "o app obedece ao **livro**?" — 514 de unidade (470 passam, 44 skip) + 111 de navegador |

As duas últimas são independentes de propósito: um erro de regra presente
**nos dois** repositórios passa na paridade para sempre, porque paridade só
compara os dois lados entre si. Quem pega esse caso é a suíte de regras.

### Suíte de paridade (`testes/e2e/`)

A documentação completa vive em **[`testes/e2e/README.md`](testes/e2e/README.md)**
— cobertura arquivo por arquivo, escopo e o histórico de por que a suíte existe.
Não repito aqui; o essencial para se localizar:

- Compara **este** repositório com o original `D-D_2024` lado a lado, executando
  as mesmas ações nos dois e exigindo resultado idêntico. Quase nenhuma asserção
  escreve o valor esperado à mão: a pergunta não é "a tela está correta", é "a
  tela é a mesma".
- Sobe os dois servidores estáticos sozinha. O original é procurado em
  `../../../D-D_2024`; `REPO_ORIGINAL=/caminho` aponta para outro lugar.
- Dois projetos Playwright: `paridade`, que **bloqueia** o Service Worker para o
  cache não mascarar regressão, e `offline`, o único que o permite — serial,
  porque ali o SW é o objeto do teste.
- **329 testes em 10 arquivos**, ~6 min com 4 workers. Um único `test.skip`
  (`inventario.spec.mjs`, arrastar item por toque), com o motivo escrito no
  próprio arquivo.

```bash
cd testes/e2e
npm run instalar                         # uma vez: deps + Chromium
npm test                                 # a suíte inteira
npx playwright test --project=offline    # só Service Worker
npx playwright test ficha.spec.mjs       # só um arquivo
npx playwright test --list               # o que existe, sem executar
npm run test:esm ../..                   # parse ESM de todos os módulos
```

### Suíte de regras de negócio (`testes/regras/`)

Confronta o app com o **livro** (`Informacoes Separadas/`) em vez de com o
repositório original. Documentação completa em
**[`testes/regras/README.md`](testes/regras/README.md)**; quem for cobrir um
domínio novo deve ler antes o
**[guia de próximos domínios](testes/regras/GUIA-PROXIMOS-DOMINIOS.md)**, que
registra os erros da primeira rodada e traz um checklist de pré-voo.

- Fonte da verdade: `catalogo/talentos.mjs` (75 talentos) e
  `catalogo/antecedentes.mjs` (16 antecedentes), curados à mão do livro, cada
  entrada citando sua seção. Um teste garante cobertura de 100% do que existe
  em `dados/` — sem amostragem.
- Camada de unidade em `node:test` (sem dependência nova) e camada de navegador
  em `testes/e2e/regras/`, que reaproveita o `node_modules` da paridade.
- `lacunas-conhecidas.mjs` é o produto: as divergências app-vs-livro já
  encontradas. Uma falha documentada mantém a suíte verde; corrigido o app, o
  teste passa a cobrar a remoção da entrada.

```bash
cd testes/e2e
npm run test:regras                      # unidade + navegador
npm run test:regras:unidade              # só node:test
npm run test:regras:e2e                  # só Playwright
```

### Manutenção da suíte

- **Conteúdo novo entra na cobertura sozinho.** `classes.spec.mjs` e
  `especies.spec.mjs` leem as listas de `dados/`, de `dados-classes.js` e a
  tabela de níveis de `levelup.js` através de `dados.mjs`. Classe, espécie,
  antecedente ou nível novo passa a ser testado no dia em que entra no jogo —
  não há lista de casos para lembrar de editar.
- **Não há amostragem**: as 12 classes em todos os 20 níveis, as 11 espécies e
  os 16 antecedentes. Trocar isso por um "subconjunto representativo" é
  exatamente o que a suíte existe para impedir.
- **Os personagens vêm da fábrica do próprio app** (`store.criarPersonagemVazio()`),
  semeados no `localStorage` — percorrer o wizard 240 vezes seria inviável. Se o
  schema do personagem mudar, o ajuste é em `fixtures.mjs`, não nos specs. Uma
  fixture errada já bloqueou dois testes e parecia bug do produto.
- **O driver de UI está concentrado em `helpers.mjs`** (~33 KB, o maior arquivo
  da suíte). Mudança de seletor ou de fluxo do wizard se conserta ali, num lugar
  só, e não espalhada pelos specs.
- **`test.skip` sem motivo escrito é omissão silenciosa.** A regra do
  repositório é que todo skip carregue a justificativa no próprio arquivo; as
  pendências ficam em `PERGUNTAS-PARA-REVISAO.txt`.
- **Duas divergências do original são intencionais** e estão registradas no
  README da suíte: `site/sw.js` (passou a consumir `js-precache.json`) e
  `.github/workflows/deploy.yml` (passou a gerá-lo). Todo o resto — `dados/`,
  `css/`, `img/`, `index.html`, `manifest.json` e os módulos fora de escopo —
  tem de continuar byte a byte idêntico.
- **`checar_esm.mjs` existe por um motivo específico:** `node --check` num
  arquivo `.js` usa detecção de tipo e não força o parser de módulo, deixando
  passar erro de sintaxe que quebra o site inteiro. Copiar para `.mjs` força o
  parser. Já pegou um comentário de bloco partido entre `impressao.js` e
  `pdf.js` que nenhuma checagem estática viu.

---

## Deploy e manutenção

Publicação em GitHub Pages por `.github/workflows/deploy.yml`, com a fonte do
Pages configurada como **GitHub Actions** (não "deploy from a branch"). Sem Node
e sem bundler: o workflow usa apenas Python e `sed`.

### Gatilhos e permissões

| Item | Valor |
|---|---|
| Gatilhos | `push` em `main` e `workflow_dispatch` (execução manual) |
| Concorrência | grupo `pages`, `cancel-in-progress: false` — deploys enfileiram, não se cancelam |
| Permissões | `contents: read`, `pages: write`, `id-token: write` |
| Ambiente | `github-pages`, com a URL pública exposta como saída do job |

### Os 5 passos do workflow

| # | Passo | O que faz |
|---|---|---|
| 1 | `actions/checkout@v4` | Clona o repositório |
| 2 | `Prepare site` | Monta `_dist/`, gera os dois manifestos de precache e injeta a versão |
| 3 | `actions/configure-pages@v5` | Lê a configuração do Pages do repositório |
| 4 | `actions/upload-pages-artifact@v3` | Empacota `_dist/` em `artifact.tar` e envia |
| 5 | `actions/deploy-pages@v4` | Cria o deployment e espera o backend do Pages publicar |

O passo 2 é o único com lógica própria:

1. `_dist/` recebe `index.html`, `site/` e `dados/` como irmãos — **a mesma
   estrutura do repositório**, que é o motivo de `BASE_PATH = '../dados'`
   funcionar igual em dev e em produção.
2. Um script Python varre `_dist/dados/**` e grava `site/dados-precache.json`
   com URLs `../dados/….json`.
3. Outro varre `_dist/site/js/**` e grava `site/js-precache.json` com URLs
   `./js/….js`, imprimindo a contagem no log (hoje: `61 modulos`).
4. Dois `sed` trocam `CACHE_VERSION = 0` no `sw.js` e `v0` no header do
   `index.html` pelo `github.run_number`.

### Versionamento automático (e como ele serve de sonda)

No repositório os marcadores ficam **sempre** em zero — `const CACHE_VERSION = 0; // AUTO`
e `v0</span><!-- VERSION_AUTO -->`. Só o artifact publicado carrega o número do
run. Isso tem uma consequência prática muito útil: **o número em produção diz
exatamente qual run está no ar**, sem depender do log do Actions.

Dois detalhes que já confundiram o diagnóstico:

- **Re-run preserva o `run_number`.** Re-executar o run #19 publica `v19` de
  novo, não `v20`. Se o número não avançou, não significa que o deploy falhou.
- **Os manifestos de precache não são versionados.** Se `js-precache.json`
  responde em produção, é prova de que o conteúdo veio do artifact do workflow
  — não há como ele existir servindo direto de uma branch.

### Conferir se um deploy realmente foi ao ar

Não confie só no status do Actions; pergunte à produção. Roda em qualquer
PowerShell:

```powershell
foreach ($u in @("site/index.html","site/sw.js","site/js-precache.json")) {
  $r = Invoke-WebRequest -Uri "https://zaitbr-bit.github.io/DeD_2024/$u`?cb=$(Get-Random)" -UseBasicParsing
  if     ($u -like "*index.html") { "index.html -> " + [regex]::Match($r.Content,'v\d+</span><!-- VERSION_AUTO -->').Value }
  elseif ($u -like "*sw.js")      { "sw.js      -> " + [regex]::Match($r.Content,'const CACHE_VERSION = \d+').Value }
  else                            { "js-precache-> " + ($r.Content | ConvertFrom-Json).Count + " modulos" }
}
```

O `?cb=` é obrigatório: sem ele o CDN do Pages pode devolver a versão anterior.
Os três valores têm de bater entre si — mesmo número de run e a contagem de
módulos igual à impressa no log do passo 2.

Para acompanhar um deploy lento sem ficar recarregando a página, um poll simples
(Git Bash) que sai sozinho quando a versão mudar:

```bash
ATUAL=19   # versão que já está no ar
for i in $(seq 1 40); do
  v=$(curl -s "https://zaitbr-bit.github.io/DeD_2024/site/sw.js?cb=$i" \
      | grep -o 'const CACHE_VERSION = [0-9]*' | grep -o '[0-9]*$')
  [ -n "$v" ] && [ "$v" != "$ATUAL" ] && { echo "publicado: v$v"; break; }
  echo "ainda v$v"; sleep 20
done
```

### Manutenção do precache offline

Os manifestos são **gerados por varredura**, então o caso comum não pede
manutenção nenhuma:

- Adicionar/remover JSON em `dados/` ou módulo em `site/js/**` → nada a fazer,
  entram sozinhos no próximo deploy.
- **Mover** `site/js/` ou `dados/` de lugar → aí sim, ajustar os `os.walk` e os
  `.replace(...)` no passo `Prepare site`, porque as URLs gravadas são relativas
  ao escopo do Service Worker (`/site/`).
- Mudar o texto `const CACHE_VERSION = 0; // AUTO` ou o marcador
  `v0</span><!-- VERSION_AUTO -->` → os `sed` deixam de casar **em silêncio**.
  Não há erro no log; o site publica com `v0` e o cache do SW para de invalidar.
  Se produção mostrar `v0`, é isso.

### Diagnóstico de falhas de deploy

O log do run diz em qual fronteira quebrou. As mensagens do passo 5 são as que
importam:

| Sintoma no log | Significado | Ação |
|---|---|---|
| `Current status: deployment_queued` repetido até `Timeout reached, aborting!` | O deployment foi criado e aceito, mas o backend do Pages nunca pegou o job | Ambiente do GitHub. Re-executar o run |
| `deployment_in_progress` por vários minutos | O backend pegou o job, só está lento | Esperar; conferir produção pelo bloco acima |
| `Timeout reached, aborting!` seguido de `Canceled deployment with ID …` | A action desistiu **e cancelou** o deployment | Re-executar; ver "aumentar o timeout" abaixo |
| Falha em `configure-pages` | Pages desabilitado ou fonte fora de "GitHub Actions" | Settings → Pages → Source = GitHub Actions |
| Deploy verde mas produção com `v0` | Os `sed` não casaram | Ver "Manutenção do precache offline" |
| 404 em `dados/*.json` em produção | Arquivo fora do artifact | Conferir a listagem `Archive artifact` no log |

Vale saber o que **não** é gargalo aqui: o artifact tem ~130 arquivos e ~1 MB, e
os passos 1 a 4 levam poucos segundos no total. Quando um deploy demora, o tempo
está no passo 5, esperando o backend do Pages — não no build.

### Incidente de 2026-08-06 (registro)

Deploy do commit `fc27f30` falhou com `Timeout reached, aborting!` após 10 min
inteiros em `deployment_queued`, e o deployment foi cancelado.

Investigação: passos 1 a 4 todos verdes (artifact de 1.029.387 bytes enviado, 61
módulos no precache) e o deployment chegou a ser criado e aceito pela API. A
configuração foi descartada como causa por evidência de produção — o site servia
`v18`/`CACHE_VERSION = 18` e um `js-precache.json` que não existe no repositório,
provando que a fonte do Pages já era GitHub Actions e que o run anterior havia
publicado pelo mesmo pipeline. Também descartados limite de builds por hora (o
push anterior fora 88 min antes) e artifact problemático.

Re-executando, o deployment passou a `deployment_in_progress` e publicou em
torno dos 11 min do início do job. **Causa: ambiente do GitHub** — fila e
publicação do backend do Pages, fora do repositório. Nenhuma alteração de código
foi necessária, e nenhuma foi mantida.

Se repetir: re-executar o run é a primeira e normalmente única ação.

### Se o timeout precisar de folga

O `actions/deploy-pages@v4` espera **600000 ms (10 min)** por padrão, contados da
criação do deployment até a publicação. Hoje o workflow **não sobrescreve** esse
valor. Se as filas do Pages voltarem a passar de 10 min com frequência, dá para
alargar a janela:

```yaml
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
        with:
          timeout: 1200000   # 20 min em vez dos 10 min padrão
```

Isso não acelera nada — só evita abortar um deploy que ainda ia completar. Como
a causa é externa, é o único ajuste possível deste lado, e o custo é queimar mais
minutos de Actions quando a fila estiver de fato travada.

---

## Convenções gerais

- Comentários e UI em **pt-BR** (com acentuação correta).
- Arquivos `sheet.js`/`creator.js` são grandes: prefira `Grep`/`Read` por trecho a ler
  inteiro; siga o padrão local ao editar (não reestruture sem necessidade).
- Compatibilidade com personagens antigos: campos novos devem ser lidos com optional
  chaining (`char?.config?.x`) e escritos com guarda (`if (!char.config) char.config = {}`),
  pois fichas já salvas não terão o campo.
- Não commitar automaticamente (política do repositório).
