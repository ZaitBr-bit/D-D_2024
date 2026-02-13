// ============================================================
// Wizard de Criação de Personagem (7 passos)
// ============================================================
import { CLASSES_INFO, PERICIAS, ATRIBUTOS_NOMES, ATRIBUTOS_KEYS, ATRIBUTO_NOME_PARA_KEY, STANDARD_ARRAY, POINT_BUY_CUSTOS, POINT_BUY_TOTAL } from '../dados-classes.js';
import { getClasse, getAntecedentes, getEspecies, getTalentos, getMagiasClasse, getIndiceMagias, getArmas, getArmaduras, getEquipamentoAventura } from '../db.js';
import { criarPersonagemVazio, salvarPersonagem } from '../store.js';
import { calcMod, fmtMod, calcPVNivel1, bonusProficiencia, getEspacosMagia, getTruquesConhecidos, getMagiaPreparadas, toast, abrirModal, mdParaHtml, semAcento, getDeslocamento } from '../utils.js';

const STEPS = [
  { id: 'classe', label: 'Classe' },
  { id: 'especie', label: 'Espécie' },
  { id: 'antecedente', label: 'Antecedente' },
  { id: 'atributos', label: 'Atributos' },
  { id: 'equipamento', label: 'Equipamento' },
  { id: 'magias', label: 'Magias' },
  { id: 'detalhes', label: 'Detalhes' }
];

// Espécies que exigem seleção entre traços/linhagens
// - tracos: nomes de traços que existem no JSON da espécie
// - opcoes: opções customizadas quando não existem como traços separados
const ESPECIES_TRACOS_ESCOLHA = {
  'Draconato': {
    titulo: 'Herança Dracônica',
    descricao: 'Escolha o tipo de dragão ancestral. Isso determina seu Ataque de Sopro e Resistência a Dano.',
    maxEscolhas: 1,
    opcoes: [
      { nome: 'Azul', descricao: 'Dano Elétrico' },
      { nome: 'Branco', descricao: 'Dano Gélido' },
      { nome: 'Bronze', descricao: 'Dano Elétrico' },
      { nome: 'Cobre', descricao: 'Dano Ácido' },
      { nome: 'Latão', descricao: 'Dano Ígneo' },
      { nome: 'Negro', descricao: 'Dano Ácido' },
      { nome: 'Ouro', descricao: 'Dano Ígneo' },
      { nome: 'Prata', descricao: 'Dano Gélido' },
      { nome: 'Verde', descricao: 'Dano Venenoso' },
      { nome: 'Vermelho', descricao: 'Dano Ígneo' }
    ]
  },
  'Elfo': {
    titulo: 'Linhagem Élfica',
    descricao: 'Escolha sua linhagem élfica. Cada uma concede magias e benefícios diferentes.',
    maxEscolhas: 1,
    opcoes: [
      { nome: 'Alto Elfo', descricao: 'Truque Prestidigitação Arcana + Detectar Magia (nv.3) + Passo Nebuloso (nv.5)' },
      { nome: 'Drow', descricao: 'Visão no Escuro 36m + Luzes Dançantes + Fogo das Fadas (nv.3) + Escuridão (nv.5)' },
      { nome: 'Elfo Silvestre', descricao: 'Deslocamento 10,5m + Arte Druídica + Passos Largos (nv.3) + Passos Sem Rastro (nv.5)' }
    ]
  },
  'Gnomo': {
    titulo: 'Linhagem Gnômica',
    descricao: 'Escolha sua linhagem gnômica. Isso determina seus truques e habilidades sobrenaturais.',
    maxEscolhas: 1,
    tracos: ['Gnomo das Rochas', 'Gnomo do Bosque']
  },
  'Golias': {
    titulo: 'Ancestralidade Gigante',
    descricao: 'Escolha sua ancestralidade gigante. Você pode usar o benefício escolhido igual ao seu Bônus de Proficiência vezes por Descanso Longo.',
    maxEscolhas: 1,
    tracos: ['Arrepio do Gelo (Gigante do Gelo)', 'Queimadura de Fogo (Gigante de Fogo)', 'Resistência da Pedra (Gigante da Pedra)', 'Salto da Nuvem (Gigante das Nuvens)', 'Tombo da Colina (Gigante da Colina)', 'Trovão da Tempestade (Gigante da Tempestade)']
  },
  'Tiferino': {
    titulo: 'Legado Ínfero',
    descricao: 'Escolha seu legado ínfero. Isso determina suas resistências e magias.',
    maxEscolhas: 1,
    opcoes: [
      { nome: 'Abissal', descricao: 'Resistência Venenoso + Rajada de Veneno + Raio Nauseante (nv.3) + Paralisar Pessoa (nv.5)' },
      { nome: 'Ctônico', descricao: 'Resistência Necrótico + Toque Necrótico + Vitalidade Vazia (nv.3) + Raio do Enfraquecimento (nv.5)' },
      { nome: 'Infernal', descricao: 'Resistência Ígneo + Toque Flamejante + Esfera Flamejante (nv.3) + Escuridão (nv.5)' }
    ]
  }
};

// Nível obrigatório de subclasse por classe
const NIVEL_SUBCLASSE = {
  'Bárbaro': 3, 'Bardo': 3, 'Bruxo': 3, 'Clérigo': 3, 'Druida': 3,
  'Feiticeiro': 3, 'Guardião': 3, 'Guerreiro': 3, 'Ladino': 3,
  'Mago': 3, 'Monge': 3, 'Paladino': 3
};

// Escolhas obrigatórias de classe no nível 1
const CLASSES_ESCOLHAS = {
  'Clérigo': {
    ordem_divina: {
      titulo: 'Ordem Divina',
      descricao: 'Escolha seu papel sagrado. Isso afeta suas proficiências e habilidades.',
      maxEscolhas: 1,
      opcoes: [
        { nome: 'Protetor', descricao: 'Proficiência com armas Marciais e Armadura Pesada', efeito: { armaduras: ['Pesada'], armas: ['Marcial'] } },
        { nome: 'Taumaturgo', descricao: '+1 truque de Clérigo e bônus em Arcanismo/Religião', efeito: { truques_extra: 1 } }
      ]
    }
  },
  'Guerreiro': {
    estilo_luta: {
      titulo: 'Estilo de Luta',
      descricao: 'Escolha um talento de Estilo de Luta.',
      maxEscolhas: 1,
      opcoes: [
        { nome: 'Arquearia', descricao: '+2 em ataques à distância com armas' },
        { nome: 'Arremesso', descricao: '+2 de dano com armas de Arremesso' },
        { nome: 'Armas Grandes', descricao: 'Trata 1-2 como 3 nos dados de dano (duas mãos)' },
        { nome: 'Duas Armas', descricao: 'Adiciona mod. ao dano da mão secundária' },
        { nome: 'Desarmado', descricao: 'Dano desarmado d6/d8+For' },
        { nome: 'Defensivo', descricao: '+1 CA usando armadura' },
        { nome: 'Duelismo', descricao: '+2 dano com uma arma em uma mão' },
        { nome: 'Interceptação', descricao: 'Reduz dano a aliado em 1d10+Prof' },
        { nome: 'Luta às Cegas', descricao: 'Visão Cega 3m, 9m se cego' },
        { nome: 'Protetivo', descricao: 'Impõe desvantagem em ataques contra aliados' }
      ]
    }
  },
  'Ladino': {
    especialista: {
      titulo: 'Especialização',
      descricao: 'Escolha 2 perícias nas quais você já tem proficiência para ter Especialização (dobra o bônus).',
      maxEscolhas: 2,
      tipo: 'pericias' // indica que deve usar lista de perícias do personagem
    }
  }
};

// Escolhas de antecedente (ferramentas/instrumentos)
const ANTECEDENTES_ESCOLHAS = {
  'Artesão': {
    titulo: 'Ferramenta de Artesão',
    descricao: 'Escolha um tipo de Ferramenta de Artesão:',
    campo: 'ferramenta_escolhida',
    opcoes: [
      'Suprimentos de Alquimista', 'Suprimentos de Cervejeiro', 'Suprimentos de Calígrafo',
      'Ferramentas de Carpinteiro', 'Ferramentas de Cartógrafo', 'Ferramentas de Sapateiro',
      'Ferramentas de Ferreiro', 'Ferramentas de Funileiro', 'Utensílios de Cozinheiro',
      'Ferramentas de Vidreiro', 'Ferramentas de Joalheiro', 'Ferramentas de Pedreiro',
      'Ferramentas de Pintor', 'Ferramentas de Oleiro', 'Ferramentas de Tecelão',
      'Ferramentas de Marceneiro', 'Ferramentas de Entalhador'
    ]
  },
  'Artista': {
    titulo: 'Instrumento Musical',
    descricao: 'Escolha um Instrumento Musical:',
    campo: 'instrumento_escolhido',
    opcoes: [
      'Alaúde', 'Corne', 'Flauta', 'Flauta de Pã', 'Gaita de Foles', 'Harpa',
      'Lira', 'Oboé', 'Tambor', 'Violino'
    ]
  },
  'Guarda': {
    titulo: 'Kit de Jogos',
    descricao: 'Escolha um Kit de Jogos:',
    campo: 'jogos_escolhido',
    opcoes: ['Baralho', 'Conjunto de Dados', 'Xadrez de Dragão', 'Jogo de Três Dragões']
  },
  'Nobre': {
    titulo: 'Kit de Jogos',
    descricao: 'Escolha um Kit de Jogos:',
    campo: 'jogos_escolhido',
    opcoes: ['Baralho', 'Conjunto de Dados', 'Xadrez de Dragão', 'Jogo de Três Dragões']
  },
  'Soldado': {
    titulo: 'Kit de Jogos',
    descricao: 'Escolha um Kit de Jogos:',
    campo: 'jogos_escolhido',
    opcoes: ['Baralho', 'Conjunto de Dados', 'Xadrez de Dragão', 'Jogo de Três Dragões']
  }
};

let personagem = null;
let stepAtual = 0;
let dadosCache = {};
let containerRef = null;

export async function renderCreator(container) {
  containerRef = container;
  personagem = criarPersonagemVazio();
  dadosCache = {};
  stepAtual = 0;

  // Pré-carregar dados essenciais
  const [antecedentes, especies] = await Promise.all([
    getAntecedentes(),
    getEspecies()
  ]);
  dadosCache.antecedentes = antecedentes?.antecedentes || [];
  dadosCache.especies = especies?.especies || [];

  renderWizard();
}

function renderWizard() {
  const container = containerRef;
  container.innerHTML = `
    <div class="wizard-steps wizard-steps-sticky">
      ${STEPS.map((s, i) => `
        <div class="wizard-step ${i === stepAtual ? 'active' : ''} ${i < stepAtual ? 'done' : ''}"
             data-step="${i}">
          <div class="wizard-step-num">${i < stepAtual ? '&#10003;' : i + 1}</div>
          <div class="wizard-step-label">${s.label}</div>
        </div>
      `).join('')}
    </div>
    <div id="wizard-content" class="wizard-content-area"></div>
    <div class="wizard-nav-fixed">
      <div class="wizard-nav-inner">
        <button class="btn btn-secondary" id="btn-prev" ${stepAtual === 0 ? 'disabled' : ''}>
          &#8592; Anterior
        </button>
        <span style="font-size:0.8rem;color:var(--text-muted)">
          ${stepAtual + 1} de ${STEPS.length}
        </span>
        ${stepAtual === STEPS.length - 1
          ? '<button class="btn btn-success" id="btn-finalizar">Criar Personagem &#10003;</button>'
          : '<button class="btn btn-primary" id="btn-next">Pr\u00f3ximo &#8594;</button>'
        }
      </div>
    </div>
  `;

  // Eventos dos botões de navegação
  document.getElementById('btn-prev')?.addEventListener('click', () => { stepAtual--; renderWizard(); });
  document.getElementById('btn-next')?.addEventListener('click', () => avancar());
  document.getElementById('btn-finalizar')?.addEventListener('click', () => finalizar());

  // Clique nas steps para navegar diretamente (somente para passos já visitados)
  container.querySelectorAll('.wizard-step').forEach(el => {
    el.addEventListener('click', () => {
      const target = parseInt(el.dataset.step);
      if (target < stepAtual) { stepAtual = target; renderWizard(); }
    });
  });

  // Rolar ao topo ao trocar de passo
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Renderizar conteudo do passo atual
  const stepContent = document.getElementById('wizard-content');
  renderStep(stepContent);
}

