// ============================================================
// Inventario da ficha
//
// Lista, arrasta-e-solta, seletores de item e itens personalizados.
// Extraido de site/js/pages/sheet.js sem alteracao de comportamento.
// ============================================================
import { CLASSES_INFO } from '../dados-classes.js';
import { getArmaduras, getArmas, getEquipamentoAventura } from '../db.js';
import { DENOMINACOES, ICONE_MOEDA, NOMES_MOEDA, adicionarMoeda, converterParaMaior, formatarCarteira, pagarCusto, parseCusto, podePagarCusto, proximaDenominacaoMaior, removerQuantidadeMoeda, taxasSaoPadrao } from '../moedas.js';
import { carregarComprarAtivoPadrao, resetarTaxasMoeda, salvarComprarAtivoPadrao, salvarTaxasMoeda } from '../store.js';
import { abrirModal, bonusProficiencia, calcMod, fmtMod, fmtPeso, getCapacidadeCarga, getPesoTotalInventario, mdParaHtml, semAcento, toast } from '../utils.js';
import { getEstadoFuria } from './classes/barbaro.js';
import { getEstadoRecursosGuardiao } from './classes/guardiao.js';
import { _salvarEstadoColapso, _secoesInvColapsadas } from './colapso.js';
import { ataqueImprudenteAtivo, temArmaduraPesadaEquipada } from './combate.js';
import { sheetBadgeProf, sheetTemProfArma, sheetTemProfArmadura } from './condicoes.js';
import { char, passivosTalentosCache, salvar } from './estado.js';
import { renderFichaCompleta } from './ficha.js';

// --- Inventário na ficha ---
/** Estado de carga do personagem: peso atual, capacidade e flag de sobrecarga. */
export function getEstadoCarga() {
  const forca = char?.atributos?.forca || 0;
  const tamanho = char?.tamanho || 'Médio';
  const pesoAtual = getPesoTotalInventario(char?.inventario || []);
  const capacidade = getCapacidadeCarga(forca, tamanho);
  const sobrecarregado = capacidade > 0 && pesoAtual > capacidade;
  return { pesoAtual, capacidade, sobrecarregado };
}

export function renderSecaoInventario() {
  const inv = char.inventario || [];
  const _carga = getEstadoCarga();
  // Só sinaliza "Sobrecarregado" quando a regra de sobrecarga está ativa.
  const _mostrarSobrecarga = _carga.sobrecarregado && !!char?.config?.sobrecarga_afeta_deslocamento;
  const _corCarga = _mostrarSobrecarga ? 'var(--danger)' : 'var(--text-muted)';

  // Separar equipados, não equipados, e zerados
  const equipados = [];
  const naoEquipados = [];
  const zerados = [];
  inv.forEach((item, idx) => {
    if ((item.quantidade ?? 1) <= 0) zerados.push(idx);
    else if (item.equipado) equipados.push(idx);
    else naoEquipados.push(idx);
  });

  return `
    <div class="card">
      <div class="card-header">
        <h2>Inventario</h2>
        <div class="no-print" style="display:flex;gap:4px;align-items:center">
          <span style="font-weight:700;color:var(--secondary);font-size:0.9rem;cursor:pointer" id="btn-edit-po" title="Editar Carteira">${formatarCarteira(char.moedas)}</span>
          <button class="btn btn-sm btn-accent" id="btn-add-inv">+ Item</button>
          <button class="btn btn-sm btn-secondary" id="btn-add-inv-custom">+ Custom</button>
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;padding:6px 0;border-bottom:1px solid var(--border-light);margin-bottom:6px">
        <span id="sheet-peso-valor" style="font-size:0.8rem;cursor:pointer;color:${_corCarga}" onclick="window.mostrarCalculoCarga()" title="Ver cálculo da capacidade de carga">
          Peso: <strong>${fmtPeso(_carga.pesoAtual)}</strong> / ${fmtPeso(_carga.capacidade)} kg
          ${_mostrarSobrecarga ? '<span style="font-weight:700;margin-left:4px">&#9888; Sobrecarregado</span>' : ''}
        </span>
        <label class="no-print" style="display:flex;align-items:center;gap:4px;font-size:0.72rem;color:var(--text-muted);cursor:pointer" title="Se ligado, sobrecarga reduz o Deslocamento para 1,5 m">
          <input type="checkbox" id="cfg-sobrecarga" ${char?.config?.sobrecarga_afeta_deslocamento ? 'checked' : ''}>
          Sobrecarga afeta deslocamento
        </label>
      </div>
      <div id="sheet-inventario">
        ${inv.length === 0
          ? '<div style="color:var(--text-muted);text-align:center;padding:12px;font-size:0.85rem">Inventario vazio</div>'
          : renderSheetInvLista(equipados, naoEquipados, zerados)
        }
      </div>
    </div>
  `;
}

/** Renderiza a lista do inventário separada por seções */
function renderSheetInvLista(equipados, naoEquipados, zerados) {
  let html = '';

  if (equipados.length > 0) {
    const colapsada = _secoesInvColapsadas.equipados;
    html += `<div class="inv-secao-titulo${colapsada ? ' inv-secao-colapsada' : ''}" data-inv-secao="equipados">
      <span>Equipados (${equipados.length})</span>
      <span class="inv-secao-chevron">&#9660;</span>
    </div>`;
    html += `<div class="inv-secao-body${colapsada ? ' inv-secao-body-oculto' : ''}" data-inv-secao-body="equipados">`;
    html += equipados.map(idx => renderSheetInvItem(char.inventario[idx], idx)).join('');
    html += '</div>';
  }

  if (naoEquipados.length > 0) {
    const colapsada = _secoesInvColapsadas.mochila;
    html += `<div class="inv-secao-titulo${colapsada ? ' inv-secao-colapsada' : ''}" data-inv-secao="mochila">
      <span>Mochila (${naoEquipados.length})</span>
      <span class="inv-secao-chevron">&#9660;</span>
    </div>`;
    html += `<div class="inv-secao-body${colapsada ? ' inv-secao-body-oculto' : ''}" data-inv-secao-body="mochila">`;
    html += naoEquipados.map(idx => renderSheetInvItem(char.inventario[idx], idx)).join('');
    html += '</div>';
  }

  if (zerados && zerados.length > 0) {
    const colapsada = _secoesInvColapsadas.esgotados;
    html += `<div class="inv-secao-titulo${colapsada ? ' inv-secao-colapsada' : ''}" data-inv-secao="esgotados">
      <span>Esgotados (${zerados.length})</span>
      <span class="inv-secao-chevron">&#9660;</span>
    </div>`;
    html += `<div class="inv-secao-body${colapsada ? ' inv-secao-body-oculto' : ''}" data-inv-secao-body="esgotados">`;
    html += zerados.map(idx => renderSheetInvItem(char.inventario[idx], idx)).join('');
    html += '</div>';
  }

  return html;
}

