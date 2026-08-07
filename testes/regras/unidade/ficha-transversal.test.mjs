// ============================================================
// Confronto das fórmulas transversais da ficha com as tabelas do
// livro.
//
// `calcMod` e `bonusProficiencia` são varridos por EXAUSTÃO: o domínio
// de entrada é finito e pequeno (30 valores de atributo, 20 níveis) e
// as duas varreduras cobrem 100% dele, sem amostragem.
//
// `calcularNivelPorXP` é diferente: o domínio de entrada real é
// qualquer XP acumulado (inteiro, ilimitado), não os 20 pisos da
// tabela. Os 20 pisos por si só não provam nada sobre os valores
// ENTRE eles — uma implementação que fizesse busca exata em vez de
// "maior piso <= xp" passaria nos 20 pisos e erraria todo o resto do
// domínio sem que a varredura percebesse. Por isso este teste é
// AMOSTRADO, não exaustivo: além dos 20 pisos, cobre o interior de
// cada faixa entre dois pisos consecutivos (derivado de
// EVOLUCAO_PERSONAGEM, não hard-coded, para uma mudança na tabela não
// deixar a cobertura de interior desatualizada) e dois casos de borda
// fora da faixa do livro (XP negativo, XP muito acima do teto).
//
// A coluna de XP de EVOLUCAO_PERSONAGEM é confrontada aqui, contra
// `calcularNivelPorXP`/`XP_POR_NIVEL` de site/js/levelup.js — não deve
// ser duplicada no futuro domínio de classes/níveis (Tarefas 3 e 4
// deste projeto já encontram `levelup`/`utils`/`dadosClasses` prontos
// em `modulosApp()`, acrescentados por esta tarefa).
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { MODIFICADORES_ATRIBUTO, EVOLUCAO_PERSONAGEM, PV_NIVEL_1, PV_NIVEL_SEGUINTE, CITACOES } from '../catalogo/ficha-transversal.mjs';
import { modulosApp, lerConteudoLivro } from './harness.mjs';

// modulosApp() é cacheado (harness.mjs:52) -- uma única chamada aqui basta
// para todo o arquivo; os testes abaixo usam estas cinco bindings direto,
// sem reabrir `await modulosApp()` dentro de cada `test()`.
const { utils, levelup, dadosClasses, store } = await modulosApp();

// ============================================================
// Completude do catálogo (achado de revisão: este era o único catálogo
// da suíte sem checagem de completude -- ver completude.test.mjs para
// talentos/antecedentes, que confere bijeção catálogo × dados/). Sem
// isto, apagar entradas de MODIFICADORES_ATRIBUTO, EVOLUCAO_PERSONAGEM ou
// PV_NIVEL_1/PV_NIVEL_SEGUINTE deixaria a suíte verde, e as contagens "30/30
// valores", "20/20 níveis" e "12 classes" do README ficariam falsas em
// silêncio. Fica AQUI, e não em completude.test.mjs, porque aquele arquivo
// é cabeado especificamente para os catálogos de talentos/antecedentes
// (importa CATALOGO_TALENTOS/CATALOGO_ANTECEDENTES/LACUNAS e confronta
// contra dados/) -- este catálogo não tem um dados/ equivalente para
// bijetar contra; a "fonte da verdade" aqui É o intervalo numérico (1-30,
// 1-20) e o conjunto de chaves de CLASSES_INFO, então a checagem de
// completude é mais natural ao lado das varreduras que já usam essas
// mesmas fontes neste arquivo.
test('MODIFICADORES_ATRIBUTO cobre exatamente os valores 1 a 30, sem falta nem duplicata', () => {
  const valores = MODIFICADORES_ATRIBUTO.map((m) => m.valor);
  assert.equal(valores.length, 30, `MODIFICADORES_ATRIBUTO tem ${valores.length} entradas, esperado 30`);
  const unicos = new Set(valores);
  assert.equal(unicos.size, valores.length, 'MODIFICADORES_ATRIBUTO tem valor duplicado');
  for (let v = 1; v <= 30; v++) {
    assert.ok(unicos.has(v), `MODIFICADORES_ATRIBUTO não cobre o valor ${v}`);
  }
});

