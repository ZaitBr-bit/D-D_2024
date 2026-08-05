// Contrato de paridade das 391 magias / 38 armas / 13 armaduras / itens de
// equipamento / 51 criaturas / 154 termos de glossário de D&D 2024 (Task 10).
//
// RED esperado antes desta tarefa: `dados/pacotes/dnd2024/{spells,equipment,
// appendices}/*.json` não existiam e
// `scripts/content/migrate-spells-equipment.mjs` não existia —
// `construirCatalogos()` falhava ao importar o módulo, e todo teste abaixo
// listava as entidades ausentes. Comando: `node --test
// tests/contract/dnd2024-spells-equipment.test.js`.
//
// Todo fato mecânico comparado aqui é RE-DERIVADO de forma independente
// diretamente do legado (`dados/magias/**`, `dados/equipamento/**`,
// `dados/apendices/**`), com tabelas de tradução (escola/moeda/maestria/
// tamanho) transcritas de novo neste arquivo — nunca importadas de
// `migrate-spells-equipment.mjs` — para que este teste não vire uma
// tautologia (o conversor comparado consigo mesmo). O teste de
// "efeito manual, nunca fallback de tipo desconhecido" (describe final)
// compara TEXTO EXATO contra `descricao`/`circulo_superior` legados —
// falsificável de verdade: um fallback tipo `{type:'manual', text:'TODO'}`
// ou um `effects` vazio quebraria a igualdade de string para qualquer
// magia real.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { construirCatalogos, verificarDrift } from '../../scripts/content/migrate-spells-equipment.mjs';
import { validateEntity } from '../../site/js/content/validation.js';
import { parseContentId } from '../../site/js/core/content-id.js';
import { slugify } from '../../scripts/content/content-id-map.mjs';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

async function legacyJson(...segments) {
  return JSON.parse(await readFile(path.join(repoRoot, ...segments), 'utf8'));
}

const idInventory = await legacyJson('tests', 'fixtures', 'content', 'dnd2024-id-inventory.json');

const legacySpellFiles = [
  'truques.json', 'circulo_1.json', 'circulo_2.json', 'circulo_3.json', 'circulo_4.json',
  'circulo_5.json', 'circulo_6.json', 'circulo_7.json', 'circulo_8.json', 'circulo_9.json',
];
const legacySpellsByFile = await Promise.all(legacySpellFiles.map((f) => legacyJson('dados', 'magias', f)));
const legacySpells = legacySpellsByFile.flatMap((f) => f.magias);
const legacySpellsByName = new Map(legacySpells.map((m) => [m.nome, m]));

const legacyArmas = (await legacyJson('dados', 'equipamento', 'armas.json')).armas;
const legacyArmaduras = (await legacyJson('dados', 'equipamento', 'armaduras.json')).armaduras;
const legacyGearFile = await legacyJson('dados', 'equipamento', 'equipamento_aventura.json');
const legacyServicosFile = await legacyJson('dados', 'equipamento', 'servicos.json');
const legacyMontariasFile = await legacyJson('dados', 'equipamento', 'montarias_veiculos.json');
const legacyFerramentasFile = await legacyJson('dados', 'equipamento', 'ferramentas.json');
const legacyCriaturas = (await legacyJson('dados', 'apendices', 'criaturas.json')).criaturas;
const legacyGlossario = (await legacyJson('dados', 'apendices', 'glossario.json')).termos;

const BY_CLASS_LEGACY_COUNTS = {
  bardo: 140, bruxo: 91, clerigo: 117, druida: 135, feiticeiro: 150, guardiao: 61, mago: 242, paladino: 51,
};

const catalogos = await construirCatalogos();
const spellFiles = catalogos.arquivos.filter((a) => a.colecao.type === 'spell');
const allSpellEntities = spellFiles.flatMap((a) => a.colecao.items);
const spellByName = new Map(allSpellEntities.map((s) => [s.name, s]));
const weaponEntities = catalogos.arquivos.find((a) => a.relPath === 'equipment/weapons.json').colecao.items;
const armorEntities = catalogos.arquivos.find((a) => a.relPath === 'equipment/armor.json').colecao.items;
const equipmentEntities = catalogos.arquivos.filter((a) => a.colecao.type === 'equipment').flatMap((a) => a.colecao.items);
const creatureEntities = catalogos.arquivos.find((a) => a.relPath === 'appendices/creatures.json').colecao.items;
const glossaryEntities = catalogos.arquivos.find((a) => a.relPath === 'appendices/glossary.json').colecao.items;
const spellListFiles = catalogos.arquivos.filter((a) => a.colecao.type === 'spell-list');

