// ============================================================
// Motor estrutural do domínio classes/níveis: o catálogo transcrito
// do livro confrontado contra as DUAS fontes de verdade do app
// (dados/classes/*.json e site/js/dados-classes.js) e contra as
// funções puras que leem a tabela e decidem o que cada nível exige.
//
// O confronto COMPORTAMENTAL ("o app aplica isso a um personagem que
// sobe de nível?") vive em classes-progressao.test.mjs, não aqui.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CITACOES, TRACOS_BASICOS, SUBCLASSES, PROGRESSAO,
  COLUNAS_POR_CLASSE, CHAVE_CARACTERISTICAS,
  ROTULOS_GATILHO, MANOBRAS_POR_NIVEL, EXCECOES_ESCOLHA_NIVEL_1,
} from '../catalogo/classes.mjs';
import { PV_NIVEL_SEGUINTE } from '../catalogo/ficha-transversal.mjs';
import { lerClassesDados, lerHeadingsClasses, modulosApp, comLacuna } from './harness.mjs';

const dados = lerClassesDados();
const headings = lerHeadingsClasses();
const CLASSES = Object.keys(PROGRESSAO);
const { utils, dadosClasses, levelup, criador } = await modulosApp();
const { CLASSES_INFO } = dadosClasses;

test('as 12 classes do catálogo existem em dados/classes/', () => {
  const faltam = CLASSES.filter((c) => !dados.has(c));
  assert.deepEqual(faltam, [], `sem arquivo em dados/classes/: ${faltam.join(', ')}`);
});

test('toda classe de dados/classes/ tem entrada no catálogo (sem órfãos)', () => {
  const orfaos = [...dados.keys()].filter((c) => !PROGRESSAO[c]);
  assert.deepEqual(orfaos, [], `órfãos: ${orfaos.join(', ')}`);
});

test('o catálogo cobre exatamente 12 classes × 20 níveis', () => {
  assert.equal(CLASSES.length, 12);
  for (const classe of CLASSES) {
    assert.deepEqual(PROGRESSAO[classe].map((l) => l.nivel),
      Array.from({ length: 20 }, (_, i) => i + 1),
      `${classe}: níveis fora de 1..20 ou faltando`);
  }
});

// ============================================================
// Schema e citação, uma vez por classe.
// ============================================================
for (const classe of CLASSES) {
  test(`schema e citação: ${classe}`, () => {
    assert.match(CITACOES[classe] || '', /^Classes\.md §.+/,
      'citação ausente ou fora do formato');
    const titulo = CITACOES[classe].replace('Classes.md §', '');
    assert.ok(headings.has(titulo),
      `citação quebrada: "${titulo}" não é heading de Classes.md`);

    const t = TRACOS_BASICOS[classe];
    assert.ok(Number.isInteger(t.dadoVida) && [6, 8, 10, 12].includes(t.dadoVida),
      'dadoVida deve ser 6, 8, 10 ou 12');
    assert.ok(Array.isArray(t.salvaguardas) && t.salvaguardas.length === 2,
      'salvaguardas deve ter exatamente 2 atributos');
    assert.ok(Number.isInteger(t.numPericias) && t.numPericias >= 2,
      'numPericias deve ser inteiro >= 2');
    assert.ok(t.periciasOpcoes === null
      || (Array.isArray(t.periciasOpcoes) && t.periciasOpcoes.length >= t.numPericias),
      'periciasOpcoes deve ser null ou lista com pelo menos numPericias opções');
    assert.equal(typeof t.conjurador, 'boolean', 'conjurador deve ser boolean');
    assert.equal(t.conjurador, t.atributoConjuracao !== null,
      'conjurador e atributoConjuracao devem concordar');

    // armasRestricao: campo acrescentado depois do brief (não está no
    // Step 2 original) -- null em 10 classes, e em Ladino/Monge um
    // objeto que mapeia a categoria restrita (sempre 'Marcial') para a(s)
    // propriedade(s) exigida(s) pelo livro (string ou array de strings).
    // Todo campo do catálogo precisa de um consumidor: este é o do schema.
    assert.ok(t.armasRestricao === null || typeof t.armasRestricao === 'object',
      'armasRestricao deve ser null ou objeto');
    if (t.armasRestricao !== null) {
      for (const [categoria, propriedade] of Object.entries(t.armasRestricao)) {
        assert.ok(t.armas.includes(categoria),
          `armasRestricao cita categoria "${categoria}" que não está em armas`);
        assert.ok(typeof propriedade === 'string'
          || (Array.isArray(propriedade) && propriedade.every((p) => typeof p === 'string')),
          'valor de armasRestricao deve ser string ou array de strings');
      }
    }

    assert.equal(SUBCLASSES[classe].length, 4, 'toda classe tem 4 subclasses');

    for (const linha of PROGRESSAO[classe]) {
      assert.ok(Number.isInteger(linha.bonusProficiencia),
        `nv${linha.nivel}: bonusProficiencia deve ser inteiro`);
      assert.ok(Array.isArray(linha.caracteristicas),
        `nv${linha.nivel}: caracteristicas deve ser array`);
      assert.deepEqual(Object.keys(linha.colunas).sort(),
        [...COLUNAS_POR_CLASSE[classe]].sort(),
        `nv${linha.nivel}: colunas divergem de COLUNAS_POR_CLASSE`);
      for (const v of Object.values(linha.colunas)) {
        assert.equal(typeof v, 'string',
          `nv${linha.nivel}: valor de coluna deve ser string`);
      }
      // espacos: null só para as 4 classes sem conjuração. Um objeto
      // vazio significaria "conjura, mas não tem espaço neste nível" --
      // estado que nenhuma classe do livro tem, e que mascararia uma
      // transcrição incompleta se fosse aceito no lugar de null.
      if (t.conjurador) {
        assert.ok(linha.espacos && typeof linha.espacos === 'object',
          `nv${linha.nivel}: classe conjuradora exige objeto espacos`);
      } else {
        assert.equal(linha.espacos, null,
          `nv${linha.nivel}: classe não-conjuradora exige espacos null`);
      }
    }
  });
}

