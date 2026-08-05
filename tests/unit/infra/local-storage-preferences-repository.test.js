import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { createMemoryStorage } from '../../helpers/memory-storage.js';
import {
  LocalStoragePreferencesRepository,
  resolveLevelUpFlowV2,
  CURRENCY_RATES_KEY,
  PURCHASE_EQUIPPED_DEFAULT_KEY,
  LEVELUP_FLOW_V2_KEY,
  sheetCollapseKey,
} from '../../../site/js/infra/preferences/local-storage-preferences-repository.js';

describe('local-storage-preferences-repository — chaves exatas preservadas', () => {
  test('chaves são exatamente as do baseline', () => {
    assert.equal(CURRENCY_RATES_KEY, 'dnd_taxas_moeda');
    assert.equal(PURCHASE_EQUIPPED_DEFAULT_KEY, 'dnd_comprar_ativo_padrao');
    assert.equal(LEVELUP_FLOW_V2_KEY, 'feature.levelup.flow.v2');
    assert.equal(sheetCollapseKey('abc'), 'sheet_collapse_abc');
  });
});

describe('local-storage-preferences-repository — taxas de moeda', () => {
  test('default é null quando ausente', () => {
    const repo = LocalStoragePreferencesRepository({ storage: createMemoryStorage() });
    const result = repo.getCurrencyRates();
    assert.equal(result.ok, true);
    assert.equal(result.value.value, null);
    assert.deepEqual(result.value.warnings, []);
  });

  test('set/get roundtrip; reload (nova instância sobre o mesmo storage) lê o mesmo valor', () => {
    const storage = createMemoryStorage();
    const repo1 = LocalStoragePreferencesRepository({ storage });
    repo1.setCurrencyRates({ pp: 10, pe: 50, po: 100, pl: 1000 });

    const repo2 = LocalStoragePreferencesRepository({ storage });
    const result = repo2.getCurrencyRates();
    assert.deepEqual(result.value.value, { pp: 10, pe: 50, po: 100, pl: 1000 });
  });

  test('valor corrompido gera warning e cai para o default, sem regravar', () => {
    const storage = createMemoryStorage({ [CURRENCY_RATES_KEY]: '{ nao e json' });
    const repo = LocalStoragePreferencesRepository({ storage });
    const result = repo.getCurrencyRates();
    assert.equal(result.value.value, null);
    assert.equal(result.value.warnings.length, 1);
    assert.equal(result.value.warnings[0].code, 'PREFERENCE_CURRENCY_RATES_CORRUPT');
    assert.equal(storage.getItem(CURRENCY_RATES_KEY), '{ nao e json', 'nunca regrava silenciosamente');
  });

  test('reset remove a chave (volta ao default)', () => {
    const storage = createMemoryStorage();
    const repo = LocalStoragePreferencesRepository({ storage });
    repo.setCurrencyRates({ pp: 10, pe: 50, po: 100, pl: 1000 });
    repo.resetCurrencyRates();
    assert.equal(storage.getItem(CURRENCY_RATES_KEY), null);
    assert.equal(repo.getCurrencyRates().value.value, null);
  });

  test('falha de quota em setCurrencyRates é classificada e propagada', () => {
    const storage = createMemoryStorage();
    storage.setQuotaExceeded(true);
    const repo = LocalStoragePreferencesRepository({ storage });
    const result = repo.setCurrencyRates({ pp: 10, pe: 50, po: 100, pl: 1000 });
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'LOCAL_STORAGE_QUOTA_EXCEEDED');
  });
});

describe('local-storage-preferences-repository — compra equipada padrão', () => {
  test('default é false; "1"/"0" roundtrip', () => {
    const storage = createMemoryStorage();
    const repo = LocalStoragePreferencesRepository({ storage });
    assert.equal(repo.getPurchaseEquippedDefault().value.value, false);

    repo.setPurchaseEquippedDefault(true);
    assert.equal(storage.getItem(PURCHASE_EQUIPPED_DEFAULT_KEY), '1');
    assert.equal(repo.getPurchaseEquippedDefault().value.value, true);

    repo.setPurchaseEquippedDefault(false);
    assert.equal(storage.getItem(PURCHASE_EQUIPPED_DEFAULT_KEY), '0');
    assert.equal(repo.getPurchaseEquippedDefault().value.value, false);
  });

  test('valor corrompido (nem "1" nem "0") gera warning e cai para false', () => {
    const storage = createMemoryStorage({ [PURCHASE_EQUIPPED_DEFAULT_KEY]: 'sim' });
    const repo = LocalStoragePreferencesRepository({ storage });
    const result = repo.getPurchaseEquippedDefault();
    assert.equal(result.value.value, false);
    assert.equal(result.value.warnings[0].code, 'PREFERENCE_PURCHASE_EQUIPPED_CORRUPT');
  });
});

