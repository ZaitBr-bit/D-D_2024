#!/usr/bin/env node
// `scripts/content/audit-classes.mjs`: auditoria de cobertura das 12
// classes / 48 subclasses migradas por `migrate-classes.mjs`.
//
// Diferente do teste de contrato (`tests/contract/dnd2024-classes.test.js`,
// que compara CONTAGENS e (nível, nome) contra a baseline extraída do
// legado), este script varre TODA referência de conteúdo emitida pelos
// efeitos gerados (skill, ability, spell, feat, ...) e confere que cada uma
// existe — seja no ruleset já ativo (skills/abilities), seja no inventário
// de ids RESERVADOS para staging (`dnd2024-id-inventory.json`), nunca
// simplesmente ignorada. Também confere presença de `description` (nunca
// usada como regra) e que os níveis 1-20 têm cobertura plausível.
//
// Uso:
//   node scripts/content/audit-classes.mjs
//     Sai com código 0 e imprime um resumo se tudo estiver ok; código
//     diferente de zero e a lista de problemas, caso contrário.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { construirTodasAsClasses, CLASS_SLUGS, verificarDrift } from './migrate-classes.mjs';
import { validateEntity } from '../../site/js/content/validation.js';
import { parseContentId } from '../../site/js/core/content-id.js';
import { loadIdInventory } from './content-id-map.mjs';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const rulesetsDir = path.join(repoRoot, 'dados', 'pacotes', 'dnd2024', 'rulesets');
const legacyClassesDir = path.join(repoRoot, 'dados', 'classes');

/**
 * Lê `dados/classes/<slug>.json#tabela_caracteristicas` e devolve o
 * conjunto de níveis 1-20 em que a coluna resumo ("Características"/
 * "Características de Classe") lista pelo menos uma característica REAL de
 * classe (não um placeholder de subclasse tipo "Característica de
 * Subclasse", nem célula vazia/"—"). É a mesma fonte de verdade usada por
 * `migrate-classes.mjs#expandirCaracteristicasPelaTabela` — comparar contra
 * ela (em vez de só checar "nível 1 e 3 existem") é o que teria pego o bug
 * de ASI só aparecer no nível 4 em vez de 4/8/12/16.
 * @param {string} slug
 * @returns {Promise<Set<number>>}
 */
async function niveisEsperadosDeClasse(slug) {
  const legado = JSON.parse(await readFile(path.join(legacyClassesDir, `${slug}.json`), 'utf8'));
  const colName = 'Características de Classe' in (legado.tabela_caracteristicas[0] || {}) ? 'Características de Classe' : 'Características';
  const niveis = new Set();
  for (const row of legado.tabela_caracteristicas) {
    const celula = (row[colName] || '').toString().trim();
    if (celula === '' || celula === '—' || celula === '-') continue;
    const nomes = celula.split(',').map((s) => s.trim()).filter(Boolean);
    const temFeatureReal = nomes.some((n) => {
      const norm = n.toLowerCase();
      return !norm.startsWith('subclasse') && !norm.startsWith('característica de subclasse');
    });
    if (temFeatureReal) niveis.add(parseInt(row['Nível'], 10));
  }
  return niveis;
}

/**
 * Carrega os ids já ATIVOS de skill/ability a partir dos rulesets
 * committed (`dados/pacotes/dnd2024/rulesets/{abilities,skills}.json`).
 * @returns {Promise<Set<string>>}
 */
async function carregarIdsAtivos() {
  const ativos = new Set();
  for (const arquivo of ['abilities.json', 'skills.json']) {
    const conteudo = JSON.parse(await readFile(path.join(rulesetsDir, arquivo), 'utf8'));
    for (const item of conteudo.items) ativos.add(item.id);
  }
  return ativos;
}

/**
 * Coleta recursivamente toda string que "parece" um ContentId
 * (`namespace:type:slug`) dentro de um valor arbitrário (efeito, escolha,
 * opção, ...), para conferência de referência. Aceita falso-positivo (ex.:
 * um `resource` slug sem ":") sendo descartado pelo parser de ContentId.
 * @param {*} valor
 * @param {Set<string>} destino
 */
function coletarPossiveisRefs(valor, destino) {
  if (typeof valor === 'string') {
    if (/^[a-z0-9-]+:[a-z0-9-]+:[a-z0-9-]+$/.test(valor)) destino.add(valor);
    return;
  }
  if (Array.isArray(valor)) {
    for (const item of valor) coletarPossiveisRefs(item, destino);
    return;
  }
  if (valor && typeof valor === 'object') {
    for (const v of Object.values(valor)) coletarPossiveisRefs(v, destino);
  }
}

