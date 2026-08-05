// ============================================================
// Sistema de carteira multi-moeda (PC, PP, PE, PO, PL).
//
// SHIM DE TRANSIÇÃO (Task 19): este módulo mantém a API legada que o monólito
// (`site/js/pages/sheet.js`, `site/js/pages/creator.js`, `site/js/store.js`)
// já importa, mas TODA a aritmética agora DELEGA para
// `site/js/domain/inventory/wallet.js`. Nada de regra de conversão é
// reimplementado aqui.
//
// Por que a tabela padrão continua nesta camada e não no domínio: o domínio
// tem proibição explícita de embutir a tabela (ela é dado de jogo e deve vir
// do ruleset `dnd2024:ruleset:core#/tables/currency` ou da preferência do
// usuário). O monólito legado, porém, é síncrono e não tem o catálogo
// carregado no momento em que calcula moedas, então este shim mantém a tabela
// do baseline `e43c5ea` e a PASSA como parâmetro para o domínio. Quando as
// Tasks 29/33 ligarem o `app-context` à ficha, este arquivo some e a tabela
// passa a vir do ruleset — que já declara as CINCO denominações da carteira,
// incluindo eletro (`pe`, 50 cobre), restaurado na tabela
// `dnd2024:ruleset:core#/tables/currency` pelo fix de revisão da Task 19.
// Enquanto isso, os valores abaixo são idênticos aos do ruleset.
// ============================================================

import {
  WALLET_DENOMINATIONS,
  normalizeWallet,
  createEmptyWallet,
  walletTotalInCopper,
  distributeCopper,
  formatWallet,
  parseCostText,
  withdrawCopper,
  validateCurrencyRates,
  denominationsByValueDesc,
} from './domain/inventory/index.js';

// Ordem decrescente de valor (maior -> menor)
export const DENOMINACOES = [...WALLET_DENOMINATIONS];

export const NOMES_MOEDA = {
  pl: 'Peça de Platina',
  po: 'Peça de Ouro',
  pe: 'Peça de Electrum',
  pp: 'Peça de Prata',
  pc: 'Peça de Cobre'
};

export const ICONE_MOEDA = {
  pl: '💠',
  po: '🟡',
  pe: '🟠',
  pp: '⚪',
  pc: '🟤'
};

// Taxas do baseline e43c5ea (valor de cada denominacao em PC). Ver o
// cabeçalho: mora aqui, na camada legada, nunca no domínio.
const TAXAS_PADRAO = { pl: 1000, po: 100, pe: 50, pp: 10, pc: 1 };

// Valor de cada denominacao em PC. Mutavel via definirTaxas() para permitir taxas customizadas.
export const VALOR_EM_COBRE = { ...TAXAS_PADRAO };

/**
 * Aplica taxas de conversao customizadas (muta VALOR_EM_COBRE). A validação é
 * a do domínio (`validateCurrencyRates`), que replica exatamente as regras do
 * baseline; as mensagens de erro legadas são reconstruídas a partir do código
 * do AppError para não mudar o texto que a ficha exibe.
 */
export function definirTaxas(taxas) {
  const candidato = {
    pc: 1,
    pp: Number(taxas?.pp),
    pe: Number(taxas?.pe),
    po: Number(taxas?.po),
    pl: Number(taxas?.pl)
  };
  const resultado = validateCurrencyRates(candidato);
  if (!resultado.ok) {
    const { code, context } = resultado.error;
    if (code === 'WALLET_CURRENCY_RATE_CHAIN_INVALID') {
      return {
        sucesso: false,
        erro: `${context.denomination.toUpperCase()} deve ser multiplo inteiro maior que ${context.previousDenomination.toUpperCase()}`
      };
    }
    const tipo = typeof context?.denomination === 'string' ? context.denomination : 'pc';
    return { sucesso: false, erro: `Taxa de ${tipo.toUpperCase()} invalida (precisa ser inteiro positivo)` };
  }
  Object.assign(VALOR_EM_COBRE, resultado.value);
  return { sucesso: true, taxas: { ...VALOR_EM_COBRE } };
}

/** Restaura as taxas de conversao padrao (baseline e43c5ea) */
export function resetarTaxas() {
  Object.assign(VALOR_EM_COBRE, TAXAS_PADRAO);
  return { ...VALOR_EM_COBRE };
}

/** true se as taxas atuais forem exatamente as padrao */
export function taxasSaoPadrao() {
  return DENOMINACOES.every(tipo => VALOR_EM_COBRE[tipo] === TAXAS_PADRAO[tipo]);
}

/** Cria uma carteira zerada com as 5 denominacoes */
export function criarCarteiraVazia() {
  return createEmptyWallet();
}

/** Garante que a carteira tem as 5 chaves como inteiros validos (>=0) */
export function normalizarCarteira(moedas) {
  return normalizeWallet(moedas);
}

