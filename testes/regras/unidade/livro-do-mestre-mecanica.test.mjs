// ============================================================
// Mecânica dos itens mágicos (capítulo 7 do Livro do Mestre): portão da
// curadoria. Mutações sobre um lote mínimo provam que cada regra do
// verificador avermelha o defeito que ela existe para pegar; depois, os
// arquivos reais passam no portão estrutural e a mescla do montar leva
// os efeitos ao acervo.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  verificarMecanica, indiceMecanica, carregarMecanica, carregarCatalogos, registrosDosLotes, RE_PASSIVO, RE_AUMENTO_TETO,
} from '../../../scripts/livro-do-mestre/mecanica.mjs';
import { carregarLotes, montar } from '../../../scripts/livro-do-mestre/capitulo7.mjs';

const CATALOGOS = {
  armas: [{ nome: 'Espada Longa', categoria: 'Armas Marciais Corpo a Corpo' }],
  armaduras: [{ nome: 'Couro', categoria: 'Leve' }, { nome: 'Escudo', categoria: 'Escudo' }],
};

/** Lote mínimo: um anel com +1 de CA e salvaguardas e uma arma +1/+2 com variantes. */
function lotesFixos() {
  return [{
    lote: '01', tipo: 'itens', paginas_pdf: [231, 238], itens: [
      { nome: 'Anel de Teste', linha_tipo: 'Anel, Raro (Requer Sintonização)', descricao: 'Você recebe +1 de bônus na Classe de Armadura e nas salvaguardas.', tabelas: [], variantes: [] },
      { nome: 'Arma Teste +1 ou +2', linha_tipo: 'Arma (Qualquer Arma Marcial), Incomum (+1) ou Rara (+2)', descricao: 'Você tem um bônus nas jogadas de ataque e de dano.', tabelas: [],
        variantes: [{ nome: 'Arma Teste +1', raridade: 'Incomum' }, { nome: 'Arma Teste +2', raridade: 'Rara' }] },
    ],
  }];
}

/** Mecânica válida para o lote mínimo; `mudar` altera o arquivo antes da checagem. */
function mecCom(mudar = (a) => a) {
  const arquivo = {
    lote: '01', _arquivo: 'lote-01.json',
    itens: {
      'anel-de-teste': { efeitos: [{ alvo: 'ca', valor: 1 }, { alvo: 'salvaguarda', valor: 1 }] },
      'arma-teste-mais-1-ou-mais-2': { base: { tipo: 'arma', categorias: ['Armas Marciais Corpo a Corpo'] }, efeitos: [] },
      'arma-teste-mais-1': { efeitos: [{ alvo: 'ataque_arma', valor: 1 }, { alvo: 'dano_arma', valor: 1 }] },
      'arma-teste-mais-2': { efeitos: [{ alvo: 'ataque_arma', valor: 2 }, { alvo: 'dano_arma', valor: 2 }] },
    },
    sem_efeito_automatico: [],
  };
  return { arquivos: [mudar(structuredClone(arquivo))] };
}

/** Erros do verificador sobre o lote mínimo, com completude. */
function erros(mudar) {
  return verificarMecanica(mecCom(mudar), lotesFixos(), CATALOGOS, { completo: true });
}

test('controle: a mecânica mínima passa', () => {
  assert.deepEqual(erros(), []);
});

test('registrosDosLotes devolve itens e variantes com o id do pai', () => {
  const r = registrosDosLotes(lotesFixos());
  assert.deepEqual(r.map((x) => [x.id, x.pai]), [
    ['anel-de-teste', null],
    ['arma-teste-mais-1-ou-mais-2', null],
    ['arma-teste-mais-1', 'arma-teste-mais-1-ou-mais-2'],
    ['arma-teste-mais-2', 'arma-teste-mais-1-ou-mais-2'],
  ]);
});

const MUTACOES = [
  ['valor ausente do texto', (a) => { a.itens['anel-de-teste'].efeitos[0].valor = 3; return a; }, /não aparece no texto/],
  ['alvo fora do vocabulário', (a) => { a.itens['anel-de-teste'].efeitos[0].alvo = 'iniciativa'; return a; }, /alvo "iniciativa"/],
  ['condição fora do vocabulário', (a) => { a.itens['anel-de-teste'].efeitos[0].condicao = 'sem_elmo'; return a; }, /condição "sem_elmo"/],
  ['ataque_arma sem base arma', (a) => { a.itens['anel-de-teste'].efeitos.push({ alvo: 'ataque_arma', valor: 1 }); return a; }, /exige base.tipo "arma"/],
  ['opção fora do catálogo', (a) => { a.itens['arma-teste-mais-1-ou-mais-2'].base = { tipo: 'arma', opcoes: ['Espada Inexistente'] }; return a; }, /não existe no catálogo/],
  ['opcoes e categorias juntas', (a) => { a.itens['arma-teste-mais-1-ou-mais-2'].base.opcoes = ['Espada Longa']; return a; }, /exatamente um entre opcoes e categorias/],
  ['base em variante', (a) => { a.itens['arma-teste-mais-1'].base = { tipo: 'arma', opcoes: ['Espada Longa'] }; return a; }, /base fica no item/],
  ['registro sem classificação', (a) => { delete a.itens['arma-teste-mais-2']; return a; }, /sem classificação/],
  ['id duplicado em itens e sem_efeito', (a) => { a.sem_efeito_automatico.push('anel-de-teste'); return a; }, /duplicado/],
  ['id que não é registro', (a) => { a.sem_efeito_automatico.push('item-fantasma'); return a; }, /não é registro/],
  ['entrada vazia sem base', (a) => { a.itens['anel-de-teste'].efeitos = []; return a; }, /use sem_efeito_automatico/],
  ['atributo com minimo fora da faixa', (a) => { a.itens['anel-de-teste'].efeitos = [{ alvo: 'atributo', atributo: 'forca', minimo: 15 }]; return a; }, /minimo 15 fora/],
  ['valor fora da faixa', (a) => { a.itens['anel-de-teste'].efeitos[0].valor = 9; return a; }, /valor 9 fora/],
  ['lote do arquivo diferente do nome', (a) => { a.lote = '02'; return a; }, /não bate com o nome do arquivo/],
  ['base escudo com opcoes/excluir', (a) => { a.itens['arma-teste-mais-1-ou-mais-2'].base = { tipo: 'escudo', opcoes: ['Escudo'], excluir: ['Escudo'] }; return a; }, /base escudo não leva opcoes\/categorias\/excluir/],
  ['excluir fora do catálogo', (a) => { a.itens['arma-teste-mais-1-ou-mais-2'].base.excluir = ['Espada Fantasma']; return a; }, /excluir "Espada Fantasma" não existe no catálogo/],
  ['categoria inválida na base', (a) => { a.itens['arma-teste-mais-1-ou-mais-2'].base.categorias = ['Armas Exóticas']; return a; }, /categoria "Armas Exóticas" fora de/],
  ['sem_penalidades não booleano', (a) => { a.itens['arma-teste-mais-1-ou-mais-2'].base.sem_penalidades = 'sim'; return a; }, /sem_penalidades só vale como booleano/],
  ['sem_penalidades em base de arma', (a) => { a.itens['arma-teste-mais-1-ou-mais-2'].base.sem_penalidades = true; return a; }, /sem_penalidades só vale como booleano em base.tipo "armadura"/],
  ['condição em ataque_arma', (a) => { a.itens['arma-teste-mais-1'].efeitos[0].condicao = 'sem_escudo'; return a; }, /ataque_arma não aceita condição/],
  ['condição em dano_arma', (a) => { a.itens['arma-teste-mais-1'].efeitos[1].condicao = 'sem_escudo'; return a; }, /dano_arma não aceita condição/],
  ['atributo usando valor', (a) => { a.itens['anel-de-teste'].efeitos = [{ alvo: 'atributo', atributo: 'forca', minimo: 19, valor: 1 }]; return a; }, /atributo usa "minimo", não "valor"/],
  ['atributo desconhecido', (a) => { a.itens['anel-de-teste'].efeitos = [{ alvo: 'atributo', atributo: 'sorte', minimo: 19 }]; return a; }, /atributo "sorte" fora de/],
  ['efeitos que não é lista', (a) => { a.itens['anel-de-teste'].efeitos = { alvo: 'ca', valor: 1 }; return a; }, /"efeitos" tem de ser uma lista/],
];
for (const [nome, mudar, re] of MUTACOES) {
  test(`mutação "${nome}" avermelha`, () => {
    const e = erros(mudar);
    assert.ok(e.some((x) => re.test(x)), `nenhum erro casou ${re}: ${JSON.stringify(e)}`);
  });
}

test('o número precisa estar isolado: 1 não casa dentro de 10', () => {
  const lotes = lotesFixos();
  lotes[0].itens[0].descricao = 'Você recebe 10 de bônus.';
  lotes[0].itens[0].linha_tipo = 'Anel, Raro';
  const e = verificarMecanica(mecCom(), lotes, CATALOGOS, { completo: true });
  assert.ok(e.some((x) => /valor 1 não aparece/.test(x)), JSON.stringify(e));
});

/** soLote: lote sem arquivo de mecânica devolve erro único e específico. */
test('soLote sem arquivo do lote avermelha', () => {
  const e = verificarMecanica(mecCom(), lotesFixos(), CATALOGOS, { soLote: '02' });
  assert.deepEqual(e, ['_mecanica/lote-02.json não existe']);
});

/** soLote ativa a completude do lote: registro sem classificação vira erro mesmo sem `completo`. */
test('soLote com registro sem classificação avermelha', () => {
  const mec = mecCom((a) => { delete a.itens['arma-teste-mais-2']; return a; });
  const e = verificarMecanica(mec, lotesFixos(), CATALOGOS, { soLote: '01' });
  assert.ok(e.some((x) => /"arma-teste-mais-2" \(lote 01\) sem classificação/.test(x)), JSON.stringify(e));
});

test('a mecânica real passa no portão estrutural', () => {
  const e = verificarMecanica(carregarMecanica(), carregarLotes(), carregarCatalogos(), { completo: false });
  assert.deepEqual(e, []);
});

test('montar leva efeitos e base ao acervo; registro sem entrada sai com efeitos vazio', () => {
  const lotes = carregarLotes();
  const mec = { 'anel-de-protecao': { efeitos: [{ alvo: 'ca', valor: 1 }] } };
  const { itens } = montar(lotes, mec).itens_magicos;
  const anel = itens.find((i) => i.id === 'anel-de-protecao');
  assert.deepEqual(anel.efeitos, [{ alvo: 'ca', valor: 1 }]);
  assert.equal(anel.base, undefined);
  const outro = itens.find((i) => i.id !== 'anel-de-protecao');
  assert.deepEqual(outro.efeitos, []);
  for (const v of itens.flatMap((i) => i.variantes)) assert.ok(Array.isArray(v.efeitos), `variante ${v.id} sem efeitos`);
});

test('indiceMecanica junta os arquivos por id', () => {
  const idx = indiceMecanica(mecCom());
  assert.deepEqual(idx.porId['anel-de-teste'].efeitos[0], { alvo: 'ca', valor: 1 });
  assert.equal(idx.sem.size, 0);
});

test('os 475 registros do acervo estão classificados (efeitos, base ou sem efeito automático)', () => {
  const e = verificarMecanica(carregarMecanica(), carregarLotes(), carregarCatalogos(), { completo: true });
  assert.deepEqual(e, []);
  const idx = indiceMecanica(carregarMecanica());
  assert.equal(Object.keys(idx.porId).length + idx.sem.size, 475);
});

// Âncoras da curadoria de passivos (defesas, deslocamento, sentidos e vantagens) conferidas contra o texto dos itens.
test('passivos: âncoras curadas', () => {
  const { porId } = indiceMecanica(carregarMecanica());
  const ef = (id) => porId[id]?.efeitos || [];
  assert.ok(ef('cajado-do-fogo').some((e) => e.alvo === 'resistencia' && e.tipo_dano === 'Ígneo'));
  assert.ok(ef('anel-de-natacao').some((e) => e.alvo === 'deslocamento' && e.modo === 'natacao' && e.metros === 12));
  assert.equal(ef('luvas-de-natacao-e-escalada').filter((e) => e.alvo === 'deslocamento' && e.igual_deslocamento).length, 2);
  assert.ok(ef('oculos-da-noite').some((e) => e.alvo === 'sentido' && e.sentido === 'visao_no_escuro' && e.metros === 18 && e.soma_se_tiver === 18));
  assert.equal(ef('livro-dos-feitos-exaltados').filter((e) => e.alvo === 'imunidade_condicao').length, 2);
  const anel = ef('anel-de-resistencia').find((e) => e.alvo === 'resistencia');
  assert.equal(anel?.escolha?.length, 10);
  assert.ok(ef('botas-elficas').some((e) => e.alvo === 'vantagem' && e.em === 'pericia' && e.pericia === 'Furtividade' && !e.contexto));
  assert.ok(ef('bastao-do-alerta').some((e) => e.alvo === 'vantagem' && e.em === 'iniciativa'));
  assert.ok(ef('manto-de-resistencia-a-magias').some((e) => e.alvo === 'vantagem' && e.em === 'salvaguarda' && e.contexto === 'contra magias' && !e.atributo));
  // Auréola do Livro dos Feitos Exaltados: Vantagem em Persuasão com o contexto literal do texto.
  assert.ok(ef('livro-dos-feitos-exaltados').some((e) => e.alvo === 'vantagem' && e.em === 'pericia' && e.pericia === 'Persuasão' && e.contexto === 'Enquanto presente, a auréola'));
});

