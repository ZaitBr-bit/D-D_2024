// Helpers dos testes de paridade entre o site original e o refatorado.
export const ORIG = 'http://127.0.0.1:8801/site/';
export const NOVO = 'http://127.0.0.1:8802/site/';

/**
 * Abre uma pagina em cada site e passa a coletar erros de console e falhas de
 * carregamento. Devolve os dois "lados" com seu coletor de erros.
 */
export async function abrirParelha(context, hash = '') {
  const lados = [];
  for (const [nome, base] of [['original', ORIG], ['refatorado', NOVO]]) {
    const page = await context.newPage();
    const erros = [];
    page.on('console', (m) => {
      if (m.type() === 'error') erros.push(`console: ${m.text()}`);
    });
    page.on('pageerror', (e) => erros.push(`pageerror: ${e.message}`));
    page.on('requestfailed', (r) => {
      const url = r.url();
      // Firebase/Google podem falhar offline; nao sao o objeto do teste.
      if (/googleapis|gstatic|firebase|google\.com/.test(url)) return;
      erros.push(`requestfailed: ${url} (${r.failure()?.errorText})`);
    });
    lados.push({ nome, base, page, erros });
  }
  // Navega SEMPRE, inclusive com hash vazio (que e a home). Sem isso a pagina
  // fica em about:blank e qualquer `import()` relativo dentro de evaluate()
  // falha por nao ter URL base -- erro que so aparece no primeiro teste que
  // semeia antes de navegar.
  await irPara(lados, hash);
  return lados;
}

/** Navega os dois lados para o mesmo hash e espera o app assentar. */
export async function irPara(lados, hash) {
  await Promise.all(lados.map(async (l) => {
    await l.page.goto(l.base + hash, { waitUntil: 'domcontentloaded' });
    await assentar(l.page);
  }));
}

/** Espera o conteudo da rota aparecer e a rede acalmar. */
export async function assentar(page) {
  await page.waitForSelector('#app-content', { state: 'attached' });
  await page.waitForFunction(
    () => (document.getElementById('app-content')?.innerHTML || '').trim().length > 0,
    null, { timeout: 15_000 },
  );
  await page.waitForLoadState('networkidle').catch(() => {});
}

/**
 * HTML de `#app-content` com o que e naturalmente instavel neutralizado:
 * ids gerados, datas, e o resultado de rolagens de dado. O que sobra e a
 * estrutura, as classes CSS e os textos -- exatamente onde a tentativa
 * anterior quebrou.
 */
export async function instantaneo(page) {
  return page.evaluate(() => {
    const raiz = document.getElementById('app-content');
    if (!raiz) return '(sem #app-content)';
    return raiz.innerHTML
      .replace(/\b[0-9a-f]{8,}\b/gi, '<ID>')
      .replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z?/g, '<DATA>')
      .replace(/\d{2}\/\d{2}\/\d{4}/g, '<DATA>')
      .replace(/\s+/g, ' ')
      .trim();
  });
}

/** Classes CSS distintas presentes na arvore -- pega markup trocado. */
export async function classesUsadas(page) {
  return page.evaluate(() => {
    const set = new Set();
    document.querySelectorAll('#app-content *').forEach((el) => {
      el.classList.forEach((c) => set.add(c));
    });
    return [...set].sort();
  });
}

/**
 * Posicao e tamanho dos elementos-chave. Duas paginas podem ter o mesmo HTML
 * e layouts diferentes se uma classe CSS nao existir no stylesheet -- foi
 * literalmente o bug da barra de navegacao do criador.
 */
export async function geometria(page, seletores) {
  return page.evaluate((sels) => {
    const fora = {};
    for (const s of sels) {
      const el = document.querySelector(s);
      if (!el) { fora[s] = null; continue; }
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      fora[s] = {
        largura: Math.round(r.width),
        altura: Math.round(r.height),
        position: cs.position,
        display: cs.display,
        bottom: cs.bottom,
        zIndex: cs.zIndex,
      };
    }
    return fora;
  }, seletores);
}

