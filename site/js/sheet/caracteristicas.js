// ============================================================
// Caracteristicas de classe, subclasse e tracos de especie
// Extraido de site/js/pages/sheet.js sem alteracao de comportamento.
// ============================================================
import { bonusProficiencia, calcMod, detectarRecarga, ehHabilidadeAtiva, escHtml, mdParaHtml } from '../utils.js';
import { char, especiesCache } from './estado.js';
import { contextosDeClasse } from './contexto-classe.js';
import { detectarUsosMaximos, lerUsoHabilidade, renderFeatureItem } from './habilidades.js';

/**
 * Bloco de caracteristicas de UMA classe, filtrado pelo nivel NAQUELA
 * classe. `mostrarNomeClasse` so entra com duas ou mais classes: com uma
 * so, a saida tem de ficar identica a de antes da multiclasse.
 * @param {{classe, subclasse, nivelClasse, dados}} ctx
 * @param {boolean} mostrarNomeClasse
 * @returns {string} HTML, ou string vazia.
 */
function renderCaracteristicasDeUmaClasse(ctx, mostrarNomeClasse) {
  const dados = ctx.dados;
  if (!dados?.caracteristicas?.length) return '';
  let feats = dados.caracteristicas.filter(c => c.nivel <= ctx.nivelClasse);
  if (!feats.length) return '';

  // Filtrar features de subclasses não selecionadas (evitar duplicatas)
  if (dados.subclasses?.length) {
    const outrasSubclasses = dados.subclasses.filter(s => s.nome !== ctx.subclasse);
    const featsOutras = new Set();
    outrasSubclasses.forEach(sc => {
      (sc.caracteristicas || []).forEach(f => featsOutras.add(f.nome));
    });
    // Manter somente features que não pertencem exclusivamente a outra subclasse
    const featsSelecionada = new Set();
    if (ctx.subclasse) {
      const scAtual = dados.subclasses.find(s => s.nome === ctx.subclasse);
      (scAtual?.caracteristicas || []).forEach(f => featsSelecionada.add(f.nome));
    }
    feats = feats.filter(f => !featsOutras.has(f.nome) || featsSelecionada.has(f.nome));

    // Evita duplicidade com seção de subclasse ativa
    if (ctx.subclasse) {
      const scAtual = dados.subclasses.find(s => s.nome === ctx.subclasse);
      const featsSC = new Set((scAtual?.caracteristicas || []).filter(c => c.nivel <= ctx.nivelClasse).map(c => `${c.nivel}|${c.nome}`));
      feats = feats.filter(f => !featsSC.has(`${f.nivel}|${f.nome}`));
    }
  }

  // Issue #60: a separação em duas seções (Ativas/Passivas) é vocabulário
  // do APP, não do livro -- e reordenava a lista por classificação em vez
  // de nível, empurrando característica ativa de nível baixo (ex.:
  // Assinatura Mágica) para acima de passiva de nível 1. Cada card já
  // carrega o selo "Ativa"/"Passiva" (tipoBadge, habilidades.js), então a
  // seção deixou de ser a única forma de transmitir essa informação --
  // agora é só ordenação por nível, na ordem em que o livro apresenta.
  const featsOrdenados = [...feats].sort((a, b) => (a.nivel || 0) - (b.nivel || 0));
  const titulo = mostrarNomeClasse
    ? `Características de Classe — ${escHtml(ctx.classe)} ${ctx.nivelClasse}`
    : 'Características de Classe';

  return `
    <div class="card print-break-before">
      <div class="card-header"><h2>${titulo}</h2></div>
      ${featsOrdenados.map(f => renderFeatureItem(f, 'classe', ctx)).join('')}
    </div>
  `;
}

/** Um bloco de caracteristicas por classe do personagem. */
export function renderSecaoCaracteristicas() {
  const ctxs = contextosDeClasse();
  const mostrarNome = ctxs.length > 1;
  return ctxs.map(ctx => renderCaracteristicasDeUmaClasse(ctx, mostrarNome)).join('');
}

