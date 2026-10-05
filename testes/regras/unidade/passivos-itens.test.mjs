// ============================================================
// Passivos de itens mágicos (4C): resistências, imunidades, velocidades,
// deslocamento mínimo, sentidos e vantagens (regras-passivos-itens.js),
// e os selos de efeitos do inventário para os alvos novos.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { defesasDeItens, velocidadesDeItens, deslocamentoMinimoDeItens, sentidosDeItens, opcoesDeEscolha, vantagensDeItens } from '../../../site/js/regras-passivos-itens.js';
import { selosDeEfeitos, montarItemInventario } from '../../../site/js/itens-magicos-catalogo.js';
import { ALVOS_PASSIVOS } from '../../../site/js/regras-itens-magicos.js';
import { preencherRecursosDoAcervo } from '../../../site/js/regras-recursos-itens.js';
import { readFileSync } from 'node:fs';

/** Item mágico equipado (e sintonizado) com os efeitos dados. */
function item(nome, efeitos, extra = {}) {
  return { nome, tipo: 'magico', equipado: true, sintonizado: true, dados: { magico_id: nome.toLowerCase(), requer_sintonizacao: true, efeitos }, ...extra };
}

test('defesas: resistência, imunidade e imunidade a condição de item ativo, com origem', () => {
  const p = { inventario: [
    item('Cajado do Fogo', [{ alvo: 'resistencia', tipo_dano: 'Ígneo' }]),
    item('Livro', [{ alvo: 'imunidade_condicao', condicao: 'Amedrontado' }, { alvo: 'imunidade', tipo_dano: 'Psíquico' }]),
  ] };
  const d = defesasDeItens(p);
  assert.deepEqual(d.resistencias, [{ tipo: 'Ígneo', origem: 'Cajado do Fogo' }]);
  assert.deepEqual(d.imunidades, [{ tipo: 'Psíquico', origem: 'Livro' }]);
  assert.deepEqual(d.imunidadesCondicao, [{ condicao: 'Amedrontado', origem: 'Livro' }]);
  assert.deepEqual(d.escolhasPendentes, []);
});

test('defesas: item inativo, sem sintonização ou destruído não conta', () => {
  const ef = [{ alvo: 'resistencia', tipo_dano: 'Ígneo' }];
  for (const extra of [{ equipado: false }, { sintonizado: false }, { destruido: true }]) {
    assert.deepEqual(defesasDeItens({ inventario: [item('X', ef, extra)] }).resistencias, []);
  }
});

test('defesas: escolha pendente e feita', () => {
  const ef = [{ alvo: 'resistencia', escolha: ['Ácido', 'Gélido', 'Ígneo'] }];
  const pend = defesasDeItens({ inventario: [item('Anel de Resistência', ef)] });
  assert.deepEqual(pend.resistencias, []);
  assert.deepEqual(pend.escolhasPendentes, [{ idx: 0, origem: 'Anel de Resistência', opcoes: ['Ácido', 'Gélido', 'Ígneo'] }]);
  const feita = defesasDeItens({ inventario: [item('Anel de Resistência', ef, { escolhas: { resistencia: 'Gélido' } })] });
  assert.deepEqual(feita.resistencias, [{ tipo: 'Gélido', origem: 'Anel de Resistência' }]);
  // Escolha fora das opções é ignorada (continua pendente).
  const ruim = defesasDeItens({ inventario: [item('Anel de Resistência', ef, { escolhas: { resistencia: 'Radiante' } })] });
  assert.equal(ruim.escolhasPendentes.length, 1);
});

test('defesas: escolha de item inativo não vira pendência nem resistência', () => {
  const ef = [{ alvo: 'resistencia', escolha: ['Ácido', 'Gélido'] }];
  for (const extra of [{ equipado: false }, { sintonizado: false }, { destruido: true }]) {
    const d = defesasDeItens({ inventario: [item('Anel', ef, { ...extra, escolhas: { resistencia: 'Ácido' } })] });
    assert.deepEqual(d.resistencias, []);
    assert.deepEqual(d.escolhasPendentes, []);
  }
});

