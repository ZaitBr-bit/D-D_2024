// Handler oficial do Paladino (`class-paladino`), extraído de
// `site/js/pages/sheet.js` (commit e43c5ea):
//   - `getProgressaoPaladino`/`getEstadoRecursosPaladino`, linhas 1955-2029;
//   - ações da classe, linhas 6312-6382;
//   - ações de subclasse, linhas 6385-6547;
//   - descanso curto, linhas 4460-4474;
//   - descanso longo, linhas 4817-4846.
//
// O que ficou NOS DADOS (e não aqui):
//   - o teto de Canalizar Divindade por nível (coluna da
//     `tabela_caracteristicas` → `canalizar-divindade-3/11`);
//   - a reserva de Mãos Consagradas (`5 * nivel`, `sheet.js:1984`), trazida
//     para o conteúdo nesta tarefa como o ladder `maos-consagradas-1..20`
//     (ver `scripts/content/migrate-classes.mjs#LADDERS_DIVINOS_PRIMAIS_DE_CLASSE`);
//   - as magias de juramento (`grant-spell` + `alwaysPrepared: true`).
//
// O que exige código:
//   - descanso CURTO devolve exatamente 1 uso de Canalizar Divindade
//     (`sheet.js:4464-4467`);
//   - Mãos Consagradas gasta uma quantidade escolhida pelo jogador
//     (`payload.amount`), e Remover Envenenado gasta 5 fixos;
//   - as ações de juramento que combinam Canalizar Divindade com flags.
//
// Conjuração: nada aqui toca espaço de magia. Em particular, a ação
// `devocao_resplendor_restaurar` do baseline (`sheet.js:6531-6546`), que gasta
// um espaço de 5º círculo para destravar Resplendor Sagrado, NÃO é modelada:
// o custo mora no domínio de magias e o benefício aqui, e escrever só a
// metade daqui abriria um caminho de destravar de graça. Ver concerns.
//
// DIVERGÊNCIA DELIBERADA DO BASELINE (registrada como concern C1 do relatório
// da Task 21): o baseline compara `char.subclasse` com `'Juramento de
// Devoção'`/`'Juramento de Glória'`/`'Juramento de Vingança'` nos blocos de
// descanso (linhas 4470, 4826, 4831 e 4840), mas o nome REAL das subclasses
// — o mesmo que a renderização usa em 9157/9164/9176 e que
// `dados/classes/paladino.json` declara — é `'Juramento DA ...'`. Os quatro
// blocos são, portanto, código morto: hoje as flags de Glória, Vingança e
// Devoção nunca são limpas, e as habilidades 1×/descanso longo delas ficam
// permanentemente travadas depois do primeiro uso. Aqui as três voltam no
// descanso longo, como a regra manda. Só `'Juramento dos Anciões'` (4835)
// casa no baseline e é reproduzido sem divergência.
//
// NÃO modelado nesta rodada (ver concerns): Defesa Gloriosa (nv15), cujo
// máximo é `Math.max(1, modificador de Carisma)` — a mesma lacuna de
// `context.variables` das Tasks 20/21.

import { createClassHandler } from './class-handler.js';

const CLASS_ID = 'dnd2024:class:paladino';
const DEVOCAO = 'dnd2024:subclass:juramento-da-devocao';
const GLORIA = 'dnd2024:subclass:juramento-da-gloria';
const VINGANCA = 'dnd2024:subclass:juramento-da-vinganca';
const ANCIOES = 'dnd2024:subclass:juramento-dos-ancioes';

