// ============================================================
// A ficha em jogo lê o atributo efetivo; a subida de nível lê o base.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { modulosApp, personagemMulticlasse } from './harness.mjs';

const { utils, sheetEstado, levelup, sheetFicha } = await modulosApp();
const inventario = await import('../../../site/js/sheet/inventario.js');

const CINTURAO = { nome: 'Cinturão de Força do Gigante (das colinas)', tipo: 'magico', equipado: true, sintonizado: true,
  dados: { requer_sintonizacao: true, efeitos: [{ alvo: 'atributo', atributo: 'forca', minimo: 21 }] } };
const TIARA = { nome: 'Tiara do Intelecto', tipo: 'magico', equipado: true, sintonizado: true,
  dados: { requer_sintonizacao: true, efeitos: [{ alvo: 'atributo', atributo: 'inteligencia', minimo: 19 }] } };

/** Guerreiro 1 com Força 15 (mod +2), proficiente em Força e Constituição. */
async function guerreiro() {
  const p = await personagemMulticlasse([{ classe: 'Guerreiro', nivel: 1 }]);
  p.atributos.forca = 15;
  p.salvaguardas_proficientes = ['Força', 'Constituição'];
  return p;
}

test('salvaguarda e perícia de Força usam a Força do Cinturão (21, mod +5)', async () => {
  const p = await guerreiro();
  const salvAntes = utils.calcSalvaguarda(p, 'forca');
  const atlAntes = utils.calcBonusPericia(p, 'Atletismo');
  p.inventario = [structuredClone(CINTURAO)];
  assert.equal(utils.calcSalvaguarda(p, 'forca'), salvAntes + 3);
  assert.equal(utils.calcBonusPericia(p, 'Atletismo'), atlAntes + 3);
  assert.equal(p.atributos.forca, 15, 'o base não muda');
});

test('ataque com arma de Força usa a Força do Cinturão', async () => {
  const p = await guerreiro();
  p.inventario = [{ nome: 'Machado de Batalha', tipo: 'arma', equipado: true, quantidade: 1,
    dados: { nome: 'Machado de Batalha', categoria: 'Armas Marciais Corpo a Corpo', dano: '1d8 Cortante', propriedades: 'Versátil (1d10)' } }];
  sheetEstado.definirChar(p);
  const antes = inventario.renderSecaoInventario().match(/Atq \+(\d+)/)[1];
  p.inventario.push(structuredClone(CINTURAO));
  sheetEstado.definirChar(p);
  const depois = inventario.renderSecaoInventario().match(/Atq \+(\d+)/)[1];
  assert.equal(Number(depois), Number(antes) + 3);
});

test('carga usa a Força do Cinturão', async () => {
  const p = await guerreiro();
  p.inventario = [];
  sheetEstado.definirChar(p);
  const capAntes = inventario.getEstadoCarga().capacidade;
  p.inventario = [structuredClone(CINTURAO)];
  sheetEstado.definirChar(p);
  assert.ok(inventario.getEstadoCarga().capacidade > capAntes);
});

test('CD de magia de Mago usa a Inteligência da Tiara (19)', async () => {
  const p = await personagemMulticlasse([{ classe: 'Mago', nivel: 1 }]);
  p.atributos.inteligencia = 13; // mod +1
  const cdAntes = utils.calcCDMagia(p);
  p.inventario = [structuredClone(TIARA)];
  assert.equal(utils.calcCDMagia(p), cdAntes + 3); // mod +4
});

test('Cinturão não sintonizado: nada muda', async () => {
  const p = await guerreiro();
  const salv = utils.calcSalvaguarda(p, 'forca');
  p.inventario = [{ ...structuredClone(CINTURAO), sintonizado: false }];
  assert.equal(utils.calcSalvaguarda(p, 'forca'), salv);
});

