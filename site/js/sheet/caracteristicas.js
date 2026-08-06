// ============================================================
// Caracteristicas de classe, subclasse e tracos de especie
// Extraido de site/js/pages/sheet.js sem alteracao de comportamento.
// ============================================================
import { bonusProficiencia, calcMod, detectarRecarga, ehHabilidadeAtiva, escHtml, mdParaHtml } from '../utils.js';
import { char, classeData, especiesCache } from './estado.js';
import { detectarUsosMaximos, renderFeatureItem } from './habilidades.js';

export function renderSecaoCaracteristicas() {
  if (!classeData?.caracteristicas?.length) return '';
  let feats = classeData.caracteristicas.filter(c => c.nivel <= char.nivel);
  if (!feats.length) return '';

  // Filtrar features de subclasses não selecionadas (evitar duplicatas)
  if (classeData.subclasses?.length) {
    const outrasSubclasses = classeData.subclasses.filter(s => s.nome !== char.subclasse);
    const featsOutras = new Set();
    outrasSubclasses.forEach(sc => {
      (sc.caracteristicas || []).forEach(f => featsOutras.add(f.nome));
    });
    // Manter somente features que não pertencem exclusivamente a outra subclasse
    const featsSelecionada = new Set();
    if (char.subclasse) {
      const scAtual = classeData.subclasses.find(s => s.nome === char.subclasse);
      (scAtual?.caracteristicas || []).forEach(f => featsSelecionada.add(f.nome));
    }
    feats = feats.filter(f => !featsOutras.has(f.nome) || featsSelecionada.has(f.nome));

    // Evita duplicidade com seção de subclasse ativa
    if (char.subclasse) {
      const scAtual = classeData.subclasses.find(s => s.nome === char.subclasse);
      const featsSC = new Set((scAtual?.caracteristicas || []).filter(c => c.nivel <= char.nivel).map(c => `${c.nivel}|${c.nome}`));
      feats = feats.filter(f => !featsSC.has(`${f.nivel}|${f.nome}`));
    }
  }

  const passivas = feats.filter(f => !ehHabilidadeAtiva(f.descricao, f.nome));
  const ativas = feats.filter(f => ehHabilidadeAtiva(f.descricao, f.nome));

  return `
    <div class="card print-break-before">
      <div class="card-header"><h2>Características de Classe</h2></div>
      ${ativas.length > 0 ? `
        <div class="section-divider"><span>Habilidades Ativas</span></div>
        ${ativas.map(f => renderFeatureItem(f, 'classe')).join('')}
      ` : ''}
      ${passivas.length > 0 ? `
        <div class="section-divider"><span>Habilidades Passivas</span></div>
        ${passivas.map(f => renderFeatureItem(f, 'classe')).join('')}
      ` : ''}
    </div>
  `;
}

// --- Subclasse ---

export function renderSecaoSubclasse() {
  if (!char.subclasse || !classeData?.subclasses?.length) return '';
  const sc = classeData.subclasses.find(s => s.nome === char.subclasse);
  if (!sc?.caracteristicas?.length) return '';
  const feats = sc.caracteristicas.filter(c => c.nivel <= char.nivel);
  if (!feats.length) return '';

  const passivas = feats.filter(f => !ehHabilidadeAtiva(f.descricao, f.nome));
  const ativas = feats.filter(f => ehHabilidadeAtiva(f.descricao, f.nome));

  return `
    <div class="card print-break-before">
      <div class="card-header"><h2>Subclasse — ${escHtml(char.subclasse)}</h2></div>
      ${ativas.length > 0 ? `
        <div class="section-divider"><span>Habilidades Ativas</span></div>
        ${ativas.map(f => renderFeatureItem(f, 'subclasse')).join('')}
      ` : ''}
      ${passivas.length > 0 ? `
        <div class="section-divider"><span>Habilidades Passivas</span></div>
        ${passivas.map(f => renderFeatureItem(f, 'subclasse')).join('')}
      ` : ''}
    </div>
  `;
}

