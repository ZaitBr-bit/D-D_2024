// Contrato de paridade das 11 espécies / 16 antecedentes / 75 talentos de
// D&D 2024 (Task 9).
//
// RED esperado antes desta tarefa: `dados/pacotes/dnd2024/{species,
// backgrounds,feats}/catalog.json` não existiam e
// `scripts/content/migrate-origins-feats.mjs` não existia —
// `construirCatalogos()` falhava ao importar o módulo, e todo teste abaixo
// listava as entidades ausentes. Comando: `node --test
// tests/contract/dnd2024-origins-feats.test.js`.
//
// A baseline usada para comparação
// (`tests/fixtures/expected/origins-feats-mechanics.json`) foi extraída
// INDEPENDENTEMENTE de `scripts/content/migrate-origins-feats.mjs` — direto
// de `dados/origens/especies.json`, `dados/origens/antecedentes.json` e
// `dados/talentos/talentos.json` — para que este teste não vire tautologia
// (migrate-origins-feats comparado consigo mesmo). Qualquer fato mecânico só
// é aceito aqui se vier de um campo ESTRUTURADO da entidade gerada
// (size/speed, effects[].target/damageType/resource/choice/prerequisites) —
// nunca de `description`/texto livre.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { construirCatalogos, verificarDrift } from '../../scripts/content/migrate-origins-feats.mjs';
import { validateEntity } from '../../site/js/content/validation.js';
import { parseContentId } from '../../site/js/core/content-id.js';
import { slugify } from '../../scripts/content/content-id-map.mjs';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

// Carregamento via TOP-LEVEL AWAIT (não `before()`): os corpos de
// `describe()` abaixo iteram sobre as chaves de `fixture` para GERAR os
// testes (não só para lê-las dentro de um `test()`), então os dados
// precisam existir antes de `describe()` ser avaliado — `describe()` roda
// de forma síncrona durante a carga do módulo, antes de qualquer hook
// `before()` assíncrono ter chance de resolver.
const fixture = JSON.parse(await readFile(path.join(repoRoot, 'tests', 'fixtures', 'expected', 'origins-feats-mechanics.json'), 'utf8'));
const idInventory = JSON.parse(await readFile(path.join(repoRoot, 'tests', 'fixtures', 'content', 'dnd2024-id-inventory.json'), 'utf8'));
const legacyEspecies = JSON.parse(await readFile(path.join(repoRoot, 'dados', 'origens', 'especies.json'), 'utf8')).especies;
const legacyAntecedentes = JSON.parse(await readFile(path.join(repoRoot, 'dados', 'origens', 'antecedentes.json'), 'utf8')).antecedentes;
const legacyTalentos = JSON.parse(await readFile(path.join(repoRoot, 'dados', 'talentos', 'talentos.json'), 'utf8')).todos;
const migrationScriptSource = await readFile(path.join(repoRoot, 'scripts', 'content', 'migrate-origins-feats.mjs'), 'utf8');

const catalogos = await construirCatalogos();
const speciesByName = new Map(catalogos.species.items.map((s) => [s.name, s]));
const backgroundsByName = new Map(catalogos.backgrounds.items.map((b) => [b.name, b]));
const featsByName = new Map(catalogos.feats.items.map((f) => [f.name, f]));

describe('migrate-origins-feats — legado tem exatamente 11/16/75 entradas (baseline independente)', () => {
  test('dados/origens/especies.json tem 11 espécies', () => {
    assert.equal(legacyEspecies.length, 11);
  });
  test('dados/origens/antecedentes.json tem 16 antecedentes', () => {
    assert.equal(legacyAntecedentes.length, 16);
  });
  test('dados/talentos/talentos.json tem 75 talentos', () => {
    assert.equal(legacyTalentos.length, 75);
  });
});

