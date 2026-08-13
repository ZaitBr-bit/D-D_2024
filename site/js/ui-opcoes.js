// ============================================================
// Card de opção: o vocabulário único de escolha do app.
//
// Substitui .selection-card, .magia-card, .levelup-subclasse-card e os
// <select> de opções de jogo. Este módulo NAO conhece talento, arma nem
// magia -- ele recebe uma lista no contrato abaixo e desenha. A tradução
// dos dados de cada domínio mora em opcoes-dominio.js.
//
// Contrato de uma opção:
//   id         obrigatório  identidade estável; é o que volta em aoMudar
//   nome       obrigatório  título do card
//   resumo     opcional     uma linha, derivada dos dados
//   detalhe    opcional     texto completo; havendo, o card ganha "ver detalhes"
//                           EXCECAO: entra em innerHTML SEM escHtml -- e a unica
//                           excecao proposital do contrato, porque os adaptadores
//                           de dominio montam HTML nesse campo (ex.: paragrafos,
//                           listas). Quem monta `detalhe` e responsavel por
//                           escapar/sanitizar qualquer texto de usuario antes de
//                           colocar ali; este modulo confia no chamador.
//   tags       opcional     rótulos curtos à direita do nome
//   grupo      opcional     cabeçalho sob o qual o card aparece
//   bloqueado  opcional     { motivo } -- tira o card da seleção
// ============================================================
import { abrirModal, escHtml, semAcento } from './utils.js';

/**
 * Guarda o handler de clique que cada elemento já tem, para poder removê-lo
 * antes de montar de novo.
 *
 * Por que existe: `montarSeletor`/`montarTroca` reescrevem `el.innerHTML` (o
 * que descarta os listeners dos FILHOS) mas registram o handler de clique no
 * PRÓPRIO `el`, que sobrevive. Montar o mesmo elemento duas vezes deixava
 * dois handlers vivos: um clique em "ver detalhes" abria DOIS popups
 * empilhados e idênticos, um clique num card marcava-desmarcava (dois
 * toggles seguidos). Só apareceu quando a lista de talentos da subida de
 * nível passou a se recolher e reabrir no mesmo elemento -- antes disso cada
 * tela remontava o container inteiro, então o elemento era sempre novo e o
 * vazamento ficava invisível. Um WeakMap não impede a coleta do elemento.
 */
const handlersDeClique = new WeakMap();

/**
 * Registra o clique do container substituindo o handler anterior, se houver.
 * Toda montagem passa por aqui -- nunca chame addEventListener direto no
 * container, ou o vazamento acima volta.
 */
function ligarClique(el, handler) {
  const anterior = handlersDeClique.get(el);
  if (anterior) el.removeEventListener('click', anterior);
  handlersDeClique.set(el, handler);
  el.addEventListener('click', handler);
}

/**
 * Abre o texto completo de uma opção num popup empilhado.
 *
 * Antes, "ver detalhes" expandia o texto DENTRO do card, empurrando o resto
 * da lista para baixo -- justamente quando o jogador está comparando opções.
 * O popup reusa `abrirModal`, que empilha um sub-modal quando já há um modal
 * aberto: é o mesmo padrão que `mostrarDetalheMagia` (creator/passo-magias.js)
 * já usava para a descrição de magia, e que o dono do produto apontou.
 *
 * `detalhe` entra sem escHtml de propósito -- é HTML por contrato, a única
 * exceção do contrato de opção (ver o cabeçalho deste arquivo). Quem monta
 * `detalhe` é responsável por sanitizar; o popup não muda essa regra.
 */
