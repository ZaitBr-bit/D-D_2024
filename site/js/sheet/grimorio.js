// ============================================================
// Buscas e trocas de magia
//
// Modais de busca, grimorio do Mago, troca por descanso e preenchimento
// de espaco livre.
// Extraido de site/js/pages/sheet.js sem alteracao de comportamento.
// ============================================================
import { CLASSES_INFO } from '../dados-classes.js';
import { getIndiceMagias, getMagiasPorCirculo } from '../db.js';
import { VALOR_EM_COBRE, formatarCarteira, podePagar, retirarValor } from '../moedas.js';
import { abrirModal, escHtml, getBonusTruquesOrdem, getEspacosMagia, getLimitesMagias, magiaMagoEstaNoGrimorio, mdParaHtml, normalizarGrimorioMago, semAcento, toast } from '../utils.js';
import { montarSeletor } from '../ui-opcoes.js';
import { deMagias } from '../opcoes-dominio.js';
import { getTruquesExtraEstiloLuta } from './combate.js';
import { MAGIAS_FIXAS_MAGO, definirMagiasFixasMago, getEstadoRecursosMago } from './classes/mago.js';
import { char, classeData, indiceMagiasCache, magiasDominioCache, magiasSempreCache, salvar } from './estado.js';
import { renderFichaCompleta } from './ficha.js';
import { ehSubclasseConjuradora, getSubclasseConjuradoraConjuracao, magiaContaNoLimite, magiaEhEspecial, obterMagiasDisponiveisClasseAtual, rotuloOrigemMagia } from './magias.js';
import { truqueEhTrocavel } from '../regras-origens-magia.js';

