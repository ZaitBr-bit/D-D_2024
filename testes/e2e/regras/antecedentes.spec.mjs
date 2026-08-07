// ============================================================
// Regra do livro (Antecedente.md:19-32): um antecedente concede cinco
// partes -- valores de atributo, talento de origem, duas perícias, uma
// ferramenta (específica ou por categoria) e uma escolha de equipamento
// (pacote ou 50 PO). Este spec dirige o assistente de criação, driven pelo
// catálogo curado em testes/regras/catalogo/antecedentes.mjs, e confronta
// as cinco partes contra o PERSONAGEM salvo/em construção -- nunca contra
// o DOM sozinho.
//
// ---- Fluxo do assistente mapeado (investigação antes de escrever
// asserção, como o guia pede) ----
//
// As cinco partes NÃO vivem todas no mesmo passo do wizard:
//
//   Passo 2 "antecedente" (passo-antecedente.js):
//     - clicar um card [data-antecedente] abre um popup com o resumo;
//     - se a ferramenta é por categoria (Artesão/Artista/Guarda/Nobre/
//       Soldado), o popup oferece cards [data-escolha-ant][data-opcao-ant]
//       -- a escolha grava em personagem.escolhas_antecedente[campo];
//     - se o talento de origem exige escolhas (Habilidoso/Artifista/
//       Músico), o popup injeta selects .escolha-talento-antecedente --
//       gravam em personagem.escolhas_talento.antecedente (mecanismo
//       reusado do domínio Talentos, já coberto a fundo por
//       talentos-criador.spec.mjs; este spec só confirma que o talento
//       CERTO foi concedido, não repete a validação negativa de cada
//       talento-com-escolhas);
//     - confirmar grava personagem.antecedente e personagem.talento_antecedente
//       (nome do talento, "(veja o capítulo 5)" já removido pelo app, mas
//       "(Clérigo/Druida/Mago)" de Iniciado em Magia sobrevive -- por isso
//       o parse abaixo separa nome de parâmetro do mesmo jeito que o motor
//       de unidade faz contra dados/);
//     - a distribuição de atributos (+2/+1 vs +1/+1/+1) é renderizada
//       INLINE neste mesmo passo (renderDistribuicaoInline, importada de
//       passo-atributos.js:13-171 mas chamada por passo-antecedente.js),
//       NÃO no passo "atributos" -- confirmado ao vivo. Os três atributos
//       elegíveis vêm de ant.valores_atributo (exatamente os do livro,
//       conferido também no motor de unidade). No modo "+1/+1/+1" os três
//       chips vêm sempre pré-marcados e desabilitados (passo-atributos.js:
//       131/137) porque o livro só define exatamente 3 atributos elegíveis
//       por antecedente -- não há escolha dentro do "+1/+1/+1", só a
//       decisão de usar esse modo. O botão de avançar do PRÓPRIO passo
//       antecedente recusa (wizard.js:243-251) se a soma dos bônus < 3.
//
//   Passo 3 "atributos" (passo-atributos.js):
//     - as DUAS perícias do antecedente (dadosCache.pericias_antecedente)
//       só entram em personagem.pericias_proficientes quando o jogador
//       marca ao menos uma perícia de classe (atualizarEstado,
//       passo-atributos.js:622-625) -- não há um passo "aplicar
//       automaticamente"; confirmado ao vivo que pericias_proficientes
//       fica ausente/vazio até essa interação.
//
//   Passo 4 "equipamento" (passo-equipamento.js):
//     - dois cards [data-equip-tipo="antecedente"][data-equip-letra="A"|"B"]
//       -- A é sempre o pacote, B é sempre "50 PO" (parseEquipamentoOpcoes,
//       passo-equipamento.js:84-121, e confirmado por dados/: todo texto
//       segue "Escolha A ou B: (A) ...; ou (B) N PO");
//     - escolher A soma o ouro embutido no pacote (opcao.moedaQtd, as N PO
//       que sobram no livro) a personagem.moedas E insere os itens do
//       pacote em personagem.inventario com origemTipo:'antecedente';
//     - escolher B soma exatamente 50 PO e não mexe no inventário.
//
// ---- O que a investigação encontrou (confirmado ao vivo, não só por
// leitura) e como este spec confronta cada achado ----
//
// (1) NENHUMA das 16 ferramentas/instrumentos concedidos por um
//     antecedente (específicos OU escolhidos por categoria) vira uma
//     proficiência reconhecida em personagem.proficiencias_ferramentas ou
//     .proficiencias_instrumentos. wizard.js:582-597 (finalizar) só
//     consolida essas duas listas a partir de personagem.escolhas_talento
//     (as escolhas do TALENTO Habilidoso/Artifista/Músico) -- nunca a
//     partir de personagem.escolhas_antecedente nem do campo `ferramentas`
//     do antecedente. grep confirma: personagem.antecedente só é lido pela
//     ficha (sheet/ficha.js:107, impressao.js:176, pdf.js:113) como TEXTO
//     de rótulo, nunca para re-derivar proficiência. Confirmado ao vivo
//     para Acólito (ferramenta específica): personagem final tinha
//     "Suprimentos de Calígrafo" no INVENTÁRIO (a escolha de equipamento
//     colocou o item lá) mas proficiencias_ferramentas seguia [] até o
//     fim do assistente. Registrado como lacuna em todos os 16 (teste
//     'antecedentes-e2e-ferramenta-proficiencia').
//
// (2) Nos 5 antecedentes por categoria, o item do pacote de equipamento
//     que o livro descreve como "a mesma ferramenta/o mesmo instrumento/kit
//     que acima" NÃO é resolvido para a escolha real do jogador --
//     passo-equipamento.js só resolve texto "à sua escolha" (linha ~139),
//     não "(a mesma/o mesmo que acima)"; confirmado ao vivo escolhendo
//     "Suprimentos de Alquimista" para Artesão e recebendo, no inventário,
//     um item genérico chamado literalmente "Ferramentas de Artesão (a
//     mesma que acima)". Registrado como lacuna nos 5 antecedentes por
//     categoria (teste 'antecedentes-e2e-pacote-mesma-ferramenta').
//
// (3) O teto de 20 do livro ("nenhum desses aumentos pode ser maior que
//     20") já tem validação em site/js/ficha-edicao-validacoes.js:14, mas
//     essa validação vive na EDIÇÃO da ficha (abrirModalEdicaoFicha,
//     sheet/edicao.js), não no assistente -- os métodos de distribuição
//     inicial disponíveis no criador (Conjunto Padrão até 15, Compra de
//     Pontos até 15, Rolagem 4d6 até 18) nunca produzem base+bônus>20, e o
//     método "Manual" está desabilitado no criador (passo-atributos.js:
//     197). Este spec confronta a validação pelo caminho onde ela é de
//     fato alcançável: um personagem semeado (mesma técnica de
//     abrirFicha/semearPersonagem já usada pelo domínio Talentos) com
//     bonus_antecedente batendo com um valor de atributo alto, editado
//     pela ficha -- ver os dois testes "teto de 20" no fim do arquivo.
// ============================================================
import { test, expect } from '@playwright/test';
import {
  CATALOGO_ANTECEDENTES, CATEGORIA_FERRAMENTA,
} from '../../regras/catalogo/antecedentes.mjs';
import { lacuna } from '../../regras/lacunas-conhecidas.mjs';
import {
  abrirSite, abrirFicha, satisfazerPasso, assentar, lerToastErro,
  personagemEmCriacao, personagemSalvo, irAtePassoAntecedente,
} from './helpers-regras.mjs';

