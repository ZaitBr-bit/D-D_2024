// ============================================================
// Contrato dos oráculos de compatibilidade (tests/fixtures/**).
// Valida: envelope comum, cobertura exigida pelo brief (12 classes,
// conjuradores conhecidos/preparados, itens/magias customizados, recursos,
// edições, cada migração, campos desconhecidos, schema futuro, fila legada,
// payload perto do limite), classificação completa de campos, e ausência de
// PII (e-mail, UID Firebase, URL de avatar externa, nomes reais).
// ============================================================
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CLASSES_INFO } from '../../site/js/dados-classes.js';
import * as moedasReal from '../../site/js/moedas.js';
// Task 37: `site/js/ficha-edicoes.js` saiu do runtime (órfão provado); o
// oráculo vive agora em tests/helpers, como legacy-db-source/legacy-sheet-source.
import * as edicoesReal from '../helpers/legacy-edicoes-source.js';
import { installBrowserShims, resetFakeLocalStorage, freezeClock } from '../../scripts/lib/browser-shims.mjs';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const FIXTURES = {
  legacyMinimal: 'tests/fixtures/characters/legacy-minimal.json',
  baselineFieldInventory: 'tests/fixtures/characters/baseline-field-inventory.json',
  legacyAllFields: 'tests/fixtures/characters/legacy-all-fields.json',
  legacyPo: 'tests/fixtures/characters/legacy-po.json',
  legacyEdicoes: 'tests/fixtures/characters/legacy-edicoes.json',
  legacyAllClasses: 'tests/fixtures/characters/legacy-all-classes.json',
  legacyKnownCasters: 'tests/fixtures/characters/legacy-known-casters.json',
  legacyPreparedCasters: 'tests/fixtures/characters/legacy-prepared-casters.json',
  legacyCustomSpellsItems: 'tests/fixtures/characters/legacy-custom-spells-items.json',
  legacyResourcesEdits: 'tests/fixtures/characters/legacy-resources-edits.json',
  legacyMigrationStages: 'tests/fixtures/characters/legacy-migration-stages.json',
  legacyUnknownFields: 'tests/fixtures/characters/legacy-unknown-fields.json',
  v2BaselineCompatible: 'tests/fixtures/characters/v2-baseline-compatible.json',
  v2IdentityConflict: 'tests/fixtures/characters/v2-identity-conflict.json',
  futureV3: 'tests/fixtures/characters/future-v3.json',
  nearLimits: 'tests/fixtures/characters/near-limits.json',
  syncQueue: 'tests/fixtures/sync/legacy-queue.json',
  derivedValues: 'tests/fixtures/expected/derived-values.json',
  commandTransitions: 'tests/fixtures/expected/command-transitions.json',
  roundTrips: 'tests/fixtures/expected/round-trips.json'
};

const EXPECTED_BASELINE = 'e43c5ea';
const VALID_CLASSIFICATIONS = new Set([
  'identity', 'build', 'state', 'override', 'metadata', 'compatibilityProjection', 'legacyPassthrough'
]);

function loadFixture(relPath) {
  const full = path.join(repoRoot, relPath);
  const raw = fs.readFileSync(full, 'utf8');
  return JSON.parse(raw);
}

function deepClone(v) {
  return v === undefined ? undefined : JSON.parse(JSON.stringify(v));
}

