// Regras puras de ataque: atributo, dano versátil e mãos (spec 2026-10-06-ataques-maos-loja).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { modulosApp, RAIZ } from './harness.mjs';

const { regrasAtaque: r } = await modulosApp();
const armas = JSON.parse(readFileSync(`${RAIZ}/dados/equipamento/armas.json`, 'utf-8')).armas;

const char = (forca, destreza, extra = {}) => ({
  classe: 'Guerreiro', nivel: 3,
  atributos: { forca, destreza, constituicao: 10, inteligencia: 10, sabedoria: 10, carisma: 10 },
  inventario: [], ...extra,
});
const arma = (nome, extra = {}) => {
  const a = armas.find(x => x.nome === nome);
  return { nome, tipo: 'arma', quantidade: 1, equipado: true, dados: { ...a, ...extra } };
};
const escudo = () => ({ nome: 'Escudo', tipo: 'escudo', quantidade: 1, equipado: true, dados: { categoria: 'Escudo', ca: '+2' } });

test('atributo padrão: corpo a corpo = FOR; distância = DES; Acuidade = o maior', () => {
  assert.equal(r.atributoDaArma(char(16, 10), arma('Espada Longa')), 'forca');
  assert.equal(r.atributoDaArma(char(10, 16), arma('Arco Curto')), 'destreza');
  assert.equal(r.atributoDaArma(char(10, 16), arma('Adaga')), 'destreza');
  assert.equal(r.atributoDaArma(char(16, 10), arma('Adaga')), 'forca');
  assert.equal(r.atributoDaArma(char(14, 14), arma('Adaga')), 'forca');
});

test('atributo escolhido substitui o padrão; valor inválido cai no padrão', () => {
  assert.equal(r.atributoDaArma(char(16, 10), arma('Espada Longa', { atributo: 'inteligencia' })), 'inteligencia');
  assert.equal(r.atributoDaArma(char(16, 10), arma('Espada Longa', { atributo: 'xyz' })), 'forca');
  assert.equal(r.atributoExplicito(arma('Espada Longa', { atributo: 'xyz' })), null);
  assert.equal(r.atributoExplicito(arma('Espada Longa', { atributo: 'sabedoria' })), 'sabedoria');
});

test('dano versátil: as 8 armas versáteis do catálogo trazem o par de dados da propriedade', () => {
  const esperado = {
    'Cajado': ['1d6', '1d8'], 'Lança': ['1d6', '1d8'], 'Espada Longa': ['1d8', '1d10'],
    'Machado de Batalha': ['1d8', '1d10'], 'Martelo de Guerra': ['1d8', '1d10'],
    'Picareta de Guerra': ['1d8', '1d10'], 'Tridente': ['1d8', '1d10'],
  };
  const versateis = armas.filter(a => /versátil/i.test(a.propriedades));
  assert.equal(versateis.length, Object.keys(esperado).length);
  for (const a of versateis) {
    const [um, dois] = esperado[a.nome];
    assert.equal(a.dano.startsWith(um), true, `${a.nome}: dano base ${a.dano}`);
    assert.equal(r.danoVersatil(arma(a.nome)), dois, a.nome);
    assert.equal(r.danoBaseEmpunhado(arma(a.nome)).startsWith(um), true, `${a.nome} uma mão`);
    assert.equal(r.danoBaseEmpunhado(arma(a.nome, { empunhadura: 'duas' })).startsWith(dois), true, `${a.nome} duas mãos`);
  }
});

test('danoBaseEmpunhado mantém o tipo de dano e ignora arma não versátil', () => {
  assert.equal(r.danoBaseEmpunhado(arma('Espada Longa', { empunhadura: 'duas' })), '1d10 Cortante');
  assert.equal(r.danoBaseEmpunhado(arma('Adaga', { empunhadura: 'duas' })), '1d4 Perfurante');
  assert.equal(r.danoVersatil(arma('Adaga')), null);
});

test('mãos ocupadas: uma mão=1, duas mãos=2, versátil conforme empunhadura, escudo=1, resto=0', () => {
  assert.equal(r.maosOcupadas(arma('Espada Curta')), 1);
  assert.equal(r.maosOcupadas(arma('Espada Grande')), 2);
  assert.equal(r.maosOcupadas(arma('Espada Longa')), 1);
  assert.equal(r.maosOcupadas(arma('Espada Longa', { empunhadura: 'duas' })), 2);
  assert.equal(r.maosOcupadas(escudo()), 1);
  assert.equal(r.maosOcupadas({ nome: 'Flechas', tipo: 'equipamento', dados: {} }), 0);
  assert.equal(r.maosOcupadas({ nome: 'Cota', tipo: 'armadura', dados: { categoria: 'Pesada' } }), 0);
  assert.equal(r.maosOcupadas({ nome: 'Machado X', tipo: 'customizado', dados: { categoria: 'Armas Marciais Corpo a Corpo', propriedades: 'Duas Mãos' } }), 2);
  assert.equal(r.maosOcupadas({ nome: 'Escudo X', tipo: 'customizado', dados: { tipo_item: 'Armadura', tipo_armadura: 'Escudo' } }), 1);
});

