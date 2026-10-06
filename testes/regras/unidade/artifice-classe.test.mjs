// ============================================================
// Artífice: CLASSES_INFO, tabela e subida 1 -> 20 confrontados com o
// catálogo transcrito do PDF (testes/regras/catalogo/artifice.mjs).
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { modulosApp, escadaDeNivel } from './harness.mjs';
import { TRACOS_ARTIFICE, PROGRESSAO_ARTIFICE, NIVEIS_ASI_ARTIFICE, SUBCLASSES_ARTIFICE } from '../catalogo/artifice.mjs';

const { utils, dadosClasses, levelup, db, multiclasseConjuracao } = await modulosApp();
const { NIVEL_SUBCLASSE } = await import(new URL('../../../site/js/creator/comum.js', import.meta.url).href);
const preparo = await import(new URL('../../../site/js/regras-preparo-magias.js', import.meta.url).href);
const info = dadosClasses.CLASSES_INFO['Artífice'];

test('CLASSES_INFO["Artífice"] × livro', () => {
  assert.equal(info.fonte, 'tasha');
  assert.equal(info.dado_vida, TRACOS_ARTIFICE.dadoVida);
  assert.equal(info.atributo_primario, TRACOS_ARTIFICE.atributoPrimario);
  assert.deepEqual([...info.salvaguardas].sort(), [...TRACOS_ARTIFICE.salvaguardas].sort());
  assert.equal(info.num_pericias, TRACOS_ARTIFICE.numPericias);
  assert.deepEqual([...info.pericias_opcoes].sort(), [...TRACOS_ARTIFICE.periciasOpcoes].sort());
  assert.deepEqual([...info.armaduras].sort(), [...TRACOS_ARTIFICE.armaduras].sort());
  assert.deepEqual(info.armas, TRACOS_ARTIFICE.armas);
  assert.equal(info.atributo_conjuracao, TRACOS_ARTIFICE.atributoConjuracao);
  assert.equal(info.categoria_conjuracao, 'meia');
});

test('tabela da classe × livro: truques, preparadas e espaços nos 20 níveis', async () => {
  const c = await db.getClasse('Artífice');
  for (const l of PROGRESSAO_ARTIFICE) {
    assert.equal(utils.getTruquesConhecidos(c.tabela_caracteristicas, l.nivel), l.truques, `truques nv${l.nivel}`);
    assert.equal(utils.getMagiaPreparadas(c.tabela_caracteristicas, l.nivel), l.preparadas, `preparadas nv${l.nivel}`);
    const esp = utils.getEspacosMagia(c.tabela_caracteristicas, l.nivel);
    const esperado = Object.fromEntries(l.espacos.map((n, i) => [i + 1, n]).filter(([, n]) => n > 0));
    assert.deepEqual(Object.fromEntries(Object.entries(esp).map(([k, v]) => [Number(k), v.total])), esperado, `espaços nv${l.nivel}`);
  }
});

test('subclasses do Artífice × livro, cada uma com fonte', async () => {
  const c = await db.getClasse('Artífice');
  assert.deepEqual(c.subclasses.map((s) => s.nome).sort(), [...SUBCLASSES_ARTIFICE].sort());
  assert.ok(c.subclasses.every((s) => s.fonte === 'tasha'));
});

test('ASI, Dádiva Épica e subclasse nos níveis do livro', () => {
  for (let n = 1; n <= 20; n++) {
    assert.equal(levelup.concedeAumentoAtributo('Artífice', n), [...NIVEIS_ASI_ARTIFICE, 19].includes(n), `ASI nv${n}`);
    assert.equal(levelup.exigeDadivaEpica('Artífice', n), n === 19, `Dádiva nv${n}`);
    assert.equal(levelup.exigeSubclasse('Artífice', n), n === 3, `subclasse nv${n}`);
  }
});

test('multiclasse: Artífice soma metade arredondada para cima', () => {
  const p = { classes: [{ classe: 'Artífice', nivel: 3, ordem: 0 }, { classe: 'Mago', nivel: 2, ordem: 1 }] };
  assert.equal(multiclasseConjuracao.nivelConjurador(p), 4);
});

// Uma escada 1 -> 20 por subclasse do livro.
for (const sub of SUBCLASSES_ARTIFICE) {
  test(`escada 1 -> 20 (${sub}) sobe sem pendência desconhecida e termina no nível 20`, async () => {
    const p = await escadaDeNivel('Artífice', async () => {}, { subclasse: sub });
    assert.equal(p.nivel, 20);
    assert.equal(p.subclasse, sub);
  });
}

