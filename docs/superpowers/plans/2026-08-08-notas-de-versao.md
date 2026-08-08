# Notas de versão + versionamento manual — plano de implementação

> **Para agentes:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development
> (recomendado) ou superpowers:executing-plans para implementar tarefa a tarefa.
> Os passos usam checkbox (`- [ ]`).

**Goal:** Um botão de notas de versão na tela inicial (e só nela), abrindo a lista
de versões recolhida com marcador na versão atual, alimentada por um versionamento
**manual** que substitui o número de build do GitHub na exibição — sem afetar a
atualização automática.

**Architecture:** Uma fonte de verdade nova (`site/js/versao.js`) guarda a versão
manual e as notas. O header passa a exibir essa versão em vez do número de build.
O número de build continua existindo, invisível, só para diagnóstico — e o
`CACHE_VERSION` do service worker continua sendo substituído pelo GitHub Actions,
que é o que dispara a atualização automática. O botão é injetado em
`#header-acoes`, que o roteador já limpa a cada navegação, então ele desaparece
sozinho fora da home.

**Tech Stack:** JS puro (ES modules), sem build, sem dependências. CSS com as
variáveis já definidas em `site/css/app.css`. Testes com Playwright a partir de
`testes/e2e/`.

## Global Constraints

- **Comentários em código SEMPRE em Português do Brasil.** Toda função nova leva
  comentário explicando o que faz.
- **Não commitar, não `git add`, não criar branch/worktree.**
- **A atualização automática não pode ser afetada.** A linha
  `const CACHE_VERSION = 0; // AUTO` (`site/sw.js:3`) e o `sed` que a substitui
  (`.github/workflows/deploy.yml:68`) **não mudam**. Qualquer alteração ali é
  falha da tarefa.
- **A árvore de trabalho já tem 24 arquivos alterados e não commitados** de outra
  rodada (correções de classes). Não reverta, não commite, não "limpe" nada que
  você não criou.
- Estado atual das portas, medido antes deste plano:
  - `npm run test:regras:unidade` (de `testes/e2e/`) → **1289 testes, 1225 pass, 0 fail, 64 skip**
  - `npm run test:regras:e2e` → **113/113**
  - `npx playwright test --list` → **329 testes em 10 arquivos**
  - `npx playwright test` (paridade) → **291 passed, 37 failed, 1 skipped** — as 37
    são divergência deliberada e conhecida (selo de proficiência do Ladino). **Esse
    número não pode subir por causa deste plano.**
- O app usa `abrirModal(titulo, corpoHtml, acoesHtml = '', onClose = null)`
  (`site/js/utils.js:569`).
- Variáveis de CSS disponíveis: `--bg`, `--bg-card`, `--bg-input`, `--primary`,
  `--primary-light`, `--primary-dark`, `--secondary`, `--accent`, `--text`,
  `--text-muted`, `--text-light`, `--border`, `--border-light`, `--success`,
  `--danger`, `--warning`, `--info`, `--radius`, `--radius-sm`, `--shadow`,
  `--shadow-lg`.

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `site/js/versao.js` (novo) | Fonte única: versão manual atual + dados das notas. Sem DOM. |
| `site/js/notas-versao.js` (novo) | Monta e abre o modal a partir dos dados. Sem dados embutidos. |
| `site/index.html` (alterado) | Selo de versão passa a ser preenchido por JS; novo span oculto para o número de build |
| `site/js/app.js` (alterado) | Lê a versão de `versao.js`; injeta o botão só na rota `home` |
| `site/css/app.css` (alterado) | Estilos do botão e do modal de notas |
| `.github/workflows/deploy.yml` (alterado) | O `sed` do `index.html` passa a mirar o span de build; o do `sw.js` **não muda** |
| `site/sw.js` (alterado) | Os 2 módulos novos entram em `STATIC_ASSETS` |
| `site/js-precache.json` (alterado) | Os 2 módulos novos entram na lista |
| `testes/e2e/regras/notas-versao.spec.mjs` (novo) | Prova de comportamento no navegador |

