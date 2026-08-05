// Módulo `domain/inventory/inventory-commands`: comandos de mutação do
// inventário canônico (`state.inventory`) — Task 19. Todos seguem o contrato
// `domain/commands/command-result.js` (Task 17) e são puros: nunca leem
// `localStorage`, `Math.random()` nem `Date.now()`.
//
// ## Identidade da instância
//
// Cada entrada tem `instanceId` PRÓPRIO (schema `inventoryEntry`), e o domínio
// não pode gerá-lo (seria `Math.random()`/`crypto`, proibidos aqui pela
// Task 4). Por isso `addInventoryItem` EXIGE `instanceId` no pedido — quem
// chama (features/UI, ou `infra/character/legacy-instance-id.js` para itens
// migrados) fornece um id estável e único. Duplicar um id existente é erro
// explícito, nunca sobrescrita silenciosa.
//
// ## Paridade com o baseline
//
// - equipar/desequipar apenas grava `equipped` (o baseline NÃO desequipa
//   outras armaduras automaticamente — ver o caso
//   `inventario-equipar-item-e-toggle-nao-exclusivo` em
//   `tests/fixtures/expected/command-transitions.json`), e não bloqueia por
//   proficiência/requisito de Força (esses são avisos da projeção);
// - quantidade é inteiro >= 0; chegar a 0 NÃO remove o item (o baseline
//   mantém a linha com quantidade 0 — remover é uma ação separada, com
//   confirmação, em `sheet.js`);
// - reordenar exige uma permutação EXATA dos ids atuais (nenhum item some,
//   nenhum aparece, nenhum duplica).

import { commandOk, commandErr, commandError } from '../commands/command-result.js';

// Path de `affected` para toda mutação de inventário: `state.inventory` é
// campo do schema canônico, não alvo derivado do motor de efeitos.
export const AFFECTED_INVENTORY = 'state.inventory';

/**
 * @param {*} value
 * @returns {boolean}
 */
function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Lê o inventário canônico como array (nunca `undefined`).
 * @param {object} character
 * @returns {ReadonlyArray<object>}
 */
function readInventory(character) {
  return Array.isArray(character?.state?.inventory) ? character.state.inventory : [];
}

/**
 * Devolve o personagem com um novo inventário, congelando o que é criado aqui
 * (mesmo padrão de `domain/commands/conditions.js`).
 * @param {object} character
 * @param {ReadonlyArray<object>} inventory
 * @returns {object}
 */
function withInventory(character, inventory) {
  return Object.freeze({
    ...character,
    state: Object.freeze({ ...character.state, inventory: Object.freeze([...inventory]) }),
  });
}

/**
 * Localiza uma entrada por `instanceId`.
 * @param {ReadonlyArray<object>} inventory
 * @param {string} instanceId
 * @returns {number}
 */
function indexOfInstance(inventory, instanceId) {
  return inventory.findIndex((entry) => entry?.instanceId === instanceId);
}

/**
 * Valida um `instanceId` de pedido.
 * @param {*} instanceId
 * @returns {Readonly<object> | null}
 */
function validateInstanceId(instanceId) {
  if (typeof instanceId !== 'string' || instanceId.length === 0) {
    return commandError('COMMAND_INVENTORY_INSTANCE_ID_INVALID', '"instanceId" deve ser uma string não vazia.', {
      received: instanceId,
    });
  }
  return null;
}

/**
 * Adiciona um item ao inventário. Aceita item de catálogo (`itemRef`), item
 * customizado (`customDefinition`) ou os dois (é o formato que a migração
 * v1->v2 produz: `itemRef` resolvido MAIS o item bruto preservado em
 * `customDefinition`). Exige pelo menos um dos dois — uma entrada sem
 * nenhuma identidade de item não é representável.
 *
 * `sourceInstanceId` é aceito como `null` explícito: é exatamente o valor que
 * `infra/character/migrations/v1-to-v2.js` grava para todo item legado (o v1
 * nunca registrou proveniência de item), e recusá-lo rejeitaria dado
 * legítimo vindo da migração.
 * @param {object} character
 * @param {{instanceId: string, itemRef?: object|null, customDefinition?: object|null, quantity?: number, equipped?: boolean, expended?: number, sourceInstanceId?: string|null, atIndex?: number}} request
 * @returns {import('../commands/command-result.js').CommandResult}
 */
