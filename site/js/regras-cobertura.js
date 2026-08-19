import { bonusProficiencia } from './utils.js';

export const PERICIAS_TODAS = [
  'Acrobacia', 'Arcanismo', 'Atletismo', 'Atuação', 'Enganação', 'Furtividade',
  'História', 'Intimidação', 'Intuição', 'Investigação', 'Lidar com Animais',
  'Medicina', 'Natureza', 'Percepção', 'Persuasão', 'Prestidigitação',
  'Religião', 'Sobrevivência'
];

// Ferramentas, Ferramentas de Artesão e Instrumentos Musicais válidos para
// Habilidoso/Artifista/Músico. Fonte única: levelup-ui.js importa estas
// constantes em vez de manter cópia própria, para as listas de opção da
// tela e a validação central nunca divergirem entre si.
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

export const FERRAMENTAS_ARTESAO = [
  'Ferramentas de Carpinteiro', 'Ferramentas de Cartógrafo', 'Ferramentas de Coureiro',
  'Ferramentas de Entalhador', 'Ferramentas de Ferreiro', 'Ferramentas de Funileiro',
  'Ferramentas de Joalheiro', 'Ferramentas de Oleiro', 'Ferramentas de Pedreiro',
  'Ferramentas de Sapateiro', 'Ferramentas de Tecelão', 'Ferramentas de Vidreiro',
  'Suprimentos de Alquimista', 'Suprimentos de Calígrafo', 'Suprimentos de Cervejeiro',
  'Suprimentos de Pintor', 'Utensílios de Cozinheiro'
];

