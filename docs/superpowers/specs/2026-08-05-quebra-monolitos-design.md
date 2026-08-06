# Quebra mecânica dos monólitos `sheet.js` e `creator.js`

**Data:** 2026-08-05
**Status:** especificação aprovada para implementação
**Aplicação:** Fichas de Nimb — D&D 5.5 (2024)
**Repositório de trabalho:** `DeD_2024` (publica em `zaitbr-bit.github.io/DeD_2024/site/`)
**Referência viva:** `D-D_2024` (publica em `zaitbr-bit.github.io/D-D_2024/site/`)

## 1. Objetivo

Dividir `site/js/pages/sheet.js` (17.955 linhas) e `site/js/pages/creator.js` (4.627 linhas)
em arquivos menores, agrupados por assunto, **sem alterar uma única linha de
comportamento**.

O que se ganha: para mexer em magias, abre-se `sheet/magias.js`; para mexer no
Bárbaro, `sheet/classes/barbaro.js`. Arquivos que cabem na cabeça de quem lê e
no contexto de um assistente.

O que **não** se ganha, deliberadamente: nenhuma arquitetura nova, nenhum
formato de dados novo, nenhuma dependência nova.

## 2. Por que esta spec existe

Uma refatoração anterior (`docs/historico/tentativa-2026-07/`) foi especificada,
planejada e implementada por completo. O resultado publicado apresentava:

- **layout quebrado** — o `app.css` continuou byte a byte idêntico, mas o novo
  criador passou a emitir `wizard-nav` em vez de `wizard-nav-fixed` +
  `wizard-nav-inner`, e `data-creator-content` em vez de `wizard-content-area`.
  Classes sem estilo: a barra de navegação perdeu `position:fixed` e caiu no
  meio do conteúdo. Os rótulos dos botões também mudaram sem necessidade
  (`← Anterior` → `Voltar`, `Próximo →` → `Continuar`);
- **abertura lenta** — `pages/creator.js` chamava `initializeContent()` antes de
  desenhar qualquer coisa, baixando `index.json` (244 KB) e mais 49 arquivos
  (4,6 MB no total) em laço `for...await` sequencial, com `cache: 'no-store'`
  em todo `fetch`, e validando 1.511 entidades contra JSON Schema no navegador.
  O original carregava sob demanda: `dados/classes/mago.json` só ao escolher Mago;
- **regras erradas** — os JSON oficiais foram convertidos por script para
  "campos mecânicos estruturados" e o app passou a ler dessa cópia regerada,
  enquanto `dados/classes/`, `dados/magias/` e os demais continuavam no
  repositório, intactos e ignorados. Cada erro de conversão virou regra errada;
- **manutenção pior, não melhor** — 22 arquivos e 30.534 linhas viraram 164
  arquivos e 52.930 linhas (+73%), com o corte feito **por camada**
  (`domain/`, `features/`, `ui/`, `infra/`), de modo que uma mudança em magias
  passou a tocar vários arquivos em pastas diferentes. Os arquivos "extraídos"
  seguiam grandes: `legacy-db-projection.js` 1.494, `sync-queue.js` 1.342,
  `class-handler.js` 1.311;
- **validação inexecutável** — 20+ scripts npm, três configs de Playwright,
  validadores de JSON Schema e emulador do Firebase, num ambiente onde o
  Node.js não está instalado e `node_modules` nunca foi instalado.

O plano anterior foi executado com fidelidade. O problema é que **o plano era o
errado**: pediu uma reescrita arquitetural completa quando o pedido real era
quebrar dois arquivos grandes em arquivos menores.

O Marco 0 desta spec já foi executado (commit `a85c600`): o conteúdo do
`DeD_2024` voltou a ser byte a byte idêntico ao do `D-D_2024`, com os
documentos da tentativa anterior preservados em `docs/historico/`.

## 3. Regra de ouro

**Nada além da posição do código pode mudar.**

