// Módulo `domain/inventory`: porta pública do domínio de inventário, carga e
// moedas (Task 19). Consumidores (ficha, criador, loja, o dispatcher de
// comandos e o shim de transição `site/js/moedas.js`) importam daqui, nunca
// dos arquivos internos.

export {
  INVENTORY_QUERIES_SCOPE,
  ENCUMBRANCE_LEVELS,
  getInventoryProjection,
  inventoryQueryError,
} from './inventory-queries.js';

export {
  AFFECTED_INVENTORY,
  addInventoryItem,
  removeInventoryItem,
  changeItemQuantity,
  equipItem,
  reorderInventory,
} from './inventory-commands.js';

export {
  EQUIPMENT_SCOPE,
  ARMOR_CATEGORIES,
  WEAPON_CATEGORIES,
  equipmentError,
  parseWeightText,
  formatWeightText,
  formatWeightNumber,
  catalogCostToCopper,
  resolveItemDefinition,
  evaluateEquipRequirements,
  editCustomDefinitionNumbers,
} from './equipment-rules.js';

export {
  WALLET_SCOPE,
  WALLET_DENOMINATIONS,
  WALLET_OPERATIONS,
  BASE_DENOMINATION,
  AFFECTED_WALLET,
  RULESET_CURRENCY_CODE_TO_DENOMINATION,
  walletError,
  createEmptyWallet,
  normalizeWallet,
  readRulesetCurrencyRates,
  validateCurrencyRates,
  resolveCurrencyRates,
  denominationsByValueDesc,
  walletTotalInCopper,
  distributeCopper,
  formatWallet,
  parseCostText,
  formatCostText,
  withdrawCopper,
  changeWallet,
} from './wallet.js';
