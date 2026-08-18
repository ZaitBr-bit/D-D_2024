// ============================================================
// Direitos de troca das 12 classes base (TROCAS, catalogo/classes-trocas.mjs):
// confronta cada cláusula do livro que concede ao jogador o direito de
// SUBSTITUIR uma escolha anterior contra o app, em duas frentes:
//   1) existência de mecanismo -- só para as entradas que o motor de
//      unidade consegue observar (observavelEmUnidade: true), por
//      varredura textual do código-fonte (site/js/levelup.js e
//      site/js/levelup-validations.js).
//   2) efeito comportamental -- chamando subirDeNivel de verdade com o
//      par <campo>_trocar_de/<campo>_trocar_para preenchido e conferindo
//      que o valor gravado no personagem realmente mudou (corrigido em
//      2026-08-08 -- ver comentário do Step 2 abaixo para o porquê da
//      versão anterior, baseada em pendência, estar medindo a coisa
//      errada).
// Mais a higiene da própria lista: toda entrada NÃO observável precisa
// dizer POR QUE (Step 3), senão `observavelEmUnidade: false` vira um
// jeito silencioso de pular teste sem justificar.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TROCAS } from '../catalogo/classes-trocas.mjs';
import { RAIZ, comLacuna, personagemSemente, modulosApp } from './harness.mjs';

// ------------------------------------------------------------
// Step 3: higiene dos não observáveis. 25 das 26 entradas têm
// `observavelEmUnidade: false` porque o app aplica a troca por um
// caminho que `subirDeNivel` nunca vê (mutação direta de `char` em
// levelup-ui.js:1392-1411, modal da ficha, ou Descanso Longo) -- ver
// cabeçalho do catálogo. Sem exigir `motivoSeNaoObservavel` preenchido,
// qualquer entrada futura poderia marcar `false` sem justificar, e a
// lista viraria um escape silencioso para não testar nada.
// ------------------------------------------------------------
test('trocas não observáveis em unidade: todas com motivoSeNaoObservavel preenchido', () => {
  const semMotivo = TROCAS
    .filter((t) => t.observavelEmUnidade === false)
    .filter((t) => !t.motivoSeNaoObservavel?.trim())
    .map((t) => `${t.classe}/${t.oQueTroca}`);
  assert.deepEqual(semMotivo, [],
    `entrada(s) não observável(is) sem motivo escrito: ${semMotivo.join(', ')}`);
});

// Reforço simétrico: uma entrada marcada OBSERVÁVEL não deveria carregar
// um `motivoSeNaoObservavel` (o campo existe só para justificar a
// AUSÊNCIA de teste comportamental) -- protege contra um catálogo que
// preencha os dois campos ao mesmo tempo, o que seria contraditório.
test('trocas observáveis em unidade: nenhuma carrega motivoSeNaoObservavel', () => {
  const comMotivoIndevido = TROCAS
    .filter((t) => t.observavelEmUnidade === true)
    .filter((t) => t.motivoSeNaoObservavel !== null)
    .map((t) => `${t.classe}/${t.oQueTroca}`);
  assert.deepEqual(comMotivoIndevido, [],
    `entrada(s) observável(is) com motivoSeNaoObservavel preenchido (deveria ser null): ` +
    `${comMotivoIndevido.join(', ')}`);
});

// Achado I4 da revisão final: sem uma guarda de TAMANHO, o catálogo poderia
// encolher (ex.: um `find`/`filter` acidental na hora de editar
// classes-trocas.mjs, ou até virar o único `observavelEmUnidade: true` para
// `false`) sem NENHUM teste desta suíte acusar -- os laços abaixo (Step 1 e
// Step 2) são gerados a partir de `TROCAS`/`OBSERVAVEIS`, então um catálogo
// menor produz só MENOS testes, nunca um teste vermelho. É exatamente a
// forma "teste que não consegue falhar" que o projeto declara combater: os
// dois testes que sustentam a alegação do Guerreiro (estático e
// comportamental) dependem de `OBSERVAVEIS` ter pelo menos aquela entrada.
test('TROCAS tem as 26 entradas transcritas do livro, e pelo menos 1 observável em unidade', () => {
  assert.equal(TROCAS.length, 26,
    `TROCAS deveria ter 26 entradas (o catálogo encolheu ou cresceu sem essa asserção ser atualizada) -- tem ${TROCAS.length}`);
  const observaveis = TROCAS.filter((t) => t.observavelEmUnidade === true);
  assert.ok(observaveis.length >= 1,
    'nenhuma entrada de TROCAS está marcada observavelEmUnidade: true -- os laços de Step 1/Step 2 ' +
    'gerariam ZERO testes, e a alegação do Guerreiro (o bug relatado por um usuário real) ficaria sem ' +
    'cobertura nenhuma sem nenhum teste vermelho para avisar');
});

