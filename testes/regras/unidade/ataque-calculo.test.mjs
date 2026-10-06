// Caracterização do ataque/dano de arma no inventário (antes e depois da extração
// para sheet/ataque-calculo.js) e testes de atributo escolhido e dano versátil.
import test from 'node:test';
import assert from 'node:assert/strict';
import { lerClassesDados, modulosApp, personagemMulticlasse } from './harness.mjs';

const { sheetEstado, multiclasse } = await modulosApp();
const { sincronizarEspelhos } = multiclasse;
const inventario = await import('../../../site/js/sheet/inventario.js');

/** Armas de catálogo usadas nos testes (mesmos campos de dados/equipamento/armas.json). */
const ARMAS = {
  espada: { nome: 'Espada Longa', categoria: 'Armas Marciais Corpo a Corpo', dano: '1d8 Cortante', propriedades: 'Versátil (1d10)' },
  adaga: { nome: 'Adaga', categoria: 'Armas Simples Corpo a Corpo', dano: '1d4 Perfurante', propriedades: 'Acuidade, Arremesso (Alcance 6/18), Leve' },
  montante: { nome: 'Montante', categoria: 'Armas Marciais Corpo a Corpo', dano: '2d6 Cortante', propriedades: 'Duas Mãos, Pesada' },
  maca: { nome: 'Maça', categoria: 'Armas Simples Corpo a Corpo', dano: '1d6 Contundente', propriedades: '' },
  arco: { nome: 'Arco Curto', categoria: 'Armas Simples à Distância', dano: '1d6 Perfurante', propriedades: 'Duas Mãos, Munição (Alcance 24/96; Flecha)' },
};

/** Item de inventário de arma de catálogo, com campos extras de `dados` opcionais. */
function arma(chave, extraDados = {}, extraItem = {}) {
  const { nome, ...resto } = ARMAS[chave];
  return { id: `t-${chave}`, nome, tipo: 'arma', quantidade: 1, equipado: true, dados: { ...resto, ...extraDados }, ...extraItem };
}

/**
 * HTML do inventário de um Guerreiro nível 3 com os atributos dados, o inventário dado
 * e os passivos de talento dados (null = sem passivos).
 */
async function html(itens, { atributos = {}, passivos = null, classes = [{ classe: 'Guerreiro', nivel: 3 }], char: extra = {} } = {}) {
  // personagemMulticlasse só aceita as classes do catálogo básico; o Artífice entra por cima de um Guerreiro.
  const p = await personagemMulticlasse(classes.map((c) => (c.classe === 'Artífice' ? { ...c, classe: 'Guerreiro' } : c)));
  if (classes.some((c) => c.classe === 'Artífice')) {
    p.classes = classes.map((c, i) => ({ classe: c.classe, subclasse: c.subclasse || '', nivel: c.nivel, ordem: i }));
    sincronizarEspelhos(p);
  }
  p.atributos = { forca: 10, destreza: 10, constituicao: 10, inteligencia: 10, sabedoria: 10, carisma: 10, ...atributos };
  p.atributos_base = { ...p.atributos };
  p.inventario = itens;
  Object.assign(p, extra);
  sheetEstado.definirChar(p);
  sheetEstado.definirClassesData(new Map([['Bárbaro', lerClassesDados().get('Bárbaro')]]));
  sheetEstado.definirPassivosTalentos(passivos);
  return inventario.renderSecaoInventario();
}

/** Lê "Atq +N" e "Dano XdY+Z" da linha da arma no HTML do inventário. */
function ataqueDe(h, nome) {
  const ini = h.indexOf(`${nome} <span`);
  const fim = h.indexOf('inv-item-detalhe', ini);
  const linha = ini >= 0 ? h.slice(ini, fim) : '';
  return {
    atq: (linha.match(/Atq ([+\-−]\d+)/) || [])[1],
    dano: (linha.match(/Dano ([^<]+)</) || [])[1],
  };
}

test('FOR 16 prof 2: Espada Longa = Atq +5, Dano 1d8+3 Cortante (comportamento de hoje)', async () => {
  const h = await html([arma('espada')], { atributos: { forca: 16 } });
  assert.deepEqual(ataqueDe(h, 'Espada Longa'), { atq: '+5', dano: '1d8+3 Cortante' });
});

test('Acuidade usa o maior de FOR/DES: Adaga com DES 16 = Atq +5, Dano 1d4+3', async () => {
  const h = await html([arma('adaga')], { atributos: { forca: 10, destreza: 16 } });
  assert.deepEqual(ataqueDe(h, 'Adaga'), { atq: '+5', dano: '1d4+3 Perfurante' });
});

test('Arco Curto usa DES', async () => {
  const h = await html([arma('arco')], { atributos: { forca: 16, destreza: 14 } });
  assert.deepEqual(ataqueDe(h, 'Arco Curto'), { atq: '+4', dano: '1d6+2 Perfurante' });
});

test('Estilo Duelismo soma o bônus de uma mão; Duas Mãos não soma', async () => {
  const passivos = { bonusDanoUmaMao: 2 };
  const h = await html([arma('espada'), arma('montante')], { atributos: { forca: 16, destreza: 10 }, passivos });
  assert.equal(ataqueDe(h, 'Espada Longa').dano, '1d8+5 Cortante');
  assert.equal(ataqueDe(h, 'Montante').dano, '2d6+3 Cortante');
});

