// ============================================================
// Motor comportamental do domínio classes/níveis: sobe um personagem
// de cada classe do nível 1 ao 20 e confronta o personagem resultante,
// em CADA um dos 20 níveis, contra a linha correspondente da tabela do
// livro (12 classes × 20 níveis).
//
// O nível 1 é confrontado contra a SEMENTE (`personagemSemente`, sem
// nenhuma chamada a `subirDeNivel`: o personagem NASCE nesse nível, não
// "sobe" até ele). Os níveis 2 a 20 são confrontados a cada chamada real
// de `subirDeNivel()` (site/js/levelup.js), via `escadaDeNivel`.
//
// Isto é o que classes.test.mjs NÃO faz: lá a pergunta é "a tabela do
// app bate com a do livro?"; aqui é "o app aplica a tabela ao
// personagem?". As duas podem divergir -- uma tabela certa lida pelo
// código errado passa no motor estrutural e falha aqui.
//
// Roda em node:test sem navegador porque db.js consegue ler dados/ do
// disco pelo stub de fetch do harness (ver harness.mjs).
//
// LIMITES DECLARADOS (para "24 testes verdes" não parecer uma garantia
// maior do que é):
//   - Bônus de Proficiência: a asserção é utils×catálogo, não
//     comportamental -- `subirDeNivel` não grava um campo de bônus de
//     proficiência no personagem (o app deriva na hora, via
//     `utils.bonusProficiencia(nivel)`), então não existe `p.<algo>`
//     para confrontar. O que se afirma é que a FUNÇÃO utilitária bate
//     com a coluna da classe, não que `subirDeNivel` "aplicou" o bônus a
//     algum campo da ficha.
//   - As colunas específicas de cada classe (`COLUNAS_POR_CLASSE` no
//     catálogo: Truques, Magias Preparadas, Fúrias, Dano da Fúria,
//     Maestria em Arma, Recuperar Fôlego, Artes Marciais, Pontos de
//     Foco, Ataque Furtivo, etc.) NÃO são afirmadas por este motor. Ele
//     confronta bônus de proficiência, PV e espaços de magia -- não os
//     recursos por classe dessas colunas (fora do escopo desta tarefa).
//   - As pendências 'grimorio', 'subclasse_magias_arcana' e
//     'talento_asi' aparecem na escada mas não são confrontadas contra
//     o livro aqui -- ver comentário junto ao bloco de pendências, mais
//     abaixo, para o motivo de cada uma.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { PROGRESSAO, ROTULOS_GATILHO, TRACOS_BASICOS } from '../catalogo/classes.mjs';
import { MODIFICADORES_ATRIBUTO, PV_NIVEL_1, PV_NIVEL_SEGUINTE } from '../catalogo/ficha-transversal.mjs';
import { escadaDeNivel, personagemSemente, modulosApp } from './harness.mjs';

const { utils } = await modulosApp();
const CLASSES = Object.keys(PROGRESSAO);

