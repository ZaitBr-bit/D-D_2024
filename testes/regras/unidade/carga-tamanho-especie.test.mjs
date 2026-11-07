// ============================================================
// Capacidade de carga do Golias (issue #148). O traço Porte Poderoso
// (dados/origens/especies.json) faz o Golias contar como um tamanho maior
// na carga: Médio vira Grande, For x 13,5 kg (tabela do glossário).
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { modulosApp, personagemMulticlasse } from './harness.mjs';

const { sheetEstado } = await modulosApp();
const inventario = await import('../../../site/js/sheet/inventario.js');
const regrasCarga = await import('../../../site/js/regras-carga.js');

/** Guerreiro 1 da espécie indicada, Força 17, inventário vazio, já no estado da ficha. */
async function guerreiroForca17(especie) {
  const p = await personagemMulticlasse([{ classe: 'Guerreiro', nivel: 1 }]);
  p.especie = especie;
  p.tamanho = 'Médio';
  p.atributos.forca = 17;
  p.inventario = [];
  sheetEstado.definirChar(p);
  return p;
}

test('Golias Força 17: capacidade de 229,5 kg (17 x 13,5, como Grande)', async () => {
  await guerreiroForca17('Golias');
  assert.equal(inventario.getEstadoCarga().capacidade, 229.5);
});

test('Humano Força 17: capacidade continua 119 kg (17 x 7) -- o contraste', async () => {
  await guerreiroForca17('Humano');
  assert.equal(inventario.getEstadoCarga().capacidade, 119);
});

test('Golias carrega 150 kg sem sobrecarga; o Humano fica sobrecarregado', async () => {
  const golias = await guerreiroForca17('Golias');
  golias.inventario = [{ nome: 'Pedra', tipo: 'equipamento', quantidade: 1, dados: { peso: '150 kg' } }];
  sheetEstado.definirChar(golias);
  assert.equal(inventario.getEstadoCarga().sobrecarregado, false);

  const humano = await guerreiroForca17('Humano');
  humano.inventario = structuredClone(golias.inventario);
  sheetEstado.definirChar(humano);
  assert.equal(inventario.getEstadoCarga().sobrecarregado, true);
});

test('tamanhoParaCarga: sobe um tamanho e diz o traço; sem traço, devolve o tamanho', () => {
  assert.deepEqual(regrasCarga.tamanhoParaCarga('Médio', 'Golias'), { tamanho: 'Grande', traco: 'Porte Poderoso' });
  assert.deepEqual(regrasCarga.tamanhoParaCarga('Grande', 'Golias'), { tamanho: 'Enorme', traco: 'Porte Poderoso' });
  assert.deepEqual(regrasCarga.tamanhoParaCarga('Colossal', 'Golias'), { tamanho: 'Colossal', traco: 'Porte Poderoso' });
  assert.deepEqual(regrasCarga.tamanhoParaCarga('Médio', 'Humano'), { tamanho: 'Médio', traco: null });
  assert.deepEqual(regrasCarga.tamanhoParaCarga(undefined, undefined), { tamanho: 'Médio', traco: null });
});

// Porte Poderoso, 1ª metade: Vantagem no teste para encerrar Imobilizado.
// Escapar é Força (Atletismo) ou Destreza (Acrobacia) (glossário,
// "Imobilizando"); vale só para esse teste, então entra como nota V*.
const combate = await import('../../../site/js/sheet/combate.js');
const NOTA_PORTE = 'Porte Poderoso: Vantagem para encerrar a condição Imobilizado';

test('Golias sem Imobilizado: nenhuma nota de Porte Poderoso', async () => {
  await guerreiroForca17('Golias');
  for (const pericia of ['Atletismo', 'Acrobacia']) {
    assert.deepEqual(combate.calcVantagemDesvantagemPericia(pericia).notas, [], pericia);
  }
});

test('Golias Imobilizado: nota V* de Porte Poderoso em Atletismo e Acrobacia, sem virar Vantagem', async () => {
  const p = await guerreiroForca17('Golias');
  p.condicoes = ['Imobilizado'];
  for (const pericia of ['Atletismo', 'Acrobacia']) {
    const vd = combate.calcVantagemDesvantagemPericia(pericia);
    assert.deepEqual(vd.notas, [NOTA_PORTE], pericia);
    assert.deepEqual(vd.vantagens, [], `${pericia}: a Vantagem é só no teste de escapar`);
  }
  assert.deepEqual(combate.calcVantagemDesvantagemPericia('Furtividade').notas, []);
});

test('Humano Imobilizado: Atletismo e Acrobacia sem nota de Porte Poderoso -- o contraste', async () => {
  const p = await guerreiroForca17('Humano');
  p.condicoes = ['Imobilizado'];
  for (const pericia of ['Atletismo', 'Acrobacia']) {
    assert.deepEqual(combate.calcVantagemDesvantagemPericia(pericia).notas, [], pericia);
  }
});

test('toda espécie de dados/ com "tamanho maior ... capacidade de carga" está mapeada', () => {
  const url = new URL('../../../dados/origens/especies.json', import.meta.url);
  const dados = JSON.parse(readFileSync(url, 'utf-8'));
  const lista = Array.isArray(dados) ? dados : (dados.especies || Object.values(dados).flat());
  const comTraco = [];
  for (const esp of lista) {
    for (const t of esp?.tracos || []) {
      if (/tamanho maior ao determinar sua capacidade de carga/i.test(t.descricao || '')) {
        comTraco.push([esp.nome, t.nome]);
      }
    }
  }
  assert.deepEqual(comTraco, [['Golias', 'Porte Poderoso']], 'guarda vazia: o JSON mudou de forma?');
  for (const [especie, traco] of comTraco) {
    assert.equal(regrasCarga.tamanhoParaCarga('Médio', especie).traco, traco);
  }
});
