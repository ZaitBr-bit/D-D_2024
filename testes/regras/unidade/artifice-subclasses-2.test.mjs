// ============================================================
// Subclasses do Artífice (parte II): Alquimista, Armeiro e Cartógrafo.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { modulosApp, RAIZ } from './harness.mjs';

// Chaves reais de modulosApp() (harness.mjs). Uma única desestruturação para o arquivo todo: os testes das
// Tasks 2-4 são acrescentados aqui, e um segundo `const { ... } = await modulosApp()` seria SyntaxError.
const { db, levelup, sheetEstado, sheetCombate, regrasSubclasseEscolhas: escolhas } = await modulosApp();
const S = await import(pathToFileURL(resolve(RAIZ, 'site/js/regras-subclasses-artifice.js')).href);
const regrasArtifice = await import(pathToFileURL(resolve(RAIZ, 'site/js/regras-artifice.js')).href);

/** Artífice de nível n, subclasse e Int dadas. */
function artifice(n, subclasse = '', int = 16, extra = {}) {
  return { classes: [{ classe: 'Artífice', nivel: n, ordem: 0, subclasse }], classe: 'Artífice', subclasse, nivel: n,
    atributos: { inteligencia: int, destreza: 10 }, inventario: [], recursos: {}, resistencias: [], imunidades: [], imunidades_condicao: [], ...extra };
}

test('linhas automáticas das três subclasses', () => {
  const de = (s) => escolhas.ESCOLHAS_SUBCLASSE_APP.filter((l) => l.subclasse === s).map((l) => [l.nivel, l.automatica]);
  assert.ok(de('Alquimista').some(([n, a]) => n === 3 && a.ferramentas?.includes('Suprimentos de Alquimista') && a.ferramentas.includes('Kit de Herbalismo')));
  assert.ok(de('Alquimista').some(([n, a]) => n === 15 && a.resistencias?.includes('Ácido') && a.resistencias.includes('Venenoso') && a.imunidades_condicao?.includes('Envenenado')));
  assert.ok(de('Armeiro').some(([n, a]) => n === 3 && a.extras?.includes('Armadura Pesada') && a.ferramentas?.includes('Ferramentas de Ferreiro')));
  assert.ok(de('Cartógrafo').some(([n, a]) => n === 3 && a.ferramentas?.includes('Suprimentos de Calígrafo') && a.ferramentas.includes('Ferramentas de Cartógrafo')));
});

test('concessão automática grava resistências (dano) e imunidade a condição sem duplicar', () => {
  const p = artifice(15, 'Alquimista');
  const linha = escolhas.ESCOLHAS_SUBCLASSE_APP.find((l) => l.subclasse === 'Alquimista' && l.nivel === 15);
  escolhas.aplicarConcessaoAutomatica(p, linha);
  escolhas.aplicarConcessaoAutomatica(p, linha);
  assert.deepEqual(p.resistencias, ['Ácido', 'Venenoso']);
  assert.deepEqual(p.imunidades_condicao, ['Envenenado']);
  // 'Envenenado' é condição: não entra na lista de tipos de dano.
  assert.deepEqual(p.imunidades, []);
});

test('Alquimista de nível menor que 15 não ganha as defesas (a linha só roda no 15)', () => {
  const linhas = escolhas.linhasDaSubclasseNoNivel('Alquimista', 9);
  assert.ok(!linhas.some((l) => l.automatica?.resistencias));
});

test('usos grátis: por subclasse e nível; voltam no Descanso Longo', () => {
  assert.deepEqual(S.usosGratisArtifice(artifice(8, 'Alquimista'), 'restauracao_menor'), { max: 0, gastos: 0 });
  const a = artifice(9, 'Alquimista', 14);
  assert.equal(S.usosGratisArtifice(a, 'restauracao_menor').max, 2);
  assert.equal(S.gastarGratisArtifice(a, 'restauracao_menor'), true);
  assert.equal(S.gastarGratisArtifice(a, 'restauracao_menor'), true);
  assert.equal(S.gastarGratisArtifice(a, 'restauracao_menor'), false);
  regrasArtifice.descansoLongoArtifice(a);
  assert.equal(S.usosGratisArtifice(a, 'restauracao_menor').gastos, 0);
  assert.equal(S.usosGratisArtifice(artifice(3, 'Cartógrafo', 16), 'fogo_das_fadas').max, 3);
  assert.equal(S.usosGratisArtifice(artifice(3, 'Alquimista', 16), 'fogo_das_fadas').max, 0);
});

