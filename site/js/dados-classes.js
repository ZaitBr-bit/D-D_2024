// ============================================================
// Dados de referência das 12 classes do D&D 5.5 (2024)
// Informações hard-coded para cálculos e automação
// ============================================================
export const CLASSES_INFO = {
  "Bárbaro": {
    dado_vida: 12,
    atributo_primario: "Força",
    // Pré-requisito de multiclasse (livro:2361): 13+ em Força.
    atributos_primarios: { lista: ["Força"], conector: "e" },
    salvaguardas: ["Força", "Constituição"],
    armaduras: ["Leve", "Média", "Escudo"],
    armas: ["Simples", "Marcial"],
    pericias_opcoes: ["Lidar com Animais", "Atletismo", "Intimidação", "Natureza", "Percepção", "Sobrevivência"],
    num_pericias: 2,
    conjurador: false,
    atributo_conjuracao: null,
    // Bárbaro não conjura -- não soma nada ao nível de conjurador multiclasse.
    categoria_conjuracao: "nenhuma",
    // Proficiências concedidas ao adquirir Bárbaro como classe ADICIONAL
    // (livro:2385): armas Marciais e treinamento com Escudos apenas --
    // SEM Simples e SEM armadura Leve/Média (diferente da classe única).
    proficiencias_multiclasse: {
      armaduras: ["Escudo"], armas: ["Marcial"], pericias: 0,
      ferramentas: [], instrumentos: 0, salvaguardas: [],
    },
  },
  "Bardo": {
    dado_vida: 8,
    atributo_primario: "Carisma",
    // Pré-requisito de multiclasse (livro:2691): 13+ em Carisma.
    atributos_primarios: { lista: ["Carisma"], conector: "e" },
    salvaguardas: ["Destreza", "Carisma"],
    armaduras: ["Leve"],
    armas: ["Simples"],
    pericias_opcoes: null, // Qualquer perícia
    num_pericias: 3,
    conjurador: true,
    atributo_conjuracao: "Carisma",
    tipo_conjuracao: "conhecidas",
    // Conjurador pleno: soma o nível inteiro ao nível de conjurador multiclasse.
    categoria_conjuracao: "plena",
    // Proficiências concedidas ao adquirir Bardo como classe ADICIONAL
    // (livro:2716): uma perícia à escolha, um Instrumento Musical à
    // escolha e treinamento com armadura Leve. Sem armas.
    proficiencias_multiclasse: {
      armaduras: ["Leve"], armas: [], pericias: 1,
      ferramentas: [], instrumentos: 1, salvaguardas: [],
    },
  },
  "Bruxo": {
    dado_vida: 8,
    atributo_primario: "Carisma",
    // Pré-requisito de multiclasse (livro:3172): 13+ em Carisma.
    atributos_primarios: { lista: ["Carisma"], conector: "e" },
    salvaguardas: ["Sabedoria", "Carisma"],
    armaduras: ["Leve"],
    armas: ["Simples"],
    pericias_opcoes: ["Arcanismo", "Enganação", "História", "Intimidação", "Investigação", "Natureza", "Religião"],
    num_pericias: 2,
    conjurador: true,
    atributo_conjuracao: "Carisma",
    tipo_conjuracao: "conhecidas",
    // Conjuração de Pacto: reserva SEPARADA da soma de níveis de
    // conjurador multiclasse (livro:2118), não entra na tabela comum.
    categoria_conjuracao: "pacto",
    // Proficiências concedidas ao adquirir Bruxo como classe ADICIONAL
    // (livro:3198): Dado de Ponto de Vida e treinamento com armadura
    // Leve. Sem armas, sem perícia.
    proficiencias_multiclasse: {
      armaduras: ["Leve"], armas: [], pericias: 0,
      ferramentas: [], instrumentos: 0, salvaguardas: [],
    },
  },
  "Clérigo": {
    dado_vida: 8,
    atributo_primario: "Sabedoria",
    // Pré-requisito de multiclasse (livro:3833): 13+ em Sabedoria.
    atributos_primarios: { lista: ["Sabedoria"], conector: "e" },
    salvaguardas: ["Sabedoria", "Carisma"],
    armaduras: ["Leve", "Média", "Escudo"],
    armas: ["Simples"],
    pericias_opcoes: ["História", "Intuição", "Medicina", "Persuasão", "Religião"],
    num_pericias: 2,
    conjurador: true,
    atributo_conjuracao: "Sabedoria",
    tipo_conjuracao: "preparadas",
    // Conjurador pleno: soma o nível inteiro ao nível de conjurador multiclasse.
    categoria_conjuracao: "plena",
    // Proficiências concedidas ao adquirir Clérigo como classe ADICIONAL
    // (livro:3857): treinamento com armadura Leve, Média e Escudos. Sem
    // armas, sem perícia.
    proficiencias_multiclasse: {
      armaduras: ["Leve", "Média", "Escudo"], armas: [], pericias: 0,
      ferramentas: [], instrumentos: 0, salvaguardas: [],
    },
  },
  "Druida": {
    dado_vida: 8,
    atributo_primario: "Sabedoria",
    // Pré-requisito de multiclasse (livro:4319): 13+ em Sabedoria.
    atributos_primarios: { lista: ["Sabedoria"], conector: "e" },
    salvaguardas: ["Inteligência", "Sabedoria"],
    armaduras: ["Leve", "Escudo"],
    armas: ["Simples"],
    pericias_opcoes: ["Arcanismo", "Lidar com Animais", "Intuição", "Medicina", "Natureza", "Percepção", "Religião", "Sobrevivência"],
    num_pericias: 2,
    conjurador: true,
    atributo_conjuracao: "Sabedoria",
    tipo_conjuracao: "preparadas",
    // Conjurador pleno: soma o nível inteiro ao nível de conjurador multiclasse.
    categoria_conjuracao: "plena",
    // Proficiências concedidas ao adquirir Druida como classe ADICIONAL
    // (livro:4344): treinamento com armadura Leve e Escudos. Sem armas,
    // sem perícia.
    proficiencias_multiclasse: {
      armaduras: ["Leve", "Escudo"], armas: [], pericias: 0,
      ferramentas: [], instrumentos: 0, salvaguardas: [],
    },
  },
  "Feiticeiro": {
    dado_vida: 6,
    atributo_primario: "Carisma",
    // Pré-requisito de multiclasse (livro:4935): 13+ em Carisma.
    atributos_primarios: { lista: ["Carisma"], conector: "e" },
    salvaguardas: ["Constituição", "Carisma"],
    armaduras: [],
    armas: ["Simples"],
    pericias_opcoes: ["Arcanismo", "Enganação", "Intuição", "Intimidação", "Persuasão", "Religião"],
    num_pericias: 2,
    conjurador: true,
    atributo_conjuracao: "Carisma",
    tipo_conjuracao: "conhecidas",
    // Conjurador pleno: soma o nível inteiro ao nível de conjurador multiclasse.
    categoria_conjuracao: "plena",
    // Proficiências concedidas ao adquirir Feiticeiro como classe
    // ADICIONAL (livro:4953): "Adquira o Dado de Ponto de Vida da tabela
    // Traços Básicos de Feiticeiro." Nada além disso: zero proficiências.
    proficiencias_multiclasse: {
      armaduras: [], armas: [], pericias: 0,
      ferramentas: [], instrumentos: 0, salvaguardas: [],
    },
  },
  "Guardião": {
    dado_vida: 10,
    atributo_primario: "Destreza e Sabedoria",
    // Pré-requisito de multiclasse (livro:5574): 13+ em Destreza E Sabedoria.
    atributos_primarios: { lista: ["Destreza", "Sabedoria"], conector: "e" },
    salvaguardas: ["Força", "Destreza"],
    armaduras: ["Leve", "Média", "Escudo"],
    armas: ["Simples", "Marcial"],
    pericias_opcoes: ["Lidar com Animais", "Atletismo", "Furtividade", "Intuição", "Investigação", "Natureza", "Percepção", "Sobrevivência"],
    num_pericias: 3,
    conjurador: true,
    atributo_conjuracao: "Sabedoria",
    tipo_conjuracao: "preparadas",
    // Meio conjurador: metade dos níveis ARREDONDADA PARA CIMA (livro:2107).
    // Conjura desde o nível 1 no PHB 2024, não nível 2.
    categoria_conjuracao: "meia",
    // Proficiências concedidas ao adquirir Guardião como classe ADICIONAL
    // (livro:5596): armas Marciais, uma perícia à escolha da lista de
    // Guardião e treinamento com armaduras Leves, Médias e Escudos.
    proficiencias_multiclasse: {
      armaduras: ["Leve", "Média", "Escudo"], armas: ["Marcial"], pericias: 1,
      ferramentas: [], instrumentos: 0, salvaguardas: [],
    },
  },
  "Guerreiro": {
    dado_vida: 10,
    atributo_primario: "Força ou Destreza",
    // Guerreiro é a ÚNICA classe cujo pré-requisito de multiclasse é
    // alternativa: basta 13+ em Força OU em Destreza (livro:6104).
    atributos_primarios: { lista: ["Força", "Destreza"], conector: "ou" },
    salvaguardas: ["Força", "Constituição"],
    armaduras: ["Leve", "Média", "Pesada", "Escudo"],
    armas: ["Simples", "Marcial"],
    pericias_opcoes: ["Acrobacia", "Lidar com Animais", "Atletismo", "História", "Intimidação", "Intuição", "Percepção", "Persuasão", "Sobrevivência"],
    num_pericias: 2,
    conjurador: false,
    atributo_conjuracao: null,
    // Conjura só com a subclasse Cavaleiro Místico, a partir do nível 3.
    categoria_conjuracao: "um_terco_subclasse",
    // Proficiências concedidas ao adquirir Guerreiro como classe
    // ADICIONAL (livro:6126): armas Marciais e treinamento com
    // armaduras Leves, Médias e Escudos. Sem perícia.
    proficiencias_multiclasse: {
      armaduras: ["Leve", "Média", "Escudo"], armas: ["Marcial"], pericias: 0,
      ferramentas: [], instrumentos: 0, salvaguardas: [],
    },
  },
  "Ladino": {
    dado_vida: 8,
    atributo_primario: "Destreza",
    salvaguardas: ["Destreza", "Inteligência"],
    // Pré-requisito de multiclasse (livro:6497): 13+ em Destreza.
    atributos_primarios: { lista: ["Destreza"], conector: "e" },
    armaduras: ["Leve"],
    // Classes.md:4152: "Armas Simples e Armas Marciais que tem a propriedade
    // Acuidade ou Leve" -- as duas propriedades, não só Acuidade. Um único
    // item "Marcial (...)" (não dois itens separados) preserva a categoria
    // "Marcial" única esperada pelos dois consumidores que resolvem esta
    // string contra a propriedade de uma arma específica
    // (creator/passo-equipamento.js:temProficienciaArma e
    // sheet/condicoes.js:sheetTemProfArma) -- ambos já fazem
    // `info.armas.some(a => a.includes('Leve'))` (mesma checagem usada para
    // o Monge), então bastou incluir a palavra "Leve" em algum item de
    // `armas`; nenhum dos dois arquivos precisou mudar.
    armas: ["Simples", "Marcial (Acuidade ou Leve)"],
    pericias_opcoes: ["Acrobacia", "Atletismo", "Enganação", "Furtividade", "Intimidação", "Intuição", "Investigação", "Percepção", "Persuasão", "Prestidigitação"],
    num_pericias: 4,
    conjurador: false,
    atributo_conjuracao: null,
    // Conjura só com a subclasse Trapaceiro Arcano, a partir do nível 3.
    categoria_conjuracao: "um_terco_subclasse",
    // Proficiências concedidas ao adquirir Ladino como classe ADICIONAL
    // (livro:6522): uma perícia à escolha da lista de Ladino, Ferramentas
    // de Ladrão e treinamento com armadura Leve. Sem armas.
    proficiencias_multiclasse: {
      armaduras: ["Leve"], armas: [], pericias: 1,
      ferramentas: ["Ferramentas de Ladrão"], instrumentos: 0, salvaguardas: [],
    },
  },
  "Mago": {
    dado_vida: 6,
    atributo_primario: "Inteligência",
    // Pré-requisito de multiclasse (livro:6884): 13+ em Inteligência.
    atributos_primarios: { lista: ["Inteligência"], conector: "e" },
    salvaguardas: ["Inteligência", "Sabedoria"],
    armaduras: [],
    armas: ["Simples"],
    pericias_opcoes: ["Arcanismo", "História", "Intuição", "Investigação", "Medicina", "Religião"],
    num_pericias: 2,
    conjurador: true,
    atributo_conjuracao: "Inteligência",
    tipo_conjuracao: "preparadas",
    // Conjurador pleno: soma o nível inteiro ao nível de conjurador multiclasse.
    categoria_conjuracao: "plena",
    // Proficiências concedidas ao adquirir Mago como classe ADICIONAL
    // (livro:6904): "Adquira o Dado de Ponto de Vida da tabela Traços
    // Básicos de Mago." Nada além disso: zero proficiências.
    proficiencias_multiclasse: {
      armaduras: [], armas: [], pericias: 0,
      ferramentas: [], instrumentos: 0, salvaguardas: [],
    },
  },
  "Monge": {
    dado_vida: 8,
    atributo_primario: "Destreza e Sabedoria",
    // Pré-requisito de multiclasse (livro:7452): 13+ em Destreza E Sabedoria.
    atributos_primarios: { lista: ["Destreza", "Sabedoria"], conector: "e" },
    salvaguardas: ["Força", "Destreza"],
    armaduras: [],
    armas: ["Simples", "Marcial (Leve)"],
    pericias_opcoes: ["Acrobacia", "Atletismo", "Furtividade", "História", "Intuição", "Religião"],
    num_pericias: 2,
    conjurador: false,
    atributo_conjuracao: null,
    // Monge não conjura -- não soma nada ao nível de conjurador multiclasse.
    categoria_conjuracao: "nenhuma",
    // Proficiências concedidas ao adquirir Monge como classe ADICIONAL
    // (livro:7479): "Adquira o traço Dado de Ponto de Vida da tabela
    // Traços Básicos de Monge." Nada além disso: zero proficiências.
    proficiencias_multiclasse: {
      armaduras: [], armas: [], pericias: 0,
      ferramentas: [], instrumentos: 0, salvaguardas: [],
    },
  },
  "Paladino": {
    dado_vida: 10,
    atributo_primario: "Força e Carisma",
    // Dois atributos primários: exige 13+ nos DOIS (livro:7790 + 2033).
    atributos_primarios: { lista: ["Força", "Carisma"], conector: "e" },
    salvaguardas: ["Sabedoria", "Carisma"],
    armaduras: ["Leve", "Média", "Pesada", "Escudo"],
    armas: ["Simples", "Marcial"],
    pericias_opcoes: ["Atletismo", "Intimidação", "Intuição", "Medicina", "Persuasão", "Religião"],
    num_pericias: 2,
    conjurador: true,
    atributo_conjuracao: "Carisma",
    tipo_conjuracao: "preparadas",
    // Meio conjurador: metade dos níveis ARREDONDADA PARA CIMA
    // (livro:2107). Conjura desde o nível 1 no PHB 2024, não nível 2.
    categoria_conjuracao: "meia",
    // Proficiências concedidas ao adquirir Paladino como classe ADICIONAL
    // (livro:7815): armas Marciais e treinamento com armaduras Leves,
    // Médias e Escudos. Sem perícia.
    proficiencias_multiclasse: {
      armaduras: ["Leve", "Média", "Escudo"], armas: ["Marcial"], pericias: 0,
      ferramentas: [], instrumentos: 0, salvaguardas: [],
    },
  }
};

