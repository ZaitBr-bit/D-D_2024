# Refatoração da arquitetura de regras e conteúdo

**Data:** 2026-07-26  
**Status:** especificação aprovada para implementação  
**Aplicação:** Fichas de Nimb — D&D 5.5 (2024)

## 1. Objetivo

Refatorar a aplicação para:

- reduzir `site/js/pages/creator.js` e `site/js/pages/sheet.js` a coordenadores finos;
- separar dados, regras, estado, persistência e apresentação;
- tornar regras, classes, espécies e demais catálogos mais fáceis de manter;
- preservar interface, fluxos e comportamento atuais;
- manter compatibilidade com fichas existentes, importação, exportação, `localStorage` e Firestore;
- continuar funcionando como SPA estática, PWA e GitHub Pages;
- criar contratos que permitam adicionar conteúdo customizado no futuro;
- permitir futuramente automação declarativa de efeitos conhecidos, sem executar JavaScript fornecido por usuários.

A primeira entrega não implementará importador ou editor de conteúdo customizado.

## 2. Contexto atual

O projeto é uma SPA em JavaScript puro, baseada em módulos ES nativos e sem etapa obrigatória de build. `site/index.html` carrega `site/js/app.js`, que despacha as rotas por hash.

Os principais monólitos são:

- `site/js/pages/creator.js`: 4.627 linhas e uma única exportação pública;
- `site/js/pages/sheet.js`: 17.955 linhas e uma única exportação pública.

O problema não é apenas o tamanho. As regras atuais estão distribuídas entre:

- JSON oficiais;
- constantes hardcoded;
- comparações por nomes de exibição em português;
- parsing de descrições e equipamentos com expressões regulares;
- funções de renderização;
- handlers DOM;
- migrações executadas ao abrir a ficha;
- cálculos duplicados para tela, impressão e PDF.

Há estado singleton mutável nos dois módulos. Funções que aparentam apenas consultar dados também inicializam campos, salvam personagens ou alteram recursos. Isso impede extrações seguras e testes isolados.

Já existem boas extrações, como `levelup-*`, `moedas.js`, `regras-cobertura.js`, `talentos-effects.js` e `ficha-edicoes.js`. Elas devem ser reaproveitadas ou alinhadas às novas fronteiras, não descartadas automaticamente.

Não existe suíte automatizada. A validação atual se limita principalmente a `node --check` e verificações manuais. O Service Worker possui uma lista manual e incompleta de módulos para precache.

## 3. Requisitos

### 3.1 Funcionais

- Manter as sete etapas atuais do criador.
- Manter todas as seções, ações e cálculos atuais da ficha.
- Preservar personagens já armazenados e exportações antigas.
- Preservar sincronização local e em nuvem.
- Preservar funcionamento online e offline.
- Preservar impressão e geração de PDF.
- Preservar URLs públicas e roteamento por hash.
- Preservar aparência e textos atuais, salvo correções necessárias para segurança, consistência ou paridade.

As diferenças intencionais já aprovadas são: cancelamento transacional de modais, descarte de respostas assíncronas obsoletas, ausência de mutação durante renderização, restauração confiável de handlers após rerender e unificação dos valores de tela/impressão/PDF. Qualquer outra mudança observável deverá ser documentada e aprovada antes da implementação.

### 3.2 Arquiteturais

- O domínio não pode depender de DOM, `window`, `localStorage`, Firebase ou `fetch`.
- Regras mecânicas não podem depender de nomes de exibição ou parsing de descrições.
- Conteúdo deve possuir identidade estável, origem e versão.
- Alterações de estado devem ocorrer por comandos explícitos.
- Consultas e renderizações não podem persistir nem alterar o personagem.
- Dados de origem, estado mutável, valores derivados e ajustes manuais devem ser distinguíveis.
- A aplicação deve continuar executável localmente sem build.
- Ferramentas Node são permitidas para testes, validação, lint e geração de artefatos de deploy.

### 3.3 Compatibilidade

- Registros sem versão explícita serão tratados como formato legado.
- Migrações serão puras, sequenciais e idempotentes.
- Dados antigos continuarão aceitos por importação, armazenamento local e sincronização.
- O modelo canônico será interno; a serialização será um único registro versionado e compatível com os campos esperados pelo commit baseline `e43c5ea`.
- Referências estáveis e metadados novos serão adicionados ao registro sem duplicar arrays grandes de inventário, magias ou recursos.
- Os campos legados de identidade de conteúdo serão projeções das referências estáveis e nunca uma segunda fonte de verdade.
- Quando uma referência estável válida estiver presente, ela prevalecerá sobre seu nome legado correspondente.
- Divergências entre referências estáveis e nomes legados produzirão conflito de migração; não haverá escolha silenciosa.

## 4. Limites do escopo

