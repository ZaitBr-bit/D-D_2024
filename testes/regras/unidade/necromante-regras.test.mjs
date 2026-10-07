// ============================================================
// Regras do Necromante: familiar, Vitalidade, Fortitude, Golpe Debilitante,
// Colher, Fortalecer, Extinguir e registro de Mortos-Vivos.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { RAIZ, modulosApp } from './harness.mjs';

await modulosApp();
const F = await import(pathToFileURL(resolve(RAIZ, 'site/js/regras-familiar.js')).href);
const criaturas = JSON.parse(readFileSync(resolve(RAIZ, 'dados/apendices/criaturas.json'), 'utf-8')).criaturas;

/** Mago Necromante do nível dado, Int 16 (+3). */
const necro = (nivel = 3, int = 16) => ({
  classes: [{ classe: 'Mago', subclasse: 'Necromante', nivel, ordem: 0 }], classe: 'Mago', subclasse: 'Necromante', nivel,
  atributos: { inteligencia: int }, recursos: {},
});
const mago = () => ({
  classes: [{ classe: 'Mago', subclasse: 'Abjurador', nivel: 5, ordem: 0 }], classe: 'Mago', subclasse: 'Abjurador', nivel: 5,
  atributos: { inteligencia: 16 }, recursos: {},
});

test('familiar: Esqueleto e Zumbi só para o Necromante, e só do nível 3', () => {
  const nomes = (p, rota) => F.formasEspeciaisDoPersonagem(p, rota, criaturas).map((c) => c.nome);
  assert.deepEqual(nomes(necro(3), 'espaco'), ['Esqueleto', 'Zumbi']);
  assert.deepEqual(nomes(necro(2), 'espaco'), []);
  assert.deepEqual(nomes(mago(), 'espaco'), []);
  assert.equal(nomes(mago(), 'pacto').length, 8, 'o Pacto da Corrente continua com as oito formas');
});

test('familiar: tipo Morto-Vivo só para o Necromante', () => {
  assert.deepEqual(F.tiposDoPersonagem(mago()), ['Celestial', 'Feérico', 'Ínfero']);
  assert.deepEqual(F.tiposDoPersonagem(necro(3)), ['Celestial', 'Feérico', 'Ínfero', 'Morto-Vivo']);
  const gato = criaturas.find((c) => c.nome === 'Gato');
  assert.match(F.tipoExibido(gato, 'Morto-Vivo', false), /^Morto-Vivo Minúscula/);
  const p = { recursos: {} };
  assert.equal(F.registrarFamiliar(p, gato, { tipo: 'Morto-Vivo', tipos: F.tiposDoPersonagem(necro(3)) }).tipo, 'Morto-Vivo');
  assert.equal(F.registrarFamiliar(p, gato, { tipo: 'Morto-Vivo', tipos: F.tiposDoPersonagem(mago()) }).tipo, 'Feérico', 'tipo não permitido cai no padrão');
});

const N = await import(pathToFileURL(resolve(RAIZ, 'site/js/regras-necromante.js')).href);
const esqueleto = criaturas.find((c) => c.nome === 'Esqueleto');

test('fórmulas por nível (Int 16 = +3)', () => {
  assert.equal(N.vitalidadeMortaViva(necro(3), 2), 5, 'espaço 2 + nível 3');
  assert.equal(N.vitalidadeMortaViva(necro(2), 2), 0, 'nível 2 não tem a característica');
  assert.equal(N.vitalidadeMortaViva(mago(), 2), 0, 'outra subclasse não tem');
  assert.equal(N.fortitudeMortaViva(necro(5)), 0);
  assert.equal(N.fortitudeMortaViva(necro(6)), 3 + 3, 'Int +3 e metade do nível 6');
  assert.equal(N.fortitudeMortaViva(necro(7)), 3 + 3, 'metade arredonda para baixo');
  assert.equal(N.golpeDebilitante(necro(6, 8)), 1, 'mínimo 1 com Int baixa');
  assert.equal(N.golpeDebilitante(necro(6)), 3);
  assert.equal(N.pvDaColheita(necro(9)), 0);
  assert.equal(N.pvDaColheita(necro(10)), 10);
  assert.equal(N.pvTemporariosFortalecer(necro(13)), 0);
  assert.equal(N.pvTemporariosFortalecer(necro(14)), 14);
  assert.equal(N.dadosDeExtinguir(2), 1);
  assert.equal(N.dadosDeExtinguir(5), 3, 'metade arredondada para cima');
  assert.equal(N.dadosDeExtinguir(0), 1, 'mínimo 1d6');
});

