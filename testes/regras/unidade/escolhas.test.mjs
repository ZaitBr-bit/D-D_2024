// ============================================================
// Confronto: talento que o LIVRO diz ter escolhas precisa ser
// RECONHECIDO pelo app através do mecanismo apropriado ao tipo de
// escolha — o app implementa escolhas de aquisição de duas formas
// distintas, e este teste confronta cada uma pela via certa:
//
// 1) Escolhas SÓ de atributo (atributo_talento/atributo_salvaguarda/
//    atributo_conjuracao) são cobertas por um mecanismo GENÉRICO e
//    orientado a dados em site/js/levelup.js (obterAtributosASITalento),
//    que lê o texto do benefício "Aumento no Valor de Atributo" direto
//    de dados/talentos/talentos.json — não depende de REGRAS_TALENTOS.
//    Confrontamos isso diretamente.
//
// 2) Talentos com pelo menos um tipo de escolha NÃO-atributo (perícia,
//    ferramenta, magia, arma, etc.) precisam ser declarados em algum
//    lugar que um teste de unidade consiga observar: REGRAS_TALENTOS
//    (regras-cobertura.js, consultado por site/js/sheet/talentos.js) OU
//    talentoExigeEscolhas (site/js/creator/comum.js, consultado pelo
//    assistente de criação de personagem). Só quando a entrada existe em
//    REGRAS_TALENTOS também cobramos que validarEscolhasTalento rejeite
//    a escolha vazia — talentoExigeEscolhas é só um sinalizador booleano,
//    validarEscolhasTalento não fala por ele.
//
// O que este teste NÃO consegue ver: ramos de renderização hard-coded
// por nome dentro de site/js/levelup-ui.js:renderEscolhasTalento (ex.: o
// <select> específico de Adepto Elemental/Analítico/Mente Aguçada). Esses
// só existem como HTML gerado em runtime — a pergunta comportamental ("o
// controle realmente aparece e é exigido antes de concluir?") fica para
// os testes Playwright (Task 9), não para este motor de unidade.
//
// 3) `aumento_atributo` (achado I3): campo curado à parte em TODAS as 75
//    entradas do catálogo, dizendo quais atributos o livro permite para o
//    "+1 embutido" do talento — inclusive duas exceções ao padrão de seis
//    atributos livres (Dádiva da Recordação de Magia, Dádiva do Ataque
//    Irresistível). Antes desta rodada, nenhum motor confrontava esse
//    campo contra nada: 75 alegações que nada falsificava. Confrontamos
//    aqui contra a MESMA função usada na Rota 1 (obterAtributosASITalento),
//    já que ela devolve exatamente essa lista — quando `dado` tem um
//    benefício "Aumento no Valor de Atributo" no texto do livro.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOGO_TALENTOS } from '../catalogo/talentos.mjs';
import { modulosApp, comLacuna, charBase, lerTalentosDados } from './harness.mjs';

// M9: os dois módulos abaixo vêm de modulosApp() -- import por caminho
// relativo direto (versão anterior deste arquivo) só funcionava porque a
// própria chamada a modulosApp() já tinha instalado os stubs de navegador
// antes; harness.mjs:19 diz que stub/import de módulo do app mora "AQUI (e
// só aqui)".
const { regras, levelup, criador } = await modulosApp();
const { obterAtributosASITalento } = levelup;
const { talentoExigeEscolhas } = criador;

const dadosPorNome = new Map(lerTalentosDados().map((t) => [t.nome, t]));

// Tipos de escolha cobertos pelo mecanismo genérico de ASI embutido no
// talento (obterAtributosASITalento) — não passam por REGRAS_TALENTOS.
const TIPOS_ATRIBUTO = ['atributo_talento', 'atributo_salvaguarda', 'atributo_conjuracao'];

for (const [nome, e] of Object.entries(CATALOGO_TALENTOS)) {
  if (e.escolhas.length === 0) continue;
  const soAtributo = e.escolhas.every((esc) => TIPOS_ATRIBUTO.includes(esc.tipo));

  if (soAtributo) {
    // Rota 1: escolha é só o atributo do ASI embutido — confronta o
    // mecanismo genérico e orientado a dados de levelup.js.
    test(`escolhas: ${nome}`, async () => {
      await comLacuna(nome, 'escolhas', async () => {
        const dado = dadosPorNome.get(nome);
        assert.ok(dado, `${nome}: sem entrada em dados/talentos/talentos.json`);
        const atributos = obterAtributosASITalento(dado);
        assert.ok(atributos.length > 0,
          `${nome}: livro exige escolher um atributo, mas obterAtributosASITalento ` +
          `não reconhece nenhum atributo elegível para este talento`);
      });
    });
  } else {
    // Rota 2: há escolha não-atributo — precisa ser reconhecida por
    // REGRAS_TALENTOS ou por talentoExigeEscolhas.
    test(`escolhas: ${nome}`, async () => {
      await comLacuna(nome, 'escolhas', async () => {
        const regraTalento = regras.getRegraTalento(nome);
        const reconhecido = Boolean(regraTalento) || talentoExigeEscolhas(nome);
        assert.ok(reconhecido,
          `${nome}: livro exige escolhas (${e.escolhas.map((x) => x.tipo).join(', ')}), ` +
          `mas o talento não é reconhecido nem por REGRAS_TALENTOS nem por talentoExigeEscolhas`);
        // validarEscolhasTalento só fala pelos talentos com entrada em
        // REGRAS_TALENTOS; para os reconhecidos só por talentoExigeEscolhas
        // (Habilidoso/Artifista/Músico) ela é um no-op (ver validacao.test.mjs).
        if (regraTalento) {
          const res = regras.validarEscolhasTalento(await charBase(), nome, {});
          assert.equal(res.valido, false,
            `${nome}: o app aceita adquirir o talento sem nenhuma das escolhas que o livro exige`);
        }
      });
    });
  }
}

// Rota 3 (achado I3): `aumento_atributo` confrontado em TODO talento do
// catálogo (não só os com `escolhas`), porque o campo existe em todas as
// 75 entradas — inclusive as sem nenhuma escolha, onde o valor esperado é
// `null`. Usa a chave 'aumento-atributo', distinta de 'escolhas': são
// alegações diferentes (uma é "o app reconhece que há uma escolha aqui",
// a outra é "o app concorda com QUAIS atributos são elegíveis").
for (const [nome, e] of Object.entries(CATALOGO_TALENTOS)) {
  test(`aumento_atributo: ${nome}`, async () => {
    await comLacuna(nome, 'aumento-atributo', async () => {
      const dado = dadosPorNome.get(nome);
      assert.ok(dado, `${nome}: sem entrada em dados/talentos/talentos.json`);
      const atributos = obterAtributosASITalento(dado);
      if (e.aumento_atributo === null) {
        assert.deepEqual(atributos, [],
          `${nome}: catálogo diz aumento_atributo=null (sem "+1" embutido), mas ` +
          `obterAtributosASITalento reconhece ${JSON.stringify(atributos)}`);
      } else {
        assert.deepEqual([...atributos].sort(), [...e.aumento_atributo].sort(),
          `${nome}: catálogo diz aumento_atributo=${JSON.stringify(e.aumento_atributo)}, ` +
          `obterAtributosASITalento devolve ${JSON.stringify(atributos)}`);
      }
    });
  });
}