export const INSTRUMENTOS_MUSICAIS = [
  'Alaúde', 'Flauta', 'Flauta de Pan', 'Gaita de Foles', 'Lira',
  'Oboé', 'Tambor', 'Trombeta', 'Violino', 'Xilofone'
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

// Talentos.md §Adepto Elemental ("Domínio Elemental"): só 5 dos 9 tipos de
// energia contam para este talento. Deriva de TIPOS_ENERGIA (em vez de uma
// lista literal própria) para nunca divergir na grafia de "Gélido"/"Ígneo".
// Fonte única: levelup-ui.js importa esta constante para as opções da tela.
export const TIPOS_DANO_ADEPTO_ELEMENTAL = TIPOS_ENERGIA.filter(tipo =>
  ['Ácido', 'Elétrico', 'Gélido', 'Ígneo', 'Trovejante'].includes(tipo)
);

// Talentos.md §Analítico ("Observador Atento"): perícia entre Intuição,
// Investigação ou Percepção. Fonte única com levelup-ui.js.
export const PERICIAS_ANALITICO = ['Intuição', 'Investigação', 'Percepção'];

// Talentos.md §Mente Aguçada ("Conhecimento Vasto"): perícia entre
// Arcanismo, História, Investigação, Natureza ou Religião. Fonte única
// com levelup-ui.js.
export const PERICIAS_MENTE_AGUCADA = ['Arcanismo', 'História', 'Investigação', 'Natureza', 'Religião'];

// Talentos.md §Mestre das Armas ("Propriedade de Maestria"): uma arma
// Simples ou Marcial à escolha. Cópia curada de dados/equipamento/armas.json
// (campo `nome`, filtrando `categoria` que contém "Simples" ou "Marciais") —
// mesmo padrão de lista literal já usado por FERRAMENTAS_TODAS/
// INSTRUMENTOS_MUSICAIS acima: regras-cobertura.js é módulo síncrono e "puro"
// (sem DOM/fetch), reaproveitado pelo harness de teste de unidade fora do
// navegador, então não pode carregar o JSON via fetch em tempo de execução
// como site/js/db.js faz para a tela de equipamento. Fonte única com
// levelup-ui.js.
export const ARMAS_SIMPLES_MARCIAIS = [
  // Armas Simples Corpo a Corpo
  'Adaga', 'Azagaia', 'Cajado', 'Clava', 'Clava Grande', 'Foice', 'Lança',
  'Maça', 'Machadinha', 'Martelo Leve',
  // Armas Simples à Distância
  'Arco Curto', 'Besta Leve', 'Dardo', 'Funda',
  // Armas Marciais Corpo a Corpo
  'Alabarda', 'Chicote', 'Cimitarra', 'Espada Curta', 'Espada Grande',
  'Espada Longa', 'Glaive', 'Lança de Montaria', 'Lança Longa', 'Maça Estrela',
  'Machado de Batalha', 'Machado Grande', 'Malho', 'Mangual',
  'Martelo de Guerra', 'Picareta de Guerra', 'Rapieira', 'Tridente',
  // Armas Marciais à Distância
  'Arco Longo', 'Besta de Mão', 'Besta Pesada', 'Mosquete', 'Pistola',
  'Zarabatana'
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
  // 'truque_telecinetico' é CONDICIONAL: só entra na lista de escolhas
  // obrigatórias quando o personagem já conhece Mãos Mágicas (ver
  // obterEscolhasObrigatoriasTalento e telecineticoPrecisaTruqueSubstituto
  // abaixo). Para todo mundo mais, Telecinético continua sem escolha além
  // do atributo, exatamente como o livro descreve.
  'Telecinético': regra(['atributo_talento', 'truque_telecinetico'], 'talentos_parametros/magias_conhecidas'),
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
  'Dádiva do Espírito da Noite': regra(['atributo_talento'], 'talentos_parametros'),
  // Talentos.md §Habilidoso: "proficiência em qualquer combinação de três
  // perícias ou ferramentas à sua escolha". Sem aumento de atributo, sem
  // pré-requisito, repetível.
  'Habilidoso': regra(
    ['tres_pericias_ou_ferramentas'],
    'pericias_proficientes/proficiencias_ferramentas'
  ),
  // Talentos.md §Artifista: "proficiência com três Ferramentas de Artesão
  // diferentes à sua escolha".
  'Artifista': regra(['tres_ferramentas_artesao'], 'proficiencias_ferramentas'),
  // Talentos.md §Músico: "proficiência com três Instrumentos Musicais à
  // sua escolha".
  'Músico': regra(['tres_instrumentos'], 'proficiencias_instrumentos'),
  // Talentos.md §Analítico: "Observador Atento" — perícia entre
  // Intuição/Investigação/Percepção; vira proficiência ou Especialização
  // dependendo do estado atual (ver aplicarEfeitoTalento). ASI embutido
  // (Inteligência ou Sabedoria) é a mesma 'atributo_talento' das Dádivas.
  'Analítico': regra(
    ['atributo_talento', 'pericia_analitico'],
    'pericias_proficientes/pericias_expertise'
  ),
  // Talentos.md §Mente Aguçada: "Conhecimento Vasto" — mesma regra de
  // Analítico (proficiência ou Especialização), lista de perícias diferente.
  'Mente Aguçada': regra(
    ['atributo_talento', 'pericia_mente_agucada'],
    'pericias_proficientes/pericias_expertise'
  ),
  // Talentos.md §Adepto Elemental: "Domínio Elemental" — tipo de dano entre
  // Ácido/Elétrico/Gélido/Ígneo/Trovejante. Repetível, mas cada aquisição
  // exige um tipo ainda não escolhido (ver validarEscolhasTalento).
  'Adepto Elemental': regra(
    ['atributo_talento', 'tipo_dano_elemental'],
    'adepto_elemental_tipos'
  ),
  // Talentos.md §Mestre das Armas: "Propriedade de Maestria" — uma arma
  // Simples ou Marcial à escolha, desde que o personagem tenha proficiência
  // com ela (ver comentário em validarEscolhasTalento sobre por que este
  // pré-requisito não é checado aqui). ASI embutido (Força ou Destreza) é a
  // mesma 'atributo_talento' das Dádivas. Persiste em maestrias_arma — o
  // mesmo campo que já guarda as maestrias concedidas pela classe (ver
  // site/js/sheet/maestrias.js), em vez de um campo paralelo.
  'Mestre das Armas': regra(['atributo_talento', 'arma_maestria'], 'maestrias_arma')
});