/** Lote mínimo com uma varinha de cargas e um anel de uso diário, para os testes de recursos. */
function lotesRecursos() {
  const l = lotesFixos();
  l[0].itens.push(
    { nome: 'Varinha de Teste', linha_tipo: 'Varinha, Rara', tabelas: [], variantes: [],
      descricao: 'Esta varinha tem 7 cargas. A varinha recupera 1d6 + 1 cargas gastas diariamente ao amanhecer. Se você gastar a última carga da varinha, jogue 1d20. Com 1, a varinha é destruída.' },
    { nome: 'Anel Diário', linha_tipo: 'Anel, Incomum', tabelas: [], variantes: [],
      descricao: 'Você pode usar esta propriedade uma vez, e ela não pode ser usada novamente até o próximo amanhecer.' },
    // Uso diário que recupera espaço de magia até um círculo (texto cita "3º círculo").
    { nome: 'Pérola Teste', linha_tipo: 'Item Maravilhoso, Incomum', tabelas: [], variantes: [],
      descricao: 'Você pode recuperar um espaço de magia gasto de 3º círculo ou inferior (variações de 1º círculo e 9º círculo para os testes de fronteira). Depois que você usa a pérola, ela não pode ser usada novamente até o próximo amanhecer.' },
    // Texto sem "amanhecer", "Descanso Curto", "Descanso Longo" nem "cargas".
    { nome: 'Pedra Neutra', linha_tipo: 'Item Maravilhoso, Comum', tabelas: [], variantes: [], descricao: 'Uma pedra lisa sem nada de especial.' },
    // Pai com cargas e uma variante, para a herança na completude.
    { nome: 'Bastão Teste', linha_tipo: 'Bastão, Incomum', tabelas: [], descricao: 'Este bastão tem 3 cargas.', variantes: [{ nome: 'Bastão Teste Maior', raridade: 'Rara' }] },
  );
  return l;
}

/** Mecânica válida para lotesRecursos; `mudar` altera o arquivo antes da checagem. */
function mecRecursos(mudar = (a) => a) {
  return mecCom((a) => {
    a.itens['varinha-de-teste'] = { efeitos: [], recursos: { cargas: { max: 7, recupera: '1d6+1', ultima_carga: { efeito_com_1: 'destroi' } } } };
    a.itens['anel-diario'] = { efeitos: [], recursos: { usos: [{ nome: 'Propriedade', max: 1, recupera: 'amanhecer' }] } };
    a.itens['bastao-teste'] = { efeitos: [], recursos: { cargas: { max: 3, recupera: null, ultima_carga: null } } };
    a.itens['perola-teste'] = { efeitos: [], recursos: { usos: [{ nome: 'Recuperar', max: 1, recupera: 'amanhecer', efeito: 'recuperar_espaco_magia', circulo_max: 3 }] } };
    a.sem_efeito_automatico.push('pedra-neutra', 'bastao-teste-maior');
    return mudar(a);
  });
}

/** Erros do verificador sobre o lote de recursos, com completude. */
function errosRecursos(mudar) {
  return verificarMecanica(mecRecursos(mudar), lotesRecursos(), CATALOGOS, { completo: true });
}

test('recursos: controle passa', () => {
  assert.deepEqual(errosRecursos(), []);
});

/** Troca a classificação da Pedra Neutra (texto sem termos de recuperação) por um uso com a recuperação dada. */
function comUsoNaPedra(a, recupera) {
  a.sem_efeito_automatico = a.sem_efeito_automatico.filter((id) => id !== 'pedra-neutra');
  a.itens['pedra-neutra'] = { efeitos: [], recursos: { usos: [{ nome: 'U', max: 1, recupera }] } };
  return a;
}

const MUTACOES_RECURSOS = [
  ['max ausente do texto', (a) => { a.itens['varinha-de-teste'].recursos.cargas.max = 9; return a; }, /max 9 não aparece/],
  ['dado de recuperação ausente', (a) => { a.itens['varinha-de-teste'].recursos.cargas.recupera = '2d6+1'; return a; }, /recupera "2d6\+1" não aparece/],
  ['recupera com formato inválido', (a) => { a.itens['varinha-de-teste'].recursos.cargas.recupera = '1d6 + 1'; return a; }, /recupera "1d6 \+ 1" inválido/],
  ['ultima_carga sem a regra no texto', (a) => { a.itens['anel-diario'].recursos.cargas = { max: 1, recupera: null, ultima_carga: { efeito_com_1: 'destroi' } }; return a; }, /última carga/],
  ['ultima_carga outro com texto que não está no livro', (a) => { a.itens['varinha-de-teste'].recursos.cargas.ultima_carga = { efeito_com_1: 'outro', texto: 'Frase inventada.' }; return a; }, /texto da última carga não aparece/],
  ['uso amanhecer sem "amanhecer" no texto', (a) => comUsoNaPedra(a, 'amanhecer'), /uso "U" amanhecer exige "amanhecer" no texto/],
  ['uso descanso_curto sem "Descanso Curto" no texto', (a) => comUsoNaPedra(a, 'descanso_curto'), /uso "U" descanso_curto exige "Descanso Curto" no texto/],
  ['uso descanso_longo sem "Descanso Longo" no texto', (a) => comUsoNaPedra(a, 'descanso_longo'), /uso "U" descanso_longo exige "Descanso Longo" no texto/],
  ['cargas.max 0', (a) => { a.itens['varinha-de-teste'].recursos.cargas.max = 0; return a; }, /cargas\.max 0 inválido/],
  ['cargas.max string', (a) => { a.itens['varinha-de-teste'].recursos.cargas.max = '7'; return a; }, /cargas\.max 7 inválido/],
  ['cargas.max fracionário', (a) => { a.itens['varinha-de-teste'].recursos.cargas.max = 1.5; return a; }, /cargas\.max 1\.5 inválido/],
  ['recupera 0', (a) => { a.itens['varinha-de-teste'].recursos.cargas.recupera = 0; return a; }, /cargas\.recupera 0 inválido/],
  ['recupera fracionário', (a) => { a.itens['varinha-de-teste'].recursos.cargas.recupera = 1.5; return a; }, /cargas\.recupera 1\.5 inválido/],
  ['recupera ausente (undefined)', (a) => { delete a.itens['varinha-de-teste'].recursos.cargas.recupera; return a; }, /cargas\.recupera undefined inválido/],
  ['ultima_carga destroi sem "destruíd" no texto', (a) => { a.itens['bastao-teste'].recursos.cargas.ultima_carga = { efeito_com_1: 'destroi' }; return a; }, /ultima_carga "destroi" sem "destruíd" no texto/],
  ['ultima_carga com efeito fora do vocabulário', (a) => { a.itens['varinha-de-teste'].recursos.cargas.ultima_carga = { efeito_com_1: 'explode' }; return a; }, /efeito_com_1 "explode" fora de destroi\/outro/],
  ['usos que não é lista', (a) => { a.itens['anel-diario'].recursos.usos = { nome: 'X' }; return a; }, /usos tem de ser lista/],
  ['recursos string', (a) => { a.itens['anel-diario'].recursos = 'x'; return a; }, /recursos tem de ser objeto ou null/],
  ['recursos lista', (a) => { a.itens['anel-diario'].recursos = []; return a; }, /recursos tem de ser objeto ou null/],
  ['recursos vazio', (a) => { a.itens['anel-diario'].recursos = {}; return a; }, /recursos precisa de cargas ou usos/],
  ['chave desconhecida em recursos', (a) => { a.itens['anel-diario'].recursos.extra = 1; return a; }, /recursos: chave desconhecida "extra"/],
  ['chave desconhecida em cargas', (a) => { a.itens['varinha-de-teste'].recursos.cargas.extra = 1; return a; }, /cargas: chave desconhecida "extra"/],
  ['chave desconhecida em ultima_carga', (a) => { a.itens['varinha-de-teste'].recursos.cargas.ultima_carga.extra = 1; return a; }, /ultima_carga: chave desconhecida "extra"/],
  ['chave desconhecida em uso', (a) => { a.itens['anel-diario'].recursos.usos[0].extra = 1; return a; }, /uso "Propriedade": chave desconhecida "extra"/],
  ['uso com max 0', (a) => { a.itens['anel-diario'].recursos.usos[0].max = 0; return a; }, /uso "Propriedade" com max 0 inválido/],
  ['variante sem recursos cujo pai também não tem', (a) => { delete a.itens['bastao-teste']; a.sem_efeito_automatico.push('bastao-teste'); return a; }, /"bastao-teste-maior" \(lote 01\) cita "cargas" e não tem/],
  ['sem_cargas com id que não é registro', (a) => { a.sem_cargas = { 'item-fantasma': 'motivo' }; return a; }, /sem_cargas\["item-fantasma"\]: "item-fantasma" não é registro/],
  ['recupera de uso fora da lista', (a) => { a.itens['anel-diario'].recursos.usos[0].recupera = 'semanal'; return a; }, /recupera "semanal" fora/],
  ['nome de uso repetido', (a) => { a.itens['anel-diario'].recursos.usos.push({ nome: 'Propriedade', max: 1, recupera: 'amanhecer' }); return a; }, /uso "Propriedade" repetido/],
  ['efeito de uso fora do vocabulário', (a) => { a.itens['perola-teste'].recursos.usos[0].efeito = 'curar'; return a; }, /efeito "curar" fora de recuperar_espaco_magia/],
  ['efeito sem circulo_max em texto que cita "3º círculo ou inferior"', (a) => { delete a.itens['perola-teste'].recursos.usos[0].circulo_max; return a; }, /com efeito sem circulo_max, mas o texto cita limite de círculo: informe circulo_max/],
  ['circulo_max nulo', (a) => { a.itens['perola-teste'].recursos.usos[0].circulo_max = null; return a; }, /exige circulo_max inteiro de 1 a 9 \(veio null\)/],
  ['circulo_max 0', (a) => { a.itens['perola-teste'].recursos.usos[0].circulo_max = 0; return a; }, /exige circulo_max inteiro de 1 a 9 \(veio 0\)/],
  ['circulo_max 10', (a) => { a.itens['perola-teste'].recursos.usos[0].circulo_max = 10; return a; }, /exige circulo_max inteiro de 1 a 9 \(veio 10\)/],
  ['circulo_max fracionário', (a) => { a.itens['perola-teste'].recursos.usos[0].circulo_max = 2.5; return a; }, /exige circulo_max inteiro de 1 a 9/],
  ['circulo_max ausente do texto', (a) => { a.itens['perola-teste'].recursos.usos[0].circulo_max = 5; return a; }, /circulo_max 5 não aparece no texto como "5º círculo"/],
  ['circulo_max sem efeito', (a) => { delete a.itens['perola-teste'].recursos.usos[0].efeito; return a; }, /uso "Recuperar" tem circulo_max sem efeito/],
  ['item com "cargas" sem recursos.cargas',(a) => { delete a.itens['varinha-de-teste'].recursos; return a; }, /cita "cargas" e não tem recursos\.cargas/],
];
for (const [nome, mudar, re] of MUTACOES_RECURSOS) {
  test(`recursos: mutação "${nome}" avermelha`, () => {
    const e = errosRecursos(mudar);
    assert.ok(e.some((x) => re.test(x)), `nenhum erro casou ${re}: ${JSON.stringify(e)}`);
  });
}

/** Casos válidos de recursos: nenhum erro deve aparecer. */
const VALIDOS_RECURSOS = [
  ['recupera inteiro >= 1', (a) => { a.itens['varinha-de-teste'].recursos.cargas.recupera = 1; return a; }],
  ['recupera "todas"', (a) => { a.itens['varinha-de-teste'].recursos.cargas.recupera = 'todas'; return a; }],
  ['circulo_max 1 (fronteira inferior)', (a) => { a.itens['perola-teste'].recursos.usos[0].circulo_max = 1; return a; }],
  ['circulo_max 9 (fronteira superior)', (a) => { a.itens['perola-teste'].recursos.usos[0].circulo_max = 9; return a; }],  ['ultima_carga destroi com texto "destruída"', (a) => a],
  ['ultima_carga outro com a frase do livro', (a) => { a.itens['varinha-de-teste'].recursos.cargas.ultima_carga = { efeito_com_1: 'outro', texto: 'Com 1, a varinha é destruída.' }; return a; }],
  ['variante herda cargas do pai na completude', (a) => a],
];
for (const [nome, mudar] of VALIDOS_RECURSOS) {
  test(`recursos: válido "${nome}"`, () => {
    assert.deepEqual(errosRecursos(mudar), []);
  });
}

/** Erros com a Pérola Teste sem `circulo_max` e o texto dela trocado por `descricao`. */
function errosPerolaSemTeto(descricao) {
  const l = lotesRecursos();
  l[0].itens.find((i) => i.nome === 'Pérola Teste').descricao = descricao;
  const mec = mecRecursos((a) => { delete a.itens['perola-teste'].recursos.usos[0].circulo_max; return a; });
  return verificarMecanica(mec, l, CATALOGOS, { completo: true });
}

test('recursos: efeito sem circulo_max passa quando o texto não cita limite de círculo (sem teto)', () => {
  const texto = 'Você pode recuperar um espaço de magia com uma ação Usar Magia. Você não pode usar esta propriedade novamente até terminar o próximo amanhecer.';
  assert.deepEqual(errosPerolaSemTeto(texto), []);
});

