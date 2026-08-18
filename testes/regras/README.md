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
- **Ainda vale medir antes e depois**, e escrever o resultado. Nas quatro
  rodadas de correção até aqui a paridade ficou idêntica (328 passando, 1
  pulado), o que não significa "não houve regressão": significa que ela não
  exercita os caminhos alterados. Quem cobre esse território é esta suíte.
- **Ninguém apagou nem reescreveu a paridade**, e isso é decisão em aberto. Ela
  ainda pega regressão de renderização em tudo que a correção não tocou.

**Mecanismo confirmado (Task 7, 2026-08-07): a paridade é estruturalmente
cega a todo conteúdo de MODAL.** A Task 7 renomeou 4 das 10 opções de Estilo
de Luta em 4 arquivos (`creator/comum.js`, `levelup-cards.js` e os dois
lugares que os leem) e mediu 328/1/0 -- idêntico ao antes. Isso não é
coincidência nem sorte: `#modal-overlay` é IRMÃO de `#app-content` em
`site/index.html:32-43`, não filho -- e `instantaneo()`
(`testes/e2e/helpers.mjs:60`, a função que tira a "foto" comparada entre os
dois sites) fotografa só o `innerHTML` de `#app-content`. Todo seletor de
Estilo de Luta (a escolha de classe no criador, a tela de level-up de
Guardião/Paladino nível 2, a seleção de magias) renderiza dentro de
`#modal-corpo`, dentro do modal -- fora do que `instantaneo()` consegue ver,
não importa o que mude lá dentro. Some-se a isso que `confirmarModal`
(o helper que a paridade usa para navegar o criador em lockstep) sempre
clica no primeiro card AINDA NÃO selecionado -- que para Estilo de Luta é
sempre "Arquearia", um dos 6 nomes que a Task 7 não tocou -- e que o único
personagem semeado nos specs de paridade que chegam à ficha (`fixtures` de
`testes/e2e/`) é um Clérigo, classe que nunca escolhe Estilo de Luta. Três
fatores independentes, cada um suficiente sozinho para explicar por que
renomear 4 opções visíveis não moveu 329 testes: (1) o conteúdo mudou dentro
de um modal que a fotografia nunca inclui: (2) mesmo se incluísse, o
driver de lockstep nunca chega a selecionar a opção renomeada; (3) mesmo se
chegasse, nenhum personagem semeado exibe o resultado na ficha depois. Isso
é um LIMITE da paridade, não um bug dela -- registrado aqui porque ninguém
tinha escrito antes que modal = ponto cego, e é o tipo de fato que muda como
se interpreta "paridade ficou 328/1/0" numa correção futura que mexa em
qualquer tela que só existe dentro de um modal.

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
npm run test:regras:unidade    # só os 9 motores de node:test
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

Vinte e seis motores de `node:test` em `unidade/`, mais vinte e oito specs
Playwright em `../e2e/regras/` (uma delas, `reportar-problema.spec.mjs`, é
trabalho paralelo do dono humano, fora do escopo deste domínio — não descrita
aqui). Cada um confronta uma fatia diferente do
livro, e nenhum sozinho prova a regra inteira. A tabela abaixo descreve os
motores dos domínios já fechados; os mais recentes (equipamento, seletor de
itens, opções de domínio, Telecinético, subclasses conjuradoras, maestria,
magias fixas do Mago, imports não resolvidos, cobertura de gatilhos de tela,
restauração de recursos, formato das notas de versão, magias concedidas por
subclasse, escolhas exigidas por subclasse, recursos de subclasse) entraram
depois e estão nas duas últimas linhas ou no próprio cabeçalho do arquivo.

| Motor | O que confronta | Testes |
|---|---|---|
| `completude.test.mjs` | Catálogo × `dados/`: bijeção, schema (1 por talento, incluindo `opcoes` e `aumento_atributo`), citação real, higiene das lacunas (incluindo o campo `tipo`), higiene das exceções de escolha repetida, e (achado I2 da revisão final) toda chave de `TESTES_VALIDOS` tem pelo menos um call site de `comLacuna()`/`lacuna()` na suíte | 81 |
| `escolhas.test.mjs` | Talento com escolha no livro é *reconhecido* pelo app (via `obterAtributosASITalento` para ASI embutido, ou `REGRAS_TALENTOS`/`talentoExigeEscolhas` para o resto) — **e**, para as 75 entradas, `aumento_atributo` do catálogo confrontado contra `obterAtributosASITalento` (achado I3: campo curado à mão que antes nada confrontava) | 134 |
| `validacao.test.mjs` | Um exemplo válido (curado do livro) é aceito; mutações inválidas (item removido, duplicata) são rejeitadas, quando aplicável | 64 |
| `passivos.test.mjs` | Bônus numéricos e flags internas que `resolverPassivosTalentos()` deveria produzir | 62 |
| `escolha-morta.test.mjs` | Uma escolha reoferecida depois de saturar o personagem (aplicar o efeito até não crescer mais) precisa ser recusada — nenhuma seção do livro proíbe isso com todas as letras, é o próprio estado do app confrontado contra si mesmo | 59 (15 rodam a asserção; **44 skip**, cada um com o motivo escrito no próprio `t.skip`) |
| `antecedentes.test.mjs` | Catálogo dos 16 antecedentes × `dados/origens/antecedentes.json`: bijeção/schema/citação (19), os cinco campos do livro por antecedente (atributos, talento, perícias, ferramenta, equipamento — 80), e coerência cruzada com `catalogo/talentos.mjs` (o talento de origem existe e é `'de Origem'` — 16) | 115 |
| `ficha-transversal.test.mjs` | Completude do catálogo (MODIFICADORES_ATRIBUTO cobre exatamente 1-30, EVOLUCAO_PERSONAGEM cobre exatamente 1-20, PV_NIVEL_1/PV_NIVEL_SEGUINTE cobrem exatamente as classes de CLASSES_INFO) e validação de citações (todas as entradas de CITACOES resolvem para trechos reais do livro); mais as fórmulas transversais da ficha confrontadas com as tabelas do livro por **varredura exaustiva** (não amostragem): modificador de atributo (30/30 valores), Bônus de Proficiência (20/20 níveis) e `calcularNivelPorXP` (os 20 pisos, mais interior de faixa e bordas), PV de nível 1 e dos níveis seguintes (12 classes × mod. Constituição -5..+10, e também × níveis 1-20 para os níveis seguintes), CA base sem armadura (30 valores de Destreza), CD e ataque de magia (8 classes conjuradoras × 20 níveis × 30 valores de atributo) e Percepção Passiva (3 estados de proficiência × 30 valores de Sabedoria × 20 níveis) | 14 |
| `classes.test.mjs` | Motor **estrutural** do domínio Classes/Níveis: o catálogo (transcrito do livro, 12 classes × 20 níveis) confrontado contra as DUAS fontes de verdade do app para os mesmos fatos — `dados/classes/*.json` (bijeção, schema por classe, os 48 nomes de subclasse, e as 240 linhas de tabela coluna a coluna) e `CLASSES_INFO` (`site/js/dados-classes.js`, a segunda fonte, que alimenta PV e CD/ataque de magia); mais as funções puras que leem a tabela (`getEspacosMagia`, `getTruquesConhecidos`, `getMagiaPreparadas`, `calcularHPGanho`, `obterCaracteristicasNivel`) e as **nove** listas hard-coded de `levelup.js` que decidem o que cada nível exige (gatilhos de subclasse, ASI/Dádiva Épica, Estilo de Luta, Especialização de Bardo/Guardião, **Especialização do Ladino nível 6** — acrescentada na Task 8 —, Explorador Hábil, Acadêmico, mais as manobras do Mestre da Batalha); mais o **teste converso** (incremento de 2026-08-07, achado do Ladino nv6): para toda célula em que o livro imprime um rótulo que exige escolha (via os mesmos `ROTULOS_GATILHO`, sem a restrição `apenas`), alguma das nove funções precisa disparar — as duas exceções de nível 1 (Guerreiro/Estilo de Luta, Ladino/Especialização, cobertas pelo fluxo de criação) são uma lista curada e exigida como **exata**, não puladas | 452 |
| `classes-progressao.test.mjs` | Motor **comportamental** do domínio Classes/Níveis: sobe um personagem de cada uma das 12 classes do nível 1 ao 20 de verdade, via `subirDeNivel()` (`site/js/levelup.js`) — sem navegador, ver "Achados do domínio Classes/Níveis" abaixo — e confronta, em cada nível, bônus de proficiência, PV máximo (regra retroativa de Constituição) e espaços de magia contra a tabela do livro; mais as pendências que o app de fato exige (subclasse, ASI, Dádiva Épica, as 5 pendências de classe única) contra os níveis do livro, e duas asserções de bom senso sem frase do livro para citar, comportamentais (dirigem `escadaDeNivel` de verdade): espaço de magia nunca diminui ao subir, subclasse não é reoferecida depois de escolhida. Uma terceira asserção do mesmo bloco, "característica não é concedida duas vezes", NÃO é comportamental (achado M2 da revisão final) — é uma autoconferência do catálogo contra si mesmo (`PROGRESSAO` × `REPETEM_NO_LIVRO`), sem tocar `escadaDeNivel` nem nenhum personagem; útil (achou 4 exceções reais do livro), mas não um confronto com o app | 62 |
| `classes-trocas.test.mjs` | Os **26 direitos de troca de escolha** das 12 classes base (`catalogo/classes-trocas.mjs`, transcrito do livro), confrontados em duas frentes só para a **1 das 26** entradas observável por teste de unidade (`observavelEmUnidade: true`): (1) varredura textual de `levelup.js`/`levelup-validations.js` procurando o par de opções `<campo>_trocar_de`/`<campo>_trocar_para`; (2) chama `subirDeNivel` com os dois campos da troca preenchidos e confere que o valor gravado no personagem realmente mudou (Task 8, 2026-08-08: substituída a versão anterior, que exigia uma pendência bloqueante para uma troca que por desenho nunca bloqueia — media a coisa errada, ver "Achados" abaixo); mais (achado I4 da revisão final) uma guarda de tamanho (`TROCAS.length === 26`, `OBSERVAVEIS.length >= 1`) — sem ela, o catálogo encolher (ou o único `observavelEmUnidade: true` virar `false`) desligaria os dois testes que sustentam a alegação do Guerreiro sem nenhum teste vermelho para avisar. As outras 25 entradas aplicam a troca por um caminho que `subirDeNivel` nunca vê (mutação direta de `char`, edição livre na ficha, ou Descanso Longo fora do fluxo de nível) — ver "Limites declarados" abaixo | 5 |
| `classes-passivas.test.mjs` | Duas confrontações independentes: (1) a heurística `ehHabilidadeAtiva()` (`site/js/utils.js:499-511`, que decide em qual seção da ficha — "Ativas"/"Passivas" — uma característica aparece) contra `CLASSIFICACAO` (174 características de classe base, transcritas do livro), restrita às entradas cujo `base` é `'custo-declarado'`/`'ausencia-de-custo'` (frase citável do livro) — `'julgamento'` e `composta: true` rodam a heurística e registram o resultado, mas não sustentam alegação (ver cabeçalho do catálogo); (2) os **28 efeitos numéricos** de `EFEITOS_NUMERICOS` confrontados por varredura exaustiva do DOMÍNIO DE ENTRADA (30 valores de atributo, 20 níveis, etc. — não amostragem) contra as funções que os calculam (`calcCA`, `getDeslocamentoFinal`, `getAtaquesPorAcao`, `calcCDMagia`, `calcBonusPericia`, `resolverPassivosTalentos`, mais `getEstadoRecursosPaladino`/`getEstadoRecursosGuardiao`, fora da lista original) — em 9 dos 11 blocos o valor esperado é calculado de forma independente do livro, e o campo `entrada.efeito` (a frase do catálogo) só decora a mensagem de falha, sem ser parseado/conferido (ver "Limites declarados", abaixo); achado I5 da revisão final: 4 desses blocos foram corrigidos para montar o esperado a partir de `MODIFICADORES_ATRIBUTO`/`EVOLUCAO_PERSONAGEM` (`catalogo/ficha-transversal.mjs`, fonte independente do livro) em vez de `utils.calcMod`/`utils.bonusProficiencia` — as MESMAS funções que o código sob teste chama por dentro, o que deixava um bug nelas invisível para essas 4 asserções; mais (achado I1, Task 8) dois testes NUMÉRICOS que chamam `renderSecaoMagias()` e `mostrarBuscaMagia()` de verdade para o bônus de truque do Taumaturgo/Xamã em `sheet/magias.js` e `sheet/grimorio.js`, porque a varredura textual irmã (`aplicaBonusTruqueTaumaturgo`) não distinguia "aplica o bônus" de "cita a função e descarta o resultado" (confirmado inserindo `0 *` nas duas chamadas reais: a varredura continuava verde nos dois casos); mais dois achados de código, não do livro: **flag/campo gravado sem consumidor** em `site/js/` (busca textual nos 61 arquivos `.js`, fora de comentário) e o **terceiro vocabulário** de Estilo de Luta (`efeitosEstilo` na ficha não reconhece 5 dos 10 nomes que o seletor grava) | 240 |
| `subclasses.test.mjs` | As **241 características das 48 subclasses** (`{ nível, nome }`, transcritas das 12 seções de subclasse de `Classes.md`) confrontadas contra as duas rotas do app para o mesmo fato: `dados/classes/*.json → subclasses[].caracteristicas` lido do disco, e `obterCaracteristicasSubclasseNivel()` (`site/js/levelup.js:726`), varrida em 48 subclasses × 20 níveis — incluindo os níveis em que o esperado é lista vazia, que são a maioria das 960 verificações e o que pega característica concedida no nível errado; mais a coerência dos 48 nomes com `catalogo/classes.mjs` e o confronto dos níveis de concessão contra a tabela de cada classe (duas transcrições independentes do mesmo livro, feitas em rodadas diferentes). **Não** confronta magias concedidas (Plano 2), escolhas exigidas (Plano 3) nem recursos na ficha (Plano 4) | 170 |
| `subclasses-magias.test.mjs` | As magias que cada uma das 48 subclasses concede (`MAGIAS_SUBCLASSE`, transcrito das tabelas e da prosa do livro), confrontadas por **três rotas independentes**: a união dos dois mecanismos de parser (`obterMagiasDominioNivel` + `obterMagiasSemprePreparadasNivel`, 48 × 20 níveis), a ficha resultante de uma subida de nível real do 1 ao 20 via `escadaDeNivel` (48 escadas), e os dois acessores que `site/js/pages/sheet.js:48-49` usa para montar a tela. A asserção é sempre sobre a UNIÃO dos mecanismos, nunca sobre qual deles entregou — exigir um mecanismo específico seria medir arquitetura em vez de comportamento. As quatro listas do catálogo (`MAGIAS_SUBCLASSE`, `SUBCLASSES_MAGIA_POR_ESCOLHA`, `SUBCLASSES_MAGIA_OUTRO_MECANISMO`, `SUBCLASSES_SEM_MAGIA`) são obrigadas a cobrir exatamente as 48, para "esqueci de transcrever" não se confundir com "não concede nada". **Não** cobre magias por escolha do jogador (Plano 3) nem a conjuração 1/3 de Cavaleiro Místico/Trapaceiro Arcano (`subclasse-conjuradora.test.mjs`) | 147 |
| `subclasse-conjuradora.test.mjs` | As duas subclasses **1/3 conjuradoras** (Cavaleiro Místico, Trapaceiro Arcano), cuja Conjuração começa no MESMO nível 3 em que a subclasse é escolhida: o contexto de subida de nível calculado com a subclasse escolhida *nesta sessão* (step de magias visível, 2 truques a escolher porque Mãos Mágicas é fixa, 3 magias, lista de Mago carregada), os espaços de magia gravados nível a nível pela escada real (`escadaDeNivel`) contra a tabela do livro, a concessão de Mãos Mágicas com origem `subclasse_fixa` (conta no limite, não pode ser trocada), a recuperação de fichas legadas (vagas em aberto de truque/magia) e o limite compartilhado `getLimitesMagias` -- que o modal "Consultar Magias" lia como 0/0 | 11 |
| `subclasses-escolhas.test.mjs` | As **23 escolhas de construção** de subclasse (`ESCOLHAS_SUBCLASSE`, 20 características distintas em 16 subclasses) e as **5 concessões automáticas** (`CONCESSOES_AUTOMATICAS_SUBCLASSE`) confrontadas em duas direções e um converso: Direção 1 (o livro exige a escolha, o app levanta a pendência CERTA -- não só "alguma pendência" -- no nível certo?), Direção 2 (as 48 subclasses inteiras, não só as 16 declaradas -- o app pede uma pendência que o livro não exige em nenhum nível?) e o converso (o personagem realmente mudou ao ganhar o nível, com ou sem pendência?); mais que as concessões automáticas não viram pendência (Grupo 5). **Não** cobre as 50 escolhas **em jogo** (`ESCOLHAS_EM_JOGO`), as 3 cosméticas (`ESCOLHAS_COSMETICAS`) nem o passivo numérico fora deste motor (`PASSIVOS_FORA_DESTE_MOTOR`) -- as três listas só são conferidas por higiene (apontam para característica real, citam o livro), nunca por comportamento. Dirige só `subirDeNivel` (via `escadaDeNivel`); `site/js/creator/` e a camada do assistente de subida de nível (`levelup-flow.js`/`levelup-cards.js`/`levelup-ui.js`) ficam fora do alcance -- ver "Achados do domínio Subclasses / Escolhas" abaixo | 110 |
| `subclasses-recursos.test.mjs` | Plano 4 (último) do domínio Subclasses -- os recursos (usos, recarga) que uma característica de subclasse cria na ficha. Catálogo `RECURSOS_SUBCLASSE` (**72** características com recurso próprio, das 241 do Plano 1) + `SEM_RECURSO_SUBCLASSE` (**169**), bijeção exigida com as 241. Sete grupos: (1) higiene do catálogo; (2)-(4) as três heurísticas do app -- `detectarUsosMaximos`, `detectarRecarga` (`site/js/utils.js`) e `ehHabilidadeAtiva` (idem) -- contra as 72, com `assert.equal` só nas **27** entradas cujo `base` é citável e não `composta` (as outras 45 rodam a mesma comparação e registram o resultado via `t.skip`, mesmo mecanismo de `classes-passivas.test.mjs`); (5) a restauração no Descanso certo, generalizada às 72 -- observação textual escopada por guarda de subclasse em `sheet/hp-descanso.js`, somada ao caminho GENÉRICO `restaurarHabilidades` (`hp-descanso.js:333`), que zera qualquer recurso sem campo dedicado cuja `detectarRecarga` real bata; (6)-(7) os três ramos numéricos herdados de `classes-passivas.test.mjs` que dependem de subclasse -- `calcCA` (Colégio da Dança, Feitiçaria Dracônica) e `calcBonusPericia` (Ordem Divina Taumaturgo) -- varridos por **~86.400 combinações** exaustivas (Destreza/Carisma/Sabedoria × nível × proficiência), não amostragem. **Não** confronta a prosa das descrições nem simula um clique no navegador (ver o spec `subclasse-recursos-ficha.spec.mjs`, abaixo) -- ver "Achados do domínio Subclasses / Recursos" abaixo | 550 (365 rodam `assert.equal`; **185 skip**, cada um com o motivo escrito no próprio `t.skip`) |
| `maestria-armas.test.mjs` | Quais armas podem receber **Maestria em Arma**, por classe (Bárbaro só Corpo a Corpo; Guerreiro qualquer Simples/Marcial; Guardião/Paladino/Ladino as de proficiência), rodando contra `dados/equipamento/armas.json` real -- inclusive uma guarda de FORMATO (`propriedades` é string, não lista), que é o que a tela de maestrias violava | 6 |
| `imports-nao-resolvidos.test.mjs` | Varredura de `site/js/`: nome exportado por **outro módulo do projeto** que é chamado sem estar importado (`ReferenceError` na hora em que a função rodar -- `checar_esm.mjs` não pega, porque só confere o parse). Globais publicados de propósito (`window.navegar`, `window.fecharModal`) são descobertos por varredura, não por lista fixa | 1 |
| `gatilhos-ui-cobertos.test.mjs` | Cliquete de cobertura de tela: todo `id="btn-..."`/`data-<x>-acao="..."` declarado em `site/js/` precisa aparecer em algum spec de `testes/e2e/` -- isto é, precisa existir um teste que CLIQUE nele. A dívida histórica (**218 gatilhos**, de 260) está congelada em `../gatilhos-sem-cobertura.mjs` e a lista só encolhe: gatilho novo sem teste falha, e entrada que já ganhou teste (ou sumiu do código) também falha, pedindo a remoção. Um quarto teste barra gatilho montado por interpolação OPACA (`data-x-acao="${acao}"`), que sumiria do inventário e escaparia da regra em silêncio -- o extrator resolve ternário com os dois lados literais, mas não uma variável. Nasceu de uma melhoria entregue com teste que só afirmava "o botão aparece" -- ver GUIA-PROXIMOS-DOMINIOS.md | 4 |
| `recursos-restaurados.test.mjs` | Varredura de `site/js/`: campo de consumo (`_usado`/`_usada`/`_gasto`/`_gastos`) que é gravado mas NUNCA mencionado em `sheet/hp-descanso.js` -- recurso que se gasta e nada devolve. Exceções legítimas (restauradas por outra via, como as do talento Dádiva da Recuperação, ou por gatilho próprio, como a Concentração Fanática, que zera ao ATIVAR a Fúria) ficam numa lista com o motivo escrito, e o motor cobra a higiene dela nos dois sentidos. Nasceu do Campeão dos Deuses do Bárbaro Fanático, cuja reserva de d12 não voltava em Descanso Longo nenhum | 3 |
| `notas-versao-formato.test.mjs` | Toda entrada de `NOTAS_VERSAO` renderiza (via `montarNotasVersaoHtml`, extraída de `notas-versao.js` para ser confrontável sem navegador), `VERSAO_ATUAL` é a entrada do topo, e todo grupo tem título e itens. `melhorias`/`correcoes` são OPCIONAIS -- foi uma versão só de correções que derrubou o modal inteiro, escondendo também as versões antigas | 4 |