export async function mostrarBuscaMagia() {
  const info = CLASSES_INFO[char.classe] || {};
  const subConj = getSubclasseConjuradoraConjuracao();
  const tipoConj = info.tipo_conjuracao || (subConj ? 'conhecidas' : 'preparadas');
  const labelMg = tipoConj === 'conhecidas' ? 'Conhecida' : 'Preparada';
  const ehMago = char.classe === 'Mago';
  // Classes "conhecidas" (Bardo, Bruxo, Feiticeiro) e subclasses conjuradoras: somente consulta
  const somenteConsulta = tipoConj === 'conhecidas';
  const tabela = classeData?.tabela_caracteristicas;
  // Sem tabela e sem subclasse conjuradora não há limite conhecido: 99 é o
  // "à vontade" histórico desta tela. Com qualquer uma das duas, o limite
  // sai de getLimitesMagias (utils.js), a mesma função que a seção Magias
  // da ficha usa -- antes o fallback daqui só valia quando NÃO havia
  // tabela, e o Ladino (que tem tabela, sem colunas de magia) ficava com
  // limite 0 e a grade inteira bloqueada.
  const semLimiteConhecido = !tabela && !subConj;
  const limites = getLimitesMagias(tabela, char.nivel, subConj);
  let maxPrep = semLimiteConhecido ? 99 : limites.preparadas;
  let maxTruq = semLimiteConhecido ? 99 : limites.truques;
  // Truques extras de Combatente Druídico / Abençoado
  maxTruq += getTruquesExtraEstiloLuta();
  // Truques extras do Clérigo Taumaturgo / Druida Xamã (utils.js, mesma
  // função que o criador usa -- antes só o criador somava esse bônus, e a
  // ficha calculava o limite sem ele)
  maxTruq += getBonusTruquesOrdem(char);

  // Espaços de magia para determinar círculos disponíveis
  let espacosNivel = tabela ? getEspacosMagia(tabela, char.nivel) : {};
  // Fallback para subclasses conjuradoras
  if (subConj && Object.keys(espacosNivel).length === 0) {
    espacosNivel = subConj.espacos || {};
  }
  const circulosDisponiveis = Object.keys(espacosNivel).map(Number).sort((a, b) => a - b);
  const maxCirculo = circulosDisponiveis.length > 0 ? Math.max(...circulosDisponiveis) : 9;

  // Carregar magias da classe (pré-carrega tudo)
  const magiasClasseClasse = await obterMagiasDisponiveisClasseAtual();
  // Magias de círculo do Mago só podem ser preparadas se já estiverem registradas.
  // Truques continuam usando a lista de classe, pois não pertencem ao grimório.
  const magiasClasse = ehMago
    ? [
        ...magiasClasseClasse.filter(m => m.circulo === 0),
        ...(Array.isArray(char.grimorio) ? char.grimorio : []).map(registrada => ({
          ...(magiasClasseClasse.find(m => m.nome === registrada?.nome) || {}),
          ...registrada
        }))
      ]
    : magiasClasseClasse;

  // Magias já possuídas
  const jaPreparadas = new Set((char.magias_preparadas || []).map(m => m.nome));
  const jaConhecidas = new Set((char.magias_conhecidas || []).map(m => m.nome));
  const preparadasNormais = (char.magias_preparadas || []).filter(m => magiaContaNoLimite(m));

  // Separar por círculo
  const truquesClasse = magiasClasse.filter(m => m.circulo === 0);
  const magiasCirculo = {};
  for (let c = 1; c <= maxCirculo; c++) {
    const doCirculo = magiasClasse.filter(m => m.circulo === c);
    if (doCirculo.length > 0) magiasCirculo[c] = doCirculo;
  }

  // Tabs: Preparadas, Truques, 1º, 2º, ...
  const tabs = ['preparadas', 'truques'];
  Object.keys(magiasCirculo).forEach(c => tabs.push(c));

  abrirModal(somenteConsulta ? 'Consultar Magias' : 'Gerenciar Magias', `
    ${somenteConsulta ? '<div class="info-box info" style="margin-bottom:8px;font-size:0.85rem">Magias conhecidas sao definidas na <strong>subida de nivel</strong>. Use o <strong>Descanso Longo</strong> para trocar 1 magia.</div>' : ''}
    <div style="margin-bottom:8px;display:flex;flex-wrap:wrap;gap:6px;font-size:0.78rem">
      <span class="magia-contador ${(char.magias_conhecidas || []).filter(m => m.circulo === 0 && m.origem !== 'especie').length >= maxTruq ? 'contador-cheio' : ''}" id="gm-contador-truques">
        Truques: ${(char.magias_conhecidas || []).filter(m => m.circulo === 0 && m.origem !== 'especie').length}/${maxTruq}
      </span>
      <span class="magia-contador ${preparadasNormais.length >= maxPrep ? 'contador-cheio' : preparadasNormais.length > maxPrep ? 'contador-excedido' : ''}" id="gm-contador-preparadas">
        ${labelMg}s: ${preparadasNormais.length}/${maxPrep}
      </span>
    </div>
    <div class="tabs" id="tabs-gerenciar-magias" style="margin-bottom:8px;overflow-x:auto;white-space:nowrap">
      <div class="tab active" data-tab-mg="preparadas">${labelMg}s Atuais</div>
      <div class="tab" data-tab-mg="truques">Truques</div>
      ${Object.keys(magiasCirculo).map(c => `<div class="tab" data-tab-mg="${c}">${c}º Círculo</div>`).join('')}
    </div>
    <div class="search-box"><input type="text" id="busca-magia-add" placeholder="Buscar magia..." class="form-input"></div>
    <div id="resultado-magias" style="min-height:35dvh;max-height:50dvh;overflow-y:auto"></div>
  `, '', () => renderFichaCompleta());

  const resultadoEl = document.getElementById('resultado-magias');
  let tabAtiva = 'preparadas';

  function renderTab() {
    const termo = semAcento(document.getElementById('busca-magia-add')?.value || '');
    let html = '';

    if (tabAtiva === 'preparadas') {
      // Mostrar magias preparadas/conhecidas atuais (para remover)
      const especiais = (char.magias_preparadas || []).filter(m => magiaEhEspecial(m));
      const normais = (char.magias_preparadas || []).filter(m => magiaContaNoLimite(m));
      const filtradas = termo.length >= 2 ? normais.filter(m => semAcento(m.nome).includes(termo)) : normais;
      const filtradasDom = termo.length >= 2 ? especiais.filter(m => semAcento(m.nome).includes(termo)) : especiais;

      html += `<div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:8px">${labelMg}s: ${normais.length}/${maxPrep}${somenteConsulta ? '' : ' | Use o <strong>check</strong> para (des)marcar'}</div>`;

      if (filtradasDom.length > 0) {
        html += `<div style="font-size:0.75rem;font-weight:700;color:var(--secondary);margin:8px 0 4px">Magias Especiais</div>`;
        html += `<div class="opcao-grid densa">${filtradasDom.map(m => `
          <div class="opcao-card selecionada magia-dominio" style="opacity:0.7;cursor:default">
            <span class="opcao-check"></span>
            <div class="opcao-nome" data-detalhe-magia="${m.nome}" data-detalhe-circ="${m.circulo}" style="cursor:pointer"><span class="badge-dominio">&#9733;</span> ${m.nome}</div>
            <div class="opcao-resumo"><span>${rotuloOrigemMagia(m)}</span></div>
          </div>
        `).join('')}</div>`;
      }

      if (filtradas.length > 0) {
        html += `<div class="opcao-grid densa">${filtradas.map(m => `
          <div class="opcao-card selecionada">
            <span class="opcao-check" ${somenteConsulta ? '' : `data-remover-check="${m.nome}" style="cursor:pointer"`}></span>
            <div class="opcao-nome" data-detalhe-magia="${m.nome}" data-detalhe-circ="${m.circulo}" style="cursor:pointer">${m.nome}</div>
            <div class="opcao-resumo">
              <span>${m.circulo || 0}º Circulo</span>
            </div>
          </div>
        `).join('')}</div>`;
      } else if (normais.length === 0) {
        html += `<div style="text-align:center;color:var(--text-muted);padding:16px">Nenhuma magia ${labelMg.toLowerCase()} ainda.</div>`;
      }
    } else if (tabAtiva === 'truques') {
      // Truques: grid da classe com toggle
      const truquesAtuais = (char.magias_conhecidas || []).filter(m => m.circulo === 0);
      const truquesEsp = truquesAtuais.filter(m => m.origem === 'especie');
      const numTruq = truquesAtuais.length - truquesEsp.length;
      html += `<div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:8px">Truques: ${numTruq}/${maxTruq}${truquesEsp.length > 0 ? ` (+${truquesEsp.length} espécie)` : ''}</div>`;

      const selecionadosSet = new Set(truquesAtuais.map(m => m.nome));
      const truquesEspSet = new Set(truquesEsp.map(m => m.nome));

      // Exibir truques de espécie (não removíveis) primeiro
      if (truquesEsp.length > 0) {
        let listaEsp = truquesEsp;
        if (termo.length >= 2) listaEsp = listaEsp.filter(m => semAcento(m.nome).includes(termo));
        html += `<div style="font-size:0.75rem;font-weight:700;color:var(--secondary);margin:8px 0 4px">Truques de Espécie</div>`;
        html += `<div class="opcao-grid densa">${listaEsp.map(m => `
          <div class="opcao-card selecionada magia-dominio" style="opacity:0.7;cursor:default">
            <span class="opcao-check"></span>
            <div class="opcao-nome" data-detalhe-magia="${m.nome}" data-detalhe-circ="0" style="cursor:pointer"><span class="badge-dominio">&#9733;</span> ${m.nome}</div>
            <div class="opcao-resumo"><span>Especie</span></div>
          </div>
        `).join('')}</div>`;
      }

      let lista = [...truquesClasse];
      lista.sort((a, b) => {
        const aSel = selecionadosSet.has(a.nome) ? 0 : 1;
        const bSel = selecionadosSet.has(b.nome) ? 0 : 1;
        return aSel - bSel || a.nome.localeCompare(b.nome);
      });
      // Filtrar truques de espécie da lista de classe (evitar duplicatas)
      lista = lista.filter(m => !truquesEspSet.has(m.nome));
      if (termo.length >= 2) lista = lista.filter(m => semAcento(m.nome).includes(termo));
      const cheioTruq = numTruq >= maxTruq;

      html += `<div class="opcao-grid densa">${lista.map(m => {
        const sel = selecionadosSet.has(m.nome);
        const bloqueado = cheioTruq && !sel;
        return `
          <div class="opcao-card ${sel ? 'selecionada' : ''} ${bloqueado ? 'bloqueada' : ''}"
               ${somenteConsulta ? '' : `data-toggle-truque="${m.nome}"`} style="${bloqueado ? 'opacity:0.35;' : ''}">
            <span class="opcao-check" ${somenteConsulta ? '' : `data-truque-check="${m.nome}" style="cursor:pointer"`}></span>
            <div class="opcao-nome" data-detalhe-magia="${m.nome}" data-detalhe-circ="0" style="cursor:pointer">${m.nome}</div>
            <div class="opcao-resumo">
              <span>${m.escola || ''}</span>
              ${m.especial === 'C' ? '<span>Conc.</span>' : ''}
            </div>
          </div>`;
      }).join('')}</div>`;
    } else {
      // Magias de um círculo específico — grid
      const circ = parseInt(tabAtiva);
      const magiasDoCirc = magiasCirculo[circ] || [];
      const selecionadasSet = new Set((char.magias_preparadas || []).filter(m => m.circulo === circ).map(m => m.nome));
      const numAtual = preparadasNormais.length;
      const cheio = numAtual >= maxPrep;

      html += `<div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:8px">${labelMg}s: ${numAtual}/${maxPrep}${cheio ? ' <span style="color:var(--danger)">(Limite atingido)</span>' : ''}</div>`;

      let lista = [...magiasDoCirc];
      lista.sort((a, b) => {
        const aSel = selecionadasSet.has(a.nome) ? 0 : 1;
        const bSel = selecionadasSet.has(b.nome) ? 0 : 1;
        return aSel - bSel || a.nome.localeCompare(b.nome);
      });
      if (termo.length >= 2) lista = lista.filter(m => semAcento(m.nome).includes(termo));

      html += `<div class="opcao-grid densa">${lista.map(m => {
        const sel = selecionadasSet.has(m.nome);
        const isDominio = (char.magias_preparadas || []).find(p => p.nome === m.nome && magiaEhEspecial(p));
        const bloqueado = cheio && !sel && !isDominio;
        return `
          <div class="opcao-card ${sel ? 'selecionada' : ''} ${isDominio ? 'magia-dominio' : ''} ${bloqueado ? 'bloqueada' : ''}"
               style="${bloqueado ? 'opacity:0.35;' : ''}${isDominio ? 'opacity:0.7;' : ''}">
            <span class="opcao-check" ${isDominio || somenteConsulta ? '' : `data-circ-check="${m.nome}" data-circ-check-val="${circ}" style="cursor:pointer"`}></span>
            <div class="opcao-nome" data-detalhe-magia="${m.nome}" data-detalhe-circ="${circ}" style="cursor:pointer">${isDominio ? '<span class="badge-dominio">&#9733;</span> ' : ''}${m.nome}</div>
            <div class="opcao-resumo">
              <span>${m.escola || ''}</span>
              ${m.especial === 'C' ? '<span>Conc.</span>' : ''}
              ${isDominio ? '<span>Especial</span>' : ''}
            </div>
          </div>`;
      }).join('')}</div>`;
    }

    resultadoEl.innerHTML = html;
    bindEventosTab();
  }

  function bindEventosTab() {
    // Remover magia preparada (via check na aba "Preparadas Atuais")
    resultadoEl.querySelectorAll('[data-remover-check]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const nome = el.dataset.removerCheck;
        const idx = char.magias_preparadas.findIndex(m => m.nome === nome);
        if (idx >= 0) {
          char.magias_preparadas.splice(idx, 1);
          salvar();
          toast(`${nome} removida`, 'success');
          atualizarContadores();
          renderTab();
        }
      });
    });

    // Toggle truque (via check)
    resultadoEl.querySelectorAll('[data-truque-check]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const nome = el.dataset.truqueCheck;
        // Não permitir remover truques de espécie
        const entradaExistente = (char.magias_conhecidas || []).find(m => m.nome === nome);
        if (entradaExistente && entradaExistente.origem === 'especie') return;
        const idx = (char.magias_conhecidas || []).findIndex(m => m.nome === nome);
        if (idx >= 0) {
          char.magias_conhecidas.splice(idx, 1);
          salvar();
          toast(`${nome} removido`, 'success');
        } else {
          const numAtual = (char.magias_conhecidas || []).filter(m => m.circulo === 0 && m.origem !== 'especie').length;
          if (numAtual >= maxTruq) { toast(`Limite de ${maxTruq} truques atingido`, 'error'); return; }
          char.magias_conhecidas.push({ nome, circulo: 0 });
          salvar();
          toast(`${nome} adicionado`, 'success');
        }
        atualizarContadores();
        renderTab();
      });
    });

    // Toggle magia de circulo (via check)
    resultadoEl.querySelectorAll('[data-circ-check]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const nome = el.dataset.circCheck;
        const circ = parseInt(el.dataset.circCheckVal);
        const idx = char.magias_preparadas.findIndex(m => m.nome === nome);
        if (idx >= 0) {
          // Remover
          char.magias_preparadas.splice(idx, 1);
          salvar();
          toast(`${nome} removida`, 'success');
        } else {
          // Adicionar — verificar limite
          const numAtual = (char.magias_preparadas || []).filter(m => magiaContaNoLimite(m)).length;
          if (numAtual >= maxPrep) { toast(`Limite de ${maxPrep} magias atingido. Remova uma antes de adicionar.`, 'error'); return; }
          if (ehMago && !magiaMagoEstaNoGrimorio(char, nome)) {
            toast('Essa magia não está registrada no grimório.', 'error');
            return;
          }
          char.magias_preparadas.push({ nome, circulo: circ });
          salvar();
          toast(`${nome} adicionada`, 'success');
        }
        atualizarContadores();
        renderTab();
      });
    });

    // Botão de detalhes da magia
    resultadoEl.querySelectorAll('[data-detalhe-magia]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const nome = btn.dataset.detalheMagia;
        const circ = parseInt(btn.dataset.detalheCirc);
        const dados = await getMagiasPorCirculo(circ);
        const magia = dados?.magias?.find(m => m.nome === nome);
        if (!magia) { toast('Detalhes não encontrados', 'error'); return; }
        // Abrir sub-modal com detalhes
        const detalhesHtml = `
          <div class="magia-meta" style="margin-bottom:8px;display:flex;flex-wrap:wrap;gap:8px;font-size:0.85rem">
            <span class="badge badge-primary">${circ === 0 ? 'Truque' : circ + 'º Círculo'}</span>
            <span class="badge badge-secondary">${magia.escola}</span>
            <span>${magia.tempo_conjuracao}</span>
            <span>${magia.alcance}</span>
            <span>${magia.componentes}</span>
            <span>${magia.duracao}</span>
          </div>
          <div class="md-content">${mdParaHtml(magia.descricao)}</div>
          ${magia.circulo_superior ? `<div class="info-box info mt-1"><strong>Em círculos superiores:</strong><div class="md-content">${mdParaHtml(magia.circulo_superior)}</div></div>` : ''}
          ${(magia.classes || []).length > 0 ? `<div style="font-size:0.8rem;color:var(--text-muted);margin-top:8px">Classes: ${magia.classes.join(', ')}</div>` : ''}
        `;
        abrirModal(magia.nome, detalhesHtml, '<button class="btn btn-primary" onclick="fecharModal()">Fechar</button>');
      });
    });
  }

  function atualizarContadores() {
    // Recalcular preparadas normais a partir do char
    preparadasNormais.length = 0;
    (char.magias_preparadas || []).filter(m => magiaContaNoLimite(m)).forEach(m => preparadasNormais.push(m));

    // Atualizar contador de truques no topo do modal
    // Excluir truques de espécie do contador de classe
    const numTruques = (char.magias_conhecidas || []).filter(m => m.circulo === 0 && m.origem !== 'especie').length;
    const contTruques = document.getElementById('gm-contador-truques');
    if (contTruques) {
      contTruques.textContent = `Truques: ${numTruques}/${maxTruq}`;
      contTruques.className = `magia-contador ${numTruques >= maxTruq ? 'contador-cheio' : ''}`;
    }

    // Atualizar contador de preparadas no topo do modal
    const contPrep = document.getElementById('gm-contador-preparadas');
    if (contPrep) {
      contPrep.textContent = `${labelMg}s: ${preparadasNormais.length}/${maxPrep}`;
      contPrep.className = `magia-contador ${preparadasNormais.length >= maxPrep ? 'contador-cheio' : preparadasNormais.length > maxPrep ? 'contador-excedido' : ''}`;
    }
  }

  // Tabs
  document.querySelectorAll('#tabs-gerenciar-magias .tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('#tabs-gerenciar-magias .tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      tabAtiva = tab.dataset.tabMg;
      document.getElementById('busca-magia-add').value = '';
      renderTab();
    });
  });

  // Busca
  document.getElementById('busca-magia-add')?.addEventListener('input', renderTab);

  // Renderizar tab inicial (preparadas atuais)
  renderTab();
}

