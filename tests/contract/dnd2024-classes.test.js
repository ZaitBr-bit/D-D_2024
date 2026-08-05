// Contrato de paridade das 12 classes / 48 subclasses de D&D 2024 (Task 8).
//
// RED esperado antes desta tarefa: `dados/pacotes/dnd2024/classes/*.json`
// não existiam e `scripts/content/migrate-classes.mjs` não existia —
// `construirTodasAsClasses()` falhava ao importar o módulo/ler os arquivos
// legados de saída, e todo teste abaixo listava as 12 entidades de classe
// ausentes.
//
// A baseline usada para comparação (`tests/fixtures/expected/class-mechanics.json`)
// foi extraída INDEPENDENTEMENTE de `scripts/content/migrate-classes.mjs` —
// direto de `dados/classes/*.json` (dado de vida, perícias, equipamento,
// características por nível) e `site/js/dados-classes.js` (CLASSES_INFO) —
// para que este teste não vire tautologia (migrate-classes comparado consigo
// mesmo). Qualquer campo mecânico só é aceito aqui se vier de um campo
// ESTRUTURADO da entidade gerada (hitDie, primaryAbility,
// savingThrowProficiencies, effects[].target/resource/choice) — nunca de
// `description`/texto livre nem de listas separadas por vírgula usadas como
// identificador.

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { construirTodasAsClasses, CLASS_SLUGS, verificarDrift } from '../../scripts/content/migrate-classes.mjs';
import { validateEntity } from '../../site/js/content/validation.js';
import { parseContentId } from '../../site/js/core/content-id.js';
import { slugify } from '../../scripts/content/content-id-map.mjs';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

let fixture;
let idInventory;
let colecoes; // slug -> {schemaVersion, type, items[]}
let classEntityBySlug;
let featuresBySlug; // slug -> feature[]
let subclassesBySlug; // slug -> subclass[]
let catalogoArmas;
let catalogoArmaduras;

before(async () => {
  fixture = JSON.parse(await readFile(path.join(repoRoot, 'tests', 'fixtures', 'expected', 'class-mechanics.json'), 'utf8'));
  idInventory = JSON.parse(await readFile(path.join(repoRoot, 'tests', 'fixtures', 'content', 'dnd2024-id-inventory.json'), 'utf8'));
  catalogoArmas = JSON.parse(await readFile(path.join(repoRoot, 'dados', 'equipamento', 'armas.json'), 'utf8')).armas;
  catalogoArmaduras = JSON.parse(await readFile(path.join(repoRoot, 'dados', 'equipamento', 'armaduras.json'), 'utf8')).armaduras;
  colecoes = await construirTodasAsClasses();

  classEntityBySlug = new Map();
  featuresBySlug = new Map();
  subclassesBySlug = new Map();
  for (const [slug, colecao] of colecoes) {
    classEntityBySlug.set(slug, colecao.items.find((i) => i.type === 'class'));
    featuresBySlug.set(slug, colecao.items.filter((i) => i.type === 'feature'));
    subclassesBySlug.set(slug, colecao.items.filter((i) => i.type === 'subclass'));
  }
});

describe('migrate-classes — 12 entidades de classe presentes e ids corretos', () => {
  test('todas as 12 classes do inventário reservado foram construídas', () => {
    assert.equal(CLASS_SLUGS.length, 12);
    assert.equal(colecoes.size, 12);
    for (const slug of CLASS_SLUGS) {
      assert.ok(classEntityBySlug.get(slug), `classe "${slug}" ausente`);
    }
  });

  test('cada id de classe é exatamente o id pré-reservado em dnd2024-id-inventory.json', () => {
    for (const slug of CLASS_SLUGS) {
      const entity = classEntityBySlug.get(slug);
      const reservado = idInventory.reserved.class.find((c) => c.name === entity.name);
      assert.ok(reservado, `nome "${entity.name}" não está reservado`);
      assert.equal(entity.id, reservado.id);
      const parsed = parseContentId(entity.id);
      assert.equal(parsed.ok, true);
      assert.equal(parsed.value.slug, slugify(entity.name), 'id de classe deve ser slugify(name), não o nome de exibição');
    }
  });
});

