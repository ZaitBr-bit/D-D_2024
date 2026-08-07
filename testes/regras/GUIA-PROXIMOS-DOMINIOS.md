# Guia para os próximos domínios

Talentos foi o piloto. Faltam antecedentes, espécies, classes/níveis, magias e
as regras transversais da ficha — muito mais superfície do que já foi coberta.

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
