// ============================================================
// Passo `magias` (Task 28).
//
// O ponto destes casos NÃO é uma fixture de Mago: é o pacote INTEIRO. As oito
// classes conjuradoras do `dnd2024` (incluindo o Bruxo, cujos espaços vêm da
// tabela de Magia de Pacto, e Paladino/Guardião, que não têm truque nenhum)
// precisam ser criáveis, e as quatro não-conjuradoras precisam atravessar o
// passo sem exigir escolha.
//
// Também é aqui que as duas LACUNAS de conteúdo ficam presas por asserção:
// grimório não declarado pelo catálogo e a referência de lista de magias
// ausente no talento "Iniciado em Magia". Se o conteúdo for corrigido, estes
// casos falham — que é o objetivo: a dívida não pode sumir em silêncio.
// ============================================================
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';

import {
  SPELLBOOK_PREPARERS,
  SPELLS_INTENT_TYPES,
  UNRESOLVED_SPELL_LIST_HANDLER,
  collectSpellSources,
  createSpellsStep,
  eligibleSpellsFor,
  materializeSelection,
  readSpellSelection,
} from '../../../site/js/features/creator/steps/spells-step.js';
import { collectCharacterEffects } from '../../../site/js/domain/effects/collect-effects.js';
import { applyGrantEffects } from '../../../site/js/domain/effects/apply-grants.js';
import { createCreatorDraft } from '../../../site/js/features/creator/creator-state.js';
import { clearedSlicesOf } from '../../../site/js/features/creator/creator-invalidation.js';
import { officialRegistry, draftWithCharacter, stepContext } from '../../helpers/creator-steps.js';

/**
 * As doze classes do pacote, com a expectativa de conjuração e — para as
 * conjuradoras — o NÚMERO EXATO de truques de nível 1.
 *
 * `cantrips` é pinado como LITERAL de propósito, e não derivado do catálogo.
 * O passo traduz "recurso `truques` ausente" em `0` (é o que torna Paladino e
 * Guardião criáveis, já que eles genuinamente não têm truque nas regras 2024).
 * Esse default é justificado, mas é um default por AUSÊNCIA DE DADO: se a
 * migração da Task 8 algum dia deixar de emitir o recurso `truques` para
 * Bardo/Bruxo/Clérigo/Druida/Feiticeiro/Mago, o passo passaria a exigir zero
 * truques em silêncio, o personagem continuaria criável e uma asserção
 * derivada do catálogo concordaria com a perda.
 *
 * Só um número literal denuncia isso — é a rede de segurança do default.
 * @type {ReadonlyArray<Readonly<{slug: string, caster: boolean, cantrips: number|null}>>}
 */
const CLASSES = Object.freeze([
  Object.freeze({ slug: 'bardo', caster: true, cantrips: 2 }),
  Object.freeze({ slug: 'barbaro', caster: false, cantrips: null }),
  Object.freeze({ slug: 'bruxo', caster: true, cantrips: 2 }),
  Object.freeze({ slug: 'clerigo', caster: true, cantrips: 3 }),
  Object.freeze({ slug: 'druida', caster: true, cantrips: 2 }),
  Object.freeze({ slug: 'feiticeiro', caster: true, cantrips: 4 }),
  // As DUAS conjuradoras sem truque nenhum no 2024 — o caso que justifica o
  // default `0`.
  Object.freeze({ slug: 'guardiao', caster: true, cantrips: 0 }),
  Object.freeze({ slug: 'guerreiro', caster: false, cantrips: null }),
  Object.freeze({ slug: 'ladino', caster: false, cantrips: null }),
  Object.freeze({ slug: 'mago', caster: true, cantrips: 3 }),
  Object.freeze({ slug: 'monge', caster: false, cantrips: null }),
  Object.freeze({ slug: 'paladino', caster: true, cantrips: 0 }),
]);

/** As conjuradoras que DECLARAM o recurso `truques` (todas menos as duas de zero). */
const CLASSES_COM_TRUQUE = Object.freeze(CLASSES.filter((entry) => entry.caster && entry.cantrips > 0));

let registry;
let step;

before(async () => {
  registry = await officialRegistry();
  const created = createSpellsStep();
  assert.equal(created.ok, true, created.ok ? '' : created.error.code);
  step = created.value;
});