describe('migrate-classes — dado de vida, atributos, salvaguardas (campos estruturados, não texto)', () => {
  for (const slug of CLASS_SLUGS) {
    test(`${slug}: hitDie/primaryAbility/savingThrowProficiencies batem com a baseline`, () => {
      const entity = classEntityBySlug.get(slug);
      const base = fixture[slug];

      assert.equal(typeof entity.hitDie, 'string');
      assert.equal(entity.hitDie, base.hitDie);
      assert.match(entity.hitDie, /^d(6|8|10|12)$/);

      // Parsing independente do texto de atributo primário (não reaproveita
      // a lógica de migrate-classes.mjs) — só extrai os nomes de atributo
      // literalmente citados.
      const nomesEsperados = base.primaryAbilityText.split(/\s+(?:e|ou)\s+/i).map((s) => s.trim());
      assert.equal(Array.isArray(entity.primaryAbility), true);
      assert.equal(entity.primaryAbility.length, nomesEsperados.length);
      for (const nome of nomesEsperados) {
        assert.ok(entity.primaryAbility.includes(`dnd2024:ability:${slugify(nome)}`), `primaryAbility deveria incluir ${nome}`);
      }

      assert.deepEqual(
        [...entity.savingThrowProficiencies].sort(),
        base.savingThrows.map((n) => `dnd2024:ability:${slugify(n)}`).sort(),
      );
    });
  }
});

describe('migrate-classes — escolha de perícias é um efeito "choice" com targets tipados (não lista textual)', () => {
  for (const slug of CLASS_SLUGS) {
    test(`${slug}: escolha de perícia tem a contagem e o pool corretos`, () => {
      const entity = classEntityBySlug.get(slug);
      const base = fixture[slug];
      const efeito = entity.effects.find((e) => e.id === 'pericias-de-classe');
      assert.ok(efeito, 'efeito de escolha de perícia ausente');
      assert.equal(efeito.type, 'choice');
      assert.equal(efeito.choice.min, base.skillChoiceCount);
      assert.equal(efeito.choice.max, base.skillChoiceCount);

      const nomesEsperados = base.skillPool; // null => qualquer perícia (18 opções)
      if (nomesEsperados === null) {
        assert.equal(efeito.choice.options.length, 18);
      } else {
        assert.equal(efeito.choice.options.length, nomesEsperados.length);
      }

      // Cada opção concede proficiência via ContentId real de skill, nunca
      // apenas o nome em texto.
      for (const opcao of efeito.choice.options) {
        assert.equal(opcao.grants.length, 1);
        assert.equal(opcao.grants[0].type, 'proficiency');
        const parsed = parseContentId(opcao.grants[0].target);
        assert.equal(parsed.ok, true);
        assert.equal(parsed.value.type, 'skill');
      }
    });
  }
});

describe('migrate-classes — conjuração (spellcasting) reflete CLASSES_INFO.conjurador', () => {
  for (const slug of CLASS_SLUGS) {
    test(`${slug}: spellcasting presente sse a classe é conjuradora`, () => {
      const entity = classEntityBySlug.get(slug);
      const base = fixture[slug];
      if (base.isCaster) {
        assert.ok(entity.spellcasting, `${slug} deveria ter spellcasting`);
        assert.equal(entity.spellcasting.ability, `dnd2024:ability:${slugify(base.spellcastingAbility)}`);
        assert.match(entity.spellcasting.progression, /^(full|half|third|pact|none)$/);
      } else {
        assert.equal(entity.spellcasting, undefined, `${slug} não deveria ter spellcasting no nível de classe`);
      }
    });
  }
});

describe('migrate-classes — subclasses: exatamente 4 por classe, com ids reservados', () => {
  for (const slug of CLASS_SLUGS) {
    test(`${slug}: 4 subclasses, nomes batem com a baseline`, () => {
      const subclasses = subclassesBySlug.get(slug);
      const base = fixture[slug];
      assert.equal(subclasses.length, 4);
      assert.deepEqual([...subclasses.map((s) => s.name)].sort(), [...base.subclasses].sort());
      const classId = classEntityBySlug.get(slug).id;
      for (const sub of subclasses) {
        assert.equal(sub.class, classId, `subclass.class deve apontar para a classe (id), não pelo nome`);
        const reservado = idInventory.reserved.subclass.find((s) => s.name === sub.name);
        assert.ok(reservado, `subclasse "${sub.name}" não reservada`);
        assert.equal(sub.id, reservado.id);
      }
    });
  }
});

