// ============================================================
// Regra do livro: talento com escolhas, ao ser selecionado na
// subida de nível, deve OFERECER os controles de escolha, bloquear
// a confirmação até completá-las e persistir o que foi escolhido.
// Dirigido pelo catálogo: todo talento com `escolhas` não-vazias entra
// sozinho, um `test()` por talento.
//
// Achados que moldaram este spec (documentados aqui porque não são
// óbvios a partir do código do app sozinho):
//
// 1. "Próximo" (#btn-step-proximo) do assistente de subida NUNCA valida
//    -- so o clique final em "Confirmar Nível X" (#btn-confirmar-levelup,
//    na Revisão) roda `validateAll`. Por isso "confirmar sem escolher não
//    avança" só pode ser testado avançando até lá, não clicando o botão
//    da própria tela de ASI/talento (que é sempre "Próximo").
// 2. Nas duas classes usadas como semente (Guerreiro e Paladino), o passo
//    de ASI/talento é seguido diretamente pela Revisão -- nenhuma das
//    condições de escolhas_classe/seleção de magias/manobras se aplica
//    (Paladino nunca ganha truques: paladino.json não tem coluna
//    "Truques"). Confirmado lendo levelup-flow.js:284-344. Isso permite
//    hardcodar "um Próximo, um Confirmar" em vez de reimplementar o
//    resolvedor genérico de helpers.mjs (que preencheria as PRÓPRIAS
//    escolhas do talento e inviabilizaria o teste negativo do passo 2).
// 3. Ao concluir com sucesso, o app FECHA o modal do assistente e ABRE um
//    outro ("Subida de Nível Concluída!") -- `#modal-overlay` continua
//    visível nos dois casos (bloqueado ou concluído). O sinal confiável é
//    a presença de `#btn-confirmar-levelup`, que só existe no modal do
//    assistente.
// 4. Vários talentos (Adepto Elemental, Atirador Arcano, Conjurador
//    Bélico, Dádiva da Recordação de Magia) exigem Característica de
//    Conjuração no pré-requisito (levelup.js:107-110,
//    talentoElegivelParaPersonagem). Um Guerreiro não qualifica --
//    testá-los com uma semente de Guerreiro faria o teste cair sempre no
//    ramo "ausente da lista, mas justificado pelo livro" sem NUNCA
//    provar o que a tela oferece, mascarando os bugs que este spec
//    precisa achar (ver task-9-brief.md). Por isso há uma semente extra
//    de Paladino (conjurador, mas sem passos extras de magia).
// ============================================================
import { test, expect } from '@playwright/test';
import { CATALOGO_TALENTOS } from '../../regras/catalogo/talentos.mjs';
import { lacuna } from '../../regras/lacunas-conhecidas.mjs';
import {
  abrirFicha, personagemSalvo, irAteEscolhaDeTalento, sementeParaTalento,
} from './helpers-regras.mjs';

// SEMENTES, a escolha de semente por talento e a navegação até a tela de
// ASI/talento (`irAteEscolhaDeTalento`) vivem em helpers-regras.mjs desde
// o achado I1 -- são compartilhadas com talentos-repetivel.spec.mjs (ver
// comentário lá e em helpers-regras.mjs para o porquê).
const semente = sementeParaTalento;

/**
 * Prova que a semente usada REALMENTE viola o pré-requisito do talento,
 * em vez de só constatar que o catálogo tem *algum* prerequisito (55 dos
 * 59 candidatos têm -- aceitar qualquer um como desculpa tornava a
 * ausência do dropdown inexplicável na prática, e Ator/Líder
 * Inspirador/Aumento no Valor de Atributo passavam sem executar nenhuma
 * asserção sobre a tela). Confere as MESMAS condições que
 * `talentoElegivelParaPersonagem` (site/js/levelup.js:98-127) usa contra
 * o personagem real: nível, atributo mínimo (isolado ou alternativo) e
 * Característica de Conjuração. Devolve o motivo (string) quando a
 * ausência é justificada, ou `null` quando a semente satisfaz tudo que o
 * catálogo pede -- e a ausência vira um achado a investigar, não uma
 * passagem livre.
 */
