import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { clonarFonte, extrairDadosConteudo, FONTE_FRHOF } from '../site/js/fontes.js';
import { parseCusto } from '../site/js/moedas.js';

const windowOriginal = globalThis.window;
globalThis.window = {};
const { parsePeso } = await import('../site/js/utils.js');
if (windowOriginal === undefined) delete globalThis.window;
else globalThis.window = windowOriginal;

const itensEsperados = {
  'Manto Fúngico Luminoso': {
    nome_original: 'Bright Fungal Cloak',
    categoria: 'equipamento de aventura',
    catalogo: 'Icewind Dale Wares',
    peso: '2 kg',
    custo: '25 PO',
    tipo_uso: 'equipamento',
    peso_original: '4 lb.',
    descricaoInclui: ['Ação Bônus', '1,5 m']
  },
  'Roupas do Deserto': {
    nome_original: 'Desert Clothing',
    categoria: 'equipamento de aventura',
    catalogo: 'Calimshan Wares',
    peso: '2 kg',
    custo: '10 PO',
    tipo_uso: 'equipamento',
    peso_original: '4 lb.',
    descricaoInclui: ['armadura média ou pesada', 'calor extremo']
  },
  'Máscara de Diabo': {
    nome_original: 'Devil Mask',
    categoria: 'equipamento de aventura',
    catalogo: "Baldur's Gate Wares",
    peso: '—',
    custo: '25 PO',
    tipo_uso: 'equipamento',
    peso_original: '—',
    descricaoInclui: ['Desvantagem', 'Intuição']
  },
  'Traje de Luz e Sombra': {
    nome_original: 'Garb of Light and Shadow',
    categoria: 'equipamento de aventura',
    catalogo: 'Moonshae Isles Wares',
    peso: '3 kg',
    custo: '50 PO',
    tipo_uso: 'equipamento',
    peso_original: '6 lb.',
    descricaoInclui: ['Domínio do Deleite', 'Fadas']
  },
  'Robe de Gênio': {
    nome_original: 'Genie Robe',
    categoria: 'equipamento de aventura',
    catalogo: 'Calimshan Wares',
    peso: '3 kg',
    custo: '50 PO',
    tipo_uso: 'equipamento',
    peso_original: '6 lb.',
    descricaoInclui: ['Ar, Terra, Fogo ou Água', 'Elementais']
  },
  'Livro de Magias com Fechadura': {
    nome_original: 'Locking Spellbook',
    categoria: 'equipamento de aventura',
    catalogo: 'Dalelands Wares',
    peso: '1,5 kg',
    custo: '35 PO',
    tipo_uso: 'equipamento',
    peso_original: '3 lb.',
    descricaoInclui: ['100 páginas', 'CD 15']
  },
  'Camuflagem de Monstro': {
    nome_original: 'Monster Camouflage',
    categoria: 'equipamento de aventura',
    catalogo: 'Icewind Dale Wares',
    peso: '3 kg',
    custo: '50 PO',
    tipo_uso: 'equipamento',
    peso_original: '6 lb.',
    descricaoInclui: ['9 m', 'sucesso automático']
  },
  'Roupas Fúngicas Quentes': {
    nome_original: 'Warm Fungal Clothing',
    categoria: 'equipamento de aventura',
    catalogo: 'Icewind Dale Wares',
    peso: '2 kg',
    custo: '15 PO',
    tipo_uso: 'equipamento',
    peso_original: '4 lb.',
    descricaoInclui: ['frio extremo', '0,5 kg']
  },
  'Camuflagem de Inverno': {
    nome_original: 'Winter Camouflage',
    categoria: 'equipamento de aventura',
    catalogo: 'Icewind Dale Wares',
    peso: '2 kg',
    custo: '50 PO',
    tipo_uso: 'equipamento',
    peso_original: '4 lb.',
    descricaoInclui: ['Furtividade', 'ambiente apropriado']
  },
  Bandore: {
    nome_original: 'Bandore',
    categoria: 'instrumento musical',
    catalogo: 'Moonshae Isles Wares',
    peso: '1,5 kg',
    custo: '65 PO',
    tipo_uso: 'ferramenta',
    peso_original: '3 lb.',
    descricaoInclui: ['instrumento musical', 'Bônus de Proficiência']
  },
  Cittern: {
    nome_original: 'Cittern',
    categoria: 'instrumento musical',
    catalogo: 'Moonshae Isles Wares',
    peso: '1 kg',
    custo: '65 PO',
    tipo_uso: 'ferramenta',
    peso_original: '2 lb.',
    descricaoInclui: ['instrumento musical', 'Bônus de Proficiência']
  },
  Yarting: {
    nome_original: 'Yarting',
    categoria: 'instrumento musical',
    catalogo: 'Moonshae Isles Wares',
    peso: '1 kg',
    custo: '40 PO',
    tipo_uso: 'ferramenta',
    peso_original: '2 lb.',
    descricaoInclui: ['instrumento musical', 'Bônus de Proficiência']
  }
};

