// ============================================================
// Versao da ficha formatada para impressao
// Extraido de site/js/pages/sheet.js sem alteracao de comportamento.
// ============================================================
import { ATRIBUTOS_KEYS, ATRIBUTOS_NOMES, CLASSES_INFO, PERICIAS } from '../dados-classes.js';
import { getMagiasPorCirculo } from '../db.js';
import { formatarCarteira, totalEmCobre } from '../moedas.js';
import { bonusProficiencia, calcAtaqueMagia, calcBonusPericia, calcCA, calcCDMagia, calcIntuicaoPassiva, calcInvestigacaoPassiva, calcMod, calcPercepcaoPassiva, escHtml, fmtMod, getDeslocamento, getTamanho, mdParaHtml, toast } from '../utils.js';
import { SUBTRACOS_ESPECIE, gerarTracoSinteticoEspecie } from './caracteristicas.js';
import { getEstadoRecursosBruxo } from './classes/bruxo.js';
import { forcaPrimordialAtiva, getAtaquesPorAcao, getDeslocamentoFinal, getModIniciativa } from './combate.js';
import { char, classeData, especiesCache, indiceMagiasCache, passivosTalentosCache, talentosCache } from './estado.js';
import { ehProficienteEmSalvaguarda } from '../regras-salvaguardas.js';
import { ehSubclasseConjuradora, normalizarMagiaPersonalizada, rotuloOrigemMagia } from './magias.js';

// ============================================================
// IMPRESSAO DE FICHA - Versao formatada para impressao
// ============================================================

/**
 * Pre-carrega descricoes de todas as magias do personagem
 * para uso no HTML de impressao.
 */
export async function carregarDescricoesMagias() {
  const cache = {};
  const todasMagias = [];

  // Truques conhecidos
  (char.magias_conhecidas || []).forEach(m => {
    if (!cache[m.nome]) todasMagias.push({ nome: m.nome, circulo: m.circulo || 0 });
  });
  // Magias preparadas
  (char.magias_preparadas || []).forEach(m => {
    if (!cache[m.nome]) todasMagias.push({ nome: m.nome, circulo: m.circulo || 1 });
  });
  // Magias customizadas (ja tem descricao inline)
  // Grimorio
  (char.grimorio || []).forEach(m => {
    if (!cache[m.nome] && !todasMagias.find(t => t.nome === m.nome)) {
      todasMagias.push({ nome: m.nome, circulo: m.circulo || 1 });
    }
  });
  // Magias do pacto do bruxo
  if (char.classe === 'Bruxo') {
    const estado = getEstadoRecursosBruxo();
    if (estado?.pactos?.includes('Pacto do Tomo')) {
      (char.recursos?.bruxo?.livro_sombras?.truques || []).forEach(nome => {
        if (!todasMagias.find(t => t.nome === nome)) todasMagias.push({ nome, circulo: 0 });
      });
      (char.recursos?.bruxo?.livro_sombras?.rituais || []).forEach(r => {
        const nome = typeof r === 'string' ? r : r.nome;
        const circ = typeof r === 'string' ? 1 : (r.circulo || 1);
        if (!todasMagias.find(t => t.nome === nome)) todasMagias.push({ nome, circulo: circ });
      });
    }
    // Magias de invocacoes
    if (estado?.invocacoes) {
      for (const inv of estado.invocacoes) {
        const nomeInv = typeof inv === 'string' ? inv : inv.nome;
        const magiasInv = inv?.magias || [];
        magiasInv.forEach(m => {
          const nome = typeof m === 'string' ? m : m.nome;
          const circ = typeof m === 'string' ? 1 : (m.circulo || 1);
          if (!todasMagias.find(t => t.nome === nome)) todasMagias.push({ nome, circulo: circ });
        });
      }
    }
  }

  // Carregar por circulo (agrupar pedidos)
  const circulosPedidos = new Set(todasMagias.map(m => m.circulo));
  const dadosPorCirculo = {};
  for (const circ of circulosPedidos) {
    const dados = await getMagiasPorCirculo(circ);
    if (dados?.magias) dadosPorCirculo[circ] = dados.magias;
  }

  // Montar cache
  todasMagias.forEach(m => {
    if (cache[m.nome]) return;
    const lista = dadosPorCirculo[m.circulo] || [];
    const magia = lista.find(x => x.nome === m.nome);
    if (magia) cache[m.nome] = magia;
  });

  return cache;
}

/**
 * Gera o HTML de uma magia expandida para impressao.
 */
function htmlMagiaImpressao(nome, circulo, cacheMagias, origemExtra) {
  const magia = cacheMagias[nome];
  const infoIdx = indiceMagiasCache?.find(m => m.nome === nome);

  let meta = '';
  let desc = '';
  let upcast = '';

  if (magia) {
    meta = [magia.escola, magia.tempo_conjuracao, magia.alcance, magia.componentes, magia.duracao]
      .filter(Boolean).join(' | ');
    desc = mdParaHtml(magia.descricao || '');
    if (magia.circulo_superior) {
      upcast = `<div class="print-spell-upcast"><strong>Circulos superiores:</strong> ${mdParaHtml(magia.circulo_superior)}</div>`;
    }
  } else if (infoIdx) {
    meta = [infoIdx.escola, infoIdx.tempo_conjuracao, infoIdx.alcance, infoIdx.duracao]
      .filter(Boolean).join(' | ');
  }

  const circLabel = circulo === 0 ? 'Truque' : `${circulo}º Círculo`;
  const origemBadge = origemExtra ? ` <span class="print-feature-badge">${origemExtra}</span>` : '';

  return `
    <div class="print-spell">
      <div class="print-spell-name">${nome} <span style="font-weight:400;font-size:7pt;color:#666">(${circLabel})</span>${origemBadge}</div>
      ${meta ? `<div class="print-spell-meta">${meta}</div>` : ''}
      ${desc ? `<div class="print-spell-desc"><div class="md-content">${desc}</div></div>` : ''}
      ${upcast}
    </div>
  `;
}

