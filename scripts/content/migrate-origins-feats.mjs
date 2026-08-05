#!/usr/bin/env node
// `scripts/content/migrate-origins-feats.mjs`: conversor determinístico das
// 11 espécies, 16 antecedentes e 75 talentos de D&D 2024 para o formato de
// conteúdo estruturado v1 (`species.schema.json`, `background.schema.json`,
// `feat.schema.json`, `effect.schema.json`, `choice.schema.json`).
//
// Fonte de verdade (LEGADO, nunca reescrita por este script):
//   - `dados/origens/especies.json` (`especies[].tracos[]`): traços de cada
//     espécie, cada um com `nome` (rótulo ESTÁVEL escolhido pelos autores do
//     livro, não uma frase livre) e `descricao` (prosa).
//   - `dados/origens/antecedentes.json`: atributos elegíveis, perícias,
//     ferramenta/idioma, talento concedido, equipamento e moedas por
//     antecedente.
//   - `dados/talentos/talentos.json` (`todos[]`): cada talento com
//     `categoria`, `prerequisito` (texto), `beneficios[]` (cada um com
//     `nome` estável + `descricao`).
//
// Princípio seguido em toda a conversão (mesmo de `migrate-classes.mjs`):
// nenhum fato mecânico é extraído por regex sobre a prosa de `descricao`.
// Every structured fact (size/speed/senses/resistances/spells/resources/
// ability-score-increase/prerequisites de nível/repetibilidade) vem de uma
// tabela AUTORADA À MÃO neste arquivo, indexada pelo rótulo ESTÁVEL
// (`especie.nome`/`traco.nome`/`talento.nome`/`beneficio.nome`) que já é um
// campo estruturado do próprio JSON legado — nunca de um match de regex
// sobre frases. Todo benefício de talento que não tem uma tabela de
// enriquecimento estrutural vira um efeito `manual` (tipo de efeito
// legítimo do vocabulário fechado, não uma bandeira de falha) cujo `text` é
// o texto legado verbatim — garante que NENHUM benefício é descartado
// silenciosamente (a mesma falha que a revisão da Task 8 pegou duas vezes:
// efeitos de recurso duplicados e escolhas não estruturadas).
//
// Uso como CLI:
//   node scripts/content/migrate-origins-feats.mjs
//     Constrói tudo em memória e imprime um resumo (staging, nada é escrito).
//   node scripts/content/migrate-origins-feats.mjs --write
//     Escreve os 3 catálogos + o fragmento de índice de staging.
//   node scripts/content/migrate-origins-feats.mjs --check
//     Recompila em memória e compara byte a byte com os arquivos commitados.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { slugify, buildContentId } from './content-id-map.mjs';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const legacySpeciesPath = path.join(repoRoot, 'dados', 'origens', 'especies.json');
const legacyBackgroundsPath = path.join(repoRoot, 'dados', 'origens', 'antecedentes.json');
const legacyFeatsPath = path.join(repoRoot, 'dados', 'talentos', 'talentos.json');
const legacyArmadurasPath = path.join(repoRoot, 'dados', 'equipamento', 'armaduras.json');
const legacyArmasPath = path.join(repoRoot, 'dados', 'equipamento', 'armas.json');
const outputSpeciesPath = path.join(repoRoot, 'dados', 'pacotes', 'dnd2024', 'species', 'catalog.json');
const outputBackgroundsPath = path.join(repoRoot, 'dados', 'pacotes', 'dnd2024', 'backgrounds', 'catalog.json');
const outputFeatsPath = path.join(repoRoot, 'dados', 'pacotes', 'dnd2024', 'feats', 'catalog.json');
const indexFragmentsDir = path.join(repoRoot, 'scripts', 'content', 'dnd2024-index-fragments');
const indexFragmentPath = path.join(indexFragmentsDir, 'origins-feats.json');

const NAMESPACE = 'dnd2024';
const SCHEMA_VERSION = '1.0.0';
const SOURCE_BOOK = 'Livro do Jogador (2024)';

// -----------------------------------------------------------------------
// Utilitários de id / referência
// -----------------------------------------------------------------------

const abilityId = (nome) => buildContentId(NAMESPACE, 'ability', nome);
const skillId = (nome) => buildContentId(NAMESPACE, 'skill', nome);
const speciesId = (nome) => buildContentId(NAMESPACE, 'species', nome);
const backgroundId = (nome) => buildContentId(NAMESPACE, 'background', nome);
const featId = (nome) => buildContentId(NAMESPACE, 'feat', nome);
const spellId = (nome) => buildContentId(NAMESPACE, 'spell', nome);
const weaponRefId = (nome) => buildContentId(NAMESPACE, 'weapon', nome);
const armorRefId = (nome) => buildContentId(NAMESPACE, 'armor', nome);
const equipmentRefId = (nome) => buildContentId(NAMESPACE, 'equipment', nome);
const languageId = (nome) => buildContentId(NAMESPACE, 'language', LANGUAGE_NAME_OVERRIDE[nome] ?? nome);
const damageTypeId = (nomeLegado) => {
  const slug = DAMAGE_TYPE_NAME_MAP[nomeLegado];
  if (!slug) throw new Error(`migrate-origins-feats: tipo de dano legado desconhecido "${nomeLegado}".`);
  return buildContentId(NAMESPACE, 'damage-type', slug === 'forca' ? 'Força' : DAMAGE_TYPE_LABEL[slug]);
};

// `dados/pacotes/dnd2024/rulesets/damage-types.json` usa nomes canônicos que
// divergem da prosa legada em 3 casos (Elétrico->Relâmpago, Gélido->Frio,
// Ígneo->Fogo, Venenoso->Veneno). Mapa autorado à mão, uma vez, a partir da
// leitura dos dois arquivos — não é regex sobre frase alguma.
const DAMAGE_TYPE_NAME_MAP = {
  Ácido: 'acido',
  Elétrico: 'relampago',
  Gélido: 'frio',
  Ígneo: 'fogo',
  Necrótico: 'necrotico',
  Radiante: 'radiante',
  Trovejante: 'trovao',
  Venenoso: 'veneno',
  Psíquico: 'psiquico',
  Cortante: 'cortante',
  Perfurante: 'perfurante',
  Contundente: 'contundente',
  Força: 'forca',
};
const DAMAGE_TYPE_LABEL = {
  acido: 'Ácido',
  relampago: 'Relâmpago',
  frio: 'Frio',
  fogo: 'Fogo',
  necrotico: 'Necrótico',
  radiante: 'Radiante',
  trovao: 'Trovão',
  veneno: 'Veneno',
  psiquico: 'Psíquico',
  cortante: 'Cortante',
  perfurante: 'Perfurante',
  contundente: 'Contundente',
  forca: 'Força',
};
// `dados/pacotes/dnd2024/rulesets/languages.json` chama o idioma dos
// pequeninos de "Halfling"; a prosa legada de espécies/antecedentes usa
// "Pequenino". Único desvio de nome conhecido.
const LANGUAGE_NAME_OVERRIDE = { Pequenino: 'Halfling' };

const ABILITY_NAMES = ['Força', 'Destreza', 'Constituição', 'Inteligência', 'Sabedoria', 'Carisma'];
const ABILITY_SLUG_TO_NAME = { for: 'Força', des: 'Destreza', con: 'Constituição', int: 'Inteligência', sab: 'Sabedoria', car: 'Carisma' };

// -----------------------------------------------------------------------
// Compilador de "traits" -> Effect[] (vocabulário fechado de
// `effect.schema.json`). Cada helper devolve um objeto Effect pronto; a
// composição/ordem é decidida pelas tabelas autoradas abaixo, nunca por
// inferência automática.
// -----------------------------------------------------------------------

function darkvision(id, rangeMeters, when) {
  return { id, type: 'modifier', target: 'senses.darkvision', operation: 'set', value: rangeMeters, ...(when ? { when } : {}) };
}

function resistance(id, nomeLegadoDano, when) {
  return { id, type: 'defense', damageType: damageTypeId(nomeLegadoDano), mode: 'resistance', ...(when ? { when } : {}) };
}

function language(id, nome, when) {
  return { id, type: 'language', language: languageId(nome), ...(when ? { when } : {}) };
}

function proficiencySkill(id, nomePericia, level = 'proficient', when) {
  return { id, type: 'proficiency', target: skillId(nomePericia), level, ...(when ? { when } : {}) };
}

function grantSpell(id, nomeMagia, alwaysPrepared = true, when) {
  return { id, type: 'grant-spell', spell: spellId(nomeMagia), alwaysPrepared, ...(when ? { when } : {}) };
}

function resource(id, resourceSlug, max, recovery, when) {
  return { id, type: 'resource', resource: resourceSlug, max, recovery, ...(when ? { when } : {}) };
}

function manual(id, text, when) {
  return { id, type: 'manual', text, ...(when ? { when } : {}) };
}

function modifierEffect(id, target, operation, value, when) {
  return { id, type: 'modifier', target, operation, value, ...(when ? { when } : {}) };
}

function officialHandler(id, handlerId, params = {}, when) {
  return { id, type: 'official-handler', handlerId, params, ...(when ? { when } : {}) };
}

/**
 * Monta um efeito `choice` a partir de opções simples {id,label,grants}.
 * @param {string} id
 * @param {string} prompt
 * @param {number} min
 * @param {number} max
 * @param {Array<{id:string,label:string,grants?:object[]}>} options
 * @param {object} [when]
 * @returns {object}
 */
function choiceEffect(id, prompt, min, max, options, when) {
  return {
    id,
    type: 'choice',
    ...(when ? { when } : {}),
    choice: { id, prompt, min, max, options: options.map((o) => ({ id: o.id, label: o.label, grants: o.grants ?? [] })) },
  };
}

const levelAtLeast = (min) => ({ kind: 'level', min });

/**
 * Choice de tamanho para espécies que oferecem Médio OU Pequeno
 * ("escolhido ao selecionar esta espécie"). O `size` de topo (obrigatório
 * pelo schema) fica como "medium" (opção listada primeiro no legado); a
 * opção "pequeno" sobrescreve via modifier.
 */
function sizeChoiceMediumOrSmall() {
  return choiceEffect('tamanho', 'Escolha o tamanho da sua espécie', 1, 1, [
    { id: 'medio', label: 'Médio', grants: [modifierEffect('tamanho-medio', 'size', 'set', 'medium')] },
    { id: 'pequeno', label: 'Pequeno', grants: [modifierEffect('tamanho-pequeno', 'size', 'set', 'small')] },
  ]);
}