export function addInventoryItem(character, request = {}) {
  const idError = validateInstanceId(request?.instanceId);
  if (idError !== null) {
    return commandErr({ character, error: idError });
  }

  const inventory = readInventory(character);
  if (indexOfInstance(inventory, request.instanceId) !== -1) {
    return commandErr({
      character,
      error: commandError(
        'COMMAND_INVENTORY_INSTANCE_ID_DUPLICATE',
        `Já existe um item com instanceId "${request.instanceId}".`,
        { instanceId: request.instanceId },
      ),
    });
  }

  const itemRef = request.itemRef ?? null;
  const customDefinition = request.customDefinition ?? null;
  if (itemRef === null && customDefinition === null) {
    return commandErr({
      character,
      error: commandError(
        'COMMAND_INVENTORY_ITEM_IDENTITY_MISSING',
        'O item precisa de "itemRef" (catálogo) e/ou "customDefinition" (customizado).',
        {},
      ),
    });
  }
  if (itemRef !== null && (!isPlainObject(itemRef) || typeof itemRef.id !== 'string')) {
    return commandErr({
      character,
      error: commandError('COMMAND_INVENTORY_ITEM_REF_INVALID', '"itemRef" deve ser {id, packageVersion}.', {}),
    });
  }
  if (customDefinition !== null && !isPlainObject(customDefinition)) {
    return commandErr({
      character,
      error: commandError('COMMAND_INVENTORY_CUSTOM_DEFINITION_INVALID', '"customDefinition" deve ser um objeto.', {}),
    });
  }

  const quantity = request.quantity ?? 1;
  if (!Number.isInteger(quantity) || quantity < 0) {
    return commandErr({
      character,
      error: commandError('COMMAND_INVENTORY_QUANTITY_INVALID', '"quantity" deve ser um inteiro >= 0.', { quantity }),
    });
  }
  const expended = request.expended ?? 0;
  if (!Number.isInteger(expended) || expended < 0) {
    return commandErr({
      character,
      error: commandError('COMMAND_INVENTORY_EXPENDED_INVALID', '"expended" deve ser um inteiro >= 0.', { expended }),
    });
  }
  const sourceInstanceId = request.sourceInstanceId ?? null;
  if (sourceInstanceId !== null && typeof sourceInstanceId !== 'string') {
    return commandErr({
      character,
      error: commandError(
        'COMMAND_INVENTORY_SOURCE_INSTANCE_ID_INVALID',
        '"sourceInstanceId" deve ser string ou null.',
        { sourceInstanceId },
      ),
    });
  }

  const atIndex = request.atIndex;
  if (atIndex !== undefined && (!Number.isInteger(atIndex) || atIndex < 0 || atIndex > inventory.length)) {
    return commandErr({
      character,
      error: commandError('COMMAND_INVENTORY_INDEX_INVALID', '"atIndex" deve ser um inteiro dentro do inventário.', {
        atIndex,
        length: inventory.length,
      }),
    });
  }

  const entry = Object.freeze({
    instanceId: request.instanceId,
    itemRef: itemRef === null ? null : Object.freeze({ ...itemRef }),
    customDefinition: customDefinition === null ? null : { ...customDefinition },
    quantity,
    equipped: request.equipped === true,
    expended,
    sourceInstanceId,
  });

  const position = atIndex === undefined ? inventory.length : atIndex;
  const next = [...inventory.slice(0, position), entry, ...inventory.slice(position)];

  return commandOk({
    character: withInventory(character, next),
    events: [{ type: 'inventory-item-added', instanceId: entry.instanceId, quantity }],
    affected: [AFFECTED_INVENTORY],
  });
}

/**
 * Remove um item pelo `instanceId`. Erro explícito quando o id não existe
 * (nunca no-op silencioso) — o inverso EXATO de `addInventoryItem`.
 * @param {object} character
 * @param {{instanceId: string}} request
 * @returns {import('../commands/command-result.js').CommandResult}
 */
