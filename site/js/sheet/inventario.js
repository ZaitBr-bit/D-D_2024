// ============================================================
// Inventario da ficha
//
// Lista, arrasta-e-solta, seletores de item e itens personalizados.
// Extraido de site/js/pages/sheet.js sem alteracao de comportamento.
// ============================================================
import { atributoEfetivo } from '../regras-atributos.js';
import { DENOMINACOES, ICONE_MOEDA, NOMES_MOEDA, adicionarMoeda, converterParaMaior, converterParaMenor, htmlCarteira, proximaDenominacaoMaior, proximaDenominacaoMenor, removerQuantidadeMoeda, taxasSaoPadrao } from '../moedas.js';
import { carregarComprarAtivoPadrao, resetarTaxasMoeda, salvarComprarAtivoPadrao, salvarTaxasMoeda } from '../store.js';
import { abrirModal, escHtml, fmtMod, fmtPeso, gerarId, getCapacidadeCarga, getPesoTotalInventario, inserirNoInicio, localDoItem, mdParaHtml, moverParaInicio, semAcento, toast } from '../utils.js';
import { abrirSeletorItens, carregarDadosEquipSheet } from '../itens-seletor.js';
import { cobrarPrecoInformado, htmlCampoPrecoInformado } from '../preco-informado-ui.js';
import { getEstadoRecursosGuardiao } from './classes/guardiao.js';
import { _salvarEstadoColapso, _secoesInvColapsadas } from './colapso.js';
import { ataqueImprudenteAtivo, calcVantagemDesvantagemAtaque, temArmaduraPesadaEquipada } from './combate.js';
import { sheetBadgeProf, sheetTemProfArma, sheetTemProfArmadura, visaoNoEscuroDaEspecie } from './condicoes.js';
import { char, especiesCache, salvar } from './estado.js';
import { calcularAtaqueItem, atributoPadraoEfetivoArma, htmlSeloAtributoArma } from './ataque-calculo.js';
import { ATRIBUTOS_MODIFICADOR, ehArmaDeAtaque, atributoExplicito, equiparComAjusteDeMaos, textoCADaArmadura } from '../regras-ataque.js';
import { renderFichaCompleta } from './ficha.js';
import { descricaoDePropriedade, mesclarDadosItemCustomizado, htmlFormularioItemCustomizado, lerFormularioItemCustomizado, ligarEventosFormularioItemCustomizado } from './item-customizado-form.js';
import { itemAtivo } from '../regras-itens-magicos.js';
import { EFEITO_RECUPERAR_ESPACO, espacosRecuperaveis, mensagemSemEspaco, restaurarEspacoPorItem } from '../regras-espacos-itens.js';
import { recuperarUmEspaco, reservasDeEspacos } from './reservas-espacos.js';
import { nomeBaseDoItem, selosDeEfeitos } from '../itens-magicos-catalogo.js';
import { htmlCorpoItemMagico } from '../itens-magicos-ui.js';
import { tetoSintonizacao, itensSintonizados, podeSintonizar } from '../regras-sintonizacao.js';
import { PASSIVOS_VERSAO, alternarUso, ajustarCarga, aplicarContadorManual, contadorEhManual, garantirEstadoRecursos, gastarCarga, itensComRecuperacaoPendente, limparPendenciasObsoletas, marcarDestruido, preencherRecursosDoAcervo, recursosDoFormulario, recursosDoItem, removerContadorManual, restaurarItem } from '../regras-recursos-itens.js';
import { getItensMagicos } from '../db.js';
import { aplicarMagiaNoPergaminho, circuloDoItemPergaminho } from '../regras-pergaminho.js';
import { carregarMagiasIndicePergaminho, htmlSeletorMagiaPergaminho, ligarSeletorMagiaPergaminho, magiaSelecionadaPergaminho } from '../pergaminho-ui.js';
import { opcoesDeEscolha } from '../regras-passivos-itens.js';
import { aplicarAumentoPermanente, aumentoPermanenteDoItem } from '../regras-aumento-atributo.js';
import { atendeRequisito, lerRequisito } from '../regras-sintonizacao-restrita.js';
import { abrirModalRecuperacao, sincronizarBonusPvNiveis } from './hp-descanso.js';
import { perguntarUltimaCarga } from './ultima-carga.js';

// --- Inventário na ficha ---
/** Estado de carga do personagem: peso atual, capacidade e flag de sobrecarga. */
export function getEstadoCarga() {
  const forca = atributoEfetivo(char, 'forca') || 0;
  const tamanho = char?.tamanho || 'Médio';
  const pesoAtual = getPesoTotalInventario(char?.inventario || [], char?.inventario_locais || []);
  const capacidade = getCapacidadeCarga(forca, tamanho);
  const sobrecarregado = capacidade > 0 && pesoAtual > capacidade;
  return { pesoAtual, capacidade, sobrecarregado };
}

/**
 * HTML do contador "Sintonizados: X / 3" do cabecalho do inventario. Vazio
 * quando nenhum item pede sintonizacao -- a caixa some da tela nesse caso.
 * Extraida para `reRenderSheetInv` remendar o mesmo texto sem refazer a
 * ficha inteira (o contador ficava desatualizado apos remover um item
 * sintonizado, issue #57).
 */
function htmlContadorSintonizados() {
  const temAlgumQuePede = itensSintonizados(char).length > 0
    || (char.inventario || []).some(i => i?.dados?.requer_sintonizacao);
  if (!temAlgumQuePede) return '';
  return `<span style="font-size:0.75rem;color:var(--text-muted);margin-left:10px">Sintonizados: <strong>${itensSintonizados(char).length}</strong> / ${tetoSintonizacao(char)}</span>`;
}

/**
 * Texto do requisito de sintonização do item quando o personagem não o
 * atende (ex.: "por um Mago"); string vazia quando atende, não há requisito
 * ou o texto não é verificável.
 */
function requisitoNaoAtendido(item) {
  const texto = String(item?.dados?.requisito_sintonizacao || '').trim();
  if (!texto) return '';
  return atendeRequisito(char, lerRequisito(texto)) ? '' : texto;
}

/** HTML do botão do amanhecer com a contagem de itens pendentes; vazio quando não há pendência. */
export function htmlBotaoRecuperarItens() {
  limparPendenciasObsoletas(char);
  const n = itensComRecuperacaoPendente(char).length;
  return n ? `<div style="padding:4px 0"><button class="btn btn-sm btn-accent" id="btn-recuperar-itens">Amanhecer: informar recuperação (${n})</button></div>` : '';
}

/** Atualiza o botão do amanhecer (fora de #sheet-inventario) e liga o clique sem empilhar listeners. */
export function atualizarBotaoRecuperarItens() {
  const el = document.getElementById('sheet-recuperar-itens');
  if (el) el.innerHTML = htmlBotaoRecuperarItens();
  const btn = document.getElementById('btn-recuperar-itens');
  if (btn) btn.onclick = () => abrirModalRecuperacao();
}

export function renderSecaoInventario() {
  const inv = char.inventario || [];
  const _carga = getEstadoCarga();
  // Só sinaliza "Sobrecarregado" quando a regra de sobrecarga está ativa.
  const _mostrarSobrecarga = _carga.sobrecarregado && !!char?.config?.sobrecarga_afeta_deslocamento;
  const _corCarga = _mostrarSobrecarga ? 'var(--danger)' : 'var(--text-muted)';

  // Separar equipados, não equipados, zerados e os locais customizados
  const { equipados, naoEquipados, zerados, porLocal } = dividirInventario(inv, char.inventario_locais || []);

  return `
    <div class="card" id="secao-inventario">
      <div class="card-header">
        <h2>Inventario</h2>
        <div class="no-print" style="display:flex;gap:4px;align-items:center;flex-wrap:wrap;justify-content:flex-end">
          <span style="font-weight:700;color:var(--secondary);font-size:0.9rem;cursor:pointer" id="btn-edit-po" title="Editar Carteira">${htmlCarteira(char.moedas)}</span>
          <button class="btn btn-sm btn-accent" id="btn-add-inv">Loja</button>
          <button class="btn btn-sm btn-secondary" id="btn-add-inv-custom">+ Item Personalizado</button>
          <button class="btn btn-sm btn-secondary" id="btn-add-inv-local" title="Criar um local para guardar itens (ex.: Bolsa de Armazenamento)">Novo Espaço</button>
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
        <span id="sheet-sintonizados-valor">${htmlContadorSintonizados()}</span>
      </div>
      <div id="sheet-recuperar-itens" class="no-print">${htmlBotaoRecuperarItens()}</div>
      <div id="sheet-inventario">
        ${inv.length === 0
          ? '<div style="color:var(--text-muted);text-align:center;padding:12px;font-size:0.85rem">Inventario vazio</div>'
          : renderSheetInvLista(equipados, naoEquipados, zerados, porLocal)
        }
      </div>
    </div>
  `;
}

/**
 * Divide o inventário em seções: esgotados (quantidade 0), itens guardados em
 * cada local customizado, equipados e mochila. Devolve índices do array.
 * @param {Array<object>} inv `char.inventario`
 * @param {Array<object>} locais `char.inventario_locais`
 * @returns {{equipados: number[], naoEquipados: number[], zerados: number[], porLocal: Object<string, number[]>}}
 */
function dividirInventario(inv, locais) {
  const equipados = [];
  const naoEquipados = [];
  const zerados = [];
  const porLocal = {};
  inv.forEach((item, idx) => {
    if ((item.quantidade ?? 1) <= 0) { zerados.push(idx); return; }
    const local = localDoItem(item, locais);
    if (local) { (porLocal[local.id] ||= []).push(idx); return; }
    if (item.equipado) equipados.push(idx);
    else naoEquipados.push(idx);
  });
  return { equipados, naoEquipados, zerados, porLocal };
}

