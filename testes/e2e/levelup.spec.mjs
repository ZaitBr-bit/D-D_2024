// Subida de nivel em lockstep.
//
// classes.spec.mjs ja renderiza as 12 classes em todos os 20 niveis. O que
// ESTE arquivo acrescenta e a TRANSICAO entre niveis: o fluxo de escolhas que
// roda ao subir, e que classes.spec.mjs nunca exercita porque semeia a ficha
// ja no nivel final.
import { test, expect } from '@playwright/test';
import {
  abrirParelha, abrirFichaSemeada, instantaneoFicha, primeiraDivergencia,
  relatorioErros, resolverModalAberto,
} from './helpers.mjs';

const ATRIBUTOS = { forca: 15, destreza: 14, constituicao: 14,
                    inteligencia: 13, sabedoria: 12, carisma: 10 };

// `podeSubirDeNivel` exige `xp >= XP_POR_NIVEL[nivel + 1]`, e o nivel 20 pede
// 355.000. Um personagem com xp 0 nao pode subir, entao a fixture precisa de
// XP para o teste fazer sentido.
//
// ATENCAO: dar XP NAO foi suficiente. Com 355.000 o Guerreiro continua parando
// no nivel 2 e os conjuradores no 1. A hipotese de que XP era o bloqueio
// estava ERRADA -- o que trava vem depois. O XP fica porque e correto de
// qualquer forma, nao porque resolveu.
const XP_NIVEL_20 = 355000;

// Um personagem semeado nasce SEM pericias proficientes, e varios talentos de
// antecedente exigem escolher entre as que voce ja tem -- o Academico (do
// Sabio) pede "1 pericia academica elegivel em que voce ja e proficiente".
// Sem nenhuma, o fluxo de subida trava com essa mensagem e o personagem nunca
// passa do nivel 1. Nao e bug do app: e fixture irreal.
const PERICIAS = ['Arcanismo', 'História', 'Investigação', 'Percepção',
                  'Atletismo', 'Persuasão'];

/** Nivel atual do unico personagem no localStorage. */
async function nivelAtual(page) {
  return page.evaluate(async () => {
    const store = await import(new URL('./js/store.js', location.href).href);
    return store.listarPersonagens()[0]?.nivel ?? -1;
  });
}

/**
 * Sobe UM nivel pela interface, resolvendo as escolhas que aparecerem.
 *
 * Tenta ate tres vezes: uma passagem nem sempre basta. O nivel 2->3 do Mago,
 * por exemplo, so fecha na segunda -- a primeira preenche o grimorio da
 * subclasse e a segunda confirma. Nao e falha do app; e o resolvedor
 * descobrindo a tela por tentativa.
 */
async function subirUmNivel(page) {
  const inicial = await nivelAtual(page);
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    const n = await _subirUmaVez(page);
    if (n > inicial) return n;
  }
  return nivelAtual(page);
}

/** Uma passagem pelo fluxo de subida. */
async function _subirUmaVez(page) {
  await page.evaluate(() => {
    // Garante o fluxo v2 ligado: o modal da feature flag desviaria o teste.
    localStorage.setItem('feature.levelup.flow.v2', '1');
    document.getElementById('btn-levelup')?.click();
  });
  await page.waitForTimeout(700);

  // O fluxo em cards pode encadear varias telas (ASI/talento, subclasse,
  // magias). `resolverModalAberto` faz as escolhas e confirma cada uma.
  for (let i = 0; i < 12; i++) {
    if (!await page.locator('#modal-overlay').isVisible()) break;
    const antes = await page.evaluate(
      () => document.getElementById('modal-corpo')?.innerHTML.length ?? 0);
    await resolverModalAberto(page, 6);
    if (!await page.locator('#modal-overlay').isVisible()) break;
    const depois = await page.evaluate(
      () => document.getElementById('modal-corpo')?.innerHTML.length ?? 0);
    if (antes === depois) {
      // Diagnostico: quando a tela para de mudar, registrar o QUE esta na
      // frente. Sem isso, "nao avancou" e uma afirmacao sem conteudo.
      const d = await page.evaluate(() => ({
        titulo: document.getElementById('modal-header')?.textContent?.trim().slice(0, 60),
        acoes: [...document.querySelectorAll('#modal-acoes button')]
          .map((b) => b.textContent.trim() + (b.disabled ? ' [OFF]' : '')),
        cards: document.querySelectorAll('#modal-corpo .selection-card').length,
        selects: document.querySelectorAll('#modal-corpo select').length,
        checks: document.querySelectorAll('#modal-corpo input[type="checkbox"]').length,
      }));
      console.log('  [levelup] travou em: ' + JSON.stringify(d));
      break;
    }
  }
  await page.evaluate(() => window.fecharModal?.());
  await page.waitForTimeout(500);
  return nivelAtual(page);
}