describe('migrate-classes — paridade COMPLETA de características por nível (classe + cada subclasse)', () => {
  for (const slug of CLASS_SLUGS) {
    test(`${slug}: todo (nível, nome) de característica de classe da baseline tem uma feature correspondente`, () => {
      const classId = classEntityBySlug.get(slug).id;
      const features = featuresBySlug.get(slug).filter((f) => f.grantedBy === classId);
      const base = fixture[slug];

      assert.equal(features.length, base.classFeatures.length, `contagem de features de classe diverge para ${slug}`);
      const gerados = features.map((f) => `${f.level}::${f.name}`).sort();
      const esperados = base.classFeatures.map((c) => `${c.level}::${c.name}`).sort();
      assert.deepEqual(gerados, esperados);
    });

    test(`${slug}: todo (nível, nome) de característica de cada subclasse da baseline tem uma feature correspondente`, () => {
      const subclasses = subclassesBySlug.get(slug);
      const features = featuresBySlug.get(slug);
      const base = fixture[slug];

      for (const sub of subclasses) {
        const dessaSubclasse = features.filter((f) => f.grantedBy === sub.id);
        const esperadas = base.subclassFeatures[sub.name];
        assert.equal(dessaSubclasse.length, esperadas.length, `contagem de features de "${sub.name}" diverge`);
        const gerados = dessaSubclasse.map((f) => `${f.level}::${f.name}`).sort();
        const esperados = esperadas.map((c) => `${c.level}::${c.name}`).sort();
        assert.deepEqual(gerados, esperados);
      }
    });
  }
});

describe('migrate-classes — toda feature carrega efeitos estruturados, nunca só description', () => {
  test('toda entidade feature tem effects não-vazio (a regra nunca vive só no texto de description)', () => {
    for (const [slug, features] of featuresBySlug) {
      for (const feature of features) {
        assert.ok(Array.isArray(feature.effects) && feature.effects.length > 0, `feature "${feature.id}" (${slug}) sem effects`);
        assert.equal(typeof feature.description, 'string');
        assert.ok(feature.description.length > 0);
      }
    }
  });

  test('feature id nunca é o nome de exibição — é sempre slugify(nome), com nível anexado quando o nome se repete', () => {
    for (const [, features] of featuresBySlug) {
      for (const feature of features) {
        assert.notEqual(feature.id, feature.name);
        const parsed = parseContentId(feature.id);
        assert.equal(parsed.ok, true, `id de feature "${feature.id}" deve ser um ContentId válido`);
      }
    }
  });

  test('grantedBy de toda feature resolve para o id de uma classe/subclasse realmente presente na mesma coleção', () => {
    for (const [slug, colecao] of colecoes) {
      const idsValidos = new Set(colecao.items.filter((i) => i.type === 'class' || i.type === 'subclass').map((i) => i.id));
      for (const feature of colecao.items.filter((i) => i.type === 'feature')) {
        assert.ok(idsValidos.has(feature.grantedBy), `${slug}: feature "${feature.id}" tem grantedBy "${feature.grantedBy}" não resolvível`);
        assert.ok(Number.isInteger(feature.level) && feature.level >= 1 && feature.level <= 20);
      }
    }
  });
});

describe('migrate-classes — toda entidade gerada valida contra o schema v1 concreto do seu tipo', () => {
  test('validateEntity() não reporta erro para nenhuma entidade gerada (674 antes do filtro de duplicatas de subclasse; a contagem real é reconferida dinamicamente, nunca hardcoded)', () => {
    let total = 0;
    for (const [slug, colecao] of colecoes) {
      for (const item of colecao.items) {
        total += 1;
        const result = validateEntity(item);
        assert.deepEqual(result.errors, [], `entidade "${item.id}" (${slug}) inválida`);
        assert.equal(result.valid, true);
      }
    }
    assert.ok(total > 0);
    // Reconfere contra a contagem real de items desta rodada (nunca um
    // número fixo no texto do teste, que fica obsoleto a cada mudança no
    // conversor — já aconteceu neste arquivo antes).
    const totalReal = [...colecoes.values()].reduce((acc, c) => acc + c.items.length, 0);
    assert.equal(total, totalReal);
  });
});