function explicaAusencia(entrada, sementeUsada) {
  const pre = entrada.prerequisito;
  if (!pre) return null;
  const nivelNovo = sementeUsada.nivel + 1;
  if (pre.nivel != null && nivelNovo < pre.nivel) {
    return `nível ${nivelNovo} < ${pre.nivel} exigido`;
  }
  if (pre.atributos) {
    const faltando = Object.entries(pre.atributos)
      .filter(([attr, minimo]) => (sementeUsada.atributos[attr] ?? 0) < minimo);
    if (faltando.length) {
      return `atributo(s) abaixo do mínimo: ${faltando.map(([a, m]) => `${a}<${m}`).join(', ')}`;
    }
  }
  if (pre.atributos_alternativos) {
    const atendeAlgum = Object.entries(pre.atributos_alternativos)
      .some(([attr, minimo]) => (sementeUsada.atributos[attr] ?? 0) >= minimo);
    if (!atendeAlgum) {
      return `nenhum dos atributos alternativos atende: ${JSON.stringify(pre.atributos_alternativos)}`;
    }
  }
  // Conjuração: só o Paladino das sementes 'conjurador'/'conjuradorEpico'
  // satisfaz -- Guerreiro nunca tem Característica de Conjuração
  // (CLASSES_INFO['Guerreiro'].conjurador === false).
  if (pre.conjurador === true && sementeUsada.classe !== 'Paladino') {
    return `classe ${sementeUsada.classe} não é conjuradora`;
  }
  // armadura/escudo: Guerreiro e Paladino (as duas classes usadas neste
  // spec) têm Leve/Média/Pesada/Escudo em CLASSES_INFO -- nenhuma das
  // quatro sementes é bloqueada por isso, então não checado aqui.
  return null;
}

// Tipos de escolha sem um controle genérico e único na tela: o atributo
// embutido (`#levelup-talento-asi`) e a distribuição de pontos são
// tratados à parte; lista de magias/truques/rituais/magia de círculo
// vivem em widgets próprios (cascata assíncrona, checkboxes) que não são
// `.escolha-talento-levelup`. Mesmo filtro usado no motor de unidade
// (comLacuna) para não fingir cobertura que a tela não dá para observar
// de forma genérica.
const TIPOS_SEM_CONTROLE_GENERICO = [
  'atributo_talento', 'atributo_conjuracao', 'atributo_salvaguarda',
  'lista_magias', 'truque', 'magia_1_circulo', 'magia', 'ritual',
];

// Subconjunto de TIPOS_SEM_CONTROLE_GENERICO que além de não ter select
// genérico, também não dá para PREENCHER genericamente (o atributo
// embutido dá para preencher via #levelup-talento-asi; estes não têm
// equivalente e exigem widgets dedicados -- cascata de Iniciado em
// Magia, busca de magia de Tocado Por Fadas/Sombras, checkboxes de
// Conjurador Ritualista).
const TIPOS_DINAMICOS = ['lista_magias', 'truque', 'magia_1_circulo', 'magia', 'ritual'];

// Controles de escolha reconhecidos na tela: os selects de lista comuns
// (`.escolha-talento-levelup`) e o par de selects específico da Dádiva
// da Resistência à Energia (`.dadiva-energia-escolha`, renderizado por
// um ramo hard-coded separado em levelup-ui.js:664-672).
const CONTROLES_SELECTOR = '.escolha-talento-levelup, .dadiva-energia-escolha';

// `irAteEscolhaDeTalento` (achado I1) vem de helpers-regras.mjs -- ver o
// comentário lá para o histórico completo (por que o timeout fixo original
// foi trocado por waitForSelector, e por que a versão endurecida precisava
// virar a ÚNICA cópia).

