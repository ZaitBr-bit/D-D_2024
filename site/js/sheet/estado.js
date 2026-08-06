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