const ENTRADAS = Object.entries(CATALOGO_ANTECEDENTES);

// Extrai nome e parâmetro do talento concedido, do mesmo jeito que o
// motor de unidade faz contra dados/ (parseTalento em
// unidade/antecedentes.test.mjs): o app já removeu o sufixo "(veja o
// capítulo N)" ao gravar personagem.talento_antecedente, mas o parêntese
// de Iniciado em Magia ("(Clérigo)"/"(Druida)"/"(Mago)") sobrevive.
function parseTalentoConcedido(bruto) {
  const m = (bruto || '').match(/^(.+?)\s*\(([^()]+)\)$/);
  if (m) return { nome: m[1].trim(), parametro: m[2].trim() };
  return { nome: (bruto || '').trim(), parametro: null };
}

// Lê as opções de um <select> de bônus de atributo (#bonus-2/#bonus-1) e
// devolve, para cada uma, o valor bruto (nome em português, o que o app
// usa como `value`) e o código normalizado (ATRIBUTO_NOME_PARA_KEY, a
// MESMA tabela que o próprio app usa para interpretar essas opções) --
// evita manter uma segunda tradução PT->código que poderia divergir da
// do app.
async function lerOpcoesAtributo(page, seletor) {
  return page.evaluate(async (sel) => {
    const { ATRIBUTO_NOME_PARA_KEY } = await import(new URL('./js/dados-classes.js', location.href).href);
    return [...document.querySelectorAll(`${sel} option`)]
      .map((o) => o.value).filter(Boolean)
      .map((raw) => ({ raw, codigo: ATRIBUTO_NOME_PARA_KEY[raw] || null }));
  }, seletor);
}

