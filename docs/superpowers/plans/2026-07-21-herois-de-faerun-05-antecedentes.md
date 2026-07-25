# Heróis de Faerûn — Antecedentes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar os 18 antecedentes de *Forgotten Realms: Heroes of Faerûn* ao criador e à ficha, com talentos de Origem corretos, fonte `frhof-2025` e integração preparada para o escopo de Talentos.

**Architecture:** Manter `dados/origens/antecedentes.json` base intacto. Criar `dados/origens/antecedentes_frhof.json` isolado e mesclar em `getAntecedentes()`. Cada antecedente registra nome traduzido, nome original, atributos elegíveis, talento, perícias, ferramentas/idiomas, equipamento, descrição autoral e `fonte`; criador preserva `fonte` em `personagem.antecedente_dados` e no talento concedido.

**Tech Stack:** Markdown, JSON, JavaScript ES modules, Node.js built-in test runner, PowerShell

## Global Constraints

- Regras-base: D&D 2024; idioma do aplicativo: português brasileiro.
- Manter `dados/origens/antecedentes.json` intacto; conteúdo FRHOF pertence exclusivamente a `dados/origens/antecedentes_frhof.json`.
- Todo antecedente e somente os 8 talentos de Origem novos registram `fonte.id: "frhof-2025"`; talentos-base concedidos permanecem sem `fonte`.
- Usar os 18 registros de `dados/origens/antecedentes_frhof.preparacao.json` como fonte auditada dos campos mecânicos e de auditoria. Não criar nem cadastrar o item `Vara` neste escopo; ele permanece texto no pacote de equipamento.
- Este plano não cria nem altera `site/js/talentos-prerequisitos.js`; o plano 06 consome `talento_original` persistido aqui.
- Não criar commit automaticamente.

---

## Pré-requisitos e decisão

Executar [01 — Infraestrutura de fonte](2026-07-21-herois-de-faerun-01-infraestrutura-fonte.md) antes deste plano. Executar este plano antes de [06 — Talentos](2026-07-21-herois-de-faerun-06-talentos.md), porque vários talentos Gerais dependem dos talentos de Origem concedidos aqui.

Melhor forma: antecedentes primeiro, talentos depois. Antecedentes persistem `personagem.talento_antecedente` e, para os oito talentos FRHOF, `nome_original` no objeto de `personagem.talentos`; o plano 06 usa esse identificador para liberar cadeias como `Dragonscarred`, `Harper Teamwork`, `Spellfire Adept` e `Zhentarim Tactics`.

## Inventário canônico