// ============================================================
// Os 48 nomes de subclasse × dados/classes/.
// ============================================================
for (const classe of CLASSES) {
  test(`subclasses de ${classe} batem com dados/classes/`, () => {
    const nosDados = (dados.get(classe).subclasses || []).map((s) => s.nome).sort();
    assert.deepEqual([...SUBCLASSES[classe]].sort(), nosDados,
      `${classe}: nomes de subclasse divergem`);
  });
}

// ============================================================
// As 240 linhas, coluna a coluna.
// ============================================================
for (const classe of CLASSES) {
  const tabela = dados.get(classe).tabela_caracteristicas;
  const chaveCaract = CHAVE_CARACTERISTICAS[classe];

  for (const linha of PROGRESSAO[classe]) {
    test(`tabela: ${classe} nível ${linha.nivel}`, async () => {
      // Corpo isolado numa função para poder envolvê-lo em comLacuna()
      // só na única célula com lacuna registrada (Clérigo nível 3, ver
      // lacunas-conhecidas.mjs) sem afetar as outras 239. A chave
      // (talento, teste) do mecanismo não distingue nível -- é a
      // condição abaixo, não a chave, que restringe a inversão a este
      // caso único.
      const row = tabela.find((r) => parseInt(r['Nível'], 10) === linha.nivel);
      assert.ok(row, `dados/classes/ não tem linha do nível ${linha.nivel}`);

      assert.equal(row['Bônus de Proficiência'], `+${linha.bonusProficiencia}`,
        'Bônus de Proficiência divergente');

      // A coluna de características do livro é uma string separada por
      // vírgula; o catálogo guarda a lista. Compara-se a lista contra a
      // string dividida, não a string inteira, para a falha dizer QUAL
      // característica divergiu em vez de despejar as duas frases.
      //
      // Achado I1 da revisão final: só ESTA asserção -- a única com
      // divergência conhecida (Clérigo nível 3, ver lacunas-conhecidas.mjs)
      // -- entra em comLacuna(). Envolver o corpo inteiro do teste (como
      // antes) fazia a inversão de expectativa engolir TODAS as asserções
      // irmãs (Bônus de Proficiência, colunas, espaços de magia) junto com
      // a divergente, deixando-as sem verificação nenhuma nesta única
      // linha (Clérigo nv3) enquanto o teste seguia verde.
      const corpoCaracteristicas = () => {
        const doDados = (row[chaveCaract] === '—' || row[chaveCaract] === '-')
          ? [] : String(row[chaveCaract]).split(',').map((c) => c.trim()).filter(Boolean);
        assert.deepEqual(doDados, linha.caracteristicas,
          'características divergentes');
      };
      if (classe === 'Clérigo' && linha.nivel === 3) {
        await comLacuna('Clérigo', 'classes-tabela', corpoCaracteristicas);
      } else {
        corpoCaracteristicas();
      }

      for (const [coluna, valor] of Object.entries(linha.colunas)) {
        assert.equal(String(row[coluna]), valor, `coluna "${coluna}" divergente`);
      }

      if (linha.espacos !== null) {
        const nosDados = {};
        for (let c = 1; c <= 9; c++) {
          const v = row[String(c)];
          if (v && v !== '—' && v !== '-') nosDados[String(c)] = parseInt(v, 10);
        }
        assert.deepEqual(nosDados, linha.espacos, 'espaços de magia divergentes');
      }
    });
  }
}

