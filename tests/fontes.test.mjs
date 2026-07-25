import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  FONTE_FRHOF,
  clonarFonte,
  ehFonte,
  extrairDadosConteudo,
  obterIdFonte,
  obterRotuloFonte,
  renderSeloFonte
} from '../site/js/fontes.js';

function recortarEntre(codigo, marcadorInicio, marcadorFim) {
  const inicio = codigo.indexOf(marcadorInicio);
  const fim = codigo.indexOf(marcadorFim, inicio);
  assert.ok(inicio >= 0 && fim > inicio, `trecho entre ${marcadorInicio} e ${marcadorFim} deve existir`);
  return codigo.slice(inicio, fim);
}

test('registro e constante frhof-2025 são idênticos', async () => {
  const json = JSON.parse(await readFile(new URL('../dados/fontes.json', import.meta.url), 'utf8'));
  assert.equal(json.fontes.length, 1);
  assert.deepEqual(json.fontes[0], FONTE_FRHOF);
});

test('db consulta a fonte canônica por ID', async () => {
  const fetchOriginal = globalThis.fetch;
  const chamadas = [];
  globalThis.fetch = async url => {
    chamadas.push(url);
    return {
      ok: true,
      json: async () => ({ fontes: [FONTE_FRHOF] })
    };
  };

  try {
    const urlDb = new URL('../site/js/db.js', import.meta.url);
    urlDb.searchParams.set('teste', `${Date.now()}-${Math.random()}`);
    const { getFonte, getFontes } = await import(urlDb.href);

    assert.deepEqual(await getFonte('frhof-2025'), FONTE_FRHOF);
    assert.equal(await getFonte('ausente'), null);
    assert.deepEqual(await getFontes(), { fontes: [FONTE_FRHOF] });
    assert.equal(chamadas.length, 1);
    assert.ok(
      String(chamadas[0]).endsWith('/dados/fontes.json')
      || String(chamadas[0]).includes('../dados/fontes.json')
    );
  } finally {
    globalThis.fetch = fetchOriginal;
  }
});

test('fonte pode ser consultada sem inferência pelo nome do conteúdo', () => {
  assert.equal(ehFonte({ fonte: FONTE_FRHOF }, 'frhof-2025'), true);
  assert.equal(ehFonte({ fonte: { id: 'phb-2024' } }, 'frhof-2025'), false);
  assert.equal(ehFonte({ nome: 'Heróis de Faerûn' }, 'frhof-2025'), false);
  assert.equal(obterIdFonte({ fonte: { id: 123 } }), '');
  assert.equal(ehFonte({ fonte: { id: 123 } }, 123), false);
  assert.equal(obterIdFonte({ id: 'item-1', fonte: FONTE_FRHOF }), 'frhof-2025');
  assert.equal(ehFonte({ id: 'item-1', fonte: FONTE_FRHOF }, 'frhof-2025'), true);
  assert.equal(obterIdFonte({ id: 'item-1', fonte: { id: 123 } }), '');
});

test('rótulo da fonte é obtido exclusivamente do registro canônico', () => {
  assert.equal(obterRotuloFonte(FONTE_FRHOF), 'Heróis de Faerûn');
  assert.equal(obterRotuloFonte({ id: 'item-1', fonte: FONTE_FRHOF }), 'Heróis de Faerûn');
  assert.equal(obterRotuloFonte(null), '');
  assert.equal(obterRotuloFonte({ id: 'phb-2024', rotulo: 'Rótulo não canônico' }), '');
});

test('clonagem preserva o contrato sem compartilhar referência', () => {
  const copia = clonarFonte(FONTE_FRHOF);
  assert.deepEqual(copia, FONTE_FRHOF);
  assert.notEqual(copia, FONTE_FRHOF);
});

test('dados do conteúdo preservam metadados presentes e futuros sem duplicar identidade', () => {
  const conteudo = {
    nome: 'Item Regional',
    fonte: FONTE_FRHOF,
    custo: '10 PO',
    peso: '1 kg',
    descricao: 'Descrição',
    tipo_uso: 'equipamento',
    categoria: 'regional',
    catalogo: 'Faerûn',
    nome_original: 'Regional Item',
    peso_original: '2 lb.',
    metadado_futuro: { edicao: 2026 }
  };
  const entradaOriginal = structuredClone(conteudo);

  const dados = extrairDadosConteudo(conteudo);

  assert.deepEqual(dados, {
    custo: '10 PO',
    peso: '1 kg',
    descricao: 'Descrição',
    tipo_uso: 'equipamento',
    categoria: 'regional',
    catalogo: 'Faerûn',
    nome_original: 'Regional Item',
    peso_original: '2 lb.',
    metadado_futuro: { edicao: 2026 }
  });
  assert.notEqual(dados, conteudo);
  assert.equal(dados.metadado_futuro, conteudo.metadado_futuro);
  assert.deepEqual(conteudo, entradaOriginal);
  assert.deepEqual(extrairDadosConteudo(null), {});
  assert.deepEqual(extrairDadosConteudo('item'), {});
  assert.deepEqual(extrairDadosConteudo({ nome: 'Item Core', custo: '1 PO' }), { custo: '1 PO' });
});