async function abrirDetalheOpcao(opcao) {
  if (!opcao?.detalhe) return;
  // `detalhe` pode ser HTML pronto OU uma função que devolve o HTML (às
  // vezes assíncrona). A segunda forma existe porque nem toda lista traz o
  // texto completo: as trocas de magia, por exemplo, são alimentadas por
  // `dados/classes/magias_<classe>.json`, que só tem nome, escola e
  // `especial` -- a descrição mora em `dados/magias/circulo_N.json` e não
  // vale carregar as 391 magias só para desenhar os cards. Carregar no
  // clique é o mesmo que `mostrarDetalheMagia` (creator/passo-magias.js)
  // já fazia.
  if (typeof opcao.detalhe !== 'function') {
    abrirModal(opcao.nome, opcao.detalhe);
    return;
  }
  abrirModal(opcao.nome, '<div class="info-box info">Carregando...</div>');

  // A referência ao corpo é capturada AGORA, não depois do await: se o
  // jogador fechar o popup enquanto carrega, resolver o seletor depois
  // acharia o `#modal-corpo` do modal de BAIXO e a escrita apagaria a lista
  // de opções inteira.
  const subs = document.querySelectorAll('.sub-modal-overlay');
  const alvo = subs.length
    ? subs[subs.length - 1].querySelector('.modal-corpo')
    : document.getElementById('modal-corpo');

  let html;
  try {
    html = await opcao.detalhe();
  } catch {
    html = '';
  }

  // Só escreve se aquele mesmo popup ainda estiver aberto. Sub-modal some do
  // DOM ao fechar; o modal principal é reusado, então ali a checagem é o
  // título ainda ser o desta opção.
  const aindaAberto = alvo && document.body.contains(alvo)
    && (subs.length || document.getElementById('modal-titulo')?.textContent === opcao.nome);
  if (aindaAberto) {
    alvo.innerHTML = html || '<div class="info-box warning">Não foi possível carregar os detalhes.</div>';
  }
}

/**
 * Desenha o HTML de um card de opção -- a peça central do vocabulário deste
 * módulo. É usada tanto por `montarSeletor` (cards clicáveis, com
 * `data-opcao`, dentro de uma lista) quanto por `montarTroca` no caso de uma
 * opção só (card de apresentação, sem `data-opcao`). Extraída para as duas
 * situações nunca desenharem o card de formas diferentes -- é exatamente a
 * divergência entre telas que este módulo existe para eliminar.
 *
 * @param {object} o opção no contrato do cabeçalho do arquivo
 * @param {object} [flags]
 * @param {boolean} [flags.sel=false] se o card aparece marcado (classe "selecionada")
 * @param {boolean} [flags.cheio=false] se o seletor atingiu o máximo (desabilita o clique)
 * @param {boolean} [flags.selecionavel=true] se falso, omite `data-opcao` --
 *   uso exclusivo do card de apresentação de `montarTroca`, que não tem
 *   listener de clique próprio e não pode virar uma escolha falsa
 */
