// ============================================================
// Progressão das 12 classes, transcrita do livro.
// Este catálogo segue `ficha-transversal.mjs`, não `talentos.mjs`:
// o livro traz TABELA fechada (20 linhas por classe), então o
// catálogo é transcrição e o confronto é varredura exaustiva —
// 12 classes × 20 níveis, sem amostragem.
//
// Fonte: `Informacoes Separadas/Classes.md`, uma tabela
// "Características de X" por classe.
//
// REGRA DURA: cada valor aqui foi lido da tabela do LIVRO. Nada foi
// copiado de `dados/classes/*.json` nem de `site/js/dados-classes.js`
// — são exatamente as duas fontes que os motores confrontam contra
// este arquivo. Um catálogo gerado a partir delas bateria 240/240 sem
// provar nada, porque o app estaria sendo comparado consigo mesmo.
// ============================================================

// Citação por classe. O heading de tabela existe para as 12 com este
// texto exato, apesar de o NÍVEL do heading variar (## para Bárbaro,
// ### para Bardo) — por isso lerHeadingsClasses() aceita # ## e ###.
//
// EXCEÇÃO: Paladino. As outras 11 classes têm a tabela de 20 níveis
// logo abaixo do heading "Características de Classe de X" -- por isso
// a citação delas aponta para esse heading. O Paladino quebra o
// padrão: em Classes.md ele tem DOIS headings parecidos, e é fácil
// citar o errado se você confiar no nome em vez de conferir onde a
// tabela está fisicamente.
//   - `## Características de Paladino` (Classes.md:5469) -- vem
//     IMEDIATAMENTE seguido pela tabela de 20 níveis (linhas 5471-5493).
//     É este heading que contém o dado transcrito neste catálogo.
//   - `## Características de Classe de Paladino` (Classes.md:5495) --
//     abre a PROSA das características ("### Nível 1: Conjuração", etc.),
//     não a tabela. A primeira frase dessa seção ("Essas características
//     estão apresentadas na tabela Características de Paladino")
//     inclusive remete de volta para a tabela que já apareceu acima, em
//     5469 -- confirmando que 5495 não é onde a tabela mora.
// A citação do Paladino aponta para 5469, a única das 12 que não segue
// o padrão "Características de Classe de X" dos outros nomes.
export const CITACOES = {
  'Bárbaro': 'Classes.md §Características de Classe de Bárbaro',
  'Bardo': 'Classes.md §Características de Classe de Bardo',
  'Bruxo': 'Classes.md §Características de Classe de Bruxo',
  'Clérigo': 'Classes.md §Características de Classe de Clérigo',
  'Druida': 'Classes.md §Características de Classe de Druida',
  'Feiticeiro': 'Classes.md §Características de Classe de Feiticeiro',
  'Guardião': 'Classes.md §Características de Classe de Guardião',
  'Guerreiro': 'Classes.md §Características de Classe de Guerreiro',
  'Ladino': 'Classes.md §Características de Classe de Ladino',
  'Mago': 'Classes.md §Características de Classe de Mago',
  'Monge': 'Classes.md §Características de Classe de Monge',
  'Paladino': 'Classes.md §Características de Paladino',
};

// Traços básicos, da tabela "Traços Básicos de X" de cada classe
// (Classes.md, logo abaixo do heading "## Tornando-se um X" de cada
// uma — linhas de referência no comentário de cada entrada abaixo).
// `periciasOpcoes: null` significa "qualquer perícia" (só o Bardo) —
// distinto de uma lista vazia, que significaria "nenhuma opção".
// `atributoPrimario` é transcrito como o livro escreve, inclusive
// quando são dois ("Destreza e Sabedoria", Guardião e Monge; "Força e
// Carisma", Paladino; "Força ou Destreza", Guerreiro).
// `salvaguardas` e `periciasOpcoes` estão em ordem alfabética (com
// acento), por exigência do motor que compara com o app — a ordem do
// livro nessas duas listas não é sempre alfabética.
// `atributoConjuracao` foi lido do parágrafo "Atributo de Conjuração"
// dentro da característica de Conjuração de cada classe conjuradora
// (não da tabela de Traços Básicos, que não traz esse campo).
// `armasRestricao` é `null` em 10 das 12 classes -- presente em todas,
// nunca ausente, porque o schema da Task 4 valida todo campo que
// existir e um campo ausente vira `undefined` silencioso. Só Ladino e
// Monge não recebem a categoria Marcial inteira: o livro restringe a
// uma propriedade específica de arma (ver comentário de cada uma). A
// categoria (`armas`) e a restrição (`armasRestricao`) ficam em campos
// separados de propósito -- juntá-las numa única string, como
// 'Marcial (Acuidade)', faria a comparação com o app depender da
// redação (que texto exato descreve a restrição) em vez do fato (quais
// categorias e quais propriedades). `CLASSES_INFO` no app expressa
// isso como uma string livre por classe ('Marcial (Acuidade)' para
// Ladino, 'Marcial (Leve)' para Monge) -- a Task 5 vai precisar
// comparar as duas dimensões (categoria e propriedade) separadamente,
// não fazer deepEqual de string contra este catálogo.
export const TRACOS_BASICOS = {
  // Classes.md:3-18. Sem conjuração.
  'Bárbaro': {
    dadoVida: 12,
    atributoPrimario: 'Força',
    salvaguardas: ['Constituição', 'Força'],
    numPericias: 2,
    periciasOpcoes: ['Atletismo', 'Intimidação', 'Lidar com Animais',
                     'Natureza', 'Percepção', 'Sobrevivência'],
    armaduras: ['Leve', 'Média', 'Escudo'],
    armas: ['Simples', 'Marcial'],
    armasRestricao: null,
    conjurador: false,
    atributoConjuracao: null,
  },
  // Classes.md:341-349. "Escolha quaisquer 3 perícias" -> periciasOpcoes
  // null (qualquer perícia), não uma lista fechada. Atributo de
  // conjuração confirmado em Classes.md:432.
  'Bardo': {
    dadoVida: 8,
    atributoPrimario: 'Carisma',
    salvaguardas: ['Carisma', 'Destreza'],
    numPericias: 3,
    periciasOpcoes: null,
    armaduras: ['Leve'],
    armas: ['Simples'],
    armasRestricao: null,
    conjurador: true,
    atributoConjuracao: 'Carisma',
  },
  // Classes.md:820-831. Atributo de conjuração confirmado em
  // Classes.md:910.
  'Bruxo': {
    dadoVida: 8,
    atributoPrimario: 'Carisma',
    salvaguardas: ['Carisma', 'Sabedoria'],
    numPericias: 2,
    periciasOpcoes: ['Arcanismo', 'Enganação', 'História', 'Intimidação',
                     'Investigação', 'Natureza', 'Religião'],
    armaduras: ['Leve'],
    armas: ['Simples'],
    armasRestricao: null,
    conjurador: true,
    atributoConjuracao: 'Carisma',
  },
  // Classes.md:1481-1490 (heading "Traços Básicos do Clérigo" sem
  // negrito, diferente das outras classes — ruído tipográfico, mesmo
  // conteúdo). Atributo de conjuração confirmado em Classes.md:1558.
  'Clérigo': {
    dadoVida: 8,
    atributoPrimario: 'Sabedoria',
    salvaguardas: ['Carisma', 'Sabedoria'],
    numPericias: 2,
    periciasOpcoes: ['História', 'Intuição', 'Medicina', 'Persuasão',
                     'Religião'],
    armaduras: ['Leve', 'Média', 'Escudo'],
    armas: ['Simples'],
    armasRestricao: null,
    conjurador: true,
    atributoConjuracao: 'Sabedoria',
  },
  // Classes.md:1965-1977. Perícias reordenadas alfabeticamente: o
  // livro lista "Arcanismo, Lidar com Animais, Intuição, Medicina...",
  // fora de ordem. Atributo de conjuração confirmado em Classes.md:2044.
  'Druida': {
    dadoVida: 8,
    atributoPrimario: 'Sabedoria',
    salvaguardas: ['Inteligência', 'Sabedoria'],
    numPericias: 2,
    periciasOpcoes: ['Arcanismo', 'Intuição', 'Lidar com Animais',
                     'Medicina', 'Natureza', 'Percepção', 'Religião',
                     'Sobrevivência'],
    armaduras: ['Leve', 'Escudo'],
    armas: ['Simples'],
    armasRestricao: null,
    conjurador: true,
    atributoConjuracao: 'Sabedoria',
  },
  // Classes.md:2575-2592. "Treinamento com Armaduras: Nenhuma" ->
  // armaduras []. Atributo de conjuração confirmado em Classes.md:2651.
  'Feiticeiro': {
    dadoVida: 6,
    atributoPrimario: 'Carisma',
    salvaguardas: ['Carisma', 'Constituição'],
    numPericias: 2,
    periciasOpcoes: ['Arcanismo', 'Enganação', 'Intimidação', 'Intuição',
                     'Persuasão', 'Religião'],
    armaduras: [],
    armas: ['Simples'],
    armasRestricao: null,
    conjurador: true,
    atributoConjuracao: 'Carisma',
  },
  // Classes.md:3218-3231. Atributo Primário do livro é duplo
  // ("Destreza e Sabedoria"), transcrito como está. Atributo de
  // conjuração confirmado em Classes.md:3292.
  'Guardião': {
    dadoVida: 10,
    atributoPrimario: 'Destreza e Sabedoria',
    salvaguardas: ['Destreza', 'Força'],
    numPericias: 3,
    periciasOpcoes: ['Atletismo', 'Furtividade', 'Intuição', 'Investigação',
                     'Lidar com Animais', 'Natureza', 'Percepção',
                     'Sobrevivência'],
    armaduras: ['Leve', 'Média', 'Escudo'],
    armas: ['Simples', 'Marcial'],
    armasRestricao: null,
    conjurador: true,
    atributoConjuracao: 'Sabedoria',
  },
  // Classes.md:3748-3761. Atributo Primário do livro é uma escolha
  // ("Força ou Destreza"), transcrito como está. Sem conjuração.
  'Guerreiro': {
    dadoVida: 10,
    atributoPrimario: 'Força ou Destreza',
    salvaguardas: ['Constituição', 'Força'],
    numPericias: 2,
    periciasOpcoes: ['Acrobacia', 'Atletismo', 'História', 'Intimidação',
                     'Intuição', 'Lidar com Animais', 'Percepção',
                     'Persuasão', 'Sobrevivência'],
    armaduras: ['Leve', 'Média', 'Pesada', 'Escudo'],
    armas: ['Simples', 'Marcial'],
    armasRestricao: null,
    conjurador: false,
    atributoConjuracao: null,
  },
  // Classes.md:4141-4155. "Proficiências com Armas" (linha 4152): "Armas
  // Simples e Armas Marciais que tem a propriedade Acuidade ou Leve" —
  // não é a categoria Marcial inteira, só um subconjunto por
  // propriedade. O livro cita DUAS propriedades (Acuidade e Leve), por
  // isso `armasRestricao` é um array aqui: uma arma marcial que tenha
  // qualquer uma das duas já cumpre a restrição. Sem conjuração.
  'Ladino': {
    dadoVida: 8,
    atributoPrimario: 'Destreza',
    salvaguardas: ['Destreza', 'Inteligência'],
    numPericias: 4,
    periciasOpcoes: ['Acrobacia', 'Atletismo', 'Enganação', 'Furtividade',
                     'Intimidação', 'Intuição', 'Investigação', 'Percepção',
                     'Persuasão', 'Prestidigitação'],
    armaduras: ['Leve'],
    armas: ['Simples', 'Marcial'],
    armasRestricao: { 'Marcial': ['Acuidade', 'Leve'] },
    conjurador: false,
    atributoConjuracao: null,
  },
  // Classes.md:4520-4543. "Proficiência com Armaduras: Nenhuma" ->
  // armaduras []. Atributo de conjuração confirmado em Classes.md:4612,
  // dentro da própria seção "### Nível 1: Conjuração" de Mago (não a
  // linha 3968, que fica dentro da subclasse Cavaleiro Místico do
  // GUERREIRO -- essa subclasse empresta a lista de magias de Mago e
  // repete a mesma frase, o que confunde uma busca por texto).
  'Mago': {
    dadoVida: 6,
    atributoPrimario: 'Inteligência',
    salvaguardas: ['Inteligência', 'Sabedoria'],
    numPericias: 2,
    periciasOpcoes: ['Arcanismo', 'História', 'Intuição', 'Investigação',
                     'Medicina', 'Religião'],
    armaduras: [],
    armas: ['Simples'],
    armasRestricao: null,
    conjurador: true,
    atributoConjuracao: 'Inteligência',
  },
  // Classes.md:5096-5110 (heading "Traços Básicos de Monge" sem
  // negrito -- mesmo ruído tipográfico do Clérigo). "Treinamento com
  // Armadura: Nenhuma" -> armaduras []. "Proficiências com Armas"
  // (linha 5107): "Armas Simples e Marciais que têm a propriedade
  // Leve" — mesmo caso do Ladino (subconjunto de Marcial por
  // propriedade), mas aqui o livro cita só UMA propriedade, por isso
  // `armasRestricao` é uma string, não array. Sem conjuração.
  'Monge': {
    dadoVida: 8,
    atributoPrimario: 'Destreza e Sabedoria',
    salvaguardas: ['Destreza', 'Força'],
    numPericias: 2,
    periciasOpcoes: ['Acrobacia', 'Atletismo', 'Furtividade', 'História',
                     'Intuição', 'Religião'],
    armaduras: [],
    armas: ['Simples', 'Marcial'],
    armasRestricao: { 'Marcial': 'Leve' },
    conjurador: false,
    atributoConjuracao: null,
  },
  // Classes.md:5434-5447. Atributo Primário do livro é duplo ("Força e
  // Carisma"), transcrito como está. Atributo de conjuração confirmado
  // em Classes.md:5513.
  'Paladino': {
    dadoVida: 10,
    atributoPrimario: 'Força e Carisma',
    salvaguardas: ['Carisma', 'Sabedoria'],
    numPericias: 2,
    periciasOpcoes: ['Atletismo', 'Intimidação', 'Intuição', 'Medicina',
                     'Persuasão', 'Religião'],
    armaduras: ['Leve', 'Média', 'Pesada', 'Escudo'],
    armas: ['Simples', 'Marcial'],
    armasRestricao: null,
    conjurador: true,
    atributoConjuracao: 'Carisma',
  },
};

