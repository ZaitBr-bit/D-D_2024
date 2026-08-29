// ============================================================
// Tarefa 3 (Conjurador Ritualista -- crescimento): o STEP do assistente
// que responde à dívida de Talentos.md:370 -- "Sempre que seu Bônus de
// Proficiência aumentar depois disso, você pode adicionar uma magia de 1º
// círculo com o marcador Ritual às magias sempre preparadas com esta
// característica." A Tarefa 2 (site/js/levelup.js) já RECUSA a subida
// quando essa dívida está em aberto e nada foi escolhido -- mas até aqui
// não havia TELA nenhuma onde responder: qualquer personagem com o talento
// que cruzasse um patamar de Bônus de Proficiência (nível 5/9/13/17) ficava
// com a subida de nível PERMANENTEMENTE travada. É o mesmo modo de falha
// documentado em multiclasse-subida.spec.mjs:1-33 para o seletor de classe.
//
// Cenário 1 mede a tela E o motor de ponta a ponta: o step só aparece
// quando há dívida, oferece a MESMA lista que a aquisição do talento já usa
// (getMagiasRituais), esconde as magias já preparadas (repetir uma seria
// recusado pelo motor em silêncio quanto à causa -- o jogador marcaria uma
// opção "válida" na tela) e a escolha chega ao personagem salvo.
//
// Cenário 2 é o CANÁRIO: um personagem SEM o talento tem de subir de nível
// normalmente, sem o step aparecer nunca. Sem ele, um step que renderizasse
// incondicionalmente travaria a subida de nível 5 de QUALQUER personagem, e
// nenhum outro spec da suíte pegaria isso -- a suíte inteira ficaria verde
// com o defeito presente.
//
// GUERREIRO, não Mago: o talento "Conjurador Ritualista" é Geral
// (Talentos.md:364, sem exigir Característica de Conjuração) -- um Mago
// exerceria o step 'selecao_magias' (Grimório) ao mesmo tempo, um
// requisito totalmente alheio ao que este arquivo mede. Guerreiro/Campeão
// no nível 4->5 não pede ASI (concedeAumentoAtributo, levelup.js: só dá ASI
// ao Guerreiro em 4/6/8/12/14/16/19), não pede subclasse (exigida só
// exatamente no nível 3) e não é conjurador -- o ÚNICO step visível entre
// "Ganhos do Nível" e a Revisão é o que este arquivo testa. Mesma escolha
// de classe do Caso A em conjurador-ritualista-bonus-proficiencia.spec.mjs.
// ============================================================
import { test, expect } from '@playwright/test';
import {
  ATRIBUTOS_REGRAS, abrirFicha, abrirModalLevelUp, assentar,
  lerToastErro, personagemSalvo,
} from './helpers-regras.mjs';

const CARD_RITUAL = '#levelup-ritual-bonus';
const PROXIMO = '#btn-step-proximo';
const ANTERIOR = '#btn-step-anterior';
const CONFIRMAR = '#btn-confirmar-levelup';
const STEP_ATIVO = '.levelup-step-ativo .levelup-step-label';
const TITULO_STEP = 'Magias Rituais (Bônus de Proficiência)';

/** Clica em "Próximo" e espera o modal reagir. */
async function proximo(page) {
  await page.locator(PROXIMO).click();
  await assentar(page).catch(() => {});
}

// Bônus de Proficiência +2 no nível 4, +3 no nível 5 (bonusProficiencia,
// utils.js) -- as DUAS PRIMEIRAS magias abaixo são as que o talento já
// concedeu na AQUISIÇÃO (nível 4), então `deve` no nível 5 é 3 e `faltam`
// nasce em 1. Alarme e Identificar são rituais de 1º círculo de verdade
// (tempo_conjuracao "1 minuto ou Ritual", dados/magias/circulo_1.json).
//
// A TERCEIRA entrada, 'Servo Invisível', é o achado Important 1 da revisão
// final: um ritual de 1º círculo preparado por OUTRA via (aqui, sem
// `origem` -- preparação comum), que não conta para o invariante (só
// `origem: 'conjurador_ritualista'` conta) e continuava sendo oferecido no
// seletor. Escolhê-lo gravaria uma SEGUNDA entrada com o mesmo nome, porque
// a gravação deduplica por `nome` + `origem` -- permanente, num fluxo sem
// "descer de nível". `faltam` continua 1: a entrada não muda a contagem,
// só a oferta.
const GUERREIRO_4_RITUALISTA = {
  classe: 'Guerreiro', subclasse: '', nivel: 4, xp: 2700,
  especie: 'Humano', atributos: ATRIBUTOS_REGRAS,
  pericias_proficientes: ['Atletismo', 'História'],
  talentos: ['Conjurador Ritualista'],
  magias_preparadas: [
    { nome: 'Alarme', circulo: 1, origem: 'conjurador_ritualista' },
    { nome: 'Identificar', circulo: 1, origem: 'conjurador_ritualista' },
    { nome: 'Servo Invisível', circulo: 1 },
  ],
};