/**
 * Confirma um modal de selecao, fazendo as escolhas obrigatorias.
 *
 * Varias classes exigem escolha de nivel 1 (Estilo de Luta, maestrias). O
 * app recusa a confirmacao com um toast e mantem o modal aberto. Aqui a
 * gente escolhe a primeira opcao ainda nao marcada de cada grupo e tenta de
 * novo, ate o modal fechar -- que e o que um jogador faria.
 *
 * EXCLUSOES -- achado da Rodada 2 de correcao da Task 9 (I4): este e o
 * MESMO bloco CARDS de `preencherTela()`, com a MESMA vulnerabilidade
 * (clicar no card inteiro quando o handler vive num filho com
 * `stopPropagation`) -- mas so `preencherTela()` tinha sido corrigida.
 * Repete aqui as mesmas exclusoes, caso algum modal de magia/manobra/
 * invocacao venha a ser fechado por esta funcao em vez de
 * `resolverModalAberto()`.
 * `:not(#metamagia-grid *)` -- achado da Rodada 3: a migracao do I5 (grade
 * de Metamagia do Feiticeiro, `habilidades.js`) criou um SEXTO grid de
 * `.opcao-card` sem guarda nenhuma. Pior que os outros: o card la tem
 * `data-meta-info` com listener PROPRIO (abre um sub-modal de descricao),
 * entao o clique generico nao seria inocuo -- empilharia um overlay e
 * mudaria o alvo de `resolverModalAberto`.
 * `:not(#troca-passo-entra *)` -- achado da Rodada 1 de correcao da Task 10
 * (I1, critico): a grade do que ENTRA em `montarTroca` (ui-opcoes.js,
 * id fixo `troca-passo-entra`, compartilhado por toda troca opcional --
 * Estilo de Luta hoje, magia/truque/manobra/maestria nas proximas tarefas)
 * so deve ser preenchida quando o JOGADOR (ou um teste dedicado) pede a
 * troca. Sem esta exclusao, se a grade acabar visivel por qualquer caminho,
 * o bloco generico abaixo a trata como escolha obrigatoria (`marcados ===
 * 0`) e clica no primeiro item livre -- exercendo uma troca que ninguem
 * pediu.
 * `:not(#troca-passo-sai *)` -- achado da Task 12 (Rodada 1 de correcao):
 * a exclusao acima protege so o passo 2 (o que ENTRA). O passo 1 (o que
 * SAI, `troca-passo-sai`) so escapava dessa vulnerabilidade enquanto tinha
 * exatamente 1 opcao -- ai `montarTroca` desenha um card de APRESENTACAO
 * (`selecionavel: false`, sem `data-opcao`, sem handler de clique proprio;
 * ver comentario em `ui-opcoes.js`), que este bloco generico ignora porque
 * so reage a cards com `data-opcao`. Magia, truque e manobra (Task 12) sao
 * os PRIMEIROS casos do app em que o "sai" tem VARIAS opcoes -- ai
 * `montarTroca` usa `montarSeletor` de verdade para o passo 1, com cards
 * `data-opcao` clicaveis de verdade. Reproduzido ao vivo: um Bardo
 * subindo de nivel com magias preparadas ja elegiveis para troca,
 * conduzido so pelo driver generico (sem tocar em nada de troca), tinha um
 * card do passo 1 clicado sozinho (mesmo mecanismo do achado da Task 10:
 * `marcados === 0` == escolha obrigatoria aos olhos deste bloco); como o
 * passo 2 ja era excluido, a subida travava para sempre em "Escolha a
 * magia substituta ou desmarque a troca" -- o driver nunca completava a
 * troca que ele mesmo comecou, so a deixava pela metade. A causa raiz e a
 * mesma da Task 10 (guarda escrita para o caso que estava a mao, nao para
 * o componente inteiro) -- por isso a exclusao aqui e do WIDGET inteiro
 * (os dois passos), nao so do passo 1: cobre de uma vez toda troca
 * opcional futura tambem, sem depender de quantas opcoes o "sai" tem.
 * LIMITE: as duas exclusoes juntas tiram TODA troca de `montarTroca` do
 * alcance do driver generico. Isso so e seguro porque toda troca no app
 * hoje e OPCIONAL (o jogador pode sempre "nao trocar"). Se algum dia uma
 * escolha OBRIGATORIA passar a usar `montarTroca`, excluir o componente
 * inteiro faria o driver travar em vez de progredir -- quem fizer isso
 * precisa rever esta guarda (e a gemea em `preencherTela()`, mais abaixo).
 */
export async function confirmarModal(page, idBotao, maxTentativas = 8) {
  for (let i = 0; i < maxTentativas; i++) {
    await page.click('#' + idBotao);
    const fechou = await page.waitForSelector('#modal-overlay', {
      state: 'hidden', timeout: 1500,
    }).then(() => true, () => false);
    if (fechou) return;

    const marcou = await page.evaluate(() => {
      const modal = document.getElementById('modal-corpo');
      if (!modal) return false;
      const CARDS = [
        ['.opcao-card:not([data-grid-nome]):not(#grid-manobras *):not(#bruxo-inv-grid *)'
          + ':not(#resultado-magias *):not(#resultado-troca *):not(#metamagia-grid *)'
          + ':not(#troca-passo-sai *):not(#troca-passo-entra *)', 'selecionada'],
      ];
      for (const [seletor, marcado] of CARDS) {
        for (const card of modal.querySelectorAll(seletor)) {
          if (card.classList.contains('bloqueada') || card.dataset.cheio) continue;
          if (!card.classList.contains(marcado)) { card.click(); return true; }
        }
      }
      for (const sel of modal.querySelectorAll('select')) {
        if (!sel.value && sel.options.length > 1) {
          sel.selectedIndex = 1;
          sel.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }
      }
      return false;
    });
    if (!marcou) {
      throw new Error(
        `modal nao fechou e nao ha mais escolhas a fazer (botao #${idBotao})`);
    }
  }
  throw new Error(`modal nao fechou apos ${maxTentativas} tentativas`);
}

/** Faz a mesma acao nos dois lados. */
export async function nosDois(lados, acao) {
  for (const l of lados) await acao(l.page, l);
}

/**
 * Resolve o modal aberto: preenche a tela e avanca, ate fechar.
 *
 * Quatro defeitos foram corrigidos aqui, e cada um vale como aviso:
 *
 * 1. ORDEM -- avancava antes de escolher, e atravessava a tela de subclasse
 *    sem escolher nada;
 * 2. "a tela mudou" nao prova progresso -- na subclasse o botao AVANCA sem
 *    exigir a escolha, e a recusa so aparece na confirmacao final;
 * 3. VOCABULARIO -- a subclasse usava `.levelup-subclasse-card`/`selecionada`,
 *    e nao `.selection-card`/`selected` como o resto do app (hoje as duas
 *    telas usam `.opcao-card`, unificadas pela Task 9 em diante);
 * 4. QUANTIDADE -- contar quantas opcoes marcar e adivinhacao. O sinal certo
 *    e o BOTAO DE CONFIRMAR: o app o habilita quando o requisito e cumprido.
 *    Marcar ate ele habilitar cobre "exatamente 1" (Academico) e "exatamente
 *    2" (Grimorio do Mago) sem o teste saber de nenhum dos dois.
 *
 * Tambem abre sub-selecoes: varias escolhas ficam atras de um botao no CORPO
 * do modal (`#btn-lvlup-grimorio` e afins), que abre um segundo overlay.
 */
