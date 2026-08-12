// ============================================================
// Passo 4: atributos e pericias
//
// Os quatro metodos de distribuicao: rolagem 4d6, array padrao,
// compra por pontos e manual, mais a escolha das pericias da classe (ver
// renderPericiasSeletor, no fim do arquivo, para o porque de ela ficar aqui
// e nao antes do antecedente).
// Extraido de site/js/pages/creator.js sem alteracao de comportamento.
// ============================================================
import { ATRIBUTOS_KEYS, ATRIBUTOS_NOMES, ATRIBUTO_NOME_PARA_KEY, CLASSES_INFO, PERICIAS, POINT_BUY_CUSTOS, POINT_BUY_TOTAL, STANDARD_ARRAY } from '../dados-classes.js';
import { bonusProficiencia, calcMod, fmtMod } from '../utils.js';
import { consolidarPericiasProficientes, periciasDeOutrasFontes } from './comum.js';
import { dadosCache, personagem } from './wizard.js';

// Renderiza a distribuicao de atributos inline (abaixo do grid de antecedentes)
export function renderDistribuicaoInline() {
  const distEl = document.getElementById('antecedente-distribuicao');
  if (!distEl) return;

  const ant = dadosCache.antecedentes.find(a => a.nome === personagem.antecedente);
  if (!ant) return;

  const atributosDisponiveis = ant.valores_atributo.split(',').map(a => a.trim()).filter(Boolean);

  distEl.innerHTML = `
    <div class="card">
      <div class="section-divider"><span>Distribuicao de Atributos</span></div>
      <div class="info-box info">Distribua +2 e +1 entre os atributos listados, ou +1/+1/+1.</div>
      <div style="display:flex;gap:8px;margin-bottom:12px">
        <label class="form-check">
          <input type="radio" name="dist-mode" value="2-1" checked> +2 / +1
        </label>
        <label class="form-check">
          <input type="radio" name="dist-mode" value="1-1-1"> +1 / +1 / +1
        </label>
      </div>
      <div id="dist-atributos"></div>
    </div>
  `;

  renderDistribuicaoAtributos(atributosDisponiveis);

  distEl.querySelectorAll('[name="dist-mode"]').forEach(radio => {
    radio.addEventListener('change', () => {
      renderDistribuicaoAtributos(atributosDisponiveis);
    });
  });
}

