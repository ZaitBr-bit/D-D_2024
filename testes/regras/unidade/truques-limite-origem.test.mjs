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