export async function resolverModalAberto(page, maxTelas = 24) {
  for (let i = 0; i < maxTelas; i++) {
    if (!await page.locator('#modal-overlay').isVisible()) return true;

    await preencherTela(page);

    // Abrir as sub-selecoes DESTA tela antes de avancar.
    //
    // Nao dava para deixar isso so para depois de um avanco recusado: o botao
    // do grimorio vive na tela "Selecao de Magias", e o app deixa avancar dela
    // sem preencher -- a recusa so acontece la na "Revisao e Confirmacao",
    // onde o botao ja nao existe. Era a mesma falacia do "a tela mudou, entao
    // progrediu" que ja tinha atrapalhado na escolha de subclasse.
    for (let s = 0; s < 6; s++) {
      const abriu = await page.evaluate(() => {
        const corpo = document.getElementById('modal-corpo');
        // `:not([data-troca-um])` -- achado da Rodada 1 de correcao da Task
        // 10 (I1, critico): o botao "Trocar este" de `montarTroca`
        // (ui-opcoes.js, caso "sai" com 1 opcao so, ex.: Troca de Estilo de
        // Luta do Guerreiro) e um <button> comum, habilitado, sem overlay
        // proprio -- encaixava no mesmo criterio usado para abrir botoes
        // como "Grimorio: +2 Magias". Clicar nele EXERCE uma troca opcional
        // que o driver nao pediu: o passo 1 (apresentacao do item atual)
        // some do DOM, o passo 2 (grade do que entra) aparece vazio, e o
        // bloco generico de `.opcao-card` em `preencherTela` (mais abaixo)
        // via `marcados === 0` clicava no primeiro item livre da grade --
        // trocando o Estilo de Luta do personagem sozinho, sem o jogador
        // pedir e sem nenhum erro. `montarTroca` sera reusada por troca de
        // magia/truque/manobra/maestria nas proximas tarefas; todas usam o
        // mesmo atributo `data-troca-um`, entao a exclusao vale para todas.
        const b = [...(corpo?.querySelectorAll('button:not([data-troca-um])') ?? [])]
          .find((x) => !x.disabled && !x.dataset.resolvido);
        if (!b) return false;
        b.dataset.resolvido = '1';
        b.click();
        return true;
      });
      if (!abriu) break;
      await page.waitForTimeout(500);
      await preencherTela(page);
      await page.evaluate(() => {
        const overlays = [...document.querySelectorAll('.modal-overlay')]
          .filter((o) => getComputedStyle(o).display !== 'none');
        if (overlays.length < 2) return;  // nao abriu sub-modal: nada a fechar
        const topo = overlays[overlays.length - 1];
        // A grade do level up confirma com um `btn-secondary` rotulado
        // "Confirmar Selecao".
        topo.querySelector('#modal-acoes button:not([disabled])')?.click();
      });
      await page.waitForTimeout(400);
    }

    const antes = await page.evaluate(
      () => document.getElementById('modal-corpo')?.innerHTML.length ?? 0);

    const avancou = await page.evaluate(() => {
      const acoes = document.getElementById('modal-acoes');
      const b = acoes?.querySelector(
        '.btn-primary:not([disabled]), .btn-success:not([disabled]), .btn-accent:not([disabled])');
      if (b) { b.click(); return true; }
      return false;
    });
    await page.waitForTimeout(400);
    if (!await page.locator('#modal-overlay').isVisible()) return true;

    const depois = await page.evaluate(
      () => document.getElementById('modal-corpo')?.innerHTML.length ?? 0);
    if (avancou && depois !== antes) continue;

    // So agora: o avanco foi RECUSADO, entao falta alguma escolha que esta
    // atras de um botao no corpo (por exemplo o grimorio do Mago ao subir de
    // nivel). Abrir botao antes disso era o erro da versao anterior: ela
    // clicava em TODOS os botoes do corpo, inclusive os opcionais como
    // "trocar truque", que criam exigencia nova ("Escolha o truque
    // substituto ou desmarque a troca"). Mesmo motivo do
    // `:not([data-troca-um])` de cima (Rodada 1 da Task 10): sem essa
    // exclusao, o fallback abaixo (`botoes.find(x => !x.dataset.resolvido)`)
    // poderia cair no "Trocar este" quando o toast de erro nao bate com
    // nenhum rotulo -- e essa troca e opcional, nunca a exigencia real.
    const abriu = await page.evaluate(() => {
      const corpo = document.getElementById('modal-corpo');
      const botoes = [...(corpo?.querySelectorAll('button:not([data-troca-um])') ?? [])]
        .filter((x) => !x.disabled);
      if (!botoes.length) return false;

      // Escolhe o botao pelo TOAST de erro: o app diz o que falta
      // ("...no Grimorio") e o rotulo do botao diz o que ele abre
      // ("Grimorio: +2 Magias"). Casar as duas coisas evita abrir os botoes
      // opcionais, como o de trocar truque -- e nao depende de marcador no
      // DOM, que some quando o corpo re-renderiza.
      const toasts = [...document.querySelectorAll('#toast-container .toast')];
      const erro = (toasts[toasts.length - 1]?.textContent || '').toLowerCase();
      const palavras = erro.split(/[^a-zà-ÿ]+/i).filter((p) => p.length > 4);
      const casa = botoes.find((b) => {
        const rot = b.textContent.toLowerCase();
        return palavras.some((p) => rot.includes(p));
      });
      const alvo = casa || botoes.find((x) => !x.dataset.resolvido);
      if (!alvo) return false;
      alvo.dataset.resolvido = '1';
      alvo.click();
      return true;
    });
    if (!abriu) break;

    await page.waitForTimeout(500);
    await preencherTela(page);
    await page.evaluate(() => {
      const overlays = [...document.querySelectorAll('.modal-overlay')]
        .filter((o) => getComputedStyle(o).display !== 'none');
      const topo = overlays[overlays.length - 1];
      // A grade do level up confirma com um `btn-secondary` rotulado
      // "Confirmar Selecao" -- procurar so por primary/success/accent
      // deixava a grade aberta para sempre.
      const b = topo?.querySelector(
        '#modal-acoes .btn-primary:not([disabled]), #modal-acoes .btn-success:not([disabled]),'
        + ' #modal-acoes .btn-secondary:not([disabled]), #modal-acoes button:not([disabled])');
      b?.click();
    });
    await page.waitForTimeout(500);
  }

  await page.evaluate(() => window.fecharModal?.());
  await page.waitForTimeout(250);
  return !(await page.locator('#modal-overlay').isVisible());
}

/**
 * Marca opcoes na tela/overlay mais ao topo ate o confirmar habilitar.
 *
 * Sempre garante ao menos uma escolha por grupo; depois disso, so continua
 * enquanto o botao de confirmar estiver desabilitado -- que e o app dizendo
 * "ainda falta".
 */
