// ============================================================
// Dados de referência das 12 classes do D&D 5.5 (2024)
// Informações hard-coded para cálculos e automação
// ============================================================
export const CLASSES_INFO = {
  "Bárbaro": {
    dado_vida: 12,
    atributo_primario: "Força",
    salvaguardas: ["Força", "Constituição"],
    armaduras: ["Leve", "Média", "Escudo"],
    armas: ["Simples", "Marcial"],
    pericias_opcoes: ["Lidar com Animais", "Atletismo", "Intimidação", "Natureza", "Percepção", "Sobrevivência"],
    num_pericias: 2,
    conjurador: false,
    atributo_conjuracao: null
  },
  "Bardo": {
    dado_vida: 8,
    atributo_primario: "Carisma",
    salvaguardas: ["Destreza", "Carisma"],
    armaduras: ["Leve"],
    armas: ["Simples"],
    pericias_opcoes: null, // Qualquer perícia
    num_pericias: 3,
    conjurador: true,
    atributo_conjuracao: "Carisma",
    tipo_conjuracao: "conhecidas"
  },
  "Bruxo": {
    dado_vida: 8,
    atributo_primario: "Carisma",
    salvaguardas: ["Sabedoria", "Carisma"],
    armaduras: ["Leve"],
    armas: ["Simples"],
    pericias_opcoes: ["Arcanismo", "Enganação", "História", "Intimidação", "Investigação", "Natureza", "Religião"],
    num_pericias: 2,
    conjurador: true,
    atributo_conjuracao: "Carisma",
    tipo_conjuracao: "conhecidas"
  },
  "Clérigo": {
    dado_vida: 8,
    atributo_primario: "Sabedoria",
    salvaguardas: ["Sabedoria", "Carisma"],
    armaduras: ["Leve", "Média", "Escudo"],
    armas: ["Simples"],
    pericias_opcoes: ["História", "Intuição", "Medicina", "Persuasão", "Religião"],
    num_pericias: 2,
    conjurador: true,
    atributo_conjuracao: "Sabedoria",
    tipo_conjuracao: "preparadas"
  },
  "Druida": {
    dado_vida: 8,
    atributo_primario: "Sabedoria",
    salvaguardas: ["Inteligência", "Sabedoria"],
    armaduras: ["Leve", "Escudo"],
    armas: ["Simples"],
    pericias_opcoes: ["Arcanismo", "Lidar com Animais", "Intuição", "Medicina", "Natureza", "Percepção", "Religião", "Sobrevivência"],
    num_pericias: 2,
    conjurador: true,
    atributo_conjuracao: "Sabedoria",
    tipo_conjuracao: "preparadas"
  },
  "Feiticeiro": {
    dado_vida: 6,
    atributo_primario: "Carisma",
    salvaguardas: ["Constituição", "Carisma"],
    armaduras: [],
    armas: ["Simples"],
    pericias_opcoes: ["Arcanismo", "Enganação", "Intuição", "Intimidação", "Persuasão", "Religião"],
    num_pericias: 2,
    conjurador: true,
    atributo_conjuracao: "Carisma",
    tipo_conjuracao: "conhecidas"
  },
  "Guardião": {
    dado_vida: 10,
    atributo_primario: "Destreza e Sabedoria",
    salvaguardas: ["Força", "Destreza"],
    armaduras: ["Leve", "Média", "Escudo"],
    armas: ["Simples", "Marcial"],
    pericias_opcoes: ["Lidar com Animais", "Atletismo", "Furtividade", "Intuição", "Investigação", "Natureza", "Percepção", "Sobrevivência"],
    num_pericias: 3,
    conjurador: true,
    atributo_conjuracao: "Sabedoria",
    tipo_conjuracao: "preparadas"
  },
  "Guerreiro": {
    dado_vida: 10,
    atributo_primario: "Força ou Destreza",
    salvaguardas: ["Força", "Constituição"],
    armaduras: ["Leve", "Média", "Pesada", "Escudo"],
    armas: ["Simples", "Marcial"],
    pericias_opcoes: ["Acrobacia", "Lidar com Animais", "Atletismo", "História", "Intimidação", "Intuição", "Percepção", "Persuasão", "Sobrevivência"],
    num_pericias: 2,
    conjurador: false,
    atributo_conjuracao: null
  },
  "Ladino": {
    dado_vida: 8,
    atributo_primario: "Destreza",
    salvaguardas: ["Destreza", "Inteligência"],
    armaduras: ["Leve"],
    armas: ["Simples", "Marcial (Acuidade)"],
    pericias_opcoes: ["Acrobacia", "Atletismo", "Enganação", "Furtividade", "Intimidação", "Intuição", "Investigação", "Percepção", "Persuasão", "Prestidigitação"],
    num_pericias: 4,
    conjurador: false,
    atributo_conjuracao: null
  },
  "Mago": {
    dado_vida: 6,
    atributo_primario: "Inteligência",
    salvaguardas: ["Inteligência", "Sabedoria"],
    armaduras: [],
    armas: ["Simples"],
    pericias_opcoes: ["Arcanismo", "História", "Intuição", "Investigação", "Medicina", "Religião"],
    num_pericias: 2,
    conjurador: true,
    atributo_conjuracao: "Inteligência",
    tipo_conjuracao: "preparadas"
  },
  "Monge": {
    dado_vida: 8,
    atributo_primario: "Destreza e Sabedoria",
    salvaguardas: ["Força", "Destreza"],
    armaduras: [],
    armas: ["Simples", "Marcial (Leve)"],
    pericias_opcoes: ["Acrobacia", "Atletismo", "Furtividade", "História", "Intuição", "Religião"],
    num_pericias: 2,
    conjurador: false,
    atributo_conjuracao: null
  },
  "Paladino": {
    dado_vida: 10,
    atributo_primario: "Força e Carisma",
    salvaguardas: ["Sabedoria", "Carisma"],
    armaduras: ["Leve", "Média", "Pesada", "Escudo"],
    armas: ["Simples", "Marcial"],
    pericias_opcoes: ["Atletismo", "Intimidação", "Intuição", "Medicina", "Persuasão", "Religião"],
    num_pericias: 2,
    conjurador: true,
    atributo_conjuracao: "Carisma",
    tipo_conjuracao: "preparadas"
  }
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