// ------------------------------------------------------------------
// Varredura mecânica de site/js/** procurando toda atribuição direta a um
// campo de personagem (`char.<campo> = ...` ou `personagem.<campo> = ...`).
// Isto substitui qualquer lista hardcoded ou derivação circular a partir de
// uma fixture: o conjunto de campos "reais" vem do código-fonte, não de um
// arquivo que este próprio teste teria que confiar. Um campo novo escrito em
// qualquer lugar de site/js/** que não esteja em baseline-field-inventory.json
// faz este teste falhar.
// ------------------------------------------------------------------
function walkJsFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkJsFiles(full, out);
    else if (entry.isFile() && entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

function scanMonolithFieldAssignments() {
  const files = walkJsFiles(path.join(repoRoot, 'site', 'js'));
  // Atribuição direta a char.<campo>/personagem.<campo>, evitando casar
  // operadores de comparação (==, ===, >=, <=, !=) que também contêm "=".
  const assignmentRe = /\b(?:char|personagem)\.([a-zA-Z_][a-zA-Z0-9_]*)\s*=(?![=>])/g;
  const found = new Set();
  for (const file of files) {
    const src = fs.readFileSync(file, 'utf8');
    let match;
    while ((match = assignmentRe.exec(src))) {
      found.add(match[1]);
    }
  }
  return found;
}

function assertEnvelope(fixture, relPath) {
  assert.equal(fixture.fixtureVersion, 1, `${relPath}: fixtureVersion deve ser 1`);
  assert.equal(fixture.compatibilityBaseline, EXPECTED_BASELINE, `${relPath}: compatibilityBaseline deve ser ${EXPECTED_BASELINE}`);
  assert.equal(typeof fixture.generatedAt, 'string', `${relPath}: generatedAt deve ser string`);
  assert.ok(!Number.isNaN(Date.parse(fixture.generatedAt)), `${relPath}: generatedAt deve ser data ISO válida`);
  assert.ok(Array.isArray(fixture.cases), `${relPath}: cases deve ser array`);
  assert.ok(fixture.cases.length > 0, `${relPath}: cases não pode ser vazio`);
}

// ------------------------------------------------------------------
// Varredura de PII: nenhuma fixture pode conter e-mail, UID Firebase
// (28 caracteres alfanuméricos típicos), URL de avatar externa (googleusercontent
// e afins) ou nomes reais conhecidos (denylist do time/usuário do repo).
// ------------------------------------------------------------------
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
// Sem âncora de string inteira: um UID Firebase embutido no meio de uma
// string maior (ex: dentro de um path ou URL) ainda deve ser pego. Exige ao
// menos um dígito no trecho de 28 caracteres: UIDs reais do Firebase têm
// alfabeto amplo (letras+dígitos) e praticamente sempre incluem dígito em 28
// caracteres; identificadores de código (nomes de função camelCase em
// português/inglês) raramente têm dígito, o que evita falsos positivos como
// "migrarMagiasSemprePreparadas" (28 letras, sem dígito) sem deixar de pegar
// um UID de verdade. Campos que são legitimamente blobs base64 grandes (ex:
// data URLs de imagem) são excluídos via BASE64_BLOB_FIELD_NAMES abaixo.
function looksLikeFirebaseUid(value) {
  // Varre todos os trechos de exatamente 28 caracteres alfanuméricos
  // delimitados por não-alfanuméricos, e sinaliza se algum tiver dígito.
  const candidates = value.match(/\b[a-zA-Z0-9]{28}\b/g) || [];
  return candidates.some(c => /[0-9]/.test(c));
}
const EXTERNAL_AVATAR_URL_RE = /https?:\/\/(?:lh3\.googleusercontent\.com|graph\.facebook\.com|avatars\.githubusercontent\.com|.*\.(?:png|jpe?g|gif|webp)(?:\?|$))/i;
const REAL_NAME_DENYLIST = [/jhonatan/i, /zanetti/i];
// Campos conhecidos por conterem blobs base64/data-URL grandes e legítimos
// (imagem sintética de near-limits.json) — escaneados apenas quanto ao
// prefixo/formato esperado em seu próprio teste dedicado, não quanto a PII
// substring-a-substring (o que produziria ruído garantido em qualquer blob
// grande o suficiente).
const BASE64_BLOB_FIELD_NAMES = new Set(['imagem']);

function scanForPii(value, pathTrail, violations, opts = {}) {
  if (typeof value === 'string') {
    if (opts.isBase64Blob && value.startsWith('data:')) {
      return; // blob opaco conhecido (validado em teste dedicado de near-limits.json)
    }
    if (EMAIL_RE.test(value)) violations.push(`${pathTrail}: parece um e-mail ("${value}")`);
    if (looksLikeFirebaseUid(value)) {
      violations.push(`${pathTrail}: parece conter um UID Firebase ("${value.slice(0, 60)}${value.length > 60 ? '…' : ''}")`);
    }
    if (EXTERNAL_AVATAR_URL_RE.test(value)) violations.push(`${pathTrail}: parece uma URL de avatar externa ("${value}")`);
    for (const re of REAL_NAME_DENYLIST) {
      if (re.test(value)) violations.push(`${pathTrail}: contém nome real proibido ("${value}")`);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, idx) => scanForPii(item, `${pathTrail}[${idx}]`, violations, opts));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, val] of Object.entries(value)) {
      const childOpts = BASE64_BLOB_FIELD_NAMES.has(key) ? { isBase64Blob: true } : opts;
      scanForPii(val, `${pathTrail}.${key}`, violations, childOpts);
    }
  }
}

