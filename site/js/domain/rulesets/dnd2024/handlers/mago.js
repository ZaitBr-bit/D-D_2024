// Handler oficial do Mago (`class-mago`), extraído de
// `site/js/pages/sheet.js` (commit e43c5ea):
//   - `getEstadoRecursosMago`, linhas 2294-2400;
//   - Recuperação Arcana e Assinatura Mágica, linhas 6781-6885;
//   - ações de subclasse, linhas 6891 em diante;
//   - descanso curto, linhas 4507-4527;
//   - descanso longo, linhas 4891-4929.
//
// ## Conjuração e grimório NÃO passam por aqui
//
// "Magia do grimório sempre preparada" já é vocabulário do domínio de magias
// (Task 18): `selection.preparedFrom === 'spellbook'`
// (`site/js/domain/spells/spell-selection.js:283`) — mesmo padrão decidido para
// as magias de domínio do Clérigo na Task 21. Este handler não declara nenhum
// recurso `spell-slot-N`/`magias-preparadas`/`truques` e não lê nem escreve
// `state.spells.*`.
//
// Por isso `usar-recuperacao-arcana` aqui QUEIMA APENAS O USO ÚNICO da
// característica: quais espaços gastos voltam (círculos combinados <=
// `ceil(nível / 2)`, máximo 5º) é escolha do jogador aplicada pelo domínio de
// magias (`sheet.js:6851-6858`), não estado de recurso de classe. O mesmo vale
// para as duas Assinaturas Mágicas (nv20), que conjuram uma magia de 3º círculo
// sem gastar espaço: o handler só sabe que aquele uso foi consumido.
//
// O que exige código (fora do vocabulário declarativo):
//   - a Assinatura Mágica recarrega em descanso CURTO ou longo, mas só existe
//     do nível 20 em diante (`sheet.js:4510-4514`) — daí `rest.short[].minLevel`;
//   - as flags de uso único de classe e de subclasse, e o fato de O Terceiro
//     Olho (Adivinhador) e a Autoimagem Ilusória (Ilusionista) voltarem já no
//     descanso CURTO, enquanto as demais flags de subclasse só voltam no longo.
//
// NÃO modelado nesta rodada (ver concerns do relatório da Task 22a):
// os PV da Proteção Arcana do Abjurador (`(nível * 2) + mod. Inteligência`, um
// pool de pontos de vida temporários que pertence ao domínio de PV, não a
// `state.resources`), os dados de Prodígio do Adivinhador (valores SORTEADOS a
// cada descanso longo — aleatoriedade não entra num comando determinístico) e o
// contador `sobrecarga_usos` do Evocador.

import { createClassHandler } from './class-handler.js';

const CLASS_ID = 'dnd2024:class:mago';
const ABJURADOR = 'dnd2024:subclass:abjurador';
const ADIVINHADOR = 'dnd2024:subclass:adivinhador';
const ILUSIONISTA = 'dnd2024:subclass:ilusionista';

