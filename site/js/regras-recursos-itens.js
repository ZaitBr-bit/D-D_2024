// ============================================================
// Cargas e usos de itens: gasto, descansos, recuperação informada pelo
// jogador, regra da última carga e item destruído.
//
// Regra pura, sem DOM. O "amanhecer" do livro é o Descanso Longo da ficha;
// recuperação em dado não é rolada aqui: fica pendente até o jogador
// informar o resultado (spec 2026-10-04-itens-magicos-4a).
// ============================================================

import { ALVOS_AUMENTO, ALVOS_PASSIVOS } from './regras-itens-magicos.js';

// Versão atual dos dados do acervo gravados no item: 1 = 4C, 2 = 4D (alvos de aumento de atributo),
// 3 = `efeito`/`circulo_max` nos usos de `dados.recursos` (Pérola do Poder),
// 4 = o mesmo `efeito` no Bastão do Guardião do Pacto (sem `circulo_max`).
export const PASSIVOS_VERSAO = 4;

/** Recursos curados (ou do contador manual) de um item; null quando não há. */
export function recursosDoItem(item) {
  return item?.dados?.recursos || null;
}

/** Estado cheio para um conjunto de recursos. */
export function estadoInicialRecursos(recursos) {
  const estado = { usos: {} };
  if (recursos?.cargas) estado.cargas = recursos.cargas.max;
  for (const u of recursos?.usos || []) estado.usos[u.nome] = 0;
  return estado;
}

/** Garante `item.estado_recursos` (cheio na primeira vez); null para item sem recursos. */
export function garantirEstadoRecursos(item) {
  const rec = recursosDoItem(item);
  if (!rec) return null;
  if (!item.estado_recursos) item.estado_recursos = estadoInicialRecursos(rec);
  // Estado legado sem a chave `cargas`: conta como cheio (senão `undefined < max` esconde a pendência).
  if (rec.cargas && item.estado_recursos.cargas === undefined) item.estado_recursos.cargas = rec.cargas.max;
  if (!item.estado_recursos.usos) item.estado_recursos.usos = {};
  for (const u of rec.usos || []) if (!(u.nome in item.estado_recursos.usos)) item.estado_recursos.usos[u.nome] = 0;
  return item.estado_recursos;
}

/** Soma `delta` às cargas, limitando a 0 e ao máximo; devolve as cargas atuais. */
export function ajustarCarga(item, delta) {
  const rec = recursosDoItem(item);
  const est = garantirEstadoRecursos(item);
  if (!rec?.cargas || !est) return 0;
  // Delta não finito (NaN, Infinity) não altera o contador.
  if (!Number.isFinite(delta)) return est.cargas ?? rec.cargas.max;
  est.cargas = Math.max(0, Math.min(rec.cargas.max, (est.cargas ?? rec.cargas.max) + delta));
  return est.cargas;
}

/** Gasta `n` cargas (inteiro ≥ 0); `ultimaCarga` traz a regra do item quando as cargas passaram de >0 para 0. */
export function gastarCargas(item, n) {
  const rec = recursosDoItem(item);
  const est = garantirEstadoRecursos(item);
  if (!rec?.cargas || !est) return { cargas: 0, ultimaCarga: null };
  if (!Number.isInteger(n) || n < 0) return { cargas: est.cargas ?? rec.cargas.max, ultimaCarga: null };
  const antes = est.cargas ?? rec.cargas.max;
  const cargas = ajustarCarga(item, -n);
  const ultimaCarga = n > 0 && antes > 0 && cargas === 0 ? (rec.cargas.ultima_carga || null) : null;
  return { cargas, ultimaCarga };
}

/** Gasta uma carga; mesma regra de `gastarCargas` com n = 1. */
export function gastarCarga(item) {
  return gastarCargas(item, 1);
}

/** Gasta um uso se ainda houver; devolve true quando gastou. */
export function gastarUso(item, nome) {
  const uso = (recursosDoItem(item)?.usos || []).find(u => u.nome === nome);
  const est = garantirEstadoRecursos(item);
  if (!uso || !est || (est.usos[nome] || 0) >= uso.max) return false;
  est.usos[nome] = (est.usos[nome] || 0) + 1;
  return true;
}

/** Alterna um uso entre gasto e disponível (um de cada vez até o máximo); devolve os gastos. */
export function alternarUso(item, nome) {
  const uso = (recursosDoItem(item)?.usos || []).find(u => u.nome === nome);
  const est = garantirEstadoRecursos(item);
  if (!uso || !est) return 0;
  const gastos = est.usos[nome] || 0;
  est.usos[nome] = gastos >= uso.max ? 0 : gastos + 1;
  return est.usos[nome];
}

