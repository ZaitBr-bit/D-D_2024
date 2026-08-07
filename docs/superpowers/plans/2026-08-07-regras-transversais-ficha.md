# Regras Transversais da Ficha — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Confrontar as fórmulas transversais da ficha (modificador de atributo, bônus de proficiência, PV, CA, CD e ataque de magia, perícias passivas) com as tabelas do livro, cobrindo **todo o domínio de entrada** em vez de amostras.

**Architecture:** Este domínio é qualitativamente diferente dos dois anteriores. Talentos e Antecedentes exigiram curar **prosa** em entidades; aqui o livro traz **tabelas** e fórmulas fechadas, e o app expõe as funções puras correspondentes em `site/js/utils.js`. Logo: o catálogo é uma transcrição de tabelas, e o confronto é uma varredura exaustiva de entradas (todo valor de atributo, todo nível, toda classe) chamando a função real do app. Sem navegador — este domínio não precisa de Playwright.

**Tech Stack:** Node 22 (`node:test`, `node:assert/strict`), ESM puro, zero dependência nova. A suíte existente vive em `testes/regras/`.

## Global Constraints

- Comentários e documentação SEMPRE em Português do Brasil; toda função criada tem comentário explicando o que faz.
- **Nenhum arquivo de `site/` pode ser alterado.** Este projeto relata divergências; a correção é decisão separada.
- Zero dependência npm nova; apenas `node:test` e `node:assert/strict`.
- Nunca fazer commit.
- Comandos rodam com cwd `testes/e2e/`; unidade via `node --test "../regras/unidade/*.test.mjs"` (o glob **entre aspas** é obrigatório — a forma com diretório nu falha com `MODULE_NOT_FOUND` neste Node 22 / Windows).
- Toda lacuna registrada em `testes/regras/lacunas-conhecidas.mjs` precisa de `tipo` (`'app-diverge-do-livro'` ou `'limitacao-observabilidade'`) e `motivo` com evidência arquivo:linha. Motivo em branco é erro.
- **Uma lacuna falsa é pior que uma faltando.** Antes de registrar, procure a implementação em todo `site/js/`.
- Nenhum teste pode passar sem afirmar nada: sem `return` antecipado que pule asserções, sem comparação que um app quebrado satisfaça.

## Pré-voo (executado; é insumo do desenho, não burocracia)

Seguindo o checklist do [guia](../../../testes/regras/GUIA-PROXIMOS-DOMINIOS.md).

**Onde a regra vive no app — resposta da pergunta nova do guia.** Este é o domínio com a maior densidade de função pura de todos: `site/js/utils.js` exporta `calcMod`, `bonusProficiencia`, `calcPVNivel1`, `calcPVTotal`, `calcCA`, `calcCDMagia`, `calcAtaqueMagia`, `calcPercepcaoPassiva`, `calcIntuicaoPassiva`, `calcInvestigacaoPassiva`, `calcBonusPericia`. **Confronta-se a função diretamente** — a forma mais forte das três, porque testa comportamento e não fonte de dados.

**As quatro tabelas do livro, já localizadas:**

| Tabela | Onde | Confronta |
|---|---|---|
| Valores e Modificadores de Atributo | `Criação de Personagens.md:248-263` | `calcMod` |
| Evolução do Personagem (nível → XP → BP) | `Criação de Personagens.md:468-491` | `bonusProficiencia`, e `calcularNivelPorXP` (`levelup.js:315`) |
| Pontos de Vida no Nível 1 por Classe | `Criação de Personagens.md:414-421` | `calcPVNivel1` + `dado_vida` de `CLASSES_INFO` |
| CA base = 10 + mod. Destreza | `Abreviações e Definição de Regras.md:263` e `Criação de Personagens.md:428` | `calcCA` sem armadura |

**Fórmula ainda não localizada:** a CD de salvaguarda de magia (`8 + BP + mod. de conjuração`). O app a implementa em `utils.js:249`. A Tarefa 4 deve **encontrar e citar** o trecho do livro antes de afirmar qualquer coisa; se não existir nos arquivos de `Informacoes Separadas/`, isso é registrado como limite da fonte, não como conformidade presumida.

