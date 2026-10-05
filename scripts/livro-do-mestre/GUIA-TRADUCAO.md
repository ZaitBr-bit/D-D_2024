# Guia de tradução — Livro do Mestre, capítulo 7 (Tesouros)

Fonte: as páginas RENDERIZADAS do PDF (`pdf_capitulo7.py renderizar`), lidas
visualmente. A camada OCR do PDF não é fonte de texto: serve só de oráculo
(`oraculo_ocr_capitulo7.json`). Página do PDF − 4 = página impressa.

## Fluxo de um lote

1. Ler cada página da faixa do lote (imagem `pNNN.jpg`), na ordem, coluna esquerda e depois direita.
2. Um item pertence ao lote em que está o CABEÇALHO (nome em versalete + linha de tipo em itálico).
   O último item é lido até o fim, mesmo passando da faixa. Item cujo cabeçalho está antes da
   faixa NÃO entra (é do lote anterior), mesmo que o texto continue na primeira página.
3. Transcrever e traduzir direto para o JSON do lote (`dados/livro-do-mestre/capitulo7/_lotes/lote-NN.json`).
4. `node scripts/livro-do-mestre/capitulo7.mjs verificar --lote NN` até zerar os ERROS.
   Divergência do oráculo OCR: abrir a imagem da página e decidir. Se o acervo está certo e o OCR
   errou (linha de tipo ilegível, dado lido como "1410"), registrar em `excecoes_oraculo.json` com
   motivo concreto ("OCR leu 'Wondrous Iter'"). Nunca registrar exceção sem olhar a imagem.
   Causa comum (vista no lote 01, pág. 231): linha de tipo cuja raridade quebra para a linha seguinte
   ("Weapon (Any Ammunition or Melee Weapon)," / "Uncommon") não é contada pelo OCR → exceção `tipo`.
   Aviso de dado/CD na primeira página do lote vindo de texto do lote anterior: deixar como aviso.
5. Avisos de itálico não resolvido no modo `--lote` são aceitos só quando o itálico é nome de item de
   OUTRO lote; listar esses termos em `pendencias` do lote.

## Esquema do lote

```json
{
  "lote": "NN",
  "tipo": "itens",
  "paginas_pdf": [231, 238],
  "itens": [
    {
      "nome": "Anel de Proteção",
      "nome_en": "Ring of Protection",
      "pagina_pdf": 293,
      "pagina_pdf_fim": 293,
      "tipo": "Anel",
      "subtipo": "",
      "raridade": "Rara",
      "requer_sintonizacao": true,
      "requisito_sintonizacao": "",
      "linha_tipo": "Anel, Raro (Requer Sintonização)",
      "amaldicoado": false,
      "descricao": "Você recebe +1 de bônus na Classe de Armadura e nas salvaguardas enquanto usa este anel.",
      "tabelas": [],
      "variantes": []
    }
  ],
  "pendencias": []
}
```

- `tipo`: Anel, Arma, Armadura, Bastão (Rod), Cajado (Staff), Item Maravilhoso (Wondrous Item),
  Pergaminho (Scroll), Poção (Potion), Varinha (Wand).