export async function mostrarFormMagiaCustom(indiceEdicao = null) {
  const magiaExistente = Number.isInteger(indiceEdicao)
    ? (char.magias_customizadas || [])[indiceEdicao]
    : null;
  if (Number.isInteger(indiceEdicao) && !magiaExistente) return;
  let indice = null;
  try {
    indice = await getIndiceMagias();
  } catch (_) {
    // O cache carregado pela ficha ainda permite criar a magia sem bloquear a tela.
  }
  const magiasIndice = indice?.magias || indiceMagiasCache || [];
  const tempoConjuracaoMagiaValido = (valor) => {
    const tempo = String(valor || '').trim();
    if (!tempo || /^(ama\s+ação|ama\s+acao)$/i.test(tempo)) return false;
    if (/crescimento excessivo|fertiliza[cç][aã]o|arma|ataque desarmado/i.test(tempo)) return false;
    return /^(?:a[cç][aã]o(?:\s+ou\s+ritual)?|a[cç][aã]o\s+b[oô]nus|1\s+a[cç][aã]o(?:\s+ou\s+ritual)?|rea[cç][aã]o(?:\b|\s+ou\s+ritual)|\d+\s+(?:minuto|minutos|hora|horas|dia|dias)(?:\s+ou\s+ritual)?)(?:\s|,|$)/i.test(tempo);
  };
  const valoresUnicos = campo => [...new Set(magiasIndice
    .map(magia => String(magia?.[campo] || '').trim())
    .filter(valor => Boolean(valor) && (campo !== 'tempo_conjuracao' || tempoConjuracaoMagiaValido(valor))))]
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const opcoes = {
    escolas: valoresUnicos('escola'),
    tempos: [
      'Ação', 'Ação Bônus', 'Reação', '1 ação', '1 minuto', '10 minutos',
      '1 hora', '8 horas', '12 horas', '24 horas', 'Ação ou Ritual',
      '1 ação ou Ritual', '1 minuto ou Ritual', '10 minutos ou Ritual', '1 hora ou Ritual'
    ],
    duracoes: valoresUnicos('duracao')
  };
  const opcoesSelect = (valores, rotulo) => `
    <option value="">Selecione ${rotulo}</option>
    ${valores.map(valor => `<option value="${escHtml(valor)}">${escHtml(valor)}</option>`).join('')}
    <option value="__personalizado__">Personalizado…</option>`;

  abrirModal(magiaExistente ? 'Editar Magia Personalizada' : 'Magia Personalizada', `
    <div class="form-group">
      <label class="form-label" for="mc-nome">Nome</label>
      <input type="text" class="form-input" id="mc-nome" placeholder="Nome da magia">
    </div>
    <div class="row gap-1">
      <div class="col">
        <label class="form-label" for="mc-circulo">Circulo</label>
        <select class="form-select" id="mc-circulo">
          <option value="0">Truque</option>
          ${[1,2,3,4,5,6,7,8,9].map(i => `<option value="${i}">${i}o Circulo</option>`).join('')}
        </select>
      </div>
      <div class="col">
        <label class="form-label" for="mc-escola">Escola</label>
        <select class="form-select" id="mc-escola">${opcoesSelect(opcoes.escolas, 'a escola')}</select>
        <input type="text" class="form-input" id="mc-escola-personalizada" placeholder="Informe a escola" style="display:none;margin-top:6px">
      </div>
    </div>
    <div class="row gap-1">
      <div class="col">
        <label class="form-label" for="mc-tempo">Tempo de Conjuração</label>
        <select class="form-select" id="mc-tempo">${opcoesSelect(opcoes.tempos, 'o tempo')}</select>
        <input type="text" class="form-input" id="mc-tempo-personalizado" placeholder="Informe o tempo de conjuração" style="display:none;margin-top:6px">
        <input type="text" class="form-input" id="mc-gatilho-reacao" placeholder="Gatilho da reação (opcional)" style="display:none;margin-top:6px">
      </div>
      <div class="col"><label class="form-label" for="mc-alcance">Alcance</label><input type="text" class="form-input" id="mc-alcance" value="9 metros"></div>
    </div>
    <div class="row gap-1">
      <div class="col">
        <label class="form-label">Componentes</label>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin:4px 0">
          <label><input type="checkbox" id="mc-comp-v" value="V"> V — Verbal</label>
          <label><input type="checkbox" id="mc-comp-s" value="S"> S — Somático</label>
          <label><input type="checkbox" id="mc-comp-m" value="M"> M — Material</label>
        </div>
        <input type="text" class="form-input" id="mc-comp-outro" placeholder="Outro componente ou detalhe material (opcional)">
      </div>
      <div class="col">
        <label class="form-label" for="mc-duracao">Duração</label>
        <select class="form-select" id="mc-duracao">${opcoesSelect(opcoes.duracoes, 'a duração')}</select>
        <div id="mc-duracao-personalizada" style="display:none;margin-top:6px">
          <div style="display:flex;gap:6px">
            <input type="number" min="1" step="1" class="form-input" id="mc-duracao-quantidade" placeholder="Quantidade" style="min-width:0">
            <select class="form-select" id="mc-duracao-unidade" style="min-width:0">
              <option value="turnos">turnos</option>
              <option value="minutos">minutos</option>
              <option value="horas">horas</option>
              <option value="dias">dias</option>
            </select>
          </div>
          <input type="text" class="form-input" id="mc-duracao-texto" placeholder="Ou duração complementar, ex.: Até ser dissipada" style="margin-top:6px">
        </div>
      </div>
    </div>
    <label style="display:flex;align-items:center;gap:6px;margin:10px 0"><input type="checkbox" id="mc-ritual"> Pode ser conjurada como Ritual</label>
    <div class="form-group">
      <label class="form-label" for="mc-desc">Descricao</label>
      <textarea class="form-textarea" id="mc-desc" rows="4" placeholder="Descricao da magia..."></textarea>
    </div>
    <div class="form-group">
      <label class="form-label" for="mc-dano">Dano / Efeito</label>
      <input type="text" class="form-input" id="mc-dano" placeholder="Ex: 3d6 fogo">
    </div>
  `, `<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-primary" id="btn-salvar-mc">${magiaExistente ? 'Salvar Alterações' : 'Adicionar'}</button>`);

  const alternarPersonalizado = (selectId, campoId) => {
    const select = document.getElementById(selectId);
    const campo = document.getElementById(campoId);
    if (!select || !campo) return;
    const atualizar = () => { campo.style.display = select.value === '__personalizado__' ? '' : 'none'; };
    select.addEventListener('change', atualizar);
    atualizar();
  };
  alternarPersonalizado('mc-escola', 'mc-escola-personalizada');
  alternarPersonalizado('mc-tempo', 'mc-tempo-personalizado');
  alternarPersonalizado('mc-duracao', 'mc-duracao-personalizada');

  const atualizarGatilhoReacao = () => {
    const selectTempo = document.getElementById('mc-tempo');
    const campo = document.getElementById('mc-gatilho-reacao');
    if (!selectTempo || !campo) return;
    campo.style.display = /^rea[cç][aã]o$/i.test(selectTempo.value) ? '' : 'none';
  };
  document.getElementById('mc-tempo')?.addEventListener('change', atualizarGatilhoReacao);
  atualizarGatilhoReacao();

  if (magiaExistente) {
    const definirSelectOuPersonalizado = (selectId, inputId, valor) => {
      const select = document.getElementById(selectId);
      const input = document.getElementById(inputId);
      if (!select || !input) return;
      const possuiOpcao = [...select.options].some(opcao => opcao.value === valor);
      select.value = possuiOpcao ? valor : '__personalizado__';
      input.value = valor;
      select.dispatchEvent(new Event('change'));
    };
    document.getElementById('mc-nome').value = magiaExistente.nome || '';
    document.getElementById('mc-circulo').value = String(Number(magiaExistente.circulo) || 0);
    definirSelectOuPersonalizado('mc-escola', 'mc-escola-personalizada', magiaExistente.escola || '');
    const tempoExistente = String(magiaExistente.tempo_conjuracao || '');
    const matchReacao = tempoExistente.match(/^rea[cç][aã]o\s*,\s*(.+)$/i);
    definirSelectOuPersonalizado('mc-tempo', 'mc-tempo-personalizado', matchReacao ? 'Reação' : tempoExistente);
    if (matchReacao) document.getElementById('mc-gatilho-reacao').value = matchReacao[1];
    atualizarGatilhoReacao();
    definirSelectOuPersonalizado('mc-duracao', 'mc-duracao-texto', magiaExistente.duracao || '');
    document.getElementById('mc-alcance').value = magiaExistente.alcance || '';
    document.getElementById('mc-desc').value = magiaExistente.descricao || '';
    document.getElementById('mc-dano').value = magiaExistente.dano || '';
    document.getElementById('mc-ritual').checked = Boolean(magiaExistente.ritual);
    const componentes = String(magiaExistente.componentes || '').split(',').map(valor => valor.trim());
    ['V', 'S', 'M'].forEach(letra => { document.getElementById(`mc-comp-${letra.toLowerCase()}`).checked = componentes.includes(letra); });
    document.getElementById('mc-comp-outro').value = componentes.filter(valor => !['V', 'S', 'M'].includes(valor)).join(', ');
  }

  const sincronizarRitualComTempo = () => {
    const selectTempo = document.getElementById('mc-tempo');
    const inputTempo = document.getElementById('mc-tempo-personalizado');
    const ritual = document.getElementById('mc-ritual');
    if (!selectTempo || !inputTempo || !ritual) return;
    const tempo = selectTempo.value === '__personalizado__' ? inputTempo.value : selectTempo.value;
    ritual.checked = /\britual\b/i.test(tempo || '');
  };
  document.getElementById('mc-tempo')?.addEventListener('change', sincronizarRitualComTempo);
  document.getElementById('mc-tempo-personalizado')?.addEventListener('input', sincronizarRitualComTempo);
  sincronizarRitualComTempo();

  document.getElementById('btn-salvar-mc')?.addEventListener('click', () => {
    const nome = document.getElementById('mc-nome')?.value?.trim();
    if (!nome) { toast('Informe um nome', 'error'); return; }

    const valorSelecionado = (selectId, personalizadoId) => {
      const selecionado = document.getElementById(selectId)?.value || '';
      return (selecionado === '__personalizado__'
        ? document.getElementById(personalizadoId)?.value
        : selecionado)?.trim() || '';
    };
    const escola = valorSelecionado('mc-escola', 'mc-escola-personalizada');
    const tempoConjuracao = valorSelecionado('mc-tempo', 'mc-tempo-personalizado');
    if (!tempoConjuracaoMagiaValido(tempoConjuracao)) {
      toast('Informe um tempo de conjuração válido para uma magia (por exemplo: Ação, Ação Bônus, Reação, 1 minuto ou 1 hora).', 'error');
      return;
    }
    const alcance = document.getElementById('mc-alcance')?.value?.trim() || '';
    const componentesBase = ['v', 's', 'm']
      .filter(letra => document.getElementById(`mc-comp-${letra}`)?.checked)
      .map(letra => letra.toUpperCase());
    const outroComponente = document.getElementById('mc-comp-outro')?.value?.trim() || '';
    const componentes = [...componentesBase, outroComponente].filter(Boolean).join(', ');
    const duracaoSelecionada = document.getElementById('mc-duracao')?.value || '';
    const quantidadeDuracao = document.getElementById('mc-duracao-quantidade')?.value?.trim() || '';
    const unidadeDuracao = document.getElementById('mc-duracao-unidade')?.value || '';
    const textoDuracao = document.getElementById('mc-duracao-texto')?.value?.trim() || '';
    const duracao = duracaoSelecionada === '__personalizado__'
      ? [quantidadeDuracao && `${quantidadeDuracao} ${unidadeDuracao}`, textoDuracao].filter(Boolean).join(', ')
      : duracaoSelecionada;

    const obrigatorios = [
      ['escola', escola], ['tempo de conjuração', tempoConjuracao], ['alcance', alcance],
      ['componentes', componentes], ['duração', duracao]
    ];
    const faltante = obrigatorios.find(([, valor]) => !valor);
    if (faltante) { toast(`Informe ${faltante[0]}`, 'error'); return; }

    if (!char.magias_customizadas) char.magias_customizadas = [];
    const magiaSalva = {
      nome,
      circulo: parseInt(document.getElementById('mc-circulo')?.value) || 0,
      escola,
      tempo_conjuracao: tempoConjuracao,
      alcance,
      componentes,
      duracao,
      descricao: document.getElementById('mc-desc')?.value || '',
      dano: document.getElementById('mc-dano')?.value || '',
      ritual: Boolean(document.getElementById('mc-ritual')?.checked)
    };
    const nomeAnterior = magiaExistente?.nome;
    const circuloAnterior = magiaExistente ? (Number(magiaExistente.circulo) || 0) : null;
    if (magiaExistente) char.magias_customizadas[indiceEdicao] = magiaSalva;
    else char.magias_customizadas.push(magiaSalva);
    const identidadeMudou = Boolean(magiaExistente) && (nomeAnterior !== magiaSalva.nome || circuloAnterior !== magiaSalva.circulo);
    if (char.classe === 'Mago' && (!magiaExistente || identidadeMudou)) {
      if (nomeAnterior && Array.isArray(char.grimorio)) {
        const idxAntigo = char.grimorio.findIndex(m => m?.nome === nomeAnterior);
        if (idxAntigo >= 0) char.grimorio.splice(idxAntigo, 1);
      }
      if (magiaSalva.circulo > 0 && !magiaMagoEstaNoGrimorio(char, magiaSalva.nome)) {
        if (!char.grimorio) char.grimorio = [];
        char.grimorio.push({ nome: magiaSalva.nome, circulo: magiaSalva.circulo });
      }
    }
    if (magiaExistente && nomeAnterior) {
      const idxPrep = (char.magias_preparadas || []).findIndex(m => m?.personalizada && m.nome === nomeAnterior);
      if (idxPrep >= 0) {
        if (magiaSalva.circulo > 0) {
          char.magias_preparadas[idxPrep] = { ...char.magias_preparadas[idxPrep], nome: magiaSalva.nome, circulo: magiaSalva.circulo };
        } else {
          char.magias_preparadas.splice(idxPrep, 1);
        }
      }
    }
    salvar();
    window.fecharModal();
    renderFichaCompleta();
    toast(`${nome} ${magiaExistente ? 'atualizada' : 'adicionada'}!`, 'success');
  });
}

