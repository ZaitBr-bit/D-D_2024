// ============================================================
// ORÁCULO DE FIDELIDADE DO MARKDOWN (Task 24).
//
// Os testes de payload hostil provam que conteúdo MALICIOSO é bloqueado.
// Eles não provam nada sobre o que interessa ao usuário: que todo conteúdo
// LEGÍTIMO continua sendo renderizado exatamente como antes. É isso que este
// arquivo faz.
//
// Método:
//   1. Coleta TODAS as strings de descrição do pacote `dados/pacotes/dnd2024`
//      (magias, características de classe e subclasse, glossário, espécies,
//      antecedentes, talentos, equipamento, criaturas) — não uma amostra.
//   2. Renderiza cada uma com o `mdParaHtml` do COMMIT-BASELINE (extraído do
//      git por tests/helpers/legacy-markdown.js, não uma cópia manual) e com
//      o `renderSafeMarkdown` novo.
//   3. Exige igualdade de DOM normalizado, string por string.
//
// Política de diferenças permitidas (mesma disciplina do `baselineDifferences`
// da Task 2): a lista `NORMALIZACOES_PERMITIDAS` abaixo é EXPLÍCITA, e cada
// item tem uma justificativa e um teste que prova que aquela tolerância não
// esconde regressão real. Hoje ela cobre apenas duas diferenças de
// REPRESENTAÇÃO do DOM (não de conteúdo), e o número de descrições com
// diferença de conteúdo é ZERO — não porque a comparação seja frouxa, mas
// porque o renderizador novo reproduz a gramática do baseline. O teste de
// mutação no fim do arquivo prova que uma regressão de verdade FALHA aqui.
// ============================================================
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { renderSafeMarkdown } from '../../../site/js/ui/markdown.js';
import { loadBaselineMdParaHtml, getRepoRoot } from '../../helpers/legacy-markdown.js';
import { createTestDom, normalizeDomNode, normalizeHtmlString, normalizeFragment } from '../../helpers/test-dom.js';

// Chaves que carregam texto em Markdown no pacote oficial. Levantadas por
// varredura de TODAS as chaves de string do pacote (ver o teste de cobertura
// abaixo, que falha se aparecer uma chave nova com cara de descrição).
const CHAVES_DE_DESCRICAO = Object.freeze(['description', 'descricao', 'text', 'definition', 'texto_completo']);

const NORMALIZACOES_PERMITIDAS = Object.freeze([
  {
    id: 'nos-de-texto-adjacentes',
    o_que: 'Nós de texto adjacentes são concatenados antes de comparar.',
    por_que:
      'O caminho do baseline passa por innerHTML, e o parser de HTML quebra o texto em vários nós ao redor de entidades ("D&amp;D" vira dois nós). O caminho novo cria um único nó com createTextNode. É diferença de representação: o texto resultante é idêntico e o usuário não tem como observar a fronteira entre nós.',
    prova: 'texto-final-identico',
  },
  {
    id: 'separadores-de-linha',
    o_que: 'Nós de texto compostos apenas de "\\n" são descartados.',
    por_que:
      'São os separadores estruturais que o baseline emite no join("\\n") final entre blocos. Não têm efeito visual (HTML colapsa espaço em branco entre blocos) e ambos os renderizadores os emitem nos mesmos lugares.',
    prova: 'apenas-quebras-de-linha',
  },
  {
    id: 'controles-c0-removidos',
    o_que: 'O renderizador novo remove controles C0/DEL (exceto tab, LF e CR) antes de processar.',
    por_que:
      'É o que impede conteúdo de forjar o marcador interno U+0000. O teste "nenhuma descrição real contém controle C0" abaixo prova que a tolerância é vazia no conteúdo real: nenhuma string do pacote é alterada por essa remoção.',
    prova: 'nenhum-controle-c0-no-catalogo',
  },
]);

/**
 * Coleta todas as strings de descrição do pacote oficial.
 * @returns {Array<{arquivo: string, caminho: string, valor: string}>}
 */
function coletarCorpus() {
  const raiz = path.join(getRepoRoot(), 'dados', 'pacotes', 'dnd2024');
  const encontrados = [];

  /**
   * @param {*} valor
   * @param {string} arquivo
   * @param {Array<string|number>} trilha
   */
  function varrer(valor, arquivo, trilha) {
    if (Array.isArray(valor)) {
      valor.forEach((item, indice) => varrer(item, arquivo, [...trilha, indice]));
      return;
    }
    if (valor && typeof valor === 'object') {
      for (const [chave, filho] of Object.entries(valor)) {
        if (typeof filho === 'string') {
          if (CHAVES_DE_DESCRICAO.includes(chave)) {
            encontrados.push({ arquivo, caminho: [...trilha, chave].join('.'), valor: filho });
          }
        } else {
          varrer(filho, arquivo, [...trilha, chave]);
        }
      }
    }
  }

  /** @param {string} diretorio */
  function varrerDiretorio(diretorio) {
    for (const entrada of fs.readdirSync(diretorio, { withFileTypes: true })) {
      const completo = path.join(diretorio, entrada.name);
      if (entrada.isDirectory()) {
        varrerDiretorio(completo);
      } else if (entrada.name.endsWith('.json')) {
        varrer(JSON.parse(fs.readFileSync(completo, 'utf8')), path.relative(raiz, completo).split(path.sep).join('/'), []);
      }
    }
  }

  varrerDiretorio(raiz);
  return encontrados;
}