async function preencherTela(page, maxEscolhas = 30) {
  for (let i = 0; i < maxEscolhas; i++) {
    const escolheu = await page.evaluate(() => {
      const overlays = [...document.querySelectorAll('.modal-overlay')]
        .filter((o) => getComputedStyle(o).display !== 'none');
      const raiz = overlays[overlays.length - 1] || document;
      const corpo = raiz.querySelector('#modal-corpo') || raiz;
      if (!corpo) return false;

      const confirmar = raiz.querySelector(
        '#modal-acoes .btn-primary, #modal-acoes .btn-success, .btn-primary, .btn-success');
      const faltaAlgo = confirmar ? confirmar.disabled : true;

      // `:not([data-grid-nome])` exclui a grade de selecao do level up
      // (`abrirGridSelecao`, Task 9: migrou `.magia-card` -> `.opcao-card`).
      // Sem excluir, este bloco generico capturaria os cards da grade ANTES
      // do bloco especializado do `#grid-sel-count` mais abaixo, e clicaria
      // no card INTEIRO -- que nao tem listener proprio (o handler vive no
      // filho `[data-grid-check]`, com `stopPropagation`). O clique nao
      // teria efeito nenhum, mas `livre.click(); return true;` mesmo assim
      // reportaria "progresso", e a grade nunca fecharia a conta.
      //
      // Mesmo motivo para `:not(#grid-manobras *)` (grade de manobras do
      // Mestre da Batalha, `abrirGridManobras` em manobras-ui.js, chamada
      // por `levelup-ui.js` durante a subida) e `:not(#bruxo-inv-grid *)`
      // (invocacoes do Bruxo, `abrirModalRecursosBruxo` em
      // classes/bruxo.js): as duas tambem migraram de `.magia-card` para
      // `.opcao-card` na Task 9 e tambem tem o handler no filho
      // (`[data-grid-manobra-check]`/`[data-inv-toggle]`, ambos com
      // `stopPropagation`), sem nenhum atributo proprio no card para
      // excluir por `:not([data-*])` como a grade do level up -- por isso a
      // exclusao aqui e pelo container (`:not(#id *)`, valido em
      // Selectors Level 4/Chromium), nao por atributo do card.
      //
      // Achado da Rodada 2 de correcao da Task 9 (I4): faltavam mais dois
      // containers com o MESMO padrao, ambos em `site/js/sheet/grimorio.js`
      // -- `#resultado-magias` (`mostrarBuscaMagia`: truques via
      // `[data-truque-check]`, magias de circulo via `[data-circ-check]`,
      // os atributos `data-toggle-truque` no card NAO tem listener nenhum)
      // e `#resultado-troca` (`mostrarTrocaMagias`: `[data-troca-check]`,
      // idem `data-troca-toggle` sem listener). Nenhum dos dois tem
      // `data-grid-nome` nem vive nos containers ja excluidos, entao o
      // ramo generico os capturava do mesmo jeito, com o dobro de cards
      // (truques + circulos + selecionadas + por-circulo da troca).
      //
      // Achado da Rodada 3: `#metamagia-grid` (Metamagia do Feiticeiro,
      // `habilidades.js`, migrada no I5 da propria Rodada 2) ficou de fora
      // das exclusoes que a mesma rodada escreveu -- inconsistencia da
      // correcao anterior, nao um caso novo. Ali o card tem `data-meta-info`
      // com listener PROPRIO (abre sub-modal de descricao): o clique
      // generico no card nao seria inocuo como nos outros, empilharia um
      // overlay e desviaria o alvo de `resolverModalAberto`.
      //
      // Achado da Rodada 1 de correcao da Task 10 (I1, critico):
      // `:not(#troca-passo-entra *)` -- a grade do que ENTRA em
      // `montarTroca` (ui-opcoes.js) tem id fixo `troca-passo-entra`,
      // reusado por TODA troca opcional montada com o componente (Estilo de
      // Luta hoje; magia/truque/manobra/maestria nas proximas tarefas). Uma
      // troca opcional comeca sem nada marcado (`marcados === 0`), que e a
      // MESMA condicao que este bloco usa para forcar progresso numa
      // escolha OBRIGATORIA -- sem a exclusao, o driver clicava no primeiro
      // item livre da grade e trocava a escolha do personagem sozinho,
      // mesmo quando ninguem pediu troca nenhuma. Reproduzido ao vivo: um
      // Guerreiro nivel 2->3 com Estilo de Luta 'Defensivo', conduzido so
      // pelo driver generico (sem tocar em nada de Estilo de Luta), saia do
      // level-up com o estilo trocado para 'Arquearia'.
      //
      // `:not(#troca-passo-sai *)` -- achado da Task 12 (Rodada 1 de
      // correcao): a exclusao acima so cobre o passo 2 (o que ENTRA). O
      // passo 1 (o que SAI, `troca-passo-sai`) escapava da vulnerabilidade
      // so enquanto tinha exatamente 1 opcao -- ai `montarTroca` desenha um
      // card de APRESENTACAO (`selecionavel: false`, sem `data-opcao`, sem
      // handler de clique proprio; ver comentario em `ui-opcoes.js`), que
      // este bloco ignora porque so reage a cards com `data-opcao`. Magia,
      // truque e manobra (Task 12) sao os PRIMEIROS casos do app em que o
      // "sai" tem VARIAS opcoes -- ai `montarTroca` usa `montarSeletor` de
      // verdade para o passo 1, com cards `data-opcao` clicaveis de
      // verdade, e o mesmo mecanismo do achado da Task 10 se repete: um
      // card do passo 1 e clicado sozinho (`marcados === 0`). Reproduzido
      // ao vivo: um Bardo subindo de nivel com magias preparadas ja
      // elegiveis para troca, conduzido so pelo driver generico, tinha uma
      // magia marcada para SAIR sozinho; como o passo 2 ja era excluido, a
      // subida travava para sempre em "Escolha a magia substituta ou
      // desmarque a troca" -- o driver comecava uma troca que ninguem
      // pediu e nunca conseguia terminar. A causa raiz e a mesma da Task
      // 10 (guarda escrita para o caso que estava a mao, nao para o
      // componente inteiro); por isso a exclusao aqui e do WIDGET inteiro
      // (os dois passos), nao so do passo 1 -- cobre de uma vez qualquer
      // troca opcional futura tambem, seja qual for o numero de opcoes dos
      // dois lados.
      //
      // LIMITE: as duas exclusoes juntas tiram TODA troca de `montarTroca`
      // do alcance do driver generico. So e seguro porque toda troca no
      // app hoje e OPCIONAL (o jogador sempre pode "nao trocar"). Se algum
      // dia uma escolha OBRIGATORIA passar a usar `montarTroca`, excluir o
      // componente inteiro faria o driver TRAVAR em vez de progredir --
      // quem tornar uma troca obrigatoria precisa rever esta guarda (e a
      // gemea em `confirmarModal()`, acima).
      const CARDS = [
        ['.opcao-card:not([data-grid-nome]):not(#grid-manobras *):not(#bruxo-inv-grid *)'
          + ':not(#resultado-magias *):not(#resultado-troca *):not(#metamagia-grid *)'
          + ':not(#troca-passo-sai *):not(#troca-passo-entra *)', 'selecionada'],
      ];
      for (const [seletor, marcado] of CARDS) {
        const cards = [...corpo.querySelectorAll(seletor)];
        if (!cards.length) continue;
        const marcados = cards.filter((c) => c.classList.contains(marcado)).length;
        // Uma escolha sempre; mais so enquanto o app disser que falta.
        if (marcados === 0 || faltaAlgo) {
          // `.opcao-card` (vocabulario novo) marca bloqueio por classe
          // (`bloqueada`) e esgotamento do limite por atributo
          // (`data-cheio`) -- pular os dois evita clicar num card que nao
          // aceita clique.
          const livre = cards.find((c) => !c.classList.contains(marcado)
            && !c.classList.contains('bloqueada') && !c.dataset.cheio);
          if (livre) { livre.click(); return true; }
        }
      }

      // Grade de selecao do level up (`abrirGridSelecao`): cards
      // `[data-grid-nome]` com o handler no filho `[data-grid-check]`, que
      // ainda faz `stopPropagation()`. E onde o Mago escolhe as "2 magias
      // novas" para o grimorio ao subir de nivel.
      //
      // Como a grade nao desabilita o botao de confirmar, `faltaAlgo` nao
      // ajuda aqui: o proprio contador (`#grid-sel-count`) diz quantas faltam.
      const contador = corpo.querySelector('#grid-sel-count');
      if (contador) {
        const atual = Number(contador.textContent) || 0;
        const alvo = Number((contador.parentElement?.textContent || '')
          .replace(/\s+/g, '').split('/')[1]) || 0;
        if (atual < alvo) {
          const livre = [...corpo.querySelectorAll('[data-grid-nome]')].find(
            (c) => !c.classList.contains('selecionada')
              && !c.classList.contains('bloqueada'));
          const check = livre?.querySelector('[data-grid-check]');
          if (check) { check.click(); return true; }
        }
      }

      // Distribuicao de pontos de atributo (`+0/+1/+2`, total exatamente 2).
      //
      // Estes selects NAO entram na regra geral: o valor padrao deles e "0",
      // que e truthy, entao o driver os considerava "ja preenchidos" e nunca
      // distribuia nada -- a subida travava em "Distribua exatamente 2 pontos
      // de atributo". Tambem nao da para so escolher a primeira opcao livre:
      // a soma tem de fechar em 2, nem mais nem menos.
      // Dois widgets distintos: o ASI simples usa ids `levelup-attr-<attr>`
      // e o do talento "Aumento no Valor de Atributo" usa a classe
      // `.levelup-talento-asi-distribuicao`. Os dois pedem soma exatamente 2.
      const asi = [...corpo.querySelectorAll(
        '.levelup-talento-asi-distribuicao, [id^="levelup-attr-"]')];
      if (asi.length) {
        const soma = () => asi.reduce((s, x) => s + (parseInt(x.value) || 0), 0);
        if (soma() !== 2) {
          for (const s of asi) { s.value = '0'; s.dispatchEvent(new Event('change', { bubbles: true })); }
          // Preferir +2 num atributo; se estiver bloqueado (valor >= 19),
          // cair para +1 em dois atributos diferentes.
          const doisPontos = asi.find((s) =>
            [...s.options].some((o) => o.value === '2' && !o.disabled));
          if (doisPontos) {
            doisPontos.value = '2';
            doisPontos.dispatchEvent(new Event('change', { bubbles: true }));
          } else {
            const umPonto = asi.filter((s) =>
              [...s.options].some((o) => o.value === '1' && !o.disabled)).slice(0, 2);
            for (const s of umPonto) {
              s.value = '1';
              s.dispatchEvent(new Event('change', { bubbles: true }));
            }
          }
          return true;
        }
      }

      // Selects de TROCA sao opcionais: vazio significa "nao trocar". Preencher
      // um deles LIGA a troca e cria uma exigencia nova ("Escolha o truque
      // substituto ou desmarque a troca"), que foi o que travou a subida de
      // nivel do Mago. O mesmo vale para o `select` de magia.
      const selects = [...corpo.querySelectorAll('select')]
        .filter((s) => !/troca/i.test(s.id))
        .filter((s) => !s.classList.contains('levelup-talento-asi-distribuicao'))
        .filter((s) => !/^levelup-attr-/.test(s.id));
      const usados = new Set(selects.map((s) => s.value).filter(Boolean));
      for (const sel of selects) {
        if (sel.value) continue;
        for (const opt of sel.options) {
          if (!opt.value || opt.disabled || usados.has(opt.value)) continue;
          sel.value = opt.value;
          sel.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }
      }

      const grupos = new Set(
        [...corpo.querySelectorAll('input[type="radio"]')].map((r) => r.name));
      for (const g of grupos) {
        const ops = [...corpo.querySelectorAll(`input[type="radio"][name="${g}"]`)];
        if (ops.length && !ops.some((o) => o.checked)) { ops[0].click(); return true; }
      }

      // Checkboxes agrupadas pelo primeiro atributo data-*, que e como o app
      // distingue os grupos (`data-academico-expertise`, e assim por diante).
      const porGrupo = new Map();
      for (const c of corpo.querySelectorAll('input[type="checkbox"]')) {
        const chave = [...c.attributes].map((a) => a.name)
          .find((n) => n.startsWith('data-'));
        // Caixa SEM atributo `data-*` e alternador opcional, nao escolha
        // obrigatoria. Marcar uma delas cria exigencia onde nao havia -- foi
        // o que aconteceu com "trocar truque" no level up, que passou a pedir
        // "Escolha o truque substituto ou desmarque a troca".
        if (!chave) continue;
        if (!porGrupo.has(chave)) porGrupo.set(chave, []);
        porGrupo.get(chave).push(c);
      }
      for (const caixas of porGrupo.values()) {
        const marcadas = caixas.filter((c) => c.checked).length;
        if (marcadas === 0 || faltaAlgo) {
          const livre = caixas.find((c) => !c.checked && !c.disabled);
          if (livre) { livre.click(); return true; }
        }
      }
      return false;
    });
    if (!escolheu) return;
    await page.waitForTimeout(160);
  }
}

