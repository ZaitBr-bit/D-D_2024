// ============================================================
// Catálogo de regras de antecedentes, curado à mão a partir do
// livro (Informacoes Separadas/Antecedente.md). É a FONTE DA
// VERDADE dos testes de regras: os motores em ../unidade/ e
// ../../e2e/regras/ confrontam o app com o que está declarado
// aqui — nunca o contrário. Nenhum valor aqui foi copiado de
// dados/origens/antecedentes.json; é exatamente esse arquivo que
// um motor de unidade futuro vai confrontar contra este catálogo,
// e copiar dali tornaria esse confronto circular.
//
// Só entra campo verificável por máquina. Idiomas ficam de fora de
// propósito: o livro os trata como regra de criação de personagem
// ("Comum e mais dois idiomas...", Criação de Personagens.md:143),
// não como parte do antecedente — Antecedente.md:19-32 lista
// exatamente cinco partes e idioma não é uma delas — mesmo
// dados/origens/antecedentes.json modelando idioma por antecedente
// (escolha de modelagem do app, não divergência; ver
// docs/superpowers/plans/2026-08-07-regras-antecedentes.md, seção
// "Pré-voo").
// ============================================================

// Os dois formatos que o campo `ferramenta` pode assumir. O teste
// de completude rejeita tipo fora desta lista.
export const TIPOS_FERRAMENTA = ['especifica', 'categoria'];

// As categorias pelas quais o livro pede "escolha um tipo de X"
// para a proficiência com ferramenta de um antecedente. O
// texto-resumo de Antecedente.md:29 ("Proficiência com
// Ferramentas") só menciona Ferramentas de Artesão como alternativa
// de categoria — mas, olhando cada antecedente individualmente,
// Guarda/Nobre/Soldado pedem categoria para Kit de Jogos e Artista
// pede para Instrumento Musical. O texto de cada antecedente
// governa sobre o resumo do capítulo (mesmo princípio de "o livro
// governa" do guia de domínios).
export const CATEGORIA_FERRAMENTA = {
  ARTESAO: 'Ferramentas de Artesão',
  INSTRUMENTO_MUSICAL: 'Instrumento Musical',
  KIT_DE_JOGOS: 'Kit de Jogos',
};

// Marcador usado dentro de `equipamento.pacote.itens` quando o
// livro descreve o item do pacote como "a mesma [ferramenta] que
// acima" / "o mesmo [kit] que acima" — ou seja, o nome do item não
// é fixo: é uma referência à própria escolha feita no campo
// `ferramenta` desta entrada (só aparece quando `ferramenta.tipo`
// é 'categoria'). Um teste resolve o marcador comparando-o com o
// nome que o personagem realmente escolheu, em vez de comparar uma
// string literal que o livro nunca fixou.
export const MESMA_FERRAMENTA_ESCOLHIDA = '<mesma ferramenta escolhida>';