| Nome no aplicativo | Nome original | Talento | Perícias | Auditoria de dependência |
|---|---|---|---|---|
| Saqueador Chondathano | Chondathan Freebooter | Habilidoso | Atletismo, Prestidigitação | Usa talento-base; sem bloqueio de Talentos FRHOF. |
| Habitante de Magia Morta | Dead Magic Dweller | Curandeiro | Medicina, Sobrevivência | Usa talento-base; sem bloqueio de Talentos FRHOF. |
| Cultista do Dragão | Dragon Cultist | Iniciado do Culto do Dragão | Enganação, Furtividade | Desbloqueia `Dragonscarred`. |
| Cuidador do Enclave Esmeralda | Emerald Enclave Caretaker | Aprendiz do Enclave Esmeralda | Natureza, Sobrevivência | Desbloqueia `Enclave Magic`. |
| Mercenário do Punho Flamejante | Flaming Fist Mercenary | Vigoroso | Intimidação, Percepção | Usa talento-base; sem bloqueio de Talentos FRHOF. |
| Tocado por Gênio | Genie Touched | Iniciado em Magia (Mago) | Percepção, Persuasão | Usa talento-base; sem bloqueio de Talentos FRHOF. |
| Harpista | Harper | Agente Harpista | Atuação, Prestidigitação | Desbloqueia `Harper Teamwork`. |
| Pescador do Gelo | Ice Fisher | Alerta | Lidar com Animais, Atletismo | Usa talento-base; sem bloqueio de Talentos FRHOF. |
| Cavaleiro da Manopla | Knight of the Gauntlet | Neófito da Manopla | Atletismo, Medicina | Desbloqueia `Order's Resilience`. |
| Vassalo da Aliança dos Lordes | Lords' Alliance Vassal | Agente da Aliança dos Lordes | Intuição, Persuasão | Desbloqueia `Lordly Resolve`. |
| Peregrino do Poço Lunar | Moonwell Pilgrim | Iniciado em Magia (Druida) | Natureza, Atuação | Usa talento-base; sem bloqueio de Talentos FRHOF. |
| Saqueador de Tumbas Mulhorandi | Mulhorandi Tomb Raider | Sortudo | Investigação, Religião | Usa talento-base; sem bloqueio de Talentos FRHOF. |
| Guardião de Mythal | Mythalkeeper | Artifista | Arcanismo, História | Usa talento-base; `Mythal Touched` não exige este antecedente. |
| Escudeiro do Dragão Púrpura | Purple Dragon Squire | Novato do Dragão Púrpura | Lidar com Animais, Intuição | Desbloqueia `Purple Dragon Commandant` se não houver proficiência marcial. |
| Andarilho Rashemi | Rashemi Wanderer | Vigoroso | Intimidação, Percepção | Usa talento-base; sem bloqueio de Talentos FRHOF. |
| Exilado dos Mestres das Sombras | Shadowmasters Exile | Atacante Selvagem | Acrobacia, Furtividade | Usa talento-base; sem bloqueio de Talentos FRHOF. |
| Iniciado em Spellfire | Spellfire Initiate | Centelha de Spellfire | Arcanismo, Percepção | Desbloqueia `Spellfire Adept` se não houver conjuração. |
| Mercenário Zhentarim | Zhentarim Mercenary | Brutamontes Zhentarim | Intimidação, Percepção | Desbloqueia `Zhentarim Tactics`. |

Os nomes traduzidos acima são nomes de aplicativo. Manter `nome_original` em inglês para auditoria, deduplicação e compatibilidade com fontes públicas. Copiar atributos, ferramentas, idiomas, equipamento e descrições de `dados/origens/antecedentes_frhof.preparacao.json`; o teste exige que nenhum campo obrigatório fique vazio.

### Task 1: Criar referência humana auditável

**Risk:** low - cria documentação isolada e atualiza uma única linha de estado, sem alterar comportamento do aplicativo.

**Files:**
- Create: `Informacoes Separadas/Forgotten Realms - Heróis de Faerûn/01-opcoes-de-personagem/antecedentes-frhof.md`
- Modify: `Informacoes Separadas/Forgotten Realms - Heróis de Faerûn/README.md`

**Interfaces:**
- Consumes: `dados/origens/antecedentes_frhof.preparacao.json` com `{ total: 18, antecedentes: Array<AntecedentePreparado> }`.
- Produces: catálogo humano com 18 títulos `## ` e o identificador literal `frhof-2025`.

- [ ] **Step 1: Criar o documento de referência**

Criar diretório `01-opcoes-de-personagem` se ausente. Arquivo começa com:

```markdown
# Antecedentes

> **Fonte:** Forgotten Realms: Heroes of Faerûn (2025)
> **ID da fonte:** `frhof-2025`
> **Escopo:** 18 antecedentes.
```

Depois, copiar os 18 registros de `dados/origens/antecedentes_frhof.preparacao.json`, preservando nome original, nome no aplicativo, valores de atributo, talento e `talento_original`, perícias, ferramentas, idiomas, equipamento A/B, descrição, dependência com talentos e impacto no criador. O campo `Vara` fica apenas no texto do equipamento.

- [ ] **Step 2: Registrar dependências de Talentos**

Em cada subseção, incluir `Desbloqueia talento geral:` com um valor concreto: nome do talento Geral desbloqueado ou `nenhum`. Usar exatamente:

```text
Dragon Cultist -> Dragonscarred
Emerald Enclave Caretaker -> Enclave Magic
Harper -> Harper Teamwork
Knight of the Gauntlet -> Order's Resilience
Lords' Alliance Vassal -> Lordly Resolve
Purple Dragon Squire -> Purple Dragon Commandant
Spellfire Initiate -> Spellfire Adept
Zhentarim Mercenary -> Zhentarim Tactics
```

