// ============================================================
// Conjurador Ritualista: a QUANTIDADE de magias rituais oferecida pelo
// ASSISTENTE de subida de nível tem de ser o Bônus de Proficiência do
// nível em que o talento é efetivamente adquirido -- o nível NOVO, não o
// nível de antes de subir. `Talentos.md:372` ("Escolha um número de
// magias de 1º círculo igual ao seu Bônus de Proficiência") descreve o
// personagem DEPOIS de terminar a subida, não antes.
//
// DUAS RODADAS DE DEFEITO, NENHUMA PEGA POR ORÁCULO ANTES DESTE ARQUIVO
// -----------------------------------------------------------------------
// Rodada 1 (site/js/levelup-ui.js, formula original): `Math.floor(nivel/4)
// + 2`, uma cópia à mão da regra do livro que divergia de
// `bonusProficiencia` (utils.js) nos níveis 4/8/12/16/20 -- ex.: nível 4
// dava 3 rituais, o livro dá 2.
//
// Rodada 2 (a "correção" da rodada 1): trocar a fórmula copiada por
// `bonusProficiencia(ctx.char.nivel)` parecia resolver -- mas
// `ctx.char.nivel`, DENTRO DO ASSISTENTE de subida de nível, é o nível
// ANTES de subir (a subida só é aplicada no confirmar, bem depois desta
// tela). Isso é inalcançável em classe ÚNICA: os níveis de talento
// (4/6/8/10/12/14/16/19) têm nível ANTERIOR sempre fora de múltiplo de 4,
// e `bonusProficiencia` não muda dentro desses saltos -- as duas versões
// SEMPRE concordam ali (caso A abaixo). Mas em MULTICLASSE, ASI é por
// nível DE CLASSE e `ctx.char.nivel` é o TOTAL: um Guerreiro 5/Mago 3
// subindo o Mago para 4 cruza o nível total 8 -> 9 (Bônus de Proficiência
// 3 -> 4) sem que 8 seja múltiplo de 4 -- só o nível NOVO (9) é. A rodada
// 2 dava 3 rituais onde o livro dá 4 (caso B abaixo).
//
// A correção final (rodada 3) usa `bonusProficiencia(ctx.nivelNovo)`, SEM
// fallback -- `ctx.nivelNovo` passou a ser GARANTIDO por todo chamador de
// `bindEscolhasTalento`: o assistente de subida já o tinha
// (`buildLevelUpContext`), e os outros dois -- "+ Talento" da ficha e
// recuperação de Dádiva Épica (`site/js/sheet/talentos.js`) -- passaram a
// preencher `nivelNovo: char.nivel` explicitamente no ctx mínimo que
// montam, porque ali não há subida em andamento e o nível atual já é o
// nível de aquisição.
//
// POR QUE ESTE ARQUIVO É NECESSÁRIO
// -------------------------------------
// `talento-conjurador-ritualista.spec.mjs` já dirige o assistente de
// subida (nível 3 -> 4) e o "+ Talento" da ficha, mas nunca afirma A
// QUANTIDADE -- escolhe exatamente 2 magias e nunca lê o rótulo "Selecione
// N" nem o contador "Selecionadas: X/N". Com `max` maior que 2 (a rodada 1
// oferecia até 3 no nível 4), escolher 2 continua funcionando sem erro
// nenhum -- por isso a suíte inteira ficou verde nas duas rodadas do
// defeito. Os Casos A/B abaixo são os dois lados da fronteira no
// ASSISTENTE: nível de talento em classe única (as fórmulas SEMPRE
// concordam -- prova de não-regressão) e nível de talento em multiclasse
// que cruza um total fora de múltiplo de 4 (o caso que só a correção
// final acerta).
//
// CASO C cobre um ponto que A/B NUNCA exercitam: o ctx do "+ Talento" da
// ficha é montado à MÃO em `site/js/sheet/talentos.js` (não por
// `buildLevelUpContext`) -- uma regressão isolada nesse ponto (perder o
// `nivelNovo: char.nivel`, ou reintroduzir a fórmula original) passaria
// pelos Casos A/B sem nenhuma falha, porque eles nunca abrem essa tela.
//
// VALORES ESPERADOS SÃO LITERAIS DO LIVRO (Tabela Evolução do Personagem,
// livro:1932), nunca recalculados com `bonusProficiencia`: nível 4 -> +2,
// nível 9 -> +4.
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, abrirModalLevelUp, assentar } from './helpers-regras.mjs';

function radioClasse(page, nome) {
  return page.locator(`#levelup-escolha-classe input[name="classe-que-sobe"][data-classe="${nome}"]`);
}

/** Avança "Próximo" até a tela de ASI/Talento aparecer (mesmo laço de irAteEscolhaDeTalento). */
async function irAteTalento(page) {
  for (let i = 0; i < 12; i++) {
    if (await page.locator('#levelup-talento-lista').count()) return true;
    await page.locator('#btn-step-proximo').click().catch(() => {});
    await page.waitForTimeout(500);
  }
  return false;
}

/** Escolhe modo Talento, clica Conjurador Ritualista e devolve o texto do painel de rituais. */
async function escolherRitualistaEMedir(page) {
  await page.check('input[name="levelup-asi-modo"][value="talento"]', { timeout: 1500 }).catch(() => {});
  await page.waitForSelector('#levelup-talento-lista .opcao-card', { state: 'visible', timeout: 10_000 });
  await page.locator('#levelup-talento-lista .opcao-card[data-opcao="Conjurador Ritualista"]').click();
  await page.waitForSelector('#levelup-rituais-lista .opcao-card', { state: 'visible', timeout: 10_000 });
  return page.locator('#levelup-rituais-container').innerText();
}

