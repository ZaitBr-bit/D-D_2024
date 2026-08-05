// Handler oficial do Bruxo (`class-bruxo`), extraído de
// `site/js/pages/sheet.js` (commit e43c5ea):
//   - `getProgressaoBruxo`/`getCirculosArcanumDesbloqueados`/
//     `getEstadoRecursosBruxo`, linhas 678-822;
//   - Astúcia Mágica, linhas 6051-6076;
//   - Arcana Mística (toggle por círculo), linhas 6077-6092;
//   - ações de subclasse, linhas 5292-5397;
//   - descanso curto, linhas 4397-4403;
//   - descanso longo, linhas 4709-4737.
//
// ## Magia de Pacto NÃO passa por aqui
//
// O Bruxo usa EXCLUSIVAMENTE `state.spells.pactSlots` — nunca a pool normal
// `state.spells.slots`. Esse domínio é o da Task 18: `cast-spell.js` já
// discrimina `{kind:'pact-slot'}` de `{kind:'spell-slot',level}` e lê o total
// de `context.spellcasting.pactSlots`, que hoje é populado pelo CHAMADOR
// (`spellcasting-queries.js#requireRegistry`/`readSpellcastingTable` só
// normalizam o que recebem). A entidade `dnd2024:class:bruxo` também declara um
// efeito `official-handler` `pact-magic-slots` cujo `params` carrega a tabela
// nível->{slots,círculo}, mas NENHUM código de produção o lê hoje — ligar essa
// tabela a `context.spellcasting` é trabalho das tarefas de view-model
// (29/33). Este handler não lê nem escreve `state.spells.*`, e por isso
// `usar-astucia-magica` aqui só QUEIMA O USO ÚNICO da característica:
// a devolução dos espaços de pacto (`recuperarEspacosMagiaBruxo(true)`,
// sheet.js:6065) é responsabilidade do domínio de magias, chamado pelo mesmo
// comando de UI. Modelar a devolução aqui seria reimplementar gasto de slot
// dentro de um handler de classe, o que o brief proíbe.
//
// Pela mesma razão as quatro ações "restaurar (gastando Espaço de Pacto)" do
// baseline (Fuga em Névoa, Defesas Sedutoras, Combatente Clarividente, Lançar
// no Inferno) aparecem aqui SEM o gasto de espaço: o handler limpa a flag, o
// domínio de magias cobra o espaço de pacto.
//
// ## `invocacoes` não é uma reserva gastável
//
// O efeito `resource` `invocacoes` da entidade de classe é um LIMITE DE
// SELEÇÃO (quantas Invocações Místicas você conhece), não um pool que se gasta
// e recarrega — o baseline nunca o decrementa. Declarar esse recurso aqui faria
// o handler projetar `{current: null, missing: true}` para algo que nenhum
// comando materializa. A seleção de invocações é escolha de build (Task 23).
//
// O que ficou NOS DADOS: os tetos de Passos Feéricos / Luz Medicinal / Sorte do
// Tenebroso, agora efeitos `resource` nas entidades de SUBCLASSE
// (`dados/pacotes/dnd2024/classes/bruxo.json`), com `max` numérico ou
// `"carismaModifierMin1"` resolvido por `context.variables`.
//
// NÃO modelado nesta rodada (ver concerns do relatório da Task 22a):
// a escolha de Pacto (Corrente/Lâmina/Tomo) e a lista de invocações, a magia
// escolhida em cada círculo de Arcana Mística (só o "usado" é estado de uso) e
// `resistencia_infera_escolha` — todas são ESCOLHAS de build, não uso de
// recurso.

import { createClassHandler } from './class-handler.js';

const CLASS_ID = 'dnd2024:class:bruxo';
const ARQUIFADA = 'dnd2024:subclass:patrono-arquifada';
const CELESTIAL = 'dnd2024:subclass:patrono-celestial';
const GRANDE_ANTIGO = 'dnd2024:subclass:patrono-o-grande-antigo';
const INFERO = 'dnd2024:subclass:patrono-infero';

// sheet.js:687-694 — os quatro círculos de Arcana Mística e o nível em que
// cada um é destravado. Cada um é uma característica PRÓPRIA no conteúdo
// (`bruxo-arcana-mistica-11/13/15/17`), então os níveis abaixo espelham o
// catálogo, não uma tabela inventada.
const ARCANA_MISTICA = Object.freeze([
  { circulo: 6, minLevel: 11 },
  { circulo: 7, minLevel: 13 },
  { circulo: 8, minLevel: 15 },
  { circulo: 9, minLevel: 17 },
]);

