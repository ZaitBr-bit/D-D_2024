// ============================================================
// Pagina inicial - Lista de personagens
// ============================================================
import {
  listarPersonagens, removerPersonagem, duplicarPersonagem, exportarTodos, exportarPersonagem,
  importarPersonagensDetalhado, backupPersonagensLocais, restaurarPersonagensLocais,
  isCharacterStorageReady, getCharacterStorageInitResult, initializeCharacterStorage,
  exportarBackupRefatoracao, restaurarBackupRefatoracao, prepararExportacaoBrutaSeguranca, confirmarExportacaoBrutaSeguranca,
} from '../store.js';
import { sincronizarComNuvem } from '../sync.js';
import { toast, abrirModal, fmtData, escHtml } from '../utils.js';
import { CLASSES_INFO } from '../dados-classes.js';
import { iniciarAuth, getUsuario, loginComGoogle, logout, onAuthChange } from '../auth.js';
import { ok } from '../core/result.js';

let _containerRef = null;
let _sincronizando = false;

/**
 * Disposer no-op da rota `home` (Task 34): esta página não registra nada
 * fora do próprio `container` (que a próxima rota substitui por completo),
 * então não há nada a limpar — mas o contrato do router exige um disposer
 * explícito, nunca `undefined`.
 * @returns {void}
 */
function _semNadaParaDescartar() {}

/**
 * Renderiza a página inicial em `container`.
 *
 * A assinatura é a MESMA que o router (`site/js/core/hash-router.js`, Task
 * 34) sempre chamou. O retorno é um `Result<() => void, AppError>` — aqui
 * sempre `ok(disposer)`, já que a home nunca recusa a montagem.
 * @param {object} container - `#app-content`.
 * @returns {{ok: true, value: () => void}}
 */
export function renderHome(container) {
  _containerRef = container;

  if (!isCharacterStorageReady()) {
    _renderEstadoRecuperavel(container);
    return ok(_semNadaParaDescartar);
  }

  const personagens = listarPersonagens();
  const usuario = getUsuario();

  // Iniciar Firebase em background (nao bloqueia a renderizacao)
  iniciarAuth().then(() => {
    // Registrar callback de auth apenas uma vez
    if (!renderHome._authRegistrado) {
      renderHome._authRegistrado = true;
      onAuthChange(() => {
        // Re-renderizar ao mudar estado de auth — só quando a rota ATUAL
        // ainda é a home: `onAuthChange` pode disparar de forma síncrona
        // (site/js/auth.js#onAuthChange chama o callback na hora se o auth
        // já estava resolvido) e, com a inicialização de storage agora
        // assíncrona (initializeCharacterStorage), essa reentrada pode
        // acontecer depois que o usuário já navegou para outra rota —
        // sobrescrever #app-content às cegas destruiria a rota atual.
        const rotaAtual = (window.location.hash.slice(1) || 'home').split('/')[0];
        if (_containerRef && rotaAtual === 'home') renderHome(_containerRef);
      });
    }
  });

  _renderConteudo(container, personagens, usuario);
  return ok(_semNadaParaDescartar);
}

/**
 * Renderiza o estado recuperável de inicialização do armazenamento de
 * personagens (`initializeCharacterStorage()` falhou ou nunca terminou):
 * nunca mostra a lista/CRUD normal, oferece "tentar novamente" e — só
 * quando aplicável — o fluxo de backup pré-migração ou de exportação bruta
 * de segurança.
 * @param {HTMLElement} container
 */
