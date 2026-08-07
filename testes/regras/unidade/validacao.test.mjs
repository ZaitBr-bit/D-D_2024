// ============================================================
// Confronto: para talentos com escolhas, o app aceita um conjunto
// válido (exemplo_valido curado do livro) e rejeita mutações
// inválidas dele (item removido; duplicata).
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOGO_TALENTOS } from '../catalogo/talentos.mjs';
import { modulosApp, comLacuna, charBase } from './harness.mjs';

const { regras } = await modulosApp();

// Gera mutações inválidas do exemplo válido: uma com um item a menos
// e uma com duplicata, para cada campo de lista do exemplo.
function mutacoesInvalidas(exemplo) {
  const saida = [];
  for (const [campo, valor] of Object.entries(exemplo)) {
    if (Array.isArray(valor) && valor.length > 1) {
      saida.push({ ...exemplo, [campo]: valor.slice(0, -1) });
      saida.push({ ...exemplo, [campo]: [valor[0], ...valor.slice(0, -1)] });
    }
  }
  return saida;
}

for (const [nome, e] of Object.entries(CATALOGO_TALENTOS)) {
  if (e.escolhas.length === 0) continue;
  test(`validação: ${nome} aceita o exemplo do livro`, async () => {
    await comLacuna(nome, 'validacao', async () => {
      const res = regras.validarEscolhasTalento(await charBase(), nome, e.exemplo_valido);
      assert.equal(res.valido, true, `${nome}: exemplo válido rejeitado: ${res.erro}`);
    });
  });
  const invalidas = mutacoesInvalidas(e.exemplo_valido || {});
  if (invalidas.length > 0) {
    // Chave separada de 'validacao': esta asserção e a de "aceita o exemplo"
    // acima apontam em direções opostas (uma exige aceitar, a outra exige
    // rejeitar). Se ambas usassem a mesma chave de lacuna, registrar uma
    // lacuna para talentos sem REGRAS_TALENTOS (onde validarEscolhasTalento
    // sempre devolve {valido:true}, nunca lança) quebraria a asserção
    // "aceita o exemplo", que é sempre uma passagem trivial e nunca lança —
    // ver testes/regras/lacunas-conhecidas.mjs e task-6-report.md (Achado 1).
    test(`validação: ${nome} rejeita conjuntos inválidos`, async () => {
      await comLacuna(nome, 'validacao-negativa', async () => {
        for (const escolhas of invalidas) {
          const res = regras.validarEscolhasTalento(await charBase(), nome, escolhas);
          assert.equal(res.valido, false,
            `${nome}: aceitou conjunto inválido ${JSON.stringify(escolhas)}`);
        }
      });
    });
  }
}
