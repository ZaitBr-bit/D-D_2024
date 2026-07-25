# Heróis de Faerûn — Magias Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar as 19 magias de *Forgotten Realms: Heroes of Faerûn* às listas e à ficha, com auditoria explícita de círculo, classes, componentes, duração, concentração, recursos, propriedades derivadas e selo `frhof-2025`.

**Architecture:** Manter conteúdo-base intacto. Um catálogo JSON isolado guarda as 19 magias completas e uma matriz `efeitos_ficha`; `db.js` mescla índice, círculos e listas de classe em memória. Criador e ficha usam os carregadores existentes, exibem fonte e detalhes, consomem espaços de magia pelo fluxo atual e aplicam somente efeitos mapeados no registro de efeitos da ficha. Regras de Circle Magic ficam armazenadas para auditoria, mas não são ativadas neste escopo; permanecem no escopo 9.

**Tech Stack:** Markdown, JSON, JavaScript ES modules, Node.js built-in test runner, PowerShell

---

## Pré-requisitos e limites

Executar [01 — Infraestrutura de fonte](2026-07-21-herois-de-faerun-01-infraestrutura-fonte.md), [02 — Equipamentos regionais](2026-07-21-herois-de-faerun-02-equipamentos-regionais.md) e [03 — Itens mágicos](2026-07-21-herois-de-faerun-03-itens-magicos.md) antes deste plano.

Escopo exato: 19 magias abaixo. `Blade of Disaster` é conteúdo reeditado de *Tasha’s Cauldron of Everything*, mas recebe `fonte.frhof-2025` neste catálogo porque está sendo disponibilizada pela expansão. Não adicionar Circle Magic como ação executável; somente preservar os campos `circulo_magico` para o escopo 9.

## Catálogo canônico e auditoria de ficha

| Nome original | Círculo | Escola | Classes | Propriedade de ficha a auditar |
|---|---:|---|---|---|
| Spellfire Flare | 1 | Evocação | Sorcerer, Wizard | Ataque e dano instantâneos; nenhum estado persistente. |
| Wardaway | 1 | Abjuração | Bard, Cleric, Paladin, Wizard | Dano, velocidade reduzida pela metade e escolha limitada de ação no próximo turno do alvo. |
| Death Armor | 2 | Necromancia | Sorcerer, Wizard | Vantagem em testes contra morte; dano necrótico reativo uma vez por turno; duração 1 hora, sem concentração. |
| Deryan’s Helpful Homunculi | 2 | Conjuração | Cleric, Wizard | Ritual opcional; custo material consumido; assistência de fabricação; nenhum modificador de combate automático. |
| Elminster’s Elusion | 2 | Abjuração | Wizard | Vantagem contra magias/efeitos mágicos e negação de dano pela metade em salvamento bem-sucedido; concentração. |
| Cacophonic Shield | 3 | Evocação | Bard, Sorcerer, Wizard | Resistência a trovante, desvantagem em ataques à distância contra o conjurador e condição Surdo na área; concentração. |
| Conjure Constructs | 3 | Conjuração | Wizard | Dano de Força ou PV temporários para alvo; concentração; ação mágica recorrente. |
| Laeral’s Silver Lance | 3 | Evocação | Cleric, Sorcerer, Wizard | Salvamento de Força, dano de Força e condição Caído; instantânea. |
| Sylune’s Viper | 3 | Conjuração | Druid, Wizard | 15 PV temporários, deslocamento de escalada igual ao deslocamento e ataque que pode causar Envenenado/Incapacitado; duração 1 hora. |
| Backlash | 4 | Abjuração | Bard, Sorcerer, Warlock, Wizard | Reação reduz dano recebido e pode causar dano de Força ao agressor; instantânea. |
| Doomtide | 4 | Conjuração | Bard, Cleric, Warlock | Área de Escuridão mágica, dano Psíquico e penalidade de 1d6 em salvamentos; concentração. |
| Spellfire Storm | 4 | Evocação | Sorcerer, Wizard | Área luminosa, dano Radiante e dissipação de magia lançada na área; concentração; parâmetros adicionais de Circle Magic apenas documentados. |
| Alustriel’s Mooncloak | 5 | Abjuração | Bard, Druid, Ranger, Wizard | Meia Cobertura (+2 CA e salvamentos de Destreza), resistências a Frio/Elétrico/Radiante, reação de libertação e cura opcional; concentração. |
| Songol’s Elemental Suffusion | 5 | Transmutação | Druid, Sorcerer, Wizard | Voo, resistência/afinidade elemental e dano de área com possível Caído; concentração. Registrar escolha elemental sem alterar atributo base. |
| Dirge | 6 | Encantamento | Bard, Cleric | Área impede recuperação de PV, causa dano e Caído/velocidade reduzida; Circle Magic pode aplicar Exaustão, mas fica inativo neste escopo; concentração. |
| Elminster’s Effulgent Spheres | 6 | Evocação | Druid, Sorcerer, Wizard | 6 esferas temporárias; reação gasta esfera para resistência ou ação bônus para ataque; termina quando esferas acabam. Não confundir com cargas de item. |
| Simbul’s Synostodweomer | 7 | Transmutação | Sorcerer, Wizard | Cura o alvo quando ele gasta espaço de magia, consumindo Dados de Vida; duração 1 hora. |
| Holy Star of Mystra | 8 | Evocação | Cleric, Wizard | Três-Quartos de Cobertura (+5 CA e salvamentos de Destreza), raio de Força/Radiante e reação de deflexão; concentração. |
| Blade of Disaster | 9 | Conjuração | Sorcerer, Warlock, Wizard | Fenda móvel, ataques críticos em 18–20 e dano de Força; concentração; nenhum ajuste automático permanente de CA/deslocamento. |