describe('migrate-classes — treinamento de armadura/arma é proficiência estruturada, NUNCA lista solta em texto manual (anti-padrão rejeitado de verdade)', () => {
  test('nenhuma classe tem mais o efeito manual "treinamento-armadura"/"proficiencia-armas" (regressão direta do achado de review)', () => {
    // Antes desta correção, treinamento de armadura/arma virava um ÚNICO
    // efeito manual do tipo "Treinamento com armadura: Leve, Média,
    // Escudo." — uma lista separada por vírgula usada como o ÚNICO
    // portador da regra (o anti-padrão citado no brief). Agora cada item da
    // categoria vira seu próprio efeito `proficiency` com ContentId real
    // (conferido no teste seguinte); aqui só confirmamos que os ids do
    // efeito antigo, malfeito, não voltam a existir.
    for (const [slug, colecao] of colecoes) {
      const classEntity = colecao.items.find((i) => i.type === 'class');
      for (const efeito of classEntity.effects) {
        assert.notEqual(efeito.id, 'treinamento-armadura', `${slug}: efeito manual "treinamento-armadura" (lista solta) voltou a existir`);
        assert.notEqual(efeito.id, 'proficiencia-armas', `${slug}: efeito manual "proficiencia-armas" (lista solta) voltou a existir`);
        if (efeito.type === 'manual') {
          assert.equal(/,.*,/.test(efeito.text) && efeito.text.split('\n').length === 1, false,
            `${slug}: efeito manual de linha única "${efeito.id}" parece lista solta separada por vírgula: "${efeito.text}"`);
        }
      }
    }
  });

  for (const slug of CLASS_SLUGS) {
    test(`${slug}: todo item de armadura/arma da categoria treinada vira um efeito "proficiency" com ContentId real`, () => {
      const entity = classEntityBySlug.get(slug);
      const base = fixture[slug];

      const nomesArmaduraEsperados = (base.armors || []).length
        ? catalogoArmaduras.filter((a) => base.armors.includes(a.categoria)).map((a) => a.nome)
        : [];
      const nomesArmaEsperados = (base.weapons || []).flatMap((texto) => {
        const m = texto.match(/^(Simples|Marcial)(?:\s*\(([^)]+)\))?$/);
        if (!m) return [];
        const [, categoriaBase, qualificador] = m;
        let filtrado = catalogoArmas.filter((a) =>
          categoriaBase === 'Simples' ? a.categoria.includes('Simples') : a.categoria.includes('Marciais'),
        );
        if (qualificador) {
          const regex = new RegExp(`\\b${qualificador}\\b`, 'i');
          filtrado = filtrado.filter((a) => regex.test(a.propriedades || ''));
        }
        return filtrado.map((a) => a.nome);
      });

      const targetsDeProficiencia = new Set(
        entity.effects.filter((e) => e.type === 'proficiency').map((e) => e.target),
      );

      for (const nome of nomesArmaduraEsperados) {
        const reservado = idInventory.reserved.armor.find((a) => a.name === nome);
        assert.ok(reservado, `armadura "${nome}" deveria estar reservada`);
        assert.ok(targetsDeProficiencia.has(reservado.id), `${slug}: esperava proficiência estruturada em "${nome}" (${reservado.id})`);
      }
      for (const nome of nomesArmaEsperados) {
        const reservado = idInventory.reserved.weapon.find((a) => a.name === nome);
        assert.ok(reservado, `arma "${nome}" deveria estar reservada`);
        assert.ok(targetsDeProficiencia.has(reservado.id), `${slug}: esperava proficiência estruturada em "${nome}" (${reservado.id})`);
      }
    });
  }
});