export const bruxoHandler = createClassHandler({
  id: 'class-bruxo',
  classId: CLASS_ID,
  resources: [
    { key: 'passos-feericos', label: 'Passos Feéricos', owner: 'subclass', ownerId: ARQUIFADA },
    { key: 'luz-medicinal', label: 'Luz Medicinal', owner: 'subclass', ownerId: CELESTIAL },
    { key: 'sorte-do-tenebroso', label: 'Sorte do Tenebroso', owner: 'subclass', ownerId: INFERO },
  ],
  flags: [
    { key: 'astucia-magica-usada', owner: 'class' },
    ...ARCANA_MISTICA.map((entry) => ({ key: `arcana-mistica-${entry.circulo}-usada`, owner: 'class' })),
    { key: 'fuga-em-nevoa-usada', owner: 'subclass', ownerId: ARQUIFADA },
    { key: 'defesas-sedutoras-usada', owner: 'subclass', ownerId: ARQUIFADA },
    { key: 'vinganca-calcinante-usada', owner: 'subclass', ownerId: CELESTIAL },
    { key: 'combatente-clarividente-usado', owner: 'subclass', ownerId: GRANDE_ANTIGO },
    { key: 'lancar-no-inferno-usado', owner: 'subclass', ownerId: INFERO },
  ],
  actions: [
    // sheet.js:6056-6074 — Astúcia Mágica (nv2): uso único por descanso longo.
    // Ver o comentário de topo: só a flag é do handler.
    {
      id: 'usar-astucia-magica', label: 'Usar Astúcia Mágica',
      minLevel: 2,
      requireFlag: { key: 'astucia-magica-usada', value: false },
      setFlags: { 'astucia-magica-usada': true },
    },
    // sheet.js:6077-6092 — Arcana Mística: um toggle por círculo destravado.
    // "Marcar uso" e "Restaurar" são ações separadas porque têm pré-condições
    // opostas (mesma convenção do Clérigo na Task 21).
    ...ARCANA_MISTICA.flatMap((entry) => [
      {
        id: `arcana-mistica-${entry.circulo}-marcar-uso`,
        // Rótulo pt-BR (correção I3): "Arcana Mística" é o nome do monólito
        // congelado (`legacy-sheet-source.js:1584`); o círculo é o mesmo
        // parâmetro estruturado que gera a ação.
        label: `Arcana Mística ${entry.circulo}º — marcar uso`,
        minLevel: entry.minLevel,
        requireFlag: { key: `arcana-mistica-${entry.circulo}-usada`, value: false },
        setFlags: { [`arcana-mistica-${entry.circulo}-usada`]: true },
      },
      {
        id: `arcana-mistica-${entry.circulo}-restaurar`,
        label: `Arcana Mística ${entry.circulo}º — restaurar`,
        minLevel: entry.minLevel,
        requireFlag: { key: `arcana-mistica-${entry.circulo}-usada`, value: true },
        setFlags: { [`arcana-mistica-${entry.circulo}-usada`]: false },
      },
    ]),
    // sheet.js:5302-5307 — Patrono Arquifada.
    {
      id: 'arquifada-passos-feericos', label: 'Usar Passos Feéricos',
      minLevel: 3,
      subclassId: ARQUIFADA,
      spend: { resource: 'passos-feericos', amount: 1 },
    },
    {
      id: 'arquifada-fuga-em-nevoa', label: 'Fuga em Névoa',
      minLevel: 6,
      subclassId: ARQUIFADA,
      flagOwner: 'subclass',
      requireFlag: { key: 'fuga-em-nevoa-usada', value: false, owner: 'subclass' },
      setFlags: { 'fuga-em-nevoa-usada': true },
    },
    {
      id: 'arquifada-restaurar-fuga-em-nevoa', label: 'Restaurar Fuga em Névoa (gastar Espaço de Pacto)',
      minLevel: 6,
      subclassId: ARQUIFADA,
      flagOwner: 'subclass',
      requireFlag: { key: 'fuga-em-nevoa-usada', value: true, owner: 'subclass' },
      setFlags: { 'fuga-em-nevoa-usada': false },
    },
    {
      id: 'arquifada-defesas-sedutoras', label: 'Usar Defesas Sedutoras',
      minLevel: 10,
      subclassId: ARQUIFADA,
      flagOwner: 'subclass',
      requireFlag: { key: 'defesas-sedutoras-usada', value: false, owner: 'subclass' },
      setFlags: { 'defesas-sedutoras-usada': true },
    },
    {
      id: 'arquifada-restaurar-defesas-sedutoras', label: 'Restaurar Defesas Sedutoras (gastar Espaço de Pacto)',
      minLevel: 10,
      subclassId: ARQUIFADA,
      flagOwner: 'subclass',
      requireFlag: { key: 'defesas-sedutoras-usada', value: true, owner: 'subclass' },
      setFlags: { 'defesas-sedutoras-usada': false },
    },
    // sheet.js:5329-5341 — Patrono Celestial.
    {
      id: 'celestial-luz-medicinal', label: 'Usar Luz Medicinal',
      minLevel: 3,
      subclassId: CELESTIAL,
      spend: { resource: 'luz-medicinal', amount: 1, amountFromPayload: true },
    },
    {
      id: 'celestial-vinganca-calcinante', label: 'Vingança Calcinante',
      minLevel: 14,
      subclassId: CELESTIAL,
      flagOwner: 'subclass',
      requireFlag: { key: 'vinganca-calcinante-usada', value: false, owner: 'subclass' },
      setFlags: { 'vinganca-calcinante-usada': true },
    },
    // sheet.js:5343-5352 — Patrono O Grande Antigo.
    {
      id: 'grande-antigo-combatente-clarividente', label: 'Usar Combatente Clarividente',
      minLevel: 6,
      subclassId: GRANDE_ANTIGO,
      flagOwner: 'subclass',
      requireFlag: { key: 'combatente-clarividente-usado', value: false, owner: 'subclass' },
      setFlags: { 'combatente-clarividente-usado': true },
    },
    {
      id: 'grande-antigo-restaurar-combatente-clarividente', label: 'Restaurar Combatente Clarividente (gastar Espaço de Pacto)',
      minLevel: 6,
      subclassId: GRANDE_ANTIGO,
      flagOwner: 'subclass',
      requireFlag: { key: 'combatente-clarividente-usado', value: true, owner: 'subclass' },
      setFlags: { 'combatente-clarividente-usado': false },
    },
    // sheet.js:5354-5368 — Patrono Ínfero.
    {
      id: 'infero-sorte-do-tenebroso', label: 'Usar Sorte do Tenebroso',
      minLevel: 6,
      subclassId: INFERO,
      spend: { resource: 'sorte-do-tenebroso', amount: 1 },
    },
    {
      id: 'infero-lancar-no-inferno', label: 'Lançar no Inferno',
      minLevel: 14,
      subclassId: INFERO,
      flagOwner: 'subclass',
      requireFlag: { key: 'lancar-no-inferno-usado', value: false, owner: 'subclass' },
      setFlags: { 'lancar-no-inferno-usado': true },
    },
    {
      id: 'infero-restaurar-lancar-no-inferno', label: 'Restaurar Lançar no Inferno (gastar Espaço de Pacto)',
      minLevel: 14,
      subclassId: INFERO,
      flagOwner: 'subclass',
      requireFlag: { key: 'lancar-no-inferno-usado', value: true, owner: 'subclass' },
      setFlags: { 'lancar-no-inferno-usado': false },
    },
  ],
  rest: {
    // sheet.js:4397-4403 — o descanso curto do Bruxo devolve os espaços de
    // pacto (domínio de magias) e SÓ a flag do Combatente Clarividente aqui.
    short: [
      {
        kind: 'clear-flag',
        flag: 'combatente-clarividente-usado',
        owner: 'subclass',
        subclassId: GRANDE_ANTIGO,
      },
    ],
    // sheet.js:4712-4736.
    long: [
      { kind: 'clear-flag', flag: 'astucia-magica-usada' },
      ...ARCANA_MISTICA.map((entry) => ({ kind: 'clear-flag', flag: `arcana-mistica-${entry.circulo}-usada` })),
      { kind: 'restore-resource', resource: 'passos-feericos', owner: 'subclass', subclassId: ARQUIFADA },
      { kind: 'clear-flag', flag: 'fuga-em-nevoa-usada', owner: 'subclass', subclassId: ARQUIFADA },
      { kind: 'clear-flag', flag: 'defesas-sedutoras-usada', owner: 'subclass', subclassId: ARQUIFADA },
      { kind: 'restore-resource', resource: 'luz-medicinal', owner: 'subclass', subclassId: CELESTIAL },
      { kind: 'clear-flag', flag: 'vinganca-calcinante-usada', owner: 'subclass', subclassId: CELESTIAL },
      {
        kind: 'clear-flag',
        flag: 'combatente-clarividente-usado',
        owner: 'subclass',
        subclassId: GRANDE_ANTIGO,
      },
      { kind: 'restore-resource', resource: 'sorte-do-tenebroso', owner: 'subclass', subclassId: INFERO },
      { kind: 'clear-flag', flag: 'lancar-no-inferno-usado', owner: 'subclass', subclassId: INFERO },
    ],
  },
});
