// ============================================================
// Pacote inicial: o item entra no inventário COM o peso do livro
// (issue #43, causas raiz A e B, medidas na tela).
//
// `equipamento-inicial-acervo.test.mjs` varre as 12 classes e todos os
// antecedentes chamando `montarItensEquipamentoInicial` com o acervo que
// `carregarDadosEquipSheet()` devolve. O que aquele motor NÃO alcança é o
// fio entre os dois: as linhas de `renderStepEquipamento` que copiam o
// acervo para `dadosCache` campo a campo. Trocar
// `dadosCache.ferramentas = dadosEquip.ferramentas` por um no-op deixaria
// aquele motor verde e o Ladino do jogador sem os 0,5 kg das Ferramentas
// de Ladrão -- exatamente o defeito relatado.
//
// Este spec escolhe a opção A do pacote da classe no criador e lê o
// personagem EM CONSTRUÇÃO, que é o objeto que o wizard muta de verdade.
// ============================================================
import { test, expect } from '@playwright/test';
import {
  abrirSite, assentar, irAtePassoEquipamento, personagemEmCriacao,
} from './helpers-regras.mjs';

const CASOS = [
  {
    classe: 'Ladino',
    // "Ferramentas de Ladrão" só tem peso em dados/equipamento/ferramentas.json,
    // que nem era extraído nem entrava no acervo do criador.
    item: 'Ferramentas de Ladrão', peso: '0,5 kg',
  },
  {
    classe: 'Bruxo',
    // O pacote pede "Foco Arcano (orbe)". A entrada generica "Foco Arcano"
    // pesa "Varia" (= 0 kg); o peso de verdade e por FORMA, e a forma esta
    // escrita no proprio pacote -- entao o item entra como a variante.
    item: 'Foco Arcano (Orbe)', peso: '1,5 kg',
  },
  {
    classe: 'Mago',
    // "foco arcano cajado", citado por escrito no relato da issue #43.
    item: 'Foco Arcano (Cajado)', peso: '2 kg',
  },
];

for (const { classe, item, peso } of CASOS) {
  test(`criador: o pacote inicial do ${classe} traz "${item}" com o peso do livro`, async ({ context }) => {
    const { page } = await abrirSite(context, '#criar');
    expect(await irAtePassoEquipamento(page, classe),
      'não chegou ao passo de equipamento').toBe(true);

    await page.click('[data-equip-tipo="classe"][data-equip-letra="A"]');
    await assentar(page).catch(() => {});

    const emConstrucao = await personagemEmCriacao(page);
    const inventario = emConstrucao?.inventario || [];
    expect(inventario.length,
      'a opção A do pacote da classe precisa ter enchido o inventário').toBeGreaterThan(0);

    const gravado = inventario.find(i => i.nome === item);
    expect(gravado,
      `"${item}" precisa entrar no inventário com o nome do acervo; sem casar, ` +
      `ele entra com o nome cru do pacote e \`dados: {}\`. Inventário: ` +
      inventario.map(i => `${i.nome} [${i.tipo}]`).join(', ')).toBeTruthy();
    expect(gravado.tipo,
      `"${item}" caiu no ramo genérico -- entra sem peso e sem custo`).not.toBe('generico');
    expect(gravado.dados?.peso,
      `o livro dá ${peso} a "${item}"; sem isso o item some da conta de carga`).toBe(peso);
  });
}
