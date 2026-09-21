// ============================================================
// Issue #59 -- Ordem Divina (Clérigo) / Ordem Primal (Druida) ao entrar
// como classe NOVA num multiclasse. O criador (CLASSES_ESCOLHAS,
// creator/comum.js) sempre pediu essa escolha para quem começa nessas
// classes -- o motor de subida de nível (levelup.js) nunca pedia.
//
// `personagemMulticlasse` sobe o personagem direto para o nível pedido
// sem passar por `subirDeNivel` -- por isso `ignorar_xp: true` nas
// chamadas abaixo, mesmo padrão de multiclasse-proficiencias.test.mjs.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { modulosApp, personagemMulticlasse } from './harness.mjs';

test('entrar em Clérigo SEM escolher Ordem Divina é recusado, e nada é gravado', async () => {
  const { levelup } = await modulosApp();
  const p = await personagemMulticlasse([{ classe: 'Guerreiro', nivel: 5 }]);
  const antes = {
    classes: JSON.stringify(p.classes),
    escolhas: JSON.stringify(p.escolhas_classe || {}),
    extras: JSON.stringify(p.proficiencias_extra || []),
  };
  const r = await levelup.subirDeNivel(p, { classe: 'Clérigo', ignorar_xp: true });
  assert.equal(r.sucesso, false);
  assert.equal(r.tipo_pendencia, 'ordem_classe_nova');
  assert.equal(JSON.stringify(p.classes), antes.classes,
    'uma recusa nao pode ter gravado a classe -- nao existe descer de nivel');
  assert.equal(JSON.stringify(p.escolhas_classe || {}), antes.escolhas,
    'uma recusa nao pode ter gravado ordem nenhuma');
  assert.equal(JSON.stringify(p.proficiencias_extra || []), antes.extras,
    'uma recusa nao pode ter gravado proficiencia extra nenhuma');
});

test('Ordem Divina fora das opções válidas é recusada', async () => {
  const { levelup } = await modulosApp();
  const p = await personagemMulticlasse([{ classe: 'Guerreiro', nivel: 5 }]);
  const r = await levelup.subirDeNivel(p, {
    classe: 'Clérigo', ordem_classe_nova: 'Xamã', ignorar_xp: true,
  });
  assert.equal(r.sucesso, false);
  assert.equal(r.tipo_pendencia, 'ordem_classe_nova');
});

test('Guerreiro sobe para Clérigo escolhendo Taumaturgo: grava escolhas_classe.ordem_divina', async () => {
  const { levelup } = await modulosApp();
  const p = await personagemMulticlasse([{ classe: 'Guerreiro', nivel: 5 }]);
  const r = await levelup.subirDeNivel(p, {
    classe: 'Clérigo', ordem_classe_nova: 'Taumaturgo', ignorar_xp: true,
  });
  assert.equal(r.sucesso, true, r.mensagem);
  assert.deepEqual(p.escolhas_classe?.ordem_divina, ['Taumaturgo']);
  assert.equal(p.escolhas_classe?.ordem_primal, undefined, 'Clérigo não grava ordem_primal');
});

test('Guerreiro sobe para Clérigo escolhendo Protetor: ganha Armas Marciais e Armadura Pesada', async () => {
  const { levelup } = await modulosApp();
  const p = await personagemMulticlasse([{ classe: 'Guerreiro', nivel: 5 }]);
  const r = await levelup.subirDeNivel(p, {
    classe: 'Clérigo', ordem_classe_nova: 'Protetor', ignorar_xp: true,
  });
  assert.equal(r.sucesso, true, r.mensagem);
  assert.deepEqual(p.escolhas_classe?.ordem_divina, ['Protetor']);
  assert.ok(p.proficiencias_extra.includes('Armas Marciais'));
  assert.ok(p.proficiencias_extra.includes('Armadura Pesada'));
  assert.ok(!p.proficiencias_extra.includes('Armadura Média'),
    'Protetor do Clérigo dá Armadura PESADA, não Média (essa é do Druida)');
});

test('Guerreiro sobe para Druida escolhendo Xamã: grava escolhas_classe.ordem_primal', async () => {
  const { levelup } = await modulosApp();
  const p = await personagemMulticlasse([{ classe: 'Guerreiro', nivel: 5 }]);
  const r = await levelup.subirDeNivel(p, {
    classe: 'Druida', ordem_classe_nova: 'Xamã', ignorar_xp: true,
  });
  assert.equal(r.sucesso, true, r.mensagem);
  assert.deepEqual(p.escolhas_classe?.ordem_primal, ['Xamã']);
});

