// ============================================================
// Replicar Item Mágico (Artífice): planos conhecidos, itens replicados e
// Funileiro de Item Mágico, contra os dados reais de dados/tasha.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { modulosApp, RAIZ, escadaDeNivel } from './harness.mjs';

const { db } = await modulosApp();
const R = await import(pathToFileURL(resolve(RAIZ, 'site/js/regras-planos-artifice.js')).href);
const classe = await db.getClasse('Artífice');
const planos = (await db.getPlanosArtifice()).planos;
const acervo = (await db.getItensMagicos()).itens;
const armas = (await db.getArmas()).armas;
const armaduras = (await db.getArmaduras()).armaduras;
const equipamentoPHB = (await db.getEquipamentoAventura()).itens;

/** Artífice de nível n (subclasse opcional) com Int 16. */
function artifice(n, subclasse = '') {
  return { classes: [{ classe: 'Artífice', nivel: n, ordem: 0, subclasse }], classe: 'Artífice', subclasse, nivel: n,
    atributos: { inteligencia: 16 }, inventario: [], recursos: {} };
}

/** Contexto de regras para o personagem p. */
function ctx(p, extra = {}) {
  const nivel = p.classes[0].nivel;
  return { planos, acervo, armas, armaduras, equipamentoPHB, nivel,
    max: R.planosConhecidosMax(classe.tabela_caracteristicas, p),
    maxItens: R.itensMagicosMax(classe.tabela_caracteristicas, p),
    armeiro: R.ehArmeiroAprimorado(p), agora: 1000, ...extra };
}

/** Conhecido simples de um plano sem base nem genérico. */
function conhecido(planoId, id = planoId) {
  const p = planos.find((x) => x.id === planoId);
  return { id, plano_id: p.id, item_id: p.item_id, ...(p.variante_id ? { variante_id: p.variante_id } : {}) };
}

const SIMPLES = planos.filter((p) => p.nivel_minimo === 2 && !p.generico && !R.resolverPlano(p, acervo)?.item.base).map((p) => p.id);

test('contagens pela tabela: 4 planos/2 itens no 2; Armeiro 9 ganha +1/+1', () => {
  assert.equal(R.planosConhecidosMax(classe.tabela_caracteristicas, artifice(2)), 4);
  assert.equal(R.itensMagicosMax(classe.tabela_caracteristicas, artifice(2)), 2);
  assert.equal(R.planosConhecidosMax(classe.tabela_caracteristicas, artifice(9, 'Armeiro')), 6);
  assert.equal(R.itensMagicosMax(classe.tabela_caracteristicas, artifice(9, 'Armeiro')), 4);
  assert.equal(R.planosConhecidosMax(classe.tabela_caracteristicas, artifice(1)), 0);
});

test('disponíveis respeitam o nível mínimo', () => {
  assert.ok(R.planosDisponiveis(planos, 5).every((p) => p.nivel_minimo <= 5));
  assert.equal(R.planosDisponiveis(planos, 14).length, 56);
});

test('todo plano não genérico resolve no acervo mesclado', () => {
  const sem = planos.filter((p) => !p.generico && !R.resolverPlano(p, acervo)).map((p) => p.id);
  assert.deepEqual(sem, []);
});

test('genérico comum exclui poção, pergaminho e amaldiçoado', () => {
  const g = planos.find((p) => p.nivel_minimo === 2 && p.generico);
  const c = R.candidatosGenerico(g, acervo);
  assert.ok(c.length > 0);
  assert.ok(c.every((x) => !['Poção', 'Pergaminho'].includes(x.item.tipo) && !x.item.amaldicoado));
  assert.ok(c.every((x) => (x.variante || x.item).raridade === 'Comum'));
});

test('validação: quantidade, duplicata e nível', () => {
  const p = artifice(2);
  const ok = SIMPLES.slice(0, 4).map((id) => conhecido(id));
  assert.deepEqual(R.validarConhecidos(ok, ctx(p)), []);
  assert.ok(R.validarConhecidos(ok.slice(0, 3), ctx(p)).some((e) => /4/.test(e)));
  assert.ok(R.validarConhecidos([...ok.slice(0, 3), { ...ok[0], id: 'dup' }], ctx(p)).some((e) => /repetid/.test(e)));
  const alto = planos.find((x) => x.nivel_minimo === 14 && !x.generico);
  assert.ok(R.validarConhecidos([...ok.slice(0, 3), conhecido(alto.id)], ctx(p)).some((e) => /nível/.test(e)));
});

