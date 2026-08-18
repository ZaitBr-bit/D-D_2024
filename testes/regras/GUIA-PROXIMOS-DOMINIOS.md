# Guia para os próximos domínios

Talentos foi o piloto. Antecedentes e as regras transversais da ficha também já
foram cobertos; faltam espécies, classes/níveis e magias — muito mais
superfície do que já foi coberta.

Este documento não explica a arquitetura (isso é o [README](README.md)). Ele
registra **os erros que a primeira rodada cometeu e como não repeti-los**. Cada
item abaixo aconteceu de verdade neste projeto, e quase todos passaram por uma
revisão antes de serem pegos — ou seja, nenhum deles é óbvio no momento em que
se comete.

Leia antes de começar um domínio novo. Vale mais como checklist de pré-voo do
que como leitura corrida.

---

## A regra que governa todas as outras

**Uma lacuna falsa é pior que uma lacuna faltando.**

A lista de `lacunas-conhecidas.mjs` é o produto real deste trabalho: cada
entrada é uma alegação pública de que o app está errado. Alguém vai abrir um
chamado, mexer no código e gastar tempo com base nela. Uma entrada falsa
desperdiça esse tempo e, pior, ensina o time a não confiar na lista — e uma
lista em que ninguém confia não vale o custo de mantê-la.

Na primeira rodada o motor de escolhas registrou **42 lacunas, das quais 31
eram falsas**. Não foram pegas por um teste; foram pegas porque o implementador
desconfiou do próprio resultado e disse isso em voz alta. Se ele tivesse
entregado calado, o projeto teria produzido um backlog majoritariamente
fictício com aparência de rigor.

Quando estiver em dúvida entre registrar e investigar mais: investigue.

---

## A regra que governa toda melhoria nova

**Melhoria entregue sem um teste que a ACIONE não está entregue.**

Em 2026-08-16 três características do Mago e uma tela de maestrias foram
corrigidas, com testes. Um deles afirmava que o botão *aparecia* — e parava
aí. Dentro da função que o botão chamava havia um `ReferenceError`
(`getMagiaPreparadas` usado sem import, sobra de uma refatoração no mesmo
dia). Nada pegou:

- `checar_esm.mjs` só confere que o arquivo **faz parse** como módulo, e
  identificador livre é erro de execução, não de sintaxe;
- os motores de unidade **importam** os módulos, mas importar não executa a
  função onde o nome aparece;
- o spec de navegador do fluxo **não clicava** no botão.

Quem encontrou foi o usuário, no console, na primeira vez que usou.

Duas defesas nasceram daí, e as duas são baratas de manter:

1. `unidade/imports-nao-resolvidos.test.mjs` — varre `site/js/` procurando
   nome exportado por outro módulo do projeto que é **chamado sem import**.
   Fecha a classe inteira desse erro, e não só o caso do dia.
2. `unidade/gatilhos-ui-cobertos.test.mjs` + `gatilhos-sem-cobertura.mjs` —
   todo `id="btn-..."` e `data-<x>-acao="..."` novo precisa aparecer em
   algum spec de `testes/e2e/`. A dívida antiga (133 gatilhos) está
   congelada; a lista **só encolhe**.

Na prática, ao acrescentar um botão: escreva o spec que clica nele e afirma
o que acontece **depois** do clique. "O botão aparece" não é asserção de
comportamento — é asserção de HTML.

---

## Os sete erros da primeira rodada

### 1. Medir arquitetura em vez de comportamento

**O que aconteceu.** O motor de escolhas afirmava "todo talento com escolhas
precisa ter entrada em `REGRAS_TALENTOS`". Mas o app tem **três** mecanismos
legítimos: aquele mapa, um mecanismo genérico dirigido por dados
(`obterAtributosASITalento` lê o texto do benefício em `dados/`) e ramos
codificados à mão no render. Dos 59 talentos com escolhas, 45 escolhem só
atributo e 44 desses são atendidos corretamente pelo mecanismo genérico.
Exigir o mapa gerou 31 alegações falsas.

**Por que é traiçoeiro.** "Está no mapa X?" é uma pergunta objetiva, fácil de
escrever e que parece rigor. "O app honra a regra do livro?" é a pergunta que
importa, e quase sempre tem mais de uma resposta certa do lado da
implementação.

**Como evitar.** Antes de escrever a asserção, **enumere todos os mecanismos
pelos quais o app poderia estar cumprindo a regra**. Faça um `grep` pelo nome
da entidade em `site/js/` inteiro, não só no módulo que você já conhece. Se
achar mais de um caminho, a asserção precisa aceitar qualquer um deles — ou
precisa ser feita numa camada que enxergue o resultado, não o mecanismo.

### 2. Não enumerar todos os caminhos do usuário

**O que aconteceu.** O bug que abriu o projeto — Habilidoso sem opções de
escolha — foi declarado "não reproduz" depois de testar três caminhos de
aquisição. Existia um quarto (o botão "+ Talento" da ficha), e o bug estava
exatamente lá. Só apareceu na revisão final da branch, quando o projeto já se
considerava terminado.

**Por que é traiçoeiro.** Três caminhos verificados dão uma sensação forte de
completude, e o quarto não se anuncia. Pior: os três primeiros funcionavam
porque cada um tem verificação escrita à mão — e é justamente essa duplicação
manual que garante que uma quarta porta fique sem nenhuma.

**Como evitar.** No começo do domínio, faça a lista explícita de **todas as
telas por onde o usuário toca aquela entidade** e escreva no relatório. Para
achar: `grep` pelas funções de persistência (`salvar`, `persistir`,
`aplicar...`) e veja quem as chama. Se a regra é validada por código escrito à
mão em vez de um mecanismo declarativo, assuma que há um caminho sem ela até
provar o contrário — a duplicação manual é o sintoma.

### 3. Testes verdes que não afirmam nada

**O que aconteceu.** Quatro vezes, em revisões diferentes:

- `expect(count).toBeGreaterThanOrEqual(0)` — sempre verdade, seguido de um
  `return` que pulava o resto do teste;
- um `return` de escape quando o talento não aparecia na lista, condicionado
  apenas a "existe um pré-requisito" — condição satisfeita por 55 dos 59
  candidatos, então três talentos passavam sem testar nada;
- em ~44 dos 59 testes de subida de nível, o seletor não pegava o controle de
  atributo, então a lista de escolhas ficava vazia e a única afirmação
  sobrevivente era "concluiu sem erro no console";
- persistência conferida por `substring` no JSON inteiro do personagem — vácuo
  sempre que o valor escolhido já existia na fixture.

**Por que é traiçoeiro.** Todos passam. Um teste que não consegue falhar é
pior que teste nenhum, porque é confiável na aparência e ninguém volta nele.

**Como evitar.** Duas práticas, ambas baratas:

1. **Teste de mutação.** Antes de dar um motor por pronto, estrague de
   propósito um valor esperado no catálogo e confirme que o teste
   correspondente fica vermelho. Depois restaure. Foi assim que o motor de
   passivos foi validado (`bonusAtaqueDistancia: 2` → `99` → vermelho → 264/264
   de volta).
2. **Caça a `return` e a comparação frouxa.** Todo `return` antecipado num
   teste é suspeito: pergunte "que defeito do app faria o teste chegar aqui?".
   Toda comparação com `>=`, `toContain` em blob serializado ou `.catch(() =>
   {})` merece a mesma pergunta.

### 4. Confiar no rascunho em vez do livro e do app rodando

**O que aconteceu.** O plano escrito antes da execução continha quatro erros
factuais, todos pegos só porque alguém foi conferir: um `repetivel: true` que o
livro não diz; um `exemplo_valido` que o próprio validador do app **rejeita**
(usava uma perícia que a fixture já tinha); a afirmação de que bastava um stub
de `localStorage` para importar os módulos em Node (falta `window` e
`document`, porque `utils.js:639` atribui a `window` no carregamento); e um
comando `node --test <diretório>` que falha neste Node/Windows.

**Como evitar.** Trate qualquer valor herdado de um plano, de um exemplo ou de
outro talento como **hipótese**. Duas verificações que custam segundos:

- valor que veio do livro → abra a seção e leia. Cite arquivo e linha.
- valor que o app precisa aceitar → **execute o validador do app com ele** e
  cole a saída. Não leia a função e conclua; rode.

