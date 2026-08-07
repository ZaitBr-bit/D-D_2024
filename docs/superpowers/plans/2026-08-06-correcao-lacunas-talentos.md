# Correção das lacunas de talentos — plano

**Data:** 2026-08-06
**Origem:** as 11 lacunas `app-diverge-do-livro` registradas em
`testes/regras/lacunas-conhecidas.mjs` pela suíte de regras.

## Objetivo

Fazer o app honrar o livro nos 7 talentos com divergência confirmada, e
remover as entradas correspondentes da lista de lacunas.

**O critério de aceitação já existe e é automático.** A mecânica de
`comLacuna` / `test.fail` inverte quando o app é corrigido: um teste que passa
estando na lista **falha** exigindo a remoção da entrada. Ou seja, a suíte diz
sozinha quando cada correção ficou pronta, e impede que a lista apodreça.

## Causa raiz (uma só, para 9 das 11 lacunas)

Os 7 talentos não têm entrada em `REGRAS_TALENTOS`
(`site/js/regras-cobertura.js`). Esse mapa é o que dispara os três
comportamentos, e sem ele os três somem de uma vez:

| Consequência | Onde |
|---|---|
| `getRegraTalento(nome)` devolve `null`, então `obterEscolhasObrigatoriasTalento` devolve `[]` | `regras-cobertura.js:78-92` |
| Na ficha, `atributosASI` e `escolhasObrigatorias` vazios → `persistirTalento()` direto, **sem abrir o modal de escolhas** | `sheet/talentos.js:663-669` |
| `validarEscolhasTalento` cai no `return { valido: true }` final, aceitando qualquer conjunto | `regras-cobertura.js:104-106` |
| `aplicarEfeitoTalento` não tem ramo, então as escolhas **não são persistidas** | `regras-cobertura.js:208+` |

Cada fluxo compensou isso com verificação escrita à mão — level-up em
`levelup-validations.js:114-119`, criador em `passo-antecedente.js:153-168` e
`passo-especie.js:396-408` — e a quarta porta (ficha) ficou sem nenhuma. É
exatamente o padrão que o guia de próximos domínios registra: regra validada à
mão em vez de declarativamente é sintoma de que existe um caminho descoberto.

As 2 lacunas restantes são de conteúdo, não de estrutura: listas de opções que
não batem com o livro.

## Escopo

**Altera `site/`** — ao contrário do projeto que criou a suíte, este corrige o
app. Arquivos previstos: `regras-cobertura.js`, `levelup-ui.js`,
`sheet/talentos.js` (só se necessário), `creator/comum.js` (só se necessário).

**Não altera** a suíte de regras, exceto para remover as entradas de lacuna que
deixarem de valer — e essa remoção é exigida pelos próprios testes.

### Sobre a suíte de paridade

A paridade compara este repositório com `../D-D_2024` e responde "a tela é a
mesma da original?". Corrigir um bug **por definição** faz as duas divergirem.
O usuário confirmou que o DeD_2024 substituirá o D-D_2024, então a comparação
com o original deixou de fazer sentido como restrição.

Este plano portanto **não trata falha de paridade como bloqueio**. Mede o
impacto e reporta quais testes divergiram e por quê, sem apagar nem reescrever
a suíte — o que fazer com ela é decisão separada.

## Tarefas

### Tarefa A — Habilidoso, Artifista e Músico (6 lacunas)

Os três seguem o mesmo formato: 3 escolhas de uma lista, sem aumento de
atributo, e o livro não impõe pré-requisito.

| Talento | O que o livro concede | Onde persistir |
|---|---|---|
| Habilidoso | 3 perícias **ou** ferramentas, em qualquer combinação | `pericias_proficientes` / `proficiencias_ferramentas` |
| Artifista | 3 Ferramentas de Artesão distintas | `proficiencias_ferramentas` |
| Músico | 3 Instrumentos Musicais distintos | `proficiencias_instrumentos` |

1. Entrada em `REGRAS_TALENTOS` para cada um, declarando as escolhas.
2. Ramo em `validarEscolhasTalento`: exatamente 3, distintas, e cada uma
   pertencente à lista válida do talento. Mensagem de erro nomeando o talento.
3. Ramo em `aplicarEfeitoTalento` que grava as 3 escolhas no campo certo do
   personagem, sem duplicar (usar `adicionarUnico`).
4. Conferir que os ramos de render já existentes em `levelup-ui.js` continuam
   funcionando e que a ficha passa a abrir o modal.

**Fecha:** `Habilidoso/Artifista/Músico [e2e-ficha]` e
`Habilidoso/Artifista/Músico [validacao-negativa]`.

### Tarefa B — Analítico, Mente Aguçada e Adepto Elemental (3 lacunas)

Dois problemas distintos por talento: rótulo errado e escolha não exigida.

1. **Corrigir as listas de opções em `levelup-ui.js`** para os termos exatos do
   livro:
   - Analítico → `Intuição, Investigação, Percepção` (hoje oferece Medicina e
     omite Percepção) — `Talentos.md:268`
   - Adepto Elemental → `Ácido, Elétrico, Gélido, Ígneo, Trovejante` (hoje
     Frio/Fogo/Trovão) — `Talentos.md:244`
   - Mente Aguçada → já correto, conferir
