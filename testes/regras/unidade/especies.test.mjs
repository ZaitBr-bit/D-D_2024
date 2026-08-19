// ============================================================
// Domínio Espécies: as 10 do livro confrontadas com o app.
//
// Grupo 1 -- higiene: bijeção com dados/origens/especies.json, e toda entrada
// do catálogo citando o livro.
// Grupo 2 -- campos de cabeçalho: getTamanho/getDeslocamento (funções puras de
// site/js/utils.js) contra o que o livro declara, varredura exaustiva das 10,
// sem amostragem.
// Grupo 3 -- traços que só chegam num nível: TESTE CONVERSO, no mesmo espírito
// do que achou o "Ladino nível 6".
// Grupo 4 -- as 5 escolhas de linhagem.
//
// Kenku NÃO é validada: o livro não a tem (ver FORA_DO_LIVRO no catálogo),
// então não existe texto de livro para confrontar. Ela é EXIGIDA em `dados/`
// pela bijeção do Grupo 1, para "o app tem uma espécie a mais que o livro"
// ficar visível em vez de silenciosamente tolerado.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { modulosApp, RAIZ } from './harness.mjs';
import { ESPECIES, FORA_DO_LIVRO, TRACOS_POR_NIVEL, ESCOLHAS_LINHAGEM } from '../catalogo/especies.mjs';

const { utils, levelup } = await modulosApp();
const LIVRO = readFileSync(join(RAIZ, 'Informacoes Separadas', 'Espécies.md'), 'utf-8');
const DADOS = JSON.parse(readFileSync(join(RAIZ, 'dados', 'origens', 'especies.json'), 'utf-8'));
const POR_NOME = new Map((DADOS.especies || DADOS).map((e) => [e.nome, e]));

// ============================================================
// Grupo 1 -- higiene
// ============================================================

test('bijeção: dados/ traz as 10 do livro mais exatamente as declaradas fora dele', () => {
  const noApp = [...POR_NOME.keys()].sort();
  const esperado = [...ESPECIES.map((e) => e.nome), ...FORA_DO_LIVRO.map((e) => e.nome)].sort();
  assert.deepEqual(noApp, esperado,
    'dados/origens/especies.json divergiu do catálogo. Espécie a mais precisa entrar em ' +
    'FORA_DO_LIVRO com o motivo escrito; espécie a menos é regressão do dado');
});

test('sanity: o catálogo transcreve as 10 espécies e os 49 traços do livro', () => {
  assert.equal(ESPECIES.length, 10,
    'o livro apresenta dez espécies (Livro do Jogador:8554) -- o catálogo tem outro número');
  const total = ESPECIES.reduce((n, e) => n + e.tracos.length, 0);
  assert.equal(total, 49,
    `esperados 49 traços somando as 10 espécies, o catálogo tem ${total}`);
});

for (const e of ESPECIES) {
  test(`higiene: ${e.nome} cita o livro e existe em dados/`, () => {
    assert.ok(POR_NOME.has(e.nome), `${e.nome} não existe em dados/origens/especies.json`);
    assert.match(e.livro, /^Espécies\.md:\d+$/, `${e.nome}: citação malformada`);
    assert.ok(e.tracos.length > 0, `${e.nome} sem traço nenhum`);
    for (const t of e.tracos) {
      assert.match(t.livro, /^Espécies\.md:\d+$/, `${e.nome}/${t.nome}: citação malformada`);
    }
  });

  test(`higiene: os traços de ${e.nome} batem com dados/`, () => {
    const noApp = (POR_NOME.get(e.nome)?.tracos || []).map((t) => t.nome || t);
    assert.deepEqual([...e.tracos.map((t) => t.nome)].sort(), [...noApp].sort(),
      `${e.nome}: os traços do catálogo e os de dados/origens/especies.json divergiram`);
  });

  test(`higiene: as citações de ${e.nome} apontam para linhas reais do livro`, () => {
    const linhas = LIVRO.split('\n');
    for (const t of e.tracos) {
      const n = Number(t.livro.split(':')[1]);
      const linha = linhas[n - 1] || '';
      assert.ok(linha.includes(t.nome),
        `${e.nome}/${t.nome}: ${t.livro} aponta para "${linha.slice(0, 60)}", que não contém o nome`);
    }
  });
}

test('toda entrada de FORA_DO_LIVRO tem motivo escrito', () => {
  for (const e of FORA_DO_LIVRO) {
    assert.ok(e.motivo && e.motivo.length > 40,
      `${e.nome}: FORA_DO_LIVRO exige um motivo que explique por que não dá para validar`);
  }
});

