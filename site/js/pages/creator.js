// ============================================================
// Página `criar`: o COMPOSITION ROOT PÚBLICO do criador de personagem.
//
// Task 28b — CUTOVER. Este arquivo era o monólito de ~4.5k linhas do wizard
// legado (markup por template string, regra de jogo por comparação de nome,
// quatro variáveis de módulo como estado). O fluxo inteiro vive agora em
// `features/creator/**` (sessão, controller, os sete passos reais) sobre o
// domínio migrado nas Tasks 15-23; o que resta aqui é EXCLUSIVAMENTE a
// fiação de produção:
//
//   - o catálogo oficial, ativado pelo composition root da aplicação
//     (`app-context.js`);
//   - o registro com os SETE passos REAIS (`createDefaultStepRegistry`);
//   - as portas de efeito: repositório + fila de sincronização (as MESMAS
//     instâncias que o resto do app usa), modal e toast do shell, RNG de
//     produção, processamento de imagem e navegação.
//
// ## Recusar é obrigatório; degradar não é opção
//
// Toda porta que faltar interrompe a montagem com um erro NOMEADO, visível na
// tela e no toast. Um criador que abre sem repositório "funciona" até o
// jogador clicar em Finalizar e perder tudo; um criador que abre com um
// registro incompleto deixa o jogador criar um personagem quebrado e só
// descobrir na ficha. Nenhum caminho daqui cai em placeholder, em catálogo
// vazio ou em salvar-para-lugar-nenhum — a regra é verificada estaticamente
// por `tests/unit/architecture/creator-composition-root.test.js`.
//
// ## O que este arquivo NÃO pode ter (e o teste estático confere)
//
// Markup (`innerHTML`, template de HTML), regra de jogo (comparação de classe
// ou espécie por nome, cálculo de derivado) e estado de módulo mutável. Se
// algum deles voltar a aparecer aqui, o cutover foi desfeito na prática.
// ============================================================
import { ok, err } from '../core/result.js';
import { createAppError } from '../core/errors.js';
import { appContext } from '../app-context.js';
import { obterRepositorioDePersonagens } from '../store.js';
import { portaDeMutacaoDuravel } from '../sync.js';
import { gerarId, obterServicoDeModal, processarImagemArquivo, toast } from '../utils.js';
import { renderFailureNotice } from '../ui/failure-notice.js';
import { createCryptoRng } from '../infra/random/crypto-rng.js';
import { createCharacterImageProcessor } from '../infra/image/character-image-processor.js';
import { createEmptyCharacter } from '../domain/character/model.js';
import { createCreatorSession } from '../features/creator/creator-session.js';
import { mountCreator } from '../features/creator/creator-controller.js';
import { createCreatorDraft } from '../features/creator/creator-state.js';
import { createDefaultStepRegistry } from '../features/creator/steps/index.js';
import { CREATOR_RULESET_REF } from '../features/creator/creator-ruleset-ref.js';

/**
 * Mostra a recusa na tela e no toast, e devolve `err(AppError)` — o Result
 * que `renderCreator` entrega ao router (Task 34) quando a montagem não pode
 * prosseguir. O router NÃO chama `renderError` de novo neste caso: o aviso
 * já está na tela.
 * @param {object} container - contêiner da rota.
 * @param {string} code - código do `AppError` que motivou a recusa.
 * @param {string} message - explicação para o jogador.
 * @returns {{ok: false, error: object}}
 */
function recusar(container, code, message) {
  console.error('pages/creator: ' + code + ' — ' + message);
  renderFailureNotice(container, { title: 'Não foi possível abrir o criador', message, code });
  toast(message, 'error');
  return err(createAppError({ code, scope: 'pages/creator', message }));
}

/**
 * Monta o criador de personagem em `container`.
 *
 * A assinatura é a MESMA que o router (`site/js/core/hash-router.js`, Task
 * 34) sempre chamou. O retorno é um `Result<() => void, AppError>`: em
 * sucesso, `value` é o DISPOSER de `mountCreator` (função idempotente que
 * remove listeners, fecha modais abertos pelo criador e descarta a sessão);
 * em falha, `error` é o `AppError` que motivou a recusa (o aviso na tela já
 * foi desenhado por `recusar()`).
 *
 * @param {object} container - `#app-content`.
 * @returns {Promise<{ok: true, value: () => void} | {ok: false, error: object}>}
 */
export async function renderCreator(container) {
  if (!container || typeof container.addEventListener !== 'function') {
    throw new TypeError('renderCreator: "container" deve ser um nó DOM.');
  }

  // --- Catálogo oficial ----------------------------------------------------
  const conteudo = await appContext.initializeContent();
  if (conteudo.ok !== true) {
    return recusar(container, conteudo.error.code, 'O catálogo de conteúdo oficial não pôde ser carregado.');
  }
  const registry = conteudo.value;

  // A referência de ruleset com que o personagem nasce precisa EXISTIR na
  // versão publicada. Uma constante que ficou para trás falha aqui, alto, em
  // vez de gravar personagens presos a uma versão inexistente.
  const ruleset = registry.resolve(CREATOR_RULESET_REF, 'ruleset');
  if (ruleset.ok !== true) {
    return recusar(container, ruleset.error.code, 'O ruleset base do criador não está ativo no catálogo.');
  }

  // --- Registro dos SETE passos REAIS --------------------------------------
  const stepRegistry = createDefaultStepRegistry();
  if (stepRegistry.ok !== true) {
    return recusar(container, stepRegistry.error.code, 'O criador não pôde montar os sete passos.');
  }

  // --- Persistência: as MESMAS instâncias do resto do app -------------------
  const repository = obterRepositorioDePersonagens();
  if (repository === null) {
    return recusar(
      container,
      'CREATOR_REPOSITORY_UNAVAILABLE',
      'O armazenamento de personagens ainda não foi inicializado; nada seria salvo.',
    );
  }

  // --- Rascunho inicial ----------------------------------------------------
  const personagemVazio = createEmptyCharacter({
    id: gerarId(),
    now: new Date().toISOString(),
    rulesetRef: CREATOR_RULESET_REF,
  });
  const draft = createCreatorDraft({ character: personagemVazio });
  if (draft.ok !== true) {
    return recusar(container, draft.error.code, 'O rascunho inicial do personagem não pôde ser criado.');
  }

  // --- Portas de efeito ----------------------------------------------------
  const imageProcessor = createCharacterImageProcessor({ processImageFile: processarImagemArquivo });

  const session = createCreatorSession({
    draft: draft.value,
    registry,
    stepRegistry: stepRegistry.value,
    rng: createCryptoRng(),
    imageProcessor,
  });

  const mounted = await mountCreator({
    container,
    session,
    stepRegistry: stepRegistry.value,
    repository,
    syncQueue: portaDeMutacaoDuravel,
    modal: obterServicoDeModal(),
    imageProcessor,
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
      /**
       * @param {object} sucesso - payload de criação concluída.
       * @returns {void}
       */
      success: (sucesso) => toast(sucesso?.message ?? 'Personagem criado.', 'success'),
    },
    /**
     * Navegação pós-finalização. `window.navegar` é a mesma porta que o
     * criador legado usava — importar `navegar` de `app.js` criaria um ciclo
     * (é `app.js` quem importa esta página).
     * @param {string} characterId - id do personagem recém-criado.
     * @returns {void}
     */
    navigate: (characterId) => {
      window.navegar('ficha/' + characterId);
    },
  });

  if (mounted.ok !== true) {
    session.dispose();
    return recusar(container, mounted.error.code, 'O criador não pôde ser montado.');
  }
  return ok(mounted.value);
}