test('defesas: mesma resistência de dois itens aparece uma vez (primeira origem)', () => {
  const ef = [{ alvo: 'resistencia', tipo_dano: 'Ígneo' }];
  const d = defesasDeItens({ inventario: [item('A', ef), item('B', ef)] });
  assert.deepEqual(d.resistencias, [{ tipo: 'Ígneo', origem: 'A' }]);
});

test('velocidades: fixa, igual ao deslocamento, pairar; mínimo é o maior', () => {
  const p = { inventario: [
    item('Anel de Natação', [{ alvo: 'deslocamento', modo: 'natacao', metros: 12 }]),
    item('Asas', [{ alvo: 'deslocamento', modo: 'voo', igual_deslocamento: true, pairar: true }]),
    item('Botas', [{ alvo: 'deslocamento_minimo', metros: 9 }]),
  ] };
  assert.deepEqual(velocidadesDeItens(p), [
    { modo: 'natacao', metros: 12, origem: 'Anel de Natação' },
    { modo: 'voo', igual: true, pairar: true, origem: 'Asas' },
  ]);
  assert.equal(deslocamentoMinimoDeItens(p), 9);
  assert.equal(deslocamentoMinimoDeItens({ inventario: [] }), 0);
});

test('sentidos: Visão no Escuro sem base, com base menor, com base e soma; Visão Verdadeira', () => {
  const oculos = item('Óculos da Noite', [{ alvo: 'sentido', sentido: 'visao_no_escuro', metros: 18, soma_se_tiver: 18 }], { dados: { requer_sintonizacao: false, efeitos: [{ alvo: 'sentido', sentido: 'visao_no_escuro', metros: 18, soma_se_tiver: 18 }] } });
  assert.deepEqual(sentidosDeItens({ inventario: [oculos] }, 0), [{ sentido: 'visao_no_escuro', metros: 18, origem: 'Óculos da Noite' }]);
  assert.deepEqual(sentidosDeItens({ inventario: [oculos] }, 18), [{ sentido: 'visao_no_escuro', metros: 36, origem: 'Óculos da Noite' }]);
  const cinturao = item('Cinturão', [{ alvo: 'sentido', sentido: 'visao_no_escuro', metros: 18 }]);
  // Base maior que o item: o item não muda nada e não aparece.
  assert.deepEqual(sentidosDeItens({ inventario: [cinturao] }, 36), []);
  const tunica = item('Túnica de Olhos', [{ alvo: 'sentido', sentido: 'visao_verdadeira', metros: 36 }]);
  assert.deepEqual(sentidosDeItens({ inventario: [tunica] }, 0), [{ sentido: 'visao_verdadeira', metros: 36, origem: 'Túnica de Olhos' }]);
});

test('vantagens: perícia, Iniciativa, salvaguarda com e sem atributo/contexto; item inativo não conta', () => {
  const p = { inventario: [
    item('Botas Élficas', [{ alvo: 'vantagem', em: 'pericia', pericia: 'Furtividade' }]),
    item('Bastão do Alerta', [{ alvo: 'vantagem', em: 'pericia', pericia: 'Percepção' }, { alvo: 'vantagem', em: 'iniciativa' }]),
    item('Manto', [{ alvo: 'vantagem', em: 'salvaguarda', contexto: 'contra magias' }]),
    item('Periapto', [{ alvo: 'vantagem', em: 'salvaguarda', atributo: 'Constituição', contexto: 'para evitar Envenenado' }]),
    item('Guardado', [{ alvo: 'vantagem', em: 'pericia', pericia: 'Atletismo' }], { equipado: false }),
  ] };
  assert.deepEqual(vantagensDeItens(p), {
    pericias: [{ pericia: 'Furtividade', origem: 'Botas Élficas' }, { pericia: 'Percepção', origem: 'Bastão do Alerta' }],
    salvaguardas: [{ origem: 'Manto', contexto: 'contra magias' }, { atributo: 'Constituição', origem: 'Periapto', contexto: 'para evitar Envenenado' }],
    iniciativa: ['Bastão do Alerta'],
  });
  assert.deepEqual(vantagensDeItens({ inventario: [] }), { pericias: [], salvaguardas: [], iniciativa: [] });
});

