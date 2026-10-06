// ============================================================
// Subclasses do Artífice (parte I): companheiros, Ferreiro de Batalha e
// Artilheiro, contra os dados reais de dados/tasha/artifice.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { modulosApp, RAIZ, escadaDeNivel } from './harness.mjs';

// Chaves reais de modulosApp() (harness.mjs): `equip` (regras-equipamento), `sheetEstado`, `sheetCombate`,
// `regrasSubclasseEscolhas`, `levelup`, `db`. Uma única desestruturação para o arquivo todo: os testes da
// Task 3 e da Task 4 são acrescentados aqui, e um segundo `const { ... } = await modulosApp()` seria SyntaxError.
const { db, equip, sheetEstado, sheetCombate, regrasSubclasseEscolhas, levelup } = await modulosApp();
const C = await import(pathToFileURL(resolve(RAIZ, 'site/js/regras-criaturas-artifice.js')).href);
const regrasArtifice = await import(pathToFileURL(resolve(RAIZ, 'site/js/regras-artifice.js')).href);
const criaturas = (await db.getCriaturasArtifice()).criaturas;
const porId = (id) => criaturas.find((c) => c.id === id);

/** Artífice de nível n, subclasse e Int dadas. */
function artifice(n, subclasse = '', int = 16, extra = {}) {
  return { classes: [{ classe: 'Artífice', nivel: n, ordem: 0, subclasse }], classe: 'Artífice', subclasse, nivel: n,
    atributos: { inteligencia: int }, inventario: [], recursos: {}, magias_preparadas: [], magias_conhecidas: [], ...extra };
}

test('Defensor de Aço: CA 12 + Int, PV 5 + 5x nível, ataque = PB + Int', () => {
  const e = C.estatisticasCriatura(porId('defensor-de-aco'), artifice(5, 'Ferreiro de Batalha', 16));
  assert.equal(e.ca, 15);
  assert.equal(e.pvMax, 30);
  assert.equal(e.ataque, 6);
  assert.equal(e.cd, 14);
});

test('Defensor de Aço: Golpe Reforçado por Energia = 1d8 + 2 + mod. Int; ação "Reparar (3/Dia)" casa por startsWith', () => {
  const e = C.estatisticasCriatura(porId('defensor-de-aco'), artifice(5, 'Ferreiro de Batalha', 16));
  assert.match(e.acoes.find((a) => a.nome === 'Golpe Reforçado por Energia').texto, /1d8 \+ 5 de dano/);
  const reparar = e.acoes.find((a) => a.nome.startsWith('Reparar'));
  assert.equal(reparar.nome, 'Reparar (3/Dia)');
  assert.equal(porId('defensor-de-aco').acoes.find((a) => a.nome.startsWith('Reparar')).usos, 3);
  assert.equal(porId('defensor-de-aco').acoes.find((a) => a.nome.startsWith('Reparar')).recupera, 'descanso_longo');
});

test('Canhão Místico: CA 18, PV 5x nível; +1d8 no dano a partir do 9', () => {
  const e5 = C.estatisticasCriatura(porId('canhao-mistico'), artifice(5, 'Artilheiro'));
  assert.equal(e5.ca, 18);
  assert.equal(e5.pvMax, 25);
  assert.equal(e5.acoes.find((a) => a.nome === 'Lança-Chamas').texto, 'Salvaguarda de Destreza CD 14 · Cone de 4,5 metros · 2d8 de dano Ígneo');
  const e9 = C.estatisticasCriatura(porId('canhao-mistico'), artifice(9, 'Artilheiro'));
  assert.equal(e9.acoes.find((a) => a.nome === 'Lança-Chamas').texto, 'Salvaguarda de Destreza CD 15 · Cone de 4,5 metros · 2d8 + 1d8 de dano Ígneo');
});