test('limite de mãos: padrão 2; duas armas de uma mão; duas mãos recusa a segunda; escudo + duas mãos recusado', () => {
  const p = char(10, 10, { inventario: [arma('Espada Curta', { })] });
  p.inventario[0].equipado = true;
  const segunda = arma('Adaga'); segunda.equipado = false; p.inventario.push(segunda);
  assert.equal(r.maosTotais(p), 2);
  assert.deepEqual(r.verificarEquipar(p, segunda), { ok: true });

  const terceira = arma('Maça'); terceira.equipado = false;
  segunda.equipado = true; p.inventario.push(terceira);
  const v = r.verificarEquipar(p, terceira);
  assert.equal(v.ok, false);
  assert.deepEqual(v.bloqueadores.sort(), ['Adaga', 'Espada Curta']);

  const q = char(10, 10, { inventario: [escudo()] });
  const grande = arma('Espada Grande'); grande.equipado = false; q.inventario.push(grande);
  assert.equal(r.verificarEquipar(q, grande).ok, false);
});

test('mão cadastrada libera o equipar; item esgotado ou destruído não ocupa mão', () => {
  const a = arma('Espada Curta'); const b = arma('Adaga'); const c = arma('Maça'); c.equipado = false;
  const p = char(10, 10, { inventario: [a, b, c] });
  assert.equal(r.verificarEquipar(p, c).ok, false);
  p.maos = [{ id: 'm1', nome: 'Mão 1' }, { id: 'm2', nome: 'Mão 2' }, { id: 'm3', nome: 'Mão 3' }];
  assert.equal(r.verificarEquipar(p, c).ok, true);
  p.maos = undefined;
  b.quantidade = 0;
  assert.equal(r.verificarEquipar(p, c).ok, true);
  b.quantidade = 1; b.destruido = true;
  assert.equal(r.verificarEquipar(p, c).ok, true);
});

test('excedeMaos sinaliza save antigo com 3 armas, sem desequipar ninguém', () => {
  const p = char(10, 10, { inventario: [arma('Espada Curta'), arma('Adaga'), arma('Maça')] });
  assert.equal(r.excedeMaos(p), true);
  assert.equal(p.inventario.every(i => i.equipado), true);
});

test('equipar item que não ocupa mão nunca é recusado; munição não ocupa mão', () => {
  const p = char(10, 10, { inventario: [arma('Espada Curta'), arma('Adaga')] });
  const flechas = { nome: 'Flechas', tipo: 'equipamento', equipado: false, dados: {} };
  assert.equal(r.verificarEquipar(p, flechas).ok, true);
});

test('arma de arremesso guardada não ocupa mão; equipada ocupa 1', () => {
  const lanca = arma('Lança'); lanca.equipado = false;
  const p = char(10, 10, { inventario: [lanca] });
  assert.equal(r.maosEmUso(p), 0);
  lanca.equipado = true;
  assert.equal(r.maosEmUso(p), 1);
});

test('aviso de recarga: arma de uma mão com Munição e nenhuma mão livre', () => {
  const besta = arma('Besta de Mão');
  assert.match(besta.dados.propriedades, /Muni/);
  const p = char(10, 10, { inventario: [besta, escudo()] });
  assert.match(r.avisoRecarga(p), /Sem mão livre para recarregar/);
  p.inventario.pop();
  assert.equal(r.avisoRecarga(p), null);
  const pesada = arma('Besta Pesada');
  assert.equal(r.avisoRecarga(char(10, 10, { inventario: [pesada] })), null);
});

test('equipar escudo com versátil em duas mãos: a versátil volta para uma mão e o escudo cabe', () => {
  const longa = arma('Espada Longa', { empunhadura: 'duas' });
  const sh = escudo(); sh.equipado = false;
  const p = char(10, 10, { inventario: [longa, sh] });
  assert.equal(r.verificarEquipar(p, sh).ok, false);
  const v = r.equiparComAjusteDeMaos(p, sh);
  assert.deepEqual(v, { ok: true, ajustados: ['Espada Longa'] });
  assert.equal('empunhadura' in longa.dados, false);
  assert.equal(r.danoBaseEmpunhado(longa), '1d8 Cortante');
  sh.equipado = true;
  assert.equal(r.maosEmUso(p), 2);
});