test('registrar Mortos-Vivos: PV do bloco + Fortitude só do nível 6, sem acumular', () => {
  const p = necro(6);
  const [a, b] = N.registrarMortoVivo(p, esqueleto, { quantidade: 2 });
  const base = parseInt(esqueleto.pv, 10);
  assert.equal(a.pv_max, base + 6);
  assert.equal(a.pv_atual, base + 6);
  assert.notEqual(a.id, b.id);
  assert.equal(N.estadoNecromante(p).mortos_vivos.length, 2);
  assert.equal(N.registrarMortoVivo(necro(3), esqueleto, { quantidade: 1 })[0].pv_max, base, 'sem Fortitude abaixo do 6');
});

test('Mortos-Vivos: PV, dispensar, colher e fortalecer', () => {
  const p = necro(14);
  const [m] = N.registrarMortoVivo(p, esqueleto, { quantidade: 1 });
  N.ajustarPVMortoVivo(p, m.id, -5);
  assert.equal(N.estadoNecromante(p).mortos_vivos[0].pv_atual, m.pv_max - 5);
  N.ajustarPVMortoVivo(p, m.id, 999);
  assert.equal(N.estadoNecromante(p).mortos_vivos[0].pv_atual, m.pv_max, 'cura limitada ao máximo');
  assert.equal(N.fortalecerMortosVivos(p), 14, 'devolve os PV temporários dados');
  assert.equal(N.estadoNecromante(p).mortos_vivos[0].pv_temporarios, 14);
  assert.equal(N.fortalecerMortosVivos(p), 0, 'só uma vez por Descanso Longo');
  assert.equal(N.colherMortoVivo(p, m.id), 14, 'o mago recupera o nível');
  assert.equal(N.estadoNecromante(p).mortos_vivos.length, 0, 'o colhido sai da lista');
  assert.equal(N.dispensarMortoVivo(p, 'inexistente'), false);
});

test('livro de magias: ocupa 1 mão, só para o Necromante de nível 3+, e o aviso some ao empunhar', async () => {
  const A = await import(pathToFileURL(resolve(RAIZ, 'site/js/regras-ataque.js')).href);
  const p = { ...necro(6), inventario: [] };
  assert.equal(N.livroEmpunhado(p), false);
  assert.match(N.avisoLivroNaoEmpunhado(p), /não empunhado/);
  assert.equal(A.maosEmUso(p), 0);
  N.estadoNecromante(p).livro_empunhado = true;
  assert.equal(N.livroEmpunhado(p), true);
  assert.equal(N.avisoLivroNaoEmpunhado(p), '');
  assert.equal(A.maosEmUso(p), 1, 'o livro ocupa uma mão');
  const espada = { nome: 'Montante', equipado: true, quantidade: 1, tipo: 'arma', dados: { categoria: 'Marcial Corpo a Corpo', propriedades: 'Pesada, Duas Mãos', dano: '2d6 Cortante' } };
  const v = A.verificarEquipar(p, espada);
  assert.equal(v.ok, false, 'arma de duas mãos não cabe com o livro na mão');
  assert.deepEqual(v.bloqueadores, ['Livro de magias']);
  assert.equal(N.avisoLivroNaoEmpunhado(necro(5)), '', 'abaixo do nível 6 nada exige o livro');
  const outro = { ...mago(), inventario: [] };
  assert.equal(N.livroEmpunhado(outro), false);
  assert.equal(A.maosEmUso(outro), 0, 'outra subclasse não tem o livro');
});

