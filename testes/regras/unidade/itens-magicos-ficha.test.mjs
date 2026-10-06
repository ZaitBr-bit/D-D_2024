// ============================================================
// A ficha soma os efeitos de item (site/js/regras-itens-magicos.js):
// CA, ataque/CD de magia, salvaguardas e ataque/dano da própria arma.
// Mede pela API que a ficha usa (utils.js) e pelo HTML do inventário.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { modulosApp, personagemMulticlasse, RAIZ } from './harness.mjs';

const { utils, sheetEstado, sheetCombate } = await modulosApp();
const inventario = await import('../../../site/js/sheet/inventario.js');

const ANEL = { nome: 'Anel de Proteção', tipo: 'magico', equipado: true, sintonizado: true,
  dados: { requer_sintonizacao: true, efeitos: [{ alvo: 'ca', valor: 1 }, { alvo: 'salvaguarda', valor: 1 }] } };

/** Guerreiro 1, todos os atributos 15 (mod +2, proficiência +2). */
const guerreiro = async () => {
  const p = await personagemMulticlasse([{ classe: 'Guerreiro', nivel: 1 }]);
  // O harness não preenche as salvaguardas proficientes (o criador as grava).
  p.salvaguardas_proficientes = ['Força', 'Constituição'];
  return p;
};

test('Anel de Proteção sintonizado: +1 CA e +1 em toda salvaguarda', async () => {
  const p = await guerreiro();
  const ca = utils.calcCA(p);
  const salv = ['forca', 'destreza', 'sabedoria'].map((k) => utils.calcSalvaguarda(p, k));
  p.inventario = [structuredClone(ANEL)];
  assert.equal(utils.calcCA(p), ca + 1);
  assert.deepEqual(['forca', 'destreza', 'sabedoria'].map((k) => utils.calcSalvaguarda(p, k)), salv.map((x) => x + 1));
});

test('Anel de Proteção sem sintonizar: nada muda', async () => {
  const p = await guerreiro();
  const ca = utils.calcCA(p);
  const salv = utils.calcSalvaguarda(p, 'forca');
  p.inventario = [{ ...structuredClone(ANEL), sintonizado: false }];
  assert.equal(utils.calcCA(p), ca);
  assert.equal(utils.calcSalvaguarda(p, 'forca'), salv);
});

test('calcSalvaguarda sem item: modificador + proficiência quando proficiente', async () => {
  const p = await guerreiro(); // Guerreiro: proficiente em Força e Constituição
  assert.equal(utils.calcSalvaguarda(p, 'forca'), 2 + 2);
  assert.equal(utils.calcSalvaguarda(p, 'sabedoria'), 2);
});

test('ficha, impressão e PDF calculam a salvaguarda pela mesma função', () => {
  for (const arq of ['site/js/sheet/ficha.js', 'site/js/sheet/impressao.js', 'site/js/sheet/pdf.js']) {
    const fonte = readFileSync(resolve(RAIZ, arq), 'utf-8');
    assert.ok(fonte.includes('calcSalvaguarda('), `${arq} não usa calcSalvaguarda`);
  }
});

test('bônus de ataque de magia de item do acervo entra na conta', async () => {
  const p = await personagemMulticlasse([{ classe: 'Mago', nivel: 5 }]);
  const atq = utils.calcAtaqueMagia(p);
  const cd = utils.calcCDMagia(p);
  p.inventario = [{ nome: 'Varinha do Mago de Guerra +2', tipo: 'magico', equipado: true, sintonizado: true,
    dados: { requer_sintonizacao: true, efeitos: [{ alvo: 'ataque_magia', valor: 2 }] } }];
  assert.equal(utils.calcAtaqueMagia(p), atq + 2);
  assert.equal(utils.calcCDMagia(p), cd);
});

test('regressão: customizado sem sintonização com bonus_ca/ca_base dá a mesma CA de antes', async () => {
  const p = await guerreiro();
  const ca = utils.calcCA(p);
  p.inventario = [{ nome: 'Amuleto', tipo: 'customizado', equipado: true, dados: { bonus_ca: '2' } }];
  assert.equal(utils.calcCA(p), ca + 2);
  p.inventario = [{ nome: 'Pele', tipo: 'customizado', equipado: true, dados: { ca_base: '18' } }];
  assert.equal(utils.calcCA(p), 18);
});

test('mudança declarada: customizado que exige sintonização só dá CA sintonizado', async () => {
  const p = await guerreiro();
  const ca = utils.calcCA(p);
  p.inventario = [{ nome: 'Amuleto', tipo: 'customizado', equipado: true, sintonizado: false, dados: { bonus_ca: '2', requer_sintonizacao: true } }];
  assert.equal(utils.calcCA(p), ca);
  p.inventario[0].sintonizado = true;
  assert.equal(utils.calcCA(p), ca + 2);
});

