// ============================================================
// Issue #45 -- Conhecimento Primordial (Bárbaro nv3) NA TELA.
//
// O teste de unidade irmão (testes/regras/unidade/) prova que
// `subirDeNivel` concede a perícia quando recebe a escolha. Este aqui
// prova a outra metade, que é a que o jogador reclamou: que a tela de
// subida de nível OFERECE a escolha, e que clicar nela grava.
//
// Um card novo só está entregue com um spec que clica nele.
// ============================================================
import { test, expect } from '@playwright/test';
import {
  abrirFicha, assentar, personagemSalvo, abrirModalLevelUp, ATRIBUTOS_REGRAS,
} from './helpers-regras.mjs';

// XP de nível 3 (a tabela do app cobra 900 para o 3).
const BARBARO_2 = {
  nome: 'Grog', especie: 'Humano', classe: 'Bárbaro', subclasse: '',
  nivel: 2, xp: 900, atributos: ATRIBUTOS_REGRAS,
  pericias_proficientes: ['Atletismo', 'Sobrevivência'],
  classes: [{ classe: 'Bárbaro', subclasse: '', nivel: 2, ordem: 0 }],
  schema_versao: 2,
};

/** Abre a ficha de um Bárbaro 2 e o modal de subida de nível. */
async function abrirSubidaDeNivel(context, id) {
  const { page } = await abrirFicha(context, BARBARO_2, id);
  await assentar(page).catch(() => {});
  // `abrirModalLevelUp` liga o flag do fluxo v2 e clica em #btn-levelup --
  // o mesmo caminho que as outras ~13 specs do assistente usam.
  const abriu = await abrirModalLevelUp(page);
  expect(abriu, 'o modal de subida de nivel precisa abrir').toBe(true);
  await assentar(page).catch(() => {});
  return page;
}

/**
 * Avança o assistente até o card pedido aparecer, SATISFAZENDO os passos
 * pelo caminho.
 *
 * O nível 3 do Bárbaro tem dois passos antes do resumo: a subclasse
 * (obrigatória) e Conhecimento Primordial. Atravessar a subclasse sem
 * escolher nada faz o "Confirmar" nunca completar -- e foi exatamente
 * isso que fez a primeira versão do terceiro teste deste arquivo passar
 * por VACUIDADE: ele afirmava "sem a perícia não confirma" enquanto o que
 * bloqueava era a subclasse ausente.
 */
async function avancarAte(page, seletor, limite = 10) {
  // Registrado NO MOMENTO do clique: depois que o assistente avança, o
  // card da subclasse sai da tela e `.selecionada` não existe mais para
  // ser consultada. É este flag que os testes usam como guarda de
  // vacuidade.
  let subclasseMarcada = false;
  for (let i = 0; i < limite; i++) {
    if (await page.locator(seletor).count() > 0) return { achou: true, subclasseMarcada };
    const subclasse = page.locator('[data-subclasse]').first();
    if (await subclasse.count() > 0 && await page.locator('[data-subclasse].selecionada').count() === 0) {
      await subclasse.click();
      await assentar(page).catch(() => {});
      subclasseMarcada = await page.locator('[data-subclasse].selecionada').count() > 0;
    }
    const proximo = page.locator('#modal-acoes button:not([disabled])').last();
    if (await proximo.count() === 0) return { achou: false, subclasseMarcada };
    await proximo.click();
    await assentar(page).catch(() => {});
  }
  return { achou: await page.locator(seletor).count() > 0, subclasseMarcada };
}

test('a subida ao nivel 3 do Barbaro oferece a escolha de pericia', async ({ context }) => {
  const page = await abrirSubidaDeNivel(context, 'cp-tela-1');

  const { achou } = await avancarAte(page, '#levelup-conhecimento-primordial');
  expect(achou,
    'Conhecimento Primordial da uma pericia nova (Classes.md:109) e a tela precisa '
    + 'oferecer a escolha -- ate a issue #45 ela era so anunciada e ignorada')
    .toBe(true);

  const opcoes = page.locator('[data-conhecimento-primordial]');
  const total = await opcoes.count();
  expect(total, 'a lista do Barbaro tem 6 pericias; duas ja sao do personagem, sobram 4')
    .toBe(4);

  // As duas que ele JA tem nao podem aparecer -- seria oferecer nada.
  for (const jaTem of ['Atletismo', 'Sobrevivência']) {
    await expect(page.locator(`[data-conhecimento-primordial="${jaTem}"]`),
      `"${jaTem}" ja e proficiencia do personagem e nao pode estar na lista`)
      .toHaveCount(0);
  }
});

test('clicar na pericia e confirmar grava a proficiencia na ficha', async ({ context }) => {
  const page = await abrirSubidaDeNivel(context, 'cp-tela-2');
  const passeio = await avancarAte(page, '#levelup-conhecimento-primordial');
  expect(passeio.achou, 'o card precisa aparecer').toBe(true);

  await page.locator('[data-conhecimento-primordial="Natureza"]').click();
  await assentar(page).catch(() => {});

  // Vai ate o fim do assistente e confirma.
  for (let i = 0; i < 12; i++) {
    const botoes = page.locator('#modal-acoes button:not([disabled])');
    if (await botoes.count() === 0) break;
    await botoes.last().click();
    await assentar(page).catch(() => {});
    const p = await personagemSalvo(page);
    if ((p?.nivel || 0) >= 3) break;
  }

  const p = await personagemSalvo(page);
  expect(p.nivel, 'o personagem precisa ter subido para o nivel 3').toBe(3);
  expect(p.pericias_proficientes,
    `a pericia escolhida tem de estar gravada; veio ${JSON.stringify(p.pericias_proficientes)}`)
    .toContain('Natureza');
  // Nao pode duplicar as que ja existiam.
  expect(new Set(p.pericias_proficientes).size).toBe(p.pericias_proficientes.length);
});

test('sem escolher a pericia, o assistente nao deixa confirmar', async ({ context }) => {
  const page = await abrirSubidaDeNivel(context, 'cp-tela-3');
  const passeio = await avancarAte(page, '#levelup-conhecimento-primordial');
  expect(passeio.achou, 'o card precisa aparecer').toBe(true);
  // GUARDA CONTRA VACUIDADE: a subclasse JA foi marcada no caminho, entao
  // o unico portao que resta fechado e o da pericia. Sem isto, o teste
  // passaria pelo motivo errado -- foi o que aconteceu na primeira versao.
  expect(passeio.subclasseMarcada,
    'a subclasse precisa ter sido escolhida -- senao o bloqueio medido e o dela, nao o da pericia')
    .toBe(true);

  // Sem marcar nada, tenta empurrar o assistente ate o fim.
  for (let i = 0; i < 12; i++) {
    const botoes = page.locator('#modal-acoes button:not([disabled])');
    if (await botoes.count() === 0) break;
    await botoes.last().click();
    await assentar(page).catch(() => {});
  }

  const p = await personagemSalvo(page);
  expect(p.nivel,
    'sem a pericia escolhida a subida nao pode completar -- senao o jogador perde a concessao calado')
    .toBe(2);
});