Proibido, sem exceção:

- alterar qualquer byte de `dados/`, `site/css/`, `site/index.html`,
  `site/sw.js`, `site/manifest.json`, `site/img/`, `index.html`, ou de
  qualquer um dos 20 módulos JS fora do escopo;
- reescrever o corpo de uma função — o corpo extraído é byte a byte igual ao original;
- alterar nome de classe CSS, estrutura de markup, texto de botão ou de rótulo;
- renomear função, parâmetro ou variável;
- corrigir bug, remover código morto, melhorar nome ou "aproveitar a viagem";
- adicionar dependência, etapa de build ou ferramenta que exija Node.js.

Se um passo produz qualquer diferença visível entre as duas URLs, **o passo
está errado** — não o original.

Bugs, dúvidas e decisões tomadas sem consulta durante a execução são anotados
em `PERGUNTAS-PARA-REVISAO.txt`, na raiz do repositório, com data, contexto e a
opção escolhida. Bugs do original **não são corrigidos aqui** — viram trabalho
próprio depois.

### 3.1 A única exceção, declarada

Nove variáveis de módulo precisam virar setters porque módulos ES não permitem
atribuir a um binding importado. Todas são atribuídas **uma única vez cada**,
todas dentro de `renderSheet` (linhas 2687-2710 do original):

```
2687  containerRef          = container;                     → definirContainer(...)
2688  char                  = getPersonagem(charId);         → definirChar(...)
2695  passivosTalentosCache = resolverPassivosTalentos(char);→ definirPassivosTalentos(...)
2702  classeData            = await getClasse(char.classe);  → definirClasseData(...)
2704  indiceMagiasCache     = indiceData?.magias || [];      → definirIndiceMagias(...)
2705  talentosCache         = await getTalentos();           → definirTalentos(...)
2706  especiesCache         = await getEspecies();           → definirEspecies(...)
2709  magiasDominioCache    = await obterTodasMagiasDominio(...)→ definirMagiasDominio(...)
2710  magiasSempreCache     = await obterTodasMagiasSempre(...) → definirMagiasSempre(...)
```

São **9 linhas**, todas no coordenador, todas mecânicas. Nenhuma outra linha de
corpo de função é editada em toda a refatoração.

## 4. Arquitetura: estado compartilhado por live binding

Módulos ES têm *live binding*: quem importa um `let` exportado enxerga sempre o
valor atual, sem precisar reler nada. Como `char` é reatribuída em **um único
lugar** e lida em **2.003**, isso permite mover funções para outros arquivos
sem tocar em nenhuma das 2.003 referências.

```js
// site/js/sheet/estado.js
export let char = null;
export function definirChar(c) { char = c; }

export let classeData = null;
export function definirClasseData(d) { classeData = d; }
// ... e os 6 caches, cada um com seu setter

// site/js/sheet/magias.js
import { char, classeData, salvar } from './estado.js';

function renderSecaoMagias() {
  // corpo IDÊNTICO ao original, incluindo todo `char.x` e `classeData.y`
}
```

**Regra de propriedade:** *toda variável reatribuída mora no módulo que a
reatribui.* Só `char`, `containerRef`, `classeData` e os 6 caches são
cross-cutting e vão para `estado.js` — `containerRef` porque `ficha.js` o lê em
`salvarEstadoDetails`, `restaurarEstadoDetails` e `renderFichaCompleta`. As
demais ficam onde são escritas:

| Variável | Mora em | Porque |
|---|---|---|
| `_cacheEquipSheet` | `inventario.js` | atribuída só em 16273-16280 |
| `_printOverlayAtivo` | `impressao.js` | atribuída só em 17513-17562 |
| `_pdfLibPromise` | `pdf.js` | atribuída só em 17584-17588 |
| `_detalhesColapsada`, `_truquesColapsados`, `_secoesInvColapsadas` | `colapso.js` | atribuídas em 58-68, 3941 e 3954 |
| `_syncSubscribed` | `pages/sheet.js` | atribuída só em 2799, dentro de `renderSheet` |