function renderDistribuicaoAtributos(atributos) {
  const distEl = document.getElementById('dist-atributos');
  if (!distEl) return;

  const modo = document.querySelector('[name="dist-mode"]:checked')?.value || '2-1';

  if (modo === '2-1') {
    // Função para atualizar opções disponíveis excluindo a seleção do outro dropdown
    const buildOptions = (selected, exclude) => {
      return atributos.map(a => {
        const disabled = a === exclude ? 'disabled' : '';
        const sel = a === selected ? 'selected' : '';
        return `<option value="${a}" ${sel} ${disabled}>${a}${disabled ? ' (já selecionado)' : ''}</option>`;
      }).join('');
    };

    const bonus2Atual = dadosCache.bonus2 || '';
    const bonus1Atual = dadosCache.bonus1 || '';

    distEl.innerHTML = `
      <div class="row gap-1">
        <div class="col">
          <label class="form-label">+2 em:</label>
          <select class="form-select" id="bonus-2">
            <option value="">Selecione</option>
            ${buildOptions(bonus2Atual, bonus1Atual)}
          </select>
        </div>
        <div class="col">
          <label class="form-label">+1 em:</label>
          <select class="form-select" id="bonus-1">
            <option value="">Selecione</option>
            ${buildOptions(bonus1Atual, bonus2Atual)}
          </select>
        </div>
      </div>
    `;

    const sel2 = document.getElementById('bonus-2');
    const sel1 = document.getElementById('bonus-1');

    const atualizar = () => {
      dadosCache.bonus2 = sel2.value;
      dadosCache.bonus1 = sel1.value;

      // Se selecionou o mesmo, limpar o +1
      if (sel1.value && sel1.value === sel2.value) {
        sel1.value = '';
        dadosCache.bonus1 = '';
      }

      // Atualizar opções desabilitadas
      [...sel2.options].forEach(opt => {
        opt.disabled = opt.value && opt.value === sel1.value;
        if (opt.disabled) opt.textContent = opt.value + ' (já selecionado)';
        else opt.textContent = opt.value || 'Selecione';
      });
      [...sel1.options].forEach(opt => {
        opt.disabled = opt.value && opt.value === sel2.value;
        if (opt.disabled) opt.textContent = opt.value + ' (já selecionado)';
        else opt.textContent = opt.value || 'Selecione';
      });

      // Aplicar bônus
      personagem.bonus_antecedente = {};
      if (sel2.value) {
        const key = ATRIBUTO_NOME_PARA_KEY[sel2.value];
        if (key) personagem.bonus_antecedente[key] = 2;
      }
      if (sel1.value && sel1.value !== sel2.value) {
        const key = ATRIBUTO_NOME_PARA_KEY[sel1.value];
        if (key) personagem.bonus_antecedente[key] = 1;
      }
    };

    sel2.addEventListener('change', atualizar);
    sel1.addEventListener('change', atualizar);

    // Aplicar se já tinha seleção
    if (dadosCache.bonus2 || dadosCache.bonus1) atualizar();
  } else {
    // Modo +1/+1/+1
    // Todos os antecedentes atuais oferecem exatamente três atributos elegíveis.
    // Nesse caso, a distribuição é única e deve iniciar integralmente selecionada.
    if (atributos.length === 3) dadosCache.bonus111 = [...atributos];
    distEl.innerHTML = `
      <div class="info-box info">Selecione 3 atributos para receber +1 cada:</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px">
        ${atributos.map(a => `
          <label class="chip ${(dadosCache.bonus111 || []).includes(a) ? 'selected' : ''}" data-attr="${a}">
            <input type="checkbox" style="display:none" value="${a}" ${(dadosCache.bonus111 || []).includes(a) ? 'checked' : ''} ${atributos.length === 3 ? 'disabled' : ''}>
            ${a}
          </label>
        `).join('')}
      </div>
    `;

    distEl.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        if (atributos.length === 3) return;
        const cb = chip.querySelector('input');
        const selecionados = distEl.querySelectorAll('input:checked');
        if (!cb.checked && selecionados.length >= 3) return; // Máximo 3
        cb.checked = !cb.checked;
        chip.classList.toggle('selected', cb.checked);

        dadosCache.bonus111 = [...distEl.querySelectorAll('input:checked')].map(i => i.value);
        personagem.bonus_antecedente = {};
        dadosCache.bonus111.forEach(attr => {
          const key = ATRIBUTO_NOME_PARA_KEY[attr];
          if (key) personagem.bonus_antecedente[key] = 1;
        });
      });
    });

    // Restaurar bonus se ja tinha selecao anterior
    if (dadosCache.bonus111?.length) {
      personagem.bonus_antecedente = {};
      dadosCache.bonus111.forEach(attr => {
        const key = ATRIBUTO_NOME_PARA_KEY[attr];
        if (key) personagem.bonus_antecedente[key] = 1;
      });
    }
  }
}