function cardOpcaoHtml(o, { sel = false, cheio = false, selecionavel = true } = {}) {
  return `
    <div class="opcao-card ${sel ? 'selecionada' : ''} ${o.bloqueado ? 'bloqueada' : ''}"
         ${selecionavel ? `data-opcao="${escHtml(o.id)}"` : ''} ${cheio ? 'data-cheio="1"' : ''}
         style="${cheio ? 'opacity:0.5;cursor:not-allowed' : ''}">
      ${o.bloqueado ? '' : '<span class="opcao-check"></span>'}
      <div class="opcao-nome">
        <span>${escHtml(o.nome)}</span>
        ${o.tags?.length ? `<span class="opcao-tags">${escHtml(o.tags.join(' · '))}</span>` : ''}
      </div>
      ${o.bloqueado
        ? `<div class="opcao-motivo">${escHtml(o.bloqueado.motivo)}</div>`
        : (o.resumo ? `<div class="opcao-resumo">${escHtml(o.resumo)}</div>` : '')}
      ${o.detalhe && !o.bloqueado
        ? `<div class="opcao-ver" data-ver="${escHtml(o.id)}">&#8964; ver detalhes</div>`
        : ''}
    </div>`;
}

/**
 * Monta um seletor de cards dentro de `el` e liga todos os eventos.
 * Mesma forma de uso de configurarSelectsExclusivos: uma chamada faz tudo.
 *
 * @param {HTMLElement} el conteiner (será sobrescrito)
 * @param {object} cfg
 * @param {Array}  cfg.opcoes lista no contrato do cabeçalho
 * @param {'ampla'|'densa'} [cfg.densidade='densa']
 * @param {number} [cfg.max=1] quantas podem ser marcadas
 * @param {string[]} [cfg.selecionadas=[]] ids já marcados
 * @param {boolean} [cfg.busca=false] liga a caixa de busca
 * @param {string[]} [cfg.filtros=[]] rótulos de filtro de grupo
 * @param {boolean} [cfg.filtroElegiveis=false] liga o chip "só os que posso pegar"
 * @param {function} [cfg.aoMudar] recebe o array de ids selecionados
 */
export function montarSeletor(el, cfg) {
  if (!el) return;
  const opcoes = cfg.opcoes || [];
  const densidade = cfg.densidade || 'densa';
  const max = cfg.max || 1;
  const estado = {
    selecionadas: [...(cfg.selecionadas || [])].filter(
      id => opcoes.some(o => o.id === id && !o.bloqueado)),
    termo: '',
    filtrosAtivos: new Set(),
    soElegiveis: Boolean(cfg.filtroElegiveis),
    gruposRevelados: new Set(),
  };

  el.innerHTML = `
    ${cfg.busca ? '<div class="search-box"><input type="text" class="form-input opcao-busca" placeholder="Buscar..."></div>' : ''}
    ${(cfg.filtros?.length || cfg.filtroElegiveis) ? `
      <div class="opcao-filtros">
        ${cfg.filtroElegiveis ? '<span class="opcao-filtro ativo" data-filtro-elegiveis>Só os que posso pegar</span>' : ''}
        ${(cfg.filtros || []).map(f => `<span class="opcao-filtro" data-filtro="${escHtml(f)}">${escHtml(f)}</span>`).join('')}
      </div>` : ''}
    <div class="opcao-contagem"></div>
    <div class="opcao-lista"></div>
  `;

  const listaEl = el.querySelector('.opcao-lista');
  const contagemEl = el.querySelector('.opcao-contagem');

  // Aplica busca e filtros de grupo. O filtro de elegíveis NAO entra aqui:
  // as bloqueadas continuam contabilizadas e vão para a linha "revelar".
  const visiveis = () => opcoes.filter(o => {
    if (estado.filtrosAtivos.size && o.grupo && !estado.filtrosAtivos.has(o.grupo)) return false;
    if (!estado.termo) return true;
    const alvo = semAcento(`${o.nome} ${o.resumo || ''}`).toLowerCase();
    return alvo.includes(estado.termo);
  });

  // Desenha um card a partir do estado local (marcada/cheia),
  // delegando o HTML em si para a função compartilhada com montarTroca.
  //
  // BUG DA TASK 2, corrigido na revisão da Task 14: com `max: 1`, "cheio"
  // nunca pode valer -- clicar numa opção diferente da já marcada TROCA a
  // seleção (é o próprio ramo `else if (max === 1)` do handler de clique,
  // logo abaixo), nunca fica bloqueado por limite. Antes desta correção,
  // `cheio` comparava `selecionadas.length >= max` sem olhar pra `max`, e
  // com max=1 isso ficava verdadeiro pra QUALQUER card não-marcado assim
  // que um era escolhido -- as outras opções nasciam com `opacity:0.5`,
  // `cursor:not-allowed` e `data-cheio="1"` (cardOpcaoHtml), e o handler de
  // clique retornava cedo nelas (`if (!card || card.dataset.cheio)
  // return;`) sem nunca chegar no ramo que troca a seleção. Com `max`
  // maior que 1 o comportamento de limite continua o mesmo: atingido o
  // teto, as não-marcadas ficam indisponíveis até alguma ser desmarcada.
  const cardHtml = (o) => {
    const sel = estado.selecionadas.includes(o.id);
    const cheio = max > 1 && estado.selecionadas.length >= max && !sel;
    return cardOpcaoHtml(o, { sel, cheio });
  };

  // Redesenha a lista inteira: grupos, bloqueadas recolhidas e contagem.
  const desenhar = () => {
    const lista = visiveis();
    const grupos = [...new Set(lista.map(o => o.grupo || ''))];
    let html = '';
    for (const g of grupos) {
      const doGrupo = lista.filter(o => (o.grupo || '') === g);
      const livres = doGrupo.filter(o => !o.bloqueado);
      const travadas = doGrupo.filter(o => o.bloqueado);
      const revelado = estado.gruposRevelados.has(g);
      if (g) {
        html += `<div class="opcao-grupo"><span>${escHtml(g)}</span><span>${livres.length} de ${doGrupo.length}</span></div>`;
      }
      html += `<div class="opcao-grid ${densidade}">${livres.map(cardHtml).join('')}</div>`;
      if (travadas.length && estado.soElegiveis && !revelado) {
        const motivo = travadas.length === 1
          ? travadas[0].bloqueado.motivo
          : 'pré-requisito não atendido';
        html += `<div class="opcao-revelar" data-revelar="${escHtml(g)}">&#8964; ${travadas.length} indisponíve${travadas.length === 1 ? 'l' : 'is'} (${escHtml(motivo)})</div>`;
      } else if (travadas.length) {
        html += `<div class="opcao-grid ${densidade}">${travadas.map(cardHtml).join('')}</div>`;
      }
    }
    listaEl.innerHTML = html || '<div class="opcao-contagem">Nenhuma opção encontrada.</div>';
    const totalLivres = lista.filter(o => !o.bloqueado).length;
    contagemEl.textContent = max > 1
      ? `Selecionadas: ${estado.selecionadas.length}/${max} — ${totalLivres} disponíve${totalLivres === 1 ? 'l' : 'is'}`
      : `${totalLivres} disponíve${totalLivres === 1 ? 'l' : 'is'}`;
  };

  // Um clique no card marca/desmarca; no "ver detalhes", abre o popup.
  ligarClique(el, (ev) => {
    const ver = ev.target.closest('[data-ver]');
    if (ver) {
      // Popup em vez de expansao embutida: expandir empurrava a lista
      // inteira para baixo, atrapalhando quem esta comparando opcoes.
      // Nao mexe em `estado` nem chama `aoMudar` -- ler nao e escolher.
      abrirDetalheOpcao(opcoes.find(o => o.id === ver.dataset.ver));
      return;
    }
    const revelar = ev.target.closest('[data-revelar]');
    if (revelar) { estado.gruposRevelados.add(revelar.dataset.revelar); desenhar(); return; }
    const filtroEleg = ev.target.closest('[data-filtro-elegiveis]');
    if (filtroEleg) {
      estado.soElegiveis = !estado.soElegiveis;
      filtroEleg.classList.toggle('ativo', estado.soElegiveis);
      desenhar();
      return;
    }
    const filtro = ev.target.closest('[data-filtro]');
    if (filtro) {
      const g = filtro.dataset.filtro;
      if (estado.filtrosAtivos.has(g)) estado.filtrosAtivos.delete(g); else estado.filtrosAtivos.add(g);
      filtro.classList.toggle('ativo', estado.filtrosAtivos.has(g));
      desenhar();
      return;
    }
    const card = ev.target.closest('[data-opcao]');
    if (!card || card.dataset.cheio) return;
    const id = card.dataset.opcao;
    // Garantia independente do CSS: mesmo que o hit-test de .bloqueada mude ou
    // o clique venha de fora do ponteiro (elemento.click() programatico, ativacao
    // via arvore de acessibilidade), uma opcao bloqueada nunca entra em selecionadas.
    const opcao = opcoes.find(o => o.id === id);
    if (!opcao || opcao.bloqueado) return;
    if (estado.selecionadas.includes(id)) {
      estado.selecionadas = estado.selecionadas.filter(x => x !== id);
    } else if (max === 1) {
      estado.selecionadas = [id];
    } else if (estado.selecionadas.length < max) {
      estado.selecionadas.push(id);
    }
    desenhar();
    cfg.aoMudar?.([...estado.selecionadas]);
  });

  el.querySelector('.opcao-busca')?.addEventListener('input', (ev) => {
    estado.termo = semAcento(ev.target.value || '').toLowerCase();
    desenhar();
  });

  desenhar();
  cfg.aoMudar?.([...estado.selecionadas]);
}