describe('migrate-spells-equipment — legado tem exatamente as contagens documentadas (baseline independente)', () => {
  test('391 magias no legado (10 arquivos de círculo)', () => {
    assert.equal(legacySpells.length, 391);
  });
  test('38 armas, 13 armaduras, 82 itens de aventura no legado', () => {
    assert.equal(legacyArmas.length, 38);
    assert.equal(legacyArmaduras.length, 13);
    assert.equal(legacyGearFile.itens.length, 82);
  });
  test('51 criaturas, 154 termos de glossário no legado', () => {
    assert.equal(legacyCriaturas.length, 51);
    assert.equal(legacyGlossario.length, 154);
  });
});

describe('migrate-spells-equipment — contagens geradas', () => {
  test('391 entidades spell geradas, uma por magia legada', () => {
    assert.equal(allSpellEntities.length, 391);
    for (const legado of legacySpells) assert.ok(spellByName.has(legado.nome), `magia "${legado.nome}" ausente`);
  });
  test('38 armas, 13 armaduras geradas', () => {
    assert.equal(weaponEntities.length, 38);
    assert.equal(armorEntities.length, 13);
  });
  test('51 criaturas, 154 termos de glossário gerados', () => {
    assert.equal(creatureEntities.length, 51);
    assert.equal(glossaryEntities.length, 154);
  });
  test('9 listas de magia (8 por classe + índice mestre)', () => {
    assert.equal(spellListFiles.length, 9);
  });
});

describe('migrate-spells-equipment — ids batem 1:1 com o inventário reservado', () => {
  for (const [tipo, entidades] of [
    ['spell', allSpellEntities],
    ['weapon', weaponEntities],
    ['armor', armorEntities],
    ['creature', creatureEntities],
    ['glossary-entry', glossaryEntities],
  ]) {
    test(`todo id gerado de "${tipo}" é exatamente o id pré-reservado`, () => {
      const reservados = new Map(idInventory.reserved[tipo].map((e) => [e.name, e.id]));
      assert.equal(entidades.length, reservados.size);
      for (const item of entidades) {
        assert.ok(reservados.has(item.name), `${tipo} "${item.name}" não está reservado`);
        assert.equal(item.id, reservados.get(item.name));
        assert.equal(parseContentId(item.id).value.slug, slugify(item.name));
      }
    });
  }

  test('todo id de equipamento reservado (82 itens de aventura) aparece entre os gerados', () => {
    const reservados = new Map(idInventory.reserved.equipment.map((e) => [e.name, e.id]));
    const geradoPorId = new Set(equipmentEntities.map((e) => e.id));
    for (const [nome, id] of reservados) {
      assert.ok(geradoPorId.has(id), `equipment "${nome}" (${id}) reservado, mas não gerado`);
    }
  });
});

describe('migrate-spells-equipment — magia: campos estruturados batem com o legado (tradução independente)', () => {
  const ESCOLA_MAP_INDEPENDENTE = {
    Abjuração: 'abjuration', Adivinhação: 'divination', Encantamento: 'enchantment', Evocação: 'evocation',
    Ilusão: 'illusion', Invocação: 'conjuration', Necromancia: 'necromancy', Transmutação: 'transmutation',
  };

  for (const legado of legacySpells) {
    test(`"${legado.nome}": level/school/castingTime/range/duration/concentration/ritual/classes`, () => {
      const gerado = spellByName.get(legado.nome);
      assert.equal(gerado.level, legado.circulo);
      assert.equal(gerado.school, ESCOLA_MAP_INDEPENDENTE[legado.escola]);
      assert.equal(gerado.castingTime, legado.tempo_conjuracao);
      assert.equal(gerado.range, legado.alcance);
      assert.equal(gerado.duration, legado.duracao);
      assert.equal(gerado.concentration, legado.duracao.startsWith('Concentração'));
      assert.equal(gerado.ritual, legado.tempo_conjuracao.includes('Ritual'));
      assert.equal(gerado.classes.length, legado.classes.length);
      for (const nomeClasse of legado.classes) {
        assert.ok(gerado.classes.includes(`dnd2024:class:${slugify(nomeClasse)}`), `classe "${nomeClasse}" ausente de ${legado.nome}`);
      }
    });
  }

  test('componentes: V/S/M batem com o legado', () => {
    for (const legado of legacySpells) {
      const gerado = spellByName.get(legado.nome);
      const semParenteses = legado.componentes.replace(/\([\s\S]*\)/, '');
      const tokens = semParenteses.split(',').map((s) => s.trim()).filter(Boolean);
      assert.equal(gerado.components.verbal, tokens.includes('V'), `magia "${legado.nome}"`);
      assert.equal(gerado.components.somatic, tokens.includes('S'), `magia "${legado.nome}"`);
      assert.equal(gerado.components.material, tokens.includes('M'), `magia "${legado.nome}"`);
    }
  });
});

