// ============================================================
// Wizard de Criação de Personagem (7 passos)
// ============================================================
import { CLASSES_INFO, PERICIAS, ATRIBUTOS_NOMES, ATRIBUTOS_KEYS, ATRIBUTO_NOME_PARA_KEY, STANDARD_ARRAY, POINT_BUY_CUSTOS, POINT_BUY_TOTAL } from '../dados-classes.js';
import { getClasse, getAntecedentes, getEspecies, getTalentos, getMagiasClasse, getIndiceMagias, getArmas, getArmaduras, getEquipamentoAventura } from '../db.js';
import { criarPersonagemVazio, salvarPersonagem } from '../store.js';
import { calcMod, fmtMod, calcPVNivel1, bonusProficiencia, getEspacosMagia, getTruquesConhecidos, getMagiaPreparadas, toast, abrirModal, mdParaHtml, semAcento, getDeslocamento, getTamanho } from '../utils.js';

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
      { nome: 'Infernal', descricao: 'Resistência Ígneo + Raio de Fogo + Repreensão Diabólica (nv.3) + Escuridão (nv.5)' }
    ]
  }
};

// Truques concedidos automaticamente por espécie/traço
function obterTruquesEspecie(especie, tracosEscolhidos) {
  const truques = [];
  const escolha = (tracosEscolhidos || [])[0] || '';

  if (especie === 'Aasimar') {
    truques.push('Luz');
  } else if (especie === 'Gnomo') {
    if (escolha === 'Gnomo das Rochas') {
      truques.push('Prestidigitação Arcana', 'Reparar');
    } else if (escolha === 'Gnomo do Bosque') {
      truques.push('Ilusão Menor');
    }
  } else if (especie === 'Tiferino') {
    truques.push('Taumaturgia'); // Presença Sobrenatural
    const legadoTruque = { 'Abissal': 'Rajada de Veneno', 'Ctônico': 'Toque Necrótico', 'Infernal': 'Raio de Fogo' };
    if (legadoTruque[escolha]) truques.push(legadoTruque[escolha]);
  } else if (especie === 'Elfo') {
    const linhagemTruque = { 'Alto Elfo': 'Prestidigitação Arcana', 'Drow': 'Luzes Dançantes', 'Elfo Silvestre': 'Arte Druídica' };
    if (linhagemTruque[escolha]) truques.push(linhagemTruque[escolha]);
  }

  return truques;
}

// Opcoes de ferramentas para talentos que exigem escolhas de proficiencia
const FERRAMENTAS_TODAS = [
  'Ferramentas de Carpinteiro', 'Ferramentas de Cartógrafo', 'Ferramentas de Coureiro',
  'Ferramentas de Entalhador', 'Ferramentas de Ferreiro', 'Ferramentas de Funileiro',
  'Ferramentas de Joalheiro', 'Ferramentas de Oleiro', 'Ferramentas de Pedreiro',
  'Ferramentas de Sapateiro', 'Ferramentas de Tecelão', 'Ferramentas de Vidreiro',
  'Suprimentos de Alquimista', 'Suprimentos de Calígrafo', 'Suprimentos de Cervejeiro',
  'Suprimentos de Pintor', 'Utensílios de Cozinheiro',
  'Ferramentas de Ladrão', 'Ferramentas de Navegador',
  'Kit de Disfarce', 'Kit de Falsificação', 'Kit de Herbalismo', 'Kit de Veneno'
];

const INSTRUMENTOS_MUSICAIS = [
  'Alaúde', 'Flauta', 'Flauta de Pan', 'Gaita de Foles', 'Lira',
  'Oboé', 'Tambor', 'Trombeta', 'Violino', 'Xilofone'
];

const FERRAMENTAS_ARTESAO = [
  'Ferramentas de Carpinteiro', 'Ferramentas de Cartógrafo', 'Ferramentas de Coureiro',
  'Ferramentas de Entalhador', 'Ferramentas de Ferreiro', 'Ferramentas de Funileiro',
  'Ferramentas de Joalheiro', 'Ferramentas de Oleiro', 'Ferramentas de Pedreiro',
  'Ferramentas de Sapateiro', 'Ferramentas de Tecelão', 'Ferramentas de Vidreiro',
  'Suprimentos de Alquimista', 'Suprimentos de Calígrafo', 'Suprimentos de Cervejeiro',
  'Suprimentos de Pintor', 'Utensílios de Cozinheiro'
];

/** Renderiza descricao completa de um talento (descricao + beneficios) */
function renderDescricaoTalento(td) {
  if (!td) return '';
  let html = '';
  if (td.descricao) html += `<div class="md-content">${mdParaHtml(td.descricao)}</div>`;
  if (td.beneficios?.length) {
    html += '<div style="margin-top:6px">';
    td.beneficios.forEach(b => {
      html += `<div style="margin-bottom:4px"><strong>${b.nome}:</strong> ${mdParaHtml(b.descricao)}</div>`;
    });
    html += '</div>';
  }
  return html;
}

/** Gera HTML de selecao de escolhas para talentos que exigem (Habilidoso, Artifista, Musico) */
function renderEscolhasTalentoHtml(talentoNome, contexto) {
  // contexto: 'versatil' ou 'antecedente'
  const prefix = `escolha-talento-${contexto}`;
  const escolhasAtuais = personagem.escolhas_talento?.[contexto] || [];

  if (talentoNome === 'Habilidoso') {
    // 3 pericias ou ferramentas a escolha
    const periciasList = PERICIAS.map(p => p.nome);
    const todasOpcoes = [...periciasList, ...FERRAMENTAS_TODAS];
    let html = `<div class="section-divider" style="margin-top:8px"><span>Escolhas — Habilidoso</span></div>`;
    html += `<div class="info-box info" style="font-size:0.8rem">Escolha 3 pericias ou ferramentas para adquirir proficiencia.</div>`;
    for (let i = 0; i < 3; i++) {
      const valorAtual = escolhasAtuais[i] || '';
      html += `<select class="${prefix}" data-idx="${i}" style="width:100%;padding:6px;border-radius:var(--radius-sm);border:1px solid var(--border);font-size:0.85rem;margin:4px 0">`;
      html += `<option value="">-- Escolha ${i + 1} --</option>`;
      html += `<optgroup label="Pericias">`;
      periciasList.forEach(p => {
        html += `<option value="${p}" ${valorAtual === p ? 'selected' : ''}>${p}</option>`;
      });
      html += `</optgroup><optgroup label="Ferramentas">`;
      FERRAMENTAS_TODAS.forEach(f => {
        html += `<option value="${f}" ${valorAtual === f ? 'selected' : ''}>${f}</option>`;
      });
      html += `</optgroup></select>`;
    }
    return html;
  }

  if (talentoNome === 'Artifista') {
    let html = `<div class="section-divider" style="margin-top:8px"><span>Escolhas — Artifista</span></div>`;
    html += `<div class="info-box info" style="font-size:0.8rem">Escolha 3 Ferramentas de Artesao para adquirir proficiencia.</div>`;
    for (let i = 0; i < 3; i++) {
      const valorAtual = escolhasAtuais[i] || '';
      html += `<select class="${prefix}" data-idx="${i}" style="width:100%;padding:6px;border-radius:var(--radius-sm);border:1px solid var(--border);font-size:0.85rem;margin:4px 0">`;
      html += `<option value="">-- Escolha ${i + 1} --</option>`;
      FERRAMENTAS_ARTESAO.forEach(f => {
        html += `<option value="${f}" ${valorAtual === f ? 'selected' : ''}>${f}</option>`;
      });
      html += `</select>`;
    }
    return html;
  }

  if (talentoNome === 'Músico') {
    let html = `<div class="section-divider" style="margin-top:8px"><span>Escolhas — Musico</span></div>`;
    html += `<div class="info-box info" style="font-size:0.8rem">Escolha 3 Instrumentos Musicais para adquirir proficiencia.</div>`;
    for (let i = 0; i < 3; i++) {
      const valorAtual = escolhasAtuais[i] || '';
      html += `<select class="${prefix}" data-idx="${i}" style="width:100%;padding:6px;border-radius:var(--radius-sm);border:1px solid var(--border);font-size:0.85rem;margin:4px 0">`;
      html += `<option value="">-- Escolha ${i + 1} --</option>`;
      INSTRUMENTOS_MUSICAIS.forEach(inst => {
        html += `<option value="${inst}" ${valorAtual === inst ? 'selected' : ''}>${inst}</option>`;
      });
      html += `</select>`;
    }
    return html;
  }

  return '';
}

/** Verifica se um talento exige escolhas adicionais */
function talentoExigeEscolhas(nome) {
  return ['Habilidoso', 'Artifista', 'Músico'].includes(nome);
}

