# Heróis de Faerûn — Equipamentos Regionais Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar os 12 equipamentos regionais mundanos de *Heroes of Faerûn* ao catálogo, aos seletores e ao inventário, todos marcados como `frhof-2025`.

**Architecture:** Um JSON isolado contém 9 itens de aventura e 3 instrumentos. `db.js` mescla esse arquivo ao retorno já consumido por criador e ficha, sem alterar o JSON do Livro do Jogador. A referência Markdown registra tradução, nome original e regra resumida. A infraestrutura de selo e persistência vem integralmente do escopo 1.

**Tech Stack:** Markdown, JSON, JavaScript ES modules, Node.js built-in test runner

---

## Pré-requisito e limite

Executar primeiro [01 — Infraestrutura de fonte](2026-07-21-herois-de-faerun-01-infraestrutura-fonte.md).

Este escopo contém exatamente:

- 9 equipamentos de aventura mundanos;
- 3 instrumentos musicais mundanos.

Não contém:

- `Adventurer's Ring`, `Prosthetic Limb` e `Windskiff`: escopo 3, itens mágicos;
- montarias e animais, serviços de viagem, `Covered Wagon` e `Mechanical Wonder`: não pertencem às quantidades aprovadas; exigem expansão explícita de escopo;
- qualquer regra de Magia de Círculo.

## Inventário canônico

| Nome no aplicativo | Nome original | Categoria | Catálogo | Peso | Custo | Critério mecânico |
|---|---|---|---|---:|---:|---|
| Manto Fúngico Luminoso | Bright Fungal Cloak | equipamento de aventura | Icewind Dale Wares | 2 kg | 25 PO | Ação Bônus abre/fecha; aberto emite luz plena 1,5 m e penumbra por mais 1,5 m; contém 0,5 kg de fungo comestível e vira Roupa de Viajante após consumo. |
| Roupas do Deserto | Desert Clothing | equipamento de aventura | Calimshan Wares | 2 kg | 10 PO | Sem armadura média ou pesada, sucesso automático contra calor extremo. |
| Máscara de Diabo | Devil Mask | equipamento de aventura | Baldur's Gate Wares | — | 25 PO | Outras criaturas têm Desvantagem em Investigação e Intuição para descobrir identidade ou intenções. |
| Traje de Luz e Sombra | Garb of Light and Shadow | equipamento de aventura | Moonshae Isles Wares | 3 kg | 50 PO | Escolhe um Domínio do Deleite; Vantagem para influenciar Fadas associadas a ele. |
| Robe de Gênio | Genie Robe | equipamento de aventura | Calimshan Wares | 3 kg | 50 PO | Escolhe Ar, Terra, Fogo ou Água; Vantagem para influenciar Elementais do plano escolhido. |
| Livro de Magias com Fechadura | Locking Spellbook | equipamento de aventura | Dalelands Wares | 1,5 kg | 35 PO | Livro de 100 páginas; Ação Utilizar e teste de Destreza (Prestidigitação) CD 15 com Ferramentas de Ladrão para abrir sem chave. |
| Camuflagem de Monstro | Monster Camouflage | equipamento de aventura | Icewind Dale Wares | 3 kg | 50 PO | Disfarce de Besta ou Monstruosidade; Ação Estudar e Investigação ou Natureza CD 10; Vantagem a até 9 m; sucesso automático se o usuário agir de modo impossível para o monstro. |
| Roupas Fúngicas Quentes | Warm Fungal Clothing | equipamento de aventura | Icewind Dale Wares | 2 kg | 15 PO | Sucesso automático contra frio extremo; contém 0,5 kg de fungo comestível e vira Roupa de Viajante após consumo. |
| Camuflagem de Inverno | Winter Camouflage | equipamento de aventura | Icewind Dale Wares | 2 kg | 50 PO | Vantagem em Furtividade enquanto usada em ambiente apropriado. |
| Bandore | Bandore | instrumento musical | Moonshae Isles Wares | 1,5 kg | 65 PO | Instrumento musical; proficiência permite adicionar o Bônus de Proficiência aos testes pertinentes. |
| Cittern | Cittern | instrumento musical | Moonshae Isles Wares | 1 kg | 65 PO | Instrumento musical; proficiência permite adicionar o Bônus de Proficiência aos testes pertinentes. |
| Yarting | Yarting | instrumento musical | Moonshae Isles Wares | 1 kg | 40 PO | Instrumento musical; proficiência permite adicionar o Bônus de Proficiência aos testes pertinentes. |

Usar linguagem própria e resumida nos campos `descricao`; não copiar parágrafos integrais da publicação.

