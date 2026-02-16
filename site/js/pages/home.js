// ============================================================
// Pagina inicial - Lista de personagens
// ============================================================
import { listarPersonagens, removerPersonagem, duplicarPersonagem, exportarTodos, importarPersonagens, atualizarListaLocal, backupPersonagensLocais, restaurarPersonagensLocais } from '../store.js';
import { toast, abrirModal, fmtData } from '../utils.js';
import { CLASSES_INFO } from '../dados-classes.js';
import { iniciarAuth, getUsuario, loginComGoogle, logout, onAuthChange, buscarPersonagensCloud } from '../auth.js';

let _containerRef = null;
let _sincronizando = false;

export function renderHome(container) {
  _containerRef = container;
  const personagens = listarPersonagens();
  const usuario = getUsuario();

  // Iniciar Firebase em background (nao bloqueia a renderizacao)
  iniciarAuth().then(() => {
    // Registrar callback de auth apenas uma vez
    if (!renderHome._authRegistrado) {
      renderHome._authRegistrado = true;
      onAuthChange(() => {
        // Re-renderizar ao mudar estado de auth
        if (_containerRef) renderHome(_containerRef);
      });
    }
  });

  _renderConteudo(container, personagens, usuario);
}

function _renderConteudo(container, personagens, usuario) {
  // Barra de conta Google (opcional)
  const contaHtml = usuario
    ? `<div class="card" style="display:flex;align-items:center;gap:10px;padding:10px 14px;margin-bottom:12px;background:var(--bg-input)">
        <img src="${usuario.photoURL || ''}" alt="" style="width:32px;height:32px;border-radius:50%;${usuario.photoURL ? '' : 'display:none'}" referrerpolicy="no-referrer">
        <div style="flex:1;min-width:0">
          <div style="font-size:0.85rem;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${usuario.displayName || usuario.email}</div>
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
        <button class="btn btn-primary btn-lg" onclick="navegar('criar')">
          + Novo Personagem
        </button>
      </div>
      <div class="text-center mt-3">
        <button class="btn btn-secondary btn-sm" id="btn-importar">Importar Personagens</button>
      </div>
    `;
    _setupAuthEvents(container);
    setupImportar(container);
    return;
  }

  container.innerHTML = `
    ${contaHtml}
    <div class="flex justify-between items-center mb-2">
      <h2 style="font-size:1.1rem;color:var(--text)">Meus Personagens</h2>
      <div class="flex gap-1">
        <button class="btn btn-sm btn-secondary" id="btn-exportar" title="Exportar">Exportar</button>
        <button class="btn btn-sm btn-secondary" id="btn-importar" title="Importar">Importar</button>
      </div>
    </div>
    <div class="char-list">
      ${personagens.map(p => renderCharCard(p)).join('')}
    </div>
    <div class="mt-3 text-center">
      <button class="btn btn-primary btn-lg btn-block" onclick="navegar('criar')">
        + Novo Personagem
      </button>
    </div>
  `;

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

  container.querySelectorAll('[data-action="excluir"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.closest('.char-card').dataset.id;
      const p = personagens.find(x => x.id === id);
      abrirModal(
        'Excluir Personagem',
        `<p>Tem certeza que deseja excluir <strong>${p?.nome || 'este personagem'}</strong>?</p><p style="color:var(--danger);font-size:0.85rem;margin-top:8px;">Esta acao nao pode ser desfeita.</p>`,
        `<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>
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

/** Sincroniza personagens com a nuvem (se logado) */
async function _sincronizarSeLogado(container, manual = false) {
  const usuario = getUsuario();
  if (!usuario || _sincronizando) return;

  _sincronizando = true;
  try {
    if (manual) toast('Sincronizando...', 'info');
    // Fazer backup dos personagens locais antes de substituir com os da nuvem
    backupPersonagensLocais();
    const listaCloud = await buscarPersonagensCloud();
    const listaAnterior = listarPersonagens();
    atualizarListaLocal(listaCloud);
    if (manual) {
      toast('Sincronizado com sucesso!', 'success');
      renderHome(container);
    } else {
      // Re-renderizar se houve mudanca
      if (listaCloud.length !== listaAnterior.length ||
          JSON.stringify(listaCloud.map(p => p.id).sort()) !== JSON.stringify(listaAnterior.map(p => p.id).sort())) {
        renderHome(container);
      }
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
          const result = importarPersonagens(ev.target.result);
          if (result >= 0) {
            toast(`${result} personagem(ns) importado(s)!`, 'success');
            renderHome(container);
          } else {
            toast('Erro ao importar arquivo', 'error');
          }
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
    <div class="card char-card" data-id="${p.id}">
      <div class="char-avatar">${inicial}</div>
      <div class="char-info">
        <div class="char-nome">${p.nome || 'Sem nome'}</div>
        <div class="char-detalhe">
          ${p.especie || ''} ${p.classe || ''}
          ${p.subclasse ? `(${p.subclasse})` : ''}
          ${dadoVida ? `&middot; ${dadoVida}` : ''}
        </div>
      </div>
      <div class="char-nivel">Nv. ${p.nivel || 1}</div>
      <div class="char-actions" style="display:flex;gap:4px;margin-left:8px;">
        <button class="btn btn-sm btn-secondary" data-action="duplicar" title="Duplicar">&#x2398;</button>
        <button class="btn btn-sm btn-danger" data-action="excluir" title="Excluir">&times;</button>
      </div>
    </div>
  `;
}