// Uma forma de citar limite de círculo por teste: cada uma avermelha se a regex deixar de reconhecê-la.
for (const frase of [
  'um espaço de magia do 3º círculo',
  'um espaço de magia gasto de 3º círculo ou inferior',
  'um espaço de magia até o 3º círculo',
  'um espaço de magia de no máximo 5º círculo',
  'um espaço de magia de círculo 3 ou inferior',
  'um espaço de magia do terceiro círculo',
  'um espaço de magia do Sétimo círculo',
]) {
  test(`recursos: efeito sem circulo_max avermelha quando o texto cita "${frase}"`, () => {
    const e = errosPerolaSemTeto(`Você pode recuperar ${frase}. Não pode usar de novo até o próximo amanhecer.`);
    assert.ok(e.some((x) => /sem circulo_max, mas o texto cita limite de círculo: informe circulo_max/.test(x)), JSON.stringify(e));
  });
}

test('recursos: âncora do Bastão do Guardião do Pacto (efeito sem circulo_max, descanso_longo)', () => {
  const { porId } = indiceMecanica(carregarMecanica());
  assert.deepEqual(porId['bastao-do-guardiao-do-pacto'].recursos.usos, [{ nome: 'Recuperar espaço de magia', max: 1, recupera: 'descanso_longo', efeito: 'recuperar_espaco_magia' }]);
});

test('recursos: ultima_carga destroi aceita "destrói" e rejeita texto sem destr*', () => {
  const comTexto = (descricao) => {
    const l = lotesRecursos();
    l[0].itens.find((i) => i.nome === 'Varinha de Teste').descricao = descricao;
    return verificarMecanica(mecRecursos(), l, CATALOGOS, { completo: true });
  };
  const base = 'Esta varinha tem 7 cargas. A varinha recupera 1d6 + 1 cargas gastas diariamente ao amanhecer. Se você gastar a última carga da varinha, jogue 1d20. Com 1, ';
  assert.deepEqual(comTexto(`${base}a varinha se desfaz e um clarão a destrói.`), []);
  const e = comTexto(`${base}a varinha se desfaz em cinzas.`);
  assert.ok(e.some((x) => /ultima_carga "destroi" sem "destruíd"/.test(x)), JSON.stringify(e));
});

test('recursos: ultima_carga destroi sem 1d20 no texto avermelha', () => {
  const l = lotesRecursos();
  l[0].itens.find((i) => i.nome === 'Varinha de Teste').descricao = 'Esta varinha tem 7 cargas. A varinha recupera 1d6 + 1 cargas gastas diariamente ao amanhecer. Quando você gasta a última carga, a varinha é destruída.';
  const e = verificarMecanica(mecRecursos(), l, CATALOGOS, { completo: true });
  assert.ok(e.some((x) => /ultima_carga "destroi" exige a rolagem 1d20 no texto/.test(x)), JSON.stringify(e));
});

test('recursos: âncoras curadas', () => {
  const { porId } = indiceMecanica(carregarMecanica());
  assert.deepEqual(porId['varinha-de-bolas-de-fogo'].recursos.cargas, { max: 7, recupera: '1d6+1', ultima_carga: { efeito_com_1: 'destroi' } });
  assert.equal(porId['cajado-do-poder'].recursos.cargas.max, 20);
  assert.equal(porId['cajado-do-poder'].recursos.cargas.recupera, '2d8+4');
  assert.equal(porId['cajado-do-poder'].recursos.cargas.ultima_carga.efeito_com_1, 'outro');
  // Destruição incondicional (sem d20): vira "outro" com a frase literal; "destroi" exige 1d20 no texto.
  assert.deepEqual(porId['escaravelho-de-protecao'].recursos.cargas, { max: 12, recupera: null, ultima_carga: { efeito_com_1: 'outro', texto: 'O escaravelho se esfarela em pó e é destruído quando sua última carga é gasta.' } });
  assert.ok((porId['azagaia-do-relampago'].recursos.usos || []).some((u) => u.recupera === 'amanhecer'));
  assert.deepEqual(porId['perola-do-poder'].recursos.usos, [{ nome: 'Recuperar espaço de magia', max: 1, recupera: 'amanhecer', efeito: 'recuperar_espaco_magia', circulo_max: 3 }]);
  const curtos = Object.values(porId).flatMap((e) => e.recursos?.usos || []).filter((u) => u.recupera === 'descanso_curto');
  assert.ok(curtos.length >= 1, 'ao menos um uso que volta no Descanso Curto');
});

test('recursos: sem_cargas sem motivo é erro mesmo sem completo', () => {
  const mec = mecRecursos((a) => { a.sem_cargas = { 'varinha-de-teste': '' }; return a; });
  const e = verificarMecanica(mec, lotesRecursos(), CATALOGOS, { completo: false });
  assert.ok(e.some((x) => /sem_cargas\["varinha-de-teste"\]: sem motivo/.test(x)), JSON.stringify(e));
});

test('recursos: sem_cargas com motivo dispensa a completude; sem motivo, não', () => {
  const ok = errosRecursos((a) => { delete a.itens['varinha-de-teste'].recursos; a.sem_cargas = { 'varinha-de-teste': 'cargas citadas só para outro item' }; return a; });
  assert.ok(!ok.some((x) => /cita "cargas"/.test(x)), JSON.stringify(ok));
  const semMotivo = errosRecursos((a) => { delete a.itens['varinha-de-teste'].recursos; a.sem_cargas = { 'varinha-de-teste': '' }; return a; });
  assert.ok(semMotivo.some((x) => /sem_cargas.*sem motivo/.test(x)), JSON.stringify(semMotivo));
});

test('montar leva recursos ao item e às variantes (null quando não há)', () => {
  const { itens } = montar(carregarLotes(), { 'anel-de-protecao': { efeitos: [], recursos: { usos: [{ nome: 'X', max: 1, recupera: 'amanhecer' }] } } }).itens_magicos;
  assert.deepEqual(itens.find((i) => i.id === 'anel-de-protecao').recursos, { usos: [{ nome: 'X', max: 1, recupera: 'amanhecer' }] });
  const outro = itens.find((i) => i.id !== 'anel-de-protecao');
  assert.equal(outro.recursos, null);
  for (const v of itens.flatMap((i) => i.variantes)) assert.ok('recursos' in v, `variante ${v.id} sem recursos`);
});

const CATALOGOS_MAGIAS = { ...CATALOGOS, magias: new Map([['Bola de Fogo', 3], ['Teia', 2], ['Detectar Magia', 1], ['Mísseis Mágicos', 1]]) };

/** Lote mínimo com itens que conjuram: varinha de faixa, manto de uso, bastão livre, cajado de "sua CD". */
function lotesMagias() {
  const l = lotesFixos();
  l[0].itens.push(
    { nome: 'Varinha de Fogo Teste', linha_tipo: 'Varinha, Rara', tabelas: [], variantes: [],
      descricao: 'Esta varinha tem 7 cargas. Você pode gastar no máximo 3 cargas para conjurar *Bola de Fogo* (salvaguarda CD 15) a partir dela. Com 1 carga, você conjura a versão de 3º círculo. A varinha recupera 1d6 + 1 cargas gastas diariamente ao amanhecer.' },
    { nome: 'Manto Teste', linha_tipo: 'Item Maravilhoso, Incomum', tabelas: [], variantes: [],
      descricao: 'Você pode conjurar *Teia* (salvaguarda CD 13). Depois disso, não pode fazê-lo novamente até o próximo amanhecer.' },
    { nome: 'Bastão Livre Teste', linha_tipo: 'Bastão, Raro', tabelas: [], variantes: [],
      descricao: 'Enquanto segura o bastão, você pode conjurar *Detectar Magia* a partir dele.' },
    { nome: 'Cajado Sua CD', linha_tipo: 'Cajado, Raro', variantes: [],
      descricao: 'Este cajado tem 10 cargas. Você pode conjurar a partir dele uma das magias da tabela, usando a CD para evitar suas magias. O cajado recupera 1d6 + 4 cargas gastas diariamente ao amanhecer.',
      tabelas: [{ titulo: '', cabecalhos: ['Magia', 'Custo em Cargas'], dados: [['*Bola de Fogo* (versão de 5º círculo)', '5'], ['*Mísseis Mágicos*', '1']] }] },
  );
  return l;
}

/** Mecânica válida para lotesMagias; `mudar` altera o arquivo antes da checagem. */
function mecMagias(mudar = (a) => a) {
  return mecCom((a) => {
    a.itens['varinha-de-fogo-teste'] = { efeitos: [], recursos: { cargas: { max: 7, recupera: '1d6+1', ultima_carga: null } },
      magias: [{ nome: 'Bola de Fogo', custo: { cargas: 1, cargas_max: 3 }, conjuracao: { cd: 15 } }] };
    a.itens['manto-teste'] = { efeitos: [], recursos: { usos: [{ nome: 'Teia', max: 1, recupera: 'amanhecer' }] },
      magias: [{ nome: 'Teia', custo: { uso: 'Teia' }, conjuracao: { cd: 13 } }] };
    a.itens['bastao-livre-teste'] = { efeitos: [], magias: [{ nome: 'Detectar Magia', custo: 'livre', conjuracao: null }] };
    a.itens['cajado-sua-cd'] = { efeitos: [], recursos: { cargas: { max: 10, recupera: '1d6+4', ultima_carga: null } },
      magias: [{ nome: 'Bola de Fogo', custo: { cargas: 5, circulo: 5 }, conjuracao: 'sua' }, { nome: 'Mísseis Mágicos', custo: { cargas: 1 }, conjuracao: 'sua' }] };
    return mudar(a);
  });
}

/** Erros do verificador sobre o lote de magias, com completude. */
function errosMagias(mudar) {
  return verificarMecanica(mecMagias(mudar), lotesMagias(), CATALOGOS_MAGIAS, { completo: true });
}

test('magias: controle passa', () => {
  assert.deepEqual(errosMagias(), []);
});

const MUTACOES_MAGIAS = [
  ['magias que não é lista', (a) => { a.itens['manto-teste'].magias = {}; return a; }, /magias tem de ser lista/],
  ['nome fora do índice', (a) => { a.itens['manto-teste'].magias[0].nome = 'Teia Gigante'; return a; }, /magia "Teia Gigante" não existe no índice/],
  ['nome sem itálico no texto', (a) => { a.itens['manto-teste'].magias.push({ nome: 'Detectar Magia', custo: { uso: 'Teia' }, conjuracao: null }); return a; }, /"Detectar Magia" não aparece em itálico/],
  ['nome repetido', (a) => { a.itens['manto-teste'].magias.push(structuredClone(a.itens['manto-teste'].magias[0])); return a; }, /magia "Teia" repetida/],
  ['chave desconhecida', (a) => { a.itens['manto-teste'].magias[0].extra = 1; return a; }, /magia "Teia": chave desconhecida "extra"/],
  ['custo inválido', (a) => { a.itens['manto-teste'].magias[0].custo = 'grátis'; return a; }, /custo inválido/],
  ['cargas sem recursos.cargas', (a) => { a.itens['manto-teste'].magias[0].custo = { cargas: 1 }; return a; }, /custo em cargas sem recursos\.cargas/],
  ['cargas acima do máximo', (a) => { a.itens['varinha-de-fogo-teste'].magias[0].custo = { cargas: 8 }; return a; }, /cargas 8 acima do máximo 7/],
  ['cargas fora do texto', (a) => { a.itens['cajado-sua-cd'].magias[1].custo = { cargas: 2 }; return a; }, /cargas 2 não aparece no texto/],
  ['cargas_max não maior que cargas', (a) => { a.itens['varinha-de-fogo-teste'].magias[0].custo.cargas_max = 1; return a; }, /cargas_max 1 tem de ser maior que cargas 1/],
  ['cargas_max com circulo', (a) => { a.itens['varinha-de-fogo-teste'].magias[0].custo.circulo = 3; return a; }, /cargas_max e circulo não combinam/],
  ['circulo fora do texto', (a) => { a.itens['cajado-sua-cd'].magias[0].custo.circulo = 6; return a; }, /circulo 6 não aparece como "6º círculo"/],
  ['circulo menor que o da magia', (a) => { a.itens['cajado-sua-cd'].magias[1].custo.circulo = 0; return a; }, /circulo 0 menor que o da magia \(1\)/],
  ['uso inexistente', (a) => { a.itens['manto-teste'].magias[0].custo = { uso: 'Rede' }; return a; }, /uso "Rede" não existe em recursos\.usos/],
  ['livre em item com cargas', (a) => { a.itens['varinha-de-fogo-teste'].magias[0].custo = 'livre'; return a; }, /custo "livre" em item com cargas/],
  ['cd fora do texto', (a) => { a.itens['manto-teste'].magias[0].conjuracao = { cd: 14 }; return a; }, /cd 14 não aparece como "CD 14"/],
  ['ataque fora do texto', (a) => { a.itens['manto-teste'].magias[0].conjuracao = { ataque: 7 }; return a; }, /ataque 7 não aparece como "\+7"/],
  ['conjuracao vazia', (a) => { a.itens['manto-teste'].magias[0].conjuracao = {}; return a; }, /conjuracao precisa de cd ou ataque/],
  ['"sua" sem a frase no texto', (a) => { a.itens['manto-teste'].magias[0].conjuracao = 'sua'; return a; }, /conjuracao "sua" sem a frase/],
  ['sem_magias sem motivo', (a) => { a.sem_magias = { 'manto-teste': '' }; return a; }, /sem_magias\["manto-teste"\]: sem motivo/],
  ['sem_magias com id que não é registro', (a) => { a.sem_magias = { fantasma: 'm' }; return a; }, /sem_magias\["fantasma"\]: "fantasma" não é registro/],
  ['item que conjura sem magias nem sem_magias', (a) => { delete a.itens['bastao-livre-teste']; a.sem_efeito_automatico.push('bastao-livre-teste'); return a; }, /"bastao-livre-teste" \(lote 01\) conjura magia do Livro do Jogador e não tem magias nem sem_magias/],
];
for (const [nome, mudar, re] of MUTACOES_MAGIAS) {
  test(`magias: mutação "${nome}" avermelha`, () => {
    const e = errosMagias(mudar);
    assert.ok(e.some((x) => re.test(x)), `nenhum erro casou ${re}: ${JSON.stringify(e)}`);
  });
}