async function carregarCatalogo() {
  const arquivo = new URL('../dados/equipamento/equipamentos_regionais_frhof.json', import.meta.url);
  return JSON.parse(await readFile(arquivo, 'utf8'));
}

let importacaoDb = 0;

async function importarDbNovo() {
  importacaoDb += 1;
  return import(`../site/js/db.js?equipamentos-regionais=${importacaoDb}`);
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

test('catálogo regional contém somente os 12 itens mundanos aprovados', async () => {
  const catalogo = await carregarCatalogo();
  assert.equal(Array.isArray(catalogo.itens), true, 'itens deve ser um array');
  const nomes = catalogo.itens.map(item => item.nome);

  assert.equal(catalogo.total_itens, 12);
  assert.equal(catalogo.itens.length, 12);
  assert.deepEqual(nomes, Object.keys(itensEsperados));
  assert.equal(new Set(nomes).size, nomes.length, 'nomes devem ser únicos');
  assert.equal(
    catalogo.itens.filter(item => item.categoria === 'equipamento de aventura').length,
    9
  );
  assert.equal(
    catalogo.itens.filter(item => item.categoria === 'instrumento musical').length,
    3
  );

  const camposObrigatorios = [
    'nome_original',
    'catalogo',
    'peso',
    'peso_original',
    'custo',
    'descricao'
  ];
  for (const item of catalogo.itens) {
    assert.deepEqual(item.fonte, FONTE_FRHOF, `${item.nome}: fonte deve ser canônica e completa`);
    for (const campo of camposObrigatorios) {
      assert.equal(typeof item[campo], 'string', `${item.nome}: ${campo} deve ser texto`);
      assert.ok(item[campo].trim(), `${item.nome}: ${campo} não pode ser vazio`);
    }

    const { descricaoInclui, ...camposEsperados } = itensEsperados[item.nome];
    assert.deepEqual(
      Object.fromEntries(
        Object.keys(camposEsperados).map(campo => [campo, item[campo]])
      ),
      camposEsperados,
      `${item.nome}: campos canônicos devem corresponder à fixture`
    );
    for (const trecho of descricaoInclui) {
      assert.ok(item.descricao.includes(trecho), `${item.nome}: descrição deve incluir "${trecho}"`);
    }
  }

  const itensForaDoEscopo = [
    "Adventurer's Ring",
    'Prosthetic Limb',
    'Windskiff',
    'Covered Wagon',
    'Mechanical Wonder',
    'Axe Beak',
    'Flying Snake',
    'Sled Dog',
    "Black coach ride in Baldur's Gate",
    'Sled services'
  ];
  for (const nome of itensForaDoEscopo) {
    assert.equal(
      catalogo.itens.some(item => item.nome === nome || item.nome_original === nome),
      false,
      `${nome} não pertence ao catálogo regional aprovado`
    );
  }

  const conteudoAuditavel = catalogo.itens
    .flatMap(item => [item.nome, item.nome_original, item.categoria])
    .join(' ');
  assert.doesNotMatch(
    conteudoAuditavel,
    /montaria|mount|animal|serviço|service|veículo|vehicle|mecânic|mechanical/i
  );
});

test('catálogo regional não inclui os três itens mágicos do escopo seguinte', async () => {
  const catalogo = await carregarCatalogo();
  const nomes = catalogo.itens.flatMap(item => [item.nome, item.nome_original]);

  for (const nome of ["Adventurer's Ring", 'Prosthetic Limb', 'Windskiff']) {
    assert.equal(nomes.includes(nome), false, `${nome} não pertence ao catálogo regional mundano`);
  }
});

test('Manto Fúngico Luminoso preserva dados, fonte, custo e peso no inventário', async () => {
  const catalogo = await carregarCatalogo();
  const fixture = catalogo.itens.find(item => item.nome === 'Manto Fúngico Luminoso');
  assert.ok(fixture, 'fixture deve ser carregada do catálogo regional');

  const itemInventario = {
    nome: fixture.nome,
    tipo: fixture.tipo_uso || 'equipamento',
    quantidade: 1,
    equipado: false,
    fonte: clonarFonte(fixture.fonte),
    dados: extrairDadosConteudo(fixture)
  };

  assert.equal(itemInventario.nome, 'Manto Fúngico Luminoso');
  assert.equal(itemInventario.dados.custo, '25 PO');
  assert.equal(itemInventario.dados.peso, '2 kg');
  assert.equal(itemInventario.dados.descricao, fixture.descricao);
  assert.equal(itemInventario.fonte.id, 'frhof-2025');

  const restaurado = JSON.parse(JSON.stringify(itemInventario));
  assert.equal(restaurado.fonte.id, 'frhof-2025');
  assert.equal(restaurado.dados.descricao, fixture.descricao);

  assert.deepEqual(parseCusto(itemInventario.dados.custo), {
    tipo: 'po',
    qtd: 25,
    cobre: 2500
  });
  assert.equal(parsePeso(itemInventario.dados.peso), 2);
});

test('getEquipamentosRegionaisFRHOF carrega o catálogo regional', async t => {
  const requisicoes = [];
  t.mock.method(globalThis, 'fetch', async (url, opcoes) => {
    requisicoes.push({ url, opcoes });
    return respostaJSON({ total_itens: 1, itens: [{ nome: 'Regional' }] });
  });

  const { getEquipamentosRegionaisFRHOF } = await importarDbNovo();
  const resultado = await getEquipamentosRegionaisFRHOF();

  assert.deepEqual(resultado.itens, [{ nome: 'Regional' }]);
  assert.deepEqual(requisicoes, [{
    url: '../dados/equipamento/equipamentos_regionais_frhof.json',
    opcoes: { cache: 'no-store' }
  }]);
});

test('getEquipamentoAventura mescla base e regional em paralelo', async t => {
  const pendentes = new Map();
  const requisicoes = [];
  const base = { edicao: '2024', total_itens: 1, itens: [{ nome: 'Base' }] };
  const regional = { total_itens: 2, itens: [{ nome: 'Regional 1' }, { nome: 'Regional 2' }] };

  t.mock.method(globalThis, 'fetch', url => {
    requisicoes.push(url);
    return new Promise(resolve => pendentes.set(url, resolve));
  });

  const { getEquipamentoAventura } = await importarDbNovo();
  const resultadoPendente = getEquipamentoAventura();

  assert.deepEqual(requisicoes, [
    '../dados/equipamento/equipamento_aventura.json',
    '../dados/equipamento/equipamentos_regionais_frhof.json'
  ]);

  pendentes.get(requisicoes[1])(respostaJSON(regional));
  pendentes.get(requisicoes[0])(respostaJSON(base));
  const resultado = await resultadoPendente;

  assert.deepEqual(resultado, {
    edicao: '2024',
    total_itens: 3,
    itens: [{ nome: 'Base' }, { nome: 'Regional 1' }, { nome: 'Regional 2' }]
  });
});

test('getEquipamentoAventura tolera falha no catálogo base ou regional', async t => {
  for (const caminhoComFalha of [
    'equipamento/equipamento_aventura.json',
    'equipamento/equipamentos_regionais_frhof.json'
  ]) {
    await t.test(caminhoComFalha, async st => {
      st.mock.method(console, 'error', () => {});
      st.mock.method(globalThis, 'fetch', async url => {
        if (url.endsWith(caminhoComFalha)) return respostaJSON(null, false, 500);
        if (url.endsWith('equipamento_aventura.json')) {
          return respostaJSON({ origem: 'base', itens: [{ nome: 'Base' }] });
        }
        return respostaJSON({ origem: 'regional', itens: [{ nome: 'Regional' }] });
      });

      const { getEquipamentoAventura } = await importarDbNovo();
      const resultado = await getEquipamentoAventura();
      const itemEsperado = caminhoComFalha.endsWith('equipamento_aventura.json')
        ? { nome: 'Regional' }
        : { nome: 'Base' };

      assert.deepEqual(resultado.itens, [itemEsperado]);
      assert.equal(resultado.total_itens, 1);
    });
  }
});