/**
 * Rascunho com a classe escolhida E as concessões dela já materializadas — o
 * estado real na chegada ao passo `magias` (é dali que saem os recursos
 * `truques`/`magias-preparadas`/`spell-slot-*`).
 * @param {string} classId
 * @returns {object} draft
 */
function draftComClasse(classId) {
  const base = draftWithCharacter({ slices: { classSelection: { contentId: classId, packageVersion: '1.0.0' } } });
  let character = {
    ...base.character,
    build: { ...base.character.build, classRef: { id: classId, packageVersion: '1.0.0' }, choices: {} },
  };
  const efeitos = collectCharacterEffects(character, { registry });
  assert.equal(efeitos.ok, true, efeitos.ok ? '' : efeitos.error.code);
  const aplicado = applyGrantEffects(character, efeitos.value);
  assert.equal(aplicado.ok, true, aplicado.ok ? '' : aplicado.error.code);
  character = aplicado.value.character;
  const criado = createCreatorDraft({ character, slices: base.slices, provenance: base.provenance });
  assert.equal(criado.ok, true);
  return criado.value;
}

/**
 * Preenche a seleção até saciar todos os limites da fonte.
 * @param {object} draft
 * @param {object} data - step data.
 * @returns {object} novo draft
 */
function saciar(draft, data) {
  let atual = draft;
  for (const source of data.sources) {
    const elegiveis = data.eligibleBySource[source.sourceInstanceId] ?? [];
    for (const [collection, limite] of [
      ['known', source.cantripLimit],
      ['spellbook', source.spellbookLimit],
      ['prepared', source.preparedLimit],
    ]) {
      if (limite === null) {
        continue;
      }
      let postas = 0;
      for (const spell of elegiveis) {
        if (postas >= limite) {
          break;
        }
        if (collection === 'known' ? spell.level !== 0 : spell.level === 0) {
          continue;
        }
        const reduzido = step.reduce(stepContext({ stepId: 'magias', draft: atual, registry, data }), {
          type: SPELLS_INTENT_TYPES.toggle,
          sourceInstanceId: source.sourceInstanceId,
          collection,
          spellId: spell.id,
        });
        if (reduzido.ok !== true) {
          continue;
        }
        atual = reduzido.value.draft;
        postas += 1;
      }
      assert.equal(postas, limite, `não foi possível saciar "${collection}" de ${source.contentId}`);
    }
  }
  return atual;
}