// ------------------------------------------------------------
// PV esperado por nível.
//
// A Constituição NÃO é constante ao longo da escada: a escolha
// canônica de ASI (harness.mjs, primeiroAtributoAbaixoDe20) sobe o
// primeiro atributo <=18 na ordem força/destreza/constituição/...,
// então classes com mais janelas de ASI acabam elevando também a
// Constituição mais vezes -- e o Bárbaro ainda ganha +4
// Força/Constituição automaticamente no capstone de nível 20
// (levelup.js:1681-1692). Um cálculo de PV que apenas SOMA a cada
// nível o ganho fixo usando o modCon CORRENTE daquele nível (a
// abordagem ingênua) só estaria certo se um aumento de Constituição
// não fosse retroativo -- e ele é.
//
// Regra do livro encontrada em
// `Informacoes Separadas/Criação de Personagens.md:516`, dentro de
// "Adquirindo um Nível" > passo 5 "Ajuste os Modificadores de
// Atributo":
//   "Quando seu modificador de Constituição aumenta em 1, seus
//   Pontos de Vida máximos aumentam em 1 para cada nível que você
//   atingiu. Por exemplo, se um personagem atinge o nível 8 e
//   aumenta o valor de Constituição de 17 para 18, o modificador de
//   Constituição aumenta para +4. Os Pontos de Vida máximos do
//   personagem, então, aumentam em 8, além dos Pontos de Vida
//   recebidos ao atingir o nível 8."
// site/js/levelup.js:1290-1298 implementa exatamente essa fórmula
// (`bonusConRetroativo = (modConDepois - modConAntes) * novoNivel`),
// e o capstone do Bárbaro (levelup.js:1681-1692) reaproveita a mesma
// lógica -- então o app SEGUE a regra do livro aqui (achado positivo:
// não é a divergência que se esperava ao ler só o brief).
//
// Termos de busca tentados em `Informacoes Separadas/` antes de achar
// a linha 516: "Constituição" e "Pontos de Vida"/"PV máxim" em
// `Abreviações e Definição de Regras.md` (só definições soltas de PV,
// Dados de Vida etc., sem regra de ajuste retroativo) e em
// `Criação de Personagens.md` (achou, seção "Avanço de Nível").
//
// Por indução (ver task-8-report.md para o passo a passo): como a
// Constituição nunca CAI em toda a escada canônica (só ASI e o
// capstone do Bárbaro tocam atributos, e ambos somam), a regra
// retroativa colapsa numa fórmula fechada -- o PV máximo no nível N é
// como se o modificador de Constituição ATUAL (lido de
// `p.atributos.constituicao` no momento do callback, já com qualquer
// ASI daquele MESMO nível aplicado) tivesse valido para os N níveis
// inteiros, não só a partir de quando mudou:
//
//   pv(N) = pv1Base + (N-1) * incremento + modCon(N) * N
//
// pv1Base e incremento vêm de `PV_NIVEL_1`/`PV_NIVEL_SEGUINTE`
// (`ficha-transversal.mjs`, catálogo do domínio anterior, transcrito de
// `Criação de Personagens.md:416-421` e `:503-510`) -- NÃO de
// `Math.floor(dadoVida / 2) + 1` calculado a partir de `TRACOS_BASICOS`.
// Essa derivação é, literalmente, a mesma expressão de
// `site/js/levelup.js:351`: usá-la aqui faria o esperado copiar a FORMA
// do cálculo do app, e um erro na forma (não só no valor) ficaria
// invisível -- a tabela fechada do livro não tem esse risco porque não
// deriva de nada, é transcrição direta de duas linhas de tabela.
// modCon(N) vem de `MODIFICADORES_ATRIBUTO` (mesmo catálogo), não de
// `utils.calcMod` -- `utils.calcMod` é a MESMA função que
// `levelup.js:929/1341/1686` chama por dentro para aplicar a regra
// retroativa; usá-la aqui violaria "o esperado nunca vem de um helper
// que a função sob teste chama por dentro". `constituicaoAtual` continua
// vindo do PRÓPRIO personagem (`p.atributos.constituicao`) -- efeito
// colateral da escolha canônica de ASI que o harness controla, não do
// cálculo de PV sob teste.
function pv1Base(classe) {
  const linha = PV_NIVEL_1.find((l) => l.classes.includes(classe));
  if (!linha) throw new Error(`PV_NIVEL_1 (ficha-transversal.mjs) sem entrada para ${classe}`);
  return linha.base;
}
function incrementoPorNivel(classe) {
  const linha = PV_NIVEL_SEGUINTE.find((l) => l.classes.includes(classe));
  if (!linha) throw new Error(`PV_NIVEL_SEGUINTE (ficha-transversal.mjs) sem entrada para ${classe}`);
  return linha.incremento;
}
function modAtributoLivro(valor) {
  const linha = MODIFICADORES_ATRIBUTO.find((m) => m.valor === valor);
  if (!linha) throw new Error(`MODIFICADORES_ATRIBUTO (ficha-transversal.mjs) sem entrada para valor ${valor}`);
  return linha.modificador;
}
function pvEsperadoNoNivel(classe, constituicaoAtual, nivel) {
  const modCon = modAtributoLivro(constituicaoAtual);
  return pv1Base(classe) + (nivel - 1) * incrementoPorNivel(classe) + modCon * nivel;
}

