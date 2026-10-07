// ============================================================
// Issues #49/#50/#54 -- prova de tela: a magia personalizada que o
// jogador desmarcou como "sempre preparada" aparece candidata em Preparar
// Magias (Mago, via grimorio) e em Maestria de Magias/Assinatura Magica
// (Mago), do jeito que uma magia do livro apareceria.
// ============================================================
import { test, expect } from '@playwright/test';
import { abrirBlocosRecursos, abrirFicha, assentar, ATRIBUTOS_REGRAS, clicarSeletorFicha } from './helpers-regras.mjs';

const MAGO_5 = {
  nome: 'Aluno de Magia', especie: 'Humano', classe: 'Mago', subclasse: '',
  nivel: 5, xp: 6500, atributos: ATRIBUTOS_REGRAS,
  classes: [{ classe: 'Mago', subclasse: '', nivel: 5, ordem: 0 }],
  grimorio: [{ nome: 'Mísseis Mágicos', circulo: 1 }],
  schema_versao: 2,
};

// Clerigo 5: conjurador PREPARADO sem grimorio. Achado Important 4 da
// revisao de branch: a cláusula `atual.sempre_preparada === false` do filtro
// de magias_preparadas (site/js/sheet/magias.js, handler de exclusao) so e
// exercitada por uma classe SEM grimorio -- num Mago a limpeza vem da linha
// pre-existente do grimorio, logo acima dela, e a linha nova nunca era
// alcancada por teste nenhum.
const CLERIGO_5 = {
  nome: 'Devoto de Nimb', especie: 'Humano', classe: 'Clérigo', subclasse: '',
  nivel: 5, xp: 6500, atributos: ATRIBUTOS_REGRAS,
  classes: [{ classe: 'Clérigo', subclasse: '', nivel: 5, ordem: 0 }],
  schema_versao: 2,
};

/** Cria uma magia personalizada de 1o circulo pelo formulario da ficha, com o toggle no estado pedido. */
async function criarMagiaPersonalizada(page, { nome, semprePreparada }) {
  await page.locator('#btn-add-magia-custom').click();
  await assentar(page).catch(() => {});
  await page.locator('#mc-nome').fill(nome);
  await page.locator('#mc-circulo').selectOption('1');
  await page.locator('#mc-escola').selectOption('__personalizado__');
  await page.locator('#mc-escola-personalizada').fill('Evocação');
  await page.locator('#mc-tempo').selectOption('Ação');
  await page.locator('#mc-alcance').fill('18 metros');
  await page.locator('#mc-comp-v').check();
  await page.locator('#mc-duracao').selectOption('__personalizado__');
  await page.locator('#mc-duracao-texto').fill('Instantânea');
  if (!semprePreparada) await page.locator('#mc-sempre-preparada').uncheck();
  await page.locator('#btn-salvar-mc').click();
  await assentar(page).catch(() => {});
}

test('magia "sempre preparada" continua fora de Preparar Magias (nao regride)', async ({ context }) => {
  const { page } = await abrirFicha(context, MAGO_5, 'regras-magia-custom-1');
  await assentar(page).catch(() => {});
  await criarMagiaPersonalizada(page, { nome: 'Chama Eterna', semprePreparada: true });
  await page.locator('#btn-add-magia').click();
  await assentar(page).catch(() => {});
  // O grid de candidatas do circulo mora numa aba propria ("1º Círculo"),
  // separada da aba "Preparadas Atuais" que abre por padrao -- e onde uma
  // magia "sempre preparada" (nunca entra no grimorio) regrediria se
  // aparecesse como candidata a escolher.
  await page.locator('[data-tab-mg="1"]').click();
  await assentar(page).catch(() => {});
  await expect(page.locator('#resultado-magias')).not.toContainText('Chama Eterna');
});

test('magia "ocupa vaga" aparece candidata em Preparar Magias', async ({ context }) => {
  const { page } = await abrirFicha(context, MAGO_5, 'regras-magia-custom-2');
  await assentar(page).catch(() => {});
  await criarMagiaPersonalizada(page, { nome: 'Chama Azul', semprePreparada: false });
  await page.locator('#btn-add-magia').click();
  await assentar(page).catch(() => {});
  // A aba "Preparadas Atuais" abre por padrao e so lista o que ja esta
  // preparado; a candidata recem-injetada no grimorio mora na aba do seu
  // circulo ("1º Círculo").
  await page.locator('[data-tab-mg="1"]').click();
  await assentar(page).catch(() => {});
  await expect(page.locator('#resultado-magias')).toContainText('Chama Azul');
});