test('toda chave de CLASSES_INFO está em NIVEL_SUBCLASSE', () => {
  for (const classe of Object.keys(dadosClasses.CLASSES_INFO)) {
    assert.ok(NIVEL_SUBCLASSE[classe], `NIVEL_SUBCLASSE sem ${classe}`);
  }
  assert.equal(NIVEL_SUBCLASSE['Artífice'], 3);
});

test('troca de magias e truques: Artífice troca no Descanso Longo, sem aviso de truque', () => {
  assert.equal(preparo.trocaNoDescansoLongo('Artífice'), 'uma');
  assert.equal(preparo.trocaAoAvancarNivel('Artífice'), 'todas');
  assert.equal(preparo.avisoTrocaTruqueForaDoLivro('Artífice'), '');
});

test('matriz padrão sugere Int 15, Con 14, Des 13, Sab 12, Car 10, For 8 para o Artífice', () => {
  const fonte = readFileSync(new URL('../../../site/js/creator/passo-atributos.js', import.meta.url), 'utf8');
  const m = fonte.match(/'Artífice':\s*\{([^}]*)\}/);
  assert.ok(m, 'passo-atributos.js sem entrada do Artífice');
  const idx = Object.fromEntries([...m[1].matchAll(/(\w+):\s*(\d)/g)].map((x) => [x[1], Number(x[2])]));
  const matriz = [15, 14, 13, 12, 10, 8];
  const valores = Object.fromEntries(Object.entries(idx).map(([k, i]) => [k, matriz[i]]));
  assert.deepEqual(valores, { forca: 8, destreza: 13, constituicao: 14, inteligencia: 15, sabedoria: 12, carisma: 10 });
});

// ---- Task 4: ferramentas, Reparar e entrada por multiclasse ----
const { resolve } = await import('node:path');
const { pathToFileURL } = await import('node:url');
const { RAIZ, personagemMulticlasse, subirAteNivel } = await import('./harness.mjs');
const regrasArtifice = await import(pathToFileURL(resolve(RAIZ, 'site/js/regras-artifice.js')).href);
const origens = await import(pathToFileURL(resolve(RAIZ, 'site/js/regras-origens-magia.js')).href);

test('Reparar entra como truque de característica, uma vez, sem contar no limite', () => {
  const p = { magias_conhecidas: [] };
  assert.equal(regrasArtifice.concederTruquesDeEntrada(p, 'Artífice'), true);
  assert.equal(regrasArtifice.concederTruquesDeEntrada(p, 'Artífice'), false);
  assert.deepEqual(p.magias_conhecidas, [{ nome: 'Reparar', circulo: 0, origem: 'caracteristica_classe', classe: 'Artífice' }]);
  assert.equal(origens.truqueContaNoLimite(p.magias_conhecidas[0]), false);
  assert.equal(origens.truqueEhTrocavel(p.magias_conhecidas[0]), false);
});

test('Reparar já conhecido por outra fonte não é duplicado', () => {
  const p = { magias_conhecidas: [{ nome: 'Reparar', circulo: 0, origem: 'especie' }] };
  assert.equal(regrasArtifice.concederTruquesDeEntrada(p, 'Artífice'), false);
  assert.equal(p.magias_conhecidas.length, 1);
});

test('outra classe não ganha Reparar', () => {
  const p = { magias_conhecidas: [] };
  assert.equal(regrasArtifice.concederTruquesDeEntrada(p, 'Mago'), false);
});

test('ferramentas da criação: Ladrão, Funileiro e a de artesão escolhida', () => {
  const p = { classe: 'Artífice', escolhas_classe: { ferramenta_artesao: ['Ferramentas de Ferreiro'] }, proficiencias_ferramentas: ['Ferramentas de Ladrão'] };
  regrasArtifice.aplicarFerramentasDaCriacao(p);
  assert.deepEqual(p.proficiencias_ferramentas, ['Ferramentas de Ladrão', 'Ferramentas de Funileiro', 'Ferramentas de Ferreiro']);
});

