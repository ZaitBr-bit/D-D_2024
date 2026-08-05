// Testes da EXPANSÃO de `choice.options[].grants` em
// `domain/effects/collect-effects.js` (Task 23).
//
// A expansão foi acrescentada ao motor da Task 15 para corrigir o Critical 2 da
// revisão (466 grants do catálogo eram inertes: escolher uma opção gravava a
// escolha e o motor a ignorava). Estes casos cobrem o caminho NOVO — que a
// suíte não cobria, e por isso deixou passar dois defeitos que a re-revisão
// pegou depois:
//
//   NEW-1: o `when` do próprio grant era ignorado (gating por nível burlado);
//   NEW-2: `equipamento-inicial` colidia entre classe e antecedente.
//
// O oráculo é o CATÁLOGO REAL — as 12 concessões gated de verdade (magias de
// linhagem de Elfo/Tiferino) e os `equipamento-inicial` das 12 classes e 16
// antecedentes —, nunca fixture fabricada: foi justamente a fixture fabricada
// que não teria exposto nenhum dos dois.

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';

import { createAppContext } from '../../../site/js/app-context.js';
import { createDiskFetch } from '../../helpers/disk-fetch.js';
import { createEmptyCharacter } from '../../../site/js/domain/character/model.js';
import { collectCharacterEffects, applyGrantEffects } from '../../../site/js/domain/effects/index.js';

const RULESET_REF = Object.freeze({ id: 'dnd2024:ruleset:core', packageVersion: '1.0.0' });

let registry;
let contexto;

before(async () => {
  const { fetchFn } = createDiskFetch();
  const ativacao = await createAppContext({ fetchFn }).initializeContent();
  assert.equal(ativacao.ok, true, `ativação do catálogo falhou: ${JSON.stringify(ativacao.error ?? null)}`);
  registry = ativacao.value;
  contexto = { registry };
});

/**
 * Personagem canônico com as referências e escolhas informadas.
 * @param {{level?: number, refs?: object, choices?: object}} params
 * @returns {object}
 */
function personagem({ level = 1, refs = {}, choices = {} } = {}) {
  const base = createEmptyCharacter({ id: 'c1', now: '2026-01-01T00:00:00.000Z', rulesetRef: RULESET_REF });
  return {
    ...base,
    build: { ...base.build, ...refs, choices },
    state: { ...base.state, level },
  };
}

/** Ids de magia concedidos pelos efeitos coletados. */
function magiasConcedidas(character) {
  const efeitos = collectCharacterEffects(character, contexto);
  assert.equal(efeitos.ok, true, JSON.stringify(efeitos.error ?? null));
  return efeitos.value
    .filter((entrada) => entrada.effect.type === 'grant-spell')
    .map((entrada) => entrada.effect.spell)
    .sort();
}