// Só os NOMES das 48 subclasses, para provar bijeção com
// dados/classes/*.json → subclasses[].nome. As características de
// subclasse por nível são a rodada SEGUINTE deste domínio (ver o
// README de testes/regras/): este catálogo já traz o gancho onde elas
// serão penduradas, sem reprojetar nada.
// Nomes transcritos da frase "Esta seção apresenta as subclasses ..."
// logo abaixo de cada heading `# Subclasses de X` (ou `##` para Druida
// e Paladino, conforme o brief), em ordem alfabética.
//
// EXCEÇÃO (achado da Task 4): Bruxo e Paladino têm, cada um, uma
// subclasse com DUAS grafias no livro -- a frase de lista acima (a
// fonte padrão desta tabela) usa uma forma, e o heading que abre a
// própria seção da subclasse (onde o livro efetivamente a define) usa
// outra. Nos dois casos abaixo, o catálogo segue o HEADING da seção,
// não a frase de lista, porque é o heading que nomeia a subclasse ao
// defini-la -- a frase de lista é prosa de resumo, e é ela que está
// inconsistente consigo mesma (a mesma frase se repete em outro ponto
// do capítulo com a mesma variante "errada", ver os dois números de
// linha abaixo). Isto NÃO é "adotar a forma que dados/classes/*.json
// usa": dados/ coincidir com o heading é consequência de o heading ser
// a forma canônica, não o critério usado aqui.
//   - Bruxo: heading real `## Patrono O Grande Antigo` (Classes.md:1387).
//     A frase de lista (Classes.md:1297, e também Classes.md:920) omite
//     o "O": "Patrono Grande Antigo".
//   - Paladino: heading real `## Juramento da Vingança` (Classes.md:5805).
//     A frase de lista (Classes.md:5691, e também Classes.md:5553) usa
//     "Juramento DE Vingança".
export const SUBCLASSES = {
  // Classes.md:185-187.
  'Bárbaro': ['Trilha da Árvore do Mundo', 'Trilha do Berserker',
              'Trilha do Coração Selvagem', 'Trilha do Fanático'],
  // Classes.md:684-686.
  'Bardo': ['Colégio da Bravura', 'Colégio da Dança',
            'Colégio do Conhecimento', 'Colégio do Glamour'],
  // Classes.md:1295-1297 para as outras três; "Patrono O Grande Antigo"
  // segue o heading Classes.md:1387, não a lista (ver EXCEÇÃO acima).
  'Bruxo': ['Patrono Arquifada', 'Patrono Celestial',
            'Patrono O Grande Antigo', 'Patrono Ínfero'],
  // Classes.md:1795-1797.
  'Clérigo': ['Domínio da Guerra', 'Domínio da Luz', 'Domínio da Trapaça',
              'Domínio da Vida'],
  // Classes.md:2333-2335.
  'Druida': ['Círculo da Lua', 'Círculo da Terra', 'Círculo das Estrelas',
             'Círculo do Mar'],
  // Classes.md:2996-2998.
  'Feiticeiro': ['Feitiçaria Aberrante', 'Feitiçaria Dracônica',
                 'Feitiçaria Mecânica', 'Feitiçaria Selvagem'],
  // Classes.md:3466-3468.
  'Guardião': ['Andarilho Feérico', 'Caçador', 'Senhor das Feras',
               'Vigilante das Sombras'],
  // Classes.md:3882-3884.
  'Guerreiro': ['Campeão', 'Cavaleiro Místico', 'Combatente Psíquico',
                'Mestre da Batalha'],
  // Classes.md:4302-4304.
  'Ladino': ['Adaga Espiritual', 'Assassino', 'Ladrão',
             'Trapaceiro Arcano'],
  // Classes.md:4958-4960.
  'Mago': ['Abjurador', 'Adivinhador', 'Evocador', 'Ilusionista'],
  // Classes.md:5286-5288.
  'Monge': ['Combatente da Mão Espalmada', 'Combatente da Misericórdia',
            'Combatente das Sombras', 'Combatente dos Elementos'],
  // Classes.md:5689-5691; "Juramento da Vingança" segue o heading
  // Classes.md:5805, não a lista (ver EXCEÇÃO acima).
  'Paladino': ['Juramento da Devoção', 'Juramento da Glória',
               'Juramento da Vingança', 'Juramento dos Anciões'],
};

// ============================================================
// Progressão por nível (Task 3) -- 12 classes x 20 níveis, 240
// linhas, transcritas célula a célula da tabela "Características
// de X" de cada classe em Classes.md. Mesma REGRA DURA do topo do
// arquivo: nada aqui foi lido de dados/classes/*.json nem de
// site/js/dados-classes.js.
// ============================================================

// Colunas específicas de cada classe, na grafia exata da chave em
// dados/classes/*.json. Note "Espacos de Magia"/"Nivel do Espaco" do
// Bruxo SEM acento -- é assim que o arquivo de dados grafa, e o teste
// compara chave a chave.
export const COLUNAS_POR_CLASSE = {
  'Bárbaro': ['Fúrias', 'Dano da Fúria', 'Maestria em Arma'],
  'Bardo': ['Dados de Inspiração', 'Truques', 'Magias Preparadas'],
  'Bruxo': ['Invocações', 'Truques', 'Magias Preparadas',
            'Espacos de Magia', 'Nivel do Espaco'],
  'Clérigo': ['Canalizar Divindade', 'Truques', 'Magias Preparadas'],
  'Druida': ['Forma Selvagem', 'Truques', 'Magias Preparadas'],
  'Feiticeiro': ['Pontos de Feitiçaria', 'Truques', 'Magias Preparadas'],
  'Guardião': ['Inimigo Favorito', 'Magias Preparadas'],
  'Guerreiro': ['Recuperar Fôlego', 'Maestria em Arma'],
  'Ladino': ['Ataque Furtivo'],
  'Mago': ['Truques', 'Magias Preparadas'],
  'Monge': ['Artes Marciais', 'Pontos de Foco', 'Movimento sem Armadura'],
  'Paladino': ['Canalizar Divindade', 'Magias Preparadas'],
};

// Chave da coluna de características em dados/classes/*.json: três
// classes usam 'Características de Classe' e nove usam 'Características'.
// obterCaracteristicasNivel (levelup.js:388) já trata as duas com `??`;
// o teste de tabela precisa saber qual esperar em cada classe.
export const CHAVE_CARACTERISTICAS = {
  'Bárbaro': 'Características de Classe', 'Bardo': 'Características de Classe',
  'Mago': 'Características de Classe',
  'Bruxo': 'Características', 'Clérigo': 'Características',
  'Druida': 'Características', 'Feiticeiro': 'Características',
  'Guardião': 'Características', 'Guerreiro': 'Características',
  'Ladino': 'Características', 'Monge': 'Características',
  'Paladino': 'Características',
};