Padrão pronto para executar um módulo do app em Node:

```js
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {} };
globalThis.window = globalThis;
globalThis.document = { getElementById: () => null, querySelectorAll: () => [],
  createElement: () => ({ style: {}, classList: { add() {}, remove() {} }, appendChild() {} }),
  body: { appendChild() {} } };
const r = await import('./site/js/regras-cobertura.js');
console.log(r.validarEscolhasTalento(char, '<entidade>', <exemplo>));
```

O harness em [`unidade/harness.mjs`](unidade/harness.mjs) já faz isso — use
`modulosApp()` em vez de recriar os stubs, e acrescente lá se o domínio novo
precisar de outra global.

### 5. Fixtures irreais que escondem o objeto do teste

**O que aconteceu.** Duas vezes, e as duas escondiam cobertura inteira:

- a ficha de teste era um Guerreiro, e talentos que exigem Característica de
  Conjuração **nem aparecem na lista** para ele. O bug dos rótulos do Adepto
  Elemental só apareceu quando o teste passou a usar um Paladino;
- os atributos da fixture eram 10, e talentos que exigem 13 sumiam da lista.
  Ator e Líder Inspirador passavam verdes sem serem testados.

**Como evitar.** A fixture precisa **satisfazer os pré-requisitos do livro** da
entidade sob teste, e quando não satisfizer, o teste tem de **provar que não
satisfaz** — não bastando constatar que existe um pré-requisito qualquer. Se
uma entidade não aparece na tela, essa ausência é um resultado a explicar com
evidência, nunca um atalho para sair do teste.

### 6. Muitas falhas ao mesmo tempo tratadas como muitos bugs

**O que aconteceu.** A primeira execução do spec de subida de nível deu **48 de
59 falhando**. Não eram 48 bugs: era o driver que não chegava à tela. O
implementador reconheceu o padrão e consertou o driver, sobrando 4 achados
reais.

**Como evitar.** Regra prática: **se mais de uns poucos casos falham juntos,
suspeite primeiro do seu código de teste.** Conserte o driver até as falhas
ficarem esparsas e específicas; só então classifique uma a uma. Nunca registre
lacunas de uma leva grande de falhas simultâneas.

### 7. Endurecimento que não se propaga

**O que aconteceu.** Um spec ganhou um helper de navegação robusto
(`waitForSelector` com timeout, clique com retry) depois de flakes sob 4
workers. O spec irmão ficou com a versão antiga de `waitForTimeout(700)`. Três
rodadas limpas deram a impressão de estabilidade; a revisão final reproduziu
**2 falhas em 18 execuções** com `--repeat-each=4 --workers=4`.

**Como evitar.** Helper de navegação vive em
[`helpers-regras.mjs`](../e2e/regras/helpers-regras.mjs), importado por todos
os specs — nunca copiado. E para julgar estabilidade, use
`--repeat-each=4 --workers=4` algumas vezes; rodadas sequenciais limpas não são
evidência.

---

## A lição da rodada de correção (2026-08-06)

O erro 2 acima ("não enumerar todos os caminhos do usuário") já registrava que
duplicação manual é sintoma de caminho esquecido. A rodada que corrigiu as 11
lacunas confirmou isso na prática e acrescentou a parte que faltava: **o
mesmo sinal também aponta o conserto**.

**O que aconteceu.** Nove das onze divergências (Habilidoso, Artifista,
Músico, Analítico, Mente Aguçada, Adepto Elemental, Mestre das Armas) tinham
uma única causa raiz: os sete talentos não tinham entrada em
`REGRAS_TALENTOS` (`site/js/regras-cobertura.js`) — o mapa declarativo que
decide simultaneamente se a escolha é oferecida, se é validada e se é
persistida. Sem ele, cada fluxo tinha compensado por conta própria com
checagem escrita à mão (level-up em `levelup-validations.js:114-119`,
criador em `passo-antecedente.js:153-168` e `passo-especie.js:396-408`) — e
foi exatamente por isso que a quarta via de aquisição, o botão "+ Talento" da
ficha, ficou sem nenhuma checagem: ninguém tinha escrito a cópia manual para
ela. Adicionar as sete entradas em `REGRAS_TALENTOS` (Tarefas A e B da
correção) não só validou a escolha onde faltava — também destravou o popup de
configuração no botão "+ Talento" da ficha **sem que uma única linha de
`sheet/talentos.js` precisasse mudar**, porque esse botão já consultava o
mapa declarativo, só que o mapa estava vazio para esses talentos. Um conserto
na camada certa reparou os dois fluxos de uma vez.

**Por que é útil saber.** Quando uma regra é imposta por checagem manual
copiada em cada fluxo em vez de por um mecanismo único e declarativo, isso não
é só sinal de que um caminho pode estar sem a checagem (erro 2) — é também
sinal de que **o conserto certo não é copiar a checagem mais uma vez para o
caminho que falta**. É mover a regra para o mecanismo declarativo que os
outros fluxos já deveriam estar consultando. Consertar no lugar errado (mais
uma cópia manual) resolve um sintoma e deixa a causa — e o próximo caminho
esquecido — para a próxima rodada achar.

**Como aplicar.** Ao encontrar uma regra validada por código escrito à mão em
mais de um lugar: antes de corrigir cada cópia, pergunte se existe (ou deveria
existir) um mecanismo declarativo único do qual todos os fluxos já dependem —
mesmo que hoje dependam dele incompletamente, como `sheet/talentos.js`
dependia de `REGRAS_TALENTOS` sem essa dependência nunca ter sido "ativada"
pelos sete talentos que faltavam no mapa. Corrigir ali tende a reparar todos
os fluxos de uma vez, incluindo os que ninguém tinha percebido que dependiam
do mesmo mecanismo.

---

## A lição do motor de escolha morta (2026-08-07)

**O que aconteceu.** Os quatro primeiros motores de `unidade/` foram todos
desenhados para a mesma pergunta: "o app faz o que o livro manda?" — um
exemplo válido é aceito, uma mutação inválida é rejeitada, um bônus bate com
o texto. É uma pergunta poderosa, mas tem uma borda que não aparece olhando
para dentro da suíte: ela só consegue confrontar uma regra que **o livro
escreveu**. Uma regra que nenhuma frase do livro afirma — "um talento não
deve oferecer, de novo, uma escolha que não concede nada ao personagem" —
nunca vira uma asserção, porque não existe frase para citar como padrão de
comparação. A suíte inteira podia ficar verde e essa classe inteira de bug
continuaria invisível, não por falta de cobertura de talentos, mas porque a
pergunta certa nunca tinha sido formulada. Prova disso: os dois bugs desse
formato que existiram neste app (commits `5606c52` e `a0e3793`) foram achados
**os dois** por um humano perguntando "isso devia estar oferecendo essa opção
de novo?" — nenhum deles foi pego pela suíte, porque nenhum dos quatro
motores tinha uma pergunta capaz de pegá-los. Só depois da segunda vez esse
padrão virou um quinto motor (`escolha-morta.test.mjs`), que não compara
contra o catálogo — aplica o efeito de verdade e confronta o app contra o
próprio estado que acabou de criar, exatamente para não depender de uma
frase citável.

**Por que é traiçoeiro.** "Confrontar com o livro" é o objetivo certo, mas
vira sem querer um teto: se a pergunta de desenho é sempre "que frase do
livro isso testa?", qualquer regra sem frase própria fica fora do exercício
de desenhar o motor, não só fora de um motor específico. E o sintoma não é
um teste vermelho — é a ausência de um teste, que não aparece em nenhum
relatório de cobertura.

**Como evitar.** Ao começar um domínio novo, depois de listar o que o livro
diz (checklist de pré-voo, acima), faça uma segunda pergunta que não sai do
livro: **o que um usuário consideraria obviamente quebrado, mesmo que o
livro nunca precise dizer isso em voz alta?** Ofertar uma escolha que não
muda nada é um exemplo; provavelmente há outros por domínio (uma
característica de classe reoferecida sem efeito, uma magia listada duas
vezes no grimório sem motivo, um espaço de magia que não desconta). Essa
pergunta não tem uma seção do livro para apontar como fonte — a fonte é o
bom senso de quem usaria o app, e é exatamente por isso que ela fica de fora
se ninguém a formular de propósito.

---

## A lição do domínio Antecedentes (2026-08-07)

