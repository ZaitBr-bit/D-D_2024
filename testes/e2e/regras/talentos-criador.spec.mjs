// ============================================================
// Regra do livro: antecedente concede um talento de origem; se o
// talento tem escolhas (Habilidoso, Artifista, Músico...), o passo
// do antecedente deve oferecê-las e recusar confirmação incompleta.
//
// Cobre as DUAS vias de aquisição de talento de origem que o criador
// oferece (a terceira, level-up, já é coberta por talentos-levelup.spec):
//   1. Antecedente (todo personagem ganha um) -- CASOS abaixo;
//   2. Traço Versátil da espécie Humana (talento de origem extra à
//      escolha) -- teste dedicado no fim do arquivo.
// ============================================================
import { test, expect } from '@playwright/test';
import { CATALOGO_TALENTOS } from '../../regras/catalogo/talentos.mjs';
import { lacuna } from '../../regras/lacunas-conhecidas.mjs';
import {
  abrirSite, satisfazerPasso, confirmarModal, lerToastErro, assentar,
  personagemEmCriacao,
} from './helpers-regras.mjs';

// Antecedente → talento concedido, lido de dados/ para o teste crescer
// sozinho quando o conteúdo mudar.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const ANTECEDENTES = (() => {
  const d = JSON.parse(readFileSync(resolve(RAIZ, 'dados/origens/antecedentes.json'), 'utf-8'));
  const lista = Array.isArray(d) ? d : d.antecedentes;
  return lista.map((a) => ({
    nome: a.nome,
    talento: (a.talento || '').replace(/\s*\(.*$/, '').trim(),
  }));
})();

// Um antecedente por talento-com-escolhas basta: a regra é do talento.
const CASOS = [];
const vistos = new Set();
for (const a of ANTECEDENTES) {
  const t = CATALOGO_TALENTOS[a.talento];
  if (t && t.escolhas.length > 0 && !vistos.has(a.talento)) {
    vistos.add(a.talento);
    CASOS.push({ antecedente: a.nome, talento: a.talento, entrada: t });
  }
}

// Avança o wizard do passo 1 (classe) até os cards de antecedente.
async function irAteAntecedentes(page) {
  await page.click('[data-classe="Guerreiro"]');
  await confirmarModal(page, 'popup-confirmar-classe').catch(() => {});
  for (let i = 0; i < 8; i++) {
    if (await page.locator('[data-antecedente]').count()) return true;
    if (!await satisfazerPasso(page)) return false;
    await assentar(page).catch(() => {});
  }
  return page.locator('[data-antecedente]').count() > 0;
}

// Avança o wizard do passo 1 (classe) até os cards de espécie, SEM deixar
// o driver genérico escolher uma espécie sozinho -- o teste de Versátil
// precisa especificamente de "Humano", e o driver (porPai/cards[0]) pegaria
// a primeira espécie da lista, que não é Humano.
async function irAteEspecies(page) {
  await page.click('[data-classe="Guerreiro"]');
  await confirmarModal(page, 'popup-confirmar-classe').catch(() => {});
  for (let i = 0; i < 3; i++) {
    if (await page.locator('[data-especie]').count()) return true;
    if (!await satisfazerPasso(page)) return false;
    await assentar(page).catch(() => {});
  }
  return page.locator('[data-especie]').count() > 0;
}

/**
 * Iniciado em Magia é o único talento do catálogo com `escolhas` mas SEM
 * select genérico na popup do antecedente -- `talentoExigeEscolhas` só
 * reconhece Habilidoso/Artifista/Músico (site/js/creator/comum.js:196-198).
 * Suas escolhas reais (lista, atributo de conjuração, 2 truques, 1 magia de
 * 1º círculo) vivem no passo "Magias" do wizard
 * (site/js/creator/passo-magias.js:290-548), então é lá que este helper as
 * verifica -- a ausência de select na popup do antecedente NÃO é lacuna, é
 * o desenho do app (confirmado empiricamente abaixo: o passo de Magias
 * oferece, valida e persiste a escolha).
 */