/**
 * Preenche o atributo ASI embutido no talento (`#levelup-talento-asi`),
 * quando existir como <select> (várias opções elegíveis), e devolve a
 * chave do atributo que ficou selecionado. Quando só há uma opção
 * elegível o app renderiza um <input type="hidden"> já preenchido --
 * nada a clicar, só a ler. Devolve `null` quando o talento não tem ASI
 * embutido nenhum (ex.: Aumento no Valor de Atributo, que distribui
 * pontos por outro widget, `.levelup-talento-asi-distribuicao`).
 *
 * O valor de retorno é usado pelo achado I2: sem ele, não havia como
 * provar que o atributo realmente incrementou na ficha salva depois da
 * subida concluir -- só que a subida "não deu erro".
 */
async function preencherAsiEmbutido(page) {
  const el = page.locator('#levelup-talento-asi');
  if (!await el.count()) return null;
  if (await page.locator('select#levelup-talento-asi').count()) {
    const valores = await el.locator('option:not([disabled])').evaluateAll(
      (ops) => ops.map((o) => o.value).filter(Boolean));
    if (valores.length) await el.selectOption(valores[0]);
  }
  return (await el.inputValue().catch(() => '')) || null;
}

/**
 * Da tela de ASI/talento até a Revisão há sempre um único passo visível
 * nas quatro sementes usadas aqui (achado 2 no cabeçalho) -- um clique
 * em "Próximo" chega lá, e o botão final é sempre "Confirmar Nível X".
 * Devolve true se a subida continuou BLOQUEADA (o botão de confirmar
 * ainda existe -- achado 3: ao concluir, o app troca de modal e o botão
 * some) e false se concluiu.
 */
async function irAteRevisaoEConfirmar(page) {
  await page.locator('#btn-step-proximo').click();
  await page.waitForTimeout(400);
  await page.locator('#btn-confirmar-levelup').click();
  await page.waitForTimeout(500);
  return (await page.locator('#btn-confirmar-levelup').count()) > 0;
}

// Quantos controles `.escolha-talento-levelup`/`.dadiva-energia-escolha`
// o catálogo espera na tela para este talento.
function controlesEsperados(entrada) {
  return entrada.escolhas
    .filter((e) => !TIPOS_SEM_CONTROLE_GENERICO.includes(e.tipo))
    .reduce((soma, e) => soma + (e.qtd === 'proficiencia' ? 2 : e.qtd), 0);
}

const CANDIDATOS = Object.entries(CATALOGO_TALENTOS)
  .filter(([, t]) => t.escolhas.length > 0);

