// Contrato de COBERTURA de handlers oficiais (Task 22a).
//
// Prova, contra o catálogo REAL (`dados/pacotes/dnd2024/**`), que:
//
//   1. todo `handlerId` de ESCOPO DE CLASSE (o prefixo `class-`) declarado por
//      alguma entidade do pacote tem um handler registrado no composition root;
//   2. e o inverso — não existe handler de classe registrado sem entidade que o
//      declare (handler órfão seria código inalcançável: o
//      `OfficialHandlerInvoker` o recusaria em runtime);
//   3. dentro das quatro coleções ARCANAS (bardo, bruxo, feiticeiro, mago),
//      todo `handlerId` declarado ou é um handler registrado, ou pertence a uma
//      das duas ALLOWLISTS nomeadas abaixo — e cada entrada de allowlist é
//      realmente usada, para que ela não sobreviva à tarefa que a resolve.
//
// RED esperado antes da Task 22a: as quatro classes arcanas não declaravam
// `class-bardo`/`class-bruxo`/`class-feiticeiro`/`class-mago`, e nenhum desses
// handlers existia.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// A varredura do catálogo saiu deste arquivo para `tests/helpers/` na Task 30:
// a cobertura de INTERFACE daquela task precisa sair da MESMA fonte de ids que
// esta cobertura de HANDLER, para que as duas não possam divergir (item 3 do
// brief da Task 30). O comportamento é idêntico — só o dono do código mudou.
import {
  collectDeclaredHandlers,
  listFiles,
  stripLineComments,
} from '../helpers/declared-official-handlers.js';

import { ALL_CLASS_HANDLERS } from '../../site/js/domain/rulesets/dnd2024/handlers/register-all.js';
import { createAllClassHandlerRegistrations } from '../../site/js/domain/rulesets/dnd2024/handlers/register-all.js';
import { createAppContext } from '../../site/js/app-context.js';

const repoRoot = new URL('../../', import.meta.url);

// --- Allowlists nomeadas ---------------------------------------------------

// MARCADOR DE DADO, NÃO HANDLER INVOCÁVEL. São efeitos `official-handler` cujo
// `handlerId`/`params` declaram um FATO sobre o nível ou sobre a build (este
// nível concede ASI; este nível concede talento; esta é a tabela de espaços de
// Magia de Pacto), a ser LIDO por quem projeta a progressão — não uma mecânica
// a ser EXECUTADA por um handler registrado no `OfficialHandlerInvoker`.
//
// A Task 22a criou esta lista com três entradas de tabela
// (`pact-magic-slots`/`third-caster-slots`/`combat-maneuvers-known`) e uma
// segunda lista, `TASK_23_BUILD_CHOICE_ALLOWLIST`, na expectativa de que a
// Task 23 registrasse handlers para `asi-or-feat` e companhia e apagasse cada
// linha. **Essa expectativa estava errada**, e a Task 23 escalou o problema
// (Bloqueio 2 do relatório; decisão registrada em `questions-for-review.txt`
// item 7):
//
//   - o próprio brief da Task 23 manda tratar `asi-or-feat` como MARCADOR
//     ESTRUTURADO ("`type: official-handler` com `handlerId: asi-or-feat` -> os
//     níveis de Aumento no Valor de Atributo"), e é assim que ele está
//     implementado: `site/js/domain/progression/progression-queries.js` LÊ o id
//     para derivar a matriz 1-20. Não existe handler invocável a registrar;
//   - e registrá-lo em `ALL_CLASS_HANDLERS` (a fonte de `REGISTERED_IDS`)
//     reprovaria o teste "esperados 12 handlers de classe" da própria suíte.
//
// Por isso as duas listas foram UNIFICADAS aqui: a categoria correta de
// `asi-or-feat`/`grant-feat`/`expertise-from-proficient-skills`/
// `choose-cantrips-from-class-list`/`choose-spell-from-class-list` sempre foi
// esta. Diferentemente da Task 22a, agora existe consumidor de produção para
// pelo menos um deles (`asi-or-feat`), o que reforça que são dado lido, não
// código inalcançável.
//
// A lista continua sendo um registro honesto de dívida: quem transformar um
// destes ids num tipo de efeito próprio (em vez de `official-handler`
// reaproveitado como marcador) remove a linha correspondente daqui.
const DATA_ONLY_HANDLER_ALLOWLIST = Object.freeze([
  'pact-magic-slots',
  'third-caster-slots',
  'combat-maneuvers-known',
  'asi-or-feat',
  'grant-feat',
  'expertise-from-proficient-skills',
  'choose-cantrips-from-class-list',
  'choose-spell-from-class-list',
]);

