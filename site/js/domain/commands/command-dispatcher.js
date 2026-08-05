// Módulo `domain/commands/command-dispatcher`: `executeCharacterCommand` é o
// ÚNICO dispatcher público de comandos de mutação de personagem (Task 17).
// Recebe `{type, ...params}` e roteia para o handler puro correspondente
// (hit-points/rest/conditions/edit-character), sempre devolvendo o Command
// contract (`command-result.js`) — nunca lança, nunca muta `character`.

import { commandErr, commandError, isCommandResult } from './command-result.js';
import { applyDamage, applyHealing, grantTemporaryHitPoints, spendHitDie } from './hit-points.js';
import { shortRest, longRest } from './rest.js';
import {
  addCondition,
  removeCondition,
  useResource,
  rechargeResource,
  toggleLegacyTalentResource,
} from './conditions.js';
import { editCharacterField, revertCharacterEdit } from './edit-character.js';
import {
  castSpell,
  setConcentration,
  endConcentration,
  prepareSpell,
  unprepareSpell,
  addSpellbookSpell,
  removeSpellbookSpell,
} from '../spells/index.js';
import {
  addInventoryItem,
  removeInventoryItem,
  changeItemQuantity,
  equipItem,
  reorderInventory,
  changeWallet,
} from '../inventory/index.js';
import { applyLevelUp, applyFeatChoice } from '../progression/index.js';
import { classActionCommand } from './class-actions.js';

const SCOPE = 'domain.commands.dispatcher';

// Vocabulário fechado de tipos de comando -> handler. Cada handler recebe
// `(character, command, context)`; os que não precisam de `context` apenas o
// ignoram.
const HANDLERS = Object.freeze({
  'apply-damage': (character, command) => applyDamage(character, command),
  'apply-healing': (character, command, context) => applyHealing(character, command, context),
  'grant-temporary-hp': (character, command) => grantTemporaryHitPoints(character, command),
  'spend-hit-die': (character, command, context) => spendHitDie(character, command, context),
  'short-rest': (character, command, context) => shortRest(character, command, context),
  'long-rest': (character, command, context) => longRest(character, command, context),
  'add-condition': (character, command) => addCondition(character, command),
  'remove-condition': (character, command) => removeCondition(character, command),
  'use-resource': (character, command) => useResource(character, command),
  'recharge-resource': (character, command, context) => rechargeResource(character, command, context),
  'toggle-legacy-talent-resource': (character, command) => toggleLegacyTalentResource(character, command),
  'edit-character-field': (character, command, context) => editCharacterField(character, command, context),
  'revert-character-edit': (character, command) => revertCharacterEdit(character, command),
  // Task 18 — magias/concentração. `cast-spell` exige `context.registry`
  // (catálogo) e, quando há espaço/metamagia envolvidos,
  // `context.spellcasting`/`context.metamagic`; o handler falha com erro
  // estruturado se faltarem, nunca com um resultado "quase certo".
  'cast-spell': (character, command, context) => castSpell(character, command, context),
  'set-concentration': (character, command) => setConcentration(character, command),
  'end-concentration': (character, command) => endConcentration(character, command),
  // Correção C1 da revisão final — preparar/despreparar e grimório. A regra é
  // `validateSpellSelection` (Task 18), reusada dentro dos handlers;
  // `prepare-spell`/`add-spellbook-spell` exigem `context.registry` (e usam
  // `context.spellcasting` para limite/círculo máximo) e falham com erro
  // estruturado quando faltam — nunca com um preparo "quase certo".
  'prepare-spell': (character, command, context) => prepareSpell(character, command, context),
  'unprepare-spell': (character, command) => unprepareSpell(character, command),
  'add-spellbook-spell': (character, command, context) => addSpellbookSpell(character, command, context),
  'remove-spellbook-spell': (character, command) => removeSpellbookSpell(character, command),
  // Task 19 — inventário/carga/moedas. `change-wallet` exige a tabela de
  // conversão em `context.currencyRates` (preferência `dnd_taxas_moeda`, lida
  // por `infra/preferences/...`) OU um ruleset acessível
  // (`context.ruleset`/`context.registry`); sem nenhum dos dois o comando
  // falha com erro estruturado, nunca com uma tabela padrão embutida.
  'add-inventory-item': (character, command) => addInventoryItem(character, command),
  'remove-inventory-item': (character, command) => removeInventoryItem(character, command),
  'change-item-quantity': (character, command) => changeItemQuantity(character, command),
  'equip-item': (character, command) => equipItem(character, command),
  'reorder-inventory': (character, command) => reorderInventory(character, command),
  'change-wallet': (character, command, context) => changeWallet(character, command, context),
  // Task 23 — progressão. Os dois exigem `context.registry` (a mecânica do
  // nível e do talento é derivada do catálogo) e falham com erro estruturado
  // se ele faltar, nunca com um level-up "quase certo". `selection` viaja no
  // próprio comando.
  'level-up': (character, command, context) => applyLevelUp(character, command.selection, context),
  'choose-feat': (character, command, context) => applyFeatChoice(character, command.selection, context),
  // Task 30 — ações de CLASSE. Único ponto pelo qual os doze handlers das
  // Tasks 20/21/22a viram efeito a partir de uma interface. Exige
  // `context.officialHandlerInvoker` (porta injetada pelo composition root) e
  // `context.registry`; sem qualquer um dos dois FALHA com erro nomeado, nunca
  // com "nenhuma ação disponível" — ver o cabeçalho de `class-actions.js`.
  //
  // NÃO existe um `class-rest` irmão deste comando: o `onRest` dos handlers é
  // composto DENTRO de `short-rest`/`long-rest` (decisão registrada em
  // `questions-for-review.txt` item 15), para que não seja possível disparar
  // metade de um descanso.
  'class-action': (character, command, context) => classActionCommand(character, command, context),
});