/** Busca de magia para copiar no Grimório do Mago */
export async function mostrarBuscaGrimorio() {
  const indice = await getIndiceMagias();
  const magias = (indice?.magias || []).filter(m => m.circulo > 0 && (m.classes || []).includes('Mago'));
  const espacosMago = classeData?.tabela_caracteristicas
    ? getEspacosMagia(classeData.tabela_caracteristicas, char.nivel) : (char.espacos_magia || {});
  const circulosPreparaveis = new Set(Object.entries(espacosMago)
    .filter(([, espaco]) => (espaco?.total || 0) > 0)
    .map(([circulo]) => Number(circulo)));

  abrirModal('Copiar Magia para o Grimório', `
    <div class="info-box warning" style="margin-bottom:8px">
      <strong>Custo:</strong> 50 PO por círculo da magia | <strong>Tempo:</strong> 2h por círculo<br>
      <small id="grimorio-carteira-disponivel">Disponível: ${formatarCarteira(char.moedas)}</small>
    </div>
    <div class="search-box"><input type="text" id="busca-grimorio" placeholder="Buscar magia de Mago..." class="form-input" autofocus></div>
    <div id="resultado-grimorio" style="min-height:35dvh;max-height:50dvh;overflow-y:auto"></div>
  `, '', () => renderFichaCompleta());

  const resultadoEl = document.getElementById('resultado-grimorio');
  const circulosExpandidos = new Set();

  function renderGrimorio() {
    const termo = semAcento(document.getElementById('busca-grimorio')?.value || '');
    const jaNoGrimorio = new Set((char.grimorio || []).map(m => m.nome));
    let lista = magias.filter(m => !jaNoGrimorio.has(m.nome) && circulosPreparaveis.has(m.circulo));
    if (termo.length >= 2) lista = lista.filter(m => semAcento(m.nome).includes(termo));
    lista = lista.sort((a, b) => a.circulo - b.circulo || a.nome.localeCompare(b.nome, 'pt-BR'));

    if (lista.length === 0) {
      resultadoEl.innerHTML = `<div style="text-align:center;color:var(--text-muted);padding:16px">Nenhuma magia encontrada.</div>`;
      return;
    }

    // O limite de itens é por círculo, não no total combinado -- um corte
    // global aqui (ordenado por círculo) já escondeu círculos inteiros: o
    // 1º e o 2º círculo sozinhos passam de 50 magias de Mago, então o corte
    // esgotava antes de chegar a qualquer círculo mais alto, mesmo quando o
    // personagem já podia prepará-lo (achado do debug de 2026-08-08).
    const magiasPorCirculo = new Map();
    lista.forEach(m => {
      if (!magiasPorCirculo.has(m.circulo)) magiasPorCirculo.set(m.circulo, []);
      const doCirculo = magiasPorCirculo.get(m.circulo);
      if (doCirculo.length < 50) doCirculo.push(m);
    });

    resultadoEl.innerHTML = [...magiasPorCirculo.entries()].map(([circulo, magiasDoCirculo]) => `
      <details data-grimorio-circulo="${circulo}" ${termo.length >= 2 || circulosExpandidos.has(circulo) ? 'open' : ''} style="margin:8px 0">
        <summary class="section-divider" style="margin:0;cursor:pointer"><span>${circulo}º Círculo (${magiasDoCirculo.length})</span></summary>
        ${magiasDoCirculo.map(m => {
      const custo = m.circulo * 50;
      const temPO = podePagar(char.moedas, custo * VALOR_EM_COBRE.po);
      return `
      <div class="magia-item" style="cursor:pointer${!temPO ? ';opacity:0.5' : ''}" data-grim-nome="${m.nome}" data-grim-circ="${m.circulo}" data-grim-custo="${custo}">
        <div class="magia-nome">${m.nome}</div>
        <div class="magia-meta">
          <span>${m.circulo}º Círculo</span>
          <span>${m.escola}</span>
          <span style="font-weight:600;color:${temPO ? 'var(--success)' : 'var(--danger)'}">Custo: ${custo} PO</span>
        </div>
      </div>`;
    }).join('')}
      </details>`).join('');

    resultadoEl.querySelectorAll('[data-grimorio-circulo]').forEach(grupo => {
      grupo.addEventListener('toggle', () => {
        const circulo = Number(grupo.dataset.grimorioCirculo);
        if (grupo.open) circulosExpandidos.add(circulo);
        else circulosExpandidos.delete(circulo);
      });
    });

    resultadoEl.querySelectorAll('[data-grim-nome]').forEach(el => {
      el.addEventListener('click', () => {
        const nome = el.dataset.grimNome;
        const circ = parseInt(el.dataset.grimCirc);
        const custo = parseInt(el.dataset.grimCusto);
        const custoCobre = custo * VALOR_EM_COBRE.po;
        if (!circulosPreparaveis.has(circ)) {
          toast('Seu Mago ainda não pode preparar magias desse círculo.', 'error');
          return;
        }
        if (!podePagar(char.moedas, custoCobre)) {
          toast(`PO insuficiente! Necessário: ${custo} PO`, 'error');
          return;
        }
        if (!char.grimorio) char.grimorio = [];
        char.grimorio.push({ nome, circulo: circ });
        char.moedas = retirarValor(char.moedas, custoCobre).moedas;
        salvar();
        const carteiraEl = document.getElementById('grimorio-carteira-disponivel');
        if (carteiraEl) carteiraEl.textContent = `Disponível: ${formatarCarteira(char.moedas)}`;
        renderGrimorio();
        toast(`${nome} copiada para o grimório! (-${custo} PO)`, 'success');
      });
    });
  }

  document.getElementById('busca-grimorio')?.addEventListener('input', renderGrimorio);
  renderGrimorio();
}

