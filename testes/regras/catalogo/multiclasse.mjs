// ============================================================
// Regras de multiclasse do PHB 2024, transcritas do livro.
//
// Fonte: `Informacoes Separadas/D&D 5.5 - Livro do Jogador (2024)
// 5.3.7.md`, capítulo 2, seção "Multiclasse" (linhas 2027-2120), e as
// 12 seções "Como um Personagem Multiclasse" de `Classes.md`.
//
// REGRA DURA: cada valor aqui foi lido do LIVRO. Nada foi copiado de
// `dados/classes/*.json` nem de `site/js/dados-classes.js` -- são
// exatamente as duas fontes que os motores confrontam contra este
// arquivo. Um catálogo gerado a partir delas bateria 12/12 sem provar
// nada, porque o app estaria sendo comparado consigo mesmo.
// ============================================================

// Pré-requisito de multiclasse: 13+ no atributo primário da classe nova
// E das classes atuais (livro:2033). Classes com dois atributos
// primários exigem 13+ nos DOIS, salvo quando o livro escreve "ou".
// `lista` e `conector` foram lidos da linha "Atributo Primário" da
// tabela "Traços Básicos de X" de cada classe (números de linha no
// comentário de cada entrada). GUERREIRO é a única com conector 'ou'
// ("Força ou Destreza", livro:6104) -- Guardião (livro:5574) e Monge
// (livro:7452) têm "Destreza e Sabedoria", Paladino (livro:7790) tem
// "Força e Carisma": os três exigem os DOIS atributos em conjunto.
export const PRE_REQUISITOS = {
  'Bárbaro':    { lista: ['Força'],                    conector: 'e' },  // livro:2361
  'Bardo':      { lista: ['Carisma'],                  conector: 'e' },  // livro:2691
  'Bruxo':      { lista: ['Carisma'],                  conector: 'e' },  // livro:3172
  'Clérigo':    { lista: ['Sabedoria'],                conector: 'e' },  // livro:3833
  'Druida':     { lista: ['Sabedoria'],                conector: 'e' },  // livro:4319
  'Feiticeiro': { lista: ['Carisma'],                  conector: 'e' },  // livro:4935
  'Guardião':   { lista: ['Destreza', 'Sabedoria'],    conector: 'e' },  // livro:5574
  'Guerreiro':  { lista: ['Força', 'Destreza'],        conector: 'ou' }, // livro:6104
  'Ladino':     { lista: ['Destreza'],                 conector: 'e' },  // livro:6497
  'Mago':       { lista: ['Inteligência'],             conector: 'e' },  // livro:6884
  'Monge':      { lista: ['Destreza', 'Sabedoria'],    conector: 'e' },  // livro:7452
  'Paladino':   { lista: ['Força', 'Carisma'],         conector: 'e' },  // livro:7790
};

// Proficiências concedidas ao adquirir o PRIMEIRO nível numa classe que
// não é a inicial (livro:2049-2051). É um SUBCONJUNTO das proficiências
// de classe única. Nenhuma classe concede salvaguardas aqui -- as duas
// salvaguardas de personagem vêm só da classe inicial (livro:2049).
// `pericias` e `instrumentos` são quantidades a escolher, não listas.
// Cada linha abaixo foi lida do bullet "Como um Personagem Multiclasse"
// da classe correspondente (número de linha no comentário).
//
// Note o que a transcrição afirma e o teste da Tarefa 5 vai cobrar:
// MAGO, MONGE e FEITICEIRO concedem exatamente zero proficiências -- só
// o Dado de Ponto de Vida (confirmado: os três bullets do livro citam
// apenas "Dado de Ponto de Vida", sem nenhuma outra proficiência). E o
// BÁRBARO concede armas Marciais mas NÃO Simples, e Escudos mas NÃO
// armadura Leve ou Média -- ao contrário do que a proficiência de
// classe única (armaduras Leve/Média/Escudo, armas Simples/Marcial)
// faria supor.
export const PROFICIENCIAS_MULTICLASSE = {
  // livro:2385 -- "proficiência com armas Marciais e treinamento com
  // Escudos". Sem Simples, sem Leve/Média.
  'Bárbaro':    { armaduras: ['Escudo'],                    armas: ['Marcial'], pericias: 0, ferramentas: [], instrumentos: 0 },
  // livro:2716 -- "proficiência em uma perícia à sua escolha,
  // proficiência com um Instrumento Musical à sua escolha e
  // treinamento com armadura Leve". Sem armas.
  'Bardo':      { armaduras: ['Leve'],                      armas: [],          pericias: 1, ferramentas: [], instrumentos: 1 },
  // livro:3198 -- "Dado de Ponto de Vida e treinamento com armadura
  // Leve". Sem armas, sem perícia.
  'Bruxo':      { armaduras: ['Leve'],                      armas: [],          pericias: 0, ferramentas: [], instrumentos: 0 },
  // livro:3857 -- "treinamento com armadura Leve, Média e Escudos".
  // Sem armas, sem perícia.
  'Clérigo':    { armaduras: ['Leve', 'Média', 'Escudo'],   armas: [],          pericias: 0, ferramentas: [], instrumentos: 0 },
  // livro:4344 -- "treinamento com armadura Leve e Escudos". Sem
  // armas, sem perícia.
  'Druida':     { armaduras: ['Leve', 'Escudo'],            armas: [],          pericias: 0, ferramentas: [], instrumentos: 0 },
  // livro:4953 -- "Adquira o Dado de Ponto de Vida da tabela Traços
  // Básicos de Feiticeiro." Nada além disso: zero proficiências.
  'Feiticeiro': { armaduras: [],                            armas: [],          pericias: 0, ferramentas: [], instrumentos: 0 },
  // livro:5596 -- "proficiência com armas Marciais, proficiência em
  // uma perícia à sua escolha da lista de perícias de Guardião e
  // treinamento com armaduras Leves, Médias e Escudos".
  'Guardião':   { armaduras: ['Leve', 'Média', 'Escudo'],   armas: ['Marcial'], pericias: 1, ferramentas: [], instrumentos: 0 },
  // livro:6126 -- "proficiência com armas Marciais e treinamento com
  // armaduras Leves e Médias e Escudos". Sem perícia.
  'Guerreiro':  { armaduras: ['Leve', 'Média', 'Escudo'],   armas: ['Marcial'], pericias: 0, ferramentas: [], instrumentos: 0 },
  // livro:6522 -- "proficiência em uma perícia à sua escolha da lista
  // de perícias do Ladino, proficiência com Ferramentas de Ladrão e
  // treinamento com armadura Leve". Sem armas.
  'Ladino':     { armaduras: ['Leve'],                      armas: [],          pericias: 1, ferramentas: ['Ferramentas de Ladrão'], instrumentos: 0 },
  // livro:6904 -- "Adquira o Dado de Ponto de Vida da tabela Traços
  // Básicos de Mago." Nada além disso: zero proficiências.
  'Mago':       { armaduras: [],                            armas: [],          pericias: 0, ferramentas: [], instrumentos: 0 },
  // livro:7479 -- "Adquira o traço Dado de Ponto de Vida da tabela
  // Traços Básicos de Monge." Nada além disso: zero proficiências.
  'Monge':      { armaduras: [],                            armas: [],          pericias: 0, ferramentas: [], instrumentos: 0 },
  // livro:7815 -- "proficiência com armas Marciais e treinamento com
  // armaduras Leves, Médias e Escudos". Sem perícia.
  'Paladino':   { armaduras: ['Leve', 'Média', 'Escudo'],   armas: ['Marcial'], pericias: 0, ferramentas: [], instrumentos: 0 },
};