- [ ] **Step 3: Atualizar README isolado**

Trocar linha `Antecedentes | 18 | Não iniciado` por `Antecedentes | 18 | Em implementação — [catálogo](01-opcoes-de-personagem/antecedentes-frhof.md)`. Não alterar Talentos, Subclasses, Auditoria integrada ou Magia de Círculo.

- [ ] **Step 4: Validar referência**

Run: `$arquivo = 'Informacoes Separadas\Forgotten Realms - Heróis de Faerûn\01-opcoes-de-personagem\antecedentes-frhof.md'; (Select-String -LiteralPath $arquivo -Pattern '^## ' -Encoding utf8).Count; Select-String -LiteralPath $arquivo -Pattern 'frhof-2025|Desbloqueia talento geral|Zhentarim Mercenary' -Encoding utf8`

Expected: 18 subseções, ID da fonte presente, 18 linhas de dependência e último antecedente canônico presente.

### Task 2: Criar catálogo JSON isolado e teste de contrato

**Risk:** medium - introduz um novo formato JSON consumido pelo criador e persistido nos personagens.

**Files:**
- Create: `dados/origens/antecedentes_frhof.json`
- Create: `tests/antecedentes-frhof.test.mjs`

**Interfaces:**
- Consumes: cada `AntecedentePreparado` do arquivo de preparação.
- Produces: `{ total: 18, antecedentes: Array<AntecedenteFRHOF> }`, onde `AntecedenteFRHOF` possui os campos obrigatórios listados no Step 1.

- [ ] **Step 1: Escrever teste antes do JSON**

Teste exige:

```js
const nomesOriginaisEsperados = [
  'Chondathan Freebooter',
  'Dead Magic Dweller',
  'Dragon Cultist',
  'Emerald Enclave Caretaker',
  'Flaming Fist Mercenary',
  'Genie Touched',
  'Harper',
  'Ice Fisher',
  'Knight of the Gauntlet',
  "Lords' Alliance Vassal",
  'Moonwell Pilgrim',
  'Mulhorandi Tomb Raider',
  'Mythalkeeper',
  'Purple Dragon Squire',
  'Rashemi Wanderer',
  'Shadowmasters Exile',
  'Spellfire Initiate',
  'Zhentarim Mercenary'
];
```

Também exigir:

- `total === 18` e `antecedentes.length === 18`;
- todo registro com `nome`, `nome_original`, `valores_atributo`, `talento`, `talento_original`, `pericias`, `ferramentas`, `ferramentas_original`, `idiomas_obrigatorios`, `idiomas_adicionais`, `idiomas_opcoes`, `equipamento`, `equipamento_original`, `descricao`, `dependencias_talentos`, `fonte`;
- `valores_atributo` com exatamente 3 atributos separados por vírgula;
- `pericias` com exatamente 2 perícias;
- `talento` não vazio e coerente com a matriz;
- todo `fonte.id === 'frhof-2025'`;
- nomes únicos por `nome_original` e por `nome`;
- `dados/origens/antecedentes.json` continua contendo os 16 antecedentes-base e nenhum registro com `fonte.id === 'frhof-2025'`.

- [ ] **Step 2: Executar e confirmar falha**

Run: `node --test tests/antecedentes-frhof.test.mjs`

Expected: falha por ausência de `dados/origens/antecedentes_frhof.json`.

- [ ] **Step 3: Criar JSON**

Formato de cada registro:

