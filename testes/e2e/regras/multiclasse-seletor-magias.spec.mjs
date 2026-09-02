// ============================================================
// Seletor de superfície de conjuração (Tarefa 4, sub-projeto "tela magias
// por classe") -- a ÚNICA prova, com o app rodando de verdade, de que a
// tela de Magias e o motor concordam.
//
// T1 criou `superficiesDeConjuracao` (regras-multiclasse-conjuracao.js) e
// `superficiesDaFicha` (sheet/contexto-classe.js). T2 converteu o modal
// "Preparar Magias" (sheet/grimorio.js) e T3 converteu a seção Magias da
// ficha (sheet/magias.js) para lerem de lá -- mas as três só foram
// verificadas por unidade e por leitura, nunca com um navegador de
// verdade. Nenhum spec desta suíte jamais clicou em #btn-add-magia.
//
// O defeito original (issue relatada): um Orc Ladino 5/Mago 1 abria
// "Preparar Magias" e via `404 classes/magias_ladino.json`, seguido de
// "Truques: 3/0" e "Preparadas: 0/0" -- porque tudo lia o espelho
// char.classe (Ladino, a classe inicial, sem conjuração nenhuma) em vez de
// procurar entre classes[] a classe que REALMENTE conjura (Mago).
//
// Esta Tarefa 4 acrescenta o SELETOR: quando o personagem tem mais de uma
// superfície de conjuração, uma aba por classe aparece na seção Magias da
// ficha (`#tabs-superficie-magia`) e escolhe qual delas
// `superficieAtivaDaFicha` (sheet/contexto-classe.js) devolve -- a MESMA
// variável que o modal "Preparar Magias" lê. Com uma classe só (a maioria
// dos personagens) o seletor não aparece e nada muda -- é o cenário 2,
// abaixo, o canário disso.
//
// Rodada 1 de revisão: as duas leituras abaixo (lerContadorModal/
// lerContadorFicha) passaram a andar SEMPRE dentro de `expect.poll` --
// mesmo padrão de multiclasse-ca-seletor.spec.mjs (exigirCaixaCA/
// caixaCA). Hoje cada leitura vem depois de uma asserção que já espera
// (o clique da troca de aba, `clicarSeletorFicha`, só resolve depois do
// `.active` aparecer), então uma leitura única já seria segura -- mas essa
// segurança depende de nenhuma das duas virar produtora assíncrona no
// futuro, e este projeto já foi mordido por essa mesma suposição duas
// vezes. `expect.poll` custa uma linha a mais e não depende dessa aposta.
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, NOVO, abrirFicha, assentar, clicarSeletorFicha } from './helpers-regras.mjs';
// semearPersonagem não é reexportado por helpers-regras.mjs (só abrirFicha,
// que usa a função internamente para abrir uma página NOVA por chamada).
// O cenário 5 (o vazamento entre personagens) precisa semear um SEGUNDO
// personagem na MESMA página/processo que o primeiro -- uma página nova
// recarregaria os módulos do zero e o teste passaria à toa, sem medir
// reset nenhum -- então importa direto, como helpers-regras.mjs mesmo faz.
import { semearPersonagem } from '../helpers.mjs';

/**
 * Abre o modal "Preparar Magias" (o botão de mesmo nome da seção Magias) e
 * espera a grade de resultados existir -- `mostrarBuscaMagia` é async
 * (carrega a lista de magias da classe antes de montar o HTML), então
 * esperar o elemento (em vez de um timeout fixo) é o que cobre essa
 * corrida.
 */
async function abrirGerenciarMagias(page) {
  await page.click('#btn-add-magia');
  await page.waitForSelector('#resultado-magias', { state: 'visible', timeout: 20_000 });
  await assentar(page).catch(() => {});
}

/**
 * Lê "N / M" de um dos contadores do TOPO do modal "Preparar Magias"
 * (#gm-contador-truques ou #gm-contador-preparadas) e devolve os dois
 * números. `null` se o contador não existir ou não tiver o formato
 * esperado -- os chamadores sempre leem isto de dentro de `expect.poll`,
 * então um `null` passageiro (o texto ainda não assentou) não é falha,
 * só mais uma rodada de poll.
 */