test('Guerreiro sobe para Druida escolhendo Protetor: ganha Armas Marciais e Armadura Média (não Pesada)', async () => {
  const { levelup } = await modulosApp();
  const p = await personagemMulticlasse([{ classe: 'Guerreiro', nivel: 5 }]);
  const r = await levelup.subirDeNivel(p, {
    classe: 'Druida', ordem_classe_nova: 'Protetor', ignorar_xp: true,
  });
  assert.equal(r.sucesso, true, r.mensagem);
  assert.ok(p.proficiencias_extra.includes('Armas Marciais'));
  assert.ok(p.proficiencias_extra.includes('Armadura Média'));
  assert.ok(!p.proficiencias_extra.includes('Armadura Pesada'),
    'Protetor da Druida dá Armadura MÉDIA, não Pesada (essa é do Clérigo)');
});

// ORÁCULO do cálculo de truques (issue #59, correção de montarConjuracao,
// levelup-flow.js): o CONTEXTO DO WIZARD (buildLevelUpContext/
// calcularConjuracao) precisa contar o truque do Taumaturgo na sessão em
// que a Ordem Divina é ESCOLHIDA -- antes da correção, ordem_divina só
// podia ter sido gravada numa subida ANTERIOR (nível 1 do criador), então
// o bônus era IDÊNTICO antes/depois e cancelava na subtração
// (truquesGanhos = truquesNovo - truquesAtual). A issue #59 quebra essa
// premissa: a Ordem passa a ser escolhida NA MESMA sessão que a classe
// entra, então antes da escolha o bônus é 0 e depois é 1 -- os dois lados
// não cancelam mais, e sem a correção o jogador via "ganhe 2 truques" na
// tela quando o livro concede 3 (2 da tabela + 1 do Taumaturgo).
test('ctx: Taumaturgo escolhido nesta sessão soma +1 em truquesGanhos (não cancela mais)', async () => {
  const { levelupFlow, db } = await modulosApp();
  // SEM Clérigo no array -- é a entrada NOVA (nível 0 -> 1 na classe) que
  // o teste quer simular, não uma subida de nível 1 -> 2 numa classe já
  // presente (diferença crucial para ehPrimeiroNivelNaClasse).
  const char = await personagemMulticlasse([{ classe: 'Guerreiro', nivel: 5 }]);
  const classeData = await db.getClasse('Clérigo');
  const ctx = await levelupFlow.buildLevelUpContext(char, classeData, {}, 'Clérigo');
  assert.ok(ctx.ordemClasseNovaPendente, 'sanity: Clérigo classe nova tem de pedir Ordem Divina');

  const semEscolha = levelupFlow.calcularConjuracao(ctx, {});
  const comTaumaturgo = levelupFlow.calcularConjuracao(ctx, { ordemClasseNovaEscolhida: 'Taumaturgo' });
  assert.equal(comTaumaturgo.truquesGanhos, semEscolha.truquesGanhos + 1,
    'escolher Taumaturgo tem de somar +1 truque ganho em relação a não escolher nada');
});

// Classe INICIAL (criador) não passa pelo motor -- não pede escolha nenhuma.
test('Clérigo como classe inicial não pede Ordem Divina no motor', async () => {
  const { levelup } = await modulosApp();
  const p = await personagemMulticlasse([{ classe: 'Clérigo', nivel: 1, subclasse: '' }]);
  p.escolhas_classe = { ordem_divina: ['Taumaturgo'] };
  const r = await levelup.subirDeNivel(p, { classe: 'Clérigo', ignorar_xp: true });
  assert.equal(r.sucesso, true, r.mensagem);
});

// Clérigo nível 2+ (mesma classe, não nova) não pede escolha de novo.
test('Clérigo nível 2 (mesma classe) não pede Ordem Divina de novo', async () => {
  const { levelup } = await modulosApp();
  const p = await personagemMulticlasse([{ classe: 'Clérigo', nivel: 2, subclasse: 'Domínio da Vida' }]);
  p.escolhas_classe = { ordem_divina: ['Taumaturgo'] };
  const r = await levelup.subirDeNivel(p, { classe: 'Clérigo', ignorar_xp: true });
  assert.equal(r.sucesso, true, r.mensagem);
});

// Chamar o motor duas vezes com a mesma escolha não pode duplicar a
// proficiência extra (idempotência).
test('proficiencias_extra não duplica ao chamar a validação depois da gravação', async () => {
  const { levelup } = await modulosApp();
  const p = await personagemMulticlasse([{ classe: 'Guerreiro', nivel: 5 }]);
  await levelup.subirDeNivel(p, { classe: 'Clérigo', ordem_classe_nova: 'Protetor', ignorar_xp: true });
  const qtdArmasMarciais = p.proficiencias_extra.filter((x) => x === 'Armas Marciais').length;
  assert.equal(qtdArmasMarciais, 1);
});
