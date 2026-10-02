// ============================================================
// Issue #115 -- o +1 de Constituição vindo do talento (ex.: Resistente) não
// dava o PV retroativo de +1 por nível. `subirDeNivel` calculava o delta de
// modificador de CON antes de aplicar o aumento embutido do talento, então
// CON 17 -> 18 (modificador +3 -> +4) não rendia os PV retroativos.
//
// Cada teste compara o pv_max antes e depois da MESMA subida de nível:
// o ganho normal do nível é medido no contraste (talento em outro atributo),
// e o retroativo é a diferença para o caso com CON.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { personagemMulticlasse, subirAteNivel, modulosApp } from './harness.mjs';

/** Bárbaro no nível 11 com CON 17, pronto para a subida de ASI do nível 12. */
async function barbaroNivel11ComCon17() {
  const p = await personagemMulticlasse([{ classe: 'Bárbaro', nivel: 1 }]);
  p.talentos = [];
  await subirAteNivel(p, 'Bárbaro', 11);
  p.atributos.constituicao = 17;
  return p;
}

test('talento com +1 em Constituição (17 -> 18) concede o PV retroativo por nível', async () => {
  const { levelup } = await modulosApp();
  const p = await barbaroNivel11ComCon17();
  const pvAntes = p.pv_max;
  const r = await levelup.subirDeNivel(p, {
    ignorar_xp: true, classe: 'Bárbaro', talento: 'Resistente', talento_asi: 'constituicao',
  });
  assert.ok(r.sucesso, `subida falhou: ${r.erro || r.tipo_pendencia}`);
  assert.equal(p.nivel, 12);
  assert.equal(p.atributos.constituicao, 18);

  // Referência: mesma subida com Sentinela, cujo +1 vai para Força (CON fica em 17).
  const ref = await barbaroNivel11ComCon17();
  ref.pv_max = pvAntes;
  const rRef = await levelup.subirDeNivel(ref, {
    ignorar_xp: true, classe: 'Bárbaro', talento: 'Sentinela', talento_asi: 'forca',
  });
  assert.ok(rRef.sucesso, `subida de referência falhou: ${rRef.erro || rRef.tipo_pendencia}`);
  assert.equal(ref.atributos.constituicao, 17);

  assert.equal(p.pv_max - ref.pv_max, 12,
    'CON 17 -> 18 sobe o modificador em 1: +1 PV em cada um dos 12 níveis');
  assert.equal(r.bonus_con_retroativo, 12, 'o retorno reflete o retroativo aplicado');
});

test('ASI padrão em Constituição continua dando o retroativo uma única vez', async () => {
  const { levelup } = await modulosApp();
  const p = await barbaroNivel11ComCon17();
  const ref = await barbaroNivel11ComCon17();
  ref.pv_max = p.pv_max;

  const r = await levelup.subirDeNivel(p, {
    ignorar_xp: true, classe: 'Bárbaro', talento: 'Aumento no Valor de Atributo',
    aumentos_atributo: { constituicao: 1, forca: 1 },
  });
  assert.ok(r.sucesso, `subida falhou: ${r.erro || r.tipo_pendencia}`);
  const rRef = await levelup.subirDeNivel(ref, {
    ignorar_xp: true, classe: 'Bárbaro', talento: 'Aumento no Valor de Atributo',
    aumentos_atributo: { destreza: 1, forca: 1 },
  });
  assert.ok(rRef.sucesso, `subida de referência falhou: ${rRef.erro || rRef.tipo_pendencia}`);

  assert.equal(p.atributos.constituicao, 18);
  assert.equal(p.pv_max - ref.pv_max, 12, 'retroativo contado uma vez: +12, não +24');
  assert.equal(r.bonus_con_retroativo, 12);
});
