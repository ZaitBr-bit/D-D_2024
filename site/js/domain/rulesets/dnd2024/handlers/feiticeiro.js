// Handler oficial do Feiticeiro (`class-feiticeiro`), extraído de
// `site/js/pages/sheet.js` (commit e43c5ea):
//   - `getProgressaoFeiticeiro`/`getEstadoRecursosFeiticeiro`, linhas 913-1000;
//   - ações de classe (Feitiçaria Inata, Restauração Feiticeira), 5637-5686;
//   - Restaurar Equilíbrio (Feitiçaria Mecânica), linhas 5920-5931;
//   - descanso curto, linhas 4440-4459;
//   - descanso longo, linhas 4787-4817.
//
// O que ficou NOS DADOS:
//   - o teto de Pontos de Feitiçaria por nível (coluna "Pontos de Feitiçaria"
//     da `tabela_caracteristicas`, já efeitos `resource`);
//   - os 2 usos de Feitiçaria Inata e o teto de Restaurar Equilíbrio
//     (`carismaModifierMin1`), acrescentados ao conteúdo pela Task 22a.
//
// ## Metamagia e conversão de espaços NÃO passam por aqui
//
// A metamagia é do domínio de magias (`site/js/domain/spells/metamagic.js`,
// Task 18): quais opções o personagem conhece, o custo de cada uma e o efeito
// sobre a conjuração. O que este handler oferece é a ÚNICA parte que é estado
// de recurso de classe — `gastar-pontos-de-feiticaria`, com a quantidade vinda
// do payload. O domínio de magias decide QUANTO custa; o handler só sabe
// debitar da reserva, com a mesma disciplina de recurso ausente/insuficiente
// das demais classes.
//
// As duas conversões do baseline (espaço de magia -> PF, `sheet.js:5688-5714`,
// e PF -> espaço de magia, `sheet.js:5717-5749`) tocam `state.spells.slots` dos
// dois lados e por isso pertencem a um comando do domínio de magias que
// combina as duas metades; modelá-las aqui obrigaria o handler de classe a
// escrever espaço de magia. Ficam registradas como concern da Task 22a.
//
// ## Feitiçaria Encarnada (nv7)
//
// `sheet.js:5654-5657`: sem usos de Feitiçaria Inata, o nível 7+ pode ativá-la
// gastando 2 Pontos de Feitiçaria. São duas PRÉ-CONDIÇÕES alternativas para o
// mesmo efeito, e o vocabulário de `spend` não expressa alternativa — por isso
// são duas ações distintas (`ativar-feiticaria-inata` e
// `ativar-feiticaria-inata-encarnada`), cada uma com a própria condição
// verificável na projeção. A UI escolhe qual oferecer, exatamente como o
// baseline escolhe qual ramo do `if` executar.
//
// ## "Usado desde o descanso" das Asas de Dragão e do Transe da Ordem
//
// `sheet.js:5891-5903` e `sheet.js:5953-5965` têm a MESMA forma da Feitiçaria
// Encarnada: o primeiro uso desde o último descanso longo é grátis (e marca uma
// flag `*_usada_desde_descanso`), e reativações posteriores custam Pontos de
// Feitiçaria (3 e 5, respectivamente). Por isso cada um vira TRÊS ações —
// abrir/reabrir/recolher —, e as duas flags de controle (`ativa` e
// `usada-desde-o-descanso`) são declaradas separadamente: a de duração volta no
// descanso CURTO (`sheet.js:4448-4450`) e a de uso gratuito só no LONGO
// (`sheet.js:4800`, `:4805`).
//
// NÃO modelado nesta rodada (ver concerns do relatório da Task 22a):
// `bastiao_dados` (Bastião da Lei — pool de d8 criado por PF gastos),
// `telepatia_duracao_min` (duração em minutos, não estado de uso),
// `afinidade_elemental`/`bonus_pv_aplicado` da Feitiçaria Dracônica (bônus de
// PV é do domínio de pontos de vida) e `surto_pendente_automatico` — este
// último é LIGADO pelo Surto de Magia Selvagem automático, que é aleatório e
// disparado pela conjuração (domínio de magias), não por uma ação de classe;
// declará-lo aqui deixaria uma flag com ação de limpar e sem ação de ligar.