/** Renderiza um item do inventário na ficha */
function renderSheetInvItem(item, idx) {
  // Badge de proficiência
  let profBadge = '';
  if (item.tipo === 'arma' && item.dados?.categoria) {
    profBadge = sheetBadgeProf(sheetTemProfArma({ categoria: item.dados.categoria, propriedades: item.dados.propriedades || '' }));
  }
  if ((item.tipo === 'armadura' || item.tipo === 'escudo') && item.dados?.categoria) {
    profBadge = sheetBadgeProf(sheetTemProfArmadura({ categoria: item.dados.categoria, nome: item.nome }));
  }

  // Badge de tipo de uso (consumível, equipamento, etc.)
  let tipoBadge = '';
  const tipoUso = item.dados?.tipo_uso || '';
  if (tipoUso === 'consumivel') {
    tipoBadge = '<span class="badge" style="font-size:0.6rem;background:#e8f5e9;color:#2e7d32;border:1px solid #a5d6a7">Consumível</span>';
  }

  // Calcular bônus de ataque para armas
  let ataqueInfo = '';
  let danoAutoInfo = '';
  let vantagemInfo = '';
  let estiloLutaInfo = '';
  let danoExibicao = item.dados?.dano || '';
  if (item.tipo === 'arma' && item.dados) {
    const info = CLASSES_INFO[char.classe];
    const prof = bonusProficiencia(char.nivel);
    const props = (item.dados.propriedades || '').toLowerCase();
    const cat = (item.dados.categoria || '').toLowerCase();
    const isAcuidade = props.includes('acuidade');
    const isDistancia = cat.includes('dist');

    let modAtq;
    let usaForcaNoAtaque = false;
    if (isAcuidade) {
      const modFor = calcMod(char.atributos.forca);
      const modDes = calcMod(char.atributos.destreza);
      usaForcaNoAtaque = modFor >= modDes;
      modAtq = Math.max(modFor, modDes);
    } else if (isDistancia) {
      modAtq = calcMod(char.atributos.destreza);
    } else {
      modAtq = calcMod(char.atributos.forca);
      usaForcaNoAtaque = true;
    }

    const temProf = sheetTemProfArma({ categoria: item.dados.categoria, propriedades: item.dados.propriedades || '' });
    const bonusAtq = modAtq + (temProf ? prof : 0);
    // Bônus de ataque de talentos
    let bonusAtqTalento = 0;
    const _passivos = passivosTalentosCache || {};
    if (isDistancia) bonusAtqTalento += _passivos.bonusAtaqueDistancia || 0;
    const bonusAtqFinal = bonusAtq + bonusAtqTalento;
    ataqueInfo = `<span class="badge badge-secondary" style="font-size:0.65rem">Atq ${fmtMod(bonusAtqFinal)}</span>`;
    if (ataqueImprudenteAtivo() && usaForcaNoAtaque) {
      vantagemInfo = '<span class="badge" style="font-size:0.6rem;background:#fff3cd;color:#8a6d3b;border:1px solid #ffeeba">Vantagem (Imprudente)</span>';
    }
    const estadoGuardiao = getEstadoRecursosGuardiao();
    if (estadoGuardiao?.cacadorPrecisoAtivo && estadoGuardiao?.marcaPredadorAtiva) {
      vantagemInfo = '<span class="badge" style="font-size:0.6rem;background:#e3f2fd;color:#0d47a1;border:1px solid #90caf9">Vantagem (Caçador Preciso)</span>';
    }

    // Estilo de Luta: Combate com Armas Grandes / Combate com Duas Armas
    // (Talentos.md:764/770) -- as duas flags que talentos-effects.js grava em
    // passivos.flags.estilo_armas_grandes/estilo_duas_armas, sem consumidor
    // até esta correção. NÃO entram no cálculo de bonusDanoTalento acima
    // (padrão de bonusDanoUmaMao/bonusDanoArremesso) de propósito:
    // - Armas Grandes altera o RESULTADO de cada dado de dano ("trata 1 ou 2
    //   como 3"), não é um modificador fixo somado uma vez -- e o app não tem
    //   nenhum motor de rolagem de dados para interceptar (danoExibicao só
    //   mostra a FÓRMULA "XdY+Z", nunca rola). Fabricar um "bônus médio"
    //   (esperança estatística de +3/faces por dado) misturaria um número
    //   probabilístico com modificadores exatos na mesma badge, o que é mais
    //   enganoso do que informativo.
    // - Duas Armas só vale para o ATAQUE ADICIONAL (bônus de arma Leve), e a
    //   ficha não modela "ataque adicional" como uma linha separada da arma
    //   principal -- bonusTotalDano (abaixo) já soma modAtq à ÚNICA linha de
    //   dano exibida por item, então somar de novo aqui contaria o mesmo
    //   modificador duas vezes para a mesma arma.
    // Por isso os dois viram um selo informativo na arma qualificada (mesmo
    // padrão de vantagemInfo acima), e não um número dentro de danoExibicao.
    //
    // O gatilho de Armas Grandes usa a PROPRIEDADE da arma (Duas Mãos ou
    // Versátil, exatamente o que Talentos.md:764 exige) -- não a
    // empunhadura escolhida pelo jogador, que o app não rastreia. Uma arma
    // Versátil pode estar sendo empunhada com UMA mão só (aí o benefício
    // não se aplica de verdade), e o app não tem como saber -- por isso o
    // texto do selo é condicional ("se empunhada com as duas mãos"), não
    // uma afirmação incondicional de que o benefício está valendo.
    const ehArmaCorpoACorpoDuasMaosOuVersatil = !isDistancia && (props.includes('duas mãos') || props.includes('versátil'));
    if (_passivos.flags?.estilo_armas_grandes && ehArmaCorpoACorpoDuasMaosOuVersatil) {
      estiloLutaInfo += '<span class="badge" style="font-size:0.6rem;background:#ede7f6;color:#4527a0;border:1px solid #b39ddb" title="Combate com Armas Grandes: se estiver empunhando esta arma com as DUAS mãos, trata qualquer 1 ou 2 no dado de dano como um 3 (Talentos.md) -- a ficha não sabe a empunhadura escolhida em armas Versáteis">1-2→3</span>';
    }
    if (_passivos.flags?.estilo_duas_armas && props.includes('leve')) {
      estiloLutaInfo += '<span class="badge" style="font-size:0.6rem;background:#e0f2f1;color:#00695c;border:1px solid #80cbc4" title="Combate com Duas Armas: soma seu mod. de atributo ao dano do ataque adicional com esta arma, se ainda não estiver somando (Talentos.md)">+mod extra</span>';
    }

    const danoBase = item.dados?.dano || '';
    const matchDano = danoBase.match(/^(\d+d\d+)(\s*[+\-]\s*\d+)?(.*)$/i);
    if (matchDano) {
      const dado = matchDano[1];
      const modExistente = matchDano[2];
      const sufixo = matchDano[3] || '';
      const estadoFuria = getEstadoFuria();
      const bonusFuria = estadoFuria?.ativa && usaForcaNoAtaque ? (estadoFuria.dano || 0) : 0;
      const bonusTotalDano = modAtq + bonusFuria;
      // Bônus de dano de talentos
      let bonusDanoTalento = 0;
      const ehArremesso = props.includes('arremesso');
      const usaUmaMao = !props.includes('duas mãos') && !props.includes('pesada');
      if (usaUmaMao && !isDistancia) bonusDanoTalento += _passivos.bonusDanoUmaMao || 0;
      if (ehArremesso) bonusDanoTalento += _passivos.bonusDanoArremesso || 0;
      const bonusTotalDanoFinal = bonusTotalDano + bonusDanoTalento;

      if (modExistente) {
        const modBase = parseInt(String(modExistente).replace(/\s+/g, '')) || 0;
        const modFinal = modBase + bonusFuria + bonusDanoTalento;
        const sinal = modFinal >= 0 ? `+${modFinal}` : `${modFinal}`;
        danoExibicao = `${dado}${sinal}${sufixo}`.replace(/\s+/g, ' ').trim();
      } else if (bonusTotalDanoFinal !== 0) {
        const sinal = bonusTotalDanoFinal >= 0 ? `+${bonusTotalDanoFinal}` : `${bonusTotalDanoFinal}`;
        danoExibicao = `${dado}${sinal}${sufixo}`.replace(/\s+/g, ' ').trim();
      } else {
        danoExibicao = danoBase;
      }
      danoAutoInfo = `<span class="badge" style="font-size:0.6rem;background:#fce4ec;color:#c62828;border:1px solid #ef9a9a">Dano ${danoExibicao}</span>`;
    }
  }

  // Descrição curta do item
  const descCurta = item.dados?.descricao || item.descricao || '';
  const descPreview = descCurta && item.tipo === 'equipamento'
    ? `<div class="inv-item-detalhe" style="font-size:0.7rem;color:var(--text-muted);margin-top:1px">${descCurta.length > 80 ? descCurta.substring(0, 80) + '…' : descCurta}</div>`
    : '';

  // Badge e info extra para itens customizados
  let customBadges = '';
  if (item.tipo === 'customizado') {
    const bca = parseInt(item.dados?.bonus_ca) || 0;
    const batq = parseInt(item.dados?.bonus_ataque) || 0;
    if (bca !== 0) customBadges += `<span class="badge" style="font-size:0.6rem;background:#e8eaf6;color:#3949ab;border:1px solid #9fa8da">CA ${bca > 0 ? '+' : ''}${bca}</span> `;
    if (batq !== 0) customBadges += `<span class="badge badge-secondary" style="font-size:0.65rem">Atq ${batq > 0 ? '+' : ''}${batq}</span> `;
    if (item.dados?.dano) customBadges += `<span class="badge" style="font-size:0.6rem;background:#fce4ec;color:#c62828;border:1px solid #ef9a9a">${item.dados.dano}</span> `;
  }

  // Badge de maestria com a arma
  let maestriaBadge = '';
  if (item.tipo === 'arma' && item.dados?.maestria) {
    const temMaestria = (char.maestrias_arma || []).some(m => m === item.nome);
    if (temMaestria) {
      maestriaBadge = `<span class="badge" style="font-size:0.6rem;background:#fff8e1;color:#e65100;border:1px solid #ffcc80;font-weight:700">Maestria: ${item.dados.maestria}</span>`;
    }
  }

  const isZeroQtd = (item.quantidade ?? 1) <= 0;

  return `
    <div class="inv-item ${item.equipado ? 'inv-item-equipado' : ''} ${isZeroQtd ? 'inv-item-zerado' : ''}" data-idx="${idx}">
      <div class="inv-drag-handle no-print" title="Arrastar para reordenar">&#9776;</div>
      <div style="flex:1;min-width:0;cursor:pointer" data-info-inv-sheet="${idx}" title="Ver detalhes">
        <div class="inv-item-nome">
          ${item.nome} ${profBadge}
        </div>
        ${(ataqueInfo || danoAutoInfo || vantagemInfo || estiloLutaInfo || maestriaBadge || tipoBadge || customBadges)
          ? `<div class="inv-item-badges" style="display:flex;flex-wrap:wrap;gap:3px;margin-top:2px">${ataqueInfo}${danoAutoInfo}${vantagemInfo}${estiloLutaInfo}${maestriaBadge}${tipoBadge}${customBadges}</div>`
          : ''
        }
        <div class="inv-item-detalhe">
          ${item.tipo === 'arma' ? `${danoExibicao} | ${item.dados?.propriedades || ''}` : ''}
          ${item.tipo === 'armadura' ? `CA: ${item.dados?.ca || ''} | ${item.dados?.categoria || ''}` : ''}
          ${item.tipo === 'escudo' ? `CA: ${item.dados?.ca || ''} | Escudo` : ''}
          ${item.tipo === 'equipamento' ? `${item.dados?.custo || ''} ${item.dados?.peso ? '| ' + item.dados.peso : ''}` : ''}
          ${item.tipo === 'customizado' ? `${item.descricao ? (item.descricao.length > 60 ? item.descricao.substring(0, 60) + '...' : item.descricao) : ''}` : ''}
          ${item.tipo === 'generico' ? `${item.descricao || ''}` : ''}
        </div>
        ${descPreview}
      </div>
      <div class="inv-item-acoes no-print" style="align-items:center">
        <div class="inv-qty-control" style="display:flex;align-items:center;gap:2px">
          <button class="btn btn-sm btn-icon" data-qty-minus="${idx}" style="font-size:0.7rem;padding:1px 5px">−</button>
          <span style="min-width:20px;text-align:center;font-size:0.8rem;font-weight:700" data-qty-display="${idx}">${item.quantidade ?? 1}</span>
          <button class="btn btn-sm btn-icon" data-qty-plus="${idx}" style="font-size:0.7rem;padding:1px 5px">+</button>
        </div>
        <label class="form-check inv-equip-label" title="Equipar/Desequipar">
          <input type="checkbox" data-sheet-equip="${idx}" ${item.equipado ? 'checked' : ''}> Eq.
        </label>
        <button class="btn btn-sm btn-danger btn-icon" data-sheet-rem-inv="${idx}">&times;</button>
      </div>
    </div>
  `;
}