export function removeInventoryItem(character, request = {}) {
  const idError = validateInstanceId(request?.instanceId);
  if (idError !== null) {
    return commandErr({ character, error: idError });
  }

  const inventory = readInventory(character);
  const index = indexOfInstance(inventory, request.instanceId);
  if (index === -1) {
    return commandErr({
      character,
      error: commandError('COMMAND_INVENTORY_ITEM_NOT_FOUND', `Nenhum item com instanceId "${request.instanceId}".`, {
        instanceId: request.instanceId,
      }),
    });
  }

  const next = [...inventory.slice(0, index), ...inventory.slice(index + 1)];
  return commandOk({
    character: withInventory(character, next),
    events: [{ type: 'inventory-item-removed', instanceId: request.instanceId }],
    affected: [AFFECTED_INVENTORY],
  });
}

/**
 * Altera a quantidade de um item, por valor absoluto (`quantity`) ou
 * incremento (`delta`, que é como os botões +/- da ficha operam). O resultado
 * precisa ser inteiro >= 0; um `delta` que levaria a negativo é recusado com
 * erro (não saturado em 0 silenciosamente — o baseline usa
 * `Math.max(0, ...)`, mas ali o clamp é do próprio botão; aqui o comando
 * precisa dizer que o pedido era impossível).
 * @param {object} character
 * @param {{instanceId: string, quantity?: number, delta?: number}} request
 * @returns {import('../commands/command-result.js').CommandResult}
 */
export function changeItemQuantity(character, request = {}) {
  const idError = validateInstanceId(request?.instanceId);
  if (idError !== null) {
    return commandErr({ character, error: idError });
  }

  const hasQuantity = request.quantity !== undefined;
  const hasDelta = request.delta !== undefined;
  if (hasQuantity === hasDelta) {
    return commandErr({
      character,
      error: commandError(
        'COMMAND_INVENTORY_QUANTITY_REQUEST_INVALID',
        'Informe exatamente um entre "quantity" (absoluto) e "delta" (incremento).',
        {},
      ),
    });
  }
  if (hasQuantity && (!Number.isInteger(request.quantity) || request.quantity < 0)) {
    return commandErr({
      character,
      error: commandError('COMMAND_INVENTORY_QUANTITY_INVALID', '"quantity" deve ser um inteiro >= 0.', {
        quantity: request.quantity,
      }),
    });
  }
  if (hasDelta && !Number.isInteger(request.delta)) {
    return commandErr({
      character,
      error: commandError('COMMAND_INVENTORY_QUANTITY_DELTA_INVALID', '"delta" deve ser um inteiro.', {
        delta: request.delta,
      }),
    });
  }

  const inventory = readInventory(character);
  const index = indexOfInstance(inventory, request.instanceId);
  if (index === -1) {
    return commandErr({
      character,
      error: commandError('COMMAND_INVENTORY_ITEM_NOT_FOUND', `Nenhum item com instanceId "${request.instanceId}".`, {
        instanceId: request.instanceId,
      }),
    });
  }

  const entry = inventory[index];
  const current = Number.isInteger(entry?.quantity) ? entry.quantity : 0;
  const nextQuantity = hasQuantity ? request.quantity : current + request.delta;
  if (!Number.isInteger(nextQuantity) || nextQuantity < 0) {
    return commandErr({
      character,
      error: commandError(
        'COMMAND_INVENTORY_QUANTITY_NEGATIVE',
        'A quantidade resultante seria negativa; o pedido foi recusado.',
        { instanceId: request.instanceId, current, requested: nextQuantity },
      ),
    });
  }
  if (nextQuantity === current) {
    return commandOk({ character, events: [], affected: [] });
  }

  const next = [...inventory];
  next[index] = Object.freeze({ ...entry, quantity: nextQuantity });

  return commandOk({
    character: withInventory(character, next),
    events: [
      { type: 'inventory-quantity-changed', instanceId: request.instanceId, from: current, to: nextQuantity },
    ],
    affected: [AFFECTED_INVENTORY],
  });
}

/**
 * Equipa/desequipa um item. Réplica do toggle do baseline: só grava
 * `equipped`, sem exclusão mútua entre armaduras e sem bloquear por
 * proficiência ou requisito de Força (esses são avisos informativos de
 * `getInventoryProjection`).
 * @param {object} character
 * @param {{instanceId: string, equipped: boolean}} request
 * @returns {import('../commands/command-result.js').CommandResult}
 */