Não fazem parte desta refatoração:

- importador de pacotes customizados;
- editor visual de classes, espécies ou outros conteúdos;
- execução de JavaScript fornecido por usuários;
- carregamento de regras por URLs arbitrárias;
- redesenho da interface;
- novas regras ou conteúdos de jogo;
- multiclasse;
- alterações funcionais no Firebase;
- migração para framework de interface;
- build obrigatório para desenvolvimento local.

## 5. Arquitetura final

```text
site/js/
├── core/                 IDs, resultados, erros, validações e contratos comuns
├── content/              esquemas, catálogo e contratos de fontes
│   ├── schemas/
│   ├── registry.js
│   └── source.js
├── domain/               consultas, comandos, regras e efeitos
│   ├── character/
│   ├── rulesets/
│   ├── classes/
│   ├── species/
│   ├── backgrounds/
│   ├── feats/
│   ├── spells/
│   ├── inventory/
│   └── effects/
├── features/
│   ├── creator/          sessão, controlador e módulos dos passos
│   └── sheet/            sessão, controlador, projeções e seções
├── infra/                HTTP, fonte oficial, persistência, migrações e sync
├── ui/                   DOM, componentes, modal, Markdown e notificações
└── pages/                entradas finas das rotas
```

### 5.1 Direção das dependências

- `core` não depende das demais camadas.
- `domain` depende apenas de `core` e de contratos de conteúdo.
- `content` normaliza e valida entidades, sem conhecer páginas.
- `features` coordena domínio, conteúdo e portas de infraestrutura.
- `infra` implementa carregamento, a fonte HTTP oficial, persistência e sincronização.
- `ui` adapta projeções para o navegador.
- `pages` compõe as dependências e inicia cada funcionalidade.

Dependências de `domain` para `infra`, `ui` ou `pages` serão proibidas por testes de arquitetura.

### 5.2 Entradas de rota

`app.js` manterá o roteamento atual por hash. Home, criador e ficha poderão ser carregados com `import()` dinâmico, mantendo os mesmos hashes e reduzindo o custo inicial da home.

Os arquivos públicos `pages/creator.js` e `pages/sheet.js` conservarão suas funções de entrada, mas apenas montarão dependências e iniciarão as respectivas sessões.

## 6. Catálogo comum de conteúdo

### 6.1 Identidade

Cada entidade terá ID qualificado, imutável e independente do nome exibido:

```js
{
  id: "dnd2024:class:guerreiro",
  type: "class",
  name: "Guerreiro",
  source: "dnd2024",
  schemaVersion: 1,
  effects: []
}
```

O formato será:

```text
namespace:type:slug
```

Os segmentos usarão caracteres ASCII minúsculos. Alterar tradução ou nome de exibição não alterará o ID.

### 6.2 Pacote de conteúdo

Uma fonte exporá um manifesto contendo:

- ID e nome da fonte;
- versão semântica do pacote;
- versão dos esquemas;
- tipos de entidade fornecidos;
- dependências, quando existirem;
- metadados de autoria e descrição.

A fonte oficial será a única registrada nesta entrega. A API será preparada para fontes futuras sem implementar armazenamento ou UI de conteúdo customizado.

O pacote oficial será organizado sob uma raiz própria:

```text
dados/pacotes/dnd2024/
├── manifest.json
├── index.json
├── rulesets/
├── classes/
├── species/
├── backgrounds/
├── feats/
├── spells/
├── equipment/
├── appendices/
└── migrations/
```

`index.json` mapeará IDs para tipo e caminho. Um caminho poderá representar uma entidade ou uma coleção; essa diferença ficará encapsulada pela fonte.

### 6.3 Contratos

Os contratos assíncronos usarão `Promise<Result<T, AppError>>`; validações usarão `ValidationResult`, contendo `valid`, `errors` e `warnings`.

O `ContentRegistry` fornecerá exatamente:

- `registerSource(source, capabilities): Result<void, AppError>`;
- `initialize(): Promise<Result<void, AppError>>`;
- `list(type): ReadonlyArray<ContentEntity>`;
- `get(id): ContentEntity | null`;
- `resolve(reference, expectedType): Result<ContentEntity, AppError>`;
- `validateEntity(entity): ValidationResult`;
- `validatePackage(manifest, index, entities): ValidationResult`.

Uma `ContentSource` fornecerá exatamente:

- `loadManifest(): Promise<Result<ContentManifest, AppError>>`;
- `loadIndex(): Promise<Result<ContentIndex, AppError>>`;
- `loadEntity(id): Promise<Result<unknown, AppError>>`.

A implementação HTTP oficial ficará em `infra` e receberá a URL-base por injeção. O contrato em `content` não usará `fetch`. A fonte poderá carregar e cachear uma coleção inteira internamente, mas `loadEntity` continuará sendo sua interface observável.