// ============================================================
// PASSO 4: ATRIBUTOS
// ============================================================
export function renderStepAtributos(el) {
  const info = CLASSES_INFO[personagem.classe];

  el.innerHTML = `
    <h3 style="margin-bottom:12px">Defina seus Atributos</h3>
    <div class="info-box info">
      Bônus de proficiência: +${bonusProficiencia(personagem.nivel)} |
      Atributo primário: ${info?.atributo_primario || 'N/A'}
    </div>

    <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
      <label class="form-check">
        <input type="radio" name="attr-mode" value="standard" ${(!dadosCache.attrMode || dadosCache.attrMode === 'standard') ? 'checked' : ''}> Conjunto Padrão
      </label>
      <label class="form-check">
        <input type="radio" name="attr-mode" value="pointbuy" ${dadosCache.attrMode === 'pointbuy' ? 'checked' : ''}> Compra de Pontos
      </label>
      <label class="form-check">
        <input type="radio" name="attr-mode" value="rolagem" ${dadosCache.attrMode === 'rolagem' ? 'checked' : ''}> Rolagem 4d6
      </label>
      <label class="form-check" style="opacity:0.5;cursor:not-allowed" title="Opção desabilitada">
        <input type="radio" name="attr-mode" value="manual" disabled> Manual
      </label>
    </div>

    <div id="attr-content"></div>

    <div class="section-divider mt-2"><span>Perícias da Classe</span></div>
    <div class="info-box info">
      Escolha ${info?.num_pericias || 2} perícias da classe.
      ${dadosCache.pericias_antecedente?.length ? `<br>Já possui do antecedente: <strong>${dadosCache.pericias_antecedente.join(', ')}</strong>` : ''}
      ${personagem.pericia_especie ? `<br>Já possui da espécie: <strong>${personagem.pericia_especie}</strong>` : ''}
      ${(personagem.pericias_especie?.length) ? `<br>Já possui da espécie (Kenku): <strong>${personagem.pericias_especie.join(', ')}</strong>` : ''}
      ${(() => {
        const pTalento = [];
        if (personagem.escolhas_talento) {
          ['antecedente', 'versatil'].forEach(ctx => {
            (personagem.escolhas_talento[ctx] || []).forEach(e => {
              if (PERICIAS.some(p => p.nome === e)) pTalento.push(e);
            });
          });
        }
        return pTalento.length ? `<br>Já possui dos talentos: <strong>${pTalento.join(', ')}</strong>` : '';
      })()}
    </div>
    <div id="pericias-content"></div>
  `;

  // Se o modo salvo era 'manual' (agora desabilitado), resetar para 'standard'
  if (dadosCache.attrMode === 'manual') dadosCache.attrMode = 'standard';

  const renderAttr = () => {
    const modo = document.querySelector('[name="attr-mode"]:checked')?.value || 'standard';
    dadosCache.attrMode = modo;
    const attrEl = document.getElementById('attr-content');
    switch (modo) {
      case 'standard': renderStandardArray(attrEl); break;
      case 'pointbuy': renderPointBuy(attrEl); break;
      case 'rolagem': renderRolagem4d6(attrEl); break;
      case 'manual': renderManual(attrEl); break;
    }
  };

  el.querySelectorAll('[name="attr-mode"]').forEach(r => r.addEventListener('change', renderAttr));
  renderAttr();
  renderPericiasSeletor();
}

