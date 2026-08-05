// Stub mínimo de `window` para permitir importar `site/js/utils.js` em Node
// puro (sem browser/JSDOM/linkedom): o módulo faz DUAS atribuições de topo
// de arquivo (`window.fecharModal = ...`/`window.fecharModalTodos = ...`,
// compatibilidade com o padrão legado de handlers `onclick` globais) que
// nunca são chamadas por este teste — só precisam de um objeto para
// receber a propriedade, não de uma implementação real de `window`.
// Precisa ser importado ANTES de `site/js/utils.js` (ordem de import
// estático em ESM é avaliada na ordem em que aparece no arquivo).
if (typeof globalThis.window === 'undefined') {
  globalThis.window = {};
}