/** Se o uso volta neste tipo de descanso. */
function usoVoltaNo(recupera, tipo) {
  if (tipo === 'longo') return ['amanhecer', 'descanso_longo', 'descanso_curto'].includes(recupera);
  return recupera === 'descanso_curto';
}

/**
 * Aplica um descanso a todos os itens: usos do tipo voltam; no longo, cargas
 * com recuperação fixa ou "todas" voltam e as em dado ficam pendentes.
 * Devolve as pendências criadas ({idx, nome, recupera, atual, max}).
 */
export function aplicarDescansoRecursos(personagem, tipo) {
  const pendentes = [];
  (personagem?.inventario || []).forEach((item, idx) => {
    if (item?.destruido) return;
    const rec = recursosDoItem(item);
    const est = garantirEstadoRecursos(item);
    if (!rec || !est) return;
    for (const u of rec.usos || []) if (usoVoltaNo(u.recupera, tipo)) est.usos[u.nome] = 0;
    if (tipo !== 'longo' || !rec.cargas) return;
    // Pendência de uma recuperação anterior some quando as cargas já estão no máximo.
    if (est.cargas >= rec.cargas.max) delete est.recuperacao_pendente;
    const r = rec.cargas.recupera;
    if (r === 'todas') est.cargas = rec.cargas.max;
    else if (Number.isInteger(r)) ajustarCarga(item, r);
    else if (typeof r === 'string' && est.cargas < rec.cargas.max) {
      est.recuperacao_pendente = r;
      pendentes.push({ idx, nome: item.nome, recupera: r, atual: est.cargas, max: rec.cargas.max });
    }
  });
  return pendentes;
}

/** Se a pendência do item está obsoleta: cargas ajustadas ao máximo antes de informar a rolagem. */
function pendenciaObsoleta(item) {
  const est = item?.estado_recursos;
  const rec = recursosDoItem(item);
  return !!(est?.recuperacao_pendente && rec?.cargas && est.cargas >= rec.cargas.max);
}

/**
 * Consulta pura: itens com recuperação em dado aguardando o resultado
 * informado pelo jogador. Não altera o personagem; a pendência obsoleta é
 * ignorada aqui e removida por `limparPendenciasObsoletas`.
 */
export function itensComRecuperacaoPendente(personagem) {
  const out = [];
  (personagem?.inventario || []).forEach((item, idx) => {
    const est = item?.estado_recursos;
    const rec = recursosDoItem(item);
    if (pendenciaObsoleta(item)) return;
    if (!item?.destruido && est?.recuperacao_pendente && rec?.cargas) {
      out.push({ idx, nome: item.nome, recupera: est.recuperacao_pendente, atual: est.cargas, max: rec.cargas.max });
    }
  });
  return out;
}

/**
 * Remove a `recuperacao_pendente` dos itens cujas cargas já estão no máximo.
 * Mutação explícita, chamada ao desenhar o botão do amanhecer e no descanso.
 * Devolve quantas pendências removeu.
 */
export function limparPendenciasObsoletas(personagem) {
  let n = 0;
  for (const item of personagem?.inventario || []) {
    if (!pendenciaObsoleta(item)) continue;
    delete item.estado_recursos.recuperacao_pendente;
    n++;
  }
  return n;
}

/** Soma a recuperação informada (inteiro ≥ 0), limitada ao máximo, e limpa a pendência; false se inválida. */
export function aplicarRecuperacaoInformada(item, valor) {
  const texto = typeof valor === 'string' && valor.trim() !== '';
  if (typeof valor !== 'number' && !texto) return false;
  const n = Number(valor);
  if (!Number.isInteger(n) || n < 0) return false;
  if (!garantirEstadoRecursos(item)) return false;
  ajustarCarga(item, n);
  delete item.estado_recursos.recuperacao_pendente;
  return true;
}

/**
 * Se o contador do item foi criado à mão: `dados.recursos_manual` marcado, ou
 * recursos num item sem `magico_id` (formulário anterior à marca). Recursos
 * do acervo nunca contam como manuais.
 */
export function contadorEhManual(item) {
  if (!recursosDoItem(item)) return false;
  return item.dados.recursos_manual === true || !item.dados.magico_id;
}

/**
 * Grava o contador manual no item. Na edição (`edicao` true) preserva o que já
 * foi gasto, limitado ao novo máximo, e mantém a `recuperacao_pendente` quando
 * as cargas continuam abaixo do máximo e a nova recuperação é em dado.
 */
