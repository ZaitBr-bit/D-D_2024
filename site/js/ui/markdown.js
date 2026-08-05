// Módulo `ui/markdown`: renderizador de Markdown SEGURO POR CONSTRUÇÃO para
// as descrições do catálogo (`dados/pacotes/**`), que são conteúdo NÃO
// CONFIÁVEL (Global Constraint do plano de refatoração).
//
// ## Por que não é "sanitizar o HTML gerado"
//
// A abordagem antiga (`mdParaHtml` em `site/js/utils.js`) produz uma STRING
// de HTML que o chamador joga em `innerHTML`. A segurança dela depende
// inteiramente de o escape inicial estar correto em todos os caminhos — um
// único ponto onde o escape não acontece vira execução de script.
//
// Aqui o resultado é um `DocumentFragment` montado com `createElement` /
// `createTextNode`. Nenhum caractere do conteúdo é jamais interpretado como
// markup: as ÚNICAS tags que existem no resultado são as que este módulo
// cria, a partir de uma ALLOWLIST fechada (`ALLOWED_TAGS`), e o único
// atributo emitido é `class="table-wrapper"` (constante, nunca derivada de
// conteúdo). Não há sanitização por blacklist em nenhum ponto — nada é
// "removido por ser perigoso"; o que não está na allowlist simplesmente
// nunca chega a ser criado.
//
// ## Por que o pipeline abaixo parece o `mdParaHtml` legado
//
// Isso é deliberado e é um requisito: `tests/unit/ui/markdown-fidelity.test.js`
// roda os DOIS renderizadores sobre TODAS as descrições reais do pacote
// `dnd2024` (milhares de strings — magias, características de classe e
// subclasse, glossário, equipamento, antecedentes, talentos) e exige
// equivalência de DOM normalizado, com uma lista explícita de diferenças
// permitidas. Um renderizador "melhor" que mudasse a formatação visível de
// qualquer descrição legítima seria uma REGRESSÃO, não uma melhoria — a
// unificação de gramática de Markdown, se acontecer, é uma decisão de
// produto separada.
//
// Por isso a gramática aqui reproduz a do baseline passo a passo, inclusive
// suas idiossincrasias (ver `TABLE_HEADER_DETECTION` abaixo). O que muda é
// apenas COMO o resultado é materializado: marcadores internos inertes em vez
// de tags textuais, resolvidos em nós reais no final.

const SCOPE_TAGS = Object.freeze(['p', 'h3', 'h4', 'strong', 'em', 'ul', 'li', 'div', 'table', 'tr', 'td', 'th']);

/**
 * Allowlist fechada de tags que este renderizador pode criar. Qualquer outro
 * nome de tag é um defeito de programação deste módulo (nunca algo que o
 * conteúdo possa influenciar) e faz `buildFragment` lançar.
 * @type {ReadonlySet<string>}
 */
const ALLOWED_TAGS = new Set(SCOPE_TAGS);

/**
 * Único atributo que o renderizador emite, com valor constante. Não existe
 * caminho por onde conteúdo vire nome ou valor de atributo.
 * @type {Readonly<{table: string}>}
 */
const ALLOWED_CLASS_NAMES = Object.freeze({ tableWrapper: 'table-wrapper' });

// Delimitador dos marcadores internos. `\u0000` é impossível no texto que
// chega até aqui porque `stripControlCharacters` o remove ANTES de qualquer
// marcador ser criado — é isso que garante que conteúdo não consegue forjar
// um marcador.
const MARK = '\u0000';

// Marcadores começam com `<` de propósito: o passo de parágrafos do baseline
// decide se envolve a linha em `<p>` testando `trimmed.startsWith('<')`.
// Reproduzir esse caractere é o que mantém a decisão idêntica à do baseline
// para linhas que começam com uma tag (ex.: `**Alarme Mental.** ...`, que no
// baseline vira uma linha iniciada por `<strong>` e por isso NÃO recebe `<p>`).
// `[a-z0-9]+` (e não `[a-z]+`): os nomes de tag da allowlist incluem `h3`/`h4`.
const MARKER_PATTERN = new RegExp(`<${MARK}([oc]):([a-z0-9]+):(\\d+)${MARK}>`, 'g');