// Preenche os selects de escolha do talento de origem (Habilidoso/
// Artifista/Músico -- os únicos com `.escolha-talento-antecedente`, ver
// comum.js:talentoExigeEscolhas) com valores distintos. Não faz nada
// quando o talento não exige escolha (a maioria dos 16). Clique DIRETO
// nos selects, não o auto-preenchedor genérico -- mesmo cuidado do
// talentos-criador.spec.mjs para não engolir a escolha de ferramenta por
// categoria do PRÓPRIO antecedente sem o teste saber.
async function preencherEscolhasTalento(page) {
  const selects = page.locator('.escolha-talento-antecedente');
  const n = await selects.count();
  const escolhidos = [];
  for (let i = 0; i < n; i++) {
    const s = selects.nth(i);
    const valores = await s.locator('option').evaluateAll((ops) => ops.map((o) => o.value).filter(Boolean));
    const valor = valores[i % valores.length];
    await s.selectOption(valor);
    escolhidos.push(valor);
  }
  return escolhidos;
}

// Clica no card do antecedente e, quando a ferramenta é por categoria,
// escolhe uma opção específica (a segunda da lista, não a primeira --
// para que a asserção de persistência não passe "por acidente" com
// qualquer valor default). Devolve o campo/valor escolhido, ou null
// quando a ferramenta é específica (nada a escolher).
async function selecionarAntecedente(page, nome, entrada) {
  await page.click(`[data-antecedente="${nome}"]`);
  await page.waitForSelector('#modal-overlay', { state: 'visible' });
  if (entrada.ferramenta.tipo !== 'categoria') return null;
  const cards = page.locator('[data-escolha-ant]');
  const opcoes = await cards.evaluateAll((els) => els.map((e) => e.dataset.opcaoAnt));
  const campo = await cards.first().getAttribute('data-escolha-ant');
  const escolhida = opcoes[1] ?? opcoes[0];
  await page.locator(`[data-escolha-ant][data-opcao-ant="${escolhida}"]`).click();
  return { campo, escolhida };
}

