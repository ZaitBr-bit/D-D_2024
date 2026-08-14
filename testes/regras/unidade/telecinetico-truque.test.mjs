// ============================================================
// REGRA DA CASA (não do livro): Telecinético para quem já conhece
// Mãos Mágicas.
//
// O PHB 2024 (§Telecinético, Talentos.md:684 e o mesmo verbete no livro
// completo, linha 9554) diz apenas "Você aprende a magia Mãos Mágicas".
// Não há cláusula de substituição no verbete, nem regra geral de
// duplicação que a cubra -- a única regra geral do livro sobre
// características repetidas (multiclasse) trata só de Ataque Extra,
// Classe de Armadura e Conjuração. Por isso este arquivo NÃO usa o
// catálogo de talentos (que é a fiel transcrição do livro) e testa a
// regra da casa direto contra o motor, com o desvio declarado aqui.
//
// Decisão do dono do produto (2026-08-13): quem já tem Mãos Mágicas
// escolhe outro truque da lista de Mago no lugar. Sem isso o talento não
// concederia truque nenhum a esse personagem -- o caso mais comum sendo
// o Trapaceiro Arcano, que recebe Mãos Mágicas obrigatoriamente
// (PHB 2024, linha 6811).
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { modulosApp, charBase } from './harness.mjs';

const { regras } = await modulosApp();

/** Personagem nível 4 que JÁ conhece Mãos Mágicas (o caso da regra da casa) */
async function charComMaosMagicas() {
  const char = await charBase();
  char.magias_conhecidas = [{ nome: 'Mãos Mágicas', circulo: 0 }];
  return char;
}

/** Nomes dos truques (círculo 0) que o personagem conhece */
function truquesDe(char) {
  return (char.magias_conhecidas || []).filter(m => m.circulo === 0).map(m => m.nome);
}

const REGRA = () => regras.getRegraTalento('Telecinético');

test('Telecinético: sem Mãos Mágicas, nada muda -- concede Mãos Mágicas e não pede truque', async () => {
  const char = await charBase();

  assert.equal(regras.telecineticoPrecisaTruqueSubstituto(char), false);

  // A escolha condicional NÃO pode aparecer para quem não tem o truque:
  // é o que mantém o talento igual ao livro para todo mundo mais.
  const obrigatorias = regras.obterEscolhasObrigatoriasTalento(REGRA(), char);
  assert.deepEqual(obrigatorias, ['atributo_talento'],
    'apareceu escolha de truque para quem não tem Mãos Mágicas');

  // Sem escolha de truque, a validação tem de passar só com o atributo.
  const validacao = regras.validarEscolhasTalento(char, 'Telecinético', { atributo: 'sabedoria' });
  assert.equal(validacao.valido, true, validacao.erro);

  regras.aplicarEfeitoTalento(char, 'Telecinético', { atributo: 'sabedoria' });
  assert.deepEqual(truquesDe(char), ['Mãos Mágicas']);
});

test('Telecinético: com Mãos Mágicas, a escolha de truque substituto passa a ser obrigatória', async () => {
  const char = await charComMaosMagicas();

  assert.equal(regras.telecineticoPrecisaTruqueSubstituto(char), true);

  const obrigatorias = regras.obterEscolhasObrigatoriasTalento(REGRA(), char);
  assert.deepEqual(obrigatorias, ['atributo_talento', 'truque_telecinetico'],
    'a escolha de truque não foi exigida de quem já tem Mãos Mágicas');
});

test('Telecinético: com Mãos Mágicas, confirmar sem escolher truque é recusado', async () => {
  const char = await charComMaosMagicas();
  const validacao = regras.validarEscolhasTalento(char, 'Telecinético', { atributo: 'sabedoria' });
  assert.equal(validacao.valido, false,
    'deixou passar o talento sem o truque substituto -- o personagem não ganharia truque nenhum');
});

test('Telecinético: o truque substituto não pode ser um que o personagem já conhece', async () => {
  const char = await charComMaosMagicas();
  char.magias_conhecidas.push({ nome: 'Raio de Gelo', circulo: 0 });

  // A própria Mãos Mágicas é o caso óbvio, e por isso está aqui junto:
  // escolhê-la de volta anularia o sentido da tela.
  for (const repetido of ['Mãos Mágicas', 'Raio de Gelo']) {
    const validacao = regras.validarEscolhasTalento(
      char, 'Telecinético', { atributo: 'sabedoria', truque_telecinetico: repetido });
    assert.equal(validacao.valido, false, `aceitou "${repetido}", que o personagem já conhece`);
  }
});

test('Telecinético: o truque escolhido entra com origem telecinetico e Mãos Mágicas não duplica', async () => {
  const char = await charComMaosMagicas();
  const escolhas = { atributo: 'sabedoria', truque_telecinetico: 'Raio de Gelo' };

  const validacao = regras.validarEscolhasTalento(char, 'Telecinético', escolhas);
  assert.equal(validacao.valido, true, validacao.erro);

  regras.aplicarEfeitoTalento(char, 'Telecinético', escolhas);

  assert.deepEqual(truquesDe(char), ['Mãos Mágicas', 'Raio de Gelo'],
    'o substituto não entrou, ou Mãos Mágicas foi duplicada');
  const novo = char.magias_conhecidas.find(m => m.nome === 'Raio de Gelo');
  assert.equal(novo.origem, 'telecinetico',
    'sem a origem, a ficha não sabe que este truque veio do talento');
  // O atributo de conjuração do talento continua sendo gravado nos dois ramos.
  assert.equal(char.talentos_parametros?.telecinetico?.atributo, 'sabedoria');
});

test('Telecinético: o "+ Talento" da ficha entrega a escolha em `selecoes` e o motor a lê', async () => {
  // A ficha (sheet/talentos.js) monta `escolhasCompletas.selecoes` a partir
  // do card; o motor lê via `valor(escolhas, 'truque_telecinetico', 0)`, que
  // cai em `selecoes[0]` quando a chave nomeada não vem. Se esse fallback
  // quebrar, a via da ficha grava o talento sem truque nenhum, em silêncio.
  const char = await charComMaosMagicas();
  const escolhas = { atributo: 'sabedoria', selecoes: ['Prestidigitação Arcana'] };

  const validacao = regras.validarEscolhasTalento(char, 'Telecinético', escolhas);
  assert.equal(validacao.valido, true, validacao.erro);

  regras.aplicarEfeitoTalento(char, 'Telecinético', escolhas);
  assert.ok(truquesDe(char).includes('Prestidigitação Arcana'),
    'a escolha vinda de `selecoes` (via ficha) foi ignorada');
});
