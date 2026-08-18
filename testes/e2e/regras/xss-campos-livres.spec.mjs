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
import { abrirFicha, abrirSite, ATRIBUTOS_REGRAS } from './helpers-regras.mjs';
import { semearPersonagem, assentar } from '../helpers.mjs';

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

// A FOTO tambem e campo livre. `char.imagem` guarda um data URL, mas nada
// impede que uma ficha importada traga texto arbitrario ali -- e ele cai
// dentro de `src="..."`, que quebra com uma aspa. Este vetor NAO estava
// nos alertas do CodeQL nem na primeira rodada de correcoes: apareceu ao
// procurar o que o proprio alerta #7 ainda enxergava.
//
// O pior dos quatro lugares e a TELA INICIAL: a lista de personagens
// desenha o avatar de cada um. Nao e preciso nem abrir a ficha -- basta
// importar e voltar para a home.
const CARGA_SRC = 'x" onerror="window.__xss=(window.__xss||0)+1" data-x="';

const SEMENTE_FOTO = {
  nome: 'Retratado',
  classe: 'Guerreiro',
  nivel: 3,
  atributos: ATRIBUTOS_REGRAS,
  imagem: CARGA_SRC,
};

test('home: foto de personagem importado nao escapa do atributo src', async ({ context }) => {
  const { page } = await abrirSite(context);
  await semearPersonagem(page, SEMENTE_FOTO, 'regras-xss-foto');
  await page.goto(page.url().split('#')[0] + '#home', { waitUntil: 'domcontentloaded' });
  await assentar(page);

  const { scriptRodou } = await medirInjecao(page);
  expect(scriptRodou, 'a foto executou script na lista da tela inicial').toBeNull();
  expect(await page.locator('[onerror]').count(), 'a injecao criou um onerror no DOM').toBe(0);
});

test('ficha: foto de personagem importado nao escapa do atributo src', async ({ context }) => {
  const { page } = await abrirFicha(context, SEMENTE_FOTO, 'regras-xss-foto-ficha');

  const { scriptRodou } = await medirInjecao(page);
  expect(scriptRodou, 'a foto executou script ao abrir a ficha').toBeNull();
  expect(await page.locator('[onerror]').count(), 'a injecao criou um onerror no DOM').toBe(0);
});

// O caminho que o CodeQL mostrou no alerta #7 terminava aqui:
// `descreverCapacidadeCarga` monta uma frase que vai para innerHTML, e o
// TAMANHO entrava cru nela. O tamanho sai do valor de um <select> -- texto
// do DOM --, entao a frase carregava o que estivesse ali.
//
// A forca ja era saneada por parseInt; so o tamanho nao era. O teste
// exercita a funcao direto, no navegador, porque chegar ao passo 7 do
// criador exige percorrer o assistente inteiro, e o que importa provar e
// da funcao, nao da tela.
test('capacidade de carga: tamanho de origem duvidosa nao vira marcacao', async ({ context }) => {
  const { page } = await abrirSite(context);

  const frases = await page.evaluate(async () => {
    const utils = await import(new URL('./js/utils.js', location.href).href);
    return [
      utils.descreverCapacidadeCarga(15, '<img src=x onerror="window.__xss=1">'),
      utils.descreverCapacidadeCarga(15, '" onmouseover="window.__xss=1'),
      utils.descreverCapacidadeCarga('<b>15</b>', 'Grande'),
      utils.descreverCapacidadeCarga(15, 'Grande'),
    ];
  });

  for (const frase of frases.slice(0, 3)) {
    expect(frase, `a frase carregou marcacao: ${frase}`).not.toMatch(/[<>]/);
  }
  // O caso legitimo continua intacto -- sanear nao pode virar apagar.
  expect(frases[3]).toContain('Grande');
  expect(frases[3]).toContain('Força 15');
});

// O caminho completo do alerta #7 (Steps 1 a 11) terminava em DOIS pontos,
// e a primeira correcao pegou so um deles: `descreverCapacidadeCarga`. O
// outro era o proprio `${tamanhoFixo}` no card de Tamanho da Criatura,
// montado ANTES do template principal -- e por isso fora da varredura que
// eu tinha feito, que comecava na linha do `el.innerHTML`.
//
// A fonte e a mesma dos dois: `personagem.tamanho`, gravado a partir de
// `tamanhoSel.value` (radio marcado). Texto do DOM voltando para HTML.
//
// O passo 7 e renderizado aqui isoladamente, com `renderStepDetalhes(el)`
// num container proprio: percorrer os sete passos do assistente para
// chegar nesta tela custaria minutos e testaria o driver, nao o escape.
test('criador: tamanho da criatura nao vira marcacao no card', async ({ context }) => {
  const { page } = await abrirSite(context);

  const resultado = await page.evaluate(async () => {
    const wizard = await import(new URL('./js/creator/wizard.js', location.href).href);
    const passo = await import(new URL('./js/creator/passo-detalhes.js', location.href).href);
    const store = await import(new URL('./js/store.js', location.href).href);

    const p = store.criarPersonagemVazio();
    p.especie = 'Humano';
    p.classe = 'Guerreiro';
    p.tamanho = '"><img src=x onerror="window.__xss=(window.__xss||0)+1">';
    wizard.definirPersonagem(p);

    const el = document.createElement('div');
    document.body.appendChild(el);
    passo.renderStepDetalhes(el);

    return {
      scriptRodou: window.__xss ?? null,
      tagsInjetadas: el.querySelectorAll('img[src="x"], [onerror]').length,
      // o valor tem de continuar visivel como texto
      mostraTexto: el.textContent.includes('<img src=x'),
    };
  });

  expect(resultado.scriptRodou, 'o tamanho executou script no card').toBeNull();
  expect(resultado.tagsInjetadas, 'a carga virou tag no card de tamanho').toBe(0);
  expect(resultado.mostraTexto, 'o valor sumiu da tela em vez de virar texto').toBe(true);
});