// ============================================================
// CLASSES_INFO (site/js/dados-classes.js) × TRACOS_BASICOS do livro.
// Esta é a SEGUNDA fonte de verdade do app para os mesmos fatos que
// dados/classes/*.json → tabela_caracteristicas confronta acima.
// CLASSES_INFO alimenta calcPVNivel1/calcPVTotal (utils.js) e
// calcCDMagia/calcAtaqueMagia -- um valor errado aqui propaga para a
// ficha inteira.
// ============================================================
for (const classe of CLASSES) {
  test(`CLASSES_INFO × livro: ${classe}`, async () => {
    const info = CLASSES_INFO[classe];
    assert.ok(info, `CLASSES_INFO não tem entrada para ${classe}`);
    const t = TRACOS_BASICOS[classe];

    assert.equal(info.dado_vida, t.dadoVida, 'dado de vida divergente');
    assert.equal(info.atributo_primario, t.atributoPrimario,
      'atributo primário divergente');
    assert.deepEqual([...(info.salvaguardas || [])].sort(),
      [...t.salvaguardas].sort(), 'salvaguardas divergentes');
    assert.equal(info.num_pericias, t.numPericias, 'nº de perícias divergente');
    assert.deepEqual(
      info.pericias_opcoes === null ? null : [...info.pericias_opcoes].sort(),
      t.periciasOpcoes === null ? null : [...t.periciasOpcoes].sort(),
      'lista de perícias divergente');
    assert.deepEqual([...(info.armaduras || [])].sort(), [...t.armaduras].sort(),
      'treinamento com armadura divergente');

    // Proficiência com armas: DUAS asserções separadas de propósito.
    // `info.armas` mistura categoria e restrição na mesma string quando
    // há restrição (ex.: 'Marcial (Acuidade)'); o catálogo guarda as
    // duas coisas em campos separados (`armas` só categoria,
    // `armasRestricao` a propriedade exigida). Um deepEqual direto das
    // duas listas ia acusar divergência em Ladino e Monge só por causa
    // do formato ('Marcial' !== 'Marcial (Acuidade)'), o que mascararia
    // a divergência real: o Ladino tem uma restrição incompleta (o
    // livro pede Acuidade OU Leve, o app só codifica Acuidade). Por
    // isso a categoria e a restrição são conferidas em passos distintos
    // -- cada assert.* afirma uma coisa só.
    //
    // 1) Categorias: remove o parêntese de cada entrada de info.armas
    //    e compara com t.armas. Vale para as 12 classes.
    const categorias = (info.armas || [])
      .map((a) => a.replace(/\s*\(.+\)\s*$/, ''));
    assert.deepEqual([...categorias].sort(), [...t.armas].sort(),
      'proficiência com armas (categoria) divergente');

    // 2) Restrição: só para as classes em que o livro restringe uma
    //    categoria a propriedade(s) específica(s) (t.armasRestricao !==
    //    null). Confronta a lista de propriedades que o LIVRO exige
    //    (catálogo) contra a que o app codifica dentro do parêntese --
    //    é esta asserção que pega o Ladino (livro: Acuidade e Leve;
    //    app: só Acuidade).
    //
    // Achado I1 da revisão final: comLacuna(classe, 'classes-info', ...)
    // envolvia o CORPO INTEIRO deste teste -- como a restrição do Ladino
    // sempre lança, a inversão de expectativa engolia junto as sete
    // asserções irmãs acima (dado_vida, salvaguardas, num_pericias,
    // pericias_opcoes, armaduras, categorias, conjurador,
    // atributo_conjuracao), deixando-as sem verificação nenhuma no
    // Ladino enquanto o teste seguia verde. Só ESTE bloco -- a única
    // asserção com divergência conhecida -- entra em comLacuna(). Para
    // as outras 11 classes (e para o Ladino fora deste bloco), `lacuna()`
    // devolve null e o corpo roda normal, exigindo passar.
    const corpoArmasRestricao = () => {
      if (t.armasRestricao !== null) {
        for (const [categoria, propriedadeLivro] of Object.entries(t.armasRestricao)) {
          const entrada = (info.armas || []).find((a) => a.startsWith(categoria));
          assert.ok(entrada,
            `app não tem entrada de arma para a categoria restrita "${categoria}"`);
          const match = entrada.match(/\((.+)\)\s*$/);
          const propriedadeApp = match ? [match[1]] : [];
          const propriedadesLivro = Array.isArray(propriedadeLivro)
            ? propriedadeLivro : [propriedadeLivro];
          assert.deepEqual(propriedadeApp, propriedadesLivro,
            `restrição de "${categoria}" divergente: livro exige `
            + `${propriedadesLivro.join(' ou ')}, app codifica "${entrada}"`);
        }
      }
    };
    await comLacuna(classe, 'classes-info', corpoArmasRestricao);

    assert.equal(info.conjurador, t.conjurador, 'flag conjurador divergente');
    assert.equal(info.atributo_conjuracao ?? null, t.atributoConjuracao,
      'atributo de conjuração divergente');
  });
}

test('CLASSES_INFO não tem classe além das 12 do livro', () => {
  const extras = Object.keys(CLASSES_INFO).filter((c) => !PROGRESSAO[c]);
  assert.deepEqual(extras, [], `classes desconhecidas: ${extras.join(', ')}`);
});

