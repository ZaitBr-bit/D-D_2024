// ============================================================
// Domínio Magias, Plano 4: conjuração -- ritual, concentração e círculo
// superior. Fecha o domínio.
//
// Os dois primeiros eixos são confrontados contra `duracao` e
// `tempo_conjuracao` das 391 magias -- campos que o Plano 1 provou baterem
// com o livro em TODAS elas. Isso é o que autoriza este motor a dizer, sem
// hesitar, que quando um marcador derivado do app discorda desses campos é o
// MARCADOR que erra.
//
// O terceiro eixo (círculo superior) não vira lacuna: o app não modela dano
// nem efeito de magia, então não há onde aplicar o upcast. Fica uma guarda de
// tamanho e um limite declarado no README.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { RAIZ, comLacuna } from './harness.mjs';

/** As 391 magias, do acervo primário (truques.json + circulo_1..9.json). */
const MAGIAS = new Map();
for (const arquivo of readdirSync(join(RAIZ, 'dados', 'magias'))) {
  if (!/^(truques|circulo_\d)\.json$/.test(arquivo)) continue;
  const j = JSON.parse(readFileSync(join(RAIZ, 'dados', 'magias', arquivo), 'utf-8'));
  for (const m of (j.magias || j)) MAGIAS.set(m.nome, m);
}

const FONTE_MAGIAS_SHEET = readFileSync(join(RAIZ, 'site', 'js', 'sheet', 'magias.js'), 'utf-8');

// ============================================================
// Eixo 1 -- Concentração: o mapa curado × a magia
// ============================================================
//
// `ehMagiaConcentracao` (sheet/magias.js:900-906) decide com DUAS fontes: o
// mapa curado à mão `MAGIAS_EFEITO` (:772) e, só como fallback, a `duracao`
// da magia. O mapa tem PRECEDÊNCIA -- então uma entrada errada nele vence o
// dado correto.
//
// A extração é textual porque o mapa é um literal não exportado. Mesmo
// padrão de gatilhos-ui-cobertos.test.mjs e recursos-restaurados.test.mjs,
// que já leem site/js/ como texto.

/**
 * Entradas de MAGIAS_EFEITO cujo nome não é uma magia do catálogo: são
 * sub-efeitos nomeados (variações de uma magia, com o efeito no próprio
 * nome). Exceção com motivo escrito -- exceção sem motivo é lacuna
 * disfarçada.
 */
const NAO_SAO_MAGIAS = {
  'Escudo Frio (Resist. Ígneo, dano 2d8 Gélido)':
    'Sub-efeito nomeado da magia Escudo Ardente, não uma magia do catálogo: o nome carrega a ' +
    'variação de resistência e dano. Não há entrada correspondente em dados/magias/ para ' +
    'confrontar.',
  'Escudo Quente (Resist. Gélido, dano 2d8 Ígneo)':
    'A outra metade do par acima -- a variação oposta de Escudo Ardente. Só apareceu depois de ' +
    'consertar o extrator: a versão anterior, que delimitava o corpo da entrada com `[^}]*`, ' +
    'parava no primeiro `}` e não chegava a enxergá-la.',
};

/** Lê as entradas de MAGIAS_EFEITO e a flag `concentracao` de cada uma. */
function lerMagiasEfeito() {
  const ini = FONTE_MAGIAS_SHEET.indexOf('MAGIAS_EFEITO =');
  if (ini === -1) return [];
  const bloco = FONTE_MAGIAS_SHEET.slice(ini, FONTE_MAGIAS_SHEET.indexOf('\n};', ini));
  const saida = [];
  // O corpo de cada entrada é delimitado por CONTAGEM DE CHAVES, não por
  // `[^}]*`: várias entradas têm objetos aninhados (`efeitos: [{ tipo: ... }]`)
  // e parar no primeiro `}` cortava o corpo antes do `concentracao`. A primeira
  // versão deste extrator fazia isso e acusou quatro magias de não exigirem
  // Concentração quando o código dizia o contrário -- quatro falsos positivos
  // que quase viraram "conserto" de um dado que estava certo.
  for (const m of bloco.matchAll(/^\s*'([^']+)':\s*\{/gm)) {
    let i = m.index + m[0].length;
    let profundidade = 1;
    while (i < bloco.length && profundidade > 0) {
      if (bloco[i] === '{') profundidade++;
      else if (bloco[i] === '}') profundidade--;
      i++;
    }
    const corpo = bloco.slice(m.index + m[0].length, i - 1);
    saida.push({ nome: m[1], concentracao: /concentracao:\s*true/.test(corpo) });
  }
  return saida;
}

