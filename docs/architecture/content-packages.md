# Pacotes de conteúdo

Todo conteúdo mecânico de jogo consumido em runtime vem de **pacotes de
conteúdo** validados por schema. Hoje existe um único pacote — o oficial
`dados/pacotes/dnd2024` — mas o contrato abaixo é o mesmo que qualquer fonte
futura terá de cumprir: o runtime resolve conteúdo exclusivamente pela
interface do `ContentRegistry` (`site/js/content/registry.js`), nunca por
caminho de arquivo, então uma fonte nova é "apenas" mais um provedor desse
contrato. Não existe (ainda) importador ou editor de pacotes: este documento
descreve o contrato, não uma ferramenta.

## Estrutura de um pacote

```
dados/pacotes/<id>/
├── manifest.json        # identidade, versão e declarações do pacote
├── index.json           # índice DETERMINÍSTICO de todas as entidades
├── classes/ species/ backgrounds/ feats/ spells/ equipment/
├── rulesets/            # regras transversais (tabelas de moeda, propriedades…)
├── appendices/          # criaturas, glossário
└── migrations/          # ex.: character-v1-aliases.json (nomes legados -> ContentId)
```

## Manifesto (`manifest.json`)

Validado por `dados/schemas/v1/manifest.schema.json`. Campos:

| Campo | Significado |
|---|---|
| `schemaVersion` | versão (semVer) do FORMATO de manifesto |
| `id`, `name`, `description`, `authors` | identidade do pacote |
| `version` | versão semVer do CONTEÚDO (entra em `ContentRef.packageVersion`) |
| `status` | `building` \| `ready` — só pacotes `ready` são ativados |
| `ruleset` | ContentId do ruleset base (`dnd2024:ruleset:core`) |
| `entitySchemaVersions` | semVer do schema de CADA tipo de entidade — **estritamente igual** ao `schemaVersion` de toda entidade do tipo (teste de igualdade em `tests/contract/dnd2024-package.test.js`, reconciliação da Task 37) |
| `entities` | tipos de entidade presentes no pacote |
| `dependencies` | pacotes exigidos (vazio no oficial) |
| `referenceMigrations` | migrações de referência entre versões de conteúdo |
| `legacyAdapters` | adaptadores declarados de formato legado |

## Entidades e ContentId

Toda entidade é um JSON com `id`, `type`, `schemaVersion`, `name` (base comum
em `dados/schemas/v1/common.schema.json`) validado pelo schema do seu tipo. O
`id` é um **ContentId** qualificado: `<pacote>:<tipo>:<slug>` (ex.
`dnd2024:spell:luz`). Referências no personagem são `ContentRef`
(`{id, packageVersion}`) — nunca nome de exibição.

O `index.json` lista todas as entradas em ordem determinística e é
reconstruível do disco (`scripts/content/build-index.mjs`); o teste de
contrato compara byte a byte.

## Validação

- `npm run validate:data` valida o pacote inteiro contra os schemas.
- Os validadores Ajv são GERADOS (standalone ESM) por
  `npm run generate:validators` para `site/js/content/schemas/generated-validators.js`;
  `npm run check:validators` acusa drift entre schema e validador gerado.
- Conteúdo inválido conhecido fica congelado em
  `tests/fixtures/content/invalid-entities.json` (casos que DEVEM reprovar).

## Capacidades de fonte oficial

Handlers executáveis (as ~110 ações dos 12 handlers de classe em
`site/js/domain/rulesets/dnd2024/handlers/**`) só rodam para conteúdo de uma
fonte com a capacidade `officialHandlers` — um token opaco que SÓ o
composition root (`site/js/app-context.js`) pode criar
(`createOfficialSourceCapabilities`). A regra é verificada estaticamente por
`scripts/check-architecture.mjs`. Uma fonte futura de conteúdo do usuário
NÃO recebe essa capacidade: seu conteúdo é dado declarativo validado, sem
código privilegiado.

## Fontes futuras

O caminho previsto para novos conteúdos (homebrew, expansões):

1. um pacote novo com o MESMO contrato (manifesto + índice + entidades
   validadas por schema);
2. registrado no `ContentRegistry` como fonte adicional, com escopo por
   personagem (`build.contentScopes` registra pacote@versão usados);
3. migrações de referência declaradas em `referenceMigrations` quando uma
   versão nova renomeia/remove entidades.

Os JSON legados fora de `dados/pacotes/` (ex. `dados/classes/*.json`) **não
são conteúdo de runtime**: permanecem no repositório como oráculo dos testes
de paridade e referência histórica auditável. Um teste E2E
(`tests/e2e/legacy-db-shadow.spec.js`) prova que o app publicado nunca os
requisita.