export function equipItem(character, request = {}) {
  const idError = validateInstanceId(request?.instanceId);
  if (idError !== null) {
    return commandErr({ character, error: idError });
  }
  if (typeof request.equipped !== 'boolean') {
    return commandErr({
      character,
      error: commandError('COMMAND_INVENTORY_EQUIPPED_INVALID', '"equipped" deve ser um booleano.', {
        received: request.equipped,
      }),
    });
  }

  const inventory = readInventory(character);
  const index = indexOfInstance(inventory, request.instanceId);
  if (index === -1) {
    return commandErr({
      character,
      error: commandError('COMMAND_INVENTORY_ITEM_NOT_FOUND', `Nenhum item com instanceId "${request.instanceId}".`, {
        instanceId: request.instanceId,
      }),
    });
  }

  const entry = inventory[index];
  if (entry?.equipped === request.equipped) {
    return commandOk({ character, events: [], affected: [] });
  }

  const next = [...inventory];
  next[index] = Object.freeze({ ...entry, equipped: request.equipped });

  return commandOk({
    character: withInventory(character, next),
    events: [{ type: 'inventory-item-equipped', instanceId: request.instanceId, equipped: request.equipped }],
    affected: [AFFECTED_INVENTORY],
  });
}

/**
 * Reordena o inventário. `instanceIds` precisa ser uma PERMUTAÇÃO EXATA dos
 * ids atuais: mesma cardinalidade, mesmos ids, sem repetição. Qualquer desvio
 * é erro explícito — reordenar nunca pode virar um caminho para perder,
 * duplicar ou criar item.
 * @param {object} character
 * @param {{instanceIds: ReadonlyArray<string>}} request
 * @returns {import('../commands/command-result.js').CommandResult}
 */
export function reorderInventory(character, request = {}) {
  const requested = request?.instanceIds;
  if (!Array.isArray(requested)) {
    return commandErr({
      character,
      error: commandError('COMMAND_INVENTORY_REORDER_INVALID', '"instanceIds" deve ser um array de ids.', {}),
    });
  }

  const inventory = readInventory(character);
  if (requested.length !== inventory.length) {
    return commandErr({
      character,
      error: commandError(
        'COMMAND_INVENTORY_REORDER_NOT_PERMUTATION',
        'A nova ordem precisa conter exatamente os mesmos itens do inventário atual.',
        { expectedLength: inventory.length, receivedLength: requested.length },
      ),
    });
  }

  const currentIds = inventory.map((entry) => entry?.instanceId);
  const currentSet = new Set(currentIds);
  const seen = new Set();
  for (const id of requested) {
    if (typeof id !== 'string' || !currentSet.has(id)) {
      return commandErr({
        character,
        error: commandError(
          'COMMAND_INVENTORY_REORDER_NOT_PERMUTATION',
          `O id "${String(id)}" não pertence ao inventário atual.`,
          { instanceId: id },
        ),
      });
    }
    if (seen.has(id)) {
      return commandErr({
        character,
        error: commandError(
          'COMMAND_INVENTORY_REORDER_NOT_PERMUTATION',
          `O id "${id}" aparece mais de uma vez na nova ordem.`,
          { instanceId: id },
        ),
      });
    }
    seen.add(id);
  }
  // `currentSet` pode ser menor que `currentIds` se o inventário já tiver ids
  // duplicados/ausentes (registro corrompido): nesse caso a permutação não é
  // decidível e o comando recusa, em vez de embaralhar dado inconsistente.
  if (currentSet.size !== inventory.length) {
    return commandErr({
      character,
      error: commandError(
        'COMMAND_INVENTORY_INSTANCE_IDS_NOT_UNIQUE',
        'O inventário atual tem instanceIds ausentes ou duplicados; reordenar seria ambíguo.',
        { length: inventory.length, uniqueIds: currentSet.size },
      ),
    });
  }

  const byId = new Map(inventory.map((entry) => [entry.instanceId, entry]));
  const next = requested.map((id) => byId.get(id));

  const unchanged = next.every((entry, index) => entry === inventory[index]);
  if (unchanged) {
    return commandOk({ character, events: [], affected: [] });
  }

  return commandOk({
    character: withInventory(character, next),
    events: [{ type: 'inventory-reordered', instanceIds: Object.freeze([...requested]) }],
    affected: [AFFECTED_INVENTORY],
  });
}
