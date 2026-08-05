// Módulo `ui/failure-notice`: o aviso de RECUSA que uma tela mostra quando ela
// não pôde ser montada.
//
// Existe para que um composition root (o caso concreto: `pages/creator.js`)
// consiga recusar de forma VISÍVEL sem montar markup por conta própria. As
// duas alternativas eram piores:
//
//   - deixar o contêiner vazio: o jogador vê uma tela em branco e não tem como
//     saber se está carregando, se quebrou ou se não há nada mesmo;
//   - montar o aviso no próprio composition root: ele deixaria de ser fino e
//     passaria a conter apresentação, que é justamente o que o cutover do
//     criador tirou de lá.
//
// Tudo entra por `setSafeText`: o `code` e a `message` de um `AppError` podem
// carregar id/nome vindos de CONTEÚDO, e um aviso de erro não é motivo para
// abrir uma exceção de escape.

import { setSafeText } from './html.js';

/**
 * Substitui o conteúdo de `container` por um aviso de falha.
 *
 * @param {object} container - nó DOM que receberá o aviso.
 * @param {{title?: string, message?: string, code?: string|null}} params
 * @returns {object} o elemento do aviso, para quem quiser inspecioná-lo.
 */
export function renderFailureNotice(container, { title = 'Não foi possível abrir esta tela', message = '', code = null } = {}) {
  if (!container || typeof container.replaceChildren !== 'function') {
    throw new TypeError('renderFailureNotice: "container" deve ser um nó DOM.');
  }
  const doc = container.ownerDocument;

  const aviso = doc.createElement('div');
  aviso.className = 'empty-state';
  aviso.setAttribute('data-failure-notice', code === null ? '' : String(code));

  const titulo = doc.createElement('h2');
  setSafeText(titulo, title);
  aviso.appendChild(titulo);

  if (message) {
    const paragrafo = doc.createElement('p');
    setSafeText(paragrafo, message);
    aviso.appendChild(paragrafo);
  }

  if (code !== null && code !== '') {
    const codigo = doc.createElement('code');
    codigo.className = 'failure-notice-code';
    setSafeText(codigo, code);
    aviso.appendChild(codigo);
  }

  container.replaceChildren(aviso);
  return aviso;
}