// ============================================================
// getEspacosMagia / getTruquesConhecidos / getMagiaPreparadas
// (site/js/utils.js) -- funções puras que leem tabela_caracteristicas.
// Varredura 12 × 20: o esperado vem do CATÁLOGO (o livro), nunca da
// própria tabela que a função lê -- senão o teste comparava o app
// consigo mesmo.
// ============================================================
for (const classe of CLASSES) {
  const tabela = dados.get(classe).tabela_caracteristicas;

  test(`getEspacosMagia × livro: ${classe} (20 níveis)`, () => {
    for (const linha of PROGRESSAO[classe]) {
      const obtido = utils.getEspacosMagia(tabela, linha.nivel);
      const esperado = {};
      for (const [circulo, total] of Object.entries(linha.espacos || {})) {
        esperado[circulo] = { total, usados: 0 };
      }
      assert.deepEqual(obtido, esperado, `${classe} nv${linha.nivel}`);
    }
  });

  test(`getTruquesConhecidos e getMagiaPreparadas × livro: ${classe}`, () => {
    for (const linha of PROGRESSAO[classe]) {
      // parseInt('—') é NaN e a função devolve 0 nesse caso; o catálogo
      // guarda a string do livro, então a conversão é feita aqui, no
      // esperado, com a mesma semântica -- e explicitamente, não por
      // acidente de coerção.
      const paraNumero = (v) => (v === undefined || v === '—' || v === '-')
        ? 0 : (parseInt(v, 10) || 0);
      assert.equal(utils.getTruquesConhecidos(tabela, linha.nivel),
        paraNumero(linha.colunas['Truques']),
        `${classe} nv${linha.nivel}: truques`);
      assert.equal(utils.getMagiaPreparadas(tabela, linha.nivel),
        paraNumero(linha.colunas['Magias Preparadas']),
        `${classe} nv${linha.nivel}: magias preparadas`);
    }
  });
}

// ============================================================
// calcularHPGanho (site/js/levelup.js) × dado de vida do livro.
// A regra de PV dos níveis seguintes (metade do dado + 1 + mod. CON,
// mínimo 1) já foi confrontada com Criação de Personagens.md:497-510
// pelo domínio de regras transversais. O que se confronta AQUI é outra
// coisa: que calcularHPGanho use o dado de vida que o LIVRO dá a cada
// classe -- ele lê CLASSES_INFO, não a tabela.
// ============================================================

// Achado I3 da revisão final: o esperado usava
// `Math.floor(dadoVida / 2) + 1 + modCon`, a forma derivada da mesma
// EXPRESSÃO que site/js/levelup.js:350-352 calcula -- se o app tivesse
// um erro na FORMA (não só no valor), o teste não pegaria, porque as
// duas fórmulas errariam do mesmo jeito juntas. classes-progressao.test.mjs
// (linhas ~100-105) rejeita explicitamente esse padrão pelo mesmo
// motivo e usa PV_NIVEL_SEGUINTE (ficha-transversal.mjs), a transcrição
// literal da tabela "Pontos de Vida Fixos por Classe"
// (Criação de Personagens.md:503-510) -- transcrição, não fórmula
// derivada. Este arquivo passa a fazer o mesmo, pelo mesmo domínio e
// pela mesma regra.
function incrementoPvDoLivro(classe) {
  const linha = PV_NIVEL_SEGUINTE.find((l) => l.classes.includes(classe));
  if (!linha) throw new Error(`PV_NIVEL_SEGUINTE (ficha-transversal.mjs) sem entrada para ${classe}`);
  return linha.incremento;
}

for (const classe of CLASSES) {
  test(`calcularHPGanho usa o dado de vida do livro: ${classe}`, () => {
    const incremento = incrementoPvDoLivro(classe);
    for (let modCon = -5; modCon <= 10; modCon++) {
      // O `Math.max(1, ...)` CONTINUA aqui de propósito -- é regra do
      // livro (Criação de Personagens.md:501, "some o total (mínimo de
      // 1)"), não parte da forma derivada que este achado rejeita.
      const esperado = Math.max(1, incremento + modCon);
      assert.equal(levelup.calcularHPGanho(classe, modCon), esperado,
        `${classe} com mod. CON ${modCon}`);
    }
  });
}