// Peso de cada classe na soma do nível de conjurador (livro:2104-2110).
// 'plena'  = nível inteiro
// 'meia'   = metade ARREDONDADA PARA CIMA (livro:2107)
// 'um_terco_subclasse' = um terço arredondado para baixo, e SÓ com a
//            subclasse conjuradora (Cavaleiro Místico / Trapaceiro Arcano)
// 'pacto'  = reserva SEPARADA, fora desta tabela (livro:2118)
// 'nenhuma'= não soma nada
//
// Paladino e Guardião conjuram desde o NÍVEL 1 no PHB 2024, não nível 2
// (diferente da edição de 2014) -- por isso entram como conjuradoras de
// peso 'meia', não 'nenhuma'.
export const CATEGORIA_CONJURACAO = {
  'Bárbaro': 'nenhuma',      'Bardo': 'plena',
  'Bruxo': 'pacto',          'Clérigo': 'plena',
  'Druida': 'plena',         'Feiticeiro': 'plena',
  'Guardião': 'meia',        'Guerreiro': 'um_terco_subclasse',
  'Ladino': 'um_terco_subclasse', 'Mago': 'plena',
  'Monge': 'nenhuma',        'Paladino': 'meia',
};

// Tabela "Conjurador Multiclasse: Espaços de Magia por Círculo de
// Magia" (livro:2079-2100). Índice = nível de conjurador (1..20). Cada
// valor é [1º, 2º, 3º, 4º, 5º, 6º, 7º, 8º, 9º], com 0 onde o livro
// traz "—". Transcrita olhando o livro linha a linha, não derivada de
// nenhuma tabela de classe.
export const TABELA_CONJURADOR_MULTICLASSE = {
  1:  [2, 0, 0, 0, 0, 0, 0, 0, 0],
  2:  [3, 0, 0, 0, 0, 0, 0, 0, 0],
  3:  [4, 2, 0, 0, 0, 0, 0, 0, 0],
  4:  [4, 3, 0, 0, 0, 0, 0, 0, 0],
  5:  [4, 3, 2, 0, 0, 0, 0, 0, 0],
  6:  [4, 3, 3, 0, 0, 0, 0, 0, 0],
  7:  [4, 3, 3, 1, 0, 0, 0, 0, 0],
  8:  [4, 3, 3, 2, 0, 0, 0, 0, 0],
  9:  [4, 3, 3, 3, 1, 0, 0, 0, 0],
  10: [4, 3, 3, 3, 2, 0, 0, 0, 0],
  11: [4, 3, 3, 3, 2, 1, 0, 0, 0],
  12: [4, 3, 3, 3, 2, 1, 0, 0, 0],
  13: [4, 3, 3, 3, 2, 1, 1, 0, 0],
  14: [4, 3, 3, 3, 2, 1, 1, 0, 0],
  15: [4, 3, 3, 3, 2, 1, 1, 1, 0],
  16: [4, 3, 3, 3, 2, 1, 1, 1, 0],
  17: [4, 3, 3, 3, 2, 1, 1, 1, 1],
  18: [4, 3, 3, 3, 3, 1, 1, 1, 1],
  19: [4, 3, 3, 3, 3, 2, 1, 1, 1],
  20: [4, 3, 3, 3, 3, 2, 2, 1, 1],
};

export const CITACOES = {
  prerequisito: 'D&D 5.5 - Livro do Jogador (2024) 5.3.7.md:2033',
  proficiencias: 'Classes.md §Como um Personagem Multiclasse (12 seções)',
  conjuracao: 'D&D 5.5 - Livro do Jogador (2024) 5.3.7.md:2104-2110',
  tabela: 'D&D 5.5 - Livro do Jogador (2024) 5.3.7.md:2085-2102',
};
