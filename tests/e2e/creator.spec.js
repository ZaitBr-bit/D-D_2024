// ============================================================
// Criador de personagem — arquitetura NOVA no caminho PÚBLICO (Task 28b).
//
// Estes specs rodam contra a rota real `#criar`, que desde o cutover monta
// `features/creator/**` pelo composition root fino de `site/js/pages/creator.js`.
// O harness (`creator-step-harness.spec.js`) continua existindo e cobrindo a
// mecânica fina dos passos em isolamento; AQUI o que se prova é o cutover:
//
//   - a rota pública monta o módulo NOVO (e o DOM diz qual é);
//   - o fluxo dos SETE passos continua funcionando ponta a ponta;
//   - o RESULTADO FUNCIONAL é o mesmo que o criador legado produzia — mesmo
//     registro persistido, mesmos campos, e a ficha abre em cima dele;
//   - o disposer do router deixa a montagem anterior inerte.
//
// A estrutura de DOM MUDOU de propósito (ver o cabeçalho de
// `tests/e2e/helpers/creator.js`, que lista cada divergência e o porquê). O
// que NÃO podia mudar — e é o que os testes de resultado abaixo prendem — é o
// personagem que sai do outro lado.
// ============================================================
import { test, expect } from '@playwright/test';
import { resetApp, goCreator, goHome, fichaIdFromUrl } from './helpers/app.js';
import { readCharacters } from './helpers/storage.js';
import {
  STEPS,
  raizDoCriador,
  passoAtual,
  esperarPasso,
  primeiroContentId,
  abrirSelecao,
  cancelarModal,
  selecionarClasse,
  selecionarEspecie,
  selecionarAntecedente,
  escolherAtributosConjuntoPadrao,
  escolherAtributosPointBuy,
  escolherAtributosRolagem,
  assertModoManualDesabilitado,
  escolherEquipamentoPadrao,
  escolherMagiasSuficientes,
  preencherDetalhes,
  proximoPasso,
  passoAnterior,
  finalizarCriacao
} from './helpers/creator.js';

const GUERREIRO = 'dnd2024:class:guerreiro';
const MAGO = 'dnd2024:class:mago';
const DRACONATO = 'dnd2024:species:draconato';
// "Andarilho" em vez do 1o antecedente do grid pelo mesmo motivo do spec
// legado: vários antecedentes concedem "Iniciado em Magia", cuja lista de
// magias o catálogo ainda não referencia de forma estruturada (Task 28, C2).
const ANDARILHO = 'dnd2024:background:andarilho';

/**
 * Leva o wizard da classe até o passo `atributos`, com espécie e antecedente
 * confirmados.
 * @param {import('@playwright/test').Page} page
 * @param {string} classeId
 * @returns {Promise<string>} ContentId da espécie escolhida.
 */
async function ateAtributos(page, classeId) {
  await selecionarClasse(page, classeId);
  await proximoPasso(page);

  const especie = await primeiroContentId(page, 'grid-especies');
  await selecionarEspecie(page, especie);
  await proximoPasso(page);

  await selecionarAntecedente(page, ANDARILHO);
  await proximoPasso(page);
  await esperarPasso(page, 'atributos');
  return especie;
}