// ============================================================
// obterCaracteristicasNivel (site/js/levelup.js) × catálogo.
// Varredura 12 × 20.
// ============================================================
for (const classe of CLASSES) {
  test(`obterCaracteristicasNivel × livro: ${classe} (20 níveis)`, async () => {
    // Lacuna só no nível 3 do Clérigo (mesma causa-raiz do teste de
    // tabela acima, vista por esta função de produção em vez de leitura
    // crua do JSON -- ver lacunas-conhecidas.mjs). comLacuna() é chamado
    // POR NÍVEL, dentro do laço, não em volta do laço inteiro: envolver
    // o laço inteiro faria a falha do nível 3 abortá-lo ali -- o
    // `comLacuna` intercepta a exceção e retorna antes de os níveis 4-20
    // chegarem a ser exercitados por obterCaracteristicasNivel nesta
    // execução, perdendo cobertura silenciosa deles (achado da revisão
    // independente desta tarefa: hoje mitigado só porque `tabela: ${classe}
    // nível ${N}`, acima, já confere essas 17 linhas por outra rota --
    // mitigação por OUTRO teste, não cobertura deste). Aplicando por
    // nível, só a asserção do nível 3 entra no mecanismo de inversão; as
    // outras 19 continuam exigindo passar normal, dentro do MESMO teste
    // "(20 níveis)" e do MESMO laço -- o rótulo do teste volta a
    // descrever o que ele de fato exercita.
    for (const linha of PROGRESSAO[classe]) {
      const corpo = async () => {
        const obtido = await levelup.obterCaracteristicasNivel(classe, linha.nivel);
        assert.deepEqual(obtido, linha.caracteristicas,
          `${classe} nv${linha.nivel}`);
      };
      if (classe === 'Clérigo' && linha.nivel === 3) {
        await comLacuna('Clérigo', 'classes-tabela', corpo);
      } else {
        await corpo();
      }
    }
  });
}

// ============================================================
// Task 6 -- motor estrutural: oito funções de levelup.js decidem o que
// cada nível exige por LISTA HARD-CODED (concedeAumentoAtributo,
// exigeSubclasse, exigeDadivaEpica, exigeEspecializacaoBardo,
// exigeEspecializacaoGuardiao, exigeEstiloLuta, exigeExploradorHabil,
// exigeAcademico), independente de PROGRESSAO. Nada hoje confronta
// essas listas com a coluna "Características de Classe" do livro --
// este é o primeiro confronto.
//
// Para cada gatilho: o ESPERADO é "o livro lista este rótulo (via
// ROTULOS_GATILHO, catálogo) na coluna de características deste
// nível", e o OBSERVADO é o que a função de levelup.js responde para o
// mesmo par (classe, nível). Nenhum dos dois lados vem de PROGRESSAO
// filtrado pela própria função -- o esperado sai sempre da coluna
// transcrita do livro, o observado sai sempre da função sob teste.
//
// `apenas` restringe onde o rótulo pode aparecer no livro (ex.:
// "Especialista" do Guardião só é este gatilho na classe Guardião), mas
// NÃO é atalho para pular as outras 11 classes: fora da lista, o
// esperado é `false` nos 20 níveis, e isso é AFIRMADO -- um gatilho que
// disparasse na classe errada é pego aqui, não silenciosamente ignorado.
const GATILHOS = [
  { nome: 'concedeAumentoAtributo', rotulo: ROTULOS_GATILHO.aumentoAtributo,
    fn: (classe, nivel) => levelup.concedeAumentoAtributo(classe, nivel) },
  { nome: 'exigeSubclasse', rotulo: ROTULOS_GATILHO.subclasse,
    fn: (classe, nivel) => levelup.exigeSubclasse(classe, nivel) },
  { nome: 'exigeDadivaEpica', rotulo: ROTULOS_GATILHO.dadivaEpica,
    fn: (classe, nivel) => levelup.exigeDadivaEpica(classe, nivel) },
  { nome: 'exigeEspecializacaoBardo', rotulo: ROTULOS_GATILHO.especializacaoBardo,
    fn: (classe, nivel) => levelup.exigeEspecializacaoBardo(classe, nivel),
    apenas: ['Bardo'] },
  { nome: 'exigeEspecializacaoGuardiao', rotulo: ROTULOS_GATILHO.especializacaoGuardiao,
    fn: (classe, nivel) => levelup.exigeEspecializacaoGuardiao(classe, nivel),
    apenas: ['Guardião'] },
  { nome: 'exigeEstiloLuta', rotulo: ROTULOS_GATILHO.estiloLuta,
    fn: (classe, nivel) => levelup.exigeEstiloLuta(classe, nivel) },
  { nome: 'exigeExploradorHabil', rotulo: ROTULOS_GATILHO.exploradorHabil,
    fn: (classe, nivel) => levelup.exigeExploradorHabil(classe, nivel),
    apenas: ['Guardião'] },
  { nome: 'exigeAcademico', rotulo: ROTULOS_GATILHO.academico,
    fn: (classe, nivel) => levelup.exigeAcademico(classe, nivel),
    apenas: ['Mago'] },
];

// A varredura roda sobre os níveis 2-20, não 1-20: as oito funções são o
// portão de PASSO do assistente de SUBIDA de nível, que nunca processa o
// nível 1 -- `novoNivel`/`nivelNovo` é sempre `nivelAnterior + 1` com
// `nivelAnterior/nivelAtual >= 1` (levelup.js:884, levelup-flow.js:32), e
// por isso essas funções nunca são chamadas com `nivel === 1` em produção.
// Cobrar `nivel === 1` delas seria medir um nível que elas não veem -- o
// teste abaixo ("nível 1: ...") continua varrendo o nível 1, mas afirma
// esse domínio explicitamente em vez de silenciar a exclusão.
for (const gatilho of GATILHOS) {
  for (const classe of CLASSES) {
    test(`${gatilho.nome} × livro: ${classe} (níveis 2-20)`, () => {
      const regex = gatilho.rotulo(classe);
      for (const linha of PROGRESSAO[classe]) {
        if (linha.nivel === 1) continue;
        const noLivro = (gatilho.apenas && !gatilho.apenas.includes(classe))
          ? false
          : linha.caracteristicas.some((c) => regex.test(c));
        assert.equal(gatilho.fn(classe, linha.nivel), noLivro,
          `${gatilho.nome}(${classe}, ${linha.nivel}): livro diz ${noLivro}`);
      }
    });
  }
}