async function testarIniciadoEmMagia(page) {
  // Acólito já foi selecionado/confirmado pelo chamador. Avança (driver
  // genérico) até o passo de Magias -- a seção de Iniciado em Magia
  // aparece mesmo para uma classe não-conjuradora como o Guerreiro usado
  // aqui (passo-magias.js:21-30: `if (!info?.conjurador) { if
  // (temIniciadoEmMagia) { ...renderiza só a seção do talento... } }`).
  let chegou = false;
  for (let i = 0; i < 10; i++) {
    if (await page.locator('#im-lista-0').count()) { chegou = true; break; }
    if (!await satisfazerPasso(page)) break;
    await assentar(page).catch(() => {});
  }
  expect(chegou, 'não chegou ao passo de Magias com a seção de Iniciado em Magia').toBe(true);

  // 1. Os três controles da escolha aparecem: lista FIXA (concedida pelo
  // antecedente Acólito -> Clérigo, passo-magias.js:329-337), atributo de
  // conjuração e cards de truque/magia de 1º círculo.
  expect(await page.locator('#im-lista-0').inputValue(),
    'lista de Iniciado em Magia deveria vir fixa em "Clérigo" (concedida pelo Acólito)')
    .toBe('Clérigo');
  expect(await page.locator('#im-atributo-0').count(),
    'select de atributo de conjuração do talento não apareceu').toBeGreaterThan(0);
  expect(await page.locator('[data-im-magia]').count(),
    'nenhum truque/magia oferecido para Iniciado em Magia').toBeGreaterThan(0);

  // 2. Avançar sem preencher atributo/truques/magia é recusado, com um
  // toast que cita o talento (wizard.js:365-393, validarStep('magias')).
  await page.click('#btn-next');
  // Achado M11: mesma troca de waitForTimeout fixo por waitForSelector do
  // toast, ver comentário nos outros dois casos deste arquivo.
  await page.waitForSelector('#toast-container .toast.error', { timeout: 3000 }).catch(() => {});
  expect(await page.locator('#im-lista-0').count(),
    'avançou do passo de Magias sem as escolhas de Iniciado em Magia').toBeGreaterThan(0);
  const toastIM = await lerToastErro(page);
  expect(toastIM, 'confirmou o passo de Magias sem as escolhas de Iniciado em Magia')
    .toContain('Iniciado em Magia');

  // 3. Preenche (driver genérico -- já sabe lidar com os cards e abas de
  // Iniciado em Magia, ver ../helpers.mjs:544-579) e avança ao próximo passo.
  let avancou = false;
  for (let i = 0; i < 20; i++) {
    if (!await satisfazerPasso(page)) break;
    await assentar(page).catch(() => {});
    if (!await page.locator('#im-lista-0').count()) { avancou = true; break; }
  }
  expect(avancou,
    'não avançou do passo de Magias mesmo preenchendo as escolhas de Iniciado em Magia').toBe(true);

  // 4. As escolhas realmente persistiram no personagem em construção.
  const emConstrucao = await personagemEmCriacao(page);
  const im = emConstrucao?.iniciado_em_magia_instancias?.[0];
  expect(im?.lista, 'Iniciado em Magia: lista não persistiu').toBe('Clérigo');
  expect(im?.atributo, 'Iniciado em Magia: atributo de conjuração não persistiu').toBeTruthy();
  expect(im?.truques?.length, 'Iniciado em Magia: truques não persistiram').toBe(2);
  expect(im?.magia, 'Iniciado em Magia: magia de 1º círculo não persistiu').toBeTruthy();
}