test('Texto do dado usa "-" quando a soma é negativa e omite quando é zero', () => {
  // Int 3 (mod -4): 2 + (-4) = -2.
  const neg = C.estatisticasCriatura(porId('defensor-de-aco'), artifice(5, 'Ferreiro de Batalha', 3));
  const rasgo = neg.acoes.find((a) => a.nome === 'Golpe Reforçado por Energia').texto;
  assert.match(rasgo, /1d8 - 2 de dano/);
  assert.doesNotMatch(rasgo, /\+ -/);
  // Int 7 (mod -2): soma 0, sem termo.
  const zero = C.estatisticasCriatura(porId('defensor-de-aco'), artifice(5, 'Ferreiro de Batalha', 7));
  assert.match(zero.acoes.find((a) => a.nome === 'Golpe Reforçado por Energia').texto, /1d8 de dano/);
});

test('Servo Homúnculo: PV 5 + 5x círculo', () => {
  const e = C.estatisticasCriatura(porId('servo-homunculo'), artifice(3), { circulo: 3 });
  assert.equal(e.pvMax, 20);
});

test('disponíveis: Defensor só Ferreiro 3+; canhão Artilheiro 3+; Servo com a magia', () => {
  assert.deepEqual(C.companheirosDisponiveis(artifice(3, 'Ferreiro de Batalha')), ['defensor-de-aco']);
  assert.deepEqual(C.companheirosDisponiveis(artifice(3, 'Artilheiro')), ['canhao-mistico']);
  assert.deepEqual(C.companheirosDisponiveis(artifice(3, 'Alquimista', 16, { magias_preparadas: [{ nome: 'Servo Homúnculo', circulo: 2 }] })), ['servo-homunculo']);
  assert.deepEqual(C.companheirosDisponiveis(artifice(2)), []);
});

test('canhões: 1 até o 14; no 15 a criação cria os dois de uma vez; nunca 3', () => {
  const p = artifice(15, 'Artilheiro');
  assert.equal(C.maxInstancias('canhao-mistico', artifice(14, 'Artilheiro')), 1);
  assert.equal(C.vagasCanhao(p), 2);
  assert.equal(C.criarCompanheiro(p, 'canhao-mistico', 75, {}), true);
  assert.equal(p.recursos.artifice.companheiros['canhao-mistico'].length, 2);
  assert.equal(p.recursos.artifice.canhao_gratis_usado, true);
  assert.equal(C.vagasCanhao(p), 0);
  assert.equal(C.criarCompanheiro(p, 'canhao-mistico', 75, { gastouEspaco: true }), false);
});

test('canhões no 15 gastando espaço: criam dois (um espaço cada); com um existente, só o segundo', () => {
  const p = artifice(15, 'Artilheiro');
  assert.equal(C.criarCompanheiro(p, 'canhao-mistico', 75, {}), true);
  C.dispensarCompanheiro(p, 'canhao-mistico', 0);
  C.dispensarCompanheiro(p, 'canhao-mistico', 0);
  assert.equal(C.criarCompanheiro(p, 'canhao-mistico', 75, {}), false);
  assert.equal(C.criarCompanheiro(p, 'canhao-mistico', 75, { gastouEspaco: true }), true);
  assert.equal(p.recursos.artifice.companheiros['canhao-mistico'].length, 2);
  C.dispensarCompanheiro(p, 'canhao-mistico', 1);
  assert.equal(C.vagasCanhao(p), 1);
  assert.equal(C.criarCompanheiro(p, 'canhao-mistico', 75, { gastouEspaco: true }), true);
  assert.equal(p.recursos.artifice.companheiros['canhao-mistico'].length, 2);
});

