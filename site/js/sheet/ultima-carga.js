// ============================================================
// Modal da regra da última carga (4A), compartilhado pelo − do inventário
// e pela conjuração de magia de item (4B).
// ============================================================
import { abrirModal, escHtml } from '../utils.js';
import { marcarDestruido } from '../regras-recursos-itens.js';
import { salvar } from './estado.js';
import { renderFichaCompleta } from './ficha.js';

/**
 * Pergunta o d20 ("destroi") ou mostra a frase do livro ("outro") depois que a
 * última carga foi gasta. "Sim" marca o item como destruído, salva e redesenha a ficha.
 */
export function perguntarUltimaCarga(item, ultimaCarga) {
  if (ultimaCarga?.efeito_com_1 === 'destroi') {
    abrirModal('Última carga', `<p>Você gastou a última carga de <strong>${escHtml(item.nome)}</strong>. Jogue 1d20. Saiu 1?</p>`,
      '<button class="btn btn-secondary" id="btn-ultima-carga-nao">Não</button><button class="btn btn-danger" id="btn-ultima-carga-sim">Sim, o item foi destruído</button>');
    document.getElementById('btn-ultima-carga-nao')?.addEventListener('click', () => window.fecharModal());
    document.getElementById('btn-ultima-carga-sim')?.addEventListener('click', () => {
      marcarDestruido(item);
      salvar();
      window.fecharModal();
      renderFichaCompleta();
    });
  } else if (ultimaCarga?.efeito_com_1 === 'outro') {
    // Texto que fala em destruição/perda do item: oferece marcar como destruído sem rolar d20 na ficha.
    const falaDeDestruicao = /destru|desaparec|perdid/i.test(ultimaCarga.texto || '');
    abrirModal('Última carga', `<p>${escHtml(ultimaCarga.texto)}</p><p style="font-size:0.8rem;color:var(--text-muted)">Jogue o dado e ajuste o item à mão, se for o caso.</p>`,
      `<button class="btn btn-primary" id="btn-ultima-carga-ok">Entendi</button>${falaDeDestruicao ? '<button class="btn btn-danger" id="btn-marcar-destruido">Marcar como destruído</button>' : ''}`);
    document.getElementById('btn-ultima-carga-ok')?.addEventListener('click', () => window.fecharModal());
    document.getElementById('btn-marcar-destruido')?.addEventListener('click', () => {
      marcarDestruido(item);
      salvar();
      window.fecharModal();
      renderFichaCompleta();
    });
  }
}