for (const classe of CLASSES) {
  test(`subida 1→20 aplica a tabela do livro: ${classe}`, async () => {
    const linhaDo = (nivel) => PROGRESSAO[classe].find((l) => l.nivel === nivel);

    // --- Nível 1: confrontado contra a SEMENTE, não contra
    // `subirDeNivel` (que nunca é chamado para "subir" ao nível 1 --
    // ver cabeçalho do arquivo). Sem este bloco a linha 1 de cada
    // tabela nunca seria confrontada por NENHUM motor deste domínio --
    // achado da revisão independente, confirmado por mutação: mudar
    // `bonusProficiencia` do Bárbaro nível 1 no catálogo deixava esta
    // suíte inteira verde antes desta correção.
    const linha1 = linhaDo(1);
    const semente = await personagemSemente(classe);
    assert.equal(utils.bonusProficiencia(semente.nivel), linha1.bonusProficiencia,
      `${classe} nv1: bônus de proficiência`);
    // PV do nível 1: `personagemSemente` (harness.mjs, Task 7) GRAVA
    // esse valor direto (dado de vida cheio + mod. de Constituição 14,
    // hardcoded) -- não é `subirDeNivel` quem o calcula, porque não há
    // "subida" para o nível 1. Esta asserção confere o FIXTURE de teste
    // contra o livro (pega o fixture se ele um dia divergir da tabela),
    // não um caminho de código do app: não é evidência de que a criação
    // de personagem REAL do app (site/js/creator/*, fora deste domínio)
    // calcula PV de nível 1 corretamente.
    const pvEsperado1 = pvEsperadoNoNivel(classe, semente.atributos.constituicao, 1);
    assert.equal(semente.pv_max, pvEsperado1, `${classe} nv1: PV máximo (fixture × livro)`);
    // LIMITE DECLARADO: espaços de magia do nível 1 NÃO são confrontados
    // aqui. `personagemSemente` não popula `espacos_magia` -- o campo
    // vem só do valor-padrão `{}` de `store.criarPersonagemVazio()`,
    // igual para as 12 classes, não calculado a partir da classe/nível.
    // Afirmar `semente.espacos_magia` contra a linha 1 do catálogo aqui
    // acusaria as 8 classes conjuradoras de "quebradas" no nível 1 por
    // um motivo que é do FIXTURE (Task 7 não precisava desse campo para
    // nada que já testasse), não do app -- o falso positivo que este
    // domínio existe para evitar.

    const final = await escadaDeNivel(classe, (p, nivel) => {
      const linha = linhaDo(nivel);

      // Bônus de Proficiência: cada classe repete a mesma progressão da
      // tabela Evolução do Personagem. Essa tabela em si já está coberta
      // por ficha-transversal.test.mjs; o que se afirma aqui é que a
      // coluna DA CLASSE bate com ela, classe por classe. (Ver LIMITE
      // DECLARADO no cabeçalho: isto é utils×catálogo, não
      // comportamental.)
      assert.equal(utils.bonusProficiencia(p.nivel), linha.bonusProficiencia,
        `${classe} nv${nivel}: bônus de proficiência`);

      // PV máximo: ver pvEsperadoNoNivel acima para a fórmula (regra
      // retroativa de Constituição, Criação de Personagens.md:516,
      // tabelas PV_NIVEL_1/PV_NIVEL_SEGUINTE de ficha-transversal.mjs) e
      // por que ela difere de uma soma ingênua com o modCon de cada
      // nível isoladamente.
      const pvEsperado = pvEsperadoNoNivel(classe, p.atributos.constituicao, nivel);
      assert.equal(p.pv_max, pvEsperado, `${classe} nv${nivel}: PV máximo`);

      // Espaços de magia gravados no personagem = colunas 1-9 do livro.
      if (linha.espacos !== null) {
        const totais = {};
        for (const [circulo, dadosCirculo] of Object.entries(p.espacos_magia || {})) {
          totais[circulo] = dadosCirculo.total;
        }
        assert.deepEqual(totais, linha.espacos,
          `${classe} nv${nivel}: espaços de magia`);
      } else {
        assert.deepEqual(p.espacos_magia ?? {}, {},
          `${classe} nv${nivel}: classe sem conjuração não deveria ter espaços`);
      }
    });

    assert.equal(final.nivel, 20, `${classe} deveria terminar no nível 20`);
  });
}

// Pendências de classe única com rótulo canônico em `ROTULOS_GATILHO`
// (catálogo, Task 6) e gatilho de classe única em levelup.js. Cada
// entrada só é confrontada contra o livro DENTRO da(s) classe(s) dona(s)
// -- fora dela, só se afirma que a pendência NUNCA dispara. Aplicar o
// rótulo fora da classe dona pegaria texto de OUTRA escolha que por
// coincidência usa a mesma palavra no livro: "Especialista" nomeia tanto
// Bardo (níveis 2/9, via `especializacaoBardo`) quanto Guardião (nível
// 9) e Ladino (nível 6) -- só Guardião dispara 'guardiao_expertise' de
// verdade (levelup.js:451, `exigeEspecializacaoGuardiao`); é por isso
// que `classes.test.mjs` (Task 6) já escopa esses mesmos rótulos com
// `apenas: [...]`, e este motor replica o mesmo escopo.
const PENDENCIAS_DE_CLASSE_UNICA = [
  // levelup.js:444, exigeEspecializacaoBardo.
  { tipo: 'bardo_expertise', classes: ['Bardo'], rotulo: ROTULOS_GATILHO.especializacaoBardo() },
  // levelup.js:451, exigeEspecializacaoGuardiao.
  { tipo: 'guardiao_expertise', classes: ['Guardião'], rotulo: ROTULOS_GATILHO.especializacaoGuardiao() },
  // levelup.js:458, exigeEstiloLuta -- Guardião OU Paladino, não Guerreiro
  // (conferido direto na função do app, não suposto).
  { tipo: 'estilo_luta', classes: ['Guardião', 'Paladino'], rotulo: ROTULOS_GATILHO.estiloLuta() },
  // levelup.js:505, exigeExploradorHabil.
  { tipo: 'explorador_habil', classes: ['Guardião'], rotulo: ROTULOS_GATILHO.exploradorHabil() },
  // levelup.js:512, exigeAcademico.
  { tipo: 'academico', classes: ['Mago'], rotulo: ROTULOS_GATILHO.academico() },
];

