// Handler oficial do Ladino (`class-ladino`), extraído de
// `site/js/pages/sheet.js` (`getProgressaoLadino`/`getEstadoRecursosLadino`,
// linhas 2159-2290; recarga de descanso curto, linhas 4493-4505; recarga de
// descanso longo, linhas 4877-4890).
//
// O que ficou NOS DADOS (`dados/pacotes/dnd2024/classes/ladino.json`):
//   - Golpe de Sorte (1 uso, nível 20) e os Dados Psiônicos da subclasse
//     `Adaga Espiritual` (4/6/8/10/12 nos níveis 3/5/9/13/17),
//     acrescentados nesta tarefa como efeitos `resource`;
//   - Especialização (`expertise-from-proficient-skills`) continua sendo
//     outro handler oficial já declarado no conteúdo, fora do escopo daqui.
//
// O que exige código:
//   - Golpe de Sorte recarrega em descanso CURTO **e** longo (sheet.js:4495
//     e 4878), o que o vocabulário `recovery` até expressaria, mas os Dados
//     Psiônicos recarregam 1 em curto e todos em longo — recarga parcial,
//     fora do vocabulário. Manter os dois no mesmo dono evita duas fontes de
//     verdade sobre `state.resources` do mesmo personagem.
//
// NÃO modelado nesta rodada (ver concerns): dados de Ataque Furtivo
// (projeção derivada, não recurso), CD de Golpe Astuto, e as subclasses
// `Assassino`, `Ladrão` e `Trapaceiro Arcano`, que no baseline não têm
// recurso numérico nem flag de uso em `char.recursos.ladino`.

import { createClassHandler } from './class-handler.js';

const CLASS_ID = 'dnd2024:class:ladino';
const ADAGA_ESPIRITUAL = 'dnd2024:subclass:adaga-espiritual';

export const ladinoHandler = createClassHandler({
  id: 'class-ladino',
  classId: CLASS_ID,
  resources: [
    { key: 'golpe-de-sorte', label: 'Golpe de Sorte', owner: 'class' },
    { key: 'dados-psionicos', label: 'Dados Psiônicos', owner: 'subclass', ownerId: ADAGA_ESPIRITUAL },
  ],
  flags: [
    { key: 'sussurros-gratis-usado', owner: 'subclass', ownerId: ADAGA_ESPIRITUAL },
    { key: 'veu-psiquico-usado', owner: 'subclass', ownerId: ADAGA_ESPIRITUAL },
    { key: 'rasgar-mente-usado', owner: 'subclass', ownerId: ADAGA_ESPIRITUAL },
  ],
  actions: [
    { id: 'usar-golpe-de-sorte', label: 'Usar Golpe de Sorte', minLevel: 20, spend: { resource: 'golpe-de-sorte', amount: 1 } },
    {
      id: 'gastar-dado-psionico', label: 'Gastar Dado Psiônico',
      minLevel: 3,
      subclassId: ADAGA_ESPIRITUAL,
      spend: { resource: 'dados-psionicos', amount: 1, amountFromPayload: true, maxAmount: 12 },
    },
    {
      id: 'sussurros-psiquicos', label: 'Sussurros Psíquicos',
      minLevel: 3,
      subclassId: ADAGA_ESPIRITUAL,
      flagOwner: 'subclass',
      requireFlag: { key: 'sussurros-gratis-usado', value: false, owner: 'subclass' },
      setFlags: { 'sussurros-gratis-usado': true },
    },
    {
      id: 'veu-psiquico', label: 'Véu Psíquico',
      minLevel: 13,
      subclassId: ADAGA_ESPIRITUAL,
      flagOwner: 'subclass',
      requireFlag: { key: 'veu-psiquico-usado', value: false, owner: 'subclass' },
      setFlags: { 'veu-psiquico-usado': true },
    },
    {
      id: 'rasgar-mente', label: 'Rasgar Mente',
      minLevel: 17,
      subclassId: ADAGA_ESPIRITUAL,
      flagOwner: 'subclass',
      requireFlag: { key: 'rasgar-mente-usado', value: false, owner: 'subclass' },
      setFlags: { 'rasgar-mente-usado': true },
    },
  ],
  rest: {
    short: [
      // sheet.js:4495 — Golpe de Sorte volta em descanso curto.
      { kind: 'restore-resource', resource: 'golpe-de-sorte' },
      // sheet.js:4499-4502 — Adaga Espiritual recupera 1 dado psiônico.
      { kind: 'recover-resource', resource: 'dados-psionicos', amount: 1, owner: 'subclass', subclassId: ADAGA_ESPIRITUAL },
    ],
    long: [
      // sheet.js:4878-4888 — tudo ao máximo, flags de uso limpas.
      { kind: 'restore-resource', resource: 'golpe-de-sorte' },
      { kind: 'restore-resource', resource: 'dados-psionicos', owner: 'subclass', subclassId: ADAGA_ESPIRITUAL },
      { kind: 'clear-flag', flag: 'sussurros-gratis-usado', owner: 'subclass', subclassId: ADAGA_ESPIRITUAL },
      { kind: 'clear-flag', flag: 'veu-psiquico-usado', owner: 'subclass', subclassId: ADAGA_ESPIRITUAL },
      { kind: 'clear-flag', flag: 'rasgar-mente-usado', owner: 'subclass', subclassId: ADAGA_ESPIRITUAL },
    ],
  },
});