A separação dado/UI é deliberada: as notas vão crescer a cada versão, e o arquivo
de dados precisa continuar legível para quem só quer acrescentar uma entrada.

---

### Task 1: A fonte de verdade da versão e das notas

**Risk:** low — arquivo novo, sem consumidor ainda; nada pode regredir.

**Files:**
- Create: `site/js/versao.js`

**Interfaces:**
- Produces:
  - `VERSAO_ATUAL: string` — a versão manual exibida no header. Nesta tarefa: `'2.0.0'`.
  - `NOTAS_VERSAO: Array<{ versao, data, resumo, melhorias, correcoes }>`, onde
    `melhorias` e `correcoes` são `Array<{ grupo: string, itens: string[] }>`.
    Ordenado da mais recente para a mais antiga.

- [ ] **Step 1: Levantar o conteúdo real da versão 2.0.0**

A refatoração é o commit `d93c473` ("Quebra os monolitos sheet.js e creator.js em
39 modulos por assunto"). A 2.0.0 cobre **tudo depois dele**.

Rode, a partir da raiz:
`git log --oneline --no-merges d93c473..HEAD`

E leia `testes/regras/README.md` (seções "Achados do domínio ..."), que descreve
cada divergência encontrada e corrigida, com evidência.

**Atenção:** há trabalho **não commitado** na árvore (correções de classes:
troca de Estilo de Luta do Guerreiro, proficiência do Ladino com armas Marciais
Leves, Especialização do Ladino no nível 6, vocabulário de Estilo de Luta,
duas flags de Estilo de Luta sem efeito, +1 truque de Taumaturgo/Xamã, texto do
Clérigo nível 3). Ele faz parte da 2.0.0 — inclua.

Escreva o texto **para o jogador**, não para o desenvolvedor: "o Guerreiro agora
pode trocar o Estilo de Luta ao subir de nível", não "exigeTrocaEstiloLutaGuerreiro
foi adicionada a levelup.js".

- [ ] **Step 2: Escrever o arquivo**

```js
// ============================================================
// Versão do app e notas de versão.
//
// A versão exibida no header é CONTROLADA À MÃO aqui -- não vem
// mais do número de build do GitHub Actions. O build continua
// existindo e continua governando a atualização automática
// (CACHE_VERSION em sw.js, substituído no deploy); ele só não é
// mais o que o usuário vê.
//
// Para lançar uma versão nova: acrescente a entrada NO TOPO de
// NOTAS_VERSAO e atualize VERSAO_ATUAL para a mesma string. As duas
// precisam bater -- há teste que cobra isso.
// ============================================================

/** Versão exibida no header e marcada como atual na lista de notas. */
export const VERSAO_ATUAL = '2.0.0';

// Cada entrada é uma versão. `melhorias` e `correcoes` são listas de
// grupos, e cada grupo tem um título curto e seus itens. O emoji do
// grupo entra no próprio título -- é o que separa visualmente melhoria
// de correção sem depender de cor.
export const NOTAS_VERSAO = [
  {
    versao: '2.0.0',
    data: '2026-08-08',
    resumo: 'Primeira versão com numeração própria. Reúne tudo que mudou desde '
      + 'a reorganização interna do site.',
    melhorias: [
      {
        grupo: '✨ Confiabilidade das regras',
        itens: [
          'O site passou a ser conferido automaticamente contra o livro, e não '
            + 'só comparado com a versão antiga — erros que existiam nos dois '
            + 'lados passaram a aparecer.',
          'A conferência cobre talentos, antecedentes, as fórmulas da ficha e '
            + 'as 12 classes nos 20 níveis, sem amostragem.',
        ],
      },
      {
        grupo: '📴 Uso offline',
        itens: [
          'Todos os módulos do site passaram a ficar disponíveis offline. '
            + 'Antes, só 18,3% ficavam, e o site podia falhar sem internet.',
        ],
      },
      {
        grupo: '🧭 Notas de versão',
        itens: [
          'O site passou a ter numeração própria, controlada manualmente, e '
            + 'esta tela de notas para acompanhar o que muda a cada versão.',
        ],
      },
    ],
    correcoes: [
      {
        grupo: '🐛 Talentos',
        itens: [
          'Habilidoso, Artifista e Músico não abriam as opções de escolha ao '
            + 'serem adicionados pelo botão "+ Talento" da ficha — o talento '
            + 'era gravado sem conceder nenhuma proficiência.',
          'Mestre das Armas não oferecia a escolha de arma que o livro exige.',
          'Adepto Elemental oferecia tipos de dano com nomes errados '
            + '(Frio/Fogo/Trovão no lugar de Gélido/Ígneo/Trovejante).',
          'Analítico oferecia Medicina no lugar de Percepção.',
          'Adepto Elemental, Analítico e Mente Aguçada deixavam concluir a '
            + 'subida de nível sem preencher a escolha obrigatória.',
          'Talentos deixaram de reoferecer escolhas que não concederiam nada '
            + '— proficiência que o personagem já tem, por exemplo.',
        ],
      },
      {
        grupo: '🐛 Antecedentes',
        itens: [
          'A ferramenta ou instrumento concedido pelo antecedente nunca virava '
            + 'proficiência de verdade no personagem.',
          'O item do pacote de equipamento descrito como "o mesmo que acima" '
            + 'entrava no inventário com esse texto, em vez da ferramenta que '
            + 'o jogador escolheu.',
        ],
      },
      {
        grupo: '🐛 Classes e subida de nível',
        itens: [
          'O Guerreiro agora pode trocar o Estilo de Luta ao subir de nível, '
            + 'como o livro permite.',
          'O Ladino recebe a Especialização em mais duas perícias no nível 6.',
          'O Ladino passou a ter proficiência com armas Marciais de propriedade '
            + 'Leve, e não só Acuidade — na prática, a Besta de Mão deixou de '
            + 'aparecer como "Sem Prof".',
          'O Clérigo Taumaturgo e o Druida Xamã recebem o truque extra também '
            + 'na ficha e no grimório; antes a ficha mostrava "Truques: 4/3" e '
            + 'bloqueava a escolha.',
        ],
      },
      {
        grupo: '🐛 Estilos de Luta',
        itens: [
          'Cinco dos dez Estilos de Luta não mostravam efeito nenhum na ficha, '
            + 'porque o nome gravado e o nome exibido eram vocabulários '
            + 'diferentes.',
          'Combate com Armas Grandes exibia a regra antiga ("re-rolar 1 ou 2") '
            + 'em vez da atual ("tratar 1 ou 2 como 3").',
          'Combate com Armas Grandes e Combate com Duas Armas não indicavam o '
            + 'benefício em arma nenhuma da ficha.',
          'Luta às Cegas descrevia um alcance que o livro não concede.',
        ],
      },
    ],
  },
];
```

Este conteúdo é o levantamento que fiz do histórico; **confira cada item** contra
`git log d93c473..HEAD` e `testes/regras/README.md` antes de aceitar. Se achar
mudança relevante para o jogador que ficou de fora, acrescente; se achar item que
não se sustenta, remova e diga qual no relatório. O que não pode acontecer é item
que você não conseguiu confirmar permanecer no arquivo.

- [ ] **Step 3: Conferir forma e coerência**

Rode, a partir da raiz:

```
node -e "import('./site/js/versao.js').then(m=>{
  const n=m.NOTAS_VERSAO;
  console.log('VERSAO_ATUAL:', m.VERSAO_ATUAL);
  console.log('entradas:', n.length);
  console.log('topo === VERSAO_ATUAL:', n[0].versao === m.VERSAO_ATUAL);
  const vazios=[];
  for (const v of n) for (const g of [...v.melhorias, ...v.correcoes]) if (!g.itens.length) vazios.push(v.versao+'/'+g.grupo);
  console.log('grupos vazios:', vazios);
  const semEmoji=[];
  for (const v of n) for (const g of [...v.melhorias, ...v.correcoes]) if (!/^\p{Emoji}/u.test(g.grupo)) semEmoji.push(g.grupo);
  console.log('grupos sem emoji no titulo:', semEmoji);
  const totalItens=n.flatMap(v=>[...v.melhorias,...v.correcoes]).reduce((s,g)=>s+g.itens.length,0);
  console.log('total de itens:', totalItens);
})"
```

Expected: `topo === VERSAO_ATUAL: true`, `grupos vazios: []`,
`grupos sem emoji no titulo: []`, e `total de itens` igual ao número de itens que
você de fato confirmou (o esqueleto acima traz 20; o número muda se você
acrescentar ou remover no Step 1 — reporte qual ficou e por quê).

---

### Task 2: O modal de notas de versão

**Risk:** low — arquivo novo mais CSS aditivo; nenhum fluxo existente muda.

**Files:**
- Create: `site/js/notas-versao.js`
- Modify: `site/css/app.css` (acrescentar no fim)

**Interfaces:**
- Consumes: `VERSAO_ATUAL`, `NOTAS_VERSAO` de `./versao.js` (Task 1);
  `abrirModal` de `./utils.js`.
- Produces: `abrirNotasVersao(): void` — abre o modal. É o que a Task 3 chama.

- [ ] **Step 1: Escrever o módulo**

```js
// ============================================================
// Modal de notas de versão. Só monta HTML a partir de versao.js --
// nenhum dado de release mora aqui.
// ============================================================
import { abrirModal, escHtml } from './utils.js';
import { VERSAO_ATUAL, NOTAS_VERSAO } from './versao.js';

/** Monta a lista de itens de um grupo (melhoria ou correção). */
function _grupoHtml(grupo) {
  const itens = grupo.itens
    .map((i) => `<li class="nv-item">${escHtml(i)}</li>`)
    .join('');
  return `
    <div class="nv-grupo">
      <h4 class="nv-grupo-titulo">${escHtml(grupo.grupo)}</h4>
      <ul class="nv-lista">${itens}</ul>
    </div>`;
}

/**
 * Monta uma versão como <details>. A versão atual vem aberta e com
 * marcador; as demais vêm recolhidas -- é o comportamento pedido
 * (lista recolhida, com um marcador apontando para a atual).
 */
function _versaoHtml(v) {
  const ehAtual = v.versao === VERSAO_ATUAL;
  const marcador = ehAtual
    ? '<span class="nv-marcador" title="Versão que você está usando">▶ atual</span>'
    : '';
  const secoes = [
    ...v.melhorias.map(_grupoHtml),
    ...v.correcoes.map(_grupoHtml),
  ].join('');
  return `
    <details class="nv-versao${ehAtual ? ' nv-versao-atual' : ''}" ${ehAtual ? 'open' : ''}>
      <summary class="nv-versao-cabecalho">
        <span class="nv-versao-numero">${escHtml(v.versao)}</span>
        <span class="nv-versao-data">${escHtml(v.data)}</span>
        ${marcador}
      </summary>
      <p class="nv-resumo">${escHtml(v.resumo)}</p>
      ${secoes}
    </details>`;
}

/**
 * Abre o modal com a lista de versões. O número de build do GitHub
 * (invisível no header, span #build-numero) entra no rodapé só como
 * diagnóstico -- é ele que identifica a build para relatar problema,
 * enquanto a versão de cima é a numeração manual do site.
 */
export function abrirNotasVersao() {
  const build = document.getElementById('build-numero')?.textContent?.trim() || '';
  const rodape = build
    ? `<p class="nv-build">Build de distribuição: <code>${escHtml(build)}</code></p>`
    : '';
  const corpo = `
    <div class="nv-container">
      ${NOTAS_VERSAO.map(_versaoHtml).join('')}
      ${rodape}
    </div>`;
  abrirModal('Notas de versão', corpo);
}
```

`escHtml` está exportada em `site/js/utils.js:527` (conferido). Não escreva um
escapador novo — o conteúdo das notas é texto controlado, mas passar por `escHtml`
é o que impede que um apóstrofo ou `<` numa nota futura quebre o modal.

- [ ] **Step 2: Acrescentar o CSS**

No fim de `site/css/app.css`:

```css
/* --- Notas de versão --- */
.nv-container { display: flex; flex-direction: column; gap: 10px; }
.nv-versao {
  border: 1px solid var(--border-light); border-radius: var(--radius);
  background: var(--bg-card); padding: 8px 12px;
}
.nv-versao-atual { border-color: var(--primary); box-shadow: var(--shadow); }
.nv-versao-cabecalho {
  cursor: pointer; display: flex; align-items: center; gap: 8px;
  font-weight: 700; list-style: none;
}
.nv-versao-cabecalho::-webkit-details-marker { display: none; }
.nv-versao-numero { color: var(--primary); font-size: 1rem; }
.nv-versao-data { color: var(--text-light); font-size: 0.8rem; font-weight: 400; }
.nv-marcador {
  margin-left: auto; font-size: 0.75rem; font-weight: 700;
  color: var(--primary); background: var(--bg-input);
  border-radius: var(--radius-sm); padding: 2px 8px; white-space: nowrap;
}
.nv-resumo { color: var(--text-muted); font-size: 0.85rem; margin: 8px 0 4px; }
.nv-grupo { margin-top: 10px; }
.nv-grupo-titulo { font-size: 0.9rem; margin: 0 0 4px; color: var(--text); }
.nv-lista { margin: 0; padding-left: 20px; }
.nv-item { font-size: 0.85rem; color: var(--text); margin-bottom: 3px; }
.nv-build {
  margin-top: 14px; padding-top: 8px; border-top: 1px solid var(--border-light);
  font-size: 0.75rem; color: var(--text-light);
}
#btn-notas-versao { font-size: 1.1rem; }
```

- [ ] **Step 3: Conferir que o módulo carrega e monta**

Rode, a partir da raiz:

```
node -e "
globalThis.document={getElementById:()=>null,createElement:()=>({style:{},classList:{add(){},remove(){}},appendChild(){},setAttribute(){}}),querySelector:()=>null,querySelectorAll:()=>[],body:{appendChild(){}}};
globalThis.window=globalThis;
globalThis.localStorage={getItem:()=>null,setItem:()=>{},removeItem:()=>{},clear:()=>{}};
import('./site/js/notas-versao.js').then(m=>console.log('exporta abrirNotasVersao:', typeof m.abrirNotasVersao === 'function'));
"
```

Expected: `exporta abrirNotasVersao: true`.

---

### Task 3: Header — versão manual e botão só na home

**Risk:** medium — mexe em `app.js`, que é o roteador; e no `index.html`, cujo
selo de versão é alvo de um `sed` no deploy (a Task 4 acerta o `sed`; até lá o
número de build deixa de aparecer, o que é o objetivo).

**Files:**
- Modify: `site/index.html:25`
- Modify: `site/js/app.js:24-39` e o bloco de `processarRota`

**Interfaces:**
- Consumes: `VERSAO_ATUAL` (Task 1), `abrirNotasVersao` (Task 2).

- [ ] **Step 1: Ajustar o `index.html`**

A linha 25 é hoje:

```html
<h1 id="header-titulo">D&D 5.5 Ficha <span id="header-versao" class="header-versao">v0</span><!-- VERSION_AUTO --></h1>
```

Passa a ser:

```html
<h1 id="header-titulo">D&D 5.5 Ficha <span id="header-versao" class="header-versao"></span></h1>
<!-- Número da build do GitHub Actions. Fica oculto e serve só para
     diagnóstico (aparece no rodapé das notas de versão). O selo visível
     do header é a versão MANUAL, definida em js/versao.js. -->
<span id="build-numero" hidden>v0</span><!-- VERSION_AUTO -->
```

O `<span id="build-numero">` fica **fora** do `<h1>`, mas ainda dentro do
`<header id="app-header">`. O comentário `<!-- VERSION_AUTO -->` acompanha o novo
span porque é o alvo do `sed` do deploy (Task 4).

- [ ] **Step 2: `app.js` passa a ler a versão manual**

Hoje `app.js:24-26` lê a versão do DOM. Troque por import:

```js
import { VERSAO_ATUAL } from './versao.js';
import { abrirNotasVersao } from './notas-versao.js';

// Versão exibida no header. Vem de js/versao.js (controle manual), NÃO
// mais do número de build injetado no deploy -- esse continua existindo
// no span oculto #build-numero, só para diagnóstico.
const APP_VERSION = VERSAO_ATUAL ? 'v' + VERSAO_ATUAL : '';
```

`definirTituloHeader` (`app.js:29-39`) não muda: ela já reanexa `APP_VERSION` a
cada navegação.

- [ ] **Step 3: Injetar o botão só na home**

Em `processarRota`, logo depois de `acoes.innerHTML = '';` (o roteador já limpa
`#header-acoes` a cada navegação, então o botão some sozinho fora da home):

```js
  // Botão de notas de versão: só na tela inicial. #header-acoes é
  // limpo acima a cada navegação, então não é preciso removê-lo ao sair
  // da home -- ele simplesmente não é recriado.
  if (pagina === 'home') {
    const btnNotas = document.createElement('button');
    btnNotas.id = 'btn-notas-versao';
    btnNotas.className = 'header-btn no-print';
    btnNotas.title = 'Notas de versão';
    btnNotas.textContent = '📋';
    btnNotas.addEventListener('click', abrirNotasVersao);
    acoes.appendChild(btnNotas);
  }
```

- [ ] **Step 4: Conferir no navegador, à mão**

Suba o servidor local (`./iniciar_servidor.ps1` ou o servidor estático que você
preferir na pasta `site/`) e confira, nesta ordem:
1. Na home, o header mostra `v2.0.0` ao lado do título e existe um botão 📋.
2. Clicando nele, o modal abre com a versão 2.0.0 aberta e o marcador "▶ atual".
3. Abrindo uma ficha, o botão 📋 **some** do header.
4. Voltando para a home, ele **volta**.

Registre no relatório o que você observou em cada um dos 4 passos.

---

### Task 4: Deploy, service worker e precache

**Risk:** medium — mexe no workflow de deploy. Um erro aqui só aparece em
produção, não em teste local.

**Files:**
- Modify: `.github/workflows/deploy.yml:69`
- Modify: `site/sw.js` (lista `STATIC_ASSETS`)
- Modify: `site/js-precache.json`

- [ ] **Step 1: Retargetar o `sed` do `index.html`**

A linha 69 do workflow é hoje:

```
sed -i "s|v0</span><!-- VERSION_AUTO -->|v${{ github.run_number }}</span><!-- VERSION_AUTO -->|" _dist/site/index.html
```

Depois da Task 3 o padrão continua casando (o novo span também termina em
`v0</span><!-- VERSION_AUTO -->`), então **o `sed` continua funcionando sem
alteração** — ele agora preenche o span oculto de build em vez do selo visível.

**Confirme isso em vez de presumir:** rode, a partir da raiz,

```
grep -c 'v0</span><!-- VERSION_AUTO -->' site/index.html
```

Expected: `1`. Se der `0`, o HTML da Task 3 ficou diferente do previsto e o `sed`
viraria um no-op silencioso — ajuste o HTML ou o `sed` para voltarem a casar, e
registre qual dos dois você mudou.

**A linha 68 (`CACHE_VERSION` do `sw.js`) NÃO muda.** É ela que dispara a
atualização automática.

- [ ] **Step 2: Acrescentar os módulos novos ao `sw.js`**

Em `site/sw.js`, na lista `STATIC_ASSETS` (começa na linha 8), acrescente as duas
entradas em ordem alfabética junto das demais de `./js/`:

```js
  './js/notas-versao.js',
  './js/versao.js',
```

- [ ] **Step 3: Acrescentar os módulos ao `js-precache.json`**

`site/js-precache.json` é um array JSON ordenado. Acrescente `"./js/notas-versao.js"`
e `"./js/versao.js"` mantendo a ordenação alfabética.

Rode para confirmar que o JSON continua válido e ordenado:

```
node -e "const a=require('./site/js-precache.json');const s=[...a].sort();console.log('valido:',Array.isArray(a),'| ordenado:',JSON.stringify(a)===JSON.stringify(s),'| tem os dois:',a.includes('./js/versao.js')&&a.includes('./js/notas-versao.js'));"
```

Expected: `valido: true | ordenado: true | tem os dois: true`

- [ ] **Step 4: Rodar o teste de precache offline**

Run (de `testes/e2e/`): `npx playwright test offline`
Expected: passa. Esse teste compara a cobertura de precache do refatorado com a
do original; um módulo novo fora do cache poderia piorar a comparação.

---

### Task 5: Prova de comportamento no navegador

**Risk:** low — arquivo de teste novo; nada de produção muda.

**Files:**
- Create: `testes/e2e/regras/notas-versao.spec.mjs`

**Interfaces:**
- Consumes: os helpers de `testes/e2e/regras/helpers-regras.mjs`.

- [ ] **Step 1: Ler os helpers antes de escrever**

Leia `testes/e2e/regras/helpers-regras.mjs` e use os helpers existentes de
navegação e de semente de personagem. **Não escreva navegação artesanal** — o
projeto tem uma lição registrada sobre isso: uma cópia divergente da navegação
causou flake real, e a lição está no cabeçalho do próprio helper e em
`testes/regras/GUIA-PROXIMOS-DOMINIOS.md`.

- [ ] **Step 2: Escrever a spec**

Quatro asserções, nesta ordem:

1. **Na home, o botão existe e o selo mostra a versão manual.** Abrir a home,
   afirmar que `#btn-notas-versao` está visível e que `#header-versao` tem o texto
   `v2.0.0` (importe `VERSAO_ATUAL` de `../../../site/js/versao.js` e monte a
   expectativa a partir dele, para a spec não desatualizar quando a versão subir).
2. **O modal lista as versões, com a atual aberta e marcada.** Clicar no botão,
   esperar `#modal-overlay` visível, e afirmar: existe um `details.nv-versao` por
   entrada de `NOTAS_VERSAO`; o que tem a classe `nv-versao-atual` é exatamente 1;
   esse tem o atributo `open`; e ele contém o texto `atual`.
3. **Os grupos aparecem separados.** Afirmar que o modal contém pelo menos um
   `.nv-grupo-titulo` cujo texto começa com emoji de melhoria e pelo menos um de
   correção, derivando os títulos esperados de `NOTAS_VERSAO` (não escreva os
   emojis literais na spec — leia do módulo, senão a spec quebra quando o texto
   mudar).
4. **Dentro de uma ficha o botão não existe.** Abrir uma ficha com um personagem
   semeado e afirmar que `#btn-notas-versao` não está no DOM.

- [ ] **Step 3: Rodar e medir estabilidade**

Run (de `testes/e2e/`):
`npx playwright test --config=regras/playwright.config.mjs notas-versao --repeat-each=4 --workers=4`

Expected: todas verdes. O projeto exige medir estabilidade assim, e não com
rodadas sequenciais limpas — está escrito no checklist de pré-voo do
`GUIA-PROXIMOS-DOMINIOS.md`.

- [ ] **Step 4: Rodar as quatro portas**

De `testes/e2e/`:
- `npm run test:regras:unidade` → esperado **1289 testes, 0 falhas**
- `npm run test:regras:e2e` → esperado **113 + as suas novas** (reporte o total)
- `npx playwright test --list` → esperado **329 testes em 10 arquivos** (a paridade
  não muda: a sua spec vive na config de regras, não na de paridade)
- `npx playwright test` → esperado **37 failed** e nada além disso. As 37 são a
  divergência deliberada do Ladino. **Se subir, o botão vazou para o snapshot da
  paridade** — investigue antes de seguir: `#app-header` fica fora de
  `#app-content`, que é o que `instantaneo()` fotografa (`testes/e2e/helpers.mjs`),
  então não deveria vazar.