test('Guerreiro 4 com Conjurador Ritualista sobe para 5: o step pede 1 magia ritual, esconde as já preparadas (do talento e de outra origem), recusa sem escolha e grava a 3ª ao escolher', async ({ context }) => {
  const id = 'regras-ritualista-cresc-com-talento';
  const { page, erros } = await abrirFicha(context, GUERREIRO_4_RITUALISTA, id);

  expect(await abrirModalLevelUp(page), 'o assistente não abriu').toBe(true);

  // Classe única: 'escolha_classe' já vem pulado (abrirModalLevelUp). O
  // modal abre em "Ganhos do Nível"; Guerreiro/Campeão no nível 4->5 não
  // pede ASI, subclasse nem escolhas de classe -- "Próximo" leva direto ao
  // step que este arquivo mede.
  await expect(page.locator(STEP_ATIVO)).toHaveText('Ganhos do Nível');
  await proximo(page); // ganhos_nivel -> ritual_bonus_proficiencia
  await expect(page.locator(STEP_ATIVO), 'o assistente tem de chegar ao step "Magias Rituais (Bônus de Proficiência)"')
    .toHaveText(TITULO_STEP);

  const card = page.locator(CARD_RITUAL);
  await expect(card, 'o card do step tem de estar visível').toBeVisible();
  await expect(card, 'o Bônus de Proficiência subiu de +2 para +3: falta exatamente 1 magia')
    .toHaveAttribute('data-faltam', '1');

  // As duas já preparadas na aquisição NÃO podem aparecer como opção
  // marcável -- repetir uma delas seria recusado pelo motor em silêncio
  // quanto à causa (o jogador marcaria uma opção "válida" na tela e só
  // saberia do erro no "Confirmar", sem entender por quê).
  await expect(page.locator(`${CARD_RITUAL} input[name="ritual-bonus"][value="Alarme"]`),
    'Alarme já está preparada por este talento -- não pode ser oferecida de novo').toHaveCount(0);
  await expect(page.locator(`${CARD_RITUAL} input[name="ritual-bonus"][value="Identificar"]`),
    'Identificar já está preparada por este talento -- não pode ser oferecida de novo').toHaveCount(0);
  await expect(card, 'as magias já preparadas têm de continuar listadas, mesmo fora do seletor')
    .toContainText('Alarme');
  await expect(card, 'as magias já preparadas têm de continuar listadas, mesmo fora do seletor')
    .toContainText('Identificar');

  // Important 1 da revisão final: a ritual preparada por OUTRA via também
  // fica fora do seletor -- oferecê-la gravaria uma segunda entrada com o
  // mesmo nome. E some NOMEADA: uma opção que desaparece sem explicação é a
  // mesma falha de silêncio que a lista "Já preparadas" existe para evitar.
  await expect(page.locator(`${CARD_RITUAL} input[name="ritual-bonus"][value="Servo Invisível"]`),
    'Servo Invisível já está preparada por outra origem -- oferecê-la duplicaria a entrada').toHaveCount(0);
  await expect(card, 'a opção retirada tem de ser nomeada ao jogador')
    .toContainText('Fora da lista por já estarem preparadas por outra origem: Servo Invisível');

  // Uma magia ritual de verdade, que NÃO é uma das duas já preparadas, tem
  // de estar disponível -- a lista vem de getMagiasRituais(1) (db.js), a
  // MESMA fonte que o motor valida (levelup.js).
  const opcaoNova = page.locator(`${CARD_RITUAL} input[name="ritual-bonus"][value="Detectar Magia"]`);
  await expect(opcaoNova, 'Detectar Magia é ritual de 1º círculo e ainda não foi escolhida -- tem de estar na lista')
    .toHaveCount(1);

  // A BARREIRA REAL do produto: "Próximo" nunca trava fora do step da
  // classe (ver o comentário ao lado de #btn-step-proximo em
  // levelup-ui.js/renderModal) -- avança sem escolher nada e tenta
  // confirmar: é em "Confirmar" que validateAll recusa, com um toast
  // nomeando o step -- a linha em que TELA e MOTOR precisam concordar.
  await proximo(page); // ritual_bonus_proficiencia -> revisao_confirmacao, sem escolher nada
  await expect(page.locator(CONFIRMAR), 'o assistente deveria chegar ao passo de confirmação').toBeVisible();
  await page.locator(CONFIRMAR).click();
  await assentar(page).catch(() => {});
  const erroSemEscolha = await lerToastErro(page);
  expect(erroSemEscolha, 'sem escolher a magia ritual, a confirmação tem de ser recusada nomeando o step')
    .toContain(TITULO_STEP);
  await expect(page.locator(CONFIRMAR),
    'a recusa não pode fechar o modal -- senão a subida teria sido gravada sem a escolha').toBeVisible();

  // Volta ao step (um "Anterior" -- o step de rituais é o penúltimo) e
  // escolhe a magia.
  await page.locator(ANTERIOR).click();
  await assentar(page).catch(() => {});
  await expect(page.locator(STEP_ATIVO), 'o "Anterior" tem de voltar exatamente ao step de rituais')
    .toHaveText(TITULO_STEP);
  await opcaoNova.check();
  await assentar(page).catch(() => {});

  await proximo(page); // ritual_bonus_proficiencia -> revisao_confirmacao, de novo
  await expect(page.locator('#levelup-step-body'),
    'a Revisão tem de nomear a magia escolhida -- gravada por um caminho SEM DESFAZER')
    .toContainText('Detectar Magia');
  await page.locator(CONFIRMAR).click();
  await assentar(page).catch(() => {});

  // ESTADO SALVO, com expect.poll: a gravação é assíncrona (mesma corrida
  // documentada em multiclasse-subida.spec.mjs:110-124 e
  // magias-ritual-ficha.spec.mjs:133 -- uma leitura única aqui é
  // exatamente a causa das falhas intermitentes desta suíte).
  await expect.poll(async () => {
    const p = await personagemSalvo(page);
    return (p?.magias_preparadas || [])
      .filter((m) => m.origem === 'conjurador_ritualista')
      .map((m) => m.nome)
      .sort();
  }, {
    message: 'as 3 magias rituais do talento (2 da aquisição + 1 do crescimento) têm de estar no personagem salvo',
  }).toEqual(['Alarme', 'Detectar Magia', 'Identificar']);

  const salvo = await personagemSalvo(page);
  expect(salvo.nivel, 'o nível tem de ter subido para 5').toBe(5);
  // Important 1: a ficha salva não pode ter NENHUM nome repetido em
  // magias_preparadas -- é o estrago que a entrada duplicada produzia.
  const nomesSalvos = (salvo.magias_preparadas || []).map((m) => m.nome);
  expect(new Set(nomesSalvos).size,
    `nenhum nome pode aparecer duas vezes em magias_preparadas: ${nomesSalvos.join(', ')}`)
    .toBe(nomesSalvos.length);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});