// A funcao `mostrarTrocaMagias` vivia aqui: o modal que abria a lista INTEIRA
// de magias para remontar as preparadas de uma vez. Removida em 2026-08-19,
// quando a regra de troca foi uniformizada (ver site/js/regras-preparo-magias.js):
// no Descanso Longo troca-se UMA magia, para toda classe conjuradora, e
// remontar a lista passou a ser da subida de nivel -- que faz isso com trocas
// sucessivas, no assistente, e nao com este modal.
//
// Ela ficou sem nenhum chamador. Nao foi deixada como codigo morto de
// proposito: 257 linhas que implementam exatamente o comportamento que
// acabou de ser removido sao um convite a religar sem querer, e nenhum teste
// pegaria isso -- os oraculos novos cobrem a REGRA e o modal de troca unica,
// nao a existencia deste. Se a lista completa voltar a ser necessaria, ela
// volta pelo historico do git, com a decisao registrada junto.


/** Modal de troca de 1 magia conhecida (Descanso Longo - Bardo, Feiticeiro, Bruxo, subclasses conjuradoras) */
/**
 * Abre modal para o jogador escolher uma magia conhecida que preencha um slot
 * liberado pelo ajuste automático (bug de magia passiva selecionada manualmente).
 */
export async function abrirPreenchimentoSlotMagia(tipo = 'magia') {
  const ehTruque = tipo === 'truque';
  const subConj = getSubclasseConjuradoraConjuracao();
  let espacosNivel = classeData?.tabela_caracteristicas
    ? getEspacosMagia(classeData.tabela_caracteristicas, char.nivel) : {};
  if (subConj && Object.keys(espacosNivel).length === 0) {
    espacosNivel = subConj.espacos || {};
  }
  const maxCirculo = Math.max(...Object.keys(espacosNivel).map(Number), 0);

  const magiasClasse = await obterMagiasDisponiveisClasseAtual();
  const sempreNomes = new Set((magiasSempreCache || []).map(m => m.nome));
  const dominioNomes = new Set((magiasDominioCache || []).map(m => m.nome));
  // Truques vivem em magias_conhecidas; magias de círculo, em magias_preparadas.
  const jaTem = (ehTruque ? char.magias_conhecidas : char.magias_preparadas) || [];
  const jaTemSet = new Set(jaTem.map(m => m.nome));

  const disponiveis = magiasClasse.filter(m =>
    (ehTruque ? m.circulo === 0 : (m.circulo > 0 && m.circulo <= maxCirculo)) &&
    !jaTemSet.has(m.nome) &&
    !sempreNomes.has(m.nome) &&
    !dominioNomes.has(m.nome)
  ).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  let magiaSelecionada = null;
  let circuloSelecionado = null;

  abrirModal(ehTruque ? 'Escolher Truque' : 'Escolher Magia Conhecida', `
    <div class="info-box info" style="margin-bottom:12px;font-size:0.85rem">
      ${ehTruque
        ? 'Você tem uma vaga de <strong>truque</strong> em aberto para o seu nível. Escolha o truque que faltava.'
        : 'Você tem uma vaga de <strong>magia conhecida</strong> em aberto para o seu nível. Escolha uma magia para preenchê-la.'}
    </div>
    <div class="search-box" style="margin-bottom:8px">
      <input type="text" id="busca-preencher-slot" placeholder="Buscar magia..." class="form-input">
    </div>
    <div id="resultado-preencher-slot" style="max-height:40vh;overflow-y:auto;margin-bottom:8px"></div>
    <div style="font-size:0.85rem;color:var(--text-muted)">
      Selecionada: <strong id="preencher-slot-nome" style="color:var(--accent)">—</strong>
    </div>
  `, `<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>
     <button class="btn btn-primary" id="btn-confirmar-preencher" disabled>Confirmar</button>`);

  const resultadoEl = document.getElementById('resultado-preencher-slot');
  const confirmarBtn = document.getElementById('btn-confirmar-preencher');

  function renderLista() {
    const termo = semAcento(document.getElementById('busca-preencher-slot')?.value || '');
    let filtradas = disponiveis;
    if (termo.length >= 2) filtradas = disponiveis.filter(m => semAcento(m.nome).includes(termo));
    filtradas = filtradas.sort((a, b) => a.circulo - b.circulo || a.nome.localeCompare(b.nome, 'pt-BR'));

    const porCirculo = filtradas.reduce((acc, m) => { if (!acc[m.circulo]) acc[m.circulo] = []; acc[m.circulo].push(m); return acc; }, {});
    resultadoEl.innerHTML = Object.entries(porCirculo).map(([circ, magias]) => `
      <div style="margin-bottom:8px">
        <div style="font-size:0.78rem;font-weight:700;color:var(--accent);padding:4px 0 2px;border-bottom:1px solid var(--border-color);margin-bottom:6px">${circ === '0' ? 'Truques' : `${circ}\u00ba C\u00edrculo`}</div>
        <div class="opcao-grid densa">${magias.map(m => `
          <div class="opcao-card ${m.nome === magiaSelecionada ? 'selecionada' : ''}"
               data-preencher-nome="${m.nome}" data-preencher-circ="${m.circulo}" style="cursor:pointer">
            <span class="opcao-check"></span>
            <div class="opcao-nome" data-preencher-detalhe="${m.nome}" data-preencher-detalhe-circ="${m.circulo}" style="cursor:pointer">${m.nome}</div>
            <div class="opcao-resumo">
              <span>${m.escola || ''}</span>
              ${m.especial === 'C' ? '<span>Conc.</span>' : ''}
            </div>
          </div>
        `).join('')}</div>
      </div>
    `).join('');

    resultadoEl.querySelectorAll('[data-preencher-nome]').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('[data-preencher-detalhe]')) return;
        magiaSelecionada = el.dataset.preencherNome;
        circuloSelecionado = parseInt(el.dataset.preencherCirc);
        document.getElementById('preencher-slot-nome').textContent = magiaSelecionada;
        confirmarBtn.disabled = false;
        renderLista();
      });
    });

    resultadoEl.querySelectorAll('[data-preencher-detalhe]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const nome = btn.dataset.preencherDetalhe;
        const circ = parseInt(btn.dataset.preencherDetalheCirc);
        const dados = await getMagiasPorCirculo(circ);
        const magia = dados?.magias?.find(m => m.nome === nome);
        if (!magia) return;
        abrirModal(magia.nome, `
          <div class="magia-meta" style="margin-bottom:8px;display:flex;flex-wrap:wrap;gap:8px;font-size:0.85rem">
            <span class="badge badge-primary">${circ}\u00ba Circulo</span>
            <span class="badge badge-secondary">${magia.escola}</span>
            <span>${magia.tempo_conjuracao}</span> <span>${magia.alcance}</span>
            <span>${magia.componentes}</span> <span>${magia.duracao}</span>
          </div>
          <div class="md-content">${mdParaHtml(magia.descricao)}</div>
          ${magia.circulo_superior ? `<div class="info-box info mt-1"><strong>Em circulos superiores:</strong><div class="md-content">${mdParaHtml(magia.circulo_superior)}</div></div>` : ''}
        `, '<button class="btn btn-primary" onclick="fecharModal()">Fechar</button>');
      });
    });
  }

  document.getElementById('busca-preencher-slot')?.addEventListener('input', renderLista);

  confirmarBtn?.addEventListener('click', () => {
    if (!magiaSelecionada) return;
    if (ehTruque) {
      if (!char.magias_conhecidas) char.magias_conhecidas = [];
      char.magias_conhecidas.push({ nome: magiaSelecionada, circulo: 0 });
      char._slots_truque_livre = Math.max(0, (char._slots_truque_livre || 1) - 1);
      if (char._slots_truque_livre === 0) delete char._slots_truque_livre;
    } else {
      if (!char.magias_preparadas) char.magias_preparadas = [];
      char.magias_preparadas.push({ nome: magiaSelecionada, circulo: circuloSelecionado });
      char._slots_magia_livre = Math.max(0, (char._slots_magia_livre || 1) - 1);
      if (char._slots_magia_livre === 0) delete char._slots_magia_livre;
    }
    salvar();
    window.fecharModal();
    renderFichaCompleta();
    toast(`${magiaSelecionada} adicionad${ehTruque ? 'o como truque' : 'a como magia conhecida'}`, 'success');
  });

  renderLista();
}