Total: **2349 testes** em `unidade/` (medido em 2026-08-18, depois do Plano 4
— e último — do domínio Subclasses, recursos na ficha) — **2093 passam, 0
falham, 256 skip**. Os skips não somem dentro do total, e cada um carrega o
motivo por escrito — um skip silencioso, aqui, seria a mesma omissão que uma
lacuna sem `motivo` já é proibida de ser. A composição dos 256:

- **71**, herdados de antes deste Plano: talentos cujo `aplicarEfeitoTalento`
  não faz nenhum campo de lista crescer (fora do escopo daquele motor
  específico, não do livro).
- **7**, também herdados: `subclasses-escolhas.test.mjs` (Grupo 6, o
  converso, Plano 3) — a mesma dica `campoEsperado` apontando para um campo
  (`recursos.*`) que só a ficha (`site/js/sheet/*.js`) cria sob demanda, nunca
  a rota `subirDeNivel` que aquele motor dirige.
- **185, novos deste Plano — inteiros de `subclasses-recursos.test.mjs`**,
  medido isolando o arquivo (`node --test .../subclasses-recursos.test.mjs`:
  550 testes, 365 pass, 0 fail, 185 skip — soma exata com o delta da suíte
  completa, `1799+550=2349`/`1728+365=2093`/`71+185=256`). Quatro dos sete
  grupos do motor rodam a comparação de verdade também sobre as **45**
  entradas `composta`/`julgamento` do catálogo (as que não sustentam
  `assert.equal` sozinhas) e registram o resultado via `t.skip` em vez de
  descartá-lo: 45 em `detectarUsosMaximos`, 45 em `detectarRecarga`, 45 em
  restauração no descanso — sempre as mesmas 45 características — e **50**
  em `ehHabilidadeAtiva` (as mesmas 45 mais **5** que são `julgamento` só
  nessa pergunta, das 27 entradas por outro lado citáveis por `usos`/
  `recarga`). `45+45+45+50 = 185`.

