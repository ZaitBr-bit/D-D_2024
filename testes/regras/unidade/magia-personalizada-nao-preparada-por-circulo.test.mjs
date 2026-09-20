// ============================================================
// Issues #75/#92 -- a seção "Personalizadas não preparadas" era uma
// lista única ordenada só por nome. #75 pede o mesmo agrupamento por
// círculo (com botão de minimizar por círculo) que a lista de Preparadas
// já usa; #92 pede a seção inteira nascendo MINIMIZADA por padrão (hoje
// só as outras seções nascem assim).
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { modulosApp, lerClassesDados } from './harness.mjs';

const { sheetEstado, sheetMagias } = await modulosApp();
const mapaDadosDisco = lerClassesDados();

function preparar(personagem) {
  sheetEstado.definirClasseData(mapaDadosDisco.get('Clérigo'));
  sheetEstado.definirClassesData(mapaDadosDisco);
  sheetEstado.definirChar(personagem);
}

const CAMPOS_MAGIA = {
  escola: 'Evocação', tempo_conjuracao: 'Ação', alcance: '18 metros',
  componentes: 'V', duracao: 'Instantânea', descricao: 'Uma chama azul.',
  dano: '', ritual: false,
};

function clerigoNivel5({ preparadas = [], customizadas = [] } = {}) {
  return {
    nome: 'Devoto', especie: 'Humano', classe: 'Clérigo', subclasse: '',
    nivel: 5, xp: 6500,
    atributos: { forca: 10, destreza: 10, constituicao: 14, inteligencia: 8, sabedoria: 18, carisma: 10 },
    classes: [{ classe: 'Clérigo', subclasse: '', nivel: 5, ordem: 0 }],
    grimorio: [], magias_preparadas: preparadas, magias_customizadas: customizadas,
    schema_versao: 2,
  };
}

test('a seção "não preparadas" agrupa por círculo, com um <details> próprio por círculo', () => {
  const p = clerigoNivel5({
    customizadas: [
      { nome: 'Chama Azul', circulo: 1, sempre_preparada: false, ...CAMPOS_MAGIA },
      { nome: 'Raio Verde', circulo: 2, sempre_preparada: false, ...CAMPOS_MAGIA },
    ],
  });
  preparar(p);

  const html = sheetMagias.renderSecaoMagias();
  assert.ok(html.includes('data-details-id="magias-personalizadas-nao-preparadas-circulo-1"'),
    'tem de existir um bloco de círculo 1 dentro da seção');
  assert.ok(html.includes('data-details-id="magias-personalizadas-nao-preparadas-circulo-2"'),
    'tem de existir um bloco de círculo 2 dentro da seção');
  assert.ok(html.includes('1º Círculo (1)'), 'o bloco do círculo 1 conta só Chama Azul');
  assert.ok(html.includes('2º Círculo (1)'), 'o bloco do círculo 2 conta só Raio Verde');
});

test('cada magia aparece só no bloco do SEU círculo, não nos dois', () => {
  const p = clerigoNivel5({
    customizadas: [
      { nome: 'Chama Azul', circulo: 1, sempre_preparada: false, ...CAMPOS_MAGIA },
      { nome: 'Raio Verde', circulo: 2, sempre_preparada: false, ...CAMPOS_MAGIA },
    ],
  });
  preparar(p);
  const html = sheetMagias.renderSecaoMagias();

  const inicioC1 = html.indexOf('data-details-id="magias-personalizadas-nao-preparadas-circulo-1"');
  const fimC1 = html.indexOf('</details>', inicioC1);
  const blocoC1 = html.slice(inicioC1, fimC1);
  assert.ok(blocoC1.includes('Chama Azul'), 'Chama Azul tem de estar no bloco de círculo 1');
  assert.ok(!blocoC1.includes('Raio Verde'), 'Raio Verde não pode vazar para o bloco de círculo 1');
});

test('a seção "não preparadas" NÃO nasce aberta -- issue #92 (minimizada por padrão)', () => {
  const p = clerigoNivel5({
    customizadas: [{ nome: 'Chama Azul', circulo: 1, sempre_preparada: false, ...CAMPOS_MAGIA }],
  });
  preparar(p);
  const html = sheetMagias.renderSecaoMagias();

  const inicio = html.indexOf('data-details-id="magias-personalizadas-nao-preparadas"');
  const tagAbertura = html.slice(html.lastIndexOf('<details', inicio), html.indexOf('>', inicio) + 1);
  assert.ok(!/\sopen(\s|>)/.test(tagAbertura),
    `a tag <details> da seção não pode ter o atributo "open": ${tagAbertura}`);
});

test('cada bloco de círculo, dentro da seção, também nasce minimizado (mesmo padrão da lista de Preparadas)', () => {
  const p = clerigoNivel5({
    customizadas: [{ nome: 'Chama Azul', circulo: 1, sempre_preparada: false, ...CAMPOS_MAGIA }],
  });
  preparar(p);
  const html = sheetMagias.renderSecaoMagias();

  const inicio = html.indexOf('data-details-id="magias-personalizadas-nao-preparadas-circulo-1"');
  assert.ok(inicio >= 0, 'sanity: o bloco de círculo 1 tem de existir -- sem ele o teste abaixo não mede nada');
  const tagAbertura = html.slice(html.lastIndexOf('<details', inicio), html.indexOf('>', inicio) + 1);
  assert.ok(!/\sopen(\s|>)/.test(tagAbertura),
    `a tag <details> do círculo não pode ter o atributo "open": ${tagAbertura}`);
});
