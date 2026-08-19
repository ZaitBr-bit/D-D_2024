// ============================================================
// Confronto: talento que o LIVRO diz conceder proficiência fixa
// (armadura, arma ou ferramenta) precisa gravá-la no campo que o
// app REALMENTE lê, e o portão de pré-requisito precisa enxergar
// esse campo.
//
// Por que este motor existe, e por que ele não é passivos.test.mjs:
// aquele motor afirma `resolverPassivosTalentos().proficienciasExtra`,
// uma saída que nenhum consumidor de site/js/ jamais leu (medido em
// 2026-08-19: `grep -rn "proficienciasExtra" site/ scripts/` só acha
// a própria talentos-effects.js). Enquanto ele foi o único oráculo, os
// cinco talentos abaixo passaram verdes sem conceder nada a ninguém.
//
// A rota real tem TRÊS elos, e o motor confronta os três, porque cada
// um quebrou por um motivo diferente:
//   1. gravação   -> aplicarEfeitoTalento grava em proficiencias_extra
//                    /proficiencias_ferramentas
//   2. consumo    -> temProficienciaArmadura/temProficienciaArma
//                    reconhecem o que foi gravado
//   3. cadeia     -> talentoElegivelParaPersonagem libera o talento
//                    seguinte, cujo pré-requisito é o treinamento que
//                    o anterior concedeu
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { modulosApp, charBase, lerTalentosDados } from './harness.mjs';

const { regras, equip, levelup, regrasSubclasseEscolhas } = await modulosApp();
const TALENTOS = lerTalentosDados();
const acharTalento = (nome) => TALENTOS.find((t) => t.nome === nome);

// Itens de equipamento de dados/equipamento/*.json, no formato que
// temProficienciaArmadura/temProficienciaArma consomem (`categoria` em
// minúsculas na comparação, `nome` só usado para o caso Escudo).
const ARMADURA_LEVE = { nome: 'Armadura Acolchoada', categoria: 'Leve' };
const ARMADURA_MEDIA = { nome: 'Cota de Escamas', categoria: 'Média' };
const ARMADURA_PESADA = { nome: 'Cota de Malha', categoria: 'Pesada' };
const ESCUDO = { nome: 'Escudo', categoria: 'Escudo' };
const ESPADA_LONGA = {
  nome: 'Espada Longa', categoria: 'Armas Marciais Corpo a Corpo',
  propriedades: 'Versátil',
};

// O que cada talento concede, citado do livro. `classe` é escolhida de
// propósito como uma que NÃO tem o treinamento pela classe -- medir num
// Guerreiro (que já tem tudo) daria verde sem o talento existir.
const CONCESSOES = [
  {
    talento: 'Especialista em Armaduras Leves',
    livro: 'Talentos.md:428 -- "Você obtém treinamento com Armadura Leve e Escudos."',
    classe: 'Mago', // CLASSES_INFO['Mago'].armaduras === []
    atributo: 'destreza',
    extras: ['Armadura Leve', 'Escudo'],
    armaduras: [ARMADURA_LEVE, ESCUDO],
  },
  {
    talento: 'Especialista em Armaduras Médias',
    livro: 'Talentos.md:438 -- "Você obtém treinamento com Armadura Média."',
    classe: 'Mago',
    atributo: 'forca',
    extras: ['Armadura Média'],
    armaduras: [ARMADURA_MEDIA],
  },
  {
    talento: 'Especialista em Armaduras Pesadas',
    livro: 'Talentos.md:448 -- "Você adquire treinamento com Armadura Pesada."',
    classe: 'Mago',
    atributo: 'constituicao',
    extras: ['Armadura Pesada'],
    armaduras: [ARMADURA_PESADA],
  },
  {
    talento: 'Treinamento com Armas Marciais',
    livro: 'Talentos.md:728 -- "Você adquire proficiência com armas Marciais."',
    classe: 'Mago', // CLASSES_INFO['Mago'].armas === ['Simples']
    atributo: 'forca',
    extras: ['Armas Marciais'],
    armas: [ESPADA_LONGA],
  },
  {
    talento: 'Chef',
    livro: 'Talentos.md §Chef -- "Você adquire proficiência com Utensílios de Cozinheiro se ainda não o tiver."',
    classe: 'Mago',
    atributo: 'constituicao',
    ferramentas: ['Utensílios de Cozinheiro'],
  },
];