test('trocasEntre conta só as saídas', () => {
  const a = SIMPLES.slice(0, 4).map((id) => conhecido(id));
  const b = [...a.slice(0, 3), conhecido(SIMPLES[4])];
  assert.equal(R.trocasEntre(a, a), 0);
  assert.equal(R.trocasEntre(a, b), 1);
  assert.equal(R.trocasEntre(a, [...a, conhecido(SIMPLES[4])]), 0);
});

test('criar itens: monta pelo acervo, marca origem, recriar substitui e o limite tira o mais antigo', () => {
  const p = artifice(2);
  const conhecidos = SIMPLES.slice(0, 4).map((id) => conhecido(id));
  p.recursos.artifice = { planos: conhecidos };
  const c = ctx(p);
  let r = R.criarItensReplicados(p, [conhecidos[0].id, conhecidos[1].id], c);
  assert.equal(r.criados.length, 2);
  assert.equal(R.itensReplicados(p).length, 2);
  assert.ok(R.itensReplicados(p).every((i) => i.dados?.magico_id && i.origem.tipo === 'replicado'));
  r = R.criarItensReplicados(p, [conhecidos[0].id], { ...c, agora: 2000 });
  assert.equal(R.itensReplicados(p).length, 2);
  assert.deepEqual(r.removidos, []);
  r = R.criarItensReplicados(p, [conhecidos[2].id], { ...c, agora: 3000 });
  assert.equal(R.itensReplicados(p).length, 2);
  assert.equal(r.removidos.length, 1);
  assert.ok(!R.itensReplicados(p).some((i) => i.origem.conhecido_id === conhecidos[1].id));
});

test('remover por conhecido não toca item manual de mesmo nome', () => {
  const p = artifice(2);
  const k = conhecido(SIMPLES[0]);
  p.recursos.artifice = { planos: [k] };
  R.criarItensReplicados(p, [k.id], ctx(p));
  const nome = p.inventario[0].nome;
  p.inventario.push({ nome, tipo: 'magico', dados: {} });
  assert.deepEqual(R.removerItensDeConhecidos(p, [k.id]), [nome]);
  assert.equal(p.inventario.length, 1);
  assert.equal(p.inventario[0].origem, undefined);
});

test('carregar: só item replicado com cargas, limitado ao máximo', () => {
  const comCargas = planos.find((x) => !x.generico && R.resolverPlano(x, acervo)?.item.recursos?.cargas && !R.resolverPlano(x, acervo)?.item.base);
  const p = artifice(6);
  const k = conhecido(comCargas.id);
  p.recursos.artifice = { planos: [k] };
  R.criarItensReplicados(p, [k.id], ctx(p));
  const item = p.inventario[0];
  const max = item.dados.recursos.cargas.max;
  item.estado_recursos.cargas = 0;
  assert.equal(R.carregarItem(item, 2), Math.min(2, max));
  assert.equal(R.carregarItem(item, 9), max);
  assert.equal(R.carregarItem({ nome: 'x', dados: {} }, 1), null);
});

test('drenar: 1x por descanso longo, círculo pela raridade; descanso longo libera e apaga o espaço temporário', async () => {
  const { regrasArtifice } = { regrasArtifice: await import(pathToFileURL(resolve(RAIZ, 'site/js/regras-artifice.js')).href) };
  const p = artifice(6);
  const k1 = conhecido(SIMPLES[0], 'a');
  const k2 = conhecido(SIMPLES[1], 'b');
  p.recursos.artifice = { planos: [k1, k2] };
  R.criarItensReplicados(p, ['a', 'b'], ctx(p));
  const raridade = p.inventario[0].dados.raridade;
  const circulo = R.drenarItem(p, 0);
  assert.equal(circulo, raridade === 'Comum' ? 1 : 2);
  assert.equal(p.inventario.length, 1);
  assert.equal(R.drenarItem(p, 0), null);
  p.recursos.artifice.espaco_temporario = { circulo: 1 };
  regrasArtifice.descansoLongoArtifice(p);
  assert.equal(p.recursos.artifice.drenar_usado, false);
  assert.equal(p.recursos.artifice.espaco_temporario, null);
});

