// ============================================================
// Fachada de compatibilidade sobre a nova arquitetura de personagens
// (site/js/infra/character/**) + Firestore (se logado).
//
// Este módulo preserva TODAS as assinaturas/retornos públicos que o
// criador/ficha/home legados já usam (listarPersonagens, salvarPersonagem,
// etc. — nenhuma delas lança nem devolve `Result`), mas por baixo delega
// para o repositório transacional (`local-storage-character-repository.js`)
// via `createLegacyStoreFacade` (`legacy-character-projection.js`). O
// modelo canônico v2 nunca é duplicado em storage: toda leitura devolve
// apenas a projeção plana associada ao token de revisão observado, e todo
// save legado passa por `acceptLegacyCharacterMutation`.
//
// `initializeCharacterStorage()` PRECISA ser chamado (e resolvido com
// sucesso) antes de qualquer outra função deste módulo que toque
// personagens — é `app.js` quem garante isso no boot, antes de renderizar a
// primeira rota. Preferências (taxas de moeda, compra padrão) não dependem
// disso: usam sua própria porta (`infra/preferences`), disponível desde o
// carregamento do módulo.
// ============================================================
import { gerarId, normalizarGrimorioMago } from './utils.js';
import { enfileirarSync, enfileirarRemocao, registrarContextoPersonagens, portaDeMutacaoDuravel } from './sync.js';
import { criarCarteiraVazia, normalizarCarteira, definirTaxas, resetarTaxas } from './moedas.js';
import { appContext } from './app-context.js';
import { ok, err } from './core/result.js';
import { createAppError } from './core/errors.js';
import { createLegacyAliasResolver } from './infra/character/legacy-alias-resolver.js';
import { createPreMigrationBackupService } from './infra/character/pre-migration-backup.js';
import {
  LocalStorageCharacterRepository,
  LEGACY_CLOUD_BACKUP_KEY as BACKUP_KEY,
  CHARACTER_STORAGE_KEY as STORAGE_KEY,
} from './infra/character/local-storage-character-repository.js';
import { createLegacyStoreFacade, LegacyStoreFacadeError } from './infra/character/legacy-character-projection.js';
import { createDurableCharacterMutation } from './infra/sync/durable-character-mutation.js';
import { importCharacterRecords, exportCharacterRecords, stripLocalSync } from './infra/character/import-export-service.js';
import { decodeCharacterRecord, encodeCharacterRecord } from './infra/character/character-codec.js';
import { LocalStoragePreferencesRepository } from './infra/preferences/local-storage-preferences-repository.js';

const SCOPE = 'store';
const ALIAS_ENTITY_ID = 'dnd2024:migration-map:character-v1-aliases';

// --- Preferências: não dependem de conteúdo/repositório, disponíveis desde já ---
const _preferences = LocalStoragePreferencesRepository({ storage: window.localStorage });
export { _preferences as preferences };

// --- Backup de segurança pré-migração: só precisa de `storage`, então fica
// disponível mesmo quando `initializeCharacterStorage()` falha (é
// exatamente o caminho que home.js usa para oferecer "Exportar dados
// brutos" quando a criação do backup falhou) ---
const _backupService = createPreMigrationBackupService({ storage: window.localStorage });

/** @type {object | null} */
let _repository = null;
/** @type {object | null} */
let _facade = null;
/** @type {object | null} */
let _aliasResolver = null;
/** @type {object | null} */
let _durableMutation = null;

/**
 * Adapta a fachada legada (síncrona, que LANÇA `LegacyStoreFacadeError`) ao
 * contrato de repositório esperado pelo protocolo de mutação durável (que
 * fala em `Result`).
 *
 * `expectedRevisionToken` e `reason` são deliberadamente IGNORADOS aqui: a
 * fachada legada é a dona da precondição de revisão (ela liga cada objeto
 * plano devolvido por `list/get/save` ao token observado, ver
 * `legacy-character-projection.js`) e sempre grava com `reason: 'user'`.
 * Reintroduzi-los aqui significaria adivinhar um token em nome do chamador —
 * exatamente o que a fachada existe para impedir.
 * @returns {{save: Function, remove: Function}}
 */
