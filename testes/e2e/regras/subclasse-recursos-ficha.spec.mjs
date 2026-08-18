// ============================================================
// Paladino: os recursos de subclasse (nível 15) deveriam voltar cheios
// no Descanso Longo, do mesmo jeito que os recursos de base da classe.
//
// PHB 2024, Juramento da Glória, Defesa Gloriosa (dados/classes/paladino.json:381-384/496-499):
// "Você pode usar essa característica um número de vezes igual ao seu
// modificador de Carisma (mínimo de uma vez) e restaura todos os usos
// gastos ao completar um Descanso Longo."
// PHB 2024, Juramento dos Anciões, Sentinela Imortal (dados/classes/paladino.json:431-434/556-559):
// mesma cláusula de recarga -- "não pode utilizá-la novamente até
// completar um Descanso Longo".
//
// Achado do domínio Subclasses / Recursos (2026-08-18), CORRIGIDO no Plano 1
// da rodada de correção: o bloco de Descanso Longo do Paladino
// (site/js/sheet/hp-descanso.js:965-994) guardava a restauração de CADA
// subclasse por `char.subclasse === 'Juramento de X'` -- mas o nome real,
// gravado a partir de dados/classes/paladino.json (site/js/creator/
// passo-classe.js:83,197; site/js/levelup.js:1236), usa "da"/"dos", nunca
// "de": "Juramento da Glória", "Juramento dos Anciões". A comparação nunca era
// verdadeira e o bloco era código morto para TODAS as quatro trilhas -- exceto
// Anciões, cuja guarda (:983) estava escrita com a preposição certa e por isso
// funcionava. Os quatro literais foram corrigidos; este spec, que registrava a
// falha, agora afirma o comportamento correto nas duas pontas.
//
// Este spec prova as duas pontas com o MESMO roteiro (semear -> gastar ->
// Descanso Longo -> conferir): Glória, cuja guarda (:974) era a quebrada, e
// Anciões, cuja guarda (:983) sempre esteve certa e serviu de controle são --
// era o contraste entre as duas que provava ser o texto da guarda, e não o
// cenário/harness. Com as duas verdes, o contraste vira regressão: se alguém
// reescrever um dos literais, só a ponta afetada cai.
//
// Prova de navegador porque o Descanso Longo é um handler de botão da
// ficha: nenhum teste de unidade o executa.
// ============================================================
import { test, expect } from '@playwright/test';
import {
  ATRIBUTOS_REGRAS, abrirFicha, assentar, clicarBotaoFicha, clicarSeletorFicha, personagemSalvo,
} from './helpers-regras.mjs';

const PERICIAS_PALADINO = ['Religião', 'Persuasão'];

// Carisma 13 (ATRIBUTOS_REGRAS) -> mod +1 -> Defesa Gloriosa tem 1 uso
// (`Math.max(1, modCar)`, site/js/sheet/habilidades.js:4289/4423): o
// contador na ficha aparece como "1/1" cheio e "0/1" gasto.
const GLORIA = {
  classe: 'Paladino', nivel: 15, xp: 355000, atributos: ATRIBUTOS_REGRAS,
  subclasse: 'Juramento da Glória',
  pericias_proficientes: PERICIAS_PALADINO,
};

const ANCIOES = {
  classe: 'Paladino', nivel: 15, xp: 355000, atributos: ATRIBUTOS_REGRAS,
  subclasse: 'Juramento dos Anciões',
  pericias_proficientes: PERICIAS_PALADINO,
};

// Clica o botão de Descanso Longo e resolve o modal de confirmação que
// Paladino sempre abre (tem Maestria em Arma -- classesMaestria em
// site/js/sheet/maestrias.js:29 -- e é conjurador "preparadas", então
// hp-descanso.js:1104 sempre entra no ramo do modal para esta classe).
//
// Achado desta rodada: chamar `window.fecharModal()` direto (o atalho que
// barbaro-fanatico-descanso.spec.mjs usa, onde só o personagem SALVO
// importa) fecha o modal mas NÃO re-renderiza a ficha -- só os handlers
// dos botões reais do modal chamam renderFichaCompleta()
// (hp-descanso.js:1197-1216); abrirModal() para este modal não passa
// `onClose`, então nem fechar pelo X nem por fora dispara o re-render.
// Clicar em "Manter Tudo" (#btn-pular-troca-dl) é o que um jogador faria
// para só confirmar o descanso, e é o único caminho que atualiza o
// contador na tela -- sem ele, este spec (que confere o contador visível,
// diferente do bárbaro) ficaria preso num falso-negativo mesmo no
// personagem de controle, onde o dado salvo já está correto.
async function descansoLongo(page) {
  await clicarBotaoFicha(page, 'btn-descanso-longo');
  await assentar(page).catch(() => {});
  const abriuModalTroca = await page.waitForSelector('#btn-pular-troca-dl', { state: 'visible', timeout: 5_000 })
    .then(() => true, () => false);
  if (abriuModalTroca) {
    await page.click('#btn-pular-troca-dl');
  } else {
    await page.evaluate(() => window.fecharModal?.());
  }
  await assentar(page).catch(() => {});
}

