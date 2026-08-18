// ============================================================
// Regra do livro: escolher uma subclasse na tela é uma AÇÃO, não uma
// informação -- e quando a subclasse escolhida abre uma segunda escolha
// obrigatória (Mestre da Batalha e suas Manobras), a tela tem de exigir
// as duas antes de deixar a subida concluir.
//
// Por que este spec existe (task-6-brief.md): o domínio inteiro de
// subida de nível só tinha sido confrontado por motores de UNIDADE, que
// dirigem `subirDeNivel` direto (testes/regras/unidade/subclasses.test.mjs
// e afins) -- nunca a camada de ASSISTENTE (levelup-flow.js/
// levelup-cards.js/levelup-ui.js), onde a escolha de subclasse e a de
// Manobras realmente vivem NA TELA. "O botão aparece" é uma afirmação
// sobre HTML; este spec clica no botão e prova o comportamento DEPOIS do
// clique -- em particular o passo 6 (recusar concluir sem escolher as
// manobras), que é o que distingue este teste de uma checagem de layout.
//
// Guerreiro é a semente deliberada (não Ladino/Mago, que também trocam de
// subclasse): é a ÚNICA classe cuja escolha de subclasse pode abrir uma
// SEGUNDA escolha obrigatória no mesmo fluxo de subida (Mestre da Batalha
// -> Manobras) -- um único cenário exercita as duas travas.
//
// Achado de navegação (lido em levelup-flow.js:359-492, buildVisibleSteps):
// escolha de subclasse e Manobras são DOIS steps SEPARADOS do assistente
// (não a mesma tela DOM) -- mas o segundo só passa a existir DEPOIS que
// `state.subclasse` é gravado no primeiro, porque `buildVisibleSteps` é
// recalculado a cada navegação e o step 'manobras_guerreiro' declara
// `visivel: (ctx, state) => exigeManobrasGuerreiro(ctx.char.classe,
// state?.subclasse || ctx.char.subclasse, ctx.nivelNovo)`. Por isso
// "a tela passa a exigir as manobras" (passo 5 do brief) é lido no PRÓXIMO
// step alcançado por "Próximo", e não no mesmo DOM da escolha de
// subclasse -- sem essa leitura, o motor de gatilhos não teria como saber
// que o step existe antes de a subclasse ser escolhida.
//
// Mesma disciplina de talentos-levelup.spec.mjs: "Próximo" nunca valida
// (só o clique final em #btn-confirmar-levelup roda `validateAll`), e ao
// concluir com sucesso o app TROCA de modal (fecha o do assistente, abre
// "Subida de Nível Concluída!") -- o sinal confiável de bloqueio/conclusão
// é a presença de #btn-confirmar-levelup, que só existe no modal do
// assistente.
// ============================================================
import { test, expect } from '@playwright/test';
import { CLASSE_DA_SUBCLASSE } from '../../regras/catalogo/subclasses.mjs';
import {
  ATRIBUTOS_REGRAS, abrirFicha, abrirModalLevelUp, assentar, personagemSalvo,
} from './helpers-regras.mjs';

// Nomes exatos das 4 subclasses de Guerreiro, lidos do catálogo (fonte:
// Informacoes Separadas/Classes.md) -- não hardcodados aqui, para que uma
// divergência de rótulo entre catálogo e app apareça como falha deste
// spec, e não como uma lista digitada duas vezes em lugares diferentes.
const SUBCLASSES_GUERREIRO = Object.entries(CLASSE_DA_SUBCLASSE)
  .filter(([, classe]) => classe === 'Guerreiro')
  .map(([nome]) => nome)
  .sort();

// Guerreiro nível 2, pronto para subir ao nível 3 -- onde `exigeSubclasse`
// (levelup.js:396-410) exige a escolha. Mesmo padrão de atributos/perícias
// de SEMENTES_REGRAS em helpers-regras.mjs (todos os 6 atributos em 13+).
const GUERREIRO_NIVEL_2 = {
  classe: 'Guerreiro', nivel: 2, xp: 355000, atributos: ATRIBUTOS_REGRAS,
  pericias_proficientes: ['Atletismo', 'História'],
};

