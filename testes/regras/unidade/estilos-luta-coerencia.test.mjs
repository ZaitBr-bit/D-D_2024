// ============================================================
// As duas listas de Estilo de Luta do app precisam concordar.
//
// `ESTILOS_LUTA_CANONICOS` (site/js/regras-subclasse-escolhas.js) é a lista
// de REGRA -- quais estilos existem --, e vive na camada de regra porque
// `levelup-cards.js` toca `window` no topo: importá-lo de lá arrastaria uma
// dependência de navegador para dentro de levelup.js.
// `OPCOES_ESTILO_LUTA_BASE` (site/js/levelup-cards.js) é a lista de TELA --
// os mesmos nomes, com a descrição curta que o card mostra.
//
// Duas listas do mesmo fato é exatamente o padrão que este repositório já
// viu dar errado três vezes (o terceiro vocabulário de Estilo de Luta na
// ficha, corrigido na Task 7; os dois nomes de subclasse do Clérigo; a
// guarda de Juramento do Paladino). A separação aqui é deliberada e tem
// motivo técnico -- então o preço é este teste, que cobra a coerência.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { modulosApp } from './harness.mjs';

const { levelupCards, regrasSubclasseEscolhas } = await modulosApp();

test('as duas listas de Estilo de Luta trazem exatamente os mesmos nomes', () => {
  const daTela = levelupCards.OPCOES_ESTILO_LUTA_BASE.map((e) => e.nome);
  const daRegra = regrasSubclasseEscolhas.ESTILOS_LUTA_CANONICOS;
  assert.deepEqual([...daRegra].sort(), [...daTela].sort(),
    'ESTILOS_LUTA_CANONICOS (regras-subclasse-escolhas.js) e OPCOES_ESTILO_LUTA_BASE ' +
    '(levelup-cards.js) divergiram -- as duas descrevem os mesmos dez estilos do livro, ' +
    'e um estilo que exista só numa delas some da tela ou da validação');
});

test('a lista de regra tem os dez estilos do livro, sem repetir', () => {
  const daRegra = regrasSubclasseEscolhas.ESTILOS_LUTA_CANONICOS;
  assert.equal(daRegra.length, 10,
    `esperados 10 Estilos de Luta (Classes.md:3798-3810), achados ${daRegra.length}`);
  assert.equal(new Set(daRegra).size, daRegra.length, 'há nome repetido na lista de regra');
});