describe('passo magias: paridade por CLASSE, não por fixture', () => {
  for (const { slug, caster } of CLASSES) {
    test(`${slug}: ${caster ? 'conjura e o passo é satisfazível' : 'não conjura e o passo já é válido'}`, async () => {
      const classId = `dnd2024:class:${slug}`;
      const draft = draftComClasse(classId);
      const ctx = stepContext({ stepId: 'magias', draft, registry });
      const loaded = await step.load(ctx);
      assert.equal(loaded.ok, true, loaded.ok ? '' : loaded.error.code);
      const data = loaded.value;
      assert.equal(data.spellcaster, caster, `${slug} classificado errado`);

      if (!caster) {
        assert.equal(step.validate({ ...ctx, data }).valid, true, `${slug} não deveria exigir magia nenhuma`);
        assert.match(step.render({ ...ctx, data }), /data-magias-sem-conjuracao="true"/);
        return;
      }

      const source = data.sources[0];
      assert.equal(typeof source.preparedLimit, 'number', `${slug} sem limite de preparadas estruturado`);
      assert.equal(typeof source.cantripLimit, 'number');
      assert.equal(typeof source.maxSpellLevel, 'number', `${slug} sem círculo máximo derivado`);
      // Antes de escolher, o passo é INVÁLIDO — nunca "válido por omissão".
      assert.equal(step.validate({ ...ctx, data }).valid, false);

      const saciado = saciar(draft, data);
      const validado = step.validate(stepContext({ stepId: 'magias', draft: saciado, registry, data }));
      assert.equal(validado.valid, true, `${slug}: ${JSON.stringify(validado.errors)}`);
    });
  }

  test('Paladino e Guardião têm ZERO truques — e isso é declaração do conteúdo, não erro', async () => {
    for (const slug of ['paladino', 'guardiao']) {
      const draft = draftComClasse(`dnd2024:class:${slug}`);
      const data = (await step.load(stepContext({ stepId: 'magias', draft, registry }))).value;
      assert.equal(data.sources[0].cantripLimit, 0);
    }
  });

  test('REDE DE SEGURANÇA do default: toda conjuradora com truque declara um número EXATO e > 0', async () => {
    // Esta é a guarda contra o default `cantripLimit ?? 0` mascarar perda de
    // dado. `typeof === 'number'` não serve: `0` é number. O número tem de
    // bater com o literal, e tem de ser maior que zero para as seis classes
    // que de fato conhecem truques — se a migração perder o recurso `truques`
    // de qualquer uma delas, o passo passaria a exigir zero e ESTE caso é o
    // único lugar que denuncia.
    assert.equal(CLASSES_COM_TRUQUE.length, 6, 'o pacote tem seis conjuradoras com truque; a lista não pode encolher em silêncio');
    for (const { slug, cantrips } of CLASSES_COM_TRUQUE) {
      const draft = draftComClasse(`dnd2024:class:${slug}`);
      const data = (await step.load(stepContext({ stepId: 'magias', draft, registry }))).value;
      const limite = data.sources[0].cantripLimit;
      assert.ok(limite > 0, `${slug} passou a exigir ${limite} truques: o recurso "truques" sumiu do catálogo?`);
      assert.equal(limite, cantrips, `${slug}: o limite de truques divergiu do recurso estruturado`);
    }
  });

  test('Bruxo: o círculo máximo vem da tabela ESTRUTURADA de Magia de Pacto', async () => {
    const draft = draftComClasse('dnd2024:class:bruxo');
    const data = (await step.load(stepContext({ stepId: 'magias', draft, registry }))).value;
    assert.equal(data.sources[0].maxSpellLevel, 1, 'Bruxo nível 1 tem espaço de 1º círculo');
    assert.ok((data.eligibleBySource[data.sources[0].sourceInstanceId] ?? []).some((spell) => spell.level === 1));
  });
});

