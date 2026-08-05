#!/usr/bin/env node
// `scripts/content/audit-origins-feats.mjs`: auditoria de cobertura das 11
// espécies / 16 antecedentes / 75 talentos migrados por
// `migrate-origins-feats.mjs` (Task 9), no mesmo padrão de
// `scripts/content/audit-classes.mjs` (Task 8).
//
// Diferente do teste de contrato (`tests/contract/dnd2024-origins-feats.test.js`,
// que compara valores mecânicos contra a baseline extraída independentemente
// em `tests/fixtures/expected/origins-feats-mechanics.json`), este script
// varre TODA referência de conteúdo emitida pelos efeitos gerados (skill,
// ability, damage-type, language, spell, feat, ...) e confere que cada uma
// existe — no ruleset já ativo, no inventário de ids reservados para
// staging, ou entre os próprios ids emitidos por este staging — nunca
// simplesmente ignorada. Também confere ausência de qualquer bandeira
// "manualReview" residual e presença de `description`/`effects` não-vazios
// em toda entidade.
//
// Uso:
//   node scripts/content/audit-origins-feats.mjs
//     Sai com código 0 e imprime um resumo se tudo estiver ok; código
//     diferente de zero e a lista de problemas, caso contrário.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { construirCatalogos, verificarDrift, construirFragmentoDeIndice } from './migrate-origins-feats.mjs';
import { validateEntity } from '../../site/js/content/validation.js';
import { parseContentId } from '../../site/js/core/content-id.js';
import { loadIdInventory, slugify } from './content-id-map.mjs';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const rulesetsDir = path.join(repoRoot, 'dados', 'pacotes', 'dnd2024', 'rulesets');

/**
 * Coleta recursivamente toda string que "parece" um ContentId dentro de um
 * valor arbitrário (efeito, escolha, opção, params de official-handler...),
 * para conferência de referência. Mesma função de `audit-classes.mjs`.
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

/**
 * Varre recursivamente um valor procurando qualquer campo `manualReview`
 * (verdadeiro) — nenhuma entidade de staging desta tarefa deve carregar
 * essa bandeira sem ter sido revisada e resolvida (ver brief da Task 9).
 * @param {*} valor
 * @param {string[]} caminho
 * @param {string[]} destino
 */
function coletarManualReviewResidual(valor, caminho, destino) {
  if (Array.isArray(valor)) {
    valor.forEach((v, i) => coletarManualReviewResidual(v, [...caminho, `[${i}]`], destino));
    return;
  }
  if (valor && typeof valor === 'object') {
    if (valor.manualReview) destino.push(caminho.join('.') || '(raiz)');
    for (const [k, v] of Object.entries(valor)) coletarManualReviewResidual(v, [...caminho, k], destino);
  }
}

