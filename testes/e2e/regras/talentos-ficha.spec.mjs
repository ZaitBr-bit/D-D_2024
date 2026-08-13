// ============================================================
// Regra do livro: Habilidoso/Artifista/Músico concedem proficiência em
// QUALQUER combinação de três perícias/ferramentas/instrumentos à escolha
// de quem joga (Talentos.md §Habilidoso/§Artifista/§Músico).
//
// A quarta via de aquisição -- o botão "+ Talento" da FICHA (fora do
// criador e fora do level-up), que abre `abrirModalAdicionarTalento`
// (site/js/sheet/talentos.js:586). As outras três vias (antecedente no
// criador, traço Versátil, level-up) já são cobertas por
// talentos-criador.spec.mjs e talentos-levelup.spec.mjs e funcionam
// corretamente para estes três talentos -- é esta quarta via, e só ela,
// que diverge do livro.
// ============================================================
import { test, expect } from '@playwright/test';
import { lacuna } from '../../regras/lacunas-conhecidas.mjs';
import { abrirFicha, personagemSalvo, ATRIBUTOS_REGRAS } from './helpers-regras.mjs';

// Um talento por caso: cada um grava a escolha num campo diferente do
// personagem quando adquirido pela via que FUNCIONA (level-up,
// levelup.js:1313-1365) -- é esse campo que este teste confere continuar
// vazio quando a via quebrada (ficha) "adiciona" o talento sem perguntar
// nada.
const CASOS = [
  { nome: 'Habilidoso', campoProficiencia: 'pericias_proficientes' },
  { nome: 'Artifista', campoProficiencia: 'proficiencias_ferramentas' },
  { nome: 'Músico', campoProficiencia: 'proficiencias_instrumentos' },
];

for (const { nome, campoProficiencia } of CASOS) {
  test(`ficha: + Talento adicionando ${nome} oferece as 3 escolhas do livro`, async ({ context }) => {
    const l = lacuna(nome, 'e2e-ficha');
    test.fail(Boolean(l), l?.motivo);

    const { page, erros } = await abrirFicha(context, {
      classe: 'Guerreiro',
      nivel: 3,
      xp: 355000,
      atributos: ATRIBUTOS_REGRAS,
      pericias_proficientes: ['Atletismo', 'História'],
      talentos: [],
    });

    const antesSalvo = await personagemSalvo(page);
    const antesProficiencias = [...(antesSalvo?.[campoProficiencia] || [])];

    // Abre o modal "Adicionar Talento" e clica o card do talento (Task 13:
    // os antigos `#add-tal-categoria`/`#add-tal-nome` viraram cards de
    // montarSeletor dentro de `#add-talento-lista`; o de categoria virou
    // filtro do componente, não precisa de clique para achar o card por
    // `data-opcao` diretamente).
    await page.click('#btn-add-talento');
    await page.waitForSelector('#add-talento-lista', { state: 'visible', timeout: 5000 });
    const cardTalento = page.locator(`#add-talento-lista .opcao-card[data-opcao="${nome}"]`);
    await cardTalento.waitFor({ state: 'visible', timeout: 5000 });
    await cardTalento.click();
    await page.click('#btn-confirmar-add-talento');
    // Sem popup de configuração para esperar (é exatamente isso que está
    // sob teste) -- um tempo curto basta para o clique síncrono assentar.
    await page.waitForTimeout(400);

    // O livro exige 3 escolhas (perícia/ferramenta/instrumento, conforme o
    // talento). A tela deveria fazer UMA das duas coisas: oferecer os 3
    // controles de escolha ANTES de persistir, OU recusar-se a adicionar o
    // talento sem eles. `obterAtributosASITalento` devolve [] (o "+1"
    // embutido não existe aqui) e `getRegraTalento` também devolve null
    // (Habilidoso/Artifista/Músico não têm entrada em REGRAS_TALENTOS,
    // regras-cobertura.js:28-75) -- as duas únicas checagens que
    // site/js/sheet/talentos.js:663-669 consulta antes de decidir se abre
    // o popup de configuração. Com as duas vazias, `persistirTalento` roda
    // direto, sem popup nenhum.
    const controles = await page.locator('.escolha-talento-levelup').count();
    const depoisSalvo = await personagemSalvo(page);
    const adquiriu = (depoisSalvo?.talentos || [])
      .some((t) => (typeof t === 'string' ? t : t.nome) === nome);
    const depoisProficiencias = [...(depoisSalvo?.[campoProficiencia] || [])];

    const cumpriuLivro = controles >= 3 || !adquiriu;
    expect(cumpriuLivro,
      `${nome}: livro exige escolher 3 perícias/ferramentas/instrumentos ao adquirir -- a ` +
      'tela deveria oferecer os 3 controles de escolha (".escolha-talento-levelup") ANTES de ' +
      `adicionar, ou recusar adicionar sem eles. Observado: ${controles} controle(s) na tela, e ` +
      `o talento ${adquiriu ? 'FOI' : 'NÃO foi'} persistido no personagem salvo mesmo assim -- ` +
      `campo "${campoProficiencia}" antes: ${JSON.stringify(antesProficiencias)}, depois: ` +
      `${JSON.stringify(depoisProficiencias)} (sem nenhuma proficiência nova, porque nada foi ` +
      'perguntado).').toBe(true);

    expect(erros).toEqual([]);
  });
}

