// Módulo `features/sheet/pdf/pdf-drawing-plan`: o PLANO DE DESENHO do PDF.
//
// ## Por que um plano, e não um desenho
//
// No baseline, gerar o PDF era `_renderizarPdf(PDFLib, ...)`: uma função que só
// existia com a biblioteca carregada, que desenhava direto na página e cujo
// resultado era um array de bytes. Não havia como testar o CONTEÚDO sem tentar
// fazer parsing de PDF — e por isso o único teste possível era "o arquivo
// começa com %PDF-".
//
// Aqui a geração é dividida em duas metades:
//
//   1. `createPdfDrawingPlan(viewModel)` — PURA. Devolve a lista ORDENADA de
//      operações de desenho. Não conhece `pdf-lib`, não conhece `document`,
//      não faz `await`. É testável por igualdade.
//   2. `pdf-lib-backend.js` — executa as operações contra a biblioteca real.
//
// Toda operação que carrega um VALOR de ficha leva junto `semantic` (o nome
// canônico do campo, o mesmo de `../output-model.js`) e `value` (o valor
// bruto). É isso que permite ao `RecordingPdfBackend` provar a paridade
// tela/print/PDF comparando OPERAÇÕES, sem inferir texto dos bytes finais.
//
// ## Nenhuma etapa de HTML no meio
//
// O baseline montava o HTML de impressão, fazia `new DOMParser().parseFromString`
// e extraía blocos de texto de volta (`_extrairBlocosDetalhe`). Isso amarrava o
// PDF à ÁRVORE de um markup de tela: mudar uma classe CSS quebrava o PDF em
// silêncio. Aqui o PDF lê o mesmo modelo de saída que a impressão lê, e
// `DOMParser` não aparece em lugar nenhum deste caminho — o teste focal varre
// o fonte.

import { buildSheetOutputModel } from '../output-model.js';

/**
 * Tipos de operação do plano. Fechado: o backend recusa qualquer outro.
 * @type {Readonly<Record<string, string>>}
 */
export const PDF_OPERATIONS = Object.freeze({
  addPage: 'add-page',
  drawRectangle: 'draw-rectangle',
  drawText: 'draw-text',
});

/** Fontes disponíveis (as duas padrão do PDF, sem embutir arquivo). */
export const PDF_FONTS = Object.freeze({ regular: 'regular', bold: 'bold' });

/** Dimensões A4 em pontos e a margem, iguais às do baseline. */
export const PAGE_WIDTH = 595.28;
export const PAGE_HEIGHT = 841.89;
export const PAGE_MARGIN = 36;

/** Paleta do cartão, idêntica à do baseline (`_renderizarPdf`). */
export const PDF_COLORS = Object.freeze({
  maroon: Object.freeze({ r: 0.482, g: 0.176, b: 0.149 }),
  white: Object.freeze({ r: 1, g: 1, b: 1 }),
  subWhite: Object.freeze({ r: 0.93, g: 0.9, b: 0.88 }),
  ink: Object.freeze({ r: 0.13, g: 0.13, b: 0.13 }),
  gray: Object.freeze({ r: 0.45, g: 0.45, b: 0.45 }),
  line: Object.freeze({ r: 0.78, g: 0.76, b: 0.73 }),
  softBg: Object.freeze({ r: 0.965, g: 0.95, b: 0.93 }),
});

/**
 * Pontuação Unicode que a Helvetica padrão (WinAnsi/CP1252) codifica. Fora
 * disso e de Latin-1, o caractere vira `?` — a MESMA lista do baseline
 * (`_PDF_UNICODE_OK`), porque a limitação é da fonte, não do código.
 * @type {ReadonlySet<string>}
 */
const UNICODE_OK = new Set(['–', '—', '‘', '’', '“', '”', '…', '•', '€', '™']);

/**
 * Substitui por `?` todo caractere que a fonte padrão não codifica. Sem isto,
 * `drawText` LANÇA no meio da geração e o jogador fica sem PDF nenhum.
 * @param {*} value
 * @returns {string}
 */
export function sanitizePdfText(value) {
  if (value === null || value === undefined) {
    return '';
  }
  let saida = '';
  for (const ch of String(value)) {
    saida += ch.codePointAt(0) <= 0xff || UNICODE_OK.has(ch) ? ch : '?';
  }
  return saida;
}

/**
 * Cria o plano de desenho do PDF da ficha.
 *
 * @param {object} viewModel - `SheetViewModel`.
 * @returns {ReadonlyArray<Readonly<object>>} operações na ordem de execução.
 *   Um ViewModel inválido produz um plano de UMA página com a recusa escrita —
 *   nunca um plano vazio, que geraria um PDF em branco sem explicação.
 */