/**
 * Monta uma troca em dois passos: primeiro o que sai, depois o que entra.
 *
 * Quando `sai.opcoes` tem um item só -- o caso do Estilo de Luta, onde o
 * personagem tem exatamente um -- o passo 1 não vira escolha falsa: mostra o
 * card atual como apresentação (clicar nele não faz nada -- não é um
 * `montarSeletor`, então não marca nem abre o passo 2) e um botão
 * "trocar este", que é a única decisão real ali.
 *
 * RESTAURAÇÃO DE ESTADO -- achado do revisor, Task 12 Rodada 2 (Critical):
 * `montarTroca` é reconstruído do zero toda vez que a tela que o hospeda é
 * re-renderizada -- no assistente de subida de nível isso acontece ao
 * clicar "Anterior" e depois "Próximo" de volta ao mesmo passo, ou ao clicar
 * num passo anterior da barra de progresso, os dois fluxos normais de
 * navegação, não um caso extremo. Sem `cfg.sai.selecionado`/
 * `cfg.entra.selecionado`, o passo 1 sempre nasce sem nada marcado; quando
 * ele tem MAIS de uma opção, isso é entregue a `montarSeletor` como
 * `selecionadas: []` -- e `montarSeletor` dispara `aoMudar` JÁ NA MONTAGEM
 * (mesma garantia que todo consumidor dele já depende, para saber o estado
 * inicial). Esse primeiro disparo, com array vazio, zerava em silêncio a
 * troca que o jogador já tinha escolhido e visto confirmada na tela.
 * Reproduzido ao vivo: Bardo subindo de nível, escolhe Comando -> Compreender
 * Idiomas, volta um passo, avança de novo sem re-selecionar, confirma --
 * "Comando" nunca saía. O caso `umSo` (Estilo de Luta) escapava disso porque
 * o card de apresentação não dispara `aoMudar` -- mas só porque ninguém
 * ainda precisava restaurar nada nele; ganha a mesma restauração aqui, pela
 * simetria dos dois lados que este comentário descreve.
 *
 * `cfg.sai.selecionado`/`cfg.entra.selecionado` são ids (o mesmo formato
 * que `aoMudar` devolve), não arrays -- o chamador devolve o que já estava
 * em `state`. Os dois são validados contra a lista de opções ATUAL antes de
 * usar (uma opção que sumiu -- por exemplo, ficou bloqueada -- não
 * reaparece marcada). A restauração só vale para a MONTAGEM inicial: clicar
 * "alterar" (ou "Trocar este" de novo) sempre começa do zero, sem
 * reaproveitar o valor restaurado -- é o jogador pedindo para escolher de
 * novo, não a tela sendo redesenhada por baixo dele.
 *
 * LIMITE: isto assume que toda troca montada aqui é OPCIONAL -- o jogador
 * sempre pode não marcar nada e seguir em frente, e é por isso que
 * `testes/e2e/helpers.mjs` pode excluir o componente inteiro (os dois
 * passos) das varreduras automáticas sem nunca travar uma escolha
 * obrigatória (ver os comentários lá). Se algum dia uma escolha OBRIGATÓRIA
 * passar a usar `montarTroca`, quem fizer isso precisa revisar as duas
 * guardas.
 *
 * @param {HTMLElement} el conteiner (será sobrescrito)
 * @param {object} cfg
 * @param {object} cfg.sai   { opcoes, rotulo, selecionado }
 * @param {object} cfg.entra { opcoes, rotulo, busca, filtros, densidade, selecionado }
 * @param {function} cfg.aoMudar recebe { sai, entra } com os ids escolhidos
 */