// ------------------------------------------------------------
// Step 1: existência de mecanismo, por varredura textual do código-fonte.
//
// Não existe registro central de "mecanismos de troca" no app -- cada um
// é declarativo por convenção de nome, espalhado entre levelup.js e
// levelup-validations.js. A varredura textual é deliberada, seguindo o
// precedente de completude.test.mjs ("toda chave de TESTES_VALIDOS é
// referenciada por algum motor de teste", que também confronta uma
// chave contra o conteúdo bruto de arquivos do disco em vez de um
// registro estruturado).
//
// O único padrão de troca que hoje existe de verdade no app é o da
// manobra do Mestre da Batalha: um PAR de opções `<campo>_trocar_de` /
// `<campo>_trocar_para` (opcoes.manobra_trocar_de/manobra_trocar_para,
// consumido em levelup.js:1661-1665, campo "manobra" -- singular do
// nome do array `manobras_conhecidas`). Para cada entrada observável do
// catálogo, deriva-se o nome do campo do último segmento de `campoApp`
// (ex.: 'escolhas_classe.estilo_luta' -> 'estilo_luta') e procura-se o
// mesmo par de opções por esse nome.
// ------------------------------------------------------------
const FONTE_LEVELUP = readFileSync(resolve(RAIZ, 'site/js/levelup.js'), 'utf-8');
const FONTE_VALIDATIONS = readFileSync(resolve(RAIZ, 'site/js/levelup-validations.js'), 'utf-8');
const FONTE_TROCA = `${FONTE_LEVELUP}\n${FONTE_VALIDATIONS}`;

const OBSERVAVEIS = TROCAS.filter((t) => t.observavelEmUnidade === true);

for (const entrada of OBSERVAVEIS) {
  test(`mecanismo de troca no código-fonte: ${entrada.classe}/${entrada.oQueTroca}`, async () => {
    const campo = entrada.campoApp.split('.').pop();
    const opcaoDe = `${campo}_trocar_de`;
    const opcaoPara = `${campo}_trocar_para`;
    const temMecanismo = FONTE_TROCA.includes(opcaoDe) && FONTE_TROCA.includes(opcaoPara);
    await comLacuna(entrada.classe, 'classes-trocas', () => {
      assert.ok(temMecanismo,
        `nenhum par de opções de troca ('${opcaoDe}'/'${opcaoPara}') encontrado em ` +
        `levelup.js/levelup-validations.js para o campo '${campo}' (livro: ${entrada.livro})`);
    });
  });
}

// ------------------------------------------------------------
// Step 2: efeito comportamental -- chama subirDeNivel de verdade com o
// par <campo>_trocar_de/<campo>_trocar_para preenchido e confere que o
// campo do personagem REALMENTE mudou para o novo valor.
//
// CORRIGIDO em 2026-08-08 (revisão do coordenador): a versão anterior
// exigia que subirDeNivel devolvesse `pendente: true` com um
// `tipo_pendencia` de troca em algum nível de uma escadaDeNivel completa
// (1 a 20) -- mas isso mede a coisa ERRADA. O direito do livro
// (Classes.md:3812 para o Guerreiro) é OPCIONAL: o jogador PODE trocar,
// não é obrigado a nada. O próprio padrão de referência (manobra do
// Mestre da Batalha, manobra_trocar_de/manobra_trocar_para,
// levelup.js:1661-1665) só valida/bloqueia quando o jogador preenche
// PELA METADE -- nunca emite pendência por preencher os dois lados
// corretamente. Uma troca bem-sucedida não deveria (e no app não
// deveria) gerar pendência nenhuma; exigir que gerasse estava pedindo
// para a troca ser bloqueante, o oposto do que o brief da Task 8 manda
// ("não a transforme em pendência bloqueante"). A asserção certa é mais
// forte, não mais fraca: chama subirDeNivel passando os dois campos da
// troca e confere que o valor gravado no personagem de fato mudou --
// prova que o mecanismo funciona, não só que ele é "oferecido".
//
// VALORES_TROCA_POR_CAMPO dá um par (de/para) de exemplo, no vocabulário
// que o app aceita para aquele campo -- conhecimento do LIVRO/vocabulário,
// não da implementação, por isso vive aqui e não no catálogo (mesma
// justificativa de TIPO_PENDENCIA_POR_CAMPO antes desta correção). A
// ausência de uma entrada lança erro explícito em vez de pular a
// asserção em silêncio.
// ------------------------------------------------------------
const VALORES_TROCA_POR_CAMPO = {
  // Nomes canônicos de Estilo de Luta (dados/talentos/talentos.json,
  // categoria "de Estilo de Luta", unificados na Task 7) -- dois
  // quaisquer bastam para provar a troca.
  'escolhas_classe.estilo_luta': { de: 'Defensivo', para: 'Duelismo' },
};

