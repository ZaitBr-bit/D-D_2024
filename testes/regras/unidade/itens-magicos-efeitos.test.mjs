// ============================================================
// Efeitos mecânicos de itens (site/js/regras-itens-magicos.js): quais
// valem agora. Regra pura -- sem ficha, sem DOM.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../../../site/js/regras-itens-magicos.js';

const ANEL = { nome: 'Anel de Proteção', tipo: 'magico', equipado: true, sintonizado: true,
  dados: { requer_sintonizacao: true, efeitos: [{ alvo: 'ca', valor: 1 }, { alvo: 'salvaguarda', valor: 1 }] } };
const MANTO = { nome: 'Manto de Proteção', tipo: 'magico', equipado: true, sintonizado: true,
  dados: { requer_sintonizacao: true, efeitos: [{ alvo: 'ca', valor: 1 }, { alvo: 'salvaguarda', valor: 1 }] } };
const BRACADEIRAS = { nome: 'Braçadeiras de Defesa', tipo: 'magico', equipado: true, sintonizado: true,
  dados: { requer_sintonizacao: true, efeitos: [{ alvo: 'ca', valor: 2, condicao: 'sem_armadura_nem_escudo' }] } };
const COURO = { nome: 'Couro', tipo: 'armadura', equipado: true, dados: { ca: '11 + modificador de Des', categoria: 'Leve' } };
const ARMADURA_MAIS_1 = { nome: 'Couro +1', tipo: 'armadura', equipado: true,
  dados: { ca: '11 + modificador de Des', categoria: 'Leve', requer_sintonizacao: false, efeitos: [{ alvo: 'ca', valor: 1 }] } };
const ESCUDO = { nome: 'Escudo', tipo: 'armadura', equipado: true, dados: { ca: '+2', categoria: 'Escudo' } };
const CINTURAO = { nome: 'Cinturão de Força do Gigante (das colinas)', tipo: 'magico', equipado: true, sintonizado: true,
  dados: { requer_sintonizacao: true, efeitos: [{ alvo: 'atributo', atributo: 'forca', minimo: 21 }] } };

/** Personagem mínimo com o inventário dado. */
const p = (...inventario) => ({ inventario: structuredClone(inventario) });

test('item equipado e sintonizado: os efeitos valem', () => {
  assert.equal(R.somaEfeitos(p(ANEL), 'ca'), 1);
  assert.equal(R.somaEfeitos(p(ANEL), 'salvaguarda'), 1);
});

test('exige sintonização e não está sintonizado: nada vale', () => {
  assert.equal(R.somaEfeitos(p({ ...ANEL, sintonizado: false }), 'ca'), 0);
});

test('não equipado: nada vale', () => {
  assert.equal(R.somaEfeitos(p({ ...ANEL, equipado: false }), 'salvaguarda'), 0);
});

test('itens diferentes com o mesmo alvo somam (Anel + Manto)', () => {
  assert.equal(R.somaEfeitos(p(ANEL, MANTO), 'ca'), 2);
  assert.equal(R.somaEfeitos(p(ANEL, MANTO), 'salvaguarda'), 2);
});

test('Braçadeiras: valem sem armadura nem escudo', () => {
  assert.equal(R.somaEfeitos(p(BRACADEIRAS), 'ca'), 2);
});

test('Braçadeiras: não valem com armadura do catálogo, com escudo, nem com armadura mágica', () => {
  assert.equal(R.somaEfeitos(p(BRACADEIRAS, COURO), 'ca'), 0);
  assert.equal(R.somaEfeitos(p(BRACADEIRAS, ESCUDO), 'ca'), 0);
  assert.equal(R.somaEfeitos(p(BRACADEIRAS, ARMADURA_MAIS_1), 'ca'), 1, 'só o +1 da armadura mágica');
});

test('condição desconhecida nunca vale', () => {
  assert.equal(R.condicaoSatisfeita('sem_elmo', p()), false);
});

test('atributoMinimoPorItens: maior mínimo ativo, ou null', () => {
  assert.equal(R.atributoMinimoPorItens(p(CINTURAO), 'forca'), 21);
  assert.equal(R.atributoMinimoPorItens(p(CINTURAO), 'destreza'), null);
  assert.equal(R.atributoMinimoPorItens(p({ ...CINTURAO, sintonizado: false }), 'forca'), null);
});