function _criarRepositorioDaFachadaLegada() {
  return {
    /**
     * @param {object} record - registro plano legado.
     * @param {{localSyncMutationId?: string}} options
     * @returns {import('./core/result.js').Result} Result<object, AppError>
     */
    save(record, { localSyncMutationId } = {}) {
      try {
        return ok(_facade.save(record, { localSyncMutationId }));
      } catch (cause) {
        if (cause instanceof LegacyStoreFacadeError) {
          return err(cause.appError);
        }
        return err(
          createAppError({ code: 'CHARACTER_SAVE_UNEXPECTED_FAILURE', scope: SCOPE, message: 'Falha inesperada ao salvar o personagem.', cause }),
        );
      }
    },
    /**
     * O caminho de REMOÇÃO não passa pelo protocolo durável: ele exige um
     * `expectedRevisionToken` explícito, e o token de remoção é privado da
     * fachada legada (`idTokenMap`), que não o expõe. `removerPersonagem`
     * continua usando `enfileirarRemocao` depois da remoção local. Este
     * método existe para que uma chamada indevida falhe explicitamente em
     * vez de virar um `undefined is not a function` no meio do protocolo.
     * @returns {import('./core/result.js').Result}
     */
    remove() {
      return err(
        createAppError({
          code: 'CHARACTER_DURABLE_REMOVE_NOT_WIRED',
          scope: SCOPE,
          message: 'A remoção durável não está ligada à fachada legada; use removerPersonagem().',
        }),
      );
    },
  };
}

/**
 * Inicializa o armazenamento local de personagens: ativa o catálogo de
 * conteúdo oficial, monta o resolvedor de aliases legados, constrói o
 * repositório e roda sua migração/validação única. Idempotente e
 * re-chamável (ex.: `confirmarExportacaoBrutaSeguranca` chama de novo com
 * autorização).
 * @param {{safetyExportAuthorization?: object}} [params]
 * @returns {Promise<import('./core/result.js').Result>}
 */
export async function initializeCharacterStorage({ safetyExportAuthorization } = {}) {
  const result = await _initializeCharacterStorageInternal({ safetyExportAuthorization });
  _lastInitResult = result;
  return result;
}