test('ajuste de mãos: arma com Duas Mãos nunca é rebaixada e a recusa não altera nada', () => {
  const grande = arma('Espada Grande', { empunhadura: 'duas' });
  const sh = escudo(); sh.equipado = false;
  const p = char(10, 10, { inventario: [grande, sh] });
  const antes = JSON.stringify(p);
  const v = r.equiparComAjusteDeMaos(p, sh);
  assert.equal(v.ok, false);
  assert.match(v.motivo, /Sem mãos livres/);
  assert.deepEqual(v.ajustados, []);
  assert.equal(JSON.stringify(p), antes);
});

test('ajuste de mãos: se rebaixar não basta, recusa sem alterar a versátil', () => {
  const longa = arma('Espada Longa', { empunhadura: 'duas' });
  const adaga = arma('Adaga');
  const sh = escudo(); sh.equipado = false;
  const p = char(10, 10, { inventario: [longa, sh, adaga] });
  const antes = JSON.stringify(p);
  const v = r.equiparComAjusteDeMaos(p, sh);
  // Longa (2 -> 1) + Adaga (1) + escudo (1) = 3 de 2: rebaixar uma só não basta.
  assert.equal(v.ok, false);
  assert.equal(longa.dados.empunhadura, 'duas');
  assert.equal(JSON.stringify(p), antes);
});

test('ajuste de mãos: sem necessidade nada é alterado; com necessidade rebaixa só a versátil', () => {
  const longa = arma('Espada Longa', { empunhadura: 'duas' });
  const p = char(10, 10, { inventario: [longa] });
  const adaga = arma('Adaga'); adaga.equipado = false;
  assert.deepEqual(r.equiparComAjusteDeMaos(p, adaga), { ok: true, ajustados: ['Espada Longa'] });
  const q = char(10, 10, { inventario: [arma('Espada Longa', { empunhadura: 'duas' })] });
  const livre = { nome: 'Flechas', tipo: 'equipamento', equipado: false, dados: {} };
  assert.deepEqual(r.equiparComAjusteDeMaos(q, livre), { ok: true, ajustados: [] });
  assert.equal(q.inventario[0].dados.empunhadura, 'duas');
});

test('reequipar versátil com empunhadura residual "duas" com escudo equipado: equipa com uma mão', () => {
  const longa = arma('Espada Longa', { empunhadura: 'duas' }); longa.equipado = false;
  const p = char(10, 10, { inventario: [escudo(), longa] });
  const v = r.equiparComAjusteDeMaos(p, longa);
  assert.deepEqual(v, { ok: true, ajustados: ['Espada Longa'] });
  assert.equal('empunhadura' in longa.dados, false);
});

test('reequipar versátil com "duas" e mãos livres mantém a empunhadura', () => {
  const longa = arma('Espada Longa', { empunhadura: 'duas' }); longa.equipado = false;
  const p = char(10, 10, { inventario: [longa] });
  assert.deepEqual(r.equiparComAjusteDeMaos(p, longa), { ok: true, ajustados: [] });
  assert.equal(longa.dados.empunhadura, 'duas');
});

test('arma esgotada ou destruída custa 0 mãos ao equipar', () => {
  const p = char(10, 10, { inventario: [arma('Espada Curta'), arma('Adaga')] });
  const esgotada = arma('Maça', { }); esgotada.equipado = false; esgotada.quantidade = 0;
  p.inventario.push(esgotada);
  assert.equal(r.verificarEquipar(p, esgotada).ok, true);
  esgotada.quantidade = 1; esgotada.destruido = true;
  assert.equal(r.verificarEquipar(p, esgotada).ok, true);
  esgotada.destruido = false;
  assert.equal(r.verificarEquipar(p, esgotada).ok, false);
});

// Texto da CA da armadura acompanha o atributo escolhido.
test('textoCADaArmadura troca "modificador de Des" pelo atributo escolhido e mantém o resto', () => {
  const couro = (extra = {}) => ({ nome: 'Couro Batido', tipo: 'armadura', dados: { categoria: 'Leve', ca: '12 + modificador de Des', ...extra } });
  assert.equal(r.textoCADaArmadura(couro()), '12 + modificador de Des');
  assert.equal(r.textoCADaArmadura(couro({ atributo: 'inteligencia' })), '12 + modificador de Int');
  assert.equal(r.textoCADaArmadura(couro({ atributo: 'xyz' })), '12 + modificador de Des');
  const media = { nome: 'Peitoral', tipo: 'armadura', dados: { categoria: 'Média', ca: '14 + modificador de Des (máx. 2)', atributo: 'constituicao' } };
  assert.equal(r.textoCADaArmadura(media), '14 + modificador de Con (máx. 2)');
  const pesada = { nome: 'Cota', tipo: 'armadura', dados: { categoria: 'Pesada', ca: '16', atributo: 'carisma' } };
  assert.equal(r.textoCADaArmadura(pesada), '16');
});
