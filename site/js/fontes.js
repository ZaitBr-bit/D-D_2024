export const FONTE_FRHOF = Object.freeze({
  id: 'frhof-2025',
  nome: 'Forgotten Realms: Heroes of Faerûn',
  rotulo: 'Heróis de Faerûn',
  tipo: 'expansao',
  ano: 2025
});

const FONTES = new Map([[FONTE_FRHOF.id, FONTE_FRHOF]]);
const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

function escaparHtml(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, caractere => ESCAPES[caractere]);
}

export function obterIdFonte(valor) {
  if (!valor || typeof valor !== 'object') return '';
  if (Object.hasOwn(valor, 'fonte')) {
    return typeof valor.fonte?.id === 'string' ? valor.fonte.id : '';
  }
  return typeof valor.id === 'string'
    ? valor.id
    : '';
}

export function ehFonte(valor, id) {
  return obterIdFonte(valor) === id;
}

export function clonarFonte(fonte) {
  if (!fonte || typeof fonte !== 'object' || !FONTES.has(fonte.id)) return null;
  return { ...FONTES.get(fonte.id) };
}

export function extrairDadosConteudo(conteudo) {
  if (!conteudo || typeof conteudo !== 'object' || Array.isArray(conteudo)) return {};
  const { nome: _nome, fonte: _fonte, ...dados } = conteudo;
  return dados;
}

export function obterRotuloFonte(valor) {
  const registro = FONTES.get(obterIdFonte(valor));
  return registro?.rotulo || '';
}

export function renderSeloFonte(fonte) {
  const registro = FONTES.get(obterIdFonte(fonte));
  if (!registro) return '';
  return `<span class="badge badge-fonte" title="Fonte: ${escaparHtml(registro.nome)} (${registro.ano})">${escaparHtml(registro.rotulo)}</span>`;
}