test('usos únicos (Maestria Química, Atlas Superior) ficam no booleano do motor; os múltiplos, no contador dedicado', async () => {
  const c = await db.getClasse('Artífice');
  const desc = (sub, nome) => c.subclasses.find((s) => s.nome === sub).caracteristicas.find((f) => f.nome === nome).descricao;
  // 1 uso: o motor concede o botão "Grátis" por gratis_usado; sem adaptador dedicado.
  assert.equal(levelup.featureConcedeUsoGratisSemEspaco(desc('Alquimista', 'Maestria Química'), 'Maestria Química'), true);
  assert.equal(levelup.featureConcedeUsoGratisSemEspaco(desc('Cartógrafo', 'Atlas Superior'), 'Atlas Superior'), true);
  // Vários usos (mod. Int): o motor não concede o booleano; o contador dedicado cobre.
  assert.equal(levelup.featureConcedeUsoGratisSemEspaco(desc('Alquimista', 'Reagentes Restauradores'), 'Reagentes Restauradores'), false);
  assert.equal(levelup.featureConcedeUsoGratisSemEspaco(desc('Cartógrafo', 'Magia de Mapeamento'), 'Magia de Mapeamento'), false);
  assert.throws(() => S.usosGratisArtifice(artifice(15, 'Alquimista'), 'caldeirao'));
});

test('magias sempre preparadas das três subclasses, por nível exato, batem com classe.json', async () => {
  // Oráculo sem código novo (mesmo critério do Plano 4): o mecanismo genérico já entrega as listas; nenhum passo
  // deste plano as implementa. Pré-verificado na revisão do plano contra o código: o retorno de cada nível traz só
  // as magias daquele nível. Restauração Menor (9) vem do texto de Reagentes Restauradores, não da tabela;
  // Caldeirão (15, Alquimista) e Encontrar o Caminho (15, Cartógrafo) vêm do texto e saem com gratisSemEspaco.
  const ESPERADO = {
    'Alquimista': { 3: ['Palavra Curativa', 'Raio Nauseante'], 5: ['Esfera Flamejante', 'Flecha Ácida de Melf'], 9: ['Forma Gasosa', 'Palavra Curativa em Massa', 'Restauração Menor'], 13: ['Proteção Contra a Morte', 'Esfera Vitriólica'], 15: ['Caldeirão Borbulhante de Tasha'], 17: ['Névoa Mortal', 'Reviver os Mortos'] },
    'Armeiro': { 3: ['Mísseis Mágicos', 'Onda Trovejante'], 5: ['Reflexos', 'Despedaçar'], 9: ['Padrão Hipnótico', 'Relâmpago'], 13: ['Escudo Ardente', 'Invisibilidade Maior'], 17: ['Criar Passagem', 'Muralha de Energia'] },
    'Cartógrafo': { 3: ['Fogo das Fadas', 'Raio Guia', 'Palavra Curativa'], 5: ['Localizar Objeto', 'Espinho Mental'], 9: ['Convocar Relâmpagos', 'Clarividência'], 13: ['Banimento', 'Localizar Criatura'], 15: ['Encontrar o Caminho'], 17: ['Vidência', 'Círculo de Teleporte'] },
  };
  for (const [sub, porNivel] of Object.entries(ESPERADO)) {
    for (const [nivel, nomes] of Object.entries(porNivel)) {
      const got = (await levelup.obterMagiasSemprePreparadasNivel('Artífice', sub, Number(nivel))).map((m) => m.nome);
      assert.deepEqual([...got].sort(), [...nomes].sort(), `${sub} ${nivel}`);
    }
  }
  // Só as duas de 1 uso saem com gratisSemEspaco.
  const q = (await levelup.obterMagiasSemprePreparadasNivel('Artífice', 'Alquimista', 15))[0];
  assert.equal(q.gratisSemEspaco, true);
  const r = (await levelup.obterMagiasSemprePreparadasNivel('Artífice', 'Alquimista', 9)).find((m) => m.nome === 'Restauração Menor');
  assert.equal(r.gratisSemEspaco, undefined);
});