test('sanity: o texto do livro contém as 10 seções que o catálogo cita', () => {
  for (const e of ESPECIES) {
    assert.ok(LIVRO.includes(`### Traços de ${e.nome}`),
      `${e.nome}: seção "### Traços de ${e.nome}" não existe em Espécies.md -- a citação do ` +
      `catálogo aponta para um lugar que mudou`);
  }
});

// ============================================================
// Grupo 2 -- campos de cabeçalho
// ============================================================

for (const e of ESPECIES) {
  test(`cabeçalho: ${e.nome} — tamanho e deslocamento × livro`, (t) => {
    const texto = POR_NOME.get(e.nome)?.texto_completo || '';

    const tamanhoApp = utils.getTamanho(texto);
    assert.equal(tamanhoApp, e.tamanho,
      `${e.nome} (${e.livro}): o livro declara Tamanho "${e.tamanho}" e getTamanho devolveu ` +
      `"${tamanhoApp}"`);

    if (e.deslocamento === null) {
      // LIMITE DECLARADO: a ausência é do LIVRO, não do app. Afirmar qualquer
      // coisa aqui exigiria inventar o valor do livro para comparar.
      t.skip(`${e.nome}: o livro não declara Deslocamento (conferido em Espécies.md e no PHB ` +
        `completo) -- não há valor de livro para confrontar. O app devolve ` +
        `"${utils.getDeslocamento(texto)}" pelo padrão de getDeslocamento (utils.js:431).`);
      return;
    }
    const deslocApp = utils.getDeslocamento(texto);
    assert.equal(deslocApp, e.deslocamento,
      `${e.nome} (${e.livro}): o livro declara Deslocamento "${e.deslocamento}" e ` +
      `getDeslocamento devolveu "${deslocApp}"`);
  });
}

// ============================================================
// Grupo 3 -- traços que só chegam num nível
// ============================================================
//
// A asserção é sobre a UNIÃO dos mecanismos, nunca sobre um deles. O app tem
// DOIS caminhos para entregar um traço com nível:
//   1. `obterCaracteristicasEspecieNivel` (site/js/levelup.js:728) -- anuncia o
//      traço na tela de subida de nível. Ramos hard-coded por NOME DE ESPÉCIE.
//   2. o filtro por nível de `renderSecaoTracosEspecie`
//      (site/js/sheet/caracteristicas.js:199-203) -- regex sobre a descrição
//      ("A partir do nível N" / "No nível N"), que esconde o traço antes do
//      nível e o mostra a partir dele.
//
// Exigir o mecanismo 1 mediria ARQUITETURA em vez de comportamento -- o erro
// nº 1 do GUIA-PROXIMOS-DOMINIOS.md, que já gerou 31 lacunas falsas na rodada
// de Talentos. Foi o que a primeira versão deste grupo fez, e ela acusou o Voo
// Dracônico como ausente quando ele chega ao jogador pelo caminho 2.

/** Regex de nível que o filtro da ficha usa (caracteristicas.js:201). */
const NIVEL_NA_DESCRICAO = /(?:a partir do |no )n[ií]vel (\d+)/i;

/**
 * O traço chega ao jogador neste nível, por QUALQUER um dos dois caminhos?
 * Devolve os dois separados para o chamador poder distingui-los.
 */
async function entregueNoNivel(especie, nome, nivel) {
  const anunciado = (await levelup.obterCaracteristicasEspecieNivel(especie, nivel, []))
    .some((c) => c.nome === nome);
  const traco = (POR_NOME.get(especie)?.tracos || []).find((t) => (t.nome || t) === nome);
  const m = traco?.descricao?.match(NIVEL_NA_DESCRICAO);
  const naFicha = m ? nivel >= Number(m[1]) : false;
  return { anunciado, naFicha };
}

for (const t of TRACOS_POR_NIVEL) {
  test(`traço por nível: ${t.especie} — ${t.nome} chega ao jogador no nível ${t.nivel}`, async () => {
    const { anunciado, naFicha } = await entregueNoNivel(t.especie, t.nome, t.nivel);
    assert.ok(anunciado || naFicha,
      `${t.especie} nv${t.nivel} (${t.livro}): o livro concede "${t.nome}" neste nível, e nenhum ` +
      `dos dois caminhos do app o entrega -- nem o anúncio da subida de nível nem o filtro da ficha`);
  });

  test(`traço por nível: ${t.especie} — ${t.nome} não chega antes do nível ${t.nivel}`, async () => {
    const cedo = [];
    for (let n = 1; n < t.nivel; n++) {
      const { anunciado, naFicha } = await entregueNoNivel(t.especie, t.nome, n);
      if (anunciado || naFicha) cedo.push(n);
    }
    assert.deepEqual(cedo, [],
      `${t.especie}: "${t.nome}" é do nível ${t.nivel} (${t.livro}), mas o app já o entrega em ` +
      `${JSON.stringify(cedo)}`);
  });
}

