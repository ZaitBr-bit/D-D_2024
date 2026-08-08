// ============================================================
// Passo 6: truques, magias e Iniciado em Magia
// Extraido de site/js/pages/creator.js sem alteracao de comportamento.
// ============================================================
import { ATRIBUTOS_NOMES, CLASSES_INFO } from '../dados-classes.js';
import { getClasse, getIndiceMagias, getMagiasClasse } from '../db.js';
import { abrirModal, getBonusTruquesOrdem, getEspacosMagia, getMagiaPreparadas, getTruquesConhecidos, mdParaHtml, nomesMagiaCirculo1Conhecidas, semAcento, toast } from '../utils.js';
import { obterTruquesEspecie } from './comum.js';
import { dadosCache, personagem } from './wizard.js';

// ============================================================
// PASSO 6: MAGIAS
// ============================================================
export async function renderStepMagias(el) {
  const info = CLASSES_INFO[personagem.classe];
  const tipoConj = info?.tipo_conjuracao || 'preparadas';
  const labelMagias = tipoConj === 'conhecidas' ? 'Magias conhecidas' : 'Magias preparadas';

  const temIniciadoEmMagia = (personagem.talentos || []).some(t => _nomeBaseTalento(t) === 'Iniciado em Magia');

  if (!info?.conjurador) {
    if (temIniciadoEmMagia) {
      // Classe não-conjuradora mas com Iniciado em Magia: renderizar seleção de magias do talento
      el.innerHTML = `
        <h3 style="margin-bottom:12px">Magias</h3>
        <div class="info-box info">A classe <strong>${personagem.classe}</strong> não é conjuradora, mas você possui o talento <strong>Iniciado em Magia</strong>.</div>
      `;
      await _renderIniciadoEmMagia(el);
      return;
    }
    el.innerHTML = `
      <h3 style="margin-bottom:12px">Magias</h3>
      <div class="info-box info">A classe <strong>${personagem.classe}</strong> não é conjuradora. Você pode pular este passo.</div>
      <p style="font-size:0.85rem;color:var(--text-muted)">Se possuir magias de outras fontes (talento, espécie, etc.) você poderá adicioná-las na ficha depois.</p>
    `;
    return;
  }

  // Carregar dados de magias da classe
  const classeData = dadosCache.classeData || await getClasse(personagem.classe);
  const magiasClasse = await getMagiasClasse(personagem.classe);
  const indice = await getIndiceMagias();
  dadosCache.magiasClasse = magiasClasse;
  dadosCache.indiceMagias = indice?.magias || [];

  const tabelaCaract = classeData?.tabela_caracteristicas;
  let numTruques = getTruquesConhecidos(tabelaCaract, personagem.nivel);
  const numPreparadas = getMagiaPreparadas(tabelaCaract, personagem.nivel);
  const espacos = getEspacosMagia(tabelaCaract, personagem.nivel);
  const maxCirculo = Math.max(...Object.keys(espacos).map(Number), 0);
  const magoNivel1 = personagem.classe === 'Mago' && personagem.nivel === 1;
  const limiteGrimorio = magoNivel1 ? 6 : 0;

  // Bônus de truques do Clérigo Taumaturgo / Druida Xamã (utils.js, mesma
  // função que o resto do app -- ver comentário de getBonusTruquesOrdem)
  numTruques += getBonusTruquesOrdem(personagem);

  // Construir lista de magias disponíveis por círculo
  // A lista de magias tem formato: { "Truques": [...], "1º Círculo": [...], ... } OU { "9º Círculo": [...] } (lista única)
  const listaMagias = magiasClasse?.lista_magias || {};

  // Normalizar: algumas classes têm todas as magias numa chave única "9º Círculo"
  let magiasPorCirculo = {};
  if (listaMagias['Truques'] || listaMagias['1º Círculo']) {
    // Formato normal com chaves por círculo
    magiasPorCirculo = listaMagias;
  } else if (listaMagias['9º Círculo'] && Array.isArray(listaMagias['9º Círculo'])) {
    // Lista única - precisa separar por círculo usando o índice de magias
    const todas = listaMagias['9º Círculo'];
    const indiceMagias = dadosCache.indiceMagias || [];

    // Separar truques e magias de nível usando o índice
    magiasPorCirculo['Truques'] = [];
    for (let i = 1; i <= 9; i++) magiasPorCirculo[`${i}º Círculo`] = [];

    todas.forEach(nomeMagia => {
      const nome = typeof nomeMagia === 'string' ? nomeMagia : nomeMagia?.nome;
      if (!nome) return;
      const infoMagia = indiceMagias.find(m => m.nome === nome);
      if (infoMagia) {
        const circ = infoMagia.circulo || 0;
        const chave = circ === 0 ? 'Truques' : `${circ}º Círculo`;
        if (!magiasPorCirculo[chave]) magiasPorCirculo[chave] = [];
        magiasPorCirculo[chave].push(typeof nomeMagia === 'string' ? { nome: nomeMagia } : nomeMagia);
      } else {
        // Sem info no índice, adicionar a truques como fallback se são truques conhecidos
        magiasPorCirculo['Truques'].push(typeof nomeMagia === 'string' ? { nome: nomeMagia } : nomeMagia);
      }
    });
  }

  // Garantir que arrays de nomes virem objetos { nome }
  for (const [chave, lista] of Object.entries(magiasPorCirculo)) {
    magiasPorCirculo[chave] = lista.map(m => typeof m === 'string' ? { nome: m } : m);
  }

  el.innerHTML = `
    <h3 style="margin-bottom:12px">Magias - ${personagem.classe}</h3>
    <div class="info-box info" id="magias-contadores">
      Truques: <strong>${(personagem.magias_conhecidas || []).filter(m => m.circulo === 0).length}/${numTruques}</strong> |
      ${magoNivel1 ? `Grimório: <strong>${(personagem.grimorio || []).length}/${limiteGrimorio}</strong> | ` : ''}${labelMagias}: <strong>${(personagem.magias_preparadas || []).length}/${numPreparadas}</strong> |
      Atributo: <strong>${info.atributo_conjuracao}</strong>
    </div>

    <div class="tabs" id="tabs-magias">
      <div class="tab active" data-tab-circ="0">Truques</div>
      ${Array.from({ length: maxCirculo }, (_, i) => i + 1).map(c => `<div class="tab" data-tab-circ="${c}">${c}&ordm; Círculo (${espacos[c]?.total || 0})</div>`).join('')}
    </div>
    <div class="search-box"><input type="text" id="busca-magia" placeholder="Buscar magia..." class="form-input"></div>
    <div id="magias-lista"></div>
  `;

  let circuloAtivo = 0;
  // Referência ao container da seção Iniciado em Magia (se existir), para re-sincronizar
  // as duas seções quando uma muda o estado de truques/magias conhecidas da outra
  let _imContainerEl = null;

  let renderMagiasCirculo = (circ) => {
    circuloAtivo = circ;
    const listaEl = document.getElementById('magias-lista');
    if (!listaEl) return;

    // Buscar magias deste círculo para a classe
    const nomeCirculo = circ === 0 ? 'Truques' : `${circ}º Círculo`;
    const magiasDaClasse = magiasPorCirculo[nomeCirculo] || [];
    const isTruque = circ === 0;

    // Para truques, gerenciar magias_conhecidas
    // Para magias, gerenciar magias_preparadas
    const selecionadas = isTruque
      ? (personagem.magias_conhecidas || []).filter(m => m.circulo === 0).map(m => m.nome)
      : magoNivel1 ? (personagem.grimorio || []).map(m => m.nome) : (personagem.magias_preparadas || []).map(m => m.nome);

    const maxSel = isTruque ? numTruques : magoNivel1 ? limiteGrimorio : numPreparadas;
    const totalSel = isTruque
      ? selecionadas.length
      : selecionadas.length;

    // Nomes já ocupados por instâncias de Iniciado em Magia (evita "aprender" o mesmo truque/
    // magia de 1º círculo duas vezes sem ganho nenhum). Só se aplica às abas Truques e 1º Círculo.
    const jaEscolhidoPorIM = new Set();
    if (temIniciadoEmMagia && (circ === 0 || circ === 1)) {
      (personagem.iniciado_em_magia_instancias || []).forEach(o => {
        if (circ === 0) (o.truques || []).forEach(n => jaEscolhidoPorIM.add(n));
        else if (o.magia) jaEscolhidoPorIM.add(o.magia);
      });
    }

    // Truques já concedidos gratuitamente pela espécie/traço (ex.: Rajada de Veneno do
    // Tiferino Abissal) — não devem poder ser "escolhidos" de novo como truque de classe.
    const jaConcedidoPorEspecie = new Set();
    if (isTruque) {
      obterTruquesEspecie(personagem.especie, personagem.tracos_escolhidos).forEach(n => jaConcedidoPorEspecie.add(n));
    }

    listaEl.innerHTML = `
      <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:8px">
        ${isTruque ? `Truques selecionados: ${selecionadas.length}/${maxSel}` : magoNivel1 ? `Grimório: ${totalSel}/${maxSel}. Depois escolha 4 preparadas abaixo.` : `${labelMagias}: ${totalSel}/${maxSel}`}
        ${magiasDaClasse.length > 0 ? ` | ${magiasDaClasse.length} disponíveis` : ''}
      </div>
      ${magiasDaClasse.length === 0
        ? '<div style="color:var(--text-muted);text-align:center;padding:20px">Nenhuma magia disponível neste círculo</div>'
        : `<div class="magias-grid">${magiasDaClasse.map(m => {
            const nome = m.nome || m;
            const sel = selecionadas.includes(nome);
            const bloqueadoPorIM = !sel && jaEscolhidoPorIM.has(nome);
            const bloqueadoPorEspecie = !sel && jaConcedidoPorEspecie.has(nome);
            const bloqueado = bloqueadoPorIM || bloqueadoPorEspecie;
            return `
              <div class="magia-card ${sel ? 'selecionada' : ''} ${bloqueado ? 'magia-card-bloqueada' : ''}" data-magia-nome="${nome}" data-magia-circ="${circ}" ${bloqueado ? 'style="opacity:0.4"' : ''}>
                <span class="magia-card-check" data-creator-check="${nome}"></span>
                <div class="magia-card-nome" data-creator-info="${nome}" data-creator-info-circ="${circ}">${nome}${bloqueadoPorIM ? ' (já conhecido)' : ''}${bloqueadoPorEspecie ? ' (já concedido pela espécie)' : ''}</div>
                <div class="magia-card-meta">
                  <span>${m.escola || ''}</span>
                  ${m.especial === 'C' ? '<span>Conc.</span>' : ''}
                  ${m.especial === 'M' ? '<span>M$</span>' : ''}
                </div>
              </div>`;
          }).join('')}</div>`
      }
    `;

    // Eventos de toggle ao clicar no check
    listaEl.querySelectorAll('[data-creator-check]').forEach(chk => {
      chk.addEventListener('click', (e) => {
        e.stopPropagation();
        const card = chk.closest('.magia-card');
        const nome = card.dataset.magiaNome;
        const jaSelecionado = selecionadas.includes(nome);
        if (!jaSelecionado && jaEscolhidoPorIM.has(nome)) {
          toast(`"${nome}" já é conhecido por Iniciado em Magia — escolha um diferente`, 'error');
          return;
        }
        if (!jaSelecionado && jaConcedidoPorEspecie.has(nome)) {
          toast(`"${nome}" já é concedido gratuitamente pela sua espécie — escolha um diferente`, 'error');
          return;
        }
        toggleMagia(nome, circ, isTruque, numTruques, numPreparadas, magoNivel1, limiteGrimorio);
        renderMagiasCirculo(circ);
        atualizarContadoresMagia(numTruques, numPreparadas, magoNivel1, limiteGrimorio);
        // A seleção da classe pode ter liberado/ocupado um nome que a seção
        // Iniciado em Magia também precisa refletir (contra-duplicata cruzada)
        if (temIniciadoEmMagia && _imContainerEl) {
          _renderIniciadoEmMagia(_imContainerEl, () => renderMagiasCirculo(circuloAtivo));
        }
      });
    });

    // Detalhe ao clicar no nome da magia
    listaEl.querySelectorAll('[data-creator-info]').forEach(el => {
      el.addEventListener('click', async (e) => {
        e.stopPropagation();
        const nome = el.dataset.creatorInfo;
        const c = parseInt(el.dataset.creatorInfoCirc);
        await mostrarDetalheMagia(nome, c);
      });
    });
  };

  // Tabs
  el.querySelectorAll('[data-tab-circ]').forEach(tab => {
    tab.addEventListener('click', () => {
      el.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderMagiasCirculo(parseInt(tab.dataset.tabCirc));
    });
  });

  // Busca
  document.getElementById('busca-magia')?.addEventListener('input', (e) => {
    const termo = semAcento(e.target.value);
    document.querySelectorAll('#magias-lista .magia-card').forEach(el => {
      el.style.display = semAcento(el.textContent).includes(termo) ? '' : 'none';
    });
  });

  renderMagiasCirculo(0);

  if (magoNivel1) {
    const preparadasEl = document.createElement('div');
    preparadasEl.id = 'mago-preparadas-iniciais';
    preparadasEl.style.marginTop = '20px';
    el.appendChild(preparadasEl);

    const renderPreparadasMago = () => {
      const grimorio = Array.isArray(personagem.grimorio) ? personagem.grimorio : [];
      const preparadas = Array.isArray(personagem.magias_preparadas) ? personagem.magias_preparadas : [];
      preparadasEl.innerHTML = `
        <div class="card" style="border-color:var(--accent)">
          <div class="card-header"><h3>Magias Preparadas</h3></div>
          <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:8px">Escolha exatamente 4 das magias registradas no grimório: ${preparadas.length}/${numPreparadas}</div>
          <div class="magias-grid">${grimorio.map(m => {
            const sel = preparadas.some(p => p.nome === m.nome);
            return `<div class="magia-card ${sel ? 'selecionada' : ''}" data-mago-preparada="${m.nome}" data-mago-preparada-circ="${m.circulo}" style="cursor:pointer">
              <span class="magia-card-check"></span><div class="magia-card-nome">${m.nome}</div><div class="magia-card-meta"><span>${m.circulo}º Círculo</span></div>
            </div>`;
          }).join('') || '<div style="color:var(--text-muted);padding:8px">Selecione as 6 magias do grimório acima primeiro.</div>'}</div>
        </div>`;
      preparadasEl.querySelectorAll('[data-mago-preparada]').forEach(card => card.addEventListener('click', () => {
        const nome = card.dataset.magoPreparada;
        const idx = personagem.magias_preparadas.findIndex(m => m.nome === nome);
        if (idx >= 0) personagem.magias_preparadas.splice(idx, 1);
        else if (personagem.magias_preparadas.length >= numPreparadas) toast(`Máximo de ${numPreparadas} magias preparadas`, 'error');
        else personagem.magias_preparadas.push({ nome, circulo: Number(card.dataset.magoPreparadaCirc) });
        renderPreparadasMago();
        atualizarContadoresMagia(numTruques, numPreparadas, magoNivel1, limiteGrimorio);
      }));
    };
    renderPreparadasMago();
    const renderCirculoOriginal = renderMagiasCirculo;
    renderMagiasCirculo = (circ) => { renderCirculoOriginal(circ); renderPreparadasMago(); };
  }

  // Se tiver Iniciado em Magia, adicionar seção extra após as magias da classe
  if (temIniciadoEmMagia) {
    const divIM = document.createElement('div');
    divIM.style.marginTop = '20px';
    el.appendChild(divIM);
    _imContainerEl = divIM;
    await _renderIniciadoEmMagia(divIM, () => renderMagiasCirculo(circuloAtivo));
  }
}