### Task 1: Criar referência humana auditável

**Files:**
- Create: `Informacoes Separadas/Forgotten Realms - Heróis de Faerûn/03-equipamentos/equipamentos-regionais.md`
- Modify: `Informacoes Separadas/Forgotten Realms - Heróis de Faerûn/README.md`

- [x] **Step 1: Criar o documento de referência**

O arquivo começa exatamente com:

```markdown
# Equipamentos Regionais

> **Fonte:** Forgotten Realms: Heroes of Faerûn (2025)
> **ID da fonte:** `frhof-2025`
> **Escopo:** 12 equipamentos mundanos; 9 itens de aventura e 3 instrumentos musicais.
```

Depois, registrar a tabela do inventário canônico e uma subseção para cada item com regra resumida, custo, peso, catálogo e nome original.

- [x] **Step 2: Atualizar o índice da expansão**

No README isolado, marcar “Equipamentos regionais” como “Em implementação” e adicionar link relativo para `03-equipamentos/equipamentos-regionais.md`. Manter itens mágicos como não iniciados.

- [x] **Step 3: Validar estrutura e contagem**

Run: `$arquivo = 'Informacoes Separadas\Forgotten Realms - Heróis de Faerûn\03-equipamentos\equipamentos-regionais.md'; (Select-String -LiteralPath $arquivo -Pattern '^## ' -Encoding utf8).Count; Select-String -LiteralPath $arquivo -Pattern 'ID da fonte.*frhof-2025' -Encoding utf8`

Expected: 12 subseções de item e uma ocorrência do ID da fonte.

### Task 2: Fixar o catálogo JSON com teste

**Files:**
- Create: `dados/equipamento/equipamentos_regionais_frhof.json`
- Create: `tests/equipamentos-regionais-frhof.test.mjs`

- [x] **Step 1: Escrever o teste do catálogo**

O teste deve carregar o JSON e exigir:

```js
const nomesEsperados = [
  'Manto Fúngico Luminoso',
  'Roupas do Deserto',
  'Máscara de Diabo',
  'Traje de Luz e Sombra',
  'Robe de Gênio',
  'Livro de Magias com Fechadura',
  'Camuflagem de Monstro',
  'Roupas Fúngicas Quentes',
  'Camuflagem de Inverno',
  'Bandore',
  'Cittern',
  'Yarting'
];
```

Também exigir:

- `total_itens === 12` e `itens.length === 12`;
- nomes únicos e na ordem acima;
- 9 registros com `categoria === 'equipamento de aventura'`;
- 3 registros com `categoria === 'instrumento musical'`;
- todo registro com `fonte.id === 'frhof-2025'` e objeto completo igual ao registro canônico;
- `nome_original`, `catalogo`, `peso`, `custo` e `descricao` não vazios;
- ausência dos três itens mágicos e dos cinco grupos fora do escopo.

- [x] **Step 2: Executar e confirmar a falha**

Run: `node --test tests/equipamentos-regionais-frhof.test.mjs`

Expected: falha por ausência do JSON.

- [x] **Step 3: Criar o JSON**

Formato de cada registro:

```json
{
  "nome": "Manto Fúngico Luminoso",
  "nome_original": "Bright Fungal Cloak",
  "categoria": "equipamento de aventura",
  "catalogo": "Icewind Dale Wares",
  "peso": "2 kg",
  "peso_original": "4 lb.",
  "custo": "25 PO",
  "tipo_uso": "equipamento",
  "descricao": "Como Ação Bônus, abra ou feche o manto. Aberto, ele emite luz plena em 1,5 m e penumbra por mais 1,5 m. Seus 0,5 kg de fungo servem como comida; consumidos por completo, o item se torna uma Roupa de Viajante.",
  "fonte": {
    "id": "frhof-2025",
    "nome": "Forgotten Realms: Heroes of Faerûn",
    "rotulo": "Heróis de Faerûn",
    "tipo": "expansao",
    "ano": 2025
  }
}
```

Criar os outros 11 registros com os valores e critérios da tabela canônica. Instrumentos usam `tipo_uso: "ferramenta"`; os demais, `tipo_uso: "equipamento"`.

- [x] **Step 4: Confirmar JSON e contrato**

Run: `node --test tests/equipamentos-regionais-frhof.test.mjs`

Expected: testes aprovados, 12 itens válidos.

### Task 3: Mesclar o catálogo sem contaminar os dados-base

**Files:**
- Modify: `site/js/db.js`
- Modify: `tests/equipamentos-regionais-frhof.test.mjs`

