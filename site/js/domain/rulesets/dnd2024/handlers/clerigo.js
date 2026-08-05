// Handler oficial do Clérigo (`class-clerigo`), extraído de
// `site/js/pages/sheet.js` (commit e43c5ea):
//   - `getProgressaoClerigo`/`getEstadoRecursosClerigo`, linhas 572-638;
//   - `getEstadoSubclassesClerigo`, linhas 640-676;
//   - ações de Canalizar Divindade, linhas 5104-5135;
//   - Intervenção Divina, linhas 5151-5186;
//   - ações de subclasse, linhas 5188-5289;
//   - descanso curto, linhas 4375-4394;
//   - descanso longo, linhas 4684-4706.
//
// O que ficou NOS DADOS (e não aqui):
//   - o teto de Canalizar Divindade por nível (coluna "Canalizar Divindade"
//     da `tabela_caracteristicas`, já convertida em efeitos `resource`
//     `canalizar-divindade-2/6/18` em `dados/pacotes/dnd2024/classes/clerigo.json`);
//   - as magias de domínio, que são `grant-spell` com `alwaysPrepared: true`
//     nas features `*-magias-de-dominio-*` — "magia sempre preparada" já é
//     vocabulário declarativo, resolvido pelo motor de efeitos da Task 15 e
//     consumido pelo domínio de magias da Task 18. O handler NÃO as replica;
//   - todo texto de apresentação das características.
//
// O que exige código (fora do vocabulário declarativo):
//   - descanso CURTO devolve exatamente 1 uso de Canalizar Divindade
//     (`sheet.js:4379-4382`), e `resourceEffect.recovery` só sabe "restaura
//     ao máximo";
//   - as ações de subclasse que consomem Canalizar Divindade e as que ligam/
//     desligam uma flag de uso.
//
// Conjuração: NADA de conjuração passa por aqui. Espaços de magia, magias
// preparadas, truques e concentração do Clérigo são do domínio de magias
// (`site/js/domain/spells/*`). Este handler não declara nenhum recurso
// `spell-slot-N`/`magias-preparadas`/`truques`, ainda que a entidade de
// classe os declare.
//
// NÃO modelado nesta rodada (ver concerns do relatório da Task 21):
// Sacerdote da Guerra, Labareda Protetora e Coroa de Luz (máximo é o
// modificador de Sabedoria, que hoje nenhum produtor coloca em
// `context.variables`), o cooldown aleatório de 2d4 descansos da Intervenção
// Divina Maior e a escolha de Golpes Abençoados.

import { createClassHandler } from './class-handler.js';

const CLASS_ID = 'dnd2024:class:clerigo';
const GUERRA = 'dnd2024:subclass:dominio-da-guerra';
const LUZ = 'dnd2024:subclass:dominio-da-luz';
const TRAPACA = 'dnd2024:subclass:dominio-da-trapaca';
const VIDA = 'dnd2024:subclass:dominio-da-vida';