test('canhão em 0 PV desaparece; defensor em 0 PV não é curado por ajuste de PV e só volta com reviver', () => {
  const p = artifice(5, 'Artilheiro');
  C.criarCompanheiro(p, 'canhao-mistico', 25, {});
  assert.equal(C.ajustarPVCompanheiro(p, 'canhao-mistico', 0, -99, 25), 0);
  assert.equal(p.recursos.artifice.companheiros['canhao-mistico'].length, 0);
  const f = artifice(5, 'Ferreiro de Batalha');
  C.criarCompanheiro(f, 'defensor-de-aco', 30, {});
  assert.equal(C.reviverDefensor(f, 30), false);
  C.ajustarPVCompanheiro(f, 'defensor-de-aco', 0, -99, 30);
  assert.equal(f.recursos.artifice.companheiros['defensor-de-aco'][0].pv_atual, 0);
  assert.equal(C.ajustarPVCompanheiro(f, 'defensor-de-aco', 0, 10, 30), 0);
  assert.equal(C.reviverDefensor(f, 30), true);
  assert.equal(f.recursos.artifice.companheiros['defensor-de-aco'][0].pv_atual, 30);
});

test('Deflexão Aprimorada (Ferreiro 15) aparece na reação Desviar Ataque do defensor', () => {
  const r5 = C.estatisticasCriatura(porId('defensor-de-aco'), artifice(5, 'Ferreiro de Batalha', 16)).reacoes.find((r) => r.nome === 'Desviar Ataque');
  assert.doesNotMatch(r5.texto, /Deflexão Aprimorada/);
  const r15 = C.estatisticasCriatura(porId('defensor-de-aco'), artifice(15, 'Ferreiro de Batalha', 16)).reacoes.find((r) => r.nome === 'Desviar Ataque');
  assert.match(r15.texto, /Deflexão Aprimorada: o atacante sofre 1d4 \+ 3 de dano Energético/);
});

test('canhão grátis 1x por Descanso Longo; depois só gastando espaço', () => {
  const p = artifice(3, 'Artilheiro');
  assert.equal(C.criarCompanheiro(p, 'canhao-mistico', 15, {}), true);
  C.dispensarCompanheiro(p, 'canhao-mistico', 0);
  assert.equal(C.criarCompanheiro(p, 'canhao-mistico', 15, {}), false);
  assert.equal(C.criarCompanheiro(p, 'canhao-mistico', 15, { gastouEspaco: true }), true);
  regrasArtifice.descansoLongoArtifice(p);
  assert.equal(p.recursos.artifice.canhao_gratis_usado, false);
});

test('PV do companheiro fica entre 0 e o máximo', () => {
  const p = artifice(3, 'Ferreiro de Batalha');
  C.criarCompanheiro(p, 'defensor-de-aco', 20, {});
  assert.equal(C.ajustarPVCompanheiro(p, 'defensor-de-aco', 0, -5, 20), 15);
  assert.equal(C.ajustarPVCompanheiro(p, 'defensor-de-aco', 0, 99, 20), 20);
  assert.equal(C.ajustarPVCompanheiro(p, 'defensor-de-aco', 0, -50, 20), 0);
});

test('Reparar 3/dia e Golpe Arcano (mod. Int) voltam no Descanso Longo', () => {
  const p = artifice(9, 'Ferreiro de Batalha', 14);
  for (let i = 0; i < 3; i++) assert.equal(C.usarRepararDefensor(p), true);
  assert.equal(C.usarRepararDefensor(p), false);
  assert.equal(C.golpeArcanoMax(p), 2);
  assert.equal(C.usarGolpeArcano(p), true);
  assert.equal(C.usarGolpeArcano(p), true);
  assert.equal(C.usarGolpeArcano(p), false);
  regrasArtifice.descansoLongoArtifice(p);
  assert.equal(C.usarRepararDefensor(p), true);
  assert.equal(C.usarGolpeArcano(p), true);
});

// ---------- Task 3: concessões, Ataque Extra, Int em arma mágica ----------