export function setupEventosInventarioSheet() {
  // Toggle de sobrecarga (fora do container da lista)
  const cfgSobrecarga = document.getElementById('cfg-sobrecarga');
  if (cfgSobrecarga) {
    cfgSobrecarga.addEventListener('change', () => {
      if (!char.config) char.config = {};
      char.config.sobrecarga_afeta_deslocamento = cfgSobrecarga.checked;
      salvar();
      renderFichaCompleta();
    });
  }

  const invContainer = document.getElementById('sheet-inventario');
  if (!invContainer) return;

  // Recolher / expandir seções do inventário
  invContainer.querySelectorAll('[data-inv-secao]').forEach(titulo => {
    titulo.addEventListener('click', () => {
      const secao = titulo.dataset.invSecao;
      if (!(secao in _secoesInvColapsadas)) return;
      _secoesInvColapsadas[secao] = !_secoesInvColapsadas[secao];

      const colapsada = _secoesInvColapsadas[secao];
      titulo.classList.toggle('inv-secao-colapsada', colapsada);

      const body = invContainer.querySelector(`[data-inv-secao-body="${secao}"]`);
      if (body) body.classList.toggle('inv-secao-body-oculto', colapsada);
      _salvarEstadoColapso();
    });
  });

  // Equipar/desequipar — re-renderiza a ficha completa para atualizar CA e stats
  document.querySelectorAll('[data-sheet-equip]').forEach(cb => {
    cb.addEventListener('change', () => {
      const idx = parseInt(cb.dataset.sheetEquip);
      if (char.inventario[idx]) {
        char.inventario[idx].equipado = cb.checked;

        if (char.classe === 'Bárbaro' && temArmaduraPesadaEquipada()) {
          if (!char.recursos) char.recursos = {};
          char.recursos.furia_ativa = false;
        }

        salvar();
        // Re-renderizar ficha inteira para recalcular CA e outros stats
        renderFichaCompleta();
      }
    });
  });

  // Remover item (com confirmação)
  document.querySelectorAll('[data-sheet-rem-inv]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.sheetRemInv);
      const item = char.inventario[idx];
      if (!item) return;
      abrirModal('Remover Item', `
        <p>Deseja realmente remover <strong>${item.nome}</strong>${item.quantidade > 1 ? ` (x${item.quantidade})` : ''} do inventário?</p>
      `, `
        <button class="btn btn-danger" id="btn-confirmar-rem-inv-sheet">Remover</button>
        <button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>
      `);
      document.getElementById('btn-confirmar-rem-inv-sheet')?.addEventListener('click', () => {
        char.inventario.splice(idx, 1);
        salvar();
        fecharModal();
        reRenderSheetInv();
      });
    });
  });

  // Quantidade +/-
  document.querySelectorAll('[data-qty-plus]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.qtyPlus);
      if (char.inventario[idx]) {
        char.inventario[idx].quantidade = (char.inventario[idx].quantidade ?? 1) + 1;
        salvar();
        reRenderSheetInv();
      }
    });
  });
  document.querySelectorAll('[data-qty-minus]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.qtyMinus);
      if (char.inventario[idx]) {
        const novaQtd = Math.max(0, (char.inventario[idx].quantidade ?? 1) - 1);
        char.inventario[idx].quantidade = novaQtd;
        salvar();
        reRenderSheetInv();
      }
    });
  });

  // Ver detalhes do item ao clicar
  document.querySelectorAll('[data-info-inv-sheet]').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('input') || e.target.closest('button')) return;
      const idx = parseInt(el.dataset.infoInvSheet);
      const item = char.inventario[idx];
      if (item) mostrarDetalheItemSheet(item);
    });
  });

  // Drag and drop
  setupSheetDragDrop();

  // Adicionar item (por categorias) - usar onclick direto para evitar empilhar handlers em re-renders
  const btnAddInv = document.getElementById('btn-add-inv');
  if (btnAddInv) btnAddInv.onclick = () => mostrarSeletorCategoria();

  // Item customizado
  const btnAddCustom = document.getElementById('btn-add-inv-custom');
  if (btnAddCustom) btnAddCustom.onclick = () => {
    abrirModal('Item Customizado', `
      <div class="form-group"><label class="form-label" for="ic-nome">Nome</label><input type="text" class="form-input" id="ic-nome"></div>
      <div class="form-group"><label class="form-label" for="ic-desc">Descricao</label><textarea class="form-textarea" id="ic-desc" rows="2"></textarea></div>
      <div class="row gap-1">
        <div class="col">
          <label class="form-label" for="ic-ca">Bonus CA</label>
          <input type="number" class="form-input" id="ic-ca" placeholder="0" min="-5" max="5">
          <div style="font-size:0.65rem;color:var(--text-muted)">-5 a +5</div>
        </div>
        <div class="col">
          <label class="form-label" for="ic-dano">Dano</label>
          <input type="text" class="form-input" id="ic-dano" placeholder="1d8 Cortante">
          <div style="font-size:0.65rem;color:var(--text-muted)">Ex: 2d6 Cortante</div>
        </div>
        <div class="col">
          <label class="form-label" for="ic-atq">Bonus Atq</label>
          <input type="number" class="form-input" id="ic-atq" placeholder="0" min="-5" max="10">
          <div style="font-size:0.65rem;color:var(--text-muted)">-5 a +10</div>
        </div>
      </div>
      <div class="form-group" style="margin-top:8px">
        <label class="form-label" for="ic-peso">Peso (opcional)</label>
        <input type="number" class="form-input" id="ic-peso" placeholder="0" min="0" step="0.1" style="max-width:140px">
        <div style="font-size:0.65rem;color:var(--text-muted)">em kg (ex: 0,5)</div>
      </div>
      <div id="ic-erros" style="display:none;color:var(--danger);font-size:0.8rem;margin-top:8px"></div>
    `, '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-primary" id="btn-add-ic">Adicionar</button>');

    document.getElementById('btn-add-ic')?.addEventListener('click', () => {
      const nome = document.getElementById('ic-nome')?.value?.trim();
      const desc = document.getElementById('ic-desc')?.value?.trim() || '';
      const ca = parseInt(document.getElementById('ic-ca')?.value) || 0;
      const danoVal = document.getElementById('ic-dano')?.value?.trim() || '';
      const atq = parseInt(document.getElementById('ic-atq')?.value) || 0;
      const pesoRaw = document.getElementById('ic-peso')?.value?.trim() || '';
      const pesoNum = pesoRaw ? parseFloat(pesoRaw.replace(',', '.')) : 0;
      const errosEl = document.getElementById('ic-erros');
      const erros = [];

      if (!nome) erros.push('Informe um nome para o item.');

      // Validar dano no formato de dados (ex: 1d6, 2d8 Cortante, 1d4+2 Perfurante)
      if (danoVal) {
        const regexDano = /^\d+d\d+(\s*[+\-]\s*\d+)?(\s+\w+)?$/i;
        if (!regexDano.test(danoVal)) {
          erros.push('Dano deve seguir o formato de dados: 1d8, 2d6 Cortante, 1d4+2 Perfurante');
        }
      }

      // Validar bonus CA (-5 a +5)
      if (ca < -5 || ca > 5) {
        erros.push('Bonus de CA deve ser entre -5 e +5.');
      }

      // Validar bonus Ataque (-5 a +10)
      if (atq < -5 || atq > 10) {
        erros.push('Bonus de Ataque deve ser entre -5 e +10.');
      }

      if (erros.length > 0) {
        if (errosEl) { errosEl.style.display = 'block'; errosEl.innerHTML = erros.join('<br>'); }
        return;
      }

      char.inventario.push({
        nome,
        tipo: 'customizado',
        quantidade: 1,
        equipado: false,
        descricao: desc,
        dados: {
          bonus_ca: String(ca),
          dano: danoVal,
          bonus_ataque: String(atq),
          peso: (pesoNum > 0 ? `${fmtPeso(pesoNum)} kg` : '')
        }
      });
      salvar();
      window.fecharModal();
      renderFichaCompleta();
      toast(`${nome} adicionado!`, 'success');
    });
  };

  // Editar Carteira (moedas)
  const _btnEditPo = document.getElementById('btn-edit-po');
  if (_btnEditPo) _btnEditPo.onclick = () => {
    const renderLinhasCarteira = () => DENOMINACOES.map(tipo => {
      const prox = proximaDenominacaoMaior(tipo);
      const podeConverter = prox && (char.moedas[tipo] || 0) >= prox.taxa;
      const labelConv = prox ? `↑ ${prox.tipoDestino.toUpperCase()}` : '↑';
      const tituloConv = prox ? `Converter ${prox.taxa} ${tipo.toUpperCase()} em 1 ${prox.tipoDestino.toUpperCase()}` : '';
      return `
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px">
          <span style="width:150px;font-size:0.85rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${NOMES_MOEDA[tipo]} (${tipo.toUpperCase()})">${ICONE_MOEDA[tipo]} ${NOMES_MOEDA[tipo]}</span>
          <span style="min-width:60px;text-align:right;font-weight:700">${char.moedas[tipo] || 0}</span>
          <input type="number" class="form-input" id="edit-moeda-${tipo}" min="0" placeholder="0" style="width:90px;box-sizing:border-box">
          <button class="btn btn-success btn-sm" data-moeda-add="${tipo}" style="height:36px">+</button>
          <button class="btn btn-danger btn-sm" data-moeda-sub="${tipo}" style="height:36px">-</button>
          <button class="btn btn-secondary btn-sm" data-moeda-conv="${tipo}" style="height:36px;min-width:52px${podeConverter ? '' : ';visibility:hidden'}" title="${tituloConv}" ${podeConverter ? '' : 'tabindex="-1"'}>${labelConv}</button>
        </div>
      `;
    }).join('');

    const renderLegendaTaxas = () => {
      const partes = ['pc', 'pp', 'pe', 'po'].map(tipo => {
        const prox = proximaDenominacaoMaior(tipo);
        return `${prox.taxa} ${tipo.toUpperCase()} = 1 ${prox.tipoDestino.toUpperCase()}`;
      });
      return `Tabela atual: ${partes.join(' | ')}`;
    };

    // Cadeia de conversao no estilo da tabela do livro (X menor = 1 maior)
    const CADEIA_TAXAS = [
      { de: 'pc', para: 'pp' },
      { de: 'pp', para: 'pe' },
      { de: 'pe', para: 'po' },
      { de: 'po', para: 'pl' }
    ];

    const renderCorpoTaxas = () => `
      <div style="text-align:center;margin-bottom:12px;font-size:0.75rem;color:var(--text-muted)">
        Quantas moedas menores formam 1 moeda maior, como na tabela do livro. Muda o valor real das moedas já guardadas.
      </div>
      <div style="display:flex;flex-direction:column;gap:10px;max-width:280px;margin:0 auto">
        ${CADEIA_TAXAS.map(({ de, para }) => {
          const prox = proximaDenominacaoMaior(de);
          return `
            <div style="display:flex;align-items:center;justify-content:center;gap:8px;font-size:0.85rem">
              <input type="number" class="form-input" id="taxa-${de}-${para}" min="1" step="1" value="${prox.taxa}" style="width:80px;text-align:center;box-sizing:border-box">
              <span style="white-space:nowrap">${ICONE_MOEDA[de]} ${de.toUpperCase()} = 1 ${ICONE_MOEDA[para]} ${para.toUpperCase()}</span>
            </div>
          `;
        }).join('')}
      </div>
      <div style="display:flex;gap:6px;margin-top:16px;justify-content:center">
        <button class="btn btn-primary btn-sm" id="btn-salvar-taxas">Salvar</button>
        ${!taxasSaoPadrao() ? '<button class="btn btn-secondary btn-sm" id="btn-resetar-taxas">Restaurar padrão</button>' : ''}
      </div>
    `;

    function wireEventosTaxas(subOverlay) {
      subOverlay.querySelector('#btn-salvar-taxas')?.addEventListener('click', () => {
        const lerTaxa = (de, para) => parseInt(subOverlay.querySelector(`#taxa-${de}-${para}`)?.value);
        const rPcPp = lerTaxa('pc', 'pp');
        const rPpPe = lerTaxa('pp', 'pe');
        const rPePo = lerTaxa('pe', 'po');
        const rPoPl = lerTaxa('po', 'pl');
        const pp = rPcPp;
        const pe = pp * rPpPe;
        const po = pe * rPePo;
        const pl = po * rPoPl;
        const resultado = salvarTaxasMoeda({ pp, pe, po, pl });
        if (!resultado.sucesso) {
          toast(resultado.erro, 'error');
          return;
        }
        atualizarModalCarteira();
        subOverlay.querySelector('[data-fechar-sub]')?.click();
        toast('Taxas de conversão salvas!', 'success');
      });

      subOverlay.querySelector('#btn-resetar-taxas')?.addEventListener('click', () => {
        resetarTaxasMoeda();
        atualizarModalCarteira();
        subOverlay.querySelector('[data-fechar-sub]')?.click();
        toast('Taxas restauradas ao padrão!', 'success');
      });
    }

    const renderCorpoCarteira = () => `
      <div style="text-align:center;margin-bottom:12px">
        <div style="font-size:1.1rem;font-weight:700;color:var(--primary)">${formatarCarteira(char.moedas)}</div>
        <div style="font-size:0.75rem;color:var(--text-muted)">Saldo atual — remover converte moedas maiores automaticamente se necessário</div>
      </div>
      ${renderLinhasCarteira()}
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:10px">
        <div style="font-size:0.7rem;color:var(--text-muted)">${renderLegendaTaxas()}</div>
        <button class="btn btn-secondary btn-sm" id="btn-abrir-taxas" style="white-space:nowrap">⚙ Taxas</button>
      </div>
    `;

    const atualizarModalCarteira = () => {
      const corpoEl = document.getElementById('modal-corpo');
      if (corpoEl) corpoEl.innerHTML = renderCorpoCarteira();
      wireEventosCarteira();
    };

    function wireEventosCarteira() {
      document.querySelectorAll('[data-moeda-add]').forEach(btn => {
        btn.addEventListener('click', () => {
          const tipo = btn.dataset.moedaAdd;
          const qtd = parseInt(document.getElementById(`edit-moeda-${tipo}`)?.value) || 0;
          if (qtd <= 0) return;
          char.moedas = adicionarMoeda(char.moedas, tipo, qtd);
          salvar();
          renderFichaCompleta();
          atualizarModalCarteira();
          toast(`+${qtd} ${tipo.toUpperCase()} adicionadas!`, 'success');
        });
      });

      document.querySelectorAll('[data-moeda-sub]').forEach(btn => {
        btn.addEventListener('click', () => {
          const tipo = btn.dataset.moedaSub;
          const qtd = parseInt(document.getElementById(`edit-moeda-${tipo}`)?.value) || 0;
          if (qtd <= 0) return;
          const resultado = removerQuantidadeMoeda(char.moedas, tipo, qtd);
          if (!resultado.sucesso) {
            toast('Saldo insuficiente!', 'error');
            return;
          }
          char.moedas = resultado.moedas;
          salvar();
          renderFichaCompleta();
          atualizarModalCarteira();
          toast(`-${qtd} ${tipo.toUpperCase()} removidas (conversão automática se necessário)!`, 'success');
        });
      });

      document.querySelectorAll('[data-moeda-conv]').forEach(btn => {
        btn.addEventListener('click', () => {
          const tipo = btn.dataset.moedaConv;
          const resultado = converterParaMaior(char.moedas, tipo);
          if (!resultado.sucesso) return;
          char.moedas = resultado.moedas;
          salvar();
          renderFichaCompleta();
          atualizarModalCarteira();
          toast('Moedas convertidas!', 'success');
        });
      });

      document.getElementById('btn-abrir-taxas')?.addEventListener('click', () => {
        abrirModal('Taxas de Conversão', renderCorpoTaxas(), '<button class="btn btn-secondary" data-fechar-sub="true">Fechar</button>');
        const subOverlay = document.querySelectorAll('.sub-modal-overlay');
        wireEventosTaxas(subOverlay[subOverlay.length - 1]);
      });
    }

    abrirModal('Carteira', renderCorpoCarteira(), '<button class="btn btn-secondary" onclick="fecharModal()">Fechar</button>');
    wireEventosCarteira();
  };
}