describe('migrate-origins-feats — contagens e ids do catálogo gerado', () => {
  test('11 espécies, 16 antecedentes, 75 talentos gerados', () => {
    assert.equal(catalogos.species.items.length, 11);
    assert.equal(catalogos.backgrounds.items.length, 16);
    assert.equal(catalogos.feats.items.length, 75);
  });

  test('todo id gerado é exatamente o id pré-reservado em dnd2024-id-inventory.json', () => {
    for (const [tipo, colecao] of [['species', catalogos.species], ['background', catalogos.backgrounds], ['feat', catalogos.feats]]) {
      const reservados = new Map(idInventory.reserved[tipo].map((e) => [e.name, e.id]));
      for (const item of colecao.items) {
        assert.ok(reservados.has(item.name), `${tipo} "${item.name}" não está reservado`);
        assert.equal(item.id, reservados.get(item.name));
        assert.equal(parseContentId(item.id).value.slug, slugify(item.name));
      }
    }
  });

  test('toda entidade valida contra seu schema concreto (species/background/feat)', () => {
    for (const colecao of [catalogos.species, catalogos.backgrounds, catalogos.feats]) {
      for (const item of colecao.items) {
        const resultado = validateEntity(item);
        assert.equal(resultado.valid, true, `${item.id}: ${JSON.stringify(resultado.errors)}`);
      }
    }
  });
});

describe('migrate-origins-feats — espécies: size/speed/sentidos/resistências (campos estruturados)', () => {
  for (const [nome, esperado] of Object.entries(fixture.species)) {
    test(`${nome}: size/speed batem com a baseline`, () => {
      const entity = speciesByName.get(nome);
      assert.ok(entity, `espécie "${nome}" ausente`);
      assert.equal(entity.size, esperado.size);
      assert.equal(entity.speed, esperado.speed);
    });

    test(`${nome}: visão no escuro (senses.darkvision) bate com a baseline`, () => {
      const entity = speciesByName.get(nome);
      const efeito = entity.effects.find((e) => e.type === 'modifier' && e.target === 'senses.darkvision' && !e.when);
      if (esperado.darkvision === null) {
        assert.equal(efeito, undefined, `${nome} não deveria ter visão no escuro base`);
      } else {
        assert.ok(efeito, `${nome} deveria ter efeito de visão no escuro`);
        assert.equal(efeito.value, esperado.darkvision);
      }
    });

    test(`${nome}: resistências (defense effects) batem com a baseline EM NOME, não só em contagem`, () => {
      const entity = speciesByName.get(nome);
      const resistencias = entity.effects.filter((e) => e.type === 'defense' && e.mode === 'resistance' && !e.when);
      assert.equal(resistencias.length, esperado.resistances.length, `${nome}: contagem de resistências base diverge`);
      // Tradução nome legado -> id de damage-type canônico, autorada de
      // forma independente do conversor (3 nomes divergem do rótulo do
      // ruleset: Elétrico->relampago, Gélido->frio, Ígneo->fogo,
      // Venenoso->veneno) — pega uma troca de tipo (ex.: Radiante por
      // Ígneo) que uma checagem só de tamanho de array deixaria passar.
      const idPorNomeLegado = { Ácido: 'acido', Elétrico: 'relampago', Gélido: 'frio', Ígneo: 'fogo', Necrótico: 'necrotico', Radiante: 'radiante', Trovejante: 'trovao', Venenoso: 'veneno', Psíquico: 'psiquico' };
      const idsEsperados = esperado.resistances.map((n) => `dnd2024:damage-type:${idPorNomeLegado[n]}`).sort();
      const idsGerados = resistencias.map((e) => e.damageType).sort();
      assert.deepEqual(idsGerados, idsEsperados, `${nome}: tipos de dano das resistências base divergem da baseline`);
    });

    test(`${nome}: choice de tamanho presente somente quando esperado`, () => {
      const entity = speciesByName.get(nome);
      const temEscolhaTamanho = entity.effects.some((e) => e.id === 'tamanho' && e.type === 'choice');
      assert.equal(temEscolhaTamanho, esperado.sizeChoice);
    });
  }
});