### 6.4 Resolução e conflitos

- IDs qualificados duplicados serão erro fatal de catálogo.
- Não haverá sobrescrita implícita baseada na ordem das fontes.
- Referências ausentes ou de tipo incorreto serão erros estruturados.
- Extensão ou substituição explícita de entidades fica reservada para uma fase futura de conteúdo customizado.
- Aliases legados mapearão nomes atuais para IDs somente na fronteira de migração.
- A ativação de uma fonte será atômica: qualquer entidade inválida ou referência quebrada rejeitará o pacote inteiro.
- Namespaces reservados serão atribuídos pelo código que registra a fonte, não por declarações do manifesto.
- Capacidades de confiança, incluindo acesso a handlers oficiais, serão atribuídas à instância da fonte pelo composition root. Metadados JSON nunca concederão confiança.

### 6.5 Tipos cobertos

A interface comum abrangerá:

- ruleset, atributos, perícias, condições, tipos de dano e tabelas básicas;
- classes e subclasses;
- espécies;
- antecedentes;
- talentos;
- magias;
- armas, armaduras e equipamentos;
- opções auxiliares compartilhadas, quando necessário.

Cada tipo terá seu próprio JSON Schema. O catálogo comum não significa um único esquema genérico.

O personagem atual referenciará `dnd2024:ruleset:core`. Algoritmos suportados continuarão no domínio; tabelas, opções e parâmetros configuráveis sairão de `dados-classes.js` e de constantes das páginas para o ruleset oficial.

### 6.6 Migração dos dados oficiais

Os JSON oficiais serão convertidos para campos mecânicos estruturados. Descrições permanecerão conteúdo de apresentação.

Serão eliminadas como fonte de regra:

- listas separadas por vírgulas;
- identificação por nome aproximado;
- singularização de nomes de itens;
- extração de tamanho, deslocamento ou nível mínimo por regex;
- detecção de escolhas a partir de prosa;
- comparação de nomes traduzidos para ativar mecânicas.

Scripts de migração poderão auxiliar a conversão, mas os resultados versionados serão validados e revisados. A aplicação não executará parsing heurístico de prosa como caminho normal.

Parsing heurístico continuará permitido apenas dentro de adaptadores de formatos legados identificados por versão. Ele não poderá ser usado para entidades no formato canônico.

### 6.7 Fonte de verdade e extração

Os JSON canônicos do pacote oficial serão a fonte runtime das mecânicas. Os Markdown em `Informacoes Separadas/` continuarão como referência humana.

`_extrair_json.py` será transformado em ferramenta de extração para uma pasta de staging. Ele:

- apontará para a localização real dos Markdown;
- nunca sobrescreverá diretamente `dados/pacotes/dnd2024`;
- produzirá saída não confiável que precisa passar por normalização, validação e revisão antes de ser promovida;
- falhará sem modificar dados canônicos quando a fonte ou estrutura esperada não existir.

### 6.8 Referências e versões

Uma referência persistida terá o formato:

```js
{
  id: "dnd2024:class:guerreiro",
  packageVersion: "1.0.0"
}
```

A versão fica fixada quando a escolha é feita. Ao atualizar o pacote oficial:

- o manifesto deverá fornecer uma cadeia explícita de migração de referências e escolhas para a versão ativa;
- apenas uma versão de cada namespace ficará ativa no `ContentRegistry`;
- `resolve` retornará `CONTENT_VERSION_MIGRATION_REQUIRED` quando a referência ainda estiver fixada em outra versão;
- na ausência de migração válida, o personagem ficará somente leitura e continuará exportável.

Uma migração que apenas atualize texto ainda será registrada como migração identidade. O aplicativo não resolverá silenciosamente uma referência fixada contra outra versão do pacote.

## 7. Modelo canônico do personagem

O personagem interno será organizado por finalidade:

```js
{
  schemaVersion: 2,
  identity: {
    id,
    name,
    image
  },
  build: {
    rulesetRef,
    classRef,
    subclassRef,
    speciesRef,
    backgroundRef,
    choices
  },
  state: {
    level,
    xp,
    hitPoints,
    resources,
    spells,
    inventory,
    conditions
  },
  overrides: {},
  extensions: {
    legacyPassthrough: {}
  },
  metadata: {}
}
```

Registros persistidos sem `_schema.characterVersion` serão classificados como legado lógico v1. O modelo interno e o registro persistido introduzidos pela refatoração serão v2.

Esse exemplo representa o modelo interno. O esquema v2 completo deverá mapear todos os campos persistidos no commit baseline `e43c5ea`.

### 7.1 Fonte de verdade