test('EVOLUCAO_PERSONAGEM cobre exatamente os níveis 1 a 20, sem falta nem duplicata', () => {
  const niveis = EVOLUCAO_PERSONAGEM.map((e) => e.nivel);
  assert.equal(niveis.length, 20, `EVOLUCAO_PERSONAGEM tem ${niveis.length} entradas, esperado 20`);
  const unicos = new Set(niveis);
  assert.equal(unicos.size, niveis.length, 'EVOLUCAO_PERSONAGEM tem nível duplicado');
  for (let n = 1; n <= 20; n++) {
    assert.ok(unicos.has(n), `EVOLUCAO_PERSONAGEM não cobre o nível ${n}`);
  }
});

test('PV_NIVEL_1 e PV_NIVEL_SEGUINTE cobrem exatamente as classes de CLASSES_INFO, sem falta nem duplicata', () => {
  const classesEsperadas = [...Object.keys(dadosClasses.CLASSES_INFO)].sort();
  for (const [nomeTabela, tabela] of [
    ['PV_NIVEL_1', PV_NIVEL_1],
    ['PV_NIVEL_SEGUINTE', PV_NIVEL_SEGUINTE],
  ]) {
    const classesCatalogo = tabela.flatMap((faixa) => faixa.classes);
    assert.equal(new Set(classesCatalogo).size, classesCatalogo.length,
      `${nomeTabela}: classe repetida entre faixas`);
    assert.deepEqual([...classesCatalogo].sort(), classesEsperadas,
      `${nomeTabela}: conjunto de classes diverge de CLASSES_INFO (dados-classes.js) -- ` +
      `esperado [${classesEsperadas.join(', ')}], catálogo tem [${[...classesCatalogo].sort().join(', ')}]`);
  }
});

// Citações reais: nenhum motor conferia se as 8 entradas de CITACOES
// apontam para um trecho que existe de fato nos arquivos do livro (achado
// de revisão -- completude.test.mjs faz o equivalente para talentos.mjs,
// mas contra um formato mais simples: um só arquivo, um só nível de
// heading `### Nome`). Aqui o formato é mais solto -- cada citação segue
// 'Arquivo.md §Alvo', opcionalmente com um sufixo ' (= Outro.md:linha)' de
// referência cruzada -- e "Alvo" tanto pode ser um heading `###` real
// (ex. 'Classe de Armadura', 'Percepção Passiva', 'Salvaguardas', 'Jogadas
// de Ataque') quanto o NOME de uma tabela sem heading próprio, impresso
// como linha solta (com ou sem `**negrito**`) antes da tabela em si (ex.
// 'Valores e Modificadores de Atributo' em Criação de Personagens.md:248,
// sem nenhum `#` na frente). Por isso a checagem aceita as duas formas:
// heading de qualquer nível OU linha solta cujo texto (sem marcação de
// negrito) bate exatamente com o Alvo.
function alvoDaCitacao(citacao) {
  const m = citacao.match(/^(.+?\.md)\s+§(.+?)(?:\s+\(=.*\))?$/);
  assert.ok(m, `citação fora do formato 'Arquivo.md §Alvo': "${citacao}"`);
  return { arquivo: m[1], alvo: m[2] };
}

