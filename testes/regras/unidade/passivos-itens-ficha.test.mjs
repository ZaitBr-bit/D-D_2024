// ============================================================
// Plano 8, Task 3 (achados menores do Plano 6) nas funções da ficha que
// dependem do personagem em estado.js: Deslocamento (getDeslocamentoFinal),
// título da Vantagem na Iniciativa (getModIniciativa), imunidades da seção
// Condições e sentidos do cartão do PDF.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { modulosApp, personagemMulticlasse } from './harness.mjs';

await modulosApp();
const combate = await import('../../../site/js/sheet/combate.js');
const condicoes = await import('../../../site/js/sheet/condicoes.js');
const pdf = await import('../../../site/js/sheet/pdf.js');

/** Item mágico equipado e sintonizado com os efeitos dados. */
function item(nome, efeitos) {
  return { nome, tipo: 'magico', equipado: true, sintonizado: true, dados: { magico_id: nome.toLowerCase(), requer_sintonizacao: true, efeitos } };
}

/** Define o personagem do estado da ficha e devolve-o. */
async function usar(roteiro, ajustar) {
  const { sheetEstado } = await modulosApp();
  const p = await personagemMulticlasse(roteiro);
  if (ajustar) ajustar(p);
  sheetEstado.definirChar(p);
  return p;
}

const MANTO_ARRAIA = () => item('Manto da Arraia-Jamanta', [{ alvo: 'deslocamento', modo: 'natacao', metros: 18 }]);

test('3.1 Guardião 6 (Natação = Deslocamento) + item de Natação: um só "Natação", o maior valor', async () => {
  await usar([{ classe: 'Guardião', nivel: 6 }], (p) => { p.inventario = [MANTO_ARRAIA()]; });
  // Base 9 + 3 (Errante) = 12; o item dá 18.
  assert.equal(combate.getDeslocamentoFinal('9 metros'), '12 metros (Escalada 12m, Natação 18m)');
});

test('3.1 o valor da classe fica quando é maior que o do item', async () => {
  await usar([{ classe: 'Guardião', nivel: 6 }], (p) => { p.inventario = [item('Anel de Natação', [{ alvo: 'deslocamento', modo: 'natacao', metros: 6 }])]; });
  assert.equal(combate.getDeslocamentoFinal('9 metros'), '12 metros (Escalada 12m, Natação 12m)');
});

test('3.1 Ladino Ladrão + Escalada de item com valor diferente: um só "Escalada", o maior', async () => {
  await usar([{ classe: 'Ladino', nivel: 3, subclasse: 'Ladrão' }], (p) => {
    p.inventario = [item('Sapatilhas', [{ alvo: 'deslocamento', modo: 'escalada', metros: 15 }])];
  });
  assert.equal(combate.getDeslocamentoFinal('9 metros'), '9 metros (Escalada 15m)');
});

test('3.1 Voo igual ao Deslocamento: "(pairar)" fica quando qualquer fonte tiver', async () => {
  // Aasimar com Asas (sem pairar) + item de Voo com pairar: mesma entrada, com "(pairar)".
  await usar([{ classe: 'Guerreiro', nivel: 3 }], (p) => {
    p.especie = 'Aasimar';
    p.recursos = { ...(p.recursos || {}), aasimar_revelacao_ativa: 'asas' };
    p.inventario = [item('Anel Pairante', [{ alvo: 'deslocamento', modo: 'voo', igual_deslocamento: true, pairar: true }])];
  });
  assert.equal(combate.getDeslocamentoFinal('9 metros'), '9 metros (Voo 9m (pairar))');
  // Item sem pairar maior que o do Aasimar: vale o valor do item; sem pairar.
  await usar([{ classe: 'Guerreiro', nivel: 3 }], (p) => {
    p.especie = 'Aasimar';
    p.recursos = { ...(p.recursos || {}), aasimar_revelacao_ativa: 'asas' };
    p.inventario = [item('Botas Aladas', [{ alvo: 'deslocamento', modo: 'voo', metros: 12 }])];
  });
  assert.equal(combate.getDeslocamentoFinal('9 metros'), '9 metros (Voo 12m)');
});