/**
 * Choice de bônus de atributo de antecedente (regra 2024, idêntica para os
 * 16 antecedentes, parametrizada pelas 3 habilidades elegíveis): formato
 * "+2 em uma, +1 em outra diferente" (6 permutações ordenadas) OU "+1 nas
 * três". Cada opção é enumerada com id próprio e independente do texto
 * exibido (label é só rótulo de apresentação).
 * @param {[string,string,string]} abilityNames - nomes em português das 3 habilidades elegíveis
 */
function backgroundAbilityScoreChoice(abilityNames) {
  const options = [];
  for (const major of abilityNames) {
    for (const minor of abilityNames) {
      if (major === minor) continue;
      const majorSlug = slugify(major);
      const minorSlug = slugify(minor);
      options.push({
        id: `${majorSlug}-mais2-${minorSlug}-mais1`,
        label: `${major} +2, ${minor} +1`,
        grants: [
          modifierEffect(`asi-${majorSlug}-2`, `ability.${majorSlug}.score`, 'add', 2),
          modifierEffect(`asi-${minorSlug}-1`, `ability.${minorSlug}.score`, 'add', 1),
        ],
      });
    }
  }
  options.push({
    id: 'todas-mais1',
    label: `${abilityNames.join(', ')} +1 cada`,
    grants: abilityNames.map((a) => modifierEffect(`asi-${slugify(a)}-1`, `ability.${slugify(a)}.score`, 'add', 1)),
  });
  return choiceEffect(
    'bonus-de-atributo',
    'Escolha: +2 em um atributo elegível e +1 em outro, ou +1 nos três atributos elegíveis',
    1,
    1,
    options,
  );
}

/**
 * Choice de aumento de valor de atributo de talento ("Aumento no Valor de
 * Atributo" de cada talento Geral/Dádiva Épica): +1 em uma habilidade
 * elegível, respeitando o teto (20 ou 30 para Dádiva Épica). A lista de
 * habilidades elegíveis vem da tabela ASI_TABLE (autorada à mão a partir da
 * leitura de cada `descricao` de benefício, nunca de regex em runtime).
 * @param {string[]} abilityNames - nomes em português das habilidades elegíveis
 * @param {number} max - teto do valor de atributo (20 padrão, 30 Dádiva Épica)
 */
function asiChoice(abilityNames, max) {
  return choiceEffect(
    'aumento-atributo',
    `Aumente o valor de um atributo em 1 (até ${max})`,
    1,
    1,
    abilityNames.map((a) => {
      const slug = slugify(a);
      return {
        id: slug,
        label: a,
        grants: [
          modifierEffect(`asi-${slug}-add`, `ability.${slug}.score`, 'add', 1),
          modifierEffect(`asi-${slug}-teto`, `ability.${slug}.score`, 'max', max),
        ],
      };
    }),
  );
}

// -----------------------------------------------------------------------
// ESPÉCIES (11) — dados/origens/especies.json
// -----------------------------------------------------------------------
// `size`/`speed` de topo (obrigatórios pelo schema) e o restante dos
// traços de cada espécie (`dados/origens/especies.json#tracos[].nome`,
// rótulo estável) mapeado à mão para efeitos estruturados + `manual` para a
// mecânica processual que o vocabulário fechado não modela (transformações
// temporárias, ataques com dano escalando por nível, etc. — sempre com o
// texto legado completo em `text`, nunca descartado).