function htmlMagiaPersonalizadaImpressao(registro) {
  const magia = normalizarMagiaPersonalizada(registro);
  const meta = [magia.escola, magia.tempo_conjuracao, magia.alcance, magia.componentes, magia.duracao]
    .filter(Boolean)
    .map(escHtml)
    .join(' | ');
  const badges = [
    '<span style="font-weight:400;font-size:7pt;color:#666">(Personalizada)</span>',
    magia.ritual ? '<span style="font-weight:400;font-size:7pt;color:#666">(Ritual)</span>' : ''
  ].filter(Boolean).join(' ');
  const dano = magia.dano
    ? `<div class="print-spell-desc"><strong>Dano / efeito:</strong> ${mdParaHtml(magia.dano)}</div>`
    : '';

  return `
    <div class="print-spell">
      <div class="print-spell-name">${escHtml(magia.nome)} ${badges}</div>
      ${meta ? `<div class="print-spell-meta">${meta}</div>` : ''}
      ${magia.descricao ? `<div class="print-spell-desc"><div class="md-content">${mdParaHtml(magia.descricao)}</div></div>` : ''}
      ${dano}
    </div>`;
}

/**
 * Gera o HTML completo de impressao da ficha.
 */
export async function gerarHtmlImpressao() {
  const info = CLASSES_INFO[char.classe] || {};
  const prof = bonusProficiencia(char.nivel);
  const ca = calcCA(char, passivosTalentosCache);
  const modCon = calcMod(char.atributos.constituicao);
  const iniciativa = getModIniciativa();
  const ataquesPorAcao = getAtaquesPorAcao();

  // Dados da especie
  const _espData = especiesCache?.especies?.find(e => e.nome === char.especie);
  const _deslocamentoBase = _espData ? getDeslocamento(_espData.texto_completo) : '9 metros';
  const _deslocamento = getDeslocamentoFinal(_deslocamentoBase);
  const _tamanho = char.tamanho || (_espData ? getTamanho(_espData.texto_completo) : 'Medio');

  // Pre-carregar descricoes de magias
  const cacheMagias = await carregarDescricoesMagias();

  // ===================== PAGINA 1 =====================
  let pag1 = '';

  // --- Cabecalho ---
  // A foto (char.imagem) e um data URL gravado pelo "Trocar foto" da
  // edicao -- vai embutida no HTML, entao a folha nao depende de rede nem
  // de o arquivo original ainda existir. Sem foto, nenhum elemento e
  // emitido: uma moldura vazia so gastaria espaco da folha.
  const _foto = typeof char.imagem === 'string' && char.imagem.trim() ? char.imagem : '';
  pag1 += `
    <div class="print-char-header${_foto ? ' print-char-header-com-foto' : ''}">
      ${_foto ? `<img class="print-char-foto" src="${escHtml(_foto)}" alt="">` : ''}
      <div class="print-char-identidade">
        <div class="print-char-name">${escHtml(char.nome) || 'Sem Nome'}</div>
        <div class="print-char-sub">
          ${escHtml(char.especie || '')} ${escHtml(char.classe || '')} ${char.subclasse ? `(${escHtml(char.subclasse)})` : ''} &mdash; Nivel ${char.nivel}
          ${char.antecedente ? ` | Antecedente: ${escHtml(char.antecedente)}` : ''}
          ${char.alinhamento ? ` | ${escHtml(char.alinhamento)}` : ''}
        </div>
        <div class="print-char-sub">
          Tamanho: ${escHtml(_tamanho)}${(char.idiomas?.length) ? ' | Idiomas: ' + char.idiomas.map(escHtml).join(', ') : ''}
        </div>
      </div>
    </div>
  `;

  // --- HP ---
  pag1 += `
    <div class="print-hp-row">
      <div class="print-hp-item">
        <div class="print-hp-label">PV Atual</div>
        <div class="print-hp-value">${char.pv_atual ?? 0}</div>
      </div>
      <div class="print-hp-item">
        <div class="print-hp-label">PV Max</div>
        <div class="print-hp-value">${char.pv_max ?? 0}</div>
      </div>
      <div class="print-hp-item">
        <div class="print-hp-label">PV Temporario</div>
        <div class="print-hp-value">${char.pv_temp ?? 0}</div>
      </div>
      <div class="print-hp-item">
        <div class="print-hp-label">Dado de Vida</div>
        <div class="print-hp-value">${char.dados_vida_disponiveis ?? char.nivel}/${char.nivel} d${info.dado_vida || '?'}</div>
      </div>
    </div>
  `;

  // --- Stats de combate ---
  let statsHtml = `
    <div class="print-stat-box"><div class="print-stat-label">CA</div><div class="print-stat-value">${ca}</div></div>
    <div class="print-stat-box"><div class="print-stat-label">Iniciativa</div><div class="print-stat-value">${fmtMod(iniciativa.valor)}</div></div>
    <div class="print-stat-box"><div class="print-stat-label">Deslocamento</div><div class="print-stat-value">${_deslocamento}</div></div>
    <div class="print-stat-box"><div class="print-stat-label">Ataques</div><div class="print-stat-value">${ataquesPorAcao}</div></div>
    <div class="print-stat-box"><div class="print-stat-label">Proficiencia</div><div class="print-stat-value">+${prof}</div></div>
  `;
  // Mesmo portão da ficha (sheet/ficha.js): conjurador de subclasse
  // também tem CD e ataque de magia.
  if (info.conjurador || ehSubclasseConjuradora()) {
    statsHtml += `
      <div class="print-stat-box"><div class="print-stat-label">CD Magia</div><div class="print-stat-value">${calcCDMagia(char)}</div></div>
      <div class="print-stat-box"><div class="print-stat-label">Atq Magia</div><div class="print-stat-value">${fmtMod(calcAtaqueMagia(char))}</div></div>
    `;
  }
  pag1 += `<div class="print-stats-row">${statsHtml}</div>`;

  // --- Proficiencias de Armaduras e Armas ---
  {
    const extras = (char.proficiencias_extra || []).map(p => p.toLowerCase());
    const armadurasProf = [...(info.armaduras || [])];
    const armasProf = [...(info.armas || [])];
    const armadurasExtras = [];
    const armasExtras = [];
    for (const extra of extras) {
      if (extra === 'armadura pesada' && !armadurasProf.includes('Pesada')) { armadurasProf.push('Pesada'); armadurasExtras.push('Pesada'); }
      else if ((extra === 'armadura média' || extra === 'armadura media') && !armadurasProf.includes('Média')) { armadurasProf.push('Média'); armadurasExtras.push('Média'); }
      else if (extra === 'armadura leve' && !armadurasProf.includes('Leve')) { armadurasProf.push('Leve'); armadurasExtras.push('Leve'); }
      else if (extra === 'escudo' && !armadurasProf.includes('Escudo')) { armadurasProf.push('Escudo'); armadurasExtras.push('Escudo'); }
      else if (extra === 'armas marciais' && !armasProf.includes('Marcial')) { armasProf.push('Marcial'); armasExtras.push('Marcial'); }
      else if (extra === 'armas simples' && !armasProf.includes('Simples')) { armasProf.push('Simples'); armasExtras.push('Simples'); }
    }
    pag1 += `
      <div class="print-prof-row">
        <div class="print-prof-group">
          <span class="print-prof-label">Armaduras:</span>
          ${armadurasProf.length > 0
            ? armadurasProf.map(a => `<span class="print-prof-badge print-prof-armadura${armadurasExtras.includes(a) ? ' print-prof-extra' : ''}">${a}${armadurasExtras.includes(a) ? '*' : ''}</span>`).join('')
            : '<span class="print-prof-badge print-prof-nenhuma">Nenhuma</span>'
          }
        </div>
        <div class="print-prof-group">
          <span class="print-prof-label">Armas:</span>
          ${armasProf.map(a => `<span class="print-prof-badge print-prof-arma${armasExtras.includes(a) ? ' print-prof-extra' : ''}">${a}${armasExtras.includes(a) ? '*' : ''}</span>`).join('')}
        </div>
        ${armadurasExtras.length > 0 || armasExtras.length > 0 ? '<div class="print-prof-nota">* Concedida por subclasse/talento</div>' : ''}
      </div>
    `;
  }

  // --- Atributos ---
  pag1 += `
    <div class="print-section">
      <div class="print-section-title">Atributos</div>
      <div class="print-attr-grid">
        ${ATRIBUTOS_KEYS.map(key => {
          const nome = ATRIBUTOS_NOMES[key];
          const val = char.atributos[key];
          const mod = calcMod(val);
          return `
            <div class="print-attr-box">
              <div class="print-attr-name">${nome}</div>
              <div class="print-attr-mod">${fmtMod(mod)}</div>
              <div class="print-attr-val">${val}</div>
            </div>`;
        }).join('')}
      </div>
    </div>
  `;

  // --- Salvaguardas ---
  pag1 += `
    <div class="print-section">
      <div class="print-section-title">Salvaguardas</div>
      <div class="print-saves-grid">
        ${ATRIBUTOS_KEYS.map(key => {
          const nome = ATRIBUTOS_NOMES[key];
          const mod = calcMod(char.atributos[key]);
          // Mesma fonte única da ficha (sheet/ficha.js).
          const proficiente = ehProficienteEmSalvaguarda(char, nome);
          const bonus = mod + (proficiente ? prof : 0);
          return `
            <div class="print-save-item">
              <div class="print-save-prof ${proficiente ? 'ativo' : ''}"></div>
              <span class="print-save-bonus">${fmtMod(bonus)}</span>
              <span>${nome}</span>
            </div>`;
        }).join('')}
      </div>
    </div>
  `;

  // --- Sentidos passivos ---
  const percepcao = calcPercepcaoPassiva(char);
  const intuicao = calcIntuicaoPassiva(char);
  const investigacao = calcInvestigacaoPassiva(char);
  let visaoEscuro = '';
  if (especiesCache?.especies) {
    const esp = especiesCache.especies.find(e => e.nome === char.especie);
    if (esp?.tracos) {
      const tracoVE = esp.tracos.find(t => t.nome === 'Visao no Escuro' || t.nome === 'Visão no Escuro');
      if (tracoVE) {
        const matchAlc = tracoVE.descricao?.match(/alcance de (\d+)/i);
        visaoEscuro = matchAlc ? `${matchAlc[1]} m` : '18 m';
      }
      if ((char.tracos_escolhidos || []).includes('Drow')) visaoEscuro = '36 m';
    }
  }
  pag1 += `
    <div class="print-section">
      <div class="print-section-title">Sentidos Passivos</div>
      <div class="print-senses-grid">
        <div class="print-sense-item"><div class="print-sense-value">${percepcao}</div><div class="print-sense-label">Percepcao</div></div>
        <div class="print-sense-item"><div class="print-sense-value">${intuicao}</div><div class="print-sense-label">Intuicao</div></div>
        <div class="print-sense-item"><div class="print-sense-value">${investigacao}</div><div class="print-sense-label">Investigacao</div></div>
        ${visaoEscuro ? `<div class="print-sense-item"><div class="print-sense-value">${visaoEscuro}</div><div class="print-sense-label">Visao no Escuro</div></div>` : ''}
      </div>
    </div>
  `;

  // --- Defesas ---
  const resistencias = [...(char.resistencias || [])];
  const vulnerabilidades = char.vulnerabilidades || [];
  const imunidades = char.imunidades || [];
  if (resistencias.length > 0 || vulnerabilidades.length > 0 || imunidades.length > 0) {
    pag1 += `<div class="print-section"><div class="print-section-title">Defesas</div><div class="print-defenses">`;
    if (resistencias.length > 0) pag1 += `<div><strong>Resistencias:</strong> ${resistencias.join(', ')}</div>`;
    if (vulnerabilidades.length > 0) pag1 += `<div><strong>Vulnerabilidades:</strong> ${vulnerabilidades.join(', ')}</div>`;
    if (imunidades.length > 0) pag1 += `<div><strong>Imunidades:</strong> ${imunidades.join(', ')}</div>`;
    pag1 += `</div></div>`;
  }

  // --- Pericias ---
  const ordemAtributos = ['Forca', 'Destreza', 'Constituicao', 'Inteligencia', 'Sabedoria', 'Carisma'];
  pag1 += `
    <div class="print-section">
      <div class="print-section-title">Pericias</div>
      <div class="print-skills-grid">
        ${['Percepção','Intuição','Investigação','Religião','História','Prestidigitação','Furtividade','Persuasão','Atletismo','Medicina','Acrobacia','Enganação','Arcanismo','Sobrevivência','Natureza','Atuação','Intimidação','Lidar com Animais'].map(nome => {
          const p = PERICIAS.find(x => x.nome === nome);
          if (!p) return '';
          const proficiente = (char.pericias_proficientes || []).includes(p.nome);
          const expertise = (char.pericias_expertise || []).includes(p.nome);
          const bonus = calcBonusPericia(char, p.nome, {
            emFuria: false,
            forcaPrimordialAtiva: false
          });
          let profClass = '';
          if (expertise) profClass = 'expertise';
          else if (proficiente) profClass = 'ativo';
          return `
            <div class="print-skill-item">
              <div class="print-skill-prof ${profClass}"></div>
              <span class="print-skill-bonus">${fmtMod(bonus)}</span>
              <span class="print-skill-name">${p.nome}</span>
            </div>`;
        }).join('')}
      </div>
    </div>
  `;

  // --- Itens equipados ---
  const inv = char.inventario || [];
  const equipados = inv.filter(i => i.equipado && (i.quantidade ?? 1) > 0);
  if (equipados.length > 0) {
    pag1 += `<div class="print-section"><div class="print-section-title">Equipamento</div><div class="print-equip-list">`;
    equipados.forEach(item => {
      let detalhe = '';
      if (item.tipo === 'arma') {
        const props = item.dados?.propriedades || '';
        const dano = item.dados?.dano || '';
        detalhe = [dano, props].filter(Boolean).join(' | ');
      } else if (item.tipo === 'armadura') {
        detalhe = `CA: ${item.dados?.ca || '?'} | ${item.dados?.categoria || ''}`;
      } else if (item.tipo === 'escudo') {
        detalhe = `CA: ${item.dados?.ca || '?'}`;
      } else if (item.tipo === 'customizado') {
        const bca = parseInt(item.dados?.bonus_ca) || 0;
        const batq = parseInt(item.dados?.bonus_ataque) || 0;
        const caBaseItem = parseInt(item.dados?.ca_base) || 0;
        const parts = [];
        // CA que o item DEFINE vem antes do bonus que ele soma -- e o que a
        // ficha na tela mostra, na mesma ordem (sheet/inventario.js).
        if (caBaseItem > 0) parts.push(`CA ${caBaseItem}`);
        if (bca !== 0) parts.push(`CA ${bca > 0 ? '+' : ''}${bca}`);
        if (batq !== 0) parts.push(`Atq ${batq > 0 ? '+' : ''}${batq}`);
        if (item.dados?.dano) parts.push(item.dados.dano);
        detalhe = parts.join(' | ') || (item.descricao || '');
      }
      const qtd = (item.quantidade ?? 1) > 1 ? ` x${item.quantidade}` : '';
      pag1 += `
        <div class="print-equip-item">
          <span class="print-equip-name">${escHtml(item.nome)}${qtd}</span>
          <span class="print-equip-detail">${detalhe}</span>
        </div>`;
    });
    pag1 += `</div></div>`;
  }

  // ===================== PAGINA 2+ (Talentos, Caracteristicas, Tracos) =====================
  let pag2 = '';

  // --- Talentos ---
  if (char.talentos?.length) {
    const todosOsTalentos = [];
    if (talentosCache?.por_categoria) {
      Object.values(talentosCache.por_categoria).forEach(lista => lista.forEach(t => todosOsTalentos.push(t)));
    }

    pag2 += `<div class="print-section"><div class="print-section-title">Talentos</div>`;
    char.talentos.forEach((t, tIdx) => {
      const nome = typeof t === 'string' ? t : t.nome;
      let talentoData = todosOsTalentos.find(td => td.nome === nome);
      if (!talentoData) {
        const nomeBase = nome.replace(/\s*\(.*\)$/, '').trim();
        talentoData = todosOsTalentos.find(td => td.nome === nomeBase);
      }
      const descricao = talentoData?.descricao || '';
      const beneficios = talentoData?.beneficios || [];
      const catBadge = talentoData?.categoria ? `<span class="print-feature-badge">${talentoData.categoria}</span>` : '';

      // Entradas podem vir com sufixo de lista do antecedente, ex. "Iniciado em Magia (Clérigo)"
      const _ehIMPrint = (n) => n.replace(/\s*\(.*\)$/, '').trim() === 'Iniciado em Magia';
      let infoEscolhas = '';
      if (_ehIMPrint(nome)) {
        const instancias = char.iniciado_em_magia_instancias || [];
        // Cada entrada "Iniciado em Magia" em char.talentos corresponde a UMA instância,
        // pela posição ordinal entre as entradas com esse nome (evita listar todas em cada uma)
        const ordinal = char.talentos.slice(0, tIdx).filter(x => _ehIMPrint(typeof x === 'string' ? x : x.nome || '')).length;
        const im = instancias[ordinal];
        if (im) {
          infoEscolhas = `<div style="margin-top:1mm;font-size:7.5pt;border:0.5px solid #ccc;padding:1mm 2mm;border-radius:2px">
            <strong>Lista:</strong> ${im.lista} | <strong>Atributo:</strong> ${ATRIBUTOS_NOMES[im.atributo] || im.atributo || '—'}
            | <strong>Truques:</strong> ${(im.truques || []).join(', ') || '—'}
            | <strong>Magia:</strong> ${im.magia || '—'}
          </div>`;
        }
      }
      if (nome === 'Adepto Elemental') {
        const tipos = char.adepto_elemental_tipos || [];
        if (tipos.length > 0) {
          infoEscolhas = `<div style="margin-top:1mm;font-size:7.5pt"><strong>Dominio Elemental:</strong> ${tipos.join(', ')}</div>`;
        }
      }

      pag2 += `
        <div class="print-feature">
          <div class="print-feature-name">${nome} ${catBadge}</div>
          ${descricao ? `<div class="print-feature-desc"><div class="md-content">${mdParaHtml(descricao)}</div></div>` : ''}
          ${beneficios.length > 0 ? beneficios.map(b =>
            `<div class="print-feature-desc"><strong>${b.nome}:</strong> ${mdParaHtml(b.descricao)}</div>`
          ).join('') : ''}
          ${infoEscolhas}
        </div>`;
    });
    pag2 += `</div>`;
  }

  // --- Caracteristicas de Classe ---
  if (classeData?.caracteristicas?.length) {
    let feats = classeData.caracteristicas.filter(c => c.nivel <= char.nivel);

    // Filtrar features de subclasses nao selecionadas
    if (classeData.subclasses?.length) {
      const outrasSubclasses = classeData.subclasses.filter(s => s.nome !== char.subclasse);
      const featsOutras = new Set();
      outrasSubclasses.forEach(sc => (sc.caracteristicas || []).forEach(f => featsOutras.add(f.nome)));
      const featsSelecionada = new Set();
      if (char.subclasse) {
        const scAtual = classeData.subclasses.find(s => s.nome === char.subclasse);
        (scAtual?.caracteristicas || []).forEach(f => featsSelecionada.add(f.nome));
      }
      feats = feats.filter(f => !featsOutras.has(f.nome) || featsSelecionada.has(f.nome));
      if (char.subclasse) {
        const scAtual = classeData.subclasses.find(s => s.nome === char.subclasse);
        const featsSC = new Set((scAtual?.caracteristicas || []).filter(c => c.nivel <= char.nivel).map(c => `${c.nivel}|${c.nome}`));
        feats = feats.filter(f => !featsSC.has(`${f.nivel}|${f.nome}`));
      }
    }

    if (feats.length > 0) {
      pag2 += `<div class="print-section"><div class="print-section-title">Caracteristicas de Classe</div>`;
      feats.forEach(f => {
        // Para Ordem Divina/Primal, exibir somente a opcao selecionada
        let descPrint = f.descricao || '';
        if (f.nome === 'Ordem Divina' || f.nome === 'Ordem Primal') {
          const _chvOrd = f.nome === 'Ordem Divina' ? 'ordem_divina' : 'ordem_primal';
          const _ordEsc = char[_chvOrd] || char.escolhas_classe?.[_chvOrd]?.[0] || '';
          if (_ordEsc) {
            const _rxOrd = new RegExp(`\\*\\*${_ordEsc}\\.\\*\\*\\s*(.+?)(?=\\n\\*\\*|$)`, 's');
            const _mOrd = descPrint.match(_rxOrd);
            descPrint = _mOrd ? `**${_ordEsc}.** ${_mOrd[1].trim()}` : descPrint;
          }
        }
        pag2 += `
          <div class="print-feature">
            <div class="print-feature-name">${f.nome} <span style="font-weight:400;font-size:7pt;color:#666">(Nivel ${f.nivel})</span></div>
            ${descPrint ? `<div class="print-feature-desc"><div class="md-content">${mdParaHtml(descPrint)}</div></div>` : ''}
          </div>`;
      });
      pag2 += `</div>`;
    }
  }

  // --- Caracteristicas de Subclasse ---
  if (char.subclasse && classeData?.subclasses?.length) {
    const sc = classeData.subclasses.find(s => s.nome === char.subclasse);
    const feats = sc?.caracteristicas?.filter(c => c.nivel <= char.nivel) || [];
    if (feats.length > 0) {
      pag2 += `<div class="print-section"><div class="print-section-title">Subclasse &mdash; ${escHtml(char.subclasse)}</div>`;
      feats.forEach(f => {
        pag2 += `
          <div class="print-feature">
            <div class="print-feature-name">${f.nome} <span style="font-weight:400;font-size:7pt;color:#666">(Nivel ${f.nivel})</span></div>
            ${f.descricao ? `<div class="print-feature-desc"><div class="md-content">${mdParaHtml(f.descricao)}</div></div>` : ''}
          </div>`;
      });
      pag2 += `</div>`;
    }
  }

  // --- Tracos de Especie (usa multi-colunas para aproveitar espaco) ---
  if (_espData?.tracos?.length) {
    const tracosEscolhidos = char.tracos_escolhidos || [];
    let tracosMostrar = [..._espData.tracos];

    // Mesma logica de filtragem da ficha (renderSecaoTracosEspecie)
    const _TRACOS_PAI_PRINT = ['Ancestralidade Gigante', 'Linhagem Gnômica', 'Herança Dracônica', 'Linhagem Élfica', 'Legado Ínfero'];
    const _TRACOS_ESCOLHA_GOLIAS_PRINT = ['Arrepio do Gelo (Gigante do Gelo)', 'Queimadura de Fogo (Gigante de Fogo)', 'Resistência da Pedra (Gigante da Pedra)', 'Salto da Nuvem (Gigante das Nuvens)', 'Tombo da Colina (Gigante da Colina)', 'Trovão da Tempestade (Gigante da Tempestade)'];
    const _TRACOS_ESCOLHA_GNOMO_PRINT = ['Gnomo das Rochas', 'Gnomo do Bosque'];

    if (tracosEscolhidos.length > 0) {
      tracosMostrar = _espData.tracos.filter(t => {
        // Remover tracos-pai (sao substituidos pelo traco sintetico ou pela escolha)
        if (_TRACOS_PAI_PRINT.includes(t.nome)) return false;
        // Golias/Gnomo: manter apenas o traco escolhido
        if (_TRACOS_ESCOLHA_GOLIAS_PRINT.includes(t.nome) || _TRACOS_ESCOLHA_GNOMO_PRINT.includes(t.nome)) {
          return tracosEscolhidos.includes(t.nome);
        }
        return true;
      });

      // Filtrar sub-tracos nao escolhidos (Tiferino, Elfo, Draconato)
      if (SUBTRACOS_ESPECIE[char.especie]) {
        const opcoes = SUBTRACOS_ESPECIE[char.especie];
        const escolhido = tracosEscolhidos.find(e => opcoes[e]);
        if (escolhido) {
          const naoEscolhidos = Object.keys(opcoes).filter(k => k !== escolhido);
          tracosMostrar = tracosMostrar.filter(t => !naoEscolhidos.some(ne => t.nome.includes(ne)));
        }
      }

      // Adicionar tracos sinteticos para especies com opcoes (Tiferino, Elfo, Draconato)
      const tracosSinteticos = gerarTracoSinteticoEspecie(char.especie, tracosEscolhidos, char.nivel) || [];
      tracosMostrar.push(...tracosSinteticos);
    }

    // Filtrar por nivel
    tracosMostrar = tracosMostrar.filter(t => {
      if (typeof t.nivel_minimo === 'number' && char.nivel < t.nivel_minimo) return false;
      const match = t.descricao?.match(/(?:a partir do |no )n[ií]vel (\d+)/i);
      if (match) return char.nivel >= parseInt(match[1]);
      return true;
    });

    if (tracosMostrar.length > 0) {
      pag2 += `<div class="print-section"><div class="print-section-title">Tracos de Especie &mdash; ${escHtml(char.especie)}</div><div class="print-multi-col">`;
      tracosMostrar.forEach(t => {
        pag2 += `
          <div class="print-feature">
            <div class="print-feature-name">${t.nome}</div>
            ${t.descricao ? `<div class="print-feature-desc"><div class="md-content">${mdParaHtml(t.descricao)}</div></div>` : ''}
          </div>`;
      });
      pag2 += `</div></div>`;
    }
  }

  // ===================== PAGINAS DE MAGIAS =====================
  let pagMagias = '';
  const temMagias = info.conjurador || ehSubclasseConjuradora() || (char.magias_conhecidas?.length > 0) || (char.magias_preparadas?.length > 0) || (char.magias_customizadas?.length > 0);

  if (temMagias) {
    // Espacos de magia
    const espacos = char.espacos_magia || {};
    if (Object.keys(espacos).length > 0) {
      pagMagias += `<div class="print-section"><div class="print-section-title">Espacos de Magia</div>`;
      pagMagias += `<div style="display:flex;gap:4mm;flex-wrap:wrap;margin-bottom:2mm">`;
      Object.entries(espacos).forEach(([circ, data]) => {
        const restantes = data.total - (data.usados || 0);
        pagMagias += `<div style="text-align:center"><div style="font-weight:700;font-size:10pt">${restantes}/${data.total}</div><div style="font-size:6.5pt;color:#666">${circ}º Círculo</div></div>`;
      });
      pagMagias += `</div></div>`;
    }

    // Bruxo: slots de pacto
    if (char.classe === 'Bruxo') {
      const estadoBruxo = getEstadoRecursosBruxo();
      if (estadoBruxo) {
        const slotsBruxo = estadoBruxo.slotsTotal || 0;
        const usadosBruxo = char.bruxo_slots_usados || 0;
        const restBruxo = slotsBruxo - usadosBruxo;
        const circBruxo = estadoBruxo.slotsCirculo || 1;
        pagMagias += `<div style="font-size:8pt;margin-bottom:2mm"><strong>Espaços de Pacto:</strong> ${restBruxo}/${slotsBruxo} (${circBruxo}º Círculo)</div>`;
      }
    }

    // Truques - usar layout em colunas para melhor aproveitamento
    const todosTruques = (char.magias_conhecidas || []).filter(m => m.circulo === 0);
    const truquesPersonalizados = (char.magias_customizadas || [])
      .map(normalizarMagiaPersonalizada)
      .filter(m => m.circulo === 0);
    if (todosTruques.length > 0 || truquesPersonalizados.length > 0) {
      pagMagias += `<div class="print-section"><div class="print-section-title">Truques</div><div class="print-multi-col">`;
      todosTruques.forEach(m => {
        const origem = rotuloOrigemMagia(m);
        pagMagias += htmlMagiaImpressao(m.nome, 0, cacheMagias, origem);
      });
      truquesPersonalizados.forEach(m => {
        pagMagias += htmlMagiaPersonalizadaImpressao(m);
      });
      pagMagias += `</div></div>`;
    }

    // Magias do Pacto do Tomo (Bruxo)
    if (char.classe === 'Bruxo') {
      const estado = getEstadoRecursosBruxo();
      if (estado?.pactos?.includes('Pacto do Tomo')) {
        const truquesPacto = char.recursos?.bruxo?.livro_sombras?.truques || [];
        const rituaisPacto = char.recursos?.bruxo?.livro_sombras?.rituais || [];

        if (truquesPacto.length > 0) {
          pagMagias += `<div class="print-section"><div class="print-section-title">Livro das Sombras - Truques</div><div class="print-multi-col">`;
          truquesPacto.forEach(nome => {
            pagMagias += htmlMagiaImpressao(nome, 0, cacheMagias, 'Livro das Sombras');
          });
          pagMagias += `</div></div>`;
        }

        if (rituaisPacto.length > 0) {
          pagMagias += `<div class="print-section"><div class="print-section-title">Livro das Sombras - Rituais</div><div class="print-multi-col">`;
          rituaisPacto.forEach(r => {
            const nome = typeof r === 'string' ? r : r.nome;
            const circ = typeof r === 'string' ? 1 : (r.circulo || 1);
            pagMagias += htmlMagiaImpressao(nome, circ, cacheMagias, 'Ritual');
          });
          pagMagias += `</div></div>`;
        }
      }
    }

    // Magias preparadas por circulo
    const preparadas = char.magias_preparadas || [];
    const preparadasPorCirculo = {};
    preparadas.forEach(m => {
      const circ = m.circulo || 1;
      if (!preparadasPorCirculo[circ]) preparadasPorCirculo[circ] = [];
      preparadasPorCirculo[circ].push(m);
    });
    (char.magias_customizadas || []).map(normalizarMagiaPersonalizada)
      .filter(m => m.circulo > 0)
      .forEach(m => {
        if (!preparadasPorCirculo[m.circulo]) preparadasPorCirculo[m.circulo] = [];
        preparadasPorCirculo[m.circulo].push(m);
      });

    Object.keys(preparadasPorCirculo).sort((a, b) => parseInt(a) - parseInt(b)).forEach(circ => {
      const magias = preparadasPorCirculo[circ].slice().sort((a, b) => {
        const personalizadaA = Boolean(a.personalizada);
        const personalizadaB = Boolean(b.personalizada);
        return Number(personalizadaA) - Number(personalizadaB) || String(a.nome).localeCompare(String(b.nome), 'pt-BR');
      });
      pagMagias += `<div class="print-section"><div class="print-section-title">${circ}º Círculo (${magias.length} magias)</div><div class="print-multi-col">`;
      magias.forEach(m => {
        if (m.personalizada) {
          pagMagias += htmlMagiaPersonalizadaImpressao(m);
          return;
        }
        const origem = rotuloOrigemMagia(m);
        pagMagias += htmlMagiaImpressao(m.nome, parseInt(circ), cacheMagias, origem);
      });
      pagMagias += `</div></div>`;
    });

    // As magias personalizadas já foram renderizadas no seu círculo correspondente.
    const customizadas = char.magias_customizadas || [];
    if (false && customizadas.length > 0) {
      pagMagias += `<div class="print-section"><div class="print-section-title">Magias Customizadas</div><div class="print-multi-col">`;
      customizadas.forEach(m => {
        const circLabel = m.circulo === 0 ? 'Truque' : `${m.circulo}º Círculo`;
        pagMagias += `
          <div class="print-spell">
            <div class="print-spell-name">${m.nome} <span style="font-weight:400;font-size:7pt;color:#666">(${circLabel})</span></div>
            ${m.escola ? `<div class="print-spell-meta">${m.escola}${m.tempo_conjuracao ? ' | ' + m.tempo_conjuracao : ''}${m.alcance ? ' | ' + m.alcance : ''}${m.duracao ? ' | ' + m.duracao : ''}</div>` : ''}
            <div class="print-spell-desc"><div class="md-content">${mdParaHtml(m.descricao || '')}</div></div>
          </div>`;
      });
      pagMagias += `</div></div>`;
    }
  }

  // ===================== ULTIMAS PAGINAS (Inventario + Detalhes) =====================
  let pagFinal = '';

  // --- Inventario (itens NAO equipados) ---
  const naoEquipados = inv.filter(i => !i.equipado && (i.quantidade ?? 1) > 0);
  if (naoEquipados.length > 0 || totalEmCobre(char.moedas) > 0) {
    pagFinal += `<div class="print-section"><div class="print-section-title">Inventario (Mochila)</div>`;
    if (totalEmCobre(char.moedas) > 0) {
      pagFinal += `<div style="font-size:8.5pt;font-weight:700;margin-bottom:1mm">Moedas: ${formatarCarteira(char.moedas)}</div>`;
    }
    naoEquipados.forEach(item => {
      let detalhe = '';
      if (item.tipo === 'arma') detalhe = [item.dados?.dano, item.dados?.propriedades].filter(Boolean).join(' | ');
      else if (item.tipo === 'armadura') detalhe = `CA: ${item.dados?.ca || '?'} | ${item.dados?.categoria || ''}`;
      else if (item.tipo === 'escudo') detalhe = `CA: ${item.dados?.ca || '?'}`;
      else if (item.tipo === 'equipamento') detalhe = [item.dados?.custo, item.dados?.peso].filter(Boolean).join(' | ');
      else if (item.tipo === 'customizado') detalhe = item.descricao || '';
      else detalhe = item.descricao || '';
      const qtd = (item.quantidade ?? 1) > 1 ? ` (x${item.quantidade})` : '';
      pagFinal += `
        <div class="print-inv-item">
          <span class="print-inv-name">${escHtml(item.nome)}${qtd}</span>
          <span class="print-inv-detail">${detalhe}</span>
        </div>`;
    });
    pagFinal += `</div>`;
  }

  // --- Detalhes pessoais ---
  const camposDetalhe = [
    { key: 'aparencia', label: 'Aparencia' },
    { key: 'personalidade', label: 'Personalidade' },
    { key: 'ideais', label: 'Ideais' },
    { key: 'lacos', label: 'Lacos' },
    { key: 'defeitos', label: 'Defeitos' },
    { key: 'historia_personagem', label: 'Historia' },
    { key: 'notas', label: 'Notas' }
  ];
  const camposPreenchidos = camposDetalhe.filter(c => char[c.key]);
  if (camposPreenchidos.length > 0) {
    pagFinal += `<div class="print-section"><div class="print-section-title">Detalhes</div>`;
    camposPreenchidos.forEach(c => {
      pagFinal += `
        <div class="print-detail-field">
          <div class="print-detail-label">${c.label}</div>
          <div class="print-detail-value">${escHtml(char[c.key])}</div>
        </div>`;
    });
    pagFinal += `</div>`;
  }

  // ===================== MONTAR PAGINAS =====================
  // Pagina 1 sempre sozinha
  let html = `<div class="print-page">${pag1}</div>`;

  // Magias vem antes de talentos/caracteristicas para referencia rapida
  if (pagMagias) {
    html += `<div class="print-page">${pagMagias}</div>`;
  }

  // Talentos, caracteristicas, tracos de especie
  if (pag2) {
    html += `<div class="print-page">${pag2}</div>`;
  }

  // Paginas finais: inventario + detalhes
  if (pagFinal) {
    html += `<div class="print-page">${pagFinal}</div>`;
  }

  return html;
}