test('linhas automáticas: Ferreiro (Ferreiro, Armas Marciais) e Artilheiro (Entalhador, marciais à distância)', () => {
  const linhas = regrasSubclasseEscolhas.ESCOLHAS_SUBCLASSE_APP.filter((l) => ['Ferreiro de Batalha', 'Artilheiro'].includes(l.subclasse));
  const ferr = linhas.filter((l) => l.subclasse === 'Ferreiro de Batalha').map((l) => l.automatica);
  assert.ok(ferr.some((a) => a.ferramentas?.includes('Ferramentas de Ferreiro')));
  assert.ok(ferr.some((a) => a.extras?.includes('Armas Marciais')));
  const art = linhas.filter((l) => l.subclasse === 'Artilheiro').map((l) => l.automatica);
  assert.ok(art.some((a) => a.ferramentas?.includes('Ferramentas de Entalhador')));
  assert.ok(art.some((a) => a.extras?.includes('Armas Marciais à Distância')));
});

test('proficiência: "Armas Marciais à Distância" cobre arco longo e não cobre espada longa', () => {
  const p = { classes: [{ classe: 'Artífice', nivel: 3, ordem: 0 }], proficiencias_extra: ['Armas Marciais à Distância'] };
  assert.equal(equip.temProficienciaArma(p, { categoria: 'Armas Marciais à Distância' }), true);
  assert.equal(equip.temProficienciaArma(p, { categoria: 'Armas Marciais Corpo a Corpo' }), false);
  // Controle: sem a concessão, o Artífice não tem proficiência em arma Marcial.
  const sem = { classes: [{ classe: 'Artífice', nivel: 3, ordem: 0 }], proficiencias_extra: [] };
  assert.equal(equip.temProficienciaArma(sem, { categoria: 'Armas Marciais à Distância' }), false);
});

test('escada real: Ferreiro e Artilheiro ganham as concessões do nível 3 pela subida de nível', async () => {
  const f = await escadaDeNivel('Artífice', async () => {}, { subclasse: 'Ferreiro de Batalha', ateNivel: 3 });
  assert.ok(f.proficiencias_ferramentas.includes('Ferramentas de Ferreiro'));
  assert.ok(f.proficiencias_extra.includes('Armas Marciais'));
  const a = await escadaDeNivel('Artífice', async () => {}, { subclasse: 'Artilheiro', ateNivel: 3 });
  assert.ok(a.proficiencias_ferramentas.includes('Ferramentas de Entalhador'));
  assert.ok(a.proficiencias_extra.includes('Armas Marciais à Distância'));
  // Controle: o Alquimista não ganha as marciais.
  const q = await escadaDeNivel('Artífice', async () => {}, { subclasse: 'Alquimista', ateNivel: 3 });
  assert.ok(!(q.proficiencias_extra || []).some((x) => /Marciais/.test(x)));
});

test('Int em arma: só Ferreiro 3+, só arma mágica ativa, só se for maior', () => {
  const ferreiro = artifice(3, 'Ferreiro de Batalha', 18);
  const magica = { dados: { magico_id: 'arma-mais-1', categoria: 'Armas Marciais Corpo a Corpo' } };
  const comum = { dados: { categoria: 'Armas Marciais Corpo a Corpo' } };
  assert.deepEqual(regrasArtifice.modAtaqueArmaArtifice(ferreiro, magica, 2), { mod: 4, usouInt: true });
  assert.deepEqual(regrasArtifice.modAtaqueArmaArtifice(ferreiro, comum, 2), { mod: 2, usouInt: false });
  assert.deepEqual(regrasArtifice.modAtaqueArmaArtifice(ferreiro, magica, 5), { mod: 5, usouInt: false });
  assert.deepEqual(regrasArtifice.modAtaqueArmaArtifice(artifice(3, 'Alquimista', 18), magica, 2), { mod: 2, usouInt: false });
  assert.deepEqual(regrasArtifice.modAtaqueArmaArtifice(artifice(2, 'Ferreiro de Batalha', 18), magica, 2), { mod: 2, usouInt: false });
  // Mago com Int alta e arma mágica: inalterado.
  const mago = { classes: [{ classe: 'Mago', nivel: 5, ordem: 0, subclasse: 'Evocador' }], classe: 'Mago', nivel: 5, atributos: { inteligencia: 20 } };
  assert.deepEqual(regrasArtifice.modAtaqueArmaArtifice(mago, magica, 0), { mod: 0, usouInt: false });
  // Sintonização e destruição, como em efeitosDaArma.
  const exige = (s) => ({ sintonizado: s, dados: { magico_id: 'x', requer_sintonizacao: true } });
  assert.deepEqual(regrasArtifice.modAtaqueArmaArtifice(ferreiro, exige(false), 2), { mod: 2, usouInt: false });
  assert.deepEqual(regrasArtifice.modAtaqueArmaArtifice(ferreiro, exige(true), 2), { mod: 4, usouInt: true });
  assert.deepEqual(regrasArtifice.modAtaqueArmaArtifice(ferreiro, { destruido: true, ...magica }, 2), { mod: 2, usouInt: false });
});

