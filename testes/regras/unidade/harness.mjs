// ============================================================
// Harness dos testes de unidade: stubs de globais de navegador,
// import dos módulos do app direto do disco e a mecânica de
// lacunas conhecidas.
// ============================================================
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
import { lacuna } from '../lacunas-conhecidas.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
export const RAIZ = resolve(AQUI, '..', '..', '..');

// Instala os globais de navegador que os módulos do app tocam ao serem
// importados. utils.js:609 faz `window.fecharModal = ...` no top-level,
// e é importado por regras-cobertura.js, talentos-effects.js e store.js —
// sem `window` o import lança ReferenceError. `document` acompanha porque
// utils.js manipula DOM em toasts/modais. Se um módulo passar a exigir
// outra global, acrescente o stub AQUI (e só aqui).
function instalarStubs() {
  if (globalThis.localStorage) return;
  const mapa = new Map();
  globalThis.localStorage = {
    getItem: (c) => (mapa.has(c) ? mapa.get(c) : null),
    setItem: (c, v) => mapa.set(c, String(v)),
    removeItem: (c) => mapa.delete(c),
    clear: () => mapa.clear(),
  };
  globalThis.window = globalThis;
  globalThis.document = {
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: () => ({
      style: {}, classList: { add() {}, remove() {} },
      appendChild() {}, setAttribute() {},
    }),
    body: { appendChild() {} },
  };
}

let _cache = null;

// Importa (uma vez) os módulos do app usados pelos motores de teste.
// levelup.js (obterAtributosASITalento) e creator/comum.js
// (talentoExigeEscolhas) entram aqui -- achado M9: eram importados por
// caminho relativo direto em escolhas.test.mjs, funcionando só porque uma
// linha anterior já tinha chamado modulosApp() (e portanto instalarStubs())
// antes. "AQUI (e só aqui)" vale para todo import de módulo do app usado
// pelos motores, não só para os stubs.
export async function modulosApp() {
  if (_cache) return _cache;
  instalarStubs();
  const importar = (rel) => import(pathToFileURL(resolve(RAIZ, rel)).href);
  const [regras, efeitos, store, levelup, criador] = await Promise.all([
    importar('site/js/regras-cobertura.js'),
    importar('site/js/talentos-effects.js'),
    importar('site/js/store.js'),
    importar('site/js/levelup.js'),
    importar('site/js/creator/comum.js'),
  ]);
  _cache = { regras, efeitos, store, levelup, criador };
  return _cache;
}

// Achata dados/talentos/talentos.json em uma lista de 75 talentos.
export function lerTalentosDados() {
  const d = JSON.parse(readFileSync(resolve(RAIZ, 'dados/talentos/talentos.json'), 'utf-8'));
  const lista = [];
  for (const grupo of Object.values(d.por_categoria)) lista.push(...grupo);
  return lista;
}

// Títulos `### Nome` de Talentos.md — para conferir as citações do catálogo.
export function lerTitulosLivro() {
  const md = readFileSync(
    resolve(RAIZ, 'Informacoes Separadas', 'Talentos.md'), 'utf-8');
  return new Set([...md.matchAll(/^###\s+(.+?)\s*$/gm)].map((m) => m[1]));
}

// Personagem mínimo dos testes de validação/passivos. Nível 4 (bônus
// de proficiência +2) e duas perícias proficientes, porque algumas
// validações exigem proficiência prévia (Dádiva da Proficiência em Perícia).
export async function charBase() {
  const { store } = await modulosApp();
  const p = store.criarPersonagemVazio();
  p.nivel = 4;
  p.pericias_proficientes = ['Atletismo', 'História'];
  return p;
}

// Mecânica de lacunas: sem lacuna registrada, roda o confronto
// normalmente; com lacuna, exige que ele FALHE — se passar, o app foi
// corrigido e a entrada precisa sair da lista.
export async function comLacuna(talento, teste, fn) {
  const pendente = lacuna(talento, teste);
  if (!pendente) return fn();
  try {
    await fn();
  } catch {
    return; // falha esperada, documentada em lacunas-conhecidas.mjs
  }
  throw new Error(
    `Lacuna corrigida: remova { talento: '${talento}', teste: '${teste}' } de lacunas-conhecidas.mjs`);
}