/** Abre modal para editar um item customizado existente no inventário */
function abrirModalEditarItemCustomizado(item, idx) {
  const d = item.dados || {};
  abrirModal('Editar Item Customizado', `
    <div class="form-group"><label class="form-label" for="ic-nome">Nome</label><input type="text" class="form-input" id="ic-nome" value="${(item.nome || '').replace(/"/g, '&quot;')}"></div>
    <div class="form-group"><label class="form-label" for="ic-desc">Descricao</label><textarea class="form-textarea" id="ic-desc" rows="2">${item.descricao || ''}</textarea></div>
    <div class="row gap-1">
      <div class="col">
        <label class="form-label" for="ic-ca">Bonus CA</label>
        <input type="number" class="form-input" id="ic-ca" value="${parseInt(d.bonus_ca) || ''}" placeholder="0" min="-5" max="5">
        <div style="font-size:0.65rem;color:var(--text-muted)">-5 a +5</div>
      </div>
      <div class="col">
        <label class="form-label" for="ic-dano">Dano</label>
        <input type="text" class="form-input" id="ic-dano" value="${(d.dano || '').replace(/"/g, '&quot;')}" placeholder="1d8 Cortante">
        <div style="font-size:0.65rem;color:var(--text-muted)">Ex: 2d6 Cortante</div>
      </div>
      <div class="col">
        <label class="form-label" for="ic-atq">Bonus Atq</label>
        <input type="number" class="form-input" id="ic-atq" value="${parseInt(d.bonus_ataque) || ''}" placeholder="0" min="-5" max="10">
        <div style="font-size:0.65rem;color:var(--text-muted)">-5 a +10</div>
      </div>
    </div>
    <div id="ic-erros" style="display:none;color:var(--danger);font-size:0.8rem;margin-top:8px"></div>
  `, '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-primary" id="btn-salvar-ic">Salvar</button>');

  document.getElementById('btn-salvar-ic')?.addEventListener('click', () => {
    const nome = document.getElementById('ic-nome')?.value?.trim();
    const desc = document.getElementById('ic-desc')?.value?.trim() || '';
    const ca = parseInt(document.getElementById('ic-ca')?.value) || 0;
    const danoVal = document.getElementById('ic-dano')?.value?.trim() || '';
    const atq = parseInt(document.getElementById('ic-atq')?.value) || 0;
    const errosEl = document.getElementById('ic-erros');
    const erros = [];

    if (!nome) erros.push('Informe um nome para o item.');
    if (danoVal) {
      const regexDano = /^\d+d\d+(\s*[+\-]\s*\d+)?(\s+\w+)?$/i;
      if (!regexDano.test(danoVal)) erros.push('Dano deve seguir o formato de dados: 1d8, 2d6 Cortante, 1d4+2 Perfurante');
    }
    if (ca < -5 || ca > 5) erros.push('Bonus de CA deve ser entre -5 e +5.');
    if (atq < -5 || atq > 10) erros.push('Bonus de Ataque deve ser entre -5 e +10.');

    if (erros.length > 0) {
      if (errosEl) { errosEl.style.display = 'block'; errosEl.innerHTML = erros.join('<br>'); }
      return;
    }

    char.inventario[idx].nome = nome;
    char.inventario[idx].descricao = desc;
    if (!char.inventario[idx].dados) char.inventario[idx].dados = {};
    char.inventario[idx].dados.bonus_ca = String(ca);
    char.inventario[idx].dados.dano = danoVal;
    char.inventario[idx].dados.bonus_ataque = String(atq);
    salvar();
    window.fecharModal();
    renderFichaCompleta();
    toast(`${nome} atualizado!`, 'success');
  });
}