/** Renderiza a lista do inventário separada por seções */
function renderSheetInvLista(equipados, naoEquipados, zerados, porLocal = {}) {
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

  // Locais customizados (issue #80): uma seção por local, inclusive vazia.
  for (const local of (char.inventario_locais || [])) {
    const idxs = porLocal?.[local.id] || [];
    const chave = `local_${local.id}`;
    // Espaço criado nasce recolhido; a escolha do jogador é guardada por personagem (colapso.js).
    if (!(chave in _secoesInvColapsadas)) _secoesInvColapsadas[chave] = true;
    const colapsada = _secoesInvColapsadas[chave];
    html += `<div class="inv-secao-titulo${colapsada ? ' inv-secao-colapsada' : ''}" data-inv-secao="${escHtml(chave)}">
      <span>${escHtml(local.nome)} (${idxs.length})${local.conta_peso === false ? ' <small>— não conta no peso</small>' : ''}</span>
      <span class="no-print">
        <button type="button" class="btn btn-sm btn-icon" data-inv-local-editar="${escHtml(local.id)}" title="Editar local">&#9998;</button>
        <button type="button" class="btn btn-sm btn-icon" data-inv-local-remover="${escHtml(local.id)}" title="Remover local">&times;</button>
        <span class="inv-secao-chevron">&#9660;</span>
      </span>
    </div>`;
    html += `<div class="inv-secao-body${colapsada ? ' inv-secao-body-oculto' : ''}" data-inv-secao-body="${escHtml(chave)}">`;
    html += idxs.map(idx => renderSheetInvItem(char.inventario[idx], idx)).join('');
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
  // Item customizado com categoria de arma preenchida entra no MESMO
  // cálculo de proficiência/ataque/dano que uma arma de catálogo (issue
  // #82) -- o bloco abaixo já lê tudo de `item.dados`, então basta o
  // catálogo E o customizado caírem na mesma condição.
  const ehArmaCustom = item.tipo === 'customizado' && !!item.dados?.categoria;

  // Badge de proficiência
  let profBadge = '';
  if ((item.tipo === 'arma' || ehArmaCustom) && item.dados?.categoria) {
    profBadge = sheetBadgeProf(sheetTemProfArma({ categoria: item.dados.categoria, propriedades: item.dados.propriedades || '' }));
  }
  if ((item.tipo === 'armadura' || item.tipo === 'escudo') && item.dados?.categoria) {
    profBadge = sheetBadgeProf(sheetTemProfArmadura({ categoria: item.dados.categoria, nome: nomeBaseDoItem(item) }));
  }
  // Armadura personalizada com tipo (issue #134): mesma regra de proficiência da de catálogo.
  if (item.tipo === 'customizado' && item.dados?.tipo_item === 'Armadura' && item.dados?.tipo_armadura) {
    const ehEscudo = item.dados.tipo_armadura === 'Escudo';
    profBadge = sheetBadgeProf(sheetTemProfArmadura({ categoria: ehEscudo ? 'Escudo' : item.dados.tipo_armadura, nome: ehEscudo ? 'Escudo' : item.nome }));
  }

  // Badge de tipo de uso (consumível, equipamento, etc.)
  let tipoBadge = '';
  const tipoUso = item.dados?.tipo_uso || '';
  if (tipoUso === 'consumivel') {
    tipoBadge = '<span class="badge" style="font-size:0.6rem;background:#e8f5e9;color:#2e7d32;border:1px solid #a5d6a7">Consumível</span>';
  }
  // Pergaminho Mágico sem magia definida (issue #103).
  if (circuloDoItemPergaminho(item) !== null && !item.dados?.magias?.length) {
    tipoBadge += ' <span class="badge badge-secondary" style="font-size:0.6rem">Em branco</span>';
  }

  // Selos de origem: item replicado (Artífice) e item temporário (expira no descanso).
  if (item.origem?.tipo === 'replicado') {
    tipoBadge += ' <span class="badge badge-secondary" style="font-size:0.6rem">Replicado</span>';
  }
  if (item.origem?.expira) {
    tipoBadge += ' <span class="badge badge-secondary" style="font-size:0.6rem">Temporário</span>';
  }

  // Calcular bônus de ataque para armas
  let ataqueInfo = '';
  let danoAutoInfo = '';
  let vantagemInfo = '';
  let estiloLutaInfo = '';
  let danoExibicao = item.dados?.dano || '';
  if ((item.tipo === 'arma' || ehArmaCustom) && item.dados) {
    const calc = calcularAtaqueItem(item);
    const { usaForcaNoAtaque, isDistancia, props, passivos: _passivos } = calc;
    ataqueInfo = `<span class="badge badge-secondary" style="font-size:0.65rem">Atq ${fmtMod(calc.bonusAtq)}</span>${htmlSeloAtributoArma(calc)}`;
    // Vantagem/Desvantagem no ataque: fontes de talento/classe (Imprudente,
    // Caçador Preciso) combinadas com as fontes de CONDIÇÃO (issue #94,
    // Fase 6) -- mesmo padrão de anular V com D que calcVantagemDesvantagemPericia
    // já usa, para não mostrar "Vantagem" escondendo uma Desvantagem ativa.
    const fontesVantAtq = [];
    if (ataqueImprudenteAtivo() && usaForcaNoAtaque) fontesVantAtq.push('Imprudente');
    const estadoGuardiao = getEstadoRecursosGuardiao();
    if (estadoGuardiao?.cacadorPrecisoAtivo && estadoGuardiao?.marcaPredadorAtiva) fontesVantAtq.push('Caçador Preciso');
    const vdCondicoesAtq = calcVantagemDesvantagemAtaque();
    const temVantAtq = fontesVantAtq.length > 0;
    const temDesvAtq = vdCondicoesAtq.desvantagens.length > 0;
    if (temVantAtq && temDesvAtq) {
      vantagemInfo = `<span class="badge" style="font-size:0.6rem;background:var(--text-muted);color:#fff" title="Vantagem (${fontesVantAtq.join(', ')}) e Desvantagem (${vdCondicoesAtq.desvantagens.join(', ')}) se anulam">Vantagem e Desvantagem se anulam</span>`;
    } else if (temVantAtq) {
      vantagemInfo = `<span class="badge" style="font-size:0.6rem;background:#fff3cd;color:#8a6d3b;border:1px solid #ffeeba">Vantagem (${fontesVantAtq.join(', ')})</span>`;
    } else if (temDesvAtq) {
      vantagemInfo = `<span class="badge" style="font-size:0.6rem;background:#f8d7da;color:#842029;border:1px solid #f5c2c7">Desvantagem (${vdCondicoesAtq.desvantagens.join(', ')})</span>`;
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
    // Versátil, exatamente o que Talentos.md:764 exige), não a empunhadura
    // escolhida na seção Ataques (`dados.empunhadura`). O texto do selo
    // continua condicional ("se empunhada com as duas mãos").
    const ehArmaCorpoACorpoDuasMaosOuVersatil = !isDistancia && (props.includes('duas mãos') || props.includes('versátil'));
    if (_passivos.flags?.estilo_armas_grandes && ehArmaCorpoACorpoDuasMaosOuVersatil) {
      estiloLutaInfo += '<span class="badge" style="font-size:0.6rem;background:#ede7f6;color:#4527a0;border:1px solid #b39ddb" title="Combate com Armas Grandes: se estiver empunhando esta arma com as DUAS mãos, trata qualquer 1 ou 2 no dado de dano como um 3 (Talentos.md) -- em armas Versáteis vale quando a empunhadura de duas mãos está escolhida na seção Ataques">1-2→3</span>';
    }
    if (_passivos.flags?.estilo_duas_armas && props.includes('leve')) {
      estiloLutaInfo += '<span class="badge" style="font-size:0.6rem;background:#e0f2f1;color:#00695c;border:1px solid #80cbc4" title="Combate com Duas Armas: soma seu mod. de atributo ao dano do ataque adicional com esta arma, se ainda não estiver somando (Talentos.md)">+mod extra</span>';
    }

    if (calc.temDano) {
      danoExibicao = calc.danoExibicao;
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
    const caBaseItem = parseInt(item.dados?.ca_base) || 0;
    const batqMagia = parseInt(item.dados?.bonus_ataque_magia) || 0;
    const bcdMagia = parseInt(item.dados?.bonus_cd_magia) || 0;
    if (item.dados?.tipo_item) customBadges += `<span class="badge" style="font-size:0.6rem;background:#e3f2fd;color:#1565c0;border:1px solid #90caf9">${escHtml(item.dados.tipo_item)}</span> `;
    if (caBaseItem > 0) customBadges += `<span class="badge" style="font-size:0.6rem;background:#e8eaf6;color:#3949ab;border:1px solid #9fa8da">CA ${caBaseItem}</span> `;
    if (bca !== 0) customBadges += `<span class="badge" style="font-size:0.6rem;background:#e8eaf6;color:#3949ab;border:1px solid #9fa8da">CA ${bca > 0 ? '+' : ''}${bca}</span> `;
    // Arma customizada já mostra Atq/Dano calculado (ataqueInfo/danoAutoInfo,
    // com Força/Destreza e proficiência) -- repetir o bônus bruto aqui
    // duplicaria a informação numa segunda badge com número diferente.
    if (!ehArmaCustom) {
      if (batq !== 0) customBadges += `<span class="badge badge-secondary" style="font-size:0.65rem">Atq ${batq > 0 ? '+' : ''}${batq}</span> `;
      if (item.dados?.dano) customBadges += `<span class="badge" style="font-size:0.6rem;background:#fce4ec;color:#c62828;border:1px solid #ef9a9a">${item.dados.dano}</span> `;
    }
    if (batqMagia !== 0) customBadges += `<span class="badge badge-secondary" style="font-size:0.65rem">Atq Magia ${batqMagia > 0 ? '+' : ''}${batqMagia}</span> `;
    if (bcdMagia !== 0) customBadges += `<span class="badge badge-secondary" style="font-size:0.65rem">CD Magia ${bcdMagia > 0 ? '+' : ''}${bcdMagia}</span> `;
    if (item.dados?.raridade) {
      customBadges += `<span class="badge" style="font-size:0.6rem;background:#f3e5f5;color:#6a1b9a;border:1px solid #ce93d8">${escHtml(item.dados.raridade)}</span> `;
    }
    if (item.dados?.requer_sintonizacao) {
      customBadges += `<span class="badge" style="font-size:0.6rem;background:#e0f2f1;color:#00695c;border:1px solid #80cbc4">Sintonização</span> `;
    }
    if (item.dados?.preco) {
      customBadges += `<span class="badge badge-secondary" style="font-size:0.6rem">${escHtml(item.dados.preco)}</span> `;
    }
  }

  // Item mágico do acervo (tipo 'magico' ou arma/armadura/escudo com
  // magico_id): raridade, sintonização e os efeitos com o estado de cada um.
  let magicoBadges = '';
  if (item.dados?.magico_id) {
    if (item.dados.raridade) magicoBadges += `<span class="badge" style="font-size:0.6rem;background:#f3e5f5;color:#6a1b9a;border:1px solid #ce93d8">${escHtml(item.dados.raridade)}</span> `;
    if (item.dados.requer_sintonizacao) magicoBadges += `<span class="badge" style="font-size:0.6rem;background:#e0f2f1;color:#00695c;border:1px solid #80cbc4">Sintonização</span> `;
    for (const s of selosDeEfeitos(item, char, { visaoNoEscuroBase: visaoNoEscuroDaEspecie(char, especiesCache) })) {
      magicoBadges += `<span class="badge badge-secondary" data-selo-efeito="${s.ativo ? 'ativo' : 'inativo'}" title="${escHtml(s.motivo)}" style="font-size:0.6rem${s.ativo ? '' : ';opacity:0.5'}">${escHtml(s.texto)}</span> `;
    }
  }

  // Cargas e usos do item (4A): contador com − e +, chips de uso; apagado,
  // sem bloquear, quando o item exige sintonização e não está sintonizado.
  let recursosHtml = '';
  const _rec = recursosDoItem(item);
  if (_rec && !item.destruido) {
    const est = garantirEstadoRecursos(item);
    const semSint = item.dados?.requer_sintonizacao && item.sintonizado !== true;
    const opac = semSint ? ';opacity:0.5' : '';
    const dica = semSint ? ' title="requer sintonização para usar"' : '';
    if (_rec.cargas) {
      recursosHtml += `<span class="inv-cargas no-print"${dica} style="display:inline-flex;align-items:center;gap:3px${opac}">
        <button class="btn btn-sm btn-icon" data-cargas-menos="${idx}">−</button>
        <span data-cargas-valor="${idx}">⚡ ${est.cargas}/${_rec.cargas.max}</span>
        <button class="btn btn-sm btn-icon" data-cargas-mais="${idx}">+</button></span> `;
    }
    for (const u of _rec.usos || []) {
      const gastos = est.usos[u.nome] || 0;
      recursosHtml += `<span class="badge badge-secondary no-print" data-uso-item="${idx}" data-uso-nome="${escHtml(u.nome)}"${dica} style="cursor:pointer${opac}${gastos >= u.max ? ';text-decoration:line-through' : ''}">${escHtml(u.nome)} ${u.max - gastos}/${u.max}</span> `;
    }
  }

  // Badge de maestria com a arma. Issue #96: a arma customizada mostrava a
  // badge incondicionalmente (sem checar `char.maestrias_arma`) -- parecia
  // que a maestria estava valendo de verdade mesmo sem o personagem tê-la
  // escolhido. Corrigido junto da issue #82/#37 (`armasCustomizadasDoInventario`,
  // regras-equipamento.js): a arma customizada com categoria agora ENTRA de
  // verdade na lista de escolha do modal de maestria (sheet/maestrias.js),
  // então o mesmo gate de `char.maestrias_arma` que a arma de catálogo usa
  // volta a fazer sentido pra ela também -- catálogo e customizado usam
  // exatamente a mesma condição agora.
  let maestriaBadge = '';
  if ((item.tipo === 'arma' || ehArmaCustom) && item.dados?.maestria) {
    const temMaestria = (char.maestrias_arma || []).some(m => m === nomeBaseDoItem(item));
    if (temMaestria) {
      maestriaBadge = `<span class="badge" style="font-size:0.6rem;background:#fff8e1;color:#e65100;border:1px solid #ffcc80;font-weight:700">Maestria: ${item.dados.maestria}</span>`;
    }
  }

  const isZeroQtd = (item.quantidade ?? 1) <= 0;
  // Requisito de sintonização não atendido, calculado uma vez por linha.
  const requisitoFaltando = item.dados?.requer_sintonizacao && !item.destruido ? requisitoNaoAtendido(item) : '';

  // Mover para um local customizado (só aparece quando existe ao menos um).
  const locaisInv = char.inventario_locais || [];
  const seletorMover = locaisInv.length === 0 ? '' : `
        <select class="form-input no-print" data-mover-inv="${idx}" title="Mover para (mover para um local desequipa o item)" style="width:auto;padding:1px 2px;font-size:0.7rem">
          <option value="">Mochila</option>
          ${locaisInv.map(l => `<option value="${escHtml(l.id)}"${item.local === l.id ? ' selected' : ''}>${escHtml(l.nome)}</option>`).join('')}
        </select>`;

  return `
    <div class="inv-item ${item.equipado ? 'inv-item-equipado' : ''} ${isZeroQtd ? 'inv-item-zerado' : ''}${item.destruido ? ' inv-item-destruido' : ''}" data-idx="${idx}">
      <div class="inv-drag-handle no-print" title="Arrastar para reordenar">&#9776;</div>
      <div style="flex:1;min-width:0;cursor:pointer" data-info-inv-sheet="${idx}" title="Ver detalhes">
        <div class="inv-item-nome"${item.destruido ? ' style="text-decoration:line-through;opacity:0.6"' : ''}>
          ${escHtml(item.nome)} ${profBadge}${item.destruido ? ' <span class="badge">Destruído</span>' : ''}
        </div>
        ${(ataqueInfo || danoAutoInfo || vantagemInfo || estiloLutaInfo || maestriaBadge || tipoBadge || customBadges || magicoBadges || recursosHtml)
          ? `<div class="inv-item-badges" style="display:flex;flex-wrap:wrap;gap:3px;margin-top:2px">${ataqueInfo}${danoAutoInfo}${vantagemInfo}${estiloLutaInfo}${maestriaBadge}${tipoBadge}${customBadges}${magicoBadges}${recursosHtml}</div>`
          : ''
        }
        <div class="inv-item-detalhe">
          ${item.tipo === 'arma' ? `${danoExibicao} | ${item.dados?.propriedades || ''}` : ''}
          ${item.tipo === 'armadura' ? `CA: ${textoCADaArmadura(item)} | ${item.dados?.categoria || ''}` : ''}
          ${item.tipo === 'escudo' ? `CA: ${item.dados?.ca || ''} | Escudo` : ''}
          ${item.tipo === 'equipamento' ? `${item.dados?.custo || ''} ${item.dados?.peso ? '| ' + item.dados.peso : ''}` : ''}
          ${item.tipo === 'magico' ? escHtml(item.dados?.linha_tipo || '') : ''}
          ${ehArmaCustom ? `${danoExibicao} | ${item.dados?.propriedades || ''}` : (item.tipo === 'customizado' ? escHtml(item.descricao ? (item.descricao.length > 60 ? item.descricao.substring(0, 60) + '...' : item.descricao) : '') : '')}
          ${item.tipo === 'generico' ? escHtml(item.descricao || '') : ''}
        </div>
        ${descPreview}
      </div>
      <div class="inv-item-acoes no-print" style="align-items:center">
        ${item.destruido ? `<button class="btn btn-sm" data-restaurar-item="${idx}">Restaurar</button>` : ''}
        ${item.dados?.requer_sintonizacao && !item.destruido ? `
          <label class="inv-sintonia" title="${podeSintonizar(char, idx) ? 'Sintonizar com este item' : `Limite de ${tetoSintonizacao(char)} itens sintonizados atingido`}"
                 style="display:flex;align-items:center;gap:3px;font-size:0.65rem;${podeSintonizar(char, idx) ? '' : 'opacity:0.45;cursor:not-allowed'}">
            <input type="checkbox" data-sintonizar="${idx}" ${item.sintonizado ? 'checked' : ''} ${podeSintonizar(char, idx) ? '' : 'disabled'}>
            Sint.
          </label>` : ''}
        ${requisitoFaltando
          ? `<span class="inv-sintonia-requisito" title="${escHtml('Requer sintonização ' + requisitoFaltando)}" style="font-size:0.6rem;color:var(--danger)">requer: ${escHtml(requisitoFaltando)}</span>`
          : ''}
        ${item.origem?.tipo === 'replicado' ? '' : `        <div class="inv-qty-control" style="display:flex;align-items:center;gap:2px">
          <button class="btn btn-sm btn-icon" data-qty-minus="${idx}" style="font-size:0.7rem;padding:1px 5px">−</button>
          <span style="min-width:20px;text-align:center;font-size:0.8rem;font-weight:700" data-qty-display="${idx}">${item.quantidade ?? 1}</span>
          <button class="btn btn-sm btn-icon" data-qty-plus="${idx}" style="font-size:0.7rem;padding:1px 5px">+</button>
        </div>`}
        ${seletorMover}
        ${item.destruido ? '' : `<label class="form-check inv-equip-label" title="Equipar/Desequipar">
          <input type="checkbox" data-sheet-equip="${idx}" ${item.equipado ? 'checked' : ''}> Eq.
        </label>`}
        <button class="btn btn-sm btn-danger btn-icon" data-sheet-rem-inv="${idx}">&times;</button>
      </div>
    </div>
  `;
}

/** Abre o modal de criar (sem `local`) ou editar um local customizado do inventário. */
function abrirModalLocalInventario(local = null) {
  abrirModal(local ? 'Editar Local' : 'Novo Local', `
    <div class="form-group">
      <label class="form-label" for="il-nome">Nome</label>
      <input type="text" class="form-input" id="il-nome" value="${escHtml(local?.nome || '')}" placeholder="Ex.: Bolsa de Armazenamento">
    </div>
    <label class="form-check" style="display:flex;align-items:center;gap:6px;cursor:pointer">
      <input type="checkbox" id="il-conta-peso"${!local || local.conta_peso !== false ? ' checked' : ''}>
      Os itens deste local contam no peso carregado
    </label>
    <div id="il-erro" style="display:none;color:var(--danger);font-size:0.8rem;margin-top:8px"></div>
  `, '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-primary" id="btn-salvar-inv-local">Salvar</button>');

  document.getElementById('btn-salvar-inv-local')?.addEventListener('click', () => {
    const nome = (document.getElementById('il-nome')?.value || '').trim();
    if (!nome) {
      const erro = document.getElementById('il-erro');
      if (erro) { erro.style.display = 'block'; erro.textContent = 'Informe um nome para o local.'; }
      return;
    }
    const contaPeso = !!document.getElementById('il-conta-peso')?.checked;
    if (!Array.isArray(char.inventario_locais)) char.inventario_locais = [];
    if (local) {
      local.nome = nome;
      local.conta_peso = contaPeso;
    } else {
      char.inventario_locais.push({ id: gerarId(), nome, conta_peso: contaPeso });
    }
    salvar();
    window.fecharModal();
    renderFichaCompleta();
  });
}

/**
 * Liga os controles dos locais customizados: botão "+ Local", editar,
 * remover (os itens voltam à Mochila) e o seletor "mover para" de cada item.
 */
function ligarEventosLocaisInventario() {
  const btnNovo = document.getElementById('btn-add-inv-local');
  if (btnNovo) btnNovo.onclick = () => abrirModalLocalInventario();

  document.querySelectorAll('[data-inv-local-editar]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const local = (char.inventario_locais || []).find(l => l.id === btn.dataset.invLocalEditar);
      if (local) abrirModalLocalInventario(local);
    });
  });

  document.querySelectorAll('[data-inv-local-remover]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.invLocalRemover;
      const local = (char.inventario_locais || []).find(l => l.id === id);
      if (!local) return;
      abrirModal('Remover Local',
        `<p>Remover o local <strong>${escHtml(local.nome)}</strong>?</p><p style="font-size:0.85rem;color:var(--text-muted)">Os itens guardados nele voltam para a Mochila.</p>`,
        '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-danger" id="btn-confirmar-remover-local">Remover</button>');
      document.getElementById('btn-confirmar-remover-local')?.addEventListener('click', () => {
        char.inventario_locais = (char.inventario_locais || []).filter(l => l.id !== id);
        (char.inventario || []).forEach(item => { if (item.local === id) delete item.local; });
        salvar();
        window.fecharModal();
        renderFichaCompleta();
      });
    });
  });

  document.querySelectorAll('[data-mover-inv]').forEach(sel => {
    sel.addEventListener('change', () => {
      const item = char.inventario[parseInt(sel.dataset.moverInv)];
      if (!item) return;
      if (sel.value) {
        item.local = sel.value;
        // Item guardado não fica equipado nem sintonizado.
        item.equipado = false;
        item.sintonizado = false;
      } else {
        delete item.local;
      }
      salvar();
      renderFichaCompleta();
    });
  });
}

