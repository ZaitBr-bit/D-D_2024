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
`document`, porque `utils.js:609` atribui a `window` no carregamento); e um
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
