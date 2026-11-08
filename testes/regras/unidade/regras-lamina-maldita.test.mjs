// ============================================================
// Regras puras da Lâmina Maldita (Bruxo, Xanathar): Maldição da Lâmina Maldita,
// Armadura de Maldições, Espectro Amaldiçoado e descansos.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { modulosApp, personagemMulticlasse } from './harness.mjs';

await modulosApp();
const r = await import('../../../site/js/regras-lamina-maldita.js');
const { multiclasse } = await modulosApp();

/** Personagem com as classes dadas, Carisma e condições dados. */
async function personagem(classes, { car = 10, condicoes = [] } = {}) {
  const p = await personagemMulticlasse(classes.map(({ classe, nivel }) => ({ classe, nivel })));
  p.classes = classes.map((c, i) => ({ classe: c.classe, subclasse: c.subclasse || '', nivel: c.nivel, ordem: i }));
  multiclasse.sincronizarEspelhos(p);
  p.atributos = { forca: 10, destreza: 14, constituicao: 12, inteligencia: 10, sabedoria: 10, carisma: car };
  p.atributos_base = { ...p.atributos };
  p.inventario = [];
  p.condicoes = condicoes;
  p.recursos = {};
  return p;
}
const BRUXO = (nivel) => [{ classe: 'Bruxo', subclasse: r.SUBCLASSE_LAMINA_MALDITA, nivel }];

test('só Patrono Lâmina Maldita com Bruxo 3+', async () => {
  assert.equal(r.ehLaminaMaldita(await personagem(BRUXO(2))), false);
  assert.equal(r.ehLaminaMaldita(await personagem(BRUXO(3))), true);
  assert.equal(r.ehLaminaMaldita(await personagem([{ classe: 'Guerreiro', nivel: 5 }])), false);
});

test('estado fica em recursos.lamina_maldita, com padrões falsos', async () => {
  const p = await personagem(BRUXO(3));
  assert.deepEqual(r.estadoLaminaMaldita(p), { maldicao_ativa: false, maldicao_usada: false, espectro_usado: false, espectro_ativo: false });
  assert.ok(p.recursos.lamina_maldita);
  assert.equal(p.recursos.bruxo, undefined);
});

test('amaldiçoar: bônus = proficiência do nível total, recusa repetir e uso gasto', async () => {
  const p = await personagem([{ classe: 'Bruxo', subclasse: r.SUBCLASSE_LAMINA_MALDITA, nivel: 3 }, { classe: 'Guerreiro', nivel: 2 }]);
  assert.equal(r.bonusDanoMaldicao(p), 0);
  assert.deepEqual(r.amaldicoar(p), { ok: true });
  assert.equal(r.bonusDanoMaldicao(p), 3);
  const segunda = r.amaldicoar(p);
  assert.equal(segunda.ok, false);
  assert.match(segunda.motivo, /já está ativa/i);
  r.encerrarMaldicao(p);
  const gasto = r.amaldicoar(p);
  assert.equal(gasto.ok, false);
  assert.match(gasto.motivo, /uso/i);
});

test('amaldiçoar recusa sem o patrono', async () => {
  const r2 = r.amaldicoar(await personagem([{ classe: 'Bruxo', subclasse: 'Arquifada', nivel: 5 }]));
  assert.equal(r2.ok, false);
});

test('Incapacitado: maldição inativa, bônus 0 e encerramento', async () => {
  const p = await personagem(BRUXO(3), { condicoes: ['Atordoado'] });
  p.recursos.lamina_maldita = { maldicao_ativa: true };
  assert.equal(r.maldicaoAtiva(p), false);
  assert.equal(r.bonusDanoMaldicao(p), 0);
  assert.equal(r.encerrarMaldicaoSeIncapacitado(p), true);
  assert.equal(p.recursos.lamina_maldita.maldicao_ativa, false);
  assert.equal(r.encerrarMaldicaoSeIncapacitado(p), false);
});

test('amaldiçoar recusa Incapacitado', async () => {
  const p = await personagem(BRUXO(3), { condicoes: ['Atordoado'] });
  assert.equal(r.amaldicoar(p).ok, false);
});

test('cura ao alvo morrer: nível de Bruxo + mod. Car, mínimo 1', async () => {
  assert.equal(r.curaAlvoMorreu(await personagem(BRUXO(5), { car: 16 })), 8);
  assert.equal(r.curaAlvoMorreu(await personagem(BRUXO(3), { car: 1 })), 1);
});

test('alvo morreu sem maldição ativa ou Incapacitado: sem cura e sem criar estado', async () => {
  const sem = await personagem(BRUXO(5), { car: 16 });
  assert.deepEqual(r.alvoMorreu(sem, false), { cura: 0, passou: false });
  assert.equal(sem.recursos.lamina_maldita, undefined);
  const naoPatrono = await personagem([{ classe: 'Guerreiro', nivel: 5 }]);
  assert.deepEqual(r.alvoMorreu(naoPatrono, true), { cura: 0, passou: false });
  assert.equal(naoPatrono.recursos.lamina_maldita, undefined);
  const inc = await personagem(BRUXO(5), { car: 16, condicoes: ['Atordoado'] });
  assert.deepEqual(r.alvoMorreu(inc, false), { cura: 0, passou: false });
  assert.equal(inc.recursos.lamina_maldita, undefined);
});