// ---- Decisão do dono do produto (revisão da Task 13, I2) -----------------
//
// Este modal existe PARA conceder talentos fora do fluxo normal (o próprio
// aviso do modal diz isso -- invocações, bênçãos do Mestre etc.), então
// pré-requisito não atendido não pode travar a seleção aqui como trava na
// subida de nível -- só bloquear por já possuir o talento (a única
// restrição real do modal ORIGINAL, antes da conversão pra cards) continua
// valendo. Um Clérigo Força 8 recebendo um talento do Mestre não tem outro
// caminho no app pra registrá-lo.
test('ficha: + Talento mostra pré-requisito não atendido como aviso, não bloqueio', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    classe: 'Clérigo', nivel: 5, xp: 6500,
    atributos: { forca: 8, destreza: 12, constituicao: 14, inteligencia: 10, sabedoria: 16, carisma: 12 },
    pericias_proficientes: ['Religião', 'Medicina'],
    talentos: ['Alerta'],
  });

  await page.click('#btn-add-talento');
  await page.waitForSelector('#add-talento-lista', { state: 'visible', timeout: 5000 });

  // "Mestre em Armas Grandes" exige Força 13 (Talentos.md) -- personagem
  // tem Força 8.
  const card = page.locator('#add-talento-lista .opcao-card[data-opcao="Mestre em Armas Grandes"]');
  await card.waitFor({ state: 'visible', timeout: 5000 });

  // 1. Não está bloqueado -- nem pela classe `bloqueada`, nem por
  // `pointer-events` (que a viria com ela, app.css) -- e o motivo do
  // pré-requisito aparece visível no resumo do card.
  expect(await card.evaluate((el) => el.classList.contains('bloqueada')),
    'Mestre em Armas Grandes apareceu bloqueado por pré-requisito -- deveria ser só um aviso aqui').toBe(false);
  const resumo = await card.locator('.opcao-resumo').textContent();
  expect(resumo, 'o card não mostrou o motivo do pré-requisito não atendido')
    .toContain('Força 13');

  // 2. Selecionável de verdade, e adicionar grava no personagem (o talento
  // tem "Aumento no Valor de Atributo" embutido -- abre o popup de
  // configuração do atributo, mesmo caminho de qualquer talento "só
  // atributo", sem relação com este teste).
  await card.click();
  await page.click('#btn-confirmar-add-talento');
  await page.waitForTimeout(400);
  const asiSelect = page.locator('select#levelup-talento-asi');
  if (await asiSelect.count()) {
    const valores = await asiSelect.locator('option:not([disabled])').evaluateAll(
      (ops) => ops.map((o) => o.value).filter(Boolean));
    if (valores.length) await asiSelect.selectOption(valores[0]);
  }
  const btnAsi = page.locator('#btn-confirmar-add-talento-asi');
  if (await btnAsi.count()) { await btnAsi.click(); await page.waitForTimeout(400); }

  const salvo = await personagemSalvo(page);
  expect((salvo?.talentos || []).some((t) => (typeof t === 'string' ? t : t.nome) === 'Mestre em Armas Grandes'),
    'Mestre em Armas Grandes não persistiu -- deveria ser possível conceder apesar do pré-requisito')
    .toBe(true);

  // 3. "Você já possui este talento" CONTINUA bloqueando -- essa restrição
  // não muda com o I2.
  await page.evaluate(() => window.fecharModalTodos?.());
  await page.click('#btn-add-talento');
  await page.waitForSelector('#add-talento-lista', { state: 'visible', timeout: 5000 });
  const revelarOrigem = page.locator('[data-revelar="de Origem"]');
  if (await revelarOrigem.count()) await revelarOrigem.click();
  const cardAlerta = page.locator('#add-talento-lista .opcao-card[data-opcao="Alerta"]');
  await expect(cardAlerta).toHaveClass(/bloqueada/);
  await expect(cardAlerta.locator('.opcao-motivo')).toHaveText('você já possui este talento');

  expect(erros).toEqual([]);
});