for (const c of CONCESSOES) {
  test(`proficiência de talento: ${c.talento} grava no campo que o app lê`, async () => {
    const char = await charBase();
    char.classe = c.classe;
    char.talentos = [c.talento];
    const resultado = regras.aplicarEfeitoTalento(char, c.talento, { atributo: c.atributo });
    assert.ok(resultado.sucesso,
      `${c.talento}: aplicarEfeitoTalento recusou a aquisição: ${resultado.erro}`);

    for (const item of c.extras || []) {
      assert.ok((char.proficiencias_extra || []).includes(item),
        `${c.talento}: o livro concede "${item}" (${c.livro}), mas ` +
        `char.proficiencias_extra ficou ${JSON.stringify(char.proficiencias_extra)} -- ` +
        'é este o campo que sheet/ficha.js:579, sheet/impressao.js:233 e ' +
        'regras-equipamento.js:17,74 leem');
    }
    for (const item of c.ferramentas || []) {
      assert.ok((char.proficiencias_ferramentas || []).includes(item),
        `${c.talento}: o livro concede "${item}" (${c.livro}), mas ` +
        `char.proficiencias_ferramentas ficou ${JSON.stringify(char.proficiencias_ferramentas)}`);
    }
  });

  // Chef concede FERRAMENTA, não armadura nem arma -- não há nada que
  // temProficienciaArmadura/temProficienciaArma possam confirmar para ele.
  // Gerar o teste mesmo assim produziria um verde que não afirma nada.
  if ((c.armaduras || []).length > 0 || (c.armas || []).length > 0) {
    test(`proficiência de talento: ${c.talento} é reconhecida no equipamento`, async () => {
      const char = await charBase();
      char.classe = c.classe;
      char.talentos = [c.talento];
      regras.aplicarEfeitoTalento(char, c.talento, { atributo: c.atributo });

      for (const armadura of c.armaduras || []) {
        assert.equal(equip.temProficienciaArmadura(char, armadura), true,
          `${c.talento}: gravou a proficiência mas temProficienciaArmadura recusa ` +
          `"${armadura.nome}" -- a tela de equipamento mostraria "Sem Prof" com o talento em mãos`);
      }
      for (const arma of c.armas || []) {
        assert.equal(equip.temProficienciaArma(char, arma), true,
          `${c.talento}: gravou a proficiência mas temProficienciaArma recusa "${arma.nome}"`);
      }
    });
  }
}

// A cadeia do livro: Leves concede o treinamento que Médias exige, que
// concede o que Pesadas exige (Talentos.md:432/:442). Um Mago (armaduras
// === []) só sobe a escada se cada degrau realmente conceder.
test('proficiência de talento: a cadeia Leves -> Médias -> Pesadas sobe inteira', async () => {
  const char = await charBase();
  char.classe = 'Mago';
  char.nivel = 12;
  const escada = [
    ['Especialista em Armaduras Leves', 'destreza'],
    ['Especialista em Armaduras Médias', 'forca'],
    ['Especialista em Armaduras Pesadas', 'constituicao'],
  ];
  for (const [nome, atributo] of escada) {
    assert.equal(
      levelup.talentoElegivelParaPersonagem(char, acharTalento(nome)), true,
      `${nome}: pré-requisito "${acharTalento(nome).prerequisito}" recusado -- ` +
      'o treinamento concedido pelo talento anterior não chegou ao portão ' +
      '(talentoElegivelParaPersonagem, site/js/levelup.js)');
    char.talentos.push(nome);
    regras.aplicarEfeitoTalento(char, nome, { atributo });
  }
});

// Mestre em Escudos exige "Treinamento com Escudo" (Talentos.md:580).
// Para um Mago o único caminho é Especialista em Armaduras Leves, que o
// livro diz conceder "Armadura Leve E ESCUDOS".
test('proficiência de talento: Especialista em Armaduras Leves destrava Mestre em Escudos', async () => {
  const char = await charBase();
  char.classe = 'Mago';
  char.talentos = ['Especialista em Armaduras Leves'];
  regras.aplicarEfeitoTalento(char, 'Especialista em Armaduras Leves', { atributo: 'destreza' });
  assert.equal(
    levelup.talentoElegivelParaPersonagem(char, acharTalento('Mestre em Escudos')), true,
    'Mestre em Escudos continua inalcançável: ou os Escudos não foram concedidos, ' +
    'ou o portão de pré-requisito não lê proficiencias_extra');
});

// Regressão da concessão que JÁ existe em produção: o Bardo do Colégio da
// Bravura recebe ['Armas Marciais','Armadura Média','Escudo'] em
// proficiencias_extra (regras-subclasse-escolhas.js:52) e mesmo assim era
// barrado dos três talentos que esse treinamento deveria destravar.
test('proficiência de subclasse: Colégio da Bravura destrava os talentos de treinamento', async () => {
  const char = await charBase();
  char.classe = 'Bardo';
  char.subclasse = 'Colégio da Bravura';
  const linha = regrasSubclasseEscolhas.ESCOLHAS_SUBCLASSE_APP
    .find((l) => l.caracteristica === 'Treinamento Marcial');
  assert.ok(linha, 'a linha "Treinamento Marcial" sumiu de ESCOLHAS_SUBCLASSE_APP');
  regrasSubclasseEscolhas.aplicarConcessaoAutomatica(char, linha);

  for (const nome of ['Especialista em Armaduras Pesadas', 'Mestre em Armaduras Médias', 'Mestre em Escudos']) {
    assert.equal(
      levelup.talentoElegivelParaPersonagem(char, acharTalento(nome)), true,
      `${nome}: o Bardo tem o treinamento gravado em proficiencias_extra ` +
      `(${JSON.stringify(char.proficiencias_extra)}) e o portão recusa mesmo assim`);
  }
});