test('elixires: quantidade 2/3/4/5 por nível; texto escala no 9 e no 15', () => {
  assert.equal(S.quantidadeElixires(artifice(3, 'Alquimista')), 2);
  assert.equal(S.quantidadeElixires(artifice(5, 'Alquimista')), 3);
  assert.equal(S.quantidadeElixires(artifice(9, 'Alquimista')), 4);
  assert.equal(S.quantidadeElixires(artifice(15, 'Alquimista')), 5);
  assert.equal(S.quantidadeElixires(artifice(15, 'Armeiro')), 0);
  assert.match(S.textoElixir('Cura', artifice(3, 'Alquimista', 16)), /2d8 \+ 3/);
  assert.match(S.textoElixir('Cura', artifice(9, 'Alquimista', 16)), /3d8 \+ 3/);
  assert.match(S.textoElixir('Cura', artifice(15, 'Alquimista', 16)), /4d8 \+ 3/);
  assert.match(S.textoElixir('Voo', artifice(15, 'Alquimista')), /9 metros/);
  // Cura é "2d8 mais o modificador de Inteligência", sem mínimo de +1 (Int 8 = -1).
  assert.match(S.textoElixir('Cura', artifice(3, 'Alquimista', 8)), /2d8 - 1/);
  assert.match(S.textoElixir('Escolha', artifice(3, 'Alquimista')), /outras linhas/);
});

test('elixires do Descanso Longo: rolagem d6; 6 vira elixir "Escolha"; itens com expiração', () => {
  const p = artifice(5, 'Alquimista');
  const rolagens = [1, 6, 3];
  const nomes = S.elixiresDoDescanso(p, () => rolagens.shift());
  assert.deepEqual(nomes, ['Elixir Experimental (Cura)', 'Elixir Experimental (Escolha)', 'Elixir Experimental (Resiliência)']);
  assert.ok(p.inventario.every((i) => i.origem?.expira === 'descanso_longo' && i.dados.tipo_item === 'Consumível'));
});

test('elixir "Escolha" vira um efeito nomeado; só ele aceita a troca', () => {
  const p = artifice(5, 'Alquimista');
  S.elixiresDoDescanso(p, (() => { const r = [6, 1]; return () => r.shift(); })());
  assert.equal(S.ehElixirEscolha(p.inventario[0]), true);
  assert.equal(S.ehElixirEscolha(p.inventario[1]), false);
  assert.equal(S.definirEfeitoElixir(p, 1, 'Voo'), false);
  assert.equal(S.definirEfeitoElixir(p, 0, 'Transformação'), false);
  assert.equal(S.definirEfeitoElixir(p, 0, 'Voo'), true);
  assert.equal(p.inventario[0].nome, 'Elixir Experimental (Voo)');
  assert.match(p.inventario[0].dados.descricao_magica, /Voo/);
});

test('a tabela de elixires do código bate com a descrição de classe.json', async () => {
  const c = await db.getClasse('Artífice');
  const feat = c.subclasses.find((s) => s.nome === 'Alquimista').caracteristicas.find((f) => f.nome === 'Elixir Experimental');
  assert.equal(S.EFEITOS_ELIXIR.length, 5);
  for (const efeito of S.EFEITOS_ELIXIR) assert.match(feat.descricao, new RegExp(efeito), `classe.json não cita "${efeito}"`);
  // A linha 6 do livro manda escolher uma das outras linhas; o código a representa por ELIXIR_ESCOLHA.
  assert.match(feat.descricao, /escolhendo uma das outras linhas/);
});

test('adaptadores de uso grátis do Artífice: aplicavel só para a subclasse e o nível certos', async () => {
  const { sheetEstado, regrasUsosGratisMagia: G } = await modulosApp();
  // magiaRecursoDedicadoGratisDisponivel devolve null quando aplicavel() é false (cai no gratis_usado de outra fonte).
  const consulta = (p, magia) => { sheetEstado.definirChar(p); return G.magiaRecursoDedicadoGratisDisponivel(magia); };
  // Não Artífice (ex.: personagem com Fogo das Fadas por outra fonte, como Drow).
  const mago = { classes: [{ classe: 'Mago', nivel: 9, ordem: 0, subclasse: '' }], classe: 'Mago', nivel: 9, atributos: { inteligencia: 16 }, inventario: [], recursos: {} };
  assert.equal(consulta(mago, 'Restauração Menor'), null);
  assert.equal(consulta(mago, 'Fogo das Fadas'), null);
  // Consultar o adaptador não grava o estado do Artífice em quem não é Artífice.
  assert.equal(mago.recursos.artifice, undefined);
  assert.deepEqual(S.usosGratisArtifice(mago, 'fogo_das_fadas'), { max: 0, gastos: 0 });
  assert.equal(mago.recursos.artifice, undefined);
  // Artífice de outra subclasse ou nível baixo demais.
  assert.equal(consulta(artifice(9, 'Armeiro'), 'Restauração Menor'), null);
  assert.equal(consulta(artifice(9, 'Armeiro'), 'Fogo das Fadas'), null);
  assert.equal(consulta(artifice(9, 'Alquimista'), 'Fogo das Fadas'), null);
  assert.equal(consulta(artifice(3, 'Cartógrafo'), 'Restauração Menor'), null);
  assert.equal(consulta(artifice(8, 'Alquimista'), 'Restauração Menor'), null);
  assert.equal(consulta(artifice(2, 'Cartógrafo'), 'Fogo das Fadas'), null);
  // Subclasse e nível certos: aplica (true = há uso disponível).
  assert.equal(consulta(artifice(9, 'Alquimista'), 'Restauração Menor'), true);
  assert.equal(consulta(artifice(3, 'Cartógrafo'), 'Fogo das Fadas'), true);
});

