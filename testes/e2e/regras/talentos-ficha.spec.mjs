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

    // Abre o modal "Adicionar Talento" e escolhe o talento na categoria
    // "de Origem" (é a categoria dos três, e também a primeira do
    // dropdown -- selecionada explicitamente para não depender da ordem).
    await page.click('#btn-add-talento');
    await page.waitForSelector('#add-tal-categoria', { state: 'visible', timeout: 5000 });
    await page.selectOption('#add-tal-categoria', 'de Origem');
    await page.waitForSelector(`#add-tal-nome option[value="${nome}"]`,
      { state: 'attached', timeout: 5000 });
    await page.selectOption('#add-tal-nome', nome);
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