test('Reparar existe no catálogo de truques e a escolha de ferramenta do criador lista artesão', async () => {
  const truques = JSON.parse(readFileSync(resolve(RAIZ, 'dados/magias/truques.json'), 'utf8'));
  const lista = Array.isArray(truques) ? truques : (truques.magias || truques.truques || []);
  assert.ok(lista.some((m) => m.nome === 'Reparar'));
  const { CLASSES_ESCOLHAS } = await import(pathToFileURL(resolve(RAIZ, 'site/js/creator/comum.js')).href);
  const cfg = CLASSES_ESCOLHAS['Artífice'].ferramenta_artesao;
  assert.equal(cfg.maxEscolhas, 1);
  assert.ok(cfg.opcoes.some((o) => o.nome === 'Ferramentas de Ferreiro'));
});

test('multiclasse: Guerreiro entra em Artífice e ganha Reparar uma única vez', async () => {
  const p = await personagemMulticlasse([{ classe: 'Guerreiro', nivel: 5 }]);
  await subirAteNivel(p, 'Artífice', 7);
  const reparar = (p.magias_conhecidas || []).filter((m) => m.nome === 'Reparar');
  assert.equal(reparar.length, 1);
  assert.equal(reparar[0].origem, 'caracteristica_classe');
});

const sintonizacao = await import(new URL('../../../site/js/regras-sintonizacao.js', import.meta.url).href);

test('teto de sintonização: 3 padrão; Artífice 10/14/18 = 4/5/6 pelo nível NA classe', () => {
  const p = (classes) => ({ classes, inventario: [] });
  assert.equal(sintonizacao.tetoSintonizacao(p([{ classe: 'Mago', nivel: 20, ordem: 0 }])), 3);
  assert.equal(sintonizacao.tetoSintonizacao(p([{ classe: 'Artífice', nivel: 9, ordem: 0 }])), 3);
  assert.equal(sintonizacao.tetoSintonizacao(p([{ classe: 'Artífice', nivel: 10, ordem: 0 }])), 4);
  assert.equal(sintonizacao.tetoSintonizacao(p([{ classe: 'Artífice', nivel: 14, ordem: 0 }])), 5);
  assert.equal(sintonizacao.tetoSintonizacao(p([{ classe: 'Artífice', nivel: 18, ordem: 0 }])), 6);
  assert.equal(sintonizacao.tetoSintonizacao(p([{ classe: 'Artífice', nivel: 9, ordem: 0 }, { classe: 'Mago', nivel: 5, ordem: 1 }])), 3);
  assert.equal(sintonizacao.tetoSintonizacao(p([{ classe: 'Artífice', nivel: 10, ordem: 0 }, { classe: 'Mago', nivel: 5, ordem: 1 }])), 4);
  assert.equal(sintonizacao.TETO_SINTONIZACAO, 3);
});

test('podeSintonizar respeita o teto do Artífice', () => {
  const item = () => ({ dados: { requer_sintonizacao: true }, sintonizado: true });
  const p = { classes: [{ classe: 'Artífice', nivel: 10, ordem: 0 }], inventario: [item(), item(), item(), { dados: { requer_sintonizacao: true } }] };
  assert.equal(sintonizacao.podeSintonizar(p, 3), true);
  p.inventario.push(item());
  assert.equal(sintonizacao.podeSintonizar(p, 3), false);
});

// ---------- Características com estado (Funileiro, Lampejo, Armazenar Magia) ----------
const temporarios = await import(new URL('../../../site/js/regras-itens-temporarios.js', import.meta.url).href);

/** Artífice de nível n com Inteligência int, sem itens. */
function artifice(n, int = 16, extra = {}) {
  return { classes: [{ classe: 'Artífice', nivel: n, ordem: 0 }], classe: 'Artífice', nivel: n, atributos: { inteligencia: int }, inventario: [], recursos: {}, ...extra };
}

test('usos: Funileiro e Lampejo = mod. Int (mín. 1); Lampejo só a partir do 7', () => {
  assert.equal(regrasArtifice.usosMaxFunileiro(artifice(1, 16)), 3);
  assert.equal(regrasArtifice.usosMaxFunileiro(artifice(1, 8)), 1);
  assert.equal(regrasArtifice.usosMaxLampejo(artifice(6, 16)), 0);
  assert.equal(regrasArtifice.usosMaxLampejo(artifice(7, 16)), 3);
});

test('gastarUso respeita o máximo', () => {
  const p = artifice(7, 12);
  assert.equal(regrasArtifice.gastarUso(p, 'lampejo'), true);
  assert.equal(regrasArtifice.gastarUso(p, 'lampejo'), false);
});

