# Testes de paridade

Comparam este repositório (refatorado) com o original `D-D_2024`, executando
**as mesmas ações nos dois sites** e conferindo que o resultado é idêntico.

Quase nenhuma asserção escreve o valor esperado à mão. A pergunta que estes
testes respondem não é "a tela está correta", é "a tela é a mesma da original".
Isso importa porque a refatoração é mecânica: qualquer diferença é regressão,
por definição.

## Rodar

```bash
cd testes/e2e
npm run instalar     # uma vez: deps + Chromium
npm test             # a suíte inteira (~6 min, 329 testes, 4 workers)
npx playwright test --project=offline   # só os testes de Service Worker
npx playwright test ficha.spec.mjs      # só um arquivo
npm run test:esm ../..                  # parse ESM de todos os módulos
```

Os dois servidores estáticos sobem sozinhos (portas 8801 e 8802). O original é
procurado em `../../../D-D_2024`; para apontar noutro lugar, use
`REPO_ORIGINAL=/caminho/para/D-D_2024`.

**Isto é a única parte do projeto que usa Node.** A aplicação em `site/`
continua sem build e sem dependência nenhuma — `node_modules/` vive só aqui e
está no `.gitignore`.

## O que cada arquivo cobre

| Arquivo | Cobertura |
|---|---|
| `paridade-basico.spec.mjs` | Home e passo 1 do criador: DOM, conjunto de classes CSS, geometria computada da barra de navegação, rótulos dos botões |
| `ficha.spec.mjs` | Ficha genérica: render, classes CSS, dano/cura/PV temporário, descanso longo, geração de PDF, conjunto de seções |
| `classes.spec.mjs` | **As 12 classes em todos os 20 níveis** (240 fichas), mais a seção de recursos de cada uma |
| `especies.spec.mjs` | **As 11 espécies e todos os 16 antecedentes** |
| `importacao.spec.mjs` | Exportar, importar e round-trip nos dois sentidos entre os sites |
| `offline.spec.mjs` | Service Worker: instalação, navegação offline e cobertura de cache |
| `criacao-completa.spec.mjs` | Criação em lockstep nas 12 classes, além do passo 3 |
| `levelup.spec.mjs` | Transição entre níveis em 3 classes, comparando a ficha a cada subida |
| `magias-uso.spec.mjs` | Ficha com magias preparadas nas 8 classes conjuradoras |
| `inventario.spec.mjs` | Inventário e moedas renderizados |

### Testes pulados, e por quê

Três testes estão marcados com `test.skip` e o motivo está escrito no próprio
arquivo: conjurar uma magia e a fixture que a sustenta (exigiria replicar
regra de negócio dentro do teste), e arrastar item no inventário (o caminho
real é de toque, não de mouse). Um `skip` sem motivo escrito é omissão
silenciosa — ver `PERGUNTAS-PARA-REVISAO.txt`.

### Escopo: o que pode diferir do original

A refatoração exige que nada fora de `site/js/{sheet,creator}/` e dos dois
coordenadores mude. Duas exceções existem **de propósito**, e o motivo tem de
continuar escrito aqui — uma exceção sem motivo vira, com o tempo, uma
verificação que ninguém confia:

| Arquivo | Por quê |
|---|---|
| `site/sw.js` | Passou a consumir `js-precache.json`. A lista manual de 12 arquivos cobria 12 de 22 módulos antes da quebra e 12 de 61 depois — de 52,4% para 18,3%. Agora são 100%. |
| `.github/workflows/deploy.yml` | Gera `js-precache.json` varrendo `site/js/**`, espelhando o que já fazia para `dados/`. |

Tudo o mais — `dados/`, `css/`, `img/`, `index.html`, `manifest.json` e os 18
módulos JS fora de escopo — continua byte a byte idêntico ao `D-D_2024`.

### O projeto `offline`

Todos os testes bloqueiam o Service Worker de propósito, para o cache nunca
mascarar uma regressão. `offline.spec.mjs` é a exceção e roda num projeto
separado, serial, que o permite — porque ali o SW é o objeto do teste.

`classes.spec.mjs` e `especies.spec.mjs` leem as listas de `dados/`, de
`dados-classes.js` e a tabela de níveis de `levelup.js` por `dados.mjs` —
conteúdo novo entra na cobertura sozinho, sem ninguém lembrar de editar o
teste. Uma classe, espécie, antecedente ou nível novo é testado no dia em que
entra no jogo.

**Não há amostragem.** Toda classe, todo nível, toda espécie e todo
antecedente são cobertos, porque não existe subconjunto representativo: cada
combinação liga características, espaços de magia, dados de vida e recursos
diferentes, e é justamente um desses que uma extração mal feita silenciaria.

## Como os personagens são criados

Percorrer o wizard 240 vezes seria inviável. Em vez disso, os testes
de ficha semeiam o `localStorage` chamando a **fábrica do próprio app**:

```js
const store = await import('./js/store.js');
const p = store.criarPersonagemVazio();
Object.assign(p, { classe: 'Mago', nivel: 11, ... });
store.salvarPersonagem(p);
```

`store.js` é byte a byte idêntico nos dois sites, então os dois recebem o mesmo
personagem e a comparação mede a **renderização**, que é o que a refatoração
tocou.

## Por que esta suíte existe

A refatoração anterior quebrou o layout do criador trocando `wizard-nav-fixed`
por `wizard-nav` — uma classe que não existe no CSS. Ninguém percebeu até o
site estar publicado.

E durante *esta* refatoração, a suíte pegou um bug que nenhuma checagem
estática viu: um comentário `/* ... */` partido entre `impressao.js` e
`pdf.js`, que impedia o site inteiro de carregar. Cada metade continuava byte
a byte idêntica ao original — o que estava errado era a fronteira. Ver
`PERGUNTAS-PARA-REVISAO.txt`.

Por isso `paridade-basico.spec.mjs` afirma `position: fixed` explicitamente, e
por isso o teste de parse ESM (`checar_esm.mjs`) existe: `node --check` num
arquivo `.js` usa detecção de tipo e não força o parser de módulo, então deixa
esse erro passar. Copiar para `.mjs` força.
