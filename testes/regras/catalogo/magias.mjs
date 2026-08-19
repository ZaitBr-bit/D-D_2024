// ============================================================
// Leitor das 391 magias de Informacoes Separadas/Magias.md.
//
// Diferente dos catálogos dos outros domínios, este NÃO transcreve nada à
// mão. O livro apresenta cada magia num formato rígido:
//
//   ## Nome
//
//   *Nº Círculo, Escola (Classe1, Classe2)*     <- ou "Truque de Escola (...)"
//
//   **Tempo de Conjuração:** ...
//   **Alcance:** ...
//   **Componentes:** ...                        <- ou "Componente:" (17 magias)
//   **Duração:** ...
//
//   descrição...
//
// Transcrever 391 × 7 fatos à mão introduziria mais erros do que pegaria, e
// o formato é legível por máquina. Então o oráculo aqui é o PRÓPRIO ARQUIVO
// do livro, e este módulo é só o leitor dele.
//
// PERIGO: um leitor leniente vira teatro. Toda tolerância abaixo tem um
// número medido no plano (docs/superpowers/plans/2026-08-18-magias-1-catalogo.md)
// e existe por uma inconsistência REAL da fonte -- nunca para "dar um jeito"
// quando o formato não é entendido. Quando não entende, devolve o campo como
// null e o motor acusa.
// ============================================================

/** Os 8 headings `##` de Magias.md que são seção de REGRA, não magia. */
export const SECOES_REGRA = new Set([
  'Preparando Magias', 'Círculo de Magia', 'Listas de Magia de Classe',
  'Tempo de Conjuração', 'Alcance', 'Componentes', 'Duração', 'Efeitos',
]);

/**
 * Quantas magias o livro apresenta. Guarda de tamanho: se o leitor passar a
 * encontrar outro número, alguma regra dele quebrou (ou o livro mudou), e
 * isso tem de ser um teste vermelho -- não um silêncio.
 */
export const TOTAL_MAGIAS_LIVRO = 391;

/**
 * Lê o cabeçalho em itálico de uma magia.
 *
 * Duas formas no livro: "Truque de <Escola> (classes)" e
 * "Nº Círculo, <Escola> (classes)". O ordinal aparece como `º` em 356 magias
 * e como `°` (sinal de grau) em 1 -- as duas entram.
 *
 * O cabeçalho é a PRIMEIRA linha em itálico que começa com "Truque" ou com um
 * número seguido de "Círculo": 72 magias trazem antes uma legenda de imagem,
 * também em itálico ("*Um elfo Mago demonstra...*"), e pegá-la no lugar do
 * cabeçalho foi o segundo erro do pré-voo.
 */
function lerCabecalho(bloco) {
  const italicos = (bloco.match(/^\*(.+?)\*$/gm) || []).map((l) => l.slice(1, -1));
  const cab = italicos.find((t) => /^(Truque|\d+\s*[º°]\s*C[íi]rculo)/.test(t));
  if (!cab) return null;
  const m = cab.match(/^(?:Truque de|(\d+)\s*[º°]\s*C[íi]rculo,)\s*([^(]+?)(?:\s*\(([^)]*)\))?\s*$/);
  if (!m) return null;
  return {
    circulo: m[1] ? Number(m[1]) : 0,
    escola: m[2].trim(),
    classes: m[3] ? m[3].split(',').map((s) => s.trim()).filter(Boolean) : [],
  };
}

/**
 * Lê todas as magias do texto do livro, devolvendo um Map por nome.
 * Campo que o leitor não entende vem `null` -- o motor é quem acusa.
 */
export function lerMagiasDoLivro(texto) {
  // `/\r?\n/`: o arquivo é CRLF. Dividir só por '\n' deixa um '\r' no fim de
  // cada linha, e o `$` do regex JS não casa com ele -- o leitor encontrava
  // ZERO magias, e o primeiro sintoma foi "as 391 sumiram do livro".
  const linhas = texto.split(/\r?\n/);
  const magias = new Map();

  for (let i = 0; i < linhas.length; i++) {
    const m = linhas[i].match(/^## (.+)$/);
    if (!m) continue;
    const nome = m[1].trim();
    if (SECOES_REGRA.has(nome)) continue;

    let fim = linhas.length;
    for (let j = i + 1; j < linhas.length; j++) {
      if (/^## /.test(linhas[j])) { fim = j; break; }
    }
    const bloco = linhas.slice(i, fim).join('\n');
    const campo = (re) => (bloco.match(re) || [])[1]?.trim() || null;
    const cab = lerCabecalho(bloco);

    magias.set(nome, {
      circulo: cab?.circulo ?? null,
      escola: cab?.escola ?? null,
      classes: cab?.classes ?? null,
      tempo_conjuracao: campo(/\*\*Tempo de Conjuração:\*\*\s*([^\n]+)/),
      alcance: campo(/\*\*Alcance:\*\*\s*([^\n]+)/),
      // "Componente:" no singular em 17 magias, "Componentes:" nas outras 374.
      componentes: campo(/\*\*Componentes?:\*\*\s*([^\n]+)/),
      duracao: campo(/\*\*Duração:\*\*\s*([^\n]+)/),
    });
  }
  return magias;
}