export function aplicarContadorManual(item, recursos, edicao = false) {
  const anterior = item.estado_recursos;
  item.dados = { ...(item.dados || {}), recursos, recursos_manual: true };
  delete item.estado_recursos;
  const est = garantirEstadoRecursos(item);
  if (!edicao || !anterior) return;
  if (recursos.cargas && anterior.cargas !== undefined) est.cargas = Math.min(anterior.cargas, recursos.cargas.max);
  for (const u of recursos.usos || []) if (anterior.usos?.[u.nome]) est.usos[u.nome] = Math.min(anterior.usos[u.nome], u.max);
  const r = recursos.cargas?.recupera;
  if (anterior.recuperacao_pendente && recursos.cargas && est.cargas < recursos.cargas.max && typeof r === 'string' && r !== 'todas') {
    est.recuperacao_pendente = r;
  }
}

/** Remove o contador manual (recursos, marca e estado); false e sem mudança quando o contador não é manual. */
export function removerContadorManual(item) {
  if (!contadorEhManual(item)) return false;
  item.dados.recursos = null;
  delete item.dados.recursos_manual;
  delete item.estado_recursos;
  return true;
}

/** Marca o item como destruído: sai de efeitos, sintonização e descansos. */
export function marcarDestruido(item) {
  item.destruido = true;
  item.equipado = false;
  item.sintonizado = false;
  if (item.estado_recursos) delete item.estado_recursos.recuperacao_pendente;
}

/** Desfaz a destruição (clique errado); o resto do item fica como estava. */
export function restaurarItem(item) {
  item.destruido = false;
}

/**
 * Texto dos recursos do item para a impressão: "cargas 3/7 | Relâmpago 1/1"
 * (disponíveis/máximo, o mesmo número dos chips da tela). Leitura sem
 * `garantirEstadoRecursos`: imprimir não cria nem altera o estado do item;
 * estado ausente conta como cheio. Item destruído ou sem recursos: ''.
 */
export function rotuloRecursosImpressao(item) {
  const rec = recursosDoItem(item);
  if (!rec || item?.destruido) return '';
  const est = item.estado_recursos;
  const partes = [];
  if (rec.cargas) partes.push(`cargas ${est?.cargas ?? rec.cargas.max}/${rec.cargas.max}`);
  for (const u of rec.usos || []) partes.push(`${u.nome} ${u.max - (est?.usos?.[u.nome] || 0)}/${u.max}`);
  return partes.join(' | ');
}

/** Campo (`recursos`, `magias` ou `efeitos`) do acervo para um magico_id, herdado do pai quando a variante não tem. */
function campoDoAcervo(acervo, magicoId, campo) {
  for (const i of acervo?.itens || []) {
    if (i.id === magicoId) return i[campo] ?? null;
    const v = (i.variantes || []).find(x => x.id === magicoId);
    if (v) return v[campo] ?? i[campo] ?? null;
  }
  return null;
}

/**
 * Completa `efeito` e `circulo_max` nos usos de `dados.recursos` do item que o
 * acervo declara e o item ainda não tem. Os usos do acervo vêm do `magico_id`
 * do item (variante sem recursos herda os do pai) e o uso casa pelo nome dentro
 * deles, então usos homônimos de itens diferentes não se misturam. Não altera
 * `estado_recursos`; contador manual não é tocado.
 */
function completarEfeitoDosUsos(item, acervo) {
  const usos = item.dados.recursos?.usos;
  if (!Array.isArray(usos) || contadorEhManual(item)) return;
  const usosDoAcervo = campoDoAcervo(acervo, item.dados.magico_id, 'recursos')?.usos || [];
  for (const uso of usos) {
    if (!uso || uso.efeito !== undefined) continue;
    const doAcervo = usosDoAcervo.find(u => u.nome === uso.nome);
    if (!doAcervo?.efeito) continue;
    uso.efeito = doAcervo.efeito;
    if (doAcervo.circulo_max !== undefined) uso.circulo_max = doAcervo.circulo_max;
  }
}

/**
 * Preenche `dados.recursos`, `dados.magias`, `dados.requisito_sintonizacao`
 * e `dados.aumento_permanente` ausentes de itens mágicos (uma vez por chave),
 * acrescenta a `dados.efeitos` os efeitos de alvo passivo (4C) e de
 * aumento de atributo (4D) do acervo ainda ausentes e completa `efeito`/
 * `circulo_max` dos usos de `dados.recursos`, marcando
 * `dados.passivos_versao = PASSIVOS_VERSAO` (4). Devolve quantos itens mudaram (cada item
 * conta uma vez).
 */