describe('migrate-classes — equipamento inicial resolve EXATAMENTE o conjunto de itens reservados esperado (grant-item), não só "pelo menos um"', () => {
  // Re-implementação INDEPENDENTE (não importa nem chama nenhuma função de
  // scripts/content/migrate-classes.mjs) do mesmo tipo de resolução de nome
  // -> ContentId reservado, para computar a partir de
  // `fixture[slug].startingEquipmentText` (campo que antes existia na
  // fixture mas não era lido por nenhum teste) o CONJUNTO esperado de itens
  // por opção, e comparar contra o que o conversor realmente gerou. Isso é
  // o que teria pego o bug de "Armadura de Couro"/"Armadura de Couro
  // Batido" nunca resolvendo: o teste anterior só checava `grants.length >
  // 0`, que passava mesmo com a armadura ausente porque a arma sozinha já
  // satisfazia a contagem.
  function normalizarItemEquipamento(texto) {
    return texto
      .replace(/\s*\([^)]*\)\s*$/, '')
      .replace(/^Armadura de\s+/i, '')
      .trim();
  }
  function separarFragmentos(texto) {
    const partes = texto.split(',').map((s) => s.trim()).filter(Boolean);
    if (partes.length > 0) {
      const ultimo = partes.pop();
      partes.push(...ultimo.split(/\s+e\s+/).map((s) => s.trim()).filter(Boolean));
    }
    return partes.map((seg) => {
      const m = seg.match(/^(\d+)\s+(.+)$/);
      return (m ? m[2] : seg).trim();
    });
  }
  function resolverContraInventario(nomeFragmento) {
    const semParenteses = nomeFragmento.replace(/\s*\([^)]*\)\s*$/, '').trim();
    const candidatos = [nomeFragmento, semParenteses, normalizarItemEquipamento(nomeFragmento)];
    if (semParenteses.endsWith('s')) candidatos.push(semParenteses.slice(0, -1));
    if (nomeFragmento === 'Kit de Explorador') candidatos.push('Kit de Explorador de Masmorras');
    for (const tipo of ['weapon', 'armor', 'equipment']) {
      for (const candidato of candidatos) {
        const reservado = idInventory.reserved[tipo].find((e) => e.name === candidato);
        if (reservado) return reservado.id;
      }
    }
    return null;
  }

  for (const slug of CLASS_SLUGS) {
    test(`${slug}: cada opção resolve exatamente o mesmo conjunto de ids reservados que a baseline (extraída de startingEquipmentText)`, () => {
      const base = fixture[slug];
      assert.equal(typeof base.startingEquipmentText, 'string');
      assert.ok(base.startingEquipmentText.length > 0);

      const entity = classEntityBySlug.get(slug);
      const efeito = entity.effects.find((e) => e.id === 'equipamento-inicial');
      assert.ok(efeito, 'efeito de equipamento inicial ausente');

      const opcoesTexto = [...base.startingEquipmentText.matchAll(/\(([A-C])\)\s*([^;]+?)(?=;|$)/g)]
        .map((m) => ({ letra: m[1].toLowerCase(), texto: m[2].trim().replace(/\s*ou\s*$/i, '').trim() }));
      assert.equal(opcoesTexto.length, efeito.choice.options.length, `${slug}: número de opções diverge da baseline`);

      for (const opcaoTexto of opcoesTexto) {
        const opcaoGerada = efeito.choice.options.find((o) => o.id === `opcao-${opcaoTexto.letra}`);
        assert.ok(opcaoGerada, `${slug}: opção "${opcaoTexto.letra}" ausente na entidade gerada`);

        const idsEsperados = separarFragmentos(opcaoTexto.texto)
          .filter((texto) => texto !== 'PO')
          .map(resolverContraInventario)
          .filter(Boolean)
          .sort();
        const idsGerados = opcaoGerada.grants.map((g) => {
          assert.equal(g.type, 'grant-item');
          const parsed = parseContentId(g.item);
          assert.equal(parsed.ok, true, `${slug}: grant.item "${g.item}" deveria ser um ContentId válido`);
          assert.match(parsed.value.type, /^(weapon|armor|equipment)$/);
          return g.item;
        }).sort();

        assert.deepEqual(idsGerados, idsEsperados, `${slug}: opção "${opcaoTexto.letra}" — conjunto de itens resolvidos diverge da baseline`);
      }
    });
  }
});