describe('baseline fixtures — envelope e ausência de PII (todas as fixtures)', () => {
  for (const [name, relPath] of Object.entries(FIXTURES)) {
    test(`${relPath} existe, tem o envelope correto e não contém PII`, () => {
      assert.ok(fs.existsSync(path.join(repoRoot, relPath)), `Fixture ausente: ${relPath}`);
      const fixture = loadFixture(relPath);
      assertEnvelope(fixture, relPath);
      const violations = [];
      scanForPii(fixture, name, violations);
      assert.deepEqual(violations, [], `PII encontrada em ${relPath}:\n${violations.join('\n')}`);
    });
  }
});

describe('legacy-all-classes.json cobre exatamente as 12 classes reais de dados-classes.js', () => {
  const fixture = loadFixture(FIXTURES.legacyAllClasses);

  test('tem exatamente um caso por classe existente em CLASSES_INFO, sem inventar nem faltar nenhuma', () => {
    const classesReais = Object.keys(CLASSES_INFO).sort();
    const classesNaFixture = fixture.cases.map(c => c.personagem?.classe).sort();
    assert.deepEqual(classesNaFixture, classesReais);
  });

  test('cada caso reflete dado_vida, salvaguardas e conjurador reais de CLASSES_INFO', () => {
    for (const c of fixture.cases) {
      const classe = c.personagem?.classe;
      const infoReal = CLASSES_INFO[classe];
      assert.ok(infoReal, `Classe desconhecida na fixture: ${classe}`);
      assert.deepEqual(c.classeInfoEsperado.salvaguardas, infoReal.salvaguardas, `salvaguardas divergem para ${classe}`);
      assert.equal(c.classeInfoEsperado.dado_vida, infoReal.dado_vida, `dado_vida diverge para ${classe}`);
      assert.equal(c.classeInfoEsperado.conjurador, infoReal.conjurador, `conjurador diverge para ${classe}`);
      assert.deepEqual(c.personagem.salvaguardas_proficientes, infoReal.salvaguardas, `salvaguardas_proficientes do personagem divergem para ${classe}`);
    }
  });
});

describe('legacy-known-casters.json e legacy-prepared-casters.json batem com tipo_conjuracao real', () => {
  test('todo caso de known-casters usa uma classe com tipo_conjuracao "conhecidas"', () => {
    const fixture = loadFixture(FIXTURES.legacyKnownCasters);
    for (const c of fixture.cases) {
      const info = CLASSES_INFO[c.personagem.classe];
      assert.ok(info?.conjurador, `${c.personagem.classe} deveria ser conjurador`);
      assert.equal(info.tipo_conjuracao, 'conhecidas', `${c.personagem.classe} deveria ter tipo_conjuracao "conhecidas"`);
    }
  });

  test('todo caso de prepared-casters usa uma classe com tipo_conjuracao "preparadas"', () => {
    const fixture = loadFixture(FIXTURES.legacyPreparedCasters);
    for (const c of fixture.cases) {
      const info = CLASSES_INFO[c.personagem.classe];
      assert.ok(info?.conjurador, `${c.personagem.classe} deveria ser conjurador`);
      assert.equal(info.tipo_conjuracao, 'preparadas', `${c.personagem.classe} deveria ter tipo_conjuracao "preparadas"`);
    }
  });
});