// Seletor das perícias da classe.
//
// Fica DEPOIS do antecedente e da espécie de propósito: as duas perícias do
// antecedente são fixas (não são escolha) e em 63% das combinações classe x
// antecedente caem dentro da lista da classe. Escolher antes de conhecê-las
// produzia proficiência duplicada -- História vinda da classe e do Nobre ao
// mesmo tempo, com uma das duas escolhas da classe virando desperdício.
// Escolhendo aqui, com tudo já sabido, a lista só oferece o que ainda vale
// alguma coisa.
//
// O que garante que ainda sobram opções suficientes é a reserva feita nas
// escolhas livres (Habilidoso, Hábil, Memória Kenku) -- ver
// periciasReservadasParaClasse em comum.js. Sem ela esta lista podia esvaziar
// abaixo do exigido e o passo nunca validava: o beco sem saída que originou
// esta correção (Clérigo + Nobre + Habilidoso em Intuição e Religião deixava
// só Medicina para 2 escolhas).
function renderPericiasSeletor() {
  const info = CLASSES_INFO[personagem.classe];
  const el = document.getElementById('pericias-content');
  if (!el || !info) return;

  const jaTem = periciasDeOutrasFontes();
  const opcoesClasse = info.pericias_opcoes || PERICIAS.map(p => p.nome);
  const disponiveis = opcoesClasse.filter(p => !jaTem.includes(p));

  // Inicializar seleção se não tiver
  if (!dadosCache.pericias_classe_sel) {
    dadosCache.pericias_classe_sel = [];
  }
  const maxSel = info.num_pericias;
  dadosCache.pericias_classe_sel = [...new Set(dadosCache.pericias_classe_sel)]
    .filter(pericia => disponiveis.includes(pericia))
    .slice(0, maxSel);

  el.innerHTML = `
    <div style="display:flex;flex-wrap:wrap;gap:6px">
      ${disponiveis.map(p => {
        const sel = dadosCache.pericias_classe_sel.includes(p);
        const desabilitada = !sel && dadosCache.pericias_classe_sel.length >= maxSel;
        return `<label class="chip ${sel ? 'selected' : ''}" data-pericia="${p}">
          <input type="checkbox" style="display:none" value="${p}" ${sel ? 'checked' : ''} ${desabilitada ? 'disabled' : ''}>
          ${p}
        </label>`;
      }).join('')}
    </div>
    <div style="font-size:0.8rem;color:var(--text-muted);margin-top:6px">
      Selecionadas: ${dadosCache.pericias_classe_sel.length}/${maxSel}
    </div>
  `;

  const atualizarEstado = () => {
    const selecionadas = [...el.querySelectorAll('input:checked')].map(input => input.value);
    dadosCache.pericias_classe_sel = selecionadas;
    consolidarPericiasProficientes();
    const limiteAtingido = selecionadas.length >= maxSel;
    el.querySelectorAll('.chip').forEach(chip => {
      const cb = chip.querySelector('input');
      const desabilitada = limiteAtingido && !cb.checked;
      cb.disabled = desabilitada;
      chip.classList.toggle('selected', cb.checked);
      chip.classList.toggle('disabled', desabilitada);
      chip.style.opacity = desabilitada ? '0.5' : '';
      chip.style.cursor = desabilitada ? 'not-allowed' : '';
    });
    const contador = el.querySelector('div:last-child');
    if (contador) contador.textContent = `Selecionadas: ${selecionadas.length}/${maxSel}`;
  };

  el.querySelectorAll('.chip input').forEach(cb => cb.addEventListener('change', atualizarEstado));
  atualizarEstado();
}

// Rola 4d6 e descarta o menor dado
function rolar4d6() {
  const dados = Array.from({ length: 4 }, () => Math.floor(Math.random() * 6) + 1);
  dados.sort((a, b) => a - b);
  const descartado = dados.shift(); // remove o menor
  return { total: dados.reduce((s, d) => s + d, 0), dados: [descartado, ...dados], descartado };
}

