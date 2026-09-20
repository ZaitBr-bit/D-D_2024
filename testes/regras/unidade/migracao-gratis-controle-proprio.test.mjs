// ============================================================
// Issue #76 -- migração de características que tinham bookkeeping
// DEDICADO (um botão próprio no card de Características de Classe,
// desincronizado do `gratis_usado`/adaptador que o botão "Grátis" da
// lista de Magias usa) para o mecanismo único:
//
//   - Destruição do Paladino (nível 2) -- `char.recursos.paladino.
//     destruicao_gratuita_usada`, botão "Destruição Gratuita (sem
//     espaço)". Achado em revisão: o comentário original desta issue já
//     tratava Contatar Patrono/Montaria Fiel como "seguros" só porque não
//     tinham flag `ehXxx` correspondente -- Destruição do Paladino TINHA,
//     e ninguém tinha verificado.
//   - Criaturas Espectrais (Ilusionista, nível 6) -- feerica_usada/
//     fera_usada, botões "Convocar Feérico (Grátis)"/"Invocar Fera
//     (Grátis)".
//   - Manto de Majestade (Bardo/Glamour, nível 6) -- manto_majestade_usado,
//     botão "Ativar Manto de Majestade".
//   - Mapa Estelar (Círculo das Estrelas, nível 3) -- mapa_estelar_usos_
//     gastos, botão "Conjurar Raio Guia (grátis)". Diferente dos três
//     acima (uso ÚNICO), este JÁ era um contador de verdade -- migrou para
//     o adaptador de recurso dedicado (regras-usos-gratis-magia.js), não
//     para `gratis_usado` (que não guarda contagem).
//
// Nos quatro casos o botão antigo TOASTAVA "conjurado gratuitamente" sem
// chamar aplicarConjuracaoSemEspaco (a rota real de conjuração) -- e sem
// tocar o mecanismo que o botão "Grátis" da lista de Magias lê. Um
// personagem podia clicar os DOIS botões (o da lista de Magias e o do
// painel) e "conjurar de graça" mais vezes do que o livro permite.
//
// Estes testes provam a AUSÊNCIA do botão antigo (a migração de verdade,
// não só uma exclusão) e que o card não abre um SEGUNDO controle
// (`data-toggle-uso`/`data-usar-habilidade`) desincronizado no lugar dele.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { modulosApp, personagemMulticlasse, subirAteNivel } from './harness.mjs';

async function renderizarCaracteristica(classe, nivel, nomeFeature, subclasse = '') {
  const { sheetEstado, sheetHabilidades, db } = await modulosApp();
  const p = await personagemMulticlasse([{ classe, nivel: 1, subclasse }]);
  await subirAteNivel(p, classe, nivel);
  sheetEstado.definirChar(p);
  sheetEstado.definirClassesData(new Map([[classe, await db.getClasse(classe)]]));

  // Subclasse PRIMEIRO, não como fallback: dados/classes/mago.json repete
  // "Autoimagem Ilusória" tanto no array de classe quanto no da subclasse
  // Ilusionista (mesmo nome, entradas diferentes) -- buscar na classe
  // primeiro pegaria a errada (sem o `ctx.subclasse` que a flag `ehXxx`
  // exige) sempre que houver essa duplicata, mascarando o botão dedicado
  // real. `renderSecaoCaracteristicas` (sheet/caracteristicas.js) resolve
  // essa mesma ambiguidade priorizando a subclasse; este helper replica.
  const classeData = await db.getClasse(classe);
  let feat, source;
  if (subclasse) {
    const sc = classeData.subclasses?.find((s) => s.nome === subclasse);
    feat = sc?.caracteristicas?.find((c) => c.nome === nomeFeature);
    source = 'subclasse';
  }
  if (!feat) {
    feat = classeData.caracteristicas?.find((c) => c.nome === nomeFeature);
    source = 'classe';
  }
  if (!feat) throw new Error(`Característica "${nomeFeature}" não encontrada em ${classe}/${subclasse}`);
  return sheetHabilidades.renderFeatureItem(feat, source, { classe, subclasse, nivelClasse: nivel });
}

test('Destruição do Paladino: o botão dedicado antigo foi REMOVIDO, não só desabilitado', async () => {
  const html = await renderizarCaracteristica('Paladino', 2, 'Destruição do Paladino');
  assert.ok(!html.includes('data-paladino-acao="destruicao-gratuita"'),
    'o botão "Destruição Gratuita (sem espaço)" tinha bookkeeping próprio (destruicao_gratuita_usada), ' +
    'desincronizado do gratis_usado real -- precisa estar AUSENTE do HTML, não só invisível');
  assert.ok(!html.includes('data-toggle-uso='),
    'sem o botão dedicado, o card não pode cair no toggle GENÉRICO (char.usos_habilidades) -- seria uma ' +
    'terceira fonte de verdade para o mesmo uso, mostrando "Disponível" depois de já gasto na lista de Magias');
});