// Descrições mecânicas dos sub-traços de espécies com opcoes
export const SUBTRACOS_ESPECIE = {
  'Tiferino': {
    'Abissal': {
      descBase: 'Você tem Resistência a dano Venenoso. Você também conhece o truque *Rajada de Veneno*.',
      magias: { 3: 'Raio Nauseante', 5: 'Paralisar Pessoa' }
    },
    'Ctônico': {
      descBase: 'Você tem Resistência a dano Necrótico. Você também conhece o truque *Toque Necrótico*.',
      magias: { 3: 'Vitalidade Vazia', 5: 'Raio do Enfraquecimento' }
    },
    'Infernal': {
      descBase: 'Você tem Resistência a dano Ígneo. Você também conhece o truque *Raio de Fogo*.',
      magias: { 3: 'Repreensão Diabólica', 5: 'Escuridão' }
    }
  },
  'Elfo': {
    'Alto Elfo': {
      descBase: 'Você conhece o truque *Prestidigitação Arcana*. Sempre que completar um Descanso Longo, você pode substituir este truque por um truque diferente da lista de magias de Mago.',
      magias: { 3: 'Detectar Magia', 5: 'Passo Nebuloso' }
    },
    'Drow': {
      descBase: 'O alcance da sua Visão no Escuro aumenta para 36 metros. Você também conhece o truque *Luzes Dançantes*.',
      magias: { 3: 'Fogo das Fadas', 5: 'Escuridão' }
    },
    'Elfo Silvestre': {
      descBase: 'Seu Deslocamento aumenta para 10,5 metros. Você também conhece o truque *Arte Druídica*.',
      magias: { 3: 'Passos Largos', 5: 'Passo Sem Rastro' }
    }
  },
  'Draconato': {
    'Azul': { descBase: 'Ancestral: Dragão Azul. Tipo de dano: Elétrico.' },
    'Branco': { descBase: 'Ancestral: Dragão Branco. Tipo de dano: Gélido.' },
    'Bronze': { descBase: 'Ancestral: Dragão Bronze. Tipo de dano: Elétrico.' },
    'Cobre': { descBase: 'Ancestral: Dragão Cobre. Tipo de dano: Ácido.' },
    'Latão': { descBase: 'Ancestral: Dragão Latão. Tipo de dano: Ígneo.' },
    'Negro': { descBase: 'Ancestral: Dragão Negro. Tipo de dano: Ácido.' },
    'Ouro': { descBase: 'Ancestral: Dragão Ouro. Tipo de dano: Ígneo.' },
    'Prata': { descBase: 'Ancestral: Dragão Prata. Tipo de dano: Gélido.' },
    'Verde': { descBase: 'Ancestral: Dragão Verde. Tipo de dano: Venenoso.' },
    'Vermelho': { descBase: 'Ancestral: Dragão Vermelho. Tipo de dano: Ígneo.' }
  }
};

// Títulos dos traços-pai para exibição do sub-traço
const TITULO_TRACO_PAI = {
  'Tiferino': 'Legado Ínfero',
  'Elfo': 'Linhagem Élfica',
  'Draconato': 'Herança Dracônica'
};

/**
 * Gera um traço sintético para espécies com opcoes (sem sub-traço no JSON).
 * Monta a descrição com base no nível do personagem.
 */
export function gerarTracoSinteticoEspecie(especie, tracosEscolhidos, nivel) {
  const mapa = SUBTRACOS_ESPECIE[especie];
  if (!mapa) return null;
  const escolha = tracosEscolhidos[0];
  if (!escolha || !mapa[escolha]) return null;

  const info = mapa[escolha];
  const tituloPai = TITULO_TRACO_PAI[especie] || '';

  const entradas = [{
    nome: `${tituloPai} — ${escolha}`,
    descricao: info.descBase
  }];

  // Uma entrada de traço sintético independente por magia de legado desbloqueada,
  // para que cada uma tenha seu próprio controle de uso (1x/Descanso Longo).
  if (info.magias) {
    for (const [nv, nomeMagia] of Object.entries(info.magias)) {
      if (nivel >= parseInt(nv)) {
        entradas.push({
          nome: `${tituloPai} — ${escolha} (${nomeMagia})`,
          descricao: `Magia sempre preparada: *${nomeMagia}* (nível ${nv}). Pode ser conjurada uma vez sem gastar um espaço de magia, restaurando ao completar um Descanso Longo.`
        });
      }
    }
  }

  return entradas;
}

// --- Traços da Espécie/Raça ---