function renderRolagem4d6(el) {
  const info = CLASSES_INFO[personagem.classe];

  // Inicializar valores de rolagem se necessário
  if (!dadosCache.rolagemValores) {
    dadosCache.rolagemValores = {};
    dadosCache.rolagemDados = {};
  }

  // Verificar se já tem valores rolados para atribuir
  const valoresRolados = Object.values(dadosCache.rolagemValores);
  const todosRolados = ATRIBUTOS_KEYS.every(k => dadosCache.rolagemValores[k] !== undefined);

  // Montar distribuição: se usou assign mode
  if (!dadosCache.rolagemAssign) dadosCache.rolagemAssign = {};
  const usados = Object.values(dadosCache.rolagemAssign);

  el.innerHTML = `
    <div class="info-box info">
      Role 4d6 para cada atributo e descarte o menor dado. Clique em "Rolar" para gerar valores.
    </div>
    <div style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap">
      <button class="btn btn-sm btn-accent" id="btn-rolar-todos">Rolar Todos</button>
      <button class="btn btn-sm btn-secondary" id="btn-limpar-rolagem">Limpar</button>
    </div>
    <div class="atributos-grid">
      ${ATRIBUTOS_KEYS.map(key => {
        const nome = ATRIBUTOS_NOMES[key];
        const rolagemInfo = dadosCache.rolagemDados[key];
        const valorBase = dadosCache.rolagemValores[key];
        const bonus = personagem.bonus_antecedente[key] || 0;
        const valorFinal = valorBase !== undefined ? valorBase + bonus : null;
        const mod = valorFinal !== null ? calcMod(valorFinal) : null;
        const ehPrimario = info?.atributo_primario?.includes(nome);

        // Mostrar dados rolados
        let dadosHtml = '';
        if (rolagemInfo) {
          dadosHtml = rolagemInfo.dados.map((d, i) =>
            `<span style="display:inline-block;width:22px;height:22px;line-height:22px;text-align:center;border-radius:4px;font-size:0.75rem;font-weight:700;${i === 0 ? 'background:#fee;color:#c00;text-decoration:line-through;opacity:0.5' : 'background:var(--bg-tertiary);color:var(--text-primary)'}">${d}</span>`
          ).join(' ');
        }

        return `
          <div class="atributo-box ${ehPrimario ? 'destaque' : ''}" data-key="${key}">
            <div class="atributo-nome">${nome}${ehPrimario ? ' *' : ''}</div>
            <button class="btn btn-sm ${valorBase !== undefined ? 'btn-secondary' : 'btn-primary'}" data-rolar-key="${key}" style="margin:4px 0;font-size:0.75rem">
              ${valorBase !== undefined ? 'Re-rolar' : 'Rolar'}
            </button>
            ${dadosHtml ? `<div style="display:flex;gap:2px;justify-content:center;margin:2px 0">${dadosHtml}</div>` : ''}
            ${bonus > 0 ? `<div style="font-size:0.7rem;color:var(--success)">+${bonus} antec.</div>` : ''}
            ${valorFinal !== null ? `
              <div class="atributo-mod">${fmtMod(mod)}</div>
              <div class="atributo-valor">${valorFinal}</div>
            ` : '<div class="atributo-mod" style="color:var(--text-muted)">--</div>'}
          </div>`;
      }).join('')}
    </div>
  `;

  // Evento: rolar individual
  el.querySelectorAll('[data-rolar-key]').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.rolarKey;
      const resultado = rolar4d6();
      dadosCache.rolagemValores[key] = resultado.total;
      dadosCache.rolagemDados[key] = resultado;

      // Atualizar atributos do personagem
      personagem.atributos_base[key] = resultado.total;
      personagem.atributos[key] = resultado.total + (personagem.bonus_antecedente[key] || 0);
      renderRolagem4d6(el);
    });
  });

  // Evento: rolar todos
  document.getElementById('btn-rolar-todos')?.addEventListener('click', () => {
    ATRIBUTOS_KEYS.forEach(key => {
      const resultado = rolar4d6();
      dadosCache.rolagemValores[key] = resultado.total;
      dadosCache.rolagemDados[key] = resultado;
      personagem.atributos_base[key] = resultado.total;
      personagem.atributos[key] = resultado.total + (personagem.bonus_antecedente[key] || 0);
    });
    renderRolagem4d6(el);
  });

  // Evento: limpar
  document.getElementById('btn-limpar-rolagem')?.addEventListener('click', () => {
    dadosCache.rolagemValores = {};
    dadosCache.rolagemDados = {};
    dadosCache.rolagemAssign = {};
    ATRIBUTOS_KEYS.forEach(key => {
      personagem.atributos_base[key] = 10;
      personagem.atributos[key] = 10 + (personagem.bonus_antecedente[key] || 0);
    });
    renderRolagem4d6(el);
  });
}