/** @param {{safetyExportAuthorization?: object}} params */
async function _initializeCharacterStorageInternal({ safetyExportAuthorization } = {}) {
  const contentResult = await appContext.initializeContent();
  if (!contentResult.ok) {
    return contentResult;
  }
  const registry = appContext.getContentRegistry();
  const aliasEntity = registry?.get(ALIAS_ENTITY_ID) ?? null;
  if (aliasEntity === null) {
    return err(
      createAppError({
        code: 'CHARACTER_STORAGE_ALIAS_ENTITY_MISSING',
        scope: SCOPE,
        message: `Entidade de aliases legados "${ALIAS_ENTITY_ID}" não encontrada no catálogo de conteúdo.`,
      }),
    );
  }

  let aliasResolver;
  try {
    aliasResolver = createLegacyAliasResolver(aliasEntity);
  } catch (cause) {
    return err(
      createAppError({
        code: 'CHARACTER_STORAGE_ALIAS_RESOLVER_INVALID',
        scope: SCOPE,
        message: 'Falha ao montar o resolvedor de aliases legados.',
        cause,
      }),
    );
  }

  // Porta do círculo de magia (Task 28b): o codec precisa dela para projetar
  // uma magia CONCEDIDA por efeito (que nasce sem `customDefinition`) no
  // registro legado com `circulo`. É uma leitura pura do catálogo já ativo;
  // um id desconhecido devolve `null` e o campo fica ausente.
  const spellLevelOf = (spellId) => {
    const entidade = registry?.get?.(spellId) ?? null;
    return entidade !== null && Number.isInteger(entidade.level) ? entidade.level : null;
  };

  const repository = LocalStorageCharacterRepository({
    storage: window.localStorage,
    aliasResolver,
    backupService: _backupService,
    spellLevelOf,
  });
  const initResult = repository.initialize({ safetyExportAuthorization });
  if (!initResult.ok) {
    return initResult;
  }

  _aliasResolver = aliasResolver;
  _repository = repository;
  _facade = createLegacyStoreFacade({ repository, aliasResolver });

  // Protocolo de mutação durável no caminho REAL de save: preparar o job na
  // fila -> escrever localmente -> confirmar. Sem ele, um save adotado
  // localmente enquanto a fila não pôde ser persistida (quota, storage
  // cheio) perdia o intent de sincronizar em silêncio. `characterIdOf` lê o
  // `id` do registro plano legado, que é o objeto que criador/ficha salvam.
  _durableMutation = createDurableCharacterMutation({
    repository: _criarRepositorioDaFachadaLegada(),
    syncQueue: portaDeMutacaoDuravel,
    characterIdOf: (record) => record?.identity?.id ?? record?.id,
  });

  // Entrega à fila de sincronização o repositório transacional e o codec já
  // vinculados ao contexto (aliasResolver/relógio). A fila precisa dos dois
  // para reconciliar preparos e para adotar um merge remoto com
  // `expectedStorageRevisionToken` — nunca por escrita direta no storage.
  // Este é o único ponto de acoplamento: `sync.js` não importa `store.js`
  // (evitando o ciclo), é `store.js` que registra o contexto quando ele
  // passa a existir.
  registrarContextoPersonagens({
    repository,
    codec: {
      decode: (rawRecord) => decodeCharacterRecord(rawRecord, { aliasResolver, now: new Date().toISOString() }),
      encode: (character) => encodeCharacterRecord(character, { aliasResolver, localSync: null, spellLevelOf }),
    },
  });

  return ok(initResult.value);
}

/** @type {import('./core/result.js').Result | null} */
let _lastInitResult = null;

/** @returns {boolean} true quando `initializeCharacterStorage()` já foi concluído com sucesso. */
export function isCharacterStorageReady() {
  return _facade !== null;
}

/** @returns {import('./core/result.js').Result | null} o Result da última chamada a `initializeCharacterStorage()`, ou `null` se nunca chamada. */
export function getCharacterStorageInitResult() {
  return _lastInitResult;
}

/**
 * Devolve o repositório TRANSACIONAL de personagens já montado por
 * `initializeCharacterStorage()`, ou `null` antes disso.
 *
 * Existe para o composition root do criador novo (`pages/creator.js`), que
 * salva um `CanonicalCharacter` — e não o registro plano legado que a fachada
 * deste módulo manipula. Devolver a MESMA instância (em vez de montar uma
 * segunda pelo `app-context`) é deliberado: duas instâncias sobre o mesmo
 * `localStorage` rodariam a migração/validação inicial duas vezes e cada uma
 * observaria tokens de revisão da outra como conflito.
 * @returns {object|null}
 */
export function obterRepositorioDePersonagens() {
  return _repository;
}

// --- Backup pré-refatoração (dnd_personagens_backup_refatoracao_v2) -------

/** Exporta o backup de segurança pré-migração como texto (para download). */
export function exportarBackupRefatoracao() {
  return _backupService.export();
}

/**
 * Sem `confirmationToken`: inspeciona o backup e devolve
 * `{confirmationToken, characterCount, byteLength}` (preview). Com
 * `{confirmationToken, confirmed:true}`: efetiva a restauração.
 * @param {{confirmationToken?: *, confirmed?: boolean}} [params]
 */
export function restaurarBackupRefatoracao({ confirmationToken, confirmed } = {}) {
  if (confirmationToken === undefined) {
    return _backupService.inspectRestore();
  }
  return _backupService.restore({ confirmationToken, confirmed });
}

/** Prepara a exportação bruta de segurança (via "sem espaço" quando o backup não pôde ser criado). */
export function prepararExportacaoBrutaSeguranca() {
  const raw = window.localStorage.getItem(STORAGE_KEY) ?? '[]';
  return _backupService.prepareSafetyExport(raw);
}

