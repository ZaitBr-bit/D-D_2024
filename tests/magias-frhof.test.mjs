import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const arquivo = new URL('../dados/magias/magias_frhof.json', import.meta.url);

async function carregar() {
  return JSON.parse(await readFile(arquivo, 'utf8'));
}

let importacaoDb = 0;
async function importarDbNovo() {
  importacaoDb += 1;
  return import(`../site/js/db.js?magias-frhof=${importacaoDb}`);
}

function respostaJSON(dados, ok = true, status = 200) {
  return {
    ok,
    status,
    async json() {
      return dados;
    }
  };
}

const nomesCanonicos = [
  'Labareda de Spellfire',
  'Repelir Aproximação',
  'Armadura da Morte',
  'Homúnculos Prestativos de Deryan',
  'Elusão de Elminster',
  'Escudo Cacofônico',
  'Conjurar Constructos',
  'Lança Prateada de Laeral',
  'Víbora de Syluné',
  'Retaliação Mágica',
  'Maré da Perdição',
  'Tempestade de Spellfire',
  'Manto de Lua de Alustriel',
  'Sufusão Elemental de Songol',
  'Lamento Fúnebre',
  'Esferas Resplandecentes de Elminster',
  'Synostodweomer da Simbul',
  'Estrela Sagrada de Mystra',
  'Lâmina do Desastre'
];

const classesEsperadas = {
  'Labareda de Spellfire': ['Feiticeiro', 'Mago'],
  'Repelir Aproximação': ['Bardo', 'Clérigo', 'Paladino', 'Mago'],
  'Armadura da Morte': ['Feiticeiro', 'Mago'],
  'Homúnculos Prestativos de Deryan': ['Clérigo', 'Mago'],
  'Elusão de Elminster': ['Mago'],
  'Escudo Cacofônico': ['Bardo', 'Feiticeiro', 'Mago'],
  'Conjurar Constructos': ['Mago'],
  'Lança Prateada de Laeral': ['Clérigo', 'Feiticeiro', 'Mago'],
  'Víbora de Syluné': ['Druida', 'Mago'],
  'Retaliação Mágica': ['Bardo', 'Feiticeiro', 'Bruxo', 'Mago'],
  'Maré da Perdição': ['Bardo', 'Clérigo', 'Bruxo'],
  'Tempestade de Spellfire': ['Feiticeiro', 'Mago'],
  'Manto de Lua de Alustriel': ['Bardo', 'Druida', 'Guardião', 'Mago'],
  'Sufusão Elemental de Songol': ['Druida', 'Feiticeiro', 'Mago'],
  'Lamento Fúnebre': ['Bardo', 'Clérigo'],
  'Esferas Resplandecentes de Elminster': ['Druida', 'Feiticeiro', 'Mago'],
  'Synostodweomer da Simbul': ['Feiticeiro', 'Mago'],
  'Estrela Sagrada de Mystra': ['Clérigo', 'Mago'],
  'Lâmina do Desastre': ['Feiticeiro', 'Bruxo', 'Mago']
};

test('catálogo contém exatamente as 19 magias FRHOF em ordem canônica', async () => {
  const catalogo = await carregar();
  assert.equal(catalogo.total_magias, 19);
  assert.ok(Array.isArray(catalogo.magias));
  assert.equal(catalogo.magias.length, 19);
  assert.deepEqual(catalogo.magias.map(magia => magia.nome), nomesCanonicos);
  assert.equal(new Set(catalogo.magias.map(magia => magia.nome)).size, 19);
});