test('magias: sem_magias com motivo dispensa a completude', () => {
  const e = errosMagias((a) => { delete a.itens['bastao-livre-teste']; a.sem_efeito_automatico.push('bastao-livre-teste'); a.sem_magias = { 'bastao-livre-teste': 'magia escolhida pelo Mestre' }; return a; });
  assert.deepEqual(e, []);
});

test('montar leva magias com circulo_base ao item e às variantes (null quando não há)', () => {
  const circulos = new Map([['Teia', 2]]);
  const { itens } = montar(carregarLotes(), { 'manto-aracnideo': { efeitos: [], magias: [{ nome: 'Teia', custo: 'livre', conjuracao: null }] } }, circulos).itens_magicos;
  assert.deepEqual(itens.find((i) => i.id === 'manto-aracnideo').magias, [{ nome: 'Teia', custo: 'livre', conjuracao: null, circulo_base: 2 }]);
  assert.equal(itens.find((i) => i.id !== 'manto-aracnideo').magias, null);
  for (const v of itens.flatMap((i) => i.variantes)) assert.ok('magias' in v, `variante ${v.id} sem magias`);
});

test('magias: âncoras curadas', () => {
  const { porId } = indiceMecanica(carregarMecanica());
  assert.deepEqual(porId['varinha-de-bolas-de-fogo'].magias, [{ nome: 'Bola de Fogo', custo: { cargas: 1, cargas_max: 3 }, conjuracao: { cd: 15 } }]);
  assert.deepEqual(porId['cajado-do-poder'].magias.find((m) => m.nome === 'Bola de Fogo'), { nome: 'Bola de Fogo', custo: { cargas: 5, circulo: 5 }, conjuracao: 'sua' });
  assert.deepEqual(porId['manto-aracnideo'].magias, [{ nome: 'Teia', custo: { uso: 'Teia' }, conjuracao: { cd: 13 } }]);
  const variantesAnel = Object.keys(porId).filter((id) => id.startsWith('anel-de-comando-elemental-') && porId[id].magias?.length);
  assert.ok(variantesAnel.length >= 1, 'ao menos uma variante do Anel de Comando Elemental com magias próprias');
});

// Âncoras do aumento de atributo até um máximo, conferidas contra o acervo curado.
test('aumento: âncoras curadas', () => {
  const { porId } = indiceMecanica(carregarMecanica());
  const ef = (id) => porId[id]?.efeitos || [];
  assert.ok(ef('pedra-ioun-fortitude').some((e) => e.alvo === 'atributo_bonus' && e.atributo === 'constituicao' && e.valor === 2 && e.maximo === 20));
  assert.deepEqual(porId['manual-do-exercicio-proveitoso']?.aumento_permanente, { atributo: 'forca', valor: 2, maximo: 30 });
  assert.deepEqual(porId['livro-da-escuridao-vil']?.aumento_permanente, { atributo: 'escolha', valor: 2, maximo: 24, reducao: { valor: 2, minimo: 3 } });
  assert.ok(ef('martelo-dos-trovoes').some((e) => e.alvo === 'atributo_minimo_bonus' && e.atributo === 'forca' && e.valor === 4 && e.maximo === 30));
  // As 6 Pedras Ioun de atributo: +2 no atributo certo, até 20.
  const pedras = { agilidade: 'destreza', fortitude: 'constituicao', intuicao: 'sabedoria', intelecto: 'inteligencia', lideranca: 'carisma', forca: 'forca' };
  for (const [sufixo, atributo] of Object.entries(pedras)) {
    assert.deepEqual(ef(`pedra-ioun-${sufixo}`).filter((e) => e.alvo === 'atributo_bonus'), [{ alvo: 'atributo_bonus', atributo, valor: 2, maximo: 20 }], `pedra-ioun-${sufixo}`);
  }
  // Manuais e Tomos: aumento permanente de +2 até 30 no atributo certo.
  const livros = { 'manual-da-saude-corporal': 'constituicao', 'manual-do-exercicio-proveitoso': 'forca', 'manual-da-rapidez-de-acao': 'destreza', 'tomo-do-pensamento-claro': 'inteligencia', 'tomo-da-lideranca-e-influencia': 'carisma', 'tomo-da-compreensao': 'sabedoria' };
  for (const [id, atributo] of Object.entries(livros)) assert.deepEqual(porId[id]?.aumento_permanente, { atributo, valor: 2, maximo: 30 }, id);
  // Livro dos Feitos Exaltados: Sabedoria +2 até 24.
  assert.deepEqual(porId['livro-dos-feitos-exaltados']?.aumento_permanente, { atributo: 'sabedoria', valor: 2, maximo: 24 });
});

test('magias: o acervo montado traz circulo_base em toda magia', () => {
  const acervo = JSON.parse(fs.readFileSync(new URL('../../../dados/livro-do-mestre/capitulo7/itens_magicos.json', import.meta.url), 'utf8'));
  const todas = acervo.itens.flatMap((i) => [i, ...i.variantes]).flatMap((r) => r.magias || []);
  assert.ok(todas.length >= 40, `só ${todas.length} magias no acervo`);
  for (const m of todas) assert.ok(Number.isInteger(m.circulo_base), `${m.nome} sem circulo_base`);
});

test('magias: mutação "circulo de uso fora do texto" avermelha', () => {
  const e = errosMagias((a) => { a.itens['manto-teste'].magias[0].custo = { uso: 'Teia', circulo: 3 }; return a; });
  assert.ok(e.some((x) => /circulo 3 não aparece como "3º círculo"/.test(x)), JSON.stringify(e));
});

test('magias: custo uso com circulo no texto passa', () => {
  const lotes = lotesMagias();
  const manto = lotes[0].itens.find((i) => i.nome === 'Manto Teste');
  manto.descricao += ' Você conjura a versão de 3º círculo.';
  const e = verificarMecanica(mecMagias((a) => { a.itens['manto-teste'].magias[0].custo = { uso: 'Teia', circulo: 3 }; return a; }), lotes, CATALOGOS_MAGIAS, { completo: true });
  assert.deepEqual(e, []);
});

// ------------------------------------------------------------
// Defesas, deslocamento, sentidos e vantagens (efeitos passivos)
// ------------------------------------------------------------

/** Lote mínimo com passivos: cajado de resistência, anel de natação, óculos, luvas, livro de imunidade, anel de escolha, botas de mínimo. */
function lotesPassivos() {
  const l = lotesFixos();
  l[0].itens.push(
    { nome: 'Cajado Quente', linha_tipo: 'Cajado, Raro', tabelas: [], variantes: [], descricao: 'Você tem Resistência a dano Ígneo enquanto segura este cajado.' },
    { nome: 'Anel Nadador', linha_tipo: 'Anel, Incomum', tabelas: [], variantes: [], descricao: 'Você tem Deslocamento de Natação de 12 metros enquanto usa este anel.' },
    { nome: 'Óculos Escuros', linha_tipo: 'Item Maravilhoso, Incomum', tabelas: [], variantes: [], descricao: 'Enquanto usa estas lentes, você tem Visão no Escuro com alcance de 18 metros. Se você já tiver Visão no Escuro, usar os óculos aumenta o alcance dela em 18 metros.' },
    { nome: 'Luvas Aranha', linha_tipo: 'Item Maravilhoso, Incomum', tabelas: [], variantes: [], descricao: 'Enquanto usa estas luvas, você tem Deslocamento de Escalada e Deslocamento de Natação iguais ao seu Deslocamento.' },
    { nome: 'Livro Bravo', linha_tipo: 'Item Maravilhoso, Raro', tabelas: [], variantes: [], descricao: 'Você tem Imunidade às condições Enfeitiçado e Amedrontado e tem Imunidade a dano Psíquico.' },
    { nome: 'Anel Variável', linha_tipo: 'Anel, Raro', variantes: [], descricao: 'Você tem Resistência a um tipo de dano enquanto usa este anel.',
      tabelas: [{ titulo: '', cabecalhos: ['1d3', 'Tipo de Dano'], dados: [['1', 'Ácido'], ['2', 'Gélido'], ['3', 'Ígneo']] }] },
    { nome: 'Botas Ligeiras', linha_tipo: 'Item Maravilhoso, Incomum', tabelas: [], variantes: [], descricao: 'Enquanto você calça estas botas, seu Deslocamento se torna 9 metros, a menos que seu Deslocamento seja maior.' },
    { nome: 'Asas Teste', linha_tipo: 'Item Maravilhoso, Raro', tabelas: [], variantes: [], descricao: 'As asas concedem Deslocamento de Voo igual ao seu Deslocamento, podendo pairar.' },
    { nome: 'Botas Silenciosas', linha_tipo: 'Item Maravilhoso, Incomum', tabelas: [], variantes: [], descricao: 'Você tem Vantagem em testes de Destreza (Furtividade).' },
    { nome: 'Bastão Vigia', linha_tipo: 'Bastão, Raro', tabelas: [], variantes: [], descricao: 'Enquanto segura o bastão, você tem Vantagem em testes de Sabedoria (Percepção) e nas jogadas de Iniciativa.' },
    { nome: 'Capa Antimagia', linha_tipo: 'Item Maravilhoso, Incomum', tabelas: [], variantes: [], descricao: 'Você tem Vantagem em salvaguardas contra magias enquanto usa esta capa.' },
  );
  return l;
}

/** Mecânica válida para lotesPassivos; `mudar` altera o arquivo antes da checagem. */
function mecPassivos(mudar = (a) => a) {
  return mecCom((a) => {
    a.itens['cajado-quente'] = { efeitos: [{ alvo: 'resistencia', tipo_dano: 'Ígneo' }] };
    a.itens['anel-nadador'] = { efeitos: [{ alvo: 'deslocamento', modo: 'natacao', metros: 12 }] };
    a.itens['oculos-escuros'] = { efeitos: [{ alvo: 'sentido', sentido: 'visao_no_escuro', metros: 18, soma_se_tiver: 18 }] };
    a.itens['luvas-aranha'] = { efeitos: [{ alvo: 'deslocamento', modo: 'escalada', igual_deslocamento: true }, { alvo: 'deslocamento', modo: 'natacao', igual_deslocamento: true }] };
    a.itens['livro-bravo'] = { efeitos: [{ alvo: 'imunidade_condicao', condicao: 'Enfeitiçado' }, { alvo: 'imunidade_condicao', condicao: 'Amedrontado' }, { alvo: 'imunidade', tipo_dano: 'Psíquico' }] };
    a.itens['anel-variavel'] = { efeitos: [{ alvo: 'resistencia', escolha: ['Ácido', 'Gélido', 'Ígneo'] }] };
    a.itens['botas-ligeiras'] = { efeitos: [{ alvo: 'deslocamento_minimo', metros: 9 }] };
    a.itens['asas-teste'] = { efeitos: [{ alvo: 'deslocamento', modo: 'voo', igual_deslocamento: true, pairar: true }] };
    a.itens['botas-silenciosas'] = { efeitos: [{ alvo: 'vantagem', em: 'pericia', pericia: 'Furtividade' }] };
    a.itens['bastao-vigia'] = { efeitos: [{ alvo: 'vantagem', em: 'pericia', pericia: 'Percepção' }, { alvo: 'vantagem', em: 'iniciativa' }] };
    a.itens['capa-antimagia'] = { efeitos: [{ alvo: 'vantagem', em: 'salvaguarda', contexto: 'contra magias' }] };
    return mudar(a);
  });
}

/** Erros do verificador sobre o lote de passivos, com completude. */
function errosPassivos(mudar) {
  return verificarMecanica(mecPassivos(mudar), lotesPassivos(), CATALOGOS, { completo: true });
}

test('passivos: controle passa', () => {
  assert.deepEqual(errosPassivos(), []);
});