// ============================================================
// Teste 1 (todos os 16, sem amostragem): as partes que o app CONCEDE
// corretamente -- perícias, talento de origem, distribuição de atributos
// e a escolha de equipamento. Cada asserção aqui é lida do personagem em
// construção (module state do wizard), nunca do DOM.
// ============================================================
for (const [indice, [nome, entrada]] of ENTRADAS.entries()) {
  test(`antecedente: ${nome} concede perícias, talento, atributos e equipamento`, async ({ context }) => {
    const { page, erros } = await abrirSite(context, '#criar');
    expect(await irAtePassoAntecedente(page), 'não chegou ao passo de antecedente').toBe(true);

    const escolhaFerramenta = await selecionarAntecedente(page, nome, entrada);
    if (entrada.ferramenta.tipo !== 'categoria') {
      // Ferramenta específica: o livro não pede escolha nenhuma aqui --
      // a tela não deveria oferecer nenhum card de escolha de ferramenta.
      expect(await page.locator('[data-escolha-ant]').count(),
        `${nome}: livro concede ferramenta específica (${entrada.ferramenta.nome}), ` +
        'a tela não deveria pedir uma escolha').toBe(0);
    }

    await preencherEscolhasTalento(page);
    await page.click('#popup-confirmar-antecedente');
    await expect(page.locator('#modal-overlay'),
      `${nome}: modal não fechou após preencher as escolhas exigidas`).toBeHidden();

    const emAntecedente = await personagemEmCriacao(page);

    // 3. Talento de origem correto (nome + parâmetro de Iniciado em Magia).
    const { nome: talentoNome, parametro } = parseTalentoConcedido(emAntecedente.talento_antecedente);
    expect(talentoNome, `${nome}: livro concede o talento "${entrada.talento}"`).toBe(entrada.talento);
    expect(parametro, `${nome}: parâmetro do talento (lista de magias de Iniciado em Magia) diverge`)
      .toBe(entrada.talentoParametro ?? null);
    expect(emAntecedente.talentos, `${nome}: talento não entrou em personagem.talentos`)
      .toContain(emAntecedente.talento_antecedente);

    // 2 (parte 1 -- oferta e persistência da escolha de categoria; a parte
    // "vira proficiência reconhecida" é o Teste 2, abaixo, hoje uma lacuna).
    if (escolhaFerramenta) {
      expect(emAntecedente.escolhas_antecedente?.[escolhaFerramenta.campo],
        `${nome}: escolha de ferramenta/instrumento "${escolhaFerramenta.escolhida}" não persistiu ` +
        'em personagem.escolhas_antecedente').toBe(escolhaFerramenta.escolhida);
    }

    // 4. Distribuição de atributos: restringe às opções aos três
    // atributos do livro (lidos da MESMA tabela que o app usa).
    const opcoesBonus2 = await lerOpcoesAtributo(page, '#bonus-2');
    expect([...opcoesBonus2.map((o) => o.codigo)].sort(),
      `${nome}: opções de +2 fora dos três atributos do livro`).toEqual([...entrada.atributos].sort());

    const usar111 = indice % 2 === 1;
    if (!usar111) {
      const [a] = opcoesBonus2;
      await page.selectOption('#bonus-2', a.raw);
      await page.waitForTimeout(150);
      const opcoesBonus1 = await lerOpcoesAtributo(page, '#bonus-1');
      const b = opcoesBonus1.find((o) => o.raw !== a.raw);
      await page.selectOption('#bonus-1', b.raw);
      await page.waitForTimeout(150);
      const emDist = await personagemEmCriacao(page);
      const esperado = { [a.codigo]: 2, [b.codigo]: 1 };
      expect(emDist.bonus_antecedente, `${nome}: distribuição +2/+1 não persistiu como esperado`)
        .toEqual(esperado);
    } else {
      await page.locator('[name="dist-mode"][value="1-1-1"]').click();
      await page.waitForTimeout(200);
      const emDist = await personagemEmCriacao(page);
      const esperado = Object.fromEntries(entrada.atributos.map((a) => [a, 1]));
      expect(emDist.bonus_antecedente, `${nome}: distribuição +1/+1/+1 não persistiu como esperado`)
        .toEqual(esperado);
    }

    // Avança do passo de antecedente -- só aceita com a distribuição completa
    // (wizard.js:243-251, soma dos bônus >= 3), confirmando que a distribuição
    // acima foi de fato reconhecida como válida pelo próprio app.
    const passoAntes = await page.locator('.wizard-step.active').getAttribute('data-step');
    await page.evaluate(() => document.getElementById('btn-next')?.click());
    await page.waitForTimeout(400);
    const passoDepois = await page.locator('.wizard-step.active').getAttribute('data-step');
    expect(passoDepois, `${nome}: não avançou do passo de antecedente após completar a distribuição`)
      .not.toBe(passoAntes);

    // 1. Perícias: só entram em pericias_proficientes quando o passo de
    // atributos é percorrido (a escolha de perícia de classe dispara a
    // mescla) -- avança o passo inteiro com o driver genérico.
    expect(await satisfazerPasso(page), `${nome}: não avançou do passo de atributos`).toBe(true);
    await assentar(page).catch(() => {});
    const emAtributos = await personagemEmCriacao(page);
    for (const p of entrada.pericias) {
      expect(emAtributos.pericias_proficientes, `${nome}: perícia "${p}" do antecedente não persistiu`)
        .toContain(p);
    }

    // 5. Equipamento: a escolha entre pacote (A) e 50 PO (B) é oferecida
    // e o resultado persiste -- em personagem.moedas (sempre) e em
    // personagem.inventario (só quando o pacote é escolhido).
    expect(await page.locator('.wizard-step.active').getAttribute('data-step'),
      `${nome}: driver não chegou ao passo de equipamento`).toBe('4');
    const cardsEquip = page.locator('[data-equip-tipo="antecedente"]');
    const letras = await cardsEquip.evaluateAll((els) => els.map((e) => e.dataset.equipLetra));
    expect([...letras].sort(),
      `${nome}: equipamento do antecedente não ofereceu as duas opções (pacote/PO)`).toEqual(['A', 'B']);

    const antesEquip = await personagemEmCriacao(page);
    const poAntes = antesEquip.moedas?.po || 0;
    const letraEscolhida = indice % 2 === 0 ? 'A' : 'B';
    await page.locator(`[data-equip-tipo="antecedente"][data-equip-letra="${letraEscolhida}"]`).click();
    await page.waitForTimeout(300);
    const depoisEquip = await personagemEmCriacao(page);
    const poDepois = depoisEquip.moedas?.po || 0;
    const itensAntecedente = (depoisEquip.inventario || [])
      .filter((it) => it.origemTipo === 'antecedente' && it.origemNome === nome);

    if (letraEscolhida === 'A') {
      expect(poDepois - poAntes,
        `${nome}: pacote deveria incluir ${entrada.equipamento.pacote.ouroIncluido} PO`)
        .toBe(entrada.equipamento.pacote.ouroIncluido);
      expect(itensAntecedente.length,
        `${nome}: escolher o pacote não adicionou nenhum item ao inventário`).toBeGreaterThan(0);
      if (entrada.ferramenta.tipo === 'especifica') {
        expect(itensAntecedente.map((it) => it.nome),
          `${nome}: ferramenta específica "${entrada.ferramenta.nome}" não apareceu no pacote`)
          .toContain(entrada.ferramenta.nome);
      }
    } else {
      expect(poDepois - poAntes, `${nome}: alternativa em PO deveria ser exatamente 50`).toBe(50);
      expect(itensAntecedente.length,
        `${nome}: escolher 50 PO não deveria adicionar itens do pacote ao inventário`).toBe(0);
    }

    expect(erros, 'erros de console/página durante o fluxo').toEqual([]);
  });
}