const corpus = coletarCorpus();

describe('oráculo de fidelidade: o corpus é o catálogo inteiro', () => {
  test('cobre magias, características de classe/subclasse e glossário (não uma amostra)', () => {
    const porArquivo = new Map();
    for (const item of corpus) {
      porArquivo.set(item.arquivo, (porArquivo.get(item.arquivo) ?? 0) + 1);
    }

    // 391 magias no pacote: cada uma com sua `description`.
    const descricoesDeMagia = corpus.filter(
      (item) => item.arquivo.startsWith('spells/') && !item.arquivo.startsWith('spells/by-class'),
    );
    assert.ok(descricoesDeMagia.length >= 391, `esperado >= 391 descrições de magia, obtido ${descricoesDeMagia.length}`);

    // As doze classes, cada uma com características (e subclasses) descritas.
    const arquivosDeClasse = [...porArquivo.keys()].filter((arquivo) => arquivo.startsWith('classes/'));
    assert.equal(arquivosDeClasse.length, 12, `esperado 12 arquivos de classe, obtido ${arquivosDeClasse.length}`);
    for (const arquivo of arquivosDeClasse) {
      assert.ok(porArquivo.get(arquivo) > 10, `${arquivo}: só ${porArquivo.get(arquivo)} descrições`);
    }

    assert.ok(porArquivo.get('appendices/glossary.json') > 100, 'glossário com poucas entradas');
    assert.ok(corpus.length > 3000, `corpus pequeno demais: ${corpus.length}`);
  });

  test('nenhuma chave de string com cara de descrição ficou de fora da varredura', () => {
    // Se o pacote ganhar uma chave nova com texto longo/Markdown, este teste
    // falha e obriga a incluí-la no oráculo — em vez de deixá-la sem
    // cobertura silenciosamente.
    const raiz = path.join(getRepoRoot(), 'dados', 'pacotes', 'dnd2024');
    const suspeitas = new Set();

    /**
     * @param {*} valor
     */
    function varrer(valor) {
      if (Array.isArray(valor)) {
        valor.forEach(varrer);
        return;
      }
      if (valor && typeof valor === 'object') {
        for (const [chave, filho] of Object.entries(valor)) {
          if (typeof filho === 'string') {
            const pareceMarkdown = filho.includes('\n') || filho.includes('**') || filho.length > 200;
            if (pareceMarkdown && !CHAVES_DE_DESCRICAO.includes(chave)) {
              suspeitas.add(chave);
            }
          } else {
            varrer(filho);
          }
        }
      }
    }

    /** @param {string} diretorio */
    function varrerDiretorio(diretorio) {
      for (const entrada of fs.readdirSync(diretorio, { withFileTypes: true })) {
        const completo = path.join(diretorio, entrada.name);
        if (entrada.isDirectory()) {
          varrerDiretorio(completo);
        } else if (entrada.name.endsWith('.json')) {
          varrer(JSON.parse(fs.readFileSync(completo, 'utf8')));
        }
      }
    }

    varrerDiretorio(raiz);
    // Chaves conhecidas que contêm texto longo mas NÃO são renderizadas como
    // Markdown pelo app (rótulos de escolha, descrição de componente material,
    // colunas de tabela de classe). Ficam listadas aqui de propósito.
    const conhecidas = new Set([
      'label',
      'materialDescription',
      'nota',
      'Equipamento Inicial',
      'Proficiências em Perícias',
      'shortRest',
      'longRest',
      'castingTime',
      'converter_espaco',
    ]);
    const inesperadas = [...suspeitas].filter((chave) => !conhecidas.has(chave));
    assert.deepEqual(inesperadas, [], `chaves de texto sem cobertura no oráculo: ${inesperadas.join(', ')}`);
  });
});