test('personagem sem item: números iguais aos da fórmula antiga sobre o valor-base', async () => {
  const p = await guerreiro();
  p.inventario = [{ nome: 'Corda', tipo: 'equipamento', equipado: false, dados: {} }];
  // Valores esperados à mão: Guerreiro 1 com Força 15 e Destreza 15 (mod +2), bônus de proficiência +2,
  // proficiente em salvaguarda de Força e sem proficiência em Furtividade.
  assert.equal(utils.calcCA(p), 12, 'CA sem armadura = 10 + mod Des 2');
  assert.equal(utils.calcSalvaguarda(p, 'destreza'), 2, 'Guerreiro não é proficiente em Des: só o mod +2');
  assert.equal(utils.calcSalvaguarda(p, 'forca'), 4, 'proficiente em Força: mod +2 + proficiência +2');
  assert.equal(utils.calcBonusPericia(p, 'Furtividade'), 2, 'sem proficiência: só o mod de Des +2');
});

/** Renderiza a ficha completa num container falso e devolve o HTML gerado. */
function htmlDaFicha(p) {
  const docOriginal = globalThis.document;
  const el = { id: '', style: {}, innerHTML: '', textContent: '', dataset: {}, value: '', checked: false,
    addEventListener() {}, removeEventListener() {}, setAttribute() {}, removeAttribute() {}, closest: () => null,
    querySelector: () => null, querySelectorAll: () => [], classList: { add() {}, remove() {}, toggle() {}, contains: () => false } };
  globalThis.document = { getElementById: () => el, querySelector: () => null, querySelectorAll: () => [],
    createElement: () => el, body: el, addEventListener() {}, removeEventListener() {} };
  try {
    const container = { innerHTML: '', querySelectorAll: () => [], querySelector: () => null, addEventListener() {} };
    sheetEstado.definirChar(p);
    sheetEstado.definirContainer(container);
    sheetFicha.renderFichaCompleta();
    return container.innerHTML;
  } finally { globalThis.document = docOriginal; }
}

test('card de atributos: Cinturão ativo mostra Força 21 e a marca "base 15"; sem item não há marca', async () => {
  const p = await guerreiro();
  p.inventario = [];
  const sem = htmlDaFicha(p);
  assert.ok(!sem.includes('data-atributo-item'), 'sem item, nenhuma marca');
  p.inventario = [structuredClone(CINTURAO)];
  const com = htmlDaFicha(p);
  assert.match(com, /data-atributo-item="forca"[^>]*>base 15</);
  assert.match(com, /class="atributo-valor">21</);
  assert.ok(!com.includes('data-atributo-item="destreza"'));
  assert.equal(p.atributos.forca, 15);
});

test('ficha com PV corrompido e Amuleto ativo: após o recálculo, o bônus do item é reaplicado', async () => {
  const p = await personagemMulticlasse([{ classe: 'Guerreiro', nivel: 3 }]);
  p.atributos.constituicao = 14;
  p.inventario = [{ nome: 'Amuleto da Saúde', tipo: 'magico', equipado: true, sintonizado: true,
    dados: { requer_sintonizacao: true, efeitos: [{ alvo: 'atributo', atributo: 'constituicao', minimo: 19 }] } }];
  p.pv_max = 0;
  p.bonus_pv_itens_con_aplicado = 6; // marcador de antes da corrupção
  htmlDaFicha(p); // recalcula com o base e zera o marcador
  const base = p.pv_max;
  assert.equal(p.bonus_pv_itens_con_aplicado, 0);
  htmlDaFicha(p); // a sincronização reaplica o bônus
  assert.equal(p.pv_max, base + 2 * 3);
  assert.equal(p.bonus_pv_itens_con_aplicado, 6);
});

test('aumento de atributo na subida de nível soma no valor-base, não no do item', async () => {
  const p = await personagemMulticlasse([{ classe: 'Guerreiro', nivel: 3 }]);
  p.atributos.forca = 15;
  p.inventario = [structuredClone(CINTURAO)];
  // Guerreiro 3 -> 4 concede o Aumento no Valor de Atributo (levelup.subirDeNivel).
  const r = await levelup.subirDeNivel(p, {
    ignorar_xp: true, classe: 'Guerreiro',
    talento: 'Aumento no Valor de Atributo', aumentos_atributo: { forca: 1, destreza: 1 },
  });
  assert.equal(r.sucesso, true, JSON.stringify(r));
  assert.equal(p.atributos.forca, 16);
});
