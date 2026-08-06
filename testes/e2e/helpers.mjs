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
 * Resolve o modal aberto: preenche a tela atual e so entao avanca.
 *
 * Este helper errou de tres formas diferentes antes de chegar aqui, e cada
 * erro tem uma licao propria:
 *
 * 1. "avancar primeiro, escolher se recusar" -- atravessava a tela de
 *    subclasse sem escolher, e a subida parava no nivel 2;
 * 2. "avancar e seguir se a tela mudar" -- mesma falha: na subclasse o botao
 *    AVANCA para a revisao sem exigir a escolha, entao "a tela mudou" nao
 *    prova progresso;
 * 3. "esgotar TODAS as escolhas" -- marcava todas as caixas de um grupo, e o
 *    Mago travava porque o talento Academico exige EXATAMENTE 1 pericia
 *    (`selecionadas.length !== 1` em levelup.js:1182).
 *
 * O que funciona: esgotar as escolhas de opcao UNICA (cards, selects, radios
 * -- onde escolher a segunda desfaz a primeira) e marcar NO MAXIMO UMA
 * caixa por tela, porque checkbox e a unica categoria com limite de
 * quantidade. So depois disso, avancar.
 */
export async function resolverModalAberto(page, maxTelas = 16) {
  for (let i = 0; i < maxTelas; i++) {
    if (!await page.locator('#modal-overlay').isVisible()) return true;

    // 1. Escolhas de opcao unica: pode esgotar sem risco.
    for (let j = 0; j < 20; j++) {
      const escolheu = await page.evaluate(() => {
        const corpo = document.getElementById('modal-corpo');
        if (!corpo) return false;
        // Dois vocabularios de card convivem: `.selection-card`/`selected`
        // (criador e modais da ficha) e `.levelup-subclasse-card`/
        // `selecionada` (subida de nivel).
        const CARDS = [
          ['.selection-card', 'selected'],
          ['.levelup-subclasse-card', 'selecionada'],
        ];
        // UM card por tela, nao todos: nem todo grupo de cards e de escolha
        // unica. O talento Academico do Mago usa cards e exige EXATAMENTE 1;
        // esgotar marcava todos e a validacao recusava.
        for (const [seletor, marcado] of CARDS) {
          const cards = [...corpo.querySelectorAll(seletor)];
          if (cards.some((c) => c.classList.contains(marcado))) continue;
          const livre = cards[0];
          if (livre) { livre.click(); return true; }
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
        return false;
      });
      if (!escolheu) break;
      await page.waitForTimeout(160);
    }

    // 2. Checkbox: no MAXIMO uma por tela.
    await page.evaluate(() => {
      const corpo = document.getElementById('modal-corpo');
      if (!corpo) return;
      const caixas = [...corpo.querySelectorAll('input[type="checkbox"]')];
      if (caixas.some((c) => c.checked)) return;
      const livre = caixas.find((c) => !c.disabled);
      if (livre) livre.click();
    });
    await page.waitForTimeout(160);

    // 3. Avancar.
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
      for (const card of raiz.querySelectorAll('.selection-card')) {
        if (!card.classList.contains('selected')) { card.click(); return true; }
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