- [x] **Step 1: Escrever verificação estática da integração**

Exigir que `db.js` exporte `getEquipamentosRegionaisFRHOF`, carregue `equipamento/equipamentos_regionais_frhof.json` e use `Promise.all` em `getEquipamentoAventura`.

- [x] **Step 2: Executar e confirmar a falha**

Run: `node --test tests/equipamentos-regionais-frhof.test.mjs`

Expected: falha apenas na integração do carregador.

- [x] **Step 3: Implementar carregamento e mesclagem**

Em `site/js/db.js`:

```js
export async function getEquipamentosRegionaisFRHOF() {
  return fetchJSON('equipamento/equipamentos_regionais_frhof.json');
}

export async function getEquipamentoAventura() {
  const [base, regional] = await Promise.all([
    fetchJSON('equipamento/equipamento_aventura.json'),
    getEquipamentosRegionaisFRHOF()
  ]);

  const itensBase = base?.itens || [];
  const itensRegionais = regional?.itens || [];
  return {
    ...(base || {}),
    total_itens: itensBase.length + itensRegionais.length,
    itens: [...itensBase, ...itensRegionais]
  };
}
```

Substituir a implementação anterior de `getEquipamentoAventura`; não manter duas exportações com o mesmo nome. Não editar `dados/equipamento/equipamento_aventura.json`.

- [x] **Step 4: Validar teste e sintaxe**

Run: `node --test tests/equipamentos-regionais-frhof.test.mjs; node --check site/js/db.js`

Expected: testes aprovados e sintaxe válida.

### Task 4: Validar criador, ficha, compra e persistência

**Files:**
- Modify: `tests/equipamentos-regionais-frhof.test.mjs`
- Validate: `site/js/pages/creator.js`
- Validate: `site/js/pages/sheet.js`

- [x] **Step 1: Acrescentar teste de item de inventário**

Com `Manto Fúngico Luminoso` como fixture, simular o objeto produzido pelos seletores e verificar:

- `nome`, `custo`, `peso`, `descricao` e `fonte.id` preservados;
- ida e volta por JSON preserva `fonte.id` e `descricao`;
- custo `25 PO` é compatível com `parseCusto` usado pela ficha;
- peso `2 kg` é compatível com o parser de peso existente.

- [x] **Step 2: Executar testes e checagens**

Run: `node --test tests/fontes.test.mjs tests/equipamentos-regionais-frhof.test.mjs; node --check site/js/pages/creator.js; node --check site/js/pages/sheet.js; git diff --check`

Expected: todos os testes aprovados, sintaxe válida e nenhum erro de whitespace.

- [ ] **Step 3: Verificar o fluxo no navegador**

Run: `pwsh -File iniciar_servidor.ps1`

No criador e na ficha:

- buscar cada um dos 12 nomes e confirmar que aparece uma vez;
- confirmar selo `Heróis de Faerûn` no seletor, inventário e detalhes;
- adicionar `Manto Fúngico Luminoso` e confirmar regra, 2 kg e 25 PO;
- ativar “Comprar”, adquirir um item com saldo suficiente e confirmar débito;
- tentar compra sem saldo e confirmar bloqueio;
- imprimir e confirmar selo legível;
- exportar, excluir apenas a cópia de teste, importar e confirmar `inventario[].fonte.id`;
- abrir personagem legado e confirmar ausência de regressão;
- nenhum dos três itens mágicos aparece neste lote;
- nenhum commit criado.

### Task 5: Fechar documentação do lote

**Files:**
- Modify: `Informacoes Separadas/Forgotten Realms - Heróis de Faerûn/README.md`
- Modify: `docs/superpowers/plans/2026-07-21-herois-de-faerun.md`

- [x] **Step 1: Atualizar estados somente após a validação**

Marcar equipamentos regionais como concluídos no README isolado. No plano principal, trocar o estado do escopo 1 e do escopo 2 para “Implementado” somente se todas as tarefas e verificações dos dois subplanos estiverem concluídas.

- [x] **Step 2: Auditoria final de escopo**

Run: `rg -n 'frhof-2025|Heróis de Faerûn' dados/fontes.json dados/equipamento/equipamentos_regionais_frhof.json site/js/fontes.js site/js/pages/creator.js site/js/pages/sheet.js 'Informacoes Separadas/Forgotten Realms - Heróis de Faerûn/03-equipamentos/equipamentos-regionais.md'`

Expected: fonte presente nos 12 registros, helpers, duas interfaces e referência; nenhuma ocorrência adicionada aos JSONs de conteúdo-base.
