# Regras de negócio — domínio Antecedentes

**Data:** 2026-08-07
**Domínio 2 de 6** do mapa em `testes/regras/README.md`. O piloto foi Talentos.

Este plano segue o [guia de próximos domínios](../../../testes/regras/GUIA-PROXIMOS-DOMINIOS.md).
O checklist de pré-voo já foi executado e o resultado está registrado abaixo —
é o insumo do desenho, não burocracia.

## Pré-voo (feito, com evidência)

**O que o livro define.** `Informacoes Separadas/Antecedente.md:19-32` lista
exatamente **cinco** partes de um antecedente, e são cinco regras verificáveis
por máquina:

| Parte | Regra do livro |
|---|---|
| Valores de Atributo | três atributos nomeados; **+2 em um e +1 em outro, OU +1 nos três**; nenhum acima de 20 |
| Talento | um talento de Origem específico |
| Perícias | proficiência em **duas** perícias específicas |
| Ferramentas | **uma** ferramenta específica, ou uma escolhida da categoria Ferramentas de Artesão |
| Equipamento | escolha entre **um pacote ou 50 PO** |

São 16 antecedentes (`## Nome`, linhas 76–297).

**Idiomas não são parte do antecedente.** O livro os trata como regra de
criação: `Criação de Personagens.md:143` — "Comum e mais dois idiomas que você
pode escolher da tabela Idiomas Comuns". `dados/origens/antecedentes.json`
modela isso *por antecedente* (`idiomas_obrigatorios`, `idiomas_adicionais`,
`idiomas_opcoes`), o que é escolha de modelagem, não divergência: verifiquei
que os 16 carregam a mesma lista e que as 9 opções batem exatamente com a
tabela Idiomas Comuns do livro. **Fica fora do catálogo de antecedentes** e
volta como regra transversal no domínio de criação.

**Todos os caminhos do usuário** (lição 2 do guia — foi ela que escondeu o bug
do Habilidoso por duas rodadas). Para antecedente há **um só**: o passo do
assistente de criação. Verificado: `site/js/sheet/edicao.js` apenas *lê*
`bonus_antecedente` para exibir e para validar o teto de 20
(`ficha-edicao-validacoes.js:14`); não existe fluxo de troca de antecedente na
ficha. Isso é uma diferença real em relação a talentos, que tinha quatro
portas — e precisa ser reconfirmado pelo implementador, não aceito de mim.

**Os mecanismos do app.** Diferente de talentos, **não há função pura para
confrontar**: `passo-antecedente.js` exporta só `renderStepAntecedente` e
`_reconstruirTalentosBase`; os efeitos são aplicados dentro de handlers de
evento, e a distribuição de atributos vive em `passo-atributos.js:111-167`.
Copiar a arquitetura de talentos aqui seria o erro nº 1 do guia — medir o
mecanismo em vez do comportamento.

## Desenho: onde cada confronto vive

Duas camadas, com divisão diferente da de talentos:

**Unidade — o catálogo contra `dados/`.** `dados/origens/antecedentes.json` é
o que o app consome; se ele diverge do livro, *todos* os fluxos estão errados
na origem, e isso é detectável sem navegador. Este é o confronto de maior
retorno por custo neste domínio, e não existia em talentos (lá o catálogo era
confrontado contra funções do app).

**Navegador — o comportamento.** Se o app realmente concede as duas perícias,
a ferramenta, o talento, aplica o aumento de atributo na forma escolhida e
oferece a escolha de equipamento. Como não há função pura, é aqui que a regra
é de fato verificada.

## Estrutura de arquivos

```
testes/regras/
  catalogo/
    antecedentes.mjs          ← 16 entradas curadas de Antecedente.md
  unidade/
    antecedentes.test.mjs     ← catálogo × dados/origens/antecedentes.json
testes/e2e/regras/
  antecedentes.spec.mjs       ← o assistente honra as 5 partes
```

`harness.mjs`, `lacunas-conhecidas.mjs` e `excecoes-escolha-repetida.mjs` são
compartilhados — o campo `teste` das lacunas ganha os nomes novos.

## Tarefas

### Tarefa 1 — Catálogo dos 16 antecedentes

Uma entrada por antecedente, curada de `Antecedente.md`, com citação
(`livro: 'Antecedente.md §Nome'`) e só campos verificáveis por máquina:
`atributos` (os três nomeados), `talento` (nome canônico, sem o sufixo "(veja
o capítulo 5)"), `pericias` (as duas), `ferramenta` (específica, ou marcador de
"escolha entre Ferramentas de Artesão"), `equipamento` (o pacote e a
alternativa de 50 PO).