/**
 * Clica "Próximo" e espera o modal reagir. Mesmo helper local usado por
 * subclasse-conjuradora-levelup.spec.mjs (achado do mesmo domínio: só um
 * clique + assentar, sem retentativa -- diferente de `abrirModalLevelUp`/
 * `irAteEscolhaDeTalento`, que vivem em helpers-regras.mjs exatamente
 * porque tinham retentativa própria e foram flakeados sob carga; um
 * clique simples de navegação intra-modal não precisa da mesma).
 */
async function proximo(page) {
  const botao = page.locator('#btn-step-proximo');
  if (!await botao.count()) return false;
  await botao.click();
  await page.waitForTimeout(300);
  await assentar(page).catch(() => {});
  return true;
}

test('level-up: Guerreiro escolhe Mestre da Batalha e as 3 manobras do nível 3', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, GUERREIRO_NIVEL_2, 'regras-subclasse-mdb-1');
  expect(await abrirModalLevelUp(page), 'não abriu o assistente de nível').toBe(true);

  // Passo 1 (ganhos do nível) -> passo 2 (escolha de subclasse).
  await proximo(page);

  // 3. A tela oferece as 4 subclasses de Guerreiro, pelos nomes exatos do
  // catálogo -- nem faltando, nem sobrando (achado M5 de talentos-levelup.
  // spec.mjs: conferir só faltantes deixaria um rótulo A MAIS invisível).
  const cardsSubclasse = page.locator('#levelup-subclasses-lista .opcao-card');
  await expect(cardsSubclasse.first()).toBeVisible();
  const nomesOfertados = await cardsSubclasse.evaluateAll(
    (els) => els.map((el) => el.dataset.subclasse));
  expect([...nomesOfertados].sort(),
    `a tela oferece ${JSON.stringify(nomesOfertados)}, o catálogo espera ${JSON.stringify(SUBCLASSES_GUERREIRO)}`)
    .toEqual(SUBCLASSES_GUERREIRO);

  // 4. Clica em Mestre da Batalha.
  await page.locator('[data-subclasse="Mestre da Batalha"]').click();
  await expect(page.locator('[data-subclasse="Mestre da Batalha"]')).toHaveClass(/selecionada/);

  // Passo 2 (subclasse) -> passo de manobras. Os steps só existem agora
  // porque state.subclasse acabou de virar 'Mestre da Batalha' (ver
  // comentário do cabeçalho sobre buildVisibleSteps).
  //
  // Desde o Plano 4 da rodada de correção, o Mestre da Batalha nível 3
  // levanta TAMBÉM as duas escolhas de Estudioso da Guerra (Classes.md:4061 --
  // ferramenta de artesão e perícia), num step de Escolhas de Classe que vem
  // ANTES do de manobras. Por isso a navegação avança até o card de manobras
  // aparecer, em vez de assumir "um Próximo" -- e o teste afirma, de passagem,
  // que o step novo existe.
  await proximo(page);
  const estudiosoFerramenta = page.locator('[data-subclasse-escolha="subclasse_estudioso_ferramenta"]');
  const estudiosoPericia = page.locator('[data-subclasse-escolha="subclasse_estudioso_pericia"]');
  if (await estudiosoFerramenta.count()) {
    await expect(estudiosoPericia,
      'Estudioso da Guerra embute DUAS escolhas na mesma característica').toHaveCount(1);
    await estudiosoFerramenta.selectOption('Ferramentas de Ferreiro');
    await estudiosoPericia.selectOption('Percepção');
    await proximo(page);
  }

  // 5. A tela passa a exigir as 3 manobras do nível 3
  // (getQuantidadeNovasManobras(3) === 3, site/js/levelup.js:471-475, e
  // Classes.md:4067 -- "No 3º nível... você aprende três manobras").
  await expect(page.locator('.levelup-card-header', { hasText: 'Novas Manobras (+3)' })).toBeVisible();
  await expect(page.locator('#lvlup-manobras-resumo')).toContainText('Selecione 3');
  await expect(page.locator('#btn-lvlup-manobras')).toBeVisible();

  // 6. Tenta concluir SEM escolher as manobras: o app recusa. Este é o
  // passo que distingue o spec de uma checagem de HTML -- "Próximo" nunca
  // valida (achado 1 de talentos-levelup.spec.mjs), então a recusa só
  // aparece ao clicar Confirmar na Revisão.
  await proximo(page); // passo 3 (manobras) -> passo 4 (revisão)
  await expect(page.locator('#btn-confirmar-levelup')).toBeVisible();
  await page.locator('#btn-confirmar-levelup').click();
  await page.waitForTimeout(500);
  await expect(page.locator('#btn-confirmar-levelup'),
    'a subida concluiu sem escolher as 3 manobras obrigatórias do Mestre da Batalha')
    .toBeVisible();

  // 7. Volta ao passo de manobras (o estado -- inclusive a subclasse já
  // escolhida -- persiste), escolhe 3 manobras distintas pelo grid
  // dedicado (abrirGridManobras, site/js/manobras-ui.js) e conclui.
  await page.locator('#btn-step-anterior').click();
  await page.waitForTimeout(300);
  await assentar(page).catch(() => {});
  await expect(page.locator('#btn-lvlup-manobras')).toBeVisible();
  await page.locator('#btn-lvlup-manobras').click();

  const checks = page.locator('[data-grid-manobra-check]');
  await expect(checks.first()).toBeVisible();
  const candidatas = await checks.evaluateAll(
    (els) => els.map((el) => el.dataset.gridManobraCheck));
  const escolhidas = candidatas.slice(0, 3);
  expect(escolhidas.length, 'o grid de manobras não ofereceu 3 candidatas para escolher').toBe(3);
  for (const nome of escolhidas) {
    // O atributo carrega o NOME exato -- o texto visível fica num
    // `.opcao-nome` irmão, não dentro do próprio `[data-grid-manobra-check]`
    // (que é um `<span class="opcao-check">` vazio), então filtrar por
    // `hasText` no span não casa com nada. Seletor de atributo exato evita
    // esse descompasso e ainda garante o clique na manobra CERTA.
    await page.locator(`[data-grid-manobra-check="${nome}"]`).click();
  }
  await expect(page.locator('#grid-manobra-sel-count')).toHaveText('3');

  // Fecha o grid (sub-modal) pelo botão "Confirmar Seleção" dele -- não é
  // o #btn-confirmar-levelup do assistente, que continua por trás.
  await page.locator('.sub-modal-overlay button', { hasText: 'Confirmar Seleção' }).click();
  await page.waitForTimeout(300);

  await expect(page.locator('#lvlup-manobras-resumo')).toContainText('3/3');

  // Passo 3 (manobras, agora completo) -> passo 4 (revisão) -> confirma.
  await proximo(page);
  await page.locator('#btn-confirmar-levelup').click();
  await page.waitForTimeout(600);

  // Ao concluir, o app FECHA o modal do assistente e abre outro ("Subida
  // de Nível Concluída!") -- #btn-confirmar-levelup some (achado 3 de
  // talentos-levelup.spec.mjs).
  await expect(page.locator('#btn-confirmar-levelup'),
    'não concluiu a subida mesmo com a subclasse e as 3 manobras escolhidas').toHaveCount(0);

  // 8 (implícito no passo 7 do brief). Confere sobre o PERSONAGEM SALVO:
  // subclasse e as 3 manobras exatas persistiram.
  const salvo = await personagemSalvo(page);
  expect(salvo?.subclasse).toBe('Mestre da Batalha');
  expect([...(salvo?.manobras_conhecidas || [])].sort()).toEqual([...escolhidas].sort());

  expect(erros).toEqual([]);
});