export function createPdfDrawingPlan(viewModel) {
  const modelo = buildSheetOutputModel(viewModel);
  /** @type {Array<object>} */
  const ops = [];
  let y = 0;

  /**
   * Abre uma página nova e reposiciona o cursor no topo útil.
   * @returns {void}
   */
  function novaPagina() {
    ops.push(Object.freeze({ op: PDF_OPERATIONS.addPage, width: PAGE_WIDTH, height: PAGE_HEIGHT }));
    y = PAGE_HEIGHT - PAGE_MARGIN;
  }

  /**
   * Garante espaço vertical; abre página nova quando não cabe.
   * @param {number} altura
   * @returns {void}
   */
  function garantir(altura) {
    if (y - altura < PAGE_MARGIN) {
      novaPagina();
    }
  }

  /**
   * Empilha uma operação de texto.
   * @param {{text: string, x: number, y: number, size: number, font?: string, color?: object, semantic?: string|null, value?: *}} params
   * @returns {void}
   */
  function texto({ text, x, y: baseline, size, font = PDF_FONTS.regular, color = PDF_COLORS.ink, semantic = null, value = null }) {
    ops.push(
      Object.freeze({
        op: PDF_OPERATIONS.drawText,
        text: sanitizePdfText(text),
        x,
        y: baseline,
        size,
        font,
        color,
        semantic,
        // O valor BRUTO viaja junto do desenho. É o que o teste de paridade
        // compara — e é por isso que ele nunca precisa fazer parsing do PDF.
        value: value === undefined ? null : value,
      }),
    );
  }

  /**
   * Empilha um retângulo.
   * @param {object} params
   * @returns {void}
   */
  function retangulo(params) {
    ops.push(Object.freeze({ op: PDF_OPERATIONS.drawRectangle, ...params }));
  }

  novaPagina();

  if (modelo.ok !== true) {
    texto({ text: `Não foi possível gerar o PDF: ${modelo.error.code}`, x: PAGE_MARGIN, y: y - 20, size: 12, font: PDF_FONTS.bold });
    return Object.freeze(ops);
  }

  const { headline, blocks } = modelo.value;
  const largura = PAGE_WIDTH - 2 * PAGE_MARGIN;

  // --- Faixa de cabeçalho (sangria total no topo) --------------------------
  const alturaFaixa = 60;
  retangulo({ x: 0, y: PAGE_HEIGHT - alturaFaixa, width: PAGE_WIDTH, height: alturaFaixa, color: PDF_COLORS.maroon });
  texto({ text: headline.name, x: PAGE_MARGIN, y: PAGE_HEIGHT - 30, size: 20, font: PDF_FONTS.bold, color: PDF_COLORS.white, semantic: 'headline.name', value: headline.name });
  texto({
    text: headline.subtitle,
    x: PAGE_MARGIN,
    y: PAGE_HEIGHT - 46,
    size: 9.5,
    color: PDF_COLORS.subWhite,
    semantic: 'headline.subtitle',
    value: headline.subtitle,
  });
  y = PAGE_HEIGHT - alturaFaixa - 12;

  for (const bloco of blocks) {
    // Cabeçalho de bloco: faixa vinho com o título em branco.
    garantir(28);
    retangulo({ x: PAGE_MARGIN, y: y - 15, width: largura, height: 15, color: PDF_COLORS.maroon });
    texto({ text: bloco.title.toUpperCase(), x: PAGE_MARGIN + 6, y: y - 11, size: 8.5, font: PDF_FONTS.bold, color: PDF_COLORS.white });
    y -= 20;

    if (typeof bloco.unavailableReason === 'string' && bloco.unavailableReason.length > 0) {
      // O motivo é DESENHADO. Um bloco que some do PDF faz o jogador acreditar
      // que ele não tem nada ali.
      garantir(14);
      texto({
        text: `Indisponível: ${bloco.unavailableReason}`,
        x: PAGE_MARGIN + 2,
        y: y - 8,
        size: 8,
        color: PDF_COLORS.gray,
        semantic: `${bloco.id}.unavailableReason`,
        value: bloco.unavailableReason,
      });
      y -= 14;
    }

    // Entradas em três colunas de caixa, como as caixas de atributo do cartão.
    const colunas = 3;
    const larguraColuna = largura / colunas;
    const alturaLinha = 26;
    let indice = 0;
    for (const entrada of bloco.entries) {
      const coluna = indice % colunas;
      if (coluna === 0) {
        garantir(alturaLinha + 2);
      }
      const x = PAGE_MARGIN + coluna * larguraColuna;
      retangulo({
        x,
        y: y - alturaLinha,
        width: larguraColuna - 4,
        height: alturaLinha,
        color: PDF_COLORS.softBg,
        borderColor: PDF_COLORS.line,
        borderWidth: 1,
      });
      texto({ text: entrada.label, x: x + 4, y: y - 10, size: 6.5, color: PDF_COLORS.gray });
      texto({
        text: entrada.text,
        x: x + 4,
        y: y - 21,
        size: 9,
        font: PDF_FONTS.bold,
        semantic: entrada.semantic,
        value: entrada.value,
      });
      indice += 1;
      if (coluna === colunas - 1) {
        y -= alturaLinha + 2;
      }
    }
    if (bloco.entries.length % colunas !== 0) {
      y -= alturaLinha + 2;
    }
    y -= 6;
  }

  return Object.freeze(ops);
}
