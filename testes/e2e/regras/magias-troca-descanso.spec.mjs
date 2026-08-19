// ============================================================
// O que o Descanso Longo oferece de troca de magias, por classe.
//
// A REGRA É DECISÃO DE PRODUTO, e se afasta da tabela do livro de propósito:
// no Descanso Longo TODA classe conjuradora troca UMA magia -- nunca a lista
// inteira. Remontar a lista é da subida de nível. A regra e cada afastamento
// da tabela estão escritos em `site/js/regras-preparo-magias.js` e conferidos
// por `testes/regras/unidade/magias-preparo.test.mjs`.
//
// Antes, o app decidia por `tipo_conjuracao` -- um campo de dois valores --,
// e o resultado era desigual sem ninguém ter decidido assim: Clérigo, Druida
// e Mago abriam a lista COMPLETA, Guardião e Paladino também, e Bardo, Bruxo
// e Feiticeiro não tinham troca de magia nenhuma aqui.
//
// As três classes deste spec cobrem os três comportamentos ANTIGOS distintos,
// que hoje precisam ser o mesmo -- é isso que dá valor ao conjunto. Só afirmar
// que o Mago troca uma passaria numa tela onde todo mundo continua diferente.
//
// O que só o navegador prova é a TRAVESSIA: que `hp-descanso.js` consulta a
// regra e monta o modal certo.
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirFicha, assentar, clicarBotaoFicha } from './helpers-regras.mjs';

// As magias preparadas não são decoração: o modal de troca desiste com um
// toast quando não há nenhuma para trocar, e nunca chega a abrir. Sem elas o
// spec falharia por falta de dado, não por regra.
const BASE = { nivel: 5, xp: 14000, atributos: ATRIBUTOS_REGRAS };

const CASOS = [
  {
    nome: 'Guardião', id: 'guardiao',
    antes: 'abria a lista completa',
    semente: {
      ...BASE, classe: 'Guardião', pericias_proficientes: ['Natureza', 'Percepção'],
      magias_preparadas: [{ nome: 'Curar Ferimentos', circulo: 1 }, { nome: 'Alarme', circulo: 1 }],
    },
  },
  {
    nome: 'Mago', id: 'mago',
    antes: 'abria a lista completa',
    semente: {
      ...BASE, classe: 'Mago', pericias_proficientes: ['Arcanismo', 'História'],
      grimorio: [{ nome: 'Mísseis Mágicos', circulo: 1 }, { nome: 'Detectar Magia', circulo: 1 }],
      magias_preparadas: [{ nome: 'Mísseis Mágicos', circulo: 1 }, { nome: 'Detectar Magia', circulo: 1 }],
    },
  },
  {
    nome: 'Bardo', id: 'bardo',
    antes: 'não recebia troca de magia nenhuma',
    semente: {
      ...BASE, classe: 'Bardo', pericias_proficientes: ['Atuação', 'Persuasão'],
      magias_preparadas: [{ nome: 'Curar Ferimentos', circulo: 1 }, { nome: 'Comando', circulo: 1 }],
    },
  },
];

for (const caso of CASOS) {
  test(`descanso longo: ${caso.nome} troca UMA magia (antes ${caso.antes})`, async ({ context }) => {
    const { page, erros } = await abrirFicha(
      context, caso.semente, `regras-troca-dl-${caso.id}`);

    await clicarBotaoFicha(page, 'btn-descanso-longo');
    await assentar(page).catch(() => {});

    const botaoTroca = page.locator('#btn-trocar-magias-dl');
    await expect(botaoTroca,
      `${caso.nome} deveria receber a troca de magia no Descanso Longo -- a regra vale para toda ` +
      `classe conjuradora`)
      .toBeVisible();

    await botaoTroca.click();
    await assentar(page).catch(() => {});

    // O modal de trocar UMA (`mostrarTrocaMagiaConhecida`) traz
    // `#btn-confirmar-troca-conhecida`; o de lista completa
    // (`mostrarTrocaMagias`) traz `#btn-confirmar-troca`. É o que separa as
    // duas quantidades na tela.
    await expect(page.locator('#btn-confirmar-troca-conhecida'),
      `${caso.nome} deveria receber o modal de trocar UMA magia`)
      .toBeVisible();
    await expect(page.locator('#btn-confirmar-troca'),
      `o modal de lista completa não existe mais no Descanso Longo -- remontar a lista é da ` +
      `subida de nível`)
      .toHaveCount(0);

    expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
  });
}