test('transmutar: troca por outro conhecido no mesmo lugar, 1x por descanso longo', () => {
  const p = artifice(6);
  const k1 = conhecido(SIMPLES[0], 'a');
  const k2 = conhecido(SIMPLES[1], 'b');
  p.recursos.artifice = { planos: [k1, k2] };
  p.inventario.push({ nome: 'Corda', tipo: 'equipamento', dados: {} });
  R.criarItensReplicados(p, ['a'], ctx(p));
  assert.equal(R.transmutarItem(p, 1, 'b', ctx(p)), true);
  assert.equal(p.inventario[1].origem.conhecido_id, 'b');
  assert.equal(R.transmutarItem(p, 1, 'a', ctx(p)), false);
});

test('trapacear a morte: só itens replicados Incomuns/Raros; PV = 20 x N', () => {
  const p = artifice(20);
  const ks = SIMPLES.slice(0, 2).map((id, i) => conhecido(id, `k${i}`));
  p.recursos.artifice = { planos: ks };
  R.criarItensReplicados(p, ['k0', 'k1'], ctx(p));
  p.pv_atual = 0;
  const elegiveis = p.inventario.map((it, i) => [it, i]).filter(([it]) => it?.origem?.tipo === 'replicado' && ['Incomum', 'Rara'].includes(it.dados?.raridade)).map(([, i]) => i);
  const n = R.trapacearMorte(p, elegiveis);
  assert.equal(n, elegiveis.length);
  assert.equal(p.pv_atual, 20 * n);
});

test('completarCanonico preenche até o máximo sem genéricos nem base, mantendo os atuais', () => {
  const p = artifice(6);
  const atuais = SIMPLES.slice(0, 4).map((id) => conhecido(id));
  const novo = R.completarCanonico(atuais, ctx(p));
  assert.equal(novo.length, 5);
  assert.deepEqual(novo.slice(0, 4), atuais);
  assert.deepEqual(R.validarConhecidos(novo, ctx(p)), []);
});

// ---------- Rodada de correção 1 ----------
const catalogo = await import(pathToFileURL(resolve(RAIZ, 'site/js/itens-magicos-catalogo.js')).href);

/** Raridade efetiva de um plano não genérico. */
function raridadeDe(plano) {
  const r = R.resolverPlano(plano, acervo);
  return (r.variante || r.item).raridade;
}

/** Ids de planos não genéricos, sem base e não Armadura, da raridade pedida. */
function idsNaoArmadura(raridade) {
  return planos.filter((x) => !x.generico && R.resolverPlano(x, acervo) && !R.resolverPlano(x, acervo).item.base
    && R.resolverPlano(x, acervo).item.tipo !== 'Armadura' && raridadeDe(x) === raridade).map((x) => x.id);
}

/** Conhecido de um plano de Armadura (com a primeira base válida, se exigir). */
function conhecidoArmadura(id) {
  const plano = planos.find((x) => x.id === id);
  const alvo = R.resolverPlano(plano, acervo);
  const base = alvo.item.base ? catalogo.opcoesDeBase(alvo.item.base, { armas, armaduras })[0] : null;
  return { ...conhecido(id), ...(base ? { base_nome: base.nome } : {}) };
}

test('Armeiro: não-Armadura nunca passa de maxItens-1 e o total nunca passa de maxItens', () => {
  const p = artifice(9, 'Armeiro');
  const ids = idsNaoArmadura('Comum').concat(idsNaoArmadura('Incomum')).slice(0, 5);
  const ks = ids.map((id, i) => conhecido(id, `n${i}`));
  const armaduraId = planos.find((x) => !x.generico && R.resolverPlano(x, acervo)?.item.tipo === 'Armadura' && R.resolverPlano(x, acervo))?.id;
  const ka = { ...conhecidoArmadura(armaduraId), id: 'arm', armeiro: true };
  p.recursos.artifice = { planos: [...ks, ka] };
  const c = ctx(p);
  assert.equal(c.maxItens, 4);
  const r = R.criarItensReplicados(p, ks.slice(0, 4).map((k) => k.id), c);
  assert.equal(R.itensReplicados(p).length, 3);
  assert.deepEqual(r.removidos, [r.criados[0]]);
  R.criarItensReplicados(p, ['arm'], { ...c, agora: 5000 });
  assert.equal(R.itensReplicados(p).length, 4);
  R.criarItensReplicados(p, [ks[4].id], { ...c, agora: 6000 });
  const rep = R.itensReplicados(p);
  assert.equal(rep.length, 4);
  assert.ok(rep.some((i) => i.origem.conhecido_id === 'arm'), 'a Armadura não pode sair');
});