Um 8º skip pré-existente (Treinamento Marcial, Colégio da Bravura) existiu por
engano até a correção pós-revisão de 2026-08-18: `campoEsperado` apontava
para `proficiencias_armaduras`, um campo que só é LIDO em `site/js/`, nunca
escrito — a busca que sustentava "raiz fora da rota" tinha parado num nome
adivinhado, não no benefício real (`proficiencias_extra`, plenamente
alcançável por `subirDeNivel`); corrigido para uma asserção vermelha de
verdade, registrada em `lacunas-conhecidas.mjs` — ver "Achados do domínio
Subclasses / Escolhas" mais abaixo.

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
    `talentoExigeEscolhas` (`creator/comum.js:235-237`), que era quem
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
    pontos (`levelup-validations.js:112-113`, mais `validarDistribuicaoASI`,
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
  `passo-antecedente.js:191-192` e não era lido em lugar nenhum de `site/js/`
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

## Achados do domínio Classes/Níveis (2026-08-07)

**O que foi varrido, por completo, sem amostragem.** As 12 classes × 20
níveis — as 240 linhas da tabela "Características de Classe" de cada uma,
transcritas do livro para `catalogo/classes.mjs` e conferidas célula a célula
por revisão independente contra `dados/classes/*.json` e `CLASSES_INFO`
(`classes.test.mjs`) — mais a subida de nível 1 a 20 **de verdade**, via
`subirDeNivel()`, para as 12 classes (`classes-progressao.test.mjs`).
Diferente dos domínios anteriores (Talentos, Antecedentes), este confrontou
comportamento **sem navegador**: `subirDeNivel()` é dirigível em Node porque
`db.js` lê `dados/` do disco por trás de um stub de `fetch` (harness.mjs) —
não precisou de Playwright para provar que o app aplica a tabela a um
personagem de verdade, nível a nível.

**Duas causas-raiz, não três lacunas independentes.** `lacunas-conhecidas.mjs`
termina a rodada com 2 entradas novas (`Clérigo`/`classes-tabela` e
`Ladino`/`classes-info`), cobrindo os 3 testes vermelhos do motor estrutural
— ler "3" teria dado uma impressão errada do tamanho do problema:

- **Clérigo, nível 3 (2 dos 3 testes).** A célula da tabela do livro
  (`Classes.md:1515`) traz "Subclasse Clérigo", sem "de";
  `dados/classes/clerigo.json` grava "Subclasse de Clérigo" — a forma do
  heading de prosa que abre a característica (`Classes.md:1584`), não a da
  célula da tabela. É isolado ao Clérigo (Bárbaro e Ladino têm o mesmo padrão
  "Subclasse X" sem "de" na tabela, e `dados/` reproduz sem "de" corretamente
  nos dois). Os dois testes vermelhos são o **mesmo defeito** visto por duas
  rotas de código — leitura crua da célula, e `obterCaracteristicasNivel`
  (`site/js/levelup.js:381-394`), que lê a mesma célula — não um segundo
  achado. Consequência funcional, medida no código, não suposta:
  **nenhuma**. O único consumidor da função só renderiza a lista recebida
  como `<li>${c}</li>`; `exigeSubclasse` decide a obrigatoriedade de escolher
  subclasse por uma tabela fixa `{classe: nível}`, sem ler a característica;
  e nenhum `.nome === '...'` em `site/js/` compara este texto. O efeito real,
  único, é de exibição: o card de level-up e a ficha/impressão do Clérigo no
  nível 3 mostram uma palavra a mais.
- **Ladino, proficiência com armas (1 dos 3 testes).** `Classes.md:4152`
  concede proficiência com armas Marciais que tenham a propriedade
  "Acuidade **ou** Leve"; `site/js/dados-classes.js:105` codifica só
  Acuidade. Diferente do achado do Clérigo, este TEM consequência funcional
  real e medida: a Besta de Mão (`dados/equipamento/armas.json`) é a única
  arma Marcial do jogo com Leve e sem Acuidade, então um Ladino equipado com
  ela é rotulado "Sem Prof" na ficha e no criador, com o bônus de ataque
  exibido subestimado pelo bônus de proficiência inteiro
  (`site/js/sheet/inventario.js:163-164`).

Os motivos completos, com arquivo e linha dos dois lados, vivem em
`lacunas-conhecidas.mjs`; a investigação passo a passo está em
`task-4-report.md` e `task-5-report.md`
(`.superpowers/sdd/2026-08-07-regras-classes-niveis/`).

**13 falhas do motor de gatilhos NÃO eram lacunas.** A primeira rodada do
laço de `GATILHOS` (`classes.test.mjs`, Task 6) deu 13 falhas. Nenhuma virou
entrada em `lacunas-conhecidas.mjs`: rastrear cada uma até o consumidor real
do app, antes de classificar, mostrou que eram **duas asserções mal
formuladas** medindo arquitetura em vez de comportamento (o erro nº 1 do
[GUIA-PROXIMOS-DOMINIOS.md](GUIA-PROXIMOS-DOMINIOS.md) — o mesmo que gerou 31
lacunas falsas na rodada de Talentos). Corrigidas as duas asserções, as 13
voltaram a zero sem tocar em `site/js/`. O que impediu 13 lacunas falsas foi
essa disciplina — rastrear a consequência no código antes de reportar —, não
um teste ter pego o erro sozinho.

**O escopo declarado fora**, em voz alta:

- **Características de subclasse por nível** (as 48 subclasses) — o
  catálogo já traz os 48 nomes (bijeção conferida contra `dados/`), só falta
  pendurar as características por nível. Isto é **dependência direta da
  rodada seguinte** (Subclasses), não um esquecimento.
- **Listas de magias por classe** — domínio Magias.
- **Multiclasse** — o app não implementa.
- **Os ramos de classe herdados de `ficha-transversal.test.mjs`**
  (`calcCA`, `calcBonusPericia`, `calcPercepcaoPassiva`) — três deles
  dependem de subclasse (Bardo do Colégio da Dança, Feiticeiro da
  Feitiçaria Dracônica, Clérigo da Ordem Divina Taumaturgo), então
  acompanham a rodada de Subclasses; nenhum ganhou teste nesta rodada.

**A tabela Evolução do Personagem não foi duplicada.** Bônus de Proficiência
e XP já estavam cobertos, nos 20 níveis, por `ficha-transversal.test.mjs`
(domínio anterior); este domínio só confronta a coluna DA CLASSE contra essa
mesma progressão (`classes-progressao.test.mjs`), não a tabela geral de novo.

**Os limites declarados dos dois motores**, escritos no cabeçalho de
`classes-progressao.test.mjs` para que "1031 testes verdes" não pareça uma
garantia maior do que é:

- A asserção de Bônus de Proficiência no motor comportamental é
  utils×catálogo, **não** comportamental de verdade — `subirDeNivel` não
  grava um campo de bônus de proficiência na ficha (o app deriva na hora via
  `utils.bonusProficiencia(nivel)`), então não existe um valor gravado para
  confrontar.
- O motor comportamental **não** afirma as colunas de recurso específicas de
  cada classe (Truques, Magias Preparadas, Fúrias, Dano da Fúria, Maestria em
  Arma etc.) — o catálogo as transcreve e o motor **estrutural**
  (`classes.test.mjs`) as confronta célula a célula; o comportamental só
  confronta bônus de proficiência, PV e espaços de magia.

## Achados dos domínios Classes/Trocas e Classes/Passivas (2026-08-07)

Duas extensões do domínio Classes/Níveis, cada uma com motor próprio
(`classes-trocas.test.mjs`, `classes-passivas.test.mjs`) e catálogo próprio.
**12 entradas novas** em `lacunas-conhecidas.mjs`, cobrindo as **38 falhas**
que os dois motores produziram na primeira rodada — ler "38" dá impressão
errada do tamanho do problema: são **1 causa raiz de troca** (2 falhas, vista
por duas rotas) e **11 causas de código de passivas** (36 falhas: 7 causas da
heurística Ativa/Passiva + 3 achados independentes de flag/campo sem
consumidor + 1 causa de vocabulário), não 38 lacunas independentes.

**Suíte no fim desta rodada de achados**: `npm run test:regras:unidade` →
1256 testes, 1192 pass, 0 fail, 64 skip. `npm run test:regras:e2e` →
111/111. `npx playwright test --list` → 329 testes em 10 arquivos (paridade
intocada). Essas 12 entradas eram, neste ponto, só REGISTRO — nenhuma delas
tinha sido corrigida no app ainda.

**Atualização (Task 7, 2026-08-07, ver
`.superpowers/sdd/2026-08-07-classes-trocas-passivas/task-7-report.md`):**
das 12 entradas, as **4** sob "Flag/campo sem consumidor" e "Terceiro
vocabulário de Estilo de Luta" (abaixo) foram corrigidas e removidas de
`lacunas-conhecidas.mjs` — vocabulário único de Estilo de Luta (seletor e
ficha usam os mesmos 10 nomes canônicos), as duas flags mortas ganharam
consumidor (`sheet/inventario.js`), e o bônus de truque do Taumaturgo/Xamã
foi centralizado (`utils.js:getBonusTruquesOrdem`) e passou a valer também na
ficha e na subida de nível. As outras **8** (a troca de Estilo de Luta do
Guerreiro + as 7 causas da heurística Ativa/Passiva) continuavam abertas — não
fizeram parte do escopo da Task 7. **Suíte depois da Task 7**:
`npm run test:regras:unidade` → **1273 testes, 1209 pass, 0 fail, 64 skip**
(o número de testes cresceu: a correção do vocabulário/truque ganhou
cobertura própria do RETORNO das novas funções, não só da existência da
chamada — ver `classes-passivas.test.mjs`, blocos "I1"/"I3"). Detalhe de cada
achado, incluindo os já corrigidos, continua abaixo por valor histórico (o
que foi encontrado, como, e por quê é real).

**Atualização (Task 8, 2026-08-08, ver
`.superpowers/sdd/2026-08-07-classes-trocas-passivas/task-8-report.md`):** a
troca de Estilo de Luta do Guerreiro (a lacuna que abriu este projeto, ver
seção seguinte) foi corrigida e sua entrada removida de
`lacunas-conhecidas.mjs`. Restam **7** abertas — as 7 causas da heurística
Ativa/Passiva, fora do escopo da Task 8. **Suíte depois da Task 8**:
`npm run test:regras:unidade` → **1288 testes, 1224 pass, 0 fail, 64 skip**
(1285/1221 logo após a correção do bug em si; +2 testes vieram das correções
de motor de teste da revisão final, I1 e I4; +1 teste veio de uma segunda
revisão (N1), detalhada a seguir).

**Achado N1 (segunda revisão do coordenador, 2026-08-08):** o teste numérico
do achado I1 original cobria só `renderSecaoMagias()` (`sheet/magias.js`),
não `mostrarBuscaMagia()` (`sheet/grimorio.js`) — o SEGUNDO arquivo com
comportamento observável do mesmo bônus (contador "Truques: X/Y" da tela
"Gerenciar Magias" e o bloqueio de troca por limite excedido). Confirmado por
mutação: inserir `0 *` na chamada de `getBonusTruquesOrdem` dentro de
`grimorio.js` deixava a suíte INTEIRA verde (1287/1223/0/64) — nenhuma das
outras 1287 asserções via a regressão. Corrigido com um segundo teste
numérico (`classes-passivas.test.mjs`) que chama `mostrarBuscaMagia()` de
verdade; como a função é assíncrona e produz DOM real via `abrirModal()`
(`site/js/utils.js`), o teste troca temporariamente `document.getElementById`/
`querySelectorAll` por elementos falsos mínimos (função local
`chamarCapturandoModal`, restaurados em `finally`) só para capturar o HTML do
modal e extrair o contador — sem esse stub, o motor de unidade (sem
navegador) lançaria ao tentar manipular `#modal-overlay` de verdade. Reproví
a mesma mutação depois da correção: suíte inteira caiu para 1 falha
(1288/1223/1/64), restaurado o arquivo, voltou a 1288/1224/0/64.

### Guerreiro/Estilo de Luta — a lacuna que abriu este projeto (`classes-trocas`)

**Corrigida na Task 8 (2026-08-08)** — texto abaixo preservado por valor
histórico (o achado original, tal como relatado). O livro (`Classes.md:3812`)
concede ao Guerreiro o direito de trocar de Estilo de Luta a cada nível. O app
não implementava esse direito por nenhum mecanismo — confirmado por duas
rotas independentes que convergiam para a mesma causa: (1) varredura estática
não encontrava o par `estilo_luta_trocar_de`/`estilo_luta_trocar_para` em
`levelup.js`/`levelup-validations.js` (o único padrão de troca que o app de
fato usa, o da manobra do Mestre da Batalha); (2) `exigeEstiloLuta(classe,
nivel)` (`site/js/levelup.js:458-460`) nunca devolvia `true` para
`'Guerreiro'`, então `escadaDeNivel` subia um Guerreiro do nível 1 ao 20 sem a
pendência `'estilo_luta'` disparar em nível nenhum. Era o bug relatado por um
usuário real que abriu este projeto. Agora `site/js/levelup.js` tem
`exigeTrocaEstiloLutaGuerreiro`, aplicada sem nunca bloquear a subida de
nível (o direito é opcional), exposta num card próprio no step "Revisão e
Confirmação" do assistente de subida de nível, e provada tanto por teste de
unidade (`classes-trocas.test.mjs`) quanto por spec de navegador
(`testes/e2e/regras/classes-trocas-ui.spec.mjs` — necessário porque a
revisão final da Task 8 achou os cards renderizados mas não ligados a nenhum
evento do step em que vivem; teste de unidade não tem como ver esse tipo de
bug).

### Heurística Ativa/Passiva — 28 divergências, 7 causas de código

`classes-passivas.test.mjs` confronta `ehHabilidadeAtiva()`
(`site/js/utils.js:499-511`) — a heurística por substring que decide em qual
seção da ficha ("Habilidades Ativas"/"Habilidades Passivas") uma
característica de classe aparece — contra as 174 características de classe
base, restrito às entradas com frase citável do livro (`base:
'custo-declarado'`/`'ausencia-de-custo'`; `'julgamento'` e `composta: true`
rodam a heurística e registram o resultado, mas não sustentam alegação, ver
cabeçalho do catálogo). 28 divergem, agrupadas em **7 causas de código** — um
ajuste em `ehHabilidadeAtiva`/`detectarRecarga` por causa resolveria todas as
entradas daquela causa de uma vez. Em `lacunas-conhecidas.mjs`, o campo
`talento` de cada uma dessas 7 entradas é uma **classe representativa**
(a mecânica de `comLacuna` exige um par `(talento, teste)` — quando a causa
afeta várias classes, uma serve de chave e todas são listadas por extenso
no `motivo`, que é onde a alegação de verdade mora):

| Causa | Entradas | O que a heurística confunde |
|---|---|---|
| `classes-passivas-ativa-no-turno` | 8 | `'no seu turno'` qualifica QUANDO o benefício passivo vale (Ataque Extra em 5 classes, suas variantes de nível superior no Guerreiro, Movimento Acrobático do Monge), não como ele é ativado |
| `classes-passivas-recarga-troca-escolha` | 6 | `detectarRecarga` trata "Sempre que completar um Descanso Longo, você pode... alterar/substituir" (Maestria em Arma em 5 classes, Maestria de Magias do Mago) como recarga de uso limitado, quando é troca de uma escolha permanente |
| `classes-passivas-clausula-lateral` | 6 | `'você pode usar'` casa uma cláusula SECUNDÁRIA do texto (aviso de compatibilidade, alcance de outra característica, piso incondicional), não o benefício sendo classificado |
| `classes-passivas-descanso-curto-janela` | 2 | `detectarRecarga` trata Descanso Curto como recarga de uso limitado quando é janela/reset sem limite de uso (Memorizar Magia do Mago, reset de CD de Fúria Implacável do Bárbaro) |
| `classes-passivas-acao-bonus-parte-de` | 1 | `"como parte da Ação Bônus"` (Bote Instintivo do Bárbaro) não é reconhecido — só `"como uma ação bônus"` está na lista |
| `classes-passivas-custo-verbo-rigido` | 3 | custo em recurso nomeado sem o verbo literal `"pode gastar"` (custo em dados do Ladino, `"deve gastar"` do Paladino) |
| `classes-passivas-reacao-executar` | 2 | `"executar uma Reação"` (Ladino, Monge) não é reconhecido — só `"como uma reação"` está na lista |

**A consequência, em nenhuma das 7, é de regra mal aplicada — mas em duas
(2 e 4) há também consequência interativa, só que não em toda característica
das duas.** Corrigido em 2026-08-08 (achado da revisão final da Task 8: a
versão anterior deste parágrafo dizia "7 das 8", superafirmando por não ter
sido de fato verificada função a função — rodar `renderFeatureItem` de
verdade sobre as 6 de `classes-passivas-recarga-troca-escolha` mostra o
oposto). Na maioria das 7 causas, `ehHabilidadeAtiva` só decide em qual das
duas seções da ficha a característica é impressa
(`site/js/sheet/caracteristicas.js:37-38,64-65`); o texto e o efeito da
característica são idênticos nas duas seções, e nenhuma outra função do app
consulta essa heurística para decidir se um bônus se aplica — exibição
apenas. Nas causas `classes-passivas-recarga-troca-escolha` (6 características)
e `classes-passivas-descanso-curto-janela` (2 características) — 8 ao todo —,
a mesma detecção de `recarga` que alimenta `ehHabilidadeAtiva` PODE também
alimentar um controle INTERATIVO em `renderFeatureItem`
(`habilidades.js:4683`, condição `!usosHtmlBody && ativa && recarga`,
guardada por `!usosHtmlBody`) — mas só quando nenhum ramo dedicado da
característica já preencheu `usosHtmlBody` antes. Das 8, só **3** chegam
nessa condição: Maestria de Magias do Mago (a única "Maestria" sem ramo
dedicado — as outras 5, Bárbaro/Guerreiro/Guardião/Paladino/Ladino
"Maestria em Arma", TÊM ramo próprio, que preenche `usosHtmlBody` com um
botão "Definir Maestrias" e nunca alcança a condição interativa) e as 2 de
`classes-passivas-descanso-curto-janela` (Memorizar Magia do Mago e Fúria
Implacável do Bárbaro). Memorizar Magia e Maestria de Magias ganham o botão
"✓ Disponível"/"✗ Usado" (`data-toggle-uso`) cujo clique grava
`char.usos_habilidades[key]` e chama `salvar()` (`habilidades.js:38-41`);
Fúria Implacável ganha um controle diferente e igualmente indevido —
"Usar"/"✗ Esgotado" com 2 usos — por uma causa **não relacionada**:
`detectarUsosMaximos` (`habilidades.js:2359-2369`) lê "duas vezes" em "seus
Pontos de Vida mudam para um número igual a duas vezes seu nível" como se
fosse uma contagem de usos, não a fórmula de PV recuperado. Para as outras 5
(as "Maestria em Arma" que TÊM ramo dedicado), a consequência real que sobra
é mais modesta — um selo `recargaBadge` ("🌙 Desc. Longo",
`habilidades.js:2727-2729`) rotulando como "recarrega no Descanso Longo"
uma capacidade que na verdade nunca se esgota, sem estado persistido nem
botão clicável. "Maestria de Magias marcada como Usado" é mais que um selo — é
um controle que o jogador pode clicar e que persiste um estado que o livro
não prevê. Classificar qualquer uma das 7 como "regra aplicada errado"
ainda seria superafirmar (nenhum cálculo/bônus muda), mas o motivo de cada
entrada em `lacunas-conhecidas.mjs` cita esse detalhe onde ele existe, em
vez de tratar as 7 como uniformemente cosméticas.

**Por que "7 causas", não "28 lacunas" nem "1 lacuna genérica".** Sete é o
nível que descreve o CONSERTO (um ajuste na heurística por causa), sem
inflar o número visível nem escondê-lo atrás de uma única entrada guarda-
-chuva que perderia a granularidade de qual conserto resolve qual grupo — o
mesmo raciocínio que o domínio Antecedentes já registrou (21 entradas, 2
causas) e que este domínio confirma numa forma diferente: aqui a
granularidade de registro (7) é menor que a de teste (28), porque a mecânica
de `comLacuna` permite que várias asserções apontem para a mesma entrada de
`LACUNAS` — o mesmo padrão já usado para o Clérigo (`classes-tabela`, uma
entrada, dois call sites).

### Flag/campo sem consumidor — 2 achados, mais um achado de outra natureza que uma revisão corrigiu (✅ corrigido na Task 7)

A primeira redação desta rodada listava três achados sob o mesmo rótulo
("flag/campo sem consumidor, efeito real no livro"). Uma revisão pegou dois
erros de leitura nela: a redação de dois efeitos foi copiada do texto que a
própria FICHA usa para exibi-los, não do livro; e o terceiro achado
(`extras_classe`) não era desse tipo — era código morto, e o achado real
estava em outro lugar. Corrigido:

- `passivos.flags.estilo_armas_grandes` (`talentos-effects.js:414`) — o livro
  (`Talentos.md:764`) manda **tratar** qualquer 1 ou 2 num dado de dano
  **como um 3** (regra de 2024) — não "re-rolar" (regra de 2014, mecânica
  diferente; a redação anterior copiou a string que a ficha exibe,
  `habilidades.js:4638`). A flag booleana nunca é lida por nenhum cálculo,
  mas "Combate com Armas Grandes" **é** chave de `efeitosEstilo`
  (`habilidades.js:4638`) — a ficha exibe um texto de efeito, só que com a
  regra ERRADA. Implementação parcial (texto exibido, cálculo ausente), não
  ausência total.
- `passivos.flags.estilo_duas_armas` (`talentos-effects.js:417`) — o livro
  (`Talentos.md:770`) concede o modificador de atributo a "um ataque
  adicional... resultante de usar uma arma com a propriedade Leve", com a
  ressalva "se já não estiver adicionando-o ao dano" — não "mão secundária"
  (redação anterior, copiada de `comum.js`/`habilidades.js`). Não existe, em
  lugar nenhum de `site/js/`, um cálculo de "ataque adicional"/"mão
  secundária" a que a flag pudesse se conectar (confirmado por grep: essas
  frases só aparecem em texto descritivo de escolha).