test('magia "ocupa vaga" aparece candidata de Maestria de Magias', async ({ context }) => {
  const MAGO_18 = { ...MAGO_5, nivel: 18, xp: 300000, classes: [{ classe: 'Mago', subclasse: '', nivel: 18, ordem: 0 }] };
  const { page } = await abrirFicha(context, MAGO_18, 'regras-magia-custom-3');
  await assentar(page).catch(() => {});
  await abrirBlocosRecursos(page);
  await criarMagiaPersonalizada(page, { nome: 'Chama Azul', semprePreparada: false });
  await page.locator('#painel-recursos-mago [data-mago-acao="definir-maestria-magias"]').click();
  await assentar(page).catch(() => {});
  await expect(page.locator('#magia-fixa-c1')).toContainText('Chama Azul');
});

test('excluir a magia "ocupa vaga" libera a vaga na lista de Preparar Magias', async ({ context }) => {
  // Caso da Tarefa 4/Step 4: exclusao de magia personalizada nao-Mago,
  // que so pode ser exercitado com clique real (nao no oraculo de
  // unidade -- ver o comentario no Step 1 da Tarefa 4). Usa Mago mesmo
  // (grimorio) para reaproveitar a mesma fixture e o mesmo botao
  // "Preparar Magias" ja usado nos testes acima. Este caso mede a linha
  // do GRIMORIO; a de magias_preparadas (demais classes) tem caso
  // proprio, logo abaixo -- o handler e o mesmo, a linha nao.
  const { page } = await abrirFicha(context, MAGO_5, 'regras-magia-custom-4');
  await assentar(page).catch(() => {});
  await criarMagiaPersonalizada(page, { nome: 'Chama Azul', semprePreparada: false });
  // O card da personalizada mora dentro de um <details> recolhido por
  // padrao ("1º Círculo" da secao Magias da ficha) -- clique por JS via
  // clicarSeletorFicha, como toda spec deste diretorio faz para botao
  // dentro de <details> (ver o docblock dela em helpers-regras.mjs).
  await clicarSeletorFicha(page, '[data-remover-magia-custom]', { esperar: '#btn-confirmar-remover-magia-custom' });
  await page.locator('#btn-confirmar-remover-magia-custom').click();
  await assentar(page).catch(() => {});
  await page.locator('#btn-add-magia').click();
  await assentar(page).catch(() => {});
  await page.locator('[data-tab-mg="1"]').click();
  await assentar(page).catch(() => {});
  await expect(page.locator('#resultado-magias')).not.toContainText('Chama Azul');
});

test('CLERIGO: excluir a magia "ocupa vaga" tira a entrada de magias_preparadas', async ({ context }) => {
  // Achado Important 4: o unico caso que exercita a limpeza de
  // magias_preparadas na exclusao (classe sem grimorio). Criar com a caixa
  // desmarcada injeta {nome, circulo, classe} em magias_preparadas; excluir
  // tem de tirar de la, senao sobra uma vaga fantasma que nenhum "x" da
  // tela resolve.
  const { page } = await abrirFicha(context, CLERIGO_5, 'regras-magia-custom-5');
  await assentar(page).catch(() => {});
  await criarMagiaPersonalizada(page, { nome: 'Prece Azul', semprePreparada: false });
  await clicarSeletorFicha(page, '[data-remover-magia-custom]', { esperar: '#btn-confirmar-remover-magia-custom' });
  await page.locator('#btn-confirmar-remover-magia-custom').click();
  await assentar(page).catch(() => {});
  await page.locator('#btn-add-magia').click();
  await assentar(page).catch(() => {});
  // A aba "Preparadas Atuais" abre por padrao e lista exatamente o que
  // esta em magias_preparadas -- e onde a vaga fantasma apareceria.
  await expect(page.locator('#resultado-magias')).not.toContainText('Prece Azul');
  // Assercao de DADO, nao so de tela: le o personagem gravado pelo mesmo
  // store.js que a ficha usa e confirma que a entrada saiu do array.
  const nomesPreparadas = await page.evaluate(async (id) => {
    const store = await import(new URL('./js/store.js', location.href).href);
    return (store.getPersonagem(id)?.magias_preparadas || []).map(m => m.nome);
  }, 'regras-magia-custom-5');
  expect(nomesPreparadas).not.toContain('Prece Azul');
});