`colapso.js` leva junto as duas funções que reatribuem seu estado
(`setupEventosDetalhesColapso`, `setupEventosTruquesColapso`), justamente para
que nenhuma delas precise virar chamada de setter.

**Ciclos de import são esperados e seguros.** `magias.js` importa
`renderFichaCompleta` de `ficha.js`, que importa `renderSecaoMagias` de
`magias.js`. Declarações de função são hoisted e os bindings são vivos; como
nenhum módulo *chama* nada durante a avaliação de topo, o ciclo se resolve
sozinho. Não haverá camada de indireção para evitá-los — isso mudaria call sites.

## 5. Estrutura final

### 5.1 `sheet.js` — 17.955 → coordenador + 30 módulos

```
site/js/pages/sheet.js          ~250   renderSheet, montagem, indicador de sync
site/js/sheet/
  estado.js             ~120   char, classeData, 6 caches, salvar, selos de edição
  colapso.js             ~90   estado e eventos de colapso das seções
  migracoes.js          ~280   as 12 funções migrar* + salvar/restaurar details
  ficha.js              ~780   renderFichaCompleta e eventos de topo
  hp-descanso.js      ~1.120   number picker, HP, descansos, sincronizações de PV
  habilidades.js      ~4.640   setupEventosHabilidades + renderFeatureItem
  combate.js            ~350   deslocamento, carga, ataques, iniciativa, perícias
  maestrias.js          ~240   modais de maestria em arma
  edicao.js             ~470   modal de edição da ficha, level up, feature flag
  talentos.js           ~605   seção de talentos e seus modais
  caracteristicas.js    ~405   características, subclasse, traços de espécie
  magias.js           ~2.270   magias personalizadas, seção de magias, metamagia,
                               concentração, espaços de magia
  grimorio.js         ~1.240   buscas, magia custom, trocas, preenchimento de slot
  condicoes.js          ~520   proficiências, condições, defesas, sentidos
  inventario.js       ~1.290   inventário, drag-drop, seletores, itens custom
  detalhes.js            ~50   seção de detalhes pessoais
  impressao.js          ~830   HTML de impressão
  pdf.js                ~370   geração do PDF
  classes/                     12 arquivos, 80 a 560 linhas
    barbaro.js  bardo.js   bruxo.js     clerigo.js
    druida.js   feiticeiro.js  guardiao.js  guerreiro.js
    ladino.js   mago.js    monge.js     paladino.js
```

### 5.2 `creator.js` — 4.627 → coordenador + 9 módulos

```
site/js/pages/creator.js         ~40   entrada da rota (renderCreator)
site/js/creator/
  comum.js              ~470   tabelas de escolhas, helpers de talento e espécie
  wizard.js             ~600   estado do wizard, navegação, validação, finalização
  passo-classe.js       ~276
  passo-especie.js      ~437
  passo-antecedente.js  ~195
  passo-atributos.js    ~634
  passo-equipamento.js  ~1.005
  passo-magias.js       ~606
  passo-detalhes.js     ~390
```

`wizard.js` é o dono de `personagem`, `stepAtual`, `dadosCache` e
`containerRef` — é ele quem os reatribui, em `renderWizard` e `avancar`. As
únicas linhas de setter do criador são as **4** dentro de `renderCreator`
(linhas 500-503 do original), que passa a chamar `definirContainer`,
`definirPersonagem`, `definirDadosCache` e `definirStep`.

### 5.3 Limite declarado: `habilidades.js`

Duas funções somam 4.635 linhas: `setupEventosHabilidades` (5029-7351, 2.322
linhas) e `renderFeatureItem` (8858-11171, 2.313 linhas). Elas **não** são
blocos limpos por classe: `renderFeatureItem` calcula ~26 flags no topo
(`char.classe === 'Clérigo' && f.nome === 'Canalizar Divindade'`, etc.) e
costura todas dentro de um único template literal gigante.

