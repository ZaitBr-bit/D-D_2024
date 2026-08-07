# Domínio Classes/Níveis da suíte de regras — plano de implementação

> **Para agentes:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development
> (recomendado) ou superpowers:executing-plans para implementar tarefa a tarefa.
> Os passos usam checkbox (`- [ ]`) para acompanhamento.

**Goal:** Confrontar as 12 classes do app com as tabelas de progressão de
`Informacoes Separadas/Classes.md`, nos 20 níveis, tanto na fonte de dados
quanto no comportamento real de `subirDeNivel()`.

**Architecture:** Um catálogo transcrito do livro (`catalogo/classes.mjs`)
alimenta dois motores de `node:test`: um estrutural (`unidade/classes.test.mjs`),
que confronta `dados/classes/*.json`, `CLASSES_INFO` e as funções puras de
leitura/gatilho; e um comportamental (`unidade/classes-progressao.test.mjs`),
que sobe personagens do nível 1 ao 20 via `subirDeNivel()` e confere o
personagem resultante nível a nível. Ambos rodam sem navegador, graças a um
stub de `fetch` no harness que faz `site/js/db.js` ler `dados/` do disco.

**Tech Stack:** `node:test` + `node:assert/strict`, ES modules, zero
dependências. Roda a partir de `testes/e2e/` com
`npm run test:regras:unidade`.

**Spec:** [docs/superpowers/specs/2026-08-07-classes-niveis-design.md](../specs/2026-08-07-classes-niveis-design.md)

## Global Constraints

- **Comentários em código sempre em Português do Brasil.** Toda função nova
  leva comentário explicando o que faz (instrução global do projeto).
- **Não commitar.** Nenhuma tarefa faz `git commit`, `git add`, cria branch ou
  worktree. O trabalho fica no diretório de trabalho da branch atual (`main`).
- **O catálogo é transcrito do livro, nunca gerado de `dados/`.** Nenhum valor
  de `catalogo/classes.mjs` pode ser copiado de `dados/classes/*.json` nem de
  `site/js/dados-classes.js`. Gerar do JSON faz o teste comparar o app consigo
  mesmo.
- **Valor esperado nunca vem da função sob teste**, nem de um helper que ela
  chame por dentro. O esperado sai sempre do catálogo.
- **Só reportar, não corrigir.** Divergência encontrada vira entrada em
  `testes/regras/lacunas-conhecidas.mjs` com `tipo` e `motivo` citando arquivo
  e linha dos dois lados. Nenhuma tarefa altera arquivos de `site/js/`.
- **Nenhum `return` antecipado** num teste que faça um caso passar sem afirmar
  nada. Nenhum `assert.ok(x >= 0)` ou comparação por `substring` em blob
  serializado.
- **Varredura exaustiva, não amostragem:** 12 classes × 20 níveis, sempre.
- **Comando de execução** (a partir de `testes/e2e/`):
  `npm run test:regras:unidade`. O glob vai entre aspas de propósito —
  `node --test "../regras/unidade/*.test.mjs"`. A forma sem aspas falha com
  `MODULE_NOT_FOUND` neste Node/Windows; não simplifique.
- **As 12 classes**, com a grafia exata usada em todo o projeto:
  `Bárbaro`, `Bardo`, `Bruxo`, `Clérigo`, `Druida`, `Feiticeiro`, `Guardião`,
  `Guerreiro`, `Ladino`, `Mago`, `Monge`, `Paladino`.

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `testes/regras/catalogo/classes.mjs` (novo) | Transcrição do livro: citações, traços básicos, 240 linhas de progressão, nomes de subclasse, mapa de rótulos de gatilho |
| `testes/regras/unidade/classes.test.mjs` (novo) | Motor estrutural: catálogo × `dados/` × `CLASSES_INFO` × funções puras |
| `testes/regras/unidade/classes-progressao.test.mjs` (novo) | Motor comportamental: subida 1→20 via `subirDeNivel()` |
| `testes/regras/unidade/harness.mjs` (alterado) | Stub de `fetch`, leitores de `dados/classes/` e `Classes.md`, driver `escadaDeNivel()` |
| `testes/regras/lacunas-conhecidas.mjs` (alterado) | Novas chaves em `TESTES_VALIDOS` + lacunas encontradas |
| `testes/regras/unidade/completude.test.mjs` (alterado) | Higiene de lacuna passa a aceitar nome de classe como entidade |
| `testes/regras/README.md` (alterado) | Seção do domínio, totais, escopo declarado |
| `testes/regras/GUIA-PROXIMOS-DOMINIOS.md` (alterado) | Lição da rodada, se houver |

---

### Task 1: Harness — stub de `fetch`, leitores e `db.js`

**Risk:** medium — `harness.mjs` é compartilhado pelos 7 motores existentes.
Um stub de `fetch` instalado errado (ou instalado quando já existe um) pode
quebrar motores que hoje passam.

**Files:**
- Modify: `testes/regras/unidade/harness.mjs`

**Interfaces:**
- Consumes: nada de tarefas anteriores.
- Produces:
  - `lerClassesDados(): Map<string, object>` — nome da classe (`'Bárbaro'`) →
    objeto JSON completo de `dados/classes/<arquivo>.json`.
  - `lerHeadingsClasses(): Set<string>` — todos os títulos `#`, `##` e `###`
    de `Classes.md`.
  - `modulosApp()` passa a devolver também a chave `db` (o módulo
    `site/js/db.js`).

- [ ] **Step 1: Instalar o stub de `fetch` junto dos stubs existentes**

`site/js/db.js:15` chama `fetch('../dados/<caminho>')`. Em Node o `fetch`
global existe mas rejeita caminho relativo. O stub resolve contra o disco.

Em `instalarStubs()`, depois do bloco de `globalThis.document`, acrescentar:

```js
  // site/js/db.js:15 carrega dados/ por `fetch('../dados/...')`. Em Node o
  // fetch global existe, mas rejeita caminho relativo -- sem este stub,
  // getClasse() devolve null e todo motor que dirige subirDeNivel() passaria
  // testando um personagem que nunca sobe. Resolve o caminho relativo contra
  // o disco e devolve o mínimo da interface Response que db.js consome.
  globalThis.fetch = async (url) => {
    const relativo = String(url).replace(/^\.\.\//, '');
    const caminho = resolve(RAIZ, relativo);
    const texto = readFileSync(caminho, 'utf-8');
    return { ok: true, status: 200, json: async () => JSON.parse(texto) };
  };
```

A guarda `if (globalThis.localStorage) return;` no topo de `instalarStubs()`
já impede instalação dupla — o stub de `fetch` fica dentro dela, junto dos
outros, e não precisa de guarda própria.

- [ ] **Step 2: Acrescentar `db.js` a `modulosApp()`**

Em `modulosApp()`, incluir o import e a chave no objeto de cache:

```js
  const [regras, efeitos, store, levelup, criador, utils, dadosClasses, db] = await Promise.all([
    importar('site/js/regras-cobertura.js'),
    importar('site/js/talentos-effects.js'),
    importar('site/js/store.js'),
    importar('site/js/levelup.js'),
    importar('site/js/creator/comum.js'),
    importar('site/js/utils.js'),
    importar('site/js/dados-classes.js'),
    importar('site/js/db.js'),
  ]);
  _cache = { regras, efeitos, store, levelup, criador, utils, dadosClasses, db };
```

- [ ] **Step 3: Escrever os dois leitores**

No fim de `harness.mjs`, antes de `charBase()`:

