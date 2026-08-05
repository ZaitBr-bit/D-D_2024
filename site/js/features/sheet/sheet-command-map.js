// Módulo `features/sheet/sheet-command-map`: o ÚNICO dono do mapeamento entre
// os paths canônicos que `CommandResult.affected` emite (Tasks 17/18/19, sobre
// o vocabulário de alvos derivados da Task 15) e os IDs de seção da ficha que
// precisam ser redesenhados.
//
// ## Por que um mapa explícito, e por que ele FALHA em vez de devolver vazio
//
// A alternativa preguiçosa seria `dirtySections = seções que declaram
// interesse no path`, com "nenhuma seção interessada" significando "não
// redesenha nada". Isso é um BYPASS SILENCIOSO: no dia em que um comando novo
// (ou um path novo num comando existente) aparecer, a mutação acontece, o
// personagem é salvo, e a tela simplesmente não muda — sem erro, sem log, sem
// teste vermelho. O jogador vê um clique que não fez nada.
//
// Por isso `resolveDirtySections` devolve `Result`: um path que este módulo
// não conhece é `SHEET_AFFECTED_PATH_UNMAPPED`, um erro estruturado que sobe
// pela sessão. O teste `tests/unit/sheet/section-registry.test.js` varre as
// FONTES de `site/js/domain/**` atrás de todo path literal emitido em
// `affected` e exige que cada um esteja aqui — então o mapa não pode ficar
// para trás em silêncio.
//
// ## Como ler o mapa
//
// Cada path lista TODAS as seções cuja projeção pode mudar por causa dele —
// não só a "dona" do campo. Trocar de nível, por exemplo, muda progressão,
// combate (PV/CA/bônus de proficiência), recursos e magias ao mesmo tempo.
// Errar para menos é o defeito caro (tela desatualizada); errar para mais
// custa um rerender.

import { ok, err } from '../../core/result.js';
import { createAppError } from '../../core/errors.js';
import { SHEET_SECTION_IDS, isSheetSectionId } from './sheet-state.js';

const SCOPE = 'features.sheet.command-map';

const SUMMARY = 'summary-combat';
const RESOURCES = 'resources-features';
const PROGRESSION = 'feats-progression';
const SPELLS = 'spells-spellbook';
const CONDITIONS = 'conditions-defenses-senses';
const INVENTORY = 'inventory-load-coins';
const DETAILS = 'personal-details';

/**
 * Mapeamento LITERAL path -> seções. Fechado: um path fora daqui (e fora de
 * `AFFECTED_PATH_PATTERNS`) é erro, nunca um conjunto vazio.
 * @type {Readonly<Record<string, ReadonlyArray<string>>>}
 */