**Fronteira de escopo — importante.** `calcCA` tem ramos de classe (Bárbaro sem armadura, Monge, Bardo do Colégio da Dança, Feiticeiro Dracônico) e `calcBonusPericia` tem ramos de Bárbaro em fúria e Conhecimento Primordial. **Esses são características de classe e pertencem ao domínio de classes/níveis, não a este.** Aqui cobrimos a regra transversal (a fórmula base e o que vale para qualquer personagem); os ramos de classe ficam anotados para o domínio seguinte, sem teste aqui, e a Tarefa 5 registra essa fronteira por escrito.

**Sobreposição declarada com classes/níveis:** a tabela Evolução do Personagem também contém a coluna de XP, consumida por `XP_POR_NIVEL` em `levelup.js`. A Tarefa 2 a cobre inteira aqui — o domínio de classes/níveis não deve duplicá-la.

## File Structure

```
testes/regras/
  catalogo/
    ficha-transversal.mjs      ← as 4 tabelas do livro, transcritas com citação
  unidade/
    ficha-transversal.test.mjs ← varredura exaustiva chamando as funções do app
```

Um arquivo de catálogo e um motor. Não há spec de navegador neste domínio: as funções são puras e o confronto não passa por tela. `harness.mjs` e `lacunas-conhecidas.mjs` são reusados.

---

### Task 1: Catálogo das tabelas do livro

**Risk:** low - arquivo de dados puro, transcrição de tabelas fechadas; a exatidão é verificada pelo motor da Tarefa 2, e o escopo é um arquivo novo sem consumidores ainda.

**Files:**
- Create: `testes/regras/catalogo/ficha-transversal.mjs`

- [ ] **Step 1: Transcrever as quatro tabelas**

**Interfaces:**
- Produces: `export const MODIFICADORES_ATRIBUTO` (array de `{ valor: number, modificador: number, extrapolado?: boolean }`, um por valor de 1 a 30), `export const EVOLUCAO_PERSONAGEM` (array de `{ nivel, xp, bonusProficiencia }`, 20 entradas), `export const PV_NIVEL_1` (array de `{ classes: string[], base: number }`) e `export const CITACOES` (objeto nome → string de citação).

Exatamente quatro exports, e **todos têm consumidor**: `MODIFICADORES_ATRIBUTO` nas Tarefas 2 e 4, `EVOLUCAO_PERSONAGEM` na 2, `PV_NIVEL_1` na 3, `CITACOES` nas três. Não acrescente campo que nenhum teste leia — o domínio de talentos embarcou 75 entradas de um campo que nada confrontava, e o guia registra isso como apodrecimento silencioso.

Ler `Informacoes Separadas/Criação de Personagens.md` linhas 244–263, 412–421 e 466–491, e `Informacoes Separadas/Abreviações e Definição de Regras.md:259-263`. Transcrever, **não interpretar**.

A tabela de modificadores do livro vai de **3 a 20** e usa faixas (`4–5 → -3`) — 18 valores tabelados. Expandir para um valor por linha.

**Corrigido durante a execução:** o rascunho deste plano dizia "3 a 30"; está errado, e não existe tabela em `Informacoes Separadas/` cobrindo 21–30. Mas o app opera nessa faixa (as Dádivas Épicas levam atributo até 30, `getLimiteASITalento`), então precisamos saber o que ele faz lá. Os 12 valores fora da tabela — 1, 2 e 21 a 30 — entram marcados `extrapolado: true`, com comentário explicando que vêm da fórmula e não do livro. Nunca apresentá-los como valor tabelado.

