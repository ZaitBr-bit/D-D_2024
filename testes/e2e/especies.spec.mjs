// Paridade da ficha para CADA ESPECIE de `dados/origens/especies.json`.
//
// Especie afeta deslocamento, tamanho, idiomas, tracos e -- em Anao e
// Draconato -- o PV maximo, por meio das sincronizacoes de bonus de PV. Sao
// justamente os pontos onde uma extracao mal feita silenciaria um efeito.
import { test, expect } from '@playwright/test';
import {
  abrirParelha, abrirFichaSemeada, instantaneoFicha, primeiraDivergencia,
  relatorioErros,
} from './helpers.mjs';
import { especies, antecedentes } from './dados.mjs';

const ATRIBUTOS = {
  forca: 15, destreza: 14, constituicao: 14,
  inteligencia: 13, sabedoria: 12, carisma: 10,
};

const slug = (s) => s.normalize('NFD').replace(/[^a-z]/gi, '').toLowerCase();

for (const especie of especies()) {
  test(`especie ${especie}: ficha renderiza igual ao original`, async ({ context }) => {
    const lados = await abrirParelha(context);
    await abrirFichaSemeada(lados, {
      nome: `Teste ${especie}`,
      classe: 'Guerreiro',
      especie,
      antecedente: 'Soldado',
      nivel: 5,
      atributos: ATRIBUTOS,
    }, `esp-${slug(especie)}`);

    expect(relatorioErros(lados), `erros na ficha de ${especie}`).toBe('');

    const [a, b] = await Promise.all(lados.map((l) => instantaneoFicha(l.page)));
    expect(primeiraDivergencia(a, b), `ficha de ${especie} difere`).toBeNull();
  });
}

// TODOS os antecedentes de dados/origens/antecedentes.json. Cada um concede
// pericias, proficiencia de ferramenta, um talento de origem e uma
// distribuicao de bonus de atributo diferentes -- nao ha subconjunto
// representativo, e o custo e de ~2 segundos por antecedente.
for (const antecedente of antecedentes()) {
  test(`antecedente ${antecedente}: ficha renderiza igual ao original`, async ({ context }) => {
    const lados = await abrirParelha(context);
    await abrirFichaSemeada(lados, {
      nome: `Teste ${antecedente}`,
      classe: 'Ladino',
      especie: 'Humano',
      antecedente,
      nivel: 3,
      atributos: ATRIBUTOS,
    }, `ant-${slug(antecedente)}`);

    expect(relatorioErros(lados), `erros na ficha com ${antecedente}`).toBe('');

    const [a, b] = await Promise.all(lados.map((l) => instantaneoFicha(l.page)));
    expect(primeiraDivergencia(a, b), `ficha com ${antecedente} difere`).toBeNull();
  });
}
