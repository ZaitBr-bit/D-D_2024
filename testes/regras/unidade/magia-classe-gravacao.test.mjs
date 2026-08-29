// ============================================================
// Tarefa 2 do sub-projeto 2026-08-29-magia-sabe-a-classe: os GRAVADORES
// carimbam `classe` em magias_preparadas[] na hora da gravacao (nao a
// migracao/deducao da Tarefa 1 -- ver regras-magia-classe.js, que este
// arquivo nao usa).
//
// COBERTURA REAL vs. DECLARADA NO BRIEF (achado desta tarefa, documentado
// no relatorio): dos quatro oraculos que o brief pede, so dois sao
// alcancaveis pelo motor puro (subirAteNivel/subirDeNivel), nao quatro.
//
//   - Oraculo "origem isenta continua sem o campo" (levelup.js): TESTADO
//     abaixo -- os cinco `magias_preparadas.push` de levelup.js (dominio,
//     sempre, especie_legado, conjurador_ritualista x2) rodam dentro do
//     motor de subirDeNivel, sem DOM.
//   - Oraculo "nenhuma entrada com classe vazia" (varredura geral):
//     TESTADO abaixo, sobre um personagem construido so pelo motor.
//   - Oraculo "a subida de nivel carimba" (sitios 3 e 4, ctx.classeQueSobe)
//     e "multiclasse carimba a classe CERTA": os DOIS vivem dentro de
//     `confirmarLevelUp` (site/js/levelup-ui.js), a funcao exportada que
//     processa `state.magiasSelecionadas`/`state.trocasMagia` ANTES de
//     chamar subirDeNivel. `subirAteNivel` (harness.mjs) NAO passa por ali
//     -- ele chama `levelup.subirDeNivel` direto (harness.mjs:1089), o
//     mesmo motor que este arquivo usa abaixo. Confirmado por leitura de
//     levelup.js inteiro: o motor NUNCA oferece uma pendencia para o
//     jogador ESCOLHER uma magia preparada/conhecida nova (o crescimento
//     de espacos e automatico; a ESCOLHA de quais preparar e uma
//     conveniencia so da tela, nunca obrigatoria pelo motor) -- por isso
//     nao ha "escolha canonica" que a escada possa responder para chegar
//     la. `confirmarLevelUp` tambem nao esta na lista de modulos de
//     harness.mjs (modulosApp() nunca importa levelup-ui.js), e nenhum
//     teste de unidade existente no repositorio a chama. Alcanca-la exigiria
//     reconstruir um `ctx`/`state` que satisfaça `validateAll`
//     (levelup-validations.js) inteiro -- HP, ASI, subclasse, expertises,
//     manobras, etc. -- essencialmente reimplementando a maquina da tela,
//     o mesmo trabalho que a Tarefa 4 (e2e via Playwright, guiando a UI de
//     verdade) ja existe para fazer. Os sitios 3 e 4 (levelup-ui.js:2044 e
//     :2066) ficam, portanto, sem prova de unidade -- ver task-2-report.md.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { modulosApp, personagemMulticlasse, escadaDeNivel, RAIZ } from './harness.mjs';

// Duas magias de Mago sem relacao com o Conjurador Ritualista, so para
// satisfazer a pendencia de Grimorio que toda subida de Mago exige
// (levelup.js, exigeGrimorioMago) -- mesmo pool usado por
// conjurador-ritualista-crescimento.test.mjs.
const GRIMORIO_NIVEL_5 = ['Armadura Arcana', 'Escudo Arcano'];