/** Re-renderiza apenas a lista do inventário sem refazer a ficha toda */
function reRenderSheetInv() {
  // Se a sobrecarga afeta o deslocamento, mudanças de peso alteram stats globais
  // (deslocamento, badges) — re-render completo garante consistência.
  if (char?.config?.sobrecarga_afeta_deslocamento) { renderFichaCompleta(); return; }

  const invEl = document.getElementById('sheet-inventario');
  if (!invEl) { renderFichaCompleta(); return; }

  const inv = char.inventario || [];
  const equipados = [];
  const naoEquipados = [];
  const zerados = [];
  inv.forEach((item, idx) => {
    if ((item.quantidade ?? 1) <= 0) zerados.push(idx);
    else if (item.equipado) equipados.push(idx);
    else naoEquipados.push(idx);
  });

  invEl.innerHTML = inv.length === 0
    ? '<div style="color:var(--text-muted);text-align:center;padding:12px;font-size:0.85rem">Inventario vazio</div>'
    : renderSheetInvLista(equipados, naoEquipados, zerados);

  // Atualizar barra de peso atual (fica fora de #sheet-inventario)
  const pesoEl = document.getElementById('sheet-peso-valor');
  if (pesoEl) {
    const _carga = getEstadoCarga();
    const _mostrarSobrecarga = _carga.sobrecarregado && !!char?.config?.sobrecarga_afeta_deslocamento;
    pesoEl.style.color = _mostrarSobrecarga ? 'var(--danger)' : 'var(--text-muted)';
    pesoEl.innerHTML = `Peso: <strong>${fmtPeso(_carga.pesoAtual)}</strong> / ${fmtPeso(_carga.capacidade)} kg`
      + (_mostrarSobrecarga ? ' <span style="font-weight:700;margin-left:4px">&#9888; Sobrecarregado</span>' : '');
  }

  // Re-bind eventos
  setupEventosInventarioSheet();
}

