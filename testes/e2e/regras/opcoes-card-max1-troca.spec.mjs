// ============================================================
// Prova por navegador de que um seletor de cards de escolha ÚNICA
// (montarSeletor com max:1, ui-opcoes.js) permite TROCAR a seleção com um
// clique direto na opção nova, sem exigir desmarcar a atual antes.
//
// Achado da Rodada 1 de correção da Task 14 (bug da Task 2, na criação de
// ui-opcoes.js): `cardHtml` calculava `cheio` como `estado.selecionadas
// .length >= max && !sel`, sem olhar para `max`. Com `max: 1`, assim que
// UMA opção era marcada, TODAS as outras (não bloqueadas) recebiam
// `data-cheio="1"` -- e o handler de clique (`if (!card || card.dataset
// .cheio) return;`) retornava cedo nelas, então o ramo que troca a seleção
// (`else if (max === 1) { estado.selecionadas = [id]; }`) nunca era
// alcançado por um clique direto. Visualmente, as opções não-marcadas
// ficavam com `opacity:0.5;cursor:not-allowed` -- pareciam desabilitadas,
// não só clicavam sem efeito. Isso atingia TODA lista de escolha única do
// app (Estilo de Luta, talento nas três telas, arma de Mestre das Armas,
// magia de Iniciado em Magia) -- o caso mais grave era "Substituir magia"
// de Iniciado em Magia (sheet/talentos.js), que nasce com a magia atual
// JÁ marcada, então a tela nascia travada: nenhuma outra opção era
// clicável sem antes desmarcar a atual.
//
// Escapou das conferências funcionais das tasks anteriores porque todas
// testaram ESCOLHER uma opção (partindo de nada marcado), nunca TROCAR de
// opção depois de já ter uma marcada -- exatamente o cenário que faltava.
// Corrigido em ui-opcoes.js: `cheio` só se aplica quando `max > 1`.
//
// POR QUE ESTA TELA (e não mais `#levelup-talento-lista`): a lista de
// talentos da subida de nível passou a se RECOLHER ao escolher (só o card
// escolhido fica, com um link "trocar talento"), então lá o estado "uma
// marcada + clique direto em outra" deixou de existir e não serve mais de
// veículo para este guarda -- ver opcoes-talento-recolhe.spec.mjs, que
// cobre o recolhimento. O modal "+ Talento" da ficha (sheet/talentos.js,
// `#add-talento-lista`) usa o MESMO montarSeletor com max:1 e não recolhe,
// então continua exercitando exatamente a causa raiz -- que é do
// componente, não de um consumidor.
// ============================================================
import { test, expect } from '@playwright/test';
import { abrirFicha, personagemSalvo } from './helpers-regras.mjs';

test('seletor de cards (max:1): trocar a seleção com um clique direto, sem desmarcar antes', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    classe: 'Guerreiro', nivel: 3, xp: 355000,
    atributos: { forca: 15, destreza: 14, constituicao: 14, inteligencia: 13, sabedoria: 13, carisma: 13 },
    pericias_proficientes: ['Atletismo', 'História'],
  }, 'regressao-troca-max1');

  await page.locator('#btn-add-talento').click();
  await page.waitForSelector('#add-talento-lista .opcao-card', { state: 'visible', timeout: 10_000 });

  // Alerta e Sortudo: dois talentos "de Origem" SEM aumento de atributo e
  // sem escolhas obrigatórias -- confirmar grava direto, sem o segundo
  // modal "Configurar Talento", então o teste mede a troca e nada mais.
  const cardAlerta = page.locator('#add-talento-lista .opcao-card[data-opcao="Alerta"]');
  const cardSortudo = page.locator('#add-talento-lista .opcao-card[data-opcao="Sortudo"]');
  await cardAlerta.waitFor({ state: 'visible', timeout: 5000 });
  await cardSortudo.waitFor({ state: 'visible', timeout: 5000 });

  // 1. Marca Alerta primeiro.
  await cardAlerta.click();
  await expect(cardAlerta, 'Alerta não marcou no primeiro clique').toHaveClass(/selecionada/);

  // 2. Com Alerta marcado, Sortudo (outra opção do MESMO grupo, max:1) não
  // pode parecer nem se comportar como desabilitada -- nem `data-cheio`
  // (o handler de clique verifica esse atributo antes de qualquer outra
  // coisa), nem o estilo de opacidade/cursor que o acompanha.
  await expect(cardSortudo, 'Sortudo ficou marcada como "cheia" (data-cheio) só por Alerta estar selecionado -- ' +
    'o limite max:1 não deveria bloquear a TROCA, só impedir marcar duas ao mesmo tempo')
    .not.toHaveAttribute('data-cheio', /.*/);
  const estiloSortudo = await cardSortudo.getAttribute('style');
  expect(estiloSortudo || '', 'Sortudo ganhou opacity/cursor de bloqueio por causa do limite -- não deveria parecer desabilitada')
    .not.toMatch(/opacity|not-allowed/);

  // 3. Clique DIRETO em Sortudo (sem desmarcar Alerta antes) precisa trocar
  // a seleção num clique só.
  await cardSortudo.click();
  await expect(cardSortudo, 'clique direto em Sortudo não marcou -- a troca de seleção não aconteceu').toHaveClass(/selecionada/);
  await expect(cardAlerta, 'Alerta continuou marcado depois de clicar em Sortudo -- deveria ter desmarcado (max:1)').not.toHaveClass(/selecionada/);

  // 4. A troca reflete de verdade no estado que vai para o personagem, não
  // só na classe CSS: confirma e lê o personagem gravado.
  await page.locator('#btn-confirmar-add-talento').click();
  await page.waitForTimeout(700);

  const salvo = await personagemSalvo(page);
  expect(salvo?.talentos, 'o talento salvo deveria ser Sortudo (a troca), não Alerta (a escolha original)')
    .toContain('Sortudo');
  expect(salvo?.talentos, 'Alerta não deveria ter sido salvo -- só Sortudo foi confirmado')
    .not.toContain('Alerta');

  expect(erros).toEqual([]);
});
