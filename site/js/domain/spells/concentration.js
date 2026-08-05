// Módulo `domain/spells/concentration`: comandos de concentração (Task 18).
//
// ## Oráculo do baseline
//
// `tests/fixtures/expected/command-transitions.json`, caso
// "concentracao-nova-magia-remove-efeitos-da-anterior" (categoria
// `concentracao`, capturado contra o commit `COMPATIBILITY_BASELINE`):
// começar a concentrar em outra magia REMOVE todos os efeitos mágicos
// marcados com `concentracao: true` e preserva os demais — exatamente
// `site/js/pages/sheet.js#registrarConcentracaoMagiaPersonalizada` linha 269
// (`char.efeitos_magicos = char.efeitos_magicos.filter(e => !e.concentracao)`).
//
// No canônico v2 (Task 12) esses efeitos vivem em DOIS lugares e os dois são
// limpos aqui, para que a operação seja completa em qualquer personagem:
//
//   - `state.activeEffects[i]` com `data.concentration === true` — o formato
//     canônico;
//   - `extensions.legacyPassthrough.efeitos_magicos[i]` com
//     `concentracao === true` — o array legado bruto, que
//     `infra/character/migrations/v1-to-v2.js` preserva verbatim (não é um
//     campo modelado estruturalmente) e que `character-codec.js` reemite no
//     encode. Sem limpar este, o oráculo acima não é reproduzido no
//     round-trip decode -> comando -> encode.
//
// ## O que NÃO é reproduzido (deliberado)
//
// O baseline também EMPURRA um marcador `{tipo: 'concentracao_generica',
// concentracao: true, rotulo: 'Concentrando em <nome>'}` para
// `efeitos_magicos` quando a magia nova é de concentração. Esse marcador é
// rótulo de UI derivado do estado, e o canônico já tem o campo próprio
// `state.spells.concentration` (schema `character-canonical-v2`). Sintetizar
// o marcador legado aqui duplicaria a mesma informação em dois lugares e
// divergiria do `personagemDepois` do oráculo, que não o contém. A ponte para
// a UI legada é responsabilidade do adapter, não do domínio.

import { commandOk, commandErr } from '../commands/command-result.js';
import { requireSpellCharacterShape, spellError } from './spellcasting-queries.js';

export const AFFECTED_CONCENTRATION = 'state.spells.concentration';
export const AFFECTED_ACTIVE_EFFECTS = 'state.activeEffects';
export const AFFECTED_LEGACY_MAGIC_EFFECTS = 'extensions.legacyPassthrough.efeitos_magicos';

/**
 * Filtra a lista LEGADA `efeitos_magicos` mantendo apenas o que NÃO é efeito
 * de concentração. É a primitiva única desta regra: é usada tanto por
 * `dropConcentrationEffects` (lado canônico) quanto, por delegação direta,
 * por `site/js/pages/sheet.js` (lado legado, enquanto a ficha não migra) —
 * de modo que "o que conta como efeito de concentração" tenha uma só
 * definição no projeto.
 * @param {*} effects - array legado `efeitos_magicos` (ou qualquer coisa).
 * @returns {Array<object>} nova lista, sem os efeitos de concentração.
 */
export function filtrarEfeitosSemConcentracao(effects) {
  return (Array.isArray(effects) ? effects : []).filter((effect) => effect?.concentracao !== true);
}

/**
 * Remove de `state.activeEffects` e de
 * `extensions.legacyPassthrough.efeitos_magicos` todas as entradas marcadas
 * como de concentração, devolvendo os ramos novos e quais paths mudaram.
 * Não muta `character`.
 * @param {object} character
 * @returns {{state: object|null, extensions: object|null, affected: string[], removed: number}}
 */
export function dropConcentrationEffects(character) {
  const affected = [];
  let removed = 0;

  const activeEffects = Array.isArray(character.state?.activeEffects) ? character.state.activeEffects : null;
  let nextState = null;
  if (activeEffects !== null) {
    const kept = activeEffects.filter((entry) => entry?.data?.concentration !== true);
    if (kept.length !== activeEffects.length) {
      removed += activeEffects.length - kept.length;
      nextState = { ...character.state, activeEffects: Object.freeze(kept) };
      affected.push(AFFECTED_ACTIVE_EFFECTS);
    }
  }

  const legacyPassthrough = character.extensions?.legacyPassthrough;
  let nextExtensions = null;
  const legacyEffects =
    legacyPassthrough !== null && typeof legacyPassthrough === 'object' && Array.isArray(legacyPassthrough.efeitos_magicos)
      ? legacyPassthrough.efeitos_magicos
      : null;
  if (legacyEffects !== null) {
    const kept = filtrarEfeitosSemConcentracao(legacyEffects);
    if (kept.length !== legacyEffects.length) {
      removed += legacyEffects.length - kept.length;
      nextExtensions = {
        ...character.extensions,
        legacyPassthrough: Object.freeze({ ...legacyPassthrough, efeitos_magicos: Object.freeze(kept) }),
      };
      affected.push(AFFECTED_LEGACY_MAGIC_EFFECTS);
    }
  }

  return { state: nextState, extensions: nextExtensions, affected, removed };
}