test('opcoesDeEscolha: opções do efeito com escolha; null sem escolha', () => {
  assert.deepEqual(opcoesDeEscolha(item('A', [{ alvo: 'resistencia', escolha: ['Ácido', 'Gélido'] }])), ['Ácido', 'Gélido']);
  assert.equal(opcoesDeEscolha(item('B', [{ alvo: 'resistencia', tipo_dano: 'Ígneo' }])), null);
});

// ---- Selos de efeitos dos alvos novos ----

/** Selos do único item, com o personagem contendo só ele. */
function selos(it) {
  return selosDeEfeitos(it, { inventario: [it] });
}

test('selos: resistência fixa, pendente e escolhida; ativo e inativo', () => {
  assert.deepEqual(selos(item('A', [{ alvo: 'resistencia', tipo_dano: 'Ígneo' }])), [{ texto: 'Resist. Ígneo', ativo: true, motivo: '' }]);
  const ef = [{ alvo: 'resistencia', escolha: ['Ácido', 'Gélido'] }];
  assert.equal(selos(item('B', ef))[0].texto, 'Resist. (escolher)');
  assert.equal(selos(item('B', ef, { escolhas: { resistencia: 'Gélido' } }))[0].texto, 'Resist. Gélido');
  assert.equal(selos(item('B', ef, { escolhas: { resistencia: 'Radiante' } }))[0].texto, 'Resist. (escolher)');
  assert.deepEqual(selos(item('A', [{ alvo: 'resistencia', tipo_dano: 'Ígneo' }], { equipado: false })), [{ texto: 'Resist. Ígneo', ativo: false, motivo: 'não equipado' }]);
});

test('selos: imunidade e imunidade a condição', () => {
  assert.deepEqual(selos(item('A', [{ alvo: 'imunidade', tipo_dano: 'Psíquico' }])), [{ texto: 'Imune Psíquico', ativo: true, motivo: '' }]);
  assert.deepEqual(selos(item('A', [{ alvo: 'imunidade_condicao', condicao: 'Amedrontado' }], { sintonizado: false })), [{ texto: 'Imune: Amedrontado', ativo: false, motivo: 'requer sintonização' }]);
  // `condicao` aqui é a condição do jogo: não vira restrição de equipamento.
  assert.deepEqual(selos(item('A', [{ alvo: 'imunidade_condicao', condicao: 'Amedrontado' }])), [{ texto: 'Imune: Amedrontado', ativo: true, motivo: '' }]);
});

test('selos: deslocamento fixo, igual ao deslocamento com pairar, e mínimo', () => {
  assert.equal(selos(item('A', [{ alvo: 'deslocamento', modo: 'natacao', metros: 12 }]))[0].texto, 'Natação 12 m');
  const asas = selos(item('B', [{ alvo: 'deslocamento', modo: 'voo', igual_deslocamento: true, pairar: true }]));
  assert.deepEqual(asas, [{ texto: 'Voo = Desloc. (pairar)', ativo: true, motivo: '' }]);
  assert.deepEqual(selos(item('C', [{ alvo: 'deslocamento_minimo', metros: 9 }], { equipado: false })), [{ texto: 'Desloc. mín. 9 m', ativo: false, motivo: 'não equipado' }]);
});

test('selos: sentido', () => {
  assert.deepEqual(selos(item('A', [{ alvo: 'sentido', sentido: 'visao_verdadeira', metros: 36 }])), [{ texto: 'Visão Verdadeira 36 m', ativo: true, motivo: '' }]);
  assert.equal(selos(item('B', [{ alvo: 'sentido', sentido: 'visao_no_escuro', metros: 18 }], { destruido: true, equipado: false }))[0].ativo, false);
});