test('descanso curto: nada antes do 14; 1 uso no 14; todos no 20 se sintonizado', () => {
  const p = artifice(13, 16); regrasArtifice.estadoArtifice(p).lampejo_gastos = 3;
  regrasArtifice.descansoCurtoArtifice(p); assert.equal(p.recursos.artifice.lampejo_gastos, 3);
  const q = artifice(14, 16); regrasArtifice.estadoArtifice(q).lampejo_gastos = 3;
  regrasArtifice.descansoCurtoArtifice(q); assert.equal(q.recursos.artifice.lampejo_gastos, 2);
  const r = artifice(20, 16, { inventario: [{ dados: { requer_sintonizacao: true }, sintonizado: true }] }); regrasArtifice.estadoArtifice(r).lampejo_gastos = 3;
  regrasArtifice.descansoCurtoArtifice(r); assert.equal(r.recursos.artifice.lampejo_gastos, 0);
  const s = artifice(20, 16); regrasArtifice.estadoArtifice(s).lampejo_gastos = 3;
  regrasArtifice.descansoCurtoArtifice(s); assert.equal(s.recursos.artifice.lampejo_gastos, 2);
});

test('descanso longo zera Funileiro e Lampejo e mantém o item armazenado', () => {
  const p = artifice(11, 16);
  regrasArtifice.definirArmazenar(p, { objeto: 'Adaga', magia: 'Curar Ferimentos', circulo: 1 });
  regrasArtifice.usarArmazenar(p);
  Object.assign(regrasArtifice.estadoArtifice(p), { funileiro_gastos: 2, lampejo_gastos: 1 });
  regrasArtifice.descansoLongoArtifice(p);
  assert.equal(p.recursos.artifice.funileiro_gastos, 0);
  assert.equal(p.recursos.artifice.lampejo_gastos, 0);
  assert.equal(p.recursos.artifice.armazenar.usos_gastos, 1);
});

test('Item de Armazenar Magia: cargas = 2x mod. Int (mín. 2); acaba e para', () => {
  const p = artifice(11, 10);
  assert.equal(regrasArtifice.cargasMaxArmazenar(p), 2);
  regrasArtifice.definirArmazenar(p, { objeto: 'Cajado', magia: 'Teia', circulo: 2 });
  assert.equal(regrasArtifice.usarArmazenar(p), true);
  assert.equal(regrasArtifice.usarArmazenar(p), true);
  assert.equal(regrasArtifice.usarArmazenar(p), false);
});

test('itens temporários somem no Descanso Longo; item manual de mesmo nome fica', () => {
  const p = { inventario: [
    { nome: 'Corda', origem: { tipo: 'funileiro', expira: 'descanso_longo' } },
    { nome: 'Corda' },
  ] };
  assert.deepEqual(temporarios.removerItensExpirados(p, 'descanso_longo'), ['Corda']);
  assert.deepEqual(p.inventario, [{ nome: 'Corda' }]);
});

test('lista da Magia de Funileiro: 31 itens, todos no catálogo ou o genérico Ampola', async () => {
  const eq = await db.getEquipamentoAventura();
  const nomes = new Set(eq.itens.map((i) => i.nome));
  assert.equal(regrasArtifice.ITENS_FUNILEIRO.length, 31);
  assert.deepEqual(regrasArtifice.ITENS_FUNILEIRO.filter((n) => !nomes.has(n)), ['Ampola']);
});

test('multiclasse: Lampejo usa o nível NA classe Artífice, não o nível total', () => {
  const p = (n) => artifice(n, 16, { classes: [{ classe: 'Guerreiro', nivel: 5, ordem: 0 }, { classe: 'Artífice', nivel: n, ordem: 1 }], classe: 'Guerreiro', nivel: 5 + n });
  assert.equal(regrasArtifice.usosMaxLampejo(p(7)), 3);
  assert.equal(regrasArtifice.usosMaxLampejo(p(6)), 0);
});

test('mod. de Inteligência usa o valor em jogo (item que fixa o atributo)', () => {
  const tiara = { nome: 'Tiara do Intelecto', tipo: 'magico', equipado: true, sintonizado: true,
    dados: { requer_sintonizacao: true, efeitos: [{ alvo: 'atributo', atributo: 'inteligencia', minimo: 19 }] } };
  const p = artifice(11, 8, { inventario: [tiara] });
  assert.equal(regrasArtifice.usosMaxFunileiro(p), 4);
  assert.equal(regrasArtifice.cargasMaxArmazenar(p), 8);
});

