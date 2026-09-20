// ============================================================
// Issue #76 -- Truques/magias concedidos por característica de classe ou
// subclasse com USO GRÁTIS LIMITADO (ex.: Destruição do Paladino, Contatar
// Patrono do Bruxo) não tinham o botão "Grátis" na lista principal de
// Magias -- só o Ilusionista (Criaturas Espectrais) tinha tratamento real,
// via um caminho hardcoded em habilidades.js que nunca conjura pelo
// mecanismo genérico.
//
// A causa raiz não é falta de dado estruturado: `obterMagiasSemprePreparadasNivel`
// (levelup.js) já extrai o NOME da magia de frases como "Você sempre tem a
// magia *Destruição Divina* preparada" e a concede com `origem: 'sempre'`
// (isenta do limite, ORIGENS_MAGIA_ISENTA). O que falta é a SEGUNDA cláusula
// da mesma característica -- "...você pode conjurá-la sem gastar um espaço
// de magia... antes de completar um Descanso Longo" -- que hoje nenhuma
// função lê. Sem ela, a entrada nunca recebe `gratis_usado: false`, e o
// botão "Grátis" (sheet/magias.js, já genérico desde a issue #68) nunca
// aparece para nenhuma destas magias.
//
// Este teste mede a concessão em `subirDeNivel` (Paladino nível 2,
// Destruição do Paladino) -- escolhido porque a frase de Destruição Divina
// já é o exemplo LITERAL do docblock de `extrairMagiasSemprePreparadasTexto`,
// e porque o cenário "sempre preparada" dela já tem cobertura extensa em
// multiclasse-magias.test.mjs (ORÁCULO 26/27) -- este teste não reintroduz
// aquela extração, só a nova cláusula.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { personagemMulticlasse, subirAteNivel } from './harness.mjs';

test('Paladino nível 2 (Destruição do Paladino): Destruição Divina sempre preparada ganha uso grátis (gratis_usado:false)', async () => {
  const p = await personagemMulticlasse([{ classe: 'Paladino', nivel: 1 }]);
  await subirAteNivel(p, 'Paladino', 2);

  const entrada = (p.magias_preparadas || []).find((m) => m.nome === 'Destruição Divina');
  assert.ok(entrada, 'Destruição Divina precisa estar em magias_preparadas ao chegar no nível 2 de Paladino');
  assert.equal(entrada.origem, 'sempre', 'a concessão continua isenta do limite de preparadas -- não pode regredir');
  assert.equal(entrada.gratis_usado, false,
    'Destruição do Paladino concede conjuração sem gastar espaço de magia (1x/Descanso Longo) -- sem ' +
    '`gratis_usado:false` o botão "Grátis" da lista principal (issue #68) não aparece para esta magia');
});

test('Paladino nível 5 (Montaria Fiel): Convocar Montaria sempre preparada ganha uso grátis', async () => {
  const p = await personagemMulticlasse([{ classe: 'Paladino', nivel: 1 }]);
  await subirAteNivel(p, 'Paladino', 5);

  const entrada = (p.magias_preparadas || []).find((m) => m.nome === 'Convocar Montaria');
  assert.ok(entrada, 'Convocar Montaria precisa estar em magias_preparadas ao chegar no nível 5 de Paladino');
  assert.equal(entrada.origem, 'sempre');
  assert.equal(entrada.gratis_usado, false,
    'Montaria Fiel concede a mesma cláusula de Destruição do Paladino -- 1x sem gastar espaço, 1x/Descanso Longo');
});

// Manto de Majestade (Bardo, Colégio do Glamour, nível 6) foi MIGRADA
// (issue #76) do bookkeeping dedicado (`manto_majestade_usado`, botão
// "Ativar Manto de Majestade" em habilidades.js) para este mecanismo -- o
// botão antigo foi apagado, não só desligado. Ver
// migracao-gratis-controle-proprio.test.mjs para os discriminadores que
// provam a ausência do botão antigo E o gratis_usado real.
test('Bardo Colégio do Glamour nível 6 (Manto de Majestade, MIGRADA): Comando sempre preparada ganha uso grátis', async () => {
  const p = await personagemMulticlasse([{ classe: 'Bardo', nivel: 1, subclasse: 'Colégio do Glamour' }]);
  await subirAteNivel(p, 'Bardo', 6);

  const entrada = (p.magias_preparadas || []).find((m) => m.nome === 'Comando');
  assert.ok(entrada, 'Comando precisa estar em magias_preparadas ao chegar no nível 6 de Bardo Colégio do Glamour');
  assert.equal(entrada.origem, 'sempre');
  assert.equal(entrada.gratis_usado, false,
    'Manto de Majestade migrou do botão dedicado "Ativar Manto de Majestade" para o mecanismo genérico');
});