```js
// ============================================================
// Tabelas transversais da ficha, transcritas do livro.
// Este catálogo é DIFERENTE dos de talentos e antecedentes: não
// há entidades a curar, há tabelas fechadas a transcrever. Por
// isso o motor que o consome faz varredura exaustiva, não
// amostragem — o domínio de entrada é finito e pequeno.
// ============================================================

export const CITACOES = {
  modificadores: 'Criação de Personagens.md §Valores e Modificadores de Atributo',
  evolucao: 'Criação de Personagens.md §Evolução do Personagem',
  pvNivel1: 'Criação de Personagens.md §Pontos de Vida no Nível 1 por Classe',
  caBase: 'Abreviações e Definição de Regras.md §Classe de Armadura',
};

// Valores 3 a 30 vêm da tabela do livro. Os valores 1 e 2 NÃO são
// tabelados lá; entram aqui como extrapolação declarada da fórmula,
// porque o app aceita esses valores e precisamos saber o que ele faz.
export const MODIFICADORES_ATRIBUTO = [
  { valor: 1, modificador: -5, extrapolado: true },
  { valor: 2, modificador: -4, extrapolado: true },
  { valor: 3, modificador: -4 },
  { valor: 4, modificador: -3 },
  { valor: 5, modificador: -3 },
  // ... continuar até 30, um por linha
];

export const EVOLUCAO_PERSONAGEM = [
  { nivel: 1, xp: 0, bonusProficiencia: 2 },
  { nivel: 2, xp: 300, bonusProficiencia: 2 },
  // ... até o nível 20 (xp 355000, BP 6)
];

export const PV_NIVEL_1 = [
  { classes: ['Bárbaro'], base: 12 },
  { classes: ['Guardião', 'Guerreiro', 'Paladino'], base: 10 },
  { classes: ['Bardo', 'Bruxo', 'Clérigo', 'Druida', 'Ladino', 'Monge'], base: 8 },
  { classes: ['Feiticeiro', 'Mago'], base: 6 },
];
```

- [ ] **Step 2: Validar por script que a transcrição está completa**

Run:
```
cd testes/e2e && node -e "import('../regras/catalogo/ficha-transversal.mjs').then(m => { console.log('mods:', m.MODIFICADORES_ATRIBUTO.length, 'niveis:', m.EVOLUCAO_PERSONAGEM.length, 'faixas PV:', m.PV_NIVEL_1.length, 'classes PV:', m.PV_NIVEL_1.flatMap(f => f.classes).length); })"
```
Expected: `mods: 30 niveis: 20 faixas PV: 4 classes PV: 12` — as 12 classes do jogo, sem faltar nem repetir.

- [ ] **Step 3: Conferir a transcrição contra o livro, linha a linha**

Reler `Criação de Personagens.md:250-263` e conferir cada par valor→modificador; reler `:470-491` e conferir cada tripla nível→XP→BP. Um erro aqui vira expectativa errada permanente — é o mesmo risco que fez o domínio de talentos ser revisado entrada por entrada.

---

### Task 2: Motor — modificador de atributo e bônus de proficiência

**Risk:** medium - primeiro código executável do domínio; importa módulos do app em Node e estabelece o padrão de varredura que as tarefas seguintes reusam.

**Files:**
- Create: `testes/regras/unidade/ficha-transversal.test.mjs`
- Modify: `testes/regras/unidade/harness.mjs` (acrescentar `utils`, `levelup` e `dadosClasses` a `modulosApp()`)

- [ ] **Step 1: Escrever a varredura exaustiva das duas tabelas**

**Interfaces:**
- Consumes: de `./harness.mjs` — `modulosApp()` → `{ regras, efeitos, store }` (async, instala os stubs de `localStorage`, `window` e `document`; sem eles o import lança `ReferenceError`, porque `site/js/utils.js:609` atribui a `window` no top-level). De `../catalogo/ficha-transversal.mjs` — `MODIFICADORES_ATRIBUTO`, `EVOLUCAO_PERSONAGEM`, `CITACOES`.
- Produces: nada; é um arquivo de teste.

`modulosApp()` devolve hoje `{ regras, efeitos, store }`. Este domínio precisa de **três módulos novos**, e é esta tarefa que os acrescenta de uma vez, para as Tarefas 3 e 4 já os encontrarem prontos:

| Chave nova | Módulo | Usado em |
|---|---|---|
| `utils` | `site/js/utils.js` | Tarefas 2, 3 e 4 |
| `levelup` | `site/js/levelup.js` | Tarefa 2 (Step 3) |
| `dadosClasses` | `site/js/dados-classes.js` | Tarefas 3 e 4 |

Acrescente os três em `modulosApp()` — é o lugar declarado para isso, e `harness.mjs:19` diz que os stubs de globais vivem "AQUI e só aqui". Não importe por caminho relativo dentro do teste: isso funciona por acidente (só porque outra linha já instalou os stubs antes) e foi um achado de revisão do domínio anterior.