import { createClassHandler } from './class-handler.js';

const CLASS_ID = 'dnd2024:class:feiticeiro';
const ABERRANTE = 'dnd2024:subclass:feiticaria-aberrante';
const DRACONICA = 'dnd2024:subclass:feiticaria-draconica';
const MECANICA = 'dnd2024:subclass:feiticaria-mecanica';
const SELVAGEM = 'dnd2024:subclass:feiticaria-selvagem';

export const feiticeiroHandler = createClassHandler({
  id: 'class-feiticeiro',
  classId: CLASS_ID,
  resources: [
    { key: 'pontos-de-feiticaria', label: 'Pontos de Feitiçaria', owner: 'class' },
    { key: 'feiticaria-inata', label: 'Feitiçaria Inata', owner: 'class' },
    { key: 'restaurar-equilibrio', label: 'Restaurar Equilíbrio', owner: 'subclass', ownerId: MECANICA },
  ],
  flags: [
    { key: 'feiticaria-inata-ativa', owner: 'class' },
    { key: 'restauracao-feiticeira-usada', owner: 'class' },
    // sheet.js:12485 e :4453/:4813 — o uso gratuito de metamagia da Apoteose
    // Arcana (nv20) é uma flag de CLASSE que o baseline zera nos dois descansos.
    { key: 'apoteose-arcana-gratuito-usado', owner: 'class' },
    { key: 'telepatia-ativa', owner: 'subclass', ownerId: ABERRANTE },
    { key: 'revelacao-em-carne-ativa', owner: 'subclass', ownerId: ABERRANTE },
    { key: 'asas-de-dragao-ativas', owner: 'subclass', ownerId: DRACONICA },
    { key: 'asas-de-dragao-usadas-desde-o-descanso', owner: 'subclass', ownerId: DRACONICA },
    { key: 'companheiro-draconico-usado', owner: 'subclass', ownerId: DRACONICA },
    { key: 'transe-da-ordem-ativo', owner: 'subclass', ownerId: MECANICA },
    { key: 'transe-da-ordem-usado-desde-o-descanso', owner: 'subclass', ownerId: MECANICA },
    // Polaridade INVERTIDA em relação ao baseline: `mares_caos_disponivel`
    // começa `true` e vira `false` ao ser usado (sheet.js:5973-5980). Uma flag
    // que começa "ligada" colidiria com a regra de estado ausente deste módulo
    // (ausência é sempre `false`), então o que se guarda é o USO.
    { key: 'mares-do-caos-usado', owner: 'subclass', ownerId: SELVAGEM },
    { key: 'surto-controlado-usado', owner: 'subclass', ownerId: SELVAGEM },
  ],
  actions: [
    // sheet.js:5647-5653 — ramo normal: gasta 1 uso de Feitiçaria Inata.
    {
      id: 'ativar-feiticaria-inata', label: 'Ativar Feitiçaria Inata',
      minLevel: 1,
      spend: { resource: 'feiticaria-inata', amount: 1 },
      requireFlag: { key: 'feiticaria-inata-ativa', value: false },
      setFlags: { 'feiticaria-inata-ativa': true },
    },
    // sheet.js:5654-5657 — ramo "Feitiçaria Encarnada" (nv7): 2 PF no lugar do
    // uso. Ver o comentário de topo sobre as duas ações.
    {
      id: 'ativar-feiticaria-inata-encarnada', label: 'Ativar Feitiçaria Encarnada',
      minLevel: 7,
      spend: { resource: 'pontos-de-feiticaria', amount: 2 },
      requireFlag: { key: 'feiticaria-inata-ativa', value: false },
      setFlags: { 'feiticaria-inata-ativa': true },
    },
    // sheet.js:5661-5664.
    {
      id: 'encerrar-feiticaria-inata', label: 'Encerrar Feitiçaria Inata',
      minLevel: 1,
      requireFlag: { key: 'feiticaria-inata-ativa', value: true },
      setFlags: { 'feiticaria-inata-ativa': false },
    },
    // sheet.js:5666-5685 — Restauração Feiticeira (nv5): uso único por descanso
    // longo que devolve `floor(nível / 2)` Pontos de Feitiçaria. A quantidade é
    // o nome de variável `levelHalfDown`, resolvido contra `context.variables`.
    {
      id: 'restauracao-feiticeira', label: 'Restauração Feiticeira',
      minLevel: 5,
      requireFlag: { key: 'restauracao-feiticeira-usada', value: false },
      recoverResource: { resource: 'pontos-de-feiticaria', amount: 'levelHalfDown' },
      setFlags: { 'restauracao-feiticeira-usada': true },
    },
    // Gasto genérico da reserva (metamagia e demais consumidores de PF, cujo
    // CUSTO é do domínio de magias — ver comentário de topo).
    {
      id: 'gastar-pontos-de-feiticaria', label: 'Gastar Pontos de Feitiçaria',
      minLevel: 2,
      spend: { resource: 'pontos-de-feiticaria', amount: 1, amountFromPayload: true },
    },
    // sheet.js:5920-5931 — Restaurar Equilíbrio (Feitiçaria Mecânica, nv3).
    {
      id: 'mecanica-restaurar-equilibrio', label: 'Usar Restaurar Equilíbrio',
      minLevel: 3,
      subclassId: MECANICA,
      spend: { resource: 'restaurar-equilibrio', amount: 1 },
    },
    // Feitiçaria Dracônica: Companheiro Dracônico (nv18) é uso único por
    // descanso longo (sheet.js:5910-5918).
    {
      id: 'draconica-companheiro-draconico', label: 'Companheiro Dracônico',
      minLevel: 18,
      subclassId: DRACONICA,
      flagOwner: 'subclass',
      requireFlag: { key: 'companheiro-draconico-usado', value: false, owner: 'subclass' },
      setFlags: { 'companheiro-draconico-usado': true },
    },
    // sheet.js:5846-5850 — Fala Telepática (Feitiçaria Aberrante, nv3). O
    // baseline liga a flag INCONDICIONALMENTE (reativar só renova a duração,
    // que este handler não modela), então não há `requireFlag`.
    {
      id: 'aberrante-fala-telepatica', label: 'Fala Telepática',
      minLevel: 3,
      subclassId: ABERRANTE,
      flagOwner: 'subclass',
      setFlags: { 'telepatia-ativa': true },
    },
    // sheet.js:5852-5870 — Revelação em Carne (nv14): gasta N Pontos de
    // Feitiçaria (o baseline pede a quantidade num modal, mínimo 1) e liga a
    // flag. O gasto é validado ANTES da flag, então PF insuficiente não deixa a
    // característica "ativa de graça".
    {
      id: 'aberrante-revelacao-em-carne', label: 'Ativar Revelação em Carne',
      minLevel: 14,
      subclassId: ABERRANTE,
      flagOwner: 'subclass',
      spend: { resource: 'pontos-de-feiticaria', amount: 1, amountFromPayload: true },
      setFlags: { 'revelacao-em-carne-ativa': true },
    },
    // sheet.js:5891-5903 — Asas de Dragão (nv14): o primeiro uso desde o último
    // descanso longo é grátis; depois custa 3 PF.
    {
      id: 'draconica-abrir-asas-de-dragao', label: 'Abrir Asas de Dragão',
      minLevel: 14,
      subclassId: DRACONICA,
      flagOwner: 'subclass',
      requireFlag: { key: 'asas-de-dragao-usadas-desde-o-descanso', value: false, owner: 'subclass' },
      setFlags: { 'asas-de-dragao-usadas-desde-o-descanso': true, 'asas-de-dragao-ativas': true },
    },
    {
      id: 'draconica-reabrir-asas-de-dragao', label: 'Reabrir Asas de Dragão (gastar Ponto de Feitiçaria)',
      minLevel: 14,
      subclassId: DRACONICA,
      flagOwner: 'subclass',
      spend: { resource: 'pontos-de-feiticaria', amount: 3 },
      requireFlag: { key: 'asas-de-dragao-usadas-desde-o-descanso', value: true, owner: 'subclass' },
      setFlags: { 'asas-de-dragao-ativas': true },
    },
    // sheet.js:5906-5909 — "Recolher Asas".
    {
      id: 'draconica-recolher-asas-de-dragao', label: 'Recolher Asas de Dragão',
      minLevel: 14,
      subclassId: DRACONICA,
      flagOwner: 'subclass',
      requireFlag: { key: 'asas-de-dragao-ativas', value: true, owner: 'subclass' },
      setFlags: { 'asas-de-dragao-ativas': false },
    },
    // sheet.js:5953-5965 — Transe da Ordem (Feitiçaria Mecânica, nv14): mesma
    // forma das Asas, com 5 PF na reativação.
    {
      id: 'mecanica-ativar-transe-da-ordem', label: 'Ativar Transe da Ordem',
      minLevel: 14,
      subclassId: MECANICA,
      flagOwner: 'subclass',
      requireFlag: { key: 'transe-da-ordem-usado-desde-o-descanso', value: false, owner: 'subclass' },
      setFlags: { 'transe-da-ordem-usado-desde-o-descanso': true, 'transe-da-ordem-ativo': true },
    },
    {
      id: 'mecanica-reativar-transe-da-ordem', label: 'Reativar Transe da Ordem (gastar Ponto de Feitiçaria)',
      minLevel: 14,
      subclassId: MECANICA,
      flagOwner: 'subclass',
      spend: { resource: 'pontos-de-feiticaria', amount: 5 },
      requireFlag: { key: 'transe-da-ordem-usado-desde-o-descanso', value: true, owner: 'subclass' },
      setFlags: { 'transe-da-ordem-ativo': true },
    },
    // sheet.js:5968-5971 — "Transe da Ordem encerrado".
    {
      id: 'mecanica-encerrar-transe-da-ordem', label: 'Encerrar Transe da Ordem',
      minLevel: 14,
      subclassId: MECANICA,
      flagOwner: 'subclass',
      requireFlag: { key: 'transe-da-ordem-ativo', value: true, owner: 'subclass' },
      setFlags: { 'transe-da-ordem-ativo': false },
    },
    // sheet.js:5973-5980 — Marés do Caos (Feitiçaria Selvagem, nv3). O baseline
    // também RECARREGA a característica na próxima magia conjurada com espaço
    // (domínio de magias); aqui só o uso é registrado, e o descanso longo o
    // limpa (`sheet.js:4808`).
    {
      id: 'selvagem-mares-do-caos', label: 'Usar Marés do Caos',
      minLevel: 3,
      subclassId: SELVAGEM,
      flagOwner: 'subclass',
      requireFlag: { key: 'mares-do-caos-usado', value: false, owner: 'subclass' },
      setFlags: { 'mares-do-caos-usado': true },
    },
    // sheet.js:5991-5999 — Surto Controlado (nv18): uso único por descanso longo.
    {
      id: 'selvagem-surto-controlado', label: 'Surto Controlado',
      minLevel: 18,
      subclassId: SELVAGEM,
      flagOwner: 'subclass',
      requireFlag: { key: 'surto-controlado-usado', value: false, owner: 'subclass' },
      setFlags: { 'surto-controlado-usado': true },
    },
    // sheet.js:12485-12500 — Apoteose Arcana (nv20) dá UMA metamagia gratuita
    // por turno; o custo em si é calculado pelo domínio de magias, e o que é
    // estado de classe é só a marca de que o uso gratuito já foi consumido.
    {
      id: 'apoteose-arcana-usar-metamagia-gratuita', label: 'Apoteose Arcana (Metamagia gratuita do turno)',
      minLevel: 20,
      requireFlag: { key: 'apoteose-arcana-gratuito-usado', value: false },
      setFlags: { 'apoteose-arcana-gratuito-usado': true },
    },
  ],
  rest: {
    // sheet.js:4440-4459 — o descanso curto do Feiticeiro NÃO devolve Pontos de
    // Feitiçaria; ele só encerra os efeitos temporários de 1 minuto.
    short: [
      { kind: 'clear-flag', flag: 'feiticaria-inata-ativa' },
      // sheet.js:4453 — o uso gratuito da Apoteose Arcana volta nos DOIS descansos.
      { kind: 'clear-flag', flag: 'apoteose-arcana-gratuito-usado' },
      { kind: 'clear-flag', flag: 'telepatia-ativa', owner: 'subclass', subclassId: ABERRANTE },
      { kind: 'clear-flag', flag: 'revelacao-em-carne-ativa', owner: 'subclass', subclassId: ABERRANTE },
      { kind: 'clear-flag', flag: 'asas-de-dragao-ativas', owner: 'subclass', subclassId: DRACONICA },
      { kind: 'clear-flag', flag: 'transe-da-ordem-ativo', owner: 'subclass', subclassId: MECANICA },
    ],
    // sheet.js:4789-4816.
    long: [
      { kind: 'restore-resource', resource: 'pontos-de-feiticaria' },
      { kind: 'restore-resource', resource: 'feiticaria-inata' },
      { kind: 'clear-flag', flag: 'feiticaria-inata-ativa' },
      { kind: 'clear-flag', flag: 'restauracao-feiticeira-usada' },
      { kind: 'clear-flag', flag: 'apoteose-arcana-gratuito-usado' },
      { kind: 'clear-flag', flag: 'telepatia-ativa', owner: 'subclass', subclassId: ABERRANTE },
      { kind: 'clear-flag', flag: 'revelacao-em-carne-ativa', owner: 'subclass', subclassId: ABERRANTE },
      { kind: 'clear-flag', flag: 'asas-de-dragao-ativas', owner: 'subclass', subclassId: DRACONICA },
      // sheet.js:4800 — o uso GRATUITO das Asas volta só no descanso longo.
      {
        kind: 'clear-flag',
        flag: 'asas-de-dragao-usadas-desde-o-descanso',
        owner: 'subclass',
        subclassId: DRACONICA,
      },
      { kind: 'clear-flag', flag: 'companheiro-draconico-usado', owner: 'subclass', subclassId: DRACONICA },
      { kind: 'restore-resource', resource: 'restaurar-equilibrio', owner: 'subclass', subclassId: MECANICA },
      { kind: 'clear-flag', flag: 'transe-da-ordem-ativo', owner: 'subclass', subclassId: MECANICA },
      // sheet.js:4805.
      {
        kind: 'clear-flag',
        flag: 'transe-da-ordem-usado-desde-o-descanso',
        owner: 'subclass',
        subclassId: MECANICA,
      },
      // sheet.js:4808 — `mares_caos_disponivel = true` (aqui, o USO é limpo).
      { kind: 'clear-flag', flag: 'mares-do-caos-usado', owner: 'subclass', subclassId: SELVAGEM },
      { kind: 'clear-flag', flag: 'surto-controlado-usado', owner: 'subclass', subclassId: SELVAGEM },
    ],
  },
});