export async function mostrarTrocaMagiaConhecida(callbackPosTroca = null, opcoes = {}) {
  const subConj = getSubclasseConjuradoraConjuracao();

  // Espacos de magia para determinar circulos disponiveis
  let espacosNivel = classeData?.tabela_caracteristicas
    ? getEspacosMagia(classeData.tabela_caracteristicas, char.nivel) : {};
  if (subConj && Object.keys(espacosNivel).length === 0) {
    espacosNivel = subConj.espacos || {};
  }
  const maxCirculo = Math.max(...Object.keys(espacosNivel).map(Number), 0);

  // Magias conhecidas atuais (apenas as que contam no limite e tem circulo > 0)
  const magiasAtuais = (char.magias_preparadas || []).filter(m => m.circulo > 0 && magiaContaNoLimite(m));

  if (magiasAtuais.length === 0) {
    toast('Nenhuma magia conhecida para trocar', 'error');
    if (callbackPosTroca) callbackPosTroca();
    else renderFichaCompleta();
    return;
  }

  // Fonte do lado "entra": o MAGO so pode preparar o que esta no proprio
  // grimorio -- preparar magia fora dele contradiz normalizarGrimorioMago
  // (utils.js), o modal de lista completa (mostrarTrocaMagias, acima) e o card
  // de troca da subida de nivel (levelup-ui.js), que ja tratavam disso.
  //
  // Esta guarda nasceu de uma REGRESSAO: ate 2026-08-19 este modal so era
  // usado por classes de magias conhecidas (Bardo, Bruxo, Feiticeiro) e pelas
  // subclasses conjuradoras -- nenhuma tem grimorio --, entao a lista da
  // classe bastava. Ao uniformizar a troca do Descanso Longo em UMA para todo
  // mundo, o Mago passou por aqui e ganhou de brinde a possibilidade de
  // preparar magia que nao esta no livro dele.
  const ehMago = char.classe === 'Mago';
  const magiasClasse = ehMago
    ? (char.grimorio || []).map(m => ({ ...m }))
    : await obterMagiasDisponiveisClasseAtual();
  const jaTemSet = new Set((char.magias_preparadas || []).map(m => m.nome));

  let magiaRemover = null;
  let magiaAdicionar = null;
  let circuloAdicionar = null;

  const nomeClasse = char.subclasse && ehSubclasseConjuradora() ? `${char.classe} (${char.subclasse})` : char.classe;

  // Titulo e explicacao sao parametrizaveis porque este modal serve a DUAS
  // regras diferentes: a troca do Descanso Longo (uma magia, para toda classe
  // conjuradora) e a Memorizar Magia do Mago (nivel 5, Descanso CURTO, "uma
  // magia preparada por outra do seu livro"). O mecanismo e o mesmo -- trocar
  // UMA --, so o texto muda.
  const titulo = opcoes.titulo || 'Trocar Magia Conhecida';
  const explicacao = opcoes.explicacao
    || `Apos um Descanso Longo, voce pode trocar <strong>1 magia ${ehMago ? 'preparada' : 'conhecida'}</strong> por outra ${ehMago ? 'do seu livro de magias' : `da lista de ${nomeClasse}`}.`;

  abrirModal(titulo, `
    <div class="info-box info" style="margin-bottom:12px;font-size:0.85rem">
      ${explicacao}
    </div>

    <div style="margin-bottom:12px">
      <label class="form-label" style="font-weight:700;color:var(--accent)">Magia a remover:</label>
      <div id="troca-conhecida-remover-lista" style="margin-bottom:4px"></div>
    </div>

    <div id="troca-conhecida-adicionar-container" style="display:none">
      <label class="form-label" style="font-weight:700;color:var(--accent)">Nova magia:</label>
      <div class="search-box" style="margin-bottom:8px"><input type="text" id="busca-troca-conhecida" placeholder="Buscar magia..." class="form-input"></div>
      <div id="resultado-troca-conhecida" style="max-height:35vh;overflow-y:auto;margin-bottom:8px"></div>
      <div style="font-size:0.85rem;color:var(--text-muted)">
        Selecionada: <strong id="troca-conhecida-nome" style="color:var(--accent)">\u2014</strong>
      </div>
    </div>
  `, `<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>
     <button class="btn btn-secondary" id="btn-pular-troca-conhecida">Nao Trocar</button>
     <button class="btn btn-primary" id="btn-confirmar-troca-conhecida" disabled>Confirmar Troca</button>`);

  const containerAdicionar = document.getElementById('troca-conhecida-adicionar-container');
  const resultadoEl = document.getElementById('resultado-troca-conhecida');
  const confirmarBtn = document.getElementById('btn-confirmar-troca-conhecida');

  function renderListaSubstituta() {
    const termo = semAcento(document.getElementById('busca-troca-conhecida')?.value || '');
    // Filtrar magias da classe que podem ser escolhidas
    let disponiveis = magiasClasse.filter(m =>
      m.circulo > 0 && m.circulo <= maxCirculo &&
      !jaTemSet.has(m.nome) && m.nome !== magiaRemover
    );
    if (termo.length >= 2) disponiveis = disponiveis.filter(m => semAcento(m.nome).includes(termo));
    disponiveis = disponiveis.sort((a, b) => a.circulo - b.circulo || a.nome.localeCompare(b.nome, 'pt-BR'));

    const porCirculo = disponiveis.reduce((acc, m) => { if (!acc[m.circulo]) acc[m.circulo] = []; acc[m.circulo].push(m); return acc; }, {});
    resultadoEl.innerHTML = Object.entries(porCirculo).map(([circ, magias]) => `
      <div style="margin-bottom:8px">
        <div style="font-size:0.78rem;font-weight:700;color:var(--accent);padding:4px 0 2px;border-bottom:1px solid var(--border-color);margin-bottom:6px">${circ}\u00ba C\u00edrculo</div>
        <div class="opcao-grid densa">${magias.map(m => `
          <div class="opcao-card ${m.nome === magiaAdicionar ? 'selecionada' : ''}" data-selecionar-troca="${m.nome}" data-selecionar-circ="${m.circulo}" style="cursor:pointer">
            <span class="opcao-check"></span>
            <div class="opcao-nome" data-troca-detalhe="${m.nome}" data-troca-detalhe-circ="${m.circulo}" style="cursor:pointer">${m.nome}</div>
            <div class="opcao-resumo">
              <span>${m.escola || ''}</span>
              ${m.especial === 'C' ? '<span>Conc.</span>' : ''}
            </div>
          </div>
        `).join('')}</div>
      </div>
    `).join('');

    // Selecionar magia substituta
    resultadoEl.querySelectorAll('[data-selecionar-troca]').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('[data-troca-detalhe]')) return;
        magiaAdicionar = el.dataset.selecionarTroca;
        circuloAdicionar = parseInt(el.dataset.selecionarCirc);
        document.getElementById('troca-conhecida-nome').textContent = magiaAdicionar;
        confirmarBtn.disabled = false;
        renderListaSubstituta();
      });
    });

    // Detalhes da magia
    resultadoEl.querySelectorAll('[data-troca-detalhe]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const nome = btn.dataset.trocaDetalhe;
        const circ = parseInt(btn.dataset.trocaDetalheCirc);
        const dados = await getMagiasPorCirculo(circ);
        const magia = dados?.magias?.find(m => m.nome === nome);
        if (!magia) return;
        abrirModal(magia.nome, `
          <div class="magia-meta" style="margin-bottom:8px;display:flex;flex-wrap:wrap;gap:8px;font-size:0.85rem">
            <span class="badge badge-primary">${circ}\u00ba Circulo</span>
            <span class="badge badge-secondary">${magia.escola}</span>
            <span>${magia.tempo_conjuracao}</span> <span>${magia.alcance}</span>
            <span>${magia.componentes}</span> <span>${magia.duracao}</span>
          </div>
          <div class="md-content">${mdParaHtml(magia.descricao)}</div>
          ${magia.circulo_superior ? `<div class="info-box info mt-1"><strong>Em circulos superiores:</strong><div class="md-content">${mdParaHtml(magia.circulo_superior)}</div></div>` : ''}
        `, '<button class="btn btn-primary" onclick="fecharModal()">Fechar</button>');
      });
    });
  }

  // Quando selecionar magia a remover
  montarSeletor(document.getElementById('troca-conhecida-remover-lista'), {
    opcoes: deMagias(magiasAtuais),
    densidade: 'densa', max: 1, busca: true,
    aoMudar: (sel) => {
      magiaRemover = sel[0] || null;
      magiaAdicionar = null;
      circuloAdicionar = null;
      document.getElementById('troca-conhecida-nome').textContent = '\u2014';
      confirmarBtn.disabled = true;
      if (magiaRemover) {
        containerAdicionar.style.display = 'block';
        renderListaSubstituta();
      } else {
        containerAdicionar.style.display = 'none';
      }
    },
  });

  // Busca
  document.getElementById('busca-troca-conhecida')?.addEventListener('input', renderListaSubstituta);

  // Nao trocar
  document.getElementById('btn-pular-troca-conhecida')?.addEventListener('click', () => {
    window.fecharModal();
    if (callbackPosTroca) callbackPosTroca();
    else renderFichaCompleta();
  });

  // Confirmar troca
  confirmarBtn?.addEventListener('click', () => {
    if (!magiaRemover || !magiaAdicionar) return;
    const idx = char.magias_preparadas.findIndex(m => m.nome === magiaRemover);
    if (idx >= 0) {
      char.magias_preparadas.splice(idx, 1);
      char.magias_preparadas.push({ nome: magiaAdicionar, circulo: circuloAdicionar });
      salvar();
      toast(`Trocou ${magiaRemover} por ${magiaAdicionar}`, 'success');
    }
    window.fecharModal();
    if (callbackPosTroca) callbackPosTroca();
    else renderFichaCompleta();
  });
}

