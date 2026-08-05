// Handler oficial do Bárbaro (`class-barbaro`), extraído de
// `site/js/pages/sheet.js` (`getEstadoFuria`, linhas 387-440; recarga de
// descanso curto, linha 4355-4359; recarga de descanso longo, linha
// 4632-4644) e de `site/js/levelup.js` (degraus de Fúria por nível, hoje
// declarados em `dados/pacotes/dnd2024/classes/barbaro.json`).
//
// O que ficou NOS DADOS (e não aqui):
//   - o teto de Fúrias por nível (efeitos `resource` `furias-1..furias-17`);
//   - o teto de Maestria em Arma;
//   - todo texto de apresentação das características.
//
// O que exige código (fora do vocabulário declarativo):
//   - descanso CURTO devolve exatamente 1 uso de Fúria (o vocabulário
//     `resourceEffect.recovery` só sabe "restaura ao máximo");
//   - entrar/encerrar Fúria é uma flag de uso ligada ao gasto do recurso.
//
// NÃO modelado nesta rodada (ver concerns do relatório da Task 20):
// `furia_implacavel_cd` (CD escalonável de Fúria Implacável),
// `furia_animal` (animal do Coração Selvagem) e as resistências derivadas
// da Fúria — são projeção derivada/edição, não recurso nem recarga.

import { createClassHandler } from './class-handler.js';

const CLASS_ID = 'dnd2024:class:barbaro';
const BERSERKER = 'dnd2024:subclass:trilha-do-berserker';
const FANATICO = 'dnd2024:subclass:trilha-do-fanatico';

export const barbaroHandler = createClassHandler({
  id: 'class-barbaro',
  classId: CLASS_ID,
  resources: [{ key: 'furias', label: 'Fúrias', owner: 'class' }],
  flags: [
    { key: 'furia-ativa', owner: 'class' },
    { key: 'furia-persistente-usada', owner: 'class' },
    { key: 'furia-deuses-ativa', owner: 'class' },
    { key: 'presenca-intimidante-usada', owner: 'class' },
    { key: 'presenca-zelosa-usada', owner: 'class' },
  ],
  actions: [
    {
      id: 'entrar-em-furia', label: 'Entrar em Fúria',
      minLevel: 1,
      spend: { resource: 'furias', amount: 1 },
      requireFlag: { key: 'furia-ativa', value: false },
      setFlags: { 'furia-ativa': true },
    },
    {
      id: 'encerrar-furia', label: 'Encerrar Fúria',
      minLevel: 1,
      requireFlag: { key: 'furia-ativa', value: true },
      setFlags: { 'furia-ativa': false },
    },
    // Fúria Persistente (nv15) — sheet.js:7299-7312 (`data-furia-iniciativa`):
    // ao rolar iniciativa, recupera TODOS os usos de Fúria
    // (`furia_usos_gastos = 0`), uma vez por descanso longo. Mesmo formato do
    // Metabolismo Incomum do Monge: exige a flag em `false`, restaura o
    // recurso e marca a flag.
    {
      id: 'restaurar-furias-persistente', label: 'Fúria Persistente (restaurar Fúrias)',
      minLevel: 15,
      requireFlag: { key: 'furia-persistente-usada', value: false },
      restoreResource: 'furias',
      setFlags: { 'furia-persistente-usada': true },
    },
    // Berserker nv14 — Presença Intimidante: 1 uso por descanso longo.
    {
      id: 'presenca-intimidante', label: 'Presença Intimidante',
      minLevel: 14,
      subclassId: BERSERKER,
      requireFlag: { key: 'presenca-intimidante-usada', value: false },
      setFlags: { 'presenca-intimidante-usada': true },
    },
    // Fanático nv10 — Presença Zelosa: 1 uso por descanso longo.
    {
      id: 'presenca-zelosa', label: 'Presença Zelosa',
      minLevel: 10,
      subclassId: FANATICO,
      requireFlag: { key: 'presenca-zelosa-usada', value: false },
      setFlags: { 'presenca-zelosa-usada': true },
    },
    // Fanático nv14 — Fúria dos Deuses: ativa enquanto a Fúria durar.
    {
      id: 'furia-dos-deuses', label: 'Fúria dos Deuses',
      minLevel: 14,
      subclassId: FANATICO,
      requireFlag: { key: 'furia-deuses-ativa', value: false },
      setFlags: { 'furia-deuses-ativa': true },
    },
  ],
  rest: {
    // sheet.js:4357 — `furia_usos_gastos = max(0, gastos - 1)`: exatamente 1 uso.
    short: [{ kind: 'recover-resource', resource: 'furias', amount: 1 }],
    // sheet.js:4635-4643 — restaura todos os usos e limpa as flags de Fúria.
    long: [
      { kind: 'restore-resource', resource: 'furias' },
      { kind: 'clear-flag', flag: 'furia-ativa' },
      { kind: 'clear-flag', flag: 'furia-persistente-usada' },
      { kind: 'clear-flag', flag: 'furia-deuses-ativa' },
      { kind: 'clear-flag', flag: 'presenca-intimidante-usada' },
      { kind: 'clear-flag', flag: 'presenca-zelosa-usada' },
    ],
  },
});