export const CATALOGO_ANTECEDENTES = {
  'Acólito': {
    livro: 'Antecedente.md §Acólito',
    atributos: ['inteligencia', 'sabedoria', 'carisma'],
    // Livro: "Iniciado em Magia (Clérigo) (veja o capítulo 5)". O
    // primeiro parêntese NÃO é a citação de capítulo (essa é o
    // "(veja o capítulo 5)", removido) — é a lista de magias que o
    // próprio talento pede como escolha (Talentos.md §Iniciado em
    // Magia: escolha `lista_magias` com opções Clérigo/Druida/Mago).
    // Por isso o nome fica idêntico ao do catálogo de talentos
    // ('Iniciado em Magia', sem parêntese), para sobreviver ao
    // cruzamento com talentos.mjs — e a escolha específica de lista
    // vira um campo à parte, verificável contra o mesmo talento.
    talento: 'Iniciado em Magia',
    talentoParametro: 'Clérigo',
    pericias: ['Intuição', 'Religião'],
    ferramenta: { tipo: 'especifica', nome: 'Suprimentos de Calígrafo' },
    equipamento: {
      poAlternativo: 50,
      pacote: {
        itens: ['Suprimentos de Calígrafo', 'Livro (orações)', 'Símbolo Sagrado', 'Pergaminho (10 folhas)', 'Túnica'],
        ouroIncluido: 8,
      },
    },
  },
  'Andarilho': {
    livro: 'Antecedente.md §Andarilho',
    atributos: ['destreza', 'sabedoria', 'carisma'],
    talento: 'Sortudo',
    pericias: ['Furtividade', 'Intuição'],
    ferramenta: { tipo: 'especifica', nome: 'Ferramentas de Ladrão' },
    equipamento: {
      poAlternativo: 50,
      pacote: {
        itens: ['2 Adagas', 'Ferramentas de Ladrão', 'Kit de Jogos (qualquer um)', '2 Algibeiras', 'Roupas de Viagem', 'Saco de Dormir'],
        ouroIncluido: 16,
      },
    },
  },
  'Artesão': {
    livro: 'Antecedente.md §Artesão',
    atributos: ['forca', 'destreza', 'inteligencia'],
    talento: 'Artifista',
    pericias: ['Investigação', 'Persuasão'],
    // "Escolha um tipo de Ferramentas de Artesão" — o único dos 16
    // que usa a categoria citada no resumo do capítulo (Antecedente.md:29).
    ferramenta: { tipo: 'categoria', categoria: CATEGORIA_FERRAMENTA.ARTESAO },
    equipamento: {
      poAlternativo: 50,
      pacote: {
        // Livro: "Ferramentas de Artesão (a mesma que acima)" — o
        // item não é um nome fixo, ver MESMA_FERRAMENTA_ESCOLHIDA.
        itens: [MESMA_FERRAMENTA_ESCOLHIDA, '2 Algibeiras', 'Roupas de Viagem'],
        ouroIncluido: 32,
      },
    },
  },
  'Artista': {
    livro: 'Antecedente.md §Artista',
    atributos: ['forca', 'destreza', 'carisma'],
    talento: 'Músico',
    pericias: ['Acrobacia', 'Atuação'],
    // "Escolha um tipo de Instrumento Musical" — categoria que o
    // resumo do capítulo não cita (só fala de Ferramentas de
    // Artesão); ver comentário de CATEGORIA_FERRAMENTA acima.
    ferramenta: { tipo: 'categoria', categoria: CATEGORIA_FERRAMENTA.INSTRUMENTO_MUSICAL },
    equipamento: {
      poAlternativo: 50,
      pacote: {
        // Livro: "Instrumento Musical (o mesmo que acima)".
        itens: [MESMA_FERRAMENTA_ESCOLHIDA, 'Espelho', '2 Fantasias', 'Perfume', 'Roupas de Viagem'],
        ouroIncluido: 11,
      },
    },
  },
  'Charlatão': {
    livro: 'Antecedente.md §Charlatão',
    atributos: ['destreza', 'constituicao', 'carisma'],
    talento: 'Habilidoso',
    pericias: ['Enganação', 'Prestidigitação'],
    ferramenta: { tipo: 'especifica', nome: 'Kit de Falsificação' },
    equipamento: {
      poAlternativo: 50,
      pacote: {
        itens: ['Kit de Falsificação', 'Fantasia', 'Roupas Finas'],
        ouroIncluido: 15,
      },
    },
  },
  'Criminoso': {
    livro: 'Antecedente.md §Criminoso',
    atributos: ['destreza', 'constituicao', 'inteligencia'],
    talento: 'Alerta',
    pericias: ['Furtividade', 'Prestidigitação'],
    ferramenta: { tipo: 'especifica', nome: 'Ferramentas de Ladrão' },
    equipamento: {
      poAlternativo: 50,
      pacote: {
        itens: ['2 Adagas', 'Ferramentas de Ladrão', '2 Algibeiras', 'Pé de Cabra', 'Roupas de Viagem'],
        ouroIncluido: 16,
      },
    },
  },
  'Eremita': {
    livro: 'Antecedente.md §Eremita',
    atributos: ['constituicao', 'sabedoria', 'carisma'],
    talento: 'Curandeiro',
    pericias: ['Medicina', 'Religião'],
    ferramenta: { tipo: 'especifica', nome: 'Kit de Herbalismo' },
    equipamento: {
      poAlternativo: 50,
      pacote: {
        itens: ['Cajado', 'Kit de Herbalismo', 'Lâmpada', 'Livro (filosofia)', 'Óleo (3 frascos)', 'Roupas de Viagem', 'Saco de Dormir'],
        ouroIncluido: 16,
      },
    },
  },
  'Escriba': {
    livro: 'Antecedente.md §Escriba',
    atributos: ['destreza', 'inteligencia', 'sabedoria'],
    talento: 'Habilidoso',
    pericias: ['Investigação', 'Percepção'],
    ferramenta: { tipo: 'especifica', nome: 'Suprimentos de Calígrafo' },
    equipamento: {
      poAlternativo: 50,
      pacote: {
        itens: ['Suprimentos de Calígrafo', 'Lâmpada', 'Óleo (3 frascos)', 'Pergaminho (12 folhas)', 'Roupas Finas'],
        ouroIncluido: 23,
      },
    },
  },
  'Fazendeiro': {
    livro: 'Antecedente.md §Fazendeiro',
    atributos: ['forca', 'constituicao', 'sabedoria'],
    talento: 'Vigoroso',
    pericias: ['Lidar com Animais', 'Natureza'],
    ferramenta: { tipo: 'especifica', nome: 'Ferramentas de Carpinteiro' },
    equipamento: {
      poAlternativo: 50,
      pacote: {
        itens: ['Foice', 'Ferramentas de Carpinteiro', 'Kit de Curandeiro', 'Balde de Ferro', 'Pá'],
        ouroIncluido: 30,
      },
    },
  },
  'Guarda': {
    livro: 'Antecedente.md §Guarda',
    atributos: ['forca', 'inteligencia', 'sabedoria'],
    talento: 'Alerta',
    pericias: ['Atletismo', 'Percepção'],
    // "Escolha um tipo de Kit de Jogos" — mesma observação de Artista.
    ferramenta: { tipo: 'categoria', categoria: CATEGORIA_FERRAMENTA.KIT_DE_JOGOS },
    equipamento: {
      poAlternativo: 50,
      pacote: {
        // Livro: "Kit de Jogo (o mesmo que acima)".
        itens: ['Lança', 'Besta Leve', '20 Virotes', MESMA_FERRAMENTA_ESCOLHIDA, 'Aljava', 'Grilhões', 'Lanterna Coberta', 'Roupas de Viagem'],
        ouroIncluido: 12,
      },
    },
  },
  'Guia': {
    livro: 'Antecedente.md §Guia',
    atributos: ['destreza', 'constituicao', 'sabedoria'],
    // Mesmo caso de Acólito: "Iniciado em Magia (Druida)" — o
    // parêntese é a lista de magias do talento, não a citação de
    // capítulo (essa vem depois, "(veja o capítulo 5)", removida).
    talento: 'Iniciado em Magia',
    talentoParametro: 'Druida',
    pericias: ['Furtividade', 'Sobrevivência'],
    ferramenta: { tipo: 'especifica', nome: 'Ferramentas de Cartógrafo' },
    equipamento: {
      poAlternativo: 50,
      pacote: {
        itens: ['Arco Curto', '20 Flechas', 'Ferramentas de Cartógrafo', 'Aljava', 'Roupas de Viagem', 'Saco de Dormir', 'Tenda'],
        ouroIncluido: 3,
      },
    },
  },
  'Marinheiro': {
    livro: 'Antecedente.md §Marinheiro',
    atributos: ['forca', 'destreza', 'sabedoria'],
    talento: 'Valentão de Taverna',
    pericias: ['Acrobacia', 'Percepção'],
    ferramenta: { tipo: 'especifica', nome: 'Ferramentas de Navegador' },
    equipamento: {
      poAlternativo: 50,
      pacote: {
        itens: ['Adaga', 'Ferramentas de Navegador', 'Corda', 'Roupas de Viagem'],
        ouroIncluido: 20,
      },
    },
  },
  'Mercador': {
    livro: 'Antecedente.md §Mercador',
    atributos: ['constituicao', 'inteligencia', 'carisma'],
    talento: 'Sortudo',
    pericias: ['Lidar com Animais', 'Persuasão'],
    ferramenta: { tipo: 'especifica', nome: 'Ferramentas de Navegador' },
    equipamento: {
      poAlternativo: 50,
      pacote: {
        itens: ['Ferramentas de Navegador', '2 Algibeiras', 'Roupas de Viagem'],
        ouroIncluido: 22,
      },
    },
  },
  'Nobre': {
    livro: 'Antecedente.md §Nobre',
    atributos: ['forca', 'inteligencia', 'carisma'],
    talento: 'Habilidoso',
    pericias: ['História', 'Persuasão'],
    // "Escolha um tipo de Kit de Jogos" — mesma observação de Guarda/Soldado.
    ferramenta: { tipo: 'categoria', categoria: CATEGORIA_FERRAMENTA.KIT_DE_JOGOS },
    equipamento: {
      poAlternativo: 50,
      pacote: {
        // Livro: "Kit de Jogos (o mesmo que acima)".
        itens: [MESMA_FERRAMENTA_ESCOLHIDA, 'Perfume', 'Roupas Finas'],
        ouroIncluido: 29,
      },
    },
  },
  'Sábio': {
    livro: 'Antecedente.md §Sábio',
    atributos: ['constituicao', 'inteligencia', 'sabedoria'],
    // Mesmo caso de Acólito/Guia: "Iniciado em Magia (Mago)".
    talento: 'Iniciado em Magia',
    talentoParametro: 'Mago',
    pericias: ['Arcanismo', 'História'],
    ferramenta: { tipo: 'especifica', nome: 'Suprimentos de Calígrafo' },
    equipamento: {
      poAlternativo: 50,
      pacote: {
        itens: ['Cajado', 'Suprimentos de Calígrafo', 'Livro (história)', 'Pergaminho (8 folhas)', 'Túnica'],
        ouroIncluido: 8,
      },
    },
  },
  'Soldado': {
    livro: 'Antecedente.md §Soldado',
    atributos: ['forca', 'destreza', 'constituicao'],
    talento: 'Atacante Selvagem',
    pericias: ['Atletismo', 'Intimidação'],
    // "Escolha um tipo de Kit de Jogos" — mesma observação de Guarda/Nobre.
    ferramenta: { tipo: 'categoria', categoria: CATEGORIA_FERRAMENTA.KIT_DE_JOGOS },
    equipamento: {
      poAlternativo: 50,
      pacote: {
        // Livro: "Kit de Jogo (o mesmo que acima)".
        itens: ['Lança', 'Arco Curto', '20 Flechas', 'Kit de Curandeiro', MESMA_FERRAMENTA_ESCOLHIDA, 'Aljava', 'Roupas de Viagem'],
        ouroIncluido: 14,
      },
    },
  },
};
