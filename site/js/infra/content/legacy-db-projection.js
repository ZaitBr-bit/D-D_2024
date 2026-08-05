// Módulo `infra/content/legacy-db-projection`: projeção de LEITURA que traduz
// as entidades do catálogo (`dados/pacotes/dnd2024/**`) para as formas que
// `site/js/db.js` devolve hoje.
//
// ## Papel desta camada
//
// É uma projeção pura do lado de leitura: recebe entidades já carregadas e
// devolve um valor novo. Nunca muta a entrada, nunca persiste nada, nunca
// consulta rede (ver docs/superpowers/plans, "uma consulta/projeção/render
// nunca muta nem persiste o personagem"). `site/js/db.js` permanece
// INALTERADO nesta tarefa: o runtime público só passa a usar esta projeção no
// cutover explícito da Task 22.
//
// ## Regra dura: projetar campo estruturado, nunca reinterpretar prosa
//
// A projeção só lê CAMPOS ESTRUTURADOS do catálogo (`weight`, `cost`,
// `armorCategory`, `effects[].type`, ...) e mapas de vocabulário fechado
// (`gp` -> `PO`, `light` -> `Leve`). Ela NÃO faz parsing de texto livre para
// recuperar um campo legado — reintroduzir extração de prosa no caminho de
// leitura traria de volta exatamente a fragilidade que esta refatoração
// remove, e prosa vinda de JSON é dado não confiável.
//
// Consequência: alguns campos legados eram APRESENTAÇÃO derivada de prosa
// (ex.: `armas[].propriedades` = "Arremesso (Alcance 6/18)") ou não foram
// levados ao catálogo pela migração das Tasks 8-10 (ex.:
// `tabela_caracteristicas` e `texto_completo` de classe). Esses campos são
// declarados, um por um, em `LEGACY_PROJECTION_GAPS`, que
// `tests/contract/legacy-db-projection.test.js` compara com o diff REAL contra
// `site/js/db.js`. A lista é um contrato, não uma desculpa: qualquer
// divergência a mais (ou a menos) reprova o teste.
//
// Fechar essas lacunas exige enriquecer o catálogo (campos de apresentação na
// migração) ou migrar o consumidor (Tasks 12-23) — não é resolvível aqui sem
// voltar a parsear prosa.

// --- Vocabulários fechados -------------------------------------------------

// Moeda: inverso exato do mapa usado por scripts/content/migrate-spells-equipment.mjs.
const CURRENCY_TO_LEGACY = Object.freeze({ cp: 'PC', sp: 'PP', gp: 'PO', pp: 'PL' });

// Categoria de armadura -> rótulo legado.
const ARMOR_CATEGORY_TO_LEGACY = Object.freeze({
  light: 'Leve',
  medium: 'Média',
  heavy: 'Pesada',
  shield: 'Escudo',
});

// Maestria de arma -> rótulo legado.
const MASTERY_TO_LEGACY = Object.freeze({
  nick: 'Ágil',
  slow: 'Lentidão',
  topple: 'Derrubar',
  push: 'Empurrar',
  sap: 'Drenar',
  cleave: 'Trespassar',
  graze: 'Garantido',
  vex: 'Afligir',
});

// Escola de magia -> rótulo legado.
const SCHOOL_TO_LEGACY = Object.freeze({
  abjuration: 'Abjuração',
  conjuration: 'Invocação',
  divination: 'Adivinhação',
  enchantment: 'Encantamento',
  evocation: 'Evocação',
  illusion: 'Ilusão',
  necromancy: 'Necromancia',
  transmutation: 'Transmutação',
});

// Categoria de talento -> rótulo legado (chave de `por_categoria`).
const FEAT_CATEGORY_TO_LEGACY = Object.freeze({
  origin: 'de Origem',
  general: 'Geral',
  'fighting-style': 'de Estilo de Luta',
  'epic-boon': 'de Dádiva Épica',
});

// Categoria de apresentação de equipamento -> `tipo_uso` legado.
const EQUIPMENT_CATEGORY_TO_LEGACY_USE = Object.freeze({
  'Consumível': 'consumivel',
  Equipamento: 'equipamento',
});

// Categoria de alcance de arma -> sufixo da coluna `categoria` legada.
const WEAPON_RANGE_CATEGORY_TO_LEGACY = Object.freeze({
  melee: 'Corpo a Corpo',
  ranged: 'à Distância',
});

// Propriedade de arma -> rótulo legado, na grafia da tabela de equipamento.
const WEAPON_PROPERTY_TO_LEGACY = Object.freeze({
  finesse: 'Acuidade',
  thrown: 'Arremesso',
  'two-handed': 'Duas Mãos',
  reach: 'Extensão',
  light: 'Leve',
  ammunition: 'Munição',
  heavy: 'Pesada',
  loading: 'Recarga',
  versatile: 'Versátil',
  range: 'Alcance',
  special: 'Especial',
});

// Marcadores da coluna `especial` das listas de magia por classe.
const SPECIAL_MARKERS = Object.freeze([
  ['concentration', 'C'],
  ['ritual', 'R'],
  ['material', 'M'],
]);

const EM_DASH = '—';

/**
 * Operações projetáveis: exatamente os exports públicos de `site/js/db.js`.
 * `precarregarDadosCriacao` entra na lista por completude da fachada, mas não
 * tem valor projetado (é um aquecimento de cache).
 * @type {ReadonlyArray<string>}
 */
export const LEGACY_DB_OPERATIONS = Object.freeze([
  'getClasse',
  'getMagiasClasse',
  'getAntecedentes',
  'getEspecies',
  'getTalentos',
  'getArmas',
  'getArmaduras',
  'getEquipamentoAventura',
  'getFerramentas',
  'getIndiceMagias',
  'getMagiasPorCirculo',
  'getMagiasPorClasseLista',
  'getMagia',
  'buscarMagias',
  'getCriaturas',
  'getGlossario',
  'precarregarDadosCriacao',
]);

// --- Utilidades puras ------------------------------------------------------

/**
 * Normaliza um nome legado para o slug usado nos ContentIds, exatamente com
 * as mesmas substituições de `site/js/db.js` (nome de arquivo legado e slug de
 * ContentId coincidem para classes).
 * @param {*} nome
 * @returns {string}
 */
export function legacyNameToSlug(nome) {
  if (typeof nome !== 'string') {
    return '';
  }
  return nome
    .toLowerCase()
    .replace(/á/g, 'a')
    .replace(/ã/g, 'a')
    .replace(/é/g, 'e')
    .replace(/í/g, 'i')
    .replace(/ó/g, 'o')
    .replace(/ú/g, 'u');
}

/**
 * Formata um peso em kg no formato de apresentação legado.
 *
 * Regra derivada dos dados legados: valores com até uma casa decimal são
 * apresentados em kg com vírgula ("0,5 kg", "6,5 kg", "4 kg"); valores com
 * duas casas decimais são apresentados em gramas ("750 g", "250 g", "150 g").
 * Ausência de peso é o travessão legado.
 * @param {*} kg
 * @returns {string}
 */
export function formatLegacyWeight(kg) {
  if (typeof kg !== 'number' || !Number.isFinite(kg)) {
    return EM_DASH;
  }
  const casas = (String(kg).split('.')[1] ?? '').length;
  if (casas >= 2) {
    return `${Math.round(kg * 1000)} g`;
  }
  return `${String(kg).replace('.', ',')} kg`;
}

/**
 * Formata um custo estruturado no formato de apresentação legado
 * ("2 PO", "1.500 PO", "4 PC"). Milhares usam ponto, como no legado.
 * @param {*} cost
 * @returns {string}
 */