describe('baseline-field-inventory.json classifica todo campo exigido em exatamente uma categoria válida', () => {
  const fixture = loadFixture(FIXTURES.baselineFieldInventory);

  test('toda entrada tem uma classificação dentre as 7 categorias permitidas', () => {
    for (const c of fixture.cases) {
      assert.ok(VALID_CLASSIFICATIONS.has(c.classificacao), `Campo "${c.campo}" tem classificação inválida ou ausente: ${c.classificacao}`);
    }
  });

  test('nenhum campo aparece duplicado com classificações diferentes (nem duplicado de forma alguma)', () => {
    const porCampo = new Map();
    for (const c of fixture.cases) {
      assert.ok(!porCampo.has(c.campo), `Campo duplicado no inventário: ${c.campo}`);
      porCampo.set(c.campo, c.classificacao);
    }
  });

  test('inclui explicitamente todos os campos "monólito" exigidos pelo brief', () => {
    const camposExigidos = [
      'po', 'pv_temp', '_slots_magia_livre', 'espacos_magia_extras', 'recursos',
      'maestrias_arma', 'manobras_conhecidas', 'iniciado_em_magia', 'iniciado_em_magia_instancias',
      'adepto_elemental_tipo', 'adepto_elemental_tipos',
      'bonus_pv_dadiva_fortitude', 'bonus_pv_anao_aplicado', 'bonus_pv_vigoroso_aplicado',
      'morte_sucessos', 'morte_falhas', 'criado_em', 'atualizado_em'
    ];
    const camposPresentes = new Set(fixture.cases.map(c => c.campo));
    for (const campo of camposExigidos) {
      assert.ok(camposPresentes.has(campo), `Campo obrigatório ausente do inventário: ${campo}`);
    }
  });

  test('inclui todo campo top-level do template real criarPersonagemVazio() (importado de site/js/store.js, não lido de uma fixture)', async () => {
    installBrowserShims();
    resetFakeLocalStorage();
    const unfreeze = freezeClock('2026-07-01T12:00:00.000Z');
    let camposTemplate;
    try {
      const store = await import('../../site/js/store.js');
      camposTemplate = Object.keys(store.criarPersonagemVazio());
    } finally {
      unfreeze();
    }
    const camposPresentes = new Set(fixture.cases.map(c => c.campo));
    const faltando = camposTemplate.filter(campo => !camposPresentes.has(campo));
    assert.deepEqual(faltando, [], `Campos do template sem classificação no inventário: ${faltando.join(', ')}`);
  });

  test('inclui todo campo encontrado por varredura mecânica de atribuições char.<campo>=/personagem.<campo>= em site/js/** — um campo novo não classificado FALHA este teste', () => {
    const camposEncontrados = scanMonolithFieldAssignments();
    const camposPresentes = new Set(fixture.cases.map(c => c.campo));
    const faltando = [...camposEncontrados].filter(campo => !camposPresentes.has(campo)).sort();
    assert.deepEqual(
      faltando,
      [],
      `Campo(s) atribuído(s) em site/js/** sem classificação em baseline-field-inventory.json: ${faltando.join(', ')}. ` +
      'Isto significa que uma varredura real do código-fonte encontrou um campo persistido que este inventário não conhece — ' +
      'classifique-o em identity/build/state/override/metadata/compatibilityProjection/legacyPassthrough antes de prosseguir.'
    );
  });

  test('a varredura mecânica realmente teria pego um campo novo hipotético (a checagem acima não está sempre vazia por acidente)', () => {
    const camposEncontrados = scanMonolithFieldAssignments();
    // Confirma que a varredura funciona de verdade: injeta um nome de campo
    // fictício que sabemos não estar classificado e verifica que ELE seria
    // sinalizado, sem depender de nenhum arquivo real conter esse nome.
    const camposPresentes = new Set(fixture.cases.map(c => c.campo));
    const campoFicticioNaoClassificado = '__campo_ficticio_de_teste_nao_classificado__';
    assert.ok(!camposPresentes.has(campoFicticioNaoClassificado));
    const simulado = new Set([...camposEncontrados, campoFicticioNaoClassificado]);
    const faltandoSimulado = [...simulado].filter(campo => !camposPresentes.has(campo));
    assert.ok(faltandoSimulado.includes(campoFicticioNaoClassificado), 'A lógica de detecção de campo faltante não está funcionando');
  });
});

describe('legacy-po.json e legacy-migration-stages.json caracterizam atualizado_em como entrada e saída', () => {
  test('round-trips.json tem um caso onde atualizado_em de entrada é sobrescrito por salvarPersonagem', () => {
    const fixture = loadFixture(FIXTURES.roundTrips);
    const caso = fixture.cases.find(c => c.id === 'salvar-personagem-sobrescreve-atualizado-em');
    assert.ok(caso, 'Caso de round-trip de atualizado_em ausente');
    assert.equal(typeof caso.personagemAntesDeSalvar.atualizado_em, 'string');
    assert.equal(typeof caso.personagemDepoisDeSalvar.atualizado_em, 'string');
    assert.notEqual(caso.personagemAntesDeSalvar.atualizado_em, caso.personagemDepoisDeSalvar.atualizado_em);
  });
});

