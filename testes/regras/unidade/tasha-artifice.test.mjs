// ============================================================
// Artífice (dados/tasha/artifice): portão dos dados traduzidos.
//
// 1. Mutações sobre lotes mínimos: cada regra do verificador avermelha o
//    defeito que existe para pegar (o controle passa).
// 2. (Task 6) Os lotes reais passam no portão completo e os arquivos
//    finais estão em dia com os lotes.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { verificar, carregarLotes, carregarContexto, montar, DIR_ARTIFICE } from '../../../scripts/tasha/artifice.mjs';

/** Tabela de 20 níveis no formato do lote, coerente com o oráculo falso. */
function tabela() {
  return Array.from({ length: 20 }, (_, i) => ({
    'Nível': String(i + 1), 'Bônus de Proficiência': '+2', 'Características': '—', 'Planos Conhecidos': '—',
    'Itens Mágicos': '—', 'Truques': '2', 'Magias Preparadas': '2', '1': '2', '2': '—', '3': '—', '4': '—', '5': '—',
  }));
}

/** Contexto falso: oráculo de 20 níveis iguais, glossário mínimo e acervo com um item. */
function ctxFalso() {
  return {
    oraculo: {
      tabela_classe: Array.from({ length: 20 }, (_, i) => ({ nivel: i + 1, pb: 2, planos: null, itens: null, truques: 2, preparadas: 2, espacos: [2, null, null, null, null] })),
      magias_en: { 0: [{ nome: 'Fire Bolt' }], 1: [{ nome: 'Shield' }], 2: [], 3: [], 4: [], 5: [] },
      planos: { 2: [{ nome_en: 'Bag of Holding', sintonizacao: 'No' }], 6: [], 10: [], 14: [] },
      magias_subclasse_en: { Alchemist: { 3: ['Shield'], 5: ['Shield'], 9: ['Shield'], 13: ['Shield'], 17: ['Shield'] } },
    },
    glossario: { 'Fire Bolt': 'Raio de Fogo', Shield: 'Escudo Arcano' },
    magias: ['Raio de Fogo', 'Escudo Arcano'],
    escolas: ['Evocação', 'Abjuração', 'Invocação'],
    acervo: [{ id: 'bolsa-devoradora', nome: 'Bolsa Devoradora', requer_sintonizacao: false, variantes: [] }],
    fontes: ['tasha'],
  };
}

/** Lotes mínimos válidos; `mudar` recebe uma cópia profunda e devolve a versão mutada. */
function lotes(mudar = (l) => l) {
  const tabelaSub = '| **Nível de Artífice** | **Magias** |\n|---|---|\n' + [3, 5, 9, 13, 17].map((n) => `| ${n} | *Escudo Arcano* |`).join('\n');
  const base = [
    { lote: '00', tipo: 'classe', paginas_pdf: [10, 19], classe: {
      nome: 'Artífice', nome_en: 'Artificer', tracos_basicos: { 'Atributo Primário': 'Inteligência' },
      tabela_caracteristicas: tabela(),
      caracteristicas: [{ nivel: 1, nome: 'Conjuração', nome_en: 'Spellcasting', descricao: 'Você conhece *Raio de Fogo* a 9 metros.', pagina_pdf: 12 }],
      lista_magias: { 'Truques': [{ nome_en: 'Fire Bolt', escola: 'Evocation', especial: '' }], '1º Círculo': [{ nome_en: 'Shield', escola: 'Abjuration', especial: '' }] },
    }, planos: [{ id: 'bolsa', nivel_minimo: 2, nome_en: 'Bag of Holding', requer_sintonizacao: false, item_id: 'bolsa-devoradora' }] },
    { lote: '01', tipo: 'subclasses', paginas_pdf: [20, 21], subclasses: [{ nome: 'Alquimista', nome_en: 'Alchemist', descricao: 'Texto.', caracteristicas: [
      { nivel: 3, nome: 'Magias de Alquimista', nome_en: 'Alchemist Spells', descricao: `Você sempre tem estas magias preparadas.\n${tabelaSub}`, pagina_pdf: 20 },
    ] }] },
  ];
  return mudar(structuredClone(base));
}

/** Erros do verificador em modo parcial (sem as checagens de completude). */
function erros(mudar) {
  return verificar(lotes(mudar), ctxFalso(), { completo: false }).erros;
}