test('Armadura Arcana: modelo só vale com a armadura ativa e equipada; trocar de armadura a desfaz', () => {
  const p = artifice(3, 'Armeiro', 16, { inventario: [{ tipo: 'armadura', nome: 'Cota de Malha', equipado: true, dados: {} }] });
  regrasArtifice.estadoArtifice(p).modelo = 'Infiltrador';
  assert.equal(S.armaduraArcanaAtiva(p), false);
  assert.equal(S.modeloAtivo(p), '');
  regrasArtifice.estadoArtifice(p).armadura_arcana = 'Cota de Malha';
  assert.equal(S.armaduraArcanaAtiva(p), true);
  assert.equal(S.modeloAtivo(p), 'Infiltrador');
  // Vestir outra armadura (a Cota de Malha sai): a Armadura Arcana não passa para a nova.
  p.inventario[0].equipado = false;
  p.inventario.push({ tipo: 'armadura', nome: 'Couro', equipado: true, dados: {} });
  assert.equal(S.armaduraArcanaAtiva(p), false);
  assert.equal(S.modeloAtivo(p), '');
});

test('arma especial: ataque = PB + Int (+1 no 9); dado maior no 15', () => {
  const p = artifice(3, 'Armeiro', 16, { inventario: [{ tipo: 'armadura', nome: 'Couro', equipado: true, dados: {} }] });
  Object.assign(regrasArtifice.estadoArtifice(p), { armadura_arcana: 'Couro', modelo: 'Guardião' });
  assert.deepEqual([S.armaEspecialArmeiro(p).ataque, S.armaEspecialArmeiro(p).dano], [5, '1d8 + 3 Trovejante']);
  const q = artifice(9, 'Armeiro', 16, { inventario: p.inventario });
  Object.assign(regrasArtifice.estadoArtifice(q), { armadura_arcana: 'Couro', modelo: 'Couraçado' });
  assert.deepEqual([S.armaEspecialArmeiro(q).ataque, S.armaEspecialArmeiro(q).dano], [8, '1d10 + 4 Energético']);
  const r = artifice(15, 'Armeiro', 16, { inventario: p.inventario });
  Object.assign(regrasArtifice.estadoArtifice(r), { armadura_arcana: 'Couro', modelo: 'Infiltrador' });
  assert.equal(S.armaEspecialArmeiro(r).dano, '2d6 + 4 Elétrico');
  const s = artifice(15, 'Armeiro', 16, { inventario: p.inventario });
  Object.assign(regrasArtifice.estadoArtifice(s), { armadura_arcana: 'Couro', modelo: 'Couraçado' });
  assert.equal(S.armaEspecialArmeiro(s).dano, '2d6 + 4 Energético');
});