/** Drag and drop no inventário da ficha (desktop e mobile) */
function setupSheetDragDrop() {
  const listaEl = document.getElementById('sheet-inventario');
  if (!listaEl) return;

  let dragIdx = null;

  // ---- Eventos de mouse (desktop): drag inicia apenas pelo handle ----
  listaEl.querySelectorAll('.inv-item[data-idx]').forEach(el => {
    const handle = el.querySelector('.inv-drag-handle');
    if (handle) {
      handle.addEventListener('mousedown', () => {
        el.setAttribute('draggable', 'true');
      });
    }

    el.addEventListener('dragstart', (e) => {
      // Seguranca: so permite drag se iniciado pelo handle
      if (!el.getAttribute('draggable')) { e.preventDefault(); return; }
      dragIdx = parseInt(el.dataset.idx);
      el.classList.add('inv-item-dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    el.addEventListener('dragend', () => {
      el.classList.remove('inv-item-dragging');
      el.removeAttribute('draggable');
      listaEl.querySelectorAll('.inv-item').forEach(item => item.classList.remove('inv-item-dragover'));
      dragIdx = null;
    });

    el.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      el.classList.add('inv-item-dragover');
    });

    el.addEventListener('dragleave', () => {
      el.classList.remove('inv-item-dragover');
    });

    el.addEventListener('drop', (e) => {
      e.preventDefault();
      const dropIdx = parseInt(el.dataset.idx);
      if (dragIdx !== null && dragIdx !== dropIdx) {
        const [item] = char.inventario.splice(dragIdx, 1);
        char.inventario.splice(dropIdx, 0, item);
        salvar();
        reRenderSheetInv();
      }
    });
  });

  // ---- Eventos de toque (mobile): drag inicia apenas pelo handle ----
  let touchDragEl = null;
  let touchClone = null;
  let touchOffsetX = 0;
  let touchOffsetY = 0;

  listaEl.querySelectorAll('.inv-item[data-idx]').forEach(el => {
    el.addEventListener('touchstart', (e) => {
      // So inicia drag se o toque for no handle de organizacao
      if (!e.target.closest('.inv-drag-handle')) return;
      const touch = e.touches[0];
      dragIdx = parseInt(el.dataset.idx);
      touchDragEl = el;

      const rect = el.getBoundingClientRect();
      touchOffsetX = touch.clientX - rect.left;
      touchOffsetY = touch.clientY - rect.top;

      // Criar clone visual para arrastar
      touchClone = el.cloneNode(true);
      touchClone.style.cssText = `
        position: fixed;
        left: ${rect.left}px;
        top: ${rect.top}px;
        width: ${rect.width}px;
        opacity: 0.85;
        pointer-events: none;
        z-index: 9999;
        background: var(--bg-card);
        border: 2px solid var(--primary);
        border-radius: var(--radius-sm);
        box-shadow: 0 4px 16px rgba(0,0,0,0.25);
      `;
      document.body.appendChild(touchClone);
      el.classList.add('inv-item-dragging');
    }, { passive: true });

    el.addEventListener('touchmove', (e) => {
      if (!touchClone || !touchDragEl) return;
      e.preventDefault();
      const touch = e.touches[0];

      // Mover clone
      touchClone.style.left = `${touch.clientX - touchOffsetX}px`;
      touchClone.style.top = `${touch.clientY - touchOffsetY}px`;

      // Destacar item abaixo do toque
      listaEl.querySelectorAll('.inv-item').forEach(item => item.classList.remove('inv-item-dragover'));
      touchClone.style.display = 'none';
      const elementoAbaixo = document.elementFromPoint(touch.clientX, touch.clientY);
      touchClone.style.display = '';
      const alvo = elementoAbaixo?.closest('.inv-item[data-idx]');
      if (alvo && alvo !== touchDragEl) {
        alvo.classList.add('inv-item-dragover');
      }
    }, { passive: false });

    el.addEventListener('touchend', (e) => {
      if (!touchDragEl) return;
      const touch = e.changedTouches[0];

      // Identificar destino
      touchClone.style.display = 'none';
      const elementoAbaixo = document.elementFromPoint(touch.clientX, touch.clientY);
      touchClone.style.display = '';
      const alvo = elementoAbaixo?.closest('.inv-item[data-idx]');

      if (alvo && alvo !== touchDragEl) {
        const dropIdx = parseInt(alvo.dataset.idx);
        if (dragIdx !== null && dragIdx !== dropIdx) {
          const [item] = char.inventario.splice(dragIdx, 1);
          char.inventario.splice(dropIdx, 0, item);
          salvar();
          reRenderSheetInv();
        }
      }

      // Limpar
      if (touchClone) { touchClone.remove(); touchClone = null; }
      touchDragEl.classList.remove('inv-item-dragging');
      listaEl.querySelectorAll('.inv-item').forEach(item => item.classList.remove('inv-item-dragover'));
      touchDragEl = null;
      dragIdx = null;
    });
  });
}

// --- Seletor de itens por categoria ---

/** Cache local dos dados de equipamento */
let _cacheEquipSheet = null;

export async function carregarDadosEquipSheet() {
  if (_cacheEquipSheet) return _cacheEquipSheet;
  const [armasData, armadurasData, equipData] = await Promise.all([
    getArmas(), getArmaduras(), getEquipamentoAventura()
  ]);
  _cacheEquipSheet = {
    armas: armasData?.armas || [],
    propriedadesArmas: armasData?.propriedades || [],
    armaduras: armadurasData?.armaduras || [],
    equipAvent: equipData?.itens || [],
    municao: (equipData?.municao || []).map(m => ({
      nome: m.tipo,
      custo: m.custo || '',
      peso: m.peso || '',
      descricao: `Quantidade: ${m.quantidade || '—'} | Armazenamento: ${m.armazenamento || '—'}`
    }))
  };
  return _cacheEquipSheet;
}

/** Mostra popup com detalhes completos de um item do inventário */
async function mostrarDetalheItemSheet(item) {
  if (!item) return;
  const dados = await carregarDadosEquipSheet();
  const propsDescs = dados.propriedadesArmas || [];
  let corpo = '';

  if (item.tipo === 'arma') {
    const d = item.dados || {};
    corpo += `<div class="row" style="font-size:0.85rem;gap:8px;margin-bottom:10px">`;
    if (d.categoria) corpo += `<div class="col"><strong>Categoria:</strong> ${d.categoria}</div>`;
    if (d.dano) corpo += `<div class="col"><strong>Dano:</strong> ${d.dano}</div>`;
    corpo += `</div>`;

    if (d.maestria) corpo += `<div style="font-size:0.85rem;margin-bottom:6px"><strong>Maestria:</strong> ${d.maestria}</div>`;
    if (d.custo || d.peso) corpo += `<div style="font-size:0.85rem;margin-bottom:6px"><strong>Custo:</strong> ${d.custo || '—'} | <strong>Peso:</strong> ${d.peso || '—'}</div>`;

    // Descrições das propriedades
    if (d.propriedades) {
      const propsNomes = d.propriedades.split(',').map(p => p.trim().replace(/\s*\(.*\)/, ''));
      const propsComDesc = propsNomes
        .map(nome => {
          const prop = propsDescs.find(p => semAcento(p.nome).toLowerCase() === semAcento(nome).toLowerCase());
          return prop ? { nome: prop.nome, descricao: prop.descricao } : null;
        })
        .filter(Boolean);

      if (propsComDesc.length > 0) {
        corpo += `<div class="section-divider mt-1"><span>Propriedades</span></div>`;
        corpo += propsComDesc.map(p => `
          <details style="margin-bottom:4px">
            <summary style="font-weight:600;cursor:pointer;font-size:0.85rem">${p.nome}</summary>
            <div class="md-content" style="padding:4px 0;font-size:0.8rem">${mdParaHtml(p.descricao)}</div>
          </details>
        `).join('');
      }

      if (d.maestria) {
        const maestriaDesc = propsDescs.find(p => semAcento(p.nome).toLowerCase() === semAcento(d.maestria).toLowerCase());
        if (maestriaDesc) {
          corpo += `<div class="section-divider mt-1"><span>Maestria: ${d.maestria}</span></div>`;
          corpo += `<div class="md-content" style="font-size:0.8rem">${mdParaHtml(maestriaDesc.descricao)}</div>`;
        }
      }
    }
  } else if (item.tipo === 'armadura' || item.tipo === 'escudo') {
    const d = item.dados || {};
    corpo += `<div style="font-size:0.85rem;margin-bottom:6px">`;
    if (d.categoria) corpo += `<strong>Categoria:</strong> ${d.categoria}<br>`;
    if (d.ca) corpo += `<strong>Classe de Armadura:</strong> ${d.ca}<br>`;
    if (d.requisito_forca && d.requisito_forca !== '—') corpo += `<strong>Requisito de Força:</strong> ${d.requisito_forca}<br>`;
    if (d.furtividade && d.furtividade !== '—') corpo += `<strong>Furtividade:</strong> ${d.furtividade}<br>`;
    if (d.custo || d.peso) corpo += `<strong>Custo:</strong> ${d.custo || '—'} | <strong>Peso:</strong> ${d.peso || '—'}`;
    corpo += `</div>`;
  } else if (item.tipo === 'customizado') {
    const d = item.dados || {};
    const bonusCa = parseInt(d.bonus_ca) || 0;
    const bonusAtq = parseInt(d.bonus_ataque) || 0;
    const dano = d.dano || '';

    corpo += `<div style="font-size:0.85rem;margin-bottom:6px"><span class="badge" style="font-size:0.7rem;background:#f3e5f5;color:#6a1b9a">Item Customizado</span></div>`;

    if (bonusCa || dano || bonusAtq) {
      corpo += `<div style="font-size:0.85rem;margin-bottom:6px">`;
      if (bonusCa) corpo += `<strong>Bonus CA:</strong> ${bonusCa > 0 ? '+' : ''}${bonusCa}<br>`;
      if (dano) corpo += `<strong>Dano:</strong> ${dano}<br>`;
      if (bonusAtq) corpo += `<strong>Bonus Ataque:</strong> ${bonusAtq > 0 ? '+' : ''}${bonusAtq}`;
      corpo += `</div>`;
    }

    if (item.descricao) {
      corpo += `<div class="md-content" style="margin-top:6px;font-size:0.85rem">${mdParaHtml(item.descricao)}</div>`;
    }
  } else {
    const d = item.dados || {};
    if (d.tipo_uso) {
      const tipoLabel = d.tipo_uso === 'consumivel' ? '🧪 Consumível' : '🎒 Equipamento';
      corpo += `<div style="font-size:0.85rem;margin-bottom:6px"><span class="badge" style="font-size:0.7rem;background:${d.tipo_uso === 'consumivel' ? '#e8f5e9;color:#2e7d32' : '#e3f2fd;color:#1565c0'}">${tipoLabel}</span></div>`;
    }
    if (d.custo || d.peso) {
      corpo += `<div style="font-size:0.85rem"><strong>Custo:</strong> ${d.custo || '—'} | <strong>Peso:</strong> ${d.peso || '—'}</div>`;
    }
    if (d.descricao) {
      corpo += `<div class="md-content" style="margin-top:6px;font-size:0.85rem">${mdParaHtml(d.descricao)}</div>`;
    }
    if (item.descricao) {
      corpo += `<div class="md-content" style="margin-top:6px;font-size:0.85rem">${mdParaHtml(item.descricao)}</div>`;
    }
  }

  if (!corpo.trim()) corpo = '<div style="color:var(--text-muted)">Sem informações adicionais disponíveis.</div>';

  if (item.tipo === 'customizado') {
    const _idxItem = char.inventario.indexOf(item);
    abrirModal(item.nome, corpo,
      `<button class="btn btn-secondary" onclick="fecharModal()">Fechar</button>
       <button class="btn btn-primary" id="btn-editar-item-custom">Editar</button>`
    );
    document.getElementById('btn-editar-item-custom')?.addEventListener('click', () => {
      window.fecharModal();
      abrirModalEditarItemCustomizado(item, _idxItem);
    });
  } else {
    abrirModal(item.nome, corpo);
  }
}