- `personagem.extras_classe` (`passo-classe.js:227/234`) — **não é lacuna**:
  o app já concede o +1 truque do Taumaturgo/Xamã por outro mecanismo
  (`creator/passo-magias.js:54-56`, `creator/wizard.js:330-332`, um ramo
  escrito à mão sobre `ordem_divina`/`ordem_primal`). `extras_classe` é
  código morto. O achado real, mais estreito, é o bônus aplicado em UM
  fluxo e não no outro — ver "Bônus de truque do Taumaturgo/Xamã", abaixo.

### Bônus de truque do Taumaturgo/Xamã — implementado no criador, não na ficha nem na subida de nível (✅ corrigido na Task 7)

O livro (`Classes.md:1568`/`:2060`) concede +1 truque conhecido ao Clérigo da
Ordem Divina Taumaturgo e ao Druida da Ordem Primal Xamã. `creator/
passo-magias.js:54-56` e `creator/wizard.js:330-332` aplicam esse bônus
corretamente durante a criação do personagem. `sheet/grimorio.js:27`,
`sheet/magias.js:399` e `levelup-flow.js:93-94` — os três outros lugares que
chamam `getTruquesConhecidos()` para calcular um limite de truques mostrado
ou validado ao jogador — não aplicam. Consequência medida: um Clérigo
Taumaturgo (ou Druida Xamã) criado no nível 1 é gravado com 4 truques
conhecidos, mas a ficha calcula o limite como 3 — `grimorio.js:87` exibe
"Truques: 4/3" e `grimorio.js:263` bloqueia qualquer troca de truque com
"Limite de 3 truques atingido" desde a criação, sem o jogador ter feito nada
de errado.

### Terceiro vocabulário de Estilo de Luta — 5 nomes sem texto na ficha (✅ corrigido na Task 7)

O seletor de classe (`CLASSES_ESCOLHAS`, `comum.js:282-393`) grava o nome que
o jogador escolheu; o mapa de exibição da ficha (`efeitosEstilo`,
`habilidades.js:4635-4648`) usa um vocabulário DIFERENTE, que só bate por
acaso em metade dos 10 nomes. Os efeitos numéricos não sofrem (`getEstiloAtivo`
normaliza os dois vocabulários) — só a exibição sofre: "Duas Armas",
"Desarmado", "Interceptação", "Luta às Cegas" e "Protetivo" não têm texto de
efeito na seção correspondente da ficha, mesmo sendo escolhas válidas
oferecidas ao jogador.

### Limites declarados

**Só 1 dos 26 direitos de troca é observável em teste de unidade.** O
catálogo `classes-trocas.mjs` transcreve 26 cláusulas do livro que concedem
ao jogador o direito de substituir uma escolha anterior. `subirDeNivel()`
(a função que `escadaDeNivel` dirige) só enxerga uma troca se ela passar por
`opcoes.*` durante o fluxo de subida de nível — e 25 das 26 não passam por
aí:

- **Truques e Magias Preparadas** (16 entradas, 8 classes): aplicados por
  mutação direta de `char.magias_conhecidas`/`char.magias_preparadas` em
  `levelup-ui.js:1392-1411`, ou por `mostrarTrocaMagias`/
  `mostrarTrocaMagiaConhecida` (`site/js/sheet/grimorio.js`) disparadas pelo
  Descanso Longo (`hp-descanso.js`) — nenhum dos dois caminhos passa por
  `opcoes`.
- **Invocações Místicas, Arcana Mística, Metamagia** (3 entradas, Bruxo/
  Feiticeiro): editadas livremente na ficha, sem gate de nível/descanso
  nenhum.
- **Maestria em Arma** (5 entradas): o botão "Maestrias" da ficha
  (`abrirModalMaestrias`) não tem checagem nenhuma — irrestrito por
  construção, mesmo havendo um segundo caminho corretamente gated ao
  Descanso Longo.
- **Forma Selvagem do Druida** (1 entrada): o app não tem NENHUM campo que
  registre quais formas são conhecidas (só usos gastos) — não há estado
  para a troca aderir, então não há o que um teste de unidade confronte.

Uma asserção de unidade contra qualquer uma dessas 25 seria **cega por
construção**: `subirDeNivel` nunca vê a mutação, então o teste passaria
sempre, independente do app estar certo ou errado — produzindo uma "lacuna
falsa" por ausência de sinal, não por confirmação. Por isso o catálogo marca
`observavelEmUnidade: false` nas 25 (com `motivoSeNaoObservavel` preenchido e
exigido por teste), e só a entrada do Guerreiro — que É observável e que É a
lacuna real — vira asserção neste motor. As outras 25 ficam fora do alcance
de `testes/regras/` inteiro: confrontá-las exigiria um spec de navegador que
dirigisse a ficha/o modal/o Descanso Longo, fora do escopo desta rodada.

**A consequência da heurística Ativa/Passiva nunca é de regra mal
aplicada — mas duas das 7 causas vão além do selo na seção errada.** Ver
seção acima ("Heurística Ativa/Passiva") — vale repetir aqui porque é fácil
ler "28 divergências" e presumir regra quebrada, e igualmente fácil, tendo
corrigido isso, ler "é só exibição" e presumir que nada além do rótulo
muda quando duas causas produzem um botão clicável na ficha.

**`talentos-effects.js` grava 88 flags distintas; o app tem 2 consumidores.**
Achado da Task 5 (não convertido em lacuna: validar cada uma contra o livro é
trabalho de uma rodada própria, do tamanho de um novo domínio). Só
`passivosTalentosCache.flags.sortudo` (`sheet/ficha.js:760`) e
`.flags.mestre_armas_maestria_extra` (`sheet/maestrias.js:21`) têm consumidor
real em todo `site/js/`; as outras ~86, incluindo as duas confirmadas nesta
rodada (`estilo_armas_grandes`, `estilo_duas_armas`), não. Registrado aqui
como observação para uma rodada futura, não como lacuna desta.

**Em 9 dos 11 blocos de `EFEITOS_NUMERICOS` (`classes-passivas.test.mjs`), o
campo `entrada.efeito` é decorativo, não conferido.** Achado I3 da revisão
final da Task 8 (adiado da rodada anterior; formalizado aqui). "Varredura
exaustiva" (usada acima e na tabela de arquivos) descreve o DOMÍNIO DE
ENTRADA testado (30 valores de atributo, 20 níveis, etc.) contra o valor que
a função do app calcula — não que `entrada.efeito` (a frase do livro
transcrita no catálogo) seja parseada e comparada em todo bloco. Em só 2 dos
11 blocos o teste efetivamente EXTRAI o número esperado de `entrada.efeito`
por regex e o confronta com a saída do app — "Ataque Extra" (`"ataca N
vezes"`, `classes-passivas.test.mjs:518`) e os 4 sub-variantes numéricas de
Estilo de Luta com campo em `resolverPassivosTalentos` (Arquearia, Combate
com Armas de Arremesso, Duelismo, Combate Desarmado —
`classes-passivas.test.mjs:743`). Nos outros 9, o valor esperado é calculado
de forma independente (ex.: `10 + modAtributoIndependente(valor)`) e
`entrada.efeito` só aparece INTERPOLADO na mensagem de falha, para contexto
humano — trocá-lo por um texto absurdo não quebraria o teste: Defesa sem
Armadura (Bárbaro/Monge, `:370`), Estilo de Luta "Defensivo" (`:395`),
Movimento Rápido do Bárbaro (`:428`), "Errante" do Guardião (`:445`),
Feitiçaria Inata do Feiticeiro (`:565`), "Pau pra Toda Obra" do Bardo
(`:599`), Ordem Divina/Primal Taumaturgo/Xamã (`:623`), Aura de Proteção do
Paladino (`:651`) e Véu da Natureza do Guardião (`:669`). Isso não enfraquece
essas 9 asserções — elas confrontam a FUNÇÃO do app contra um valor
calculado por fórmula independente do livro, o que é mais forte que
comparar contra o próprio texto transcrito — só significa que o catálogo
`EFEITOS_NUMERICOS` funciona, nesses 9 casos, como referência humana e
citação (`entrada.livro`), não como fonte parseada do valor esperado.

## Achados do domínio Subclasses (2026-08-17)

