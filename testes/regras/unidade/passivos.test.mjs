// ============================================================
// Confronto: efeitos passivos numéricos e flags que o LIVRO
// declara devem sair de resolverPassivosTalentos().
// 'proficiencia' no catálogo significa "igual ao bônus de
// proficiência do personagem" (nível 4 → +2).
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOGO_TALENTOS } from '../catalogo/talentos.mjs';
import { modulosApp, comLacuna, charBase } from './harness.mjs';

const { efeitos } = await modulosApp();
const BONUS_PROFICIENCIA_NIVEL_4 = 2;

for (const [nome, e] of Object.entries(CATALOGO_TALENTOS)) {
  if (!e.passivos && !(e.flags?.length)) continue;
  test(`passivos: ${nome}`, async () => {
    await comLacuna(nome, 'passivos', async () => {
      const char = await charBase();
      char.talentos = [nome];
      const p = efeitos.resolverPassivosTalentos(char);
      for (const [chave, esperado] of Object.entries(e.passivos || {})) {
        const alvo = esperado === 'proficiencia' ? BONUS_PROFICIENCIA_NIVEL_4 : esperado;
        assert.deepEqual(p[chave], alvo, `${nome}: ${chave} deveria ser ${alvo}`);
      }
      for (const flag of e.flags || []) {
        assert.equal(p.flags[flag], true, `${nome}: flag ${flag} ausente`);
      }
    });
  });
}
