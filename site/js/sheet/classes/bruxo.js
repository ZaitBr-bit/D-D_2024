// ============================================================
// Progressao e recursos do Bruxo
//
// Consultado pela ficha, pelos descansos e pelas habilidades ativas.
// Extraido de site/js/pages/sheet.js sem alteracao de comportamento.
// ============================================================
import { getMagiasClasse, getTalentos } from '../../db.js';
import { abrirModal, calcMod, mdParaHtml, semAcento, toast } from '../../utils.js';
import { char, classeData, indiceMagiasCache, salvar } from '../estado.js';
import { renderFichaCompleta } from '../ficha.js';
import { achatarMagiasClasse, badgesMagiaRapidos } from '../magias.js';
import { abrirModalIniciadoEmMagiaFicha, sincronizarTalentosInvocacoes } from '../talentos.js';

// Os tres Pactos sao invocacoes misticas COMUNS no PHB 2024: aparecem na
// secao "Opcoes de Invocacoes Misticas" sem pre-requisito e sem nenhuma
// clausula de exclusividade entre elas (a caracteristica "Dadiva de Pacto"
// de 2014, que mandava escolher uma, nao existe mais). A lista existe apenas
// para destacar o grupo na tela e para ler os pre-requisitos que citam um
// pacto -- nunca para limitar a escolha a um deles.
const PACTOS = ['Pacto da Corrente', 'Pacto da Lâmina', 'Pacto do Tomo'];

// Quais pactos o personagem tem, na ordem canonica acima. Substituiu o campo
// unico `recursos.bruxo.pacto`: como os pactos sao invocacoes comuns, a fonte
// da verdade e o proprio array de invocacoes.
function pactosDe(invocacoes) {
  return PACTOS.filter(p => (invocacoes || []).some(i => (typeof i === 'string' ? i : i?.nome) === p));
}

function getProgressaoBruxo() {
  if (char?.classe !== 'Bruxo' || !classeData?.tabela_caracteristicas) return null;
  const row = classeData.tabela_caracteristicas.find(r => parseInt(r['Nível']) === (char.nivel || 1));
  if (!row) return null;
  return {
    invocacoesMax: parseInt(row['Invocações']) || 0
  };
}

function getCirculosArcanumDesbloqueados() {
  const nivel = char?.nivel || 1;
  const circulos = [];
  if (nivel >= 11) circulos.push(6);
  if (nivel >= 13) circulos.push(7);
  if (nivel >= 15) circulos.push(8);
  if (nivel >= 17) circulos.push(9);
  return circulos;
}

export function getEstadoRecursosBruxo() {
  if (char?.classe !== 'Bruxo') return null;
  if (!char.recursos) char.recursos = {};
  if (!char.recursos.bruxo) {
    char.recursos.bruxo = {
      astucia_usada: false,
      invocacoes: [],
      arcanum: {
        6: { magia: '', usado: false },
        7: { magia: '', usado: false },
        8: { magia: '', usado: false },
        9: { magia: '', usado: false }
      }
    };
  }

  if (!Array.isArray(char.recursos.bruxo.invocacoes)) char.recursos.bruxo.invocacoes = [];

  // Migracao: converter strings antigas para objetos {nome, truque?}
  char.recursos.bruxo.invocacoes = char.recursos.bruxo.invocacoes.map(inv => {
    if (typeof inv === 'string') return { nome: inv };
    if (inv && typeof inv === 'object' && inv.nome) return inv;
    return null;
  }).filter(Boolean);

  // Migracao: o campo unico `pacto` e resquicio das regras de 2014. Fichas
  // antigas podem te-lo preenchido sem que o pacto esteja entre as invocacoes;
  // ele e absorvido pelo array e depois removido, para que nada volte a ler um
  // pacto unico (era isso que fazia o segundo pacto sumir da tela).
  const pactoLegado = char.recursos.bruxo.pacto || '';
  const nomesInvocacoes = char.recursos.bruxo.invocacoes.map(i => i.nome);
  if (pactoLegado && PACTOS.includes(pactoLegado) && !nomesInvocacoes.includes(pactoLegado)) {
    char.recursos.bruxo.invocacoes.unshift({ nome: pactoLegado });
  }
  if ('pacto' in char.recursos.bruxo) delete char.recursos.bruxo.pacto;

  if (!char.recursos.bruxo.arcanum) {
    char.recursos.bruxo.arcanum = {
      6: { magia: '', usado: false },
      7: { magia: '', usado: false },
      8: { magia: '', usado: false },
      9: { magia: '', usado: false }
    };
  }

  [6, 7, 8, 9].forEach(c => {
    if (!char.recursos.bruxo.arcanum[c]) {
      char.recursos.bruxo.arcanum[c] = { magia: '', usado: false };
    }
    if (typeof char.recursos.bruxo.arcanum[c].usado !== 'boolean') {
      char.recursos.bruxo.arcanum[c].usado = false;
    }
    if (typeof char.recursos.bruxo.arcanum[c].magia !== 'string') {
      char.recursos.bruxo.arcanum[c].magia = '';
    }
  });

  const progressao = getProgressaoBruxo() || { invocacoesMax: 0 };
  const circulosArcanum = getCirculosArcanumDesbloqueados();

  // Inicializar dados do Pacto do Tomo (truques e rituais escolhidos)
  if (!char.recursos.bruxo.pacto_tomo) {
    char.recursos.bruxo.pacto_tomo = { truques: [], rituais: [] };
  }
  if (!Array.isArray(char.recursos.bruxo.pacto_tomo.truques)) char.recursos.bruxo.pacto_tomo.truques = [];
  if (!Array.isArray(char.recursos.bruxo.pacto_tomo.rituais)) char.recursos.bruxo.pacto_tomo.rituais = [];

  // Inicializar recursos de subclasses do Bruxo
  if (!char.recursos.bruxo.subclasses) {
    char.recursos.bruxo.subclasses = {
      arquifada: { passos_feericos_usos_gastos: 0, fuga_nevoa_usada: false, defesas_sedutoras_usada: false },
      celestial: { luz_medicinal_dados_gastos: 0, vinganca_calcinante_usada: false },
      grande_antigo: { combatente_clarividente_usado: false },
      infero: { sorte_tenebroso_usos_gastos: 0, resistencia_infera_escolha: '', lancar_inferno_usado: false }
    };
  }
  const sub = char.recursos.bruxo.subclasses;
  if (!sub.arquifada) sub.arquifada = { passos_feericos_usos_gastos: 0, fuga_nevoa_usada: false, defesas_sedutoras_usada: false };
  if (!sub.celestial) sub.celestial = { luz_medicinal_dados_gastos: 0, vinganca_calcinante_usada: false };
  if (!sub.grande_antigo) sub.grande_antigo = { combatente_clarividente_usado: false };
  if (!sub.infero) sub.infero = { sorte_tenebroso_usos_gastos: 0, resistencia_infera_escolha: '', lancar_inferno_usado: false };
  if (typeof sub.arquifada.passos_feericos_usos_gastos !== 'number') sub.arquifada.passos_feericos_usos_gastos = 0;
  if (typeof sub.arquifada.fuga_nevoa_usada !== 'boolean') sub.arquifada.fuga_nevoa_usada = false;
  if (typeof sub.arquifada.defesas_sedutoras_usada !== 'boolean') sub.arquifada.defesas_sedutoras_usada = false;
  if (typeof sub.celestial.luz_medicinal_dados_gastos !== 'number') sub.celestial.luz_medicinal_dados_gastos = 0;
  if (typeof sub.celestial.vinganca_calcinante_usada !== 'boolean') sub.celestial.vinganca_calcinante_usada = false;
  if (typeof sub.grande_antigo.combatente_clarividente_usado !== 'boolean') sub.grande_antigo.combatente_clarividente_usado = false;
  if (typeof sub.infero.sorte_tenebroso_usos_gastos !== 'number') sub.infero.sorte_tenebroso_usos_gastos = 0;
  if (typeof sub.infero.lancar_inferno_usado !== 'boolean') sub.infero.lancar_inferno_usado = false;

  const nivel = char.nivel || 1;
  const modCar = Math.max(1, calcMod(char.atributos.carisma));

  return {
    astuciaUsada: !!char.recursos.bruxo.astucia_usada,
    pactos: pactosDe(char.recursos.bruxo.invocacoes),
    invocacoes: char.recursos.bruxo.invocacoes,
    invocacoesMax: progressao.invocacoesMax,
    arcanum: char.recursos.bruxo.arcanum,
    circulosArcanum,
    mestreMisticoAtivo: nivel >= 20,
    pactoTomo: char.recursos.bruxo.pacto_tomo,
    nivel,
    modCar,
    subclasses: sub,
    // Arquifada
    passosFeericosMax: modCar,
    passosFeericosDisponiveis: Math.max(0, modCar - sub.arquifada.passos_feericos_usos_gastos),
    fugaNeVoaUsada: !!sub.arquifada.fuga_nevoa_usada,
    defesasSedutorasUsada: !!sub.arquifada.defesas_sedutoras_usada,
    // Celestial
    luzMedicinalDadosMax: 1 + nivel,
    luzMedicinalDadosDisponiveis: Math.max(0, (1 + nivel) - sub.celestial.luz_medicinal_dados_gastos),
    vingancaCalcinanteUsada: !!sub.celestial.vinganca_calcinante_usada,
    // Grande Antigo
    combatenteClarividenteUsado: !!sub.grande_antigo.combatente_clarividente_usado,
    // Ínfero
    sorteTenebrosoMax: modCar,
    sorteTenebrosoDisponiveis: Math.max(0, modCar - sub.infero.sorte_tenebroso_usos_gastos),
    resistenciaInferaEscolha: sub.infero.resistencia_infera_escolha || '',
    lancarInfernoUsado: !!sub.infero.lancar_inferno_usado
  };
}

