// ============================================================
// Modal de edicao da ficha e subida de nivel
// Extraido de site/js/pages/sheet.js sem alteracao de comportamento.
// ============================================================
import { ATRIBUTOS_KEYS, ATRIBUTOS_NOMES, PERICIAS, POINT_BUY_CUSTOS, POINT_BUY_TOTAL, STANDARD_ARRAY } from '../dados-classes.js';
import { validarAtributosEditados, validarListaUnica } from '../ficha-edicao-validacoes.js';
import { aplicarEdicao, consolidarEdicoesAtributos, reverterEdicao } from '../ficha-edicoes.js';
import { abrirLevelUpCards } from '../levelup-ui.js';
import { XP_POR_NIVEL, podeSubirDeNivel } from '../levelup.js';
import { abrirModal, calcMod, escHtml, fmtMod, processarImagemArquivo, toast } from '../utils.js';
import { rotuloPericia } from '../opcoes-dominio.js';
import { campoEstaEditado, char, classeData, salvar, seloEdicao, talentosCache } from './estado.js';
import { renderFichaCompleta } from './ficha.js';
import { achatarMagiasClasse, ehSubclasseConjuradora, getSubclasseConjuradoraConjuracao, magiaContaNoLimite, obterMagiasDisponiveisClasseAtual } from './magias.js';
import { obterListasIniciadoEmMagiaUsadas, obterTiposAdeptoElementalUsados } from './talentos.js';

// Feature flag de migração do fluxo de level up em cards.
// Pode ser sobrescrita por:
// 1) window.__FEATURE_FLAGS__.LEVELUP_FLOW_V2
// 2) localStorage[feature.levelup.flow.v2]
const LEVELUP_FLOW_V2_DEFAULT = true;
const LEVELUP_FLOW_V2_STORAGE_KEY = 'feature.levelup.flow.v2';

function obterFlagLevelUpFlowV2() {
  try {
    const ffGlobal = window?.__FEATURE_FLAGS__?.LEVELUP_FLOW_V2;
    if (typeof ffGlobal === 'boolean') return ffGlobal;
    if (typeof ffGlobal === 'string') {
      const v = ffGlobal.trim().toLowerCase();
      if (['1', 'true', 'on', 'sim'].includes(v)) return true;
      if (['0', 'false', 'off', 'nao', 'não'].includes(v)) return false;
    }
  } catch (_) {
    // Ignorar e seguir para outras fontes da flag.
  }

  try {
    const raw = localStorage.getItem(LEVELUP_FLOW_V2_STORAGE_KEY);
    if (raw == null) return LEVELUP_FLOW_V2_DEFAULT;
    const v = String(raw).trim().toLowerCase();
    if (['1', 'true', 'on', 'sim'].includes(v)) return true;
    if (['0', 'false', 'off', 'nao', 'não'].includes(v)) return false;
  } catch (_) {
    // Ignorar e usar valor padrão.
  }

  return LEVELUP_FLOW_V2_DEFAULT;
}

function salvarFlagLevelUpFlowV2(ativo) {
  try {
    localStorage.setItem(LEVELUP_FLOW_V2_STORAGE_KEY, ativo ? 'true' : 'false');
  } catch (_) {
    // Sem persistência local disponível.
  }
}