```js
// ============================================================
// Confronto das fórmulas transversais da ficha com as tabelas do
// livro. Diferente dos outros motores, aqui NÃO há amostragem: o
// domínio de entrada é finito (30 valores de atributo, 20 níveis,
// 12 classes) e é varrido inteiro.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { MODIFICADORES_ATRIBUTO, EVOLUCAO_PERSONAGEM, CITACOES } from '../catalogo/ficha-transversal.mjs';
import { modulosApp } from './harness.mjs';

const { utils } = await modulosApp();

test('calcMod bate com a tabela do livro em TODO valor de 1 a 30', () => {
  for (const { valor, modificador, extrapolado } of MODIFICADORES_ATRIBUTO) {
    assert.equal(utils.calcMod(valor), modificador,
      `valor ${valor}: livro (${CITACOES.modificadores}) diz ${modificador}` +
      (extrapolado ? ' [extrapolado da fórmula, não tabelado]' : ''));
  }
});

test('bonusProficiencia bate com a tabela Evolução do Personagem nos 20 níveis', () => {
  for (const { nivel, bonusProficiencia } of EVOLUCAO_PERSONAGEM) {
    assert.equal(utils.bonusProficiencia(nivel), bonusProficiencia,
      `nível ${nivel}: livro (${CITACOES.evolucao}) diz +${bonusProficiencia}`);
  }
});
```

- [ ] **Step 2: Rodar e classificar cada falha**

Run: `cd testes/e2e && node --test "../regras/unidade/ficha-transversal.test.mjs"`

Cada falha é uma de duas coisas, e distinguir é o trabalho: **lacuna** (a função do app não segue a tabela — registrar com `tipo: 'app-diverge-do-livro'` e motivo citando o valor esperado e o obtido) ou **erro de transcrição** (corrigir o catálogo). Nunca afrouxar a asserção.

- [ ] **Step 3: Confrontar a coluna de XP contra `XP_POR_NIVEL`**

`levelup.js` exporta `calcularNivelPorXP(xp)` (linha 315) e mantém a tabela `XP_POR_NIVEL`. A coluna de XP do livro é a mesma tabela. Acrescentar:

```js
test('calcularNivelPorXP bate com a coluna de XP do livro', async () => {
  const { levelup } = await modulosApp();
  for (const { nivel, xp } of EVOLUCAO_PERSONAGEM) {
    assert.equal(levelup.calcularNivelPorXP(xp), nivel,
      `XP ${xp}: livro (${CITACOES.evolucao}) diz nível ${nivel}`);
  }
});
```

Isto exige acrescentar `levelup.js` a `modulosApp()` também. Declarar no relatório que esta tabela fica coberta AQUI e não deve ser duplicada no domínio de classes/níveis.

- [ ] **Step 4: Provar que o motor consegue falhar**

Estragar um valor do catálogo (por exemplo, trocar o modificador do valor 14 de `+2` para `+9`), rodar, confirmar que o teste correspondente fica vermelho com mensagem clara, e restaurar. Colar as duas saídas. `git diff testes/regras/catalogo/` deve ficar vazio ao final.

---

### Task 3: Motor — Pontos de Vida

**Risk:** medium - depende de cruzar duas fontes (tabela do livro e `CLASSES_INFO`), e a fórmula de níveis subsequentes precisa ser localizada no livro antes de ser afirmada.

**Files:**
- Modify: `testes/regras/unidade/ficha-transversal.test.mjs`

**Interfaces:**
- Consumes: de `./harness.mjs` — `modulosApp()` já devolvendo `utils`, `levelup` e `dadosClasses`, acrescentados na Tarefa 2. De `../catalogo/ficha-transversal.mjs` — `PV_NIVEL_1` e `CITACOES`.

- [ ] **Step 1: Confrontar o PV de nível 1 nas 12 classes**

`CLASSES_INFO` em `site/js/dados-classes.js` traz `dado_vida` por classe (Bárbaro 12, e assim por diante). O livro diz que o PV máximo no nível 1 é **o valor da tabela + mod. de Constituição**, e esse valor é o próprio dado de vida.