/**
 * Monta o personagem novo trocando a concentração ativa e limpando os efeitos
 * de concentração anteriores. Função pura, usada tanto por `setConcentration`
 * quanto por `cast-spell.js` (para que conjurar e concentrar apliquem
 * EXATAMENTE a mesma transição, sem uma segunda implementação).
 * @param {object} character
 * @param {string|null} spellId - novo alvo de concentração, ou `null` para encerrar.
 * @returns {{character: object, affected: string[]}}
 */
export function withConcentration(character, spellId) {
  const dropped = dropConcentrationEffects(character);
  const baseState = dropped.state ?? character.state;
  const previous = typeof character.state?.spells?.concentration === 'string' ? character.state.spells.concentration : null;

  const affected = [...dropped.affected];
  let nextState = baseState;
  if (previous !== spellId) {
    nextState = {
      ...baseState,
      spells: Object.freeze({ ...baseState.spells, concentration: spellId }),
    };
    affected.push(AFFECTED_CONCENTRATION);
  }

  if (affected.length === 0) {
    return { character, affected };
  }
  const next = { ...character, state: Object.freeze(nextState) };
  if (dropped.extensions !== null) {
    next.extensions = Object.freeze(dropped.extensions);
  }
  return { character: Object.freeze(next), affected };
}

/**
 * Verifica se uma nova concentração pode substituir a atual. Devolve o
 * AppError `CONCENTRATION_REPLACEMENT_REQUIRED` (sem mutar nada) quando já há
 * concentração ativa em OUTRA magia e o request não confirmou a substituição.
 * @param {object} character
 * @param {string} spellId
 * @param {boolean} replaceConcentration
 * @returns {object | null} AppError, ou `null` quando pode prosseguir.
 */
export function checkConcentrationReplacement(character, spellId, replaceConcentration) {
  const current = typeof character.state?.spells?.concentration === 'string' ? character.state.spells.concentration : null;
  if (current === null || current === spellId || replaceConcentration === true) {
    return null;
  }
  return spellError(
    'CONCENTRATION_REPLACEMENT_REQUIRED',
    `O personagem já está concentrado em "${current}"; confirme a substituição com "replaceConcentration: true".`,
    { currentSpellId: current, requestedSpellId: spellId },
  );
}

/**
 * Comando: passa a concentrar em `spellId`.
 * @param {object} character - CanonicalCharacter.
 * @param {{spellId: string, replaceConcentration?: boolean}} request
 * @returns {import('../commands/command-result.js').CommandResult}
 */
export function setConcentration(character, request = {}) {
  const shape = requireSpellCharacterShape(character);
  if (!shape.ok) {
    return commandErr({ character, error: shape.error });
  }
  const spellId = request?.spellId;
  if (typeof spellId !== 'string' || spellId.length === 0) {
    return commandErr({
      character,
      error: spellError('CONCENTRATION_SPELL_ID_INVALID', '"spellId" deve ser uma string não vazia.', {
        received: typeof spellId === 'string' ? spellId : null,
      }),
    });
  }
  const replaceConcentration = request?.replaceConcentration === true;
  const conflict = checkConcentrationReplacement(character, spellId, replaceConcentration);
  if (conflict !== null) {
    return commandErr({ character, error: conflict });
  }

  const previous = typeof character.state.spells?.concentration === 'string' ? character.state.spells.concentration : null;
  const { character: next, affected } = withConcentration(character, spellId);
  if (affected.length === 0) {
    return commandOk({ character, events: [], affected: [] });
  }
  return commandOk({
    character: next,
    events: [{ type: 'concentration-started', spellId, previousSpellId: previous }],
    affected,
  });
}

/**
 * Comando: encerra a concentração ativa. Erro explícito (não no-op) quando
 * não há concentração — mesma disciplina de
 * `domain/commands/conditions.js#removeCondition`, para que `set`/`end`
 * sejam exatamente simétricos.
 * @param {object} character - CanonicalCharacter.
 * @param {object} [request] - sem parâmetros hoje; presente pela assinatura do brief.
 * @returns {import('../commands/command-result.js').CommandResult}
 */
export function endConcentration(character, request = {}) {
  void request;
  const shape = requireSpellCharacterShape(character);
  if (!shape.ok) {
    return commandErr({ character, error: shape.error });
  }
  const current = typeof character.state.spells?.concentration === 'string' ? character.state.spells.concentration : null;
  if (current === null) {
    return commandErr({
      character,
      error: spellError('CONCENTRATION_NOT_ACTIVE', 'Não há concentração ativa para encerrar.', {}),
    });
  }

  const { character: next, affected } = withConcentration(character, null);
  return commandOk({
    character: next,
    events: [{ type: 'concentration-ended', spellId: current }],
    affected,
  });
}
