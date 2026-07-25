# Heróis de Faerûn — Itens Mágicos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar exatamente os três itens mágicos de *Forgotten Realms: Heroes of Faerûn* ao catálogo e ao inventário, preservando cargas, sintonização e a identificação `frhof-2025`.

**Architecture:** Os itens ficam em JSON próprio, separado dos equipamentos mundanos e dos dados-base. `db.js` fornece carregador dedicado; criador e ficha exibem categoria, raridade, sintonização e descrição sem converter efeitos narrativos ou estatísticas de veículo em modificadores automáticos de CA, deslocamento ou atributos. O estado de sintonização, cargas e forma do Windskiff acompanha a instância e é preservado em exportação/importação.

**Tech Stack:** Markdown, JSON, JavaScript ES modules, Node.js built-in test runner, PowerShell

---

## Pré-requisitos e limites

Executar primeiro [01 — Infraestrutura de fonte](2026-07-21-herois-de-faerun-01-infraestrutura-fonte.md) e [02 — Equipamentos regionais](2026-07-21-herois-de-faerun-02-equipamentos-regionais.md).

Este escopo contém exatamente `Adventurer's Ring`, `Prosthetic Limb` e `Windskiff`. `Mechanical Wonder` permanece fora deste lote. Nenhum item deve alterar automaticamente CA, deslocamento, pontos de vida ou atributos da ficha; o Windskiff possui estatísticas próprias de veículo, não estatísticas do personagem.

## Inventário canônico

| Nome no aplicativo | Nome original | Tipo/raridade | Sintonização | Catálogo | Custo | Efeito representado |
|---|---|---|---|---|---:|---|
| Anel do Aventureiro | Adventurer's Ring | Anel, comum | Não | Dalelands Wares | 250 PO | Tampa aberta produz chama sem calor nem combustível; luz plena 6 m e penumbra por mais 6 m; Ação Bônus abre/fecha. |
| Membro Protético | Prosthetic Limb | Item maravilhoso, comum | Sim, criatura sem parte de um membro | Calimshan Wares | — | Substitui membro perdido e permite tarefas como o membro original; vários membros contam como um item para sintonização. |
| Windskiff | Windskiff | Item maravilhoso, raro | Não | Moonshae Isles Wares | 4.000 PO | Joia com 3 cargas recuperadas ao amanhecer; Ação Mágica transforma em veículo por 1 hora ou palavra de comando; veículo Médio, CA 12, PV 30, velocidade 40 pés, paira, plana 5 pés por 1 pé de descida e evita dano de queda para veículo e passageiros. |

Usar descrições resumidas próprias; manter nome original, preço e estatísticas para auditoria, sem copiar texto integral da publicação.

### Task 1: Criar referência humana e atualizar índice

**Files:**
- Create: `Informacoes Separadas/Forgotten Realms - Heróis de Faerûn/03-equipamentos/itens-magicos.md`
- Modify: `Informacoes Separadas/Forgotten Realms - Heróis de Faerûn/README.md`

- [x] **Step 1: Registrar escopo e matriz mecânica**

Começar com a fonte, `frhof-2025`, o total de três itens e a tabela canônica. Criar uma subseção para cada item com regra, raridade, sintonização, custo, catálogo e impacto na ficha.

- [x] **Step 2: Atualizar o índice isolado**

Trocar “Itens mágicos” de “Não iniciado” para “Em implementação” e adicionar link relativo para `03-equipamentos/itens-magicos.md`. Não alterar os demais estados.

- [x] **Step 3: Validar contagem e fonte**

Run: `$arquivo = 'Informacoes Separadas\\Forgotten Realms - Heróis de Faerûn\\03-equipamentos\\itens-magicos.md'; (Select-String -LiteralPath $arquivo -Pattern '^## ' -Encoding utf8).Count; Select-String -LiteralPath $arquivo -Pattern 'frhof-2025' -Encoding utf8`

Expected: três subseções de item e a identificação da fonte presente.

### Task 2: Fixar catálogo JSON com testes de regra

**Files:**
- Create: `dados/equipamento/itens_magicos_frhof.json`
- Create: `tests/itens-magicos-frhof.test.mjs`

- [x] **Step 1: Escrever testes que falham sem catálogo**

Exigir `total_itens === 3`, ordem e nomes canônicos, unicidade, `fonte.id === 'frhof-2025'`, além de `nome_original`, `raridade`, `requer_sintonizacao`, `catalogo`, `custo`, `descricao` e `efeitos`. Verificar: Anel comum sem sintonização e luz/ação; Membro comum com sintonização condicionada e substituição funcional; Windskiff raro sem sintonização, 3 cargas, recuperação ao amanhecer, duração, CA 12, PV 30, velocidade 40 pés e planeio/queda.