// PROGRESSAO: 12 classes x 20 níveis. Convenções (verificadas pelo
// schema da Task 4):
// - `colunas` guarda STRING, exatamente como a célula do livro
//   imprime -- inclusive '—' quando a coluna (não círculo de magia)
//   ainda não tem valor naquele nível (ex.: Canalizar Divindade no
//   nível 1 de Clérigo/Paladino). Nenhuma normalização.
// - `caracteristicas: []` quando a coluna Características do livro
//   traz '—'.
// - `espacos: null` para as 4 classes sem conjuração (Bárbaro,
//   Guerreiro, Ladino, Monge -- confirmado contra
//   TRACOS_BASICOS[x].conjurador === false acima). Para as 8
//   conjuradoras, é um objeto só com os círculos que têm número no
//   livro; círculo com '—' não entra no objeto.
//
// AVISO PARA QUEM FOR CONFERIR CONTRA O LIVRO: em 4 das 12 classes a
// tabela de 20 níveis NÃO fica logo abaixo do heading "Características
// de Classe de X" que `CITACOES` (Task 2) aponta -- ela fica em outro
// lugar, e cada bloco abaixo registra onde:
//   - Paladino: a tabela fica ACIMA, sob um heading próprio,
//     "## Características de Paladino" (Classes.md:5469). `CITACOES`
//     já aponta para esse heading correto, não para
//     "Características de Classe de Paladino" (5495), que é só prosa.
//   - Clérigo, Druida e Guerreiro: a tabela fica ANTES do heading
//     "Características de Classe de X", embutida dentro da seção de
//     regras de multiclasse (Classes.md:1513-1532, 1999-2018 e
//     3783-3802, respectivamente). Diferente do Paladino, essas três
//     NÃO têm um heading próprio acima da tabela -- por isso
//     `CITACOES[classe]` aponta deliberadamente para o heading da
//     seção "Características de Classe de X" mesmo esse heading
//     ficando DEPOIS da tabela no arquivo: não existe heading melhor
//     (o mais próximo acima seria "Como um Personagem Multiclasse",
//     que é ainda menos específico). Isso NÃO é um defeito a
//     "corrigir" -- é a citação possível dada a estrutura real do
//     documento. Quem for procurar a tabela dessas três classes
//     precisa rolar para CIMA a partir do heading citado, não para
//     baixo.
export const PROGRESSAO = {
  // Classes.md:44-65, sob "## Características de Classe de Bárbaro"
  // (linha 38). Sem conjuração -> espacos sempre null.
  'Bárbaro': [
    { nivel: 1, bonusProficiencia: 2,
      caracteristicas: ['Defesa sem Armadura', 'Fúria', 'Maestria em Arma'],
      colunas: { 'Fúrias': '2', 'Dano da Fúria': '+2', 'Maestria em Arma': '2' },
      espacos: null },
    { nivel: 2, bonusProficiencia: 2,
      caracteristicas: ['Ataque Imprudente', 'Sentido de Perigo'],
      colunas: { 'Fúrias': '2', 'Dano da Fúria': '+2', 'Maestria em Arma': '2' },
      espacos: null },
    { nivel: 3, bonusProficiencia: 2,
      caracteristicas: ['Conhecimento Primordial', 'Subclasse Bárbaro'],
      colunas: { 'Fúrias': '3', 'Dano da Fúria': '+2', 'Maestria em Arma': '2' },
      espacos: null },
    { nivel: 4, bonusProficiencia: 2,
      caracteristicas: ['Aumento no Valor de Atributo'],
      colunas: { 'Fúrias': '3', 'Dano da Fúria': '+2', 'Maestria em Arma': '3' },
      espacos: null },
    { nivel: 5, bonusProficiencia: 3,
      caracteristicas: ['Ataque Extra', 'Movimento Rápido'],
      colunas: { 'Fúrias': '3', 'Dano da Fúria': '+2', 'Maestria em Arma': '3' },
      espacos: null },
    { nivel: 6, bonusProficiencia: 3,
      caracteristicas: ['Característica de Subclasse'],
      colunas: { 'Fúrias': '4', 'Dano da Fúria': '+2', 'Maestria em Arma': '3' },
      espacos: null },
    { nivel: 7, bonusProficiencia: 3,
      caracteristicas: ['Bote Instintivo', 'Instintos Primitivos'],
      colunas: { 'Fúrias': '4', 'Dano da Fúria': '+2', 'Maestria em Arma': '3' },
      espacos: null },
    { nivel: 8, bonusProficiencia: 3,
      caracteristicas: ['Aumento no Valor de Atributo'],
      colunas: { 'Fúrias': '4', 'Dano da Fúria': '+2', 'Maestria em Arma': '3' },
      espacos: null },
    { nivel: 9, bonusProficiencia: 4,
      caracteristicas: ['Golpe Brutal'],
      colunas: { 'Fúrias': '4', 'Dano da Fúria': '+3', 'Maestria em Arma': '3' },
      espacos: null },
    { nivel: 10, bonusProficiencia: 4,
      caracteristicas: ['Característica de Subclasse'],
      colunas: { 'Fúrias': '4', 'Dano da Fúria': '+3', 'Maestria em Arma': '4' },
      espacos: null },
    { nivel: 11, bonusProficiencia: 4,
      caracteristicas: ['Fúria Implacável'],
      colunas: { 'Fúrias': '4', 'Dano da Fúria': '+3', 'Maestria em Arma': '4' },
      espacos: null },
    { nivel: 12, bonusProficiencia: 4,
      caracteristicas: ['Aumento no Valor de Atributo'],
      colunas: { 'Fúrias': '5', 'Dano da Fúria': '+3', 'Maestria em Arma': '4' },
      espacos: null },
    { nivel: 13, bonusProficiencia: 5,
      caracteristicas: ['Golpe Brutal Aprimorado'],
      colunas: { 'Fúrias': '5', 'Dano da Fúria': '+3', 'Maestria em Arma': '4' },
      espacos: null },
    { nivel: 14, bonusProficiencia: 5,
      caracteristicas: ['Característica de Subclasse'],
      colunas: { 'Fúrias': '5', 'Dano da Fúria': '+3', 'Maestria em Arma': '4' },
      espacos: null },
    { nivel: 15, bonusProficiencia: 5,
      caracteristicas: ['Fúria Persistente'],
      colunas: { 'Fúrias': '5', 'Dano da Fúria': '+3', 'Maestria em Arma': '4' },
      espacos: null },
    { nivel: 16, bonusProficiencia: 5,
      caracteristicas: ['Aumento no Valor de Atributo'],
      colunas: { 'Fúrias': '5', 'Dano da Fúria': '+4', 'Maestria em Arma': '4' },
      espacos: null },
    { nivel: 17, bonusProficiencia: 6,
      caracteristicas: ['Golpe Brutal Aprimorado'],
      colunas: { 'Fúrias': '6', 'Dano da Fúria': '+4', 'Maestria em Arma': '4' },
      espacos: null },
    { nivel: 18, bonusProficiencia: 6,
      caracteristicas: ['Força Indomável'],
      colunas: { 'Fúrias': '6', 'Dano da Fúria': '+4', 'Maestria em Arma': '4' },
      espacos: null },
    { nivel: 19, bonusProficiencia: 6,
      caracteristicas: ['Dádiva Épica'],
      colunas: { 'Fúrias': '6', 'Dano da Fúria': '+4', 'Maestria em Arma': '4' },
      espacos: null },
    { nivel: 20, bonusProficiencia: 6,
      caracteristicas: ['Campeão Primitivo'],
      colunas: { 'Fúrias': '6', 'Dano da Fúria': '+4', 'Maestria em Arma': '4' },
      espacos: null },
  ],

  // Classes.md:375-396, sob "### Características de Classe de Bardo"
  // (linha 369). Conjuradora -> espacos é objeto com os círculos 1-9
  // que têm número. '—' nos níveis 11/13/15/17 = caracteristicas: [].
  'Bardo': [
    { nivel: 1, bonusProficiencia: 2,
      caracteristicas: ['Inspiração de Bardo', 'Conjuração'],
      colunas: { 'Dados de Inspiração': 'D6', 'Truques': '2', 'Magias Preparadas': '4' },
      espacos: { '1': 2 } },
    { nivel: 2, bonusProficiencia: 2,
      caracteristicas: ['Especialista', 'Pau pra Toda Obra'],
      colunas: { 'Dados de Inspiração': 'D6', 'Truques': '2', 'Magias Preparadas': '5' },
      espacos: { '1': 3 } },
    { nivel: 3, bonusProficiencia: 2,
      caracteristicas: ['Subclasse de Bardo'],
      colunas: { 'Dados de Inspiração': 'D6', 'Truques': '2', 'Magias Preparadas': '6' },
      espacos: { '1': 4, '2': 2 } },
    { nivel: 4, bonusProficiencia: 2,
      caracteristicas: ['Aumento no Valor de Atributo'],
      colunas: { 'Dados de Inspiração': 'D6', 'Truques': '3', 'Magias Preparadas': '7' },
      espacos: { '1': 4, '2': 3 } },
    { nivel: 5, bonusProficiencia: 3,
      caracteristicas: ['Fonte de Inspiração'],
      colunas: { 'Dados de Inspiração': 'D8', 'Truques': '3', 'Magias Preparadas': '9' },
      espacos: { '1': 4, '2': 3, '3': 2 } },
    { nivel: 6, bonusProficiencia: 3,
      caracteristicas: ['Característica de Subclasse'],
      colunas: { 'Dados de Inspiração': 'D8', 'Truques': '3', 'Magias Preparadas': '10' },
      espacos: { '1': 4, '2': 3, '3': 3 } },
    { nivel: 7, bonusProficiencia: 3,
      caracteristicas: ['Contra-Encantamento'],
      colunas: { 'Dados de Inspiração': 'D8', 'Truques': '3', 'Magias Preparadas': '11' },
      espacos: { '1': 4, '2': 3, '3': 3, '4': 1 } },
    { nivel: 8, bonusProficiencia: 3,
      caracteristicas: ['Aumento no Valor de Atributo'],
      colunas: { 'Dados de Inspiração': 'D8', 'Truques': '3', 'Magias Preparadas': '12' },
      espacos: { '1': 4, '2': 3, '3': 3, '4': 2 } },
    { nivel: 9, bonusProficiencia: 4,
      caracteristicas: ['Especialização'],
      colunas: { 'Dados de Inspiração': 'D8', 'Truques': '3', 'Magias Preparadas': '14' },
      espacos: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 1 } },
    { nivel: 10, bonusProficiencia: 4,
      caracteristicas: ['Segredos Mágicos'],
      colunas: { 'Dados de Inspiração': 'D10', 'Truques': '4', 'Magias Preparadas': '15' },
      espacos: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 2 } },
    { nivel: 11, bonusProficiencia: 4,
      caracteristicas: [],
      colunas: { 'Dados de Inspiração': 'D10', 'Truques': '4', 'Magias Preparadas': '16' },
      espacos: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 2, '6': 1 } },
    { nivel: 12, bonusProficiencia: 4,
      caracteristicas: ['Aumento no Valor de Atributo'],
      colunas: { 'Dados de Inspiração': 'D10', 'Truques': '4', 'Magias Preparadas': '16' },
      espacos: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 2, '6': 1 } },
    { nivel: 13, bonusProficiencia: 5,
      caracteristicas: [],
      colunas: { 'Dados de Inspiração': 'D10', 'Truques': '4', 'Magias Preparadas': '17' },
      espacos: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 2, '6': 1, '7': 1 } },
    { nivel: 14, bonusProficiencia: 5,
      caracteristicas: ['Característica de Subclasse'],
      colunas: { 'Dados de Inspiração': 'D10', 'Truques': '4', 'Magias Preparadas': '17' },
      espacos: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 2, '6': 1, '7': 1 } },
    { nivel: 15, bonusProficiencia: 5,
      caracteristicas: [],
      colunas: { 'Dados de Inspiração': 'D12', 'Truques': '4', 'Magias Preparadas': '18' },
      espacos: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 2, '6': 1, '7': 1, '8': 1 } },
    { nivel: 16, bonusProficiencia: 5,
      caracteristicas: ['Aumento no Valor de Atributo'],
      colunas: { 'Dados de Inspiração': 'D12', 'Truques': '4', 'Magias Preparadas': '18' },
      espacos: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 2, '6': 1, '7': 1, '8': 1 } },
    { nivel: 17, bonusProficiencia: 6,
      caracteristicas: [],
      colunas: { 'Dados de Inspiração': 'D12', 'Truques': '4', 'Magias Preparadas': '19' },
      espacos: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 2, '6': 1, '7': 1, '8': 1, '9': 1 } },
    { nivel: 18, bonusProficiencia: 6,
      caracteristicas: ['Inspiração Superior'],
      colunas: { 'Dados de Inspiração': 'D12', 'Truques': '4', 'Magias Preparadas': '20' },
      espacos: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 3, '6': 1, '7': 1, '8': 1, '9': 1 } },
    { nivel: 19, bonusProficiencia: 6,
      caracteristicas: ['Dádiva Épica'],
      colunas: { 'Dados de Inspiração': 'D12', 'Truques': '4', 'Magias Preparadas': '21' },
      espacos: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 3, '6': 2, '7': 1, '8': 1, '9': 1 } },
    { nivel: 20, bonusProficiencia: 6,
      caracteristicas: ['Palavras de Criação'],
      colunas: { 'Dados de Inspiração': 'D12', 'Truques': '4', 'Magias Preparadas': '22' },
      espacos: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 3, '6': 2, '7': 2, '8': 1, '9': 1 } },
  ],

  // Classes.md:857-876, sob "## Características de Classe de Bruxo"
  // (linha 851). Bônus de Proficiência aqui é impresso SEM o sinal
  // "+" (livro grafa "2", não "+2", único caso entre as 12 tabelas) --
  // sem efeito no catálogo porque `bonusProficiencia` é number, não
  // string.
  //
  // Magia de Pacto (Bruxo) não usa colunas de círculo 1-9 como as
  // outras conjuradoras: a tabela do livro tem só duas colunas,
  // "Espaços de Magia" (quantos espaços) e "Nível do Espaço" (em que
  // círculo). Os dois valores entram em `colunas` como qualquer outra
  // coluna (chaves sem acento, ver COLUNAS_POR_CLASSE), e também
  // derivam o `espacos` no formato comum às outras classes
  // (`{ [nívelDoEspaço]: espaçosDeMagia }`), porque o Bruxo só tem UM
  // círculo ativo de cada vez -- diferente de um Bardo ou Mago, que
  // acumulam espaços em vários círculos simultaneamente.
  'Bruxo': [
    { nivel: 1, bonusProficiencia: 2,
      caracteristicas: ['Invocações Místicas', 'Opções de Invocações Místicas', 'Magia de Pacto'],
      colunas: { 'Invocações': '1', 'Truques': '2', 'Magias Preparadas': '2', 'Espacos de Magia': '1', 'Nivel do Espaco': '1' },
      espacos: { '1': 1 } },
    { nivel: 2, bonusProficiencia: 2,
      caracteristicas: ['Astúcia Mágica'],
      colunas: { 'Invocações': '3', 'Truques': '2', 'Magias Preparadas': '3', 'Espacos de Magia': '2', 'Nivel do Espaco': '1' },
      espacos: { '1': 2 } },
    { nivel: 3, bonusProficiencia: 2,
      caracteristicas: ['Subclasse de Bruxo'],
      colunas: { 'Invocações': '3', 'Truques': '2', 'Magias Preparadas': '4', 'Espacos de Magia': '2', 'Nivel do Espaco': '2' },
      espacos: { '2': 2 } },
    { nivel: 4, bonusProficiencia: 2,
      caracteristicas: ['Aumento no Valor de Atributo'],
      colunas: { 'Invocações': '3', 'Truques': '3', 'Magias Preparadas': '5', 'Espacos de Magia': '2', 'Nivel do Espaco': '2' },
      espacos: { '2': 2 } },
    { nivel: 5, bonusProficiencia: 3,
      caracteristicas: [],
      colunas: { 'Invocações': '5', 'Truques': '3', 'Magias Preparadas': '6', 'Espacos de Magia': '2', 'Nivel do Espaco': '3' },
      espacos: { '3': 2 } },
    { nivel: 6, bonusProficiencia: 3,
      caracteristicas: ['Característica de Subclasse'],
      colunas: { 'Invocações': '5', 'Truques': '3', 'Magias Preparadas': '7', 'Espacos de Magia': '2', 'Nivel do Espaco': '3' },
      espacos: { '3': 2 } },
    { nivel: 7, bonusProficiencia: 3,
      caracteristicas: [],
      colunas: { 'Invocações': '6', 'Truques': '3', 'Magias Preparadas': '8', 'Espacos de Magia': '2', 'Nivel do Espaco': '4' },
      espacos: { '4': 2 } },
    { nivel: 8, bonusProficiencia: 3,
      caracteristicas: ['Aumento no Valor de Atributo'],
      colunas: { 'Invocações': '6', 'Truques': '3', 'Magias Preparadas': '9', 'Espacos de Magia': '2', 'Nivel do Espaco': '4' },
      espacos: { '4': 2 } },
    { nivel: 9, bonusProficiencia: 4,
      caracteristicas: ['Contatar Patrono'],
      colunas: { 'Invocações': '7', 'Truques': '3', 'Magias Preparadas': '10', 'Espacos de Magia': '2', 'Nivel do Espaco': '5' },
      espacos: { '5': 2 } },
    { nivel: 10, bonusProficiencia: 4,
      caracteristicas: ['Característica de Subclasse'],
      colunas: { 'Invocações': '7', 'Truques': '4', 'Magias Preparadas': '10', 'Espacos de Magia': '2', 'Nivel do Espaco': '5' },
      espacos: { '5': 2 } },
    { nivel: 11, bonusProficiencia: 4,
      caracteristicas: ['Arcana Mística (6º círculo)'],
      colunas: { 'Invocações': '7', 'Truques': '4', 'Magias Preparadas': '11', 'Espacos de Magia': '3', 'Nivel do Espaco': '5' },
      espacos: { '5': 3 } },
    { nivel: 12, bonusProficiencia: 4,
      caracteristicas: ['Aumento no Valor de Atributo'],
      colunas: { 'Invocações': '8', 'Truques': '4', 'Magias Preparadas': '11', 'Espacos de Magia': '3', 'Nivel do Espaco': '5' },
      espacos: { '5': 3 } },
    { nivel: 13, bonusProficiencia: 5,
      caracteristicas: ['Arcana Mística (7º círculo)'],
      colunas: { 'Invocações': '8', 'Truques': '4', 'Magias Preparadas': '12', 'Espacos de Magia': '3', 'Nivel do Espaco': '5' },
      espacos: { '5': 3 } },
    { nivel: 14, bonusProficiencia: 5,
      caracteristicas: ['Característica de Subclasse'],
      colunas: { 'Invocações': '8', 'Truques': '4', 'Magias Preparadas': '12', 'Espacos de Magia': '3', 'Nivel do Espaco': '5' },
      espacos: { '5': 3 } },
    { nivel: 15, bonusProficiencia: 5,
      caracteristicas: ['Arcana Mística (8º círculo)'],
      colunas: { 'Invocações': '9', 'Truques': '4', 'Magias Preparadas': '13', 'Espacos de Magia': '3', 'Nivel do Espaco': '5' },
      espacos: { '5': 3 } },
    { nivel: 16, bonusProficiencia: 5,
      caracteristicas: ['Aumento no Valor de Atributo'],
      colunas: { 'Invocações': '9', 'Truques': '4', 'Magias Preparadas': '13', 'Espacos de Magia': '3', 'Nivel do Espaco': '5' },
      espacos: { '5': 3 } },
    { nivel: 17, bonusProficiencia: 6,
      caracteristicas: ['Arcana Mística (9º círculo)'],
      colunas: { 'Invocações': '9', 'Truques': '4', 'Magias Preparadas': '14', 'Espacos de Magia': '4', 'Nivel do Espaco': '5' },
      espacos: { '5': 4 } },
    { nivel: 18, bonusProficiencia: 6,
      caracteristicas: [],
      colunas: { 'Invocações': '10', 'Truques': '4', 'Magias Preparadas': '14', 'Espacos de Magia': '4', 'Nivel do Espaco': '5' },
      espacos: { '5': 4 } },
    { nivel: 19, bonusProficiencia: 6,
      caracteristicas: ['Dádiva Épica'],
      colunas: { 'Invocações': '10', 'Truques': '4', 'Magias Preparadas': '15', 'Espacos de Magia': '4', 'Nivel do Espaco': '5' },
      espacos: { '5': 4 } },
    { nivel: 20, bonusProficiencia: 6,
      caracteristicas: ['Mestre Místico'],
      colunas: { 'Invocações': '10', 'Truques': '4', 'Magias Preparadas': '15', 'Espacos de Magia': '4', 'Nivel do Espaco': '5' },
      espacos: { '5': 4 } },
  ],

  // Classes.md:1513-1532. ARMADILHA DE LAYOUT: essa tabela fica
  // FISICAMENTE ANTES do heading "## Características de Classe de
  // Clérigo" (linha 1534) -- ela está encaixada dentro da seção "###
  // Como um Personagem Multiclasse" (linha 1505), não logo abaixo do
  // heading de características como nas outras 8 classes "normais".
  // Confirmado localizando a tabela pelo texto da coluna "Canalizar
  // Divindade" via busca direta, não pelo número de linha do heading.
  //
  // AMBÍGUO (linha 1513, nível 1): a célula do círculo 2 imprime
  // "— — —" (três travessões) e a do círculo 6 imprime "— —" (dois
  // travessões), em vez do "—" único que toda outra célula vazia usa
  // nesta e nas outras 11 tabelas. Isso é ruído de conversão da
  // tabela (colunas que deveriam ter um único "—" cada uma, aparecem
  // com travessões extras colados). Resolvido como "—" comum em
  // ambas -- nenhum círculo entra em `espacos` no nível 1, igual a
  // toda outra conjuradora de círculo completo (só o círculo 1 abre
  // com espaço no nível 1).
  'Clérigo': [
    { nivel: 1, bonusProficiencia: 2,
      caracteristicas: ['Conjuração', 'Ordem Divina'],
      colunas: { 'Canalizar Divindade': '—', 'Truques': '3', 'Magias Preparadas': '4' },
      espacos: { '1': 2 } },
    { nivel: 2, bonusProficiencia: 2,
      caracteristicas: ['Canalizar Divindade'],
      colunas: { 'Canalizar Divindade': '2', 'Truques': '3', 'Magias Preparadas': '5' },
      espacos: { '1': 3 } },
    { nivel: 3, bonusProficiencia: 2,
      caracteristicas: ['Subclasse Clérigo'],
      colunas: { 'Canalizar Divindade': '2', 'Truques': '3', 'Magias Preparadas': '6' },
      espacos: { '1': 4, '2': 2 } },
    { nivel: 4, bonusProficiencia: 2,
      caracteristicas: ['Aumento no Valor de Atributo'],
      colunas: { 'Canalizar Divindade': '2', 'Truques': '4', 'Magias Preparadas': '7' },
      espacos: { '1': 4, '2': 3 } },
    { nivel: 5, bonusProficiencia: 3,
      caracteristicas: ['Fulminar Mortos-Vivos'],
      colunas: { 'Canalizar Divindade': '2', 'Truques': '4', 'Magias Preparadas': '9' },
      espacos: { '1': 4, '2': 3, '3': 2 } },
    { nivel: 6, bonusProficiencia: 3,
      caracteristicas: ['Característica de Subclasse'],
      colunas: { 'Canalizar Divindade': '3', 'Truques': '4', 'Magias Preparadas': '10' },
      espacos: { '1': 4, '2': 3, '3': 3 } },
    { nivel: 7, bonusProficiencia: 3,
      caracteristicas: ['Golpes Abençoados'],
      colunas: { 'Canalizar Divindade': '3', 'Truques': '4', 'Magias Preparadas': '11' },
      espacos: { '1': 4, '2': 3, '3': 3, '4': 1 } },
    { nivel: 8, bonusProficiencia: 3,
      caracteristicas: ['Aumento no Valor de Atributo'],
      colunas: { 'Canalizar Divindade': '3', 'Truques': '4', 'Magias Preparadas': '12' },
      espacos: { '1': 4, '2': 3, '3': 3, '4': 2 } },
    { nivel: 9, bonusProficiencia: 4,
      caracteristicas: [],
      colunas: { 'Canalizar Divindade': '3', 'Truques': '4', 'Magias Preparadas': '14' },
      espacos: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 1 } },
    { nivel: 10, bonusProficiencia: 4,
      caracteristicas: ['Intervenção Divina'],
      colunas: { 'Canalizar Divindade': '3', 'Truques': '5', 'Magias Preparadas': '15' },
      espacos: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 2 } },
    { nivel: 11, bonusProficiencia: 4,
      caracteristicas: [],
      colunas: { 'Canalizar Divindade': '3', 'Truques': '5', 'Magias Preparadas': '16' },
      espacos: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 2, '6': 1 } },
    { nivel: 12, bonusProficiencia: 4,
      caracteristicas: ['Aumento no Valor de Atributo'],
      colunas: { 'Canalizar Divindade': '3', 'Truques': '5', 'Magias Preparadas': '16' },
      espacos: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 2, '6': 1 } },
    { nivel: 13, bonusProficiencia: 5,
      caracteristicas: [],
      colunas: { 'Canalizar Divindade': '3', 'Truques': '5', 'Magias Preparadas': '17' },
      espacos: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 2, '6': 1, '7': 1 } },
    { nivel: 14, bonusProficiencia: 5,
      caracteristicas: ['Golpes Abençoados Aprimorado'],
      colunas: { 'Canalizar Divindade': '3', 'Truques': '5', 'Magias Preparadas': '17' },
      espacos: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 2, '6': 1, '7': 1 } },
    { nivel: 15, bonusProficiencia: 5,
      caracteristicas: [],
      colunas: { 'Canalizar Divindade': '3', 'Truques': '5', 'Magias Preparadas': '18' },
      espacos: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 2, '6': 1, '7': 1, '8': 1 } },
    { nivel: 16, bonusProficiencia: 5,
      caracteristicas: ['Aumento no Valor de Atributo'],
      colunas: { 'Canalizar Divindade': '3', 'Truques': '5', 'Magias Preparadas': '18' },
      espacos: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 2, '6': 1, '7': 1, '8': 1 } },
    { nivel: 17, bonusProficiencia: 6,
      caracteristicas: ['Característica de Subclasse'],
      colunas: { 'Canalizar Divindade': '3', 'Truques': '5', 'Magias Preparadas': '19' },
      espacos: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 2, '6': 1, '7': 1, '8': 1, '9': 1 } },
    { nivel: 18, bonusProficiencia: 6,
      caracteristicas: [],
      colunas: { 'Canalizar Divindade': '4', 'Truques': '5', 'Magias Preparadas': '20' },
      espacos: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 3, '6': 1, '7': 1, '8': 1, '9': 1 } },
    { nivel: 19, bonusProficiencia: 6,
      caracteristicas: ['Dádiva Épica'],
      colunas: { 'Canalizar Divindade': '4', 'Truques': '5', 'Magias Preparadas': '21' },
      espacos: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 3, '6': 2, '7': 1, '8': 1, '9': 1 } },
    { nivel: 20, bonusProficiencia: 6,
      caracteristicas: ['Intervenção Divina Maior'],
      colunas: { 'Canalizar Divindade': '4', 'Truques': '5', 'Magias Preparadas': '22' },
      espacos: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 3, '6': 2, '7': 2, '8': 1, '9': 1 } },
  ],

  // Classes.md:1999-2018. Mesma ARMADILHA DE LAYOUT do Clérigo: a
  // tabela fica FISICAMENTE ANTES do heading "## Características de
  // Classe de Druida" (linha 2020), dentro da seção "### Como um
  // Personagem Multiclasse" (linha 1992). Localizada pelo texto da
  // coluna "Forma Selvagem", não pelo número do heading.
  'Druida': [
    { nivel: 1, bonusProficiencia: 2,
      caracteristicas: ['Conjuração', 'Idioma Druídico', 'Ordem Primal'],
      colunas: { 'Forma Selvagem': '—', 'Truques': '2', 'Magias Preparadas': '4' },
      espacos: { '1': 2 } },
    { nivel: 2, bonusProficiencia: 2,
      caracteristicas: ['Companheiro Selvagem', 'Forma Selvagem'],
      colunas: { 'Forma Selvagem': '2', 'Truques': '2', 'Magias Preparadas': '5' },
      espacos: { '1': 3 } },
    { nivel: 3, bonusProficiencia: 2,
      caracteristicas: ['Subclasse de Druida'],
      colunas: { 'Forma Selvagem': '2', 'Truques': '2', 'Magias Preparadas': '6' },
      espacos: { '1': 4, '2': 2 } },
    { nivel: 4, bonusProficiencia: 2,
      caracteristicas: ['Aumento no Valor de Atributo'],
      colunas: { 'Forma Selvagem': '2', 'Truques': '3', 'Magias Preparadas': '7' },
      espacos: { '1': 4, '2': 3 } },
    { nivel: 5, bonusProficiencia: 3,
      caracteristicas: ['Ressurgimento Selvagem'],
      colunas: { 'Forma Selvagem': '2', 'Truques': '3', 'Magias Preparadas': '9' },
      espacos: { '1': 4, '2': 3, '3': 2 } },
    { nivel: 6, bonusProficiencia: 3,
      caracteristicas: ['Característica de Subclasse'],
      colunas: { 'Forma Selvagem': '3', 'Truques': '3', 'Magias Preparadas': '10' },
      espacos: { '1': 4, '2': 3, '3': 3 } },
    { nivel: 7, bonusProficiencia: 3,
      caracteristicas: ['Fúria Elemental'],
      colunas: { 'Forma Selvagem': '3', 'Truques': '3', 'Magias Preparadas': '11' },
      espacos: { '1': 4, '2': 3, '3': 3, '4': 1 } },
    { nivel: 8, bonusProficiencia: 3,
      caracteristicas: ['Aumento no Valor de Atributo'],
      colunas: { 'Forma Selvagem': '3', 'Truques': '3', 'Magias Preparadas': '12' },
      espacos: { '1': 4, '2': 3, '3': 3, '4': 2 } },
    { nivel: 9, bonusProficiencia: 4,
      caracteristicas: [],
      colunas: { 'Forma Selvagem': '3', 'Truques': '3', 'Magias Preparadas': '14' },
      espacos: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 1 } },
    { nivel: 10, bonusProficiencia: 4,
      caracteristicas: ['Característica de Subclasse'],
      colunas: { 'Forma Selvagem': '3', 'Truques': '4', 'Magias Preparadas': '15' },
      espacos: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 2 } },
    { nivel: 11, bonusProficiencia: 4,
      caracteristicas: [],
      colunas: { 'Forma Selvagem': '3', 'Truques': '4', 'Magias Preparadas': '16' },
      espacos: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 2, '6': 1 } },
    { nivel: 12, bonusProficiencia: 4,
      caracteristicas: ['Aumento no Valor de Atributo'],
      colunas: { 'Forma Selvagem': '3', 'Truques': '4', 'Magias Preparadas': '16' },
      espacos: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 2, '6': 1 } },
    { nivel: 13, bonusProficiencia: 5,
      caracteristicas: [],
      colunas: { 'Forma Selvagem': '3', 'Truques': '4', 'Magias Preparadas': '17' },
      espacos: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 2, '6': 1, '7': 1 } },
    { nivel: 14, bonusProficiencia: 5,
      caracteristicas: ['Característica de Subclasse'],
      colunas: { 'Forma Selvagem': '3', 'Truques': '4', 'Magias Preparadas': '17' },
      espacos: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 2, '6': 1, '7': 1 } },
    { nivel: 15, bonusProficiencia: 5,
      caracteristicas: ['Fúria Elemental Aprimorada'],
      colunas: { 'Forma Selvagem': '3', 'Truques': '4', 'Magias Preparadas': '18' },
      espacos: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 2, '6': 1, '7': 1, '8': 1 } },
    { nivel: 16, bonusProficiencia: 5,
      caracteristicas: ['Aumento no Valor de Atributo'],
      colunas: { 'Forma Selvagem': '3', 'Truques': '4', 'Magias Preparadas': '18' },
      espacos: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 2, '6': 1, '7': 1, '8': 1 } },
    { nivel: 17, bonusProficiencia: 6,
      caracteristicas: [],
      colunas: { 'Forma Selvagem': '4', 'Truques': '4', 'Magias Preparadas': '19' },
      espacos: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 2, '6': 1, '7': 1, '8': 1, '9': 1 } },
    { nivel: 18, bonusProficiencia: 6,
      caracteristicas: ['Magias Bestiais'],
      colunas: { 'Forma Selvagem': '4', 'Truques': '4', 'Magias Preparadas': '20' },
      espacos: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 3, '6': 1, '7': 1, '8': 1, '9': 1 } },
    { nivel: 19, bonusProficiencia: 6,
      caracteristicas: ['Dádiva Épica'],
      colunas: { 'Forma Selvagem': '4', 'Truques': '4', 'Magias Preparadas': '21' },
      espacos: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 3, '6': 2, '7': 1, '8': 1, '9': 1 } },
    { nivel: 20, bonusProficiencia: 6,
      caracteristicas: ['Arquidruida'],
      colunas: { 'Forma Selvagem': '4', 'Truques': '4', 'Magias Preparadas': '22' },
      espacos: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 3, '6': 2, '7': 2, '8': 1, '9': 1 } },
  ],

  // Classes.md:2612-2631, sob "## Características de Classe de
  // Feiticeiro" (linha 2606) -- essa é uma das 8 classes "normais",
  // tabela logo abaixo do heading.
  //
  // AMBÍGUO (linha 2618, nível 7): a célula do círculo 9 vem em
  // branco (sem "—" nenhum), diferente de toda outra célula vazia
  // desta tabela, que usa "—". Resolvido como equivalente a "—" --
  // nível 7 não tem nenhum espaço de 9º círculo em nenhuma outra
  // classe de conjuração completa (a progressão de círculos altos
  // só abre a partir do nível 17), então não há leitura alternativa
  // plausível; círculo 9 não entra em `espacos`.
  'Feiticeiro': [
    { nivel: 1, bonusProficiencia: 2,
      caracteristicas: ['Conjuração', 'Feitiçaria Inata'],
      colunas: { 'Pontos de Feitiçaria': '—', 'Truques': '4', 'Magias Preparadas': '2' },
      espacos: { '1': 2 } },
    { nivel: 2, bonusProficiencia: 2,
      caracteristicas: ['Fonte de Magia', 'Metamagia', 'Opções de Metamagia'],
      colunas: { 'Pontos de Feitiçaria': '2', 'Truques': '4', 'Magias Preparadas': '4' },
      espacos: { '1': 3 } },
    { nivel: 3, bonusProficiencia: 2,
      caracteristicas: ['Subclasse de Feiticeiro'],
      colunas: { 'Pontos de Feitiçaria': '3', 'Truques': '4', 'Magias Preparadas': '6' },
      espacos: { '1': 4, '2': 2 } },
    { nivel: 4, bonusProficiencia: 2,
      caracteristicas: ['Aumento no Valor de Atributo'],
      colunas: { 'Pontos de Feitiçaria': '4', 'Truques': '5', 'Magias Preparadas': '7' },
      espacos: { '1': 4, '2': 3 } },
    { nivel: 5, bonusProficiencia: 3,
      caracteristicas: ['Restauração Feiticeira'],
      colunas: { 'Pontos de Feitiçaria': '5', 'Truques': '5', 'Magias Preparadas': '9' },
      espacos: { '1': 4, '2': 3, '3': 2 } },
    { nivel: 6, bonusProficiencia: 3,
      caracteristicas: ['Característica de Subclasse'],
      colunas: { 'Pontos de Feitiçaria': '6', 'Truques': '5', 'Magias Preparadas': '10' },
      espacos: { '1': 4, '2': 3, '3': 3 } },
    { nivel: 7, bonusProficiencia: 3,
      caracteristicas: ['Feitiçaria Encarnada'],
      colunas: { 'Pontos de Feitiçaria': '7', 'Truques': '5', 'Magias Preparadas': '11' },
      espacos: { '1': 4, '2': 3, '3': 3, '4': 1 } },
    { nivel: 8, bonusProficiencia: 3,
      caracteristicas: ['Aumento no Valor de Atributo'],
      colunas: { 'Pontos de Feitiçaria': '8', 'Truques': '5', 'Magias Preparadas': '12' },
      espacos: { '1': 4, '2': 3, '3': 3, '4': 2 } },
    { nivel: 9, bonusProficiencia: 4,
      caracteristicas: [],
      colunas: { 'Pontos de Feitiçaria': '9', 'Truques': '5', 'Magias Preparadas': '14' },
      espacos: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 1 } },
    { nivel: 10, bonusProficiencia: 4,
      caracteristicas: ['Metamagia'],
      colunas: { 'Pontos de Feitiçaria': '10', 'Truques': '6', 'Magias Preparadas': '15' },
      espacos: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 2 } },
    { nivel: 11, bonusProficiencia: 4,
      caracteristicas: [],
      colunas: { 'Pontos de Feitiçaria': '11', 'Truques': '6', 'Magias Preparadas': '16' },
      espacos: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 2, '6': 1 } },
    { nivel: 12, bonusProficiencia: 4,
      caracteristicas: ['Aumento no Valor de Atributo'],
      colunas: { 'Pontos de Feitiçaria': '12', 'Truques': '6', 'Magias Preparadas': '16' },
      espacos: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 2, '6': 1 } },
    { nivel: 13, bonusProficiencia: 5,
      caracteristicas: [],
      colunas: { 'Pontos de Feitiçaria': '13', 'Truques': '6', 'Magias Preparadas': '17' },
      espacos: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 2, '6': 1, '7': 1 } },
    { nivel: 14, bonusProficiencia: 5,
      caracteristicas: ['Característica de Subclasse'],
      colunas: { 'Pontos de Feitiçaria': '14', 'Truques': '6', 'Magias Preparadas': '17' },
      espacos: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 2, '6': 1, '7': 1 } },
    { nivel: 15, bonusProficiencia: 5,
      caracteristicas: [],
      colunas: { 'Pontos de Feitiçaria': '15', 'Truques': '6', 'Magias Preparadas': '18' },
      espacos: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 2, '6': 1, '7': 1, '8': 1 } },
    { nivel: 16, bonusProficiencia: 5,
      caracteristicas: ['Aumento no Valor de Atributo'],
      colunas: { 'Pontos de Feitiçaria': '16', 'Truques': '6', 'Magias Preparadas': '18' },
      espacos: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 2, '6': 1, '7': 1, '8': 1 } },
    { nivel: 17, bonusProficiencia: 6,
      caracteristicas: ['Metamagia'],
      colunas: { 'Pontos de Feitiçaria': '17', 'Truques': '6', 'Magias Preparadas': '19' },
      espacos: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 2, '6': 1, '7': 1, '8': 1, '9': 1 } },
    { nivel: 18, bonusProficiencia: 6,
      caracteristicas: ['Característica de Subclasse'],
      colunas: { 'Pontos de Feitiçaria': '18', 'Truques': '6', 'Magias Preparadas': '20' },
      espacos: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 3, '6': 1, '7': 1, '8': 1, '9': 1 } },
    { nivel: 19, bonusProficiencia: 6,
      caracteristicas: ['Dádiva Épica'],
      colunas: { 'Pontos de Feitiçaria': '19', 'Truques': '6', 'Magias Preparadas': '21' },
      espacos: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 3, '6': 2, '7': 1, '8': 1, '9': 1 } },
    { nivel: 20, bonusProficiencia: 6,
      caracteristicas: ['Apoteose Arcana'],
      colunas: { 'Pontos de Feitiçaria': '20', 'Truques': '6', 'Magias Preparadas': '22' },
      espacos: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 3, '6': 2, '7': 2, '8': 1, '9': 1 } },
  ],

  // Classes.md:3257-3276, sob "## Características de Classe de
  // Guardião" (linha 3249). Meia-conjuradora: só 5 círculos, sem
  // coluna de Truques (Guardião não recebe truques).
  'Guardião': [
    { nivel: 1, bonusProficiencia: 2,
      caracteristicas: ['Conjuração', 'Inimigo Favorito', 'Maestria em Arma'],
      colunas: { 'Inimigo Favorito': '2', 'Magias Preparadas': '2' },
      espacos: { '1': 2 } },
    { nivel: 2, bonusProficiencia: 2,
      caracteristicas: ['Estilo de Luta', 'Explorador Hábil'],
      colunas: { 'Inimigo Favorito': '2', 'Magias Preparadas': '3' },
      espacos: { '1': 2 } },
    { nivel: 3, bonusProficiencia: 2,
      caracteristicas: ['Subclasse de Guardião'],
      colunas: { 'Inimigo Favorito': '2', 'Magias Preparadas': '4' },
      espacos: { '1': 3 } },
    { nivel: 4, bonusProficiencia: 2,
      caracteristicas: ['Aumento no Valor de Atributo'],
      colunas: { 'Inimigo Favorito': '2', 'Magias Preparadas': '5' },
      espacos: { '1': 3 } },
    { nivel: 5, bonusProficiencia: 3,
      caracteristicas: ['Ataque Extra'],
      colunas: { 'Inimigo Favorito': '3', 'Magias Preparadas': '6' },
      espacos: { '1': 4, '2': 2 } },
    { nivel: 6, bonusProficiencia: 3,
      caracteristicas: ['Errante'],
      colunas: { 'Inimigo Favorito': '3', 'Magias Preparadas': '6' },
      espacos: { '1': 4, '2': 2 } },
    { nivel: 7, bonusProficiencia: 3,
      caracteristicas: ['Característica de Subclasse'],
      colunas: { 'Inimigo Favorito': '3', 'Magias Preparadas': '7' },
      espacos: { '1': 4, '2': 3 } },
    { nivel: 8, bonusProficiencia: 3,
      caracteristicas: ['Aumento no Valor de Atributo'],
      colunas: { 'Inimigo Favorito': '3', 'Magias Preparadas': '7' },
      espacos: { '1': 4, '2': 3 } },
    { nivel: 9, bonusProficiencia: 4,
      caracteristicas: ['Especialista'],
      colunas: { 'Inimigo Favorito': '4', 'Magias Preparadas': '9' },
      espacos: { '1': 4, '2': 3, '3': 2 } },
    { nivel: 10, bonusProficiencia: 4,
      caracteristicas: ['Incansável'],
      colunas: { 'Inimigo Favorito': '4', 'Magias Preparadas': '9' },
      espacos: { '1': 4, '2': 3, '3': 2 } },
    { nivel: 11, bonusProficiencia: 4,
      caracteristicas: ['Característica de Subclasse'],
      colunas: { 'Inimigo Favorito': '4', 'Magias Preparadas': '10' },
      espacos: { '1': 4, '2': 3, '3': 3 } },
    { nivel: 12, bonusProficiencia: 4,
      caracteristicas: ['Aumento no Valor de Atributo'],
      colunas: { 'Inimigo Favorito': '4', 'Magias Preparadas': '10' },
      espacos: { '1': 4, '2': 3, '3': 3 } },
    { nivel: 13, bonusProficiencia: 5,
      caracteristicas: ['Predador Implacável'],
      colunas: { 'Inimigo Favorito': '5', 'Magias Preparadas': '11' },
      espacos: { '1': 4, '2': 3, '3': 3, '4': 1 } },
    { nivel: 14, bonusProficiencia: 5,
      caracteristicas: ['Véu da Natureza'],
      colunas: { 'Inimigo Favorito': '5', 'Magias Preparadas': '11' },
      espacos: { '1': 4, '2': 3, '3': 3, '4': 1 } },
    { nivel: 15, bonusProficiencia: 5,
      caracteristicas: ['Característica de Subclasse'],
      colunas: { 'Inimigo Favorito': '5', 'Magias Preparadas': '12' },
      espacos: { '1': 4, '2': 3, '3': 3, '4': 2 } },
    { nivel: 16, bonusProficiencia: 5,
      caracteristicas: ['Aumento no Valor de Atributo'],
      colunas: { 'Inimigo Favorito': '5', 'Magias Preparadas': '12' },
      espacos: { '1': 4, '2': 3, '3': 3, '4': 2 } },
    { nivel: 17, bonusProficiencia: 6,
      caracteristicas: ['Caçador Preciso'],
      colunas: { 'Inimigo Favorito': '6', 'Magias Preparadas': '14' },
      espacos: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 1 } },
    { nivel: 18, bonusProficiencia: 6,
      caracteristicas: ['Sentidos Selvagens'],
      colunas: { 'Inimigo Favorito': '6', 'Magias Preparadas': '14' },
      espacos: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 1 } },
    { nivel: 19, bonusProficiencia: 6,
      caracteristicas: ['Dádiva Épica'],
      colunas: { 'Inimigo Favorito': '6', 'Magias Preparadas': '15' },
      espacos: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 2 } },
    { nivel: 20, bonusProficiencia: 6,
      caracteristicas: ['Matador de Inimigos Favoritos'],
      colunas: { 'Inimigo Favorito': '6', 'Magias Preparadas': '15' },
      espacos: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 2 } },
  ],

  // Classes.md:3783-3802. ARMADILHA DE LAYOUT (a mais séria das 12,
  // mais que a do Clérigo/Druida): a tabela do Guerreiro fica
  // FISICAMENTE ANTES do heading "## Características de Classe de
  // Guerreiro" (linha 3804) -- ela está colada dentro da seção "##
  // Como um Personagem Multiclasse" (linha 3774, que por sua vez usa
  // nível de heading "##" em vez do "###" usado pela mesma seção nas
  // outras classes, mais um sinal de que o Guerreiro quebra o
  // template do documento). Localizada pelo texto da coluna
  // "Recuperar Fôlego", não pelo heading. Sem conjuração -> espacos
  // sempre null.
  'Guerreiro': [
    { nivel: 1, bonusProficiencia: 2,
      caracteristicas: ['Estilo de Luta', 'Maestria em Arma', 'Recuperar Fôlego'],
      colunas: { 'Recuperar Fôlego': '2', 'Maestria em Arma': '3' },
      espacos: null },
    { nivel: 2, bonusProficiencia: 2,
      caracteristicas: ['Mente Tática', 'Surto de Ação'],
      colunas: { 'Recuperar Fôlego': '2', 'Maestria em Arma': '3' },
      espacos: null },
    { nivel: 3, bonusProficiencia: 2,
      caracteristicas: ['Subclasse de Guerreiro'],
      colunas: { 'Recuperar Fôlego': '2', 'Maestria em Arma': '3' },
      espacos: null },
    { nivel: 4, bonusProficiencia: 2,
      caracteristicas: ['Aumento no Valor de Atributo'],
      colunas: { 'Recuperar Fôlego': '3', 'Maestria em Arma': '4' },
      espacos: null },
    { nivel: 5, bonusProficiencia: 3,
      caracteristicas: ['Ajuste Tático', 'Ataque Extra'],
      colunas: { 'Recuperar Fôlego': '3', 'Maestria em Arma': '4' },
      espacos: null },
    { nivel: 6, bonusProficiencia: 3,
      caracteristicas: ['Aumento no Valor de Atributo'],
      colunas: { 'Recuperar Fôlego': '3', 'Maestria em Arma': '4' },
      espacos: null },
    { nivel: 7, bonusProficiencia: 3,
      caracteristicas: ['Característica de Subclasse'],
      colunas: { 'Recuperar Fôlego': '3', 'Maestria em Arma': '4' },
      espacos: null },
    { nivel: 8, bonusProficiencia: 3,
      caracteristicas: ['Aumento no Valor de Atributo'],
      colunas: { 'Recuperar Fôlego': '3', 'Maestria em Arma': '4' },
      espacos: null },
    { nivel: 9, bonusProficiencia: 4,
      caracteristicas: ['Indomável', 'Mestre Tático'],
      colunas: { 'Recuperar Fôlego': '3', 'Maestria em Arma': '4' },
      espacos: null },
    { nivel: 10, bonusProficiencia: 4,
      caracteristicas: ['Característica de Subclasse'],
      colunas: { 'Recuperar Fôlego': '4', 'Maestria em Arma': '5' },
      espacos: null },
    { nivel: 11, bonusProficiencia: 4,
      caracteristicas: ['Dois Ataques Extras'],
      colunas: { 'Recuperar Fôlego': '4', 'Maestria em Arma': '5' },
      espacos: null },
    { nivel: 12, bonusProficiencia: 4,
      caracteristicas: ['Aumento no Valor de Atributo'],
      colunas: { 'Recuperar Fôlego': '4', 'Maestria em Arma': '5' },
      espacos: null },
    { nivel: 13, bonusProficiencia: 5,
      caracteristicas: ['Ataques Estudados', 'Indomável'],
      colunas: { 'Recuperar Fôlego': '4', 'Maestria em Arma': '5' },
      espacos: null },
    { nivel: 14, bonusProficiencia: 5,
      caracteristicas: ['Aumento no Valor de Atributo'],
      colunas: { 'Recuperar Fôlego': '4', 'Maestria em Arma': '5' },
      espacos: null },
    { nivel: 15, bonusProficiencia: 5,
      caracteristicas: ['Característica de Subclasse'],
      colunas: { 'Recuperar Fôlego': '4', 'Maestria em Arma': '5' },
      espacos: null },
    { nivel: 16, bonusProficiencia: 5,
      caracteristicas: ['Aumento no Valor de Atributo'],
      colunas: { 'Recuperar Fôlego': '4', 'Maestria em Arma': '6' },
      espacos: null },
    { nivel: 17, bonusProficiencia: 6,
      caracteristicas: ['Indomável', 'Surto de Ação'],
      colunas: { 'Recuperar Fôlego': '4', 'Maestria em Arma': '6' },
      espacos: null },
    { nivel: 18, bonusProficiencia: 6,
      caracteristicas: ['Característica de Subclasse'],
      colunas: { 'Recuperar Fôlego': '4', 'Maestria em Arma': '6' },
      espacos: null },
    { nivel: 19, bonusProficiencia: 6,
      caracteristicas: ['Dádiva Épica'],
      colunas: { 'Recuperar Fôlego': '4', 'Maestria em Arma': '6' },
      espacos: null },
    { nivel: 20, bonusProficiencia: 6,
      caracteristicas: ['Três Ataques Extras'],
      colunas: { 'Recuperar Fôlego': '4', 'Maestria em Arma': '6' },
      espacos: null },
  ],

  // Classes.md:4183-4202, sob "## Características de Classe de
  // Ladino" (linha 4175). Sem conjuração -> espacos sempre null.
  'Ladino': [
    { nivel: 1, bonusProficiencia: 2,
      caracteristicas: ['Ataque Furtivo', 'Especialização', 'Gíria dos Ladrões', 'Maestria em Arma'],
      colunas: { 'Ataque Furtivo': '1d6' },
      espacos: null },
    { nivel: 2, bonusProficiencia: 2,
      caracteristicas: ['Ação Ardilosa'],
      colunas: { 'Ataque Furtivo': '1d6' },
      espacos: null },
    { nivel: 3, bonusProficiencia: 2,
      caracteristicas: ['Mira Firme', 'Subclasse Ladino'],
      colunas: { 'Ataque Furtivo': '2d6' },
      espacos: null },
    { nivel: 4, bonusProficiencia: 2,
      caracteristicas: ['Aumento no Valor de Atributo'],
      colunas: { 'Ataque Furtivo': '2d6' },
      espacos: null },
    { nivel: 5, bonusProficiencia: 3,
      caracteristicas: ['Esquiva Sobrenatural', 'Golpe Astuto'],
      colunas: { 'Ataque Furtivo': '3d6' },
      espacos: null },
    { nivel: 6, bonusProficiencia: 3,
      caracteristicas: ['Especialista'],
      colunas: { 'Ataque Furtivo': '3d6' },
      espacos: null },
    { nivel: 7, bonusProficiencia: 3,
      caracteristicas: ['Evasão', 'Talento Confiável'],
      colunas: { 'Ataque Furtivo': '4d6' },
      espacos: null },
    { nivel: 8, bonusProficiencia: 3,
      caracteristicas: ['Aumento no Valor de Atributo'],
      colunas: { 'Ataque Furtivo': '4d6' },
      espacos: null },
    { nivel: 9, bonusProficiencia: 4,
      caracteristicas: ['Característica de Subclasse'],
      colunas: { 'Ataque Furtivo': '5d6' },
      espacos: null },
    { nivel: 10, bonusProficiencia: 4,
      caracteristicas: ['Aumento no Valor de Atributo'],
      colunas: { 'Ataque Furtivo': '5d6' },
      espacos: null },
    { nivel: 11, bonusProficiencia: 4,
      caracteristicas: ['Golpe Astuto Aprimorado'],
      colunas: { 'Ataque Furtivo': '6d6' },
      espacos: null },
    { nivel: 12, bonusProficiencia: 4,
      caracteristicas: ['Aumento no Valor de Atributo'],
      colunas: { 'Ataque Furtivo': '6d6' },
      espacos: null },
    { nivel: 13, bonusProficiencia: 5,
      caracteristicas: ['Característica de Subclasse'],
      colunas: { 'Ataque Furtivo': '7d6' },
      espacos: null },
    { nivel: 14, bonusProficiencia: 5,
      caracteristicas: ['Golpes Sujos'],
      colunas: { 'Ataque Furtivo': '7d6' },
      espacos: null },
    { nivel: 15, bonusProficiencia: 5,
      caracteristicas: ['Mente Escorregadia'],
      colunas: { 'Ataque Furtivo': '8d6' },
      espacos: null },
    { nivel: 16, bonusProficiencia: 5,
      caracteristicas: ['Aumento no Valor de Atributo'],
      colunas: { 'Ataque Furtivo': '8d6' },
      espacos: null },
    { nivel: 17, bonusProficiencia: 6,
      caracteristicas: ['Característica de Subclasse'],
      colunas: { 'Ataque Furtivo': '9d6' },
      espacos: null },
    { nivel: 18, bonusProficiencia: 6,
      caracteristicas: ['Elusivo'],
      colunas: { 'Ataque Furtivo': '9d6' },
      espacos: null },
    { nivel: 19, bonusProficiencia: 6,
      caracteristicas: ['Dádiva Épica'],
      colunas: { 'Ataque Furtivo': '10d6' },
      espacos: null },
    { nivel: 20, bonusProficiencia: 6,
      caracteristicas: ['Golpe de Sorte'],
      colunas: { 'Ataque Furtivo': '10d6' },
      espacos: null },
  ],

  // Classes.md:4563-4582, sob "## Características de Classe de Mago"
  // (linha 4557). Coluna Magias Preparadas do Mago cresce mais rápido
  // que a das outras conjuradoras completas nos níveis 16-17 (21/22
  // em vez de 18/19) -- conferido contra o livro, não é erro de
  // digitação: é a única classe cuja tabela diverge das outras 3
  // conjuradoras completas (Bardo/Clérigo/Druida/Feiticeiro) nessa
  // coluna especificamente.
  'Mago': [
    { nivel: 1, bonusProficiencia: 2,
      caracteristicas: ['Adepto de Ritual', 'Conjuração', 'Recuperação Arcana'],
      colunas: { 'Truques': '3', 'Magias Preparadas': '4' },
      espacos: { '1': 2 } },
    { nivel: 2, bonusProficiencia: 2,
      caracteristicas: ['Acadêmico'],
      colunas: { 'Truques': '3', 'Magias Preparadas': '5' },
      espacos: { '1': 3 } },
    { nivel: 3, bonusProficiencia: 2,
      caracteristicas: ['Subclasse de Mago'],
      colunas: { 'Truques': '3', 'Magias Preparadas': '6' },
      espacos: { '1': 4, '2': 2 } },
    { nivel: 4, bonusProficiencia: 2,
      caracteristicas: ['Aumento no Valor de Atributo'],
      colunas: { 'Truques': '4', 'Magias Preparadas': '7' },
      espacos: { '1': 4, '2': 3 } },
    { nivel: 5, bonusProficiencia: 3,
      caracteristicas: ['Memorizar Magia'],
      colunas: { 'Truques': '4', 'Magias Preparadas': '9' },
      espacos: { '1': 4, '2': 3, '3': 2 } },
    { nivel: 6, bonusProficiencia: 3,
      caracteristicas: ['Característica de Subclasse'],
      colunas: { 'Truques': '4', 'Magias Preparadas': '10' },
      espacos: { '1': 4, '2': 3, '3': 3 } },
    { nivel: 7, bonusProficiencia: 3,
      caracteristicas: [],
      colunas: { 'Truques': '4', 'Magias Preparadas': '11' },
      espacos: { '1': 4, '2': 3, '3': 3, '4': 1 } },
    { nivel: 8, bonusProficiencia: 3,
      caracteristicas: ['Aumento no Valor de Atributo'],
      colunas: { 'Truques': '4', 'Magias Preparadas': '12' },
      espacos: { '1': 4, '2': 3, '3': 3, '4': 2 } },
    { nivel: 9, bonusProficiencia: 4,
      caracteristicas: [],
      colunas: { 'Truques': '4', 'Magias Preparadas': '14' },
      espacos: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 1 } },
    { nivel: 10, bonusProficiencia: 4,
      caracteristicas: ['Característica de Subclasse'],
      colunas: { 'Truques': '5', 'Magias Preparadas': '15' },
      espacos: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 2 } },
    { nivel: 11, bonusProficiencia: 4,
      caracteristicas: [],
      colunas: { 'Truques': '5', 'Magias Preparadas': '16' },
      espacos: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 2, '6': 1 } },
    { nivel: 12, bonusProficiencia: 4,
      caracteristicas: ['Aumento no Valor de Atributo'],
      colunas: { 'Truques': '5', 'Magias Preparadas': '16' },
      espacos: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 2, '6': 1 } },
    { nivel: 13, bonusProficiencia: 5,
      caracteristicas: [],
      colunas: { 'Truques': '5', 'Magias Preparadas': '17' },
      espacos: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 2, '6': 1, '7': 1 } },
    { nivel: 14, bonusProficiencia: 5,
      caracteristicas: ['Característica de Subclasse'],
      colunas: { 'Truques': '5', 'Magias Preparadas': '18' },
      espacos: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 2, '6': 1, '7': 1 } },
    { nivel: 15, bonusProficiencia: 5,
      caracteristicas: [],
      colunas: { 'Truques': '5', 'Magias Preparadas': '19' },
      espacos: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 2, '6': 1, '7': 1, '8': 1 } },
    { nivel: 16, bonusProficiencia: 5,
      caracteristicas: ['Aumento no Valor de Atributo'],
      colunas: { 'Truques': '5', 'Magias Preparadas': '21' },
      espacos: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 2, '6': 1, '7': 1, '8': 1 } },
    { nivel: 17, bonusProficiencia: 6,
      caracteristicas: [],
      colunas: { 'Truques': '5', 'Magias Preparadas': '22' },
      espacos: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 2, '6': 1, '7': 1, '8': 1, '9': 1 } },
    { nivel: 18, bonusProficiencia: 6,
      caracteristicas: ['Maestria de Magias'],
      colunas: { 'Truques': '5', 'Magias Preparadas': '23' },
      espacos: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 3, '6': 1, '7': 1, '8': 1, '9': 1 } },
    { nivel: 19, bonusProficiencia: 6,
      caracteristicas: ['Dádiva Épica'],
      colunas: { 'Truques': '5', 'Magias Preparadas': '24' },
      espacos: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 3, '6': 2, '7': 1, '8': 1, '9': 1 } },
    { nivel: 20, bonusProficiencia: 6,
      caracteristicas: ['Assinatura Mágica'],
      colunas: { 'Truques': '5', 'Magias Preparadas': '25' },
      espacos: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 3, '6': 2, '7': 2, '8': 1, '9': 1 } },
  ],

  // Classes.md:5138-5157, sob "## Características de Classe de
  // Monge" (linha 5132). Sem conjuração -> espacos sempre null.
  //
  // Nota (não ambígua, mas registrada): o livro grafa "Característica
  // de subclasse" com "s" minúsculo no nível 11 (linha 5148), único
  // caso das 240 linhas -- em todas as outras 19 ocorrências da mesma
  // frase, em qualquer classe, "Subclasse" vem com "S" maiúsculo.
  // Transcrito verbatim como o livro imprime, sem "corrigir" a
  // capitalização. Confirmado que `dados/classes/monge.json` reproduz
  // a mesma grafia minúscula -- ou seja, verbatim é o que mantém a
  // Task 4 honesta; normalizar teria criado uma divergência artificial
  // contra um app que transcreveu fielmente o mesmo ruído.
  //
  // Distinção com o caso do Paladino nível 1 (ponto no lugar de
  // vírgula, ver comentário do bloco Paladino abaixo), para não
  // confundir os dois critérios: lá o ruído muda o SIGNIFICADO da
  // célula (mudaria três características para duas), por isso foi
  // transcrito o significado, não o texto literal. Aqui o ruído é só
  // de caixa -- não muda o que a célula significa (ainda é "esta
  // classe recebe uma característica de subclasse neste nível") --
  // por isso foi transcrito o literal. O critério que decide qual dos
  // dois caminhos seguir é "o ruído altera o conteúdo da célula?", não
  // "o livro tem um erro de digitação?".
  'Monge': [
    { nivel: 1, bonusProficiencia: 2,
      caracteristicas: ['Artes Marciais', 'Defesa sem Armadura'],
      colunas: { 'Artes Marciais': '1d6', 'Pontos de Foco': '—', 'Movimento sem Armadura': '—' },
      espacos: null },
    { nivel: 2, bonusProficiencia: 2,
      caracteristicas: ['Foco do Monge', 'Movimento sem Armadura', 'Metabolismo Incomum'],
      colunas: { 'Artes Marciais': '1d6', 'Pontos de Foco': '2', 'Movimento sem Armadura': '+3 m' },
      espacos: null },
    { nivel: 3, bonusProficiencia: 2,
      caracteristicas: ['Defletir Ataques', 'Subclasse de Monge'],
      colunas: { 'Artes Marciais': '1d6', 'Pontos de Foco': '3', 'Movimento sem Armadura': '+3 m' },
      espacos: null },
    { nivel: 4, bonusProficiencia: 2,
      caracteristicas: ['Aumento no Valor de Atributo', 'Queda Lenta'],
      colunas: { 'Artes Marciais': '1d6', 'Pontos de Foco': '4', 'Movimento sem Armadura': '+3 m' },
      espacos: null },
    { nivel: 5, bonusProficiencia: 3,
      caracteristicas: ['Ataque Extra', 'Golpe Atordoante'],
      colunas: { 'Artes Marciais': '1d8', 'Pontos de Foco': '5', 'Movimento sem Armadura': '+3 m' },
      espacos: null },
    { nivel: 6, bonusProficiencia: 3,
      caracteristicas: ['Ataques Potencializados', 'Característica de Subclasse'],
      colunas: { 'Artes Marciais': '1d8', 'Pontos de Foco': '6', 'Movimento sem Armadura': '+4,5 m' },
      espacos: null },
    { nivel: 7, bonusProficiencia: 3,
      caracteristicas: ['Evasão'],
      colunas: { 'Artes Marciais': '1d8', 'Pontos de Foco': '7', 'Movimento sem Armadura': '+4,5 m' },
      espacos: null },
    { nivel: 8, bonusProficiencia: 3,
      caracteristicas: ['Aumento no Valor de Atributo'],
      colunas: { 'Artes Marciais': '1d8', 'Pontos de Foco': '8', 'Movimento sem Armadura': '+4,5 m' },
      espacos: null },
    { nivel: 9, bonusProficiencia: 4,
      caracteristicas: ['Movimento Acrobático'],
      colunas: { 'Artes Marciais': '1d8', 'Pontos de Foco': '9', 'Movimento sem Armadura': '+4,5 m' },
      espacos: null },
    { nivel: 10, bonusProficiencia: 4,
      caracteristicas: ['Autocura', 'Foco Aprimorado'],
      colunas: { 'Artes Marciais': '1d8', 'Pontos de Foco': '10', 'Movimento sem Armadura': '+6 m' },
      espacos: null },
    { nivel: 11, bonusProficiencia: 4,
      caracteristicas: ['Característica de subclasse'],
      colunas: { 'Artes Marciais': '1d10', 'Pontos de Foco': '11', 'Movimento sem Armadura': '+6 m' },
      espacos: null },
    { nivel: 12, bonusProficiencia: 4,
      caracteristicas: ['Aumento no Valor de Atributo'],
      colunas: { 'Artes Marciais': '1d10', 'Pontos de Foco': '12', 'Movimento sem Armadura': '+6 m' },
      espacos: null },
    { nivel: 13, bonusProficiencia: 5,
      caracteristicas: ['Defletir Energia'],
      colunas: { 'Artes Marciais': '1d10', 'Pontos de Foco': '13', 'Movimento sem Armadura': '+6 m' },
      espacos: null },
    { nivel: 14, bonusProficiencia: 5,
      caracteristicas: ['Sobrevivente Disciplinado'],
      colunas: { 'Artes Marciais': '1d10', 'Pontos de Foco': '14', 'Movimento sem Armadura': '+7,5 m' },
      espacos: null },
    { nivel: 15, bonusProficiencia: 5,
      caracteristicas: ['Foco Perfeito'],
      colunas: { 'Artes Marciais': '1d10', 'Pontos de Foco': '15', 'Movimento sem Armadura': '+7,5 m' },
      espacos: null },
    { nivel: 16, bonusProficiencia: 5,
      caracteristicas: ['Aumento no Valor de Atributo'],
      colunas: { 'Artes Marciais': '1d10', 'Pontos de Foco': '16', 'Movimento sem Armadura': '+7,5 m' },
      espacos: null },
    { nivel: 17, bonusProficiencia: 6,
      caracteristicas: ['Característica de Subclasse'],
      colunas: { 'Artes Marciais': '1d12', 'Pontos de Foco': '17', 'Movimento sem Armadura': '+7,5 m' },
      espacos: null },
    { nivel: 18, bonusProficiencia: 6,
      caracteristicas: ['Defesa Superior'],
      colunas: { 'Artes Marciais': '1d12', 'Pontos de Foco': '18', 'Movimento sem Armadura': '+9 m' },
      espacos: null },
    { nivel: 19, bonusProficiencia: 6,
      caracteristicas: ['Dádiva Épica'],
      colunas: { 'Artes Marciais': '1d12', 'Pontos de Foco': '19', 'Movimento sem Armadura': '+9 m' },
      espacos: null },
    { nivel: 20, bonusProficiencia: 6,
      caracteristicas: ['Corpo e Mente'],
      colunas: { 'Artes Marciais': '1d12', 'Pontos de Foco': '20', 'Movimento sem Armadura': '+9 m' },
      espacos: null },
  ],

  // Classes.md:5474-5493, sob "## Características de Paladino" (linha
  // 5469) -- NÃO sob "## Características de Classe de Paladino"
  // (linha 5495), que abre a prosa (ver nota grande em CITACOES no
  // topo do arquivo). Meia-conjuradora: só 5 círculos, sem coluna de
  // Truques, igual ao Guardião.
  //
  // AMBÍGUO/RUÍDO (linha 5474, nível 1) -- o único caso adjudicado
  // previamente no brief desta tarefa: o livro imprime "Conjuração,
  // Maestria em Arma. Mãos Consagradas", com PONTO onde deveria haver
  // vírgula entre a 2ª e a 3ª característica. São três características
  // (Conjuração; Maestria em Arma; Mãos Consagradas), não duas.
  // Correção de citação: o brief desta tarefa apontava a linha 5497
  // para esse ruído, mas 5497 é a frase de abertura da seção de
  // prosa ("Como Paladino, você recebe..."), não a linha da tabela. A
  // célula com o ruído real está em 5474, confirmada por leitura
  // direta do arquivo.
  'Paladino': [
    { nivel: 1, bonusProficiencia: 2,
      caracteristicas: ['Conjuração', 'Maestria em Arma', 'Mãos Consagradas'],
      colunas: { 'Canalizar Divindade': '—', 'Magias Preparadas': '2' },
      espacos: { '1': 2 } },
    { nivel: 2, bonusProficiencia: 2,
      caracteristicas: ['Destruição do Paladino', 'Estilo de Luta'],
      colunas: { 'Canalizar Divindade': '—', 'Magias Preparadas': '3' },
      espacos: { '1': 2 } },
    { nivel: 3, bonusProficiencia: 2,
      caracteristicas: ['Canalizar Divindade', 'Subclasse de Paladino'],
      colunas: { 'Canalizar Divindade': '2', 'Magias Preparadas': '4' },
      espacos: { '1': 3 } },
    { nivel: 4, bonusProficiencia: 2,
      caracteristicas: ['Aumento no Valor de Atributo'],
      colunas: { 'Canalizar Divindade': '2', 'Magias Preparadas': '5' },
      espacos: { '1': 3 } },
    { nivel: 5, bonusProficiencia: 3,
      caracteristicas: ['Ataque Extra', 'Montaria Fiel'],
      colunas: { 'Canalizar Divindade': '2', 'Magias Preparadas': '6' },
      espacos: { '1': 4, '2': 2 } },
    { nivel: 6, bonusProficiencia: 3,
      caracteristicas: ['Aura de Proteção'],
      colunas: { 'Canalizar Divindade': '2', 'Magias Preparadas': '6' },
      espacos: { '1': 4, '2': 2 } },
    { nivel: 7, bonusProficiencia: 3,
      caracteristicas: ['Característica de Subclasse'],
      colunas: { 'Canalizar Divindade': '2', 'Magias Preparadas': '7' },
      espacos: { '1': 4, '2': 3 } },
    { nivel: 8, bonusProficiencia: 3,
      caracteristicas: ['Aumento no Valor de Atributo'],
      colunas: { 'Canalizar Divindade': '2', 'Magias Preparadas': '7' },
      espacos: { '1': 4, '2': 3 } },
    { nivel: 9, bonusProficiencia: 4,
      caracteristicas: ['Repudiar Inimigos'],
      colunas: { 'Canalizar Divindade': '2', 'Magias Preparadas': '9' },
      espacos: { '1': 4, '2': 3, '3': 2 } },
    { nivel: 10, bonusProficiencia: 4,
      caracteristicas: ['Aura de Coragem'],
      colunas: { 'Canalizar Divindade': '2', 'Magias Preparadas': '9' },
      espacos: { '1': 4, '2': 3, '3': 2 } },
    { nivel: 11, bonusProficiencia: 4,
      caracteristicas: ['Golpes Radiantes'],
      colunas: { 'Canalizar Divindade': '3', 'Magias Preparadas': '10' },
      espacos: { '1': 4, '2': 3, '3': 3 } },
    { nivel: 12, bonusProficiencia: 4,
      caracteristicas: ['Aumento no Valor de Atributo'],
      colunas: { 'Canalizar Divindade': '3', 'Magias Preparadas': '10' },
      espacos: { '1': 4, '2': 3, '3': 3 } },
    { nivel: 13, bonusProficiencia: 5,
      caracteristicas: [],
      colunas: { 'Canalizar Divindade': '3', 'Magias Preparadas': '11' },
      espacos: { '1': 4, '2': 3, '3': 3, '4': 1 } },
    { nivel: 14, bonusProficiencia: 5,
      caracteristicas: ['Toque Restaurador'],
      colunas: { 'Canalizar Divindade': '3', 'Magias Preparadas': '11' },
      espacos: { '1': 4, '2': 3, '3': 3, '4': 1 } },
    { nivel: 15, bonusProficiencia: 5,
      caracteristicas: ['Característica de Subclasse'],
      colunas: { 'Canalizar Divindade': '3', 'Magias Preparadas': '12' },
      espacos: { '1': 4, '2': 3, '3': 3, '4': 2 } },
    { nivel: 16, bonusProficiencia: 5,
      caracteristicas: ['Aumento no Valor de Atributo'],
      colunas: { 'Canalizar Divindade': '3', 'Magias Preparadas': '12' },
      espacos: { '1': 4, '2': 3, '3': 3, '4': 2 } },
    { nivel: 17, bonusProficiencia: 6,
      caracteristicas: [],
      colunas: { 'Canalizar Divindade': '3', 'Magias Preparadas': '14' },
      espacos: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 1 } },
    { nivel: 18, bonusProficiencia: 6,
      caracteristicas: ['Aura Expandida'],
      colunas: { 'Canalizar Divindade': '3', 'Magias Preparadas': '14' },
      espacos: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 1 } },
    { nivel: 19, bonusProficiencia: 6,
      caracteristicas: ['Dádiva Épica'],
      colunas: { 'Canalizar Divindade': '3', 'Magias Preparadas': '15' },
      espacos: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 2 } },
    { nivel: 20, bonusProficiencia: 6,
      caracteristicas: ['Característica de Subclasse'],
      colunas: { 'Canalizar Divindade': '3', 'Magias Preparadas': '15' },
      espacos: { '1': 4, '2': 3, '3': 3, '4': 3, '5': 2 } },
  ],
};