test('selos: vantagem em perícia, Iniciativa e salvaguarda; contexto leva asterisco', () => {
  const textos = (efs) => selos(item('A', efs)).map(s => s.texto);
  assert.deepEqual(textos([{ alvo: 'vantagem', em: 'pericia', pericia: 'Furtividade' }]), ['Vant. Furtividade']);
  assert.deepEqual(textos([{ alvo: 'vantagem', em: 'iniciativa' }]), ['Vant. Iniciativa']);
  assert.deepEqual(textos([{ alvo: 'vantagem', em: 'salvaguarda' }]), ['Vant. salvaguardas']);
  assert.deepEqual(textos([{ alvo: 'vantagem', em: 'salvaguarda', atributo: 'Constituição' }]), ['Vant. salv. Constituição']);
  assert.deepEqual(textos([{ alvo: 'vantagem', em: 'salvaguarda', contexto: 'contra magias' }]), ['Vant. salvaguardas*']);
  assert.deepEqual(textos([{ alvo: 'vantagem', em: 'pericia', pericia: 'Percepção', contexto: 'visão' }]), ['Vant. Percepção*']);
  assert.equal(selos(item('A', [{ alvo: 'vantagem', em: 'iniciativa' }], { equipado: false }))[0].ativo, false);
});

// ---- Plano 8, Task 3: achados menores do Plano 6 ----

/** Armadura equipada (sem efeitos), para as condições `sem_armadura`. */
const ARMADURA = { nome: 'Brunea', tipo: 'armadura', equipado: true, dados: {} };

test('3.7 defesas: escolha com `condicao` de armadura é avaliada com o personagem completo', () => {
  const ef = [{ alvo: 'resistencia', escolha: ['Ácido', 'Gélido'], condicao: 'sem_armadura' }];
  const anel = item('Anel Sem Armadura', ef, { escolhas: { resistencia: 'Gélido' } });
  // Com armadura equipada a condição falha: nem resistência nem pendência.
  const com = defesasDeItens({ inventario: [ARMADURA, anel] });
  assert.deepEqual(com.resistencias, []);
  assert.deepEqual(com.escolhasPendentes, []);
  // Sem armadura vale.
  assert.deepEqual(defesasDeItens({ inventario: [anel] }).resistencias, [{ tipo: 'Gélido', origem: 'Anel Sem Armadura' }]);
  const pend = defesasDeItens({ inventario: [item('Anel Sem Armadura', ef)] });
  assert.equal(pend.escolhasPendentes.length, 1);
});

test('3.7 defesas: a primeira origem segue a posição no inventário, escolha ou fixa', () => {
  const anel = item('Anel', [{ alvo: 'resistencia', escolha: ['Ígneo', 'Gélido'] }], { escolhas: { resistencia: 'Ígneo' } });
  const cajado = item('Cajado', [{ alvo: 'resistencia', tipo_dano: 'Ígneo' }]);
  assert.deepEqual(defesasDeItens({ inventario: [anel, cajado] }).resistencias, [{ tipo: 'Ígneo', origem: 'Anel' }]);
  assert.deepEqual(defesasDeItens({ inventario: [cajado, anel] }).resistencias, [{ tipo: 'Ígneo', origem: 'Cajado' }]);
});

test('3.9 defesas: `idx` da escolha pendente é a posição no inventário', () => {
  const ef = [{ alvo: 'resistencia', escolha: ['Ácido', 'Gélido'] }];
  const d = defesasDeItens({ inventario: [item('Cajado', [{ alvo: 'resistencia', tipo_dano: 'Ígneo' }]), item('Anel', ef)] });
  assert.deepEqual(d.escolhasPendentes, [{ idx: 1, origem: 'Anel', opcoes: ['Ácido', 'Gélido'] }]);
});