const SPECIES_TABLE = [
  {
    nome: 'Aasimar',
    size: 'medium',
    sizeChoice: true,
    speed: 9,
    effects: () => [
      resistance('resistencia-celestial-necrotico', 'Necrótico'),
      resistance('resistencia-celestial-radiante', 'Radiante'),
      darkvision('visao-no-escuro', 18),
      resource('maos-curativas-usos', 'maos-curativas', 'proficiency-bonus', 'long-rest'),
      manual(
        'maos-curativas',
        'Você executa uma ação Usar Magia, toca uma criatura e joga um número de d4s igual ao seu Bônus de Proficiência. A criatura restaura número de Pontos de Vida igual ao total jogado. Após usar esse traço, você não pode usá-lo novamente até completar um Descanso Longo.',
      ),
      grantSpell('portador-da-luz-magia', 'Luz', true),
      manual('portador-da-luz', 'Você conhece o truque da Luz. Carisma é seu atributo de conjuração para isso.'),
      resource('revelacao-celestial-usos', 'revelacao-celestial', 1, 'long-rest', levelAtLeast(3)),
      choiceEffect(
        'revelacao-celestial',
        'Escolha a forma da Revelação Celestial (nível 3+)',
        1,
        1,
        [
          {
            id: 'asas-celestiais',
            label: 'Asas Celestiais',
            grants: [manual('asas-celestiais', 'Duas asas espectrais brotam em suas costas temporariamente. Até que a transformação se encerre, você tem um Deslocamento de Voo igual ao seu Deslocamento.')],
          },
          {
            id: 'manto-necrotico',
            label: 'Manto Necrótico',
            grants: [manual('manto-necrotico', 'Seus olhos se tornam brevemente poças de escuridão, e asas que não voam brotam em suas costas temporariamente. Criaturas que não sejam seus aliados a até 3 metros de você devem ser bem-sucedidas em uma salvaguarda de Carisma (CD 8 + modificador de Carisma + Bônus de Proficiência) ou têm a condição Amedrontado até o final do seu próximo turno.')],
          },
          {
            id: 'transfiguracao-radiante',
            label: 'Transfiguração Radiante',
            grants: [manual('transfiguracao-radiante', 'Luz abrasadora irradia temporariamente de seus olhos e boca. Pela duração, você emite Luz Plena em 3 metros e Meia-luz por mais 3 metros, e no fim de cada um dos seus turnos, cada criatura a até 3 metros de você sofre dano Radiante igual ao seu Bônus de Proficiência.')],
          },
        ],
        levelAtLeast(3),
      ),
      manual('revelacao-celestial-dano-adicional', 'Uma vez em cada um dos seus turnos, até que a transformação termine, você pode infligir dano adicional (igual ao Bônus de Proficiência) a um alvo que sofra dano de um ataque ou magia seu; o tipo é Necrótico (Manto Necrótico) ou Radiante (Asas Celestiais/Transfiguração Radiante).', levelAtLeast(3)),
      sizeChoiceMediumOrSmall(),
    ],
  },
  {
    nome: 'Anão',
    size: 'medium',
    speed: 9,
    effects: () => [
      darkvision('visao-no-escuro', 36),
      resistance('resistencia-veneno', 'Venenoso'),
      manual('resistencia-a-toxinas-salvaguarda', 'Você tem Vantagem nas salvaguardas que realizar para evitar ou encerrar a condição Envenenado.'),
      manual('tenacidade-ana', 'Seus Pontos de Vida máximos aumentam em 1, e novamente em 1, sempre que você atinge um nível de personagem.'),
      resource('conhecimento-de-pedras-usos', 'conhecimento-de-pedras', 'proficiency-bonus', 'long-rest'),
      manual('conhecimento-de-pedras', 'Como uma Ação Bônus, você adquire Sismiconsciência com alcance de 18 metros por 10 minutos, desde que esteja em ou tocando uma superfície de pedra (natural ou trabalhada).'),
    ],
  },
  {
    nome: 'Draconato',
    size: 'medium',
    speed: 9,
    effects: () => [
      choiceEffect(
        'heranca-draconica',
        'Escolha o tipo de dragão da sua Herança Dracônica',
        1,
        1,
        [
          { id: 'azul', label: 'Azul (Elétrico)', grants: [resistance('resistencia-a-dano-heranca', 'Elétrico')] },
          { id: 'branco', label: 'Branco (Gélido)', grants: [resistance('resistencia-a-dano-heranca', 'Gélido')] },
          { id: 'bronze', label: 'Bronze (Elétrico)', grants: [resistance('resistencia-a-dano-heranca', 'Elétrico')] },
          { id: 'cobre', label: 'Cobre (Ácido)', grants: [resistance('resistencia-a-dano-heranca', 'Ácido')] },
          { id: 'latao', label: 'Latão (Ígneo)', grants: [resistance('resistencia-a-dano-heranca', 'Ígneo')] },
          { id: 'negro', label: 'Negro (Ácido)', grants: [resistance('resistencia-a-dano-heranca', 'Ácido')] },
          { id: 'ouro', label: 'Ouro (Ígneo)', grants: [resistance('resistencia-a-dano-heranca', 'Ígneo')] },
          { id: 'prata', label: 'Prata (Gélido)', grants: [resistance('resistencia-a-dano-heranca', 'Gélido')] },
          { id: 'verde', label: 'Verde (Venenoso)', grants: [resistance('resistencia-a-dano-heranca', 'Venenoso')] },
          { id: 'vermelho', label: 'Vermelho (Ígneo)', grants: [resistance('resistencia-a-dano-heranca', 'Ígneo')] },
        ],
      ),
      resource('ataque-de-sopro-usos', 'ataque-de-sopro', 'proficiency-bonus', 'long-rest'),
      manual(
        'ataque-de-sopro',
        'Ao executar a ação Atacar, você pode substituir um ataque por uma emissão de energia em Cone de 4,5m ou Linha de 9m x 1,5m (escolha a forma a cada vez). Cada criatura na área faz salvaguarda de Destreza (CD 8 + modificador de Constituição + Bônus de Proficiência); falha causa 1d10 de dano do tipo da Herança Dracônica (2d10 no nível 5, 3d10 no 11, 4d10 no 17), sucesso causa metade.',
      ),
      darkvision('visao-no-escuro', 18),
      resource('voo-draconico-usos', 'voo-draconico', 1, 'long-rest', levelAtLeast(5)),
      manual('voo-draconico', 'No nível 5, como Ação Bônus, você cria asas espectrais por 10 minutos (ou até retraí-las ou ficar Incapacitado) e ganha Deslocamento de Voo igual ao seu Deslocamento. Após usar, só de novo após um Descanso Longo.', levelAtLeast(5)),
    ],
  },
  {
    nome: 'Elfo',
    size: 'medium',
    speed: 9,
    effects: () => [
      darkvision('visao-no-escuro', 18),
      choiceEffect(
        'linhagem-elfica',
        'Escolha sua Linhagem Élfica',
        1,
        1,
        [
          {
            id: 'alto-elfo',
            label: 'Alto Elfo',
            grants: [
              grantSpell('linhagem-truque', 'Prestidigitação Arcana', true),
              manual('linhagem-nivel1', 'Sempre que completar um Descanso Longo, você pode substituir este truque por um truque diferente da lista de magias de Mago.'),
              grantSpell('linhagem-nivel3', 'Detectar Magia', true, levelAtLeast(3)),
              grantSpell('linhagem-nivel5', 'Passo Nebuloso', true, levelAtLeast(5)),
            ],
          },
          {
            id: 'drow',
            label: 'Drow',
            grants: [
              darkvision('linhagem-visao-no-escuro', 36),
              grantSpell('linhagem-truque', 'Luzes Dançantes', true),
              grantSpell('linhagem-nivel3', 'Fogo das Fadas', true, levelAtLeast(3)),
              grantSpell('linhagem-nivel5', 'Escuridão', true, levelAtLeast(5)),
            ],
          },
          {
            id: 'elfo-silvestre',
            label: 'Elfo Silvestre',
            grants: [
              modifierEffect('linhagem-deslocamento', 'speed', 'set', 10.5),
              grantSpell('linhagem-truque', 'Arte Druídica', true),
              grantSpell('linhagem-nivel3', 'Passos Largos', true, levelAtLeast(3)),
              grantSpell('linhagem-nivel5', 'Passo Sem Rastro', true, levelAtLeast(5)),
            ],
          },
        ],
      ),
      manual('linhagem-elfica-atributo', 'Inteligência, Sabedoria ou Carisma é seu atributo de conjuração para as magias da Linhagem Élfica (escolha ao selecionar a linhagem); as magias de nível 3/5 estão sempre preparadas e podem ser conjuradas uma vez sem espaço de magia, restaurando ao completar um Descanso Longo.'),
      manual('ancestralidade-feerica', 'Você tem Vantagem ao realizar salvaguardas para evitar ou encerrar a condição Enfeitiçado.'),
      choiceEffect('sentidos-agucados', 'Escolha a perícia de Sentidos Aguçados', 1, 1, [
        { id: 'intuicao', label: 'Intuição', grants: [proficiencySkill('sentidos-agucados-pericia', 'Intuição')] },
        { id: 'percepcao', label: 'Percepção', grants: [proficiencySkill('sentidos-agucados-pericia', 'Percepção')] },
        { id: 'sobrevivencia', label: 'Sobrevivência', grants: [proficiencySkill('sentidos-agucados-pericia', 'Sobrevivência')] },
      ]),
      manual('transe', 'Você pode completar um Descanso Longo em 4 horas ao meditar, sem dormir, mantendo a consciência; magia não pode forçá-lo a dormir.'),
    ],
  },
  {
    nome: 'Gnomo',
    size: 'small',
    speed: 9,
    effects: () => [
      darkvision('visao-no-escuro', 18),
      manual('astucia-de-gnomo', 'Você tem Vantagem em salvaguardas de Inteligência, Sabedoria e Carisma.'),
      choiceEffect(
        'linhagem-gnomica',
        'Escolha sua Linhagem Gnômica',
        1,
        1,
        [
          {
            id: 'gnomo-das-rochas',
            label: 'Gnomo das Rochas',
            grants: [
              grantSpell('linhagem-truque-1', 'Prestidigitação Arcana', true),
              grantSpell('linhagem-truque-2', 'Reparar', true),
              manual('gnomo-das-rochas-dispositivo', 'Você pode gastar 10 minutos conjurando Prestidigitação Arcana para fabricar um dispositivo mecânico minúsculo (CA 5, 1 PV) que reproduz um efeito da magia ao ser ativado com um toque (Ação Bônus). Pode ter até 3 ao mesmo tempo; cada um se desfaz 8 horas após ser fabricado ou ao ser desmontado.'),
            ],
          },
          {
            id: 'gnomo-do-bosque',
            label: 'Gnomo do Bosque',
            grants: [
              grantSpell('linhagem-truque-1', 'Ilusão Menor', true),
              grantSpell('linhagem-nivel1', 'Falar com Animais', true),
              resource('gnomo-do-bosque-usos', 'gnomo-do-bosque-falar-com-animais', 'proficiency-bonus', 'long-rest'),
              manual('gnomo-do-bosque-conjuracao', 'Falar com Animais está sempre preparada e pode ser conjurada sem espaço de magia um número de vezes igual ao Bônus de Proficiência (restaura em Descanso Longo), ou usando qualquer espaço de magia disponível.'),
            ],
          },
        ],
      ),
      manual('linhagem-gnomica-atributo', 'Inteligência, Sabedoria ou Carisma é seu atributo de conjuração para as magias da Linhagem Gnômica (escolha ao selecionar a linhagem).'),
    ],
  },
  {
    nome: 'Golias',
    size: 'medium',
    speed: 10.5,
    effects: () => [
      choiceEffect(
        'ancestralidade-gigante',
        'Escolha o benefício da Ancestralidade Gigante',
        1,
        1,
        [
          { id: 'arrepio-do-gelo', label: 'Arrepio do Gelo (Gigante do Gelo)', grants: [manual('beneficio', 'Ao atingir um alvo com uma jogada de ataque e causar dano, você também pode infligir 1d6 de dano Gélido e reduzir o Deslocamento do alvo em 3 metros até o início do seu próximo turno.')] },
          { id: 'queimadura-de-fogo', label: 'Queimadura de Fogo (Gigante de Fogo)', grants: [manual('beneficio', 'Ao atingir um alvo com uma jogada de ataque e causar dano, você também pode causar 1d10 de dano Ígneo a esse alvo.')] },
          { id: 'resistencia-da-pedra', label: 'Resistência da Pedra (Gigante da Pedra)', grants: [manual('beneficio', 'Ao sofrer dano, pode executar uma Reação para jogar 1d12 e reduzir o dano em 1d12 + modificador de Constituição.')] },
          { id: 'salto-da-nuvem', label: 'Salto da Nuvem (Gigante das Nuvens)', grants: [manual('beneficio', 'Como Ação Bônus, você se teleporta magicamente até 9 metros para um espaço desocupado à sua vista.')] },
          { id: 'tombo-da-colina', label: 'Tombo da Colina (Gigante da Colina)', grants: [manual('beneficio', 'Ao atingir uma criatura Grande ou menor com uma jogada de ataque e causar dano, você pode impor a condição Caído.')] },
          { id: 'trovao-da-tempestade', label: 'Trovão da Tempestade (Gigante da Tempestade)', grants: [manual('beneficio', 'Ao sofrer dano de uma criatura a até 18 metros, você pode executar uma Reação para causar 1d8 de dano Trovejante a essa criatura.')] },
        ],
      ),
      resource('ancestralidade-gigante-usos', 'ancestralidade-gigante', 'proficiency-bonus', 'long-rest'),
      resource('forma-grande-usos', 'forma-grande', 1, 'long-rest', levelAtLeast(5)),
      manual('forma-grande', 'A partir do nível 5, como Ação Bônus (se houver espaço), você muda para tamanho Grande por 10 minutos (ou até encerrar): Vantagem em testes de Força e Deslocamento +3 metros. Só de novo após um Descanso Longo.', levelAtLeast(5)),
      manual('porte-poderoso', 'Você tem Vantagem em qualquer teste de atributo para encerrar a condição Imobilizado, e conta como um tamanho maior para capacidade de carga.'),
    ],
  },
  {
    nome: 'Humano',
    size: 'medium',
    sizeChoice: true,
    speed: 9,
    effects: () => [
      manual('eficiente', 'Você adquire Inspiração Heroica sempre que completar um Descanso Longo.'),
      choiceEffect('habil', 'Escolha a perícia de Hábil', 1, 1, ABILITY_SKILLS_ALL.map((s) => ({ id: slugify(s), label: s, grants: [proficiencySkill('habil-pericia', s)] }))),
      officialHandler('versatil', 'grant-feat', { category: 'origin', playerChoice: true }),
      manual('versatil-texto', 'Você adquire um talento de Origem à sua escolha (veja o capítulo 5). Habilidoso é recomendado.'),
      sizeChoiceMediumOrSmall(),
    ],
  },
  {
    nome: 'Orc',
    size: 'medium',
    speed: 9,
    effects: () => [
      resource('pico-de-adrenalina-usos', 'pico-de-adrenalina', 'proficiency-bonus', 'short-rest'),
      manual('pico-de-adrenalina', 'Você pode executar a ação Correr como Ação Bônus; ao fazê-lo, ganha PV Temporários iguais ao Bônus de Proficiência. Usos iguais ao Bônus de Proficiência, restaurados em Descanso Curto ou Longo.'),
      darkvision('visao-no-escuro', 36),
      resource('vigor-implacavel-usos', 'vigor-implacavel', 1, 'long-rest'),
      manual('vigor-implacavel', 'Ao ser reduzido a 0 PV sem morrer imediatamente, você fica com 1 PV. Só de novo após um Descanso Longo.'),
    ],
  },
  {
    nome: 'Pequenino',
    size: 'small',
    speed: 9,
    effects: () => [
      manual('corajoso', 'Você tem Vantagem nas salvaguardas contra a condição Amedrontado.'),
      manual('agilidade-pequenina', 'Você pode se mover pelo espaço de qualquer criatura um tamanho maior que você, mas não pode parar no mesmo espaço.'),
      manual('sorte', 'Ao tirar 1 no d20 de um Teste de D20, você pode jogar novamente e deve usar a nova jogada.'),
      manual('furtividade-natural', 'Você pode executar a ação Esconder mesmo encoberto apenas por uma criatura pelo menos um tamanho maior que você.'),
    ],
  },
  {
    nome: 'Tiferino',
    size: 'medium',
    sizeChoice: true,
    speed: 9,
    effects: () => [
      darkvision('visao-no-escuro', 18),
      choiceEffect(
        'legado-infero',
        'Escolha seu Legado Ínfero',
        1,
        1,
        [
          {
            id: 'abissal',
            label: 'Abissal',
            grants: [
              resistance('legado-resistencia', 'Venenoso'),
              grantSpell('legado-truque', 'Rajada de Veneno', true),
              grantSpell('legado-nivel3', 'Raio Nauseante', true, levelAtLeast(3)),
              grantSpell('legado-nivel5', 'Paralisar Pessoa', true, levelAtLeast(5)),
            ],
          },
          {
            id: 'ctonico',
            label: 'Ctônico',
            grants: [
              resistance('legado-resistencia', 'Necrótico'),
              grantSpell('legado-truque', 'Toque Necrótico', true),
              grantSpell('legado-nivel3', 'Vitalidade Vazia', true, levelAtLeast(3)),
              grantSpell('legado-nivel5', 'Raio do Enfraquecimento', true, levelAtLeast(5)),
            ],
          },
          {
            id: 'infernal',
            label: 'Infernal',
            grants: [
              resistance('legado-resistencia', 'Ígneo'),
              grantSpell('legado-truque', 'Raio de Fogo', true),
              grantSpell('legado-nivel3', 'Repreensão Diabólica', true, levelAtLeast(3)),
              grantSpell('legado-nivel5', 'Escuridão', true, levelAtLeast(5)),
            ],
          },
        ],
      ),
      manual('legado-infero-atributo', 'Inteligência, Sabedoria ou Carisma é seu atributo de conjuração para as magias do Legado Ínfero (escolha ao selecionar o legado); as magias de nível 3/5 estão sempre preparadas, conjuráveis uma vez sem espaço de magia (restaura em Descanso Longo).'),
      grantSpell('presenca-sobrenatural', 'Taumaturgia', true),
      manual('presenca-sobrenatural-texto', 'Você conhece o truque Taumaturgia; ao conjurar com este traço, a magia usa o mesmo atributo de conjuração do Legado Ínfero.'),
      sizeChoiceMediumOrSmall(),
    ],
  },
  {
    nome: 'Kenku',
    size: 'medium',
    sizeChoice: true,
    speed: 9,
    effects: () => [
      manual('duplicacao-especialista', 'Ao copiar uma escrita ou trabalho artesanal, você tem Vantagem em testes de habilidade para produzir uma cópia exata.'),
      choiceEffect(
        'memoria-kenku',
        'Escolha 2 perícias para a Memória Kenku',
        2,
        2,
        ABILITY_SKILLS_ALL.map((s) => ({ id: slugify(s), label: s, grants: [proficiencySkill('memoria-kenku-pericia', s)] })),
      ),
      resource('memoria-kenku-usos', 'memoria-kenku-vantagem', 'proficiency-bonus', 'long-rest'),
      manual('memoria-kenku-texto', 'Ao fazer um teste de habilidade com perícia em que tem proficiência, você pode se dar Vantagem antes de rolar; usos iguais ao Bônus de Proficiência, restaurados em Descanso Longo.'),
      manual('mimetismo', 'Você pode imitar com precisão sons que ouviu, incluindo vozes. Uma criatura só percebe a imitação com um teste de Sabedoria (Intuição) bem-sucedido (CD 8 + Bônus de Proficiência + modificador de Carisma).'),
      sizeChoiceMediumOrSmall(),
    ],
  },
];

