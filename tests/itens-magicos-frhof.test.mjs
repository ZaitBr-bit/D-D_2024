import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const arquivo = new URL('../dados/equipamento/itens_magicos_frhof.json', import.meta.url);
async function carregar() {
  return JSON.parse(await readFile(arquivo, 'utf8'));
}

let importacaoDb = 0;
async function importarDbNovo() {
  importacaoDb += 1;
  return import(`../site/js/db.js?itens-magicos-frhof=${importacaoDb}`);
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

test('getItensMagicosFRHOF exporta e carrega o catálogo correto', async t => {
  const requisicoes = [];
  const catalogo = await carregar();
  t.mock.method(globalThis, 'fetch', async (url, opcoes) => {
    requisicoes.push({ url, opcoes });
    return respostaJSON(catalogo);
  });

  const { getItensMagicosFRHOF } = await importarDbNovo();
  assert.equal(typeof getItensMagicosFRHOF, 'function');
  const resultado = await getItensMagicosFRHOF();

  assert.deepEqual(resultado, catalogo);
  assert.deepEqual(requisicoes, [{
    url: '../dados/equipamento/itens_magicos_frhof.json',
    opcoes: { cache: 'no-store' }
  }]);
});

test('getEquipamentoAventura não inclui os três itens mágicos FRHOF', async t => {
  const requisicoes = [];
  t.mock.method(globalThis, 'fetch', async url => {
    requisicoes.push(url);
    if (url.endsWith('equipamento_aventura.json')) {
      return respostaJSON({ itens: [{ nome: 'Covered Wagon' }] });
    }
    if (url.endsWith('equipamentos_regionais_frhof.json')) {
      return respostaJSON({ itens: [{ nome: 'Manto Fúngico Luminoso' }] });
    }
    return respostaJSON({ itens: [] });
  });

  const { getEquipamentoAventura } = await importarDbNovo();
  const resultado = await getEquipamentoAventura();
  const nomes = resultado.itens.flatMap(item => [item.nome, item.nome_original]);

  for (const nome of ["Adventurer's Ring", 'Prosthetic Limb', 'Windskiff']) {
    assert.equal(nomes.includes(nome), false, `${nome} não deve ser incluído`);
  }
  assert.deepEqual(requisicoes, [
    '../dados/equipamento/equipamento_aventura.json',
    '../dados/equipamento/equipamentos_regionais_frhof.json'
  ]);
});

test('catálogo contém exatamente os três itens mágicos FRHOF em ordem canônica', async () => {
  const catalogo = await carregar();
  assert.equal(catalogo.total_itens, 3);
  assert.ok(Array.isArray(catalogo.itens));
  assert.equal(catalogo.itens.length, 3);
  assert.deepEqual(catalogo.itens.map(item => item.nome), [
    "Anel do Aventureiro",
    "Membro Protético",
    "Windskiff"
  ]);
  assert.equal(new Set(catalogo.itens.map(item => item.nome)).size, 3);

  for (const item of catalogo.itens) {
    for (const campo of [
      'nome_original', 'categoria', 'tipo', 'raridade', 'requer_sintonizacao',
      'catalogo', 'custo', 'descricao', 'efeitos'
    ]) assert.ok(item[campo] !== undefined, `${item.nome}: campo ${campo}`);
    assert.equal(item.categoria, 'item mágico');
    assert.deepEqual(item.fonte, {
      id: 'frhof-2025',
      nome: 'Forgotten Realms: Heroes of Faerûn',
      rotulo: 'Heróis de Faerûn',
      tipo: 'expansao',
      ano: 2025
    });
  }
});

test('Anel do Aventureiro representa chama, luz e ação bônus', async () => {
  const item = (await carregar()).itens[0];
  assert.equal(item.nome_original, "Adventurer's Ring");
  assert.equal(item.raridade, 'comum');
  assert.equal(item.requer_sintonizacao, false);
  assert.equal(item.catalogo, 'Dalelands Wares');
  assert.equal(item.custo, '250 PO');
  assert.equal(item.efeitos.chama.sem_calor, true);
  assert.equal(item.efeitos.chama.sem_combustivel, true);
  assert.equal(item.efeitos.luz.plena_m, 6);
  assert.equal(item.efeitos.luz.penumbra_adicional_m, 6);
  assert.equal(item.efeitos.acao, 'ação bônus');
});

test('Membro Protético exige sintonização condicional e substitui membro funcionalmente', async () => {
  const item = (await carregar()).itens[1];
  assert.equal(item.nome_original, 'Prosthetic Limb');
  assert.equal(item.raridade, 'comum');
  assert.equal(item.requer_sintonizacao, true);
  assert.equal(item.efeitos.sintonizacao_condicao, 'criatura sem parte de um membro');
  assert.equal(item.efeitos.substitui_funcionalmente, true);
  assert.equal(item.efeitos.multiplos_contam_como_um_item, true);
});

test('Windskiff contém cargas, transformação e estatísticas do veículo', async () => {
  const item = (await carregar()).itens[2];
  assert.equal(item.nome_original, 'Windskiff');
  assert.equal(item.raridade, 'raro');
  assert.equal(item.requer_sintonizacao, false);
  assert.equal(item.catalogo, 'Moonshae Isles Wares');
  assert.equal(item.custo, '4.000 PO');
  assert.equal(item.efeitos.cargas.maximas, 3);
  assert.equal(item.efeitos.cargas.recuperacao, 'ao amanhecer');
  assert.equal(item.efeitos.transformacao.acao, 'ação mágica');
  assert.equal(item.efeitos.transformacao.duracao, '1 hora ou palavra de comando');
  assert.deepEqual(item.efeitos.veiculo, {
    tamanho: 'Médio',
    ca: 12,
    pv: 30,
    velocidade_pes: 40,
    planeio_razao: '5:1',
    sem_dano_queda: true
  });
});

test('catálogo exclui Mechanical Wonder e equipamentos mundanos', async () => {
  const nomes = (await carregar()).itens.flatMap(item => [item.nome, item.nome_original]);
  assert.equal(nomes.includes('Mechanical Wonder'), false);
  assert.equal(nomes.includes('Covered Wagon'), false);
});

test('criador e ficha integram o catálogo como item_magico preservando estado', async () => {
  const [creator, sheet] = await Promise.all([
    readFile(new URL('../site/js/pages/creator.js', import.meta.url), 'utf8'),
    readFile(new URL('../site/js/pages/sheet.js', import.meta.url), 'utf8')
  ]);
  assert.match(creator, /getItensMagicosFRHOF/);
  assert.match(sheet, /getItensMagicosFRHOF/);
  for (const codigo of [creator, sheet]) {
    assert.match(codigo, /tipo:\s*['"]item_magico['"]/);
    assert.match(codigo, /requer_sintonizacao/);
    assert.match(codigo, /sintonizado/);
    assert.match(codigo, /cargas_(?:maximas|atuais)/);
    assert.match(codigo, /forma_ativa/);
    assert.match(codigo, /renderSeloFonte\s*\(\s*item\.fonte\s*\)/);
  }
});

test('controles de item mágico limitam sintonizações e isolam estatísticas Windskiff', async () => {
  const [creator, sheet] = await Promise.all([
    readFile(new URL('../site/js/pages/creator.js', import.meta.url), 'utf8'),
    readFile(new URL('../site/js/pages/sheet.js', import.meta.url), 'utf8')
  ]);
  assert.match(creator, /LIMITE_SINTONIZACOES\s*=\s*3/);
  assert.match(sheet, /LIMITE_SINTONIZACOES\s*=\s*3/);
  assert.match(creator + sheet, /multiplos_contam_como_um_item/);
  assert.match(creator + sheet, /gastarCargaItemMagico/);
  assert.match(creator + sheet, /restaurarCargasItemMagico/);
  assert.match(creator + sheet, /alternarFormaWindskiff/);
  assert.match(sheet, /Veículo|veiculo/);
});

test('impressão preserva forma, cargas e veículo do Windskiff sem selo duplicado', async () => {
  const sheet = await readFile(new URL('../site/js/pages/sheet.js', import.meta.url), 'utf8');
  assert.match(sheet, /formatarItemMagicoImpressao/);
  assert.match(sheet, /forma_ativa/);
  assert.match(sheet, /planeio_razao/);
  assert.match(sheet, /sem_dano_queda/);
  assert.match(sheet, /Veículo \(\$\{item\.forma_ativa/);
  const seletor = sheet.slice(sheet.indexOf("case 'itens-magicos':"), sheet.indexOf('// Filtrar por texto', sheet.indexOf("case 'itens-magicos':")));
  assert.doesNotMatch(seletor, /Heróis de Faerûn/);
});
test('ativação do Windskiff gasta uma carga, bloqueia sem carga e desativação é gratuita', async () => {
  const [creator, sheet] = await Promise.all([
    readFile(new URL('../site/js/pages/creator.js', import.meta.url), 'utf8'),
    readFile(new URL('../site/js/pages/sheet.js', import.meta.url), 'utf8')
  ]);
  assert.equal((await carregar()).itens[2].efeitos.transformacao.gasto_por_uso, 1);
  for (const codigo of [creator, sheet]) {
    assert.match(codigo, /gasto_por_uso/);
    assert.match(codigo, /gastarCargaItemMagico\(item, gasto\)/);
    assert.match(codigo, /if \(item\.forma_ativa\) \{ item\.forma_ativa = false/);
  }
});
test('detalhe da ficha exibe proteção contra dano de queda do Windskiff', async () => {
  const sheet = await readFile(new URL('../site/js/pages/sheet.js', import.meta.url), 'utf8');
  const inicio = sheet.indexOf("if (item.nome === 'Windskiff'", sheet.indexOf('async function mostrarDetalheItemSheet'));
  const trecho = sheet.slice(inicio, sheet.indexOf('  } else if (item.tipo ===', inicio));
  assert.match(trecho, /v\.planeio_razao/);
  assert.match(trecho, /v\.sem_dano_queda/);
});
test('descanso longo restaura cargas dos itens magicos do inventario', async () => {
  const sheet = await readFile(new URL('../site/js/pages/sheet.js', import.meta.url), 'utf8');
  assert.match(sheet, /function restaurarCargasItensMagicosDescansoLongo\(\)/);
  assert.match(sheet, /if \(ehItemMagico\(item\)\) restaurarCargasItemMagico\(item\)/);
  const inicioDescansoLongo = sheet.indexOf("document.getElementById('btn-descanso-longo')");
  assert.ok(inicioDescansoLongo > 0, 'fluxo do descanso longo nao encontrado em sheet.js');
  const fimDescansoLongo = sheet.indexOf("toast('Descanso longo realizado!", inicioDescansoLongo);
  assert.ok(fimDescansoLongo > inicioDescansoLongo, 'fim do fluxo do descanso longo nao encontrado em sheet.js');
  const fluxoDescansoLongo = sheet.slice(inicioDescansoLongo, fimDescansoLongo);
  assert.match(fluxoDescansoLongo, /restaurarCargasItensMagicosDescansoLongo\(\);/);
});
