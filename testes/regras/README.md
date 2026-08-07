# Testes de regras de negócio

Confrontam este app com o **livro** (D&D 5.5, `Informacoes Separadas/`),
executando as regras reais — talentos, antecedentes e as fórmulas transversais
da ficha — contra o que a ficha e o assistente de criação/subida de nível
realmente fazem.

A pergunta que esta suíte responde não é "a tela é a mesma do original" — essa
é a paridade, em `testes/e2e/`. É **"o app obedece ao livro?"**. As duas
perguntas são independentes: um erro presente nos dois sites (original e
refatorado) passa na paridade *para sempre*, porque paridade só compara os
dois lados entre si. É esta suíte que confronta cada lado com a regra escrita
e pega esse erro.

> **Vai começar um domínio novo?** Leia antes o
> [GUIA-PROXIMOS-DOMINIOS.md](GUIA-PROXIMOS-DOMINIOS.md). Ele registra os erros
> que as rodadas anteriores cometeram — entre eles 31 lacunas falsas, um bug
> que só apareceu no quarto caminho de aquisição e duas fórmulas dadas como
> ausentes do livro que existiam — e traz o checklist de pré-voo. Quase nenhum
> deles é óbvio no momento em que se comete.

## A paridade não é mais restrição

Isto muda como você trabalha, então está aqui e não numa nota de rodapé.

A suíte de paridade (`testes/e2e/`, 329 testes) compara este repositório com o
original `D-D_2024` e existiu para guardar a refatoração: qualquer diferença
era regressão, por definição. **Esse papel acabou.** O DeD_2024 vai substituir
o D-D_2024, então comparar o projeto de correções com o original deixou de
fazer sentido como restrição.

Na prática, ao corrigir um bug que esta suíte encontrar:

- **Falha de paridade não bloqueia a correção.** Corrigir um bug faz os dois
  lados divergirem — é o resultado esperado, não um problema a evitar.
- **Ainda vale medir antes e depois**, e escrever o resultado. Nas três rodadas
  de correção até aqui a paridade ficou idêntica (328 passando, 1 pulado), o
  que não significa "não houve regressão": significa que ela não exercita os
  caminhos alterados. Quem cobre esse território é esta suíte.
- **Ninguém apagou nem reescreveu a paridade**, e isso é decisão em aberto. Ela
  ainda pega regressão de renderização em tudo que a correção não tocou.

## Fonte da verdade

`catalogo/talentos.mjs` é curado à mão a partir de
`Informacoes Separadas/Talentos.md`: uma entrada por talento, cada uma com
citação do livro (`livro: 'Talentos.md §Nome'`). Não é gerado por parser —
prosa de regra em Markdown é ambígua demais para extrair automaticamente com
confiança, e um catálogo errado invalidaria tudo o que roda em cima dele.

Duas garantias são checadas por teste, não por convenção:
- **Completude**: `completude.test.mjs` confere bijeção entre o catálogo e
  `dados/talentos/talentos.json` — todo talento de um lado existe do outro,
  sem faltantes nem órfãos. Hoje são **75 talentos**.
- **Citação real**: o mesmo teste lê os títulos `### Nome` de `Talentos.md` e
  confirma que todo `livro: '...'` do catálogo aponta para uma seção que
  existe de verdade — uma citação inventada ou desatualizada quebra a suíte.

## Como rodar

A partir de `testes/e2e/` (é a única árvore do projeto com `node_modules` —
ver a seção sobre os specs Playwright abaixo):

```bash
cd testes/e2e
npm run test:regras            # as duas suítes de regras, em sequência
npm run test:regras:unidade    # só os 7 motores de node:test
npm run test:regras:e2e        # só os specs Playwright (regras/*.spec.mjs)
```

`test:regras:unidade` usa `node --test` apontando para
`"../regras/unidade/*.test.mjs"` — o glob é passado **entre aspas** de
propósito. A forma sem aspas (`node --test ../regras/unidade/`) falha com
`MODULE_NOT_FOUND` neste Node/Windows; não simplifique.

## A mecânica de `lacunas-conhecidas.mjs`

Nem todo confronto com o livro passa hoje — o app tem lacunas reais. Em vez de
deixar a suíte vermelha (que vira ruído e é ignorada) ou de tentar corrigir o
app dentro deste projeto (escopo sem fim), cada gap conhecido vira uma entrada
registrada em `lacunas-conhecidas.mjs`, com um `motivo` explicando o que foi
observado e onde.

O mecanismo (`comLacuna`, em `unidade/harness.mjs`, e `test.fail` nos specs
Playwright) inverte a expectativa só para esse par (talento, teste):

- **Sem lacuna registrada**: o teste roda normal — precisa passar.
- **Com lacuna registrada**: o teste precisa **falhar**. Se o app for
  corrigido e o confronto passar a passar de verdade, a suíte quebra —
  *"Lacuna corrigida: remova { talento, teste } de lacunas-conhecidas.mjs"* —
  e cobra a remoção da entrada. A lista nunca fica desatualizada por
  negligência.
- **Motivo em branco é erro**: `completude.test.mjs` rejeita qualquer entrada
  sem `motivo` preenchido.

Por isso a lista **é o backlog real** de correções do app contra o livro — não
uma nota de rodapé. Cada entrada é uma alegação de que o app está errado num
ponto específico e citável. Uma entrada falsa (um gap que na verdade não
existe) é **pior** que uma entrada faltando: uma lacuna ausente é só um teste
vermelho esperando alguém investigar; uma lacuna falsa é a suíte inteira
mentindo verde sobre um bug que não existe, escondendo o próximo bug de
verdade que cair no mesmo talento.

## A mecânica de `excecoes-escolha-repetida.mjs`

