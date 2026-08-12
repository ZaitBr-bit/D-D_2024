// ============================================================
// Passo 2: escolha de especie
// Extraido de site/js/pages/creator.js sem alteracao de comportamento.
// ============================================================
import { PERICIAS } from '../dados-classes.js';
import { getEspecies, getTalentos } from '../db.js';
import { abrirModal, getDeslocamento, mdParaHtml, toast } from '../utils.js';
import { ESPECIES_TRACOS_ESCOLHA, configurarSelectsExclusivos, obterTruquesEspecie, periciasReservadasParaClasse, renderDescricaoTalento, renderEscolhasTalentoHtml, talentoExigeEscolhas, talentoNumEscolhas } from './comum.js';
import { _reconstruirTalentosBase } from './passo-antecedente.js';
import { dadosCache, personagem } from './wizard.js';

// ============================================================
// PASSO 2: ESPÉCIE
// ============================================================
export async function renderStepEspecie(el) {
  try {
    let especies = dadosCache.especies;

    // Fallback defensivo: se cache vier vazio, recarregar espécies
    if (!Array.isArray(especies) || especies.length === 0) {
      const especiesData = await getEspecies();
      dadosCache.especies = especiesData?.especies || [];
      especies = dadosCache.especies;
    }

    if (!Array.isArray(especies) || especies.length === 0) {
      el.innerHTML = `
        <h3 style="margin-bottom:12px">Escolha sua Especie</h3>
        <div class="info-box warning">
          Nao foi possivel carregar as especies agora. Tente recarregar a lista.
        </div>
        <button class="btn btn-primary" id="btn-recarregar-especies">Recarregar especies</button>
      `;

      document.getElementById('btn-recarregar-especies')?.addEventListener('click', async () => {
        const especiesData = await getEspecies();
        dadosCache.especies = especiesData?.especies || [];
        renderStepEspecie(el);
      });
      return;
    }

  // Resumo compacto se ja tem especie selecionada
  let resumoHtml = '';
  if (personagem.especie) {
    const esp = especies.find(e => e.nome === personagem.especie);
    const tracosEsc = personagem.tracos_escolhidos?.length ? ' | ' + personagem.tracos_escolhidos.join(', ') : '';
    resumoHtml = `
      <div class="selecao-resumo">
        <div class="resumo-info">
          <div class="resumo-titulo">${personagem.especie}</div>
          <div class="resumo-detalhe">${esp?.tracos?.length || 0} tracos${tracosEsc}</div>
        </div>
        <button class="btn btn-outline btn-sm" id="btn-alterar-especie">Alterar</button>
      </div>`;
  }

  el.innerHTML = `
    <h3 style="margin-bottom:12px">Escolha sua Especie</h3>
    <div class="selection-grid" id="grid-especies">
      ${especies.map(e => `
        <div class="selection-card ${personagem.especie === e.nome ? 'selected' : ''}" data-especie="${e.nome}">
          <span class="card-check">&#10003;</span>
          <div class="card-nome">${e.nome}</div>
          <div class="card-detalhe">${e.tracos?.length || 0} tracos</div>
        </div>
      `).join('')}
    </div>
    ${resumoHtml}
  `;

  // Clicar num card abre popup com detalhes da especie
  el.querySelectorAll('[data-especie]').forEach(card => {
    card.addEventListener('click', () => abrirPopupEspecie(card.dataset.especie));
  });

  document.getElementById('btn-alterar-especie')?.addEventListener('click', () => {
    if (personagem.especie) abrirPopupEspecie(personagem.especie);
  });
  } catch (err) {
    console.error('Erro em renderStepEspecie:', err);
    el.innerHTML = `
      <h3 style="margin-bottom:12px">Escolha sua Especie</h3>
      <div class="info-box warning">Erro ao carregar: ${err.message}</div>
    `;
  }
}

