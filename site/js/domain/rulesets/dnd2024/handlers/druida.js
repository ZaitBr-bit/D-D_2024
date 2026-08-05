// Handler oficial do Druida (`class-druida`), extraído de
// `site/js/pages/sheet.js` (commit e43c5ea):
//   - `getProgressaoDruida`/`getEstadoRecursosDruida`, linhas 824-897;
//   - `consumirUsoFormaSelvagem`/`recuperarUmUsoFormaSelvagem`, linhas 899-911;
//   - Forma Selvagem (ativar/encerrar), linhas 6120-6145;
//   - Companheiro Selvagem, linhas 6147-6180;
//   - Ressurgimento Selvagem, linhas 6182-6227;
//   - Arquidruida (iniciativa), linhas 6229-6243;
//   - ações de subclasse, linhas 5450-5535;
//   - descanso curto, linhas 4405-4408;
//   - descanso longo, linhas 4739-4762.
//
// O que ficou NOS DADOS (e não aqui):
//   - o teto de Forma Selvagem por nível (coluna "Forma Selvagem" da
//     `tabela_caracteristicas` → efeitos `resource` `forma-selvagem-2/6/17`);
//   - as magias de círculo, que são `grant-spell` com `alwaysPrepared: true`
//     nas features `*-magias-do-circulo-*`.
//
// O que exige código:
//   - descanso CURTO devolve exatamente 1 uso de Forma Selvagem
//     (`recuperarUmUsoFormaSelvagem`, sheet.js:906-911, chamado em 4407);
//   - Arquidruida devolve 1 uso APENAS quando não resta nenhum
//     (sheet.js:6234-6238) — daí a extensão `recoverResource` com
//     `requireExhausted`;
//   - as ações que combinam gasto de Forma Selvagem com flag de estado.
//
// Conjuração: nenhum espaço de magia é lido ou escrito aqui. Ver as concerns
// do relatório da Task 21 para as três ações do baseline cujo custo OU
// benefício é um espaço de magia (Ressurgimento Selvagem nos dois sentidos,
// e o fallback de espaço do Companheiro Selvagem) — elas exigem um comando
// orquestrador que fale com o domínio de magias, e modelar só a metade que
// mora aqui produziria uma transação pela metade.
//
// NÃO modelado nesta rodada (ver concerns): Passo Lunar (Círculo da Lua),
// Mapa Estelar e Presságio Cósmico (Círculo das Estrelas) — o máximo dos três
// é o modificador de Sabedoria, que hoje nenhum produtor coloca em
// `context.variables`; e o Círculo do Mar, que no baseline não tem recurso
// nem flag nenhuma.

import { createClassHandler } from './class-handler.js';

const CLASS_ID = 'dnd2024:class:druida';
const TERRA = 'dnd2024:subclass:circulo-da-terra';
const ESTRELAS = 'dnd2024:subclass:circulo-das-estrelas';

