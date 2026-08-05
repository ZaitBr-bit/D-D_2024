// ============================================================
// Utilitários de cálculo D&D 5.5 e helpers gerais
// ============================================================
import { ATRIBUTOS_KEYS, ATRIBUTO_NOME_PARA_KEY, PERICIAS, CLASSES_INFO } from './dados-classes.js';
import { appContext } from './app-context.js';
import { escapeHtml } from './ui/html.js';
import { renderSafeMarkdownToHtml } from './ui/markdown.js';
import { createModalService } from './ui/modal.js';
import { createToastService } from './ui/toast.js';
import { createLegacyAliasResolver } from './infra/character/legacy-alias-resolver.js';
import { projectLegacyCharacterForQueries } from './infra/character/legacy-query-adapter.js';
import { getArmorClass, getDefenses, getSkillProjection } from './domain/character/queries/index.js';
import { resolveCarryingCapacityMultiplier } from './domain/character/queries/movement.js';

// --- Cálculos D&D ---
//
// TASK 16 (fix round 1, achado C1): as funções desta seção agora DELEGAM
// para as consultas puras de `site/js/domain/character/queries/*` sempre
// que o catálogo de conteúdo já foi inicializado (`appContext`) e o
// personagem em memória decodifica com sucesso via
// `infra/character/legacy-query-adapter.js`. Cada função mantém a MESMA
// assinatura pública (criador/ficha/impressão/PDF continuam chamando-as sem
// mudança) e um fallback mínimo de UMA linha — nunca uma segunda cópia do
// motor de cálculo — para os dois casos em que a delegação não está
// disponível: (a) o catálogo ainda não foi inicializado (cedo demais no
// boot), ou (b) o registro específico não decodifica (ex.: subclasse sem
// alias exato no pacote atual). Ajustes que a consulta de domínio ainda não
// reproduz (efeitos mágicos temporários sobre CA/perícia, CD de magia do
// Feiticeiro com Feitiçaria Inata, bônus da Ordem Divina/Ordem Primal, troca
// de atributo por Força Primordial do Bárbaro) continuam aplicados aqui como
// ajustes residuais explícitos — ver relatório da Task 16 (fix round 1) para
// o inventário completo desses gaps herdados/não migrados.

const ALIAS_ENTITY_ID = 'dnd2024:migration-map:character-v1-aliases';
/** @type {object | null} */
let _cachedAliasResolver = null;
/** @type {object | null | undefined} */
let _legacyQueryContextOverrideForTests = undefined;

/**
 * Resolve `{aliasResolver, registry, now}` para a camada de adaptação desta
 * seção delegar às consultas de domínio. Devolve `null` quando o catálogo de
 * conteúdo ainda não foi inicializado (`appContext.initializeContent()`
 * ainda não resolveu) ou quando a entidade de aliases legados não está
 * carregada — quem chama trata isso caindo no fallback mínimo, nunca
 * reimplementando o cálculo inteiro.
 * @returns {{aliasResolver: object, registry: object, now: string} | null}
 */
function resolveLegacyQueryContext() {
  if (_legacyQueryContextOverrideForTests !== undefined) {
    return _legacyQueryContextOverrideForTests;
  }
  const registry = typeof appContext?.getContentRegistry === 'function' ? appContext.getContentRegistry() : null;
  if (!registry) {
    return null;
  }
  if (!_cachedAliasResolver) {
    const aliasEntity = registry.get(ALIAS_ENTITY_ID);
    if (!aliasEntity) {
      return null;
    }
    try {
      _cachedAliasResolver = createLegacyAliasResolver(aliasEntity);
    } catch {
      return null;
    }
  }
  return { aliasResolver: _cachedAliasResolver, registry, now: new Date().toISOString() };
}

/**
 * Uso exclusivo de teste: injeta (ou limpa, passando `undefined`) um
 * `context` fixo para `resolveLegacyQueryContext()`, evitando depender do
 * boot real de `appContext`/Firebase em ambiente Node. Nunca chamado por
 * código de produção.
 * @param {{aliasResolver: object, registry: object, now: string} | null | undefined} override
 */
export function _setLegacyQueryContextOverrideForTests(override) {
  _legacyQueryContextOverrideForTests = override;
}

/**
 * Mapeia a saída de `resolverPassivosTalentos` (site/js/talentos-effects.js
 * — ÚNICA fonte de verdade de quais talentos concedem o quê) para o
 * vocabulário fechado `context.talentPassives` que as consultas de domínio
 * entendem (fix round 1, C2). Só reformata números já calculados; nunca
 * decide sozinha se um talento concede ou não um bônus.
 * @param {object | null} passivos
 * @returns {object | undefined}
 */
function mapTalentPassivesForQueries(passivos) {
  if (!passivos || typeof passivos !== 'object') {
    return undefined;
  }
  return {
    armorClassBonus: passivos.bonusCA || 0,
    mediumArmorMaxDexBonus: typeof passivos.bonusCAArmaduraMediaMaxDes === 'number' ? passivos.bonusCAArmaduraMediaMaxDes : null,
    initiativeBonus: passivos.bonusIniciativa || 0,
    speedBonus: passivos.bonusDeslocamento || 0,
  };
}