// As quatro coleções de classe cobertas por esta tarefa.
const ARCANE_CLASS_FILES = Object.freeze([
  'classes/bardo.json',
  'classes/feiticeiro.json',
  'classes/bruxo.json',
  'classes/mago.json',
]);

const DECLARED = collectDeclaredHandlers();
const REGISTERED_IDS = new Set(ALL_CLASS_HANDLERS.map((handler) => handler.id));

describe('cobertura de handlers oficiais — escopo de CLASSE', () => {
  test('a varredura encontrou efeitos `official-handler` no catálogo real', () => {
    assert.ok(DECLARED.length > 0, 'nenhum efeito official-handler encontrado — a varredura está quebrada');
  });

  test('todo `handlerId` `class-*` declarado tem handler registrado', () => {
    const declaredClassIds = new Set(
      DECLARED.filter((entry) => entry.handlerId.startsWith('class-')).map((entry) => entry.handlerId),
    );
    const semHandler = [...declaredClassIds].filter((id) => !REGISTERED_IDS.has(id)).sort();
    assert.deepEqual(semHandler, [], `handlerId de classe declarado sem handler registrado: ${semHandler.join(', ')}`);
  });

  test('nenhum handler de classe registrado é órfão (todo um é declarado)', () => {
    const declaredIds = new Set(DECLARED.map((entry) => entry.handlerId));
    const orfaos = [...REGISTERED_IDS].filter((id) => !declaredIds.has(id)).sort();
    assert.deepEqual(orfaos, [], `handler registrado que nenhuma entidade declara: ${orfaos.join(', ')}`);
  });

  test('cada `handlerId` `class-*` é declarado por EXATAMENTE UMA entidade, a de classe', () => {
    const porId = new Map();
    for (const entry of DECLARED.filter((candidate) => candidate.handlerId.startsWith('class-'))) {
      porId.set(entry.handlerId, [...(porId.get(entry.handlerId) ?? []), entry]);
    }
    for (const handler of ALL_CLASS_HANDLERS) {
      const entradas = porId.get(handler.id) ?? [];
      assert.equal(entradas.length, 1, `${handler.id}: esperado 1 declaração, veio ${entradas.length}`);
      assert.equal(entradas[0].entityId, handler.classId, `${handler.id}: declarado pela entidade errada`);
    }
  });

  test('os quatro handlers arcanos estão entre os registrados', () => {
    for (const id of ['class-bardo', 'class-bruxo', 'class-feiticeiro', 'class-mago']) {
      assert.equal(REGISTERED_IDS.has(id), true, `${id} não está registrado`);
    }
    assert.equal(ALL_CLASS_HANDLERS.length, 12, 'esperados 12 handlers de classe (Tasks 20 + 21 + 22a)');
  });
});

describe('cobertura de handlers oficiais — coleções ARCANAS sem `handlerId` desconhecido', () => {
  const ARCANE_DECLARED = collectDeclaredHandlers(ARCANE_CLASS_FILES);

  test('todo `handlerId` das quatro coleções arcanas é registrado ou está numa allowlist nomeada', () => {
    const desconhecidos = [];
    for (const entry of ARCANE_DECLARED) {
      if (REGISTERED_IDS.has(entry.handlerId)) {
        continue;
      }
      if (DATA_ONLY_HANDLER_ALLOWLIST.includes(entry.handlerId)) {
        continue;
      }
      desconhecidos.push(`${entry.handlerId} (${entry.file} / ${entry.entityId})`);
    }
    assert.deepEqual(
      [...new Set(desconhecidos)].sort(),
      [],
      'handlerId arcano sem handler registrado e fora da allowlist nomeada',
    );
  });

  test('as quatro classes arcanas declaram o próprio handler de classe', () => {
    const porClasse = new Map(ARCANE_DECLARED.map((entry) => [entry.handlerId, entry.entityId]));
    for (const [handlerId, classId] of [
      ['class-bardo', 'dnd2024:class:bardo'],
      ['class-bruxo', 'dnd2024:class:bruxo'],
      ['class-feiticeiro', 'dnd2024:class:feiticeiro'],
      ['class-mago', 'dnd2024:class:mago'],
    ]) {
      assert.equal(porClasse.get(handlerId), classId, `${handlerId} deve ser declarado por ${classId}`);
    }
  });
});