async function carregarIdsAtivos() {
  const ativos = new Set();
  for (const arquivo of ['abilities.json', 'skills.json', 'conditions.json', 'damage-types.json', 'languages.json']) {
    try {
      const conteudo = JSON.parse(await readFile(path.join(rulesetsDir, arquivo), 'utf8'));
      for (const item of conteudo.items) ativos.add(item.id);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  return ativos;
}

async function main() {
  const problemas = [];

  const idInventory = await loadIdInventory();
  const idsReservados = new Set();
  for (const entries of Object.values(idInventory.reserved)) {
    for (const { id } of entries) idsReservados.add(id);
  }
  const idsAtivos = await carregarIdsAtivos();

  const catalogos = await construirCatalogos();
  const { species, backgrounds, feats, avisos } = catalogos;

  // 1) Contagens exatas (11 / 16 / 75).
  if (species.items.length !== 11) problemas.push(`esperava 11 espécies, encontrado ${species.items.length}`);
  if (backgrounds.items.length !== 16) problemas.push(`esperava 16 antecedentes, encontrado ${backgrounds.items.length}`);
  if (feats.items.length !== 75) problemas.push(`esperava 75 talentos, encontrado ${feats.items.length}`);

  // 2) Cobertura nomeada explicitamente pelo brief da Task 9.
  const nomesEspecies = new Set(species.items.map((s) => s.name));
  for (const nome of ['Draconato', 'Elfo', 'Gnomo', 'Golias', 'Humano', 'Tiferino', 'Kenku']) {
    if (!nomesEspecies.has(nome)) problemas.push(`espécie explicitamente exigida "${nome}" ausente do catálogo`);
  }
  const featIniciado = feats.items.find((f) => f.name === 'Iniciado em Magia');
  if (!featIniciado) {
    problemas.push('talento "Iniciado em Magia" ausente do catálogo');
  } else {
    const escolhaLista = featIniciado.effects.find((e) => e.id === 'iniciado-em-magia-lista');
    if (!escolhaLista || escolhaLista.choice.options.length !== 3) {
      problemas.push('talento "Iniciado em Magia" não tem a escolha de lista de magias (Clérigo/Druida/Mago) com 3 opções');
    }
  }
  // Toda instância de "Iniciado em Magia" referenciada por antecedente
  // (Acólito/Guia/Sábio) deve apontar para esse único talento + uma lista
  // pré-selecionada coerente com o texto legado.
  const instanciasEsperadas = { Acólito: 'clerigo', Guia: 'druida', Sábio: 'mago' };
  for (const [nomeAntecedente, listaEsperada] of Object.entries(instanciasEsperadas)) {
    const bg = backgrounds.items.find((b) => b.name === nomeAntecedente);
    if (!bg) {
      problemas.push(`antecedente "${nomeAntecedente}" ausente`);
      continue;
    }
    const efeito = bg.effects.find((e) => e.type === 'official-handler' && e.handlerId === 'grant-feat');
    if (!efeito || efeito.params?.presetChoices?.['lista-de-magias'] !== listaEsperada) {
      problemas.push(`antecedente "${nomeAntecedente}" não referencia Iniciado em Magia com a lista "${listaEsperada}" pré-selecionada`);
    }
  }

  // 3) Schema: toda entidade deve validar contra seu schema concreto.
  const idsDeStaging = new Set([...species.items, ...backgrounds.items, ...feats.items].map((i) => i.id));
  for (const [rotulo, colecao] of [['species', species], ['backgrounds', backgrounds], ['feats', feats]]) {
    for (const item of colecao.items) {
      const resultado = validateEntity(item);
      if (!resultado.valid) {
        problemas.push(`${rotulo}: entidade "${item.id}" falhou validateEntity: ${resultado.errors.map((e) => e.message).join('; ')}`);
      }
      if (typeof item.description !== 'string' || item.description.length === 0) {
        problemas.push(`${rotulo}: entidade "${item.id}" sem description`);
      }
      if (!Array.isArray(item.effects) || item.effects.length === 0) {
        problemas.push(`${rotulo}: entidade "${item.id}" sem effects`);
      }
    }
  }

  // 4) Nenhuma bandeira `manualReview` residual em nenhuma entidade.
  for (const [rotulo, colecao] of [['species', species], ['backgrounds', backgrounds], ['feats', feats]]) {
    for (const item of colecao.items) {
      const achados = [];
      coletarManualReviewResidual(item, [], achados);
      for (const caminho of achados) problemas.push(`${rotulo}: entidade "${item.id}" ainda tem manualReview em "${caminho}"`);
    }
  }

  // 4b) Todo `aviso` do conversor É um problema, não apenas uma linha de
  //     stdout. Antes desta correção, um aviso "manualReview" (ex.:
  //     espécie legada sem entrada em SPECIES_TABLE) era só impresso e o
  //     script saía com código 0 de qualquer forma — o gate exigido pelo
  //     brief ("nenhuma entidade de staging pode ficar com aviso
  //     manualReview") era estruturalmente incapaz de falhar. Qualquer
  //     aviso agora conta como problema real.
  for (const aviso of avisos) problemas.push(`aviso do conversor (deveria ter sido resolvido antes do --write): ${aviso}`);

  // 4c) Nenhuma entidade tem dois efeitos de topo (`entity.effects[].id`)
  //     com o mesmo id — a mesma classe de bug que deixou
  //     `dnd2024:species:humano`/`tiferino`/`kenku` com um id duplicado
  //     sem que nada pegasse (find() resolvia no primeiro match e passava
  //     de qualquer forma). Escopo: o array `effects` de topo de cada
  //     entidade — é o único nível em que id é usado para lookup
  //     (`entity.effects.find(e => e.id === ...)`) em todo o código e nos
  //     testes; ids repetidos entre opções IRMÃS e mutuamente exclusivas
  //     de um mesmo `choice` (ex.: cada opção de herança dracônica do
  //     Draconato reusar "resistencia-heranca") não colidem nesse sentido
  //     e são um padrão já estabelecido (mesmo formato usado por
  //     `migrate-classes.mjs`).
  for (const [rotulo, colecao] of [['species', species], ['backgrounds', backgrounds], ['feats', feats]]) {
    for (const item of colecao.items) {
      const vistos = new Set();
      for (const efeito of item.effects ?? []) {
        if (efeito.id === undefined) continue;
        if (vistos.has(efeito.id)) problemas.push(`${rotulo}: entidade "${item.id}" tem dois efeitos de topo com id "${efeito.id}"`);
        vistos.add(efeito.id);
      }
    }
  }

  // 5) Toda referência de conteúdo deve resolver: ativa, reservada, ou
  //    emitida por este próprio staging.
  const refsEncontradas = new Set();
  for (const colecao of [species, backgrounds, feats]) {
    for (const item of colecao.items) coletarPossiveisRefs(item.effects, refsEncontradas);
  }
  for (const ref of refsEncontradas) {
    const parsed = parseContentId(ref);
    if (!parsed.ok) continue;
    if (parsed.value.namespace !== 'dnd2024') continue;
    const existe = idsAtivos.has(ref) || idsReservados.has(ref) || idsDeStaging.has(ref);
    if (!existe) {
      problemas.push(`referência "${ref}" não existe no ruleset ativo, no inventário reservado nem no staging desta migração`);
    }
  }

  // 5b) Cobertura de traços de espécie: todo `traco.nome` legado
  //     (`dados/origens/especies.json`) deve deixar rastro em algum lugar
  //     da árvore de efeitos da espécie correspondente (id de efeito,
  //     label de opção de choice, ou texto de um efeito `manual`) — mesmo
  //     espírito do fallback `effects.length === 0` que já existe para
  //     talentos, agora do lado de espécies (a revisão apontou que não
  //     havia guarda nenhuma aqui; hoje nada é perdido, mas uma espécie
  //     futura sem entrada completa em SPECIES_TABLE passaria batido sem
  //     isto).
  const legacyEspecies = JSON.parse(await readFile(path.join(repoRoot, 'dados', 'origens', 'especies.json'), 'utf8')).especies;
  for (const especieLegado of legacyEspecies) {
    const entity = species.items.find((s) => s.name === especieLegado.nome);
    if (!entity) continue; // já reportado acima (contagem/SPECIES_TABLE)
    const arvoreTexto = JSON.stringify(entity.effects).toLowerCase();
    for (const traco of especieLegado.tracos) {
      const chave = traco.nome.toLowerCase();
      // Sinal fraco mas barato: o próprio nome do traço, OU seu slug
      // (mesma normalização de `content-id-map.mjs#slugify`), aparece em
      // algum id/label/texto da árvore de efeitos.
      const chaveSlug = slugify(traco.nome);
      const cobre = arvoreTexto.includes(chave) || arvoreTexto.includes(chaveSlug);
      if (!cobre) {
        problemas.push(`species: "${especieLegado.nome}" — traço legado "${traco.nome}" não aparece em nenhum id/label/texto dos efeitos gerados`);
      }
    }
  }

  // 6) Ids batem 1:1 com o inventário reservado (nada reservado ficou sem
  //    entidade correspondente, nada extra foi inventado).
  for (const [tipo, colecao] of [['species', species], ['background', backgrounds], ['feat', feats]]) {
    const reservado = new Set((idInventory.reserved[tipo] ?? []).map((e) => e.id));
    const gerado = new Set(colecao.items.map((i) => i.id));
    for (const id of reservado) if (!gerado.has(id)) problemas.push(`id reservado "${id}" (${tipo}) não foi gerado`);
    for (const id of gerado) if (!reservado.has(id)) problemas.push(`id gerado "${id}" (${tipo}) não está no inventário reservado`);
  }

  // 7) Drift: catálogos + fragmento de índice commitados devem refletir
  //    exatamente o que o conversor produz agora.
  const drift = await verificarDrift(catalogos);
  if (!drift.ok) {
    for (const diff of drift.diffs) problemas.push(`drift: ${diff}`);
  }

  if (problemas.length > 0) {
    process.stderr.write(`audit-origins-feats: ${problemas.length} problema(s):\n`);
    for (const problema of problemas) process.stderr.write(`  - ${problema}\n`);
    process.exitCode = 1;
    return;
  }

  process.stdout.write(
    `audit-origins-feats: OK — 11 espécies, 16 antecedentes, 75 talentos, todas as referências resolvidas, sem manualReview residual.\n`,
  );
}

const isDirectCliInvocation =
  typeof process.argv[1] === 'string' &&
  path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1]);
if (isDirectCliInvocation) {
  main().catch((error) => {
    process.stderr.write(`audit-origins-feats: erro fatal: ${error.stack || error.message}\n`);
    process.exitCode = 1;
  });
}