// Distribuicoes sugeridas de atributos padrao por classe.
// IMPORTANTE: os valores abaixo sao INDICES do STANDARD_ARRAY, nao os atributos finais.
// Mapeamento de indice -> valor: 0->15, 1->14, 2->13, 3->12, 4->10, 5->8.
// Exemplo: { forca: 0, destreza: 2 } significa Forca 15 e Destreza 13.
// Conforme tabela "Conjunto Padrao por Classe" do Livro do Jogador 2024 (cap.2)
const DISTRIBUICOES_SUGERIDAS = {
  'Bárbaro':    { forca: 0, destreza: 2, constituicao: 1, inteligencia: 4, sabedoria: 3, carisma: 5 },  // For15 Des13 Con14 Int10 Sab12 Car8
  'Bardo':      { forca: 5, destreza: 1, constituicao: 3, inteligencia: 2, sabedoria: 4, carisma: 0 },  // For8  Des14 Con12 Int13 Sab10 Car15
  'Bruxo':      { forca: 5, destreza: 1, constituicao: 2, inteligencia: 3, sabedoria: 4, carisma: 0 },  // For8  Des14 Con13 Int12 Sab10 Car15
  'Clérigo':    { forca: 1, destreza: 5, constituicao: 2, inteligencia: 4, sabedoria: 0, carisma: 3 },  // For14 Des8  Con13 Int10 Sab15 Car12
  'Druida':     { forca: 5, destreza: 3, constituicao: 1, inteligencia: 2, sabedoria: 0, carisma: 4 },  // For8  Des12 Con14 Int13 Sab15 Car10
  'Feiticeiro': { forca: 4, destreza: 2, constituicao: 1, inteligencia: 5, sabedoria: 3, carisma: 0 },  // For10 Des13 Con14 Int8  Sab12 Car15
  'Guardião':   { forca: 3, destreza: 0, constituicao: 2, inteligencia: 5, sabedoria: 1, carisma: 4 },  // For12 Des15 Con13 Int8  Sab14 Car10
  'Guerreiro':  { forca: 0, destreza: 1, constituicao: 2, inteligencia: 5, sabedoria: 4, carisma: 3 },  // For15 Des14 Con13 Int8  Sab10 Car12
  'Ladino':     { forca: 3, destreza: 0, constituicao: 2, inteligencia: 1, sabedoria: 4, carisma: 5 },  // For12 Des15 Con13 Int14 Sab10 Car8
  'Mago':       { forca: 5, destreza: 3, constituicao: 2, inteligencia: 0, sabedoria: 1, carisma: 4 },  // For8  Des12 Con13 Int15 Sab14 Car10
  'Monge':      { forca: 3, destreza: 0, constituicao: 2, inteligencia: 4, sabedoria: 1, carisma: 5 },  // For12 Des15 Con13 Int10 Sab14 Car8
  'Paladino':   { forca: 0, destreza: 4, constituicao: 2, inteligencia: 5, sabedoria: 3, carisma: 1 }   // For15 Des10 Con13 Int8  Sab12 Car14
};