```js
test('PV de nível 1 bate com a tabela do livro nas 12 classes', async () => {
  const { utils, dadosClasses } = await modulosApp();
  for (const faixa of PV_NIVEL_1) {
    for (const classe of faixa.classes) {
      const info = dadosClasses.CLASSES_INFO[classe];
      assert.ok(info, `classe ${classe} não existe em CLASSES_INFO`);
      assert.equal(info.dado_vida, faixa.base,
        `${classe}: livro (${CITACOES.pvNivel1}) diz ${faixa.base}`);
      // Varre modificadores de Constituição de -5 a +10
      for (let modCon = -5; modCon <= 10; modCon++) {
        assert.equal(utils.calcPVNivel1(info.dado_vida, modCon), faixa.base + modCon,
          `${classe} com mod CON ${modCon}`);
      }
    }
  }
});
```

- [ ] **Step 2: Localizar no livro a regra de PV dos níveis seguintes**

`calcPVTotal` (`utils.js:29-35`) usa `floor(dadoVida / 2) + 1` como média por nível. Antes de afirmar que isso é o livro, **encontre o trecho** que define o ganho de PV ao subir de nível — procure em `Informacoes Separadas/Criação de Personagens.md` e no livro principal por "Pontos de Vida" junto de "subir de nível" ou "aumentam".

Se encontrar: confrontar `calcPVTotal` contra a regra, varrendo as 12 classes × níveis 1 a 20 × modificadores de Constituição de -5 a +10, e citar o trecho.

Se **não** encontrar em `Informacoes Separadas/`: não invente conformidade. Registre no relatório que a fonte disponível não cobre a regra, e cubra apenas o que ela cobre (nível 1). Um teste que afirma o que a fonte não diz é pior que teste nenhum.

- [ ] **Step 3: Rodar, classificar, provar por mutação**

Run: `cd testes/e2e && node --test "../regras/unidade/ficha-transversal.test.mjs"`
Mesma disciplina da Tarefa 2: lacuna vs. erro de catálogo, com evidência; depois estragar um valor de `PV_NIVEL_1`, confirmar vermelho, restaurar.

---

### Task 4: Motor — CA base, CD e ataque de magia, perícias passivas

**Risk:** medium - `calcCA` e `calcBonusPericia` misturam a regra transversal com ramos de classe, e manter a fronteira é o trabalho principal desta tarefa.

**Files:**
- Modify: `testes/regras/unidade/ficha-transversal.test.mjs`

**Interfaces:**
- Consumes: de `./harness.mjs` — `modulosApp()` devolvendo `utils`, `store` e `dadosClasses`. De `../catalogo/ficha-transversal.mjs` — `MODIFICADORES_ATRIBUTO` e `CITACOES`.

- [ ] **Step 1: CA base, sem armadura e sem ramo de classe**

O livro (`Abreviações e Definição de Regras.md:263`) diz: "Sua CA base é calculada como 10 mais o seu modificador de Destreza."

Montar o personagem com `store.criarPersonagemVazio()` e uma classe **sem** ramo de CA especial — `calcCA` tem ramos para Bárbaro, Monge, Bardo do Colégio da Dança e Feiticeiro Dracônico, e nenhum deles é a regra transversal. Use uma classe sem ramo (por exemplo Guerreiro), inventário vazio, e varra a Destreza de 1 a 30:

```js
test('CA base sem armadura é 10 + mod. Destreza, para toda Destreza de 1 a 30', async () => {
  const { utils, store } = await modulosApp();
  for (const { valor, modificador } of MODIFICADORES_ATRIBUTO) {
    const p = store.criarPersonagemVazio();
    p.classe = 'Guerreiro';   // sem ramo de CA de classe
    p.nivel = 1;
    p.inventario = [];
    p.atributos.destreza = valor;
    assert.equal(utils.calcCA(p), 10 + modificador,
      `Destreza ${valor}: livro (${CITACOES.caBase}) diz ${10 + modificador}`);
  }
});
```

Anotar em comentário, no próprio arquivo, que os ramos de classe ficam para o domínio de classes/níveis — para o próximo leitor não achar que foram esquecidos.

- [ ] **Step 2: CD e ataque de magia — achar a citação antes de afirmar**

O app implementa `CD = 8 + BP + mod. de conjuração` (`utils.js:249`) e `ataque = BP + mod.` (`utils.js:265`). **Procure a fórmula no livro** (`Informacoes Separadas/`, provavelmente no capítulo de conjuração) e cite. Só então escreva a varredura: para cada classe conjuradora de `CLASSES_INFO` (as que têm `atributo_conjuracao`), varrer níveis 1 a 20 × valores do atributo de conjuração.