const ABILITY_SKILLS_ALL = ['Acrobacia', 'Arcanismo', 'Atletismo', 'Atuação', 'Enganação', 'Furtividade', 'História', 'Intimidação', 'Intuição', 'Investigação', 'Lidar com Animais', 'Medicina', 'Natureza', 'Percepção', 'Persuasão', 'Prestidigitação', 'Religião', 'Sobrevivência'];

/**
 * Constrói a entidade `species` a partir de uma linha de `SPECIES_TABLE`.
 * @param {object} entry
 * @returns {object}
 */
function buildSpeciesEntity(entry) {
  const legado = LEGACY_SPECIES_BY_NAME.get(entry.nome);
  return {
    id: speciesId(entry.nome),
    type: 'species',
    schemaVersion: SCHEMA_VERSION,
    name: entry.nome,
    description: legado.descricao,
    source: { book: SOURCE_BOOK },
    size: entry.size,
    speed: entry.speed,
    // DÍVIDA TEMPORÁRIA (Task 23b) — ver a `description` de
    // `legacyPresentation` em dados/schemas/v1/species.schema.json. Cópia
    // verbatim, sem reconciliação com os efeitos construídos acima.
    legacyPresentation: {
      tracos: structuredClone(legado.tracos),
      ...(typeof legado.texto_completo === 'string' && legado.texto_completo.length > 0
        ? { texto_completo: legado.texto_completo }
        : {}),
    },
    effects: entry.effects(),
  };
}

let LEGACY_SPECIES_BY_NAME;
let LEGACY_BACKGROUNDS_BY_NAME;
let LEGACY_FEATS_BY_NAME;
let LEGACY_ARMADURAS;
let LEGACY_ARMAS;

// -----------------------------------------------------------------------
// Conversão de mecânicas de site/js/talentos-effects.js e
// site/js/regras-cobertura.js (LEGADO, nunca reescrito por este script) em
// efeitos estruturados do vocabulário fechado — passivos numéricos viram
// `modifier`/`defense`, proficiências de categoria viram um `proficiency`
// por item real da categoria (`dados/equipamento/{armaduras,armas}.json`
// já têm um campo `categoria` estruturado — Leve/Média/Pesada,
// Armas Simples/Marciais — não é inferência de prosa: é o mesmo tipo de
// campo estruturado que `migrate-classes.mjs` já usa para dado de vida/
// atributo primário/etc.), e escolhas exigidas por `REGRAS_TALENTOS` viram
// efeitos `choice` reais (mesmo quando a opção escolhida não pode ainda
// gravar um efeito computável — ex.: atributo de conjuração — caso em que a
// opção fica com `grants: []`, o mesmo padrão já usado por
// `migrate-classes.mjs` para a opção "110 PO" de equipamento inicial).

/**
 * Proficiência com TODAS as armaduras de uma categoria legada (Leve/Média/
 * Pesada), uma por item real reservado — não uma referência a uma
 * "categoria" inexistente como entidade.
 * @param {string} categoriaLegada
 * @returns {object[]}
 */
function armorCategoryProficiencyEffects(categoriaLegada) {
  const itens = LEGACY_ARMADURAS.filter((a) => a.categoria === categoriaLegada);
  if (itens.length === 0) throw new Error(`migrate-origins-feats: nenhuma armadura legada com categoria "${categoriaLegada}".`);
  return itens.map((a) => ({ id: `treinamento-armadura-${slugify(a.nome)}`, type: 'proficiency', target: armorRefId(a.nome), level: 'proficient' }));
}

/** Proficiência com o Escudo (item de armadura próprio, categoria "Escudo"). */
function shieldProficiencyEffect() {
  return { id: 'treinamento-escudo', type: 'proficiency', target: armorRefId('Escudo'), level: 'proficient' };
}

/**
 * Proficiência com TODAS as armas cuja categoria legada começa com o
 * prefixo dado ("Armas Simples"/"Armas Marciais", que cobre corpo-a-corpo e
 * à distância), uma por item real reservado.
 * @param {string} prefixoCategoria
 * @returns {object[]}
 */
function weaponCategoryProficiencyEffects(prefixoCategoria) {
  const itens = LEGACY_ARMAS.filter((a) => a.categoria.startsWith(prefixoCategoria));
  if (itens.length === 0) throw new Error(`migrate-origins-feats: nenhuma arma legada com categoria iniciando em "${prefixoCategoria}".`);
  return itens.map((a) => ({ id: `proficiencia-arma-${slugify(a.nome)}`, type: 'proficiency', target: weaponRefId(a.nome), level: 'proficient' }));
}

/**
 * Choice de "atributo de conjuração" (Inteligência/Sabedoria/Carisma),
 * exigida por `REGRAS_TALENTOS` para Iniciado em Magia/Tocado Por Fadas/
 * Tocado Pelas Sombras/Conjurador Ritualista. Sem um alvo de modifier para
 * "atributo de conjuração de talento" no vocabulário fechado hoje, cada
 * opção fica com `grants: []` (mesmo padrão de
 * `migrate-classes.mjs`/opção "110 PO") — a escolha em si é estruturada
 * (id estável, não texto), o que já resolve a lacuna apontada na revisão
 * (a escolha existia só como prosa em `manual`).
 * @param {string} id
 */
function spellcastingAbilityChoice(id) {
  return choiceEffect(id, 'Escolha o atributo de conjuração (Inteligência, Sabedoria ou Carisma)', 1, 1, [
    { id: 'inteligencia', label: 'Inteligência', grants: [] },
    { id: 'sabedoria', label: 'Sabedoria', grants: [] },
    { id: 'carisma', label: 'Carisma', grants: [] },
  ]);
}

const SKILL_EXPERTISE_ENERGY_TYPES = ['Ácido', 'Elétrico', 'Gélido', 'Ígneo', 'Necrótico', 'Psíquico', 'Radiante', 'Trovejante', 'Venenoso'];

/**
 * Escolha de 2 tipos de dano distintos, cada um concedendo Resistência real
 * (`defense` effect) — converte `REGRAS_TALENTOS['Dádiva da Resistência à
 * Energia'].escolhas: ['energias_distintas']`, hoje só descrito em prosa.
 */
function energyResistanceChoice() {
  return choiceEffect(
    'resistencias-de-energia',
    'Escolha 2 tipos de dano distintos para Resistência',
    2,
    2,
    SKILL_EXPERTISE_ENERGY_TYPES.map((tipo) => ({ id: slugify(tipo), label: tipo, grants: [resistance('resistencia-escolhida', tipo)] })),
  );
}

/**
 * Escolha de 1 perícia entre as 18, concedendo proficiência no nível dado
 * ("proficient" ou "expertise") — converte as escolhas `pericia_proficiencia`/
 * `pericia_expertise` de `REGRAS_TALENTOS` (Especialista em Perícia, Dádiva
 * da Proficiência em Perícia), hoje só descritas em prosa `manual`.
 * @param {string} id
 * @param {string} prompt
 * @param {'proficient'|'expertise'} level
 */
function skillChoiceEffect(id, prompt, level) {
  return choiceEffect(id, prompt, 1, 1, ABILITY_SKILLS_ALL.map((s) => ({ id: slugify(s), label: s, grants: [proficiencySkill('pericia', s, level)] })));
}

/**
 * Escolha de um atributo SEM proficiência em salvaguarda, concedendo essa
 * proficiência — converte `REGRAS_TALENTOS['Resiliente'].escolhas:
 * ['atributo_salvaguarda']`. `proficiencyTargetRef` já inclui `ability` na
 * união fechada (skill|ability|weapon|armor|equipment), então isto usa o
 * vocabulário existente, sem precisar de um novo tipo de efeito.
 */
function savingThrowProficiencyChoice() {
  return choiceEffect(
    'salvaguarda-de-atributo',
    'Escolha um atributo sem proficiência em salvaguarda para ganhar essa proficiência',
    1,
    1,
    ABILITY_NAMES.map((a) => ({ id: slugify(a), label: a, grants: [{ id: 'salvaguarda', type: 'proficiency', target: abilityId(a), level: 'proficient' }] })),
  );
}