// ============================================================
// CASO A -- classe única, nível de talento (4). PB do livro = 2.
// Onde as fórmulas da rodada 1 e da rodada 2 SEMPRE concordavam: prova de
// que a correção final não regride o caminho que já funcionava.
// ============================================================
test('classe única: Guerreiro 3 -> 4 oferece exatamente 2 magias rituais (PB do livro no nível 4)', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    classe: 'Guerreiro', nivel: 3, xp: 900, atributos: ATRIBUTOS_REGRAS, talentos: [],
  }, 'regras-ritualista-pb-unica');

  expect(await abrirModalLevelUp(page, { pularEscolhaDeClasse: false }), 'o assistente não abriu').toBe(true);
  expect(await irAteTalento(page), 'não chegou à tela de ASI/talento').toBe(true);
  const rotulo = await escolherRitualistaEMedir(page);

  expect(rotulo, 'o rótulo tem de anunciar exatamente 2 (Bônus de Proficiência do nível 4, livro:1932)')
    .toContain('Selecione 2 magias rituais de 1º círculo');
  expect(rotulo, 'o contador tem de nascer em 0/2').toContain('Selecionadas: 0/2');
  expect(erros).toEqual([]);
});

// ============================================================
// CASO B -- multiclasse, nível de talento que cruza um total FORA de
// múltiplo de 4. Guerreiro 5/Mago 3 sobe o MAGO para 4: total 8 -> 9,
// Bônus de Proficiência 3 -> 4 (livro:1932, nível 9 = +4). `ctx.char.nivel`
// (8) não é múltiplo de 4 -- só `ctx.nivelNovo` (9) é -- e é exatamente
// esse o cenário que a rodada 2 (bonusProficiencia(ctx.char.nivel)) errava
// por um a menos.
// ============================================================
const GUERREIRO_5_MAGO_3 = [
  { classe: 'Guerreiro', subclasse: 'Campeão', nivel: 5, ordem: 0 },
  { classe: 'Mago', subclasse: '', nivel: 3, ordem: 1 },
];

test('multiclasse: Guerreiro 5/Mago 3 sobe o Mago para 4 (total 8->9) oferece exatamente 4 magias rituais (PB do livro no nível 9)', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    classe: 'Guerreiro', subclasse: 'Campeão', nivel: 8, xp: 355000,
    atributos: ATRIBUTOS_REGRAS, especie: 'Humano',
    pericias_proficientes: ['Atletismo', 'História'],
    classes: GUERREIRO_5_MAGO_3, schema_versao: 2, talentos: [],
  }, 'regras-ritualista-pb-multi');

  expect(await abrirModalLevelUp(page, { pularEscolhaDeClasse: false }), 'o assistente não abriu').toBe(true);
  await expect(page.locator('#levelup-escolha-classe'), 'o step de escolha de classe tem de aparecer num multiclasse').toBeVisible();
  await radioClasse(page, 'Mago').click();
  await assentar(page).catch(() => {});

  expect(await irAteTalento(page), 'não chegou à tela de ASI/talento (Mago 3->4)').toBe(true);
  const rotulo = await escolherRitualistaEMedir(page);

  expect(rotulo, 'o rótulo tem de anunciar exatamente 4 (Bônus de Proficiência do nível TOTAL 9, livro:1932) -- ' +
    'não 3, que é o que ctx.char.nivel (8, o total ANTERIOR à subida) daria')
    .toContain('Selecione 4 magias rituais de 1º círculo');
  expect(rotulo, 'o contador tem de nascer em 0/4').toContain('Selecionadas: 0/4');
  expect(erros).toEqual([]);
});

// ============================================================
// CASO C -- "+ Talento" da ficha, SEM subida de nível em andamento. O ctx
// que chega em `bindEscolhasTalento` aqui vem de `site/js/sheet/talentos.js`
// (`ctxTalento = { char, nivelNovo: char.nivel, helpers }`), montado à mão
// -- não de `buildLevelUpContext`. Nível 4 discrimina pelo mesmo motivo de
// sempre (a fórmula original `Math.floor(n/4)+2` dá 3, o livro dá 2), mas
// SEM precisar de multiclasse: aqui `ctx.nivelNovo === char.nivel` sempre
// (não há "nível anterior" -- o talento é adquirido no nível atual), então
// qualquer nível múltiplo de 4 discrimina, e 4 é o menor nível possível.
// ============================================================
test('"+ Talento" da ficha: Guerreiro nível 4 oferece exatamente 2 magias rituais (PB do livro no nível 4)', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    classe: 'Guerreiro', nivel: 4, xp: 2700, atributos: ATRIBUTOS_REGRAS, talentos: [],
  }, 'regras-ritualista-pb-add-talento');

  await page.locator('#btn-add-talento').click();
  await page.waitForSelector('#add-talento-lista .opcao-card', { state: 'visible', timeout: 10_000 });
  await page.locator('#add-talento-lista .opcao-card[data-opcao="Conjurador Ritualista"]').click();
  await page.locator('#btn-confirmar-add-talento').click();

  // Segundo modal ("Configurar Talento"), onde a lista de rituais mora.
  await page.waitForSelector('#levelup-rituais-lista .opcao-card', { state: 'visible', timeout: 10_000 });
  const rotulo = await page.locator('#levelup-rituais-container').innerText();

  expect(rotulo, 'o rótulo tem de anunciar exatamente 2 (Bônus de Proficiência do nível 4, livro:1932) -- ' +
    'este ctx vem de sheet/talentos.js, não de buildLevelUpContext, e os Casos A/B não o exercitam')
    .toContain('Selecione 2 magias rituais de 1º círculo');
  expect(rotulo, 'o contador tem de nascer em 0/2').toContain('Selecionadas: 0/2');
  expect(erros).toEqual([]);
});
