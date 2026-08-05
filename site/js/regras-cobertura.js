import { bonusProficiencia } from './utils.js';

export const PERICIAS_TODAS = [
  'Acrobacia', 'Arcanismo', 'Atletismo', 'Atuação', 'Enganação', 'Furtividade',
  'História', 'Intimidação', 'Intuição', 'Investigação', 'Lidar com Animais',
  'Medicina', 'Natureza', 'Percepção', 'Persuasão', 'Prestidigitação',
  'Religião', 'Sobrevivência'
];

export const ATRIBUTOS_SALVAGUARDA = {
  forca: 'Força',
  destreza: 'Destreza',
  constituicao: 'Constituição',
  inteligencia: 'Inteligência',
  sabedoria: 'Sabedoria',
  carisma: 'Carisma'
};

const TIPOS_ENERGIA = [
  'Ácido', 'Elétrico', 'Gélido', 'Ígneo', 'Necrótico',
  'Psíquico', 'Radiante', 'Trovejante', 'Venenoso'
];

const regra = (escolhas = [], persistir = '', tipo = 'passiva') => ({
  escolhas, persistir, tipo
});

export const REGRAS_TALENTOS = Object.freeze({
  'Especialista em Perícia': regra(
    ['pericia_proficiencia', 'pericia_expertise'],
    'pericias_proficientes/pericias_expertise'
  ),
  'Resiliente': regra(['atributo_salvaguarda'], 'salvaguardas_proficientes'),
  'Iniciado em Magia': regra(
    ['lista_magias', 'atributo_conjuracao', 'dois_truques', 'magia_1_circulo'],
    'iniciado_em_magia_instancias',
    'magia'
  ),
  'Tocado Por Fadas': regra(
    ['atributo_conjuracao', 'magia_1_circulo'],
    'magias_preparadas',
    'magia'
  ),
  'Tocado Pelas Sombras': regra(
    ['atributo_conjuracao', 'magia_1_circulo'],
    'magias_preparadas',
    'magia'
  ),
  'Conjurador Ritualista': regra(
    ['atributo_conjuracao', 'rituais_bonus_proficiencia'],
    'magias_preparadas/recursos.talentos',
    'recurso'
  ),
  'Envenenador': regra(['atributo_talento'], 'talentos_parametros/proficiencias_ferramentas'),
  'Telecinético': regra(['atributo_talento'], 'talentos_parametros/magias_conhecidas'),
  'Dádiva da Fortitude': regra(['atributo_talento'], 'bonus_pv_dadiva_fortitude'),
  'Dádiva da Proeza em Combate': regra(['atributo_talento'], 'recursos.talentos', 'estado'),
  'Dádiva da Proficiência em Perícia': regra(
    ['atributo_talento', 'pericia_expertise'],
    'pericias_proficientes/pericias_expertise'
  ),
  'Dádiva da Recordação de Magia': regra(['atributo_talento'], 'talentos_parametros'),
  'Dádiva da Recuperação': regra(['atributo_talento'], 'recursos.talentos', 'recurso'),
  'Dádiva da Resistência à Energia': regra(
    ['atributo_talento', 'energias_distintas'],
    'talentos_parametros',
    'estado'
  ),
  'Dádiva da Velocidade': regra(['atributo_talento'], 'talentos_parametros'),
  'Dádiva da Viagem Dimensional': regra(['atributo_talento'], 'talentos_parametros'),
  'Dádiva da Visão Verdadeira': regra(['atributo_talento'], 'talentos_parametros'),
  'Dádiva do Ataque Irresistível': regra(['atributo_talento'], 'talentos_parametros'),
  'Dádiva do Destino': regra(['atributo_talento'], 'recursos.talentos', 'recurso'),
  'Dádiva do Espírito da Noite': regra(['atributo_talento'], 'talentos_parametros')
});

export function getRegraTalento(nome) {
  return REGRAS_TALENTOS[nome] || null;
}

export function obterEscolhasObrigatoriasTalento(regraTalento, char = {}) {
  if (!regraTalento) return [];
  return regraTalento.escolhas.filter(escolha => {
    if (escolha === 'atributo_talento' || escolha === 'atributo_conjuracao') {
      return true;
    }
    if (escolha === 'pericia_expertise') {
      return (char.pericias_expertise || []).length < PERICIAS_TODAS.length;
    }
    return true;
  });
}

