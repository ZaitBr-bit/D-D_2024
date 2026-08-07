// ============================================================
// Completude e sanidade do catálogo: bijeção com dados/, schema
// das entradas, citações reais do livro e higiene das lacunas.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOGO_TALENTOS, TIPOS_ESCOLHA } from '../catalogo/talentos.mjs';
import { LACUNAS, TESTES_VALIDOS, TIPOS_LACUNA } from '../lacunas-conhecidas.mjs';
import { lerTalentosDados, lerTitulosLivro } from './harness.mjs';

const dados = lerTalentosDados();
const titulos = lerTitulosLivro();
const nomesDados = new Set(dados.map((t) => t.nome));
const nomesCatalogo = new Set(Object.keys(CATALOGO_TALENTOS));
const ATRIBUTOS_VALIDOS = ['forca', 'destreza', 'constituicao', 'inteligencia', 'sabedoria', 'carisma'];

test('todo talento de dados/ tem entrada no catálogo', () => {
  const faltam = [...nomesDados].filter((n) => !nomesCatalogo.has(n));
  assert.deepEqual(faltam, [], `sem entrada no catálogo: ${faltam.join(', ')}`);
});

test('todo talento do catálogo existe em dados/ (sem órfãos)', () => {
  const orfaos = [...nomesCatalogo].filter((n) => !nomesDados.has(n));
  assert.deepEqual(orfaos, [], `órfãos no catálogo: ${orfaos.join(', ')}`);
});

test('categoria do catálogo bate com dados/', () => {
  for (const t of dados) {
    assert.equal(CATALOGO_TALENTOS[t.nome]?.categoria, t.categoria,
      `${t.nome}: categoria divergente`);
  }
});

for (const [nome, e] of Object.entries(CATALOGO_TALENTOS)) {
  test(`schema: ${nome}`, () => {
    assert.match(e.livro || '', /^Talentos\.md §.+/, 'campo livro ausente ou fora do formato');
    const titulo = e.livro.replace('Talentos.md §', '');
    assert.ok(titulos.has(titulo), `citação quebrada: "### ${titulo}" não existe em Talentos.md`);
    assert.equal(typeof e.repetivel, 'boolean', 'repetivel deve ser boolean');
    assert.ok(Array.isArray(e.escolhas), 'escolhas deve ser array');
    for (const esc of e.escolhas) {
      assert.ok(TIPOS_ESCOLHA.includes(esc.tipo), `tipo de escolha desconhecido: ${esc.tipo}`);
      assert.ok(esc.qtd === 'proficiencia' || Number.isInteger(esc.qtd), `qtd inválida em ${esc.tipo}`);
      // Achado M13: 'opcoes' vivia fora do schema validado -- uma chave
      // digitada errado (ex. 'opcoes' virar 'opcoe') desligava em silêncio
      // a asserção de rótulos de talentos-levelup.spec.mjs (achado M5),
      // porque `Array.isArray(e.opcoes)` simplesmente dava false e pulava
      // a checagem sem avisar ninguém.
      if (esc.opcoes !== undefined) {
        assert.ok(Array.isArray(esc.opcoes) && esc.opcoes.length > 0
          && esc.opcoes.every((o) => typeof o === 'string'),
          `${esc.tipo}: opcoes deve ser array não-vazio de strings`);
        if (esc.qtd !== 'proficiencia') {
          assert.ok(esc.opcoes.length >= esc.qtd,
            `${esc.tipo}: opcoes.length (${esc.opcoes.length}) menor que qtd (${esc.qtd})`);
        }
      }
    }
    if (e.escolhas.length > 0) {
      assert.ok(e.exemplo_valido && typeof e.exemplo_valido === 'object',
        'talento com escolhas exige exemplo_valido');
    }
    // Achado I3: aumento_atributo é curado nas 75 entradas, mas até esta
    // rodada nenhum motor sequer conferia sua FORMA (menos ainda seu
    // conteúdo -- isso é escolhas.test.mjs, teste "aumento_atributo: ...").
    assert.ok(e.aumento_atributo === null
      || (Array.isArray(e.aumento_atributo) && e.aumento_atributo.length > 0
          && e.aumento_atributo.every((a) => ATRIBUTOS_VALIDOS.includes(a))),
      'aumento_atributo deve ser null ou array não-vazio de atributos válidos');
  });
}

test('lacunas conhecidas: todas com talento real, teste válido, motivo e tipo escritos', () => {
  for (const l of LACUNAS) {
    assert.ok(nomesCatalogo.has(l.talento), `lacuna de talento inexistente: ${l.talento}`);
    assert.ok(TESTES_VALIDOS.includes(l.teste), `teste desconhecido: ${l.teste}`);
    assert.ok(l.motivo?.trim(), `lacuna sem motivo: ${l.talento}/${l.teste}`);
    // Achado I4: `tipo` distingue "o app diverge do livro" (o backlog real
    // de correções) de "o motor de teste não consegue observar isto" (uma
    // limitação de quem está testando, não uma alegação sobre o app) --
    // sem essa marca, as duas ficavam misturadas no mesmo contador.
    assert.ok(TIPOS_LACUNA.includes(l.tipo), `tipo de lacuna desconhecido: ${l.talento}/${l.teste} -> ${l.tipo}`);
  }
});