Como o domínio Regras Transversais da Ficha, este **não encontrou nenhuma
divergência**. `lacunas-conhecidas.mjs` termina a rodada com a mesma **1**
entrada de antes (`Aumento no Valor de Atributo`/`escolhas`,
`limitacao-observabilidade`, do domínio de talentos) — zero entradas novas,
de qualquer `tipo`.

Uma afirmação de "zero divergências" só vale o que a varredura por trás dela
cobre, então o que foi varrido, por completo, sem amostragem
(`unidade/subclasses.test.mjs`, 170 testes):

- **As 241 características das 48 subclasses**, transcritas das 12 seções de
  subclasse de `Classes.md`, confrontadas contra as duas rotas do app para o
  mesmo fato: `dados/classes/*.json → subclasses[].caracteristicas` lido do
  disco (48 testes, um por subclasse, comparando a lista inteira de uma vez),
  e `obterCaracteristicasSubclasseNivel()` (`site/js/levelup.js:726`), varrida
  em 48 subclasses × 20 níveis = 960 verificações — incluindo os níveis em que
  o esperado é lista vazia, que são a maioria das 960 e o que pegaria uma
  característica concedida no nível errado.
- **Os 48 nomes de subclasse**, confrontados quanto à coerência entre
  `catalogo/classes.mjs` (que já tinha os nomes, do domínio Classes/Níveis) e
  `catalogo/subclasses.mjs` (que pendura as características neles), mais
  `CLASSE_DA_SUBCLASSE` apontando para a classe certa — 12 testes, um por
  classe.
- **A citação de cada subclasse** (`CITACOES`), conferida nas duas pontas:
  aponta para um heading real de `Classes.md` E é o heading desta subclasse
  específica, não de outra seção do livro (achado da revisão da Task 5 deste
  plano — a checagem original só provava a primeira ponta).
- **Os níveis de concessão**, confrontando os níveis em que cada subclasse tem
  característica transcrita contra os níveis que a tabela de `PROGRESSAO`
  marca com "Subclasse X"/"Característica de Subclasse" — 12 testes, um por
  classe, duas transcrições independentes do mesmo livro feitas em rodadas
  diferentes (Classes/Níveis e Subclasses).

**Teste de mutação, prova de vermelho e restauração** (Task 6 deste plano):
estragar `{ nivel: 3, nome: 'Vitalidade da Árvore' }` para
`'Vitalidade da Árvore XXX'` em `catalogo/subclasses.mjs` derrubou a suíte de
1542/1478/64/0 para **1542/1476/64/2**, com exatamente as duas falhas
esperadas (`características × dados/classes/: Trilha da Árvore do Mundo
(Bárbaro)` e `obterCaracteristicasSubclasseNivel × livro: Trilha da Árvore do
Mundo (20 níveis)`) — duas rotas de código sobre a mesma fonte de dados
(`dados/classes/*.json`), a segunda cobre o filtro por nível, que a primeira
não vê. Restaurar o valor voltou a suíte a 1542/1478/64/0.

**Uma armadilha real do livro, transcrita e documentada** (não é divergência
do app — é uma irregularidade do próprio `Classes.md`, vale registrar para a
próxima rodada não a redescobrir como lacuna falsa): `Classes.md:1393` grafa
"Nível 3: Magias de Pacto do Grande Antigo" como texto solto, sem o `###` que
todas as outras 240 características de subclasse usam. A característica
existe de fato (parágrafo e tabela "Magias do Grande Antigo" logo abaixo) e
foi transcrita mesmo sem o heading — sem ela, Patrono O Grande Antigo teria 6
características em vez de 7, e Bruxo 21 em vez de 22. O comentário no próprio
catálogo (`catalogo/subclasses.mjs`, acima de `'Patrono O Grande Antigo'`)
documenta a armadilha no lugar onde ela poderia voltar a confundir alguém.

**O escopo declarado fora**, em voz alta — o mesmo que o domínio Classes/
Níveis já tinha anotado como dependência direta desta rodada:

- **As magias concedidas pela subclasse** — Plano 2 do mesmo domínio
  (`docs/superpowers/specs/2026-08-17-subclasses-design.md`).
- **As escolhas exigidas na subida de nível** (qual truque, qual manobra,
  qual forma) — Plano 3.
- **Os recursos que a subclasse cria na ficha** (usos, recarga) — Plano 4.
- **A prosa das 241 descrições** — o catálogo transcreve só `{ nivel, nome }`,
  o que é objetivamente conferível; o texto mecânico de cada característica
  não é transcrito por este catálogo (ver o cabeçalho de
  `catalogo/subclasses.mjs`).

## Achados do domínio Subclasses / Magias (2026-08-17)

Plano 2 do mesmo domínio — o Plano 1, acima, cobriu só nível e nome das 241
características; nenhuma magia. Este motor (`subclasses-magias.test.mjs`)
confronta as magias que cada subclasse concede de verdade ao personagem.

