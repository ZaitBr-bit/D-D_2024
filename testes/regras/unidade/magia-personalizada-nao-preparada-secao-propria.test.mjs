// ============================================================
// Issue #71 -- a personalizada "ocupa vaga" (sempre_preparada:false) sem
// entrada gravada ainda (Mago que não preparou do grimório; outra classe
// que a tirou pelo "x" das preparadas) saía misturada DENTRO da lista de
// Preparadas por círculo, marcada "Não preparada" -- poluindo a lista que
// o jogador olha para saber o que está pronto para conjurar. Ela passa a
// sair numa seção PRÓPRIA ("Personalizadas não preparadas"), fora dos
// blocos `magias-circulo-N`, preservando Editar/Remover (os únicos
// botões que ela tem).
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

/**
 * Recorta o HTML de um bloco <details data-details-id="ID">...</details>,
 * sem parser de verdade -- mas contando profundidade de <details>/</details>
 * aninhados (issues #75/#92: "não preparadas" passou a aninhar um
 * <details> por círculo DENTRO do <details> da seção), para não parar no
 * primeiro fechamento, que seria de um bloco filho, não do procurado.
 */
function blocoDetails(html, id) {
  const abre = `data-details-id="${id}"`;
  const posAtributo = html.indexOf(abre);
  if (posAtributo < 0) return null;
  const tagInicio = html.lastIndexOf('<details', posAtributo);
  const TAGS = /<details|<\/details>/g;
  TAGS.lastIndex = tagInicio;
  let profundidade = 0;
  let m;
  while ((m = TAGS.exec(html))) {
    profundidade += m[0] === '<details' ? 1 : -1;
    if (profundidade === 0) return html.slice(tagInicio, TAGS.lastIndex);
  }
  return null;
}

test('personalizada "ocupa vaga" sem entrada gravada NÃO aparece dentro do bloco magias-circulo-N', () => {
  const p = clerigoNivel5({
    customizadas: [{ nome: 'Chama Azul', circulo: 1, sempre_preparada: false, ...CAMPOS_MAGIA }],
  });
  preparar(p);

  const html = sheetMagias.renderSecaoMagias();
  assert.ok(!html.includes('data-details-id="magias-circulo-1"'),
    'sanity: sem nenhuma OUTRA magia de 1º círculo preparada, o bloco de círculo nem deveria existir');

  const secaoPropria = blocoDetails(html, 'magias-personalizadas-nao-preparadas');
  assert.ok(secaoPropria, 'a seção "Personalizadas não preparadas" tem de existir');
  assert.ok(secaoPropria.includes('Chama Azul'), 'Chama Azul tem de estar NELA');
});

test('personalizada "ocupa vaga" sem entrada gravada some da CONTAGEM do círculo quando há outras preparadas de verdade', () => {
  const p = clerigoNivel5({
    preparadas: [{ nome: 'Prece Antiga', circulo: 1, classe: 'Clérigo' }],
    customizadas: [{ nome: 'Chama Azul', circulo: 1, sempre_preparada: false, ...CAMPOS_MAGIA }],
  });
  preparar(p);

  const html = sheetMagias.renderSecaoMagias();
  const blocoCirculo1 = blocoDetails(html, 'magias-circulo-1');
  assert.ok(blocoCirculo1, 'o bloco do 1º círculo tem de existir (Prece Antiga está preparada de verdade)');
  assert.ok(blocoCirculo1.includes('1º Círculo (1)'),
    'a contagem do círculo conta só Prece Antiga -- Chama Azul (não preparada) não pode inflar o número');
  assert.ok(!blocoCirculo1.includes('Chama Azul'), 'Chama Azul não pode aparecer dentro do bloco de círculo');

  const secaoPropria = blocoDetails(html, 'magias-personalizadas-nao-preparadas');
  assert.ok(secaoPropria?.includes('Chama Azul'), 'Chama Azul aparece só na seção própria');
});

test('personalizada "ocupa vaga" COM entrada gravada (já preparada) NÃO entra na seção "não preparadas"', () => {
  const p = clerigoNivel5({
    preparadas: [{ nome: 'Chama Azul', circulo: 1, classe: 'Clérigo' }],
    customizadas: [{ nome: 'Chama Azul', circulo: 1, sempre_preparada: false, ...CAMPOS_MAGIA }],
  });
  preparar(p);

  const html = sheetMagias.renderSecaoMagias();
  assert.ok(!html.includes('data-details-id="magias-personalizadas-nao-preparadas"'),
    'já preparada -- a seção "não preparadas" nem deveria ser desenhada');
  const blocoCirculo1 = blocoDetails(html, 'magias-circulo-1');
  assert.ok(blocoCirculo1?.includes('Chama Azul'), 'Chama Azul continua no bloco normal de círculo, como preparada');
});
