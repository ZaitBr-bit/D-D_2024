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
export async function resolverModalAberto(page, maxTelas = 20) {
  for (let i = 0; i < maxTelas; i++) {
    if (!await page.locator('#modal-overlay').isVisible()) return true;

    await preencherTela(page);

    // Sub-selecoes atras de botao no corpo: abrir, preencher e confirmar.
    const abriu = await page.evaluate(() => {
      const corpo = document.getElementById('modal-corpo');
      const b = [...(corpo?.querySelectorAll('button') ?? [])]
        .find((x) => !x.disabled && !x.dataset.resolvido);
      if (b) { b.dataset.resolvido = '1'; b.click(); return true; }
      return false;
    });
    if (abriu) {
      await page.waitForTimeout(500);
      await preencherTela(page);
      await page.evaluate(() => {
        const overlays = document.querySelectorAll('.modal-overlay');
        const topo = overlays[overlays.length - 1];
        topo?.querySelector('.btn-primary:not([disabled]), .btn-success:not([disabled])')?.click();
      });
      await page.waitForTimeout(500);
      continue;  // volta a tela principal, que pode ter mais botoes
    }

    const avancou = await page.evaluate(() => {
      const acoes = document.getElementById('modal-acoes');
      const b = acoes?.querySelector(
        '.btn-primary:not([disabled]), .btn-success:not([disabled]), .btn-accent:not([disabled])');
      if (b) { b.click(); return true; }
      return false;
    });
    await page.waitForTimeout(400);
    if (!avancou) break;
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

      const selects = [...corpo.querySelectorAll('select')];
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
          .find((n) => n.startsWith('data-')) || '(sem-grupo)';
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
export async function satisfazerPasso(page, { maxVoltas = 24 } = {}) {
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

      // Cards de magia do criador: terceiro vocabulario (`.magia-card` com
      // estado `selecionada`, bloqueadas marcadas com `.magia-card-bloqueada`).
      //
      // Aqui NAO ha limite de um por grupo: o passo pede "3 truques". Escolher
      // UMA por vez e deixar o laco de fora tentar avancar e o que faz a conta
      // fechar -- o app recusa com "(N selecionados)" ate chegar no numero, e
      // o driver nao precisa saber qual e esse numero.
      // Cards de magia: distribuir entre os grupos, e detectar saturacao.
      //
      // A tela tem mais de uma secao (truques e preparadas, por circulo), cada
      // uma com seu limite. Escolher sempre no mesmo grupo enche um e ignora o
      // outro -- o driver ficava em "Maximo de 3 truques" sem nunca preparar
      // magia nenhuma.
      //
      // Estrategia: clicar sempre no grupo com MENOS selecionadas. Se o clique
      // nao selecionar (o app recusou por limite), marcar o grupo como saturado
      // para nao voltar nele. O driver nao precisa saber nenhum dos limites.
      const gruposMagia = new Map();
      for (const card of raiz.querySelectorAll('.magia-card')) {
        const pai = card.parentElement;
        if (pai.dataset.testeSaturado) continue;
        if (!gruposMagia.has(pai)) gruposMagia.set(pai, []);
        gruposMagia.get(pai).push(card);
      }
      const ordenados = [...gruposMagia.entries()].sort((a, b) => {
        const sel = (cs) => cs.filter((c) => c.classList.contains('selecionada')).length;
        return sel(a[1]) - sel(b[1]);
      });
      for (const [pai, cards] of ordenados) {
        const livre = cards.find((c) => !c.classList.contains('selecionada')
          && !c.classList.contains('magia-card-bloqueada'));
        if (!livre) continue;
        // O handler NAO esta no card: esta num filho `[data-creator-check]`,
        // que ainda faz `stopPropagation()`.
        const check = livre.querySelector('[data-creator-check]');
        if (!check) continue;
        check.click();
        if (!livre.classList.contains('selecionada')) pai.dataset.testeSaturado = '1';
        return true;
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
    const partes = [
      document.getElementById('header-titulo')?.textContent || '',
      document.getElementById('app-content')?.innerHTML || '',
    ];
    return partes.join('\n---\n')
      .replace(/\b[0-9a-f]{8,}\b/gi, '<ID>')
      .replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z?/g, '<DATA>')
      .replace(/\d{2}\/\d{2}\/\d{4}/g, '<DATA>')
      .replace(/v\d+<\/span>/g, 'v<VER></span>')
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