// A lista de truques não trocáveis mora em regras-origens-magia.js, a fonte
// única das origens que o jogador não escolheu. Ela vivia copiada aqui e em
// mais três lugares, e as quatro cópias divergiam -- o comentário que ficava
// aqui pedia que "as três precisem concordar", e elas não concordavam.

/** Lista os truques de classe do personagem que podem entrar numa troca */
export function truquesTrocaveis() {
  return (char?.magias_conhecidas || [])
    .filter(m => m.circulo === 0 && truqueEhTrocavel(m));
}

/**
 * Modal de troca de 1 truque no Descanso Longo.
 *
 * Decisao do dono do produto (2026-08-13): toda classe conjuradora pode
 * trocar truque tanto no Descanso Longo quanto ao subir de nivel. Antes o
 * Descanso Longo nao oferecia troca de truque para NINGUEM (hp-descanso.js
 * so tratava magias), e a troca de truque so existia no level-up
 * (levelup-cards.js/levelup-ui.js). Espelha mostrarTrocaMagiaConhecida
 * acima, restrito a circulo 0 e sem limite de circulo maximo.
 */
export async function mostrarTrocaTruque(callbackPosTroca = null) {
  const truquesAtuais = truquesTrocaveis();
  if (truquesAtuais.length === 0) {
    toast('Nenhum truque de classe para trocar', 'error');
    if (callbackPosTroca) callbackPosTroca();
    else renderFichaCompleta();
    return;
  }

  const magiasClasse = await obterMagiasDisponiveisClasseAtual();
  const truquesClasse = magiasClasse.filter(m => m.circulo === 0);
  // Truques ja conhecidos por QUALQUER origem entram no bloqueio: trocar um
  // truque por outro que ja se tem geraria duplicata na lista.
  const jaTemSet = new Set((char.magias_conhecidas || []).map(m => m.nome));

  // `deMagias` precisa dos dados completos (escola, duracao) para o resumo
  // do card; magias_conhecidas so guarda {nome, circulo, origem}.
  const nomesAtuais = new Set(truquesAtuais.map(m => m.nome));
  const truquesAtuaisCompletos = truquesClasse.filter(m => nomesAtuais.has(m.nome));

  let truqueRemover = null;
  let truqueAdicionar = null;

  const nomeClasse = char.subclasse && ehSubclasseConjuradora() ? `${char.classe} (${char.subclasse})` : char.classe;

  abrirModal('Trocar Truque', `
    <div class="info-box info" style="margin-bottom:12px;font-size:0.85rem">
      Apos um Descanso Longo, voce pode trocar <strong>1 truque</strong> por outro da lista de ${escHtml(nomeClasse)}.
    </div>

    <div style="margin-bottom:12px">
      <label class="form-label" style="font-weight:700;color:var(--accent)">Truque a remover:</label>
      <div id="troca-truque-remover-lista" style="margin-bottom:4px"></div>
    </div>

    <div id="troca-truque-adicionar-container" style="display:none">
      <label class="form-label" style="font-weight:700;color:var(--accent)">Novo truque:</label>
      <div id="troca-truque-adicionar-lista"></div>
    </div>
  `, `<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>
     <button class="btn btn-secondary" id="btn-pular-troca-truque">Nao Trocar</button>
     <button class="btn btn-primary" id="btn-confirmar-troca-truque" disabled>Confirmar Troca</button>`);

  const containerAdicionar = document.getElementById('troca-truque-adicionar-container');
  const confirmarBtn = document.getElementById('btn-confirmar-troca-truque');

  /** Remonta a lista de truques substitutos, excluindo o que esta saindo */
  function renderListaSubstituta() {
    montarSeletor(document.getElementById('troca-truque-adicionar-lista'), {
      opcoes: deMagias(
        truquesClasse.filter(m => m.nome !== truqueRemover),
        { jaTem: jaTemSet }
      ),
      densidade: 'densa', max: 1, busca: true,
      // `selecionadas` (plural, array) e o nome do parametro em
      // montarSeletor/ui-opcoes.js -- `selecionado` (singular) e do
      // sub-objeto de montarTroca e seria ignorado em silencio aqui.
      selecionadas: truqueAdicionar ? [truqueAdicionar] : [],
      aoMudar: (sel) => {
        truqueAdicionar = sel[0] || null;
        confirmarBtn.disabled = !truqueAdicionar;
      },
    });
  }

  montarSeletor(document.getElementById('troca-truque-remover-lista'), {
    opcoes: deMagias(truquesAtuaisCompletos),
    densidade: 'densa', max: 1, busca: true,
    aoMudar: (sel) => {
      truqueRemover = sel[0] || null;
      truqueAdicionar = null;
      confirmarBtn.disabled = true;
      if (truqueRemover) {
        containerAdicionar.style.display = 'block';
        renderListaSubstituta();
      } else {
        containerAdicionar.style.display = 'none';
      }
    },
  });

  document.getElementById('btn-pular-troca-truque')?.addEventListener('click', () => {
    window.fecharModal();
    if (callbackPosTroca) callbackPosTroca();
    else renderFichaCompleta();
  });

  confirmarBtn?.addEventListener('click', () => {
    if (!truqueRemover || !truqueAdicionar) return;
    const idx = char.magias_conhecidas.findIndex(m => m.nome === truqueRemover);
    if (idx >= 0) {
      // Preserva a `origem` do truque que sai: o substituto ocupa a MESMA
      // vaga, entao herda de onde ela veio (undefined = truque de classe).
      const origem = char.magias_conhecidas[idx]?.origem;
      char.magias_conhecidas.splice(idx, 1);
      const novo = { nome: truqueAdicionar, circulo: 0 };
      if (origem) novo.origem = origem;
      char.magias_conhecidas.push(novo);
      salvar();
      toast(`Trocou ${truqueRemover} por ${truqueAdicionar}`, 'success');
    }
    window.fecharModal();
    if (callbackPosTroca) callbackPosTroca();
    else renderFichaCompleta();
  });
}
/**
 * Modal de escolha das magias que o Mago "sempre tem preparadas" por
 * característica de classe: Maestria de Magias (nível 18) e Assinatura
 * Mágica (nível 20).
 *
 * As duas escolhem DO LIVRO DE MAGIAS (char.grimorio), não da lista geral
 * de Mago -- o texto do livro diz "em seu livro de magias" nas duas. A
 * Maestria ainda exige tempo de conjuração de uma ação, conferido contra
 * o índice de magias.
 *
 * Antes destas telas, a Assinatura Mágica tinha botões "Assinatura 1/2"
 * que só marcavam o uso, sem nunca perguntar QUAL magia era a assinatura,
 * e a Maestria de Magias não pedia nada.
 *
 * @param {string} tipo - 'maestria_magias' ou 'assinatura_magica'
 */