A tabela é matriz de auditoria; os valores completos de alcance, componentes, duração, dano, escalonamento por espaço, condições, escolhas e Circle Magic devem existir no JSON e na referência humana. Círculo de espaço de magia continua sendo o nível mínimo da magia; “cargas” de `Elminster’s Effulgent Spheres` são recurso temporário da conjuração e não recarregam em descanso.

### Task 1: Criar referência humana e índice da expansão

**Files:**
- Create: `Informacoes Separadas/Forgotten Realms - Heróis de Faerûn/02-magias/magias-frhof.md`
- Modify: `Informacoes Separadas/Forgotten Realms - Heróis de Faerûn/README.md`

- [x] **Step 1: Registrar as 19 magias**

Começar o arquivo com `Fonte: Forgotten Realms: Heroes of Faerûn (2025)`, `ID da fonte: frhof-2025`, total 19 e a tabela canônica completa. Criar uma subseção `##` por magia, com nome original, nome no aplicativo, círculo, escola, classes, tempo de conjuração, alcance, componentes, duração, concentração, descrição resumida, escalonamento por espaço e campos de Circle Magic documentados como “não executado neste escopo”.

- [x] **Step 2: Registrar auditoria de ficha**

Em cada subseção, incluir bloco `Impacto na ficha` com uma destas classificações: `nenhum estado persistente`, `efeito temporário aplicado`, `recurso temporário da conjuração`, `condição/defesa manual`, ou `efeito de área`. Indicar explicitamente CA, deslocamento, PV temporários, resistências, salvamentos, condições, ações, Dados de Vida e recuperação por descanso quando aplicável.

- [x] **Step 3: Atualizar README isolado**

Alterar somente a linha “Magias” para `Em implementação — [catálogo](02-magias/magias-frhof.md)`; manter 19, convenções, exclusões e estados dos outros escopos.

- [x] **Step 4: Validar contagem e campos humanos**

Run: `$arquivo = 'Informacoes Separadas\\Forgotten Realms - Heróis de Faerûn\\02-magias\\magias-frhof.md'; (Select-String -LiteralPath $arquivo -Pattern '^## ' -Encoding utf8).Count; Select-String -LiteralPath $arquivo -Pattern 'frhof-2025|Circle Magic|Impacto na ficha' -Encoding utf8`

Expected: 19 subseções, fonte presente, 19 blocos de impacto e Circle Magic citado sem ativação.

### Task 2: Criar catálogo JSON completo e testes de auditoria

**Files:**
- Create: `dados/magias/magias_frhof.json`
- Create: `tests/magias-frhof.test.mjs`

- [x] **Step 1: Escrever teste de contrato antes do JSON**

Exigir `total_magias === 19`, nomes únicos na ordem do catálogo canônico, `fonte` completo com `id: frhof-2025`, e estes campos em cada registro: `nome`, `nome_original`, `circulo`, `escola`, `classes`, `tempo_conjuracao`, `alcance`, `componentes`, `duracao`, `concentracao`, `descricao`, `circulo_superior`, `efeitos_ficha`, `recursos_temporarios` e `circulo_magico`.

- [x] **Step 2: Verificar regras e propriedades**