// Lê um campo aninhado do personagem a partir do caminho pontilhado do
// catálogo (ex.: 'escolhas_classe.estilo_luta').
function lerCampoAninhado(personagem, caminhoPontilhado) {
  return caminhoPontilhado.split('.').reduce((valor, chave) => valor?.[chave], personagem);
}

// Grava um valor num campo aninhado do personagem, criando os objetos
// intermediários que faltarem -- usado só para semear o valor ANTES da
// troca (equivalente ao que a criação do personagem concederia no
// nível 1, fluxo que personagemSemente não simula).
function gravarCampoAninhado(personagem, caminhoPontilhado, valor) {
  const partes = caminhoPontilhado.split('.');
  // Um segmento `__proto__` faria a gravacao vazar para Object.prototype e
  // contaminar TODO objeto do processo -- inclusive os personagens dos
  // outros testes, que rodam no mesmo `node --test`. Hoje os caminhos vem
  // do catalogo (escritos a mao), mas o custo de fechar e uma linha, e o
  // sintoma de nao fechar seria falha aleatoria num teste vizinho.
  const PROIBIDOS = ['__proto__', 'constructor', 'prototype'];
  if (partes.some((seg) => PROIBIDOS.includes(seg))) {
    throw new Error(`caminho invalido em gravarCampoAninhado: ${caminhoPontilhado}`);
  }
  let alvo = personagem;
  for (let i = 0; i < partes.length - 1; i++) {
    if (!alvo[partes[i]] || typeof alvo[partes[i]] !== 'object') alvo[partes[i]] = {};
    alvo = alvo[partes[i]];
  }
  alvo[partes[partes.length - 1]] = valor;
}

for (const entrada of OBSERVAVEIS) {
  test(`${entrada.classe}: subirDeNivel aplica a troca de ${entrada.oQueTroca} quando os dois lados são informados`, async () => {
    const valores = VALORES_TROCA_POR_CAMPO[entrada.campoApp];
    if (!valores) {
      throw new Error(
        `VALORES_TROCA_POR_CAMPO (classes-trocas.test.mjs) sem entrada para campoApp ` +
        `'${entrada.campoApp}' (${entrada.classe}/${entrada.oQueTroca}) -- acrescente um par ` +
        `(de/para) de exemplo válido no vocabulário do livro.`);
    }
    const campo = entrada.campoApp.split('.').pop();
    const opcaoDe = `${campo}_trocar_de`;
    const opcaoPara = `${campo}_trocar_para`;

    const { levelup } = await modulosApp();
    const personagem = await personagemSemente(entrada.classe);
    // Semeia o valor ANTES da troca -- equivalente ao que o assistente de
    // criação concede no nível 1 (personagemSemente não simula a criação).
    gravarCampoAninhado(personagem, entrada.campoApp, [valores.de]);
    personagem.xp = levelup.XP_POR_NIVEL[2];

    const resultado = await levelup.subirDeNivel(personagem, {
      [opcaoDe]: valores.de,
      [opcaoPara]: valores.para,
    });

    await comLacuna(entrada.classe, 'classes-trocas', () => {
      assert.equal(resultado.sucesso, true,
        `subirDeNivel deveria suceder com a troca preenchida (${entrada.classe} nível 2) -- ` +
        `resultado: ${JSON.stringify(resultado)}`);
      const valorFinal = lerCampoAninhado(personagem, entrada.campoApp);
      assert.ok(
        Array.isArray(valorFinal) && valorFinal.includes(valores.para) && !valorFinal.includes(valores.de),
        `${entrada.campoApp} deveria conter '${valores.para}' e não mais '${valores.de}' depois da troca ` +
        `-- livro (${entrada.livro}): "${entrada.quando}"; valor final: ${JSON.stringify(valorFinal)}`);
    });
  });
}
