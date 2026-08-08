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
      for (const card of modal.querySelectorAll('.selection-card')) {
        if (!card.classList.contains('selected')) { card.click(); return true; }
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
 * 3. VOCABULARIO -- a subclasse usa `.levelup-subclasse-card`/`selecionada`,
 *    e nao `.selection-card`/`selected` como o resto do app;
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
        const b = [...(corpo?.querySelectorAll('button') ?? [])]
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
    // substituto ou desmarque a troca").
    const abriu = await page.evaluate(() => {
      const corpo = document.getElementById('modal-corpo');
      const botoes = [...(corpo?.querySelectorAll('button') ?? [])]
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

      const CARDS = [
        ['.selection-card', 'selected'],
        ['.levelup-subclasse-card', 'selecionada'],
      ];
      for (const [seletor, marcado] of CARDS) {
        const cards = [...corpo.querySelectorAll(seletor)];
        if (!cards.length) continue;
        const marcados = cards.filter((c) => c.classList.contains(marcado)).length;
        // Uma escolha sempre; mais so enquanto o app disser que falta.
        if (marcados === 0 || faltaAlgo) {
          const livre = cards.find((c) => !c.classList.contains(marcado));
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
              && !c.classList.contains('magia-card-bloqueada'));
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
      for (const inp of raiz.querySelectorAll('input[type="text"]')) {
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
      const porPai = new Map();
      for (const card of raiz.querySelectorAll('.selection-card')) {
        const pai = card.parentElement;
        if (!porPai.has(pai)) porPai.set(pai, []);
        porPai.get(pai).push(card);
      }
      for (const cards of porPai.values()) {
        if (cards.some((c) => c.classList.contains('selected'))) continue;
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
          && !c.classList.contains('magia-card-bloqueada'));
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

      // Cards de magia do criador: terceiro vocabulario (`.magia-card` com
      // estado `selecionada`, bloqueadas marcadas com `.magia-card-bloqueada`).
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
      // preparo do Mago TAMBEM sao `.magia-card`. Sem excluir, este bloco os
      // consumia e enchia "preparadas" em vez do grimorio -- o grimorio parava
      // em 4 e o passo nunca era satisfeito.
      // Exclui os cards que pertencem a OUTRAS secoes: a de preparo do Mago
      // (`[data-mago-preparada]`) e a do talento Iniciado em Magia
      // (`[data-im-magia]`). As tres usam a mesma classe `.magia-card`, mas
      // tem containers, abas e limites proprios -- sem separar, este bloco as
      // consumia e nenhuma das tres fechava a conta.
      const cardsMagia = [...raiz.querySelectorAll(
        '.magia-card:not([data-mago-preparada]):not([data-im-magia])')];
      if (cardsMagia.length) {
        // Conta SO os cards desta lista. Contar `.magia-card.selecionada`
        // global incluia as secoes de preparo e do Iniciado em Magia, que
        // re-renderizam junto -- se uma delas perdia uma selecao no mesmo
        // instante, o total nao subia e o driver concluia que o clique fora
        // recusado, trocando de aba com 1 truque escolhido de 3.
        const contarSel = () => raiz.querySelectorAll(
          '.magia-card:not([data-mago-preparada]):not([data-im-magia]).selecionada').length;
        const livre = cardsMagia.find((c) => !c.classList.contains('selecionada')
          && !c.classList.contains('magia-card-bloqueada'));
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
