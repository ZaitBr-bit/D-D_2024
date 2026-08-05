// ============================================================
// Caracterização dos "vitals" da ficha PÚBLICA: CA, iniciativa,
// percepção/intuição passiva, deslocamento, carga, espaços de magia,
// dano/cura/PV temporário e descansos. Os valores numéricos vêm do oráculo
// congelado em Task 2 (tests/fixtures/expected/derived-values.json, campo
// `expectedUnified`) — nunca são re-derivados aqui.
//
// ## Task 33 — CUTOVER: por que os seletores mudaram
//
// `site/js/pages/sheet.js` deixou de ser o monólito e virou o composition root
// de `features/sheet/**`. O que este spec MEDE é o mesmo (os valores do
// oráculo, e a persistência real em localStorage); o que mudou é COMO ele
// aponta para o valor:
//
// | # | Legado | Novo | Por quê |
// |---|---|---|---|
// | 1 | `.stat-box` + texto do `.stat-label` ao lado | `[data-sheet-stat="armor-class"]` | o legado era POSICIONAL (achava o valor pelo rótulo vizinho); o novo identifica o valor pelo que ele É |
// | 2 | `.hp-pv-value` ("20 / 38" num nó só) | `[data-sheet-hp-current]` + `[data-sheet-hp-maximum]` | atual e máximo são dois valores derivados distintos; juntá-los num texto obrigava o teste a normalizar espaço |
// | 3 | `#hp-minus` -> number-picker -> `#btn-aplicar-dano` | `[data-sheet-amount]` + `[data-action="apply-damage"]` | o number-picker era um widget do monólito com input oculto sincronizado no `change`; a seção emite um comando canônico |
// | 4 | `.slot-bolha[data-slot-circ="1"]:not(.usado)` | `[data-sheet-slot-level="1"] [data-sheet-slot-available]` | o legado contava NÓS para inferir o disponível; o novo lê o número projetado |
// | 5 | `#btn-descanso-longo` dentro do FAB (`abrirMenuDescanso`) | `[data-action="long-rest"]` | não há mais menu flutuante: descanso é um comando da seção de resumo/combate |
// | 6 | `#sheet-peso-valor` | `[data-sheet-load-total]` / `[data-sheet-load-capacity]` | idem #1 |
//
// **Divergência funcional DECLARADA (não é seletor):** o descanso curto do
// monólito abria um modal perguntando quantos dados de vida gastar. A ficha V2
// separa as duas coisas — `short-rest` é um comando, e gastar dado de vida é
// outro (`spend-hit-die`) —, então o caso "descanso curto oferece gastar dados
// de vida e, se recusado, não altera nada" virou a asserção equivalente e mais
// forte: o descanso curto SOZINHO não altera PV nem dados de vida.
// ============================================================
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resetApp, goFicha } from './helpers/app.js';
import { readCharacters } from './helpers/storage.js';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const derivedValues = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'tests/fixtures/expected/derived-values.json'), 'utf8')
);
const casesById = Object.fromEntries(derivedValues.cases.map((c) => [c.id, c]));
const PERSONAGEM_BASE = casesById['pv-convergente'].personagem;
const expectedOf = (id) => casesById[id].expectedUnified;

/** Caixa de estatística do resumo, identificada pelo VALOR que carrega. */
function stat(page, chave) {
  return page.locator(`[data-sheet-stat="${chave}"] .sheet-stat-value`);
}

/**
 * Preenche o campo de quantidade da seção de resumo/combate e dispara a ação.
 * É o gesto REAL do jogador: um único campo compartilhado pelos comandos de
 * PV, exatamente como a seção o desenha.
 */
async function aplicar(page, acao, valor) {
  await page.locator('[data-sheet-hit-points] [data-sheet-amount]').fill(String(valor));
  await page.locator(`[data-sheet-hit-points] [data-action="${acao}"]`).click();
}