**O que foi varrido, por completo e sem amostragem — para "3 causas"
significar alguma coisa.** O catálogo (`catalogo/subclasses.mjs`) precisou de
QUATRO listas para cobrir as 48 subclasses sem produzir lacuna falsa (medido
no pré-voo, emenda registrada em `situação.txt`): `MAGIAS_SUBCLASSE` (**24
subclasses, 192 magias** em lista fixa sempre preparada),
`SUBCLASSES_MAGIA_POR_ESCOLHA` (**2** — Círculo da Terra e Colégio do
Conhecimento, concedem mas dependem de escolha do jogador, sem lista fixa a
transcrever), `SUBCLASSES_MAGIA_OUTRO_MECANISMO` (**5** — concedem por
"conhece a magia" ou "apenas como Ritual", não por "sempre preparada") e
`SUBCLASSES_SEM_MAGIA` (**18** — não concedem nada). A soma bruta é 49, não
48, porque `Ilusionista` aparece em duas listas — a única sobreposição, e
correta: tem o truque *Ilusão Menor* **conhecido** no nível 3 e as magias
*Convocar Feérico*/*Invocar Fera* **sempre preparadas** no nível 6, dois
mecanismos do livro, duas características diferentes. Mais
`MAGIAS_CLASSE_SEMPRE` (**5 classes, 7 concessões** de magia da CLASSE base,
não da subclasse — curada porque `obterMagiasSemprePreparadasNivel` devolve
as duas juntas, e sem descontar as de classe a asserção "nada a mais"
acusaria falso em toda classe que concede algo por si) e
`TETO_MAGIAS_POR_ESCOLHA` (o teto numérico das 2 subclasses de escolha).

O motor confronta essas listas por **três rotas independentes**, cada uma
varrendo as 48 subclasses inteiras: a união dos dois mecanismos de parser
(`obterMagiasDominioNivel` + `obterMagiasSemprePreparadasNivel`, 48 × 20
níveis), a ficha resultante de uma subida de nível real do 1 ao 20 via
`escadaDeNivel` (48 escadas, níveis 2-20 — a escada não passa pelo nível 1,
coberto pela rota dos acessores), e os dois acessores que
`site/js/pages/sheet.js:48-49` usa para montar a ficha salva (48 subclasses,
níveis 1-20). A asserção é sempre sobre a UNIÃO dos mecanismos, nunca sobre
qual deles entregou — exigir um mecanismo específico mediria arquitetura, não
comportamento.

**As causas, não os sintomas.** 15 asserções vermelhas (**5 subclasses × 3
rotas**, medido pela Task 5 dirigindo `escadaDeNivel` de verdade — nenhuma
subclasse divergiu ENTRE rotas, as mesmas 5 falham nas 3 sempre) fecharam em
**3 causas de código**, registradas em **6 entradas** de
`lacunas-conhecidas.mjs` (3 causas × 2 chaves — `subclasses-magias` para a
ficha/escada, `subclasses-magias-ficha` para os acessores de `sheet.js`):

- **Causa 1 — Círculo da Lua, Círculo do Mar, Vigilante das Sombras.** A
  guarda `texto.includes('sempre') && texto.includes('preparad')` em
  `extrairMagiasSemprePreparadasTabela`/`...Texto` (`site/js/levelup.js:498`,
  `:533`) barra a extração porque a frase do livro diz "você tem a lista de
  magias preparadas", sem a palavra "sempre" antes — mesmo a tabela tendo o
  formato `| N | *Magia* |` que a função sabe ler. As três também são
  barradas, de forma independente, pelo regex de nome de
  `obterMagiasDominioNivel` (`/^magias?\s+de/i`, `levelup.js:757`): o nome da
  característica é "Magias **DO** Círculo da Lua/Mar" / "Magias **DO**
  Vigilante das Sombras" — "do" não casa com "de". Um fix único (afrouxar a
  guarda "sempre") resolveria as três.
- **Causa 2 — Círculo da Terra.** A característica junta as quatro tabelas de
  terreno (Árido, Polar, Temperado, Tropical) numa única `descricao`;
  `extrairMagiasSemprePreparadasTabela` (`levelup.js:503-521`, alcançada via
  `obterMagiasSemprePreparadasNivel`) varre a descrição inteira somando as
  quatro ocorrências de cada nível, sem noção de "escolha do jogador" — 12
  magias no nível 3 contra o teto de 3 do livro (e 4× o teto em cada um de
  5/7/9). A rota de "domínio" (`obterMagiasDominioNivel`) está **morta** para
  esta subclasse, pelo mesmo bug de nome "do"/"de" da Causa 1 — é por isso
  que quem soma as quatro tabelas é a rota "sempre preparada", e não a de
  domínio, apesar do nome da característica sugerir o contrário; ela PASSA da
  guarda porque a frase de abertura é "**Sempre** que completar um Descanso
  Longo, escolha um tipo de terreno..." — a mesma palavra que falta nas
  outras três está presente aqui, só que na frase errada (a de "quando
  escolher", não a de "magias preparadas"). Modelar a escolha de terreno é um
  problema estrutural diferente, não corrigido pelo fix da Causa 1.
- **Causa 3 — Círculo das Estrelas.** Três bloqueios independentes, nenhum
  resolvido pelo fix da Causa 1 (confirmado simulando a mudança contra os
  dados reais, sem editar `site/js/`): (1) a descrição contém uma tabela
  markdown de **formato do mapa** (`1d6 → Formato do Mapa`, aparência, não
  magia), que faz `extrairMagiasSemprePreparadasTexto` desistir em
  `levelup.js:536` antes de tentar extrair nomes; (2) a frase de concessão
  real ("Enquanto estiver segurando o mapa, você tem as magias Orientação e
  Raio Guia preparadas") não contém "sempre" em lugar nenhum; (3) mesmo se a
  guarda da Causa 1 fosse afrouxada, a linha `3 | Uma pele de urso-coruja...`
  da tabela 1d6 bateria no regex de linha de
  `extrairMagiasSemprePreparadasTabela` (`levelup.js:504`) e viraria "magia"
  — afrouxar sem também blindar contra tabelas de formato/aparência troca um
  bug por outro.

**A consequência medida, como o jogador encontra.** Causas 1 e 3: um jogador
sobe um Druida de Círculo da Lua/Mar/Estrelas (ou um Guardião Vigilante das
Sombras) até o nível de concessão (3, e também 5/7/9 para Lua/Mar, 5/9/13/17
para Vigilante) — o card de subida de nível não mostra nenhuma magia nova de
subclasse, e a ficha salva nunca lista nenhuma delas sob "Domínio"/"Sempre
Preparada", em nenhum nível posterior; a variável que teria essas magias
(`magiasSempreNivel`) não alimenta nenhum card mesmo depois de um conserto na
guarda — seu único consumidor em `site/js/` é um `Set` de deduplicação da
tela de seleção de magias, não um render. Causa 2: um jogador sobe um Druida
de Círculo da Terra ao nível 3 — o card de subida de nível também não mostra
nada (mesma razão), e a ficha salva, do nível 9 em diante, mostra **24
magias** sob o rótulo **"Sempre Preparada"** (não "Domínio" — a origem
gravada é `'sempre'`, a rota de domínio está morta) — o livro concede no
máximo 6 (uma tabela de terreno escolhida: 3 no nível 3, 1 em cada um de
5/7/9).

**O limite honesto.**

- Este motor confronta o que o app **entrega** ao personagem — a lista final
  de magias/truques na ficha, via os dois mecanismos de parser mais a escada
  real — não a redação da descrição em `dados/`; uma descrição mal escrita
  que ainda produzisse a lista certa passaria aqui sem alegação nenhuma.
- A curadoria de `MAGIAS_CLASSE_SEMPRE` foi feita para o motor **não acusar
  falso** (descontar o que é concessão de classe base do que é concessão de
  subclasse), não para **provar** as concessões de classe — essas ficam para
  outro domínio, se um existir.
- **O teto declarado, em voz alta:** o teto do Colégio do Conhecimento (2 no
  nível 6) nunca é exercitado perto do valor declarado, porque o app entrega
  0 ali — o que roda vivo para essa subclasse é o teto **implícito** de 0 nos
  outros 19 níveis. Círculo da Terra, a outra subclasse de escolha, sim
  exercita o teto perto do valor real (12 medidos contra 3 do livro). A
  asserção continua `<=`, não `===`, de propósito — apertá-la recompensaria o
  app por nunca implementar a escolha do jogador.
- **Não cobre** magias por escolha do jogador — Círculo da Terra e Colégio do
  Conhecimento têm só teto numérico, sem lista de nomes a confrontar (Plano
  3 do mesmo domínio) — nem a conjuração 1/3 de Cavaleiro Místico/Trapaceiro
  Arcano, que tem motor próprio (`subclasse-conjuradora.test.mjs`, já na
  tabela acima).
- **Observação latente, registrada mas NÃO uma lacuna:** o limite hardcoded
  `[3, 5, 7, 9]` de `obterTodasMagiasDominio` (`levelup.js:797`) dropa os
  níveis 13 e 17 do Vigilante das Sombras — mas esse código nunca é
  alcançado para essa subclasse hoje, porque o regex de nome (Causa 1) já
  falha primeiro. Nenhum teste falha por essa causa isolada; fica registrado
  aqui para quando/se a Causa 1 for corrigida, o `[3,5,7,9]` pode virar bug
  real para essa subclasse.
- **Ressalva do livro que a síntese acima não pode esconder:** a concessão
  do Círculo das Estrelas é **condicional** — "Enquanto estiver segurando o
  mapa..." (`Classes.md:2493`) — não incondicional como as outras magias
  sempre preparadas deste catálogo.

**Uma citação corrigida nesta tarefa.** As duas entradas de
`SUBCLASSES_MAGIA_POR_ESCOLHA` citavam a linha do **heading** da
característica em vez da linha da **frase** transcrita (erro de 2 linhas,
achado na revisão da Task 2 e resolvido aqui): Círculo da Terra apontava
`Classes.md:2404` (o heading "### Nível 3: Magias do Círculo da Terra") para
a frase "Sempre que completar um Descanso Longo...", que está em `:2406`;
Colégio do Conhecimento apontava `:768`/`:770` (o heading "### Nível 6:
Descobertas Mágicas" e a primeira frase) para frases que estão em
`:770`/`:772`. As duas corrigidas nesta tarefa, conferidas linha a linha
contra `Classes.md`. As cinco citações de `SUBCLASSES_MAGIA_OUTRO_MECANISMO`
já apontavam para a linha exata e não precisaram de correção.

**A suíte, do início ao fim deste plano:** baseline (fim do Plano 1) —
1542/1478/64/0. Depois do motor (Task 4, só a rota de parser) —
1593/1524/64/5. Depois de acrescentar a escada real e os acessores da ficha
(Task 5) — 1689/1610/64/15 (as mesmas 5 subclasses, agora × 3 rotas). Depois
de registrar as lacunas (Task 6) — **1689/1625/64/0**, estado final.

## Achados do domínio Subclasses / Escolhas (Plano 3, 2026-08-17/18)

Plano 3 do mesmo domínio — o Plano 1 (acima) cobriu nível e nome das 241
características; o Plano 2, as magias concedidas. Nenhum dos dois tocou a
pergunta deste plano: quando uma característica de subclasse manda o jogador
decidir algo, o app pergunta a escolha CERTA no nível certo — e recusa
concluir a subida de nível sem ela?

### O catálogo: cinco listas, não duas

O desenho original (`task-2-brief.md`) previa só duas categorias — construção
× em jogo. Ler as 241 características provou isso insuficiente: forçar uma
concessão automática ("Você adquire proficiência em X", sem "à sua escolha")
dentro de "construção" produziria uma lacuna falsa ("o app não pergunta X"
sobre uma regra que o livro nunca manda perguntar); forçar uma escolha
cosmética (sabor sem efeito mecânico) dentro de qualquer categoria de escolha
produziria a mesma lacuna falsa na direção oposta. `catalogo/subclasses.mjs`
fechou em **cinco** listas — contadas programaticamente, não estimadas:

| Lista | Entradas | O que é |
|---|---|---|
| `ESCOLHAS_SUBCLASSE` | 23 (20 características distintas, 16 subclasses) | Escolha de CONSTRUÇÃO: o jogador decide, o resultado fica na ficha. Três características embutem DUAS escolhas de tipos diferentes na mesma entrada de nível (Estudioso da Guerra: ferramenta + perícia; Conjuração de Cavaleiro Místico e de Trapaceiro Arcano: truque + magia) — daí 23 entradas para 20 características. |
| `CONCESSOES_AUTOMATICAS_SUBCLASSE` | 5 | O livro concede sem perguntar nada ("Você adquire proficiência em X"); cobrar pendência aqui seria lacuna falsa — a afirmação correta é a oposta: o app NÃO deve perguntar. |
| `ESCOLHAS_EM_JOGO` | 50 | Alvo, direção, tipo de dano — decididos na hora do uso (ataque, conjuração, reação); nada persiste na ficha entre usos, ou persiste só até o fim do turno/da Fúria/da forma ativa. |
| `ESCOLHAS_COSMETICAS` | 3 | O livro deixa escolher ("escolha ou determine aleatoriamente"), mas a escolha não muda número nem opção disponível ao jogador — só aparência/manifestação. |
| `PASSIVOS_FORA_DESTE_MOTOR` | 1 | Efeito numérico passivo (bônus fixo a um teste), sem proficiência nem escolha — domínio de um motor de passivas de subclasse, se um dia existir (Plano 4 cobre recursos/uso/recarga; não é a mesma pergunta). |

Juntas, as cinco cobrem **78** características DISTINTAS das 241 — as que
mencionam escolha ou proficiência. A soma bruta das cinco (20+5+50+3+1) dá 79,
não 78, porque uma característica (Andarilho Feérico|3|Glamour Transcendental)
está DELIBERADAMENTE em duas listas ao mesmo tempo — ver "`campoEsperado` é
dica" mais abaixo. A maioria das 241 não menciona nenhuma das duas e por isso
não aparece em lista nenhuma; um teste (`subclasses-escolhas.test.mjs`, Grupo
1: "as cinco listas cobrem cada característica em exatamente uma, exceto a
dupla legítima") promove esse critério a invariante automático — não apenas a
"self-review" que sustentava esse número antes da correção pós-revisão de
2026-08-18 (ver "Achados", abaixo, e a nota de MENOR 6 no arquivo do motor).

### Por que 20 (23 entradas), não 73

Das 78 características classificadas, as **20** de `ESCOLHAS_SUBCLASSE` (23
entradas, porque três embutem duas escolhas) são as únicas cuja pendência
este motor exige no NÍVEL de aquisição — mas "exige que o app levante uma
pendência e recuse concluir sem ela" só vale sem ressalva para **18** delas.
As outras **2** — Resistência Ínfera (Patrono Ínfero) e O Terceiro Olho
(Adivinhador) — o livro nasce a escolha só no primeiro Descanso/uso depois da
aquisição, não no nível em si (Classes.md:1467/:5020); para essas duas, "o
assistente não pergunta NO NÍVEL" não é, por si só, uma violação de regra (ver
a ressalva da Causa 2, abaixo). As outras **53** — as 50 em jogo mais as 3
cosméticas — têm texto de livro tão parecido com "à sua escolha" quanto as 20
reais: é exatamente esse parecido que torna a separação valiosa, não uma
formalidade. Quem lesse só "73 características de subclasse envolvem uma
escolha do jogador" (20 + 53) numa rodada futura suporia que o app precisa
persistir as 73, e cobrar pendência das 53 em-jogo/cosméticas produziria 53
lacunas falsas — mais que o dobro das 31 que a rodada de Talentos já cometeu
por medir arquitetura em vez de comportamento. As 5 concessões automáticas
são um TERCEIRO caso, nem escolha nem ausência de menção: o livro fala nelas
sem "à sua escolha" nenhuma, e a asserção correta é que o app não pergunte —
o oposto da asserção sobre as 20.

O critério que separa construção de em-jogo não é sintático ("tem a palavra
'escolha'?") — é se o EFEITO da escolha sobrevive além do próprio uso. Uma
escolha cujo efeito dura até o próximo Descanso (Resistência Ínfera, Aspecto
dos Selvagens) é construção, mesmo sendo refeita a cada Descanso; uma cujo
efeito dura só o turno, a Fúria ativa ou a forma ativa (Vitalidade da Árvore,
Fúria dos Selvagens, Baluarte de Energia) é em jogo, mesmo gastando um uso
por Descanso. O comentário "CRITÉRIO DE FRONTEIRA" em `catalogo/subclasses.mjs`
documenta esse critério por extenso — foi acrescentado depois que "O Terceiro
Olho" (Adivinhador) foi encontrado do lado errado numa primeira leitura, e
antes da correção final ele ainda listava Resistência Ínfera com o
`campoEsperado` errado (uma chave snake_case inventada, nunca gravada por
nenhuma linha de `site/js/`) — ver a nota sobre `campoEsperado` mais abaixo.

(Nota de medição: o brief desta tarefa citava "8 escolhas" e "54
características" como referência de partida; os números medidos no catálogo
final — 20/23 características de construção, 53 em-jogo/cosméticas, 78
distintas classificadas ao todo (79 somando a dupla legítima duas vezes) —
divergem desses dois, e são os que valem: números medidos, nunca estimados.)

### `campoEsperado` é dica, não alegação

Cada entrada de `ESCOLHAS_SUBCLASSE`/`CONCESSOES_AUTOMATICAS_SUBCLASSE` tem um
`campoEsperado` — o nome do campo onde o resultado da escolha DEVERIA
aparecer no personagem. Ele não é uma exigência de que o app use esse nome
(mesmo estatuto que `efeito` tem em `classes-passivas.mjs`, já declarado
decorativo em 9 dos 11 blocos, acima): é preenchido só onde o campo foi
CONFERIDO existir em `site/js/` por `grep`, com a evidência (arquivo:linha)
na `observacao` da entrada; onde a característica é mecanicamente real mas
nenhum campo persistido existe (ex.: o terreno do Círculo da Terra),
`campoEsperado` é `null` e o motor consumidor compara o personagem **inteiro**
antes/depois do nível, em vez de olhar um nome de campo específico.

Uma correção da revisão independente de 2026-08-17 (achado CRÍTICO 1 do
catálogo) mostra por que essa disciplina importa: sete sub-chaves de
`campoEsperado` foram inicialmente escritas com nomes snake_case INVENTADOS
(`resistencias`, `presa_do_cacador`, `taticas_defensivas`,
`companheiro_primal`...) em vez do campo real — e essa invenção, sozinha,
teria produzido "nenhum mecanismo existe" para seis características que na
verdade JÁ TÊM controle dedicado, só que gravado sob
`char.recursos.<classe>.subclasses.<subclasse>.<campo>` pela ficha
(`site/js/sheet/*.js`), não sob o nome inventado. As seis foram corrigidas
para o campo REAL, conferido por `grep -rn` (evidência em cada `observacao`).
O erro nº 1 do [GUIA-PROXIMOS-DOMINIOS.md](GUIA-PROXIMOS-DOMINIOS.md) já
avisava sobre medir arquitetura em vez de comportamento; esta é a mesma
armadilha vestida de nome de campo em vez de nome de mecanismo — um campo
inventado transforma o motor num medidor da arquitetura que a curadoria
imaginou, não da que o app tem.

Uma OITAVA ocorrência do mesmo erro sobreviveu a essa correção e só foi pega
por uma revisão independente seguinte (2026-08-18, CRÍTICO 1): Treinamento
Marcial (Colégio da Bravura) grepava `proficiencias_armas` — nome inventado,
0 ocorrências — e concluía "proficiência com categoria de arma não é dado
variável guardado no app". Falso: o app guarda esse benefício sob
`proficiencias_extra` (criado por `store.criarPersonagemVazio()`, escrito só
para Clérigo Protetor/Druida Protetor), e a busca que teria achado isso
precisava ter sido pelo BENEFÍCIO ("proficiência com armas Marciais"), não
pelo nome chutado. Diferente das sete anteriores, esta não estava marcada
como `campoEsperado: null` — apontava para `proficiencias_armaduras` (um
campo real, mas só LIDO em `site/js/`, nunca escrito) e por isso o motor a
tratava como `t.skip` ("raiz fora da rota"), escondendo uma divergência
confirmada atrás de uma alegação de limite que não existia. Ver "Achados",
abaixo, para a correção completa.

### O motor: seis grupos, uma pergunta por direção

`unidade/subclasses-escolhas.test.mjs` (110 testes: 103 rodam a asserção, 7
skip) dirige `subirDeNivel()` via `escadaDeNivel` (nível 2..20, todas as 48
subclasses) e confronta em seis grupos:

1. **Higiene** — toda entrada das cinco listas aponta para uma característica
   real de `SUBCLASSES_CARACTERISTICAS`, com citação `Classes.md:<linha>`; e
   (MENOR 6 da revisão independente de 2026-08-18) toda característica citada
   por alguma das cinco aparece em exatamente uma, exceto a dupla legítima
   (Andarilho Feérico|3|Glamour Transcendental) — invariante que promove o
   antigo "self-review" manual a teste, mutação-comprovado.
2. **A escada, uma vez por subclasse** — sobe as 48 subclasses do nível 1 ao
   20 uma única vez (não uma vez por grupo), guardando as pendências por
   nível para os grupos seguintes reaproveitarem.
3. **Direção 1** (o livro exige, o app pede?) — para as 23 entradas de
   `ESCOLHAS_SUBCLASSE`: não basta "alguma pendência apareceu no nível" (a
   lição do incremento Ladino nv6, GUIA-PROXIMOS-DOMINIOS.md — medir célula
   em vez de rótulo deixa uma característica vizinha "emprestar" cobertura
   para uma sem mecanismo nenhum); tem que ser a pendência certa, ou —
   quando o mecanismo é desconhecido — nenhuma pendência de uma característica
   irmã do mesmo nível pode ser contada por engano.
4. **Direção 2** (o app pede, o livro exige?) — varre as 48 subclasses
   inteiras, não só as 16 declaradas: uma pendência específica de subclasse
   num nível que o livro não prevê é escolha morta. 100% verde.
5. **Concessões automáticas não viram pendência** — para as 5 entradas de
   `CONCESSOES_AUTOMATICAS_SUBCLASSE`: o app não deve levantar pendência onde
   o livro concede sem perguntar. 100% verde.
6. **O converso** — o personagem realmente MUDOU ao ganhar o nível, com ou
   sem pendência? Compara duas escadas (até `nível-1` e até `nível`) para
   isolar o que a SUBCLASSE concedeu daquele nível específico do que a CLASSE
   já concede em qualquer subida. Existe porque a Direção 1 sozinha teria um
   falso negativo de arquitetura: um app pode implementar a escolha SEM
   pendência nenhuma, concedendo o resultado direto — a Direção 1 marcaria
   isso como vermelho por engano.

### Limite declarado: este motor dirige só `subirDeNivel`

Mesmo limite que `subclasses-magias.test.mjs` já documenta, e a razão pela
qual uma das quatro causas desta rodada não é bug do app. `subirDeNivel`
(`site/js/levelup.js`, dirigido via `escadaDeNivel`) é só a metade que GRAVA
o resultado de um nível; em duas classes (Guerreiro/Cavaleiro Místico,
Ladino/Trapaceiro Arcano) a pergunta/bloqueio/renderização da escolha de
conjuração vive numa camada acima — `buildLevelUpContext`/
`calcularConjuracao` (`levelup-flow.js`), consumida por
`levelup-cards.js`/`levelup-validations.js`/`levelup-ui.js` — que grava em
`char.magias_conhecidas`/`char.magias_preparadas` **antes** de chamar
`subirDeNivel`. `escadaDeNivel` nunca passa por essa camada. Dois outros
caminhos ficam fora pelo mesmo motivo, sem achado confirmado (investigação
fora do escopo desta rodada): o assistente de CRIAÇÃO (`site/js/creator/`) e
qualquer mecanismo que só a ficha (`site/js/sheet/*.js`) resolva depois da
subida — que é exatamente onde sete das 23 escolhas de construção têm seu
controle real, gravado em `char.recursos.*` (ver Causa 2, abaixo).

### O spec de navegador: dirige o assistente de verdade

`testes/e2e/regras/subclasse-escolha.spec.mjs` (1 teste) existe porque o
motor de unidade acima só prova que `subirDeNivel` grava certo — nunca que a
TELA pergunta, bloqueia e persiste. Guerreiro é a semente deliberada (não
Ladino/Mago, que também trocam de subclasse): é a única classe cuja escolha
de subclasse pode abrir uma SEGUNDA escolha obrigatória no mesmo fluxo de
subida (Mestre da Batalha → Manobras), então um único cenário exercita as
duas travas. O spec sobe um Guerreiro do nível 2 ao 3 pelo assistente real e:

1. confere que a tela oferece as 4 subclasses do Guerreiro, pelos nomes
   exatos do catálogo (nem faltando, nem sobrando);
2. clica em Mestre da Batalha — o passo seguinte ("Manobras") só passa a
   existir agora, porque a visibilidade dos steps é recalculada a partir de
   `state.subclasse`;
3. confere que a tela exige "Selecione 3" manobras;
4. **tenta concluir sem escolher nenhuma — e o app recusa** (o passo que
   distingue este spec de uma checagem de HTML: "Próximo" nunca valida, só o
   clique final em Confirmar roda a validação);
5. volta, escolhe 3 manobras distintas pelo grid dedicado, confirma, e
   confere sobre o **personagem salvo**: `subclasse === 'Mestre da Batalha'`
   e as 3 manobras exatas em `manobras_conhecidas`.

Removida `'btn-lvlup-manobras'` de `gatilhos-sem-cobertura.mjs` (a lista
congelada de gatilhos de tela sem teste, ver `gatilhos-ui-cobertos.test.mjs`
acima): o passo 5 clica nesse botão de verdade, então o motor de cobertura
passou a enxergá-lo e cobrar a remoção. Confirmada como a única entrada
afetada (nenhuma outra "já coberta" apareceu, nenhuma "sumiu do código").
Estabilidade medida sob `--repeat-each=4 --workers=4`, duas rodadas
separadas: 8/8, nenhum flake.

### Achados: 33 asserções vermelhas, quatro causas

A primeira rodada do motor deu **32 `not ok`** (18 na Direção 1, 14 no
converso) — não 32 bugs independentes. Rastrear cada um até o consumidor
real do app (a mesma disciplina que a lição de Classes/Níveis já registra
acima) fechou em **quatro causas**, cada uma uma entrada em
`lacunas-conhecidas.mjs` (`teste: 'subclasses-escolha-ausente'`): três
`app-diverge-do-livro` e uma `limitacao-observabilidade`. A correção
pós-revisão de 2026-08-18 (CRÍTICO 1) acrescentou uma 33ª: Treinamento
Marcial (Colégio da Bravura) estava, por engano, fora da contagem — marcada
`t.skip` como se fosse limite de rota, quando é a mesma Causa 3 (concessão
automática que nada aplica) das outras quatro.

| Causa | `tipo` | Características | O que o jogador encontra na tela |
|---|---|---|---|
| 1 — nenhum controle em lugar nenhum | `app-diverge-do-livro` | 6 (7 entradas): Colégio do Conhecimento nv3/nv6, Estudioso da Guerra (Mestre da Batalha nv3), Glamour Transcendental (Andarilho Feérico nv3), Estilo de Luta Adicional (Campeão nv7), Magias do Círculo da Terra nv3 (a pendência do TERRENO, não as magias — bug já registrado à parte) | Três delas mostram um cartão **decorativo** na ficha (só texto, sem `<select>` nem botão: `site/js/sheet/habilidades.js:3087-3107`/`:4013-4022`); as outras três não têm sequer isso (`grep` por nome da característica em `site/js/` inteiro: 0 ocorrências). Nenhuma bloqueia a subida, nenhuma grava nada — o jogador termina o nível sem qualquer aviso. |
| 1-bis — controle existe, mas numa camada que este motor não dirige | `limitacao-observabilidade` | 2: Conjuração (Cavaleiro Místico nv3, Trapaceiro Arcano nv3) | Nada — o app pergunta, bloqueia e grava certo (`levelup-flow.js`/`levelup-cards.js`/`levelup-ui.js`, ver "Limite declarado" acima). Reclassificada nesta rodada (achado CRITICAL 1 de uma revisão independente): a redação original tinha posto as duas na Causa 1 sem confirmar por leitura ponta a ponta — corrigido depois de rastrear os cinco pontos do mecanismo real (contexto reativo à subclasse, quantidades corretas, card condicional, bloqueio de confirmação, gravação nos campos certos). |
| 2 — controle existe, só na ficha, nunca no assistente | `app-diverge-do-livro` | 7: Aspecto dos Selvagens (Trilha do Coração Selvagem nv6), Resistência Ínfera (Patrono Ínfero nv10), Afinidade Elemental (Feitiçaria Dracônica nv6), Presa do Caçador e Táticas Defensivas (Caçador nv3/nv7), Companheiro Primal (Senhor das Feras nv3), O Terceiro Olho (Adivinhador nv10) | O assistente de subida de nível conclui normalmente, sem nenhum aviso de pendência. O controle real existe e funciona — mas só em `char.recursos.*`, criado sob demanda pela FICHA (`site/js/sheet/*.js`), nunca por `subirDeNivel` nem por `store.criarPersonagemVazio()`. O jogador só encontra o controle se souber abrir a ficha salva depois e procurar o menu de Habilidades certo; nada na tela de nível aponta para lá. (Ressalva: para 2 das 7 — Resistência Ínfera, O Terceiro Olho — o livro nasce a escolha só no primeiro Descanso/uso após a aquisição, não no nível em si, então a ausência na TELA DE NÍVEL não é, sozinha, violação; a causa raiz técnica — `char.recursos` fora da rota `subirDeNivel` — continua real para as 7.) |
| 3 — concessão automática que nada aplica | `app-diverge-do-livro` | 5: Implementos de Misericórdia (Combatente da Misericórdia nv3), Ferramentas de Assassino (Assassino nv3), Mente de Ferro (Vigilante das Sombras nv7), Ilusões Aprimoradas (Ilusionista nv3), Treinamento Marcial (Colégio da Bravura nv3 — acrescentada na correção pós-revisão de 2026-08-18) | O livro concede sem perguntar nada, e o app corretamente não pergunta (Grupo 5, 100% verde) — mas também nunca CONCEDE. Duas mostram cartão decorativo só de texto; as outras três não têm ocorrência nenhuma em `site/js/`. O jogador não fez nada errado nem esqueceu escolha alguma: é uma regra automática do livro que o app simplesmente nunca aplica, em nenhum caminho. |

Aritmética conferida: Direção 1 (7 + 4 + 7 + 0) + converso (6 + 4 + 0 + 5) =
18 + 15 = 33, batendo exatamente com os `not ok` medidos depois da correção
pós-revisão (18 + 14 = 32 media a versão anterior, que tratava Treinamento
Marcial como skip em vez de vermelho).

### Os 71 skips não são cobertura

`npm run test:regras:unidade` foi de **1689/1625/64/0** (fim do Plano 2) para
**1799/1728/0/71** (depois da correção pós-revisão de 2026-08-18; a primeira
versão do Plano 3 tinha medido 1798/1726/0/72) — 110 testes neste arquivo
(109 do motor original + 1 invariante de higiene acrescentado nesta
correção, ver MENOR 6 acima), dos quais **7** são `t.skip`, não asserções que
passam. No converso (Grupo 6), todo `campoEsperado` cuja raiz é `recursos`
(`RAIZES_FORA_DA_ROTA_SUBIRDENIVEL`) é `t.skip`, **incondicional** de haver
`causa` registrada ou não — a checagem roda antes de qualquer wrap de
`comLacuna`. Os 7 são exatamente as **7** entradas da Causa 2 (todas
`recursos.*`, ver tabela acima) — nenhuma sobra fora das quatro causas: até a
correção pós-revisão de 2026-08-18 havia um 8º skip, Treinamento Marcial
(Colégio da Bravura nv3), com `campoEsperado: 'proficiencias_armaduras'`
tratado como se fosse a mesma impossibilidade arquitetural de `recursos` --
falso: `proficiencias_armaduras` (site/js/levelup.js:115) é só LIDO em
`site/js/`, nunca escrito por nenhuma linha; o campo REAL onde essa concessão
apareceria, `proficiencias_extra`, é plenamente alcançável por
`subirDeNivel`, e nenhuma rota grava nele para esta subclasse -- uma
divergência real, não um limite de rota, movida para a Causa 3 (ver acima). O
motivo do skip que resta nunca é silencioso: `t.skip` grava, por escrito, que
a raiz do campo (`recursos`) é uma impossibilidade ARQUITETURAL desta rota —
`store.criarPersonagemVazio()` não cria essa chave, nenhuma linha de
`site/js/levelup.js` a cria — e não uma alegação de "nenhum mecanismo do app
respondeu", que seria falsa sempre que a `observacao` do catálogo cita onde o
mecanismo real mora. Skip aqui é a mesma disciplina que o resto da suíte já
aplica: uma rota que não alcança um campo não é evidência de que o campo não
existe, e fingir que é produziria lacuna falsa às avessas (uma alegação de
"sem mecanismo" contra um mecanismo real, só que noutro arquivo).

## Achados do domínio Subclasses / Recursos (Plano 4 — e último, 2026-08-18)

Plano 4 do domínio Subclasses. O Plano 1 (acima) cobriu nível e nome das 241
características; o Plano 2, as magias concedidas; o Plano 3, as escolhas
exigidas na subida de nível. Nenhum dos três tocou a pergunta deste plano:
quando uma característica de subclasse declara um recurso consumível (um
número de usos, uma recarga), o app modela isso do jeito que o livro exige —
e devolve o recurso no Descanso certo?

### O que foi varrido, sem amostragem — para "3 causas" significar algo

O catálogo (`catalogo/subclasses.mjs`) precisou classificar as **241**
características (não uma amostra) em duas listas exaustivas, com bijeção
exigida por teste: `RECURSOS_SUBCLASSE` (**72** — a característica declara um
limite/recarga PRÓPRIOS, mesmo quando a via de recarga alternativa é um
recurso da classe base) e `SEM_RECURSO_SUBCLASSE` (**169** — inclui as **10**
entradas de uma tabela-armadilha à parte: menções a Descanso Curto/Longo que
são reset de escolha, janela/duração ou gatilho, não recarga genuína, e que
por isso NÃO viram `RECURSOS_SUBCLASSE` por engano). Das 72, só **27** têm
`base` citável (frase de limite/custo do livro) e não são `composta`
(o livro empacota mais de uma cláusula com força de evidência diferente sob o
mesmo nome) — só essas 27 sustentam `assert.equal`; as outras **45** rodam a
mesma comparação e registram o resultado via `t.skip`, nunca em silêncio.

Sete grupos em `unidade/subclasses-recursos.test.mjs` (**550** testes, **365**
rodam `assert.equal`, **185** skip):

1. **Higiene** — bijeção 1:1 entre as duas listas e as 241 características;
   citação `Classes.md:<linha>` real em cada uma das 241 entradas; `base`/
   `recarga` dentro do enum documentado no cabeçalho do catálogo.
2. **`detectarUsosMaximos`** (`site/js/sheet/habilidades.js:2390`) × livro,
   nas 72.
3. **`detectarRecarga`** (`site/js/utils.js:509`) × livro, nas mesmas 72.
4. **`ehHabilidadeAtiva`** (`site/js/utils.js:526`) × livro (campos novos
   `ativa`/`ativaBase`, curados nas 27 antes citáveis: 21 `custo-declarado`,
   5 `julgamento`, 1 `ausencia-de-custo` — Sentinela Imortal, ver abaixo).
5. **Restauração no Descanso certo**, generalizada às 72 — observação
   textual escopada por guarda de subclasse em `sheet/hp-descanso.js`, somada
   ao caminho GENÉRICO `restaurarHabilidades` (`hp-descanso.js:333-390`, que
   varre toda característica de subclasse do personagem, roda
   `detectarRecarga` de verdade e zera o campo genérico
   `char.usos_habilidades[key]` sem precisar de campo dedicado).
6. **(Grupos 6-7) Os três ramos numéricos herdados** de `classes-passivas.test.mjs`
   que dependem de subclasse — `calcCA` (Bardo/Colégio da Dança,
   Feiticeiro/Feitiçaria Dracônica) e `calcBonusPericia` (Clérigo/Ordem
   Divina Taumaturgo) — varridos por **~86.400 combinações** exaustivas
   (Destreza × Carisma × nível para CA; Sabedoria × nível × proficiência para
   perícia — não amostragem), incluindo negativas (outra subclasse, armadura
   equipada, Escudo nos dois sentidos, outra ordem, outra perícia, outra
   classe). As três fórmulas batem com o livro sem divergência — inclusive a
   diferença real de tratamento de Escudo entre as duas subclasses de CA
   (`Classes.md:724-732` exclui Escudo, `:3072-3076` não menciona Escudo),
   que o app reproduz corretamente.

Mais o **spec de navegador**, `../e2e/regras/subclasse-recursos-ficha.spec.mjs`
(2 testes) — ver subseção própria, abaixo.

### As causas e a consequência de cada uma, como o jogador a encontra

Dez asserções vermelhas na primeira rodada dos Grupos 2-5 fecharam em **3
causas novas registradas** mais **2 call sites** numa causa já aberta de
Classes/Passivas — não 10 alegações soltas:

**Causa reusada — `classes-passivas-descanso-curto-janela` (2 call sites
novos, 0 entradas novas).** O mesmo mecanismo já documentado para Memorizar
Magia/Fúria Implacável (busca cega por substring de `detectarRecarga`,
incapaz de isolar uma cláusula alheia dentro do mesmo texto) também atinge
subclasse: **Mapa Estelar** (Círculo das Estrelas, Druida, nível 3) tem um
segundo parágrafo sobre recriar o mapa perdido, "Descanso Curto ou Longo",
que se funde com a recarga real de Raio Guia ("Descanso Longo"); o jogador vê
o selo "☀🌙 Curto/Longo" no card "Subclasse — Círculo das Estrelas" em vez de
"🌙 Desc. Longo". **Sentinela Imortal** (Juramento dos Anciões, Paladino,
nível 15) tem "três vezes o seu nível de Paladino" (o multiplicador da cura,
não uma contagem de usos) lido como `usosMax=3` — mas aqui a consequência
medida é **nenhuma**: Sentinela Imortal tem ramo dedicado
(`habilidades.js:4379-4394`) que nunca lê `usosMax`, então o valor errado não
chega à tela (correção a uma alegação herdada de relatórios anteriores desta
mesma rodada, que tinham citado um contador "3/3" sem confirmar por leitura
de código).

**Causa nova 1 — `subclasses-recursos-usos-sem-consequencia`
(`limitacao-observabilidade`, 6 características de 5 subclasses: Campeão dos
Deuses, Vingança Calcinante, Marés do Caos, Surto Controlado, Ladrão de
Magias, O Terceiro Olho).** `detectarUsosMaximos` só reconhece contagem FIXA
em texto ("X vezes"); o livro expressa o limite via "não pode usar novamente
até Descanso X" (implícito, 1 uso) ou "reserva de quatro d12s" (adjetivo
numeral) — a função devolve `null` contra um número real do catálogo. Medido
característica a característica (grep pelo CAMPO/flag em
`site/js/sheet/habilidades.js` inteiro, nunca só pelo nome): 5 têm ramo
dedicado que usa campo próprio (booleano ou calculado do nível), nunca
`usosMax`; a 6ª (Ladrão de Magias) cai no caminho genérico, mas
`temMultiplosUsos` só liga quando `usosMax>1` — e o valor real é 1, então
mesmo com a heurística corrigida a tela seria idêntica. Nas 6, o jogador não
vê nada de errado: é uma expectativa legítima do livro sem consequência
observável, por isso `limitacao-observabilidade`, não bug do app.

**Causa nova 2 — `subclasses-recursos-ativa-curto-circuito-automatico`
(`app-diverge-do-livro`, Sentinela Imortal).** "Ao ser reduzido a 0 Pontos de
Vida e não morto imediatamente..." não tem nenhum verbo de decisão do
jogador — é uma salvaguarda automática. `detectarRecarga` acerta `'longo'`
de verdade (não é a mesma má-detecção da causa reusada acima); o defeito é o
curto-circuito `if (recarga) return true` (`utils.js:535`) tratando QUALQUER
recarga confirmada como prova de ativação — a mesma linha que já explica 6
características de classe base na causa `classes-passivas-recarga-troca-
escolha` (registrado nos dois lugares, com aviso cruzado, para quem for
consertar `utils.js:535` reconferir as duas entradas). O jogador vê Sentinela
Imortal na seção "Habilidades Ativas" do card "Subclasse — Juramento dos
Anciões"; o livro a colocaria em "Habilidades Passivas".

**Causa nova 3 — `subclasses-recursos-paladino-guarda-juramento`
(`app-diverge-do-livro`, Defesa Gloriosa) — o achado mais forte da rodada.**
`site/js/sheet/hp-descanso.js` guarda quatro blocos de restauração de
Descanso Longo do Paladino comparando `char.subclasse` contra **"Juramento
de X"** (`:582`, `:974`, `:979`, `:988`) — mas o nome real, gravado a partir
de `dados/classes/paladino.json`, usa **"Juramento da X"**/"Juramento **dos**
Anciões". A comparação nunca é verdadeira; os quatro `if` são código morto.
Consequência como o jogador encontra: um Paladino Juramento da Glória de
nível 15+ usa Defesa Gloriosa (mod. Carisma vezes por dia) até esgotar,
descansa longamente, reabre a ficha — o contador continua "0/X" no card
"Subclasse — Juramento da Glória", o botão "Usar Defesa Gloriosa" permanece
desabilitado. O mesmo typo atinge mais três características (`composta`, sem
chave própria, mas divergência registrada no `t.skip`): Resplendor Sagrado
(Devoção nv20), Lenda Viva (Glória nv20), Anjo Vingador (Vingança nv20) — ou
seja, **3 das 4 trilhas de Juramento do Paladino nunca restauram seus
recursos de subclasse em Descanso nenhum**. O contraste que prova que é a
grafia, não o mecanismo: "Juramento **dos** Anciões" (`:983`) está escrito
certo e funciona — Sentinela Imortal e Campeão Ancestral restauram
normalmente. O spec de navegador (abaixo) reproduz isso ao vivo.