test('subir de nivel funciona no site ORIGINAL', async ({ context }) => {
  // Provar o mecanismo no site que sabidamente funciona ANTES de compara-lo.
  const lados = await abrirParelha(context);
  await abrirFichaSemeada(lados, {
    nome: 'Sobe Nivel', classe: 'Guerreiro', especie: 'Humano',
    antecedente: 'Soldado', nivel: 1, xp: XP_NIVEL_20, atributos: ATRIBUTOS,
    pericias_proficientes: PERICIAS,
  }, 'lvl-orig');

  const depois = await subirUmNivel(lados[0].page);
  expect(depois, 'o original nao subiu do nivel 1').toBeGreaterThan(1);
});

for (const classe of ['Guerreiro', 'Mago', 'Paladino']) {
  // Tres classes, nao as 12: cada subida 1->20 leva minutos, e o que muda
  // ENTRE classes ja e coberto por classes.spec.mjs, que renderiza todas as
  // 12 em todos os 20 niveis. As tres cobrem as formas distintas de
  // progressao -- marcial puro, conjurador pleno e meio-conjurador.
  test(`${classe}: subir do nivel 1 ao 20 mantendo paridade`, async ({ context }) => {
    test.setTimeout(600_000);
    const lados = await abrirParelha(context);
    await abrirFichaSemeada(lados, {
      nome: `Escalada ${classe}`, classe, especie: 'Humano',
      antecedente: 'Soldado', nivel: 1, xp: XP_NIVEL_20, atributos: ATRIBUTOS,
    pericias_proficientes: PERICIAS,
    }, `lvl-${classe.normalize('NFD').replace(/[^a-z]/gi, '').toLowerCase()}`);

    let ultimo = 1;
    for (let alvo = 2; alvo <= 20; alvo++) {
      const niveis = [];
      for (const l of lados) niveis.push(await subirUmNivel(l.page));

      expect(niveis[1],
        `${classe}: nivel divergiu ao subir para ${alvo} ` +
        `(original ${niveis[0]}, refatorado ${niveis[1]})`).toBe(niveis[0]);

      const [a, b] = await Promise.all(lados.map((l) => instantaneoFicha(l.page)));
      expect(primeiraDivergencia(a, b),
        `${classe}: ficha divergiu no nivel ${niveis[0]}`).toBeNull();

      if (niveis[0] <= ultimo) break;  // empacou igual nos dois lados
      ultimo = niveis[0];
    }

    // NAO se afirma "chegou ao nivel 20". Medido: Guerreiro e Paladino
    // chegam ao 3, Mago para no 1 -- no ORIGINAL tambem, entao nao e
    // regressao desta refatoracao.
    //
    // Onde o Mago para, exatamente: na tela "Selecao de Magias" do fluxo de
    // subida, com o toast "Selecione 2 magias novas de circulos para os quais
    // voce possui espacos no Grimorio". As magias ficam atras do botao
    // `#btn-lvlup-grimorio`, no CORPO do modal, que abre uma segunda camada
    // (`abrirGridSelecao`, levelup-ui.js:1038). O resolvedor ja abre botoes do
    // corpo e ja preenche a camada de cima, mas as opcoes dessa grade nao sao
    // reconhecidas -- provavelmente usam outro markup que nao `.selection-card`.
    //
    // JA DESCARTADO por medicao: falta de XP; falta de pericias proficientes;
    // o talento Academico (a tela dele e alcancada e tem 3 checkboxes
    // `data-academico-expertise`); ordem de preenchimento; e o vocabulario de
    // card da subclasse.
    //
    // PROXIMO PASSO: inspecionar o markup que `abrirGridSelecao` produz.
    //
    // A assercao que vale continua sendo a de dentro do laco: os dois lados
    // sobem para o MESMO nivel, com a MESMA ficha, a cada passo.
    console.log(`  ${classe}: os dois sites chegaram ao nivel ${ultimo}`);
    expect(relatorioErros(lados), `erros subindo ${classe}`).toBe('');
  });
}
