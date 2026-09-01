// ============================================================
// Oráculo da Tarefa 3 (issue #36): o subtítulo do cartão do PDF
// (site/js/sheet/pdf.js) tem de listar TODAS as classes do personagem, não
// só a classe INICIAL -- mesmo defeito, e mesma correção, já aplicados em
// ficha.js:270-274 (cabeçalho da ficha) e impressao.js:186-206 (impressão).
//
// pdf.js:130 montava o subtítulo com os campos ESPELHO `char.classe` e
// `char.subclasse`, que apontam sempre para a classe de ordem 0
// (regras-multiclasse.js:classeInicial) e não mudam quando o personagem
// multiclassa -- a fonte da verdade é `char.classes[]`, lida por
// `classesDe(p)`.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { modulosApp, personagemMulticlasse, RAIZ } from './harness.mjs';

// Garante os stubs de navegador (window/document/localStorage) instalados
// ANTES de importar pdf.js -- o mesmo motivo do padrão carregarImpressao()
// em multiclasse-descansos.test.mjs/multiclasse-magias.test.mjs: pdf.js
// importa (em cadeia) estado.js e outros módulos que tocam `window` no
// top-level.
await modulosApp();

// pdf.js não entra no cache de modulosApp() (harness.mjs) -- nenhum motor
// existente precisava dele antes desta tarefa. Import direto por caminho de
// disco, em cache local, mesmo padrão de carregarImpressao() nos arquivos
// irmãos.
let _pdfMod = null;
async function carregarPdf() {
  if (!_pdfMod) {
    _pdfMod = await import(pathToFileURL(resolve(RAIZ, 'site/js/sheet/pdf.js')).href);
  }
  return _pdfMod;
}

// ORÁCULO 1 -- multiclasse: as DUAS classes têm de aparecer no subtítulo,
// cada uma com o nível DELA (não o total), porque `cs.length > 1`.
test('subtítulo do cartão do PDF lista todas as classes de um personagem multiclasse', async () => {
  const p = await personagemMulticlasse([
    { classe: 'Guerreiro', nivel: 5 },
    { classe: 'Mago', nivel: 3, subclasse: 'Evocação' },
  ]);
  p.especie = 'Humano';
  p.antecedente = 'Soldado';
  p.alinhamento = 'Leal e Bom';

  const pdf = await carregarPdf();
  const sub = pdf.montarSubtituloCartaoPdf(p);

  assert.ok(sub.includes('Guerreiro 5'),
    `esperava "Guerreiro 5" (classe inicial, com o nível DELA) no subtítulo -- recebi: "${sub}"`);
  assert.ok(sub.includes('Mago (Evocação) 3'),
    `esperava "Mago (Evocação) 3" (segunda classe, com subclasse e nível DELA) no ` +
    `subtítulo -- a classe segunda-ou-posterior é exatamente a que o espelho ` +
    `char.classe/char.subclasse não enxerga. Recebi: "${sub}"`);
  assert.ok(sub.includes('Nível 8'),
    `"Nível" continua sendo o TOTAL das duas classes (livro:2037) -- recebi: "${sub}"`);
});

// ORÁCULO 2 -- classe única: o texto tem de sair IDÊNTICO ao formato de
// antes (sem nível por classe, porque `cs.length > 1` é falso com uma classe
// só). Comparação direta com a fórmula ANTIGA (pdf.js:130 antes da
// correção), montada aqui à mão, para o par medir regressão de verdade e
// não só "contém a classe".
test('subtítulo do cartão do PDF de personagem de classe única sai idêntico ao formato anterior', async () => {
  const p = {
    especie: 'Anão',
    classe: 'Clérigo',
    subclasse: 'Vida',
    nivel: 7,
    antecedente: 'Eremita',
    alinhamento: 'Neutro e Bom',
  };
  // Fórmula ANTIGA de pdf.js:130, reproduzida aqui só para o oráculo --
  // não é chamada de produção nenhuma.
  const esperado = `${p.especie || ''} ${p.classe || ''}${p.subclasse ? ` (${p.subclasse})` : ''}` +
    ` — Nível ${p.nivel}${p.antecedente ? ` | ${p.antecedente}` : ''}${p.alinhamento ? ` | ${p.alinhamento}` : ''}`;

  const pdf = await carregarPdf();
  const sub = pdf.montarSubtituloCartaoPdf(p);

  assert.equal(sub, esperado,
    'classe única não pode mudar: mesmo texto que a fórmula antiga (espelhos char.classe/char.subclasse) produzia');
});

// ORÁCULO 3 -- selo de pré-requisito dispensado (estado.js:
// seloPrerequisitoDispensado): o PDF desenha texto plano com pdf-lib, sem
// HTML, então o selo vira um marcador de texto em vez do badge da tela/
// impressão -- mas a marca tem de sobreviver, na classe certa.
test('subtítulo do cartão do PDF marca a classe com pré-requisito de multiclasse dispensado', async () => {
  const p = await personagemMulticlasse([
    { classe: 'Guerreiro', nivel: 5 },
    { classe: 'Paladino', nivel: 5 },
  ]);
  p.edicoes.campos['prerequisitoDispensado.Paladino'] = { faltando: [{ atributo: 'Carisma', valor: 13 }], original: null };

  const pdf = await carregarPdf();
  const sub = pdf.montarSubtituloCartaoPdf(p);

  assert.ok(sub.includes('Paladino') && / dispensad[oa]/i.test(sub),
    `esperava alguma marca textual de "dispensado" junto de Paladino -- recebi: "${sub}"`);
  assert.ok(!/Guerreiro[^/]*dispensad/i.test(sub),
    `Guerreiro não tem a marca -- ela é só do Paladino. Recebi: "${sub}"`);
});
