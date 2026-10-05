// ============================================================
// Ajuste do modal ao teclado virtual do celular.
//
// No iOS o teclado não reduz o viewport de layout: o modal ancorado embaixo
// fica atrás dele. `window.visualViewport` informa a área realmente visível;
// este módulo copia essa área para variáveis CSS do overlay e liga a classe
// `teclado-aberto` (regras em app.css, seção "Seletor de itens").
// ============================================================

/** Diferença mínima (px) entre a janela e a área visível para contar como teclado aberto. */
const MARGEM_TECLADO_PX = 120;

/**
 * Mede a área visível. Sem `visualViewport` (navegador antigo) devolve
 * teclado fechado.
 * @param {{height: number, offsetTop: number}|null|undefined} vv `window.visualViewport`
 * @param {number} alturaJanela `window.innerHeight`
 * @returns {{aberto: boolean, topo: number, altura: number}}
 */
export function medirTeclado(vv, alturaJanela) {
  if (!vv) return { aberto: false, topo: 0, altura: alturaJanela };
  return {
    aberto: alturaJanela - vv.height > MARGEM_TECLADO_PX,
    topo: vv.offsetTop || 0,
    altura: vv.height,
  };
}

/**
 * Mantém o `overlay` restrito à área visível enquanto o teclado está aberto.
 * Lê `window.visualViewport` no momento da chamada.
 * @param {HTMLElement} overlay elemento `.modal-overlay`
 * @returns {() => void} função que desliga os ouvintes e limpa o overlay
 */
export function ajustarOverlayAoTeclado(overlay) {
  const vv = window.visualViewport;
  if (!vv || !overlay) return () => {};
  const limpar = () => {
    overlay.classList.remove('teclado-aberto');
    overlay.style.removeProperty('--vv-topo');
    overlay.style.removeProperty('--vv-altura');
  };
  const aplicar = () => {
    const medida = medirTeclado(vv, window.innerHeight);
    if (!medida.aberto) { limpar(); return; }
    overlay.style.setProperty('--vv-topo', `${medida.topo}px`);
    overlay.style.setProperty('--vv-altura', `${medida.altura}px`);
    overlay.classList.add('teclado-aberto');
  };
  vv.addEventListener('resize', aplicar);
  vv.addEventListener('scroll', aplicar);
  aplicar();
  return () => {
    vv.removeEventListener('resize', aplicar);
    vv.removeEventListener('scroll', aplicar);
    limpar();
  };
}
