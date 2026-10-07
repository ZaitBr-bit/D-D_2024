// ============================================================
// Dano e cura de PV de uma criatura da ficha (familiar, companheiros do
// Artífice): o mesmo modal do personagem (seletor de roda, campo "ou
// digite" e botão de confirmar), em vez de um campo solto de ±PV.
// ============================================================
import { abrirModal } from '../utils.js';
import { numberPickerHtml, setupNumberPicker } from './hp-descanso.js';

/**
 * Abre o modal de dano ou de cura de uma criatura e chama `aoAplicar` com o
 * valor confirmado. Nada é gravado aqui: quem chama aplica e salva.
 * @param {object} cfg
 * @param {string} cfg.nome Nome da criatura, mostrado no título.
 * @param {'dano'|'cura'} cfg.tipo Qual modal abrir.
 * @param {number} cfg.pvMax PV máximo da criatura (teto da cura).
 * @param {(valor: number) => void} cfg.aoAplicar Recebe o valor positivo confirmado.
 */
export function abrirModalPVCriatura({ nome, tipo, pvMax, aoAplicar }) {
  const dano = tipo === 'dano';
  const id = dano ? 'input-criatura-dano' : 'input-criatura-cura';
  const maximo = dano ? 999 : Math.max(1, pvMax);
  abrirModal(`${dano ? 'Dano Recebido' : 'Cura'} — ${nome}`,
    numberPickerHtml(id, 1, 1, maximo, dano ? 'Valor do dano' : 'Valor da cura'),
    '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>'
    + (dano
      ? '<button class="btn btn-danger" id="btn-aplicar-dano-criatura">Aplicar Dano</button>'
      : '<button class="btn btn-success" id="btn-aplicar-cura-criatura">Curar</button>'));
  setupNumberPicker(id);
  document.getElementById(dano ? 'btn-aplicar-dano-criatura' : 'btn-aplicar-cura-criatura')
    ?.addEventListener('click', () => {
      const valor = parseInt(document.getElementById(`${id}-val`)?.value, 10) || 0;
      if (valor <= 0) return;
      window.fecharModal();
      aoAplicar(valor);
    });
}