export function recuperarEspacosMagiaBruxo(parcial = false) {
  if (char?.classe !== 'Bruxo' || !char.espacos_magia) return 0;
  const chaves = Object.keys(char.espacos_magia);
  if (chaves.length === 0) return 0;

  const usadosAntes = chaves.reduce((acc, c) => acc + (char.espacos_magia[c]?.usados || 0), 0);
  if (usadosAntes <= 0) return 0;

  if (!parcial) {
    chaves.forEach(c => { char.espacos_magia[c].usados = 0; });
    return usadosAntes;
  }

  const totalMax = chaves.reduce((acc, c) => acc + (char.espacos_magia[c]?.total || 0), 0);
  let recuperar = Math.ceil(totalMax / 2);
  if ((char.nivel || 1) >= 20) recuperar = totalMax;
  recuperar = Math.min(recuperar, usadosAntes);

  let restante = recuperar;
  for (const c of chaves.sort((a, b) => Number(b) - Number(a))) {
    if (restante <= 0) break;
    const usados = char.espacos_magia[c]?.usados || 0;
    if (usados <= 0) continue;
    const reduz = Math.min(usados, restante);
    char.espacos_magia[c].usados -= reduz;
    restante -= reduz;
  }

  return recuperar - restante;
}

function extrairOpcoesInvocacoesBruxo() {
  if (char?.classe !== 'Bruxo') return [];
  const texto = classeData?.texto_completo || '';
  const marcadorInicio = '## Opções de Invocações Místicas';
  const inicio = texto.indexOf(marcadorInicio);
  if (inicio < 0) return [];

  let secao = texto.slice(inicio + marcadorInicio.length);
  const fim = secao.indexOf('## Lista de Magias de Bruxo');
  if (fim >= 0) secao = secao.slice(0, fim);

  const opcoes = [];
  const regex = /###\s+([^\n]+)\n([\s\S]*?)(?=\n###\s+|$)/g;
  let match;
  while ((match = regex.exec(secao)) !== null) {
    const nome = (match[1] || '').trim();
    const corpo = match[2] || '';
    const prereqMatch = corpo.match(/\*Pré-requisitos?:\s*([^*]+)\*/i);
    const prerequisito = prereqMatch ? prereqMatch[1].trim() : '';
    const repetivel = /\*\*Repetível\.\*\*/i.test(corpo) || /Repetível\./i.test(corpo);
    // Extrair descricao limpa (sem linha de pre-requisito e sem marcador de repetivel)
    let descricao = corpo
      .replace(/\*Pré-requisitos?:\s*[^*]+\*/gi, '')
      .replace(/\*\*Repetível\.\*\*/gi, '')
      .replace(/Repetível\./gi, '')
      .replace(/^\s*\n/gm, '')
      .trim();
    if (nome) opcoes.push({ nome, prerequisito, repetivel, descricao });
  }

  return opcoes;
}

// Função legada removida - usar avaliarPrerequisitoInvocacaoBruxoComSel()

// Obtém magias disponíveis do Bruxo por círculo para Arcana Mística
async function obterMagiasArcanumPorCirculo(circulo) {
  const magiasClasseData = await getMagiasClasse('Bruxo');
  const todas = achatarMagiasClasse(magiasClasseData);
  return todas.filter(m => m.circulo === circulo).sort((a, b) => a.nome.localeCompare(b.nome));
}