```js
// As 12 classes de dados/classes/, indexadas pelo nome que o app usa
// ('Bárbaro', não 'barbaro'). O diretório também tem 8 arquivos
// `magias_<classe>.json`, que são listas de magias e NÃO classes -- por isso
// a lista de arquivos é explícita em vez de um readdir filtrado: um arquivo
// novo no diretório não deve entrar aqui em silêncio.
const ARQUIVOS_CLASSE = {
  'Bárbaro': 'barbaro.json', 'Bardo': 'bardo.json', 'Bruxo': 'bruxo.json',
  'Clérigo': 'clerigo.json', 'Druida': 'druida.json', 'Feiticeiro': 'feiticeiro.json',
  'Guardião': 'guardiao.json', 'Guerreiro': 'guerreiro.json', 'Ladino': 'ladino.json',
  'Mago': 'mago.json', 'Monge': 'monge.json', 'Paladino': 'paladino.json',
};

export function lerClassesDados() {
  const mapa = new Map();
  for (const [nome, arquivo] of Object.entries(ARQUIVOS_CLASSE)) {
    mapa.set(nome, JSON.parse(
      readFileSync(resolve(RAIZ, 'dados/classes', arquivo), 'utf-8')));
  }
  return mapa;
}

// Títulos de Classes.md -- para conferir as citações do catálogo de classes.
// Diferente de Talentos.md (só `###`) e Antecedente.md (só `##`), este
// arquivo mistura os três níveis para o mesmo tipo de seção: a tabela do
// Bárbaro é `## Características de Classe de Bárbaro` (linha 38) e a do Bardo
// é `### Características de Classe de Bardo` (linha 369); as subclasses são
// `# Subclasses de Bárbaro` (185) mas `## Subclasses de Druida` (2333). Um
// regex de um nível só produziria falhas que pareceriam catálogo errado.
export function lerHeadingsClasses() {
  const md = readFileSync(
    resolve(RAIZ, 'Informacoes Separadas', 'Classes.md'), 'utf-8');
  return new Set([...md.matchAll(/^#{1,3}\s+(.+?)\s*$/gm)].map((m) => m[1]));
}
```

- [ ] **Step 4: Provar que o stub funciona e não quebrou nada**

Criar `testes/regras/unidade/_spike-harness.mjs` (temporário):

```js
import { modulosApp, lerClassesDados, lerHeadingsClasses } from './harness.mjs';
const { db, store, levelup } = await modulosApp();
const cd = await db.getClasse('Bárbaro');
console.log('getClasse:', cd?.nome, '| linhas:', cd?.tabela_caracteristicas?.length);
console.log('lerClassesDados:', lerClassesDados().size, 'classes');
console.log('headings tabela Bárbaro:',
  lerHeadingsClasses().has('Características de Classe de Bárbaro'));
const p = store.criarPersonagemVazio();
p.classe = 'Bárbaro'; p.nivel = 1; p.xp = levelup.XP_POR_NIVEL[2];
console.log('subirDeNivel nv2:', JSON.stringify(await levelup.subirDeNivel(p, {})));
console.log('nivel apos:', p.nivel);
```

Run (a partir da raiz do repositório):
`node testes/regras/unidade/_spike-harness.mjs`

Expected — exatamente estes valores:
```
getClasse: Bárbaro | linhas: 20
lerClassesDados: 12 classes
headings tabela Bárbaro: true
subirDeNivel nv2: {"sucesso":true,...}
nivel apos: 2
```

- [ ] **Step 5: Rodar a suíte inteira e apagar o spike**

Run (a partir de `testes/e2e/`): `npm run test:regras:unidade`
Expected: **528 testes, 484 pass, 44 skip, 0 fail** — o mesmo total de antes
desta tarefa. Se algum motor existente ficar vermelho, a causa é o stub de
`fetch` e não se segue adiante.

Depois: `rm testes/regras/unidade/_spike-harness.mjs`

---

### Task 2: Catálogo — citações, traços básicos e subclasses

**Risk:** low — arquivo novo, sem consumidor ainda; nenhum teste pode
regredir.

**Files:**
- Create: `testes/regras/catalogo/classes.mjs`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `CITACOES: Record<string, string>` — 12 entradas, formato
    `'Classes.md §Características de Classe de <Classe>'`.
  - `TRACOS_BASICOS: Record<string, object>` — 12 entradas com os campos
    `dadoVida` (number), `atributoPrimario` (string), `salvaguardas`
    (string[2]), `numPericias` (number), `periciasOpcoes` (string[] ou `null`
    para "qualquer perícia"), `armaduras` (string[]), `armas` (string[]),
    `conjurador` (boolean), `atributoConjuracao` (string ou `null`).
  - `SUBCLASSES: Record<string, string[]>` — 12 entradas × 4 nomes.

- [ ] **Step 1: Ler as 12 seções "Tornando-se um X" no livro**

Cada classe tem uma tabela **Traços Básicos de X** logo abaixo do heading
`## Tornando-se um X`. Linhas de referência em `Informacoes Separadas/Classes.md`:
Bárbaro 26, Bardo 357, Bruxo 839, Clérigo 1498, Druida 1985, Feiticeiro 2594,
Guardião 3237, Guerreiro 3767, Ladino 4163, Mago 4545, Monge 5120,
Paladino 5455.

Transcrever lendo essas seções. **Não** abrir `dados/classes/*.json` nem
`site/js/dados-classes.js` nesta tarefa — são justamente o que a Task 4 e a
Task 5 vão confrontar contra o que você escrever aqui.

- [ ] **Step 2: Escrever o cabeçalho e as citações**

```js
// ============================================================
// Progressão das 12 classes, transcrita do livro.
// Este catálogo segue `ficha-transversal.mjs`, não `talentos.mjs`:
// o livro traz TABELA fechada (20 linhas por classe), então o
// catálogo é transcrição e o confronto é varredura exaustiva —
// 12 classes × 20 níveis, sem amostragem.
//
// Fonte: `Informacoes Separadas/Classes.md`, uma tabela
// "Características de X" por classe.
//
// REGRA DURA: cada valor aqui foi lido da tabela do LIVRO. Nada foi
// copiado de `dados/classes/*.json` nem de `site/js/dados-classes.js`
// — são exatamente as duas fontes que os motores confrontam contra
// este arquivo. Um catálogo gerado a partir delas bateria 240/240 sem
// provar nada, porque o app estaria sendo comparado consigo mesmo.
// ============================================================

// Citação por classe: aponta para o heading sob o qual a TABELA de
// progressão está, que é de onde PROGRESSAO foi transcrita. O nível do
// heading varia (## para Bárbaro, ### para Bardo) — por isso
// lerHeadingsClasses() aceita #, ## e ###.
//
// Paladino é a exceção, e é fácil errar: ele tem dois headings
// parecidos, e a tabela fica sob o PRIMEIRO. `## Características de
// Paladino` (Classes.md:5469) é seguido imediatamente pela tabela de 20
// linhas (5471-5493); `## Características de Classe de Paladino` (5495)
// abre a PROSA que descreve cada característica ("### Nível 1:
// Conjuração", ...) e remete de volta à tabela que já apareceu acima
// dele. Por isso a citação do Paladino é a única que não segue o texto
// "Características de Classe de X" das outras onze.
export const CITACOES = {
  'Bárbaro': 'Classes.md §Características de Classe de Bárbaro',
  'Bardo': 'Classes.md §Características de Classe de Bardo',
  'Bruxo': 'Classes.md §Características de Classe de Bruxo',
  'Clérigo': 'Classes.md §Características de Classe de Clérigo',
  'Druida': 'Classes.md §Características de Classe de Druida',
  'Feiticeiro': 'Classes.md §Características de Classe de Feiticeiro',
  'Guardião': 'Classes.md §Características de Classe de Guardião',
  'Guerreiro': 'Classes.md §Características de Classe de Guerreiro',
  'Ladino': 'Classes.md §Características de Classe de Ladino',
  'Mago': 'Classes.md §Características de Classe de Mago',
  'Monge': 'Classes.md §Características de Classe de Monge',
  'Paladino': 'Classes.md §Características de Paladino',
};
```

- [ ] **Step 3: Escrever `TRACOS_BASICOS` (12 entradas)**

Formato, com o Bárbaro como modelo (transcrito de `Classes.md`, tabela
Traços Básicos de Bárbaro):

```js
// Traços básicos, da tabela "Traços Básicos de X" de cada classe.
// `periciasOpcoes: null` significa "qualquer perícia" (só o Bardo) —
// distinto de uma lista vazia, que significaria "nenhuma opção".
// `atributoPrimario` é transcrito como o livro escreve, inclusive
// quando são dois ("Destreza e Sabedoria", Guardião).
export const TRACOS_BASICOS = {
  'Bárbaro': {
    dadoVida: 12,
    atributoPrimario: 'Força',
    salvaguardas: ['Força', 'Constituição'],
    numPericias: 2,
    periciasOpcoes: ['Atletismo', 'Intimidação', 'Lidar com Animais',
                     'Natureza', 'Percepção', 'Sobrevivência'],
    armaduras: ['Leve', 'Média', 'Escudo'],
    armas: ['Simples', 'Marcial'],
    conjurador: false,
    atributoConjuracao: null,
  },
  // ... as outras 11
};
```

Regras de transcrição, para as comparações da Task 5 não falharem por
formato:
- `salvaguardas` e `periciasOpcoes` em **ordem alfabética**, com acento.
- `armaduras` usa os rótulos `'Leve'`, `'Média'`, `'Pesada'`, `'Escudo'`.
- `armas` usa `'Simples'` e `'Marcial'`.
- `conjurador: true` para as 8 classes com coluna "Magias Preparadas"
  na tabela; `false` para Bárbaro, Guerreiro, Ladino, Monge.

- [ ] **Step 4: Escrever `SUBCLASSES` (12 × 4 nomes)**

Transcrever das seções de subclasse do livro (`# Subclasses de X`, exceto
Druida em `## Subclasses de Druida:2333` e Paladino em
`## Subclasses de Paladino:5689`). Nomes em ordem alfabética.

```js
// Só os NOMES das 48 subclasses, para provar bijeção com
// dados/classes/*.json → subclasses[].nome. As características de
// subclasse por nível são a rodada SEGUINTE deste domínio (ver o
// README de testes/regras/): este catálogo já traz o gancho onde elas
// serão penduradas, sem reprojetar nada.
export const SUBCLASSES = {
  'Bárbaro': ['Trilha da Árvore do Mundo', 'Trilha do Berserker',
              'Trilha do Coração Selvagem', 'Trilha do Fanático'],
  // ... as outras 11
};
```

- [ ] **Step 5: Conferir que o arquivo carrega**

Run (a partir da raiz):
`node -e "import('./testes/regras/catalogo/classes.mjs').then(m => console.log(Object.keys(m.CITACOES).length, Object.keys(m.TRACOS_BASICOS).length, Object.keys(m.SUBCLASSES).length, Object.values(m.SUBCLASSES).flat().length))"`

Expected: `12 12 12 48`

---

### Task 3: Catálogo — as 240 linhas de `PROGRESSAO`

**Risk:** medium — 240 linhas transcritas à mão. Um erro de digitação vira
lacuna falsa, que o guia trata como pior que lacuna faltando.

**Files:**
- Modify: `testes/regras/catalogo/classes.mjs`

**Interfaces:**
- Consumes: nada da Task 2 além do arquivo existir.
- Produces:
  - `PROGRESSAO: Record<string, LinhaNivel[]>` — 12 chaves × 20 linhas.
    `LinhaNivel = { nivel: number, bonusProficiencia: number,
    caracteristicas: string[], colunas: Record<string,string>,
    espacos: Record<string,number>|null }`.
  - `COLUNAS_POR_CLASSE: Record<string, string[]>` — os nomes de coluna
    específicos de cada classe, na grafia exata da chave de
    `dados/classes/*.json`.

- [ ] **Step 1: Registrar as colunas de cada classe**

Os nomes de coluna variam por classe, e a chave das características também
(`'Características de Classe'` em Bárbaro/Bardo/Mago, `'Características'` nas
outras nove). Escrever primeiro o mapa, para a transcrição não improvisar:

```js
// Colunas específicas de cada classe, na grafia exata da chave em
// dados/classes/*.json. Note "Espacos de Magia"/"Nivel do Espaco" do
// Bruxo SEM acento -- é assim que o arquivo de dados grafa, e o teste
// compara chave a chave.
export const COLUNAS_POR_CLASSE = {
  'Bárbaro': ['Fúrias', 'Dano da Fúria', 'Maestria em Arma'],
  'Bardo': ['Dados de Inspiração', 'Truques', 'Magias Preparadas'],
  'Bruxo': ['Invocações', 'Truques', 'Magias Preparadas',
            'Espacos de Magia', 'Nivel do Espaco'],
  'Clérigo': ['Canalizar Divindade', 'Truques', 'Magias Preparadas'],
  'Druida': ['Forma Selvagem', 'Truques', 'Magias Preparadas'],
  'Feiticeiro': ['Pontos de Feitiçaria', 'Truques', 'Magias Preparadas'],
  'Guardião': ['Inimigo Favorito', 'Magias Preparadas'],
  'Guerreiro': ['Recuperar Fôlego', 'Maestria em Arma'],
  'Ladino': ['Ataque Furtivo'],
  'Mago': ['Truques', 'Magias Preparadas'],
  'Monge': ['Artes Marciais', 'Pontos de Foco', 'Movimento sem Armadura'],
  'Paladino': ['Canalizar Divindade', 'Magias Preparadas'],
};

// Chave da coluna de características em dados/classes/*.json: três
// classes usam 'Características de Classe' e nove usam 'Características'.
// obterCaracteristicasNivel (levelup.js:388) já trata as duas com `??`;
// o teste de tabela precisa saber qual esperar em cada classe.
export const CHAVE_CARACTERISTICAS = {
  'Bárbaro': 'Características de Classe', 'Bardo': 'Características de Classe',
  'Mago': 'Características de Classe',
  'Bruxo': 'Características', 'Clérigo': 'Características',
  'Druida': 'Características', 'Feiticeiro': 'Características',
  'Guardião': 'Características', 'Guerreiro': 'Características',
  'Ladino': 'Características', 'Monge': 'Características',
  'Paladino': 'Características',
};
```

- [ ] **Step 2: Transcrever as 20 linhas do Bárbaro como modelo**

```js
export const PROGRESSAO = {
  'Bárbaro': [
    { nivel: 1, bonusProficiencia: 2,
      caracteristicas: ['Defesa sem Armadura', 'Fúria', 'Maestria em Arma'],
      colunas: { 'Fúrias': '2', 'Dano da Fúria': '+2', 'Maestria em Arma': '2' },
      espacos: null },
    { nivel: 2, bonusProficiencia: 2,
      caracteristicas: ['Ataque Imprudente', 'Sentido de Perigo'],
      colunas: { 'Fúrias': '2', 'Dano da Fúria': '+2', 'Maestria em Arma': '2' },
      espacos: null },
    // ... níveis 3 a 20
  ],
};
```

Convenções, todas verificáveis pelo teste de schema da Task 4:
- `colunas` guarda **string**, exatamente como o JSON de dados grafa
  (`'+2'`, `'D6'`, `'—'`, `'2d6'`), porque é assim que a comparação da Task 4
  se faz sem conversão que possa mascarar diferença.
- `caracteristicas: []` quando a coluna do livro traz `—` (acontece no Bardo
  níveis 11, 13, 15, 17).
- `espacos: null` para as 4 classes sem conjuração. Para as 8 conjuradoras,
  `espacos` é um objeto só com os círculos que existem naquele nível:
  `{ '1': 2 }` no nível 1 do Bardo, `{ '1': 4, '2': 3, '3': 2 }` no nível 5.
  Círculo com `—` no livro **não entra** no objeto — é assim que
  `getEspacosMagia` (`utils.js:345-357`) se comporta, e a Task 5 compara com
  ela.

- [ ] **Step 3: Transcrever as 11 classes restantes**

Linhas das linhas de dados em `Informacoes Separadas/Classes.md` — medidas,
não estimadas pelo heading: Bárbaro 44-65, Bardo 375-396, Bruxo a partir de
851, **Clérigo 1513-1532**, **Druida 1999-2018**, Feiticeiro 2606,
Guardião 3249, **Guerreiro 3783-3802**, Ladino 4175, Mago 4557, Monge 5132,
**Paladino 5471-5493**.

**Quatro classes não têm a tabela onde o heading sugere** — confirme cada uma
abrindo o arquivo antes de transcrever:

- **Paladino**: a tabela fica sob `## Características de Paladino` (5469).
  `## Características de Classe de Paladino` (5495) abre a prosa.
- **Clérigo, Druida, Guerreiro**: a tabela vem **antes** do heading
  `## Características de Classe de X`, embutida na seção de regras de
  multiclasse. O heading (1534 / 2020 / 3804) marca o início da prosa, não da
  tabela.

Nessas quatro, procurar a tabela logo abaixo do heading leva a transcrever
descrição em vez de tabela.

Dois casos que exigem nota **no próprio catálogo**, senão viram lacuna falsa
ou parecem transcrição desleixada:

1. **Paladino, nível 1** (`Classes.md:5474`, a linha de dados da tabela). O
   livro escreve `Conjuração, Maestria em Arma. Mãos Consagradas` — ponto
   final onde deveria haver vírgula. São **três** características, não duas.
   Transcrever as três com um comentário citando a linha.
2. **Bruxo.** A tabela tem colunas 1-9 *e* as colunas `Espacos de Magia` /
   `Nivel do Espaco` (Magia de Pacto). Transcrever as duas coisas: `espacos`
   segue a convenção das outras conjuradoras, e as duas colunas de Magia de
   Pacto entram em `colunas` como qualquer outra.

- [ ] **Step 4: Conferir forma e volume**

Run (a partir da raiz):
```
node -e "import('./testes/regras/catalogo/classes.mjs').then(m => { const p = m.PROGRESSAO; console.log('classes:', Object.keys(p).length); console.log('linhas:', Object.values(p).flat().length); console.log('niveis fora de 1..20:', Object.entries(p).flatMap(([c,l]) => l.map((r,i) => r.nivel === i+1 ? null : c+':'+r.nivel).filter(Boolean))); })"
```

Expected: `classes: 12`, `linhas: 240`, `niveis fora de 1..20: []`

---

### Task 4: Motor estrutural — completude e as 240 linhas × `dados/`

**Risk:** low — testes novos sobre catálogo novo. Se falhar, a suspeita
principal é erro de transcrição da Task 3, não bug do app (ver Step 4).

**Files:**
- Create: `testes/regras/unidade/classes.test.mjs`

**Interfaces:**
- Consumes: `CITACOES`, `TRACOS_BASICOS`, `SUBCLASSES`, `PROGRESSAO`,
  `COLUNAS_POR_CLASSE`, `CHAVE_CARACTERISTICAS` (Tasks 2-3);
  `lerClassesDados`, `lerHeadingsClasses` (Task 1).
- Produces: nada consumido por outras tarefas.

- [ ] **Step 1: Cabeçalho e bijeção**

```js
// ============================================================
// Motor estrutural do domínio classes/níveis: o catálogo transcrito
// do livro confrontado contra as DUAS fontes de verdade do app
// (dados/classes/*.json e site/js/dados-classes.js) e contra as
// funções puras que leem a tabela e decidem o que cada nível exige.
//
// O confronto COMPORTAMENTAL ("o app aplica isso a um personagem que
// sobe de nível?") vive em classes-progressao.test.mjs, não aqui.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CITACOES, TRACOS_BASICOS, SUBCLASSES, PROGRESSAO,
  COLUNAS_POR_CLASSE, CHAVE_CARACTERISTICAS,
} from '../catalogo/classes.mjs';
import { lerClassesDados, lerHeadingsClasses, modulosApp } from './harness.mjs';

const dados = lerClassesDados();
const headings = lerHeadingsClasses();
const CLASSES = Object.keys(PROGRESSAO);

test('as 12 classes do catálogo existem em dados/classes/', () => {
  const faltam = CLASSES.filter((c) => !dados.has(c));
  assert.deepEqual(faltam, [], `sem arquivo em dados/classes/: ${faltam.join(', ')}`);
});

test('toda classe de dados/classes/ tem entrada no catálogo (sem órfãos)', () => {
  const orfaos = [...dados.keys()].filter((c) => !PROGRESSAO[c]);
  assert.deepEqual(orfaos, [], `órfãos: ${orfaos.join(', ')}`);
});

test('o catálogo cobre exatamente 12 classes × 20 níveis', () => {
  assert.equal(CLASSES.length, 12);
  for (const classe of CLASSES) {
    assert.deepEqual(PROGRESSAO[classe].map((l) => l.nivel),
      Array.from({ length: 20 }, (_, i) => i + 1),
      `${classe}: níveis fora de 1..20 ou faltando`);
  }
});
```

- [ ] **Step 2: Schema e citação, uma por classe**

```js
for (const classe of CLASSES) {
  test(`schema e citação: ${classe}`, () => {
    assert.match(CITACOES[classe] || '', /^Classes\.md §.+/,
      'citação ausente ou fora do formato');
    const titulo = CITACOES[classe].replace('Classes.md §', '');
    assert.ok(headings.has(titulo),
      `citação quebrada: "${titulo}" não é heading de Classes.md`);

    const t = TRACOS_BASICOS[classe];
    assert.ok(Number.isInteger(t.dadoVida) && [6, 8, 10, 12].includes(t.dadoVida),
      'dadoVida deve ser 6, 8, 10 ou 12');
    assert.ok(Array.isArray(t.salvaguardas) && t.salvaguardas.length === 2,
      'salvaguardas deve ter exatamente 2 atributos');
    assert.ok(Number.isInteger(t.numPericias) && t.numPericias >= 2,
      'numPericias deve ser inteiro >= 2');
    assert.ok(t.periciasOpcoes === null
      || (Array.isArray(t.periciasOpcoes) && t.periciasOpcoes.length >= t.numPericias),
      'periciasOpcoes deve ser null ou lista com pelo menos numPericias opções');
    assert.equal(typeof t.conjurador, 'boolean', 'conjurador deve ser boolean');
    assert.equal(t.conjurador, t.atributoConjuracao !== null,
      'conjurador e atributoConjuracao devem concordar');

    assert.equal(SUBCLASSES[classe].length, 4, 'toda classe tem 4 subclasses');

    for (const linha of PROGRESSAO[classe]) {
      assert.ok(Number.isInteger(linha.bonusProficiencia),
        `nv${linha.nivel}: bonusProficiencia deve ser inteiro`);
      assert.ok(Array.isArray(linha.caracteristicas),
        `nv${linha.nivel}: caracteristicas deve ser array`);
      assert.deepEqual(Object.keys(linha.colunas).sort(),
        [...COLUNAS_POR_CLASSE[classe]].sort(),
        `nv${linha.nivel}: colunas divergem de COLUNAS_POR_CLASSE`);
      for (const v of Object.values(linha.colunas)) {
        assert.equal(typeof v, 'string',
          `nv${linha.nivel}: valor de coluna deve ser string`);
      }
      // espacos: null só para as 4 classes sem conjuração. Um objeto
      // vazio significaria "conjura, mas não tem espaço neste nível" --
      // estado que nenhuma classe do livro tem, e que mascararia uma
      // transcrição incompleta se fosse aceito no lugar de null.
      if (t.conjurador) {
        assert.ok(linha.espacos && typeof linha.espacos === 'object',
          `nv${linha.nivel}: classe conjuradora exige objeto espacos`);
      } else {
        assert.equal(linha.espacos, null,
          `nv${linha.nivel}: classe não-conjuradora exige espacos null`);
      }
    }
  });
}
```

- [ ] **Step 3: Os 48 nomes de subclasse × `dados/`**

```js
for (const classe of CLASSES) {
  test(`subclasses de ${classe} batem com dados/classes/`, () => {
    const nosDados = (dados.get(classe).subclasses || []).map((s) => s.nome).sort();
    assert.deepEqual([...SUBCLASSES[classe]].sort(), nosDados,
      `${classe}: nomes de subclasse divergem`);
  });
}
```

- [ ] **Step 4: As 240 linhas, coluna a coluna**

```js
for (const classe of CLASSES) {
  const tabela = dados.get(classe).tabela_caracteristicas;
  const chaveCaract = CHAVE_CARACTERISTICAS[classe];

  for (const linha of PROGRESSAO[classe]) {
    test(`tabela: ${classe} nível ${linha.nivel}`, () => {
      const row = tabela.find((r) => parseInt(r['Nível'], 10) === linha.nivel);
      assert.ok(row, `dados/classes/ não tem linha do nível ${linha.nivel}`);

      assert.equal(row['Bônus de Proficiência'], `+${linha.bonusProficiencia}`,
        'Bônus de Proficiência divergente');

      // A coluna de características do livro é uma string separada por
      // vírgula; o catálogo guarda a lista. Compara-se a lista contra a
      // string dividida, não a string inteira, para a falha dizer QUAL
      // característica divergiu em vez de despejar as duas frases.
      const doDados = (row[chaveCaract] === '—' || row[chaveCaract] === '-')
        ? [] : String(row[chaveCaract]).split(',').map((c) => c.trim()).filter(Boolean);
      assert.deepEqual(doDados, linha.caracteristicas,
        'características divergentes');

      for (const [coluna, valor] of Object.entries(linha.colunas)) {
        assert.equal(String(row[coluna]), valor, `coluna "${coluna}" divergente`);
      }

      if (linha.espacos !== null) {
        const nosDados = {};
        for (let c = 1; c <= 9; c++) {
          const v = row[String(c)];
          if (v && v !== '—' && v !== '-') nosDados[String(c)] = parseInt(v, 10);
        }
        assert.deepEqual(nosDados, linha.espacos, 'espaços de magia divergentes');
      }
    });
  }
}
```

- [ ] **Step 5: Rodar, e classificar cada falha antes de registrar qualquer lacuna**

Run (a partir de `testes/e2e/`): `npm run test:regras:unidade`

Se houver falhas, **não registrar lacuna ainda**. Aplicar a regra do guia
(erro 6): falhas em leva grande apontam para o próprio código de teste ou
para a transcrição, não para 240 bugs. Para cada falha:

1. Reabrir a linha correspondente em `Classes.md` e reler a célula.
2. Se o catálogo estiver errado → corrigir o catálogo, não registrar lacuna.
3. Se o livro e `dados/` realmente discordarem → registrar lacuna na Task 10,
   com o `motivo` citando `Classes.md:<linha>` **e**
   `dados/classes/<arquivo>.json` (classe + nível + coluna).

Expected ao fim do passo: todas as falhas remanescentes explicadas por
escrito, uma a uma.

---

### Task 5: Motor estrutural — `CLASSES_INFO`, funções de tabela e HP

**Risk:** medium — é o primeiro confronto de `CLASSES_INFO` com o livro. Uma
divergência aqui é alegação sobre `site/js/dados-classes.js`, um arquivo do
qual dependem `calcPVNivel1`, `calcPVTotal`, `calcCDMagia` e `calcAtaqueMagia`.

**Files:**
- Modify: `testes/regras/unidade/classes.test.mjs`

**Interfaces:**
- Consumes: tudo da Task 4, mais `modulosApp()` (chaves `utils`,
  `dadosClasses`, `levelup`).
- Produces: nada.

- [ ] **Step 1: `CLASSES_INFO` × traços básicos do livro**

```js
const { utils, dadosClasses, levelup } = await modulosApp();
const { CLASSES_INFO } = dadosClasses;

// site/js/dados-classes.js é a SEGUNDA fonte de verdade do app para os
// mesmos fatos que dados/classes/*.json → tracos_basicos já guarda em
// prosa. Até este domínio, nenhuma das duas era confrontada com o livro,
// nem uma com a outra. CLASSES_INFO alimenta calcPVNivel1/calcPVTotal
// (utils.js) e calcCDMagia/calcAtaqueMagia — um valor errado aqui
// propaga para a ficha inteira.
for (const classe of CLASSES) {
  test(`CLASSES_INFO × livro: ${classe}`, () => {
    const info = CLASSES_INFO[classe];
    assert.ok(info, `CLASSES_INFO não tem entrada para ${classe}`);
    const t = TRACOS_BASICOS[classe];

    assert.equal(info.dado_vida, t.dadoVida, 'dado de vida divergente');
    assert.equal(info.atributo_primario, t.atributoPrimario,
      'atributo primário divergente');
    assert.deepEqual([...(info.salvaguardas || [])].sort(),
      [...t.salvaguardas].sort(), 'salvaguardas divergentes');
    assert.equal(info.num_pericias, t.numPericias, 'nº de perícias divergente');
    assert.deepEqual(
      info.pericias_opcoes === null ? null : [...info.pericias_opcoes].sort(),
      t.periciasOpcoes === null ? null : [...t.periciasOpcoes].sort(),
      'lista de perícias divergente');
    assert.deepEqual([...(info.armaduras || [])].sort(), [...t.armaduras].sort(),
      'treinamento com armadura divergente');
    assert.deepEqual([...(info.armas || [])].sort(), [...t.armas].sort(),
      'proficiência com armas divergente');
    assert.equal(info.conjurador, t.conjurador, 'flag conjurador divergente');
    assert.equal(info.atributo_conjuracao ?? null, t.atributoConjuracao,
      'atributo de conjuração divergente');
  });
}

test('CLASSES_INFO não tem classe além das 12 do livro', () => {
  const extras = Object.keys(CLASSES_INFO).filter((c) => !PROGRESSAO[c]);
  assert.deepEqual(extras, [], `classes desconhecidas: ${extras.join(', ')}`);
});
```

- [ ] **Step 2: `getEspacosMagia` / `getTruquesConhecidos` / `getMagiaPreparadas`**

```js
// Varredura 12 × 20 das três funções que leem a tabela de classe.
// O esperado vem do CATÁLOGO (o livro), nunca da própria tabela que a
// função lê -- senão o teste comparava o app consigo mesmo.
for (const classe of CLASSES) {
  const tabela = dados.get(classe).tabela_caracteristicas;

  test(`getEspacosMagia × livro: ${classe} (20 níveis)`, () => {
    for (const linha of PROGRESSAO[classe]) {
      const obtido = utils.getEspacosMagia(tabela, linha.nivel);
      const esperado = {};
      for (const [circulo, total] of Object.entries(linha.espacos || {})) {
        esperado[circulo] = { total, usados: 0 };
      }
      assert.deepEqual(obtido, esperado, `${classe} nv${linha.nivel}`);
    }
  });

  test(`getTruquesConhecidos e getMagiaPreparadas × livro: ${classe}`, () => {
    for (const linha of PROGRESSAO[classe]) {
      // parseInt('—') é NaN e a função devolve 0 nesse caso; o catálogo
      // guarda a string do livro, então a conversão é feita aqui, no
      // esperado, com a mesma semântica -- e explicitamente, não por
      // acidente de coerção.
      const paraNumero = (v) => (v === undefined || v === '—' || v === '-')
        ? 0 : (parseInt(v, 10) || 0);
      assert.equal(utils.getTruquesConhecidos(tabela, linha.nivel),
        paraNumero(linha.colunas['Truques']),
        `${classe} nv${linha.nivel}: truques`);
      assert.equal(utils.getMagiaPreparadas(tabela, linha.nivel),
        paraNumero(linha.colunas['Magias Preparadas']),
        `${classe} nv${linha.nivel}: magias preparadas`);
    }
  });
}
```

- [ ] **Step 3: `calcularHPGanho` × dado de vida do livro**

```js
// A regra de PV dos níveis seguintes (metade do dado + 1 + mod. CON,
// mínimo 1) já foi confrontada com Criação de Personagens.md:497-510
// pelo domínio de regras transversais. O que se confronta AQUI é outra
// coisa: que calcularHPGanho use o dado de vida que o LIVRO dá a cada
// classe -- ele lê CLASSES_INFO, não a tabela.
for (const classe of CLASSES) {
  test(`calcularHPGanho usa o dado de vida do livro: ${classe}`, () => {
    const dadoVida = TRACOS_BASICOS[classe].dadoVida;
    for (let modCon = -5; modCon <= 10; modCon++) {
      const esperado = Math.max(1, Math.floor(dadoVida / 2) + 1 + modCon);
      assert.equal(levelup.calcularHPGanho(classe, modCon), esperado,
        `${classe} com mod. CON ${modCon}`);
    }
  });
}
```

- [ ] **Step 4: `obterCaracteristicasNivel` × catálogo**

```js
for (const classe of CLASSES) {
  test(`obterCaracteristicasNivel × livro: ${classe} (20 níveis)`, async () => {
    for (const linha of PROGRESSAO[classe]) {
      const obtido = await levelup.obterCaracteristicasNivel(classe, linha.nivel);
      assert.deepEqual(obtido, linha.caracteristicas,
        `${classe} nv${linha.nivel}`);
    }
  });
}
```

- [ ] **Step 5: Rodar e classificar**

Run (a partir de `testes/e2e/`): `npm run test:regras:unidade`

Mesma disciplina da Task 4 Step 5: falha em `CLASSES_INFO` é forte candidata
a lacuna real (duas fontes de verdade divergindo é exatamente o que este
confronto existe para achar), mas ainda assim relê-se a tabela do livro antes
de registrar. Anotar cada falha com classe, campo, valor do livro e valor do
app.

---

### Task 6: Motor estrutural — gatilhos de escolha × coluna do livro

**Risk:** medium — oito funções de `levelup.js` decidem o que cada nível
exige por listas hard-coded que nada confronta hoje. É o confronto de maior
retorno do motor estrutural, e o mais provável de produzir lacuna.

**Files:**
- Modify: `testes/regras/catalogo/classes.mjs`
- Modify: `testes/regras/unidade/classes.test.mjs`

**Interfaces:**
- Consumes: `PROGRESSAO` (Task 3), `modulosApp().levelup` (Task 1).
- Produces: `ROTULOS_GATILHO: Record<string, (c: string) => RegExp>` em
  `catalogo/classes.mjs` — para cada gatilho, o rótulo que a coluna
  "Características de Classe" do livro usa.

- [ ] **Step 1: Declarar os rótulos no catálogo, com citação**

O nome da função do app e o rótulo do livro nem sempre coincidem. O
mapeamento fica **declarado no catálogo**, com citação — nunca num
`includes()` improvisado dentro do teste.

```js
// Rótulo que a coluna "Características de Classe" do livro usa para cada
// escolha que o app impõe por função própria em levelup.js. Cada função
// lá decide por uma LISTA HARD-CODED de níveis, independente desta
// tabela (concedeAumentoAtributo em levelup.js:399, exigeSubclasse:421,
// exigeEspecializacaoBardo:444, exigeEspecializacaoGuardiao:451,
// exigeEstiloLuta:458, exigeExploradorHabil:482, exigeAcademico:489,
// exigeDadivaEpica:70) -- este mapa é o que permite confrontar as listas
// com a tabela pela primeira vez.
//
// O valor é uma função (classe) => RegExp porque o rótulo de subclasse
// varia com o nome da classe ("Subclasse Bárbaro", "Subclasse de Bardo").
export const ROTULOS_GATILHO = {
  aumentoAtributo: () => /^Aumento no Valor de Atributo$/,
  subclasse: (classe) => new RegExp(`^Subclasse (de )?${classe}$`),
  dadivaEpica: () => /^Dádiva Épica$/,
  // Bardo nv2 "Especialista" e nv9 "Especialização" são a MESMA escolha
  // do ponto de vista do app (exigeEspecializacaoBardo cobre os dois),
  // com dois rótulos diferentes no livro.
  especializacaoBardo: () => /^(Especialista|Especialização)$/,
  especializacaoGuardiao: () => /^Especialista$/,
  estiloLuta: () => /^Estilo de Luta$/,
  exploradorHabil: () => /^Explorador Hábil$/,
  academico: () => /^Acadêmico$/,
};
```

- [ ] **Step 2: Escrever o confronto genérico**

```js
import { ROTULOS_GATILHO } from '../catalogo/classes.mjs';

// Para cada gatilho: o ESPERADO é "o livro lista este rótulo na coluna de
// características deste nível", e o OBSERVADO é o que a função de
// levelup.js responde. Nenhum dos dois lados vem da tabela do app.
const GATILHOS = [
  { nome: 'concedeAumentoAtributo', rotulo: ROTULOS_GATILHO.aumentoAtributo,
    fn: (classe, nivel) => levelup.concedeAumentoAtributo(classe, nivel) },
  { nome: 'exigeSubclasse', rotulo: ROTULOS_GATILHO.subclasse,
    fn: (classe, nivel) => levelup.exigeSubclasse(classe, nivel) },
  { nome: 'exigeDadivaEpica', rotulo: ROTULOS_GATILHO.dadivaEpica,
    fn: (classe, nivel) => levelup.exigeDadivaEpica(classe, nivel) },
  { nome: 'exigeEspecializacaoBardo', rotulo: ROTULOS_GATILHO.especializacaoBardo,
    fn: (classe, nivel) => levelup.exigeEspecializacaoBardo(classe, nivel),
    apenas: ['Bardo'] },
  { nome: 'exigeEspecializacaoGuardiao', rotulo: ROTULOS_GATILHO.especializacaoGuardiao,
    fn: (classe, nivel) => levelup.exigeEspecializacaoGuardiao(classe, nivel),
    apenas: ['Guardião'] },
  { nome: 'exigeEstiloLuta', rotulo: ROTULOS_GATILHO.estiloLuta,
    fn: (classe, nivel) => levelup.exigeEstiloLuta(classe, nivel) },
  { nome: 'exigeExploradorHabil', rotulo: ROTULOS_GATILHO.exploradorHabil,
    fn: (classe, nivel) => levelup.exigeExploradorHabil(classe, nivel),
    apenas: ['Guardião'] },
  { nome: 'exigeAcademico', rotulo: ROTULOS_GATILHO.academico,
    fn: (classe, nivel) => levelup.exigeAcademico(classe, nivel),
    apenas: ['Mago'] },
];

for (const gatilho of GATILHOS) {
  for (const classe of CLASSES) {
    test(`${gatilho.nome} × livro: ${classe} (20 níveis)`, () => {
      const regex = gatilho.rotulo(classe);
      for (const linha of PROGRESSAO[classe]) {
        // `apenas` não é atalho de escape: para as classes fora da lista,
        // o esperado é FALSE em todos os 20 níveis, e isso é afirmado --
        // um gatilho que disparasse na classe errada seria pego aqui.
        const noLivro = (gatilho.apenas && !gatilho.apenas.includes(classe))
          ? false
          : linha.caracteristicas.some((c) => regex.test(c));
        assert.equal(gatilho.fn(classe, linha.nivel), noLivro,
          `${gatilho.nome}(${classe}, ${linha.nivel}): livro diz ${noLivro}`);
      }
    });
  }
}
```

- [ ] **Step 3: Manobras do Mestre da Batalha**

`exigeManobrasGuerreiro` e `getQuantidadeNovasManobras` não seguem a coluna de
características da classe — a quantidade vem do texto da subclasse Mestre da
Batalha. Confrontar contra o livro, citando a seção:

```js
// Mestre da Batalha (Classes.md, seção "# Subclasses de Guerreiro"):
// a subclasse concede manobras nos níveis 3, 7, 10 e 15 -- 3 no nível 3
// e 2 em cada um dos outros. Transcrito da seção da subclasse, não da
// coluna de características do Guerreiro, que não traz esse número.
const MANOBRAS_POR_NIVEL = { 3: 3, 7: 2, 10: 2, 15: 2 };

test('exigeManobrasGuerreiro × livro (Mestre da Batalha, 20 níveis)', () => {
  for (let nivel = 1; nivel <= 20; nivel++) {
    const esperado = MANOBRAS_POR_NIVEL[nivel] !== undefined;
    assert.equal(
      levelup.exigeManobrasGuerreiro('Guerreiro', 'Mestre da Batalha', nivel),
      esperado, `Mestre da Batalha nv${nivel}`);
    // Outra subclasse de Guerreiro nunca exige manobra
    assert.equal(
      levelup.exigeManobrasGuerreiro('Guerreiro', 'Campeão', nivel), false,
      `Campeão nv${nivel} não deveria exigir manobras`);
    // Outra classe nunca exige manobra
    assert.equal(
      levelup.exigeManobrasGuerreiro('Bárbaro', 'Mestre da Batalha', nivel), false,
      `Bárbaro nv${nivel} não deveria exigir manobras`);
  }
});

test('getQuantidadeNovasManobras × livro (20 níveis)', () => {
  for (let nivel = 1; nivel <= 20; nivel++) {
    assert.equal(levelup.getQuantidadeNovasManobras(nivel),
      MANOBRAS_POR_NIVEL[nivel] ?? 0, `nível ${nivel}`);
  }
});
```

Antes de escrever `MANOBRAS_POR_NIVEL`, **ler a seção Mestre da Batalha em
`Classes.md`** e confirmar os quatro níveis e as quantidades. Se o livro
disser outra coisa, o catálogo segue o livro e a divergência vira lacuna.

- [ ] **Step 4: Rodar e classificar**

Run (a partir de `testes/e2e/`): `npm run test:regras:unidade`

Falhas aqui são as mais prováveis do motor estrutural. Para cada uma, o
`motivo` da lacuna (Task 10) cita a linha da função em `site/js/levelup.js`
**e** a linha da tabela em `Classes.md`.

---

### Task 7: Driver `escadaDeNivel()` no harness

**Risk:** high — um driver que engula uma pendência não tratada faz todo o
motor comportamental passar testando um personagem que parou no nível 3. É
exatamente o erro 3 do guia ("testes verdes que não afirmam nada"), na sua
forma mais cara.

**Files:**
- Modify: `testes/regras/unidade/harness.mjs`

`harness.mjs` passa a importar `TRACOS_BASICOS` de `../catalogo/classes.mjs`
(usado por `personagemSemente`). É a primeira vez que o harness depende de um
catálogo; a alternativa — semear a fixture com `CLASSES_INFO` — faria a
fixture nascer da mesma fonte que o motor estrutural está confrontando.

**Interfaces:**
- Consumes: `modulosApp()` (Task 1), `TRACOS_BASICOS` (Task 2).
- Produces:
  - `PENDENCIAS_CONHECIDAS: string[]` — os 15 valores de `tipo_pendencia`.
  - `escadaDeNivel(classe, aoSubir, opcoesEscada?): Promise<object>` — sobe um
    personagem da classe do nível 1 ao 20, chamando
    `aoSubir(personagem, nivel, pendenciasDoNivel)` depois de cada subida
    bem-sucedida, onde `pendenciasDoNivel` é o array de `tipo_pendencia` que o
    app exigiu naquele nível. `opcoesEscada.subclasse` força uma subclasse
    específica (padrão: a primeira de `dados/`). Lança se uma pendência não
    for resolvida.
  - `personagemSemente(classe): Promise<object>` — a fixture por classe.

- [ ] **Step 1: Registrar os 15 tipos de pendência**

```js
// Os 15 valores de `tipo_pendencia` que subirDeNivel (site/js/levelup.js,
// linhas 948-1187) pode devolver. A lista é explícita, e o driver abaixo
// LANÇA ao ver um tipo fora dela: se o app ganhar uma pendência nova, o
// motor comportamental precisa parar e alguém precisa decidir a escolha
// canônica -- um `default` mudo faria o personagem parar de subir e os
// testes continuarem verdes sobre um nível que nunca foi alcançado.
export const PENDENCIAS_CONHECIDAS = [
  'subclasse', 'dadiva_epica', 'aumento_atributo', 'talento_asi',
  'dadiva_proficiencia_pericia', 'dadiva_resistencia_energia',
  'escolhas_talento', 'bardo_expertise', 'guardiao_expertise',
  'estilo_luta', 'explorador_habil', 'manobras_guerreiro', 'grimorio',
  'subclasse_magias_arcana', 'academico',
];
```

- [ ] **Step 2: Escrever a fixture por classe**

```js
// Personagem-semente de cada classe. Diferente de charBase() (fixture
// genérica dos motores de talentos), aqui a fixture precisa satisfazer os
// pré-requisitos do LIVRO da classe sob teste -- erro 5 do
// GUIA-PROXIMOS-DOMINIOS.md: atributos 10 fazem escolhas sumirem da tela
// e o teste passa verde sem testar nada. Atributo primário alto e quatro
// perícias proficientes (as escolhas de Especialização exigem
// proficiência prévia).
export async function personagemSemente(classe) {
  const { store } = await modulosApp();
  const p = store.criarPersonagemVazio();
  p.classe = classe;
  p.nivel = 1;
  p.atributos = {
    forca: 15, destreza: 15, constituicao: 14,
    inteligencia: 15, sabedoria: 15, carisma: 15,
  };
  p.atributos_base = { ...p.atributos };
  p.pericias_proficientes = ['Atletismo', 'Percepção', 'Arcanismo', 'História'];
  // PV de nível 1 = dado de vida cheio + mod. CON (+2 com Constituição 14),
  // e o dado de vida vem do CATÁLOGO (o livro), não de CLASSES_INFO. Se
  // CLASSES_INFO divergir do livro -- exatamente o que o motor estrutural
  // procura --, semear a fixture com ele faria o motor comportamental
  // falhar no PV de toda a escada, escondendo a causa real atrás de 19
  // níveis de erro acumulado.
  p.pv_max = TRACOS_BASICOS[classe].dadoVida + 2;
  p.pv_atual = p.pv_max;
  return p;
}
```

- [ ] **Step 3: Escrever o driver**

```js
// Sobe um personagem da classe do nível 1 ao 20 chamando subirDeNivel de
// verdade, resolvendo cada pendência com uma escolha canônica. Depois de
// cada subida bem-sucedida chama aoSubir(personagem, nivel, pendencias)
// -- é onde o motor comportamental faz suas asserções, e `pendencias` é a
// lista de tipo_pendencia que o app EXIGIU naquele nível (o motor
// confronta essa lista contra a tabela do livro).
//
// `opcoesEscada.subclasse` força uma subclasse específica; por padrão a
// escada usa a primeira de dados/classes/, o que deixa duas pendências
// fora do caminho (ver Step 6 desta tarefa).
//
// Falha ALTO E CLARO em quatro situações, todas as que fariam um teste
// passar sem afirmar nada: pendência de tipo desconhecido, pendência que
// se repete depois de resolvida (a escolha canônica não serviu), nível
// que não sobe depois do limite de tentativas, e nível do personagem
// diferente do esperado apesar de `sucesso: true`.
export async function escadaDeNivel(classe, aoSubir, opcoesEscada = {}) {
  const { levelup, db } = await modulosApp();
  const classeData = await db.getClasse(classe);
  const personagem = await personagemSemente(classe);
  const subclasseAlvo = opcoesEscada.subclasse || classeData.subclasses[0].nome;
  const ATRIBUTOS = ['forca', 'destreza', 'constituicao',
                     'inteligencia', 'sabedoria', 'carisma'];

  for (let nivel = 2; nivel <= 20; nivel++) {
    personagem.xp = levelup.XP_POR_NIVEL[nivel];
    const opcoes = {};
    const vistas = new Set();
    let resultado = null;

    for (let tentativa = 0; tentativa <= PENDENCIAS_CONHECIDAS.length; tentativa++) {
      resultado = await levelup.subirDeNivel(personagem, opcoes);
      if (resultado.sucesso) break;
      if (!resultado.pendente) {
        throw new Error(`${classe} nv${nivel}: subirDeNivel falhou sem pendência: ` +
          `${resultado.erro ?? JSON.stringify(resultado)}`);
      }
      const tipo = resultado.tipo_pendencia;
      if (!PENDENCIAS_CONHECIDAS.includes(tipo)) {
        throw new Error(`${classe} nv${nivel}: tipo_pendencia desconhecido ` +
          `"${tipo}" — acrescente-o a PENDENCIAS_CONHECIDAS e defina a ` +
          `escolha canônica em escadaDeNivel`);
      }
      if (vistas.has(tipo)) {
        throw new Error(`${classe} nv${nivel}: pendência "${tipo}" reapareceu ` +
          `depois de resolvida — a escolha canônica não foi aceita: ` +
          `${resultado.mensagem}`);
      }
      vistas.add(tipo);
      await resolverPendencia(tipo, opcoes, personagem, classeData,
        ATRIBUTOS, levelup, subclasseAlvo, nivel);
    }

    if (!resultado?.sucesso) {
      throw new Error(`${classe} nv${nivel}: não subiu — ` +
        `${JSON.stringify(resultado)}`);
    }
    if (personagem.nivel !== nivel) {
      throw new Error(`${classe}: subirDeNivel disse sucesso mas o nível é ` +
        `${personagem.nivel}, esperado ${nivel}`);
    }
    await aoSubir(personagem, nivel, [...vistas]);
  }
  return personagem;
}
```

- [ ] **Step 4: Escrever `resolverPendencia`, um ramo por tipo**

```js
// Escolha canônica de cada pendência. Nenhum `default` mudo: um tipo sem
// ramo cai no `throw` final, e escadaDeNivel já barrou os desconhecidos
// antes de chegar aqui.
async function resolverPendencia(tipo, opcoes, p, classeData, ATRIBUTOS,
                                 levelup, subclasseAlvo, nivel) {
  const primeiroAtributoAbaixoDe20 = () =>
    ATRIBUTOS.find((a) => (p.atributos[a] ?? 10) <= 18) || 'constituicao';

  switch (tipo) {
    case 'subclasse':
      opcoes.subclasse = subclasseAlvo;
      return;
    case 'aumento_atributo':
    case 'talento_asi':
      opcoes.talento = 'Aumento no Valor de Atributo';
      opcoes.aumentos_atributo = { [primeiroAtributoAbaixoDe20()]: 2 };
      return;
    case 'dadiva_epica':
      // Talento de Dádiva Épica aceito pelo app na recuperação; o
      // atributo acompanha porque a Dádiva também concede +1.
      opcoes.talento = 'Dádiva do Aumento no Valor de Atributo';
      opcoes.talento_asi = primeiroAtributoAbaixoDe20();
      return;
    case 'dadiva_proficiencia_pericia':
      opcoes.dadiva_proficiencia_pericia = 'Atletismo';
      return;
    case 'dadiva_resistencia_energia':
      opcoes.dadiva_resistencia_energia = ['Ácido', 'Gélido'];
      return;
    case 'escolhas_talento':
      opcoes.escolhas_talento = {};
      return;
    case 'bardo_expertise':
      opcoes.bardo_expertise = ['Atletismo', 'Percepção'];
      return;
    case 'guardiao_expertise':
      opcoes.guardiao_expertise = ['Atletismo', 'Percepção'];
      return;
    case 'estilo_luta':
      opcoes.estilo_luta = 'Defensivo';
      return;
    case 'explorador_habil':
      opcoes.explorador_expertise = 'Atletismo';
      return;
    case 'manobras_guerreiro':
      opcoes.manobras_novas = escolherManobras(p, classeData,
        levelup.getQuantidadeNovasManobras(nivel));
      return;
    case 'grimorio':
      opcoes.grimorio_selecionados = await escolherMagiasMago(p, classeData, nivel);
      return;
    case 'subclasse_magias_arcana':
      opcoes.subclasse_magias_selecionadas =
        await escolherMagiasMago(p, classeData, nivel);
      return;
    case 'academico':
      opcoes.academico_expertise = ['Arcanismo'];
      return;
  }
  throw new Error(`resolverPendencia sem ramo para "${tipo}"`);
}
```

Os dois helpers, no mesmo arquivo. O formato de cada um foi lido em
`site/js/levelup.js:1080-1140`, não suposto:

```js
// Manobras novas do Mestre da Batalha. subirDeNivel (levelup.js:1087) só
// confere a QUANTIDADE (`novasManobras.length !== qtdNova`), não os nomes
// — ainda assim a escada escolhe nomes reais de
// subclasses[].opcoes_manobra, para não gravar lixo no personagem que as
// asserções depois leem.
function escolherManobras(p, classeData, quantidade) {
  const mestre = (classeData.subclasses || [])
    .find((sc) => sc.nome === 'Mestre da Batalha');
  const disponiveis = (mestre?.opcoes_manobra || [])
    .filter((m) => !(p.manobras_conhecidas || []).includes(m));
  if (disponiveis.length < quantidade) {
    throw new Error(`manobras insuficientes em dados/: precisa de ` +
      `${quantidade}, restam ${disponiveis.length}`);
  }
  return disponiveis.slice(0, quantidade);
}

// Duas magias de Mago para o grimório. subirDeNivel (levelup.js:1109-1120)
// exige EXATAMENTE 2, distintas, presentes em dados/magias/_indice.json
// com 'Mago' em `classes`, de círculo > 0 para o qual o personagem terá
// espaço no novo nível, e ainda ausentes do grimório. Reproduzir esses
// cinco filtros aqui é o que impede a escada de travar num nível qualquer
// com uma mensagem genérica.
async function escolherMagiasMago(p, classeData, novoNivel) {
  const { utils } = await modulosApp();
  const indice = JSON.parse(readFileSync(
    resolve(RAIZ, 'dados/magias/_indice.json'), 'utf-8'));
  const espacos = utils.getEspacosMagia(classeData.tabela_caracteristicas, novoNivel);
  const jaNoGrimorio = new Set((p.grimorio || []).map((m) => m?.nome));
  const candidatas = (indice?.magias || []).filter((m) =>
    Array.isArray(m.classes) && m.classes.includes('Mago') &&
    m.circulo > 0 && (espacos[m.circulo]?.total || 0) > 0 &&
    !jaNoGrimorio.has(m.nome));
  if (candidatas.length < 2) {
    throw new Error(`magias de Mago insuficientes no nível ${novoNivel}: ` +
      `${candidatas.length} candidatas`);
  }
  return [candidatas[0].nome, candidatas[1].nome];
}
```

- [ ] **Step 5: Provar que a escada chega ao 20 nas 12 classes**

Criar `testes/regras/unidade/_spike-escada.mjs` (temporário):

```js
import { escadaDeNivel } from './harness.mjs';
const CLASSES = ['Bárbaro','Bardo','Bruxo','Clérigo','Druida','Feiticeiro',
                 'Guardião','Guerreiro','Ladino','Mago','Monge','Paladino'];
for (const classe of CLASSES) {
  try {
    const p = await escadaDeNivel(classe, () => {});
    console.log(classe.padEnd(11), 'OK nível', p.nivel, '| pv_max', p.pv_max);
  } catch (e) {
    console.log(classe.padEnd(11), 'FALHOU:', e.message);
  }
}
```

Run (a partir da raiz): `node testes/regras/unidade/_spike-escada.mjs`

Expected: as 12 linhas com `OK nível 20`. Qualquer `FALHOU` é trabalho desta
tarefa, **não** uma lacuna do app — a escada é código de teste. Iterar até as
12 passarem.

- [ ] **Step 6: Medir quais das 15 pendências a escada realmente exercitou**

A escada escolhe `subclasses[0]` de cada classe, e isso decide o que ela
alcança. Guerreiro `subclasses[0]` é `Campeão`, então `manobras_guerreiro`
**nunca dispara** no caminho padrão. Deixar isso implícito seria um "cap
silencioso": a lista de 15 pareceria coberta quando não está.

Acrescentar ao spike a contagem, antes de apagá-lo:

```js
const exercitadas = new Set();
for (const classe of CLASSES) {
  await escadaDeNivel(classe, (p, nivel, pendencias) =>
    pendencias.forEach((t) => exercitadas.add(t)));
}
console.log('exercitadas:', [...exercitadas].sort().join(', '));
console.log('NÃO exercitadas:',
  PENDENCIAS_CONHECIDAS.filter((t) => !exercitadas.has(t)).sort().join(', '));
```

Para cada tipo **não** exercitado, decidir e registrar por escrito no
relatório da tarefa:
- se um segundo passe da escada com outra subclasse o alcança — usar
  `escadaDeNivel('Guerreiro', cb, { subclasse: 'Mestre da Batalha' })`, que é
  para isso que `opcoesEscada.subclasse` existe;
- ou se o tipo é inalcançável neste domínio (ex.: pendências de talento como
  `dadiva_proficiencia_pericia`, que dependem do talento escolhido no ASI e já
  têm motor próprio em `unidade/`), e então o ramo em `resolverPendencia`
  fica como defesa contra mudança futura, com essa razão no comentário.

Nenhum tipo pode ficar sem uma das duas respostas escritas.

- [ ] **Step 7: Rodar a suíte e apagar o spike**

Run (a partir de `testes/e2e/`): `npm run test:regras:unidade`
Expected: os motores existentes seguem no mesmo total; nada novo quebra.

Depois: `rm testes/regras/unidade/_spike-escada.mjs`

---

### Task 8: Motor comportamental — a subida 1→20 confrontada nível a nível

**Risk:** high — é a asserção central do domínio. Um seletor errado ou uma
comparação frouxa aqui produz 12 testes verdes que não afirmam nada.

**Files:**
- Create: `testes/regras/unidade/classes-progressao.test.mjs`

**Interfaces:**
- Consumes: `escadaDeNivel` (Task 7), `PROGRESSAO`/`TRACOS_BASICOS` (Tasks 2-3).
- Produces: nada.

- [ ] **Step 1: Cabeçalho e o teste por classe**

```js
// ============================================================
// Motor comportamental do domínio classes/níveis: sobe um personagem
// de cada classe do nível 1 ao 20 chamando subirDeNivel() de verdade
// e confronta o personagem resultante, a CADA nível, contra a linha
// correspondente da tabela do livro.
//
// Isto é o que classes.test.mjs NÃO faz: lá a pergunta é "a tabela do
// app bate com a do livro?"; aqui é "o app aplica a tabela ao
// personagem?". As duas podem divergir -- uma tabela certa lida pelo
// código errado passa no motor estrutural e falha aqui.
//
// Roda em node:test sem navegador porque db.js consegue ler dados/ do
// disco pelo stub de fetch do harness (ver harness.mjs).
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { PROGRESSAO, TRACOS_BASICOS } from '../catalogo/classes.mjs';
import { escadaDeNivel, modulosApp } from './harness.mjs';

const { utils } = await modulosApp();
const CLASSES = Object.keys(PROGRESSAO);

for (const classe of CLASSES) {
  test(`subida 1→20 aplica a tabela do livro: ${classe}`, async () => {
    const linhaDo = (nivel) => PROGRESSAO[classe].find((l) => l.nivel === nivel);
    let pvEsperado = null;

    const final = await escadaDeNivel(classe, (p, nivel) => {
      const linha = linhaDo(nivel);

      // Bônus de Proficiência: cada classe repete a mesma progressão da
      // tabela Evolução do Personagem. Essa tabela em si já está coberta
      // por ficha-transversal.test.mjs; o que se afirma aqui é que a
      // coluna DA CLASSE bate com ela, classe por classe.
      assert.equal(utils.bonusProficiencia(p.nivel), linha.bonusProficiencia,
        `${classe} nv${nivel}: bônus de proficiência`);

      // PV acumulado: começa no PV de nível 1 da semente e soma o ganho
      // fixo do livro (metade do dado de vida + 1 + mod. CON, mínimo 1)
      // a cada nível. O dado de vida vem do CATÁLOGO, não de
      // CLASSES_INFO -- senão o esperado viria da mesma fonte que
      // calcularHPGanho lê por dentro.
      const dadoVida = TRACOS_BASICOS[classe].dadoVida;
      const modCon = utils.calcMod(p.atributos.constituicao);
      if (pvEsperado === null) pvEsperado = dadoVida + modCon;
      pvEsperado += Math.max(1, Math.floor(dadoVida / 2) + 1 + modCon);
      assert.equal(p.pv_max, pvEsperado, `${classe} nv${nivel}: PV máximo`);

      // Espaços de magia gravados no personagem = colunas 1-9 do livro.
      if (linha.espacos !== null) {
        const totais = {};
        for (const [circulo, dadosCirculo] of Object.entries(p.espacos_magia || {})) {
          totais[circulo] = dadosCirculo.total;
        }
        assert.deepEqual(totais, linha.espacos,
          `${classe} nv${nivel}: espaços de magia`);
      } else {
        assert.deepEqual(p.espacos_magia ?? {}, {},
          `${classe} nv${nivel}: classe sem conjuração não deveria ter espaços`);
      }
    });

    assert.equal(final.nivel, 20, `${classe} deveria terminar no nível 20`);
  });
}
```

- [ ] **Step 2: Rodar e separar falha de driver de falha de app**

Run (a partir de `testes/e2e/`): `npm run test:regras:unidade`

Regra do erro 6 do guia: se as 12 classes falharem juntas, o suspeito é o
driver ou o cálculo do PV esperado, **não** 12 bugs do app. Consertar até as
falhas ficarem esparsas e específicas, e só então classificar uma a uma.

Suspeito conhecido a checar primeiro: o PV de nível 1 da semente
(`personagemSemente` em Task 7 grava `dadoVida + 2`, e o teste recalcula com
`calcMod(constituicao)` — os dois precisam concordar, senão as 12 classes
falham por deslocamento constante).

- [ ] **Step 3: Confrontar quais escolhas o app exigiu**

Esta é a asserção que só existe porque `subirDeNivel` devolve
`tipo_pendencia` estruturado — o terceiro argumento que `escadaDeNivel` já
passa para `aoSubir` (Task 7). Acrescentar um teste por classe:

```js
// O app exigiu escolha de subclasse exatamente nos níveis em que o livro
// lista "Subclasse <Classe>" na coluna de características? Uma pendência
// a mais é exigência inventada; uma a menos é o app deixando o
// personagem subir sem escolher o que o livro manda escolher.
for (const classe of CLASSES) {
  test(`as escolhas exigidas batem com o livro: ${classe}`, async () => {
    const exigidasPorNivel = new Map();
    await escadaDeNivel(classe, (p, nivel, pendencias) => {
      exigidasPorNivel.set(nivel, pendencias);
    });

    const niveisComSubclasseNoLivro = PROGRESSAO[classe]
      .filter((l) => l.caracteristicas.some((c) => new RegExp(`^Subclasse (de )?${classe}$`).test(c)))
      .map((l) => l.nivel);
    const niveisComPendenciaSubclasse = [...exigidasPorNivel.entries()]
      .filter(([, tipos]) => tipos.includes('subclasse'))
      .map(([nivel]) => nivel);
    assert.deepEqual(niveisComPendenciaSubclasse, niveisComSubclasseNoLivro,
      `${classe}: níveis que exigem subclasse`);

    const niveisComASINoLivro = PROGRESSAO[classe]
      .filter((l) => l.caracteristicas.includes('Aumento no Valor de Atributo'))
      .map((l) => l.nivel);
    const niveisComPendenciaASI = [...exigidasPorNivel.entries()]
      .filter(([, tipos]) => tipos.includes('aumento_atributo'))
      .map(([nivel]) => nivel);
    assert.deepEqual(niveisComPendenciaASI, niveisComASINoLivro,
      `${classe}: níveis que exigem Aumento no Valor de Atributo`);
  });
}
```

- [ ] **Step 4: Teste de mutação**

Estragar de propósito um valor do catálogo e confirmar vermelho:

1. Em `catalogo/classes.mjs`, mudar `bonusProficiencia` do Bárbaro nível 5 de
   `3` para `9`.
2. Run: `npm run test:regras:unidade`
   Expected: o teste `subida 1→20 aplica a tabela do livro: Bárbaro` **falha**,
   e o teste `tabela: Bárbaro nível 5` (Task 4) também.
3. Restaurar o `3`.
4. Mudar `espacos` do Bardo nível 5 de `{ '1': 4, '2': 3, '3': 2 }` para
   `{ '1': 4, '2': 3 }`.
5. Run: `npm run test:regras:unidade`
   Expected: falha em `subida 1→20 ...: Bardo` e em `tabela: Bardo nível 5`.
6. Restaurar.

Se qualquer uma das duas mutações **passar**, a asserção correspondente não
está afirmando nada e precisa ser consertada antes de seguir.

---

### Task 9: Perguntas que o livro não escreve

**Risk:** medium — asserções sem frase do livro para citar. Precisam dizer
isso por escrito, senão viram alegação sem fonte.

**Files:**
- Modify: `testes/regras/unidade/classes-progressao.test.mjs`

**Interfaces:**
- Consumes: `escadaDeNivel` (Task 7), `PROGRESSAO` (Task 3).
- Produces: nada.

- [ ] **Step 1: Escrever o bloco, com o motivo por escrito**

```js
// ------------------------------------------------------------
// Perguntas que NENHUMA frase do livro responde diretamente.
//
// A lição do motor de escolha morta (GUIA-PROXIMOS-DOMINIOS.md): a
// pergunta "que frase do livro isto testa?" vira um teto — uma regra
// que o livro nunca precisa dizer em voz alta fica fora do exercício
// de desenhar o motor, e o sintoma não é teste vermelho, é a AUSÊNCIA
// de teste. As quatro asserções abaixo não citam seção nenhuma: a
// fonte é o bom senso de quem usaria o app.
// ------------------------------------------------------------

for (const classe of CLASSES) {
  test(`nenhum espaço de magia diminui ao subir: ${classe}`, async () => {
    let anterior = {};
    await escadaDeNivel(classe, (p) => {
      for (const [circulo, dadosCirculo] of Object.entries(anterior)) {
        const agora = p.espacos_magia?.[circulo]?.total ?? 0;
        assert.ok(agora >= dadosCirculo.total,
          `${classe} nv${p.nivel}: círculo ${circulo} caiu de ` +
          `${dadosCirculo.total} para ${agora}`);
      }
      anterior = JSON.parse(JSON.stringify(p.espacos_magia || {}));
    });
  });

  test(`nenhuma característica é concedida duas vezes: ${classe}`, async () => {
    // "Aumento no Valor de Atributo", "Característica de Subclasse" e
    // "Dádiva Épica" repetem na tabela do livro DE PROPÓSITO -- são as
    // únicas exceções, e estão nomeadas aqui em vez de filtradas por
    // heurística.
    const REPETEM_NO_LIVRO = new Set([
      'Aumento no Valor de Atributo', 'Característica de Subclasse',
      'Dádiva Épica',
    ]);
    const vistas = new Map();
    for (const linha of PROGRESSAO[classe]) {
      for (const c of linha.caracteristicas) {
        if (REPETEM_NO_LIVRO.has(c)) continue;
        const antes = vistas.get(c);
        assert.equal(antes, undefined,
          `${classe}: "${c}" aparece nos níveis ${antes} e ${linha.nivel}`);
        vistas.set(c, linha.nivel);
      }
    }
  });

  test(`subclasse não é reoferecida depois de escolhida: ${classe}`, async () => {
    const niveisQuePedem = [];
    await escadaDeNivel(classe, (p, nivel, pendencias) => {
      if (pendencias.includes('subclasse')) niveisQuePedem.push(nivel);
    });
    assert.equal(niveisQuePedem.length, 1,
      `${classe}: subclasse pedida em ${niveisQuePedem.length} níveis ` +
      `(${niveisQuePedem.join(', ')}), esperado exatamente 1`);
  });
}

test('subir além do nível 20 é recusado', async () => {
  const { levelup } = await modulosApp();
  const personagem = await escadaDeNivel('Bárbaro', () => {});
  assert.equal(personagem.nivel, 20);
  personagem.xp = 999999;
  const r = await levelup.subirDeNivel(personagem, {});
  assert.equal(r.sucesso, false, 'nível 21 deveria ser recusado');
  assert.equal(personagem.nivel, 20, 'o personagem não deveria ter subido');
});

test('subir sem XP suficiente é recusado', async () => {
  const { levelup, store } = await modulosApp();
  const p = store.criarPersonagemVazio();
  p.classe = 'Bárbaro';
  p.nivel = 1;
  p.xp = 0;
  const r = await levelup.subirDeNivel(p, {});
  assert.equal(r.sucesso, false, 'sem XP não deveria subir');
  assert.equal(p.nivel, 1, 'o personagem não deveria ter subido');
});
```

- [ ] **Step 2: Rodar**

Run (a partir de `testes/e2e/`): `npm run test:regras:unidade`
Expected: verde, ou falhas específicas classificadas na Task 10.

- [ ] **Step 3: Teste de mutação do bloco**

Trocar `assert.ok(agora >= dadosCirculo.total, ...)` por
`assert.ok(agora >= 0, ...)`, rodar, confirmar que o teste passa mesmo assim.
Isso demonstra, por contraste, que a versão original é a que afirma algo.

**Reverter a troca imediatamente, dentro deste mesmo passo**, e rodar de novo
para confirmar que a asserção original voltou. A restrição global "nenhum
`assert.ok(x >= 0)`" continua valendo: a comparação frouxa é um instrumento de
medição temporário, não pode sobrar no diff. Registrar as duas saídas (com a
mutação e depois dela) no relatório da tarefa.

---

### Task 10: Lacunas, higiene e documentação

**Risk:** medium — é onde as alegações sobre o app viram públicas. Uma lacuna
falsa aqui custa mais que uma faltando.

**Files:**
- Modify: `testes/regras/lacunas-conhecidas.mjs`
- Modify: `testes/regras/unidade/completude.test.mjs`
- Modify: `testes/regras/README.md`
- Modify: `testes/regras/GUIA-PROXIMOS-DOMINIOS.md`

**Interfaces:**
- Consumes: as falhas classificadas nas Tasks 4, 5, 6, 8 e 9.
- Produces: nada.

- [ ] **Step 1: Acrescentar as chaves de teste do domínio**

Em `lacunas-conhecidas.mjs`, dentro de `TESTES_VALIDOS`:

```js
  // Domínio Classes/Níveis (testes/regras/unidade/classes.test.mjs e
  // classes-progressao.test.mjs). 'classes-tabela' cobre o confronto do
  // catálogo contra dados/classes/*.json; 'classes-info' é a SEGUNDA
  // fonte de verdade (site/js/dados-classes.js); 'classes-gatilho' são
  // as listas hard-coded de levelup.js que decidem o que cada nível
  // exige; 'classes-progressao' é o confronto comportamental da subida
  // 1→20; 'classes-sanidade' são as asserções sem frase do livro.
  'classes-tabela', 'classes-info', 'classes-gatilho',
  'classes-progressao', 'classes-sanidade',
```

- [ ] **Step 2: Fazer a higiene de lacuna aceitar nome de classe**

`completude.test.mjs:89` só aceita entidade que exista no catálogo de talentos
ou no de antecedentes. Uma lacuna de classe seria rejeitada.

Acrescentar o import e o conjunto:

```js
import { PROGRESSAO } from '../catalogo/classes.mjs';
```

```js
// Desde o domínio Classes/Níveis, `talento` também pode nomear uma das
// 12 classes -- o campo é o identificador genérico da entidade sob
// teste, não um nome de talento.
const nomesClasses = new Set(Object.keys(PROGRESSAO));
```

E na asserção:

```js
    assert.ok(nomesCatalogo.has(l.talento) || nomesAntecedentes.has(l.talento)
      || nomesClasses.has(l.talento),
      `lacuna de entidade inexistente (nem talento, nem antecedente, nem classe): ${l.talento}`);
```

Atualizar também o comentário logo acima da asserção, que hoje diz "pode ser
um nome de talento ou, desde o domínio Antecedentes, um nome de antecedente".

**O schema do catálogo de classes fica em `classes.test.mjs` (Task 4 Step 2),
não aqui** — mesmo padrão do domínio Antecedentes, cujo comentário em
`completude.test.mjs:17-23` já explica por que schema/bijeção/citação de um
domínio novo vivem no motor do domínio e só a higiene de `LACUNAS` é
compartilhada. Acrescentar uma frase nesse comentário citando classes, para
ninguém ler a ausência como esquecimento.

- [ ] **Step 3: Registrar as lacunas encontradas**

Para cada divergência classificada nas Tasks 4-9, uma entrada. Formato, com
`Bárbaro`/`classes-gatilho` como exemplo de forma (substituir pelo achado
real):

```js
  { talento: '<Classe>', teste: '<chave do Step 1>',
    tipo: 'app-diverge-do-livro',
    motivo: 'O livro lista "<rótulo>" na coluna Características de Classe do ' +
      'nível <N> (Classes.md:<linha>), mas <funcao>() em ' +
      'site/js/levelup.js:<linha> não inclui <N> na sua lista de níveis — ' +
      'a lista é hard-coded e independente da tabela. Observado: <valor>; ' +
      'esperado: <valor>.' },
```

Regras, do `GUIA-PROXIMOS-DOMINIOS.md`:
- O `motivo` diz **o que o app faz e o que não faz**, com arquivo e linha dos
  dois lados. Se existe código que implementa parte da regra, o motivo o cita.
- Nada de motivo que superafirma. Se a queixa real é "só roda num fluxo", é
  isso que se escreve.
- `tipo: 'limitacao-observabilidade'` só quando a alegação for sobre o motor,
  não sobre o app.
- Envolver a asserção correspondente em `comLacuna(classe, chave, fn)` para o
  teste passar a exigir falha (mecânica de `harness.mjs:128`).

- [ ] **Step 4: Rodar a suíte inteira e anotar o total**

Run (a partir de `testes/e2e/`): `npm run test:regras:unidade`
Expected: 0 falhas. Anotar o total novo (passam / skip / falham).

Run (a partir de `testes/e2e/`): `npm run test:regras:e2e`
Expected: 111/111, inalterado — nenhuma tarefa tocou os specs de navegador.

- [ ] **Step 5: Conferir que a paridade não mudou**

Run (a partir de `testes/e2e/`): `npx playwright test --list`
Expected: **329 testes em 10 arquivos**, como o checklist do guia exige.

- [ ] **Step 6: Escrever a seção do domínio no README**

Em `testes/regras/README.md`:

1. Acrescentar as duas linhas novas na tabela "O que cada motor prova":
   `classes.test.mjs` e `classes-progressao.test.mjs`, com o número real de
   testes.
2. Atualizar o total de `unidade/` e a contagem de motores (de sete para
   nove).
3. Nova seção **"Achados do domínio Classes/Níveis (2026-08-07)"**, com:
   - o que foi varrido, por completo, sem amostragem;
   - as divergências encontradas, ou a afirmação de zero com a varredura que a
     sustenta;
   - **o escopo declarado fora**, em voz alta: características de subclasse
     por nível (48 subclasses) como **dependência direta da rodada seguinte**,
     listas de magias por classe (domínio Magias), multiclasse (o app não a
     implementa), e os ramos de classe herdados de `ficha-transversal`
     (`calcCA`, `calcBonusPericia`, `calcPercepcaoPassiva`) — três deles
     dependem de subclasse, então acompanham a rodada seguinte;
   - o registro de que a tabela Evolução do Personagem **não** foi duplicada.
4. Atualizar o "Mapa de domínios futuros": marcar Classes/Níveis como feito,
   e inserir "Subclasses" como item novo entre ele e Magias.

- [ ] **Step 7: Registrar a lição no guia, se houver**

Se a rodada produziu uma lição que ainda não está em
`GUIA-PROXIMOS-DOMINIOS.md`, escrevê-la no formato das existentes (**O que
aconteceu** / **Por que é útil saber** / **Como aplicar**), com evidência
concreta desta rodada.

Candidato provável, se se confirmar: *um domínio pode ter função pura
suficiente para dispensar o navegador — e a checagem que revela isso é tentar
executar o fluxo principal em Node, não ler a lista de `export`s.* Foi o spike
de `subirDeNivel` que decidiu o desenho deste domínio, e ele custou minutos.

Se nenhuma lição nova apareceu, **não inventar uma** — o guia já registra que
inventar dificuldade que o domínio não teve é um vício de relatório.