/**
 * Fonte de regex (como string) do marcador de abertura de uma tag.
 * @param {string} tag
 * @returns {string}
 */
function openMarkerSource(tag) {
  return `<\\u0000o:${tag}:\\d+\\u0000>`;
}

/**
 * Fonte de regex (como string) do marcador de fechamento de uma tag.
 * @param {string} tag
 * @returns {string}
 */
function closeMarkerSource(tag) {
  return `<\\u0000c:${tag}:\\d+\\u0000>`;
}

// Agrupamentos de bloco do baseline, traduzidos para marcadores. As duas
// expressões são os equivalentes exatos de
// `/((?:<li>.+<\/li>\n?)+)/g` e `/((?:<tr>.+<\/tr>\n?)+)/g`.
const LI_GROUP_PATTERN = new RegExp(`((?:${openMarkerSource('li')}.+${closeMarkerSource('li')}\\n?)+)`, 'g');
const TR_GROUP_PATTERN = new RegExp(`((?:${openMarkerSource('tr')}.+${closeMarkerSource('tr')}\\n?)+)`, 'g');

// Controles C0/DEL removidos antes de qualquer processamento. Tabulacao
// (U+0009), quebra de linha (U+000A) e retorno de carro (U+000D) ficam DE
// FORA desta faixa porque a gramatica do baseline depende deles (quebra de
// linha e significativa). Os demais sao removidos por seguranca: e o que
// impede o conteudo de conter U+0000 e tentar forjar um marcador interno.
// O teste de fidelidade prova que nenhuma descricao real do catalogo contem
// um desses caracteres - ou seja, esta normalizacao nao altera conteudo
// legitimo, so fecha o caminho de forja.
const STRIPPED_CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;

// Entidades produzidas pelo passo de escape inicial. A decodificação é feita
// em UMA passada (nunca em cascata), o que a torna a inversa exata do escape:
// `&lt;` original vira `&amp;lt;` no escape e volta a `&lt;` aqui.
const ESCAPED_ENTITY_PATTERN = /&(amp|lt|gt);/g;
const ESCAPED_ENTITY_VALUES = Object.freeze({ amp: '&', lt: '<', gt: '>' });

// Idiossincrasia preservada do baseline: a detecção de célula de cabeçalho
// (`th`) testa `/^\*\*.+\*\*$/` DEPOIS de o passo de negrito já ter
// convertido todo `**...**`. Na prática, portanto, ela nunca casa e toda
// célula vira `td` — inclusive a primeira linha de uma tabela em negrito.
// Isso é reproduzido de propósito: mudar para `th` alteraria a renderização
// de todas as tabelas do catálogo (estilo/semântica), o que este task não
// pode fazer. O teste de fidelidade cobre esse comportamento.
const TABLE_HEADER_DETECTION = /^\*\*.+\*\*$/;
const TABLE_SEPARATOR_CELL = /^[\s-:]+$/;

/**
 * Remove os controles C0 que não fazem parte da gramática.
 * @param {string} text
 * @returns {string}
 */
function stripControlCharacters(text) {
  return text.replace(STRIPPED_CONTROL_CHARACTERS, '');
}

/**
 * Escape inicial (`&`, `<`, `>`), idêntico ao do baseline.
 *
 * Ele NÃO é o que garante a segurança aqui — a segurança vem de o resultado
 * final ser montado com `createTextNode`. Ele existe porque a gramática do
 * baseline toma decisões olhando para o texto já escapado (ex.: uma linha que
 * começa com `<` literal no conteúdo vira `&lt;` e, portanto, RECEBE `<p>`);
 * sem este passo, o resultado divergiria do baseline exatamente nas entradas
 * maliciosas. O texto é decodificado de volta na hora de criar cada nó de
 * texto, onde já é inerte por construção.
 * @param {string} text
 * @returns {string}
 */