// O app exigiu escolha de subclasse exatamente nos níveis em que o livro
// lista "Subclasse <Classe>" na coluna de características? Uma pendência
// a mais é exigência inventada; uma a menos é o app deixando o
// personagem subir sem escolher o que o livro manda escolher. O mesmo
// para Aumento no Valor de Atributo, para 'dadiva_epica' do nível 19, e
// para as 5 pendências de classe única acima.
for (const classe of CLASSES) {
  test(`as escolhas exigidas batem com o livro: ${classe}`, async () => {
    const exigidasPorNivel = new Map();
    await escadaDeNivel(classe, (p, nivel, pendencias) => {
      exigidasPorNivel.set(nivel, pendencias);
    });

    // Rótulo vem do catálogo (ROTULOS_GATILHO.subclasse), não
    // redefinido à mão -- as duas versões concordavam por coincidência
    // antes desta correção.
    const niveisComSubclasseNoLivro = PROGRESSAO[classe]
      .filter((l) => l.caracteristicas.some((c) => ROTULOS_GATILHO.subclasse(classe).test(c)))
      .map((l) => l.nivel);
    const niveisComPendenciaSubclasse = [...exigidasPorNivel.entries()]
      .filter(([, tipos]) => tipos.includes('subclasse'))
      .map(([nivel]) => nivel);
    assert.deepEqual(niveisComPendenciaSubclasse, niveisComSubclasseNoLivro,
      `${classe}: níveis que exigem subclasse`);

    // NÃO usa `ROTULOS_GATILHO.aumentoAtributo` aqui de propósito: esse
    // rótulo casa com "Aumento no Valor de Atributo" OU "Dádiva Épica"
    // por decisão da Task 6 (ele espelha o portão `concedeAumentoAtributo`,
    // que é true nas DUAS células) -- usá-lo faria o nível 19 entrar
    // nesta lista também, contradizendo a checagem de 'dadiva_epica'
    // logo abaixo, que trata os dois tipos de pendência como distintos
    // (o que realmente são: a escada nunca vê 'aumento_atributo' no
    // nível 19, só 'dadiva_epica' seguido de 'talento_asi' -- ver
    // resolverPendencia em harness.mjs). Por isso o rótulo aqui é o
    // texto exato "Aumento no Valor de Atributo", não o regex composto.
    const niveisComASINoLivro = PROGRESSAO[classe]
      .filter((l) => l.caracteristicas.includes('Aumento no Valor de Atributo'))
      .map((l) => l.nivel);
    const niveisComPendenciaASI = [...exigidasPorNivel.entries()]
      .filter(([, tipos]) => tipos.includes('aumento_atributo'))
      .map(([nivel]) => nivel);
    assert.deepEqual(niveisComPendenciaASI, niveisComASINoLivro,
      `${classe}: níveis que exigem Aumento no Valor de Atributo`);

    // 'dadiva_epica' é uma pendência DISTINTA de 'aumento_atributo' (ver
    // resolverPendencia em harness.mjs) -- dispara nos níveis em que o
    // livro lista "Dádiva Épica" na coluna de características (rótulo
    // do catálogo: ROTULOS_GATILHO.dadivaEpica); nas 12 classes isso só
    // acontece no nível 19. Isto só afirma que a pendência foi EXIGIDA
    // -- não que uma Dádiva Épica de verdade foi concedida: a escada
    // resolve essa pendência com o talento genérico de ASI, não com um
    // "Dádiva do/da X" (ver AVISO PARA A TASK 8 em harness.mjs, dentro
    // de resolverPendencia). Afirmar a concessão real exigiria um
    // caminho de escada que a Task 7 deliberadamente não oferece.
    const niveisComDadivaEpicaNoLivro = PROGRESSAO[classe]
      .filter((l) => l.caracteristicas.some((c) => ROTULOS_GATILHO.dadivaEpica().test(c)))
      .map((l) => l.nivel);
    const niveisComPendenciaDadivaEpica = [...exigidasPorNivel.entries()]
      .filter(([, tipos]) => tipos.includes('dadiva_epica'))
      .map(([nivel]) => nivel);
    assert.deepEqual(niveisComPendenciaDadivaEpica, niveisComDadivaEpicaNoLivro,
      `${classe}: níveis que exigem a pendência de Dádiva Épica (não a característica em si)`);

    // As 5 pendências de classe única (ver PENDENCIAS_DE_CLASSE_UNICA
    // acima) -- Especialização de Bardo/Guardião, Estilo de Luta,
    // Explorador Hábil e Acadêmico.
    for (const { tipo, classes: classesDonas, rotulo } of PENDENCIAS_DE_CLASSE_UNICA) {
      const niveisComPendencia = [...exigidasPorNivel.entries()]
        .filter(([, tipos]) => tipos.includes(tipo))
        .map(([nivel]) => nivel);
      if (!classesDonas.includes(classe)) {
        // Fora da(s) classe(s) dona(s), a pendência nunca deveria
        // disparar -- o gatilho em levelup.js é condicionado à classe.
        assert.deepEqual(niveisComPendencia, [],
          `${classe}: pendência '${tipo}' não deveria disparar (dona: ${classesDonas.join('/')})`);
        continue;
      }
      const niveisNoLivro = PROGRESSAO[classe]
        .filter((l) => l.caracteristicas.some((c) => rotulo.test(c)))
        .map((l) => l.nivel);
      assert.deepEqual(niveisComPendencia, niveisNoLivro,
        `${classe}: níveis que exigem '${tipo}'`);
    }

    // LIMITE DECLARADO: 'grimorio', 'subclasse_magias_arcana' e
    // 'talento_asi' aparecem em PENDENCIAS_CONHECIDAS (harness.mjs) e a
    // escada as resolve de verdade, mas NENHUMA das três é confrontada
    // contra o livro nesta suíte:
    //   - 'grimorio' (Mago, todo nível >1): não tem uma característica
    //     de coluna própria no livro -- o crescimento do grimório segue
    //     a coluna "Magias Preparadas" da tabela de conjuração, que já
    //     não é afirmada por este motor (ver LIMITE DECLARADO de
    //     colunas no cabeçalho do arquivo); não há rótulo em
    //     ROTULOS_GATILHO para reaproveitar.
    //   - 'subclasse_magias_arcana' (só as 4 subclasses de Mago que
    //     ganham escola de magia bônus): características de SUBCLASSE
    //     são, por design deste domínio, "a rodada seguinte" (ver
    //     comentário de `SUBCLASSES` em classes.mjs) -- o catálogo desta
    //     tarefa não tem uma tabela nível-a-nível de subclasse para
    //     confrontar.
    //   - 'talento_asi': sempre aparece imediatamente APÓS
    //     'dadiva_epica' na mesma resolução de nível (resolverPendencia
    //     em harness.mjs trata os dois tipos no mesmo `case`), e não tem
    //     rótulo próprio em ROTULOS_GATILHO que a distinga de
    //     'aumento_atributo' -- confrontá-la exigiria inferir da
    //     SEQUÊNCIA de pendências do app (implementação), não de uma
    //     citação do livro, o que este domínio evita de propósito.
  });
}