test('Bruxo nível 9 (Contatar Patrono): Contato Extraplanar sempre preparada ganha uso grátis', async () => {
  const p = await personagemMulticlasse([{ classe: 'Bruxo', nivel: 1 }]);
  await subirAteNivel(p, 'Bruxo', 9);

  const entrada = (p.magias_preparadas || []).find((m) => m.nome === 'Contato Extraplanar');
  assert.ok(entrada, 'Contato Extraplanar precisa estar em magias_preparadas ao chegar no nível 9 de Bruxo');
  assert.equal(entrada.origem, 'sempre');
  assert.equal(entrada.gratis_usado, false,
    'Contatar Patrono é a característica que o comentário do #76 usava como exemplo de "botão próprio" -- ' +
    'com esta correção ela passa a usar o mecanismo genérico da lista principal, como qualquer outra');
});

// DISCRIMINADOR: Inimigo Favorito (Guardião, nível 1) concede Marca do
// Caçador com a MESMA cláusula textual ("sem gastar um espaço de magia"),
// mas com DUAS vezes de uso (escalando por nível) -- não é 1 uso booleano
// como Destruição do Paladino. `gratis_usado` só guarda usado/não-usado;
// marcá-lo aqui esconderia o 2º uso por trás de um botão que já "esgotou"
// depois do 1º clique. Sem este teste, uma regex que só olhasse "sem
// gastar espaço de magia" (sem excluir "duas vezes"/"modificador de")
// passaria despercebida -- foi exatamente o que aconteceu nesta correção
// antes deste teste existir.
import { modulosApp } from './harness.mjs';

test('Inimigo Favorito (Guardião, uso MÚLTIPLO) não ganha gratis_usado -- gratis_usado é booleano, não contador', async () => {
  const { levelup } = await modulosApp();
  const concedidas = await levelup.obterMagiasSemprePreparadasNivel('Guardião', '', 1);
  const marca = concedidas.find((m) => m.nome === 'Marca do Caçador');
  assert.ok(marca, 'sanity: Inimigo Favorito precisa conceder Marca do Caçador no nível 1');
  assert.ok(!marca.gratisSemEspaco,
    'Marca do Caçador tem DOIS usos (escalando por nível) -- gratisSemEspaco marcaria só um booleano, ' +
    'e o botão "Grátis" esconderia o segundo uso depois do primeiro clique');
});

// Criaturas Espectrais (Ilusionista, nível 6) foi MIGRADA (issue #76) do
// bookkeeping dedicado (feerica_usada/fera_usada, botões "Convocar Feérico
// (Grátis)"/"Invocar Fera (Grátis)" em habilidades.js) para este
// mecanismo -- os botões antigos foram apagados, não só desligados.
test('Criaturas Espectrais (Ilusionista, MIGRADA) -- as duas magias ganham uso grátis', async () => {
  const { levelup } = await modulosApp();
  const concedidas = await levelup.obterMagiasSemprePreparadasNivel('Mago', 'Ilusionista', 6);
  assert.deepEqual(concedidas.map((m) => m.nome).sort(), ['Convocar Feérico', 'Invocar Fera'],
    'sanity: Criaturas Espectrais precisa conceder as duas magias sempre preparadas no nível 6');
  for (const m of concedidas) {
    assert.ok(m.gratisSemEspaco,
      `"${m.nome}" migrou do bookkeeping dedicado do painel de recursos para o mecanismo genérico`);
  }
});

// DISCRIMINADOR: uma magia de Domínio (concedida com a MESMA frase "sempre
// tem preparada", mas SEM a cláusula de conjuração sem gastar espaço) não
// pode ganhar `gratis_usado` -- ela continua exigindo um espaço de magia
// para conjurar, exatamente como o livro descreve. Sem este teste, uma
// implementação que marcasse `gratis_usado:false` para TODA magia 'sempre'
// (em vez de só as que têm a segunda cláusula) passaria despercebida.
test('magia de Domínio (sempre preparada, SEM cláusula de conjuração grátis) não ganha gratis_usado', async () => {
  const p = await personagemMulticlasse([{ classe: 'Clérigo', nivel: 1, subclasse: 'Domínio da Vida' }]);
  await subirAteNivel(p, 'Clérigo', 3);

  const magiasDominio = (p.magias_preparadas || []).filter((m) => m.origem === 'dominio');
  assert.ok(magiasDominio.length > 0, 'sanity: Domínio da Vida precisa ter concedido ao menos uma magia no nível 3');
  for (const m of magiasDominio) {
    assert.equal(m.gratis_usado, undefined,
      `"${m.nome}" é magia de Domínio -- não tem a cláusula "sem gastar espaço de magia" no livro, ` +
      'e não pode ganhar o botão "Grátis" por engano');
  }
});