test('Braçadeiras de Defesa: +2 sem armadura, nada com Couro', async () => {
  const p = await guerreiro();
  const bracadeiras = { nome: 'Braçadeiras de Defesa', tipo: 'magico', equipado: true, sintonizado: true,
    dados: { requer_sintonizacao: true, efeitos: [{ alvo: 'ca', valor: 2, condicao: 'sem_armadura_nem_escudo' }] } };
  p.inventario = [];
  const caSem = utils.calcCA(p);
  p.inventario = [bracadeiras];
  assert.equal(utils.calcCA(p), caSem + 2);
  const couro = { nome: 'Couro', tipo: 'armadura', equipado: true, dados: { ca: '11 + modificador de Des', categoria: 'Leve' } };
  p.inventario = [couro];
  const caCouro = utils.calcCA(p);
  p.inventario = [couro, bracadeiras];
  assert.equal(utils.calcCA(p), caCouro);
});

/** HTML do inventário renderizado para o personagem. */
function htmlInventario(p) {
  sheetEstado.definirChar(p);
  return inventario.renderSecaoInventario();
}

const RAPIEIRA = { nome: 'Rapieira', categoria: 'Armas Marciais Corpo a Corpo', dano: '1d8 Perfurante', propriedades: 'Acuidade', maestria: 'Afligir', peso: '1 kg', custo: '25 PO' };

test('Rapieira comum: Atq +4, Dano 1d8+2 (controle)', async () => {
  const p = await guerreiro();
  p.inventario = [{ nome: 'Rapieira', tipo: 'arma', equipado: true, quantidade: 1, dados: { ...RAPIEIRA } }];
  const html = htmlInventario(p);
  assert.ok(html.includes('Atq +4'), 'ataque sem bônus');
  assert.ok(html.includes('Dano 1d8+2 Perfurante'), 'dano sem bônus');
});

test('Rapieira +1 (efeitos ataque_arma/dano_arma): Atq +5, Dano 1d8+3', async () => {
  const p = await guerreiro();
  p.inventario = [{ nome: 'Rapieira +1', tipo: 'arma', equipado: true, quantidade: 1,
    dados: { ...RAPIEIRA, efeitos: [{ alvo: 'ataque_arma', valor: 1 }, { alvo: 'dano_arma', valor: 1 }] } }];
  const html = htmlInventario(p);
  assert.ok(html.includes('Atq +5'), html.match(/Atq [+-]\d+/)?.[0]);
  assert.ok(html.includes('Dano 1d8+3 Perfurante'), html.match(/Dano [^<]+/)?.[0]);
});

test('arma mágica que exige sintonização, não sintonizada: sem o +N', async () => {
  const p = await guerreiro();
  p.inventario = [{ nome: 'Rapieira Vorpal', tipo: 'arma', equipado: true, sintonizado: false, quantidade: 1,
    dados: { ...RAPIEIRA, requer_sintonizacao: true, efeitos: [{ alvo: 'ataque_arma', valor: 3 }, { alvo: 'dano_arma', valor: 3 }] } }];
  const html = htmlInventario(p);
  assert.ok(html.includes('Atq +4'));
  assert.ok(html.includes('Dano 1d8+2 Perfurante'));
});

test('arma customizada com bonus_ataque e dano com modificador embutido: ataque soma, dano mantém', async () => {
  const p = await guerreiro();
  p.inventario = [{ nome: 'Clava do Avô', tipo: 'customizado', equipado: true, quantidade: 1,
    dados: { categoria: 'Armas Simples Corpo a Corpo', propriedades: 'Leve', dano: '1d6+1 Contundente', bonus_ataque: '1' } }];
  const html = htmlInventario(p);
  assert.ok(html.includes('Atq +5'), html.match(/Atq [+-]\d+/)?.[0]);
  assert.ok(html.includes('Dano 1d6+1 Contundente'), html.match(/Dano [^<]+/)?.[0]);
});

test('arma com dano com modificador embutido + efeito dano_arma: o efeito soma no ramo modExistente', async () => {
  const p = await guerreiro();
  p.inventario = [{ nome: 'Clava +1', tipo: 'arma', equipado: true, quantidade: 1,
    dados: { nome: 'Clava', categoria: 'Armas Simples Corpo a Corpo', propriedades: 'Leve', dano: '1d6+1 Contundente', efeitos: [{ alvo: 'dano_arma', valor: 1 }] } }];
  const html = htmlInventario(p);
  assert.ok(html.includes('Dano 1d6+2 Contundente'), html.match(/Dano [^<]+/)?.[0]);
});

const ler = (rel) => JSON.parse(readFileSync(resolve(RAIZ, rel), 'utf-8'));