// ============================================================
// Task 6 -- motor estrutural: rótulos que a coluna "Características de
// Classe" do livro usa para cada escolha que o app impõe por função
// própria em levelup.js. Cada função lá decide por uma LISTA HARD-CODED
// de níveis, independente de PROGRESSAO acima (concedeAumentoAtributo
// em levelup.js:399, exigeSubclasse:421, exigeEspecializacaoBardo:444,
// exigeEspecializacaoGuardiao:451, exigeEstiloLuta:458,
// exigeExploradorHabil:482, exigeAcademico:489, exigeDadivaEpica:70) --
// este mapa é o que permite confrontar as listas hard-coded com a
// tabela transcrita pela primeira vez.
//
// O valor é uma função (classe) => RegExp porque o rótulo de subclasse
// varia com o nome da classe. Conferido linha a linha contra
// PROGRESSAO acima (não contra o brief nem contra levelup.js) antes de
// fixar cada regex:
//   - "Subclasse Bárbaro" (sem "de", PROGRESSAO.Bárbaro nível 3),
//     "Subclasse Clérigo" (idem, nível 3) e "Subclasse Ladino" (idem,
//     nível 3) vs. "Subclasse de X" nas outras 9 classes -- o grupo
//     `(de )?` é opcional de propósito, cobre as duas grafias sem
//     precisar de uma regex por classe.
//   - Monge nível 11 grafa "Característica de subclasse" (s minúsculo)
//     -- não conflita com este rótulo porque o texto começa com
//     "Característica de", não com "Subclasse", e por isso nunca casa
//     com `subclasse(classe)` de nenhuma classe; citado aqui só para
//     registrar que a variação foi conferida e descartada, não
//     ignorada.
export const ROTULOS_GATILHO = {
  // `concedeAumentoAtributo` (levelup.js:399) NÃO é um espelho literal do
  // rótulo "Aumento no Valor de Atributo" -- ela é o portão do PASSO de
  // escolha ASI/talento do assistente de subida de nível (ver
  // `ganhaASI`/`ctx.ganhaASI` em levelup-flow.js e `ganhaAumentoAtributo`
  // em levelup.js). O livro abre esse MESMO passo no nível 19 -- só que
  // com Dádiva Épica em vez de ASI puro -- confirmado pela prosa de
  // "Nível 19: Dádiva Épica" nas 12 classes (ex. Classes.md:179, Bárbaro):
  // "Você adquire um talento Dádiva Épica... ou outro talento à sua
  // escolha para o qual atenda os pré-requisitos" -- ou seja, o próprio
  // livro descreve o nível 19 como "escolha um talento", o mesmo
  // mecanismo do ASI dos níveis 4/8/12/16. Por isso o rótulo aqui casa
  // com as DUAS células, não só com a literal.
  //
  // Isso NÃO perde poder de detecção: quem afirma a distinção entre "ASI
  // normal" e "Dádiva Épica" no nível 19 é `ROTULOS_GATILHO.dadivaEpica`,
  // testado separadamente contra `exigeDadivaEpica` (que passa nas 12
  // classes) -- a asserção específica continua existindo, só que no
  // gatilho certo. Ver task-6-report.md, Achado 1, para o rastreamento
  // completo de consequência que motivou esta correção.
  aumentoAtributo: () => /^(Aumento no Valor de Atributo|Dádiva Épica)$/,
  subclasse: (classe) => new RegExp(`^Subclasse (de )?${classe}$`),
  dadivaEpica: () => /^Dádiva Épica$/,
  // Bardo nível 2 "Especialista" e nível 9 "Especialização" são a MESMA
  // escolha do ponto de vista do app (exigeEspecializacaoBardo cobre os
  // dois níveis), com dois rótulos diferentes no livro
  // (PROGRESSAO.Bardo níveis 2 e 9).
  especializacaoBardo: () => /^(Especialista|Especialização)$/,
  // "Especialista" também aparece em Guardião nível 9 e Ladino nível 6
  // (PROGRESSAO), mas só dispara aqui porque o gatilho correspondente
  // em classes.test.mjs usa `apenas: ['Bardo']` -- fora do escopo dessa
  // lista, o esperado é `false`, não este rótulo.
  especializacaoGuardiao: () => /^Especialista$/,
  // Ladino nível 6, Classes.md:4188 (célula "Especialista" da tabela
  // "Características de Ladino"; prosa em Classes.md:4216) -- acrescentada
  // na Task 8 (2026-08-08) junto com exigeEspecializacaoLadino em
  // levelup.js, a NONA função de gatilho (a 8ª a mais nesta lista desde a
  // rodada anterior). Mesmo regex de especializacaoGuardiao (o rótulo do
  // livro é idêntico, "Especialista") -- o que diferencia as duas é o
  // `apenas` de cada entrada em GATILHOS (classes.test.mjs), não o rótulo.
  especializacaoLadino: () => /^Especialista$/,
  estiloLuta: () => /^Estilo de Luta$/,
  exploradorHabil: () => /^Explorador Hábil$/,
  academico: () => /^Acadêmico$/,
};