describe('local-storage-preferences-repository — colapso de ficha (isolado por personagem)', () => {
  test('default exato documentado', () => {
    const repo = LocalStoragePreferencesRepository({ storage: createMemoryStorage() });
    const result = repo.getSheetCollapse('char-1');
    assert.deepEqual(result.value.value, { equipados: false, mochila: false, esgotados: false, detalhes: false, truques: true });
  });

  test('isolamento por personagem: personagens diferentes não compartilham estado', () => {
    const storage = createMemoryStorage();
    const repo = LocalStoragePreferencesRepository({ storage });
    repo.setSheetCollapse('char-a', { equipados: true, mochila: true, esgotados: true, detalhes: true, truques: false });

    const a = repo.getSheetCollapse('char-a');
    const b = repo.getSheetCollapse('char-b');
    assert.equal(a.value.value.equipados, true);
    assert.equal(b.value.value.equipados, false, 'char-b não deveria herdar o estado de char-a');
  });

  test('JSON corrompido gera warning e cai para o default', () => {
    const storage = createMemoryStorage({ [sheetCollapseKey('char-x')]: 'nao e json' });
    const repo = LocalStoragePreferencesRepository({ storage });
    const result = repo.getSheetCollapse('char-x');
    assert.deepEqual(result.value.value, { equipados: false, mochila: false, esgotados: false, detalhes: false, truques: true });
    assert.equal(result.value.warnings[0].code, 'PREFERENCE_SHEET_COLLAPSE_CORRUPT');
  });
});

describe('local-storage-preferences-repository — level-up flow v2', () => {
  test('default é true quando ausente', () => {
    const repo = LocalStoragePreferencesRepository({ storage: createMemoryStorage() });
    assert.equal(repo.getLevelUpFlowV2().value.value, true);
  });

  test('escrita canônica é sempre "true"/"false"; leitura aceita 1|true|on|sim e 0|false|off|nao|não sem distinguir caixa', () => {
    const storage = createMemoryStorage();
    const repo = LocalStoragePreferencesRepository({ storage });
    repo.setLevelUpFlowV2(false);
    assert.equal(storage.getItem(LEVELUP_FLOW_V2_KEY), 'false');

    for (const truthy of ['1', 'TRUE', 'On', ' sim ']) {
      storage.corrupt(LEVELUP_FLOW_V2_KEY, truthy);
      assert.equal(repo.getLevelUpFlowV2().value.value, true, `"${truthy}" deveria ser true`);
    }
    for (const falsy of ['0', 'FALSE', 'Off', 'NAO', 'não']) {
      storage.corrupt(LEVELUP_FLOW_V2_KEY, falsy);
      assert.equal(repo.getLevelUpFlowV2().value.value, false, `"${falsy}" deveria ser false`);
    }
  });

  test('valor realmente inválido gera warning e usa default (true), nunca regrava', () => {
    const storage = createMemoryStorage({ [LEVELUP_FLOW_V2_KEY]: 'talvez' });
    const repo = LocalStoragePreferencesRepository({ storage });
    const result = repo.getLevelUpFlowV2();
    assert.equal(result.value.value, true);
    assert.equal(result.value.warnings[0].code, 'PREFERENCE_LEVELUP_FLOW_V2_CORRUPT');
    assert.equal(storage.getItem(LEVELUP_FLOW_V2_KEY), 'talvez');
  });
});

describe('resolveLevelUpFlowV2 — precedência global > storage > default', () => {
  test('flag global válida vence, mesmo com storage divergente', () => {
    const storage = createMemoryStorage();
    const preferences = LocalStoragePreferencesRepository({ storage });
    preferences.setLevelUpFlowV2(false);
    const result = resolveLevelUpFlowV2({ globalFeatureFlags: { LEVELUP_FLOW_V2: 'sim' }, preferences });
    assert.equal(result.value.value, true);
  });

  test('flag global ausente/inválida cai para storage', () => {
    const storage = createMemoryStorage();
    const preferences = LocalStoragePreferencesRepository({ storage });
    preferences.setLevelUpFlowV2(false);

    const semGlobal = resolveLevelUpFlowV2({ preferences });
    assert.equal(semGlobal.value.value, false);

    const globalInvalida = resolveLevelUpFlowV2({ globalFeatureFlags: { LEVELUP_FLOW_V2: 'talvez' }, preferences });
    assert.equal(globalInvalida.value.value, false);
    assert.equal(globalInvalida.value.warnings.length, 1, 'valor global inválido deveria gerar um warning, nunca cair silenciosamente para o storage');
    assert.equal(globalInvalida.value.warnings[0].code, 'PREFERENCE_LEVELUP_FLOW_V2_GLOBAL_FLAG_CORRUPT');
  });

  test('só quando storage também está ausente/inválido é que o default (true) é usado', () => {
    const preferences = LocalStoragePreferencesRepository({ storage: createMemoryStorage() });
    const result = resolveLevelUpFlowV2({ preferences });
    assert.equal(result.value.value, true);
  });
});
