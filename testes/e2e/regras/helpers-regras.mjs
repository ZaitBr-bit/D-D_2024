// ============================================================
// Helpers da suíte de regras: versões de um site só dos helpers de
// paridade, que sempre operam em pares. Reusa o que dá de ../helpers.mjs.
// ============================================================
import {
  assentar, semearPersonagem, satisfazerPasso, passoAtual,
  confirmarModal, lerToastErro, resolverModalAberto,
} from '../helpers.mjs';

export {
  assentar, satisfazerPasso, passoAtual,
  confirmarModal, lerToastErro, resolverModalAberto,
};

export const NOVO = 'http://127.0.0.1:8802/site/';

// ---------- Navegação e sementes compartilhadas do level-up ----------
//
// Achado I1 (fix wave de 2026-08-06): talentos-repetivel.spec.mjs mantinha
// uma cópia PRÓPRIA e mais fraca desta navegação (waitForTimeout(700) fixo
// + `#modal-acoes button:not([disabled])`.last()), enquanto
// talentos-levelup.spec.mjs já tinha uma versão endurecida (escrita depois
// de reproduzir falha de corrida sob carga -- ver comentário abaixo). A
// versão fraca nunca foi atualizada: rodar
// `npx playwright test --config=regras/playwright.config.mjs
// talentos-repetivel --repeat-each=4 --workers=4` dava ~11% de falha
// ("não chegou à tela de ASI/talento"). Extraído para cá e importado
// pelos DOIS specs -- uma cópia só não tem como divergir de novo.

// Todos os seis atributos em 13+: todo pré-requisito de atributo do
// catálogo (Talentos.md) pede exatamente "13 ou superior" num ou noutro
// atributo -- com carisma 10 e sabedoria 12 (valores originais), Ator
// (carisma 13) e Líder Inspirador (sabedoria OU carisma 13) nunca
// apareciam no dropdown, e o teste deles nunca chegava a exercitar a
// tela. 13/14/15 continuam abaixo do teto de 20 em todo lugar que os
// testes de ASI mexem.
export const ATRIBUTOS_REGRAS = {
  forca: 15, destreza: 14, constituicao: 14,
  inteligencia: 13, sabedoria: 13, carisma: 13,
};
const PERICIAS_PROFICIENTES_REGRAS = ['Atletismo', 'História'];

// Guerreiro nível 3 → 4 ganha ASI; nível 18 → 19 exige Dádiva Épica.
// Paladino cobre os mesmos dois saltos para os talentos que exigem
// Característica de Conjuração -- é conjurador, mas "preparado" e sem
// truques, então nunca precisa do passo de seleção de magias
// (levelup-flow.js:305-320: truquesGanhos sempre 0, não é Mago, sem
// subclasse arcana).
export const SEMENTES_REGRAS = {
  normal: { classe: 'Guerreiro', nivel: 3, xp: 355000, atributos: ATRIBUTOS_REGRAS,
            pericias_proficientes: PERICIAS_PROFICIENTES_REGRAS },
  epico: { classe: 'Guerreiro', nivel: 18, xp: 355000, atributos: ATRIBUTOS_REGRAS,
           pericias_proficientes: PERICIAS_PROFICIENTES_REGRAS },
  conjurador: { classe: 'Paladino', nivel: 3, xp: 355000, atributos: ATRIBUTOS_REGRAS,
                pericias_proficientes: PERICIAS_PROFICIENTES_REGRAS },
  conjuradorEpico: { classe: 'Paladino', nivel: 18, xp: 355000, atributos: ATRIBUTOS_REGRAS,
                      pericias_proficientes: PERICIAS_PROFICIENTES_REGRAS },
};

/**
 * Escolhe a semente certa para o talento: nível/classe que satisfaçam o
 * pré-requisito do livro (nível 4 vs. 19, Característica de Conjuração
 * exigida ou não). Compartilhado entre talentos-levelup.spec.mjs (todo
 * talento com `escolhas`) e talentos-repetivel.spec.mjs (achado M8: os
 * casos repetíveis precisam da MESMA seleção de semente, ou Adepto
 * Elemental/Aumento no Valor de Atributo nunca apareceriam no dropdown
 * por motivo de pré-requisito, mascarando a checagem de repetibilidade).
 */
export function sementeParaTalento(entrada, nome) {
  // Aumento no Valor de Atributo só entra no dropdown quando
  // `ctx.exigeDadivaEpica` é true -- levelup-cards.js filtra esse nome
  // fora do dropdown em QUALQUER outro nível, mesmo satisfazendo o
  // pré-requisito de nível 4 do livro.
  if (nome === 'Aumento no Valor de Atributo') return SEMENTES_REGRAS.epico;
  const epico = entrada.categoria === 'de Dádiva Épica';
  const exigeConjurador = entrada.prerequisito?.conjurador === true;
  if (epico) return exigeConjurador ? SEMENTES_REGRAS.conjuradorEpico : SEMENTES_REGRAS.epico;
  return exigeConjurador ? SEMENTES_REGRAS.conjurador : SEMENTES_REGRAS.normal;
}