// ============================================================
// Teste 2 (todos os 16, sem amostragem): a ferramenta/instrumento
// concedido pelo antecedente deveria virar proficiência reconhecida
// (personagem.proficiencias_ferramentas / .proficiencias_instrumentos).
// Achado (1) do cabeçalho -- confirmado ao vivo para Acólito (ferramenta
// específica) e Artesão (categoria); nenhum dos 16 tem entrada em
// lacunas-conhecidas.mjs corrigida, então os 16 abaixo são esperados
// falhar até o app ganhar essa consolidação (o mesmo padrão que
// wizard.js:582-597 já faz para escolhas_talento).
// ============================================================
for (const [nome, entrada] of ENTRADAS) {
  test(`antecedente: ${nome} — ferramenta concedida vira proficiência reconhecida`, async ({ context }) => {
    const l = lacuna(nome, 'antecedentes-e2e-ferramenta-proficiencia');
    test.fail(Boolean(l), l?.motivo);

    const { page } = await abrirSite(context, '#criar');
    expect(await irAtePassoAntecedente(page)).toBe(true);

    const escolhaFerramenta = await selecionarAntecedente(page, nome, entrada);
    await preencherEscolhasTalento(page);
    await page.click('#popup-confirmar-antecedente');
    await expect(page.locator('#modal-overlay')).toBeHidden();

    const emAntecedente = await personagemEmCriacao(page);
    const nomeFerramenta = escolhaFerramenta ? escolhaFerramenta.escolhida : entrada.ferramenta.nome;
    const listaCerta = entrada.ferramenta.tipo === 'categoria'
      && entrada.ferramenta.categoria === CATEGORIA_FERRAMENTA.INSTRUMENTO_MUSICAL
      ? (emAntecedente.proficiencias_instrumentos || [])
      : (emAntecedente.proficiencias_ferramentas || []);

    expect(listaCerta,
      `${nome}: "${nomeFerramenta}" (concedido pelo antecedente) deveria constar como proficiência ` +
      'do personagem').toContain(nomeFerramenta);
  });
}