/** Indice do passo ativo do wizard, ou -1 se nao houver wizard na tela. */
export async function passoAtual(page) {
  return page.evaluate(() => {
    const el = document.querySelector('.wizard-step.active');
    return el ? Number(el.dataset.step) : -1;
  });
}

/**
 * Texto do ultimo toast de erro visivel, ou null.
 *
 * O app remove o toast depois de 3 segundos, entao leia logo apos a acao.
 * E este texto que diz o que o passo ainda exige ("Selecione 2 pericias da
 * classe (0 selecionadas)") -- ele e a interface entre o produto e o driver,
 * e por isso o driver nao precisa saber nada sobre classes ou especies.
 */
export async function lerToastErro(page) {
  return page.evaluate(() => {
    const t = document.querySelectorAll('#toast-container .toast.error');
    return t.length ? t[t.length - 1].textContent.trim() : null;
  });
}

/**
 * Preenche o passo atual do wizard ate ele aceitar avancar.
 *
 * A cada volta: tenta avancar; se o app recusar, marca MAIS UMA opcao ainda
 * nao escolhida e tenta de novo. Converge porque cada volta escolhe algo
 * novo; para quando nao ha mais nada a escolher.
 *
 * @returns {Promise<boolean>} true se o passo avancou.
 */
export async function satisfazerPasso(page, { maxVoltas = 80 } = {}) {
  // 80, e nao 24: o passo de Magias do Mago pede 3 truques + 6 do grimorio +
  // 4 preparadas, mais as trocas de aba entre elas. Cada uma dessas acoes
  // consome uma volta, e o teto antigo acabava antes de a fase de preparo
  // comecar -- o que parecia "o driver nao sabe preparar" era so o laco
  // terminando cedo.
  const inicial = await passoAtual(page);
  for (let volta = 0; volta < maxVoltas; volta++) {
    // Clicar num card de especie/antecedente ABRE um modal, e enquanto ele
    // estiver aberto todo clique seguinte bate no overlay. Resolver aqui
    // dentro, e nao depois do laco, e o que faz o driver atravessar esses
    // passos -- sem isso ele empaca no passo 2 com "Selecione uma especie".
    if (await page.locator('#modal-overlay').isVisible()) {
      await resolverModalAberto(page);
    }

    await page.evaluate(() => document.getElementById('btn-next')?.click());
    await page.waitForTimeout(350);
    if (await passoAtual(page) !== inicial) return true;
    if (await page.locator('#modal-overlay').isVisible()) {
      await resolverModalAberto(page);
      continue;
    }

    const marcou = await page.evaluate(() => {
      const raiz = document.getElementById('wizard-content');
      if (!raiz) return false;
      // A caixa de busca do seletor de opcoes (`.opcao-busca`, montada por
      // `montarSeletor` em `ui-opcoes.js`) e um `input[type="text"]" como
      // qualquer outro, mas preenche-la nao satisfaz escolha nenhuma: o
      // proprio listener da busca filtra `.opcao-lista` pelo termo digitado.
      // "Heroi de Teste" nao bate com nenhuma opcao real, entao a lista
      // esvazia e some exatamente o card que o driver precisa clicar mais
      // adiante -- o passo trava sem escolher nada. Excluida por classe, e
      // nao por id do container, para continuar valendo em qualquer passo
      // que venha a montar o seletor (Magias, Equipamento, e os que ainda
      // vierem na migracao para `.opcao-card`).
      for (const inp of raiz.querySelectorAll('input[type="text"]:not(.opcao-busca)')) {
        if (!inp.value.trim()) {
          inp.value = 'Heroi de Teste';
          inp.dispatchEvent(new Event('input', { bubbles: true }));
          inp.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }
      }
      // Selects: escolher a primeira opcao HABILITADA cujo valor nenhum
      // outro select ja esteja usando. Sem essa checagem, dois selects
      // mutuamente exclusivos (o +2/+1 do antecedente e o caso) recebem o
      // mesmo valor, o app limpa um deles, e o driver repete para sempre.
      const selects = [...raiz.querySelectorAll('select')];
      const usados = new Set(selects.map((s) => s.value).filter(Boolean));
      for (const sel of selects) {
        if (sel.value) continue;
        for (const opt of sel.options) {
          if (!opt.value || opt.disabled || usados.has(opt.value)) continue;
          sel.value = opt.value;
          sel.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }
      }
      const grupos = new Set(
        [...raiz.querySelectorAll('input[type="radio"]')].map((r) => r.name));
      for (const g of grupos) {
        const opcoes = [...raiz.querySelectorAll(`input[type="radio"][name="${g}"]`)];
        if (opcoes.length && !opcoes.some((o) => o.checked)) {
          opcoes[0].click();
          return true;
        }
      }
      for (const c of raiz.querySelectorAll('input[type="checkbox"]')) {
        if (!c.checked && !c.disabled) { c.click(); return true; }
      }
      // Cards agrupados pelo elemento PAI, que e como um humano ve os grupos.
      //
      // "O primeiro nao-selecionado da tela" nao serve: o passo de Equipamento
      // tem dois grupos e escolher a segunda opcao de um desfaz a primeira, o
      // que fazia o driver ciclar dentro do grupo da classe e nunca chegar ao
      // do antecedente ("Selecione o equipamento do antecedente").
      //
      // Agrupar por atributo `data-*` tambem nao serve, e por dois motivos
      // opostos: no Equipamento os quatro cards compartilham o NOME
      // `data-equip-tipo` e so o VALOR os separa; ja no passo de Classe cada
      // card tem um valor unico (`data-classe="Mago"`), e agrupar por valor
      // criaria doze grupos e faria o driver escolher todas as classes.
      // O pai resolve os dois: um container por grupo, um grid para as classes.
      //
      // Cards `.opcao-card`: bloqueio proprio (classe `bloqueada`, sem
      // `data-opcao`) e esgotamento (`data-cheio`) precisam ser pulados --
      // senao o driver tentaria clicar num card que nao aceita clique e
      // travaria a volta.
      //
      // Exclui tambem os cards de MAGIA (Task 9: `.magia-card` migrou para
      // `.opcao-card`, mesma classe que os cards de classe/especie/
      // antecedente que este bloco ja tratava). Sem excluir, este `porPai`
      // generico capturaria os cards de truque/magia/preparo ANTES dos
      // blocos especializados mais abaixo (cardsIM/cardsMagia/preparadas) --
      // e clicaria no card INTEIRO, que nao tem listener proprio (o handler
      // vive no filho `[data-creator-check]`/`[data-im-check]`, com
      // `stopPropagation`), gerando clique sem efeito, "progresso" falso
      // (`return true`) e a volta nunca convergindo.
      const porPai = new Map();
      for (const card of raiz.querySelectorAll(
        '.opcao-card:not([data-magia-nome]):not([data-mago-preparada]):not([data-im-magia])')) {
        if (card.classList.contains('bloqueada') || card.dataset.cheio) continue;
        const pai = card.parentElement;
        if (!porPai.has(pai)) porPai.set(pai, []);
        porPai.get(pai).push(card);
      }
      for (const cards of porPai.values()) {
        if (cards.some((c) => c.classList.contains('selecionada'))) continue;
        cards[0].click();
        return true;
      }

      // Talento INICIADO EM MAGIA: secao com abas PROPRIAS (`[data-im-tab]`,
      // truques e 1o circulo) e cards proprios (`[data-im-magia]`, com o
      // handler no filho `[data-im-check]`).
      //
      // Busca direta na raiz, sem tentar delimitar container: a barra de abas
      // e a lista de cards sao elementos IRMAOS, entao subir pelo `closest`
      // a partir das abas nao alcanca os cards -- foi o que fez a primeira
      // versao deste bloco nao surtir efeito nenhum.
      const cardsIM = [...raiz.querySelectorAll('[data-im-magia]')];
      if (cardsIM.length) {
        const contarIM = () =>
          raiz.querySelectorAll('[data-im-magia].selecionada').length;
        const livreIM = cardsIM.find((c) => !c.classList.contains('selecionada')
          && !c.classList.contains('bloqueada'));
        if (livreIM) {
          const check = livreIM.querySelector('[data-im-check]');
          if (check) {
            const antesIM = contarIM();
            check.click();
            if (contarIM() > antesIM) return true;
          }
        }
        // Marcadores de aba vivem na RAIZ, nao nas abas.
        //
        // Trocar a aba de circulo do grimorio RE-RENDERIZA a secao do Iniciado
        // em Magia, e um `dataset` gravado na propria aba desaparece junto. Com
        // isso o IM nunca "esgotava", devolvia true para sempre e matava de
        // fome os blocos abaixo -- os truques principais ficavam em 1.
        const abasIM = [...raiz.querySelectorAll('[data-im-tab]')];
        const vistasIM = new Set((raiz.dataset.testeAbasIm || '').split(',').filter(Boolean));
        const ativaIM = abasIM.find((a) => a.classList.contains('active'));
        if (ativaIM) vistasIM.add(ativaIM.dataset.imTab);
        raiz.dataset.testeAbasIm = [...vistasIM].join(',');
        const proximaIM = abasIM.find((a) => !vistasIM.has(a.dataset.imTab));
        if (proximaIM) { proximaIM.click(); return true; }
      }

      // Cards de magia do criador: migraram para o vocabulario unificado
      // `.opcao-card` na Task 9 (antes `.magia-card`), com estado
      // `selecionada` e bloqueadas marcadas com `.bloqueada` (antes
      // `.magia-card-bloqueada`).
      //
      // Aqui NAO ha limite de um por grupo: o passo pede "3 truques". Escolher
      // UMA por vez e deixar o laco de fora tentar avancar e o que faz a conta
      // fechar -- o app recusa com "(N selecionados)" ate chegar no numero, e
      // o driver nao precisa saber qual e esse numero.
      // Cards de magia do criador, com troca de ABA.
      //
      // Truques e cada circulo ficam em abas separadas (`[data-tab-circ]`), e
      // so a aba ativa esta no DOM. Sem trocar de aba, o driver enchia os 3
      // truques, batia em "Maximo de 3 truques" e nunca preparava magia
      // nenhuma -- o wizard travava no passo 5.
      //
      // Estrategia: escolher na aba visivel; quando ela satura (o clique nao
      // seleciona, ou nao ha mais card livre), marcar a aba como visitada e
      // passar para a proxima. O driver nao precisa saber quantas magias cada
      // aba pede nem quantas abas existem.
      // `:not([data-mago-preparada])` e essencial: os cards da secao de
      // preparo do Mago TAMBEM sao `.opcao-card`. Sem excluir, este bloco os
      // consumia e enchia "preparadas" em vez do grimorio -- o grimorio parava
      // em 4 e o passo nunca era satisfeito.
      // Exclui os cards que pertencem a OUTRAS secoes: a de preparo do Mago
      // (`[data-mago-preparada]`) e a do talento Iniciado em Magia
      // (`[data-im-magia]`). As tres usam a mesma classe `.opcao-card`, mas
      // tem containers, abas e limites proprios -- sem separar, este bloco as
      // consumia e nenhuma das tres fechava a conta.
      const cardsMagia = [...raiz.querySelectorAll(
        '.opcao-card:not([data-mago-preparada]):not([data-im-magia])')];
      if (cardsMagia.length) {
        // Conta SO os cards desta lista. Contar `.opcao-card.selecionada`
        // global incluia as secoes de preparo e do Iniciado em Magia, que
        // re-renderizam junto -- se uma delas perdia uma selecao no mesmo
        // instante, o total nao subia e o driver concluia que o clique fora
        // recusado, trocando de aba com 1 truque escolhido de 3.
        const contarSel = () => raiz.querySelectorAll(
          '.opcao-card:not([data-mago-preparada]):not([data-im-magia]).selecionada').length;
        const livre = cardsMagia.find((c) => !c.classList.contains('selecionada')
          && !c.classList.contains('bloqueada'));
        if (livre) {
          // O handler NAO esta no card: esta num filho `[data-creator-check]`,
          // que ainda faz `stopPropagation()`.
          const check = livre.querySelector('[data-creator-check]');
          if (check) {
            const antesSel = contarSel();
            check.click();
            // O app RE-RENDERIZA a lista no clique, entao o elemento que
            // tinhamos em maos fica orfao e nunca recebe a classe
            // `selecionada` -- verificar nele daria sempre falso e o driver
            // trocaria de aba a cada escolha. Recontar no DOM e o certo.
            if (contarSel() > antesSel) return true;
            // Nao aumentou: esta aba atingiu o limite.
          }
        }
        // Mesmo motivo do IM: marcador na raiz, que sobrevive ao re-render.
        const abas = [...raiz.querySelectorAll('[data-tab-circ]')];
        const vistas = new Set((raiz.dataset.testeAbasCirc || '').split(',').filter(Boolean));
        const ativa = abas.find((a) => a.classList.contains('active'));
        if (ativa) vistas.add(ativa.dataset.tabCirc);
        raiz.dataset.testeAbasCirc = [...vistas].join(',');
        const proxima = abas.find((a) => !vistas.has(a.dataset.tabCirc));
        if (proxima) { proxima.click(); return true; }
      }

      // Magias PREPARADAS do Mago de nivel 1: secao propria
      // (`#mago-preparadas-iniciais`), fora das abas de circulo, e com o
      // handler NO PROPRIO CARD -- nao no filho `[data-creator-check]` como o
      // resto. Vem DEPOIS do fluxo de abas de proposito: a secao so oferece o
      // que ja esta no grimorio, entao o grimorio precisa encher antes.
      const preparadas = [...raiz.querySelectorAll('[data-mago-preparada]')]
        .filter((c) => !c.classList.contains('selecionada'));
      if (preparadas.length) {
        const contarPrep = () =>
          raiz.querySelectorAll('[data-mago-preparada].selecionada').length;
        const antesPrep = contarPrep();
        preparadas[0].click();
        // A secao tambem re-renderiza, entao a contagem vale mais que a
        // referencia guardada.
        if (contarPrep() > antesPrep) return true;
      }

      return false;
    });
    if (!marcou) return false;
    await page.waitForTimeout(200);
  }
  return false;
}