/**
 * Abre o modal de level-up, com retentativa de clique. Extraído de
 * `irAteEscolhaDeTalento` (achado N3 da revisão final da Task 8): antes
 * dessa extração, `testes/e2e/regras/classes-trocas-ui.spec.mjs` tinha sua
 * PRÓPRIA cópia deste clique, sem a retentativa -- exatamente o tipo de
 * cópia divergente que já causou um flake real neste projeto (ver
 * comentário de `irAteEscolhaDeTalento`, abaixo, e o achado I1 do cabeçalho
 * deste arquivo). Com 4 workers em paralelo, cada um abrindo uma ficha
 * inteira no mesmo servidor de arquivos estático, um único clique sem
 * retentativa falha sob carga (o clique pode chegar antes do listener de
 * `#btn-levelup` estar pronto) -- sintoma: `TimeoutError` esperando
 * `#modal-overlay` ficar visível, intermitente, não reproduzível isolado.
 * Um timeout generoso (20s) mais uma segunda tentativa de clique cobre o
 * pior caso sob carga. Toda spec que abre o level-up deve chamar ESTA
 * função (ou algo que a chame), nunca reimplementar o clique.
 */
export async function abrirModalLevelUp(page) {
  const clicarLevelup = () => page.evaluate(() => {
    localStorage.setItem('feature.levelup.flow.v2', '1');
    document.getElementById('btn-levelup')?.click();
  });
  await clicarLevelup();
  let abriu = await page.waitForSelector('#modal-overlay', { state: 'visible', timeout: 20_000 })
    .then(() => true, () => false);
  if (!abriu) {
    await clicarLevelup();
    abriu = await page.waitForSelector('#modal-overlay', { state: 'visible', timeout: 20_000 })
      .then(() => true, () => false);
  }
  return abriu;
}

/**
 * Abre o modal de level-up (via `abrirModalLevelUp`, com retentativa) e
 * navega até a tela de ASI/talento, confirmando as telas anteriores que
 * aparecerem. Detecta a chegada por `#levelup-talento-lista` (Task 13: o
 * `<select id="levelup-talento-select">` virou cards de montarSeletor), não
 * pelos rádios de modo -- em Dádiva Épica os rádios nem existem
 * (levelup-cards.js: exigeDadivaEpica omite o toggle inteiro).
 *
 * O loop de "Próximo" abaixo tem a mesma disciplina sob carga: um
 * `waitForTimeout` fixo e curto é instável -- a tela demora para
 * renderizar sob carga, `#btn-step-proximo` ainda não existe, e um loop
 * que desiste cedo demais nunca dá tempo do modal abrir (sintoma: falha um
 * talento DIFERENTE a cada corrida -- sinal de timing, não de talento
 * específico).
 */
export async function irAteEscolhaDeTalento(page) {
  await abrirModalLevelUp(page);
  for (let i = 0; i < 10; i++) {
    if (await page.locator('#levelup-talento-lista').count()) return true;
    const proximo = page.locator('#btn-step-proximo');
    if (await proximo.count()) await proximo.click();
    await page.waitForTimeout(500);
  }
  return (await page.locator('#levelup-talento-lista').count()) > 0;
}

// Abre o site coletando erros de console/página — qualquer erro
// derruba o teste no final (mesma disciplina da paridade).
export async function abrirSite(context, hash = '') {
  const page = await context.newPage();
  const erros = [];
  page.on('console', (m) => { if (m.type() === 'error') erros.push(`console: ${m.text()}`); });
  page.on('pageerror', (e) => erros.push(`pageerror: ${e.message}`));
  await page.goto(NOVO + hash, { waitUntil: 'domcontentloaded' });
  await assentar(page);
  return { page, erros };
}

// Semeia um personagem pela fábrica do próprio app e abre a ficha dele.
export async function abrirFicha(context, campos, id = 'regras-teste-1') {
  const lado = await abrirSite(context);
  await semearPersonagem(lado.page, campos, id);
  await lado.page.goto(`${NOVO}#ficha/${id}`, { waitUntil: 'domcontentloaded' });
  await assentar(lado.page);
  return lado;
}

// ---------- Navegação compartilhada do domínio Antecedentes ----------

/**
 * Avança o wizard do passo 1 (classe) até os cards de antecedente
 * aparecerem, escolhendo Guerreiro (classe simples, não-conjuradora, sem
 * escolhas próprias que atrapalhem o driver genérico). Usado por
 * antecedentes.spec.mjs -- lição 7 do guia: vive aqui, importado, em vez
 * de copiado em cada spec (foi exatamente uma cópia divergente que causou
 * um flake real neste projeto).
 */
export async function irAtePassoAntecedente(page) {
  await page.click('[data-classe="Guerreiro"]');
  await confirmarModal(page, 'popup-confirmar-classe').catch(() => {});
  for (let i = 0; i < 8; i++) {
    if (await page.locator('[data-antecedente]').count()) return true;
    if (!await satisfazerPasso(page)) return false;
    await assentar(page).catch(() => {});
  }
  return page.locator('[data-antecedente]').count() > 0;
}

// Lê o personagem salvo (o único) direto do store do app.
export async function personagemSalvo(page) {
  return page.evaluate(async () => {
    const store = await import(new URL('./js/store.js', location.href).href);
    return store.listarPersonagens()[0] || null;
  });
}

// Lê o personagem EM CONSTRUÇÃO direto do módulo do wizard do criador --
// o mesmo objeto vivo que passo-antecedente.js/passo-especie.js mutam ao
// confirmar um popup. Diferente de personagemSalvo, não exige terminar o
// wizard nem gravar no store: prova que uma escolha feita num passo
// REALMENTE gravou no estado (e não só desapareceu do DOM ao fechar o
// modal), no mesmo objeto que o resto do wizard lê depois (ex.: perícias
// da classe, distribuição final de proficiências).
export async function personagemEmCriacao(page) {
  return page.evaluate(async () => {
    const wizard = await import(new URL('./js/creator/wizard.js', location.href).href);
    return wizard.personagem;
  });
}