describe('migrate-origins-feats — cobertura explícita do brief (Draconato, Elfo, Gnomo, Golias, Humano, Tiferino, Kenku)', () => {
  for (const [nome, choiceIds] of Object.entries(fixture.speciesChoiceIds)) {
    test(`${nome}: choices estruturadas com ids esperados presentes`, () => {
      const entity = speciesByName.get(nome);
      assert.ok(entity, `espécie "${nome}" ausente`);
      const idsPresentes = new Set(entity.effects.filter((e) => e.type === 'choice').map((e) => e.id));
      for (const id of choiceIds) {
        assert.ok(idsPresentes.has(id), `${nome}: choice "${id}" ausente (ids presentes: ${[...idsPresentes].join(', ')})`);
      }
    });
  }

  test('Draconato: Herança Dracônica tem exatamente as 10 opções de dragão da tabela legada', () => {
    const entity = speciesByName.get('Draconato');
    const efeito = entity.effects.find((e) => e.id === 'heranca-draconica');
    assert.equal(efeito.choice.options.length, 10);
  });

  test('Elfo: Linhagem Élfica tem as 3 opções (Alto Elfo, Drow, Elfo Silvestre) com magias de nível 1/3/5 estruturadas', () => {
    const entity = speciesByName.get('Elfo');
    const efeito = entity.effects.find((e) => e.id === 'linhagem-elfica');
    assert.equal(efeito.choice.options.length, 3);
    const altoElfo = efeito.choice.options.find((o) => o.id === 'alto-elfo');
    const magiasNivel3 = altoElfo.grants.filter((g) => g.type === 'grant-spell' && g.when?.min === 3);
    const magiasNivel5 = altoElfo.grants.filter((g) => g.type === 'grant-spell' && g.when?.min === 5);
    assert.equal(magiasNivel3.length, 1);
    assert.equal(magiasNivel5.length, 1);
  });

  test('Gnomo: Linhagem Gnômica tem as 2 opções (Rochas, Bosque)', () => {
    const entity = speciesByName.get('Gnomo');
    const efeito = entity.effects.find((e) => e.id === 'linhagem-gnomica');
    assert.equal(efeito.choice.options.length, 2);
  });

  test('Golias: Ancestralidade Gigante tem as 6 opções de benefício', () => {
    const entity = speciesByName.get('Golias');
    const efeito = entity.effects.find((e) => e.id === 'ancestralidade-gigante');
    assert.equal(efeito.choice.options.length, 6);
  });

  test('Humano: Versátil concede talento de Origem à escolha via official-handler (não texto livre)', () => {
    const entity = speciesByName.get('Humano');
    const efeito = entity.effects.find((e) => e.id === 'versatil' && e.type === 'official-handler');
    assert.ok(efeito, 'efeito official-handler "versatil" ausente');
    assert.equal(efeito.handlerId, 'grant-feat');
    assert.equal(efeito.params.category, 'origin');
    assert.equal(efeito.params.playerChoice, true);
  });

  test('Tiferino: Legado Ínfero tem as 3 opções (Abissal, Ctônico, Infernal)', () => {
    const entity = speciesByName.get('Tiferino');
    const efeito = entity.effects.find((e) => e.id === 'legado-infero');
    assert.equal(efeito.choice.options.length, 3);
  });

  test('Kenku: Memória Kenku é uma escolha estruturada de 2 perícias entre as 18', () => {
    const entity = speciesByName.get('Kenku');
    const efeito = entity.effects.find((e) => e.id === 'memoria-kenku');
    assert.equal(efeito.choice.min, 2);
    assert.equal(efeito.choice.max, 2);
    assert.equal(efeito.choice.options.length, 18);
  });
});

