// ============================================================
// Tabelas de escolha e helpers compartilhados pelos passos
//
// Ferramentas, instrumentos, escolhas de classe e antecedente, kits de
// equipamento e o render das escolhas de talento.
// Extraido de site/js/pages/creator.js sem alteracao de comportamento.
// ============================================================
import { PERICIAS } from '../dados-classes.js';
import { mdParaHtml } from '../utils.js';
import { personagem } from './wizard.js';

// Espécies que exigem seleção entre traços/linhagens
// - tracos: nomes de traços que existem no JSON da espécie
// - opcoes: opções customizadas quando não existem como traços separados
export const ESPECIES_TRACOS_ESCOLHA = {
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
      { nome: 'Elfo Silvestre', descricao: 'Deslocamento 10,5m + Arte Druídica + Passos Largos (nv.3) + Passo Sem Rastro (nv.5)' }
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
export function obterTruquesEspecie(especie, tracosEscolhidos) {
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
export const FERRAMENTAS_TODAS = [
  'Ferramentas de Carpinteiro', 'Ferramentas de Cartógrafo', 'Ferramentas de Coureiro',
  'Ferramentas de Entalhador', 'Ferramentas de Ferreiro', 'Ferramentas de Funileiro',
  'Ferramentas de Joalheiro', 'Ferramentas de Oleiro', 'Ferramentas de Pedreiro',
  'Ferramentas de Sapateiro', 'Ferramentas de Tecelão', 'Ferramentas de Vidreiro',
  'Suprimentos de Alquimista', 'Suprimentos de Calígrafo', 'Suprimentos de Cervejeiro',
  'Suprimentos de Pintor', 'Utensílios de Cozinheiro',
  'Ferramentas de Ladrão', 'Ferramentas de Navegador',
  'Kit de Disfarce', 'Kit de Falsificação', 'Kit de Herbalismo', 'Kit de Veneno'
];

export const INSTRUMENTOS_MUSICAIS = [
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
export function renderDescricaoTalento(td) {
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

// Reune tudo que o personagem ja tem de proficiencia em pericia/ferramenta/
// instrumento neste ponto do assistente. Alem dos campos definitivos
// (pericias_proficientes/proficiencias_ferramentas/proficiencias_instrumentos,
// que so sao consolidados no final em validarFinal()), soma tambem as
// escolhas de talento ja confirmadas em OUTROS contextos (escolhas_talento.
// antecedente/versatil) -- sem isso, um Habilidoso repetido (Versatil +
// antecedente, ja que Habilidoso e repetivel) nao veria as 3 escolhas feitas
// no primeiro enquanto o assistente ainda esta em andamento. O contexto
// atual e excluido para nao esconder do proprio select o valor ja marcado
// nele (reabrir o popup para editar precisa continuar mostrando a escolha).
function _proficienciasJaAdquiridas(contextoAtual) {
  const jaTem = new Set([
    ...(personagem.pericias_proficientes || []),
    ...(personagem.proficiencias_ferramentas || []),
    ...(personagem.proficiencias_instrumentos || [])
  ]);
  const escolhas = personagem.escolhas_talento || {};
  for (const contexto of Object.keys(escolhas)) {
    if (contexto === contextoAtual) continue;
    (escolhas[contexto] || []).forEach(item => jaTem.add(item));
  }
  return jaTem;
}

// Aviso quando a filtragem de "ja possui" deixa menos opcoes elegiveis do
// que o numero de escolhas exigidas. Evita renderizar um formulario que
// nunca podera ser concluido sem explicar o motivo.
function _avisoOpcoesInsuficientes(disponiveis, exigidas) {
  if (disponiveis >= exigidas) return '';
  return `<div class="info-box warning" style="font-size:0.8rem;margin-top:4px">Restam apenas ${disponiveis} opcao(oes) elegivel(is) -- o personagem ja e proficiente em todo o resto. Nao e possivel completar as ${exigidas} escolhas exigidas.</div>`;
}

/** Gera HTML de selecao de escolhas para talentos que exigem (Habilidoso, Artifista, Musico) */
export function renderEscolhasTalentoHtml(talentoNome, contexto) {
  // contexto: 'versatil' ou 'antecedente'
  const prefix = `escolha-talento-${contexto}`;
  const escolhasAtuais = personagem.escolhas_talento?.[contexto] || [];
  const jaTem = _proficienciasJaAdquiridas(contexto);

  if (talentoNome === 'Habilidoso') {
    // 3 pericias ou ferramentas a escolha, exceto as que o personagem ja tem
    // (proficiencia repetida nao concede nada nesta edicao)
    const periciasList = PERICIAS.map(p => p.nome).filter(p => !jaTem.has(p));
    const ferramentasList = FERRAMENTAS_TODAS.filter(f => !jaTem.has(f));
    let html = `<div class="section-divider" style="margin-top:8px"><span>Escolhas — Habilidoso</span></div>`;
    html += `<div class="info-box info" style="font-size:0.8rem">Escolha 3 pericias ou ferramentas para adquirir proficiencia.</div>`;
    html += _avisoOpcoesInsuficientes(periciasList.length + ferramentasList.length, 3);
    for (let i = 0; i < 3; i++) {
      const valorAtual = escolhasAtuais[i] || '';
      html += `<select class="${prefix}" data-idx="${i}" style="width:100%;padding:6px;border-radius:var(--radius-sm);border:1px solid var(--border);font-size:0.85rem;margin:4px 0">`;
      html += `<option value="">-- Escolha ${i + 1} --</option>`;
      html += `<optgroup label="Pericias">`;
      periciasList.forEach(p => {
        html += `<option value="${p}" ${valorAtual === p ? 'selected' : ''}>${p}</option>`;
      });
      html += `</optgroup><optgroup label="Ferramentas">`;
      ferramentasList.forEach(f => {
        html += `<option value="${f}" ${valorAtual === f ? 'selected' : ''}>${f}</option>`;
      });
      html += `</optgroup></select>`;
    }
    return html;
  }

  if (talentoNome === 'Artifista') {
    const ferramentasList = FERRAMENTAS_ARTESAO.filter(f => !jaTem.has(f));
    let html = `<div class="section-divider" style="margin-top:8px"><span>Escolhas — Artifista</span></div>`;
    html += `<div class="info-box info" style="font-size:0.8rem">Escolha 3 Ferramentas de Artesao para adquirir proficiencia.</div>`;
    html += _avisoOpcoesInsuficientes(ferramentasList.length, 3);
    for (let i = 0; i < 3; i++) {
      const valorAtual = escolhasAtuais[i] || '';
      html += `<select class="${prefix}" data-idx="${i}" style="width:100%;padding:6px;border-radius:var(--radius-sm);border:1px solid var(--border);font-size:0.85rem;margin:4px 0">`;
      html += `<option value="">-- Escolha ${i + 1} --</option>`;
      ferramentasList.forEach(f => {
        html += `<option value="${f}" ${valorAtual === f ? 'selected' : ''}>${f}</option>`;
      });
      html += `</select>`;
    }
    return html;
  }

  if (talentoNome === 'Músico') {
    const instrumentosList = INSTRUMENTOS_MUSICAIS.filter(inst => !jaTem.has(inst));
    let html = `<div class="section-divider" style="margin-top:8px"><span>Escolhas — Musico</span></div>`;
    html += `<div class="info-box info" style="font-size:0.8rem">Escolha 3 Instrumentos Musicais para adquirir proficiencia.</div>`;
    html += _avisoOpcoesInsuficientes(instrumentosList.length, 3);
    for (let i = 0; i < 3; i++) {
      const valorAtual = escolhasAtuais[i] || '';
      html += `<select class="${prefix}" data-idx="${i}" style="width:100%;padding:6px;border-radius:var(--radius-sm);border:1px solid var(--border);font-size:0.85rem;margin:4px 0">`;
      html += `<option value="">-- Escolha ${i + 1} --</option>`;
      instrumentosList.forEach(inst => {
        html += `<option value="${inst}" ${valorAtual === inst ? 'selected' : ''}>${inst}</option>`;
      });
      html += `</select>`;
    }
    return html;
  }

  return '';
}

/** Verifica se um talento exige escolhas adicionais */
export function talentoExigeEscolhas(nome) {
  return ['Habilidoso', 'Artifista', 'Músico'].includes(nome);
}

/** Retorna quantas escolhas o talento exige */
export function talentoNumEscolhas(nome) {
  if (['Habilidoso', 'Artifista', 'Músico'].includes(nome)) return 3;
  return 0;
}

export function configurarSelectsExclusivos(seletor) {
  const selects = [...document.querySelectorAll(seletor)];
  if (selects.length < 2) return;
  const opcoesOriginais = new Map(selects.map(select => [select, select.innerHTML]));
  const vistos = new Set();
  selects.forEach(select => {
    if (select.value && vistos.has(select.value)) select.value = '';
    if (select.value) vistos.add(select.value);
  });
  const atualizar = () => {
    const escolhidas = selects.map(select => select.value).filter(Boolean);
    selects.forEach(select => {
      const propria = select.value;
      const temporario = document.createElement('select');
      temporario.innerHTML = opcoesOriginais.get(select);
      temporario.querySelectorAll('option').forEach(opcao => {
        if (opcao.value && opcao.value !== propria && escolhidas.includes(opcao.value)) opcao.remove();
      });
      temporario.querySelectorAll('optgroup').forEach(grupo => {
        if (!grupo.querySelector('option')) grupo.remove();
      });
      select.innerHTML = temporario.innerHTML;
      select.value = propria;
    });
  };
  selects.forEach(select => select.addEventListener('change', atualizar));
  atualizar();
}

// Nível obrigatório de subclasse por classe
export const NIVEL_SUBCLASSE = {
  'Bárbaro': 3, 'Bardo': 3, 'Bruxo': 3, 'Clérigo': 3, 'Druida': 3,
  'Feiticeiro': 3, 'Guardião': 3, 'Guerreiro': 3, 'Ladino': 3,
  'Mago': 3, 'Monge': 3, 'Paladino': 3
};

// Escolhas obrigatórias de classe no nível 1
export const CLASSES_ESCOLHAS = {
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
export const ANTECEDENTES_ESCOLHAS = {
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
export const KITS_EXPANSAO = {
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