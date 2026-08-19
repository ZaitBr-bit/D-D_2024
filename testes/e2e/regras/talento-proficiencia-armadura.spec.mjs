// ============================================================
// Especialista em Armaduras Leves adicionado pelo "+ Talento" da ficha
// tem de conceder o treinamento DE VERDADE -- badge na ficha e
// proficiencia gravada no personagem salvo.
//
// Bug reproduzido em 2026-08-19: o talento era gravado em char.talentos e
// aparecia na lista de talentos, mas a linha "Armaduras:" da ficha
// continuava mostrando "Nenhuma" para um Mago. O efeito existia so em
// resolverPassivosTalentos().proficienciasExtra (site/js/talentos-effects.js),
// uma saida sem nenhum consumidor -- a ficha le char.proficiencias_extra
// (site/js/sheet/ficha.js:579), que ninguem escrevia.
//
// O Mago e a semente de proposito: CLASSES_INFO['Mago'].armaduras === [],
// entao toda badge de armadura que aparecer veio do talento. Semear um
// Guerreiro daria verde sem o talento existir.
//
// O teste NAO recarrega a pagina: a concessao tem de valer na hora, no
// mesmo render, como ja vale para os passivos numericos
// (talento-ficha-passivos.spec.mjs).
//
// Achado 1 da revisao final (fix wave de 2026-08-19): as leituras da linha
// "Armaduras:" usavam `.allInnerTexts()`, que NAO faz auto-wait -- resolve
// com o que estiver no DOM naquele instante. Sob cold start (servidor
// frio), a leitura podia cair antes do render terminar e o teste falhava
// medindo o DOM da rota anterior, mesmo com o produto correto. Trocado por
// `expect(locator).toContainText(...)`, que reespera ate a asserção bater
// ou o timeout estourar -- elimina a corrida sem mudar nenhuma das
// alegacoes que o teste faz.
// ============================================================
import { test, expect } from '@playwright/test';
import { abrirFicha, personagemSalvo, ATRIBUTOS_REGRAS, assentar } from './helpers-regras.mjs';

/** Localiza a linha "Armaduras:" do topo da ficha -- container unico, auto-esperante. */
function grupoBadgesArmadura(page) {
  return page.locator('.prof-equip-group', { hasText: 'Armaduras:' });
}

test('ficha: + Talento com Especialista em Armaduras Leves concede Leve e Escudo', async ({ context }) => {
  const { page } = await abrirFicha(context, {
    classe: 'Mago',
    nivel: 4,
    xp: 355000,
    atributos: ATRIBUTOS_REGRAS,
    pericias_proficientes: ['Atletismo', 'História'],
    talentos: [],
  });

  const grupoArmaduras = grupoBadgesArmadura(page);
  await expect(grupoArmaduras, 'a semente ja nasceu com proficiencia de armadura -- ' +
    'o teste mediria outra coisa').toContainText('Nenhuma');

  await page.click('#btn-add-talento');
  await page.waitForSelector('#add-talento-lista', { state: 'visible', timeout: 5000 });
  const card = page.locator('#add-talento-lista .opcao-card[data-opcao="Especialista em Armaduras Leves"]');
  await card.waitFor({ state: 'visible', timeout: 5000 });
  await card.click();
  await page.click('#btn-confirmar-add-talento');

  // O talento tem "Aumento no Valor de Atributo" (Forca ou Destreza), entao
  // obterAtributosASITalento devolve lista nao-vazia e o fluxo abre um
  // SEGUNDO modal, "Configurar Talento", com o select de atributo.
  await page.waitForSelector('#levelup-talento-asi', { state: 'visible', timeout: 5000 });
  await page.selectOption('#levelup-talento-asi', 'destreza');
  await page.click('#btn-confirmar-add-talento-asi');
  await assentar(page);

  const salvo = await personagemSalvo(page);
  const nomes = (salvo?.talentos || []).map(t => (typeof t === 'string' ? t : t?.nome));
  expect(nomes, 'o talento nem chegou a ser gravado -- as assercoes abaixo mediriam outra coisa')
    .toContain('Especialista em Armaduras Leves');

  expect(salvo?.proficiencias_extra || [],
    'o talento foi gravado mas a proficiencia nao: char.proficiencias_extra e o campo ' +
    'que a ficha, a impressao e as regras de equipamento leem')
    .toEqual(expect.arrayContaining(['Armadura Leve', 'Escudo']));

  await expect(grupoArmaduras,
    'a proficiencia foi gravada mas a linha "Armaduras:" da ficha nao mostra Leve')
    .toContainText('Leve');
  await expect(grupoArmaduras,
    'o livro concede "Armadura Leve E ESCUDOS" (Talentos.md:428) -- o Escudo sumiu da ficha')
    .toContainText('Escudo');
});

// ============================================================
// Achado 2 da revisao final (fix wave de 2026-08-19): migrarProficienciasTalentos
// (site/js/sheet/migracoes.js) roda em TODA abertura de ficha e reescreve o
// dado salvo do usuario -- e a rota de FICHA JA SALVA (legada), distinta do
// teste acima, que exercita a rota "+ Talento" (concessao no momento em que
// o talento e adicionado). Sem este teste a migracao nao tinha nenhum
// oraculo: nada em testes/ chamava migrarProficienciasTalentos.
//
// A semente e deliberadamente uma ficha "pre-correcao": o talento ja esta
// em char.talentos, mas proficiencias_extra/proficiencias_ferramentas estao
// vazios -- exatamente o estado em que uma ficha gravada antes de
// 2026-08-19 ficaria. Abrir a ficha (sem passar pelo "+ Talento") tem de
// bastar para a migracao preencher os dois campos retroativamente.
// ============================================================
test('ficha: abrir uma ficha SALVA com talentos legados migra as proficiencias que faltam', async ({ context }) => {
  const { page } = await abrirFicha(context, {
    classe: 'Mago',
    nivel: 4,
    talentos: ['Especialista em Armaduras Leves', 'Chef'],
    proficiencias_extra: [],
    proficiencias_ferramentas: [],
  });

  await assentar(page);

  const salvo = await personagemSalvo(page);
  expect(salvo?.proficiencias_extra || [],
    'a ficha legada abriu mas migrarProficienciasTalentos nao gravou a proficiencia de armadura ' +
    'do talento Especialista em Armaduras Leves em char.proficiencias_extra')
    .toEqual(expect.arrayContaining(['Armadura Leve', 'Escudo']));
  expect(salvo?.proficiencias_ferramentas || [],
    'a ficha legada abriu mas migrarProficienciasTalentos nao gravou a ferramenta do talento Chef ' +
    'em char.proficiencias_ferramentas')
    .toEqual(expect.arrayContaining(['Utensílios de Cozinheiro']));

  const grupoArmaduras = grupoBadgesArmadura(page);
  await expect(grupoArmaduras,
    'a proficiencia foi migrada no dado salvo mas a linha "Armaduras:" da ficha nao mostra Leve')
    .toContainText('Leve');
  await expect(grupoArmaduras,
    'a proficiencia foi migrada no dado salvo mas a linha "Armaduras:" da ficha nao mostra Escudo')
    .toContainText('Escudo');
});