test('transmutar: destino que já tem item replicado devolve false sem remover nada', () => {
  const p = artifice(6);
  p.recursos.artifice = { planos: [conhecido(SIMPLES[0], 'a'), conhecido(SIMPLES[1], 'b')] };
  R.criarItensReplicados(p, ['a', 'b'], ctx(p));
  const antes = p.inventario.map((i) => i.nome);
  assert.equal(R.transmutarItem(p, 0, 'b', ctx(p)), false);
  assert.deepEqual(p.inventario.map((i) => i.nome), antes);
  assert.equal(p.recursos.artifice.transmutar_usado, false);
});

test('drenar: Comum devolve 1, Incomum 2 e item manual nunca é drenado', () => {
  const p = artifice(6);
  const com = idsNaoArmadura('Comum')[0];
  const inc = idsNaoArmadura('Incomum')[0];
  p.recursos.artifice = { planos: [conhecido(com, 'c'), conhecido(inc, 'i')] };
  R.criarItensReplicados(p, ['c', 'i'], ctx(p));
  p.inventario.push({ nome: 'Manual', tipo: 'magico', dados: { raridade: 'Incomum' } });
  assert.equal(R.drenarItem(p, 2), null);
  assert.equal(p.inventario.length, 3);
  assert.equal(R.drenarItem(p, 1), 2);
  assert.equal(p.recursos.artifice.drenar_usado, true);
  p.recursos.artifice.drenar_usado = false;
  assert.equal(R.drenarItem(p, 0), 1);
  assert.deepEqual(p.inventario.map((i) => i.nome), ['Manual']);
});

test('trapacear a morte: exige PV 0, ignora Comum e manual, zera salvaguardas', () => {
  const p = artifice(20);
  const com = idsNaoArmadura('Comum')[0];
  const inc = idsNaoArmadura('Incomum')[0];
  p.recursos.artifice = { planos: [conhecido(com, 'c'), conhecido(inc, 'i')] };
  R.criarItensReplicados(p, ['c', 'i'], ctx(p));
  p.inventario.push({ nome: 'Manual', tipo: 'magico', dados: { raridade: 'Incomum' } });
  p.pv_atual = 5;
  assert.equal(R.trapacearMorte(p, [0, 1, 2]), 0);
  assert.equal(p.inventario.length, 3);
  p.pv_atual = 0;
  p.morte_sucessos = 2;
  p.morte_falhas = 2;
  assert.equal(R.trapacearMorte(p, [0, 1, 2]), 1);
  assert.equal(p.pv_atual, 20);
  assert.equal(p.morte_sucessos, 0);
  assert.equal(p.morte_falhas, 0);
  assert.deepEqual(p.inventario.map((i) => i.nome).includes('Manual'), true);
  assert.equal(p.inventario.length, 2);
});

test('validação: item/variante precisam ser os do plano e a base precisa ser válida', () => {
  const p = artifice(2);
  const ok = SIMPLES.slice(0, 4).map((id) => conhecido(id));
  const trocado = { ...ok[0], item_id: ok[1].item_id, variante_id: ok[1].variante_id };
  assert.ok(R.validarConhecidos([trocado, ...ok.slice(1)], ctx(p)).length > 0);
  const comBase = planos.find((x) => !x.generico && R.resolverPlano(x, acervo)?.item.base && x.nivel_minimo <= 2);
  if (comBase) {
    const k = { ...conhecido(comBase.id), base_nome: 'Inexistente' };
    assert.ok(R.validarConhecidos([k, ...ok.slice(1)], ctx(p)).some((e) => /base/i.test(e)));
  }
});

