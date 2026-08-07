# Testes de regras de negócio do livro — design

**Data:** 2026-08-06
**Status:** aprovado em brainstorming, aguardando plano de implementação

## Problema

A suíte atual em `testes/e2e/` é de **paridade**: compara este site com o
original `D-D_2024` e responde "a tela é a mesma da original?". Ela nunca
responde "o app obedece ao livro?". Um erro de regra presente nos dois sites
passa despercebido para sempre.

Exemplo concreto: o talento **Habilidoso** concede, segundo o livro
(`Informacoes Separadas/Talentos.md`), "proficiência em qualquer combinação de
três perícias ou ferramentas à sua escolha", e é **Repetível**. No app,
selecioná-lo não abre as opções de escolha — `REGRAS_TALENTOS` em
`site/js/regras-cobertura.js` não tem entrada para ele (a validação de
quantidade existe isolada em `site/js/levelup-validations.js`, mas a UI não
oferece os controles). Nenhum teste pega isso hoje.

## Objetivo

Criar uma suíte de **testes de regras de negócio** que confronta o app com o
livro, começando pelos **talentos** (piloto), com estrutura genérica que os
demais domínios reutilizam sem mudança.

**Fora de escopo deste projeto:** corrigir o app. Nenhum arquivo de `site/` é
alterado. As lacunas que a suíte revelar (como a do Habilidoso) viram projetos
seguintes, guiados pela lista de lacunas conhecidas.

## Decisões de design (com alternativas rejeitadas)

| Decisão | Escolha | Alternativa rejeitada e porquê |
|---|---|---|
| Escopo inicial | Talentos como piloto, mapa genérico dos demais domínios | Cobrir tudo de uma vez: grande demais para o primeiro resultado útil |
| Nível dos testes | Híbrido: unidade em Node + camada fina de Playwright | Só unidade: não vê a UI deixar de oferecer escolhas. Só e2e: lento e caro para 75 talentos |
| Fonte da verdade | Catálogo curado à mão com citação do livro | Parsear a prosa do markdown: frágil. Usar `dados/*.json` como verdade: as regras estão em prosa dentro das descrições, não dá para afirmar comportamento |
| Organização | Catálogo como dado + motor genérico de testes | Um spec manual por talento: 75 arquivos que divergem. Regras só dentro do app: o teste passaria a confiar no próprio mapa que deveria verificar |
| Falhas por lacuna do app | Anotadas como lacuna conhecida, suíte verde | Suíte vermelha: vira ruído. Corrigir junto: escopo sem limite conhecido |

## Mapa genérico de domínios

Ordem sugerida de implementação futura. Cada domínio acrescenta um arquivo de
catálogo e, se necessário, um motor novo — a estrutura não muda.

1. **Talentos** — piloto deste projeto (75 talentos em `dados/talentos/talentos.json`)
2. **Antecedentes** — talento de origem, perícias, ferramenta concedidos
3. **Espécies** — traços, deslocamento, magias raciais
4. **Classes/níveis** — características por nível, espaços de magia, escolhas de subclasse
5. **Magias** — preparo, limites por círculo
6. **Regras transversais da ficha** — CA, PV, bônus de proficiência, testes

## Estrutura de arquivos

```
testes/regras/
  README.md                      ← filosofia: paridade = "igual ao original";
                                    regras = "igual ao livro"
  catalogo/
    talentos.mjs                 ← expectativas curadas, 1 entrada por talento
  unidade/                       ← node:test (Node 22, zero dependência nova)
    harness.mjs                  ← stubs de globais + import dos módulos do app
    completude.test.mjs
    escolhas.test.mjs
    validacao.test.mjs
    passivos.test.mjs
  lacunas-conhecidas.mjs         ← lista viva de pendências do app vs. livro

testes/e2e/regras/               ← specs Playwright dirigidos pelo catálogo
  playwright.config.mjs          ← sobe só este site (porta 8802)
  helpers-regras.mjs
  talentos-levelup.spec.mjs
  talentos-criador.spec.mjs
  talentos-repetivel.spec.mjs
```

Os specs Playwright vivem em `testes/e2e/regras/` (e não em
`testes/regras/e2e/`) porque a resolução de módulos do Node procura
`@playwright/test` subindo a partir do arquivo que importa — e o
`node_modules/` existe apenas em `testes/e2e/`. Fora dessa árvore o import
falharia. O restante (catálogo, unidade, lacunas) não depende de nada e fica
em `testes/regras/`. A aplicação em `site/` segue sem build e sem dependência.

Efeito colateral: o projeto `paridade` em `testes/e2e/playwright.config.mjs`
usa `testDir: '.'`, que engoliria os specs novos do subdiretório — seu
`testIgnore` ganha `regras/**` (uma linha).

## O catálogo (`catalogo/talentos.mjs`)

Uma entrada por talento, curada à mão a partir de
`Informacoes Separadas/Talentos.md`, somente com campos verificáveis por
máquina:

```js
'Habilidoso': {
  livro: 'Talentos.md §Habilidoso',        // citação obrigatória
  categoria: 'de Origem',                  // conferida com dados/talentos.json
  prerequisito: null,                      // ou { nivel, atributo, estiloLuta }
  repetivel: true,
  escolhas: [{ tipo: 'pericia_ou_ferramenta', qtd: 3 }],
  // aumento_atributo: ['Força', ...]      // talentos Gerais que dão +1
  // passivos: { bonusIniciativa: 'proficiencia' }  // ex.: Alerta
},
```