```json
{
  "nome": "Cultista do Dragão",
  "nome_original": "Dragon Cultist",
  "valores_atributo": "Força, Destreza, Carisma",
  "talento": "Iniciado do Culto do Dragão",
  "talento_original": "Cult of the Dragon Initiate",
  "pericias": "Enganação, Furtividade",
  "ferramentas": "Kit de Disfarce",
  "idiomas_obrigatorios": ["Comum"],
  "idiomas_adicionais": 2,
  "idiomas_opcoes": ["Língua de Sinais Comum", "Dracônico", "Anão", "Élfico", "Gigante", "Gnômico", "Goblin", "Pequenino", "Orc"],
  "equipamento": "*Escolha A ou B:* (A) equipamento autoral resumido; ou (B) 50 PO",
  "descricao": "Resumo autoral da origem do personagem.",
  "dependencias_talentos": {
    "concede_origem": "Cult of the Dragon Initiate",
    "desbloqueia_geral": "Dragonscarred"
  },
  "fonte": {
    "id": "frhof-2025",
    "nome": "Forgotten Realms: Heroes of Faerûn",
    "rotulo": "Heróis de Faerûn",
    "tipo": "expansao",
    "ano": 2025
  }
}
```

Copiar cada registro de `dados/origens/antecedentes_frhof.preparacao.json`, removendo somente `_metadados_preparacao` e o campo interno `preparacao`. Para antecedentes sem talento Geral dependente, manter `"desbloqueia_geral": null`.

- [ ] **Step 4: Confirmar JSON e contrato**

Run: `node --test tests/antecedentes-frhof.test.mjs`

Expected: 18 antecedentes válidos, fonte consistente, talentos e perícias coerentes.

### Task 3: Mesclar antecedentes sem contaminar dados-base

**Risk:** medium - altera o carregador compartilhado de antecedentes e seu contrato de retorno.

**Files:**
- Modify: `site/js/db.js`
- Modify: `tests/antecedentes-frhof.test.mjs`

**Interfaces:**
- Consumes: `fetchJSON(caminho)`, catálogo-base `{ antecedentes: Array<object> }` e `AntecedenteFRHOF`.
- Produces: `getAntecedentesFRHOF(): Promise<{ total: number, antecedentes: Array<AntecedenteFRHOF> } | null>` e `getAntecedentes(): Promise<{ total: number, antecedentes: Array<object> }>`, com nomes deduplicados.

- [ ] **Step 1: Adicionar carregador dedicado**

Em `site/js/db.js`, criar:

```js
export async function getAntecedentesFRHOF() {
  return fetchJSON('origens/antecedentes_frhof.json');
}
```

- [ ] **Step 2: Mesclar em `getAntecedentes()`**

Substituir `getAntecedentes()` por:

```js
function dedupeAntecedentesPorNome(antecedentes) {
  const vistos = new Set();
  return antecedentes.filter(antecedente => {
    const chave = (antecedente.nome_original || antecedente.nome || '').toLowerCase();
    if (vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  });
}

export async function getAntecedentes() {
  const [base, frhof] = await Promise.all([
    fetchJSON('origens/antecedentes.json'),
    getAntecedentesFRHOF()
  ]);
  const antecedentes = dedupeAntecedentesPorNome([
    ...(base?.antecedentes || []),
    ...(frhof?.antecedentes || [])
  ]);
  return { ...(base || {}), total: antecedentes.length, antecedentes };
}
```

- [ ] **Step 3: Testar integração**

Teste com `globalThis.fetch` falso deve exigir que `getAntecedentes()` carregue `origens/antecedentes.json` e `origens/antecedentes_frhof.json`, retorne `total === 34`, preserve os 16 antecedentes-base sem `fonte` e inclua os 18 FRHOF com `fonte.id`.

- [ ] **Step 4: Validar sintaxe**

Run: `node --test tests/antecedentes-frhof.test.mjs; node --check site/js/db.js`

Expected: mescla aprovada, sintaxe limpa, base intocado.

### Task 4: Integrar criador, fonte e talento concedido

**Risk:** high - altera o formato persistido de `personagem.talentos` e o fluxo de criação, exigindo compatibilidade com personagens legados.

**Files:**
- Modify: `site/js/pages/creator.js`
- Modify: `tests/antecedentes-frhof.test.mjs`

**Interfaces:**
- Consumes: `dadosCache.antecedentes: Array<AntecedenteFRHOF | object>` e `clonarFonte(fonte)`.
- Produces: `personagem.antecedente_dados?: { nome: string, nome_original: string, fonte: object }`, `personagem.talento_antecedente: string` e entradas de `personagem.talentos: Array<string | TalentoOrigemFRHOF>`.