export async function abrirModalRecursosBruxo() {
  if (char?.classe !== 'Bruxo') return;
  const estado = getEstadoRecursosBruxo();
  const opcoes = extrairOpcoesInvocacoesBruxo();
  const nivel = char.nivel || 1;

  // Separar pactos das demais invocações (só para agrupar na tela)
  const invPactos = opcoes.filter(o => PACTOS.includes(o.nome));
  const invNormais = opcoes.filter(o => !PACTOS.includes(o.nome));

  // Estado atual: invocações selecionadas (incluindo pacto) — array para suportar repetíveis
  const invSelecionadas = [...estado.invocacoes];

  // Carregar magias para Arcana Mística (assíncrono)
  const magiasArcanum = {};
  for (const c of [6, 7, 8, 9]) {
    if (estado.circulosArcanum.includes(c)) {
      magiasArcanum[c] = await obterMagiasArcanumPorCirculo(c);
    }
  }

  // Funcao auxiliar para extrair nivel de pre-requisito
  function nivelPrereqInv(o) {
    const m = o.prerequisito.match(/N[ií]vel\s*(\d+)/i);
    return m ? parseInt(m[1]) : 0;
  }

  // Agrupar invocacoes por categoria de nivel
  const grupos = [
    { label: 'Pacto (Invocacao de Nivel 1)', items: invPactos },
    { label: 'Sem pre-requisito de nivel', items: invNormais.filter(o => nivelPrereqInv(o) === 0) },
    { label: 'Nivel 2+', items: invNormais.filter(o => { const n = nivelPrereqInv(o); return n >= 2 && n < 5; }) },
    { label: 'Nivel 5+', items: invNormais.filter(o => { const n = nivelPrereqInv(o); return n >= 5 && n < 7; }) },
    { label: 'Nivel 7+', items: invNormais.filter(o => { const n = nivelPrereqInv(o); return n >= 7 && n < 9; }) },
    { label: 'Nivel 9+', items: invNormais.filter(o => { const n = nivelPrereqInv(o); return n >= 9 && n < 12; }) },
    { label: 'Nivel 12+', items: invNormais.filter(o => { const n = nivelPrereqInv(o); return n >= 12 && n < 15; }) },
    { label: 'Nivel 15+', items: invNormais.filter(o => nivelPrereqInv(o) >= 15) }
  ].filter(g => g.items.length > 0);

  // Contar ocorrencias de cada invocacao no array de objetos {nome, truque?}
  function contarInv(arr, nome) { return arr.filter(o => o.nome === nome).length; }
  // Extrair apenas nomes para validacao de pre-requisitos
  function nomesDoArr(arr) { return arr.map(o => o.nome); }

  // Invocacoes que requerem selecao de parametro extra (truque ou talento)
  // tipo: 'truque' ou 'talento' -> determina qual campo salvar no objeto e qual lista exibir
  const INV_PARAMETRO = {
    'Explosão Agonizante': { tipo: 'truque', campo: 'truque', desc: 'Truque de dano: +modificador de Carisma ao dano', placeholder: '-- Escolha um truque --' },
    'Explosão Repulsiva': { tipo: 'truque', campo: 'truque', desc: 'Truque com rolagem de ataque: empurra alvo 3m', placeholder: '-- Escolha um truque --' },
    'Lança Mística': { tipo: 'truque', campo: 'truque', desc: 'Truque de dano (alcance 3m+): aumenta alcance', placeholder: '-- Escolha um truque --' },
    'Lições dos Grandes Antigos': { tipo: 'talento', campo: 'talento', desc: 'Escolha um Talento de Origem', placeholder: '-- Escolha um talento --' }
  };

  // Talentos de Origem carregados do JSON (cache local)
  let talentosOrigemCache = null;
  async function obterTalentosOrigem() {
    if (talentosOrigemCache) return talentosOrigemCache;
    try {
      const data = await getTalentos();
      talentosOrigemCache = (data?.por_categoria?.['de Origem'] || []).map(t => t.nome).sort();
    } catch (e) {
      talentosOrigemCache = [];
    }
    return talentosOrigemCache;
  }

  // Obter truques conhecidos do personagem
  function obterTruquesParaSelecao() {
    const truques = (char.magias_conhecidas || []).filter(m => m.circulo === 0);
    return truques.map(m => m.nome).sort();
  }

  // Obter opcoes para o parametro de uma invocacao
  // Para talentos, filtra os ja escolhidos em outras instancias
  function obterOpcoesParametro(nomeInv, invArr, idxAtual) {
    const config = INV_PARAMETRO[nomeInv];
    if (!config) return [];
    if (config.tipo === 'truque') return obterTruquesParaSelecao();
    if (config.tipo === 'talento') {
      const lista = talentosOrigemCache || [];
      // Filtrar talentos ja escolhidos em OUTRAS instancias desta invocacao
      const jaEscolhidos = new Set();
      let count = 0;
      for (const inv of invArr) {
        if (inv.nome === nomeInv) {
          if (count !== idxAtual && inv.talento) jaEscolhidos.add(inv.talento);
          count++;
        }
      }
      return lista.filter(t => !jaEscolhidos.has(t));
    }
    return [];
  }

  function renderCard(o, invArr) {
    const qtd = contarInv(invArr, o.nome);
    const sel = qtd > 0;
    const validacao = avaliarPrerequisitoInvocacaoBruxoComSel(o.prerequisito, new Set(nomesDoArr(invArr)));
    const bloqueado = !validacao.ok && !sel;
    const ehPacto = PACTOS.includes(o.nome);
    const configParam = INV_PARAMETRO[o.nome] || null;
    // Pre-requisito resumido
    let preResumo = '';
    if (o.prerequisito && !ehPacto) {
      preResumo = o.prerequisito.replace(/Bruxo\s*/gi, '').replace(/ou superior/gi, '+');
    }
    // Seletor de parametro para invocacoes que requerem escolha (truque ou talento)
    let paramHtml = '';
    if (configParam && sel) {
      const instancias = invArr.filter(i => i.nome === o.nome);
      paramHtml = instancias.map((inst, idx) => {
        const selVal = inst[configParam.campo] || '';
        const opcoesDisp = obterOpcoesParametro(o.nome, invArr, idx);
        return `
          <div style="margin-top:4px;padding-top:4px;border-top:1px dashed var(--border-light)" data-inv-param-wrapper="${o.nome}" data-inv-param-idx="${idx}">
            <label style="font-size:0.6rem;color:var(--text-muted);display:block">${configParam.desc}${qtd > 1 ? ` (#${idx+1})` : ''}</label>
            <select class="form-select" style="font-size:0.7rem;padding:2px 4px;margin-top:2px" data-inv-param-sel="${o.nome}" data-inv-param-selidx="${idx}" data-inv-param-campo="${configParam.campo}">
              <option value="">${configParam.placeholder}</option>
              ${opcoesDisp.map(t => `<option value="${t}" ${selVal === t ? 'selected' : ''}>${t}</option>`).join('')}
            </select>
          </div>`;
      }).join('');
    }
    // Descricao formatada (exibida ao clicar no nome)
    const descHtml = mdParaHtml(o.descricao || 'Sem descricao disponivel.');
    return `
      <div class="opcao-card ${sel ? 'selecionada' : ''} ${bloqueado ? 'bloqueada' : ''} ${ehPacto ? 'magia-dominio' : ''}"
           data-inv-card="${o.nome}" style="${bloqueado ? 'opacity:0.35;cursor:not-allowed;' : ''};position:relative">
        <div style="display:flex;align-items:center;gap:6px">
          <span class="opcao-check" data-inv-toggle="${o.nome}" style="cursor:pointer;flex-shrink:0"></span>
          <div style="flex:1;min-width:0">
            <div class="opcao-nome" data-inv-info="${o.nome}" style="cursor:pointer">${ehPacto ? '<span class="badge-dominio">&#9733;</span> ' : ''}${o.nome}${qtd > 1 ? ` <span class="badge" style="font-size:0.6rem;background:var(--accent);color:#fff">x${qtd}</span>` : ''}</div>
            <div class="opcao-resumo">
              ${preResumo ? `<span style="font-size:0.65rem">${preResumo}</span>` : ''}
              ${o.repetivel ? '<span style="font-size:0.65rem;color:var(--accent)">Repetivel</span>' : ''}
            </div>
          </div>
        </div>
        ${paramHtml}
        <div class="inv-desc-inline" data-inv-desc="${o.nome}" style="display:none;margin-top:6px;padding:6px 8px;border-top:1px solid var(--border-light);font-size:0.75rem;color:var(--text-muted)">
          ${o.prerequisito ? `<div style="font-size:0.7rem;color:var(--secondary);font-weight:600;margin-bottom:4px">${o.prerequisito}</div>` : ''}
          <div class="md-content">${descHtml}</div>
        </div>
      </div>`;
  }

  function buildInvocacoesHtml(invArr) {
    let html = '';
    html += `<div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:8px">
      Selecionadas: <strong>${invArr.length}</strong> / ${estado.invocacoesMax}
      ${invArr.length > estado.invocacoesMax ? '<span style="color:var(--danger)"> (excedido!)</span>' : ''}
    </div>`;
    for (const grupo of grupos) {
      html += `<div style="font-size:0.75rem;font-weight:700;color:var(--secondary);margin:10px 0 4px">${grupo.label}</div>`;
      html += `<div class="opcao-grid densa">${grupo.items.map(o => renderCard(o, invArr)).join('')}</div>`;
    }
    return html;
  }

  // Arcana Mística HTML
  let arcanumHtml = '';
  if (estado.circulosArcanum.length > 0 || nivel >= 11) {
    arcanumHtml += '<div class="section-divider"><span>Arcana Mística</span></div>';
    for (const c of [6, 7, 8, 9]) {
      const desbloqueado = estado.circulosArcanum.includes(c);
      const dado = estado.arcanum[c] || { magia: '', usado: false };
      const magias = magiasArcanum[c] || [];
      arcanumHtml += `
        <div class="form-group" style="opacity:${desbloqueado ? 1 : 0.5}">
          <label class="form-label">${c}º Círculo ${desbloqueado ? '' : '(Bloqueado)'}</label>
          ${desbloqueado ? `
            <select class="form-select" id="bruxo-arcanum-${c}">
              <option value="">-- Selecione uma magia --</option>
              ${magias.map(m => `<option value="${m.nome}" ${dado.magia === m.nome ? 'selected' : ''}>${m.nome}</option>`).join('')}
            </select>
          ` : `
            <select class="form-select" disabled>
              <option value="">Desbloqueado no nível ${c === 6 ? 11 : c === 7 ? 13 : c === 8 ? 15 : 17}</option>
            </select>
          `}
        </div>`;
    }
  }

  abrirModal('Recursos do Bruxo', `
    <div class="section-divider"><span>Invocaçoes Misticas</span></div>
    <div class="search-box" style="margin-bottom:8px"><input type="text" id="busca-inv-bruxo" placeholder="Buscar invocacao..." class="form-input"></div>
    <div id="bruxo-inv-grid" style="max-height:55vh;overflow-y:auto"></div>
    ${arcanumHtml}
  `,
  '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-primary" id="btn-salvar-bruxo-recursos">Salvar</button>');

  // Estado mutável das selecionadas (array para repetíveis)
  const gridEl = document.getElementById('bruxo-inv-grid');

  function renderGrid() {
    const termo = semAcento(document.getElementById('busca-inv-bruxo')?.value || '');
    if (termo.length >= 2) {
      const gruposFiltrados = grupos.map(g => ({
        ...g,
        items: g.items.filter(o => semAcento(o.nome).includes(termo))
      })).filter(g => g.items.length > 0);
      let html = `<div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:8px">
        Selecionadas: <strong>${invSelecionadas.length}</strong> / ${estado.invocacoesMax}
      </div>`;
      for (const grupo of gruposFiltrados) {
        html += `<div style="font-size:0.75rem;font-weight:700;color:var(--secondary);margin:10px 0 4px">${grupo.label}</div>`;
        html += `<div class="opcao-grid densa">${grupo.items.map(o => renderCard(o, invSelecionadas)).join('')}</div>`;
      }
      gridEl.innerHTML = html;
    } else {
      gridEl.innerHTML = buildInvocacoesHtml(invSelecionadas);
    }
    attachInvToggleListeners();
  }

  function attachInvToggleListeners() {
    // Toggle de selecao ao clicar no checkbox
    gridEl.querySelectorAll('[data-inv-toggle]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const nome = el.dataset.invToggle;
        const opcao = opcoes.find(o => o.nome === nome);
        if (!opcao) return;

        const qtdAtual = contarInv(invSelecionadas, nome);
        if (qtdAtual > 0) {
          // Desselecionar (remover uma ocorrencia)
          const idx = invSelecionadas.findIndex(o => o.nome === nome);
          if (idx >= 0) invSelecionadas.splice(idx, 1);
        } else {
          // Validar pre-requisito
          const validacao = avaliarPrerequisitoInvocacaoBruxoComSel(opcao.prerequisito, new Set(nomesDoArr(invSelecionadas)));
          if (!validacao.ok) {
            toast(`Pre-requisito nao atendido: ${validacao.motivo}`, 'error');
            return;
          }
          if (invSelecionadas.length >= estado.invocacoesMax) {
            toast(`Limite de ${estado.invocacoesMax} invocacoes atingido.`, 'error');
            return;
          }
          // Pactos entram como qualquer outra invocacao: escolher um nao
          // desmarca outro (PHB 2024 nao limita a um pacto).
          invSelecionadas.push({ nome });
        }
        renderGrid();
      });
    });

    // Para repetiveis: adicionar botao +1 ao card
    gridEl.querySelectorAll('[data-inv-card]').forEach(el => {
      const nome = el.dataset.invCard;
      const opcao = opcoes.find(o => o.nome === nome);
      if (!opcao?.repetivel) return;
      const qtd = contarInv(invSelecionadas, nome);
      if (qtd >= 1) {
        const metaDiv = el.querySelector('.opcao-resumo');
        if (metaDiv) {
          const addBtn = document.createElement('span');
          addBtn.style.cssText = 'font-size:0.7rem;cursor:pointer;padding:1px 6px;border:1px solid var(--accent);border-radius:4px;color:var(--accent);margin-left:4px';
          addBtn.textContent = '+1';
          addBtn.title = 'Adicionar outra ocorrência (Repetível)';
          addBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (invSelecionadas.length >= estado.invocacoesMax) {
              toast(`Limite de ${estado.invocacoesMax} invocacoes atingido.`, 'error');
              return;
            }
            invSelecionadas.push({ nome });
            renderGrid();
          });
          metaDiv.appendChild(addBtn);
        }
      }
    });

    // Clicar no nome da invocacao mostra/oculta descricao inline
    gridEl.querySelectorAll('[data-inv-info]').forEach(nomeEl => {
      nomeEl.addEventListener('click', (e) => {
        e.stopPropagation();
        const nome = nomeEl.dataset.invInfo;
        const card = nomeEl.closest('[data-inv-card]');
        if (!card) return;
        const descEl = card.querySelector(`[data-inv-desc="${nome}"]`);
        if (!descEl) return;
        // Ocultar outras descricoes abertas
        gridEl.querySelectorAll('.inv-desc-inline').forEach(d => {
          if (d !== descEl) d.style.display = 'none';
        });
        // Toggle da descricao clicada
        descEl.style.display = descEl.style.display === 'none' ? 'block' : 'none';
      });
    });

    // Listeners dos selects de parametro (truque ou talento)
    gridEl.querySelectorAll('[data-inv-param-sel]').forEach(sel => {
      sel.addEventListener('click', (e) => e.stopPropagation());
      sel.addEventListener('change', (e) => {
        e.stopPropagation();
        const nome = sel.dataset.invParamSel;
        const idx = parseInt(sel.dataset.invParamSelidx);
        const campo = sel.dataset.invParamCampo;
        let count = 0;
        for (let i = 0; i < invSelecionadas.length; i++) {
          if (invSelecionadas[i].nome === nome) {
            if (count === idx) {
              const novoObj = { ...invSelecionadas[i] };
              if (sel.value) { novoObj[campo] = sel.value; }
              else { delete novoObj[campo]; }
              invSelecionadas[i] = novoObj;
              if (campo === 'talento') renderGrid();
              break;
            }
            count++;
          }
        }
      });
    });
  }

  // Pre-carregar talentos de origem (para Licoes dos Grandes Antigos)
  await obterTalentosOrigem();

  renderGrid();

  // Busca
  document.getElementById('busca-inv-bruxo')?.addEventListener('input', () => renderGrid());

  // Salvar
  document.getElementById('btn-salvar-bruxo-recursos')?.addEventListener('click', () => {
    const invFinais = invSelecionadas.map(o => ({...o}));

    // Os pactos ficam no proprio array de invocacoes -- nao ha campo separado.
    char.recursos.bruxo.invocacoes = invFinais;

    // Salvar Arcana Mística
    [6, 7, 8, 9].forEach(c => {
      const desbloqueado = estado.circulosArcanum.includes(c);
      if (!desbloqueado) {
        char.recursos.bruxo.arcanum[c] = { magia: '', usado: false };
      } else {
        const magia = (document.getElementById(`bruxo-arcanum-${c}`)?.value || '').trim();
        const usadoAntes = !!char.recursos.bruxo.arcanum[c]?.usado;
        char.recursos.bruxo.arcanum[c] = { magia, usado: usadoAntes };
      }
    });

    const novosTalentos = sincronizarTalentosInvocacoes();

    salvar();
    window.fecharModal();
    renderFichaCompleta();

    // Se ganhou Iniciado em Magia via invocação (possivelmente mais de uma vez), abrir fluxo de escolha em cadeia
    const qtdNovoIM = novosTalentos.filter(t => t === 'Iniciado em Magia').length;
    if (qtdNovoIM > 0) {
      abrirModalIniciadoEmMagiaFicha(qtdNovoIM);
    }
  });
}

// Modal para gerenciar truques e rituais do Pacto do Tomo
export function abrirModalPactoDoTomo() {
  if (char?.classe !== 'Bruxo') return;
  const estado = getEstadoRecursosBruxo();
  if (!estado || !estado.pactos.includes('Pacto do Tomo')) return;

  const tomoData = estado.pactoTomo || { truques: [], rituais: [] };
  const truquesSel = [...tomoData.truques]; // [{nome, classe}]
  const rituaisSel = [...tomoData.rituais]; // [{nome, classe}]

  // Filtrar truques de TODAS as classes que o personagem ainda nao tem preparados
  const truquesJaPreparados = new Set((char.magias_conhecidas || []).filter(m => m.circulo === 0).map(m => m.nome));
  const todosTruquesIndice = indiceMagiasCache.filter(m => m.circulo === 0);
  // Filtrar rituais de 1o circulo de TODAS as classes (magias com "Ritual" no tempo_conjuracao e que o personagem nao tem)
  const jaPreparados = new Set((char.magias_preparadas || []).map(m => m.nome));
  const todosRituais1 = indiceMagiasCache.filter(m =>
    m.circulo === 1 &&
    m.tempo_conjuracao && /ritual/i.test(m.tempo_conjuracao)
  );

  // Listar todas as classes disponveis nos truques/rituais
  const classesComTruques = [...new Set(todosTruquesIndice.flatMap(m => m.classes || []))].sort();
  const classesComRituais = [...new Set(todosRituais1.flatMap(m => m.classes || []))].sort();

  function renderTruquesGrid(filtroClasse) {
    let itens = todosTruquesIndice;
    if (filtroClasse) itens = itens.filter(m => (m.classes || []).includes(filtroClasse));
    return itens.sort((a, b) => a.nome.localeCompare(b.nome)).map(m => {
      const sel = truquesSel.find(t => t.nome === m.nome);
      const jaTem = truquesJaPreparados.has(m.nome) && !sel;
      const cheio = truquesSel.length >= 3 && !sel;
      return `
        <div class="opcao-card ${sel ? 'selecionada' : ''} ${cheio || jaTem ? 'bloqueada' : ''}"
             data-tomo-truque="${m.nome}" data-tomo-truque-classes="${(m.classes || []).join(',')}"
             style="${cheio || jaTem ? 'opacity:0.35;cursor:not-allowed;' : 'cursor:pointer;'}">
          <span class="opcao-check"></span>
          <div class="opcao-nome" style="font-size:0.75rem">${m.nome}</div>
          <div class="opcao-resumo"><span style="font-size:0.6rem">${(m.classes || []).join(', ')}</span></div>
        </div>`;
    }).join('');
  }

  function renderRituaisGrid(filtroClasse) {
    let itens = todosRituais1;
    if (filtroClasse) itens = itens.filter(m => (m.classes || []).includes(filtroClasse));
    return itens.sort((a, b) => a.nome.localeCompare(b.nome)).map(m => {
      const sel = rituaisSel.find(r => r.nome === m.nome);
      const jaTem = jaPreparados.has(m.nome) && !sel;
      const cheio = rituaisSel.length >= 2 && !sel;
      return `
        <div class="opcao-card ${sel ? 'selecionada' : ''} ${cheio || jaTem ? 'bloqueada' : ''}"
             data-tomo-ritual="${m.nome}" data-tomo-ritual-classes="${(m.classes || []).join(',')}"
             style="${cheio || jaTem ? 'opacity:0.35;cursor:not-allowed;' : 'cursor:pointer;'}">
          <span class="opcao-check"></span>
          <div class="opcao-nome" style="font-size:0.75rem">${m.nome}</div>
          <div class="opcao-resumo"><span style="font-size:0.6rem">${(m.classes || []).join(', ')} | Ritual</span></div>
        </div>`;
    }).join('');
  }

  function renderConteudo() {
    const filtroTruque = document.getElementById('tomo-filtro-classe-truque')?.value || '';
    const filtroRitual = document.getElementById('tomo-filtro-classe-ritual')?.value || '';
    return `
      <div class="section-divider"><span>Truques do Livro das Sombras (${truquesSel.length}/3)</span></div>
      <div style="margin-bottom:6px">
        <select class="form-select" id="tomo-filtro-classe-truque" style="font-size:0.75rem;padding:3px 6px">
          <option value="">Todas as classes</option>
          ${classesComTruques.map(c => `<option value="${c}" ${filtroTruque === c ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
      </div>
      <div class="opcao-grid densa" id="tomo-truques-grid" style="max-height:25vh;overflow-y:auto">${renderTruquesGrid(filtroTruque)}</div>

      <div class="section-divider"><span>Rituais de 1o Circulo (${rituaisSel.length}/2)</span></div>
      <div style="margin-bottom:6px">
        <select class="form-select" id="tomo-filtro-classe-ritual" style="font-size:0.75rem;padding:3px 6px">
          <option value="">Todas as classes</option>
          ${classesComRituais.map(c => `<option value="${c}" ${filtroRitual === c ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
      </div>
      <div class="opcao-grid densa" id="tomo-rituais-grid" style="max-height:25vh;overflow-y:auto">${renderRituaisGrid(filtroRitual)}</div>
    `;
  }

  abrirModal('Livro das Sombras - Pacto do Tomo', `<div id="tomo-conteudo">${renderConteudo()}</div>`,
    '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-primary" id="btn-salvar-tomo">Salvar</button>');

  function attachTomoListeners() {
    // Filtros
    document.getElementById('tomo-filtro-classe-truque')?.addEventListener('change', () => {
      document.getElementById('tomo-conteudo').innerHTML = renderConteudo();
      attachTomoListeners();
    });
    document.getElementById('tomo-filtro-classe-ritual')?.addEventListener('change', () => {
      document.getElementById('tomo-conteudo').innerHTML = renderConteudo();
      attachTomoListeners();
    });

    // Toggle truques
    document.querySelectorAll('[data-tomo-truque]').forEach(el => {
      el.addEventListener('click', () => {
        const nome = el.dataset.tomoTruque;
        const classes = el.dataset.tomoTruqueClasses || '';
        const idx = truquesSel.findIndex(t => t.nome === nome);
        if (idx >= 0) {
          truquesSel.splice(idx, 1);
        } else {
          if (truquesSel.length >= 3) {
            toast('Limite de 3 truques do Livro das Sombras atingido.', 'error');
            return;
          }
          truquesSel.push({ nome, classe: classes.split(',')[0] || '' });
        }
        document.getElementById('tomo-conteudo').innerHTML = renderConteudo();
        attachTomoListeners();
      });
    });

    // Toggle rituais
    document.querySelectorAll('[data-tomo-ritual]').forEach(el => {
      el.addEventListener('click', () => {
        const nome = el.dataset.tomoRitual;
        const classes = el.dataset.tomoRitualClasses || '';
        const idx = rituaisSel.findIndex(r => r.nome === nome);
        if (idx >= 0) {
          rituaisSel.splice(idx, 1);
        } else {
          if (rituaisSel.length >= 2) {
            toast('Limite de 2 rituais do Livro das Sombras atingido.', 'error');
            return;
          }
          rituaisSel.push({ nome, classe: classes.split(',')[0] || '' });
        }
        document.getElementById('tomo-conteudo').innerHTML = renderConteudo();
        attachTomoListeners();
      });
    });
  }

  attachTomoListeners();

  document.getElementById('btn-salvar-tomo')?.addEventListener('click', () => {
    char.recursos.bruxo.pacto_tomo = {
      truques: [...truquesSel],
      rituais: [...rituaisSel]
    };
    salvar();
    window.fecharModal();
    renderFichaCompleta();
  });
}

// Avalia pré-requisito contra as invocações do selSet (não do char salvo)
function avaliarPrerequisitoInvocacaoBruxoComSel(prerequisito, selSet) {
  if (!prerequisito) return { ok: true, motivo: '' };
  let ok = true;
  const motivos = [];
  const texto = prerequisito;

  const nivelMatch = texto.match(/Bruxo\s*N[ií]vel\s*(\d+)/i);
  if (nivelMatch) {
    const nivelMin = parseInt(nivelMatch[1]);
    if ((char?.nivel || 1) < nivelMin) {
      ok = false;
      motivos.push(`requer nível ${nivelMin}`);
    }
  }

  // Pacto exigido: basta TER a invocação entre as selecionadas. Antes daqui
  // saía um pacto único (`PACTOS.find`), e quem levasse dois via a segunda
  // dependência recusada -- com Corrente e Lâmina, Lâmina Sedenta acusava
  // "requer Pacto da Lâmina".
  for (const pacto of PACTOS) {
    if (new RegExp(pacto, 'i').test(texto) && !selSet.has(pacto)) {
      ok = false;
      motivos.push(`requer ${pacto}`);
    }
  }

  // Invocações que requerem outra invocação (ex: Lâmina Devoradora requer Lâmina Sedenta)
  if (/Lâmina Sedenta/i.test(texto) && !selSet.has('Lâmina Sedenta')) {
    ok = false;
    motivos.push('requer Lâmina Sedenta');
  }

  return { ok, motivo: motivos.join(', ') };
}

// Renderiza a secao de Dadivas do Pacto dentro da area de magias (somente Bruxo)
export function renderSecaoPactoBruxo() {
  if (char?.classe !== 'Bruxo') return '';
  const estado = getEstadoRecursosBruxo();
  if (!estado) return '';
  // Um bloco por pacto: quem leva dois vê as dádivas dos dois.
  const pactos = estado.pactos;
  if (!pactos.length) return '';

  let html = '<details open style="margin-bottom:8px;border-left:3px solid var(--secondary);padding-left:8px">';
  html += '<summary style="font-weight:700;cursor:pointer;padding:6px 0;border-bottom:1px solid var(--border-light);color:var(--secondary)">';
  html += `Dadivas do Pacto - ${pactos.join(' + ')}`;
  html += '</summary><div style="padding-top:6px">';

  if (pactos.includes('Pacto da Corrente')) {
    html += `
      <div class="magia-item magia-dominio" data-pacto-dadivas="Pacto da Corrente" style="border-left:3px solid var(--secondary)">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <div class="magia-nome"><span class="badge-dominio">&#9733;</span> Convocar Familiar</div>
            <div style="font-size:0.7rem;color:var(--text-muted)">Conjuracao | Acao | 1 hora | 9 metros</div>
            <div style="font-size:0.65rem;color:var(--secondary);font-weight:600;margin-top:1px">Pacto da Corrente (sem gastar espaco de magia)</div>
          </div>
          <button class="btn btn-sm btn-primary" data-conjurar-pacto="Convocar Familiar">Conjurar</button>
        </div>
        <div style="font-size:0.72rem;color:var(--text-muted);margin-top:4px">
          Formas especiais: Cobra Peconhenta, Diabrete, Esfinge Maravilhosa, Esqueleto, Pseudodragao, Quasit, Slaad Girino, Sprite.
          <br>Ao executar acao Atacar, voce pode renunciar um ataque para que o familiar ataque como Reacao.
        </div>
      </div>`;
  }

  if (pactos.includes('Pacto da Lâmina')) {
    html += `
      <div class="magia-item magia-dominio" data-pacto-dadivas="Pacto da Lâmina" style="border-left:3px solid var(--secondary)">
        <div>
          <div class="magia-nome"><span class="badge-dominio">&#9733;</span> Arma de Pacto</div>
          <div style="font-size:0.65rem;color:var(--secondary);font-weight:600;margin-top:1px">Pacto da Lamina</div>
        </div>
        <div style="font-size:0.72rem;color:var(--text-muted);margin-top:4px">
          <strong>Acao Bonus:</strong> Conjurar arma Corpo a Corpo (Simples ou Marcial) ou vincular-se a uma arma magica.
          <br>Usa modificador de Carisma para ataque e dano (em vez de Forca/Destreza).
          <br>Pode causar dano Necrotico, Psiquico ou Radiante (ou o tipo normal).
          <br>Pode usar a arma como Foco de Conjuracao.
        </div>
      </div>`;
  }

  if (pactos.includes('Pacto do Tomo')) {
    const tomoData = estado.pactoTomo || { truques: [], rituais: [] };
    // Circulo do slot de pacto do Bruxo (o unico circulo onde ele tem espacos)
    const circuloPacto = Object.keys(char.espacos_magia || {}).sort((a, b) => Number(b) - Number(a))[0] || '1';
    const slotPacto = char.espacos_magia?.[circuloPacto];
    const slotEsgotado = slotPacto ? slotPacto.usados >= slotPacto.total : true;
    // Detectar conflitos: magias do Tomo que o personagem ja possui por outros meios
    const truquesConhecidos = new Set((char.magias_conhecidas || []).filter(m => m.circulo === 0).map(m => m.nome));
    const magiasPreparadas = new Set((char.magias_preparadas || []).map(m => m.nome));
    const truquesConflito = tomoData.truques.filter(t => truquesConhecidos.has(t.nome));
    const rituaisConflito = tomoData.rituais.filter(r => magiasPreparadas.has(r.nome));
    const temConflito = truquesConflito.length > 0 || rituaisConflito.length > 0;

    html += `
      <div class="magia-item magia-dominio" data-pacto-dadivas="Pacto do Tomo" style="border-left:3px solid var(--secondary)">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <div class="magia-nome"><span class="badge-dominio">&#9733;</span> Livro das Sombras</div>
            <div style="font-size:0.65rem;color:var(--secondary);font-weight:600;margin-top:1px">Pacto do Tomo</div>
          </div>
          <button class="btn btn-sm btn-secondary no-print" data-pacto-tomo-gerenciar="1">Gerenciar</button>
        </div>
        <div style="font-size:0.72rem;color:var(--text-muted);margin-top:4px">
          3 truques de qualquer classe + 2 magias de 1o circulo com marcador Ritual (de qualquer classe).
          <br>Funciona como Foco de Conjuracao. Reaparece ao final de Descanso Curto ou Longo.
        </div>
        ${temConflito ? `
          <div class="info-box warning" style="font-size:0.65rem;margin-top:6px;padding:4px 8px">
            Conflito: as magias do Livro devem ser magias que voce ainda nao tem preparadas.
            Abra "Gerenciar" para substituir: ${[...truquesConflito.map(t => t.nome), ...rituaisConflito.map(r => r.nome)].join(', ')}.
          </div>
        ` : ''}
        ${tomoData.truques.length > 0 ? `
          <div style="margin-top:6px">
            <div style="font-size:0.7rem;font-weight:700;color:var(--secondary)">Truques do Livro das Sombras:</div>
            ${tomoData.truques.map(t => {
              const conflito = truquesConhecidos.has(t.nome);
              return `
              <div class="magia-item ${conflito ? '' : ''}" data-magia-nome="${t.nome}" data-magia-circ="0" style="margin:2px 0;padding:4px 8px;border-left:2px solid ${conflito ? 'var(--danger)' : 'var(--accent)'};cursor:pointer">
                <div style="display:flex;justify-content:space-between;align-items:center">
                  <div>
                    <div class="magia-nome" style="font-size:0.8rem">${t.nome} <span style="font-size:0.6rem;color:var(--text-muted)">(${t.classe || '?'})</span>${conflito ? ' <span style="font-size:0.6rem;color:var(--danger);font-weight:700">Duplicado</span>' : ''}</div>
                    ${t.nome ? badgesMagiaRapidos(t.nome) : ''}
                  </div>
                  <button class="btn btn-sm btn-primary no-print" data-conjurar-pacto="${t.nome}" style="font-size:0.7rem;flex-shrink:0">Conjurar</button>
                </div>
                <div class="magia-desc" style="margin-top:4px;font-size:0.78rem;color:var(--text-muted)"></div>
              </div>`;
            }).join('')}
          </div>
        ` : ''}
        ${tomoData.rituais.length > 0 ? `
          <div style="margin-top:6px">
            <div style="font-size:0.7rem;font-weight:700;color:var(--secondary)">Rituais do Livro das Sombras:</div>
            ${tomoData.rituais.map(r => {
              const conflito = magiasPreparadas.has(r.nome);
              return `
              <div class="magia-item" data-magia-nome="${r.nome}" data-magia-circ="1" style="margin:2px 0;padding:4px 8px;border-left:2px solid ${conflito ? 'var(--danger)' : 'var(--accent)'};cursor:pointer">
                <div style="display:flex;justify-content:space-between;align-items:center">
                  <div>
                    <div class="magia-nome" style="font-size:0.8rem">${r.nome} <span style="font-size:0.6rem;color:var(--text-muted)">(${r.classe || '?'}) - Ritual</span>${conflito ? ' <span style="font-size:0.6rem;color:var(--danger);font-weight:700">Duplicado</span>' : ''}</div>
                    ${r.nome ? badgesMagiaRapidos(r.nome) : ''}
                  </div>
                  <div class="no-print" style="display:flex;gap:4px;flex-shrink:0">
                    <button class="btn btn-sm ${slotEsgotado ? 'btn-secondary' : 'btn-primary'}" data-conjurar="${r.nome}" data-conj-circ="${circuloPacto}" style="font-size:0.7rem" ${slotEsgotado ? 'disabled style="font-size:0.7rem;opacity:0.5;cursor:not-allowed"' : ''}>Conjurar (${circuloPacto}o)</button>
                    <button class="btn btn-sm btn-secondary" data-conjurar-pacto="${r.nome}" style="font-size:0.7rem">Ritual</button>
                  </div>
                </div>
                <div class="magia-desc" style="margin-top:4px;font-size:0.78rem;color:var(--text-muted)"></div>
              </div>`;
            }).join('')}
          </div>
        ` : ''}
      </div>`;
  }

  // Mostrar truques modificados por invocacoes (Explosao Agonizante, Repulsiva, Lanca Mistica)
  const INV_TRUQUE_DISPLAY = {
    'Explosão Agonizante': { efeito: '+modificador de Carisma ao dano', cor: 'var(--danger)' },
    'Explosão Repulsiva': { efeito: 'Empurra o alvo 3 metros para longe', cor: 'var(--accent)' },
    'Lança Mística': { efeito: 'Alcance do truque aumentado', cor: 'var(--secondary)' }
  };
  const truquesModificados = [];
  for (const inv of estado.invocacoes) {
    const nomeInv = typeof inv === 'string' ? inv : inv.nome;
    const truque = inv?.truque;
    const info = INV_TRUQUE_DISPLAY[nomeInv];
    if (info && truque) {
      truquesModificados.push({ invocacao: nomeInv, truque, ...info });
    }
  }
  if (truquesModificados.length > 0) {
    html += '<div style="margin-top:8px">';
    html += '<div style="font-size:0.7rem;font-weight:700;color:var(--secondary);margin-bottom:4px">Truques Modificados por Invocacoes:</div>';
    for (const tm of truquesModificados) {
      html += `
        <div class="magia-item" style="margin:2px 0;padding:4px 8px;border-left:3px solid ${tm.cor}">
          <div class="magia-nome" style="font-size:0.8rem">${tm.truque} <span style="font-size:0.6rem;font-weight:700;color:${tm.cor}">[${tm.invocacao}]</span></div>
          <div style="font-size:0.65rem;color:var(--text-muted)">${tm.efeito}</div>
        </div>`;
    }
    html += '</div>';
  }

  // Mostrar talentos obtidos via invocacoes (Licoes dos Grandes Antigos)
  const talentosViaInvocacao = [];
  for (const inv of estado.invocacoes) {
    const nomeInv = typeof inv === 'string' ? inv : inv.nome;
    const talento = inv?.talento;
    if (semAcento(nomeInv) === semAcento('Lições dos Grandes Antigos') && talento) {
      talentosViaInvocacao.push({ invocacao: nomeInv, talento });
    }
  }
  if (talentosViaInvocacao.length > 0) {
    html += '<div style="margin-top:8px">';
    html += '<div style="font-size:0.7rem;font-weight:700;color:var(--secondary);margin-bottom:4px">Talentos via Invocacoes:</div>';
    for (const ti of talentosViaInvocacao) {
      html += `
        <div class="magia-item" style="margin:2px 0;padding:4px 8px;border-left:3px solid var(--accent)">
          <div class="magia-nome" style="font-size:0.8rem">${ti.talento} <span style="font-size:0.6rem;color:var(--text-muted)">(Talento de Origem)</span></div>
          <div style="font-size:0.65rem;color:var(--text-muted)">${ti.invocacao}</div>
        </div>`;
    }
    html += '</div>';
  }

  // Mostrar invocacoes que concedem magias (exceto pactos)
  const invocacoesComMagia = extrairInvocacoesMagicasBruxo(estado.invocacoes);
  if (invocacoesComMagia.length > 0) {
    html += '<div style="margin-top:8px">';
    html += '<div style="font-size:0.7rem;font-weight:700;color:var(--secondary);margin-bottom:4px">Magias via Invocacoes:</div>';
    for (const inv of invocacoesComMagia) {
      const infoMagia = indiceMagiasCache?.find(m => m.nome === inv.magia);
      const circ = infoMagia?.circulo ?? 1;
      html += `
        <div class="magia-item" data-magia-nome="${inv.magia}" data-magia-circ="${circ}" style="margin:2px 0;padding:4px 8px;border-left:2px solid var(--secondary);cursor:pointer">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div>
              <div class="magia-nome" style="font-size:0.8rem">${inv.magia}</div>
              ${inv.magia ? badgesMagiaRapidos(inv.magia) : ''}
              <div style="font-size:0.6rem;color:var(--text-muted)">${inv.invocacao} (sem gastar espaco)</div>
            </div>
            <button class="btn btn-sm btn-primary no-print" data-conjurar-pacto="${inv.magia}" style="font-size:0.7rem;flex-shrink:0">Conjurar</button>
          </div>
          <div class="magia-desc" style="margin-top:4px;font-size:0.78rem;color:var(--text-muted)"></div>
        </div>`;
    }
    html += '</div>';
  }

  html += '</div></details>';
  return html;
}

// Extrai invocacoes que concedem magias sem gastar espaco de magia
function extrairInvocacoesMagicasBruxo(invocacoesSelecionadas) {
  // Mapa de invocacoes que concedem magias conhecidas (nome_invocacao -> magia_concedida)
  const MAPA_INVOCACOES_MAGIA = {
    'Armadura de Sombras': 'Armadura Arcana',
    'Mascara das Muitas Faces': 'Disfarcar-se',
    'Visoes Nebulosas': 'Imagem Silenciosa',
    'Salto Sobrenatural': 'Salto',
    'Passo Ascendente': 'Levitacao',
    'Mestre das Infindaveis Formas': 'Alterar-se',
    'Uno com as Sombras': 'Invisibilidade',
    'Presente das Profundezas': 'Respirar na Agua',
    'Visoes de Reinos Distantes': 'Olho Arcano',
    'Lamento das Sepulturas': 'Falar com Mortos',
    'Vigor Infero': 'Vitalidade Vazia'
  };
  const resultado = [];
  for (const inv of invocacoesSelecionadas) {
    // Suporta tanto string quanto objeto {nome, truque?}
    const nomeInv = typeof inv === 'string' ? inv : inv.nome;
    const invNorm = semAcento(nomeInv);
    for (const [nomeMap, magia] of Object.entries(MAPA_INVOCACOES_MAGIA)) {
      if (semAcento(nomeMap) === invNorm) {
        resultado.push({ invocacao: nomeInv, magia });
      }
    }
  }
  return resultado;
}