for (const { antecedente, talento, entrada } of CASOS) {
  test(`criador: ${antecedente} concede ${talento} com escolhas`, async ({ context }) => {
    const l = lacuna(talento, 'e2e-criador');
    test.fail(Boolean(l), l?.motivo);

    const { page, erros } = await abrirSite(context, '#criar');
    expect(await irAteAntecedentes(page), 'não chegou ao passo de antecedente').toBe(true);

    await page.click(`[data-antecedente="${antecedente}"]`);
    await page.waitForTimeout(400);

    // Escolha própria do antecedente (ferramenta de Artesão, instrumento de
    // Artista) é independente da escolha do talento e é validada ANTES
    // dela no botão de confirmar (passo-antecedente.js:148-152: o `return`
    // do campo do antecedente vem antes da checagem do talento). Satisfazer
    // aqui evita que o passo 2 (negativo) leia o toast ERRADO -- o do campo
    // do antecedente, não o do talento -- para Artesão/Artista, que têm as
    // duas exigências ao mesmo tempo.
    const escolhaAntCard = page.locator('[data-escolha-ant]').first();
    if (await escolhaAntCard.count()) await escolhaAntCard.click();

    // 1. O popup de confirmação oferece os selects de escolha do talento.
    const selects = page.locator('.escolha-talento-antecedente');
    const esperado = entrada.escolhas
      .filter((e) => ['pericia', 'ferramenta', 'pericia_ou_ferramenta',
                      'instrumento', 'ferramenta_artesao'].includes(e.tipo))
      .reduce((s, e) => s + e.qtd, 0);
    expect(await selects.count(),
      `${talento}: livro exige ${JSON.stringify(entrada.escolhas)} ao adquirir`)
      .toBeGreaterThanOrEqual(esperado);

    if (esperado === 0) {
      // Único caso hoje: Iniciado em Magia, com cobertura dedicada em
      // testarIniciadoEmMagia (ver comentário da função). Qualquer OUTRO
      // talento que caia aqui não tem verificação nenhuma neste spec --
      // falha alto e claro em vez de aprovar em silêncio uma asserção
      // tautológica (>= 0 é sempre verdade).
      expect(talento, `${talento}: esperado=0 mas não há verificação dedicada para ` +
        'este talento neste spec -- adicione uma ramificação específica ou registre lacuna')
        .toBe('Iniciado em Magia');
      await testarIniciadoEmMagia(page);
      expect(erros).toEqual([]);
      return;
    }

    // 2. Confirmar sem preencher as escolhas do TALENTO é recusado, com um
    // toast que CITA o talento -- não basta "algum" toast de erro: para
    // Artesão/Artista (que têm ferramenta/instrumento próprios, já
    // satisfeitos acima, DE PROPÓSITO, antes deste passo) um teste que
    // aceitasse qualquer toast nunca exercitaria de fato a validação da
    // escolha do talento (site/js/creator/passo-antecedente.js:159:
    // `Selecione todas as ${numEsc} escolhas de ${talentoNome}`).
    await page.click('#popup-confirmar-antecedente').catch(() => {});
    // Achado M11: waitForTimeout fixo trocado por esperar o próprio toast
    // aparecer -- um waitForTimeout(300) arrisca FALSO negativo se o toast
    // renderizar depois disso sob carga.
    await page.waitForSelector('#toast-container .toast.error', { timeout: 3000 }).catch(() => {});
    const toast = await lerToastErro(page);
    expect(toast, `${talento}: confirmou sem as ${esperado} escolhas, ou o toast não citou o talento`)
      .toContain(talento);

    // 3. Preenche opções distintas e confirma com sucesso.
    //
    // Clique DIRETO no botão (não `confirmarModal`): o auto-preenchedor
    // genérico de ../helpers.mjs marca o primeiro `.selection-card` NÃO
    // selecionado antes de sequer tocar em selects (helpers.mjs:127-129) --
    // e a escolha de ferramenta/instrumento de Artesão/Artista É um
    // `.selection-card` (passo-antecedente.js:91). Usado aqui, ele supriria
    // sozinho um requisito que este teste já satisfez de propósito (e
    // fecharia o modal por um motivo que o teste não estabeleceu) -- mesmo
    // achado que corrigiu o passo 2 na revisão anterior deste spec.
    const n = await selects.count();
    const escolhidos = [];
    for (let i = 0; i < n; i++) {
      const s = selects.nth(i);
      const valores = await s.locator('option').evaluateAll(
        (ops) => ops.map((o) => o.value).filter(Boolean));
      const valor = valores[i % valores.length];
      await s.selectOption(valor);
      escolhidos.push(valor);
    }
    await page.click('#popup-confirmar-antecedente');
    await page.waitForTimeout(300);
    expect(await page.locator('#modal-overlay').isVisible(),
      `${talento}: modal não fechou após escolhas completas`).toBe(false);

    // 4. As escolhas REALMENTE persistiram no personagem em construção --
    // não basta o modal ter fechado sem erro: um app que renderiza e
    // valida os selects mas descarta `personagem.escolhas_talento
    // .antecedente` (onde passo-antecedente.js:166-167 as grava, e de onde
    // passo-atributos.js:582-592/wizard.js:583-597 as leem depois para
    // aplicar as proficiências) passaria pelas asserções 1-3 sem cumprir a
    // regra do livro.
    const emConstrucao = await personagemEmCriacao(page);
    const persistido = [...(emConstrucao?.escolhas_talento?.antecedente || [])].sort();
    expect(persistido,
      `${talento}: escolhas ${JSON.stringify(escolhidos)} não persistiram em ` +
      'personagem.escolhas_talento.antecedente')
      .toEqual([...escolhidos].sort());

    expect(erros).toEqual([]);
  });
}