export const clerigoHandler = createClassHandler({
  id: 'class-clerigo',
  classId: CLASS_ID,
  resources: [{ key: 'canalizar-divindade', label: 'Canalizar Divindade', owner: 'class' }],
  flags: [
    { key: 'intervencao-divina-usada', owner: 'class' },
    { key: 'bencao-trapaceiro-ativa', owner: 'subclass', ownerId: TRAPACA },
    { key: 'invocar-duplicidade-ativa', owner: 'subclass', ownerId: TRAPACA },
  ],
  actions: [
    // sheet.js:5124-5130 — as três opções do botão `data-clerigo-cd-acao`
    // gastam 1 uso cada. Os degraus de dano (1d8..4d8) são projeção derivada,
    // não estado: ficam com as queries da Task 16.
    { id: 'centelha-divina', label: 'Centelha Divina', minLevel: 2, spend: { resource: 'canalizar-divindade', amount: 1 } },
    { id: 'expulsar-mortos-vivos', label: 'Expulsar Mortos-Vivos', minLevel: 2, spend: { resource: 'canalizar-divindade', amount: 1 } },
    // Fulminar Mortos-Vivos é característica de nível 5 (feature
    // `dnd2024:feature:clerigo-fulminar-mortos-vivos`, level 5).
    { id: 'fulminar-mortos-vivos', label: 'Fulminar Mortos-Vivos', minLevel: 5, spend: { resource: 'canalizar-divindade', amount: 1 } },
    // sheet.js:5151-5186 — Intervenção Divina (nv10): uso único que volta no
    // descanso longo. O ramo `acao === 'desejo'` (Intervenção Divina Maior,
    // nv20) sorteia 2d4 descansos de cooldown e NÃO é modelado aqui.
    {
      id: 'usar-intervencao-divina', label: 'Usar Intervenção Divina',
      minLevel: 10,
      requireFlag: { key: 'intervencao-divina-usada', value: false },
      setFlags: { 'intervencao-divina-usada': true },
    },
    // sheet.js:5214-5222 — Domínio da Guerra.
    {
      id: 'guerra-ataque-direcionado', label: 'Ataque Direcionado',
      minLevel: 3,
      subclassId: GUERRA,
      spend: { resource: 'canalizar-divindade', amount: 1 },
    },
    {
      id: 'guerra-bencao-do-deus-da-guerra', label: 'Bênção do Deus da Guerra',
      minLevel: 6,
      subclassId: GUERRA,
      spend: { resource: 'canalizar-divindade', amount: 1 },
    },
    // sheet.js:5233-5236 — Domínio da Luz.
    {
      id: 'luz-brilho-do-amanhecer', label: 'Brilho do Amanhecer',
      minLevel: 3,
      subclassId: LUZ,
      spend: { resource: 'canalizar-divindade', amount: 1 },
    },
    // sheet.js:5256-5264 — Domínio da Trapaça: Bênção do Trapaceiro é um
    // toggle puro (não consome Canalizar Divindade no baseline). Dois
    // `actionId` distintos em vez de um toggle porque o contrato exige que a
    // projeção diga se a ação está disponível, e "ligar" e "desligar" têm
    // pré-condições opostas.
    {
      id: 'trapaca-ativar-bencao-do-trapaceiro', label: 'Ativar Bênção do Trapaceiro',
      minLevel: 3,
      subclassId: TRAPACA,
      flagOwner: 'subclass',
      requireFlag: { key: 'bencao-trapaceiro-ativa', value: false, owner: 'subclass' },
      setFlags: { 'bencao-trapaceiro-ativa': true },
    },
    {
      id: 'trapaca-encerrar-bencao-do-trapaceiro', label: 'Encerrar Bênção do Trapaceiro',
      minLevel: 3,
      subclassId: TRAPACA,
      flagOwner: 'subclass',
      requireFlag: { key: 'bencao-trapaceiro-ativa', value: true, owner: 'subclass' },
      setFlags: { 'bencao-trapaceiro-ativa': false },
    },
    // sheet.js:5266-5275 — Invocar Duplicidade: LIGAR gasta 1 uso de
    // Canalizar Divindade; DESLIGAR não devolve nada.
    {
      id: 'trapaca-invocar-duplicidade', label: 'Invocar Duplicidade',
      minLevel: 3,
      subclassId: TRAPACA,
      flagOwner: 'subclass',
      spend: { resource: 'canalizar-divindade', amount: 1 },
      requireFlag: { key: 'invocar-duplicidade-ativa', value: false, owner: 'subclass' },
      setFlags: { 'invocar-duplicidade-ativa': true },
    },
    {
      id: 'trapaca-encerrar-duplicidade', label: 'Encerrar Duplicidade',
      minLevel: 3,
      subclassId: TRAPACA,
      flagOwner: 'subclass',
      requireFlag: { key: 'invocar-duplicidade-ativa', value: true, owner: 'subclass' },
      setFlags: { 'invocar-duplicidade-ativa': false },
    },
    // sheet.js:5277-5280 — Domínio da Vida. O pool de 5 × nível PV de
    // Preservar a Vida é calculado só para o texto do toast no baseline
    // (nenhum estado é gravado), então aqui só o uso de Canalizar Divindade.
    {
      id: 'vida-preservar-a-vida', label: 'Preservar a Vida',
      minLevel: 3,
      subclassId: VIDA,
      spend: { resource: 'canalizar-divindade', amount: 1 },
    },
  ],
  rest: {
    // sheet.js:4379-4382 — `canalizar_divindade_usos_gastos = max(0, gastos - 1)`.
    short: [{ kind: 'recover-resource', resource: 'canalizar-divindade', amount: 1 }],
    // sheet.js:4689 (restaura tudo) e 4703-4704 (limpa as flags da Trapaça).
    // `intervencao_divina_bloqueada` volta a `false` em 4696 quando não há
    // cooldown pendente — que é o único caminho modelado aqui.
    long: [
      { kind: 'restore-resource', resource: 'canalizar-divindade' },
      { kind: 'clear-flag', flag: 'intervencao-divina-usada' },
      { kind: 'clear-flag', flag: 'bencao-trapaceiro-ativa', owner: 'subclass', subclassId: TRAPACA },
      { kind: 'clear-flag', flag: 'invocar-duplicidade-ativa', owner: 'subclass', subclassId: TRAPACA },
    ],
  },
});