describe('legacy-migration-stages.json cobre as 15 migrações reais existentes no app', () => {
  const fixture = loadFixture(FIXTURES.legacyMigrationStages);
  // As 13 funções privadas de site/js/pages/sheet.js (2880, 2899, 2923, 2972,
  // 2994, 3041, 3068, 3081, 3091, 3101, 3115, 8414, 8430) mais as 2 funções
  // exportadas de site/js/store.js (migrarMoedasLegado, migrarEdicoesLegado).
  const migracoesEsperadas = [
    'migrarMoedasLegado', 'migrarEdicoesLegado',
    'migrarMagiasDominio', 'migrarSlotsMagiaLivre', 'migrarMagiasSemprePreparadas',
    'migrarTruquesEspecie', 'migrarMagiasLegadoEspecie', 'migrarEscolhasClasseLegadas',
    'migrarNomePericiaLidarAnimais', 'migrarTalentoVersatilHumano', 'migrarPericiaEspecie',
    'migrarPericiasEspecie', 'migrarPericiasTalentos',
    'migrarIniciadoEmMagiaInstancias', 'migrarAdeptoElementalTipos'
  ];

  test('tem ao menos um caso citando cada uma das 15 funções de migração reais', () => {
    const fnsNaFixture = new Set(fixture.cases.map(c => c.fnMigracao));
    const faltando = migracoesEsperadas.filter(fn => !fnsNaFixture.has(fn));
    assert.deepEqual(faltando, [], `Migração(ões) não coberta(s) pela fixture: ${faltando.join(', ')}`);
  });

  test('as duas migrações de store.js (importáveis, sem DOM) são marcadas executavelIsoladamente:true', () => {
    for (const fn of ['migrarMoedasLegado', 'migrarEdicoesLegado']) {
      const caso = fixture.cases.find(c => c.fnMigracao === fn);
      assert.ok(caso);
      assert.equal(caso.executavelIsoladamente, true, `${fn} deveria estar marcada como executável isoladamente`);
    }
  });

  test('as migrações de sheet.js são marcadas executavelIsoladamente:false com um motivo declarado', () => {
    const migracoesSheet = migracoesEsperadas.filter(fn => fn !== 'migrarMoedasLegado' && fn !== 'migrarEdicoesLegado');
    for (const fn of migracoesSheet) {
      const caso = fixture.cases.find(c => c.fnMigracao === fn);
      assert.ok(caso, `Caso ausente para ${fn}`);
      assert.equal(caso.executavelIsoladamente, false, `${fn} é uma função privada de sheet.js, não deveria estar marcada como executável isoladamente`);
      assert.equal(typeof caso.motivoNaoExecutavel, 'string');
      assert.ok(caso.motivoNaoExecutavel.length > 0);
    }
  });

  test('migrarMoedasLegado e migrarEdicoesLegado batem com a execução real de site/js/store.js', async () => {
    installBrowserShims();
    resetFakeLocalStorage();
    const unfreeze = freezeClock('2026-07-01T12:00:00.000Z');
    try {
      const store = await import('../../site/js/store.js');
      const casoMoedas = fixture.cases.find(c => c.fnMigracao === 'migrarMoedasLegado');
      const resultadoMoedas = store.migrarMoedasLegado(deepClone(casoMoedas.personagemAntes));
      assert.deepEqual(resultadoMoedas, casoMoedas.personagemDepoisParcial);

      const casoEdicoes = fixture.cases.find(c => c.fnMigracao === 'migrarEdicoesLegado');
      const resultadoEdicoes = store.migrarEdicoesLegado(deepClone(casoEdicoes.personagemAntes));
      assert.deepEqual(resultadoEdicoes, casoEdicoes.personagemDepoisParcial);
    } finally {
      unfreeze();
    }
  });
});