/**
 * Cria um personagem no localStorage usando a FABRICA DO PROPRIO APP.
 *
 * `store.js` e byte a byte identico nos dois sites, entao o mesmo `campos`
 * produz o mesmo personagem dos dois lados -- o que torna a comparacao da
 * ficha honesta. O id e forcado para o mesmo valor nos dois, senao a
 * navegacao para #ficha/<id> divergiria.
 *
 * @param {import('@playwright/test').Page} page
 * @param {object} campos - sobrescreve o que a fabrica devolve.
 * @param {string} id - id fixo, igual nos dois lados.
 */
export async function semearPersonagem(page, campos, id) {
  return page.evaluate(async ({ campos, id }) => {
    const store = await import(new URL('./js/store.js', location.href).href);
    const p = store.criarPersonagemVazio();
    Object.assign(p, campos, { id });
    store.salvarPersonagem(p);
    return p.id;
  }, { campos, id });
}

/** Semeia o MESMO personagem nos dois lados e abre a ficha dele. */
export async function abrirFichaSemeada(lados, campos, id = 'teste-fixo-1') {
  for (const l of lados) {
    await l.page.goto(l.base, { waitUntil: 'domcontentloaded' });
    await semearPersonagem(l.page, campos, id);
  }
  await irPara(lados, '#ficha/' + id);
}

