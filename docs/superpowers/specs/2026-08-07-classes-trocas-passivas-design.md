# Classes: direitos de troca e passivas das 12 classes base — desenho

Data: 2026-08-07
Extensão do domínio Classes/Níveis (`testes/regras/`), depois da entrega em `ce679e1`.

## O que motivou

Duas rodadas seguidas de bugs achados **por um humano usando o app**, não pela
suíte:

1. Ladino não recebe a Especialização do nível 6 (já registrado e corrigido no
   catálogo de lacunas).
2. **Guerreiro não consegue trocar o Estilo de Luta ao subir de nível**, embora
   `Classes.md:3812` diga "Sempre que atinge um nível de Guerreiro, você pode
   substituir o talento que escolheu por um talento diferente de Estilo de Luta".

O segundo caso não é isolado. É a ponta de duas categorias inteiras que a suíte
nunca olhou.

## Achados do pré-voo (medidos, não supostos)

### 1. O app implementa 1 de ~15 direitos de troca de classe base

`Classes.md` tem **~28 cláusulas** "você pode substituir X por Y"; descontando
as de combate ("substituir um ataque por um truque") e as de subclasse, sobram
**~15 direitos de troca de classe base** — trocar truque (Bardo `:418`, Clérigo
`:1544`, Druida `:2030`, Feiticeiro `:2637`, Bruxo `:894`), trocar magia
preparada (Bardo `:430`, Bruxo `:908`, Feiticeiro `:2649`, Guardião `:3290`,
Paladino `:5511`, Mago `:4646`/`:4652`), trocar invocação (Bruxo `:884`),
trocar Metamagia (Feiticeiro `:2694`), trocar forma selvagem (Druida `:2076`),
e **trocar Estilo de Luta (Guerreiro `:3812`)**.

O app implementa **uma**: a troca de manobra do Mestre da Batalha
(`manobra_trocar_de`/`manobra_trocar_para`).

**Complicação de desenho.** O app já tem **dois padrões concorrentes** de troca:

| Padrão | Onde | Observável em `node:test`? |
|---|---|---|
| Via `opcoes` → `subirDeNivel()` | manobra do Mestre da Batalha (`levelup.js:1556-1562`) | **sim** |
| Mutação direta de `char` **antes** de chamar `subirDeNivel` | troca de magia/truque (`levelup-ui.js:1347-1366`) | **não** — fora do pipeline |

O segundo padrão é invisível para o motor de unidade: a troca é aplicada por
`levelup-ui.js` sobre o personagem, e `subirDeNivel` nunca a vê. Qualquer
asserção sobre troca de magia/truque via `escadaDeNivel` seria cega por
construção — e uma "lacuna" registrada a partir dela seria falsa.

### 2. Passiva é inferida por heurística de texto, não por dado

`dados/classes/*.json` → `caracteristicas` tem só `{nivel, nome, descricao}`,
sem campo de tipo. Quem decide Ativa/Passiva é
`ehHabilidadeAtiva(descricao, nome)` (`site/js/utils.js:469-481`), que procura
substrings: `'como uma ação'`, `'como ação bônus'`, `'como uma reação'`,
`'você pode usar'`, `'você pode gastar'`, `'no seu turno'`, mais
`detectarRecarga` (`utils.js:452-464`).

É uma função pura, com 12 classes × características como domínio de entrada —
**exatamente o formato que este projeto sabe confrontar por varredura
exaustiva**.

### 3. Duas flags de Estilo de Luta são escritas e nunca lidas

`talentos-effects.js:397` grava `flags.estilo_armas_grandes` e `:400` grava
`flags.estilo_duas_armas`. Nenhum arquivo de `site/js/` lê nenhuma das duas
(grep). O livro dá efeito mecânico às duas: re-rolar 1 ou 2 no dano de armas de
duas mãos, e somar o modificador ao dano da mão secundária.

### 4. A ficha mostra o efeito de 5 dos 10 Estilos de Luta

O mapa `efeitosEstilo` (`habilidades.js:4622-4634`) é indexado pelo valor
gravado em `escolhas_classe.estilo_luta`, que vem do seletor de
`comum.js:311-321`. Os dois vocabulários não batem:

- **Gravados sem texto de efeito na ficha** (5): `Duas Armas`, `Desarmado`,
  `Interceptação`, `Luta às Cegas`, `Protetivo`.
- **Chaves do mapa que nunca são gravadas** (6): `Defesa Cega`, `Intercessão`,
  `Combate sem Arma`, `Combate com Duas Armas`, `Combatente Druídico`,
  `Combatente Abençoado`.

Note que os efeitos **numéricos** não sofrem disso: `getEstiloAtivo`
(`talentos-effects.js:19-26`) tem um `mapaEstilos` que normaliza os nomes
abreviados para os canônicos de `dados/talentos/talentos.json`. Ou seja, existe
normalização num caminho e não no outro — o cheiro de duplicação manual que o
guia do projeto manda investigar.