// ------------------------------------------------------------
// Perguntas que NENHUMA frase do livro responde diretamente.
//
// A lição do motor de escolha morta (GUIA-PROXIMOS-DOMINIOS.md): a
// pergunta "que frase do livro isto testa?" vira um teto -- uma regra
// que o livro nunca precisa dizer em voz alta fica fora do exercício de
// desenhar o motor, e o sintoma não é teste vermelho, é a AUSÊNCIA de
// teste. As cinco asserções abaixo (três por classe + duas standalone --
// contagem conferida nos `test()` de verdade do bloco, correção da revisão
// final: o texto antigo dizia "seis... quatro por classe + duas standalone",
// contando errado as próprias asserções que declara) NÃO citam nenhuma
// seção do livro -- a fonte é o bom senso de quem
// usaria o app, não uma frase de Classes.md. Isto é declarado aqui por
// escrito de propósito: um teste sem fonte que não diz que não tem
// fonte parece uma alegação sobre o livro que não é.
// ------------------------------------------------------------

for (const classe of CLASSES) {
  test(`nenhum espaço de magia diminui ao subir: ${classe}`, async () => {
    // Nenhuma frase do livro diz "espaços de magia nunca diminuem" --
    // é bom senso de quem usaria o app (perder magia ao subir de nível
    // pareceria um bug óbvio a qualquer jogador).
    //
    // DECISÃO SOBRE O NÍVEL 1: `escadaDeNivel` só chama este callback
    // nos níveis 2 a 20 (o nível 1 vem da semente, `personagemSemente`,
    // sem passar por `subirDeNivel` -- ver cabeçalho do arquivo). A
    // primeira comparação POSSÍVEL seria semente (nível 1) contra nível
    // 2, mas esta asserção NÃO a inclui: `personagemSemente` (harness.mjs)
    // nunca popula `espacos_magia` -- o campo fica no `{}` padrão de
    // `store.criarPersonagemVazio()`, igual para as 12 classes (mesmo
    // LIMITE DECLARADO do cabeçalho deste arquivo) -- comparar contra
    // ele não afirmaria nada sobre o app, só repetiria o mesmo `{}`
    // vazio que `anterior = {}` abaixo já produz sozinho. A primeira
    // comparação REAL feita por este teste é nível 2 contra nível 3.
    //
    // ACHADO (não é bug do app -- investigado e descartado): a primeira
    // versão desta asserção comparava círculo a círculo em TODAS as
    // classes e falhava em "Bruxo nv3: círculo 1 caiu de 2 para 0".
    // Investigando: Magia de Pacto (Bruxo) não acumula espaços em vários
    // círculos como Bardo/Mago -- ele tem só UM círculo ATIVO de cada
    // vez, e o círculo sobe de nível junto com o personagem (comentário
    // de `PROGRESSAO.Bruxo` em classes.mjs, linhas 608-616). No nível 3
    // o livro literalmente MOVE os 2 espaços do círculo 1 para o círculo
    // 2 -- não é perda de magia, é upgrade; o círculo 1 zera porque
    // deixou de existir para o Bruxo, não porque o app perdeu algo. Isso
    // é comportamento CORRETO: `PROGRESSAO.Bruxo` (catalogo/classes.mjs)
    // transcreve essa mesma tabela do livro, e o teste estrutural "subida
    // 1→20 aplica a tabela do livro: Bruxo" (acima neste arquivo) já
    // confronta `p.espacos_magia` contra essa tabela nível a nível, sem
    // falhar -- ou seja, o app bate exatamente com o livro aqui; quem
    // estava errado era a FORMA desta asserção nova, generalizada demais
    // para as 8 classes conjuradoras. Bom senso continua exigindo que
    // NENHUMA magia "suma" ao subir -- só que, para o Bruxo, isso se
    // mede pelo TOTAL de espaços (soma de todos os círculos), não
    // círculo a círculo: o total nunca cai em nenhum nível da tabela do
    // livro (2,2,2,2,2,2,2,2,2,3,3,3,3,3,3,4,4,4,4 do nível 2 ao 20 --
    // nove 2s, níveis 2 a 10).
    // Para as outras 7 conjuradoras (que acumulam círculos de verdade),
    // a comparação círculo a círculo continua -- é a afirmação mais
    // forte e continua batendo com o livro nelas.
    //
    // Achado M1 da revisão final: para as 4 classes NÃO-conjuradoras
    // (Bárbaro, Guerreiro, Ladino, Monge) `p.espacos_magia` nunca sai de
    // `{}` em nenhum nível -- o ramo `else` abaixo, escrito para as
    // conjuradoras, iterava `Object.entries(anterior)` sobre um objeto
    // sempre vazio, ZERO vezes, e o teste passava sem afirmar nada além
    // de "escadaDeNivel não lançou" (o que os quatro testes de "subida
    // 1→20 aplica a tabela do livro" já provam, um por classe). Decisão:
    // as 4 não-conjuradoras continuam DENTRO deste teste -- o nome vale
    // para as 12 classes -- mas ganham uma asserção de verdade própria,
    // em vez do laço vazio: que `espacos_magia` permanece `{}` nos 20
    // níveis. Isso prova algo real (nenhuma classe não-conjuradora
    // "vaza" espaço de magia por engano), em vez de só não lançar.
    const conjuradora = TRACOS_BASICOS[classe].conjurador;
    const ehMagiaDePacto = classe === 'Bruxo';
    let anterior = {};
    await escadaDeNivel(classe, (p) => {
      if (!conjuradora) {
        assert.deepEqual(p.espacos_magia ?? {}, {},
          `${classe} nv${p.nivel}: classe não-conjuradora não deveria ganhar espaços de magia`);
        return;
      }
      if (ehMagiaDePacto) {
        const totalAntes = Object.values(anterior)
          .reduce((soma, d) => soma + d.total, 0);
        const totalAgora = Object.values(p.espacos_magia || {})
          .reduce((soma, d) => soma + d.total, 0);
        if (Object.keys(anterior).length > 0) {
          assert.ok(totalAgora >= totalAntes,
            `${classe} nv${p.nivel}: total de espaços de magia caiu de ` +
            `${totalAntes} para ${totalAgora}`);
        }
      } else {
        for (const [circulo, dadosCirculo] of Object.entries(anterior)) {
          const agora = p.espacos_magia?.[circulo]?.total ?? 0;
          assert.ok(agora >= dadosCirculo.total,
            `${classe} nv${p.nivel}: círculo ${circulo} caiu de ` +
            `${dadosCirculo.total} para ${agora}`);
        }
      }
      anterior = JSON.parse(JSON.stringify(p.espacos_magia || {}));
    });
  });

  test(`nenhuma característica é concedida duas vezes: ${classe}`, async () => {
    // Achado M2 da revisão final -- O QUE ESTE TESTE É, por escrito: uma
    // AUTOCONFERÊNCIA DE TRANSCRIÇÃO, não um confronto comportamental. Ele
    // só lê `PROGRESSAO` (o catálogo transcrito do livro) contra si mesmo
    // -- nunca chama `escadaDeNivel`, nunca lê um personagem, nunca toca
    // `subirDeNivel()`. O nome "é concedida" soa como uma alegação sobre
    // o APP (a pergunta que este arquivo, no cabeçalho, diz ser o motivo
    // dele existir: "o app aplica a tabela a um personagem?"), mas a
    // pergunta que este teste de fato responde é outra: "o CATÁLOGO
    // reaproveita um nome de característica sem essa repetição estar na
    // lista de exceções conhecidas do livro (REPETEM_NO_LIVRO)?". Ainda
    // assim é útil -- ver CONFERÊNCIA CONTRA AS 240 LINHAS abaixo, que
    // achou 4 exceções reais que uma varredura manual tinha deixado de
    // fora -- só não é o mesmo tipo de prova que os outros testes deste
    // arquivo (que sobem um personagem de verdade). Por isso ele NÃO
    // conta como confronto comportamental na tabela do README.
    //
    // "Aumento no Valor de Atributo" e "Característica de Subclasse"
    // repetem na tabela do livro DE PROPÓSITO -- é assim que a 5.5e
    // marca uma escolha ou dádiva recorrente, sem inventar um nome novo
    // a cada nível. "Dádiva Épica" NÃO precisa da mesma exceção: ela só
    // aparece uma vez por classe (nível 19, conferido em
    // catalogo/classes.mjs -- 12 ocorrências, uma por classe), então
    // nunca dispararia esta asserção mesmo sem entrar em
    // REPETEM_NO_LIVRO; incluí-la ali era exceção em excesso (revisão da
    // Task 9), que esconderia uma repetição de verdade se um erro futuro
    // de transcrição repetisse "Dádiva Épica" em duas linhas da mesma
    // classe.
    //
    // CONFERÊNCIA CONTRA AS 240 LINHAS (task-9-report.md tem o script
    // usado): essa lista de três, sozinha, NÃO é suficiente -- uma
    // varredura de todo `PROGRESSAO` (12 classes × 20 níveis) achou mais
    // QUATRO nomes que também repetem no livro, pelo mesmo motivo (o
    // livro reaproveita o nome da característica para marcar "ganha mais
    // um uso/opção", em vez de um nome novo por nível):
    //   - "Golpe Brutal Aprimorado" (Bárbaro, níveis 13 e 17).
    //   - "Metamagia" (Feiticeiro, níveis 2, 10 e 17 -- cada aparição
    //     concede MAIS opções de Metamagia, não repete a mesma opção).
    //   - "Indomável" (Guerreiro, níveis 9, 13 e 17 -- um uso adicional a
    //     cada aparição).
    //   - "Surto de Ação" (Guerreiro, níveis 2 e 17 -- um uso adicional).
    // Sem essas quatro entradas, este teste acusaria DUPLICATA FALSA nas
    // três classes acima -- e este projeto trata alegação falsa como
    // pior do que alegação faltando (ver preocupações desta tarefa).
    //
    // Também conferido (achado NEGATIVO, sem consequência): o catálogo
    // grafa "Característica de subclasse" com 's' minúsculo no Monge
    // nível 11 (variação verbatim do livro, ver comentário de
    // ROTULOS_GATILHO.subclasse em classes.mjs) e "Subclasse Bárbaro" /
    // "Subclasse Clérigo" / "Subclasse Ladino" sem "de" nos respectivos
    // níveis 3. Nenhuma das duas variações faz uma repetição de verdade
    // escapar do filtro: a grafia minúscula do Monge aparece só UMA vez
    // (nível 11) -- comparada por string exata contra a forma capitalizada
    // "Característica de Subclasse" que o Monge usa nos OUTROS níveis, ela
    // não é a mesma chave de `vistas` e por isso nunca precisou entrar em
    // REPETEM_NO_LIVRO; e "Subclasse <Classe>" sem "de" é a escolha
    // INICIAL da subclasse (nível 3), que só acontece uma vez em cada uma
    // das três classes que usam essa grafia -- não há uma segunda
    // ocorrência para o filtro precisar cobrir.
    const REPETEM_NO_LIVRO = new Set([
      'Aumento no Valor de Atributo', 'Característica de Subclasse',
      'Golpe Brutal Aprimorado', 'Indomável', 'Metamagia', 'Surto de Ação',
    ]);
    const vistas = new Map();
    for (const linha of PROGRESSAO[classe]) {
      for (const c of linha.caracteristicas) {
        if (REPETEM_NO_LIVRO.has(c)) continue;
        const antes = vistas.get(c);
        assert.equal(antes, undefined,
          `${classe}: "${c}" aparece nos níveis ${antes} e ${linha.nivel}`);
        vistas.set(c, linha.nivel);
      }
    }
  });

  test(`subclasse não é reoferecida depois de escolhida: ${classe}`, async () => {
    // O livro não escreve "a pendência de subclasse dispara exatamente
    // uma vez" -- ele só lista em que nível a coluna de características
    // traz "Subclasse de X" pela primeira (e única) vez. Que o APP não
    // deveria perguntar de novo depois de respondida é bom senso: uma
    // segunda pergunta pediria para escolher uma subclasse já escolhida,
    // sem nenhum efeito de jogo associado a essa segunda escolha.
    const niveisQuePedem = [];
    await escadaDeNivel(classe, (p, nivel, pendencias) => {
      if (pendencias.includes('subclasse')) niveisQuePedem.push(nivel);
    });
    assert.equal(niveisQuePedem.length, 1,
      `${classe}: subclasse pedida em ${niveisQuePedem.length} níveis ` +
      `(${niveisQuePedem.join(', ')}), esperado exatamente 1`);
  });
}

