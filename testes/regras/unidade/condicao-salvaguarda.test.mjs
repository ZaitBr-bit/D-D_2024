// ============================================================
// Issue #94, Fase 2 -- Falha automática em salvaguardas de Força/Destreza
// para Atordoado, Inconsciente, Paralisado e Petrificado (glossário de
// condições, condicoes.js). calcVantagemDesvantagemSalvaguarda foi
// extraída do bloco inline que já existia em ficha.js (Fúria, Sentido de
// Perigo, traços de espécie, Contido→Destreza) -- os testes de regressão
// abaixo garantem que a extração não mudou nada do que já funcionava.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { modulosApp, personagemMulticlasse } from './harness.mjs';

await modulosApp();
const sheetCombate = await import('../../../site/js/sheet/combate.js');
const GUERREIRO_1 = [{ classe: 'Guerreiro', nivel: 1 }];

async function salvaguardaComCondicoes(nomeAtributo, condicoes, ajustar) {
  const { sheetEstado } = await modulosApp();
  const p = await personagemMulticlasse(GUERREIRO_1);
  p.condicoes = condicoes;
  if (ajustar) ajustar(p);
  sheetEstado.definirChar(p);
  return sheetCombate.calcVantagemDesvantagemSalvaguarda(nomeAtributo);
}

for (const condicao of ['Atordoado', 'Inconsciente', 'Paralisado', 'Petrificado']) {
  test(`${condicao}: falha automática em salvaguarda de Força`, async () => {
    const vd = await salvaguardaComCondicoes('Força', [condicao]);
    assert.equal(vd.falhaAutomatica, true, `${condicao} tem de forçar falha automática em Força`);
    assert.deepEqual(vd.fontesFalha, [condicao]);
  });

  test(`${condicao}: falha automática em salvaguarda de Destreza`, async () => {
    const vd = await salvaguardaComCondicoes('Destreza', [condicao]);
    assert.equal(vd.falhaAutomatica, true, `${condicao} tem de forçar falha automática em Destreza`);
  });

  test(`${condicao}: NÃO força falha automática em salvaguarda de Sabedoria (só For/Des)`, async () => {
    const vd = await salvaguardaComCondicoes('Sabedoria', [condicao]);
    assert.equal(vd.falhaAutomatica, false,
      'o livro só cita Força e Destreza -- Sabedoria não pode falhar automaticamente por essas condições');
  });
}

test('Contraste: sem nenhuma condição, Força não tem falha automática', async () => {
  const vd = await salvaguardaComCondicoes('Força', []);
  assert.equal(vd.falhaAutomatica, false);
  assert.deepEqual(vd.fontesFalha, []);
});

test('Regressão: Contido continua dando Desvantagem (não falha automática) em salvaguarda de Destreza', async () => {
  const vd = await salvaguardaComCondicoes('Destreza', ['Contido']);
  assert.equal(vd.falhaAutomatica, false, 'Contido não está na lista de falha automática do livro');
  assert.deepEqual(vd.desvantagens, ['Contido']);
});

test('Regressão: Fúria ativa continua dando Vantagem em salvaguarda de Força', async () => {
  const BARBARO_1 = [{ classe: 'Bárbaro', nivel: 1 }];
  const { sheetEstado } = await modulosApp();
  const p = await personagemMulticlasse(BARBARO_1);
  p.condicoes = [];
  p.recursos = { ...(p.recursos || {}), furia_ativa: true };
  sheetEstado.definirChar(p);
  const vd = sheetCombate.calcVantagemDesvantagemSalvaguarda('Força');
  assert.deepEqual(vd.vantagens, ['Fúria']);
});

test('Regressão: Sentido de Perigo (Bárbaro 2+) some quando Incapacitado', async () => {
  const BARBARO_2 = [{ classe: 'Bárbaro', nivel: 2 }];
  const { sheetEstado } = await modulosApp();
  const p = await personagemMulticlasse(BARBARO_2);
  p.condicoes = ['Incapacitado'];
  sheetEstado.definirChar(p);
  const vd = sheetCombate.calcVantagemDesvantagemSalvaguarda('Destreza');
  assert.ok(!vd.vantagens.includes('Sentido de Perigo'),
    'Sentido de Perigo exige poder ver o atacante -- não pode aparecer com o personagem Incapacitado');
});