function citacaoResolve(citacao) {
  const { arquivo, alvo } = alvoDaCitacao(citacao);
  const conteudo = lerConteudoLivro(arquivo);
  const linhas = conteudo.split(/\r?\n/);
  return linhas.some((linha) => {
    const semHeading = linha.replace(/^#{1,6}\s+/, '');
    const semNegrito = semHeading.replace(/^\*\*(.+)\*\*$/, '$1').trim();
    return semNegrito === alvo;
  });
}

test('toda citação de CITACOES resolve para um trecho real do livro', () => {
  for (const [chave, citacao] of Object.entries(CITACOES)) {
    assert.ok(citacaoResolve(citacao),
      `citação quebrada em CITACOES.${chave}: "${citacao}" não bate com nenhum heading nem ` +
      'linha de título de tabela no arquivo referenciado');
  }
});

test('calcMod bate com a tabela do livro em TODO valor de 1 a 30', () => {
  for (const { valor, modificador, extrapolado } of MODIFICADORES_ATRIBUTO) {
    assert.equal(utils.calcMod(valor), modificador,
      `valor ${valor}: livro (${CITACOES.modificadores}) diz ${modificador}` +
      (extrapolado ? ' [extrapolado da fórmula, não tabelado]' : ''));
  }
});

test('bonusProficiencia bate com a tabela Evolução do Personagem nos 20 níveis', () => {
  for (const { nivel, bonusProficiencia } of EVOLUCAO_PERSONAGEM) {
    assert.equal(utils.bonusProficiencia(nivel), bonusProficiencia,
      `nível ${nivel}: livro (${CITACOES.evolucao}) diz +${bonusProficiencia}`);
  }
});

test('calcularNivelPorXP bate com a coluna de XP do livro (pisos)', () => {
  for (const { nivel, xp } of EVOLUCAO_PERSONAGEM) {
    assert.equal(levelup.calcularNivelPorXP(xp), nivel,
      `XP ${xp}: livro (${CITACOES.evolucao}) diz nível ${nivel}`);
  }
});

// Cobertura de interior: os 20 pisos acima só provam o valor exato de
// cada linha da tabela. Para cada par de pisos consecutivos, confronta
// três pontos derivados da própria tabela (não hard-coded): logo acima
// do piso do nível atual, logo abaixo do piso do próximo nível, e o
// ponto médio da faixa — os três precisam classificar como o nível
// ATUAL, porque o próximo nível só começa no próximo piso.
test('calcularNivelPorXP classifica XP entre os pisos (cobertura de interior, derivada da tabela)', () => {
  for (let i = 0; i < EVOLUCAO_PERSONAGEM.length - 1; i++) {
    const atual = EVOLUCAO_PERSONAGEM[i];
    const proximo = EVOLUCAO_PERSONAGEM[i + 1];
    const candidatos = new Set([
      atual.xp + 1,
      proximo.xp - 1,
      Math.floor((atual.xp + proximo.xp) / 2),
    ]);
    for (const xp of candidatos) {
      assert.equal(levelup.calcularNivelPorXP(xp), atual.nivel,
        `XP ${xp} (entre o piso do nível ${atual.nivel}, XP ${atual.xp}, e o piso do ` +
        `nível ${proximo.nivel}, XP ${proximo.xp}): livro (${CITACOES.evolucao}) ` +
        `mantém nível ${atual.nivel} até faltar ${proximo.xp}`);
    }
  }
});

// Casos de borda fora da faixa que a tabela do livro define (0 a
// 355.000). O livro não descreve XP negativo (inatingível em jogo) nem
// nível acima de 20 (a tabela termina ali) — não há regra escrita para
// violar, então nenhum dos dois vira lacuna; o teste apenas fixa o
// comportamento real da função, para uma mudança futura não passar
// batido sem ninguém perceber.
test('calcularNivelPorXP em XP fora da faixa do livro (casos de borda)', () => {
  // XP negativo: o loop de calcularNivelPorXP procura o maior piso
  // <= xp; o menor piso é 0 (nível 1), então nenhum piso satisfaz
  // xp >= piso quando xp < 0, e a função devolve o valor inicial da
  // variável `nivel`, 1 — o nível mínimo, não um erro nem `NaN`.
  assert.equal(levelup.calcularNivelPorXP(-1), 1,
    'XP negativo (fora do domínio do jogo): calcularNivelPorXP devolve o nível mínimo, 1');

  // XP muito acima do teto: o maior piso da tabela (nível 20) é
  // satisfeito por qualquer XP >= 355000, e não há piso de nível 21
  // para superá-lo — a função permanece em 20, o teto do jogo.
  const tetoLivro = EVOLUCAO_PERSONAGEM[EVOLUCAO_PERSONAGEM.length - 1];
  const alemDoTeto = tetoLivro.xp + 1_000_000;
  assert.equal(levelup.calcularNivelPorXP(alemDoTeto), 20,
    `XP ${alemDoTeto} (muito acima do teto do livro, XP ${tetoLivro.xp}): ` +
    'calcularNivelPorXP mantém o nível máximo, 20');
});

// ============================================================
// Pontos de Vida (Tarefa 3)
// ============================================================

// PV de nível 1: CLASSES_INFO.dado_vida (site/js/dados-classes.js) confrontado
// contra PV_NIVEL_1 do catálogo, e calcPVNivel1 varrido por EXAUSTÃO nos
// modificadores de Constituição -5 a +10 (o intervalo alcançável pelo app:
// atributo mínimo 1 dá mod -5; atributo máximo 30, via Dádivas Épicas, dá
// mod +10 -- ver comentário de MODIFICADORES_ATRIBUTO no catálogo).
test('PV de nível 1 bate com a tabela do livro nas 12 classes', () => {
  for (const faixa of PV_NIVEL_1) {
    for (const classe of faixa.classes) {
      const info = dadosClasses.CLASSES_INFO[classe];
      assert.ok(info, `classe ${classe} não existe em CLASSES_INFO`);
      assert.equal(info.dado_vida, faixa.base,
        `${classe}: livro (${CITACOES.pvNivel1}) diz ${faixa.base}`);
      // Varre modificadores de Constituição de -5 a +10
      for (let modCon = -5; modCon <= 10; modCon++) {
        assert.equal(utils.calcPVNivel1(info.dado_vida, modCon), faixa.base + modCon,
          `${classe} com mod CON ${modCon}`);
      }
    }
  }
});

// PV dos níveis seguintes (2 em diante): a busca por esta regra em
// `Informacoes Separadas/` (ver relatório desta tarefa para os termos usados)
// achou o passo 2 de "Adquirindo Um Nível"
// (Criação de Personagens.md:501): "Cada vez que você adquire um nível,
// obtém um dado de vida adicional. Jogue esse dado, adicione seu
// modificador de Constituição ao resultado [...]. Em vez de jogar, você
// pode usar o valor fixo mostrado na tabela Pontos de Vida Fixos por
// Classe" -- e a própria tabela "Pontos de Vida Fixos por Classe"
// (linhas 503-510), transcrita em PV_NIVEL_SEGUINTE no catálogo, com as
// MESMAS quatro faixas de classes de PV_NIVEL_1, mas com o incremento fixo
// por nível em vez do dado de vida completo.

// calcPVTotal varrido por EXAUSTÃO nas 12 classes × níveis 1 a 20 × mod CON
// -5 a +10 (12 × 20 × 16 = 3.840 combinações). O valor esperado reproduz a fórmula do
// livro ponto a ponto: PV nível 1 (dado de vida + mod CON) mais, para cada
// nível adicional, o incremento fixo da tabela + mod CON.
test('calcPVTotal bate com a tabela "Pontos de Vida Fixos por Classe" (12 classes × níveis 1-20 × mod CON -5 a +10)', () => {
  for (const faixa of PV_NIVEL_SEGUINTE) {
    for (const classe of faixa.classes) {
      const info = dadosClasses.CLASSES_INFO[classe];
      assert.ok(info, `classe ${classe} não existe em CLASSES_INFO`);
      for (let nivel = 1; nivel <= 20; nivel++) {
        for (let modCon = -5; modCon <= 10; modCon++) {
          const esperado = info.dado_vida + modCon + (nivel - 1) * (faixa.incremento + modCon);
          assert.equal(utils.calcPVTotal(info.dado_vida, nivel, modCon), esperado,
            `${classe} nível ${nivel}, mod CON ${modCon}: livro (${CITACOES.pvNivelSeguinte}) ` +
            `diz +${faixa.incremento} (+ mod CON) por nível além do 1º`);
        }
      }
    }
  }
});

// ============================================================
// CA base, CD e ataque de magia, perícias passivas (Tarefa 4)
// ============================================================

// Bônus de Proficiência para montar o lado ESPERADO das asserções dos dois
// blocos abaixo (CD/ataque de magia e Percepção Passiva) -- nunca para o
// lado confrontado. `calcCDMagia`, `calcAtaqueMagia` (utils.js:249,265) e
// `calcPercepcaoPassiva` (utils.js:274-275) chamam `utils.bonusProficiencia`
// internamente; se o valor esperado também viesse de `utils.bonusProficiencia(nivel)`,
// um bug em como `nivel` chega até essa chamada dentro do app produziria o
// MESMO valor errado nos dois lados da asserção, e o teste nunca pegaria
// isso -- comparação do app contra ele mesmo, disfarçada de comparação
// contra o livro. Em vez disso, busca em `EVOLUCAO_PERSONAGEM` (catálogo,
// já confrontado contra a tabela "Evolução do Personagem" do livro no
// primeiro teste deste arquivo, "bonusProficiencia bate com a tabela
// Evolução do Personagem nos 20 níveis") -- dado curado do livro,
// independente da função sob teste. Falha alto (erro, não `NaN` silencioso)
// se o nível não existir na tabela.
function bonusProficienciaLivro(nivel) {
  const linha = EVOLUCAO_PERSONAGEM.find((e) => e.nivel === nivel);
  if (!linha) {
    throw new Error(
      `Nível ${nivel} não existe em EVOLUCAO_PERSONAGEM (catálogo) -- a tabela do livro vai só até nível 20`);
  }
  return linha.bonusProficiencia;
}

// CA base: `calcCA` tem ramos de classe -- Bárbaro (Defesa sem Armadura,
// utils.js:158), Monge (utils.js:162), Bardo do Colégio da Dança
// (utils.js:166) e Feiticeiro da Feitiçaria Dracônica (utils.js:170) --
// que SUBSTITUEM a fórmula transversal por uma defesa sem armadura
// específica da classe. Nenhum desses quatro é a regra transversal; são
// característica de classe e ficam para o domínio de classes/níveis
// (item 4 do mapa de domínios futuros, README.md). Por isso a varredura
// abaixo usa Guerreiro, que não tem nenhum ramo de CA especial, para
// confrontar só "10 + mod. Destreza" -- sem armadura equipada, para
// nenhum dos quatro ramos de classe poder interferir mesmo que a classe
// mudasse.
test('CA base sem armadura é 10 + mod. Destreza, para toda Destreza de 1 a 30', () => {
  for (const { valor, modificador } of MODIFICADORES_ATRIBUTO) {
    const p = store.criarPersonagemVazio();
    p.classe = 'Guerreiro';   // sem ramo de CA de classe
    p.nivel = 1;
    p.inventario = [];
    p.atributos.destreza = valor;
    assert.equal(utils.calcCA(p), 10 + modificador,
      `Destreza ${valor}: livro (${CITACOES.caBase}) diz ${10 + modificador}`);
  }
});

// CD e ataque de magia: a fórmula foi procurada em
// `Informacoes Separadas/` antes de escrever este teste (termos usados:
// "CD para evitar magia", "Bônus de ataque mágico", "atributo de
// conjuração", "Classe de Dificuldade") e apareceu em DOIS lugares
// textualmente idênticos -- `Criação de Personagens.md:441` ("CD para
// evitar magia = 8 + modificador de atributo de conjuração + Bônus de
// Proficiência") e linha 443 ("Bônus de ataque mágico = modificador de
// atributo de conjuração + Bônus de Proficiência"); e de novo em
// `Magias.md:183` (§Salvaguardas) e `Magias.md:189` (§Jogadas de
// Ataque), com a mesma redação. Isso confirma `calcCDMagia`
// (utils.js:244-257: `8 + bonusProficiencia(nivel) + modAttr`) e
// `calcAtaqueMagia` (utils.js:260-266: `bonusProficiencia(nivel) +
// modAttr`) contra o livro -- a varredura abaixo escreve o teste que o
// Step 2 desta tarefa exigia só depois de achar a citação.
//
// `calcCDMagia` tem um ramo extra para Feiticeiro (Feitiçaria Inata:
// +1 na CD, utils.js:252) além da fórmula transversal -- é
// característica de classe, como os quatro ramos de CA do teste
// anterior, e fica de fora. `store.criarPersonagemVazio()` não cria
// `personagem.recursos`, então `personagem?.recursos?.feiticeiro?.feiticaria_inata_ativa`
// é sempre falso aqui e o ramo nunca dispara -- o Feiticeiro entra na
// varredura abaixo só pela fórmula transversal.
//
// Fronteira de escopo (achado de revisão): QUEM casta com qual atributo é
// característica de classe, delegada pelo próprio livro à "característica
// que lhe confere a capacidade de conjurar a magia"
// (Criação de Personagens.md:445) -- não é a regra transversal "8 + BP +
// mod." que este teste confronta. Por isso a leitura de
// `info.atributo_conjuracao`/`ATRIBUTO_NOME_PARA_KEY` (a mesma tabela que
// `calcCDMagia` usa internamente, utils.js:247) fica como está: validar SE
// Bardo casta com Carisma pertence ao domínio de classes/níveis, não a
// este. O que este domínio PODE e DEVE afirmar é QUANTAS e QUAIS classes
// entram na varredura -- um `assert.ok(length > 0)` deixaria a suíte verde
// mesmo que uma classe conjuradora perdesse `atributo_conjuracao` (ela
// simplesmente sairia da varredura, `calcCDMagia` passaria a devolver 0
// para ela sem que nada aqui percebesse) ou ganhasse uma a mais por engano.
// As 8 classes abaixo são a lista fechada conferida contra CLASSES_INFO
// (dados-classes.js): Bardo, Bruxo, Clérigo, Druida, Feiticeiro, Guardião,
// Mago e Paladino -- as mesmas "8 classes conjuradoras" que o README e o
// plano deste domínio afirmam.
const CLASSES_CONJURADORAS_ESPERADAS = [
  'Bardo', 'Bruxo', 'Clérigo', 'Druida', 'Feiticeiro', 'Guardião', 'Mago', 'Paladino',
].sort();

test('CD e ataque de magia batem com 8+BP+mod. / BP+mod., em toda classe conjuradora × nível 1-20 × atributo de conjuração 1-30', () => {
  const classesConjuradoras = Object.entries(dadosClasses.CLASSES_INFO)
    .filter(([, info]) => info.atributo_conjuracao);
  // Conjunto EXATO, não só "não-vazio": uma classe conjuradora que perder
  // (ou ganhar) `atributo_conjuracao` precisa deixar este teste vermelho,
  // não encolher/crescer a varredura em silêncio.
  assert.deepEqual(
    classesConjuradoras.map(([nome]) => nome).sort(),
    CLASSES_CONJURADORAS_ESPERADAS,
    `conjunto de classes conjuradoras em CLASSES_INFO mudou: esperado ` +
    `[${CLASSES_CONJURADORAS_ESPERADAS.join(', ')}], encontrado ` +
    `[${classesConjuradoras.map(([nome]) => nome).sort().join(', ')}]`);
  for (const [classe, info] of classesConjuradoras) {
    const key = dadosClasses.ATRIBUTO_NOME_PARA_KEY[info.atributo_conjuracao];
    for (let nivel = 1; nivel <= 20; nivel++) {
      const bp = bonusProficienciaLivro(nivel);
      for (const { valor, modificador } of MODIFICADORES_ATRIBUTO) {
        const p = store.criarPersonagemVazio();
        p.classe = classe;
        p.nivel = nivel;
        p.atributos[key] = valor;
        assert.equal(utils.calcCDMagia(p), 8 + bp + modificador,
          `${classe} nível ${nivel}, ${info.atributo_conjuracao} ${valor}: ` +
          `livro (${CITACOES.cdMagia}) diz 8 + ${bp} + ${modificador}`);
        assert.equal(utils.calcAtaqueMagia(p), bp + modificador,
          `${classe} nível ${nivel}, ${info.atributo_conjuracao} ${valor}: ` +
          `livro (${CITACOES.ataqueMagia}) diz ${bp} + ${modificador}`);
      }
    }
  }
});

// Percepção Passiva: `calcPercepcaoPassiva` tem um ramo de Bardo
// (utils.js:276-278, "Pau pra Toda Obra": metade do Bônus de
// Proficiência em perícias sem proficiência nem Especialização) além da
// fórmula transversal -- característica de classe, fora do escopo deste
// domínio, como os ramos de CA do primeiro teste. A varredura usa
// Guerreiro, sem esse ramo.
//
// Os "quatro estados" do brief da tarefa são, na prática, só três: sem
// proficiência, com proficiência, e com proficiência + Especialização.
// O livro (`Abreviações e Definição de Regras.md:530`, §Especialização)
// proíbe adquirir Especialização numa perícia em que não se é
// proficiente ("deve aplicá-la a uma perícia na qual já seja
// proficiente") -- não existe um quarto estado "Especialização sem
// proficiência" para varrer; `calcPercepcaoPassiva` até aceitaria essa
// combinação (os dois `if` são independentes um do outro), mas ela nunca
// ocorre num personagem que o resto do app produz, então varrê-la
// provaria uma combinação inatingível, não a regra do livro.
test('Percepção Passiva bate com 10 + bônus do teste de Sabedoria (Percepção), em sem/com proficiência e com Especialização, níveis 1-20', () => {
  const estados = [
    { prof: false, exp: false, rotulo: 'sem proficiência' },
    { prof: true, exp: false, rotulo: 'com proficiência' },
    { prof: true, exp: true, rotulo: 'com proficiência e Especialização' },
  ];
  for (const { valor, modificador } of MODIFICADORES_ATRIBUTO) {
    for (let nivel = 1; nivel <= 20; nivel++) {
      const bp = bonusProficienciaLivro(nivel);
      for (const { prof, exp, rotulo } of estados) {
        const p = store.criarPersonagemVazio();
        p.classe = 'Guerreiro'; // sem ramo de Percepção Passiva de classe
        p.nivel = nivel;
        p.atributos.sabedoria = valor;
        p.pericias_proficientes = prof ? ['Percepção'] : [];
        p.pericias_expertise = exp ? ['Percepção'] : [];
        const esperado = 10 + modificador + (prof ? bp : 0) + (exp ? bp : 0);
        assert.equal(utils.calcPercepcaoPassiva(p), esperado,
          `Sabedoria ${valor}, nível ${nivel}, ${rotulo}: ` +
          `livro (${CITACOES.percepcaoPassiva}) diz ${esperado}`);
      }
    }
  }
});