const MAGIAS_EFEITO = lerMagiasEfeito();

test('sanity: o extrator encontra as entradas de MAGIAS_EFEITO', () => {
  assert.ok(MAGIAS_EFEITO.length >= 40,
    `o extrator achou ${MAGIAS_EFEITO.length} entradas de MAGIAS_EFEITO -- o pré-voo mediu 50. ` +
    `Um extrator que deixa de casar faz a asserção seguinte passar por vacuidade`);
});

test('toda entrada de NAO_SAO_MAGIAS existe em MAGIAS_EFEITO e tem motivo', () => {
  const nomes = new Set(MAGIAS_EFEITO.map((e) => e.nome));
  for (const [nome, motivo] of Object.entries(NAO_SAO_MAGIAS)) {
    assert.ok(nomes.has(nome), `exceção declarada para entrada inexistente: ${nome}`);
    assert.ok(motivo && motivo.length > 40, `${nome}: exceção sem motivo escrito`);
  }
});

test('concentração: o mapa MAGIAS_EFEITO × a duração da magia', () => {
  const corpo = () => {
    const divergentes = [];
    for (const entrada of MAGIAS_EFEITO) {
      if (NAO_SAO_MAGIAS[entrada.nome]) continue;
      const magia = MAGIAS.get(entrada.nome);
      if (!magia) {
        divergentes.push(`${entrada.nome}: em MAGIAS_EFEITO e não em dados/magias/ ` +
          `(se for sub-efeito, declare em NAO_SAO_MAGIAS com o motivo)`);
        continue;
      }
      const pelaDuracao = /concentra/i.test(magia.duracao || '');
      if (entrada.concentracao !== pelaDuracao) {
        divergentes.push(`${entrada.nome}: MAGIAS_EFEITO diz concentracao=${entrada.concentracao}, ` +
          `duracao="${magia.duracao}"`);
      }
    }
    assert.deepEqual(divergentes, [],
      `MAGIAS_EFEITO (sheet/magias.js:772) contradiz a duração da própria magia. O mapa tem ` +
      `PRECEDÊNCIA sobre a duração em ehMagiaConcentracao (:900-906), então o erro vence: ` +
      `${divergentes.join(' | ')}`);
  };
  corpo();
});

// ============================================================
// Eixo 2 -- Ritual
// ============================================================
//
// Magias.md:62 -- "A magia pode ser conjurada conforme as regras normais de
// conjuração ou como um Ritual. A versão Ritual (...) não utiliza um espaço
// de magia."
//
// A segunda asserção deste bloco é sobre o CÓDIGO, não sobre o dado -- mesma
// natureza de gatilhos-ui-cobertos.test.mjs. Ela pergunta se existe alguma
// rota de conjuração ritual que não seja a de magia PERSONALIZADA.

const RITUAIS_DO_LIVRO = [...MAGIAS.values()]
  .filter((m) => /ritual/i.test(m.tempo_conjuracao || ''))
  .map((m) => m.nome);

test('sanity: o catálogo tem as 31 magias com marcador Ritual', () => {
  assert.equal(RITUAIS_DO_LIVRO.length, 31,
    `esperadas 31 magias com Ritual em tempo_conjuracao, achadas ${RITUAIS_DO_LIVRO.length}. ` +
    `Sem essa guarda, a asserção seguinte passaria por vacuidade se o acervo mudasse`);
});

/** Lista todo arquivo .js sob site/js/. */
function listarJs(dir) {
  const saida = [];
  for (const entrada of readdirSync(dir)) {
    const caminho = join(dir, entrada);
    if (statSync(caminho).isDirectory()) saida.push(...listarJs(caminho));
    else if (entrada.endsWith('.js')) saida.push(caminho);
  }
  return saida;
}