// --- Subclasse ---

/**
 * Secao da subclasse de UMA classe, filtrada pelo nivel NAQUELA classe.
 * O HTML e identico ao de antes da multiclasse: com uma classe so, a
 * saida tem de ficar byte a byte igual.
 * @param {{classe, subclasse, nivelClasse, dados}} ctx
 * @returns {string} HTML, ou string vazia.
 */
function renderSubclasseDeUmaClasse(ctx) {
  if (!ctx.subclasse || !ctx.dados?.subclasses?.length) return '';
  const sc = ctx.dados.subclasses.find(s => s.nome === ctx.subclasse);
  if (!sc?.caracteristicas?.length) return '';
  const feats = sc.caracteristicas.filter(c => c.nivel <= ctx.nivelClasse);
  if (!feats.length) return '';

  // Mesmo motivo do bloco de classe, acima (issue #60): lista única,
  // ordenada por nível -- o selo por card já diz Ativa/Passiva.
  const featsOrdenados = [...feats].sort((a, b) => (a.nivel || 0) - (b.nivel || 0));

  return `
    <div class="card print-break-before">
      <div class="card-header"><h2>Subclasse — ${escHtml(ctx.subclasse)}</h2></div>
      ${featsOrdenados.map(f => renderFeatureItem(f, 'subclasse', ctx)).join('')}
    </div>
  `;
}