test('atributoMinimoPorItens: efeito sem minimo inteiro é ignorado (sem NaN)', () => {
  const semMinimo = { ...CINTURAO, dados: { requer_sintonizacao: true, efeitos: [{ alvo: 'atributo', atributo: 'forca' }, { alvo: 'atributo', atributo: 'forca', minimo: 'x' }] } };
  assert.equal(R.atributoMinimoPorItens(p(semMinimo), 'forca'), null);
  assert.equal(R.atributoMinimoPorItens(p(semMinimo, CINTURAO), 'forca'), 21);
});

test('escudo reconhecido por tipo "escudo" com outro nome; sem_armadura e sem_escudo isolados', () => {
  const broquel = { nome: 'Broquel de Aço', tipo: 'escudo', equipado: true, dados: {} };
  assert.equal(R.equipamentoDeCA(p(broquel)).escudo?.nome, 'Broquel de Aço');
  assert.equal(R.equipamentoDeCA(p(broquel)).armadura, undefined);
  // sem_armadura: só a armadura importa
  assert.equal(R.condicaoSatisfeita('sem_armadura', p()), true);
  assert.equal(R.condicaoSatisfeita('sem_armadura', p(broquel)), true);
  assert.equal(R.condicaoSatisfeita('sem_armadura', p(COURO)), false);
  // sem_escudo: só o escudo importa
  assert.equal(R.condicaoSatisfeita('sem_escudo', p()), true);
  assert.equal(R.condicaoSatisfeita('sem_escudo', p(COURO)), true);
  assert.equal(R.condicaoSatisfeita('sem_escudo', p(broquel)), false);
  assert.equal(R.condicaoSatisfeita('sem_escudo', p(ESCUDO)), false);
});

test('efeitos de arma não entram nos efeitos do personagem', () => {
  const espada = { nome: 'Espada Longa +1', tipo: 'arma', equipado: true, dados: { efeitos: [{ alvo: 'ataque_arma', valor: 1 }, { alvo: 'dano_arma', valor: 1 }] } };
  assert.deepEqual(R.efeitosAtivos(p(espada)), []);
  assert.deepEqual(R.efeitosDaArma(espada), { ataque: 1, dano: 1 });
});

test('efeitosDaArma: vale sem estar equipada, mas exige sintonização quando o item pede', () => {
  const base = { nome: 'Espada Vorpal', tipo: 'arma', equipado: false, dados: { requer_sintonizacao: true, efeitos: [{ alvo: 'ataque_arma', valor: 3 }, { alvo: 'dano_arma', valor: 3 }] } };
  assert.deepEqual(R.efeitosDaArma({ ...base, sintonizado: true }), { ataque: 3, dano: 3 });
  assert.deepEqual(R.efeitosDaArma({ ...base, sintonizado: false }), { ataque: 0, dano: 0 });
});

test('adaptador do customizado: campos de bônus viram efeitos', () => {
  const custom = { nome: 'Cajado do Zait', tipo: 'customizado', equipado: true,
    dados: { bonus_ca: '2', ca_base: '15', bonus_ataque_magia: '1', bonus_cd_magia: '1', bonus_ataque: '1', categoria: 'Armas Simples Corpo a Corpo' } };
  assert.deepEqual(R.efeitosDeCustomizado(custom), [
    { alvo: 'ca', valor: 2 }, { alvo: 'ca_base', valor: 15 },
    { alvo: 'ataque_magia', valor: 1 }, { alvo: 'cd_magia', valor: 1 },
    { alvo: 'ataque_arma', valor: 1 },
  ]);
});

test('adaptador: bonus_ataque só vira ataque_arma em customizado com categoria de arma', () => {
  assert.deepEqual(R.efeitosDeCustomizado({ tipo: 'customizado', dados: { bonus_ataque: '2' } }), []);
});

test('customizado sem requer_sintonizacao continua valendo equipado (como antes)', () => {
  const custom = { nome: 'Amuleto', tipo: 'customizado', equipado: true, dados: { bonus_ca: '1' } };
  assert.equal(R.somaEfeitos(p(custom), 'ca'), 1);
});

test('maiorEfeito de ca_base: vale o maior; 0 sem efeito', () => {
  const a = { nome: 'A', tipo: 'customizado', equipado: true, dados: { ca_base: '14' } };
  const b = { nome: 'B', tipo: 'customizado', equipado: true, dados: { ca_base: '16' } };
  assert.equal(R.maiorEfeito(p(a, b), 'ca_base'), 16);
  assert.equal(R.maiorEfeito(p(), 'ca_base'), 0);
});

test('equipamentoDeCA: escudo pelo nome ou tipo, armadura é a que não é escudo', () => {
  const r = R.equipamentoDeCA(p(COURO, ESCUDO));
  assert.equal(r.armadura?.nome, 'Couro');
  assert.equal(r.escudo?.nome, 'Escudo');
});