- `build` registra conteúdo selecionado e escolhas do usuário.
- `state` registra valores mutáveis durante o jogo.
- `overrides` registra alterações manuais intencionais.
- `extensions.legacyPassthrough` preserva campos desconhecidos de formatos suportados;
- valores derivados são calculados e não são fonte persistida;
- caches derivados, se necessários por desempenho, terão versão e poderão ser descartados.

As escolhas serão identificadas por IDs estáveis definidos no conteúdo, não por títulos visuais.

Registros com versão superior à suportada serão preservados em sua forma bruta para exportação, mas ficarão somente leitura. O aplicativo não tentará salvá-los em um formato mais antigo.

### 7.2 Ajustes manuais

A ordem de precedência será:

1. valores básicos;
2. efeitos de classe, espécie, antecedente e talentos;
3. equipamentos e efeitos temporários;
4. ajustes manuais.

Dentro de cada grupo, efeitos serão ordenados por `priority` numérica crescente e, em caso de empate, por ID estável; prioridades maiores serão aplicadas por último. A semântica será:

- `set`: apenas um valor por `stackKey`; conflitos na mesma prioridade são erro de validação;
- `add`: soma todos os efeitos, exceto quando compartilharem uma `stackKey` não acumulável;
- `multiply`: aplica fatores na ordem estável depois dos `add`;
- `min` e `max`: aplicam o limite mais restritivo;
- concessões em conjunto, como proficiências e resistências, usam três operações — `add-ids`, `remove-ids` e `replace-ids` — não apenas união; um ajuste manual pode remover uma concessão de um grupo de prioridade menor;
- escolhas incompatíveis são rejeitadas antes da resolução.

Ausência de `priority` em um efeito equivale a `0`. Ausência de `stackKey` significa que o efeito sempre acumula (nunca é filtrado por deduplicação).

As edições já registradas em `edicoes` serão convertidas para `overrides` quando representarem ajustes manuais. Diferenças legadas que não possam ser reproduzidas com segurança serão preservadas como ajustes explícitos, acompanhadas de aviso de migração.

### 7.3 Persistência compatível

O modelo interno aninhado não será duplicado integralmente no armazenamento. O serializador produzirá um único registro compatível:

```js
{
  // Campos esperados pelo baseline e armazenados uma única vez:
  id,
  nome,
  classe,
  especie,
  atributos,
  inventario,
  // ...demais campos legados...

  _schema: {
    characterVersion: 2,
    compatibilityBaseline: "e43c5ea"
  },
  content_refs: {
    ruleset,
    class,
    subclass,
    species,
    background
  },
  choice_refs: {},
  overrides: {}
}
```

Arrays grandes e estado mutável existirão uma única vez no registro. O adaptador mapeará esse formato plano para o modelo canônico interno.

Os nomes legados de classe, espécie, antecedente e outros conteúdos serão derivados de `content_refs`. O carregamento v2 usará as referências; divergências válidas serão reportadas como conflito. Campos desconhecidos de versões suportadas serão copiados para `extensions.legacyPassthrough` em memória e reemitidos no mesmo nível durante a serialização, salvo conflito com um campo reservado v2.

Uma ficha nova que utilize apenas conteúdo oficial já existente continuará legível pelo commit baseline `e43c5ea`. A garantia é de leitura e das operações que não alteram identidade de conteúdo; o baseline não conhece referências v2 e não é autorizado a trocar classe, espécie ou escolhas canônicas.

### 7.4 Migrações

As migrações:

- receberão um objeto e devolverão um novo objeto;
- não acessarão DOM, armazenamento ou rede;
- terão testes por versão;
- poderão ser executadas repetidamente sem duplicar efeitos;
- validarão o resultado antes da persistência;
- não ocorrerão durante renderização.

O repositório coordenará a migração na leitura. Antes da primeira gravação migrada, será criado um backup versionado separado do backup usado na troca entre dados locais e nuvem.

O backup local usará a chave `dnd_personagens_backup_refatoracao_v2` e conterá a lista bruta anterior à migração. Ele:

- será criado uma única vez e nunca sobrescrito automaticamente;
- será validado após a gravação;
- permanecerá disponível até remoção explícita;
- poderá ser exportado ou restaurado pela rotina `restaurarBackupMigracaoV2`;
- só substituirá dados atuais após confirmação e validação;
- impedirá a persistência da migração caso não possa ser criado por falta de espaço.

Se o backup não puder ser criado, a ficha legada ainda poderá ser aberta em memória e exportada, mas ficará somente leitura até haver espaço ou o usuário concluir uma exportação de segurança.

Quando houver falha de migração, o modal de erro oferecerá as ações “Exportar backup bruto” e “Restaurar backup”. Essas ações não aparecerão no fluxo normal.

Uma migração exclusivamente estrutural preservará `atualizado_em` e não será enfileirada como edição comum. Registros locais, registros recebidos da nuvem e upserts já presentes na fila passarão pelo mesmo adaptador v1→v2. A próxima alteração real do usuário sincronizará a representação v2.

