# Heróis de Faerûn Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrar ao aplicativo o conteúdo mecânico aprovado de *Forgotten Realms: Heroes of Faerûn*, sempre identificado pela fonte `frhof-2025`.

**Architecture:** Este arquivo é o índice do programa. Cada escopo possui um plano executável independente em `docs/superpowers/plans/`. As referências humanas permanecem em `Informacoes Separadas/Forgotten Realms - Heróis de Faerûn/`; os dados consumidos pelo aplicativo ficam em `dados/`; a integração ocorre nos módulos ES de `site/js/`.

**Tech Stack:** Markdown, JSON, JavaScript ES modules, CSS, Node.js test runner, PowerShell

---

## Regras globais

- Identificador canônico: `frhof-2025`.
- Selo visual: `Heróis de Faerûn`.
- Todo registro novo da expansão recebe o objeto `fonte`; conteúdo-base apenas referenciado não recebe essa identificação.
- A fonte acompanha seleção, inventário, ficha, impressão, salvamento, exportação e importação.
- Divindades, facções, Renome, Bastião, regiões e atlas estão fora do escopo.
- Magia de Círculo é o último escopo, depois da auditoria integrada.
- Nenhuma execução cria commit sem solicitação expressa.

## Subplanos

| Ordem | Escopo | Quantidade | Plano | Estado do plano |
|---:|---|---:|---|---|
| 1 | Estrutura, inventário e identificação da fonte | 1 infraestrutura | [01 — Infraestrutura de fonte](2026-07-21-herois-de-faerun-01-infraestrutura-fonte.md) | Implementado |
| 2 | Equipamentos regionais mundanos | 12 | [02 — Equipamentos regionais](2026-07-21-herois-de-faerun-02-equipamentos-regionais.md) | Implementado |
| 3 | Itens mágicos | 3 | [03 — Itens mágicos](2026-07-21-herois-de-faerun-03-itens-magicos.md) | Implementado |
| 4 | Magias | 19 | [04 — Magias](2026-07-21-herois-de-faerun-04-magias.md) | Implementado — |
| 5 | Antecedentes | 18 | [05 — Antecedentes](2026-07-21-herois-de-faerun-05-antecedentes.md) | Plano criado |
| 6 | Talentos | 34 | [06 — Talentos](2026-07-21-herois-de-faerun-06-talentos.md) | Plano criado — depende de Antecedentes |
| 7 | Subclasses | 8 | A criar | Pendente |
| 8 | Auditoria integrada | 1 bateria | A criar | Pendente |
| 9 | Correção: fonte ausente na concessão inicial de Iniciado em Magia / Conjurador Ritualista | 1 correção | A criar | Pendente |
| 10 | Magia de Círculo | 1 subsistema | A criar | Último escopo |

## Dependências

```text
01 Infraestrutura de fonte
  └─ 02 Equipamentos regionais
       └─ 03 Itens mágicos
            └─ 04 Magias
                 └─ 05 Antecedentes
                      └─ 06 Talentos
                           └─ 07 Subclasses
                                └─ 08 Auditoria integrada
                                     └─ 09 Correção: fonte em Iniciado em Magia / Conjurador Ritualista
                                          └─ 10 Magia de Círculo
```

Os escopos 3 a 7 podem reutilizar a infraestrutura do escopo 1, mas a ordem acima continua sendo a ordem recomendada de entrega e validação. Antecedentes vem antes de Talentos para que os talentos de Origem da expansão desbloqueiem corretamente os talentos Gerais dependentes.

## Escopo 9 — Correção: fonte ausente na concessão inicial de Iniciado em Magia / Conjurador Ritualista

Achado durante a integração do merge de `main` em `faeruen` (2026-07-25): a concessão **inicial** desses talentos pela ficha (`abrirModalIniciadoEmMagiaFicha` em `site/js/pages/sheet.js`) delega a `aplicarEfeitoTalento`, em `site/js/regras-cobertura.js:290-306`. Essa função é **síncrona** e não tem acesso a dados de magia (sem import de `db.js` ou `fontes.js`), então as entradas de `magias_conhecidas`/`magias_preparadas` que ela cria (truques e magia de 1º círculo do Iniciado em Magia) nunca carregam `fonte`, mesmo quando a magia escolhida é FRHOF.

Os pontos equivalentes já corrigidos (fluxo de edição/troca em `sheet.js` e a concessão via level up em `levelup.js`) buscam a magia em `getIndiceMagias()`/`getMagiasClasse()` antes do push. `aplicarEfeitoTalento` não pode fazer isso sem se tornar assíncrona, o que exige propagar `async`/`await` por todos os chamadores (pelo menos `abrirModalIniciadoEmMagiaFicha` em `sheet.js`, e qualquer outro ponto que invoque `aplicarEfeitoTalento` para talentos que concedem magia).

**Escopo da correção:**
- Tornar `aplicarEfeitoTalento` assíncrona (ou extrair um caminho assíncrono só para os casos que envolvem magia).
- Buscar a `fonte` da magia via `getIndiceMagias()` (mesmo padrão de `levelup.js`) antes de montar as entradas de `Iniciado em Magia` (linhas ~300-306) e, se aplicável, `Conjurador Ritualista` (linhas ~280-287) nesse mesmo arquivo.
- Atualizar todos os chamadores de `aplicarEfeitoTalento` para `await`.
- Cobrir com teste: uma magia FRHOF concedida pela concessão inicial de Iniciado em Magia deve preservar `fonte` em `magias_conhecidas`/`magias_preparadas`.