function renderStandardArray(el) {
  const info = CLASSES_INFO[personagem.classe];
  if (!dadosCache.stdAssign) {
    dadosCache.stdAssign = {};
  }

  const usados = Object.values(dadosCache.stdAssign);
  const disponiveis = STANDARD_ARRAY.filter((v, i) => !usados.includes(i));
  const temSugestao = DISTRIBUICOES_SUGERIDAS[personagem.classe];

  el.innerHTML = `
    <div class="info-box warning">Distribua os valores [${STANDARD_ARRAY.join(', ')}] entre seus atributos.</div>
    ${temSugestao ? `
      <button class="btn btn-sm btn-accent" id="btn-dist-sugerida" style="margin-bottom:8px">
        ⚡ Usar distribuição sugerida para ${personagem.classe}
      </button>
    ` : ''}
    <div class="atributos-grid">
      ${ATRIBUTOS_KEYS.map(key => {
        const nome = ATRIBUTOS_NOMES[key];
        const assignIdx = dadosCache.stdAssign[key];
        const valorBase = assignIdx !== undefined ? STANDARD_ARRAY[assignIdx] : null;
        const bonus = personagem.bonus_antecedente[key] || 0;
        const valorFinal = valorBase !== null ? valorBase + bonus : null;
        const mod = valorFinal !== null ? calcMod(valorFinal) : null;
        const ehPrimario = info?.atributo_primario?.includes(nome);

        return `
          <div class="atributo-box ${ehPrimario ? 'destaque' : ''}" data-key="${key}">
            <div class="atributo-nome">${nome}${ehPrimario ? ' *' : ''}</div>
            <select class="form-select" style="font-size:0.85rem;padding:6px;margin:4px 0" data-attr-key="${key}">
              <option value="">--</option>
              ${STANDARD_ARRAY.map((v, i) => {
                const usado = usados.includes(i) && dadosCache.stdAssign[key] !== i;
                return `<option value="${i}" ${usado ? 'disabled' : ''} ${assignIdx === i ? 'selected' : ''}>${v}</option>`;
              }).join('')}
            </select>
            ${bonus > 0 ? `<div style="font-size:0.7rem;color:var(--success)">+${bonus} antec.</div>` : ''}
            ${valorFinal !== null ? `
              <div class="atributo-mod">${fmtMod(mod)}</div>
              <div class="atributo-valor">${valorFinal}</div>
            ` : '<div class="atributo-mod" style="color:var(--text-muted)">--</div>'}
          </div>`;
      }).join('')}
    </div>
  `;

  // Botão de distribuição sugerida
  document.getElementById('btn-dist-sugerida')?.addEventListener('click', () => {
    const dist = DISTRIBUICOES_SUGERIDAS[personagem.classe];
    if (!dist) return;
    dadosCache.stdAssign = { ...dist };
    ATRIBUTOS_KEYS.forEach(k => {
      const idx = dadosCache.stdAssign[k];
      const base = idx !== undefined ? STANDARD_ARRAY[idx] : 10;
      const bonus = personagem.bonus_antecedente[k] || 0;
      personagem.atributos_base[k] = base;
      personagem.atributos[k] = base + bonus;
    });
    renderStandardArray(el);
  });

  el.querySelectorAll('[data-attr-key]').forEach(sel => {
    sel.addEventListener('change', () => {
      const key = sel.dataset.attrKey;
      if (sel.value === '') {
        delete dadosCache.stdAssign[key];
      } else {
        dadosCache.stdAssign[key] = parseInt(sel.value);
      }
      // Atualizar atributos do personagem
      ATRIBUTOS_KEYS.forEach(k => {
        const idx = dadosCache.stdAssign[k];
        const base = idx !== undefined ? STANDARD_ARRAY[idx] : 10;
        const bonus = personagem.bonus_antecedente[k] || 0;
        personagem.atributos_base[k] = base;
        personagem.atributos[k] = base + bonus;
      });
      renderStandardArray(el);
    });
  });
}