// --- Edição do cabeçalho e detalhes ---
function abrirModalEdicaoFicha(secaoInicial = 'atributos') {
  const secoes = ['atributos', 'pericias', 'detalhes'];
  let secao = secoes.includes(secaoInicial) ? secaoInicial : 'atributos';
  let imagemPendente = char.imagem || '';
  let propostaAtributos = Object.fromEntries(ATRIBUTOS_KEYS.map(key => [key, char.atributos_base?.[key] ?? char.atributos[key]]));
  const bonusAtributo = key => char.bonus_antecedente?.[key] || 0;
  const caixaAtributo = (key, conteudo) => {
    const base = propostaAtributos[key];
    const bonus = bonusAtributo(key);
    const total = base + bonus;
    return `<div class="atributo-box" data-key="${key}">
      <div class="atributo-nome">${ATRIBUTOS_NOMES[key]}${seloEdicao(`atributos.${key}`)}</div>
      ${conteudo}
      <div style="font-size:0.65rem;color:var(--text-muted)">base: ${base}</div>
      ${bonus ? `<div style="font-size:0.7rem;color:var(--success)">+${bonus} antecedente</div>` : ''}
      <div class="atributo-mod">${fmtMod(calcMod(total))}</div>
      <div class="atributo-total">${total}</div>
    </div>`;
  };
  const atributosEstaoEditados = () => ATRIBUTOS_KEYS.some(key =>
    campoEstaEditado(`atributos_base.${key}`) || campoEstaEditado(`atributos.${key}`));
  const render = () => {
    const navegacao = `<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:12px">${secoes.map(s => `<button class="btn btn-sm ${s === secao ? 'btn-primary' : 'btn-secondary'}" data-edicao-secao="${s}">${s[0].toUpperCase() + s.slice(1)}</button>`).join('')}</div>`;
    if (secao === 'atributos') {
      const cfg = char.configuracao_criacao?.atributos || {};
      const metodo = cfg.metodo || '';
      const selecaoPorValores = valores => {
        const atribuicoes = {};
        const usados = new Set();
        ATRIBUTOS_KEYS.forEach(key => {
          const indice = valores.findIndex((valor, i) => valor === propostaAtributos[key] && !usados.has(i));
          if (indice >= 0) { atribuicoes[key] = indice; usados.add(indice); }
        });
        return ATRIBUTOS_KEYS.map(key => caixaAtributo(key, `<select class="form-select" style="font-size:0.85rem;padding:6px;margin:4px 0" data-edicao-atributo="${key}">
          <option value="">--</option>
          ${valores.map((valor, indice) => `<option value="${indice}" ${atribuicoes[key] === indice ? 'selected' : ''} ${usados.has(indice) && atribuicoes[key] !== indice ? 'disabled' : ''}>${valor}</option>`).join('')}
        </select>`)).join('');
      };
      let controles = ATRIBUTOS_KEYS.map(key => caixaAtributo(key, `<input type="number" class="form-input" style="text-align:center;font-size:1rem;padding:6px;font-weight:700" min="3" max="18" data-edicao-atributo="${key}" value="${propostaAtributos[key]}">`)).join('');
      let ajudaMetodo = 'Informe os valores originais para redistribuí-los.';
      if (metodo === 'standard') {
        controles = selecaoPorValores(STANDARD_ARRAY);
        ajudaMetodo = 'Atribua cada valor do Conjunto Padrão uma vez: 15, 14, 13, 12, 10 e 8.';
      } else if (metodo === 'pointbuy') {
        const custoAtual = Object.values(propostaAtributos).reduce((total, valor) => total + (POINT_BUY_CUSTOS[valor] ?? 0), 0);
        const restante = POINT_BUY_TOTAL - custoAtual;
        controles = ATRIBUTOS_KEYS.map(key => {
          const base = propostaAtributos[key];
          const proximoCusto = POINT_BUY_CUSTOS[base + 1] ?? Infinity;
          const podeAumentar = base < 15 && custoAtual - (POINT_BUY_CUSTOS[base] ?? 0) + proximoCusto <= POINT_BUY_TOTAL;
          return caixaAtributo(key, `<div class="counter" style="justify-content:center;margin:4px 0">
            <button class="counter-btn" data-edicao-pointbuy="${key}" data-dir="-1" ${base <= 8 ? 'disabled' : ''}>-</button>
            <span style="font-weight:700;min-width:24px;text-align:center">${base}</span>
            <button class="counter-btn" data-edicao-pointbuy="${key}" data-dir="1" ${!podeAumentar ? 'disabled' : ''}>+</button>
          </div>
          <div style="font-size:0.65rem;color:var(--text-muted)">custo: ${POINT_BUY_CUSTOS[base] ?? 0}</div>`);
        }).join('');
        ajudaMetodo = `Pontos restantes: <strong>${restante}</strong> / ${POINT_BUY_TOTAL}. Valores permitidos: 8 a 15.`;
      } else if (metodo === 'rolagem') {
        const rolados = Object.values(cfg.rolagens || cfg.valoresBase || propostaAtributos);
        controles = selecaoPorValores(rolados);
        ajudaMetodo = `Resultados da rolagem preservados: ${rolados.join(', ')}. Redistribua-os entre os atributos; não é possível rolar novamente.`;
      } else if (metodo === 'manual') {
        controles = selecaoPorValores(Object.values(cfg.valoresBase || propostaAtributos));
        ajudaMetodo = 'Redistribua somente os seis valores informados na criação.';
      }
      return navegacao + `
        <div class="info-box info" style="font-size:0.8rem;margin-bottom:10px">${ajudaMetodo} Ganhos de nível permanecem preservados ao reverter.</div>
        ${!metodo ? `<div class="form-group"><label class="form-label">Método usado na criação</label><select id="edicao-metodo-atributos" class="form-input"><option value="">-- Selecionar --</option><option value="standard">Conjunto Padrão</option><option value="pointbuy">Compra de Pontos</option><option value="rolagem">Rolagem 4d6</option><option value="manual">Valores Manuais</option></select></div>` : `<div class="form-group"><label class="form-label">Método usado na criação</label><select class="form-input" disabled><option>${escHtml({ standard: 'Conjunto Padrão', pointbuy: 'Compra de Pontos', rolagem: 'Rolagem 4d6', manual: 'Valores Manuais' }[metodo] || metodo)}</option></select></div>`}
        <div class="atributos-grid atributos-grid-edicao">${controles}</div>
        ${atributosEstaoEditados() ? '<button class="btn btn-sm btn-secondary mt-1" data-reverter-atributos>Reverter distribuição de atributos</button>' : ''}`;
    }
    if (secao === 'pericias') {
      const limite = (char.pericias_proficientes || []).length;
      return navegacao + `<div class="info-box info" style="font-size:0.8rem;margin-bottom:10px">Mantenha ${limite} proficiência(s). Especializações continuam exigindo proficiência.</div><div style="max-height:45vh;overflow:auto">${PERICIAS.map(p => `<label class="form-check" style="justify-content:flex-start;margin:0 0 6px"><input type="checkbox" data-edicao-pericia="${escHtml(p.nome)}" ${(char.pericias_proficientes || []).includes(p.nome) ? 'checked' : ''}> ${rotuloPericia(p.nome)}${(char.pericias_expertise || []).includes(p.nome) ? ' (Especialização)' : ''}</label>`).join('')}</div>${campoEstaEditado('pericias_proficientes') ? '<button class="btn btn-sm btn-secondary mt-1" data-reverter-campo="pericias_proficientes">Reverter perícias</button>' : ''}`;
    }
    const campos = [
      { key: 'aparencia', label: 'Aparência' }, { key: 'personalidade', label: 'Personalidade' }, { key: 'ideais', label: 'Ideais' }, { key: 'lacos', label: 'Laços' }, { key: 'defeitos', label: 'Defeitos' }, { key: 'historia_personagem', label: 'História' }, { key: 'notas', label: 'Notas' }
    ];
    const alinhamentos = ['', 'Ordeiro e Bom', 'Neutro e Bom', 'Caótico e Bom', 'Ordeiro e Neutro', 'Neutro', 'Caótico e Neutro', 'Ordeiro e Mau', 'Neutro e Mau', 'Caótico e Mau'];
    const inicialImagem = escHtml((char.nome || char.classe || '?').charAt(0).toUpperCase() || '?');
    return navegacao + `
      <div class="form-group">
        <label class="form-label">Nome${seloEdicao('nome')}</label>
        <input class="form-input" data-edicao-identidade="nome" value="${escHtml(char.nome || '')}">
        ${campoEstaEditado('nome') ? '<button class="btn btn-sm btn-secondary" data-reverter-campo="nome">Reverter</button>' : ''}
      </div>
      <div class="form-group">
        <label class="form-label">Imagem${seloEdicao('imagem')}</label>
        <div style="display:flex;align-items:center;gap:10px">
          <div class="char-avatar" id="edicao-imagem-preview" style="width:56px;height:56px;font-size:1.4rem">${imagemPendente ? `<img src="${imagemPendente}" alt="">` : inicialImagem}</div>
          <button type="button" class="btn btn-sm btn-secondary" id="edicao-imagem-btn">Trocar foto</button>
          <button type="button" class="btn btn-sm btn-danger" id="edicao-imagem-remover" style="${imagemPendente ? '' : 'display:none'}">&times;</button>
          <input type="file" accept="image/*" id="edicao-imagem-input" style="display:none">
        </div>
        ${campoEstaEditado('imagem') ? '<button class="btn btn-sm btn-secondary" data-reverter-campo="imagem">Reverter</button>' : ''}
      </div>
      <div class="form-group">
        <label class="form-label">Alinhamento${seloEdicao('alinhamento')}</label>
        <select class="form-input" data-edicao-identidade="alinhamento">${alinhamentos.map(valor => `<option value="${escHtml(valor)}" ${char.alinhamento === valor ? 'selected' : ''}>${valor || '— Nenhum —'}</option>`).join('')}</select>
        ${campoEstaEditado('alinhamento') ? '<button class="btn btn-sm btn-secondary" data-reverter-campo="alinhamento">Reverter</button>' : ''}
      </div>
      <div class="section-divider"><span>Detalhes pessoais</span></div>
      ${campos.map(c => `<div class="form-group"><label class="form-label">${c.label}${seloEdicao(c.key)}</label><textarea class="form-textarea" rows="2" data-edicao-detalhe="${c.key}">${escHtml(char[c.key] || '')}</textarea>${campoEstaEditado(c.key) ? `<button class="btn btn-sm btn-secondary" data-reverter-campo="${c.key}">Reverter</button>` : ''}</div>`).join('')}`;
  };
  const abrir = () => {
    abrirModal('Editar ficha', `<div id="edicao-ficha-corpo">${render()}</div>`, '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-primary" id="btn-salvar-edicao-ficha">Salvar</button>');
    vincular();
  };
  const vincular = () => {
    document.querySelectorAll('[data-edicao-secao]').forEach(btn => btn.addEventListener('click', () => {
      secao = btn.dataset.edicaoSecao;
      const corpo = document.getElementById('edicao-ficha-corpo');
      if (corpo) { corpo.innerHTML = render(); vincular(); }
    }));
    document.querySelectorAll('[data-edicao-atributo]').forEach(input => input.addEventListener('change', () => {
      const metodo = char.configuracao_criacao?.atributos?.metodo || '';
      if (metodo === 'standard' || metodo === 'rolagem' || metodo === 'manual') {
        const valores = metodo === 'standard'
          ? STANDARD_ARRAY
          : Object.values(char.configuracao_criacao?.atributos?.rolagens || char.configuracao_criacao?.atributos?.valoresBase || propostaAtributos);
        propostaAtributos[input.dataset.edicaoAtributo] = valores[parseInt(input.value)];
        const corpo = document.getElementById('edicao-ficha-corpo');
        if (corpo) { corpo.innerHTML = render(); vincular(); }
      } else {
        propostaAtributos[input.dataset.edicaoAtributo] = parseInt(input.value);
      }
    }));
    document.querySelectorAll('[data-edicao-pointbuy]').forEach(btn => btn.addEventListener('click', () => {
      const key = btn.dataset.edicaoPointbuy;
      propostaAtributos[key] += parseInt(btn.dataset.dir);
      const corpo = document.getElementById('edicao-ficha-corpo');
      if (corpo) { corpo.innerHTML = render(); vincular(); }
    }));
    document.getElementById('edicao-imagem-btn')?.addEventListener('click', () => document.getElementById('edicao-imagem-input')?.click());
    document.getElementById('edicao-imagem-input')?.addEventListener('change', async event => {
      const arquivo = event.target.files?.[0];
      event.target.value = '';
      if (!arquivo) return;
      const dataUrl = await processarImagemArquivo(arquivo, 300);
      if (!dataUrl) { toast('Não foi possível processar essa imagem.', 'error'); return; }
      imagemPendente = dataUrl;
      const preview = document.getElementById('edicao-imagem-preview');
      if (preview) preview.innerHTML = `<img src="${dataUrl}" alt="">`;
      const remover = document.getElementById('edicao-imagem-remover');
      if (remover) remover.style.display = '';
    });
    document.getElementById('edicao-imagem-remover')?.addEventListener('click', () => {
      imagemPendente = '';
      const preview = document.getElementById('edicao-imagem-preview');
      if (preview) preview.textContent = (char.nome || char.classe || '?').charAt(0).toUpperCase() || '?';
      const remover = document.getElementById('edicao-imagem-remover');
      if (remover) remover.style.display = 'none';
    });
    document.querySelector('[data-reverter-atributos]')?.addEventListener('click', () => {
      consolidarEdicoesAtributos(char);
      const mudouBase = reverterEdicao(char, 'atributos_base');
      const mudouTotal = reverterEdicao(char, 'atributos');
      if (mudouBase || mudouTotal) { salvar(); window.fecharModal(); renderFichaCompleta(); toast('Distribuição de atributos restaurada.', 'success'); }
    });
    document.querySelectorAll('[data-reverter-campo]').forEach(btn => btn.addEventListener('click', () => {
      if (reverterEdicao(char, btn.dataset.reverterCampo)) { salvar(); window.fecharModal(); renderFichaCompleta(); toast('Campo restaurado.', 'success'); }
    }));
    document.getElementById('btn-salvar-edicao-ficha')?.addEventListener('click', () => {
      if (secao === 'atributos') {
        const metodo = char.configuracao_criacao?.atributos?.metodo || document.getElementById('edicao-metodo-atributos')?.value;
        if (!metodo) { toast('Informe o método de criação.', 'error'); return; }
        const proposta = { ...propostaAtributos };
        if (Object.values(proposta).some(v => !Number.isInteger(v))) { toast('Informe todos os atributos.', 'error'); return; }
        if (!char.configuracao_criacao) char.configuracao_criacao = {};
        if (!char.configuracao_criacao.atributos) char.configuracao_criacao.atributos = {};
        if (!char.configuracao_criacao.atributos.valoresBase) char.configuracao_criacao.atributos.valoresBase = { ...char.atributos_base };
        if (!char.configuracao_criacao.atributos.rolagens && metodo === 'rolagem') char.configuracao_criacao.atributos.rolagens = { ...char.atributos_base };
        char.configuracao_criacao.atributos.metodo = metodo;
        const resultado = validarAtributosEditados(char, proposta, { STANDARD_ARRAY, POINT_BUY_CUSTOS, POINT_BUY_TOTAL });
        if (!resultado.ok) { toast(resultado.erro, 'error'); return; }
        const atributosPropostos = Object.fromEntries(ATRIBUTOS_KEYS.map(k => {
          const bonus = char.bonus_antecedente?.[k] || 0;
          const ganhoSistema = (char.atributos?.[k] || 0) - (char.atributos_base?.[k] || 0) - bonus;
          return [k, proposta[k] + bonus + ganhoSistema];
        }));
        if (Object.values(atributosPropostos).some(valor => valor > 20)) { toast('Nenhum atributo pode ultrapassar 20.', 'error'); return; }
        consolidarEdicoesAtributos(char);
        const mudouBase = ATRIBUTOS_KEYS.some(k => char.atributos_base?.[k] !== proposta[k]);
        const mudouTotal = ATRIBUTOS_KEYS.some(k => char.atributos?.[k] !== atributosPropostos[k]);
        if (mudouBase || mudouTotal) {
          aplicarEdicao(char, 'atributos_base', proposta);
          aplicarEdicao(char, 'atributos', atributosPropostos);
          consolidarEdicoesAtributos(char);
        }
      } else if (secao === 'pericias') {
        const proposta = [...document.querySelectorAll('[data-edicao-pericia]:checked')].map(el => el.dataset.edicaoPericia);
        const resultado = validarListaUnica(proposta, new Set(PERICIAS.map(p => p.nome)), (char.pericias_proficientes || []).length, 'Perícias');
        if (!resultado.ok) { toast(resultado.erro, 'error'); return; }
        if ((char.pericias_expertise || []).some(p => !proposta.includes(p))) { toast('Não remova uma perícia com Especialização.', 'error'); return; }
        aplicarEdicao(char, 'pericias_proficientes', proposta);
      } else if (secao === 'detalhes') {
        const nome = document.querySelector('[data-edicao-identidade="nome"]')?.value?.trim();
        aplicarEdicao(char, 'nome', nome || char.nome);
        aplicarEdicao(char, 'alinhamento', document.querySelector('[data-edicao-identidade="alinhamento"]')?.value || '');
        aplicarEdicao(char, 'imagem', imagemPendente);
        document.querySelectorAll('[data-edicao-detalhe]').forEach(el => aplicarEdicao(char, el.dataset.edicaoDetalhe, el.value));
      } else {
        window.fecharModal();
        return;
      }
      salvar(); window.fecharModal(); window.definirTituloHeader?.(char.nome); renderFichaCompleta(); toast('Alterações salvas.', 'success');
    });
  };
  abrir();
}