/**
 * Proficiências que o livro concede DE GRAÇA ao adquirir o talento --
 * sem escolha nenhuma do jogador ("você obtém treinamento com...", não
 * "escolha um..."). Por isso moram numa tabela e não em REGRAS_TALENTOS,
 * que existe para declarar ESCOLHAS: uma entrada lá faria
 * validarEscolhasTalento passar a cobrar o atributo do ASI embutido, que
 * já é coberto por obterAtributosASITalento (site/js/levelup.js).
 *
 * `extras` vai para `proficiencias_extra` -- o campo REAL de proficiência
 * extra por categoria de arma/armadura, lido por site/js/sheet/ficha.js:579
 * (badges da ficha), site/js/sheet/impressao.js:233 e
 * site/js/regras-equipamento.js:17,74 (proficiência de item). NÃO usar
 * `proficiencias_armaduras` nem `treinamentos_armadura`: os dois são lidos
 * por site/js/levelup.js e nunca foram escritos por linha nenhuma de
 * site/js/ -- campos mortos para gravação.
 *
 * `ferramentas` vai para `proficiencias_ferramentas`, o mesmo array que
 * Envenenador/Artifista/Habilidoso já alimentam.
 *
 * Antes de 2026-08-19 nada disto era gravado: o efeito existia só em
 * resolverPassivosTalentos().proficienciasExtra (site/js/talentos-effects.js),
 * uma saída que nenhum consumidor lia -- os cinco talentos abaixo não
 * concediam nada a ninguém.
 */
export const PROFICIENCIAS_FIXAS_TALENTO = Object.freeze({
  // Talentos.md:428 -- "Você obtém treinamento com Armadura Leve e Escudos".
  // Os Escudos vinham sendo perdidos: sem eles, Mestre em Escudos
  // (pré-requisito "Treinamento com Escudo", Talentos.md:580) fica
  // inalcançável para toda classe que não nasce com escudo.
  'Especialista em Armaduras Leves': { extras: ['Armadura Leve', 'Escudo'] },
  // Talentos.md:438 -- "Você obtém treinamento com Armadura Média."
  'Especialista em Armaduras Médias': { extras: ['Armadura Média'] },
  // Talentos.md:448 -- "Você adquire treinamento com Armadura Pesada."
  'Especialista em Armaduras Pesadas': { extras: ['Armadura Pesada'] },
  // Talentos.md:728 -- "Você adquire proficiência com armas Marciais."
  'Treinamento com Armas Marciais': { extras: ['Armas Marciais'] },
  // Talentos.md §Chef -- "Você adquire proficiência com Utensílios de
  // Cozinheiro se ainda não o tiver." O "se ainda não o tiver" é o
  // comportamento natural de adicionarUnico, não precisa de ramo próprio.
  'Chef': { ferramentas: ['Utensílios de Cozinheiro'] },
});

export function getRegraTalento(nome) {
  return REGRAS_TALENTOS[nome] || null;
}

// Truque que Telecinético concede pela característica "Telecinese Menor".
export const TRUQUE_TELECINETICO = 'Mãos Mágicas';

/**
 * Diz se o personagem já conhece Mãos Mágicas e, portanto, precisa escolher
 * um truque substituto ao adquirir Telecinético.
 *
 * REGRA DA CASA (decisão do dono do produto, 2026-08-13), não do livro: o
 * PHB 2024 (§Telecinético, Talentos.md:684) diz apenas "Você aprende a
 * magia Mãos Mágicas", sem cláusula de substituição — o texto foi conferido
 * e não existe nem no verbete nem numa regra geral de duplicação (a de
 * multiclasse cobre só Ataque Extra, CA e Conjuração). Sem esta regra o
 * talento simplesmente não concederia truque nenhum a quem já tem Mãos
 * Mágicas — o caso mais comum sendo o Trapaceiro Arcano, que a recebe
 * obrigatoriamente. O substituto sai da lista de Mago (truque arcano, mesmo
 * sabor do talento); ver bindEscolhasTalento em levelup-ui.js.
 */
