// ============================================================
// Tabelas transversais da ficha, transcritas do livro.
// Este catálogo é DIFERENTE dos de talentos e antecedentes: não
// há entidades a curar, há tabelas fechadas a transcrever. Por
// isso o motor que o consome faz varredura exaustiva, não
// amostragem — o domínio de entrada é finito e pequeno.
//
// Fonte: `Informacoes Separadas/Criação de Personagens.md` (linhas
// 244-263, 412-421, 441-443, 466-491) e `Informacoes Separadas/Abreviações
// e Definição de Regras.md` (linhas 259-263, 762-766), mais
// `Informacoes Separadas/Magias.md` (linhas 179-189, CD e ataque de magia
// -- duplicata textual da fórmula de Criação de Personagens.md:441-443,
// usada aqui porque tem cabeçalhos `###` próprios para citar).
// Transcrito, não interpretado — nenhum valor aqui foi calculado com a
// fórmula do app (`Math.floor((v-10)/2)` em site/js/utils.js); cada par
// valor→modificador e cada tripla nível→XP→BP veio de ler a linha
// da tabela do livro.
// ============================================================

// Citações por tabela/fórmula. Nenhuma é usada dentro deste arquivo —
// cada uma é consumida por um teste do motor (`unidade/ficha-transversal.test.mjs`),
// que a cita ao comparar o cálculo do app com a frase do livro.
export const CITACOES = {
  modificadores: 'Criação de Personagens.md §Valores e Modificadores de Atributo',
  evolucao: 'Criação de Personagens.md §Evolução do Personagem',
  pvNivel1: 'Criação de Personagens.md §Pontos de Vida no Nível 1 por Classe',
  pvNivelSeguinte: 'Criação de Personagens.md §Pontos de Vida Fixos por Classe',
  caBase: 'Abreviações e Definição de Regras.md §Classe de Armadura',
  // "CD para evitar magia = 8 + modificador de atributo de conjuração +
  // Bônus de Proficiência" -- achada em dois lugares idênticos:
  // Criação de Personagens.md:441 e Magias.md:183 (§Salvaguardas).
  cdMagia: 'Magias.md §Salvaguardas (= Criação de Personagens.md:441)',
  // "Bônus de ataque mágico = modificador de atributo de conjuração +
  // Bônus de Proficiência" -- Criação de Personagens.md:443 e
  // Magias.md:189 (§Jogadas de Ataque).
  ataqueMagia: 'Magias.md §Jogadas de Ataque (= Criação de Personagens.md:443)',
  percepcaoPassiva: 'Abreviações e Definição de Regras.md §Percepção Passiva',
};

// A tabela "Valores e Modificadores de Atributo" do livro
// (Criação de Personagens.md:250-261) só tabela os valores 3 a 20,
// em faixas (ex.: "4–5 | -3"), expandidas aqui para um valor por
// linha. Os valores 1, 2 e 21 a 30 NÃO estão impressos na tabela do
// livro — ela para em 20 — mas o app aceita atributos fora dessa
// faixa (1-2 são alcançáveis por penalidades; 21-30 pelas Dádivas
// Épicas de `catalogo/talentos.mjs`, que aumentam atributo até um
// teto de 30). Esses doze valores entram marcados `extrapolado:
// true`: o número vem da mesma fórmula que o app usa
// (`Math.floor((valor-10)/2)`), não de uma linha do livro, para
// ninguém depois achar que veio do livro.
export const MODIFICADORES_ATRIBUTO = [
  { valor: 1, modificador: -5, extrapolado: true },
  { valor: 2, modificador: -4, extrapolado: true },
  { valor: 3, modificador: -4 },
  { valor: 4, modificador: -3 },
  { valor: 5, modificador: -3 },
  { valor: 6, modificador: -2 },
  { valor: 7, modificador: -2 },
  { valor: 8, modificador: -1 },
  { valor: 9, modificador: -1 },
  { valor: 10, modificador: 0 },
  { valor: 11, modificador: 0 },
  { valor: 12, modificador: 1 },
  { valor: 13, modificador: 1 },
  { valor: 14, modificador: 2 },
  { valor: 15, modificador: 2 },
  { valor: 16, modificador: 3 },
  { valor: 17, modificador: 3 },
  { valor: 18, modificador: 4 },
  { valor: 19, modificador: 4 },
  { valor: 20, modificador: 5 },
  { valor: 21, modificador: 5, extrapolado: true },
  { valor: 22, modificador: 6, extrapolado: true },
  { valor: 23, modificador: 6, extrapolado: true },
  { valor: 24, modificador: 7, extrapolado: true },
  { valor: 25, modificador: 7, extrapolado: true },
  { valor: 26, modificador: 8, extrapolado: true },
  { valor: 27, modificador: 8, extrapolado: true },
  { valor: 28, modificador: 9, extrapolado: true },
  { valor: 29, modificador: 9, extrapolado: true },
  { valor: 30, modificador: 10, extrapolado: true },
];