test('subir além do nível 20 é recusado', async () => {
  // Bom senso, não frase do livro: nenhuma tabela de características vai
  // além do nível 20, então "subir para o nível 21" não é uma pergunta
  // que o livro precisa responder -- é o app que precisa recusar.
  //
  // ATENÇÃO (conferido contra o código, não suposto): site/js/levelup.js
  // linhas 886-887 recusam ANTES de tocar em `personagem.nivel`
  // (`if (novoNivel > 20) return { sucesso: false, ... }` é a PRIMEIRA
  // checagem da função) -- não existe caminho em que o app incremente o
  // nível e desfaça depois. Por isso a segunda asserção abaixo
  // (`personagem.nivel` continua 20) não é redundante com a primeira: é
  // ela, e não `r.sucesso === false`, que prova que "recusado" significa
  // "o personagem não subiu" -- `r.sucesso === false` sozinho provaria
  // só que a chamada devolveu um resultado negativo, não que nada mudou.
  const { levelup } = await modulosApp();
  const personagem = await escadaDeNivel('Bárbaro', () => {});
  assert.equal(personagem.nivel, 20);
  personagem.xp = 999999;
  const r = await levelup.subirDeNivel(personagem, {});
  assert.equal(r.sucesso, false, 'nível 21 deveria ser recusado');
  assert.equal(personagem.nivel, 20, 'o personagem não deveria ter subido');
});

test('subir sem XP suficiente é recusado', async () => {
  // Mesmo raciocínio: o livro define QUANTO XP cada nível exige (tabela
  // já coberta por ficha-transversal.test.mjs), mas não escreve "e sem
  // esse XP o app deve recusar a subida" -- é a garantia mínima que quem
  // usa o app espera de uma tela de subida de nível, não uma citação.
  const { levelup, store } = await modulosApp();
  const p = store.criarPersonagemVazio();
  p.classe = 'Bárbaro';
  p.nivel = 1;
  p.xp = 0;
  const r = await levelup.subirDeNivel(p, {});
  assert.equal(r.sucesso, false, 'sem XP não deveria subir');
  assert.equal(p.nivel, 1, 'o personagem não deveria ter subido');
});