test('store preserva fonte ao salvar, exportar e importar personagem', async () => {
  const tinhaWindow = Object.hasOwn(globalThis, 'window');
  const windowOriginal = globalThis.window;
  const tinhaLocalStorage = Object.hasOwn(globalThis, 'localStorage');
  const localStorageOriginal = globalThis.localStorage;
  const valores = new Map();

  globalThis.window = {};
  globalThis.localStorage = {
    getItem(chave) {
      return valores.has(String(chave)) ? valores.get(String(chave)) : null;
    },
    setItem(chave, valor) {
      valores.set(String(chave), String(valor));
    },
    removeItem(chave) {
      valores.delete(String(chave));
    },
    clear() {
      valores.clear();
    }
  };

  try {
    const urlStore = new URL('../site/js/store.js', import.meta.url);
    urlStore.searchParams.set('teste', `${Date.now()}-${Math.random()}`);
    const {
      salvarPersonagem,
      exportarPersonagem,
      importarPersonagens,
      getPersonagem
    } = await import(urlStore.href);
    const personagem = {
      id: 'personagem-fonte-frhof',
      nome: 'Personagem de teste',
      nivel: 1,
      atributos: {},
      inventario: [
        { nome: 'Item de Faerûn', fonte: clonarFonte(FONTE_FRHOF) },
        { nome: 'Item legado' }
      ]
    };

    salvarPersonagem(personagem);
    const jsonExportado = exportarPersonagem(personagem.id);
    localStorage.clear();
    const importados = importarPersonagens(jsonExportado);
    const restaurado = getPersonagem(personagem.id);

    assert.equal(importados, 1);
    assert.equal(restaurado.inventario[0].fonte.id, 'frhof-2025');
    assert.deepEqual(restaurado.inventario[0].fonte, FONTE_FRHOF);
    assert.equal(Object.hasOwn(restaurado.inventario[1], 'fonte'), false);
  } finally {
    if (tinhaWindow) globalThis.window = windowOriginal;
    else delete globalThis.window;
    if (tinhaLocalStorage) globalThis.localStorage = localStorageOriginal;
    else delete globalThis.localStorage;
  }
});

test('selo só aparece para conteúdo com fonte conhecida', () => {
  assert.match(renderSeloFonte(FONTE_FRHOF), /class="badge badge-fonte"/);
  assert.match(renderSeloFonte(FONTE_FRHOF), />Heróis de Faerûn</);
  assert.equal(renderSeloFonte(null), '');
  assert.equal(renderSeloFonte({ id: 'phb-2024' }), '');
});

