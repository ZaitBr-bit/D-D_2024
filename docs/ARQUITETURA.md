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
- [Módulos de regras](#módulos-de-regras-regras-js)
- [Multiclasse](#multiclasse)
- [Recursos de classe na ficha](#recursos-de-classe-na-ficha)
- [Fontes e expansões](#fontes-e-expansões)
- [Estado compartilhado: live binding](#estado-compartilhado-live-binding)
- [Dependências entre módulos](#dependências-entre-módulos)
- [Router (`app.js`)](#router-appjs)
- [Modelo de dados do personagem](#modelo-de-dados-do-personagem)
- [Carregamento de dados (`db.js`)](#carregamento-de-dados-dbjs)
- [Persistência e sincronização](#persistência-e-sincronização)
- [Padrões de UI](#padrões-de-ui)
- [Diretrizes de desenvolvimento](#diretrizes-de-desenvolvimento)
- [Cálculos-chave](#cálculos-chave)
- [Regras de conteúdo](#regras-de-conteúdo)
- [Verificar a integridade da extração](#verificar-a-integridade-da-extração)

---

## Módulos de topo

| Arquivo | Responsabilidade |
|---|---|
| `app.js` | Router SPA (hash), init, registro do Service Worker, botão de reportar bug |
| `pages/home.js` | Tela inicial: lista de personagens, import/export, login |
| `pages/creator.js` | Entrada da rota do criador: monta o estado inicial e chama o wizard |
| `pages/sheet.js` | Entrada da rota da ficha: carrega o personagem, roda as migrações e chama o render |
| `creator/*.js` | Assistente de criação, um arquivo por passo — ver tabela abaixo |
| `sheet/*.js` | Ficha do personagem, um arquivo por assunto — ver tabela abaixo |
| `store.js` | Persistência em `localStorage` + `criarPersonagemVazio()` (schema do personagem) |
| `db.js` | Carregador de `dados/*.json` com cache em memória (`fetchJSON`) |
| `sync.js` | Fila de sincronização em nuvem (retry, status online/offline) |
| `auth.js` | Login e I/O com Firestore |
| `utils.js` | Helpers puros: `calcMod`, `calcCA`, `bonusProficiencia`, `getDeslocamento`, `getTamanho`, `abrirModal`, `toast`, `escHtml`, markdown |
| `levelup.js` | Tabela de níveis e regras de progressão |
| `levelup-flow.js` | Orquestração do fluxo de subida de nível |
| `levelup-ui.js` | Telas do fluxo |
| `levelup-cards.js` | Cards de escolha (estilo de luta, talentos, opções de classe) |
| `levelup-validations.js` | Validações do que pode ser escolhido |
| `ui-opcoes.js` | Componente compartilhado de escolha em cards |
| `opcoes-dominio.js` | Origem das opções por domínio (classe, subclasse, talento) |
| `itens-seletor.js` | Seletor de itens unificado entre criador e ficha |
| `moedas.js` | Carteira multi-moeda (PC, PP, PE, PO, PL) com conversão automática |
| `regras-equipamento.js` | Regras de equipamento aplicadas em runtime |
| `regras-conjuracao-subclasse.js` | Conjuração concedida por subclasse |
| `regras-cobertura.js` | Mapa de cobertura de regras usado pelos testes de gatilho |
| `talentos-effects.js` | Efeitos passivos de talentos (cache aplicado na ficha) |
| `manobras-ui.js` | UI de manobras de combate |
| `ficha-edicoes.js` / `ficha-edicao-validacoes.js` | Edição de campos da ficha e suas validações |
| `sync-merge.js` | Regras puras de reconciliação nuvem × local (sem DOM, sem Firebase) |
| `fontes.js` | Selo clicável que diz de qual livro um conteúdo veio (Livro do Jogador, Tasha's, Ravenloft); lê `dados/fontes.json`. Magia e item de expansão levam o selo só nas telas de seleção (cards de `ui-opcoes.js`, Preparar Magias, criador, pergaminho, seletor de itens), nunca na ficha; a magia usa `seloDaMagia(nome)`, que consulta o registro de `db.fonteDaMagia` |
| `itens-magicos-catalogo.js` / `itens-magicos-ui.js` | Itens mágicos do Livro do Mestre (cap. 7): do acervo para o inventário, e a tela de detalhe |
| `pergaminho-ui.js` / `preco-informado-ui.js` | Grade de escolha da magia do Pergaminho Mágico; campo de preço informado ao adicionar item |
| `opcoes-armas.js` / `opcoes-artifice.js` | Adaptadores de cards (propriedades de arma do item personalizado; opções do Artífice) para o contrato de `ui-opcoes.js` |
| `modal-teclado.js` | Ajuste do modal ao teclado virtual do celular |
| `regras-*.js` | Regras puras, sem DOM — ver [Módulos de regras](#módulos-de-regras-regras-js) |
| `versao.js` | `VERSAO_ATUAL` e `NOTAS_VERSAO` — **editados à mão** a cada lançamento |
| `notas-versao.js` | Modal que exibe as notas de versão |
| `dados-classes.js` | Constantes: `CLASSES_INFO`, `PERICIAS`, `ATRIBUTOS_*`, `STANDARD_ARRAY`, point-buy |
| `vendor/pdf-lib.min.js` | Única dependência de terceiros embarcada, usada por `sheet/pdf.js` |

## Ficha (`site/js/sheet/`)

Cortado **por assunto**, não por camada: render, eventos e regras de um mesmo
tema ficam no mesmo arquivo. Para mexer em magias, abra `magias.js`; para mexer
no Bárbaro, `classes/barbaro.js`.

| Arquivo | Responsabilidade |
|---|---|
| `estado.js` | `char`, `containerRef`, `classeData` e os caches, mais `salvar` e os selos de edição |
| `colapso.js` | Quais seções estão recolhidas, persistido por personagem |
| `migracoes.js` | Migrações de fichas legadas, rodadas na abertura |
| `contexto-classe.js` | Contexto por classe (`contextosDeClasse()`): classe, subclasse, nível NAQUELA classe e os dados dela. Base de toda leitura multiclasse |
| `reservas-espacos.js` | Reservas de espaço de magia por fonte (`conjuracao` e `pacto`); `gastarEspaco` e `recuperarUmEspaco` são os únicos escritores de `char.espacos_magia` em runtime |
| `ficha.js` | `renderFichaCompleta`: monta a página chamando os `renderSecao*` |
| `recursos-classe.js` | Recursos de classe em chips (faixa do card Magias e card Recursos de Classe) e o popup de descrição — ver [Recursos de classe na ficha](#recursos-de-classe-na-ficha) |
| `ataques.js` / `ataque-calculo.js` | Seção Ataques (armas equipadas, Atq, dano, mãos) e o cálculo de ataque e dano de uma arma |
| `maos-ui.js` | Mãos do personagem: listar, adicionar, renomear, remover |
| `modificadores.js` | Modificadores temporários manuais |
| `item-customizado-form.js` | Formulário do item personalizado |
| `ultima-carga.js` | Modal da regra da última carga de um item |
| `companheiros-artifice.js` | Seção dos companheiros do Artífice (Defensor de Aço, Canhão Instável…) |
| `forma-selvagem.js` | Forma Selvagem do Druida: tela de formas conhecidas e de escolha da forma (cards com ficha técnica em popup), card **Forma Selvagem ATIVA** abaixo do cabeçalho, bloqueio de conjuração em forma. O Companheiro Selvagem usa a tela de escolha do familiar (`familiar.js`) com tipo Feérico e custo à escolha. Regra pura em `regras-forma-selvagem.js` |
| `pv-criatura.js` | Modal de dano e cura (seletor de roda, igual ao do personagem) usado pelos cards de criaturas: familiar e companheiros do Artífice |
| `familiar.js` | Convocar Familiar: tela de escolha da forma (cards com ficha técnica em popup) aberta ao conjurar por espaço, Ritual, uso grátis ou Pacto da Corrente, e o card **Familiar** acima das magias (PV, descartar, reaparecer, dispensar). A regra pura está em `regras-familiar.js` |
| `necromante.js` | Subclasse Necromante (Arcana Unleashed): card Mortos-Vivos (registro, PV por modal, dispensar), Vitalidade Morta-Viva ao conjurar Necromancia com espaço, registro após Animar Mortos, Resiliência Sepulcral na Recuperação Arcana, Colher, Fortalecer e Extinguir Mortos-Vivos |
| `hp-descanso.js` | PV, dados de vida, descanso curto e longo |
| `habilidades.js` | Habilidades ativas e itens de característica |
| `combate.js` | Deslocamento, ataques, iniciativa, perícias, carga |
| `maestrias.js` | Modais de maestria em arma (Bárbaro, Guerreiro, Guardião, Paladino, Ladino) |
| `edicao.js` | Modal de edição da ficha e subida de nível |
| `talentos.js` | Seção de talentos, Iniciado em Magia, Dádiva Épica |
| `caracteristicas.js` | Características de classe, subclasse e traços de espécie |
| `magias.js` | Seção de magias, espaços, concentração, metamagia, magias personalizadas |
| `grimorio.js` | Buscas e trocas de magia, grimório do Mago |
| `condicoes.js` | Condições, defesas, sentidos e proficiências |
| `inventario.js` | Inventário, arrasta-e-solta, seletores, itens personalizados |
| `detalhes.js` | Detalhes pessoais |
| `impressao.js` | Versão formatada para impressão |
| `pdf.js` | Geração do PDF |
| `classes/*.js` | Progressão e recursos de cada uma das 13 classes (as 12 do Livro do Jogador e o Artífice, de Tasha's) |

`habilidades.js` continua grande de propósito: `renderFeatureItem` e
`setupEventosHabilidades` calculam as flags por classe no topo e as costuram
dentro de um único template literal, então quebrá-las exigiria reescrever a
montagem do HTML. Ver a seção 5.3 da spec da quebra dos monólitos
(`docs/superpowers/specs/2026-08-05-quebra-monolitos-design.md`, local).

## Criador (`site/js/creator/`)

| Arquivo | Responsabilidade |
|---|---|
| `wizard.js` | `personagem`, `stepAtual`, `dadosCache`, `containerRef`, navegação, validação e finalização |
| `comum.js` | Tabelas de escolha e helpers de talento e espécie |
| `passo-classe.js` | Passo 1 |
| `passo-especie.js` | Passo 2 |
| `passo-antecedente.js` | Passo 3 |
| `passo-atributos.js` | Passo 4: rolagem, matriz padrão, compra por pontos, manual |
| `passo-equipamento.js` | Passo 5 |
| `passo-magias.js` | Passo 6 |
| `passo-detalhes.js` | Passo 7 |

## Módulos de regras (`regras-*.js`)

Funções **puras**: recebem o personagem (ou dados) por parâmetro, não tocam no
DOM e não leem `char`. É o que permite testá-las no Node (`testes/regras/unidade/`)
sem navegador. A tela chama essas funções e só desenha o resultado.

| Assunto | Módulos |
|---|---|
| Multiclasse | `regras-multiclasse.js` (acessores: `classesDe`, `nivelNa`, `subclasseDe`, `temClasse`, dados de vida), `regras-multiclasse-conjuracao.js` (nível de conjurador e tabela unificada), `regras-multiclasse-proficiencias.js`, `regras-multiclasse-progressao.js` (pré-requisito de entrada e PV por nível) |
| Magias | `regras-magia-classe.js` (a que classe pertence cada magia), `regras-preparo-magias.js` (quando e quanto a lista pode mudar), `regras-origens-magia.js` (fonte única das magias que o jogador não escolheu), `regras-usos-gratis-magia.js`, `regras-conjuracao-subclasse.js` |
| Atributos e proficiências | `regras-atributos.js` (atributo efetivo, o valor que vale em jogo), `regras-aumento-atributo.js`, `regras-salvaguardas.js`, `regras-ordem-classe.js` (Ordem Divina e Primal), `regras-subclasse-escolhas.js`, `regras-resistencias-especie.js` |
| Combate | `regras-ataque.js` (atributo do modificador, dano versátil, mãos), `regras-condicoes.js` |
| Itens mágicos | `regras-itens-magicos.js`, `regras-passivos-itens.js`, `regras-magias-itens.js`, `regras-espacos-itens.js`, `regras-recursos-itens.js` (cargas e usos), `regras-itens-temporarios.js`, `regras-sintonizacao.js`, `regras-sintonizacao-restrita.js`, `regras-pergaminho.js` |
| Artífice (Tasha's) | `regras-artifice.js`, `regras-subclasses-artifice.js`, `regras-planos-artifice.js` (Replicar Item Mágico), `regras-criaturas-artifice.js` |
| Familiar | `regras-familiar.js` (formas elegíveis, PV, um só familiar, desaparecer a 0 PV, descartar e reaparecer) |
| Necromante (Arcana Unleashed) | `regras-necromante.js` (Vitalidade e Fortitude Morta-Viva, Golpe Debilitante, Colher, Fortalecer, Extinguir, registro de Mortos-Vivos em `recursos.mago.subclasses.necromante`) |
| Forma Selvagem | `regras-forma-selvagem.js` (tabela Formas de Feras, formas elegíveis por ND e voo, PV temporários, Círculo da Lua, formas conhecidas) |
| Equipamento | `regras-equipamento.js` |
| Cobertura de testes | `regras-cobertura.js` (mapa de cobertura usado pelos testes de gatilho) |

## Multiclasse

O personagem guarda `char.classes`, um array `{ classe, subclasse, nivel, ordem }`
(com `schema_versao: 2`). Os campos `char.classe`, `char.subclasse` e `char.nivel`
continuam existindo como **espelhos**: classe inicial e nível total.

Regra de ouro: **nunca ler o espelho para uma regra de classe.** Use
`nivelNa(char, 'Bruxo')`, `subclasseDe(char, 'Bruxo')` e `temClasse(char, 'Bruxo')`
(`regras-multiclasse.js`) ou `contextosDeClasse()` (`sheet/contexto-classe.js`).
Ler `char.nivel` dá o nível total, e um Mago 5 / Bruxo 5 passa a ter Bruxo 10.
O único uso legítimo do nível total é bônus de proficiência, XP e o teto de
nível 20. Um teste de alcance (`multiclasse-descansos-alcance.test.mjs`) varre
`ficha.js`, `recursos-classe.js` e `hp-descanso.js` atrás dessas leituras.

Espaços de magia vêm de duas reservas por fonte, `conjuracao` e `pacto`
(`sheet/reservas-espacos.js`). Só `gastarEspaco` e `recuperarUmEspaco` escrevem
em `char.espacos_magia` em runtime.

## Recursos de classe na ficha

Os recursos de classe com estado ou botão (Astúcia Mágica, Fúria, Inspiração,
Pontos de Foco, Recuperação Arcana…) são montados por `sheet/recursos-classe.js`
como **chips**, agrupados por classe:

- **Classes conjuradoras** (Mago, Bruxo, Feiticeiro, Druida, Guardião, Bardo,
  Paladino): faixa no topo do card **Magias**.
- **Demais classes** (Bárbaro, Guerreiro, Monge, Ladino) e conjuradoras sem card
  de Magias: card **Recursos de Classe**, logo antes das Características.

Cada bloco é um `<details class="recursos-grupo">` que **nasce recolhido**, com
uma linha de resumo no cabeçalho; o estado aberto/fechado é lembrado nos
re-renders. Clicar no chip, fora de um botão, abre um popup com a descrição da
característica, lida de `dados/classes/*.json`; clicar no botão só executa a
ação. Os botões mantêm os atributos `data-*-acao` e os handlers continuam em
`habilidades.js` e `sheet/classes/*.js`.

Para criar um recurso novo: adicione um `chip({...})` na função da classe em
`recursos-classe.js`, com o `data-*-acao` escrito por extenso no botão, e um spec
que clique nele (ver [Diretrizes de desenvolvimento](#diretrizes-de-desenvolvimento)).

## Fontes e expansões

Além do Livro do Jogador, o app traz conteúdo de expansões, cada uma em sua
pasta de `dados/` e declarada em `dados/fontes.json`:

| Fonte | Pasta | Conteúdo |
|---|---|---|
| Livro do Jogador (2024) | `dados/classes`, `origens`, `talentos`, `magias`, `equipamento` | 12 classes, 48 subclasses, 11 espécies, 16 antecedentes, 75 talentos, 391 magias |
| Livro do Mestre (2024) | `dados/livro-do-mestre/` | itens mágicos (cap. 7) |
| Tasha's Cauldron of Everything | `dados/tasha/` | Artífice com 5 subclasses, magias, itens e criaturas |
| Ravenloft: Horrors Within | `dados/ravenloft/` | espécie Renascido |
| Arcana Unleashed | `dados/arcana-unleashed/` | subclasse Necromante do Mago (`db.getClasse('Mago')` a junta às do Livro do Jogador) e 8 magias de Necromancia (`magias.json`; `db` as junta ao índice, aos círculos e às listas de classe pelo campo `classes` de cada magia) |
| Manual dos Monstros (2026) | `dados/monstros/` | 23 Feras do Apêndice A (ND 1/4 a 6) para a Forma Selvagem; `db.getCriaturas()` as junta às do apêndice. Gerado por `scripts/monstros/montar_criaturas.mjs` |

`fontes.js` desenha o selo de origem (clicável) nos cards e no cabeçalho.

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
  classe, subclasse, especie, antecedente, alinhamento,   // classe/subclasse/nivel: espelhos (classe inicial, nível total)
  classes: [ { classe, subclasse, nivel, ordem } ], schema_versao: 2,   // fonte da verdade da multiclasse
  tracos_escolhidos: [], escolhas_classe: {}, escolhas_antecedente: {},
  atributos:       { forca, destreza, constituicao, inteligencia, sabedoria, carisma }, // VALORES (ex: 15)
  atributos_base:  { ... },
  pv_max, pv_atual, pv_temporario, dados_vida_total, dados_vida_usados,
  pericias_proficientes: [], pericias_expertise: [], salvaguardas_proficientes: [],
  inventario: [ /* ver abaixo */ ],
  po: 0,                       // peças de ouro
  magias_conhecidas: [], magias_preparadas: [], grimorio: [],
  espacos_magia: { conjuracao: {}, pacto: {} },   // gastos por fonte e círculo
  talentos: [], efeitos_magicos: [], usos_habilidades: {},
  idiomas: ['Comum'],
  tamanho: '',                 // 'Pequeno' | 'Médio' | 'Grande' | 'Médio ou Pequeno' | ''
  condicoes: [], resistencias: [], vulnerabilidades: [], imunidades: [],
  recursos: { furia_ativa, bruxo: {...}, mago: {...}, ... },   // estado dos recursos de classe
  configuracao_criacao: { atributos: { metodo, valoresBase, rolagens } },
  config: { sobrecarga_afeta_deslocamento: false, aviso_truques_dispensado: false },   // flags de regras opcionais e avisos dispensados
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

## Diretrizes de desenvolvimento

Regras que valem para qualquer mudança neste repositório.

### Interface

- **Listas com informação não usam `<select>`/dropdown**, a menos que o pedido
  diga o contrário. Magias, itens, invocações, talentos, condições e qualquer
  lista em que cada entrada tenha descrição, pré-requisito, custo ou efeito
  aparecem como **cards**, em tela ou popup própria. Clicar no card (fora do
  controle de seleção) abre um **popup com as informações completas**. O
  `<select>` fica para escolha simples entre valores curtos e sem descrição
  (tipo de dado, moeda, ordenação).
- **Descrição nunca se expande dentro do card.** Texto longo esticado numa grade
  desalinha a linha inteira e, no celular, a tela toda. A descrição vai para
  popup. Se o popup abre sobre um modal que tem seleção em andamento, use
  sobreposição própria (`.inv-popup-sobreposicao`, em `bruxo.js`) e não
  `abrirModal`, que substitui o modal aberto.
- **Componentes de card existentes:** `ui-opcoes.js` (escolha em cards, usado no
  criador e na subida de nível), `itens-seletor.js` (itens, criador e ficha),
  `itens-magicos-ui.js` (detalhe de item mágico) e os chips de
  `sheet/recursos-classe.js`. Reaproveite antes de criar outro.
- **Todo bloco recolhível nasce fechado.** `<details>`, seção ou painel não
  usam `open` por padrão, a menos que o pedido diga expressamente que venha
  aberto. Dê um `data-details-id` estável: `salvarEstadoDetails` e
  `restaurarEstadoDetails` (`sheet/ficha.js`) guardam o estado escolhido pelo
  jogador entre re-renders. Specs que precisam do conteúdo abrem o bloco no
  teste (`abrirBlocosRecursos`, em `testes/e2e/regras/helpers-regras.mjs`).
- **Celular primeiro.** Teste em largura de 390 px.
- **Cada recurso aparece onde é usado.** Botão de usar uma característica fica no
  card em que o jogador a usa (conjuração no card Magias), não num painel
  distante que obrigue a rolar a ficha.

### Código

- **Comentários em pt-BR**, objetivos: o fato e a consequência técnica, sem
  retórica. **Toda função criada tem um comentário** dizendo o que ela faz.
- **Regra de classe nunca lê o espelho** (`char.classe`, `char.subclasse`,
  `char.nivel`): use `nivelNa`, `subclasseDe`, `temClasse` — ver
  [Multiclasse](#multiclasse).
- **Regra pura em `regras-*.js`**, sem DOM e sem ler `char`. A tela só desenha.
- **Compatibilidade com fichas antigas:** campo novo lido com optional chaining
  e escrito com guarda; mudança de schema vira migração em `sheet/migracoes.js`.
- **Escapar entrada do usuário** com `escHtml()` ao interpolar em HTML.
- **`data-*-acao` por extenso** no HTML do botão, nunca montado por interpolação,
  para o inventário de gatilhos (`testes/regras/unidade/gatilhos-ui-cobertos.test.mjs`)
  achá-lo.
- **Dado do livro vem de `dados/`**, não de constante no código. Quando o livro
  e o app divergem, vale o livro: confira o texto antes de implementar.

### Testes

- **Gatilho novo precisa de spec que clique nele** (`testes/e2e/regras/`). O
  motor de gatilhos reprova botão (`id="btn-..."` ou `data-*-acao`) sem teste.
- **Oráculo vermelho antes da correção:** escreva o teste, veja-o falhar pelo
  motivo certo, corrija, veja-o passar.
- **Clique de verdade.** Afirmar sobre o HTML de uma semente pronta deixa passar
  defeito que vive no handler do clique.
- **Todo `test.skip` leva o motivo escrito no arquivo.**
- Ao terminar uma rodada, rode `scripts/limpar-processos-teste.ps1 -Matar` para
  fechar processos de teste esquecidos.

### Processo

- **Não commitar sem pedido expresso.** O staging é arquivo a arquivo; nunca
  `git add -A` nem `git commit -a`. Artefatos de planejamento
  (`docs/superpowers/`) não entram em commit, salvo pedido.
- A versão visível (`VERSAO_ATUAL` e a entrada no topo de `NOTAS_VERSAO`) só muda
  quando o dono do projeto pede, e as duas precisam bater.

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

Confere declaração duplicada, símbolo usado sem import, import que aponta
para um nome que o módulo de destino não exporta, e gravação em binding
importado — esta última é erro de sintaxe em módulo ES, e derruba o arquivo
inteiro. Divergências aceitas ficam em `scripts/excecoes/`.

Até 2026-08-18 ele também comparava cada declaração, byte a byte, contra os
monólitos pré-refatoração guardados em `scripts/baseline/`. Essa comparação
foi aposentada: a refatoração que ela guardava terminou, e desde a v2.2.0 o
código legitimamente divergiu do baseline — a checagem acusava 79 problemas
que eram todos evolução esperada. Verificador permanentemente vermelho não
verifica nada, só ensina a ignorar. Os arquivos continuam no histórico.