describe('migrate-classes — sem regressão do bug de espaços de magia duplicados (achado de review)', () => {
  test('nenhuma classe conjuradora tem um efeito "resource" cujo `resource` é um dígito solto ("1".."9") — isso era o espaço de magia genérico duplicado', () => {
    for (const slug of CLASS_SLUGS) {
      const entity = classEntityBySlug.get(slug);
      const digitoSolto = entity.effects.find((e) => e.type === 'resource' && /^[1-9]$/.test(e.resource));
      assert.equal(digitoSolto, undefined, `${slug}: encontrado efeito resource "${digitoSolto?.resource}" (regressão do bug de espaço de magia duplicado)`);
    }
  });

  // Reconstrói, para um nível dado, o valor "ativo" de um efeito resource
  // condensado em runs `when:{min,max?}` — usado tanto pela checagem de
  // sobreposição abaixo quanto pela checagem de VALOR (não só nível) contra
  // a tabela legada.
  function valorNoNivel(efeitos, nivel) {
    const efeito = efeitos.find((e) => e.when.min <= nivel && (e.when.max ?? 20) >= nivel);
    return efeito ? efeito.value ?? efeito.max : undefined;
  }

  for (const slug of CLASS_SLUGS) {
    test(`${slug}: valores de "spell-slot-N" batem, nível a nível, com as colunas "1".."9" de dados/classes/${slug}.json (não só os intervalos de nível)`, async () => {
      const base = fixture[slug];
      if (!base.isCaster || slug === 'bruxo') return; // Bruxo usa Magia de Pacto (official-handler), não spell-slot-N declarativo.

      // Lida a tabela legada de novo aqui, independente do conversor —
      // mesma fonte usada para a baseline, mas parseada com uma
      // implementação própria (não chama gerarEfeitosDeEspacosDeMagia).
      const legado = JSON.parse(await readFile(path.join(repoRoot, 'dados', 'classes', `${slug}.json`), 'utf8'));
      const entity = classEntityBySlug.get(slug);
      const efeitosPorCirculo = new Map();
      for (const efeito of entity.effects) {
        if (efeito.type !== 'resource' || !/^spell-slot-\d$/.test(efeito.resource)) continue;
        if (!efeitosPorCirculo.has(efeito.resource)) efeitosPorCirculo.set(efeito.resource, []);
        efeitosPorCirculo.get(efeito.resource).push(efeito);
      }

      for (let nivel = 1; nivel <= 20; nivel++) {
        const linha = legado.tabela_caracteristicas.find((r) => parseInt(r['Nível'], 10) === nivel);
        assert.ok(linha, `${slug}: linha da tabela ausente para o nível ${nivel}`);
        for (let circulo = 1; circulo <= 9; circulo++) {
          const bruto = (linha[String(circulo)] ?? '').toString().trim();
          const esperado = bruto === '' || bruto === '—' || bruto === '-' ? undefined : Number(bruto);
          const gerado = valorNoNivel(efeitosPorCirculo.get(`spell-slot-${circulo}`) || [], nivel);
          assert.equal(
            gerado,
            esperado,
            `${slug} nível ${nivel} círculo ${circulo}: esperava ${esperado} espaço(s) (tabela legada), gerado ${gerado}`,
          );
        }
      }
    });
  }

  test('para cada círculo de magia que a baseline diz que a classe tem, existe EXATAMENTE UM efeito resource "spell-slot-N" cobrindo cada nível (sem duplicata)', () => {
    for (const slug of CLASS_SLUGS) {
      const base = fixture[slug];
      if (!base.isCaster) continue;
      const entity = classEntityBySlug.get(slug);
      const porCirculo = new Map();
      for (const efeito of entity.effects) {
        if (efeito.type !== 'resource' || !/^spell-slot-\d$/.test(efeito.resource)) continue;
        if (!porCirculo.has(efeito.resource)) porCirculo.set(efeito.resource, []);
        porCirculo.get(efeito.resource).push(efeito);
      }
      for (const [recurso, efeitos] of porCirculo) {
        // Nenhum par de runs deve se sobrepor no mesmo nível.
        const niveisVistos = new Set();
        for (const e of efeitos) {
          const max = e.when.max ?? 20;
          for (let n = e.when.min; n <= max; n++) {
            assert.equal(niveisVistos.has(n), false, `${slug}: nível ${n} coberto por mais de um efeito "${recurso}"`);
            niveisVistos.add(n);
          }
        }
      }
    }
  });
});

describe('migrate-classes — os arquivos canônicos em disco e o fragmento de índice de staging refletem o conversor (sem drift)', () => {
  test('verificarDrift() não encontra nenhuma divergência', async () => {
    const resultado = await verificarDrift(colecoes);
    assert.deepEqual(resultado.diffs, []);
    assert.equal(resultado.ok, true);
  });
});