// O nível 1 fica fora do laço acima porque essas funções nunca são
// chamadas com ele (ver comentário acima) -- mas excluí-lo em silêncio
// esconderia uma classe futura que ganhasse um destes rótulos no nível 1.
// Este teste varre o nível 1 das 12 classes e afirma, célula por célula,
// que o único rótulo de ROTULOS_GATILHO que casa é o Estilo de Luta do
// Guerreiro -- respeitando `apenas` do mesmo jeito que o laço acima (ex.:
// "Especialização" também aparece no nível 1 do Ladino, mas
// especializacaoBardo tem `apenas: ['Bardo']`, então não conta aqui). Se
// o livro mudar e outra classe ganhar um desses rótulos no nível 1, esta
// asserção quebra e alguém decide o que fazer -- em vez de a exclusão do
// laço acima continuar cega para sempre.
//
// O caso do Guerreiro É coberto pelo app, só que não por levelup.js: o
// Estilo de Luta de nível 1 do Guerreiro é escolhido na CRIAÇÃO do
// personagem, por `CLASSES_ESCOLHAS['Guerreiro'].estilo_luta`
// (site/js/creator/comum.js:305-323) e renderizado em
// site/js/creator/passo-classe.js:92-154 -- um fluxo inteiramente
// separado do assistente de subida de nível.
test('nível 1: nenhum gatilho dispara além do Estilo de Luta do Guerreiro', () => {
  const achados = {};
  for (const classe of CLASSES) {
    const linha1 = PROGRESSAO[classe].find((l) => l.nivel === 1);
    const casadas = new Set();
    for (const gatilho of GATILHOS) {
      if (gatilho.apenas && !gatilho.apenas.includes(classe)) continue;
      const regex = gatilho.rotulo(classe);
      for (const c of linha1.caracteristicas) {
        if (regex.test(c)) casadas.add(c);
      }
    }
    if (casadas.size > 0) achados[classe] = [...casadas].sort();
  }
  assert.deepEqual(achados, { 'Guerreiro': ['Estilo de Luta'] },
    'nível 1 não deveria casar com nenhum rótulo de gatilho além do ' +
    'Estilo de Luta do Guerreiro (coberto pelo fluxo de criação, não por levelup.js)');
});