function escapeSource(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Desfaz `escapeSource` em uma única passada.
 * @param {string} text
 * @returns {string}
 */
function decodeEscapedText(text) {
  return text.replace(ESCAPED_ENTITY_PATTERN, (_match, name) => ESCAPED_ENTITY_VALUES[name]);
}

/**
 * Cria o coletor de elementos e as funções que emitem marcadores.
 * @returns {{elements: Array<{tag: string, className: (string|null)}>, wrap: Function}}
 */
function createMarkupCollector() {
  const elements = [];

  /**
   * Registra um elemento da allowlist e devolve o texto marcado
   * (`abertura + inner + fechamento`).
   * @param {string} tag - tag da allowlist.
   * @param {string} inner - conteúdo já marcado/textual.
   * @param {string} [className] - única classe permitida, quando aplicável.
   * @returns {string}
   */
  function wrap(tag, inner, className) {
    if (!ALLOWED_TAGS.has(tag)) {
      throw new Error(`ui/markdown: tag "${tag}" fora da allowlist.`);
    }
    const id = elements.length;
    elements.push({ tag, className: className ?? null });
    return `<${MARK}o:${tag}:${id}${MARK}>${inner}<${MARK}c:${tag}:${id}${MARK}>`;
  }

  return { elements, wrap };
}

/**
 * Executa a gramática do baseline sobre `text`, emitindo marcadores em vez de
 * tags textuais. Devolve a string marcada e a tabela de elementos.
 * @param {string} text
 * @returns {{marked: string, elements: Array<{tag: string, className: (string|null)}>}}
 */
function markup(text) {
  const { elements, wrap } = createMarkupCollector();

  // 1. Escape do texto de origem (ver `escapeSource`).
  let working = escapeSource(stripControlCharacters(text));

  // 2. Notação de dados: 3d6 -> 🎲3d6🎲. É uma transformação puramente
  //    textual e roda antes de tudo, como no baseline (por isso nenhum passo
  //    posterior precisa se preocupar com dígitos).
  working = working.replace(/(\d+)[dD](\d+)/g, '🎲$1d$2🎲');

  // 3. Títulos. `####` antes de `###` para que um h4 não seja capturado pelo h3.
  working = working.replace(/^#### (.+)$/gm, (_match, content) => wrap('h4', content));
  working = working.replace(/^### (.+)$/gm, (_match, content) => wrap('h3', content));

  // 4. Ênfase, na mesma ordem do baseline (mais específico primeiro).
  working = working.replace(/\*\*\*(.+?)\*\*\*/g, (_match, content) => wrap('strong', wrap('em', content)));
  working = working.replace(/\*\*(.+?)\*\*/g, (_match, content) => wrap('strong', content));
  working = working.replace(/\*(.+?)\*/g, (_match, content) => wrap('em', content));

  // 5. Itens de lista (linha inteira iniciada por "-" ou "•").
  working = working.replace(/^[-•]\s+(.+)$/gm, (_match, content) => wrap('li', content));

  // 6. Linhas de tabela delimitadas por "|".
  working = working.replace(/\|(.+)\|/g, (match) => {
    const cells = match.split('|').filter((cell) => cell.trim());
    if (cells.every((cell) => TABLE_SEPARATOR_CELL.test(cell))) {
      return '';
    }
    const cellTag = cells.some((cell) => TABLE_HEADER_DETECTION.test(cell.trim())) ? 'th' : 'td';
    const row = cells.map((cell) => wrap(cellTag, cell.trim().replace(/\*\*/g, ''))).join('');
    return wrap('tr', row);
  });

  // 7. Agrupar itens de lista consecutivos em uma `<ul>`.
  working = working.replace(LI_GROUP_PATTERN, (_match, group) => wrap('ul', group));

  // 8. Agrupar linhas de tabela consecutivas em `div.table-wrapper > table`.
  working = working.replace(TR_GROUP_PATTERN, (_match, group) =>
    wrap('div', wrap('table', group), ALLOWED_CLASS_NAMES.tableWrapper),
  );

  // 9. Parágrafos: linha não vazia que não começa com tag vira `<p>`.
  working = working
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) {
        return '';
      }
      if (trimmed.startsWith('<')) {
        return trimmed;
      }
      return wrap('p', trimmed);
    })
    .join('\n');

  return { marked: working, elements };
}