/**
 * Uso de item que recupera espaço de magia (Pérola do Poder): valida o item e
 * os espaços gastos e abre o modal para escolher qual restaurar. Sem item ativo
 * ou sem espaço gasto elegível, só avisa e não grava nada; o uso só é gasto
 * quando a opção é escolhida e o espaço restaurado. Cancelar não grava.
 */
function usarItemQueRecuperaEspaco(item, uso) {
  if (!itemAtivo(item)) {
    toast(`Equipe e sintonize ${item.nome} para usar`, 'error');
    return;
  }
  const opcoes = espacosRecuperaveis(reservasDeEspacos(), uso.circulo_max);
  if (!opcoes.length) {
    toast(mensagemSemEspaco(uso.circulo_max), 'error');
    return;
  }
  const botoes = opcoes.map(o => `<button class="btn btn-secondary btn-espaco-opcao" data-espaco-fonte="${escHtml(o.fonte)}" data-espaco-circulo="${o.circulo}" style="display:block;width:100%;margin-bottom:6px;text-align:left">${escHtml(o.rotulo)}</button>`).join('');
  abrirModal('Recuperar espaço de magia',
    `<p>Escolha o espaço de magia gasto que <strong>${escHtml(item.nome)}</strong> vai restaurar.</p>${botoes}`,
    '<button class="btn btn-secondary" id="btn-espaco-cancelar">Cancelar</button>');
  document.getElementById('btn-espaco-cancelar')?.addEventListener('click', () => window.fecharModal());
  document.querySelectorAll('.btn-espaco-opcao').forEach(btn => btn.addEventListener('click', () => {
    // Desabilita todas as opções no primeiro clique: clique duplo não restaura nem gasta duas vezes.
    const opcoesDoModal = document.querySelectorAll('.btn-espaco-opcao');
    if (btn.disabled) return;
    opcoesDoModal.forEach(b => { b.disabled = true; });
    const resultado = restaurarEspacoPorItem(char, item, uso.nome,
      { fonte: btn.dataset.espacoFonte, circulo: Number(btn.dataset.espacoCirculo) },
      { reservas: reservasDeEspacos(), recuperar: recuperarUmEspaco });
    window.fecharModal();
    if (!resultado.ok) {
      toast(resultado.erro, 'error');
      return;
    }
    salvar();
    renderFichaCompleta();
    toast(`Espaço de ${resultado.circulo}º círculo recuperado`);
  }));
}