export function setupEventosEdicao() {
  document.getElementById('btn-editar-ficha')?.addEventListener('click', () => abrirModalEdicaoFicha());
  // Editar detalhes pessoais
  document.getElementById('btn-edit-detalhes')?.addEventListener('click', () => {
    const campos = [
      { key: 'aparencia', label: 'Aparencia' },
      { key: 'personalidade', label: 'Personalidade' },
      { key: 'ideais', label: 'Ideais' },
      { key: 'lacos', label: 'Lacos' },
      { key: 'defeitos', label: 'Defeitos' },
      { key: 'historia_personagem', label: 'Historia do Personagem' },
      { key: 'notas', label: 'Notas' }
    ];
    abrirModal('Editar Detalhes', `
      ${campos.map(c => `
        <div class="form-group">
          <label class="form-label" for="edit-${c.key}">${c.label}</label>
          <textarea class="form-textarea" id="edit-${c.key}" rows="2">${escHtml(char[c.key] || '')}</textarea>
        </div>
      `).join('')}
    `, '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-primary" id="btn-salvar-detalhes">Salvar</button>');

    document.getElementById('btn-salvar-detalhes')?.addEventListener('click', () => {
      campos.forEach(c => {
        aplicarEdicao(char, c.key, document.getElementById(`edit-${c.key}`)?.value || '');
      });
      salvar();
      window.fecharModal();
      renderFichaCompleta();
    });
  });

  // Editar cabeçalho
  document.getElementById('btn-edit-header')?.addEventListener('click', () => {
    abrirModal('Editar Personagem', `
      <div class="form-group">
        <label class="form-label" for="edit-nome">Nome</label>
        <input type="text" class="form-input" id="edit-nome" value="${escHtml(char.nome)}">
      </div>
      <div class="form-group">
        <label class="form-label">Imagem</label>
        <div style="display:flex;align-items:center;gap:10px">
          <div class="char-avatar" id="edit-imagem-preview" style="width:56px;height:56px;font-size:1.4rem">
            ${char.imagem ? `<img src="${char.imagem}" alt="">` : escHtml((char.nome || char.classe || '?').charAt(0).toUpperCase() || '?')}
          </div>
          <button type="button" class="btn btn-sm btn-secondary" id="edit-imagem-btn">Trocar Foto</button>
          <button type="button" class="btn btn-sm btn-danger" id="edit-imagem-remover" title="Remover imagem" style="${char.imagem ? '' : 'display:none'}">&times;</button>
          <input type="file" accept="image/*" id="edit-imagem-input" style="display:none">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label" for="edit-alinhamento">Alinhamento</label>
        <select class="form-input" id="edit-alinhamento">
          <option value="">— Nenhum —</option>
          <option value="Ordeiro e Bom"${char.alinhamento === 'Ordeiro e Bom' ? ' selected' : ''}>Ordeiro e Bom</option>
          <option value="Neutro e Bom"${char.alinhamento === 'Neutro e Bom' ? ' selected' : ''}>Neutro e Bom</option>
          <option value="Caótico e Bom"${char.alinhamento === 'Caótico e Bom' ? ' selected' : ''}>Caótico e Bom</option>
          <option value="Ordeiro e Neutro"${char.alinhamento === 'Ordeiro e Neutro' ? ' selected' : ''}>Ordeiro e Neutro</option>
          <option value="Neutro"${char.alinhamento === 'Neutro' ? ' selected' : ''}>Neutro</option>
          <option value="Caótico e Neutro"${char.alinhamento === 'Caótico e Neutro' ? ' selected' : ''}>Caótico e Neutro</option>
          <option value="Ordeiro e Mau"${char.alinhamento === 'Ordeiro e Mau' ? ' selected' : ''}>Ordeiro e Mau</option>
          <option value="Neutro e Mau"${char.alinhamento === 'Neutro e Mau' ? ' selected' : ''}>Neutro e Mau</option>
          <option value="Caótico e Mau"${char.alinhamento === 'Caótico e Mau' ? ' selected' : ''}>Caótico e Mau</option>
        </select>
      </div>
      <div class="row gap-1">
        <div class="col">
          <label class="form-label">Nivel</label>
          <div style="font-size:1rem;font-weight:700;padding:6px;background:var(--surface-variant);border-radius:4px">${char.nivel}</div>
          <div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px">Use Subir de Nível para alterar</div>
        </div>
        <div class="col">
          <label class="form-label">Subclasse</label>
          <div style="font-size:1rem;font-weight:700;padding:6px;background:var(--surface-variant);border-radius:4px">${escHtml(char.subclasse) || '—'}</div>
          <div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px">Definida ao subir de nível</div>
        </div>
      </div>
      <div class="section-divider mt-2"><span>Atributos</span></div>
      <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:8px">
        Atributos são definidos na criação e alterados ao subir de nível (Aumento de Atributo). Não podem ser editados livremente.
      </div>
      <div class="atributos-grid">
        ${ATRIBUTOS_KEYS.map(key => `
          <div class="form-group" style="text-align:center">
            <label class="form-label">${ATRIBUTOS_NOMES[key]}</label>
            <div style="font-size:1.1rem;font-weight:700;padding:6px;background:var(--surface-variant);border-radius:4px">${char.atributos[key]}</div>
          </div>
        `).join('')}
      </div>
    `, '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-primary" id="btn-salvar-edit">Salvar</button>');

    const editImagemInicial = () => (char.nome || char.classe || '?').charAt(0).toUpperCase() || '?';

    document.getElementById('edit-imagem-btn')?.addEventListener('click', () => {
      document.getElementById('edit-imagem-input')?.click();
    });

    document.getElementById('edit-imagem-input')?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      const dataUrl = await processarImagemArquivo(file, 300);
      if (!dataUrl) {
        toast('Não foi possível processar essa imagem', 'error');
        return;
      }
      char.imagem = dataUrl;
      const preview = document.getElementById('edit-imagem-preview');
      if (preview) preview.innerHTML = `<img src="${dataUrl}" alt="">`;
      const btnRemover = document.getElementById('edit-imagem-remover');
      if (btnRemover) btnRemover.style.display = '';
    });

    document.getElementById('edit-imagem-remover')?.addEventListener('click', () => {
      char.imagem = '';
      const preview = document.getElementById('edit-imagem-preview');
      if (preview) preview.textContent = editImagemInicial();
      const btnRemover = document.getElementById('edit-imagem-remover');
      if (btnRemover) btnRemover.style.display = 'none';
    });

    document.getElementById('btn-salvar-edit')?.addEventListener('click', () => {
      aplicarEdicao(char, 'nome', document.getElementById('edit-nome')?.value?.trim() || char.nome);
      aplicarEdicao(char, 'alinhamento', document.getElementById('edit-alinhamento')?.value || '');

      salvar();
      window.fecharModal();
      window.definirTituloHeader?.(char.nome);
      renderFichaCompleta();
    });
  });

  // Editar XP
  document.getElementById('xp-display')?.addEventListener('click', () => {
    abrirModal('Gerenciar Pontos de Experiência', `
      <div class="form-group">
        <label class="form-label" for="edit-xp-atual">XP Atual</label>
        <input type="number" class="form-input" id="edit-xp-atual" value="${char.xp || 0}" min="0">
        <div style="font-size:0.8rem;color:var(--text-muted);margin-top:4px">
          Nível Atual: ${char.nivel}${char.nivel < 20 ? ` | Próximo Nível (${char.nivel + 1}): ${XP_POR_NIVEL[char.nivel + 1]} XP` : ' (Máximo)'}
        </div>
      </div>
      <div class="section-divider mt-2"><span>Adicionar XP</span></div>
      <div class="form-group">
        <label class="form-label" for="add-xp">Ganhar XP</label>
        <input type="number" class="form-input" id="add-xp" placeholder="Quantidade de XP para adicionar" min="0">
      </div>
    `, '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-primary" id="btn-salvar-xp">Salvar</button>');

    document.getElementById('btn-salvar-xp')?.addEventListener('click', () => {
      const novoXP = parseInt(document.getElementById('edit-xp-atual')?.value) || 0;
      const addXP = parseInt(document.getElementById('add-xp')?.value) || 0;
      
      char.xp = novoXP + addXP;
      
      salvar();
      window.fecharModal();
      
      // Verificar se pode subir de nível
      if (podeSubirDeNivel(char)) {
        toast(`XP atualizado! Você pode subir para o nível ${char.nivel + 1}!`, 'success');
      } else {
        toast('XP atualizado com sucesso!', 'success');
      }
      
      renderFichaCompleta();
    });
  });

  // Level Up
  document.getElementById('btn-levelup')?.addEventListener('click', async () => {
    await abrirModalLevelUp();
  });
}

