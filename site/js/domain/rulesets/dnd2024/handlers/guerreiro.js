// Handler oficial do Guerreiro (`class-guerreiro`), extraído de
// `site/js/pages/sheet.js` (`getProgressaoGuerreiro`/`getEstadoRecursosGuerreiro`,
// linhas 1056-1218; recarga de descanso curto, linhas 4410-4437; recarga de
// descanso longo, linhas 4659-4682).
//
// O que ficou NOS DADOS (`dados/pacotes/dnd2024/classes/guerreiro.json`):
//   - Recuperar Fôlego 2/3/4 (níveis 1/4/10) — já existia;
//   - Maestria em Arma 3/4/5/6 — já existia;
//   - Surto de Ação 1 (nv2) / 2 (nv17) e Indomável 1/2/3 (nv9/13/17) —
//     acrescentados nesta tarefa como efeitos `resource`, em vez de ficarem
//     como escada `if (nivel >= N)` embutida no handler (sheet.js:1119-1125);
//   - Dados de Superioridade 4/5/6 (nv3/7/15) na entidade da subclasse
//     `Mestre da Batalha` e Dados Psiônicos 4/6/8/10/12 na entidade
//     `Combatente Psíquico` — assim a proveniência dos dois é a SUBCLASSE,
//     não a classe, e o isolamento de `state.resources` é real.
//
// O que exige código:
//   - descanso curto devolve 1 uso de Recuperar Fôlego (não o máximo) e 1
//     Dado Psiônico, mas restaura TODO o Surto de Ação e TODOS os Dados de
//     Superioridade — quatro recargas diferentes num mesmo descanso, fora do
//     vocabulário `resourceEffect.recovery`.
//
// NÃO modelado nesta rodada (ver concerns): tipo do dado de superioridade
// (d8/d10/d12), CD de manobra, contagem de manobras conhecidas
// (`combat-maneuvers-known` é outro handler oficial, já declarado no
// conteúdo e ainda não implementado), e as habilidades "grátis 1x, depois
// gasta dado" do Combatente Psíquico (movimento telecinético, salto,
// baluarte, mestre telecinético) — estas últimas são flags cuja recarga
// está coberta abaixo, mas cujo custo alternativo não está.

import { createClassHandler } from './class-handler.js';

const CLASS_ID = 'dnd2024:class:guerreiro';
const MESTRE_DA_BATALHA = 'dnd2024:subclass:mestre-da-batalha';
const COMBATENTE_PSIQUICO = 'dnd2024:subclass:combatente-psiquico';