test('descanso longo: Defesa Gloriosa (Juramento da Glória) volta cheia', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, GLORIA, 'regras-gloria-dl');

  // 2. Contador começa cheio: 1/1 (mod CAR +1, mínimo de 1 uso).
  const contador = page.locator('details:has(button[data-paladino-subclasse-acao="gloria_defesa_gloriosa"]) summary');
  await expect(contador, 'Defesa Gloriosa deveria começar com o uso cheio').toContainText('1/1');

  // 3. Clica para gastar o único uso; a mudança precisa persistir no
  // personagem salvo, não só aparecer no DOM.
  await clicarSeletorFicha(page, '[data-paladino-subclasse-acao="gloria_defesa_gloriosa"]');
  await assentar(page).catch(() => {});
  await expect(contador, 'Defesa Gloriosa deveria mostrar 0/1 depois de gasta').toContainText('0/1');

  const depoisDeGastar = await personagemSalvo(page);
  expect(depoisDeGastar.recursos?.paladino?.subclasses?.gloria?.defesa_gloriosa_usos_gastos,
    'o gasto de Defesa Gloriosa não persistiu no personagem salvo').toBe(1);

  // 4. Descanso Longo.
  await descansoLongo(page);

  // 5. Era aqui que falhava: a guarda dizia 'Juramento de Glória' (com "de")
  // e nunca batia com o nome real 'Juramento da Glória' (com "da"), então o
  // bloco de restauração de subclasse nunca rodava para esta trilha.
  const depoisDoDescanso = await personagemSalvo(page);
  expect(depoisDoDescanso.recursos?.paladino?.subclasses?.gloria?.defesa_gloriosa_usos_gastos,
    'Defesa Gloriosa deveria voltar a 0 usos gastos depois do Descanso Longo').toBe(0);
  await expect(contador, 'Defesa Gloriosa deveria voltar a mostrar 1/1 depois do Descanso Longo').toContainText('1/1');

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('descanso longo: Sentinela Imortal (Juramento dos Anciões) volta disponível -- controle', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, ANCIOES, 'regras-ancioes-dl');

  // 2. Contador começa "Disponível".
  const contador = page.locator('details:has(button[data-paladino-subclasse-acao="ancioes_sentinela_imortal"]) summary');
  await expect(contador, 'Sentinela Imortal deveria começar Disponível').toContainText('Disponível');

  // 3. Clica para gastar o uso único; confere no personagem salvo.
  await clicarSeletorFicha(page, '[data-paladino-subclasse-acao="ancioes_sentinela_imortal"]');
  await assentar(page).catch(() => {});
  await expect(contador, 'Sentinela Imortal deveria mostrar Usada depois de gasta').toContainText('Usada');

  const depoisDeGastar = await personagemSalvo(page);
  expect(depoisDeGastar.recursos?.paladino?.subclasses?.ancioes?.sentinela_imortal_usada,
    'o gasto de Sentinela Imortal não persistiu no personagem salvo').toBe(true);

  // 4. Descanso Longo.
  await descansoLongo(page);

  // 5. Controle: a guarda 'Juramento dos Anciões' (hp-descanso.js:983)
  // está escrita com a preposição certa e bate com o nome real -- este
  // caminho funciona, e é o que prova que a falha de Glória, acima, é o
  // texto da guarda e não o roteiro/harness deste spec.
  const depoisDoDescanso = await personagemSalvo(page);
  expect(depoisDoDescanso.recursos?.paladino?.subclasses?.ancioes?.sentinela_imortal_usada,
    'Sentinela Imortal deveria voltar disponível depois do Descanso Longo').toBe(false);
  await expect(contador, 'Sentinela Imortal deveria voltar a mostrar Disponível depois do Descanso Longo').toContainText('Disponível');

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
