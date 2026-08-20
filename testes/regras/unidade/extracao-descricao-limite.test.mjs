// ============================================================
// Limite de uma característica: onde a descrição termina.
//
// No livro, cada característica é um `### Nível X: Nome` e vai até o
// próximo cabeçalho. O extrator (_extrair_json.py) fecha a descrição no
// próximo `### ` (outra característica) ou `## ` (uma subclasse) -- e é
// só isso. O cabeçalho que abre a seção de subclasses é de nível 1
// (`# Subclasses de <Classe>`), não casa com nenhum dos dois, e a ÚLTIMA
// característica de cada classe engolia ele mais o parágrafo de abertura
// da seção.
//
// Isso aparece na ficha do jogador: a característica de nível 20 vem
// seguida de "# Subclasses de Monge" e de um parágrafo explicando o que é
// uma subclasse. Está visível no print da issue #19.
//
// A asserção é estrutural, não textual: nenhuma descrição pode conter um
// cabeçalho de nível 1 ou 2, porque no livro esses dois níveis são sempre
// FRONTEIRA de seção -- se um deles está dentro de uma descrição, o
// recorte passou do fim. Cabeçalhos de nível 4 continuam permitidos: o
// Companheiro Primal do Guardião usa `#### *Fera do Céu*` e afins como
// subtítulos DENTRO da própria característica, e são conteúdo legítimo.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { RAIZ } from './harness.mjs';

const DIR_CLASSES = resolve(RAIZ, 'dados', 'classes');

// Cabeçalho de nível 1 ou 2 no início de uma linha. O `(?!#)` impede que
// `### ` e `#### ` casem com o ramo de dois `#`.
const CABECALHO_DE_SECAO = /^(#|##)(?!#)\s+.+$/m;

/** Todas as características (da classe e de cada subclasse) de um arquivo */
function caracteristicasDe(dados) {
  const todas = (dados.caracteristicas || [])
    .map(c => ({ ...c, contexto: 'classe' }));
  for (const sub of dados.subclasses || []) {
    todas.push(...(sub.caracteristicas || [])
      .map(c => ({ ...c, contexto: `subclasse ${sub.nome}` })));
  }
  return todas;
}

// `dados/classes/` guarda também as listas de magia por classe
// (`magias_<classe>.json`), que não têm características -- só os arquivos
// de classe entram no motor.
const ARQUIVOS = readdirSync(DIR_CLASSES)
  .filter(n => n.endsWith('.json') && !n.startsWith('magias_'));

// Guarda contra o motor virar vacuamente verde se o diretório sumir ou o
// filtro parar de casar -- 12 classes, uma por arquivo.
test('dados/classes/ tem os 12 arquivos de classe', () => {
  assert.equal(ARQUIVOS.length, 12,
    `esperado 12 arquivos de classe, encontrados ${ARQUIVOS.length}: ` +
    ARQUIVOS.join(', '));
});

for (const arquivo of ARQUIVOS) {
  test(`${arquivo}: nenhuma descrição invade a seção seguinte`, () => {
    const dados = JSON.parse(readFileSync(resolve(DIR_CLASSES, arquivo), 'utf-8'));
    assert.ok(Array.isArray(dados.caracteristicas) && dados.caracteristicas.length > 0,
      `${arquivo}: sem características para conferir`);
    const invasoras = [];

    for (const c of caracteristicasDe(dados)) {
      const achado = CABECALHO_DE_SECAO.exec(c.descricao || '');
      if (achado) {
        invasoras.push(`nv${c.nivel} ${c.nome} (${c.contexto}) engoliu ` +
          `"${achado[0].trim()}"`);
      }
    }

    assert.deepEqual(invasoras, [],
      `${arquivo}: descrição que passou do fim da característica:\n  ` +
      invasoras.join('\n  '));
  });
}