## 8. Regras, consultas, comandos e efeitos

### 8.1 Consultas

Consultas calculam dados sem alterar o personagem, como:

- CA e modificadores;
- PV máximo;
- proficiências;
- deslocamento e carga;
- recursos máximos e disponíveis;
- magias conhecidas, preparadas e disponíveis;
- características ativas;
- projeções de inventário e combate.

Uma consulta não poderá inicializar recursos, salvar o personagem ou corrigir dados.

### 8.2 Comandos

Comandos representam alterações intencionais, como:

- aplicar dano ou cura;
- realizar descanso;
- gastar ou recuperar recurso;
- conjurar magia;
- iniciar ou encerrar concentração;
- equipar item;
- comprar item;
- alterar escolha;
- editar campo;
- subir de nível.

Um comando recebe estado e contexto, valida pré-condições e devolve:

```js
{
  ok: true,
  character: nextCharacter,
  events: []
}
```

Falhas esperadas retornam um resultado com erro e não alteram o estado original.

### 8.3 Vocabulário declarativo

O vocabulário fechado de `effect.type` é exatamente: `modifier` (modificadores numéricos, inclusive definição de valor básico via `operation: "set"`), `proficiency`, `language`, `defense` (resistências, imunidades e vulnerabilidades), `grant-spell`, `grant-item`, `resource` (recursos e recargas), `choice`, `condition` (condições estruturadas aplicadas ao personagem — não o vocabulário de gating, que usa `when`), `official-handler` (mecânicas que não cabem no vocabulário declarativo, ver 8.4) e `manual` (efeitos sem automação).

As condições dos efeitos usarão operadores permitidos e campos conhecidos. Não haverá `eval`, expressões JavaScript ou acesso livre a propriedades.

### 8.4 Handlers oficiais

Mecânicas oficiais que não couberem de forma clara no vocabulário declarativo serão implementadas em handlers internos registrados por ID.

Os handlers:

- serão organizados por domínio, classe ou subclasse;
- usarão IDs estáveis;
- receberão contexto explícito;
- não acessarão DOM ou persistência;
- terão testes unitários;
- só poderão ser referenciados por uma fonte que recebeu a capacidade interna `officialHandlers` no momento do registro.

Fontes futuras de usuário poderão utilizar o vocabulário declarativo, mas não registrar nem referenciar código executável.

Namespace, `source`, autoria ou qualquer outro campo de manifesto não concederá essa capacidade.

### 8.5 Efeitos não automatizados

Uma mecânica sem automação deverá declarar explicitamente `type: "manual"`. Ela será exibida com instruções, sem alterar cálculos automaticamente. Tipos desconhecidos não serão convertidos automaticamente para manual; serão rejeitados pela validação.

## 9. Criador de personagem

### 9.1 Sessão

`CreatorSession` substituirá as variáveis de módulo `personagem`, `stepAtual`, `dadosCache` e `containerRef`.

A sessão distinguirá:

- rascunho canônico;
- estado temporário de cada passo;
- dados carregados;
- passo atual;
- dependências e invalidações;
- serviços externos.

### 9.2 Contrato dos passos

Cada passo implementará:

```js
{
  id,
  load(context),
  render(context),
  bind(context),
  validate(context),
  invalidate(context)
}
```

Os passos permanecerão:

1. Classe;
2. Espécie;
3. Antecedente;
4. Atributos;
5. Equipamento;
6. Magias;
7. Detalhes.

### 9.3 Ciclo de vida

- Seleções em modal serão aplicadas apenas ao confirmar.
- Cancelar descartará o rascunho temporário do modal.
- Alterações em passos anteriores invalidarão apenas dependências declaradas.
- O estado de formulário não será misturado ao cache de conteúdo.
- Carregamentos assíncronos usarão cancelamento ou identificador de geração.
- Uma resposta obsoleta não poderá modificar a tela ou sessão atual.
- Seletores DOM ficarão limitados à raiz do passo.
- Eventos globais inline serão removidos.

### 9.4 Finalização

A montagem final será uma função pura e idempotente. Persistir, emitir notificação e navegar serão ações posteriores do controlador.

Se o salvamento local falhar, o usuário permanecerá no último passo com o rascunho intacto; não haverá navegação nem enfileiramento de sincronização.

Equipamento, magias, talentos e componentes de escolha usarão módulos compartilhados com a ficha sempre que os comportamentos forem equivalentes.

## 10. Ficha

### 10.1 Sessão e controlador

`SheetSession` manterá:

- personagem canônico;
- catálogo;
- portas de persistência e sincronização;
- caches explícitos;
- estado visual local;
- dispatcher de comandos.

