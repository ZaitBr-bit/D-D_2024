# Guia de curadoria — mecânica dos itens mágicos (capítulo 7)

Cada `dados/livro-do-mestre/capitulo7/_mecanica/lote-NN.json` classifica TODOS os
registros (itens e variantes) do `_lotes/lote-NN.json` de mesmo número. Fonte: o
texto traduzido do próprio lote (não é preciso abrir o PDF). Ids: os de
`itens_magicos.json` (`slug` do nome; variante "Arma +1" → `arma-mais-1`).

```json
{
  "lote": "NN",
  "itens": {
    "<id>": { "base": { "tipo": "arma", "opcoes": ["Espada Longa"] }, "efeitos": [ { "alvo": "ataque_arma", "valor": 3 } ] }
  },
  "sem_efeito_automatico": ["<id>", "..."],
  "pendencias": ["<id>: dúvida e por que ficou sem efeito"]
}
```

## O que entra como efeito

Só efeito **numérico, permanente enquanto o item está equipado/empunhado** (e
sintonizado, quando o item exige), de um destes alvos:

| alvo | quando usar | exemplo |
|---|---|---|
| `ca` | "+N de bônus na Classe de Armadura" | Anel de Proteção `{alvo:"ca", valor:1}` |
| `ca_base` | "sua CA base é N" / "CA = N" fixo | — |
| `ataque_arma` | "+N nas jogadas de ataque feitas com esta arma" | Espada Vorpal +3 |
| `dano_arma` | "+N nas jogadas de dano feitas com esta arma" | Espada Vorpal +3 |
| `ataque_magia` | "+N nas jogadas de ataque de magia" | Varinha do Mago de Guerra +N |
| `cd_magia` | "+N na CD para evitar suas magias" | — |
| `salvaguarda` | "+N nas salvaguardas" (todas) | Anel de Proteção |
| `atributo` | "seu valor de X passa a ser N; sem efeito se já for N ou mais" | Cinturão de Força do Gigante (das colinas) `{alvo:"atributo", atributo:"forca", minimo:21}` |

Condição (`"condicao"`), só uma destas: `sem_armadura`, `sem_escudo`,
`sem_armadura_nem_escudo` (Braçadeiras de Defesa:
`{alvo:"ca", valor:2, condicao:"sem_armadura_nem_escudo"}`).

## O que NÃO entra (vai para `sem_efeito_automatico`)

- Ativação (ação, Ação Bônus, Reação, palavra de comando), cargas, "uma vez por
  dia", duração ("por 1 hora"), consumo (poções, pergaminhos, óleos).
