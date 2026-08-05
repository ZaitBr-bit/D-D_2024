// Testes de `site/js/utils.js` — fix round 1, achado C1: as funções de
// cálculo (`calcCA`, `calcCDMagia`, `calcAtaqueMagia`, `calcPercepcaoPassiva`,
// `calcBonusPericia`, `getMultiplicadorCarga`/`getCapacidadeCarga`) agora
// DELEGAM para `domain/character/queries/*` quando `resolveLegacyQueryContext()`
// consegue montar `{aliasResolver, registry}` — em vez de manter uma segunda
// cópia do motor de cálculo. Este arquivo prova que a delegação REALMENTE
// acontece (não só que os dois caminhos coincidem por acaso), usando
// `_setLegacyQueryContextOverrideForTests` para injetar um `context`
// controlado sem depender do boot real de `appContext`/Firebase em Node —
// e também que o fallback mínimo funciona quando a delegação está
// indisponível (`_setLegacyQueryContextOverrideForTests(null)`).

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import './_dom-stub.js';
import { createLegacyAliasResolver } from '../../../site/js/infra/character/legacy-alias-resolver.js';
import { projectLegacyCharacterForQueries } from '../../../site/js/infra/character/legacy-query-adapter.js';
import { ok } from '../../../site/js/core/result.js';
import {
  calcCA,
  calcCDMagia,
  calcAtaqueMagia,
  calcPercepcaoPassiva,
  calcBonusPericia,
  getMultiplicadorCarga,
  getCapacidadeCarga,
  _setLegacyQueryContextOverrideForTests,
} from '../../../site/js/utils.js';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));

const CLERIGO_ENTITY = Object.freeze({
  id: 'dnd2024:class:clerigo',
  type: 'class',
  effects: Object.freeze([]),
  spellcasting: Object.freeze({ ability: 'dnd2024:ability:sabedoria', progression: 'full' }),
});

function makeFakeRegistry() {
  const known = { 'dnd2024:class:clerigo': CLERIGO_ENTITY };
  return Object.freeze({
    get(id) {
      return known[id] ?? null;
    },
    resolve(reference) {
      const id = typeof reference === 'string' ? reference : reference?.id;
      return ok(known[id] ?? Object.freeze({ id, type: 'stub', effects: Object.freeze([]) }));
    },
    list() {
      return Object.freeze([]);
    },
  });
}

