// ============================================================
// Quais salvaguardas o personagem é proficiente DE FATO.
//
// `personagem.salvaguardas_proficientes` guarda só o que foi gravado: a
// dupla da classe na criação (creator/wizard.js:442), o talento Resiliente
// (levelup.js:1641) e escolhas de subclasse (regras-subclasse-escolhas.js:232).
// Característica de classe que concede proficiência sem escolha do jogador
// nunca passa por lá -- e a ficha lia só esse array.
//
// Hoje há uma única concessão dessas no livro (Sobrevivente Disciplinado,
// Monge nível 14, Classes.md:5266), mas o motor é escrito por TABELA e não
// por caso: capstones e características de nível alto são implementados um
// a um, no braço, e a próxima entra aqui em vez de virar mais um `if`
// espalhado pelos três renders.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { modulosApp } from './harness.mjs';

const { regrasSalvaguardas } = await modulosApp();

const TODAS = ['Força', 'Destreza', 'Constituição',
               'Inteligência', 'Sabedoria', 'Carisma'];
const BASE_MONGE = ['Força', 'Destreza'];

/** Monge no nível pedido, com a dupla base da classe já gravada */
function monge(nivel) {
  return { classe: 'Monge', nivel, salvaguardas_proficientes: [...BASE_MONGE] };
}

// Cada linha é a regra escrita, não o que o app faz.
const NIVEIS = [
  { nivel: 1,  esperado: BASE_MONGE, porque: 'só a dupla da classe' },
  { nivel: 13, esperado: BASE_MONGE, porque: 'Sobrevivente Disciplinado ainda não chegou' },
  { nivel: 14, esperado: TODAS,      porque: 'Sobrevivente Disciplinado (Classes.md:5266)' },
  { nivel: 20, esperado: TODAS,      porque: 'a concessão não expira' },
];

for (const caso of NIVEIS) {
  test(`Monge nv${caso.nivel}: ${caso.esperado.length} salvaguardas — ${caso.porque}`, () => {
    const obtidas = regrasSalvaguardas.salvaguardasProficientes(monge(caso.nivel));
    assert.deepEqual([...obtidas].sort(), [...caso.esperado].sort());
  });
}

test('outra classe no nível 14 não ganha nada', () => {
  // O contrapeso da classe: a concessão é do Monge, não do nível.
  const guerreiro = { classe: 'Guerreiro', nivel: 14,
                      salvaguardas_proficientes: ['Força', 'Constituição'] };
  assert.deepEqual(regrasSalvaguardas.salvaguardasProficientes(guerreiro),
    ['Força', 'Constituição']);
});

test('Resiliente já gravado não vira duplicata', () => {
  // Um Monge que pegou Resiliente (Sabedoria) antes do nível 14 tem essa
  // salvaguarda gravada; ao chegar no 14 ela não pode aparecer duas vezes.
  const p = { classe: 'Monge', nivel: 14,
              salvaguardas_proficientes: [...BASE_MONGE, 'Sabedoria'] };
  const obtidas = regrasSalvaguardas.salvaguardasProficientes(p);
  assert.equal(obtidas.length, 6, `veio com duplicata: ${obtidas.join(', ')}`);
  assert.equal(new Set(obtidas).size, 6);
});

test('personagem sem lista gravada não estoura', () => {
  // criarPersonagemVazio deixa o array vazio (store.js:284) e fichas
  // legadas podem nem ter o campo.
  assert.deepEqual(
    regrasSalvaguardas.salvaguardasProficientes({ classe: 'Monge', nivel: 14 }).sort(),
    [...TODAS].sort());
  assert.deepEqual(
    regrasSalvaguardas.salvaguardasProficientes({ classe: 'Mago', nivel: 5 }), []);
});

test('a função não muta o personagem', () => {
  // O valor é derivado. Se ela escrever de volta no personagem, o efeito
  // vira estado persistido e volta o problema que a Tarefa 4 evita.
  const p = monge(14);
  regrasSalvaguardas.salvaguardasProficientes(p);
  assert.deepEqual(p.salvaguardas_proficientes, BASE_MONGE);
});

test('ehProficienteEmSalvaguarda concorda com a lista', () => {
  // Os três renders chamam o booleano, não a lista -- se os dois
  // divergirem, o motor acima estaria medindo o que ninguém usa.
  for (const p of [monge(13), monge(14), { classe: 'Mago', nivel: 5 }]) {
    const lista = regrasSalvaguardas.salvaguardasProficientes(p);
    for (const nome of TODAS) {
      assert.equal(regrasSalvaguardas.ehProficienteEmSalvaguarda(p, nome),
        lista.includes(nome), `${p.classe} nv${p.nivel}, ${nome}`);
    }
  }
});