test('todas as magias registram fonte, campos obrigatórios e Circle Magic inativo', async () => {
  const catalogo = await carregar();
  for (const magia of catalogo.magias) {
    for (const campo of [
      'nome', 'nome_original', 'circulo', 'escola', 'classes', 'tempo_conjuracao',
      'alcance', 'componentes', 'duracao', 'concentracao', 'descricao',
      'circulo_superior', 'efeitos_ficha', 'recursos_temporarios', 'dano',
      'pre_requisitos', 'circulo_magico',
      'fonte'
    ]) {
      assert.notEqual(magia[campo], undefined, `${magia.nome}: campo ${campo}`);
    }
    assert.deepEqual(magia.fonte, {
      id: 'frhof-2025',
      nome: 'Forgotten Realms: Heroes of Faerûn',
      rotulo: 'Heróis de Faerûn',
      tipo: 'expansao',
      ano: 2025
    });
    assert.equal(typeof magia.circulo_magico.implementado, 'boolean');
    assert.equal(magia.circulo_magico.implementado, false);
    assert.equal(magia.circulo_magico.motivo, 'Escopo 9 - Magia de Círculo');
    assert.ok(Array.isArray(magia.dano), `${magia.nome}: dano deve ser lista`);
    assert.deepEqual(magia.pre_requisitos.classes, magia.classes, `${magia.nome}: pré-requisito classes`);
    assert.equal(magia.pre_requisitos.circulo_minimo, magia.circulo, `${magia.nome}: pré-requisito círculo`);
    assert.equal(magia.pre_requisitos.componentes, magia.componentes, `${magia.nome}: pré-requisito componentes`);
    assert.equal(magia.pre_requisitos.nivel_minimo_personagem, null, `${magia.nome}: sem nível mínimo extra`);
  }
});

test('metadados de dano e pré-requisitos ficam explícitos no catálogo FRHOF', async () => {
  const porNome = Object.fromEntries((await carregar()).magias.map(magia => [magia.nome, magia]));
  const formulasEsperadas = {
    'Labareda de Spellfire': ['2d10'],
    'Repelir Aproximação': ['2d4'],
    'Armadura da Morte': ['2d4'],
    'Escudo Cacofônico': ['3d6'],
    'Conjurar Constructos': ['3d6'],
    'Lança Prateada de Laeral': ['3d10'],
    'Víbora de Syluné': ['1d6'],
    'Retaliação Mágica': ['4d6'],
    'Maré da Perdição': ['5d6'],
    'Tempestade de Spellfire': ['4d10'],
    'Sufusão Elemental de Songol': ['2d6'],
    'Lamento Fúnebre': ['3d10'],
    'Esferas Resplandecentes de Elminster': ['3d6'],
    'Estrela Sagrada de Mystra': ['4d10 + modificador de conjuração'],
    'Lâmina do Desastre': ['10d6']
  };

  for (const [nome, formulas] of Object.entries(formulasEsperadas)) {
    assert.deepEqual(porNome[nome].dano.map(item => item.formula), formulas, nome);
  }

  assert.deepEqual(porNome['Labareda de Spellfire'].dano, [{
    tipo: 'Radiante',
    formula: '2d10',
    observacao: 'ataque mágico à distância'
  }]);
  assert.match(porNome['Labareda de Spellfire'].circulo_superior, /disparo adicional/);
  assert.match(porNome['Labareda de Spellfire'].circulo_superior, /espaço de magia acima do 1º/);
  assert.doesNotMatch(porNome['Labareda de Spellfire'].circulo_superior, /dano aumenta/);

  for (const nome of [
    'Homúnculos Prestativos de Deryan',
    'Elusão de Elminster',
    'Manto de Lua de Alustriel',
    'Synostodweomer da Simbul'
  ]) {
    assert.deepEqual(porNome[nome].dano, [], `${nome}: sem dano direto`);
  }

  assert.equal(porNome['Homúnculos Prestativos de Deryan'].pre_requisitos.ritual, true);
  assert.equal(porNome['Homúnculos Prestativos de Deryan'].pre_requisitos.material_consumido, true);
  assert.equal(porNome['Homúnculos Prestativos de Deryan'].pre_requisitos.custo_material, '100+ PO');
  assert.match(porNome['Homúnculos Prestativos de Deryan'].pre_requisitos.ferramenta_exigida, /ferramentas de artesão/);
  assert.equal(porNome['Manto de Lua de Alustriel'].pre_requisitos.custo_material, '50+ PO');
});