const MUTACOES_PASSIVOS = [
  ['tipo_dano fora da lista', (a) => { a.itens['cajado-quente'].efeitos[0].tipo_dano = 'Fogo'; return a; }, /tipo_dano "Fogo" fora/],
  ['tipo_dano fora do texto', (a) => { a.itens['cajado-quente'].efeitos[0].tipo_dano = 'Gélido'; return a; }, /tipo_dano "Gélido" não aparece/],
  ['resistencia com tipo_dano e escolha', (a) => { a.itens['cajado-quente'].efeitos[0].escolha = ['Ígneo', 'Ácido']; return a; }, /exatamente um entre tipo_dano e escolha/],
  ['escolha com 1 tipo', (a) => { a.itens['anel-variavel'].efeitos[0].escolha = ['Ácido']; return a; }, /escolha precisa de pelo menos 2/],
  ['escolha com tipo fora do texto', (a) => { a.itens['anel-variavel'].efeitos[0].escolha.push('Radiante'); return a; }, /escolha "Radiante" não aparece/],
  ['condicao fora da lista', (a) => { a.itens['livro-bravo'].efeitos[0].condicao = 'Bravo'; return a; }, /condicao "Bravo" fora/],
  ['condicao fora do texto', (a) => { a.itens['livro-bravo'].efeitos[0].condicao = 'Cego'; return a; }, /condicao "Cego" não aparece/],
  ['modo fora da lista', (a) => { a.itens['anel-nadador'].efeitos[0].modo = 'escavacao'; return a; }, /modo "escavacao" fora/],
  ['modo fora do texto', (a) => { a.itens['anel-nadador'].efeitos[0].modo = 'voo'; return a; }, /"Deslocamento de Voo" não aparece/],
  ['metros fora do texto', (a) => { a.itens['anel-nadador'].efeitos[0].metros = 18; return a; }, /metros 18 não aparece/],
  ['metros e igual juntos', (a) => { a.itens['anel-nadador'].efeitos[0].igual_deslocamento = true; return a; }, /exatamente um entre metros e igual_deslocamento/],
  ['igual sem a frase', (a) => { a.itens['anel-nadador'].efeitos[0] = { alvo: 'deslocamento', modo: 'natacao', igual_deslocamento: true }; return a; }, /igual_deslocamento sem "igual ao seu Deslocamento"/],
  ['pairar sem a palavra', (a) => { a.itens['anel-nadador'].efeitos[0].pairar = true; return a; }, /pairar sem "pairar"/],
  ['sentido fora da lista', (a) => { a.itens['oculos-escuros'].efeitos[0].sentido = 'telepatia'; return a; }, /sentido "telepatia" fora/],
  ['sentido fora do texto', (a) => { a.itens['oculos-escuros'].efeitos[0].sentido = 'visao_verdadeira'; return a; }, /"Visão Verdadeira" não aparece/],
  ['imunidade com escolha', (a) => { const ef = a.itens['livro-bravo'].efeitos[2]; delete ef.tipo_dano; ef.escolha = ['Psíquico', 'Psíquico']; return a; }, /imunidade não aceita escolha/],
  ['escolha com tipo fora da lista', (a) => { a.itens['anel-variavel'].efeitos[0].escolha = ['Ácido', 'Gélido', 'Fogo']; return a; }, /escolha "Fogo" fora de/],
  ['soma_se_tiver com metros fora do texto', (a) => { a.itens['oculos-escuros'].efeitos[0].soma_se_tiver = 20; return a; }, /soma_se_tiver 20 não aparece como "20 metros"/],
  ['atributo fora da lista', (a) => { a.itens['capa-antimagia'].efeitos[0].atributo = 'Sorte'; return a; }, /atributo "Sorte" fora de/],
  ['metros zero em minimo', (a) => { a.itens['botas-ligeiras'].efeitos[0].metros = 0; return a; }, /metros 0 inválido/],
  ['metros fracionário em minimo', (a) => { a.itens['botas-ligeiras'].efeitos[0].metros = 1.5; return a; }, /metros 1\.5 inválido/],
  ['sentido sem metros', (a) => { delete a.itens['oculos-escuros'].efeitos[0].metros; return a; }, /metros undefined inválido/],
  ['soma_se_tiver em outro sentido', (a) => { a.itens['oculos-escuros'].efeitos[0] = { alvo: 'sentido', sentido: 'visao_as_cegas', metros: 18, soma_se_tiver: 18 }; return a; }, /soma_se_tiver só vale em visao_no_escuro/],
  ['minimo sem a frase', (a) => { a.itens['anel-nadador'].efeitos.push({ alvo: 'deslocamento_minimo', metros: 12 }); return a; }, /deslocamento_minimo sem "a menos que seu Deslocamento seja maior"/],
  ['alvo novo com valor', (a) => { a.itens['cajado-quente'].efeitos[0].valor = 1; return a; }, /resistencia não aceita "valor"/],
  ['alvo novo com condicao de armadura', (a) => { a.itens['cajado-quente'].efeitos[0].condicao = 'sem_armadura'; return a; }, /resistencia não aceita "condicao"|condicao "sem_armadura" fora/],
  ['vantagem com em fora da lista', (a) => { a.itens['botas-silenciosas'].efeitos[0].em = 'ataque'; return a; }, /em "ataque" fora/],
  ['vantagem em pericia sem pericia', (a) => { delete a.itens['botas-silenciosas'].efeitos[0].pericia; return a; }, /vantagem em pericia exige "pericia"/],
  ['pericia fora da lista', (a) => { a.itens['botas-silenciosas'].efeitos[0].pericia = 'Esgueirar'; return a; }, /pericia "Esgueirar" fora/],
  ['pericia fora do texto', (a) => { a.itens['botas-silenciosas'].efeitos[0].pericia = 'Acrobacia'; return a; }, /pericia "Acrobacia" não aparece/],
  ['pericia em salvaguarda', (a) => { a.itens['capa-antimagia'].efeitos[0].pericia = 'Arcanismo'; return a; }, /"pericia" só vale em em="pericia"/],
  ['atributo fora do texto', (a) => { a.itens['capa-antimagia'].efeitos[0].atributo = 'Força'; return a; }, /atributo "Força" não aparece/],
  ['atributo fora de salvaguarda', (a) => { a.itens['botas-silenciosas'].efeitos[0].atributo = 'Destreza'; return a; }, /"atributo" só vale em em="salvaguarda"/],
  ['iniciativa sem a palavra', (a) => { a.itens['botas-silenciosas'].efeitos.push({ alvo: 'vantagem', em: 'iniciativa' }); return a; }, /iniciativa sem "Iniciativa"/],
  ['salvaguarda sem a palavra', (a) => { a.itens['botas-silenciosas'].efeitos.push({ alvo: 'vantagem', em: 'salvaguarda' }); return a; }, /salvaguarda sem "salvaguarda"/],
  ['contexto fora do texto', (a) => { a.itens['capa-antimagia'].efeitos[0].contexto = 'contra dragões'; return a; }, /contexto "contra dragões" não aparece/],
  ['chave extra em resistencia', (a) => { a.itens['cajado-quente'].efeitos[0].contexo = 'x'; return a; }, /chave desconhecida "contexo"/],
  ['chave extra em imunidade', (a) => { a.itens['livro-bravo'].efeitos[2].escolha = undefined; a.itens['livro-bravo'].efeitos[2].pairar = true; return a; }, /chave desconhecida "pairar"/],
  ['chave extra em imunidade_condicao', (a) => { a.itens['livro-bravo'].efeitos[0].metros = 1; return a; }, /chave desconhecida "metros"/],
  ['chave extra em deslocamento', (a) => { a.itens['anel-nadador'].efeitos[0].igual_deslocameto = true; return a; }, /chave desconhecida "igual_deslocameto"/],
  ['chave extra em deslocamento_minimo', (a) => { a.itens['botas-ligeiras'].efeitos[0].pairar = true; return a; }, /chave desconhecida "pairar"/],
  ['chave extra em sentido', (a) => { a.itens['oculos-escuros'].efeitos[0].soma_se_tivr = 18; return a; }, /chave desconhecida "soma_se_tivr"/],
  ['chave extra em vantagem', (a) => { a.itens['capa-antimagia'].efeitos[0].contxto = 'x'; return a; }, /chave desconhecida "contxto"/],
  ['sem_passivos sem motivo', (a) => { a.sem_passivos = { 'cajado-quente': '' }; return a; }, /sem_passivos\["cajado-quente"\]: sem motivo/],
  ['passivo sem efeito nem sem_passivos', (a) => { delete a.itens['anel-nadador']; a.sem_efeito_automatico.push('anel-nadador'); return a; }, /"anel-nadador" \(lote 01\) tem efeito passivo de defesa, deslocamento, sentido ou vantagem e não tem efeito nem sem_passivos/],
];
for (const [nome, mudar, re] of MUTACOES_PASSIVOS) {
  test(`passivos: mutação "${nome}" avermelha`, () => {
    const e = errosPassivos(mudar);
    assert.ok(e.some((x) => re.test(x)), `nenhum erro casou ${re}: ${JSON.stringify(e)}`);
  });
}

test('passivos: sem_passivos com motivo dispensa a completude', () => {
  const e = errosPassivos((a) => { delete a.itens['anel-nadador']; a.sem_efeito_automatico.push('anel-nadador'); a.sem_passivos = { 'anel-nadador': 'efeito ativado por ação' }; return a; });
  assert.deepEqual(e, []);
});

/** Erros sobre o lote de passivos com o texto de um item alterado (`mudarTexto` recebe a descrição) e a mecânica opcionalmente alterada. */
function errosPassivosTexto(nomeItem, mudarTexto, mudarMec) {
  const lotes = lotesPassivos();
  const item = lotes[0].itens.find((i) => i.nome === nomeItem);
  item.descricao = mudarTexto(item.descricao);
  return verificarMecanica(mecPassivos(mudarMec), lotes, CATALOGOS, { completo: true });
}

// Mutações no texto do item: o defeito está na descrição, não no JSON da mecânica.
const MUTACOES_PASSIVOS_TEXTO = [
  ['soma_se_tiver sem a frase (texto tem Visão no Escuro)', 'Óculos Escuros',
    (d) => d.replace(/ Se você já tiver Visão no Escuro[^.]*\./, ''), undefined,
    /soma_se_tiver sem "Se você já tiver Visão no Escuro" no texto/, /não aparece/],
  ['vantagem sem a palavra Vantagem', 'Botas Silenciosas',
    (d) => d.replace('Vantagem', 'Bônus'), undefined,
    /vantagem sem "Vantagem" no texto/, null],
  ['metros não casa dentro de 112 metros', 'Anel Nadador',
    (d) => d.replace('12 metros', '112 metros'), undefined,
    /metros 12 não aparece como "12 metros"/, null],
  ['soma_se_tiver não casa dentro de 118 metros', 'Óculos Escuros',
    (d) => d.replace(/18 metros/g, '118 metros'), undefined,
    /soma_se_tiver 18 não aparece como "18 metros"/, null],
];
for (const [nome, item, mudarTexto, mudarMec, re, reAusente] of MUTACOES_PASSIVOS_TEXTO) {
  test(`passivos: mutação de texto "${nome}" avermelha`, () => {
    const e = errosPassivosTexto(item, mudarTexto, mudarMec);
    assert.ok(e.some((x) => re.test(x)), `nenhum erro casou ${re}: ${JSON.stringify(e)}`);
    if (reAusente) assert.ok(!e.some((x) => reAusente.test(x)), `erro inesperado ${reAusente}: ${JSON.stringify(e)}`);
  });
}

test('passivos: "metros" em vantagem é chave desconhecida (sem erro de valor de metros)', () => {
  const e = errosPassivos((a) => { a.itens['botas-silenciosas'].efeitos[0].metros = 99; return a; });
  assert.ok(e.some((x) => /chave desconhecida "metros"/.test(x)), JSON.stringify(e));
  assert.ok(!e.some((x) => /metros 99/.test(x)), JSON.stringify(e));
});

test('RE_PASSIVO: frases de passivo casam', () => {
  const positivas = [
    'Você tem Resistência a dano Ígneo.',
    'Você tem Resistência a todo dano.',
    'Você tem Vantagem em testes de Destreza (Furtividade).',
    'Você tem Vantagem nas jogadas de Iniciativa.',
    'Você tem Vantagem nas salvaguardas contra magias.',
    'Você tem Vantagem em qualquer teste de Inteligência.',
    'Você tem Vantagem em todos os testes de Carisma.',
    'Você tem Vantagem nas jogadas de Iniciativa e nos testes de Sabedoria (Percepção).',
    'Você tem Vantagem em Iniciativa.',
    'Você tem Deslocamento de Voo de 9 metros.',
    'Você tem Imunidade à condição Envenenado e a dano Venenoso.',
    'Enquanto o livro estiver com você, você tem Imunidade à condição Exaustão.',
    'Você tem Imunidade às condições Enfeitiçado e Amedrontado.',
    'Você tem Imunidade a dano Ígneo.',
  ];
  for (const t of positivas) assert.ok(RE_PASSIVO.test(t), `não casou: ${t}`);
});

test('RE_PASSIVO: "imune a este efeito" não casa', () => {
  assert.ok(!RE_PASSIVO.test('Uma criatura é imune a este efeito se não tiver cabeça.'));
});

// O contexto é conferido contra o texto sem os asteriscos de itálico.
test('passivos: contexto casa texto com asteriscos de itálico e continua exigindo o trecho', () => {
  const comAsteriscos = (d) => d.replace('contra magias', 'contra *magias*');
  assert.deepEqual(errosPassivosTexto('Capa Antimagia', comAsteriscos), []);
  const e = errosPassivosTexto('Capa Antimagia', comAsteriscos, (a) => { a.itens['capa-antimagia'].efeitos[0].contexto = 'contra dragões'; return a; });
  assert.ok(e.some((x) => /contexto "contra dragões" não aparece/.test(x)), JSON.stringify(e));
});

test('RE_PASSIVO: "Desvantagem em testes de" não casa', () => {
  assert.ok(!RE_PASSIVO.test('Você tem Desvantagem em testes de Destreza (Furtividade).'));
  assert.ok(!RE_PASSIVO.test('Você tem desvantagem nas salvaguardas de Destreza.'));
});