Não haverá singleton mutável compartilhado entre fichas.

### 10.2 Seções

A ficha será dividida em:

- resumo, atributos, PV e combate;
- recursos e características;
- talentos e progressão;
- magias, grimório e concentração;
- condições, defesas e sentidos;
- inventário, carga e moedas;
- detalhes pessoais;
- impressão e PDF.

Cada seção receberá uma projeção pronta e emitirá intenções ou comandos. Ela não conhecerá o formato de armazenamento.

### 10.3 Fluxo de alteração

1. A seção emite um comando.
2. O domínio valida e produz novo estado ou erro.
3. O controlador tenta persistir localmente o estado candidato.
4. Somente após sucesso local a sessão adota o novo estado e enfileira a sincronização.
5. As projeções afetadas são recalculadas.
6. As seções necessárias são atualizadas.

Os eventos serão delegados pela raiz da ficha. Substituir HTML de uma seção não removerá handlers globais ou de outras seções.

Se a persistência local falhar, o estado candidato será descartado, a sessão continuará no último estado confirmado e a interface mostrará o erro com opção de repetir a ação. Falha posterior da sincronização em nuvem não causará rollback do estado já salvo localmente.

### 10.4 Regras específicas

Recursos e ações específicas de classe ou subclasse serão fornecidos por consultas, efeitos e handlers do domínio. A ficha não comparará nomes como `"Bárbaro"` ou `"Mestre da Batalha"` para decidir regras.

Recursos declarativos comuns usarão componentes genéricos. Mecânicas complexas oficiais poderão fornecer projeções e comandos específicos por meio de contratos conhecidos.

### 10.5 Tela, impressão e PDF

Tela, impressão HTML e PDF usarão o mesmo `SheetViewModel`. Diferenças serão apenas de layout.

Isso elimina cálculos duplicados e divergências, incluindo nomes diferentes para PV temporário ou representações incompatíveis de dados de vida.

## 11. Persistência, sincronização e importação

Serão definidos contratos separados para:

- repositório de personagens;
- serialização e migração;
- importação e exportação;
- fila de sincronização;
- preferências globais;
- fonte de conteúdo.

O fluxo de leitura será:

1. carregar registro bruto;
2. detectar versão;
3. migrar;
4. normalizar;
5. validar referências;
6. criar modelo canônico;
7. preservar campos desconhecidos suportados em `extensions.legacyPassthrough`;
8. disponibilizar para a funcionalidade.

O fluxo de salvamento será:

1. validar modelo canônico;
2. gerar o registro plano v2 compatível com o baseline;
3. reemitir campos de passthrough sem sobrescrever campos reservados;
4. verificar limites de tamanho e quota;
5. salvar localmente;
6. adotar o estado na sessão;
7. enfileirar sincronização;
8. informar resultado ao controlador.

Falhas de sincronização não desfazem um salvamento local válido.

O importador atual continuará aceitando arrays de personagens legados. A validação deixará de ser apenas estrutural mínima e passará pelo pipeline de migração e normalização, sem descartar silenciosamente dados válidos desconhecidos.

Se um campo de passthrough colidir com um campo reservado v2, a importação ficará bloqueada em modo somente leitura e o registro bruto continuará exportável. Não haverá renomeação ou perda silenciosa.

O adaptador de sincronização aplicará o mesmo pipeline a registros do Firestore e da fila persistida. Exclusões pendentes continuarão identificadas apenas pelo ID do personagem. A semântica atual de `atualizado_em` e resolução de conflitos será caracterizada antes da refatoração e preservada.

Erros de quota local ou de tamanho máximo do documento em nuvem terão códigos próprios. Um documento grande demais para sincronizar continuará salvo localmente e será exibido com status de erro de sincronização.

## 12. GitHub Pages, carregamento e PWA

### 12.1 Caminhos

O caminho dos dados será definido em um único módulo de configuração e resolvido com URLs relativas explícitas. O deploy continuará preservando `site/` e `dados/` como diretórios irmãos.

Não haverá substituição de `../dados` por `./dados`. README e comentários desatualizados serão corrigidos.

### 12.2 Deploy

O desenvolvimento local continuará servindo diretamente os arquivos-fonte.

No GitHub Actions, um script de preparação:

- copiará os arquivos estáticos;
- descobrirá todos os módulos, assets e JSON;
- gerará um manifesto completo de precache;
- injetará a versão do deploy;
- produzirá o mesmo layout público atual.

### 12.3 Service Worker

O Service Worker:

- usará caches versionados;
- incluirá todo o grafo necessário para abrir a aplicação offline;
- incluirá módulos carregados dinamicamente;
- manterá dados oficiais disponíveis offline;
- continuará atualizando sem apagar `localStorage`;
- manterá fallback seguro quando um recurso não estiver disponível.

