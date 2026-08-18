# Arquitetura

Aprofundamento técnico do app. A visão geral, como rodar e as convenções estão
no [README](../README.md).

Tudo em `site/js/` é **ES module** (`import`/`export`). O ponto de entrada é
`app.js`, carregado por `site/index.html` como `<script type="module">`. Não há
build: o navegador carrega os módulos como estão no repositório.

---

## Sumário

- [Módulos de topo](#módulos-de-topo)
- [Ficha (`site/js/sheet/`)](#ficha-sitejssheet)
- [Criador (`site/js/creator/`)](#criador-sitejscreator)
- [Estado compartilhado: live binding](#estado-compartilhado-live-binding)
- [Dependências entre módulos](#dependências-entre-módulos)
- [Router (`app.js`)](#router-appjs)
- [Modelo de dados do personagem](#modelo-de-dados-do-personagem)
- [Carregamento de dados (`db.js`)](#carregamento-de-dados-dbjs)
- [Persistência e sincronização](#persistência-e-sincronização)
- [Padrões de UI](#padrões-de-ui)
- [Cálculos-chave](#cálculos-chave)
- [Regras de conteúdo](#regras-de-conteúdo)
- [Verificar a integridade da extração](#verificar-a-integridade-da-extração)

---

## Módulos de topo

| Arquivo | Responsabilidade | Linhas |
|---|---|---|
| `app.js` | Router SPA (hash), init, registro do Service Worker, botão de reportar bug | 308 |
| `pages/home.js` | Tela inicial: lista de personagens, import/export, login | 354 |
| `pages/creator.js` | Entrada da rota do criador: monta o estado inicial e chama o wizard | 23 |
| `pages/sheet.js` | Entrada da rota da ficha: carrega o personagem, roda as migrações e chama o render | 195 |
| `creator/*.js` | Assistente de criação, um arquivo por passo — ver tabela abaixo | 9 arquivos |
| `sheet/*.js` | Ficha do personagem, um arquivo por assunto — ver tabela abaixo | 18 + 12 de classe |
| `store.js` | Persistência em `localStorage` + `criarPersonagemVazio()` (schema do personagem) | 319 |
| `db.js` | Carregador de `dados/*.json` com cache em memória (`fetchJSON`) | 175 |
| `sync.js` | Fila de sincronização em nuvem (retry, status online/offline) | 193 |
| `auth.js` | Login e I/O com Firestore | 154 |
| `utils.js` | Helpers puros: `calcMod`, `calcCA`, `bonusProficiencia`, `getDeslocamento`, `getTamanho`, `abrirModal`, `toast`, `escHtml`, markdown | 777 |
| `levelup.js` | Tabela de níveis e regras de progressão | 1.759 |
| `levelup-flow.js` | Orquestração do fluxo de subida de nível | 589 |
| `levelup-ui.js` | Telas do fluxo | 1.760 |
| `levelup-cards.js` | Cards de escolha (estilo de luta, talentos, opções de classe) | 769 |
| `levelup-validations.js` | Validações do que pode ser escolhido | 232 |
| `ui-opcoes.js` | Componente compartilhado de escolha em cards | 489 |
| `opcoes-dominio.js` | Origem das opções por domínio (classe, subclasse, talento) | 285 |
| `itens-seletor.js` | Seletor de itens unificado entre criador e ficha | 439 |
| `moedas.js` | Carteira multi-moeda (PC, PP, PE, PO, PL) com conversão automática | 205 |
| `regras-equipamento.js` | Regras de equipamento aplicadas em runtime | 116 |
| `regras-conjuracao-subclasse.js` | Conjuração concedida por subclasse | 125 |
| `regras-cobertura.js` | Mapa de cobertura de regras usado pelos testes de gatilho | 687 |
| `talentos-effects.js` | Efeitos passivos de talentos (cache aplicado na ficha) | 435 |
| `manobras-ui.js` | UI de manobras de combate | 64 |
| `ficha-edicoes.js` / `ficha-edicao-validacoes.js` | Edição de campos da ficha e suas validações | 99 / 23 |
| `versao.js` | `VERSAO_ATUAL` e `NOTAS_VERSAO` — **editados à mão** a cada lançamento | 402 |
| `notas-versao.js` | Modal que exibe as notas de versão | 78 |
| `dados-classes.js` | Constantes: `CLASSES_INFO`, `PERICIAS`, `ATRIBUTOS_*`, `STANDARD_ARRAY`, point-buy | 217 |
| `vendor/pdf-lib.min.js` | Única dependência de terceiros embarcada, usada por `sheet/pdf.js` | — |

## Ficha (`site/js/sheet/`)

Cortado **por assunto**, não por camada: render, eventos e regras de um mesmo
tema ficam no mesmo arquivo. Para mexer em magias, abra `magias.js`; para mexer
no Bárbaro, `classes/barbaro.js`.

| Arquivo | Responsabilidade | Linhas |
|---|---|---|
| `estado.js` | `char`, `containerRef`, `classeData` e os caches, mais `salvar` e os selos de edição | 80 |
| `colapso.js` | Quais seções estão recolhidas, persistido por personagem | 76 |
| `migracoes.js` | Migrações de fichas legadas, rodadas na abertura | 312 |
| `ficha.js` | `renderFichaCompleta`: monta a página chamando os `renderSecao*` | 896 |
| `hp-descanso.js` | PV, dados de vida, descanso curto e longo | 1.230 |
| `habilidades.js` | Habilidades ativas e itens de característica | 4.778 |
| `combate.js` | Deslocamento, ataques, iniciativa, perícias, carga | 276 |
| `maestrias.js` | Modais de maestria em arma (Bárbaro, Guerreiro, Guardião, Paladino, Ladino) | 210 |
| `edicao.js` | Modal de edição da ficha e subida de nível | 487 |
| `talentos.js` | Seção de talentos, Iniciado em Magia, Dádiva Épica | 787 |
| `caracteristicas.js` | Características de classe, subclasse e traços de espécie | 404 |
| `magias.js` | Seção de magias, espaços, concentração, metamagia, magias personalizadas | 2.108 |
| `grimorio.js` | Buscas e trocas de magia, grimório do Mago | 1.527 |
| `condicoes.js` | Condições, defesas, sentidos e proficiências | 511 |
| `inventario.js` | Inventário, arrasta-e-solta, seletores, itens personalizados | 1.028 |
| `detalhes.js` | Detalhes pessoais | 50 |
| `impressao.js` | Versão formatada para impressão | 846 |
| `pdf.js` | Geração do PDF | 435 |
| `classes/*.js` | Progressão e recursos de cada uma das 12 classes | 36 a 1.024 |

`habilidades.js` continua grande de propósito: `renderFeatureItem` e
`setupEventosHabilidades` calculam as flags por classe no topo e as costuram
dentro de um único template literal, então quebrá-las exigiria reescrever a
montagem do HTML. Ver a seção 5.3 da spec da quebra dos monólitos
(`docs/superpowers/specs/2026-08-05-quebra-monolitos-design.md`, local).

## Criador (`site/js/creator/`)

| Arquivo | Responsabilidade | Linhas |
|---|---|---|
| `wizard.js` | `personagem`, `stepAtual`, `dadosCache`, `containerRef`, navegação, validação e finalização | 628 |
| `comum.js` | Tabelas de escolha e helpers de talento e espécie | 674 |
| `passo-classe.js` | Passo 1 | 287 |
| `passo-especie.js` | Passo 2 | 505 |
| `passo-antecedente.js` | Passo 3 | 278 |
| `passo-atributos.js` | Passo 4: rolagem, matriz padrão, compra por pontos, manual | 639 |
| `passo-equipamento.js` | Passo 5 | 809 |
| `passo-magias.js` | Passo 6 | 606 |
| `passo-detalhes.js` | Passo 7 | 404 |

## Estado compartilhado: live binding

`sheet/estado.js` e `creator/wizard.js` exportam o estado mutável como
`export let`. Quem importa enxerga sempre o valor atual — é *live binding* de
módulo ES, não uma cópia.

**Só o módulo dono pode reatribuir.** Gravar num nome importado é erro de
sintaxe: o arquivo inteiro para de carregar. Por isso `renderSheet` e
`renderCreator` usam setters (`definirChar`, `definirStep`, …) em vez de
atribuir direto. `scripts/verificar_extracao.py` checa isso a cada execução.

## Dependências entre módulos

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
— helpers puros devem receber dados por parâmetro, nunca ler globais.

## Router (`app.js`)

Baseado em `window.location.hash`:

| Hash | Página | Função |
|---|---|---|
| `#home` (padrão) | Home | `renderHome(content)` |
| `#criar` | Criação | `renderCreator(content, param)` |
| `#ficha/<id>` | Ficha | `renderSheet(content, param)` — `param` é o id do personagem |

`navegar(rota)` (global `window.navegar`) muda o hash; `processarRota()`
despacha. Cada render recebe o container `#app-content` e reescreve seu
`innerHTML`.

## Modelo de dados do personagem

Criado por `store.js:criarPersonagemVazio()`. Persistido como array em
`localStorage['dnd_personagens']` (backup em `dnd_personagens_backup`, fila de
sync em `dnd_sync_queue`). Campos principais:

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
  recursos: { furia_ativa, ... },       // estado de recursos de classe em uso
  configuracao_criacao: { atributos: { metodo, valoresBase, rolagens } },
  config: { sobrecarga_afeta_deslocamento: false },   // flags de regras opcionais
  criado_em, atualizado_em
}
```

> Atributos guardam o **valor** (ex.: 15). O modificador vem de `calcMod(valor)`
> (`utils.js`).

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

**Peso** vem como string nos JSON: `"0,5 kg"`, `"250 g"`, `"1 kg (saco)"`,
`"—"`, `"Varia"`. Sempre normalizar antes de calcular (vírgula decimal;
gramas → kg).

## Carregamento de dados (`db.js`)

`fetchJSON(caminho)` busca `dados/<caminho>` com cache em memória. Funções
prontas: `getClasse`, `getMagiasClasse`, `getAntecedentes`, `getEspecies`,
`getTalentos`, `getArmas`, `getArmaduras`, `getEquipamentoAventura`,
`getFerramentas`, `getIndiceMagias`, `getMagiasPorCirculo`, `getMagia`,
`buscarMagias`, `getCriaturas`, `getGlossario`. `precarregarDadosCriacao()`
pré-aquece o essencial do assistente de criação.

Nomes de arquivo de classe/magia são normalizados sem acento (`á→a`, `ã→a`, …).

`BASE_PATH = '../dados'` resolve igual em desenvolvimento e em produção porque o
artifact do deploy mantém `site/` e `dados/` como irmãos — ver
[DEPLOY.md](DEPLOY.md).

Formato dos JSON de equipamento: objeto com contagem + array nomeado (ex.:
`armas.json` = `{ total, armas: [...] }`; `equipamento_aventura.json` =
`{ total_itens, itens: [...] }`).

## Persistência e sincronização

- **Local:** `store.js` grava/lê `localStorage`. `salvarPersonagem()` atualiza
  `atualizado_em` e enfileira sync. `importarPersonagens()` valida estrutura
  mínima (`_validarPersonagem`) antes de aceitar.
- **Nuvem:** `sync.js` mantém fila persistente (`dnd_sync_queue`), com retry
  (`MAX_TENTATIVAS = 3`, `RETRY_DELAY_MS = 5000`) e status
  `idle | sincronizando | ok | erro | offline`. Só sobe se logado
  (`auth.js`/Firestore).
- **Offline/PWA:** `sw.js` cacheia o app a partir dos manifestos gerados no
  deploy. `app.js` aplica atualizações do SW automaticamente e recarrega "quando
  seguro" (sem modal aberto).

## Padrões de UI

- **Sem framework.** Render por template string → `element.innerHTML = ...`;
  eventos religados após cada render (`addEventListener` / `element.onclick`).
  Padrão comum: `data-*` no HTML + `querySelectorAll('[data-x]')` numa função
  `setupEventos...()`.
- **Modais:** `abrirModal(titulo, corpoHtml, rodapeHtml)` e
  `window.fecharModal()` (`utils.js`). Suportam pilha; clicar fora fecha.
  `#modal-overlay` é **irmão** de `#app-content` em `site/index.html`, não filho
  — detalhe que importa ao escrever testes.
- **Escolhas em cards:** `ui-opcoes.js` com as opções vindas de
  `opcoes-dominio.js`; é o componente usado pelo criador e pela subida de nível.
- **Feedback:** `toast(mensagem, tipo)` — tipos usados: `'success'`, `'error'`,
  `'info'` (e `''`).
- **Estilo:** CSS variables em `css/app.css` (`--primary`, `--secondary`,
  `--accent`, `--danger`, `--success`, `--text-muted`, `--border-light`,
  `--bg-hover`). A classe `no-print` esconde elementos na impressão da ficha.
- **Escapar entrada do usuário** com `escHtml()` ao interpolar em HTML.
- **Funções globais** (`window.x`) só quando chamadas por `onclick=""` inline;
  caso contrário mantenha no escopo do módulo.

## Cálculos-chave

| Cálculo | Onde |
|---|---|
| Modificador de atributo | `calcMod(valor)` — `utils.js` |
| Bônus de proficiência | `bonusProficiencia(nivel)` — `utils.js` |
| Classe de Armadura | `calcCA(...)` — `utils.js` |
| Deslocamento base da espécie | `getDeslocamento(texto)` — `utils.js` |
| Deslocamento final (classe, talentos, efeitos, exaustão) | `sheet/combate.js` |
| Tamanho | `getTamanho(texto)` — `utils.js` — ou `char.tamanho` |
| Capacidade de carga e sobrecarga | `utils.js` (fórmula) + `sheet/inventario.js` (painel) |
| Espaços de magia por nível | `levelup.js` (tabela) + `sheet/magias.js` |
| Painel e itens de inventário | `renderSecaoInventario()` — `sheet/inventario.js` |
| Item personalizado | `sheet/inventario.js` (ficha) e `creator/passo-equipamento.js` (criação) |

## Regras de conteúdo

As regras completas estão em `Informacoes Separadas/*.md` (Markdown, leitura
humana) — pasta **local, não versionada**. Exemplo: **Capacidade de Carga** =
Força × multiplicador de tamanho, em `Abreviações e Definição de Regras.md`. Os
JSON em `dados/` são a fonte consumida em runtime; os `.md` alimentam o
entendimento das regras ao implementar — e são o oráculo da suíte de regras de
negócio, que por isso não roda inteira sem eles.

## Verificar a integridade da extração

```bash
python scripts/verificar_extracao.py tudo
```

Compara cada declaração contra `scripts/baseline/` e confere presença,
integridade byte a byte, duplicação, símbolos sem import, imports quebrados e
gravação em binding importado. Divergências aceitas ficam em
`scripts/excecoes/`. Desenho completo na spec da quebra dos monólitos
(`docs/superpowers/specs/2026-08-05-quebra-monolitos-design.md`, local).
