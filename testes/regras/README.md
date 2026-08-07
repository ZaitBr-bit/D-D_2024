# Testes de regras de negócio

Confrontam este app com o **livro** (D&D 5.5, `Informacoes Separadas/`),
executando as regras reais de talentos contra o que a ficha e o assistente de
criação/subida de nível realmente fazem.

A pergunta que esta suíte responde não é "a tela é a mesma do original" — essa
é a paridade, em `testes/e2e/`. É **"o app obedece ao livro?"**. As duas
perguntas são independentes: um erro presente nos dois sites (original e
refatorado) passa na paridade *para sempre*, porque paridade só compara os
dois lados entre si. É esta suíte que confronta cada lado com a regra escrita
e pega esse erro.

> **Vai começar um domínio novo?** Leia antes o
> [GUIA-PROXIMOS-DOMINIOS.md](GUIA-PROXIMOS-DOMINIOS.md). Ele registra os sete
> erros que a rodada de talentos cometeu — incluindo 31 lacunas falsas e um bug
> que só apareceu no quarto caminho de aquisição — e traz o checklist de
> pré-voo. Quase nenhum deles é óbvio no momento em que se comete.

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
npm run test:regras:unidade    # só os 4 motores de node:test
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

## O que cada motor prova — e o que não prova

Quatro motores de `node:test` em `unidade/`, mais quatro specs Playwright em
`../e2e/regras/`. Cada um confronta uma fatia diferente do livro, e nenhum
sozinho prova a regra inteira.

| Motor | O que confronta | Testes |
|---|---|---|
| `completude.test.mjs` | Catálogo × `dados/`: bijeção, schema (1 por talento, incluindo `opcoes` e `aumento_atributo`), citação real, higiene das lacunas (incluindo o campo `tipo`) | 79 |
| `escolhas.test.mjs` | Talento com escolha no livro é *reconhecido* pelo app (via `obterAtributosASITalento` para ASI embutido, ou `REGRAS_TALENTOS`/`talentoExigeEscolhas` para o resto) — **e**, para as 75 entradas, `aumento_atributo` do catálogo confrontado contra `obterAtributosASITalento` (achado I3: campo curado à mão que antes nada confrontava) | 134 |
| `validacao.test.mjs` | Um exemplo válido (curado do livro) é aceito; mutações inválidas (item removido, duplicata) são rejeitadas, quando aplicável | 64 |
| `passivos.test.mjs` | Bônus numéricos e flags internas que `resolverPassivosTalentos()` deveria produzir | 62 |

Total: **339 testes** em `unidade/`.

`escolhas.test.mjs` tem um limite explícito no próprio arquivo: ele não
enxerga ramos de renderização "hard-coded" por nome dentro de
`levelup-ui.js:renderEscolhasTalento` (o `<select>` específico de Adepto
Elemental/Analítico/Mente Aguçada existe só como HTML gerado em runtime). A
pergunta "o controle realmente aparece na tela, com as opções certas, e é
exigido antes de concluir?" só o Playwright consegue responder — é o que os
quatro specs de `../e2e/regras/` fazem, dirigindo o navegador de verdade
contra este site (**72 testes**):

| Spec | O que confronta | Testes |
|---|---|---|
| `talentos-levelup.spec.mjs` | Um talento com escolhas, escolhido na subida de nível: a tela oferece os controles certos (nas duas direções — faltando OU sobrando, achado M5), recusa concluir sem preenchê-los e persiste o que foi escolhido no campo específico onde o app grava (achado M6), incluindo o talento em si e o incremento do atributo do ASI embutido (achado I2) | 59 |
| `talentos-criador.spec.mjs` | O mesmo confronto pelas outras duas vias de aquisição no assistente de criação: talento de origem do antecedente, e traço Versátil da espécie Humana | 5 |
| `talentos-repetivel.spec.mjs` | Talento já adquirido reaparece na lista do level-up quando (e só quando) o livro o marca como repetível — casos derivados do catálogo (achado M8), não mais uma lista fixa | 5 |
| `talentos-ficha.spec.mjs` | A **quarta** via de aquisição, descoberta na rodada de 2026-08-06: o botão "+ Talento" da ficha (fora do criador e do level-up), para Habilidoso/Artifista/Músico — é a via que reproduz o sintoma que abriu este projeto | 3 |

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
de Node além do runtime. Mas os quatro specs que dirigem o navegador de
verdade (`talentos-levelup.spec.mjs`, `talentos-criador.spec.mjs`,
`talentos-repetivel.spec.mjs`, `talentos-ficha.spec.mjs`) precisam de
`@playwright/test`, e a resolução desse pacote sobe a árvore de diretórios a
partir do arquivo que o importa.
`testes/e2e/` é o **único** `node_modules` do projeto (a aplicação em `site/`
continua sem build e sem dependência nenhuma). Por isso os specs moram em
`testes/e2e/regras/`, com config própria
(`testes/e2e/regras/playwright.config.mjs`, que sobe só este site, sem o
original) — e os scripts `test:regras:*` em `testes/e2e/package.json` são o
jeito de rodar as duas metades (unidade e e2e) sem sair dessa árvore.