Recortá-las por classe exigiria reescrever a montagem do HTML — exatamente o
tipo de mudança que quebrou a tentativa anterior. Portanto `habilidades.js`
nasce com ~4.640 linhas e fica assim. Ainda é uma redução de 17.955 para 4.640,
num arquivo com assunto único. Quebrá-lo é trabalho de outra natureza, para
depois, com o site no ar.

## 6. Validação

Node.js não está instalado no ambiente do usuário e não será exigido. Python e
git estão disponíveis.

### 6.1 `scripts/verificar_extracao.py`

Script de leitura, sem dependências, roda em segundos:

```
$ python scripts/verificar_extracao.py sheet

  baseline .................. 17.955 linhas
  declarações de topo ....... 195 funções, 27 constantes, 2 globais window
  módulos extraídos ......... 30 arquivos
  funções presentes ......... 195/195
  corpos byte-a-byte ........ 195 idênticos, 0 alterados
  duplicadas ................ 0
  símbolos sem import ....... 0
  constantes e globais ...... 29/29
  exceções declaradas ....... 9 (setters em renderSheet)
  ✓ extração íntegra
```

Os números do baseline são: `sheet.js` com 195 funções de topo (194 internas
mais `export async function renderSheet`), 27 constantes e 2 atribuições a
`window`; `creator.js` com 63 funções de topo (62 mais
`export async function renderCreator`) e 15 constantes.

Ele compara contra um snapshot do original em `scripts/baseline/sheet.js` e
`scripts/baseline/creator.js` — fora de `site/`, portanto não servido pelo
GitHub Pages. Verifica:

1. **presença** — toda função e constante de topo do baseline existe em exatamente
   um módulo novo;
2. **integridade** — o corpo de cada função é byte a byte idêntico ao do baseline,
   descontando apenas a indentação de topo (que não muda);
3. **não duplicação** — nenhuma função aparece em dois módulos;
4. **símbolos resolvidos** — todo identificador livre usado num módulo tem
   `import` correspondente, ou está numa lista permitida de globais do navegador;
5. **exceções declaradas** — as 9 linhas de setter da seção 3.1 são as únicas
   divergências aceitas, listadas explicitamente no script.

Um corpo alterado é **erro**, não aviso.

O script roda contra o próprio baseline antes de qualquer extração; se não
reportar `312/312 idênticas` nesse teste, ele está errado e não serve.

### 6.2 Conferência visual lado a lado

Nos checkpoints, as duas URLs abertas no mesmo navegador, com o mesmo personagem:

```
home com personagens          criador: 7 passos, não conjurador
ficha: HP, dados de vida      criador: 7 passos, conjurador
descanso curto e longo        habilidades ativas da classe
magias e espaços              grimório, busca, troca
inventário e drag-drop        moedas e compras
condições, defesas, sentidos  talentos e escolhas
subir de nível                edição de campos da ficha
detalhes pessoais             impressão
PDF                           recarregar offline
importar e exportar
```

## 7. Sequência de execução

**Marco 0 — reset e base limpa.** *(concluído, commit `a85c600`)*
Conteúdo do `DeD_2024` idêntico ao do `D-D_2024`; `deploy.yml` de volta ao
workflow simples (Python + `sed`, sem Node); docs da tentativa anterior em
`docs/historico/tentativa-2026-07/`.
*Checkpoint: as duas URLs indistinguíveis.*

**Marco 1 — rede de segurança.**
Snapshot em `scripts/baseline/` e `verificar_extracao.py`, provado contra o
próprio baseline.