test('magias: cd e ataque não casam como prefixo de outro número', () => {
  const lotes = lotesMagias();
  const manto = lotes[0].itens.find((i) => i.nome === 'Manto Teste');
  manto.descricao += ' Você tem +17 de bônus na jogada de ataque da magia.';
  const eCd = verificarMecanica(mecMagias((a) => { a.itens['manto-teste'].magias[0].conjuracao = { cd: 1 }; return a; }), lotes, CATALOGOS_MAGIAS, { completo: true });
  assert.ok(eCd.some((x) => /cd 1 não aparece como "CD 1"/.test(x)), JSON.stringify(eCd));
  const eAt = verificarMecanica(mecMagias((a) => { a.itens['manto-teste'].magias[0].conjuracao = { ataque: 1 }; return a; }), lotes, CATALOGOS_MAGIAS, { completo: true });
  assert.ok(eAt.some((x) => /ataque 1 não aparece como "\+1"/.test(x)), JSON.stringify(eAt));
});

// ------------------------------------------------------------
// Aumento de atributo até um máximo (atributo_bonus, atributo_minimo_bonus, aumento_permanente)
// ------------------------------------------------------------

/** Lote mínimo com aumentos: pedra passiva, manual permanente, livro com escolha e redução, martelo sobre o cinturão. */
function lotesAumento() {
  const l = lotesFixos();
  l[0].itens.push(
    { nome: 'Pedra Robusta', linha_tipo: 'Item Maravilhoso, Raro', tabelas: [], variantes: [], descricao: 'Sua Constituição aumenta em 2, até um máximo de 20, enquanto esta pedra orbita sua cabeça.' },
    { nome: 'Manual Forte', linha_tipo: 'Item Maravilhoso, Muito Raro', tabelas: [], variantes: [], descricao: 'Se você passar 48 horas estudando o livro, sua Força aumenta em 2, até um máximo de 30.' },
    { nome: 'Livro Sombrio', linha_tipo: 'Item Maravilhoso, Artefato', tabelas: [], variantes: [], descricao: 'Um valor de atributo à sua escolha aumenta em 2, até um máximo de 24. Outro valor de atributo à sua escolha diminui em 2, até um mínimo de 3.' },
    { nome: 'Martelo Teste', linha_tipo: 'Arma (Malho), Lendária', tabelas: [], variantes: [], descricao: 'O valor de Força concedido pelo seu *Cinturão de Força do Gigante* aumenta em 4, até um máximo de 30.' },
  );
  return l;
}

/** Mecânica válida para lotesAumento; `mudar` altera o arquivo antes da checagem. */
function mecAumento(mudar = (a) => a) {
  return mecCom((a) => {
    a.itens['pedra-robusta'] = { efeitos: [{ alvo: 'atributo_bonus', atributo: 'constituicao', valor: 2, maximo: 20 }] };
    a.itens['manual-forte'] = { efeitos: [], aumento_permanente: { atributo: 'forca', valor: 2, maximo: 30 } };
    a.itens['livro-sombrio'] = { efeitos: [], aumento_permanente: { atributo: 'escolha', valor: 2, maximo: 24, reducao: { valor: 2, minimo: 3 } } };
    a.itens['martelo-teste'] = { efeitos: [{ alvo: 'atributo_minimo_bonus', atributo: 'forca', valor: 4, maximo: 30 }] };
    return mudar(a);
  });
}

/** Erros do verificador sobre o lote de aumentos, com completude. */
function errosAumento(mudar) {
  return verificarMecanica(mecAumento(mudar), lotesAumento(), CATALOGOS, { completo: true });
}

test('aumento: controle passa', () => {
  assert.deepEqual(errosAumento(), []);
});

const MUTACOES_AUMENTO = [
  ['atributo fora da lista', (a) => { a.itens['pedra-robusta'].efeitos[0].atributo = 'vigor'; return a; }, /atributo "vigor" fora/],
  ['atributo fora do texto', (a) => { a.itens['pedra-robusta'].efeitos[0].atributo = 'forca'; return a; }, /atributo "forca" \(Força\) não aparece/],
  ['valor fora do texto', (a) => { a.itens['pedra-robusta'].efeitos[0].valor = 3; return a; }, /"aumenta em 3" não aparece/],
  ['valor fora da faixa', (a) => { a.itens['pedra-robusta'].efeitos[0].valor = 5; return a; }, /valor 5 fora de 1\.\.4/],
  ['maximo fora do texto', (a) => { a.itens['pedra-robusta'].efeitos[0].maximo = 22; return a; }, /"máximo de 22" não aparece/],
  ['maximo fora da faixa', (a) => { a.itens['pedra-robusta'].efeitos[0].maximo = 18; return a; }, /maximo 18 fora de 20\.\.30/],
  ['chave desconhecida no efeito', (a) => { a.itens['pedra-robusta'].efeitos[0].extra = 1; return a; }, /chave desconhecida "extra"/],
  ['escolha em efeito passivo', (a) => { a.itens['pedra-robusta'].efeitos[0].atributo = 'escolha'; return a; }, /"escolha" só vale em aumento_permanente/],
  ['escolha sem "à sua escolha"', (a) => { a.itens['manual-forte'].aumento_permanente.atributo = 'escolha'; return a; }, /escolha sem "à sua escolha"/],
  ['reducao sem a frase', (a) => { a.itens['manual-forte'].aumento_permanente.reducao = { valor: 2, minimo: 3 }; return a; }, /reducao sem "diminui em 2"/],
  ['reducao minimo fora do texto', (a) => { a.itens['livro-sombrio'].aumento_permanente.reducao.minimo = 4; return a; }, /"mínimo de 4" não aparece/],
  ['chave desconhecida em aumento_permanente', (a) => { a.itens['manual-forte'].aumento_permanente.extra = 1; return a; }, /aumento_permanente: chave desconhecida "extra"/],
  ['aumento_permanente que não é objeto', (a) => { a.itens['manual-forte'].aumento_permanente = 2; return a; }, /aumento_permanente tem de ser objeto/],
  ['minimo_bonus sem o nome do item-base', (a) => { a.itens['pedra-robusta'].efeitos.push({ alvo: 'atributo_minimo_bonus', atributo: 'constituicao', valor: 2, maximo: 20 }); return a; }, /atributo_minimo_bonus exige "Cinturão de Força do Gigante" ou "Manoplas de Poder do Ogro"/],
  ['sem_aumento sem motivo', (a) => { a.sem_aumento = { 'pedra-robusta': '' }; return a; }, /sem_aumento\["pedra-robusta"\]: sem motivo/],
  ['valor zero', (a) => { a.itens['pedra-robusta'].efeitos[0].valor = 0; return a; }, /valor 0 fora de 1\.\.4/],
  ['maximo acima de 30', (a) => { a.itens['pedra-robusta'].efeitos[0].maximo = 40; return a; }, /maximo 40 fora de 20\.\.30/],
  ['maximo fracionário', (a) => { a.itens['pedra-robusta'].efeitos[0].maximo = 25.5; return a; }, /maximo 25\.5 fora de 20\.\.30/],
  ['maximo abaixo de 20', (a) => { a.itens['pedra-robusta'].efeitos[0].maximo = 19; return a; }, /maximo 19 fora de 20\.\.30/],
  ['reducao.valor zero', (a) => { a.itens['livro-sombrio'].aumento_permanente.reducao.valor = 0; return a; }, /reducao\.valor 0 fora de 1\.\.4/],
  ['reducao.valor 5', (a) => { a.itens['livro-sombrio'].aumento_permanente.reducao.valor = 5; return a; }, /reducao\.valor 5 fora de 1\.\.4/],
  ['reducao.valor fracionário', (a) => { a.itens['livro-sombrio'].aumento_permanente.reducao.valor = 1.5; return a; }, /reducao\.valor 1\.5 fora de 1\.\.4/],
  ['reducao.minimo zero', (a) => { a.itens['livro-sombrio'].aumento_permanente.reducao.minimo = 0; return a; }, /reducao\.minimo 0 fora de 1\.\.10/],
  ['reducao.minimo 11', (a) => { a.itens['livro-sombrio'].aumento_permanente.reducao.minimo = 11; return a; }, /reducao\.minimo 11 fora de 1\.\.10/],
  ['reducao.minimo fracionário', (a) => { a.itens['livro-sombrio'].aumento_permanente.reducao.minimo = 2.5; return a; }, /reducao\.minimo 2\.5 fora de 1\.\.10/],
  ['reducao null', (a) => { a.itens['livro-sombrio'].aumento_permanente.reducao = null; return a; }, /reducao tem de ser objeto/],
  ['reducao que não é objeto', (a) => { a.itens['livro-sombrio'].aumento_permanente.reducao = 2; return a; }, /reducao tem de ser objeto/],
  ['chave desconhecida em reducao', (a) => { a.itens['livro-sombrio'].aumento_permanente.reducao.extra = 1; return a; }, /reducao: chave desconhecida "extra"/],
  ['aumento sem efeito nem sem_aumento', (a) => { delete a.itens['manual-forte']; a.sem_efeito_automatico.push('manual-forte'); return a; }, /"manual-forte" \(lote 01\) aumenta um atributo até um máximo e não tem atributo_bonus, atributo_minimo_bonus, aumento_permanente nem sem_aumento/],
];
for (const [nome, mudar, re] of MUTACOES_AUMENTO) {
  test(`aumento: mutação "${nome}" avermelha`, () => {
    const e = errosAumento(mudar);
    assert.ok(e.some((x) => re.test(x)), `nenhum erro casou ${re}: ${JSON.stringify(e)}`);
  });
}

test('aumento: sem_aumento com motivo dispensa a completude', () => {
  const e = errosAumento((a) => { delete a.itens['manual-forte']; a.sem_efeito_automatico.push('manual-forte'); a.sem_aumento = { 'manual-forte': 'teste' }; return a; });
  assert.deepEqual(e, []);
});

/** Erros sobre o lote de aumentos com a descrição de um item alterada e a mecânica opcionalmente alterada. */
function errosAumentoTexto(nomeItem, mudarTexto, mudarMec) {
  const lotes = lotesAumento();
  const item = lotes[0].itens.find((i) => i.nome === nomeItem);
  item.descricao = mudarTexto(item.descricao);
  return verificarMecanica(mecAumento(mudarMec), lotes, CATALOGOS, { completo: true });
}

// Fronteiras numéricas: o número declarado não casa como prefixo de outro número do texto.
const MUTACOES_AUMENTO_TEXTO = [
  ['valor 2 não casa em "aumenta em 20"', 'Pedra Robusta', (d) => d.replace('aumenta em 2,', 'aumenta em 20,'), undefined, /"aumenta em 2" não aparece/],
  ['maximo 24 não casa em "máximo de 240"', 'Livro Sombrio', (d) => d.replace('máximo de 24', 'máximo de 240'), undefined, /"máximo de 24" não aparece/],
  ['reducao.valor 2 não casa em "diminui em 20"', 'Livro Sombrio', (d) => d.replace('diminui em 2', 'diminui em 20'), undefined, /reducao sem "diminui em 2"/],
  ['reducao.minimo 3 não casa em "mínimo de 30"', 'Livro Sombrio', (d) => d.replace('mínimo de 3', 'mínimo de 30'), undefined, /"mínimo de 3" não aparece/],
];
for (const [nome, item, mudarTexto, mudarMec, re] of MUTACOES_AUMENTO_TEXTO) {
  test(`aumento: fronteira "${nome}" avermelha`, () => {
    const e = errosAumentoTexto(item, mudarTexto, mudarMec);
    assert.ok(e.some((x) => re.test(x)), `nenhum erro casou ${re}: ${JSON.stringify(e)}`);
  });
}

/** Lote de aumentos com um item-pai (texto de aumento) e uma variante, ambos sem efeito automático por padrão. */
function lotesAumentoComVariante() {
  const l = lotesAumento();
  l[0].itens.push({ nome: 'Pilar Teste', linha_tipo: 'Item Maravilhoso, Raro', tabelas: [], descricao: 'Sua Sabedoria aumenta em 2, até um máximo de 22.', variantes: [{ nome: 'Pilar Teste Menor', raridade: 'Incomum' }] });
  return l;
}

/** Erros do lote com variante; `mudar` altera a mecânica (pai e variante entram em sem_efeito_automatico). */
function errosAumentoVariante(mudar) {
  const mec = mecAumento((a) => { a.sem_efeito_automatico.push('pilar-teste', 'pilar-teste-menor'); return mudar(a); });
  return verificarMecanica(mec, lotesAumentoComVariante(), CATALOGOS, { completo: true });
}

test('aumento: variante sem nada no pai avermelha', () => {
  const e = errosAumentoVariante((a) => a);
  assert.ok(e.some((x) => /"pilar-teste-menor" \(lote 01\) aumenta um atributo/.test(x)), JSON.stringify(e));
});

test('aumento: aumento_permanente no pai cobre a variante', () => {
  const e = errosAumentoVariante((a) => { a.sem_efeito_automatico = a.sem_efeito_automatico.filter((x) => x !== 'pilar-teste'); a.itens['pilar-teste'] = { efeitos: [], aumento_permanente: { atributo: 'sabedoria', valor: 2, maximo: 22 } }; return a; });
  assert.deepEqual(e, []);
});

test('aumento: sem_aumento no pai cobre a variante', () => {
  const e = errosAumentoVariante((a) => { a.sem_aumento = { 'pilar-teste': 'teste' }; return a; });
  assert.deepEqual(e, []);
});

test('RE_AUMENTO_TETO: frases de aumento com teto casam', () => {
  const positivas = [
    'Sua Constituição aumenta em 2, até um máximo de 20.',
    'Um valor de atributo à sua escolha aumenta em 2, até um máximo de 24.',
    'Você pode aumentar um dos seus valores de atributo em 2, até um máximo de 22.',
    'Aumente um dos seus valores de atributo em 2, até um máximo de 24.',
  ];
  for (const t of positivas) assert.ok(RE_AUMENTO_TETO.test(t), `não casou: ${t}`);
});

