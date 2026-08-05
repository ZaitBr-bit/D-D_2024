// ============================================================
// Passo `antecedente` (Task 26).
//
// O antecedente é o passo com mais tipos de concessão ao mesmo tempo: bônus de
// atributo (escolha), duas perícias fixas, idioma fixo + idiomas escolhidos,
// proficiência de ferramenta/instrumento, talento de origem e equipamento
// inicial. Estes casos cobrem os SEIS, pelos DEZESSEIS antecedentes do pacote —
// e provam que o nome do talento vem da entidade `feat` resolvida no catálogo,
// não de um `split('(')` sobre a string de apresentação.
// ============================================================
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';

import { createBackgroundStep, originFeatId } from '../../../site/js/features/creator/steps/background-step.js';
import { activeChoiceEffects, draftLevel } from '../../../site/js/features/creator/steps/catalog-selection-step.js';
import { PLAYER_OWNED_SLICES } from '../../../site/js/features/creator/creator-state.js';
import { clearedSlicesOf } from '../../../site/js/features/creator/creator-invalidation.js';
import { officialRegistry, draftWithCharacter, stepContext, qualifiedPicks } from '../../helpers/creator-steps.js';

/** Talento de origem esperado em cada antecedente (oráculo do baseline). */
const TALENTOS_ESPERADOS = Object.freeze({
  'dnd2024:background:acolito': 'Iniciado em Magia',
  'dnd2024:background:andarilho': 'Sortudo',
  'dnd2024:background:artesao': 'Artifista',
  'dnd2024:background:artista': 'Músico',
  'dnd2024:background:charlatao': 'Habilidoso',
  'dnd2024:background:criminoso': 'Alerta',
  'dnd2024:background:eremita': 'Curandeiro',
  'dnd2024:background:escriba': 'Habilidoso',
  'dnd2024:background:fazendeiro': 'Vigoroso',
  'dnd2024:background:guarda': 'Alerta',
  'dnd2024:background:guia': 'Iniciado em Magia',
  'dnd2024:background:marinheiro': 'Valentão de Taverna',
  'dnd2024:background:mercador': 'Sortudo',
  'dnd2024:background:nobre': 'Habilidoso',
  'dnd2024:background:sabio': 'Iniciado em Magia',
  'dnd2024:background:soldado': 'Atacante Selvagem',
});

let registry;
let step;

before(async () => {
  registry = await officialRegistry();
  const created = createBackgroundStep();
  assert.equal(created.ok, true, created.ok ? '' : created.error.code);
  step = created.value;
});

/**
 * @returns {Promise<object>}
 */
async function carregar() {
  const draft = draftWithCharacter();
  const loaded = await step.load(stepContext({ stepId: 'antecedente', draft, registry }));
  assert.equal(loaded.ok, true, loaded.ok ? '' : loaded.error.code);
  return { draft, data: loaded.value };
}