function _renderEstadoRecuperavel(container) {
  const resultado = getCharacterStorageInitResult();
  const erro = resultado && !resultado.ok ? resultado.error : null;

  const validacaoBackup = _validarBackupRefatoracao();

  container.innerHTML = `
    <div class="empty-state">
      <h2>Não foi possível carregar seus personagens</h2>
      <p style="color:var(--text-muted);font-size:0.85rem">${erro ? escHtml(`${erro.code}: ${erro.message}`) : 'Inicialização ainda em andamento ou não realizada.'}</p>
      <button class="btn btn-primary" id="btn-retry-storage">Tentar novamente</button>
    </div>
    <div class="card" style="margin-top:12px">
      ${validacaoBackup.valid
        ? `<h3 style="font-size:0.95rem">Backup de segurança encontrado</h3>
           <p style="font-size:0.8rem;color:var(--text-muted)">Foi feita uma cópia dos seus dados originais antes da tentativa de migração. Você pode baixá-la ou restaurá-la.</p>
           <div style="display:flex;gap:8px;margin-top:8px">
             <button class="btn btn-sm btn-secondary" id="btn-baixar-backup">Baixar backup</button>
             <button class="btn btn-sm btn-danger" id="btn-restaurar-backup">Restaurar backup</button>
           </div>`
        : `<h3 style="font-size:0.95rem">Exportar dados brutos</h3>
           <p style="font-size:0.8rem;color:var(--text-muted)">Não há backup automático disponível. Baixe uma cópia bruta dos seus dados antes de tentar novamente.</p>
           <button class="btn btn-sm btn-secondary" id="btn-exportar-bruto">Exportar dados brutos</button>`
      }
    </div>
  `;

  document.getElementById('btn-retry-storage')?.addEventListener('click', async () => {
    toast('Tentando novamente...', 'info');
    await initializeCharacterStorage();
    renderHome(container);
  });

  document.getElementById('btn-baixar-backup')?.addEventListener('click', () => {
    const resultadoExport = exportarBackupRefatoracao();
    if (!resultadoExport.ok) {
      toast('Erro ao exportar backup: ' + resultadoExport.error.message, 'error');
      return;
    }
    _baixarArquivo(resultadoExport.value, `dnd_backup_refatoracao_${Date.now()}.json`);
  });

  document.getElementById('btn-restaurar-backup')?.addEventListener('click', () => {
    const preview = restaurarBackupRefatoracao();
    if (!preview.ok) {
      toast('Erro ao inspecionar backup: ' + preview.error.message, 'error');
      return;
    }
    abrirModal(
      'Restaurar backup',
      `<p>Isso substituirá os dados atuais de <code>dnd_personagens</code> pelo backup salvo antes da tentativa de migração.</p>
       <p style="font-size:0.85rem;color:var(--text-muted)">Backup: ${preview.value.characterCount} personagem(ns), ${preview.value.byteLength} bytes.</p>`,
      `<button class="btn btn-secondary" data-action="fechar-modal">Cancelar</button>
       <button class="btn btn-danger" id="btn-confirmar-restaurar-backup">Restaurar</button>`,
    );
    document.getElementById('btn-confirmar-restaurar-backup')?.addEventListener('click', async () => {
      const restoreResult = restaurarBackupRefatoracao({ confirmationToken: preview.value.confirmationToken, confirmed: true });
      window.fecharModal();
      if (!restoreResult.ok) {
        toast('Erro ao restaurar backup: ' + restoreResult.error.message, 'error');
        return;
      }
      toast('Backup restaurado. Tentando carregar novamente...', 'success');
      await initializeCharacterStorage();
      renderHome(container);
    });
  });

  document.getElementById('btn-exportar-bruto')?.addEventListener('click', () => {
    const prepared = prepararExportacaoBrutaSeguranca();
    if (!prepared.ok) {
      toast('Erro ao preparar exportação: ' + prepared.error.message, 'error');
      return;
    }
    _baixarArquivo(prepared.value.jsonText, `dnd_exportacao_seguranca_${Date.now()}.json`);
    abrirModal(
      'Confirmar download',
      `<p>Confirme que o arquivo foi baixado (${prepared.value.characterCount} personagem(ns)) para permitir que a inicialização prossiga sem o backup automático.</p>`,
      `<button class="btn btn-secondary" data-action="fechar-modal">Cancelar</button>
       <button class="btn btn-primary" id="btn-confirmar-exportacao-bruta">Já baixei, continuar</button>`,
    );
    document.getElementById('btn-confirmar-exportacao-bruta')?.addEventListener('click', async () => {
      window.fecharModal();
      const confirmResult = await confirmarExportacaoBrutaSeguranca({ confirmationToken: prepared.value.confirmationToken, confirmed: true });
      if (!confirmResult.ok) {
        toast('Erro ao continuar: ' + confirmResult.error.message, 'error');
        return;
      }
      toast('Continuado com sucesso.', 'success');
      renderHome(container);
    });
  });
}

/** @returns {{valid: boolean}} valida (sem lançar) se o backup pré-migração existe e é utilizável. */
function _validarBackupRefatoracao() {
  try {
    const resultado = restaurarBackupRefatoracao();
    return { valid: resultado.ok };
  } catch {
    return { valid: false };
  }
}

/**
 * @param {string} texto
 * @param {string} nomeArquivo
 */
