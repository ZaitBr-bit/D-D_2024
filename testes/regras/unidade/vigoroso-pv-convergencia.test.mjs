// ============================================================
// Issue #89 -- "o bônus de PV do Vigoroso muda de valor dependendo de em
// que nível o talento é pego". A regra do livro ("dobro do nível de
// personagem ao obter, +2 por nível depois") é matematicamente
// EQUIVALENTE a "sempre 2×nível atual", para qualquer nível de aquisição
// -- 2N + 2(L-N) = 2L, para qualquer N ≤ L. `sincronizarBonusPvNivel`
// (levelup.js) já implementava essa fórmula corretamente; o bug era que
// ela só rodava no RENDER da ficha (sheet/ficha.js), nunca dentro do
// motor de subida de nível -- então o PV mostrado ficava atrasado até a
// ficha ser reaberta (ou errado para sempre, se nada a reabrisse).
//
// Este teste mede o PV MÁXIMO logo após `subirDeNivel`, SEM chamar
// nenhuma função de render/sincronização -- é exatamente o caminho que
// faltava. Dois Bárbaros idênticos, Vigoroso pego em níveis diferentes,
// terminam nível 20 com o MESMO PV máximo.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { personagemMulticlasse, subirAteNivel } from './harness.mjs';
import { modulosApp } from './harness.mjs';

/** Sobe um Bárbaro até `nivelVigoroso - 1`, pega Vigoroso EXATAMENTE no
 *  nível `nivelVigoroso` (via ASI), e continua até o nível 20 -- sem
 *  chamar nenhuma função de render/sincronização no meio do caminho. */
async function barbaroComVigorosoEm(nivelVigoroso) {
  const { levelup } = await modulosApp();
  const p = await personagemMulticlasse([{ classe: 'Bárbaro', nivel: 1 }]);
  p.talentos = [];
  await subirAteNivel(p, 'Bárbaro', nivelVigoroso - 1);
  const r = await levelup.subirDeNivel(p, { ignorar_xp: true, classe: 'Bárbaro', talento: 'Vigoroso' });
  assert.ok(r.sucesso, `subida com Vigoroso falhou: ${r.erro || r.tipo_pendencia}`);
  await subirAteNivel(p, 'Bárbaro', 20);
  return p;
}

test('Vigoroso pego no nível 4 ou no nível 16: o PV máximo final é IDÊNTICO, sem precisar de render', async () => {
  const cedo = await barbaroComVigorosoEm(4);
  const tarde = await barbaroComVigorosoEm(16);

  assert.equal(cedo.pv_max, tarde.pv_max,
    `Vigoroso no nível 4 deu pv_max=${cedo.pv_max}, no nível 16 deu pv_max=${tarde.pv_max} -- ` +
    'a regra do livro (2×nível, sempre) diz que os dois têm de terminar iguais no nível 20');

  // Trava o valor absoluto, não só a igualdade -- sem isto, um bug que
  // quebrasse os DOIS da mesma forma (iguais, mas errados) passaria batido.
  assert.equal(cedo.bonus_pv_vigoroso_aplicado, 40,
    'nível 20 × 2 = 40 de bônus do Vigoroso, não importa quando foi pego');
});

test('Vigoroso pego na ÚLTIMA subida de ASI do Bárbaro (nível 19): converge no mesmo golpe, sem esperar o nível seguinte', async () => {
  // Bárbaro só oferece ASI/talento em 4, 8, 12, 16 e 19 -- 19 é o último;
  // 20 é o capstone automático (Campeão Primitivo), sem escolha de
  // talento. Este é o caso que mede "não há próxima subida de ASI para
  // 'completar' o bônus depois" -- tem de fechar em 2×19=38 já aqui.
  const { levelup } = await modulosApp();
  const p = await personagemMulticlasse([{ classe: 'Bárbaro', nivel: 1 }]);
  p.talentos = [];
  await subirAteNivel(p, 'Bárbaro', 18);
  const r = await levelup.subirDeNivel(p, { ignorar_xp: true, classe: 'Bárbaro', talento: 'Vigoroso' });
  assert.ok(r.sucesso, `subida com Vigoroso falhou: ${r.erro || r.tipo_pendencia}`);

  assert.equal(p.nivel, 19);
  assert.ok((p.talentos || []).includes('Vigoroso'), 'sanity: o talento precisa ter sido gravado');
  assert.equal(p.bonus_pv_vigoroso_aplicado, 38,
    '2×19 = 38 -- sem depender de nenhuma subida futura nem de render');
});