test('3.1 Contido: nenhuma velocidade extra aparece, de classe ou de item', async () => {
  await usar([{ classe: 'Guardião', nivel: 6 }], (p) => { p.condicoes = ['Contido']; p.inventario = [MANTO_ARRAIA()]; });
  assert.equal(combate.getDeslocamentoFinal('9 metros'), '0 metros');
  await usar([{ classe: 'Ladino', nivel: 3, subclasse: 'Ladrão' }], (p) => { p.condicoes = ['Paralisado']; });
  assert.equal(combate.getDeslocamentoFinal('9 metros'), '0 metros');
});

test('3.5 Iniciativa: fontesVantagem lista Bárbaro 7, Campeão, Invisível e itens, sem repetir', async () => {
  await usar([{ classe: 'Bárbaro', nivel: 7 }, { classe: 'Guerreiro', nivel: 3, subclasse: 'Campeão' }], (p) => {
    p.condicoes = ['Invisível'];
    p.inventario = [item('Bastão do Alerta', [{ alvo: 'vantagem', em: 'iniciativa' }]), item('Bastão do Alerta', [{ alvo: 'vantagem', em: 'iniciativa' }])];
  });
  const ini = combate.getModIniciativa();
  assert.equal(ini.vantagem, true);
  assert.deepEqual(ini.fontesVantagem, ['Instintos Primitivos', 'Atleta Extraordinário', 'Invisível', 'Bastão do Alerta']);
});

test('3.5 Iniciativa: sem nenhuma fonte, sem Vantagem e lista vazia; só Bárbaro 7 lista só ele', async () => {
  await usar([{ classe: 'Guerreiro', nivel: 1 }]);
  assert.deepEqual(combate.getModIniciativa().fontesVantagem, []);
  assert.equal(combate.getModIniciativa().vantagem, false);
  await usar([{ classe: 'Bárbaro', nivel: 7 }]);
  assert.deepEqual(combate.getModIniciativa().fontesVantagem, ['Instintos Primitivos']);
});

const LIVRO = () => item('Livro dos Feitos Exaltados', [{ alvo: 'imunidade_condicao', condicao: 'Amedrontado' }]);

/** Quantas vezes "Imune: <condição>" aparece no HTML da seção Condições. */
function ocorrenciasImune(html, condicao) {
  return (html.match(new RegExp(`Imune: ${condicao}`, 'g')) || []).length;
}

test('3.4 Condições: Aura de Coragem e item para a mesma condição aparecem uma vez (vale a Aura)', async () => {
  await usar([{ classe: 'Paladino', nivel: 10 }], (p) => { p.inventario = [LIVRO()]; });
  const html = condicoes.renderSecaoCondicoes();
  assert.equal(ocorrenciasImune(html, 'Amedrontado'), 1);
  assert.match(html, /Imune: Amedrontado \(Aura de Coragem\)/);
  assert.doesNotMatch(html, /Livro dos Feitos Exaltados/);
});

test('3.4 Condições: Fúria Irracional e item para a mesma condição aparecem uma vez (vale a Fúria)', async () => {
  await usar([{ classe: 'Bárbaro', nivel: 6, subclasse: 'Trilha do Berserker' }], (p) => {
    p.recursos = { ...(p.recursos || {}), furia_ativa: true };
    p.inventario = [LIVRO()];
  });
  const html = condicoes.renderSecaoCondicoes();
  assert.equal(ocorrenciasImune(html, 'Amedrontado'), 1);
  assert.match(html, /Imune: Amedrontado \(Furia Irracional\)/);
  assert.doesNotMatch(html, /Livro dos Feitos Exaltados/);
});

test('3.4 Condições: sem Fúria ativa o item continua aparecendo', async () => {
  await usar([{ classe: 'Bárbaro', nivel: 6, subclasse: 'Trilha do Berserker' }], (p) => { p.inventario = [LIVRO()]; });
  assert.match(condicoes.renderSecaoCondicoes(), /Imune: Amedrontado \(Livro dos Feitos Exaltados\)/);
});

