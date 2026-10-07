// ============================================================
// Exportação/importação em JSON: o que as versões 3.2 e 3.3 passaram a gravar no
// personagem (familiar, Mortos-Vivos, livro empunhado, Forma Selvagem, usos de
// invocação, aviso dispensado, concessões do Necromante) sai no arquivo, volta
// igual e não perde nada para o JSON (undefined, Map, NaN).
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { RAIZ, modulosApp } from './harness.mjs';

const importar = (rel) => import(pathToFileURL(resolve(RAIZ, rel)).href);

test('personagem com os recursos novos: exporta, importa e reexporta igual, sem perda no JSON', async () => {
  const { store, regras } = await modulosApp();
  const F = await importar('site/js/regras-familiar.js');
  const N = await importar('site/js/regras-necromante.js');
  const criaturas = (await import(pathToFileURL(resolve(RAIZ, 'dados/apendices/criaturas.json')).href, { with: { type: 'json' } })).default.criaturas;

  const p = store.criarPersonagemVazio();
  Object.assign(p, {
    nome: 'Vorak', atributos: { ...p.atributos, inteligencia: 16 },
    classes: [{ classe: 'Mago', subclasse: 'Necromante', nivel: 14, ordem: 0 }, { classe: 'Bruxo', subclasse: '', nivel: 1, ordem: 1 }],
    classe: 'Mago', subclasse: 'Necromante', nivel: 15, schema_versao: 2,
    resistencias: ['Necrótico'], grimorio: [{ nome: 'Convocar Familiar', circulo: 1, classe: 'Mago', origem: 'subclasse' }],
    config: { aviso_truques_dispensado: true },
  });
  F.registrarFamiliar(p, criaturas.find((c) => c.nome === 'Esqueleto'), { especial: true, tipos: F.tiposDoPersonagem(p) });
  N.registrarMortoVivo(p, criaturas.find((c) => c.nome === 'Zumbi'), { quantidade: 2 });
  N.estadoNecromante(p).livro_empunhado = true;
  N.fortalecerMortosVivos(p);
  p.recursos.druida = { forma_selvagem_atual: { forma: 'Lobo', horas: 2, pv_temporarios: 8 } };
  p.recursos.bruxo = { invocacoes_usos: { vigor_infero: true } };

  assert.deepEqual(JSON.parse(JSON.stringify(p)), p, 'algum campo novo se perde ao virar JSON (undefined, Map, NaN)');

  store.salvarPersonagem(p);
  const arquivo = store.exportarPersonagem(p.id);
  const doArquivo = JSON.parse(arquivo)[0];
  assert.ok(doArquivo.recursos.familiar, 'familiar no arquivo');
  assert.equal(doArquivo.recursos.mago.subclasses.necromante.mortos_vivos.length, 2);
  assert.equal(doArquivo.recursos.mago.subclasses.necromante.livro_empunhado, true);
  assert.equal(doArquivo.recursos.mago.subclasses.necromante.fortalecer_usado, true);
  assert.equal(doArquivo.recursos.druida.forma_selvagem_atual.forma, 'Lobo');
  assert.equal(doArquivo.recursos.bruxo.invocacoes_usos.vigor_infero, true);
  assert.equal(doArquivo.config.aviso_truques_dispensado, true);

  store.removerPersonagem(p.id);
  assert.equal(store.importarPersonagens(arquivo), 1, 'o arquivo exportado é aceito na importação');
  const volta = JSON.parse(store.exportarPersonagem(p.id))[0];
  const { atualizado_em: _a, ...v } = volta;
  const { atualizado_em: _b, ...o } = doArquivo;
  assert.deepEqual(v, o, 'a reexportação difere do arquivo importado');
});