// Modal de subir de nivel - delega para o sistema de cards dinamicos
async function abrirModalLevelUp() {
  if (!obterFlagLevelUpFlowV2()) {
    const html = `
      <div style="display:flex;flex-direction:column;gap:10px;font-size:0.9rem">
        <div>O fluxo de <strong>Level Up V2</strong> está desativado pela feature flag de migração.</div>
        <div style="font-size:0.85rem;color:var(--text-muted)">
          Chave local: <code>${LEVELUP_FLOW_V2_STORAGE_KEY}</code>
        </div>
      </div>
    `;
    abrirModal(
      'Level Up V2 desativado',
      html,
      '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>' +
      '<button class="btn btn-accent" id="btn-enable-levelup-v2">Ativar V2 e continuar</button>'
    );

    document.getElementById('btn-enable-levelup-v2')?.addEventListener('click', async () => {
      salvarFlagLevelUpFlowV2(true);
      window.fecharModal?.();
      await abrirModalLevelUp();
    });
    return;
  }

  const helpers = {
    ehSubclasseConjuradora,
    getSubclasseConjuradoraConjuracao,
    obterMagiasDisponiveisClasseAtual,
    obterListasIniciadoEmMagiaUsadas,
    obterTiposAdeptoElementalUsados,
    achatarMagiasClasse,
    magiaContaNoLimite
  };
  const caches = { talentosCache };
  try {
    await abrirLevelUpCards(char, classeData, helpers, caches, salvar, renderFichaCompleta);
  } catch (err) {
    console.error('Falha ao abrir fluxo de level up V2:', err);
    toast('Não foi possível abrir o fluxo de level up. Tente novamente.', 'error');
  }
}