/**
 * Liga os controles de cargas e usos dos itens: − e + do contador (com a
 * pergunta da última carga), chips de uso, restaurar item destruído, botão do
 * amanhecer e o preenchimento único de recursos em itens mágicos antigos.
 */
function ligarEventosRecursosInventario() {
  // − gasta (e pergunta a regra da última carga na passagem de 1 para 0); + devolve uma.
  document.querySelectorAll('[data-cargas-menos]').forEach(btn => btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const item = char.inventario[parseInt(btn.dataset.cargasMenos)];
    if (!item) return;
    const { ultimaCarga } = gastarCarga(item);
    salvar();
    renderFichaCompleta();
    perguntarUltimaCarga(item, ultimaCarga);
  }));
  document.querySelectorAll('[data-cargas-mais]').forEach(btn => btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const item = char.inventario[parseInt(btn.dataset.cargasMais)];
    if (!item) return;
    ajustarCarga(item, +1);
    salvar();
    renderFichaCompleta();
  }));
  // Usos: o chip alterna gasto/disponível; uso com efeito de recuperar espaço de magia, ao ser gasto, pergunta qual espaço restaurar.
  document.querySelectorAll('[data-uso-item]').forEach(chip => chip.addEventListener('click', (e) => {
    e.stopPropagation();
    const item = char.inventario[parseInt(chip.dataset.usoItem)];
    if (!item) return;
    const uso = (recursosDoItem(item)?.usos || []).find(u => u.nome === chip.dataset.usoNome);
    const estado = garantirEstadoRecursos(item);
    if (uso?.efeito === EFEITO_RECUPERAR_ESPACO && (estado?.usos?.[uso.nome] || 0) < uso.max) {
      usarItemQueRecuperaEspaco(item, uso);
      return;
    }
    alternarUso(item, chip.dataset.usoNome);
    salvar();
    renderFichaCompleta();
  }));
  // Restaurar item destruído por clique errado.
  document.querySelectorAll('[data-restaurar-item]').forEach(btn => btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const item = char.inventario[parseInt(btn.dataset.restaurarItem)];
    if (!item) return;
    restaurarItem(item);
    salvar();
    renderFichaCompleta();
  }));
  atualizarBotaoRecuperarItens();

  // Itens mágicos adicionados antes da 4A: recursos do acervo, uma vez.
  if ((char.inventario || []).some(i => i?.dados?.magico_id && (!('recursos' in i.dados) || !('magias' in i.dados) || !(i.dados.passivos_versao >= PASSIVOS_VERSAO) || !('requisito_sintonizacao' in i.dados) || !('aumento_permanente' in i.dados)))) {
    getItensMagicos().then(acervo => {
      if (acervo && preencherRecursosDoAcervo(char, acervo) > 0) {
        salvar();
        renderFichaCompleta();
      }
    }).catch(() => {});
  }
}

/**
 * Valores do formulário de contador manual a partir de `dados.recursos`
 * existente (edição); null quando o item não tem contador.
 */
function valoresDoContador(item) {
  const rec = recursosDoItem(item);
  if (!rec) return null;
  if (rec.cargas) {
    const r = rec.cargas.recupera;
    return { tipo: 'cargas', nome: '', max: rec.cargas.max, recupera: r === 'todas' ? 'todas' : (typeof r === 'string' ? 'amanhecer' : 'nenhum'), dado: typeof r === 'string' && r !== 'todas' ? r : '' };
  }
  const uso = rec.usos?.[0];
  if (!uso) return null;
  return { tipo: 'uso', nome: uso.nome, max: uso.max, recupera: uso.recupera, dado: '' };
}

