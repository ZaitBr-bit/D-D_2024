// ============================================================
// Passo 3: escolha de antecedente
// Extraido de site/js/pages/creator.js sem alteracao de comportamento.
// ============================================================
import { abrirModal, toast } from '../utils.js';
import { ANTECEDENTES_ESCOLHAS, configurarSelectsExclusivos, renderEscolhasTalentoHtml, talentoExigeEscolhas, talentoNumEscolhas } from './comum.js';
import { renderDistribuicaoInline } from './passo-atributos.js';
import { dadosCache, personagem } from './wizard.js';

// ============================================================
// PASSO 3: ANTECEDENTE
// ============================================================
export function renderStepAntecedente(el) {
  const antecedentes = dadosCache.antecedentes;

  // Resumo compacto se ja tem antecedente selecionado
  let resumoHtml = '';
  if (personagem.antecedente) {
    const ant = antecedentes.find(a => a.nome === personagem.antecedente);
    resumoHtml = `
      <div class="selecao-resumo">
        <div class="resumo-info">
          <div class="resumo-titulo">${personagem.antecedente}</div>
          <div class="resumo-detalhe">${ant?.talento?.split('(')[0]?.trim() || ''} | ${ant?.pericias || ''}</div>
        </div>
        <button class="btn btn-outline btn-sm" id="btn-alterar-antecedente">Alterar</button>
      </div>`;
  }

  el.innerHTML = `
    <h3 style="margin-bottom:12px">Escolha seu Antecedente</h3>
    <div class="info-box info">O antecedente define suas pericias, ferramentas, talento de origem e distribuicao de atributos.</div>
    <div class="selection-grid" id="grid-antecedentes">
      ${antecedentes.map(a => `
        <div class="selection-card ${personagem.antecedente === a.nome ? 'selected' : ''}" data-antecedente="${a.nome}">
          <span class="card-check">&#10003;</span>
          <div class="card-nome">${a.nome}</div>
          <div class="card-detalhe">${a.talento?.split('(')[0]?.trim() || ''}</div>
        </div>
      `).join('')}
    </div>
    ${resumoHtml}
    <div id="antecedente-distribuicao" class="mt-2"></div>
  `;

  // Clicar num card abre popup com detalhes do antecedente
  el.querySelectorAll('[data-antecedente]').forEach(card => {
    card.addEventListener('click', () => abrirPopupAntecedente(card.dataset.antecedente));
  });

  document.getElementById('btn-alterar-antecedente')?.addEventListener('click', () => {
    if (personagem.antecedente) abrirPopupAntecedente(personagem.antecedente);
  });

  // Se ja tem antecedente, mostrar distribuicao de atributos inline
  if (personagem.antecedente) {
    renderDistribuicaoInline();
  }
}

// Reconstrói personagem.talentos a partir das duas fontes possíveis (antecedente + Versátil),
// deterministicamente. Precisa ser chamada sempre que QUALQUER uma das duas fontes mudar
// (não só quando o antecedente é confirmado), pois o usuário pode navegar entre os passos
// Espécie e Antecedente fora de ordem.
export function _reconstruirTalentosBase() {
  personagem.talentos = personagem.talento_antecedente ? [personagem.talento_antecedente] : [];
  if (personagem.talento_versatil) {
    personagem.talentos.push(personagem.talento_versatil);
  }
}

