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

Validar sintaxe de um arquivo alterado:

```bash
node --check site/js/pages/sheet.js
```

**Deploy:** GitHub Pages. Um workflow ajusta caminhos no deploy — `db.js` usa
`BASE_PATH = '../dados'` em dev; o workflow troca `'../dados'` por `'./dados'` via `sed`.

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
| `pages/creator.js` | Wizard de criação (7 passos): Classe, Espécie, Antecedente, Atributos, Talentos, Equipamento, Detalhes | ~4,4k linhas |
| `pages/sheet.js` | Ficha do personagem (render + toda a lógica de jogo em uso) | ~16k linhas |
| `store.js` | Persistência em `localStorage` + `criarPersonagemVazio()` (schema do personagem) | médio |
| `db.js` | Carregador de `dados/*.json` com cache em memória (`fetchJSON`) | pequeno |
| `sync.js` | Fila de sincronização em nuvem (retry, status online/offline) | médio |
| `auth.js` | Login e I/O com Firestore | médio |
| `utils.js` | Helpers puros: cálculos (`calcMod`, `calcCA`, `bonusProficiencia`...), `parseMetros`-like, `getDeslocamento`, `getTamanho`, `abrirModal`, `toast`, `escHtml`, markdown | ~550 linhas |
| `levelup*.js` | Fluxo, UI, cards e validações de subida de nível | vários |
| `talentos-effects.js` | Efeitos passivos de talentos (cache aplicado na ficha) | médio |
| `manobras-ui.js` | UI de manobras de combate | pequeno |
| `dados-classes.js` | Constantes: `CLASSES_INFO`, `PERICIAS`, `ATRIBUTOS_*`, `STANDARD_ARRAY`, point-buy | médio |

### Dependências entre módulos (típico)

```
app.js → pages/{home,creator,sheet}.js
pages/* → db.js (dados) , store.js (persistência) , utils.js (helpers) , dados-classes.js (constantes)
store.js → sync.js → auth.js
```

`utils.js` é o lugar certo para **helpers puros reutilizados** por creator.js e sheet.js
(ambos importam de `../utils.js`). Cuidado: creator.js usa a variável `personagem` e
sheet.js usa `char` — helpers puros devem receber dados por parâmetro, não ler globais.

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

## Convenções gerais

- Comentários e UI em **pt-BR** (com acentuação correta).
- Arquivos `sheet.js`/`creator.js` são grandes: prefira `Grep`/`Read` por trecho a ler
  inteiro; siga o padrão local ao editar (não reestruture sem necessidade).
- Compatibilidade com personagens antigos: campos novos devem ser lidos com optional
  chaining (`char?.config?.x`) e escritos com guarda (`if (!char.config) char.config = {}`),
  pois fichas já salvas não terão o campo.
- Não commitar automaticamente (política do repositório).
