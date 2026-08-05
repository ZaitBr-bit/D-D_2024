// Handler oficial do Guardião (`class-guardiao`), extraído de
// `site/js/pages/sheet.js` (commit e43c5ea):
//   - `getProgressaoGuardiao`/`getEstadoRecursosGuardiao`, linhas 482-570;
//   - ações da classe, linhas 6245-6308;
//   - ações de subclasse, linhas 5389-5448;
//   - descanso longo, linhas 4764-4784.
//
// O que ficou NOS DADOS (e não aqui):
//   - o teto de Inimigo Favorito por nível (coluna "Inimigo Favorito" da
//     `tabela_caracteristicas` → `inimigo-favorito-1/5/9/13/17`);
//   - as magias de subclasse (`grant-spell` + `alwaysPrepared: true`).
//
// O que exige código:
//   - Marca do Caçador combina gasto de Inimigo Favorito com uma flag de
//     estado ativo (`sheet.js:6255-6268`);
//   - Reforços Feéricos é uso único por descanso longo.
//
// DESCANSO CURTO: o Guardião NÃO tem nenhuma recarga de descanso curto no
// baseline — não há bloco `if (char.classe === 'Guardião')` na função de
// descanso curto (só no longo, linha 4765). `rest.short` fica, portanto,
// deliberadamente vazio: é ausência VERIFICADA, não esquecimento.
//
// Conjuração: o Guardião é meio-conjurador, mas nada de conjuração passa por
// aqui — espaços, magias preparadas e concentração são do domínio de magias.
//
// NÃO modelado nesta rodada (ver concerns do relatório da Task 21):
// Incansável (nv10), Véu da Natureza (nv14), Andarilho Nebuloso (Andarilho
// Feérico nv15) e Golpe Terrível (Vigilante das Sombras nv3) — o máximo dos
// quatro é `Math.max(1, modificador de Sabedoria)`, que hoje nenhum produtor
// coloca em `context.variables`. As subclasses Caçador e Senhor das Feras não
// têm recurso nem flag: só escolhas persistentes de string (presa, táticas,
// tipo de companheiro), que são vocabulário de `choice`.

import { createClassHandler } from './class-handler.js';

const CLASS_ID = 'dnd2024:class:guardiao';
const ANDARILHO = 'dnd2024:subclass:andarilho-feerico';

export const guardiaoHandler = createClassHandler({
  id: 'class-guardiao',
  classId: CLASS_ID,
  resources: [{ key: 'inimigo-favorito', label: 'Inimigo Favorito', owner: 'class' }],
  flags: [
    { key: 'marca-predador-ativa', owner: 'class' },
    { key: 'reforcos-feericos-usado', owner: 'subclass', ownerId: ANDARILHO },
  ],
  actions: [
    // sheet.js:6255-6263 — gasta 1 uso e liga a marca. O baseline NÃO exige
    // que a marca esteja desligada (só que haja uso disponível), e reproduzir
    // isso literalmente importa: usar a marca num alvo novo enquanto a
    // anterior ainda está ativa é jogável e custa outro uso.
    {
      id: 'usar-marca-do-cacador', label: 'Usar Marca do Caçador',
      minLevel: 1,
      spend: { resource: 'inimigo-favorito', amount: 1 },
      setFlags: { 'marca-predador-ativa': true },
    },
    // sheet.js:6265-6268 — encerrar não devolve o uso e não tem pré-condição.
    { id: 'encerrar-marca-do-cacador', label: 'Encerrar Marca do Caçador', minLevel: 1, setFlags: { 'marca-predador-ativa': false } },
    // sheet.js:5400-5404 — Andarilho Feérico, Reforços Feéricos (nv11):
    // 1× por descanso longo.
    {
      id: 'andarilho-reforcos-feericos', label: 'Reforços Feéricos',
      minLevel: 11,
      subclassId: ANDARILHO,
      flagOwner: 'subclass',
      requireFlag: { key: 'reforcos-feericos-usado', value: false, owner: 'subclass' },
      setFlags: { 'reforcos-feericos-usado': true },
    },
  ],
  rest: {
    // Ver o comentário de topo: ausência verificada, não esquecimento.
    short: [],
    // sheet.js:4768-4776.
    long: [
      { kind: 'restore-resource', resource: 'inimigo-favorito' },
      { kind: 'clear-flag', flag: 'marca-predador-ativa' },
      { kind: 'clear-flag', flag: 'reforcos-feericos-usado', owner: 'subclass', subclassId: ANDARILHO },
    ],
  },
});
