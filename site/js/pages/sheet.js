// ============================================================
// Página `ficha`: o COMPOSITION ROOT PÚBLICO da ficha de personagem.
//
// Task 33 — CUTOVER. Este arquivo era o monólito de ~18k linhas (markup por
// template string, regra de jogo lida de nome traduzido, dez variáveis de
// módulo como estado compartilhado entre TODAS as fichas abertas). O fluxo
// inteiro vive agora em `features/sheet/**` (sessão, controller, as sete seções
// reais, impressão e PDF) sobre o domínio migrado nas Tasks 12-23; o que resta
// aqui é EXCLUSIVAMENTE a fiação de produção:
//
//   - o catálogo oficial e a porta de invocação de handlers oficiais, ativados
//     pelo composition root da aplicação (`app-context.js`);
//   - o registro com as SETE seções REAIS (`createDefaultSectionRegistry`);
//   - o produtor de `context.spellcasting` (`createSpellcastingTableProducer`)
//     — sem ele TODO conjurador veria os espaços de magia como desconhecidos e
//     `cast-spell` recusaria;
//   - as portas de efeito: repositório canônico + protocolo durável + fila de
//     sincronização (as MESMAS instâncias que o resto do app usa),
//     preferências, modal e toast do shell;
//   - os dois controles de saída (PDF e impressão) no `#header-acoes`.
//
// ## Recusar é obrigatório; degradar não é opção
//
// Toda porta que faltar interrompe a montagem com um erro NOMEADO, visível na
// tela e no toast. Uma ficha que abre sem repositório "funciona" até o jogador
// aplicar dano e perder tudo; uma ficha que abre com um registro de seções
// incompleto esconde metade do personagem sem dizer por quê. Nenhum caminho
// daqui cai em placeholder, em catálogo vazio ou em salvar-para-lugar-nenhum —
// a regra é verificada estaticamente por
// `tests/unit/architecture/sheet-composition-root.test.js`.
//
// ## O que este arquivo NÃO pode ter (e o teste estático confere)
//
// Markup (`innerHTML`, template de HTML), regra de jogo (comparação de classe
// ou espécie por nome, cálculo de derivado, tabela de progressão), parser de
// prosa, comparação de conteúdo e estado de módulo mutável. Se algum deles
// voltar a aparecer aqui, o cutover foi desfeito na prática.
//
// ## Dívida DECLARADA que o cutover torna pública
//
// Três capacidades do monólito não têm comando canônico e, por isso, RECUSAM
// com erro nomeado em vez de fingir que funcionaram (nunca um no-op silencioso):
// preparar/despreparar magia e editar grimório/metamagia; vantagem e
// desvantagem; e a edição de identidade/imagem (`ALLOWED_EDIT_PATHS` só tem
// `hp.maximum`). Registrado em `questions-for-review.txt` itens 17/19/20.
// ============================================================
import { ok, err } from '../core/result.js';
import { createAppError } from '../core/errors.js';
import { appContext } from '../app-context.js';
import { obterRepositorioDePersonagens, preferences } from '../store.js';
import { portaDeMutacaoDuravel, portaDeFilaDaFicha } from '../sync.js';
import { obterServicoDeModal, toast } from '../utils.js';
import { renderFailureNotice } from '../ui/failure-notice.js';
import { createDurableCharacterMutation } from '../infra/sync/durable-character-mutation.js';
import { resolveCanonicalMaximumHitPoints } from '../infra/character/legacy-query-adapter.js';
import { createSheetSession } from '../features/sheet/sheet-session.js';
import { mountSheet } from '../features/sheet/sheet-controller.js';
import { createDefaultSectionRegistry } from '../features/sheet/sections/index.js';
import { createSpellcastingTableProducer } from '../features/sheet/spellcasting-table.js';
import { mountSheetOutputActions } from '../features/sheet/sheet-output-actions.js';

/**
 * Mostra a recusa na tela e no toast, e devolve `err(AppError)` — o Result
 * que `renderSheet` entrega ao router (Task 34) quando a montagem não pode
 * prosseguir. O router NÃO chama `renderError` de novo neste caso: o aviso
 * já está na tela.
 * @param {object} container - contêiner da rota.
 * @param {string} code - código do `AppError` que motivou a recusa.
 * @param {string} message - explicação para o jogador.
 * @returns {{ok: false, error: object}}
 */
function recusar(container, code, message) {
  console.error('pages/sheet: ' + code + ' — ' + message);
  renderFailureNotice(container, { title: 'Não foi possível abrir a ficha', message, code });
  toast(message, 'error');
  return err(createAppError({ code, scope: 'pages/sheet', message }));
}