describe('migrate-origins-feats — antecedentes: 3 atributos elegíveis, perícias, talento concedido', () => {
  for (const [nome, esperado] of Object.entries(fixture.backgrounds)) {
    test(`${nome}: abilityScoreOptions tem as 3 habilidades elegíveis da baseline`, () => {
      const entity = backgroundsByName.get(nome);
      assert.ok(entity, `antecedente "${nome}" ausente`);
      const esperadoIds = esperado.abilities.map((a) => `dnd2024:ability:${slugify(a)}`).sort();
      assert.deepEqual([...entity.abilityScoreOptions].sort(), esperadoIds);
    });

    test(`${nome}: choice de bônus de atributo tem 7 opções (6 permutações +2/+1, 1 opção +1/+1/+1)`, () => {
      const entity = backgroundsByName.get(nome);
      const efeito = entity.effects.find((e) => e.id === 'bonus-de-atributo');
      assert.ok(efeito, 'choice de bônus de atributo ausente');
      assert.equal(efeito.choice.options.length, 7);
    });

    test(`${nome}: 2 perícias fixas concedidas via efeito proficiency (não lista textual)`, () => {
      const entity = backgroundsByName.get(nome);
      const perícias = entity.effects.filter((e) => e.type === 'proficiency' && (e.id === 'pericia-1' || e.id === 'pericia-2')).map((e) => e.target);
      const esperadoIds = esperado.skills.map((s) => `dnd2024:skill:${slugify(s)}`).sort();
      assert.deepEqual([...perícias].sort(), esperadoIds);
    });

    test(`${nome}: talento de Origem concedido é uma referência ContentId estável, não o nome de exibição`, () => {
      const entity = backgroundsByName.get(nome);
      const efeito = entity.effects.find((e) => e.type === 'official-handler' && e.handlerId === 'grant-feat');
      assert.ok(efeito, 'efeito de concessão de talento ausente');
      const esperadoId = `dnd2024:feat:${slugify(esperado.grantedFeat)}`;
      assert.equal(efeito.params.featId, esperadoId);
      // Anti-regressão: nunca um texto de exibição solto no lugar de um id.
      assert.notEqual(efeito.params.featId, esperado.grantedFeat);
      assert.match(efeito.params.featId, /^dnd2024:feat:[a-z0-9-]+$/);
      if (esperado.presetSpellList) {
        assert.equal(efeito.params.presetChoices?.['lista-de-magias'], esperado.presetSpellList);
      }
    });
  }
});

describe('migrate-origins-feats — todas as instâncias de "Iniciado em Magia" (espécie Humano não conta, é talento livre; antecedentes Acólito/Guia/Sábio)', () => {
  test('o talento "Iniciado em Magia" existe uma única vez, com escolha estruturada de 3 listas de magia', () => {
    const entity = featsByName.get('Iniciado em Magia');
    assert.ok(entity);
    assert.equal(entity.repeatable, true);
    const efeito = entity.effects.find((e) => e.id === 'iniciado-em-magia-lista');
    assert.equal(efeito.choice.options.map((o) => o.id).sort().join(','), fixture.iniciadoEmMagiaSpellListOptions.slice().sort().join(','));
  });

  test('Acólito/Guia/Sábio referenciam Iniciado em Magia com a lista pré-selecionada correta (Clérigo/Druida/Mago)', () => {
    for (const [nome, lista] of [['Acólito', 'clerigo'], ['Guia', 'druida'], ['Sábio', 'mago']]) {
      const entity = backgroundsByName.get(nome);
      const efeito = entity.effects.find((e) => e.type === 'official-handler' && e.handlerId === 'grant-feat');
      assert.equal(efeito.params.featId, 'dnd2024:feat:iniciado-em-magia');
      assert.equal(efeito.params.presetChoices['lista-de-magias'], lista);
    }
  });
});