test('fortalecer sem Mortos-Vivos não gasta o uso', () => {
  const p = necro(14);
  assert.equal(N.fortalecerMortosVivos(p), 0);
  assert.equal(N.estadoNecromante(p).fortalecer_usado, false);
});

test('Espírito Morto-Vivo: PV por forma e círculo, CA, ataques e bônus', () => {
  assert.equal(N.pvDoEspirito('Esquelético', 3), 20);
  assert.equal(N.pvDoEspirito('Pútrido', 3), 30);
  assert.equal(N.pvDoEspirito('Fantasmagórico', 5), 30 + 20, '+10 por círculo acima do 3º');
  const p = necro(6);
  const d = N.dadosDoEspirito(p, 'Pútrido', 5);
  assert.equal(d.ca, 16, 'CA 11 + círculo');
  assert.equal(d.ataques, 2, 'metade do círculo, para baixo');
  assert.equal(N.dadosDoEspirito(p, 'Pútrido', 3).ataques, 1);
  assert.equal(d.bonusAtaque, 3 + 3, 'Int +3 e bônus de proficiência +3 no nível 6');
  assert.equal(d.dano, '1d6 + 3 + 5');
  assert.equal(N.dadosDoEspirito(p, 'Esquelético', 4).dano, '2d4 + 3 + 4');
});

test('registrar o Espírito: Fortitude a partir do nível 6, um só espírito por vez, sem Dados de Vida', () => {
  const p = necro(6);
  const a = N.registrarEspirito(p, 'Pútrido', 3);
  assert.equal(a.pv_max, 30 + 6, 'PV do bloco + Fortitude Morta-Viva');
  assert.equal(a.dados_de_vida, 0);
  assert.equal(a.espirito.forma, 'Pútrido');
  N.registrarMortoVivo(p, esqueleto, { quantidade: 1 });
  const b = N.registrarEspirito(p, 'Esquelético', 4);
  const lista = N.estadoNecromante(p).mortos_vivos;
  assert.equal(lista.filter((m) => m.espirito).length, 1, 'o espírito anterior some');
  assert.equal(lista.length, 2, 'o Esqueleto de Animar Mortos fica');
  assert.equal(b.pv_max, 20 + 10 + 6);
  assert.equal(N.registrarEspirito(necro(3), 'Esquelético', 3).pv_max, 20, 'sem Fortitude abaixo do nível 6');
  assert.equal(N.registrarEspirito(p, 'Inexistente', 3), null);
});

test('Vitalidade: candidatos são os Mortos-Vivos feridos e o familiar Morto-Vivo, e a cura respeita o máximo', () => {
  const p = necro(6);
  assert.deepEqual(N.candidatosVitalidade(p), [], 'sem nenhum Morto-Vivo, ninguém para curar');
  const [cheio, ferido] = N.registrarMortoVivo(p, esqueleto, { quantidade: 2 });
  N.ajustarPVMortoVivo(p, ferido.id, -10);
  let c = N.candidatosVitalidade(p);
  assert.deepEqual(c.map((x) => x.id), [ferido.id], 'o de PV cheio não entra');
  p.recursos.familiar = { forma: 'Zumbi', tipo: '', especial: true, pv_max: 15, pv_atual: 6, situacao: 'ativo', origem: '' };
  c = N.candidatosVitalidade(p);
  assert.deepEqual(c.map((x) => x.tipo), ['morto', 'familiar']);
  assert.equal(N.curarCandidatoVitalidade(p, c[0], 99), 10, 'só recupera o que falta');
  assert.equal(N.curarCandidatoVitalidade(p, c[1], 4), 4);
  assert.equal(p.recursos.familiar.pv_atual, 10);
  p.recursos.familiar.tipo = 'Feérico'; p.recursos.familiar.especial = false; p.recursos.familiar.forma = 'Gato';
  assert.deepEqual(N.candidatosVitalidade(p), [], 'familiar que não é Morto-Vivo não entra');
  assert.equal(cheio.pv_atual, cheio.pv_max);
});