export const paladinoHandler = createClassHandler({
  id: 'class-paladino',
  classId: CLASS_ID,
  resources: [
    { key: 'maos-consagradas', label: 'Mãos Consagradas', owner: 'class' },
    { key: 'canalizar-divindade', label: 'Canalizar Divindade', owner: 'class' },
  ],
  flags: [
    { key: 'destruicao-gratuita-usada', owner: 'class' },
    { key: 'lenda-viva-usada', owner: 'subclass', ownerId: GLORIA },
    { key: 'anjo-vingador-usado', owner: 'subclass', ownerId: VINGANCA },
    { key: 'sentinela-imortal-usada', owner: 'subclass', ownerId: ANCIOES },
    { key: 'campeao-ancestral-usado', owner: 'subclass', ownerId: ANCIOES },
    { key: 'arma-sagrada-ativa', owner: 'subclass', ownerId: DEVOCAO },
    { key: 'resplendor-sagrado-usado', owner: 'subclass', ownerId: DEVOCAO },
    { key: 'resplendor-sagrado-ativo', owner: 'subclass', ownerId: DEVOCAO },
  ],
  actions: [
    // sheet.js:6342-6349 — o modal só DEBITA a reserva (o baseline não aplica
    // a cura ao PV); a quantidade vem do jogador, limitada pela reserva.
    {
      id: 'usar-maos-consagradas', label: 'Usar Mãos Consagradas',
      minLevel: 1,
      spend: { resource: 'maos-consagradas', amount: 1, amountFromPayload: true },
    },
    // sheet.js:6350-6357 — 5 pontos fixos, sem restaurar PV.
    { id: 'remover-envenenado', label: 'Remover Envenenado (5 PV)', minLevel: 1, spend: { resource: 'maos-consagradas', amount: 5 } },
    // sheet.js:6361-6368.
    { id: 'canalizar-divindade', label: 'Usar Canalizar Divindade', minLevel: 3, spend: { resource: 'canalizar-divindade', amount: 1 } },
    // sheet.js:6370-6377 — Destruição do Paladino (nv2), 1×/descanso longo.
    {
      id: 'destruicao-gratuita', label: 'Destruição Gratuita',
      minLevel: 2,
      requireFlag: { key: 'destruicao-gratuita-usada', value: false },
      setFlags: { 'destruicao-gratuita-usada': true },
    },
    // === Juramento da Glória (sheet.js:6410-6446) ===
    {
      id: 'gloria-atleta-inigualavel', label: 'Atleta Inigualável',
      minLevel: 3,
      subclassId: GLORIA,
      spend: { resource: 'canalizar-divindade', amount: 1 },
    },
    {
      id: 'gloria-destruicao-inspiradora', label: 'Destruição Inspiradora',
      minLevel: 3,
      subclassId: GLORIA,
      spend: { resource: 'canalizar-divindade', amount: 1 },
    },
    {
      id: 'gloria-lenda-viva', label: 'Lenda Viva',
      minLevel: 20,
      subclassId: GLORIA,
      flagOwner: 'subclass',
      requireFlag: { key: 'lenda-viva-usada', value: false, owner: 'subclass' },
      setFlags: { 'lenda-viva-usada': true },
    },
    // === Juramento da Vingança (sheet.js:6449-6463) ===
    {
      id: 'vinganca-voto-de-inimizade', label: 'Voto de Inimizade',
      minLevel: 3,
      subclassId: VINGANCA,
      spend: { resource: 'canalizar-divindade', amount: 1 },
    },
    {
      id: 'vinganca-anjo-vingador', label: 'Anjo Vingador',
      minLevel: 20,
      subclassId: VINGANCA,
      flagOwner: 'subclass',
      requireFlag: { key: 'anjo-vingador-usado', value: false, owner: 'subclass' },
      setFlags: { 'anjo-vingador-usado': true },
    },
    // === Juramento dos Anciões (sheet.js:6466-6494) ===
    {
      id: 'ancioes-ira-da-natureza', label: 'Ira da Natureza',
      minLevel: 3,
      subclassId: ANCIOES,
      spend: { resource: 'canalizar-divindade', amount: 1 },
    },
    {
      id: 'ancioes-sentinela-imortal', label: 'Sentinela Imortal',
      minLevel: 15,
      subclassId: ANCIOES,
      flagOwner: 'subclass',
      requireFlag: { key: 'sentinela-imortal-usada', value: false, owner: 'subclass' },
      setFlags: { 'sentinela-imortal-usada': true },
    },
    {
      id: 'ancioes-campeao-ancestral', label: 'Campeão Ancestral',
      minLevel: 20,
      subclassId: ANCIOES,
      flagOwner: 'subclass',
      requireFlag: { key: 'campeao-ancestral-usado', value: false, owner: 'subclass' },
      setFlags: { 'campeao-ancestral-usado': true },
    },
    // === Juramento da Devoção (sheet.js:6497-6529) ===
    // Arma Sagrada: gasta 1 Canalizar Divindade e liga a flag; o baseline não
    // exige que ela esteja desligada.
    {
      id: 'devocao-arma-sagrada', label: 'Ativar Arma Sagrada',
      minLevel: 3,
      subclassId: DEVOCAO,
      flagOwner: 'subclass',
      spend: { resource: 'canalizar-divindade', amount: 1 },
      setFlags: { 'arma-sagrada-ativa': true },
    },
    {
      id: 'devocao-encerrar-arma-sagrada', label: 'Encerrar Arma Sagrada',
      minLevel: 3,
      subclassId: DEVOCAO,
      flagOwner: 'subclass',
      setFlags: { 'arma-sagrada-ativa': false },
    },
    // Resplendor Sagrado (nv20): uso único por descanso longo; ativar marca
    // as DUAS flags (`usado` + `ativo`), como em sheet.js:6518-6519.
    {
      id: 'devocao-ativar-resplendor-sagrado', label: 'Ativar Resplendor Sagrado',
      minLevel: 20,
      subclassId: DEVOCAO,
      flagOwner: 'subclass',
      requireFlag: { key: 'resplendor-sagrado-usado', value: false, owner: 'subclass' },
      setFlags: { 'resplendor-sagrado-usado': true, 'resplendor-sagrado-ativo': true },
    },
    {
      id: 'devocao-encerrar-resplendor-sagrado', label: 'Encerrar Resplendor Sagrado',
      minLevel: 20,
      subclassId: DEVOCAO,
      flagOwner: 'subclass',
      setFlags: { 'resplendor-sagrado-ativo': false },
    },
  ],
  rest: {
    // sheet.js:4464-4467 (1 uso de Canalizar Divindade) e 4470-4473 (Devoção:
    // efeitos temporários de 10 min expiram). Ver a nota de DIVERGÊNCIA no
    // topo sobre o nome da subclasse no baseline.
    short: [
      { kind: 'recover-resource', resource: 'canalizar-divindade', amount: 1 },
      { kind: 'clear-flag', flag: 'arma-sagrada-ativa', owner: 'subclass', subclassId: DEVOCAO },
      { kind: 'clear-flag', flag: 'resplendor-sagrado-ativo', owner: 'subclass', subclassId: DEVOCAO },
    ],
    // sheet.js:4821-4844.
    long: [
      { kind: 'restore-resource', resource: 'maos-consagradas' },
      { kind: 'restore-resource', resource: 'canalizar-divindade' },
      { kind: 'clear-flag', flag: 'destruicao-gratuita-usada' },
      { kind: 'clear-flag', flag: 'lenda-viva-usada', owner: 'subclass', subclassId: GLORIA },
      { kind: 'clear-flag', flag: 'anjo-vingador-usado', owner: 'subclass', subclassId: VINGANCA },
      { kind: 'clear-flag', flag: 'sentinela-imortal-usada', owner: 'subclass', subclassId: ANCIOES },
      { kind: 'clear-flag', flag: 'campeao-ancestral-usado', owner: 'subclass', subclassId: ANCIOES },
      { kind: 'clear-flag', flag: 'arma-sagrada-ativa', owner: 'subclass', subclassId: DEVOCAO },
      { kind: 'clear-flag', flag: 'resplendor-sagrado-usado', owner: 'subclass', subclassId: DEVOCAO },
      { kind: 'clear-flag', flag: 'resplendor-sagrado-ativo', owner: 'subclass', subclassId: DEVOCAO },
    ],
  },
});
