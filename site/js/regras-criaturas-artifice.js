// ============================================================
// Companheiros do Artífice: Defensor de Aço (Ferreiro de Batalha), Canhão
// Místico (Artilheiro) e Servo Homúnculo (magia). As fórmulas vêm de
// dados/tasha/artifice/criaturas.json; aqui elas viram números.
// ============================================================
import { bonusProficiencia } from './utils.js';
import { nivelNa, subclasseDe, nivelTotal } from './regras-multiclasse.js';
import { estadoArtifice, modInt } from './regras-artifice.js';

/** Valor de um termo de fórmula: número literal, 'mod_int', 'mod_int_min1' ou 'circulo_magia'. */
export function valorTermo(t, p, extra = {}) {
  if (t === 'mod_int') return modInt(p);
  if (t === 'mod_int_min1') return Math.max(1, modInt(p));
  if (t === 'circulo_magia') return Number(extra.circulo) || 0;
  return Number(t) || 0;
}

/** Texto "XdY + N" de uma expressão de dano/cura, com o dado extra opcional. */
function textoDado(d, p, extra, dadoExtra = '') {
  const soma = (d.soma || []).reduce((s, t) => s + valorTermo(t, p, extra), 0);
  return `${d.dado}${dadoExtra ? ` + ${dadoExtra}` : ''}${soma ? ` ${soma < 0 ? '-' : '+'} ${Math.abs(soma)}` : ''}`;
}

/** Estatísticas calculadas de uma criatura para o personagem. `circulo` vale para o Servo Homúnculo. */
export function estatisticasCriatura(criatura, p, { circulo = 2 } = {}) {
  const nivel = nivelNa(p, 'Artífice') || 0;
  const pb = bonusProficiencia(nivelTotal(p) || nivel || 1);
  const extra = { circulo };
  const ca = criatura.ca.base + (criatura.ca.soma || []).reduce((s, t) => s + valorTermo(t, p, extra), 0);
  const pvMax = criatura.pv.base + (criatura.pv.por_nivel_artifice || 0) * nivel + (criatura.pv.por_nivel_magia || 0) * circulo;
  const ataque = pb + modInt(p);
  const cd = 8 + pb + modInt(p);
  const explosivo = criatura.id === 'canhao-mistico' && subclasseDe(p, 'Artífice') === 'Artilheiro' && nivel >= 9 ? '1d8' : '';
  const acoes = (criatura.acoes || []).map((a) => {
    const partes = [];
    if (a.ataque) partes.push(`Ataque ${ataque >= 0 ? '+' : ''}${ataque}`);
    if (a.salvaguarda) partes.push(`Salvaguarda de ${a.salvaguarda} CD ${cd}`);
    if (a.alcance) partes.push(a.alcance);
    if (a.area) partes.push(a.area);
    if (a.dano) partes.push(`${textoDado(a.dano, p, extra, explosivo)} de dano ${a.dano.tipo}`);
    if (a.pv_temporarios) partes.push(`${textoDado(a.pv_temporarios, p, extra, explosivo)} PV temporários`);
    if (a.descricao) partes.push(a.descricao);
    return { nome: a.nome, texto: partes.join(' · ') };
  });
  // Deflexão Aprimorada (Ferreiro de Batalha 15): o atacante de Desviar Ataque sofre 1d4 + Int de dano Energético.
  const deflexao = criatura.id === 'defensor-de-aco' && subclasseDe(p, 'Artífice') === 'Ferreiro de Batalha' && nivel >= 15
    ? ` Deflexão Aprimorada: o atacante sofre ${textoDado({ dado: '1d4', soma: ['mod_int'] }, p, extra)} de dano Energético.` : '';
  const reacoes = (criatura.reacoes || []).map((r) => ({ nome: r.nome, texto: r.descricao + (r.nome === 'Desviar Ataque' ? deflexao : '') }));
  return { ca, pvMax, ataque, cd, acoes, reacoes };
}

/** Companheiros que este personagem pode ter agora. */
export function companheirosDisponiveis(p) {
  const nivel = nivelNa(p, 'Artífice') || 0;
  const sub = subclasseDe(p, 'Artífice');
  const out = [];
  if (sub === 'Ferreiro de Batalha' && nivel >= 3) out.push('defensor-de-aco');
  if (sub === 'Artilheiro' && nivel >= 3) out.push('canhao-mistico');
  const temServo = [...(p.magias_preparadas || []), ...(p.magias_conhecidas || [])].some((m) => m.nome === 'Servo Homúnculo');
  if (temServo) out.push('servo-homunculo');
  return out;
}