Tipos de escolha previstos: `pericia`, `ferramenta`, `pericia_ou_ferramenta`,
`atributo_talento`, `atributo_salvaguarda`, `atributo_conjuracao`, `magia`,
`lista_magias`, `energia`, `estilo_luta` — a lista cresce conforme a curadoria
encontrar necessidade.

O que a prosa não permite verificar por máquina (ex.: "pode trocar Iniciativa
com um aliado") fica **fora do catálogo de propósito** — o texto descritivo já
é coberto pela extração em `dados/`.

A curadoria dos 75 talentos é parte do trabalho, feita por categoria
(de Origem → Geral → Estilo de Luta → Épico), sempre citando a seção do livro.

## Motor de unidade (`unidade/`, node:test)

Quatro confrontos, todos percorrendo o catálogo — adicionar um talento ao
catálogo é o único passo para ele entrar em todos:

1. **Completude** (`completude.test.mjs`) — todo talento de
   `dados/talentos/talentos.json` tem entrada no catálogo e vice-versa; a
   categoria bate; o schema de cada entrada é válido (entrada malformada falha
   com mensagem clara); toda citação `livro` corresponde a um título real em
   `Talentos.md` — citação quebrada é falha. Nada fica de fora em silêncio.
2. **Escolhas** (`escolhas.test.mjs`) — talento com `escolhas` no catálogo
   deve ter entrada em `REGRAS_TALENTOS` (`regras-cobertura.js`), que é o mapa
   que a UI consulta para renderizar os controles de escolha. Validações
   soltas e codificadas à mão em `levelup-validations.js` (caso do Habilidoso)
   **não contam** como cobertura — validar quantidade sem oferecer os
   controles é exatamente o bug que motivou o projeto. **É este teste que pega
   o Habilidoso hoje.**
3. **Validação** (`validacao.test.mjs`) — para cada talento com escolhas,
   `validarEscolhasTalento` aceita um conjunto válido e rejeita conjuntos
   inválidos: quantidade errada, duplicatas, sem proficiência prévia quando o
   livro exige.
4. **Passivos** (`passivos.test.mjs`) — personagem mínimo construído com
   `criarPersonagemVazio()` de `store.js` + o talento →
   `resolverPassivosTalentos()` de `talentos-effects.js` devolve os números do
   catálogo.

Módulos do app que tocam globais de navegador ao importar recebem stubs
mínimos (ex.: `localStorage`) no harness de unidade — mesmo princípio já usado
por `testes/e2e/dados.mjs`.

## Lacunas conhecidas (`lacunas-conhecidas.mjs`)

Lista única de `{ talento, teste, motivo }`. O motor marca essas falhas como
esperadas — a suíte fica verde e a lista é o artefato visível de pendências
contra o livro. Regras:

- **Motivo em branco é erro** — mesma disciplina do skip documentado da suíte
  de paridade.
- Quando o app for corrigido, o teste **passa a falhar por "passou mas estava
  na lista"**, cobrando a remoção da entrada. A lista não apodrece.

## Camada e2e (Playwright, dirigida pelo catálogo)

Config própria (`testes/regras/playwright.config.mjs`) que sobe **só este
site** na porta 8802, reaproveitando `servidor.mjs` e o `node_modules` de
`testes/e2e`. Sem servidor do repositório original. Service Worker bloqueado,
como na paridade.

1. **Escolhas na subida de nível** (`talentos-levelup.spec.mjs`) — para cada
   talento do catálogo com `escolhas`: selecioná-lo no level-up exibe os
   controles de escolha com a quantidade e opções do livro; a confirmação fica
   bloqueada até completar; após confirmar, as escolhas persistem no
   personagem salvo (ex.: perícias entram em `pericias_proficientes`).
2. **Talento de origem no criador** (`talentos-criador.spec.mjs`) —
   antecedente cujo talento de origem tem escolhas deve abrir as opções no
   passo do antecedente.
3. **Repetível** (`talentos-repetivel.spec.mjs`) — talento com
   `repetivel: true` pode ser escolhido de novo em ASI posterior; sem a marca,
   a segunda escolha deve ser impedida.

Personagens de partida são semeados via `criarPersonagemVazio()` +
`localStorage`, como a suíte de paridade já faz — o wizard completo não é
percorrido 75 vezes.

## Execução

Scripts em `testes/e2e/package.json`:

```
npm run test:regras            # unidade + e2e de regras
npm run test:regras:unidade    # só node --test ../regras/unidade/
npm run test:regras:e2e        # npx playwright test --config=../regras/playwright.config.mjs
```

A suíte de paridade continua intocada (`npm test`).

## Critérios de sucesso

1. Os 4 testes de unidade e os 3 specs e2e rodam verdes com as lacunas
   conhecidas anotadas.
2. O catálogo cobre 100% dos 75 talentos — garantido por teste, não por
   disciplina.
3. **Habilidoso aparece em `lacunas-conhecidas.mjs`** com motivo escrito — a
   suíte prova que detecta a classe de problema que motivou o projeto.
4. Toda entrada do catálogo cita uma seção real do livro — garantido por teste.
5. Nenhum arquivo de `site/` alterado; em `testes/e2e/` mudam apenas
   `package.json` (scripts novos), `playwright.config.mjs` (o `testIgnore`
   `regras/**` no projeto paridade) e o subdiretório novo `regras/`.