test.describe('Criador de personagem (rota pública)', () => {
  test('abrir o criador monta o módulo NOVO e exibe o passo Classe', { tag: '@critical' }, async ({ page }) => {
    await resetApp(page, { characters: [] });
    await goCreator(page);

    // O cutover é observável: quem responde por `#criar` é `features/creator`.
    await expect(raizDoCriador(page)).toHaveAttribute('data-creator-module', 'features/creator');
    await expect(raizDoCriador(page)).toHaveAttribute('data-creator-step', 'classe');
    await expect(page.locator('#app-content .wizard-step[data-step="classe"]')).toHaveClass(/active/);

    // As DOZE classes do pacote oficial, com ContentId real.
    await expect(page.locator('#app-content #grid-classes .selection-card[data-content-id]')).toHaveCount(12);
    await expect(page.locator(`#app-content .selection-card[data-content-id="${GUERREIRO}"]`)).toBeVisible();

    // A barra de passos continua sendo a mesma sequência de sete.
    const chips = await page
      .locator('#app-content .wizard-step[data-step]')
      .evaluateAll((els) => els.map((el) => el.getAttribute('data-step')));
    expect(chips).toEqual(STEPS);
  });

  test('cria um Guerreiro completo com o Conjunto Padrão', async ({ page }) => {
    await resetApp(page, { characters: [] });
    await goCreator(page);

    await ateAtributos(page, GUERREIRO);
    await assertModoManualDesabilitado(page);
    await escolherAtributosConjuntoPadrao(page);
    await proximoPasso(page);

    await escolherEquipamentoPadrao(page);
    await proximoPasso(page);

    // Guerreiro nível 1 não conjura: o passo declara isso e deixa passar.
    await expect(page.locator('#app-content [data-magias-sem-conjuracao]')).toHaveCount(1);
    await escolherMagiasSuficientes(page);
    await proximoPasso(page);

    await preencherDetalhes(page, { nome: 'Thalion, o Escudeiro' });
    await finalizarCriacao(page);

    // --- RESULTADO FUNCIONAL: o mesmo registro que o legado gravava ---------
    const id = fichaIdFromUrl(page.url());
    expect(id).toBeTruthy();
    const lista = await readCharacters(page);
    expect(lista).toHaveLength(1);
    expect(lista[0].nome).toBe('Thalion, o Escudeiro');
    expect(lista[0].classe).toBe('Guerreiro');
    expect(lista[0].nivel).toBe(1);
    // E a ficha abre em cima do que foi salvo.
    // Task 33 (cutover): a ficha nova não desenha `.card` — ela desenha seções
    // com identidade estável.
    await expect(page.locator('#app-content [data-sheet-section]')).not.toHaveCount(0);
  });

  test('cria um Mago completo com Compra de Pontos, grimório e magias preparadas', async ({ page }) => {
    await resetApp(page, { characters: [] });
    await goCreator(page);

    await ateAtributos(page, MAGO);
    await escolherAtributosPointBuy(page);
    await proximoPasso(page);

    await escolherEquipamentoPadrao(page);
    await proximoPasso(page);

    // O Mago tem as três coleções: truques, grimório e preparadas.
    await expect(page.locator('#app-content [data-magias-fonte]')).toHaveCount(1);
    await escolherMagiasSuficientes(page);
    // Todos os contadores convergiram para X/X antes de avançar.
    const convergiram = await page
      .locator('#app-content [data-magias-contador]')
      .evaluateAll((els) =>
        els
          .map((el) => /(\d+)\s*\/\s*(\d+)/.exec(el.textContent || ''))
          .filter(Boolean)
          .every(([, atual, alvo]) => atual === alvo)
      );
    expect(convergiram, 'os contadores de magia do Mago precisam estar saciados').toBe(true);
    await proximoPasso(page);

    await preencherDetalhes(page, { nome: 'Elowen Grimório' });
    await finalizarCriacao(page);

    const lista = await readCharacters(page);
    expect(lista).toHaveLength(1);
    const mago = lista[0];
    expect(mago.nome).toBe('Elowen Grimório');
    expect(mago.classe).toBe('Mago');
    expect(mago.nivel).toBe(1);
    // Conjurador por grimório: o grimório inicial precisa ter chegado ao
    // registro persistido — é o mesmo campo que o criador legado gravava.
    expect(Array.isArray(mago.grimorio)).toBe(true);
    expect(mago.grimorio.length).toBeGreaterThan(0);
    expect(Array.isArray(mago.magias_preparadas)).toBe(true);
    expect(mago.magias_preparadas.length).toBeGreaterThan(0);
    // Cada magia precisa chegar ao registro com NOME e CÍRCULO: sem eles a
    // ficha legada quebra ao ordenar a lista (regressão da Task 28b).
    for (const lista of [mago.magias_conhecidas, mago.magias_preparadas, mago.grimorio]) {
      for (const magia of lista) {
        expect(typeof magia.nome, JSON.stringify(magia)).toBe('string');
        expect(magia.nome.length).toBeGreaterThan(0);
        expect(Number.isInteger(magia.circulo)).toBe(true);
      }
    }

    // E a FICHA do Mago abre de verdade sobre o que foi salvo — é o passo que
    // o teste anterior não dava e onde a quebra aparecia.
    // Task 33 (cutover): marcador da ficha nova.
    await expect(page.locator('[data-sheet-section="summary-combat"]')).toBeVisible();
    // Task 33 (cutover): a ficha nova não desenha `.card` — ela desenha seções
    // com identidade estável.
    await expect(page.locator('#app-content [data-sheet-section]')).not.toHaveCount(0);
  });

  test('digitar o nome e clicar UMA vez em "Finalizar" já cria o personagem', async ({ page }) => {
    // Regressão da Task 28b. O `mousedown` no botão tira o foco do campo de
    // nome, o que dispara `change` -> intenção -> re-render ANTES do `mouseup`.
    // Enquanto o re-render destruía o shell inteiro, o botão saía do documento
    // no meio do gesto e NENHUM `click` chegava à delegação: o primeiro clique
    // em "Finalizar" não fazia nada e não dizia nada. Este teste usa o gesto
    // exato do jogador — preencher e clicar UMA vez, sem `blur` explícito.
    await resetApp(page, { characters: [] });
    await goCreator(page);

    await ateAtributos(page, GUERREIRO);
    await escolherAtributosConjuntoPadrao(page);
    await proximoPasso(page);
    await escolherEquipamentoPadrao(page);
    await proximoPasso(page);
    await escolherMagiasSuficientes(page);
    await proximoPasso(page);
    await esperarPasso(page, 'detalhes');

    await page.locator('#app-content [data-det-field="name"]').fill('Uma Clicada Só');
    await page.locator('#app-content [data-creator-nav="finalize"]').click();

    await page.waitForURL(/#ficha\//, { timeout: 20000 });
    const lista = await readCharacters(page);
    expect(lista).toHaveLength(1);
    expect(lista[0].nome, 'o nome digitado precisa ter chegado ao personagem').toBe('Uma Clicada Só');
  });

  test('depois de digitar o nome, o PRIMEIRO clique dentro do passo `detalhes` funciona', async ({ page }) => {
    // REGRESSÃO (revisão da Task 28b). Preservar o shell salvou o botão
    // "Finalizar", que vive FORA do miolo do passo — mas não salvava nada
    // DENTRO dele. O passo `detalhes` põe o campo de nome ANTES do grid de
    // alinhamento e dos demais campos de texto, então o mesmo buraco continuava
    // aberto no caminho público: o `mousedown` no card tira o foco do campo ->
    // `change` -> intenção -> re-render, tudo ANTES do `mouseup`. O card que
    // recebeu o `mousedown` já não existe, o `click` nunca é emitido e o
    // alinhamento não é escolhido — sem toast e sem log.
    //
    // Os dois cenários abaixo são os que a revisão reproduziu, com gesto de
    // usuário real (clique de verdade, uma vez só).
    await resetApp(page, { characters: [] });
    await goCreator(page);

    await ateAtributos(page, GUERREIRO);
    await escolherAtributosConjuntoPadrao(page);
    await proximoPasso(page);
    await escolherEquipamentoPadrao(page);
    await proximoPasso(page);
    await escolherMagiasSuficientes(page);
    await proximoPasso(page);
    await esperarPasso(page, 'detalhes');

    // Cenário 1: nome + UM clique num card de alinhamento.
    await page.locator('#app-content [data-det-field="name"]').fill('Alinhado de Primeira');
    await page.locator('#app-content [data-det-alignment="OB"]').click();
    await expect(
      page.locator('#app-content [data-det-alignment="OB"]'),
      'o primeiro clique no alinhamento precisa selecionar',
    ).toHaveClass(/selected/);

    // Cenário 2: nome + UM clique num campo de texto seguinte, para digitar.
    await page.locator('#app-content [data-det-field="name"]').fill('Foco de Primeira');
    await page.locator('#app-content [data-det-field="personality"]').click();
    await expect
      .poll(
        async () => page.evaluate(() => document.activeElement?.getAttribute('data-det-field') ?? null),
        { message: 'o campo clicado precisa continuar focado depois do re-render' },
      )
      .toBe('personality');

    // E o que o jogador digita a seguir chega ao personagem.
    await page.keyboard.type('Fala pouco.');
    await page.locator('#app-content [data-det-field="name"]').click();
    await expect(page.locator('#app-content [data-det-field="personality"]')).toHaveValue('Fala pouco.');

    // O nome sobreviveu a tudo (nenhuma das duas intenções se perdeu).
    await expect(page.locator('#app-content [data-det-field="name"]')).toHaveValue('Foco de Primeira');
  });

  test('Draconato: a linhagem é uma escolha do catálogo, dentro do modal da espécie', async ({ page }) => {
    await resetApp(page, { characters: [] });
    await goCreator(page);

    await selecionarClasse(page, GUERREIRO);
    await proximoPasso(page);

    await abrirSelecao(page, DRACONATO);
    // Dez linhagens + o placeholder "Selecione uma opção".
    await expect(page.locator('#modal-corpo [data-choice-group="heranca-draconica"] option')).toHaveCount(11);
    await page.selectOption('#modal-corpo [data-choice-group="heranca-draconica"] select', 'ouro');

    // Cancelar não grava nada — a escolha só existe depois de confirmar.
    await cancelarModal(page);
    await expect(page.locator(`#app-content .selection-card[data-content-id="${DRACONATO}"]`)).not.toHaveClass(/selected/);

    await selecionarEspecie(page, DRACONATO, { 'heranca-draconica': 'ouro' });
    await expect(page.locator('#app-content .selecao-resumo .resumo-titulo')).toHaveText('Draconato');
  });

  test('os três métodos de atributos ativos funcionam e o Manual permanece desabilitado', async ({ page }) => {
    await resetApp(page, { characters: [] });
    await goCreator(page);
    await ateAtributos(page, GUERREIRO);

    for (const metodo of ['standard', 'pointbuy', 'rolagem']) {
      await expect(page.locator(`#app-content [data-attr-mode="${metodo}"]`)).toBeEnabled();
    }
    await assertModoManualDesabilitado(page);

    // Conjunto Padrão: os seis atributos ficam com um valor atribuído.
    await escolherAtributosConjuntoPadrao(page);
    const semVazio = await page
      .locator('#app-content [data-attr-assign]')
      .evaluateAll((sels) => sels.every((s) => s.value !== ''));
    expect(semVazio).toBe(true);

    // Compra de Pontos: os 27 pontos são gastos e o avanço é liberado.
    await escolherAtributosPointBuy(page);
    await expect(page.locator('#app-content [data-pb-key="forca"][data-pb-delta="1"]')).toBeDisabled();

    // Rolagem 4d6 com o RNG de PRODUÇÃO (`createCryptoRng`, ligado no
    // composition root): os valores mudam a cada execução, então o que se
    // afirma é o INVARIANTE — os seis atributos ficam rolados, com total
    // dentro da faixa possível de 4d6-descarta-o-menor mais o bônus do
    // antecedente (3..18 + no máximo +2).
    await escolherAtributosRolagem(page);
    const totais = await page
      .locator('#app-content .atributo-box[data-key] .atributo-valor')
      .evaluateAll((els) => els.map((el) => (el.textContent || '').trim()));
    expect(totais).toHaveLength(6);
    for (const total of totais) {
      expect(total, 'nenhum atributo pode continuar sem valor após "Rolar Todos"').not.toBe('--');
      expect(Number(total)).toBeGreaterThanOrEqual(3);
      expect(Number(total)).toBeLessThanOrEqual(20);
    }
    await assertModoManualDesabilitado(page);
  });

  test('voltar um passo invalida o passo abandonado e preserva o anterior', async ({ page }) => {
    await resetApp(page, { characters: [] });
    await goCreator(page);

    await selecionarClasse(page, GUERREIRO);
    await proximoPasso(page);
    const especie = await primeiroContentId(page, 'grid-especies');
    await selecionarEspecie(page, especie);
    await proximoPasso(page);
    await esperarPasso(page, 'antecedente');

    // Voltar invalida o passo ABANDONADO (`antecedente`), não o de destino: a
    // espécie confirmada continua de pé.
    await passoAnterior(page);
    await esperarPasso(page, 'especie');
    await expect(page.locator(`#app-content .selection-card[data-content-id="${especie}"]`)).toHaveClass(/selected/);

    // Voltar de novo abandona `especie`: agora ELA é invalidada, e a classe do
    // passo de destino continua intacta.
    await passoAnterior(page);
    await esperarPasso(page, 'classe');
    await expect(page.locator(`#app-content .selection-card[data-content-id="${GUERREIRO}"]`)).toHaveClass(/selected/);

    await proximoPasso(page);
    await esperarPasso(page, 'especie');
    await expect(page.locator(`#app-content .selection-card[data-content-id="${especie}"]`)).not.toHaveClass(/selected/);
  });

  test('avançar é RECUSADO enquanto o passo não estiver válido', async ({ page }) => {
    await resetApp(page, { characters: [] });
    await goCreator(page);

    await page.locator('#app-content [data-creator-nav="next"]').click();
    await expect(raizDoCriador(page)).toHaveAttribute('data-creator-step', 'classe');
    expect(await passoAtual(page)).toBe('classe');
  });

  test('sair e voltar para o criador não vaza a montagem anterior', async ({ page }) => {
    await resetApp(page, { characters: [] });
    await goCreator(page);
    await selecionarClasse(page, GUERREIRO);
    await expect(page.locator(`#app-content .selection-card[data-content-id="${GUERREIRO}"]`)).toHaveClass(/selected/);

    await goHome(page);
    await goCreator(page);

    // Sessão NOVA: o rascunho anterior não sobrevive à troca de rota, e existe
    // exatamente UMA raiz de criador montada (o disposer do router descartou a
    // anterior antes de a nova ser renderizada).
    await expect(raizDoCriador(page)).toHaveCount(1);
    await expect(page.locator(`#app-content .selection-card[data-content-id="${GUERREIRO}"]`)).not.toHaveClass(/selected/);
    await expect(page.locator('#app-content .selecao-resumo')).toHaveCount(0);

    // E um clique continua produzindo UM efeito, não dois (nenhum listener
    // duplicado sobreviveu à montagem anterior).
    await selecionarClasse(page, GUERREIRO);
    await expect(page.locator('#app-content .selecao-resumo')).toHaveCount(1);
  });
});