export const AFFECTED_PATH_SECTIONS = Object.freeze({
  // --- Pontos de vida, dados de vida e testes de morte (Task 17) -----------
  'hp.current': Object.freeze([SUMMARY]),
  'hp.temporary': Object.freeze([SUMMARY]),
  'hp.maximum': Object.freeze([SUMMARY]),
  'state.deathSaves': Object.freeze([SUMMARY]),
  'state.hitDice.used': Object.freeze([SUMMARY]),
  'state.hitPointRolls': Object.freeze([SUMMARY, PROGRESSION]),

  // --- Condições e efeitos ativos (Tasks 17/18) ---------------------------
  //
  // Uma condição não muda só a lista de condições: ela muda CA, deslocamento e
  // vantagem/desvantagem exibidos no resumo, e os sentidos/defesas derivados.
  'state.conditions': Object.freeze([CONDITIONS, SUMMARY]),
  'state.activeEffects': Object.freeze([CONDITIONS, SUMMARY, SPELLS]),
  'extensions.legacyPassthrough.efeitos_magicos': Object.freeze([CONDITIONS, SPELLS]),

  // --- Recursos (Tasks 17/18) ---------------------------------------------
  'state.resources': Object.freeze([RESOURCES]),
  'extensions.legacyPassthrough.recursos': Object.freeze([RESOURCES]),
  // Marcas de uso das AÇÕES DE CLASSE (Fúria ativa, Ação Ardilosa gasta, ...),
  // emitidas pelos handlers de `domain/rulesets/dnd2024/handlers/**`. Elas
  // aparecem nos dois lugares onde a ação de classe é mostrada: o painel de
  // recursos e o bloco de combate. Registrado agora — antes de as Tasks 30/31
  // roteaerem essa família — porque um path emitido sem seção registrada é
  // falha, e essa falha só apareceria no meio da task seguinte.
  'state.usageFlags': Object.freeze([RESOURCES, SUMMARY]),

  // --- Magias (Task 18) ---------------------------------------------------
  'state.spells.slots': Object.freeze([SPELLS]),
  'state.spells.pactSlots': Object.freeze([SPELLS]),
  'state.spells.concentration': Object.freeze([SPELLS, CONDITIONS]),
  // Correção C1 da revisão final: preparar/despreparar e edição de grimório
  // (`domain/spells/spell-preparation.js`). Só a seção de magias exibe as
  // coleções — nenhum outro derivado depende delas hoje.
  'state.spells.prepared': Object.freeze([SPELLS]),
  'state.spells.spellbook': Object.freeze([SPELLS]),

  // --- Inventário, carga e moedas (Task 19) -------------------------------
  //
  // Equipar/desequipar muda CA, ataques e carga — por isso o resumo entra
  // junto do inventário.
  'state.inventory': Object.freeze([INVENTORY, SUMMARY]),
  'state.wallet': Object.freeze([INVENTORY]),

  // --- Progressão, talentos e escolhas (Task 23) --------------------------
  'state.level': Object.freeze([PROGRESSION, SUMMARY, RESOURCES, SPELLS]),
  'build.featRefs': Object.freeze([PROGRESSION, RESOURCES, SUMMARY]),
  'build.choices': Object.freeze([PROGRESSION, RESOURCES, SPELLS, SUMMARY]),
  'build.subclassRef': Object.freeze([PROGRESSION, RESOURCES, SPELLS]),
});

/**
 * Paths PARAMETRIZADOS. Hoje só há um: `ability.<chave>.score`, emitido por
 * level-up/talento quando um ASI mexe num atributo. Um atributo mexe em tudo
 * que dele deriva — combate, perícias/passivas, magias e carga.
 * @type {ReadonlyArray<Readonly<{pattern: RegExp, sections: ReadonlyArray<string>, sample: string}>>}
 */
export const AFFECTED_PATH_PATTERNS = Object.freeze([
  Object.freeze({
    pattern: /^ability\.[a-z][a-z0-9-]*\.score$/,
    sections: Object.freeze([SUMMARY, CONDITIONS, SPELLS, INVENTORY]),
    sample: 'ability.forca.score',
  }),
  // Correção I2 da revisão final: `edit-character-field`/`revert-character-edit`
  // sobre os campos de identidade (`domain/commands/edit-character.js`,
  // `IDENTITY_EDIT_PATHS`). O nome aparece também no cabeçalho/resumo — por
  // isso a seção de combate entra junto (o concern C3 da Task 32 previu
  // exatamente esta entrada). `sample` é a instanciação mecânica do template
  // (`identity.${campo}` -> `identity.*` -> `identity.forca` no teste de
  // varredura), não um campo real.
  Object.freeze({
    pattern: /^identity\.[a-z][A-Za-z0-9]*$/,
    sections: Object.freeze([DETAILS, SUMMARY]),
    sample: 'identity.forca',
  }),
]);

/**
 * Cria um AppError deste módulo.
 * @param {string} code
 * @param {string} message
 * @param {object} [context]
 * @returns {object}
 */
function mapError(code, message, context = {}) {
  return createAppError({ code, scope: SCOPE, message, context });
}