export const magoHandler = createClassHandler({
  id: 'class-mago',
  classId: CLASS_ID,
  // O Mago não tem NENHUMA reserva contável própria no baseline: Recuperação
  // Arcana e Assinatura Mágica são usos únicos (flags), e todo o resto é
  // espaço de magia. A lista vazia é por construção, não por omissão.
  resources: [],
  flags: [
    { key: 'recuperacao-arcana-usada', owner: 'class' },
    { key: 'assinatura-magica-1-usada', owner: 'class' },
    { key: 'assinatura-magica-2-usada', owner: 'class' },
    { key: 'protecao-arcana-criada', owner: 'subclass', ownerId: ABJURADOR },
    { key: 'terceiro-olho-usado', owner: 'subclass', ownerId: ADIVINHADOR },
    { key: 'criaturas-espectrais-feerica-usada', owner: 'subclass', ownerId: ILUSIONISTA },
    { key: 'criaturas-espectrais-fera-usada', owner: 'subclass', ownerId: ILUSIONISTA },
    { key: 'autoimagem-ilusoria-usada', owner: 'subclass', ownerId: ILUSIONISTA },
  ],
  actions: [
    // sheet.js:6790-6863 — Recuperação Arcana (nv1): uso único por descanso
    // longo. Ver o comentário de topo: a devolução dos espaços é do domínio de
    // magias.
    {
      id: 'usar-recuperacao-arcana', label: 'Recuperação Arcana',
      minLevel: 1,
      requireFlag: { key: 'recuperacao-arcana-usada', value: false },
      setFlags: { 'recuperacao-arcana-usada': true },
    },
    // sheet.js:6865-6883 — as duas Assinaturas Mágicas (nv20).
    {
      id: 'usar-assinatura-magica-1', label: 'Assinatura Mágica (1ª magia)',
      minLevel: 20,
      requireFlag: { key: 'assinatura-magica-1-usada', value: false },
      setFlags: { 'assinatura-magica-1-usada': true },
    },
    {
      id: 'usar-assinatura-magica-2', label: 'Assinatura Mágica (2ª magia)',
      minLevel: 20,
      requireFlag: { key: 'assinatura-magica-2-usada', value: false },
      setFlags: { 'assinatura-magica-2-usada': true },
    },
    // Abjurador (nv3): a Proteção Arcana é criada uma vez por descanso longo.
    {
      id: 'abjurador-criar-protecao-arcana', label: 'Criar Proteção Arcana',
      minLevel: 3,
      subclassId: ABJURADOR,
      flagOwner: 'subclass',
      requireFlag: { key: 'protecao-arcana-criada', value: false, owner: 'subclass' },
      setFlags: { 'protecao-arcana-criada': true },
    },
    // Adivinhador (nv10): O Terceiro Olho recarrega em descanso curto ou longo.
    {
      id: 'adivinhador-terceiro-olho', label: 'Terceiro Olho',
      minLevel: 10,
      subclassId: ADIVINHADOR,
      flagOwner: 'subclass',
      requireFlag: { key: 'terceiro-olho-usado', value: false, owner: 'subclass' },
      setFlags: { 'terceiro-olho-usado': true },
    },
    // Ilusionista: Criaturas Espectrais (nv6) tem uma invocação feérica e uma
    // de fera, cada uma 1x por descanso longo; Autoimagem Ilusória (nv10) é 1x.
    {
      id: 'ilusionista-criaturas-espectrais-feerica', label: 'Convocar Feérico (Criaturas Espectrais)',
      minLevel: 6,
      subclassId: ILUSIONISTA,
      flagOwner: 'subclass',
      requireFlag: { key: 'criaturas-espectrais-feerica-usada', value: false, owner: 'subclass' },
      setFlags: { 'criaturas-espectrais-feerica-usada': true },
    },
    {
      id: 'ilusionista-criaturas-espectrais-fera', label: 'Invocar Fera (Criaturas Espectrais)',
      minLevel: 6,
      subclassId: ILUSIONISTA,
      flagOwner: 'subclass',
      requireFlag: { key: 'criaturas-espectrais-fera-usada', value: false, owner: 'subclass' },
      setFlags: { 'criaturas-espectrais-fera-usada': true },
    },
    {
      id: 'ilusionista-autoimagem-ilusoria', label: 'Usar Autoimagem Ilusória',
      minLevel: 10,
      subclassId: ILUSIONISTA,
      flagOwner: 'subclass',
      requireFlag: { key: 'autoimagem-ilusoria-usada', value: false, owner: 'subclass' },
      setFlags: { 'autoimagem-ilusoria-usada': true },
    },
  ],
  rest: {
    // sheet.js:4507-4527 — no descanso curto voltam as Assinaturas Mágicas
    // (nv20), O Terceiro Olho do Adivinhador (sheet.js:4519-4521) e a
    // Autoimagem Ilusória do Ilusionista (sheet.js:4523-4525).
    short: [
      { kind: 'clear-flag', flag: 'assinatura-magica-1-usada', minLevel: 20 },
      { kind: 'clear-flag', flag: 'assinatura-magica-2-usada', minLevel: 20 },
      { kind: 'clear-flag', flag: 'terceiro-olho-usado', owner: 'subclass', subclassId: ADIVINHADOR },
      { kind: 'clear-flag', flag: 'autoimagem-ilusoria-usada', owner: 'subclass', subclassId: ILUSIONISTA },
    ],
    // sheet.js:4893-4928.
    long: [
      { kind: 'clear-flag', flag: 'recuperacao-arcana-usada' },
      { kind: 'clear-flag', flag: 'assinatura-magica-1-usada' },
      { kind: 'clear-flag', flag: 'assinatura-magica-2-usada' },
      { kind: 'clear-flag', flag: 'protecao-arcana-criada', owner: 'subclass', subclassId: ABJURADOR },
      { kind: 'clear-flag', flag: 'terceiro-olho-usado', owner: 'subclass', subclassId: ADIVINHADOR },
      {
        kind: 'clear-flag',
        flag: 'criaturas-espectrais-feerica-usada',
        owner: 'subclass',
        subclassId: ILUSIONISTA,
      },
      { kind: 'clear-flag', flag: 'criaturas-espectrais-fera-usada', owner: 'subclass', subclassId: ILUSIONISTA },
      { kind: 'clear-flag', flag: 'autoimagem-ilusoria-usada', owner: 'subclass', subclassId: ILUSIONISTA },
    ],
  },
});
