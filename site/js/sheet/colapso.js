// ============================================================
// Estado de colapso das secoes
//
// Guarda quais secoes estao recolhidas e persiste isso por personagem
// no localStorage. As duas funcoes de evento moram aqui porque sao elas
// que reatribuem `_detalhesColapsada` e `_truquesColapsados`.
// Extraido de site/js/pages/sheet.js sem alteracao de comportamento.
// ============================================================
import { char } from './estado.js';
// Estado de colapso das seções do inventário (sobrevive a re-renders parciais)
export const _secoesInvColapsadas = { equipados: false, mochila: false, esgotados: false };
// Estado de colapso da seção de Detalhes
export let _detalhesColapsada = false;
// Estado de colapso da seção de Truques (padrão: colapsada)
export let _truquesColapsados = true;

/** Chave localStorage para persistir estado de colapso do personagem atual */
function _getCollapseStorageKey() {
  return `sheet_collapse_${char?.id || 'default'}`;
}

/** Carrega estado de colapso do localStorage (resetando para defaults antes) */
export function _carregarEstadoColapso() {
  _secoesInvColapsadas.equipados = false;
  _secoesInvColapsadas.mochila = false;
  _secoesInvColapsadas.esgotados = false;
  _detalhesColapsada = false;
  _truquesColapsados = true;
  try {
    const raw = localStorage.getItem(_getCollapseStorageKey());
    if (!raw) return;
    const estado = JSON.parse(raw);
    if (typeof estado.equipados === 'boolean') _secoesInvColapsadas.equipados = estado.equipados;
    if (typeof estado.mochila === 'boolean') _secoesInvColapsadas.mochila = estado.mochila;
    if (typeof estado.esgotados === 'boolean') _secoesInvColapsadas.esgotados = estado.esgotados;
    if (typeof estado.detalhes === 'boolean') _detalhesColapsada = estado.detalhes;
    if (typeof estado.truques === 'boolean') _truquesColapsados = estado.truques;
  } catch (_) { /* ignorar erros de parse */ }
}

/** Persiste estado de colapso atual no localStorage */
export function _salvarEstadoColapso() {
  try {
    localStorage.setItem(_getCollapseStorageKey(), JSON.stringify({
      equipados: _secoesInvColapsadas.equipados,
      mochila: _secoesInvColapsadas.mochila,
      esgotados: _secoesInvColapsadas.esgotados,
      detalhes: _detalhesColapsada,
      truques: _truquesColapsados
    }));
  } catch (_) { /* ignorar erros de storage */ }
}

/** Setup de evento para colapsar/expandir a seção Detalhes */
export function setupEventosDetalhesColapso() {
  const header = document.querySelector('[data-toggle-detalhes]');
  if (!header) return;
  header.addEventListener('click', e => {
    // Não colapsar se o clique foi no botão Editar
    if (e.target.closest('#btn-edit-detalhes')) return;
    _detalhesColapsada = !_detalhesColapsada;
    header.classList.toggle('detalhes-header-colapsado', _detalhesColapsada);
    const body = document.getElementById('detalhes-body');
    if (body) body.classList.toggle('detalhes-body-oculto', _detalhesColapsada);
    _salvarEstadoColapso();
  });
}

/** Setup de evento para persistir colapso da seção Truques */
export function setupEventosTruquesColapso() {
  const details = document.getElementById('details-truques');
  if (!details) return;
  details.addEventListener('toggle', () => {
    _truquesColapsados = !details.open;
    _salvarEstadoColapso();
  });
}