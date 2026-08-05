// Handler oficial do Bardo (`class-bardo`), extraído de
// `site/js/pages/sheet.js` (commit e43c5ea):
//   - `getProgressaoBardo`/`getEstadoInspiracaoBardo`, linhas 443-469;
//   - ações de Inspiração de Bardo, linhas 6011-6049;
//   - ações de subclasse (Dança, Conhecimento, Glamour), linhas 5538-5634;
//   - descanso curto, linhas 4361-4374;
//   - descanso longo, linhas 4645-4658.
//
// O que ficou NOS DADOS (e não aqui):
//   - o teto de usos de Inspiração (`Math.max(1, mod. Carisma)`), agora um
//     efeito `resource` `inspiracao-de-bardo` com `max: "carismaModifierMin1"`
//     em `dados/pacotes/dnd2024/classes/bardo.json`, resolvido pelo motor de
//     efeitos contra `context.variables` (Task 22a);
//   - o DADO de Inspiração por nível (D6..D12): já é o efeito `resource`
//     `dados-de-inspiracao` gerado da coluna "Dados de Inspiração". É um valor
//     de apresentação (tamanho de dado), não uma reserva gastável — por isso
//     este handler NÃO o declara e nunca tenta resolvê-lo como número;
//   - todo texto de apresentação das características.
//
// O que exige código (fora do vocabulário declarativo):
//   - "Fonte de Inspiração" (nv5) faz o descanso CURTO devolver TODOS os usos,
//     e `resourceEffect.recovery` não sabe condicionar recarga a nível — daí
//     `rest.short[].minLevel`;
//   - as cinco ações de subclasse que consomem 1 uso de Inspiração e as três
//     flags de uso único do Colégio do Glamour.
//
// Conjuração: NADA de conjuração passa por aqui. Espaços de magia, magias
// preparadas, truques e concentração do Bardo são do domínio de magias
// (`site/js/domain/spells/*`, Task 18). Este handler não declara nenhum recurso
// `spell-slot-N`/`magias-preparadas`/`truques`.
//
// ## DIVERGÊNCIA DELIBERADA do baseline: Inspiração Superior (nv18)
//
// `site/js/pages/sheet.js:6035-6043` implementa Inspiração Superior como um
// "complete até 2 usos": com 1 uso restante de um teto de 5, o botão sobe para
// 2. A regra do PHB 2024 é "quando você rola Iniciativa e NÃO TEM nenhum uso
// restante, você recupera dois usos". O baseline, portanto, concede recarga
// numa situação em que a regra não concede.
//
// Aqui a ação é modelada com `requireExhausted: true` — só recarrega com o
// recurso ZERADO —, e nesse caso o resultado é numericamente idêntico ao do
// baseline (`min(teto, 0 + 2)` = `min(2, teto)` = o `alvo` do baseline). A
// divergência aparece SOMENTE no caso que o baseline permite indevidamente, e
// está coberta pelo teste nomeado
// "Inspiração Superior exige o recurso zerado (divergência deliberada)".
//
// NÃO modelado nesta rodada (ver concerns do relatório da Task 22a):
// o Colégio da Bravura (Inspiração em Combate é só apresentação no baseline —
// não grava estado) e "Palavras de Criação" (nv20, sem estado no baseline).

import { createClassHandler } from './class-handler.js';

const CLASS_ID = 'dnd2024:class:bardo';
const DANCA = 'dnd2024:subclass:colegio-da-danca';
const CONHECIMENTO = 'dnd2024:subclass:colegio-do-conhecimento';
const GLAMOUR = 'dnd2024:subclass:colegio-do-glamour';

// Gasto padrão de 1 uso de Inspiração, compartilhado pelas cinco ações que o
// baseline lista em `usaInspiracao` (`sheet.js:5551-5557`).
const GASTA_INSPIRACAO = Object.freeze({ resource: 'inspiracao-de-bardo', amount: 1 });