/** Quantas instâncias simultâneas: 2 canhões com Posição Fortificada (Artilheiro 15); 1 para o resto. */
export function maxInstancias(id, p) {
  return id === 'canhao-mistico' && subclasseDe(p, 'Artífice') === 'Artilheiro' && (nivelNa(p, 'Artífice') || 0) >= 15 ? 2 : 1;
}

/** Estado dos companheiros: os campos são criados por `estadoArtifice` (padrão em regras-artifice.js). */
export function estadoCompanheiros(p) {
  return estadoArtifice(p);
}

/** Vagas livres de canhão: máximo de instâncias menos os canhões existentes. */
export function vagasCanhao(p) {
  const lista = estadoCompanheiros(p).companheiros['canhao-mistico'] || [];
  return Math.max(0, maxInstancias('canhao-mistico', p) - lista.length);
}

/**
 * Cria instâncias com PV cheio. Canhão: preenche todas as vagas (Poder de Fogo
 * Duplo cria os dois com a mesma Ação Mágica); a criação grátis é 1 por
 * Descanso Longo e, depois dela, exige `gastouEspaco` (o chamador gasta um
 * espaço por canhão criado, ver `vagasCanhao`). Defensor e Servo substituem o
 * anterior (para o defensor, Dispensar + Criar equivale a "novo defensor ao
 * terminar Descanso Longo"; a ficha não limita isso). Devolve false quando não pode criar.
 */
export function criarCompanheiro(p, id, pvMax, { circulo = 2, gastouEspaco = false } = {}) {
  const e = estadoCompanheiros(p);
  const lista = e.companheiros[id] || (e.companheiros[id] = []);
  if (id === 'canhao-mistico') {
    const vagas = vagasCanhao(p);
    if (vagas <= 0) return false;
    if (!gastouEspaco && e.canhao_gratis_usado) return false;
    if (!gastouEspaco) e.canhao_gratis_usado = true;
    for (let k = 0; k < vagas; k++) lista.push({ pv_atual: pvMax });
    return true;
  }
  e.companheiros[id] = [{ pv_atual: pvMax, ...(id === 'servo-homunculo' ? { circulo: Number(circulo) } : {}) }];
  return true;
}

/** Remove a instância i do companheiro. */
export function dispensarCompanheiro(p, id, i) {
  const lista = estadoCompanheiros(p).companheiros[id] || [];
  lista.splice(i, 1);
}

/**
 * Soma delta ao PV da instância, entre 0 e pvMax; devolve o PV novo. O canhão
 * que chega a 0 PV desaparece (removido da lista); o defensor em 0 PV não
 * recebe PV por aqui (só `reviverDefensor`).
 */
export function ajustarPVCompanheiro(p, id, i, delta, pvMax) {
  const lista = estadoCompanheiros(p).companheiros[id] || [];
  const inst = lista[i];
  if (!inst) return 0;
  if (id === 'defensor-de-aco' && inst.pv_atual <= 0) return 0;
  inst.pv_atual = Math.max(0, Math.min(pvMax, inst.pv_atual + Number(delta)));
  if (id === 'canhao-mistico' && inst.pv_atual === 0) lista.splice(i, 1);
  return inst.pv_atual;
}

/** Reviver o Defensor de Aço (0 PV): volta com todos os PV; false se ele não está em 0 PV. O espaço de magia é gasto pelo chamador. */
export function reviverDefensor(p, pvMax) {
  const inst = (estadoCompanheiros(p).companheiros['defensor-de-aco'] || [])[0];
  if (!inst || inst.pv_atual > 0) return false;
  inst.pv_atual = pvMax;
  return true;
}

/** Reparar do Defensor de Aço: 3 por Descanso Longo. */
export function usarRepararDefensor(p) {
  const e = estadoCompanheiros(p);
  if (e.reparar_defensor_gastos >= 3) return false;
  e.reparar_defensor_gastos += 1;
  return true;
}

/** Usos de Golpe Arcano (Ferreiro de Batalha 9+): mod. Int, mínimo 1. */
export function golpeArcanoMax(p) {
  return subclasseDe(p, 'Artífice') === 'Ferreiro de Batalha' && (nivelNa(p, 'Artífice') || 0) >= 9 ? Math.max(1, modInt(p)) : 0;
}

/** Gasta um Golpe Arcano; false quando esgotado. */
export function usarGolpeArcano(p) {
  const e = estadoCompanheiros(p);
  if (e.golpe_arcano_gastos >= golpeArcanoMax(p)) return false;
  e.golpe_arcano_gastos += 1;
  return true;
}

/** Descanso Longo: Reparar, Golpe Arcano e o canhão grátis voltam. */
export function descansoLongoCompanheiros(p) {
  const e = estadoCompanheiros(p);
  e.reparar_defensor_gastos = 0;
  e.golpe_arcano_gastos = 0;
  e.canhao_gratis_usado = false;
}