async function lerContadorModal(page, id) {
  const texto = await page.locator(`#${id}`).textContent().catch(() => null);
  const m = texto?.match(/(\d+)\s*\/\s*(\d+)/);
  return m ? { atual: Number(m[1]), limite: Number(m[2]) } : null;
}

/**
 * Lê "N / M" de um dos contadores da SEÇÃO Magias da ficha (fora do
 * modal), pelo rótulo exibido ("Truques" ou "Magias Preparadas"/"Magias
 * Conhecidas"). Os contadores da ficha não têm id -- só o rótulo os
 * distingue -- por isso a busca por texto em vez de um seletor de id.
 * Mesmo contrato de `lerContadorModal`: `null` em vez de lançar, para uso
 * dentro de `expect.poll`.
 */
async function lerContadorFicha(page, rotulo) {
  return page.evaluate((rotulo) => {
    const contadores = document.querySelectorAll('.magia-contadores .magia-contador');
    for (const c of contadores) {
      const label = c.querySelector('.contador-label')?.textContent?.trim();
      if (label !== rotulo) continue;
      const valor = c.querySelector('.contador-valor')?.textContent?.trim() || '';
      const m = valor.match(/(\d+)\s*\/\s*(\d+)/);
      return m ? { atual: Number(m[1]), limite: Number(m[2]) } : null;
    }
    return null;
  }, rotulo);
}

/** `expect.poll` sobre o LIMITE de um contador do modal -- ver o comentário de topo do arquivo. */
async function esperarLimiteModal(page, id, esperado, mensagem) {
  await expect.poll(async () => (await lerContadorModal(page, id))?.limite ?? null, { message: mensagem })
    .toBe(esperado);
}

/** `expect.poll` sobre o LIMITE de um contador da seção Magias da ficha -- ver o comentário de topo do arquivo. */
async function esperarLimiteFicha(page, rotulo, esperado, mensagem) {
  await expect.poll(async () => (await lerContadorFicha(page, rotulo))?.limite ?? null, { message: mensagem })
    .toBe(esperado);
}

// ============================================================
// 1. O caso reportado, de ponta a ponta: Orc Ladino 5/Mago 1.
// ============================================================
// Ladino, sozinho, não tem Conjuração nenhuma (livro:2071 -- só ganha com a
// subclasse Trapaceiro Arcano, que este personagem não tem: subclasse ''),
// então a ÚNICA superfície de conjuração dele é o Mago -- o seletor NÃO
// aparece aqui (é o cenário 1 do "caso reportado", já fechado por T2/T3;
// o seletor propriamente dito é medido nos cenários 3 e 4). O que esta
// tarefa acrescenta de verificável é a garantia de que o seletor continua
// ausente e discreto quando há uma classe só que conjura -- sem isso,
// "aparecer sempre" passaria despercebido aqui.
const LADINO_5_MAGO_1 = [
  { classe: 'Ladino', subclasse: '', nivel: 5, ordem: 0 },
  { classe: 'Mago', subclasse: '', nivel: 1, ordem: 1 },
];

// dados/classes/mago.json, linha do nível 1: Truques "3", Magias
// Preparadas "4". Medido do arquivo, não chutado.
const MAGO_1_TRUQUES = 3;
const MAGO_1_PREPARADAS = 4;