test('origem isenta (conjurador_ritualista, levelup.js) nao recebe o campo classe', async () => {
  const { levelup } = await modulosApp();
  const p = await personagemMulticlasse([{ classe: 'Mago', nivel: 4 }]);
  p.talentos = ['Conjurador Ritualista'];
  p.magias_preparadas = [
    { nome: 'Alarme', circulo: 1, origem: 'conjurador_ritualista' },
    { nome: 'Identificar', circulo: 1, origem: 'conjurador_ritualista' },
  ];
  const r = await levelup.subirDeNivel(p, {
    classe: 'Mago', ignorar_xp: true,
    rituais_bonus_proficiencia: ['Detectar Magia'],
    grimorio_selecionados: GRIMORIO_NIVEL_5,
  });
  assert.equal(r.sucesso, true, r.mensagem);
  const nova = p.magias_preparadas.find((m) => m.nome === 'Detectar Magia');
  assert.ok(nova, 'a magia nova (levelup.js:2203) tem de ter sido gravada');
  assert.equal(nova.origem, 'conjurador_ritualista');
  assert.ok(!('classe' in nova),
    'magiaContaNoLimite(origem)=false (ORIGENS_MAGIA_ISENTA, regras-origens-magia.js) ' +
    '-- esta entrada nao gasta vaga de nenhuma classe, entao nunca ganha carimbo');
});

// Varredura geral: nenhuma entrada de magias_preparadas produzida pelo motor
// (so os 5 pushes isentos de levelup.js estao no caminho de escadaDeNivel)
// pode ter a CHAVE `classe` presente com valor vazio/nulo -- o contrato e
// "ausente OU string nao-vazia", nunca uma terceira forma. Clerigo sobe a
// escada inteira e ganha magias de dominio (origem 'dominio', levelup.js:1926)
// em varios niveis, o que da massa suficiente para a varredura.
test('nenhuma entrada de magias_preparadas tem classe com valor vazio (motor puro)', async () => {
  const p = await escadaDeNivel('Clérigo', async () => {});
  const preparadas = p.magias_preparadas || [];
  assert.ok(preparadas.length > 0,
    'fixture: a escada do Clerigo tem de gerar magias de dominio em algum nivel');
  for (const m of preparadas) {
    if (Object.prototype.hasOwnProperty.call(m, 'classe')) {
      assert.ok(typeof m.classe === 'string' && m.classe.length > 0,
        `entrada "${m.nome}" (origem ${m.origem}) tem a chave classe presente mas ` +
        `vazia/invalida: ${JSON.stringify(m)} -- ausente ou string nao-vazia, nunca outra coisa`);
    }
  }
});

// ============================================================
// Guarda textual dos sitios 3 e 4 (site/js/levelup-ui.js, confirmarLevelUp).
//
// Os dois oraculos comportamentais mais importantes do brief -- "a subida
// de nivel carimba" e "o multiclasse carimba a classe CERTA" -- nao sao
// alcancaveis pelo motor puro (ver o comentario no topo deste arquivo): os
// dois `magias_preparadas.push` dos sitios 3 e 4 vivem dentro de
// `confirmarLevelUp`, que comeca chamando `validateAll`/`toast` e termina
// chamando `renderFichaFn`/`window.fecharModalTodos` -- funcoes de UI que
// `subirAteNivel`/`escadaDeNivel` (o motor que este arquivo usa acima) nunca
// alcancam. A prova comportamental desses dois sitios fica com a Tarefa 4
// (e2e via Playwright). Mas o risco que eles protegem -- alguem trocar
// `ctx.classeQueSobe` pelo espelho `char.classe` (ou `ctx.char.classe`), que
// carimbaria a classe ERRADA num personagem multiclasse -- nao pode ficar
// sem rede nenhuma ate la. A guarda abaixo le o codigo-fonte de
// `confirmarLevelUp` e prova TEXTUALMENTE que os dois pushes usam
// `ctx.classeQueSobe`, nunca o espelho. Padrao ja usado neste repositorio
// para este tipo de rede: classes-passivas.test.mjs:1048
// (aplicaBonusTruqueTaumaturgo), inclusive a origem de RAIZ (export de
// harness.mjs).
// ============================================================