test('3.9 opcoesDeEscolha: efeito `escolha` de outro alvo não conta', () => {
  assert.equal(opcoesDeEscolha(item('A', [{ alvo: 'imunidade', escolha: ['Ácido', 'Gélido'] }])), null);
  assert.equal(opcoesDeEscolha({ nome: 'sem dados' }), null);
});

test('3.9 ALVOS_PASSIVOS inclui deslocamento_minimo e vantagem', () => {
  assert.ok(ALVOS_PASSIVOS.includes('deslocamento_minimo'));
  assert.ok(ALVOS_PASSIVOS.includes('vantagem'));
});

test('3.9 deslocamento mínimo: com dois itens vale o maior', () => {
  const p = { inventario: [
    item('Botas A', [{ alvo: 'deslocamento_minimo', metros: 9 }]),
    item('Botas B', [{ alvo: 'deslocamento_minimo', metros: 12 }]),
  ] };
  assert.equal(deslocamentoMinimoDeItens(p), 12);
});

test('3.9 sentidos: o mesmo sentido em dois itens fica com o maior alcance', () => {
  const p = { inventario: [
    item('Túnica A', [{ alvo: 'sentido', sentido: 'visao_verdadeira', metros: 9 }]),
    item('Túnica B', [{ alvo: 'sentido', sentido: 'visao_verdadeira', metros: 36 }]),
    item('Túnica C', [{ alvo: 'sentido', sentido: 'visao_verdadeira', metros: 18 }]),
  ] };
  assert.deepEqual(sentidosDeItens(p, 0), [{ sentido: 'visao_verdadeira', metros: 36, origem: 'Túnica B' }]);
});

test('3.9 vantagens: Iniciativa duplicada (mesmo item, dois efeitos ou itens de mesmo nome) aparece uma vez', () => {
  const ini = { alvo: 'vantagem', em: 'iniciativa' };
  assert.deepEqual(vantagensDeItens({ inventario: [item('Bastão', [ini, ini]), item('Bastão', [ini])] }).iniciativa, ['Bastão']);
  assert.deepEqual(vantagensDeItens({ inventario: [item('A', [ini]), item('B', [ini])] }).iniciativa, ['A', 'B']);
});

test('3.9 preenchimento do acervo: não traz efeitos de alvo antigo e não toca item sem magico_id', () => {
  const acervo = { itens: [{ id: 'anel-x', efeitos: [{ alvo: 'ca', valor: 1 }, { alvo: 'resistencia', tipo_dano: 'Ígneo' }] }] };
  const doAcervo = { nome: 'Anel X', tipo: 'magico', dados: { magico_id: 'anel-x', efeitos: [] } };
  const comum = { nome: 'Corda', tipo: 'equipamento', dados: { peso: '5 kg' } };
  const semDados = { nome: 'Pedra' };
  const p = { inventario: [doAcervo, comum, semDados] };
  const antesComum = JSON.stringify(comum);
  assert.equal(preencherRecursosDoAcervo(p, acervo), 1);
  // Só o alvo passivo entra; `ca` (alvo de versão anterior) não é acrescentado.
  assert.deepEqual(doAcervo.dados.efeitos, [{ alvo: 'resistencia', tipo_dano: 'Ígneo' }]);
  assert.equal(JSON.stringify(comum), antesComum);
  assert.deepEqual(semDados, { nome: 'Pedra' });
});