// --- Task 15: ladders de nível não acumulam -------------------------------
//
// `tests/fixtures/expected/class-mechanics.json#nonStackingEffects` levanta,
// direto dos arquivos legados, todo grupo de efeitos do baseline cujas faixas
// de nível se SUBSTITUEM em vez de somar. Estes testes exigem que o conteúdo
// gerado marque exatamente esses grupos com `priority` (e, nos `resource`,
// `stackKey` + `stackable: false`) — e que NENHUM outro grupo de dois ou mais
// efeitos do mesmo alvo exista sem estar levantado no fixture.

/**
 * Agrupa os efeitos `resource`/`modifier` de uma entidade pela chave de alvo.
 * @param {object} entity
 * @returns {{resource: Map<string, object[]>, modifier: Map<string, object[]>}}
 */
function agruparEfeitosDeLadder(entity) {
  const resource = new Map();
  const modifier = new Map();
  for (const effect of entity.effects ?? []) {
    if (effect.type === 'resource') {
      if (!resource.has(effect.resource)) resource.set(effect.resource, []);
      resource.get(effect.resource).push(effect);
    } else if (effect.type === 'modifier') {
      if (!modifier.has(effect.target)) modifier.set(effect.target, []);
      modifier.get(effect.target).push(effect);
    }
  }
  return { resource, modifier };
}

/**
 * Localiza qualquer entidade construída (classe, subclasse ou feature) pelo id.
 * @param {string} entityId
 * @returns {object | undefined}
 */
function entidadePorId(entityId) {
  for (const colecao of colecoes.values()) {
    const encontrada = colecao.items.find((item) => item.id === entityId);
    if (encontrada) return encontrada;
  }
  return undefined;
}