// ------------------------------------------------------------
// Coerência do ANÚNCIO -- não é alegação do livro
// ------------------------------------------------------------
//
// O livro não manda o app avisar nada; ele diz o que o personagem ganha, e é
// isso que o Grupo 3 acima confronta. Esta asserção é sobre COERÊNCIA INTERNA:
// dos três traços com nível, o app anuncia dois na tela de subida de nível
// (Revelação Celestial, Forma Grande) e cala sobre o terceiro. Quem joga um
// Draconato chega ao nível 5 sem nenhum aviso de que ganhou voo -- só descobre
// se abrir a ficha e reparar num traço novo.
//
// Por não ter frase do livro para citar, uma falha aqui NÃO é
// 'app-diverge-do-livro'. Ver o `tipo` da entrada em lacunas-conhecidas.mjs.

for (const t of TRACOS_POR_NIVEL) {
  test(`coerência do anúncio: ${t.especie} — ${t.nome} é anunciado na subida de nível`, async () => {
    const corpo = async () => {
      const { anunciado } = await entregueNoNivel(t.especie, t.nome, t.nivel);
      assert.ok(anunciado,
        `${t.especie} nv${t.nivel}: o traço "${t.nome}" chega ao jogador (o Grupo 3 confirma), ` +
        `mas obterCaracteristicasEspecieNivel não o anuncia -- os outros traços com nível são ` +
        `anunciados, e este não`);
    };
    await corpo();
  });
}

// Sem mapa de causas: os três traços com nível são anunciados desde
// 2026-08-18, quando os `if` por nome de espécie de
// obterCaracteristicasEspecieNivel viraram uma varredura sobre o dado.

// ============================================================
// Grupo 4 -- escolhas de linhagem
// ============================================================
//
// Cinco traços mandam escolher uma opção de uma tabela do livro, e a escolha
// muda o que o personagem ganha. Duas delas (Linhagem Élfica, Legado Ínfero)
// também concedem magia nos níveis 3 e 5, por MAGIAS_LEGADO_ESPECIE
// (site/js/levelup.js:705).

for (const esc of ESCOLHAS_LINHAGEM) {
  test(`linhagem: as opções de ${esc.traco} (${esc.especie}) aparecem no texto do app`, () => {
    const texto = POR_NOME.get(esc.especie)?.texto_completo || '';
    const ausentes = esc.opcoes.filter((o) => !texto.includes(o));
    assert.deepEqual(ausentes, [],
      `${esc.especie}/${esc.traco} (${esc.livro}): o livro oferece ${esc.opcoes.length} opções e ` +
      `o texto_completo de dados/ não menciona ${JSON.stringify(ausentes)}`);
  });

  if (!esc.magiasPorNivel) continue;

  test(`linhagem: a tabela de magias de ${esc.traco} × livro`, () => {
    const tabelaApp = levelup.MAGIAS_LEGADO_ESPECIE?.[esc.especie] || {};
    for (const [opcao, porNivel] of Object.entries(esc.magiasPorNivel)) {
      for (const [nivel, magia] of Object.entries(porNivel)) {
        assert.equal(tabelaApp[opcao]?.[nivel], magia,
          `${esc.especie}/${opcao} nv${nivel} (${esc.livro}): o livro concede "${magia}" e ` +
          `MAGIAS_LEGADO_ESPECIE tem "${tabelaApp[opcao]?.[nivel]}"`);
      }
    }
  });

  test(`linhagem: as magias de ${esc.traco} chegam pela subida de nível`, async () => {
    for (const [opcao, porNivel] of Object.entries(esc.magiasPorNivel)) {
      for (const nivel of [3, 5]) {
        const entregue = (await levelup.obterCaracteristicasEspecieNivel(esc.especie, nivel, [opcao]))
          .map((c) => `${c.nome} ${c.descricao || ''}`).join(' ');
        assert.ok(entregue.includes(porNivel[nivel]),
          `${esc.especie}/${opcao} nv${nivel} (${esc.livro}): obterCaracteristicasEspecieNivel ` +
          `não entregou "${porNivel[nivel]}" -- entregou "${entregue.slice(0, 120)}"`);
      }
    }
  });
}