async function main() {
  const problemas = [];

  const { NIVEL_SUBCLASSE } = await import('../../site/js/dados-classes.js');
  const idInventory = await loadIdInventory();
  const idsReservados = new Set();
  for (const entries of Object.values(idInventory.reserved)) {
    for (const { id } of entries) idsReservados.add(id);
  }
  const idsAtivos = await carregarIdsAtivos();

  const colecoes = await construirTodasAsClasses();

  // 1) 12 classes, cada uma com exatamente 4 subclasses.
  if (colecoes.size !== 12) problemas.push(`esperava 12 classes, encontrado ${colecoes.size}`);
  for (const slug of CLASS_SLUGS) {
    if (!colecoes.has(slug)) problemas.push(`classe "${slug}" não foi gerada`);
  }

  // ids de TODAS as entidades emitidas nesta rodada de staging (classe +
  // subclasse + feature), para resolver grantedBy / referências internas
  // ainda não publicadas no índice ativo.
  const idsDeStaging = new Set();
  for (const colecao of colecoes.values()) {
    for (const item of colecao.items) idsDeStaging.add(item.id);
  }

  for (const [slug, colecao] of colecoes) {
    const classEntity = colecao.items.find((i) => i.type === 'class');
    const subclasses = colecao.items.filter((i) => i.type === 'subclass');
    const features = colecao.items.filter((i) => i.type === 'feature');

    if (!classEntity) {
      problemas.push(`${slug}: entidade class ausente`);
      continue;
    }
    if (subclasses.length !== 4) {
      problemas.push(`${slug}: esperava 4 subclasses, encontrado ${subclasses.length}`);
    }

    // 2) Schema: toda entidade da coleção deve validar contra seu schema
    //    concreto (fechado por tipo).
    for (const item of colecao.items) {
      const resultado = validateEntity(item);
      if (!resultado.valid) {
        problemas.push(`${slug}: entidade "${item.id}" falhou validateEntity: ${resultado.errors.map((e) => e.message).join('; ')}`);
      }
    }

    // 3) Cobertura REAL de níveis 1-20: o conjunto de níveis com pelo menos
    //    uma feature de classe gerada deve ser EXATAMENTE igual ao conjunto
    //    de níveis que a tabela de progressão legada (`tabela_caracteristicas`)
    //    diz que têm característica de classe real (exclui placeholders de
    //    subclasse). Antes, este audit só checava "nível 1 e 3 existem", o
    //    que deixava passar o bug de ASI só no nível 4 (faltando 8/12/16) —
    //    esta comparação de CONJUNTO INTEIRO teria pego isso.
    const niveisDeClasse = new Set(features.filter((f) => f.grantedBy === classEntity.id).map((f) => f.level));
    const niveisEsperados = await niveisEsperadosDeClasse(slug);
    for (const nivel of niveisEsperados) {
      if (!niveisDeClasse.has(nivel)) problemas.push(`${slug}: tabela de progressão espera característica de classe no nível ${nivel}, mas nenhuma feature foi gerada nesse nível`);
    }
    for (const nivel of niveisDeClasse) {
      if (!Number.isInteger(nivel) || nivel < 1 || nivel > 20) {
        problemas.push(`${slug}: feature com nível fora de 1-20 (${nivel})`);
      } else if (!niveisEsperados.has(nivel)) {
        problemas.push(`${slug}: feature gerada no nível ${nivel}, mas a tabela de progressão não lista característica de classe nesse nível`);
      }
    }

    // 4) Escolha obrigatória de subclasse no nível 3: o efeito "subclasse"
    //    deve existir, apontar para as 4 subclasses e estar gated em nível 3.
    const efeitoSubclasse = classEntity.effects.find((e) => e.id === 'subclasse');
    if (!efeitoSubclasse) {
      problemas.push(`${slug}: falta o efeito de escolha obrigatória de subclasse`);
    } else {
      const nivelEsperado = NIVEL_SUBCLASSE[classEntity.name];
      if (efeitoSubclasse.when?.min !== nivelEsperado) problemas.push(`${slug}: escolha de subclasse não está gated no nível ${nivelEsperado} (NIVEL_SUBCLASSE)`);
      if (efeitoSubclasse.choice.options.length !== 4) problemas.push(`${slug}: escolha de subclasse não tem 4 opções`);
    }

    // 5) description presente (documental) em toda feature, nunca usada
    //    como único portador de regra (effects sempre não-vazio também).
    for (const feature of features) {
      if (typeof feature.description !== 'string' || feature.description.length === 0) {
        problemas.push(`${slug}: feature "${feature.id}" sem description`);
      }
      if (!Array.isArray(feature.effects) || feature.effects.length === 0) {
        problemas.push(`${slug}: feature "${feature.id}" sem effects`);
      }
    }

    // 6) Toda referência de conteúdo (spell/feat/skill/ability/...) dentro
    //    dos efeitos da classe e de cada feature deve existir — no ruleset
    //    ativo, no inventário de ids reservados para staging, OU entre os
    //    ids emitidos por este próprio staging (grantedBy). Referência
    //    "ainda não ativada" é verificada, nunca ignorada.
    const refsEncontradas = new Set();
    coletarPossiveisRefs(classEntity.effects, refsEncontradas);
    for (const feature of features) coletarPossiveisRefs(feature.effects, refsEncontradas);
    for (const sub of subclasses) coletarPossiveisRefs(sub.effects ?? [], refsEncontradas);

    for (const ref of refsEncontradas) {
      const parsed = parseContentId(ref);
      if (!parsed.ok) continue; // não era de fato um ContentId (ex.: "damage.rage-bonus" tem 2 segmentos, não bate no regex de 3, já filtrado por coletarPossiveisRefs)
      if (parsed.value.namespace !== 'dnd2024') continue; // fora do namespace deste pacote, não é responsabilidade deste audit
      const existe = idsAtivos.has(ref) || idsReservados.has(ref) || idsDeStaging.has(ref);
      if (!existe) {
        problemas.push(`${slug}: referência "${ref}" não existe no ruleset ativo, no inventário reservado nem no staging desta migração`);
      }
    }
  }

  // 7) Ids de classe/subclasse batem 1:1 com o inventário reservado
  //    (nenhuma classe/subclasse reservada ficou sem entidade correspondente).
  const classIdsGerados = new Set([...colecoes.values()].map((c) => c.items.find((i) => i.type === 'class').id));
  for (const { id, name } of idInventory.reserved.class) {
    if (!classIdsGerados.has(id)) problemas.push(`classe reservada "${name}" (${id}) não foi gerada`);
  }
  const subclassIdsGerados = new Set(
    [...colecoes.values()].flatMap((c) => c.items.filter((i) => i.type === 'subclass').map((i) => i.id)),
  );
  for (const { id, name } of idInventory.reserved.subclass) {
    if (!subclassIdsGerados.has(id)) problemas.push(`subclasse reservada "${name}" (${id}) não foi gerada`);
  }

  // 8) Os 12 arquivos canônicos em disco e o fragmento de índice de staging
  //    devem refletir EXATAMENTE o que o conversor produz agora — sem isso,
  //    o teste de contrato e este próprio audit só validavam o resultado em
  //    memória, nunca conferiam se `--write` já tinha sido rodado de novo
  //    após uma mudança no conversor (mesmo padrão de `build-index --check`).
  const drift = await verificarDrift(colecoes);
  if (!drift.ok) {
    for (const diff of drift.diffs) problemas.push(`drift: ${diff}`);
  }

  for (const aviso of colecoes.avisos) process.stdout.write(`audit-classes: aviso: ${aviso}\n`);

  if (problemas.length > 0) {
    process.stderr.write(`audit-classes: ${problemas.length} problema(s):\n`);
    for (const problema of problemas) process.stderr.write(`  - ${problema}\n`);
    process.exitCode = 1;
    return;
  }

  const totalFeatures = [...colecoes.values()].reduce((acc, c) => acc + c.items.filter((i) => i.type === 'feature').length, 0);
  process.stdout.write(
    `audit-classes: OK — 12 classes, 48 subclasses, ${totalFeatures} features, todas as referências resolvidas.\n`,
  );
}

const isDirectCliInvocation =
  typeof process.argv[1] === 'string' &&
  path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1]);
if (isDirectCliInvocation) {
  main().catch((error) => {
    process.stderr.write(`audit-classes: erro fatal: ${error.stack || error.message}\n`);
    process.exitCode = 1;
  });
}