describe('migrate-classes — Task 15: ladders de nível carregam priority/stackKey (não acumulam)', () => {
  test('todo ladder de recurso levantado no baseline tem priority crescente, stackKey e stackable:false', () => {
    const esperado = fixture.nonStackingEffects.resourceLadders;
    assert.ok(Object.keys(esperado).length > 0, 'o fixture deve levantar pelo menos um ladder de recurso');
    for (const [entityId, recursos] of Object.entries(esperado)) {
      // Desde a Task 20 o levantamento também cobre ladders de SUBCLASSE
      // (Dados de Superioridade / Dados Psiônicos), então a busca é por id em
      // todas as coleções, não só pelo slug da classe.
      const entity = entidadePorId(entityId);
      assert.ok(entity, `entidade ausente: ${entityId}`);
      const { resource } = agruparEfeitosDeLadder(entity);
      for (const recurso of recursos) {
        const efeitos = resource.get(recurso);
        assert.ok(efeitos && efeitos.length > 1, `${entityId}: o recurso "${recurso}" deveria ser um ladder`);
        for (const effect of efeitos) {
          assert.strictEqual(effect.stackKey, recurso, `${entityId}/${recurso}: stackKey ausente ou divergente`);
          assert.strictEqual(effect.stackable, false, `${entityId}/${recurso}: deveria declarar stackable:false`);
          assert.strictEqual(
            effect.priority,
            effect.when.min,
            `${entityId}/${recurso}: priority deveria ser o nível mínimo da faixa`,
          );
        }
        // Prioridades estritamente crescentes com o nível: a faixa mais alta é
        // sempre a última aplicada.
        const prioridades = efeitos.map((effect) => effect.priority).sort((a, b) => a - b);
        assert.deepStrictEqual(prioridades, [...new Set(prioridades)], `${entityId}/${recurso}: priority duplicada`);
      }
    }
  });

  test('todo ladder de modificador levantado no baseline tem priority, stackKey e stackable:false', () => {
    const esperado = fixture.nonStackingEffects.modifierLadders;
    const chavesEsperadas = fixture.nonStackingEffects.modifierStackKeys;
    assert.ok(Object.keys(esperado).length > 0);
    for (const [entityId, alvos] of Object.entries(esperado)) {
      const entity = classEntityBySlug.get(entityId.split(':')[2]);
      const { modifier } = agruparEfeitosDeLadder(entity);
      for (const alvo of alvos) {
        const efeitos = modifier.get(alvo);
        assert.ok(efeitos && efeitos.length > 1, `${entityId}: o alvo "${alvo}" deveria ser um ladder`);
        const stackKeyEsperada = chavesEsperadas[alvo];
        assert.ok(
          typeof stackKeyEsperada === 'string' && stackKeyEsperada.length > 0,
          `o fixture deve declarar a stackKey esperada do alvo "${alvo}" em modifierStackKeys`,
        );
        for (const effect of efeitos) {
          assert.strictEqual(effect.operation, 'set', `${entityId}/${alvo}: ladder de modificador deve usar "set"`);
          assert.strictEqual(effect.priority, effect.when.min, `${entityId}/${alvo}: priority deveria ser o nível mínimo`);
          // O brief exige `stackKey` EXPLÍCITA em todo efeito do baseline que
          // não acumula — `priority` + `set` sozinhos não expressam isso.
          assert.strictEqual(
            effect.stackKey,
            stackKeyEsperada,
            `${entityId}/${alvo}: stackKey ausente ou divergente da fórmula determinística`,
          );
          assert.strictEqual(effect.stackable, false, `${entityId}/${alvo}: deveria declarar stackable:false`);
        }
        // Prioridades distintas: a faixa mais alta é sempre a última aplicada.
        const prioridades = efeitos.map((effect) => effect.priority);
        assert.strictEqual(new Set(prioridades).size, prioridades.length, `${entityId}/${alvo}: priority duplicada`);
      }
    }
  });

  test('nenhum ladder (recurso ou modificador) fica sem stackKey/stackable:false', () => {
    // Varredura independente do fixture: QUALQUER grupo de dois ou mais efeitos
    // do mesmo alvo/recurso precisa declarar os campos de empilhamento. É a
    // rede de segurança para conteúdo novo que o fixture ainda não conheça.
    const semMarcacao = [];
    for (const colecao of colecoes.values()) {
      for (const entity of colecao.items) {
        const { resource, modifier } = agruparEfeitosDeLadder(entity);
        for (const [chave, efeitos] of [...resource, ...modifier]) {
          if (efeitos.length <= 1) continue;
          for (const effect of efeitos) {
            if (typeof effect.stackKey !== 'string' || effect.stackKey.length === 0 || effect.stackable !== false) {
              semMarcacao.push(`${entity.id} ${chave} ${effect.id}`);
            }
          }
        }
      }
    }
    assert.deepStrictEqual(semMarcacao, []);
  });

  test('nenhum grupo de dois ou mais efeitos do mesmo alvo fica fora do levantamento do fixture', () => {
    const { resourceLadders, modifierLadders } = fixture.nonStackingEffects;
    const naoLevantados = [];
    for (const colecao of colecoes.values()) {
      for (const entity of colecao.items) {
        const { resource, modifier } = agruparEfeitosDeLadder(entity);
        for (const [recurso, efeitos] of resource) {
          if (efeitos.length > 1 && !(resourceLadders[entity.id] ?? []).includes(recurso)) {
            naoLevantados.push(`${entity.id} resource:${recurso}`);
          }
        }
        for (const [alvo, efeitos] of modifier) {
          if (efeitos.length > 1 && !(modifierLadders[entity.id] ?? []).includes(alvo)) {
            naoLevantados.push(`${entity.id} modifier:${alvo}`);
          }
        }
      }
    }
    assert.deepStrictEqual(naoLevantados, []);
  });

  test('efeito fora de um ladder NÃO recebe stackKey/stackable/priority (ausência = sempre acumula)', () => {
    const { resourceLadders, modifierLadders } = fixture.nonStackingEffects;
    const marcadosPorEngano = [];
    for (const colecao of colecoes.values()) {
      for (const entity of colecao.items) {
        const ladders = new Set([
          ...(resourceLadders[entity.id] ?? []).map((r) => `resource:${r}`),
          ...(modifierLadders[entity.id] ?? []).map((t) => `modifier:${t}`),
        ]);
        for (const effect of entity.effects ?? []) {
          const chave =
            effect.type === 'resource'
              ? `resource:${effect.resource}`
              : effect.type === 'modifier'
                ? `modifier:${effect.target}`
                : null;
          if (chave !== null && ladders.has(chave)) continue;
          for (const campo of ['stackKey', 'stackable', 'priority']) {
            if (Object.prototype.hasOwnProperty.call(effect, campo)) {
              marcadosPorEngano.push(`${entity.id} ${effect.id ?? effect.type}.${campo}`);
            }
          }
        }
      }
    }
    assert.deepStrictEqual(marcadosPorEngano, []);
  });
});