// ---- Terceira via de aquisição: traço Versátil (espécie Humana) --------
//
// Habilidoso basta para fixar a regra (mesmo talento já coberto na via do
// antecedente acima) -- o que este teste prova é que a via VERSÁTIL
// especificamente oferece/valida/persiste a escolha, e não só a via do
// antecedente. Nem esta task nem a Task 9 (level-up) cobriam este caminho
// antes -- é a terceira e última das três formas de adquirir um talento de
// origem no app.
test('criador: Versátil (Humano) concede Habilidoso com escolhas', async ({ context }) => {
  const l = lacuna('Habilidoso', 'e2e-criador-versatil');
  test.fail(Boolean(l), l?.motivo);

  const { page, erros } = await abrirSite(context, '#criar');
  expect(await irAteEspecies(page), 'não chegou ao passo de espécie').toBe(true);

  await page.click('[data-especie="Humano"]');
  await page.waitForTimeout(400);

  // Pré-requisito do próprio traço Hábil (perícia extra), independente do
  // Versátil e validado ANTES dele na mesma função de confirmação
  // (site/js/creator/passo-especie.js:356-365). Satisfazer aqui evita ler o
  // toast errado no passo negativo abaixo -- mesmo cuidado do teste do
  // antecedente com Artesão/Artista.
  const opcoesPericia = await page.locator('#select-pericia-especie option')
    .evaluateAll((ops) => ops.map((o) => o.value).filter(Boolean));
  expect(opcoesPericia.length, 'select da perícia de Hábil não ofereceu opções').toBeGreaterThan(0);
  await page.selectOption('#select-pericia-especie', opcoesPericia[0]);

  // A lista de talentos de Versátil é populada ASSINCRONAMENTE (getTalentos,
  // passo-especie.js) -- espera o card existir antes de clicar (Task 13: o
  // antigo `<select id="select-talento-versatil">` virou cards de
  // montarSeletor dentro de `#versatil-talento-lista`).
  const cardHabilidoso = page.locator('#versatil-talento-lista .opcao-card[data-opcao="Habilidoso"]');
  await cardHabilidoso.waitFor({ state: 'visible', timeout: 10_000 });
  await cardHabilidoso.click();
  await page.waitForTimeout(300);

  // 1. Escolher Habilidoso no combo injeta os 3 selects de escolha do
  // talento (renderEscolhasTalentoHtml, passo-especie.js:326-329).
  const selects = page.locator('.escolha-talento-versatil');
  expect(await selects.count(),
    'Habilidoso via Versátil: livro exige 3 perícias/ferramentas, popup não ofereceu selects')
    .toBeGreaterThanOrEqual(3);

  // 2. Confirmar sem preencher é recusado, citando o talento
  // (passo-especie.js:401: `Selecione todas as ${numEscolhas} escolhas de
  // ${selectVersatil.value}`).
  await page.click('#popup-confirmar-especie').catch(() => {});
  // Achado M11: mesma troca de waitForTimeout fixo por waitForSelector do
  // toast, ver comentário no caso do antecedente acima.
  await page.waitForSelector('#toast-container .toast.error', { timeout: 3000 }).catch(() => {});
  const toast = await lerToastErro(page);
  expect(toast, 'Habilidoso via Versátil: confirmou sem as 3 escolhas, ou o toast não citou o talento')
    .toContain('Habilidoso');

  // 3. Preenche opções distintas e confirma com sucesso (clique direto no
  // botão -- mesmo motivo do teste do antecedente: não usar o
  // auto-preenchedor genérico aqui).
  const n = await selects.count();
  const escolhidos = [];
  for (let i = 0; i < n; i++) {
    const s = selects.nth(i);
    const valores = await s.locator('option').evaluateAll(
      (ops) => ops.map((o) => o.value).filter(Boolean));
    const valor = valores[i % valores.length];
    await s.selectOption(valor);
    escolhidos.push(valor);
  }
  await page.click('#popup-confirmar-especie');
  await page.waitForTimeout(300);
  expect(await page.locator('#modal-overlay').isVisible(),
    'Habilidoso via Versátil: modal não fechou após escolhas completas').toBe(false);

  // 4. As escolhas realmente persistiram (personagem.escolhas_talento
  // .versatil, gravado em passo-especie.js:409-410).
  const emConstrucao = await personagemEmCriacao(page);
  const persistido = [...(emConstrucao?.escolhas_talento?.versatil || [])].sort();
  expect(persistido,
    `Habilidoso via Versátil: escolhas ${JSON.stringify(escolhidos)} não persistiram em ` +
    'personagem.escolhas_talento.versatil').toEqual([...escolhidos].sort());

  expect(erros).toEqual([]);
});

