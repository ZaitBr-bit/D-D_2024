// ============================================================
// Replicar Item Mágico (Artífice): planos conhecidos e itens replicados.
// Regra pura; a subida de nível e a ficha só desenham o resultado.
// Item replicado = item mágico do acervo + origem { tipo: 'replicado',
// conhecido_id, criado_em }. Nada sem essa origem é removido daqui.
// ============================================================
import { nivelNa, subclasseDe } from './regras-multiclasse.js';
import { montarItemInventario, opcoesDeBase } from './itens-magicos-catalogo.js';
import { ajustarCarga, recursosDoItem } from './regras-recursos-itens.js';
import { estadoArtifice } from './regras-artifice.js';

const RARIDADE_DRENAR = { Comum: 1, Incomum: 2, Rara: 2 };

/** Valor inteiro de uma coluna da tabela da classe no nível (0 para traço ou ausente). */
export function colunaTabela(tabela, nivel, coluna) {
  const linha = (tabela || []).find((r) => parseInt(r['Nível'], 10) === nivel);
  return parseInt(linha?.[coluna], 10) || 0;
}

/** Armeiro 9+ (Armeiro Aprimorado): plano e item extras de Armadura. */
export function ehArmeiroAprimorado(p) {
  return subclasseDe(p, 'Artífice') === 'Armeiro' && (nivelNa(p, 'Artífice') || 0) >= 9;
}

/** Máximo de planos conhecidos pelo nível de Artífice. */
export function planosConhecidosMax(tabela, p) {
  return colunaTabela(tabela, nivelNa(p, 'Artífice') || 0, 'Planos Conhecidos') + (ehArmeiroAprimorado(p) ? 1 : 0);
}

/** Máximo de itens replicados simultâneos pelo nível de Artífice. */
export function itensMagicosMax(tabela, p) {
  return colunaTabela(tabela, nivelNa(p, 'Artífice') || 0, 'Itens Mágicos') + (ehArmeiroAprimorado(p) ? 1 : 0);
}

/** Planos com nível mínimo até `nivel`. */
export function planosDisponiveis(planos, nivel) {
  return (planos || []).filter((p) => p.nivel_minimo <= nivel);
}

/** Item e variante do acervo para um plano (ou para um conhecido com item_id/variante_id). */
export function resolverPlano(plano, acervo) {
  const item = (acervo || []).find((i) => i.id === plano.item_id);
  if (!item) return null;
  if (!plano.variante_id) return { item, variante: null };
  const variante = (item.variantes || []).find((v) => v.id === plano.variante_id);
  return variante ? { item, variante } : null;
}

/** Itens/variantes concretos que satisfazem um plano genérico. */
export function candidatosGenerico(plano, acervo) {
  const g = plano.generico || {};
  const out = [];
  for (const item of acervo || []) {
    if (g.excluir_amaldicoados && item.amaldicoado) continue;
    if (g.tipos && !g.tipos.includes(item.tipo)) continue;
    if (g.excluir_tipos && g.excluir_tipos.includes(item.tipo)) continue;
    const regs = (item.variantes || []).length ? item.variantes.map((v) => ({ item, variante: v })) : [{ item, variante: null }];
    for (const r of regs) if ((g.raridades || []).includes((r.variante || r.item).raridade)) out.push(r);
  }
  return out;
}

/** Identidade de um conhecido: mesmo plano, item, variante e base = mesmo plano conhecido. */
export function chaveConhecido(c) {
  return [c.plano_id, c.item_id, c.variante_id || '', c.base_nome || ''].join('|');
}

