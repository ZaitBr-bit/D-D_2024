# Diretrizes de desenvolvimento

Resumo para quem mexe neste repositório (pessoa ou agente). O detalhe está em
[docs/ARQUITETURA.md](docs/ARQUITETURA.md), seção *Diretrizes de desenvolvimento*.

## Interface

- **Lista com informação não usa dropdown**, a menos que o pedido diga o
  contrário. Magias, itens, invocações, talentos e qualquer lista em que cada
  entrada tenha descrição, pré-requisito ou efeito aparecem como **cards**, e
  clicar no card abre um **popup com as informações**. Dropdown só para valores
  curtos sem descrição (tipo de dado, moeda).
- **Descrição não se expande dentro do card**: vai para popup.
- **Todo bloco recolhível (`<details>`, seção, painel) nasce fechado**, a menos
  que o pedido diga expressamente que venha aberto. Dê um `data-details-id`
  estável para o estado escolhido pelo jogador sobreviver aos re-renders.
- **Cada recurso aparece onde é usado** (conjuração no card Magias), e blocos
  grandes nascem recolhidos. Pense primeiro no celular (390 px).
- Reaproveite `ui-opcoes.js`, `itens-seletor.js` e os chips de
  `sheet/recursos-classe.js` antes de criar componente novo.

## Código

- Comentários em **pt-BR**, objetivos (o fato e a consequência técnica). Toda
  função criada leva um comentário dizendo o que ela faz.
- **Multiclasse:** regra de classe nunca lê `char.classe`, `char.subclasse` ou
  `char.nivel`. Use `nivelNa`, `subclasseDe`, `temClasse`.
- Regra pura em `site/js/regras-*.js`, sem DOM e sem ler `char`.
- Campo novo de personagem: optional chaining na leitura, guarda na escrita,
  migração em `sheet/migracoes.js` se o schema mudar.
- `escHtml()` ao interpolar entrada do usuário em HTML.
- `data-*-acao` escrito por extenso no HTML do botão, não por interpolação.
- Dado do livro vem de `dados/`; se o app e o livro divergem, vale o livro.

## Testes

- Gatilho novo (botão com `id="btn-..."` ou `data-*-acao`) precisa de spec em
  `testes/e2e/regras/` que **clique** nele.
- Oráculo vermelho antes da correção: o teste nasce falhando, pelo motivo certo.
- `test.skip` leva o motivo escrito no arquivo.
- **Rode só os testes focados na alteração**: o spec e o teste de unidade do
  assunto (`npx playwright test --config=regras/playwright.config.mjs regras/<arquivo>.spec.mjs`,
  `node --test ../regras/unidade/<arquivo>.test.mjs`). A suíte completa
  (`npm run test:regras:e2e`, ~12 min) só quando o dono pedir. Se a mudança mexer em
  arquivo com teste por número de linha (`multiclasse-fundacao.test.mjs`), rode esse também.
  No fim, `scripts/limpar-processos-teste.ps1 -Matar`.

## Processo

- **Não commitar sem pedido expresso.** Staging arquivo a arquivo; nunca
  `git add -A`, `git add .` nem `git commit -a`.
- `docs/superpowers/` (specs, planos, revisões) não entra em commit, salvo pedido.
- Versão visível: `VERSAO_ATUAL` e a entrada no topo de `NOTAS_VERSAO`
  (`site/js/versao.js`) só mudam quando o dono do projeto pede, e precisam bater.