export function montarTroca(el, cfg) {
  if (!el) return;
  const umSo = (cfg.sai.opcoes || []).length === 1;
  const estado = { sai: null, entra: null };
  // A opção única do passo 1 (caso umSo), guardada para o listener de `el`
  // saber qual detalhe abrir no popup do "ver detalhes".
  let opcaoUnica = null;

  // Valores a restaurar na montagem (ver comentário do cabeçalho da
  // função). Calculados uma vez só, fora de `desenharSai`/`abrirEntra`,
  // porque só a chamada inicial (fim da função) deve usá-los -- "alterar"
  // chama `desenharSai()` sem argumento de propósito.
  const saiRestaurar = cfg.sai.selecionado != null &&
    cfg.sai.opcoes.some(o => o.id === cfg.sai.selecionado && !o.bloqueado)
    ? cfg.sai.selecionado : null;
  const entraRestaurar = cfg.entra.selecionado != null &&
    cfg.entra.opcoes.some(o => o.id === cfg.entra.selecionado && !o.bloqueado)
    ? cfg.entra.selecionado : null;

  el.innerHTML = `
    <div class="opcao-passo" id="troca-passo-sai"></div>
    <div class="opcao-passo" id="troca-passo-entra" style="display:none"></div>
  `;
  const saiEl = el.querySelector('#troca-passo-sai');
  const entraEl = el.querySelector('#troca-passo-entra');

  // Abre o passo 2 e recolhe o passo 1 numa linha com "alterar".
  // `entraInicial`: só a restauração da montagem inicial passa algo aqui
  // (ver comentário do cabeçalho) -- toda abertura disparada por uma
  // interação do jogador (clicar num card do passo 1, "Trocar este") não
  // passa nada, e o passo 2 nasce sem nada marcado, como sempre nasceu.
  const abrirEntra = (entraInicial) => {
    const escolhido = cfg.sai.opcoes.find(o => o.id === estado.sai);
    saiEl.classList.add('resolvido');
    saiEl.innerHTML = `
      <span class="opcao-passo-num">1</span><strong>${escHtml(cfg.sai.rotulo)}</strong>
      <strong style="color:var(--primary);margin-left:6px">${escHtml(escolhido?.nome || '')}</strong>
      <span class="opcao-passo-alterar" data-troca-alterar>alterar</span>
    `;
    entraEl.style.display = '';
    entraEl.innerHTML = `
      <div><span class="opcao-passo-num">2</span><strong>${escHtml(cfg.entra.rotulo)}</strong></div>
      <div id="troca-entra-lista" style="margin-top:6px"></div>
    `;
    montarSeletor(entraEl.querySelector('#troca-entra-lista'), {
      opcoes: cfg.entra.opcoes.filter(o => o.id !== estado.sai),
      densidade: cfg.entra.densidade || 'densa',
      max: 1,
      busca: cfg.entra.busca,
      filtros: cfg.entra.filtros,
      selecionadas: entraInicial ? [entraInicial] : [],
      aoMudar: (sel) => { estado.entra = sel[0] || null; cfg.aoMudar?.({ ...estado }); },
    });
  };

  // Desenha o passo 1 do zero (também usado pelo "alterar").
  // `saiInicial`: idem `entraInicial` de `abrirEntra` -- só a chamada de
  // restauração no fim da função passa algo.
  const desenharSai = (saiInicial) => {
    saiEl.classList.remove('resolvido');
    entraEl.style.display = 'none';
    estado.entra = null;
    opcaoUnica = null;
    saiEl.innerHTML = `
      <div><span class="opcao-passo-num">1</span><strong>${escHtml(cfg.sai.rotulo)}</strong></div>
      <div id="troca-sai-lista" style="margin-top:6px"></div>
      ${umSo ? '<button type="button" class="btn btn-sm btn-outline" data-troca-um style="margin-top:6px">Trocar este</button>' : ''}
    `;
    if (umSo) {
      // Um item só: NAO usar montarSeletor aqui -- ele é um componente
      // interativo por natureza (clique marca .selecionada e desenha o
      // circulo de check antes mesmo de checar quem chama aoMudar). Como
      // não há nada de fato para marcar/desmarcar nesse caso, o card usa a
      // mesma função de desenho de montarSeletor (cardOpcaoHtml) -- para
      // nunca divergir visualmente dela -- mas com `selecionavel: false`,
      // que omite `data-opcao`, e sem nenhum listener de clique próprio: um
      // clique no corpo do card sobe até o listener de `el` abaixo, que só
      // reage a `data-troca-alterar`/`data-troca-um`/`data-ver` -- ou seja,
      // clicar no card não marca nem abre o passo 2. O único link vivo
      // dentro dele é "ver detalhes" (apresentação, não seleção), que abre
      // o popup pelo mesmo listener. Quem avança de fato é
      // sempre o botão "Trocar este" desenhado acima -- ou, se `saiInicial`
      // já bate com a única opção (restauração da montagem inicial), o
      // código logo abaixo, que pula direto para o passo 2 sem exigir o
      // clique de novo.
      const unica = cfg.sai.opcoes[0];
      opcaoUnica = unica;
      saiEl.querySelector('#troca-sai-lista').innerHTML =
        `<div class="opcao-grid densa">${cardOpcaoHtml(unica, { sel: true, selecionavel: false })}</div>`;
      if (saiInicial === unica.id) {
        estado.sai = unica.id;
        abrirEntra(entraRestaurar);
      }
      return;
    }
    // `primeiraEscolha`: distingue o disparo AUTOMÁTICO de `montarSeletor`
    // na montagem (quando `saiInicial` é passado, esse primeiro disparo
    // devolve exatamente `[saiInicial]`) de um clique de verdade do
    // jogador depois. Só no primeiro caso o passo 2 herda
    // `entraRestaurar` -- qualquer clique genuíno troca (ou desmarca) o
    // "sai" e o passo 2 tem que nascer vazio, do jeito que sempre nasceu.
    let primeiraEscolha = true;
    montarSeletor(saiEl.querySelector('#troca-sai-lista'), {
      opcoes: cfg.sai.opcoes,
      densidade: 'densa',
      max: 1,
      selecionadas: saiInicial ? [saiInicial] : [],
      aoMudar: (sel) => {
        const novoSai = sel[0] || null;
        const restaurando = primeiraEscolha && novoSai != null && novoSai === saiInicial;
        primeiraEscolha = false;
        estado.sai = novoSai;
        cfg.aoMudar?.({ ...estado });
        if (estado.sai) abrirEntra(restaurando ? entraRestaurar : undefined);
      },
    });
  };

  ligarClique(el, (ev) => {
    if (ev.target.closest('[data-troca-alterar]')) { estado.sai = null; desenharSai(); cfg.aoMudar?.({ ...estado }); return; }
    if (ev.target.closest('[data-troca-um]')) {
      estado.sai = cfg.sai.opcoes[0].id;
      cfg.aoMudar?.({ ...estado });
      abrirEntra();
      return;
    }
    // "Ver detalhes" do card de apresentação do caso umSo. Ler é
    // apresentação, não seleção: abre o popup e não mexe em `estado` nem
    // chama `cfg.aoMudar`. O passo 2 tem o seu próprio montarSeletor, que
    // trata o "ver detalhes" dos cards dele.
    if (opcaoUnica && ev.target.closest('[data-ver]')) {
      abrirDetalheOpcao(opcaoUnica);
    }
  });

  desenharSai(saiRestaurar);
}