/**
 * Efeitos estruturados adicionais por NOME de talento (chave estável, não
 * prosa), convertendo `site/js/talentos-effects.js` (passivos numéricos) e
 * `site/js/regras-cobertura.js#REGRAS_TALENTOS` (escolhas obrigatórias)
 * para o vocabulário fechado. Aplicados DEPOIS do loop de benefícios em
 * `buildFeatEntity` — o texto `manual` de cada benefício continua presente
 * (nada é substituído), isto só ENRIQUECE com o efeito estruturado
 * equivalente.
 */
const FEAT_EXTRA_EFFECTS = {
  // --- site/js/talentos-effects.js: passivos numéricos ---
  Alerta: () => [{ id: 'bonus-iniciativa', type: 'modifier', target: 'initiative', operation: 'add', value: 'proficiency-bonus' }],
  'Especialista em Armaduras Leves': () => [...armorCategoryProficiencyEffects('Leve'), shieldProficiencyEffect()],
  'Especialista em Armaduras Médias': () => armorCategoryProficiencyEffects('Média'),
  'Especialista em Armaduras Pesadas': () => armorCategoryProficiencyEffects('Pesada'),
  'Treinamento com Armas Marciais': () => weaponCategoryProficiencyEffects('Armas Marciais'),
  Velocista: () => [{ id: 'bonus-deslocamento', type: 'modifier', target: 'speed', operation: 'add', value: 3 }],
  Sorrateiro: () => [{ id: 'blindsight-3m', type: 'modifier', target: 'senses.blindsight', operation: 'set', value: 3 }],
  'Luta às Cegas': () => [{ id: 'blindsight-3m', type: 'modifier', target: 'senses.blindsight', operation: 'set', value: 3 }],
  Arquearia: () => [{ id: 'bonus-ataque-distancia', type: 'modifier', target: 'attack.ranged', operation: 'add', value: 2 }],
  Duelismo: () => [{ id: 'bonus-dano-uma-mao', type: 'modifier', target: 'damage.one-handed-melee', operation: 'add', value: 2 }],
  'Combate com Armas de Arremesso': () => [{ id: 'bonus-dano-arremesso', type: 'modifier', target: 'damage.thrown', operation: 'add', value: 2 }],
  Defensivo: () => [{ id: 'bonus-ca', type: 'modifier', target: 'ac', operation: 'add', value: 1 }],
  'Dádiva da Visão Verdadeira': () => [{ id: 'truesight-18m', type: 'modifier', target: 'senses.truesight', operation: 'set', value: 18 }],
  'Dádiva da Velocidade': () => [{ id: 'agilidade-deslocamento', type: 'modifier', target: 'speed', operation: 'add', value: 9 }],

  // --- site/js/regras-cobertura.js: REGRAS_TALENTOS (escolhas obrigatórias) ---
  'Especialista em Perícia': () => [
    skillChoiceEffect('pericia-proficiencia', 'Escolha uma perícia em que ainda não tem proficiência', 'proficient'),
    skillChoiceEffect('pericia-expertise', 'Escolha uma perícia proficiente para Especialização', 'expertise'),
  ],
  Resiliente: () => [savingThrowProficiencyChoice()],
  'Iniciado em Magia': () => [spellcastingAbilityChoice('atributo-de-conjuracao')],
  'Tocado Por Fadas': () => [spellcastingAbilityChoice('atributo-de-conjuracao'), grantSpell('magia-feerica-fixa', 'Passo Nebuloso', true)],
  'Tocado Pelas Sombras': () => [spellcastingAbilityChoice('atributo-de-conjuracao'), grantSpell('magia-sombria-fixa', 'Invisibilidade', true)],
  'Conjurador Ritualista': () => [spellcastingAbilityChoice('atributo-de-conjuracao')],
  'Dádiva da Proficiência em Perícia': () => [skillChoiceEffect('pericia-expertise', 'Escolha uma perícia proficiente para Especialização', 'expertise')],
  'Dádiva da Resistência à Energia': () => [energyResistanceChoice()],
};

// -----------------------------------------------------------------------
// ANTECEDENTES (16) — dados/origens/antecedentes.json
// -----------------------------------------------------------------------
// Pool de idiomas adicionais é IDÊNTICO nos 16 antecedentes legados
// (conferido campo a campo na leitura do arquivo) — extraído uma única vez,
// não é inferência: é o mesmo array literal repetido em cada entrada.
const LANGUAGE_CHOICE_POOL = ['Língua de Sinais Comum', 'Dracônico', 'Anão', 'Élfico', 'Gigante', 'Gnômico', 'Goblin', 'Pequenino', 'Orc'];

function additionalLanguageChoice(count) {
  return choiceEffect(
    'idiomas-adicionais',
    `Escolha ${count} idioma(s) adicional(is)`,
    count,
    count,
    LANGUAGE_CHOICE_POOL.map((nome) => ({ id: slugify(nome), label: nome, grants: [language('idioma-adicional', nome)] })),
  );
}

/**
 * Separa o texto legado de equipamento, que segue SEMPRE o template literal
 * fixo "*Escolha A ou B:* (A) <descrição A>; ou (B) <descrição B>" nas 16
 * entradas de antecedente (conferido por leitura direta do arquivo) — não é
 * uma extração de regra a partir de prosa livre, é o parse de um template
 * autoral fixo e 100% consistente. Lança se o template não bater, para
 * nunca produzir um split silenciosamente errado.
 * @param {string} texto
 * @returns {{a: string, b: string}}
 */
function splitEquipmentTemplate(texto) {
  const match = /^\*Escolha A ou B:\* \(A\) (.+); ou \(B\) (.+)$/.exec(texto.trim());
  if (!match) {
    throw new Error(`migrate-origins-feats: template de equipamento inesperado: "${texto}"`);
  }
  return { a: match[1], b: match[2] };
}

// Talento de Origem concedido por cada antecedente (`talento` legado) e,
// quando o talento é "Iniciado em Magia", a lista de magias pré-selecionada
// pelo próprio texto legado (entre parênteses no nome do talento) — autorado
// à mão a partir da leitura de `dados/origens/antecedentes.json`.
const BACKGROUND_FEAT_TABLE = {
  Acólito: { feat: 'Iniciado em Magia', presetSpellList: 'Clérigo' },
  Andarilho: { feat: 'Sortudo' },
  Artesão: { feat: 'Artifista' },
  Artista: { feat: 'Músico' },
  Charlatão: { feat: 'Habilidoso' },
  Criminoso: { feat: 'Alerta' },
  Eremita: { feat: 'Curandeiro' },
  Escriba: { feat: 'Habilidoso' },
  Fazendeiro: { feat: 'Vigoroso' },
  Guarda: { feat: 'Alerta' },
  Guia: { feat: 'Iniciado em Magia', presetSpellList: 'Druida' },
  Marinheiro: { feat: 'Valentão de Taverna' },
  Mercador: { feat: 'Sortudo' },
  Nobre: { feat: 'Habilidoso' },
  Sábio: { feat: 'Iniciado em Magia', presetSpellList: 'Mago' },
  Soldado: { feat: 'Atacante Selvagem' },
};

// Resolução de itens de equipamento inicial (`dados/origens/antecedentes.json
// #equipamento`, opção A) para ids REAIS já reservados
// (`tests/fixtures/content/dnd2024-id-inventory.json` — 82 equipamentos, 38
// armas, 13 armaduras). Chave = nome do item já sem quantidade nem
// parênteses (autorado à mão a partir da leitura das 16 listas de
// equipamento legadas — não é regex de inferência de mecânica, é o mesmo
// tipo de tabela de tradução nome->id que `content-id-map.mjs#slugify` já
// formaliza para o resto do pacote). `null` = item sem id reservado hoje
// (ferramenta/instrumento/kit de jogo — ver concern da Task 9) ou nome que
// não bate literalmente com nenhum item reservado (ex.: "Balde de Ferro"
// vs. o "Balde" reservado) — nesses casos o item permanece só na prosa
// `manual` (nunca inventamos um id).
const EQUIPMENT_ITEM_LOOKUP = {
  Livro: () => equipmentRefId('Livro'),
  'Símbolo Sagrado': () => equipmentRefId('Símbolo Sagrado'),
  Pergaminho: () => equipmentRefId('Pergaminho'),
  Túnica: () => equipmentRefId('Túnica'),
  Adaga: () => weaponRefId('Adaga'),
  Adagas: () => weaponRefId('Adaga'),
  Algibeira: () => equipmentRefId('Algibeira'),
  Algibeiras: () => equipmentRefId('Algibeira'),
  'Roupas de Viagem': () => equipmentRefId('Roupas, Viagem'),
  'Saco de Dormir': () => equipmentRefId('Saco de Dormir'),
  Espelho: () => equipmentRefId('Espelho'),
  Fantasia: () => equipmentRefId('Roupas, Fantasia'),
  Fantasias: () => equipmentRefId('Roupas, Fantasia'),
  Perfume: () => equipmentRefId('Perfume'),
  'Roupas Finas': () => equipmentRefId('Roupas, Finas'),
  'Pé de Cabra': () => equipmentRefId('Pé de Cabra'),
  Cajado: () => weaponRefId('Cajado'),
  Lâmpada: () => equipmentRefId('Lâmpada'),
  Óleo: () => equipmentRefId('Óleo'),
  Foice: () => weaponRefId('Foice'),
  'Kit de Curandeiro': () => equipmentRefId('Kit de Curandeiro'),
  Pá: () => equipmentRefId('Pá'),
  Lança: () => weaponRefId('Lança'),
  'Besta Leve': () => weaponRefId('Besta Leve'),
  Aljava: () => equipmentRefId('Aljava'),
  Grilhões: () => equipmentRefId('Grilhões'),
  'Lanterna Coberta': () => equipmentRefId('Lanterna Coberta'),
  'Arco Curto': () => weaponRefId('Arco Curto'),
  Tenda: () => equipmentRefId('Tenda'),
  Corda: () => equipmentRefId('Corda'),
  // Sem id reservado hoje (ferramenta/instrumento/kit de jogo/munição
  // avulsa/nome divergente do reservado) — permanecem só em `manual`.
  'Suprimentos de Calígrafo': null,
  'Ferramentas de Ladrão': null,
  'Kit de Jogos': null,
  'Kit de Jogo': null,
  'Ferramentas de Artesão': null,
  'Instrumento Musical': null,
  'Kit de Falsificação': null,
  'Kit de Herbalismo': null,
  'Ferramentas de Carpinteiro': null,
  'Balde de Ferro': null,
  Virotes: null,
  Flechas: null,
  'Ferramentas de Cartógrafo': null,
  'Ferramentas de Navegador': null,
};

