# Auditoria de itens duplicados (comum x mágico)

Gerado por `scripts/auditar_itens_duplicados.py`. Não editar a mão as seções A, B e C; a seção D (análise de impacto) é escrita à mão e o script a preserva ao regerar o arquivo.

## A. Mesmo nome exato

- **Pergaminho Mágico (1º Círculo)** — também em: `equipamento_aventura`
- **Pergaminho Mágico (Truque)** — também em: `equipamento_aventura`
- **Poção de Cura** — também em: `equipamento_aventura`

## B. Reaproveita registro do livro (`livro_jogador`)

- **Pergaminho Mágico (1º Círculo)** → `equipamento_aventura` / "Pergaminho Mágico (1º Círculo)"
- **Pergaminho Mágico (Truque)** → `equipamento_aventura` / "Pergaminho Mágico (Truque)"
- **Poção de Cura** → `equipamento_aventura` / "Poção de Cura"

## C. Nome comum contido no nome mágico (informativo)

- Aljava de Ehlonna ~ Aljava
- Armadura de Placas Anã ~ Armadura de Placas
- Armadura de Placas da Etereidade ~ Armadura de Placas
- Azagaia do Relâmpago ~ Azagaia
- Baliza de Pesca ~ Baliza
- Baliza Retrátil ~ Baliza
- Bola de Cristal ~ Cristal
- Bola de Cristal da Visão Verdadeira ~ Cristal
- Bola de Cristal de Leitura Mental ~ Cristal
- Bola de Cristal de Telepatia ~ Cristal
- Cadeado Ardiloso ~ Cadeado
- Cajado da Cura ~ Cajado
- Cajado da Píton ~ Cajado
- Cajado da Víbora ~ Cajado
- Cajado das Flores ~ Cajado
- Cajado das Florestas ~ Cajado
- Cajado de Pios de Pássaros ~ Cajado
- Cajado do Acrobata ~ Cajado
- Cajado do Adorno ~ Cajado
- Cajado do Definhamento ~ Cajado
- Cajado do Encantamento ~ Cajado
- Cajado do Enxame de Insetos ~ Cajado
- Cajado do Fogo ~ Cajado
- Cajado do Gelo ~ Cajado
- Cajado do Impacto ~ Cajado
- Cajado do Poder ~ Cajado
- Cajado do Trovão e Relâmpago ~ Cajado
- Cajado dos Magos ~ Cajado
- Cajado Encantado ~ Cajado
- Cajado Encantado (1º Círculo) ~ Cajado
- Cajado Encantado (2º Círculo) ~ Cajado
- Cajado Encantado (3º Círculo) ~ Cajado
- Cajado Encantado (4º Círculo) ~ Cajado
- Cajado Encantado (5º Círculo) ~ Cajado
- Cajado Encantado (6º Círculo) ~ Cajado
- Cajado Encantado (7º Círculo) ~ Cajado
- Cajado Encantado (8º Círculo) ~ Cajado
- Cajado Encantado (Truque) ~ Cajado
- Cimitarra da Velocidade ~ Cimitarra
- Clava Grande Trovejante ~ Clava Grande
- Cota de Malha do Efreeti ~ Cota de Malha
- Cota de Malha Élfica ~ Cota de Malha
- Couro Batido Ilusório ~ Couro Batido
- Escudo +1 ~ Escudo
- Escudo +1, +2 ou +3 ~ Escudo
- Escudo +2 ~ Escudo
- Escudo +3 ~ Escudo
- Escudo Animado ~ Escudo
- Escudo Apanha-Flechas ~ Escudo
- Escudo de Atração de Projéteis ~ Escudo
- Escudo de Expressão ~ Escudo
- Escudo do Cavaleiro ~ Escudo
- Escudo Guarda-Magia ~ Escudo
- Escudo Sentinela ~ Escudo
- Espelho Aprisionador de Vidas ~ Espelho
- Frasco de Ferro ~ Frasco
- Grilhões Dimensionais ~ Grilhões
- Loriga de Escamas de Dragão ~ Loriga de Escamas
- Mochila Prática de Heward ~ Mochila
- Munição +1 ~ Munição
- Munição +1, +2 ou +3 ~ Munição
- Munição +2 ~ Munição
- Munição +3 ~ Munição
- Munição Assassina ~ Munição
- Munição Derrubadora ~ Munição
- Pena Simbólica de Quaal (chicote) ~ Chicote
- Perfume do Enfeitiçamento ~ Perfume
- Pergaminho de Invocação de Titã ~ Pergaminho
- Pergaminho de Proteção ~ Pergaminho
- Pergaminho Mágico ~ Pergaminho
- Pergaminho Mágico (2º Círculo) ~ Pergaminho
- Pergaminho Mágico (3º Círculo) ~ Pergaminho
- Pergaminho Mágico (4º Círculo) ~ Pergaminho
- Pergaminho Mágico (5º Círculo) ~ Pergaminho
- Pergaminho Mágico (6º Círculo) ~ Pergaminho
- Pergaminho Mágico (7º Círculo) ~ Pergaminho
- Pergaminho Mágico (8º Círculo) ~ Pergaminho
- Pergaminho Mágico (9º Círculo) ~ Pergaminho
- Poção de Cura (maior) ~ Poção de Cura
- Poção de Cura (superior) ~ Poção de Cura
- Poção de Cura (suprema) ~ Poção de Cura
- Tridente do Comando de Peixes ~ Tridente
- Túnica das Cores Cintilantes ~ Túnica
- Túnica das Estrelas ~ Túnica
- Túnica de Itens Úteis ~ Túnica
- Túnica de Olhos ~ Túnica
- Túnica dos Arquimagos ~ Túnica
- Varinha da Imobilização ~ Varinha
- Varinha da Paralisia ~ Varinha
- Varinha da Polimorfia ~ Varinha
- Varinha da Regência ~ Varinha
- Varinha da Teia ~ Varinha
- Varinha das Maravilhas ~ Varinha
- Varinha de Bolas de Fogo ~ Varinha
- Varinha de Detecção de Inimigos ~ Varinha
- Varinha de Detecção de Magia ~ Varinha
- Varinha de Mísseis Mágicos ~ Varinha
- Varinha de Orcus ~ Varinha
- Varinha de Pirotecnia ~ Varinha
- Varinha de Relâmpagos ~ Varinha
- Varinha do Mago de Guerra +1 ~ Varinha
- Varinha do Mago de Guerra +1, +2 ou +3 ~ Varinha
- Varinha do Mago de Guerra +2 ~ Varinha
- Varinha do Mago de Guerra +3 ~ Varinha
- Varinha do Medo ~ Varinha
- Varinha dos Segredos ~ Varinha