// ---- Regressão do Critical C1 (revisão da Task 13) ----------------------
//
// O teste de Habilidoso acima NÃO pega este defeito por dois motivos: (1)
// ele nunca reabre o popup depois de confirmar -- e o bug só aparece ao
// REABRIR; (2) Habilidoso é Repetível, e é exatamente essa marca que o
// isenta do bloqueio (achado 3 da entrega original desta task). O defeito
// atingia 8 dos 10 talentos "de Origem" (todos MENOS os dois Repetíveis,
// Habilidoso e Iniciado em Magia): `jaPossui` (site/js/creator/
// passo-especie.js) incluía o PRÓPRIO `talento_versatil` já confirmado
// (via `personagem.talentos`, preenchido por `_reconstruirTalentosBase`),
// então reabrir o popup fazia o talento se bloquear sozinho -- o card
// nascia cinza, sem nada marcado, `pointer-events:none` (não dava pra
// clicar de novo), e o `aoMudar` automático da montagem apagava
// `personagem.talento_versatil`/`escolhas_talento.versatil` em silêncio.
// "Alerta" (sem prerequisito, sem escolhas, "de Origem") isola o defeito
// sem nenhum ruído de talento com sub-escolhas.
test('criador: Versátil (Humano) com talento NÃO repetível sobrevive a reabrir o popup', async ({ context }) => {
  const { page, erros } = await abrirSite(context, '#criar');
  expect(await irAteEspecies(page), 'não chegou ao passo de espécie').toBe(true);

  await page.click('[data-especie="Humano"]');
  await page.waitForTimeout(400);
  const opcoesPericia = await page.locator('#select-pericia-especie option')
    .evaluateAll((ops) => ops.map((o) => o.value).filter(Boolean));
  await page.selectOption('#select-pericia-especie', opcoesPericia[0]);

  const cardAlerta = page.locator('#versatil-talento-lista .opcao-card[data-opcao="Alerta"]');
  await cardAlerta.waitFor({ state: 'visible', timeout: 10_000 });
  await cardAlerta.click();
  await page.waitForTimeout(200);
  await page.click('#popup-confirmar-especie');
  await page.waitForTimeout(300);
  expect(await page.locator('#modal-overlay').isVisible(),
    'Alerta via Versátil: modal não fechou na primeira confirmação').toBe(false);

  const primeiraVez = await personagemEmCriacao(page);
  expect(primeiraVez?.talento_versatil, 'Alerta não persistiu em talento_versatil na 1ª confirmação')
    .toBe('Alerta');

  // REABRE clicando de novo em "Humano" -- o mesmo card, mesmo fluxo que um
  // jogador usaria para revisar ou trocar a escolha da espécie.
  await page.click('[data-especie="Humano"]');
  await page.waitForTimeout(400);
  await cardAlerta.waitFor({ state: 'visible', timeout: 10_000 });
  await page.waitForTimeout(200);

  // 1. O card NÃO pode estar bloqueado (era aqui que o C1 quebrava: o
  // próprio talento_versatil confirmado entrava em `jaPossui`).
  expect(await cardAlerta.evaluate((el) => el.classList.contains('bloqueada')),
    'Alerta apareceu bloqueado ao reabrir -- ele bloqueou a SI MESMO (C1)').toBe(false);
  // 2. E tem que continuar marcado como selecionado (a escolha sobreviveu
  // à remontagem do card, não só "não está bloqueada").
  expect(await cardAlerta.evaluate((el) => el.classList.contains('selecionada')),
    'Alerta não apareceu selecionado ao reabrir -- a escolha se perdeu (C1)').toBe(true);

  // 3. De verdade reselecionável: um card bloqueado por C1 tinha
  // `pointer-events:none` e um clique nele não fazia nada -- aqui um
  // clique tem que desmarcar (max:1, clicar de novo no já selecionado
  // desmarca) e confirmar sem nada marcado tem que voltar a recusar.
  await cardAlerta.click();
  await page.waitForTimeout(150);
  expect(await cardAlerta.evaluate((el) => el.classList.contains('selecionada')),
    'clicar em Alerta (já selecionado) não desmarcou -- sinal de bloqueio residual').toBe(false);
  await page.click('#popup-confirmar-especie').catch(() => {});
  await page.waitForSelector('#toast-container .toast.error', { timeout: 3000 }).catch(() => {});
  const toastSemEscolha = await lerToastErro(page);
  expect(toastSemEscolha, 'confirmou sem nenhum Talento de Origem marcado')
    .toContain('Talento de Origem');

  // Reseleciona e confirma de novo, pra fechar o roteiro com o personagem
  // num estado consistente (sem duplicar "Alerta" em `talentos`).
  await cardAlerta.click();
  await page.waitForTimeout(150);
  const opcoesPericia2 = await page.locator('#select-pericia-especie option')
    .evaluateAll((ops) => ops.map((o) => o.value).filter(Boolean));
  await page.selectOption('#select-pericia-especie', opcoesPericia2[0]);
  await page.click('#popup-confirmar-especie');
  await page.waitForTimeout(300);

  const segundaVez = await personagemEmCriacao(page);
  expect(segundaVez?.talento_versatil, 'Alerta não persistiu na 2ª confirmação (pós-reabertura)')
    .toBe('Alerta');
  const ocorrencias = (segundaVez?.talentos || []).filter((t) => t === 'Alerta').length;
  expect(ocorrencias, `"Alerta" apareceu ${ocorrencias}x em personagem.talentos -- esperado 1x`)
    .toBe(1);

  expect(erros).toEqual([]);
});