/**
 * Separa uma opção de equipamento inicial (já sem o prefixo "(A)"/"(B)") em
 * menções de item individuais, isolando o valor em PO no final se houver —
 * o mesmo tipo de parse de template fixo (separador ", ") já documentado em
 * `splitEquipmentTemplate`.
 * @param {string} texto
 * @returns {{mentions: string[], coin: string|null}}
 */
function splitEquipmentMentions(texto) {
  const partes = texto.split(', ').map((s) => s.trim());
  const ultima = partes[partes.length - 1];
  const moedaMatch = /^(\d+)\s*PO$/.exec(ultima);
  if (moedaMatch) {
    return { mentions: partes.slice(0, -1), coin: ultima };
  }
  return { mentions: partes, coin: null };
}

/**
 * Resolve uma menção de item ("2 Adagas", "Livro (orações)", ...) para um
 * `grant-item` estruturado quando o nome (sem quantidade/parênteses) bate
 * literalmente com um item em `EQUIPMENT_ITEM_LOOKUP`; devolve `null`
 * quando não há id reservado para o item (nunca inventa um).
 * @param {string} mencao
 * @returns {{ref: string, quantity: number}|null}
 */
function resolveEquipmentMention(mencao) {
  const qtyMatch = /^(\d+)\s+(.*)$/.exec(mencao);
  const quantidade = qtyMatch ? Number(qtyMatch[1]) : 1;
  const semQuantidade = qtyMatch ? qtyMatch[2] : mencao;
  const semParenteses = semQuantidade.replace(/\s*\([^)]*\)\s*$/, '').trim();
  const resolver = EQUIPMENT_ITEM_LOOKUP[semParenteses];
  if (typeof resolver !== 'function') return null;
  return { ref: resolver(), quantity: quantidade };
}

/**
 * Constrói os efeitos de uma opção de equipamento inicial: um `grant-item`
 * real por item que resolve contra o inventário reservado, e um `manual`
 * com o texto completo original (documental — preserva também os itens que
 * não resolvem: ferramentas/instrumentos/kits sem id reservado e o valor em
 * PO, que `effect.schema.json` não tem vocabulário para representar como
 * moeda estruturada — ver concern da Task 9).
 * @param {string} textoOpcao
 * @returns {object[]}
 */
function equipmentOptionEffects(textoOpcao) {
  const { mentions, coin } = splitEquipmentMentions(textoOpcao);
  const efeitos = [manual('opcao-detalhe', textoOpcao)];
  mentions.forEach((mencao, i) => {
    const resolvido = resolveEquipmentMention(mencao);
    if (resolvido) {
      efeitos.push({ id: `item-${i}`, type: 'grant-item', item: resolvido.ref, ...(resolvido.quantity > 1 ? { quantity: resolvido.quantity } : {}) });
    }
  });
  if (coin) {
    efeitos.push(manual('moeda', `${coin} (sem vocabulário de moeda estruturada em effect.schema.json hoje — ver concern da Task 9).`));
  }
  return efeitos;
}

/**
 * Constrói a entidade `background` a partir de uma linha legada de
 * `dados/origens/antecedentes.json`.
 * @param {object} legado
 * @returns {object}
 */
function buildBackgroundEntity(legado) {
  const abilities = legado.valores_atributo.split(',').map((s) => s.trim());
  const [skillA, skillB] = legado.pericias.split(',').map((s) => s.trim());
  const { a: equipA, b: equipB } = splitEquipmentTemplate(legado.equipamento);
  const grantedFeat = BACKGROUND_FEAT_TABLE[legado.nome];
  if (!grantedFeat) throw new Error(`migrate-origins-feats: antecedente "${legado.nome}" sem talento mapeado em BACKGROUND_FEAT_TABLE.`);

  const effects = [
    backgroundAbilityScoreChoice(abilities),
    proficiencySkill('pericia-1', skillA),
    proficiencySkill('pericia-2', skillB),
    language('idioma-comum', 'Comum'),
    additionalLanguageChoice(legado.idiomas_adicionais),
  ];

  // Ferramenta/instrumento: fixa (proficiência direta, sem categoria de
  // escolha) ou "Escolha um tipo de X" (categoria). Nenhum id de equipment
  // de ferramenta/instrumento/kit está reservado em
  // tests/fixtures/content/dnd2024-id-inventory.json (só equipamento geral
  // de aventura) — por isso a proficiência de ferramenta fica como `manual`
  // até uma tarefa futura reservar esses ids (ver relatório da Task 9).
  effects.push(manual('proficiencia-ferramenta', `Proficiência: ${legado.ferramentas}`));

  effects.push(
    choiceEffect('equipamento-inicial', 'Escolha seu equipamento inicial', 1, 1, [
      { id: 'opcao-a', label: equipA, grants: equipmentOptionEffects(equipA) },
      { id: 'opcao-b', label: equipB, grants: equipmentOptionEffects(equipB) },
    ]),
  );

  // Talento de Origem concedido pelo antecedente: usa o mesmo escape hatch
  // `official-handler` já estabelecido pela Task 8 (`asi-or-feat`, escolha
  // classe ASI-ou-talento) — conceder um talento inteiro requer instanciar
  // os efeitos de outra entidade, mecânica além do que o vocabulário
  // declarativo fechado modela hoje (feat.schema.json não tem um campo
  // dedicado para isso, ver nota da Task 9 no relatório).
  effects.push(
    officialHandler(
      'talento-de-origem',
      'grant-feat',
      grantedFeat.presetSpellList
        ? { featId: featId(grantedFeat.feat), presetChoices: { 'lista-de-magias': slugify(grantedFeat.presetSpellList) } }
        : { featId: featId(grantedFeat.feat) },
    ),
  );

  return {
    id: backgroundId(legado.nome),
    type: 'background',
    schemaVersion: SCHEMA_VERSION,
    name: legado.nome,
    description: legado.descricao,
    source: { book: SOURCE_BOOK },
    abilityScoreOptions: abilities.map((a) => abilityId(a)),
    // DÍVIDA TEMPORÁRIA (Task 23b) — ver a `description` de
    // `legacyPresentation` em dados/schemas/v1/background.schema.json. Só os
    // dois campos que o catálogo realmente não modela: perícias, idiomas e
    // equipamento seguem derivados dos efeitos acima pela projeção.
    legacyPresentation: { ferramentas: legado.ferramentas, talento: legado.talento },
    effects,
  };
}

// -----------------------------------------------------------------------
// TALENTOS (75) — dados/talentos/talentos.json
// -----------------------------------------------------------------------

const FEAT_CATEGORY_MAP = {
  'de Origem': 'origin',
  Geral: 'general',
  'de Estilo de Luta': 'fighting-style',
  'de Dádiva Épica': 'epic-boon',
};

// Habilidades elegíveis para o benefício "Aumento no Valor de Atributo" de
// cada talento Geral/Dádiva Épica, autorado à mão a partir da leitura de
// cada `descricao` de benefício (nunca extraído por regex em runtime).
// 'any' = qualquer uma das 6.
const ASI_TABLE = {
  'Adepto Elemental': ['Inteligência', 'Sabedoria', 'Carisma'],
  Agressor: ['Força', 'Destreza'],
  Analítico: ['Inteligência', 'Sabedoria'],
  'Atirador Arcano': ['Inteligência', 'Sabedoria', 'Carisma'],
  Atleta: ['Força', 'Destreza'],
  Ator: ['Carisma'],
  Chef: ['Constituição', 'Sabedoria'],
  'Combatente Montado': ['Força', 'Destreza', 'Sabedoria'],
  'Conjurador Bélico': ['Inteligência', 'Sabedoria', 'Carisma'],
  'Conjurador Ritualista': ['Inteligência', 'Sabedoria', 'Carisma'],
  'Duelista Defensivo': ['Destreza'],
  Envenenador: ['Destreza', 'Inteligência'],
  Esmagador: ['Força', 'Constituição'],
  'Especialista Ambidestro': ['Força', 'Destreza'],
  'Especialista em Armaduras Leves': ['Força', 'Destreza'],
  'Especialista em Armaduras Médias': ['Força', 'Destreza'],
  'Especialista em Armaduras Pesadas': ['Constituição', 'Força'],
  'Especialista em Besta': ['Destreza'],
  'Especialista em Perícia': ABILITY_NAMES,
  'Exterminador de Conjuradores': ['Força', 'Destreza'],
  Imobilizador: ['Força', 'Destreza'],
  'Líder Inspirador': ['Sabedoria', 'Carisma'],
  'Mente Aguçada': ['Inteligência'],
  'Mestre das Armas': ['Força', 'Destreza'],
  'Mestre em Armaduras Médias': ['Força', 'Destreza'],
  'Mestre em Armaduras Pesadas': ['Força', 'Constituição'],
  'Mestre em Armas de Haste': ['Força', 'Destreza'],
  'Mestre em Armas Grandes': ['Força'],
  'Mestre em Escudos': ['Força'],
  'Mestre-Atirador': ['Destreza'],
  Perfurador: ['Força', 'Destreza'],
  Resiliente: ABILITY_NAMES,
  Resistente: ['Constituição'],
  Sentinela: ['Força', 'Destreza'],
  Sorrateiro: ['Destreza'],
  Talhador: ['Força', 'Destreza'],
  Telecinético: ['Inteligência', 'Sabedoria', 'Carisma'],
  Telepático: ['Inteligência', 'Sabedoria', 'Carisma'],
  'Tocado Pelas Sombras': ['Inteligência', 'Sabedoria', 'Carisma'],
  'Tocado Por Fadas': ['Inteligência', 'Sabedoria', 'Carisma'],
  'Treinamento com Armas Marciais': ['Força', 'Destreza'],
  Velocista: ['Destreza', 'Constituição'],
  'Dádiva da Fortitude': ABILITY_NAMES,
  'Dádiva da Proeza em Combate': ABILITY_NAMES,
  'Dádiva da Proficiência em Perícia': ABILITY_NAMES,
  'Dádiva da Recordação de Magia': ['Inteligência', 'Sabedoria', 'Carisma'],
  'Dádiva da Recuperação': ABILITY_NAMES,
  'Dádiva da Resistência à Energia': ABILITY_NAMES,
  'Dádiva da Velocidade': ABILITY_NAMES,
  'Dádiva da Viagem Dimensional': ABILITY_NAMES,
  'Dádiva da Visão Verdadeira': ABILITY_NAMES,
  'Dádiva do Ataque Irresistível': ['Força', 'Destreza'],
  'Dádiva do Destino': ABILITY_NAMES,
  'Dádiva do Espírito da Noite': ABILITY_NAMES,
};