/**
 * Materializa a string marcada em nós DOM reais.
 *
 * Este é o único ponto onde nós são criados, e ele só sabe fazer duas coisas:
 * criar um elemento da allowlist (a partir da tabela `elements`, que só este
 * módulo escreve) ou criar um nó de TEXTO. Não existe caminho pelo qual um
 * trecho de conteúdo vire tag, atributo ou handler.
 * @param {object} documentRef - `document` (ou equivalente de teste).
 * @param {string} marked
 * @param {ReadonlyArray<{tag: string, className: (string|null)}>} elements
 * @returns {object} DocumentFragment
 */
function buildFragment(documentRef, marked, elements) {
  const fragment = documentRef.createDocumentFragment();
  /** @type {Array<{id: number, node: object}>} */
  const stack = [];
  let current = fragment;
  let cursor = 0;

  /**
   * Anexa o texto acumulado entre dois marcadores como nó de texto.
   * @param {string} raw
   */
  function appendText(raw) {
    if (raw === '') {
      return;
    }
    current.appendChild(documentRef.createTextNode(decodeEscapedText(raw)));
  }

  MARKER_PATTERN.lastIndex = 0;
  let match = MARKER_PATTERN.exec(marked);
  while (match) {
    appendText(marked.slice(cursor, match.index));
    cursor = match.index + match[0].length;

    const [, kind, tag, rawId] = match;
    const id = Number(rawId);
    const descriptor = elements[id];
    if (!descriptor || descriptor.tag !== tag || !ALLOWED_TAGS.has(tag)) {
      throw new Error(`ui/markdown: marcador inconsistente (${kind}:${tag}:${id}).`);
    }

    if (kind === 'o') {
      const element = documentRef.createElement(tag);
      if (descriptor.className) {
        element.setAttribute('class', descriptor.className);
      }
      current.appendChild(element);
      stack.push({ id, node: current });
      current = element;
    } else {
      // Fechamento. A geração de marcadores é sempre balanceada; o `while`
      // abaixo existe só para que um agrupamento que atravesse fronteiras
      // (possível com entradas patológicas, como no baseline) feche os
      // elementos pendentes em vez de corromper a árvore.
      let entry = stack.pop();
      while (entry && entry.id !== id) {
        current = entry.node;
        entry = stack.pop();
      }
      current = entry ? entry.node : fragment;
    }

    match = MARKER_PATTERN.exec(marked);
  }

  appendText(marked.slice(cursor));
  return fragment;
}

/**
 * Renderiza `text` (Markdown restrito do catálogo) em um `DocumentFragment`
 * seguro. Conteúdo malicioso — `<script>`, `onerror=`, `javascript:`, SVG,
 * data URL, tag malformada — sobrevive como TEXTO literal e nunca como
 * markup, handler ou atributo.
 * @param {object} documentRef - `document` (ou um documento de teste isolado).
 * @param {*} text - texto Markdown; `null`/`undefined`/`''` produzem fragmento vazio.
 * @returns {object} DocumentFragment
 */
export function renderSafeMarkdown(documentRef, text) {
  if (!documentRef || typeof documentRef.createDocumentFragment !== 'function') {
    throw new TypeError('renderSafeMarkdown: "documentRef" precisa ser um Document.');
  }
  if (text === null || text === undefined || text === '') {
    return documentRef.createDocumentFragment();
  }
  const { marked, elements } = markup(String(text));
  return buildFragment(documentRef, marked, elements);
}

/**
 * Mesma renderização de `renderSafeMarkdown`, serializada como string de
 * HTML. Existe SOMENTE para a fachada legada `mdParaHtml` (site/js/utils.js),
 * cujos consumidores ainda montam markup por string; código novo deve usar o
 * fragmento diretamente. A string é produzida pelo serializador do DOM sobre
 * uma árvore já segura — não há concatenação de conteúdo com markup.
 * @param {object} documentRef
 * @param {*} text
 * @returns {string}
 */
export function renderSafeMarkdownToHtml(documentRef, text) {
  const container = documentRef.createElement('div');
  container.appendChild(renderSafeMarkdown(documentRef, text));
  return container.innerHTML;
}
