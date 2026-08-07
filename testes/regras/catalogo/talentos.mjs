// ============================================================
// Catálogo de regras de talentos, curado à mão a partir do livro
// (Informacoes Separadas/Talentos.md). É a FONTE DA VERDADE dos
// testes de regras: os motores em ../unidade/ e ../../e2e/regras/
// confrontam o app com o que está declarado aqui.
//
// Só entra campo verificável por máquina. Prosa não-mecanizável
// (ex.: "pode trocar Iniciativa com um aliado") fica de fora — o
// texto descritivo já é coberto pela extração em dados/.
// ============================================================

// Tipos de escolha que uma entrada pode declarar. O teste de
// completude rejeita tipo fora desta lista.
//
// 'ferramenta' e 'magia' não aparecem em nenhuma entrada hoje, mas dois
// consumidores de teste já os tratam como possibilidade prevista:
// ../../e2e/regras/talentos-criador.spec.mjs filtra por 'ferramenta' lado
// a lado com 'ferramenta_artesao'/'pericia_ou_ferramenta', e
// ../../e2e/regras/talentos-levelup.spec.mjs (TIPOS_SEM_CONTROLE_GENERICO/
// TIPOS_DINAMICOS) já trata 'magia' como um tipo dinâmico reconhecido —
// mantidos para não quebrar essas listas no dia em que um talento futuro
// usar um dos dois. 'manobra' foi removido (achado M13): nenhuma entrada
// do catálogo nem nenhum consumidor de teste o referencia.
export const TIPOS_ESCOLHA = [
  'pericia', 'ferramenta', 'pericia_ou_ferramenta', 'instrumento',
  'ferramenta_artesao', 'atributo_talento', 'atributo_salvaguarda',
  'atributo_conjuracao', 'lista_magias', 'truque', 'magia_1_circulo',
  'magia', 'energia', 'pericia_expertise', 'ritual', 'arma'
];