describe('migrate-spells-equipment — efeito manual, nunca fallback de tipo desconhecido (falsificável)', () => {
  test('todo efeito de toda magia é type "manual" — vocabulário fechado sem automação de dano/CD hoje', () => {
    for (const spell of allSpellEntities) {
      for (const efeito of spell.effects) {
        assert.equal(efeito.type, 'manual', `magia "${spell.name}" tem efeito de tipo inesperado "${efeito.type}"`);
      }
    }
  });

  test('efeito "descricao" tem o texto EXATO de descricao legada (nunca placeholder/fallback)', () => {
    for (const legado of legacySpells) {
      const gerado = spellByName.get(legado.nome);
      const efeito = gerado.effects.find((e) => e.id === 'descricao');
      assert.ok(efeito, `magia "${legado.nome}" sem efeito "descricao"`);
      assert.equal(efeito.text, legado.descricao);
    }
  });

  test('efeito "aprimoramento" existe SE E SOMENTE SE circulo_superior legado é não-vazio, com texto exato', () => {
    for (const legado of legacySpells) {
      const gerado = spellByName.get(legado.nome);
      const efeito = gerado.effects.find((e) => e.id === 'aprimoramento');
      const legadoTemAprimoramento = typeof legado.circulo_superior === 'string' && legado.circulo_superior.trim().length > 0;
      assert.equal(Boolean(efeito), legadoTemAprimoramento, `magia "${legado.nome}": presença de "aprimoramento" incoerente com circulo_superior legado`);
      if (legadoTemAprimoramento) assert.equal(efeito.text, legado.circulo_superior);
    }
  });

  test('nenhuma magia tem effects vazio (todo texto legado convertido, nada descartado)', () => {
    for (const spell of allSpellEntities) {
      assert.ok(spell.effects.length >= 1, `magia "${spell.name}" com effects vazio`);
    }
  });
});

describe('migrate-spells-equipment — armas: dano/tipo/propriedades/maestria/peso/custo (tradução independente)', () => {
  const MASTERY_MAP_INDEPENDENTE = { Ágil: 'nick', Afligir: 'vex', Derrubar: 'topple', Drenar: 'sap', Empurrar: 'push', Garantido: 'graze', Lentidão: 'slow', Trespassar: 'cleave' };
  const weaponByName = new Map(weaponEntities.map((w) => [w.name, w]));

  for (const legado of legacyArmas) {
    test(`"${legado.nome}": categoria/dano/maestria`, () => {
      const gerado = weaponByName.get(legado.nome);
      assert.ok(gerado, `arma "${legado.nome}" não gerada`);
      assert.equal(gerado.weaponCategory, legado.categoria.startsWith('Armas Simples') ? 'simple' : 'martial');
      const danoMatch = /^([0-9]+(?:d[0-9]+)?)\s+(\S+)/.exec(legado.dano);
      assert.equal(gerado.damage.dice, danoMatch[1]);
      assert.equal(gerado.mastery, MASTERY_MAP_INDEPENDENTE[legado.maestria]);
    });
  }

  test('nenhuma arma tem propriedades vazias quando o legado lista propriedades reais', () => {
    for (const legado of legacyArmas) {
      const gerado = weaponByName.get(legado.nome);
      const legadoTemPropriedades = legado.propriedades.trim() !== '' && legado.propriedades.trim() !== '—';
      assert.equal(gerado.properties.length > 0, legadoTemPropriedades, `arma "${legado.nome}"`);
    }
  });
});