/**
 * Instantaneo da ficha inteira, incluindo o header (nome do personagem) --
 * na ficha o header muda, ao contrario do criador.
 */
export async function instantaneoFicha(page) {
  return page.evaluate(() => {
    // O selo de versao aparece em DUAS formas diferentes no snapshot, e cada
    // uma precisa da sua propria regra de normalizacao:
    //  - no header-titulo ele entra como TEXTO PURO (textContent), porque o
    //    span da versao e filho do proprio titulo e o textContent achata tudo;
    //  - em qualquer outro lugar que apareca o innerHTML do span (classe
    //    "header-versao"), ele entra como HTML, com a tag </span> logo apos
    //    o numero.
    // Se a normalizacao textual fosse aplicada ao snapshot inteiro (header +
    // corpo da ficha), um "v" seguido de digitos dentro de conteudo legitimo
    // da ficha tambem seria apagado, cegando a suite para divergencias reais.
    // Por isso ela e aplicada SO na string do header, ancorada no fim (o selo
    // e sempre o ultimo texto do titulo), antes de juntar com o innerHTML do
    // conteudo -- que continua normalizado pela regra de HTML existente.
    const headerTexto = (document.getElementById('header-titulo')?.textContent || '')
      .replace(/\sv[\d.]+$/, ' v<VER>');
    const partes = [
      headerTexto,
      document.getElementById('app-content')?.innerHTML || '',
    ];
    return partes.join('\n---\n')
      .replace(/\b[0-9a-f]{8,}\b/gi, '<ID>')
      .replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z?/g, '<DATA>')
      .replace(/\d{2}\/\d{2}\/\d{4}/g, '<DATA>')
      .replace(/v[\d.]+<\/span>/g, 'v<VER></span>')
      .replace(/\s+/g, ' ')
      .trim();
  });
}

/**
 * Compara os dois lados e devolve um trecho legivel da primeira divergencia,
 * em vez de despejar dois blobs de 200 KB no relatorio.
 */
export function primeiraDivergencia(a, b, contexto = 120) {
  if (a === b) return null;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  const ini = Math.max(0, i - contexto);
  return [
    `divergencia na posicao ${i} (original ${a.length} chars, refatorado ${b.length})`,
    'original ..: ...' + a.slice(ini, i + contexto),
    'refatorado : ...' + b.slice(ini, i + contexto),
  ].join('\n');
}

/** Junta os erros de console dos dois lados num relatorio legivel. */
export function relatorioErros(lados) {
  return lados
    .filter((l) => l.erros.length)
    .map((l) => `${l.nome}:\n  ` + l.erros.join('\n  '))
    .join('\n');
}