function abrirPopupEspecie(nome) {
  const esp = dadosCache.especies.find(e => e.nome === nome);
  if (!esp) return;

  const deslocamento = getDeslocamento(esp.texto_completo);
  const escolhaConfig = ESPECIES_TRACOS_ESCOLHA[nome];

  // Separar tracos em: fixos e selecionaveis
  let tracosFixos = esp.tracos || [];
  let tracosEscolha = [];
  let usandoOpcoes = false;

  if (escolhaConfig) {
    if (escolhaConfig.opcoes) {
      tracosEscolha = escolhaConfig.opcoes;
      usandoOpcoes = true;
      const tracosPai = ['Herança Dracônica', 'Linhagem Élfica', 'Legado Ínfero'];
      tracosFixos = tracosFixos.filter(t => !tracosPai.includes(t.nome));
    } else if (escolhaConfig.tracos) {
      tracosEscolha = tracosFixos.filter(t => escolhaConfig.tracos.includes(t.nome));
      const tracosPai = ['Ancestralidade Gigante', 'Linhagem Gnômica'];
      tracosFixos = tracosFixos.filter(t => !escolhaConfig.tracos.includes(t.nome) && !tracosPai.includes(t.nome));
    }
  }

  // Copia temporaria dos tracos selecionados (para nao salvar ate confirmar)
  let selecionadosTemp = [...(personagem.tracos_escolhidos || [])];

  // HTML dos tracos de escolha
  let escolhaHtml = '';
  if (escolhaConfig && tracosEscolha.length) {
    escolhaHtml = `
      <div class="section-divider"><span>${escolhaConfig.titulo}</span></div>
      <div class="info-box info" style="font-size:0.85rem">${escolhaConfig.descricao}</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 12px 0" id="popup-tracos-escolha">
        ${tracosEscolha.map(t => {
          const nomeTraco = t.nome || t;
          const descTraco = t.descricao || '';
          return `
            <div class="selection-card ${selecionadosTemp.includes(nomeTraco) ? 'selected' : ''}"
                 data-traco-escolha="${nomeTraco}"
                 style="flex:1;min-width:140px;max-width:180px;cursor:pointer">
              <div class="card-nome" style="font-size:0.85rem">${nomeTraco}</div>
              ${descTraco ? `<div class="card-detalhe" style="font-size:0.75rem;color:var(--text-muted)">${descTraco}</div>` : ''}
            </div>
          `;
        }).join('')}
      </div>
      <div id="traco-escolha-detalhe"></div>
    `;
  }

  // HTML de selecao de pericia de especie (Habil / Sentidos Aguçados)
  //
  // Habil (Humano) e Memoria Kenku escolhem entre TODAS as pericias, entao
  // tambem podem esvaziar a lista curta de uma classe -- um Kenku Clerigo com
  // um antecedente que concede 2 das 5 pericias do Clerigo esgota a lista
  // sozinho. Por isso as reservadas para a classe somem daqui tambem (ver
  // periciasReservadasParaClasse). Sentidos Agucados do Elfo NAO entra: e uma
  // lista fixa de 3 opcoes, curta demais para ceder, e a conta prova que 1
  // escolha nunca inviabiliza classe nenhuma.
  const reservadasEspecie = periciasReservadasParaClasse();
  let periciaEspecieHtml = '';
  if (nome === 'Humano') {
    // Habil: qualquer pericia
    const opcsPericia = PERICIAS.filter(p => !reservadasEspecie.has(p.nome)).map(p => {
      const sel = personagem.pericia_especie === p.nome ? 'selected' : '';
      return `<option value="${p.nome}" ${sel}>${p.nome} (${p.atributo})</option>`;
    }).join('');
    periciaEspecieHtml = `
      <div class="section-divider"><span>Habil — Pericia Extra</span></div>
      <div class="info-box info" style="font-size:0.85rem">O traco Habil concede proficiencia em uma pericia a sua escolha.</div>
      <select id="select-pericia-especie" style="width:100%;padding:8px;border-radius:var(--radius-sm);border:1px solid var(--border);font-size:0.9rem;margin:8px 0">
        <option value="">-- Escolha uma pericia --</option>
        ${opcsPericia}
      </select>
    `;
  } else if (nome === 'Elfo') {
    // Sentidos Aguçados: Intuição, Percepção ou Sobrevivência
    const opcsElfo = ['Intuição', 'Percepção', 'Sobrevivência'].map(p => {
      const sel = personagem.pericia_especie === p ? 'selected' : '';
      return `<option value="${p}" ${sel}>${p}</option>`;
    }).join('');
    periciaEspecieHtml = `
      <div class="section-divider"><span>Sentidos Aguçados — Pericia</span></div>
      <div class="info-box info" style="font-size:0.85rem">Voce tem proficiencia na pericia Intuição, Percepção ou Sobrevivência.</div>
      <select id="select-pericia-especie" style="width:100%;padding:8px;border-radius:var(--radius-sm);border:1px solid var(--border);font-size:0.9rem;margin:8px 0">
        <option value="">-- Escolha uma pericia --</option>
        ${opcsElfo}
      </select>
    `;
  } else if (nome === 'Kenku') {
    // Memória Kenku: 2 perícias quaisquer à escolha
    const periciasSel = personagem.pericias_especie || [];
    // A reserva e recalculada por caixa considerando a escolha da outra: a
    // primeira pericia da lista da classe pode ser tomada, a segunda ja nao.
    const reservadasKenku1 = periciasReservadasParaClasse([periciasSel[1]].filter(Boolean));
    const reservadasKenku2 = periciasReservadasParaClasse([periciasSel[0]].filter(Boolean));
    const opcsKenku1 = PERICIAS.map(p => {
      if (periciasSel[1] === p.nome) return '';
      if (reservadasKenku1.has(p.nome) && periciasSel[0] !== p.nome) return '';
      const sel = periciasSel[0] === p.nome ? 'selected' : '';
      return `<option value="${p.nome}" ${sel}>${p.nome} (${p.atributo})</option>`;
    }).join('');
    const opcsKenku2 = PERICIAS.map(p => {
      if (periciasSel[0] === p.nome) return '';
      if (reservadasKenku2.has(p.nome) && periciasSel[1] !== p.nome) return '';
      const sel = periciasSel[1] === p.nome ? 'selected' : '';
      return `<option value="${p.nome}" ${sel}>${p.nome} (${p.atributo})</option>`;
    }).join('');
    periciaEspecieHtml = `
      <div class="section-divider"><span>Memória Kenku — 2 Perícias</span></div>
      <div class="info-box info" style="font-size:0.85rem">O traço Memória Kenku concede proficiência em duas perícias de sua escolha.</div>
      <div style="display:flex;gap:8px;margin:8px 0">
        <select id="select-kenku-pericia-1" style="flex:1;padding:8px;border-radius:var(--radius-sm);border:1px solid var(--border);font-size:0.9rem">
          <option value="">-- 1ª perícia --</option>
          ${opcsKenku1}
        </select>
        <select id="select-kenku-pericia-2" style="flex:1;padding:8px;border-radius:var(--radius-sm);border:1px solid var(--border);font-size:0.9rem">
          <option value="">-- 2ª perícia --</option>
          ${opcsKenku2}
        </select>
      </div>
    `;
  }

  // HTML especial para Humano: selecao de talento de origem (Versatil)
  let versatilHtml = '';
  if (nome === 'Humano') {
    versatilHtml = `
      <div class="section-divider"><span>Versatil — Talento de Origem</span></div>
      <div class="info-box info" style="font-size:0.85rem">O traco Versatil concede um talento de Origem extra. Escolha abaixo:</div>
      <select id="select-talento-versatil" style="width:100%;padding:8px;border-radius:var(--radius-sm);border:1px solid var(--border);font-size:0.9rem;margin:8px 0">
        <option value="">-- Escolha um talento de Origem --</option>
      </select>
      <div id="versatil-talento-detalhe"></div>
    `;
  }

  const corpoHtml = `
    <p style="font-size:0.85rem;margin-bottom:12px">${esp.descricao?.split('\n')[0] || ''}</p>
    <div style="font-size:0.85rem;margin-bottom:8px"><strong>Deslocamento:</strong> ${deslocamento}</div>
    ${escolhaHtml}
    ${periciaEspecieHtml}
    ${versatilHtml}
    <div class="section-divider"><span>Traços da Espécie${escolhaConfig ? ' (Fixos)' : ''}</span></div>
    ${tracosFixos.map(t => `
      <details style="margin-bottom:6px">
        <summary style="font-weight:600;cursor:pointer;font-size:0.9rem">${t.nome}</summary>
        <div class="md-content" style="padding:6px 0;font-size:0.85rem">${mdParaHtml(t.descricao)}</div>
      </details>
    `).join('')}
  `;

  abrirModal(esp.nome, corpoHtml, `
    <button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>
    <button class="btn btn-primary" id="popup-confirmar-especie">Selecionar ${esp.nome}</button>
  `);

  if (nome === 'Kenku') {
    const primeiraPericia = document.getElementById('select-kenku-pericia-1');
    const segundaPericia = document.getElementById('select-kenku-pericia-2');
    const preencherOpcoesKenku = (select, valorAtual, valorExcluido, rotulo) => {
      if (!select) return;
      select.innerHTML = `<option value="">-- ${rotulo} --</option>${PERICIAS
        .filter(pericia => pericia.nome !== valorExcluido)
        .map(pericia => `<option value="${pericia.nome}">${pericia.nome} (${pericia.atributo})</option>`)
        .join('')}`;
      select.value = valorAtual || '';
    };
    const atualizarOpcoesKenku = () => {
      const valorPrimeira = primeiraPericia?.value || '';
      const valorSegunda = segundaPericia?.value || '';
      preencherOpcoesKenku(primeiraPericia, valorPrimeira, valorSegunda, '1ª perícia');
      preencherOpcoesKenku(segundaPericia, valorSegunda, valorPrimeira, '2ª perícia');
    };
    primeiraPericia?.addEventListener('change', atualizarOpcoesKenku);
    segundaPericia?.addEventListener('change', atualizarOpcoesKenku);
    atualizarOpcoesKenku();
  }

  // Eventos de selecao de traco no popup
  if (escolhaConfig) {
    document.querySelectorAll('#popup-tracos-escolha [data-traco-escolha]').forEach(card => {
      card.addEventListener('click', () => {
        const nomeTr = card.dataset.tracoEscolha;
        const max = escolhaConfig.maxEscolhas;

        if (selecionadosTemp.includes(nomeTr)) {
          selecionadosTemp = selecionadosTemp.filter(n => n !== nomeTr);
        } else {
          if (selecionadosTemp.length >= max) selecionadosTemp = [nomeTr];
          else selecionadosTemp.push(nomeTr);
        }

        // Atualizar visual
        document.querySelectorAll('#popup-tracos-escolha [data-traco-escolha]').forEach(c => {
          c.classList.toggle('selected', selecionadosTemp.includes(c.dataset.tracoEscolha));
        });

        // Mostrar detalhe do traco selecionado
        const detalheEl = document.getElementById('traco-escolha-detalhe');
        if (detalheEl && selecionadosTemp.length > 0) {
          const tracoSel = tracosEscolha.find(t => (t.nome || t) === selecionadosTemp[0]);
          if (tracoSel) {
            detalheEl.innerHTML = `
              <div class="info-box success" style="font-size:0.85rem">
                <strong>${tracoSel.nome || tracoSel}:</strong> ${tracoSel.descricao || ''}
              </div>`;
          }
        } else if (detalheEl) {
          detalheEl.innerHTML = '';
        }
      });
    });

    // Mostrar detalhe do traco ja selecionado
    if (selecionadosTemp.length) {
      const tracoSel = tracosEscolha.find(t => (t.nome || t) === selecionadosTemp[0]);
      const detalheEl = document.getElementById('traco-escolha-detalhe');
      if (tracoSel && detalheEl) {
        detalheEl.innerHTML = `
          <div class="info-box success" style="font-size:0.85rem">
            <strong>${tracoSel.nome || tracoSel}:</strong> ${tracoSel.descricao || ''}
          </div>`;
      }
    }
  }

  // Carregar talentos de origem para o select Versatil (Humano)
  if (nome === 'Humano') {
    (async () => {
      try {
        const talentosData = await getTalentos();
        const talentosOrigem = (talentosData?.por_categoria?.['de Origem'] || []).sort((a, b) => a.nome.localeCompare(b.nome));
        const selectEl = document.getElementById('select-talento-versatil');
        if (selectEl) {
          talentosOrigem.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.nome;
            opt.textContent = t.nome;
            if (personagem.talento_versatil === t.nome) opt.selected = true;
            selectEl.appendChild(opt);
          });

          // Funcao auxiliar para atualizar detalhe + escolhas do talento
          const atualizarDetalheVersatil = (nomeT) => {
            const detalheEl = document.getElementById('versatil-talento-detalhe');
            if (!detalheEl) return;
            if (!nomeT) { detalheEl.innerHTML = ''; return; }
            const td = talentosOrigem.find(t => t.nome === nomeT);
            if (!td) { detalheEl.innerHTML = ''; return; }
            let html = `<div class="info-box success" style="font-size:0.85rem">${renderDescricaoTalento(td)}</div>`;
            html += renderEscolhasTalentoHtml(nomeT, 'versatil');
            detalheEl.innerHTML = html;
            // Mesma reserva do Habilidoso do antecedente: aqui sem `extras`,
            // porque o antecedente ainda nao foi escolhido -- a reserva usa a
            // margem preventiva das duas pericias fixas que ele vai conceder.
            if (talentoExigeEscolhas(nomeT)) {
              configurarSelectsExclusivos('.escolha-talento-versatil', { reservarClasse: true });
            }
          };

          // Mostrar detalhe do talento ja selecionado
          if (personagem.talento_versatil) {
            atualizarDetalheVersatil(personagem.talento_versatil);
          }
          selectEl.addEventListener('change', () => {
            // Limpar escolhas anteriores ao trocar de talento
            if (!personagem.escolhas_talento) personagem.escolhas_talento = {};
            delete personagem.escolhas_talento.versatil;
            atualizarDetalheVersatil(selectEl.value);
          });
        }
      } catch (e) { console.error('Erro ao carregar talentos de Origem:', e); }
    })();
  }

  // Botao de confirmacao (com validação de traços obrigatórios)
  document.getElementById('popup-confirmar-especie')?.addEventListener('click', () => {
    // Validar seleção de traços obrigatórios
    if (escolhaConfig) {
      if (selecionadosTemp.length < escolhaConfig.maxEscolhas) {
        toast(`Selecione ${escolhaConfig.maxEscolhas} opção(ões) de ${escolhaConfig.titulo}`, 'error');
        return;
      }
    }
    // Validar pericia de especie (Habil / Sentidos Aguçados)
    if (nome === 'Humano' || nome === 'Elfo') {
      const selectPericia = document.getElementById('select-pericia-especie');
      if (!selectPericia?.value) {
        const traco = nome === 'Humano' ? 'Habil' : 'Sentidos Aguçados';
        toast(`Selecione a pericia de ${traco}`, 'error');
        return;
      }
      personagem.pericia_especie = selectPericia.value;
    }
    // Validar pericias de especie Kenku (Memória Kenku: 2 perícias)
    if (nome === 'Kenku') {
      const sel1 = document.getElementById('select-kenku-pericia-1')?.value;
      const sel2 = document.getElementById('select-kenku-pericia-2')?.value;
      if (!sel1 || !sel2) {
        toast('Selecione as 2 perícias de Memória Kenku', 'error');
        return;
      }
      if (sel1 === sel2) {
        toast('Escolha perícias diferentes para Memória Kenku', 'error');
        return;
      }
      personagem.pericias_especie = [sel1, sel2];
    }
    // Validar talento Versatil para Humano
    if (nome === 'Humano') {
      const selectVersatil = document.getElementById('select-talento-versatil');
      if (!selectVersatil?.value) {
        toast('Selecione um Talento de Origem (Versatil)', 'error');
        return;
      }
      // Verificar conflito: mesmo talento não-repetível já escolhido no antecedente
      const _talentosOrigemRepetiveisEsp = ['Habilidoso', 'Iniciado em Magia'];
      if (personagem.talento_antecedente && personagem.talento_antecedente === selectVersatil.value && !_talentosOrigemRepetiveisEsp.includes(selectVersatil.value)) {
        toast(`O talento "${selectVersatil.value}" já está selecionado no Antecedente e não é repetível. Escolha outro talento aqui.`, 'error');
        return;
      }
      personagem.talento_versatil = selectVersatil.value;

      // Validar e salvar escolhas do talento Versatil (Habilidoso, Artifista, Musico)
      const numEscolhas = talentoNumEscolhas(selectVersatil.value);
      if (numEscolhas > 0) {
        const selects = document.querySelectorAll('.escolha-talento-versatil');
        const vals = [...selects].map(s => s.value).filter(Boolean);
        if (vals.length < numEscolhas) {
          toast(`Selecione todas as ${numEscolhas} escolhas de ${selectVersatil.value}`, 'error');
          return;
        }
        // Verificar duplicatas
        if (new Set(vals).size < vals.length) {
          toast('Nao repita opcoes nas escolhas do talento', 'error');
          return;
        }
        if (!personagem.escolhas_talento) personagem.escolhas_talento = {};
        personagem.escolhas_talento.versatil = vals;
      } else {
        if (!personagem.escolhas_talento) personagem.escolhas_talento = {};
        delete personagem.escolhas_talento.versatil;
      }
    }
    // Limpar tracos se mudou de especie
    if (personagem.especie !== nome) {
      personagem.tracos_escolhidos = [];
      // Limpar talento versatil se mudou de especie
      if (nome !== 'Humano') delete personagem.talento_versatil;
      // Limpar pericia de especie se mudou para especie sem essa escolha
      if (nome !== 'Humano' && nome !== 'Elfo') delete personagem.pericia_especie;
      // Limpar pericias de especie (Kenku) se mudou para especie sem essa escolha
      if (nome !== 'Kenku') delete personagem.pericias_especie;
    }
    personagem.especie = nome;
    personagem.tracos_escolhidos = [...selecionadosTemp];
    // Purga truques escolhidos manualmente na etapa de Magias que passam a ser
    // concedidos de graça pela nova espécie/legado (ex.: escolher "Rajada de Veneno"
    // como truque normal, voltar e trocar o legado para Abissal, que já concede o
    // mesmo truque) — evita desperdiçar o pick que a concessão automática deveria
    // liberar (Minor 4 da revisão final).
    const novosTruquesEspecie = obterTruquesEspecie(personagem.especie, personagem.tracos_escolhidos);
    if (novosTruquesEspecie.length > 0 && Array.isArray(personagem.magias_conhecidas)) {
      personagem.magias_conhecidas = personagem.magias_conhecidas.filter(m =>
        !(m.circulo === 0 && m.origem !== 'especie' && novosTruquesEspecie.includes(m.nome))
      );
    }
    // Sincronizar personagem.talentos com o estado atual de talento_versatil
    // (cobre tanto a seleção quanto a limpeza ao trocar de espécie)
    _reconstruirTalentosBase();
    window.fecharModal();
    // Re-renderizar o passo com o resumo
    const wizContent = document.getElementById('wizard-content');
    if (wizContent) renderStepEspecie(wizContent);
  });
}