describe('expansão de choice — o `when` do PRÓPRIO grant é respeitado (NEW-1)', () => {
  // Alto Elfo: `linhagem-elfica` concede um truque imediato, `detectar-magia`
  // com `when: {kind:'level', min:3}` e `passo-nebuloso` com `min:5`.
  const ELFO = {
    refs: {
      classRef: { id: 'dnd2024:class:guerreiro', packageVersion: '1.0.0' },
      speciesRef: { id: 'dnd2024:species:elfo', packageVersion: '1.0.0' },
    },
    choices: { 'linhagem-elfica': ['alto-elfo'] },
  };

  test('nível 1: a escolha NÃO concede as magias gated por nível', () => {
    const magias = magiasConcedidas(personagem({ level: 1, ...ELFO }));
    assert.equal(magias.includes('dnd2024:spell:prestidigitacao-arcana'), true, 'o truque sem gate vale já no 1');
    assert.equal(
      magias.includes('dnd2024:spell:detectar-magia'),
      false,
      'detectar-magia exige nível 3 e não pode cair num personagem de nível 1',
    );
    assert.equal(magias.includes('dnd2024:spell:passo-nebuloso'), false, 'passo-nebuloso exige nível 5');
  });

  test('nível 3: a magia de nível 3 entra, a de nível 5 não', () => {
    const magias = magiasConcedidas(personagem({ level: 3, ...ELFO }));
    assert.equal(magias.includes('dnd2024:spell:detectar-magia'), true);
    assert.equal(magias.includes('dnd2024:spell:passo-nebuloso'), false);
  });

  test('nível 5: as duas entram', () => {
    const magias = magiasConcedidas(personagem({ level: 5, ...ELFO }));
    assert.equal(magias.includes('dnd2024:spell:detectar-magia'), true);
    assert.equal(magias.includes('dnd2024:spell:passo-nebuloso'), true);
  });

  test('o gate vale também no ESTADO materializado (alwaysPrepared não escapa)', () => {
    // As 12 concessões gated são `alwaysPrepared: true`: sem o gate, elas
    // entravam em `state.spells.known` E `state.spells.prepared` num
    // personagem de nível 1.
    const nivel1 = personagem({ level: 1, ...ELFO });
    const efeitos = collectCharacterEffects(nivel1, contexto);
    const concedido = applyGrantEffects(nivel1, efeitos.value, contexto);
    assert.equal(concedido.ok, true, JSON.stringify(concedido.error ?? null));

    const idsDe = (lista) => (lista ?? []).map((entrada) => entrada.spellRef?.id ?? entrada.spellRef);
    const conhecidas = idsDe(concedido.value.character.state.spells.known);
    const preparadas = idsDe(concedido.value.character.state.spells.prepared);
    for (const lista of [conhecidas, preparadas]) {
      assert.equal(lista.includes('dnd2024:spell:detectar-magia'), false);
      assert.equal(lista.includes('dnd2024:spell:passo-nebuloso'), false);
    }
  });

  test('vale para as três linhagens de Tiferino também, não só para o Elfo', () => {
    // Evita paridade de fixture única: as 12 concessões gated se dividem entre
    // 3 linhagens élficas e 3 legados inferos.
    const gatedPorLinhagem = {
      abissal: ['dnd2024:spell:raio-nauseante', 'dnd2024:spell:paralisar-pessoa'],
      ctonico: ['dnd2024:spell:vitalidade-vazia', 'dnd2024:spell:raio-do-enfraquecimento'],
      infernal: ['dnd2024:spell:repreensao-diabolica', 'dnd2024:spell:escuridao'],
    };
    for (const [linhagem, [nivel3, nivel5]] of Object.entries(gatedPorLinhagem)) {
      const refs = {
        classRef: { id: 'dnd2024:class:guerreiro', packageVersion: '1.0.0' },
        speciesRef: { id: 'dnd2024:species:tiferino', packageVersion: '1.0.0' },
      };
      const choices = { 'legado-infero': [linhagem] };
      const em1 = magiasConcedidas(personagem({ level: 1, refs, choices }));
      assert.equal(em1.includes(nivel3), false, `${linhagem}: ${nivel3} não pode cair no nível 1`);
      assert.equal(em1.includes(nivel5), false, `${linhagem}: ${nivel5} não pode cair no nível 1`);

      const em5 = magiasConcedidas(personagem({ level: 5, refs, choices }));
      assert.equal(em5.includes(nivel3), true, `${linhagem}: ${nivel3} deveria valer no nível 5`);
      assert.equal(em5.includes(nivel5), true, `${linhagem}: ${nivel5} deveria valer no nível 5`);
    }
  });
});