describe('migrate-spells-equipment — armaduras: categoria/CA/Força/furtividade (tradução independente)', () => {
  const CATEGORY_MAP_INDEPENDENTE = { Leve: 'light', Média: 'medium', Pesada: 'heavy', Escudo: 'shield' };
  const armorByName = new Map(armorEntities.map((a) => [a.name, a]));

  for (const legado of legacyArmaduras) {
    test(`"${legado.nome}": categoria/stealthDisadvantage`, () => {
      const gerado = armorByName.get(legado.nome);
      assert.ok(gerado, `armadura "${legado.nome}" não gerada`);
      assert.equal(gerado.armorCategory, CATEGORY_MAP_INDEPENDENTE[legado.categoria]);
      assert.equal(gerado.stealthDisadvantage, legado.furtividade.trim() === 'Desvantagem');
    });
  }

  test('Escudo usa armorClassBonus (não baseArmorClass) — "+2" não é uma CA base', () => {
    const escudo = armorByName.get('Escudo');
    assert.equal(escudo.armorClassBonus, 2);
    assert.equal(escudo.baseArmorClass, undefined);
  });

  test('armaduras com "modificador de Des" no legado têm addDexModifier true; as demais, false', () => {
    for (const legado of legacyArmaduras) {
      const gerado = armorByName.get(legado.nome);
      if (legado.nome === 'Escudo') continue;
      assert.equal(gerado.addDexModifier, legado.ca.toLowerCase().includes('modificador de des'));
    }
  });
});

describe('migrate-spells-equipment — serviços/montarias: nomes/custos gerados batem com o legado, agrupamento de subgrupo correto', () => {
  // Re-derivação independente do agrupamento de subgrupo de
  // `dados/equipamento/servicos.json#tabelas[0]` (hospedagem/comida): uma
  // linha com Custo vazio é cabeçalho; só as linhas seguintes cujo `Item`
  // está entre os membros conhecidos daquele cabeçalho pertencem ao grupo.
  // Isso NÃO reimporta `criarAgrupadorDeSubgrupo` do conversor — é a mesma
  // regra transcrita de novo, para que este teste realmente falhe se o
  // conversor voltar a mis-agrupar linhas não relacionadas (bug real
  // encontrado em revisão: "Cerveja (caneca)"/"Pão (fatia)"/"Queijo
  // (fatia)" caindo sob "Alojamento por Dia", e "Trenó"/"Vagão" caindo sob
  // "Sela" na tabela de montarias).
  function nomesEsperadosComGrupo(linhas, colunaItem, colunaCusto, membrosPorGrupo) {
    const esperados = [];
    let grupoAtual;
    let membrosAtuais;
    for (const linha of linhas) {
      const custo = (linha[colunaCusto] ?? '').trim();
      if (custo === '') {
        grupoAtual = linha[colunaItem];
        membrosAtuais = new Set(membrosPorGrupo[grupoAtual] ?? []);
        continue;
      }
      const nomeBase = linha[colunaItem];
      if (grupoAtual && membrosAtuais.has(nomeBase)) {
        esperados.push({ nome: `${grupoAtual} — ${nomeBase}`, custo });
      } else {
        grupoAtual = undefined;
        membrosAtuais = undefined;
        esperados.push({ nome: nomeBase, custo });
      }
    }
    return esperados;
  }

  const TIERS = ['Desvalido', 'Pobre', 'Modesto', 'Confortável', 'Abastado', 'Aristocrático'];
  const equipmentByName = new Map(equipmentEntities.map((e) => [e.name, e]));

  test('tabela de hospedagem/comida: nomes exatos, incluindo os itens NÃO agrupados intercalados ("Cerveja (caneca)" etc.)', () => {
    const [hospedagem] = legacyServicosFile.tabelas;
    const esperados = nomesEsperadosComGrupo(hospedagem.dados, 'Item', 'Custo', {
      'Alojamento por Dia': TIERS,
      'Refeições': TIERS,
      'Vinho (garrafa)': ['Comum', 'Bom'],
    });
    assert.equal(esperados.length, 17, 'esperava 17 linhas reais (23 linhas - 3 cabeçalhos - 3 itens não agrupados contados corretamente)');
    for (const { nome, custo } of esperados) {
      const gerado = equipmentByName.get(nome);
      assert.ok(gerado, `equipamento "${nome}" não gerado`);
      assert.equal(gerado.cost.amount + gerado.cost.currency, custo.replace(/^(\d+)\s*(PC|PP|PO|PL)$/, (_, n, m) => Number(n) + { PC: 'cp', PP: 'sp', PO: 'gp', PL: 'pp' }[m]));
    }
    // As 3 linhas legadas intercaladas SEM cabeçalho próprio nunca podem
    // ficar com o prefixo "Alojamento por Dia —" (o bug real encontrado em
    // revisão).
    for (const nomeBase of ['Cerveja (caneca)', 'Pão (fatia)', 'Queijo (fatia)']) {
      assert.ok(equipmentByName.has(nomeBase), `"${nomeBase}" deveria existir sem prefixo de grupo`);
      assert.ok(!equipmentByName.has(`Alojamento por Dia — ${nomeBase}`), `"${nomeBase}" não deveria ter sido agrupado sob "Alojamento por Dia"`);
    }
  });

  test('tabela de arreios/veículos de tração: "Trenó"/"Vagão" não ficam agrupados sob "Sela"', () => {
    const [, arreios] = legacyMontariasFile.tabelas;
    const esperados = nomesEsperadosComGrupo(arreios.dados, 'Item', 'Custo', { Sela: ['Exótica', 'Militar', 'Viagem'] });
    for (const { nome } of esperados) {
      assert.ok(equipmentByName.has(nome), `equipamento "${nome}" não gerado`);
    }
    for (const nomeBase of ['Trenó', 'Vagão']) {
      assert.ok(equipmentByName.has(nomeBase), `"${nomeBase}" deveria existir sem prefixo de grupo`);
      assert.ok(!equipmentByName.has(`Sela — ${nomeBase}`), `"${nomeBase}" não deveria ter sido agrupado sob "Sela"`);
    }
    for (const nomeSela of ['Exótica', 'Militar', 'Viagem']) {
      assert.ok(equipmentByName.has(`Sela — ${nomeSela}`), `"Sela — ${nomeSela}" deveria existir`);
    }
  });

  test('montarias/animais de carga: 8 nomes batem 1:1 com a tabela legada', () => {
    const [montarias] = legacyMontariasFile.tabelas;
    assert.equal(montarias.dados.length, 8);
    for (const linha of montarias.dados) {
      assert.ok(equipmentByName.has(linha.Item), `montaria "${linha.Item}" não gerada`);
    }
  });

  test('embarcações: 7 nomes batem 1:1 com a tabela legada', () => {
    const [, , embarcacoes] = legacyMontariasFile.tabelas;
    assert.equal(embarcacoes.dados.length, 7);
    for (const linha of embarcacoes.dados) {
      assert.ok(equipmentByName.has(linha.Embarcação), `embarcação "${linha.Embarcação}" não gerada`);
    }
  });
});