test('3.2 PDF: o cartão traz Visão no Escuro da espécie e dos itens, e os demais sentidos de item', async () => {
  const cache = { especies: [{ nome: 'Anão', tracos: [{ nome: 'Visão no Escuro', descricao: 'Você tem Visão no Escuro com alcance de 36 metros.' }] }] };
  const p = await usar([{ classe: 'Guerreiro', nivel: 1 }], (c) => { c.especie = 'Anão'; });
  assert.deepEqual(pdf.sentidosDeAlcanceParaPdf(p, cache), ['Visão no Escuro 36 m']);
  p.inventario = [
    item('Óculos da Noite', [{ alvo: 'sentido', sentido: 'visao_no_escuro', metros: 18, soma_se_tiver: 18 }]),
    item('Túnica de Olhos', [{ alvo: 'sentido', sentido: 'visao_verdadeira', metros: 36 }]),
  ];
  assert.deepEqual(pdf.sentidosDeAlcanceParaPdf(p, cache), ['Visão no Escuro 54 m', 'Visão Verdadeira 36 m']);
  // Sem espécie com Visão no Escuro e sem item: nenhum sentido de alcance.
  assert.deepEqual(pdf.sentidosDeAlcanceParaPdf({ especie: 'Humano', inventario: [] }, cache), []);
});

test('M1a Voo: fonte com pairar primeiro e sem pairar depois mantém o "(pairar)" e o maior valor', async () => {
  await usar([{ classe: 'Guerreiro', nivel: 1 }], (p) => {
    p.inventario = [
      item('Anel Pairante', [{ alvo: 'deslocamento', modo: 'voo', metros: 9, pairar: true }]),
      item('Botas Aladas', [{ alvo: 'deslocamento', modo: 'voo', metros: 12 }]),
    ];
  });
  assert.equal(combate.getDeslocamentoFinal('9 metros'), '9 metros (Voo 12m (pairar))');
});

test('M1b Condições: Aura de Devoção e item que dá imunidade a Enfeitiçado aparecem uma vez (vale a Aura)', async () => {
  await usar([{ classe: 'Paladino', nivel: 7, subclasse: 'Juramento da Devoção' }], (p) => {
    p.inventario = [item('Talismã', [{ alvo: 'imunidade_condicao', condicao: 'Enfeitiçado' }])];
  });
  const html = condicoes.renderSecaoCondicoes();
  assert.equal(ocorrenciasImune(html, 'Enfeitiçado'), 1);
  assert.match(html, /Imune: Enfeitiçado \(Aura de Devoção\)/);
  assert.doesNotMatch(html, /Talismã/);
});

test('M1c velocidade de item com metros 0, ausente ou inválido não aparece nem quebra', async () => {
  for (const metros of [0, undefined, 'abc', -3, NaN]) {
    await usar([{ classe: 'Guerreiro', nivel: 1 }], (p) => {
      p.inventario = [item('Anel Torto', [{ alvo: 'deslocamento', modo: 'natacao', ...(metros === undefined ? {} : { metros }) }])];
    });
    assert.equal(combate.getDeslocamentoFinal('9 metros'), '9 metros', String(metros));
  }
});

test('M4 modo de velocidade desconhecido é ignorado no Deslocamento, nas velocidades e nos selos', async () => {
  const { velocidadesDeItens } = await import('../../../site/js/regras-passivos-itens.js');
  const { selosDeEfeitos } = await import('../../../site/js/itens-magicos-catalogo.js');
  const torto = item('Anel Estranho', [{ alvo: 'deslocamento', modo: 'teletransporte', metros: 9 }, { alvo: 'deslocamento', modo: 'toString', metros: 9 }]);
  const p = await usar([{ classe: 'Guerreiro', nivel: 1 }], (c) => { c.inventario = [torto]; });
  assert.equal(combate.getDeslocamentoFinal('9 metros'), '9 metros');
  assert.deepEqual(velocidadesDeItens(p), []);
  assert.deepEqual(selosDeEfeitos(torto, p), []);
});
