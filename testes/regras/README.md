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

Vinte motores de `node:test` em `unidade/`, mais vinte specs Playwright
em `../e2e/regras/`. Cada um confronta uma fatia diferente do livro, e nenhum
sozinho prova a regra inteira. A tabela abaixo descreve os motores dos
domínios já fechados; os mais recentes (equipamento, seletor de itens,
opções de domínio, Telecinético, subclasses conjuradoras, maestria, magias
fixas do Mago, imports não resolvidos, cobertura de gatilhos de tela) entraram
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
| `subclasse-conjuradora.test.mjs` | As duas subclasses **1/3 conjuradoras** (Cavaleiro Místico, Trapaceiro Arcano), cuja Conjuração começa no MESMO nível 3 em que a subclasse é escolhida: o contexto de subida de nível calculado com a subclasse escolhida *nesta sessão* (step de magias visível, 2 truques a escolher porque Mãos Mágicas é fixa, 3 magias, lista de Mago carregada), os espaços de magia gravados nível a nível pela escada real (`escadaDeNivel`) contra a tabela do livro, a concessão de Mãos Mágicas com origem `subclasse_fixa` (conta no limite, não pode ser trocada), a recuperação de fichas legadas (vagas em aberto de truque/magia) e o limite compartilhado `getLimitesMagias` -- que o modal "Consultar Magias" lia como 0/0 | 11 |
| `maestria-armas.test.mjs` | Quais armas podem receber **Maestria em Arma**, por classe (Bárbaro só Corpo a Corpo; Guerreiro qualquer Simples/Marcial; Guardião/Paladino/Ladino as de proficiência), rodando contra `dados/equipamento/armas.json` real -- inclusive uma guarda de FORMATO (`propriedades` é string, não lista), que é o que a tela de maestrias violava | 6 |
| `imports-nao-resolvidos.test.mjs` | Varredura de `site/js/`: nome exportado por **outro módulo do projeto** que é chamado sem estar importado (`ReferenceError` na hora em que a função rodar -- `checar_esm.mjs` não pega, porque só confere o parse). Globais publicados de propósito (`window.navegar`, `window.fecharModal`) são descobertos por varredura, não por lista fixa | 1 |
| `gatilhos-ui-cobertos.test.mjs` | Cliquete de cobertura de tela: todo `id="btn-..."`/`data-<x>-acao="..."` declarado em `site/js/` precisa aparecer em algum spec de `testes/e2e/` -- isto é, precisa existir um teste que CLIQUE nele. A dívida histórica (133 gatilhos) está congelada em `../gatilhos-sem-cobertura.mjs` e a lista só encolhe: gatilho novo sem teste falha, e entrada que já ganhou teste (ou sumiu do código) também falha, pedindo a remoção. Nasceu de uma melhoria entregue com teste que só afirmava "o botão aparece" -- ver GUIA-PROXIMOS-DOMINIOS.md | 3 |

Total: **1364 testes** em `unidade/` (medido em 2026-08-16) — **1300 passam,
64 skip, 0 falham**. Os
skips não somem dentro do total: são talentos cujo `aplicarEfeitoTalento` não
faz nenhum campo de lista crescer (fora do escopo deste motor específico, não
do livro), e cada um carrega o motivo por escrito — um skip silencioso, aqui,
seria a mesma omissão que uma lacuna sem `motivo` já é proibida de ser. Nenhum
skip novo veio do motor de antecedentes, do de regras transversais da ficha
nem do domínio Classes/Níveis.

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
6. **Subclasses** — as características por nível das 48 subclasses, cujos
   nomes o catálogo de Classes/Níveis já traz (bijeção conferida contra
   `dados/`); herda também os ramos de classe que dependem de subclasse
   (`calcCA`, `calcBonusPericia`, `calcPercepcaoPassiva`, anotados acima)
7. **Magias** — preparo, limites por círculo

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
