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
// já gastou?". Desde a issue #46 ela varre UMA lista só --
// `magias_conhecidas` (truque do livro). `magias_customizadas` (truque que
// o próprio jogador inventou no formulário "Magia Personalizada") saiu da
// conta.
//
// TRUQUE PERSONALIZADO NÃO CONTA -- issue #46, decisão do dono do produto
// de 2026-09-02, que REVERTE a decisão anterior. A regra antiga ("vaga é
// vaga, venha de onde vier", registrada em docs/PERGUNTAS-PENDENTES.txt sob
// "MAGIA CUSTOMIZADA DEVE GASTAR VAGA DO ORCAMENTO DA CLASSE?") existia
// para acabar com uma incoerência real: o app cobrava vaga da magia
// homebrew de círculo e dava o truque homebrew de graça, sem razão escrita
// para a diferença. A #46 mantém a coerência e inverte o lado: as duas saem
// de graça, e as duas nascem preparadas. O jogador que reportou via a ficha
// acusar "truques demais" por um truque que ele mesmo inventou.
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

test('personagem com truque personalizado: ele NÃO gasta vaga do orçamento da classe', () => {
  const personagem = {
    magias_conhecidas: [truqueDeClasse('Luz'), truqueDeClasse('Prestidigitação')],
    magias_customizadas: [{ nome: 'Fagulha de Nimb', circulo: 0, escola: 'Evocação' }],
  };

  const contam = regrasOrigensMagia.truquesQueContamNoLimite(personagem);

  assert.equal(contam.length, 2,
    'só os dois truques do LIVRO gastam vaga. Se vier 3, o truque que o jogador inventou '
    + 'voltou a cobrar do orçamento da classe -- a issue #46, em que a ficha acusava '
    + '"truques demais" por um truque homebrew.');
  assert.ok(!contam.some(m => m.nome === 'Fagulha de Nimb'),
    'a entrada do truque personalizado não pode aparecer na contagem, nem "por acaso" '
    + 'com o número certo');
});

test('contraste: magia personalizada de CÍRCULO também não entra no orçamento de truques', () => {
  // Este contraste vale por outro motivo desde a #46: antes ele impedia
  // "somar magias_customizadas inteiro"; agora impede que alguém reintroduza
  // a leitura de magias_customizadas por outro caminho.
  const personagem = {
    magias_conhecidas: [truqueDeClasse('Luz'), truqueDeClasse('Prestidigitação')],
    magias_customizadas: [{ nome: 'Névoa de Nimb', circulo: 1, escola: 'Adivinhação' }],
  };

  assert.equal(regrasOrigensMagia.truquesQueContamNoLimite(personagem).length, 2,
    'nem truque nem magia personalizada saem de orçamento nenhum (issue #46)');
});

test('ficha antiga: truque personalizado com círculo "0" (string) também fica fora', () => {
  // O formulário de Magia Personalizada gravava o círculo como string em
  // ficha antiga. Antes da #46 este teste existia para provar que o
  // saneamento `Number(...)` alcançava a ficha antiga. Depois da #46 não há
  // leitor de `magias_customizadas` aqui, então nenhum formato de círculo
  // pode fazer o truque personalizado reaparecer na conta -- é isto que o
  // teste passa a guardar.
  const personagem = {
    magias_conhecidas: [truqueDeClasse('Luz')],
    magias_customizadas: [{ nome: 'Fagulha de Nimb', circulo: '0' }],
  };

  assert.equal(regrasOrigensMagia.truquesQueContamNoLimite(personagem).length, 1,
    'só "Luz". Círculo "0" em string não pode ser porta de volta para a regra antiga');
});

test('o critério de origem continua valendo: truque de espécie fora, Mãos Mágicas do Trapaceiro Arcano dentro', () => {
  // A issue #46 alinhou o truque PERSONALIZADO à magia personalizada pelo
  // lado da isenção. Ela não mexeu em nenhuma das origens concedidas do
  // livro -- este oráculo é o que impede a reversão de virar "não conta
  // nada", do mesmo jeito que antes impedia o "conta tudo".
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

  assert.deepEqual(nomes, ['Luz', 'Mãos Mágicas'],
    'só o truque escolhido da tabela e o de subclasse_fixa (que o livro manda contar) '
    + 'gastam vaga -- espécie, subclasse_automatica e o PERSONALIZADO (issue #46) '
    + 'continuam de fora');
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

// ============================================================
// A MAGIA de círculo personalizada, issue #46.
//
// `magiaContaNoLimite` é o portão de TRÊS leitores ao mesmo tempo
// (preparadasPorClasse, normalizarGrimorioMago, migrarSlotsMagiaLivre), e é
// por ele que a customizada de círculo sai do "6/6". Medir o predicado aqui
// é o que impede a regra de voltar por um deles.
// ============================================================

test('magia personalizada de círculo não conta no limite de preparadas', () => {
  assert.equal(regrasOrigensMagia.magiaContaNoLimite({ nome: 'Névoa de Nimb', circulo: 1, personalizada: true }), false,
    'a marca `personalizada` é o que a isenta -- ela não tem `origem` de concessão, '
    + 'então sem esta regra ela cai no ramo genérico e volta a gastar vaga');
});

test('a isenção é só da marca: magia do livro com o mesmo nome continua contando', () => {
  assert.equal(regrasOrigensMagia.magiaContaNoLimite({ nome: 'Névoa de Nimb', circulo: 1 }), true,
    'homônima do acervo não é a magia do jogador -- sem esta guarda a isenção viraria '
    + '"toda magia é isenta" no dia em que alguém trocar a marca por uma busca por nome');
});

test('a isenção não engole as origens do livro que já contavam', () => {
  assert.equal(regrasOrigensMagia.magiaContaNoLimite({ nome: 'Bola de Fogo', circulo: 3 }), true);
  assert.equal(regrasOrigensMagia.magiaContaNoLimite({ nome: 'Bênção', circulo: 1, origem: 'dominio' }), false);
});