describe('migrate-origins-feats — talentos: categoria, repetibilidade, pré-requisitos, ASI (campos estruturados)', () => {
  test('contagem por categoria bate com a baseline', () => {
    const contagem = {};
    for (const item of catalogos.feats.items) contagem[item.category] = (contagem[item.category] ?? 0) + 1;
    assert.deepEqual(contagem, fixture.featCategoryCounts);
  });

  test('conjunto de talentos repetíveis bate com a baseline', () => {
    const repetiveis = catalogos.feats.items.filter((f) => f.repeatable === true).map((f) => f.name).sort();
    assert.deepEqual(repetiveis, [...fixture.repeatableFeats].sort());
  });

  for (const [nome, nivel] of Object.entries(fixture.featPrerequisiteLevel)) {
    test(`${nome}: pré-requisito de nível estruturado (conditionExpr), não texto`, () => {
      const entity = featsByName.get(nome);
      assert.ok(entity, `talento "${nome}" ausente`);
      const condicaoDeNivel = (entity.prerequisites ?? []).find((p) => p.kind === 'level');
      if (nivel === null) {
        assert.equal(condicaoDeNivel, undefined, `${nome} não deveria ter pré-requisito de nível`);
      } else {
        assert.ok(condicaoDeNivel, `${nome} deveria ter pré-requisito de nível ${nivel}`);
        assert.equal(condicaoDeNivel.min, nivel);
      }
    });
  }

  for (const [nome, habilidades] of Object.entries(fixture.featAsiAbilities)) {
    test(`${nome}: escolha de Aumento no Valor de Atributo tem exatamente as habilidades elegíveis da baseline`, () => {
      const entity = featsByName.get(nome);
      const efeito = entity.effects.find((e) => e.id === 'aumento-atributo');
      assert.ok(efeito, `${nome}: escolha "aumento-atributo" ausente`);
      const idsGerados = efeito.choice.options.map((o) => o.id).sort();
      const idsEsperados = habilidades.map((a) => slugify(a)).sort();
      assert.deepEqual(idsGerados, idsEsperados);
    });
  }

  test('talentos sem benefício de Aumento no Valor de Atributo não têm a escolha "aumento-atributo"', () => {
    for (const nome of fixture.featsWithoutAsi) {
      const entity = featsByName.get(nome);
      assert.ok(entity, `talento "${nome}" ausente`);
      const efeito = entity.effects.find((e) => e.id === 'aumento-atributo');
      assert.equal(efeito, undefined, `${nome} não deveria ter escolha de ASI`);
    }
  });

  test('nenhuma entidade de talento tem effects vazio (todo benefício legado vira ao menos um efeito)', () => {
    for (const item of catalogos.feats.items) {
      assert.ok(Array.isArray(item.effects) && item.effects.length > 0, `${item.id} sem effects`);
    }
  });

  test('TODOS os 75 talentos: o texto de pré-requisito legado é recuperável de algo estruturado/descoberto na entidade gerada, para todo talento com prerequisito não-vazio', () => {
    // Fecha o gap encontrado na revisão: os 10 talentos de Estilo de Luta
    // (Arquearia, Combate Desarmado, Combate com Armas Grandes, Combate com
    // Armas de Arremesso, Combate com Duas Armas, Defensivo, Duelismo,
    // Interceptação, Luta às Cegas, Protetivo) têm `descricao` própria (não
    // o placeholder genérico), então a lógica antiga nunca injetava o texto
    // de pré-requisito ("Característica de Estilo de Luta") em lugar
    // NENHUM da entidade gerada — nem em `prerequisites` (não é nível), nem
    // em `description` (não era o caso coberto), nem em nenhum efeito.
    // Este teste varre os 75 e falha se isso puder acontecer de novo, em
    // qualquer talento, não só nos 10 já conhecidos.
    for (const legado of legacyTalentos) {
      if (!legado.prerequisito) continue;
      const entity = featsByName.get(legado.nome);
      assert.ok(entity, `talento "${legado.nome}" ausente`);
      const emDescription = typeof entity.description === 'string' && entity.description.includes(legado.prerequisito);
      const emManual = (entity.effects ?? []).some((e) => e.type === 'manual' && typeof e.text === 'string' && e.text.includes(legado.prerequisito));
      const emPrerequisitesNivel = legado.prerequisito.includes('Nível') && (entity.prerequisites ?? []).some((p) => p.kind === 'level');
      assert.ok(
        emDescription || emManual || emPrerequisitesNivel,
        `${legado.nome}: pré-requisito legado "${legado.prerequisito}" não aparece em description, em nenhum efeito manual, nem em prerequisites — seria perdido silenciosamente`,
      );
    }
  });
});