function _baixarArquivo(texto, nomeArquivo) {
  const blob = new Blob([texto], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  a.click();
  URL.revokeObjectURL(url);
}

function _renderConteudo(container, personagens, usuario) {
  // Barra de conta Google (opcional)
  const contaHtml = usuario
    ? `<div class="card" style="display:flex;align-items:center;gap:10px;padding:10px 14px;margin-bottom:12px;background:var(--bg-input)">
        <img src="${escHtml(usuario.photoURL || '')}" alt="" style="width:32px;height:32px;border-radius:50%;${usuario.photoURL ? '' : 'display:none'}" referrerpolicy="no-referrer">
        <div style="flex:1;min-width:0">
          <div style="font-size:0.85rem;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(usuario.displayName || usuario.email || '')}</div>
          <div style="font-size:0.7rem;color:var(--text-muted)">Personagens sincronizados com a nuvem</div>
        </div>
        <button class="btn btn-sm btn-secondary" id="btn-sync-cloud" title="Sincronizar agora">&#x21bb;</button>
        <button class="btn btn-sm btn-secondary" id="btn-logout" title="Sair da conta">Sair</button>
      </div>`
    : `<div class="card" style="display:flex;align-items:center;justify-content:center;gap:10px;padding:10px 14px;margin-bottom:12px;background:var(--bg-input)">
        <button class="btn btn-sm" id="btn-login-google" style="display:flex;align-items:center;gap:8px;background:#fff;color:#444;border:1px solid var(--border);padding:6px 14px;font-weight:600;font-size:0.85rem;border-radius:var(--radius)">
          <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#34A853" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#FBBC05" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
          Entrar com Google
        </button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Opcional - salva na nuvem</span>
      </div>`;

  if (personagens.length === 0) {
    container.innerHTML = `
      ${contaHtml}
      <div class="empty-state">
        <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="#7b2d26" stroke-width="1.5">
          <path d="M12 2L2 7l10 5 10-5-10-5z"/>
          <path d="M2 17l10 5 10-5"/>
          <path d="M2 12l10 5 10-5"/>
        </svg>
        <h2>Nenhum personagem criado</h2>
        <p>Crie seu primeiro personagem e comece sua aventura!</p>
        <button class="btn btn-primary btn-lg" data-action="ir-criar">
          + Novo Personagem
        </button>
      </div>
      <div class="text-center mt-3">
        <button class="btn btn-secondary btn-sm" id="btn-importar">Importar Personagens</button>
      </div>
    `;
    _setupAuthEvents(container);
    setupImportar(container);
    _ligarBotoesNovoPersonagem(container);

    // Sincronizar automaticamente ao renderizar a home se logado
    _sincronizarSeLogado(container);
    return;
  }

  container.innerHTML = `
    ${contaHtml}
    <div class="flex justify-between items-center mb-1">
      <h2 style="font-size:1.1rem;color:var(--text)">Meus Personagens</h2>
      <div class="flex gap-1">
        <button class="btn btn-sm btn-secondary" id="btn-exportar" title="Exportar todos os personagens num único arquivo">Exportar Todos</button>
        <button class="btn btn-sm btn-secondary" id="btn-importar" title="Importar arquivo com 1 ou vários personagens">Importar</button>
      </div>
    </div>
    <p style="font-size:0.72rem;color:var(--text-muted);margin:0 0 10px 0">
      "Exportar Todos" salva a lista inteira num arquivo. Pra exportar um personagem só, use o botão &#x21E9; no card dele. "Importar" aceita arquivos com 1 ou vários personagens.
    </p>
    <div class="char-list">
      ${personagens.map(p => renderCharCard(p)).join('')}
    </div>
    <div class="mt-3 text-center">
      <button class="btn btn-primary btn-lg btn-block" data-action="ir-criar">
        + Novo Personagem
      </button>
    </div>
  `;

  _ligarBotoesNovoPersonagem(container);

  // Eventos de clique nos cards
  container.querySelectorAll('.char-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.char-actions')) return;
      navegar(`ficha/${card.dataset.id}`);
    });
  });

  // Botões de ação nos cards
  container.querySelectorAll('[data-action="duplicar"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.closest('.char-card').dataset.id;
      duplicarPersonagem(id);
      toast('Personagem duplicado!', 'success');
      renderHome(container);
    });
  });

  container.querySelectorAll('[data-action="exportar-individual"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.closest('.char-card').dataset.id;
      const p = personagens.find(x => x.id === id);
      const json = exportarPersonagem(id);
      if (!json) {
        toast('Erro ao exportar personagem', 'error');
        return;
      }
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dnd_personagem_${(p?.nome || 'sem_nome').replace(/[^\w\-]+/g, '_')}_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast(`${p?.nome || 'Personagem'} exportado!`, 'success');
    });
  });

  container.querySelectorAll('[data-action="excluir"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.closest('.char-card').dataset.id;
      const p = personagens.find(x => x.id === id);
      abrirModal(
        'Excluir Personagem',
        `<p>Tem certeza que deseja excluir <strong>${escHtml(p?.nome) || 'este personagem'}</strong>?</p><p style="color:var(--danger);font-size:0.85rem;margin-top:8px;">Esta acao nao pode ser desfeita.</p>`,
        `<button class="btn btn-secondary" data-action="fechar-modal">Cancelar</button>
         <button class="btn btn-danger" id="btn-confirmar-excluir">Excluir</button>`
      );
      document.getElementById('btn-confirmar-excluir').addEventListener('click', () => {
        removerPersonagem(id);
        window.fecharModal();
        toast('Personagem excluído', 'error');
        renderHome(container);
      });
    });
  });

  // Exportar
  const btnExportar = document.getElementById('btn-exportar');
  if (btnExportar) {
    btnExportar.addEventListener('click', () => {
      const json = exportarTodos();
      if (!json) {
        toast('Erro ao exportar personagens', 'error');
        return;
      }
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dnd_personagens_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast('Exportados com sucesso!', 'success');
    });
  }

  setupImportar(container);
  _setupAuthEvents(container);

  // Sincronizar automaticamente ao renderizar a home se logado
  _sincronizarSeLogado(container);
}