Nomes canônicos, do livro e de `dados/talentos/talentos.json` (categoria
"de Estilo de Luta"): Arquearia, Combate com Armas de Arremesso, Combate com
Armas Grandes, Combate com Duas Armas, Combate Desarmado, Defensivo, Duelismo,
Interceptação, Luta às Cegas, Protetivo.

### 5. `extras_classe.truques_extra` é campo morto

`comum.js:290` e `:301` declaram que Taumaturgo (Clérigo) e Xamã (Druida)
concedem `{ truques_extra: 1 }`; `passo-classe.js:227`/`:234` gravam em
`personagem.extras_classe`. **Nenhum arquivo de `site/js/` lê `extras_classe`**
(grep) — o truque extra nunca é concedido.

### 6. A superfície de passivas é grande e escrita à mão

`site/js/sheet/habilidades.js` tem 4.697 linhas e **171 nomes de característica
em ramos `f.nome === '...'`**, dos quais 48 são de classe base e 132 de
subclasse. As subclasses estão **fora** desta rodada.

## Escopo

### Dentro
- Os ~15 direitos de troca de **classe base**, confrontados na camada em que são
  observáveis (ver "Onde cada confronto vive").
- A classificação Ativa/Passiva de **toda característica de classe base das 12
  classes**, contra o livro.
- Os efeitos **numéricos** de passiva de classe base (CA, deslocamento, ataques
  por ação, iniciativa, CD de magia, bônus de perícia), confrontados contra o
  livro.
- Flags e campos declarados sem consumidor, quando o livro descreve efeito real.
- **Depois de reportar: corrigir todas as lacunas de classes ainda abertas** —
  as 3 já registradas na entrega anterior mais as novas.

### Fora, declarado
- As 48 subclasses e suas 132 ramificações em `habilidades.js`. Continua sendo a
  dependência declarada da rodada seguinte.
- Trocas de subclasse (Bardo `:772`, Guardião `:3543`/`:3551`, Cavaleiro Místico
  `:3932`/`:3966`, Trapaceiro Arcano `:4461`/`:4471`, Paladino `:5539`).
- Cláusulas de "substituir" **de combate** (substituir um ataque por um truque)
  — são regra de mesa, não estado do personagem, e o app não modela turno.

## Onde cada confronto vive

A lição do domínio anterior vale de novo: não presuma que a divisão se repete.

| Confronto | Camada | Por quê |
|---|---|---|
| Existe mecanismo de troca? | unidade, sobre `escolhas_classe`/`opcoes` | é estado do personagem |
| A troca é oferecida ao subir? | unidade via `escadaDeNivel` **só para o padrão `opcoes`** | o padrão de mutação direta em `levelup-ui.js` é invisível aqui |
| Troca de magia/truque | **declarada fora de escopo de asserção**, com o motivo escrito | ver achado 1; asserção aqui seria cega e produziria lacuna falsa |
| `ehHabilidadeAtiva` × livro | unidade, varredura exaustiva | função pura, domínio finito |
| Efeitos numéricos de passiva | unidade, contra `utils.js`/`combate.js`/`talentos-effects.js` | funções puras |
| Flag sem consumidor | unidade, por varredura de `site/js/` | é fato sobre o código, verificável sem navegador |
| Texto de efeito na ficha | unidade, comparando os dois vocabulários | é mapa de dados, não render |

## Como as lacunas serão fechadas (fase 2)

Reportar primeiro; corrigir depois **todas** as lacunas de classes abertas. A
correção segue a lição registrada no guia: quando a regra é imposta por checagem
escrita à mão duplicada em vários fluxos, o conserto certo é mover a regra para
o mecanismo declarativo que todos já consultam — não copiar a checagem mais uma
vez. Concretamente:

- Os 3 vocabulários de Estilo de Luta viram **um**, com origem em
  `dados/talentos/talentos.json` (categoria "de Estilo de Luta"), que já é a
  fonte canônica do livro.
- A troca de Estilo de Luta do Guerreiro entra pelo padrão `opcoes` →
  `subirDeNivel`, o mesmo da manobra, para ficar observável por teste.

## Critérios de pronto

- Suíte de unidade verde, com o total novo registrado no README.
- Teste de mutação por motor novo.
- Toda lacuna com `tipo`, `motivo` citando arquivo e linha dos dois lados, e
  consequência **medida**.
- Todo limite de cobertura declarado por escrito — em especial o da troca de
  magia/truque, que é invisível ao motor de unidade.
- Paridade continua em 329 testes/10 arquivos.
- Fase 2: as lacunas corrigidas saem da lista pela mecânica de `comLacuna`, não
  por remoção manual.