/**
 * Troca o corpo do modal de detalhe pelo formulário de contador manual
 * (cargas ou uso) e grava `item.dados.recursos` ao salvar. Com contador já
 * existente, o formulário abre preenchido e preserva o gasto até o novo máximo.
 */
function abrirFormularioContadorManual(item) {
  const inicial = valoresDoContador(item);
  const corpoEl = document.getElementById('modal-corpo');
  const acoesEl = document.getElementById('modal-acoes');
  if (!corpoEl || !acoesEl) return;
  corpoEl.innerHTML = `
    <div class="form-group"><label class="form-label" for="contador-tipo">Tipo</label>
      <select class="form-input" id="contador-tipo"><option value="cargas">Cargas</option><option value="uso">Uso</option></select></div>
    <div class="form-group" id="contador-nome-grupo" style="display:none"><label class="form-label" for="contador-nome">Nome do uso</label>
      <input type="text" class="form-input" id="contador-nome" maxlength="60"></div>
    <div class="form-group"><label class="form-label" for="contador-max">Máximo</label>
      <input type="number" class="form-input" id="contador-max" min="1" step="1" value="1"></div>
    <div class="form-group"><label class="form-label" for="contador-recupera">Recuperação</label>
      <select class="form-input" id="contador-recupera"></select></div>
    <div class="form-group" id="contador-dado-grupo"><label class="form-label" for="contador-dado">Dado da recuperação (opcional, ex.: 1d6+1)</label>
      <input type="text" class="form-input" id="contador-dado" maxlength="12"></div>`;
  acoesEl.innerHTML = '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-primary" id="btn-salvar-contador">Salvar</button>';
  const tipoEl = document.getElementById('contador-tipo');
  // Opções de recuperação válidas para o tipo escolhido (cargas ou uso).
  const OPCOES = {
    cargas: [['amanhecer', 'Ao Descanso Longo, com dado'], ['todas', 'Todas no Descanso Longo'], ['nenhum', 'Não recupera']],
    uso: [['amanhecer', 'Ao amanhecer'], ['descanso_longo', 'No Descanso Longo'], ['descanso_curto', 'No Descanso Curto']],
  };
  const aplicarTipo = () => {
    const ehUso = tipoEl.value === 'uso';
    document.getElementById('contador-nome-grupo').style.display = ehUso ? '' : 'none';
    document.getElementById('contador-dado-grupo').style.display = ehUso ? 'none' : '';
    document.getElementById('contador-recupera').innerHTML = OPCOES[tipoEl.value].map(([v, t]) => `<option value="${v}">${t}</option>`).join('');
  };
  tipoEl.addEventListener('change', aplicarTipo);
  if (inicial) {
    tipoEl.value = inicial.tipo;
    aplicarTipo();
    document.getElementById('contador-nome').value = inicial.nome;
    document.getElementById('contador-max').value = inicial.max;
    document.getElementById('contador-recupera').value = inicial.recupera;
    document.getElementById('contador-dado').value = inicial.dado;
  } else {
    aplicarTipo();
  }
  document.getElementById('btn-salvar-contador').addEventListener('click', () => {
    const r = recursosDoFormulario({
      tipo: tipoEl.value,
      nome: document.getElementById('contador-nome').value,
      max: document.getElementById('contador-max').value,
      recupera: document.getElementById('contador-recupera').value,
      dado: document.getElementById('contador-dado').value,
    });
    if (!r.ok) { toast(r.erro, 'error'); return; }
    aplicarContadorManual(item, r.recursos, !!inicial);
    salvar();
    window.fecharModal();
    renderFichaCompleta();
  });
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

  ligarEventosLocaisInventario();
  ligarEventosRecursosInventario();

  // Equipar/desequipar — re-renderiza a ficha completa para atualizar CA e stats
  document.querySelectorAll('[data-sheet-equip]').forEach(cb => {
    cb.addEventListener('change', () => {
      const idx = parseInt(cb.dataset.sheetEquip);
      if (char.inventario[idx]) {
        const item = char.inventario[idx];
        // Limite de mãos: arma versátil em duas mãos volta para uma mão quando isso faz o item caber;
        // sem mãos livres mesmo assim, desfaz a marcação e avisa sem alterar nada.
        let ajustadas = [];
        if (cb.checked) {
          const v = equiparComAjusteDeMaos(char, item);
          if (!v.ok) {
            cb.checked = false;
            toast(v.motivo, 'error');
            return;
          }
          ajustadas = v.ajustados;
        }
        item.equipado = cb.checked;
        // Item equipado não fica guardado num local (issue #80) e vai para o início da lista.
        if (cb.checked) {
          delete item.local;
          moverParaInicio(char.inventario, item);
        }

        if (char.classe === 'Bárbaro' && temArmaduraPesadaEquipada()) {
          if (!char.recursos) char.recursos = {};
          char.recursos.furia_ativa = false;
        }

        salvar();
        // Re-renderizar ficha inteira para recalcular CA e outros stats
        renderFichaCompleta();
        if (ajustadas.length) toast(`${ajustadas.join(', ')} passou a ser empunhada com uma mão.`);
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
        <p>Deseja realmente remover <strong>${escHtml(item.nome)}</strong>${item.quantidade > 1 ? ` (x${item.quantidade})` : ''} do inventário?</p>
      `, `
        <button class="btn btn-danger" id="btn-confirmar-rem-inv-sheet">Remover</button>
        <button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>
      `);
      document.getElementById('btn-confirmar-rem-inv-sheet')?.addEventListener('click', () => {
        // Item com magias ou equipado altera blocos fora de #sheet-inventario
        // (Magias de Itens, CA e demais stats): exige a ficha inteira.
        const afetaFora = !!item.equipado || !!item.dados?.magias?.length;
        char.inventario.splice(idx, 1);
        salvar();
        fecharModal();
        if (afetaFora) renderFichaCompleta();
        else reRenderSheetInv();
      });
    });
  });

  // Quantidade +/-
  document.querySelectorAll('[data-qty-plus]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.qtyPlus);
      // Item replicado vale por um item no limite do Artífice: não duplica.
      if (char.inventario[idx] && char.inventario[idx].origem?.tipo !== 'replicado') {
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

  // Sintonizacao: o teto de tres mora em regras-sintonizacao.js, e o render
  // seguinte e quem acinzenta as caixas que sobraram -- por isso o
  // renderFichaCompleta() aqui, e nao so o `salvar()`.
  document.querySelectorAll('[data-sintonizar]').forEach((caixa) => {
    caixa.addEventListener('change', () => {
      const idx = parseInt(caixa.dataset.sintonizar);
      const item = char.inventario[idx];
      if (!item) return;
      if (!item.sintonizado && !podeSintonizar(char, idx)) {
        caixa.checked = false;
        toast(`Você já está sintonizado com ${tetoSintonizacao(char)} itens.`, 'error');
        return;
      }
      // Ao marcar: requisito de classe/espécie não atendido pede confirmação.
      if (caixa.checked) {
        const faltando = requisitoNaoAtendido(item);
        if (faltando) {
          caixa.checked = false;
          abrirModal('Requisito de sintonização',
            `<p>Este item requer sintonização ${escHtml(faltando)}.</p>`,
            '<button class="btn btn-secondary" id="btn-sintonizar-cancelar">Cancelar</button><button class="btn btn-primary" id="btn-sintonizar-mesmo-assim">Sintonizar mesmo assim</button>');
          document.getElementById('btn-sintonizar-cancelar')?.addEventListener('click', () => window.fecharModal());
          document.getElementById('btn-sintonizar-mesmo-assim')?.addEventListener('click', () => {
            item.sintonizado = true;
            window.fecharModal();
            salvar();
            renderFichaCompleta();
          });
          return;
        }
      }
      item.sintonizado = caixa.checked;
      salvar();
      renderFichaCompleta();
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
  if (btnAddInv) btnAddInv.onclick = () => abrirSeletorItens({
    personagem: char,
    permitirMagicos: true,
    htmlDetalhe: (itemSintetico, propsDescs) => htmlDetalheItem(itemSintetico, propsDescs, { somenteLeitura: true }),
    lerComprarAtivo: carregarComprarAtivoPadrao,
    salvarComprarAtivo: salvarComprarAtivoPadrao,
    aoAdicionar: () => { salvar(); renderFichaCompleta(); },
  });

  // Item customizado
  const btnAddCustom = document.getElementById('btn-add-inv-custom');
  if (btnAddCustom) btnAddCustom.onclick = async () => {
    // O glossário do livro alimenta a descrição dos cards de propriedade e maestria.
    const glossario = (await carregarDadosEquipSheet()).propriedadesArmas || [];
    // Bloco "Pagar" (rótulo distinto do campo informativo "Preço" do formulário): debita a carteira, não é gravado no item.
    abrirModal('Item Customizado', htmlFormularioItemCustomizado(null),
      `${htmlCampoPrecoInformado('pagar-item-custom', 'Pagar')}<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-primary" id="btn-add-ic">Adicionar</button>`);
    ligarEventosFormularioItemCustomizado(glossario);

    // Impede que um segundo clique, já aceito o primeiro, adicione e cobre de novo.
    let adicionado = false;
    document.getElementById('btn-add-ic')?.addEventListener('click', () => {
      if (adicionado) return;
      const { ok, valores } = lerFormularioItemCustomizado();
      if (!ok) return;
      const pagamento = cobrarPrecoInformado('pagar-item-custom', char, valores.nome);
      if (!pagamento.ok) return;
      adicionado = true;
      inserirNoInicio(char.inventario, {
        tipo: 'customizado',
        quantidade: 1,
        equipado: false,
        ...valores,
      });
      salvar();
      window.fecharModal();
      renderFichaCompleta();
      toast(`${valores.nome} adicionado${pagamento.sufixo}!`, 'success');
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
      // Conversao para baixo: nao existe para PC (a menor); fica invisivel sem moeda na pilha.
      const baixo = proximaDenominacaoMenor(tipo);
      const podeConverterBaixo = baixo && (char.moedas[tipo] || 0) > 0;
      // Cada denominacao ocupa duas linhas para caber em celular sem cortar o nome:
      // 1) nome com o saldo logo ao lado e, a direita, os botoes de conversao (so os aplicaveis); 2) campo, "+" e "-" em colunas fixas.
      const estiloConv = 'height:32px;min-width:0;padding:0 8px;font-size:0.8rem';
      const botaoCima = podeConverter
        ? `<button class="btn btn-secondary btn-sm" data-moeda-conv="${tipo}" style="${estiloConv}" title="${tituloConv}">${labelConv}</button>` : '';
      const botaoBaixo = podeConverterBaixo
        ? `<button class="btn btn-secondary btn-sm" data-moeda-conv-baixo="${tipo}" style="${estiloConv}" title="Converter todas as ${tipo.toUpperCase()} (${char.moedas[tipo] || 0}) em ${(char.moedas[tipo] || 0) * baixo.taxa} ${baixo.tipoDestino.toUpperCase()}">↓ ${baixo.tipoDestino.toUpperCase()}</button>` : '';
      return `
        <div style="margin-bottom:10px">
          <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:4px">
            <span style="font-size:0.85rem" title="${NOMES_MOEDA[tipo]} (${tipo.toUpperCase()})">${ICONE_MOEDA[tipo]} ${NOMES_MOEDA[tipo]}:</span>
            <span style="font-weight:700;font-size:1rem" title="Saldo de ${NOMES_MOEDA[tipo]}">${char.moedas[tipo] || 0}</span>
            <span style="flex:1 1 0"></span>
            ${botaoCima}${botaoBaixo}
          </div>
          <div style="display:grid;grid-template-columns:minmax(60px,1fr) 44px 44px;gap:6px;align-items:center">
            <input type="number" class="form-input" id="edit-moeda-${tipo}" min="0" placeholder="0" style="width:100%;min-width:0;box-sizing:border-box">
            <button class="btn btn-success btn-sm" data-moeda-add="${tipo}" style="height:36px;min-width:0;padding:0">+</button>
            <button class="btn btn-danger btn-sm" data-moeda-sub="${tipo}" style="height:36px;min-width:0;padding:0">-</button>
          </div>
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
        <div style="font-size:1.1rem;font-weight:700">${htmlCarteira(char.moedas)}</div>
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

      document.querySelectorAll('[data-moeda-conv-baixo]').forEach(btn => {
        btn.addEventListener('click', () => {
          const resultado = converterParaMenor(char.moedas, btn.dataset.moedaConvBaixo);
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
async function abrirModalEditarItemCustomizado(item, idx) {
  // O glossário do livro alimenta a descrição dos cards de propriedade e maestria.
  const glossario = (await carregarDadosEquipSheet()).propriedadesArmas || [];
  abrirModal('Editar Item Customizado', htmlFormularioItemCustomizado(item),
    '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-primary" id="btn-salvar-ic">Salvar</button>');
  ligarEventosFormularioItemCustomizado(glossario);

  document.getElementById('btn-salvar-ic')?.addEventListener('click', () => {
    const { ok, valores } = lerFormularioItemCustomizado();
    if (!ok) return;
    const alvo = char.inventario[idx];
    alvo.nome = valores.nome;
    alvo.descricao = valores.descricao;
    // Merge, nao substituicao: `dados` pode carregar chaves que o
    // formulario nao edita, e trocar o objeto inteiro as perderia.
    alvo.dados = mesclarDadosItemCustomizado(alvo.dados, valores.dados);
    // Desmarcar "Requer Sintonizacao" nesta edicao libera a vaga: sem isto
    // `sintonizado: true` ficava gravado sem caixa na tela para desmarcar,
    // e o item prendia o teto para sempre (issue #57). Grava `false` em vez
    // de apagar a chave -- o item FOI tocado agora, entao o valor deixa de
    // ser o "nunca tocado" que a Global Constraint protege.
    if (!alvo.dados.requer_sintonizacao && alvo.sintonizado) {
      alvo.sintonizado = false;
    }
    salvar();
    window.fecharModal();
    renderFichaCompleta();
    toast(`${valores.nome} atualizado!`, 'success');
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
  const { equipados, naoEquipados, zerados, porLocal } = dividirInventario(inv, char.inventario_locais || []);

  invEl.innerHTML = inv.length === 0
    ? '<div style="color:var(--text-muted);text-align:center;padding:12px;font-size:0.85rem">Inventario vazio</div>'
    : renderSheetInvLista(equipados, naoEquipados, zerados, porLocal);

  // Atualizar barra de peso atual (fica fora de #sheet-inventario)
  const pesoEl = document.getElementById('sheet-peso-valor');
  if (pesoEl) {
    const _carga = getEstadoCarga();
    const _mostrarSobrecarga = _carga.sobrecarregado && !!char?.config?.sobrecarga_afeta_deslocamento;
    pesoEl.style.color = _mostrarSobrecarga ? 'var(--danger)' : 'var(--text-muted)';
    pesoEl.innerHTML = `Peso: <strong>${fmtPeso(_carga.pesoAtual)}</strong> / ${fmtPeso(_carga.capacidade)} kg`
      + (_mostrarSobrecarga ? ' <span style="font-weight:700;margin-left:4px">&#9888; Sobrecarregado</span>' : '');
  }

  // Atualizar o contador "Sintonizados: X / 3" (mesmo motivo do peso: fica
  // fora de #sheet-inventario e ficava velho ate outra acao forcar um
  // renderFichaCompleta).
  const sintonizadosEl = document.getElementById('sheet-sintonizados-valor');
  if (sintonizadosEl) sintonizadosEl.innerHTML = htmlContadorSintonizados();

  // Re-bind eventos (também atualiza o botão do amanhecer)
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

// Reexportado de itens-seletor.js: sheet/maestrias.js (linhas 14, 42 e 172)
// importa `carregarDadosEquipSheet` DESTE modulo, e nao deve mudar junto com
// a extracao do seletor. Importado (nao so reexportado) porque
// mostrarDetalheItemSheet, abaixo, tambem chama a funcao localmente.
export { carregarDadosEquipSheet };

/**
 * Resumo das informações de um item personalizado no detalhe (issue #134):
 * tipo de armadura, CA base, requisito de Força, Furtividade, custo e peso.
 * Só mostra as linhas que têm valor; item antigo sem os campos novos devolve
 * só o que existe (ou ''). Texto livre vai por escHtml.
 * @param {object} d `item.dados`
 * @returns {string}
 */
export function htmlResumoItemCustomizado(d = {}) {
  const linhas = [];
  const linha = (rotulo, valor) => { if (valor) linhas.push(`<strong>${rotulo}:</strong> ${escHtml(String(valor))}`); };
  if (d.tipo_item === 'Armadura') linha('Tipo de armadura', d.tipo_armadura);
  if (String(d.ca_base ?? '') !== '') linha('CA base', d.ca_base);
  if (d.tipo_item === 'Armadura' && d.atributo) {
    const nomes = { forca: 'Força', destreza: 'Destreza', constituicao: 'Constituição', inteligencia: 'Inteligência', sabedoria: 'Sabedoria', carisma: 'Carisma' };
    const lim = String(d.limite_atributo ?? '') !== '' ? ` (máx. ${d.limite_atributo})` : '';
    linha('Soma na CA', `${nomes[d.atributo] || d.atributo}${lim}`);
  }
  linha('Requisito de Força', d.requisito_forca);
  linha('Furtividade', d.furtividade);
  linha('Custo', d.preco);
  linha('Peso', d.peso);
  return linhas.length ? `<div style="font-size:0.85rem;margin-bottom:6px">${linhas.join('<br>')}</div>` : '';
}

/**
 * HTML das seções "Propriedades" (uma por `<details>`, com descrição do
 * glossário) e "Maestria: X" (com descrição) do modal de detalhe de uma
 * arma -- extraído pra ser reusado pela arma customizada com categoria
 * (issue #82) também, issue #96: antes só a arma de CATÁLOGO ganhava essas
 * descrições formatadas; a customizada mostrava só o nome cru da
 * propriedade/maestria, sem explicação nenhuma.
 * @param {{propriedades?: string, maestria?: string}} d `item.dados`
 * @param {Array<{nome: string, descricao: string}>} propsDescs Glossário (dados.propriedadesArmas)
 * @returns {string}
 */
function htmlPropriedadesEMaestria(d, propsDescs) {
  let html = '';
  const propsNomes = (d.propriedades || '').split(',').filter(p => p.trim()).map(p => p.trim().replace(/\s*\(.*\)/, ''));
  const propsComDesc = propsNomes
    .map(nome => {
      // Issue #104: a descrição da propriedade personalizada vem do item.
      const propria = descricaoDePropriedade(nome, d.propriedades_personalizadas, []);
      if (propria) return { nome, descricao: propria };
      const prop = propsDescs.find(p => semAcento(p.nome).toLowerCase() === semAcento(nome).toLowerCase());
      return prop ? { nome: prop.nome, descricao: prop.descricao } : null;
    })
    .filter(Boolean);

  if (propsComDesc.length > 0) {
    html += `<div class="section-divider mt-1"><span>Propriedades</span></div>`;
    html += propsComDesc.map(p => `
      <details style="margin-bottom:4px">
        <summary style="font-weight:600;cursor:pointer;font-size:0.85rem">${escHtml(p.nome)}</summary>
        <div class="md-content" style="padding:4px 0;font-size:0.8rem">${mdParaHtml(p.descricao)}</div>
      </details>
    `).join('');
  }

  if (d.maestria) {
    const maestriaDesc = propsDescs.find(p => semAcento(p.nome).toLowerCase() === semAcento(d.maestria).toLowerCase());
    if (maestriaDesc) {
      html += `<div class="section-divider mt-1"><span>Maestria: ${d.maestria}</span></div>`;
      html += `<div class="md-content" style="font-size:0.8rem">${mdParaHtml(maestriaDesc.descricao)}</div>`;
    }
  }
  return html;
}

const NOMES_ATRIBUTO_AUMENTO = { forca: 'Força', destreza: 'Destreza', constituicao: 'Constituição', inteligencia: 'Inteligência', sabedoria: 'Sabedoria', carisma: 'Carisma' };

/** Texto do aumento permanente do item, ex.: "Força +2, até 30" (com redução: "e outro −2, até o mínimo de 3"). */
function textoAumentoPermanente(aum) {
  const alvo = aum.atributo === 'escolha' ? 'Um atributo à sua escolha' : (NOMES_ATRIBUTO_AUMENTO[aum.atributo] || aum.atributo);
  const red = aum.reducao ? ` e outro −${aum.reducao.valor}, até o mínimo de ${aum.reducao.minimo}` : '';
  return `${alvo} +${aum.valor}, até ${aum.maximo}${red}`;
}

/** HTML das opções dos seis atributos para os seletores do aumento permanente. */
function opcoesAtributosAumento() {
  return '<option value="">— escolher —</option>' + Object.entries(NOMES_ATRIBUTO_AUMENTO)
    .map(([chave, nome]) => `<option value="${chave}">${nome}</option>`).join('');
}

/**
 * HTML do bloco "Aumento permanente" do detalhe do item: botão enquanto o
 * aumento está pendente, "Aumento aplicado." depois de aplicado; vazio para
 * item sem aumento.
 */
function htmlAumentoPermanente(item) {
  if (!item?.dados?.aumento_permanente) return '';
  if (item.aumento_aplicado) return '<div class="section-divider mt-1"><span>Aumento permanente</span></div><div style="font-size:0.85rem">Aumento aplicado.</div>';
  const aum = aumentoPermanenteDoItem(item);
  if (!aum) return '';
  // Item que exige sintonização só pode ser estudado sintonizado.
  const semSintonia = !!item.dados?.requer_sintonizacao && item.sintonizado !== true;
  return `<div id="bloco-aumento-permanente" class="no-print" style="margin-top:10px"><div class="section-divider mt-1"><span>Aumento permanente</span></div>
    <div style="font-size:0.85rem;margin-bottom:6px">${escHtml(textoAumentoPermanente(aum))}</div>
    ${semSintonia ? '<div id="dica-aumento-sintonia" style="font-size:0.8rem;color:var(--text-muted);margin-bottom:6px">Sintonize o item para estudar.</div>' : ''}
    <button class="btn btn-sm btn-accent" id="btn-aplicar-aumento-permanente"${semSintonia ? ' disabled' : ''}>Aplicar aumento</button></div>`;
}

/**
 * Liga o botão do aumento permanente no modal de detalhe. Sem escolha, o
 * clique aplica direto; com escolha, troca o bloco pelos seletores e aplica
 * ao confirmar. Em caso de sucesso sincroniza o PV, salva, avisa, fecha o
 * modal e refaz a ficha; em erro avisa e não grava.
 */
function ligarAumentoPermanente(item) {
  const btn = document.getElementById('btn-aplicar-aumento-permanente');
  const aum = aumentoPermanenteDoItem(item);
  if (!btn || !aum) return;
  const aplicar = (opcoes, botao) => {
    botao.disabled = true;
    const r = aplicarAumentoPermanente(char, item, opcoes);
    if (!r.ok) {
      toast(r.erro, 'error');
      botao.disabled = false;
      return;
    }
    sincronizarBonusPvNiveis();
    salvar();
    // atributo-base: o aviso informa o valor-base gravado pelo aumento permanente
    const partes = [`${NOMES_ATRIBUTO_AUMENTO[r.aumento.atributo]} aumentou para ${char.atributos[r.aumento.atributo]}`];
    // atributo-base: idem, valor-base após a redução
    if (r.reducao) {
      partes.push(r.reducao.aplicado === 0
        ? `${NOMES_ATRIBUTO_AUMENTO[r.reducao.atributo]} já estava no mínimo`
        // atributo-base: valor-base após a redução
        : `${NOMES_ATRIBUTO_AUMENTO[r.reducao.atributo]} reduziu para ${char.atributos[r.reducao.atributo]}`);
    }
    toast(partes.join('; '), 'success');
    window.fecharModal();
    renderFichaCompleta();
  };
  btn.addEventListener('click', () => {
    if (aum.atributo !== 'escolha') {
      aplicar({}, btn);
      return;
    }
    const bloco = document.getElementById('bloco-aumento-permanente');
    if (!bloco) return;
    bloco.innerHTML = `<div class="section-divider mt-1"><span>Aumento permanente</span></div>
      <div style="font-size:0.85rem;margin-bottom:6px">${escHtml(textoAumentoPermanente(aum))}</div>
      <div class="form-group"><label class="form-label" for="sel-aumento-atributo">Atributo que aumenta</label>
        <select class="form-input" id="sel-aumento-atributo">${opcoesAtributosAumento()}</select></div>
      ${aum.reducao ? `<div class="form-group"><label class="form-label" for="sel-reducao-atributo">Atributo que diminui</label>
        <select class="form-input" id="sel-reducao-atributo">${opcoesAtributosAumento()}</select></div>` : ''}
      <button class="btn btn-sm btn-accent" id="btn-confirmar-aumento-permanente">Confirmar</button>`;
    // Atributo escolhido para aumentar não pode ser o reduzido: a opção fica desabilitada.
    const selAumento = document.getElementById('sel-aumento-atributo');
    const selReducao = document.getElementById('sel-reducao-atributo');
    selAumento?.addEventListener('change', () => {
      if (!selReducao) return;
      for (const op of selReducao.options) op.disabled = op.value !== '' && op.value === selAumento.value;
      if (selReducao.value === selAumento.value) selReducao.value = '';
    });
    const confirmar = document.getElementById('btn-confirmar-aumento-permanente');
    confirmar.addEventListener('click', () => aplicar({
      atributo: document.getElementById('sel-aumento-atributo')?.value,
      reduzir: document.getElementById('sel-reducao-atributo')?.value,
    }, confirmar));
  });
}

/**
 * Monta o HTML do corpo do modal de detalhe de um item do inventário:
 * descrição, tabelas, raridade, requisito, bloco de aumento permanente,
 * botões do contador manual e de destruir. Função pura (sem DOM nem
 * gravação); os botões são ligados depois por mostrarDetalheItemSheet.
 * @param {object} item Item do inventário.
 * @param {Array<{nome: string, descricao: string}>} propsDescs Glossário de propriedades de arma.
 * @param {{somenteLeitura?: boolean}} [opcoes] somenteLeitura: devolve só o corpo descritivo, sem controles de edição.
 * @returns {string}
 */
export function htmlDetalheItem(item, propsDescs = [], { somenteLeitura = false } = {}) {
  let corpo = '';

  if (item.tipo === 'arma') {
    const d = item.dados || {};
    corpo += `<div class="row" style="font-size:0.85rem;gap:8px;margin-bottom:10px">`;
    if (d.categoria) corpo += `<div class="col"><strong>Categoria:</strong> ${d.categoria}</div>`;
    if (d.dano) corpo += `<div class="col"><strong>Dano:</strong> ${d.dano}</div>`;
    corpo += `</div>`;

    if (d.maestria) corpo += `<div style="font-size:0.85rem;margin-bottom:6px"><strong>Maestria:</strong> ${d.maestria}</div>`;
    if (d.custo || d.peso) corpo += `<div style="font-size:0.85rem;margin-bottom:6px"><strong>Custo:</strong> ${d.custo || '—'} | <strong>Peso:</strong> ${d.peso || '—'}</div>`;

    corpo += htmlPropriedadesEMaestria(d, propsDescs);
  } else if (item.tipo === 'armadura' || item.tipo === 'escudo') {
    const d = item.dados || {};
    corpo += `<div style="font-size:0.85rem;margin-bottom:6px">`;
    if (d.categoria) corpo += `<strong>Categoria:</strong> ${d.categoria}<br>`;
    if (d.ca) corpo += `<strong>Classe de Armadura:</strong> ${item.tipo === 'armadura' ? textoCADaArmadura(item) : d.ca}<br>`;
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

    // Arma personalizada (com categoria): Categoria e Dano na mesma linha e Maestria, como a arma de catálogo.
    if (d.categoria) {
      corpo += `<div class="row" style="font-size:0.85rem;gap:8px;margin-bottom:6px"><div class="col"><strong>Categoria:</strong> ${escHtml(d.categoria)}</div>${dano ? `<div class="col"><strong>Dano:</strong> ${escHtml(dano)}</div>` : ''}</div>`;
      if (d.maestria) corpo += `<div style="font-size:0.85rem;margin-bottom:6px"><strong>Maestria:</strong> ${escHtml(d.maestria)}</div>`;
    }

    if (bonusCa || (dano && !d.categoria) || bonusAtq) {
      corpo += `<div style="font-size:0.85rem;margin-bottom:6px">`;
      if (bonusCa) corpo += `<strong>Bônus CA:</strong> ${bonusCa > 0 ? '+' : ''}${bonusCa}<br>`;
      if (dano && !d.categoria) corpo += `<strong>Dano:</strong> ${dano}<br>`;
      if (bonusAtq) corpo += `<strong>Bônus Ataque:</strong> ${bonusAtq > 0 ? '+' : ''}${bonusAtq}`;
      corpo += `</div>`;
    }

    // Arma customizada com categoria (issue #82): mesma formatação de
    // Propriedades/Maestria da arma de catálogo, em vez de só o nome cru
    // (issue #96, item a).
    if (!d.categoria && d.tipo_item) {
      // Issue #100: categoria que não é arma (Armadura, Consumível...).
      corpo += `<div style="font-size:0.85rem;margin-bottom:6px"><strong>Categoria:</strong> ${escHtml(d.tipo_item)}</div>`;
    }
    corpo += htmlResumoItemCustomizado(d);
    // Issue #135: a propriedade vale para qualquer item personalizado, não só
    // para o de categoria de arma.
    corpo += htmlPropriedadesEMaestria(d, propsDescs);

    if (item.descricao) {
      corpo += `<div class="md-content" style="margin-top:6px;font-size:0.85rem">${mdParaHtml(item.descricao)}</div>`;
    }
  } else if (item.tipo === 'magico') {
    corpo += htmlCorpoItemMagico(item.dados || {});
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

  // Arma/armadura/escudo mágicos: bloco mágico depois do detalhe da base.
  if (item.tipo !== 'magico' && item.dados?.magico_id) corpo += htmlCorpoItemMagico(item.dados);

  if (!corpo.trim()) corpo = '<div style="color:var(--text-muted)">Sem informações adicionais disponíveis.</div>';

  // Somente leitura (loja): sem atributo, resistência, pergaminho, aumento nem contador.
  if (somenteLeitura) return corpo;

  // Atributo do modificador (arma de ataque ou armadura): "Padrão (XXX)" + os 6 atributos.
  // Armadura só tem seletor quando a CA soma modificador: Leve e Média, ou "N + modificador de Des" sem categoria.
  const catArmadura = item.dados?.categoria;
  const ehArmaduraComModificador = item.tipo === 'armadura'
    && (catArmadura === 'Leve' || catArmadura === 'Média'
      || (catArmadura !== 'Pesada' && /modificador de des/i.test(item.dados?.ca || '')));
  if (ehArmaDeAtaque(item) || ehArmaduraComModificador) {
    const padraoId = ehArmaDeAtaque(item) ? atributoPadraoEfetivoArma(item) : 'destreza';
    const sigla = id => ATRIBUTOS_MODIFICADOR.find(a => a.id === id)?.sigla || '';
    const atual = atributoExplicito(item) || '';
    const limiteMedia = catArmadura === 'Média' ? ', máx. 2' : '';
    corpo += `<div class="form-group no-print" style="margin-top:10px"><label class="form-label" for="sel-atributo-item">Atributo do modificador</label>
      <select class="form-input" id="sel-atributo-item"><option value=""${atual ? '' : ' selected'}>Padrão (${sigla(padraoId)}${limiteMedia})</option>${ATRIBUTOS_MODIFICADOR.map(a => `<option value="${a.id}"${a.id === atual ? ' selected' : ''}>${a.nome}</option>`).join('')}</select></div>`;
  }

  // Item com resistência a escolher (4C): seletor do tipo de dano.
  const opcoesResistencia = opcoesDeEscolha(item);
  if (opcoesResistencia) {
    const atual = item.escolhas?.resistencia || '';
    corpo += `<div class="form-group no-print" style="margin-top:10px"><label class="form-label" for="sel-escolha-resistencia">Tipo de resistência</label>
      <select class="form-input" id="sel-escolha-resistencia"><option value="">— escolher —</option>${opcoesResistencia.map(o => `<option value="${escHtml(o)}"${o === atual ? ' selected' : ''}>${escHtml(o)}</option>`).join('')}</select></div>`;
  }

  // Pergaminho Mágico (issue #103): magia atual e botão para escolher/trocar.
  const circuloPergaminho = circuloDoItemPergaminho(item);
  if (circuloPergaminho !== null && !item.destruido) {
    const atual = item.dados?.magias?.[0]?.nome || '';
    corpo += `<div class="no-print" style="margin-top:10px"><div class="section-divider mt-1"><span>Magia do pergaminho</span></div>
      <div style="font-size:0.85rem;margin-bottom:6px">${atual ? escHtml(atual) : 'Em branco (sem magia definida)'}</div>
      <button class="btn btn-sm btn-secondary" id="btn-pergaminho-magia">${atual ? 'Trocar magia' : 'Escolher magia'}</button></div>`;
  }

  // Aumento permanente de atributo (Manuais, Tomos, Livros): botão ou aviso de aplicado.
  corpo += htmlAumentoPermanente(item);

  // Item sem recursos e não destruído: permite criar um contador manual.
  const aceitaContador = !recursosDoItem(item) && !item.destruido;
  if (aceitaContador) corpo += '<div class="no-print" style="margin-top:10px"><button class="btn btn-sm btn-secondary" id="btn-adicionar-contador">+ Contador de cargas/usos</button></div>';
  // Contador manual: editar (formulário preenchido) e remover; recursos do acervo nunca são removíveis.
  const manual = contadorEhManual(item) && !item.destruido;
  if (manual) {
    corpo += `<div class="no-print" style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap">
      <button class="btn btn-sm btn-secondary" id="btn-editar-contador">Editar contador</button>
      <button class="btn btn-sm btn-danger" id="btn-remover-contador">Remover contador</button></div>`;
  }
  // Item mágico com recursos (cargas ou usos): marcar destruído à mão (Escaravelho de Proteção, Talismãs).
  const podeMarcarDestruido = !item.destruido && !!recursosDoItem(item) && (item.tipo === 'magico' || !!item.dados?.magico_id);
  if (podeMarcarDestruido) corpo += '<div class="no-print" style="margin-top:10px"><button class="btn btn-sm btn-danger" id="btn-marcar-destruido">Marcar como destruído</button></div>';
  return corpo;
}

/** Mostra popup com detalhes completos de um item do inventário */
export async function mostrarDetalheItemSheet(item) {
  if (!item) return;
  const dados = await carregarDadosEquipSheet();
  const corpo = htmlDetalheItem(item, dados.propriedadesArmas || []);
  /** Liga os botões do contador (adicionar, editar, remover) e de marcar destruído no detalhe aberto. */
  const ligarContador = () => {
    document.getElementById('btn-adicionar-contador')?.addEventListener('click', () => abrirFormularioContadorManual(item));
    document.getElementById('btn-editar-contador')?.addEventListener('click', () => abrirFormularioContadorManual(item));
    document.getElementById('btn-remover-contador')?.addEventListener('click', () => {
      if (!removerContadorManual(item)) return;
      salvar();
      window.fecharModal();
      renderFichaCompleta();
    });
    document.getElementById('btn-marcar-destruido')?.addEventListener('click', () => {
      marcarDestruido(item);
      salvar();
      window.fecharModal();
      renderFichaCompleta();
    });
  };

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
  ligarContador();
  ligarAumentoPermanente(item);
  // Pergaminho Mágico: abre a grade com a magia atual marcada e grava a troca.
  // `abrindoTroca` trava cliques repetidos durante o await do índice: sem ele
  // o modal empilharia duas vezes (ids duplicados) e a troca valeria duas vezes.
  let abrindoTroca = false;
  document.getElementById('btn-pergaminho-magia')?.addEventListener('click', async () => {
    if (abrindoTroca) return;
    abrindoTroca = true;
    const circulo = circuloDoItemPergaminho(item);
    let magias;
    try {
      magias = (await carregarMagiasIndicePergaminho()).filter(m => Number(m.circulo) === circulo);
    } finally {
      abrindoTroca = false;
    }
    abrirModal('Magia do Pergaminho', `<div id="pergaminho-cards-raiz">${htmlSeletorMagiaPergaminho(magias, item.dados?.magias?.[0]?.nome || '')}</div>
      ${(item.quantidade || 1) > 1 ? '<div style="font-size:0.75rem;color:var(--text-muted);margin-top:6px">Há mais de um pergaminho: a troca vale para um só.</div>' : ''}`,
      '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-primary" id="btn-confirmar-pergaminho-magia">Confirmar</button>');
    const raiz = document.getElementById('pergaminho-cards-raiz');
    ligarSeletorMagiaPergaminho(raiz);
    document.getElementById('btn-confirmar-pergaminho-magia')?.addEventListener('click', () => {
      if (!aplicarMagiaNoPergaminho(char, item, magiaSelecionadaPergaminho(raiz))) { toast('Não foi possível trocar a magia.', 'error'); return; }
      salvar();
      window.fecharModalTodos();
      renderFichaCompleta();
    });
  });
  // Escolha do atributo: grava em dados.atributo (vazio = padrão) e recalcula a ficha.
  document.getElementById('sel-atributo-item')?.addEventListener('change', (e) => {
    item.dados = item.dados || {};
    if (e.target.value) item.dados.atributo = e.target.value;
    else delete item.dados.atributo;
    salvar();
    window.fecharModal();
    renderFichaCompleta();
  });
  // Grava a escolha de resistência, recalcula a ficha e fecha o modal.
  document.getElementById('sel-escolha-resistencia')?.addEventListener('change', (e) => {
    const escolhas = { ...(item.escolhas || {}) };
    if (e.target.value) escolhas.resistencia = e.target.value;
    else delete escolhas.resistencia;
    item.escolhas = escolhas;
    salvar();
    renderFichaCompleta();
    window.fecharModal();
  });
}