test('Ataque Extra: Ferreiro e Armeiro no 5 de Artífice; não Alquimista; não Artífice 3/Guerreiro 2; outras classes intactas', () => {
  const casos = [
    [[{ classe: 'Artífice', nivel: 5, ordem: 0, subclasse: 'Ferreiro de Batalha' }], 2],
    [[{ classe: 'Artífice', nivel: 5, ordem: 0, subclasse: 'Armeiro' }], 2],
    [[{ classe: 'Artífice', nivel: 4, ordem: 0, subclasse: 'Ferreiro de Batalha' }], 1],
    [[{ classe: 'Artífice', nivel: 5, ordem: 0, subclasse: 'Alquimista' }], 1],
    [[{ classe: 'Artífice', nivel: 3, ordem: 0, subclasse: 'Ferreiro de Batalha' }, { classe: 'Guerreiro', nivel: 2, ordem: 1 }], 1],
    [[{ classe: 'Guerreiro', nivel: 5, ordem: 0, subclasse: 'Mestre da Batalha' }, { classe: 'Artífice', nivel: 5, ordem: 1, subclasse: 'Ferreiro de Batalha' }], 2],
    [[{ classe: 'Mago', nivel: 5, ordem: 0, subclasse: 'Evocador' }], 1],
    [[{ classe: 'Guerreiro', nivel: 5, ordem: 0, subclasse: 'Mestre da Batalha' }], 2],
  ];
  for (const [classes, esperado] of casos) {
    sheetEstado.definirChar({ classes, classe: classes[0].classe, nivel: classes.reduce((s, c) => s + c.nivel, 0), atributos: {}, recursos: {} });
    assert.equal(sheetCombate.getAtaquesPorAcao(), esperado, JSON.stringify(classes));
  }
});

// Oráculo: prende as listas de magias sempre preparadas (tabelas "Magias de ..." de classe.json) por nível exato.
test('magias sempre preparadas do Artilheiro e do Ferreiro de Batalha batem com as tabelas de classe.json', async () => {
  const ESPERADO = {
    'Artilheiro': { 3: ['Escudo Arcano', 'Onda Trovejante'], 5: ['Raio Ardente', 'Despedaçar'], 9: ['Bola de Fogo', 'Muralha de Vento'], 13: ['Tempestade Glacial', 'Muralha de Fogo'], 17: ['Cone de Frio', 'Muralha de Energia'] },
    'Ferreiro de Batalha': { 3: ['Heroísmo', 'Escudo Arcano'], 5: ['Destruição Radiante', 'Vínculo de Proteção'], 9: ['Aura de Vitalidade', 'Invocar Barragem'], 13: ['Aura de Pureza', 'Escudo Ardente'], 17: ['Destruição Banidora', 'Curar Ferimentos em Massa'] },
  };
  for (const [sub, porNivel] of Object.entries(ESPERADO)) {
    for (const [nivel, nomes] of Object.entries(porNivel)) {
      const got = (await levelup.obterMagiasSemprePreparadasNivel('Artífice', sub, Number(nivel))).map((m) => m.nome);
      assert.deepEqual([...got].sort(), [...nomes].sort(), `${sub} ${nivel}`);
    }
  }
});
