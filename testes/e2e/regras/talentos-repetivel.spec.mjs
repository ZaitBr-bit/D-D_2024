// ============================================================
// Regra do livro: "Repetível. Você pode adquirir este talento mais
// de uma vez." — e, sem essa marca, adquirir duas vezes é proibido.
// Testa no level-up: personagem que JÁ tem o talento sobe de nível
// e olha a lista de talentos oferecidos.
// ============================================================
import { test, expect } from '@playwright/test';
import { CATALOGO_TALENTOS } from '../../regras/catalogo/talentos.mjs';
import { lacuna } from '../../regras/lacunas-conhecidas.mjs';
import { abrirFicha, irAteEscolhaDeTalento, sementeParaTalento } from './helpers-regras.mjs';

// Achado I1: a navegação até a tela de ASI/talento (`irAteEscolhaDeTalento`)
// e a escolha de semente por talento (`sementeParaTalento`) vêm de
// helpers-regras.mjs -- este spec tinha uma cópia PRÓPRIA e mais fraca da
// navegação (waitForTimeout(700) fixo + `#modal-acoes
// button:not([disabled])`.last(), detectando chegada pelos rádios de ASI),
// enquanto talentos-levelup.spec.mjs já usava uma versão endurecida
// (waitForSelector('#modal-overlay') + retry + detecção por
// `#levelup-talento-select`) escrita depois de reproduzir falha de corrida
// sob 4 workers. A cópia fraca nunca foi atualizada, e falhava de verdade:
// `--repeat-each=4 --workers=4` reproduziu ~11% de falha ("não chegou à
// tela de ASI/talento") em execuções deste spec antes do fix. Ver
// helpers-regras.mjs para o código compartilhado.

// Achado M8: antes, só Habilidoso (o único repetível conhecido na época)
// era exercitado, via uma lista fixa de dois casos hardcoded neste
// arquivo -- Adepto Elemental, Iniciado em Magia e Aumento no Valor de
// Atributo também são `repetivel: true` no catálogo e nunca tinham sido
// testados. Derivar os casos do catálogo (em vez de uma lista fixa) garante
// que um talento repetível novo entre automaticamente na próxima corrida.
const CASOS = [
  ...Object.entries(CATALOGO_TALENTOS)
    .filter(([, t]) => t.repetivel)
    .map(([nome]) => ({ nome, esperaOfertado: true })),
  // Controle negativo: um não-repetível precisa continuar ausente da
  // lista quando já possuído -- Alerta (sem pré-requisito, sempre elegível
  // na semente normal) fixa esse lado da regra.
  { nome: 'Alerta', esperaOfertado: false },
];

for (const { nome, esperaOfertado } of CASOS) {
  test(`repetível: ${nome} já adquirido ${esperaOfertado ? 'reaparece' : 'não reaparece'}`, async ({ context }) => {
    const l = lacuna(nome, 'e2e-repetivel');
    test.fail(Boolean(l), l?.motivo);
    expect(CATALOGO_TALENTOS[nome].repetivel, 'caso desalinhado com o catálogo')
      .toBe(esperaOfertado);

    const semente = sementeParaTalento(CATALOGO_TALENTOS[nome], nome);
    const { page } = await abrirFicha(context, {
      ...semente,
      talentos: [nome],
    });
    expect(await irAteEscolhaDeTalento(page), 'não chegou à tela de ASI/talento').toBe(true);
    // Em Dádiva Épica (Aumento no Valor de Atributo) o rádio de modo nem
    // existe -- o modo já vem forçado para 'talento' (levelup-cards.js:
    // exigeDadivaEpica omite o toggle inteiro). `.catch()` cobre esse
    // caso; nas demais sementes o rádio deveria sempre existir, e se o
    // `check` falhar por outro motivo isso aparece na asserção de
    // `totalOpcoes`/`oferta` logo abaixo (select vazio ou sem a opção).
    await page.check('input[name="levelup-asi-modo"][value="talento"]', { timeout: 1500 }).catch(() => {});

    // Prova que a lista de talentos do level-up REALMENTE carregou antes de
    // ler o caso específico -- sem isso, um erro ao montar a lista (ex.:
    // exceção no meio do cálculo de elegibilidade) deixaria a lista de
    // cards VAZIA para QUALQUER talento, e o caso "Alerta não reaparece"
    // passaria por um motivo totalmente errado (lista quebrada, não regra
    // de repetibilidade cumprida).
    const totalOpcoes = await page.locator('#levelup-talento-lista .opcao-card').count();
    expect(totalOpcoes,
      'lista de talentos do level-up não ofereceu NENHUM card -- suspeita de falha ao montar ' +
      'a lista, não confirma nada sobre repetibilidade').toBeGreaterThan(0);

    // Um repetível já possuído tem de aparecer SELECIONÁVEL (não bloqueado)
    // -- deTalentos (opcoes-dominio.js) trata "Repetível" como exceção ao
    // bloqueio por "já possui" (Task 13); um `.opcao-card` bloqueado não
    // teria `data-opcao` de seleção, mas o motivo real é a ausência de
    // `.bloqueada` na classe, checada abaixo.
    const card = page.locator(`#levelup-talento-lista .opcao-card[data-opcao="${nome}"]`);
    const oferta = (await card.count()) > 0;
    expect(oferta,
      `${nome}: livro diz repetível=${esperaOfertado}, lista de talentos diz o contrário`)
      .toBe(esperaOfertado);
    if (oferta) {
      expect(await card.evaluate((el) => el.classList.contains('bloqueada')),
        `${nome}: repetível já possuído reapareceu, mas como card bloqueado -- não dá para escolher de novo`)
        .toBe(false);
    }
  });
}