test('Orc Ladino 5/Mago 1: "Preparar Magias" mostra as magias e os números do Mago, sem 404 nem erro de console',
  async ({ context }) => {
    const { page, erros } = await abrirFicha(context, {
      classe: 'Ladino', subclasse: '', nivel: 6, xp: 14000,
      especie: 'Orc', atributos: ATRIBUTOS_REGRAS,
      pericias_proficientes: ['Furtividade', 'Percepção'],
      classes: LADINO_5_MAGO_1,
      schema_versao: 2,
    }, 'regras-t4-ladino-mago-404');

    // GUARDA CONTRA VACUIDADE: a seção de Magias (e o botão que abre o
    // modal) precisam existir antes de qualquer afirmação sobre o modal.
    await expect(page.locator('#btn-add-magia'),
      'a seção de Magias não foi montada -- sem ela o cenário não mede nada')
      .toBeVisible({ timeout: 10_000 });

    // Uma classe só conjura (Mago): o seletor não deveria aparecer aqui.
    await expect(page.locator('#tabs-superficie-magia'),
      'só o Mago conjura neste personagem -- o seletor de classe não deveria aparecer com uma ' +
      'superfície só')
      .toHaveCount(0);

    await abrirGerenciarMagias(page);

    // Os contadores do topo do modal mostram os números do MAGO nível 1 --
    // o defeito original mostrava "Truques: 3/0" e "Preparadas: 0/0"
    // (limite 0, porque a tabela consultada era a do Ladino, sem colunas
    // de magia).
    await esperarLimiteModal(page, 'gm-contador-truques', MAGO_1_TRUQUES,
      `o limite de truques mostrado deveria ser o do Mago nível 1 (${MAGO_1_TRUQUES}, ` +
      'dados/classes/mago.json) -- um limite 0, o do Ladino, ou o contador ausente indicaria que ' +
      'a tela voltou a ler a classe inicial');

    await esperarLimiteModal(page, 'gm-contador-preparadas', MAGO_1_PREPARADAS,
      `o limite de magias preparadas mostrado deveria ser o do Mago nível 1 ` +
      `(${MAGO_1_PREPARADAS}, dados/classes/mago.json)`);

    // A lista traz magias de MAGO -- "Raio de Gelo" é truque exclusivo do
    // Mago (não está na lista de nenhuma outra classe conjuradora deste
    // sub-projeto), então achá-lo prova que a lista carregada é a certa, e
    // não uma lista vazia que por acaso não gerou erro.
    await page.locator('[data-tab-mg="truques"]').click();
    await expect(page.locator('#resultado-magias'),
      '"Raio de Gelo" (truque de Mago) não apareceu na aba Truques -- a lista carregada não é a ' +
      'do Mago')
      .toContainText('Raio de Gelo');

    // A afirmação final, e a que dá nome ao cenário: nenhum erro de
    // console -- o 404 de classes/magias_ladino.json era o sintoma
    // original, e um erro silencioso passaria despercebido em qualquer
    // uma das asserções acima.
    expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
  });

// ============================================================
// 2. Classe única não muda nada -- o canário da maioria dos personagens.
// ============================================================
test('Mago 5 puro: o seletor de classe não aparece e a tela se comporta como sempre',
  async ({ context }) => {
    const { page, erros } = await abrirFicha(context, {
      classe: 'Mago', subclasse: '', nivel: 5, xp: 6500,
      especie: 'Humano', atributos: ATRIBUTOS_REGRAS,
      pericias_proficientes: ['Arcanismo', 'História'],
    }, 'regras-t4-mago-classe-unica');

    await expect(page.locator('#btn-add-magia')).toBeVisible({ timeout: 10_000 });

    // O CANÁRIO: com uma classe só, o seletor não deveria existir no DOM
    // nenhuma. Se algum dia ele passar a aparecer sempre (ex.: um `>= 1`
    // em vez de `> 1` na guarda), é aqui -- na ficha do personagem mais
    // comum do app -- que a regressão aparece.
    await expect(page.locator('#tabs-superficie-magia'),
      'personagem de classe única não deveria ganhar um seletor de classe -- a maioria dos ' +
      'jogadores não tem multiclasse nenhuma')
      .toHaveCount(0);

    // dados/classes/mago.json, nível 5: Truques "4", Magias Preparadas "9".
    await esperarLimiteFicha(page, 'Truques', 4,
      'o contador de truques da seção Magias deveria mostrar o limite do Mago nível 5 (4)');
    await esperarLimiteFicha(page, 'Magias Preparadas', 9,
      'o contador de magias preparadas da seção Magias deveria mostrar o limite do Mago nível 5 (9)');

    await abrirGerenciarMagias(page);
    await esperarLimiteModal(page, 'gm-contador-truques', 4,
      'o modal "Preparar Magias" de um Mago de classe única deveria mostrar o MESMO limite de ' +
      'truques que a seção da ficha (4)');

    expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
  });

// ============================================================
// 3. Duas superfícies e a troca: Clérigo 5 (inicial)/Mago 1 (segunda).
// ============================================================
// dados/classes/clerigo.json, nível 5: Truques "4", Magias Preparadas "9".
// dados/classes/mago.json, nível 1: Truques "3", Magias Preparadas "4".
// Os dois pares são DIFERENTES entre si de propósito -- se a troca não
// mudasse nada de verdade, o teste ainda passaria por coincidência com
// números iguais.
const CLERIGO_5_TRUQUES = 4;
const CLERIGO_5_PREPARADAS = 9;