describe('passo magias: grimório (Mago)', () => {
  test('Mago prepara a partir do grimório e o limite do grimório é declarado', async () => {
    const draft = draftComClasse('dnd2024:class:mago');
    const data = (await step.load(stepContext({ stepId: 'magias', draft, registry }))).value;
    const source = data.sources[0];
    assert.equal(source.preparedFrom, 'spellbook');
    assert.equal(source.spellbookLimit, SPELLBOOK_PREPARERS['dnd2024:class:mago'].initialSpellbookSize);
  });

  test('preparar uma magia FORA do grimório é recusado pelo domínio (Task 18)', async () => {
    const draft = draftComClasse('dnd2024:class:mago');
    const ctx = stepContext({ stepId: 'magias', draft, registry });
    const data = (await step.load(ctx)).value;
    const source = data.sources[0];
    const primeira = (data.eligibleBySource[source.sourceInstanceId] ?? []).find((spell) => spell.level === 1);
    const recusado = step.reduce({ ...ctx, data }, {
      type: SPELLS_INTENT_TYPES.toggle,
      sourceInstanceId: source.sourceInstanceId,
      collection: 'prepared',
      spellId: primeira.id,
    });
    assert.equal(recusado.ok, false);
    assert.equal(recusado.error.code, 'SPELL_SELECTION_NOT_IN_SPELLBOOK');
  });

  test('a invariante do grimório sobrevive à sequência marcar -> preparar -> desmarcar do grimório -> marcar outra', async () => {
    // A sequência é 100% alcançável por cliques reais, na ordem em que estão
    // aqui, e devolvia as CONTAGENS ao esperado com uma magia preparada FORA
    // do grimório — `SPELL_SELECTION_NOT_IN_SPELLBOOK` só é conferido no
    // instante da marcação, e o portão de `validate` só contava quantidades.
    const draft = draftComClasse('dnd2024:class:mago');
    const ctxInicial = stepContext({ stepId: 'magias', draft, registry });
    const data = (await step.load(ctxInicial)).value;
    const source = data.sources[0];
    const elegiveis = data.eligibleBySource[source.sourceInstanceId] ?? [];
    const truques = elegiveis.filter((spell) => spell.level === 0).slice(0, source.cantripLimit);
    const circulo1 = elegiveis.filter((spell) => spell.level === 1);
    assert.ok(circulo1.length > source.spellbookLimit, 'o caso precisa de uma magia sobrando fora do grimório');

    let atual = draft;
    /**
     * @param {string} collection
     * @param {string} spellId
     * @returns {object}
     */
    const clicar = (collection, spellId) => {
      const reduzido = step.reduce(stepContext({ stepId: 'magias', draft: atual, registry, data }), {
        type: SPELLS_INTENT_TYPES.toggle,
        sourceInstanceId: source.sourceInstanceId,
        collection,
        spellId,
      });
      if (reduzido.ok === true) {
        atual = reduzido.value.draft;
      }
      return reduzido;
    };
    /** @returns {object} ValidationResult */
    const validar = () => step.validate(stepContext({ stepId: 'magias', draft: atual, registry, data }));

    for (const truque of truques) {
      assert.equal(clicar('known', truque.id).ok, true);
    }
    const livro = circulo1.slice(0, source.spellbookLimit);
    for (const magia of livro) {
      assert.equal(clicar('spellbook', magia.id).ok, true);
    }
    for (const magia of livro.slice(0, source.preparedLimit)) {
      assert.equal(clicar('prepared', magia.id).ok, true);
    }
    assert.equal(validar().valid, true, 'o estado saudável precisa ser válido antes da sequência');

    // O passo que quebrava tudo: tirar do grimório uma magia JÁ PREPARADA...
    assert.equal(clicar('spellbook', livro[0].id).ok, true);
    // ...e repor outra, devolvendo a contagem do grimório ao limite.
    assert.equal(clicar('spellbook', circulo1[source.spellbookLimit].id).ok, true);

    const selecao = readSpellSelection(atual)[source.sourceInstanceId];
    const orfas = selecao.prepared.filter((id) => !selecao.spellbook.includes(id));
    assert.deepEqual([...orfas], [], 'nenhuma magia pode ficar preparada fora do grimório');
    // A cascata removeu a preparação órfã, então agora FALTA uma preparada —
    // o passo recusa avançar até o jogador escolher outra.
    const validado = validar();
    assert.equal(validado.valid, false, 'o estado precisa ser recusado até o jogador repor a preparação');
    assert.ok(validado.errors.some((entry) => entry.code === 'CREATOR_SPELLS_COUNT' && entry.collection === 'prepared'));
    // E o personagem materializado concorda com a fatia.
    const preparadasNoPersonagem = atual.character.state.spells.prepared
      .filter((entry) => entry.instanceId.startsWith('creator:'))
      .map((entry) => entry.spellRef.id);
    assert.equal(preparadasNoPersonagem.includes(livro[0].id), false);
  });

  test('o PORTÃO recusa a inconsistência mesmo quando ela não veio do reduce', async () => {
    // Defesa em profundidade: a cascata do `reduce` mantém o estado coerente
    // por construção, mas um portão que confia na construção não é um portão.
    // Aqui a fatia é montada À MÃO com uma preparada fora do grimório — como
    // viria de um rascunho vindo de storage ou de uma regressão futura no
    // `reduce` — e `validate` precisa recusar.
    const draft = draftComClasse('dnd2024:class:mago');
    const data = (await step.load(stepContext({ stepId: 'magias', draft, registry }))).value;
    const source = data.sources[0];
    const elegiveis = data.eligibleBySource[source.sourceInstanceId] ?? [];
    const truques = elegiveis.filter((spell) => spell.level === 0).slice(0, source.cantripLimit).map((spell) => spell.id);
    const circulo1 = elegiveis.filter((spell) => spell.level === 1).map((spell) => spell.id);
    const livro = circulo1.slice(0, source.spellbookLimit);
    // Contagens TODAS corretas — e mesmo assim inconsistente: a última
    // preparada não está no grimório.
    const preparadas = [...livro.slice(0, source.preparedLimit - 1), circulo1[source.spellbookLimit]];

    const forjado = createCreatorDraft({
      character: draft.character,
      slices: {
        spellSelection: {
          sources: { [source.sourceInstanceId]: { known: truques, spellbook: livro, prepared: preparadas } },
        },
      },
    }).value;

    const validado = step.validate(stepContext({ stepId: 'magias', draft: forjado, registry, data }));
    assert.equal(validado.valid, false);
    const problema = validado.errors.find((entry) => entry.code === 'CREATOR_SPELLS_PREPARED_NOT_IN_SPELLBOOK') ?? null;
    assert.notEqual(problema, null, 'o portão precisa nomear a magia preparada fora do grimório');
    assert.equal(problema.spellId, circulo1[source.spellbookLimit]);
    // E nenhum erro de CONTAGEM — provando que contar não bastava.
    assert.equal(
      validado.errors.some((entry) => entry.code === 'CREATOR_SPELLS_COUNT'),
      false,
      'as contagens estão corretas: só a invariante está quebrada',
    );
  });

  test('a lacuna do grimório é DECLARADA no step data e visível no render', async () => {
    const draft = draftComClasse('dnd2024:class:mago');
    const ctx = stepContext({ stepId: 'magias', draft, registry });
    const data = (await step.load(ctx)).value;
    assert.ok(data.contentGaps.some((gap) => gap.kind === 'spellbook-not-declared'));
    assert.match(step.render({ ...ctx, data }), /data-magias-lacuna="spellbook-not-declared"/);

    // A lacuna é REAL: o catálogo continua sem declarar preparação por
    // grimório. Se ganhar o campo, este caso falha e obriga a remover
    // `SPELLBOOK_PREPARERS`.
    const classe = registry.resolve('dnd2024:class:mago', 'class').value;
    assert.equal(classe.spellcasting.preparationSource, undefined);
  });
});