/** Erros dos planos (modo completo), ignorando os de completude que o lote mínimo não cumpre. */
function errosPlanos(mudar, mudarCtx = (c) => c) {
  return verificar(lotes(mudar), mudarCtx(ctxFalso()), { completo: true }).erros.filter((e) => /plano/.test(e));
}

test('controle: os lotes mínimos passam', () => {
  assert.deepEqual(erros(), []);
  assert.deepEqual(errosPlanos(), []);
});

const MUTACOES = [
  ['tabela diverge', (l) => { l[0].classe.tabela_caracteristicas[8]['Magias Preparadas'] = '8'; return l; }, /tabela diverge/],
  ['lista diverge do oráculo', (l) => { l[0].classe.lista_magias['1º Círculo'] = []; return l; }, /lista diverge/],
  ['unidade imperial', (l) => { l[0].classe.caracteristicas[0].descricao += ' a 30 pés.'; return l; }, /unidade imperial/],
  ['inglês residual', (l) => { l[0].classe.caracteristicas[0].descricao += ' the'; return l; }, /inglês/],
  ['itálico desconhecido', (l) => { l[0].classe.caracteristicas[0].descricao = 'Você conhece *Raio de Fogos*.'; return l; }, /itálico/],
  ['magia de subclasse errada', (l) => { l[1].subclasses[0].caracteristicas[0].descricao = l[1].subclasses[0].caracteristicas[0].descricao.replace('| 3 | *Escudo Arcano* |', '| 3 | *Escudo* |'); return l; }, /subclasse "Alquimista"/],
  ['subclasse sem tabela de magias', (l) => { l[1].subclasses[0].caracteristicas[0].nome = 'Outra Coisa'; return l; }, /Magias de/],
];
for (const [nome, mudar, re] of MUTACOES) {
  test(`mutação ${nome} avermelha`, () => {
    const e = erros(mudar);
    assert.ok(e.some((x) => re.test(x)), `nenhum erro casou ${re}: ${JSON.stringify(e)}`);
  });
}

test('mutação plano sem item avermelha', () => {
  const e = errosPlanos((l) => { l[0].planos[0].item_id = 'nao-existe'; return l; });
  assert.ok(e.some((x) => /plano sem item/.test(x)), JSON.stringify(e));
});

test('mutação sintonização diverge do PDF avermelha (só o oráculo dispara)', () => {
  // item do acervo e plano com sintonização, oráculo "No": só a comparação com o PDF diverge.
  const e = errosPlanos(
    (l) => { l[0].planos[0].requer_sintonizacao = true; return l; },
    (c) => { c.acervo[0].requer_sintonizacao = true; return c; },
  );
  assert.ok(e.some((x) => /diverge do PDF/.test(x)), JSON.stringify(e));
  assert.ok(!e.some((x) => /diverge do item/.test(x)), JSON.stringify(e));
});

test('mutação sintonização diverge do item avermelha (só o item dispara)', () => {
  // oráculo "Yes" e plano com sintonização, mas o item do acervo não exige: só a comparação com o item diverge.
  const e = errosPlanos(
    (l) => { l[0].planos[0].requer_sintonizacao = true; return l; },
    (c) => { c.oraculo.planos[2][0].sintonizacao = 'Yes'; return c; },
  );
  assert.ok(e.some((x) => /diverge do item/.test(x)), JSON.stringify(e));
  assert.ok(!e.some((x) => /diverge do PDF/.test(x)), JSON.stringify(e));
});

test('mutação magia sem entrada no glossário avermelha', () => {
  // nome presente no oráculo e na lista, ausente do glossário: só o ramo do glossário dispara.
  const ctx = ctxFalso();
  ctx.oraculo.magias_en[0] = [{ nome: 'Fire Bolts' }];
  const l = lotes((x) => { x[0].classe.lista_magias.Truques[0].nome_en = 'Fire Bolts'; return x; });
  const e = verificar(l, ctx, { completo: false }).erros;
  assert.ok(e.some((x) => /sem entrada no glossário/.test(x)), JSON.stringify(e));
  assert.ok(!e.some((x) => /lista diverge/.test(x)), JSON.stringify(e));
});

test('mutação contagem de planos avermelha', () => {
  const e = errosPlanos((l) => { l[0].planos.push({ ...l[0].planos[0], id: 'outro' }); return l; });
  assert.ok(e.some((x) => /planos nível 2\+: 2, PDF tem 1/.test(x)), JSON.stringify(e));
});

