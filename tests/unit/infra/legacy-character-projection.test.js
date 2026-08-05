import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createMemoryStorage } from '../../helpers/memory-storage.js';
import { createLegacyAliasResolver } from '../../../site/js/infra/character/legacy-alias-resolver.js';
import { createPreMigrationBackupService } from '../../../site/js/infra/character/pre-migration-backup.js';
import { LocalStorageCharacterRepository } from '../../../site/js/infra/character/local-storage-character-repository.js';
import {
  projectLegacyCharacterEnvelope,
  acceptLegacyCharacterMutation,
  createLegacyStoreFacade,
  LegacyStoreFacadeError,
} from '../../../site/js/infra/character/legacy-character-projection.js';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const fixturesDir = path.join(repoRoot, 'tests/fixtures/characters');
const NOW = '2026-07-30T00:00:00.000Z';

let aliasResolver;
let legacyMinimalRaw;

before(async () => {
  const aliases = JSON.parse(
    await readFile(path.join(repoRoot, 'dados/pacotes/dnd2024/migrations/character-v1-aliases.json'), 'utf8'),
  );
  aliasResolver = createLegacyAliasResolver(aliases);
  const fixture = JSON.parse(await readFile(path.join(fixturesDir, 'legacy-minimal.json'), 'utf8'));
  legacyMinimalRaw = fixture.cases[0].personagem;
});

/** Monta repositório + fachada legada num storage novo. */
function buildFacade() {
  const storage = createMemoryStorage();
  const backupService = createPreMigrationBackupService({ storage });
  const repository = LocalStorageCharacterRepository({ storage, aliasResolver, backupService, clock: { now: () => NOW } });
  const facade = createLegacyStoreFacade({ repository, aliasResolver, clock: { now: () => NOW } });
  return { storage, repository, facade };
}

describe('legacy-character-projection — projectLegacyCharacterEnvelope/acceptLegacyCharacterMutation', () => {
  test('round-trip: projeção plana volta ao mesmo canônico via acceptLegacyCharacterMutation', () => {
    const raw = { ...legacyMinimalRaw, id: 'proj-1' };
    const decoded = { mode: 'editable', character: undefined, rawRecord: raw, revisionToken: 'tok', recordFingerprint: 'tok', warnings: [], localSync: null };
    const projected = projectLegacyCharacterEnvelope(decoded);
    assert.deepEqual(projected, raw);
    assert.notEqual(projected, raw, 'deveria ser uma cópia rasa, não o mesmo objeto');

    const accepted = acceptLegacyCharacterMutation(projected, { aliasResolver, now: NOW });
    assert.equal(accepted.ok, true);
    assert.equal(accepted.value.identity.id, 'proj-1');
  });

  test('acceptLegacyCharacterMutation recusa registro de schema futuro', () => {
    const raw = { _schema: { version: 999 }, id: 'future-1' };
    const result = acceptLegacyCharacterMutation(raw, { aliasResolver, now: NOW });
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'CHARACTER_LEGACY_MUTATION_UNSUPPORTED_SCHEMA');
  });
});

