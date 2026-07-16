// ============================================================
// Sistema de carteira multi-moeda (PC, PP, PE, PO, PL) com conversao automatica
// Tabela oficial D&D 5e 2024: 10 PC = 1 PP | 10 PP = 1 PO | 2 PE = 1 PO | 10 PO = 1 PL
// ============================================================

// Ordem decrescente de valor (maior -> menor)
export const DENOMINACOES = ['pl', 'po', 'pe', 'pp', 'pc'];

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

// Taxas padrao (D&D 5e 2024): valor de cada denominacao em PC, a unidade-base de conversao
const TAXAS_PADRAO = { pl: 1000, po: 100, pe: 50, pp: 10, pc: 1 };

// Valor de cada denominacao em PC. Mutavel via definirTaxas() para permitir taxas customizadas.
export const VALOR_EM_COBRE = { ...TAXAS_PADRAO };

// Ordem crescente de valor (menor -> maior), usada para conversao manual "pra cima"
const DENOMINACOES_ASC = [...DENOMINACOES].reverse();

/**
 * Aplica taxas de conversao customizadas (muta VALOR_EM_COBRE). PC e sempre a
 * unidade-base (valor 1, nao editavel). Exige que pp/pe/po/pl sejam inteiros
 * positivos, estritamente crescentes, e cada um multiplo inteiro do anterior
 * na cadeia (pc -> pp -> pe -> po -> pl) para as conversoes ficarem exatas.
 */
export function definirTaxas(taxas) {
  const cand = { pc: 1, pp: Number(taxas.pp), pe: Number(taxas.pe), po: Number(taxas.po), pl: Number(taxas.pl) };
  const ordem = ['pc', 'pp', 'pe', 'po', 'pl'];
  for (const tipo of ordem) {
    if (!Number.isInteger(cand[tipo]) || cand[tipo] <= 0) {
      return { sucesso: false, erro: `Taxa de ${tipo.toUpperCase()} invalida (precisa ser inteiro positivo)` };
    }
  }
  for (let i = 1; i < ordem.length; i++) {
    const anterior = cand[ordem[i - 1]];
    const atual = cand[ordem[i]];
    if (atual <= anterior || atual % anterior !== 0) {
      return { sucesso: false, erro: `${ordem[i].toUpperCase()} deve ser multiplo inteiro maior que ${ordem[i - 1].toUpperCase()}` };
    }
  }
  Object.assign(VALOR_EM_COBRE, cand);
  return { sucesso: true, taxas: { ...VALOR_EM_COBRE } };
}

/** Restaura as taxas de conversao padrao (D&D 5e 2024) */
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
  return { pc: 0, pp: 0, pe: 0, po: 0, pl: 0 };
}

/** Garante que a carteira tem as 5 chaves como inteiros validos (>=0), zerando o que faltar/for invalido */
export function normalizarCarteira(moedas) {
  const m = moedas && typeof moedas === 'object' ? moedas : {};
  const out = {};
  for (const tipo of DENOMINACOES) {
    const v = Number(m[tipo]);
    out[tipo] = Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
  }
  return out;
}

/** Soma o valor total da carteira convertido para PC (peca de cobre) */
export function totalEmCobre(moedas) {
  const m = normalizarCarteira(moedas);
  return DENOMINACOES.reduce((soma, tipo) => soma + m[tipo] * VALOR_EM_COBRE[tipo], 0);
}

/** Redistribui um valor em PC nas 5 denominacoes, usando o menor numero de moedas (guloso, maior->menor) */
export function distribuirCobre(totalCobre) {
  let resto = Math.max(0, Math.floor(totalCobre));
  const out = criarCarteiraVazia();
  for (const tipo of DENOMINACOES) {
    const valor = VALOR_EM_COBRE[tipo];
    out[tipo] = Math.floor(resto / valor);
    resto -= out[tipo] * valor;
  }
  return out;
}

/** Adiciona uma quantidade de uma denominacao especifica (sem conversao) */
export function adicionarMoeda(moedas, tipo, qtd) {
  const m = normalizarCarteira(moedas);
  if (!DENOMINACOES.includes(tipo) || qtd <= 0) return m;
  m[tipo] += Math.floor(qtd);
  return m;
}

/** Verifica se a carteira tem valor total suficiente (em PC) para cobrir um custo */
export function podePagar(moedas, custoEmCobre) {
  return totalEmCobre(moedas) >= custoEmCobre;
}

/**
 * Retira um valor (em PC) da carteira, convertendo moedas maiores automaticamente
 * quando a denominacao especifica nao for suficiente: reduz o total ao novo valor
 * e redistribui nas 5 denominacoes (menor numero de moedas possivel).
 */
export function retirarValor(moedas, custoEmCobre) {
  const total = totalEmCobre(moedas);
  if (total < custoEmCobre) return { sucesso: false, moedas: normalizarCarteira(moedas) };
  const novoTotal = total - custoEmCobre;
  return { sucesso: true, moedas: distribuirCobre(novoTotal) };
}

/**
 * Remove uma quantidade de uma denominacao especifica. Se a pilha dessa
 * denominacao ja tiver saldo suficiente, so decrementa ela (sem mexer nas
 * demais). So converte moedas maiores (via retirarValor) quando a pilha
 * especifica nao for suficiente para cobrir a quantidade pedida.
 */
export function removerQuantidadeMoeda(moedas, tipo, qtd) {
  const m = normalizarCarteira(moedas);
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
 * Retorna null se `tipo` ja for a maior denominacao (pl).
 */
export function proximaDenominacaoMaior(tipo) {
  const idx = DENOMINACOES_ASC.indexOf(tipo);
  if (idx === -1 || idx === DENOMINACOES_ASC.length - 1) return null;
  const tipoDestino = DENOMINACOES_ASC[idx + 1];
  const taxa = VALOR_EM_COBRE[tipoDestino] / VALOR_EM_COBRE[tipo];
  return { tipoDestino, taxa };
}

/**
 * Converte manualmente o maximo possivel de uma denominacao para a proxima
 * maior (ex: 25 PC com taxa 10 -> 2 PP formadas, sobram 5 PC). Nao mexe nas
 * demais denominacoes. Falha se nao houver `taxa` unidades para converter.
 */
export function converterParaMaior(moedas, tipo) {
  const m = normalizarCarteira(moedas);
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
  const m = normalizarCarteira(moedas);
  const partes = DENOMINACOES.filter(tipo => m[tipo] > 0).map(tipo => `${m[tipo]} ${tipo.toUpperCase()}`);
  return partes.length > 0 ? partes.join(', ') : '0 PO';
}

/** Extrai {tipo, qtd, cobre} de uma string de custo tipo "25 PO", "5 PP", "1.000 PO". Retorna null se nao for parseavel (ex: "Varia"). */
export function parseCusto(texto) {
  if (!texto) return null;
  const m = String(texto).trim().match(/^(\d{1,3}(?:\.\d{3})+|\d+)\s*(PC|PP|PE|PO|PL)$/i);
  if (!m) return null;
  const qtd = parseInt(m[1].replace(/\./g, ''), 10);
  const tipo = m[2].toLowerCase();
  return { tipo, qtd, cobre: qtd * VALOR_EM_COBRE[tipo] };
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
  if (!c) return { sucesso: false, moedas: normalizarCarteira(moedas) };
  return retirarValor(moedas, c.cobre);
}
