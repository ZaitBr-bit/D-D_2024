// ============================================================
// Bárbaro Trilha do Fanático: a reserva do Campeão dos Deuses volta no
// Descanso Longo.
//
// PHB 2024, Campeão dos Deuses (Bárbaro nível 3, dados/classes/barbaro.json):
// "Você tem uma reserva de quatro d12s que pode gastar para se curar (...)
// Sua reserva restaura todos os dados gastos ao completar um Descanso
// Longo."
//
// O campo `campeao_deuses_gastos` era escrito ao gastar e lido para exibir
// "N/4 d12", mas NENHUM ponto do app o zerava -- o bloco do Bárbaro no
// Descanso Longo restaura fúria, presença intimidante e presença zelosa, e
// pula justamente este. Na prática a reserva era de uso único por
// personagem.
//
// Prova de navegador porque o Descanso Longo é um handler de botão da
// ficha: nenhum teste de unidade o executa.
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, assentar, clicarBotaoFicha, personagemSalvo } from './helpers-regras.mjs';

const FANATICO = {
  classe: 'Bárbaro', nivel: 3, xp: 355000, atributos: ATRIBUTOS_REGRAS,
  subclasse: 'Trilha do Fanático',
  pericias_proficientes: ['Atletismo', 'Percepção'],
  // Dois dos quatro d12 já gastos, como na ficha que reportou o problema.
  recursos: { campeao_deuses_gastos: 2 },
};

test('descanso longo: a reserva de d12 do Campeão dos Deuses é restaurada', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, FANATICO, 'regras-fanatico-dl');

  const antes = await personagemSalvo(page);
  expect(antes.recursos.campeao_deuses_gastos, 'a fixture precisa começar com dados gastos').toBe(2);

  await clicarBotaoFicha(page, 'btn-descanso-longo');
  await assentar(page).catch(() => {});
  // O Descanso Longo abre um modal de confirmação em algumas classes; o que
  // importa aqui é o estado gravado depois dele.
  await page.evaluate(() => window.fecharModal?.());
  await assentar(page).catch(() => {});

  const depois = await personagemSalvo(page);
  expect(depois.recursos.campeao_deuses_gastos,
    'os d12 gastos continuaram gastos depois do Descanso Longo').toBe(0);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