export function formatLegacyCost(cost) {
  if (cost === null || typeof cost !== 'object') {
    return EM_DASH;
  }
  const moeda = CURRENCY_TO_LEGACY[cost.currency];
  if (moeda === undefined || typeof cost.amount !== 'number') {
    return EM_DASH;
  }
  const inteiro = String(cost.amount).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${inteiro} ${moeda}`;
}

/**
 * Monta o índice `id -> entidade` de uma lista de entidades.
 * @param {ReadonlyArray<*>} entities
 * @returns {Map<string, object>}
 */
function indexById(entities) {
  const mapa = new Map();
  for (const entidade of Array.isArray(entities) ? entities : []) {
    if (entidade !== null && typeof entidade === 'object' && typeof entidade.id === 'string') {
      mapa.set(entidade.id, entidade);
    }
  }
  return mapa;
}

/**
 * Filtra as entidades de um tipo, preservando a ordem recebida.
 * @param {ReadonlyArray<*>} entities
 * @param {string} tipo
 * @returns {Array<object>}
 */
function ofType(entities, tipo) {
  return (Array.isArray(entities) ? entities : []).filter(
    (entidade) => entidade !== null && typeof entidade === 'object' && entidade.type === tipo,
  );
}

/**
 * Devolve o `name` da entidade referenciada, ou o próprio id quando a
 * referência não veio no conjunto de entidades (nunca lança: referência
 * quebrada é dado, não exceção).
 * @param {Map<string, object>} porId
 * @param {*} referencia
 * @returns {string}
 */
function nameOfRef(porId, referencia) {
  if (typeof referencia !== 'string') {
    return '';
  }
  const entidade = porId.get(referencia);
  return entidade !== undefined && typeof entidade.name === 'string' ? entidade.name : referencia;
}

/**
 * Devolve uma CÓPIA do bloco `legacyPresentation` de uma entidade (dívida
 * temporária da Task 23b: campos de apresentação que o catálogo não modela,
 * copiados verbatim do legado pelos conversores — ver a `description` do
 * campo em cada schema).
 *
 * A cópia é obrigatória: a projeção nunca pode devolver uma referência viva
 * para dentro do catálogo ativo, senão um consumidor mutaria o registry.
 * Entidade sem o bloco devolve `{}` — a lacuna aparece no diff em vez de
 * virar um valor plausível inventado aqui.
 * @param {object} entidade
 * @returns {object}
 */
function clonarApresentacaoLegada(entidade) {
  const bloco = entidade?.legacyPresentation;
  return bloco !== null && typeof bloco === 'object' ? structuredClone(bloco) : {};
}

/**
 * Devolve o texto do efeito `manual` com o `id` informado, ou `undefined`.
 * @param {*} entidade
 * @param {string} idEfeito
 * @returns {string | undefined}
 */
function manualEffectText(entidade, idEfeito) {
  const efeitos = Array.isArray(entidade?.effects) ? entidade.effects : [];
  const efeito = efeitos.find(
    (item) => item !== null && typeof item === 'object' && item.type === 'manual' && item.id === idEfeito,
  );
  return efeito !== undefined && typeof efeito.text === 'string' ? efeito.text : undefined;
}

// --- Projetores por operação ----------------------------------------------

/**
 * Projeta o nome do círculo como o legado o escreve.
 * @param {number} circulo
 * @returns {string}
 */
function nomeDoCirculo(circulo) {
  return circulo === 0 ? 'Truques' : `${circulo}º Círculo`;
}

/**
 * Projeta uma magia no formato "resumido" do índice legado.
 * @param {object} magia
 * @param {Map<string, object>} porId
 * @returns {object}
 */
function projetarMagiaResumida(magia, porId) {
  return {
    nome: magia.name,
    circulo: magia.level,
    escola: SCHOOL_TO_LEGACY[magia.school] ?? magia.school,
    classes: (Array.isArray(magia.classes) ? magia.classes : []).map((ref) => nameOfRef(porId, ref)),
    tempo_conjuracao: magia.castingTime,
    alcance: magia.range,
    componentes: projetarComponentes(magia.components),
    duracao: magia.duration,
  };
}

/**
 * Projeta os componentes estruturados na string legada ("V, S, M").
 * @param {*} components
 * @returns {string}
 */
function projetarComponentes(components) {
  if (components === null || typeof components !== 'object') {
    return '';
  }
  const partes = [];
  if (components.verbal === true) partes.push('V');
  if (components.somatic === true) partes.push('S');
  if (components.material === true) partes.push('M');
  const texto = partes.join(', ');
  // O legado escreve a descrição do componente material entre parênteses no
  // fim da string ("V, S, M (um sino de prata)").
  if (components.material === true && typeof components.materialDescription === 'string') {
    return `${texto} (${components.materialDescription})`;
  }
  return texto;
}

/**
 * Projeta uma magia no formato completo do arquivo de círculo legado.
 * @param {object} magia
 * @param {Map<string, object>} porId
 * @returns {object}
 */
function projetarMagiaCompleta(magia, porId) {
  return {
    ...projetarMagiaResumida(magia, porId),
    descricao: manualEffectText(magia, 'descricao') ?? magia.description ?? '',
    // O legado sempre traz a chave; magia sem aprimoramento tem string vazia,
    // e o catalogo simplesmente nao emite o efeito "aprimoramento" nesse caso.
    circulo_superior: manualEffectText(magia, 'aprimoramento') ?? '',
  };
}

/**
 * `getIndiceMagias()`: índice resumido de todas as magias.
 * @param {ReadonlyArray<*>} entities
 * @returns {object}
 */
function projetarIndiceMagias(entities) {
  const porId = indexById(entities);
  const magias = ordenarComoIndiceLegado(ofType(entities, 'spell'));
  return {
    total_magias: magias.length,
    magias: magias.map((magia) => projetarMagiaResumida(magia, porId)),
  };
}

/**
 * Ordena magias como o indice mestre legado (`dados/magias/_indice.json`):
 * comparacao por unidade de codigo do nome, nao colacao de locale. Os arquivos
 * por circulo e por classe do catalogo ja vem na ordem legada e nao sao
 * reordenados aqui.
 * @param {ReadonlyArray<object>} magias
 * @returns {Array<object>}
 */
function ordenarComoIndiceLegado(magias) {
  return [...magias].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

/**
 * `getMagiasPorCirculo(circulo)`: magias de um círculo, com descrição.
 * @param {ReadonlyArray<*>} entities
 * @returns {object | null}
 */
function projetarMagiasPorCirculo(entities) {
  const porId = indexById(entities);
  const magias = ofType(entities, 'spell');
  if (magias.length === 0) {
    return null;
  }
  const circulo = magias[0].level;
  return {
    circulo,
    nome_circulo: nomeDoCirculo(circulo),
    total_magias: magias.length,
    magias: magias.map((magia) => projetarMagiaCompleta(magia, porId)),
  };
}

/**
 * `getMagiasPorClasseLista(classe)`: lista resumida por classe.
 * @param {ReadonlyArray<*>} entities
 * @returns {object | null}
 */
function projetarMagiasPorClasseLista(entities) {
  const classe = ofType(entities, 'class')[0];
  const magias = ofType(entities, 'spell');
  if (classe === undefined) {
    return null;
  }
  return {
    classe: classe.name,
    total_magias: magias.length,
    magias: magias.map((magia) => ({
      nome: magia.name,
      circulo: magia.level,
      escola: SCHOOL_TO_LEGACY[magia.school] ?? magia.school,
    })),
  };
}

/**
 * `getMagiasClasse(classe)`: lista de magias agrupada por círculo, com a
 * coluna `especial` (C = concentração, R = ritual, M = componente material).
 * @param {ReadonlyArray<*>} entities
 * @returns {object | null}
 */
function projetarMagiasClasse(entities) {
  const classe = ofType(entities, 'class')[0];
  const magias = ofType(entities, 'spell');
  if (classe === undefined) {
    return null;
  }

  const listaMagias = {};
  for (const magia of magias) {
    const chave = nomeDoCirculo(magia.level);
    if (!Object.prototype.hasOwnProperty.call(listaMagias, chave)) {
      listaMagias[chave] = [];
    }
    listaMagias[chave].push({
      nome: magia.name,
      escola: SCHOOL_TO_LEGACY[magia.school] ?? magia.school,
      especial: projetarEspecial(magia),
    });
  }
  // Dentro de cada circulo, o arquivo legado ordena por nome ignorando
  // diacriticos ("Maos Magicas" antes de "Mensagem").
  for (const chave of Object.keys(listaMagias)) {
    listaMagias[chave].sort((a, b) => {
      const x = normalizarBusca(a.nome);
      const y = normalizarBusca(b.nome);
      return x < y ? -1 : x > y ? 1 : 0;
    });
  }
  return { classe: classe.name, lista_magias: listaMagias };
}

/**
 * Projeta a coluna `especial` de uma magia.
 * @param {object} magia
 * @returns {string}
 */
function projetarEspecial(magia) {
  const marcadores = [];
  for (const [campo, marcador] of SPECIAL_MARKERS) {
    // "M" NÃO marca "tem componente material": marca material com custo em
    // moedas ou consumido pela magia (246 das 391 magias têm material comum e
    // não recebem a marca). O catálogo guarda essa distinção em
    // `components.materialCostOrConsumed` desde a Task 23b.
    const valor = campo === 'material' ? magia?.components?.materialCostOrConsumed : magia[campo];
    if (valor === true) {
      marcadores.push(marcador);
    }
  }
  return marcadores.length === 0 ? EM_DASH : marcadores.join(', ');
}

/**
 * `getMagia(nome, circulo)`: uma magia completa, ou `null`.
 * @param {ReadonlyArray<*>} entities
 * @returns {object | null}
 */
function projetarMagia(entities) {
  const porId = indexById(entities);
  const magia = ofType(entities, 'spell')[0];
  return magia === undefined ? null : projetarMagiaCompleta(magia, porId);
}

/**
 * `buscarMagias(termo)`: lista resumida das magias que casam com o termo.
 * @param {ReadonlyArray<*>} entities
 * @returns {Array<object>}
 */
function projetarBuscaMagias(entities) {
  const porId = indexById(entities);
  return ordenarComoIndiceLegado(ofType(entities, 'spell')).map((magia) =>
    projetarMagiaResumida(magia, porId),
  );
}

/**
 * `getArmas()`: catálogo de armas.
 * @param {ReadonlyArray<*>} entities
 * @returns {object}
 */
function projetarArmas(entities) {
  const porId = indexById(entities);
  const armas = ofType(entities, 'weapon');
  const ruleset = ofType(entities, 'ruleset')[0];
  const glossario = Array.isArray(ruleset?.tables?.weaponProperties) ? ruleset.tables.weaponProperties : [];
  return {
    total: armas.length,
    armas: armas.map((arma) => {
      const familia = arma.weaponCategory === 'simple' ? 'Simples' : 'Marciais';
      const alcance = WEAPON_RANGE_CATEGORY_TO_LEGACY[arma.rangeCategory] ?? arma.rangeCategory;
      return {
        nome: arma.name,
        categoria: `Armas ${familia} ${alcance}`,
        dano: `${arma.damage?.dice ?? ''} ${nameOfRef(porId, arma.damage?.type)}`.trim(),
        propriedades: projetarPropriedadesDeArma(arma),
        maestria: MASTERY_TO_LEGACY[arma.mastery] ?? EM_DASH,
        peso: formatLegacyWeight(arma.weight),
        custo: formatLegacyCost(arma.cost),
      };
    }),
    propriedades: glossario.map((propriedade) => ({
      nome: propriedade.name,
      descricao: propriedade.description,
    })),
  };
}

/**
 * Projeta a coluna `propriedades` de uma arma.
 *
 * Montada a partir de CAMPOS ESTRUTURADOS (`properties[]` na ordem do
 * catálogo, `range`, `ammunitionType`, `versatileDamage`, `propertyNotes`) —
 * nunca de parsing de prosa. O conversor
 * (`scripts/content/migrate-spells-equipment.mjs#parseDetalhesDePropriedades`)
 * é quem extrai esses campos do texto legado, uma vez, na migração.
 * @param {object} arma
 * @returns {string}
 */
function projetarPropriedadesDeArma(arma) {
  const propriedades = Array.isArray(arma.properties) ? arma.properties : [];
  if (propriedades.length === 0) {
    return EM_DASH;
  }
  const alcance = arma.range;
  const textoAlcance =
    alcance !== null && typeof alcance === 'object' ? `Alcance ${alcance.normal}/${alcance.long}` : undefined;

  return propriedades
    .map((propriedade) => {
      const rotulo = WEAPON_PROPERTY_TO_LEGACY[propriedade] ?? propriedade;
      if (propriedade === 'thrown' && textoAlcance !== undefined) {
        return `${rotulo} (${textoAlcance})`;
      }
      if (propriedade === 'ammunition' && textoAlcance !== undefined) {
        const municao = typeof arma.ammunitionType === 'string' ? `; ${arma.ammunitionType}` : '';
        return `${rotulo} (${textoAlcance}${municao})`;
      }
      if (propriedade === 'versatile' && typeof arma.versatileDamage === 'string') {
        return `${rotulo} (${arma.versatileDamage})`;
      }
      const nota = arma.propertyNotes?.[propriedade];
      return typeof nota === 'string' ? `${rotulo} (${nota})` : rotulo;
    })
    .join(', ');
}

/**
 * `getArmaduras()`: catálogo de armaduras.
 * @param {ReadonlyArray<*>} entities
 * @returns {object}
 */
function projetarArmaduras(entities) {
  const armaduras = ofType(entities, 'armor');
  return {
    total: armaduras.length,
    armaduras: armaduras.map((armadura) => ({
      nome: armadura.name,
      categoria: ARMOR_CATEGORY_TO_LEGACY[armadura.armorCategory] ?? armadura.armorCategory,
      ca: projetarClasseArmadura(armadura),
      requisito_forca:
        typeof armadura.strengthRequirement === 'number' ? `For ${armadura.strengthRequirement}` : EM_DASH,
      furtividade: armadura.stealthDisadvantage === true ? 'Desvantagem' : EM_DASH,
      peso: formatLegacyWeight(armadura.weight),
      custo: formatLegacyCost(armadura.cost),
    })),
  };
}

/**
 * Projeta a coluna `ca` legada de uma armadura.
 *
 * DIVERGÊNCIA DELIBERADA (ver `LEGACY_INTENTIONAL_DIVERGENCES`): das 13
 * armaduras legadas, 8 citam o modificador de Destreza nesta coluna — e o
 * legado alterna a caixa entre elas: 5 escrevem "modificador de Des" e 3
 * escrevem "Modificador de Des" (as outras 5 têm CA fixa e não mencionam
 * Des). É inconsistência de transcrição, não conteúdo; a projeção emite
 * sempre a forma minúscula, majoritária entre as 8.
 * @param {object} armadura
 * @returns {string}
 */
function projetarClasseArmadura(armadura) {
  if (armadura.armorCategory === 'shield') {
    return `+${armadura.armorClassBonus ?? 0}`;
  }
  const base = String(armadura.baseArmorClass ?? '');
  if (armadura.addDexModifier !== true) {
    return base;
  }
  const teto = typeof armadura.maxDexBonus === 'number' ? ` (máx. ${armadura.maxDexBonus})` : '';
  return `${base} + modificador de Des${teto}`;
}

/**
 * `getEquipamentoAventura()`: itens de aventura e munição.
 * @param {ReadonlyArray<*>} entities
 * @returns {object}
 */
function projetarEquipamentoAventura(entities) {
  const equipamentos = ofType(entities, 'equipment');
  const itens = equipamentos.filter((item) =>
    Object.prototype.hasOwnProperty.call(EQUIPMENT_CATEGORY_TO_LEGACY_USE, item.category),
  );
  const municao = equipamentos.filter((item) => item.category === 'Munição');

  // Verbetes de prosa que o legado publicava soltos no topo do arquivo e o
  // catálogo reancorou ao item dono (`equipment.legacySections`).
  const descricoes = {};
  for (const item of equipamentos) {
    for (const secao of Array.isArray(item.legacySections) ? item.legacySections : []) {
      descricoes[secao.title] = secao.text;
    }
  }

  return {
    total_itens: itens.length,
    itens: itens.map((item) => {
      const projetado = {
        nome: item.name,
        peso: projetarPesoDeItem(item),
        custo: projetarCustoDeItem(item),
      };
      // No legado, `descricao`/`tipo_uso` so existem nos itens que tem texto
      // proprio; a maioria dos 82 itens nao traz nenhuma das duas chaves.
      if (typeof item.description === 'string' && item.description.length > 0) {
        projetado.descricao = item.description;
        projetado.tipo_uso = EQUIPMENT_CATEGORY_TO_LEGACY_USE[item.category];
      }
      return projetado;
    }),
    municao: municao.map((item) => ({
      tipo: item.name,
      quantidade: item.ammunition?.quantity,
      armazenamento: item.ammunition?.storage,
      peso: projetarPesoDeItem(item),
      custo: projetarCustoDeItem(item),
    })),
    descricoes,
  };
}

/**
 * Peso de exibição de um item: o texto legado preservado em `weightDisplay`
 * quando o valor não era um número puro ("Varia", "1 kg (saco)"), senão a
 * formatação derivada de `weight`. Sem default: item sem os dois cai no
 * travessão, como no legado.
 * @param {object} item
 * @returns {string}
 */
function projetarPesoDeItem(item) {
  return typeof item.weightDisplay === 'string' ? item.weightDisplay : formatLegacyWeight(item.weight);
}

/**
 * Custo de exibição de um item; mesma regra de `projetarPesoDeItem`.
 * @param {object} item
 * @returns {string}
 */
function projetarCustoDeItem(item) {
  return typeof item.costDisplay === 'string' ? item.costDisplay : formatLegacyCost(item.cost);
}

/**
 * `getFerramentas()`: **STUB, não é uma projeção de verdade.**
 *
 * O arquivo legado (`dados/equipamento/ferramentas.json`) é
 * `{tabelas: [], texto_completo: "<markdown>"}`: `tabelas` já vinha VAZIO no
 * legado, e o markdown não foi migrado. Então esta função devolve uma
 * constante que por coincidência bate com o legado — ela não lê nada do
 * catálogo, e nenhuma paridade aqui deve ser lida como "as ferramentas estão
 * projetadas".
 *
 * As 25 ferramentas existem no catálogo como `equipment` de categoria
 * "Ferramenta" e são projetadas por `getEquipamentoAventura` apenas se
 * mudarem de categoria; hoje ficam de fora dos dois. Quando algum consumidor
 * precisar delas, esta função deve ser substituída por uma projeção real
 * (e a lacuna `texto_completo` reavaliada).
 *
 * Nenhum arquivo de `site/js/**` chama `getFerramentas()` hoje.
 * @returns {object}
 */
function projetarFerramentas() {
  return { tabelas: [] };
}

/**
 * `getGlossario()`: termos do glossário.
 * @param {ReadonlyArray<*>} entities
 * @returns {object}
 */
function projetarGlossario(entities) {
  const termos = ofType(entities, 'glossary-entry');
  return {
    total_termos: termos.length,
    abreviacoes: [],
    termos: termos.map((termo) => ({ nome: termo.term ?? termo.name, descricao: termo.definition ?? '' })),
  };
}

/**
 * `getCriaturas()`: apêndice de criaturas.
 *
 * `description` da entidade é o `texto_completo` legado verbatim (cópia, não
 * reinterpretação). Os demais campos legados (`iniciativa`, `atributos`,
 * `pericias`, `sentidos`, `idiomas`, `nd`, `tracos`, `acoes`) só existem
 * dentro dessa prosa e por isso não são projetados.
 * @param {ReadonlyArray<*>} entities
 * @returns {object}
 */
function projetarCriaturas(entities) {
  const criaturas = ofType(entities, 'creature');
  return {
    total: criaturas.length,
    criaturas: criaturas.map((criatura) => ({
      nome: criatura.name,
      ca: String(criatura.armorClass ?? ''),
      texto_completo: typeof criatura.description === 'string' ? criatura.description : '',
    })),
  };
}

/**
 * `getEspecies()`: catálogo de espécies.
 * @param {ReadonlyArray<*>} entities
 * @returns {object}
 */
function projetarEspecies(entities) {
  const especies = ofType(entities, 'species');
  return {
    total: especies.length,
    especies: especies.map((especie) => ({
      nome: especie.name,
      // `tracos`/`texto_completo` são apresentação que o catálogo não modela
      // (cada traço virou efeito tipado). Vêm do bloco `legacyPresentation`,
      // dívida temporária declarada no schema — ver species.schema.json.
      ...clonarApresentacaoLegada(especie),
      descricao: typeof especie.description === 'string' ? especie.description : '',
    })),
  };
}

/**
 * `getAntecedentes()`: catálogo de antecedentes.
 * @param {ReadonlyArray<*>} entities
 * @returns {object}
 */
function projetarAntecedentes(entities) {
  const porId = indexById(entities);
  const antecedentes = ofType(entities, 'background');
  return {
    total: antecedentes.length,
    antecedentes: antecedentes.map((antecedente) => {
      const efeitos = Array.isArray(antecedente.effects) ? antecedente.effects : [];
      const escolhaDeIdiomas = efeitos.find(
        (efeito) => efeito?.type === 'choice' && efeito.choice?.id === 'idiomas-adicionais',
      )?.choice;
      return {
        nome: antecedente.name,
        valores_atributo: (Array.isArray(antecedente.abilityScoreOptions) ? antecedente.abilityScoreOptions : [])
          .map((ref) => nameOfRef(porId, ref))
          .join(', '),
        // `ferramentas` e `talento` são apresentação (ver background.schema.json,
        // campo `legacyPresentation`); tudo o mais abaixo é DERIVADO dos efeitos
        // estruturados, que é onde o catálogo realmente modela o antecedente.
        ...clonarApresentacaoLegada(antecedente),
        pericias: efeitos
          .filter((efeito) => efeito?.type === 'proficiency' && typeof efeito.target === 'string')
          .map((efeito) => nameOfRef(porId, efeito.target))
          .join(', '),
        idiomas_obrigatorios: efeitos
          .filter((efeito) => efeito?.type === 'language')
          .map((efeito) => nameOfRef(porId, efeito.language)),
        idiomas_adicionais: escolhaDeIdiomas?.max,
        idiomas_opcoes: (Array.isArray(escolhaDeIdiomas?.options) ? escolhaDeIdiomas.options : []).map(
          (opcao) => opcao.label,
        ),
        equipamento: projetarEquipamentoDeAntecedente(efeitos),
        descricao: typeof antecedente.description === 'string' ? antecedente.description : '',
      };
    }),
  };
}

/**
 * Remonta a frase legada de equipamento inicial de antecedente a partir da
 * escolha estruturada `equipamento-inicial` ("*Escolha A ou B:* (A) ...; ou
 * (B) ..."). O template é fixo nas 16 entradas legadas e o conversor guardou
 * cada braço como `label` de uma opção — nenhuma prosa é parseada aqui.
 * @param {ReadonlyArray<*>} efeitos
 * @returns {string | undefined}
 */
function projetarEquipamentoDeAntecedente(efeitos) {
  const escolha = efeitos.find(
    (efeito) => efeito?.type === 'choice' && efeito.choice?.id === 'equipamento-inicial',
  )?.choice;
  const opcoes = Array.isArray(escolha?.options) ? escolha.options : [];
  const a = opcoes.find((opcao) => opcao.id === 'opcao-a')?.label;
  const b = opcoes.find((opcao) => opcao.id === 'opcao-b')?.label;
  // Ausência preservada: sem os dois braços não há frase a montar.
  return typeof a === 'string' && typeof b === 'string' ? `*Escolha A ou B:* (A) ${a}; ou (B) ${b}` : undefined;
}

/**
 * `getTalentos()`: catálogo de talentos, com o agrupamento legado por
 * categoria além da lista completa.
 * @param {ReadonlyArray<*>} entities
 * @returns {object}
 */
function projetarTalentos(entities) {
  const talentos = ofType(entities, 'feat');
  /** Projeta um talento no formato legado disponível. */
  const projetar = (talento) => ({
    nome: talento.name,
    categoria: FEAT_CATEGORY_TO_LEGACY[talento.category] ?? talento.category,
    // `prerequisito` (frase inteira) e `beneficios` (nome + descrição de cada
    // benefício) são apresentação que o catálogo não modela — vêm do bloco
    // `legacyPresentation`, dívida temporária declarada em feat.schema.json.
    ...clonarApresentacaoLegada(talento),
    descricao: typeof talento.description === 'string' ? talento.description : '',
  });

  const porCategoria = {};
  for (const talento of talentos) {
    const chave = FEAT_CATEGORY_TO_LEGACY[talento.category] ?? talento.category;
    if (!Object.prototype.hasOwnProperty.call(porCategoria, chave)) {
      porCategoria[chave] = [];
    }
    porCategoria[chave].push(projetar(talento));
  }
  // O legado agrupa por categoria ordenando por nome sem diacriticos; a lista
  // `todos` mantem a ordem do catalogo.
  for (const chave of Object.keys(porCategoria)) {
    porCategoria[chave].sort((a, b) => {
      const x = normalizarBusca(a.nome);
      const y = normalizarBusca(b.nome);
      return x < y ? -1 : x > y ? 1 : 0;
    });
  }

  return {
    total: talentos.length,
    por_categoria: porCategoria,
    todos: talentos.map(projetar),
  };
}

/**
 * `getClasse(nome)`: dados de uma classe, suas características e subclasses.
 *
 * ## DÍVIDA TEMPORÁRIA — este projetor devolve o bloco `legacyPresentation`
 *
 * Diferente de todos os outros projetores deste módulo, `getClasse` NÃO
 * reconstrói o valor legado a partir do modelo de domínio: ele devolve o
 * `class.legacyPresentation`, que é uma cópia byte a byte do arquivo legado
 * `dados/classes/<slug>.json` gravada pelo conversor
 * (`scripts/content/migrate-classes.mjs`).
 *
 * Por quê: os consumidores reais de `getClasse()` hoje (`site/js/pages/sheet.js`
 * e `site/js/pages/creator.js`, além de `levelup*.js`) esperam a forma legada
 * inteira — `tabela_caracteristicas`, `texto_completo`, `tracos_basicos`,
 * `caracteristicas` na ordem do markdown, `lista_magias`, e as tabelas
 * específicas de classe. Reescrevê-los é o escopo das Tasks 25-32; migrá-los
 * agora seria trabalho descartável (foi exatamente o que a Task 23 descobriu).
 * Sem este bloco, `getClasse` continuaria bloqueando o cutover de `db.js`.
 *
 * O que NÃO fazer: reconciliar semanticamente qualquer campo daqui com as
 * entidades `feature`/`subclass`. A cópia é intencionalmente literal, defeitos
 * do legado inclusive. Código NOVO deve usar as entidades `feature`/`subclass`
 * e as consultas de `site/js/domain/progression/progression-queries.js`.
 *
 * Remover este ramo (e o campo `legacyPresentation` do schema/conversor)
 * quando as Tasks 25-32 eliminarem os consumidores legados.
 * @param {ReadonlyArray<*>} entities
 * @returns {object | null}
 */
function projetarClasse(entities) {
  const classe = ofType(entities, 'class')[0];
  if (classe === undefined) {
    return null;
  }
  const apresentacao = classe.legacyPresentation;
  if (apresentacao === null || typeof apresentacao !== 'object') {
    // Falha explícita em vez de devolver uma forma parcial: um consumidor
    // legado que receba `getClasse()` sem `tabela_caracteristicas` calcularia
    // progressão errada em silêncio.
    throw new TypeError(
      `projetarClasse: a classe "${String(classe.id)}" não traz "legacyPresentation". ` +
        'Rode `node scripts/content/migrate-classes.mjs --write` para regenerar o pacote.',
    );
  }
  return structuredClone(apresentacao);
}

// Despacho: operação -> projetor puro.
const PROJECTORS = Object.freeze({
  getClasse: projetarClasse,
  getMagiasClasse: projetarMagiasClasse,
  getAntecedentes: projetarAntecedentes,
  getEspecies: projetarEspecies,
  getTalentos: projetarTalentos,
  getArmas: projetarArmas,
  getArmaduras: projetarArmaduras,
  getEquipamentoAventura: projetarEquipamentoAventura,
  getFerramentas: projetarFerramentas,
  getIndiceMagias: projetarIndiceMagias,
  getMagiasPorCirculo: projetarMagiasPorCirculo,
  getMagiasPorClasseLista: projetarMagiasPorClasseLista,
  getMagia: projetarMagia,
  buscarMagias: projetarBuscaMagias,
  getCriaturas: projetarCriaturas,
  getGlossario: projetarGlossario,
  precarregarDadosCriacao: () => undefined,
});

/**
 * Projeta o resultado de uma operação legada a partir das entidades do
 * catálogo. Função pura: não muta `entities` e não faz I/O.
 * @param {string} operation - nome de um export de `site/js/db.js`.
 * @param {ReadonlyArray<*>} entities
 * @returns {*}
 */
export function projectLegacyDbResult(operation, entities) {
  const projetor = PROJECTORS[operation];
  if (typeof projetor !== 'function' || !Object.prototype.hasOwnProperty.call(PROJECTORS, operation)) {
    throw new TypeError(`projectLegacyDbResult: operação legada desconhecida "${String(operation)}".`);
  }
  return projetor(entities);
}

// --- Fachada sobre o catálogo ativo ---------------------------------------

/**
 * Cria a fachada com os mesmos nomes, assinaturas e semântica de null/array
 * dos exports de `site/js/db.js`, alimentada pelo `ContentRegistry` ativo.
 *
 * @param {{registry: object}} params
 * @returns {Readonly<object>}
 */
export function createLegacyDbProjection({ registry } = {}) {
  if (registry === null || typeof registry !== 'object' || typeof registry.list !== 'function') {
    throw new TypeError('createLegacyDbProjection: "registry" deve ser um ContentRegistry ativo.');
  }

  /**
   * Entidades do ruleset usadas como alvo de referência (nomes de atributo,
   * perícia, tipo de dano, idioma) em várias projeções.
   * @returns {Array<object>}
   */
  function referenciasDeRuleset() {
    return [
      ...registry.list('ability'),
      ...registry.list('skill'),
      ...registry.list('damage-type'),
      ...registry.list('language'),
      ...registry.list('condition'),
    ];
  }

  /**
   * Devolve as magias de uma lista de magias (`spell-list`), na ordem
   * declarada pela lista.
   * @param {string} listaId
   * @returns {Array<object> | null}
   */
  function magiasDaLista(listaId) {
    const lista = registry.get(listaId);
    if (lista === null) {
      return null;
    }
    const magias = [];
    for (const referencia of Array.isArray(lista.spells) ? lista.spells : []) {
      const magia = registry.get(referencia);
      if (magia !== null) {
        magias.push(magia);
      }
    }
    return magias;
  }

  /** Todas as classes ativas (alvo das referências `spell.classes`). */
  const classes = () => registry.list('class');

  /**
   * Carrega dados de uma classe específica.
   * @param {string} nome
   * @returns {Promise<object | null>}
   */
  async function getClasse(nome) {
    const classe = registry.get(`dnd2024:class:${legacyNameToSlug(nome)}`);
    if (classe === null) {
      return null;
    }
    // Só a entidade `class` é necessária: `projetarClasse` devolve o bloco
    // `legacyPresentation` (dívida temporária da Task 23b, ver lá).
    return projectLegacyDbResult('getClasse', [classe]);
  }

  /**
   * Carrega lista de magias de uma classe conjuradora.
   * @param {string} nomeClasse
   * @returns {Promise<object | null>}
   */
  async function getMagiasClasse(nomeClasse) {
    const slug = legacyNameToSlug(nomeClasse);
    const classe = registry.get(`dnd2024:class:${slug}`);
    const magias = magiasDaLista(`dnd2024:spell-list:${slug}`);
    if (classe === null || magias === null) {
      return null;
    }
    return projectLegacyDbResult('getMagiasClasse', [classe, ...magias]);
  }

  /**
   * Carrega todos os antecedentes.
   * @returns {Promise<object>}
   */
  async function getAntecedentes() {
    return projectLegacyDbResult('getAntecedentes', [...registry.list('background'), ...referenciasDeRuleset()]);
  }

  /**
   * Carrega todas as espécies.
   * @returns {Promise<object>}
   */
  async function getEspecies() {
    return projectLegacyDbResult('getEspecies', [...registry.list('species'), ...referenciasDeRuleset()]);
  }

  /**
   * Carrega todos os talentos.
   * @returns {Promise<object>}
   */
  async function getTalentos() {
    return projectLegacyDbResult('getTalentos', [...registry.list('feat'), ...referenciasDeRuleset()]);
  }

  /**
   * Carrega armas.
   * @returns {Promise<object>}
   */
  async function getArmas() {
    // O glossário de propriedades de arma mora em `ruleset.tables`, por valer
    // para todas as armas em vez de para uma (Task 23b).
    return projectLegacyDbResult('getArmas', [
      ...registry.list('weapon'),
      ...registry.list('ruleset'),
      ...referenciasDeRuleset(),
    ]);
  }

  /**
   * Carrega armaduras.
   * @returns {Promise<object>}
   */
  async function getArmaduras() {
    return projectLegacyDbResult('getArmaduras', registry.list('armor'));
  }

  /**
   * Carrega equipamento de aventura.
   * @returns {Promise<object>}
   */
  async function getEquipamentoAventura() {
    return projectLegacyDbResult('getEquipamentoAventura', registry.list('equipment'));
  }

  /**
   * Carrega ferramentas.
   * @returns {Promise<object>}
   */
  async function getFerramentas() {
    return projectLegacyDbResult('getFerramentas', registry.list('equipment'));
  }

  /**
   * Carrega índice de todas as magias (resumido).
   * @returns {Promise<object | null>}
   */
  async function getIndiceMagias() {
    const magias = magiasDaLista('dnd2024:spell-list:todas');
    if (magias === null) {
      return null;
    }
    return projectLegacyDbResult('getIndiceMagias', [...magias, ...classes()]);
  }

  /**
   * Carrega magias de um círculo específico (com descrição completa).
   * @param {number} circulo
   * @returns {Promise<object | null>}
   */
  async function getMagiasPorCirculo(circulo) {
    if (!Number.isInteger(circulo) || circulo < 0 || circulo > 9) {
      return null;
    }
    const magias = registry.list('spell').filter((magia) => magia.level === circulo);
    if (magias.length === 0) {
      return null;
    }
    return projectLegacyDbResult('getMagiasPorCirculo', [...magias, ...classes()]);
  }

  /**
   * Carrega magias de uma classe (lista resumida).
   * @param {string} nomeClasse
   * @returns {Promise<object | null>}
   */
  async function getMagiasPorClasseLista(nomeClasse) {
    const slug = legacyNameToSlug(nomeClasse);
    const classe = registry.get(`dnd2024:class:${slug}`);
    const magias = magiasDaLista(`dnd2024:spell-list:${slug}`);
    if (classe === null || magias === null) {
      return null;
    }
    return projectLegacyDbResult('getMagiasPorClasseLista', [classe, ...magias]);
  }

  /**
   * Busca uma magia específica pelo nome e círculo.
   * @param {string} nome
   * @param {number} circulo
   * @returns {Promise<object | null>}
   */
  async function getMagia(nome, circulo) {
    const magia = registry
      .list('spell')
      .find((candidata) => candidata.name === nome && candidata.level === circulo);
    if (magia === undefined) {
      return null;
    }
    return projectLegacyDbResult('getMagia', [magia, ...classes()]);
  }

  /**
   * Busca magias por nome, sem sensibilidade a acento ou caixa.
   * @param {string} termo
   * @returns {Promise<Array<object>>}
   */
  async function buscarMagias(termo) {
    const magias = magiasDaLista('dnd2024:spell-list:todas');
    if (magias === null) {
      return [];
    }
    const termoNorm = normalizarBusca(termo);
    const encontradas = magias.filter((magia) => normalizarBusca(magia.name).includes(termoNorm));
    return projectLegacyDbResult('buscarMagias', [...encontradas, ...classes()]);
  }

  /**
   * Carrega criaturas.
   * @returns {Promise<object>}
   */
  async function getCriaturas() {
    return projectLegacyDbResult('getCriaturas', registry.list('creature'));
  }

  /**
   * Carrega glossário.
   * @returns {Promise<object>}
   */
  async function getGlossario() {
    return projectLegacyDbResult('getGlossario', registry.list('glossary-entry'));
  }

  /**
   * Pré-carrega dados essenciais para criação de personagem. Com o catálogo já
   * ativo em memória, isto é apenas a garantia de que as projeções usadas na
   * criação são calculáveis.
   * @returns {Promise<void>}
   */
  async function precarregarDadosCriacao() {
    await Promise.all([
      getAntecedentes(),
      getEspecies(),
      getTalentos(),
      getArmas(),
      getArmaduras(),
      getIndiceMagias(),
    ]);
  }

  return Object.freeze({
    getClasse,
    getMagiasClasse,
    getAntecedentes,
    getEspecies,
    getTalentos,
    getArmas,
    getArmaduras,
    getEquipamentoAventura,
    getFerramentas,
    getIndiceMagias,
    getMagiasPorCirculo,
    getMagiasPorClasseLista,
    getMagia,
    buscarMagias,
    getCriaturas,
    getGlossario,
    precarregarDadosCriacao,
  });
}

/**
 * Normaliza um termo de busca do mesmo modo que `db.js.buscarMagias`
 * (minúsculas, sem diacríticos).
 * @param {*} termo
 * @returns {string}
 */
function normalizarBusca(termo) {
  return String(termo ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Lacunas conhecidas da projeção, por operação: mapa de caminho de campo (com
 * índices de array normalizados para `[]`) para a QUANTIDADE EXATA de
 * instâncias divergentes, com o motivo em comentário.
 *
 * A quantidade não é decoração: sem ela, uma lacuna declarada para um caso
 * isolado (o typo do legado em 1 de 38 armas) seria uma licença aberta para
 * qualquer número de divergências futuras no mesmo campo, e o teste ficaria
 * verde mesmo se o campo quebrasse em todas as instâncias. Aumentar,
 * diminuir ou remover uma lacuna reprova o contrato.
 *
 * Cada entrada é uma dívida explícita: um dado que o legado tem e o catálogo
 * ainda não, a ser paga por enriquecimento do catálogo (campos de apresentação
 * na migração) ou por migração do consumidor — nunca por parsing de prosa
 * dentro desta camada. Lacuna em operação que o runtime público chama BLOQUEIA
 * o cutover de `db.js` (ver `legacyProjectionCutoverReadiness`).
 *
 * NÃO confundir com `LEGACY_INTENTIONAL_DIVERGENCES`, logo abaixo: lá estão os
 * casos em que a projeção difere de `db.js` porque o LEGADO está errado. Esses
 * não são dívida e não bloqueiam nada.
 *
 * Estado após a Task 23b: das 10 operações de
 * `PUBLIC_RUNTIME_LEGACY_OPERATIONS`, nenhuma tem lacuna. Sobram apenas
 * `getCriaturas` e `getFerramentas`, que nenhum módulo de `site/js/**` chama.
 *
 * A lista é preenchida a partir do diff REAL medido em
 * `tests/contract/legacy-db-projection.test.js`.
 * @type {Readonly<Record<string, Readonly<Record<string, number>>>>}
 */
export const LEGACY_PROJECTION_GAPS = Object.freeze({
  // A migração da Task 10 guardou a ficha da criatura como markdown em
  // `description` (projetado verbatim em `texto_completo`) e estruturou apenas
  // tamanho/tipo/ND/CA/PV. Os 11 campos restantes eram recortes daquele
  // markdown, nas 51 criaturas. `getCriaturas` NÃO é chamada por nenhum módulo
  // de `site/js/**` hoje, por isso não bloqueia o cutover.
  getCriaturas: Object.freeze({
    'criaturas[].acoes (ausente na projeção)': 51,
    'criaturas[].atributos (ausente na projeção)': 51,
    'criaturas[].deslocamento (ausente na projeção)': 51,
    'criaturas[].idiomas (ausente na projeção)': 51,
    'criaturas[].iniciativa (ausente na projeção)': 51,
    'criaturas[].nd (ausente na projeção)': 51,
    'criaturas[].pericias (ausente na projeção)': 51,
    'criaturas[].pv (ausente na projeção)': 51,
    'criaturas[].sentidos (ausente na projeção)': 51,
    'criaturas[].tipo_tamanho (ausente na projeção)': 51,
    'criaturas[].tracos (ausente na projeção)': 51,
  }),
  // O arquivo legado é só prosa (`tabelas` já vinha vazio, e a projeção é um
  // STUB — ver projetarFerramentas); o markdown do capítulo não foi migrado.
  // `getFerramentas` também não é chamada por nenhum módulo hoje.
  getFerramentas: Object.freeze({
    'texto_completo (ausente na projeção)': 1,
  }),
});

/**
 * DIVERGÊNCIAS DELIBERADAS: casos em que a projeção NÃO reproduz `db.js`
 * porque o legado está errado e o catálogo está certo.
 *
 * Mesma forma de `LEGACY_PROJECTION_GAPS` (caminho -> quantidade EXATA de
 * instâncias) e conferida pelo mesmo teste, mas com significado oposto: uma
 * lacuna é dívida a pagar e BLOQUEIA o cutover; uma divergência deliberada é
 * uma correção já feita, com fonte citada, e não bloqueia. Separar as duas
 * listas é o que impede que "o catálogo corrigiu um typo" e "o catálogo ainda
 * não tem esse dado" fiquem indistinguíveis atrás de um número.
 *
 * Regra para acrescentar uma entrada aqui: precisa de (a) a fonte legada
 * exata, (b) por que o legado está errado, (c) contagem exata, (d) um teste
 * nomeado em `tests/contract/legacy-db-projection.test.js`. Sem os quatro, é
 * lacuna, não divergência.
 * @type {Readonly<Record<string, Readonly<Record<string, number>>>>}
 */
export const LEGACY_INTENTIONAL_DIVERGENCES = Object.freeze({
  // Dois typos de transcrição em `dados/equipamento/armas.json`, ambos uma
  // vírgula sobrando no fim da célula, que o legado exibe literalmente:
  //   - `armas[17].dano` (Espada Curta): "1d6 Perfurante," -> "1d6 Perfurante"
  //   - `armas[12].propriedades` (Dardo): "..., Arremesso (Alcance 6/18)," ->
  //     sem a vírgula final.
  // Corrigidos no conversor (migrate-spells-equipment.mjs#
  // removerVirgulaSobrandoDoLegado). 1 instância cada: o catálogo não pode
  // ganhar licença para divergir no dano das outras 37 armas.
  getArmas: Object.freeze({
    'armas[].dano': 1,
    'armas[].propriedades': 1,
  }),
  // `dados/equipamento/armaduras.json` alterna a caixa da mesma expressão na
  // coluna `ca`. Das 13 armaduras, 8 citam o modificador de Destreza: 5
  // escrevem "modificador de Des" e 3 escrevem "Modificador de Des" (as
  // outras 5 — Cota de Anéis, Cota de Malha, Armadura de Talas, Placas e
  // Escudo — têm CA fixa e não mencionam Des). É inconsistência de
  // transcrição, não conteúdo — a caixa não corresponde a nada estruturado. A
  // projeção emite sempre a forma minúscula (majoritária entre as 8),
  // divergindo nas 3.
  getArmaduras: Object.freeze({
    'armaduras[].ca': 3,
  }),
  // Três famílias de erro do legado, todas na tabela de lista de magias por
  // classe (`dados/classes/magias_*.json`):
  //
  // 1. CÍRCULO ERRADO (druida). "De Carne para Pedra" é magia de 6º Círculo
  //    no verbete canônico (`dados/magias/circulo_6.json`) e no Livro do
  //    Jogador 2024; `magias_druida.json` e `dados/magias/por_classe/druida.json`
  //    a listam no 5º. O catálogo mantém o 6º. Como a comparação é POSICIONAL,
  //    tirar um item do 5º e pôr no 6º desloca as duas listas: daí as contagens
  //    de `5º Círculo`/`6º Círculo` em nome/escola/especial, além do `.length`
  //    e do elemento ausente/extra. Foi a única discordância de círculo entre
  //    as três fontes legadas em 391 magias.
  //
  // 2. ORDEM (paladino). Das 70 listas de círculo do legado, 69 estão em ordem
  //    alfabética (ignorando diacríticos) e só `magias_paladino.json`
  //    "2º Círculo" não está — mesmos 11 nomes, ordem manual. A projeção emite
  //    a ordem consistente; daí `2º Círculo` em nome/escola/especial.
  //
  // 3. COLUNA `especial` INCONSISTENTE ENTRE CLASSES. Sete magias recebem
  //    marcas diferentes em tabelas de classes diferentes; o catálogo resolve
  //    cada caso pelo verbete canônico da magia (duração para "C", tempo de
  //    conjuração para "R", componente material com custo/consumo para "M"),
  //    nunca por maioria automática — ver M_INCONSISTENTE_NO_LEGADO em
  //    scripts/content/migrate-spells-equipment.mjs. As instâncias isoladas
  //    são: Truques/bardo (Golpe Certeiro, falta "M"), 3º/mago (Piscar, "C"
  //    indevido — duração "1 minuto"), 9º/clérigo (Projeção Astral, "C" em vez
  //    de "M"), e quatro do feiticeiro (Criação, Mover Terra, Praga de
  //    Insetos, Sugestão em Massa) que caem em 5º/6º Círculo.
  getMagiasClasse: Object.freeze({
    'lista_magias.2º Círculo[].escola': 7,
    'lista_magias.2º Círculo[].especial': 4,
    'lista_magias.2º Círculo[].nome': 8,
    'lista_magias.3º Círculo[].especial': 1,
    'lista_magias.5º Círculo.length': 1,
    'lista_magias.5º Círculo[] (elemento ausente na projeção)': 1,
    'lista_magias.5º Círculo[].escola': 11,
    'lista_magias.5º Círculo[].especial': 11,
    'lista_magias.5º Círculo[].nome': 13,
    'lista_magias.6º Círculo.length': 1,
    'lista_magias.6º Círculo[] (elemento extra na projeção)': 1,
    'lista_magias.6º Círculo[].escola': 6,
    'lista_magias.6º Círculo[].especial': 5,
    'lista_magias.6º Círculo[].nome': 6,
    'lista_magias.9º Círculo[].especial': 1,
    'lista_magias.Truques[].especial': 1,
  }),
  // Mesma magia do item 1 acima, vista pela outra lista legada:
  // `dados/magias/por_classe/druida.json` diz 5º, o catálogo diz 6º.
  getMagiasPorClasseLista: Object.freeze({
    'magias[].circulo': 1,
  }),
});


/**
 * Operações que o runtime público REALMENTE chama hoje. Levantado por
 * varredura dos imports de `site/js/db.js` em `site/js/**`:
 *
 *   levelup-cards.js  : getMagiasClasse, getMagiasPorCirculo
 *   levelup-flow.js   : getClasse, getMagiasClasse, getMagiasPorCirculo
 *   levelup-ui.js     : getMagiasPorCirculo, getMagiasClasse
 *   levelup.js        : getClasse, getEspecies, getIndiceMagias, getTalentos
 *   pages/creator.js  : getClasse, getAntecedentes, getEspecies, getTalentos,
 *                       getMagiasClasse, getIndiceMagias, getArmas,
 *                       getArmaduras, getEquipamentoAventura
 *   pages/sheet.js    : getClasse, getMagiasClasse, getMagiasPorCirculo,
 *                       getIndiceMagias, getArmas, getArmaduras,
 *                       getEquipamentoAventura, getTalentos, getEspecies
 *
 * Os outros sete exports de `db.js` (`getMagiasPorClasseLista`, `getMagia`,
 * `buscarMagias`, `getCriaturas`, `getGlossario`, `getFerramentas`,
 * `precarregarDadosCriacao`) não são chamados por nenhum módulo hoje.
 * @type {ReadonlyArray<string>}
 */
export const PUBLIC_RUNTIME_LEGACY_OPERATIONS = Object.freeze([
  'getClasse',
  'getMagiasClasse',
  'getMagiasPorCirculo',
  'getAntecedentes',
  'getEspecies',
  'getTalentos',
  'getIndiceMagias',
  'getArmas',
  'getArmaduras',
  'getEquipamentoAventura',
]);

/**
 * GUARDA DE CUTOVER (Task 22b).
 *
 * Diz se esta projeção já pode SUBSTITUIR `site/js/db.js` como caminho de
 * leitura do runtime público. Desde a Task 23b devolve `ready: true`.
 *
 * Por que isto existe: a suíte inteira verde NÃO significa que a projeção está
 * completa — significa que as lacunas conhecidas estão exatamente onde foram
 * declaradas. A Global Constraint do plano ("em tarefas de risco alto, os
 * testes de compatibilidade relacionados devem estar verdes antes da remoção
 * de código ou dados legados") poderia ser lida como licença para o cutover;
 * esta função existe para que a Task 22b tenha de encarar a lista de bloqueios
 * em vez de inferir permissão do verde.
 *
 * O que mudou na Task 23b: as 8 operações que ainda tinham lacuna foram
 * fechadas por enriquecimento do catálogo — estruturado onde o dado é
 * estruturado (`weapon.rangeCategory`/`range`/`ammunitionType`,
 * `equipment.ammunition`, `spell.components.materialCostOrConsumed`,
 * `ruleset.tables.weaponProperties`, perícias/idiomas/equipamento de
 * antecedente derivados dos efeitos) e por bloco `legacyPresentation` verbatim
 * onde ele é apresentação que o catálogo não modela (classe, espécie, talento
 * e dois campos de antecedente). O bloco de classe é DÍVIDA TEMPORÁRIA
 * declarada: some quando as Tasks 25-32 reescreverem `sheet.js`/`creator.js`.
 *
 * O que `ready: true` NÃO promete: paridade byte a byte com `db.js`. As
 * divergências deliberadas de `LEGACY_INTENTIONAL_DIVERGENCES` continuam de
 * pé, e o cutover as torna visíveis ao usuário (ordem da lista de magias de
 * 2º Círculo do Paladino, "De Carne para Pedra" no 6º Círculo do Druida,
 * caixa de "modificador de Des", dois typos de tabela de arma, sete marcas da
 * coluna `especial`). São correções, não regressões — mas são mudanças de
 * comportamento e estão listadas aqui de propósito.
 *
 * @returns {{ready: boolean, blocking: ReadonlyArray<{operation: string, gaps: ReadonlyArray<string>}>, intentionalDivergences: ReadonlyArray<{operation: string, paths: ReadonlyArray<string>}>}}
 */
export function legacyProjectionCutoverReadiness() {
  const blocking = [];
  const intentionalDivergences = [];
  for (const operation of PUBLIC_RUNTIME_LEGACY_OPERATIONS) {
    const gaps = Object.keys(LEGACY_PROJECTION_GAPS[operation] ?? {});
    if (gaps.length > 0) {
      blocking.push(Object.freeze({ operation, gaps: Object.freeze(gaps) }));
    }
    // Divergência deliberada não bloqueia, mas também não some do relatório:
    // quem fizer o cutover precisa saber o que muda na tela.
    const paths = Object.keys(LEGACY_INTENTIONAL_DIVERGENCES[operation] ?? {});
    if (paths.length > 0) {
      intentionalDivergences.push(Object.freeze({ operation, paths: Object.freeze(paths) }));
    }
  }
  return Object.freeze({
    ready: blocking.length === 0,
    blocking: Object.freeze(blocking),
    intentionalDivergences: Object.freeze(intentionalDivergences),
  });
}

/**
 * Versão que LANÇA quando o cutover não é seguro. Pensada para ser chamada
 * pela Task 22 antes de trocar o caminho de leitura do runtime público: assim
 * a troca falha alto, em vez de silenciosamente servir dados incompletos.
 * @returns {void}
 */
export function assertLegacyProjectionReadyForCutover() {
  const { ready, blocking } = legacyProjectionCutoverReadiness();
  if (ready) {
    return;
  }
  const detalhe = blocking
    .map((item) => `${item.operation}: ${item.gaps.join(', ')}`)
    .join(' | ');
  throw new Error(
    'assertLegacyProjectionReadyForCutover: a projeção legada ainda tem lacunas nas operações que o ' +
      `runtime público chama, então o cutover da Task 22b não pode prosseguir. Bloqueios -> ${detalhe}. ` +
      'Feche a lacuna enriquecendo o catálogo pelo conversor correspondente em scripts/content/ ' +
      '(nunca editando dados/pacotes/dnd2024/** à mão) ou migrando o consumidor.',
  );
}