for (const [nome, entrada] of CANDIDATOS) {
  test(`level-up: ${nome}`, async ({ context }) => {
    const l = lacuna(nome, 'e2e-levelup');
    test.fail(Boolean(l), l?.motivo);

    const sementeUsada = semente(entrada, nome);
    const { page, erros } = await abrirFicha(context, sementeUsada);
    expect(await irAteEscolhaDeTalento(page), 'não chegou à tela de ASI/talento').toBe(true);

    // Muda para o modo talento (o rádio não existe em Dádiva Épica, onde
    // o modo já é forçado para 'talento' -- ver achado 4) e seleciona o
    // talento-alvo.
    await page.check('input[name="levelup-asi-modo"][value="talento"]', { timeout: 1500 }).catch(() => {});
    const select = page.locator('#levelup-talento-select');
    const opcao = select.locator(`option[value="${nome}"]`);
    if (!await opcao.count()) {
      // Ausente da lista: só é aceitável se a PRÓPRIA semente violar o
      // pré-requisito do talento (nível, atributo, conjuração) -- não
      // basta o catálogo ter *algum* prerequisito (55 dos 59 candidatos
      // têm, então essa checagem sozinha aceitava quase tudo e deixava
      // Ator/Líder Inspirador/Aumento no Valor de Atributo passar sem
      // executar nenhuma asserção sobre a tela). Se a semente satisfaz
      // tudo que o catálogo pede e o talento ainda assim não aparece,
      // isso é um achado sobre o app, não um pré-requisito não cumprido.
      const motivo = explicaAusencia(entrada, sementeUsada);
      expect(motivo,
        `${nome} não aparece na lista, mas a semente (${sementeUsada.classe} nível ` +
        `${sementeUsada.nivel}, ${JSON.stringify(sementeUsada.atributos)}) satisfaz o ` +
        `pré-requisito do livro ${JSON.stringify(entrada.prerequisito)} -- ausência sem explicação`)
        .not.toBeNull();
      return;
    }
    await select.selectOption(nome);
    await page.waitForTimeout(400);

    // 1. A tela oferece os controles de escolha que o livro exige.
    const selects = page.locator(CONTROLES_SELECTOR);
    expect(await selects.count(),
      `${nome}: livro exige ${JSON.stringify(entrada.escolhas)}, tela não oferece`)
      .toBeGreaterThanOrEqual(controlesEsperados(entrada));

    // 1b. Quando o livro enumera uma lista FECHADA de opções para um
    // tipo com controle genérico na tela, a tela tem de oferecer
    // EXATAMENTE aquelas -- nem faltando, nem sobrando (achado M5: a
    // versão anterior só conferia faltantes, então um rótulo A MAIS ou
    // renomeado além dos já catalogados ficava invisível). É esta
    // asserção que prova os desvios de rótulo já conhecidos (Analítico
    // troca Percepção por Medicina; Adepto Elemental usa Frio/Fogo/Trovão
    // em vez de Gélido/Ígneo/Trovejante). Restrita aos mesmos tipos de
    // TIPOS_SEM_CONTROLE_GENERICO: para os demais (ex.: o atributo de
    // conjuração de Iniciado em Magia/Tocado Por Fadas/Pelas Sombras)
    // não há um `.escolha-talento-levelup` correspondente -- checar ali
    // acusaria falta de controle onde o app só usa outro widget.
    //
    // `offset` indexa o select certo dentro de `selects` (achado M5: a
    // versão anterior usava sempre `.first()`, então um talento com MAIS
    // de uma escolha com controle genérico -- ex.: Dádiva da Resistência
    // à Energia, atributo_talento + energia -- checava sempre o mesmo
    // select, mesmo quando a escolha em questão era a segunda ou
    // posterior). Só avança para escolhas que REALMENTE viram
    // `.escolha-talento-levelup`/`.dadiva-energia-escolha` na tela (fora
    // de TIPOS_SEM_CONTROLE_GENERICO) -- mesmo filtro de controlesEsperados.
    let offset = 0;
    for (const esc of entrada.escolhas) {
      if (TIPOS_SEM_CONTROLE_GENERICO.includes(esc.tipo)) continue;
      if (Array.isArray(esc.opcoes)) {
        const ofertadas = await selects.nth(offset).locator('option')
          .evaluateAll((ops) => ops.map((o) => o.value).filter(Boolean));
        const faltando = esc.opcoes.filter((o) => !ofertadas.includes(o));
        const extras = ofertadas.filter((o) => !esc.opcoes.includes(o));
        expect(faltando,
          `${nome}: o livro oferece ${JSON.stringify(esc.opcoes)}, a tela não oferece ${JSON.stringify(faltando)}`)
          .toEqual([]);
        expect(extras,
          `${nome}: a tela oferece opção(ões) que o livro não lista: ${JSON.stringify(extras)} ` +
          `(livro: ${JSON.stringify(esc.opcoes)})`)
          .toEqual([]);
      }
      offset += esc.qtd === 'proficiencia' ? 2 : esc.qtd;
    }

    // Tipos com widget dinâmico (checkboxes de rituais, cascata de
    // Iniciado em Magia, busca de magia de Tocado Por Fadas/Sombras):
    // calculado aqui porque também entra na checagem "nada a escolher"
    // logo abaixo -- essas escolhas SÃO reais, só não têm select genérico
    // (não confundir "sem `.escolha-talento-levelup`" com "sem exigência").
    const dinamicoForaDeEscopo = entrada.escolhas.some((e) => TIPOS_DINAMICOS.includes(e.tipo));

    // Quando o único benefício do talento é "+1 num atributo" e SÓ um
    // atributo é elegível (ex.: Resistente só permite Constituição), o
    // app não pede escolha nenhuma: renderiza um <input type="hidden">
    // já preenchido (levelup-ui.js:533-535), sem select. Não há "não
    // escolher" possível para o jogador testar -- o passo negativo abaixo
    // não se aplica a este caso, então testa só que a subida CONCLUI
    // (prova que o talento não fica bloqueado por outro motivo) e que o
    // talento persiste. Aumento no Valor de Atributo fica de fora desta
    // saída mesmo com controlesEsperados===0 e sem `#levelup-talento-asi`
    // (obterAtributosASITalento devolve [] para ele especificamente,
    // lacuna já registrada em 'escolhas'): ele TEM uma escolha real, só
    // que via `.levelup-talento-asi-distribuicao` (tratado mais abaixo,
    // passo 3) -- tratá-lo aqui como "nada a escolher" o faria concluir
    // sem nunca distribuir os 2 pontos, mascarando exatamente a regra
    // que este talento existe para exercitar.
    const semEscolhaAlguma = controlesEsperados(entrada) === 0 && !dinamicoForaDeEscopo
      && nome !== 'Aumento no Valor de Atributo'
      && !(await page.locator('select#levelup-talento-asi').count());
    if (semEscolhaAlguma) {
      // O <input type="hidden"> já vem preenchido com a chave do único
      // atributo elegível -- lê ANTES de confirmar para poder comparar
      // com o valor salvo depois (achado I2).
      const asiEl = page.locator('#levelup-talento-asi');
      const chaveAsi = (await asiEl.count()) ? (await asiEl.inputValue().catch(() => '')) || null : null;

      const bloqueado = await irAteRevisaoEConfirmar(page);
      expect(bloqueado, `${nome}: não concluiu a subida (nada a escolher além do +1 automático)`).toBe(false);
      const salvoObj = await personagemSalvo(page);
      expect(salvoObj?.talentos, `${nome}: talento não persistiu em personagem.talentos`).toContain(nome);
      if (chaveAsi) {
        const antes = Number(sementeUsada.atributos[chaveAsi] ?? 0);
        const depois = Number(salvoObj?.atributos?.[chaveAsi]);
        expect(depois,
          `${nome}: atributo "${chaveAsi}" não incrementou de ${antes} para ${antes + 1} (leu ${depois})`)
          .toBe(antes + 1);
      }
      expect(erros).toEqual([]);
      return;
    }

    // 2. Confirmar sem preencher as escolhas do talento não conclui a
    // subida. Só preenche o ASI embutido ANTES desta checagem quando o
    // catálogo espera ALGUM controle genérico além dele (ex.: Analítico):
    // sem isso, o talento ficaria bloqueado pelo ASI faltando, mascarando
    // se a escolha de lista em si é exigida. Para os demais (só o ASI
    // embutido de múltiplas opções, sem outra escolha) o ASI É o
    // requisito que este passo precisa testar, então fica de fora de
    // propósito.
    if (controlesEsperados(entrada) > 0) await preencherAsiEmbutido(page);
    const bloqueadoSemEscolha = await irAteRevisaoEConfirmar(page);
    expect(bloqueadoSemEscolha,
      `${nome}: concluiu a subida sem as escolhas obrigatórias do talento`).toBe(true);

    if (dinamicoForaDeEscopo) {
      // Escolhas deste tipo vivem em widgets que este spec genérico não
      // sabe preencher (checkboxes de rituais, selects assíncronos de
      // magia/lista) -- o passo 2 já provou que ALGUMA coisa é exigida;
      // completar e conferir a persistência fica fora do escopo aqui.
      expect(erros).toEqual([]);
      return;
    }

    // 3. Volta para a tela de talento (o estado -- inclusive o talento
    // já escolhido -- persiste) e preenche cada select com uma opção
    // distinta.
    await page.locator('#btn-step-anterior').click();
    await page.waitForTimeout(400);

    const n = await selects.count();
    const escolhidos = [];
    for (let i = 0; i < n; i++) {
      const s = selects.nth(i);
      const valores = await s.locator('option').evaluateAll(
        (ops) => ops.map((o) => o.value).filter(Boolean));
      const valor = valores[i % valores.length];
      await s.selectOption(valor);
      escolhidos.push(valor);
    }
    // Aumento no Valor de Atributo distribui pontos em selects próprios
    // (`.levelup-talento-asi-distribuicao`), fora de CONTROLES_SELECTOR
    // -- sem preencher, a subida fica bloqueada por falta de distribuição,
    // não por falta do controle em si (que este teste não cobre, ver
    // TIPOS_SEM_CONTROLE_GENERICO/atributo_talento).
    if (nome === 'Aumento no Valor de Atributo') {
      await page.locator('.levelup-talento-asi-distribuicao').first().selectOption('2');
    }
    const chaveAsi = await preencherAsiEmbutido(page);

    // 4. Confirma de novo: agora tem de concluir e persistir o que foi
    // escolhido.
    const bloqueadoComEscolha = await irAteRevisaoEConfirmar(page);
    expect(bloqueadoComEscolha,
      `${nome}: não concluiu a subida mesmo com as escolhas preenchidas`).toBe(false);

    const salvoObj = await personagemSalvo(page);

    // Achado M6: substring no JSON inteiro é vácuo sempre que o valor
    // escolhido já aparece em outro canto do personagem semeado (ex.: as
    // opções de Especialista em Perícia são perícias já proficientes no
    // seed). Confere o campo ESPECÍFICO onde levelup.js grava a escolha
    // (mesma disciplina de talentos-criador.spec.mjs:229-234): a Dádiva
    // da Resistência à Energia grava em talentos_parametros (levelup.js:253),
    // todo o resto em escolhas_talento['levelup_'+novoNível] (levelup.js:1309-1310).
    const chaveNivel = `levelup_${sementeUsada.nivel + 1}`;
    if (nome === 'Dádiva da Resistência à Energia') {
      const persistido = [...(salvoObj?.talentos_parametros?.dadiva_resistencia_energia || [])].sort();
      expect(persistido,
        `${nome}: energias ${JSON.stringify(escolhidos)} não persistiram em ` +
        'personagem.talentos_parametros.dadiva_resistencia_energia')
        .toEqual([...escolhidos].sort());
    } else if (escolhidos.length > 0) {
      const persistido = [...(salvoObj?.escolhas_talento?.[chaveNivel] || [])].sort();
      expect(persistido,
        `${nome}: escolhas ${JSON.stringify(escolhidos)} não persistiram em ` +
        `personagem.escolhas_talento.${chaveNivel}`)
        .toEqual([...escolhidos].sort());
    }

    // Achado I2: o talento em si e o atributo do ASI embutido precisam
    // ter persistido de verdade -- para os ~44 talentos "só atributo"
    // (controlesEsperados===0 mas COM `#levelup-talento-asi` como
    // <select>, então fora do ramo semEscolhaAlguma acima), `escolhidos`
    // fica vazio (nenhum `.escolha-talento-levelup` para preencher) e a
    // checagem de persistência de cima nunca roda -- sem isto, a prova de
    // conclusão inteira se resumia a "a subida não travou e não deu erro
    // no console", o que um app que descarta o talento e o +1 também
    // passaria.
    expect(salvoObj?.talentos, `${nome}: talento não persistiu em personagem.talentos`).toContain(nome);
    if (chaveAsi) {
      const antes = Number(sementeUsada.atributos[chaveAsi] ?? 0);
      const depois = Number(salvoObj?.atributos?.[chaveAsi]);
      expect(depois,
        `${nome}: atributo "${chaveAsi}" não incrementou de ${antes} para ${antes + 1} (leu ${depois})`)
        .toBe(antes + 1);
    }
    expect(erros).toEqual([]);
  });
}