/**
 * Confirma que o usuário baixou a exportação bruta e repete a
 * inicialização do armazenamento com a autorização de segurança emitida.
 * @param {{confirmationToken: *, confirmed: boolean}} params
 * @returns {Promise<import('./core/result.js').Result>}
 */
export async function confirmarExportacaoBrutaSeguranca({ confirmationToken, confirmed } = {}) {
  const raw = window.localStorage.getItem(STORAGE_KEY) ?? '[]';
  const authorization = _backupService.authorizeMigrationAfterSafetyExport({ rawCharactersJson: raw, confirmationToken, confirmed });
  if (!authorization.ok) {
    return authorization;
  }
  return initializeCharacterStorage({ safetyExportAuthorization: authorization.value });
}

// --- Preferências: taxas de moeda / "comprar equipado" padrão -------------
// Delegadas ao novo repositório de preferências, mesmas chaves/formatos.

/** Preferencia global do usuario (todos os personagens): togle "Comprar" do seletor de itens vem marcado por padrao */
export function carregarComprarAtivoPadrao() {
  const result = _preferences.getPurchaseEquippedDefault();
  return result.ok ? result.value.value : false;
}

/** Salva a preferencia global do togle "Comprar" */
export function salvarComprarAtivoPadrao(ativo) {
  _preferences.setPurchaseEquippedDefault(Boolean(ativo));
}

/** Carrega taxas de conversao de moeda customizadas (se houver) e aplica no motor de moedas */
export function carregarTaxasMoeda() {
  const result = _preferences.getCurrencyRates();
  if (result.ok && result.value.value) {
    definirTaxas(result.value.value);
  }
}

/** Salva e aplica taxas de conversao customizadas. Retorna { sucesso, erro? } */
export function salvarTaxasMoeda(taxas) {
  const resultado = definirTaxas(taxas);
  if (resultado.sucesso) {
    _preferences.setCurrencyRates(resultado.taxas);
  }
  return resultado;
}

/** Restaura as taxas de conversao padrao e remove a customizacao salva */
export function resetarTaxasMoeda() {
  const taxas = resetarTaxas();
  _preferences.resetCurrencyRates();
  return taxas;
}

// --- CRUD de personagens (fachada legada síncrona sobre o repositório) ----

/**
 * @template T
 * @param {() => T} fn
 * @param {T} fallback
 * @returns {T}
 */
function _semExplodir(fn, fallback) {
  try {
    return fn();
  } catch (cause) {
    if (cause instanceof LegacyStoreFacadeError) {
      console.error(`store.js: ${cause.appError.code} — ${cause.appError.message}`, cause.appError.context);
    } else {
      console.error('store.js: falha inesperada', cause);
    }
    return fallback;
  }
}

/** Retorna todos os personagens salvos */
export function listarPersonagens() {
  if (!_facade) return [];
  return _semExplodir(() => _facade.list(), []);
}

/** Busca um personagem por ID */
export function getPersonagem(id) {
  if (!_facade) return null;
  return _semExplodir(() => _facade.get(id), null);
}

/**
 * Salva ou atualiza um personagem. Como as demais funções deste módulo,
 * nunca lança — uma falha (ex.: conflito de revisão) é logada e devolve
 * `null` em vez de propagar `LegacyStoreFacadeError` para dentro de um
 * handler de UI que não sabe tratá-la (`creator.js`/`sheet.js` não
 * capturam o retorno de `salvarPersonagem`/`salvar()`).
 *
 * O caminho passa pelo PROTOCOLO DE MUTAÇÃO DURÁVEL: o intent de
 * sincronizar é persistido na fila ANTES da escrita local (job `prepared`,
 * não enviável) e só vira enviável depois de o save local ser adotado. As
 * três consequências observáveis:
 *
 *   - se a fila não puder ser persistida, o save local NEM É TENTADO e a
 *     função devolve `null` (o mesmo `null` que qualquer outra falha já
 *     devolvia). Antes o save era adotado e o intent de sync se perdia com
 *     um mero `console.warn`;
 *   - se o save local falhar, o job preparado nunca é enviado (a
 *     reconciliação o descarta por não haver efeito local);
 *   - se só a confirmação falhar, o save vale e o job é reconciliado pelo
 *     marcador de mutação no próximo boot.
 *
 * O `_local_sync` gravado é marcador LOCAL: ele nunca chega ao payload
 * remoto porque o codec de envio (`registrarContextoPersonagens`) codifica
 * com `localSync: null`.
 */