Se a fórmula não estiver nos arquivos disponíveis, registre isso e **não** escreva o teste — a mesma regra do Step 2 da Tarefa 3.

- [ ] **Step 3: Percepção passiva**

O livro (`Abreviações e Definição de Regras.md:766`) define: "A Percepção Passiva de uma criatura é igual a 10 mais o bônus do teste de Sabedoria (Percepção) da criatura."

Varrer as quatro combinações que a regra transversal cobre — sem proficiência, com proficiência, com Especialização — em vários níveis, usando uma classe sem ramo especial. `calcPercepcaoPassiva` tem um ramo de Bardo (`utils.js:277`); ele é característica de classe e fica fora, anotado.

- [ ] **Step 4: Rodar tudo, classificar, provar por mutação**

Run: `cd testes/e2e && node --test "../regras/unidade/*.test.mjs"`
Expected: toda a suíte verde. Reportar o total novo (era 514: 470 passando, 44 pulados).

Provar falsificabilidade uma vez por bloco novo: estragar a fórmula esperada da CA, confirmar vermelho, restaurar.

---

### Task 5: Fechamento

**Risk:** low - documentação; nenhum código executável muda e a exatidão é verificável relendo os arquivos.

**Files:**
- Modify: `testes/regras/README.md`
- Modify: `testes/regras/GUIA-PROXIMOS-DOMINIOS.md`
- Modify: `docs/superpowers/plans/2026-08-07-regras-transversais-ficha.md`
- Modify: `README.md` (raiz), se alguma contagem ficar desatualizada

- [ ] **Step 1: Atualizar o README da suíte**

Acrescentar o motor novo à tabela com a contagem real; marcar este domínio como feito no mapa e **registrar a mudança de ordem**: ele foi feito antes de espécies porque é o de maior densidade de função pura, medida no pré-voo, e não precisa de navegador.

Escrever a seção de achados no presente (são divergências abertas — este projeto não corrige) ou registrar explicitamente que não houve nenhuma, se for o caso. Registrar também **a fronteira de escopo**: quais ramos de `calcCA`, `calcBonusPericia` e `calcPercepcaoPassiva` ficaram para o domínio de classes/níveis, e que a tabela Evolução do Personagem já está coberta aqui.

- [ ] **Step 2: Atualizar o guia, se a rodada produziu lição**

Candidato forte, a julgar pelos relatórios e não por presunção: quando o livro traz **tabela** em vez de prosa, o catálogo vira transcrição e o confronto vira varredura exaustiva — não há motivo para amostrar um domínio de entrada finito. Só acrescentar se a execução confirmar que isso mudou o desenho de verdade.

- [ ] **Step 3: Registrar o desfecho no plano e conferir a árvore**

Run: `cd "c:/ControleVersaoGit/Pessoal/DeD_2024" && git status --short && git diff --stat site/`
Expected: nenhum arquivo de `site/` alterado; mudanças só em `testes/regras/`, `docs/superpowers/` e, se necessário, no `README.md` da raiz.

---

## Critérios de sucesso

1. As quatro tabelas do livro transcritas e confrontadas **por varredura exaustiva** — todo valor de atributo de 1 a 30, todos os 20 níveis, todas as 12 classes. Sem amostragem.
2. Suíte de unidade verde; a suíte de navegador segue em 111, intocada; a paridade segue em 329 coletados.
3. Cada bloco novo provado por mutação: estragar a expectativa deixa vermelho, restaurar volta ao verde.
4. Toda lacuna tem `tipo`, motivo com evidência, e foi classificada lendo o app.
5. Onde a fonte disponível não define a regra (PV de níveis seguintes, CD de magia), isso está **escrito** — nunca substituído por conformidade presumida.
6. A fronteira com o domínio de classes/níveis está registrada por escrito, com os ramos nomeados.

---

## Desfecho (2026-08-07)

As cinco tarefas foram executadas; relatórios completos, incluindo as rodadas
de correção de revisão, em
`.superpowers/sdd/2026-08-07-regras-transversais-ficha/task-{1,2,3,4}-report.md`.