describe('passo magias: Iniciado em Magia (lacuna de referência de lista)', () => {
  test('a opção do talento aponta a lista por NOME, sem referência de conteúdo', () => {
    const feat = registry.resolve('dnd2024:feat:iniciado-em-magia', 'feat').value;
    const escolha = feat.effects.find((effect) => effect.type === 'choice')?.choice ?? null;
    assert.notEqual(escolha, null);
    for (const opcao of escolha.options) {
      const grant = opcao.grants.find((entry) => entry.handlerId === UNRESOLVED_SPELL_LIST_HANDLER) ?? null;
      assert.notEqual(grant, null, `a opção "${opcao.id}" perdeu o marcador de lacuna`);
      // O ponteiro é um NOME em português; não há `spellList`/`spellListId`.
      assert.equal(typeof grant.params.classe, 'string');
      assert.equal(grant.params.spellList, undefined);
      assert.equal(grant.params.spellListId, undefined);
    }
  });

  test('a instância do talento vira LACUNA declarada, nunca uma lista adivinhada pelo nome', () => {
    const draft = draftComClasse('dnd2024:class:guerreiro');
    const comTalento = createCreatorDraft({
      character: {
        ...draft.character,
        build: { ...draft.character.build, featRefs: [{ id: 'dnd2024:feat:iniciado-em-magia', packageVersion: '1.0.0' }] },
      },
      slices: draft.slices,
      provenance: draft.provenance,
    }).value;
    const { sources, gaps } = collectSpellSources(stepContext({ stepId: 'magias', draft: comTalento, registry }));
    assert.deepEqual([...sources], [], 'nenhuma fonte adivinhada a partir de nome de classe');
    const lacuna = gaps.find((gap) => gap.kind === 'spell-list-reference-missing') ?? null;
    assert.notEqual(lacuna, null);
    assert.equal(lacuna.contentId, 'dnd2024:feat:iniciado-em-magia');
  });

  test('DUAS instâncias do talento produzem lacunas declaradas e não quebram o passo', async () => {
    const draft = draftComClasse('dnd2024:class:guerreiro');
    const comDois = createCreatorDraft({
      character: {
        ...draft.character,
        build: {
          ...draft.character.build,
          featRefs: [
            { id: 'dnd2024:feat:iniciado-em-magia', packageVersion: '1.0.0' },
            { id: 'dnd2024:feat:iniciado-em-magia', packageVersion: '1.0.0' },
          ],
        },
      },
      slices: draft.slices,
      provenance: draft.provenance,
    }).value;
    const ctx = stepContext({ stepId: 'magias', draft: comDois, registry });
    const data = (await step.load(ctx)).value;
    assert.equal(data.contentGaps.filter((gap) => gap.kind === 'spell-list-reference-missing').length, 2);
    // A lacuna AVISA, não bloqueia: o jogador consegue terminar o personagem.
    assert.equal(step.validate({ ...ctx, data }).valid, true);
    assert.match(step.render({ ...ctx, data }), /data-magias-lacuna="spell-list-reference-missing"/);
  });
});