/** Configura eventos de login/logout/sync */
/**
 * Liga os botões "+ Novo Personagem" (`[data-action="ir-criar"]`) à navegação
 * para a rota `criar`. Substitui o antigo `onclick="navegar('criar')"` inline
 * (Task 37: nenhum handler inline sobra em `site/**`, o que permite remover
 * `'unsafe-inline'` de `script-src` na CSP).
 * @param {HTMLElement} container - raiz renderizada da home.
 * @returns {void}
 */
function _ligarBotoesNovoPersonagem(container) {
  container.querySelectorAll('[data-action="ir-criar"]').forEach((btn) => {
    btn.addEventListener('click', () => navegar('criar'));
  });
}

function _setupAuthEvents(container) {
  // Login com Google
  document.getElementById('btn-login-google')?.addEventListener('click', async () => {
    try {
      toast('Abrindo login com Google...', 'info');
      await loginComGoogle();
      toast('Login realizado com sucesso!', 'success');
      // A re-renderizacao sera feita pelo onAuthChange callback
    } catch (err) {
      if (err.code === 'auth/popup-closed-by-user') {
        toast('Login cancelado', 'info');
      } else {
        console.error('Erro no login:', err);
        toast('Erro ao fazer login: ' + (err.message || 'desconhecido'), 'error');
      }
    }
  });

  // Logout
  document.getElementById('btn-logout')?.addEventListener('click', async () => {
    try {
      // Restaurar personagens locais ANTES do logout,
      // pois onAuthChange re-renderiza durante o signOut
      restaurarPersonagensLocais();
      await logout();
      toast('Desconectado da conta Google', 'info');
    } catch (err) {
      toast('Erro ao desconectar', 'error');
    }
  });

  // Sincronizar manualmente
  document.getElementById('btn-sync-cloud')?.addEventListener('click', () => {
    _sincronizarSeLogado(container, true);
  });
}

/**
 * Sincroniza personagens com a nuvem (se logado).
 *
 * O merge por `atualizado_em` NÃO é mais feito aqui: ele vive em
 * `infra/sync/merge-character-records.js` e é aplicado por
 * `syncQueue.adoptRemoteMerge()` (via `sincronizarComNuvem()`), que decodifica
 * cada documento remoto pelo codec v1->v2, adota o resultado pelo repositório
 * transacional com `expectedStorageRevisionToken` (nunca por escrita direta no
 * storage) e REENFILEIRA os personagens em que o lado local venceu — o que a
 * versão anterior desta função fazia à mão, sem precondição de revisão e sem
 * tratar timestamp ausente/inválido (que agora é retido como conflito em vez
 * de eleger um vencedor silencioso).
 */