const CLERIGO_5_MAGO_1 = [
  { classe: 'Clérigo', subclasse: '', nivel: 5, ordem: 0 },
  { classe: 'Mago', subclasse: '', nivel: 1, ordem: 1 },
];

test('Clérigo 5/Mago 1: o seletor aparece, começa no Clérigo, e trocar para Mago muda lista e limites',
  async ({ context }) => {
    const { page, erros } = await abrirFicha(context, {
      classe: 'Clérigo', subclasse: '', nivel: 6, xp: 14000,
      especie: 'Humano', atributos: ATRIBUTOS_REGRAS,
      pericias_proficientes: ['Religião', 'Intuição'],
      classes: CLERIGO_5_MAGO_1,
      schema_versao: 2,
    }, 'regras-t4-clerigo-mago-troca');

    await expect(page.locator('#btn-add-magia')).toBeVisible({ timeout: 10_000 });

    const seletor = page.locator('#tabs-superficie-magia');
    await expect(seletor,
      'com duas superfícies de conjuração (Clérigo e Mago), o seletor de classe precisa aparecer')
      .toBeVisible({ timeout: 10_000 });

    const abaClerigo = page.locator('[data-tab-superficie="Clérigo"]');
    const abaMago = page.locator('[data-tab-superficie="Mago"]');
    await expect(abaClerigo, 'a aba do Clérigo (classe inicial) não apareceu no seletor')
      .toBeVisible();
    await expect(abaMago, 'a aba do Mago (segunda classe) não apareceu no seletor').toBeVisible();

    // A superfície inicial é a PRIMEIRA (a classe inicial) -- o que a tela
    // sempre mostrou, mesmo antes do seletor existir.
    await expect(abaClerigo, 'a aba ativa ao abrir a ficha deveria ser a da classe inicial (Clérigo)')
      .toHaveClass(/active/);
    await expect(abaMago, 'a aba do Mago não deveria começar ativa').not.toHaveClass(/active/);

    await esperarLimiteFicha(page, 'Truques', CLERIGO_5_TRUQUES,
      `com o Clérigo ativo, o limite de truques deveria ser o dele (${CLERIGO_5_TRUQUES})`);
    await esperarLimiteFicha(page, 'Magias Preparadas', CLERIGO_5_PREPARADAS,
      `com o Clérigo ativo, o limite de preparadas deveria ser o dele (${CLERIGO_5_PREPARADAS})`);

    // Trocar para o Mago -- clicarSeletorFicha espera o efeito (a aba do
    // Mago ficar ativa) antes de seguir, e reclica se a primeira tentativa
    // não surtiu efeito (a ficha inteira re-renderiza no clique).
    await clicarSeletorFicha(page, '[data-tab-superficie="Mago"]',
      { esperar: '[data-tab-superficie="Mago"].active' });

    await expect(page.locator('[data-tab-superficie="Clérigo"]'),
      'depois de trocar para o Mago, a aba do Clérigo não deveria continuar ativa')
      .not.toHaveClass(/active/);

    await esperarLimiteFicha(page, 'Truques', MAGO_1_TRUQUES,
      `depois de trocar para o Mago, o limite de truques deveria mudar para o dele ` +
      `(${MAGO_1_TRUQUES}) -- se continuar ${CLERIGO_5_TRUQUES}, a troca não afetou o limite`);
    await esperarLimiteFicha(page, 'Magias Preparadas', MAGO_1_PREPARADAS,
      `depois de trocar para o Mago, o limite de preparadas deveria mudar para o dele ` +
      `(${MAGO_1_PREPARADAS})`);

    // "Preparar Magias" agora abre para o MAGO, não mais o Clérigo -- prova que o
    // seletor da ficha e o modal leem a MESMA superfície ativa
    // (superficieAtivaDaFicha compartilhada), e que a LISTA de magias
    // (não só os números) também trocou.
    await abrirGerenciarMagias(page);
    await page.locator('[data-tab-mg="truques"]').click();
    await expect(page.locator('#resultado-magias'),
      'depois de trocar para o Mago na ficha, "Preparar Magias" deveria oferecer truques de ' +
      'Mago ("Raio de Gelo"), não mais os de Clérigo')
      .toContainText('Raio de Gelo');
    await expect(page.locator('#resultado-magias'),
      '"Chama Sagrada" é truque de Clérigo -- não deveria aparecer com o Mago como superfície ativa')
      .not.toContainText('Chama Sagrada');

    await esperarLimiteModal(page, 'gm-contador-truques', MAGO_1_TRUQUES,
      'o modal "Preparar Magias", aberto depois da troca, deveria mostrar o limite de truques ' +
      'do Mago');

    expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
  });