// Perícia (nome de exibição em português) -> ContentId do ruleset dnd2024,
// usado só para que esta camada de adaptação saiba QUAL consulta delegada
// chamar — nunca um lookup textual usado para decidir REGRAS de jogo (essas
// já são decididas dentro de `domain/character/queries/*` por ID estável).
const PERICIA_NOME_PARA_SKILL_ID = Object.freeze({
  'Acrobacia': 'dnd2024:skill:acrobacia',
  'Lidar com Animais': 'dnd2024:skill:lidar-com-animais',
  'Arcanismo': 'dnd2024:skill:arcanismo',
  'Atletismo': 'dnd2024:skill:atletismo',
  'Atuação': 'dnd2024:skill:atuacao',
  'Enganação': 'dnd2024:skill:enganacao',
  'Furtividade': 'dnd2024:skill:furtividade',
  'História': 'dnd2024:skill:historia',
  'Intimidação': 'dnd2024:skill:intimidacao',
  'Intuição': 'dnd2024:skill:intuicao',
  'Investigação': 'dnd2024:skill:investigacao',
  'Medicina': 'dnd2024:skill:medicina',
  'Natureza': 'dnd2024:skill:natureza',
  'Percepção': 'dnd2024:skill:percepcao',
  'Persuasão': 'dnd2024:skill:persuasao',
  'Prestidigitação': 'dnd2024:skill:prestidigitacao',
  'Religião': 'dnd2024:skill:religiao',
  'Sobrevivência': 'dnd2024:skill:sobrevivencia',
});

/** Calcula modificador de atributo */
export function calcMod(valor) {
  return Math.floor((valor - 10) / 2);
}