Testar explicitamente: níveis 1–9; classes conforme a tabela; `concentracao` coerente com `duracao`; `efeitos_ficha.propriedades` cobrindo CA, deslocamento, PV temporários, resistências, salvamentos, condições, ações, Dados de Vida e recuperação quando citados; `Elminster’s Effulgent Spheres` com 6 esferas temporárias; `Simbul’s Synostodweomer` com consumo de Dados de Vida; `Spellfire Storm`, `Doomtide` e `Dirge` com `circulo_magico.implementado === false`; ausência de `recarga_descanso_longo` em magias que não possuem esse recurso.

Run: `node --test tests/magias-frhof.test.mjs`

Expected: falha por ausência do JSON.

- [x] **Step 3: Criar os 19 registros**

Formato mínimo obrigatório:

```json
{
  "nome": "Manto de Lua de Alustriel",
  "nome_original": "Alustriel's Mooncloak",
  "circulo": 5,
  "escola": "Abjuração",
  "classes": ["Bardo", "Druida", "Guardião", "Mago"],
  "tempo_conjuracao": "Ação",
  "alcance": "Pessoal",
  "componentes": "V, S, M (uma pedra da lua de 50+ PO)",
  "duracao": "Concentração, até 1 minuto",
  "concentracao": true,
  "descricao": "Resumo autoral da magia, sem copiar o texto integral da publicação.",
  "circulo_superior": "Texto completo do escalonamento, ou null",
  "efeitos_ficha": {
    "propriedades": ["ca", "salvaguardas_destreza", "resistencias", "condicoes", "cura_pv"],
    "modo": "temporario_concentracao",
    "operacoes": ["meia_cobertura", "resistencia_frio_eletrico_radiante", "libertacao_reacao", "cura_4d10_mod_conjuracao"]
  },
  "recursos_temporarios": [],
  "circulo_magico": {
    "disponivel_na_fonte": true,
    "implementado": false,
    "motivo": "Escopo 9 — Magia de Círculo"
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

Substituir o resumo de exemplo pelo texto autoral completo de cada magia e usar `null`/`[]` quando campo não se aplicar. Não adicionar propriedades automáticas que a magia não concede.

- [x] **Step 4: Confirmar JSON e matriz**

Run: `node --test tests/magias-frhof.test.mjs`

Expected: 19 magias válidas, propriedades auditadas, fonte consistente, sem conteúdo de Circle Magic executável.

### Task 3: Integrar carregadores, índice, círculos e listas de classe

**Files:**
- Modify: `site/js/db.js`
- Modify: `tests/magias-frhof.test.mjs`

- [x] **Step 1: Adicionar carregador dedicado**

Adicionar `getMagiasFRHOF()` retornando `fetchJSON('magias/magias_frhof.json')`. Não editar `_indice.json`, `circulo_*.json` ou `por_classe/*.json` base.

- [x] **Step 2: Mesclar sem duplicar conteúdo-base**

Atualizar `getIndiceMagias()` para retornar base + resumo FRHOF, `getMagiasPorCirculo(circulo)` para retornar base + registros FRHOF daquele círculo, e `getMagiasPorClasseLista(nomeClasse)` para retornar a lista base + resumos FRHOF da classe. Deduplicar por nome original/canônico e preservar `fonte` apenas nos 19 novos registros.

- [x] **Step 3: Validar isolamento e buscas**

Testar que `buscarMagias('spellfire')`, `getMagia('Manto de Lua de Alustriel', 5)` e a lista de cada classe retornam os registros FRHOF; testar que os 391 registros-base continuam presentes, sem alteração nos JSONs-base, e que cada magia nova aparece uma única vez.

Run: `node --test tests/magias-frhof.test.mjs; node --check site/js/db.js`

Expected: carregadores, índice, círculos e classes integrados; nenhuma duplicação ou contaminação do arquivo-base.

### Task 4: Integrar criador e ficha com fonte, círculo e detalhes

**Files:**
- Modify: `site/js/pages/creator.js`
- Modify: `site/js/pages/sheet.js`
- Modify: `tests/magias-frhof.test.mjs`

- [x] **Step 1: Preservar fonte nas seleções**

Ao adicionar magia FRHOF a `magias_conhecidas` ou `magias_preparadas`, manter `{ nome, circulo, origem, fonte }`. Exibir selo `Heróis de Faerûn` no seletor, detalhe, lista da ficha e impressão. Personagens legados sem `fonte` continuam válidos.

- [x] **Step 2: Exibir auditoria completa**

Detalhe de magia deve mostrar círculo, escola, classes, tempo, alcance, componentes, duração, concentração, descrição, escalonamento, propriedades de ficha e aviso “Circle Magic: reservado ao escopo 9” quando `circulo_magico.disponivel_na_fonte` for verdadeiro.

- [x] **Step 3: Validar slots e círculos**

Garantir que a seleção use o círculo real da magia, consuma espaço do círculo mínimo ou superior pelo fluxo existente, não conte magia FRHOF duas vezes e não trate `recursos_temporarios` como espaços de magia.

- [x] **Step 4: Testar persistência e impressão**

Salvar, exportar, importar, abrir legado, imprimir overlay/PDF e reabrir ficha; confirmar `magias_conhecidas[].fonte.id`, `magias_preparadas[].fonte.id`, círculo, descrição e selo preservados.

### Task 5: Aplicar propriedades mecânicas compatíveis com a ficha

**Files:**
- Modify: `site/js/pages/sheet.js`
- Modify: `site/js/utils.js` (somente se cálculo existente precisar reconhecer novo tipo)
- Modify: `tests/magias-frhof.test.mjs`

- [x] **Step 1: Mapear efeitos para o registro existente**

Adicionar entradas em `MAGIAS_EFEITO` para os efeitos compatíveis com o motor atual: resistência, vantagem/desvantagem, condição, deslocamento, PV temporários, dano reativo, buff de salvamento, cobertura/CA e cura. Reutilizar `aplicarEfeitoMagico`, `char.efeitos_magicos`, `char.pv_temporario` e `getDeslocamentoFinal`; não criar uma segunda fonte de verdade.

- [x] **Step 2: Implementar estados especiais**

Adicionar estado persistente por conjuração para: seis esferas de Elminster (gastar esfera por reação/ação bônus), cura de Simbul consumindo Dados de Vida do alvo, libertação/cura de Alustriel, reação de Backlash, deflexão da Holy Star e dissipação de magia da Spellfire Storm. Estados devem expirar por duração/concentração ou término definido, sem alterar atributos-base permanentemente.

- [x] **Step 3: Integrar descanso e encerramento**

Descanso Longo restaura somente espaços de magia e recursos de classe já previstos; não “recarregar” esferas ou recursos de uma magia ainda ativa. Ao terminar concentração/duração, remover efeitos derivados de CA, deslocamento, resistências, PV temporários e condições vinculados à magia. Circle Magic continua não executável.

- [x] **Step 4: Cobrir propriedades em testes**

Testar, no mínimo: Alustriel (+2 CA/cobertura, salvamentos de Destreza e resistências), Holy Star (cobertura sem duplicar bônus), Sylune (PV temporários e escalada), Cacophonic (resistência e desvantagem), Elminster (vantagem contra magia), Wardaway (velocidade/ação temporárias), Simbul (Dados de Vida), Effulgent Spheres (6→5→fim) e magias sem efeito persistente.

### Task 6: Fechar validação integrada e estado da expansão

**Files:**
- Modify: `Informacoes Separadas/Forgotten Realms - Heróis de Faerûn/README.md`
- Modify: `docs/superpowers/plans/2026-07-21-herois-de-faerun.md`
- Validate: `iniciar_servidor.ps1`

- [x] **Step 1: Rodar suíte técnica**

Run: `node --test tests/*.test.mjs; node --check site/js/db.js; node --check site/js/pages/creator.js; node --check site/js/pages/sheet.js; git diff --check`

Expected: todos os testes aprovados, sintaxe válida, nenhuma falha de whitespace.

- [ ] **Step 2: Validar manualmente**

Run: `pwsh -File iniciar_servidor.ps1`

No criador e na ficha: localizar as 19 magias por nome e classe; confirmar círculo, selo, detalhes, concentração, propriedades de ficha, seleção de alvo, consumo de espaços, encerramento de concentração, estados temporários, persistência, impressão e ausência de Circle Magic executável. Registrar explicitamente validação visual pendente se navegador não estiver disponível.

- [x] **Step 3: Atualizar estados**

Após suíte técnica e validação manual, marcar “Magias” como `Concluído — validação visual pendente` no README isolado e `Implementado — validação visual pendente` no plano mestre. Não alterar estados de Talentos, Antecedentes, Subclasses, Auditoria integrada ou Magia de Círculo. Manter `frhof-2025` em todas as 19 magias e não criar commit automaticamente.