/** Uma secao de subclasse por classe do personagem que tenha uma. */
export function renderSecaoSubclasse() {
  return contextosDeClasse().map(renderSubclasseDeUmaClasse).join('');
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
    descricao: info.descBase,
    // Issue #73: concedido na criação -- não tem menção de nível no texto
    // (descBase nunca fala em nível), então o detector por regex de
    // nivelDoTraco cairia no padrão (1), que já é o valor certo aqui;
    // gravado explícito para não depender desse acaso.
    nivel_minimo: 1,
  }];

  // Uma entrada de traço sintético independente por magia de legado desbloqueada,
  // para que cada uma tenha seu próprio controle de uso (1x/Descanso Longo).
  if (info.magias) {
    for (const [nv, nomeMagia] of Object.entries(info.magias)) {
      if (nivel >= parseInt(nv)) {
        entradas.push({
          nome: `${tituloPai} — ${escolha} (${nomeMagia})`,
          descricao: `Magia sempre preparada: *${nomeMagia}* (nível ${nv}). Pode ser conjurada uma vez sem gastar um espaço de magia, restaurando ao completar um Descanso Longo.`,
          nivel_minimo: parseInt(nv),
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

  // Issue #73: mesmo motivo do bloco de Características de Classe (issue
  // #60, ver o comentário lá) -- a separação em Habilidades Ativas/
  // Passivas era vocabulário do APP (o selo por card já diz a
  // classificação) e reordenava por ela em vez de por nível. Lista única,
  // ordenada por nível.
  const tracosOrdenados = [...tracosMostrar].sort((a, b) => nivelDoTraco(a) - nivelDoTraco(b));

  return `
    <div class="card print-break-before">
      <div class="card-header"><h2>Traços de Espécie — ${escHtml(char.especie)}</h2></div>
      ${tracosOrdenados.map(t => renderTracoEspecie(t,
        TRACOS_HERDAM_ANCESTRALIDADE.includes(t.nome), TRACOS_REVELACAO_CELESTIAL.includes(t.nome))).join('')}
    </div>
  `;
}

/**
 * Issue #73: nível em que o personagem recebeu este traço de espécie, para
 * o selo "Nv.N" no card e para ordenar a lista -- mesma ideia do `f.nivel`
 * das características de classe, mas traço de espécie NÃO tem esse campo
 * estruturado no catálogo (dados/origens/especies.json). A maioria é
 * concedida na criação (nível 1); os poucos que exigem nível maior o dizem
 * de duas formas: `nivel_minimo` explícito (sub-traços sintéticos, ver
 * gerarTracoSinteticoEspecie) ou menção na prosa do livro ("a partir do
 * nível N"/"no nível N", ex.: Voo Dracônico do Draconato) -- a MESMA regex
 * que já filtra esses traços por nível, logo acima em
 * renderSecaoTracosEspecie.
 */
function nivelDoTraco(t) {
  if (typeof t.nivel_minimo === 'number') return t.nivel_minimo;
  const match = t.descricao?.match(/(?:a partir do |no )n[ií]vel (\d+)/i);
  if (match) return parseInt(match[1]);
  return 1;
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
  // Issue #91: Revelação Celestial concede UMA transformação por Descanso
  // Longo, à ESCOLHA entre 3 formas (Asas Celestiais/Manto Necrótico/
  // Transfiguração Radiante) -- cada forma é um traço PRÓPRIO no catálogo
  // (renderSecaoTracosEspecie marca as 3 como `ehSubRevelacao`, "ativas,
  // uso controlado pelo pai"), mas o PAI nunca teve o seletor de verdade:
  // caía no toggle genérico (`data-toggle-uso`), um booleano sem onde
  // guardar QUAL forma foi escolhida -- o efeito mecânico de nenhuma das
  // três (ex.: deslocamento de voo de Asas Celestiais, combate.js) tinha
  // como ser aplicado.
  const ehRevelacaoCelestial = char.especie === 'Aasimar' && traco.nome === 'Revelação Celestial';

  let usosMax = detectarUsosMaximos(traco.descricao) || (recarga ? bonusProficiencia(char.nivel) : null);

  // Correcao de usos para traits que sao 1x/descanso (sem numero explicito na descricao)
  if (ehVigorImplacavel) usosMax = 1;
  if (ehMaosCurativas) usosMax = 1;

  const temMultiplosUsos = usosMax && usosMax > 1 && recarga;

  const { usosAtual, usado } = lerUsoHabilidade(key, usosMax, temMultiplosUsos);

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
  } else if (ehRevelacaoCelestial) {
    // Revelação Celestial: escolhe UMA forma, 1x/Descanso Longo, dura até
    // ser encerrada ("nenhuma ação necessária") ou até o Descanso Longo.
    const OPCOES_REVELACAO = [
      { valor: 'asas', nome: 'Asas Celestiais' },
      { valor: 'manto', nome: 'Manto Necrótico' },
      { valor: 'transfiguracao', nome: 'Transfiguração Radiante' },
    ];
    const formaAtiva = char.recursos?.aasimar_revelacao_ativa || '';
    usosHtmlSummary = `<span style="font-size:0.7rem;font-weight:600;margin-left:auto">${
      formaAtiva ? 'Transformado' : (usado ? 'Usada' : 'Disponível')
    }</span>`;
    usosHtmlBody = formaAtiva
      ? `<div class="no-print" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:4px 0 4px 16px">
          <span style="font-size:0.8rem;font-weight:600;color:var(--accent)">Transformado: ${escHtml(OPCOES_REVELACAO.find(o => o.valor === formaAtiva)?.nome || '')}</span>
          <button class="btn btn-sm" style="padding:2px 8px;font-size:0.7rem" data-revelacao-encerrar="1">Encerrar transformação</button>
        </div>`
      : `<div class="no-print" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:4px 0 4px 16px">
          <select id="revelacao-celestial-escolha" class="form-input" style="width:auto;padding:2px 4px;font-size:0.75rem" ${usado ? 'disabled' : ''}>
            ${OPCOES_REVELACAO.map(o => `<option value="${o.valor}">${escHtml(o.nome)}</option>`).join('')}
          </select>
          <button class="btn btn-sm" style="padding:2px 8px;font-size:0.7rem;${usado ? 'opacity:0.5' : ''}" data-revelacao-transformar="1" ${usado ? 'disabled' : ''}>
            ${usado ? '✗ Usada' : 'Transformar'}
          </button>
        </div>`;
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
        <span class="badge badge-secondary" style="margin-right:4px">Nv.${nivelDoTraco(traco)}</span>
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