/** Erros de uma lista de conhecidos: quantidade, repetição, nível, item válido, base e regra do Armeiro. */
export function validarConhecidos(conhecidos, ctx) {
  const e = [];
  if (conhecidos.length !== ctx.max) e.push(`Escolha ${ctx.max} plano(s); há ${conhecidos.length}.`);
  const chaves = conhecidos.map((c) => `${c.item_id}|${c.variante_id || ''}`);
  if (new Set(chaves).size !== chaves.length) e.push('Há plano repetido.');
  for (const c of conhecidos) {
    const plano = (ctx.planos || []).find((p) => p.id === c.plano_id);
    if (!plano) { e.push(`Plano desconhecido: ${c.plano_id}.`); continue; }
    if (plano.nivel_minimo > ctx.nivel) e.push(`"${(plano.nome || plano.nome_en)}" exige nível ${plano.nivel_minimo}.`);
    if (!plano.generico && (c.item_id !== plano.item_id || (c.variante_id || '') !== (plano.variante_id || ''))) {
      e.push(`Item de "${(plano.nome || plano.nome_en)}" não corresponde ao plano.`);
      continue;
    }
    const alvo = resolverPlano(c, ctx.acervo);
    if (!alvo) { e.push(`Item não encontrado para "${(plano.nome || plano.nome_en)}".`); continue; }
    if (plano.generico && !candidatosGenerico(plano, ctx.acervo).some((x) => x.item.id === alvo.item.id && (x.variante?.id || '') === (c.variante_id || ''))) {
      e.push(`"${(alvo.variante || alvo.item).nome}" não cabe em "${(plano.nome || plano.nome_en)}".`);
    }
    if (alvo.item.base && !c.base_nome) e.push(`Escolha a base de "${(alvo.variante || alvo.item).nome}".`);
    else if (alvo.item.base && (ctx.armas || ctx.armaduras)
      && !opcoesDeBase(alvo.item.base, { armas: ctx.armas, armaduras: ctx.armaduras }).some((b) => b.nome === c.base_nome)) {
      e.push(`Base inválida para "${(alvo.variante || alvo.item).nome}".`);
    }
  }
  if (ctx.armeiro && !conhecidos.some((c) => c.armeiro && resolverPlano(c, ctx.acervo)?.item.tipo === 'Armadura')) {
    e.push('Armeiro Aprimorado: marque um plano de Armadura como o plano extra.');
  }
  return e;
}

/** Quantos conhecidos de `antes` saíram em `depois` (as trocas feitas). */
export function trocasEntre(antes, depois) {
  const novas = new Set((depois || []).map(chaveConhecido));
  return (antes || []).filter((c) => !novas.has(chaveConhecido(c))).length;
}

/** Completa a lista até o máximo com planos disponíveis sem genérico nem base (escolha padrão e dos testes). */
export function completarCanonico(conhecidos, ctx) {
  const out = [...conhecidos];
  const precisaArmadura = !!ctx.armeiro && !out.some((c) => c.armeiro);
  // Lista já cheia sem plano do Armeiro: devolve inalterada e a validação reprova.
  if (precisaArmadura && out.length >= ctx.max) return out;
  const limite = precisaArmadura ? ctx.max - 1 : ctx.max;
  const usados = new Set(out.map((c) => `${c.item_id}|${c.variante_id || ''}`));
  for (const p of planosDisponiveis(ctx.planos, ctx.nivel)) {
    if (out.length >= limite) break;
    if (p.generico) continue;
    const alvo = resolverPlano(p, ctx.acervo);
    if (!alvo || alvo.item.base) continue;
    const chave = `${p.item_id}|${p.variante_id || ''}`;
    if (usados.has(chave)) continue;
    usados.add(chave);
    out.push({ id: `${p.id}-${out.length}`, plano_id: p.id, item_id: p.item_id, ...(p.variante_id ? { variante_id: p.variante_id } : {}) });
  }
  if (precisaArmadura) {
    // Plano de Armadura ainda não conhecido (senão a lista final teria plano repetido).
    const armadura = planosDisponiveis(ctx.planos, ctx.nivel).find((p) => !p.generico && resolverPlano(p, ctx.acervo)?.item.tipo === 'Armadura'
      && !out.some((c) => c.item_id === p.item_id && (c.variante_id || '') === (p.variante_id || '')));
    const alvo = armadura && resolverPlano(armadura, ctx.acervo);
    if (alvo) {
      // opcoesDeBase respeita `opcoes`, `categorias` e `excluir` da base (Cota de Malha Élfica só aceita Cota de Malha/Parcial).
      const base = alvo.item.base ? opcoesDeBase(alvo.item.base, { armas: ctx.armas, armaduras: ctx.armaduras })[0] : null;
      out.push({ id: `${armadura.id}-armeiro`, plano_id: armadura.id, item_id: armadura.item_id, ...(armadura.variante_id ? { variante_id: armadura.variante_id } : {}), ...(base ? { base_nome: base.nome } : {}), armeiro: true });
    }
  }
  return out;
}

/** Itens replicados no inventário. */
export function itensReplicados(p) {
  return (p.inventario || []).filter((i) => i?.origem?.tipo === 'replicado');
}