describe('migrate-origins-feats — integridade estrutural: nenhum id de efeito de topo duplicado dentro da mesma entidade', () => {
  // Escopo: `entity.effects[].id` — o único nível em que id é usado para
  // lookup (`entity.effects.find(e => e.id === ...)`) em todo o código e
  // nos testes; a revisão encontrou 3 casos reais (humano/versatil,
  // tiferino/presenca-sobrenatural, kenku/memoria-kenku) que passavam batido
  // porque `.find()` resolve no primeiro match e nenhum teste conferia
  // unicidade. IDs repetidos entre opções IRMÃS e mutuamente exclusivas de
  // um mesmo `choice` (ex.: cada opção de herança dracônica reusar
  // "resistencia-a-dano-heranca") não são cobertos aqui de propósito — não
  // colidem em nenhum lookup real e são o mesmo padrão já usado por
  // `migrate-classes.mjs`.
  test('todo id de effects[] de topo é único dentro de cada entidade (species/background/feat)', () => {
    for (const colecao of [catalogos.species, catalogos.backgrounds, catalogos.feats]) {
      for (const item of colecao.items) {
        const ids = (item.effects ?? []).map((e) => e.id).filter((id) => id !== undefined);
        const vistos = new Set();
        for (const id of ids) {
          assert.ok(!vistos.has(id), `${item.id}: id de efeito de topo duplicado "${id}"`);
          vistos.add(id);
        }
      }
    }
  });
});

