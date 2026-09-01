// ============================================================
// Quais truques gastam vaga do limite da tabela da classe.
//
// O limite de truques é da CLASSE. Truque que o jogador não escolheu --
// concedido por espécie, por talento ou por característica de subclasse --
// não sai desse orçamento, salvo quando o próprio livro o inclui na conta.
//
// A exceção é o Trapaceiro Arcano: "Você conhece três truques: Mãos
// Mágicas e dois outros truques à sua escolha" (PHB 2024) -- Mãos Mágicas
// é UM DOS TRÊS, então `subclasse_fixa` CONTA. Já o Ilusionista tem a
// frase oposta, explícita: "O truque não conta para o seu número de
// truques conhecidos" -- `subclasse_automatica` NÃO conta.
//
// Este motor existe porque o critério vivia como lista literal dentro de
// sheet/magias.js e esquecia duas origens: `telecinetico` (talento) e
// `subclasse_automatica` (Ilusionista). O jogador via "Truques 3 / 2" em
// vermelho por um truque que o livro deu de graça.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { modulosApp } from './harness.mjs';

const { regrasOrigensMagia } = await modulosApp();

// Cada linha é a regra escrita, não o que o app faz.
const CASOS = [
  { origem: undefined,               conta: true,  porque: 'truque escolhido pelo jogador na tabela da classe' },
  { origem: 'especie',               conta: false, porque: 'truque de espécie (Alto Elfo, Tiferino)' },
  { origem: 'especie_legado',        conta: false, porque: 'Linhagem Élfica / Legado Ínfero' },
  { origem: 'sempre',                conta: false, porque: '"você sempre tem X preparada", da prosa da subclasse' },
  { origem: 'iniciado_em_magia',     conta: false, porque: 'talento Iniciado em Magia' },
  { origem: 'tocado_por_fadas',      conta: false, porque: 'talento Tocado Por Fadas' },
  { origem: 'tocado_pelas_sombras',  conta: false, porque: 'talento Tocado Pelas Sombras' },
  { origem: 'conjurador_ritualista', conta: false, porque: 'talento Conjurador Ritualista' },
  { origem: 'telecinetico',          conta: false, porque: 'talento Telecinético (Mãos Mágicas ou o substituto)' },
  { origem: 'subclasse_automatica',  conta: false, porque: 'Ilusionista: "O truque não conta para o seu número de truques conhecidos"' },
  { origem: 'subclasse_escolha',     conta: false, porque: 'Descobertas Mágicas (Colégio do Conhecimento nv6): as 2 magias/truques à escolha são um ganho da subclasse, além da tabela da classe' },
  { origem: 'subclasse_fixa',        conta: true,  porque: 'Trapaceiro Arcano: Mãos Mágicas é um dos três truques da tabela' },
];

for (const caso of CASOS) {
  test(`truque de origem "${caso.origem ?? '(escolha do jogador)'}" ${caso.conta ? 'CONTA' : 'não conta'} no limite — ${caso.porque}`, () => {
    const resultado = regrasOrigensMagia.truqueContaNoLimite({ nome: 'X', circulo: 0, origem: caso.origem });
    assert.equal(resultado, caso.conta,
      `origem "${caso.origem}" deveria ${caso.conta ? 'contar' : 'não contar'} no limite de truques`);
  });
}

// Guarda de coerência: toda origem declarada como não-trocável, exceto
// `subclasse_fixa`, tem de ficar fora do limite. Sem isto, acrescentar uma
// origem nova em ORIGENS_TRUQUE_NAO_TROCAVEL e esquecer o limite passaria
// despercebido -- que é exatamente como este bug nasceu.
test('toda origem não-trocável fica fora do limite, exceto subclasse_fixa', () => {
  const fora = regrasOrigensMagia.ORIGENS_TRUQUE_NAO_TROCAVEL
    .filter(o => o !== 'subclasse_fixa');
  for (const origem of fora) {
    assert.equal(regrasOrigensMagia.truqueContaNoLimite({ origem }), false,
      `origem "${origem}" é não-trocável mas continua contando no limite`);
  }
});

// ============================================================
// O ORÇAMENTO DO PERSONAGEM INTEIRO -- `truquesQueContamNoLimite(char)`.
//
// O predicado acima responde por UMA entrada. A pergunta que as duas telas
// fazem é outra: "quanto do orçamento de truques da classe este personagem
// já gastou?". Ela precisa varrer as DUAS listas onde truque mora --
// `magias_conhecidas` (truque do livro) e `magias_customizadas` (truque
// que o próprio jogador inventou no formulário "Magia Personalizada").
//
// TRUQUE PERSONALIZADO CONTA. Decisão do dono do produto, registrada em
// docs/PERGUNTAS-PENDENTES.txt ("MAGIA CUSTOMIZADA DEVE GASTAR VAGA DO
// ORCAMENTO DA CLASSE?"): vaga é vaga, venha de onde vier -- a mesma
// resposta que a magia de círculo personalizada sempre teve. Antes desta
// decisão o app respondia as duas coisas ao mesmo tempo, sem razão escrita
// para a diferença.
//
// POR QUE O PREDICADO SOZINHO NÃO PEGAVA ISTO: `truqueContaNoLimite`
// SEMPRE devolveu `true` para o truque personalizado (ele não tem `origem`
// de concessão, e nada em ORIGENS_TRUQUE_NAO_TROCAVEL o alcança). Um caso
// a mais na tabela de CASOS acima nasceria VERDE por cima do buraco. Quem
// excluía o truque personalizado eram os dois chamadores, cada um do seu
// jeito -- `sheet/magias.js` filtrava `!m.personalizada`, `sheet/grimorio.js`
// lia só `magias_conhecidas` --, e é por isso que o oráculo tem de ser
// sobre o PERSONAGEM, não sobre a entrada.
// ============================================================