// ============================================================
// TESTE CONVERSO (achado fora desta suíte, por um humano usando o app,
// 2026-08-07 -- ver "A lição do incremento Ladino nv6" no
// GUIA-PROXIMOS-DOMINIOS.md): o laço de GATILHOS acima faz, para CADA
// FUNÇÃO, a pergunta "ela dispara exatamente onde o livro manda?" -- e
// `apenas` responde "não deveria disparar fora desta(s) classe(s))" para
// as outras 11. Isso deixa uma pergunta sem resposta: para os rótulos que
// os oito ROTULOS_GATILHO já reconhecem (NÃO todo rótulo do livro que
// exige escolha -- ver o LIMITE DECLARADO logo abaixo, Minor 1 da revisão
// independente), será que alguma função dispara para eles em QUALQUER
// classe? Uma característica que o app esqueceu inteira (nenhuma das
// oito funções a reconhece em lugar nenhum) nunca aparece no laço acima,
// porque o valor esperado ali também é `false` fora do escopo de
// `apenas` -- os dois lados concordam, o teste passa, e a lacuna fica
// invisível. Foi exatamente isso que escondeu Ladino nível 6
// "Especialista": a regex de `especializacaoGuardiao` casa com a célula
// (ela é só `/^Especialista$/`, sem saber de classe), mas o gatilho
// correspondente do laço acima tem `apenas: ['Guardião']`, então o
// Ladino nunca era exercitado -- e não existe (nem existia) nenhuma
// `exigeEspecializacaoLadino` em levelup.js para outra função pegar o
// caso.
//
// Este bloco faz a pergunta OPOSTA, IGNORANDO `apenas` dos dois lados:
// reusa os mesmos ROTULOS_GATILHO (via `GATILHOS`, acima) para decidir
// SE um rótulo específico exige escolha -- e então exige que ALGUMA
// função CUJO PRÓPRIO RÓTULO CASOU com ele, chamada sem restrição de
// classe, dispare para aquele (classe, nível). Não precisa de uma lista
// de rótulos separada: os mesmos oito padrões que já identificam "isto é
// uma escolha que exige mecanismo" continuam sendo a fonte.
//
// ACHADO da revisão independente (Important 2, 2026-08-07): a primeira
// versão perguntava "alguma das oito funções dispara NESTE NÍVEL?", sem
// exigir que fosse a função do PRÓPRIO rótulo -- um nível com dois
// rótulos de escolha deixava um mecanismo presente encobrir um ausente.
// Prova do revisor: Guardião nível 2 tem dois rótulos, "Estilo de Luta"
// e "Explorador Hábil"; fingindo que "Explorador Hábil" não tinha
// tratamento nenhum, o teste antigo continuava verde, porque
// `exigeEstiloLuta` dispara no MESMO nível (por um rótulo DIFERENTE) e
// "alguma função dispara?" não perguntava qual. `gatilhosDoRotulo`
// restringe a cobertura exigida às funções cujo regex casou com aquele
// rótulo específico -- a de "Estilo de Luta" não pode mais cobrir a de
// "Explorador Hábil".
//
// LIMITE DECLARADO (Minor 1, mesma revisão): este detector só enxerga
// rótulos que ROTULOS_GATILHO reconhece -- e ROTULOS_GATILHO foi curado
// a partir das OITO FUNÇÕES QUE O APP JÁ TEM, não a partir de uma
// varredura do livro. Medido (não suposto): dos 138 rótulos distintos
// que aparecem nas 240 células do catálogo, só 19 casam com algum
// ROTULOS_GATILHO -- os outros 119 (ex.: "Maestria em Arma" do Ladino,
// Classes.md:4222-4224, "dois tipos de armas à sua escolha"; "Gíria dos
// Ladrões", "outro idioma à sua escolha") são invisíveis para este
// teste, mesmo que exijam escolha do jogador e o app não tenha
// mecanismo nenhum para eles. O Ladino nv6 só foi pego porque
// `especializacaoGuardiao` (`/^Especialista$/`) é agnóstica de classe;
// um rótulo esquecido com regex própria continuaria invisível aqui. Ver
// "Como aplicar" da lição no GUIA-PROXIMOS-DOMINIOS.md para o que cobrir
// esse resto exigiria (curar a lista de rótulos a partir do LIVRO).
function gatilhosDoRotulo(classe, label) {
  return GATILHOS.filter((g) => g.rotulo(classe).test(label));
}
function algumRotuloDeEscolhaCasa(classe, label) {
  return gatilhosDoRotulo(classe, label).length > 0;
}

// Nível 1 fica de fora do laço célula-a-célula abaixo pelo mesmo motivo
// estrutural do teste anterior (as oito funções nunca são chamadas com
// nível 1) -- mas, diferente daquele teste (que só confirma que nada
// além do Guerreiro casa DENTRO do escopo de `apenas`), este confere o
// universo INTEIRO, sem `apenas`, e por isso pega também "Especialização"
// do Ladino no nível 1 (que o teste anterior não via, porque
// `especializacaoBardo` tem `apenas: ['Bardo']`). A lista de exceções
// (EXCECOES_ESCOLHA_NIVEL_1, catalogo/classes.mjs) precisa ser EXATA:
// se um rótulo de nível 1 aparecer fora dela, é porque uma classe nova
// ganhou uma escolha ali, e alguém precisa decidir o que fazer -- não é
// para ser silenciosamente ignorado, o mesmo erro que esta rodada inteira
// existe para fechar.
//
// A segunda metade (Important 1) confronta o lado do APP, não só o do
// livro: cada exceção precisa ter um mecanismo REAL em
// CLASSES_ESCOLHAS (site/js/creator/comum.js, importado via
// modulosApp() como `criador`) -- a chave existe, aceita nível 1
// (`nivelMinimo <= 1`) e pede a quantidade de escolhas que o livro
// manda (`maxEscolhas === escolhas`). Sem isto, a lista de exceções era
// só prosa no comentário do catálogo: apagar o mecanismo do app não
// derrubava nenhum teste.
test('nível 1 (sem apenas): todo rótulo que exige escolha está na lista curada de exceções, e cada exceção tem mecanismo real em CLASSES_ESCOLHAS', () => {
  const achados = [];
  for (const classe of CLASSES) {
    const linha1 = PROGRESSAO[classe].find((l) => l.nivel === 1);
    for (const label of linha1.caracteristicas) {
      if (algumRotuloDeEscolhaCasa(classe, label)) achados.push({ classe, rotulo: label });
    }
  }
  const porChave = (x) => `${x.classe}::${x.rotulo}`;
  assert.deepEqual(
    achados.slice().sort((a, b) => porChave(a).localeCompare(porChave(b))),
    EXCECOES_ESCOLHA_NIVEL_1.map(({ classe, rotulo }) => ({ classe, rotulo }))
      .sort((a, b) => porChave(a).localeCompare(porChave(b))),
    'o conjunto de rótulos de nível 1 que exigem escolha mudou -- atualize ' +
    'EXCECOES_ESCOLHA_NIVEL_1 (catalogo/classes.mjs) e confirme o novo ' +
    'mecanismo de cada um antes de aceitar a mudança');

  // Lado do APP: cada exceção precisa apontar para um mecanismo que
  // exista de verdade em CLASSES_ESCOLHAS, não só em prosa.
  for (const exc of EXCECOES_ESCOLHA_NIVEL_1) {
    const config = criador.CLASSES_ESCOLHAS?.[exc.classe]?.[exc.chaveEscolha];
    assert.ok(config,
      `${exc.classe}: CLASSES_ESCOLHAS não tem o mecanismo '${exc.chaveEscolha}' que a ` +
      `exceção de nível 1 do rótulo "${exc.rotulo}" cita -- a exceção ficou sem cobertura ` +
      'real no app (site/js/creator/comum.js)');
    const nivelMinimo = parseInt(config.nivelMinimo || 1, 10);
    assert.ok(nivelMinimo <= 1,
      `${exc.classe}/${exc.chaveEscolha}: nivelMinimo (${config.nivelMinimo}) não cobre ` +
      'o nível 1 -- a exceção alega que o app resolve isso na criação, mas o mecanismo só ' +
      'aparece a partir de um nível maior');
    assert.equal(config.maxEscolhas, exc.escolhas,
      `${exc.classe}/${exc.chaveEscolha}: maxEscolhas (${config.maxEscolhas}) divergente ` +
      `da quantidade que o livro exige (${exc.escolhas})`);
  }
});