export const ESCOLAS_SUBCLASSE_MAGO = {
  'Abjurador': 'Abjuração',
  'Adivinhador': 'Adivinhação',
  'Evocador': 'Evocação',
  'Ilusionista': 'Ilusão'
};

// Lista completa de todas as perícias com seus atributos associados
export const PERICIAS = [
  { nome: "Acrobacia", atributo: "Destreza" },
  { nome: "Lidar com Animais", atributo: "Sabedoria" },
  { nome: "Arcanismo", atributo: "Inteligência" },
  { nome: "Atletismo", atributo: "Força" },
  { nome: "Atuação", atributo: "Carisma" },
  { nome: "Enganação", atributo: "Carisma" },
  { nome: "Furtividade", atributo: "Destreza" },
  { nome: "História", atributo: "Inteligência" },
  { nome: "Intimidação", atributo: "Carisma" },
  { nome: "Intuição", atributo: "Sabedoria" },
  { nome: "Investigação", atributo: "Inteligência" },
  { nome: "Medicina", atributo: "Sabedoria" },
  { nome: "Natureza", atributo: "Inteligência" },
  { nome: "Percepção", atributo: "Sabedoria" },
  { nome: "Persuasão", atributo: "Carisma" },
  { nome: "Prestidigitação", atributo: "Destreza" },
  { nome: "Religião", atributo: "Inteligência" },
  { nome: "Sobrevivência", atributo: "Sabedoria" }
];

// Nomes legíveis dos atributos
export const ATRIBUTOS_NOMES = {
  forca: "Força",
  destreza: "Destreza",
  constituicao: "Constituição",
  inteligencia: "Inteligência",
  sabedoria: "Sabedoria",
  carisma: "Carisma"
};

// Array base para atributos (nome da chave em JS)
export const ATRIBUTOS_KEYS = ["forca", "destreza", "constituicao", "inteligencia", "sabedoria", "carisma"];

// Mapeamento de nomes de atributos para chaves
export const ATRIBUTO_NOME_PARA_KEY = {
  "Força": "forca",
  "Destreza": "destreza",
  "Constituição": "constituicao",
  "Inteligência": "inteligencia",
  "Sabedoria": "sabedoria",
  "Carisma": "carisma"
};

// Standard Array para distribuição de atributos
export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];

// Custo de point buy por valor de atributo
export const POINT_BUY_CUSTOS = {
  8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9
};
export const POINT_BUY_TOTAL = 27;