describe('legacy-character-projection — createLegacyStoreFacade', () => {
  test('save() de objeto novo (id inédito) cria; save() do MESMO objeto (agora com token) atualiza', () => {
    const { facade } = buildFacade();
    const novo = { ...legacyMinimalRaw, id: 'facade-1', nome: 'Original' };
    const criado = facade.save(novo);
    assert.equal(criado.id, 'facade-1');

    criado.nome = 'Editado';
    const atualizado = facade.save(criado);
    assert.equal(atualizado.nome, 'Editado');
  });

  test('salvar repetidamente o MESMO objeto de ENTRADA (nunca o valor de retorno) — o padrão real de site/js/pages/sheet.js#salvar', () => {
    // Regressão real encontrada via e2e (Task 13): sheet.js mantém `char`
    // como variável de módulo, muta em memória e chama `salvarPersonagem(char)`
    // (== facade.save(char)) repetidas vezes SEM NUNCA reatribuir `char` ao
    // retorno de save(). Sem atualizar o WeakMap para o objeto de ENTRADA (e
    // não só para a projeção nova devolvida), a segunda chamada usaria o
    // token pré-primeira-escrita (já obsoleto) e falharia com um conflito de
    // revisão espúrio contra si mesma.
    const { facade } = buildFacade();
    const novo = { ...legacyMinimalRaw, id: 'facade-resave-1', nome: 'V1' };
    facade.save(novo); // cria — `novo` continua sendo o MESMO objeto de entrada.

    novo.nome = 'V2';
    assert.doesNotThrow(() => facade.save(novo), 'segundo save do mesmo objeto de entrada não deveria conflitar consigo mesmo');

    novo.nome = 'V3';
    assert.doesNotThrow(() => facade.save(novo), 'terceiro save do mesmo objeto de entrada também não deveria conflitar');

    const final = facade.get('facade-resave-1');
    assert.equal(final.nome, 'V3');
  });

  test('list()/get() associam o objeto plano devolvido ao token via WeakMap; save() desse objeto funciona', () => {
    const { facade } = buildFacade();
    facade.save({ ...legacyMinimalRaw, id: 'facade-2' });

    const [obtido] = facade.list();
    obtido.nome = 'Via lista';
    const salvo = facade.save(obtido);
    assert.equal(salvo.nome, 'Via lista');

    const viaGet = facade.get('facade-2');
    viaGet.nome = 'Via get';
    const salvo2 = facade.save(viaGet);
    assert.equal(salvo2.nome, 'Via get');
  });

  test('objeto clonado (mesmo id de um existente, sem WeakMap) falha com conflito, nunca relê token silenciosamente', () => {
    const { facade } = buildFacade();
    const criado = facade.save({ ...legacyMinimalRaw, id: 'facade-3' });
    const clone = JSON.parse(JSON.stringify(criado)); // clone: nova identidade de objeto, mesmo id

    assert.throws(() => facade.save(clone), (thrown) => {
      assert.ok(thrown instanceof LegacyStoreFacadeError);
      assert.equal(thrown.appError.code, 'CHARACTER_LEGACY_FACADE_STALE_OBJECT');
      return true;
    });
  });

  test('objeto novo (id inédito, ex.: duplicarPersonagem com novo id) é aceito como criação sem passo de registro à parte', () => {
    const { facade } = buildFacade();
    const original = facade.save({ ...legacyMinimalRaw, id: 'facade-4' });
    const copia = JSON.parse(JSON.stringify(original));
    copia.id = 'facade-4-copia';
    const salva = facade.save(copia);
    assert.equal(salva.id, 'facade-4-copia');
  });

  test('remove(id) exige que o id tenha sido observado por list/get/save NESTA fachada; uma fachada que nunca o observou falha', () => {
    const storage = createMemoryStorage();
    const backupService = createPreMigrationBackupService({ storage });
    const repository = LocalStorageCharacterRepository({ storage, aliasResolver, backupService, clock: { now: () => NOW } });
    const facadeA = createLegacyStoreFacade({ repository, aliasResolver, clock: { now: () => NOW } });
    const facadeB = createLegacyStoreFacade({ repository, aliasResolver, clock: { now: () => NOW } }); // "outra aba": Map<id,token> próprio, vazio

    facadeA.save({ ...legacyMinimalRaw, id: 'facade-5' });

    assert.throws(() => facadeB.remove('facade-5'), (thrown) => {
      assert.equal(thrown.appError.code, 'CHARACTER_LEGACY_FACADE_REMOVE_TOKEN_MISSING');
      return true;
    });

    facadeB.get('facade-5'); // observa o token nesta fachada
    facadeB.remove('facade-5'); // agora funciona
    assert.equal(facadeA.get('facade-5'), null);
  });

  test('remove() bem-sucedido apaga a entrada do id; save() bem-sucedido atualiza WeakMap e Map<id,token>', () => {
    const { facade } = buildFacade();
    const criado = facade.save({ ...legacyMinimalRaw, id: 'facade-6' });
    facade.get('facade-6');
    facade.remove('facade-6');

    // Uma segunda remoção do mesmo id (entrada já apagada) volta a falhar por token ausente.
    assert.throws(() => facade.remove('facade-6'), (thrown) => {
      assert.equal(thrown.appError.code, 'CHARACTER_LEGACY_FACADE_REMOVE_TOKEN_MISSING');
      return true;
    });
    void criado;
  });

  test('duas "abas" (duas fachadas sobre o mesmo storage): a segunda com objeto stale recebe conflito de revisão', () => {
    const storage = createMemoryStorage();
    const backupService = createPreMigrationBackupService({ storage });
    const repository = LocalStorageCharacterRepository({ storage, aliasResolver, backupService, clock: { now: () => NOW } });
    const facadeA = createLegacyStoreFacade({ repository, aliasResolver, clock: { now: () => NOW } });
    const facadeB = createLegacyStoreFacade({ repository, aliasResolver, clock: { now: () => NOW } });

    facadeA.save({ ...legacyMinimalRaw, id: 'facade-7' });
    const objA = facadeA.get('facade-7');
    const objB = facadeB.get('facade-7');

    objA.nome = 'Aba A';
    facadeA.save(objA);

    objB.nome = 'Aba B';
    assert.throws(() => facadeB.save(objB), (thrown) => {
      assert.equal(thrown.appError.code, 'CHARACTER_SAVE_REVISION_CONFLICT');
      return true;
    });
  });

  test('nenhum Symbol/token aparece em JSON.stringify do objeto devolvido', () => {
    const { facade } = buildFacade();
    const criado = facade.save({ ...legacyMinimalRaw, id: 'facade-8' });
    const text = JSON.stringify(criado);
    assert.equal(text.includes('revisionToken'), false);
    assert.equal(Object.getOwnPropertySymbols(criado).length, 0);
  });
});
