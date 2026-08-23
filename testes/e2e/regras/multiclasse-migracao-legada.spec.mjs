// ============================================================
// Migração de ficha legada para o modelo de multiclasse.
//
// A ficha salva no formato antigo (classe/subclasse/nivel escalares,
// sem `classes`) tem de abrir, migrar em silêncio e continuar com
// EXATAMENTE os mesmos números. É o oráculo de regressão do
// sub-projeto 1: nada muda para o jogador.
// ============================================================
import { test, expect } from '@playwright/test';
import { abrirFicha, assentar, personagemSalvo } from './helpers-regras.mjs';

test('ficha legada migra na abertura sem mudar número nenhum', async ({ context }) => {
  // abrirFicha semeia o personagem com EXATAMENTE estes campos -- ou seja,
  // sem `classes` e sem `schema_versao`: uma ficha do formato antigo.
  const { page, erros } = await abrirFicha(context, {
    classe: 'Clérigo',
    subclasse: 'Domínio da Vida',
    nivel: 6,
    xp: 14000,
    atributos: { forca: 10, destreza: 12, constituicao: 14,
                 inteligencia: 10, sabedoria: 16, carisma: 12 },
    pericias_proficientes: ['Medicina', 'Religião'],
    pv_max: 44, pv_atual: 44,
    dados_vida_total: 6, dados_vida_usados: 2,
  }, 'regras-multiclasse-legada');
  await assentar(page).catch(() => {});

  const p = await personagemSalvo(page);

  expect(p, 'a ficha legada não pode ser descartada na validação').toBeTruthy();
  expect(p.classes, 'a migração cria o array de uma entrada').toEqual([
    { classe: 'Clérigo', subclasse: 'Domínio da Vida', nivel: 6, ordem: 0 },
  ]);
  expect(p.schema_versao).toBe(2);

  // NÃO DESTRUTIVA: os três escalares sobrevivem, agora como espelhos.
  expect(p.classe).toBe('Clérigo');
  expect(p.subclasse).toBe('Domínio da Vida');
  expect(p.nivel).toBe(6);

  // NADA MUDA PARA O JOGADOR: o PV é o mesmo de antes.
  expect(p.pv_max, 'a migração não pode recalcular PV').toBe(44);
  expect(p.pv_atual).toBe(44);

  // O gasto legado de dados de vida migra para a reserva do d8 do Clérigo.
  expect(p.dados_vida).toEqual({ 8: { total: 6, usados: 2 } });
  expect(p.dados_vida_usados, 'a soma espelhada preserva o valor legado').toBe(2);
  expect(p.dados_vida_total).toBe(6);

  expect(erros, 'nenhum erro de console na abertura').toEqual([]);
});

test('a migração é idempotente também no navegador', async ({ context }) => {
  const { page } = await abrirFicha(context, {
    classe: 'Mago', subclasse: 'Evocador', nivel: 4, xp: 2700,
    atributos: { forca: 8, destreza: 14, constituicao: 14,
                 inteligencia: 17, sabedoria: 12, carisma: 10 },
    pericias_proficientes: ['Arcanismo', 'História'],
  }, 'regras-multiclasse-idempotente');
  await assentar(page).catch(() => {});
  const primeira = await personagemSalvo(page);

  // Reabrir roda todas as migrações de novo.
  await page.reload();
  await assentar(page).catch(() => {});
  const segunda = await personagemSalvo(page);

  expect(segunda.classes, 'reabrir não pode duplicar entradas').toEqual(primeira.classes);
  expect(segunda.dados_vida).toEqual(primeira.dados_vida);
  expect(segunda.nivel).toBe(primeira.nivel);
});