// ============================================================
// 4. O caso silencioso: classe INICIAL já conjuradora, com outra
//    conjuradora depois. Antes deste seletor, isso nunca dava 404 (a
//    classe inicial sempre tem lista e tabela válidas) -- mostrava um
//    número PLAUSÍVEL e ERRADO: sempre o do Mago, mesmo quando o jogador
//    queria gerenciar o Clérigo, sem jeito nenhum de trocar. Mago
//    5(inicial)/Clérigo 3(segunda) -- ordem invertida da do cenário 3, de
//    propósito, para não depender de "a classe inicial vem primeiro"
//    coincidir com "o teste usa Clérigo primeiro".
// ============================================================
// dados/classes/mago.json, nível 5: Truques "4", Magias Preparadas "9".
// dados/classes/clerigo.json, nível 3: Truques "3", Magias Preparadas "6".
const MAGO_5_TRUQUES = 4;
const MAGO_5_PREPARADAS = 9;
const CLERIGO_3_TRUQUES = 3;
const CLERIGO_3_PREPARADAS = 6;

const MAGO_5_CLERIGO_3 = [
  { classe: 'Mago', subclasse: '', nivel: 5, ordem: 0 },
  { classe: 'Clérigo', subclasse: '', nivel: 3, ordem: 1 },
];

