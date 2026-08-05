// Módulo `infra/config`: configuração de infraestrutura resolvida em tempo de
// execução, sem depender de reescrita de arquivo no deploy.
//
// ## Por que `import.meta.url`
//
// O carregador legado (`site/js/db.js`) usa a constante `'../dados'` e o
// workflow do GitHub Pages a troca por `'./dados'` com `sed`. Isso acopla o
// código ao layout de publicação e quebra silenciosamente sempre que a
// profundidade de um arquivo muda. Aqui a base é derivada da URL DESTE módulo:
//
//   site/js/infra/config.js  ->  ../../../  ->  raiz do projeto
//
// Em desenvolvimento com `node --test`, `import.meta.url` é um `file:` URL e a
// base aponta para o diretório real do repositório. Servido por HTTP (local ou
// GitHub Pages, em qualquer subdiretório), `import.meta.url` é a URL http(s)
// do módulo e a base acompanha automaticamente — nenhum host absoluto,
// nenhuma suposição de domínio raiz, nenhum `sed`.
//
// A barra final é obrigatória: `new URL('index.json', base)` só resolve para
// dentro do diretório quando a base termina em `/`.

/**
 * URL base do pacote de conteúdo oficial (`dados/pacotes/dnd2024/`),
 * resolvida em relação a este módulo. Sempre termina em `/`.
 * @type {URL}
 */
export const OFFICIAL_CONTENT_BASE_URL = new URL('../../../dados/pacotes/dnd2024/', import.meta.url);

/**
 * Namespace concedido ao pacote oficial. Fica aqui apenas como referência de
 * configuração; a concessão real de namespace/capacidade é feita pelo
 * composition root (`site/js/app-context.js`), nunca por este módulo.
 * @type {string}
 */
export const OFFICIAL_CONTENT_NAMESPACE = 'dnd2024';

/**
 * Nome do arquivo de manifesto dentro do pacote.
 * @type {string}
 */
export const MANIFEST_FILE_NAME = 'manifest.json';

/**
 * Nome do arquivo de índice dentro do pacote.
 * @type {string}
 */
export const INDEX_FILE_NAME = 'index.json';