/**
 * Monta a ficha de `charId` em `container`.
 *
 * A assinatura é a MESMA que o router (`site/js/core/hash-router.js`, Task
 * 34) sempre chamou. O retorno é um `Result<() => void, AppError>`: em
 * sucesso, `value` é o DISPOSER de `mountSheet` (função idempotente que
 * remove os listeners delegados, fecha os modais abertos pela ficha,
 * descarta a sessão e retira os controles de saída do cabeçalho); em falha,
 * `error` é o `AppError` que motivou a recusa (o aviso na tela já foi
 * desenhado por `recusar()` — o router não precisa desenhar de novo).
 *
 * @param {object} container - `#app-content`.
 * @param {string} charId - id do personagem.
 * @returns {Promise<{ok: true, value: () => void} | {ok: false, error: object}>}
 */
export async function renderSheet(container, charId) {
  if (!container || typeof container.addEventListener !== 'function') {
    throw new TypeError('renderSheet: "container" deve ser um nó DOM.');
  }
  if (typeof charId !== 'string' || charId.length === 0) {
    return recusar(container, 'SHEET_CHARACTER_ID_MISSING', 'A rota não indicou qual personagem abrir.');
  }

  // --- Catálogo oficial ----------------------------------------------------
  const conteudo = await appContext.initializeContent();
  if (conteudo.ok !== true) {
    return recusar(container, conteudo.error.code, 'O catálogo de conteúdo oficial não pôde ser carregado.');
  }
  const registry = conteudo.value;

  // --- Registro das SETE seções REAIS --------------------------------------
  const sectionRegistry = createDefaultSectionRegistry();
  if (sectionRegistry.ok !== true) {
    return recusar(container, sectionRegistry.error.code, 'A ficha não pôde montar as sete seções.');
  }

  // --- Persistência: as MESMAS instâncias do resto do app -------------------
  const repository = obterRepositorioDePersonagens();
  if (repository === null) {
    return recusar(
      container,
      'SHEET_REPOSITORY_UNAVAILABLE',
      'O armazenamento de personagens ainda não foi inicializado; nada seria salvo.',
    );
  }

  // O protocolo durável da ficha opera sobre o personagem CANÔNICO (o de
  // `store.js` opera sobre o registro plano legado da fachada). São dois
  // adaptadores SEM ESTADO sobre o MESMO repositório e a MESMA fila — não duas
  // filas nem dois repositórios.
  const durableMutation = createDurableCharacterMutation({ repository, syncQueue: portaDeMutacaoDuravel });

  const session = createSheetSession({
    characterId: charId,
    registry,
    officialHandlerInvoker: appContext.getOfficialHandlerInvoker(),
    spellcastingTable: createSpellcastingTableProducer({ registry }),
    maximumHitPoints: resolveCanonicalMaximumHitPoints,
    repository,
    durableMutation,
    syncQueue: portaDeFilaDaFicha,
    preferences,
  });

  const mounted = await mountSheet({
    container,
    session,
    sectionRegistry: sectionRegistry.value,
    modal: obterServicoDeModal(),
    notifier: {
      /**
       * @param {object} problema - `AppError` ou payload do controller.
       * @returns {void}
       */
      error: (problema) => toast(problema?.message ?? 'Não foi possível concluir a ação.', 'error'),
      /**
       * @param {object} aviso - payload de sincronização pendente.
       * @returns {void}
       */
      warn: (aviso) => toast(aviso?.message ?? '', 'warning'),
    },
  });

  if (mounted.ok !== true) {
    session.dispose();
    return recusar(container, mounted.error.code, 'A ficha não pôde ser montada.');
  }
  const descartarFicha = mounted.value;

  // --- Cabeçalho: título e controles de saída -------------------------------
  //
  // O título vem do ViewModel JÁ PROJETADO — não de uma segunda leitura do
  // registro, que é como o monólito conseguia mostrar um nome na tela e outro
  // no PDF.
  window.definirTituloHeader?.(session.getSnapshot().viewModel?.data?.identity?.name ?? 'Ficha');

  const host = document.getElementById('header-acoes');
  const acoes =
    host === null
      ? null
      : mountSheetOutputActions({
          host,
          /**
           * Lê o ViewModel CORRENTE (nunca o do momento do mount): imprimir
           * depois de aplicar dano tem de mostrar o PV de agora.
           * @returns {object|null}
           */
          getViewModel: () => session.getSnapshot().viewModel ?? null,
          notifier: {
            /**
             * @param {string} mensagem - texto para o jogador.
             * @returns {void}
             */
            error: (mensagem) => toast(mensagem, 'error'),
          },
        });
  if (acoes !== null && acoes.ok !== true) {
    // Os controles de saída não impedem a ficha de existir; a ausência é
    // AVISADA, nunca silenciosa.
    console.error('pages/sheet: controles de saída indisponíveis — ' + acoes.error.code);
    toast('Os botões de PDF e impressão não puderam ser montados.', 'warning');
  }
  const descartarAcoes = acoes !== null && acoes.ok === true ? acoes.value : null;

  /**
   * Disposer da rota: desmonta a ficha E retira os controles do cabeçalho.
   * @returns {void}
   */
  return ok(() => {
    descartarFicha();
    if (descartarAcoes !== null) {
      descartarAcoes();
    }
  });
}