export function preencherRecursosDoAcervo(personagem, acervo) {
  let n = 0;
  for (const item of personagem?.inventario || []) {
    if (!item?.dados?.magico_id) continue;
    let mudou = false;
    for (const campo of ['recursos', 'magias', 'aumento_permanente']) {
      if (campo in item.dados) continue;
      item.dados[campo] = structuredClone(campoDoAcervo(acervo, item.dados.magico_id, campo));
      mudou = true;
    }
    // O requisito é texto do item-pai: a variante só tem o próprio se o declarar.
    if (!('requisito_sintonizacao' in item.dados)) {
      item.dados.requisito_sintonizacao = campoDoAcervo(acervo, item.dados.magico_id, 'requisito_sintonizacao') || '';
      mudou = true;
    }
    if (!(item.dados.passivos_versao >= PASSIVOS_VERSAO)) {
      const doAcervo = campoDoAcervo(acervo, item.dados.magico_id, 'efeitos') || [];
      const atuais = Array.isArray(item.dados.efeitos) ? item.dados.efeitos : [];
      const jaTem = new Set(atuais.map(e => JSON.stringify(e)));
      const novos = doAcervo.filter(e => (ALVOS_PASSIVOS.includes(e.alvo) || ALVOS_AUMENTO.includes(e.alvo)) && !jaTem.has(JSON.stringify(e)));
      if (novos.length) item.dados.efeitos = [...atuais, ...structuredClone(novos)];
      completarEfeitoDosUsos(item, acervo);
      item.dados.passivos_versao = PASSIVOS_VERSAO;
      mudou = true;
    }
    if (!mudou) continue;
    garantirEstadoRecursos(item);
    n++;
  }
  return n;
}

/**
 * Valida os campos do formulário de contador manual e monta `dados.recursos`.
 * Cargas: `recupera` 'amanhecer' (exige dado), 'todas' ou 'nenhum'. Uso:
 * 'amanhecer', 'descanso_longo' ou 'descanso_curto'. O dado é normalizado para
 * minúsculas. Devolve {ok, recursos} ou {ok:false, erro}.
 */
export function recursosDoFormulario({ tipo, nome, max, recupera, dado }) {
  const texto = String(max ?? '').trim();
  const n = Number(texto);
  if (texto === '' || !Number.isInteger(n) || n < 1) return { ok: false, erro: 'O máximo deve ser um inteiro maior ou igual a 1.' };
  if (tipo === 'uso') {
    const nomeUso = String(nome ?? '').trim();
    if (!nomeUso) return { ok: false, erro: 'Informe o nome do uso.' };
    if (!['amanhecer', 'descanso_longo', 'descanso_curto'].includes(recupera)) return { ok: false, erro: 'Escolha quando o uso volta.' };
    return { ok: true, recursos: { usos: [{ nome: nomeUso, max: n, recupera }] } };
  }
  if (tipo !== 'cargas') return { ok: false, erro: 'Tipo de contador inválido.' };
  const dadoTxt = String(dado ?? '').trim().toLowerCase();
  if (dadoTxt && !/^\d+d\d+(\+\d+)?$/.test(dadoTxt)) return { ok: false, erro: 'Dado de recuperação inválido (use XdY ou XdY+Z).' };
  if (recupera === 'descanso_curto') return { ok: false, erro: 'Cargas não recuperam no Descanso Curto: use "Todas no Descanso Longo" ou um dado no Descanso Longo.' };
  if (recupera === 'nenhum') {
    if (dadoTxt) return { ok: false, erro: '"Não recupera" não aceita dado.' };
    return { ok: true, recursos: { cargas: { max: n, recupera: null, ultima_carga: null } } };
  }
  if (recupera === 'todas') {
    if (dadoTxt) return { ok: false, erro: '"Todas no Descanso Longo" não aceita dado.' };
    return { ok: true, recursos: { cargas: { max: n, recupera: 'todas', ultima_carga: null } } };
  }
  if (recupera !== 'amanhecer') return { ok: false, erro: 'Escolha a recuperação das cargas.' };
  if (!dadoTxt) return { ok: false, erro: 'Informe o dado da recuperação ou escolha "Todas no Descanso Longo".' };
  return { ok: true, recursos: { cargas: { max: n, recupera: dadoTxt, ultima_carga: null } } };
}