/** Formata modificador com sinal (+/-) */
export function fmtMod(mod) {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

/** Bônus de proficiência por nível do personagem */
export function bonusProficiencia(nivel) {
  return Math.ceil(nivel / 4) + 1;
}

/** Calcula PV máximo no nível 1 */
export function calcPVNivel1(dadoVida, modCon) {
  return dadoVida + modCon;
}

/** Calcula PV máximo total (nível 1 + subida simples) */
export function calcPVTotal(dadoVida, nivel, modCon) {
  // Nível 1: dado de vida máximo + mod CON
  // Níveis subsequentes: média do dado + mod CON por nível
  const mediaSubida = Math.floor(dadoVida / 2) + 1;
  return dadoVida + modCon + (nivel - 1) * (mediaSubida + modCon);
}

/**
 * Verifica se uma magia registrada pelo nome pertence ao grimório do mago.
 * @param {object} personagem
 * @param {string} nome
 * @returns {boolean}
 */
export function magiaMagoEstaNoGrimorio(personagem, nome) {
  if (personagem?.classe !== 'Mago' || typeof nome !== 'string') return false;
  return Array.isArray(personagem.grimorio) && personagem.grimorio.some(m => m?.nome === nome);
}

/**
 * Retorna o conjunto de nomes de magias de 1º círculo que o personagem já
 * conhece por qualquer fonte: magias atualmente preparadas, magias conhecidas
 * de conjuradores espontâneos, e — para o Mago — todo o grimório (não apenas
 * as magias preparadas no momento).
 * @param {object} personagem
 * @returns {Set<string>}
 */
export function nomesMagiaCirculo1Conhecidas(personagem) {
  const nomes = new Set([
    ...(personagem?.magias_preparadas || []).filter(m => Number(m?.circulo) === 1).map(m => m.nome),
    ...(personagem?.magias_conhecidas || []).filter(m => Number(m?.circulo) === 1).map(m => m.nome)
  ]);
  if (personagem?.classe === 'Mago') {
    (personagem.grimorio || []).forEach(m => {
      if (Number(m?.circulo) === 1 && typeof m.nome === 'string') nomes.add(m.nome);
    });
  }
  return nomes;
}

/**
 * Normaliza o grimório de personagens Magos legados sem inventar magias.
 * Magias preparadas normais de 1º círculo ou superior também devem constar
 * no grimório; magias concedidas por outra origem não contam para essa regra.
 *
 * @param {object} personagem
 * @param {number} [limitePreparadas]
 * @returns {{alterado: boolean, pendentes: number}}
 */
export function normalizarGrimorioMago(personagem, limitePreparadas) {
  if (!personagem || typeof personagem !== 'object' || personagem.classe !== 'Mago') {
    return { alterado: false, pendentes: 0 };
  }

  let alterado = false;
  if (!Array.isArray(personagem.grimorio)) {
    // Formatos legados malformados ainda podem conter dados. Encapsulá-los
    // preserva a entrada e permite que a migração siga sem apagá-la.
    personagem.grimorio = personagem.grimorio == null ? [] : [personagem.grimorio];
    alterado = true;
  }

  const indicesPorNome = new Map();
  const grimorioNormalizado = [];
  for (const magia of personagem.grimorio) {
    const nome = magia?.nome;
    if (typeof nome !== 'string' || !nome) {
      grimorioNormalizado.push(magia);
      continue;
    }

    const indiceExistente = indicesPorNome.get(nome);
    if (indiceExistente == null) {
      indicesPorNome.set(nome, grimorioNormalizado.length);
      grimorioNormalizado.push(magia);
      continue;
    }

    // Em duplicatas legadas, manter a entrada com o menor círculo numérico
    // confiável e preservar todos os demais dados dessa entrada.
    const existente = grimorioNormalizado[indiceExistente];
    const valorCirculoExistente = existente?.circulo;
    const valorCirculoAtual = magia?.circulo;
    const existenteConfiavel = (typeof valorCirculoExistente === 'number' && Number.isFinite(valorCirculoExistente)) ||
      (typeof valorCirculoExistente === 'string' && valorCirculoExistente.trim() !== '' && Number.isFinite(Number(valorCirculoExistente)));
    const atualConfiavel = (typeof valorCirculoAtual === 'number' && Number.isFinite(valorCirculoAtual)) ||
      (typeof valorCirculoAtual === 'string' && valorCirculoAtual.trim() !== '' && Number.isFinite(Number(valorCirculoAtual)));
    const circuloExistente = Number(valorCirculoExistente);
    const circuloAtual = Number(valorCirculoAtual);
    if (atualConfiavel && (!existenteConfiavel || circuloAtual < circuloExistente)) {
      grimorioNormalizado[indiceExistente] = magia;
    }
    alterado = true;
  }
  if (grimorioNormalizado.length !== personagem.grimorio.length) {
    personagem.grimorio = grimorioNormalizado;
  }

  const origensEspeciais = ['dominio', 'sempre', 'especie_legado', 'iniciado_em_magia', 'tocado_por_fadas', 'tocado_pelas_sombras', 'conjurador_ritualista'];
  const preparadasNormais = (Array.isArray(personagem.magias_preparadas) ? personagem.magias_preparadas : [])
    .filter(magia => magia && typeof magia === 'object' && typeof magia.nome === 'string' && magia.nome && !origensEspeciais.includes(magia.origem) && Number(magia.circulo) > 0);

  for (const magia of preparadasNormais) {
    if (!magiaMagoEstaNoGrimorio(personagem, magia.nome)) {
      personagem.grimorio.push({ ...magia });
      alterado = true;
    }
  }

  const pendentes = typeof limitePreparadas === 'number' && Number.isFinite(limitePreparadas)
    ? Math.max(0, limitePreparadas - preparadasNormais.length)
    : 0;
  return { alterado, pendentes };
}

/**
 * Aplica, por cima de uma CA já calculada, os efeitos mágicos temporários
 * (`efeitos_magicos`) — ainda não modelados no personagem canônico (Task 12
 * não migra esse campo para `state.activeEffects`), por isso continua um
 * ajuste local tanto no caminho delegado quanto no fallback legado completo.
 * @param {object} personagem
 * @param {number} ca
 * @param {number} modDes
 * @returns {number}
 */
function aplicarEfeitosMagicosCA(personagem, ca, modDes) {
  let resultado = ca;
  const efeitos = personagem?.efeitos_magicos || [];
  for (const ef of efeitos) {
    if (ef.tipo_efeito === 'bonus') {
      resultado += ef.valor || 0;
    } else if (ef.tipo_efeito === 'base') {
      // CA base substitui (ex: Armadura Arcana = 13 + Des)
      const caBase = (ef.valor || 13) + modDes;
      if (caBase > resultado) resultado = caBase;
    } else if (ef.tipo_efeito === 'minimo') {
      // CA mínima (ex: Pele-Casca = mín 17)
      if ((ef.valor || 0) > resultado) resultado = ef.valor;
    }
  }
  return resultado;
}

/**
 * Fórmula COMPLETA (não simplificada) de cálculo de CA — a mesma lógica que
 * existia em `calcCA` antes da Task 16, incluindo armadura/escudo/Defesa sem
 * Armadura por classe/Estilo de Luta Defensivo/bônus de CA de itens
 * customizados/efeitos mágicos temporários/bônus genérico de CA de talento.
 * Usada como fallback de `calcCA` sempre que a delegação a
 * `domain/character/queries/combat.js#getArmorClass` não está disponível
 * (fix round 2, achado NEW-1: o fallback anterior, `10 + modDes`, perdia
 * silenciosamente armadura/escudo/talentos sempre que o registro não
 * decodificava — um caso REAL e frequente, não hipotético, ex.: subclasse
 * com nomenclatura antiga sem alias em `character-v1-aliases.json`, como em
 * `tests/fixtures/characters/legacy-all-fields.json`/`legacy-known-casters.json`).
 * @param {object} personagem
 * @param {object | null} passivos
 * @returns {number}
 */
function calcCALegacyFull(personagem, passivos = null) {
  const modDes = calcMod(personagem.atributos.destreza);
  const modCon = calcMod(personagem.atributos.constituicao);
  const modSab = calcMod(personagem.atributos.sabedoria);
  const modCar = calcMod(personagem.atributos.carisma);
  const inv = personagem.inventario || [];

  const armadura = inv.find(i => i.equipado && i.tipo === 'armadura' && i.nome !== 'Escudo');
  const escudo = inv.find(i => i.equipado && (i.nome === 'Escudo' || i.tipo === 'escudo'));

  let ca = 10 + modDes; // Sem armadura

  // Bárbaro: Defesa sem Armadura = 10 + Des + Con
  if (personagem.classe === 'Bárbaro' && !armadura) {
    ca = 10 + modDes + modCon;
  }
  // Monge: Defesa sem Armadura = 10 + Des + Sab
  if (personagem.classe === 'Monge' && !armadura) {
    ca = 10 + modDes + modSab;
  }
  // Bardo (Colégio da Dança): Defesa sem Armadura = 10 + Des + Car
  if (personagem.classe === 'Bardo' && personagem.subclasse === 'Colégio da Dança' && (personagem.nivel || 1) >= 3 && !armadura && !escudo) {
    ca = 10 + modDes + modCar;
  }
  // Feiticeiro (Feitiçaria Dracônica): Resiliência Dracônica = 10 + Des + Car (sem armadura)
  if (
    personagem.classe === 'Feiticeiro' &&
    personagem.subclasse === 'Feitiçaria Dracônica' &&
    (personagem.nivel || 1) >= 3 &&
    !armadura
  ) {
    ca = 10 + modDes + modCar;
  }

  if (armadura) {
    const caStr = armadura.dados?.ca || '';
    const caBase = parseInt(caStr) || 0;

    if (armadura.dados?.categoria === 'Leve') {
      ca = caBase + modDes;
    } else if (armadura.dados?.categoria === 'Média') {
      const maxDes = passivos?.bonusCAArmaduraMediaMaxDes ?? 2;
      ca = caBase + Math.min(modDes, maxDes);
    } else if (armadura.dados?.categoria === 'Pesada') {
      ca = caBase;
    } else {
      // Tentar parsear formato "XX + modificador de Des"
      const match = caStr.match(/^(\d+)/);
      if (match) {
        const base = parseInt(match[1]);
        if (caStr.includes('máx. 2') || caStr.includes('max. 2')) {
          ca = base + Math.min(modDes, 2);
        } else if (caStr.includes('Des')) {
          ca = base + modDes;
        } else {
          ca = base;
        }
      }
    }
  }

  // Escudo: +2
  if (escudo) {
    ca += 2;
  }

  // Estilo de Luta: Defensivo (+1 CA enquanto usa armadura)
  const estiloLuta = personagem.escolhas_classe?.estilo_luta?.[0] || '';
  if (estiloLuta === 'Defensivo' && armadura) {
    ca += 1;
  }

  // Bônus de CA de itens customizados
  inv.filter(i => i.equipado && i.dados?.bonus_ca).forEach(i => {
    ca += parseInt(i.dados.bonus_ca) || 0;
  });

  ca = aplicarEfeitosMagicosCA(personagem, ca, modDes);

  // Bônus genérico de CA de talentos
  ca += passivos?.bonusCA || 0;

  return ca;
}

/**
 * Calcula CA baseado na armadura equipada. DELEGA para
 * `domain/character/queries/combat.js#getArmorClass` (fix round 1, C1)
 * quando o catálogo está pronto e o personagem decodifica; quando a
 * delegação NÃO está disponível (catálogo não inicializado, OU o registro
 * específico não decodifica — ex.: subclasse sem alias exato), o fallback é
 * a fórmula legada COMPLETA (`calcCALegacyFull`), não um valor simplificado
 * (fix round 2, achado NEW-1 — ver comentário de `calcCALegacyFull`). O
 * único ajuste residual aplicado por cima do caminho DELEGADO são os
 * efeitos mágicos temporários (`efeitos_magicos`), ainda não modelados no
 * personagem canônico.
 */
export function calcCA(personagem, passivos = null) {
  const ctx = resolveLegacyQueryContext();
  if (ctx) {
    const projected = projectLegacyCharacterForQueries(personagem, ctx);
    if (projected.ok) {
      const result = getArmorClass(projected.value, {
        registry: ctx.registry,
        talentPassives: mapTalentPassivesForQueries(passivos),
      });
      if (result.ok) {
        const modDes = calcMod(personagem?.atributos?.destreza ?? 10);
        return aplicarEfeitosMagicosCA(personagem, result.value, modDes);
      }
    }
  }
  return calcCALegacyFull(personagem, passivos);
}

/**
 * Calcula CD de magia. DELEGA para
 * `domain/character/queries/defenses.js#getDefenses` (fix round 1, C1); o
 * bônus do Feiticeiro com Feitiçaria Inata ativa continua local (ainda não
 * extraído — ver relatório da Task 16, fix round 1, Minor).
 */
export function calcCDMagia(personagem) {
  let cd;
  const ctx = resolveLegacyQueryContext();
  if (ctx) {
    const projected = projectLegacyCharacterForQueries(personagem, ctx);
    if (projected.ok) {
      const result = getDefenses(projected.value, { registry: ctx.registry });
      if (result.ok) {
        cd = result.value.spellSaveDC ?? 0;
      }
    }
  }
  if (cd === undefined) {
    const info = CLASSES_INFO[personagem.classe];
    if (!info || !info.atributo_conjuracao) return 0;
    const key = ATRIBUTO_NOME_PARA_KEY[info.atributo_conjuracao];
    const modAttr = calcMod(personagem.atributos[key]);
    cd = 8 + bonusProficiencia(personagem.nivel) + modAttr;
  }

  // Feiticeiro: Feitiçaria Inata ativa aumenta CD em +1 (ainda local).
  if (personagem.classe === 'Feiticeiro' && personagem?.recursos?.feiticeiro?.feiticaria_inata_ativa) {
    cd += 1;
  }

  return cd;
}

/**
 * Calcula bônus de ataque de magia. DELEGA para
 * `domain/character/queries/defenses.js#getDefenses` (fix round 1, C1).
 */
export function calcAtaqueMagia(personagem) {
  const ctx = resolveLegacyQueryContext();
  if (ctx) {
    const projected = projectLegacyCharacterForQueries(personagem, ctx);
    if (projected.ok) {
      const result = getDefenses(projected.value, { registry: ctx.registry });
      if (result.ok) {
        return result.value.spellAttackBonus ?? 0;
      }
    }
  }
  const info = CLASSES_INFO[personagem.classe];
  if (!info || !info.atributo_conjuracao) return 0;
  const key = ATRIBUTO_NOME_PARA_KEY[info.atributo_conjuracao];
  const modAttr = calcMod(personagem.atributos[key]);
  return bonusProficiencia(personagem.nivel) + modAttr;
}

/**
 * Calcula Percepção Passiva. DELEGA para
 * `domain/character/queries/skills.js#getSkillProjection` (fix round 1, C1).
 */
export function calcPercepcaoPassiva(personagem) {
  const ctx = resolveLegacyQueryContext();
  if (ctx) {
    const projected = projectLegacyCharacterForQueries(personagem, ctx);
    if (projected.ok) {
      const result = getSkillProjection(projected.value, 'dnd2024:skill:percepcao', { registry: ctx.registry });
      if (result.ok) {
        return result.value.passive;
      }
    }
  }
  const modSab = calcMod(personagem.atributos.sabedoria);
  const prof = (personagem.pericias_proficientes || []).includes('Percepção');
  const exp = (personagem.pericias_expertise || []).includes('Percepção');
  let bonus = modSab;
  if (prof) bonus += bonusProficiencia(personagem.nivel);
  if (exp) bonus += bonusProficiencia(personagem.nivel);
  if (personagem.classe === 'Bardo' && (personagem.nivel || 1) >= 2 && !prof && !exp) {
    bonus += Math.floor(bonusProficiencia(personagem.nivel) / 2);
  }
  return 10 + bonus;
}

/** Calcula Intuicao Passiva (10 + bonus pericia Intuicao) */
export function calcIntuicaoPassiva(personagem) {
  return 10 + calcBonusPericia(personagem, 'Intuição');
}

/** Calcula Investigacao Passiva (10 + bonus pericia Investigacao) */
export function calcInvestigacaoPassiva(personagem) {
  return 10 + calcBonusPericia(personagem, 'Investigação');
}

/**
 * Calcula bônus de uma perícia. DELEGA para
 * `domain/character/queries/skills.js#getSkillProjection` (fix round 1, C1)
 * — EXCETO quando a Força Primordial do Bárbaro em Fúria troca o atributo
 * usado (a consulta delegada ainda não suporta troca de atributo; ver
 * relatório da Task 16, fix round 1, Minor). Os bônus da Ordem Divina
 * (Taumaturgo)/Ordem Primal (Xamã) e de efeitos mágicos temporários
 * continuam locais (ainda não modelados no personagem canônico).
 */
export function calcBonusPericia(personagem, nomePericia, opcoes = {}) {
  const pericia = PERICIAS.find(p => p.nome === nomePericia);
  if (!pericia) return 0;

  const emFuria = !!opcoes.emFuria;
  const forcaPrimordialAtiva = !!opcoes.forcaPrimordialAtiva;
  const periciasConhecimentoPrimordial = ['Acrobacia', 'Furtividade', 'Intimidação', 'Percepção', 'Sobrevivência'];
  const usarForcaPrimordial = emFuria && forcaPrimordialAtiva && periciasConhecimentoPrimordial.includes(nomePericia);

  let bonus;
  const skillId = PERICIA_NOME_PARA_SKILL_ID[nomePericia];
  const ctx = usarForcaPrimordial ? null : resolveLegacyQueryContext();
  if (ctx && skillId) {
    const projected = projectLegacyCharacterForQueries(personagem, ctx);
    if (projected.ok) {
      const result = getSkillProjection(projected.value, skillId, { registry: ctx.registry });
      if (result.ok) {
        bonus = result.value.bonus;
      }
    }
  }
  if (bonus === undefined) {
    const key = usarForcaPrimordial ? 'forca' : ATRIBUTO_NOME_PARA_KEY[pericia.atributo];
    const mod = calcMod(personagem.atributos[key]);
    const prof = (personagem.pericias_proficientes || []).includes(nomePericia);
    const exp = (personagem.pericias_expertise || []).includes(nomePericia);
    bonus = mod;
    if (prof) bonus += bonusProficiencia(personagem.nivel);
    if (exp) bonus += bonusProficiencia(personagem.nivel);
    // Bardo: Pau pra Toda Obra (metade da proficiência em perícias sem proficiência)
    if (personagem.classe === 'Bardo' && (personagem.nivel || 1) >= 2 && !prof && !exp) {
      bonus += Math.floor(bonusProficiencia(personagem.nivel) / 2);
    }
  }

  // Clérigo (Ordem Divina: Taumaturgo) - bônus em Arcanismo e Religião
  if (
    personagem.classe === 'Clérigo' &&
    personagem.ordem_divina === 'Taumaturgo' &&
    (nomePericia === 'Arcanismo' || nomePericia === 'Religião')
  ) {
    bonus += Math.max(1, calcMod(personagem.atributos.sabedoria));
  }

  // Druida (Ordem Primal: Xamã) - bônus em Arcanismo e Natureza
  const ordemPrimal = personagem.ordem_primal || personagem.escolhas_classe?.ordem_primal?.[0] || '';
  if (
    personagem.classe === 'Druida' &&
    ordemPrimal === 'Xamã' &&
    (nomePericia === 'Arcanismo' || nomePericia === 'Natureza')
  ) {
    bonus += Math.max(1, calcMod(personagem.atributos.sabedoria));
  }

  // Efeitos magicos: bonus numerico de pericia (ex: Passo Sem Rastro +10 Furtividade)
  const efMag = personagem.efeitos_magicos || [];
  for (const ef of efMag) {
    if (ef.tipo === 'bonus_pericia' && typeof ef.bonus === 'number' && ef.pericia === nomePericia) {
      bonus += ef.bonus;
    }
  }

  return bonus;
}

/** Calcula espaços de magia com base na tabela da classe */
export function getEspacosMagia(tabelaCaracteristicas, nivel) {
  if (!tabelaCaracteristicas || nivel < 1) return {};
  const row = tabelaCaracteristicas.find(r => parseInt(r['Nível']) === nivel);
  if (!row) return {};
  const espacos = {};
  for (let i = 1; i <= 9; i++) {
    const val = row[String(i)];
    if (val && val !== '—' && val !== '-') {
      espacos[i] = { total: parseInt(val) || 0, usados: 0 };
    }
  }
  return espacos;
}

/** Quantidade de truques por nível (da tabela da classe) */
export function getTruquesConhecidos(tabelaCaracteristicas, nivel) {
  if (!tabelaCaracteristicas) return 0;
  const row = tabelaCaracteristicas.find(r => parseInt(r['Nível']) === nivel);
  return row ? (parseInt(row['Truques']) || 0) : 0;
}

/** Magias preparadas por nível (da tabela da classe) */
export function getMagiaPreparadas(tabelaCaracteristicas, nivel) {
  if (!tabelaCaracteristicas) return 0;
  const row = tabelaCaracteristicas.find(r => parseInt(r['Nível']) === nivel);
  return row ? (parseInt(row['Magias Preparadas']) || 0) : 0;
}

/** Deslocamento padrão da espécie (extraído do texto_completo) */
export function getDeslocamento(especieTexto) {
  if (!especieTexto) return '9 metros';
  const textoLimpo = especieTexto.replace(/\*\*/g, '');
  const match = textoLimpo.match(/Deslocamento:\s*(\d+(?:[\.,]\d+)?\s*metros?)/i);
  return match ? match[1].trim() : '9 metros';
}

/** Tamanho da espécie */
export function getTamanho(especieTexto) {
  if (!especieTexto) return 'Médio';
  const textoLimpo = especieTexto.replace(/\*\*/g, '');
  const match = textoLimpo.match(/Tamanho:\s*([^\n]+)/i);
  if (!match) return 'Médio';
  const linha = match[1].trim();

  if (/Médio\s*\(.+?\)\s*ou\s*Pequeno|Pequeno\s*\(.+?\)\s*ou\s*Médio/i.test(linha)) {
    return 'Médio ou Pequeno';
  }

  const tamanhoBase = linha.match(/\b(Pequeno|Médio|Grande)\b/i);
  return tamanhoBase ? tamanhoBase[1] : 'Médio';
}

// --- Renderizador simples de Markdown ---

/** Formata notação de dados (ex: 3d6, 2D8) como 🎲3d6🎲 */
export function formatarDados(texto) {
  if (!texto) return texto;
  return texto.replace(/(\d+)[dD](\d+)/g, '🎲$1d$2🎲');
}

/**
 * Converte markdown básico para HTML.
 *
 * FACHADA (Task 24): a implementação real vive em
 * `site/js/ui/markdown.js#renderSafeMarkdown`, que monta um DocumentFragment
 * com `createElement`/`createTextNode` a partir de uma allowlist fechada de
 * tags. Aqui o fragmento é apenas serializado de volta para string, porque os
 * consumidores legados (ficha, criador, impressão, PDF) ainda fazem
 * `innerHTML = mdParaHtml(...)`. Código novo deve chamar `renderSafeMarkdown`
 * e inserir o fragmento — sem passar por string em momento algum.
 *
 * `tests/unit/ui/markdown-fidelity.test.js` prova, sobre TODAS as descrições
 * reais do pacote `dnd2024`, que a saída continua equivalente à do baseline.
 * @param {string} texto
 * @returns {string} HTML
 */
export function mdParaHtml(texto) {
  if (!texto) return '';
  return renderSafeMarkdownToHtml(document, texto);
}

// --- Helpers gerais ---

/**
 * Detecta tipo de recarga de uma habilidade pela descrição.
 * Retorna 'curto', 'longo', 'curto_ou_longo' ou null (passiva).
 */
export function detectarRecarga(descricao) {
  if (!descricao) return null;
  const d = descricao.toLowerCase();
  if (d.includes('descanso curto ou longo') || d.includes('descanso longo ou curto'))
    return 'curto_ou_longo';
  // Check for short rest recharge
  const temCurto = d.includes('descanso curto');
  const temLongo = d.includes('descanso longo');
  if (temCurto && temLongo) return 'curto_ou_longo';
  if (temCurto) return 'curto';
  if (temLongo) return 'longo';
  return null;
}

/**
 * Detecta se uma habilidade é ativa (tem ação, reação, etc.) vs passiva.
 */
export function ehHabilidadeAtiva(descricao, nome) {
  if (!descricao) return false;
  // Habilidades que sao descritivas por natureza (listas de magias, conjuracao), nao importa o conteudo
  if (nome) {
    const n = nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (n.includes('conjuracao') || n.includes('pacto magico') || n.includes('magia de pacto') || n.startsWith('magias d')) return false;
  }
  const d = descricao.toLowerCase();
  const recarga = detectarRecarga(descricao);
  if (recarga) return true;
  const acoes = ['como uma ação', 'como ação bônus', 'como uma reação', 'você pode usar', 'você pode gastar', 'no seu turno'];
  return acoes.some(a => d.includes(a));
}

/** Gera UUID v4 simples */
export function gerarId() {
  return 'xxxx-xxxx-xxxx'.replace(/x/g, () =>
    Math.floor(Math.random() * 16).toString(16)
  );
}

/**
 * Escapa caracteres HTML especiais para prevenir XSS em innerHTML.
 * Nao adequado para contextos de atributos de evento ou URLs.
 *
 * FACHADA (Task 24): delega para `site/js/ui/html.js#escapeHtml`, que é o
 * único ponto do projeto que define o mapa de escape. Para montar VALOR DE
 * ATRIBUTO use `escapeHtmlAttribute` (conjunto de escape maior); para URLs,
 * `resolveSafeUrl`.
 * @param {*} str - Valor a escapar (null/undefined retorna '').
 * @returns {string} String com &, <, >, ", ' escapados.
 */
export function escHtml(str) {
  return escapeHtml(str);
}

/** Formata data para exibição */
export function fmtData(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ------------------------------------------------------------------
// FACHADA (Task 24) para os serviços de `site/js/ui/*`.
//
// Os serviços são criados sob demanda (não no topo do módulo) porque
// `utils.js` é avaliado antes de `DOMContentLoaded`, quando os elementos do
// shell (`#modal-overlay`, `#toast-container`, ...) ainda não existem.
// ------------------------------------------------------------------

/** @type {object | null} */
let _toastService = null;
/** @type {object | null} */
let _modalService = null;

/**
 * Devolve (criando na primeira chamada) o serviço de toast ligado ao
 * `#toast-container` do shell.
 * @returns {object}
 */
function getToastService() {
  if (!_toastService) {
    _toastService = createToastService({
      documentRef: document,
      container: document.getElementById('toast-container'),
    });
  }
  return _toastService;
}

/**
 * Devolve (criando na primeira chamada) o serviço de modal ligado ao markup
 * de modal do shell (`site/index.html`). O botão de fechar do cabeçalho é
 * registrado aqui — é o que substitui o `onclick="fecharModal()"` inline
 * removido do HTML nesta task.
 * @returns {object}
 */
function getModalService() {
  if (!_modalService) {
    const overlay = document.getElementById('modal-overlay');
    _modalService = createModalService({
      documentRef: document,
      overlay,
      container: document.getElementById('modal-container'),
      titleElement: document.getElementById('modal-titulo'),
      bodyElement: document.getElementById('modal-corpo'),
      actionsElement: document.getElementById('modal-acoes'),
      closeButton: overlay ? overlay.querySelector('.modal-fechar') : null,
    });
  }
  return _modalService;
}

/**
 * Converte uma string de HTML legada em nós, para entregar ao serviço de
 * modal (que só aceita nós).
 *
 * Este é o ÚNICO ponto onde markup ainda nasce de string, e existe só
 * enquanto ficha/criador/level-up montarem seu conteúdo assim (Tasks 29-32).
 * O comportamento é idêntico ao do baseline, que fazia `innerHTML = html`
 * diretamente nos mesmos elementos — nenhuma capacidade nova é concedida
 * aqui, e nenhum conteúdo passa a ser confiável por causa disso.
 * @param {string|object|null} html
 * @returns {object|null} DocumentFragment com os nós, ou `null`.
 */
function nosDeHtmlLegado(html) {
  if (html === null || html === undefined || html === '') return null;
  if (typeof html === 'object' && typeof html.nodeType === 'number') return html;
  const template = document.createElement('div');
  template.innerHTML = String(html);
  const fragment = document.createDocumentFragment();
  while (template.firstChild) {
    fragment.appendChild(template.firstChild);
  }
  return fragment;
}

/**
 * Cria e liga, de uma vez, os serviços de UI do shell (modal e toast).
 * Chamado pelo shell (`site/js/app.js#init`) para que os listeners do
 * cabeçalho do modal — que substituíram o `onclick` inline de
 * `site/index.html` — existam desde o boot, e não só a partir do primeiro
 * `abrirModal`.
 * @returns {void}
 */
export function inicializarUiDoShell() {
  getModalService();
  getToastService();
}

/**
 * Devolve o `ModalService` do shell.
 *
 * `abrirModal`/`fecharModal` continuam sendo a fachada para o código legado
 * (que fala em string de HTML e depende do comportamento congelado do
 * baseline). Quem já foi migrado — hoje o criador novo
 * (`features/creator/creator-controller.js`, que abre modal a partir de NÓS,
 * com pilha e `onClose` próprios) — precisa do serviço em si; sem este acesso
 * o composition root teria de construir um SEGUNDO `ModalService` sobre os
 * mesmos elementos do shell, e os dois brigariam pela mesma pilha.
 * @returns {object} o `ModalService` ligado ao markup de `site/index.html`.
 */
export function obterServicoDeModal() {
  return getModalService();
}

/**
 * Mostra toast de notificação.
 *
 * FACHADA (Task 24): delega para `site/js/ui/toast.js`, que escreve a
 * mensagem com `setSafeText`.
 * @param {*} msg
 * @param {string} [tipo]
 * @returns {void}
 */
export function toast(msg, tipo = '') {
  getToastService().show(msg, tipo);
}

/** Debounce simples */
export function debounce(fn, ms = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/** Remove acentos para busca */
export function semAcento(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/**
 * Abre modal global. onClose é chamado quando o modal principal é fechado.
 *
 * FACHADA (Task 24): delega para `site/js/ui/modal.js#createModalService`.
 * Três detalhes de compatibilidade, deliberados, para que NENHUM chamador
 * legado mude de comportamento:
 *
 *  - `closeOnEscape`/`manageFocus` ficam DESLIGADOS. O serviço suporta os
 *    dois (e os testes de `tests/unit/ui/modal.test.js` os exercitam), mas o
 *    baseline não fechava com Escape nem mexia no foco; ligar isso agora
 *    mudaria o comportamento de 92 chamadas de `abrirModal` de uma vez, o
 *    que não é escopo desta task. As Tasks 29-32 ligam por tela.
 *  - `onClose` só é registrado quando este é o modal PRINCIPAL, porque no
 *    baseline o 4º argumento era silenciosamente ignorado em sub-modais.
 *  - Botões com `data-action="fechar-modal"` (a forma declarativa que
 *    substituiu o handler inline legado na Task 37) são ligados para fechar
 *    o PRÓPRIO modal aberto por esta chamada (inclusive sub-modais).
 *
 * @param {string} titulo
 * @param {string} corpoHtml
 * @param {string} [acoesHtml]
 * @param {Function|null} [onClose]
 * @returns {object} handle do modal (`close`, `isOpen`, `element`).
 */
export function abrirModal(titulo, corpoHtml, acoesHtml = '', onClose = null) {
  const service = getModalService();
  const ehPrincipal = service.getStackSize() === 0;
  const handle = service.open({
    title: titulo,
    content: nosDeHtmlLegado(corpoHtml),
    actions: nosDeHtmlLegado(acoesHtml),
    onClose: ehPrincipal ? onClose : null,
    closeOnEscape: false,
    manageFocus: false,
  });

  // Fechamento DECLARATIVO (Task 37): qualquer `[data-action="fechar-modal"]`
  // dentro do modal fecha ESTE modal (o do handle, não o do topo da pilha —
  // que em sub-modais seria o mesmo, mas aqui fica explícito). Substitui o
  // antigo `onclick="fecharModal()"` inline, eliminado de todo o `site/**`
  // para permitir remover `'unsafe-inline'` de `script-src` na CSP.
  handle.element.querySelectorAll('[data-action="fechar-modal"]').forEach(btn => {
    btn.addEventListener('click', () => handle.close('data-action-fechar-modal'));
  });
  return handle;
}

/**
 * Fecha modal global (o do topo da pilha, como no baseline).
 * FACHADA (Task 24) sobre `ModalService.closeTop`.
 * @returns {void}
 */
export function fecharModal() {
  getModalService().closeTop('legacy-fechar-modal');
}

/**
 * Fecha todos os modais (principal + sub-modais).
 * FACHADA (Task 24) sobre `ModalService.closeAll`.
 * @returns {void}
 */
export function fecharModalTodos() {
  getModalService().closeAll('legacy-fechar-todos');
}
// Expor para onclick inline
window.fecharModal = fecharModal;
window.fecharModalTodos = fecharModalTodos;

/** Extrai número base de uma string de CA (ex: "14 + Modificador de Des (máx. 2)" -> 14) */
export function parsearCA(caStr) {
  if (!caStr) return 10;
  const match = caStr.match(/^[+]?(\d+)/);
  return match ? parseInt(match[1]) : 10;
}

/**
 * Lê um arquivo de imagem, redimensiona (mantendo proporção, máximo maxDim
 * em qualquer lado) e retorna como data URL JPEG comprimido — pequeno o
 * bastante pra guardar direto no objeto do personagem (localStorage + sync
 * na nuvem) sem estourar limite de tamanho.
 * @param {File} file - arquivo escolhido pelo usuário (input type=file)
 * @param {number} maxDim - dimensão máxima em pixels (largura ou altura)
 * @returns {Promise<string|null>} data URL da imagem redimensionada, ou null se inválido
 */
export function processarImagemArquivo(file, maxDim = 300) {
  return new Promise((resolve) => {
    if (!file || !file.type || !file.type.startsWith('image/')) {
      resolve(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round(height * (maxDim / width));
            width = maxDim;
          } else {
            width = Math.round(width * (maxDim / height));
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = () => resolve(null);
      img.src = ev.target.result;
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

/** Converte string de peso ("0,5 kg", "250 g", "1 kg (saco)", "—", "Varia") em kg (number). */
export function parsePeso(pesoStr) {
  if (pesoStr == null) return 0;
  const txt = String(pesoStr).trim();
  if (!txt || txt === '—' || txt === '-' || /varia/i.test(txt)) return 0;
  // "kg" tem prioridade sobre "g" para não casar o 'g' de 'kg'
  const mkg = txt.match(/(\d+(?:[.,]\d+)?)\s*kg/i);
  if (mkg) return parseFloat(mkg[1].replace(',', '.'));
  const mg = txt.match(/(\d+(?:[.,]\d+)?)\s*g\b/i);
  if (mg) return parseFloat(mg[1].replace(',', '.')) / 1000;
  const m = txt.match(/(\d+(?:[.,]\d+)?)/);
  return m ? parseFloat(m[1].replace(',', '.')) : 0;
}

/** Formata kg com vírgula decimal (ex: 3.5 -> "3,5"). */
export function fmtPeso(kg) {
  const n = Math.round((Number(kg) || 0) * 100) / 100;
  return n.toString().replace('.', ',');
}

/**
 * Multiplicador de capacidade de carregar por tamanho de criatura. DELEGA
 * para `domain/character/queries/movement.js#resolveCarryingCapacityMultiplier`
 * (fix round 1, C1) — única tabela de multiplicadores do projeto, nunca uma
 * segunda cópia mantida aqui.
 */
export function getMultiplicadorCarga(tamanho) {
  return resolveCarryingCapacityMultiplier(tamanho);
}

/** Capacidade de carregar em kg: Força (valor) × multiplicador de tamanho. */
export function getCapacidadeCarga(forca, tamanho) {
  const f = parseInt(forca) || 0;
  return f * getMultiplicadorCarga(tamanho);
}

/** Descrição do cálculo real da capacidade (ex: "Força 15 × 7 (Pequeno) = 105 kg"). */
export function descreverCapacidadeCarga(forca, tamanho) {
  const f = parseInt(forca) || 0;
  const mult = getMultiplicadorCarga(tamanho);
  const total = f * mult;
  return `Força ${f} × ${fmtPeso(mult)} (${tamanho || 'Médio'}) = ${fmtPeso(total)} kg`;
}

/** Peso total do inventário em kg (peso × quantidade; ignora itens com qtd <= 0). */
export function getPesoTotalInventario(inventario) {
  if (!Array.isArray(inventario)) return 0;
  return inventario.reduce((total, item) => {
    const qtd = item.quantidade ?? 1;
    if (qtd <= 0) return total;
    const peso = parsePeso(item.dados?.peso ?? item.peso);
    return total + peso * qtd;
  }, 0);
}