test('3.8 variante sem `efeitos` herda os do pai ao montar o item; com `efeitos` declarados usa só os dela', () => {
  const pai = { id: 'anel', nome: 'Anel', raridade: 'Varia', tipo: 'Anel', efeitos: [{ alvo: 'resistencia', tipo_dano: 'Ígneo' }],
    variantes: [{ id: 'anel-a', nome: 'Anel A', raridade: 'Rara' }, { id: 'anel-b', nome: 'Anel B', raridade: 'Rara', efeitos: [] }, { id: 'anel-c', nome: 'Anel C', raridade: 'Rara', efeitos: [{ alvo: 'ca', valor: 1 }] }] };
  const efeitos = (v) => montarItemInventario({ item: pai, variante: v }).dados.efeitos;
  assert.deepEqual(efeitos(pai.variantes[0]), [{ alvo: 'resistencia', tipo_dano: 'Ígneo' }]);
  assert.deepEqual(efeitos(pai.variantes[1]), []);
  assert.deepEqual(efeitos(pai.variantes[2]), [{ alvo: 'ca', valor: 1 }]);
  // A cópia é independente do acervo.
  efeitos(pai.variantes[0]).push({ alvo: 'x' });
  assert.equal(pai.efeitos.length, 1);
});

test('3.8 variante sem `efeitos`: montar e preencher chegam ao mesmo resultado', () => {
  const pai = { id: 'anel', nome: 'Anel', raridade: 'Varia', tipo: 'Anel', efeitos: [{ alvo: 'resistencia', tipo_dano: 'Ígneo' }], variantes: [{ id: 'anel-a', nome: 'Anel A', raridade: 'Rara' }] };
  const montado = montarItemInventario({ item: pai, variante: pai.variantes[0] });
  const antigo = { nome: 'Anel A', tipo: 'magico', dados: { magico_id: 'anel-a' } };
  preencherRecursosDoAcervo({ inventario: [antigo] }, { itens: [pai] });
  assert.deepEqual(antigo.dados.efeitos, montado.dados.efeitos);
});

test('3.8 acervo real: nenhuma variante muda de efeitos com o critério unificado', () => {
  const acervo = JSON.parse(readFileSync(new URL('../../../dados/livro-do-mestre/capitulo7/itens_magicos.json', import.meta.url), 'utf8'));
  let variantes = 0;
  for (const it of acervo.itens) {
    for (const v of it.variantes || []) {
      variantes++;
      const esperado = v.efeitos ?? it.efeitos ?? [];
      const montado = montarItemInventario({ item: it, variante: v, base: it.base ? { nome: 'Base', dano: '1d6', ca: 11, categoria: 'Leve' } : null });
      assert.deepEqual(montado.dados.efeitos, esperado, v.id);
    }
  }
  assert.ok(variantes > 100);
});

test('3.3 selo de Visão no Escuro: soma à base avisa; sem soma e base maior fica inativo', () => {
  const oculos = item('Óculos da Noite', [{ alvo: 'sentido', sentido: 'visao_no_escuro', metros: 18, soma_se_tiver: 18 }]);
  const com = (it, base) => selosDeEfeitos(it, { inventario: [it] }, { visaoNoEscuroBase: base });
  assert.deepEqual(com(oculos, 0), [{ texto: 'Visão no Escuro 18 m', ativo: true, motivo: '' }]);
  assert.deepEqual(com(oculos, 18), [{ texto: 'Visão no Escuro +18 m (soma à base)', ativo: true, motivo: '' }]);
  const cinturao = item('Cinturão dos Anões', [{ alvo: 'sentido', sentido: 'visao_no_escuro', metros: 18 }]);
  assert.deepEqual(com(cinturao, 0), [{ texto: 'Visão no Escuro 18 m', ativo: true, motivo: '' }]);
  assert.deepEqual(com(cinturao, 9), [{ texto: 'Visão no Escuro 18 m', ativo: true, motivo: '' }]);
  assert.deepEqual(com(cinturao, 18), [{ texto: 'Visão no Escuro 18 m', ativo: false, motivo: 'sem efeito: sua base já é 18 m' }]);
  assert.deepEqual(com(cinturao, 36), [{ texto: 'Visão no Escuro 18 m', ativo: false, motivo: 'sem efeito: sua base já é 36 m' }]);
  // Outros sentidos não dependem da base.
  assert.equal(com(item('Túnica', [{ alvo: 'sentido', sentido: 'visao_verdadeira', metros: 36 }]), 36)[0].ativo, true);
});