export const CATALOGO_TALENTOS = {
  // ---------- Talentos de Origem (Talentos.md §Talentos de Origem) ----------
  'Alerta': {
    livro: 'Talentos.md §Alerta',
    categoria: 'de Origem',
    prerequisito: null,
    repetivel: false,
    escolhas: [],
    aumento_atributo: null,
    passivos: { bonusIniciativa: 'proficiencia' },
    flags: ['alerta_troca_iniciativa'],
  },
  'Artifista': {
    livro: 'Talentos.md §Artifista',
    categoria: 'de Origem',
    prerequisito: null,
    repetivel: false,
    escolhas: [{ tipo: 'ferramenta_artesao', qtd: 3 }],
    aumento_atributo: null,
    passivos: null,
    flags: ['artifista_desconto', 'artifista_fabricacao_rapida'],
    // 'Suprimentos de Alquimista' é o nome exato usado em _FERRAMENTAS_ARTESAO
    // (site/js/levelup-ui.js) — a lista não contém "Ferramentas de Alquimista".
    exemplo_valido: { selecoes: ['Suprimentos de Alquimista', 'Ferramentas de Carpinteiro', 'Ferramentas de Cartógrafo'] },
  },
  'Atacante Selvagem': {
    livro: 'Talentos.md §Atacante Selvagem',
    categoria: 'de Origem',
    prerequisito: null,
    repetivel: false,
    escolhas: [],
    aumento_atributo: null,
    passivos: null,
    flags: ['atacante_selvagem'],
  },
  'Curandeiro': {
    livro: 'Talentos.md §Curandeiro',
    categoria: 'de Origem',
    prerequisito: null,
    repetivel: false,
    escolhas: [],
    aumento_atributo: null,
    passivos: null,
    flags: ['curandeiro_medico_combate', 'curandeiro_cura_garantida'],
  },
  'Habilidoso': {
    livro: 'Talentos.md §Habilidoso',
    categoria: 'de Origem',
    prerequisito: null,
    // "Repetível. Você pode adquirir este talento mais de uma vez."
    repetivel: true,
    // "proficiência em qualquer combinação de três perícias ou ferramentas"
    escolhas: [{ tipo: 'pericia_ou_ferramenta', qtd: 3 }],
    aumento_atributo: null,
    passivos: null,
    // Nem Atletismo nem História podem entrar aqui: charBase() (harness.mjs)
    // já é proficiente nas duas, e validarEscolhasTalento agora rejeita
    // proficiência repetida em Habilidoso (não concede nada nesta edição).
    // Não "restaurar" para Atletismo/História.
    exemplo_valido: { selecoes: ['Acrobacia', 'Furtividade', 'Ferramentas de Ferreiro'] },
  },
  'Iniciado em Magia': {
    livro: 'Talentos.md §Iniciado em Magia',
    categoria: 'de Origem',
    prerequisito: null,
    // Repetível, "mas deve escolher uma lista de magias diferente a cada vez"
    repetivel: true,
    escolhas: [
      { tipo: 'lista_magias', qtd: 1, opcoes: ['Clérigo', 'Druida', 'Mago'] },
      { tipo: 'atributo_conjuracao', qtd: 1, opcoes: ['inteligencia', 'sabedoria', 'carisma'] },
      { tipo: 'truque', qtd: 2 },
      { tipo: 'magia_1_circulo', qtd: 1 },
    ],
    aumento_atributo: null,
    passivos: null,
    exemplo_valido: {
      iniciado_em_magia: { lista: 'Mago', atributo: 'inteligencia', truques: ['Luz', 'Mãos Mágicas'], magia: 'Armadura Arcana' },
    },
  },
  'Músico': {
    livro: 'Talentos.md §Músico',
    categoria: 'de Origem',
    prerequisito: null,
    repetivel: false,
    escolhas: [{ tipo: 'instrumento', qtd: 3 }],
    aumento_atributo: null,
    passivos: null,
    flags: ['musico_cancao_encorajadora'],
    exemplo_valido: { selecoes: ['Alaúde', 'Flauta', 'Tambor'] },
  },
  'Sortudo': {
    livro: 'Talentos.md §Sortudo',
    categoria: 'de Origem',
    prerequisito: null,
    repetivel: false,
    escolhas: [],
    aumento_atributo: null,
    passivos: null,
    flags: ['sortudo'],
  },
  'Valentão de Taverna': {
    livro: 'Talentos.md §Valentão de Taverna',
    categoria: 'de Origem',
    prerequisito: null,
    repetivel: false,
    escolhas: [],
    aumento_atributo: null,
    passivos: { bonusDanoDesarmado: '1d4' },
    flags: ['valentao_empurrar', 'valentao_armamento_improvisado', 'valentao_dano_garantido'],
  },
  'Vigoroso': {
    livro: 'Talentos.md §Vigoroso',
    categoria: 'de Origem',
    prerequisito: null,
    repetivel: false,
    escolhas: [],
    aumento_atributo: null,
    // PV máximo é dinâmico (2 × nível) — fora do motor de passivos
    // de talentos-effects.js; verificado pela regra transversal de PV
    // quando o domínio "ficha" for implementado.
    passivos: null,
  },

  // ---------- Talentos Gerais (Talentos.md §Talentos Gerais) — parte 1 ----------
  'Adepto Elemental': {
    livro: 'Talentos.md §Adepto Elemental',
    categoria: 'Geral',
    prerequisito: { nivel: 4, conjurador: true },
    // "deve escolher um tipo de dano diferente a cada vez para Domínio Elemental"
    repetivel: true,
    escolhas: [
      { tipo: 'atributo_talento', qtd: 1 },
      { tipo: 'energia', qtd: 1, opcoes: ['Ácido', 'Elétrico', 'Gélido', 'Ígneo', 'Trovejante'] },
    ],
    aumento_atributo: ['inteligencia', 'sabedoria', 'carisma'],
    passivos: null,
    exemplo_valido: { atributo: 'inteligencia', energia: 'Ácido' },
  },
  'Agressor': {
    livro: 'Talentos.md §Agressor',
    categoria: 'Geral',
    prerequisito: { nivel: 4, atributos_alternativos: { forca: 13, destreza: 13 } },
    repetivel: false,
    escolhas: [{ tipo: 'atributo_talento', qtd: 1 }],
    aumento_atributo: ['forca', 'destreza'],
    passivos: null,
    flags: ['agressor_corrida', 'agressor_investida'],
    exemplo_valido: { atributo: 'forca' },
  },
  'Analítico': {
    livro: 'Talentos.md §Analítico',
    categoria: 'Geral',
    prerequisito: { nivel: 4, atributos_alternativos: { inteligencia: 13, sabedoria: 13 } },
    repetivel: false,
    // Observador Atento: perícia à escolha entre as três listadas
    escolhas: [
      { tipo: 'atributo_talento', qtd: 1 },
      { tipo: 'pericia', qtd: 1, opcoes: ['Intuição', 'Investigação', 'Percepção'] },
    ],
    aumento_atributo: ['inteligencia', 'sabedoria'],
    passivos: null,
    exemplo_valido: { atributo: 'sabedoria', pericia: 'Percepção' },
  },
  'Atirador Arcano': {
    livro: 'Talentos.md §Atirador Arcano',
    categoria: 'Geral',
    prerequisito: { nivel: 4, conjurador: true },
    repetivel: false,
    escolhas: [{ tipo: 'atributo_talento', qtd: 1 }],
    aumento_atributo: ['inteligencia', 'sabedoria', 'carisma'],
    passivos: null,
    flags: ['atirador_arcano_cobertura', 'atirador_arcano_queima_roupa', 'atirador_arcano_alcance'],
    exemplo_valido: { atributo: 'carisma' },
  },
  'Atleta': {
    livro: 'Talentos.md §Atleta',
    categoria: 'Geral',
    prerequisito: { nivel: 4, atributos_alternativos: { forca: 13, destreza: 13 } },
    repetivel: false,
    escolhas: [{ tipo: 'atributo_talento', qtd: 1 }],
    aumento_atributo: ['forca', 'destreza'],
    passivos: null,
    flags: ['atleta_escalada', 'atleta_salto'],
    exemplo_valido: { atributo: 'destreza' },
  },
  'Ator': {
    livro: 'Talentos.md §Ator',
    categoria: 'Geral',
    prerequisito: { nivel: 4, atributos: { carisma: 13 } },
    repetivel: false,
    escolhas: [{ tipo: 'atributo_talento', qtd: 1 }],
    aumento_atributo: ['carisma'],
    passivos: null,
    flags: ['ator_personificacao', 'ator_mimetismo'],
    exemplo_valido: { atributo: 'carisma' },
  },
  'Aumento no Valor de Atributo': {
    livro: 'Talentos.md §Aumento no Valor de Atributo',
    categoria: 'Geral',
    prerequisito: { nivel: 4 },
    repetivel: true,
    // "aumente um atributo em 2, ou dois atributos em 1" — 2 pontos
    escolhas: [{ tipo: 'atributo_talento', qtd: 2 }],
    aumento_atributo: null, // o talento É o aumento; campo é para o +1 embutido dos demais
    passivos: null,
    exemplo_valido: { atributo: 'forca' },
  },
  'Chef': {
    livro: 'Talentos.md §Chef',
    categoria: 'Geral',
    prerequisito: { nivel: 4 },
    repetivel: false,
    escolhas: [{ tipo: 'atributo_talento', qtd: 1 }],
    aumento_atributo: ['constituicao', 'sabedoria'],
    passivos: null,
    flags: ['chef_refeicao', 'chef_guloseimas'],
    exemplo_valido: { atributo: 'constituicao' },
  },
  'Combatente Montado': {
    livro: 'Talentos.md §Combatente Montado',
    categoria: 'Geral',
    prerequisito: { nivel: 4 },
    repetivel: false,
    escolhas: [{ tipo: 'atributo_talento', qtd: 1 }],
    aumento_atributo: ['forca', 'destreza', 'sabedoria'],
    passivos: null,
    flags: ['combatente_montado'],
    exemplo_valido: { atributo: 'sabedoria' },
  },
  'Conjurador Bélico': {
    livro: 'Talentos.md §Conjurador Bélico',
    categoria: 'Geral',
    prerequisito: { nivel: 4, conjurador: true },
    repetivel: false,
    escolhas: [{ tipo: 'atributo_talento', qtd: 1 }],
    aumento_atributo: ['inteligencia', 'sabedoria', 'carisma'],
    passivos: null,
    flags: ['conjurador_belico_concentracao', 'conjurador_belico_magia_reativa', 'conjurador_belico_somaticos'],
    exemplo_valido: { atributo: 'inteligencia' },
  },
  'Conjurador Ritualista': {
    livro: 'Talentos.md §Conjurador Ritualista',
    categoria: 'Geral',
    prerequisito: { nivel: 4, atributos_alternativos: { inteligencia: 13, sabedoria: 13, carisma: 13 } },
    repetivel: false,
    escolhas: [
      { tipo: 'atributo_talento', qtd: 1 },
      { tipo: 'ritual', qtd: 'proficiencia' }, // qtd = bônus de proficiência
    ],
    aumento_atributo: ['inteligencia', 'sabedoria', 'carisma'],
    passivos: null,
    // charBase dos testes tem nível 4 → bônus +2 → 2 rituais
    exemplo_valido: { atributo: 'sabedoria', rituais: ['Alarme', 'Identificar'] },
  },
  'Duelista Defensivo': {
    livro: 'Talentos.md §Duelista Defensivo',
    categoria: 'Geral',
    prerequisito: { nivel: 4, atributos: { destreza: 13 } },
    repetivel: false,
    escolhas: [{ tipo: 'atributo_talento', qtd: 1 }],
    aumento_atributo: ['destreza'],
    passivos: null,
    flags: ['duelista_defensivo_aparar'],
    exemplo_valido: { atributo: 'destreza' },
  },
  'Envenenador': {
    livro: 'Talentos.md §Envenenador',
    categoria: 'Geral',
    prerequisito: { nivel: 4 },
    repetivel: false,
    escolhas: [{ tipo: 'atributo_talento', qtd: 1 }],
    aumento_atributo: ['destreza', 'inteligencia'],
    passivos: null,
    flags: ['envenenador_potente', 'envenenador_preparar'],
    exemplo_valido: { atributo: 'destreza' },
  },
  'Esmagador': {
    livro: 'Talentos.md §Esmagador',
    categoria: 'Geral',
    prerequisito: { nivel: 4 },
    repetivel: false,
    escolhas: [{ tipo: 'atributo_talento', qtd: 1 }],
    aumento_atributo: ['forca', 'constituicao'],
    passivos: null,
    flags: ['esmagador_empurrar', 'esmagador_critico'],
    exemplo_valido: { atributo: 'forca' },
  },
  'Especialista Ambidestro': {
    livro: 'Talentos.md §Especialista Ambidestro',
    categoria: 'Geral',
    prerequisito: { nivel: 4, atributos_alternativos: { forca: 13, destreza: 13 } },
    repetivel: false,
    escolhas: [{ tipo: 'atributo_talento', qtd: 1 }],
    aumento_atributo: ['forca', 'destreza'],
    passivos: null,
    flags: ['ambidestro_aprimorado', 'ambidestro_saque_rapido'],
    exemplo_valido: { atributo: 'destreza' },
  },
  'Especialista em Armaduras Leves': {
    livro: 'Talentos.md §Especialista em Armaduras Leves',
    categoria: 'Geral',
    prerequisito: { nivel: 4 },
    repetivel: false,
    escolhas: [{ tipo: 'atributo_talento', qtd: 1 }],
    aumento_atributo: ['forca', 'destreza'],
    // resolverPassivosTalentos empurra o nome direto para proficienciasExtra
    passivos: { proficienciasExtra: ['Armadura Leve'] },
    exemplo_valido: { atributo: 'destreza' },
  },
  'Especialista em Armaduras Médias': {
    livro: 'Talentos.md §Especialista em Armaduras Médias',
    categoria: 'Geral',
    prerequisito: { nivel: 4, armadura: 'Leve' },
    repetivel: false,
    escolhas: [{ tipo: 'atributo_talento', qtd: 1 }],
    aumento_atributo: ['forca', 'destreza'],
    passivos: { proficienciasExtra: ['Armadura Média'] },
    exemplo_valido: { atributo: 'forca' },
  },
  'Especialista em Armaduras Pesadas': {
    livro: 'Talentos.md §Especialista em Armaduras Pesadas',
    categoria: 'Geral',
    prerequisito: { nivel: 4, armadura: 'Média' },
    repetivel: false,
    escolhas: [{ tipo: 'atributo_talento', qtd: 1 }],
    aumento_atributo: ['constituicao', 'forca'],
    passivos: { proficienciasExtra: ['Armadura Pesada'] },
    exemplo_valido: { atributo: 'constituicao' },
  },
  'Especialista em Besta': {
    livro: 'Talentos.md §Especialista em Besta',
    categoria: 'Geral',
    prerequisito: { nivel: 4, atributos: { destreza: 13 } },
    repetivel: false,
    escolhas: [{ tipo: 'atributo_talento', qtd: 1 }],
    aumento_atributo: ['destreza'],
    passivos: null,
    flags: ['besta_ignorar_recarga', 'besta_queima_roupa', 'besta_duas_armas'],
    exemplo_valido: { atributo: 'destreza' },
  },
  'Especialista em Perícia': {
    livro: 'Talentos.md §Especialista em Perícia',
    categoria: 'Geral',
    prerequisito: { nivel: 4 },
    // A seção do livro (linhas 464–476) NÃO tem parágrafo "**Repetível.**"
    // (diferente de Habilidoso). Não "restaurar" para true.
    repetivel: false,
    escolhas: [
      { tipo: 'atributo_talento', qtd: 1 },
      { tipo: 'pericia', qtd: 1 },
      { tipo: 'pericia_expertise', qtd: 1 },
    ],
    aumento_atributo: ['forca', 'destreza', 'constituicao', 'inteligencia', 'sabedoria', 'carisma'],
    passivos: null,
    // Expertise na mesma perícia recém-adquirida é aceita pelo app.
    // A perícia escolhida NÃO pode ser uma das já proficientes em charBase()
    // (Atletismo, História) — validarEscolhasTalento rejeita proficiência
    // repetida. Não "restaurar" para Atletismo/Atletismo.
    exemplo_valido: { atributo: 'inteligencia', pericia_proficiencia: 'Furtividade', pericia_expertise: 'Furtividade' },
  },
  'Exterminador de Conjuradores': {
    livro: 'Talentos.md §Exterminador de Conjuradores',
    categoria: 'Geral',
    prerequisito: { nivel: 4 },
    repetivel: false,
    escolhas: [{ tipo: 'atributo_talento', qtd: 1 }],
    aumento_atributo: ['forca', 'destreza'],
    passivos: null,
    flags: ['exterminador_quebra_concentracao', 'exterminador_resguardo'],
    exemplo_valido: { atributo: 'forca' },
  },
  'Imobilizador': {
    livro: 'Talentos.md §Imobilizador',
    categoria: 'Geral',
    prerequisito: { nivel: 4, atributos_alternativos: { forca: 13, destreza: 13 } },
    repetivel: false,
    escolhas: [{ tipo: 'atributo_talento', qtd: 1 }],
    aumento_atributo: ['forca', 'destreza'],
    passivos: null,
    flags: ['imobilizador_socar', 'imobilizador_vantagem', 'imobilizador_veloz'],
    exemplo_valido: { atributo: 'forca' },
  },
  'Líder Inspirador': {
    livro: 'Talentos.md §Líder Inspirador',
    categoria: 'Geral',
    prerequisito: { nivel: 4, atributos_alternativos: { sabedoria: 13, carisma: 13 } },
    repetivel: false,
    escolhas: [{ tipo: 'atributo_talento', qtd: 1 }],
    aumento_atributo: ['sabedoria', 'carisma'],
    passivos: null,
    flags: ['lider_inspirador'],
    exemplo_valido: { atributo: 'sabedoria' },
  },

  // ---------- Talentos Gerais (Talentos.md §Talentos Gerais) — parte 2 ----------
  'Mente Aguçada': {
    livro: 'Talentos.md §Mente Aguçada',
    categoria: 'Geral',
    prerequisito: { nivel: 4, atributos: { inteligencia: 13 } },
    repetivel: false,
    // "Conhecimento Vasto": escolhe 1 das 5 perícias listadas; app não
    // implementa o efeito (nem em regras-cobertura.js nem em
    // talentos-effects.js) — passivos fica null.
    escolhas: [
      { tipo: 'atributo_talento', qtd: 1 },
      { tipo: 'pericia', qtd: 1, opcoes: ['Arcanismo', 'História', 'Investigação', 'Natureza', 'Religião'] },
    ],
    aumento_atributo: ['inteligencia'],
    passivos: null,
    exemplo_valido: { atributo: 'inteligencia', pericia: 'Arcanismo' },
  },
  'Mestre das Armas': {
    livro: 'Talentos.md §Mestre das Armas',
    categoria: 'Geral',
    prerequisito: { nivel: 4 },
    repetivel: false,
    // "Propriedade de Maestria": escolhe 1 arma Simples ou Marcial com a
    // qual já tem proficiência (troca a cada Descanso Longo — troca não é
    // uma escolha de aquisição, fica fora).
    escolhas: [
      { tipo: 'atributo_talento', qtd: 1 },
      { tipo: 'arma', qtd: 1 },
    ],
    aumento_atributo: ['forca', 'destreza'],
    passivos: null,
    flags: ['mestre_armas_maestria_extra'],
    exemplo_valido: { atributo: 'forca', arma: 'Espada Longa' },
  },
  'Mestre em Armaduras Médias': {
    livro: 'Talentos.md §Mestre em Armaduras Médias',
    categoria: 'Geral',
    prerequisito: { nivel: 4, armadura: 'Média' },
    repetivel: false,
    escolhas: [{ tipo: 'atributo_talento', qtd: 1 }],
    aumento_atributo: ['forca', 'destreza'],
    // resolverPassivosTalentos: bonusCAArmaduraMediaMaxDes = 3
    passivos: { bonusCAArmaduraMediaMaxDes: 3 },
    exemplo_valido: { atributo: 'destreza' },
  },
  'Mestre em Armaduras Pesadas': {
    livro: 'Talentos.md §Mestre em Armaduras Pesadas',
    categoria: 'Geral',
    prerequisito: { nivel: 4, armadura: 'Pesada' },
    repetivel: false,
    escolhas: [{ tipo: 'atributo_talento', qtd: 1 }],
    aumento_atributo: ['forca', 'constituicao'],
    passivos: null,
    flags: ['mestre_armadura_pesada_reducao_dano'],
    exemplo_valido: { atributo: 'constituicao' },
  },
  'Mestre em Armas de Haste': {
    livro: 'Talentos.md §Mestre em Armas de Haste',
    categoria: 'Geral',
    prerequisito: { nivel: 4, atributos_alternativos: { forca: 13, destreza: 13 } },
    repetivel: false,
    escolhas: [{ tipo: 'atributo_talento', qtd: 1 }],
    aumento_atributo: ['forca', 'destreza'],
    passivos: null,
    flags: ['mestre_haste_golpe', 'mestre_haste_reativo'],
    exemplo_valido: { atributo: 'forca' },
  },
  'Mestre em Armas Grandes': {
    livro: 'Talentos.md §Mestre em Armas Grandes',
    categoria: 'Geral',
    prerequisito: { nivel: 4, atributos: { forca: 13 } },
    repetivel: false,
    escolhas: [{ tipo: 'atributo_talento', qtd: 1 }],
    aumento_atributo: ['forca'],
    passivos: null,
    flags: ['mestre_armas_grandes_maestria', 'mestre_armas_grandes_cortar'],
    exemplo_valido: { atributo: 'forca' },
  },
  'Mestre em Escudos': {
    livro: 'Talentos.md §Mestre em Escudos',
    categoria: 'Geral',
    // "Treinamento com Escudo" — sem convenção prévia no catálogo para
    // pré-requisito de escudo; segue o padrão do campo "armadura" já usado.
    prerequisito: { nivel: 4, escudo: true },
    repetivel: false,
    escolhas: [{ tipo: 'atributo_talento', qtd: 1 }],
    aumento_atributo: ['forca'],
    passivos: null,
    flags: ['mestre_escudos_golpe', 'mestre_escudos_interpor'],
    exemplo_valido: { atributo: 'forca' },
  },
  'Mestre-Atirador': {
    livro: 'Talentos.md §Mestre-Atirador',
    categoria: 'Geral',
    prerequisito: { nivel: 4, atributos: { destreza: 13 } },
    repetivel: false,
    escolhas: [{ tipo: 'atributo_talento', qtd: 1 }],
    aumento_atributo: ['destreza'],
    passivos: null,
    flags: ['mestre_atirador_cobertura', 'mestre_atirador_queima_roupa', 'mestre_atirador_tiro_longo'],
    exemplo_valido: { atributo: 'destreza' },
  },
  'Perfurador': {
    livro: 'Talentos.md §Perfurador',
    categoria: 'Geral',
    prerequisito: { nivel: 4 },
    repetivel: false,
    escolhas: [{ tipo: 'atributo_talento', qtd: 1 }],
    aumento_atributo: ['forca', 'destreza'],
    passivos: null,
    flags: ['perfurador_puncao', 'perfurador_critico'],
    exemplo_valido: { atributo: 'destreza' },
  },
  'Resiliente': {
    livro: 'Talentos.md §Resiliente',
    categoria: 'Geral',
    prerequisito: { nivel: 4 },
    repetivel: false,
    escolhas: [{ tipo: 'atributo_salvaguarda', qtd: 1 }],
    aumento_atributo: ['forca', 'destreza', 'constituicao', 'inteligencia', 'sabedoria', 'carisma'],
    passivos: null,
    exemplo_valido: { atributo: 'sabedoria' },
  },
  'Resistente': {
    livro: 'Talentos.md §Resistente',
    categoria: 'Geral',
    prerequisito: { nivel: 4 },
    repetivel: false,
    escolhas: [{ tipo: 'atributo_talento', qtd: 1 }],
    aumento_atributo: ['constituicao'],
    passivos: null,
    flags: ['resistente_recuperacao_rapida', 'resistente_vantagem_morte'],
    exemplo_valido: { atributo: 'constituicao' },
  },
  'Sentinela': {
    livro: 'Talentos.md §Sentinela',
    categoria: 'Geral',
    prerequisito: { nivel: 4, atributos_alternativos: { forca: 13, destreza: 13 } },
    repetivel: false,
    escolhas: [{ tipo: 'atributo_talento', qtd: 1 }],
    aumento_atributo: ['forca', 'destreza'],
    passivos: null,
    flags: ['sentinela_diligente', 'sentinela_deter'],
    exemplo_valido: { atributo: 'forca' },
  },
  'Sorrateiro': {
    livro: 'Talentos.md §Sorrateiro',
    categoria: 'Geral',
    prerequisito: { nivel: 4, atributos: { destreza: 13 } },
    repetivel: false,
    escolhas: [{ tipo: 'atributo_talento', qtd: 1 }],
    aumento_atributo: ['destreza'],
    passivos: null,
    flags: ['sorrateiro_visao_cegas_3m', 'sorrateiro_nevoa', 'sorrateiro_atirador'],
    exemplo_valido: { atributo: 'destreza' },
  },
  'Talhador': {
    livro: 'Talentos.md §Talhador',
    categoria: 'Geral',
    prerequisito: { nivel: 4 },
    repetivel: false,
    escolhas: [{ tipo: 'atributo_talento', qtd: 1 }],
    aumento_atributo: ['forca', 'destreza'],
    passivos: null,
    flags: ['talhador_debilitar', 'talhador_critico'],
    exemplo_valido: { atributo: 'forca' },
  },
  'Telecinético': {
    livro: 'Talentos.md §Telecinético',
    categoria: 'Geral',
    prerequisito: { nivel: 4 },
    repetivel: false,
    // Talentos.md §Telecinético: "O atributo de conjuração da magia [Mãos
    // Mágicas] é o atributo aumentado por este talento" — o livro não
    // separa uma escolha de atributo de conjuração da escolha do "+1"; é
    // a MESMA escolha. Por isso uma só entrada 'atributo_talento', não
    // 'atributo_conjuracao' em separado.
    escolhas: [{ tipo: 'atributo_talento', qtd: 1 }],
    aumento_atributo: ['inteligencia', 'sabedoria', 'carisma'],
    passivos: null,
    flags: ['telecinetico_menor', 'telecinetico_empurrao'],
    exemplo_valido: { atributo: 'sabedoria' },
  },
  'Telepático': {
    livro: 'Talentos.md §Telepático',
    categoria: 'Geral',
    prerequisito: { nivel: 4 },
    repetivel: false,
    escolhas: [{ tipo: 'atributo_talento', qtd: 1 }],
    aumento_atributo: ['inteligencia', 'sabedoria', 'carisma'],
    passivos: null,
    flags: ['telepatico_enunciado', 'telepatico_detectar'],
    exemplo_valido: { atributo: 'inteligencia' },
  },
  'Tocado Pelas Sombras': {
    livro: 'Talentos.md §Tocado Pelas Sombras',
    categoria: 'Geral',
    prerequisito: { nivel: 4 },
    repetivel: false,
    escolhas: [
      { tipo: 'atributo_conjuracao', qtd: 1, opcoes: ['inteligencia', 'sabedoria', 'carisma'] },
      { tipo: 'magia_1_circulo', qtd: 1 },
    ],
    aumento_atributo: ['inteligencia', 'sabedoria', 'carisma'],
    passivos: null,
    // "Disfarçar-se" é magia de 1º círculo da escola Ilusão (dados/magias/circulo_1.json)
    exemplo_valido: { atributo: 'inteligencia', magia: 'Disfarçar-se' },
  },
  'Tocado Por Fadas': {
    livro: 'Talentos.md §Tocado Por Fadas',
    categoria: 'Geral',
    prerequisito: { nivel: 4 },
    repetivel: false,
    escolhas: [
      { tipo: 'atributo_conjuracao', qtd: 1, opcoes: ['inteligencia', 'sabedoria', 'carisma'] },
      { tipo: 'magia_1_circulo', qtd: 1 },
    ],
    aumento_atributo: ['inteligencia', 'sabedoria', 'carisma'],
    passivos: null,
    exemplo_valido: { atributo: 'carisma', magia: 'Sono' },
  },
  'Treinamento com Armas Marciais': {
    livro: 'Talentos.md §Treinamento com Armas Marciais',
    categoria: 'Geral',
    prerequisito: { nivel: 4 },
    repetivel: false,
    escolhas: [{ tipo: 'atributo_talento', qtd: 1 }],
    aumento_atributo: ['forca', 'destreza'],
    // resolverPassivosTalentos empurra o nome direto para proficienciasExtra
    passivos: { proficienciasExtra: ['Armas Marciais'] },
    exemplo_valido: { atributo: 'forca' },
  },
  'Velocista': {
    livro: 'Talentos.md §Velocista',
    categoria: 'Geral',
    prerequisito: { nivel: 4, atributos_alternativos: { destreza: 13, constituicao: 13 } },
    repetivel: false,
    escolhas: [{ tipo: 'atributo_talento', qtd: 1 }],
    aumento_atributo: ['destreza', 'constituicao'],
    // resolverPassivosTalentos: bonusDeslocamento += 3
    passivos: { bonusDeslocamento: 3 },
    flags: ['velocista_terreno_dificil', 'velocista_agi'],
    exemplo_valido: { atributo: 'destreza' },
  },

  // ---------- Talentos de Estilo de Luta (Talentos.md §Talentos de Estilo de Luta) ----------
  // Todos: "Pré-requisito: Característica de Estilo de Luta" (linhas 750-808) — sem
  // escolha de aquisição, sem aumento de atributo, nenhum tem parágrafo "Repetível.".
  'Arquearia': {
    livro: 'Talentos.md §Arquearia',
    categoria: 'de Estilo de Luta',
    prerequisito: { estiloLuta: true },
    repetivel: false,
    escolhas: [],
    aumento_atributo: null,
    passivos: { bonusAtaqueDistancia: 2 },
  },
  'Combate com Armas de Arremesso': {
    livro: 'Talentos.md §Combate com Armas de Arremesso',
    categoria: 'de Estilo de Luta',
    prerequisito: { estiloLuta: true },
    repetivel: false,
    escolhas: [],
    aumento_atributo: null,
    passivos: { bonusDanoArremesso: 2 },
  },
  'Combate com Armas Grandes': {
    livro: 'Talentos.md §Combate com Armas Grandes',
    categoria: 'de Estilo de Luta',
    prerequisito: { estiloLuta: true },
    repetivel: false,
    escolhas: [],
    aumento_atributo: null,
    // Re-rolar 1 ou 2 no dado de dano (arma de duas mãos) é um efeito de
    // jogada de dado, não um bônus numérico fixo — resolverPassivosTalentos
    // expõe só a flag.
    passivos: null,
    flags: ['estilo_armas_grandes'],
  },
  'Combate com Duas Armas': {
    livro: 'Talentos.md §Combate com Duas Armas',
    categoria: 'de Estilo de Luta',
    prerequisito: { estiloLuta: true },
    repetivel: false,
    escolhas: [],
    aumento_atributo: null,
    passivos: null,
    flags: ['estilo_duas_armas'],
  },
  'Combate Desarmado': {
    livro: 'Talentos.md §Combate Desarmado',
    categoria: 'de Estilo de Luta',
    prerequisito: { estiloLuta: true },
    repetivel: false,
    escolhas: [],
    aumento_atributo: null,
    // Primeiro parágrafo (dano desarmado melhora para 1d6) é implementado;
    // o segundo (1d4 a criatura Imobilizada no início do turno) não tem
    // flag correspondente em talentos-effects.js — fica de fora.
    passivos: { bonusDanoDesarmado: '1d6' },
  },
  'Defensivo': {
    livro: 'Talentos.md §Defensivo',
    categoria: 'de Estilo de Luta',
    prerequisito: { estiloLuta: true },
    repetivel: false,
    escolhas: [],
    aumento_atributo: null,
    // O +1 de CA é calculado em calcCA (utils.js), fora do objeto de
    // passivos de talentos-effects.js, que só expõe a flag de referência.
    passivos: null,
    flags: ['estilo_defensivo'],
  },
  'Duelismo': {
    livro: 'Talentos.md §Duelismo',
    categoria: 'de Estilo de Luta',
    prerequisito: { estiloLuta: true },
    repetivel: false,
    escolhas: [],
    aumento_atributo: null,
    passivos: { bonusDanoUmaMao: 2 },
  },
  'Interceptação': {
    livro: 'Talentos.md §Interceptação',
    categoria: 'de Estilo de Luta',
    prerequisito: { estiloLuta: true },
    repetivel: false,
    escolhas: [],
    aumento_atributo: null,
    passivos: null,
    flags: ['estilo_interceptacao'],
  },
  'Luta às Cegas': {
    livro: 'Talentos.md §Luta às Cegas',
    categoria: 'de Estilo de Luta',
    prerequisito: { estiloLuta: true },
    repetivel: false,
    escolhas: [],
    aumento_atributo: null,
    passivos: null,
    flags: ['estilo_luta_cegas_3m'],
  },
  'Protetivo': {
    livro: 'Talentos.md §Protetivo',
    categoria: 'de Estilo de Luta',
    prerequisito: { estiloLuta: true },
    repetivel: false,
    escolhas: [],
    aumento_atributo: null,
    passivos: null,
    flags: ['estilo_protetivo'],
  },

  // ---------- Talentos de Dádiva Épica (Talentos.md §Talentos de Dádiva Épica) ----------
  // Todos: "Pré-requisito: Nível 19 ou superior" (linhas 816-942); nenhum tem
  // parágrafo "Repetível.". Escolha padrão é 1 atributo (+1 até 30).
  'Dádiva da Fortitude': {
    livro: 'Talentos.md §Dádiva da Fortitude',
    categoria: 'de Dádiva Épica',
    prerequisito: { nivel: 19 },
    repetivel: false,
    escolhas: [{ tipo: 'atributo_talento', qtd: 1 }],
    aumento_atributo: ['forca', 'destreza', 'constituicao', 'inteligencia', 'sabedoria', 'carisma'],
    // Os +40 PV máximos são aplicados diretamente em aplicarEfeitoTalento
    // (regras-cobertura.js), fora do motor de passivos de talentos-effects.js
    // — mesmo tratamento dado a Vigoroso. Só a flag de cura adicional entra.
    passivos: null,
    flags: ['dadiva_fortitude_cura_adicional'],
    exemplo_valido: { atributo: 'constituicao' },
  },
  'Dádiva da Proeza em Combate': {
    livro: 'Talentos.md §Dádiva da Proeza em Combate',
    categoria: 'de Dádiva Épica',
    prerequisito: { nivel: 19 },
    repetivel: false,
    escolhas: [{ tipo: 'atributo_talento', qtd: 1 }],
    aumento_atributo: ['forca', 'destreza', 'constituicao', 'inteligencia', 'sabedoria', 'carisma'],
    passivos: null,
    flags: ['dadiva_proeza_acerto_automatico'],
    exemplo_valido: { atributo: 'constituicao' },
  },
  'Dádiva da Proficiência em Perícia': {
    livro: 'Talentos.md §Dádiva da Proficiência em Perícia',
    categoria: 'de Dádiva Épica',
    prerequisito: { nivel: 19 },
    repetivel: false,
    // "Assecla Completo" (proficiência em todas as perícias) não é uma
    // escolha — é automático. "Especialização" exige escolher 1 perícia
    // já proficiente e ainda sem Especialização.
    escolhas: [
      { tipo: 'atributo_talento', qtd: 1 },
      { tipo: 'pericia_expertise', qtd: 1 },
    ],
    aumento_atributo: ['forca', 'destreza', 'constituicao', 'inteligencia', 'sabedoria', 'carisma'],
    passivos: null,
    // charBase é proficiente em Atletismo/História — validarEscolhasTalento
    // exige perícia já proficiente e ainda sem Especialização (o inverso
    // da armadilha de Especialista em Perícia, que exige perícia NOVA).
    exemplo_valido: { atributo: 'carisma', pericia_expertise: 'Atletismo' },
  },
  'Dádiva da Recordação de Magia': {
    livro: 'Talentos.md §Dádiva da Recordação de Magia',
    categoria: 'de Dádiva Épica',
    // "Pré-requisito: Nível 19 ou superior, Característica de Conjuração"
    prerequisito: { nivel: 19, conjurador: true },
    repetivel: false,
    escolhas: [{ tipo: 'atributo_talento', qtd: 1 }],
    // Exceção ao padrão: "Aumente seu valor de Inteligência, Sabedoria ou
    // Carisma em 1" — não é livre entre os seis atributos como as demais.
    aumento_atributo: ['inteligencia', 'sabedoria', 'carisma'],
    passivos: null,
    flags: ['dadiva_recordacao_magia'],
    exemplo_valido: { atributo: 'sabedoria' },
  },
  'Dádiva da Recuperação': {
    livro: 'Talentos.md §Dádiva da Recuperação',
    categoria: 'de Dádiva Épica',
    prerequisito: { nivel: 19 },
    repetivel: false,
    escolhas: [{ tipo: 'atributo_talento', qtd: 1 }],
    aumento_atributo: ['forca', 'destreza', 'constituicao', 'inteligencia', 'sabedoria', 'carisma'],
    passivos: null,
    flags: ['dadiva_recuperacao'],
    exemplo_valido: { atributo: 'constituicao' },
  },
  'Dádiva da Resistência à Energia': {
    livro: 'Talentos.md §Dádiva da Resistência à Energia',
    categoria: 'de Dádiva Épica',
    prerequisito: { nivel: 19 },
    escolhas: [
      { tipo: 'atributo_talento', qtd: 1 },
      // Talentos.md §Dádiva da Resistência à Energia enumera os 9 tipos
      // inline ("Ácido, Elétrico, Gélido, Ígneo, Necrótico, Psíquico,
      // Radiante, Trovejante ou Venenoso") — mesma lista de
      // TIPOS_ENERGIA em site/js/regras-cobertura.js.
      { tipo: 'energia', qtd: 2, opcoes: ['Ácido', 'Elétrico', 'Gélido', 'Ígneo', 'Necrótico', 'Psíquico', 'Radiante', 'Trovejante', 'Venenoso'] },
    ],
    repetivel: false,
    aumento_atributo: ['forca', 'destreza', 'constituicao', 'inteligencia', 'sabedoria', 'carisma'],
    // As resistências escolhidas são dinâmicas (char.talentos_parametros),
    // por isso não entram como valor fixo em passivos — só a flag da reação
    // de redirecionamento.
    passivos: null,
    flags: ['dadiva_redirecionamento_energia'],
    // validarEscolhasTalento exige exatamente 2 tipos distintos dentre
    // TIPOS_ENERGIA (regras-cobertura.js).
    exemplo_valido: { atributo: 'constituicao', energias: ['Ácido', 'Gélido'] },
  },
  'Dádiva da Velocidade': {
    livro: 'Talentos.md §Dádiva da Velocidade',
    categoria: 'de Dádiva Épica',
    prerequisito: { nivel: 19 },
    repetivel: false,
    escolhas: [{ tipo: 'atributo_talento', qtd: 1 }],
    aumento_atributo: ['forca', 'destreza', 'constituicao', 'inteligencia', 'sabedoria', 'carisma'],
    passivos: { bonusDeslocamento: 9 },
    flags: ['dadiva_velocidade_desengajar'],
    exemplo_valido: { atributo: 'destreza' },
  },
  'Dádiva da Viagem Dimensional': {
    livro: 'Talentos.md §Dádiva da Viagem Dimensional',
    categoria: 'de Dádiva Épica',
    prerequisito: { nivel: 19 },
    repetivel: false,
    escolhas: [{ tipo: 'atributo_talento', qtd: 1 }],
    aumento_atributo: ['forca', 'destreza', 'constituicao', 'inteligencia', 'sabedoria', 'carisma'],
    passivos: null,
    flags: ['dadiva_viagem_dimensional'],
    exemplo_valido: { atributo: 'destreza' },
  },
  'Dádiva da Visão Verdadeira': {
    livro: 'Talentos.md §Dádiva da Visão Verdadeira',
    categoria: 'de Dádiva Épica',
    prerequisito: { nivel: 19 },
    repetivel: false,
    escolhas: [{ tipo: 'atributo_talento', qtd: 1 }],
    aumento_atributo: ['forca', 'destreza', 'constituicao', 'inteligencia', 'sabedoria', 'carisma'],
    // resolverPassivosTalentos: visaoVerdadeira = max(atual, 18)
    passivos: { visaoVerdadeira: 18 },
    exemplo_valido: { atributo: 'sabedoria' },
  },
  'Dádiva do Ataque Irresistível': {
    livro: 'Talentos.md §Dádiva do Ataque Irresistível',
    categoria: 'de Dádiva Épica',
    prerequisito: { nivel: 19 },
    repetivel: false,
    escolhas: [{ tipo: 'atributo_talento', qtd: 1 }],
    // Exceção ao padrão: "Aumente seu valor de Força ou Destreza em 1" —
    // apenas dois atributos, não os seis.
    aumento_atributo: ['forca', 'destreza'],
    passivos: null,
    flags: ['dadiva_ataque_ignora_resistencia', 'dadiva_ataque_critico_adicional'],
    exemplo_valido: { atributo: 'forca' },
  },
  'Dádiva do Destino': {
    livro: 'Talentos.md §Dádiva do Destino',
    categoria: 'de Dádiva Épica',
    prerequisito: { nivel: 19 },
    repetivel: false,
    escolhas: [{ tipo: 'atributo_talento', qtd: 1 }],
    aumento_atributo: ['forca', 'destreza', 'constituicao', 'inteligencia', 'sabedoria', 'carisma'],
    passivos: null,
    flags: ['dadiva_destino'],
    exemplo_valido: { atributo: 'sabedoria' },
  },
  'Dádiva do Espírito da Noite': {
    livro: 'Talentos.md §Dádiva do Espírito da Noite',
    categoria: 'de Dádiva Épica',
    prerequisito: { nivel: 19 },
    repetivel: false,
    escolhas: [{ tipo: 'atributo_talento', qtd: 1 }],
    aumento_atributo: ['forca', 'destreza', 'constituicao', 'inteligencia', 'sabedoria', 'carisma'],
    passivos: null,
    flags: ['dadiva_espirito_noite_invisivel', 'dadiva_espirito_noite_resistencia'],
    exemplo_valido: { atributo: 'destreza' },
  },
};