test('Armadura de Mitral sobre Armadura de Placas equipada não impõe Desvantagem em Furtividade', async () => {
  const catalogo = await import('../../../site/js/itens-magicos-catalogo.js');
  const acervo = ler('dados/livro-do-mestre/capitulo7/itens_magicos.json').itens;
  const placas = ler('dados/equipamento/armaduras.json').armaduras.find((a) => a.nome === 'Armadura de Placas');
  const montar = (id) => ({ ...catalogo.montarItemInventario({ item: acervo.find((i) => i.id === id), base: placas }), equipado: true });
  const p = await guerreiro();
  sheetEstado.definirChar(p);
  p.inventario = [montar('armadura-de-adamantina')];
  assert.deepEqual(sheetCombate.calcVantagemDesvantagemPericia('Furtividade').desvantagens, ['Armadura'], 'controle: Placas comuns impõem');
  p.inventario = [montar('armadura-de-mitral')];
  assert.deepEqual(sheetCombate.calcVantagemDesvantagemPericia('Furtividade').desvantagens, []);
});

test('Defensivo não liga com Escudo +1 sem armadura; liga com armadura corporal', async () => {
  const p = await guerreiro();
  p.escolhas_classe = { ...(p.escolhas_classe || {}), estilo_luta: 'Defensivo' };
  const escudo = { nome: 'Escudo +1', tipo: 'escudo', equipado: true, quantidade: 1, dados: { nome_base: 'Escudo', categoria: 'Escudo', ca: '+2', efeitos: [{ alvo: 'ca', valor: 1 }] } };
  p.inventario = [];
  const caSem = utils.calcCA(p);
  p.inventario = [escudo];
  assert.equal(utils.calcCA(p), caSem + 3, '+2 do escudo e +1 mágico, sem o +1 do Defensivo');
  const cota = { nome: 'Cota de Malha', tipo: 'armadura', equipado: true, quantidade: 1, dados: { categoria: 'Pesada', ca: '16', requisito_forca: '—', furtividade: 'Desvantagem' } };
  p.escolhas_classe.estilo_luta = 'Nenhum';
  p.inventario = [cota];
  const caCota = utils.calcCA(p);
  p.escolhas_classe.estilo_luta = 'Defensivo';
  assert.equal(utils.calcCA(p), caCota + 1, 'controle: com armadura o Defensivo soma 1');
});

// ---------- Ferreiro de Batalha: Int em arma mágica (fiação de inventario.js) ----------

/** Personagem de classe única, For/Des 10 e Int dada, com a Rapieira (mágica +1 ou comum) equipada. */
function comRapieira(classe, nivel, subclasse, int, magica) {
  const dados = { ...RAPIEIRA, ...(magica ? { magico_id: 'rapieira-mais-1', efeitos: [{ alvo: 'ataque_arma', valor: 1 }, { alvo: 'dano_arma', valor: 1 }] } : {}) };
  return { classes: [{ classe, nivel, ordem: 0, subclasse }], classe, subclasse, nivel,
    atributos: { forca: 10, destreza: 10, constituicao: 10, inteligencia: int, sabedoria: 10, carisma: 10 },
    recursos: {}, salvaguardas_proficientes: [], proficiencias_extra: classe === 'Artífice' ? ['Armas Marciais'] : [],
    inventario: [{ nome: 'Rapieira', tipo: 'arma', equipado: true, quantidade: 1, dados }] };
}

test('Ferreiro de Batalha 3: Rapieira mágica usa Int no ataque e no dano (Atq +7, Dano 1d8+5)', () => {
  const html = htmlInventario(comRapieira('Artífice', 3, 'Ferreiro de Batalha', 18, true));
  assert.ok(html.includes('Atq +7'), html.match(/Atq [+-]\d+/)?.[0]);
  assert.ok(html.includes('Dano 1d8+5 Perfurante'), html.match(/Dano [^<]+/)?.[0]);
});

test('Int em arma só vale com a guarda inteira: arma comum, Mago e Ferreiro nível 2 ficam em For/Des', () => {
  const comum = htmlInventario(comRapieira('Artífice', 3, 'Ferreiro de Batalha', 18, false));
  assert.ok(comum.includes('Atq +2'), comum.match(/Atq [+-]\d+/)?.[0]);
  assert.ok(!comum.includes('Dano 1d8+4'), comum.match(/Dano [^<]+/)?.[0]);
  const mago = htmlInventario(comRapieira('Mago', 5, 'Evocador', 20, true));
  assert.ok(!mago.includes('Atq +6') && !mago.includes('Dano 1d8+6'), mago.match(/Atq [+-]\d+/)?.[0]);
  const nivel2 = htmlInventario(comRapieira('Artífice', 2, 'Ferreiro de Batalha', 18, true));
  assert.ok(nivel2.includes('Atq +3'), nivel2.match(/Atq [+-]\d+/)?.[0]);
  assert.ok(nivel2.includes('Dano 1d8+1 Perfurante'), nivel2.match(/Dano [^<]+/)?.[0]);
});
