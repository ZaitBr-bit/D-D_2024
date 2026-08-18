// ============================================================
// Campo livre de personagem NUNCA pode virar HTML.
//
// Por que isto e um teste de seguranca de verdade, e nao "self-XSS de
// quem digita besteira na propria ficha": fichas CIRCULAM. O README
// ensina a exportar o personagem e passar adiante, o formulario de bug
// pede o arquivo exportado em anexo, e ha sincronizacao em nuvem. Uma
// ficha preparada por terceiro executa script na sessao de quem abrir --
// sessao essa que tem o Firestore da vitima autenticado.
//
// Os sinks cobertos aqui foram encontrados por leitura, nao pelo CodeQL:
// ele apontou `creator/passo-detalhes.js` e `utils.js`, mas passou batido
// por `sheet/detalhes.js`, que e o pior dos tres -- renderiza SETE campos
// livres (`${char[c.key]}`) direto no innerHTML da ficha, no caminho que
// abre sozinho ao clicar num personagem importado.
//
// A carga usa `onerror` em <img src=x> porque ela dispara sozinha, sem
// interacao: se o HTML for interpretado, `window.__xss` incrementa antes
// do teste terminar. Duas asserçoes independentes, porque cada uma pega
// um jeito diferente de errar:
//   1. `window.__xss` continua indefinido  -> nenhum script rodou;
//   2. nenhum <img src="x"> no DOM         -> a tag nem chegou a existir
//      (pega o caso de a tag ser criada mas o onerror nao disparar a
//      tempo -- o teste passaria pela asserçao 1 e mentiria).
// E uma terceira, positiva: o texto tem de aparecer LITERAL na tela. Sem
// ela, apagar o campo inteiro tambem passaria, e "sumiu com os dados do
// usuario" nao e correcao.
// ============================================================
import { test, expect } from '@playwright/test';
import { abrirFicha, ATRIBUTOS_REGRAS } from './helpers-regras.mjs';

// `src=x` falha a carregar em qualquer navegador, entao `onerror` dispara
// imediatamente. O texto visivel (XSS-MARCA) serve para a asserçao
// positiva de que o conteudo foi preservado como texto.
const CARGA = '<img src=x onerror="window.__xss=(window.__xss||0)+1">XSS-MARCA';
// Quebra de atributo: fecha o `value="` e injeta um handler que dispara
// sozinho ao ganhar foco. E o vetor especifico de `value="${...}"`.
const CARGA_ATRIBUTO = '" autofocus onfocus="window.__xss=(window.__xss||0)+1';

/** Le os dois indicadores de injecao de uma vez, direto da pagina. */
async function medirInjecao(page) {
  return page.evaluate(() => ({
    scriptRodou: window.__xss ?? null,
    tagsInjetadas: document.querySelectorAll('img[src="x"]').length,
  }));
}

test('ficha: campos livres de um personagem importado nao viram HTML', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    nome: `Heroi ${CARGA}`,
    classe: 'Guerreiro',
    nivel: 3,
    atributos: ATRIBUTOS_REGRAS,
    // Os sete campos de `renderSecaoDetalhes`, todos livres.
    aparencia: CARGA,
    personalidade: CARGA,
    ideais: CARGA,
    lacos: CARGA,
    defeitos: CARGA,
    historia_personagem: CARGA,
    notas: CARGA,
  });

  const { scriptRodou, tagsInjetadas } = await medirInjecao(page);
  expect(scriptRodou, 'um campo livre executou script ao abrir a ficha').toBeNull();
  expect(tagsInjetadas, 'a carga virou tag <img> de verdade no DOM').toBe(0);

  // Asserçao positiva: escapar nao pode virar apagar.
  await expect(
    page.locator('#app-content'),
    'o texto do campo deveria continuar visivel, so que como texto'
  ).toContainText('XSS-MARCA');

  expect(erros, `erros de console/pagina: ${erros.join('; ')}`).toEqual([]);
});

test('ficha: nome e descricao de item personalizado nao viram HTML', async ({ context }) => {
  const { page } = await abrirFicha(context, {
    nome: 'Portador',
    classe: 'Guerreiro',
    nivel: 3,
    atributos: ATRIBUTOS_REGRAS,
    inventario: [{
      nome: `Espada ${CARGA}`,
      tipo: 'customizado',
      quantidade: 1,
      equipado: false,
      descricao: CARGA,
      dados: { bonus_ca: 0, dano: '1d8', bonus_ataque: 0 },
    }],
  }, 'regras-xss-item');

  const { scriptRodou, tagsInjetadas } = await medirInjecao(page);
  expect(scriptRodou, 'um item personalizado executou script na ficha').toBeNull();
  expect(tagsInjetadas, 'a carga do item virou tag <img> no DOM').toBe(0);
});

test('ficha: carga que quebra atributo nao escapa do value', async ({ context }) => {
  const { page } = await abrirFicha(context, {
    nome: `Heroi ${CARGA_ATRIBUTO}`,
    classe: 'Guerreiro',
    nivel: 3,
    atributos: ATRIBUTOS_REGRAS,
    notas: CARGA_ATRIBUTO,
  }, 'regras-xss-atributo');

  // Abrir a edicao da ficha, onde os campos voltam para dentro de
  // `value="..."` -- e onde a carga de quebra de atributo se paga.
  await page.locator('#btn-edit-detalhes, [id^="btn-edit"]').first().click().catch(() => {});
  await page.waitForTimeout(300);

  const { scriptRodou } = await medirInjecao(page);
  expect(scriptRodou, 'a carga escapou do atributo value e executou').toBeNull();

  // Nenhum elemento pode ter ganhado o handler injetado.
  const comHandler = await page.locator('[onfocus]').count();
  expect(comHandler, 'a injecao criou um atributo onfocus no DOM').toBe(0);
});