test('criador importa helpers e preserva a fonte ao adicionar equipamentos', async () => {
  const codigo = await readFile(new URL('../site/js/pages/creator.js', import.meta.url), 'utf8');
  const importacao = codigo.match(/import\s*\{([^}]*)\}\s*from\s*['"]\.\.\/fontes\.js['"]/);
  const equipamentoInicial = recortarEntre(
    codigo,
    'function adicionarItensEquipamentoInicial(',
    'async function renderStepEquipamento('
  );

  assert.ok(importacao, 'creator.js deve importar de ../fontes.js');
  const nomesImportados = importacao[1].split(',').map(nome => nome.trim());
  assert.ok(nomesImportados.includes('clonarFonte'));
  assert.ok(nomesImportados.includes('extrairDadosConteudo'));
  assert.ok(nomesImportados.includes('renderSeloFonte'));
  assert.match(equipamentoInicial, /fonte\s*:\s*clonarFonte\s*\(\s*equipComp\.fonte\s*\)/);
  assert.match(equipamentoInicial, /fonte\s*:\s*clonarFonte\s*\(\s*equip\.fonte\s*\)/);
  assert.match(equipamentoInicial, /dados\s*:\s*extrairDadosConteudo\s*\(\s*equipComp\s*\)/);
  assert.match(equipamentoInicial, /dados\s*:\s*extrairDadosConteudo\s*\(\s*equip\s*\)/);
  assert.doesNotMatch(equipamentoInicial, /dados\s*:\s*\{\s*custo\s*:\s*equipComp\.custo/);
  assert.doesNotMatch(equipamentoInicial, /dados\s*:\s*\{\s*custo\s*:\s*equip\.custo/);
});

test('seletor preserva o contrato completo e exibe o selo da fonte', async () => {
  const codigo = await readFile(new URL('../site/js/pages/creator.js', import.meta.url), 'utf8');
  const seletor = recortarEntre(
    codigo,
    'function mostrarSeletorItem()',
    'function mostrarFormCustomItem()'
  );

  assert.match(seletor, /renderSeloFonte\s*\(\s*it\.fonte\s*\)/);
  assert.match(seletor, /fonte\s*:\s*clonarFonte\s*\(\s*item\.fonte\s*\)/);
  assert.match(seletor, /dados\s*:\s*extrairDadosConteudo\s*\(\s*item\s*\)/);
  assert.match(seletor, /descricao\s*:\s*item\.descricao\s*\|\|\s*''/);
  assert.doesNotMatch(seletor, /dados\s*:\s*\{\s*peso\s*:\s*item\.peso/);
});

test('inventário e modal de detalhes exibem o selo da fonte', async () => {
  const codigo = await readFile(new URL('../site/js/pages/creator.js', import.meta.url), 'utf8');
  const itemInventario = recortarEntre(
    codigo,
    'function renderItemInventario(',
    'function setupEventosInventario('
  );
  const detalheItem = recortarEntre(
    codigo,
    'function mostrarDetalheItem(',
    'async function renderStepMagias('
  );

  assert.match(itemInventario, /renderSeloFonte\s*\(\s*item\.fonte\s*\)/);
  assert.match(detalheItem, /renderSeloFonte\s*\(\s*item\.fonte\s*\)/);
  assert.doesNotMatch(codigo, /badge-fonte[^>]*no-print|no-print[^>]*badge-fonte/);
});

test('ficha importa helpers e preserva a fonte ao adicionar pelo seletor', async () => {
  const codigo = await readFile(new URL('../site/js/pages/sheet.js', import.meta.url), 'utf8');
  const importacao = codigo.match(/import\s*\{([^}]*)\}\s*from\s*['"]\.\.\/fontes\.js['"]/);
  const seletor = recortarEntre(
    codigo,
    'async function mostrarSeletorCategoria()',
    'function renderSecaoDetalhes()'
  );
  const renderCategoria = recortarEntre(
    seletor,
    'function renderCategoria(cat, filtroTexto)',
    '// Renderizar categoria inicial'
  );

  assert.ok(importacao, 'sheet.js deve importar de ../fontes.js');
  const nomesImportados = importacao[1].split(',').map(nome => nome.trim());
  assert.ok(nomesImportados.includes('clonarFonte'));
  assert.ok(nomesImportados.includes('obterRotuloFonte'));
  assert.ok(nomesImportados.includes('renderSeloFonte'));

  for (const categoria of ['consumiveis', 'municao', 'equipamento']) {
    const trechoCategoria = recortarEntre(
      renderCategoria,
      `case '${categoria}':`,
      categoria === 'equipamento' ? '// Filtrar por texto' : 'break;'
    );
    assert.match(trechoCategoria, /fonte\s*:\s*i\.fonte/);
  }
  assert.equal((renderCategoria.match(/fonte\s*:\s*i\.fonte/g) || []).length, 3);
  assert.match(renderCategoria, /<div class="inv-item-nome">\$\{it\.nome\}\s+\$\{renderSeloFonte\s*\(\s*it\.fonte\s*\)\}/);
  assert.match(renderCategoria, /fonte\s*:\s*clonarFonte\s*\(\s*item\.fonte\s*\)/);
  assert.match(renderCategoria, /dados\s*:\s*\{\s*\.\.\.item\.dados\s*\}/);
  assert.match(
    renderCategoria,
    /char\.inventario\.find\s*\(\s*inv\s*=>\s*inv\.nome\s*===\s*item\.nome\s*&&\s*inv\.tipo\s*===\s*item\.tipo\s*&&\s*inv\.fonte\?\.id\s*===\s*item\.fonte\?\.id\s*\)/
  );
});

test('item do inventário da ficha exibe selo imprimível junto ao nome', async () => {
  const codigo = await readFile(new URL('../site/js/pages/sheet.js', import.meta.url), 'utf8');
  const itemInventario = recortarEntre(
    codigo,
    'function renderSheetInvItem(',
    'function setupEventosInventarioSheet()'
  );

  assert.match(itemInventario, /\$\{item\.nome\}\s+\$\{renderSeloFonte\s*\(\s*item\.fonte\s*\)\}/);
  assert.doesNotMatch(itemInventario, /renderSeloFonte\s*\(\s*item\.fonte\s*\)[^\n]*no-print/);
});

test('detalhe do item da ficha inicia o corpo com o selo da fonte', async () => {
  const codigo = await readFile(new URL('../site/js/pages/sheet.js', import.meta.url), 'utf8');
  const detalheItem = recortarEntre(
    codigo,
    'async function mostrarDetalheItemSheet(',
    '/** Abre o seletor de itens dividido por categorias */'
  );

  assert.match(detalheItem, /let\s+corpo\s*=\s*renderSeloFonte\s*\(\s*item\.fonte\s*\)\s*;/);
});

test('normalização de munição preserva a fonte original', async () => {
  const codigo = await readFile(new URL('../site/js/pages/sheet.js', import.meta.url), 'utf8');
  const carregarDados = recortarEntre(
    codigo,
    'async function carregarDadosEquipSheet()',
    '/** Mostra popup com detalhes completos de um item do inventário */'
  );

  assert.match(
    carregarDados,
    /municao\s*:\s*\(equipData\?\.municao\s*\|\|\s*\[\]\)\.map\s*\(\s*m\s*=>\s*\(\{[\s\S]*?fonte\s*:\s*m\.fonte[\s\S]*?\}\)\s*\)/
  );
});

test('overlay e PDF preservam a fonte nos caminhos reais de impressão', async () => {
  const codigo = await readFile(new URL('../site/js/pages/sheet.js', import.meta.url), 'utf8');
  const impressao = recortarEntre(
    codigo,
    'async function gerarHtmlImpressao()',
    'let _printOverlayAtivo = false;'
  );
  const itensEquipados = recortarEntre(
    impressao,
    '// --- Itens equipados ---',
    '// ===================== PAGINA 2+'
  );
  const itensMochila = recortarEntre(
    impressao,
    '// --- Inventario (itens NAO equipados) ---',
    '// --- Detalhes pessoais ---'
  );
  const cartao = recortarEntre(
    codigo,
    'function _montarDadosCartao()',
    'function _extrairBlocosDetalhe('
  );

  assert.match(
    itensEquipados,
    /<span class="print-equip-name">\$\{item\.nome\}\$\{qtd\}\s*\$\{renderSeloFonte\s*\(\s*item\.fonte\s*\)\}\s*<\/span>/
  );
  assert.match(
    itensMochila,
    /<span class="print-inv-name">\$\{item\.nome\}\$\{qtd\}\s*\$\{renderSeloFonte\s*\(\s*item\.fonte\s*\)\}\s*<\/span>/
  );
  assert.match(cartao, /\.map\s*\(\s*i\s*=>\s*\{[\s\S]*?const\s+fonte\s*=\s*obterRotuloFonte\s*\(\s*i\s*\)\s*;/);
  assert.match(cartao, /return\s+`\$\{i\.nome\}[\s\S]*?\$\{fonte\s*\?\s*`\s*\[\$\{fonte\}\]\s*`\s*:\s*''\}`\s*;/);
});

test('selo da fonte tem estilos próprios na tela e na impressão', async () => {
  const css = await readFile(new URL('../site/css/app.css', import.meta.url), 'utf8');
  const blocoNormal = css.match(/\.badge-fonte\s*\{([^}]*)\}/)?.[1] || '';
  const inicioPrint = css.indexOf('@media print');
  const cssPrint = inicioPrint >= 0 ? css.slice(inicioPrint) : '';
  const blocoPrint = cssPrint.match(/\.badge-fonte\s*\{([^}]*)\}/)?.[1] || '';

  assert.match(blocoNormal, /background\s*:\s*#e8ddc2\s*;/i);
  assert.match(blocoNormal, /border\s*:\s*1px\s+solid\s+#9a7b3f\s*;/i);
  assert.match(blocoNormal, /color\s*:\s*#4d3714\s*;/i);
  assert.match(blocoNormal, /font-size\s*:\s*0\.62rem\s*;/i);
  assert.match(blocoNormal, /font-weight\s*:\s*700\s*;/i);
  assert.match(blocoNormal, /margin-left\s*:\s*0\.3rem\s*;/i);
  assert.match(blocoNormal, /white-space\s*:\s*nowrap\s*;/i);
  assert.match(blocoPrint, /background\s*:\s*transparent\s*!important\s*;/i);
  assert.match(blocoPrint, /border-color\s*:\s*#555\s*!important\s*;/i);
  assert.match(blocoPrint, /color\s*:\s*#222\s*!important\s*;/i);
});