// ============================================================
// Teste 3 (os 5 antecedentes por categoria): o item do pacote de
// equipamento que representa "a mesma ferramenta/o mesmo instrumento/kit
// que acima" deveria ser a ferramenta que o jogador realmente escolheu.
// Achado (2) do cabeçalho -- confirmado ao vivo para Artesão (escolheu
// "Suprimentos de Alquimista", pacote trouxe o item genérico "Ferramentas
// de Artesão (a mesma que acima)").
// ============================================================
const ENTRADAS_CATEGORIA = ENTRADAS.filter(([, e]) => e.ferramenta.tipo === 'categoria');
for (const [nome, entrada] of ENTRADAS_CATEGORIA) {
  test(`antecedente: ${nome} — item do pacote resolve para a ferramenta escolhida`, async ({ context }) => {
    const l = lacuna(nome, 'antecedentes-e2e-pacote-mesma-ferramenta');
    test.fail(Boolean(l), l?.motivo);

    const { page } = await abrirSite(context, '#criar');
    expect(await irAtePassoAntecedente(page)).toBe(true);

    const escolhaFerramenta = await selecionarAntecedente(page, nome, entrada);
    await preencherEscolhasTalento(page);
    await page.click('#popup-confirmar-antecedente');
    await expect(page.locator('#modal-overlay')).toBeHidden();

    // Distribuição mínima (+1/+1/+1, sempre válida) só para poder avançar
    // até o passo de equipamento -- não é o objeto deste teste.
    await page.locator('[name="dist-mode"][value="1-1-1"]').click();
    await page.waitForTimeout(200);
    await page.evaluate(() => document.getElementById('btn-next')?.click());
    await page.waitForTimeout(400);
    expect(await satisfazerPasso(page)).toBe(true);
    await assentar(page).catch(() => {});

    await page.locator('[data-equip-tipo="antecedente"][data-equip-letra="A"]').click();
    await page.waitForTimeout(300);
    const emConstrucao = await personagemEmCriacao(page);
    const itens = (emConstrucao.inventario || [])
      .filter((it) => it.origemTipo === 'antecedente' && it.origemNome === nome);

    expect(itens.map((it) => it.nome),
      `${nome}: o item do pacote que representa "a mesma ferramenta escolhida" deveria se chamar ` +
      `"${escolhaFerramenta.escolhida}"`).toContain(escolhaFerramenta.escolhida);
  });
}

