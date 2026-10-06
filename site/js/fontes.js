// ============================================================
// Tag de origem: chip clicável que diz de qual livro um conteúdo veio.
//
// Registro com campo `fonte` ganha o chip; sem `fonte` o conteúdo é do
// Livro do Jogador e nada é desenhado. Os nomes vêm de dados/fontes.json.
// ============================================================
import { getFontes } from './db.js';
import { escHtml } from './utils.js';

let _fontes = new Map();
let _carga = null;
let _popover = null;
let _popoverBotao = null;

/** Substitui o registro em memória (usado pela carga e pelos testes). */
export function definirFontes(lista) {
  _fontes = new Map((lista || []).map((f) => [f.id, f]));
}

/**
 * Carrega dados/fontes.json e devolve o mapa id -> fonte. O resultado fica
 * em cache só quando a carga tem sucesso; falha (rejeição ou dado ausente)
 * libera nova tentativa na próxima chamada.
 */
export async function carregarFontes() {
  if (!_carga) {
    _carga = getFontes().then((d) => {
      if (!d?.fontes) throw new Error('fontes.json indisponível');
      definirFontes(d.fontes);
      return _fontes;
    }).catch((err) => { _carga = null; throw err; });
  }
  return _carga;
}

/** Nome completo do livro; o próprio id quando o registro não o conhece. */
export function nomeDaFonte(fonteId) {
  return _fontes.get(fonteId)?.nome || fonteId;
}

/** HTML do chip para o id da fonte; string vazia sem fonte. */
export function seloFonte(fonteId) {
  if (!fonteId) return '';
  const f = _fontes.get(fonteId);
  if (!f && _fontes.size) console.warn(`fonte desconhecida: ${fonteId}`);
  const rotulo = f?.sigla || fonteId;
  return `<button type="button" class="selo-fonte" data-fonte="${escHtml(fonteId)}" title="Origem do conteúdo">${escHtml(rotulo)}</button>`;
}

/** Fecha o popover de origem aberto, se houver. */
export function fecharPopoverFonte() {
  if (_popover) _popover.remove();
  _popover = null;
  _popoverBotao = null;
  document.removeEventListener('click', fecharAoClicarFora, true);
  document.removeEventListener('keydown', fecharComEsc, true);
  window.removeEventListener('hashchange', fecharPopoverFonte);
}

/** Fecha o popover quando o clique cai fora dele. */
function fecharAoClicarFora(e) {
  if (_popover && !_popover.contains(e.target) && !e.target.closest?.('.selo-fonte')) fecharPopoverFonte();
}

/** Fecha o popover com Esc sem deixar o Esc fechar o modal por baixo. */
function fecharComEsc(e) {
  if (e.key === 'Escape' && _popover) { e.stopPropagation(); fecharPopoverFonte(); }
}

/** Abre, ancorado no chip, o popover com o nome completo do livro; clicar no chip já aberto fecha. */
async function abrirPopoverFonte(botao) {
  const id = botao.dataset.fonte;
  const jaAberto = _popover?.dataset.popoverFonte === id && _popoverBotao === botao;
  fecharPopoverFonte();
  if (jaAberto) return;
  try { await carregarFontes(); } catch { /* sem registro: o popover mostra o id */ }
  fecharPopoverFonte();
  const pop = document.createElement('div');
  pop.className = 'popover-fonte';
  pop.setAttribute('role', 'dialog');
  pop.dataset.popoverFonte = id;
  pop.innerHTML = `<div class="popover-fonte-rotulo">Origem</div><div class="popover-fonte-nome">${escHtml(nomeDaFonte(id))}</div>`;
  document.body.appendChild(pop);
  const r = botao.getBoundingClientRect();
  const largura = document.documentElement.clientWidth;
  pop.style.top = `${window.scrollY + r.bottom + 6}px`;
  pop.style.left = `${Math.max(8, Math.min(window.scrollX + r.left, window.scrollX + largura - pop.offsetWidth - 8))}px`;
  _popover = pop;
  _popoverBotao = botao;
  window.addEventListener('hashchange', fecharPopoverFonte);
  setTimeout(() => {
    if (_popover !== pop) return;
    document.addEventListener('click', fecharAoClicarFora, true);
    document.addEventListener('keydown', fecharComEsc, true);
  }, 0);
}

/**
 * Liga o clique de todos os chips dentro de `container`. O clique não
 * propaga nem executa a ação padrão: chip dentro de card ou <label> não
 * seleciona o card/radio por baixo.
 */
export function ligarSelosFonte(container) {
  (container || document).querySelectorAll('.selo-fonte').forEach((botao) => {
    if (botao.dataset.seloLigado) return;
    botao.dataset.seloLigado = '1';
    botao.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      abrirPopoverFonte(botao);
    });
  });
}