// Tabela "Evolução do Personagem" (Criação de Personagens.md:470-491),
// as 20 linhas por completo. Os pontos nos números de XP do livro
// (ex.: "2.700") são separador de milhar em pt-BR — aqui viram
// number puro (2700).
export const EVOLUCAO_PERSONAGEM = [
  { nivel: 1, xp: 0, bonusProficiencia: 2 },
  { nivel: 2, xp: 300, bonusProficiencia: 2 },
  { nivel: 3, xp: 900, bonusProficiencia: 2 },
  { nivel: 4, xp: 2700, bonusProficiencia: 2 },
  { nivel: 5, xp: 6500, bonusProficiencia: 3 },
  { nivel: 6, xp: 14000, bonusProficiencia: 3 },
  { nivel: 7, xp: 23000, bonusProficiencia: 3 },
  { nivel: 8, xp: 34000, bonusProficiencia: 3 },
  { nivel: 9, xp: 48000, bonusProficiencia: 4 },
  { nivel: 10, xp: 64000, bonusProficiencia: 4 },
  { nivel: 11, xp: 85000, bonusProficiencia: 4 },
  { nivel: 12, xp: 100000, bonusProficiencia: 4 },
  { nivel: 13, xp: 120000, bonusProficiencia: 5 },
  { nivel: 14, xp: 140000, bonusProficiencia: 5 },
  { nivel: 15, xp: 165000, bonusProficiencia: 5 },
  { nivel: 16, xp: 195000, bonusProficiencia: 5 },
  { nivel: 17, xp: 225000, bonusProficiencia: 6 },
  { nivel: 18, xp: 265000, bonusProficiencia: 6 },
  { nivel: 19, xp: 305000, bonusProficiencia: 6 },
  { nivel: 20, xp: 355000, bonusProficiencia: 6 },
];

// Tabela "Pontos de Vida no Nível 1 por Classe"
// (Criação de Personagens.md:416-421). `base` é a parte fixa da
// fórmula do livro ("X + mod. de Constituição") — o modificador de
// Constituição não entra aqui, é somado pelo motor que confrontar
// esta tabela contra o app. 4 faixas, 12 classes ao todo (as 12 do
// jogo, sem faltar nem repetir).
export const PV_NIVEL_1 = [
  { classes: ['Bárbaro'], base: 12 },
  { classes: ['Guardião', 'Guerreiro', 'Paladino'], base: 10 },
  { classes: ['Bardo', 'Bruxo', 'Clérigo', 'Druida', 'Ladino', 'Monge'], base: 8 },
  { classes: ['Feiticeiro', 'Mago'], base: 6 },
];

// Tabela "Pontos de Vida Fixos por Classe" (Criação de Personagens.md:503-510),
// dentro de "Adquirindo Um Nível", passo 2: o valor fixo que substitui a
// rolagem do dado de vida a cada nível adicional (2 em diante).
// `incremento` é a parte fixa da fórmula do livro ("X + mod. de
// Constituição") — mesma convenção de `base` em PV_NIVEL_1: o modificador
// de Constituição não entra aqui, é somado pelo motor que confrontar esta
// tabela contra o app. Transcrito desta tabela, não copiado de PV_NIVEL_1:
// os grupos de classe têm o mesmo conteúdo nas duas tabelas do livro, mas a
// pontuação do texto difere ("Guardião, Guerreiro ou Paladino" na tabela do
// nível 1; "Guardião, Guerreiro, Paladino", sem "ou", nesta).
export const PV_NIVEL_SEGUINTE = [
  { classes: ['Bárbaro'], incremento: 7 },
  { classes: ['Guardião', 'Guerreiro', 'Paladino'], incremento: 6 },
  { classes: ['Bardo', 'Bruxo', 'Clérigo', 'Druida', 'Ladino', 'Monge'], incremento: 5 },
  { classes: ['Feiticeiro', 'Mago'], incremento: 4 },
];