// Remove comentarios de bloco e de linha de um trecho de codigo-fonte, para
// que as regex abaixo nao confundam texto de COMENTARIO ("nunca o espelho
// char.classe") com uso real do espelho no codigo. Copia local do mesmo
// utilitario de classes-passivas.test.mjs:879 -- nao ha versao exportada de
// harness.mjs para reaproveitar.
function removerComentarios(codigo) {
  return codigo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

/**
 * Extrai o corpo de `confirmarLevelUp` (site/js/levelup-ui.js), sem
 * comentarios, para a guarda textual dos sitios 3 e 4.
 *
 * `confirmarLevelUp` e a ULTIMA funcao exportada do arquivo -- confirmado
 * por `grep -n "^export "`, que nao acha nenhum `export` depois da linha em
 * que ela comeca -- entao o delimitador de fim usado aqui e o proximo
 * `function montarResumoFinal(` de nivel superior, e nao outro `export `
 * como o brief original sugeria (verificado e ajustado; ver relatorio).
 * Restringir a busca a este trecho, em vez do arquivo inteiro (2000+
 * linhas), evita falso-negativo: `char.classe` aparece em outros lugares
 * legitimos de levelup-ui.js, fora de `confirmarLevelUp`.
 */
function extrairCorpoConfirmarLevelUp() {
  const caminho = resolve(RAIZ, 'site/js/levelup-ui.js');
  const src = readFileSync(caminho, 'utf-8');
  const inicio = src.indexOf('export async function confirmarLevelUp');
  assert.ok(inicio !== -1,
    'sanity: nao achei "export async function confirmarLevelUp" em levelup-ui.js -- ' +
    'a funcao foi renomeada ou removida, e esta guarda precisa ser revista');
  const fim = src.indexOf('\nfunction montarResumoFinal(', inicio);
  assert.ok(fim !== -1,
    'sanity: nao achei o delimitador de fim "function montarResumoFinal(" apos ' +
    'confirmarLevelUp -- o arquivo mudou de forma e o recorte precisa ser ajustado');
  return removerComentarios(src.slice(inicio, fim));
}

test('guarda textual: confirmarLevelUp (levelup-ui.js) carimba magias_preparadas com ctx.classeQueSobe, nunca o espelho char.classe', () => {
  const corpo = extrairCorpoConfirmarLevelUp();

  // Sitios 3 e 4 do brief: os dois `char.magias_preparadas.push(...)` dentro
  // de confirmarLevelUp (a magia nova escolhida, e a magia que entra numa
  // troca). Ambos sao statements de uma linha so no codigo atual.
  const pushes = corpo.match(/char\.magias_preparadas\.push\(\{[^;]*\}\);/g) || [];
  assert.equal(pushes.length, 2,
    `esperava exatamente 2 chamadas a "char.magias_preparadas.push" dentro do corpo de ` +
    `confirmarLevelUp (sitios 3 e 4 do brief da Tarefa 2); encontrei ${pushes.length}. Se o ` +
    `numero mudou, o codigo-fonte de confirmarLevelUp mudou de forma e esta guarda precisa ` +
    `ser revista antes de confiar nela de novo.`);

  pushes.forEach((push, i) => {
    // 1) os dois tem de carregar classe: ctx.classeQueSobe.
    assert.ok(/classe:\s*ctx\.classeQueSobe/.test(push),
      `sitio ${i + 1} de confirmarLevelUp nao carimba "classe: ctx.classeQueSobe" ` +
      `(push encontrado: ${push}). Se isto falhar, alguem trocou a classe que esta ` +
      `subindo pela forma que o carimbo deveria usar -- sem ela, a magia nova entra ` +
      `em magias_preparadas sem saber de qual classe e, e o contador por classe volta ` +
      `a mentir.`);

    // 2) nenhum dos dois pode usar o espelho char.classe/ctx.char.classe como
    // fonte da classe. "char.classe" e substring tanto de "char.classe" quanto
    // de "ctx.char.classe", entao uma unica checagem cobre as duas formas.
    assert.ok(!push.includes('char.classe'),
      `sitio ${i + 1} de confirmarLevelUp usa o espelho char.classe (ou ctx.char.classe) ` +
      `como fonte da classe (push encontrado: ${push}). Isto e a armadilha que os ` +
      `comentarios do sitio avisam: char.classe e a classe INICIAL do personagem e nao ` +
      `muda quando ele multiclassa -- um Clerigo 5 que sobe um nivel de Mago e aprende ` +
      `uma magia nova carimbaria "Clerigo" (errado) em vez de "Mago" (certo).`);
  });
});
