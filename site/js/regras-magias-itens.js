// ============================================================
// Magias conjuradas por itens mágicos: opções de custo, situação do botão
// "Conjurar", pagamento em cargas/usos da 4A e rótulos da linha.
//
// Regra pura, sem DOM (spec 2026-10-04-itens-magicos-4b). O pagamento usa o
// `estado_recursos` de regras-recursos-itens.js; a conjuração em si fica com
// sheet/magias.js (conjurarSemEspaco).
// ============================================================
import { itemAtivo } from './regras-itens-magicos.js';
import { gastarCargas, gastarUso, recursosDoItem } from './regras-recursos-itens.js';

/** Magias curadas do item; lista vazia quando não há. */
export function magiasDoItem(item) {
  return Array.isArray(item?.dados?.magias) ? item.dados.magias : [];
}

/** Opções de pagamento da magia, uma por gasto possível, com o círculo resultante. */
export function opcoesDeCusto(magia) {
  const base = magia.circulo_base ?? 0;
  const c = magia.custo;
  if (c === 'livre') return [{ cargas: 0, circulo: base }];
  if (c?.uso !== undefined) return [{ uso: c.uso, circulo: c.circulo ?? base }];
  if (c?.cargas_max !== undefined) {
    const out = [];
    for (let n = c.cargas; n <= c.cargas_max; n++) out.push({ cargas: n, circulo: base + (n - c.cargas) });
    return out;
  }
  return [{ cargas: c.cargas, circulo: c.circulo ?? base }];
}

/** Se a opção pode ser paga agora; `motivo` é a dica do botão desabilitado. */
export function situacaoConjuracao(item, opcao) {
  if (item?.destruido) return { ok: false, motivo: 'Item destruído' };
  if (!item?.equipado) return { ok: false, motivo: 'Equipe o item' };
  if (!itemAtivo(item)) return { ok: false, motivo: 'Sintonize o item' };
  // Leitura sem `garantirEstadoRecursos`: consultar a situação não cria nem altera o estado.
  const est = item.estado_recursos;
  if (opcao.uso !== undefined) {
    const uso = (recursosDoItem(item)?.usos || []).find(u => u.nome === opcao.uso);
    if (!uso || (est?.usos?.[opcao.uso] || 0) >= uso.max) return { ok: false, motivo: 'Uso já gasto' };
    return { ok: true, motivo: '' };
  }
  if (opcao.cargas > 0) {
    const max = recursosDoItem(item)?.cargas?.max;
    if (!max || (est?.cargas ?? max) < opcao.cargas) return { ok: false, motivo: 'Cargas insuficientes' };
  }
  return { ok: true, motivo: '' };
}

/** Paga a opção (cargas ou uso) se possível; devolve a regra da última carga quando o item zerou. */
export function pagarConjuracao(item, opcao) {
  if (!situacaoConjuracao(item, opcao).ok) return { ok: false, ultimaCarga: null };
  if (opcao.uso !== undefined) return { ok: gastarUso(item, opcao.uso), ultimaCarga: null };
  if (!opcao.cargas) return { ok: true, ultimaCarga: null };
  const { ultimaCarga } = gastarCargas(item, opcao.cargas);
  return { ok: true, ultimaCarga };
}

/** Linhas do bloco "Magias de Itens": itens não destruídos com magias, na ordem do inventário. */
export function magiasDeItens(personagem) {
  const out = [];
  (personagem?.inventario || []).forEach((item, idx) => {
    if (!item || item.destruido) return;
    magiasDoItem(item).forEach((magia, k) => {
      const opcoes = opcoesDeCusto(magia);
      out.push({ idx, item, k, magia, opcoes, situacao: situacaoConjuracao(item, opcoes[0]) });
    });
  });
  return out;
}

const ROTULO_RECUPERA_USO = { amanhecer: 'amanhecer', descanso_longo: 'descanso longo', descanso_curto: 'descanso curto' };

/**
 * Texto do custo: "1–3 cargas", "5 cargas (5º círculo)", "1 carga",
 * "uso: Teia (1/amanhecer)", "livre". O sufixo "(N/recuperação)" do uso só
 * aparece quando `item` é informado e traz o uso em `dados.recursos.usos`.
 */
export function rotuloCusto(magia, item = null) {
  const c = magia.custo;
  if (c === 'livre') return 'livre';
  if (c?.uso !== undefined) {
    const jaTemCirculo = /\d+º círculo/.test(c.uso);
    const uso = (recursosDoItem(item)?.usos || []).find(u => u.nome === c.uso);
    const freq = uso ? `${uso.max}/${ROTULO_RECUPERA_USO[uso.recupera] || uso.recupera}` : '';
    const circ = c.circulo !== undefined && !jaTemCirculo ? `${c.circulo}º círculo` : '';
    const extra = [circ, freq].filter(Boolean).join(', ');
    return extra ? `uso: ${c.uso} (${extra})` : `uso: ${c.uso}`;
  }
  if (c?.cargas === 0) return 'livre';
  const plural = (n) => `${n} carga${n === 1 ? '' : 's'}`;
  if (c.cargas_max !== undefined) return `${c.cargas}–${c.cargas_max} cargas`;
  if (c.circulo !== undefined) return `${plural(c.cargas)} (${c.circulo}º círculo)`;
  return plural(c.cargas);
}

/** Bônus com sinal: "+7" ou "-1". */
function comSinal(n) {
  return n < 0 ? String(n) : `+${n}`;
}

/** Texto da CD/ataque da magia; `personagem` traz a CD e o ataque de magia da ficha (0 quando não conjura). */
export function rotuloConjuracao(magia, personagem) {
  const cj = magia.conjuracao;
  if (!cj) return { texto: '', title: '' };
  if (cj === 'sua') {
    if (!personagem?.cd) return { texto: '—', title: 'sem atributo de conjuração' };
    return { texto: `CD ${personagem.cd} · ${comSinal(personagem.ataque)}`, title: 'CD e ataque de magia do personagem' };
  }
  const partes = [];
  if (cj.cd !== undefined) partes.push(`CD ${cj.cd}`);
  if (cj.ataque !== undefined) partes.push(comSinal(cj.ataque));
  return { texto: partes.join(' · '), title: '' };
}
