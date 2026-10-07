// ============================================================
// Popup do erro de salvamento: o texto "Erro ao salvar" do indicador de sync vira
// um toque que abre o detalhe da falha num campo copiável.
// ============================================================
import { textoDoErroSync } from './sync.js';
import { abrirModal, escHtml, toast } from './utils.js';

/**
 * Copia o texto para a área de transferência; sem a API (ou sem permissão no celular),
 * seleciona o campo para o jogador copiar à mão.
 * @param {string} texto Texto a copiar.
 * @param {HTMLTextAreaElement|null} campo Campo com o mesmo texto, usado como alternativa.
 * @returns {Promise<boolean>} true se copiou.
 */
async function copiarTexto(texto, campo) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch { /* cai para a seleção manual */ }
  if (!campo) return false;
  campo.focus();
  campo.select();
  campo.setSelectionRange(0, texto.length);
  try { return document.execCommand('copy'); } catch { return false; }
}

/** Abre o popup com o detalhe da última falha de salvamento, num campo selecionável e com botão Copiar. */
export function abrirDetalheErroSync() {
  const texto = textoDoErroSync();
  abrirModal('Erro ao salvar', `
    <p style="font-size:0.85rem">A ficha continua salva neste aparelho. O erro abaixo é do envio para a nuvem; copie e envie para quem for investigar.</p>
    <textarea id="texto-erro-sync" class="form-input" readonly rows="12"
      style="width:100%;font-family:monospace;font-size:0.72rem;white-space:pre-wrap">${escHtml(texto)}</textarea>`,
  '<button class="btn btn-secondary" onclick="fecharModal()">Fechar</button>'
    + '<button class="btn btn-primary" id="btn-copiar-erro-sync">Copiar</button>');
  document.getElementById('btn-copiar-erro-sync')?.addEventListener('click', async () => {
    const copiou = await copiarTexto(texto, document.getElementById('texto-erro-sync'));
    toast(copiou ? 'Erro copiado.' : 'Toque no texto, selecione tudo e copie.', copiou ? 'success' : 'info');
  });
}

/** Liga, uma vez só, o toque no texto "Erro ao salvar" (o indicador é redesenhado, por isso a delegação). */
export function ligarDetalheErroSync() {
  if (window.__detalheErroSyncLigado) return;
  window.__detalheErroSyncLigado = true;
  document.addEventListener('click', (ev) => {
    if (ev.target.closest?.('[data-sync-erro]')) abrirDetalheErroSync();
  });
}