**O que aconteceu.** Os motores de unidade de talentos são todos desenhados
em cima de funções puras do app — `obterAtributosASITalento`,
`validarEscolhasTalento`, `resolverPassivosTalentos` — e o hábito natural,
copiando essa estrutura, seria procurar o equivalente para antecedentes. Não
existe: `passo-antecedente.js` só exporta `renderStepAntecedente` e
`_reconstruirTalentosBase` (verificado no pré-voo do plano, e confirmado de
novo ao desenhar o motor); o resto do comportamento vive dentro de handlers
de evento, sem ponto de entrada isolável em Node. O motor de unidade
(`antecedentes.test.mjs`) confrontou outra coisa: `dados/origens/
antecedentes.json`, o arquivo que o app de fato lê em runtime. Se `dados/`
divergisse do livro, todo fluxo que o consome estaria errado na origem, sem
precisar de navegador para provar — um confronto de alto retorno que **não
existia** no desenho de talentos, porque lá o catálogo era confrontado contra
funções do app, não contra o arquivo de dados de origem. Foi esse motor que
sobrou com zero lacunas (115 asserções, todas batendo); as 21 lacunas reais
só apareceram na camada de navegador, que aqui carregou sozinha toda a
confrontação comportamental — "o assistente realmente aplica esses dados ao
personagem?" — que em talentos tinha sido dividida entre unidade e Playwright.

**Por que é útil saber.** "Copiar o padrão do domínio anterior" (a própria
recomendação da seção "Mapa de domínios futuros" deste README) é seguro para
a *estrutura de arquivos* — um catálogo, um motor de unidade, specs de
navegador — mas não para *o que o motor de unidade confronta*. Isso depende
de quais mecanismos o domínio realmente tem no app, e só se descobre lendo o
código daquele domínio especificamente. Se a Tarefa 2 deste projeto tivesse
tentado forçar o formato de talentos (procurar uma função para chamar,
comparar contra um exemplo válido do jeito que `validacao.test.mjs` faz),
teria produzido um motor fraco ou vazio — não porque antecedentes seja mais
simples, mas porque a pergunta de maior retorno neste domínio vive num lugar
diferente da árvore.

