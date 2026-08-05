// Handler oficial do Monge (`class-monge`), extraído de
// `site/js/pages/sheet.js` (`getProgressaoMonge`/`getEstadoRecursosMonge`,
// linhas 2034-2155; ações de Ponto de Foco, linhas 6558-6690; recarga de
// descanso curto, linhas 4473-4492; recarga de descanso longo, linhas
// 4846-4872).
//
// O que ficou NOS DADOS (`dados/pacotes/dnd2024/classes/monge.json`):
//   - Pontos de Foco por nível (`pontos-de-foco-2` .. `pontos-de-foco-20`,
//     um efeito `resource` por nível) — já existia;
//   - dado de Artes Marciais e bônus de Movimento sem Armadura, que são
//     projeção derivada e não recurso.
//
// O que exige código:
//   - o gasto variável de Pontos de Foco por ação (1 no Golpe Atordoante, 4
//     em Passo do Vento composto, 5 em Torrente de Golpes composta no
//     baseline) e o "Metabolismo Incomum", que RESTAURA todos os pontos uma
//     vez por descanso longo — restauração disparada por ação, coisa que o
//     vocabulário declarativo não expressa.
//
// NÃO modelado nesta rodada (ver concerns): CD de Foco, Desviar Ataques,
// Queda Lenta, e as subclasses `Combatente da Mão Espalmada`
// (integridade_usos_gastos, máximo = mod. de Sabedoria) e `Combatente da
// Misericórdia` (torrente_usos_gastos, idem) — os máximos dependem de um
// modificador de atributo, e o vocabulário `resourceEffect.max` só aceita
// inteiro literal ou nome de variável resolvido por `context.variables`, que
// hoje não expõe modificadores de atributo. `Combatente dos Elementos` só
// tem a flag `sintonia_ativa`, coberta abaixo.

import { createClassHandler } from './class-handler.js';

const CLASS_ID = 'dnd2024:class:monge';
const ELEMENTOS = 'dnd2024:subclass:combatente-dos-elementos';

export const mongeHandler = createClassHandler({
  id: 'class-monge',
  classId: CLASS_ID,
  resources: [{ key: 'pontos-de-foco', label: 'Pontos de Foco', owner: 'class' }],
  flags: [
    { key: 'metabolismo-incomum-usado', owner: 'class' },
    { key: 'sintonia-ativa', owner: 'subclass', ownerId: ELEMENTOS },
  ],
  actions: [
    {
      id: 'gastar-ponto-de-foco', label: 'Gastar Ponto de Foco',
      minLevel: 2,
      spend: { resource: 'pontos-de-foco', amount: 1, amountFromPayload: true, maxAmount: 20 },
    },
    { id: 'golpe-atordoante', label: 'Golpe Atordoante', minLevel: 5, spend: { resource: 'pontos-de-foco', amount: 1 } },
    // sheet.js:6591-6592 — Metabolismo Incomum devolve TODOS os pontos e
    // marca a flag; a recarga da flag é o descanso longo.
    {
      id: 'metabolismo-incomum', label: 'Metabolismo Incomum',
      minLevel: 2,
      requireFlag: { key: 'metabolismo-incomum-usado', value: false },
      restoreResource: 'pontos-de-foco',
      setFlags: { 'metabolismo-incomum-usado': true },
    },
  ],
  rest: {
    short: [
      // sheet.js:4480 — descanso curto restaura TODOS os pontos de foco.
      { kind: 'restore-resource', resource: 'pontos-de-foco' },
      // sheet.js:4487 — Combatente dos Elementos perde a Sintonia.
      { kind: 'clear-flag', flag: 'sintonia-ativa', owner: 'subclass', subclassId: ELEMENTOS },
    ],
    long: [
      // sheet.js:4852-4853 — pontos ao máximo e Metabolismo Incomum de volta.
      { kind: 'restore-resource', resource: 'pontos-de-foco' },
      { kind: 'clear-flag', flag: 'metabolismo-incomum-usado' },
      { kind: 'clear-flag', flag: 'sintonia-ativa', owner: 'subclass', subclassId: ELEMENTOS },
    ],
  },
});
