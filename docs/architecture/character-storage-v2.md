# Armazenamento de personagem — registro v2

## Formato

Os personagens são persistidos como um array em
`localStorage['dnd_personagens']`. Cada registro v2 é o **registro plano
legado completo** (todos os campos que o baseline `e43c5ea` gravava:
`nome`, `classe`, `atributos`, `inventario`, `magias_*`, `moedas`, ...) mais
os **canais reservados** do codec:

| Canal | Conteúdo |
|---|---|
| `_schema` | versão do schema do registro |
| `content_refs` | ContentRef resolvido por pointer canônico (ex. `build.classRef`) |
| `content_scopes` | pacote@versão de conteúdo usados pelo personagem |
| `choice_refs` | espelho informativo de escolhas (emitido, nunca lido de volta) |
| `overrides` | edições manuais canônicas (hoje só `hp.maximum`) |
| `pv_rolagens` | histórico de PV rolado por nível (`state.hitPointRolls`) |
| `_local_sync` | marcador local de reconciliação de outbox (NUNCA viaja em export/nuvem) |

Esse desenho faz o registro ser **legível e editável pela aplicação legada**
(que ignora as chaves extras e as preserva ao salvar) e, ao mesmo tempo,
carregar o personagem canônico v2 completo. O gate executável disso é o
round-trip `npm run test:e2e:compat` (cria no app novo → edita no baseline
materializado → reimporta sem perda).

## Codec (`site/js/infra/character/character-codec.js`)

- `decodeCharacterRecord(raw, ctx)` → personagem canônico
  (`migrations/v1-to-v2.js` deriva dos campos planos; os canais reservados
  sobrepõem o que já foi resolvido). Campos desconhecidos vão para
  `extensions.legacyPassthrough` e voltam intactos no encode — **nunca há
  descarte silencioso**.
- `encodeCharacterRecord(character, ctx)` → registro plano; campos derivados
  são projetados de volta (inclusive espelhos legados como
  `pv_max_override`/`edicoes.campos.pv_max` para o override de PV máximo, e
  `origem: 'sempre'` para magias sempre-preparadas concedidas por efeito).
- Reconciliação nas DUAS direções: uma edição feita pelo BASELINE num campo
  plano espelhado (ex. `pv_max_override`) vence o canal reservado obsoleto
  no próximo decode; uma edição v2 é espelhada no plano no próximo encode.
  (Tasks 17 e 37 — testes em `tests/unit/character/character-codec.test.js`.)

## Modos de abertura

| Situação | Modo |
|---|---|
| registro legado (sem `_schema`) | editável — migrado on-the-fly |
| registro v2 desta versão | editável |
| `_schema` futuro/desconhecido, ou colisão de canal reservado | **somente leitura + exportável** |

No modo somente leitura o registro bruto é preservado byte a byte
(`rawRecord`) e o export o reemite intacto — inclusive um eventual
`_local_sync` de outro app (só registros EDITÁVEIS têm o marcador local
removido no export). Nada é "consertado" sem o usuário pedir.

## Backup e restauração

Antes da primeira migração de storage, o app cria um backup
(`pre-migration-backup.js`); a home expõe, em caso de falha de
inicialização, os fluxos de **Baixar backup**, **Restaurar backup** e
**Exportar dados brutos** (com confirmação explícita — nunca destrutivo por
padrão). Cobertos por `tests/e2e/storage-migration.spec.js` e pelos testes
de unidade do repositório.

## Sincronização

`sync.js` + `infra/sync/**` mantêm uma fila durável (`dnd_sync_queue`);
`_local_sync.lastMutationId` marca no registro a última mutação local
reconciliada (`reconcilePrepared`), para o outbox não duplicar upserts. O
marcador é local ao dispositivo: é removido de exports e do payload remoto, e
sobrevive a um salvamento feito pelo app legado no mesmo storage (verificado
no round-trip de compatibilidade).
