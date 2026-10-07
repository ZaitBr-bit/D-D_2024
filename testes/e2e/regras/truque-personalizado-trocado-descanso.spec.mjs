// ============================================================
// Issue #79 -- um truque personalizado "ocupa vaga" (ver #74) removido
// pela grade de "Trocar Truque" do Descanso Longo (grimorio.js/
// mostrarTrocaTruque) deveria continuar na ficha marcado "Não conhecido"
// (o mesmo estado que a exclusão manual já mostra -- ver
// truque-personalizado-linha-unica.test.mjs), não sumir sem deixar
// rastro. `mostrarTrocaTruque` já chama `renderFichaCompleta()` ao
// confirmar (sem `callbackPosTroca`, o caso deste teste: fora da cadeia
// de Descanso Longo com mais passos), então a tela deveria já vir
// atualizada, sem precisar fechar e reabrir a ficha.
// ============================================================
import { test, expect } from '@playwright/test';
import { abrirFicha, assentar, ATRIBUTOS_REGRAS, clicarBotaoFicha, personagemSalvo } from './helpers-regras.mjs';

const CLERIGO_COM_TRUQUE_PERSONALIZADO_OCUPANDO_VAGA = {
  nome: 'Devoto', especie: 'Humano', classe: 'Clérigo', subclasse: '',
  nivel: 3, xp: 900,
  atributos: ATRIBUTOS_REGRAS,
  pericias_proficientes: ['História', 'Religião'],
  magias_conhecidas: [{ nome: 'Faísca Menor', circulo: 0, classe: 'Clérigo' }],
  magias_customizadas: [{
    nome: 'Faísca Menor', circulo: 0, sempre_preparada: false,
    escola: 'Evocação', tempo_conjuracao: 'Ação', alcance: '9 metros',
    componentes: 'V', duracao: 'Instantânea', descricao: 'Uma faísca.',
    dano: '', ritual: false,
  }],
  schema_versao: 2,
};

test('descanso longo: trocar um truque personalizado "ocupa vaga" o deixa "Não conhecido" sem reabrir a ficha', async ({ context }) => {
  const { page } = await abrirFicha(context, CLERIGO_COM_TRUQUE_PERSONALIZADO_OCUPANDO_VAGA, 'regras-truque-troca-descanso-1');
  await assentar(page).catch(() => {});

  await clicarBotaoFicha(page, 'btn-descanso-longo', { esperar: '#modal-overlay' });
  await assentar(page).catch(() => {});

  const botaoTruque = page.locator('#btn-trocar-truque-dl');
  await botaoTruque.click();
  await assentar(page).catch(() => {});

  const cardSaindo = page.locator('#troca-truque-remover-lista .opcao-card[data-opcao="Faísca Menor"]');
  await expect(cardSaindo, 'o truque personalizado que ocupa vaga não apareceu como trocável').toBeVisible({ timeout: 5000 });
  await cardSaindo.locator('.opcao-check').click();
  await assentar(page).catch(() => {});

  const cardEntrando = page.locator('#troca-truque-adicionar-lista .opcao-card[data-opcao="Orientação"]');
  await cardEntrando.waitFor({ state: 'visible', timeout: 5000 });
  await cardEntrando.locator('.opcao-check').click();
  await clicarBotaoFicha(page, 'btn-confirmar-troca-truque');
  await assentar(page).catch(() => {});

  // Sem fechar/reabrir nada: a seção Magias já deveria mostrar o novo
  // estado -- "Faísca Menor" como "Não conhecido" (a personalizada
  // continua em magias_customizadas), e o truque novo, conhecido.
  await expect(page.locator('#details-truques')).toContainText('Não conhecido');
  await expect(page.locator('#details-truques')).toContainText('Faísca Menor');
  await expect(page.locator('#details-truques')).toContainText('Orientação');

  const salvo = await personagemSalvo(page);
  const truques = (salvo?.magias_conhecidas || []).filter(m => m.circulo === 0).map(m => m.nome);
  expect(truques, 'a troca não foi gravada').toContain('Orientação');
  expect(truques, 'a personalizada não deveria continuar em magias_conhecidas').not.toContain('Faísca Menor');
  expect((salvo?.magias_customizadas || []).some(m => m.nome === 'Faísca Menor'),
    'a personalizada não deveria ser apagada -- só desocupou a vaga').toBe(true);
});