// --- Iniciado em Magia: seleção de lista, truques e magia de 1o circulo (multi-instância) ---
// Entradas em personagem.talentos podem vir com sufixo de lista fixa do antecedente,
// ex.: "Iniciado em Magia (Clérigo)" (Acólito). Comparar sempre pelo nome-base.
export function _nomeBaseTalento(t) {
  return (typeof t === 'string' ? t : t?.nome || '').replace(/\s*\(.*\)$/, '').trim();
}

// Uma posição por entrada de Iniciado em Magia em personagem.talentos (na ordem);
// valor = lista fixa extraída do sufixo (ex. 'Clérigo'), ou null quando a lista é livre
function _listasFixasIM() {
  return (personagem.talentos || [])
    .map(t => (typeof t === 'string' ? t : t?.nome || ''))
    .filter(n => _nomeBaseTalento(n) === 'Iniciado em Magia')
    .map(n => {
      const m = n.match(/\(([^)]+)\)/);
      const lista = m ? m[1].trim() : '';
      return ['Clérigo', 'Druida', 'Mago'].includes(lista) ? lista : null;
    });
}

export function _contarInstanciasIM() {
  return (personagem.talentos || []).filter(t => _nomeBaseTalento(t) === 'Iniciado em Magia').length;
}

function _sincronizarInstanciasIM() {
  // Migrar formato legado (objeto único) se existir
  if (personagem.iniciado_em_magia && personagem.iniciado_em_magia.lista && !(personagem.iniciado_em_magia_instancias || []).length) {
    personagem.iniciado_em_magia_instancias = [{ ...personagem.iniciado_em_magia }];
  }
  delete personagem.iniciado_em_magia;

  if (!Array.isArray(personagem.iniciado_em_magia_instancias)) personagem.iniciado_em_magia_instancias = [];
  const fixas = _listasFixasIM();
  const num = fixas.length;
  while (personagem.iniciado_em_magia_instancias.length < num) {
    personagem.iniciado_em_magia_instancias.push({ lista: '', atributo: '', truques: [], magia: '' });
  }
  personagem.iniciado_em_magia_instancias.length = num;

  // Instâncias vindas de antecedente têm a lista determinada pela regra (ex.: Acólito → Clérigo)
  fixas.forEach((lista, i) => {
    const im = personagem.iniciado_em_magia_instancias[i];
    if (lista && im.lista !== lista) {
      im.lista = lista;
      im.truques = [];
      im.magia = '';
    }
  });
}

