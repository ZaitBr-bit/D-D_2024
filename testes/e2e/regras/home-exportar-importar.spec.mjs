// ============================================================
// Home: Exportar Todos e Importar -- a ida e a volta.
//
// `#btn-exportar` e `#btn-importar` (site/js/pages/home.js) são o único
// backup que o app oferece sem conta na nuvem. Nenhum spec clicava neles:
// a exportação termina num `a.click()` sobre um blob e a importação abre um
// seletor de arquivo do sistema, e os dois só se provam de verdade
// EXERCITANDO o navegador.
//
// A asserção é de ida e volta (round trip), não de formato: exporta um
// personagem com todos os campos preenchidos, apaga o armazenamento,
// importa o arquivo baixado e exige que o objeto restaurado seja
// IDÊNTICO ao original. Um backup que perde um campo pelo caminho não é
// backup -- e comparar o objeto inteiro é o que pega isso, em vez de
// conferir nome e nível à mão.
// ============================================================
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { ATRIBUTOS_REGRAS, NOVO, abrirSite, assentar } from './helpers-regras.mjs';
import { semearPersonagem } from '../helpers.mjs';

const ID = 'regras-exp-imp';

// Campos variados de propósito: texto acentuado, número, array e objeto
// aninhado. Se a serialização estragar algum tipo, a comparação do objeto
// inteiro no fim do teste denuncia.
const SEMENTE = {
  nome: 'Thalia Corvo-de-Prata',
  classe: 'Guerreiro', subclasse: 'Campeão', nivel: 3, xp: 900,
  especie: 'Humano', antecedente: 'Soldado',
  atributos: ATRIBUTOS_REGRAS,
  pericias_proficientes: ['Atletismo', 'Percepção'],
  pv_max: 30, pv_atual: 22, pv_temporario: 4,
  notas: 'Acentuação preservada: ação, ímpeto, cônsul.',
};

/** Lista completa de personagens no armazenamento local. */
async function personagensSalvos(page) {
  return page.evaluate(async () => {
    const store = await import(new URL('./js/store.js', location.href).href);
    return store.listarPersonagens();
  });
}

/** Esvazia o armazenamento local pela API do próprio app. */
async function esvaziarArmazenamento(page) {
  await page.evaluate(async () => {
    const store = await import(new URL('./js/store.js', location.href).href);
    store.atualizarListaLocal([]);
  });
}

test('home: exportar e importar de volta preserva o personagem inteiro', async ({ context }) => {
  const { page, erros } = await abrirSite(context);

  await semearPersonagem(page, SEMENTE, ID);
  // A home já tinha renderizado vazia; recarregar é o que faz os botões de
  // exportar/importar da lista aparecerem.
  await page.goto(NOVO, { waitUntil: 'domcontentloaded' });
  await assentar(page);

  const original = (await personagensSalvos(page))[0];
  expect(original.nome, 'a fixture deveria ter sido semeada').toBe(SEMENTE.nome);

  // ---------- IDA: exportar ----------
  const baixando = page.waitForEvent('download');
  await page.locator('#btn-exportar').click();
  const arquivo = await baixando;
  expect(arquivo.suggestedFilename(),
    'o arquivo exportado deveria ser um .json').toMatch(/^dnd_personagens_\d+\.json$/);

  const conteudo = readFileSync(await arquivo.path(), 'utf-8');
  const exportado = JSON.parse(conteudo);
  expect(Array.isArray(exportado),
    'exportarTodos grava um array de personagens').toBe(true);
  expect(exportado, 'o arquivo deveria conter exatamente o personagem semeado')
    .toEqual([original]);

  // ---------- VOLTA: importar ----------
  // Apagar antes de importar simula o cenário real do backup (aparelho novo,
  // armazenamento limpo) e evita o desvio de `importarPersonagens`, que
  // ignora id já existente.
  await esvaziarArmazenamento(page);
  await page.goto(NOVO, { waitUntil: 'domcontentloaded' });
  await assentar(page);
  await expect(page.locator('.char-card'),
    'depois de esvaziar, a home não deveria listar nada').toHaveCount(0);

  const escolhendo = page.waitForEvent('filechooser');
  await page.locator('#btn-importar').click();
  const seletor = await escolhendo;
  await seletor.setFiles({
    name: arquivo.suggestedFilename(),
    mimeType: 'application/json',
    buffer: Buffer.from(conteudo, 'utf-8'),
  });

  await expect(page.locator('.char-card'),
    'o personagem importado deveria voltar para a lista da home').toHaveCount(1);
  await expect(page.locator('.char-card').first(),
    'o card deveria trazer o nome do personagem importado').toContainText(SEMENTE.nome);

  const restaurado = (await personagensSalvos(page))[0];
  expect(restaurado,
    'a ida e volta deveria devolver o personagem byte a byte igual').toEqual(original);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