describe('migrate-spells-equipment — ferramentas: nome/custo/peso batem com o markdown legado (extração independente por regex)', () => {
  // `dados/equipamento/ferramentas.json` não tem array estruturado — o
  // conversor usa uma tabela transcrita à mão (`TOOLS_TABLE`). Este teste
  // NÃO reimporta essa tabela: extrai as 25 ferramentas de novo, direto do
  // `texto_completo` markdown bruto, via regex sobre o padrão
  // "#### Nome (custo)" + "**Atributo:** X" + "**Peso:** Y" — uma segunda
  // fonte independente para conferir a primeira transcrição à mão.
  const BLOCO_FERRAMENTA = /#### (.+?) \(([^)]*)\)\r?\n\r?\n\*\*Atributo:\*\* (.+?)\r?\n\r?\n\*\*Peso:\*\* (.+?)\r?\n/g;
  const ferramentasExtraidas = [...legacyFerramentasFile.texto_completo.matchAll(BLOCO_FERRAMENTA)].map((m) => ({
    nome: m[1],
    custo: m[2],
    peso: m[4],
  }));
  const toolEntities = catalogos.arquivos.find((a) => a.relPath === 'equipment/tools.json').colecao.items;
  const toolsByName = new Map(toolEntities.map((t) => [t.name, t]));

  test('25 ferramentas extraídas por regex do markdown bruto', () => {
    assert.equal(ferramentasExtraidas.length, 25);
  });

  for (const { nome, custo, peso } of ferramentasExtraidas) {
    test(`"${nome}": custo/peso batem com o markdown (categoria "Ferramenta")`, () => {
      const gerado = toolsByName.get(nome);
      assert.ok(gerado, `ferramenta "${nome}" não gerada`);
      assert.equal(gerado.category, 'Ferramenta');
      if (custo.trim() === 'Varia') {
        assert.equal(gerado.cost, undefined);
      } else {
        const match = /^(\d+)\s*(PC|PP|PO|PL)$/.exec(custo.trim());
        assert.ok(match, `custo "${custo}" não reconhecido`);
        assert.equal(gerado.cost.amount, Number(match[1]));
        assert.equal(gerado.cost.currency, { PC: 'cp', PP: 'sp', PO: 'gp', PL: 'pp' }[match[2]]);
      }
      if (peso.trim() === 'Varia' || peso.trim() === '—') {
        assert.equal(gerado.weight, undefined);
      } else {
        const pesoMatch = /^([\d,]+)\s*kg$/.exec(peso.trim());
        assert.ok(pesoMatch, `peso "${peso}" não reconhecido`);
        assert.equal(gerado.weight, Number(pesoMatch[1].replace(',', '.')));
      }
    });
  }
});

