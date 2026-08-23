// ============================================================
// Recursos por classe na ficha: o botao de uma classe nao pode aparecer
// carimbado como de outra.
//
// Defeito que este spec mede: `renderFeatureItem` lia os ESPELHOS
// (char.classe/char.subclasse), que apontam sempre para a classe INICIAL.
// Num Clerigo 5/Paladino 5, o bloco do Paladino era renderizado com a
// identidade do Clerigo e ganhava os botoes de Canalizar Divindade do
// Clerigo -- e o handler gasta `char.recursos.clerigo`, ou seja, clicar no
// botao do Paladino gastava o pool do Clerigo, e gravava.
//
// A correcao passou `ctx` por parametro e passou a carimbar todo elemento
// interativo com `data-classe`. Nada le esse atributo neste sub-projeto
// (3b): quem le e o 3c, para desambiguar seletores GENERICOS -- por
// exemplo `data-config-maestrias="1"`, emitido por cinco ramos de classe
// diferentes e consumido por um unico querySelectorAll.
//
// Este spec mede o DOM de verdade, montado pela ficha inteira -- os
// oraculos de unidade chamam renderFeatureItem direto, sem passar pelo
// laco por classe de caracteristicas.js.
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, assentar } from './helpers-regras.mjs';

test('Clerigo 5/Paladino 5: o botao do Clerigo carrega data-classe do Clerigo', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    classe: 'Clérigo',
    subclasse: 'Domínio da Vida',
    nivel: 10,
    xp: 64000,
    especie: 'Humano',
    atributos: ATRIBUTOS_REGRAS,
    pericias_proficientes: ['Medicina', 'Religião'],
    classes: [
      { classe: 'Clérigo', subclasse: 'Domínio da Vida', nivel: 5, ordem: 0 },
      { classe: 'Paladino', subclasse: 'Juramento da Devoção', nivel: 5, ordem: 1 },
    ],
    schema_versao: 2,
  }, 'regras-multiclasse-recursos-por-classe');
  await assentar(page).catch(() => {});

  // Abre todos os <details> -- os botoes vivem dentro deles, e o innerHTML
  // ja os traz mesmo fechados, mas abrir mantem o spec legivel se alguem
  // for depurar com trace.
  await page.evaluate(() => {
    document.querySelectorAll('details').forEach((d) => { d.open = true; });
  });

  // GUARDA CONTRA VACUIDADE: sem o widget do Clerigo no DOM, todas as
  // afirmacoes abaixo passariam por ausencia, nao por acerto.
  await expect.poll(
    () => page.locator('[data-clerigo-cd-acao]').count(),
    { message: 'o widget de Canalizar Divindade do Clerigo precisa aparecer na ficha' },
  ).toBeGreaterThan(0);

  // O carimbo existe, e e o do Clerigo.
  const classesDoWidgetClerigo = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-clerigo-cd-acao]'))
      .map((el) => el.getAttribute('data-classe')));

  expect(classesDoWidgetClerigo, 'todo botao data-clerigo-cd-acao carrega data-classe="Clérigo"')
    .toEqual(classesDoWidgetClerigo.map(() => 'Clérigo'));

  // A direcao oposta, que e o defeito de verdade: o botao do Clerigo nao
  // pode estar carimbado como do Paladino. Uma implementacao que carimbe
  // TODO elemento com a classe do primeiro bloco renderizado passaria na
  // afirmacao anterior mas nao nesta -- por isso as duas.
  expect(classesDoWidgetClerigo, 'nenhum botao do Clerigo pode estar carimbado como do Paladino')
    .not.toContain('Paladino');

  // PAR EM DIRECAO OPOSTA: "nenhum data-classe=Paladino no widget do
  // Clerigo" tambem seria satisfeito por um render que nunca emitisse
  // data-classe="Paladino" em lugar nenhum -- ou seja, pelo bug de hoje,
  // em que o bloco do Paladino sai com a identidade do Clerigo. Esta
  // afirmacao exige que o Paladino exista com a propria identidade.
  await expect
    .poll(() => page.locator('[data-classe="Paladino"]').count(),
      { message: 'o bloco do Paladino tem de emitir elementos com a SUA propria classe' })
    .toBeGreaterThan(0);

  expect(erros, 'nenhum erro de console').toEqual([]);
});