test('alcance, componentes, duração e círculos superiores seguem dados auditados', async () => {
  const porNome = Object.fromEntries((await carregar()).magias.map(magia => [magia.nome, magia]));
  const esperado = {
    'Labareda de Spellfire': ['18 metros', 'V, S', 'Instantânea', /disparo adicional/],
    'Repelir Aproximação': ['18 metros', 'V, S, M (uma pequena mão de argila)', 'Instantânea', /2d4/],
    'Armadura da Morte': ['Toque', 'V, S, M (uma ônix de 50+ PO, consumida pela magia)', '1 hora', /1d4/],
    'Elusão de Elminster': ['Pessoal', 'V, S', 'Concentração, até 10 minutos', null],
    'Escudo Cacofônico': ['Pessoal', 'V, S', 'Concentração, até 10 minutos', /1d6/],
    'Conjurar Constructos': ['18 metros', 'V, S, M (uma engrenagem de latão)', 'Concentração, até 10 minutos', /pontos de vida temporários aumentam em 1d6/],
    'Lança Prateada de Laeral': ['Pessoal', 'V, S, M (um alfinete de prata de 250+ PO)', 'Instantânea', /1d10/],
    'Víbora de Syluné': ['Pessoal', 'V, S, M (uma presa de serpente)', '1 hora', /pontos de vida temporários aumentam em 5/],
    'Retaliação Mágica': ['18 metros', 'V', 'Instantânea', /redução de dano e o dano de Força aumentam em 1d6/],
    'Maré da Perdição': ['36 metros', 'V, S, M (fuligem e uma enguia seca)', 'Concentração, até 1 minuto', null],
    'Tempestade de Spellfire': ['18 metros', 'V, S', 'Concentração, até 1 minuto', /1d10/],
    'Sufusão Elemental de Songol': ['Pessoal', 'V, S, M (uma pérola de 100+ PO)', 'Concentração, até 1 minuto', null],
    'Lamento Fúnebre': ['Pessoal', 'V', 'Concentração, até 1 minuto', null],
    'Esferas Resplandecentes de Elminster': ['Pessoal', 'V, S, M (uma opala de 1.000+ PO)', '1 hora', /número de esferas aumenta em 1/],
    'Synostodweomer da Simbul': ['Toque', 'V, S', '1 hora', null],
    'Estrela Sagrada de Mystra': ['Pessoal', 'V, S', 'Concentração, até 1 minuto', null]
  };

  for (const [nome, [alcance, componentes, duracao, circuloSuperior]] of Object.entries(esperado)) {
    assert.equal(porNome[nome].alcance, alcance, `${nome}: alcance`);
    assert.equal(porNome[nome].componentes, componentes, `${nome}: componentes`);
    assert.equal(porNome[nome].duracao, duracao, `${nome}: duração`);
    if (circuloSuperior) {
      assert.match(porNome[nome].circulo_superior, circuloSuperior, `${nome}: círculo superior`);
    } else {
      assert.equal(porNome[nome].circulo_superior, null, `${nome}: sem círculo superior padrão`);
    }
  }
});

