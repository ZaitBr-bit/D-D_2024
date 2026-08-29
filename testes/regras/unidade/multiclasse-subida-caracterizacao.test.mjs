// ============================================================
// NÃO-REGRESSÃO DE CLASSE ÚNICA -- a restrição mais dura deste projeto.
//
// O fixture foi gerado ANTES da conversão do sub-projeto 5, com o código
// que estava em produção na versão 2.2.23. Qualquer diferença aqui é
// regressão até prova em contrário: um personagem de classe única tem de
// sair da subida de nível exatamente igual ao que o app produzia antes.
//
// Se uma diferença for MELHORIA deliberada (uma correção de regra que o
// sub-projeto 5 traz de propósito), o fixture se regenera E a mudança
// entra nas notas de versão. Regenerar sem registrar é apagar a rede.
//
// AVISO PARA A TAREFA 3b: por desenho, essa tarefa vai fazer `subirDeNivel`
// gravar em `classes[]` e deixar `sincronizarEspelhos` manter `dados_vida`,
// e vai parar de gravar `espacos_magia` diretamente -- então os campos
// `classes`, `dados_vida`, `dados_vida_total` e `espacos_magia` VÃO
// divergir nos 228 snapshots de uma vez (12 classes × 19 níveis), e isso é
// esperado: regenere o fixture e registre a mudança nas notas de versão.
// QUALQUER OUTRO CAMPO na lista de campos divergentes impressa pela falha
// abaixo é regressão de verdade, não efeito colateral esperado da 3b.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { subirAteNivel, personagemInicialDeClasse, fotoDaSubida, RAIZ } from './harness.mjs';
import { resolve } from 'node:path';

const esperado = JSON.parse(
  readFileSync(resolve(RAIZ, 'testes/regras/unidade/fixtures/subida-classe-unica.json'), 'utf-8'));

/**
 * Compara `atual` e `esp` (ambos objetos de fotoDaSubida) CAMPO A CAMPO e
 * devolve os nomes dos campos que diferem. União das chaves dos dois lados
 * -- não só `Object.keys(atual)` -- porque um campo que sumisse do
 * personagem (renomeado, por exemplo) ficaria ausente de `atual` e só
 * apareceria em `esp`; comparar só um lado esconderia exatamente esse caso.
 * Cada valor é confrontado via JSON.stringify: os campos de fotoDaSubida
 * são todos serializáveis (arrays/objetos simples), e essa é a mesma régua
 * de igualdade que o fixture já usa.
 */
function camposDivergentesDaLinha(atual, esp) {
  const campos = new Set([...Object.keys(atual), ...Object.keys(esp)]);
  return [...campos].filter(
    (campo) => JSON.stringify(atual[campo]) !== JSON.stringify(esp[campo]));
}

test('classe única: a subida de nível produz o mesmo personagem de sempre', async () => {
  const divergencias = [];
  // Conjunto agregado de TODO campo que divergiu em QUALQUER classe/nível
  // -- é isto que permite responder "quais campos mudaram, no total" sem
  // reabrir o fixture: a mensagem de falha imprime este conjunto pronto,
  // e é exatamente o que a Tarefa 3b vai precisar exibir para provar que
  // só mudou o esperado (ver AVISO no cabeçalho do arquivo).
  const camposDivergentes = new Set();
  const classes = Object.keys(esperado);
  // Falha ALTO se o fixture encolher: um laço sobre 3 classes afirmaria a
  // não-regressão das 12 sem medir 9 delas.
  assert.equal(classes.length, 12, `o fixture tem ${classes.length} classes, esperava 12`);

  for (const classe of classes) {
    const p = await personagemInicialDeClasse(classe);
    for (let n = 2; n <= 20; n++) {
      await subirAteNivel(p, classe, n);
      const atual = fotoDaSubida(p);
      const campos = camposDivergentesDaLinha(atual, esperado[classe][n]);
      if (campos.length > 0) {
        divergencias.push(`${classe} nível ${n}: ${campos.sort().join(', ')}`);
        campos.forEach((campo) => camposDivergentes.add(campo));
      }
    }
  }
  assert.deepEqual(divergencias, [],
    `classe única não pode mudar. Campos divergentes no total (todas as ` +
    `classes/níveis somados): [${[...camposDivergentes].sort().join(', ')}]. ` +
    'Se a diferença for melhoria deliberada, regenere o fixture E registre ' +
    'nas notas de versão.');
});