test('completarCanonico com Armeiro: preenche com Armadura e não sobrescreve lista cheia', () => {
  const p = artifice(9, 'Armeiro');
  const c = ctx(p);
  const novo = R.completarCanonico([], c);
  assert.equal(novo.length, c.max);
  assert.deepEqual(R.validarConhecidos(novo, c), []);
  const cheia = SIMPLES.slice(0, c.max).map((id) => conhecido(id));
  assert.deepEqual(R.completarCanonico(cheia, c), cheia);
  assert.ok(R.validarConhecidos(cheia, c).some((e) => /Armeiro/.test(e)));
});

test('criarItensReplicados sem ctx.maxItens lança erro', () => {
  const p = artifice(2);
  const k = conhecido(SIMPLES[0]);
  p.recursos.artifice = { planos: [k] };
  assert.throws(() => R.criarItensReplicados(p, [k.id], { ...ctx(p), maxItens: undefined }), /maxItens/);
  assert.equal(p.inventario.length, 0);
});

// ---- Pendência 'planos_artifice' na subida de nível (motor) ----
const { levelup } = await modulosApp();

test('escada do Artífice: planos no 2, 6, 10, 14, 18 batem com a tabela', async () => {
  const vistos = {};
  await escadaDeNivel('Artífice', async (p, nivel) => {
    vistos[nivel] = (p.recursos?.artifice?.planos || []).length;
  }, { subclasse: 'Alquimista' });
  assert.equal(vistos[2], 4);
  assert.equal(vistos[6], 5);
  assert.equal(vistos[10], 6);
  assert.equal(vistos[14], 7);
  assert.equal(vistos[18], 8);
});

test('escada do Armeiro: o plano extra de Armadura entra no nível 9', async () => {
  const p = await escadaDeNivel('Artífice', async () => {}, { subclasse: 'Armeiro', ateNivel: 9 });
  const lista = p.recursos.artifice.planos;
  assert.equal(lista.length, 6);
  assert.equal(lista.filter((c) => c.armeiro).length, 1);
});

test('subirDeNivel recusa trocar dois planos no mesmo nível', async () => {
  const p = await escadaDeNivel('Artífice', async () => {}, { subclasse: 'Alquimista', ateNivel: 6 });
  const c = ctx(p);
  const atuais = p.recursos.artifice.planos;
  const livres = R.completarCanonico([], { ...c, max: 40, nivel: 7 }).filter((x) => !atuais.some((a) => a.item_id === x.item_id && (a.variante_id || '') === (x.variante_id || '')));
  const lista = [...atuais.slice(2), livres[0], livres[1]];
  p.xp = levelup.XP_POR_NIVEL[7];
  const r = await levelup.subirDeNivel(p, { planos_artifice: lista, subclasse: 'Alquimista' });
  assert.equal(r.tipo_pendencia, 'planos_artifice');
  assert.match(r.mensagem, /1 plano/);
  assert.equal(p.nivel, 6);
});

test('subirDeNivel sem planos_artifice devolve a pendência em nível de Artífice 2+', async () => {
  const p = await escadaDeNivel('Artífice', async () => {}, { subclasse: 'Alquimista', ateNivel: 2 });
  p.xp = levelup.XP_POR_NIVEL[3];
  const r = await levelup.subirDeNivel(p, { subclasse: 'Alquimista' });
  assert.equal(r.tipo_pendencia, 'planos_artifice');
});

test('subirDeNivel aplica a lista e apaga os itens replicados do plano que saiu', async () => {
  const p = await escadaDeNivel('Artífice', async () => {}, { subclasse: 'Alquimista', ateNivel: 6 });
  const c = ctx(p);
  const atuais = p.recursos.artifice.planos;
  const saiu = atuais[0];
  const livre = R.completarCanonico([], { ...c, max: 40, nivel: 7 }).find((x) => !atuais.some((a) => a.item_id === x.item_id && (a.variante_id || '') === (x.variante_id || '')));
  p.inventario.push({ nome: 'Replicado de teste', origem: { tipo: 'replicado', conhecido_id: saiu.id } });
  p.inventario.push({ nome: 'Outro', origem: { tipo: 'replicado', conhecido_id: atuais[1].id } });
  p.xp = levelup.XP_POR_NIVEL[7];
  const r = await levelup.subirDeNivel(p, { planos_artifice: [...atuais.slice(1), livre], subclasse: 'Alquimista' });
  assert.equal(r.sucesso, true, JSON.stringify(r));
  assert.equal(p.recursos.artifice.planos.length, 5);
  assert.ok(!p.recursos.artifice.planos.some((x) => x.id === saiu.id));
  assert.ok(!p.inventario.some((i) => i.nome === 'Replicado de teste'));
  assert.ok(p.inventario.some((i) => i.nome === 'Outro'));
});

