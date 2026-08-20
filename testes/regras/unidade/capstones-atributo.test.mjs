// ============================================================
// Motor comportamental dos capstones de atributo (nível 20).
//
// Duas classes ganham valores de atributo na última característica da
// progressão, e são as duas únicas do livro que o fazem:
//
//   Bárbaro — Campeão Primitivo (Classes.md:181-183)
//     "Seus valores de Força e Constituição aumentam em 4, até um
//      máximo de 25."
//   Monge  — Corpo e Mente      (Classes.md:5282-5284)
//     "Seus valores de Destreza e Sabedoria aumentam em 4, até no
//      máximo 25."
//
// A pergunta aqui é comportamental: `subirDeNivel` APLICA o aumento ao
// personagem? Não é a mesma pergunta de classes-passivas.test.mjs, que
// só afirma a CLASSIFICAÇÃO da característica (ativa/passiva, com ou sem
// custo) -- uma característica pode estar classificada certo no catálogo,
// exibida certo na ficha e não fazer absolutamente nada. Foi o caso da
// issue #19: "Corpo e Mente" existia em dados/classes/monge.json, era
// mostrada na ficha com o texto correto do livro e nunca somava os +4.
//
// A asserção é sobre o DELTA entre o nível 19 e o 20, não sobre o valor
// absoluto: a escada distribui os ASI de 4/8/12/16 no primeiro atributo
// abaixo de 20 (harness.mjs, `primeiroAtributoAbaixoDe20`), então o valor
// que chega ao nível 19 é um detalhe do harness, não do livro. O delta é
// do livro.
//
// O teto de 25 NÃO é exercitado por este motor: partindo de 15 na
// semente, nem Força nem Destreza chegam perto de 21 ao fim da escada.
// Ele é afirmado à parte, em `aplicarCapstoneAtributo` (teste de unidade
// direto, no fim do arquivo), porque é a metade da regra que o ASI comum
// contradiz -- o ASI tem teto 20, o capstone tem teto 25, e confundir os
// dois é o erro fácil.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { PV_NIVEL_SEGUINTE } from '../catalogo/ficha-transversal.mjs';
import { escadaDeNivel, modulosApp } from './harness.mjs';

// Capstones de atributo do livro. Cada entrada é a regra escrita, não o
// que o app faz -- é contra isto que o app é confrontado.
const CAPSTONES = [
  {
    classe: 'Bárbaro',
    caracteristica: 'Campeão Primitivo',
    atributos: ['forca', 'constituicao'],
    ganho: 4,
    teto: 25,
    livro: 'Classes.md:181-183',
  },
  {
    classe: 'Monge',
    caracteristica: 'Corpo e Mente',
    atributos: ['destreza', 'sabedoria'],
    ganho: 4,
    teto: 25,
    livro: 'Classes.md:5282-5284',
  },
];

const ATRIBUTOS = ['forca', 'destreza', 'constituicao',
                   'inteligencia', 'sabedoria', 'carisma'];

for (const cap of CAPSTONES) {
  test(`${cap.classe} nv20: ${cap.caracteristica} soma +${cap.ganho} em ` +
       `${cap.atributos.join(' e ')} (${cap.livro})`, async () => {
    // Duas escadas independentes: uma parada em 19, outra em 20. Comparar
    // o mesmo personagem antes e depois de UMA característica é o único
    // jeito de isolar o efeito do capstone dos ASI que vieram antes.
    const antes = await escadaDeNivel(cap.classe, () => {}, { ateNivel: 19 });
    const depois = await escadaDeNivel(cap.classe, () => {}, { ateNivel: 20 });

    for (const atributo of cap.atributos) {
      const esperado = Math.min(cap.teto, antes.atributos[atributo] + cap.ganho);
      assert.equal(depois.atributos[atributo], esperado,
        `${cap.classe}: ${atributo} deveria ir de ${antes.atributos[atributo]} ` +
        `para ${esperado} ao adquirir ${cap.caracteristica}, mas ficou em ` +
        `${depois.atributos[atributo]}`);
    }

    // Os outros quatro atributos não podem se mexer: o nível 20 não
    // concede ASI em nenhuma classe, então qualquer diferença fora da
    // dupla do capstone é efeito colateral.
    for (const atributo of ATRIBUTOS.filter((a) => !cap.atributos.includes(a))) {
      assert.equal(depois.atributos[atributo], antes.atributos[atributo],
        `${cap.classe}: ${atributo} não é tocado por ${cap.caracteristica}, ` +
        `mas mudou de ${antes.atributos[atributo]} para ${depois.atributos[atributo]}`);
    }
  });

  test(`${cap.classe} nv20: ${cap.caracteristica} aumenta os PV quando o ` +
       `modificador de Constituição sobe`, async () => {
    const antes = await escadaDeNivel(cap.classe, () => {}, { ateNivel: 19 });
    const depois = await escadaDeNivel(cap.classe, () => {}, { ateNivel: 20 });

    const { utils } = await modulosApp();
    const modAntes = utils.calcMod(antes.atributos.constituicao);
    const modDepois = utils.calcMod(depois.atributos.constituicao);
    // O nível 20 soma DUAS parcelas ao pv_max, e só a segunda é do capstone:
    //   1. o PV do próprio nível — valor fixo da classe (PV_NIVEL_SEGUINTE,
    //      "Criação de Personagens.md:503-510") mais o modificador de CON
    //      ANTES do capstone, porque levelup.js:1002-1003 calcula o ganho
    //      com `modConAntes`;
    //   2. a regra retroativa de CON: +1 de modificador = +1 PV em CADA um
    //      dos 20 níveis. Vale para o capstone do Bárbaro (que mexe em CON)
    //      e é inerte no do Monge (que não mexe) — afirmar os dois no mesmo
    //      teste é o que impede a correção de um quebrar o outro.
    const incremento = PV_NIVEL_SEGUINTE
      .find((linha) => linha.classes.includes(cap.classe)).incremento;
    const pvEsperado = antes.pv_max
      + (incremento + modAntes)
      + (modDepois - modAntes) * 20;
    assert.equal(depois.pv_max, pvEsperado,
      `${cap.classe}: com CON indo de ${antes.atributos.constituicao} para ` +
      `${depois.atributos.constituicao}, pv_max deveria ir de ${antes.pv_max} ` +
      `para ${pvEsperado}, mas ficou em ${depois.pv_max}`);
  });
}

// O teto de 25, afirmado direto na função -- a escada nunca chega perto
// dele (ver cabeçalho). Sem este teste, um capstone escrito com o teto 20
// do ASI comum passaria nos dois motores acima.
test('capstone de atributo respeita o teto 25, não o teto 20 do ASI comum', async () => {
  const { levelup } = await modulosApp();
  const personagem = {
    atributos: {
      forca: 24, destreza: 20, constituicao: 22,
      inteligencia: 10, sabedoria: 10, carisma: 10,
    },
  };
  levelup.aplicarCapstoneAtributo(personagem, ['forca', 'constituicao'], 4);
  assert.equal(personagem.atributos.forca, 25,
    '24 + 4 deve ser aparado em 25, o teto do capstone');
  assert.equal(personagem.atributos.constituicao, 25,
    '22 + 4 deve ser aparado em 25, não em 20 (o teto do ASI comum)');
  assert.equal(personagem.atributos.destreza, 20,
    'atributo fora da lista não pode ser tocado');
});