// aoMudar: callback opcional chamado sempre que um truque/magia é alterado dentro de uma
// instância de Iniciado em Magia — usado pra re-sincronizar o grid de truques da classe
async function _renderIniciadoEmMagia(container, aoMudar) {
  _sincronizarInstanciasIM();
  const instancias = personagem.iniciado_em_magia_instancias;
  const listasFixas = _listasFixasIM();
  const listasDisponiveis = ['Clérigo', 'Druida', 'Mago'];
  const atributosDisponiveis = ['inteligencia', 'sabedoria', 'carisma'];

  container.innerHTML = instancias.map((im, idx) => `
    <div class="card" style="border-color:var(--accent);margin-bottom:12px">
      <div class="card-header"><h3>Iniciado em Magia${instancias.length > 1 ? ` (${idx + 1} de ${instancias.length})` : ''}</h3></div>
      <div style="display:flex;flex-wrap:wrap;gap:12px;margin-bottom:12px">
        <div style="flex:1;min-width:150px">
          <label class="form-label">Lista de magias</label>
          <select class="form-input" id="im-lista-${idx}" ${listasFixas[idx] ? 'disabled' : ''}>
            <option value="">Selecione...</option>
            ${listasDisponiveis.map(l => {
              const usadaOutra = instancias.some((o, i) => i !== idx && o.lista === l);
              return `<option value="${l}" ${im.lista === l ? 'selected' : ''} ${usadaOutra && !listasFixas[idx] ? 'disabled' : ''}>${l}${usadaOutra && !listasFixas[idx] ? ' (já usada)' : ''}</option>`;
            }).join('')}
          </select>
          ${listasFixas[idx] ? `<div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px">Lista fixa (concedida pelo antecedente)</div>` : ''}
        </div>
        <div style="flex:1;min-width:150px">
          <label class="form-label">Atributo de conjuracao</label>
          <select class="form-input" id="im-atributo-${idx}">
            <option value="">Selecione...</option>
            ${atributosDisponiveis.map(a => `<option value="${a}" ${im.atributo === a ? 'selected' : ''}>${ATRIBUTOS_NOMES[a] || a}</option>`).join('')}
          </select>
        </div>
      </div>
      <div id="im-contadores-${idx}" style="font-size:0.85rem;color:var(--text-muted);margin-bottom:8px">
        Truques: <strong>${im.truques.length}/2</strong> | Magia 1o circulo: <strong>${im.magia ? '1' : '0'}/1</strong>
      </div>
      <div id="im-magias-area-${idx}"></div>
    </div>
  `).join('');

  for (let idx = 0; idx < instancias.length; idx++) {
    await _bindInstanciaIM(container, idx, aoMudar);
  }
}

// Nomes de truque/magia já escolhidos em OUTRO lugar (outra instância de Iniciado em Magia,
// truques/magias já selecionados da classe, ou truques concedidos pela espécie) — usado para
// impedir "aprender" o mesmo truque/magia duas vezes sem ganho nenhum (redundante)
function _nomesJaEscolhidosIM(idxAtual, tipo) {
  const nomes = new Set();
  (personagem.iniciado_em_magia_instancias || []).forEach((o, i) => {
    if (i === idxAtual) return;
    if (tipo === 'truque') (o.truques || []).forEach(n => nomes.add(n));
    else if (o.magia) nomes.add(o.magia);
  });
  if (tipo === 'truque') {
    (personagem.magias_conhecidas || []).filter(m => m.circulo === 0).forEach(m => nomes.add(m.nome));
    obterTruquesEspecie(personagem.especie, personagem.tracos_escolhidos).forEach(n => nomes.add(n));
  } else {
    nomesMagiaCirculo1Conhecidas(personagem).forEach(n => nomes.add(n));
  }
  return nomes;
}

// Nomes de magia de 1o circulo escolhidos por OUTRAS instâncias de Iniciado em Magia
// (apenas colisão entre instâncias do próprio talento — não conta grimório/preparadas/conhecidas)
function _outrasInstanciasIMMagia(idxAtual) {
  const nomes = new Set();
  (personagem.iniciado_em_magia_instancias || []).forEach((o, i) => {
    if (i === idxAtual) return;
    if (o.magia) nomes.add(o.magia);
  });
  return nomes;
}

async function _bindInstanciaIM(container, idx, aoMudar) {
  const im = personagem.iniciado_em_magia_instancias[idx];

  const atualizarContadoresIM = () => {
    const cEl = document.getElementById(`im-contadores-${idx}`);
    if (cEl) {
      cEl.innerHTML = `Truques: <strong>${im.truques.length}/2</strong> | Magia 1o circulo: <strong>${im.magia ? '1' : '0'}/1</strong>`;
    }
  };

  const renderMagiasIM = async () => {
    const area = document.getElementById(`im-magias-area-${idx}`);
    if (!area || !im.lista) { if (area) area.innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:10px">Selecione uma lista de magias acima</div>'; return; }

    const dados = await getMagiasClasse(im.lista);
    const listaMagias = dados?.lista_magias || {};
    const truquesDisp = (listaMagias['Truques'] || []).map(m => typeof m === 'string' ? { nome: m } : m);
    const c1Disp = (listaMagias['1º Círculo'] || []).map(m => typeof m === 'string' ? { nome: m } : m);

    area.innerHTML = `
      <div class="tabs" id="tabs-im-${idx}">
        <div class="tab active" data-im-tab="truques">Truques (${truquesDisp.length})</div>
        <div class="tab" data-im-tab="c1">1o Circulo (${c1Disp.length})</div>
      </div>
      <div class="search-box"><input type="text" id="busca-im-${idx}" placeholder="Buscar magia..." class="form-input"></div>
      <div id="im-lista-magias-${idx}"></div>
    `;

    const renderTabIM = (tab) => {
      const listaEl = document.getElementById(`im-lista-magias-${idx}`);
      if (!listaEl) return;
      const isTruque = tab === 'truques';
      const magias = isTruque ? truquesDisp : c1Disp;
      const selecionadas = isTruque ? im.truques : (im.magia ? [im.magia] : []);
      const jaEscolhidos = _nomesJaEscolhidosIM(idx, isTruque ? 'truque' : 'magia');
      const outrasInstanciasIM = isTruque ? new Set() : _outrasInstanciasIMMagia(idx);

      listaEl.innerHTML = `
        <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:8px">
          ${isTruque ? `Truques: ${im.truques.length}/2` : `Magia 1o circulo: ${im.magia ? '1' : '0'}/1`}
          | ${magias.length} disponíveis
        </div>
        ${magias.length === 0
          ? '<div style="color:var(--text-muted);text-align:center;padding:20px">Nenhuma magia disponível</div>'
          : `<div class="magias-grid">${magias.map(m => {
              const nome = m.nome || m;
              const sel = selecionadas.includes(nome);
              const bloqueado = jaEscolhidos.has(nome) && !sel;
              const bloqueioVisual = isTruque && bloqueado;
              return `
                <div class="magia-card ${sel ? 'selecionada' : ''} ${bloqueioVisual ? 'magia-card-bloqueada' : ''}" data-im-magia="${nome}" data-im-tipo="${tab}" ${bloqueioVisual ? 'style="opacity:0.4"' : ''}>
                  <span class="magia-card-check" data-im-check="${nome}"></span>
                  <div class="magia-card-nome" data-im-info="${nome}" data-im-info-circ="${isTruque ? 0 : 1}">${nome}${bloqueado ? ' (já conhecido)' : ''}</div>
                  <div class="magia-card-meta">
                    <span>${m.escola || ''}</span>
                    ${m.especial === 'C' ? '<span>Conc.</span>' : ''}
                    ${m.especial === 'M' ? '<span>M$</span>' : ''}
                  </div>
                </div>`;
            }).join('')}</div>`
        }
      `;

      listaEl.querySelectorAll('[data-im-check]').forEach(chk => {
        chk.addEventListener('click', (e) => {
          e.stopPropagation();
          const card = chk.closest('.magia-card');
          const nome = card.dataset.imMagia;
          const jaSelecionado = isTruque ? im.truques.includes(nome) : im.magia === nome;
          if (isTruque && !jaSelecionado && jaEscolhidos.has(nome)) {
            toast(`"${nome}" já é conhecido por outra fonte — escolha um diferente`, 'error');
            return;
          }
          if (!isTruque && !jaSelecionado && outrasInstanciasIM.has(nome)) {
            toast(`"${nome}" já foi escolhido por outra instância de Iniciado em Magia — escolha outra`, 'error');
            return;
          }
          if (isTruque) {
            const i = im.truques.indexOf(nome);
            if (i >= 0) { im.truques.splice(i, 1); }
            else if (im.truques.length >= 2) { toast('Máximo de 2 truques para Iniciado em Magia', 'error'); return; }
            else { im.truques.push(nome); }
          } else {
            if (im.magia === nome) { im.magia = ''; }
            else { im.magia = nome; }
          }
          renderTabIM(tab);
          atualizarContadoresIM();
          // Truque/magia da classe pode precisar refletir esta escolha (contra-duplicata cruzada)
          aoMudar?.();
        });
      });

      listaEl.querySelectorAll('[data-im-info]').forEach(el => {
        el.addEventListener('click', async (e) => {
          e.stopPropagation();
          const nome = el.dataset.imInfo;
          const c = parseInt(el.dataset.imInfoCirc);
          await mostrarDetalheMagia(nome, c);
        });
      });
    };

    area.querySelectorAll('[data-im-tab]').forEach(tab => {
      tab.addEventListener('click', () => {
        area.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        renderTabIM(tab.dataset.imTab);
      });
    });

    document.getElementById(`busca-im-${idx}`)?.addEventListener('input', (e) => {
      const termo = semAcento(e.target.value);
      document.querySelectorAll(`#im-lista-magias-${idx} .magia-card`).forEach(el => {
        el.style.display = semAcento(el.textContent).includes(termo) ? '' : 'none';
      });
    });

    renderTabIM('truques');
  };

  document.getElementById(`im-lista-${idx}`)?.addEventListener('change', async (e) => {
    im.lista = e.target.value;
    im.truques = [];
    im.magia = '';
    await _renderIniciadoEmMagia(container, aoMudar);
    aoMudar?.();
  });

  document.getElementById(`im-atributo-${idx}`)?.addEventListener('change', (e) => {
    im.atributo = e.target.value;
  });

  await renderMagiasIM();
}

