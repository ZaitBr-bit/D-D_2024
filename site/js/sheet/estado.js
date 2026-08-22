import { salvarPersonagem } from '../store.js';
import { escHtml } from '../utils.js';

// Estilos visuais (cor e emoji) para cada atributo
export const ATRIBUTO_ESTILO = {
  forca:        { emoji: '💪', cor: '#b71c1c' },
  destreza:     { emoji: '🏹', cor: '#1b5e20' },
  constituicao: { emoji: '🛡️', cor: '#e65100' },
  inteligencia: { emoji: '📖', cor: '#0d47a1' },
  sabedoria:    { emoji: '🔮', cor: '#4a148c' },
  carisma:      { emoji: '✨', cor: '#c62828' }
};

export let char = null;
export let containerRef = null;
export let classeData = null;
export let indiceMagiasCache = null;
export let talentosCache = null;
export let especiesCache = null;
export let magiasDominioCache = null;
export let magiasSempreCache = null;
export let passivosTalentosCache = null;

export function salvar() {
  salvarPersonagem(char);
}

export function campoEstaEditado(caminho) {
  const campos = char?.edicoes?.campos;
  const atual = caminho.split('.').reduce((valor, chave) => valor?.[chave], char);
  if (campos?.[caminho]) return JSON.stringify(atual) !== JSON.stringify(campos[caminho].original);
  const separador = caminho.lastIndexOf('.');
  if (separador > 0) {
    const pai = caminho.slice(0, separador);
    const filho = caminho.slice(separador + 1);
    if (campos?.[pai]) return JSON.stringify(atual) !== JSON.stringify(campos[pai].original?.[filho]);
  }
  return false;
}

export function seloEdicao(caminho) {
  const campos = char?.edicoes?.campos;
  const separador = caminho.lastIndexOf('.');
  const entrada = campos?.[caminho] || (separador > 0 ? campos?.[caminho.slice(0, separador)] : null);
  if (!campoEstaEditado(caminho)) return '';
  if (!entrada) return '';
  return `<span class="badge no-print" style="font-size:0.6rem;margin-left:4px" title="Editado em ${escHtml(entrada.editadoEm)}">Editado</span>`;
}

/**
 * Delta manual acumulado de um atributo -- a parte do total que veio de edicao
 * livre, e nao do metodo de criacao, do antecedente ou de ganho de nivel.
 * Devolve 0 quando aquele atributo nunca foi ajustado a mao.
 * @param {string} key - Chave do atributo (ex.: 'destreza').
 * @returns {number} Delta manual acumulado (pode ser negativo).
 */
export function deltaManualAtributo(key) {
  const manual = char?.edicoes?.campos?.atributos?.manual;
  return Number(manual?.[key] || 0);
}

/**
 * Linha de marcacao do ajuste manual de um atributo, com a composicao completa
 * no `title` -- base, bonus de antecedente, ganho de sistema (Aumento de
 * Atributo/capstone) e a parte manual, mais a data. O ganho de sistema entra
 * so quando diferente de zero; sem ele a composicao nao fecha com o total
 * exibido para quem ja subiu de nivel (mesmo achado da revisao da Task 4, em
 * sheet/edicao.js). Sai vazia quando o atributo nao foi editado a mao. Leva
 * `no-print` de proposito: a ficha impressa mostra o resultado, nao o
 * historico.
 * @param {string} key - Chave do atributo (ex.: 'destreza').
 * @returns {string} HTML da marca, ou string vazia.
 */
export function marcaAjusteManual(key) {
  const delta = deltaManualAtributo(key);
  if (!delta) return '';
  const sinal = delta > 0 ? '+' : '';
  const base = char?.atributos_base?.[key] ?? 0;
  const bonus = char?.bonus_antecedente?.[key] || 0;
  const partes = [`base ${base}`];
  if (bonus) partes.push(`+${bonus} antecedente`);
  const ganhoSistema = (char?.atributos?.[key] ?? 0) - base - bonus - delta;
  if (ganhoSistema) partes.push(`${ganhoSistema > 0 ? '+' : ''}${ganhoSistema} nível`);
  partes.push(`${sinal}${delta} manual`);
  const editadoEm = char?.edicoes?.campos?.atributos?.editadoEm;
  if (editadoEm) partes.push(new Date(editadoEm).toLocaleDateString('pt-BR'));
  return `<div class="no-print" style="font-size:0.65rem;font-weight:700;color:var(--info);margin-top:2px" title="${escHtml(partes.join(' · '))}">✏️ ${sinal}${delta} manual</div>`;
}

// --- Setters -------------------------------------------------------------
// Modulos ES nao permitem atribuir a um binding importado. Estas nove funcoes
// sao a UNICA adicao de codigo da ficha (spec 3.1); todas sao chamadas
// exclusivamente por renderSheet, uma vez cada, na abertura da ficha.

/** Define o personagem atual da ficha. Chamado so por renderSheet. */
export function definirChar(valor) { char = valor; }

/** Define o conteiner raiz da ficha. Chamado so por renderSheet. */
export function definirContainer(valor) { containerRef = valor; }

/** Define os dados da classe do personagem. Chamado so por renderSheet. */
export function definirClasseData(valor) { classeData = valor; }

/** Define o cache do indice de magias. Chamado so por renderSheet. */
export function definirIndiceMagias(valor) { indiceMagiasCache = valor; }

/** Define o cache de talentos. Chamado so por renderSheet. */
export function definirTalentos(valor) { talentosCache = valor; }

/** Define o cache de especies. Chamado so por renderSheet. */
export function definirEspecies(valor) { especiesCache = valor; }

/** Define o cache de magias de dominio. Chamado so por renderSheet. */
export function definirMagiasDominio(valor) { magiasDominioCache = valor; }

/** Define o cache de magias sempre preparadas. Chamado so por renderSheet. */
export function definirMagiasSempre(valor) { magiasSempreCache = valor; }

/** Define o cache de passivos de talentos. Chamado so por renderSheet. */
export function definirPassivosTalentos(valor) { passivosTalentosCache = valor; }