test('círculos, classes e concentração seguem o catálogo auditado', async () => {
  const magias = (await carregar()).magias;
  assert.deepEqual([...new Set(magias.map(magia => magia.circulo))].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  for (const magia of magias) {
    assert.deepEqual(magia.classes, classesEsperadas[magia.nome], `${magia.nome}: classes`);
    assert.equal(magia.concentracao, magia.duracao.startsWith('Concentração'), `${magia.nome}: concentração`);
  }
});

test('propriedades de ficha cobrem CA, deslocamento, PV temporários, resistências, salvamentos, ações e Dados de Vida', async () => {
  const porNome = Object.fromEntries((await carregar()).magias.map(magia => [magia.nome, magia]));

  assert.deepEqual(porNome['Manto de Lua de Alustriel'].efeitos_ficha.propriedades, ['ca', 'salvaguardas_destreza', 'resistencias', 'condicoes', 'cura_pv']);
  assert.ok(porNome['Estrela Sagrada de Mystra'].efeitos_ficha.propriedades.includes('ca'));
  assert.ok(porNome['Víbora de Syluné'].efeitos_ficha.propriedades.includes('deslocamento'));
  assert.ok(porNome['Víbora de Syluné'].efeitos_ficha.propriedades.includes('pv_temporarios'));
  assert.ok(porNome['Escudo Cacofônico'].efeitos_ficha.propriedades.includes('resistencias'));
  assert.ok(porNome['Elusão de Elminster'].efeitos_ficha.propriedades.includes('salvaguardas'));
  assert.ok(porNome['Retaliação Mágica'].efeitos_ficha.propriedades.includes('acoes'));
  assert.ok(porNome['Synostodweomer da Simbul'].efeitos_ficha.propriedades.includes('dados_de_vida'));
});

test('recursos temporários de conjuração não são tratados como recarga de descanso longo', async () => {
  const porNome = Object.fromEntries((await carregar()).magias.map(magia => [magia.nome, magia]));
  assert.deepEqual(porNome['Esferas Resplandecentes de Elminster'].recursos_temporarios, [{
    id: 'esferas',
    quantidade: 6,
    recuperacao: 'termina_com_a_magia'
  }]);
  for (const magia of Object.values(porNome)) {
    assert.equal(magia.recarga_descanso_longo, undefined, `${magia.nome}: não deve ter recarga de descanso longo`);
  }
});

test('Circle Magic fica documentado somente para magias que possuem essa extensão', async () => {
  const porNome = Object.fromEntries((await carregar()).magias.map(magia => [magia.nome, magia]));
  const comCircleMagic = ['Tempestade de Spellfire', 'Maré da Perdição', 'Manto de Lua de Alustriel', 'Sufusão Elemental de Songol', 'Lamento Fúnebre'];
  for (const nome of comCircleMagic) {
    assert.equal(porNome[nome].circulo_magico.disponivel_na_fonte, true, nome);
    assert.equal(porNome[nome].circulo_magico.implementado, false, nome);
  }
  for (const nome of nomesCanonicos.filter(nome => !comCircleMagic.includes(nome))) {
    assert.equal(porNome[nome].circulo_magico.disponivel_na_fonte, false, nome);
  }
});

test('getMagiasFRHOF exporta e carrega o catálogo separado', async t => {
  const catalogo = await carregar();
  const requisicoes = [];
  t.mock.method(globalThis, 'fetch', async (url, opcoes) => {
    requisicoes.push({ url, opcoes });
    return respostaJSON(catalogo);
  });

  const { getMagiasFRHOF } = await importarDbNovo();
  assert.equal(typeof getMagiasFRHOF, 'function');
  assert.deepEqual(await getMagiasFRHOF(), catalogo);
  assert.deepEqual(requisicoes, [{
    url: '../dados/magias/magias_frhof.json',
    opcoes: { cache: 'no-store' }
  }]);
});

test('db mescla índice, círculos, busca e listas de classe sem alterar base', async t => {
  const catalogo = await carregar();
  const indiceBase = {
    total_magias: 391,
    magias: Array.from({ length: 391 }, (_, i) => ({
      nome: `Magia Base ${i + 1}`,
      circulo: 1,
      escola: 'Evocação',
      classes: ['Mago'],
      tempo_conjuracao: 'Ação',
      alcance: '9 metros',
      componentes: 'V',
      duracao: 'Instantânea'
    }))
  };
  const circulo5Base = {
    circulo: 5,
    nome_circulo: '5º Círculo',
    total_magias: 1,
    magias: [indiceBase.magias[0]]
  };
  const magoBase = {
    classe: 'Mago',
    total_magias: 1,
    magias: [indiceBase.magias[1]]
  };
  const magiasClasseMagoBase = {
    classe: 'Mago',
    lista_magias: {
      '1º Círculo': [{ nome: 'Magia Base Classe', escola: 'Evocação', especial: '—' }]
    }
  };

  t.mock.method(globalThis, 'fetch', async url => {
    if (url.endsWith('magias/_indice.json')) return respostaJSON(indiceBase);
    if (url.endsWith('magias/circulo_5.json')) return respostaJSON(circulo5Base);
    if (url.endsWith('magias/por_classe/mago.json')) return respostaJSON(magoBase);
    if (url.endsWith('classes/magias_mago.json')) return respostaJSON(magiasClasseMagoBase);
    if (url.endsWith('magias/magias_frhof.json')) return respostaJSON(catalogo);
    return respostaJSON({ magias: [] });
  });

  const {
    getMagiasClasse,
    getIndiceMagias,
    getMagiasPorCirculo,
    getMagiasPorClasseLista,
    getMagia,
    buscarMagias
  } = await importarDbNovo();

  const indice = await getIndiceMagias();
  assert.equal(indice.total_magias, 410);
  assert.equal(indice.magias.filter(magia => magia.fonte?.id === 'frhof-2025').length, 19);
  assert.equal(indiceBase.total_magias, 391);

  const busca = await buscarMagias('spellfire');
  assert.deepEqual(busca.map(magia => magia.nome), ['Labareda de Spellfire', 'Tempestade de Spellfire']);

  const circulo5 = await getMagiasPorCirculo(5);
  assert.ok(circulo5.magias.some(magia => magia.nome === 'Manto de Lua de Alustriel'));
  assert.equal(circulo5.magias.filter(magia => magia.nome === 'Manto de Lua de Alustriel').length, 1);

  const alustriel = await getMagia('Manto de Lua de Alustriel', 5);
  assert.equal(alustriel.fonte.id, 'frhof-2025');
  assert.equal(alustriel.circulo, 5);

  const mago = await getMagiasPorClasseLista('Mago');
  assert.ok(mago.magias.some(magia => magia.nome === 'Lâmina do Desastre'));
  assert.equal(mago.magias.filter(magia => magia.fonte?.id === 'frhof-2025').length, 17);

  const magiasClasse = await getMagiasClasse('Mago');
  assert.ok(magiasClasse.lista_magias['5º Círculo'].some(magia => magia.nome === 'Manto de Lua de Alustriel'));
  assert.equal(magiasClasse.lista_magias['9º Círculo'].find(magia => magia.nome === 'Lâmina do Desastre').fonte.id, 'frhof-2025');

  const magiasClasseFeiticeiro = await getMagiasClasse('Feiticeiro');
  const magiasFRHOFFeiticeiro = Object.values(magiasClasseFeiticeiro.lista_magias)
    .flat()
    .filter(magia => magia.fonte?.id === 'frhof-2025')
    .map(magia => magia.nome);
  assert.deepEqual(magiasFRHOFFeiticeiro, [
    'Labareda de Spellfire',
    'Armadura da Morte',
    'Escudo Cacofônico',
    'Lança Prateada de Laeral',
    'Retaliação Mágica',
    'Tempestade de Spellfire',
    'Sufusão Elemental de Songol',
    'Esferas Resplandecentes de Elminster',
    'Synostodweomer da Simbul',
    'Lâmina do Desastre'
  ]);
});

test('criador, ficha e level up preservam fonte e exibem detalhes FRHOF', async () => {
  const [creator, sheet, levelup, levelupCore] = await Promise.all([
    readFile(new URL('../site/js/pages/creator.js', import.meta.url), 'utf8'),
    readFile(new URL('../site/js/pages/sheet.js', import.meta.url), 'utf8'),
    readFile(new URL('../site/js/levelup-ui.js', import.meta.url), 'utf8'),
    readFile(new URL('../site/js/levelup.js', import.meta.url), 'utf8')
  ]);

  assert.match(creator, /function criarEntradaMagiaSelecionada/);
  assert.match(creator, /clonarFonte\(info\.fonte\)/);
  assert.match(creator, /renderSeloFonte\(m\.fonte\)/);
  assert.match(creator, /renderSeloFonte\(magia\.fonte\)/);
  assert.match(creator, /function renderDanoMagia/);
  assert.match(creator, /renderDanoMagia\(magia\)/);
  assert.match(creator, /Circle Magic:<\/strong> reservado ao escopo 9/);

  assert.match(sheet, /function criarEntradaMagiaFicha/);
  assert.match(sheet, /clonarFonte\(info\.fonte\)/);
  assert.match(sheet, /renderSeloFonte\(magia\.fonte\)/);
  assert.match(sheet, /function renderDanoMagia/);
  assert.match(sheet, /renderDanoMagia\(magia\)/);
  assert.match(sheet, /renderDanoMagia\(magia, \{ print: true \}\)/);
  assert.match(sheet, /function renderSeloFonteMagiaFicha/);
  assert.match(sheet, /renderSeloFonteMagiaFicha\(m\)/);
  assert.match(sheet, /renderSeloFonteMagiaFicha\(nome\)/);
  assert.match(sheet, /const fonteBadge = magia\?\.fonte/);
  assert.match(sheet, /Circle Magic:<\/strong> reservado ao escopo 9/);

  assert.match(levelup, /function criarEntradaMagiaLevelUp/);
  assert.match(levelup, /clonarFonte\(magia\.fonte\)/);
  assert.match(levelup, /renderSeloFonte\(m\.fonte\)/);
  assert.match(levelup, /renderSeloFonte\(magia\.fonte\)/);
  assert.match(levelup, /char\.magias_conhecidas\.push\(criarEntradaMagiaLevelUp\(m, \{ circulo: 0 \}\)\)/);
  assert.match(levelup, /char\.magias_preparadas\.push\(criarEntradaMagiaLevelUp\(m\)\)/);
  const inicioGrimorio = levelupCore.indexOf('magiasGrimorioSelecionadas = selecionadas.map(');
  assert.ok(inicioGrimorio > 0, 'montagem das entradas do grimorio nao encontrada em levelup.js');
  const fimGrimorio = levelupCore.indexOf('});', inicioGrimorio);
  assert.ok(fimGrimorio > inicioGrimorio, 'fim da montagem das entradas do grimorio nao encontrado em levelup.js');
  const blocoGrimorio = levelupCore.slice(inicioGrimorio, fimGrimorio);
  assert.match(levelupCore, /import \{ clonarFonte \} from '\.\/fontes\.js';/);
  assert.match(blocoGrimorio, /clonarFonte\(magia\.fonte\)/);
  assert.match(blocoGrimorio, /\.\.\.\(fonte \? \{ fonte \} : \{\}\)/);
  assert.match(levelup, /Circle Magic:<\/strong> reservado ao escopo 9/);

  assert.doesNotMatch(creator, /Impacto na ficha/);
  assert.doesNotMatch(sheet, /Impacto na ficha/);
  assert.doesNotMatch(levelup, /Impacto na ficha/);
});

test('ficha registra efeitos mecânicos FRHOF no motor existente', async () => {
  const sheet = await readFile(new URL('../site/js/pages/sheet.js', import.meta.url), 'utf8');
  for (const nome of [
    'Elusão de Elminster',
    'Escudo Cacofônico',
    'Víbora de Syluné',
    'Retaliação Mágica',
    'Manto de Lua de Alustriel',
    'Sufusão Elemental de Songol',
    'Esferas Resplandecentes de Elminster',
    'Synostodweomer da Simbul',
    'Estrela Sagrada de Mystra',
    'Maré da Perdição',
    'Tempestade de Spellfire',
    'Lamento Fúnebre'
  ]) {
    assert.match(sheet, new RegExp(`'${nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`));
  }

  assert.match(sheet, /tipo_efeito:\s*'bonus', valor: 2/);
  assert.match(sheet, /tipo_efeito:\s*'bonus', valor: 5/);
  assert.match(sheet, /pv_temp', media: 15/);
  assert.match(sheet, /tipo_velocidade:\s*'escalada'/);
  assert.match(sheet, /tipo_velocidade:\s*'voo'/);
  assert.match(sheet, /recurso:\s*'esferas', quantidade: 6/);
  assert.match(sheet, /recurso:\s*'synostodweomer'/);
  assert.match(sheet, /tipo === 'estado_temporario'/);
  assert.match(sheet, /ef\.tipo === 'ca_bonus'/);
  assert.match(sheet, /ef\.tipo === 'deslocamento'/);
  assert.match(sheet, /ef\.tipo === 'reducao_dano'/);
});