// Artífice 6 (Alquimista) pronto para subir ao 7, com um item replicado ligado a cada conhecido.
async function artifice6ComItens() {
  const p = await escadaDeNivel('Artífice', async () => {}, { subclasse: 'Alquimista', ateNivel: 6 });
  for (const k of p.recursos.artifice.planos) p.inventario.push({ nome: `Item ${k.id}`, origem: { tipo: 'replicado', conhecido_id: k.id } });
  p.xp = levelup.XP_POR_NIVEL[7];
  return p;
}

/** Plano livre (fora dos atuais) disponível no nível 7. */
function planoLivre(p) {
  const atuais = p.recursos.artifice.planos;
  return R.completarCanonico([], { ...ctx(p), max: 40, nivel: 7 }).find((x) => !atuais.some((a) => a.item_id === x.item_id && (a.variante_id || '') === (x.variante_id || '')));
}

test('reenviar plano conhecido com id novo mantém o item replicado', async () => {
  const p = await artifice6ComItens();
  const atuais = p.recursos.artifice.planos;
  const lista = [{ ...atuais[0], id: 'id-novo' }, ...atuais.slice(1)];
  const r = await levelup.subirDeNivel(p, { planos_artifice: lista, subclasse: 'Alquimista' });
  assert.equal(r.sucesso, true, JSON.stringify(r));
  assert.ok(p.inventario.some((i) => i.nome === `Item ${atuais[0].id}`));
  assert.equal(p.recursos.artifice.planos[0].id, atuais[0].id);
});

test('plano diferente com id antigo reaproveitado é recusado e nada é apagado', async () => {
  const p = await artifice6ComItens();
  const atuais = p.recursos.artifice.planos;
  const lista = [...atuais.slice(1), { ...planoLivre(p), id: atuais[0].id }];
  const r = await levelup.subirDeNivel(p, { planos_artifice: lista, subclasse: 'Alquimista' });
  assert.equal(r.tipo_pendencia, 'planos_artifice');
  assert.ok(p.inventario.some((i) => i.nome === `Item ${atuais[0].id}`));
});

test('plano sem id ou com id repetido é recusado', async () => {
  const p = await artifice6ComItens();
  const atuais = p.recursos.artifice.planos;
  const semId = [...atuais.slice(1), { ...planoLivre(p), id: undefined }];
  assert.equal((await levelup.subirDeNivel(p, { planos_artifice: semId, subclasse: 'Alquimista' })).tipo_pendencia, 'planos_artifice');
  const livre = planoLivre(p);
  const repetido = [...atuais.slice(1), { ...livre, id: atuais[1].id }];
  assert.equal((await levelup.subirDeNivel(p, { planos_artifice: repetido, subclasse: 'Alquimista' })).tipo_pendencia, 'planos_artifice');
});

test('base_nome inválida na subida é recusada', async () => {
  const p = await artifice6ComItens();
  const atuais = p.recursos.artifice.planos;
  const comBase = planos.find((x) => !x.generico && R.resolverPlano(x, acervo)?.item.base && x.nivel_minimo <= 7
    && !atuais.some((a) => a.item_id === x.item_id && (a.variante_id || '') === (x.variante_id || '')));
  assert.ok(comBase, 'precisa existir plano com base');
  const k = { ...conhecido(comBase.id), base_nome: 'Inexistente' };
  const r = await levelup.subirDeNivel(p, { planos_artifice: [...atuais.slice(1), k], subclasse: 'Alquimista' });
  assert.equal(r.tipo_pendencia, 'planos_artifice');
  assert.match(r.mensagem, /[Bb]ase/);
});