2. Entrada em `REGRAS_TALENTOS`, validação e efeito para os três, de modo que
   a escolha passe a ser **exigida** antes de concluir.
3. **Regra do livro que o app não implementa hoje:** Analítico diz "Se não
   tiver proficiência na perícia escolhida, você a adquire; se já for
   proficiente, adquire Especialização". O efeito precisa fazer os dois casos.
4. Adepto Elemental é repetível com tipo de dano diferente a cada vez —
   a validação precisa recusar um tipo já escolhido, como
   `Iniciado em Magia` já faz para listas de magia.

**Fecha:** `Analítico/Adepto Elemental/Mente Aguçada [e2e-levelup]`.

### Tarefa C — Mestre das Armas (2 lacunas)

O único sem nenhum tratamento no app. O livro (`Talentos.md:532`) dá
"Propriedade de Maestria": escolher um tipo de arma Simples ou Marcial com que
você tenha proficiência, trocável a cada Descanso Longo.

1. Ramo de render em `levelup-ui.js` com a lista de armas (fonte:
   `dados/equipamento/armas.json`).
2. Entrada em `REGRAS_TALENTOS`, validação (arma existente e única) e efeito.
3. Verificar se plugga no sistema de maestrias já existente
   (`site/js/sheet/maestrias.js`) em vez de criar um paralelo.

**Fecha:** `Mestre das Armas [escolhas]` e `Mestre das Armas [e2e-levelup]`.

### Tarefa D — Fechamento

1. Rodar a suíte de regras inteira. Cada teste que agora **falha por passar**
   indica uma lacuna corrigida: remover a entrada de
   `lacunas-conhecidas.mjs`.
2. Atualizar a seção de achados do `testes/regras/README.md`.
3. Medir e reportar o impacto na suíte de paridade — sem alterá-la.

## Critérios de sucesso

1. As 11 entradas `app-diverge-do-livro` saíram da lista; restam as 4
   `limitacao-observabilidade`, que não são bugs do app.
2. Suíte de unidade e suíte de regras no navegador, ambas verdes.
3. Nenhuma regressão funcional no app fora dos 7 talentos.
4. O impacto na paridade está medido e escrito, não descoberto por acaso
   depois.

## Resultado (2026-08-06)

Executado em quatro tarefas (A, B, C e este fechamento — D), cada uma com
relatório próprio em `.superpowers/sdd/correcao-lacunas/tarefa-{a,b,c}-report.md`.

- **As 11 entradas `app-diverge-do-livro` saíram da lista**, como previsto.
  Mas o critério de sucesso 1 estava impreciso: das 4 `limitacao-observabilidade`
  previstas para sobrar, **3 desapareceram como efeito colateral** — assim que
  Adepto Elemental/Analítico/Mente Aguçada ganharam entrada em
  `REGRAS_TALENTOS` (para fechar `app-diverge-do-livro`), a rota de teste que
  antes era "cega" ao mecanismo hard-coded passou a enxergá-los pelo canal
  declarativo, e a lacuna de `escolhas` ficou estruturalmente inválida.
  **`lacunas-conhecidas.mjs` tem hoje exatamente 1 entrada** —
  `Aumento no Valor de Atributo` em `escolhas`, `limitacao-observabilidade` —
  não as 4 estimadas no plano. Contagem verificada por script, não copiada de
  relatório:
  `node -e "import('./testes/regras/lacunas-conhecidas.mjs').then(m => console.log(m.LACUNAS.length))"`
  → `1`.
- **Causa raiz confirmada**: das 11 divergências, 9 vieram de os sete talentos
  não terem entrada em `REGRAS_TALENTOS`. Corrigir isso ali, em vez de nos
  fluxos individuais, consertou mais do que o previsto — o botão "+ Talento"
  da ficha (a quarta via, sem nenhuma checagem manual) passou a funcionar sem
  que `sheet/talentos.js` precisasse de nenhuma linha alterada, porque esse
  arquivo já dependia do mapa declarativo, só que o mapa estava vazio para
  esses talentos.
- **Suíte de unidade**: 339/339 passando (reconfirmado ao final da Tarefa D).
- **Suíte de regras no navegador** (Playwright,
  `--config=regras/playwright.config.mjs`): 72/72 passando (reconfirmado ao
  final da Tarefa D).
- **Impacto na paridade**: medido e sem alteração. `cd testes/e2e && npm test`
  continua em **328 passed / 1 skipped**, byte a byte igual ao baseline antes
  da correção — os caminhos de código corrigidos simplesmente não são
  exercitados pela suíte de paridade. Nenhuma linha da suíte de paridade foi
  tocada, conforme o plano previa.
- **Nenhuma regressão fora do escopo** foi relatada pelas três tarefas: os
  arquivos alterados foram só `site/js/regras-cobertura.js`,
  `site/js/levelup-ui.js`, `site/js/sheet/maestrias.js` e
  `testes/regras/lacunas-conhecidas.mjs`.

Critério de sucesso 1 é reclassificado aqui como **superado, não cumprido ao
pé da letra**: a lista final tem 1 entrada, não as 4 previstas — a diferença é
a favor da correção (menos lacunas remanescentes do que o plano estimava), não
contra.