describe('migrate-origins-feats — anti-inferência: rejeita extração runtime de deslocamento/tamanho por regex, talento por nome e escolha a partir de descrição', () => {
  test('a description armazenada da espécie NÃO contém "Deslocamento"/"Tamanho:" — logo speed/size não podem ter sido extraídos dela em runtime', () => {
    for (const item of catalogos.species.items) {
      assert.doesNotMatch(item.description, /Deslocamento/i, `${item.id}: description contém "Deslocamento" — speed poderia estar sendo lido da prosa`);
      assert.doesNotMatch(item.description, /Tamanho:/i, `${item.id}: description contém "Tamanho:" — size poderia estar sendo lido da prosa`);
    }
  });

  test('speed é sempre um number, size sempre um enum fechado (nunca strings livres tipo "9 metros")', () => {
    for (const item of catalogos.species.items) {
      assert.equal(typeof item.speed, 'number');
      assert.ok(['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan'].includes(item.size));
    }
  });

  test('talento concedido por antecedente é sempre um ContentId (namespace:feat:slug), nunca resolvido por nome em runtime', () => {
    for (const item of catalogos.backgrounds.items) {
      const efeito = item.effects.find((e) => e.type === 'official-handler' && e.handlerId === 'grant-feat');
      assert.ok(efeito.params.featId, `${item.id}: grant-feat sem featId`);
      assert.match(efeito.params.featId, /^[a-z0-9-]+:feat:[a-z0-9-]+$/, `${item.id}: featId não é um ContentId (parece nome de exibição?)`);
    }
  });

  test('toda opção de choice tem um "id" kebab-case estável, nunca o texto do label usado como identificador', () => {
    function verificarChoices(effects, contexto) {
      for (const efeito of effects ?? []) {
        if (efeito.type === 'choice') {
          for (const opcao of efeito.choice.options) {
            assert.match(opcao.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `${contexto}: opção "${opcao.id}" não é kebab-case`);
            assert.notEqual(opcao.id, opcao.label, `${contexto}: id da opção não pode ser igual ao label de exibição`);
            verificarChoices(opcao.grants, `${contexto}>${opcao.id}`);
          }
        }
      }
    }
    for (const colecao of [catalogos.species, catalogos.backgrounds, catalogos.feats]) {
      for (const item of colecao.items) verificarChoices(item.effects, item.id);
    }
  });

  test('o script de migração nunca usa "descricao" como operando de exec/match/test de regex, em NENHUMA forma de chamada', () => {
    // Cobre as DUAS formas de chamar um regex em JS — `algo.descricao.match(/re/)`
    // (método no receiver) E a forma "receiver primeiro" que o próprio
    // script usa em outros contextos, `/re/.exec(algo.descricao)` — uma
    // checagem que só olhasse para `.descricao.exec(`/`.descricao.match(`
    // não pegaria a segunda forma (é exatamente essa lacuna que a revisão
    // encontrou: o script já usa `/.../.exec(legado.prerequisito ?? '')`
    // para nível, e um `/Deslocamento (\d+)/.exec(legado.descricao)`
    // hipotético — a extração-por-regex-de-prosa que o brief manda
    // rejeitar — passaria batido pela checagem antiga). Verifica LINHA A
    // LINHA: qualquer linha que chame `.exec(`/`.match(`/`.test(` E também
    // contenha o identificador `descricao` (em qualquer posição da linha,
    // de qualquer lado da chamada) falha o teste.
    // MUDANÇA CONSCIENTE (Task 23b): antes esta linha era um
    // `doesNotMatch(/texto_completo/)` — a mera menção ao campo reprovava. A
    // Task 23b passou a COPIAR `texto_completo` verbatim para
    // `species.legacyPresentation` (dívida temporária declarada no schema),
    // então a proibição foi estreitada para o que ela sempre quis dizer:
    // `texto_completo` não pode ser OPERANDO de extração. Cópia literal é
    // permitida; fatiar, casar ou dividir a prosa continua reprovando.
    const OPERACOES_DE_EXTRACAO = /\.(exec|match|matchAll|test|split|replace|indexOf|search|slice|substring)\(/;
    const linhasComTextoCompleto = migrationScriptSource
      .split('\n')
      .map((linha, i) => ({ linha, numero: i + 1 }))
      .filter(({ linha }) => /\btexto_completo\b/.test(linha) && OPERACOES_DE_EXTRACAO.test(linha));
    assert.deepEqual(
      linhasComTextoCompleto.map((v) => `linha ${v.numero}: ${v.linha.trim()}`),
      [],
      'migração pode copiar "texto_completo" verbatim, mas nunca extrair fato mecânico dele',
    );
    const linhas = migrationScriptSource.split('\n');
    const chamadaRegex = /\.(exec|match|test)\(/;
    const usaDescricao = /\bdescricao\b/;
    const violacoes = linhas
      .map((linha, i) => ({ linha, numero: i + 1 }))
      .filter(({ linha }) => chamadaRegex.test(linha) && usaDescricao.test(linha));
    assert.deepEqual(
      violacoes.map((v) => `linha ${v.numero}: ${v.linha.trim()}`),
      [],
      'migração não deve extrair fatos mecânicos com regex usando "descricao" como operando (em nenhuma forma de chamada)',
    );
  });
});

describe('migrate-origins-feats — drift: catálogos e fragmento de índice commitados refletem o conversor', () => {
  test('node scripts/content/migrate-origins-feats.mjs --check não reporta divergência', async () => {
    const { ok, diffs } = await verificarDrift(catalogos);
    assert.equal(ok, true, diffs.join('\n'));
  });
});

// --- Task 15: espécie/antecedente/talento não têm ladder de nível ----------
//
// `origins-feats-mechanics.json#nonStackingEffects` afirma que estes catálogos
// não têm NENHUM grupo de efeitos que se substitua por faixa de nível, e que os
// dois únicos alvos de `modifier set` compartilhados entre entidades continuam
// determinísticos sem `stackKey`. Estes testes reexecutam a verificação em vez
// de confiar no comentário do fixture: se um ladder aparecer no futuro sem
// `stackKey`, a suíte falha.

describe('migrate-origins-feats — Task 15: empilhamento de efeitos', () => {
  const catalogosPorTipo = [
    ['species', catalogos.species],
    ['backgrounds', catalogos.backgrounds],
    ['feats', catalogos.feats],
  ];

  test('nenhuma entidade declara dois efeitos do mesmo recurso/alvo (nenhum ladder a marcar)', () => {
    const duplicados = [];
    for (const [, catalogo] of catalogosPorTipo) {
      for (const item of catalogo.items) {
        const contagem = new Map();
        for (const effect of item.effects ?? []) {
          const chave =
            effect.type === 'resource'
              ? `resource:${effect.resource}`
              : effect.type === 'modifier'
                ? `modifier:${effect.target}`
                : null;
          if (chave === null) continue;
          contagem.set(chave, (contagem.get(chave) ?? 0) + 1);
        }
        for (const [chave, total] of contagem) {
          if (total > 1) duplicados.push(`${item.id} ${chave} x${total}`);
        }
      }
    }
    assert.deepStrictEqual(duplicados, []);
    assert.deepStrictEqual(fixture.nonStackingEffects.resourceLadders, {});
    assert.deepStrictEqual(fixture.nonStackingEffects.modifierLadders, {});
  });

  test('nenhum recurso concedido repete entre entidades (dois `max` da mesma chave nunca coexistem)', () => {
    const porRecurso = new Map();
    for (const [, catalogo] of catalogosPorTipo) {
      for (const item of catalogo.items) {
        for (const effect of item.effects ?? []) {
          if (effect.type !== 'resource') continue;
          if (!porRecurso.has(effect.resource)) porRecurso.set(effect.resource, []);
          porRecurso.get(effect.resource).push(item.id);
        }
      }
    }
    const repetidos = [...porRecurso.entries()].filter(([, ids]) => ids.length > 1);
    assert.deepStrictEqual(repetidos, []);
  });

  test('os alvos de `set` compartilhados entre entidades batem com o levantamento e não precisam de stackKey', () => {
    const compartilhados = fixture.nonStackingEffects.sharedSetTargets;
    const observado = new Map();
    for (const [tipo, catalogo] of catalogosPorTipo) {
      for (const item of catalogo.items) {
        for (const effect of item.effects ?? []) {
          if (effect.type !== 'modifier' || effect.operation !== 'set') continue;
          if (!observado.has(effect.target)) observado.set(effect.target, []);
          observado.get(effect.target).push({ tipo, id: item.id, value: effect.value });
        }
      }
    }
    const observadosCompartilhados = [...observado.entries()]
      .filter(([, lista]) => lista.length > 1)
      .map(([alvo]) => alvo)
      .sort();
    assert.deepStrictEqual(observadosCompartilhados, Object.keys(compartilhados).sort());

    for (const [alvo, esperado] of Object.entries(compartilhados)) {
      const lista = observado.get(alvo);
      const valores = [...new Set(lista.map((entrada) => entrada.value))].sort((a, b) => a - b);
      assert.deepStrictEqual(valores, esperado.distinctValues, `valores de ${alvo} divergem do baseline`);
      assert.strictEqual(esperado.requiresStackKey, false);
      // Nenhum efeito destes alvos carrega stackKey: a ausência é o contrato.
      for (const entrada of lista) {
        assert.strictEqual(entrada.tipo === 'species' ? 'species' : 'feats', esperado.sourceType === 'species' ? 'species' : 'feats');
      }
      // Um `set` só é seguro sem stackKey se (a) as fontes são mutuamente
      // exclusivas (uma espécie por personagem) ou (b) todos os valores são
      // iguais (dois `set` idênticos não conflitam).
      const mutuamenteExclusivas = esperado.sourceType === 'species';
      assert.ok(
        mutuamenteExclusivas || valores.length === 1,
        `${alvo}: sem stackKey, ou as fontes são exclusivas ou os valores devem ser idênticos`,
      );
    }
  });

  test('nenhum efeito destes catálogos carrega priority/stackKey/stackable', () => {
    const marcados = [];
    for (const [, catalogo] of catalogosPorTipo) {
      for (const item of catalogo.items) {
        for (const effect of item.effects ?? []) {
          for (const campo of ['priority', 'stackKey', 'stackable']) {
            if (Object.prototype.hasOwnProperty.call(effect, campo)) {
              marcados.push(`${item.id} ${effect.id ?? effect.type}.${campo}`);
            }
          }
        }
      }
    }
    assert.deepStrictEqual(marcados, []);
  });
});