describe('passo antecedente: carga e cards', () => {
  test('load sem registry falha com erro nomeado', async () => {
    const resultado = await step.load(stepContext({ stepId: 'antecedente', draft: draftWithCharacter(), registry: null }));
    assert.equal(resultado.ok, false);
    assert.equal(resultado.error.code, 'CREATOR_STEP_REGISTRY_MISSING');
  });

  test('os DEZESSEIS antecedentes viram card, na ordem do catálogo', async () => {
    const { data } = await carregar();
    assert.equal(data.cards.length, 16);
    assert.deepEqual(
      data.cards.map((card) => card.id),
      Object.keys(TALENTOS_ESPERADOS),
    );
  });

  test('o talento do card vem do handler `grant-feat` resolvido no catálogo, para os dezesseis', async () => {
    const { data } = await carregar();
    for (const card of data.cards) {
      assert.deepEqual([...card.details], [TALENTOS_ESPERADOS[card.id]], `talento de ${card.id}`);
      // E o caminho é por IDENTIDADE de conteúdo: o featId do efeito resolve
      // para uma entidade `feat` cujo nome é exatamente o texto exibido.
      const featId = originFeatId(data.entitiesById[card.id]);
      const feat = registry.resolve(featId, 'feat');
      assert.equal(feat.ok, true, `feat de ${card.id}`);
      assert.equal(feat.value.name, TALENTOS_ESPERADOS[card.id]);
    }
  });

  test('o texto do talento NÃO é o recorte da string de apresentação', async () => {
    const { data } = await carregar();
    const acolito = data.entitiesById['dnd2024:background:acolito'];
    // A apresentação legada traz "(Clérigo) (veja o capítulo 5)" junto; o
    // caminho novo nunca a lê.
    assert.match(acolito.legacyPresentation.talento, /\(/);
    assert.equal(
      data.cards.find((card) => card.id === 'dnd2024:background:acolito').details[0],
      'Iniciado em Magia',
    );
  });
});

describe('passo antecedente: as seis concessões, por campo estruturado', () => {
  test('todo antecedente declara bônus de atributo, perícias, idiomas, ferramenta, talento e equipamento', async () => {
    const { data, draft } = await carregar();
    for (const card of data.cards) {
      const entidade = data.entitiesById[card.id];
      const efeitos = entidade.effects;
      const escolhas = activeChoiceEffects(entidade, draftLevel(draft)).map((effect) => effect.choice.id);

      assert.ok(escolhas.includes('bonus-de-atributo'), `${card.id}: sem escolha de bônus de atributo`);
      assert.ok(escolhas.includes('idiomas-adicionais'), `${card.id}: sem escolha de idiomas`);
      assert.ok(escolhas.includes('equipamento-inicial'), `${card.id}: sem escolha de equipamento`);
      assert.equal(
        efeitos.filter((effect) => effect.type === 'proficiency').length,
        2,
        `${card.id}: antecedente concede exatamente duas perícias fixas`,
      );
      assert.ok(
        efeitos.some((effect) => effect.type === 'language'),
        `${card.id}: sem idioma fixo`,
      );
      assert.equal(typeof entidade.legacyPresentation.ferramentas, 'string', `${card.id}: sem ferramenta declarada`);
      assert.notEqual(originFeatId(entidade), null, `${card.id}: sem talento de origem`);
    }
  });

  test('validate exige as três escolhas do catálogo, com a contagem que ele declara', async () => {
    const { data } = await carregar();
    const semNada = draftWithCharacter({
      slices: { backgroundSelection: { contentId: 'dnd2024:background:andarilho', packageVersion: '1.0.0' } },
    });
    const ANDARILHO = 'dnd2024:background:andarilho';
    const parcial = draftWithCharacter({
      slices: {
        backgroundSelection: { contentId: ANDARILHO, packageVersion: '1.0.0' },
        backgroundAbilityBonus: qualifiedPicks('background', ANDARILHO, { 'bonus-de-atributo': ['destreza-mais2-sabedoria-mais1'] }),
        backgroundEquipmentSelection: qualifiedPicks('background', ANDARILHO, { 'equipamento-inicial': ['opcao-a'] }),
        // idiomas exige 2 e só um foi escolhido
        backgroundSkills: qualifiedPicks('background', ANDARILHO, { 'idiomas-adicionais': ['lingua-de-sinais-comum'] }),
      },
    });
    const completo = draftWithCharacter({
      slices: {
        backgroundSelection: { contentId: ANDARILHO, packageVersion: '1.0.0' },
        backgroundAbilityBonus: qualifiedPicks('background', ANDARILHO, { 'bonus-de-atributo': ['destreza-mais2-sabedoria-mais1'] }),
        backgroundEquipmentSelection: qualifiedPicks('background', ANDARILHO, { 'equipamento-inicial': ['opcao-a'] }),
        backgroundSkills: qualifiedPicks('background', ANDARILHO, { 'idiomas-adicionais': ['lingua-de-sinais-comum', 'anao'] }),
      },
    });

    assert.equal(step.validate(stepContext({ stepId: 'antecedente', draft: semNada, data, registry })).valid, false);
    const parcialResultado = step.validate(stepContext({ stepId: 'antecedente', draft: parcial, data, registry }));
    assert.equal(parcialResultado.valid, false);
    assert.deepEqual(
      parcialResultado.errors.map((erro) => erro.choiceId),
      ['idiomas-adicionais'],
    );
    assert.equal(step.validate(stepContext({ stepId: 'antecedente', draft: completo, data, registry })).valid, true);
  });

  test('as escolhas de OUTRO antecedente não satisfazem este, mesmo com choiceId idêntico', async () => {
    // Os 16 antecedentes declaram `bonus-de-atributo`, `idiomas-adicionais` e
    // `equipamento-inicial` com os MESMOS ids — e `equipamento-inicial` usa
    // `opcao-a`/`opcao-b` em todos. Chaveada pela fonte, a escolha do Acólito
    // não vale para o Andarilho.
    const { data } = await carregar();
    const ACOLITO = 'dnd2024:background:acolito';
    const draft = draftWithCharacter({
      slices: {
        backgroundSelection: { contentId: 'dnd2024:background:andarilho', packageVersion: '1.0.0' },
        backgroundAbilityBonus: qualifiedPicks('background', ACOLITO, { 'bonus-de-atributo': ['sabedoria-mais2-carisma-mais1'] }),
        backgroundEquipmentSelection: qualifiedPicks('background', ACOLITO, { 'equipamento-inicial': ['opcao-a'] }),
        backgroundSkills: qualifiedPicks('background', ACOLITO, { 'idiomas-adicionais': ['anao', 'elfico'] }),
      },
    });
    const resultado = step.validate(stepContext({ stepId: 'antecedente', draft, data, registry }));
    assert.equal(resultado.valid, false);
    assert.deepEqual(
      resultado.errors.map((erro) => erro.choiceId).sort(),
      ['bonus-de-atributo', 'equipamento-inicial', 'idiomas-adicionais'],
    );
  });
});

describe('passo antecedente: invalidate', () => {
  test('invalida bônus, perícias, ferramenta, talento e equipamento — e revisita `atributos`', async () => {
    const draft = draftWithCharacter({
      slices: { backgroundSelection: { contentId: 'dnd2024:background:acolito', packageVersion: '1.0.0' } },
      provenance: { backgroundSelection: ['source:background:0000:dnd2024-background-acolito'] },
    });
    const patch = step.invalidate(stepContext({ stepId: 'antecedente', draft, registry }));
    assert.equal(patch.ok, true);
    assert.deepEqual([...patch.value.clearedStepIds], ['atributos']);
    assert.deepEqual([...clearedSlicesOf(patch.value)], [
      'backgroundSelection',
      'backgroundAbilityBonus',
      'backgroundSkills',
      'backgroundToolProficiency',
      'backgroundFeat',
      'backgroundEquipmentSelection',
    ]);
    for (const slice of PLAYER_OWNED_SLICES) {
      assert.ok(patch.value.preservedSlices.includes(slice));
    }
  });
});