Regra de curadoria herdada: **o livro governa**; um valor que só existe em
`dados/` não entra no catálogo, porque é justamente `dados/` que vamos
confrontar.

### Tarefa 2 — Motor de unidade

`antecedentes.test.mjs`, dirigido pelo catálogo:

1. **Completude** — bijeção catálogo × `dados/`, sem faltantes nem órfãos; toda
   citação aponta para um `## Nome` real em `Antecedente.md`; schema de cada
   entrada.
2. **Conteúdo** — para cada antecedente, os cinco campos de `dados/` batem com
   o livro: os três atributos, o talento, as duas perícias, a ferramenta e a
   escolha de equipamento.
3. **Coerência com o domínio de talentos** — o talento de origem de cada
   antecedente existe no catálogo de talentos e é da categoria `'de Origem'`.
   Este confronto cruzado só é possível porque os dois catálogos vivem na
   mesma suíte, e pega uma classe de erro que nenhum dos dois pega sozinho.

Estender `completude.test.mjs` para cobrir a higiene do catálogo novo, ou
justificar no relatório por que um arquivo próprio é melhor.

### Tarefa 3 — Spec de navegador

`antecedentes.spec.mjs`, dirigido pelo catálogo, cobrindo os 16:

1. Escolher o antecedente no assistente concede **as duas perícias** do livro,
   confirmado no personagem salvo — não no DOM.
2. Concede **a ferramenta**; quando o livro manda escolher entre Ferramentas de
   Artesão, a tela oferece a escolha.
3. Concede **o talento de origem** correto.
4. **Aumento de atributo**: a tela oferece as duas formas (+2/+1 e +1/+1/+1),
   restringe aos três atributos do livro, e o resultado salvo corresponde à
   forma escolhida. O teto de 20 é regra do livro e já tem validação
   (`ficha-edicao-validacoes.js:14`) — confrontar.
5. **Equipamento**: a escolha entre pacote e 50 PO é oferecida e o resultado
   persiste.

Reusar `helpers-regras.mjs`; se a navegação até o passo do antecedente virar um
helper, ele mora lá e é importado — não copiado (lição 7 do guia).

### Tarefa 4 — Fechamento

Registrar as lacunas encontradas com `tipo` e motivo citando evidência;
atualizar `testes/regras/README.md` (tabela de motores, contagens reais,
domínio 2 marcado no mapa) e o guia, se a rodada produzir lição nova.

## Critérios de sucesso

1. Os 16 antecedentes cobertos, sem amostragem, com completude garantida por
   teste.
2. As duas suítes verdes; paridade inalterada (329 coletados) — este projeto
   **não altera `site/`**, só relata.
3. Toda lacuna registrada tem `tipo`, motivo com arquivo:linha e foi
   classificada lendo o app, não presumida.
4. Cada motor provado por mutação: estragar uma expectativa deixa vermelho.
5. Nenhum teste passa sem afirmar nada — sem `return` antecipado que pule
   asserções, sem comparação que um app quebrado satisfaça.

## Desfecho (2026-08-07)

As quatro tarefas foram executadas. Nada em `site/` foi tocado — este projeto
só relata.

- **Tarefa 1** — `testes/regras/catalogo/antecedentes.mjs`: as 16 entradas,
  cada uma citando `Antecedente.md §Nome`. Achado de curadoria: o resumo do
  capítulo cita só "Ferramentas de Artesão" como categoria, mas 5 dos 16
  antecedentes (não 1) escolhem ferramenta por categoria — Artesão
  (Ferramentas de Artesão), Artista (Instrumento Musical), Guarda/Nobre/
  Soldado (Kit de Jogos). O texto de cada antecedente individual governou
  sobre o resumo.
- **Tarefa 2** — `testes/regras/unidade/antecedentes.test.mjs`: 115 testes
  novos (19 de bijeção/schema/citação + 80 de conteúdo, 5 partes × 16
  antecedentes + 16 de coerência cruzada com `catalogo/talentos.mjs`).
  **Zero divergências** — `dados/origens/antecedentes.json` bate com o livro
  nos cinco pontos verificáveis, nos 16 antecedentes. Suíte de unidade:
  399 → **514 testes** (470 passam, 44 skip, 0 falham).