// Mestre da Batalha (Classes.md:4053 "## Mestre da Batalha", dentro de
// "# Subclasses de Guerreiro", Classes.md:3882) -- a subclasse concede
// manobras nos níveis 3, 7, 10 e 15, não a coluna de características
// do Guerreiro em si (que só traz "Subclasse de Guerreiro" no nível 3 e
// "Característica de Subclasse" nos níveis 7/10/15, sem número).
// Confirmado por leitura direta da seção antes de transcrever, não
// copiado do brief nem de getQuantidadeNovasManobras (levelup.js:496):
//   - Classes.md:4067 "Você aprende três manobras à sua escolha" --
//     nível 3, 3 manobras.
//   - Classes.md:4069 "Você aprende duas manobras adicionais à sua
//     escolha quando atinge os níveis 7, 10 e 15 de Guerreiro" -- 2
//     manobras em cada um desses três níveis.
// O nível 18 (Classes.md:4091, "Superioridade em Combate Suprema") só
// troca o Dado de Superioridade para d12 -- não concede manobra nova,
// por isso não entra neste mapa.
export const MANOBRAS_POR_NIVEL = { 3: 3, 7: 2, 10: 2, 15: 2 };

// ============================================================
// Teste converso (achado do bug do Ladino nv6 "Especialista", encontrado
// à mão fora desta suíte, 2026-08-07 -- ver GUIA-PROXIMOS-DOMINIOS.md):
// o laço de GATILHOS acima confere, POR FUNÇÃO, se ela dispara onde o
// livro manda -- mas nunca confere a pergunta oposta, que todo rótulo
// do livro que exige escolha tenha ALGUMA função que dispare. O motor
// converso em classes.test.mjs varre as 240 células perguntando isso, e
// precisa de uma exceção CURADA para o nível 1: as nove funções de
// levelup.js (a lista acima de GATILHOS -- oito até a Task 7, mais
// exigeEspecializacaoLadino acrescentada na Task 8) só são chamadas a
// partir do nível 2 -- `novoNivel`/`nivelNovo` é sempre `nivelAnterior + 1`
// com `nivelAnterior >= 1` (levelup.js:907, levelup-flow.js:32) -- então
// nenhuma delas jamais dispara no nível 1, mesmo quando o livro imprime
// um rótulo de escolha ali. As duas células em que isso acontece são
// legítimas: a escolha correspondente é feita na CRIAÇÃO do personagem,
// não na subida de nível, por um mecanismo diferente (curado por leitura
// direta do fluxo de criação, não suposto):
//   - Guerreiro, "Estilo de Luta" (Classes.md:3783, célula do nível 1 da
//     tabela "Características de Guerreiro"; prosa em Classes.md:3808-3812,
//     "### Nível 1: Estilo de Luta" -- já é a mesma célula de PROGRESSAO
//     confrontada pelo resto deste motor, só que no nível 1):
//     CLASSES_ESCOLHAS.Guerreiro.estilo_luta
//     (site/js/creator/comum.js:306-323, `nivelMinimo: 1`), renderizada
//     em site/js/creator/passo-classe.js:93-99 (filtro por nivelMinimo)
//     e :103-114 (render da lista de opções).
//   - Ladino, "Especialização" (Classes.md:4183, célula do nível 1 da
//     tabela "Características de Ladino"): CLASSES_ESCOLHAS.Ladino.especialista
//     (site/js/creator/comum.js:354-360, `nivelMinimo: 1, maxEscolhas: 2`),
//     mesma renderização de passo-classe.js, consolidada em
//     `personagem.pericias_expertise` por site/js/creator/wizard.js:461-468.
//
// Este conjunto é EXATO, não uma amostra: o teste correspondente falha
// se aparecer um rótulo de nível 1 fora dele -- para que uma classe
// futura que ganhe uma característica de escolha no nível 1 seja notada
// e decidida por alguém, em vez de a exclusão "nível 1 não conta" ficar
// cega para sempre (o mesmo erro que escondeu o bug do Ladino nv6: uma
// exclusão que nunca é reafirmada).
//
// ACHADO da revisão independente (Important 1, 2026-08-07): a primeira
// versão desta lista só citava CLASSES_ESCOLHAS em COMENTÁRIO -- o teste
// afirmava que o rótulo do LIVRO era exato, mas nunca confrontava se o
// mecanismo do APP existia de verdade. Prova do revisor: apagando
// `CLASSES_ESCOLHAS.Ladino.especialista` de site/js/creator/comum.js, a
// suíte inteira continuava 1031/987/0/44 verde -- a mesma forma do bug
// que abriu esta rodada inteira (uma exclusão nunca reafirmada), só que
// no lado do app em vez do lado do livro. `chaveEscolha` e `escolhas`
// abaixo existem para o teste importar CLASSES_ESCOLHAS de verdade (via
// modulosApp()) e confrontar: a chave existe, aceita nível 1
// (`nivelMinimo <= 1`) e pede a quantidade que o livro manda
// (`maxEscolhas === escolhas`) -- não é mais prosa.
export const EXCECOES_ESCOLHA_NIVEL_1 = [
  // Classes.md:3808-3812 ("Você aprimorou suas proezas marciais e tem um
  // talento de Estilo de Luta à sua escolha") -- 1 escolha.
  { classe: 'Guerreiro', rotulo: 'Estilo de Luta', chaveEscolha: 'estilo_luta', escolhas: 1 },
  // Classes.md:4212-4214 ("Você obtém Especialização ... em duas de suas
  // perícias, à sua escolha") -- 2 escolhas.
  { classe: 'Ladino', rotulo: 'Especialização', chaveEscolha: 'especialista', escolhas: 2 },
];
