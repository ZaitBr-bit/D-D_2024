// ============================================================
// Necromante (Mago, Arcana Unleashed): escolha da subclasse com selo, Versado em
// Necromancia, concessões automáticas, familiar morto-vivo, Mortos-Vivos e as
// características de nível 6, 10 e 14. Todos CLICAM.
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, abrirBlocosRecursos, abrirFicha, abrirSite, assentar, clicarBotaoFicha, clicarSeletorFicha, personagemSalvo } from './helpers-regras.mjs';

const XP_POR_NIVEL = [0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000];

/** Mago Necromante do nível dado, Int 16 (+3), com magias de Necromancia no livro. */
const MAGO_NECRO = (nivel, extra = {}) => ({
  classe: 'Mago', subclasse: 'Necromante', nivel, xp: XP_POR_NIVEL[nivel - 1] ?? 165000,
  atributos: { ...ATRIBUTOS_REGRAS, inteligencia: 16 }, pericias_proficientes: ['Arcanismo', 'História'],
  grimorio: [{ nome: 'Raio Nauseante', circulo: 1 }, { nome: 'Animar Mortos', circulo: 3 }, { nome: 'Toque Vampírico', circulo: 3 }],
  magias_preparadas: [{ nome: 'Raio Nauseante', circulo: 1, classe: 'Mago' }, { nome: 'Toque Vampírico', circulo: 3, classe: 'Mago' }],
  ...extra,
});

/** Abre todos os <details> (a ficha nasce com os blocos recolhidos). */
async function abrirTudo(page) {
  await page.evaluate(() => { document.querySelectorAll('details').forEach((d) => { d.open = true; }); });
}