- **Tarefa 3** — `testes/e2e/regras/antecedentes.spec.mjs`: 39 testes,
  cobrindo os 16 antecedentes num fluxo contínuo pelo assistente (passos
  antecedente → atributos → equipamento). **21 lacunas encontradas**, todas
  `app-diverge-do-livro`, por **duas causas raiz**: (1) 16 entradas — a
  ferramenta/instrumento que um antecedente concede nunca vira proficiência
  gravada (`passo-antecedente.js:111` só exibe; `wizard.js:582-597` consolida
  só a partir de `escolhas_talento`, nunca de `escolhas_antecedente`); (2) 5
  entradas — o item do pacote de equipamento "(a mesma/o mesmo que acima)"
  não é resolvido para a escolha real do jogador
  (`passo-equipamento.js` resolve "à sua escolha", não esse texto). Suíte de
  navegador: 72 → **111 testes**, todos verdes.
- **Tarefa 4** (este fechamento) — `testes/regras/README.md`,
  `testes/regras/GUIA-PROXIMOS-DOMINIOS.md`, este plano e o
  `README.md` da raiz atualizados com as contagens reais e os achados.
  Nenhuma lição nova sobre "muitas falhas de uma vez" — a Tarefa 3 nunca viu
  esse padrão (os 21 casos usam `test.fail()` desde a escrita). A lição
  registrada foi outra: o motor de unidade não tem uma função pura do app
  para confrontar neste domínio, então ele confronta `dados/origens/
  antecedentes.json` em vez disso — a forma do motor de unidade é
  dependente do domínio, não um molde a copiar do piloto.

**Números finais, verificados por execução real:**

| Suíte | Antes deste domínio | Depois |
|---|---|---|
| Unidade (`node --test`) | 399 (355 pass, 44 skip) | **514 (470 pass, 44 skip, 0 fail)** |
| Navegador (regras, Playwright) | 72 | **111** |
| Paridade (`testes/e2e/`) | 329 em 10 arquivos | **329 em 10 arquivos** (inalterada) |
| `lacunas-conhecidas.mjs` | 1 entrada | **22 entradas** (1 antiga + 21 novas) |

Relatórios de execução: `.superpowers/sdd/antecedentes/tarefa-{1,2,3,4}-report.md`.

## Correção (2026-08-07, mesmo dia)

As 21 lacunas relatadas acima não ficaram como backlog: um segundo projeto,
no mesmo dia, corrigiu as duas causas raiz no app e fechou as 21 entradas
correspondentes de `lacunas-conhecidas.mjs`. Diferente das quatro tarefas
deste plano (que só relataram), a correção **tocou `site/`**:
`site/js/creator/passo-antecedente.js` (nova função exportada
`_consolidarFerramentaAntecedente()`, chamada na confirmação do popup do
antecedente, para as 16 entradas de ferramenta/instrumento nunca virando
proficiência) e `site/js/creator/passo-equipamento.js` (novo ramo em
`adicionarItensEquipamentoInicial()` que resolve o marcador "(a mesma/o
mesmo que acima)" para a escolha real do jogador, para as 5 entradas do
pacote de equipamento). O desenho completo, incluindo a armadilha de
roteamento por lista de valores que a correção evitou (duas listas do app —
`FERRAMENTAS_TODAS` e `INSTRUMENTOS_MUSICAIS` — cada uma incompleta por um
motivo diferente), está em
`.superpowers/sdd/antecedentes/correcao-report.md`.

**Números finais, reverificados nesta sessão de documentação (execução
real, não copiados de relatório):**

| Suíte | Depois deste plano (achados abertos) | Depois da correção |
|---|---|---|
| Unidade (`node --test`) | 514 (470 pass, 44 skip, 0 fail) | **514 (470 pass, 44 skip, 0 fail)** — inalterada, nenhum motor de unidade toca os arquivos corrigidos |
| Navegador (regras, Playwright) | 111 (18 antecedentes passam de verdade + 21 citando lacuna) | **111**, todos verdes de verdade — nenhum cita lacuna |
| Paridade (`testes/e2e/`) | 329 em 10 arquivos | **329 em 10 arquivos, 328 passando, 1 pulado** — inalterada |
| `lacunas-conhecidas.mjs` | 22 entradas (1 antiga + 21 novas) | **1 entrada** — só `Aumento no Valor de Atributo`/`escolhas` (talentos, `limitacao-observabilidade`, não é bug do app) |

Zero entradas `app-diverge-do-livro` restam na suíte inteira.
