// ============================================================
// Lista viva de escolhas LEGITIMAMENTE repetíveis: talentos em que
// escolher, de novo, exatamente o mesmo item que o talento acabou de
// conceder ainda tem efeito real segundo o livro -- o oposto do que
// unidade/escolha-morta.test.mjs normalmente exige (rejeição).
//
// Por que este arquivo NÃO é lacunas-conhecidas.mjs: aquela lista
// registra "o app diverge do livro" -- é o backlog real de bugs.
// Esta lista registra o oposto: "o app está CERTO em aceitar a
// repetição, porque o livro concede algo A MAIS nela". Misturar as
// duas quebraria o invariante de lacunas-conhecidas.mjs ("toda
// entrada é uma alegação de que o app está errado") -- ver
// testes/regras/README.md, seção "A mecânica de
// lacunas-conhecidas.mjs".
//
// Cada `motivo` precisa citar a seção do livro E o benefício extra
// concreto que a repetição concede -- motivo em branco é erro
// (checado em unidade/completude.test.mjs, mesmo padrão de higiene
// já aplicado a LACUNAS). Se o app um dia passar a REJEITAR a mesma
// escolha para um talento listado aqui, escolha-morta.test.mjs quebra
// pedindo a remoção da entrada -- mesma inversão de expectativa de
// comLacuna (harness.mjs), só que para a alegação oposta: aqui é a
// ACEITAÇÃO que precisa continuar acontecendo, não a falha.
// ============================================================

export const EXCECOES_ESCOLHA_REPETIDA = [
  {
    talento: 'Tocado Por Fadas',
    // Talentos.md §Tocado Por Fadas, benefício "Magia Feérica": a magia de
    // 1º círculo escolhida (mesmo que já fosse conhecida/preparada de outra
    // fonte) passa a ficar SEMPRE preparada e ganha uma conjuração grátis
    // (sem gastar espaço de magia) por Descanso Longo. Isso é um ganho real
    // mesmo quando a magia escolhida coincide com a da aquisição anterior --
    // validarEscolhasTalento não verifica nem precisa verificar "já
    // escolhida antes", porque não há estado dela que torne a repetição sem
    // efeito.
    motivo: 'Talentos.md §Tocado Por Fadas, "Magia Feérica": escolher de novo a mesma magia a ' +
      'torna sempre preparada e concede uma conjuração grátis por Descanso Longo -- benefício ' +
      'extra mesmo que a magia já fosse conhecida.',
  },
  {
    talento: 'Tocado Pelas Sombras',
    // Talentos.md §Tocado Pelas Sombras, benefício "Magia Sombria": mesma
    // mecânica de Tocado Por Fadas (sempre preparada + conjuração grátis por
    // Descanso Longo), lista de escolas de magia diferente.
    motivo: 'Talentos.md §Tocado Pelas Sombras, "Magia Sombria": mesmo benefício de Tocado Por ' +
      'Fadas -- a magia escolhida fica sempre preparada e ganha uma conjuração grátis por Descanso ' +
      'Longo, mesmo que já fosse conhecida.',
  },
  {
    talento: 'Conjurador Ritualista',
    // Talentos.md §Conjurador Ritualista, benefícios "Magias Rituais" +
    // "Ritual Rápido": as magias rituais escolhidas ficam sempre preparadas
    // (conjuráveis sem gastar espaço de magia) e, além disso, o talento
    // concede Ritual Rápido (conjurar a magia Ritual no tempo de conjuração
    // normal, em vez do tempo prolongado de um Ritual) -- dois ganhos reais
    // que não dependem da magia escolhida já ser conhecida ou não.
    motivo: 'Talentos.md §Conjurador Ritualista, "Magias Rituais" + "Ritual Rápido": as magias ' +
      'rituais escolhidas ficam sempre preparadas (conjuráveis sem espaço de magia) e o talento ' +
      'concede Ritual Rápido -- ganho extra mesmo que a magia já fosse conhecida/preparada de ' +
      'outra fonte.',
  },
  {
    talento: 'Dádiva da Resistência à Energia',
    // Talentos.md §Dádiva da Resistência à Energia, benefício
    // "Redirecionamento de Energia": a Reação se aplica "a um dos tipos
    // escolhidos" para o benefício "Resistências à Energia". Resistência em
    // si não empilha (duas fontes da mesma resistência não dobram nada),
    // mas ESCOLHER de novo, aqui, um tipo já resistido por outra fonte
    // (raça, talento anterior etc.) HABILITA a Reação de Redirecionamento
    // para aquele tipo -- que antes da escolha não existia.
    motivo: 'Talentos.md §Dádiva da Resistência à Energia, "Redirecionamento de Energia": a ' +
      'Reação se aplica "a um dos tipos escolhidos" para Resistências à Energia -- resistência não ' +
      'empilha, mas escolher de novo um tipo já resistido por outra fonte HABILITA a Reação para ' +
      'aquele tipo, que antes não existia.',
  },
];

// Busca a exceção registrada para um talento, se houver.
export function excecaoEscolhaRepetida(talento) {
  return EXCECOES_ESCOLHA_REPETIDA.find((e) => e.talento === talento) || null;
}