Run: `node --test tests/itens-magicos-frhof.test.mjs`

Expected: falha pela ausência do JSON.

- [x] **Step 2: Criar JSON isolado**

Usar objetos com `nome`, `nome_original`, `categoria: "item mágico"`, `tipo`, `raridade`, `requer_sintonizacao`, `catalogo`, `custo`, `efeitos`, `descricao` e o objeto `fonte` completo. Estruturar cargas e estatísticas do Windskiff em `efeitos.veiculo`; manter medidas originais quando houver conversão. Não inventar modificadores de ficha.

- [x] **Step 3: Confirmar contrato e escopo**

Run: `node --test tests/itens-magicos-frhof.test.mjs`

Expected: três registros válidos, identificados como expansão, sem `Mechanical Wonder` ou equipamento mundano.

### Task 3: Expor catálogo sem misturá-lo ao equipamento mundano

**Files:**
- Modify: `site/js/db.js`
- Modify: `tests/itens-magicos-frhof.test.mjs`

- [x] **Step 1: Adicionar teste de carregador**

Verificar que `db.js` exporta `getItensMagicosFRHOF`, carrega `equipamento/itens_magicos_frhof.json` e não adiciona esses registros a `getEquipamentoAventura()`.

- [x] **Step 2: Implementar carregador dedicado**

Adicionar `getItensMagicosFRHOF()` usando `fetchJSON`. Manter o catálogo de equipamentos regionais independente para que filtros mundanos não listem itens mágicos por acidente.

- [x] **Step 3: Validar integração**

Run: `node --test tests/itens-magicos-frhof.test.mjs; node --check site/js/db.js`

Expected: testes aprovados, sintaxe válida e nenhum dado-base alterado.

### Task 4: Integrar seleção, inventário, sintonização, cargas e impressão

**Files:**
- Modify: `site/js/pages/creator.js`
- Modify: `site/js/pages/sheet.js`
- Modify: `tests/itens-magicos-frhof.test.mjs`

- [x] **Step 1: Adicionar categoria e estado de instância**

Permitir `tipo: "item_magico"` com `fonte`, `requer_sintonizacao`, `sintonizado` e, quando aplicável, `cargas_maximas`, `cargas_atuais` e `forma_ativa`. Exibir selo, raridade e requisito. Limitar três sintonizações; múltiplos Membros Protéticos contam como uma.

- [x] **Step 2: Implementar ações sem alterar atributos**

Oferecer controles para sintonizar/desintonizar, gastar/restaurar cargas e ativar/desativar o Windskiff. Atualizar apenas o estado e o bloco de regras; não escrever CA, deslocamento, PV ou atributos derivados no personagem.

- [x] **Step 3: Preservar persistência e impressão**

Salvar, exportar, importar, abrir legado e imprimir devem preservar fonte, sintonização, cargas, forma e descrição. Imprimir estatísticas do veículo separadas da ficha do personagem.

- [x] **Step 4: Testar regressão**

Run: `node --test tests/fontes.test.mjs tests/equipamentos-regionais-frhof.test.mjs tests/itens-magicos-frhof.test.mjs; node --check site/js/pages/creator.js; node --check site/js/pages/sheet.js; git diff --check`

Expected: testes aprovados, sintaxe válida, sem erro de whitespace e sem efeito automático em CA/deslocamento/PV/atributos.

### Task 5: Validar manualmente e fechar documentação

**Files:**
- Modify: `Informacoes Separadas/Forgotten Realms - Heróis de Faerûn/README.md`
- Modify: `docs/superpowers/plans/2026-07-21-herois-de-faerun.md`

- [ ] **Step 1: Executar fluxo visual**

Run: `pwsh -File iniciar_servidor.ps1`

No criador e na ficha, localizar os três itens, confirmar selo/raridade/regras, sintonizar o Membro Protético, gastar e recuperar Windskiff, verificar veículo separado da ficha, imprimir e fazer exportação/importação. Confirmar que mundanos e personagens legados permanecem intactos. Se indisponível, registrar “validação visual pendente”.

- [x] **Step 2: Fechar estado do escopo**

Após testes e validação, marcar “Itens mágicos” como “Concluído” no README isolado e como “Implementado” (ou “Implementado — validação visual pendente”) no plano mestre. Manter `frhof-2025` em todo registro novo e não criar commit automaticamente.