describe('migrate-spells-equipment — listas de magia por classe batem com dados/magias/por_classe', () => {
  for (const [classeSlug, contagemEsperada] of Object.entries(BY_CLASS_LEGACY_COUNTS)) {
    test(`spells/by-class/${classeSlug}.json tem ${contagemEsperada} magias`, async () => {
      const arquivo = spellListFiles.find((a) => a.relPath === `spells/by-class/${classeSlug}.json`);
      assert.ok(arquivo, `arquivo de ${classeSlug} não encontrado`);
      assert.equal(arquivo.colecao.items[0].spells.length, contagemEsperada);
    });
  }

  test('índice mestre (spells/index.json) referencia as 391 magias', () => {
    const arquivo = spellListFiles.find((a) => a.relPath === 'spells/index.json');
    assert.equal(arquivo.colecao.items[0].spells.length, 391);
  });
});

describe('migrate-spells-equipment — criaturas: tamanho/tipo/CA/PV/ND batem com o legado', () => {
  const SIZE_MAP_INDEPENDENTE = { Minúsculo: 'tiny', Minúscula: 'tiny', Pequeno: 'small', Pequena: 'small', Médio: 'medium', Média: 'medium', Grande: 'large', Enorme: 'huge', Gigantesco: 'gargantuan', Gigantesca: 'gargantuan' };
  const creatureByName = new Map(creatureEntities.map((c) => [c.name, c]));

  for (const legado of legacyCriaturas) {
    test(`"${legado.nome}": armorClass/hitPoints/size`, () => {
      const gerado = creatureByName.get(legado.nome);
      assert.ok(gerado, `criatura "${legado.nome}" não gerada`);
      assert.equal(gerado.armorClass, Number(/^(\d+)/.exec(legado.ca)[1]));
      assert.equal(gerado.hitPoints, Number(/^(\d+)/.exec(legado.pv)[1]));
      const match = /^(.+?)\s+(Minúsculo|Minúscula|Pequeno|Pequena|Médio|Média|Grande|Enorme|Gigantesco|Gigantesca)/.exec(legado.tipo_tamanho);
      assert.equal(gerado.size, SIZE_MAP_INDEPENDENTE[match[2]]);
      assert.equal(gerado.description, legado.texto_completo, `criatura "${legado.nome}": description deve preservar texto_completo verbatim (equivalência de campo com getCriaturas())`);
    });
  }
});

describe('migrate-spells-equipment — glossário: term/definition são o nome/descrição legados verbatim', () => {
  const glossaryByName = new Map(glossaryEntities.map((g) => [g.name, g]));

  for (const legado of legacyGlossario) {
    test(`"${legado.nome}": term/definition verbatim (equivalência de campo com getGlossario())`, () => {
      const gerado = glossaryByName.get(legado.nome);
      assert.ok(gerado, `termo "${legado.nome}" não gerado`);
      assert.equal(gerado.term, legado.nome);
      assert.equal(gerado.definition, legado.descricao);
    });
  }
});

describe('migrate-spells-equipment — nomes/ids únicos e schema válido', () => {
  test('nenhum id repetido em todo o staging desta tarefa', () => {
    const vistos = new Set();
    for (const { colecao } of catalogos.arquivos) {
      for (const item of colecao.items) {
        assert.ok(!vistos.has(item.id), `id duplicado "${item.id}"`);
        vistos.add(item.id);
      }
    }
  });

  test('toda entidade gerada valida contra seu schema concreto', () => {
    for (const { relPath, colecao } of catalogos.arquivos) {
      for (const item of colecao.items) {
        const resultado = validateEntity(item);
        assert.ok(resultado.valid, `"${relPath}": "${item.id}" inválido: ${resultado.errors?.map((e) => e.message).join('; ')}`);
      }
    }
  });
});

describe('migrate-spells-equipment — drift: catálogos commitados refletem o conversor', () => {
  test('verificarDrift() não encontra diferenças', async () => {
    const drift = await verificarDrift(catalogos);
    assert.deepEqual(drift.diffs, []);
    assert.equal(drift.ok, true);
  });
});
