// ============================================================
// Completude e sanidade do catálogo: bijeção com dados/, schema
// das entradas, citações reais do livro e higiene das lacunas.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CATALOGO_TALENTOS, TIPOS_ESCOLHA } from '../catalogo/talentos.mjs';
import { CATALOGO_ANTECEDENTES } from '../catalogo/antecedentes.mjs';
import { PROGRESSAO } from '../catalogo/classes.mjs';
import { LACUNAS, TESTES_VALIDOS, TIPOS_LACUNA } from '../lacunas-conhecidas.mjs';
import { EXCECOES_ESCOLHA_REPETIDA } from '../excecoes-escolha-repetida.mjs';
import { lerTalentosDados, lerTitulosLivro, RAIZ } from './harness.mjs';

const dados = lerTalentosDados();
const titulos = lerTitulosLivro();
const nomesDados = new Set(dados.map((t) => t.nome));
const nomesCatalogo = new Set(Object.keys(CATALOGO_TALENTOS));
// A bijeção/schema/citação do catálogo de antecedentes contra dados/ e
// Antecedente.md tem motor próprio (unidade/antecedentes.test.mjs) --
// a razão de não duplicar aqui está no relatório da Tarefa 2
// (.superpowers/sdd/antecedentes/tarefa-2-report.md). O que É
// compartilhado com talentos é a higiene de LACUNAS logo abaixo: o
// campo `talento` de uma entrada é só um identificador genérico, e
// pode nomear um antecedente tanto quanto um talento. O mesmo padrão se
// repete no domínio Classes/Níveis: a bijeção/schema/citação do
// catálogo de classes contra dados/classes/*.json vive em
// unidade/classes.test.mjs (Task 4 do projeto
// 2026-08-07-regras-classes-niveis), não aqui -- só a higiene de
// LACUNAS é compartilhada, e por isso `talento` também aceita um nome
// de classe.
const nomesAntecedentes = new Set(Object.keys(CATALOGO_ANTECEDENTES));
// Desde o domínio Classes/Níveis, `talento` também pode nomear uma das
// 12 classes -- o campo é o identificador genérico da entidade sob
// teste, não um nome de talento.
const nomesClasses = new Set(Object.keys(PROGRESSAO));
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
    // `talento` é o identificador genérico da entidade sob teste -- pode
    // ser um nome de talento (talentos.mjs), um nome de antecedente
    // (antecedentes.mjs, desde o domínio Antecedentes) ou, desde o
    // domínio Classes/Níveis, um nome de classe (classes.mjs). Uma
    // entrada só é rejeitada se não existir em NENHUM dos três.
    assert.ok(nomesCatalogo.has(l.talento) || nomesAntecedentes.has(l.talento)
      || nomesClasses.has(l.talento),
      `lacuna de entidade inexistente (nem talento, nem antecedente, nem classe): ${l.talento}`);
    assert.ok(TESTES_VALIDOS.includes(l.teste), `teste desconhecido: ${l.teste}`);
    assert.ok(l.motivo?.trim(), `lacuna sem motivo: ${l.talento}/${l.teste}`);
    // Achado I4: `tipo` distingue "o app diverge do livro" (o backlog real
    // de correções) de "o motor de teste não consegue observar isto" (uma
    // limitação de quem está testando, não uma alegação sobre o app) --
    // sem essa marca, as duas ficavam misturadas no mesmo contador.
    assert.ok(TIPOS_LACUNA.includes(l.tipo), `tipo de lacuna desconhecido: ${l.talento}/${l.teste} -> ${l.tipo}`);
  }
});

// Achado I2 da revisão final: TESTES_VALIDOS tinha três chaves
// ('classes-gatilho', 'classes-progressao', 'classes-sanidade') sem
// nenhum call site de comLacuna()/lacuna() em toda a suíte -- ou seja,
// três "portas" abertas para uma lacuna inventada que nenhum teste
// jamais poderia falsificar (o corpo confrontado nunca existia, então
// nunca lançava, então a inversão de comLacuna nunca era exercitada).
// Este teste fecha a porta: toda chave declarada em TESTES_VALIDOS
// precisa aparecer, como literal de string, em pelo menos um arquivo de
// motor (unidade/*.test.mjs ou e2e/regras/*.spec.mjs) -- é a mesma
// checagem que o achado I2 pediu, agora automática em vez de depender
// de alguém notar na revisão.
test('toda chave de TESTES_VALIDOS é referenciada por algum motor de teste', () => {
  const arquivosUnidade = readdirSync(resolve(RAIZ, 'testes/regras/unidade'))
    .filter((f) => f.endsWith('.test.mjs'))
    .map((f) => resolve(RAIZ, 'testes/regras/unidade', f));
  const arquivosE2E = readdirSync(resolve(RAIZ, 'testes/e2e/regras'))
    .filter((f) => f.endsWith('.spec.mjs'))
    .map((f) => resolve(RAIZ, 'testes/e2e/regras', f));
  const conteudo = [...arquivosUnidade, ...arquivosE2E]
    .map((f) => readFileSync(f, 'utf-8'))
    .join('\n');
  const semConsumidor = TESTES_VALIDOS.filter((chave) => !conteudo.includes(`'${chave}'`));
  assert.deepEqual(semConsumidor, [],
    `chave(s) de TESTES_VALIDOS sem nenhuma chamada comLacuna()/lacuna() que a use: ` +
    `${semConsumidor.join(', ')} -- remova a chave de TESTES_VALIDOS ou acrescente o call site`);
});

// Mesma higiene de LACUNAS, aplicada a excecoes-escolha-repetida.mjs
// (motor unidade/escolha-morta.test.mjs): talento real e motivo preenchido.
// Diferente de LACUNAS, esta lista não tem campo `teste` (só existe uma
// chave de teste possível, 'escolha-morta') nem `tipo` -- toda entrada
// aqui é da mesma natureza ("o livro concede algo a mais na repetição"),
// então não há duas alegações a distinguir como em TIPOS_LACUNA.
test('exceções de escolha repetida: todas com talento real e motivo escrito', () => {
  for (const ex of EXCECOES_ESCOLHA_REPETIDA) {
    assert.ok(nomesCatalogo.has(ex.talento), `exceção de talento inexistente: ${ex.talento}`);
    assert.ok(ex.motivo?.trim(), `exceção sem motivo: ${ex.talento}`);
  }
});