function toggleMagia(nome, circulo, isTruque, maxTruques, maxPreparadas, magoNivel1 = false, limiteGrimorio = 0) {
  const tipoConj = CLASSES_INFO[personagem.classe]?.tipo_conjuracao || 'preparadas';
  const labelMagias = tipoConj === 'conhecidas' ? 'magias conhecidas' : 'magias preparadas';
  if (isTruque) {
    const idx = (personagem.magias_conhecidas || []).findIndex(m => m.nome === nome);
    if (idx >= 0) {
      personagem.magias_conhecidas.splice(idx, 1);
    } else {
      const truquesAtual = personagem.magias_conhecidas.filter(m => m.circulo === 0).length;
      if (truquesAtual >= maxTruques) { toast(`Máximo de ${maxTruques} truques`, 'error'); return; }
      personagem.magias_conhecidas.push({ nome, circulo });
    }
  } else if (magoNivel1) {
    if (!Array.isArray(personagem.grimorio)) personagem.grimorio = [];
    const idx = personagem.grimorio.findIndex(m => m.nome === nome);
    if (idx >= 0) {
      personagem.grimorio.splice(idx, 1);
      personagem.magias_preparadas = (personagem.magias_preparadas || []).filter(m => m.nome !== nome);
    } else {
      if (personagem.grimorio.length >= limiteGrimorio) { toast(`Máximo de ${limiteGrimorio} magias no grimório`, 'error'); return; }
      personagem.grimorio.push({ nome, circulo });
    }
  } else {
    const idx = (personagem.magias_preparadas || []).findIndex(m => m.nome === nome);
    if (idx >= 0) {
      personagem.magias_preparadas.splice(idx, 1);
    } else {
      if (personagem.magias_preparadas.length >= maxPreparadas) { toast(`Máximo de ${maxPreparadas} ${labelMagias}`, 'error'); return; }
      personagem.magias_preparadas.push({ nome, circulo });
    }
  }
}