`escolha-morta.test.mjs` (ver tabela abaixo) tem sua própria lista de
exceções, `excecoes-escolha-repetida.mjs` — deliberadamente um módulo
separado de `lacunas-conhecidas.mjs`, não um export dentro dele.

O motivo é o invariante da seção acima: toda entrada de `LACUNAS` é "o app
está errado". Uma entrada de `excecoes-escolha-repetida.mjs` afirma o
**oposto** — "o app está CERTO em aceitar a mesma escolha de novo, porque o
livro concede algo A MAIS na repetição" (Tocado Por Fadas e Tocado Pelas
Sombras deixam a magia sempre preparada com uma conjuração grátis por
Descanso Longo; Conjurador Ritualista soma Ritual Rápido; Dádiva da
Resistência à Energia habilita a Reação de Redirecionamento para o tipo
escolhido de novo). Misturar as duas listas no mesmo array quebraria a leitura
de `LACUNAS` como "toda entrada é um bug" — quem lesse teria de checar um
campo extra para saber se está olhando um defeito ou o seu espelho. Duas
listas separadas mantêm os dois invariantes limpos.

O mecanismo (`excecaoEscolhaRepetida`, usado por `escolha-morta.test.mjs`) é
a mesma inversão de expectativa que `comLacuna` já faz, aplicada ao caso
oposto:

- **Sem exceção registrada**: a mesma escolha, reoferecida a um personagem já
  saturado, precisa ser **recusada**. Se for aceita, é escolha morta — falha.
- **Com exceção registrada**: a mesma escolha precisa continuar sendo
  **aceita**. Se o app passar a recusá-la, o teste quebra pedindo a remoção da
  entrada — o ganho real que a justificava deixou de existir, ou nunca
  existiu.
- **Motivo em branco é erro**, mesmo padrão de `LACUNAS`: `completude.test.mjs`
  rejeita qualquer entrada sem talento real no catálogo ou sem `motivo`
  preenchido, e cada `motivo` precisa citar a seção do livro e o benefício
  extra concreto — não basta dizer "é exceção".

Hoje são **4 entradas**: Tocado Por Fadas, Tocado Pelas Sombras, Conjurador
Ritualista e Dádiva da Resistência à Energia — as quatro verificadas linha a
linha contra `Talentos.md` no relatório de desenho do motor
(`.superpowers/sdd/correcao-lacunas/motor-escolha-morta-report.md`).

## O que cada motor prova — e o que não prova

Sete motores de `node:test` em `unidade/`, mais cinco specs Playwright em
`../e2e/regras/`. Cada um confronta uma fatia diferente do livro, e nenhum
sozinho prova a regra inteira.

| Motor | O que confronta | Testes |
|---|---|---|
| `completude.test.mjs` | Catálogo × `dados/`: bijeção, schema (1 por talento, incluindo `opcoes` e `aumento_atributo`), citação real, higiene das lacunas (incluindo o campo `tipo`) e higiene das exceções de escolha repetida | 80 |
| `escolhas.test.mjs` | Talento com escolha no livro é *reconhecido* pelo app (via `obterAtributosASITalento` para ASI embutido, ou `REGRAS_TALENTOS`/`talentoExigeEscolhas` para o resto) — **e**, para as 75 entradas, `aumento_atributo` do catálogo confrontado contra `obterAtributosASITalento` (achado I3: campo curado à mão que antes nada confrontava) | 134 |
| `validacao.test.mjs` | Um exemplo válido (curado do livro) é aceito; mutações inválidas (item removido, duplicata) são rejeitadas, quando aplicável | 64 |
| `passivos.test.mjs` | Bônus numéricos e flags internas que `resolverPassivosTalentos()` deveria produzir | 62 |
| `escolha-morta.test.mjs` | Uma escolha reoferecida depois de saturar o personagem (aplicar o efeito até não crescer mais) precisa ser recusada — nenhuma seção do livro proíbe isso com todas as letras, é o próprio estado do app confrontado contra si mesmo | 59 (15 rodam a asserção; **44 skip**, cada um com o motivo escrito no próprio `t.skip`) |
| `antecedentes.test.mjs` | Catálogo dos 16 antecedentes × `dados/origens/antecedentes.json`: bijeção/schema/citação (19), os cinco campos do livro por antecedente (atributos, talento, perícias, ferramenta, equipamento — 80), e coerência cruzada com `catalogo/talentos.mjs` (o talento de origem existe e é `'de Origem'` — 16) | 115 |
| `ficha-transversal.test.mjs` | Completude do catálogo (MODIFICADORES_ATRIBUTO cobre exatamente 1-30, EVOLUCAO_PERSONAGEM cobre exatamente 1-20, PV_NIVEL_1/PV_NIVEL_SEGUINTE cobrem exatamente as classes de CLASSES_INFO) e validação de citações (todas as entradas de CITACOES resolvem para trechos reais do livro); mais as fórmulas transversais da ficha confrontadas com as tabelas do livro por **varredura exaustiva** (não amostragem): modificador de atributo (30/30 valores), Bônus de Proficiência (20/20 níveis) e `calcularNivelPorXP` (os 20 pisos, mais interior de faixa e bordas), PV de nível 1 e dos níveis seguintes (12 classes × mod. Constituição -5..+10, e também × níveis 1-20 para os níveis seguintes), CA base sem armadura (30 valores de Destreza), CD e ataque de magia (8 classes conjuradoras × 20 níveis × 30 valores de atributo) e Percepção Passiva (3 estados de proficiência × 30 valores de Sabedoria × 20 níveis) | 14 |

Total: **528 testes** em `unidade/` — **484 passam, 44 skip, 0 falham**. Os
skips não somem dentro do total: são talentos cujo `aplicarEfeitoTalento` não
faz nenhum campo de lista crescer (fora do escopo deste motor específico, não
do livro), e cada um carrega o motivo por escrito — um skip silencioso, aqui,
seria a mesma omissão que uma lacuna sem `motivo` já é proibida de ser. Nenhum
skip novo veio do motor de antecedentes nem do de regras transversais da
ficha.