// "Aumento no Valor de Atributo" standalone (o próprio talento genérico) tem
// forma distinta (+2 em um OU +1 em dois) — tratado à parte, fora do
// ASI_TABLE acima.
const GENERIC_ASI_FEAT_NAME = 'Aumento no Valor de Atributo';

function genericAsiChoice() {
  const plus2Options = ABILITY_NAMES.map((a) => {
    const slug = slugify(a);
    return {
      id: `${slug}-mais2`,
      label: `${a} +2`,
      grants: [modifierEffect(`asi-${slug}-add`, `ability.${slug}.score`, 'add', 2), modifierEffect(`asi-${slug}-teto`, `ability.${slug}.score`, 'max', 20)],
    };
  });
  const plus1PairOptions = [];
  for (let i = 0; i < ABILITY_NAMES.length; i += 1) {
    for (let j = i + 1; j < ABILITY_NAMES.length; j += 1) {
      const a = ABILITY_NAMES[i];
      const b = ABILITY_NAMES[j];
      const slugA = slugify(a);
      const slugB = slugify(b);
      plus1PairOptions.push({
        id: `${slugA}-mais1-${slugB}-mais1`,
        label: `${a} +1, ${b} +1`,
        grants: [
          modifierEffect(`asi-${slugA}-add`, `ability.${slugA}.score`, 'add', 1),
          modifierEffect(`asi-${slugA}-teto`, `ability.${slugA}.score`, 'max', 20),
          modifierEffect(`asi-${slugB}-add`, `ability.${slugB}.score`, 'add', 1),
          modifierEffect(`asi-${slugB}-teto`, `ability.${slugB}.score`, 'max', 20),
        ],
      });
    }
  }
  return choiceEffect('aumento-atributo', 'Aumente um atributo em 2, ou dois atributos em 1 cada (até 20)', 1, 1, [...plus2Options, ...plus1PairOptions]);
}

// Talentos Geral/Dádiva Épica cujo benefício "Repetível"/"repetibilidade"
// aparece no legado (autorado à mão a partir da leitura de cada
// `beneficios[]`).
const REPEATABLE_FEATS = new Set(['Habilidoso', 'Iniciado em Magia', 'Aumento no Valor de Atributo', 'Adepto Elemental']);

// Enriquecimento estrutural de benefícios cujo `nome` (rótulo estável, não
// prosa) identifica uma mecânica cleanly modelável no vocabulário fechado.
// Chave = `beneficio.nome`; valor = função que devolve Effect[] adicionais
// (o texto original SEMPRE também vira um efeito `manual`, então nada é
// substituído — só enriquecido).
const BENEFIT_ENRICHMENT = {
  'Observador Atento': () => [
    choiceEffect('observador-atento-pericia', 'Escolha a perícia de Observador Atento', 1, 1, [
      { id: 'intuicao', label: 'Intuição', grants: [proficiencySkill('pericia', 'Intuição')] },
      { id: 'investigacao', label: 'Investigação', grants: [proficiencySkill('pericia', 'Investigação')] },
      { id: 'percepcao', label: 'Percepção', grants: [proficiencySkill('pericia', 'Percepção')] },
    ]),
  ],
  'Conhecimento Vasto': () => [
    choiceEffect('conhecimento-vasto-pericia', 'Escolha a perícia de Conhecimento Vasto', 1, 1, [
      { id: 'arcanismo', label: 'Arcanismo', grants: [proficiencySkill('pericia', 'Arcanismo')] },
      { id: 'historia', label: 'História', grants: [proficiencySkill('pericia', 'História')] },
      { id: 'investigacao', label: 'Investigação', grants: [proficiencySkill('pericia', 'Investigação')] },
      { id: 'natureza', label: 'Natureza', grants: [proficiencySkill('pericia', 'Natureza')] },
      { id: 'religiao', label: 'Religião', grants: [proficiencySkill('pericia', 'Religião')] },
    ]),
  ],
  'Assecla Completo': () => ABILITY_SKILLS_ALL.map((s) => proficiencySkill(`skill-${slugify(s)}`, s)),
  'Dois Truques': () => [
    choiceEffect(
      'iniciado-em-magia-lista',
      'Escolha a lista de magias (Clérigo, Druida ou Mago)',
      1,
      1,
      [
        { id: 'clerigo', label: 'Clérigo', grants: [officialHandler('escolha-truques', 'choose-cantrips-from-class-list', { classe: 'Clérigo', quantidade: 2 })] },
        { id: 'druida', label: 'Druida', grants: [officialHandler('escolha-truques', 'choose-cantrips-from-class-list', { classe: 'Druida', quantidade: 2 })] },
        { id: 'mago', label: 'Mago', grants: [officialHandler('escolha-truques', 'choose-cantrips-from-class-list', { classe: 'Mago', quantidade: 2 })] },
      ],
    ),
  ],
  'Magia de 1º Círculo': () => [officialHandler('iniciado-em-magia-1o-circulo', 'choose-spell-from-class-list', { circulo: 1, ligadoAoEfeito: 'iniciado-em-magia-lista' })],
  // "Dádiva do Destino" (dnd2024:feat:dadiva-do-destino): o benefício "Aprimorar
  // Destino" é de uso único, recarregando num Descanso Curto OU Longo (texto:
  // "não pode utilizá-lo novamente até jogar Iniciativa ou completar um
  // Descanso Curto ou Longo") — modelado como recurso com `recovery:
  // "short-rest"` (Task 17, fix round 1, achado I2: sem este efeito
  // declarativo, `domain/commands/rest.js` não tem como saber que este
  // recurso recupera em descanso curto).
  'Aprimorar Destino': () => [resource('aprimorar-destino-usos', 'dadiva-destino', 1, 'short-rest')],
};

/**
 * Constrói a entidade `feat` a partir de uma linha legada de `todos[]`.
 * @param {object} legado
 * @returns {object}
 */
/**
 * Devolve `legado[campo]` exigindo que ele exista com o tipo esperado.
 *
 * Serve à regra de "nada de default plausível na migração": um campo de
 * apresentação ausente no legado tem de estourar a conversão, nunca virar
 * `''`/`[]` silenciosamente — o valor vazio só é legítimo quando é o próprio
 * arquivo legado que o escreve.
 * @param {object} legado
 * @param {string} campo
 * @param {'string'|'array'} tipo
 * @returns {*}
 */
function assertCampoLegado(legado, campo, tipo) {
  const valor = legado[campo];
  const ok = tipo === 'array' ? Array.isArray(valor) : typeof valor === tipo;
  if (!ok) {
    throw new Error(
      `migrate-origins-feats: "${legado.nome}" não tem o campo legado "${campo}" (${tipo}) exigido por legacyPresentation.`,
    );
  }
  return valor;
}

function buildFeatEntity(legado) {
  const category = FEAT_CATEGORY_MAP[legado.categoria];
  if (!category) throw new Error(`migrate-origins-feats: categoria legada desconhecida "${legado.categoria}" (talento "${legado.nome}").`);

  const prerequisites = [];
  const levelMatch = /Nível (\d+) ou superior/.exec(legado.prerequisito ?? '');
  if (levelMatch) prerequisites.push(levelAtLeast(Number(levelMatch[1])));

  const effects = [];
  const isEpicBoon = category === 'epic-boon';

  for (const beneficio of legado.beneficios) {
    if (beneficio.nome === 'Repetível') continue; // vira feat.repeatable, não efeito
    if (beneficio.nome === GENERIC_ASI_FEAT_NAME && legado.nome === GENERIC_ASI_FEAT_NAME) continue; // tratado abaixo
    if (beneficio.nome === 'Aumento no Valor de Atributo' && legado.nome !== GENERIC_ASI_FEAT_NAME) {
      const abilities = ASI_TABLE[legado.nome];
      if (!abilities) throw new Error(`migrate-origins-feats: talento "${legado.nome}" com benefício ASI sem entrada em ASI_TABLE.`);
      effects.push(asiChoice(abilities, isEpicBoon ? 30 : 20));
      continue;
    }
    const idBase = slugify(beneficio.nome);
    effects.push(manual(idBase, beneficio.descricao));
    const enrich = BENEFIT_ENRICHMENT[beneficio.nome];
    if (enrich) effects.push(...enrich());
  }

  if (legado.nome === GENERIC_ASI_FEAT_NAME) {
    effects.push(genericAsiChoice());
  }

  // Fallback: talentos de Estilo de Luta e alguns de Origem (Atacante
  // Selvagem, Vigoroso) não têm `beneficios[]`; outros (Habilidoso) têm só
  // um benefício "Repetível" (pulado acima). Em ambos os casos a mecânica
  // real mora inteira no campo de topo `descricao`. Checado DEPOIS do loop
  // (não antes) para cobrir os dois casos com uma condição só — sem isso o
  // efeito seria perdido silenciosamente (o mesmo anti-padrão que a revisão
  // da Task 8 pegou duas vezes: efeito descartado sem aviso).
  if (effects.length === 0) {
    effects.push(manual('beneficio-principal', legado.descricao));
  }

  // Enriquecimento estrutural (site/js/talentos-effects.js +
  // site/js/regras-cobertura.js#REGRAS_TALENTOS convertidos para
  // modifier/defense/proficiency/choice reais) — sempre ADICIONA, nunca
  // substitui o `manual` já empurrado acima para o mesmo benefício.
  const extra = FEAT_EXTRA_EFFECTS[legado.nome];
  if (extra) effects.push(...extra());

  // Pré-requisito: SEMPRE recuperável de algo estruturado/descoberto na
  // entidade gerada, nunca apenas silenciosamente perdido. A parte
  // numérica de nível já virou `prerequisites` (conditionExpr); aqui o
  // texto legado COMPLETO (incluindo a parte não estruturável — atributo
  // mínimo, feature exigida) sempre vira um efeito `manual` dedicado,
  // independentemente do que `descricao` diz (a revisão encontrou 10
  // talentos de Estilo de Luta cujo texto de pré-requisito não aparecia em
  // lugar nenhum da entidade porque a lógica antiga só cobria o caso em
  // que `descricao` era o placeholder genérico).
  if (legado.prerequisito) {
    effects.push(manual('pre-requisito', legado.prerequisito));
  }

  return {
    id: featId(legado.nome),
    type: 'feat',
    schemaVersion: SCHEMA_VERSION,
    name: legado.nome,
    description: legado.descricao,
    source: { book: SOURCE_BOOK },
    category,
    ...(REPEATABLE_FEATS.has(legado.nome) ? { repeatable: true } : {}),
    ...(prerequisites.length > 0 ? { prerequisites } : {}),
    // DÍVIDA TEMPORÁRIA (Task 23b) — ver a `description` de
    // `legacyPresentation` em dados/schemas/v1/feat.schema.json. Os dois
    // campos são cópia literal: os 75 talentos legados trazem os dois SEMPRE
    // (string vazia / array vazio quando não se aplica), então nada aqui é
    // default inventado — ausência inesperada lança em `assertCamposLegados`.
    legacyPresentation: {
      prerequisito: assertCampoLegado(legado, 'prerequisito', 'string'),
      beneficios: structuredClone(assertCampoLegado(legado, 'beneficios', 'array')),
    },
    effects,
  };
}