- Bônus contra alvo específico ("contra Mortos-Vivos"), em teste específico
  ("testes de Furtividade"), em salvaguarda específica ("salvaguardas de
  Constituição"), dado extra de dano ("+2d6 de dano Radiante").
- Resistência, imunidade, deslocamento, sentidos, idiomas, Vantagem.
- Aumento permanente de atributo ("aumenta em 2", Tomos e Manuais): o jogador
  ajusta o atributo na ficha.
- Munição +N (a ficha não liga munição à arma que a dispara).
- Na dúvida: `sem_efeito_automatico` + uma linha em `pendencias`.

## `base` (item que é uma arma ou armadura do catálogo)

Fica no **id do item**, nunca na variante. Item com base entra em `itens` mesmo
sem efeito numérico (`"efeitos": []`), porque a tela vai pedir a arma/armadura.

| subtipo do livro | base |
|---|---|
| "Qualquer Arma Simples ou Marcial" | `{tipo:"arma", categorias:[as 4 categorias de armas.json]}` |
| "Qualquer Arma Corpo a Corpo" | `{tipo:"arma", categorias:["Armas Simples Corpo a Corpo","Armas Marciais Corpo a Corpo"]}` |
| nomes ("Glaive, Espada Grande, Espada Longa ou Cimitarra") | `{tipo:"arma", opcoes:["Glaive","Espada Grande","Espada Longa","Cimitarra"]}` (nomes exatos de `dados/equipamento/armas.json`) |
| "Qualquer Armadura Leve, Média ou Pesada" | `{tipo:"armadura", categorias:["Leve","Média","Pesada"]}` |
| "…, exceto Gibão de Peles" | acrescenta `excluir:["Gibão de Peles"]` |
| nomes ("Cota de Malha ou Cota de Malha Parcial") | `{tipo:"armadura", opcoes:[...]}` (nomes exatos de `armaduras.json`) |
| "Escudo" | `{tipo:"escudo"}` |
| Cajado/Bastão que o texto diz funcionar como arma ("empunhado como um Cajado mágico") | `{tipo:"arma", opcoes:["Cajado"]}` |
| "Qualquer Munição" | sem base (munição não é automatizada) |

`sem_penalidades: true` (opcional, só em `base.tipo:"armadura"`): a armadura montada
não tem Desvantagem em Furtividade nem requisito de Força (texto do item, ex.: Armadura de Mitral).
O valor tem de ser booleano.

`ataque_arma`/`dano_arma` só valem com `base.tipo:"arma"` no item (o validador cobra).

## Variantes

Efeito numérico que muda por grau fica na **variante** (Arma +1/+2/+3, Pedra Ioun,
Cinturão por gigante). O id do item-pai vai para `sem_efeito_automatico`, a menos que
tenha `base` (aí entra em `itens` com a base e `"efeitos": []`).

## Recursos (cargas e usos)

Campo opcional `recursos` ao lado de `efeitos`/`base`. Uma entrada só com `recursos` é
válida (`"efeitos": []`); item que também estava em `sem_efeito_automatico` sai de lá.

- `cargas.max`: inteiro >= 1, presente no texto do item.
- `cargas.recupera`: dado `"XdY"` ou `"XdY+Z"` sem espaços (o validador casa "1d6 + 1" do
  texto), inteiro >= 1 (aparece no texto como número isolado), `"todas"` ou `null` (não recupera).
- `cargas.ultima_carga`: `null`; `{ "efeito_com_1": "destroi" }` quando o livro manda
  destruir o item; ou `{ "efeito_com_1": "outro", "texto": "..." }` com a frase copiada
  literalmente do item. Exige "última carga" no texto.
- `usos`: lista de `{ nome, max, recupera }`, sem nomes repetidos. `recupera`:
  `amanhecer` ("uma vez até o próximo amanhecer"), `descanso_longo` ou `descanso_curto`
  (volta também no longo). Cada um exige o termo correspondente no texto.
- `usos[].efeito` (opcional): efeito que o chip do uso dispara na ficha ao ser gasto. Valor
  único hoje: `"recuperar_espaco_magia"` (a ficha pergunta qual espaço de magia gasto
  restaurar). `circulo_max` é opcional: presente, é inteiro de 1 a 9 e aparece no texto como
  "Nº círculo" (Pérola do Poder: "3º círculo ou inferior" -> `circulo_max: 3`); ausente, não há
  limite de círculo (Bastão do Guardião do Pacto) e o texto não pode citar círculo algum
  ("Nº círculo" em qualquer construção, "círculo N" ou por extenso, como "terceiro círculo");
  se citar, o verificador exige `circulo_max`. `circulo_max` sem `efeito` é erro. Uso sem
  `efeito` só alterna gasto/disponível.
- Variante herda os `recursos` do item-pai; só tem os próprios quando diferem. Quem mescla
  variante com pai é o runtime, ao montar o item do inventário (Task 3), não o `montar`:
  o `montar` grava `null` na variante que não tem entrada própria.
- `recursos` precisa ter `cargas` ou `usos`; chaves desconhecidas em `recursos`, `cargas`,
  `ultima_carga` e em cada uso são recusadas.
- `sem_cargas: { "<id>": "<motivo>" }` no arquivo do lote: o texto cita "cargas" mas o
  item não tem contador. O motivo é obrigatório e o id tem de ser registro do lote.

Casos conhecidos: `ladra-de-nove-vidas` tem máximo variável ("1d8 + 1 cargas"), que
`cargas.max` (inteiro >= 1) não representa. Itens assim vão para `sem_cargas` com o motivo
"máximo em dado"; o contador manual cobre o caso.
Destruição incondicional ao gastar a última carga (sem d20) vira `ultima_carga` `outro` com a
frase literal (a ficha só lembra); `destroi` só quando o texto manda jogar 1d20.
- Completude: todo registro cujo texto cita "carga(s)" tem `recursos.cargas` (nele ou no
  pai) ou está em `sem_cargas`.

Exemplos:

```json
"varinha-de-bolas-de-fogo": { "efeitos": [], "recursos": {
  "cargas": { "max": 7, "recupera": "1d6+1", "ultima_carga": { "efeito_com_1": "destroi" } } } },
"cajado-do-poder": { "base": { "tipo": "arma", "opcoes": ["Cajado"] }, "efeitos": [ "..." ], "recursos": {
  "cargas": { "max": 20, "recupera": "2d8+4", "ultima_carga": { "efeito_com_1": "outro",
    "texto": "<frase da última carga, copiada do item>" } } } },
"azagaia-do-relampago": { "base": { "tipo": "arma", "opcoes": ["Azagaia"] }, "efeitos": [], "recursos": {
  "usos": [ { "nome": "Relâmpago", "max": 1, "recupera": "amanhecer" } ] } },
"perola-do-poder": { "efeitos": [], "recursos": {
  "usos": [ { "nome": "Recuperar espaço de magia", "max": 1, "recupera": "amanhecer",
    "efeito": "recuperar_espaco_magia", "circulo_max": 3 } ] } },
"bastao-do-guardiao-do-pacto": { "efeitos": [], "recursos": {
  "usos": [ { "nome": "Recuperar espaço de magia", "max": 1, "recupera": "descanso_longo",
    "efeito": "recuperar_espaco_magia" } ] } }
```

## Magias conjuradas pelo item

Campo opcional `magias` ao lado de `efeitos`/`base`/`recursos`: lista das magias do Livro do
Jogador que o item conjura. Uma entrada só com `magias` é válida (`"efeitos": []`). Cada magia:

```json
{ "nome": "Bola de Fogo", "custo": <custo>, "conjuracao": <conjuracao> }
```

- `nome`: exatamente como no índice de magias (`dados/magias/_indice.json`) e em itálico
  simples (`*Nome*`) no texto do item. Sem repetir nome no mesmo registro.
- `custo`:
  - `"livre"`: sem custo (item sem cargas; em item com cargas exige "0 carga" ou "sem gastar" no
    texto, ou que nenhuma frase que cita a magia em itálico mencione "carga", como em Luzes
    Dançantes e Luz do Anel de Estrelas Cadentes).
  - `{ "uso": "<nome>" }`: consome um uso de `recursos.usos` (o nome tem de existir lá). Aceita `circulo` opcional
    (`{ "uso": "<nome>", "circulo": C }`) para a versão de círculo fixo, com as mesmas checagens de `circulo` das cargas.
  - `{ "cargas": N }`: gasta N cargas de `recursos.cargas`; N <= `cargas.max` e aparece no texto.
    `{ "cargas": 0 }` vale para "(0 carga)".
  - `{ "cargas": N, "cargas_max": M }`: faixa de N a M cargas (M > N, M <= `cargas.max`).
  - `{ "cargas": N, "circulo": C }`: versão de círculo C da magia; C >= círculo da magia e
    "Cº círculo" aparece no texto. Não combina com `cargas_max`.
- `conjuracao`: `null` (o item não fixa CD nem ataque); `{ "cd": N }` e/ou `{ "ataque": N }`
  com "CD N" / "+N" no texto; ou `"sua"` quando o texto manda usar a CD, o modificador ou o
  bônus de ataque do próprio personagem.
- Variante herda `magias` do item-pai; só tem as próprias quando diferem. O `montar` grava
  `magias` (com `circulo_base`, o círculo do índice) no item e na variante, ou `null`.

Exemplos:

```json
"varinha-de-bolas-de-fogo": { "efeitos": [], "recursos": { "cargas": { "max": 7, "recupera": "1d6+1", "ultima_carga": { "efeito_com_1": "destroi" } } },
  "magias": [ { "nome": "Bola de Fogo", "custo": { "cargas": 1, "cargas_max": 3 }, "conjuracao": { "cd": 15 } } ] },
"cajado-do-poder": { "magias": [ { "nome": "Bola de Fogo", "custo": { "cargas": 5, "circulo": 5 }, "conjuracao": "sua" } ] },
"manto-aracnideo": { "magias": [ { "nome": "Teia", "custo": { "uso": "Teia" }, "conjuracao": { "cd": 13 } } ] },
"anel-de-comando-elemental-ar": { "magias": [ { "nome": "Queda Suave", "custo": { "cargas": 0 }, "conjuracao": null } ] }
```

(`cajado-do-poder` e `manto-aracnideo` mostram só o campo `magias`; no arquivo real levam também
`efeitos` e `recursos`. O Anel de Comando Elemental leva as magias em cada variante.)

- `sem_magias: { "<id>": "<motivo>" }` no arquivo do lote: o texto conjura magia em itálico
  mas o item não tem lista fixa. Motivo obrigatório; o id tem de ser registro do lote.
  Motivos usuais: "magia escolhida pelo Mestre", "truque escolhido na hora", "custo em gemas",
  "Pergaminho de Magia: magia do pergaminho".
- Magia citada só como efeito de outra coisa ("como a magia *X*", ou o Desejo do texto da
  Espada de Kas) não entra em `magias`.
- A completude de magias detecta citação a mais: um item cujo texto cita uma magia só como
  efeito de outra coisa (Desejo da Espada de Kas) e que não teria lista fixa precisa, mesmo assim,
  de classificação. A saída é `sem_magias` com o motivo (ex.: "Desejo só citado; fora das magias"),
  nunca uma entrada em `magias` que o item não conjura.
- Olho e Mão de Vecna: o pai (`olho-e-mao-de-vecna`) fica em `sem_magias` e as magias vão em cada
  variante (`olho-de-vecna`, `mao-de-vecna`), porque tabelas e custos diferem. A classificação do pai
  cobre a completude das variantes (o pai vale para a variante).
- Completude: todo registro cujo texto contém "conjur" e uma magia do índice em itálico tem
  `magias` ou `sem_magias` (nele ou no pai). Lista `magias: []` não conta como classificação.
- Magia não nomeada ("Magia Desconhecida", "magia vinculada a este item", "magia à sua escolha",
  "magia escolhida"; `RE_MAGIA_NAO_NOMEADA`): o registro tem de estar em `sem_magias` com motivo
  (nele ou no pai), mesmo que tenha outras magias em `magias` (Amuleto do Fragmento Sombrio,
  Chapéu de Mago, Cajado/Arma/Armadura Encantada).

## Defesas, deslocamento e sentidos

Efeitos passivos de itens equipados (e sintonizados, quando exigido). Todo valor declarado
tem de aparecer no texto do item; os alvos abaixo não aceitam `valor`.

```json
{ "alvo": "resistencia", "tipo_dano": "Ígneo" }
{ "alvo": "resistencia", "escolha": ["Ácido", "Gélido", "Ígneo"] }
{ "alvo": "imunidade", "tipo_dano": "Psíquico" }
{ "alvo": "imunidade_condicao", "condicao": "Enfeitiçado" }
{ "alvo": "deslocamento", "modo": "natacao", "metros": 12 }
{ "alvo": "deslocamento", "modo": "escalada", "igual_deslocamento": true }
{ "alvo": "deslocamento", "modo": "voo", "igual_deslocamento": true, "pairar": true }
{ "alvo": "deslocamento_minimo", "metros": 9 }
{ "alvo": "sentido", "sentido": "visao_no_escuro", "metros": 18, "soma_se_tiver": 18 }
```

- `tipo_dano` vem de `TIPOS_DANO`; `condicao`, de `CONDICOES` (glossário da ficha); `modo`,
  de voo/natacao/escalada; `sentido`, de visao_no_escuro/visao_verdadeira/visao_as_cegas.
- `resistencia` leva exatamente um entre `tipo_dano` e `escolha`; `escolha` tem 2 ou mais
  tipos, todos no texto (normalmente a tabela de tipos do item). `imunidade` não aceita `escolha`.
- `deslocamento` leva exatamente um entre `metros` e `igual_deslocamento`; `pairar` exige a
  palavra no texto. `deslocamento_minimo` exige "a menos que seu Deslocamento seja maior".
- `soma_se_tiver` só em `visao_no_escuro`, com a frase "Se você já tiver Visão no Escuro".
- Exemplos: Cajado do Fogo (resistência Ígneo), Anel de Natação (natação 12 m), Luvas de
  Natação e Escalada (dois efeitos `igual_deslocamento`), Óculos da Noite (sentido com
  `soma_se_tiver`), Livro dos Feitos Exaltados (imunidades), Anel de Resistência (`escolha`
  da tabela), Botas de Caminhar e Saltar (`deslocamento_minimo`).

### Vantagens

```json
{ "alvo": "vantagem", "em": "pericia", "pericia": "Furtividade" }
{ "alvo": "vantagem", "em": "iniciativa" }
{ "alvo": "vantagem", "em": "salvaguarda", "contexto": "contra magias" }
```

- `em` é pericia, salvaguarda ou iniciativa. `pericia` só em `em: "pericia"` (lista `PERICIAS`);
  `atributo` (por extenso) só em salvaguarda; `contexto` é trecho literal do texto.
- Exemplos: Botas Élficas (`pericia` Furtividade), Bastão do Alerta (`pericia` Percepção +
  `iniciativa`), Manto de Resistência a Magias (`salvaguarda`, contexto "contra magias"),
  Periapto da Saúde (`salvaguarda`, contexto com a frase do Envenenado), Olhos de Águia
  (`pericia` Percepção, contexto "que dependam da visão").

### `sem_passivos`

`sem_passivos: { "<id>": "<motivo>" }` no arquivo do lote, como `sem_cargas`: o texto tem frase
de defesa, deslocamento, sentido ou vantagem que a ficha não automatiza. Motivo obrigatório;
o id tem de ser registro do lote. Motivos usuais:

- "efeito ativado por ação": Botas Aladas; Armadura da Invulnerabilidade (só a parte de
  imunidade; a resistência passiva dela entra como efeito).
- "atributo da criatura/objeto": espadas sencientes, cordas, Espelho Aprisionador.
- "condicional": Manto do Morcego, Elmo do Brilho (com rubi).
- "consumível": poções.
- "não é tipo de dano": Escudo de Atração de Projéteis, Escaravelho.
- Vantagem fora do escopo: "vantagem em ataque" (Anel de Comando Elemental), "temporária"
  (poções, Perfume do Enfeitiçamento, Vela da Invocação, Baralho), "vantagem de outro"
  (Corda de Escalada).
- Completude: todo registro cujo texto traz frase de passivo (`RE_PASSIVO`) tem efeito desses
  alvos ou `sem_passivos` (nele ou no pai).

## Aumento de atributo até um máximo

Texto do tipo "sua Constituição aumenta em 2, até um máximo de 20". Três formas, todas com
`atributo` (`forca`, `destreza`, `constituicao`, `inteligencia`, `sabedoria`, `carisma`),
`valor` (1..4, aparece em "aumenta em N") e `maximo` (20..30, aparece em "máximo de M"):

- Passivo enquanto o item está em uso (Pedra Ioun de Fortitude): efeito
  `{ "alvo": "atributo_bonus", "atributo": "constituicao", "valor": 2, "maximo": 20 }`.
- Permanente após o estudo ou uso (Manuais e Tomos): campo `aumento_permanente` na entrada,
  ao lado de `efeitos`: `{ "atributo": "forca", "valor": 2, "maximo": 30 }`. Quando o
  livro deixa escolher o atributo, `"atributo": "escolha"` (exige "à sua escolha" no texto).
  Quando outro atributo diminui, `"reducao": { "valor": 2, "minimo": 3 }` (exige "diminui em N"
  e "mínimo de M" no texto), como no Livro da Escuridão Vil.
- Sobre um item-base (Martelo dos Trovões, que aumenta o valor de Força do Cinturão de Força
  do Gigante): efeito `atributo_minimo_bonus`, mesmas chaves do `atributo_bonus`; o texto
  tem de citar "Cinturão de Força do Gigante" ou "Manoplas de Poder do Ogro".

Chave fora dessas é erro. `atributo: "escolha"` não vale em efeito, só em `aumento_permanente`.

### `sem_aumento`

`sem_aumento: { "<id>": "<motivo>" }` no arquivo do lote, como `sem_passivos`: o texto tem a
frase de aumento com máximo, mas ela não é um aumento que a ficha automatiza (ex.: Baralho
das Muitas Coisas, cujo aumento é efeito imediato de uma carta sacada). Motivo obrigatório; o id tem de ser registro do lote.
Completude: todo registro cujo texto casa `RE_AUMENTO_TETO` tem `atributo_bonus`,
`atributo_minimo_bonus`, `aumento_permanente` ou `sem_aumento` (nele ou no pai).

## Validar

`node scripts/livro-do-mestre/mecanica.mjs verificar --lote NN` até `0 erro(s)`. O
validador exige que todo número declarado apareça no texto do item (linha de tipo,
descrição, tabelas ou nome da variante) como número real isolado: não é parte de outro
número (1 não casa em 10), de decimal ("1,5" não vale como 1 nem como 5) nem de dado
("2d6" não vale como 2). Ele não distingue "1" de "1º". Tipos de dano, condições,
perícias, atributos por extenso e sentidos precisam aparecer como palavra inteira
("Cego" não casa em "Cegos"). Se o número ou o termo não aparece, o efeito está errado
ou não é deste item.

O texto da variante é o do item-pai mais o nome da variante: o validador confere cada
valor contra o texto do pai e não sabe qual variante o trecho descreve (a Pedra Ioun de
Fortitude passa com o atributo de qualquer outra pedra, porque o pai cita os seis). O nome
da variante (ex.: "fortitude") não aparece no texto como o atributo (Constituição), então
não há checagem por nome de variante: a conferência do efeito de cada variante é da
curadoria.

## Limitações de modelo

Itens cujo texto exige vocabulário que o modelo não tem **não** são modelados; ficam em
`sem_efeito_automatico`, `sem_magias`, `sem_passivos` ou `sem_cargas` com o motivo e uma linha
em `pendencias`. Lista atual:

- Manto do Morcego: Deslocamento de Voo condicional (Meia-luz ou Escuridão, segurando as bordas).
- Broche Protetor: Imunidade ao dano da magia Mísseis Mágicos (não é tipo de dano).
- Olhos de Visão Minuciosa: Visão no Escuro a 30 centímetros (`sentido` usa metros inteiros).
- Vingador Sagrado e Arma de Alerta: benefício também para aliados na Emanação; só o portador é curado.
- Elmo do Brilho: Resistência a dano Ígneo só com ao menos um rubi (`resistencia` não aceita `contexto`).
- Armadura de Vulnerabilidade: a maldição (Vulnerabilidade) não tem alvo.
- Restrições de uso das magias de itens (Transição Planar condicionada a teste, Portal que destrói
  a vela, Medo só em Feras, Dominar Fera só em Fera nadadora): ficam na descrição.
- Túnica das Estrelas, Cubo de Invocação, Lâmina da Sorte, Pedra da Boa Sorte, Cabras de Marfim:
  contadores em estrelas/gemas/dias, sorteios e bônus de teste de atributo sem alvo.
- Recuperação em horas ou dias (`recupera` só tem amanhecer e descansos): contador manual.
- Bônus em Ataques Desarmados e em jogadas contra alvo específico: `ataque_arma`/`dano_arma` exigem base de arma.
- Citação a mais na completude de magias (Desejo da Espada de Kas): vai para `sem_magias` com motivo; o modelo não tem "magia só citada".
- Olho/Mão de Vecna: o pai fica em `sem_magias` e as magias ficam nas variantes; o item único com Olho e Mão juntos (Desejo, Vantagem em Iniciativa, Imunidade a Veneno) não é modelado.
- Auréola do Livro dos Feitos Exaltados: a Vantagem em Persuasão está curada com contexto; a Luz Plena e a Desvantagem de ataque contra Ínferos e Mortos-Vivos não têm alvo.