export const guerreiroHandler = createClassHandler({
  id: 'class-guerreiro',
  classId: CLASS_ID,
  resources: [
    { key: 'recuperar-folego', label: 'Recuperar Fôlego', owner: 'class' },
    { key: 'surto-de-acao', label: 'Surto de Ação', owner: 'class' },
    { key: 'indomavel', label: 'Indomável', owner: 'class' },
    { key: 'dados-de-superioridade', label: 'Dados de Superioridade', owner: 'subclass', ownerId: MESTRE_DA_BATALHA },
    { key: 'dados-psionicos', label: 'Dados Psiônicos', owner: 'subclass', ownerId: COMBATENTE_PSIQUICO },
  ],
  flags: [
    { key: 'conheca-seu-inimigo-usado', owner: 'subclass', ownerId: MESTRE_DA_BATALHA },
    { key: 'movimento-telecinetico-usado', owner: 'subclass', ownerId: COMBATENTE_PSIQUICO },
    { key: 'salto-impulsao-usado', owner: 'subclass', ownerId: COMBATENTE_PSIQUICO },
    { key: 'baluarte-usado', owner: 'subclass', ownerId: COMBATENTE_PSIQUICO },
    { key: 'mestre-telecinetico-usado', owner: 'subclass', ownerId: COMBATENTE_PSIQUICO },
  ],
  actions: [
    { id: 'usar-recuperar-folego', label: 'Recuperar Fôlego', minLevel: 1, spend: { resource: 'recuperar-folego', amount: 1 } },
    { id: 'usar-surto-de-acao', label: 'Surto de Ação', minLevel: 2, spend: { resource: 'surto-de-acao', amount: 1 } },
    { id: 'usar-indomavel', label: 'Indomável', minLevel: 9, spend: { resource: 'indomavel', amount: 1 } },
    {
      id: 'usar-dado-de-superioridade', label: 'Usar Dado de Superioridade',
      minLevel: 3,
      subclassId: MESTRE_DA_BATALHA,
      spend: { resource: 'dados-de-superioridade', amount: 1 },
    },
    // sheet.js:10340-10341 — "Conheça Seu Inimigo" é 1x por descanso longo,
    // ou de novo gastando 1 dado de superioridade.
    {
      id: 'conheca-seu-inimigo', label: 'Conheça Seu Inimigo',
      minLevel: 7,
      subclassId: MESTRE_DA_BATALHA,
      flagOwner: 'subclass',
      requireFlag: { key: 'conheca-seu-inimigo-usado', value: false, owner: 'subclass' },
      setFlags: { 'conheca-seu-inimigo-usado': true },
    },
    {
      id: 'conheca-seu-inimigo-com-dado', label: 'Conheça Seu Inimigo (com Dado de Superioridade)',
      minLevel: 7,
      subclassId: MESTRE_DA_BATALHA,
      spend: { resource: 'dados-de-superioridade', amount: 1 },
    },
    {
      id: 'gastar-dado-psionico', label: 'Gastar Dado Psiônico',
      minLevel: 3,
      subclassId: COMBATENTE_PSIQUICO,
      spend: { resource: 'dados-psionicos', amount: 1, amountFromPayload: true, maxAmount: 12 },
    },
  ],
  rest: {
    short: [
      // sheet.js:4415-4419 — 1 uso, não o máximo.
      { kind: 'recover-resource', resource: 'recuperar-folego', amount: 1 },
      // sheet.js:4420 — Surto de Ação volta ao máximo.
      { kind: 'restore-resource', resource: 'surto-de-acao' },
      // sheet.js:4424 — Mestre da Batalha recupera TODOS os dados.
      { kind: 'restore-resource', resource: 'dados-de-superioridade', owner: 'subclass', subclassId: MESTRE_DA_BATALHA },
      // sheet.js:4429-4436 — Combatente Psíquico recupera 1 dado e as duas
      // habilidades "grátis por descanso curto".
      { kind: 'recover-resource', resource: 'dados-psionicos', amount: 1, owner: 'subclass', subclassId: COMBATENTE_PSIQUICO },
      { kind: 'clear-flag', flag: 'movimento-telecinetico-usado', owner: 'subclass', subclassId: COMBATENTE_PSIQUICO },
      { kind: 'clear-flag', flag: 'salto-impulsao-usado', owner: 'subclass', subclassId: COMBATENTE_PSIQUICO },
    ],
    long: [
      // sheet.js:4663-4681 — tudo ao máximo, todas as flags limpas.
      { kind: 'restore-resource', resource: 'recuperar-folego' },
      { kind: 'restore-resource', resource: 'surto-de-acao' },
      { kind: 'restore-resource', resource: 'indomavel' },
      { kind: 'restore-resource', resource: 'dados-de-superioridade', owner: 'subclass', subclassId: MESTRE_DA_BATALHA },
      { kind: 'clear-flag', flag: 'conheca-seu-inimigo-usado', owner: 'subclass', subclassId: MESTRE_DA_BATALHA },
      { kind: 'restore-resource', resource: 'dados-psionicos', owner: 'subclass', subclassId: COMBATENTE_PSIQUICO },
      { kind: 'clear-flag', flag: 'movimento-telecinetico-usado', owner: 'subclass', subclassId: COMBATENTE_PSIQUICO },
      { kind: 'clear-flag', flag: 'salto-impulsao-usado', owner: 'subclass', subclassId: COMBATENTE_PSIQUICO },
      { kind: 'clear-flag', flag: 'baluarte-usado', owner: 'subclass', subclassId: COMBATENTE_PSIQUICO },
      { kind: 'clear-flag', flag: 'mestre-telecinetico-usado', owner: 'subclass', subclassId: COMBATENTE_PSIQUICO },
    ],
  },
});