export const druidaHandler = createClassHandler({
  id: 'class-druida',
  classId: CLASS_ID,
  resources: [{ key: 'forma-selvagem', label: 'Forma Selvagem', owner: 'class' }],
  flags: [
    { key: 'forma-selvagem-ativa', owner: 'class' },
    { key: 'companheiro-selvagem-ativo', owner: 'class' },
    { key: 'recuperacao-natural-magia-usada', owner: 'subclass', ownerId: TERRA },
    { key: 'recuperacao-natural-slots-usada', owner: 'subclass', ownerId: TERRA },
    { key: 'forma-estrelada-ativa', owner: 'subclass', ownerId: ESTRELAS },
  ],
  actions: [
    // sheet.js:6130-6140 — `data-druida-forma-acao`.
    {
      id: 'ativar-forma-selvagem', label: 'Ativar Forma Selvagem',
      minLevel: 2,
      spend: { resource: 'forma-selvagem', amount: 1 },
      requireFlag: { key: 'forma-selvagem-ativa', value: false },
      setFlags: { 'forma-selvagem-ativa': true },
    },
    {
      id: 'encerrar-forma-selvagem', label: 'Encerrar Forma Selvagem',
      minLevel: 2,
      requireFlag: { key: 'forma-selvagem-ativa', value: true },
      setFlags: { 'forma-selvagem-ativa': false },
    },
    // sheet.js:6164-6166 — invocar o Companheiro Selvagem gastando 1 uso de
    // Forma Selvagem. O fallback "sem usos → gasta um espaço de magia"
    // (6168-6174) é do domínio de magias e não é modelado aqui.
    {
      id: 'invocar-companheiro-selvagem', label: 'Invocar Companheiro Selvagem',
      minLevel: 2,
      spend: { resource: 'forma-selvagem', amount: 1 },
      requireFlag: { key: 'companheiro-selvagem-ativo', value: false },
      setFlags: { 'companheiro-selvagem-ativo': true },
    },
    // sheet.js:6156-6161 — dispensar não devolve o uso.
    {
      id: 'dispensar-companheiro-selvagem', label: 'Dispensar Companheiro Selvagem',
      minLevel: 2,
      requireFlag: { key: 'companheiro-selvagem-ativo', value: true },
      setFlags: { 'companheiro-selvagem-ativo': false },
    },
    // sheet.js:6229-6243 — Arquidruida (nv20): ao rolar iniciativa, recupera
    // 1 uso de Forma Selvagem, e SÓ se não houver nenhum disponível. Não é
    // uso único por descanso (o baseline não guarda flag), então não há flag
    // aqui — só a condição de exaustão.
    {
      id: 'arquidruida-recuperar-forma-selvagem', label: 'Arquidruida (recuperar Forma Selvagem)',
      minLevel: 20,
      recoverResource: { resource: 'forma-selvagem', amount: 1, requireExhausted: true },
    },
    // sheet.js:5473-5484 — Círculo da Terra, Recuperação Natural (nv6): duas
    // metades independentes, cada uma 1× por descanso longo. A metade "magia
    // de círculo grátis" e a metade "recupere N círculos de espaços" são, no
    // baseline, apenas travas booleanas + um toast; a recuperação de espaços
    // em si é marcada manualmente pelo jogador nos slots.
    {
      id: 'terra-recuperacao-natural-magia', label: 'Recuperação Natural — magia grátis',
      minLevel: 6,
      subclassId: TERRA,
      flagOwner: 'subclass',
      requireFlag: { key: 'recuperacao-natural-magia-usada', value: false, owner: 'subclass' },
      setFlags: { 'recuperacao-natural-magia-usada': true },
    },
    {
      id: 'terra-recuperacao-natural-slots', label: 'Recuperação Natural — slots (desc. curto)',
      minLevel: 6,
      subclassId: TERRA,
      flagOwner: 'subclass',
      requireFlag: { key: 'recuperacao-natural-slots-usada', value: false, owner: 'subclass' },
      setFlags: { 'recuperacao-natural-slots-usada': true },
    },
    // sheet.js:5510-5522 — Círculo das Estrelas, Forma Estelar (nv3): ATIVAR
    // uma constelação consome 1 uso de Forma Selvagem, e só na transição
    // "nenhuma → alguma". QUAL constelação está ativa é uma escolha
    // persistente (o baseline guarda a string e NÃO a reseta em descanso
    // nenhum, linha 4759) — isso é vocabulário de `choice`, não flag de uso,
    // e por isso a flag daqui também não entra em nenhuma lista de descanso.
    {
      id: 'estrelas-ativar-forma-estrelada', label: 'Ativar Forma Estrelada',
      minLevel: 3,
      subclassId: ESTRELAS,
      flagOwner: 'subclass',
      spend: { resource: 'forma-selvagem', amount: 1 },
      requireFlag: { key: 'forma-estrelada-ativa', value: false, owner: 'subclass' },
      setFlags: { 'forma-estrelada-ativa': true },
    },
    {
      id: 'estrelas-encerrar-forma-estrelada', label: 'Encerrar Forma Estrelada',
      minLevel: 3,
      subclassId: ESTRELAS,
      flagOwner: 'subclass',
      requireFlag: { key: 'forma-estrelada-ativa', value: true, owner: 'subclass' },
      setFlags: { 'forma-estrelada-ativa': false },
    },
  ],
  rest: {
    // sheet.js:4407 → `recuperarUmUsoFormaSelvagem()` (906-911): exatamente 1.
    short: [{ kind: 'recover-resource', resource: 'forma-selvagem', amount: 1 }],
    // sheet.js:4743-4755.
    long: [
      { kind: 'restore-resource', resource: 'forma-selvagem' },
      { kind: 'clear-flag', flag: 'forma-selvagem-ativa' },
      { kind: 'clear-flag', flag: 'companheiro-selvagem-ativo' },
      { kind: 'clear-flag', flag: 'recuperacao-natural-magia-usada', owner: 'subclass', subclassId: TERRA },
      { kind: 'clear-flag', flag: 'recuperacao-natural-slots-usada', owner: 'subclass', subclassId: TERRA },
    ],
  },
});