function renderStep(el) {
  switch (STEPS[stepAtual].id) {
    case 'classe': renderStepClasse(el); break;
    case 'especie': renderStepEspecie(el); break;
    case 'antecedente': renderStepAntecedente(el); break;
    case 'atributos': renderStepAtributos(el); break;
    case 'equipamento': renderStepEquipamento(el); break;
    case 'magias': renderStepMagias(el); break;
    case 'detalhes': renderStepDetalhes(el); break;
  }
}

function avancar() {
  // Validar passo atual antes de avançar
  if (!validarStep()) return;
  stepAtual++;
  renderWizard();
}

function validarStep() {
  switch (STEPS[stepAtual].id) {
    case 'classe':
      if (!personagem.classe) { toast('Selecione uma classe', 'error'); return false; }
      // Validar escolhas obrigatórias da classe
      const classeEscolhas = CLASSES_ESCOLHAS[personagem.classe];
      if (classeEscolhas) {
        for (const [chave, config] of Object.entries(classeEscolhas)) {
          const selecionados = personagem.escolhas_classe?.[chave] || [];
          if (selecionados.length < config.maxEscolhas) {
            toast(`Selecione ${config.maxEscolhas} opção(ões) de ${config.titulo}`, 'error');
            return false;
          }
        }
      }
      // Compatibilidade: verificar ordem_divina também
      if (personagem.classe === 'Clérigo' && !personagem.ordem_divina && !personagem.escolhas_classe?.ordem_divina?.length) {
        toast('Selecione sua Ordem Divina (Protetor ou Taumaturgo)', 'error');
        return false;
      }
      return true;
    case 'especie':
      if (!personagem.especie) { toast('Selecione uma espécie', 'error'); return false; }
      // Validar seleção de traços obrigatórios
      const escolhaConfig = ESPECIES_TRACOS_ESCOLHA[personagem.especie];
      if (escolhaConfig) {
        const selecionados = personagem.tracos_escolhidos || [];
        if (selecionados.length < escolhaConfig.maxEscolhas) {
          toast(`Selecione ${escolhaConfig.maxEscolhas} traço(s) de ${escolhaConfig.titulo}`, 'error');
          return false;
        }
      }
      return true;
    case 'antecedente':
      if (!personagem.antecedente) { toast('Selecione um antecedente', 'error'); return false; }
      // Validar escolhas de antecedente (ferramenta/instrumento)
      const antEscolha = ANTECEDENTES_ESCOLHAS[personagem.antecedente];
      if (antEscolha && !personagem.escolhas_antecedente?.[antEscolha.campo]) {
        toast(`Selecione ${antEscolha.titulo}`, 'error');
        return false;
      }
      return true;
    case 'atributos':
      return true;
    case 'equipamento':
      return true;
    case 'magias':
      // Validar seleção de truques e magias para conjuradores
      const infoMagia = CLASSES_INFO[personagem.classe];
      if (!infoMagia?.conjurador) return true; // Não-conjurador pode avançar

      const tabelaCaract = dadosCache.classeData?.tabela_caracteristicas;
      if (!tabelaCaract) return true;

      let truquesNecessarios = getTruquesConhecidos(tabelaCaract, personagem.nivel);
      const preparadasNecessarias = getMagiaPreparadas(tabelaCaract, personagem.nivel);

      // Bônus de truques do Clérigo Taumaturgo
      if (personagem.classe === 'Clérigo' && personagem.ordem_divina === 'Taumaturgo') {
        truquesNecessarios += 1;
      }

      const truquesSelecionados = (personagem.magias_conhecidas || []).filter(m => m.circulo === 0).length;
      const preparadasSelecionadas = (personagem.magias_preparadas || []).length;

      if (truquesNecessarios > 0 && truquesSelecionados < truquesNecessarios) {
        toast(`Selecione ${truquesNecessarios} truques (${truquesSelecionados} selecionados)`, 'error');
        return false;
      }
      if (preparadasNecessarias > 0 && preparadasSelecionadas < preparadasNecessarias) {
        toast(`Selecione ${preparadasNecessarias} magias (${preparadasSelecionadas} selecionadas)`, 'error');
        return false;
      }
      return true;
    case 'detalhes':
      return true;
  }
  return true;
}

async function finalizar() {
  coletarDetalhes();

  // Calcular PV
  const info = CLASSES_INFO[personagem.classe];
  if (info) {
    const modCon = calcMod(personagem.atributos.constituicao);
    personagem.pv_max = calcPVNivel1(info.dado_vida, modCon);
    personagem.pv_atual = personagem.pv_max;
    personagem.dados_vida_total = personagem.nivel;
    personagem.salvaguardas_proficientes = info.salvaguardas;
  }

  // Calcular espaços de magia
  if (info?.conjurador && dadosCache.classeData?.tabela_caracteristicas) {
    personagem.espacos_magia = getEspacosMagia(dadosCache.classeData.tabela_caracteristicas, personagem.nivel);
  }

  // Aplicar Ordem Divina do Clérigo
  if (personagem.classe === 'Clérigo' && personagem.ordem_divina === 'Protetor') {
    // Adicionar proficiência em armas Marciais e Armadura Pesada
    if (!personagem.proficiencias_extra) personagem.proficiencias_extra = [];
    personagem.proficiencias_extra.push('Armas Marciais', 'Armadura Pesada');
  }

  if (!personagem.nome) personagem.nome = 'Sem Nome';

  salvarPersonagem(personagem);
  toast('Personagem criado com sucesso!', 'success');
  window.navegar(`ficha/${personagem.id}`);
}

// ============================================================
// PASSO 1: CLASSE
// ============================================================
function renderStepClasse(el) {
  const classes = Object.keys(CLASSES_INFO);

  // Resumo compacto se ja tem classe selecionada
  let resumoHtml = '';
  if (personagem.classe) {
    const info = CLASSES_INFO[personagem.classe];
    const escolhasTxt = [];
    if (personagem.ordem_divina) escolhasTxt.push(personagem.ordem_divina);
    if (personagem.escolhas_classe?.estilo_luta?.length) escolhasTxt.push(personagem.escolhas_classe.estilo_luta[0]);
    const extra = escolhasTxt.length ? ' | ' + escolhasTxt.join(', ') : '';
    resumoHtml = `
      <div class="selecao-resumo">
        <div class="resumo-info">
          <div class="resumo-titulo">${personagem.classe}</div>
          <div class="resumo-detalhe">d${info.dado_vida} | ${info.atributo_primario} | ${info.conjurador ? 'Conjurador' : 'Marcial'}${extra}</div>
        </div>
        <button class="btn btn-outline btn-sm" id="btn-alterar-classe">Alterar</button>
      </div>`;
  }

  el.innerHTML = `
    <h3 style="margin-bottom:12px">Escolha sua Classe</h3>
    <div class="selection-grid" id="grid-classes">
      ${classes.map(c => {
        const info = CLASSES_INFO[c];
        return `
          <div class="selection-card ${personagem.classe === c ? 'selected' : ''}" data-classe="${c}">
            <span class="card-check">&#10003;</span>
            <div class="card-nome">${c}</div>
            <div class="card-detalhe">d${info.dado_vida} &middot; ${info.atributo_primario}</div>
            <div class="card-detalhe">${info.conjurador ? 'Conjurador' : 'Marcial'}</div>
          </div>`;
      }).join('')}
    </div>
    ${resumoHtml}
  `;

  // Clicar num card abre popup com detalhes da classe
  el.querySelectorAll('[data-classe]').forEach(card => {
    card.addEventListener('click', () => abrirPopupClasse(card.dataset.classe));
  });

  document.getElementById('btn-alterar-classe')?.addEventListener('click', () => {
    if (personagem.classe) abrirPopupClasse(personagem.classe);
  });
}