function renderPointBuy(el) {
  if (!dadosCache.pbValues) {
    dadosCache.pbValues = {};
    ATRIBUTOS_KEYS.forEach(k => dadosCache.pbValues[k] = 8);
  }

  const custoTotal = ATRIBUTOS_KEYS.reduce((sum, k) => sum + (POINT_BUY_CUSTOS[dadosCache.pbValues[k]] || 0), 0);
  const restante = POINT_BUY_TOTAL - custoTotal;

  el.innerHTML = `
    <div class="info-box ${restante < 0 ? 'warning' : 'info'}">
      Pontos restantes: <strong>${restante}</strong> / ${POINT_BUY_TOTAL}
    </div>
    <div class="atributos-grid">
      ${ATRIBUTOS_KEYS.map(key => {
        const nome = ATRIBUTOS_NOMES[key];
        const base = dadosCache.pbValues[key];
        const bonus = personagem.bonus_antecedente[key] || 0;
        const total = base + bonus;
        const mod = calcMod(total);
        const custo = POINT_BUY_CUSTOS[base] || 0;

        return `
          <div class="atributo-box" data-key="${key}">
            <div class="atributo-nome">${nome}</div>
            <div class="counter" style="justify-content:center;margin:4px 0">
              <button class="counter-btn" data-pb-key="${key}" data-dir="-1" ${base <= 8 ? 'disabled' : ''}>-</button>
              <span style="font-weight:700;min-width:24px;text-align:center">${base}</span>
              <button class="counter-btn" data-pb-key="${key}" data-dir="+1" ${base >= 15 ? 'disabled' : ''}>+</button>
            </div>
            <div style="font-size:0.65rem;color:var(--text-muted)">custo: ${custo}</div>
            ${bonus > 0 ? `<div style="font-size:0.7rem;color:var(--success)">+${bonus}</div>` : ''}
            <div class="atributo-mod">${fmtMod(mod)}</div>
            <div class="atributo-valor">${total}</div>
          </div>`;
      }).join('')}
    </div>
  `;

  el.querySelectorAll('[data-pb-key]').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.pbKey;
      const dir = parseInt(btn.dataset.dir);
      const newVal = dadosCache.pbValues[key] + dir;
      if (newVal < 8 || newVal > 15) return;
      dadosCache.pbValues[key] = newVal;

      // Atualizar personagem
      ATRIBUTOS_KEYS.forEach(k => {
        personagem.atributos_base[k] = dadosCache.pbValues[k];
        personagem.atributos[k] = dadosCache.pbValues[k] + (personagem.bonus_antecedente[k] || 0);
      });
      renderPointBuy(el);
    });
  });
}

function renderManual(el) {
  const info = CLASSES_INFO[personagem.classe];

  el.innerHTML = `
    <div class="info-box info">Insira seus valores manualmente (ex: rolagem de dados). Mínimo: 3 | Máximo: 18</div>
    <div class="atributos-grid">
      ${ATRIBUTOS_KEYS.map(key => {
        const nome = ATRIBUTOS_NOMES[key];
        const base = personagem.atributos_base[key];
        const bonus = personagem.bonus_antecedente[key] || 0;
        const total = base + bonus;
        const mod = calcMod(total);
        const ehPrimario = info?.atributo_primario?.includes(nome);

        return `
          <div class="atributo-box ${ehPrimario ? 'destaque' : ''}">
            <div class="atributo-nome">${nome}${ehPrimario ? ' *' : ''}</div>
            <input type="number" class="form-input" style="text-align:center;font-size:1rem;padding:6px;font-weight:700"
                   value="${base}" min="3" max="18" data-manual-key="${key}">
            ${bonus > 0 ? `<div style="font-size:0.7rem;color:var(--success)">+${bonus}</div>` : ''}
            <div class="atributo-mod">${fmtMod(mod)}</div>
            <div class="atributo-valor">${total}</div>
          </div>`;
      }).join('')}
    </div>
  `;

  el.querySelectorAll('[data-manual-key]').forEach(inp => {
    inp.addEventListener('input', () => {
      const key = inp.dataset.manualKey;
      let val = parseInt(inp.value);
      // Validar limites: mínimo 3, máximo 18
      if (isNaN(val)) val = 10;
      if (val < 3) val = 3;
      if (val > 18) val = 18;
      personagem.atributos_base[key] = val;
      personagem.atributos[key] = val + (personagem.bonus_antecedente[key] || 0);
    });
    // Ao sair do campo, aplicar clamping visual
    inp.addEventListener('blur', () => {
      const key = inp.dataset.manualKey;
      let val = parseInt(inp.value);
      if (isNaN(val) || val < 3) val = 3;
      if (val > 18) val = 18;
      inp.value = val;
      personagem.atributos_base[key] = val;
      personagem.atributos[key] = val + (personagem.bonus_antecedente[key] || 0);
      // Atualizar mod e total exibidos
      renderManual(el);
    });
  });
}