export const bardoHandler = createClassHandler({
  id: 'class-bardo',
  classId: CLASS_ID,
  resources: [{ key: 'inspiracao-de-bardo', label: 'Inspiração de Bardo', owner: 'class' }],
  flags: [
    { key: 'magia-fascinante-usada', owner: 'subclass', ownerId: GLAMOUR },
    { key: 'manto-de-majestade-usado', owner: 'subclass', ownerId: GLAMOUR },
    { key: 'majestade-inquebravel-usada', owner: 'subclass', ownerId: GLAMOUR },
  ],
  actions: [
    // sheet.js:6022-6033 — o botão `data-inspiracao-acao="usar"`.
    { id: 'usar-inspiracao', label: 'Usar Inspiração', minLevel: 1, spend: GASTA_INSPIRACAO },
    // sheet.js:6035-6043 — ver a divergência deliberada no comentário de topo.
    {
      id: 'inspiracao-superior-iniciativa', label: 'Inspiração Superior (Iniciativa)',
      minLevel: 18,
      recoverResource: { resource: 'inspiracao-de-bardo', amount: 2, requireExhausted: true },
    },
    // sheet.js:5566-5572 — Colégio da Dança (features de nível 6).
    { id: 'danca-gingado-coordenado', label: 'Gingado Coordenado', minLevel: 6, subclassId: DANCA, spend: GASTA_INSPIRACAO },
    { id: 'danca-movimento-inspirador', label: 'Movimento Inspirador', minLevel: 6, subclassId: DANCA, spend: GASTA_INSPIRACAO },
    // sheet.js:5574-5582 — Colégio do Conhecimento (nv3 e nv14).
    { id: 'conhecimento-palavras-de-interrupcao', label: 'Palavras de Interrupção', minLevel: 3, subclassId: CONHECIMENTO, spend: GASTA_INSPIRACAO },
    { id: 'conhecimento-pericia-inigualavel', label: 'Perícia Inigualável', minLevel: 14, subclassId: CONHECIMENTO, spend: GASTA_INSPIRACAO },
    // sheet.js:5584-5586 — Manto de Inspiração gasta 1 uso e não grava flag.
    { id: 'glamour-manto-de-inspiracao', label: 'Manto de Inspiração', minLevel: 3, subclassId: GLAMOUR, spend: GASTA_INSPIRACAO },
    // sheet.js:5588-5595 — Magia Fascinante: uso único por descanso longo.
    {
      id: 'glamour-magia-fascinante', label: 'Magia Fascinante',
      minLevel: 3,
      subclassId: GLAMOUR,
      flagOwner: 'subclass',
      requireFlag: { key: 'magia-fascinante-usada', value: false, owner: 'subclass' },
      setFlags: { 'magia-fascinante-usada': true },
    },
    // sheet.js:5597-5608 — restaurar Magia Fascinante GASTA 1 uso de
    // Inspiração. O gasto e a flag são aplicados juntos: se o recurso não
    // bastar, `execute` falha ANTES de escrever a flag (ver `class-handler.js`,
    // ordem de `resourceWrites`/`flagWrites`).
    {
      id: 'glamour-restaurar-magia-fascinante', label: 'Restaurar Magia Fascinante (gastar Inspiração)',
      minLevel: 3,
      subclassId: GLAMOUR,
      flagOwner: 'subclass',
      spend: GASTA_INSPIRACAO,
      requireFlag: { key: 'magia-fascinante-usada', value: true, owner: 'subclass' },
      setFlags: { 'magia-fascinante-usada': false },
    },
    // sheet.js:5610-5617 — Manto de Majestade (nv6): uso único por descanso longo.
    {
      id: 'glamour-manto-de-majestade', label: 'Ativar Manto de Majestade',
      minLevel: 6,
      subclassId: GLAMOUR,
      flagOwner: 'subclass',
      requireFlag: { key: 'manto-de-majestade-usado', value: false, owner: 'subclass' },
      setFlags: { 'manto-de-majestade-usado': true },
    },
    // sheet.js:5619-5626 — Majestade Inquebrável (nv14): recarrega em descanso
    // curto OU longo (`sheet.js:4367-4373`).
    {
      id: 'glamour-majestade-inquebravel', label: 'Majestade Inquebrável',
      minLevel: 14,
      subclassId: GLAMOUR,
      flagOwner: 'subclass',
      requireFlag: { key: 'majestade-inquebravel-usada', value: false, owner: 'subclass' },
      setFlags: { 'majestade-inquebravel-usada': true },
    },
  ],
  rest: {
    short: [
      // sheet.js:4362-4365 — só do nível 5 em diante ("Fonte de Inspiração").
      { kind: 'restore-resource', resource: 'inspiracao-de-bardo', minLevel: 5 },
      // sheet.js:4367-4373 — Majestade Inquebrável volta no descanso curto.
      {
        kind: 'clear-flag',
        flag: 'majestade-inquebravel-usada',
        owner: 'subclass',
        subclassId: GLAMOUR,
      },
    ],
    long: [
      // sheet.js:4647-4649 — o descanso longo devolve TODOS os usos em
      // qualquer nível.
      { kind: 'restore-resource', resource: 'inspiracao-de-bardo' },
      // sheet.js:4652-4656 — as três flags do Glamour.
      { kind: 'clear-flag', flag: 'magia-fascinante-usada', owner: 'subclass', subclassId: GLAMOUR },
      { kind: 'clear-flag', flag: 'manto-de-majestade-usado', owner: 'subclass', subclassId: GLAMOUR },
      { kind: 'clear-flag', flag: 'majestade-inquebravel-usada', owner: 'subclass', subclassId: GLAMOUR },
    ],
  },
});