export function salvarPersonagem(personagem) {
  if (!_facade || !_durableMutation) {
    console.error('store.js: salvarPersonagem chamado antes de initializeCharacterStorage() concluir.');
    return null;
  }
  const resultado = _durableMutation.save(personagem, { reason: 'user' });
  if (!resultado.ok) {
    console.error(`store.js: ${resultado.error.code} — ${resultado.error.message}`, resultado.error.context);
    return null;
  }
  return resultado.value.envelope;
}

/**
 * Remove um personagem por ID. Só enfileira a remoção na nuvem quando a
 * remoção LOCAL de fato teve sucesso — um remove local que falhou (token
 * ausente/stale) não pode disparar uma remoção remota: o personagem
 * sobreviveria localmente mas seria destruído na nuvem.
 */
export function removerPersonagem(id) {
  if (!_facade) return;
  const removidoLocalmente = _semExplodir(() => {
    _facade.remove(id);
    return true;
  }, false);
  if (removidoLocalmente) enfileirarRemocao(id);
}

/** Duplica um personagem */
export function duplicarPersonagem(id) {
  const original = getPersonagem(id);
  if (!original) return null;
  const copia = JSON.parse(JSON.stringify(original));
  copia.id = gerarId();
  copia.nome = `${copia.nome} (cópia)`;
  // Timestamps frescos: o repositório os define (reason:"user") a partir do
  // relógio real quando ausentes/numa criação nova.
  delete copia.criado_em;
  delete copia.atualizado_em;
  const salva = salvarPersonagem(copia);
  return salva;
}

/**
 * Exporta todos os personagens como JSON string. Devolve `null` (nunca
 * `'[]'`) em caso de erro (ex.: `dnd_personagens` corrompido) — uma lista
 * genuinamente vazia e uma falha de leitura são coisas diferentes; devolver
 * `'[]'` nos dois casos apresentaria corrupção como "nenhum personagem",
 * exatamente o que o brief proíbe. `home.js` distingue os dois casos pelo
 * retorno (string vs `null`).
 */
export function exportarTodos() {
  if (!_repository) return null;
  const listResult = _repository.list();
  if (!listResult.ok) {
    console.error('store.js: exportarTodos falhou ao ler personagens:', listResult.error.code, listResult.error.message);
    return null;
  }
  const exported = exportCharacterRecords(listResult.value.characters, { aliasResolver: _aliasResolver });
  if (!exported.ok) {
    console.error('store.js: exportarTodos falhou ao codificar personagens:', exported.error.code, exported.error.message);
    return null;
  }
  return exported.value;
}

/** Exporta um único personagem (por id) como JSON string, no mesmo formato (array) usado por exportarTodos/importarPersonagens. Devolve `null` tanto para "não encontrado" quanto para erro de leitura/codificação (ver `exportarTodos`). */
export function exportarPersonagem(id) {
  if (!_repository) return null;
  const getResult = _repository.get(id);
  if (!getResult.ok) {
    console.error('store.js: exportarPersonagem falhou ao ler personagem:', getResult.error.code, getResult.error.message);
    return null;
  }
  if (getResult.value === null) return null;
  const exported = exportCharacterRecords([getResult.value], { aliasResolver: _aliasResolver });
  if (!exported.ok) {
    console.error('store.js: exportarPersonagem falhou ao codificar personagem:', exported.error.code, exported.error.message);
    return null;
  }
  return exported.value;
}