### Os limites declarados, em voz alta

- **Só 27 das 72 entradas de `RECURSOS_SUBCLASSE` sustentam alegação
  sozinhas.** As outras 45 são `composta` (o livro empacota mais de uma
  natureza sob o mesmo nome) — a heurística roda de verdade e o resultado é
  registrado, nunca escondido, mas uma divergência ali não vira lacuna:
  poderia ser sobre a metade do texto que o app não está modelando, não
  sobre a regra inteira.
- **O motor confronta heurísticas sobre PROSA, não o comportamento de um
  personagem de verdade.** Os Grupos 2-4 chamam `detectarUsosMaximos`/
  `detectarRecarga`/`ehHabilidadeAtiva` direto com o texto do catálogo — nunca
  sobem um personagem, nunca gastam um recurso, nunca leem o HTML renderizado
  de uma ficha real. Onde isso importa (Grupo 2), a consequência precisou ser
  medida à parte, por leitura de código (`renderFeatureItem`/
  `temMultiplosUsos`), não pelo próprio motor.
- **11 das 27 entradas citáveis são renderizadas por ramos DEDICADOS por
  subclasse que nunca consultam a heurística** (`habilidades.js`, marcados
  com o campo `ramoDedicado` no catálogo e na mensagem de asserção): Passos
  Feéricos, A Sorte do Próprio Tenebroso, Mapa Estelar, Andarilho Nebuloso,
  Sacerdote da Guerra, Labareda Protetora, Coroa de Luz, Restaurar
  Equilíbrio, Defesa Gloriosa, Integridade Corporal, Torrente de Cura e
  Dolo — cada uma lê `Math.max(1, calcMod(<atributo>))` de um módulo
  `sheet/classes/<classe>.js` (o piso "(mínimo de uma vez)" do livro já
  embutido na fórmula), nunca `detectarUsosMaximos(descricao)`. Um vermelho
  do Grupo 2 numa dessas 11 não seria "o app calcula os usos errado" — seria
  "a heurística erra, e o app nem usa o valor dela ali".