- `subtipo`: o parêntese da linha de tipo, traduzido ("Espada Longa", "Qualquer Arma Simples ou
  Marcial", "Qualquer Armadura Média ou Pesada, exceto Gibão de Peles"). Vazio se não houver.
  O subtipo sempre nomeia a categoria explicitamente, mesmo quando o inglês a omite ("Any Light, Medium,
  or Heavy" → "Qualquer Armadura Leve, Média ou Pesada"; "Qualquer Arma Simples ou Marcial",
  "Qualquer Munição", "Qualquer Armadura Leve"). A `linha_tipo` usa o mesmo texto no parêntese.
- `raridade`: Comum, Incomum, Rara, Muito Rara, Lendária, Artefato; `Varia` quando o livro diz
  "Rarity Varies" OU lista mais de uma raridade (aí `variantes` é obrigatório).
- `requisito_sintonizacao`: o "by a ..." traduzido ("por um Mago", "por um Clérigo ou Paladino"); vazio se não houver.
- `amaldicoado`: true se a descrição tem a seção *Curse* / diz que o item é amaldiçoado.
- `descricao`: markdown. Parágrafos separados por linha em branco. Subtítulo em linha (run-in) como
  `***Maldição.*** texto`. Lista com `- `. Proibido: `>`, `---`, itálico com `_`, `|`, HTML.
- `tabelas`: `[{"titulo": "...", "cabecalhos": ["1d100", "Efeito"], "dados": [["01–05", "..."]]}]`.
  Toda tabela do item vai aqui (não em markdown). Cada linha com o mesmo número de colunas dos cabeçalhos.
- `variantes`: `[{"nome": "...", "nome_en": "...", "raridade": "..."}]`, uma por grau/tipo que o
  livro nomeia. Nome da variante:
  - Grau entre parênteses, em minúscula, concordando com o nome: "Poção de Cura (maior)",
    "Cinturão de Força do Gigante (das colinas)". `nome_en` no mesmo molde: "Potion of Healing (greater)",
    "Belt of Giant Strength (hill)".
  - Bônus: "Arma +1", "Armadura +2", "Bastão do Guardião do Pacto +1"; `nome_en` "Weapon +1".
  - Pergaminho Mágico: "Pergaminho Mágico (Truque)", "Pergaminho Mágico (1º Círculo)" … "(9º Círculo)";
    `nome_en` "Spell Scroll (Cantrip)", "Spell Scroll (Level 1)" … "(Level 9)".
  - Poção de Cura: o item se chama "Poções de Cura" (`nome_en` "Potions of Healing", plural impresso no livro);
    as variantes são "Poção de Cura" (`nome_en` "Potion of Healing"), "Poção de Cura (maior)", "(superior)" e "(suprema)".
    `id` (slug do nome) e `nome` são únicos entre todos os itens e variantes; item e variante nunca repetem o nome.
- `livro_jogador`: só em item/variante que já existe no Livro do Jogador:
  `{"arquivo": "equipamento_aventura", "nome": "Poção de Cura"}`. Hoje: Poção de Cura,
  Pergaminho Mágico (Truque), Pergaminho Mágico (1º Círculo). O nome é o do Livro do Jogador, letra por letra.

Lote de regras (`"tipo": "regras"`) usa `secoes` e `tesouros` em vez de `itens`:
`secoes: [{"titulo", "titulo_en", "nivel" (1-3), "pagina_pdf", "pagina_pdf_fim", "pagina"?, "pagina_fim"?, "texto", "tabelas"}]`;
`tesouros: [{"nome", "nome_en", "categoria" ("Gema"|"Obra de Arte"|"Barra Comercial"), "valor" ("10 PO"), "descricao", "pagina_pdf", "pagina_pdf_fim", "pagina"?, "pagina_fim"?}]`.

`pagina` e `pagina_fim` (opcionais, inteiros, números IMPRESSOS) valem em item, seção e tesouro. Quando presentes,
`montar` os usa no lugar de "pagina_pdf − 4". Servem para as páginas 217–231 do PDF, que estão fora da ordem
impressa (impressa → PDF: 213→217, 214→218, 215→223, 216→219, 217→224, 218→220, 219→225, 220→221, 221→226,
222→222, 223→227, 224→228, 225→229, 226→230, 227→231). `pagina_pdf` continua sendo a página do PDF.

Lote de tabelas (`"tipo": "tabelas"`): `tabelas_aleatorias: [{"tema", "tema_en", "raridade", "dado": "1d100",
"entradas": [{"min": 1, "max": 2, "item": "<nome PT exato do acervo>", "variantes": ["<nome PT exato>"], "texto": "<como impresso, traduzido>"}]}]`
(00 = 100) e `itens_fora_das_tabelas: [{"item", "motivo"}]`.

## Convenções (medidas no Livro do Jogador já extraído)

- 2ª pessoa ("você"), como `dados/magias/`.
- Termos de regra com maiúscula: Vantagem, Desvantagem, Ação Bônus, Reação, Pontos de Vida,
  Pontos de Vida Temporários, Classe de Armadura, Bônus de Proficiência, Descanso Curto/Longo,
  Inspiração Heroica, Sintonização, Deslocamento, Visão no Escuro, Visão às Cegas, Sismiconsciência,
  Visão Verdadeira, Teleporte, Terreno Difícil.
- Ações: Magic → **ação Usar Magia**; Utilize → **ação Usar Objeto**; Attack → ação Atacar;
  Dash → Correr; Disengage → Desengajar; Dodge → Esquivar; Help → Ajudar; Hide → Esconder;
  Influence → Influenciar; Ready → Preparar; Search → Procurar; Study → Analisar.
- saving throw → salvaguarda ("salvaguarda de Sabedoria CD 15"); ability check → teste de atributo;
  attack roll → jogada de ataque; DC → CD; "next dawn" → "próximo amanhecer".
- Condições: "tem a condição Amedrontado". Amedrontado, Atordoado, Caído, Cego, Contido, Enfeitiçado,
  Envenenado, Exaustão, Imobilizado, Incapacitado, Inconsciente, Invisível, Paralisado, Petrificado, Surdo.
- Áreas: Cone, Cubo, Cilindro, Emanação, Esfera, Linha.
- Dano: Ácido, Contundente, Cortante, Elétrico, Energético (Force), Gélido, Ígneo, Necrótico,
  Perfurante, Psíquico, Radiante, Trovejante, Venenoso — "2d6 de dano Ígneo".
- Tipos de criatura (glossário): Aberração, Fera (Beast — não "Besta"), Celestial, Constructo, Dragão,
  Elemental, Feérico, Gigante, Humanoide, Ínfero, Monstruosidade, Morto-Vivo, Gosma, Planta.
  Plural: Feras, Mortos-Vivos, Ínferos, Gosmas.
- Classes: Bárbaro, Bardo, Bruxo, Clérigo, Druida, Feiticeiro, Guardião (Ranger), Guerreiro, Ladino,
  Mago, Monge, Paladino.
- Moedas: PC, PP, PE, PO, PL (cobre, prata, electrum, ouro, platina).
- Unidades métricas como o Livro do Jogador: 5 pés = 1,5 metro; 10 = 3 m; 15 = 4,5 m; 20 = 6 m;
  30 = 9 m; 60 = 18 m; 90 = 27 m; 120 = 36 m; 300 = 90 m (regra: pés × 0,3); 1 milha = 1,5 km;
  1 libra = 0,5 kg; 1 galão = 4 litros; 1 quarto = 1 litro; 1 onça = 30 ml; °F → °C. Escrever
  "9 metros", "1,5 metro".
- Raridade na `linha_tipo` concorda com o tipo ("Anel, Raro"; "Poção, Rara"); no campo `raridade`
  é sempre a forma da lista (feminina).
- Itálico `*...*` só para nome de magia, de item mágico ou título de livro. Nome de magia: o de
  `dados/magias/_indice.json` letra por letra (achar pelo círculo/escola em `dados/magias/circulo_N.json`
  quando o nome em inglês não for óbvio). Nome de criatura em **negrito**, como no livro.
- Nomes de item: tradução própria e consistente; reusar os nomes que o Livro do Jogador já usa
  (Poção de Cura, Pergaminho Mágico, Anel de Proteção, Anel de Queda Suave, Anel de Natação) e os
  nomes de arma/armadura de `dados/equipamento/armas.json` e `armaduras.json` no `subtipo`.
- Ilegível na imagem: transcrever o que der e registrar em `pendencias` com página e trecho.

## Padrões fixados no lote 01 (piloto)

- Medidas fora da tabela acima: 1 polegada = 2,5 cm (3/4 pol = 1,9 centímetro); onça de PESO = 30 g
  ("pesa 30 gramas"); 1 pint = 0,5 litro; meia libra = 0,25 kg; 1 pé cúbico = 27 litros; volumes maiores:
  pés³ × 0,027 m³ (64 pés cúbicos = 1,7 metro cúbico); "2 feet square" = "0,6 metro de lado".
  Peso em "kg" ("6 kg"); volume em "litros"/"ml" ("240 ml", "16 litros").
- Estatísticas de objeto/veículo e linhas de ataque seguem `dados/apendices/criaturas.json`, com "m":
  "CA 20; PV 200; Deslocamento 9 m, Natação 9 m"; "+8 para acertar, alcance 1,5 m. Acerto: 7 (2d6) de dano
  Contundente." "Hit:" vira "Acerto:" SEM itálico, porque o verificador só aceita itálico em nome de magia,
  de item ou de livro. É exceção declarada ao formato de `criaturas.json`, que usa "*Acerto:*"/"*Dano:*".
- DM → "Mestre". roll → jogar: "jogando 1d100", "jogue um dado qualquer", "Com um resultado ímpar";
  "on a **1**, X" → "com **1**, X" (o negrito do número é mantido).
- Teste com perícia: "teste de Inteligência (Arcanismo) CD 15"; "teste de Força (Atletismo) CD 20 bem-sucedido".
  Grappled → condição Imobilizado ("CD 15 para escapar"). Alinhamento: "Caótico e Mau", "Caótico e Bom".
  Idioma: "Anão" ("Você conhece o idioma Anão"). Ferramentas: nomes de `dados/equipamento/ferramentas.json`
  (Suprimentos de Cervejeiro, Ferramentas de Pedreiro, Ferramentas de Ferreiro). Rations → Rações.
- Planos: nomes de `dados/apendices/multiverso.json` — Plano Elemental do Ar/da Terra/do Fogo/da Água
  (também para "Plane of Air"), Faéria (Feywild), Sombral (Shadowfell), Plano Astral, Plano Interno/Externo,
  Abismo, Aqueronte, Arbórea, Arcádia, Bitopia, Cárceri, Elísio, Gehenna, Hades, Limbo, Mecânos,
  Monte Celéstia, Nove Infernos, Pandemônio, Terras Ferais (Beastlands), Ysgard.
- Frases fixas: "Resistência/Imunidade a dano Contundente, Perfurante e Cortante"; "sofrendo 6d10 de dano
  Energético adicional se falhar ou metade desse dano em caso de sucesso"; "Esfera de 3 metros de raio";
  "Luz Plena em um raio de 9 metros e Meia-luz por mais 9 metros"; "age imediatamente após você na sua
  contagem de Iniciativa"; "propriedade Arremesso, com alcance normal de 6 metros e alcance máximo de 18 metros";
  "Visão no Escuro com alcance de 18 metros"; archfey → arquifada; command word → palavra de comando.
- Tabela impressa em duas metades lado a lado (1d100 | X | 1d100 | X) vira UMA tabela de 2 colunas, na ordem
  do dado. Tabela sem título impresso: `"titulo": ""`. Faixa com traço meia-risca: "01–10", "91–00".
- Lista com rótulo em negrito e recuo pendente ("Darkvision. You gain…") vira lista markdown:
  `- **Visão no Escuro.** Você ganha…`. Marcador "·" vira `- `. Subtítulo em itálico negrito do livro
  (*Metal Shell.*) vira `***Carapaça Metálica.***`, na ordem em que aparece (coluna esquerda, depois direita).
- Item "X, +1, +2, or +3": `nome` "Munição +1, +2 ou +3", `nome_en` "Ammunition, +1, +2, or +3"; variantes
  "Munição +1" ("Ammunition +1")… `linha_tipo` "Arma (Qualquer Munição), Incomum (+1), Rara (+2) ou Muito Rara (+3)".
- Tipo nomeado só por título de tabela (Gray/Rust/Tan Bag of Tricks) vira variante mesmo com a mesma
  raridade: "Bolsa de Truques (cinza)" / "Bag of Tricks (gray)".
- Item citado no plural ("1d4 + 4 *Beads of Force*"): manter o nome exato no singular para o itálico resolver
  ("1d4 + 4 exemplares de *Conta de Força*").
- Criatura em negrito sem bloco no repositório: Ente (Treant), Fungo Guinchador (Shrieker Fungus),
  Múmia, Senhor das Múmias (Mummy Lord), Bulette, Vassoura Animada (Animated Broom), Elemental da Terra.
  Criatura comum: o nome de `dados/apendices/criaturas.json` (Doninha, Mastim, Lobo Atroz, Gorila = Ape…).
- Nomes de item já fixados — usar letra por letra em itálico em qualquer lote:
  Bolsa Devoradora (Bag of Holding), Bolsa Gulosa (Bag of Devouring) — nomes tradicionais das edições
  Devir/Galápagos, decisão do controlador —, Bolsa de Truques (Bag of Tricks),
  Bolsa de Feijões (Bag of Beans), Conta de Força (Bead of Force), Machado dos Senhores Anões,
  Aparato de Kwalish, Amuleto dos Planos, Munição Assassina (Ammunition of Slaying), Escudo Animado,
  Escudo Apanha-Flechas, Armadura/Arma de Adamantina, Jarro Alquímico. Citados no lote 01 e a traduzir
  depois COM ESTE NOME: Mochila Prática de Heward (Heward's Handy Haversack), Buraco Portátil (Portable Hole).
  Antes de nomear um item, procurar o `nome_en` nos lotes já escritos.

## Convenções fixadas nos lotes do capítulo 7 (seguir nos capítulos seguintes)

- `linha_tipo` com "Rarity Varies" → "Raridade Variável".
- Subtítulo "Regaining Charges." → `***Recuperando Cargas.***`.
- "spell save DC" → "CD para evitar sua magia"/"CD para evitar suas magias" (forma do Livro do Jogador).
  Nunca "CD de salvaguarda das suas magias".
- CD de salvaguarda citada logo após uma magia usa sempre "(salvaguarda CD N)", nunca "(CD N para a salvaguarda)"
  nem "(CD N para evitar)". Com complemento: "(salvaguarda CD 17, +9 de bônus de ataque)". "Salvaguarda de Destreza CD 15" (jogada de salvaguarda) não muda.
- "lightly obscured" → "Parcialmente Obscurecido" (termo do glossário), nunca "Levemente Obscurecido".
- Robe → "Túnica".
- Quarterstaff (arma) → "Cajado" (nome da arma no Livro do Jogador).
- O `nome` do item nunca leva apelido entre parênteses. O apelido entra na primeira frase da `descricao`
  ("Enquanto esta ágata polida, também chamada de Pedra da Sorte, estiver com você, …"); `nome_en` mantém o nome do livro.