### O que `escolha-morta.test.mjs` cobre que os outros quatro não cobrem

Os quatro motores acima fazem, cada um à sua maneira, a mesma pergunta: **"o
app faz o que o livro manda?"** — um exemplo válido é aceito, uma mutação
inválida é rejeitada, um bônus bate com o texto. Todos citam uma frase do
livro como padrão de comparação.

`escolha-morta.test.mjs` faz uma pergunta que nenhuma frase do livro responde
diretamente: **"o app evita oferecer uma escolha que não concederia nada?"**
Proficiência repetida, maestria repetida, uma perícia que já tem
Especialização — o livro nunca lista isso como proibição, porque é um
princípio implícito, não uma regra citável por talento. Por isso o motor não
compara contra um valor esperado do catálogo: ele aplica o efeito de verdade
num personagem limpo até saturar (ver comentário no próprio arquivo sobre
talentos de dois estágios, como Analítico/Mente Aguçada), e então confronta o
app contra o **próprio estado que acabou de criar** — a mesma escolha,
reoferecida, precisa ser recusada.

Essa lacuna de cobertura não era teórica: os dois rounds de bugs que
motivaram este motor (commits `5606c52` e `a0e3793`) foram achados por um
humano perguntando "isso devia estar oferecendo essa opção de novo?", não
pela suíte — nenhum dos quatro motores anteriores, nem os specs Playwright,
tinha uma pergunta capaz de pegar esse formato de bug, porque nenhum deles
compara o app contra o livro num ponto em que o livro é silencioso.

`escolhas.test.mjs` tem um limite explícito no próprio arquivo: ele não
enxerga ramos de renderização "hard-coded" por nome dentro de
`levelup-ui.js:renderEscolhasTalento` (o `<select>` específico de Adepto
Elemental/Analítico/Mente Aguçada existe só como HTML gerado em runtime). A
pergunta "o controle realmente aparece na tela, com as opções certas, e é
exigido antes de concluir?" só o Playwright consegue responder — é o que os
quatro specs de talentos em `../e2e/regras/` fazem, dirigindo o navegador de
verdade contra este site (**72 testes**):

| Spec | O que confronta | Testes |
|---|---|---|
| `talentos-levelup.spec.mjs` | Um talento com escolhas, escolhido na subida de nível: a tela oferece os controles certos (nas duas direções — faltando OU sobrando, achado M5), recusa concluir sem preenchê-los e persiste o que foi escolhido no campo específico onde o app grava (achado M6), incluindo o talento em si e o incremento do atributo do ASI embutido (achado I2) | 59 |
| `talentos-criador.spec.mjs` | O mesmo confronto pelas outras duas vias de aquisição no assistente de criação: talento de origem do antecedente, e traço Versátil da espécie Humana | 5 |
| `talentos-repetivel.spec.mjs` | Talento já adquirido reaparece na lista do level-up quando (e só quando) o livro o marca como repetível — casos derivados do catálogo (achado M8), não mais uma lista fixa | 5 |
| `talentos-ficha.spec.mjs` | A **quarta** via de aquisição, descoberta na rodada de 2026-08-06: o botão "+ Talento" da ficha (fora do criador e do level-up), para Habilidoso/Artifista/Músico — é a via que reproduz o sintoma que abriu este projeto | 3 |

Antecedentes tem uma via só de aquisição (ver "Achados desta rodada", mais
abaixo, para o porquê), então um quinto spec cobre os 16 antecedentes do
catálogo inteiros num único fluxo contínuo pelo assistente de criação
(**39 testes**):

| Spec | O que confronta | Testes |
|---|---|---|
| `antecedentes.spec.mjs` | As cinco partes do livro, para os 16 antecedentes, ao vivo no assistente: as duas perícias entram em `pericias_proficientes`, o talento de origem correto é concedido (incluindo a lista de magias de Iniciado em Magia), a distribuição de atributo (+2/+1 e +1/+1/+1) restringe aos três atributos do antecedente e persiste na forma escolhida, a ferramenta/instrumento do antecedente entra em `proficiencias_ferramentas`/`.proficiencias_instrumentos`, e a escolha entre pacote e 50 PO persiste (moedas e inventário, incluindo o item do pacote resolvido para a escolha real). Os 39 casos passam de verdade — as 21 lacunas que este spec registrou na rodada de 2026-08-05 foram corrigidas em 2026-08-07 (ver "Achados do domínio Antecedentes") | 39 |

Total dos cinco specs: **111 testes**, todos verdes de verdade — nenhum cita
`test.fail()` sobre uma lacuna hoje (ver a mecânica de `lacunas-conhecidas.mjs`,
acima).

`irAteEscolhaDeTalento` (a navegação até a tela de ASI/talento) e
`sementeParaTalento` (a escolha de personagem-semente por pré-requisito do
talento) vivem em `helpers-regras.mjs` e são importados pelos dois specs que
dirigem o level-up (`talentos-levelup.spec.mjs` e
`talentos-repetivel.spec.mjs`) — achado I1: até esta rodada, cada spec tinha
sua própria cópia da navegação, e só a de `talentos-levelup.spec.mjs` tinha
sido endurecida (`waitForSelector('#modal-overlay')` + retry, em vez de um
`waitForTimeout` fixo) depois de reproduzir uma falha de corrida sob 4
workers (`--repeat-each=4 --workers=4` dava ~11% de falha). A cópia de
`talentos-repetivel.spec.mjs` nunca recebeu o mesmo endurecimento. Uma cópia
só, importada pelos dois, impede a divergência de voltar.

### O limite do motor de passivos, em voz alta