/** Remove os itens replicados de conhecidos que saíram; devolve os nomes removidos. */
export function removerItensDeConhecidos(p, ids) {
  const alvo = new Set(ids);
  const removidos = [];
  p.inventario = (p.inventario || []).filter((i) => {
    if (i?.origem?.tipo === 'replicado' && alvo.has(i.origem.conhecido_id)) { removidos.push(i.nome); return false; }
    return true;
  });
  return removidos;
}

/** Monta o item de inventário de um conhecido; null se faltar item ou base. */
function montarDoConhecido(c, ctx) {
  const alvo = resolverPlano(c, ctx.acervo);
  if (!alvo) return null;
  let base = null;
  if (alvo.item.base) {
    const lista = alvo.item.base.tipo === 'arma' ? ctx.armas : ctx.armaduras;
    base = (lista || []).find((a) => a.nome === c.base_nome) || null;
  }
  return montarItemInventario({ item: alvo.item, variante: alvo.variante, base, equipamentoPHB: ctx.equipamentoPHB });
}

/** True se o conhecido `conhecidoId` é de um item do tipo Armadura (inclui escudo) no acervo. */
function conhecidoEhArmadura(p, conhecidoId, ctx) {
  const k = estadoArtifice(p).planos.find((x) => x.id === conhecidoId);
  return (ctx.acervo || []).find((x) => x.id === k?.item_id)?.tipo === 'Armadura';
}

/** Máximo de itens replicados que não são Armadura: com Armeiro Aprimorado o espaço extra só aceita Armadura. */
function limiteNaoArmaduraDe(ctx) {
  return ctx.armeiro ? Math.max(0, ctx.maxItens - 1) : ctx.maxItens;
}

/**
 * Erro (texto) se pedir criar os conhecidos `ids` de uma vez violaria os limites
 * (total acima de maxItens ou, com Armeiro, não-Armadura acima de maxItens - 1); null se cabe.
 */
export function erroCriarItens(p, ids, ctx) {
  if (ids.length > ctx.maxItens) return `No máximo ${ctx.maxItens} item(ns).`;
  const naoArmadura = ids.filter((id) => !conhecidoEhArmadura(p, id, ctx)).length;
  if (naoArmadura > limiteNaoArmaduraDe(ctx)) return 'O item extra do Armeiro deve ser de Armadura.';
  return null;
}

/**
 * Cria no inventário os itens dos conhecidos `ids` (um por plano). Recriar um
 * plano substitui o item dele (não conta como removido); acima de
 * ctx.maxItens sai o mais antigo. Devolve { criados, removidos }: nomes
 * criados e nomes que saíram pelo limite.
 */
export function criarItensReplicados(p, ids, ctx) {
  if (!Number.isFinite(ctx.maxItens)) throw new Error('criarItensReplicados: ctx.maxItens ausente.');
  const conhecidos = estadoArtifice(p).planos;
  const criados = [];
  const removidos = [];
  ids.forEach((id, k) => {
    const c = conhecidos.find((x) => x.id === id);
    const novo = c && montarDoConhecido(c, ctx);
    if (!novo) return;
    removerItensDeConhecidos(p, [id]);
    novo.origem = { tipo: 'replicado', conhecido_id: id, criado_em: (ctx.agora ?? Date.now()) + k };
    p.inventario.push(novo);
    criados.push(novo.nome);
  });
  // Armadura (inclui escudo) pelo item do acervo do conhecido de origem; magico_id guarda o id da variante.
  const ehArmadura = (i) => conhecidoEhArmadura(p, i.origem.conhecido_id, ctx);
  // Remove o mais antigo entre os itens replicados que passam no filtro.
  const removerMaisAntigo = (filtro) => {
    const maisAntigo = itensReplicados(p).filter(filtro).reduce((a, b) => (a.origem.criado_em <= b.origem.criado_em ? a : b));
    p.inventario.splice(p.inventario.indexOf(maisAntigo), 1);
    removidos.push(maisAntigo.nome);
  };
  // Com Armeiro Aprimorado, o espaço extra só aceita Armadura: não-Armadura fica em maxItens - 1.
  const limiteNaoArmadura = limiteNaoArmaduraDe(ctx);
  while (itensReplicados(p).filter((i) => !ehArmadura(i)).length > limiteNaoArmadura) removerMaisAntigo((i) => !ehArmadura(i));
  while (itensReplicados(p).length > ctx.maxItens) removerMaisAntigo(() => true);
  return { criados, removidos };
}