function valor(escolhas, chave, indice = -1) {
  if (escolhas?.[chave] !== undefined) return escolhas[chave];
  if (indice >= 0 && Array.isArray(escolhas?.selecoes)) return escolhas.selecoes[indice];
  return undefined;
}

function resultadoInvalido(erro) {
  return { valido: false, erro };
}

export function validarEscolhasTalento(char, nome, escolhas = {}) {
  const regraTalento = getRegraTalento(nome);
  if (!regraTalento) return { valido: true };
  const iniciado = escolhas.iniciado_em_magia || escolhas.iniciadoEmMagia;
  const atributo = escolhas.atributo || escolhas.talento_asi || iniciado?.atributo;

  if (regraTalento.escolhas.some(item =>
    item === 'atributo_talento' || item === 'atributo_conjuracao' || item === 'atributo_salvaguarda'
  ) && !atributo) {
    return resultadoInvalido(`Escolha o atributo exigido por ${nome}.`);
  }

  if (nome === 'Resiliente') {
    const salvaguarda = ATRIBUTOS_SALVAGUARDA[atributo];
    if (!salvaguarda || (char.salvaguardas_proficientes || []).includes(salvaguarda)) {
      return resultadoInvalido('Escolha um atributo sem proficiência em salvaguarda para Resiliente.');
    }
  }

  if (nome === 'Especialista em Perícia') {
    const proficiencia = valor(escolhas, 'pericia_proficiencia', 0);
    const expertise = valor(escolhas, 'pericia_expertise', 1);
    if (!PERICIAS_TODAS.includes(proficiencia) ||
        (char.pericias_proficientes || []).includes(proficiencia)) {
      return resultadoInvalido('Escolha uma perícia em que ainda não tenha proficiência.');
    }
    const ficaProficiente = expertise === proficiencia ||
      (char.pericias_proficientes || []).includes(expertise);
    if (!PERICIAS_TODAS.includes(expertise) || !ficaProficiente ||
        (char.pericias_expertise || []).includes(expertise)) {
      return resultadoInvalido('Escolha para Especialização uma perícia proficiente e ainda sem Especialização.');
    }
  }

  if (nome === 'Dádiva da Proficiência em Perícia') {
    const expertise = valor(escolhas, 'pericia_expertise', 0);
    if (!PERICIAS_TODAS.includes(expertise) ||
        !(char.pericias_proficientes || []).includes(expertise) ||
        (char.pericias_expertise || []).includes(expertise)) {
      return resultadoInvalido('Escolha uma perícia em que já possua proficiência e ainda não tenha Especialização.');
    }
  }

  if (nome === 'Dádiva da Resistência à Energia') {
    const energias = escolhas.energias || escolhas.dadiva_resistencia_energia || [];
    if (!Array.isArray(energias) || energias.length !== 2 ||
        new Set(energias).size !== 2 || energias.some(tipo => !TIPOS_ENERGIA.includes(tipo))) {
      return resultadoInvalido('Selecione 2 tipos de energia diferentes e válidos.');
    }
  }

  if (nome === 'Tocado Por Fadas' || nome === 'Tocado Pelas Sombras') {
    const magia = escolhas.magia || valor(escolhas, 'magia_1_circulo', 0);
    if (!magia) return resultadoInvalido(`Escolha a magia de 1º círculo de ${nome}.`);
  }

  if (nome === 'Conjurador Ritualista') {
    const rituais = escolhas.rituais || escolhas.selecoes || [];
    const quantidade = bonusProficiencia(char.nivel || 1);
    if (!Array.isArray(rituais) || rituais.length !== quantidade ||
        new Set(rituais).size !== quantidade || rituais.some(item => !item)) {
      return resultadoInvalido(`Escolha exatamente ${quantidade} magias rituais distintas de 1º círculo.`);
    }
  }

  if (nome === 'Iniciado em Magia') {
    const iniciado = escolhas.iniciado_em_magia || escolhas.iniciadoEmMagia || escolhas;
    const listas = ['Clérigo', 'Druida', 'Mago'];
    const atributos = ['inteligencia', 'sabedoria', 'carisma'];
    if (!listas.includes(iniciado.lista) || !atributos.includes(iniciado.atributo) ||
        !Array.isArray(iniciado.truques) || iniciado.truques.length !== 2 ||
        new Set(iniciado.truques).size !== 2 || !iniciado.magia) {
      return resultadoInvalido('Escolha uma lista válida, um atributo, 2 truques distintos e 1 magia de 1º círculo.');
    }
    if ((char.iniciado_em_magia_instancias || []).some(item => item.lista === iniciado.lista)) {
      return resultadoInvalido('Escolha uma lista de magias ainda não usada por Iniciado em Magia.');
    }
  }

  return { valido: true };
}