export function renderSecaoTracosEspecie() {
  if (!char.especie || !especiesCache?.especies) return '';
  const esp = especiesCache.especies.find(e => e.nome === char.especie);
  if (!esp?.tracos?.length) return '';

  // Filtrar traços escolhidos (se a espécie tem opções selecionáveis)
  const tracosEscolhidos = char.tracos_escolhidos || [];
  let tracosMostrar = esp.tracos;

  // Espécies com escolhas: mostrar traços fixos + apenas o traço escolhido
  const TRACOS_PAI = ['Ancestralidade Gigante', 'Linhagem Gnômica', 'Herança Dracônica', 'Linhagem Élfica', 'Legado Ínfero'];
  const TRACOS_ESCOLHA_GOLIAS = ['Arrepio do Gelo (Gigante do Gelo)', 'Queimadura de Fogo (Gigante de Fogo)', 'Resistência da Pedra (Gigante da Pedra)', 'Salto da Nuvem (Gigante das Nuvens)', 'Tombo da Colina (Gigante da Colina)', 'Trovão da Tempestade (Gigante da Tempestade)'];
  const TRACOS_ESCOLHA_GNOMO = ['Gnomo das Rochas', 'Gnomo do Bosque'];

  if (tracosEscolhidos.length > 0) {
    tracosMostrar = esp.tracos.filter(t => {
      if (TRACOS_PAI.includes(t.nome)) return false;
      if (TRACOS_ESCOLHA_GOLIAS.includes(t.nome) || TRACOS_ESCOLHA_GNOMO.includes(t.nome)) {
        return tracosEscolhidos.includes(t.nome);
      }
      return true;
    });

    // Adicionar traços sintéticos para espécies com opcoes (sem sub-traço no JSON)
    const tracosSinteticos = gerarTracoSinteticoEspecie(char.especie, tracosEscolhidos, char.nivel) || [];
    tracosMostrar.push(...tracosSinteticos);
  }

  // Filtrar traços por requisito de nível (ex: "A partir do nível 5", "No nível 3")
  tracosMostrar = tracosMostrar.filter(t => {
    // Campo explícito de nível mínimo (sub-traços que dependem de um traço pai)
    if (typeof t.nivel_minimo === 'number' && char.nivel < t.nivel_minimo) return false;
    const match = t.descricao?.match(/(?:a partir do |no )n[ií]vel (\d+)/i);
    if (match) return char.nivel >= parseInt(match[1]);
    return true;
  });

  if (!tracosMostrar.length) return '';

  // Traços que herdam recarga do pai "Ancestralidade Gigante" (bônus prof, descanso longo)
  const TRACOS_HERDAM_ANCESTRALIDADE = ['Arrepio do Gelo (Gigante do Gelo)', 'Queimadura de Fogo (Gigante de Fogo)', 'Resistência da Pedra (Gigante da Pedra)', 'Salto da Nuvem (Gigante das Nuvens)', 'Tombo da Colina (Gigante da Colina)', 'Trovão da Tempestade (Gigante da Tempestade)'];

  // Sub-traços da Revelação Celestial (Aasimar) — ativas, mas uso controlado pelo pai
  const TRACOS_REVELACAO_CELESTIAL = ['Asas Celestiais', 'Manto Necrótico', 'Transfiguração Radiante'];

  // Determinar ativa/passiva considerando traços herdados
  const ehAtivo = (t) => {
    if (TRACOS_HERDAM_ANCESTRALIDADE.includes(t.nome)) return true;
    if (TRACOS_REVELACAO_CELESTIAL.includes(t.nome)) return true;
    return ehHabilidadeAtiva(t.descricao);
  };

  const passivos = tracosMostrar.filter(t => !ehAtivo(t));
  const ativos = tracosMostrar.filter(t => ehAtivo(t));

  return `
    <div class="card print-break-before">
      <div class="card-header"><h2>Traços de Espécie — ${escHtml(char.especie)}</h2></div>
      ${ativos.length > 0 ? `
        <div class="section-divider"><span>Habilidades Ativas</span></div>
        ${ativos.map(t => renderTracoEspecie(t, TRACOS_HERDAM_ANCESTRALIDADE.includes(t.nome), TRACOS_REVELACAO_CELESTIAL.includes(t.nome))).join('')}
      ` : ''}
      ${passivos.length > 0 ? `
        <div class="section-divider"><span>Habilidades Passivas</span></div>
        ${passivos.map(t => renderTracoEspecie(t, false)).join('')}
      ` : ''}
    </div>
  `;
}

