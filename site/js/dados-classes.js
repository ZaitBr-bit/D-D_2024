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

// Nível obrigatório de subclasse por classe.
// Movido de site/js/pages/creator.js (Task 8) para este módulo de dados
// puros — creator.js depende de document/window e não pode ser importado
// por scripts/content/migrate-classes.mjs (roda em Node), então a fonte de
// verdade única precisava viver aqui.
export const NIVEL_SUBCLASSE = {
  'Bárbaro': 3, 'Bardo': 3, 'Bruxo': 3, 'Clérigo': 3, 'Druida': 3,
  'Feiticeiro': 3, 'Guardião': 3, 'Guerreiro': 3, 'Ladino': 3,
  'Mago': 3, 'Monge': 3, 'Paladino': 3
};

// Escolhas obrigatórias de classe fora da progressão padrão de nível
// (Ordem Divina/Primal, Estilo de Luta, Especialista/Acadêmico). Movido de
// site/js/pages/creator.js pelo mesmo motivo de NIVEL_SUBCLASSE acima.
export const CLASSES_ESCOLHAS = {
  'Clérigo': {
    ordem_divina: {
      titulo: 'Ordem Divina',
      descricao: 'Escolha seu papel sagrado. Isso afeta suas proficiências e habilidades.',
      maxEscolhas: 1,
      opcoes: [
        { nome: 'Protetor', descricao: 'Proficiência com armas Marciais e Armadura Pesada', efeito: { armaduras: ['Pesada'], armas: ['Marcial'] } },
        { nome: 'Taumaturgo', descricao: '+1 truque de Clérigo e bônus em Arcanismo/Religião', efeito: { truques_extra: 1 } }
      ]
    }
  },
  'Druida': {
    ordem_primal: {
      titulo: 'Ordem Primal',
      descricao: 'Escolha sua ordem primal. Isso afeta proficiências e conjuração.',
      maxEscolhas: 1,
      opcoes: [
        { nome: 'Protetor', descricao: 'Proficiência com armas Marciais e Armadura Média', efeito: { armaduras: ['Média'], armas: ['Marcial'] } },
        { nome: 'Xamã', descricao: '+1 truque de Druida e bônus em Arcanismo/Natureza', efeito: { truques_extra: 1 } }
      ]
    }
  },
  'Guerreiro': {
    estilo_luta: {
      titulo: 'Estilo de Luta',
      descricao: 'Escolha um talento de Estilo de Luta.',
      nivelMinimo: 1,
      maxEscolhas: 1,
      opcoes: [
        { nome: 'Arquearia', descricao: '+2 em ataques à distância com armas' },
        { nome: 'Arremesso', descricao: '+2 de dano com armas de Arremesso' },
        { nome: 'Armas Grandes', descricao: 'Trata 1-2 como 3 nos dados de dano (duas mãos)' },
        { nome: 'Duas Armas', descricao: 'Adiciona mod. ao dano da mão secundária' },
        { nome: 'Desarmado', descricao: 'Dano desarmado d6/d8+For' },
        { nome: 'Defensivo', descricao: '+1 CA usando armadura' },
        { nome: 'Duelismo', descricao: '+2 dano com uma arma em uma mão' },
        { nome: 'Interceptação', descricao: 'Reduz dano a aliado em 1d10+Prof' },
        { nome: 'Luta às Cegas', descricao: 'Visão Cega 3m, 9m se cego' },
        { nome: 'Protetivo', descricao: 'Impõe desvantagem em ataques contra aliados' }
      ]
    }
  },
  'Guardião': {
    estilo_luta: {
      titulo: 'Estilo de Luta (Nível 2)',
      descricao: 'Escolha um talento de Estilo de Luta (ou Combatente Druídico).',
      nivelMinimo: 2,
      maxEscolhas: 1,
      opcoes: [
        { nome: 'Arquearia', descricao: '+2 em ataques à distância com armas' },
        { nome: 'Arremesso', descricao: '+2 de dano com armas de Arremesso' },
        { nome: 'Armas Grandes', descricao: 'Trata 1-2 como 3 nos dados de dano (duas mãos)' },
        { nome: 'Duas Armas', descricao: 'Adiciona mod. ao dano da mão secundária' },
        { nome: 'Desarmado', descricao: 'Dano desarmado d6/d8+For' },
        { nome: 'Defensivo', descricao: '+1 CA usando armadura' },
        { nome: 'Duelismo', descricao: '+2 dano com uma arma em uma mão' },
        { nome: 'Interceptação', descricao: 'Reduz dano a aliado em 1d10+Prof' },
        { nome: 'Luta às Cegas', descricao: 'Visão Cega 3m, 9m se cego' },
        { nome: 'Protetivo', descricao: 'Impõe desvantagem em ataques contra aliados' },
        { nome: 'Combatente Druídico', descricao: 'Aprende 2 truques de Druida; pode trocá-los ao subir de nível' }
      ]
    },
    especialista: {
      titulo: 'Explorador Hábil: Especialista (Nível 2)',
      descricao: 'Escolha 1 perícia na qual você já tenha proficiência para ganhar Especialização.',
      nivelMinimo: 2,
      maxEscolhas: 1,
      tipo: 'pericias'
    }
  },
  'Ladino': {
    especialista: {
      titulo: 'Especialização',
      descricao: 'Escolha 2 perícias nas quais você já tem proficiência para ter Especialização (dobra o bônus).',
      nivelMinimo: 1,
      maxEscolhas: 2,
      tipo: 'pericias' // indica que deve usar lista de perícias do personagem
    }
  },
  'Paladino': {
    estilo_luta: {
      titulo: 'Estilo de Luta (Nível 2)',
      descricao: 'Escolha um talento de Estilo de Luta (ou Combatente Abençoado).',
      nivelMinimo: 2,
      maxEscolhas: 1,
      opcoes: [
        { nome: 'Arquearia', descricao: '+2 em ataques à distância com armas' },
        { nome: 'Arremesso', descricao: '+2 de dano com armas de Arremesso' },
        { nome: 'Armas Grandes', descricao: 'Trata 1-2 como 3 nos dados de dano (duas mãos)' },
        { nome: 'Duas Armas', descricao: 'Adiciona mod. ao dano da mão secundária' },
        { nome: 'Desarmado', descricao: 'Dano desarmado d6/d8+For' },
        { nome: 'Defensivo', descricao: '+1 CA usando armadura' },
        { nome: 'Duelismo', descricao: '+2 dano com uma arma em uma mão' },
        { nome: 'Interceptação', descricao: 'Reduz dano a aliado em 1d10+Prof' },
        { nome: 'Luta às Cegas', descricao: 'Visão Cega 3m, 9m se cego' },
        { nome: 'Protetivo', descricao: 'Impõe desvantagem em ataques contra aliados' },
        { nome: 'Combatente Abençoado', descricao: 'Aprende 2 truques de Clérigo; pode trocá-los ao subir de nível' }
      ]
    }
  },
  'Mago': {
    academico: {
      titulo: 'Acadêmico (Nível 2)',
      descricao: 'Escolha 2 perícias para Especialização: Arcanismo, História, Investigação, Medicina, Natureza ou Religião.',
      nivelMinimo: 2,
      maxEscolhas: 2,
      tipo: 'pericias_fixas',
      opcoes_fixas: ['Arcanismo', 'História', 'Investigação', 'Medicina', 'Natureza', 'Religião']
    }
  }
};