describe('cobertura de handlers oficiais — a allowlist não sobrevive ao seu escopo', () => {
  const declaredIds = new Set(DECLARED.map((entry) => entry.handlerId));

  // Ids SEM NENHUM leitor de produção hoje — mecânica declarada no catálogo que
  // ainda não foi ligada a lugar nenhum. Separado dos marcadores lidos porque a
  // afirmação verificável é diferente: aqui é "NINGUÉM lê", ali é "quem lê, lê
  // como DADO".
  //
  // `pact-magic-slots` SAIU desta lista na Task 23: a matriz de progressão
  // passou a ler a tabela dele (`progression-queries.js#pactMagicSlots`), sem o
  // que o Bruxo ficava com `spellSlots: {}` nos 20 níveis — divergência que o
  // contrato `level-up-parity` mediu. Ele agora é marcador LIDO, como
  // `asi-or-feat`.
  //
  // Os quatro últimos entraram aqui na 2ª rodada de fix da Task 23: estavam na
  // allowlist sem asserção NENHUMA (metade das entradas ficava sem guarda,
  // contradizendo a descrição de topo, que fala em "marcador a ser LIDO"). A
  // varredura confirma que nenhum deles tem leitor de produção — as únicas
  // citações em `site/js/**` são comentários
  // (`legacy-db-projection.js` cita `grant-feat`; `handlers/ladino.js` cita
  // `expertise-from-proficient-skills`). São mecânicas NÃO IMPLEMENTADAS nesta
  // task, e é assim que devem constar: escolher truque/magia de lista de
  // classe, conceder talento automático e Especialização continuam por fazer.
  //
  // `grant-feat` SAIU desta lista na Task 26, pelo mesmo motivo que
  // `pact-magic-slots` saiu na Task 23: passou a ter leitor de produção. O
  // passo `antecedente` do criador (`features/creator/steps/background-step.js`)
  // lê o efeito `official-handler` com esse `handlerId` para descobrir, por
  // IDENTIDADE de conteúdo, qual talento de origem o antecedente concede —
  // `params.featId` resolvido no catálogo. Ele continua sem handler
  // REGISTRADO: conceder o talento de fato é trabalho de outra task; o que
  // existe hoje é leitura de dado, e é assim que a linha fica classificada.
  const TABELAS_SEM_CONSUMIDOR = Object.freeze([
    'third-caster-slots',
    'combat-maneuvers-known',
    'expertise-from-proficient-skills',
    'choose-spell-from-class-list',
  ]);

  // Marcadores que a produção LÊ como dado — a justificativa da linha é o
  // consumidor existir e ler, não invocar.
  const MARCADORES_LIDOS = Object.freeze([
    ['asi-or-feat', 'site/js/domain/progression/progression-queries.js'],
    ['pact-magic-slots', 'site/js/domain/progression/progression-queries.js'],
    ['grant-feat', 'site/js/features/creator/steps/background-step.js'],
    // Task 28: o passo `magias` LÊ este marcador — não para invocá-lo (não há
    // handler registrado), mas para DECLARAR a lacuna de conteúdo que ele
    // representa: a opção de "Iniciado em Magia" aponta a lista de magias por
    // NOME em `params.classe`, sem referência de conteúdo à `spell-list`. O
    // passo avisa o jogador em vez de adivinhar a lista pelo nome.
    ['choose-cantrips-from-class-list', 'site/js/features/creator/steps/spells-step.js'],
  ]);

  test('nenhuma entrada da allowlist está sobrando', () => {
    // Uma entrada só se justifica enquanto o id (a) é declarado por alguma
    // entidade do catálogo e (b) NÃO tem handler registrado. Se alguém
    // registrar um handler de verdade para um destes ids, ou se o id sumir do
    // catálogo, a linha tem de sair daqui.
    const sobrando = DATA_ONLY_HANDLER_ALLOWLIST.filter(
      (id) => !declaredIds.has(id) || REGISTERED_IDS.has(id),
    ).sort();
    assert.deepEqual(sobrando, [], `entrada de DATA_ONLY_HANDLER_ALLOWLIST desnecessária: ${sobrando.join(', ')}`);
  });

  test('a allowlist unificada absorveu os ids de escolha de build da Task 22a', () => {
    // Guarda da Decisão B (Task 23): `TASK_23_BUILD_CHOICE_ALLOWLIST` deixou de
    // existir e seus ids vivem aqui, reclassificados como marcador de dado.
    // Se alguém recriar a lista separada, este teste continua exigindo que os
    // ids estejam cobertos por ESTA.
    for (const id of [
      'asi-or-feat',
      'grant-feat',
      'expertise-from-proficient-skills',
      'choose-cantrips-from-class-list',
      'choose-spell-from-class-list',
    ]) {
      assert.equal(DATA_ONLY_HANDLER_ALLOWLIST.includes(id), true, `${id} deveria estar na allowlist unificada`);
    }
  });

  test('TODA entrada da allowlist tem uma asserção de justificativa', () => {
    // Guarda da guarda: metade das entradas já ficou sem verificação nenhuma
    // (achado Important 4 da revisão). Nenhum id pode existir na allowlist sem
    // estar classificado como "ninguém lê" OU "é lido como dado".
    const classificados = new Set([...TABELAS_SEM_CONSUMIDOR, ...MARCADORES_LIDOS.map(([id]) => id)]);
    const semJustificativa = DATA_ONLY_HANDLER_ALLOWLIST.filter((id) => !classificados.has(id)).sort();
    assert.deepEqual(
      semJustificativa,
      [],
      `entrada de allowlist sem asserção de justificativa: ${semJustificativa.join(', ')}`,
    );
  });

  test('os ids SEM consumidor da allowlist continuam sem nenhum leitor em produção', () => {
    // A justificativa "nenhum código de produção lê estes ids" é uma afirmação
    // sobre `site/js/**`, então é conferida por varredura em vez de afirmada (a
    // revisão da Task 22a pegou exatamente uma citação de linha que não
    // sustentava a afirmação).
    const sourceRoot = fileURLToPath(new URL('site/js', repoRoot));
    const leitores = [];
    for (const file of listFiles(sourceRoot, '.js')) {
      const code = stripLineComments(readFileSync(file, 'utf8'));
      for (const id of TABELAS_SEM_CONSUMIDOR) {
        if (code.includes(id)) {
          leitores.push(`${path.relative(sourceRoot, file).replaceAll('\\', '/')} -> ${id}`);
        }
      }
    }
    assert.deepEqual(
      leitores.sort(),
      [],
      'algum módulo de produção passou a referenciar um id "sem consumidor" da allowlist: revise a justificativa dela',
    );
  });

  test('os marcadores da allowlist SÃO lidos como DADO pelo domínio (é o que os classifica assim)', () => {
    // Asserção POSITIVA, e é ela que sustenta a reclassificação da Decisão B:
    // estes ids não estão na allowlist por falta de consumidor, mas porque o
    // consumidor que existe os LÊ (projeção da matriz de progressão) em vez de
    // INVOCÁ-LOS. Se um leitor sumir, a justificativa da linha muda e o teste
    // avisa.
    for (const [id, arquivo] of MARCADORES_LIDOS) {
      const fonte = stripLineComments(readFileSync(fileURLToPath(new URL(arquivo, repoRoot)), 'utf8'));
      assert.equal(fonte.includes(id), true, `${arquivo} deveria ler "${id}" como marcador estruturado`);
      // E continua NÃO sendo um handler registrado — se virar, a linha sai da
      // allowlist pelo teste acima.
      assert.equal(REGISTERED_IDS.has(id), false, `${id} não deveria estar registrado como handler`);
    }
  });
});

describe('cobertura de handlers oficiais — o composition root REAL registra os doze', () => {
  test('`createAllClassHandlerRegistrations()` devolve um adapter por handler', () => {
    const registros = createAllClassHandlerRegistrations();
    assert.equal(registros.length, ALL_CLASS_HANDLERS.length);
    assert.deepEqual(
      registros.map((entry) => entry.handlerId).sort(),
      [...REGISTERED_IDS].sort(),
    );
    for (const entry of registros) {
      assert.equal(typeof entry.handler, 'function');
    }
  });

  test('o default de produção de `createAppContext` aceita os doze sem recusa', () => {
    // `createOfficialHandlerRegistry` LANÇA quando um registro é recusado, e o
    // default de `officialHandlers` é exatamente o composition root real — se
    // este teste passa, os doze estão de fato registrados na carga de página.
    assert.doesNotThrow(() => createAppContext());
  });
});