## Achados desta rodada

O produto real deste projeto não é "339 + 72 testes verdes" — é a lista de
lacunas que eles produziram. `lacunas-conhecidas.mjs` tem **15 entradas**,
todas em talentos de escolha (nenhuma em passivos/flags), mas nem todas são
a mesma alegação — cada uma carrega um campo `tipo` (achado I4) distinguindo:

- **`'app-diverge-do-livro'`** (11 entradas, **7 talentos**): o app faz algo
  diferente do que o livro manda, confirmado por leitura de código e/ou
  empiricamente no navegador. **Este é o backlog real**:
  - **Mestre das Armas** — a tela de subida de nível não renderiza *nenhum*
    controle para a escolha de arma da "Propriedade de Maestria" que o
    livro exige (`Talentos.md:532`). Nem sequer aparece um `<select>`
    errado; não aparece nada. Confirmado dos dois lados (`escolhas`: nenhum
    ramo em `levelup-ui.js:renderEscolhasTalento` para este talento;
    `e2e-levelup`: a tela mesmo, ao vivo, não oferece nada).
  - **Adepto Elemental** — o `<select>` de tipo de dano existe, mas com três
    rótulos trocados: oferece Frio/Fogo/Trovão onde o livro pede
    Gélido/Ígneo/Trovejante (`Talentos.md:244`). Além disso, a escolha não é
    exigida para concluir a subida de nível.
  - **Analítico** — o `<select>` de perícia oferece Medicina no lugar de
    Percepção (`Talentos.md:268`) — Percepção nunca aparece como opção. A
    escolha também não é exigida para concluir.
  - **Mente Aguçada** — as opções do `<select>` batem certinho com o livro
    (nenhum rótulo trocado), mas, como os dois talentos acima, a tela deixa
    concluir a subida sem preencher a escolha.
  - **Habilidoso, Artifista, Músico** (`validacao-negativa`) —
    `validarEscolhasTalento`, a função central de validação do app, aceita
    QUALQUER conjunto de escolhas para estes três quando chamada como o
    resto do app a chama para outros talentos (item removido ou duplicado
    incluídos). A única checagem real (quantidade + distinção, nunca se os
    itens são perícias/ferramentas válidas) vive hard-coded no fluxo de
    level-up, fora dessa função — e só roda ali.
  - **Habilidoso, Artifista, Músico** (`e2e-ficha`, achado desta rodada,
    2026-08-06) — pela **quarta** via de aquisição, o botão "+ Talento" da
    ficha (`abrirModalAdicionarTalento`, `site/js/sheet/talentos.js:586`),
    nem a checagem hard-coded de quantidade do level-up é alcançada:
    `site/js/sheet/talentos.js:663-669` decide se abre o popup de escolhas
    consultando só `obterAtributosASITalento` (vazio para os três) e
    `obterEscolhasObrigatoriasTalento`/`getRegraTalento` (vazio também —
    nenhum dos três tem entrada em `REGRAS_TALENTOS`). Nunca consulta
    `talentoExigeEscolhas` (`creator/comum.js:196-198`), que é quem
    reconhece esses três talentos nas outras vias. Resultado, confirmado ao
    vivo em `talentos-ficha.spec.mjs`: escolher Habilidoso/Artifista/Músico
    e clicar "Adicionar" grava o talento na ficha imediatamente, sem abrir
    nenhum popup — 0 controles `.escolha-talento-levelup` na tela onde o
    livro exige 3 — e o personagem salvo não ganha nenhuma proficiência
    nova (`pericias_proficientes`/`proficiencias_ferramentas`/
    `proficiencias_instrumentos` seguem exatamente como estavam antes).
    **Esta é a via que reproduz o sintoma relatado no início do projeto**
    ("o talento Habilidoso, ao ser selecionado não aparecem as opções de
    escolha") — ver seção abaixo.
- **`'limitacao-observabilidade'`** (4 entradas): não são alegações sobre o
  app — são registros de que UMA rota específica de teste não consegue
  observar um mecanismo que vive em outro lugar (ramo hard-coded por nome,
  ou função module-private). Mantidas porque documentam um limite real do
  motor, não porque acusam um bug:
  - `Adepto Elemental`/`Analítico`/`Mente Aguçada` em `escolhas`: a escolha
    É reconhecida pelo app (a tela renderiza um `<select>`), só que via um
    ramo hard-coded em `levelup-ui.js`, invisível para
    `REGRAS_TALENTOS`/`talentoExigeEscolhas` — os mecanismos declarativos
    que esta rota confronta. O defeito real de cada um (rótulo trocado,
    escolha não exigida) já está registrado na entrada gêmea de
    `e2e-levelup`, acima.
  - `Aumento no Valor de Atributo` em `escolhas`: o próprio `motivo` da
    entrada confirma que o app VALIDA a distribuição de 2 pontos
    (`levelup-validations.js:98-99`, mais `validarDistribuicaoASI`, função
    module-private em `levelup.js:136` — sem `export`, o motor de unidade
    não consegue importá-la para testar isoladamente) — e o spec de
    level-up (Playwright) prova isso executando o fluxo real de ponta a
    ponta, sem nenhuma lacuna registrada lá.

### O sintoma que abriu o projeto — encontrado na quarta via

Este projeto começou com um relato: "o talento Habilidoso, ao ser
selecionado não aparecem as opções de escolha". A rodada anterior investigou
três vias de aquisição — concedido por antecedente, concedido pelo traço
Versátil (espécie Humana) e reaquisição via level-up (ele é repetível) — e
concluiu que o app estava correto nas três, e que o sintoma relatado não se
reproduzia. **Essa conclusão estava errada**: faltava investigar uma quarta
via, e é justamente nela que o sintoma acontece.

O app oferece **quatro** formas de um personagem ganhar um talento, não três:

1. Concedido por antecedente no criador — correto (`e2e-criador`, sem
   lacuna).
2. Concedido pelo traço Versátil da espécie Humana — correto
   (`e2e-criador-versatil`, sem lacuna).
3. Reaquisição via level-up (repetível) — correto (`e2e-repetivel`, sem
   lacuna).
4. **O botão "+ Talento" da ficha** (`abrirModalAdicionarTalento`,
   `site/js/sheet/talentos.js:586`) — pensado para talentos concedidos fora
   do fluxo normal (invocações, bênçãos do Mestre etc.). **É aqui que o
   sintoma reportado reproduz de verdade**: escolher Habilidoso (ou
   Artifista, ou Músico) e confirmar não abre nenhuma tela de escolha —
   nenhum select de perícia/ferramenta/instrumento aparece em lugar nenhum,
   e o talento é gravado na ficha sem as três proficiências que o livro
   concede. Confirmado ao vivo pelos três casos de `talentos-ficha.spec.mjs`
   (chave de teste `e2e-ficha`, lacunas registradas para Habilidoso,
   Artifista e Músico).

A causa é a mesma para os três: este botão só consulta
`obterAtributosASITalento` e `obterEscolhasObrigatoriasTalento`/
`getRegraTalento` antes de decidir se abre o popup de configuração — nunca
`talentoExigeEscolhas`, o mecanismo que as outras três vias usam para
reconhecer especificamente Habilidoso/Artifista/Músico. Com as duas
consultadas vazias para os três, o app persiste o talento direto, sem
perguntar nada.

## Mapa de domínios futuros

Talentos foi o piloto. A ordem sugerida para os próximos domínios (do spec de
design deste projeto):

1. ~~Talentos~~ — feito, este projeto (75 talentos)
2. **Antecedentes** — talento de origem, perícias e ferramenta concedidos
3. **Espécies** — traços, deslocamento, magias raciais
4. **Classes/níveis** — características por nível, espaços de magia, escolhas
   de subclasse
5. **Magias** — preparo, limites por círculo
6. **Regras transversais da ficha** — CA, PV, bônus de proficiência, testes

Cada domínio novo é **um arquivo de catálogo + um motor** — a estrutura não
muda. Não é preciso reprojetar nada para crescer: copiar o padrão de
`catalogo/talentos.mjs` (dado curado, citação por entrada) e de
`unidade/*.test.mjs` (motor genérico dirigido pelo catálogo) basta.

A estrutura não muda, mas os erros se repetem: copiar o padrão **não** protege
de medir arquitetura em vez de comportamento, de esquecer um caminho do
usuário ou de escrever um teste que não consegue falhar — foi exatamente o que
aconteceu aqui. O [GUIA-PROXIMOS-DOMINIOS.md](GUIA-PROXIMOS-DOMINIOS.md) existe
para isso.