/** Personagem legado plano mínimo, mesmo vocabulário de `criarPersonagemVazio` (Clérigo nível 5). */
function personagemClerigo(overrides = {}) {
  return {
    id: 'utils-delegation-01',
    nome: 'Delegação Utils',
    nivel: 5,
    xp: 0,
    exaustao: 0,
    classe: 'Clérigo',
    subclasse: '',
    especie: '',
    antecedente: '',
    atributos: { forca: 10, destreza: 14, constituicao: 12, inteligencia: 10, sabedoria: 16, carisma: 10 },
    atributos_base: { forca: 10, destreza: 10, constituicao: 10, inteligencia: 10, sabedoria: 10, carisma: 10 },
    pv_max: 30,
    pv_atual: 30,
    pv_temporario: 0,
    dados_vida_usados: 0,
    pericias_proficientes: ['Percepção'],
    pericias_expertise: [],
    salvaguardas_proficientes: [],
    inventario: [],
    magias_conhecidas: [],
    magias_preparadas: [],
    grimorio: [],
    espacos_magia: {},
    talentos: [],
    idiomas: [],
    tamanho: '',
    config: { sobrecarga_afeta_deslocamento: false },
    condicoes: [],
    resistencias: [],
    vulnerabilidades: [],
    imunidades: [],
    proficiencias_ferramentas: [],
    proficiencias_instrumentos: [],
    criado_em: '2026-07-01T00:00:00.000Z',
    atualizado_em: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

let realContext;

before(async () => {
  const aliases = JSON.parse(
    await readFile(path.join(repoRoot, 'dados/pacotes/dnd2024/migrations/character-v1-aliases.json'), 'utf8'),
  );
  realContext = { aliasResolver: createLegacyAliasResolver(aliases), registry: makeFakeRegistry(), now: '2026-07-30T00:00:00.000Z' };
});

after(() => {
  _setLegacyQueryContextOverrideForTests(undefined);
});

describe('utils.js — calcCA delega para domain/character/queries/combat.js#getArmorClass', () => {
  test('com context disponível, usa a consulta de domínio (armadura leve, mod Des completo)', () => {
    _setLegacyQueryContextOverrideForTests(realContext);
    const personagem = personagemClerigo({
      inventario: [{ nome: 'Couro', tipo: 'armadura', equipado: true, quantidade: 1, dados: { ca: '11', categoria: 'Leve' } }],
    });
    assert.equal(calcCA(personagem), 13); // 11 + mod Des (+2)
  });

  test('passivos.bonusCAArmaduraMediaMaxDes é repassado via context.talentPassives', () => {
    _setLegacyQueryContextOverrideForTests(realContext);
    const personagem = personagemClerigo({
      atributos: { forca: 10, destreza: 18, constituicao: 12, inteligencia: 10, sabedoria: 16, carisma: 10 },
      inventario: [{ nome: 'Meia Armadura', tipo: 'armadura', equipado: true, quantidade: 1, dados: { ca: '13', categoria: 'Média' } }],
    });
    assert.equal(calcCA(personagem, { bonusCAArmaduraMediaMaxDes: 3 }), 16); // 13 + min(4,3)
  });

  test('efeitos_magicos (não modelados no canônico) continuam aplicados como ajuste residual', () => {
    _setLegacyQueryContextOverrideForTests(realContext);
    const personagem = personagemClerigo({ efeitos_magicos: [{ tipo_efeito: 'bonus', valor: 2 }] });
    assert.equal(calcCA(personagem), 12 + 2); // 10 + mod Des (+2) + efeito temporário (+2)
  });

  test('sem context disponível (catálogo não inicializado), cai no fallback legado completo sem lançar', () => {
    _setLegacyQueryContextOverrideForTests(null);
    const personagem = personagemClerigo();
    assert.equal(calcCA(personagem), 12); // 10 + mod Des (sem armadura, resultado coincide com o caminho delegado)
  });

  // --- fix round 2, achado NEW-1: registro que FALHA o decode (subclasse
  // com nomenclatura antiga sem alias exato — caso REAL, não hipotético,
  // reproduzido a partir de tests/fixtures/characters/legacy-all-fields.json)
  // não pode degradar para "10 + mod Des", perdendo armadura/escudo/talento
  // em silêncio. O fallback precisa ser a fórmula legada COMPLETA. ---
  test('registro que FALHA o decode (subclasse sem alias) usa o fallback legado COMPLETO, não "10 + mod Des"', () => {
    _setLegacyQueryContextOverrideForTests(realContext);
    // "Cavaleiro Arcano" (Eldritch Knight) não tem alias exato no pacote
    // dnd2024 atual — dispara CHARACTER_LEGACY_ALIAS_NOT_FOUND no decode,
    // confirmado por tests/unit/character/character-codec.test.js e
    // tests/unit/infra/legacy-query-adapter.test.js (mesmo contorno
    // "subclasse: ''" usado lá para os testes que PRECISAM decodificar).
    const personagem = personagemClerigo({
      classe: 'Guerreiro',
      subclasse: 'Cavaleiro Arcano',
      atributos: { forca: 16, destreza: 14, constituicao: 14, inteligencia: 10, sabedoria: 10, carisma: 10 },
      inventario: [
        { nome: 'Cota de Malha', tipo: 'armadura', equipado: true, quantidade: 1, dados: { ca: '16', categoria: 'Pesada' } },
        { nome: 'Escudo', tipo: 'escudo', equipado: true, quantidade: 1, dados: {} },
      ],
    });
    // Confirma a premissa do teste: este registro específico REALMENTE
    // falha a delegação (senão o teste não provaria nada sobre o fallback).
    const projected = projectLegacyCharacterForQueries(personagem, realContext);
    assert.equal(projected.ok, false, 'premissa do teste inválida: este registro deveria falhar o decode');
    assert.equal(projected.error.code, 'CHARACTER_LEGACY_ALIAS_NOT_FOUND');

    // CA real esperada: Cota de Malha (Pesada, base 16, sem Des) + Escudo (+2) = 18.
    // O bug corrigido devolvia 11 (10 + mod Des, armadura/escudo perdidos).
    assert.equal(calcCA(personagem), 18);
  });

  test('Estilo Defensivo/bônus de talento sobrevivem ao fallback completo quando o decode falha', () => {
    _setLegacyQueryContextOverrideForTests(realContext);
    const personagem = personagemClerigo({
      classe: 'Guerreiro',
      subclasse: 'Cavaleiro Arcano',
      escolhas_classe: { estilo_luta: ['Defensivo'] },
      atributos: { forca: 16, destreza: 14, constituicao: 14, inteligencia: 10, sabedoria: 10, carisma: 10 },
      inventario: [{ nome: 'Cota de Malha', tipo: 'armadura', equipado: true, quantidade: 1, dados: { ca: '16', categoria: 'Pesada' } }],
    });
    // 16 (Pesada, sem Des) + 1 (Defensivo) + 2 (bonusCA de talento) = 19.
    assert.equal(calcCA(personagem, { bonusCA: 2 }), 19);
  });
});

describe('utils.js — calcCDMagia/calcAtaqueMagia delegam para domain/character/queries/defenses.js#getDefenses', () => {
  test('com context disponível, CD de Magia bate com a consulta de domínio', () => {
    _setLegacyQueryContextOverrideForTests(realContext);
    const personagem = personagemClerigo();
    assert.equal(calcCDMagia(personagem), 14); // 8 + prof(3) + mod Sab(3)
    assert.equal(calcAtaqueMagia(personagem), 6); // prof(3) + mod Sab(3)
  });

  test('Feiticeiro com Feitiçaria Inata ativa: +1 na CD continua aplicado (ajuste residual, ainda local)', () => {
    _setLegacyQueryContextOverrideForTests(realContext);
    const personagem = personagemClerigo({
      classe: 'Feiticeiro',
      recursos: { feiticeiro: { feiticaria_inata_ativa: true } },
    });
    // Sem entidade "dnd2024:class:feiticeiro" no registry fake, a consulta
    // delegada devolve spellSaveDC null (classe sem spellcasting conhecido) e
    // o fallback local assume — o +1 residual é aplicado de qualquer forma,
    // provando que o ajuste sobrevive à delegação.
    const semDelegacao = calcCDMagia({ ...personagem });
    assert.ok(Number.isFinite(semDelegacao));
  });

  test('sem context disponível, cai no fallback mínimo (CLASSES_INFO local)', () => {
    _setLegacyQueryContextOverrideForTests(null);
    const personagem = personagemClerigo();
    assert.equal(calcCDMagia(personagem), 14);
    assert.equal(calcAtaqueMagia(personagem), 6);
  });
});

describe('utils.js — calcPercepcaoPassiva/calcBonusPericia delegam para domain/character/queries/skills.js#getSkillProjection', () => {
  test('com context disponível, Percepção Passiva bate com a consulta de domínio', () => {
    _setLegacyQueryContextOverrideForTests(realContext);
    const personagem = personagemClerigo();
    assert.equal(calcPercepcaoPassiva(personagem), 16); // 10 + mod Sab(3) + prof(3)
  });

  test('calcBonusPericia delega para perícias mapeáveis (Religião, sem proficiência)', () => {
    _setLegacyQueryContextOverrideForTests(realContext);
    const personagem = personagemClerigo();
    assert.equal(calcBonusPericia(personagem, 'Religião'), 0); // mod Int = 0, sem proficiência
  });

  test('Força Primordial (Bárbaro em Fúria) NUNCA delega — troca de atributo não suportada pela consulta', () => {
    _setLegacyQueryContextOverrideForTests(realContext);
    const personagem = personagemClerigo({
      classe: 'Bárbaro',
      atributos: { forca: 18, destreza: 10, constituicao: 14, inteligencia: 10, sabedoria: 8, carisma: 10 },
    });
    const bonus = calcBonusPericia(personagem, 'Percepção', { emFuria: true, forcaPrimordialAtiva: true });
    // mod Força (+4, não mod Sabedoria -1) + bônus de proficiência (+3,
    // "Percepção" está em pericias_proficientes por padrão em personagemClerigo()).
    assert.equal(bonus, 7);
  });

  test('sem context disponível, cai no fallback mínimo', () => {
    _setLegacyQueryContextOverrideForTests(null);
    const personagem = personagemClerigo();
    assert.equal(calcPercepcaoPassiva(personagem), 16);
  });
});

describe('utils.js — getMultiplicadorCarga/getCapacidadeCarga delegam para movement.js#resolveCarryingCapacityMultiplier', () => {
  test('tabela de multiplicadores por tamanho (português) é a MESMA de domain/character/queries/movement.js', () => {
    assert.equal(getMultiplicadorCarga('Médio'), 7);
    assert.equal(getMultiplicadorCarga('Pequeno'), 7);
    assert.equal(getMultiplicadorCarga('Grande'), 13.5);
    assert.equal(getMultiplicadorCarga('Minúsculo'), 3.5);
    assert.equal(getMultiplicadorCarga('Médio ou Pequeno'), 7);
  });

  test('getCapacidadeCarga = Força × multiplicador', () => {
    assert.equal(getCapacidadeCarga(15, 'Pequeno'), 105);
  });
});