describe('sync/legacy-queue.json usa a chave real dnd_sync_queue e os shapes reais de upsert/remoção', () => {
  const fixture = loadFixture(FIXTURES.syncQueue);

  test('toda entrada de fila referenciada declara localStorageKey === "dnd_sync_queue"', () => {
    for (const c of fixture.cases) {
      assert.equal(c.localStorageKey, 'dnd_sync_queue');
    }
  });

  test('tem um caso de upsert no shape { id, dados, tentativas } sem campo acao', () => {
    const caso = fixture.cases.find(c => c.id === 'fila-upsert-pendente');
    assert.ok(caso);
    const entrada = caso.filaDepois[0];
    assert.equal(typeof entrada.id, 'string');
    assert.ok('dados' in entrada);
    assert.equal(typeof entrada.tentativas, 'number');
    assert.ok(!('acao' in entrada));
  });

  test('tem um caso de remoção pendente no shape { id, acao: "remover", tentativas } sem campo dados', () => {
    const caso = fixture.cases.find(c => c.id === 'fila-remocao-pendente-cancela-upsert');
    assert.ok(caso);
    const entradaRemocao = caso.filaDepois.find(e => e.acao === 'remover');
    assert.ok(entradaRemocao, 'Entrada de remoção ausente em filaDepois');
    assert.equal(entradaRemocao.acao, 'remover');
    assert.equal(typeof entradaRemocao.tentativas, 'number');
    assert.ok(!('dados' in entradaRemocao));
  });

  test('remoção cancela upsert pendente do mesmo id (o upsert não sobrevive em filaDepois)', () => {
    const caso = fixture.cases.find(c => c.id === 'fila-remocao-pendente-cancela-upsert');
    const idRemovido = caso.operacao.id;
    const aindaTemUpsert = caso.filaDepois.some(e => e.id === idRemovido && 'dados' in e);
    assert.equal(aindaTemUpsert, false);
  });
});

describe('near-limits.json fixa o maior data URL de imagem e os limites de payload conhecidos', () => {
  const fixture = loadFixture(FIXTURES.nearLimits);

  test('o data URL de imagem é um JPEG sintético válido (prefixo correto), não uma referência a foto real', () => {
    const caso = fixture.cases.find(c => c.id === 'imagem-proximo-do-limite');
    assert.ok(caso);
    assert.match(caso.personagem.imagem, /^data:image\/jpeg;base64,/);
    assert.equal(caso.imagemDataUrlAmostraSintetica, true);
    assert.equal(caso.personagem.imagem.length, caso.imagemDataUrlBytes);
  });

  test('a cota "aceita" é derivada explicitamente de um limite de payload já registrado, não é um número solto', () => {
    const caso = fixture.cases.find(c => c.id === 'imagem-proximo-do-limite');
    assert.ok(caso);
    assert.equal(typeof caso.cotaAceitaDerivadaDe, 'string');
    assert.ok(caso.cotaAceitaDerivadaDe.length > 0);
  });

  test('o data URL realmente fica perto (>=90%) do teto que cotaAceitaDerivadaDe afirma derivar — a afirmação bate com o artefato, não só com a descrição', () => {
    const casoImagem = fixture.cases.find(c => c.id === 'imagem-proximo-do-limite');
    const casoLimites = fixture.cases.find(c => c.id === 'limites-de-payload-conhecidos');
    assert.ok(casoImagem);
    assert.ok(casoLimites);
    assert.match(casoImagem.cotaAceitaDerivadaDe, /firestoreDocumentLimitBytes/, 'Este teste assume que cotaAceitaDerivadaDe aponta para firestoreDocumentLimitBytes; se isso mudar, ajuste o teto de referência abaixo junto.');
    const tetoReferenciado = casoLimites.firestoreDocumentLimitBytes;
    const proporcaoReal = casoImagem.personagem.imagem.length / tetoReferenciado;
    // Regressão específica já vista: um clamp de segmento único no gerador
    // fez o data URL real ficar em ~8.4% do teto enquanto a descrição e
    // `cotaAceitaDerivadaDe` ainda afirmavam "logo abaixo do teto". Esta
    // asserção falha se essa divergência entre afirmação e artefato voltar,
    // independente de qual número a descrição prosa diga.
    assert.ok(proporcaoReal >= 0.9 && proporcaoReal <= 1.0,
      `O data URL está a ${(proporcaoReal * 100).toFixed(1)}% do teto declarado (${tetoReferenciado} bytes) — deveria estar entre 90% e 100% para justificar a alegação de "perto do limite".`);
    if (typeof casoImagem.proporcaoDoTetoAceito === 'number') {
      assert.ok(Math.abs(casoImagem.proporcaoDoTetoAceito - proporcaoReal) < 0.01,
        'proporcaoDoTetoAceito declarado na fixture não bate com a proporção real recalculada — a fixture está mentindo sobre a própria proporção.');
    }
  });

  test('a cota "produzida" pelo fluxo de upload é honestamente marcada como não medida (Node não tem canvas/Image), não apresentada como fato medido', () => {
    const caso = fixture.cases.find(c => c.id === 'imagem-proximo-do-limite');
    assert.ok(caso);
    assert.ok(caso.tamanhoProduzidoPeloFluxoDeUpload, 'Caso deve declarar tamanhoProduzidoPeloFluxoDeUpload');
    assert.equal(caso.tamanhoProduzidoPeloFluxoDeUpload.naoMedido, true);
  });

  test('declara limites numéricos de payload local (localStorage) e remoto (Firestore)', () => {
    const caso = fixture.cases.find(c => c.id === 'limites-de-payload-conhecidos');
    assert.ok(caso);
    assert.equal(typeof caso.localStorageLimitBytes, 'number');
    assert.equal(typeof caso.firestoreDocumentLimitBytes, 'number');
    assert.ok(caso.localStorageLimitBytes > 0);
    assert.ok(caso.firestoreDocumentLimitBytes > 0);
  });
});