test('RE_AUMENTO_TETO: aumento da Emanação não casa', () => {
  assert.ok(!RE_AUMENTO_TETO.test('o tamanho da Emanação aumenta em 3 metros, até atingir seu tamanho máximo'));
});

test('montar leva aumento_permanente ao item e às variantes (null quando não há)', () => {
  const { itens } = montar(carregarLotes(), { 'manual-do-exercicio-proveitoso': { efeitos: [], aumento_permanente: { atributo: 'forca', valor: 2, maximo: 30 } } }, carregarCatalogos().magias).itens_magicos;
  assert.deepEqual(itens.find((i) => i.id === 'manual-do-exercicio-proveitoso').aumento_permanente, { atributo: 'forca', valor: 2, maximo: 30 });
  assert.equal(itens.find((i) => i.id !== 'manual-do-exercicio-proveitoso').aumento_permanente, null);
  for (const v of itens.flatMap((i) => i.variantes)) assert.ok('aumento_permanente' in v, `variante ${v.id} sem aumento_permanente`);
});

// ------------------------------------------------------------
// Plano 8, Task 1: fronteira numérica e de palavra, listas vazias, magia não nomeada
// e lacunas de mutação dos Planos 1, 4, 5, 6 e 7
// ------------------------------------------------------------

/** Erros do lote de magias com a descrição de um item alterada e a mecânica opcionalmente alterada. */
function errosMagiasTexto(nomeItem, mudarTexto, mudarMec) {
  const lotes = lotesMagias();
  const item = lotes[0].itens.find((i) => i.nome === nomeItem);
  item.descricao = mudarTexto(item.descricao);
  return verificarMecanica(mecMagias(mudarMec), lotes, CATALOGOS_MAGIAS, { completo: true });
}

// 1.1: número real não é parte de decimal ("1,5"), de dado ("2d6") nem de "0,9 metro".
const FRONTEIRAS_NUMERO = [
  ['valor 1 não casa em "1,5"', () => errosAnelTexto('Você recebe 1,5 de bônus.', 1), /valor 1 não aparece/],
  ['valor 1 não casa em "1d6"', () => errosAnelTexto('Você recebe 1d6 de bônus.', 1), /valor 1 não aparece/],
  ['valor 2 não casa em "2d6"', () => errosAnelTexto('Você recebe 2d6 de bônus.', 2), /valor 2 não aparece/],
  ['valor 5 não casa em "1,5" (depois da vírgula)', () => errosAnelTexto('Você recebe 1,5 de bônus.', 5), /valor 5 não aparece/],
  ['cargas 0 não casa em "0,9 metro"', () => errosMagiasTexto('Varinha de Fogo Teste', (d) => `${d} A esfera tem 0,9 metro.`, (a) => { a.itens['varinha-de-fogo-teste'].magias[0].custo = { cargas: 0 }; return a; }), /cargas 0 não aparece/],
  ['cargas.max 1 não casa em "1,5 metro"', () => {
    const l = lotesRecursos();
    l[0].itens.find((i) => i.nome === 'Pedra Neutra').descricao = 'Uma pedra de 1,5 metro.';
    const mec = mecRecursos((a) => comUsoNaPedra(a, 'amanhecer'));
    mec.arquivos[0].itens['pedra-neutra'] = { efeitos: [], recursos: { cargas: { max: 1, recupera: null, ultima_carga: null } } };
    return verificarMecanica(mec, l, CATALOGOS, { completo: false });
  }, /cargas\.max 1 não aparece/],
  ['metros 5 não casam em "1,5 metros"', () => errosPassivosTexto('Anel Nadador', (d) => d.replace('12 metros', '1,5 metros'), (a) => { a.itens['anel-nadador'].efeitos[0].metros = 5; return a; }), /metros 5 não aparece/],
];
/** Erros do anel de teste com a descrição trocada e o valor dos dois efeitos ajustado. */
function errosAnelTexto(descricao, valor) {
  const lotes = lotesFixos();
  lotes[0].itens[0].descricao = descricao;
  lotes[0].itens[0].linha_tipo = 'Anel, Raro';
  const mec = mecCom((a) => { for (const ef of a.itens['anel-de-teste'].efeitos) ef.valor = valor; return a; });
  return verificarMecanica(mec, lotes, CATALOGOS, { completo: true });
}
for (const [nome, rodar, re] of FRONTEIRAS_NUMERO) {
  test(`fronteira numérica "${nome}" avermelha`, () => {
    const e = rodar();
    assert.ok(e.some((x) => re.test(x)), `nenhum erro casou ${re}: ${JSON.stringify(e)}`);
  });
}

test('fronteira numérica: número isolado em frase com vírgula e dado ainda casa', () => {
  assert.deepEqual(errosAnelTexto('Você recebe +1, e também 2, 3 e 1d6 + 1 de bônus.', 1), []);
  assert.deepEqual(errosAnelTexto('Você recebe 2, 3 e 4 de bônus (2).', 2), []);
});

// 1.2: cargas.recupera inteiro tem de aparecer no texto.
test('recursos: recupera inteiro ausente do texto avermelha', () => {
  const e = errosRecursos((a) => { a.itens['varinha-de-teste'].recursos.cargas.recupera = 4; return a; });
  assert.ok(e.some((x) => /cargas\.recupera 4 não aparece no texto/.test(x)), JSON.stringify(e));
});

test('recursos: recupera inteiro presente no texto passa', () => {
  const l = lotesRecursos();
  l[0].itens.find((i) => i.nome === 'Varinha de Teste').descricao = 'Esta varinha tem 7 cargas. A varinha recupera 2 cargas gastas ao amanhecer.';
  const mec = mecRecursos((a) => { a.itens['varinha-de-teste'].recursos.cargas = { max: 7, recupera: 2, ultima_carga: null }; return a; });
  assert.deepEqual(verificarMecanica(mec, l, CATALOGOS, { completo: true }), []);
});

// 1.3: tipo, condição, perícia e atributo precisam ser palavra inteira no texto.
const FRONTEIRAS_PALAVRA = [
  ['tipo_dano em "Ígneos"', () => errosPassivosTexto('Cajado Quente', (d) => d.replace('Ígneo', 'Ígneos')), /tipo_dano "Ígneo" não aparece/],
  ['escolha em "Ácidos"', () => {
    const lotes = lotesPassivos();
    const anel = lotes[0].itens.find((i) => i.nome === 'Anel Variável');
    anel.tabelas[0].dados[0][1] = 'Ácidos';
    return verificarMecanica(mecPassivos(), lotes, CATALOGOS, { completo: true });
  }, /escolha "Ácido" não aparece/],
  ['condicao Cego em "Cegos"', () => errosPassivosTexto('Livro Bravo', (d) => `${d} Criaturas Cegos não contam.`, (a) => { a.itens['livro-bravo'].efeitos[0].condicao = 'Cego'; return a; }), /condicao "Cego" não aparece/],
  ['condicao Surdo em "Surdos"', () => errosPassivosTexto('Livro Bravo', (d) => `${d} Ouvidos Surdos não contam.`, (a) => { a.itens['livro-bravo'].efeitos[0].condicao = 'Surdo'; return a; }), /condicao "Surdo" não aparece/],
  ['condicao Enfeitiçado em "Enfeitiçados"', () => errosPassivosTexto('Livro Bravo', (d) => d.replace('Enfeitiçado', 'Enfeitiçados')), /condicao "Enfeitiçado" não aparece/],
  ['pericia em "Furtividades"', () => errosPassivosTexto('Botas Silenciosas', (d) => d.replace('Furtividade', 'Furtividades')), /pericia "Furtividade" não aparece/],
  ['atributo de salvaguarda em "Destrezas"', () => errosPassivosTexto('Capa Antimagia', (d) => `${d} Salvaguardas de Destrezas.`, (a) => { a.itens['capa-antimagia'].efeitos[0].atributo = 'Destreza'; return a; }), /atributo "Destreza" não aparece/],
  ['atributo de aumento em "Constituiçãozinha"', () => errosAumentoTexto('Pedra Robusta', (d) => d.replace('Constituição', 'Constituiçãozinha')), /atributo "constituicao" \(Constituição\) não aparece/],
  ['sentido em "Visão no Escuros"', () => errosPassivosTexto('Óculos Escuros', (d) => d.replace(/Visão no Escuro/g, 'Visão no Escuros')), /"Visão no Escuro" não aparece/],
];
for (const [nome, rodar, re] of FRONTEIRAS_PALAVRA) {
  test(`fronteira de palavra "${nome}" avermelha`, () => {
    const e = rodar();
    assert.ok(e.some((x) => re.test(x)), `nenhum erro casou ${re}: ${JSON.stringify(e)}`);
  });
}

test('fronteira de palavra: termo seguido de pontuação ou parênteses ainda casa', () => {
  assert.deepEqual(errosPassivosTexto('Botas Silenciosas', (d) => d.replace('(Furtividade).', '(Furtividade), (Furtividade)!')), []);
  assert.deepEqual(errosPassivosTexto('Livro Bravo', (d) => d.replace('Imunidade às condições Enfeitiçado e', 'Imunidade às condições (Enfeitiçado) e')), []);
});

// 1.4: lista vazia de magias não classifica o registro.
test('magias: entrada só com magias vazias exige sem_efeito_automatico', () => {
  const e = errosMagias((a) => { a.itens['bastao-livre-teste'].magias = []; return a; });
  assert.ok(e.some((x) => /itens\["bastao-livre-teste"\]: sem efeitos, sem base, sem recursos e sem magias/.test(x)), JSON.stringify(e));
});

test('magias: magias vazias não cumprem a completude de magias', () => {
  const e = errosMagias((a) => { a.itens['bastao-livre-teste'] = { efeitos: [{ alvo: 'ca', valor: 1 }], magias: [] }; return a; });
  assert.ok(e.some((x) => /"bastao-livre-teste" \(lote 01\) conjura magia do Livro do Jogador e não tem magias nem sem_magias/.test(x)), JSON.stringify(e));
});

// 1.5: magia não nomeada (Magia Desconhecida, magia vinculada, à sua escolha) exige sem_magias.
/** Lote de magias com um item cujo texto fala de magia não nomeada e uma variante dele. */
function lotesMagiaNaoNomeada(frase) {
  const l = lotesMagias();
  l[0].itens.push({ nome: 'Chapéu Misterioso', linha_tipo: 'Item Maravilhoso, Raro', tabelas: [], descricao: frase,
    variantes: [{ nome: 'Chapéu Misterioso Maior', raridade: 'Muito Raro' }] });
  return l;
}
/** Erros do lote de magia não nomeada; `mudar` altera a mecânica (o chapéu e a variante entram em sem_efeito_automatico). */
function errosMagiaNaoNomeada(frase, mudar = (a) => a) {
  const mec = mecMagias((a) => { a.sem_efeito_automatico.push('chapeu-misterioso', 'chapeu-misterioso-maior'); return mudar(a); });
  return verificarMecanica(mec, lotesMagiaNaoNomeada(frase), CATALOGOS_MAGIAS, { completo: true });
}
const FRASES_MAGIA_NAO_NOMEADA = [
  '***Magia Desconhecida.*** Você pode tentar conjurar um truque que não conhece.',
  'Há uma magia de 8º círculo ou inferior vinculada a este cajado.',
  'Você pode conjurar uma magia à sua escolha de 3º círculo.',
  'Você conjura a magia escolhida na criação do item.',
];
for (const frase of FRASES_MAGIA_NAO_NOMEADA) {
  test(`magias: "${frase.slice(0, 40)}" sem sem_magias avermelha`, () => {
    const e = errosMagiaNaoNomeada(frase);
    assert.ok(e.some((x) => /"chapeu-misterioso" \(lote 01\) cita magia não nomeada e não tem sem_magias/.test(x)), JSON.stringify(e));
  });
}

test('magias: magia não nomeada com sem_magias no pai passa e cobre a variante', () => {
  const e = errosMagiaNaoNomeada(FRASES_MAGIA_NAO_NOMEADA[0], (a) => { a.sem_magias = { 'chapeu-misterioso': 'truque escolhido na hora' }; return a; });
  assert.deepEqual(e, []);
});

test('magias: magia não nomeada com sem_magias sem motivo avermelha', () => {
  const e = errosMagiaNaoNomeada(FRASES_MAGIA_NAO_NOMEADA[0], (a) => { a.sem_magias = { 'chapeu-misterioso': '' }; return a; });
  assert.ok(e.some((x) => /sem_magias\["chapeu-misterioso"\]: sem motivo/.test(x)), JSON.stringify(e));
});

test('magias: magias próprias não dispensam sem_magias quando o texto cita magia não nomeada', () => {
  const frase = 'Você pode conjurar *Detectar Magia* e também uma magia à sua escolha de 3º círculo.';
  const e = errosMagiaNaoNomeada(frase, (a) => {
    a.sem_efeito_automatico = a.sem_efeito_automatico.filter((id) => id !== 'chapeu-misterioso');
    a.itens['chapeu-misterioso'] = { efeitos: [], magias: [{ nome: 'Detectar Magia', custo: 'livre', conjuracao: null }] };
    return a;
  });
  assert.ok(e.some((x) => /"chapeu-misterioso" \(lote 01\) cita magia não nomeada e não tem sem_magias/.test(x)), JSON.stringify(e));
});

