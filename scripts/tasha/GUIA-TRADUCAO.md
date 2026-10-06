# Guia de tradução — Artífice (dados/tasha/artifice/_lotes)

## Fonte
Texto do PDF em inglês, gerado com `python -I scripts/tasha/pdf_artifice.py texto <ini> <fim> <arquivo>`.
Tabelas são conferidas na imagem (`renderizar`). O .md em Informacoes Separadas é só apoio.

## Esquema dos lotes
- lote-00 (`tipo: "classe"`, paginas_pdf [10, 19]): `classe` = { nome: "Artífice", nome_en: "Artificer",
  tracos_basicos: { "Atributo Primário", "Equipamento Inicial" }, tabela_caracteristicas: 20 linhas com as chaves
  "Nível", "Bônus de Proficiência", "Características", "Planos Conhecidos", "Itens Mágicos", "Truques",
  "Magias Preparadas", "1".."5" (strings; traço = "—"), caracteristicas: [{ nivel, nome, nome_en, descricao,
  pagina_pdf }], lista_magias: { "Truques": [{ nome_en, escola, especial }], "1º Círculo": [...] ... "5º Círculo": [...] } };
  `planos` = [{ nivel_minimo, nome_en, requer_sintonizacao, item_id?, variante_id?, livro?, generico? }].
- lote-01/02/03 (`tipo: "subclasses"`): `subclasses` = [{ nome, nome_en, descricao, caracteristicas: [{ nivel, nome,
  nome_en, descricao, pagina_pdf }] }]. O lote-03 traz também `magias` (Servo Homúnculo) e `criaturas`.
- lote-04 (`tipo: "itens"`, paginas_pdf [136, 144]): `itens` no esquema do acervo do Livro do Mestre
  (`nome`, `nome_en`, `tipo`, `subtipo`, `raridade`, `requer_sintonizacao`, `requisito_sintonizacao`, `linha_tipo`,
  `amaldicoado`, `descricao`, `tabelas`, `variantes`, `pagina_pdf`, `pagina_pdf_fim`) mais `efeitos`, `recursos`
  e `base` decididos por `scripts/livro-do-mestre/GUIA-MECANICA.md`.

## Convenções que o motor do site lê
- Magias de subclasse: tabela markdown, uma linha por nível, nomes em itálico separados por vírgula:
  "| **Nível de Artífice** | **Magias** |" / "|---|---|" / "| 3 | *Palavra Curativa, Raio Nauseante* |".
  A frase antes da tabela tem "sempre" e "preparadas".
- Conjuração grátis: "sem gastar um espaço de magia".
- Magia que o livro deixa conjurar "sem preparar" (Reagentes Restauradores, Maestria Química, Atlas Superior):
  escrever "Você sempre tem a magia *X* preparada" na mesma frase da concessão, seguido de "e pode conjurá-la sem
  gastar um espaço de magia" (mesma construção do Mapa Estelar do Druida). O motor só põe a magia na lista com
  "preparad" + nome em itálico; "sem preparar a magia" não casa e a magia some da ficha.
- Usos: "um número de vezes igual ao seu modificador de Inteligência (mínimo de uma vez)" e
  "Você recupera todos os usos gastos ao terminar um Descanso Longo."
- Nome de magia em itálico (*Reparar*), sempre pelo glossário scripts/tasha/magias_en_pt.json.
- Termos de regra com maiúscula como no Livro do Jogador: Ação, Ação Bônus, Ação Mágica, Reação, Descanso Curto,
  Descanso Longo, Vantagem, Desvantagem, Pontos de Vida, Pontos de Vida Temporários, Sintonização, Foco de
  Conjuração, Deslocamento, Deslocamento de Voo, Meia-Cobertura, Meia-Luz, Ferido (Bloodied).
- Ferramentas pelo nome de site/js/creator/comum.js FERRAMENTAS_TODAS (Woodcarver's Tools = Ferramentas de
  Entalhador; Smith's Tools = Ferramentas de Ferreiro; Tinker's Tools = Ferramentas de Funileiro; Thieves' Tools =
  Ferramentas de Ladrão; Alchemist's Supplies = Suprimentos de Alquimista; Herbalism Kit = Kit de Herbalismo;
  Calligrapher's Supplies = Suprimentos de Calígrafo; Cartographer's Tools = Ferramentas de Cartógrafo).
- Tipos de dano: Ácido, Contundente, Cortante, Elétrico, Energético (Force), Gélido, Ígneo, Necrótico, Perfurante,
  Psíquico, Radiante, Trovejante, Venenoso.
- Subclasses: Alquimista (Alchemist), Armeiro (Armorer), Artilheiro (Artillerist), Ferreiro de Batalha (Battle Smith),
  Cartógrafo (Cartographer). Modelos do Armeiro: Couraçado (Dreadnought), Guardião (Guardian), Infiltrador (Infiltrator).
- Itens do Apêndice: Botas do Caminho Sinuoso, Arma Deslumbrante, Elmo da Prontidão, Ferramenta Multiforme,
  Afiador Mental, Disparo Repetido, Escudo de Repulsão, Arma Retornável, Anel de Reabastecimento de Magia.