test('atributo escolhido: INT 18 em Espada Longa usa +4 no Atq e no Dano', async () => {
  const h = await html([arma('espada', { atributo: 'inteligencia' })], { atributos: { forca: 16, inteligencia: 18 } });
  assert.deepEqual(ataqueDe(h, 'Espada Longa'), { atq: '+6', dano: '1d8+4 Cortante' });
});

test('Ferreiro de Batalha 3+ com arma mágica: Int substitui For; atributo explícito não é sobreposto', async () => {
  const classes = [{ classe: 'Artífice', nivel: 3, subclasse: 'Ferreiro de Batalha' }];
  const atributos = { forca: 14, inteligencia: 18 };
  const magica = { magico_id: 'espada-teste' };
  const hPadrao = await html([arma('maca', magica)], { atributos, classes });
  assert.deepEqual(ataqueDe(hPadrao, 'Maça'), { atq: '+6', dano: '1d6+4 Contundente' }, 'sem escolha: usa Int (+4) + prof 2');
  const hExplicito = await html([arma('maca', { ...magica, atributo: 'forca' })], { atributos, classes });
  assert.deepEqual(ataqueDe(hExplicito, 'Maça'), { atq: '+4', dano: '1d6+2 Contundente' }, 'com atributo explícito: usa FOR (+2)');
});

test('versátil: empunhadura duas mãos usa 1d10; sem ela 1d8', async () => {
  const h = await html([arma('espada', { empunhadura: 'duas' })], { atributos: { forca: 16 } });
  assert.equal(ataqueDe(h, 'Espada Longa').dano, '1d10+3 Cortante');
  const h1 = await html([arma('espada')], { atributos: { forca: 16 } });
  assert.equal(ataqueDe(h1, 'Espada Longa').dano, '1d8+3 Cortante');
});

test('Duelismo (+2 uma mão) não soma em Espada Longa empunhada com duas mãos', async () => {
  const passivos = { bonusDanoUmaMao: 2 };
  const h = await html([arma('espada', { empunhadura: 'duas' })], { atributos: { forca: 16 }, passivos });
  assert.equal(ataqueDe(h, 'Espada Longa').dano, '1d10+3 Cortante');
});

test('Fúria ativa só soma com atributo FOR: arma com atributo DES não recebe o dano da Fúria', async () => {
  const classes = [{ classe: 'Bárbaro', nivel: 3 }];
  const extra = { recursos: { furia_ativa: true } };
  const h = await html([arma('espada'), arma('adaga', { atributo: 'destreza', nome: 'Adaga' })], { atributos: { forca: 16, destreza: 16 }, classes, char: extra });
  const danoFuria = ataqueDe(h, 'Espada Longa').dano;
  assert.equal(danoFuria, '1d8+5 Cortante', 'FOR 16 (+3) + Fúria nível 3 (+2)');
  assert.equal(ataqueDe(h, 'Adaga').dano, '1d4+3 Perfurante', 'DES explícito: sem Fúria');
});

test('Duelismo: empunhadura "duas" residual em arma não versátil não retira o bônus de uma mão', async () => {
  const passivos = { bonusDanoUmaMao: 2 };
  const h = await html([arma('maca', { empunhadura: 'duas' })], { atributos: { forca: 16 }, passivos });
  assert.equal(ataqueDe(h, 'Maça').dano, '1d6+5 Contundente');
});

test('rótulo "Padrão" do seletor de atributo reflete INT quando o Ferreiro de Batalha sobrepõe o padrão', async () => {
  const classes = [{ classe: 'Artífice', nivel: 3, subclasse: 'Ferreiro de Batalha' }];
  const atributos = { forca: 14, inteligencia: 18 };
  const magica = arma('maca', { magico_id: 'espada-teste' });
  await html([magica], { atributos, classes });
  assert.match(inventario.htmlDetalheItem(magica), /Padrão \(INT\)/);
  // Atributo escolhido não muda o rótulo do padrão; arma não mágica segue em FOR.
  const comum = arma('maca');
  await html([comum], { atributos, classes });
  assert.match(inventario.htmlDetalheItem(comum), /Padrão \(FOR\)/);
  // Int menor ou igual ao padrão: continua FOR.
  await html([magica], { atributos: { forca: 16, inteligencia: 10 }, classes });
  assert.match(inventario.htmlDetalheItem(magica), /Padrão \(FOR\)/);
});

test('selo do atributo na linha da arma: padrão, escolhido e Ferreiro de Batalha', async () => {
  const selo = (h, nome) => {
    const ini = h.indexOf(`${nome} <span`);
    const fim = h.indexOf('inv-item-detalhe', ini);
    return (h.slice(ini, fim).match(/data-selo-atributo="(\w+)"[^>]*>(\w+)</) || []).slice(1);
  };
  assert.deepEqual(selo(await html([arma('espada')]), 'Espada Longa'), ['forca', 'FOR']);
  assert.deepEqual(selo(await html([arma('arco')]), 'Arco Curto'), ['destreza', 'DES']);
  assert.deepEqual(selo(await html([arma('espada', { atributo: 'sabedoria' })]), 'Espada Longa'), ['sabedoria', 'SAB']);
  const classes = [{ classe: 'Artífice', nivel: 3, subclasse: 'Ferreiro de Batalha' }];
  const h = await html([arma('maca', { magico_id: 'espada-teste' })], { atributos: { forca: 14, inteligencia: 18 }, classes });
  assert.deepEqual(selo(h, 'Maça'), ['inteligencia', 'INT']);
});