async function abrirPopupClasse(nome) {
  const info = CLASSES_INFO[nome];
  const classeData = await getClasse(nome);
  dadosCache.classeData = classeData;

  const armaduras = info.armaduras.length > 0 ? info.armaduras.join(', ') : 'Nenhuma';
  const armas = info.armas.join(', ');
  const salvaguardas = info.salvaguardas.join(', ');
  const pericias = info.pericias_opcoes ? info.pericias_opcoes.join(', ') : 'Qualquer';
  const nivelSub = NIVEL_SUBCLASSE[nome] || 3;

  // Subclasse
  let subclassesHtml = '';
  if (classeData?.subclasses?.length && personagem.nivel >= nivelSub) {
    subclassesHtml = `
      <div class="form-group mt-2">
        <label class="form-label">Subclasse (obrigatoria no nivel ${nivelSub})</label>
        <select class="form-select" id="sel-subclasse">
          <option value="">Selecione uma subclasse</option>
          ${classeData.subclasses.map(s => `<option value="${s.nome}" ${personagem.subclasse === s.nome ? 'selected' : ''}>${s.nome}</option>`).join('')}
        </select>
      </div>`;
  } else if (classeData?.subclasses?.length) {
    subclassesHtml = `
      <div class="info-box" style="font-size:0.85rem;margin-top:8px">
        Subclasse disponivel a partir do nivel ${nivelSub}. Subclasses: ${classeData.subclasses.map(s => s.nome).join(', ')}
      </div>`;
  }

  // Escolhas obrigatorias da classe (Ordem Divina, Estilo de Luta, etc.)
  const classeEscolhas = CLASSES_ESCOLHAS[nome];
  let escolhasHtml = '';
  if (classeEscolhas) {
    for (const [chave, config] of Object.entries(classeEscolhas)) {
      const selecionados = personagem.escolhas_classe?.[chave] || [];

      // Tipo especial: pericias - gerar opcoes a partir das pericias da classe
      if (config.tipo === 'pericias') {
        const periciasDaClasse = info?.pericias_opcoes || [];
        escolhasHtml += `
          <div class="section-divider mt-2"><span>${config.titulo}</span></div>
          <div class="info-box info" style="font-size:0.85rem">${config.descricao}</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin:8px 0" id="escolha-${chave}">
            ${periciasDaClasse.map(p => `
              <div class="selection-card ${selecionados.includes(p) ? 'selected' : ''}"
                   data-escolha-classe="${chave}" data-opcao="${p}"
                   style="flex:1;min-width:120px;max-width:180px;cursor:pointer">
                <div class="card-nome" style="font-size:0.85rem">${p}</div>
              </div>
            `).join('')}
          </div>
        `;
      } else {
        escolhasHtml += `
          <div class="section-divider mt-2"><span>${config.titulo}</span></div>
          <div class="info-box info" style="font-size:0.85rem">${config.descricao}</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin:8px 0" id="escolha-${chave}">
            ${(config.opcoes || []).map(opt => `
              <div class="selection-card ${selecionados.includes(opt.nome) ? 'selected' : ''}"
                   data-escolha-classe="${chave}" data-opcao="${opt.nome}"
                   style="flex:1;min-width:140px;max-width:200px;cursor:pointer">
                <div class="card-nome" style="font-size:0.85rem">${opt.nome}</div>
                ${opt.descricao ? `<div class="card-detalhe" style="font-size:0.75rem">${opt.descricao}</div>` : ''}
              </div>
            `).join('')}
          </div>
        `;
      }
    }
  }

  // Caracteristicas de nivel 1
  const caracteristicasExcluir = ['Ordem Divina', 'Estilo de Luta', 'Especialista'];
  let caracteristicas1 = '';
  if (classeData?.caracteristicas) {
    const feats = classeData.caracteristicas.filter(c => c.nivel === 1 && !caracteristicasExcluir.includes(c.nome));
    if (feats.length) {
      caracteristicas1 = `
        <div class="section-divider"><span>Caracteristicas Nivel 1</span></div>
        ${feats.map(f => `
          <details style="margin-bottom:8px">
            <summary style="font-weight:600;cursor:pointer;font-size:0.9rem">${f.nome}</summary>
            <div class="md-content" style="padding:8px 0;font-size:0.85rem">${mdParaHtml(f.descricao)}</div>
          </details>
        `).join('')}`;
    }
  }

  const corpoHtml = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
      <span class="badge badge-primary" style="font-size:0.9rem">d${info.dado_vida}</span>
      <span style="font-size:0.85rem;color:var(--text-muted)">${info.conjurador ? 'Conjurador' : 'Marcial'}</span>
    </div>
    <div class="row" style="font-size:0.85rem">
      <div class="col-2"><strong>Atributo Primario:</strong> ${info.atributo_primario}</div>
      <div class="col-2"><strong>Salvaguardas:</strong> ${salvaguardas}</div>
      <div class="col-2"><strong>Armaduras:</strong> ${armaduras}</div>
      <div class="col-2"><strong>Armas:</strong> ${armas}</div>
    </div>
    <div style="font-size:0.85rem;margin-top:8px">
      <strong>Pericias (escolha ${info.num_pericias}):</strong> ${pericias}
    </div>
    ${subclassesHtml}
    ${escolhasHtml}
    ${caracteristicas1}
  `;

  abrirModal(nome, corpoHtml, `
    <button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>
    <button class="btn btn-primary" id="popup-confirmar-classe">Selecionar ${nome}</button>
  `);

  // Evento subclasse
  document.getElementById('sel-subclasse')?.addEventListener('change', (e) => {
    personagem.subclasse = e.target.value;
  });

  // Eventos das escolhas de classe (generico)
  if (classeEscolhas) {
    document.querySelectorAll('[data-escolha-classe]').forEach(card => {
      card.addEventListener('click', () => {
        const chave = card.dataset.escolhaClasse;
        const opcao = card.dataset.opcao;
        const config = classeEscolhas[chave];
        if (!config) return;

        if (!personagem.escolhas_classe) personagem.escolhas_classe = {};
        let selecionados = personagem.escolhas_classe[chave] || [];

        if (selecionados.includes(opcao)) {
          selecionados = selecionados.filter(s => s !== opcao);
        } else {
          if (selecionados.length >= config.maxEscolhas) {
            if (config.maxEscolhas === 1) selecionados = [opcao];
          } else {
            selecionados.push(opcao);
          }
        }
        personagem.escolhas_classe[chave] = selecionados;

        // Aplicar efeitos especificos (compatibilidade)
        if (chave === 'ordem_divina') {
          personagem.ordem_divina = selecionados[0] || '';
          const opt = config.opcoes?.find(o => o.nome === selecionados[0]);
          if (opt?.efeito) {
            personagem.extras_classe = { ordem: selecionados[0], ...opt.efeito };
          }
        }

        // Atualizar visual
        document.querySelectorAll(`[data-escolha-classe="${chave}"]`).forEach(c => {
          c.classList.toggle('selected', selecionados.includes(c.dataset.opcao));
        });
      });
    });
  }

  // Botao de confirmacao (com validação de escolhas obrigatórias)
  document.getElementById('popup-confirmar-classe')?.addEventListener('click', () => {
    // Validar escolhas obrigatórias antes de confirmar
    if (classeEscolhas) {
      for (const [chave, config] of Object.entries(classeEscolhas)) {
        const selecionados = personagem.escolhas_classe?.[chave] || [];
        if (selecionados.length < config.maxEscolhas) {
          toast(`Selecione ${config.maxEscolhas} opção(ões) de ${config.titulo}`, 'error');
          return;
        }
      }
    }
    personagem.classe = nome;
    // Compatibilidade: migrar ordem_divina
    if (nome === 'Clerigo' && personagem.ordem_divina && !personagem.escolhas_classe?.ordem_divina) {
      if (!personagem.escolhas_classe) personagem.escolhas_classe = {};
      personagem.escolhas_classe.ordem_divina = [personagem.ordem_divina];
    }
    window.fecharModal();
    // Re-renderizar o passo com o resumo atualizado
    const wizContent = document.getElementById('wizard-content');
    if (wizContent) renderStepClasse(wizContent);
  });
}

// ============================================================
// PASSO 2: ESPÉCIE
// ============================================================
async function renderStepEspecie(el) {
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

  const corpoHtml = `
    <p style="font-size:0.85rem;margin-bottom:12px">${esp.descricao?.split('\n')[0] || ''}</p>
    <div style="font-size:0.85rem;margin-bottom:8px"><strong>Deslocamento:</strong> ${deslocamento}</div>
    ${escolhaHtml}
    <div class="section-divider"><span>Tracos Raciais${escolhaConfig ? ' (Fixos)' : ''}</span></div>
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

  // Botao de confirmacao (com validação de traços obrigatórios)
  document.getElementById('popup-confirmar-especie')?.addEventListener('click', () => {
    // Validar seleção de traços obrigatórios
    if (escolhaConfig) {
      if (selecionadosTemp.length < escolhaConfig.maxEscolhas) {
        toast(`Selecione ${escolhaConfig.maxEscolhas} opção(ões) de ${escolhaConfig.titulo}`, 'error');
        return;
      }
    }
    // Limpar tracos se mudou de especie
    if (personagem.especie !== nome) personagem.tracos_escolhidos = [];
    personagem.especie = nome;
    personagem.tracos_escolhidos = [...selecionadosTemp];
    window.fecharModal();
    // Re-renderizar o passo com o resumo
    const wizContent = document.getElementById('wizard-content');
    if (wizContent) renderStepEspecie(wizContent);
  });
}