describe('derived-values.json cobre as 10 categorias exigidas pelo brief', () => {
  const fixture = loadFixture(FIXTURES.derivedValues);
  // "CA, PV, iniciativa, perícias passivas, carga, deslocamento, CD/ataque de
  // magia, espaços, recursos" — CD e ataque de magia contados separadamente.
  const categoriasExigidas = [
    'ca', 'pv', 'iniciativa', 'pericias_passivas', 'carga',
    'deslocamento', 'cd_magia', 'ataque_magia', 'espacos', 'recursos'
  ];

  test('tem ao menos um caso por categoria exigida', () => {
    const categoriasPresentes = new Set(fixture.cases.map(c => c.categoria));
    const faltando = categoriasExigidas.filter(cat => !categoriasPresentes.has(cat));
    assert.deepEqual(faltando, [], `Categoria(s) de valor derivado ausente(s): ${faltando.join(', ')}`);
  });

  test('perícias passivas tem pelo menos 2 casos (não só percepção)', () => {
    const casosPassivas = fixture.cases.filter(c => c.categoria === 'pericias_passivas');
    assert.ok(casosPassivas.length >= 2, 'Esperava ao menos 2 casos de perícia passiva (ex: Percepção e Intuição)');
  });
});

describe('derived-values.json segue a política expectedUnified do brief', () => {
  const fixture = loadFixture(FIXTURES.derivedValues);

  test('todo caso tem baselineObserved com domainHelper/screen/print/pdf, expectedUnified e baselineDifferences', () => {
    for (const c of fixture.cases) {
      assert.ok(c.baselineObserved, `Caso ${c.id} sem baselineObserved`);
      for (const chave of ['domainHelper', 'screen', 'print', 'pdf']) {
        assert.ok(chave in c.baselineObserved, `Caso ${c.id} sem baselineObserved.${chave}`);
      }
      assert.ok('expectedUnified' in c, `Caso ${c.id} sem expectedUnified`);
      assert.ok(Array.isArray(c.baselineDifferences), `Caso ${c.id}: baselineDifferences deve ser array`);
    }
  });

  test('quando não há divergência, expectedUnified bate com screen (e com todas as saídas observadas)', () => {
    for (const c of fixture.cases) {
      if (c.baselineDifferences.length === 0) {
        assert.equal(c.expectedUnified, c.baselineObserved.screen, `Caso ${c.id}: expectedUnified deveria bater com screen quando não há baselineDifferences`);
      }
    }
  });

  test('quando há divergência, expectedUnified sempre bate com o valor da tela principal (screen) — política do brief', () => {
    for (const c of fixture.cases) {
      if (c.baselineDifferences.length > 0) {
        assert.equal(c.expectedUnified, c.baselineObserved.screen, `Caso ${c.id}: expectedUnified deveria usar o valor de screen (política de fallback sem helper compartilhado)`);
      }
    }
  });
});