/** Retorna quantas escolhas o talento exige */
function talentoNumEscolhas(nome) {
  if (['Habilidoso', 'Artifista', 'Músico'].includes(nome)) return 3;
  return 0;
}

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
  'Druida': {
    ordem_primal: {
      titulo: 'Ordem Primal',
      descricao: 'Escolha sua ordem primal. Isso afeta proficiências e conjuração.',
      maxEscolhas: 1,
      opcoes: [
        { nome: 'Protetor', descricao: 'Proficiência com armas Marciais e Armadura Média', efeito: { armaduras: ['Média'], armas: ['Marcial'] } },
        { nome: 'Xamã', descricao: '+1 truque de Druida e bônus em Arcanismo/Natureza', efeito: { truques_extra: 1 } }
      ]
    }
  },
  'Guerreiro': {
    estilo_luta: {
      titulo: 'Estilo de Luta',
      descricao: 'Escolha um talento de Estilo de Luta.',
      nivelMinimo: 1,
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
  'Guardião': {
    estilo_luta: {
      titulo: 'Estilo de Luta (Nível 2)',
      descricao: 'Escolha um talento de Estilo de Luta (ou Combatente Druídico).',
      nivelMinimo: 2,
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
        { nome: 'Protetivo', descricao: 'Impõe desvantagem em ataques contra aliados' },
        { nome: 'Combatente Druídico', descricao: 'Aprende 2 truques de Druida; pode trocá-los ao subir de nível' }
      ]
    },
    especialista: {
      titulo: 'Explorador Hábil: Especialista (Nível 2)',
      descricao: 'Escolha 1 perícia na qual você já tenha proficiência para ganhar Especialização.',
      nivelMinimo: 2,
      maxEscolhas: 1,
      tipo: 'pericias'
    }
  },
  'Ladino': {
    especialista: {
      titulo: 'Especialização',
      descricao: 'Escolha 2 perícias nas quais você já tem proficiência para ter Especialização (dobra o bônus).',
      nivelMinimo: 1,
      maxEscolhas: 2,
      tipo: 'pericias' // indica que deve usar lista de perícias do personagem
    }
  },
  'Paladino': {
    estilo_luta: {
      titulo: 'Estilo de Luta (Nível 2)',
      descricao: 'Escolha um talento de Estilo de Luta (ou Combatente Abençoado).',
      nivelMinimo: 2,
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
        { nome: 'Protetivo', descricao: 'Impõe desvantagem em ataques contra aliados' },
        { nome: 'Combatente Abençoado', descricao: 'Aprende 2 truques de Clérigo; pode trocá-los ao subir de nível' }
      ]
    }
  },
  'Mago': {
    academico: {
      titulo: 'Acadêmico (Nível 2)',
      descricao: 'Escolha 2 perícias para Especialização: Arcanismo, História, Investigação, Medicina, Natureza ou Religião.',
      nivelMinimo: 2,
      maxEscolhas: 2,
      tipo: 'pericias_fixas',
      opcoes_fixas: ['Arcanismo', 'História', 'Investigação', 'Medicina', 'Natureza', 'Religião']
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

// Mapa de kits que sao colecoes de itens (devem ser expandidos nos componentes individuais)
// Kits funcionais (Kit de Curandeiro, Kit de Escalada) NAO devem ser expandidos
const KITS_EXPANSAO = {
  'Kit de Artista': [
    { nome: 'Caixa para Fogo', qtd: 1 },
    { nome: 'Cantil (cheio)', qtd: 1 },
    { nome: 'Espelho', qtd: 1 },
    { nome: 'Roupas, Fantasia', qtd: 3 },
    { nome: 'Lanterna Foca-facho', qtd: 1 },
    { nome: 'Mochila', qtd: 1 },
    { nome: 'Óleo', qtd: 8 },
    { nome: 'Rações', qtd: 9 },
    { nome: 'Saco de Dormir', qtd: 1 },
    { nome: 'Sino', qtd: 1 },
  ],
  'Kit de Assaltante': [
    { nome: 'Caixa para Fogo', qtd: 1 },
    { nome: 'Cantil (cheio)', qtd: 1 },
    { nome: 'Corda', qtd: 1 },
    { nome: 'Esferas de Metal', qtd: 1 },
    { nome: 'Lanterna Coberta', qtd: 1 },
    { nome: 'Mochila', qtd: 1 },
    { nome: 'Óleo', qtd: 7 },
    { nome: 'Pé de Cabra', qtd: 1 },
    { nome: 'Rações', qtd: 5 },
    { nome: 'Sino', qtd: 1 },
    { nome: 'Vela', qtd: 10 },
  ],
  'Kit de Aventureiro': [
    { nome: 'Caixa para Fogo', qtd: 1 },
    { nome: 'Cantil (cheio)', qtd: 1 },
    { nome: 'Corda', qtd: 1 },
    { nome: 'Mochila', qtd: 1 },
    { nome: 'Óleo', qtd: 2 },
    { nome: 'Rações', qtd: 10 },
    { nome: 'Saco de Dormir', qtd: 1 },
    { nome: 'Tocha', qtd: 10 },
  ],
  'Kit de Diplomata': [
    { nome: 'Baú', qtd: 1 },
    { nome: 'Caixa para Fogo', qtd: 1 },
    { nome: 'Caneta Tinteiro', qtd: 5 },
    { nome: 'Estojo, Mapa ou Pergaminho', qtd: 2 },
    { nome: 'Lâmpada', qtd: 1 },
    { nome: 'Óleo', qtd: 4 },
    { nome: 'Perfume', qtd: 1 },
    { nome: 'Papel', qtd: 5 },
    { nome: 'Pergaminho', qtd: 5 },
    { nome: 'Roupas, Finas', qtd: 1 },
    { nome: 'Tinta', qtd: 1 },
  ],
  'Kit de Erudito': [
    { nome: 'Caixa para Fogo', qtd: 1 },
    { nome: 'Caneta Tinteiro', qtd: 1 },
    { nome: 'Lâmpada', qtd: 1 },
    { nome: 'Livro', qtd: 1 },
    { nome: 'Mochila', qtd: 1 },
    { nome: 'Óleo', qtd: 10 },
    { nome: 'Pergaminho', qtd: 10 },
    { nome: 'Tinta', qtd: 1 },
  ],
  'Kit de Explorador de Masmorras': [
    { nome: 'Caixa para Fogo', qtd: 1 },
    { nome: 'Cantil (cheio)', qtd: 1 },
    { nome: 'Corda', qtd: 1 },
    { nome: 'Estrepes', qtd: 1 },
    { nome: 'Mochila', qtd: 1 },
    { nome: 'Óleo', qtd: 2 },
    { nome: 'Pé de Cabra', qtd: 1 },
    { nome: 'Rações', qtd: 10 },
    { nome: 'Tocha', qtd: 10 },
  ],
  'Kit de Sacerdote': [
    { nome: 'Água Benta', qtd: 1 },
    { nome: 'Caixa para Fogo', qtd: 1 },
    { nome: 'Cobertor', qtd: 1 },
    { nome: 'Lâmpada', qtd: 1 },
    { nome: 'Mochila', qtd: 1 },
    { nome: 'Rações', qtd: 7 },
    { nome: 'Túnica', qtd: 1 },
  ],
};
// Alias: "Kit de Explorador" (Druida) aponta para "Kit de Explorador de Masmorras"
KITS_EXPANSAO['Kit de Explorador'] = KITS_EXPANSAO['Kit de Explorador de Masmorras'];

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

// Limpa os dados associados a um passo especifico do wizard
// Chamado ao voltar para um passo anterior, limpando os passos posteriores
function limparDadosDoPasso(stepIndex) {
  const stepId = STEPS[stepIndex]?.id;
  if (!stepId) return;

  switch (stepId) {
    case 'especie':
      personagem.especie = '';
      personagem.tracos_escolhidos = [];
      break;

    case 'antecedente':
      personagem.antecedente = '';
      personagem.talentos = [];
      personagem.escolhas_antecedente = {};
      personagem.bonus_antecedente = {};
      delete dadosCache.pericias_antecedente;
      delete dadosCache.atributos_antecedente;
      delete dadosCache.bonus2;
      delete dadosCache.bonus1;
      delete dadosCache.bonus111;
      break;

    case 'atributos':
      personagem.atributos = { forca: 10, destreza: 10, constituicao: 10, inteligencia: 10, sabedoria: 10, carisma: 10 };
      personagem.atributos_base = { forca: 10, destreza: 10, constituicao: 10, inteligencia: 10, sabedoria: 10, carisma: 10 };
      personagem.pericias_proficientes = [];
      delete dadosCache.attrMode;
      delete dadosCache.stdAssign;
      delete dadosCache.pbValues;
      delete dadosCache.rolagemValores;
      delete dadosCache.rolagemDados;
      delete dadosCache.rolagemAssign;
      delete dadosCache.pericias_classe_sel;
      break;

    case 'equipamento':
      personagem.inventario = [];
      personagem.escolha_equip_classe = null;
      personagem.escolha_equip_antecedente = null;
      personagem.instrumento_classe_escolhido = null;
      personagem.po = 0;
      break;

    case 'magias':
      personagem.magias_conhecidas = [];
      personagem.magias_preparadas = [];
      personagem.grimorio = [];
      personagem.espacos_magia = {};
      delete dadosCache.magiasClasse;
      delete dadosCache.indiceMagias;
      break;

    case 'detalhes':
      personagem.alinhamento = '';
      personagem.aparencia = '';
      personagem.personalidade = '';
      personagem.ideais = '';
      personagem.lacos = '';
      personagem.defeitos = '';
      personagem.historia_personagem = '';
      personagem.notas = '';
      personagem.tamanho = '';
      personagem.idiomas = ['Comum'];
      break;
  }
}

// Limpa todos os passos de (stepAlvo + 1) ate stepAtual (inclusive)
// Exemplo: de step 4 voltando para step 1 -> limpa steps 2, 3, 4
function limparPassosPosteriores(stepAlvo) {
  for (let i = stepAlvo + 1; i <= stepAtual; i++) {
    limparDadosDoPasso(i);
  }
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
  document.getElementById('btn-prev')?.addEventListener('click', () => {
    // Limpar dados do passo atual antes de voltar
    limparDadosDoPasso(stepAtual);
    stepAtual--;
    renderWizard();
  });
  document.getElementById('btn-next')?.addEventListener('click', () => avancar());
  document.getElementById('btn-finalizar')?.addEventListener('click', () => finalizar());

  // Clique nas steps para navegar diretamente (somente para passos já visitados)
  container.querySelectorAll('.wizard-step').forEach(el => {
    el.addEventListener('click', () => {
      const target = parseInt(el.dataset.step);
      if (target < stepAtual) {
        // Limpar dados de todos os passos posteriores ao destino
        limparPassosPosteriores(target);
        stepAtual = target;
        renderWizard();
      }
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
          // Ignorar escolhas com nivel minimo acima do nivel atual
          const nivelMin = parseInt(config.nivelMinimo || 1);
          if ((personagem.nivel || 1) < nivelMin) continue;
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
      // Validar distribuicao de bonus de atributos do antecedente
      {
        const bonusKeys = Object.keys(personagem.bonus_antecedente || {});
        const bonusTotal = Object.values(personagem.bonus_antecedente || {}).reduce((s, v) => s + v, 0);
        if (bonusTotal < 3) {
          toast('Distribua os bônus de atributos do antecedente (+2/+1 ou +1/+1/+1)', 'error');
          return false;
        }
      }
      return true;
    case 'atributos': {
      const modo = dadosCache.attrMode || 'standard';

      // Validacao especifica por modo de distribuicao
      if (modo === 'standard') {
        // Conjunto Padrao: todos os 6 atributos devem estar atribuidos via stdAssign
        const assignKeys = Object.keys(dadosCache.stdAssign || {});
        if (assignKeys.length < 6) {
          toast(`Distribua todos os valores do Conjunto Padrão (${assignKeys.length}/6 atribuídos)`, 'error');
          return false;
        }
      } else if (modo === 'pointbuy') {
        // Compra de Pontos: todos os pontos devem ter sido gastos (restante = 0)
        const custoTotal = ATRIBUTOS_KEYS.reduce((sum, k) => sum + (POINT_BUY_CUSTOS[dadosCache.pbValues?.[k] ?? 8] || 0), 0);
        const restante = POINT_BUY_TOTAL - custoTotal;
        if (restante > 0) {
          toast(`Gaste todos os pontos de Compra de Pontos (${restante} restantes)`, 'error');
          return false;
        }
        if (restante < 0) {
          toast('Você excedeu o limite de pontos na Compra de Pontos', 'error');
          return false;
        }
      } else if (modo === 'rolagem') {
        // Rolagem 4d6: todos os 6 atributos devem ter sido rolados
        const rolados = Object.keys(dadosCache.rolagemValores || {});
        if (rolados.length < 6) {
          toast(`Role os dados para todos os atributos (${rolados.length}/6 rolados)`, 'error');
          return false;
        }
      }

      // Verificar pericias da classe
      const infoAttr = CLASSES_INFO[personagem.classe];
      const periciasSel = dadosCache.pericias_classe_sel || [];
      if (infoAttr && periciasSel.length < infoAttr.num_pericias) {
        toast(`Selecione ${infoAttr.num_pericias} perícias da classe (${periciasSel.length} selecionadas)`, 'error');
        return false;
      }
      return true;
    }
    case 'equipamento': {
      // Verificar se o equipamento inicial da classe foi selecionado (quando ha opcoes)
      const classeDataEq = dadosCache.classeData;
      const equipTexto = classeDataEq?.tracos_basicos?.['Equipamento Inicial'] || '';
      const temOpcoesClasse = equipTexto.match(/Escolha\s+[A-Z]/i);
      if (temOpcoesClasse && !personagem.escolha_equip_classe) {
        toast('Selecione o equipamento inicial da classe', 'error');
        return false;
      }
      // Verificar se requer escolha de instrumento musical
      if (/instrumento musical à sua escolha/i.test(equipTexto) && !personagem.instrumento_classe_escolhido) {
        toast('Escolha um Instrumento Musical para o equipamento da classe', 'error');
        return false;
      }
      // Verificar equip do antecedente
      const antEq = dadosCache.antecedentes?.find(a => a.nome === personagem.antecedente);
      const equipAntTexto = antEq?.equipamento?.replace(/\*/g, '') || '';
      const temOpcoesAnt = equipAntTexto.match(/Escolha\s+[A-Z]/i);
      if (temOpcoesAnt && !personagem.escolha_equip_antecedente) {
        toast('Selecione o equipamento do antecedente', 'error');
        return false;
      }
      return true;
    }
    case 'magias': {
      // Validar seleção de truques e magias para conjuradores
      const infoMagia = CLASSES_INFO[personagem.classe];
      const _temIM = (personagem.talentos || []).includes('Iniciado em Magia');

      if (infoMagia?.conjurador) {
        const tabelaCaract = dadosCache.classeData?.tabela_caracteristicas;
        if (!tabelaCaract) return true;

        let truquesNecessarios = getTruquesConhecidos(tabelaCaract, personagem.nivel);
        const preparadasNecessarias = getMagiaPreparadas(tabelaCaract, personagem.nivel);

        // Bonus de truques do Clerigo Taumaturgo
        if (personagem.classe === 'Clérigo' && personagem.ordem_divina === 'Taumaturgo') {
          truquesNecessarios += 1;
        }
        // Bonus de truques do Druida Xama
        if (personagem.classe === 'Druida' && (personagem.ordem_primal === 'Xamã' || personagem.escolhas_classe?.ordem_primal?.[0] === 'Xamã')) {
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
      }

      // Validar Iniciado em Magia
      if (_temIM) {
        const im = personagem.iniciado_em_magia;
        if (!im?.lista) { toast('Iniciado em Magia: selecione a lista de magias', 'error'); return false; }
        if (!im?.atributo) { toast('Iniciado em Magia: selecione o atributo de conjuração', 'error'); return false; }
        if ((im?.truques || []).length < 2) { toast('Iniciado em Magia: selecione 2 truques', 'error'); return false; }
        if (!im?.magia) { toast('Iniciado em Magia: selecione 1 magia de 1o círculo', 'error'); return false; }
      }
      return true;
    }
    case 'detalhes':
      return true;
  }
  return true;
}

// Validacao final antes de criar o personagem
function validarFinal() {
  coletarDetalhes();
  if (!personagem.nome || personagem.nome === 'Sem Nome') {
    toast('Informe o nome do personagem', 'error');
    return false;
  }
  // Verificar idiomas (deve ter pelo menos Comum + os adicionais obrigatorios)
  const regraVal = obterRegraIdiomasAtual();
  const idiomasSel = (personagem.idiomas || []).filter(i => i !== 'Comum');
  if (regraVal.maxAdicionais > 0 && idiomasSel.length < regraVal.maxAdicionais) {
    toast(`Selecione ${regraVal.maxAdicionais} idiomas adicionais (${idiomasSel.length} selecionados)`, 'error');
    return false;
  }
  return true;
}

async function finalizar() {
  // Validar dados finais antes de criar
  if (!validarFinal()) return;

  // Calcular PV
  const info = CLASSES_INFO[personagem.classe];
  if (info) {
    const modCon = calcMod(personagem.atributos.constituicao);
    personagem.pv_max = calcPVNivel1(info.dado_vida, modCon);
    // Tenacidade Anã: +1 PV por nível
    if (personagem.especie === 'Anão') {
      personagem.pv_max += personagem.nivel || 1;
      personagem.bonus_pv_anao_aplicado = personagem.nivel || 1;
    }
    // Vigoroso: +2 PV por nível
    const _temVigoroso = (personagem.talentos || []).some(t => (typeof t === 'string' ? t : t.nome) === 'Vigoroso');
    if (_temVigoroso) {
      const _bonusVig = (personagem.nivel || 1) * 2;
      personagem.pv_max += _bonusVig;
      personagem.bonus_pv_vigoroso_aplicado = _bonusVig;
    }
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

  // Aplicar Ordem Primal do Druida
  if (personagem.classe === 'Druida' && (personagem.ordem_primal === 'Protetor' || personagem.escolhas_classe?.ordem_primal?.[0] === 'Protetor')) {
    if (!personagem.proficiencias_extra) personagem.proficiencias_extra = [];
    personagem.proficiencias_extra.push('Armas Marciais', 'Armadura Média');
  }

  // Aplicar expertise de classes que escolhem na criação
  if (!personagem.pericias_expertise) personagem.pericias_expertise = [];

  // Ladino: 2 perícias para Especialização (nível 1)
  if (personagem.classe === 'Ladino' && personagem.escolhas_classe?.especialista?.length) {
    personagem.escolhas_classe.especialista.forEach(p => {
      if (!personagem.pericias_expertise.includes(p)) {
        personagem.pericias_expertise.push(p);
      }
    });
  }

  // Guardião: Explorador Hábil - 1 perícia para Especialização (nível 2)
  if (personagem.classe === 'Guardião' && personagem.escolhas_classe?.especialista?.length) {
    personagem.escolhas_classe.especialista.forEach(p => {
      if (!personagem.pericias_expertise.includes(p)) {
        personagem.pericias_expertise.push(p);
      }
    });
  }

  // Mago: Acadêmico - 2 perícias de conhecimento para Especialização (nível 2)
  if (personagem.classe === 'Mago' && personagem.escolhas_classe?.academico?.length) {
    personagem.escolhas_classe.academico.forEach(p => {
      if (!personagem.pericias_expertise.includes(p)) {
        personagem.pericias_expertise.push(p);
      }
    });
  }

  if (!personagem.nome) personagem.nome = 'Sem Nome';

  // Aplicar resistencias/vulnerabilidades/imunidades da especie
  // Mapeamento baseado no Livro do Jogador 2024
  const resistenciasEspecie = [];
  const especie = personagem.especie;
  const tracosEscolhidos = personagem.tracos_escolhidos || [];

  if (especie === 'Aasimar') {
    // Resistência Celestial: Necrótico e Radiante
    resistenciasEspecie.push('Necrótico', 'Radiante');
  } else if (especie === 'Anão') {
    // Resistência a Toxinas: Venenoso
    resistenciasEspecie.push('Venenoso');
  } else if (especie === 'Draconato') {
    // Resistência ao tipo de dano da Herança Dracônica
    const herancaMap = {
      'Azul': 'Elétrico', 'Branco': 'Gélido', 'Bronze': 'Elétrico',
      'Cobre': 'Ácido', 'Latão': 'Ígneo', 'Negro': 'Ácido',
      'Ouro': 'Ígneo', 'Prata': 'Gélido', 'Verde': 'Venenoso', 'Vermelho': 'Ígneo'
    };
    const dragao = tracosEscolhidos[0];
    if (dragao && herancaMap[dragao]) {
      resistenciasEspecie.push(herancaMap[dragao]);
    }
  } else if (especie === 'Tiferino') {
    // Resistência pelo Legado Ínfero
    const legadoMap = {
      'Abissal': 'Venenoso', 'Ctônico': 'Necrótico', 'Infernal': 'Ígneo'
    };
    const legado = tracosEscolhidos[0];
    if (legado && legadoMap[legado]) {
      resistenciasEspecie.push(legadoMap[legado]);
    }
  }

  // Aplicar resistencias da especie (sem duplicar existentes)
  if (resistenciasEspecie.length > 0) {
    if (!personagem.resistencias) personagem.resistencias = [];
    for (const r of resistenciasEspecie) {
      if (!personagem.resistencias.includes(r)) {
        personagem.resistencias.push(r);
      }
    }
  }

  // Adicionar truques concedidos pela espécie/traço (sem duplicar)
  const truquesEspecie = obterTruquesEspecie(especie, tracosEscolhidos);
  if (truquesEspecie.length > 0) {
    if (!personagem.magias_conhecidas) personagem.magias_conhecidas = [];
    for (const nome of truquesEspecie) {
      if (!personagem.magias_conhecidas.find(m => m.nome === nome)) {
        personagem.magias_conhecidas.push({ nome, circulo: 0, origem: 'especie' });
      }
    }
  }

  // Adicionar magias do Iniciado em Magia (truques e magia de 1o circulo)
  if (personagem.iniciado_em_magia?.lista) {
    const im = personagem.iniciado_em_magia;
    if (!personagem.magias_conhecidas) personagem.magias_conhecidas = [];
    for (const nome of (im.truques || [])) {
      if (!personagem.magias_conhecidas.find(m => m.nome === nome)) {
        personagem.magias_conhecidas.push({ nome, circulo: 0, origem: 'iniciado_em_magia' });
      }
    }
    // A magia de 1o circulo fica sempre preparada (origem especial)
    if (im.magia) {
      if (!personagem.magias_preparadas) personagem.magias_preparadas = [];
      if (!personagem.magias_preparadas.find(m => m.nome === im.magia)) {
        personagem.magias_preparadas.push({ nome: im.magia, circulo: 1, origem: 'iniciado_em_magia' });
      }
    }
  }

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
    if (personagem.ordem_primal) escolhasTxt.push(personagem.ordem_primal);
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
        <label class="form-label">Subclasse (obrigatória no nível ${nivelSub})</label>
        <select class="form-select" id="sel-subclasse">
          <option value="">Selecione uma subclasse</option>
          ${classeData.subclasses.map(s => `<option value="${s.nome}" ${personagem.subclasse === s.nome ? 'selected' : ''}>${s.nome}</option>`).join('')}
        </select>
      </div>`;
  } else if (classeData?.subclasses?.length) {
    subclassesHtml = `
      <div class="info-box" style="font-size:0.85rem;margin-top:8px">
        Subclasse disponível a partir do nível ${nivelSub}. Subclasses: ${classeData.subclasses.map(s => s.nome).join(', ')}
      </div>`;
  }

  // Escolhas obrigatórias da classe (Ordem Divina, Estilo de Luta, etc.)
  const classeEscolhas = CLASSES_ESCOLHAS[nome];
  let escolhasHtml = '';
  if (classeEscolhas) {
    for (const [chave, config] of Object.entries(classeEscolhas)) {
      // Filtrar por nivel minimo: nao exibir escolhas de nivel superior ao do personagem
      const nivelMinConfig = parseInt(config.nivelMinimo || 1);
      if ((personagem.nivel || 1) < nivelMinConfig) continue;
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
      } else if (config.tipo === 'pericias_fixas') {
        // Tipo pericias_fixas: exibe lista fixa de pericias independente da classe
        const opcoes = config.opcoes_fixas || [];
        escolhasHtml += `
          <div class="section-divider mt-2"><span>${config.titulo}</span></div>
          <div class="info-box info" style="font-size:0.85rem">${config.descricao}</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin:8px 0" id="escolha-${chave}">
            ${opcoes.map(p => `
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

  // Características de nível 1
  const caracteristicasExcluir = ['Ordem Divina', 'Estilo de Luta', 'Especialista', 'Explorador Hábil', 'Acadêmico'];
  let caracteristicas1 = '';
  if (classeData?.caracteristicas) {
    const feats = classeData.caracteristicas.filter(c => c.nivel === 1 && !caracteristicasExcluir.includes(c.nome));
    if (feats.length) {
      caracteristicas1 = `
        <div class="section-divider"><span>Características Nível 1</span></div>
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
      <div class="col-2"><strong>Atributo Primário:</strong> ${info.atributo_primario}</div>
      <div class="col-2"><strong>Salvaguardas:</strong> ${salvaguardas}</div>
      <div class="col-2"><strong>Armaduras:</strong> ${armaduras}</div>
      <div class="col-2"><strong>Armas:</strong> ${armas}</div>
    </div>
    <div style="font-size:0.85rem;margin-top:8px">
      <strong>Perícias (escolha ${info.num_pericias}):</strong> ${pericias}
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
        if (chave === 'ordem_primal') {
          personagem.ordem_primal = selecionados[0] || '';
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
        const nivelMinimo = parseInt(config.nivelMinimo || 1);
        if ((personagem.nivel || 1) < nivelMinimo) continue;
        const selecionados = personagem.escolhas_classe?.[chave] || [];
        if (selecionados.length < config.maxEscolhas) {
          toast(`Selecione ${config.maxEscolhas} opção(ões) de ${config.titulo}`, 'error');
          return;
        }
      }
    }
    // Se mudou de classe, limpar dados especificos da classe anterior
    if (personagem.classe && personagem.classe !== nome) {
      personagem.subclasse = '';
      personagem.ordem_divina = '';
      personagem.ordem_primal = '';
      personagem.escolhas_classe = {};
      personagem.extras_classe = {};
      personagem.proficiencias_extra = [];
      delete dadosCache.classeData;
    }
    personagem.classe = nome;
    // Compatibilidade: migrar ordem_divina
    if (nome === 'Clérigo' && personagem.ordem_divina && !personagem.escolhas_classe?.ordem_divina) {
      if (!personagem.escolhas_classe) personagem.escolhas_classe = {};
      personagem.escolhas_classe.ordem_divina = [personagem.ordem_divina];
    }
    if (nome === 'Druida' && personagem.ordem_primal && !personagem.escolhas_classe?.ordem_primal) {
      if (!personagem.escolhas_classe) personagem.escolhas_classe = {};
      personagem.escolhas_classe.ordem_primal = [personagem.ordem_primal];
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

  // HTML de selecao de pericia de especie (Habil / Sentidos Aguçados)
  let periciaEspecieHtml = '';
  if (nome === 'Humano') {
    // Habil: qualquer pericia
    const opcsPericia = PERICIAS.map(p => {
      const sel = personagem.pericia_especie === p.nome ? 'selected' : '';
      return `<option value="${p.nome}" ${sel}>${p.nome} (${p.atributo})</option>`;
    }).join('');
    periciaEspecieHtml = `
      <div class="section-divider"><span>Habil — Pericia Extra</span></div>
      <div class="info-box info" style="font-size:0.85rem">O traco Habil concede proficiencia em uma pericia a sua escolha.</div>
      <select id="select-pericia-especie" style="width:100%;padding:8px;border-radius:var(--radius-sm);border:1px solid var(--border);font-size:0.9rem;margin:8px 0">
        <option value="">-- Escolha uma pericia --</option>
        ${opcsPericia}
      </select>
    `;
  } else if (nome === 'Elfo') {
    // Sentidos Aguçados: Intuição, Percepção ou Sobrevivência
    const opcsElfo = ['Intuição', 'Percepção', 'Sobrevivência'].map(p => {
      const sel = personagem.pericia_especie === p ? 'selected' : '';
      return `<option value="${p}" ${sel}>${p}</option>`;
    }).join('');
    periciaEspecieHtml = `
      <div class="section-divider"><span>Sentidos Aguçados — Pericia</span></div>
      <div class="info-box info" style="font-size:0.85rem">Voce tem proficiencia na pericia Intuição, Percepção ou Sobrevivência.</div>
      <select id="select-pericia-especie" style="width:100%;padding:8px;border-radius:var(--radius-sm);border:1px solid var(--border);font-size:0.9rem;margin:8px 0">
        <option value="">-- Escolha uma pericia --</option>
        ${opcsElfo}
      </select>
    `;
  }

  // HTML especial para Humano: selecao de talento de origem (Versatil)
  let versatilHtml = '';
  if (nome === 'Humano') {
    versatilHtml = `
      <div class="section-divider"><span>Versatil — Talento de Origem</span></div>
      <div class="info-box info" style="font-size:0.85rem">O traco Versatil concede um talento de Origem extra. Escolha abaixo:</div>
      <select id="select-talento-versatil" style="width:100%;padding:8px;border-radius:var(--radius-sm);border:1px solid var(--border);font-size:0.9rem;margin:8px 0">
        <option value="">-- Escolha um talento de Origem --</option>
      </select>
      <div id="versatil-talento-detalhe"></div>
    `;
  }

  const corpoHtml = `
    <p style="font-size:0.85rem;margin-bottom:12px">${esp.descricao?.split('\n')[0] || ''}</p>
    <div style="font-size:0.85rem;margin-bottom:8px"><strong>Deslocamento:</strong> ${deslocamento}</div>
    ${escolhaHtml}
    ${periciaEspecieHtml}
    ${versatilHtml}
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

  // Carregar talentos de origem para o select Versatil (Humano)
  if (nome === 'Humano') {
    (async () => {
      try {
        const talentosData = await getTalentos();
        const talentosOrigem = (talentosData?.por_categoria?.['de Origem'] || []).sort((a, b) => a.nome.localeCompare(b.nome));
        const selectEl = document.getElementById('select-talento-versatil');
        if (selectEl) {
          talentosOrigem.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.nome;
            opt.textContent = t.nome;
            if (personagem.talento_versatil === t.nome) opt.selected = true;
            selectEl.appendChild(opt);
          });

          // Funcao auxiliar para atualizar detalhe + escolhas do talento
          const atualizarDetalheVersatil = (nomeT) => {
            const detalheEl = document.getElementById('versatil-talento-detalhe');
            if (!detalheEl) return;
            if (!nomeT) { detalheEl.innerHTML = ''; return; }
            const td = talentosOrigem.find(t => t.nome === nomeT);
            if (!td) { detalheEl.innerHTML = ''; return; }
            let html = `<div class="info-box success" style="font-size:0.85rem">${renderDescricaoTalento(td)}</div>`;
            html += renderEscolhasTalentoHtml(nomeT, 'versatil');
            detalheEl.innerHTML = html;
          };

          // Mostrar detalhe do talento ja selecionado
          if (personagem.talento_versatil) {
            atualizarDetalheVersatil(personagem.talento_versatil);
          }
          selectEl.addEventListener('change', () => {
            // Limpar escolhas anteriores ao trocar de talento
            if (!personagem.escolhas_talento) personagem.escolhas_talento = {};
            delete personagem.escolhas_talento.versatil;
            atualizarDetalheVersatil(selectEl.value);
          });
        }
      } catch (e) { console.error('Erro ao carregar talentos de Origem:', e); }
    })();
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
    // Validar pericia de especie (Habil / Sentidos Aguçados)
    if (nome === 'Humano' || nome === 'Elfo') {
      const selectPericia = document.getElementById('select-pericia-especie');
      if (!selectPericia?.value) {
        const traco = nome === 'Humano' ? 'Habil' : 'Sentidos Aguçados';
        toast(`Selecione a pericia de ${traco}`, 'error');
        return;
      }
      personagem.pericia_especie = selectPericia.value;
    }
    // Validar talento Versatil para Humano
    if (nome === 'Humano') {
      const selectVersatil = document.getElementById('select-talento-versatil');
      if (!selectVersatil?.value) {
        toast('Selecione um Talento de Origem (Versatil)', 'error');
        return;
      }
      personagem.talento_versatil = selectVersatil.value;

      // Validar e salvar escolhas do talento Versatil (Habilidoso, Artifista, Musico)
      const numEscolhas = talentoNumEscolhas(selectVersatil.value);
      if (numEscolhas > 0) {
        const selects = document.querySelectorAll('.escolha-talento-versatil');
        const vals = [...selects].map(s => s.value).filter(Boolean);
        if (vals.length < numEscolhas) {
          toast(`Selecione todas as ${numEscolhas} escolhas de ${selectVersatil.value}`, 'error');
          return;
        }
        // Verificar duplicatas
        if (new Set(vals).size < vals.length) {
          toast('Nao repita opcoes nas escolhas do talento', 'error');
          return;
        }
        if (!personagem.escolhas_talento) personagem.escolhas_talento = {};
        personagem.escolhas_talento.versatil = vals;
      } else {
        if (!personagem.escolhas_talento) personagem.escolhas_talento = {};
        delete personagem.escolhas_talento.versatil;
      }
    }
    // Limpar tracos se mudou de especie
    if (personagem.especie !== nome) {
      personagem.tracos_escolhidos = [];
      // Limpar talento versatil se mudou de especie
      if (nome !== 'Humano') delete personagem.talento_versatil;
      // Limpar pericia de especie se mudou para especie sem essa escolha
      if (nome !== 'Humano' && nome !== 'Elfo') delete personagem.pericia_especie;
    }
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
      delete dadosCache.bonus2;
      delete dadosCache.bonus1;
      delete dadosCache.bonus111;
    }
    personagem.antecedente = nome;

    // Aplicar pericias do antecedente
    dadosCache.pericias_antecedente = pericias;
    dadosCache.atributos_antecedente = atributosDisponiveis;

    // Talento do antecedente
    if (talentoNome && !personagem.talentos.includes(talentoNome)) {
      personagem.talentos = [talentoNome];
    }

    // Preservar talento Versatil (Humano) no array de talentos
    // Verificar conflito: mesmo talento não-repetível do antecedente e Versátil
    if (personagem.talento_versatil && personagem.talento_versatil === talentoNome) {
      const _talentosOrigemRepetiveis = ['Habilidoso', 'Iniciado em Magia'];
      if (!_talentosOrigemRepetiveis.includes(talentoNome)) {
        toast(`O talento "${talentoNome}" já está selecionado como Versátil e não é repetível. Altere sua escolha na etapa de Espécie.`, 'error');
        return;
      }
    }
    if (personagem.talento_versatil && !personagem.talentos.includes(personagem.talento_versatil)) {
      personagem.talentos.push(personagem.talento_versatil);
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

    // Restaurar bonus se ja tinha selecao anterior
    if (dadosCache.bonus111?.length) {
      personagem.bonus_antecedente = {};
      dadosCache.bonus111.forEach(attr => {
        const key = ATRIBUTO_NOME_PARA_KEY[attr];
        if (key) personagem.bonus_antecedente[key] = 1;
      });
    }
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

    <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
      <label class="form-check">
        <input type="radio" name="attr-mode" value="standard" ${(!dadosCache.attrMode || dadosCache.attrMode === 'standard') ? 'checked' : ''}> Conjunto Padrão
      </label>
      <label class="form-check">
        <input type="radio" name="attr-mode" value="pointbuy" ${dadosCache.attrMode === 'pointbuy' ? 'checked' : ''}> Compra de Pontos
      </label>
      <label class="form-check">
        <input type="radio" name="attr-mode" value="rolagem" ${dadosCache.attrMode === 'rolagem' ? 'checked' : ''}> Rolagem 4d6
      </label>
      <label class="form-check" style="opacity:0.5;cursor:not-allowed" title="Opção desabilitada">
        <input type="radio" name="attr-mode" value="manual" disabled> Manual
      </label>
    </div>

    <div id="attr-content"></div>

    <div class="section-divider mt-2"><span>Perícias da Classe</span></div>
    <div class="info-box info">
      Escolha ${info?.num_pericias || 2} perícias da classe.
      ${dadosCache.pericias_antecedente?.length ? `<br>Já possui do antecedente: <strong>${dadosCache.pericias_antecedente.join(', ')}</strong>` : ''}
      ${personagem.pericia_especie ? `<br>Já possui da espécie: <strong>${personagem.pericia_especie}</strong>` : ''}
      ${(() => {
        const pTalento = [];
        if (personagem.escolhas_talento) {
          ['antecedente', 'versatil'].forEach(ctx => {
            (personagem.escolhas_talento[ctx] || []).forEach(e => {
              if (PERICIAS.some(p => p.nome === e)) pTalento.push(e);
            });
          });
        }
        return pTalento.length ? `<br>Já possui dos talentos: <strong>${pTalento.join(', ')}</strong>` : '';
      })()}
    </div>
    <div id="pericias-content"></div>
  `;

  // Se o modo salvo era 'manual' (agora desabilitado), resetar para 'standard'
  if (dadosCache.attrMode === 'manual') dadosCache.attrMode = 'standard';

  const renderAttr = () => {
    const modo = document.querySelector('[name="attr-mode"]:checked')?.value || 'standard';
    dadosCache.attrMode = modo;
    const attrEl = document.getElementById('attr-content');
    switch (modo) {
      case 'standard': renderStandardArray(attrEl); break;
      case 'pointbuy': renderPointBuy(attrEl); break;
      case 'rolagem': renderRolagem4d6(attrEl); break;
      case 'manual': renderManual(attrEl); break;
    }
  };

  el.querySelectorAll('[name="attr-mode"]').forEach(r => r.addEventListener('change', renderAttr));
  renderAttr();
  renderPericiasSeletor();
}

// Rola 4d6 e descarta o menor dado
function rolar4d6() {
  const dados = Array.from({ length: 4 }, () => Math.floor(Math.random() * 6) + 1);
  dados.sort((a, b) => a - b);
  const descartado = dados.shift(); // remove o menor
  return { total: dados.reduce((s, d) => s + d, 0), dados: [descartado, ...dados], descartado };
}

function renderRolagem4d6(el) {
  const info = CLASSES_INFO[personagem.classe];

  // Inicializar valores de rolagem se necessário
  if (!dadosCache.rolagemValores) {
    dadosCache.rolagemValores = {};
    dadosCache.rolagemDados = {};
  }

  // Verificar se já tem valores rolados para atribuir
  const valoresRolados = Object.values(dadosCache.rolagemValores);
  const todosRolados = ATRIBUTOS_KEYS.every(k => dadosCache.rolagemValores[k] !== undefined);

  // Montar distribuição: se usou assign mode
  if (!dadosCache.rolagemAssign) dadosCache.rolagemAssign = {};
  const usados = Object.values(dadosCache.rolagemAssign);

  el.innerHTML = `
    <div class="info-box info">
      Role 4d6 para cada atributo e descarte o menor dado. Clique em "Rolar" para gerar valores.
    </div>
    <div style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap">
      <button class="btn btn-sm btn-accent" id="btn-rolar-todos">Rolar Todos</button>
      <button class="btn btn-sm btn-secondary" id="btn-limpar-rolagem">Limpar</button>
    </div>
    <div class="atributos-grid">
      ${ATRIBUTOS_KEYS.map(key => {
        const nome = ATRIBUTOS_NOMES[key];
        const rolagemInfo = dadosCache.rolagemDados[key];
        const valorBase = dadosCache.rolagemValores[key];
        const bonus = personagem.bonus_antecedente[key] || 0;
        const valorFinal = valorBase !== undefined ? valorBase + bonus : null;
        const mod = valorFinal !== null ? calcMod(valorFinal) : null;
        const ehPrimario = info?.atributo_primario?.includes(nome);

        // Mostrar dados rolados
        let dadosHtml = '';
        if (rolagemInfo) {
          dadosHtml = rolagemInfo.dados.map((d, i) =>
            `<span style="display:inline-block;width:22px;height:22px;line-height:22px;text-align:center;border-radius:4px;font-size:0.75rem;font-weight:700;${i === 0 ? 'background:#fee;color:#c00;text-decoration:line-through;opacity:0.5' : 'background:var(--bg-tertiary);color:var(--text-primary)'}">${d}</span>`
          ).join(' ');
        }

        return `
          <div class="atributo-box ${ehPrimario ? 'destaque' : ''}" data-key="${key}">
            <div class="atributo-nome">${nome}${ehPrimario ? ' *' : ''}</div>
            <button class="btn btn-sm ${valorBase !== undefined ? 'btn-secondary' : 'btn-primary'}" data-rolar-key="${key}" style="margin:4px 0;font-size:0.75rem">
              ${valorBase !== undefined ? 'Re-rolar' : 'Rolar'}
            </button>
            ${dadosHtml ? `<div style="display:flex;gap:2px;justify-content:center;margin:2px 0">${dadosHtml}</div>` : ''}
            ${bonus > 0 ? `<div style="font-size:0.7rem;color:var(--success)">+${bonus} antec.</div>` : ''}
            ${valorFinal !== null ? `
              <div class="atributo-mod">${fmtMod(mod)}</div>
              <div class="atributo-valor">${valorFinal}</div>
            ` : '<div class="atributo-mod" style="color:var(--text-muted)">--</div>'}
          </div>`;
      }).join('')}
    </div>
  `;

  // Evento: rolar individual
  el.querySelectorAll('[data-rolar-key]').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.rolarKey;
      const resultado = rolar4d6();
      dadosCache.rolagemValores[key] = resultado.total;
      dadosCache.rolagemDados[key] = resultado;

      // Atualizar atributos do personagem
      personagem.atributos_base[key] = resultado.total;
      personagem.atributos[key] = resultado.total + (personagem.bonus_antecedente[key] || 0);
      renderRolagem4d6(el);
    });
  });

  // Evento: rolar todos
  document.getElementById('btn-rolar-todos')?.addEventListener('click', () => {
    ATRIBUTOS_KEYS.forEach(key => {
      const resultado = rolar4d6();
      dadosCache.rolagemValores[key] = resultado.total;
      dadosCache.rolagemDados[key] = resultado;
      personagem.atributos_base[key] = resultado.total;
      personagem.atributos[key] = resultado.total + (personagem.bonus_antecedente[key] || 0);
    });
    renderRolagem4d6(el);
  });

  // Evento: limpar
  document.getElementById('btn-limpar-rolagem')?.addEventListener('click', () => {
    dadosCache.rolagemValores = {};
    dadosCache.rolagemDados = {};
    dadosCache.rolagemAssign = {};
    ATRIBUTOS_KEYS.forEach(key => {
      personagem.atributos_base[key] = 10;
      personagem.atributos[key] = 10 + (personagem.bonus_antecedente[key] || 0);
    });
    renderRolagem4d6(el);
  });
}

// Distribuicoes sugeridas de atributos padrao por classe.
// IMPORTANTE: os valores abaixo sao INDICES do STANDARD_ARRAY, nao os atributos finais.
// Mapeamento de indice -> valor: 0->15, 1->14, 2->13, 3->12, 4->10, 5->8.
// Exemplo: { forca: 0, destreza: 2 } significa Forca 15 e Destreza 13.
// Conforme tabela "Conjunto Padrao por Classe" do Livro do Jogador 2024 (cap.2)
const DISTRIBUICOES_SUGERIDAS = {
  'Bárbaro':    { forca: 0, destreza: 2, constituicao: 1, inteligencia: 4, sabedoria: 3, carisma: 5 },  // For15 Des13 Con14 Int10 Sab12 Car8
  'Bardo':      { forca: 5, destreza: 1, constituicao: 3, inteligencia: 2, sabedoria: 4, carisma: 0 },  // For8  Des14 Con12 Int13 Sab10 Car15
  'Bruxo':      { forca: 5, destreza: 1, constituicao: 2, inteligencia: 3, sabedoria: 4, carisma: 0 },  // For8  Des14 Con13 Int12 Sab10 Car15
  'Clérigo':    { forca: 1, destreza: 5, constituicao: 2, inteligencia: 4, sabedoria: 0, carisma: 3 },  // For14 Des8  Con13 Int10 Sab15 Car12
  'Druida':     { forca: 5, destreza: 3, constituicao: 1, inteligencia: 2, sabedoria: 0, carisma: 4 },  // For8  Des12 Con14 Int13 Sab15 Car10
  'Feiticeiro': { forca: 4, destreza: 2, constituicao: 1, inteligencia: 5, sabedoria: 3, carisma: 0 },  // For10 Des13 Con14 Int8  Sab12 Car15
  'Guardião':   { forca: 3, destreza: 0, constituicao: 2, inteligencia: 5, sabedoria: 1, carisma: 4 },  // For12 Des15 Con13 Int8  Sab14 Car10
  'Guerreiro':  { forca: 0, destreza: 1, constituicao: 2, inteligencia: 5, sabedoria: 4, carisma: 3 },  // For15 Des14 Con13 Int8  Sab10 Car12
  'Ladino':     { forca: 3, destreza: 0, constituicao: 2, inteligencia: 1, sabedoria: 4, carisma: 5 },  // For12 Des15 Con13 Int14 Sab10 Car8
  'Mago':       { forca: 5, destreza: 3, constituicao: 2, inteligencia: 0, sabedoria: 1, carisma: 4 },  // For8  Des12 Con13 Int15 Sab14 Car10
  'Monge':      { forca: 3, destreza: 0, constituicao: 2, inteligencia: 4, sabedoria: 1, carisma: 5 },  // For12 Des15 Con13 Int10 Sab14 Car8
  'Paladino':   { forca: 0, destreza: 4, constituicao: 2, inteligencia: 5, sabedoria: 3, carisma: 1 }   // For15 Des10 Con13 Int8  Sab12 Car14
};

function renderStandardArray(el) {
  const info = CLASSES_INFO[personagem.classe];
  if (!dadosCache.stdAssign) {
    dadosCache.stdAssign = {};
  }

  const usados = Object.values(dadosCache.stdAssign);
  const disponiveis = STANDARD_ARRAY.filter((v, i) => !usados.includes(i));
  const temSugestao = DISTRIBUICOES_SUGERIDAS[personagem.classe];

  el.innerHTML = `
    <div class="info-box warning">Distribua os valores [${STANDARD_ARRAY.join(', ')}] entre seus atributos.</div>
    ${temSugestao ? `
      <button class="btn btn-sm btn-accent" id="btn-dist-sugerida" style="margin-bottom:8px">
        ⚡ Usar distribuição sugerida para ${personagem.classe}
      </button>
    ` : ''}
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

  // Botão de distribuição sugerida
  document.getElementById('btn-dist-sugerida')?.addEventListener('click', () => {
    const dist = DISTRIBUICOES_SUGERIDAS[personagem.classe];
    if (!dist) return;
    dadosCache.stdAssign = { ...dist };
    ATRIBUTOS_KEYS.forEach(k => {
      const idx = dadosCache.stdAssign[k];
      const base = idx !== undefined ? STANDARD_ARRAY[idx] : 10;
      const bonus = personagem.bonus_antecedente[k] || 0;
      personagem.atributos_base[k] = base;
      personagem.atributos[k] = base + bonus;
    });
    renderStandardArray(el);
  });

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

  const periciasBg = [...(dadosCache.pericias_antecedente || [])];
  // Incluir pericia de especie (Habil / Sentidos Aguçados) se houver
  if (personagem.pericia_especie && !periciasBg.includes(personagem.pericia_especie)) {
    periciasBg.push(personagem.pericia_especie);
  }
  // Incluir pericias dos talentos (Habilidoso concede pericias/ferramentas)
  if (personagem.escolhas_talento) {
    ['antecedente', 'versatil'].forEach(ctx => {
      const escolhas = personagem.escolhas_talento[ctx] || [];
      escolhas.forEach(e => {
        // So incluir se for uma pericia (nao ferramenta)
        if (PERICIAS.some(p => p.nome === e) && !periciasBg.includes(e)) {
          periciasBg.push(e);
        }
      });
    });
  }
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
      // Remove também a conjuncao " e" residual antes do valor de PO (ex: "Kit de Artista e 19 PO" -> "Kit de Artista")
      let itensStr = poMatch ? conteudo.replace(/,?\s*e?\s*\d+\s*PO$/i, '').trim() : conteudo;
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
  for (let itemStr of opcao.itens) {
    // Resolver itens com "à sua escolha" - substituir por escolha do jogador se disponivel
    if (/à sua escolha/i.test(itemStr)) {
      // Para instrumentos musicais, usar o instrumento escolhido (do antecedente Artista ou escolha da classe)
      if (/instrumento musical/i.test(itemStr)) {
        const instrEscolhido = personagem.instrumento_classe_escolhido || personagem.instrumento_escolhido;
        if (instrEscolhido) {
          itemStr = instrEscolhido;
        } else {
          // Fallback: adicionar como "Instrumento Musical" generico
          itemStr = 'Instrumento Musical';
        }
      } else {
        // Outros itens "à sua escolha" - remover sufixo
        itemStr = itemStr.replace(/\s*à sua escolha/i, '').trim();
      }
    }

    // Verificar se tem quantidade (ex: "2 Adagas", "20 Flechas")
    const qtyMatch = itemStr.match(/^(\d+)\s+(.+)$/);
    // Verificar formato "Nome (X unidades)" (ex: "Óleo (3 frascos)", "Pergaminho (10 folhas)")
    const qtyParenMatch = !qtyMatch ? itemStr.match(/^(.+?)\s*\((\d+)\s+\w+\)$/) : null;
    const quantidade = qtyMatch ? parseInt(qtyMatch[1]) : (qtyParenMatch ? parseInt(qtyParenMatch[2]) : 1);
    const nomeItem = qtyMatch ? qtyMatch[2] : (qtyParenMatch ? qtyParenMatch[1].trim() : itemStr);

    // Expandir kits que sao colecoes de itens (ex: Kit de Sacerdote -> seus itens individuais)
    const kitConteudo = KITS_EXPANSAO[nomeItem];
    if (kitConteudo) {
      for (const comp of kitConteudo) {
        const equipComp = dadosCache.equipAvent?.find(e =>
          semAcento(e.nome).toLowerCase() === semAcento(comp.nome).toLowerCase()
        );
        if (equipComp) {
          personagem.inventario.push({
            nome: equipComp.nome,
            tipo: 'equipamento',
            quantidade: comp.qtd,
            equipado: false,
            dados: { custo: equipComp.custo, peso: equipComp.peso, tipo_uso: equipComp.tipo_uso || '', descricao: equipComp.descricao || '' },
            origemTipo: tipoOrigem,
            origemNome: nomeOrigem
          });
        } else {
          // Fallback: item nao encontrado no banco, adicionar como generico
          personagem.inventario.push({
            nome: comp.nome,
            tipo: 'generico',
            quantidade: comp.qtd,
            equipado: false,
            dados: {},
            origemTipo: tipoOrigem,
            origemNome: nomeOrigem
          });
        }
      }
      continue;
    }

    // Singularizar nome para busca (ex: "Adagas" -> "Adaga", "Flechas" -> "Flecha")
    const nomeSingular = nomeItem
      .replace(/([ãõ])es$/i, '$1o')  // ex: não usado aqui, mas seguro
      .replace(/ões$/i, 'ão')
      .replace(/s$/i, '');

    // Tentar encontrar nos dados de armas (tenta plural original e depois singular)
    const arma = dadosCache.armas?.find(a => {
      const nomeArma = semAcento(a.nome).toLowerCase();
      return nomeArma === semAcento(nomeItem).toLowerCase() || nomeArma === semAcento(nomeSingular).toLowerCase();
    });
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

    // Tentar encontrar nas armaduras (tenta plural, singular e sem prefixo "Armadura de")
    const nomeItemSemPrefixo = nomeItem.replace(/^Armadura de /i, '');
    const nomeSingularSemPrefixo = nomeSingular.replace(/^Armadura de /i, '');
    const armadura = dadosCache.armaduras?.find(a => {
      const nomeArm = semAcento(a.nome).toLowerCase();
      return nomeArm === semAcento(nomeItem).toLowerCase()
        || nomeArm === semAcento(nomeSingular).toLowerCase()
        || nomeArm === semAcento(nomeItemSemPrefixo).toLowerCase()
        || nomeArm === semAcento(nomeSingularSemPrefixo).toLowerCase();
    });
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

    // Tentar encontrar em equipamento de aventura (tenta plural e singular)
    const equip = dadosCache.equipAvent?.find(e => {
      const nomeEquip = semAcento(e.nome).toLowerCase();
      return nomeEquip === semAcento(nomeItem).toLowerCase() || nomeEquip === semAcento(nomeSingular).toLowerCase();
    });
    if (equip) {
      personagem.inventario.push({
        nome: equip.nome,
        tipo: 'equipamento',
        quantidade,
        equipado: false,
        dados: { custo: equip.custo, peso: equip.peso, tipo_uso: equip.tipo_uso || '', descricao: equip.descricao || '' },
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

  // Equipamento inicial da classe (chave "Equipamento Inicial" em tracos_basicos)
  let equipClasse = classeData?.tracos_basicos?.['Equipamento Inicial'] || '';

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

  // Verificar se o equipamento da classe requer escolha de instrumento musical
  const classeTemInstrumento = /instrumento musical à sua escolha/i.test(equipClasse);
  const instrumentosDisponiveis = ['Alaude', 'Corne', 'Flauta', 'Flauta de Pa', 'Gaita de Foles', 'Harpa', 'Lira', 'Oboe', 'Tambor', 'Violino'];

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

    ${classeTemInstrumento ? `
    <div class="card mb-2" style="border-left:3px solid var(--primary)">
      <div class="card-header"><h3>Instrumento Musical (Classe)</h3></div>
      <div style="padding:4px 0">
        <select class="form-input" id="select-instrumento-classe" style="max-width:280px">
          <option value="">-- Escolha um instrumento --</option>
          ${instrumentosDisponiveis.map(i => `<option value="${i}" ${personagem.instrumento_classe_escolhido === i ? 'selected' : ''}>${i}</option>`).join('')}
        </select>
      </div>
    </div>` : ''}

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

  // Evento de escolha de instrumento musical da classe
  document.getElementById('select-instrumento-classe')?.addEventListener('change', (e) => {
    personagem.instrumento_classe_escolhido = e.target.value || null;
    // Re-adicionar itens da opcao de classe selecionada para atualizar o instrumento
    if (personagem.escolha_equip_classe && opcoesClasse) {
      const opcao = opcoesClasse.find(o => o.letra === personagem.escolha_equip_classe);
      if (opcao) {
        adicionarItensEquipamentoInicial(opcao, 'classe', personagem.classe);
        const listaEl = document.getElementById('lista-inventario');
        if (listaEl) listaEl.innerHTML = renderListaInventario();
        setupEventosInventario(el);
      }
    }
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

  // Badge de tipo de uso (consumivel, equipamento)
  let tipoBadge = '';
  const tipoUso = item.dados?.tipo_uso || '';
  if (tipoUso === 'consumivel') {
    tipoBadge = '<span class="badge" style="font-size:0.6rem;background:#e8f5e9;color:#2e7d32;border:1px solid #a5d6a7">Consumível</span>';
  }

  // Descricao curta para equipamentos
  const descCurta = item.dados?.descricao || item.descricao || '';
  const descPreview = descCurta && item.tipo === 'equipamento'
    ? `<div class="inv-item-detalhe" style="font-size:0.7rem;color:var(--text-muted);margin-top:1px">${descCurta.length > 80 ? descCurta.substring(0, 80) + '...' : descCurta}</div>`
    : '';

  return `
    <div class="inv-item ${item.equipado ? 'inv-item-equipado' : ''}" data-idx="${idx}" draggable="true">
      <div class="inv-drag-handle" title="Arrastar para reordenar">&#9776;</div>
      <div style="flex:1;cursor:pointer" data-info-inv="${idx}" title="Ver detalhes">
        <div class="inv-item-nome">${item.nome} ${profBadge} ${tipoBadge}</div>
        <div class="inv-item-detalhe">
          ${item.tipo === 'arma' ? `${item.dados?.dano || ''} | ${item.dados?.propriedades || ''}` : ''}
          ${item.tipo === 'armadura' ? `CA: ${item.dados?.ca || ''} | ${item.dados?.categoria || ''}` : ''}
          ${item.tipo === 'escudo' ? `CA: ${item.dados?.ca || ''} | Escudo` : ''}
          ${item.tipo === 'equipamento' ? `${item.dados?.custo || ''} ${item.dados?.peso ? '| ' + item.dados.peso : ''}` : ''}
          ${item.tipo === 'customizado' ? `${item.descricao || ''}` : ''}
          ${item.tipo === 'generico' ? `${item.descricao || ''}` : ''}
        </div>
        ${descPreview}
      </div>
      <div class="inv-item-acoes" style="align-items:center">
        <div class="inv-qty-control" style="display:flex;align-items:center;gap:2px">
          <button class="btn btn-sm btn-icon" data-qty-minus-inv="${idx}" style="font-size:0.7rem;padding:1px 5px">−</button>
          <span style="min-width:20px;text-align:center;font-size:0.8rem;font-weight:700">${item.quantidade ?? 1}</span>
          <button class="btn btn-sm btn-icon" data-qty-plus-inv="${idx}" style="font-size:0.7rem;padding:1px 5px">+</button>
        </div>
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

  // Quantidade +/-
  containerEl.querySelectorAll('[data-qty-plus-inv]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.qtyPlusInv);
      if (personagem.inventario[idx]) {
        personagem.inventario[idx].quantidade = (personagem.inventario[idx].quantidade ?? 1) + 1;
        const listaEl = document.getElementById('lista-inventario');
        if (listaEl) { listaEl.innerHTML = renderListaInventario(); setupEventosInventario(containerEl); }
      }
    });
  });
  containerEl.querySelectorAll('[data-qty-minus-inv]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.qtyMinusInv);
      if (personagem.inventario[idx]) {
        const novaQtd = Math.max(0, (personagem.inventario[idx].quantidade ?? 1) - 1);
        if (novaQtd <= 0) {
          personagem.inventario.splice(idx, 1);
        } else {
          personagem.inventario[idx].quantidade = novaQtd;
        }
        const listaEl = document.getElementById('lista-inventario');
        if (listaEl) { listaEl.innerHTML = renderListaInventario(); setupEventosInventario(containerEl); }
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
    <div id="lista-armas" style="min-height:35dvh;max-height:50dvh;overflow-y:auto">
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
    <div id="lista-armaduras" style="min-height:35dvh;max-height:50dvh;overflow-y:auto">
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
    <div id="lista-itens" style="min-height:35dvh;max-height:50dvh;overflow-y:auto">
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
  const tipoConj = info?.tipo_conjuracao || 'preparadas';
  const labelMagias = tipoConj === 'conhecidas' ? 'Magias conhecidas' : 'Magias preparadas';

  const temIniciadoEmMagia = (personagem.talentos || []).includes('Iniciado em Magia');

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

  // Bônus de truques do Clérigo Taumaturgo
  if (personagem.classe === 'Clérigo' && personagem.ordem_divina === 'Taumaturgo') {
    numTruques += 1;
  }

  // Bônus de truques do Druida Xamã
  if (personagem.classe === 'Druida' && (personagem.ordem_primal === 'Xamã' || personagem.escolhas_classe?.ordem_primal?.[0] === 'Xamã')) {
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
      ${labelMagias}: <strong>${(personagem.magias_preparadas || []).length}/${numPreparadas}</strong> |
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
        ${isTruque ? `Truques selecionados: ${selecionadas.length}/${maxSel}` : `${labelMagias}: ${totalSel}/${maxSel}`}
        ${magiasDaClasse.length > 0 ? ` | ${magiasDaClasse.length} disponíveis` : ''}
      </div>
      ${magiasDaClasse.length === 0
        ? '<div style="color:var(--text-muted);text-align:center;padding:20px">Nenhuma magia disponível neste círculo</div>'
        : `<div class="magias-grid">${magiasDaClasse.map(m => {
            const nome = m.nome || m;
            const sel = selecionadas.includes(nome);
            return `
              <div class="magia-card ${sel ? 'selecionada' : ''}" data-magia-nome="${nome}" data-magia-circ="${circ}">
                <span class="magia-card-check" data-creator-check="${nome}"></span>
                <div class="magia-card-nome" data-creator-info="${nome}" data-creator-info-circ="${circ}">${nome}</div>
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
        toggleMagia(nome, circ, isTruque, numTruques, numPreparadas);
        renderMagiasCirculo(circ);
        atualizarContadoresMagia(numTruques, numPreparadas);
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

  // Se tiver Iniciado em Magia, adicionar seção extra após as magias da classe
  if (temIniciadoEmMagia) {
    const divIM = document.createElement('div');
    divIM.style.marginTop = '20px';
    el.appendChild(divIM);
    await _renderIniciadoEmMagia(divIM);
  }
}

// --- Iniciado em Magia: seleção de lista, truques e magia de 1o circulo ---
async function _renderIniciadoEmMagia(container) {
  if (!personagem.iniciado_em_magia) {
    personagem.iniciado_em_magia = { lista: '', atributo: '', truques: [], magia: '' };
  }
  const im = personagem.iniciado_em_magia;
  const listasDisponiveis = ['Clérigo', 'Druida', 'Mago'];
  const atributosDisponiveis = ['Inteligência', 'Sabedoria', 'Carisma'];

  container.innerHTML = `
    <div class="card" style="border-color:var(--accent)">
      <div class="card-header"><h3>Iniciado em Magia</h3></div>
      <div style="display:flex;flex-wrap:wrap;gap:12px;margin-bottom:12px">
        <div style="flex:1;min-width:150px">
          <label class="form-label">Lista de magias</label>
          <select class="form-input" id="im-lista">
            <option value="">Selecione...</option>
            ${listasDisponiveis.map(l => `<option value="${l}" ${im.lista === l ? 'selected' : ''}>${l}</option>`).join('')}
          </select>
        </div>
        <div style="flex:1;min-width:150px">
          <label class="form-label">Atributo de conjuracao</label>
          <select class="form-input" id="im-atributo">
            <option value="">Selecione...</option>
            ${atributosDisponiveis.map(a => `<option value="${a}" ${im.atributo === a ? 'selected' : ''}>${a}</option>`).join('')}
          </select>
        </div>
      </div>
      <div id="im-contadores" style="font-size:0.85rem;color:var(--text-muted);margin-bottom:8px">
        Truques: <strong>${im.truques.length}/2</strong> | Magia 1o circulo: <strong>${im.magia ? '1' : '0'}/1</strong>
      </div>
      <div id="im-magias-area"></div>
    </div>
  `;

  const atualizarContadoresIM = () => {
    const cEl = document.getElementById('im-contadores');
    if (cEl) {
      cEl.innerHTML = `Truques: <strong>${im.truques.length}/2</strong> | Magia 1o circulo: <strong>${im.magia ? '1' : '0'}/1</strong>`;
    }
  };

  const renderMagiasIM = async () => {
    const area = document.getElementById('im-magias-area');
    if (!area || !im.lista) { if (area) area.innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:10px">Selecione uma lista de magias acima</div>'; return; }

    // Carregar magias da lista selecionada
    const dados = await getMagiasClasse(im.lista);
    const listaMagias = dados?.lista_magias || {};
    const truquesDisp = (listaMagias['Truques'] || []).map(m => typeof m === 'string' ? { nome: m } : m);
    const c1Disp = (listaMagias['1º Círculo'] || []).map(m => typeof m === 'string' ? { nome: m } : m);

    area.innerHTML = `
      <div class="tabs" id="tabs-im">
        <div class="tab active" data-im-tab="truques">Truques (${truquesDisp.length})</div>
        <div class="tab" data-im-tab="c1">1o Circulo (${c1Disp.length})</div>
      </div>
      <div class="search-box"><input type="text" id="busca-im" placeholder="Buscar magia..." class="form-input"></div>
      <div id="im-lista-magias"></div>
    `;

    let tabAtiva = 'truques';

    const renderTabIM = (tab) => {
      tabAtiva = tab;
      const listaEl = document.getElementById('im-lista-magias');
      if (!listaEl) return;
      const isTruque = tab === 'truques';
      const magias = isTruque ? truquesDisp : c1Disp;
      const selecionadas = isTruque ? im.truques : (im.magia ? [im.magia] : []);

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
              return `
                <div class="magia-card ${sel ? 'selecionada' : ''}" data-im-magia="${nome}" data-im-tipo="${tab}">
                  <span class="magia-card-check" data-im-check="${nome}"></span>
                  <div class="magia-card-nome" data-im-info="${nome}" data-im-info-circ="${isTruque ? 0 : 1}">${nome}</div>
                  <div class="magia-card-meta">
                    <span>${m.escola || ''}</span>
                    ${m.especial === 'C' ? '<span>Conc.</span>' : ''}
                    ${m.especial === 'M' ? '<span>M$</span>' : ''}
                  </div>
                </div>`;
            }).join('')}</div>`
        }
      `;

      // Eventos de toggle
      listaEl.querySelectorAll('[data-im-check]').forEach(chk => {
        chk.addEventListener('click', (e) => {
          e.stopPropagation();
          const card = chk.closest('.magia-card');
          const nome = card.dataset.imMagia;
          if (isTruque) {
            const idx = im.truques.indexOf(nome);
            if (idx >= 0) { im.truques.splice(idx, 1); }
            else if (im.truques.length >= 2) { toast('Máximo de 2 truques para Iniciado em Magia', 'error'); return; }
            else { im.truques.push(nome); }
          } else {
            if (im.magia === nome) { im.magia = ''; }
            else { im.magia = nome; }
          }
          renderTabIM(tab);
          atualizarContadoresIM();
        });
      });

      // Detalhe ao clicar no nome
      listaEl.querySelectorAll('[data-im-info]').forEach(el => {
        el.addEventListener('click', async (e) => {
          e.stopPropagation();
          const nome = el.dataset.imInfo;
          const c = parseInt(el.dataset.imInfoCirc);
          await mostrarDetalheMagia(nome, c);
        });
      });
    };

    // Tabs IM
    area.querySelectorAll('[data-im-tab]').forEach(tab => {
      tab.addEventListener('click', () => {
        area.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        renderTabIM(tab.dataset.imTab);
      });
    });

    // Busca IM
    document.getElementById('busca-im')?.addEventListener('input', (e) => {
      const termo = semAcento(e.target.value);
      document.querySelectorAll('#im-lista-magias .magia-card').forEach(el => {
        el.style.display = semAcento(el.textContent).includes(termo) ? '' : 'none';
      });
    });

    renderTabIM('truques');
  };

  // Eventos de selects
  document.getElementById('im-lista')?.addEventListener('change', (e) => {
    im.lista = e.target.value;
    // Limpar seleções ao trocar de lista
    im.truques = [];
    im.magia = '';
    atualizarContadoresIM();
    renderMagiasIM();
  });

  document.getElementById('im-atributo')?.addEventListener('change', (e) => {
    im.atributo = e.target.value;
  });

  // Renderizar magias se já tiver lista selecionada
  await renderMagiasIM();
}

function toggleMagia(nome, circulo, isTruque, maxTruques, maxPreparadas) {
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

function atualizarContadoresMagia(maxTruques, maxPrep) {
  const infoBox = document.querySelector('#wizard-content .info-box.info');
  if (!infoBox) return;
  const numT = (personagem.magias_conhecidas || []).filter(m => m.circulo === 0).length;
  const numP = (personagem.magias_preparadas || []).length;
  const tipoConj = CLASSES_INFO[personagem.classe]?.tipo_conjuracao || 'preparadas';
  const labelMagias = tipoConj === 'conhecidas' ? 'Magias conhecidas' : 'Magias preparadas';
  infoBox.innerHTML = `Truques: <strong>${numT}/${maxTruques}</strong> | ${labelMagias}: <strong>${numP}/${maxPrep}</strong> | Atributo: <strong>${CLASSES_INFO[personagem.classe]?.atributo_conjuracao || ''}</strong>`;
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

// ============================================================
// PASSO 7: DETALHES
// ============================================================

// PHB 2024 (cap. 2): personagem conhece Comum + 2 idiomas da lista de Idiomas Comuns
const IDIOMAS_COMUNS_2024 = [
  'Comum', 'Língua de Sinais Comum', 'Dracônico', 'Anão', 'Élfico',
  'Gigante', 'Gnômico', 'Goblin', 'Pequenino', 'Orc'
];

function obterRegraIdiomasAtual() {
  const antecedente = dadosCache.antecedentes?.find(a => a.nome === personagem.antecedente);
  const especie = dadosCache.especies?.find(e => e.nome === personagem.especie);

  const obrigatorios = new Set(['Comum']);
  let maxAdicionais = antecedente ? 2 : 0;
  let opcoes = new Set(IDIOMAS_COMUNS_2024.filter(i => i !== 'Comum'));

  // Extensível por dados: se no futuro os JSONs tiverem campos de idiomas, esta função já suporta
  const aplicarConfig = (obj) => {
    if (!obj) return;
    if (Array.isArray(obj.idiomas_obrigatorios)) {
      obj.idiomas_obrigatorios.forEach(i => obrigatorios.add(i));
    }
    if (Array.isArray(obj.idiomas_opcoes)) {
      opcoes = new Set(obj.idiomas_opcoes.filter(i => !obrigatorios.has(i)));
    }
    if (Array.isArray(obj.idiomas_extra_opcoes)) {
      obj.idiomas_extra_opcoes.forEach(i => { if (!obrigatorios.has(i)) opcoes.add(i); });
    }
    if (Number.isInteger(obj.idiomas_adicionais)) {
      maxAdicionais = Math.max(0, obj.idiomas_adicionais);
    }
    if (Number.isInteger(obj.idiomas_bonus)) {
      maxAdicionais += Math.max(0, obj.idiomas_bonus);
    }
  };

  aplicarConfig(antecedente);
  aplicarConfig(especie);

  return {
    obrigatorios: [...obrigatorios],
    opcoes: [...opcoes],
    maxAdicionais
  };
}

function sanitizarIdiomasSelecionados(listaIdiomas, regraIdiomas) {
  const obrigatoriosSet = new Set(regraIdiomas.obrigatorios);
  const opcoesSet = new Set(regraIdiomas.opcoes);
  const entrada = Array.isArray(listaIdiomas) ? listaIdiomas : [];

  const adicionais = [...new Set(
    entrada.filter(i => !obrigatoriosSet.has(i) && opcoesSet.has(i))
  )].slice(0, regraIdiomas.maxAdicionais);

  return [...regraIdiomas.obrigatorios, ...adicionais];
}

function renderStepDetalhes(el) {
  const info = CLASSES_INFO[personagem.classe];
  const modCon = calcMod(personagem.atributos.constituicao);
  const pvCalc = info ? calcPVNivel1(info.dado_vida, modCon) 
    + (personagem.especie === 'Anão' ? (personagem.nivel || 1) : 0) 
    + ((personagem.talentos || []).some(t => (typeof t === 'string' ? t : t.nome) === 'Vigoroso') ? (personagem.nivel || 1) * 2 : 0)
    : 0;
  const regraIdiomas = obterRegraIdiomasAtual();
  const obrigatoriosIdiomasSet = new Set(regraIdiomas.obrigatorios);

  // Saneamento: aplica a regra atual de idiomas ao estado do personagem
  personagem.idiomas = sanitizarIdiomasSelecionados(personagem.idiomas, regraIdiomas);

  // Detectar se a espécie permite escolha de tamanho
  const espData = dadosCache.especies?.find(e => e.nome === personagem.especie);
  const textoEsp = espData?.texto_completo || '';
  const permiteTamanhoEscolha = /Médio.*ou Pequeno|Pequeno.*ou Médio/i.test(textoEsp);

  // Tamanho: usar o salvo, ou detectar do texto da espécie
  if (!personagem.tamanho && espData) {
    if (permiteTamanhoEscolha) {
      personagem.tamanho = 'Médio'; // padrao quando ha escolha
    } else {
      personagem.tamanho = getTamanho(textoEsp) || 'Médio';
    }
  }

  // Construir HTML de escolha de tamanho (fora do template literal para evitar conflito de backticks)
  let tamanhoCardHtml = '';
  if (permiteTamanhoEscolha) {
    const matchMedio = textoEsp.match(/Médio\s*\(([^)]+)\)/);
    const matchPequeno = textoEsp.match(/Pequeno\s*\(([^)]+)\)/);
    const alturaMedio = matchMedio ? matchMedio[1] : 'cerca de 1,20-2,10 metros';
    const alturaPequeno = matchPequeno ? matchPequeno[1] : 'cerca de 0,60-1,20 metro';
    const borderMedio = personagem.tamanho === 'Médio' ? 'var(--primary)' : 'var(--border-light)';
    const borderPequeno = personagem.tamanho === 'Pequeno' ? 'var(--primary)' : 'var(--border-light)';
    tamanhoCardHtml = `
    <div class="card mb-2">
      <div class="card-header"><h3>Tamanho da Criatura</h3></div>
      <div class="info-box info" style="font-size:0.85rem">
        A espécie <strong>${personagem.especie}</strong> permite escolher entre Médio ou Pequeno.
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px">
        <div style="border:2px solid ${borderMedio};border-radius:8px;padding:10px;cursor:pointer;transition:border-color 0.2s" data-tamanho-card="Médio">
          <label class="form-check" style="font-weight:700;font-size:0.95rem;margin-bottom:4px">
            <input type="radio" name="det-tamanho" value="Médio" ${personagem.tamanho === 'Médio' ? 'checked' : ''}> Médio
          </label>
          <div style="font-size:0.8rem;color:var(--text-muted)">
            <div>Altura: ${alturaMedio}</div>
            <div>Espaco em combate: 1,5 x 1,5 m</div>
            <div>Capacidade de carga: For x 7 kg</div>
          </div>
        </div>
        <div style="border:2px solid ${borderPequeno};border-radius:8px;padding:10px;cursor:pointer;transition:border-color 0.2s" data-tamanho-card="Pequeno">
          <label class="form-check" style="font-weight:700;font-size:0.95rem;margin-bottom:4px">
            <input type="radio" name="det-tamanho" value="Pequeno" ${personagem.tamanho === 'Pequeno' ? 'checked' : ''}> Pequeno
          </label>
          <div style="font-size:0.8rem;color:var(--text-muted)">
            <div>Altura: ${alturaPequeno}</div>
            <div>Espaco em combate: 1,5 x 1,5 m</div>
            <div>Capacidade de carga: For x 7 kg</div>
          </div>
        </div>
      </div>
      <div class="info-box" style="font-size:0.78rem;margin-top:8px;background:var(--bg-hover)">
        <strong>Diferenças de tamanho:</strong> Ambos ocupam o mesmo espaco em combate e possuem a mesma capacidade de carga.
        Algumas habilidades e magias referenciam o tamanho relativo da criatura (ex: mover-se pelo espaco de criaturas maiores, Imobilizar, Empurrar).
      </div>
    </div>
    `;
  } else {
    // Especie com tamanho fixo - exibir informacao somente leitura
    const matchAltura = textoEsp.match(/(?:Médio|Pequeno|Grande)\s*\(([^)]+)\)/);
    const alturaFixa = matchAltura ? matchAltura[1] : '';
    const tamanhoFixo = personagem.tamanho || 'Médio';
    const espacoCombate = tamanhoFixo === 'Pequeno' ? '1,5 x 1,5 m' : (tamanhoFixo === 'Grande' ? '3 x 3 m' : '1,5 x 1,5 m');
    tamanhoCardHtml = `
    <div class="card mb-2">
      <div class="card-header"><h3>Tamanho da Criatura</h3></div>
      <div style="border:2px solid var(--primary);border-radius:8px;padding:10px;margin-top:4px">
        <div style="font-weight:700;font-size:0.95rem;margin-bottom:4px">${tamanhoFixo}</div>
        <div style="font-size:0.8rem;color:var(--text-muted)">
          ${alturaFixa ? '<div>Altura: ' + alturaFixa + '</div>' : ''}
          <div>Espaco em combate: ${espacoCombate}</div>
          <div>Capacidade de carga: For x 7 kg</div>
        </div>
      </div>
    </div>
    `;
  }

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
      </div>

      <div class="info-box success">
        <strong>Resumo:</strong>
        ${personagem.especie} ${personagem.classe} ${personagem.subclasse ? `(${personagem.subclasse})` : ''} |
        Antecedente: ${personagem.antecedente} |
        PV: ${pvCalc} |
        Talento: ${personagem.talentos.join(', ') || 'Nenhum'}
        ${personagem.iniciado_em_magia?.lista ? `<br>Iniciado em Magia: Lista ${personagem.iniciado_em_magia.lista} | Atributo: ${personagem.iniciado_em_magia.atributo} | Truques: ${(personagem.iniciado_em_magia.truques||[]).join(', ')} | Magia: ${personagem.iniciado_em_magia.magia}` : ''}
      </div>
    </div>

    <!-- Tamanho da Criatura -->
    ${tamanhoCardHtml}

    <!-- Idiomas -->
    <div class="card mb-2">
      <div class="card-header"><h3>Idiomas</h3></div>
      <div class="info-box info" style="font-size:0.85rem">
        Regra validada pelo Livro do Jogador 2024: idiomas da origem (Comum + adicionais).
        <div id="det-idiomas-contador" style="margin-top:4px">Selecionados: <strong>${personagem.idiomas.filter(i => !obrigatoriosIdiomasSet.has(i)).length}/${regraIdiomas.maxAdicionais}</strong></div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px" id="det-idiomas-grid">
        ${[...regraIdiomas.obrigatorios, ...regraIdiomas.opcoes].map(idioma => {
          const selecionado = personagem.idiomas.includes(idioma);
          const ehObrigatorio = obrigatoriosIdiomasSet.has(idioma);
          const atingiuLimite = personagem.idiomas.filter(i => !obrigatoriosIdiomasSet.has(i)).length >= regraIdiomas.maxAdicionais;
          return `
            <label class="form-check" style="min-width:160px;${ehObrigatorio ? 'opacity:0.6' : ''}">
              <input type="checkbox" data-idioma="${idioma}" ${selecionado ? 'checked' : ''} ${ehObrigatorio ? 'disabled' : ''} ${(!ehObrigatorio && !selecionado && atingiuLimite) ? 'disabled' : ''}> ${idioma}
            </label>`;
        }).join('')}
      </div>
    </div>

    <!-- Alinhamento -->
    <div class="card mb-2">
      <div class="card-header"><h3>Alinhamento</h3></div>
      <div class="info-box info" style="font-size:0.85rem">
        O alinhamento descreve as atitudes eticas e morais do personagem.
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:8px" id="det-alinhamento-grid">
        ${[
          { valor: 'OB', label: 'Ordeiro e Bom' },
          { valor: 'NB', label: 'Neutro e Bom' },
          { valor: 'CB', label: 'Caotico e Bom' },
          { valor: 'ON', label: 'Ordeiro e Neutro' },
          { valor: 'N',  label: 'Neutro' },
          { valor: 'CN', label: 'Caotico e Neutro' },
          { valor: 'OM', label: 'Ordeiro e Mau' },
          { valor: 'NM', label: 'Neutro e Mau' },
          { valor: 'CM', label: 'Caotico e Mau' }
        ].map(a => `
          <div class="selection-card ${personagem.alinhamento === a.valor ? 'selected' : ''}" data-alinhamento="${a.valor}" style="cursor:pointer;text-align:center;padding:8px 4px">
            <div class="card-nome" style="font-size:0.8rem">${a.label}</div>
            <div class="card-detalhe" style="font-size:0.7rem;color:var(--text-muted)">${a.valor}</div>
          </div>
        `).join('')}
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

  // Validação interativa de idiomas por regra dinâmica
  const atualizarEstadoIdiomas = () => {
    const checks = [...document.querySelectorAll('[data-idioma]')];
    const selecionadosAdicionais = checks.filter(c => !obrigatoriosIdiomasSet.has(c.dataset.idioma) && c.checked).length;

    checks.forEach(c => {
      const ehObrigatorio = obrigatoriosIdiomasSet.has(c.dataset.idioma);
      if (ehObrigatorio) return;
      if (!c.checked && selecionadosAdicionais >= regraIdiomas.maxAdicionais) c.disabled = true;
      else c.disabled = false;
    });

    const contador = document.getElementById('det-idiomas-contador');
    if (contador) {
      contador.innerHTML = `Selecionados: <strong>${selecionadosAdicionais}/${regraIdiomas.maxAdicionais}</strong>`;
    }
  };

  document.querySelectorAll('[data-idioma]').forEach(cb => {
    cb.addEventListener('change', () => {
      const checks = [...document.querySelectorAll('[data-idioma]')];
      const selecionadosAdicionais = checks.filter(c => !obrigatoriosIdiomasSet.has(c.dataset.idioma) && c.checked).length;
      if (selecionadosAdicionais > regraIdiomas.maxAdicionais) {
        cb.checked = false;
        toast(`Você pode selecionar no máximo ${regraIdiomas.maxAdicionais} idioma(s) adicional(is).`, 'error');
      }
      atualizarEstadoIdiomas();
    });
  });

  atualizarEstadoIdiomas();

  // Eventos de selecao de tamanho (click no card seleciona o radio e atualiza visual)
  document.querySelectorAll('[data-tamanho-card]').forEach(card => {
    card.addEventListener('click', () => {
      const valor = card.dataset.tamanhoCard;
      const radio = card.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;
      personagem.tamanho = valor;
      // Atualizar bordas visuais
      document.querySelectorAll('[data-tamanho-card]').forEach(c => {
        c.style.borderColor = c.dataset.tamanhoCard === valor ? 'var(--primary)' : 'var(--border-light)';
      });
    });
  });

  // Eventos de selecao de alinhamento
  document.querySelectorAll('[data-alinhamento]').forEach(card => {
    card.addEventListener('click', () => {
      const valor = card.dataset.alinhamento;
      personagem.alinhamento = valor;
      document.querySelectorAll('[data-alinhamento]').forEach(c => {
        c.classList.toggle('selected', c.dataset.alinhamento === valor);
      });
    });
  });
}

function coletarDetalhes() {
  personagem.nome = document.getElementById('det-nome')?.value?.trim() || personagem.nome;
  personagem.aparencia = document.getElementById('det-aparencia')?.value || '';
  personagem.personalidade = document.getElementById('det-personalidade')?.value || '';
  personagem.ideais = document.getElementById('det-ideais')?.value || '';
  personagem.lacos = document.getElementById('det-lacos')?.value || '';
  personagem.defeitos = document.getElementById('det-defeitos')?.value || '';
  personagem.historia_personagem = document.getElementById('det-historia')?.value || '';
  personagem.notas = document.getElementById('det-notas')?.value || '';

  // Alinhamento ja eh salvo interativamente via evento de clique

  // Coletar idiomas selecionados
  const idiomasSelecionados = [];
  document.querySelectorAll('[data-idioma]').forEach(cb => {
    if (cb.checked) idiomasSelecionados.push(cb.dataset.idioma);
  });
  const regraIdiomas = obterRegraIdiomasAtual();
  personagem.idiomas = sanitizarIdiomasSelecionados(idiomasSelecionados, regraIdiomas);

  // Coletar tamanho escolhido
  const tamanhoSel = document.querySelector('[name="det-tamanho"]:checked');
  if (tamanhoSel) personagem.tamanho = tamanhoSel.value;
}