**Como aplicar.** Ao montar o desenho de um domínio novo (a seção "onde cada
confronto vive" do plano), não presuma que a divisão entre unidade e
navegador do domínio anterior vai se repetir. Pergunte, para *este* domínio
especificamente: existe função pura que produz o resultado final, ou o
resultado só existe depois de uma sequência de eventos de DOM? Se for a
segunda, o motor de unidade de maior retorno normalmente é outro: confrontar
o arquivo de `dados/` que o app consome contra o livro, deixando toda a
confrontação comportamental para o navegador — como aconteceu aqui.

(Um segundo candidato a lição foi cogitado e descartado: a hipótese de que 21
lacunas chegando juntas pareceriam, à primeira vista, o cheiro de "bug de
driver" que o erro 6 deste guia adverte. Não foi isso que aconteceu — o
relatório da Tarefa 3 registra que a primeira rodada completa do spec já
correu 39/39 verde, porque os 21 casos usam `test.fail()` desde a escrita,
citando a lacuna correspondente; nunca houve um momento de suíte vermelha em
massa para desconfiar. Registrar essa lição inventaria uma dificuldade que
este domínio não teve.)

---

## A lição da correção de Antecedentes (2026-08-07)

**O que aconteceu.** A correção das 21 lacunas de antecedentes (ver
`.superpowers/sdd/antecedentes/correcao-report.md`) tinha um jeito óbvio de
rotear a ferramenta/instrumento consolidada até a proficiência certa: checar
o valor escolhido contra as listas que o app já tem para isso —
`FERRAMENTAS_TODAS` e `INSTRUMENTOS_MUSICAIS` (`comum.js`), o mesmo padrão
que o bloco irmão de `escolhas_talento` já usa em `wizard.js`. Investigando
antes de copiar esse padrão, quem corrigiu achou que as duas listas estão
incompletas, cada uma por um motivo diferente: `FERRAMENTAS_TODAS`
(`comum.js:93-102`) não contém nenhuma das 4 opções de Kit de Jogos que
Guarda/Nobre/Soldado oferecem (Baralho, Conjunto de Dados, Xadrez de Dragão,
Jogo de Três Dragões); `INSTRUMENTOS_MUSICAIS` (`comum.js:104-107`) não
contém três das dez opções que a tela do Artista realmente oferece (Corne,
Flauta de Pã com til, Harpa). Rotear por associação de lista teria
descartado essas escolhas em silêncio — a mesma classe de bug que a
correção existia para fechar, só que uma camada acima: em vez de "a
ferramenta nunca é gravada", teria virado "a ferramenta é gravada, exceto
quando o jogador escolhe uma das opções que a lista esqueceu" — um bug mais
raro, mais difícil de notar, e indistinguível de sucesso em qualquer teste
que não cubra literalmente essas opções. A correção evitou isso roteando por
outra coisa: o **campo** declarado em `ANTECEDENTES_ESCOLHAS[nome].campo`,
que só tem três valores possíveis (`ferramenta_escolhida`,
`instrumento_escolhido`, `jogos_escolhido`), fixos no próprio catálogo de 5
entradas — um conjunto fechado, sem "valor que não bate com nada" para
descartar, porque não compara o VALOR escolhido contra lista nenhuma.

**Por que é útil saber.** Um bug de "valor descartado em silêncio" quase
sempre tem uma causa parecida: em algum ponto, uma checagem de pertencimento
(`.includes()`, `switch` com `default` mudo, mapa que devolve `undefined`)
decide se o valor é reconhecido, e a lista por trás dessa checagem foi
escrita numa época diferente das opções que o valor pode assumir hoje. Uma
correção que reaproveita essa mesma checagem herda o mesmo risco — só que
agora escondido atrás de "eu só copiei o padrão que já existia", o que faz o
risco parecer menor do que é. Aqui não foi hipotético: eram **duas**
armadilhas desse tipo, não uma — a segunda (`INSTRUMENTOS_MUSICAIS`) nem
tinha sido apontada pelo enunciado do bug, só apareceu porque quem corrigiu
foi checar as duas listas candidatas, não só a que o relato mencionava.

**Como aplicar.** Ao corrigir um bug do tipo "valor X nunca chega a Y":
antes de rotear pelo mecanismo mais próximo que já existe, pergunte se esse
mecanismo consegue representar **toda opção que a tela realmente oferece**
hoje — não só os casos que motivaram a correção. Se o roteamento depende de
comparar o valor contra uma lista de opções válidas, enumere as opções reais
(a tela, não a documentação) e confira uma a uma — nas duas listas
candidatas, não só na mais óbvia. Se existir um campo mais estreito e
fechado — um identificador que descreve *para onde o valor vai*, em vez do
próprio valor — prefira rotear por ele: um conjunto fechado de rótulos
conhecidos não tem como "esquecer" um valor futuro, porque o valor nunca
entra na comparação.

---

## A lição do domínio Regras Transversais da Ficha: busca honesta antes de concluir ausência (2026-08-07)

**O que aconteceu.** O pré-voo do plano deste domínio tratou duas fórmulas
de dois jeitos diferentes, e vale notar a diferença porque só um dos dois
era um erro. Para a CD de salvaguarda de magia, o plano **declarou ausência**
("Fórmula ainda não localizada", linha 37) — uma conclusão, não uma tarefa.
Para a regra de ganho de PV nos níveis 2 em diante, o plano não concluiu
nada: deixou uma **instrução de busca condicional** ("encontre o trecho...
Se encontrar: [...]. Se **não** encontrar: [...]", linhas 250/252/254) — uma
pergunta em aberto, não uma alegação. **As duas fórmulas existiam no livro.**
A Tarefa 3 achou a regra de PV em `Criação de Personagens.md:497-510` (passo
2 de "Adquirindo Um Nível", mais a tabela "Pontos de Vida Fixos por Classe");
a Tarefa 4 achou a CD de magia em `Criação de Personagens.md:441` e `:443`,
repetida em `Magias.md:183` e `:189`. A causa não era ausência no livro —
era busca com os termos errados no arquivo errado: o pré-voo da CD tinha
procurado algo como "8 mais" no glossário (`Abreviações e Definição de
Regras.md`), quando o livro usa os rótulos "CD para evitar magia" e "Bônus
de ataque mágico", numa seção diferente. O relatório da Tarefa 4 documenta
quatro rodadas de busca com termos supostos a priori (`CD de Conjuração`,
`Classe de Dificuldade da Magia`, `Bônus de Ataque com Magia`...) antes de
achar os rótulos reais na quinta; as três primeiras não acharam nada
relacionado, e a quarta achou o glossário geral de CD
(`Abreviações e Definição de Regras.md:265-267`), que confirma a FORMA da
regra ("a CD é determinada pelo atributo de conjuração e pelo Bônus de
Proficiência") mas não trazia a fórmula numérica exata — texto relacionado,
não a resposta, e ainda assim insuficiente para fechar a busca sem achar o
"8 +" explícito.

**Por que é útil saber.** A CD de magia é o erro real: o plano concluiu
ausência sem ter procurado o suficiente, e só a instrução mais forte do
próprio brief da Tarefa 4 ("procure a implementação em todo `site/js/`... e
reporte honestamente dos dois jeitos") mandou o implementador continuar
procurando em vez de aceitar a conclusão do rascunho. A regra de PV mostra o
contrário funcionando: como o plano nunca declarou ausência ali, não havia
conclusão errada para desfazer — só uma pergunta que a Tarefa 3 foi resolver
de verdade, achando a fórmula na primeira busca dirigida. A mesma
incerteza ("não sei se isso está no livro") produziu dois resultados de
plano diferentes — uma alegação falsa num caso, uma tarefa bem formulada no
outro — e é essa diferença de formulação, não o tamanho da superfície
coberta, que decidiu se o implementador continuou procurando.

**Como aplicar.** Um plano não deve entregar ao implementador uma conclusão
negativa pronta ("a fórmula X não existe no livro") quando ainda não
esgotou a busca — deve entregar uma tarefa de busca ("procure X; se achar,
cite arquivo e linha; se não achar depois de tentar termos alternativos em
todos os arquivos de `Informacoes Separadas/`, registre a ausência com a
lista do que foi tentado"), do jeito que o próprio plano já fez para a regra
de PV. Ausência de evidência no seu grep não é evidência de ausência no
livro — pode ser só o vocabulário errado — e um achado parcial (texto
relacionado que confirma a forma da regra, mas não a fórmula exata) é sinal
para tentar mais um termo, não para concluir que só falta a numeração.

---

## A lição do domínio Regras Transversais da Ficha: valor esperado não pode vir da função sob teste (2026-08-07)

**O que aconteceu.** A revisão da Tarefa 4 pegou dois blocos deste motor
(CD/ataque de magia, e Percepção Passiva) que montavam o valor **esperado**
da asserção chamando `utils.bonusProficiencia(nivel)` — a mesma função que
`calcCDMagia`, `calcAtaqueMagia` e `calcPercepcaoPassiva` já chamam por
dentro para obter o Bônus de Proficiência. Um bug em como `nivel` chega até
essa chamada dentro do app (por exemplo, `nivel - 1`, ou um campo nunca
atualizado) produziria o mesmo valor errado nos dois lados da mesma
asserção, e as 9.600 + 1.800 comparações desses dois blocos não pegariam
isso — o teste comparava o app contra ele mesmo nesse termo específico,
apesar do volume. O conserto trocou a chamada por uma função local
(`bonusProficienciaLivro`, em `ficha-transversal.test.mjs`) que lê
`EVOLUCAO_PERSONAGEM` — o catálogo já derivado do livro na Tarefa 2, e já
confrontado contra `utils.bonusProficiencia` no primeiro teste do mesmo
arquivo — uma fonte independente da função sob teste, não uma reimplementação
nova.

**Por que é útil saber.** O erro 3 deste guia ("testes verdes que não
afirmam nada") já cobria comparação frouxa e `return` de escape; este é um
caso mais sutil da mesma família, porque a chamada suspeita não parece um
atalho — parece só "buscar um número auxiliar". A regra fica mais fácil de
aplicar dita à parte: um valor esperado nunca pode vir da função sob teste,
nem de um helper que ela chama por dentro, mesmo que a chamada pareça
inofensiva. O que tornou o conserto barato foi o catálogo já ter, no mesmo
domínio, uma tabela derivada do livro que servia como fonte independente —
não foi preciso curar uma nova fonte, só parar de ignorar a que já existia.

**Como aplicar.** Ao montar o valor esperado de uma asserção, pergunte se
algum ingrediente dele vem de chamar a própria função sob teste ou uma
função que ela chama internamente. Se vier, procure primeiro se o domínio já
tem uma fonte independente (uma tabela do catálogo, uma constante curada do
livro) antes de aceitar o atalho de reusar a função do app.

---

## Dois vícios de relatório

**Motivo que superafirma.** Um motivo de lacuna dizia que a verificação do app
"não impede duplicata por conteúdo (só `Set.size`)" — mas `Set.size` é
exatamente como se detecta duplicata em strings. A queixa verdadeira era outra
(a verificação só roda num fluxo). Um motivo que exagera o defeito é tão ruim
quanto uma lacuna falsa: quem for corrigir vai atrás da coisa errada.

Escreva o motivo dizendo **o que o app faz e o que não faz**, com arquivo e
linha dos dois lados. Se você achou código que implementa parte da regra, o
motivo tem de citá-lo.

**Campo sem consumidor.** O catálogo declarava `aumento_atributo` nas 75
entradas — inclusive duas exceções cuidadosamente curadas — e **nenhum motor
lia esse campo**. Eram 75 alegações sobre o livro que nada podia falsificar, e
que qualquer um poderia "corrigir" errado sem quebrar nada.

Antes de fechar um domínio: para cada campo do catálogo, aponte o teste que o
consome. Campo sem consumidor deve virar asserção ou ser apagado — e o teste de
schema em `completude.test.mjs` deve validar todo campo que existir.

---

## Checklist de pré-voo para um domínio novo

Antes de escrever a primeira asserção:

- [ ] Li a seção do livro inteira para esta entidade, não só a tabela resumida.
- [ ] Listei **todas as telas** por onde o usuário cria, edita ou remove esta
      entidade — e escrevi a lista no relatório.
- [ ] Fiz `grep` do nome da entidade em `site/js/` **inteiro** e listei todos os
      mecanismos que a tratam (mapa declarativo, dirigido por dados, ramo
      escrito à mão).
- [ ] Sei qual mecanismo cada asserção vai confrontar, e por quê.
- [ ] A fixture satisfaz os pré-requisitos do livro; onde não satisfaz, o teste
      prova a violação em vez de sair calado.

Antes de registrar qualquer lacuna:

- [ ] As falhas estão esparsas e específicas (se vieram em leva, consertei o
      driver primeiro).
- [ ] Para cada uma, procurei a implementação no app inteiro antes de concluir
      que não existe.
- [ ] O motivo cita arquivo e linha do que existe **e** do que falta.
- [ ] Classifiquei o `tipo`: divergência real do livro, ou limitação do que
      este motor consegue observar.

Antes de dar o domínio por pronto:

- [ ] Teste de mutação: estraguei um valor esperado e o teste ficou vermelho.
- [ ] Nenhum `return` antecipado deixa um caso passar sem afirmar nada.
- [ ] Todo campo do catálogo tem um teste que o consome e está no schema de
      completude.
- [ ] Estabilidade medida com `--repeat-each=4 --workers=4`, não com rodadas
      sequenciais.
- [ ] O teste de completude prova cobertura de 100% das entidades de `dados/`
      — sem amostragem, pelo mesmo motivo da suíte de paridade.
- [ ] A suíte de paridade continua coletando **329 testes em 10 arquivos**.

---

## A lição do domínio Classes/Níveis: rastrear a consequência no código antes de registrar a lacuna (2026-08-07)

**O que aconteceu.** As duas vezes em que este domínio quase produziu uma
alegação errada, o que salvou foi a mesma disciplina, aplicada em dois pontos
diferentes do projeto -- com desfechos opostos, mas pela mesma causa. Na
Task 5, a primeira redação do achado do Ladino (proficiência de armas
incompleta, `site/js/dados-classes.js:105`) concluiu "consequência real
hoje: nenhuma" -- baseada em não ter achado, de memória, uma função
`temProficienciaComArma` óbvia. Isso violava a própria exigência da tarefa
("a consequência funcional REAL -- medida no código, não suposta"): supor a
ausência de um consumidor em vez de procurar por ele. Um `grep` por `.armas`
em `site/js/` inteiro -- pelo CAMPO usado, não pelo nome de função
hipotético que não existia -- achou dois consumidores reais
(`temProficienciaArma` em `passo-equipamento.js`, `sheetTemProfArma` em
`condicoes.js`), e rastreá-los até `site/js/sheet/inventario.js:163-164`
revelou o achado forte da rodada: a Besta de Mão, com o bônus de ataque
exibido na ficha subestimado pelo bônus de proficiência inteiro para um
Ladino -- não um "falta Leve" genérico e sem efeito, que teria sido a
conclusão se a primeira redação tivesse ficado. Na Task 6, o motor de
gatilhos deu **13 falhas** na primeira rodada do laço de `GATILHOS`;
rastrear cada uma até o consumidor real do app, antes de classificar
qualquer uma como lacuna, mostrou que eram só **duas asserções mal
formuladas** (medindo arquitetura em vez de comportamento -- o erro nº 1
deste guia, o mesmo que gerou 31 lacunas falsas na rodada de Talentos). As
13 voltaram a zero corrigindo o teste, sem tocar `site/js/` -- nenhuma delas
virou entrada em `lacunas-conhecidas.mjs`.

**Por que é útil saber.** As duas situações pareciam, à primeira vista, ter
desfechos opostos -- uma virou lacuna real e específica (Ladino), a outra
não virou lacuna nenhuma (gatilhos) -- mas o passo que decidiu os dois foi o
mesmo: seguir o dado (ou a falha) até o código de produção que o consome ou
que a causa, antes de escrever qualquer alegação sobre o app. Pular esse
passo carrega o mesmo risco nos dois sentidos, não só no de registrar
lacuna demais: concluir "sem consequência" por não lembrar de um consumidor
de cabeça (quase o desfecho da Task 5) é o mesmo erro de raciocínio que
registrar 13 lacunas por não perceber que a falha era do teste, não do app
(o que quase aconteceu na Task 6) -- os dois pulam a mesma verificação, só
erram para lados opostos.

**Como aplicar.** Antes de escrever "consequência: nenhuma" ou
"consequência: X" no motivo de uma lacuna, faça `grep` pelo CAMPO ou pela
FUNÇÃO envolvida em `site/js/` **inteiro** -- não confie em lembrar os
consumidores de cabeça, e não pare no primeiro achado (a Task 5 achou dois,
não um). Antes de registrar qualquer falha como lacuna, pergunte se ela
sobreviveria a essa mesma busca: se rastrear até o código real muda a
conclusão -- de "bug do app" para "asserção mal formulada", ou de "sem
efeito" para "efeito medido e numérico" --, foi a busca que valeu a tarefa,
não a primeira leitura.

---

## A lição do incremento Ladino nv6: confrontar o mecanismo não cobre o mecanismo que falta (2026-08-07)

**O que aconteceu.** O domínio Classes/Níveis foi dado por pronto com o
motor de gatilhos (`classes.test.mjs`) em 427/427 -- e mesmo assim deixou
passar um bug real, achado depois por um humano usando o app: o Ladino
ganha Especialização em 2 perícias no nível 1 (`Classes.md:4183`) e em
mais 2 no nível 6 (`Classes.md:4188`, prosa em `:4216`), e o app só
implementa a metade do nível 1 (`site/js/creator/wizard.js:466-473`, no
fluxo de criação) -- o nível 6 não tem NENHUM mecanismo em lugar nenhum
de `site/js/`: `levelup.js` tem `exigeEspecializacaoBardo` e
`exigeEspecializacaoGuardiao`, e nada equivalente para Ladino. O motor de
gatilhos não pegou porque não tinha como: ele testa, PARA CADA FUNÇÃO,
"ela dispara só onde deveria?" -- e a regex de
`especializacaoGuardiao` (`/^Especialista$/`, sem saber de classe) CASA
com a célula do Ladino nível 6, só que o gatilho correspondente no laço
de `GATILHOS` tem `apenas: ['Guardião']`, então o ESPERADO para o Ladino
vira `false`. A função também devolve `false` (porque ela só olha para
`classe === 'Guardião'`). Os dois lados concordam, a asserção
`exigeEspecializacaoGuardiao('Ladino', 6) === false` é logicamente
CORRETA, e o teste passa verde sobre uma característica que nenhuma
função do app reconhece. A suíte inteira podia estar 427/427 e essa
lacuna continuava lá -- não porque uma asserção estivesse errada, mas
porque a pergunta "existe alguma função para este rótulo, em qualquer
classe?" nunca tinha sido feita: cada teste do laço só pergunta pela SUA
própria função, uma de cada vez, com escopo já restrito por `apenas`.

**Por que é útil saber.** Isto é uma variação mais sutil da lição do
"motor de escolha morta" (acima, 2026-08-07): lá, a pergunta que faltava
não tinha frase do livro para citar. Aqui a pergunta TEM frase do
livro -- a tabela imprime "Especialista" na célula certa -- mas não tem
NENHUM teste que a confronte, porque toda asserção do domínio parte de
uma função do app já escrita e pergunta se ela está certa. Uma função
que nunca foi escrita não aparece em nenhum laço "para cada função",
pelo motivo mais simples possível: não existe para o laço iterar sobre
ela. `apenas` não é o vilão -- ele é necessário para a asserção original
fazer sentido (sem ele, `exigeEspecializacaoGuardiao('Bardo', 9)`
precisaria ser `true`, o que é falso) -- mas ele tem o efeito colateral
de fazer "nenhuma função cobre esta classe" e "a função certa está
ausente" produzirem o MESMO resultado observável (`false === false`).
Medir "cada mecanismo existente dispara no lugar certo" (a forma de
todos os motores deste domínio até aqui) não é a mesma pergunta que
"todo lugar que precisa de um mecanismo tem um" -- e só a segunda pega
uma característica que o app esqueceu INTEIRA.

**Como aplicar.** Todo motor que testa "uma lista de mecanismos, cada um
restrito ao seu escopo declarado" (`apenas`, `só para X`, um `switch`
com `default` mudo, um mapa que devolve `undefined` fora dele) precisa
de um SEGUNDO teste que ignore essa restrição e pergunte, célula por
célula ou entidade por entidade: "o livro pede algo aqui, e o mecanismo
DO PRÓPRIO RÓTULO responde?". A revisão independente deste incremento
(2026-08-07) pegou dois jeitos de essa segunda pergunta sair errada
mesmo depois de escrita, e os dois valem registrar:

- **Errado perguntar por CÉLULA em vez de por RÓTULO.** A primeira versão
  perguntava "alguma das N funções dispara NESTE NÍVEL?", sem exigir que
  fosse a função do PRÓPRIO rótulo -- uma célula com dois rótulos de
  escolha deixava um mecanismo presente encobrir um ausente (prova: uma
  célula com "Estilo de Luta" + "Explorador Hábil" no mesmo nível
  continuava verde com "Explorador Hábil" fingindo não ter tratamento
  nenhum, porque a OUTRA função disparava no mesmo nível). A pergunta
  certa é por rótulo: para cada rótulo da célula, alguma função CUJO
  PRÓPRIO REGEX CASOU com ele dispara?
- **Barato não é de graça.** Reusar os rótulos curados (aqui,
  `ROTULOS_GATILHO`) e a lista de funções (aqui, `GATILHOS`) já
  existentes é o que torna este teste converso barato de escrever -- mas
  é exatamente esse reuso que fixa o ALCANCE do teste no que os
  mecanismos já escritos reconhecem, não no que o livro pede. Medido
  neste incremento: dos 138 rótulos distintos do catálogo de
  classes/níveis, só 19 casam com algum `ROTULOS_GATILHO` -- os outros
  119 (uma escolha de arma, um idioma à escolha, etc.) ficam fora do
  teste converso mesmo que exijam decisão do jogador e o app não tenha
  mecanismo nenhum para eles. O Ladino nv6 só foi pego porque a regex
  responsável (`/^Especialista$/`) por acaso não sabe de classe; um
  rótulo esquecido com regex própria continuaria invisível. Fechar essa
  cobertura exigiria uma lista de rótulos curada a partir do LIVRO (uma
  varredura de toda a coluna "Características", perguntando "isto exige
  escolha?" célula por célula), não derivada das funções que o app já
  tem -- é mais trabalho, e é preciso dizer isso em voz alta em vez de
  vender o teste barato como se cobrisse tudo.

O sinal de que o teste converso falta: se toda asserção do domínio é
escrita como `fn(x) === esperado(x)` para uma função já conhecida, nada
no arquivo pergunta "existe uma `fn` para isto?" quando a resposta é
não. O sinal de que o teste converso existe mas está incompleto: se ele
foi escrito perguntando "algo dispara neste nível?" em vez de "a função
deste rótulo dispara?", ou se a lista de rótulos que ele confere veio
das funções do app em vez de uma leitura do livro.

---

## A lição do domínio Classes/Trocas e Classes/Passivas (2026-08-07)

A implementação desta rodada não teve a dificuldade de rodadas anteriores —
nenhuma suíte vermelha em massa para desconfiar, nenhuma fixture irreal,
nenhum `return` de escape. Mas a REVISÃO da rodada seguinte (Task 6, o
registro de lacunas) achou 2 Critical, 6 Important e 10 Minor de precisão
(`task-6-report.md`) — motivo copiado da string que o APP usa para exibir
um efeito em vez de lido do livro, uma alegação de "sem consumidor" que
era na verdade código morto por um mecanismo diferente já cumprir a
regra, e um wrap largo demais pela TERCEIRA vez. As lições abaixo vêm
dessa camada: não da dificuldade de implementar, mas da disciplina de
citar e de escopar o wrap corretamente depois que o código já existe.

**(a) Varrer o livro por VÁRIOS termos relacionados e registrar o que CADA
UM trouxe — não presumir de antemão que um tipo de busca (estrutura,
cabeçalho) é melhor que outro (verbo).** A primeira varredura do catálogo de
trocas buscou literalmente `"pode substituir"` em `Classes.md` — 34
ocorrências, e pareceu completo. Uma segunda rodada testou mais termos
(`alterar`, `trocar`, `mudar`, `escolher outr`, `no lugar de`, `em vez de`) e
duas buscas dirigidas por cabeçalho (`**Mudando`/`**Trocando`/`**Substituindo`
em negrito, e `### Nível X: <Nome da Característica>`) — achou **8 cláusulas
de classe base que a primeira rodada tinha perdido inteiras**. Uma primeira
versão desta lição atribuiu as 8 à busca por cabeçalho, e estava **errada**:
o próprio relatório de origem (`task-1-report.md:190-198`) mostra que **6 das
8 vieram de verbos** — 5 do termo `alterar` (Maestria em Arma de Bárbaro/
Guardião/Guerreiro/Ladino/Paladino) e 1 do termo `mudar` (Magia Preparada de
Druida) — e só **2 vieram da busca dirigida por cabeçalho** (Magia Preparada
de Clérigo e Mago, cujo texto usa "pode definir/alterar... substituindo",
forma que nenhum dos verbos testados isoladamente bateria). Dos dois
cabeçalhos citados como "a receita" na primeira versão desta lição,
`**Trocando` tem **zero ocorrências** em `Classes.md`, e `**Substituindo` tem
1 ocorrência sem relação com troca de escolha — a lição errada teria mandado
o próximo domínio confiar num cabeçalho que nem existe no livro. Ao mesmo
tempo, ampliar com mais VERBOS soltos (`"em vez de"`, `"escolher outr"`) deu
28 ocorrências combinadas e **nenhuma** era cláusula de troca real — puro
ruído. **Por que é útil saber**: nenhum termo isolado (verbo OU cabeçalho)
cobriu tudo sozinho — a cobertura real veio de rodar vários termos e
CLASSIFICAR manualmente cada ocorrência nova, não de escolher de antemão o
termo "certo". Atribuir o crédito a um único método, por parecer mais
elegante de registrar, sem reconferir contra o relatório de origem, é o
mesmo tipo de erro que este guia existe para prevenir em lacunas — só que
desta vez o erro apareceu na PRÓPRIA lição, pego só na revisão da Task 6.
**Como aplicar**: ao levantar cláusulas de um tipo específico pelo livro
inteiro, rode uma lista de termos candidatos (verbos sinônimos e formas de
cabeçalho/título), registre CADA termo e o que ele trouxe — uma tabela, não
um resumo — e classifique manualmente toda ocorrência nova. A lista de
termos que valem a pena só se conhece depois de rodar todos e comparar;
presumir que um TIPO de busca é sempre superior a outro é a mesma armadilha,
só que vestida de lição.

**(b) Quando o app inventa uma taxonomia que o livro não tem, "contra o
livro" produz alegação sem fonte — é preciso separar o citável do
julgamento.** O par "Habilidades Ativas"/"Habilidades Passivas" é
vocabulário do APP (a seção da ficha), não do livro — nenhuma frase de
`Classes.md` rotula uma característica como "ativa" ou "passiva". Tratar as
174 classificações do catálogo como uma alegação direta sobre o livro
produziria dezenas de "lacunas" sem nenhuma frase para citar como prova. O
catálogo resolveu isso com um campo `base` de três valores: `'custo-
declarado'`/`'ausencia-de-custo'` (o livro tem uma frase citável -- Ação,
recurso nomeado, ou ausência total de custo/gatilho) sustentam lacuna;
`'julgamento'` (o livro só diz "você pode..." sem custo, e a classificação é
leitura, não fato) não sustenta -- a heurística ainda roda e o resultado é
registrado (`t.skip` com a mensagem, não escondido), mas nunca vira
`assert.equal`. Das 174, 9 caíram em `'julgamento'`; sem essa separação,
teriam produzido até 9 alegações sem fonte, a mesma classe de erro que gerou
31 lacunas falsas na rodada de Talentos (erro 1 deste guia), só que por um
mecanismo diferente -- lá era "arquitetura em vez de comportamento", aqui é
"taxonomia do app tratada como se fosse do livro". **Por que é útil saber**:
o erro 1 deste guia já ensinava a desconfiar de perguntas fáceis demais de
responder; este é o caso em que a pergunta nem devia ter sido feita da forma
como foi formulada -- "isto é ativa ou passiva, segundo o livro?" pressupõe
que o livro responde, quando às vezes só o app faz essa pergunta.
**Como aplicar**: antes de confrontar uma classificação do app contra o
livro, pergunte se o PAR de categorias (não só o valor) existe no livro. Se
o app inventou a categoria, task ainda vale a pena -- mas cada entrada
precisa de um campo que separe "o livro tem frase citável para isto" de
"isto é minha leitura mais razoável", e só o primeiro grupo pode virar
`assert.equal`.

**(c) Característica COMPOSTA (o livro empacota naturezas diferentes sob um
nome) não sustenta lacuna sozinha.** Em 10 das 174 características, o livro
junta, sob UM nome, cláusulas que teriam `base` diferente se fossem
separadas -- uma parte passiva incondicional ao lado de uma parte com custo
declarado, ou uma opção por julgamento ao lado de uma passiva. Um exemplo
real do catálogo (corrigido nesta revisão -- uma primeira versão desta
lição trocou a classe e a cláusula, ver abaixo): Fúria Persistente do
Bárbaro (nível 15) combina uma cláusula de CUSTO DECLARADO -- "Ao jogar
Iniciativa, você pode recuperar todos os usos gastos de Fúria. Após
recuperar a Fúria deste modo, você não pode fazê-lo novamente até completar
um Descanso Longo" (`Classes.md:165`) -- com uma cláusula PASSIVA
incondicional -- "sua Fúria... agora dura 10 minutos sem a necessidade de
estender a duração" (`Classes.md:167`). (A primeira versão desta lição
atribuía o gatilho de Iniciativa a Fonte de Inspiração do BARDO -- errado:
`Classes.md:464` fala em restaurar usos ao completar um Descanso Curto ou
Longo, sem nenhuma menção a Iniciativa; a cláusula de Iniciativa é do
Bárbaro, e lá é a metade COM custo, não a passiva -- o catálogo e o
`task-3-report.md` sempre descreveram isso certo, só a lição errou ao
resumir.) Pela regra de força do catálogo (custo-declarado sempre vence), a
entrada resolve para `ativa: true`; mas por ser composta, mesmo essa
classificação não sustenta uma lacuna sozinha se o app discordar -- o app
pode estar modelando só a metade passiva (a duração de 10 minutos), não
"errando" a Iniciativa. Tratar essas 10 como qualquer outra entrada teria
arriscado registrar uma lacuna onde a divergência é de RECORTE, não de
REGRA. **Por que é útil saber**: é uma
terceira forma (depois de `'julgamento'`) de "isto não é uma alegação
simples", e as duas merecem o MESMO tratamento estrutural (não um `if` por
razão -- `naoSustentaAlegacaoSozinha = julgamento || composta`), porque
produzem o mesmo efeito: nenhuma frase única do livro sustenta uma alegação
de "app errado" sozinha. Confirmado por mutação (task-4-report.md): estragar
`ativa` numa entrada composta faz a heurística RODAR e o resultado mudar
(a mensagem do skip passa a dizer "divergem"), mas o teste continua verde --
prova de que o filtro está em vigor estruturalmente, não só documentado em
comentário. **Como aplicar**: ao ler a descrição bruta de uma característica
para decidir seu `base`, pergunte se o parágrafo tem mais de UMA cláusula
com força de evidência diferente (uma incondicional, outra com custo, outra
por julgamento). Se tiver, marque como composta E deixe o valor de força
mais alta decidir a classificação-resumo (custo-declarado sempre vence, na
ausência dele julgamento vence ausência-de-custo) -- mas não deixe essa
entrada sustentar uma lacuna sozinha nem a favor nem contra o app.

**(d) "Estreite o wrap para a asserção divergente" é regra fácil de
repetir e fácil de violar de um jeito NOVO a cada vez -- esta rodada
violou de duas formas que as duas anteriores não tinham.** A instrução já
existia neste guia (README, mecânica de `comLacuna`) por ter sido violada
duas vezes: um wrap largo demais faz asserções IRMÃS morrerem junto com a
divergente. A Task 6 desta rodada cometeu a MESMA classe de erro pela
TERCEIRA vez, mas por dois mecanismos que as duas primeiras vezes não
tinham (`task-6-report.md`, seção "Dois bugs pegos e corrigidos"): (1) o
wrap de vocabulário de Estilo de Luta envolveu os 10 testes de
`efeitosEstilo` em vez dos 5 realmente divergentes -- os 5 que já
concordavam com o app (Arquearia, Arremesso, Armas Grandes, Defensivo,
Duelismo) passaram a exigir FALHA sob `comLacuna`, e como continuavam
passando de verdade, o mecanismo os denunciou como "Lacuna corrigida:
remova..."; (2) um mapa de causa raiz chaveado por `classe|nome` (sem
nível) confundiu as DUAS entradas de "Golpe Brutal Aprimorado" do Bárbaro
(nível 13 e nível 17, só a de nível 17 diverge) -- a de nível 13, que já
concordava, foi arrastada para o mesmo wrap e "denunciada" pelo mesmo
motivo. Nos dois casos o SINTOMA foi idêntico ao da lição original (uma
asserção que deveria continuar verde virou vermelha por estar contaminada
por um wrap vizinho), mas a CAUSA era nova (largura do CONJUNTO de testes
recebendo o wrap, e granularidade da CHAVE de agrupamento -- não a largura
do bloco de código dentro de UM teste, que era o erro das duas vezes
anteriores). **Por que é útil saber**: "não amplie demais o `try/catch`"
não esgota a lição -- o mesmo defeito reaparece em qualquer lugar onde uma
LISTA de testes é roteada para uma lacuna compartilhada por uma CHAVE
derivada (aqui, `causa.teste`; lá, o próximo domínio pode ter outro nome
para a mesma ideia). Cada vez que a causa raiz do erro muda de forma,
"já sei dessa lição" é exatamente o momento de verificar de novo, não de
pular a verificação. **Como aplicar**: ao rotear várias asserções para a
mesma entrada de `LACUNAS` por uma chave computada (não hardcoded por
teste), (1) a chave precisa identificar a entidade com precisão SUFICIENTE
para não colidir duas ocorrências com o mesmo nome mas comportamento
diferente (aqui, faltava o nível); (2) o CONJUNTO de testes que recebe o
wrap precisa ser exatamente o conjunto que diverge, nunca "a família toda
por conveniência" -- se um subconjunto já passa, ele fica de FORA do wrap,
mesmo que pertença ao mesmo grupo temático. As duas checagens são
baratas: depois de escrever o wrap, rode a suíte e confirme que o número
de falhas bate EXATAMENTE com o que você esperava reduzir a zero -- um
número que sobra (ou que falta) é o sinal de uma das duas formas acima.

---

## A lição do domínio Subclasses / Magias: a asserção certa é sobre a UNIÃO dos mecanismos -- e isso não te dá de graça saber qual deles respondeu (2026-08-17)

**O que aconteceu.** O app concede magia de subclasse por dois acessores
(`obterMagiasDominioNivel` e `obterMagiasSemprePreparadasNivel`), sustentados
por três extratores internos que fazem o parsing de verdade -- dois
acessores, três extratores, mesma contagem do cabeçalho de
`subclasses-magias.test.mjs`. A ficha salva lê os dois acessores
(`site/js/pages/sheet.js:48-49`), e o motor deste plano assere sempre sobre a
UNIÃO dos dois, nunca sobre qual entregou, confirmado pela Task 5 (nenhuma
das 48 subclasses divergiu ENTRE rotas). A revisão da Task 6 achou o preço
escondido dessa escolha de desenho: **o teste, por construção, não registra
qual dos dois mecanismos produziu (ou deixou de produzir) o resultado** -- e
um relator que tenta reconstruir isso por LEITURA de código, sem rodar nada,
tem uma moeda de 50% de citar o mecanismo errado. Foi o que aconteceu: o
primeiro rascunho do `motivo` de Círculo da Terra dizia que
`obterMagiasDominioNivel` somava as quatro tabelas de terreno -- uma leitura
plausível (é a função com "Domínio" no nome, e a subclasse concede uma
tabela "Magias do Domínio"), e **falsa**: essa função está MORTA para essa
subclasse (mesmo bug de nome "do"/"de" de outra causa), e as 12/4/4/4 magias
medidas saem inteiras da rota "sempre preparada"
(`extrairMagiasSemprePreparadasTabela`), confirmado só depois de RODAR um
script que imprimiu `obterMagiasDominioNivel(...) = []` e
`obterMagiasSemprePreparadasNivel(...).length = 12` lado a lado.

**Por que é útil saber -- a alegação nova, não repetida em outra lição.** O
corolário óbvio de "a asserção é sobre a união" -- "o `motivo` tem que citar
os dois mecanismos" -- é necessário, mas **não suficiente**: garante que o
LEITOR saiba que há dois candidatos, não que o AUTOR tenha identificado o
certo. A armadilha é que, quando o mecanismo errado parece mais plausível de
memória (aqui, "Domínio" combinando com a palavra do livro), a leitura de
código sozinha não desmente a hipótese -- as DUAS funções existem e
PARECERIAM processar essa subclasse se você só seguir os nomes. Isto é
diferente de "rastrear a consequência no código antes de registrar" (lição
de Classes/Níveis, 2026-08-07, acima) e de "motivo com arquivo e linha dos
dois lados" ("Dois vícios de relatório", acima): as duas já mandavam
verificar antes de concluir, mas nenhuma cobre o caso em que a PRÓPRIA FORMA
da asserção (união, por desenho) apaga o sinal de qual mecanismo agiu -- um
`motivo` que aponta para a função errada não é só impreciso, manda quem for
corrigir abrir o arquivo errado, mexer em código morto, e concluir "já está
certo" sem nunca alcançar a rota que de fato entrega a magia.

**Como aplicar.** Ao confrontar uma UNIÃO de mecanismos: (1) escreva o
`motivo` citando os dois candidatos (corolário já conhecido); (2) antes de
aceitar qual respondeu, RODE os dois contra os mesmos argumentos (script ad
hoc basta) e cole a saída literal -- não infira pelo nome da função. As duas
lições citadas acima já mandavam rodar antes de concluir; esta é o caso em
que isso importa mais, porque nada no teste avisa se você citou o mecanismo
errado -- ele passa igual, já que confere o resultado agregado, não a
origem.

---

## A lição do domínio Subclasses / Escolhas: o mesmo marcador textual do livro cobre mecânicas diferentes -- classifique pelo EFEITO, não pela palavra (2026-08-17/18)

**O que aconteceu.** Das 78 características DISTINTAS de subclasse que
mencionam escolha ou proficiência, 73 usam uma frase parecida com "à sua
escolha" -- mas só 20 (23 entradas do catálogo, porque três embutem duas
escolhas) são escolha de CONSTRUÇÃO, que o app precisa perguntar e
persistir. Dessas 20, 18 precisam ser exigidas NO NÍVEL de aquisição, com a
subida de nível recusando concluir sem elas; as outras 2 (Resistência
Ínfera, O Terceiro Olho) o próprio livro nasce a escolha só no primeiro
Descanso/uso depois da aquisição, não no nível -- então "persistir" vale
para as 20, mas "recusar concluir a subida sem a escolha" só é uma regra do
livro para 18 delas (ressalva registrada em `lacunas-conhecidas.mjs`, Causa
2 do domínio). As outras 53 são decididas na hora do uso (alvo,
direção, tipo de dano -- 50 casos, `ESCOLHAS_EM_JOGO`) ou são puramente
cosméticas (sabor sem efeito mecânico -- 3 casos, `ESCOLHAS_COSMETICAS`).
Tratar as 73 como um bloco só, medindo "o app pergunta isto?" contra todas,
teria produzido até 53 lacunas falsas -- mais que o dobro das 31 da rodada
de Talentos -- porque a maioria da frase "à sua escolha" no livro não
descreve uma decisão que precisa virar campo de personagem. A distinção que
separou os dois grupos não foi sintática (achar a palavra "escolha"): foi
perguntar se o EFEITO da escolha sobrevive além do próprio uso -- até o
próximo Descanso é construção (Resistência Ínfera, refeita a cada Descanso
mas persistida até o próximo); só até o fim do turno, da Fúria ou da forma
ativa é em jogo (Baluarte de Energia, que também gasta um uso por Descanso e
ainda assim não persiste nada). Essa pergunta exigiu ler a frase inteira de
cada característica, não só localizar "escolha" nela -- ver catálogo,
`catalogo/subclasses.mjs`.

**Por que é útil saber.** É uma variação do erro nº 1 deste guia ("medir
arquitetura em vez de comportamento") e da lição (b) de Classes/Trocas e
Classes/Passivas ("quando o app inventa uma taxonomia que o livro não tem,
separe o citável do julgamento") -- mas ao contrário das duas, aqui o
PRÓPRIO LIVRO usa uma frase textualmente idêntica para três mecânicas
diferentes, e é o CATÁLOGO -- não o app -- que precisa fazer a distinção
antes de qualquer asserção existir. Nenhum teste pega essa armadilha depois
de escrita: um catálogo que confundisse as três produziria lacunas
plausíveis, citáveis, com `Classes.md:<linha>` real -- e ainda assim falsas,
porque a citação prova que o livro usa a palavra "escolha", não que o app
deva persistir aquela escolha específica.

**Como aplicar.** Ao ler uma característica cujo texto contém "escolha" (ou
equivalente) no livro, não assuma construção por padrão. Pergunte: o efeito
da escolha sobrevive além do próprio uso, até um marco durável (Descanso,
nível seguinte)? Só então é escolha de construção, que sustenta uma
alegação de pendência ausente. Se o efeito se esgota no turno/na ativação em
si, é escolha em jogo -- fora do alcance de qualquer motor que testa
`subirDeNivel`/personagem persistido. Se a escolha não muda número nem opção
disponível ao jogador, é cosmética -- nenhuma das duas sustenta lacuna
nenhuma, a favor ou contra o app.

(Um segundo candidato a lição foi cogitado e descartado nesta rodada: "um
`campoEsperado` inventado transforma o motor em medidor de arquitetura" --
sete das nove sub-chaves de `campoEsperado` foram escritas com nomes
snake_case inventados antes de existirem no app, e seis vermelhos chegaram a
alegar "nenhum mecanismo existe" quando o app persistia a escolha sob outro
caminho (`char.recursos.*`). Não virou lição própria porque é o mesmo erro
nº 1 deste guia -- "enumere todos os mecanismos, não presuma um só" -- só
que aplicado à curadoria do catálogo em vez de ao desenho do teste; o
antídoto usado (`campoEsperado` como dica confirmada por grep, comparação
integral quando é `null`) já está documentado no README, seção "Achados do
domínio Subclasses / Escolhas". Registrar as duas como lições separadas
inflaria o guia sem ensinar nada que o erro nº 1 já não ensine.)

---

## O que fazer quando o app e o livro discordam

Nem toda divergência é bug do app, e a distinção muda o que se escreve:

| Situação | Classificação | O que fazer |
|---|---|---|
| O livro descreve efeito/opção que o app não oferece | divergência real | lacuna `app-diverge-do-livro`, com o que você viu na tela |
| O app usa outro nome interno (chave de flag, id) | erro de catálogo | corrigir o catálogo — o app é dono dos identificadores internos |
| O app implementa por mecanismo que o motor de unidade não enxerga | limitação | lacuna `limitacao-observabilidade`, e prove pela camada de navegador |
| O app implementa em um fluxo e não em outro | divergência real | lacuna nomeando **os dois** fluxos, com evidência de cada |

E o limite honesto de qualquer motor cujas expectativas foram curadas lendo o
app (como o de passivos, cujos nomes de flag vêm de `talentos-effects.js`): ele
prova transcrição correta e serve de rede contra regressão, **não** prova
conformidade com o livro. A confrontação com o livro, ali, aconteceu na
curadoria — e se a curadoria errou, o motor concorda com o erro em silêncio.
Diga isso no README do domínio, para que "tudo verde" não seja lido como
garantia maior do que é.

---

## Limitações conhecidas do app, não implementáveis nesta rodada (2026-08-07, Task 7)

**O app não tem motor de rolagem de dados.** Achado ao corrigir as flags
`estilo_armas_grandes`/`estilo_duas_armas` (Task 7,
`.superpowers/sdd/2026-08-07-classes-trocas-passivas/task-7-report.md`) --
registrado aqui, não como lacuna (retirada de `lacunas-conhecidas.mjs` junto
com o achado "flag sem consumidor" que a hospedava), porque é um fato
diferente que sobrevive à correção e que a remoção da entrada apagou sem
querer.

As duas flags ganharam consumidor em `site/js/sheet/inventario.js` (Task 7)
-- um selo informativo na arma qualificada. O que continua **não**
acontecendo, e não é implementável sem uma mudança de arquitetura maior que
esta correção: **nenhuma parte do app aplica qualquer uma das duas mecânicas
a uma rolagem de dano de verdade**. `danoExibicao`
(`site/js/sheet/inventario.js`) só mostra a FÓRMULA de dano da arma
(`XdY+Z`, string), nunca rola um dado -- não existe, em lugar nenhum de
`site/js/`, um `Math.random()`/gerador de resultado de dado para uma jogada
de dano de arma (a única rolagem de dado que o app faz é no assistente de
criação, para PV/atributos, um contexto totalmente diferente). Isso significa
que:

- **Combate com Armas Grandes** ("trata qualquer 1 ou 2 num dado de dano como
  um 3", `Talentos.md:764`) não tem onde se conectar: não há resultado de
  dado nenhum para interceptar e substituir. A fórmula estatisticamente
  equivalente (média de +3/faces por dado) existe e é trivial de calcular,
  mas misturar um número PROBABILÍSTICO com os modificadores EXATOS que
  `danoExibicao` já mostra (bônus de talento, Fúria, proficiência) seria mais
  enganoso que informativo -- decisão registrada em comentário no próprio
  `inventario.js`.
- **Combate com Duas Armas** (soma o mod. de atributo ao "ataque adicional"
  de arma Leve, `Talentos.md:770`) também não tem onde se conectar: o app
  não modela "ataque adicional"/"segundo ataque da ação Atacar" como uma
  entidade separada em lugar nenhum -- cada arma no inventário mostra UMA
  linha de dano, que já representa "um ataque genérico com esta arma",
  primário ou adicional, sem diferenciar os dois.

**Se um domínio futuro (ex.: "Combate") tocar rolagem de dano de verdade**,
essas duas mecânicas viram implementáveis de verdade (interceptar o
resultado do dado antes de exibir/somar) -- até lá, o selo informativo é o
teto do que este app consegue expressar sobre elas, e um motor de teste que
exigisse mais do que isso estaria cobrando uma arquitetura que não existe.