function atualizarContadoresMagia(maxTruques, maxPrep, magoNivel1 = false, limiteGrimorio = 0) {
  const infoBox = document.querySelector('#wizard-content .info-box.info');
  if (!infoBox) return;
  const numT = (personagem.magias_conhecidas || []).filter(m => m.circulo === 0).length;
  const numP = (personagem.magias_preparadas || []).length;
  const tipoConj = CLASSES_INFO[personagem.classe]?.tipo_conjuracao || 'preparadas';
  const labelMagias = tipoConj === 'conhecidas' ? 'Magias conhecidas' : 'Magias preparadas';
  const grimorio = Array.isArray(personagem.grimorio) ? personagem.grimorio.length : 0;
  infoBox.innerHTML = `Truques: <strong>${numT}/${maxTruques}</strong> | ${magoNivel1 ? `Grimório: <strong>${grimorio}/${limiteGrimorio}</strong> | ` : ''}${labelMagias}: <strong>${numP}/${maxPrep}</strong> | Atributo: <strong>${CLASSES_INFO[personagem.classe]?.atributo_conjuracao || ''}</strong>`;
}

async function mostrarDetalheMagia(nome, circulo) {
  // Buscar magia completa
  const dados = await import('../db.js').then(m => m.getMagiasPorCirculo(circulo));
  const magia = dados?.magias?.find(m => m.nome === nome);
  if (!magia) { toast('Magia não encontrada', 'error'); return; }

  abrirModal(magia.nome, `
    <div class="magia-meta" style="margin-bottom:8px;display:flex;flex-wrap:wrap;gap:8px;font-size:0.85rem">
      <span class="badge badge-primary">${circulo === 0 ? 'Truque' : circulo + 'º Círculo'}</span>
      <span class="badge badge-secondary">${magia.escola}</span>
      <span>${magia.tempo_conjuracao}</span>
      <span>${magia.alcance}</span>
      <span>${magia.componentes}</span>
      <span>${magia.duracao}</span>
    </div>
    <div class="md-content">${mdParaHtml(magia.descricao)}</div>
    ${magia.circulo_superior ? `<div class="info-box info mt-1"><strong>Em círculos superiores:</strong> ${magia.circulo_superior}</div>` : ''}
    <div style="font-size:0.8rem;color:var(--text-muted);margin-top:8px">Classes: ${(magia.classes || []).join(', ')}</div>
  `);
}