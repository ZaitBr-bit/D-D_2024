// Paridade da ficha para CADA UMA DAS 12 CLASSES, em tres niveis.
//
// A lista vem de `site/js/dados-classes.js`, nao de uma constante escrita a
// mao: uma classe nova entra na cobertura sozinha.
//
// TODOS os 20 niveis de TODAS as 12 classes. Nao ha subconjunto
// representativo: cada nivel liga caracteristicas, espacos de magia, dados de
// vida, ASI e recursos diferentes, e uma extracao mal feita silenciaria
// justamente um deles. Sao 240 fichas a ~1 segundo cada.
import { test, expect } from '@playwright/test';
import {
  abrirParelha, abrirFichaSemeada, instantaneoFicha, primeiraDivergencia,
  relatorioErros,
} from './helpers.mjs';
import { classes, conjuradoras, nivelMaximo } from './dados.mjs';

const NIVEIS = Array.from({ length: nivelMaximo() }, (_, i) => i + 1);
const CONJURADORAS = new Set(conjuradoras());

/** Atributos com o primario alto, para a classe nao ficar degenerada. */
const ATRIBUTOS = {
  forca: 15, destreza: 14, constituicao: 14,
  inteligencia: 13, sabedoria: 12, carisma: 10,
};

for (const classe of classes()) {
  test.describe(`classe: ${classe}`, () => {
    for (const nivel of NIVEIS) {
      test(`nivel ${nivel} renderiza igual ao original`, async ({ context }) => {
        const lados = await abrirParelha(context);
        await abrirFichaSemeada(lados, {
          nome: `${classe} n${nivel}`,
          classe,
          especie: 'Humano',
          antecedente: 'Soldado',
          nivel,
          atributos: ATRIBUTOS,
        }, `teste-${classe.normalize('NFD').replace(/[^a-z]/gi, '').toLowerCase()}-${nivel}`);

        expect(relatorioErros(lados),
          `erros ao abrir ficha de ${classe} nivel ${nivel}`).toBe('');

        const [a, b] = await Promise.all(lados.map((l) => instantaneoFicha(l.page)));
        expect(primeiraDivergencia(a, b),
          `ficha de ${classe} nivel ${nivel} difere`).toBeNull();
      });
    }

    test('secao de recursos da classe aparece nos dois', async ({ context }) => {
      const lados = await abrirParelha(context);
      await abrirFichaSemeada(lados, {
        nome: `${classe} recursos`, classe, especie: 'Humano',
        antecedente: 'Soldado', nivel: 5, atributos: ATRIBUTOS,
      }, `rec-${classe.normalize('NFD').replace(/[^a-z]/gi, '').toLowerCase()}`);

      // Conjuradoras precisam mostrar a secao de magias; todas precisam
      // mostrar Caracteristicas de classe no nivel 5.
      for (const l of lados) {
        const texto = await l.page.textContent('#app-content');
        expect(texto, `${l.nome}: sem Caracteristicas para ${classe}`)
          .toContain('Características');
        if (CONJURADORAS.has(classe)) {
          expect(texto, `${l.nome}: ${classe} e conjuradora e nao mostrou Magias`)
            .toMatch(/Magias|Truques/);
        }
      }
    });
  });
}