- **A observação da restauração (Grupo 5) é TEXTUAL sobre `hp-descanso.js`,
  não comportamental.** A lógica de restauração vive inteira dentro de
  closures de `document.getElementById(...)?.addEventListener(...)`, nunca
  exportadas; o stub de `document` do harness (`unidade/harness.mjs`) devolve
  `null` sempre, então nenhum listener chega a ser registrado — não existe
  função para chamar diretamente. O método real foi fatiar `hp-descanso.js`
  por bloco de Descanso e por guarda de subclasse EXATA (o nome sempre lido
  do catálogo, nunca do app), e procurar o campo dentro do trecho certo — o
  que permitiu flagrar um campo presente no bloco certo mas sob uma guarda
  que nunca dispara (o achado do Paladino, acima). Uma primeira versão deste
  grupo tinha um ponto cego real: ignorava o caminho GENÉRICO
  `restaurarHabilidades`, e por isso acusou Ladrão de Magias de "nunca
  modelado" quando o app o restaura por esse caminho — corrigido somando
  `coberturaGenerica()` (roda `detectarRecarga` de verdade) ao método, usada
  só quando não há campo dedicado nem ramo dedicado.

### Por que os 256 skips não são cobertura

`t.skip` aqui nunca significa "não rodou" — significa "rodou a comparação de
verdade e o resultado foi registrado, mas não pode sustentar `assert.equal`
sozinho" (ver seção "Total" acima para a composição exata dos 256). Os 185
que este Plano acrescenta vêm de quatro dos sete grupos rodando a mesma
comparação sobre as 45 entradas `composta`/`julgamento` do catálogo — a
prova de que não é ausência de teste está na própria saída: **34** dessas
comparações registraram DIVERGÊNCIA (não coincidência) na mensagem do skip,
incluindo os mesmos typos de guarda de Paladino (Resplendor Sagrado, Lenda
Viva, Anjo Vingador) e o mesmo padrão de "(mínimo de uma vez)" lido como
contagem — visíveis a quem ler a suíte, mas fora do alcance de qualquer
`grep "not ok"`. Um skip com resultado "divergem" é um convite a investigar
com o mesmo peso de um vermelho, só que sem sustentar sozinho uma alegação
pública contra o app.

### O spec de navegador: `subclasse-recursos-ficha.spec.mjs`

Dois testes, mesmo roteiro (semear → abrir ficha → conferir contador cheio →
gastar via clique real → conferir persistência no personagem salvo →
Descanso Longo → conferir o contador de novo):

1. **Defesa Gloriosa (Juramento da Glória, nível 15)** — marcado
   `test.fail`, citando a lacuna `subclasses-recursos-paladino-guarda-
   juramento`. Carisma 13 (mod. +1) dá exatamente 1 uso; o contador vai de
   "1/1" a "0/1" ao gastar, e continua "0/1" depois do Descanso Longo —
   confirmando ao vivo, num navegador de verdade, o que a leitura de código
   já tinha estabelecido.
2. **Sentinela Imortal (Juramento dos Anciões, nível 15)** — controle, SEM
   `test.fail`, precisa passar sempre. `hp-descanso.js:983` usa a
   preposição certa e funciona; prova que a falha do teste 1 é a grafia da
   guarda, não o roteiro do spec.

Estabilidade medida com `--repeat-each=4 --workers=4`, duas rodadas: **8/8**
em cada uma, sem flake. Uma surpresa no caminho: a primeira versão do spec
usava `window.fecharModal()` para fechar o modal de troca de maestrias que o
Descanso Longo do Paladino sempre abre — isso deixa o **dado salvo** certo
mas o **DOM** preso no valor anterior, porque só os botões reais desse modal
chamam `renderFichaCompleta()`. Corrigido clicando em "Manter Tudo"
(`#btn-pular-troca-dl`), o botão que um jogador de verdade usaria. Achado de
produto colateral, fora do escopo desta task e não corrigido: fechar aquele
modal pelo X ou por fora deixa a ficha desatualizada na tela até a próxima
renderização — registrado aqui, sem lacuna própria, por não ter sido pedido.

### O fechamento do domínio

Com este Plano, **Subclasses fecha**: características por nível (Plano 1),
magias concedidas (Plano 2), escolhas exigidas na subida de nível (Plano 3) e
recursos na ficha — usos, recarga, restauração (Plano 4, este). Continua
fora, e não é dívida deste domínio:

- **Multiclasse** — o app não implementa; não há o que confrontar.
- **As listas de magia por classe** (quais magias cada classe pode
  aprender/preparar, fora do que a subclasse concede) — pertence a um futuro
  domínio Magias, não a Subclasses.

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
5. ~~Classes/níveis~~ — feito (achados acima; as características de
   subclasse por nível ficaram deliberadamente fora, ver "escopo declarado
   fora" acima)
6. ~~Subclasses~~ — **domínio fechado** (2026-08-18), os quatro planos:
   características por nível (Plano 1, zero divergências), magias concedidas
   (Plano 2, 3 causas), escolhas exigidas na subida de nível (Plano 3, 4
   causas) e recursos na ficha — usos, recarga, restauração (Plano 4, 3
   causas, achado mais forte a guarda de Juramento do Paladino em
   `hp-descanso.js`). Fora, e fora **de propósito**: multiclasse (o app não
   implementa) e as listas de magia por classe (domínio Magias, abaixo).
7. **Magias** — preparo, limites por círculo, e as listas de magia por classe
   que o domínio Subclasses deixou de fora de propósito

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