test.describe('Ficha — vitals', () => {
  test(
    'CA, iniciativa, percepção/intuição passiva, deslocamento, carga e espaços de magia batem com o oráculo de Task 2',
    { tag: '@critical' },
    async ({ page }) => {
      await resetApp(page, { characters: [PERSONAGEM_BASE] });
      await goFicha(page, PERSONAGEM_BASE.id);

      await expect(stat(page, 'armor-class')).toHaveText(String(expectedOf('ca-convergente')));
      await expect(stat(page, 'initiative')).toContainText(String(expectedOf('iniciativa-convergente')));

      const deslocamentoNumero = String(expectedOf('deslocamento-convergente')).replace(' metros', '');
      await expect(stat(page, 'speed')).toContainText(deslocamentoNumero);

      await expect(page.locator('[data-sheet-skill="dnd2024:skill:percepcao"] [data-sheet-skill-passive]')).toHaveText(
        String(expectedOf('percepcao-passiva-convergente'))
      );
      await expect(page.locator('[data-sheet-skill="dnd2024:skill:intuicao"] [data-sheet-skill-passive]')).toHaveText(
        String(expectedOf('intuicao-passiva-convergente'))
      );

      const [pvAtual, pvMax] = String(expectedOf('pv-convergente')).split('/');
      await expect(page.locator('[data-sheet-hp-current]')).toHaveText(pvAtual.trim());
      await expect(page.locator('[data-sheet-hp-maximum]')).toHaveText(pvMax.trim());
      await expect(page.locator('[data-sheet-hp-temporary]')).toHaveText(String(expectedOf('pv-temporario-divergente')));

      // Dados de Vida restantes: o baseline IMPRIMIA um número errado aqui
      // (campo inexistente `dados_vida_disponiveis`); a saída unificada da Task
      // 33 dá o valor do oráculo nas três saídas.
      await expect(page.locator('[data-sheet-hit-dice]')).toContainText(
        String(expectedOf('dados-de-vida-restantes-divergente'))
      );

      // O caso do oráculo é "Capacidade de Carga / Peso Total do Inventário" e
      // o `expectedUnified` é a CAPACIDADE; o peso transportado viaja no irmão.
      await expect(page.locator('[data-sheet-load-capacity]')).toHaveText(String(expectedOf('carga-somente-na-tela')));
      await expect(page.locator('[data-sheet-load-total]')).not.toHaveText('');

      // ESPAÇOS DE MAGIA: até o cutover não havia produtor de
      // `context.spellcasting` em produção, e todo conjurador veria
      // "desconhecido" aqui. Agora o máximo é DERIVADO da matriz de progressão
      // do catálogo (`features/sheet/spellcasting-table.js`) e o disponível
      // converge com o oráculo.
      const circulo1 = page.locator('[data-sheet-slot-level="1"]');
      await expect(circulo1.locator('[data-sheet-slot-maximum]')).toHaveText(
        String(PERSONAGEM_BASE.espacos_magia['1'].total)
      );
      await expect(circulo1.locator('[data-sheet-slot-available]')).toHaveText(
        String(expectedOf('espacos-de-magia-convergente'))
      );
    }
  );

  test('aplicar dano reduz PV atual (após esgotar o PV temporário)', async ({ page }) => {
    const semTemp = { ...PERSONAGEM_BASE, pv_temporario: 0 };
    await resetApp(page, { characters: [semTemp] });
    await goFicha(page, semTemp.id);

    await aplicar(page, 'apply-damage', 5);

    await expect(page.locator('[data-sheet-hp-current]')).toHaveText(String(semTemp.pv_atual - 5));
    const [salvo] = await readCharacters(page);
    expect(salvo.pv_atual).toBe(semTemp.pv_atual - 5);
  });

  test('aplicar dano é absorvido primeiro pelo PV temporário', async ({ page }) => {
    await resetApp(page, { characters: [PERSONAGEM_BASE] });
    await goFicha(page, PERSONAGEM_BASE.id);

    await aplicar(page, 'apply-damage', 5);

    // pv_temporario era 6: 5 de dano é totalmente absorvido, pv_atual não muda.
    await expect(page.locator('[data-sheet-hp-current]')).toHaveText(String(PERSONAGEM_BASE.pv_atual));
    await expect(page.locator('[data-sheet-hp-temporary]')).toHaveText('1');
    const [salvo] = await readCharacters(page);
    expect(salvo.pv_atual).toBe(PERSONAGEM_BASE.pv_atual);
    expect(salvo.pv_temporario).toBe(1);
  });

  test('aplicar cura aumenta PV atual sem passar do máximo', async ({ page }) => {
    const ferido = { ...PERSONAGEM_BASE, pv_atual: 10 };
    await resetApp(page, { characters: [ferido] });
    await goFicha(page, ferido.id);

    await aplicar(page, 'apply-healing', 100);

    await expect(page.locator('[data-sheet-hp-current]')).toHaveText(String(ferido.pv_max));
    const [salvo] = await readCharacters(page);
    expect(salvo.pv_atual).toBe(ferido.pv_max);
  });

  test('aplicar PV temporário substitui o valor exibido', async ({ page }) => {
    const semTemp = { ...PERSONAGEM_BASE, pv_temporario: 0 };
    await resetApp(page, { characters: [semTemp] });
    await goFicha(page, semTemp.id);

    await aplicar(page, 'grant-temporary-hp', 8);

    await expect(page.locator('[data-sheet-hp-temporary]')).toHaveText('8');
    const [salvo] = await readCharacters(page);
    expect(salvo.pv_temporario).toBe(8);
  });

  test('descanso longo cura PV, RESTAURA os espaços de magia e reseta recursos de talento', async ({ page }) => {
    // A restauração dos espaços é a correção de um defeito achado NESTE
    // cutover: `cast-spell` incrementava `slots[c].used` e nada nunca o
    // decrementava (nem o descanso longo restaurava, nem o codec persistia a
    // mudança). Ver `domain/commands/rest.js` e `infra/character/character-codec.js`.
    const ferido = { ...PERSONAGEM_BASE, pv_atual: 1 };
    await resetApp(page, { characters: [ferido] });
    await goFicha(page, ferido.id);

    // O personagem do oráculo já tem 1 espaço de 1º círculo gasto.
    expect(ferido.espacos_magia['1'].usados).toBe(1);

    // Os controles de descanso são desenhados por DUAS seções (resumo/combate e
    // recursos/características) — mesma duplicidade que o baseline já tinha com
    // o controle de Fúria. O clique é escopado ao bloco de PV.
    await page.locator('[data-sheet-rest-controls] [data-action="long-rest"]').first().click();

    await expect(page.locator('[data-sheet-hp-current]')).toHaveText(String(ferido.pv_max));
    await expect(page.locator('[data-sheet-slot-level="1"] [data-sheet-slot-available]')).toHaveText(
      String(ferido.espacos_magia['1'].total)
    );

    const [salvo] = await readCharacters(page);
    expect(salvo.pv_atual).toBe(salvo.pv_max);
    // A recuperação chega ao REGISTRO, não só à tela.
    expect(salvo.espacos_magia['1'].usados).toBe(0);
    expect(salvo.recursos?.talentos?.dadiva_destino?.usado).toBe(expectedOf('recursos-de-talento-convergente'));
  });

  test('descanso curto sozinho não altera PV nem dados de vida', async ({ page }) => {
    // Ver a divergência DECLARADA no cabeçalho: gastar dado de vida é um
    // comando SEPARADO na ficha V2 (`spend-hit-die`), então o descanso curto
    // nunca cura por conta própria — o que é exatamente a garantia que o caso
    // legado media ("se recusado, não altera PV nem dados de vida").
    await resetApp(page, { characters: [PERSONAGEM_BASE] });
    await goFicha(page, PERSONAGEM_BASE.id);

    await page.locator('[data-sheet-rest-controls] [data-action="short-rest"]').first().click();

    await expect(page.locator('[data-sheet-hp-current]')).toHaveText(String(PERSONAGEM_BASE.pv_atual));
    const [salvo] = await readCharacters(page);
    expect(salvo.pv_atual).toBe(PERSONAGEM_BASE.pv_atual);
    expect(salvo.dados_vida_usados).toBe(PERSONAGEM_BASE.dados_vida_usados);
  });

  test('gastar um dado de vida é um comando PRÓPRIO e persiste', async ({ page }) => {
    // A outra metade da divergência declarada: a capacidade não sumiu, mudou
    // de lugar. Sem este caso, o cutover teria trocado um modal por nada e o
    // spec não veria.
    await resetApp(page, { characters: [PERSONAGEM_BASE] });
    await goFicha(page, PERSONAGEM_BASE.id);

    // `spend-hit-die` EXIGE o valor rolado (`healAmount`): sem ele o domínio
    // recusa com erro nomeado, que a ficha mostra num toast. É deliberado — a
    // ficha não rola dado pelo jogador.
    await aplicar(page, 'spend-hit-die', 4);

    const [salvo] = await readCharacters(page);
    expect(salvo.dados_vida_usados).toBe(PERSONAGEM_BASE.dados_vida_usados + 1);
  });
});