## D. Impacto de remover o comum

Escrita à mão (o script regera A, B e C e preserva esta seção). Todas as afirmações abaixo foram conferidas no código em 2026-10-05.

| Item | Onde o comum aparece hoje | Criação de personagem | Fichas existentes | Substituição | Recomendação |
|---|---|---|---|---|---|
| `Pergaminho Mágico (Truque)` e `(1º Círculo)` | `equipamento_aventura.json` (30 PO / 50 PO). **Estado atual:** a listagem de Equipamento os esconde só na ficha (`ctx.permitirMagicos`, `ehPergaminhoMagico` em `site/js/itens-seletor.js`), onde existe a categoria Itens Mágicos. No criador, que não tem essa categoria, continuam listados em Equipamento. | Sem uso: `grep "Pergaminho Mágico" site/js/creator/*.js` volta vazio. Os pacotes de `creator/comum.js` usam o `Pergaminho` simples. | Quem comprou tem `tipo:'equipamento'`, nome idêntico e `dados` = registro do livro. Os dois caminhos de adição agrupam por nome + tipo (`itens-seletor.js` linha ~508 e `adicionarAoInventario` em `itens-magicos-ui.js`), então não há o que migrar. | Já feita: só a listagem some; o registro fica no JSON porque a variante do acervo o referencia (`livro_jogador`). | Concluído na Task 4 (só na ficha). O criador mantém a listagem. |
| `Poção de Cura` | **Estado atual:** continua listada na categoria Equipamento (não está em `ITENS_CONSUMIVEIS`, que tem só Ácido, Água Benta, Antitoxina, Fogo Alquímico, Óleo e Veneno Básico) e também em Itens Mágicos (variante-base). | Sem uso: `grep "Poção de Cura" site/js/creator/*.js dados/classes/*.json` volta vazio; não há pasta `dados/antecedentes*` (as origens ficam em `dados/origens`, sem ocorrência). Ocorrências em `dados/`: `equipamento_aventura.json` (registro), `ferramentas.json` (lista de fabricação do Kit de Herbalismo), `capitulo1_regras.json` (texto corrido), arquivos do LdM cap. 7. | O registro é o mesmo nos dois caminhos (`tipo:'equipamento'`, mesmo nome e `dados`); ambos agrupam por nome + tipo, então comprar por um caminho e adicionar pelo outro soma na mesma linha. Nada a migrar. | Esconder da listagem de Equipamento e manter só em Itens Mágicos (as variantes "(maior)", "(superior)", "(suprema)" já só existem lá). Sem remoção no JSON. | **Pendente de aprovação do dono** (Step 5 da Task 6, não executado). O criador (`creator/passo-equipamento.js`) chama `abrirSeletorItens` sem `permitirMagicos`, logo não tem Itens Mágicos. Para não tirar a poção do criador, aplicar o filtro só quando `ctx.permitirMagicos`, como já é feito com o Pergaminho Mágico. |
| Pares da seção C | n/d | n/d | n/d | n/d | Nenhuma ação: são base × versão encantada. |

### Testes que citam os nomes de A

- `testes/e2e/regras/itens-magicos.spec.mjs`: "Poção de Cura comum pela categoria mágica soma na mesma linha da mochila" usa a categoria mágica; não depende da listagem de Equipamento, não quebra se a poção sair dela.
- `testes/regras/unidade/itens-magicos-catalogo.test.mjs`: testa o registro do livro reaproveitado (`dados`), não a listagem; não quebra.
- `testes/regras/unidade/livro-do-mestre-capitulo7.test.mjs`: cita "Poção de Cura" só em fixtures e `slug()`; não quebra.
- `testes/regras/unidade/pergaminho-magico.test.mjs`, `testes/e2e/regras/pergaminho-magico.spec.mjs`, `testes/e2e/regras/item-magico-preco-informado.spec.mjs` (Tasks 4 e 5): já refletem o pergaminho fora da listagem.
- `testes/regras/unidade/itens-duplicados-catalogo.test.mjs`: guarda desta auditoria; `DUPLICATAS_CONHECIDAS` só pode encolher.