// A VARREDURA ANTERIOR ERA ESTREITA DEMAIS, e o registro original desta
// lacuna saiu forte demais por causa disso: ela procurava só
// `data-conjurar-ritual*` e concluiu que "não há rota de ritual para magia do
// catálogo em lugar nenhum". Havia meia rota -- o botão "Ritual" do grimório
// do Mago (sheet/magias.js), rotulado "Conjurar como Ritual (sem gastar
// espaço)", estava ligado ao gatilho `data-conjurar-pacto`, cujo handler
// (sheet/habilidades.js) só emite um toast dizendo "via Pacto". O padrão da
// busca não previa que a rota certa pudesse ter o NOME errado.
//
// Por isso o segundo teste procura pelo TÍTULO do botão, e não pelo gatilho:
// é o texto que o jogador lê, e ele não muda quando o gatilho muda.
const RE_BOTAO_RITUAL = /title="Conjurar como Ritual[^"]*"/;

test('ritual: existe rota de conjuração ritual para magia do catálogo', () => {
  const rotas = [];
  for (const caminho of listarJs(join(RAIZ, 'site', 'js'))) {
    const texto = readFileSync(caminho, 'utf-8');
    for (const m of texto.matchAll(/data-conjurar-ritual(-[a-z]+)?/g)) {
      rotas.push({
        arquivo: relative(RAIZ, caminho).replace(/\\/g, '/'),
        gatilho: m[0],
        personalizada: m[1] === '-custom',
      });
    }
  }
  const doCatalogo = rotas.filter((r) => !r.personalizada);
  assert.ok(doCatalogo.length > 0,
    `o livro (Magias.md:62) permite conjurar como Ritual sem gastar espaço de magia, e ` +
    `${RITUAIS_DO_LIVRO.length} magias do catálogo têm o marcador. Toda rota de conjuração ` +
    `ritual encontrada em site/js/ é de magia PERSONALIZADA (sufixo -custom): ` +
    `${[...new Set(rotas.map((r) => `${r.arquivo} (${r.gatilho})`))].join(', ')}`);
});

test('ritual: nenhum botão de Ritual está ligado a um gatilho de outra coisa', () => {
  const desligados = [];
  for (const caminho of listarJs(join(RAIZ, 'site', 'js'))) {
    const texto = readFileSync(caminho, 'utf-8');
    const arquivo = relative(RAIZ, caminho).replace(/\\/g, '/');
    for (const linha of texto.split('\n')) {
      if (!RE_BOTAO_RITUAL.test(linha)) continue;
      if (!/data-conjurar-ritual/.test(linha)) {
        desligados.push(`${arquivo}: ${linha.trim().slice(0, 120)}`);
      }
    }
  }
  assert.deepEqual(desligados, [],
    `botão rotulado "Conjurar como Ritual" ligado a um gatilho que não é de ritual. Foi assim ` +
    `que o botão do grimório do Mago passou despercebido: ele dizia Ritual e chamava o handler ` +
    `do Pacto do Bruxo, que só emite um toast "via Pacto" e não conjura nada: ` +
    `${desligados.join(' | ')}`);
});

// ============================================================
// Eixo 3 -- círculo superior: guarda de tamanho, sem lacuna
// ============================================================
//
// LIMITE DECLARADO: o app não modela dano nem efeito de magia, então não há
// onde "aplicar" o upcast -- os quatro consumidores de `circulo_superior`
// (creator/passo-magias.js:604, levelup-ui.js:1394, opcoes-dominio.js:41-42)
// apenas EXIBEM o texto, e isso está correto para o que o app se propõe a
// ser. Cobrar aplicação aqui seria inventar escopo.
//
// O que sobra de confrontável é o dado não sumir.

test('círculo superior: 154 magias trazem o texto de upcast', () => {
  const comUpcast = [...MAGIAS.values()].filter((m) => (m.circulo_superior || '').trim());
  assert.equal(comUpcast.length, 154,
    `esperadas 154 magias com \`circulo_superior\` preenchido, achadas ${comUpcast.length} -- ` +
    `se o número caiu, alguma edição apagou o texto que as telas exibem`);
});
