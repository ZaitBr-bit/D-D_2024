// ============================================================
// Issue #45 -- Conhecimento Primordial (Bárbaro nível 3).
//
// Classes.md:109 dá DUAS coisas nesta característica:
//
//   1. "Você adquire proficiência em outra perícia à sua escolha da lista
//      de perícias disponíveis para Bárbaros no nível 1."
//   2. "...enquanto sua Fúria estiver ativa... pode realizá-lo como um
//      teste de Força..."
//
// A (2) está implementada (`forcaPrimordialAtiva`, sheet/combate.js). A
// (1) NUNCA foi implementada: a subida de nível ANUNCIA a característica
// no resumo e não concede perícia nenhuma, nem oferece a escolha. Exibir
// não é aplicar.
//
// POR QUE O CATÁLOGO NÃO PEGOU: a entrada de `classes-passivas.mjs` marca
// esta característica como `composta: true`, e a regra escrita lá diz que
// "uma entrada composta não sustenta lacuna sozinha -- se o app modelar só
// a metade passiva... não é necessariamente o app errando". O `motivo` da
// entrada cita SÓ a segunda metade. O catálogo classifica se a
// característica é ativa; ele nunca perguntou se o efeito acontece.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { modulosApp, personagemInicialDeClasse, subirAteNivel } from './harness.mjs';

// A lista do nível 1 do Bárbaro (dados/classes/barbaro.json,
// tracos_basicos["Proficiência em Perícias"]). Escrita aqui para o oráculo
// não depender do mesmo parser que o código sob teste usa.
const PERICIAS_BARBARO = [
  'Atletismo', 'Intimidação', 'Lidar com Animais',
  'Natureza', 'Percepção', 'Sobrevivência',
];

test('Bárbaro 3: Conhecimento Primordial concede uma perícia nova', async () => {
  const p = await personagemInicialDeClasse('Bárbaro');
  const antes = [...(p.pericias_proficientes || [])];

  await subirAteNivel(p, 'Bárbaro', 3);

  assert.equal(p.nivel, 3, 'a fixture precisa mesmo chegar ao nível 3');
  const depois = p.pericias_proficientes || [];
  const novas = depois.filter((x) => !antes.includes(x));

  assert.equal(
    novas.length, 1,
    `Conhecimento Primordial dá 1 perícia nova (Classes.md:109). `
    + `antes=${JSON.stringify(antes)} depois=${JSON.stringify(depois)}`,
  );
  assert.ok(
    PERICIAS_BARBARO.includes(novas[0]),
    `a perícia tem de sair da lista de nível 1 do Bárbaro; veio "${novas[0]}"`,
  );
});

test('a perícia extra sai da LISTA do Bárbaro, e nunca repete uma que ele já tem', async () => {
  const p = await personagemInicialDeClasse('Bárbaro');
  // Deixa o Bárbaro já proficiente em duas da própria lista: a escolha
  // restante tem de vir das outras quatro, sem duplicar.
  p.pericias_proficientes = ['Atletismo', 'Sobrevivência'];

  await subirAteNivel(p, 'Bárbaro', 3);

  const depois = p.pericias_proficientes;
  assert.equal(
    new Set(depois).size, depois.length,
    `perícia duplicada em ${JSON.stringify(depois)} -- a concessão precisa de guarda de idempotência`,
  );
  const novas = depois.filter((x) => !['Atletismo', 'Sobrevivência'].includes(x));
  assert.equal(novas.length, 1, `esperava 1 perícia nova, veio ${JSON.stringify(novas)}`);
  assert.ok(PERICIAS_BARBARO.includes(novas[0]), `"${novas[0]}" não é da lista do Bárbaro`);
});

test('a característica é ANUNCIADA na subida -- a metade que já funcionava não regrediu', async () => {
  // Guarda contra vacuidade: se a característica sumisse do resumo, os
  // dois testes acima poderiam passar por outro motivo qualquer.
  const { levelup, db } = await modulosApp();
  const p = await personagemInicialDeClasse('Bárbaro');
  await subirAteNivel(p, 'Bárbaro', 2);

  const classeData = await db.getClasse('Bárbaro');
  const opcoes = {
    ignorar_xp: true, classe: 'Bárbaro',
    subclasse: (classeData?.subclasses || [])
      .filter((sc) => !sc.nome.toLowerCase().startsWith('subclasses de'))[0]?.nome,
  };
  let r = await levelup.subirDeNivel(p, opcoes);
  // Pode voltar pendente pedindo justamente a perícia -- é o conserto.
  if (!r.sucesso && r.pendente) {
    opcoes.conhecimento_primordial_pericia = 'Natureza';
    r = await levelup.subirDeNivel(p, opcoes);
  }
  assert.ok(r.sucesso, `a subida ao nível 3 falhou: ${r.erro || r.tipo_pendencia}`);
  assert.ok(
    (r.caracteristicas || []).includes('Conhecimento Primordial'),
    `o resumo do nível 3 precisa anunciar a característica; veio ${JSON.stringify(r.caracteristicas)}`,
  );
});

test('Bárbaro 2 NÃO ganha a perícia -- ela é do nível 3', async () => {
  const p = await personagemInicialDeClasse('Bárbaro');
  const antes = [...(p.pericias_proficientes || [])];
  await subirAteNivel(p, 'Bárbaro', 2);
  assert.deepEqual(
    p.pericias_proficientes, antes,
    'nada de perícia nova antes do nível 3 -- a concessão está presa ao nível certo',
  );
});
