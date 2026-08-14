// ============================================================
// Regra de dependência do seletor de itens unificado (achado IMPORTANTE 5
// da revisão final de branch inteira, 2026-08-13).
//
// site/js/itens-seletor.js e site/js/regras-equipamento.js NÃO PODEM
// importar de site/js/sheet/, site/js/creator/ nem de site/js/store.js --
// é a regra que o spec (docs/superpowers/specs/
// 2026-08-13-seletor-itens-unificado-design.md, seção "Arquitetura")
// chama de "a regra que impede o acoplamento entre criador e ficha". O
// personagem e os callbacks de persistência entram por parâmetro (`ctx`),
// não por import de estado global de um dos dois lados.
//
// `checar_esm.mjs` só resolve imports (prova que o grafo de módulos
// carrega) -- um `import { char } from './sheet/estado.js'` dentro de
// itens-seletor.js passaria com 0 falhas nesse checador e quebraria só o
// criador, em runtime (sheet/estado.js não existe fora do contexto da
// ficha). Nada na suíte afirmava essa regra antes deste teste.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { RAIZ } from './harness.mjs';

// Padrões de import proibidos: qualquer `from './sheet/...'`,
// `from './creator/...'` ou `from './store.js'` relativo, nos dois módulos
// puros do seletor. Regex ancorada em `from '` (não em `import`) para
// também pegar um eventual `export ... from` de reexport.
const PADROES_PROIBIDOS = [
  { nome: "from './sheet/", regex: /from\s+['"]\.\/sheet\// },
  { nome: "from './creator/", regex: /from\s+['"]\.\/creator\// },
  { nome: "from './store.js'", regex: /from\s+['"]\.\/store\.js['"]/ },
];

const ARQUIVOS = [
  'site/js/itens-seletor.js',
  'site/js/regras-equipamento.js',
];

for (const arquivoRel of ARQUIVOS) {
  const texto = readFileSync(resolve(RAIZ, arquivoRel), 'utf-8');
  for (const { nome, regex } of PADROES_PROIBIDOS) {
    test(`regra de dependência: ${arquivoRel} não importa ${nome}`, () => {
      assert.equal(
        regex.test(texto),
        false,
        `${arquivoRel} contém um import proibido (${nome}) -- reintroduziria o ` +
        'acoplamento entre criador e ficha que a extração de itens-seletor.js ' +
        'desfez (ver docs/superpowers/specs/2026-08-13-seletor-itens-unificado-design.md)',
      );
    });
  }
}