**O que foi feito.** Um catálogo (`testes/regras/catalogo/ficha-transversal.mjs`,
cinco exports: `MODIFICADORES_ATRIBUTO`, `EVOLUCAO_PERSONAGEM`, `PV_NIVEL_1`,
`PV_NIVEL_SEGUINTE`, `CITACOES` — um a mais que os quatro planejados
originalmente na Tarefa 1, porque a Tarefa 3 achou a tabela "Pontos de Vida
Fixos por Classe" do livro e o coordenador decidiu que uma tabela com
consumidor pertence ao catálogo, não a uma constante local do teste) e um
motor (`testes/regras/unidade/ficha-transversal.test.mjs`, 10 testes) que
varrem por exaustão: 30 valores de modificador de atributo, 20 níveis de
Bônus de Proficiência (mais a coluna de XP contra `calcularNivelPorXP`, com
cobertura de interior de faixa e bordas), PV de nível 1 e dos níveis
seguintes nas 12 classes × modificador de Constituição -5..+10 (e também ×
níveis 1-20 para os níveis seguintes), CA base sem armadura nos 30 valores de
Destreza, CD e ataque de magia nas 8 classes conjuradoras × 20 níveis × 30
valores de atributo, e Percepção Passiva nos três estados reais de
proficiência × 30 valores de Sabedoria × 20 níveis.

**Números finais** (medidos, não recalculados de memória): suíte de unidade
em **524 testes — 480 passam, 44 skip, 0 falham** (era 514/470/44/0 antes
deste domínio). Suíte de navegador de regras em **111**, intocada — este
domínio não tem spec Playwright, por desenho (nenhuma das funções confrontadas
precisa de tela). Paridade em **329 coletados**, intocada.
`lacunas-conhecidas.mjs` termina com **1** entrada, a mesma que já existia
antes deste domínio (`Aumento no Valor de Atributo`/`escolhas`,
`limitacao-observabilidade`, do domínio de talentos) — **zero** divergências
novas encontradas. Nenhum arquivo de `site/` foi alterado.

**As duas alegações do pré-voo que se mostraram erradas.** O pré-voo (acima,
seção "Pré-voo") declarou:

1. "A tabela de modificadores do livro vai de 3 a 30" — errada. A Tarefa 1
   releu `Criação de Personagens.md:250-261` e confirmou que a tabela impressa
   termina em 20; não existe linha 21-30 em nenhum arquivo de `Informacoes
   Separadas/`. Os valores 21-30 (e também 1-2, já previstos como
   extrapolação pela Ambiguidade #2 do próprio pré-voo) entraram no catálogo
   marcados `extrapolado: true`, com o número vindo da fórmula do app, não de
   uma linha do livro.
2. "Fórmula ainda não localizada: a CD de salvaguarda de magia" — errada. A
   Tarefa 4 encontrou "CD para evitar magia = 8 + modificador de atributo de
   conjuração + Bônus de Proficiência" em dois lugares idênticos
   (`Criação de Personagens.md:441` e `Magias.md:183`), depois de quatro
   rodadas de busca com termos supostos a priori que não bateram com o
   vocabulário real do livro. Na mesma investigação, a Tarefa 3 também achou a
   regra de PV dos níveis seguintes (`Criação de Personagens.md:497-510`),
   que o pré-voo tinha deixado como pergunta em aberto sem declará-la ausente
   — mas que também exigiu busca real (não estava na primeira leitura
   dirigida) antes de ser confirmada.

As duas fórmulas existem no livro; o pré-voo não as tinha achado por buscar
com o vocabulário errado no arquivo errado, não porque o livro fosse omisso.
Ver a lição correspondente em
[`GUIA-PROXIMOS-DOMINIOS.md`](../../../testes/regras/GUIA-PROXIMOS-DOMINIOS.md)
("busca honesta antes de concluir ausência").

**Documentação fechada nesta rodada** (Tarefa 5): `testes/regras/README.md`
(motor novo na tabela, total atualizado, seção de achados, fronteira de
escopo, reordenação do mapa de domínios), `testes/regras/GUIA-PROXIMOS-DOMINIOS.md`
(duas lições novas) e o `README.md` da raiz (contagens de motores e de testes
de unidade corrigidas).