describe('oráculo de fidelidade: baseline x renderizador novo', () => {
  test('todas as descrições reais produzem o MESMO DOM normalizado', () => {
    const baseline = loadBaselineMdParaHtml();
    const dom = createTestDom();
    const divergentes = [];

    for (const item of corpus) {
      const esperado = normalizeHtmlString(dom.document, baseline(item.valor));
      const obtido = normalizeFragment(dom.document, renderSafeMarkdown(dom.document, item.valor));
      if (JSON.stringify(esperado) !== JSON.stringify(obtido)) {
        divergentes.push(`${item.arquivo}#${item.caminho}`);
      }
    }

    dom.restore();
    assert.deepEqual(
      divergentes,
      [],
      `${divergentes.length} de ${corpus.length} descrições divergiram do baseline: ${divergentes.slice(0, 10).join(' | ')}`,
    );
  });

  test('o texto visível final é idêntico, caractere a caractere (prova de "nos-de-texto-adjacentes")', () => {
    const baseline = loadBaselineMdParaHtml();
    const dom = createTestDom();
    const divergentes = [];

    for (const item of corpus) {
      const containerBaseline = dom.document.createElement('div');
      containerBaseline.innerHTML = baseline(item.valor);
      const containerNovo = dom.document.createElement('div');
      containerNovo.appendChild(renderSafeMarkdown(dom.document, item.valor));
      if (containerBaseline.textContent !== containerNovo.textContent) {
        divergentes.push(`${item.arquivo}#${item.caminho}`);
      }
    }

    dom.restore();
    assert.deepEqual(divergentes, [], `texto visível divergiu em: ${divergentes.slice(0, 10).join(' | ')}`);
  });

  test('a formatação legítima realmente existe no corpus (o oráculo não é vacuamente verdadeiro)', () => {
    const dom = createTestDom();
    const contagem = { strong: 0, em: 0, h3: 0, h4: 0, ul: 0, li: 0, table: 0, p: 0 };

    for (const item of corpus) {
      const container = dom.document.createElement('div');
      container.appendChild(renderSafeMarkdown(dom.document, item.valor));
      for (const tag of Object.keys(contagem)) {
        contagem[tag] += container.querySelectorAll(tag).length;
      }
    }

    dom.restore();
    for (const [tag, total] of Object.entries(contagem)) {
      assert.ok(total > 0, `nenhum <${tag}> em todo o catálogo — o renderizador está engolindo formatação`);
    }
    assert.ok(contagem.strong > 1000, `só ${contagem.strong} <strong> no catálogo inteiro`);
  });

  test('nenhuma descrição real contém controle C0 (prova de "controles-c0-removidos")', () => {
    const comControle = corpus
      .filter((item) => /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(item.valor))
      .map((item) => `${item.arquivo}#${item.caminho}`);
    assert.deepEqual(comControle, [], `descrições com controle C0: ${comControle.slice(0, 5).join(' | ')}`);
  });

  test('a normalização só descarta nós de texto que são apenas quebras de linha (prova de "apenas-quebras-de-linha")', () => {
    const dom = createTestDom();
    const container = dom.document.createElement('div');
    container.appendChild(dom.document.createTextNode('a'));
    container.appendChild(dom.document.createElement('p'));
    container.appendChild(dom.document.createTextNode('   '));
    const normalizado = normalizeDomNode(container);
    // Espaços NÃO são descartados (só "\n"); por isso "a" e "   " continuam.
    assert.deepEqual(normalizado.children, ['a', { tag: 'p', attributes: [], children: [] }, '   ']);
    dom.restore();
  });
});

describe('oráculo de fidelidade: política de diferenças permitidas', () => {
  test('toda normalização tolerada é explícita, justificada e tem prova associada', () => {
    assert.ok(NORMALIZACOES_PERMITIDAS.length > 0, 'a lista não pode ficar vazia sem revisão');
    const provas = new Set(['texto-final-identico', 'apenas-quebras-de-linha', 'nenhum-controle-c0-no-catalogo']);
    for (const item of NORMALIZACOES_PERMITIDAS) {
      assert.ok(item.id && item.o_que && item.por_que, `normalização incompleta: ${JSON.stringify(item)}`);
      assert.ok(item.por_que.length > 80, `${item.id}: justificativa curta demais para ser uma revisão de verdade`);
      assert.ok(provas.has(item.prova), `${item.id}: prova "${item.prova}" não corresponde a nenhum teste deste arquivo`);
    }
  });

  test('MUTAÇÃO: uma regressão real de formatação FALHA a comparação', () => {
    // Sem este teste, "0 divergências" poderia significar apenas que a
    // comparação é frouxa. Aqui um renderizador deliberadamente quebrado
    // (que perde o <strong>, e outro que perde um espaço entre nós) é
    // submetido à MESMA comparação — e tem de ser reprovado.
    const baseline = loadBaselineMdParaHtml();
    const dom = createTestDom();
    const exemplo = corpus.find((item) => item.valor.includes('**') && item.valor.includes('\n'));
    assert.ok(exemplo, 'corpus sem exemplo com negrito para mutar');

    const esperado = JSON.stringify(normalizeHtmlString(dom.document, baseline(exemplo.valor)));

    const semNegrito = normalizeHtmlString(
      dom.document,
      baseline(exemplo.valor).replace(/<\/?strong>/g, ''),
    );
    assert.notEqual(JSON.stringify(semNegrito), esperado, 'perder <strong> passou despercebido');

    const semEspaco = normalizeHtmlString(dom.document, baseline(exemplo.valor).replace('</strong> ', '</strong>'));
    assert.notEqual(JSON.stringify(semEspaco), esperado, 'perder um espaço entre nós passou despercebido');

    dom.restore();
  });
});