/**
 * Substitui toda a lista local (usado apos sincronizacao com nuvem).
 * `lista` é um array de objetos planos (mistura de local/nuvem, já
 * mesclados por home.js) — cada um é decodificado e reemitido numa única
 * escrita atômica; um elemento que não decodifica (não deveria acontecer
 * para dado que já passou por este mesmo storage) é preservado como
 * read-only em vez de descartado.
 * @param {ReadonlyArray<object>} lista
 */
export function atualizarListaLocal(lista) {
  if (!_repository || !Array.isArray(lista)) return;
  const listResult = _repository.list();
  if (!listResult.ok) return;

  const records = lista.map((raw) => {
    let decoded;
    try {
      decoded = decodeCharacterRecord(raw, { aliasResolver: _aliasResolver, now: new Date().toISOString() });
    } catch {
      return { mode: 'read-only', rawRecord: raw };
    }
    if (decoded.ok && decoded.value.mode === 'editable') {
      return { mode: 'editable', character: decoded.value.character, localSync: decoded.value.localSync };
    }
    if (decoded.ok) {
      return { mode: 'read-only', rawRecord: decoded.value.rawRecord ?? raw };
    }
    return { mode: 'read-only', rawRecord: raw };
  });

  _repository.replaceAll(records, { expectedStorageRevisionToken: listResult.value.storageRevisionToken, reason: 'sync' });
}

/**
 * Faz backup dos personagens locais antes de trocar para a nuvem.
 * So cria backup se ainda nao existir (preserva estado original pre-login).
 * Chave: `dnd_personagens_backup` (LEGACY_CLOUD_BACKUP_KEY) — nunca a mesma
 * chave do backup de segurança pré-migração (`dnd_personagens_backup_refatoracao_v2`).
 */
export function backupPersonagensLocais() {
  if (localStorage.getItem(BACKUP_KEY)) return;
  const atual = localStorage.getItem(STORAGE_KEY) || '[]';
  localStorage.setItem(BACKUP_KEY, atual);
}

/**
 * Restaura personagens locais do backup (feito antes do login).
 * Remove o backup apos restaurar.
 */
export function restaurarPersonagensLocais() {
  const backup = localStorage.getItem(BACKUP_KEY);
  if (backup) {
    localStorage.setItem(STORAGE_KEY, backup);
  }
  localStorage.removeItem(BACKUP_KEY);
}

/**
 * Migra um personagem salvo no formato antigo (campo unico `po`) para a
 * carteira multi-moeda `moedas`. Preserva o valor antigo como PO (nao redistribui),
 * evitando reshuffle de saldo em personagens ja existentes. Idempotente.
 * Mantida por compatibilidade (não é mais usada internamente — o codec v2
 * já lida com o campo `po` legado — mas outros módulos podem importá-la).
 */
export function migrarMoedasLegado(p) {
  if (!p || typeof p !== 'object') return p;
  const base = p.moedas && typeof p.moedas === 'object' ? p.moedas : { po: p.po };
  p.moedas = normalizarCarteira(base);
  delete p.po;
  return p;
}

/** Adiciona metadados de edição sem alterar campos existentes da ficha. Mantida por compatibilidade (ver migrarMoedasLegado). */
export function migrarEdicoesLegado(p) {
  if (!p || typeof p !== 'object') return p;
  if (!p.edicoes || p.edicoes.versao !== 1) p.edicoes = { versao: 1, campos: {} };
  if (!p.edicoes.campos || typeof p.edicoes.campos !== 'object') p.edicoes.campos = {};
  if (!p.configuracao_criacao || typeof p.configuracao_criacao !== 'object') p.configuracao_criacao = {};
  if (!p.configuracao_criacao.atributos) {
    p.configuracao_criacao.atributos = { metodo: null, valoresBase: null, rolagens: null };
  }
  return p;
}