test('trapacear a morte: PV limitado ao PV máximo', () => {
  const p = artifice(20);
  const ids = idsNaoArmadura('Incomum').slice(0, 2);
  p.recursos.artifice = { planos: ids.map((id, i) => conhecido(id, `t${i}`)) };
  R.criarItensReplicados(p, ['t0', 't1'], ctx(p));
  p.pv_max = 30;
  p.pv_atual = 0;
  assert.equal(R.trapacearMorte(p, [0, 1]), 2);
  assert.equal(p.pv_atual, 30);
});

test('cargasDoItem: só item replicado com cargas', () => {
  const p = artifice(6);
  const comCargas = planos.find((x) => !x.generico && R.resolverPlano(x, acervo)?.item.recursos?.cargas);
  const k = conhecido(comCargas.id);
  p.recursos.artifice = { planos: [k] };
  R.criarItensReplicados(p, [k.id], ctx(p));
  const item = p.inventario[0];
  const max = item.dados.recursos.cargas.max;
  assert.deepEqual(R.cargasDoItem(item), { atual: max, max });
  item.estado_recursos.cargas = 1;
  assert.equal(R.cargasDoItem(item).atual, 1);
  assert.equal(R.cargasDoItem({ nome: 'x', dados: {} }), null);
});

test('I2: subirDeNivel devolve os nomes dos itens replicados removidos pela troca de plano', async () => {
  const p = await escadaDeNivel('Artífice', async () => {}, { subclasse: 'Alquimista', ateNivel: 6 });
  const c = ctx(p);
  const atuais = p.recursos.artifice.planos;
  const livre = R.completarCanonico([], { ...c, max: 40, nivel: 7 }).find((x) => !atuais.some((a) => a.item_id === x.item_id && (a.variante_id || '') === (x.variante_id || '')));
  p.inventario.push({ nome: 'Item que some', origem: { tipo: 'replicado', conhecido_id: atuais[0].id } });
  p.xp = levelup.XP_POR_NIVEL[7];
  const r = await levelup.subirDeNivel(p, { planos_artifice: [...atuais.slice(1), livre], subclasse: 'Alquimista' });
  assert.equal(r.sucesso, true, JSON.stringify(r));
  assert.deepEqual(r.itens_replicados_removidos, ['Item que some']);
});

// Armeiro 9 com 3 itens não-Armadura e a Armadura extra (limite 4 no total).
function armeiroCheio() {
  const p = artifice(9, 'Armeiro');
  const ids = idsNaoArmadura('Comum').concat(idsNaoArmadura('Incomum')).slice(0, 5);
  const ks = ids.map((id, i) => conhecido(id, `n${i}`));
  const armaduraId = planos.find((x) => !x.generico && R.resolverPlano(x, acervo)?.item.tipo === 'Armadura' && R.resolverPlano(x, acervo))?.id;
  const ka = { ...conhecidoArmadura(armaduraId), id: 'arm', armeiro: true };
  p.recursos.artifice = { planos: [...ks, ka] };
  return { p, ks, ka };
}

test('M1: transmutar a Armadura do Armeiro em item não-Armadura é recusado', () => {
  const { p, ks } = armeiroCheio();
  const c = ctx(p);
  R.criarItensReplicados(p, [ks[0].id, ks[1].id, ks[2].id, 'arm'], c);
  assert.equal(R.itensReplicados(p).length, 4);
  const idxArm = p.inventario.findIndex((i) => i.origem?.conhecido_id === 'arm');
  assert.equal(R.transmutarItem(p, idxArm, ks[3].id, c), false);
  assert.equal(p.inventario[idxArm].origem.conhecido_id, 'arm');
  assert.equal(p.recursos.artifice.transmutar_usado, false);
  assert.ok(R.erroTransmutarArmeiro(p, idxArm, ks[3].id, c));
});

test('M2: criar mais não-Armadura do que o Armeiro permite é um erro de validação', () => {
  const { p, ks } = armeiroCheio();
  const c = ctx(p);
  assert.ok(R.erroCriarItens(p, ks.slice(0, 4).map((k) => k.id), c));
  assert.equal(R.erroCriarItens(p, [ks[0].id, ks[1].id, ks[2].id, 'arm'], c), null);
  assert.ok(R.erroCriarItens(p, ks.slice(0, 5).map((k) => k.id).concat('arm'), c));
});
