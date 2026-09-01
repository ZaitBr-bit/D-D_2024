// ============================================================
// Cartao da tela inicial com ficha MULTICLASSE.
//
// Relato: "Tela inicial nao mostra todas as classes do personagem".
//
// A home lia os ESPELHOS legados (`p.classe`, `p.subclasse`, `p.nivel`),
// que `sincronizarEspelhos` define como classe INICIAL + nivel TOTAL.
// O cartao entao nao ficava incompleto: ficava FALSO -- um Mago 5/Bruxo 3
// aparecia como "Mago" com "Nv. 8", que se le como um Mago de nivel 8.
//
// Mesma familia ja corrigida em sheet/impressao.js e sheet/pdf.js.
// ============================================================
import { test, expect } from '@playwright/test';
import { ATRIBUTOS_REGRAS, NOVO, abrirSite, assentar } from './helpers-regras.mjs';
import { semearPersonagem } from '../helpers.mjs';

const CLASSES_MC = [
  { classe: 'Mago', subclasse: 'Evocação', nivel: 5, ordem: 0 },
  { classe: 'Bruxo', subclasse: 'Corruptor', nivel: 3, ordem: 1 },
];

/** Semeia uma ficha multiclasse e abre a tela inicial. */
async function homeComMulticlasse(context) {
  const { page } = await abrirSite(context);
  await semearPersonagem(page, {
    nome: 'Multi', especie: 'Humano', atributos: ATRIBUTOS_REGRAS,
    // Espelhos como `sincronizarEspelhos` os produz: inicial + total.
    classe: 'Mago', subclasse: 'Evocação', nivel: 8,
    classes: CLASSES_MC, schema_versao: 2,
  }, 'home-mc-1');
  await page.goto(NOVO, { waitUntil: 'domcontentloaded' });
  await assentar(page).catch(() => {});
  return page;
}

test('o cartao da home lista TODAS as classes, com o nivel de cada uma', async ({ context }) => {
  const page = await homeComMulticlasse(context);
  const detalhe = page.locator('.char-card .char-detalhe');
  await expect(detalhe, 'o cartao precisa existir').toHaveCount(1);
  const texto = (await detalhe.textContent()).replace(/\s+/g, ' ').trim();

  expect(texto, `a classe inicial precisa aparecer -- texto lido: "${texto}"`).toContain('Mago');
  expect(texto, `a SEGUNDA classe some do cartao -- texto lido: "${texto}"`).toContain('Bruxo');
  expect(texto, `sem o nivel por classe, "Nv. 8" se le como Mago 8 -- texto lido: "${texto}"`)
    .toMatch(/Mago[^/]*5/);
  expect(texto, `o nivel do Bruxo precisa aparecer -- texto lido: "${texto}"`)
    .toMatch(/Bruxo[^/]*3/);
});

test('o cartao da home mostra o dado de vida de todas as classes', async ({ context }) => {
  const page = await homeComMulticlasse(context);
  const texto = (await page.locator('.char-card .char-detalhe').textContent())
    .replace(/\s+/g, ' ').trim();
  // Mago tem d6 e Bruxo tem d8: mostrar so o da classe inicial esconde
  // metade da reserva de dados de vida do personagem.
  expect(texto, `d6 (Mago) precisa aparecer -- texto lido: "${texto}"`).toContain('d6');
  expect(texto, `d8 (Bruxo) some do cartao -- texto lido: "${texto}"`).toContain('d8');
});

test('ficha de classe UNICA continua sem nivel repetido no cartao', async ({ context }) => {
  const { page } = await abrirSite(context);
  await semearPersonagem(page, {
    nome: 'Solo', especie: 'Anao', atributos: ATRIBUTOS_REGRAS,
    classe: 'Mago', subclasse: 'Evocação', nivel: 5,
    classes: [{ classe: 'Mago', subclasse: 'Evocação', nivel: 5, ordem: 0 }],
    schema_versao: 2,
  }, 'home-solo-1');
  await page.goto(NOVO, { waitUntil: 'domcontentloaded' });
  await assentar(page).catch(() => {});

  const texto = (await page.locator('.char-card .char-detalhe').textContent())
    .replace(/\s+/g, ' ').trim();
  // Com uma classe so o nivel ja aparece no selo "Nv. 5" ao lado; repeti-lo
  // aqui mudaria a tela de quem NAO e multiclasse.
  expect(texto, `classe unica nao deve repetir o nivel -- texto lido: "${texto}"`)
    .not.toMatch(/Mago\s*5/);
  expect(texto).toContain('Mago');
});