/** Um truque escolhido da tabela da classe: sem `origem`, como o app grava. */
const truqueDeClasse = (nome) => ({ nome, circulo: 0 });

test('personagem com truque personalizado: ele gasta vaga do orçamento da classe (+1)', () => {
  const personagem = {
    magias_conhecidas: [truqueDeClasse('Luz'), truqueDeClasse('Prestidigitação')],
    magias_customizadas: [{ nome: 'Fagulha de Nimb', circulo: 0, escola: 'Evocação' }],
  };

  const contam = regrasOrigensMagia.truquesQueContamNoLimite(personagem);

  assert.equal(contam.length, 3,
    'dois truques do livro + um truque personalizado = 3 vagas gastas. Se vier 2, o truque que o '
    + 'jogador inventou continua saindo de graça, enquanto a magia de círculo personalizada dele '
    + 'paga vaga -- as duas respostas para a mesma pergunta que esta decisão veio extinguir.');
  assert.ok(contam.some(m => m.nome === 'Fagulha de Nimb'),
    'a contagem tem de incluir a ENTRADA do truque personalizado, não só bater de número por acaso');
});

test('contraste: magia personalizada de CÍRCULO não entra no orçamento de truques', () => {
  // Sem este contraste, "somar magias_customizadas inteiro" passaria no
  // teste acima e cobraria do orçamento de TRUQUES uma magia de 1º círculo.
  const personagem = {
    magias_conhecidas: [truqueDeClasse('Luz'), truqueDeClasse('Prestidigitação')],
    magias_customizadas: [{ nome: 'Névoa de Nimb', circulo: 1, escola: 'Adivinhação' }],
  };

  assert.equal(regrasOrigensMagia.truquesQueContamNoLimite(personagem).length, 2,
    'magia personalizada de círculo 1+ gasta vaga do limite de PREPARADAS (magiaContaNoLimite), '
    + 'nunca do limite de truques');
});

test('ficha antiga: truque personalizado com círculo gravado como string ("0") também conta', () => {
  // O formulário de Magia Personalizada gravava o círculo como string em
  // ficha antiga -- é o motivo de `normalizarMagiaPersonalizada`
  // (sheet/magias.js) e `personalizadasDeCirculoDaFicha` (sheet/grimorio.js)
  // sanearem com `Number(...)`. Uma comparação `=== 0` crua deixaria a
  // ficha antiga de fora do orçamento, em silêncio.
  const personagem = {
    magias_conhecidas: [truqueDeClasse('Luz')],
    magias_customizadas: [{ nome: 'Fagulha de Nimb', circulo: '0' }],
  };

  assert.equal(regrasOrigensMagia.truquesQueContamNoLimite(personagem).length, 2,
    'círculo "0" (string, ficha antiga) é truque -- tem de gastar vaga igual ao numérico');
});

test('o critério de origem continua valendo: truque de espécie fora, Mãos Mágicas do Trapaceiro Arcano dentro', () => {
  // A decisão do dono do produto alinhou o truque PERSONALIZADO à magia
  // personalizada. Ela não mexeu em nenhuma das origens concedidas -- este
  // oráculo é o que impede a mudança de virar "conta tudo".
  const personagem = {
    magias_conhecidas: [
      truqueDeClasse('Luz'),
      { nome: 'Prestidigitação', circulo: 0, origem: 'especie' },
      { nome: 'Mãos Mágicas', circulo: 0, origem: 'subclasse_fixa' },
      { nome: 'Ilusão Menor', circulo: 0, origem: 'subclasse_automatica' },
    ],
    magias_customizadas: [{ nome: 'Fagulha de Nimb', circulo: 0 }],
  };

  const nomes = regrasOrigensMagia.truquesQueContamNoLimite(personagem).map(m => m.nome).sort();

  assert.deepEqual(nomes, ['Fagulha de Nimb', 'Luz', 'Mãos Mágicas'],
    'só o truque escolhido da tabela, o de subclasse_fixa (que o livro manda contar) e o '
    + 'personalizado gastam vaga -- espécie e subclasse_automatica continuam de fora');
});

test('magias de círculo de magias_conhecidas não entram na contagem de truques', () => {
  // Bardo/Bruxo/Feiticeiro guardam as magias CONHECIDAS de círculo 1+ no
  // mesmo array dos truques. Sem o filtro de círculo, o orçamento de
  // truques deles estouraria por magia que nunca foi truque.
  const personagem = {
    magias_conhecidas: [truqueDeClasse('Luz'), { nome: 'Mísseis Mágicos', circulo: 1 }],
  };

  assert.equal(regrasOrigensMagia.truquesQueContamNoLimite(personagem).length, 1,
    'só círculo 0 é truque');
});

test('personagem sem nenhuma das duas listas devolve vazio, sem lançar', () => {
  assert.deepEqual(regrasOrigensMagia.truquesQueContamNoLimite({}), []);
  assert.deepEqual(regrasOrigensMagia.truquesQueContamNoLimite(null), []);
});