/** Abre o seletor de itens dividido por categorias */
async function mostrarSeletorCategoria() {
  const dados = await carregarDadosEquipSheet();

  // Categorias de itens consumíveis / poções do equipamento de aventura
  const ITENS_CONSUMIVEIS = ['Ácido', 'Água Benta', 'Antitoxina', 'Fogo Alquímico', 'Óleo', 'Veneno Básico'];

  const consumiveis = dados.equipAvent.filter(i => ITENS_CONSUMIVEIS.some(c => i.nome.includes(c)));
  const municao = dados.municao || [];
  const outrosEquip = dados.equipAvent.filter(i =>
    !ITENS_CONSUMIVEIS.some(c => i.nome.includes(c))
  );

  const categorias = [
    { id: 'armas', label: 'Armas', icon: '&#9876;' },
    { id: 'armaduras', label: 'Armaduras', icon: '&#128737;' },
    { id: 'consumiveis', label: 'Consumiveis', icon: '&#9878;' },
    { id: 'municao', label: 'Municao', icon: '&#10148;' },
    { id: 'equipamento', label: 'Equipamento', icon: '&#128188;' }
  ];

  const html = `
    <div class="search-box"><input type="text" id="busca-inv-cat" placeholder="Buscar item..." class="form-input"></div>
    <div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap">
      ${categorias.map(c => `
        <button class="btn btn-sm btn-outline filtro-inv-cat ${c.id === 'armas' ? 'active' : ''}" data-cat="${c.id}">
          <span>${c.icon}</span> ${c.label}
        </button>
      `).join('')}
    </div>
    <div id="lista-inv-cat" style="min-height:35dvh;max-height:50dvh;overflow-y:auto"></div>
  `;

  abrirModal('Adicionar Item', html, '', () => {
    document.getElementById('toggle-comprar-item')?.closest('label')?.remove();
  });

  let catAtual = 'armas';
  let comprarAtivo = carregarComprarAtivoPadrao();

  const headerFechar = document.querySelector('#modal-header .modal-fechar');
  if (headerFechar) {
    headerFechar.insertAdjacentHTML('beforebegin', `
      <label class="form-check" style="display:flex;align-items:center;gap:6px;font-size:0.75rem;font-weight:400;white-space:nowrap;cursor:pointer;margin-left:auto">
        <input type="checkbox" id="toggle-comprar-item" ${comprarAtivo ? 'checked' : ''}>
        💰 Comprar
      </label>
    `);
    document.getElementById('toggle-comprar-item')?.addEventListener('change', (e) => {
      comprarAtivo = e.target.checked;
      salvarComprarAtivoPadrao(comprarAtivo);
    });
  }

  function renderCategoria(cat, filtroTexto) {
    const listaEl = document.getElementById('lista-inv-cat');
    if (!listaEl) return;

    let itens = [];
    switch (cat) {
      case 'armas':
        itens = dados.armas.map(a => {
          const prof = sheetTemProfArma(a);
          // Verificar se o personagem tem maestria com esta arma
          const temMaestriaArma = (char.maestrias_arma || []).includes(a.nome);
          const maestriaBadgeAdd = temMaestriaArma && a.maestria
            ? `<span class="badge" style="font-size:0.6rem;background:#fff8e1;color:#e65100;border:1px solid #ffcc80;font-weight:700">Maestria: ${a.maestria}</span>`
            : '';
          return {
            nome: a.nome,
            detalhe: `${a.dano} | ${a.propriedades || '\u2014'}`,
            detalhe2: `Maestria: ${a.maestria || '\u2014'} | ${a.custo} | ${a.peso || '\u2014'}`,
            badge: sheetBadgeProf(prof) + (maestriaBadgeAdd ? ' ' + maestriaBadgeAdd : ''),
            badgeCat: `<span class="badge badge-secondary">${a.categoria?.includes('Dist') ? 'Dist\u00e2ncia' : 'Corpo'}</span>`,
            prof,
            dados: a,
            tipo: 'arma'
          };
        });
        // Proficientes primeiro
        itens.sort((a, b) => (a.prof ? 0 : 1) - (b.prof ? 0 : 1));
        break;
      case 'armaduras':
        itens = dados.armaduras.map(a => {
          const prof = sheetTemProfArmadura(a);
          const extras = [];
          if (a.requisito_forca && a.requisito_forca !== '\u2014') extras.push(`For: ${a.requisito_forca}`);
          if (a.furtividade && a.furtividade !== '\u2014') extras.push(`Furt.: ${a.furtividade}`);
          return {
            nome: a.nome,
            detalhe: `CA: ${a.ca}${extras.length ? ' | ' + extras.join(' | ') : ''}`,
            detalhe2: `${a.custo} | ${a.peso || '\u2014'}`,
            badge: sheetBadgeProf(prof),
            badgeCat: `<span class="badge badge-secondary">${a.categoria}</span>`,
            prof,
            dados: a,
            tipo: a.nome === 'Escudo' ? 'escudo' : 'armadura'
          };
        });
        itens.sort((a, b) => (a.prof ? 0 : 1) - (b.prof ? 0 : 1));
        break;
      case 'consumiveis':
        itens = consumiveis.map(i => ({
          nome: i.nome,
          detalhe: `${i.custo} | ${i.peso || '\u2014'}`,
          detalhe2: i.descricao ? (i.descricao.length > 80 ? i.descricao.substring(0, 80) + '…' : i.descricao) : '',
          badge: '<span class="badge" style="font-size:0.6rem;background:#e8f5e9;color:#2e7d32">Consumível</span>',
          badgeCat: '',
          dados: i,
          tipo: 'equipamento'
        }));
        break;
      case 'municao':
        itens = municao.map(i => ({
          nome: i.nome,
          detalhe: `${i.custo} | ${i.peso || '\u2014'}`,
          badge: '', badgeCat: '',
          dados: i,
          tipo: 'equipamento'
        }));
        break;
      case 'equipamento':
        itens = outrosEquip.map(i => ({
          nome: i.nome,
          detalhe: `${i.custo} | ${i.peso || '\u2014'}`,
          badge: '', badgeCat: '',
          dados: i,
          tipo: 'equipamento'
        }));
        break;
    }

    // Filtrar por texto
    if (filtroTexto) {
      itens = itens.filter(i => semAcento(i.nome).includes(filtroTexto));
    }

    listaEl.innerHTML = itens.length === 0
      ? '<div style="color:var(--text-muted);text-align:center;padding:16px">Nenhum item encontrado</div>'
      : itens.map((it, i) => `
        <div class="inv-item ${it.prof === false ? 'item-sem-prof' : ''}" style="cursor:pointer" data-add-cat="${i}">
          <div style="flex:1">
            <div class="inv-item-nome">${it.nome} ${it.badge}</div>
            <div class="inv-item-detalhe">${it.detalhe}</div>
            ${it.detalhe2 ? `<div class="inv-item-detalhe" style="font-size:0.7rem;opacity:0.7">${it.detalhe2}</div>` : ''}
          </div>
          ${it.badgeCat || ''}
        </div>
      `).join('');

    // Eventos de seleção - mostrar descrição antes de adicionar
    listaEl.querySelectorAll('[data-add-cat]').forEach(el => {
      el.addEventListener('click', () => {
        const item = itens[parseInt(el.dataset.addCat)];
        if (!item) return;

        // Construir descrição completa do item
        let descCorpo = '';
        const d = item.dados || {};
        if (item.tipo === 'arma') {
          descCorpo += `<div style="font-size:0.85rem;margin-bottom:6px">`;
          if (d.categoria) descCorpo += `<strong>Categoria:</strong> ${d.categoria}<br>`;
          if (d.dano) descCorpo += `<strong>Dano:</strong> ${d.dano}<br>`;
          if (d.maestria) descCorpo += `<strong>Maestria:</strong> ${d.maestria}<br>`;
          if (d.propriedades) descCorpo += `<strong>Propriedades:</strong> ${d.propriedades}<br>`;
          if (d.custo || d.peso) descCorpo += `<strong>Custo:</strong> ${d.custo || '—'} | <strong>Peso:</strong> ${d.peso || '—'}`;
          descCorpo += `</div>`;
        } else if (item.tipo === 'armadura' || item.tipo === 'escudo') {
          descCorpo += `<div style="font-size:0.85rem;margin-bottom:6px">`;
          if (d.categoria) descCorpo += `<strong>Categoria:</strong> ${d.categoria}<br>`;
          if (d.ca) descCorpo += `<strong>CA:</strong> ${d.ca}<br>`;
          if (d.custo || d.peso) descCorpo += `<strong>Custo:</strong> ${d.custo || '—'} | <strong>Peso:</strong> ${d.peso || '—'}`;
          descCorpo += `</div>`;
        } else {
          if (d.custo || d.peso) descCorpo += `<div style="font-size:0.85rem;margin-bottom:6px"><strong>Custo:</strong> ${d.custo || '—'} | <strong>Peso:</strong> ${d.peso || '—'}</div>`;
          if (d.descricao) descCorpo += `<div class="md-content" style="font-size:0.85rem">${mdParaHtml(d.descricao)}</div>`;
        }
        if (!descCorpo.trim()) descCorpo = '<div style="color:var(--text-muted)">Sem descrição disponível.</div>';

        const custoItemStr = item.dados?.custo || '';
        const custoParseado = comprarAtivo ? parseCusto(custoItemStr) : null;
        const labelBtnConfirmar = comprarAtivo ? 'Comprar e adicionar ao inventário' : 'Adicionar ao Inventário';
        let quantidadeSelecionada = 1;

        abrirModal(item.nome,
          descCorpo,
          `<button class="btn btn-secondary" onclick="fecharModal()">Voltar</button>
           <button class="btn btn-primary" id="btn-confirmar-add-item">${labelBtnConfirmar}</button>`
        );

        const subOverlays = document.querySelectorAll('.sub-modal-overlay');
        const subHeaderFechar = subOverlays[subOverlays.length - 1]?.querySelector('.modal-header .modal-fechar');

        if (subHeaderFechar) {
          subHeaderFechar.insertAdjacentHTML('beforebegin', `
            <div style="display:flex;align-items:center;gap:4px;margin-left:auto">
              <button type="button" class="btn btn-secondary btn-sm" id="btn-qtd-item-menos" disabled style="width:26px;height:26px;padding:0;line-height:1;font-weight:700">−</button>
              <span id="valor-qtd-item" style="min-width:18px;text-align:center;font-weight:700;font-size:0.85rem">1</span>
              <button type="button" class="btn btn-secondary btn-sm" id="btn-qtd-item-mais" style="width:26px;height:26px;padding:0;line-height:1;font-weight:700">+</button>
            </div>
          `);

          if (comprarAtivo) {
            subHeaderFechar.insertAdjacentHTML('beforebegin', `
              <span id="badge-custo-item" style="font-weight:700;font-size:0.85rem;color:var(--primary);white-space:nowrap"></span>
            `);
          }

          const atualizarUiQtd = () => {
            const valorEl = document.getElementById('valor-qtd-item');
            if (valorEl) valorEl.textContent = quantidadeSelecionada;
            const menosEl = document.getElementById('btn-qtd-item-menos');
            if (menosEl) menosEl.disabled = quantidadeSelecionada <= 1;
            const badgeEl = document.getElementById('badge-custo-item');
            if (badgeEl) {
              badgeEl.textContent = custoParseado
                ? `💰 ${custoParseado.qtd * quantidadeSelecionada} ${custoParseado.tipo.toUpperCase()}`
                : (custoItemStr ? `💰 ${custoItemStr}` : '💰 Custo indefinido');
            }
          };
          atualizarUiQtd();

          document.getElementById('btn-qtd-item-menos')?.addEventListener('click', () => {
            if (quantidadeSelecionada > 1) {
              quantidadeSelecionada--;
              atualizarUiQtd();
            }
          });
          document.getElementById('btn-qtd-item-mais')?.addEventListener('click', () => {
            quantidadeSelecionada++;
            atualizarUiQtd();
          });
        }

        document.getElementById('btn-confirmar-add-item')?.addEventListener('click', (e) => {
          e.target.disabled = true;
          let sufixoToast = '';
          const prefixoQtd = quantidadeSelecionada > 1 ? `${quantidadeSelecionada}x ` : '';

          if (comprarAtivo) {
            if (!custoParseado) {
              sufixoToast = ' (custo indeterminado, sem cobrança)';
            } else {
              const custoTotalStr = `${custoParseado.qtd * quantidadeSelecionada} ${custoParseado.tipo.toUpperCase()}`;
              if (!podePagarCusto(char.moedas, custoTotalStr)) {
                toast(`Saldo insuficiente para comprar ${prefixoQtd}${item.nome}!`, 'error');
                e.target.disabled = false;
                return;
              }
              const resultadoPagamento = pagarCusto(char.moedas, custoTotalStr);
              char.moedas = resultadoPagamento.moedas;
              sufixoToast = ` por ${custoTotalStr}`;
            }
          }

          const novoItem = {
            nome: item.nome,
            tipo: item.tipo,
            quantidade: quantidadeSelecionada,
            equipado: false,
            descricao: item.tipo === 'arma' ? `${item.dados.dano}` : item.tipo === 'armadura' ? `CA: ${item.dados.ca}` : '',
            dados: { ...item.dados }
          };

          // Verificar se já existe no inventário (agrupar)
          const existente = char.inventario.find(inv => inv.nome === item.nome && inv.tipo === item.tipo);
          if (existente && ['equipamento', 'generico'].includes(item.tipo)) {
            existente.quantidade = (existente.quantidade || 1) + quantidadeSelecionada;
          } else {
            char.inventario.push(novoItem);
          }

          salvar();
          window.fecharModal();
          renderFichaCompleta();
          toast(`${prefixoQtd}${item.nome} adicionado${sufixoToast}!`, 'success');
        });
      });
    });
  }

  // Renderizar categoria inicial
  renderCategoria(catAtual, '');

  // Eventos de troca de categoria
  document.querySelectorAll('.filtro-inv-cat').forEach(btn => {
    btn.addEventListener('click', () => {
      catAtual = btn.dataset.cat;
      document.querySelectorAll('.filtro-inv-cat').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const termo = semAcento(document.getElementById('busca-inv-cat')?.value || '');
      renderCategoria(catAtual, termo);
    });
  });

  // Busca por texto
  document.getElementById('busca-inv-cat')?.addEventListener('input', (e) => {
    const termo = semAcento(e.target.value);
    renderCategoria(catAtual, termo);
  });
}