test('subclasse Necromante: aparece com selo de origem e suas características na ficha', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, MAGO_NECRO(6), 'necro-ficha');
  await assentar(page).catch(() => {});
  await abrirTudo(page);
  const secao = page.locator('.card', { has: page.locator('h2', { hasText: 'Subclasse — Necromante' }) });
  await expect(secao).toBeVisible();
  await expect(secao.locator('.selo-fonte')).toHaveText('Arcana');
  for (const nome of ['Versado em Necromancia', 'Livro de Magias Necromântico', 'Poder Sepulcral', 'Servos Mortos-Vivos', 'Servos Fortalecidos']) {
    await expect(secao.locator('summary', { hasText: nome })).toBeVisible();
  }
  await expect(secao.locator('summary', { hasText: 'Colher Mortos-Vivos' }), 'nível 10 ainda não').toHaveCount(0);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('criador: Necromante aparece entre as subclasses do Mago com o selo de origem', async ({ context }) => {
  const { page, erros } = await abrirSite(context, '#criar');
  await page.evaluate(async () => {
    const wizard = await import('./js/creator/wizard.js');
    wizard.personagem.nivel = 3;
  });
  await page.locator('[data-classe="Mago"] .opcao-resumo').first().click();
  await expect(page.locator('#sel-subclasse')).toBeVisible();
  await expect(page.locator('#sel-subclasse option[value="Necromante"]')).toHaveCount(1);
  await expect(page.locator('#sel-subclasse-fonte .selo-fonte')).toHaveCount(0);
  await page.selectOption('#sel-subclasse', 'Necromante');
  await expect(page.locator('#sel-subclasse-fonte .selo-fonte')).toHaveText('Arcana');
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('magia de Necromancia do livro: conjura na ficha e dá a Vitalidade Morta-Viva', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, MAGO_NECRO(9, {
    grimorio: [{ nome: 'Enervação', circulo: 5 }],
    magias_preparadas: [{ nome: 'Enervação', circulo: 5, classe: 'Mago' }],
    recursos: { mago: { subclasses: { necromante: { mortos_vivos: [
      { id: 'mv1', nome: 'Zumbi', pv_max: 30, pv_atual: 4, pv_temporarios: 0, dados_de_vida: 2 }] } } } },
  }), 'necro-magia-livro');
  await assentar(page).catch(() => {});
  await abrirTudo(page);
  await clicarSeletorFicha(page, '[data-conjurar="Enervação"]', { esperar: '#btn-fechar-vitalidade' });
  await expect(page.locator('#modal-corpo')).toContainText('14 PV');
  await page.locator('#btn-fechar-vitalidade').click();
  expect(Number((await personagemSalvo(page)).espacos_magia?.conjuracao?.[5] || 0), 'gastou o espaço de 5º círculo').toBe(1);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Necromante 3: Resistência Necrótica e Convocar Familiar entram sozinhos, uma vez só', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, MAGO_NECRO(3, { grimorio: [], magias_preparadas: [] }), 'necro-concessoes');
  await assentar(page).catch(() => {});
  let p = await personagemSalvo(page);
  expect(p.resistencias).toContain('Necrótico');
  expect(p.grimorio.filter((m) => m.nome === 'Convocar Familiar')).toHaveLength(1);
  await page.reload();
  await assentar(page).catch(() => {});
  p = await personagemSalvo(page);
  expect(p.resistencias.filter((r) => r === 'Necrótico')).toHaveLength(1);
  expect(p.grimorio.filter((m) => m.nome === 'Convocar Familiar')).toHaveLength(1);
  await abrirTudo(page);
  await expect(page.locator('.card', { has: page.locator('h2', { hasText: 'Defesas' }) })).toContainText('Necrótico');
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Necromante: o familiar oferece Esqueleto e Zumbi e o tipo Morto-Vivo', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, MAGO_NECRO(3, {
    grimorio: [{ nome: 'Convocar Familiar', circulo: 1 }], magias_preparadas: [{ nome: 'Convocar Familiar', circulo: 1, classe: 'Mago' }],
  }), 'necro-familiar');
  await assentar(page).catch(() => {});
  await abrirTudo(page);
  await clicarSeletorFicha(page, '[data-conjurar-ritual="Convocar Familiar"]', { esperar: '#btn-confirmar-familiar' });
  await expect(page.locator('[data-familiar-card="Esqueleto"]')).toBeVisible();
  await expect(page.locator('[data-familiar-card="Zumbi"]')).toBeVisible();
  await page.locator('[data-familiar-toggle="Gato"]').click();
  await page.locator('[data-familiar-tipo="Morto-Vivo"]').click();
  await page.locator('#btn-confirmar-familiar').click();
  await assentar(page).catch(() => {});
  await expect(page.locator('#card-familiar')).toContainText('Morto-Vivo');
  await expect(page.locator('#card-familiar')).toContainText('abrir mão de um ataque');
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Vitalidade Morta-Viva e registro após Animar Mortos', async ({ context }) => {
  // Entrada como a subida de nível grava: Animar Mortos sempre preparada, uso grátis disponível.
  const { page, erros } = await abrirFicha(context, MAGO_NECRO(6, {
    magias_preparadas: [
      { nome: 'Toque Vampírico', circulo: 3, classe: 'Mago' },
      { nome: 'Animar Mortos', circulo: 3, classe: 'Mago', origem: 'subclasse', gratis_usado: false },
    ],
    recursos: { mago: { subclasses: { necromante: { mortos_vivos: [
      { id: 'mv1', nome: 'Zumbi', pv_max: 30, pv_atual: 5, pv_temporarios: 0, dados_de_vida: 2 }] } } } },
  }), 'necro-vitalidade');
  await assentar(page).catch(() => {});
  await abrirTudo(page);

  // Magia de Necromancia com espaço (3º círculo): informa 3 + nível 6 = 9 PV.
  await clicarSeletorFicha(page, '[data-conjurar="Toque Vampírico"]', { esperar: '#btn-fechar-vitalidade' });
  await expect(page.locator('#btn-fechar-vitalidade'), 'o modal de Vitalidade abre quando há Morto-Vivo ferido').toBeVisible();
  await expect(page.locator('#modal-corpo')).toContainText('9 PV');
  // O card do Morto-Vivo abre a ficha; o botão cura sem abrir a ficha.
  await page.locator('[data-vitalidade-ficha="0"] .opcao-nome').click();
  await expect(page.locator('#familiar-popup-sobreposto, #familiar-popup-sobreposicao')).toContainText('Zumbi');
  await page.locator('#btn-fechar-familiar-popup').click();
  await page.locator('[data-vitalidade-acao="curar"]').click();
  await assentar(page).catch(() => {});
  const curado = (await personagemSalvo(page)).recursos.mago.subclasses.necromante.mortos_vivos[0];
  expect(curado.pv_atual, '5 + 9 de Vitalidade').toBe(14);

  // Animar Mortos de graça (Servos Mortos-Vivos): sem espaço, sem Vitalidade, mas oferece o registro.
  await abrirTudo(page);
  await clicarSeletorFicha(page, '[data-conjurar-gratis="Animar Mortos"]', { esperar: '#btn-confirmar-registro-mortos-vivos' });
  await expect(page.locator('[data-vitalidade-acao="curar"]'), 'sem espaço gasto não há Vitalidade').toHaveCount(0);
  await page.locator('#btn-cancelar-registro-mortos-vivos').click();
  await expect(page.locator('#btn-confirmar-registro-mortos-vivos')).toBeHidden();
  expect((await personagemSalvo(page)).recursos?.mago?.subclasses?.necromante?.mortos_vivos ?? []).toHaveLength(1); // só o Zumbi do cenário; o cancelamento não registrou nada novo
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Resiliência Sepulcral: a Recuperação Arcana tira 1 nível de Exaustão', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, MAGO_NECRO(6, {
    exaustao: 2, condicoes: ['Exaustão'], espacos_magia: { conjuracao: { 1: 3 } },
  }), 'necro-resiliencia');
  await assentar(page).catch(() => {});
  await abrirBlocosRecursos(page);
  await clicarSeletorFicha(page, '#painel-recursos-mago [data-mago-acao="recuperacao-arcana"]', { esperar: '#btn-recuperar-confirmar' });
  await page.locator('.recuperar-slot[data-circulo="1"]').fill('1');
  await page.locator('.recuperar-slot[data-circulo="1"]').blur();
  await page.locator('#btn-recuperar-confirmar').click();
  await assentar(page).catch(() => {});
  await expect(page.locator('#toast-container')).toContainText('Resiliência Sepulcral');
  expect((await personagemSalvo(page)).exaustao).toBe(1);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Colher Mortos-Vivos (nível 10): o morto-vivo escolhido sai da lista e o mago recupera PV', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, MAGO_NECRO(10, {
    pv_atual: 5, recursos: { mago: { subclasses: { necromante: { mortos_vivos: [
      { id: 'mv1', nome: 'Esqueleto', pv_max: 19, pv_atual: 19, pv_temporarios: 0, dados_de_vida: 2 }] } } } },
  }), 'necro-colher');
  await assentar(page).catch(() => {});
  const antes = (await personagemSalvo(page)).pv_atual;
  await clicarSeletorFicha(page, '[data-necromante-acao="colher"]', { esperar: '#btn-confirmar-colher' });
  await page.locator('#btn-confirmar-colher').click();
  await assentar(page).catch(() => {});
  const p = await personagemSalvo(page);
  expect(p.pv_atual).toBe(Math.min(p.pv_max, antes + 10));
  expect(p.recursos.mago.subclasses.necromante.mortos_vivos).toHaveLength(0);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Fortalecer (nível 14): PV temporários nos Mortos-Vivos, 1x por Descanso Longo', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, MAGO_NECRO(14, {
    recursos: { mago: { subclasses: { necromante: { mortos_vivos: [
      { id: 'mv1', nome: 'Zumbi', pv_max: 30, pv_atual: 30, pv_temporarios: 0, dados_de_vida: 3 }] } } } },
  }), 'necro-fortalecer');
  await assentar(page).catch(() => {});
  await clicarSeletorFicha(page, '[data-necromante-acao="fortalecer"]');
  await assentar(page).catch(() => {});
  let necro = (await personagemSalvo(page)).recursos.mago.subclasses.necromante;
  expect(necro.mortos_vivos[0].pv_temporarios).toBe(14);
  expect(necro.fortalecer_usado).toBe(true);
  await expect(page.locator('[data-necromante-acao="fortalecer"]')).toBeDisabled();
  await clicarBotaoFicha(page, 'btn-descanso-longo');
  await assentar(page).catch(() => {});
  if (await page.locator('#btn-pular-troca-dl').isVisible().catch(() => false)) await page.locator('#btn-pular-troca-dl').click();
  await assentar(page).catch(() => {});
  necro = (await personagemSalvo(page)).recursos.mago.subclasses.necromante;
  expect(necro.fortalecer_usado, 'o Descanso Longo devolve o uso').toBe(false);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Extinguir (nível 14): rola os d6 e, num Morto-Vivo não controlado, gasta espaço de 5º círculo', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, MAGO_NECRO(14), 'necro-extinguir');
  await assentar(page).catch(() => {});
  await clicarSeletorFicha(page, '[data-necromante-acao="extinguir"]', { esperar: '#btn-confirmar-extinguir' });
  await page.locator('#extinguir-dv').fill('5');
  await page.locator('#extinguir-dv').blur();
  await page.locator('#extinguir-controlado').uncheck();
  await page.locator('#btn-confirmar-extinguir').click();
  await expect(page.locator('#btn-fechar-extinguir')).toBeVisible();
  const gastos5 = Number((await personagemSalvo(page)).espacos_magia?.conjuracao?.[5] || 0);
  expect(gastos5, 'não controlado: Reação + espaço de 5º círculo ou superior').toBe(1);
  await expect(page.locator('#modal-corpo')).toContainText('3d6');
  await page.locator('#btn-fechar-extinguir').click();

  await clicarSeletorFicha(page, '[data-necromante-acao="extinguir"]', { esperar: '#btn-confirmar-extinguir' });
  await page.locator('#extinguir-controlado').check();
  await page.locator('#btn-confirmar-extinguir').click();
  await expect(page.locator('#btn-fechar-extinguir')).toBeVisible();
  expect(Number((await personagemSalvo(page)).espacos_magia?.conjuracao?.[5] || 0), 'controlado: sem custo').toBe(1);
  await page.locator('#btn-fechar-extinguir').click();
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Livro de magias: linha em Ataques ocupa 1 mão e o aviso do card some ao empunhar', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, MAGO_NECRO(6), 'necro-livro');
  await assentar(page).catch(() => {});
  const card = page.locator('#card-mortos-vivos');
  await expect(card, 'sem o livro na mão, avisa e não bloqueia').toContainText('Livro de magias não empunhado');
  await expect(page.locator('#secao-ataques #ataque-livro'), 'a linha do livro aparece mesmo sem arma equipada').toContainText('Guardado');
  await expect(page.locator('#btn-ataques-maos')).toContainText('(0/2)');

  await page.locator('[data-ataque-livro-info]').click();
  const popup = page.locator('#familiar-popup-sobreposicao');
  await expect(popup).toContainText('ocupa 1 mão');
  await expect(popup).toContainText('Resiliência Sepulcral');
  await expect(popup).toContainText('Recuperação Arcana');
  await expect(popup).toContainText('Fortitude Morta-Viva');
  await expect(popup, 'Mestre da Morte ainda não está ativa no nível 6').toContainText('Nível 14');
  await page.locator('#btn-fechar-familiar-popup').click();
  await clicarSeletorFicha(page, '[data-ataque-livro-acao="alternar"]');
  await assentar(page).catch(() => {});
  await expect(page.locator('#ataque-livro')).toContainText('Empunhado');
  await expect(page.locator('#btn-ataques-maos')).toContainText('(1/2)');
  await expect(card).not.toContainText('Livro de magias não empunhado');
  expect((await personagemSalvo(page)).recursos.mago.subclasses.necromante.livro_empunhado).toBe(true);

  await clicarSeletorFicha(page, '[data-ataque-livro-acao="alternar"]');
  await assentar(page).catch(() => {});
  await expect(page.locator('#btn-ataques-maos')).toContainText('(0/2)');
  await expect(card).toContainText('Livro de magias não empunhado');
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Extinguir: escolher um Morto-Vivo registrado preenche os Dados de Vida e o tira da lista sem custo', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, MAGO_NECRO(14, {
    recursos: { mago: { subclasses: { necromante: { mortos_vivos: [
      { id: 'mv1', nome: 'Zumbi', pv_max: 30, pv_atual: 0, pv_temporarios: 0, dados_de_vida: 3 },
      { id: 'mv2', nome: 'Esqueleto', pv_max: 19, pv_atual: 19, pv_temporarios: 0, dados_de_vida: 2 }] } } } },
  }), 'necro-extinguir-registrado');
  await assentar(page).catch(() => {});
  await clicarSeletorFicha(page, '[data-necromante-acao="extinguir"]', { esperar: '#btn-confirmar-extinguir' });
  await expect(page.locator('#extinguir-dv'), 'o primeiro registrado já vem escolhido').toHaveValue('3');
  await expect(page.locator('#extinguir-controlado')).toBeChecked();
  await page.locator('[data-extinguir-card="mv2"]').click();
  await expect(page.locator('#extinguir-dv')).toHaveValue('2');
  await page.locator('[data-extinguir-card="mv1"]').click();
  await page.locator('#btn-confirmar-extinguir').click();
  await expect(page.locator('#btn-fechar-extinguir')).toBeVisible();
  await expect(page.locator('#modal-corpo')).toContainText('2d6');
  const p = await personagemSalvo(page);
  expect(p.recursos.mago.subclasses.necromante.mortos_vivos.map((m) => m.id), 'o explodido sai da lista').toEqual(['mv2']);
  expect(Number(p.espacos_magia?.conjuracao?.[5] || 0), 'controlado: sem espaço gasto').toBe(0);
  await page.locator('#btn-fechar-extinguir').click();
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Mortos-Vivos: registrar com Fortitude, mexer nos PV pelo modal e dispensar', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, MAGO_NECRO(6), 'necro-mortos-vivos');
  await assentar(page).catch(() => {});
  const card = page.locator('#card-mortos-vivos');
  await expect(card, 'o card aparece para o Necromante').toBeVisible();

  await clicarSeletorFicha(page, '[data-necromante-acao="registrar"]', { esperar: '#btn-confirmar-registro-mortos-vivos' });
  await page.locator('[data-familiar-toggle="Esqueleto"]').click();
  await page.locator('#registro-quantidade').fill('2');
  await page.locator('#btn-confirmar-registro-mortos-vivos').click();
  await assentar(page).catch(() => {});
  await expect(card.locator('[data-morto-vivo]')).toHaveCount(2);
  const primeiro = card.locator('[data-morto-vivo]').first();
  await expect(primeiro, 'tipo, CA, deslocamento e ND como no card do Familiar').toContainText('Morto-Vivo Médio');
  await expect(primeiro).toContainText('CA 13');
  await expect(primeiro).toContainText('9 m');
  await expect(primeiro).toContainText('ND 1/4');
  await primeiro.locator('strong').click();
  await expect(page.locator('#familiar-popup-sobreposicao')).toContainText('Esqueleto');
  await page.locator('#btn-fechar-familiar-popup').click();
  const salvo = (await personagemSalvo(page)).recursos.mago.subclasses.necromante.mortos_vivos;
  expect(salvo[0].pv_max, 'PV do Esqueleto (13) + Int 3 + metade do nível 3').toBe(13 + 6);

  await card.locator('[data-morto-vivo]').first().locator('[data-necromante-acao="dano"]').click();
  const campo = page.locator('#input-criatura-dano-manual');
  await campo.fill('4');
  await campo.blur();
  await page.locator('#btn-aplicar-dano-criatura').click();
  await assentar(page).catch(() => {});
  await expect(card.locator('[data-morto-vivo]').first()).toContainText(`PV ${13 + 6 - 4}/${13 + 6}`);

  await expect(card, 'Golpe Debilitante informado').toContainText('+3 de dano Necrótico');
  await card.locator('[data-morto-vivo]').first().locator('[data-necromante-acao="dispensar"]').click();
  await assentar(page).catch(() => {});
  await expect(card.locator('[data-morto-vivo]')).toHaveCount(1);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Invocar Morto-Vivo: escolhe a forma do Espírito, registra com PV do círculo e mantém o familiar e os outros', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, MAGO_NECRO(6, {
    grimorio: [{ nome: 'Invocar Morto-Vivo', circulo: 3 }, { nome: 'Convocar Familiar', circulo: 1 }],
    magias_preparadas: [{ nome: 'Invocar Morto-Vivo', circulo: 3, classe: 'Mago' }],
    recursos: { familiar: { forma: 'Esqueleto', tipo: '', especial: true, pv_max: 13, pv_atual: 13, situacao: 'ativo', origem: '' },
      mago: { subclasses: { necromante: { mortos_vivos: [{ id: 'mv1', nome: 'Zumbi', pv_max: 15, pv_atual: 5, pv_temporarios: 0, dados_de_vida: 2 }] } } } },
  }), 'necro-espirito');
  await assentar(page).catch(() => {});
  await abrirTudo(page);
  await clicarSeletorFicha(page, '[data-conjurar="Invocar Morto-Vivo"]', { esperar: '#btn-confirmar-espirito' });
  await expect(page.locator('[data-espirito-forma]')).toHaveCount(3);
  // Cada card abre os detalhes da forma e o popup oferece escolher.
  await page.locator('[data-espirito-info="Fantasmagórico"]').click();
  await expect(page.locator('#familiar-popup-sobreposicao')).toContainText('Passagem Incorpórea');
  await page.locator('#btn-fechar-familiar-popup').click();
  await page.locator('[data-espirito-info="Pútrido"]').click();
  await page.locator('#btn-escolher-familiar-popup').click();
  await expect(page.locator('[data-espirito-info="Pútrido"]')).toHaveClass(/selecionada/);
  await page.locator('#btn-confirmar-espirito').click();
  // Depois do espírito, a Vitalidade oferece curar o Zumbi ferido (5 + 8 = 13).
  await expect(page.locator('[data-vitalidade-acao="curar"]')).toBeVisible();
  await page.locator('[data-vitalidade-acao="curar"]').click();
  await assentar(page).catch(() => {});
  const card = page.locator('#card-mortos-vivos');
  const espirito = card.locator('[data-morto-vivo]', { hasText: 'Espírito Morto-Vivo (Pútrido)' });
  await expect(espirito).toContainText('PV 36/36');
  await expect(espirito).toContainText('CA 14');
  await expect(espirito).toContainText('Garra Podre');
  await expect(card.locator('[data-morto-vivo]')).toHaveCount(2);
  await espirito.locator('strong').click();
  await expect(page.locator('#familiar-popup-sobreposicao')).toContainText('1d6 + 3 + 3');
  await page.locator('#btn-fechar-familiar-popup').click();
  const salvo = await personagemSalvo(page);
  expect(salvo.recursos.familiar.forma, 'o familiar do Convocar Familiar continua').toBe('Esqueleto');
  expect(salvo.recursos.mago.subclasses.necromante.mortos_vivos.map((m) => m.nome)).toContain('Zumbi');
  expect(salvo.recursos.mago.subclasses.necromante.mortos_vivos.find((m) => m.nome === 'Zumbi').pv_atual, 'Vitalidade: 5 + (3 + nível 6 = 9) limitado a 15').toBe(14);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Invocar Morto-Vivo: "Agora não" fecha a escolha sem registrar nenhum espírito', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, MAGO_NECRO(6, {
    grimorio: [{ nome: 'Invocar Morto-Vivo', circulo: 3 }],
    magias_preparadas: [{ nome: 'Invocar Morto-Vivo', circulo: 3, classe: 'Mago' }],
  }), 'necro-espirito-cancelar');
  await assentar(page).catch(() => {});
  await abrirTudo(page);
  await clicarSeletorFicha(page, '[data-conjurar="Invocar Morto-Vivo"]', { esperar: '#btn-confirmar-espirito' });
  await expect(page.locator('#btn-confirmar-espirito')).toBeDisabled();
  await page.locator('#btn-cancelar-espirito').click();
  await expect(page.locator('#btn-confirmar-espirito')).toBeHidden();
  const salvo = await personagemSalvo(page);
  expect(salvo.recursos?.mago?.subclasses?.necromante?.mortos_vivos ?? []).toHaveLength(0);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

test('Vitalidade Morta-Viva sem Morto-Vivo ferido: só um aviso rápido, sem modal', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, MAGO_NECRO(9, {
    grimorio: [{ nome: 'Enervação', circulo: 5 }],
    magias_preparadas: [{ nome: 'Enervação', circulo: 5, classe: 'Mago' }],
  }), 'necro-vitalidade-sem-candidato');
  await assentar(page).catch(() => {});
  await abrirTudo(page);
  await clicarSeletorFicha(page, '[data-conjurar="Enervação"]');
  await expect(page.locator('#toast-container')).toContainText('nenhum ferido registrado');
  await expect(page.locator('#btn-fechar-vitalidade')).toHaveCount(0);
  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