// 1.6: lacunas de mutação.
const MUTACOES_LACUNAS = [
  ['atributo sem a chave', (a) => { a.itens['anel-de-teste'].efeitos = [{ alvo: 'atributo', minimo: 19 }]; return a; }, /atributo "undefined" fora de/],
  ['atributo sem minimo', (a) => { a.itens['anel-de-teste'].efeitos = [{ alvo: 'atributo', atributo: 'forca' }]; return a; }, /minimo undefined fora de/],
];
for (const [nome, mudar, re] of MUTACOES_LACUNAS) {
  test(`lacuna: mutação "${nome}" avermelha`, () => {
    const e = erros(mudar);
    assert.ok(e.some((x) => re.test(x)), `nenhum erro casou ${re}: ${JSON.stringify(e)}`);
  });
}

const MUTACOES_LACUNAS_MAGIAS = [
  ['magia string', (a) => { a.itens['manto-teste'].magias = ['Teia']; return a; }, /magia tem de ser objeto/],
  ['magia null', (a) => { a.itens['manto-teste'].magias = [null]; return a; }, /magia tem de ser objeto/],
  ['magia lista', (a) => { a.itens['manto-teste'].magias = [[]]; return a; }, /magia tem de ser objeto/],
  ['conjuracao string diferente de "sua"', (a) => { a.itens['manto-teste'].magias[0].conjuracao = 'cd'; return a; }, /conjuracao inválida/],
  ['conjuracao lista', (a) => { a.itens['manto-teste'].magias[0].conjuracao = []; return a; }, /conjuracao inválida/],
  ['custo cargas negativo', (a) => { a.itens['cajado-sua-cd'].magias[1].custo = { cargas: -1 }; return a; }, /custo inválido/],
  ['custo cargas fracionário', (a) => { a.itens['cajado-sua-cd'].magias[1].custo = { cargas: 1.5 }; return a; }, /custo inválido/],
  ['custo cargas string', (a) => { a.itens['cajado-sua-cd'].magias[1].custo = { cargas: '1' }; return a; }, /custo inválido/],
  ['chave extra em custo uso', (a) => { a.itens['manto-teste'].magias[0].custo.extra = 1; return a; }, /custo: chave desconhecida "extra"/],
  ['chave extra em custo cargas', (a) => { a.itens['cajado-sua-cd'].magias[1].custo.extra = 1; return a; }, /custo: chave desconhecida "extra"/],
  ['chave extra em conjuracao', (a) => { a.itens['manto-teste'].magias[0].conjuracao.extra = 1; return a; }, /conjuracao: chave desconhecida "extra"/],
];
for (const [nome, mudar, re] of MUTACOES_LACUNAS_MAGIAS) {
  test(`lacuna magias: mutação "${nome}" avermelha`, () => {
    const e = errosMagias(mudar);
    assert.ok(e.some((x) => re.test(x)), `nenhum erro casou ${re}: ${JSON.stringify(e)}`);
  });
}

/** Ids de outro lote em cada lista de classificação do arquivo do lote 01. */
const OUTRO_LOTE = [
  ['itens', (a) => { a.itens['item-dois'] = { efeitos: [{ alvo: 'ca', valor: 1 }] }; return a; }],
  ['sem_efeito_automatico', (a) => { a.sem_efeito_automatico.push('item-dois'); return a; }],
  ['sem_cargas', (a) => { a.sem_cargas = { 'item-dois': 'motivo' }; return a; }],
  ['sem_magias', (a) => { a.sem_magias = { 'item-dois': 'motivo' }; return a; }],
  ['sem_passivos', (a) => { a.sem_passivos = { 'item-dois': 'motivo' }; return a; }],
  ['sem_aumento', (a) => { a.sem_aumento = { 'item-dois': 'motivo' }; return a; }],
];
for (const [lista, mudar] of OUTRO_LOTE) {
  test(`id de outro lote em ${lista} avermelha`, () => {
    const lotes = lotesFixos();
    lotes.push({ lote: '02', tipo: 'itens', paginas_pdf: [239, 240], itens: [
      { nome: 'Item Dois', linha_tipo: 'Anel, Raro', descricao: 'Você recebe +1 de bônus na Classe de Armadura.', tabelas: [], variantes: [] },
    ] });
    const e = verificarMecanica(mecCom(mudar), lotes, CATALOGOS, { completo: false });
    assert.ok(e.some((x) => /"item-dois" não é registro do lote 01 \(é do 02\)/.test(x)), JSON.stringify(e));
  });
}

/** Lote com um anel de cargas (pai) e uma variante que conjura magia: herança de recursos e de magias do pai. */
function lotesHerancaPai() {
  const l = lotesFixos();
  l[0].itens.push({ nome: 'Anel Elemental Teste', linha_tipo: 'Anel, Raro', tabelas: [],
    descricao: 'Este anel tem 5 cargas e recupera 1d4 cargas gastas ao amanhecer. Você pode conjurar *Detectar Magia* gastando 1 carga.',
    variantes: [{ nome: 'Anel Elemental Teste Ar', raridade: 'Raro' }] });
  return l;
}
/** Erros do lote de herança; `mudar` altera a mecânica (pai com recursos e sem_magias, variante com magias próprias). */
function errosHerancaPai(mudar = (a) => a) {
  const mec = mecCom((a) => {
    a.itens['anel-elemental-teste'] = { efeitos: [], recursos: { cargas: { max: 5, recupera: '1d4', ultima_carga: null } } };
    a.itens['anel-elemental-teste-ar'] = { efeitos: [], magias: [{ nome: 'Detectar Magia', custo: { cargas: 1 }, conjuracao: null }] };
    a.sem_magias = { 'anel-elemental-teste': 'as magias ficam na variante' };
    return mudar(a);
  });
  return verificarMecanica(mec, lotesHerancaPai(), CATALOGOS_MAGIAS, { completo: true });
}

test('herança: variante com magias próprias e pai com recursos passa', () => {
  assert.deepEqual(errosHerancaPai(), []);
});

test('herança: o custo da variante é conferido contra os recursos do pai', () => {
  const e = errosHerancaPai((a) => { a.itens['anel-elemental-teste-ar'].magias[0].custo = { cargas: 6 }; return a; });
  assert.ok(e.some((x) => /cargas 6 acima do máximo 5/.test(x)), JSON.stringify(e));
});

test('herança: custo em cargas na variante sem recursos no pai avermelha', () => {
  const e = errosHerancaPai((a) => { delete a.itens['anel-elemental-teste'].recursos; a.sem_cargas = { 'anel-elemental-teste': 'motivo' }; return a; });
  assert.ok(e.some((x) => /custo em cargas sem recursos\.cargas/.test(x)), JSON.stringify(e));
});

test('herança: sem magias próprias, o sem_magias do pai cobre a variante; sem ele, o pai acusa', () => {
  const coberta = errosHerancaPai((a) => { a.itens['anel-elemental-teste-ar'] = { efeitos: [{ alvo: 'ca', valor: 1 }] }; return a; });
  assert.deepEqual(coberta, []);
  const e = errosHerancaPai((a) => { delete a.sem_magias; return a; });
  assert.ok(e.some((x) => /"anel-elemental-teste" \(lote 01\) conjura magia do Livro do Jogador e não tem magias nem sem_magias/.test(x)), JSON.stringify(e));
});

// 1.7: o texto da variante é o do pai mais o nome dela; o nome da variante entra na conferência dos números.
test('variante: o nome da variante conta como texto do registro', () => {
  const l = lotesFixos();
  const filha = registrosDosLotes(l).find((r) => r.id === 'arma-teste-mais-2');
  assert.ok(filha.texto.endsWith('\nArma Teste +2'), JSON.stringify(filha.texto.slice(-30)));
});

// Custo livre em item com cargas: só vale quando a descrição cita a magia sem custo, antes de qualquer menção a carga.
const DESC_LIVRE = 'Você pode conjurar *Detectar Magia* a partir do anel. O anel tem 6 cargas e recupera 1d6 cargas gastas ao amanhecer.';

/** Erros do lote com um anel de cargas cuja magia é livre; `descricao` e `celulas` (tabela opcional) definem o texto. */
function errosLivre(descricao, celulas = null) {
  const l = lotesFixos();
  l[0].itens.push({ nome: 'Anel Livre Teste', linha_tipo: 'Anel, Raro', descricao, variantes: [],
    tabelas: celulas ? [{ titulo: '', cabecalhos: ['Magia', 'Custo'], dados: [celulas] }] : [] });
  const mec = mecCom((a) => {
    a.itens['anel-livre-teste'] = { efeitos: [], recursos: { cargas: { max: 6, recupera: '1d6', ultima_carga: null } },
      magias: [{ nome: 'Detectar Magia', custo: 'livre', conjuracao: null }] };
    return a;
  });
  return verificarMecanica(mec, l, CATALOGOS_MAGIAS, { completo: true });
}
const RE_LIVRE = /magia "Detectar Magia": custo "livre" em item com cargas/;

test('livre: frase da descrição sem carga, antes de qualquer menção a carga, passa', () => {
  assert.deepEqual(errosLivre(DESC_LIVRE), []);
});

// Cada caso avermelha só pela condição de `frasesDaMagiaSemCarga` que ele isola.
const CASOS_LIVRE = [
  ['uma frase com carga e outra sem para a mesma magia (every)', `${DESC_LIVRE} Gastar 1 carga permite conjurar *Detectar Magia* de novo.`, null],
  ['magia sem frase alguma na descrição (frases.length)', 'O anel tem 6 cargas e recupera 1d6 cargas gastas ao amanhecer.', null],
  ['magia fora de itálico', 'Você pode conjurar Detectar Magia a partir do anel. O anel tem 6 cargas e recupera 1d6 cargas gastas ao amanhecer.', null],
  ['magia em célula de tabela de custo', DESC_LIVRE, ['*Detectar Magia*', '1']],
  ['citação depois de uma frase com carga', 'O anel tem 6 cargas e recupera 1d6 cargas gastas ao amanhecer. Você pode conjurar *Detectar Magia* a partir do anel.', null],
];
for (const [nome, descricao, celulas] of CASOS_LIVRE) {
  test(`livre: ${nome} avermelha`, () => {
    const e = errosLivre(descricao, celulas);
    assert.ok(e.some((x) => RE_LIVRE.test(x)), JSON.stringify(e));
  });
}

test('livre: texto com "0 carga" ou "sem gastar" continua valendo', () => {
  assert.ok(!errosLivre('Você pode conjurar *Detectar Magia* (0 carga) a partir do anel. O anel tem 6 cargas e recupera 1d6 cargas gastas ao amanhecer.', ['x', 'y']).some((x) => RE_LIVRE.test(x)));
});

// M1: base escudo recusa cada chave sozinha.
for (const [chave, valor] of [['opcoes', ['Escudo']], ['categorias', ['Leve']], ['excluir', ['Escudo']]]) {
  test(`base escudo com só ${chave} avermelha`, () => {
    const e = erros((a) => { a.itens['arma-teste-mais-1-ou-mais-2'].base = { tipo: 'escudo', [chave]: valor }; return a; });
    assert.ok(e.some((x) => /base escudo não leva opcoes\/categorias\/excluir/.test(x)), JSON.stringify(e));
  });
}

// M2: prefixo de letra antes do termo também não casa.
for (const [termo, palavra] of [['Cego', 'InCego'], ['Surdo', 'SubSurdo']]) {
  test(`fronteira de palavra: "${palavra}" não casa "${termo}"`, () => {
    const e = errosPassivosTexto('Livro Bravo', (d) => `${d} Efeito ${palavra}.`, (a) => { a.itens['livro-bravo'].efeitos[0].condicao = termo; return a; });
    assert.ok(e.some((x) => new RegExp(`condicao "${termo}" não aparece`).test(x)), JSON.stringify(e));
  });
}

// M3: o dígito logo depois de "d" (6 em "1d6") não é número isolado.
test('fronteira numérica: valor 4 não casa em "1d4"', () => {
  const e = errosAnelTexto('Você recebe 1d4 de bônus.', 4);
  assert.ok(e.some((x) => /valor 4 não aparece/.test(x)), JSON.stringify(e));
});

// 1.8: Cajado do Acrobata ganha a Vantagem em Acrobacia com o contexto literal da forma; pendências sem processo nem duplicata.
test('passivos: Cajado do Acrobata tem Vantagem em Acrobacia com o contexto da forma', () => {
  const { porId } = indiceMecanica(carregarMecanica());
  const v = (porId['cajado-do-acrobata']?.efeitos || []).find((e) => e.alvo === 'vantagem');
  assert.deepEqual(v, { alvo: 'vantagem', em: 'pericia', pericia: 'Acrobacia', contexto: 'Somente nas Formas de Cajado ou de Vara de 3 Metros' });
});

test('pendências dos lotes: sem duplicata e sem nota de processo', () => {
  const todas = carregarMecanica().arquivos.flatMap((a) => a.pendencias.map((p) => [a._arquivo, p]));
  const vistas = new Set();
  for (const [arq, p] of todas) {
    assert.ok(!vistas.has(p), `${arq}: pendência duplicada: ${p}`);
    vistas.add(p);
    assert.ok(!/^(Fix wave|Ajuste do controlador)|^(cinturao-dos-anoes|livro-dos-feitos-exaltados|livro-da-escuridao-vil|machado-dos-senhores-anoes): .*curad[oa] como/i.test(p), `${arq}: pendência de processo: ${p}`);
  }
  const teleporte = todas.filter(([, p]) => /^machado-dos-senhores-anoes: .*Teleporte/.test(p));
  assert.equal(teleporte.length, 1, JSON.stringify(teleporte));
});
