// ============================================================
// Efeitos PASSIVOS de talento adicionados pelo botao "+ Talento" da ficha.
//
// Bug reproduzido em 2026-08-13: adicionar Alerta pelo "+ Talento" gravava
// o talento e o mostrava na lista, mas a Iniciativa nao mudava ate um F5.
//
// Causa raiz: `passivosTalentosCache` (site/js/sheet/estado.js) era escrito
// num unico lugar -- `renderSheet` (site/js/pages/sheet.js), que so roda ao
// carregar/navegar para a ficha. O "+ Talento" (`persistirTalento`,
// site/js/sheet/talentos.js) empurra o nome em `char.talentos` e chama
// `renderFichaCompleta()`, que LIA o cache mas nunca o recalculava. Todo
// consumidor do cache lia o valor de antes do talento existir: Iniciativa
// (combate.js/getModIniciativa), CA (calcCA), deslocamento, maestria extra
// de Mestre das Armas, CDs de Envenenador/Telecinetico.
//
// Por isso o teste NAO recarrega a pagina em nenhum ponto: um reload
// mascara exatamente o defeito sob teste.
// ============================================================
import { test, expect } from '@playwright/test';
import { abrirFicha, personagemSalvo, ATRIBUTOS_REGRAS, assentar } from './helpers-regras.mjs';

// Guerreiro nivel 3 => Bonus de Proficiencia +2; Destreza 14 => modificador
// +2. Alerta soma o Bonus de Proficiencia na Iniciativa (Talentos.md
// §Alerta), entao o valor exibido tem de sair de +2 para +4.
const INICIATIVA_ANTES = '+2';
const INICIATIVA_DEPOIS = '+4';

/** Le o valor exibido no quadro "Iniciativa" do topo da ficha */
async function lerIniciativa(page) {
  return page.locator('.stat-box', { hasText: 'Iniciativa' })
    .locator('.stat-value').first().innerText();
}

test('ficha: + Talento com Alerta aplica o bonus de iniciativa sem recarregar', async ({ context }) => {
  const { page } = await abrirFicha(context, {
    classe: 'Guerreiro',
    nivel: 3,
    xp: 355000,
    atributos: ATRIBUTOS_REGRAS,
    pericias_proficientes: ['Atletismo', 'História'],
    talentos: [],
  });

  expect(await lerIniciativa(page), 'a semente ja nasceu com bonus de iniciativa')
    .toBe(INICIATIVA_ANTES);

  // Alerta nao tem escolhas nem aumento de atributo (catalogo/talentos.mjs),
  // entao `persistirTalento` grava direto -- sem popup de configuracao.
  await page.click('#btn-add-talento');
  await page.waitForSelector('#add-talento-lista', { state: 'visible', timeout: 5000 });
  const cardAlerta = page.locator('#add-talento-lista .opcao-card[data-opcao="Alerta"]');
  await cardAlerta.waitFor({ state: 'visible', timeout: 5000 });
  await cardAlerta.click();
  await page.click('#btn-confirmar-add-talento');
  await assentar(page);

  const salvo = await personagemSalvo(page);
  const nomes = (salvo?.talentos || []).map(t => (typeof t === 'string' ? t : t?.nome));
  expect(nomes, 'o talento nem chegou a ser gravado -- o teste abaixo mediria outra coisa')
    .toContain('Alerta');

  expect(await lerIniciativa(page),
    'Alerta foi gravado mas a Iniciativa exibida nao mudou: passivosTalentosCache ficou velho')
    .toBe(INICIATIVA_DEPOIS);
});