// ============================================================
// PASSO 3: ANTECEDENTE
// ============================================================
function renderStepAntecedente(el) {
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
  `;

  abrirModal(ant.nome, corpoHtml, `
    <button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>
    <button class="btn btn-primary" id="popup-confirmar-antecedente">Selecionar ${ant.nome}</button>
  `);

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
    personagem.antecedente = nome;

    // Aplicar pericias do antecedente
    dadosCache.pericias_antecedente = pericias;
    dadosCache.atributos_antecedente = atributosDisponiveis;

    // Talento do antecedente
    if (talentoNome && !personagem.talentos.includes(talentoNome)) {
      personagem.talentos = [talentoNome];
    }

    window.fecharModal();
    // Re-renderizar o passo com o resumo e distribuicao de atributos
    const wizContent = document.getElementById('wizard-content');
    if (wizContent) renderStepAntecedente(wizContent);
  });
}

// Renderiza a distribuicao de atributos inline (abaixo do grid de antecedentes)
function renderDistribuicaoInline() {
  const distEl = document.getElementById('antecedente-distribuicao');
  if (!distEl) return;

  const ant = dadosCache.antecedentes.find(a => a.nome === personagem.antecedente);
  if (!ant) return;

  const atributosDisponiveis = ant.valores_atributo.split(',').map(a => a.trim()).filter(Boolean);

  distEl.innerHTML = `
    <div class="card">
      <div class="section-divider"><span>Distribuicao de Atributos</span></div>
      <div class="info-box info">Distribua +2 e +1 entre os atributos listados, ou +1/+1/+1.</div>
      <div style="display:flex;gap:8px;margin-bottom:12px">
        <label class="form-check">
          <input type="radio" name="dist-mode" value="2-1" checked> +2 / +1
        </label>
        <label class="form-check">
          <input type="radio" name="dist-mode" value="1-1-1"> +1 / +1 / +1
        </label>
      </div>
      <div id="dist-atributos"></div>
    </div>
  `;

  renderDistribuicaoAtributos(atributosDisponiveis);

  distEl.querySelectorAll('[name="dist-mode"]').forEach(radio => {
    radio.addEventListener('change', () => {
      renderDistribuicaoAtributos(atributosDisponiveis);
    });
  });
}

function renderDistribuicaoAtributos(atributos) {
  const distEl = document.getElementById('dist-atributos');
  if (!distEl) return;

  const modo = document.querySelector('[name="dist-mode"]:checked')?.value || '2-1';

  if (modo === '2-1') {
    // Função para atualizar opções disponíveis excluindo a seleção do outro dropdown
    const buildOptions = (selected, exclude) => {
      return atributos.map(a => {
        const disabled = a === exclude ? 'disabled' : '';
        const sel = a === selected ? 'selected' : '';
        return `<option value="${a}" ${sel} ${disabled}>${a}${disabled ? ' (já selecionado)' : ''}</option>`;
      }).join('');
    };

    const bonus2Atual = dadosCache.bonus2 || '';
    const bonus1Atual = dadosCache.bonus1 || '';

    distEl.innerHTML = `
      <div class="row gap-1">
        <div class="col">
          <label class="form-label">+2 em:</label>
          <select class="form-select" id="bonus-2">
            <option value="">Selecione</option>
            ${buildOptions(bonus2Atual, bonus1Atual)}
          </select>
        </div>
        <div class="col">
          <label class="form-label">+1 em:</label>
          <select class="form-select" id="bonus-1">
            <option value="">Selecione</option>
            ${buildOptions(bonus1Atual, bonus2Atual)}
          </select>
        </div>
      </div>
    `;

    const sel2 = document.getElementById('bonus-2');
    const sel1 = document.getElementById('bonus-1');

    const atualizar = () => {
      dadosCache.bonus2 = sel2.value;
      dadosCache.bonus1 = sel1.value;

      // Se selecionou o mesmo, limpar o +1
      if (sel1.value && sel1.value === sel2.value) {
        sel1.value = '';
        dadosCache.bonus1 = '';
      }

      // Atualizar opções desabilitadas
      [...sel2.options].forEach(opt => {
        opt.disabled = opt.value && opt.value === sel1.value;
        if (opt.disabled) opt.textContent = opt.value + ' (já selecionado)';
        else opt.textContent = opt.value || 'Selecione';
      });
      [...sel1.options].forEach(opt => {
        opt.disabled = opt.value && opt.value === sel2.value;
        if (opt.disabled) opt.textContent = opt.value + ' (já selecionado)';
        else opt.textContent = opt.value || 'Selecione';
      });

      // Aplicar bônus
      personagem.bonus_antecedente = {};
      if (sel2.value) {
        const key = ATRIBUTO_NOME_PARA_KEY[sel2.value];
        if (key) personagem.bonus_antecedente[key] = 2;
      }
      if (sel1.value && sel1.value !== sel2.value) {
        const key = ATRIBUTO_NOME_PARA_KEY[sel1.value];
        if (key) personagem.bonus_antecedente[key] = 1;
      }
    };

    sel2.addEventListener('change', atualizar);
    sel1.addEventListener('change', atualizar);

    // Aplicar se já tinha seleção
    if (dadosCache.bonus2 || dadosCache.bonus1) atualizar();
  } else {
    // Modo +1/+1/+1
    distEl.innerHTML = `
      <div class="info-box info">Selecione 3 atributos para receber +1 cada:</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px">
        ${atributos.map(a => `
          <label class="chip ${(dadosCache.bonus111 || []).includes(a) ? 'selected' : ''}" data-attr="${a}">
            <input type="checkbox" style="display:none" value="${a}" ${(dadosCache.bonus111 || []).includes(a) ? 'checked' : ''}>
            ${a}
          </label>
        `).join('')}
      </div>
    `;

    distEl.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const cb = chip.querySelector('input');
        const selecionados = distEl.querySelectorAll('input:checked');
        if (!cb.checked && selecionados.length >= 3) return; // Máximo 3
        cb.checked = !cb.checked;
        chip.classList.toggle('selected', cb.checked);

        dadosCache.bonus111 = [...distEl.querySelectorAll('input:checked')].map(i => i.value);
        personagem.bonus_antecedente = {};
        dadosCache.bonus111.forEach(attr => {
          const key = ATRIBUTO_NOME_PARA_KEY[attr];
          if (key) personagem.bonus_antecedente[key] = 1;
        });
      });
    });
  }
}

// ============================================================
// PASSO 4: ATRIBUTOS
// ============================================================
function renderStepAtributos(el) {
  const info = CLASSES_INFO[personagem.classe];

  el.innerHTML = `
    <h3 style="margin-bottom:12px">Defina seus Atributos</h3>
    <div class="info-box info">
      Bônus de proficiência: +${bonusProficiencia(personagem.nivel)} |
      Atributo primário: ${info?.atributo_primario || 'N/A'}
    </div>

    <div style="display:flex;gap:8px;margin-bottom:16px">
      <label class="form-check">
        <input type="radio" name="attr-mode" value="standard" ${(!dadosCache.attrMode || dadosCache.attrMode === 'standard') ? 'checked' : ''}> Conjunto Padrão
      </label>
      <label class="form-check">
        <input type="radio" name="attr-mode" value="pointbuy" ${dadosCache.attrMode === 'pointbuy' ? 'checked' : ''}> Compra de Pontos
      </label>
      <label class="form-check">
        <input type="radio" name="attr-mode" value="manual" ${dadosCache.attrMode === 'manual' ? 'checked' : ''}> Manual
      </label>
    </div>

    <div id="attr-content"></div>

    <div class="section-divider mt-2"><span>Perícias da Classe</span></div>
    <div class="info-box info">
      Escolha ${info?.num_pericias || 2} perícias da classe.
      ${dadosCache.pericias_antecedente?.length ? `<br>Já possui do antecedente: <strong>${dadosCache.pericias_antecedente.join(', ')}</strong>` : ''}
    </div>
    <div id="pericias-content"></div>
  `;

  const renderAttr = () => {
    const modo = document.querySelector('[name="attr-mode"]:checked')?.value || 'standard';
    dadosCache.attrMode = modo;
    const attrEl = document.getElementById('attr-content');
    switch (modo) {
      case 'standard': renderStandardArray(attrEl); break;
      case 'pointbuy': renderPointBuy(attrEl); break;
      case 'manual': renderManual(attrEl); break;
    }
  };

  el.querySelectorAll('[name="attr-mode"]').forEach(r => r.addEventListener('change', renderAttr));
  renderAttr();
  renderPericiasSeletor();
}

function renderStandardArray(el) {
  const info = CLASSES_INFO[personagem.classe];
  if (!dadosCache.stdAssign) {
    dadosCache.stdAssign = {};
  }

  const usados = Object.values(dadosCache.stdAssign);
  const disponiveis = STANDARD_ARRAY.filter((v, i) => !usados.includes(i));

  el.innerHTML = `
    <div class="info-box warning">Distribua os valores [${STANDARD_ARRAY.join(', ')}] entre seus atributos.</div>
    <div class="atributos-grid">
      ${ATRIBUTOS_KEYS.map(key => {
        const nome = ATRIBUTOS_NOMES[key];
        const assignIdx = dadosCache.stdAssign[key];
        const valorBase = assignIdx !== undefined ? STANDARD_ARRAY[assignIdx] : null;
        const bonus = personagem.bonus_antecedente[key] || 0;
        const valorFinal = valorBase !== null ? valorBase + bonus : null;
        const mod = valorFinal !== null ? calcMod(valorFinal) : null;
        const ehPrimario = info?.atributo_primario?.includes(nome);

        return `
          <div class="atributo-box ${ehPrimario ? 'destaque' : ''}" data-key="${key}">
            <div class="atributo-nome">${nome}${ehPrimario ? ' *' : ''}</div>
            <select class="form-select" style="font-size:0.85rem;padding:6px;margin:4px 0" data-attr-key="${key}">
              <option value="">--</option>
              ${STANDARD_ARRAY.map((v, i) => {
                const usado = usados.includes(i) && dadosCache.stdAssign[key] !== i;
                return `<option value="${i}" ${usado ? 'disabled' : ''} ${assignIdx === i ? 'selected' : ''}>${v}</option>`;
              }).join('')}
            </select>
            ${bonus > 0 ? `<div style="font-size:0.7rem;color:var(--success)">+${bonus} antec.</div>` : ''}
            ${valorFinal !== null ? `
              <div class="atributo-mod">${fmtMod(mod)}</div>
              <div class="atributo-valor">${valorFinal}</div>
            ` : '<div class="atributo-mod" style="color:var(--text-muted)">--</div>'}
          </div>`;
      }).join('')}
    </div>
  `;

  el.querySelectorAll('[data-attr-key]').forEach(sel => {
    sel.addEventListener('change', () => {
      const key = sel.dataset.attrKey;
      if (sel.value === '') {
        delete dadosCache.stdAssign[key];
      } else {
        dadosCache.stdAssign[key] = parseInt(sel.value);
      }
      // Atualizar atributos do personagem
      ATRIBUTOS_KEYS.forEach(k => {
        const idx = dadosCache.stdAssign[k];
        const base = idx !== undefined ? STANDARD_ARRAY[idx] : 10;
        const bonus = personagem.bonus_antecedente[k] || 0;
        personagem.atributos_base[k] = base;
        personagem.atributos[k] = base + bonus;
      });
      renderStandardArray(el);
    });
  });
}

function renderPointBuy(el) {
  if (!dadosCache.pbValues) {
    dadosCache.pbValues = {};
    ATRIBUTOS_KEYS.forEach(k => dadosCache.pbValues[k] = 8);
  }

  const custoTotal = ATRIBUTOS_KEYS.reduce((sum, k) => sum + (POINT_BUY_CUSTOS[dadosCache.pbValues[k]] || 0), 0);
  const restante = POINT_BUY_TOTAL - custoTotal;

  el.innerHTML = `
    <div class="info-box ${restante < 0 ? 'warning' : 'info'}">
      Pontos restantes: <strong>${restante}</strong> / ${POINT_BUY_TOTAL}
    </div>
    <div class="atributos-grid">
      ${ATRIBUTOS_KEYS.map(key => {
        const nome = ATRIBUTOS_NOMES[key];
        const base = dadosCache.pbValues[key];
        const bonus = personagem.bonus_antecedente[key] || 0;
        const total = base + bonus;
        const mod = calcMod(total);
        const custo = POINT_BUY_CUSTOS[base] || 0;

        return `
          <div class="atributo-box" data-key="${key}">
            <div class="atributo-nome">${nome}</div>
            <div class="counter" style="justify-content:center;margin:4px 0">
              <button class="counter-btn" data-pb-key="${key}" data-dir="-1" ${base <= 8 ? 'disabled' : ''}>-</button>
              <span style="font-weight:700;min-width:24px;text-align:center">${base}</span>
              <button class="counter-btn" data-pb-key="${key}" data-dir="+1" ${base >= 15 ? 'disabled' : ''}>+</button>
            </div>
            <div style="font-size:0.65rem;color:var(--text-muted)">custo: ${custo}</div>
            ${bonus > 0 ? `<div style="font-size:0.7rem;color:var(--success)">+${bonus}</div>` : ''}
            <div class="atributo-mod">${fmtMod(mod)}</div>
            <div class="atributo-valor">${total}</div>
          </div>`;
      }).join('')}
    </div>
  `;

  el.querySelectorAll('[data-pb-key]').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.pbKey;
      const dir = parseInt(btn.dataset.dir);
      const newVal = dadosCache.pbValues[key] + dir;
      if (newVal < 8 || newVal > 15) return;
      dadosCache.pbValues[key] = newVal;

      // Atualizar personagem
      ATRIBUTOS_KEYS.forEach(k => {
        personagem.atributos_base[k] = dadosCache.pbValues[k];
        personagem.atributos[k] = dadosCache.pbValues[k] + (personagem.bonus_antecedente[k] || 0);
      });
      renderPointBuy(el);
    });
  });
}

function renderManual(el) {
  const info = CLASSES_INFO[personagem.classe];

  el.innerHTML = `
    <div class="info-box info">Insira seus valores manualmente (ex: rolagem de dados). Mínimo: 3 | Máximo: 18</div>
    <div class="atributos-grid">
      ${ATRIBUTOS_KEYS.map(key => {
        const nome = ATRIBUTOS_NOMES[key];
        const base = personagem.atributos_base[key];
        const bonus = personagem.bonus_antecedente[key] || 0;
        const total = base + bonus;
        const mod = calcMod(total);
        const ehPrimario = info?.atributo_primario?.includes(nome);

        return `
          <div class="atributo-box ${ehPrimario ? 'destaque' : ''}">
            <div class="atributo-nome">${nome}${ehPrimario ? ' *' : ''}</div>
            <input type="number" class="form-input" style="text-align:center;font-size:1rem;padding:6px;font-weight:700"
                   value="${base}" min="3" max="18" data-manual-key="${key}">
            ${bonus > 0 ? `<div style="font-size:0.7rem;color:var(--success)">+${bonus}</div>` : ''}
            <div class="atributo-mod">${fmtMod(mod)}</div>
            <div class="atributo-valor">${total}</div>
          </div>`;
      }).join('')}
    </div>
  `;

  el.querySelectorAll('[data-manual-key]').forEach(inp => {
    inp.addEventListener('input', () => {
      const key = inp.dataset.manualKey;
      let val = parseInt(inp.value);
      // Validar limites: mínimo 3, máximo 18
      if (isNaN(val)) val = 10;
      if (val < 3) val = 3;
      if (val > 18) val = 18;
      personagem.atributos_base[key] = val;
      personagem.atributos[key] = val + (personagem.bonus_antecedente[key] || 0);
    });
    // Ao sair do campo, aplicar clamping visual
    inp.addEventListener('blur', () => {
      const key = inp.dataset.manualKey;
      let val = parseInt(inp.value);
      if (isNaN(val) || val < 3) val = 3;
      if (val > 18) val = 18;
      inp.value = val;
      personagem.atributos_base[key] = val;
      personagem.atributos[key] = val + (personagem.bonus_antecedente[key] || 0);
      // Atualizar mod e total exibidos
      renderManual(el);
    });
  });
}

function renderPericiasSeletor() {
  const info = CLASSES_INFO[personagem.classe];
  const el = document.getElementById('pericias-content');
  if (!el || !info) return;

  const periciasBg = dadosCache.pericias_antecedente || [];
  const opcoesClasse = info.pericias_opcoes || PERICIAS.map(p => p.nome);
  // Filtrar as que já são do antecedente
  const disponiveis = opcoesClasse.filter(p => !periciasBg.includes(p));

  // Inicializar seleção se não tiver
  if (!dadosCache.pericias_classe_sel) {
    dadosCache.pericias_classe_sel = [];
  }
  const maxSel = info.num_pericias;

  el.innerHTML = `
    <div style="display:flex;flex-wrap:wrap;gap:6px">
      ${disponiveis.map(p => {
        const sel = dadosCache.pericias_classe_sel.includes(p);
        return `<label class="chip ${sel ? 'selected' : ''}" data-pericia="${p}">
          <input type="checkbox" style="display:none" value="${p}" ${sel ? 'checked' : ''}>
          ${p}
        </label>`;
      }).join('')}
    </div>
    <div style="font-size:0.8rem;color:var(--text-muted);margin-top:6px">
      Selecionadas: ${dadosCache.pericias_classe_sel.length}/${maxSel}
    </div>
  `;

  el.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const cb = chip.querySelector('input');
      if (!cb.checked && dadosCache.pericias_classe_sel.length >= maxSel) return;
      cb.checked = !cb.checked;
      chip.classList.toggle('selected', cb.checked);

      dadosCache.pericias_classe_sel = [...el.querySelectorAll('input:checked')].map(i => i.value);
      personagem.pericias_proficientes = [...periciasBg, ...dadosCache.pericias_classe_sel];

      // Atualizar contador
      const contador = el.querySelector('div:last-child');
      if (contador) contador.textContent = `Selecionadas: ${dadosCache.pericias_classe_sel.length}/${maxSel}`;
    });
  });
}

// ============================================================
// PASSO 5: EQUIPAMENTO
// ============================================================

// --- Funções de proficiência ---

/** Verifica se o personagem tem proficiência com uma arma específica */
function temProficienciaArma(arma) {
  const info = CLASSES_INFO[personagem.classe];
  if (!info) return false;
  const cat = (arma.categoria || '').toLowerCase();
  const extras = (personagem.proficiencias_extra || []).map(p => p.toLowerCase());

  // Proficiência completa na categoria
  if (info.armas.includes('Marcial') && cat.includes('marciai')) return true;
  if (info.armas.includes('Simples') && cat.includes('simples')) return true;

  // Proficiências extras (ex: Clérigo Protetor recebe "Armas Marciais")
  if (extras.includes('armas marciais') && cat.includes('marciai')) return true;
  if (extras.includes('armas simples') && cat.includes('simples')) return true;

  // Ladino: Marcial com Acuidade
  if (info.armas.some(a => a.includes('Acuidade'))) {
    if (cat.includes('marciai') && (arma.propriedades || '').toLowerCase().includes('acuidade')) return true;
  }
  // Monge: Marcial com Leve
  if (info.armas.some(a => a.includes('Leve'))) {
    if (cat.includes('marciai') && (arma.propriedades || '').toLowerCase().includes('leve')) return true;
  }

  return false;
}

/** Verifica se o personagem tem proficiência com uma armadura específica */
function temProficienciaArmadura(armadura) {
  const info = CLASSES_INFO[personagem.classe];
  if (!info) return false;
  const cat = (armadura.categoria || '').toLowerCase();
  const nome = (armadura.nome || '').toLowerCase();
  const extras = (personagem.proficiencias_extra || []).map(p => p.toLowerCase());

  // Escudo separado
  if (nome === 'escudo') return info.armaduras.includes('Escudo') || extras.includes('escudo');

  if (info.armaduras.includes('Pesada') && cat === 'pesada') return true;
  if (info.armaduras.includes('Média') && (cat === 'média' || cat === 'media')) return true;
  if (info.armaduras.includes('Leve') && cat === 'leve') return true;

  // Proficiências extras (Clérigo Protetor etc)
  if (extras.includes('armadura pesada') && cat === 'pesada') return true;
  if (extras.includes('armadura média') && (cat === 'média' || cat === 'media')) return true;

  return false;
}

/** Verifica se o personagem atende requisito de Força de uma armadura */
function atendeRequisitoForca(armadura) {
  if (!armadura.requisito_forca || armadura.requisito_forca === '—') return true;
  const match = armadura.requisito_forca.match(/For\.?\s*(\d+)/i);
  if (!match) return true;
  return (personagem.atributos?.forca || 10) >= parseInt(match[1]);
}

/** Retorna badge HTML de proficiência */
function badgeProficiencia(proficiente) {
  if (proficiente) {
    return '<span class="badge badge-prof">Proficiente</span>';
  }
  return '<span class="badge badge-no-prof">Sem Proficiência</span>';
}

// Função para parsear opções de equipamento (A, B, C, etc)
function parseEquipamentoOpcoes(texto) {
  if (!texto) return null;
  // Formato: "Escolha A ou B: (A) item1, item2, 10 PO; ou (B) 50 PO"
  // Ou: "Escolha A, B ou C: (A) ...; (B) ...; ou (C) ..."
  const match = texto.match(/Escolha ([A-Z])(?:,?\s*([A-Z]))?\s*ou\s*([A-Z]):/i);
  if (!match) return null;

  const opcoes = [];
  const letras = [match[1], match[2], match[3]].filter(Boolean);

  for (const letra of letras) {
    // Regex para extrair conteúdo de cada opção
    const regex = new RegExp(`\\(${letra}\\)\\s*([^;]+?)(?:;|$|ou \\([A-Z]\\))`, 'i');
    const m = texto.match(regex);
    if (m) {
      const conteudo = m[1].trim().replace(/;?\s*$/, '');
      // Extrair PO se houver
      const poMatch = conteudo.match(/(\d+)\s*PO$/i);
      const po = poMatch ? parseInt(poMatch[1]) : 0;
      // Extrair itens (tudo antes do PO ou todo conteúdo se for só PO)
      let itensStr = poMatch ? conteudo.replace(/,?\s*\d+\s*PO$/i, '').trim() : conteudo;
      // Se for só PO (sem itens), marcar como opção de dinheiro
      const apenasOuro = !itensStr || itensStr.length < 3;
      opcoes.push({
        letra,
        conteudo: conteudo,
        itens: apenasOuro ? [] : itensStr.split(',').map(i => i.trim()).filter(Boolean),
        po,
        apenasOuro
      });
    }
  }

  return opcoes.length > 0 ? opcoes : null;
}

// Função para adicionar itens de equipamento ao inventário
function adicionarItensEquipamentoInicial(opcao, tipoOrigem, nomeOrigem) {
  // Limpar itens anteriores dessa origem
  personagem.inventario = personagem.inventario.filter(item =>
    !(item.origemTipo === tipoOrigem && item.origemNome === nomeOrigem)
  );

  if (opcao.apenasOuro) {
    // Opção de apenas ouro - adicionar ao PO
    personagem.po = (personagem.po || 0) + opcao.po;
    return;
  }

  // Processar cada item da opção
  for (const itemStr of opcao.itens) {
    // Verificar se tem quantidade (ex: "2 Adagas", "20 Flechas")
    const qtyMatch = itemStr.match(/^(\d+)\s+(.+)$/);
    const quantidade = qtyMatch ? parseInt(qtyMatch[1]) : 1;
    const nomeItem = qtyMatch ? qtyMatch[2] : itemStr;

    // Tentar encontrar nos dados de armas
    const arma = dadosCache.armas?.find(a => semAcento(a.nome).toLowerCase() === semAcento(nomeItem).toLowerCase());
    if (arma) {
      personagem.inventario.push({
        nome: arma.nome,
        tipo: 'arma',
        quantidade,
        equipado: false,
        dados: { dano: arma.dano, propriedades: arma.propriedades, tipo_arma: arma.tipo, categoria: arma.categoria, maestria: arma.maestria, peso: arma.peso, custo: arma.custo },
        origemTipo: tipoOrigem,
        origemNome: nomeOrigem
      });
      continue;
    }

    // Tentar encontrar nas armaduras
    const armadura = dadosCache.armaduras?.find(a => semAcento(a.nome).toLowerCase() === semAcento(nomeItem).toLowerCase());
    if (armadura) {
      personagem.inventario.push({
        nome: armadura.nome,
        tipo: 'armadura',
        quantidade,
        equipado: false,
        dados: { ca: armadura.ca, categoria: armadura.categoria, requisito_forca: armadura.requisito_forca, furtividade: armadura.furtividade, peso: armadura.peso, custo: armadura.custo },
        origemTipo: tipoOrigem,
        origemNome: nomeOrigem
      });
      continue;
    }

    // Tentar encontrar em equipamento de aventura
    const equip = dadosCache.equipAvent?.find(e => semAcento(e.nome).toLowerCase() === semAcento(nomeItem).toLowerCase());
    if (equip) {
      personagem.inventario.push({
        nome: equip.nome,
        tipo: 'equipamento',
        quantidade,
        equipado: false,
        dados: { custo: equip.custo, peso: equip.peso },
        origemTipo: tipoOrigem,
        origemNome: nomeOrigem
      });
      continue;
    }

    // Item não encontrado - adicionar como item genérico
    personagem.inventario.push({
      nome: nomeItem,
      tipo: 'generico',
      quantidade,
      equipado: false,
      dados: {},
      origemTipo: tipoOrigem,
      origemNome: nomeOrigem
    });
  }

  // Adicionar PO da opção (se houver)
  if (opcao.po > 0 && !opcao.apenasOuro) {
    personagem.po = (personagem.po || 0) + opcao.po;
  }
}

async function renderStepEquipamento(el) {
  const info = CLASSES_INFO[personagem.classe];
  const classeData = dadosCache.classeData || await getClasse(personagem.classe);

  // Equipamento inicial da classe (do tracos_basicos)
  let equipClasse = '';
  if (classeData?.tracos_basicos) {
    const keys = Object.keys(classeData.tracos_basicos);
    for (const k of keys) {
      if (k !== 'Atributo Primário' && k !== 'Atributo Primario') {
        equipClasse = classeData.tracos_basicos[k] || '';
        break;
      }
    }
    if (!equipClasse && keys.length >= 2) {
      equipClasse = classeData.tracos_basicos[keys[keys.length - 1]] || '';
    }
  }

  // Equipamento do antecedente
  const antecedente = dadosCache.antecedentes?.find(a => a.nome === personagem.antecedente);
  const equipAntecedente = antecedente?.equipamento?.replace(/\*/g, '') || '';

  // Carregar armas e armaduras disponíveis
  const [armasData, armadurasData, equipAventData] = await Promise.all([
    getArmas(),
    getArmaduras(),
    getEquipamentoAventura()
  ]);
  dadosCache.armas = armasData?.armas || [];
  dadosCache.propriedadesArmas = armasData?.propriedades || [];
  dadosCache.armaduras = armadurasData?.armaduras || [];
  dadosCache.equipAvent = equipAventData?.itens || [];

  // Parsear opções de equipamento
  const opcoesClasse = parseEquipamentoOpcoes(equipClasse);
  const opcoesAntecedente = parseEquipamentoOpcoes(equipAntecedente);

  // Inicializar escolhas se necessário
  if (!personagem.escolha_equip_classe && opcoesClasse) personagem.escolha_equip_classe = null;
  if (!personagem.escolha_equip_antecedente && opcoesAntecedente) personagem.escolha_equip_antecedente = null;

  // Função para renderizar card de seleção de equipamento
  const renderCardEquip = (titulo, texto, opcoes, tipoOrigem, nomeOrigem, escolhaAtual) => {
    if (!opcoes) {
      return `
        <div class="card mb-2" style="border-left:3px solid ${tipoOrigem === 'classe' ? 'var(--primary)' : 'var(--accent)'}">
          <div class="card-header"><h3>${titulo}</h3></div>
          <div style="font-size:0.85rem;padding:8px 0">${texto.replace(/\*/g, '')}</div>
        </div>`;
    }

    return `
      <div class="card mb-2" style="border-left:3px solid ${tipoOrigem === 'classe' ? 'var(--primary)' : 'var(--accent)'}">
        <div class="card-header"><h3>${titulo}</h3></div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin:8px 0">
          ${opcoes.map(op => `
            <div class="selection-card ${escolhaAtual === op.letra ? 'selected' : ''}"
                 data-equip-tipo="${tipoOrigem}" data-equip-letra="${op.letra}"
                 style="flex:1;min-width:200px;cursor:pointer">
              <div class="card-nome" style="font-size:0.9rem;font-weight:600">Opção ${op.letra}</div>
              <div style="font-size:0.8rem;color:var(--text-muted);margin-top:4px">
                ${op.apenasOuro ? `<strong>${op.po} PO</strong> (apenas ouro)` : op.conteudo}
              </div>
            </div>
          `).join('')}
        </div>
        ${!escolhaAtual ? '<div class="info-box warning" style="font-size:0.8rem">Selecione uma opção acima para adicionar ao inventário</div>' : ''}
      </div>`;
  };

  el.innerHTML = `
    <h3 style="margin-bottom:12px">Equipamento</h3>

    ${equipClasse ? renderCardEquip(
      `Equipamento Inicial da Classe (${personagem.classe})`,
      equipClasse,
      opcoesClasse,
      'classe',
      personagem.classe,
      personagem.escolha_equip_classe
    ) : ''}

    ${equipAntecedente ? renderCardEquip(
      `Equipamento do Antecedente (${personagem.antecedente})`,
      equipAntecedente,
      opcoesAntecedente,
      'antecedente',
      personagem.antecedente,
      personagem.escolha_equip_antecedente
    ) : ''}

    <div class="card mb-2">
      <div class="card-header"><h3>Inventário</h3>
        <div style="display:flex;gap:4px">
          <button class="btn btn-sm btn-accent" id="btn-add-arma">+ Arma</button>
          <button class="btn btn-sm btn-accent" id="btn-add-armadura">+ Armadura</button>
          <button class="btn btn-sm btn-accent" id="btn-add-item">+ Item</button>
          <button class="btn btn-sm btn-secondary" id="btn-add-custom">+ Custom</button>
        </div>
      </div>
      <div id="lista-inventario">
        ${renderListaInventario()}
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">Peças de Ouro (PO)</label>
      <input type="number" class="form-input" id="input-po" value="${personagem.po}" min="0" style="max-width:120px">
    </div>
  `;

  // Eventos de seleção de equipamento
  el.querySelectorAll('[data-equip-tipo]').forEach(card => {
    card.addEventListener('click', () => {
      const tipo = card.dataset.equipTipo;
      const letra = card.dataset.equipLetra;
      const opcoes = tipo === 'classe' ? opcoesClasse : opcoesAntecedente;
      const opcao = opcoes?.find(o => o.letra === letra);
      const nomeOrigem = tipo === 'classe' ? personagem.classe : personagem.antecedente;

      if (opcao) {
        // Salvar escolha atual
        const poAnterior = personagem.po || 0;
        // Remover PO de escolha anterior se houver
        const escolhaAnterior = tipo === 'classe' ? personagem.escolha_equip_classe : personagem.escolha_equip_antecedente;
        if (escolhaAnterior) {
          const opAnterior = opcoes.find(o => o.letra === escolhaAnterior);
          if (opAnterior) {
            // Subtrair PO e itens anteriores
            personagem.po = Math.max(0, (personagem.po || 0) - (opAnterior.po || 0));
          }
        }

        // Atualizar escolha
        if (tipo === 'classe') personagem.escolha_equip_classe = letra;
        else personagem.escolha_equip_antecedente = letra;

        // Adicionar itens da nova escolha
        adicionarItensEquipamentoInicial(opcao, tipo, nomeOrigem);

        // Re-renderizar
        renderStepEquipamento(el);
      }
    });
  });

  // Eventos
  document.getElementById('input-po')?.addEventListener('input', (e) => {
    personagem.po = parseInt(e.target.value) || 0;
  });

  document.getElementById('btn-add-arma')?.addEventListener('click', () => mostrarSeletorArma());
  document.getElementById('btn-add-armadura')?.addEventListener('click', () => mostrarSeletorArmadura());
  document.getElementById('btn-add-item')?.addEventListener('click', () => mostrarSeletorItem());
  document.getElementById('btn-add-custom')?.addEventListener('click', () => mostrarFormCustomItem());

  // Eventos de remover item
  setupEventosInventario(el);
}

/** Renderiza a lista completa do inventário com equipados primeiro */
function renderListaInventario() {
  if (personagem.inventario.length === 0) {
    return '<div style="color:var(--text-muted);font-size:0.85rem;text-align:center;padding:12px">Nenhum item adicionado</div>';
  }

  // Criar array de índices originais, separar equipados e não equipados
  const equipados = [];
  const naoEquipados = [];
  personagem.inventario.forEach((item, idx) => {
    if (item.equipado) equipados.push(idx);
    else naoEquipados.push(idx);
  });

  let html = '';

  if (equipados.length > 0) {
    html += '<div class="inv-secao-titulo"><span>Equipados</span></div>';
    html += equipados.map(idx => renderItemInventario(personagem.inventario[idx], idx)).join('');
  }

  if (naoEquipados.length > 0) {
    html += '<div class="inv-secao-titulo"><span>Mochila</span></div>';
    html += naoEquipados.map(idx => renderItemInventario(personagem.inventario[idx], idx)).join('');
  }

  return html;
}

function renderItemInventario(item, idx) {
  // Verificar proficiência para armas e armaduras
  let profBadge = '';
  if (item.tipo === 'arma' && item.dados?.categoria) {
    const prof = temProficienciaArma({ categoria: item.dados.categoria, propriedades: item.dados.propriedades || '' });
    profBadge = prof ? '<span class="badge badge-prof-sm">Prof</span>' : '<span class="badge badge-no-prof-sm">Sem Prof</span>';
  }
  if ((item.tipo === 'armadura' || item.tipo === 'escudo') && item.dados?.categoria) {
    const prof = temProficienciaArmadura({ categoria: item.dados.categoria, nome: item.nome });
    profBadge = prof ? '<span class="badge badge-prof-sm">Prof</span>' : '<span class="badge badge-no-prof-sm">Sem Prof</span>';
  }

  return `
    <div class="inv-item ${item.equipado ? 'inv-item-equipado' : ''}" data-idx="${idx}" draggable="true">
      <div class="inv-drag-handle" title="Arrastar para reordenar">&#9776;</div>
      <div style="flex:1;cursor:pointer" data-info-inv="${idx}" title="Ver detalhes">
        <div class="inv-item-nome">${item.nome} ${profBadge}</div>
        <div class="inv-item-detalhe">
          ${item.tipo === 'arma' ? `${item.dados?.dano || ''} | ${item.dados?.propriedades || ''}` : ''}
          ${item.tipo === 'armadura' ? `CA: ${item.dados?.ca || ''} | ${item.dados?.categoria || ''}` : ''}
          ${item.tipo === 'escudo' ? `CA: ${item.dados?.ca || ''} | Escudo` : ''}
          ${item.tipo === 'equipamento' ? `${item.dados?.peso || ''} | ${item.dados?.custo || ''}` : ''}
          ${item.tipo === 'customizado' ? `${item.descricao || ''}` : ''}
          ${item.quantidade > 1 ? ` (x${item.quantidade})` : ''}
        </div>
      </div>
      <div class="inv-item-acoes">
        <button class="btn btn-sm btn-icon inv-btn-mover" data-mover-idx="${idx}" data-dir="up" title="Mover para cima">&uarr;</button>
        <button class="btn btn-sm btn-icon inv-btn-mover" data-mover-idx="${idx}" data-dir="down" title="Mover para baixo">&darr;</button>
        <label class="form-check inv-equip-label" title="Equipar/Desequipar">
          <input type="checkbox" data-equip-idx="${idx}" ${item.equipado ? 'checked' : ''}> Eq.
        </label>
        <button class="btn btn-sm btn-danger btn-icon" data-remover-idx="${idx}">&times;</button>
      </div>
    </div>
  `;
}

function setupEventosInventario(containerEl) {
  // Remover item (com confirmação)
  containerEl.querySelectorAll('[data-remover-idx]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.removerIdx);
      const item = personagem.inventario[idx];
      if (!item) return;
      abrirModal('Remover Item', `
        <p>Deseja realmente remover <strong>${item.nome}</strong>${item.quantidade > 1 ? ` (x${item.quantidade})` : ''} do inventário?</p>
      `, `
        <button class="btn btn-danger" id="btn-confirmar-rem-inv">Remover</button>
        <button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>
      `);
      document.getElementById('btn-confirmar-rem-inv')?.addEventListener('click', () => {
        personagem.inventario.splice(idx, 1);
        fecharModal();
        renderStepEquipamento(containerRef.querySelector('#wizard-content') || containerRef);
      });
    });
  });

  // Equipar/desequipar item (re-renderiza para reorganizar)
  containerEl.querySelectorAll('[data-equip-idx]').forEach(cb => {
    cb.addEventListener('change', () => {
      const idx = parseInt(cb.dataset.equipIdx);
      if (personagem.inventario[idx]) {
        personagem.inventario[idx].equipado = cb.checked;
        // Re-renderizar inventário para reorganizar
        const listaEl = document.getElementById('lista-inventario');
        if (listaEl) {
          listaEl.innerHTML = renderListaInventario();
          setupEventosInventario(containerEl);
        }
      }
    });
  });

  // Mover item para cima/baixo
  containerEl.querySelectorAll('.inv-btn-mover').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.moverIdx);
      const dir = btn.dataset.dir;
      const inv = personagem.inventario;

      if (dir === 'up' && idx > 0) {
        [inv[idx], inv[idx - 1]] = [inv[idx - 1], inv[idx]];
      } else if (dir === 'down' && idx < inv.length - 1) {
        [inv[idx], inv[idx + 1]] = [inv[idx + 1], inv[idx]];
      }

      const listaEl = document.getElementById('lista-inventario');
      if (listaEl) {
        listaEl.innerHTML = renderListaInventario();
        setupEventosInventario(containerEl);
      }
    });
  });

  // Ver detalhes do item ao clicar
  containerEl.querySelectorAll('[data-info-inv]').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('input') || e.target.closest('button')) return;
      const idx = parseInt(el.dataset.infoInv);
      const item = personagem.inventario[idx];
      if (item) mostrarDetalheItem(item);
    });
  });

  // Drag and drop para reordenar
  setupDragDropInventario(containerEl);
}

/** Configura drag-and-drop no inventário */
function setupDragDropInventario(containerEl) {
  const listaEl = document.getElementById('lista-inventario');
  if (!listaEl) return;

  let dragIdx = null;

  listaEl.querySelectorAll('.inv-item[draggable]').forEach(el => {
    el.addEventListener('dragstart', (e) => {
      dragIdx = parseInt(el.dataset.idx);
      el.classList.add('inv-item-dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    el.addEventListener('dragend', () => {
      el.classList.remove('inv-item-dragging');
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
        // Mover item na posição
        const [item] = personagem.inventario.splice(dragIdx, 1);
        personagem.inventario.splice(dropIdx, 0, item);

        listaEl.innerHTML = renderListaInventario();
        setupEventosInventario(containerEl);
      }
    });
  });
}

function mostrarSeletorArma() {
  const armas = dadosCache.armas || [];
  // Ordenar: proficientes primeiro
  const armasOrdenadas = [...armas].sort((a, b) => {
    const pa = temProficienciaArma(a) ? 0 : 1;
    const pb = temProficienciaArma(b) ? 0 : 1;
    return pa - pb;
  });
  const html = `
    <div class="search-box"><input type="text" id="busca-arma" placeholder="Buscar arma..." class="form-input"></div>
    <div style="display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap">
      <button class="btn btn-sm btn-outline filtro-arma active" data-filtro="todas">Todas</button>
      <button class="btn btn-sm btn-outline filtro-arma" data-filtro="proficiente">Proficientes</button>
      <button class="btn btn-sm btn-outline filtro-arma" data-filtro="simples">Simples</button>
      <button class="btn btn-sm btn-outline filtro-arma" data-filtro="marcial">Marcial</button>
    </div>
    <div id="lista-armas" style="max-height:50vh;overflow-y:auto">
      ${armasOrdenadas.map((a, i) => {
        const prof = temProficienciaArma(a);
        const tipoCateg = a.categoria?.includes('Simples') ? 'simples' : 'marcial';
        const subCateg = a.categoria?.includes('Distância') ? 'Distância' : 'Corpo';
        return `
        <div class="inv-item ${prof ? 'item-proficiente' : 'item-sem-prof'}" style="cursor:pointer" data-arma-nome="${a.nome}" data-prof="${prof}" data-tipo="${tipoCateg}">
          <div style="flex:1">
            <div class="inv-item-nome">${a.nome} ${badgeProficiencia(prof)}</div>
            <div class="inv-item-detalhe">${a.dano} | ${a.propriedades || '—'}</div>
            <div class="inv-item-detalhe" style="font-size:0.7rem;opacity:0.7">Maestria: ${a.maestria || '—'} | ${a.custo} | ${a.peso || '—'}</div>
          </div>
          <span class="badge badge-secondary">${subCateg}</span>
        </div>`;
      }).join('')}
    </div>
  `;

  abrirModal('Adicionar Arma', html);

  // Filtros de categoria
  let filtroAtual = 'todas';
  document.querySelectorAll('.filtro-arma').forEach(btn => {
    btn.addEventListener('click', () => {
      filtroAtual = btn.dataset.filtro;
      document.querySelectorAll('.filtro-arma').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      aplicarFiltrosArma();
    });
  });

  function aplicarFiltrosArma() {
    const termo = semAcento(document.getElementById('busca-arma')?.value || '');
    document.querySelectorAll('#lista-armas [data-arma-nome]').forEach(el => {
      const matchTexto = !termo || semAcento(el.textContent).includes(termo);
      const matchFiltro = filtroAtual === 'todas'
        || (filtroAtual === 'proficiente' && el.dataset.prof === 'true')
        || (filtroAtual === el.dataset.tipo);
      el.style.display = (matchTexto && matchFiltro) ? '' : 'none';
    });
  }

  // Busca por texto
  document.getElementById('busca-arma')?.addEventListener('input', () => aplicarFiltrosArma());

  // Seleção
  document.querySelectorAll('#lista-armas [data-arma-nome]').forEach(el => {
    el.addEventListener('click', () => {
      const arma = armasOrdenadas.find(a => a.nome === el.dataset.armaNome);
      if (!arma) return;
      personagem.inventario.push({
        nome: arma.nome, tipo: 'arma', quantidade: 1, equipado: false,
        descricao: `${arma.dano} - ${arma.propriedades}`,
        dados: { dano: arma.dano, propriedades: arma.propriedades, maestria: arma.maestria, peso: arma.peso, custo: arma.custo, categoria: arma.categoria }
      });
      window.fecharModal();
      const wizContent = document.getElementById('wizard-content');
      if (wizContent) renderStepEquipamento(wizContent);
    });
  });
}

function mostrarSeletorArmadura() {
  const armaduras = dadosCache.armaduras || [];
  // Ordenar: proficientes primeiro
  const armadurasOrdenadas = [...armaduras].sort((a, b) => {
    const pa = temProficienciaArmadura(a) ? 0 : 1;
    const pb = temProficienciaArmadura(b) ? 0 : 1;
    return pa - pb;
  });
  const html = `
    <div style="display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap">
      <button class="btn btn-sm btn-outline filtro-armadura active" data-filtro="todas">Todas</button>
      <button class="btn btn-sm btn-outline filtro-armadura" data-filtro="proficiente">Proficientes</button>
      <button class="btn btn-sm btn-outline filtro-armadura" data-filtro="leve">Leve</button>
      <button class="btn btn-sm btn-outline filtro-armadura" data-filtro="média">Média</button>
      <button class="btn btn-sm btn-outline filtro-armadura" data-filtro="pesada">Pesada</button>
    </div>
    <div id="lista-armaduras" style="max-height:55vh;overflow-y:auto">
      ${armadurasOrdenadas.map((a, i) => {
        const prof = temProficienciaArmadura(a);
        const reqOk = atendeRequisitoForca(a);
        const cat = (a.categoria || '').toLowerCase();
        return `
        <div class="inv-item ${prof ? 'item-proficiente' : 'item-sem-prof'}" style="cursor:pointer" data-arm-nome="${a.nome}" data-prof="${prof}" data-cat="${cat}">
          <div style="flex:1">
            <div class="inv-item-nome">${a.nome} ${badgeProficiencia(prof)} ${!reqOk ? '<span class="badge badge-warn">For. insuficiente</span>' : ''}</div>
            <div class="inv-item-detalhe">CA: ${a.ca} | For: ${a.requisito_forca || '—'} | ${a.custo}${a.furtividade && a.furtividade !== '—' ? ' | <em>' + a.furtividade + '</em>' : ''}</div>
            <div class="inv-item-detalhe" style="font-size:0.7rem;opacity:0.7">Peso: ${a.peso || '—'}</div>
          </div>
          <span class="badge badge-secondary">${a.categoria}</span>
        </div>`;
      }).join('')}
    </div>
  `;

  abrirModal('Adicionar Armadura', html);

  // Filtros
  document.querySelectorAll('.filtro-armadura').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filtro-armadura').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const filtro = btn.dataset.filtro;
      document.querySelectorAll('#lista-armaduras [data-arm-nome]').forEach(el => {
        const matchFiltro = filtro === 'todas'
          || (filtro === 'proficiente' && el.dataset.prof === 'true')
          || el.dataset.cat === filtro;
        el.style.display = matchFiltro ? '' : 'none';
      });
    });
  });

  document.querySelectorAll('#lista-armaduras [data-arm-nome]').forEach(el => {
    el.addEventListener('click', () => {
      const arm = armadurasOrdenadas.find(a => a.nome === el.dataset.armNome);
      if (!arm) return;
      personagem.inventario.push({
        nome: arm.nome, tipo: arm.nome === 'Escudo' ? 'escudo' : 'armadura',
        quantidade: 1, equipado: false,
        descricao: `CA: ${arm.ca}`,
        dados: { ca: arm.ca, categoria: arm.categoria, requisito_forca: arm.requisito_forca, furtividade: arm.furtividade, peso: arm.peso, custo: arm.custo }
      });
      window.fecharModal();
      const wizContent = document.getElementById('wizard-content');
      if (wizContent) renderStepEquipamento(wizContent);
    });
  });
}

function mostrarSeletorItem() {
  const itens = dadosCache.equipAvent || [];
  const html = `
    <div class="search-box"><input type="text" id="busca-item" placeholder="Buscar item..." class="form-input"></div>
    <div id="lista-itens" style="max-height:50vh;overflow-y:auto">
      ${itens.map((it, i) => `
        <div class="inv-item" style="cursor:pointer" data-item-idx="${i}">
          <div>
            <div class="inv-item-nome">${it.nome}</div>
            <div class="inv-item-detalhe">${it.peso || ''} | ${it.custo || ''}</div>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  abrirModal('Adicionar Item', html);

  document.getElementById('busca-item')?.addEventListener('input', (e) => {
    const termo = semAcento(e.target.value);
    document.querySelectorAll('#lista-itens [data-item-idx]').forEach(el => {
      el.style.display = semAcento(el.textContent).includes(termo) ? '' : 'none';
    });
  });

  document.querySelectorAll('#lista-itens [data-item-idx]').forEach(el => {
    el.addEventListener('click', () => {
      const item = itens[parseInt(el.dataset.itemIdx)];
      personagem.inventario.push({
        nome: item.nome, tipo: 'equipamento', quantidade: 1, equipado: false,
        descricao: '', dados: { peso: item.peso, custo: item.custo }
      });
      window.fecharModal();
      const wizContent = document.getElementById('wizard-content');
      if (wizContent) renderStepEquipamento(wizContent);
    });
  });
}

function mostrarFormCustomItem() {
  const html = `
    <div class="form-group">
      <label class="form-label">Nome do Item</label>
      <input type="text" class="form-input" id="custom-nome" placeholder="Ex: Espada do Destino">
    </div>
    <div class="form-group">
      <label class="form-label">Descricao</label>
      <textarea class="form-textarea" id="custom-desc" placeholder="Descricao do item..."></textarea>
    </div>
    <div class="row gap-1">
      <div class="col">
        <label class="form-label">Bonus CA</label>
        <input type="number" class="form-input" id="custom-ca" value="0">
      </div>
      <div class="col">
        <label class="form-label">Dano</label>
        <input type="text" class="form-input" id="custom-dano" placeholder="Ex: 1d8+2 Cortante">
      </div>
      <div class="col">
        <label class="form-label">Bonus Ataque</label>
        <input type="number" class="form-input" id="custom-ataque" value="0">
      </div>
    </div>
  `;

  abrirModal('Item Customizado', html,
    '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button class="btn btn-primary" id="btn-salvar-custom">Adicionar</button>'
  );

  document.getElementById('btn-salvar-custom')?.addEventListener('click', () => {
    const nome = document.getElementById('custom-nome')?.value?.trim();
    if (!nome) { toast('Informe um nome', 'error'); return; }

    personagem.inventario.push({
      nome: nome,
      tipo: 'customizado',
      quantidade: 1,
      equipado: false,
      descricao: document.getElementById('custom-desc')?.value || '',
      dados: {
        bonus_ca: document.getElementById('custom-ca')?.value || '0',
        dano: document.getElementById('custom-dano')?.value || '',
        bonus_ataque: document.getElementById('custom-ataque')?.value || '0'
      }
    });
    window.fecharModal();
    const wizContent = document.getElementById('wizard-content');
    if (wizContent) renderStepEquipamento(wizContent);
  });
}

// Mostra popup com detalhes completos de um item do inventário
function mostrarDetalheItem(item) {
  if (!item) return;
  let corpo = '';

  if (item.tipo === 'arma') {
    const d = item.dados || {};
    corpo += `<div class="row" style="font-size:0.85rem;gap:8px;margin-bottom:10px">`;
    if (d.categoria) corpo += `<div class="col"><strong>Categoria:</strong> ${d.categoria}</div>`;
    if (d.dano) corpo += `<div class="col"><strong>Dano:</strong> ${d.dano}</div>`;
    corpo += `</div>`;

    if (d.maestria) corpo += `<div style="font-size:0.85rem;margin-bottom:6px"><strong>Maestria:</strong> ${d.maestria}</div>`;
    if (d.custo || d.peso) corpo += `<div style="font-size:0.85rem;margin-bottom:6px"><strong>Custo:</strong> ${d.custo || '—'} | <strong>Peso:</strong> ${d.peso || '—'}</div>`;

    // Mostrar descrições das propriedades
    if (d.propriedades) {
      const propsNomes = d.propriedades.split(',').map(p => p.trim().replace(/\s*\(.*\)/, ''));
      const propsDescs = (dadosCache.propriedadesArmas || []);
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

      // Mostrar descrição da maestria
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
  } else {
    const d = item.dados || {};
    if (d.custo || d.peso) {
      corpo += `<div style="font-size:0.85rem"><strong>Custo:</strong> ${d.custo || '—'} | <strong>Peso:</strong> ${d.peso || '—'}</div>`;
    }
    if (item.descricao) {
      corpo += `<div class="md-content" style="margin-top:6px;font-size:0.85rem">${mdParaHtml(item.descricao)}</div>`;
    }
  }

  if (!corpo.trim()) corpo = '<div style="color:var(--text-muted)">Sem informações adicionais disponíveis.</div>';

  abrirModal(item.nome, corpo);
}

// ============================================================
// PASSO 6: MAGIAS
// ============================================================
async function renderStepMagias(el) {
  const info = CLASSES_INFO[personagem.classe];

  if (!info?.conjurador) {
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

  // Bônus de truques do Clérigo Taumaturgo
  if (personagem.classe === 'Clérigo' && personagem.ordem_divina === 'Taumaturgo') {
    numTruques += 1;
  }

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
      Magias preparadas: <strong>${(personagem.magias_preparadas || []).length}/${numPreparadas}</strong> |
      Atributo: <strong>${info.atributo_conjuracao}</strong>
    </div>

    <div class="tabs" id="tabs-magias">
      <div class="tab active" data-tab-circ="0">Truques</div>
      ${Object.keys(espacos).sort((a,b) => Number(a) - Number(b)).map(c => `<div class="tab" data-tab-circ="${c}">${c}&ordm; Círculo (${espacos[c]?.total || 0})</div>`).join('')}
    </div>
    <div class="search-box"><input type="text" id="busca-magia" placeholder="Buscar magia..." class="form-input"></div>
    <div id="magias-lista"></div>
  `;

  let circuloAtivo = 0;

  const renderMagiasCirculo = (circ) => {
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
      : (personagem.magias_preparadas || []).map(m => m.nome);

    const maxSel = isTruque ? numTruques : numPreparadas;
    const totalSel = isTruque
      ? selecionadas.length
      : (personagem.magias_preparadas || []).length;

    listaEl.innerHTML = `
      <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:8px">
        ${isTruque ? `Truques selecionados: ${selecionadas.length}/${maxSel}` : `Magias preparadas: ${totalSel}/${maxSel}`}
        ${magiasDaClasse.length > 0 ? ` | ${magiasDaClasse.length} disponíveis` : ''}
      </div>
      ${magiasDaClasse.length === 0
        ? '<div style="color:var(--text-muted);text-align:center;padding:20px">Nenhuma magia disponível neste círculo</div>'
        : `<div class="magias-grid">${magiasDaClasse.map(m => {
            const nome = m.nome || m;
            const sel = selecionadas.includes(nome);
            return `
              <div class="magia-card ${sel ? 'selecionada' : ''}" data-magia-nome="${nome}" data-magia-circ="${circ}">
                <span class="magia-card-check"></span>
                <div class="magia-card-nome">${nome}</div>
                <div class="magia-card-meta">
                  <span>${m.escola || ''}</span>
                  ${m.especial === 'C' ? '<span title="Concentração">C</span>' : ''}
                  ${m.especial === 'M' ? '<span title="Material (custo)">M$</span>' : ''}
                </div>
                <span class="magia-card-info" data-info-magia="${nome}" data-info-circ="${circ}" title="Ver detalhes">&#9432;</span>
              </div>`;
          }).join('')}</div>`
      }
    `;

    // Eventos de toggle ao clicar no card
    listaEl.querySelectorAll('.magia-card').forEach(card => {
      card.addEventListener('click', (e) => {
        // Ignorar clique no botão de info
        if (e.target.closest('[data-info-magia]')) return;
        const nome = card.dataset.magiaNome;
        toggleMagia(nome, circ, isTruque, numTruques, numPreparadas);
        renderMagiasCirculo(circ);
        atualizarContadoresMagia(numTruques, numPreparadas);
      });
    });

    // Detalhe ao clicar no ícone de info
    listaEl.querySelectorAll('[data-info-magia]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const nome = btn.dataset.infoMagia;
        const c = parseInt(btn.dataset.infoCirc);
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
}

function toggleMagia(nome, circulo, isTruque, maxTruques, maxPreparadas) {
  if (isTruque) {
    const idx = (personagem.magias_conhecidas || []).findIndex(m => m.nome === nome);
    if (idx >= 0) {
      personagem.magias_conhecidas.splice(idx, 1);
    } else {
      const truquesAtual = personagem.magias_conhecidas.filter(m => m.circulo === 0).length;
      if (truquesAtual >= maxTruques) { toast(`Maximo de ${maxTruques} truques`, 'error'); return; }
      personagem.magias_conhecidas.push({ nome, circulo });
    }
  } else {
    const idx = (personagem.magias_preparadas || []).findIndex(m => m.nome === nome);
    if (idx >= 0) {
      personagem.magias_preparadas.splice(idx, 1);
    } else {
      if (personagem.magias_preparadas.length >= maxPreparadas) { toast(`Maximo de ${maxPreparadas} magias preparadas`, 'error'); return; }
      personagem.magias_preparadas.push({ nome, circulo });
    }
  }
}

function atualizarContadoresMagia(maxTruques, maxPrep) {
  const infoBox = document.querySelector('#wizard-content .info-box.info');
  if (!infoBox) return;
  const numT = (personagem.magias_conhecidas || []).filter(m => m.circulo === 0).length;
  const numP = (personagem.magias_preparadas || []).length;
  infoBox.innerHTML = `Truques: <strong>${numT}/${maxTruques}</strong> | Magias preparadas: <strong>${numP}/${maxPrep}</strong> | Atributo: <strong>${CLASSES_INFO[personagem.classe]?.atributo_conjuracao || ''}</strong>`;
}

async function mostrarDetalheMagia(nome, circulo) {
  // Buscar magia completa
  const dados = await import('../db.js').then(m => m.getMagiasPorCirculo(circulo));
  const magia = dados?.magias?.find(m => m.nome === nome);
  if (!magia) { toast('Magia nao encontrada', 'error'); return; }

  abrirModal(magia.nome, `
    <div class="magia-meta" style="margin-bottom:8px;display:flex;flex-wrap:wrap;gap:8px;font-size:0.85rem">
      <span class="badge badge-primary">${circulo === 0 ? 'Truque' : circulo + 'o Circulo'}</span>
      <span class="badge badge-secondary">${magia.escola}</span>
      <span>${magia.tempo_conjuracao}</span>
      <span>${magia.alcance}</span>
      <span>${magia.componentes}</span>
      <span>${magia.duracao}</span>
    </div>
    <div class="md-content">${mdParaHtml(magia.descricao)}</div>
    ${magia.circulo_superior ? `<div class="info-box info mt-1"><strong>Em circulos superiores:</strong> ${magia.circulo_superior}</div>` : ''}
    <div style="font-size:0.8rem;color:var(--text-muted);margin-top:8px">Classes: ${(magia.classes || []).join(', ')}</div>
  `);
}

// ============================================================
// PASSO 7: DETALHES
// ============================================================
function renderStepDetalhes(el) {
  const info = CLASSES_INFO[personagem.classe];
  const modCon = calcMod(personagem.atributos.constituicao);
  const pvCalc = info ? calcPVNivel1(info.dado_vida, modCon) : 0;

  el.innerHTML = `
    <h3 style="margin-bottom:12px">Detalhes do Personagem</h3>

    <div class="card mb-2">
      <div class="row gap-1">
        <div class="col" style="flex:2">
          <div class="form-group">
            <label class="form-label">Nome do Personagem</label>
            <input type="text" class="form-input" id="det-nome" value="${personagem.nome}" placeholder="Nome do seu personagem">
          </div>
        </div>
        <div class="col">
          <div class="form-group">
            <label class="form-label">Nivel</label>
            <input type="number" class="form-input" id="det-nivel" value="${personagem.nivel}" min="1" max="20">
          </div>
        </div>
      </div>

      <div class="info-box success">
        <strong>Resumo:</strong>
        ${personagem.especie} ${personagem.classe} ${personagem.subclasse ? `(${personagem.subclasse})` : ''} |
        Antecedente: ${personagem.antecedente} |
        PV: ${pvCalc} |
        Talento: ${personagem.talentos.join(', ') || 'Nenhum'}
      </div>
    </div>

    <div class="card mb-2">
      <div class="card-header"><h3>Aparencia e Personalidade</h3></div>
      <div class="form-group">
        <label class="form-label">Aparencia</label>
        <textarea class="form-textarea" id="det-aparencia" rows="2" placeholder="Descreva a aparencia...">${personagem.aparencia}</textarea>
      </div>
      <div class="row gap-1">
        <div class="col-2">
          <div class="form-group">
            <label class="form-label">Tracos de Personalidade</label>
            <textarea class="form-textarea" id="det-personalidade" rows="2">${personagem.personalidade}</textarea>
          </div>
        </div>
        <div class="col-2">
          <div class="form-group">
            <label class="form-label">Ideais</label>
            <textarea class="form-textarea" id="det-ideais" rows="2">${personagem.ideais}</textarea>
          </div>
        </div>
      </div>
      <div class="row gap-1">
        <div class="col-2">
          <div class="form-group">
            <label class="form-label">Lacos</label>
            <textarea class="form-textarea" id="det-lacos" rows="2">${personagem.lacos}</textarea>
          </div>
        </div>
        <div class="col-2">
          <div class="form-group">
            <label class="form-label">Defeitos</label>
            <textarea class="form-textarea" id="det-defeitos" rows="2">${personagem.defeitos}</textarea>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="form-group">
        <label class="form-label">Historia do Personagem</label>
        <textarea class="form-textarea" id="det-historia" rows="4" placeholder="Conte a historia do seu personagem...">${personagem.historia_personagem}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Notas</label>
        <textarea class="form-textarea" id="det-notas" rows="3" placeholder="Notas livres...">${personagem.notas}</textarea>
      </div>
    </div>
  `;
}

function coletarDetalhes() {
  personagem.nome = document.getElementById('det-nome')?.value?.trim() || personagem.nome;
  personagem.nivel = parseInt(document.getElementById('det-nivel')?.value) || 1;
  personagem.aparencia = document.getElementById('det-aparencia')?.value || '';
  personagem.personalidade = document.getElementById('det-personalidade')?.value || '';
  personagem.ideais = document.getElementById('det-ideais')?.value || '';
  personagem.lacos = document.getElementById('det-lacos')?.value || '';
  personagem.defeitos = document.getElementById('det-defeitos')?.value || '';
  personagem.historia_personagem = document.getElementById('det-historia')?.value || '';
  personagem.notas = document.getElementById('det-notas')?.value || '';
}