**Marco 2 — `sheet.js`, um commit por módulo, das folhas para a raiz:**
`estado.js` → `colapso.js` → `pdf.js` → `impressao.js` → `detalhes.js` →
`inventario.js` → `condicoes.js` → `grimorio.js` → `magias.js` →
`caracteristicas.js` → `talentos.js` → `edicao.js` → `maestrias.js` →
as 12 de `classes/` → `combate.js` → `hp-descanso.js` → `habilidades.js` →
`migracoes.js` → `ficha.js`. O que sobrar em `sheet.js` é o coordenador.

Após cada commit: `verificar_extracao.py sheet` limpo. Conferência visual nos
blocos temáticos: impressão/PDF, inventário/condições, magias/grimório, as 12
classes, habilidades/HP/descanso, e no fim.

**Marco 3 — `creator.js`, um commit por módulo:**
`comum.js` → `passo-detalhes.js` → `passo-magias.js` → `passo-equipamento.js` →
`passo-atributos.js` → `passo-antecedente.js` → `passo-especie.js` →
`passo-classe.js` → `wizard.js`. O que sobrar em `creator.js` é o coordenador.

Conferência dos sete passos, com um personagem não conjurador e um conjurador.

**Marco 4 — encerramento.** Remoção do `scripts/baseline/`, README atualizado
com a nova estrutura de pastas.

## 8. Critério de aceitação

Tudo verificável por comando, nada por opinião:

1. `python scripts/verificar_extracao.py sheet` e `... creator` limpos: toda
   função presente uma vez, todo corpo byte a byte idêntico, nenhum símbolo sem
   import, apenas as 9 exceções declaradas.
2. `diff -r` entre os dois repositórios **vazio** para `dados/`, `site/css/`,
   `site/index.html`, `site/sw.js`, `site/manifest.json`, `site/img/`,
   `index.html` e os 20 módulos JS fora de escopo.
3. `site/js/pages/sheet.js` ≤ 300 linhas e `site/js/pages/creator.js` ≤ 60
   linhas, contendo apenas montagem e chamada.
4. Nenhum arquivo novo acima de 4.700 linhas. Dos 39 módulos novos, 37 ficam
   abaixo de 2.100 linhas; as duas exceções são `habilidades.js` (~4.640,
   justificada na seção 5.3) e `magias.js` (~2.270).
5. As telas da lista da seção 6.2 idênticas nas duas URLs.
6. Um personagem antigo abre, edita, salva, sincroniza, exporta e imprime igual
   ao original.
7. A aplicação em `site/` não tem `package.json`, `node_modules`, etapa de
   build nem qualquer dependência de Node; o deploy continua sendo Python e
   `sed`. A suíte de testes de paridade em `testes/e2e/` é a única exceção,
   isolada nessa pasta e com `node_modules/` no `.gitignore`.

## 9. Fora de escopo

Não fazem parte deste trabalho, e qualquer um deles seria um projeto próprio:

- catálogo de conteúdo, IDs qualificados, pacotes versionados;
- vocabulário declarativo de efeitos, comandos e consultas de domínio;
- versionamento de schema ou migração do formato de personagem;
- regressão visual por screenshot (a paridade é medida por DOM, classes CSS
  e geometria computada, que são mais estáveis e mais diagnósticos);
- qualquer ferramenta que exija Node.js **dentro de `site/`**;
- quebra das duas funções gigantes de `habilidades.js`;
- refatoração de `levelup.js`, `levelup-ui.js` ou dos outros 18 módulos;
- correção de bugs encontrados durante a extração;
- redesenho de interface, novas regras ou conteúdo de jogo;
- multiclasse.

## 10. Decisões aprovadas

- base: recomeçar do `D-D_2024`, que funciona;
- workspace: reusar o repositório `DeD_2024`, mantendo as duas URLs para
  comparação lado a lado;
- eixo do corte: por assunto (vertical), não por camada;
- estado compartilhado: `estado.js` com live binding, sem contexto por parâmetro;
- validação: verificador Python + conferência visual, sem Node;
- escopo: apenas `sheet.js` e `creator.js`;
- `habilidades.js` com ~4.640 linhas é aceito como resultado final desta etapa.
