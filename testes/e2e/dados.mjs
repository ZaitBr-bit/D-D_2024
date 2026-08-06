// Listas de classes, especies e antecedentes lidas do LIVRO DE REGRAS em
// `dados/`, para que os testes cubram tudo que o app oferece -- e para que
// um conteudo novo entre na cobertura sem ninguem lembrar de editar aqui.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, '..', '..');

function json(rel) {
  return JSON.parse(readFileSync(resolve(RAIZ, rel), 'utf-8'));
}

/** Nomes das 12 classes, na ordem em que `dados-classes.js` as declara. */
export function classes() {
  const src = readFileSync(resolve(RAIZ, 'site/js/dados-classes.js'), 'utf-8');
  const inicio = src.indexOf('CLASSES_INFO');
  const fim = src.indexOf('\n};', inicio);
  const bloco = src.slice(inicio, fim);
  const nomes = [...bloco.matchAll(/^\s{2}['"]?([A-Za-zÀ-ÿ]+)['"]?:\s*\{/gm)]
    .map((m) => m[1]);
  if (nomes.length !== 12) {
    throw new Error(`esperava 12 classes em dados-classes.js, achei ${nomes.length}`);
  }
  return nomes;
}

/** Nomes das especies de `dados/origens/especies.json`. */
export function especies() {
  const d = json('dados/origens/especies.json');
  const lista = Array.isArray(d) ? d : (d.especies || []);
  const nomes = lista.map((e) => e.nome).filter(Boolean);
  if (nomes.length < 8) {
    throw new Error(`esperava >=8 especies, achei ${nomes.length}`);
  }
  return nomes;
}

/** Nomes dos antecedentes de `dados/origens/antecedentes.json`. */
export function antecedentes() {
  const d = json('dados/origens/antecedentes.json');
  const lista = Array.isArray(d) ? d : (d.antecedentes || []);
  return lista.map((a) => a.nome).filter(Boolean);
}

/** Maior nivel de personagem, lido da tabela XP_POR_NIVEL de levelup.js. */
export function nivelMaximo() {
  const src = readFileSync(resolve(RAIZ, 'site/js/levelup.js'), 'utf-8');
  const inicio = src.indexOf('XP_POR_NIVEL');
  const bloco = src.slice(inicio, src.indexOf('\n};', inicio));
  const niveis = [...bloco.matchAll(/^\s+(\d+):\s*\d+/gm)].map((m) => Number(m[1]));
  const max = Math.max(...niveis);
  if (!Number.isFinite(max) || max < 20) {
    throw new Error(`nivel maximo inesperado em levelup.js: ${max}`);
  }
  return max;
}

/** Classes conjuradoras, segundo `CLASSES_INFO[x].conjurador`. */
export function conjuradoras() {
  const src = readFileSync(resolve(RAIZ, 'site/js/dados-classes.js'), 'utf-8');
  const inicio = src.indexOf('CLASSES_INFO');
  const fim = src.indexOf('\n};', inicio);
  const bloco = src.slice(inicio, fim);
  const fora = [];
  for (const m of bloco.matchAll(
    /^\s{2}['"]?([A-Za-zÀ-ÿ]+)['"]?:\s*\{([\s\S]*?)\n\s{2}\}/gm)) {
    if (/conjurador:\s*true/.test(m[2])) fora.push(m[1]);
  }
  return fora;
}