describe('passo magias: simetria e invalidação', () => {
  test('desmarcar é o inverso EXATO de marcar (deep equality do personagem)', async () => {
    const draft = draftComClasse('dnd2024:class:clerigo');
    const ctx = stepContext({ stepId: 'magias', draft, registry });
    const data = (await step.load(ctx)).value;
    const source = data.sources[0];
    const truque = (data.eligibleBySource[source.sourceInstanceId] ?? []).find((spell) => spell.level === 0);

    const marcado = step.reduce({ ...ctx, data }, {
      type: SPELLS_INTENT_TYPES.toggle,
      sourceInstanceId: source.sourceInstanceId,
      collection: 'known',
      spellId: truque.id,
    });
    assert.equal(marcado.ok, true);
    const desmarcado = step.reduce(stepContext({ stepId: 'magias', draft: marcado.value.draft, registry, data }), {
      type: SPELLS_INTENT_TYPES.toggle,
      sourceInstanceId: source.sourceInstanceId,
      collection: 'known',
      spellId: truque.id,
    });
    assert.equal(desmarcado.ok, true);
    assert.deepEqual(desmarcado.value.draft.character.state.spells, draft.character.state.spells);
  });

  test('a mesma magia não pode ser marcada duas vezes na mesma coleção/fonte', async () => {
    const draft = draftComClasse('dnd2024:class:druida');
    const ctx = stepContext({ stepId: 'magias', draft, registry });
    const data = (await step.load(ctx)).value;
    const source = data.sources[0];
    const truque = (data.eligibleBySource[source.sourceInstanceId] ?? []).find((spell) => spell.level === 0);
    const marcado = step.reduce({ ...ctx, data }, {
      type: SPELLS_INTENT_TYPES.toggle,
      sourceInstanceId: source.sourceInstanceId,
      collection: 'known',
      spellId: truque.id,
    });
    // Marcar de novo DESMARCA (toggle); o que não pode é a fatia guardar o id
    // duas vezes.
    const lista = readSpellSelection(marcado.value.draft)[source.sourceInstanceId].known;
    assert.deepEqual([...lista], [truque.id]);
  });

  test('magias CONCEDIDAS por outra fonte nunca são apagadas pela materialização', async () => {
    const draft = draftComClasse('dnd2024:class:guardiao');
    const concedidas = draft.character.state.spells.known.filter((entry) => entry.sourceInstanceId !== null);
    assert.ok(concedidas.length > 0, 'o Guardião precisa ter magia concedida por característica para este caso valer');
    const { sources } = collectSpellSources(stepContext({ stepId: 'magias', draft, registry }));
    const depois = materializeSelection(draft.character, sources, {});
    assert.deepEqual(depois.state.spells.known, draft.character.state.spells.known);
    assert.deepEqual(depois.state.spells.prepared, draft.character.state.spells.prepared);
  });

  test('a fatia spellSelection não carrega proveniência (voltar não revoga a classe)', async () => {
    const draft = draftComClasse('dnd2024:class:mago');
    const ctx = stepContext({ stepId: 'magias', draft, registry });
    const data = (await step.load(ctx)).value;
    const saciado = saciar(draft, data);
    assert.deepEqual([...saciado.provenance.spellSelection], []);

    const patch = step.invalidate(stepContext({ stepId: 'magias', draft: saciado, registry }));
    assert.equal(patch.ok, true);
    assert.deepEqual([...clearedSlicesOf(patch.value)], ['spellSelection']);
    assert.deepEqual([...patch.value.revokedProvenanceIds], [], 'voltar do passo magias não pode revogar a classe');
  });

  test('toda magia escolhida chega ao personagem com nome e círculo (Task 28b)', async () => {
    // REGRESSÃO. `state.spells[*]` não tem campo para nome nem círculo (o
    // schema canônico é `additionalProperties: false`), e
    // `character-codec.js` projeta cada magia para o registro persistido como
    // `{...customDefinition, instanceId}`. Com `customDefinition: null`, o
    // Mago criado pelo criador novo era gravado como
    // `magias_preparadas: [{instanceId}]` — sem `nome` — e a FICHA legada
    // quebrava ao ordenar a lista (`a.nome.localeCompare` sobre `undefined`):
    // personagem criado com sucesso e impossível de abrir.
    const draft = draftComClasse('dnd2024:class:mago');
    const ctx = stepContext({ stepId: 'magias', draft, registry });
    const data = (await step.load(ctx)).value;
    const saciado = saciar(draft, data);

    const geridas = ['known', 'prepared', 'spellbook'].flatMap((collection) =>
      saciado.character.state.spells[collection]
        .filter((entry) => String(entry.instanceId).startsWith('creator:'))
        .map((entry) => ({ collection, entry })),
    );
    assert.ok(geridas.length > 0, 'o Mago precisa ter magias escolhidas para este caso valer');

    for (const { collection, entry } of geridas) {
      assert.notEqual(entry.customDefinition, null, `magia sem apresentação legada em ${collection}`);
      assert.equal(typeof entry.customDefinition.nome, 'string');
      assert.ok(entry.customDefinition.nome.length > 0, `magia sem nome em ${collection}`);
      assert.equal(Number.isInteger(entry.customDefinition.circulo), true, `magia sem círculo em ${collection}`);
      // O nome vem do CATÁLOGO, não do id.
      const entidade = registry.get(entry.spellRef.id);
      assert.equal(entry.customDefinition.nome, entidade.name);
      assert.equal(entry.customDefinition.circulo, entidade.level);
    }
  });

  test('a materialização é idempotente: repetir produz o mesmo estado', async () => {
    const draft = draftComClasse('dnd2024:class:feiticeiro');
    const ctx = stepContext({ stepId: 'magias', draft, registry });
    const data = (await step.load(ctx)).value;
    const saciado = saciar(draft, data);
    const { sources } = collectSpellSources(stepContext({ stepId: 'magias', draft: saciado, registry }));
    const selecao = readSpellSelection(saciado);
    const uma = materializeSelection(draft.character, sources, selecao);
    const outra = materializeSelection(uma, sources, selecao);
    assert.deepEqual(outra.state.spells, uma.state.spells);
  });
});