/** Importa personagens de um JSON string (merge com existentes). Retorna a quantidade de novos personagens importados, ou -1 em erro. */
export function importarPersonagens(jsonStr) {
  if (!_repository) return -1;
  const result = importCharacterRecords(jsonStr, { repository: _repository, aliasResolver: _aliasResolver, now: new Date().toISOString() });
  if (!result.ok) {
    console.error('Erro ao importar:', result.error.message);
    return -1;
  }
  // Enfileira sync na nuvem para cada personagem editável recém-importado.
  for (const entry of result.value.imported) {
    const envelope = _repository.get(entry.id);
    if (envelope.ok && envelope.value && envelope.value.mode === 'editable') {
      enfileirarSync(stripLocalSync(envelope.value.rawRecord));
    }
  }
  return result.value.imported.length + result.value.readOnly.length;
}

/**
 * Importa personagens devolvendo o relatório completo (usado por home.js
 * para exibir duplicatas/rejeições/avisos, sem perder informação — ao
 * contrário de `importarPersonagens`, que só devolve uma contagem por
 * compatibilidade histórica).
 * @param {string} jsonStr
 * @returns {import('./core/result.js').Result}
 */
export function importarPersonagensDetalhado(jsonStr) {
  if (!_repository) {
    return err(createAppError({ code: 'CHARACTER_STORAGE_NOT_READY', scope: SCOPE, message: 'Armazenamento de personagens ainda não inicializado.' }));
  }
  return importCharacterRecords(jsonStr, { repository: _repository, aliasResolver: _aliasResolver, now: new Date().toISOString() });
}

/** Cria template de personagem vazio */
export function criarPersonagemVazio() {
  return {
    id: gerarId(),
    nome: '',
    imagem: '',
    nivel: 1,
    xp: 0,
    exaustao: 0,
    classe: '',
    subclasse: '',
    especie: '',
    antecedente: '',
    alinhamento: '',
    ordem_divina: '',
    ordem_primal: '',
    tracos_escolhidos: [],
    extras_classe: {},
    escolhas_classe: {},
    escolhas_antecedente: {},
    proficiencias_extra: [],
    atributos: {
      forca: 10,
      destreza: 10,
      constituicao: 10,
      inteligencia: 10,
      sabedoria: 10,
      carisma: 10
    },
    configuracao_criacao: {
      atributos: { metodo: null, valoresBase: null, rolagens: null }
    },
    edicoes: { versao: 1, campos: {} },
    atributos_base: {
      forca: 10,
      destreza: 10,
      constituicao: 10,
      inteligencia: 10,
      sabedoria: 10,
      carisma: 10
    },
    bonus_antecedente: {},
    pv_max: 0,
    pv_atual: 0,
    pv_temporario: 0,
    dados_vida_total: 1,
    dados_vida_usados: 0,
    pericias_proficientes: [],
    pericias_expertise: [],
    salvaguardas_proficientes: [],
    inventario: [],
    escolha_equip_classe: null,
    escolha_equip_antecedente: null,
    moedas: criarCarteiraVazia(),
    magias_conhecidas: [],
    magias_preparadas: [],
    grimorio: [],
    espacos_magia: {},
    talentos: [],
    itens_customizados: [],
    magias_customizadas: [],
    efeitos_magicos: [],
    usos_habilidades: {},
    aparencia: '',
    personalidade: '',
    ideais: '',
    lacos: '',
    defeitos: '',
    historia_personagem: '',
    notas: '',
    idiomas: ['Comum'],
    tamanho: '',
    config: { sobrecarga_afeta_deslocamento: false },
    condicoes: [],
    resistencias: [],
    vulnerabilidades: [],
    imunidades: [],
    proficiencias_ferramentas: [],
    proficiencias_instrumentos: [],
    talentos_flags: {},
    talentos_parametros: {},
    criado_em: new Date().toISOString(),
    atualizado_em: new Date().toISOString()
  };
}

// Mantida por compatibilidade — não usada mais internamente (o codec v2
// já valida/normaliza na decodificação), mas outros módulos podem tê-la
// importado no passado.
void normalizarGrimorioMago;