describe('expansão de choice — classe e antecedente não colidem (NEW-2)', () => {
  const REFS = {
    classRef: { id: 'dnd2024:class:barbaro', packageVersion: '1.0.0' },
    backgroundRef: { id: 'dnd2024:background:artesao', packageVersion: '1.0.0' },
  };

  /** Mapa `sourceId -> ids de efeito expandido`, para provar de QUEM veio cada concessão. */
  function concessoesPorFonte(character) {
    const efeitos = collectCharacterEffects(character, contexto);
    assert.equal(efeitos.ok, true, JSON.stringify(efeitos.error ?? null));
    const porFonte = {};
    for (const entrada of efeitos.value) {
      if (!['grant-item', 'manual'].includes(entrada.effect.type)) {
        continue;
      }
      if (!entrada.effectInstanceId.includes('equipamento-inicial')) {
        continue;
      }
      (porFonte[entrada.sourceId] ??= []).push(entrada.effect.id ?? entrada.effect.type);
    }
    return porFonte;
  }

  test('cada fonte aplica a SUA opção quando as chaves são qualificadas por origem', () => {
    // `equipamento-inicial` é declarado pelas 12 classes E pelos 16
    // antecedentes, com os mesmos ids de opção (`opcao-a`/`opcao-b`).
    const alvo = personagem({
      refs: REFS,
      choices: { 'classe:equipamento-inicial': ['opcao-a'], 'antecedente:equipamento-inicial': ['opcao-b'] },
    });
    const porFonte = concessoesPorFonte(alvo);
    assert.equal((porFonte['dnd2024:class:barbaro'] ?? []).length > 0, true, 'a classe deve aplicar a opção A');
    assert.equal(
      (porFonte['dnd2024:background:artesao'] ?? []).length > 0,
      true,
      'o antecedente deve aplicar a opção B, independentemente da classe',
    );
  });

  test('as duas fontes podem escolher opções DIFERENTES e cada uma aplica a sua', () => {
    const aA = concessoesPorFonte(
      personagem({
        refs: REFS,
        choices: { 'classe:equipamento-inicial': ['opcao-a'], 'antecedente:equipamento-inicial': ['opcao-a'] },
      }),
    );
    const aB = concessoesPorFonte(
      personagem({
        refs: REFS,
        choices: { 'classe:equipamento-inicial': ['opcao-a'], 'antecedente:equipamento-inicial': ['opcao-b'] },
      }),
    );
    // A classe escolheu a MESMA opção nos dois casos: o que ela concede não
    // pode mudar por causa da escolha do antecedente.
    assert.deepEqual(aA['dnd2024:class:barbaro'], aB['dnd2024:class:barbaro']);
    // E o antecedente, que mudou de opção, tem de conceder coisas diferentes.
    assert.notDeepEqual(aA['dnd2024:background:artesao'], aB['dnd2024:background:artesao']);
  });

  test('a chave NUA ambígua não é aplicada a nenhuma das fontes', () => {
    // Antes: `equipamento-inicial: ['opcao-a']` aplicava a opção A na classe E
    // no antecedente ao mesmo tempo, e não havia como escolher A numa e B na
    // outra. Adivinhar uma das duas seria pior; a chave nua simplesmente não
    // identifica nada quando duas fontes declaram o mesmo `choiceId`.
    const porFonte = concessoesPorFonte(
      personagem({ refs: REFS, choices: { 'equipamento-inicial': ['opcao-a'] } }),
    );
    assert.deepEqual(porFonte, {});
  });

  test('a chave NUA continua valendo quando só UMA fonte declara o choiceId', () => {
    // `pericias-de-classe` só a classe declara — para ela a chave nua É a
    // identidade correta, e o comportamento não pode ter regredido.
    const alvo = personagem({
      refs: { classRef: REFS.classRef },
      choices: { 'pericias-de-classe': ['atletismo', 'intimidacao'] },
    });
    const efeitos = collectCharacterEffects(alvo, contexto);
    const pericias = efeitos.value
      .filter((entrada) => entrada.effect.type === 'proficiency' && entrada.effect.target.includes(':skill:'))
      .map((entrada) => entrada.effect.target);
    assert.deepEqual(pericias.sort(), ['dnd2024:skill:atletismo', 'dnd2024:skill:intimidacao']);
  });

  test('a chave prefixada por origem é a que a migração v1->v2 grava', () => {
    // `infra/character/migrations/v1-to-v2.js` grava `classe:<chave>` e
    // `antecedente:<chave>` — NUNCA a chave nua. Sem reconhecer esses
    // prefixos, a expansão não dispararia para nenhum personagem migrado do
    // baseline.
    const alvo = personagem({
      refs: { classRef: REFS.classRef },
      choices: { 'classe:pericias-de-classe': ['atletismo'] },
    });
    const efeitos = collectCharacterEffects(alvo, contexto);
    const pericias = efeitos.value
      .filter((entrada) => entrada.effect.type === 'proficiency' && entrada.effect.target.includes(':skill:'))
      .map((entrada) => entrada.effect.target);
    assert.deepEqual(pericias, ['dnd2024:skill:atletismo']);
  });
});

describe('expansão de choice — ausência e escolha órfã', () => {
  test('sem escolha registrada, nada é expandido (nenhuma opção padrão presumida)', () => {
    const semEscolha = personagem({
      refs: { classRef: { id: 'dnd2024:class:barbaro', packageVersion: '1.0.0' } },
      choices: {},
    });
    const efeitos = collectCharacterEffects(semEscolha, contexto);
    const pericias = efeitos.value.filter(
      (entrada) => entrada.effect.type === 'proficiency' && entrada.effect.target.includes(':skill:'),
    );
    assert.deepEqual(pericias, []);
  });

  test('escolha órfã (opção inexistente) não concede nada e não quebra a coleta', () => {
    const orfa = personagem({
      refs: { classRef: { id: 'dnd2024:class:barbaro', packageVersion: '1.0.0' } },
      choices: { 'pericias-de-classe': ['uma-pericia-que-nao-existe'] },
    });
    const efeitos = collectCharacterEffects(orfa, contexto);
    assert.equal(efeitos.ok, true, 'escolha legada órfã é dado, não exceção');
    const pericias = efeitos.value.filter(
      (entrada) => entrada.effect.type === 'proficiency' && entrada.effect.target.includes(':skill:'),
    );
    assert.deepEqual(pericias, []);
  });
});