// Níveis 2-20: aqui as oito funções SÃO chamadas em produção, então a
// pergunta "a função DO PRÓPRIO RÓTULO dispara?" é a confrontação real.
// Um teste por classe (como o resto do arquivo) para o nome do teste
// apontar direto para quem falhou. A única célula com lacuna registrada
// hoje é Ladino nv6 "Especialista" -- ver lacunas-conhecidas.mjs, chave
// 'classes-gatilho-ausente'.
for (const classe of CLASSES) {
  test(`toda característica que exige escolha tem o gatilho do próprio rótulo (teste converso): ${classe} (níveis 2-20)`, async () => {
    for (const linha of PROGRESSAO[classe]) {
      if (linha.nivel === 1) continue; // nível 1: coberto pelo teste de exceções acima
      for (const label of linha.caracteristicas) {
        const gatilhos = gatilhosDoRotulo(classe, label);
        if (gatilhos.length === 0) continue; // rótulo fora do alcance de ROTULOS_GATILHO -- ver Minor 1 acima
        const corpo = () => {
          assert.ok(gatilhos.some((g) => g.fn(classe, linha.nivel)),
            `${classe} nv${linha.nivel}: rótulo "${label}" bate com ` +
            `${gatilhos.map((g) => g.nome).join('/')}, mas nenhuma dessas funções ` +
            'dispara para este (classe, nível)');
        };
        if (classe === 'Ladino' && linha.nivel === 6 && label === 'Especialista') {
          await comLacuna('Ladino', 'classes-gatilho-ausente', corpo);
        } else {
          corpo();
        }
      }
    }
  });
}

// ============================================================
// Manobras do Mestre da Batalha (site/js/levelup.js): exigeManobrasGuerreiro
// e getQuantidadeNovasManobras não seguem a coluna de características da
// classe Guerreiro -- a quantidade vem do texto da subclasse Mestre da
// Batalha (Classes.md, ver comentário de MANOBRAS_POR_NIVEL no catálogo).
// Confrontadas separadamente do laço de GATILHOS acima porque o gatilho
// depende de uma SUBCLASSE (terceiro parâmetro), não só classe/nível.
// ============================================================
test('exigeManobrasGuerreiro × livro (Mestre da Batalha, 20 níveis)', () => {
  for (let nivel = 1; nivel <= 20; nivel++) {
    const esperado = MANOBRAS_POR_NIVEL[nivel] !== undefined;
    assert.equal(
      levelup.exigeManobrasGuerreiro('Guerreiro', 'Mestre da Batalha', nivel),
      esperado, `Mestre da Batalha nv${nivel}`);
    // Outra subclasse de Guerreiro nunca exige manobra.
    assert.equal(
      levelup.exigeManobrasGuerreiro('Guerreiro', 'Campeão', nivel), false,
      `Campeão nv${nivel} não deveria exigir manobras`);
    // Outra classe nunca exige manobra, mesmo citando "Mestre da Batalha".
    assert.equal(
      levelup.exigeManobrasGuerreiro('Bárbaro', 'Mestre da Batalha', nivel), false,
      `Bárbaro nv${nivel} não deveria exigir manobras`);
  }
});

test('getQuantidadeNovasManobras × livro (20 níveis)', () => {
  for (let nivel = 1; nivel <= 20; nivel++) {
    assert.equal(levelup.getQuantidadeNovasManobras(nivel),
      MANOBRAS_POR_NIVEL[nivel] ?? 0, `nível ${nivel}`);
  }
});