/**
 * Seções associadas a UM path, ou `null` quando o path é desconhecido.
 * @param {string} path
 * @returns {ReadonlyArray<string>|null}
 */
export function sectionsForAffectedPath(path) {
  if (typeof path !== 'string' || path.length === 0) {
    return null;
  }
  if (Object.hasOwn(AFFECTED_PATH_SECTIONS, path)) {
    return AFFECTED_PATH_SECTIONS[path];
  }
  for (const entry of AFFECTED_PATH_PATTERNS) {
    if (entry.pattern.test(path)) {
      return entry.sections;
    }
  }
  return null;
}

/**
 * Traduz o `affected` de um `CommandResult` para os IDs de seção sujos, na
 * ordem canônica de `SHEET_SECTION_IDS` (a ordem de apresentação, para que o
 * rerender seja determinístico).
 *
 * `affected: []` é um resultado LEGÍTIMO de comando (no-op idempotente, ex.:
 * reverter uma edição que não existe) e produz `dirtySections: []` — isso não
 * é o bypass silencioso, porque nada mudou. O que é recusado é um path
 * PRESENTE e não mapeado.
 *
 * @param {ReadonlyArray<string>} affected
 * @returns {import('../../core/result.js').Result} Result<ReadonlyArray<string>, AppError>
 */
export function resolveDirtySections(affected) {
  if (!Array.isArray(affected)) {
    return err(mapError('SHEET_AFFECTED_INVALID', '"affected" precisa ser um array de paths canônicos.', {
      received: typeof affected,
    }));
  }
  /** @type {Set<string>} */
  const dirty = new Set();
  /** @type {Array<string>} */
  const unmapped = [];
  for (const path of affected) {
    const sections = sectionsForAffectedPath(path);
    if (sections === null) {
      unmapped.push(String(path));
      continue;
    }
    for (const sectionId of sections) {
      dirty.add(sectionId);
    }
  }
  if (unmapped.length > 0) {
    return err(
      mapError(
        'SHEET_AFFECTED_PATH_UNMAPPED',
        `Nenhuma seção da ficha está registrada para o(s) path(s) canônico(s): ${unmapped.join(', ')}.`,
        { unmapped },
      ),
    );
  }
  return ok(Object.freeze(SHEET_SECTION_IDS.filter((sectionId) => dirty.has(sectionId))));
}

/**
 * Confere que TODA seção citada pelo mapa é um ID canônico de seção. É a
 * metade oposta da garantia de `resolveDirtySections`: lá nenhum path fica sem
 * seção; aqui nenhuma seção citada é inventada.
 * @returns {import('../../core/result.js').Result} Result<true, AppError>
 */
export function validateCommandMap() {
  /** @type {Array<string>} */
  const invalid = [];
  const todas = [
    ...Object.entries(AFFECTED_PATH_SECTIONS).map(([path, sections]) => ({ path, sections })),
    ...AFFECTED_PATH_PATTERNS.map((entry) => ({ path: entry.sample, sections: entry.sections })),
  ];
  for (const { path, sections } of todas) {
    if (!Array.isArray(sections) || sections.length === 0) {
      invalid.push(`${path}: lista de seções vazia`);
      continue;
    }
    for (const sectionId of sections) {
      if (!isSheetSectionId(sectionId)) {
        invalid.push(`${path} -> ${sectionId}`);
      }
    }
  }
  if (invalid.length > 0) {
    return err(mapError('SHEET_COMMAND_MAP_INVALID', `O mapa cita seções inexistentes: ${invalid.join('; ')}.`, { invalid }));
  }
  return ok(true);
}

/**
 * Todos os paths conhecidos (literais mais as amostras dos parametrizados).
 * Usado pelos testes e por diagnóstico.
 * @returns {ReadonlyArray<string>}
 */
export function knownAffectedPaths() {
  return Object.freeze([...Object.keys(AFFECTED_PATH_SECTIONS), ...AFFECTED_PATH_PATTERNS.map((entry) => entry.sample)]);
}
