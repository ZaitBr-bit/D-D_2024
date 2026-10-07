// ============================================================
// Issue #78 -- a magia personalizada escolhida para Maestria de
// Magias/Assinatura Mágica não mostrava descrição ao clicar "ver
// detalhes". Quando ela "ocupa vaga" de verdade (grimorio.js grava só
// {nome, circulo} em char.grimorio, sem `descricao`), a lista de
// candidatas de abrirEscolhaMagiasFixasMago (site/js/sheet/grimorio.js)
// usava essa entrada crua do grimório em vez da personalizada completa
// (char.magias_customizadas, que TEM `descricao`) -- deMagias
// (opcoes-dominio.js) só usa `m.descricao` quando presente; sem ela, cai
// no carregador do acervo REAL, que não conhece a magia inventada e
// devolve "Não foi possível carregar os detalhes."
//
// DOM falso: mesmo padrão de maestria-assinatura-personalizada.test.mjs
// (elementoFalso/instalarDocumentoFalso, copiados aqui -- funções
// locais, não exportadas por aquele arquivo).
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { modulosApp } from './harness.mjs';

const { sheetGrimorio, sheetEstado } = await modulosApp();

function elementoFalso(id) {
  const filhos = new Map();
  const el = {
    id, style: {}, innerHTML: '', textContent: '', scrollTop: 0,
    className: '', dataset: {}, handlers: {}, value: '',
    addEventListener(evento, fn) { (el.handlers[evento] ||= []).push(fn); },
    removeAttribute() {}, setAttribute() {}, appendChild() {}, remove() {},
    closest: () => null,
    querySelector(sel) {
      if (!filhos.has(sel)) filhos.set(sel, elementoFalso(sel));
      return filhos.get(sel);
    },
    querySelectorAll: () => [],
    classList: { add() {}, remove() {}, toggle() {} },
  };
  return el;
}

function instalarDocumentoFalso() {
  const registro = new Map();
  // abrirModal (utils.js) cria o sub-modal com `document.createElement`, sem
  // id nem getElementById -- diferente dos demais elementos deste stub, que
  // só existem via getElementById. `criados` guarda cada elemento na ordem de
  // criação, para o teste achar "o último <div> criado" (o sub-modal).
  const criados = [];
  const docOriginal = globalThis.document;
  globalThis.document = {
    getElementById(id) {
      if (!registro.has(id)) registro.set(id, elementoFalso(id));
      return registro.get(id);
    },
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: (tag) => {
      const el = elementoFalso(tag);
      criados.push(el);
      return el;
    },
    body: { appendChild() {} },
  };
  return {
    registro, criados,
    restaurar() { globalThis.document = docOriginal; },
  };
}

// Mago 18: mesmo cenario do teste da #49, com a personalizada TAMBEM
// gravada em char.grimorio (o que "ocupa vaga" grava de verdade -- issue
// #78 só se manifesta nesse caso; a personalizada que NUNCA ocupou vaga
// já tinha `descricao` disponível direto de magias_customizadas).
function mago18ComOcupaVaga() {
  return {
    nome: 'Elminster', especie: 'Humano', classe: 'Mago', subclasse: 'Evocação',
    nivel: 18, xp: 300000,
    atributos: { forca: 8, destreza: 12, constituicao: 14, inteligencia: 20, sabedoria: 12, carisma: 10 },
    classes: [{ classe: 'Mago', subclasse: 'Evocação', nivel: 18, ordem: 0 }],
    grimorio: [{ nome: 'Chama Azul', circulo: 1 }],
    magias_customizadas: [
      { nome: 'Chama Azul', circulo: 1, escola: 'Evocação', tempo_conjuracao: 'Ação', alcance: '18 metros', componentes: 'V, S', duracao: 'Instantânea', descricao: 'Dano de fogo azulado.', dano: '3d6 fogo', ritual: false, sempre_preparada: false },
    ],
    schema_versao: 2,
  };
}

test('personalizada que ocupa vaga no grimório mostra a descrição de verdade ao clicar no card (fora do círculo)', async () => {
  sheetEstado.definirChar(mago18ComOcupaVaga());
  const { registro, criados, restaurar } = instalarDocumentoFalso();
  try {
    await sheetGrimorio.abrirEscolhaMagiasFixasMago('maestria_magias');

    const elVaga = registro.get('magia-fixa-c1');
    const handlerClique = elVaga.handlers.click[0];
    assert.ok(handlerClique, 'a vaga de 1o circulo precisa ter o handler de clique de montarSeletor');

    // Simula o clique no corpo do card "Chama Azul" (fora do círculo de seleção): o
    // handler acha a opção por `ev.target.closest('[data-opcao]').dataset.opcao`.
    handlerClique({ target: { closest: (sel) => sel === '[data-opcao]' ? { dataset: { opcao: 'Chama Azul' } } : null } });

    // Com detalhe pronto (string), abrirDetalheOpcao chama abrirModal
    // SINCRONAMENTE -- sem "Carregando...", sem await. Como já havia um
    // modal aberto (o de Maestria de Magias), este vira sub-modal, e o
    // corpo entra direto no innerHTML criado por abrirModal (utils.js).
    const subModal = criados[criados.length - 1];
    assert.ok(subModal, 'o clique no card deveria ter aberto um sub-modal (document.createElement("div"))');
    assert.ok(subModal.innerHTML.includes('Dano de fogo azulado.'),
      'o sub-modal deveria mostrar a descrição real da personalizada, não "Carregando..." nem o aviso de falha');
    assert.ok(!subModal.innerHTML.includes('Não foi possível carregar'),
      'não deveria cair no aviso de falha do carregador do acervo real');
  } finally {
    restaurar();
  }
});
