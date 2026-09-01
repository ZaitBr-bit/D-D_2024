// ============================================================
// Espacos de Magia de Pacto VISIVEIS ao lado dos de Conjuracao.
//
// Relato: "Classes conjuradoras que usam outros tipos de espacos de magia
// (Bruxo) nao aparecendo em tela mas funciona por baixo dos panos."
//
// O modelo sempre montou as duas reservas separadas
// (`montarReservasDeEspacos`), e o gasto ja sabia escolher a fonte certa.
// Quem escondia era o RESUMO da secao Magias: ele colapsava as reservas
// por circulo com um `new Set(...)` e ficava so com a de Conjuracao. Num
// Mago 5/Bruxo 3 os 2 espacos de pacto do 2o circulo simplesmente nao
// existiam na tela -- o jogador nao via um recurso que possui.
//
// O proprio codigo chamava isso de "LIMITACAO DE TELA QUE PERMANECE",
// "julgado defensavel" porque "multiclasse ainda nao existe em ficha de
// producao". Multiclasse subiu na 3.0.0.
// ============================================================
import { test, expect } from '@playwright/test';
import { abrirFicha, assentar, ATRIBUTOS_REGRAS } from './helpers-regras.mjs';

/** Semeia Mago 5 / Bruxo 3 -- circulo 2 servido pelas DUAS fontes. */
async function magoBruxo(context, id) {
  const lado = await abrirFicha(context, {
    nome: 'MB', especie: 'Humano', classe: 'Mago', subclasse: 'Evocação',
    nivel: 8, xp: 34000, atributos: ATRIBUTOS_REGRAS,
    classes: [
      { classe: 'Mago', subclasse: 'Evocação', nivel: 5, ordem: 0 },
      { classe: 'Bruxo', subclasse: 'Corruptor', nivel: 3, ordem: 1 },
    ],
    schema_versao: 2,
  }, id);
  await assentar(lado.page).catch(() => {});
  return lado.page;
}

test('os espacos de Pacto aparecem na tela, junto com os de Conjuracao', async ({ context }) => {
  const page = await magoBruxo(context, 'esp-pacto-1');

  // GUARDA CONTRA VACUIDADE: sem bolhas de conjuracao o cenario nao montou.
  await expect(page.locator('[data-slot-fonte="conjuracao"]').first(),
    'a ficha precisa ter espacos de conjuracao para o cenario valer')
    .toBeVisible({ timeout: 10_000 });

  const bolhasPacto = page.locator('[data-slot-fonte="pacto"]');
  expect(await bolhasPacto.count(),
    'um Bruxo 3 tem 2 espacos de Magia de Pacto -- eles somem da tela quando o '
    + 'mesmo circulo tambem e servido pela Conjuracao')
    .toBe(2);
});

test('o circulo 2 mostra as DUAS reservas, sem uma engolir a outra', async ({ context }) => {
  const page = await magoBruxo(context, 'esp-pacto-2');
  await expect(page.locator('[data-slot-fonte="conjuracao"]').first())
    .toBeVisible({ timeout: 10_000 });

  // Mago 5 da 3 espacos de 2o circulo; Bruxo 3 da 2 de pacto, tambem no 2o.
  const conj2 = page.locator('[data-slot-circ="2"][data-slot-fonte="conjuracao"]');
  const pacto2 = page.locator('[data-slot-circ="2"][data-slot-fonte="pacto"]');
  expect(await conj2.count(), 'Mago 5 tem 3 espacos de 2o circulo').toBe(3);
  expect(await pacto2.count(), 'Bruxo 3 tem 2 espacos de pacto de 2o circulo').toBe(2);
});

test('a reserva de Pacto se identifica como tal na tela', async ({ context }) => {
  const page = await magoBruxo(context, 'esp-pacto-3');
  await expect(page.locator('[data-slot-fonte="conjuracao"]').first())
    .toBeVisible({ timeout: 10_000 });

  // O jogador precisa saber QUAL reserva e a de pacto: ela volta no Descanso
  // Curto (Classes.md:898), a de conjuracao nao. Duas linhas "2o Circulo"
  // identicas seriam pior que esconder.
  const grupoPacto = page.locator('.slots-grupo', { has: page.locator('[data-slot-fonte="pacto"]') });
  await expect(grupoPacto, 'a linha da reserva de pacto precisa se nomear').toContainText(/Pacto/i);
});

test('Bruxo puro continua mostrando a reserva de pacto, como sempre mostrou', async ({ context }) => {
  const { page } = await abrirFicha(context, {
    nome: 'B', especie: 'Humano', classe: 'Bruxo', subclasse: 'Corruptor',
    nivel: 3, atributos: ATRIBUTOS_REGRAS,
    classes: [{ classe: 'Bruxo', subclasse: 'Corruptor', nivel: 3, ordem: 0 }],
    schema_versao: 2,
  }, 'esp-pacto-solo');
  await assentar(page).catch(() => {});

  expect(await page.locator('[data-slot-fonte="pacto"]').count(),
    'sem colisao de circulo a reserva de pacto sempre apareceu -- isto nao pode ter mudado')
    .toBe(2);
});