describe('passo magias: guardas', () => {
  test('load sem registry falha com erro nomeado', async () => {
    const loaded = await step.load(stepContext({ stepId: 'magias', draft: draftWithCharacter({}), registry: null }));
    assert.equal(loaded.ok, false);
    assert.equal(loaded.error.code, 'CREATOR_STEP_REGISTRY_MISSING');
  });

  test('fonte e coleção desconhecidas são recusadas', async () => {
    const draft = draftComClasse('dnd2024:class:mago');
    const ctx = stepContext({ stepId: 'magias', draft, registry });
    const fonte = step.reduce(ctx, { type: SPELLS_INTENT_TYPES.toggle, sourceInstanceId: 'inventada', collection: 'known', spellId: 'x' });
    assert.equal(fonte.ok, false);
    assert.equal(fonte.error.code, 'CREATOR_SPELLS_SOURCE_UNKNOWN');

    const { sources } = collectSpellSources(ctx);
    const colecao = step.reduce(ctx, {
      type: SPELLS_INTENT_TYPES.toggle,
      sourceInstanceId: sources[0].sourceInstanceId,
      collection: 'inventada',
      spellId: 'x',
    });
    assert.equal(colecao.ok, false);
    assert.equal(colecao.error.code, 'CREATOR_SPELLS_COLLECTION_UNKNOWN');
  });

  test('só magias da lista da classe são elegíveis', async () => {
    const draft = draftComClasse('dnd2024:class:clerigo');
    const { sources } = collectSpellSources(stepContext({ stepId: 'magias', draft, registry }));
    for (const spell of eligibleSpellsFor(registry, sources[0])) {
      const entidade = registry.get(spell.id);
      assert.ok(entidade.classes.includes('dnd2024:class:clerigo'), `${spell.id} não é da lista de Clérigo`);
    }
  });
});