/**
 * Prepara e executa a impressao da ficha de personagem.
 * Gera um overlay dedicado com layout otimizado para impressao.
 */
let _printOverlayAtivo = false;
async function imprimirFicha() {
  // Evitar dupla invocacao
  if (_printOverlayAtivo) {
    // Se o overlay anterior ficou preso, limpar e continuar
    const velho = document.getElementById('print-overlay');
    if (velho) velho.remove();
    _printOverlayAtivo = false;
  }

  toast('Preparando impressao...', 'info');

  try {
    const html = await gerarHtmlImpressao();

    // Criar overlay de impressao
    const overlay = document.createElement('div');
    overlay.id = 'print-overlay';
    overlay.innerHTML = html;
    document.body.appendChild(overlay);
    _printOverlayAtivo = true;

    // Funcao de limpeza reutilizavel
    const limparOverlay = () => {
      const el = document.getElementById('print-overlay');
      if (el) el.remove();
      _printOverlayAtivo = false;
      // Remover listeners para evitar acumulo
      window.removeEventListener('afterprint', limparOverlay);
    };

    // Registrar cleanup ANTES de chamar window.print()
    window.addEventListener('afterprint', limparOverlay);

    // Imprimir imediatamente (sem setTimeout/delay): mobile (iOS Safari, Android
    // Chrome) exige window.print() disparado de forma sincrona dentro do gesto
    // de clique, senao o navegador bloqueia o print automatico silenciosamente.
    window.print();

    // Fallback: se afterprint nao disparar em 5s, limpar manualmente
    setTimeout(() => {
      if (_printOverlayAtivo) limparOverlay();
    }, 5000);
  } catch (err) {
    console.error('Erro ao preparar impressao:', err);
    toast('Erro ao preparar impressao', 'danger');
    // Limpar overlay em caso de erro
    const el = document.getElementById('print-overlay');
    if (el) el.remove();
    _printOverlayAtivo = false;
  }
}

/**
 * Detecta se o app esta rodando instalado (standalone/tela de inicio).
 * iOS e Android nesse modo nao suportam window.print() de forma confiavel
 * (WKWebView do iOS em standalone simplesmente ignora a chamada).
 */
function isStandaloneApp() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}