/** Cargas de um item replicado com cargas: { atual, max }; null para item sem cargas ou não replicado. */
export function cargasDoItem(item) {
  const rec = recursosDoItem(item);
  if (item?.origem?.tipo !== 'replicado' || !rec?.cargas) return null;
  return { atual: item.estado_recursos?.cargas ?? rec.cargas.max, max: rec.cargas.max };
}

/** Carregar Item Mágico: soma `circulo` cargas (até o máximo) a item replicado com cargas; null se não couber. */
export function carregarItem(item, circulo) {
  if (item?.origem?.tipo !== 'replicado' || !recursosDoItem(item)?.cargas) return null;
  return ajustarCarga(item, Number(circulo));
}

/** Drenar Item Mágico: remove o item e devolve o círculo do espaço (1 Comum; 2 Incomum/Rara); null se não pode. */
export function drenarItem(p, idx) {
  const e = estadoArtifice(p);
  const item = (p.inventario || [])[idx];
  const circulo = RARIDADE_DRENAR[item?.dados?.raridade];
  if (e.drenar_usado || item?.origem?.tipo !== 'replicado' || !circulo) return null;
  p.inventario.splice(idx, 1);
  e.drenar_usado = true;
  return circulo;
}

/** Erro (texto) se transmutar o item em `idx` para o conhecido `conhecidoId` quebraria o limite do Armeiro; null caso contrário. */
export function erroTransmutarArmeiro(p, idx, conhecidoId, ctx) {
  const atual = (p.inventario || [])[idx];
  if (!ctx.armeiro || atual?.origem?.tipo !== 'replicado' || conhecidoEhArmadura(p, conhecidoId, ctx)) return null;
  const outros = itensReplicados(p).filter((i) => i !== atual && !conhecidoEhArmadura(p, i.origem.conhecido_id, ctx)).length;
  return outros + 1 > limiteNaoArmaduraDe(ctx) ? 'O item extra do Armeiro deve ser de Armadura.' : null;
}

/** Transmutar Item Mágico: troca o item replicado em `idx` pelo de outro conhecido, no mesmo lugar. */
export function transmutarItem(p, idx, conhecidoId, ctx) {
  const e = estadoArtifice(p);
  const atual = (p.inventario || [])[idx];
  const c = e.planos.find((x) => x.id === conhecidoId);
  if (e.transmutar_usado || atual?.origem?.tipo !== 'replicado' || !c || c.id === atual.origem.conhecido_id) return false;
  // Um item por plano conhecido: destino já replicado não pode ser duplicado nem removido.
  if (itensReplicados(p).some((i) => i.origem.conhecido_id === c.id)) return false;
  if (erroTransmutarArmeiro(p, idx, conhecidoId, ctx)) return false;
  const novo = montarDoConhecido(c, ctx);
  if (!novo) return false;
  removerItensDeConhecidos(p, [c.id]);
  const pos = p.inventario.indexOf(atual);
  novo.origem = { tipo: 'replicado', conhecido_id: c.id, criado_em: atual.origem.criado_em };
  p.inventario.splice(pos, 1, novo);
  e.transmutar_usado = true;
  return true;
}

/** Trapacear a Morte: com PV 0, desintegra os itens replicados Incomuns/Raros indicados, põe PV = 20 x N (até o PV máximo) e zera as salvaguardas de morte. Devolve N (0 sem PV 0 ou sem item elegível). */
export function trapacearMorte(p, idxs) {
  if (p.pv_atual !== 0) return 0;
  const itens = idxs.map((i) => p.inventario[i]).filter((it) => it?.origem?.tipo === 'replicado' && ['Incomum', 'Rara'].includes(it.dados?.raridade));
  if (!itens.length) return 0;
  p.inventario = p.inventario.filter((it) => !itens.includes(it));
  // PV limitado ao máximo, como na cura normal; sem PV máximo conhecido, vale 20 x N.
  const pvMax = p.pv_max_override || p.pv_max;
  p.pv_atual = pvMax > 0 ? Math.min(pvMax, 20 * itens.length) : 20 * itens.length;
  p.morte_sucessos = 0;
  p.morte_falhas = 0;
  return itens.length;
}