test('contadores do Armeiro por modelo e nível; voltam no Descanso Longo', () => {
  const p = artifice(15, 'Armeiro', 14, { inventario: [{ tipo: 'armadura', nome: 'Couro', equipado: true, dados: {} }] });
  Object.assign(regrasArtifice.estadoArtifice(p), { armadura_arcana: 'Couro', modelo: 'Couraçado' });
  assert.deepEqual(S.contadoresArmeiro(p).map((c) => [c.chave, c.max]), [['estatura', 2]]);
  regrasArtifice.estadoArtifice(p).modelo = 'Infiltrador';
  assert.deepEqual(S.contadoresArmeiro(p).map((c) => [c.chave, c.max]), [['voo', 2]]);
  assert.equal(S.gastarArmeiro(p, 'voo'), true);
  // Esgotado o contador (máximo 2), novas tentativas falham e o gasto permanece no máximo.
  assert.equal(S.gastarArmeiro(p, 'voo'), true);
  for (let i = 0; i < 3; i++) assert.equal(S.gastarArmeiro(p, 'voo'), false);
  assert.equal(regrasArtifice.estadoArtifice(p).armeiro_gastos.voo, 2);
  regrasArtifice.descansoLongoArtifice(p);
  assert.equal(S.contadoresArmeiro(p)[0].gastos, 0);
  // Guardião só ganha o contador (puxão) no 15.
  regrasArtifice.estadoArtifice(p).modelo = 'Guardião';
  assert.deepEqual(S.contadoresArmeiro(p).map((c) => c.chave), ['puxao']);
  const q = artifice(5, 'Armeiro', 14, { inventario: p.inventario });
  Object.assign(regrasArtifice.estadoArtifice(q), { armadura_arcana: 'Couro', modelo: 'Guardião' });
  assert.deepEqual(S.contadoresArmeiro(q), []);
});

test('Armadura Arcana: armadura_arcana gravada sem armadura equipada não a ativa', () => {
  const p = artifice(2, 'Armeiro', 16, { inventario: [{ tipo: 'armadura', nome: 'Cota de Malha', equipado: true, dados: {} }] });
  regrasArtifice.estadoArtifice(p).armadura_arcana = 'Cota de Malha';
  assert.equal(S.armaduraArcanaAtiva(p), false);
});

test('Atlas: portadores 1 + Int (mín. 2); +1d4 de Iniciativa só com o atlas criado e o Cartógrafo portador', () => {
  const p = artifice(3, 'Cartógrafo', 10);
  assert.equal(S.atlasMaxPortadores(p), 2);
  assert.equal(S.atlasMaxPortadores(artifice(3, 'Cartógrafo', 16)), 4);
  assert.equal(S.bonusIniciativaAtlas(p), '');
  regrasArtifice.estadoArtifice(p).atlas = { ativo: true, portadores: 2, voce: true };
  assert.equal(S.bonusIniciativaAtlas(p), '1d4');
  // O Cartógrafo criou o atlas mas não carrega um mapa: sem o dado.
  regrasArtifice.estadoArtifice(p).atlas = { ativo: true, portadores: 2, voce: false };
  assert.equal(S.bonusIniciativaAtlas(p), '');
  assert.equal(S.bonusIniciativaAtlas(artifice(3, 'Armeiro')), '');
  // Cartógrafo de nível 2 (sem a subclasse ainda) com atlas gravado: sem o dado.
  const n2 = artifice(2, 'Cartógrafo', 16);
  regrasArtifice.estadoArtifice(n2).atlas = { ativo: true, portadores: 2, voce: true };
  assert.equal(S.bonusIniciativaAtlas(n2), '');
});

test('getModIniciativa devolve o dado extra do Atlas só com o atlas criado', () => {
  const sem = artifice(3, 'Cartógrafo', 16);
  sheetEstado.definirChar(sem);
  assert.deepEqual(sheetCombate.getModIniciativa().dadosExtras, []);
  const com = artifice(3, 'Cartógrafo', 16);
  regrasArtifice.estadoArtifice(com).atlas = { ativo: true, portadores: 3, voce: true };
  sheetEstado.definirChar(com);
  assert.deepEqual(sheetCombate.getModIniciativa().dadosExtras, ['1d4 (Atlas do Aventureiro)']);
  // Não Cartógrafo com o estado gravado: Iniciativa inalterada, sem dado extra.
  const outro = artifice(3, 'Armeiro', 16);
  regrasArtifice.estadoArtifice(outro).atlas = { ativo: true, portadores: 3, voce: true };
  sheetEstado.definirChar(outro);
  const ini = sheetCombate.getModIniciativa();
  assert.deepEqual(ini.dadosExtras, []);
  assert.equal(ini.valor, 0);
  const g = { classes: [{ classe: 'Guerreiro', nivel: 3, ordem: 0, subclasse: '' }], classe: 'Guerreiro', nivel: 3,
    atributos: { forca: 16, destreza: 14 }, inventario: [], recursos: { artifice: { atlas: { ativo: true, portadores: 3, voce: true } } } };
  sheetEstado.definirChar(g);
  const ig = sheetCombate.getModIniciativa();
  assert.deepEqual(ig.dadosExtras, []);
  assert.equal(ig.valor, 2);
});