export function telecineticoPrecisaTruqueSubstituto(char = {}) {
  return (char?.magias_conhecidas || []).some(magia => magia?.nome === TRUQUE_TELECINETICO);
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
    // Só pede o truque substituto de Telecinético a quem já tem Mãos
    // Mágicas -- para os demais o talento continua sem escolha nenhuma
    // além do atributo, como no livro.
    if (escolha === 'truque_telecinetico') {
      return telecineticoPrecisaTruqueSubstituto(char);
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

  // Habilidoso: 3 perícias OU ferramentas, em qualquer combinação, distintas
  // e ainda não possuídas. Proficiência repetida não concede nada nesta
  // edição — só Especialização dobra, e ela vem de talento que a concede
  // explicitamente (Analítico/Mente Aguçada, que dizem isso no texto).
  // Mesma checagem de "já possui" que 'Especialista em Perícia' faz acima.
  if (nome === 'Habilidoso') {
    const selecoes = escolhas.selecoes || [];
    const validas = [...PERICIAS_TODAS, ...FERRAMENTAS_TODAS];
    if (selecoes.length !== 3 || new Set(selecoes).size !== 3 ||
        selecoes.some(item => !validas.includes(item))) {
      return resultadoInvalido('Escolha 3 perícias ou ferramentas distintas e válidas para Habilidoso.');
    }
    const jaPossuidas = [...(char.pericias_proficientes || []), ...(char.proficiencias_ferramentas || [])];
    if (selecoes.some(item => jaPossuidas.includes(item))) {
      return resultadoInvalido('Escolha perícias ou ferramentas em que ainda não tenha proficiência para Habilidoso.');
    }
  }

  // Artifista: 3 Ferramentas de Artesão distintas e ainda não possuídas.
  if (nome === 'Artifista') {
    const selecoes = escolhas.selecoes || [];
    if (selecoes.length !== 3 || new Set(selecoes).size !== 3 ||
        selecoes.some(item => !FERRAMENTAS_ARTESAO.includes(item))) {
      return resultadoInvalido('Escolha 3 Ferramentas de Artesão distintas para Artifista.');
    }
    if (selecoes.some(item => (char.proficiencias_ferramentas || []).includes(item))) {
      return resultadoInvalido('Escolha Ferramentas de Artesão em que ainda não tenha proficiência para Artifista.');
    }
  }

  // Músico: 3 Instrumentos Musicais distintos e ainda não possuídos.
  if (nome === 'Músico') {
    const selecoes = escolhas.selecoes || [];
    if (selecoes.length !== 3 || new Set(selecoes).size !== 3 ||
        selecoes.some(item => !INSTRUMENTOS_MUSICAIS.includes(item))) {
      return resultadoInvalido('Escolha 3 Instrumentos Musicais distintos para Músico.');
    }
    if (selecoes.some(item => (char.proficiencias_instrumentos || []).includes(item))) {
      return resultadoInvalido('Escolha Instrumentos Musicais em que ainda não tenha proficiência para Músico.');
    }
  }

  // Analítico: perícia entre Intuição/Investigação/Percepção. Qualquer uma
  // das três é válida — vira proficiência ou Especialização dependendo do
  // estado atual do personagem (aplicarEfeitoTalento decide isso). Só a
  // terceira combinação — já proficiente E já com Especialização na perícia
  // escolhida — não concede nada, pois nenhum dos dois ramos do texto do
  // talento se aplica mais; é a única rejeitada aqui.
  if (nome === 'Analítico') {
    const pericia = valor(escolhas, 'pericia', 0);
    if (!PERICIAS_ANALITICO.includes(pericia)) {
      return resultadoInvalido('Escolha Intuição, Investigação ou Percepção para Analítico.');
    }
    if ((char.pericias_proficientes || []).includes(pericia) && (char.pericias_expertise || []).includes(pericia)) {
      return resultadoInvalido('Escolha uma perícia em que ainda não tenha proficiência e Especialização para Analítico.');
    }
  }

  // Mente Aguçada: mesma regra de Analítico, lista de perícias diferente.
  if (nome === 'Mente Aguçada') {
    const pericia = valor(escolhas, 'pericia', 0);
    if (!PERICIAS_MENTE_AGUCADA.includes(pericia)) {
      return resultadoInvalido('Escolha Arcanismo, História, Investigação, Natureza ou Religião para Mente Aguçada.');
    }
    if ((char.pericias_proficientes || []).includes(pericia) && (char.pericias_expertise || []).includes(pericia)) {
      return resultadoInvalido('Escolha uma perícia em que ainda não tenha proficiência e Especialização para Mente Aguçada.');
    }
  }

  // Adepto Elemental: tipo de dano válido e ainda não usado por uma
  // aquisição anterior (repetível "mas deve escolher um tipo de dano
  // diferente a cada vez" — Talentos.md §Adepto Elemental).
  if (nome === 'Adepto Elemental') {
    const tipo = valor(escolhas, 'energia', 0);
    if (!TIPOS_DANO_ADEPTO_ELEMENTAL.includes(tipo)) {
      return resultadoInvalido('Escolha um tipo de dano válido para Adepto Elemental.');
    }
    if ((char.adepto_elemental_tipos || []).includes(tipo)) {
      return resultadoInvalido('Escolha um tipo de dano ainda não usado por Adepto Elemental.');
    }
  }

  // Mestre das Armas: uma arma Simples ou Marcial válida. O livro também
  // exige "desde que você tenha proficiência com ela", mas o personagem não
  // guarda proficiência de arma por item — só por classe/traço em texto
  // livre (dados/classes/*.json, campo "Proficiências com Armas") — não há
  // hoje um campo estruturado no personagem para cruzar contra a arma
  // escolhida sem uma busca assíncrona (fetch dos dados de classe), que
  // validarEscolhasTalento não pode fazer: é síncrona e chamada tanto pelo
  // navegador quanto pelo harness de teste de unidade (sem fetch/DOM). Por
  // isso este ramo confere só existência e categoria — o mesmo limite que
  // já se aplica a qualquer outro pré-requisito não observável a partir do
  // personagem.
  // A MAESTRIA em si (diferente da proficiência acima) é armazenada por
  // item em char.maestrias_arma, então uma arma em que o personagem já tem
  // maestria é rejeitada aqui: maestria repetida não concede nada.
  if (nome === 'Mestre das Armas') {
    const arma = valor(escolhas, 'arma', 0);
    if (!ARMAS_SIMPLES_MARCIAIS.includes(arma)) {
      return resultadoInvalido('Escolha uma arma Simples ou Marcial válida para Mestre das Armas.');
    }
    if ((char.maestrias_arma || []).includes(arma)) {
      return resultadoInvalido('Escolha uma arma em que ainda não tenha maestria para Mestre das Armas.');
    }
  }

  // Telecinético com Mãos Mágicas já conhecida: regra da casa (ver
  // telecineticoPrecisaTruqueSubstituto). Quem NÃO tem Mãos Mágicas não
  // passa por aqui e continua sem escolha alguma além do atributo.
  if (nome === 'Telecinético' && telecineticoPrecisaTruqueSubstituto(char)) {
    const substituto = valor(escolhas, 'truque_telecinetico', 0);
    if (!substituto) {
      return resultadoInvalido('Você já conhece Mãos Mágicas: escolha outro truque para Telecinético.');
    }
    if ((char.magias_conhecidas || []).some(magia => magia?.nome === substituto)) {
      return resultadoInvalido('Escolha um truque que você ainda não conheça para Telecinético.');
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

  // Concessões FIXAS de proficiência (PROFICIENCIAS_FIXAS_TALENTO, acima).
  // Vêm antes dos ramos por nome porque não dependem de escolha nenhuma --
  // o livro concede sem perguntar.
  const fixas = PROFICIENCIAS_FIXAS_TALENTO[nome];
  if (fixas) {
    if (fixas.extras) {
      const extras = garantirArray(char, 'proficiencias_extra');
      for (const item of fixas.extras) adicionarUnico(extras, item);
    }
    if (fixas.ferramentas) {
      const ferramentas = garantirArray(char, 'proficiencias_ferramentas');
      for (const item of fixas.ferramentas) adicionarUnico(ferramentas, item);
    }
  }

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

  // Habilidoso: cada escolha vira proficiência em perícia OU em ferramenta,
  // dependendo de a que lista o item escolhido pertence.
  if (nome === 'Habilidoso') {
    const proficientes = garantirArray(char, 'pericias_proficientes');
    const ferramentas = garantirArray(char, 'proficiencias_ferramentas');
    for (const escolha of selecoes) {
      if (PERICIAS_TODAS.includes(escolha)) adicionarUnico(proficientes, escolha);
      else adicionarUnico(ferramentas, escolha);
    }
  }

  // Artifista: as 3 escolhas são sempre Ferramentas de Artesão.
  if (nome === 'Artifista') {
    const ferramentas = garantirArray(char, 'proficiencias_ferramentas');
    for (const escolha of selecoes) adicionarUnico(ferramentas, escolha);
  }

  // Músico: as 3 escolhas são sempre Instrumentos Musicais.
  if (nome === 'Músico') {
    const instrumentos = garantirArray(char, 'proficiencias_instrumentos');
    for (const escolha of selecoes) adicionarUnico(instrumentos, escolha);
  }

  // Analítico / Mente Aguçada: "Se não tiver proficiência na perícia
  // escolhida, você a adquire; se já for proficiente, adquire
  // Especialização" (Talentos.md §Analítico/§Mente Aguçada).
  if (nome === 'Analítico' || nome === 'Mente Aguçada') {
    const pericia = valor(escolhas, 'pericia', 0);
    const proficientes = garantirArray(char, 'pericias_proficientes');
    if (proficientes.includes(pericia)) {
      adicionarUnico(garantirArray(char, 'pericias_expertise'), pericia);
    } else {
      adicionarUnico(proficientes, pericia);
    }
  }

  // Adepto Elemental: registra o tipo de dano escolhido nesta aquisição.
  // Repetível — cada aquisição grava um tipo distinto (garantido pela
  // validação acima).
  if (nome === 'Adepto Elemental') {
    const tipo = valor(escolhas, 'energia', 0);
    adicionarUnico(garantirArray(char, 'adepto_elemental_tipos'), tipo);
  }

  // Mestre das Armas: grava a arma escolhida em maestrias_arma, o mesmo
  // array que site/js/sheet/maestrias.js usa para as maestrias concedidas
  // pela classe — a "vaga extra" que o talento concede é sinalizada
  // separadamente pela flag mestre_armas_maestria_extra (já calculada em
  // talentos-effects.js) e consumida por maestrias.js para somar +1 ao
  // limite normal da classe.
  if (nome === 'Mestre das Armas') {
    const arma = valor(escolhas, 'arma', 0);
    adicionarUnico(garantirArray(char, 'maestrias_arma'), arma);
  }

  if (nome === 'Envenenador') {
    adicionarUnico(garantirArray(char, 'proficiencias_ferramentas'), 'Kit de Veneno');
    parametrosTalento(char, 'envenenador').atributo = atributo;
  }

  if (nome === 'Telecinético') {
    const magias = garantirArray(char, 'magias_conhecidas');
    // A checagem tem de vir ANTES do push, senão Mãos Mágicas recém-added
    // faria o próprio talento pensar que ela já existia.
    if (telecineticoPrecisaTruqueSubstituto(char)) {
      const substituto = valor(escolhas, 'truque_telecinetico', 0);
      if (substituto) {
        adicionarUnico(magias, { nome: substituto, circulo: 0, origem: 'telecinetico' },
          magia => magia?.nome === substituto);
      }
    } else {
      adicionarUnico(magias, { nome: TRUQUE_TELECINETICO, circulo: 0, origem: 'telecinetico' },
        magia => magia?.nome === TRUQUE_TELECINETICO);
    }
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