test('Item de Armazenar Magia: filtro exclui magia que consome material e aceita "Ação ou Ritual"', async () => {
  const lista = await db.getMagiasClasse('Artífice');
  const idx = await db.getIndiceMagias();
  const nomes = regrasArtifice.magiasArmazenaveis(lista, idx).map((m) => m.nome);
  const naLista = new Set(['1º Círculo', '2º Círculo', '3º Círculo'].flatMap((k) => lista.lista_magias[k].map((m) => m.nome)));
  for (const n of ['Chama Contínua', 'Tranca Arcana', 'Revivificar']) {
    if (naLista.has(n)) assert.ok(!nomes.includes(n), `${n} consome material`);
  }
  for (const n of ['Detectar Magia', 'Respirar na Água']) assert.ok(nomes.includes(n), `${n} deveria entrar`);
});

// ---- Magias sempre preparadas das subclasses × oráculo do PDF ----
const ORACULO_ARTIFICE = JSON.parse(readFileSync(resolve(RAIZ, 'scripts/tasha/oraculo_artifice.json'), 'utf8'));
const GLOSSARIO_MAGIAS = JSON.parse(readFileSync(resolve(RAIZ, 'scripts/tasha/magias_en_pt.json'), 'utf8'));
const SUBCLASSE_PARA_ORACULO = {
  'Alquimista': 'Alchemist', 'Armeiro': 'Armorer', 'Artilheiro': 'Artillerist',
  'Cartógrafo': 'Cartographer', 'Ferreiro de Batalha': 'Battle Smith',
};
// Magias concedidas por características (fora da tabela de magias da subclasse), com o nível de entrada.
const MAGIAS_EXTRAS_SUBCLASSE = {
  'Alquimista': [{ nome: 'Restauração Menor', nivel: 9 }, { nome: 'Caldeirão Borbulhante de Tasha', nivel: 15, gratis: true }],
  'Cartógrafo': [{ nome: 'Encontrar o Caminho', nivel: 15, gratis: true }],
};

/** Nomes em português das magias do oráculo de uma subclasse até o nível dado, na ordem do livro. */
function magiasDoOraculoAte(subclasse, nivel) {
  const porNivel = ORACULO_ARTIFICE.magias_subclasse_en[SUBCLASSE_PARA_ORACULO[subclasse]];
  return Object.keys(porNivel).map(Number).filter((n) => n <= nivel).sort((a, b) => a - b)
    .flatMap((n) => porNivel[n]).map((en) => {
      assert.ok(GLOSSARIO_MAGIAS[en], `glossário sem "${en}"`);
      return GLOSSARIO_MAGIAS[en];
    });
}

for (const subclasse of Object.keys(SUBCLASSE_PARA_ORACULO)) {
  test(`${subclasse}: magias sempre preparadas nos níveis 3/5/9/13/15/17 batem com o oráculo do PDF`, async () => {
    for (const nivel of [3, 5, 9, 13, 15, 17]) {
      const obtidas = await levelup.obterTodasMagiasSemprePreparadas('Artífice', subclasse, nivel);
      const extras = (MAGIAS_EXTRAS_SUBCLASSE[subclasse] || []).filter((e) => e.nivel <= nivel);
      const esperado = [...magiasDoOraculoAte(subclasse, nivel), ...extras.map((e) => e.nome)].sort();
      const nomes = obtidas.map((m) => m.nome).sort();
      assert.deepEqual(nomes, esperado, `${subclasse} nível ${nivel}`);
      for (const e of extras.filter((x) => x.gratis)) {
        assert.equal(obtidas.find((m) => m.nome === e.nome).gratisSemEspaco, true, `${e.nome} deveria ser grátis`);
      }
    }
  });
}

test('escolha de ferramenta de artesão do Artífice não oferece Funileiro (já concedida pela classe)', async () => {
  const { CLASSES_ESCOLHAS } = await import(pathToFileURL(resolve(RAIZ, 'site/js/creator/comum.js')).href);
  const nomes = CLASSES_ESCOLHAS['Artífice'].ferramenta_artesao.opcoes.map((o) => o.nome);
  assert.ok(!nomes.includes('Ferramentas de Funileiro'));
  assert.ok(nomes.includes('Ferramentas de Ferreiro'));
  assert.equal(nomes.length, 16);
});