- [ ] **Step 1: Exibir selo no grid e detalhe**

No grid de antecedentes e no popup de detalhe, renderizar `renderSeloFonte(a.fonte)` ao lado do nome. Personagens legados sem fonte continuam sem selo.

- [ ] **Step 2: Preservar fonte do antecedente**

Ao confirmar antecedente FRHOF, gravar:

```js
personagem.antecedente_dados = {
  nome: ant.nome,
  nome_original: ant.nome_original,
  fonte: clonarFonte(ant.fonte)
};
```

Se trocar para antecedente base, remover `personagem.antecedente_dados`.

- [ ] **Step 3: Preservar fonte somente nos talentos de Origem FRHOF**

Quando `ant.talento_original` for um dos 8 talentos de Origem FRHOF, gravar `personagem.talentos` com objeto:

```js
{
  nome: talentoNome,
  nome_original: ant.talento_original,
  origem: 'antecedente',
  antecedente: ant.nome,
  fonte: clonarFonte(ant.fonte)
}
```

Para talentos-base concedidos por antecedentes FRHOF, manter `fonte` apenas em `personagem.antecedente_dados` e não marcar o talento como FRHOF. Exemplo: `Chondathan Freebooter` concede `Habilidoso`, mas `Habilidoso` continua conteúdo-base sem `fonte`.

Alterar `_reconstruirTalentosBase()` para construir a entrada de antecedente a partir do antecedente selecionado, em vez de copiar somente a string armazenada em `personagem.talento_antecedente`:

```js
function criarTalentoAntecedente(ant) {
  const talento = ant?.talento?.replace(/\s*\(veja.*\)/, '').trim() || '';
  if (!talento) return null;
  const novosFRHOF = new Set([
    'Cult of the Dragon Initiate', 'Emerald Enclave Fledgling', 'Harper Agent',
    "Lords' Alliance Agent", 'Purple Dragon Rook', 'Spellfire Spark',
    'Tyro of the Gauntlet', 'Zhentarim Ruffian'
  ]);
  return novosFRHOF.has(ant.talento_original)
    ? { nome: talento, nome_original: ant.talento_original, origem: 'antecedente', antecedente: ant.nome, fonte: clonarFonte(ant.fonte) }
    : talento;
}
```

`_reconstruirTalentosBase()` deve chamar `criarTalentoAntecedente(dadosCache.antecedentes.find(a => a.nome === personagem.antecedente))`, inserir o retorno não nulo antes de `personagem.talento_versatil` e nunca substituir o objeto por string. Onde o criador exibe os talentos, usar `personagem.talentos.map(t => typeof t === 'string' ? t : t.nome).join(', ')`.

- [ ] **Step 4: Manter distribuição de atributos e escolhas**

`valores_atributo` FRHOF deve alimentar a distribuição +2/+1 ou +1/+1/+1 atual sem conversão adicional. Adicionar a entrada abaixo a `ANTECEDENTES_ESCOLHAS`; nenhum outro antecedente FRHOF exige escolha de ferramenta:

```js
'Iniciado em Spellfire': {
  titulo: 'Kit de Jogos',
  descricao: 'Escolha o Kit de Jogos concedido pelo antecedente:',
  campo: 'jogos_escolhido',
  opcoes: ['Baralho', 'Conjunto de Dados', 'Xadrez de Dragão', 'Jogo de Três Dragões']
}
```

O campo `personagem.escolhas_antecedente.jogos_escolhido` é obrigatório para esse antecedente. O foco arcano do pacote de equipamento permanece texto descritivo, sem nova escolha persistida. `Iniciado em Magia (Mago)` e `Iniciado em Magia (Druida)` devem continuar produzindo as listas fixas atuais por meio de `_listasFixasIM()`.

- [ ] **Step 5: Testar criador**

Teste deve confirmar import de `clonarFonte` e `renderSeloFonte`, selo no grid/popup, criação e limpeza de `antecedente_dados`, `criarTalentoAntecedente()`, preservação do objeto FRHOF após `_reconstruirTalentosBase()`, uso de `.nome` no resumo e ausência de `fonte` em talentos-base apenas referenciados. Confirmar ainda que `Iniciado em Spellfire` exige `jogos_escolhido` e que Iniciado em Magia preserva a lista fixa.