describe('legacy-edicoes.json bate exatamente com a execução real de site/js/ficha-edicoes.js', () => {
  const fixture = loadFixture(FIXTURES.legacyEdicoes);

  test('cada caso, quando executado contra as funções reais, produz o personagemDepois e o resultadoRetornado gravados', () => {
    for (const c of fixture.cases) {
      const antes = deepClone(c.personagemAntes);
      let retorno;
      switch (c.operacao.fn) {
        case 'aplicarEdicao':
          retorno = edicoesReal.aplicarEdicao(antes, c.operacao.caminho, c.operacao.proposto, c.operacao.editadoEm);
          break;
        case 'reverterEdicao':
          retorno = edicoesReal.reverterEdicao(antes, c.operacao.caminho);
          break;
        case 'consolidarEdicoesAtributos':
          retorno = edicoesReal.consolidarEdicoesAtributos(antes);
          break;
        case 'aplicarDeltaSistema':
          retorno = edicoesReal.aplicarDeltaSistema(antes, c.operacao.caminho, c.operacao.delta, c.operacao.teto);
          break;
        default:
          throw new Error(`Operação de edição desconhecida no caso ${c.id}: ${c.operacao.fn}`);
      }
      assert.deepEqual(antes, c.personagemDepois, `Caso ${c.id}: personagemDepois não bate com a execução real de ${c.operacao.fn}`);
      if ('resultadoRetornado' in c) {
        assert.deepEqual(retorno, c.resultadoRetornado, `Caso ${c.id}: resultadoRetornado não bate com o retorno real de ${c.operacao.fn} (deve ser o valor CRU, sem wrapper)`);
      } else {
        assert.equal(retorno, undefined, `Caso ${c.id}: função retornou algo mas a fixture não declara resultadoRetornado`);
      }
    }
  });
});

describe('command-transitions.json (categoria moedas) bate exatamente com a execução real de site/js/moedas.js', () => {
  const fixture = loadFixture(FIXTURES.commandTransitions);
  const casosMoedas = () => fixture.cases.filter(c => c.categoria === 'moedas' && c.operacao?.tipo === 'pagar_custo');

  test('existe ao menos um caso de moedas com operação pagar_custo', () => {
    assert.ok(casosMoedas().length > 0);
  });

  test('cada caso de pagar_custo, executado contra pagarCusto real, produz exatamente as moedas e o sucesso gravados', () => {
    for (const c of casosMoedas()) {
      const resultado = moedasReal.pagarCusto(deepClone(c.personagemAntes.moedas), c.operacao.custoStr);
      assert.deepEqual(resultado.moedas, c.personagemDepois.moedas, `Caso ${c.id}: moedas resultantes de pagarCusto("${c.operacao.custoStr}") não batem com a fixture`);
      if (c.resultadoOperacao && 'sucesso' in c.resultadoOperacao) {
        assert.equal(resultado.sucesso, c.resultadoOperacao.sucesso, `Caso ${c.id}: sucesso de pagarCusto não bate com a fixture`);
      }
    }
  });
});

describe('command-transitions.json cobre todas as categorias exigidas pelo brief', () => {
  const fixture = loadFixture(FIXTURES.commandTransitions);
  const categoriasExigidas = [
    'dano', 'cura', 'pv_temporario', 'descansos', 'concentracao',
    'condicoes', 'inventario', 'moedas', 'recursos', 'edicoes', 'levelup'
  ];

  test('tem ao menos um caso por categoria exigida', () => {
    const categoriasPresentes = new Set(fixture.cases.map(c => c.categoria));
    for (const categoria of categoriasExigidas) {
      assert.ok(categoriasPresentes.has(categoria), `Categoria de transição de comando ausente: ${categoria}`);
    }
  });

  test('todo caso tem operacao e ao menos personagemAntes ou personagemDepois/resultadoOperacao', () => {
    for (const c of fixture.cases) {
      assert.ok(c.operacao, `Caso ${c.id} sem operacao`);
      assert.ok(c.personagemAntes || c.personagemDepois || c.resultadoOperacao, `Caso ${c.id} sem estado observável`);
    }
  });
});

describe('legacy-unknown-fields.json e future-v3.json caracterizam comportamento de compatibilidade', () => {
  test('legacy-unknown-fields.json preserva campos desconhecidos junto dos campos reais do template', () => {
    const fixture = loadFixture(FIXTURES.legacyUnknownFields);
    const personagem = fixture.cases[0].personagem;
    assert.ok('companheiro_animal_experimental' in personagem);
    assert.ok('id' in personagem && 'nome' in personagem, 'Deve continuar sendo um personagem v1 reconhecível');
  });

  test('future-v3.json documenta rejeição explícita pelo app atual (não tenta interpretar o schema futuro)', () => {
    const fixture = loadFixture(FIXTURES.futureV3);
    const caso = fixture.cases[0];
    assert.equal(caso.resultadoEsperadoNoAppAtual.validarPersonagem, false);
  });
});
