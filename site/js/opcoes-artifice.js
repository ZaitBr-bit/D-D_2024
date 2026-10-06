// ============================================================
// Adaptadores do Artífice para o contrato de ui-opcoes.js.
// Traduzem itens do equipamento, itens mágicos do acervo, magias do índice
// e armas/armaduras-base em opções de card (nome, resumo e detalhe).
// ============================================================
import { escHtml } from './utils.js';
import { deMagias } from './opcoes-dominio.js';
import { htmlCorpoItemMagico } from './itens-magicos-ui.js';

/** Primeira frase/trecho de um texto, limitado a `max` caracteres, sem marcação de markdown. */
function trecho(texto, max = 110) {
  const limpo = String(texto || '').replace(/[*_#>`]/g, '').replace(/\s+/g, ' ').trim();
  if (limpo.length <= max) return limpo;
  return `${limpo.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Opções dos itens da Magia de Funileiro. `porNome` é o mapa nome -> registro de
 * equipamento_aventura.json; item sem registro (Ampola) vira card mínimo "Item genérico".
 */
export function deItensFunileiro(nomes, porNome) {
  return nomes.map((nome) => {
    const reg = porNome.get(nome);
    if (!reg) return { id: nome, nome, resumo: 'Item genérico', detalhe: '', tags: [], grupo: '', bloqueado: null };
    const partes = [reg.peso && reg.peso !== '—' ? reg.peso : null, reg.custo, trecho(reg.descricao, 90)].filter(Boolean);
    return {
      id: nome,
      nome,
      resumo: partes.join(' · '),
      detalhe: reg.descricao ? `<div style="font-size:0.85rem">${escHtml(reg.descricao)}</div>` : '',
      tags: [],
      grupo: '',
      bloqueado: null,
    };
  });
}

/** Opções das magias do Item de Armazenar Magia: círculo, escola, conjuração, alcance e componentes no resumo. */
export function deMagiasArmazenar(magias) {
  const base = deMagias(magias);
  return base.map((o, i) => {
    const m = magias[i];
    return {
      ...o,
      resumo: [
        m.circulo === 0 ? 'Truque' : `${m.circulo}º Círculo`, m.escola, m.tempo_conjuracao, m.alcance, m.componentes,
      ].filter(Boolean).join(' · '),
    };
  });
}

/**
 * Opção de um item mágico do acervo (item ou variante). `id` é a identidade devolvida na seleção;
 * `nome` sobrescreve o título (ex.: item com base).
 */
export function deItemMagicoAcervo(alvo, { id, nome = null, bloqueado = null, grupo = '' } = {}) {
  const { item, variante } = alvo;
  const v = variante || item;
  const raridade = v.raridade || item.raridade;
  const sint = (variante?.requer_sintonizacao ?? item.requer_sintonizacao) ? 'Sintonização' : null;
  const curta = trecho(variante?.descricao || item.descricao, 100);
  return {
    id,
    nome: nome || v.nome,
    resumo: [raridade, sint, item.tipo, curta].filter(Boolean).join(' · '),
    detalhe: htmlCorpoItemMagico({ linha_tipo: item.linha_tipo, descricao_magica: variante?.descricao || item.descricao, tabelas: item.tabelas }),
    tags: [],
    grupo,
    bloqueado,
  };
}

/** Opção mínima de um item sem entrada no acervo (dado ausente): só o nome. */
export function deItemMinimo(id, nome, resumo = '') {
  return { id, nome, resumo, detalhe: '', tags: [], grupo: '', bloqueado: null };
}

/** Opções de arma/armadura-base: dano ou CA, propriedades e peso. */
export function deBasesItem(bases) {
  return bases.map((a) => {
    const ehArma = Boolean(a.dano);
    const resumo = [
      ehArma ? a.dano : (a.ca ? `CA ${a.ca}` : null),
      ehArma ? a.propriedades : a.categoria,
      a.peso && a.peso !== '—' ? a.peso : null,
    ].filter(Boolean).join(' · ');
    return {
      id: a.nome,
      nome: a.nome,
      resumo,
      detalhe: [
        a.categoria ? `<div><strong>Categoria:</strong> ${escHtml(a.categoria)}</div>` : '',
        a.propriedades ? `<div><strong>Propriedades:</strong> ${escHtml(a.propriedades)}</div>` : '',
        a.maestria ? `<div><strong>Maestria:</strong> ${escHtml(a.maestria)}</div>` : '',
        a.requisito_forca && a.requisito_forca !== '—' ? `<div><strong>Requisito de Força:</strong> ${escHtml(a.requisito_forca)}</div>` : '',
        a.furtividade && a.furtividade !== '—' ? `<div><strong>Furtividade:</strong> ${escHtml(a.furtividade)}</div>` : '',
        a.custo ? `<div><strong>Custo:</strong> ${escHtml(a.custo)}</div>` : '',
      ].join(''),
      tags: [],
      grupo: '',
      bloqueado: null,
    };
  });
}

/** Opções de card dos efeitos do Elixir Experimental: nome e texto do efeito no resumo. */
export function deEfeitosElixir(efeitos, textoDe) {
  return efeitos.map((e) => ({ id: e, nome: e, resumo: textoDe(e), detalhe: '', tags: [], grupo: '', bloqueado: null }));
}