test('Criaturas Espectrais (Ilusionista): os dois botões dedicados antigos foram REMOVIDOS', async () => {
  const html = await renderizarCaracteristica('Mago', 6, 'Criaturas Espectrais', 'Ilusionista');
  assert.ok(!html.includes('data-mago-subclasse-acao="espectrais_feerica"'));
  assert.ok(!html.includes('data-mago-subclasse-acao="espectrais_fera"'));
  assert.ok(!html.includes('data-toggle-uso='),
    'sem os botões dedicados, o card não pode cair no toggle genérico -- mesma razão do teste do Paladino');
});

test('Manto de Majestade (Bardo): o botão dedicado antigo foi REMOVIDO', async () => {
  const html = await renderizarCaracteristica('Bardo', 6, 'Manto de Majestade', 'Colégio do Glamour');
  assert.ok(!html.includes('data-bardo-subclasse-acao="glamour_manto_majestade"'));
  assert.ok(!html.includes('data-toggle-uso='));
});

test('Mapa Estelar (Círculo das Estrelas): o botão dedicado antigo foi REMOVIDO', async () => {
  const html = await renderizarCaracteristica('Druida', 3, 'Mapa Estelar', 'Círculo das Estrelas');
  assert.ok(!html.includes('data-druida-subclasse-acao="mapa_estelar"'));
  assert.ok(!html.includes('data-toggle-uso='));
  assert.ok(!html.includes('data-usar-habilidade='),
    'Mapa Estelar tem usos MÚLTIPLOS (mod. Sabedoria) -- sem a supressão específica de uso múltiplo, cairia ' +
    'no contador "Usar/Esgotado" genérico (data-usar-habilidade), desincronizado do recurso real');
});

// DISCRIMINADOR: Inimigo Favorito (Guardião, nível 1) é a característica
// de uso MÚLTIPLO que só tem adaptador (nunca teve botão dedicado próprio
// no card -- Marca do Caçador sempre caiu no fallback genérico). Prova que
// a supressão nova (featureTemUsoGratisPorRecursoDedicado) also cobre esse
// caminho, não só o de quem tinha bookkeeping dedicado.
test('Inimigo Favorito (Guardião): o card não cai no contador genérico de usos múltiplos', async () => {
  const html = await renderizarCaracteristica('Guardião', 1, 'Inimigo Favorito');
  assert.ok(!html.includes('data-usar-habilidade='),
    'Marca do Caçador (2 usos no nível 1) tem adaptador dedicado (regras-usos-gratis-magia.js) -- sem a ' +
    'supressão, o card mostraria "Usar/Esgotado" via char.usos_habilidades, um QUARTO estado desincronizado');
});

// DISCRIMINADOR: Autoimagem Ilusória (Ilusionista, nível 10) NÃO faz parte
// da #76 -- é uma habilidade de REAÇÃO ("o ataque erra automaticamente"),
// não uma conjuração. O botão dela é legítimo e precisa continuar
// existindo; a migração de Criaturas Espectrais não pode arrastar o
// bookkeeping de uma característica vizinha que a REVISÃO 1-linha desta
// issue não cobre.
test('Autoimagem Ilusória (vizinha de Criaturas Espectrais) continua com o botão dedicado próprio', async () => {
  const html = await renderizarCaracteristica('Mago', 10, 'Autoimagem Ilusória', 'Ilusionista');
  assert.ok(html.includes('data-mago-subclasse-acao="autoimagem_usar"'),
    'Autoimagem Ilusória não concede magia nenhuma -- não é escopo da #76, e a migração de Criaturas ' +
    'Espectrais (mesma subclasse, bloco de código vizinho) não pode ter apagado o botão dela por engano');
});

// DISCRIMINADOR simétrico: Majestade Inquebrável (Bardo/Glamour, nível 14)
// é vizinha de código de Manto de Majestade e também fora do escopo.
test('Majestade Inquebrável (vizinha de Manto de Majestade) continua com o botão dedicado próprio', async () => {
  const html = await renderizarCaracteristica('Bardo', 14, 'Majestade Inquebrável', 'Colégio do Glamour');
  assert.ok(html.includes('data-bardo-subclasse-acao="glamour_majestade_inquebravel"'),
    'Majestade Inquebrável não é escopo da #76 -- a remoção do bloco vizinho (Manto de Majestade) não ' +
    'pode ter apagado o dela por engano');
});

// DISCRIMINADOR simétrico: Presságio Cósmico (Druida/Estrelas, nível 6) é
// vizinha de código de Mapa Estelar e também fora do escopo -- ambos usam
// getEstadoRecursosDruida()/estadoDruidaSub, código compartilhado onde é
// fácil apagar demais.
test('Presságio Cósmico (vizinha de Mapa Estelar) continua com o botão dedicado próprio', async () => {
  const html = await renderizarCaracteristica('Druida', 6, 'Presságio Cósmico', 'Círculo das Estrelas');
  assert.ok(html.includes('data-druida-subclasse-acao='),
    'Presságio Cósmico não é escopo da #76 -- a remoção do bloco vizinho (Mapa Estelar) não pode ter ' +
    'apagado o botão dela por engano');
});