function renderTracoEspecie(traco, herdaAncestralidade = false, ehSubRevelacao = false) {
  let recarga = detectarRecarga(traco.descricao);
  let ativa = ehHabilidadeAtiva(traco.descricao);

  // Traits inheriting from "Ancestralidade Gigante": prof bonus uses, long rest
  if (herdaAncestralidade && !recarga) {
    recarga = 'longo';
    ativa = true;
  }

  // Sub-traços da Revelação Celestial: ativos mas sem controle de uso próprio
  if (ehSubRevelacao) {
    ativa = true;
  }

  const key = `especie_${traco.nome}`;
  if (!char.usos_habilidades) char.usos_habilidades = {};

  // Deteccao de traits especificas de especie para UI customizada
  const ehSortePequenino = char.especie === 'Pequenino' && traco.nome === 'Sorte';
  const ehVigorImplacavel = char.especie === 'Orc' && traco.nome === 'Vigor Implacável';
  const ehAtaqueSopro = char.especie === 'Draconato' && traco.nome === 'Ataque de Sopro';
  const ehMaosCurativas = char.especie === 'Aasimar' && traco.nome === 'Mãos Curativas';

  let usosMax = detectarUsosMaximos(traco.descricao) || (recarga ? bonusProficiencia(char.nivel) : null);

  // Correcao de usos para traits que sao 1x/descanso (sem numero explicito na descricao)
  if (ehVigorImplacavel) usosMax = 1;
  if (ehMaosCurativas) usosMax = 1;

  const temMultiplosUsos = usosMax && usosMax > 1 && recarga;

  let usosAtual = 0;
  if (temMultiplosUsos) {
    if (typeof char.usos_habilidades[key] === 'number') {
      usosAtual = char.usos_habilidades[key];
    } else if (char.usos_habilidades[key] === true) {
      usosAtual = usosMax;
      char.usos_habilidades[key] = usosMax;
    }
  }
  const usado = temMultiplosUsos ? usosAtual >= usosMax : (char.usos_habilidades[key] || false);

  const recargaBadge = recarga
    ? `<span class="badge" style="font-size:0.65rem;margin-left:4px;background:${recarga === 'longo' ? 'var(--info)' : recarga === 'curto' ? 'var(--success)' : 'var(--warning)'};color:#fff">${recarga === 'longo' ? '🌙 Desc. Longo' : recarga === 'curto' ? '☀ Desc. Curto' : '☀🌙 Curto/Longo'}</span>`
    : '';
  const tipoBadge = ativa
    ? '<span class="badge" style="font-size:0.65rem;margin-left:4px;background:var(--accent);color:#fff">Ativa</span>'
    : '<span class="badge" style="font-size:0.65rem;margin-left:4px;background:var(--text-muted);color:#fff">Passiva</span>';

  let usosHtmlSummary = '';
  let usosHtmlBody = '';

  // --- Bodies customizados para traits de especie ---

  if (ehSortePequenino) {
    // Sorte: passiva, sem uso a rastrear - apenas destaque visual
    usosHtmlBody = `
      <div style="padding:4px 0 4px 16px;font-size:0.8rem;color:var(--accent);font-weight:600">
        Automatica: ao tirar 1 natural em qualquer d20, re-jogue e use o novo resultado.
      </div>
    `;
  } else if (ehAtaqueSopro) {
    // Ataque de Sopro: multi-uso (prof bonus), custom body com dano e CD
    const nivel = char.nivel || 1;
    const dadosSopro = nivel >= 17 ? '4d10' : nivel >= 11 ? '3d10' : nivel >= 5 ? '2d10' : '1d10';
    const herancaMap = {
      'Azul': 'Eletrico', 'Branco': 'Gelido', 'Bronze': 'Eletrico',
      'Cobre': 'Acido', 'Latao': 'Igneo', 'Negro': 'Acido',
      'Ouro': 'Igneo', 'Prata': 'Gelido', 'Verde': 'Venenoso', 'Vermelho': 'Igneo'
    };
    const dragao = (char.tracos_escolhidos || [])[0] || '';
    const tipoDano = herancaMap[dragao] || '???';
    const cdSopro = 8 + calcMod(char.atributos?.constituicao || 10) + bonusProficiencia(nivel);
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${usosMax - usosAtual}/${usosMax}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="padding:4px 0 4px 16px;display:flex;flex-direction:column;gap:4px">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <button class="btn btn-sm" style="padding:2px 8px;font-size:0.7rem" data-usar-habilidade="${key}" data-usos-max="${usosMax}">
            ${usosAtual >= usosMax ? '✗ Esgotado' : 'Usar Sopro'}
          </button>
          <span style="font-size:0.75rem;font-weight:600;color:var(--accent)">${dadosSopro} ${tipoDano}</span>
          <span style="font-size:0.75rem;color:var(--text-muted)">CD ${cdSopro} (Salv. DES)</span>
        </div>
        <span style="font-size:0.7rem;color:var(--text-muted)">Cone 4,5m ou Linha 9m x 1,5m</span>
      </div>
    `;
  } else if (ehMaosCurativas) {
    // Maos Curativas: 1x/descanso longo, cura PB d4s
    const pb = bonusProficiencia(char.nivel || 1);
    usosHtmlBody = `
      <div class="no-print" style="padding:4px 0 4px 16px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <button class="btn btn-sm" style="padding:2px 8px;font-size:0.7rem;${usado ? 'opacity:0.5' : ''}" data-maos-curativas="1">
          ${usado ? '✗ Usado' : 'Curar (' + pb + 'd4)'}
        </button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Toque | Acao Usar Magia | ${pb}d4 PV</span>
      </div>
    `;
  } else if (ehVigorImplacavel) {
    // Vigor Implacavel: 1x/descanso longo
    usosHtmlBody = `
      <div class="no-print" style="padding:4px 0 4px 16px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <button class="btn btn-sm" style="padding:2px 8px;font-size:0.7rem;${usado ? 'opacity:0.5' : ''}" data-toggle-uso="${key}">
          ${usado ? '✗ Usado' : '✓ Disponivel'}
        </button>
        <span style="font-size:0.75rem;color:var(--text-muted)">Ao cair a 0 PV: fica com 1 PV.</span>
      </div>
    `;
  } else if (temMultiplosUsos) {
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${usosMax - usosAtual}/${usosMax}</span>`;
    usosHtmlBody = `
      <div class="no-print" style="display:flex;align-items:center;gap:4px;padding:4px 0 4px 16px">
        <button class="btn btn-sm" style="padding:2px 8px;font-size:0.7rem" data-usar-habilidade="${key}" data-usos-max="${usosMax}">
          ${usosAtual >= usosMax ? '✗ Esgotado' : 'Usar'}
        </button>
      </div>
    `;
  } else if (ativa && recarga) {
    usosHtmlBody = `
      <div class="no-print" style="padding:4px 0 4px 16px">
        <button class="btn btn-sm" style="padding:2px 8px;font-size:0.7rem;${usado ? 'opacity:0.5' : ''}" data-toggle-uso="${key}">
          ${usado ? '✗ Usado' : '✓ Disponível'}
        </button>
      </div>
    `;
  }

  // Informacoes de escolhas vinculadas ao traco
  let infoEscolhaTraco = '';
  if ((traco.nome === 'Hábil' || traco.nome === 'Sentidos Aguçados') && char.pericia_especie) {
    infoEscolhaTraco = `<div class="info-box info" style="font-size:0.8rem;margin-top:6px"><strong>Pericia escolhida:</strong> ${escHtml(char.pericia_especie || '')}</div>`;
  }
  if (traco.nome === 'Memória Kenku' && char.pericias_especie?.length) {
    const todasProf = (char.pericias_proficientes || []).slice().sort((a, b) => a.localeCompare(b));
    infoEscolhaTraco = `<div class="info-box info" style="font-size:0.8rem;margin-top:6px">
      <strong>Perícias escolhidas (Kenku):</strong> ${char.pericias_especie.map(escHtml).join(', ')}
      ${todasProf.length ? `<br><strong>Perícias com proficiência:</strong> ${todasProf.join(', ')}` : ''}
    </div>`;
  }
  if (traco.nome === 'Mimetismo' && char.especie === 'Kenku') {
    const cdMimetismo = 8 + bonusProficiencia(char.nivel) + calcMod(char.atributos?.carisma || 10);
    infoEscolhaTraco = `<div class="info-box info" style="font-size:0.8rem;margin-top:6px"><strong>CD do Mimetismo:</strong> ${cdMimetismo} (8 + Bônus Prof. + mod. Carisma)</div>`;
  }
  if (traco.nome === 'Versátil' && char.talento_versatil) {
    // Mostrar o talento escolhido e, se houver escolhas associadas (ex: Habilidoso), tambem
    let detalheVersatil = `<strong>Talento escolhido:</strong> ${escHtml(char.talento_versatil || '')}`;
    const escolhasVersatil = char.escolhas_talento?.versatil;
    if (escolhasVersatil?.length > 0) {
      detalheVersatil += `<br><strong>Proficiencias:</strong> ${escolhasVersatil.join(', ')}`;
    }
    infoEscolhaTraco = `<div class="info-box info" style="font-size:0.8rem;margin-top:6px">${detalheVersatil}</div>`;
  }

  return `
    <details style="margin-bottom:6px">
      <summary style="font-weight:600;cursor:pointer;font-size:0.9rem;display:flex;align-items:center;flex-wrap:wrap;gap:2px">
        ${traco.nome}
        ${ehSortePequenino ? '<span class="badge" style="font-size:0.65rem;margin-left:4px;background:var(--success);color:#fff">Re-roll nat 1</span>' : tipoBadge}
        ${recargaBadge}
        ${usosHtmlSummary}
      </summary>
      ${usosHtmlBody}
      <div class="md-content" style="padding:6px 0 6px 16px;font-size:0.85rem">${mdParaHtml(traco.descricao)}</div>
      ${infoEscolhaTraco}
    </details>
  `;
}