test('alvo morreu com maldição gravada como ativa: Incapacitado isola a guarda', async () => {
  const livre = await personagem(BRUXO(5), { car: 16 });
  livre.recursos.lamina_maldita = { maldicao_ativa: true };
  assert.ok(r.alvoMorreu(livre, false).cura >= 1);
  const inc = await personagem(BRUXO(5), { car: 16, condicoes: ['Atordoado'] });
  inc.recursos.lamina_maldita = { maldicao_ativa: true };
  assert.deepEqual(r.alvoMorreu(inc, false), { cura: 0, passou: false });
});

test('podeLevantarEspectro e descansos não criam estado em quem não é patrono', async () => {
  const p = await personagem([{ classe: 'Guerreiro', nivel: 8 }]);
  assert.equal(r.podeLevantarEspectro(p), false);
  r.descansoCurtoLaminaMaldita(p);
  r.descansoLongoLaminaMaldita(p);
  assert.equal(p.recursos.lamina_maldita, undefined);
});

test('alvo morreu: Bruxo 13 encerra e cura; Bruxo 14 pode passar a maldição', async () => {
  const p13 = await personagem(BRUXO(13), { car: 16 });
  r.amaldicoar(p13);
  assert.equal(r.podePassarMaldicao(p13), false);
  assert.deepEqual(r.alvoMorreu(p13, true), { cura: 16, passou: false });
  assert.equal(r.maldicaoAtiva(p13), false);

  const p14 = await personagem(BRUXO(14), { car: 16 });
  r.amaldicoar(p14);
  assert.equal(r.podePassarMaldicao(p14), true);
  assert.deepEqual(r.alvoMorreu(p14, true), { cura: 0, passou: true });
  assert.equal(r.maldicaoAtiva(p14), true);
  assert.deepEqual(r.alvoMorreu(p14, false), { cura: 17, passou: false });
  assert.equal(r.maldicaoAtiva(p14), false);
});

test('Armadura de Maldições: Bruxo 10+ com maldição ativa; 4+ erra', async () => {
  const p9 = await personagem(BRUXO(9));
  r.amaldicoar(p9);
  assert.equal(r.podeArmaduraMaldicoes(p9), false);
  const p10 = await personagem(BRUXO(10));
  assert.equal(r.podeArmaduraMaldicoes(p10), false);
  r.amaldicoar(p10);
  assert.equal(r.podeArmaduraMaldicoes(p10), true);
  assert.equal(r.resultadoArmaduraMaldicoes(3), 'acerta');
  assert.equal(r.resultadoArmaduraMaldicoes(4), 'erra');
});

test('Espectro Amaldiçoado: Bruxo 6+, uso único, PV temporários e ataque', async () => {
  assert.equal(r.podeLevantarEspectro(await personagem(BRUXO(5))), false);
  const p = await personagem(BRUXO(6));
  assert.equal(r.podeLevantarEspectro(p), true);
  assert.deepEqual(r.levantarEspectro(p), { ok: true });
  assert.equal(p.recursos.lamina_maldita.espectro_ativo, true);
  assert.equal(r.podeLevantarEspectro(p), false);
  assert.equal(r.levantarEspectro(p).ok, false);
  r.dispensarEspectro(p);
  assert.equal(p.recursos.lamina_maldita.espectro_ativo, false);
  assert.equal(p.recursos.lamina_maldita.espectro_usado, true);
  assert.equal(r.pvTemporariosEspectro(await personagem(BRUXO(7))), 3);
  assert.equal(r.bonusAtaqueEspectro(await personagem(BRUXO(7), { car: 8 })), 0);
  assert.equal(r.bonusAtaqueEspectro(await personagem(BRUXO(7), { car: 16 })), 3);
});

test('descanso curto devolve a maldição e mantém o Espectro', async () => {
  const p = await personagem(BRUXO(6));
  r.amaldicoar(p);
  r.levantarEspectro(p);
  r.descansoCurtoLaminaMaldita(p);
  assert.deepEqual(r.estadoLaminaMaldita(p), { maldicao_ativa: false, maldicao_usada: false, espectro_usado: true, espectro_ativo: true });
});

test('descanso longo devolve tudo e dispensa o Espectro', async () => {
  const p = await personagem(BRUXO(6));
  r.amaldicoar(p);
  r.levantarEspectro(p);
  r.descansoLongoLaminaMaldita(p);
  assert.deepEqual(r.estadoLaminaMaldita(p), { maldicao_ativa: false, maldicao_usada: false, espectro_usado: false, espectro_ativo: false });
});

test('0 PV: maldição inativa, bônus 0 e alvo morto sem cura', async () => {
  const p = await personagem(BRUXO(5), { car: 16 });
  p.recursos.lamina_maldita = { maldicao_ativa: true };
  p.pv_atual = 10;
  assert.equal(r.maldicaoAtiva(p), true);
  p.pv_atual = 0;
  assert.equal(r.maldicaoAtiva(p), false);
  assert.equal(r.bonusDanoMaldicao(p), 0);
  assert.deepEqual(r.alvoMorreu(p, false), { cura: 0, passou: false });
  assert.equal(r.encerrarMaldicaoSeIncapacitado(p), true);
  assert.equal(p.recursos.lamina_maldita.maldicao_ativa, false);
});