`passivos.test.mjs` é o motor com o limite mais fácil de mal-entender, porque
**"62/62 verde" parece uma garantia mais forte do que é**.

Os campos `passivos` e `flags` do catálogo — os bônus numéricos e os nomes de
flag interna que cada talento deveria acionar — não foram extraídos do livro
sozinho. Foram curados **lendo `site/js/talentos-effects.js`**, porque o app é
o dono dos nomes internos de flag (`alerta_troca_iniciativa`,
`artifista_desconto`, etc.) — o livro não os menciona, eles só existem dentro
do código. Para escrever uma expectativa como
`flags: ['curandeiro_medico_combate']` no catálogo, alguém teve que primeiro
ler o código do app, confirmar que aquele nome de flag corresponde de fato ao
efeito descrito em `Talentos.md §Curandeiro`, e só então transcrever.

Isso significa que rodar `passivos.test.mjs` hoje prova sobretudo que **o
catálogo continua transcrevendo o app corretamente** — é uma rede de
regressão: se alguém renomear uma flag ou mudar um valor em
`talentos-effects.js` sem atualizar o catálogo (ou vice-versa), o teste
quebra. Ele **não prova, sozinho**, que o app obedece ao livro nesse ponto —
quem fez essa confrontação foi a etapa de curadoria, uma vez, por leitura
humana, no momento em que a entrada foi escrita. Se a curadoria errou (leu mal
o livro ou mal o código), o teste passa dos dois lados e o erro não é pego
aqui.

## Por que os specs Playwright vivem em `testes/e2e/regras/`

`testes/regras/` guarda catálogo e motores de `node:test` — zero dependência
de Node além do runtime. Mas os cinco specs que dirigem o navegador de
verdade (`talentos-levelup.spec.mjs`, `talentos-criador.spec.mjs`,
`talentos-repetivel.spec.mjs`, `talentos-ficha.spec.mjs`,
`antecedentes.spec.mjs`) precisam de `@playwright/test`, e a resolução desse
pacote sobe a árvore de diretórios a partir do arquivo que o importa.
`testes/e2e/` é o **único** `node_modules` do projeto (a aplicação em `site/`
continua sem build e sem dependência nenhuma). Por isso os specs moram em
`testes/e2e/regras/`, com config própria
(`testes/e2e/regras/playwright.config.mjs`, que sobe só este site, sem o
original) — e os scripts `test:regras:*` em `testes/e2e/package.json` são o
jeito de rodar as duas metades (unidade e e2e) sem sair dessa árvore.

## Achados desta rodada (encontrados em 2026-08-05, corrigidos em 2026-08-06)

O produto real deste projeto não foi "339 + 72 testes verdes" — foi a lista de
lacunas que eles produziram. Quando a rodada de testes fechou,
`lacunas-conhecidas.mjs` tinha **15 entradas**, todas em talentos de escolha
(nenhuma em passivos/flags), distinguidas por um campo `tipo` (achado I4):