function abrirPopupAntecedente(nome) {
  const ant = dadosCache.antecedentes.find(a => a.nome === nome);
  if (!ant) return;

  // Parsear dados do antecedente
  const pericias = ant.pericias.split(',').map(p => p.trim()).filter(Boolean);
  const atributosDisponiveis = ant.valores_atributo.split(',').map(a => a.trim()).filter(Boolean);
  const talentoNome = ant.talento?.replace(/\s*\(veja.*\)/, '').trim() || '';

  // Escolha de ferramenta/instrumento
  const antEscolha = ANTECEDENTES_ESCOLHAS[nome];
  let escolhaHtml = '';
  if (antEscolha) {
    const valorAtual = personagem.escolhas_antecedente?.[antEscolha.campo] || '';
    escolhaHtml = `
      <div class="section-divider mt-2"><span>${antEscolha.titulo}</span></div>
      <div class="info-box info" style="font-size:0.85rem">${antEscolha.descricao}</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin:8px 0">
        ${antEscolha.opcoes.map(opt => `
          <div class="selection-card ${valorAtual === opt ? 'selected' : ''}"
               data-escolha-ant="${antEscolha.campo}" data-opcao-ant="${opt}"
               style="flex:1;min-width:130px;max-width:180px;cursor:pointer">
            <div class="card-nome" style="font-size:0.85rem">${opt}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  // Escolhas do talento (Habilidoso, Artifista, Musico)
  let escolhaTalentoHtml = '';
  if (talentoExigeEscolhas(talentoNome)) {
    escolhaTalentoHtml = renderEscolhasTalentoHtml(talentoNome, 'antecedente');
  }

  const corpoHtml = `
    <p style="font-size:0.85rem;margin-bottom:12px;font-style:italic">${ant.descricao || ''}</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:0.85rem">
      <div><strong>Pericias:</strong> ${pericias.join(', ')}</div>
      <div><strong>Ferramentas:</strong> ${ant.ferramentas}</div>
      <div><strong>Talento:</strong> ${talentoNome}</div>
      <div><strong>Atributos:</strong> ${atributosDisponiveis.join(', ')}</div>
    </div>
    <div style="font-size:0.85rem;margin-top:8px">
      <strong>Equipamento:</strong> ${ant.equipamento?.replace(/\*/g, '') || ''}
    </div>
    ${escolhaHtml}
    ${escolhaTalentoHtml}
  `;

  abrirModal(ant.nome, corpoHtml, `
    <button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>
    <button class="btn btn-primary" id="popup-confirmar-antecedente">Selecionar ${ant.nome}</button>
  `);

  if (talentoExigeEscolhas(talentoNome)) configurarSelectsExclusivos('.escolha-talento-antecedente');

  // Eventos de escolha de ferramenta/instrumento
  if (antEscolha) {
    document.querySelectorAll('[data-escolha-ant]').forEach(card => {
      card.addEventListener('click', () => {
        const campo = card.dataset.escolhaAnt;
        const opcao = card.dataset.opcaoAnt;
        if (!personagem.escolhas_antecedente) personagem.escolhas_antecedente = {};
        personagem.escolhas_antecedente[campo] = opcao;
        // Atualizar visual
        document.querySelectorAll(`[data-escolha-ant="${campo}"]`).forEach(c => {
          c.classList.toggle('selected', c.dataset.opcaoAnt === opcao);
        });
      });
    });
  }

  // Botao de confirmacao (com validação de escolhas obrigatórias)
  document.getElementById('popup-confirmar-antecedente')?.addEventListener('click', () => {
    // Validar escolhas de antecedente (ferramenta/instrumento)
    const antEscolha = ANTECEDENTES_ESCOLHAS[nome];
    if (antEscolha && !personagem.escolhas_antecedente?.[antEscolha.campo]) {
      toast(`Selecione ${antEscolha.titulo}`, 'error');
      return;
    }
    // Validar escolhas do talento do antecedente (Habilidoso, Artifista, Musico)
    const numEsc = talentoNumEscolhas(talentoNome);
    if (numEsc > 0) {
      const selects = document.querySelectorAll('.escolha-talento-antecedente');
      const vals = [...selects].map(s => s.value).filter(Boolean);
      if (vals.length < numEsc) {
        toast(`Selecione todas as ${numEsc} escolhas de ${talentoNome}`, 'error');
        return;
      }
      if (new Set(vals).size < vals.length) {
        toast('Nao repita opcoes nas escolhas do talento', 'error');
        return;
      }
      if (!personagem.escolhas_talento) personagem.escolhas_talento = {};
      personagem.escolhas_talento.antecedente = vals;
    }
    // Se mudou de antecedente, limpar dados especificos do anterior
    if (personagem.antecedente && personagem.antecedente !== nome) {
      personagem.bonus_antecedente = {};
      personagem.escolhas_antecedente = {};
      personagem.talentos = [];
      if (personagem.escolhas_talento) delete personagem.escolhas_talento.antecedente;
      delete personagem.iniciado_em_magia;
      delete personagem.iniciado_em_magia_instancias;
      delete dadosCache.bonus2;
      delete dadosCache.bonus1;
      delete dadosCache.bonus111;
    }
    personagem.antecedente = nome;

    // Aplicar pericias do antecedente
    dadosCache.pericias_antecedente = pericias;
    dadosCache.atributos_antecedente = atributosDisponiveis;

    // Verificar conflito: mesmo talento não-repetível do antecedente e Versátil
    const _talentosOrigemRepetiveis = ['Habilidoso', 'Iniciado em Magia'];
    if (personagem.talento_versatil && personagem.talento_versatil === talentoNome && !_talentosOrigemRepetiveis.includes(talentoNome)) {
      toast(`O talento "${talentoNome}" já está selecionado como Versátil e não é repetível. Altere sua escolha na etapa de Espécie.`, 'error');
      return;
    }

    // Persistir o talento do antecedente e reconstruir array de talentos de forma
    // determinística a partir das duas fontes (evita duplicação ao re-selecionar,
    // e mantém consistência se o usuário revisitar o passo Espécie depois)
    personagem.talento_antecedente = talentoNome || '';
    _reconstruirTalentosBase();

    window.fecharModal();
    // Re-renderizar o passo com o resumo e distribuicao de atributos
    const wizContent = document.getElementById('wizard-content');
    if (wizContent) renderStepAntecedente(wizContent);
  });
}