// -----------------------------------------------------------------------
// Leitura do legado + montagem dos 3 catálogos
// -----------------------------------------------------------------------

/**
 * Lê e faz o parse dos 3 arquivos legados (espécies, antecedentes,
 * talentos), nunca reescritos por este script.
 * @returns {Promise<{especies: object[], antecedentes: object[], talentos: object[]}>}
 */
async function readLegacyData() {
  const [especiesRaw, antecedentesRaw, talentosRaw, armadurasRaw, armasRaw] = await Promise.all([
    readFile(legacySpeciesPath, 'utf8'),
    readFile(legacyBackgroundsPath, 'utf8'),
    readFile(legacyFeatsPath, 'utf8'),
    readFile(legacyArmadurasPath, 'utf8'),
    readFile(legacyArmasPath, 'utf8'),
  ]);
  const especies = JSON.parse(especiesRaw).especies;
  const antecedentes = JSON.parse(antecedentesRaw).antecedentes;
  const talentos = JSON.parse(talentosRaw).todos;
  const armaduras = JSON.parse(armadurasRaw).armaduras;
  const armas = JSON.parse(armasRaw).armas;
  return { especies, antecedentes, talentos, armaduras, armas };
}

/**
 * Constrói os 3 catálogos ({schemaVersion,type,items}) em memória.
 * Nunca escreve em disco — isso é feito só pelo modo `--write` do `main`.
 * @returns {Promise<{species: object, backgrounds: object, feats: object, avisos: string[]}>}
 */
export async function construirCatalogos() {
  const { especies, antecedentes, talentos, armaduras, armas } = await readLegacyData();
  LEGACY_SPECIES_BY_NAME = new Map(especies.map((e) => [e.nome, e]));
  LEGACY_BACKGROUNDS_BY_NAME = new Map(antecedentes.map((b) => [b.nome, b]));
  LEGACY_FEATS_BY_NAME = new Map(talentos.map((f) => [f.nome, f]));
  LEGACY_ARMADURAS = armaduras;
  LEGACY_ARMAS = armas;

  const avisos = [];

  if (especies.length !== 11) avisos.push(`esperava 11 espécies no legado, encontrado ${especies.length}`);
  if (antecedentes.length !== 16) avisos.push(`esperava 16 antecedentes no legado, encontrado ${antecedentes.length}`);
  if (talentos.length !== 75) avisos.push(`esperava 75 talentos no legado, encontrado ${talentos.length}`);

  const speciesTableNames = new Set(SPECIES_TABLE.map((s) => s.nome));
  for (const nome of LEGACY_SPECIES_BY_NAME.keys()) {
    if (!speciesTableNames.has(nome)) avisos.push(`espécie legada "${nome}" não tem entrada em SPECIES_TABLE (manualReview).`);
  }

  const speciesItems = SPECIES_TABLE.map((entry) => {
    if (!LEGACY_SPECIES_BY_NAME.has(entry.nome)) throw new Error(`migrate-origins-feats: SPECIES_TABLE cita espécie legada inexistente "${entry.nome}".`);
    return buildSpeciesEntity(entry);
  });

  const backgroundItems = antecedentes.map((legado) => buildBackgroundEntity(legado));

  const featItems = talentos.map((legado) => buildFeatEntity(legado));

  return {
    species: { schemaVersion: SCHEMA_VERSION, type: 'species', items: speciesItems },
    backgrounds: { schemaVersion: SCHEMA_VERSION, type: 'background', items: backgroundItems },
    feats: { schemaVersion: SCHEMA_VERSION, type: 'feat', items: featItems },
    avisos,
  };
}

/**
 * Fragmento de índice de staging para os 3 catálogos, no mesmo formato que
 * `build-index.mjs` produziria SE `species`/`background`/`feat` já fossem
 * tipos ativos no manifesto (ainda não são — Task 9 só monta o fragmento em
 * `scripts/content/dnd2024-index-fragments/`, igual ao padrão da Task 8
 * para `classes.json`).
 * @param {{species: object, backgrounds: object, feats: object}} catalogos
 * @returns {{schemaVersion: string, entries: object[]}}
 */
export function construirFragmentoDeIndice(catalogos) {
  const entries = [];
  const arquivos = [
    { relPath: 'species/catalog.json', colecao: catalogos.species },
    { relPath: 'backgrounds/catalog.json', colecao: catalogos.backgrounds },
    { relPath: 'feats/catalog.json', colecao: catalogos.feats },
  ];
  for (const { relPath, colecao } of arquivos) {
    colecao.items.forEach((item, i) => {
      entries.push({ id: item.id, type: item.type, path: relPath, pointer: `/items/${i}` });
    });
  }
  return { schemaVersion: SCHEMA_VERSION, entries };
}

/**
 * Serializa exatamente como `--write` grava em disco (2 espaços de
 * indentação + quebra de linha final), para que `--check` compare bytes
 * idênticos.
 * @param {object} valor
 * @returns {string}
 */
function serializar(valor) {
  return `${JSON.stringify(valor, null, 2)}\n`;
}

/**
 * Modo `--check`: reconstrói tudo em memória e compara byte a byte com os
 * 3 catálogos canônicos e o fragmento de índice REALMENTE commitados em
 * disco (mesmo padrão de `migrate-classes.mjs#verificarDrift` /
 * `build-index.mjs --check`).
 * @param {{species: object, backgrounds: object, feats: object}} catalogos
 * @returns {Promise<{ok: boolean, diffs: string[]}>}
 */
export async function verificarDrift(catalogos) {
  const diffs = [];
  const alvos = [
    { destino: outputSpeciesPath, colecao: catalogos.species },
    { destino: outputBackgroundsPath, colecao: catalogos.backgrounds },
    { destino: outputFeatsPath, colecao: catalogos.feats },
  ];
  for (const { destino, colecao } of alvos) {
    const esperado = serializar(colecao);
    try {
      const atual = await readFile(destino, 'utf8');
      if (atual !== esperado) diffs.push(`${path.relative(repoRoot, destino)} está desatualizado em relação ao conversor. Rode --write.`);
    } catch (error) {
      diffs.push(`${path.relative(repoRoot, destino)} não existe (${error.code}). Rode --write.`);
    }
  }

  const fragmento = construirFragmentoDeIndice(catalogos);
  const esperadoFragmento = serializar(fragmento);
  try {
    const atualFragmento = await readFile(indexFragmentPath, 'utf8');
    if (atualFragmento !== esperadoFragmento) diffs.push(`${path.relative(repoRoot, indexFragmentPath)} está desatualizado em relação ao conversor. Rode --write.`);
  } catch (error) {
    diffs.push(`${path.relative(repoRoot, indexFragmentPath)} não existe (${error.code}). Rode --write.`);
  }

  return { ok: diffs.length === 0, diffs };
}

async function main() {
  const write = process.argv.includes('--write');
  const check = process.argv.includes('--check');
  if (write && check) throw new Error('migrate-origins-feats: use --write OU --check, não os dois.');

  const catalogos = await construirCatalogos();

  if (write) {
    await mkdir(path.dirname(outputSpeciesPath), { recursive: true });
    await mkdir(path.dirname(outputBackgroundsPath), { recursive: true });
    await mkdir(path.dirname(outputFeatsPath), { recursive: true });
    await mkdir(indexFragmentsDir, { recursive: true });

    await writeFile(outputSpeciesPath, serializar(catalogos.species), 'utf8');
    await writeFile(outputBackgroundsPath, serializar(catalogos.backgrounds), 'utf8');
    await writeFile(outputFeatsPath, serializar(catalogos.feats), 'utf8');

    const fragmento = construirFragmentoDeIndice(catalogos);
    await writeFile(indexFragmentPath, serializar(fragmento), 'utf8');

    process.stdout.write(
      `migrate-origins-feats: escrito species(${catalogos.species.items.length}), backgrounds(${catalogos.backgrounds.items.length}), feats(${catalogos.feats.items.length}), fragmento(${fragmento.entries.length}).\n`,
    );
    if (catalogos.avisos.length > 0) {
      process.stdout.write(`migrate-origins-feats: ${catalogos.avisos.length} aviso(s) não-fatal(is):\n`);
      for (const aviso of catalogos.avisos) process.stdout.write(`  - ${aviso}\n`);
    }
    return;
  }

  if (check) {
    const { ok, diffs } = await verificarDrift(catalogos);
    if (!ok) {
      process.stderr.write(`migrate-origins-feats: ${diffs.length} arquivo(s) desatualizado(s):\n`);
      for (const diff of diffs) process.stderr.write(`  - ${diff}\n`);
      process.exitCode = 1;
      return;
    }
    process.stdout.write('migrate-origins-feats: --check OK, catálogos e fragmento de índice refletem o conversor.\n');
    return;
  }

  process.stdout.write(
    `migrate-origins-feats: [staging] species(${catalogos.species.items.length}), backgrounds(${catalogos.backgrounds.items.length}), feats(${catalogos.feats.items.length}). Use --write para persistir.\n`,
  );
  if (catalogos.avisos.length > 0) {
    process.stdout.write(`migrate-origins-feats: ${catalogos.avisos.length} aviso(s) não-fatal(is):\n`);
    for (const aviso of catalogos.avisos) process.stdout.write(`  - ${aviso}\n`);
  }
}

const isDirectCliInvocation =
  typeof process.argv[1] === 'string' &&
  path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1]);
if (isDirectCliInvocation) {
  main().catch((error) => {
    process.stderr.write(`migrate-origins-feats: erro fatal: ${error.stack || error.message}\n`);
    process.exitCode = 1;
  });
}

export { modifierEffect, choiceEffect, manual, resource, proficiencySkill, grantSpell, resistance, darkvision, language, officialHandler };