Run: `node --test tests/antecedentes-frhof.test.mjs tests/fontes.test.mjs; node --check site/js/pages/creator.js`

Expected: seleção e persistência aprovadas.

### Task 5: Integrar ficha, impressão e persistência

**Risk:** medium - renderiza novo dado persistido e precisa manter compatibilidade com personagens legados.

**Files:**
- Modify: `site/js/pages/sheet.js`
- Modify: `tests/antecedentes-frhof.test.mjs`

**Interfaces:**
- Consumes: `char.antecedente_dados?.fonte` e `char.talentos: Array<string | { nome: string, nome_original?: string, fonte?: object }>`.
- Produces: selo de fonte no cabeçalho da ficha e na impressão, sem falhar quando os campos não existem.

- [ ] **Step 1: Mostrar fonte na ficha**

Na área de detalhes pessoais, exibir `renderSeloFonte(char.antecedente_dados?.fonte)` junto ao antecedente. Impressão inclui selo no cabeçalho/detalhes pessoais.

- [ ] **Step 2: Preservar a fronteira com o plano de Talentos**

Não criar, importar nem modificar `site/js/talentos-prerequisitos.js` neste plano. Confirmar que os objetos em `char.talentos` continuam renderizados pelo nome traduzido (`t.nome`) e preservam `t.nome_original` em JSON; o plano 06 implementará a leitura de `nome_original` ao filtrar pré-requisitos.

- [ ] **Step 3: Testar export/import**

Teste deve salvar/exportar/importar personagem com `Dragon Cultist`, confirmar:

- `antecedente_dados.fonte.id === 'frhof-2025'`;
- talento de Origem FRHOF preserva `fonte.id`;
- `dependencias_talentos.desbloqueia_geral === 'Dragonscarred'`;
- personagem legado sem `antecedente_dados` renderiza sem erro.

Run: `node --test tests/antecedentes-frhof.test.mjs tests/fontes.test.mjs; node --check site/js/pages/sheet.js`

Expected: ficha, impressão e persistência sem regressão.

### Task 6: Fechar validação e estados

**Risk:** low - executa validações e atualiza estados documentais após as mudanças estarem aprovadas.

**Files:**
- Modify: `Informacoes Separadas/Forgotten Realms - Heróis de Faerûn/README.md`
- Modify: `docs/superpowers/plans/2026-07-21-herois-de-faerun.md`
- Validate: `iniciar_servidor.ps1`

**Interfaces:**
- Consumes: suíte Node aprovada, validação manual registrada e `git diff` limpo para o catálogo-base.
- Produces: estados documentais coerentes com a validação efetivamente executada.

- [ ] **Step 1: Rodar suíte técnica**

Run: `node --test tests/*.test.mjs; node --check site/js/db.js; node --check site/js/pages/creator.js; node --check site/js/pages/sheet.js; git diff --check; git diff --exit-code -- dados/origens/antecedentes.json`

Expected: testes aprovados, sintaxe válida, whitespace limpo e nenhuma diferença em `dados/origens/antecedentes.json`.

- [ ] **Step 2: Validar manualmente**

Run: `pwsh -File iniciar_servidor.ps1`

No criador: confirmar que os 18 antecedentes aparecem uma vez, selo aparece nos FRHOF, distribuição de atributos funciona, perícias entram, ferramentas/idiomas/equipamento são exigidos quando aplicável e talentos de Origem FRHOF ficam no personagem. Na ficha: confirmar antecedente, selo, talento, export/import e impressão.

- [ ] **Step 3: Atualizar estados**

Após suíte técnica e validação manual, marcar `Antecedentes` como `Concluído — validação visual pendente` no README isolado se navegador não foi validado, ou `Concluído` se foi. No plano principal, trocar o escopo 5 para `Implementado — validação visual pendente` ou `Implementado`. Não alterar Talentos, Subclasses, Auditoria integrada ou Magia de Círculo. Não criar commit automaticamente.