// ============================================================
// CANÁRIO: sem o talento, o step nunca aparece e a subida conclui normal
// ============================================================
const GUERREIRO_4_SEM_TALENTO = {
  classe: 'Guerreiro', subclasse: '', nivel: 4, xp: 2700,
  especie: 'Humano', atributos: ATRIBUTOS_REGRAS,
  pericias_proficientes: ['Atletismo', 'História'],
  talentos: [],
};

test('CANÁRIO: Guerreiro 4 SEM o talento sobe para 5 sem o step "Magias Rituais (Bônus de Proficiência)" aparecer em nenhum momento', async ({ context }) => {
  const id = 'regras-ritualista-cresc-sem-talento';
  const { page, erros } = await abrirFicha(context, GUERREIRO_4_SEM_TALENTO, id);

  expect(await abrirModalLevelUp(page), 'o assistente não abriu').toBe(true);
  await expect(page.locator(STEP_ATIVO)).toHaveText('Ganhos do Nível');
  await expect(page.locator(CARD_RITUAL), 'sem o talento, o card não pode aparecer nem no primeiro render').toHaveCount(0);

  await proximo(page); // ganhos_nivel -> revisão (Guerreiro sem ASI/subclasse/escolhas neste nível)
  await expect(page.locator(STEP_ATIVO), 'sem o talento, "Ganhos do Nível" vai direto para a Revisão -- nenhum step de rituais no meio')
    .toHaveText('Revisão e Confirmação');
  await expect(page.locator(CARD_RITUAL), 'o step nunca pode ter aparecido ao longo do fluxo').toHaveCount(0);
  // Rede mais forte que "não está na tela agora": nenhum rótulo da barra de
  // progresso pode nomear o step -- prova que ele nunca ENTROU na lista de
  // steps visíveis desta subida, e não só que passou despercebido.
  const labels = await page.locator('.levelup-progress .levelup-step-label').allTextContents();
  expect(labels, 'o step não pode aparecer nem na barra de progresso').not.toContain(TITULO_STEP);

  await page.locator(CONFIRMAR).click();
  await assentar(page).catch(() => {});

  await expect.poll(() => personagemSalvo(page).then((p) => p.nivel), {
    message: 'a subida tem de concluir normalmente, sem o talento',
  }).toBe(5);

  const salvo = await personagemSalvo(page);
  expect((salvo.magias_preparadas || []).some((m) => m.origem === 'conjurador_ritualista'),
    'sem o talento, nenhuma magia com essa origem pode ter sido gravada').toBe(false);

  expect(erros, `erros de console/página: ${erros.join('; ')}`).toEqual([]);
});