// ============================================================
// Teto de 20 (Antecedente.md: "Nenhum desses aumentos pode ser maior que
// 20"), confrontado contra a validação já existente em
// ficha-edicao-validacoes.js:14. Não é alcançável pelo assistente com os
// métodos de distribuição disponíveis lá (Conjunto Padrão/Compra de
// Pontos/Rolagem nunca somam >20 com um bônus de antecedente; "Manual"
// está desabilitado no criador) -- por isso os dois testes abaixo semeiam
// o personagem direto (mesma técnica de abrirFicha já usada pelo domínio
// Talentos) e confrontam a edição da ficha, onde a validação realmente
// roda (sheet/edicao.js:232-233, chamando validarAtributosEditados).
// ============================================================
test('teto de 20: base + bônus de antecedente acima de 20 é recusado na edição', async ({ context }) => {
  const campos = {
    classe: 'Guerreiro', nivel: 1, antecedente: 'Acólito',
    bonus_antecedente: { inteligencia: 2, sabedoria: 1 },
    // Multiconjunto {19,10,10,10,10,10} -- "manual" exige redistribuir só
    // os valores originais (ficha-edicao-validacoes.js:13); colocar o 19
    // em inteligência (bônus +2) estoura o teto: 19+2=21.
    atributos_base: { forca: 19, destreza: 10, constituicao: 10, inteligencia: 10, sabedoria: 10, carisma: 10 },
    atributos: { forca: 19, destreza: 10, constituicao: 10, inteligencia: 12, sabedoria: 11, carisma: 10 },
    pericias_proficientes: ['Intuição', 'Religião'],
  };
  const { page } = await abrirFicha(context, campos, 'regras-antecedentes-teto20-invalido');

  await page.click('#btn-editar-ficha');
  await page.waitForSelector('#modal-overlay', { state: 'visible' });
  const chaves = await page.locator('[data-edicao-atributo]').evaluateAll(
    (els) => els.map((e) => e.dataset.edicaoAtributo));
  const valores = { inteligencia: 19, forca: 10, destreza: 10, constituicao: 10, sabedoria: 10, carisma: 10 };
  for (const k of chaves) {
    await page.fill(`[data-edicao-atributo="${k}"]`, String(valores[k]));
    await page.locator(`[data-edicao-atributo="${k}"]`).dispatchEvent('change');
  }
  await page.selectOption('#edicao-metodo-atributos', 'manual');
  await page.click('#btn-salvar-edicao-ficha');
  await page.waitForTimeout(400);

  const toast = await lerToastErro(page);
  expect(toast, 'toast de rejeição deveria citar o teto de 20 (ficha-edicao-validacoes.js:14)')
    .toBe('Nenhum atributo pode ultrapassar 20.');
  expect(await page.locator('#modal-overlay').isVisible(),
    'modal deveria continuar aberto após a rejeição').toBe(true);

  const salvo = await personagemSalvo(page);
  expect(salvo?.atributos_base?.inteligencia,
    'a tentativa recusada não deveria ter alterado o atributo salvo').toBe(10);
});

test('teto de 20: redistribuição dentro do limite é aceita e persiste', async ({ context }) => {
  const campos = {
    classe: 'Guerreiro', nivel: 1, antecedente: 'Acólito',
    bonus_antecedente: { inteligencia: 2, sabedoria: 1 },
    atributos_base: { forca: 19, destreza: 10, constituicao: 10, inteligencia: 10, sabedoria: 10, carisma: 10 },
    atributos: { forca: 19, destreza: 10, constituicao: 10, inteligencia: 12, sabedoria: 11, carisma: 10 },
    pericias_proficientes: ['Intuição', 'Religião'],
  };
  const { page } = await abrirFicha(context, campos, 'regras-antecedentes-teto20-valido');

  await page.click('#btn-editar-ficha');
  await page.waitForSelector('#modal-overlay', { state: 'visible' });
  const chaves = await page.locator('[data-edicao-atributo]').evaluateAll(
    (els) => els.map((e) => e.dataset.edicaoAtributo));
  // Mesmo multiconjunto {19,10,10,10,10,10}, mas o 19 fica em força (bônus
  // 0 -> 19, dentro do teto); inteligência recebe 10 (bônus +2 -> 12).
  const valores = { inteligencia: 10, forca: 19, destreza: 10, constituicao: 10, sabedoria: 10, carisma: 10 };
  for (const k of chaves) {
    await page.fill(`[data-edicao-atributo="${k}"]`, String(valores[k]));
    await page.locator(`[data-edicao-atributo="${k}"]`).dispatchEvent('change');
  }
  await page.selectOption('#edicao-metodo-atributos', 'manual');
  await page.click('#btn-salvar-edicao-ficha');
  await page.waitForTimeout(400);

  expect(await page.locator('#modal-overlay').isVisible(),
    'modal deveria fechar após uma redistribuição válida').toBe(false);

  const salvo = await personagemSalvo(page);
  expect(salvo?.atributos_base?.forca, 'força base deveria ter sido atualizada para 19').toBe(19);
  expect(salvo?.atributos_base?.inteligencia, 'inteligência base deveria ter voltado a 10').toBe(10);
  expect(salvo?.atributos?.inteligencia,
    'inteligência total (base 10 + bônus 2 de antecedente) deveria ser 12').toBe(12);
});