test('Mago 5/Clérigo 3: trocar para o Clérigo mostra o número CERTO dele, não o do Mago repetido',
  async ({ context }) => {
    const { page, erros } = await abrirFicha(context, {
      classe: 'Mago', subclasse: '', nivel: 8, xp: 34000,
      especie: 'Humano', atributos: ATRIBUTOS_REGRAS,
      pericias_proficientes: ['Arcanismo', 'História'],
      classes: MAGO_5_CLERIGO_3,
      schema_versao: 2,
    }, 'regras-t4-mago-clerigo-silencioso');

    await expect(page.locator('#btn-add-magia')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#tabs-superficie-magia')).toBeVisible({ timeout: 10_000 });

    // Ao abrir, a superfície ativa é a classe inicial (Mago) -- era o único
    // valor que a tela sabia mostrar antes deste seletor existir.
    await esperarLimiteFicha(page, 'Truques', MAGO_5_TRUQUES,
      `ao abrir, o limite deveria ser o do Mago nível 5 (${MAGO_5_TRUQUES})`);

    await clicarSeletorFicha(page, '[data-tab-superficie="Clérigo"]',
      { esperar: '[data-tab-superficie="Clérigo"].active' });

    // A AFIRMAÇÃO CENTRAL deste cenário: o número muda para o do CLÉRIGO
    // (3/6), não continua repetindo o do Mago (4/9). Antes do seletor, não
    // havia CAMINHO NENHUM para chegar a estes números -- o personagem
    // parecia ter só as magias de Mago, silenciosamente.
    await esperarLimiteFicha(page, 'Truques', CLERIGO_3_TRUQUES,
      `depois de trocar para o Clérigo, o limite de truques deveria ser o dele ` +
      `(${CLERIGO_3_TRUQUES}) -- continuar em ${MAGO_5_TRUQUES} seria o caso silencioso: o ` +
      'número do Mago vazando para a aba do Clérigo');
    await esperarLimiteFicha(page, 'Magias Preparadas', CLERIGO_3_PREPARADAS,
      `depois de trocar para o Clérigo, o limite de preparadas deveria ser o dele ` +
      `(${CLERIGO_3_PREPARADAS}), não o do Mago (${MAGO_5_PREPARADAS})`);

    // E a LISTA de magias oferecida também é a do Clérigo -- "Chama
    // Sagrada" é exclusivo dele entre as duas classes deste personagem.
    await abrirGerenciarMagias(page);
    await page.locator('[data-tab-mg="truques"]').click();
    await expect(page.locator('#resultado-magias'),
      '"Preparar Magias", depois da troca para Clérigo, deveria oferecer "Chama Sagrada"')
      .toContainText('Chama Sagrada');
    await expect(page.locator('#resultado-magias'),
      '"Raio de Gelo" é truque de Mago -- não deveria aparecer com o Clérigo como superfície ativa')
      .not.toContainText('Raio de Gelo');

    await esperarLimiteModal(page, 'gm-contador-preparadas', CLERIGO_3_PREPARADAS,
      'o modal "Preparar Magias", depois da troca, deveria mostrar o limite de preparadas do ' +
      'Clérigo');

    expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
  });

// ============================================================
// 5. O vazamento entre personagens que o reset previne.
// ============================================================
// A escolha do seletor vive numa VARIÁVEL DE MÓDULO
// (site/js/sheet/contexto-classe.js), não presa a nenhum personagem --
// resetarSuperficieSelecionada() (chamada por renderSheet, logo após
// definirChar, pages/sheet.js) existe para zerar essa escolha a cada
// abertura de ficha. Nenhum spec afirmava isso até aqui: os cenários
// 1-4 sempre abrem UM personagem por teste (páginas novas, que
// recarregam os módulos do zero e passariam mesmo sem reset nenhum).
//
// Este cenário reaproveita a MESMA página entre os dois personagens --
// única forma de exercitar o estado de módulo de verdade, do jeito que a
// navegação real do app troca de ficha (hash-route, sem recarregar
// documento). O segundo personagem (Guardião 5/Mago 1) COMPARTILHA a
// classe "Mago" com o primeiro (Clérigo 5/Mago 1) de propósito: se o
// reset falhar, é exatamente essa coincidência de nome que faria o
// segundo abrir na aba errada (o Mago, escolhido no primeiro) em vez da
// própria classe inicial dele (Guardião).
const GUARDIAO_5_MAGO_1 = [
  { classe: 'Guardião', subclasse: '', nivel: 5, ordem: 0 },
  { classe: 'Mago', subclasse: '', nivel: 1, ordem: 1 },
];

test('trocar a superfície num personagem não vaza para o próximo personagem aberto na mesma aba',
  async ({ context }) => {
    const { page, erros } = await abrirFicha(context, {
      classe: 'Clérigo', subclasse: '', nivel: 6, xp: 14000,
      especie: 'Humano', atributos: ATRIBUTOS_REGRAS,
      pericias_proficientes: ['Religião', 'Intuição'],
      classes: CLERIGO_5_MAGO_1,
      schema_versao: 2,
    }, 'regras-t4-vazamento-p1');

    await expect(page.locator('#tabs-superficie-magia')).toBeVisible({ timeout: 10_000 });
    await clicarSeletorFicha(page, '[data-tab-superficie="Mago"]',
      { esperar: '[data-tab-superficie="Mago"].active' });

    // Segundo personagem, semeado e aberto na MESMA página (mesmo `page`
    // do primeiro) -- é isso que mede o estado de módulo de verdade.
    await semearPersonagem(page, {
      classe: 'Guardião', subclasse: '', nivel: 6, xp: 14000,
      especie: 'Humano', atributos: ATRIBUTOS_REGRAS,
      pericias_proficientes: ['Percepção', 'Sobrevivência'],
      classes: GUARDIAO_5_MAGO_1,
      schema_versao: 2,
    }, 'regras-t4-vazamento-p2');
    await page.goto(`${NOVO}#ficha/regras-t4-vazamento-p2`, { waitUntil: 'domcontentloaded' });
    await assentar(page);

    await expect(page.locator('#tabs-superficie-magia')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('[data-tab-superficie="Guardião"]'),
      'o segundo personagem (Guardião 5/Mago 1) precisa abrir com a PRÓPRIA classe inicial ' +
      '(Guardião) ativa -- se vier o Mago ativo, a escolha feita no PRIMEIRO personagem vazou ' +
      'pela variável de módulo compartilhada')
      .toHaveClass(/active/);
    await expect(page.locator('[data-tab-superficie="Mago"]'),
      'a aba do Mago não pode vir ativa no segundo personagem -- seria a escolha do personagem ' +
      'anterior sobrevivendo à troca de ficha, exatamente o vazamento que ' +
      'resetarSuperficieSelecionada() existe para prevenir')
      .not.toHaveClass(/active/);

    expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
  });