export async function abrirEscolhaMagiasFixasMago(tipo) {
  const def = MAGIAS_FIXAS_MAGO[tipo];
  const estado = getEstadoRecursosMago();
  if (!def || !estado) return;
  if ((char.nivel || 1) < def.nivel) return;

  const grimorio = Array.isArray(char.grimorio) ? char.grimorio : [];
  if (grimorio.length === 0) {
    toast('Registre magias no seu livro de magias primeiro.', 'error');
    return;
  }

  /**
   * Tempo de conjuração da magia, vindo do índice já carregado na ficha.
   * Magia que o índice não conhece (personalizada, por exemplo) NÃO é
   * descartada: sem informação, esconder a opção seria pior que mostrá-la
   * -- o jogador não teria como saber por que ela sumiu da lista.
   */
  const ehAcao = (nome) => {
    const info = indiceMagiasCache?.find(m => m.nome === nome);
    if (!info?.tempo_conjuracao) return true;
    const tc = info.tempo_conjuracao.toLowerCase();
    return tc === 'ação' || tc === 'acao';
  };

  const atual = tipo === 'maestria_magias'
    ? { c1: estado.maestriaMagia1, c2: estado.maestriaMagia2 }
    : { m1: estado.assinatura1, m2: estado.assinatura2 };
  const escolhas = { ...atual };

  const corpo = def.vagas.map(vaga => `
    <div style="margin-bottom:12px">
      <label class="form-label" style="font-weight:700;color:var(--accent)">
        Magia de ${vaga.circulo}º Círculo${def.exigeAcao ? ' (tempo de conjuração: Ação)' : ''}
      </label>
      <div id="magia-fixa-${vaga.chave}"></div>
    </div>
  `).join('');

  abrirModal(`${def.rotulo}`, `
    <div class="info-box info" style="margin-bottom:12px;font-size:0.85rem">
      Escolha ${def.vagas.length === 1 ? 'a magia' : 'as magias'} do seu
      <strong>livro de magias</strong>. ${tipo === 'maestria_magias'
        ? 'Você sempre as tem preparadas e pode conjurá-las no círculo mais baixo sem gastar espaço de magia.'
        : 'Você sempre as tem preparadas e pode conjurar cada uma no 3º círculo, uma vez, sem gastar espaço de magia.'}
    </div>
    ${corpo}
  `, `<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>
     <button class="btn btn-primary" id="btn-salvar-magias-fixas">Salvar</button>`);

  /**
   * (Re)monta a lista de uma vaga. Precisa ser refeita a cada escolha, e
   * não só na abertura: uma magia já usada na OUTRA vaga tem de ficar
   * bloqueada aqui ("escolha uma magia de 1º e uma de 2º", "escolha DUAS
   * magias de 3º círculo" -- são escolhas distintas). Enquanto o bloqueio
   * era calculado uma única vez na montagem, dava para marcar a mesma
   * magia nas duas vagas; a gravação deduplica por nome e o jogador
   * terminava com UMA assinatura -- o sintoma "só está podendo escolher 1
   * magia em vez de 2".
   */
  const montarVaga = (vaga) => {
    const el = document.getElementById(`magia-fixa-${vaga.chave}`);
    if (!el) return;
    const outrasVagas = def.vagas.filter(v => v.chave !== vaga.chave);
    const candidatas = grimorio
      .filter(m => Number(m.circulo) === vaga.circulo)
      .filter(m => !def.exigeAcao || ehAcao(m.nome));
    if (candidatas.length === 0) {
      el.innerHTML = `<div style="font-size:0.85rem;color:var(--text-muted)">
        Nenhuma magia de ${vaga.circulo}º círculo${def.exigeAcao ? ' com tempo de conjuração de ação' : ''}
        no seu livro de magias.
      </div>`;
      return;
    }
    montarSeletor(el, {
      opcoes: deMagias(candidatas, {
        jaTem: new Set(outrasVagas.map(v => escolhas[v.chave]).filter(Boolean))
      }),
      densidade: 'densa', max: 1, busca: candidatas.length > 8,
      selecionadas: escolhas[vaga.chave] ? [escolhas[vaga.chave]] : [],
      aoMudar: (sel) => {
        const novo = sel[0] || '';
        if (novo === escolhas[vaga.chave]) return; // montagem, não escolha
        escolhas[vaga.chave] = novo;
        // Só as OUTRAS vagas são remontadas -- remontar a própria durante o
        // seu callback reentraria em montarSeletor no meio do desenho.
        outrasVagas.forEach(montarVaga);
      },
    });
  };

  def.vagas.forEach(montarVaga);

  document.getElementById('btn-salvar-magias-fixas')?.addEventListener('click', () => {
    definirMagiasFixasMago(tipo, escolhas);
    window.fecharModal();
    renderFichaCompleta();
    toast(`${def.rotulo}: magias atualizadas.`, 'success');
  });
}