test('itálico com vírgula: "A, B" válido passa; nome inexistente falha', () => {
  const com = (texto) => {
    const l = lotes((x) => { x[1].subclasses[0].caracteristicas[0].descricao += `\n\n${texto}`; return x; });
    return verificar(l, ctxFalso(), { completo: false }).erros;
  };
  assert.ok(!com('Extra: *Escudo Arcano, Raio de Fogo*.').some((x) => /itálico/.test(x)));
  assert.ok(com('Extra: *Escudo Arcano, Xyz*.').some((x) => /itálico "\*Xyz\*"/.test(x)));
});

test('mutação unidade imperial em circulo_superior da magia avermelha', () => {
  const e = erros((l) => {
    l.push({ lote: '03', tipo: 'subclasses', subclasses: [], magias: [{ nome: 'Magia Teste', nome_en: 'Test', circulo: 2, escola: 'Conjuração', tempo_conjuracao: 'Ação', alcance: '3 metros', componentes: 'V', duracao: 'Instantânea', descricao: 'Texto.', circulo_superior: 'Usando um Espaço de Magia de Círculo Superior. Alcance de 30 pés.' }] });
    return l;
  });
  assert.ok(e.some((x) => /Magia Teste/.test(x) && /unidade imperial/.test(x)), JSON.stringify(e));
});

test('lotes reais passam no portão completo', () => {
  const r = verificar(carregarLotes(), carregarContexto());
  assert.deepEqual(r.erros, []);
});

test('arquivos finais estão em dia com os lotes', () => {
  const montado = montar(carregarLotes(), carregarContexto());
  for (const [nome, conteudo] of Object.entries(montado)) {
    const disco = JSON.parse(fs.readFileSync(path.join(DIR_ARTIFICE, `${nome}.json`), 'utf-8'));
    assert.deepEqual(disco, JSON.parse(JSON.stringify(conteudo)), `${nome}.json desatualizado: rode node scripts/tasha/artifice.mjs montar`);
  }
});

test('dados reais: 5 subclasses com fonte, 80 magias, 56 planos, 9 itens, 3 criaturas', () => {
  const m = montar(carregarLotes(), carregarContexto());
  assert.equal(m.classe.fonte, 'tasha');
  assert.deepEqual(m.classe.subclasses.map((s) => s.nome).sort(), ['Alquimista', 'Armeiro', 'Artilheiro', 'Cartógrafo', 'Ferreiro de Batalha']);
  assert.ok(m.classe.subclasses.every((s) => s.fonte === 'tasha'));
  assert.equal(Object.values(m.magias_classe.lista_magias).flat().length, 80);
  assert.equal(m.planos.planos.length, 56);
  assert.equal(m.itens_magicos.itens.length, 9);
  assert.equal(m.criaturas.criaturas.length, 3);
});

test('escola Conjuration vira Invocação e "especial" ganha espaço após a vírgula', () => {
  const m = montar(lotes((l) => {
    l[0].classe.lista_magias['1º Círculo'] = [{ nome_en: 'Shield', escola: 'Conjuration', especial: 'C,R' }];
    return l;
  }), ctxFalso());
  assert.deepEqual(m.magias_classe.lista_magias['1º Círculo'], [{ nome: 'Escudo Arcano', escola: 'Invocação', especial: 'C, R' }]);
});

test('escola fora do catálogo do site: lista da classe e magia nova avermelham', () => {
  const e1 = erros((l) => { l[0].classe.lista_magias['1º Círculo'][0].escola = 'Conjuration-X'; return l; });
  assert.ok(e1.some((x) => /escola/.test(x) && /catálogo/.test(x)), JSON.stringify(e1));
  const e2 = erros((l) => {
    l.push({ lote: '03', tipo: 'subclasses', subclasses: [], magias: [{ nome: 'Magia Teste', nome_en: 'Test', circulo: 2, escola: 'Conjuração', tempo_conjuracao: 'Ação', alcance: '3 metros', componentes: 'V', duracao: 'Instantânea', descricao: 'Texto.' }] });
    return l;
  });
  assert.ok(e2.some((x) => /Magia Teste/.test(x) && /escola/.test(x)), JSON.stringify(e2));
});

test('plano genérico exige nome em PT-BR', () => {
  const e = errosPlanos((l) => {
    l[0].planos.push({ id: 'comum', nivel_minimo: 2, nome_en: 'Common magic item', requer_sintonizacao: null, generico: { raridades: ['Comum'], excluir_amaldicoados: true } });
    return l;
  });
  assert.ok(e.some((x) => /genérico sem nome/.test(x)), JSON.stringify(e));
});
