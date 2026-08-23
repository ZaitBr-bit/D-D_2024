# Testes e2e

Duas suítes vivem aqui, com configurações separadas.

| Suíte | Config | O que garante |
|---|---|---|
| **Regras** | `regras/playwright.config.mjs` | As regras do livro, na tela. 263 casos. É a suíte que segura o comportamento do app. |
| **Offline** | `playwright.config.mjs` | Service Worker e precache. 3 casos, 2 deles dependentes de artefato de deploy. |

## Rodar

```bash
cd testes/e2e
npm run instalar                                          # uma vez: deps + Chromium
npx playwright test --config=regras/playwright.config.mjs  # regras (~5 min)
npx playwright test --config=playwright.config.mjs         # offline
npm run test:esm ../..                                     # parse ESM de todos os módulos
```

Um servidor estático local sobe sozinho na porta 8802.

**Isto é a única parte do projeto que usa Node.** A aplicação em `site/`
continua sem build e sem dependência nenhuma — `node_modules/` vive só aqui e
está no `.gitignore`.

## A suíte de paridade foi aposentada em 2026-08-23

Este diretório existia para uma pergunta: *"a tela refatorada é a mesma da
original?"*. Nove specs comparavam DOM, classes CSS e geometria contra o
repositório `D-D_2024` pré-refatoração, rodando os dois lado a lado.

Essa fase acabou, e o projeto já a tinha encerrado duas vezes antes:

- **2026-08-12** (decisão D9, `docs/superpowers/specs/2026-08-12-cards-de-escolha-design.md`)
  aposentou os testes de comparação de DOM do criador. Renomear
  `.selection-card` para `.opcao-card` quebra a comparação de forma
  definitiva — o repositório original não vai mudar.
- **2026-08-18** (`b02f1e1`) aposentou o baseline dos monólitos, com o
  argumento que vale para tudo aqui: *"verificador permanentemente vermelho
  não verifica nada; só ensina a ignorar a saída."*

O que restou depois dessas duas rodadas continuou comparando por snapshot
contra o original — que parou em `5c05bc8`, de **2026-08-08**. O `main` deste
projeto seguiu **20+ commits de feature** adiante: magias, espécies,
subclasses, pactos do Bruxo, atributos editáveis. Medido em 2026-08-23:
**299 falhas em 326 casos**, todas por evolução legítima, nenhuma por
regressão.

Atualizar a referência exigiria portar 20 commits de feature para dentro do
monólito antigo — o que não faz sentido. Apontá-la para um snapshot do
próprio projeto faria a suíte comparar o repositório com ele mesmo: verde que
não mede nada.

### O que saiu

Os 9 specs (`classes`, `criacao-completa`, `especies`, `ficha`, `importacao`,
`inventario`, `levelup`, `magias-uso`, `paridade-basico`), o projeto
`paridade` do config, o servidor da porta 8801, a constante `ORIG` e os 10
helpers que só a paridade usava — `abrirParelha`, `nosDois`, `instantaneo`,
`instantaneoFicha`, `irPara`, `geometria`, `classesUsadas`,
`primeiraDivergencia`, `relatorioErros`, `abrirFichaSemeada`.

Os 7 helpers que a suíte de regras usa ficaram: `assentar`, `satisfazerPasso`,
`confirmarModal`, `lerToastErro`, `passoAtual`, `resolverModalAberto`,
`semearPersonagem`.

### O que ficou, convertido

`offline.spec.mjs` era escrito como paridade — usava o original como controle
—, mas o valor dele nunca foi comparativo. Ele mede o Service Worker e o
precache, e documenta uma regressão real que pegou: o `sw.js` precacheava uma
lista manual de 12 arquivos, o que cobria 12 de 22 módulos antes da quebra dos
monólitos e passou a cobrir 12 de 61 depois. O arquivo já dizia que duas das
suas asserções eram alvos **absolutos**, porque *"exigir paridade seria exigir
que o novo fosse tão limitado quanto o antigo"*.

Todas viraram absolutas. O teste de paridade do criador saiu (o laço por site
já cobria o mesmo, de forma absoluta), e uma asserção duplicada foi removida.

### O que isso deixa descoberto

A paridade era o único instrumento **transversal** do projeto — o único que
olhava o app inteiro de uma vez. As suítes de regras e de unidade são
profundas por assunto, mas não têm esse alcance.

A revisão final do sub-projeto 3b de multiclasse mediu o custo disso: dos 145
pontos convertidos em `renderFeatureItem`, apenas 7 estão presos por algum
oráculo. Uma conversão parcial — o cenário normal de alguém esquecer uma
linha — passa por 19 oráculos pontuais sem acender luz nenhuma.

O substituto certo não é comparar contra um snapshot congelado, e sim um
**oráculo de alcance sobre o código atual**: renderizar cada uma das 12
classes como classe não inicial e comparar o hash do HTML com ela como classe
inicial, fora os `data-classe`. Um oráculo desses pega conversão parcial em
qualquer das 145 linhas. Está registrado em `docs/PERGUNTAS-PENDENTES.txt`
como recomendação para o sub-projeto 3c.

## Nota sobre os testes de offline

Dois dos três casos dependem de `site/js-precache.json`, gerado no deploy
(`.github/workflows/deploy.yml`) varrendo `site/js/**`. Numa cópia de trabalho
o arquivo não existe — o próprio `sw.js` trata isso como caso normal — e sem
ele o Service Worker cacheia apenas sob demanda.

Os dois casos se **pulam** quando o manifesto está ausente, com o motivo na
saída. Pular é mais honesto que falhar: a falha seria por ausência de
artefato, não por regressão, e é exatamente o vermelho permanente que este
projeto já decidiu não tolerar.