- **`'app-diverge-do-livro'`** (11 entradas, **7 talentos**): o app fazia algo
  diferente do que o livro manda, confirmado por leitura de código e/ou
  empiricamente no navegador. Este era o backlog real — e é o que uma rodada
  de correção, em 2026-08-06, fechou por completo: **as 11 entradas foram
  corrigidas e removidas**. O plano e os relatórios de execução vivem em
  `docs/superpowers/plans/2026-08-06-correcao-lacunas-talentos.md` e
  `.superpowers/sdd/correcao-lacunas/tarefa-{a,b,c}-report.md`. O que cada uma
  era, e o que a corrigiu:
  - **Mestre das Armas** — a tela de subida de nível não renderizava *nenhum*
    controle para a escolha de arma da "Propriedade de Maestria" que o
    livro exige (`Talentos.md:532`). Nem sequer aparecia um `<select>`
    errado; não aparecia nada. Confirmado dos dois lados (`escolhas`: nenhum
    ramo em `levelup-ui.js:renderEscolhasTalento` para este talento;
    `e2e-levelup`: a tela mesma, ao vivo, não oferecia nada). Era o único dos
    sete sem nenhum tratamento no app. **Corrigido**: ganhou entrada em
    `REGRAS_TALENTOS` (`regras-cobertura.js`), um ramo de render em
    `levelup-ui.js` com a lista de armas Simples/Marciais
    (`ARMAS_SIMPLES_MARCIAIS`, curada de `dados/equipamento/armas.json`), e
    passou a gravar a arma escolhida em `char.maestrias_arma` — reaproveitando
    o sistema de maestrias já existente (`sheet/maestrias.js`), que ganhou uma
    vaga extra (`bonusMaestriaTalento()`) em vez de um campo paralelo.
  - **Adepto Elemental** — o `<select>` de tipo de dano existia, mas com três
    rótulos trocados: oferecia Frio/Fogo/Trovão onde o livro pede
    Gélido/Ígneo/Trovejante (`Talentos.md:244`). Além disso, a escolha não era
    exigida para concluir a subida de nível. **Corrigido**: os rótulos passaram
    a vir de `TIPOS_DANO_ADEPTO_ELEMENTAL` (derivada de `TIPOS_ENERGIA`, para
    nunca divergir de novo), e a nova entrada em `REGRAS_TALENTOS` passou a
    exigir a escolha — inclusive recusando um tipo de dano já escolhido numa
    aquisição anterior (o talento é repetível).
  - **Analítico** — o `<select>` de perícia oferecia Medicina no lugar de
    Percepção (`Talentos.md:268`) — Percepção nunca aparecia como opção. A
    escolha também não era exigida para concluir. **Corrigido**: a lista
    passou a ser `PERICIAS_ANALITICO = ['Intuição', 'Investigação',
    'Percepção']`, a escolha passou a ser exigida, e o efeito passou a
    implementar a regra do livro que o app não fazia em lugar nenhum antes
    ("se não tiver proficiência na perícia escolhida, você a adquire; se já
    for proficiente, adquire Especialização").
  - **Mente Aguçada** — as opções do `<select>` já batiam com o livro (nenhum
    rótulo trocado), mas, como os dois talentos acima, a tela deixava
    concluir a subida sem preencher a escolha. **Corrigido**: mesma entrada
    declarativa em `REGRAS_TALENTOS` passou a exigir a escolha, e o mesmo
    efeito proficiência-ou-Especialização passou a se aplicar.
  - **Habilidoso, Artifista, Músico** (`validacao-negativa`) —
    `validarEscolhasTalento`, a função central de validação do app, aceitava
    QUALQUER conjunto de escolhas para estes três quando chamada como o
    resto do app a chama para outros talentos (item removido ou duplicado
    incluídos). A única checagem real (quantidade + distinção, nunca se os
    itens eram perícias/ferramentas válidas) vivia hard-coded no fluxo de
    level-up, fora dessa função — e só rodava ali. **Corrigido**: os três
    ganharam entrada em `REGRAS_TALENTOS`, e `validarEscolhasTalento` passou a
    exigir exatamente 3 itens distintos, cada um pertencente à lista válida do
    talento (perícias+ferramentas para Habilidoso, só Ferramentas de Artesão
    para Artifista, só Instrumentos Musicais para Músico).
  - **Habilidoso, Artifista, Músico** (`e2e-ficha`) — pela **quarta** via de
    aquisição, o botão "+ Talento" da ficha
    (`abrirModalAdicionarTalento`, `site/js/sheet/talentos.js:586`),
    nem a checagem hard-coded de quantidade do level-up era alcançada:
    `site/js/sheet/talentos.js:663-669` decidia se abria o popup de escolhas
    consultando só `obterAtributosASITalento` (vazio para os três) e
    `obterEscolhasObrigatoriasTalento`/`getRegraTalento` (vazio também —
    nenhum dos três tinha entrada em `REGRAS_TALENTOS`). Nunca consultava
    `talentoExigeEscolhas` (`creator/comum.js:196-198`), que era quem
    reconhecia esses três talentos nas outras vias. Resultado, confirmado ao
    vivo em `talentos-ficha.spec.mjs`: escolher Habilidoso/Artifista/Músico
    e clicar "Adicionar" gravava o talento na ficha imediatamente, sem abrir
    nenhum popup — 0 controles `.escolha-talento-levelup` na tela onde o
    livro exige 3 — e o personagem salvo não ganhava nenhuma proficiência
    nova. **Esta era a via que reproduzia o sintoma relatado no início do
    projeto** ("o talento Habilidoso, ao ser selecionado não aparecem as
    opções de escolha") — ver a seção seguinte para o desfecho. **Corrigido**
    sem tocar em `sheet/talentos.js`: assim que os três ganharam entrada em
    `REGRAS_TALENTOS` (para fechar `validacao-negativa`, acima),
    `getRegraTalento` deixou de devolver `null` e
    `obterEscolhasObrigatoriasTalento` passou a devolver uma lista não-vazia
    — o suficiente para o botão da ficha deixar de tomar o atalho de
    persistir direto e abrir o popup de configuração, que já reusava o
    mesmo render do level-up.
- **`'limitacao-observabilidade'`** (4 entradas na época): não eram alegações
  sobre o app — eram registros de que UMA rota específica de teste não
  conseguia observar um mecanismo que vivia em outro lugar (ramo hard-coded
  por nome, ou função module-private). Das quatro, três desapareceram como
  **efeito colateral** da correção acima, e uma permanece — é a única entrada
  que resta na lista hoje:
  - `Adepto Elemental`/`Analítico`/`Mente Aguçada` em `escolhas` — a escolha
    já era reconhecida pelo app antes da correção (a tela renderizava um
    `<select>`), só que via um ramo hard-coded em `levelup-ui.js`, invisível
    para `REGRAS_TALENTOS`/`talentoExigeEscolhas`. Assim que os três ganharam
    entrada em `REGRAS_TALENTOS` (Tarefa B, acima), o mecanismo declarativo
    que esta rota confronta passou a enxergá-los de verdade — a lacuna ficou
    estruturalmente inválida e foi removida junto com as de `e2e-levelup`.
    **Nenhuma delas restou.**
  - `Aumento no Valor de Atributo` em `escolhas` — **esta é a única entrada
    que resta em `lacunas-conhecidas.mjs` hoje**, e não é um bug do app. O
    próprio `motivo` da entrada confirma que o app VALIDA a distribuição de 2
    pontos (`levelup-validations.js:98-99`, mais `validarDistribuicaoASI`,
    função module-private em `levelup.js:136` — sem `export`, o motor de
    unidade não consegue importá-la para testar isoladamente) — e o spec de
    level-up (Playwright) prova isso executando o fluxo real de ponta a
    ponta, sem nenhuma lacuna registrada lá. Nada aqui aponta para código
    incorreto: é um limite de uma rota específica do motor de unidade
    (`obterAtributosASITalento`, que devolve `[]` para este talento porque seu
    benefício não segue o padrão textual "+1 a X/Y/Z" que a função reconhece),
    não da regra em si, que outra rota já confronta e aprova.

**Estado final:** zero entradas `app-diverge-do-livro`; **1** entrada
`limitacao-observabilidade` (a de cima). Suíte de unidade em 339/339, suíte de
navegador em 72/72 — as duas verificadas depois da correção, não só antes
dela.

### O sintoma que abriu o projeto, e o seu desfecho

Este projeto começou com um relato: "o talento Habilidoso, ao ser
selecionado não aparecem as opções de escolha". A rodada anterior investigou
três vias de aquisição — concedido por antecedente, concedido pelo traço
Versátil (espécie Humana) e reaquisição via level-up (ele é repetível) — e
concluiu que o app estava correto nas três, e que o sintoma relatado não se
reproduzia. **Essa conclusão estava errada**: faltava investigar uma quarta
via, e foi justamente nela que o sintoma apareceu.

O app oferece **quatro** formas de um personagem ganhar um talento, não três:

1. Concedido por antecedente no criador — correto (`e2e-criador`, sem
   lacuna).
2. Concedido pelo traço Versátil da espécie Humana — correto
   (`e2e-criador-versatil`, sem lacuna).
3. Reaquisição via level-up (repetível) — correto (`e2e-repetivel`, sem
   lacuna).
4. **O botão "+ Talento" da ficha** (`abrirModalAdicionarTalento`,
   `site/js/sheet/talentos.js:586`) — pensado para talentos concedidos fora
   do fluxo normal (invocações, bênçãos do Mestre etc.). **Foi aqui que o
   sintoma reportado reproduziu de verdade**: escolher Habilidoso (ou
   Artifista, ou Músico) e confirmar não abria nenhuma tela de escolha —
   nenhum select de perícia/ferramenta/instrumento aparecia em lugar nenhum,
   e o talento era gravado na ficha sem as três proficiências que o livro
   concede. Confirmado ao vivo pelos três casos de `talentos-ficha.spec.mjs`
   (chave de teste `e2e-ficha`).

A causa era a mesma para os três: este botão só consultava
`obterAtributosASITalento` e `obterEscolhasObrigatoriasTalento`/
`getRegraTalento` antes de decidir se abria o popup de configuração — nunca
`talentoExigeEscolhas`, o mecanismo que as outras três vias usavam para
reconhecer especificamente Habilidoso/Artifista/Músico. Com as duas
consultas vazias para os três, o app persistia o talento direto, sem
perguntar nada.

**O desfecho**: a correção de 2026-08-06 (Tarefa A) deu entrada aos três
talentos em `REGRAS_TALENTOS`, o mapa declarativo do qual `sheet/talentos.js`
já dependia sem saber que dependia. Nenhuma linha de `sheet/talentos.js`
precisou mudar — assim que `getRegraTalento('Habilidoso')` deixou de devolver
`null`, o próprio botão "+ Talento" passou a abrir o popup de escolhas
sozinho, pelo mesmo caminho de código que já usava, só que agora alimentado
com dados de verdade. `talentos-ficha.spec.mjs` confirma isso hoje sem
nenhuma lacuna registrada: o sintoma que abriu o projeto está fechado nas
quatro vias de aquisição, não só nas três que a investigação original tinha
coberto.

## Achados do domínio Antecedentes (encontrados e corrigidos em 2026-08-07)

Diferente de talentos, aqui a rodada que relatou e a rodada que corrigiu
aconteceram no mesmo dia. `antecedentes.spec.mjs` registrou **21 entradas**
em `lacunas-conhecidas.mjs`, todas `tipo: 'app-diverge-do-livro'`, por
**duas causas raiz** — e uma correção fechou as 21 no mesmo projeto
(`.superpowers/sdd/antecedentes/correcao-report.md`), do jeito que o
mecanismo de `lacunas-conhecidas.mjs` exige: o app passou a obedecer ao
livro, não o teste foi afrouxado. Ler só o número "21" dá uma impressão
errada tanto do tamanho do problema (2 causas, não 21 bugs independentes)
quanto do desfecho:

- **16 entradas** (`antecedentes-e2e-ferramenta-proficiencia`, uma por
  antecedente): a ferramenta/instrumento que um antecedente concede nunca
  virava uma proficiência gravada no personagem — nem a específica (ex.:
  "Suprimentos de Calígrafo" do Acólito), nem a escolhida por categoria (ex.:
  "Suprimentos de Alquimista" do Artesão). `passo-antecedente.js:111`
  **exibia** o texto da ferramenta no popup do antecedente, mas não gravava
  nada. A consolidação que preenche `personagem.proficiencias_ferramentas`/
  `.proficiencias_instrumentos`, em `wizard.js:582-597`, lia **só**
  `personagem.escolhas_talento` (as escolhas do talento Habilidoso/Artifista/
  Músico). `personagem.escolhas_antecedente` era escrito em
  `passo-antecedente.js:136` e não era lido em lugar nenhum de `site/js/`
  (conferido por grep) para alimentar essas duas listas. **Corrigido**: nova
  função exportada `_consolidarFerramentaAntecedente()` em
  `passo-antecedente.js`, chamada na confirmação do popup do antecedente
  (logo depois de `_reconstruirTalentosBase()`) — remove a contribuição do
  antecedente anterior, se houver, e grava a ferramenta/instrumento atual (a
  específica de `ant.ferramentas`, ou `personagem.escolhas_antecedente[campo]`
  para os 5 de categoria) em `proficiencias_instrumentos` (Artista) ou
  `proficiencias_ferramentas` (os outros 15). Rodar na confirmação do popup,
  e não em `wizard.js:finalizar()` (onde vive o bloco irmão de
  `escolhas_talento`), foi deliberado: o spec lê o personagem logo depois de
  confirmar o antecedente, antes do assistente terminar. Uma primeira
  tentativa espelhando o padrão de `finalizar()` foi implementada, testada —
  as 16 continuaram falhando como esperado, porque o teste lê o personagem
  antes de `finalizar()` rodar — e revertida; `wizard.js` termina a correção
  sem alteração líquida (`git diff` vazio nesse arquivo).
- **5 entradas** (`antecedentes-e2e-pacote-mesma-ferramenta`, para os
  antecedentes cuja ferramenta é escolhida por categoria — Artesão, Artista,
  Guarda, Nobre, Soldado): o item do pacote de equipamento que o livro
  descreve como "a mesma ferramenta/o mesmo instrumento/kit que acima" nunca
  era resolvido para a escolha real do jogador. `passo-equipamento.js`
  resolvia o texto "à sua escolha" (usado pelo instrumento musical de
  classe), mas não tratava "(a mesma/o mesmo que acima)" — o item caía no
  ramo genérico e virava, literalmente, um item chamado "Ferramentas de
  Artesão (a mesma que acima)" no inventário, em vez do nome da ferramenta
  escolhida. **Corrigido**: novo ramo em `adicionarItensEquipamentoInicial()`
  (`passo-equipamento.js`) reconhece o marcador via regex
  (`/\((?:a mesma|o mesmo)\s+que\s+acima\)/i`) e substitui pelo valor em
  `personagem.escolhas_antecedente[campo]` — o mesmo campo que a correção
  acima já lê, sem uma segunda fonte de verdade para "qual foi a escolha do
  jogador".

As duas causas eram independentes uma da outra (a segunda não era
consequência da primeira), mas atingiam a mesma parte do livro — a
ferramenta do antecedente — por dois pontos de código diferentes.

**A armadilha de desenho que a correção evitou.** Rotear a ferramenta/
instrumento consolidada checando o valor escolhido contra
`FERRAMENTAS_TODAS`/`INSTRUMENTOS_MUSICAIS` — o padrão que o bloco irmão de
`escolhas_talento` já usa em `wizard.js` — teria reintroduzido o mesmo bug
uma camada acima, em silêncio. `FERRAMENTAS_TODAS` (`comum.js:93-102`) não
contém nenhuma das 4 opções de Kit de Jogos (Baralho, Conjunto de Dados,
Xadrez de Dragão, Jogo de Três Dragões); `INSTRUMENTOS_MUSICAIS`
(`comum.js:104-107`) não contém Corne, Flauta de Pã (com til) nem Harpa —
três das dez opções que a tela do Artista realmente oferece. Checar contra
qualquer uma das duas listas teria descartado essas escolhas sem aviso. A
correção não compara o valor escolhido contra lista nenhuma: roteia pelo
**campo** declarado em `ANTECEDENTES_ESCOLHAS[nome].campo`, que só tem três
valores possíveis (`ferramenta_escolhida`, `instrumento_escolhido`,
`jogos_escolhido`) — fixos no próprio catálogo de 5 entradas — então não há
"valor que não bate com nenhuma lista" capaz de ser descartado.

Vale registrar também: este era um bug presente **nos dois lados** — o app
refatorado (este repositório) e o original — porque nenhum dos dois gravava
a proficiência nem resolvia o marcador de equipamento antes da correção. A
suíte de paridade (`testes/e2e/`, 329 testes) não podia ver essa classe de
erro por definição: ela só compara os dois lados entre si, e os dois faziam
a mesma coisa errada — e continua não vendo, porque a correção de
2026-08-07 tocou só este site refatorado (paridade medida depois da
correção: 328 passando, 1 pulado, idêntica ao baseline). É exatamente o tipo
de bug que esta suíte de regras existe para pegar — e a primeira rodada do
domínio 2 confirma que o achado do piloto (talentos) generaliza: um app pode
divergir do livro num jeito que a paridade nunca vai enxergar.

**Estado final:** zero entradas `app-diverge-do-livro` em
`lacunas-conhecidas.mjs`; **1** entrada `limitacao-observabilidade` — a de
talentos, `Aumento no Valor de Atributo`/`escolhas` (ver acima), não tocada
por esta correção e não é bug do app. Suíte de unidade em **514 testes**
(470 passam, 44 skip, 0 falham) — inalterada pela correção, porque nenhum
motor de unidade toca os arquivos corrigidos. Suíte de navegador de regras
em **111/111**, todos verdes de verdade (nenhum cita lacuna hoje). Paridade
em **328 passando, 1 pulado** (329 coletados). As três medidas depois da
correção, não só antes dela. Relatório da correção:
`.superpowers/sdd/antecedentes/correcao-report.md`.

### Por que o motor de unidade confronta `dados/` em vez de uma função do app

Diferente de talentos, o motor de unidade de antecedentes
(`unidade/antecedentes.test.mjs`) não confronta nenhuma função pura do app —
`passo-antecedente.js` só exporta `renderStepAntecedente` e
`_reconstruirTalentosBase`; o resto do comportamento vive dentro de handlers
de evento, sem um ponto de entrada isolável em Node. Por isso o motor
confronta o catálogo contra `dados/origens/antecedentes.json` — o arquivo que
o app de fato lê em runtime — em vez de uma função: se `dados/` divergisse do
livro, todo fluxo que o consome estaria errado na origem, sem precisar de
navegador para provar. Essa camada não encontrou nenhuma divergência (as 115
asserções passam sem lacuna); é a confrontação **comportamental** — "o
assistente realmente aplica esses dados ao personagem?" — que vive inteira em
`antecedentes.spec.mjs`, e foi lá que as 21 lacunas apareceram (corrigidas em
2026-08-07 — ver "Achados do domínio Antecedentes", acima).

A mesma diferença estrutural aparece nos caminhos do usuário: antecedente tem
**uma** via de aquisição (o passo do assistente de criação) — não há botão
"trocar antecedente" na ficha; `site/js/sheet/edicao.js` só *lê*
`bonus_antecedente` para exibir e para validar o teto de 20
(`ficha-edicao-validacoes.js:14`). Talentos tinha quatro vias, e foi
justamente a quarta que escondeu o bug que abriu o projeto — aqui, com uma
via só, não há porta esquecida por definição.

## Achados do domínio Regras Transversais da Ficha (2026-08-07)

Diferente de talentos e antecedentes, este domínio **não encontrou nenhuma
divergência**. `lacunas-conhecidas.mjs` termina a rodada com a mesma **1**
entrada de antes (`Aumento no Valor de Atributo`/`escolhas`,
`limitacao-observabilidade`, deixada pelo domínio de talentos) — zero
entradas novas, de qualquer `tipo`.

Uma afirmação de "zero divergências" só vale o que a varredura por trás dela
cobre, então o que foi varrido, por completo, sem amostragem:

- **Modificador de atributo**: os 30 valores de 1 a 30 (18 tabelados no
  livro, 12 extrapolados da fórmula e marcados como tal) contra `calcMod`.
- **Bônus de Proficiência e XP**: os 20 níveis da tabela Evolução do
  Personagem contra `bonusProficiencia`, mais a coluna de XP contra
  `calcularNivelPorXP` — pisos exatos, interior de cada faixa (derivado da
  própria tabela) e dois casos de borda.
- **Pontos de Vida**: as 12 classes × modificador de Constituição de -5 a
  +10 no nível 1 (`calcPVNivel1`), e as mesmas 12 classes × níveis 1-20 ×
  mod. Constituição -5..+10 (3.840 combinações) para `calcPVTotal` contra a
  tabela "Pontos de Vida Fixos por Classe".
- **CA base sem armadura**: os 30 valores de Destreza contra `calcCA`, numa
  classe sem ramo de CA especial.
- **CD e ataque de magia**: as 8 classes conjuradoras de `CLASSES_INFO` ×
  níveis 1-20 × 30 valores do atributo de conjuração (4.800 combinações,
  duas asserções cada) contra `calcCDMagia`/`calcAtaqueMagia`.
- **Percepção Passiva**: os três estados reais de proficiência (sem, com, e
  com Especialização) × 30 valores de Sabedoria × 20 níveis (1.800
  combinações) contra `calcPercepcaoPassiva`.

O app implementa todas as seis fórmulas exatamente como o livro descreve, em
toda combinação varrida.

**Fronteira de escopo com o domínio de classes/níveis.** Três funções
transversais têm ramos de característica de classe que este domínio
deliberadamente deixou de fora — são a exceção que o livro concede a uma
classe/subclasse específica, não a regra que vale para qualquer personagem:

- `calcCA`: os ramos de Bárbaro (Defesa sem Armadura), Monge (Defesa sem
  Armadura), Bardo do Colégio da Dança (nível ≥3) e Feiticeiro da Feitiçaria
  Dracônica (nível ≥3).
- `calcBonusPericia`: os ramos de Bárbaro em fúria (Força Primordial troca o
  atributo-chave de 5 perícias) e Clérigo da Ordem Divina Taumaturgo (bônus
  em Arcanismo/Religião). Esta função não ganhou teste nenhum aqui — só a
  fronteira ficou anotada, para o domínio seguinte não a esquecer.
- `calcPercepcaoPassiva`: o ramo de Bardo (Pau pra Toda Obra, nível ≥2).

**Sobreposição declarada com classes/níveis.** A tabela Evolução do
Personagem — incluindo a coluna de XP — está coberta inteira aqui
(`bonusProficiencia` e `calcularNivelPorXP`/`XP_POR_NIVEL`, ambos
confrontados nos 20 níveis). O domínio de classes/níveis não deve duplicar
essa tabela quando chegar a sua vez.

## Mapa de domínios futuros

Talentos foi o piloto. A ordem sugerida originalmente (do spec de design
deste projeto) tinha "Regras transversais da ficha" por último — mas o
pré-voo deste domínio (ver o plano,
`docs/superpowers/plans/2026-08-07-regras-transversais-ficha.md`) mediu que
`site/js/utils.js` é o módulo com a maior densidade de função pura de todos
os domínios pendentes (`calcMod`, `bonusProficiencia`, `calcPVNivel1`,
`calcPVTotal`, `calcCA`, `calcCDMagia`, `calcAtaqueMagia`,
`calcPercepcaoPassiva`, `calcIntuicaoPassiva`, `calcInvestigacaoPassiva`,
`calcBonusPericia`) e não precisa de navegador — uma medição, não um
palpite. Por isso ele foi adiantado para antes de Espécies; a ordem abaixo é
a que foi seguida de fato, não a original:

1. ~~Talentos~~ — feito, este projeto (75 talentos)
2. ~~Antecedentes~~ — feito (16 antecedentes; achados acima, corrigidos em 2026-08-07)
3. ~~Regras transversais da ficha~~ — feito (achados acima; adiantado por
   densidade de função pura medida no pré-voo)
4. **Espécies** — traços, deslocamento, magias raciais
5. **Classes/níveis** — características por nível, espaços de magia, escolhas
   de subclasse; herda os ramos de classe anotados acima (`calcCA`,
   `calcBonusPericia`, `calcPercepcaoPassiva`) e não deve duplicar a tabela
   Evolução do Personagem, já coberta acima
6. **Magias** — preparo, limites por círculo

Cada domínio novo é **um arquivo de catálogo + um motor** — a estrutura não
muda. Não é preciso reprojetar nada para crescer: copiar o padrão de
`catalogo/talentos.mjs` (dado curado, citação por entrada) e de
`unidade/*.test.mjs` (motor genérico dirigido pelo catálogo) basta —
lembrando que o padrão certo depende do domínio: `ficha-transversal.mjs`
mostrou que quando o livro traz **tabela** fechada em vez de prosa, o
catálogo vira transcrição e o confronto vira varredura exaustiva, não
amostragem.

A estrutura não muda, mas os erros se repetem: copiar o padrão **não** protege
de medir arquitetura em vez de comportamento, de esquecer um caminho do
usuário ou de escrever um teste que não consegue falhar — foi exatamente o que
aconteceu aqui. O [GUIA-PROXIMOS-DOMINIOS.md](GUIA-PROXIMOS-DOMINIOS.md) existe
para isso.
