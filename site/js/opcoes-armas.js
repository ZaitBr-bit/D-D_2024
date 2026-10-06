// ============================================================
// Adaptadores de cards para o item personalizado: propriedades de arma e
// maestrias, no contrato de opção de ui-opcoes.js. A descrição vem do
// glossário do livro (dados/equipamento/armas.json -> propriedades).
// ============================================================
import { escHtml } from './utils.js';

// As maestrias de arma do catálogo (dados/equipamento/armas.json): o campo do item
// customizado oferece só nomes que existem no livro.
export const MAESTRIAS_ARMA = ['Afligir', 'Derrubar', 'Drenar', 'Empurrar', 'Garantido', 'Lentidão', 'Trespassar', 'Ágil'];

/** As dez propriedades de arma do livro (Equipamento.md, "Propriedades"). */
export const PROPRIEDADES_ARMA = ['Acuidade', 'Alcance', 'Arremesso', 'Duas Mãos', 'Extensão', 'Leve', 'Munição', 'Pesada', 'Recarga', 'Versátil'];

/** Primeira frase da descrição, cortada em 110 caracteres, para a linha de resumo do card. */
function resumoDe(texto) {
  const t = String(texto || '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  const frase = t.split(/(?<=[.!?])\s/)[0];
  return frase.length > 110 ? `${frase.slice(0, 107)}…` : frase;
}

/** Opção de card para um nome do glossário (resumo e detalhe vêm da descrição, escapada). */
function opcaoDoGlossario(nome, glossario) {
  const desc = (glossario || []).find(p => p?.nome === nome)?.descricao || '';
  return {
    id: nome,
    nome,
    resumo: resumoDe(desc),
    detalhe: desc ? `<p>${escHtml(desc)}</p>` : '',
  };
}

/**
 * Cards de propriedade: as 10 do livro (só para item de categoria de arma) mais o card
 * "Personalizada…", que fica disponível para qualquer item (issue #135).
 * @param {Array<{nome: string, descricao: string}>} [glossario]
 * @param {{ehArma?: boolean}} [opcoes]
 * @returns {Array<object>} opções no contrato de ui-opcoes.js
 */
export function opcoesPropriedadesArma(glossario = [], { ehArma = true } = {}) {
  return [
    ...(ehArma ? PROPRIEDADES_ARMA.map(nome => opcaoDoGlossario(nome, glossario)) : []),
    { id: '__personalizada__', nome: 'Personalizada…', resumo: 'Crie uma propriedade com nome e descrição próprios.' },
  ];
}

/**
 * Cards das maestrias de arma, com "Nenhuma" como primeira opção (sem maestria).
 * @param {Array<{nome: string, descricao: string}>} [glossario]
 * @returns {Array<object>} opções no contrato de ui-opcoes.js
 */
export function opcoesMaestriaArma(glossario = []) {
  return [
    { id: '__nenhuma__', nome: 'Nenhuma', resumo: 'O item não tem maestria.' },
    ...MAESTRIAS_ARMA.map(nome => opcaoDoGlossario(nome, glossario)),
  ];
}