Em desenvolvimento, a ausência do manifesto gerado continuará permitindo cache sob demanda.

### 12.4 CSP

A política continuará permitindo somente os recursos locais e integrações Firebase/Google já necessárias. A futura origem de conteúdo customizado deverá ser arquivo ou armazenamento local; URLs arbitrárias permanecem proibidas.

Novos módulos não usarão handlers inline. O endurecimento completo de estilos inline fica fora do critério de conclusão desta refatoração.

## 13. Erros, validação e segurança

### 13.1 Erros estruturados

Erros esperados usarão código, escopo e contexto (a assinatura real é `createAppError({ code, scope, message, context })`; `reference` abaixo é um exemplo do que `context` carrega, não um campo próprio do erro):

```js
{
  code: "CONTENT_REFERENCE_NOT_FOUND",
  scope: "species",
  context: { reference: "dnd2024:species:anao" }
}
```

Categorias mínimas:

- conteúdo e referência;
- migração e schema;
- comando de domínio;
- persistência local;
- sincronização;
- rede e modo offline;
- renderização inesperada.

### 13.2 Tratamento

- Comandos rejeitados não alteram o estado.
- Conteúdo inválido não entra parcialmente no catálogo.
- O registro de cada fonte é atômico; uma entidade ou referência inválida rejeita o pacote da fonte.
- Erros fatais de inicialização bloqueiam apenas a funcionalidade afetada e apresentam diagnóstico.
- Falhas inesperadas são capturadas no limite da página.
- Ausência de conteúdo offline nunca sobrescreve a ficha.
- Logs não incluem o personagem completo.
- Falta de quota, documento remoto grande demais e conflito de migração possuem erros distintos e não causam perda silenciosa.

### 13.3 Validação

- Todos os tipos de conteúdo terão JSON Schema versionado.
- Dados oficiais serão validados em desenvolvimento e CI.
- IDs, referências, unicidade e compatibilidade de tipos serão verificados.
- O runtime fará validação estrutural na fronteira de cada fonte.
- Personagens serão validados depois da migração e antes do salvamento.

### 13.4 Conteúdo não confiável

Mesmo antes do importador customizado existir, renderizadores tratarão conteúdo como não confiável:

- texto será escapado;
- Markdown será sanitizado por lista permitida;
- atributos HTML não receberão strings brutas;
- URLs serão validadas por protocolo e origem;
- nenhum conteúdo será interpretado como JavaScript.

## 14. Estratégia de testes

Será criado um `package.json` somente para desenvolvimento. A aplicação continuará sem dependências obrigatórias no navegador.

### 14.1 Ferramentas

- executor nativo do Node para testes unitários e de contrato;
- validador compatível com JSON Schema para dados oficiais;
- Playwright para testes end-to-end, offline e regressão visual;
- verificações de sintaxe para todos os módulos;
- servidor HTTP estático controlado pelos testes de navegador.

### 14.2 Testes unitários

Cobrirão:

- IDs e resolução do catálogo;
- schemas e normalizadores;
- migrações;
- serialização plana v2 e compatibilidade com o baseline;
- consultas;
- comandos;
- efeitos declarativos;
- ordem, empilhamento e conflitos de efeitos;
- handlers oficiais;
- rejeição de handler por fonte sem capacidade interna;
- precedência de ajustes manuais;
- round-trip de campos desconhecidos;
- bloqueio somente leitura de schemas futuros;
- cálculos compartilhados pela tela e PDF.

### 14.3 Testes de contrato e integração

Cobrirão:

- fontes de conteúdo;
- repositório local;
- serialização/importação/exportação;
- fila de sincronização com adaptadores controlados;
- adaptador Firestore real contra Firebase Emulator, cobrindo upsert, remoção, fila legada e conflito por `atualizado_em`;
- `CreatorSession`;
- `SheetSession`;
- invalidação de passos;
- persistência após comandos;
- isolamento entre duas sessões.

Testes automatizados não escreverão em uma conta Firebase real. O Firebase Emulator será iniciado apenas pela suíte de integração.

### 14.4 Testes Playwright

Antes das alterações, Playwright registrará o comportamento do commit baseline `e43c5ea` e screenshots das telas principais.

Os fluxos mínimos serão:

- home sem e com personagens;
- criação de personagem não conjurador;
- criação de personagem conjurador;
- espécie com escolha de linhagem ou traço;
- antecedente, talento e escolhas associadas;
- métodos de atributos;
- seleção e alteração de equipamento;
- seleção de magias e grimório;
- abertura de ficha antiga;
- dano, cura, PV temporário e descansos;
- recursos de classe e subclasse;
- condições, defesas e concentração;
- moedas, compras e inventário;
- edição, salvamento e recarga;
- importação e exportação;
- impressão e geração de PDF;
- manifesto, registro, instalação e ativação do Service Worker;
- precache, recarga e navegação offline;
- atualização do Service Worker.