/**
 * Confere a forma mínima de um CanonicalCharacter (identity/build/state como
 * objetos) — o mesmo mínimo que `domain/character/queries/internal/shared.js#requireCharacterShape`
 * exige, sem repetir a validação completa do schema.
 * @param {*} character
 * @returns {boolean}
 */
function hasCharacterShape(character) {
  return (
    character !== null &&
    typeof character === 'object' &&
    character.identity !== null &&
    typeof character.identity === 'object' &&
    character.build !== null &&
    typeof character.build === 'object' &&
    character.state !== null &&
    typeof character.state === 'object'
  );
}

/**
 * Executa um comando de mutação sobre `character`. Devolve SEMPRE o Command
 * contract (`{ok, character, events, affected}`, mais `error` na falha) —
 * nunca lança para uma falha esperada (comando desconhecido, personagem
 * inválido, parâmetros inválidos); só deixa propagar um erro de programação
 * genuíno (ex.: um handler malformado que não devolve o contrato esperado
 * vira `COMMAND_HANDLER_CONTRACT_VIOLATION`, não uma exceção crua).
 * @param {object} character - CanonicalCharacter (Task 12)
 * @param {{type: string, [key: string]: *}} command
 * @param {object} [context] - repassado aos handlers que precisam (ex.: `maximumHitPoints`/`registry`/`now`).
 * @returns {import('./command-result.js').CommandResult}
 */
export function executeCharacterCommand(character, command, context = {}) {
  if (!hasCharacterShape(character)) {
    return commandErr({
      character,
      error: commandError(
        'COMMAND_CHARACTER_INVALID',
        'O comando exige um CanonicalCharacter com identity/build/state.',
        {},
      ),
    });
  }
  if (command === null || typeof command !== 'object' || Array.isArray(command) || typeof command.type !== 'string') {
    return commandErr({
      character,
      error: commandError('COMMAND_TYPE_INVALID', 'O comando deve ser um objeto com "type" (string).', {
        receivedType: Array.isArray(command) ? 'array' : typeof command,
      }),
    });
  }

  const handler = Object.hasOwn(HANDLERS, command.type) ? HANDLERS[command.type] : undefined;
  if (handler === undefined) {
    return commandErr({
      character,
      error: commandError('COMMAND_TYPE_UNKNOWN', `O tipo de comando "${command.type}" não é reconhecido.`, {
        type: command.type,
      }),
    });
  }

  const safeContext = context !== null && typeof context === 'object' ? context : {};
  const result = handler(character, command, safeContext);
  if (!isCommandResult(result)) {
    return commandErr({
      character,
      error: commandError(
        'COMMAND_HANDLER_CONTRACT_VIOLATION',
        `O handler de "${command.type}" não devolveu um Command contract válido.`,
        { type: command.type, scope: SCOPE },
      ),
    });
  }
  return result;
}