test('textoDadosExtrasIniciativa: " +1d4" com o Atlas; vazio sem dado extra (impressão e PDF)', () => {
  const com = artifice(3, 'Cartógrafo', 16);
  regrasArtifice.estadoArtifice(com).atlas = { ativo: true, portadores: 3, voce: true };
  sheetEstado.definirChar(com);
  assert.equal(sheetCombate.textoDadosExtrasIniciativa(sheetCombate.getModIniciativa()), ' +1d4');
  sheetEstado.definirChar(artifice(3, 'Cartógrafo', 16));
  assert.equal(sheetCombate.textoDadosExtrasIniciativa(sheetCombate.getModIniciativa()), '');
  assert.equal(sheetCombate.textoDadosExtrasIniciativa(undefined), '');
});

/** Deslocamento final em metros (getDeslocamentoFinal devolve texto, ex.: "10,5 metros"). */
function metros() {
  return sheetCombate.parseMetros(sheetCombate.getDeslocamentoFinal('9 metros'), 9);
}

test('Infiltrador: +1,5 m de deslocamento e Vantagem em Furtividade só com a Armadura Arcana ativa', () => {
  const inv = [{ tipo: 'armadura', nome: 'Cota de Malha', equipado: true, dados: { furtividade: 'Desvantagem' } }];
  const base = artifice(3, 'Armeiro', 16, { inventario: inv });
  sheetEstado.definirChar(base);
  const semAtiva = metros();
  assert.deepEqual(sheetCombate.calcVantagemDesvantagemPericia('Furtividade').vantagens, []);
  // Modelo escolhido, mas Armadura Arcana desfeita: nada muda.
  Object.assign(regrasArtifice.estadoArtifice(base), { armadura_arcana: null, modelo: 'Infiltrador' });
  assert.equal(metros(), semAtiva);
  assert.deepEqual(sheetCombate.calcVantagemDesvantagemPericia('Furtividade').vantagens, []);
  // Ativa: +1,5 m e Vantagem (que anula a Desvantagem da armadura na ficha).
  regrasArtifice.estadoArtifice(base).armadura_arcana = 'Cota de Malha';
  assert.equal(metros(), semAtiva + 1.5);
  assert.deepEqual(sheetCombate.calcVantagemDesvantagemPericia('Furtividade').vantagens, ['Campo Silenciador']);
  assert.deepEqual(sheetCombate.calcVantagemDesvantagemPericia('Atletismo').vantagens, []);
  // Outro modelo: nada.
  regrasArtifice.estadoArtifice(base).modelo = 'Guardião';
  assert.equal(metros(), semAtiva);
  // Trocar de armadura (a Cota de Malha sai) desfaz o efeito mesmo com o modelo Infiltrador gravado.
  regrasArtifice.estadoArtifice(base).modelo = 'Infiltrador';
  base.inventario[0].equipado = false;
  base.inventario.push({ tipo: 'armadura', nome: 'Couro', equipado: true, dados: {} });
  assert.equal(metros(), semAtiva);
  assert.deepEqual(sheetCombate.calcVantagemDesvantagemPericia('Furtividade').vantagens, []);
});

test('fora do Armeiro o estado do Infiltrador não altera deslocamento nem Furtividade', () => {
  const inv = [{ tipo: 'armadura', nome: 'Cota de Malha', equipado: true, dados: {} }];
  const sem = artifice(3, 'Alquimista', 16, { inventario: inv });
  sheetEstado.definirChar(sem);
  const desl = metros();
  // Artífice de outra subclasse com o estado gravado: ignorado.
  Object.assign(regrasArtifice.estadoArtifice(sem), { armadura_arcana: 'Cota de Malha', modelo: 'Infiltrador' });
  assert.equal(metros(), desl);
  assert.deepEqual(sheetCombate.calcVantagemDesvantagemPericia('Furtividade').vantagens, []);
  // Outra classe (Guerreiro) com o mesmo estado: ignorado.
  const g = { classes: [{ classe: 'Guerreiro', nivel: 3, ordem: 0, subclasse: '' }], classe: 'Guerreiro', nivel: 3,
    atributos: { forca: 16, destreza: 10 }, inventario: inv, recursos: { artifice: { armadura_arcana: 'Cota de Malha', modelo: 'Infiltrador' } } };
  sheetEstado.definirChar(g);
  assert.equal(metros(), 9);
  assert.deepEqual(sheetCombate.calcVantagemDesvantagemPericia('Furtividade').vantagens, []);
});