O prompt nativo de instalação da PWA não fará parte da automação, pois não é portátil entre navegadores. Sua exibição continuará em uma verificação manual de release; manifesto, worker e funcionamento offline serão automatizados.

A matriz Playwright será:

- suíte funcional completa em Chromium;
- smoke dos fluxos críticos em Firefox e WebKit;
- Service Worker, offline, download e regressão visual em Chromium;
- desktop em `1440×900`;
- móvel em `390×844`, com emulação de toque;
- baselines visuais gerados e comparados na mesma imagem Linux e versão fixada do Playwright;
- `maxDiffPixelRatio` de `0.002`;
- datas, IDs, animações e outros valores dinâmicos normalizados.

Baselines só poderão ser atualizados por comando explícito. Cada alteração deverá incluir revisão do diff visual; uma execução comum de testes nunca atualizará screenshots.

### 14.5 Fixtures de compatibilidade

Haverá fixtures anonimizadas representando:

- personagem legado mínimo;
- personagem de cada classe;
- conjuradores conhecidos e preparados;
- magias customizadas atuais;
- itens customizados atuais;
- recursos e edições manuais;
- diferentes estágios de migrações já existentes;
- exportação com campos desconhecidos preserváveis;
- registro v2 editado apenas em campos compatíveis pelo baseline;
- registro de versão futura mantido somente leitura;
- payload próximo aos limites de `localStorage` e Firestore.

## 15. Estratégia de execução

A refatoração ocorrerá integralmente na branch dedicada e não terá deploy parcial. Internamente seguirá estes marcos:

1. caracterizar o comportamento atual com testes e screenshots Playwright;
2. criar contratos, catálogo, schemas e validações;
3. criar modelo canônico, adaptador legado e migrações;
4. estruturar e validar os dados oficiais;
5. extrair consultas, comandos, efeitos e handlers;
6. substituir o criador pelo novo controlador e módulos de passo;
7. substituir a ficha pelo novo controlador e módulos de seção;
8. unificar tela, impressão e PDF;
9. ajustar imports dinâmicos, Service Worker e workflow;
10. executar toda a matriz de compatibilidade e regressão;
11. remover caminhos legados internos após a paridade.

Esses marcos são checkpoints de desenvolvimento, não releases separados.

O plano de implementação detalhado será um plano mestre dividido por esses marcos. Cada tarefa deverá deixar testes relevantes executáveis, mesmo que a branch só seja considerada entregável após o último marco.

## 16. Critérios de aceitação

A refatoração será considerada concluída quando:

- fichas existentes carregarem, salvarem, sincronizarem e exportarem sem perda;
- exportações antigas continuarem importáveis;
- o registro plano v2 permanecer legível pelo commit baseline `e43c5ea` para conteúdo oficial existente;
- o round-trip legado → canônico → legado preservar campos desconhecidos suportados;
- schemas futuros permanecerem exportáveis sem serem sobrescritos;
- backup pré-migração poder ser validado, exportado e restaurado;
- os sete passos e a aparência do criador permanecerem equivalentes;
- todas as ações atuais da ficha permanecerem disponíveis;
- tela, impressão e PDF produzirem os mesmos valores;
- todos os conteúdos oficiais possuírem IDs estáveis;
- referências de conteúdo estarem fixadas a uma versão ou migrarem explicitamente;
- todos os JSON e referências forem válidos;
- descrições não controlarem mecânicas;
- domínio não depender do navegador ou persistência;
- renderizações e consultas não alterarem estado;
- conteúdo inserido em HTML for escapado ou sanitizado;
- home, criador e ficha funcionarem online e offline no GitHub Pages;
- o manifesto do Service Worker cobrir todos os módulos e dados necessários;
- os testes unitários, de integração e Playwright passarem;
- os testes do adaptador Firestore passarem contra Firebase Emulator;
- não houver dependências obrigatórias de build para desenvolvimento local;
- `creator.js` e `sheet.js` importarem apenas composição/controladores, exportarem suas entradas públicas e não contiverem templates, comparações de conteúdo ou regras de domínio.

## 17. Decisões aprovadas

- abordagem de núcleo de domínio e catálogo versionado;
- interface comum para todos os tipos de conteúdo;
- UI atual preservada;
- compatibilidade integral com dados existentes;
- ferramentas Node permitidas apenas para desenvolvimento e deploy;
- efeitos customizados futuros limitados a vocabulário declarativo conhecido;
- handlers executáveis restritos ao conteúdo oficial;
- JSON oficiais poderão mudar de formato;
- execução integral na branch dedicada;
- Playwright obrigatório para caracterização, E2E, offline e regressão visual.