/** Soma o valor total da carteira convertido para PC (peca de cobre) */
export function totalEmCobre(moedas) {
  const resultado = walletTotalInCopper(moedas, VALOR_EM_COBRE);
  // Com as 5 denominações sempre presentes em VALOR_EM_COBRE, este caminho de
  // erro é inalcançável pelo shim; o 0 existe só para manter a assinatura
  // legada (número puro) caso alguém mute VALOR_EM_COBRE por fora.
  return resultado.ok ? resultado.value : 0;
}

/** Redistribui um valor em PC nas 5 denominacoes, usando o menor numero de moedas */
export function distribuirCobre(totalCobre) {
  return distributeCopper(totalCobre, VALOR_EM_COBRE);
}

/** Adiciona uma quantidade de uma denominacao especifica (sem conversao) */
export function adicionarMoeda(moedas, tipo, qtd) {
  const m = normalizeWallet(moedas);
  if (!DENOMINACOES.includes(tipo) || qtd <= 0) return m;
  m[tipo] += Math.floor(qtd);
  return m;
}

/** Verifica se a carteira tem valor total suficiente (em PC) para cobrir um custo */
export function podePagar(moedas, custoEmCobre) {
  return totalEmCobre(moedas) >= custoEmCobre;
}

/**
 * Retira um valor (em PC) da carteira, convertendo moedas maiores
 * automaticamente quando necessario.
 */
export function retirarValor(moedas, custoEmCobre) {
  const resultado = withdrawCopper(moedas, custoEmCobre, VALOR_EM_COBRE);
  if (!resultado.ok) return { sucesso: false, moedas: normalizeWallet(moedas) };
  return { sucesso: true, moedas: resultado.value.wallet };
}

/**
 * Remove uma quantidade de uma denominacao especifica. Se a pilha dessa
 * denominacao ja tiver saldo suficiente, so decrementa ela; senao converte.
 */
export function removerQuantidadeMoeda(moedas, tipo, qtd) {
  const m = normalizeWallet(moedas);
  if (!DENOMINACOES.includes(tipo) || qtd <= 0) return { sucesso: false, moedas: m };
  const qtdInt = Math.floor(qtd);
  const custoEmCobre = qtdInt * VALOR_EM_COBRE[tipo];
  if (!podePagar(m, custoEmCobre)) return { sucesso: false, moedas: m };
  if (m[tipo] >= qtdInt) {
    return { sucesso: true, moedas: { ...m, [tipo]: m[tipo] - qtdInt } };
  }
  return retirarValor(m, custoEmCobre);
}

/**
 * Retorna a proxima denominacao maior que `tipo` e quantas moedas de `tipo`
 * formam 1 unidade dela (ex: pc -> {tipoDestino:'pp', taxa:10}).
 * Retorna null se `tipo` ja for a maior denominacao.
 */
export function proximaDenominacaoMaior(tipo) {
  const ordenadas = denominationsByValueDesc(VALOR_EM_COBRE);
  const idx = ordenadas.indexOf(tipo);
  if (idx <= 0) return null;
  const tipoDestino = ordenadas[idx - 1];
  return { tipoDestino, taxa: VALOR_EM_COBRE[tipoDestino] / VALOR_EM_COBRE[tipo] };
}

/**
 * Converte manualmente o maximo possivel de uma denominacao para a proxima
 * maior. Nao mexe nas demais denominacoes.
 */
export function converterParaMaior(moedas, tipo) {
  const m = normalizeWallet(moedas);
  const prox = proximaDenominacaoMaior(tipo);
  if (!prox) return { sucesso: false, moedas: m };
  const qtdConvertida = Math.floor(m[tipo] / prox.taxa);
  if (qtdConvertida <= 0) return { sucesso: false, moedas: m };
  m[tipo] -= qtdConvertida * prox.taxa;
  m[prox.tipoDestino] += qtdConvertida;
  return { sucesso: true, moedas: m };
}

/** Formata a carteira como texto legivel, so denominacoes com saldo > 0 (ordem PL->PC) */
export function formatarCarteira(moedas) {
  return formatWallet(moedas);
}

/** Extrai {tipo, qtd, cobre} de uma string de custo tipo "25 PO". Retorna null se nao for parseavel. */
export function parseCusto(texto) {
  const parsed = parseCostText(texto, VALOR_EM_COBRE);
  if (parsed === null || parsed.copper === null) return null;
  return { tipo: parsed.denomination, qtd: parsed.quantity, cobre: parsed.copper };
}

/** Verifica se a carteira cobre uma string de custo (ex: "50 PO") */
export function podePagarCusto(moedas, custoStr) {
  const c = parseCusto(custoStr);
  if (!c) return false;
  return podePagar(moedas, c.cobre);
}

/** Paga uma string de custo (ex: "50 PO"), convertendo moedas automaticamente se necessario */
export function pagarCusto(moedas, custoStr) {
  const c = parseCusto(custoStr);
  if (!c) return { sucesso: false, moedas: normalizeWallet(moedas) };
  return retirarValor(moedas, c.cobre);
}