function garantirArray(objeto, chave) {
  if (!Array.isArray(objeto[chave])) objeto[chave] = [];
  return objeto[chave];
}

function adicionarUnico(lista, item, comparar = valorAtual => valorAtual === item) {
  if (!lista.some(comparar)) lista.push(item);
}

function parametrosTalento(char, nome) {
  if (!char.talentos_parametros) char.talentos_parametros = {};
  if (!char.talentos_parametros[nome]) char.talentos_parametros[nome] = {};
  return char.talentos_parametros[nome];
}

function recursoTalento(char, nome, padrao) {
  if (!char.recursos) char.recursos = {};
  if (!char.recursos.talentos) char.recursos.talentos = {};
  if (!char.recursos.talentos[nome]) char.recursos.talentos[nome] = { ...padrao };
  return char.recursos.talentos[nome];
}

export function aplicarEfeitoTalento(char, nome, escolhas = {}) {
  const atributoEscolhido = escolhas.atributo || escolhas.talento_asi ||
    escolhas.iniciado_em_magia?.atributo || escolhas.iniciadoEmMagia?.atributo;
  const selecoes = escolhas.selecoes || [];
  if (nome === 'Resiliente' &&
      (char.salvaguardas_proficientes || []).includes(ATRIBUTOS_SALVAGUARDA[atributoEscolhido])) {
    return { sucesso: true, aplicado: false };
  }
  if (nome === 'Especialista em Perícia' &&
      (char.pericias_proficientes || []).includes(escolhas.pericia_proficiencia || selecoes[0]) &&
      (char.pericias_expertise || []).includes(escolhas.pericia_expertise || selecoes[1])) {
    return { sucesso: true, aplicado: false };
  }
  if (nome === 'Dádiva da Proficiência em Perícia' &&
      (char.pericias_expertise || []).includes(escolhas.pericia_expertise || selecoes[0]) &&
      PERICIAS_TODAS.every(pericia => (char.pericias_proficientes || []).includes(pericia))) {
    return { sucesso: true, aplicado: false };
  }
  const iniciadoExistente = escolhas.iniciado_em_magia || escolhas.iniciadoEmMagia || escolhas;
  if (nome === 'Iniciado em Magia' &&
      (char.iniciado_em_magia_instancias || []).some(item => item.lista === iniciadoExistente.lista)) {
    return { sucesso: true, aplicado: false };
  }
  const validacao = validarEscolhasTalento(char, nome, escolhas);
  if (!validacao.valido) return { sucesso: false, erro: validacao.erro };
  const atributo = atributoEscolhido;

  if (nome === 'Resiliente') {
    adicionarUnico(garantirArray(char, 'salvaguardas_proficientes'), ATRIBUTOS_SALVAGUARDA[atributo]);
    parametrosTalento(char, 'resiliente').atributo = atributo;
  }

  if (nome === 'Especialista em Perícia') {
    const proficiencia = valor(escolhas, 'pericia_proficiencia', 0);
    const expertise = valor(escolhas, 'pericia_expertise', 1);
    adicionarUnico(garantirArray(char, 'pericias_proficientes'), proficiencia);
    adicionarUnico(garantirArray(char, 'pericias_expertise'), expertise);
    Object.assign(parametrosTalento(char, 'especialista_pericia'), { proficiencia, expertise });
  }

  if (nome === 'Dádiva da Proficiência em Perícia') {
    const expertise = valor(escolhas, 'pericia_expertise', 0);
    const proficientes = garantirArray(char, 'pericias_proficientes');
    PERICIAS_TODAS.forEach(pericia => adicionarUnico(proficientes, pericia));
    adicionarUnico(garantirArray(char, 'pericias_expertise'), expertise);
  }

  if (nome === 'Envenenador') {
    adicionarUnico(garantirArray(char, 'proficiencias_ferramentas'), 'Kit de Veneno');
    parametrosTalento(char, 'envenenador').atributo = atributo;
  }

  if (nome === 'Telecinético') {
    const magias = garantirArray(char, 'magias_conhecidas');
    adicionarUnico(magias, { nome: 'Mãos Mágicas', circulo: 0, origem: 'telecinetico' },
      magia => magia?.nome === 'Mãos Mágicas');
    parametrosTalento(char, 'telecinetico').atributo = atributo;
  }

  if (nome === 'Tocado Por Fadas' || nome === 'Tocado Pelas Sombras') {
    const origem = nome === 'Tocado Por Fadas' ? 'tocado_por_fadas' : 'tocado_pelas_sombras';
    const parceira = nome === 'Tocado Por Fadas' ? 'Passo Nebuloso' : 'Invisibilidade';
    const escolhida = escolhas.magia || valor(escolhas, 'magia_1_circulo', 0);
    const preparadas = garantirArray(char, 'magias_preparadas');
    for (const [magia, circulo] of [[escolhida, 1], [parceira, 2]]) {
      adicionarUnico(preparadas, { nome: magia, circulo, origem, gratis_usado: false },
        atual => atual?.nome === magia);
    }
    parametrosTalento(char, origem).atributo = atributo;
  }

  if (nome === 'Conjurador Ritualista') {
    const preparadas = garantirArray(char, 'magias_preparadas');
    for (const magia of (escolhas.rituais || escolhas.selecoes || [])) {
      adicionarUnico(preparadas, { nome: magia, circulo: 1, origem: 'conjurador_ritualista' },
        atual => atual?.nome === magia);
    }
    parametrosTalento(char, 'conjurador_ritualista').atributo = atributo;
    recursoTalento(char, 'conjurador_ritualista', { ritual_rapido_usado: false });
  }

  if (nome === 'Iniciado em Magia') {
    const iniciado = escolhas.iniciado_em_magia || escolhas.iniciadoEmMagia || escolhas;
    const instancias = garantirArray(char, 'iniciado_em_magia_instancias');
    adicionarUnico(instancias, {
      lista: iniciado.lista,
      atributo: iniciado.atributo,
      truques: [...iniciado.truques],
      magia: iniciado.magia
    }, atual => atual?.lista === iniciado.lista);
    const conhecidas = garantirArray(char, 'magias_conhecidas');
    iniciado.truques.forEach(magia => adicionarUnico(
      conhecidas,
      { nome: magia, circulo: 0, origem: 'iniciado_em_magia' },
      atual => atual?.nome === magia
    ));
    {
      const preparadasIM = garantirArray(char, 'magias_preparadas');
      const existenteIM = preparadasIM.find(m => m?.nome === iniciado.magia);
      if (existenteIM) {
        existenteIM.origem = 'iniciado_em_magia';
        existenteIM.gratis_usado = false;
      } else {
        preparadasIM.push({ nome: iniciado.magia, circulo: 1, origem: 'iniciado_em_magia', gratis_usado: false });
      }
    }
  }

  if (nome === 'Dádiva da Resistência à Energia') {
    const energias = escolhas.energias || escolhas.dadiva_resistencia_energia;
    char.talentos_parametros = char.talentos_parametros || {};
    char.talentos_parametros.dadiva_resistencia_energia = [...energias];
  }

  if (nome === 'Dádiva da Fortitude' && !char.bonus_pv_dadiva_fortitude) {
    char.pv_max = (char.pv_max || 0) + 40;
    char.pv_atual = Math.min((char.pv_atual || 0) + 40, char.pv_max);
    char.bonus_pv_dadiva_fortitude = 40;
  }

  if (nome === 'Dádiva da Recuperação') {
    recursoTalento(char, 'dadiva_recuperacao', { ate_a_morte_usado: false, dados_vitalidade_gastos: 0 });
  }
  if (nome === 'Dádiva do Destino') {
    recursoTalento(char, 'dadiva_destino', { usado: false });
  }
  if (nome === 'Dádiva da Proeza em Combate') {
    recursoTalento(char, 'dadiva_proeza_combate', { usado_no_turno: false });
  }

  if (nome.startsWith('Dádiva ')) {
    parametrosTalento(char, nome).atributo = atributo;
  }

  return { sucesso: true };
}

export function restaurarRecursosTalentos(char, tipoDescanso) {
  const recursos = char?.recursos?.talentos;
  if (!recursos) return;
  if (tipoDescanso === 'longo') {
    if (recursos.conjurador_ritualista) recursos.conjurador_ritualista.ritual_rapido_usado = false;
    if (recursos.dadiva_recuperacao) {
      recursos.dadiva_recuperacao.ate_a_morte_usado = false;
      recursos.dadiva_recuperacao.dados_vitalidade_gastos = 0;
    }
  }
  if (tipoDescanso === 'curto' || tipoDescanso === 'longo') {
    if (recursos.dadiva_destino) recursos.dadiva_destino.usado = false;
  }
}