async function _sincronizarSeLogado(container, manual = false) {
  const usuario = getUsuario();
  if (!usuario || _sincronizando) return;

  _sincronizando = true;
  try {
    if (manual) toast('Sincronizando...', 'info');
    backupPersonagensLocais();

    const idsAntes = listarPersonagens().map(p => `${p.id}:${p.atualizado_em}`).join('|');
    const adotado = await sincronizarComNuvem();

    if (!adotado) {
      if (manual) toast('Não foi possível sincronizar agora.', 'error');
      return;
    }

    const idsDepois = listarPersonagens().map(p => `${p.id}:${p.atualizado_em}`).join('|');

    if (manual) {
      toast('Sincronizado com sucesso!', 'success');
      renderHome(container);
    } else if (idsDepois !== idsAntes) {
      // Re-renderizar só quando a lista de fato mudou (ids ou atualizado_em).
      renderHome(container);
    }
  } catch (err) {
    console.warn('Erro na sincronizacao:', err);
    if (manual) toast('Erro ao sincronizar: ' + (err.message || ''), 'error');
  } finally {
    _sincronizando = false;
  }
}

function setupImportar(container) {
  const btnImportar = document.getElementById('btn-importar');
  if (btnImportar) {
    btnImportar.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          const result = importarPersonagensDetalhado(ev.target.result);
          if (!result.ok) {
            toast('Erro ao importar arquivo: ' + result.error.message, 'error');
            return;
          }
          const { imported, duplicates, readOnly, rejected, warnings } = result.value;
          const totalNovos = imported.length + readOnly.length;
          // Mesma mensagem/contagem histórica de `importarPersonagens` (só
          // conta os NOVOS efetivamente gravados) — sempre exibida, mesmo
          // quando há duplicatas/rejeições/avisos a relatar (abaixo).
          toast(`${totalNovos} personagem(ns) importado(s)!`, 'success');
          if (duplicates.length > 0 || rejected.length > 0 || warnings.length > 0) {
            abrirModal(
              'Relatório de importação',
              `<p>${totalNovos} importado(s) com sucesso${readOnly.length ? ` (${readOnly.length} em modo somente leitura, schema não reconhecido)` : ''}.</p>
               ${duplicates.length ? `<p>${duplicates.length} ignorado(s) por duplicidade (id já existente).</p>` : ''}
               ${rejected.length ? `<p style="color:var(--danger)">${rejected.length} rejeitado(s):</p><ul style="font-size:0.8rem;max-height:150px;overflow:auto">${rejected.map((r) => `<li>índice ${r.index}${r.id ? ` (id ${escHtml(r.id)})` : ''}: ${escHtml(r.errors.map((e) => e.message).join('; '))}</li>`).join('')}</ul>` : ''}
               ${warnings.length ? `<p style="font-size:0.8rem;color:var(--text-muted)">${warnings.length} aviso(s) durante a importação.</p>` : ''}`,
              `<button class="btn btn-primary" data-action="fechar-modal">Ok</button>`,
            );
          }
          renderHome(container);
        };
        reader.readAsText(file);
      });
      input.click();
    });
  }
}

function renderCharCard(p) {
  const inicial = (p.nome || p.classe || '?')[0].toUpperCase();
  const info = CLASSES_INFO[p.classe];
  const dadoVida = info ? `d${info.dado_vida}` : '';

  return `
    <div class="card char-card" data-id="${escHtml(p.id)}">
      <div class="char-avatar">${p.imagem ? `<img src="${p.imagem}" alt="">` : escHtml(inicial)}</div>
      <div class="char-info">
        <div class="char-nome">${escHtml(p.nome) || 'Sem nome'}</div>
        <div class="char-detalhe">
          ${escHtml(p.especie || '')} ${escHtml(p.classe || '')}
          ${p.subclasse ? `(${escHtml(p.subclasse)})` : ''}
          ${dadoVida ? `&middot; ${dadoVida}` : ''}
        </div>
      </div>
      <div class="char-nivel">Nv. ${escHtml(p.nivel ?? 1)}</div>
      <div class="char-actions" style="display:flex;gap:4px;margin-left:8px;">
        <button class="btn btn-sm btn-secondary" data-action="exportar-individual" title="Exportar este personagem (arquivo só com ele)">&#x21E9;</button>
        <button class="btn btn-sm btn-secondary" data-action="duplicar" title="Duplicar">&#x2398;</button>
        <button class="btn btn-sm btn-danger" data-action="excluir" title="Excluir">&times;</button>
      </div>
    </div>
  `;
}
