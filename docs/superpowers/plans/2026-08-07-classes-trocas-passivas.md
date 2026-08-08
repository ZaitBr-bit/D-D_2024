# Classes: trocas e passivas das 12 classes base — plano

> **Para agentes:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development
> para implementar tarefa a tarefa. Passos usam checkbox (`- [ ]`).

**Goal:** Confrontar os direitos de troca e as habilidades passivas das 12
classes base com o livro; depois corrigir **todas** as lacunas de classes ainda
abertas.

**Architecture:** Fase 1 (Tasks 1-6) estende a suíte `testes/regras/` com dois
catálogos e dois motores novos, no mesmo padrão do domínio classes/níveis. Fase
2 (Tasks 7-8) corrige o app, com a suíte cobrando cada correção pela mecânica de
`comLacuna`.

**Tech Stack:** `node:test` + `node:assert/strict`, ES modules, zero
dependências. Roda de `testes/e2e/` com `npm run test:regras:unidade`.

**Spec:** [2026-08-07-classes-trocas-passivas-design.md](../specs/2026-08-07-classes-trocas-passivas-design.md)

## Global Constraints

- **Comentários em código SEMPRE em Português do Brasil.** Toda função nova leva
  comentário explicando o que faz.
- **Não commitar, não `git add`, não criar branch/worktree.**
- **Fase 1 (Tasks 1-6): nenhuma alteração em `site/js/` nem em `dados/`.**
  Fase 2 (Tasks 7-8) altera `site/js/` — e só ela.
- **Catálogo transcrito do LIVRO**, nunca gerado de `dados/` nem de `site/js/`.
- **Valor esperado nunca vem da função sob teste** nem de helper que ela chame
  por dentro.
- Nenhum `return` antecipado que faça um caso passar sem afirmar nada; nenhum
  `assert.ok(x >= 0)`; nenhuma comparação por `substring` em blob serializado.
- **Varredura exaustiva**, nunca amostragem.
- **Limite de cobertura é declarado por escrito**, nunca implícito.
- Baseline no início: **1031 testes, 987 pass, 0 fail, 44 skip**; e2e de regras
  111/111; paridade **329 testes em 10 arquivos**.
- As 12 classes: `Bárbaro`, `Bardo`, `Bruxo`, `Clérigo`, `Druida`, `Feiticeiro`,
  `Guardião`, `Guerreiro`, `Ladino`, `Mago`, `Monge`, `Paladino`.
- **Subclasses estão fora de escopo** em todas as tarefas.

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `testes/regras/catalogo/classes-trocas.mjs` (novo) | Os ~15 direitos de troca de classe base, transcritos do livro |
| `testes/regras/catalogo/classes-passivas.mjs` (novo) | Classificação Ativa/Passiva e efeitos numéricos das características de classe base |
| `testes/regras/unidade/classes-trocas.test.mjs` (novo) | Motor de trocas |
| `testes/regras/unidade/classes-passivas.test.mjs` (novo) | Motor de passivas |
| `testes/regras/lacunas-conhecidas.mjs` (alterado) | Chaves e entradas novas |
| `testes/regras/README.md`, `GUIA-PROXIMOS-DOMINIOS.md` (alterados) | Documentação |
| `site/js/*` (alterado **só na fase 2**) | As correções |

---

# FASE 1 — REPORTAR

### Task 1: Catálogo dos direitos de troca

**Risk:** medium — transcrição do livro; erro aqui vira lacuna falsa.

**Files:** Create `testes/regras/catalogo/classes-trocas.mjs`

**Interfaces:** Produces `TROCAS: Array<{classe, oQueTroca, quando, livro, campoApp, observavelEmUnidade, motivoSeNaoObservavel}>`.

- [ ] **Step 1: Levantar as cláusulas no livro**

Rode, a partir da raiz:
`grep -n "pode substituir" "Informacoes Separadas/Classes.md"`

Classifique cada ocorrência em três baldes e registre a classificação no
relatório:
- **de classe base, sobre estado do personagem** → entra no catálogo;
- **de subclasse** → fora de escopo desta rodada (a rodada de subclasses pega);
- **de combate** ("substituir um dos ataques por…") → fora de escopo, porque o
  app não modela turno.

Linhas já identificadas no pré-voo, para conferir e não para copiar sem ler:
Bardo 418/430, Bruxo 884/894/908/940, Clérigo 1544, Druida 2030/2076,
Feiticeiro 2637/2649/2694, Guardião 3290/3312, **Guerreiro 3812**, Mago
4592/4646/4652, Paladino 5511. Abra cada uma.

- [ ] **Step 2: Escrever o catálogo**

```js
// ============================================================
// Direitos de troca das 12 classes base, transcritos do livro.
// Cada entrada é uma frase do livro que concede ao jogador o direito
// de SUBSTITUIR uma escolha anterior — categoria que a suíte nunca
// tinha olhado, e onde mora o bug do Estilo de Luta do Guerreiro.
//
// Transcrito de `Informacoes Separadas/Classes.md`. Nada aqui veio de
// `dados/` nem de `site/js/`.
// ============================================================

// `observavelEmUnidade: false` NÃO é escape: é o registro de que o app
// aplica essa troca por um caminho que o motor de unidade não enxerga
// (mutação direta de `char` em levelup-ui.js:1347-1366, ANTES da chamada
// a subirDeNivel, então `opcoes` nunca a vê). Uma asserção ali seria cega
// por construção, e a lacuna que ela produzisse seria falsa.
export const TROCAS = [
  {
    classe: 'Guerreiro',
    oQueTroca: 'Estilo de Luta',
    quando: 'ao atingir um nível de Guerreiro',
    livro: 'Classes.md:3812',
    campoApp: 'escolhas_classe.estilo_luta',
    observavelEmUnidade: true,
    motivoSeNaoObservavel: null,
  },
  // ... uma entrada por cláusula de classe base
];
```

- [ ] **Step 3: Conferir forma e volume**

`node -e "import('./testes/regras/catalogo/classes-trocas.mjs').then(m=>{const t=m.TROCAS;console.log('entradas:',t.length);console.log('observaveis:',t.filter(x=>x.observavelEmUnidade).length);console.log('sem motivo escrito:',t.filter(x=>!x.observavelEmUnidade&&!x.motivoSeNaoObservavel).map(x=>x.classe+'/'+x.oQueTroca));})"`

Expected: `sem motivo escrito: []` — toda entrada não observável precisa do
motivo por escrito.

---

### Task 2: Motor de trocas

**Risk:** medium — é onde a lacuna do Guerreiro nasce.

**Files:** Create `testes/regras/unidade/classes-trocas.test.mjs`

**Interfaces:** Consumes `TROCAS` (Task 1), `escadaDeNivel`/`modulosApp` (harness).

- [ ] **Step 1: Asserção de existência de mecanismo**

Para cada entrada com `observavelEmUnidade: true`, afirme que o app tem
**algum** mecanismo de troca para aquele campo. O padrão de referência, e o
único que existe hoje, é o da manobra: `opcoes.manobra_trocar_de`/
`manobra_trocar_para`, consumido em `site/js/levelup.js:1556-1562`.

Confronte por varredura do código-fonte, como o teste de chave sem consumidor
já faz em `completude.test.mjs`: leia `site/js/levelup.js` e
`site/js/levelup-validations.js` do disco e procure um par de opções de troca
para o campo. Comente que a varredura textual é deliberada — o mecanismo é
declarativo por convenção de nome, e não há registro central para consultar.

- [ ] **Step 2: Asserção comportamental, via `escadaDeNivel`**

Para o Guerreiro, suba 1→20 e afirme que **alguma pendência de troca de Estilo
de Luta é oferecida em algum nível ≥ 2**. Hoje isso falha: nenhuma pendência de
`estilo_luta` dispara para o Guerreiro em nenhum nível (verificado no pré-voo,
`escolhas_classe.estilo_luta` fica `null` nos 20 níveis).

Envolva a asserção em `comLacuna('Guerreiro', '<chave nova>', ...)` só depois de
a Task 6 registrar a lacuna — nesta tarefa, deixe vermelha e reporte.

- [ ] **Step 3: Declarar os não observáveis**

Um teste que afirme que toda entrada com `observavelEmUnidade: false` tem
`motivoSeNaoObservavel` preenchido. Isso é o que impede a lista de virar escape
silencioso.

- [ ] **Step 4: Rodar e classificar**

`npm run test:regras:unidade` de `testes/e2e/`. Falhas novas: investigue,
classifique, reporte com arquivo e linha dos dois lados. Não afrouxe.

---

### Task 3: Catálogo de passivas

**Risk:** medium — volume de transcrição.

**Files:** Create `testes/regras/catalogo/classes-passivas.mjs`

**Interfaces:** Produces `CLASSIFICACAO: Record<classe, Array<{nivel, nome, ativa, livro, motivo}>>` e `EFEITOS_NUMERICOS: Array<{classe, caracteristica, efeito, livro}>`.

- [ ] **Step 1: Transcrever a classificação**

Para cada uma das 12 classes, para cada característica de **classe base** em
`dados/classes/<classe>.json` → `caracteristicas` (é a lista que o app exibe),
leia a seção correspondente do livro e classifique: **ativa** (o livro diz que
custa Ação, Ação Bônus, Reação, ou tem recarga por descanso) ou **passiva**
(vale continuamente).

`motivo` é a frase curta do livro que justifica a classificação — é ela que
torna a alegação auditável. `livro` cita `Classes.md:<linha>`.

**Não leia `site/js/utils.js:469-481` antes de classificar.** Essa é a função
que a Task 4 vai confrontar; classificar olhando para ela produziria um teste
que compara o app consigo mesmo.

- [ ] **Step 2: Transcrever os efeitos numéricos**

Só as características de classe base cujo livro atribui um **número** ao
personagem. O pré-voo levantou estes; confirme cada um no livro antes de
transcrever, e acrescente os que faltarem:

Defesa sem Armadura (Bárbaro e Monge), Estilo de Luta (Defensivo, Arquearia,
Duelismo, Combate com Armas de Arremesso, Combate Desarmado, Combate com Armas
Grandes, Combate com Duas Armas), Movimento Rápido (Bárbaro), Véu da Natureza
(Guardião), Movimento sem Armadura (Monge), Ataque Extra, Instinto Selvagem
(Bárbaro), Feitiçaria Inata (Feiticeiro), Pau pra Toda Obra (Bardo), Ordem
Divina Taumaturgo (Clérigo), Ordem Primal Xamã (Druida).

- [ ] **Step 3: Conferir cobertura**

Um script que confirme que `CLASSIFICACAO` cobre **exatamente** as
características de classe base de `dados/classes/*.json`, sem faltantes nem
órfãos. Cole a saída no relatório.

---

### Task 4: Motor de passivas — classificação Ativa/Passiva

**Risk:** medium — primeira confrontação de `ehHabilidadeAtiva`.

**Files:** Create `testes/regras/unidade/classes-passivas.test.mjs`

- [ ] **Step 1: Varredura exaustiva**

Para cada característica de classe base das 12 classes, confronte
`utils.ehHabilidadeAtiva(descricao, nome)` contra `ativa` do catálogo. A
descrição vem de `dados/classes/<classe>.json`; o esperado vem do catálogo (o
livro).

- [ ] **Step 2: Rodar e classificar com cuidado**

`ehHabilidadeAtiva` é heurística de substring. É esperado que ela erre em alguns
casos. **Mas nem todo erro é bug do app**: se o livro descreve algo como
"você pode usar" sem custo de ação, a heurística marca ativa e o livro diz
passiva — isso é divergência real de exibição. Já uma característica que o livro
descreve como Ação e a heurística marca passiva é divergência mais séria.

Classifique cada falha por gravidade e reporte. Se mais de uns poucos casos
falharem juntos, suspeite primeiro da sua transcrição.

---

### Task 5: Motor de passivas — números, flags mortas e vocabulário

**Risk:** medium.

**Files:** Modify `testes/regras/unidade/classes-passivas.test.mjs`

- [ ] **Step 1: Efeitos numéricos × livro**

Para cada entrada de `EFEITOS_NUMERICOS`, confronte a função do app contra o
valor do livro, por varredura do domínio de entrada (não amostragem). As
funções envolvidas e onde estão: `calcCA` (`utils.js:157-215`),
`getDeslocamentoFinal` (`combate.js:139-152`), `getAtaquesPorAcao`
(`combate.js:238-251`), `getModIniciativa` (`combate.js:253-260`), `calcCDMagia`
(`utils.js:251-254`), `calcBonusPericia` (`utils.js:309-331`),
`resolverPassivosTalentos` (`talentos-effects.js`).

- [ ] **Step 2: Flag declarada sem consumidor**

Teste que lê `site/js/talentos-effects.js` do disco, extrai os nomes gravados em
`passivos.flags.<nome>`, e afirma que cada um é lido em algum lugar de
`site/js/`. Hoje falham `estilo_armas_grandes` e `estilo_duas_armas`.

Mesma coisa para `personagem.extras_classe`: escrito em
`passo-classe.js:227`/`:234`, lido em lugar nenhum.

Comente que este teste afirma um fato sobre o CÓDIGO, não sobre o livro — e que
ele só vale como lacuna quando o livro descreve um efeito real para a flag, o
que é o caso das duas.

- [ ] **Step 3: Vocabulário único de Estilo de Luta**

Os nomes canônicos vêm de `dados/talentos/talentos.json`, categoria
"de Estilo de Luta" (que já bate com `Talentos.md`): Arquearia, Combate com
Armas de Arremesso, Combate com Armas Grandes, Combate com Duas Armas, Combate
Desarmado, Defensivo, Duelismo, Interceptação, Luta às Cegas, Protetivo.

Afirme que **todo nome oferecido ao jogador** por `CLASSES_ESCOLHAS` (o seletor
em `comum.js`) tem efeito descrito na ficha. Hoje 5 dos 10 não têm: `Duas
Armas`, `Desarmado`, `Interceptação`, `Luta às Cegas`, `Protetivo` — o mapa
`efeitosEstilo` (`habilidades.js:4622-4634`) está indexado por outro
vocabulário.

- [ ] **Step 4: Rodar, classificar, e teste de mutação**

Estrague um valor esperado por bloco e confirme vermelho; restaure.

---

### Task 6: Lacunas e documentação da fase 1

**Risk:** medium — as alegações viram públicas.

**Files:** Modify `lacunas-conhecidas.mjs`, `README.md`, `GUIA-PROXIMOS-DOMINIOS.md`

- [ ] **Step 1: Chaves e entradas**

Uma chave por motor novo em `TESTES_VALIDOS`. **Só declare chave que tenha call
site na mesma rodada** — existe um teste em `completude.test.mjs` que cobra isso.

Cada `motivo` diz o que o app faz e o que não faz, com arquivo e linha dos dois
lados, e a **consequência medida no código, não suposta**.

- [ ] **Step 2: Envolver as asserções divergentes em `comLacuna`**

Estreite o wrap para a asserção divergente, nunca o corpo inteiro — o erro que a
revisão final da rodada anterior pegou.

- [ ] **Step 3: Portas e documentação**

`npm run test:regras:unidade` (0 falhas), `npm run test:regras:e2e` (111/111),
`npx playwright test --list` (329 em 10 arquivos). README com os motores novos,
os totais, e o **limite declarado** da troca de magia/truque.

---

# FASE 2 — CORRIGIR

Só começa depois da Task 6. Agora `site/js/` pode mudar.

### Task 7: Vocabulário único de Estilo de Luta, flags mortas e truque extra

**Risk:** high — mexe em código que a ficha inteira consome.

**Files:** Modify `site/js/creator/comum.js`, `site/js/sheet/habilidades.js`, `site/js/talentos-effects.js`, e onde a leitura das flags for necessária.

- [ ] **Step 1: Um vocabulário só**

Hoje são três: o seletor (`comum.js:311-321`), o mapa de exibição
(`habilidades.js:4622-4634`) e o normalizador (`talentos-effects.js:19-26`).

Faça o seletor oferecer os **nomes canônicos** de `dados/talentos/talentos.json`
(categoria "de Estilo de Luta"). Com isso o normalizador `mapaEstilos` deixa de
ser necessário para escolhas novas — **mas não o apague**: personagens já salvos
têm os nomes antigos gravados em `escolhas_classe.estilo_luta`. Deixe-o como
camada de compatibilidade, com comentário dizendo exatamente isso.

Reindexe o mapa de exibição pelos nomes canônicos, cobrindo os 10.

- [ ] **Step 2: Consumir as flags mortas**

`estilo_armas_grandes` (re-rolar 1 ou 2 no dano de armas de duas mãos) e
`estilo_duas_armas` (somar o modificador ao dano da mão secundária) precisam de
consumidor. Implemente o efeito onde o dano é montado —
`site/js/sheet/inventario.js` é onde `bonusDanoUmaMao`/`bonusDanoArremesso` já
são consumidos (linhas ~168, ~192-193). Siga esse padrão.

- [ ] **Step 3: `extras_classe.truques_extra`**

Taumaturgo e Xamã concedem +1 truque. O campo é gravado e nunca lido. Faça o
cálculo de truques conhecidos somá-lo — `getTruquesConhecidos`
(`utils.js:360-364`) é quem devolve a quantidade da tabela; o extra precisa
entrar em quem a consome, não na função da tabela (ela é confrontada com o livro
pelo motor de classes/níveis e deve continuar refletindo só a tabela).

- [ ] **Step 4: Provar por teste, e as lacunas se aposentarem sozinhas**

Rode a suíte. As lacunas correspondentes devem quebrar com
*"Lacuna corrigida: remova …"* — é assim que a mecânica cobra a remoção.
Remova as entradas e rode de novo.

---

### Task 8: Troca de Estilo de Luta e as 3 lacunas da rodada anterior

**Risk:** high — altera o fluxo de subida de nível.

**Files:** Modify `site/js/levelup.js`, `site/js/levelup-flow.js`, `site/js/levelup-cards.js`, `site/js/levelup-ui.js`, `site/js/levelup-validations.js`, `site/js/dados-classes.js`, `dados/classes/clerigo.json`

- [ ] **Step 1: Troca de Estilo de Luta do Guerreiro**

O livro (`Classes.md:3812`): a cada nível de Guerreiro, pode substituir o
talento de Estilo de Luta por outro.

Implemente pelo **padrão `opcoes` → `subirDeNivel`**, o mesmo da manobra
(`levelup.js:1556-1562`), e **não** pelo padrão de mutação direta de `char` em
`levelup-ui.js:1347-1366`. Motivo: o primeiro é observável por teste de unidade,
o segundo não — e o spec registra isso como decisão.

A troca é **opcional** (o jogador pode manter o estilo), então não deve virar
pendência bloqueante: siga o formato de `manobra_trocar_de`/`manobra_trocar_para`,
que só valida quando o jogador começa a preencher.

- [ ] **Step 2: Ladino — proficiência com armas**

`site/js/dados-classes.js:105`: `armas: ['Simples', 'Marcial (Acuidade)']` →
precisa incluir também Leve (`Classes.md:4152`, "Acuidade **ou** Leve").

**Atenção ao consertar na camada certa:** os dois consumidores
(`creator/passo-equipamento.js:35-42` e `sheet/condicoes.js:28-29`) fazem a
mesma checagem escrita à mão, com `info.armas.some(a => a.includes('...'))`.
Antes de só acrescentar `'Marcial (Leve)'` à lista, veja se a estrutura suporta
duas restrições na mesma categoria sem que a checagem duplicada precise mudar
nos dois lugares. Se precisar mudar os dois, esse é o sinal de que a regra devia
estar num lugar só.

- [ ] **Step 3: Ladino — Especialização no nível 6**

`Classes.md:4188`. Siga o padrão de `exigeEspecializacaoBardo`
(`levelup.js:444-446`) e do `bardo_expertise` correspondente. O motor converso
da rodada anterior vai cobrar: hoje ele registra que nenhum gatilho dispara para
`Ladino nv6`.

- [ ] **Step 4: Clérigo nível 3 — texto**

`dados/classes/clerigo.json`, nível 3: `"Subclasse de Clérigo"` →
`"Subclasse Clérigo"`, para bater com a célula da tabela do livro
(`Classes.md:1515`). É a única das três sem consequência funcional; corrija por
fidelidade.

- [ ] **Step 5: Portas finais**

`npm run test:regras:unidade` — 0 falhas, e **as lacunas corrigidas removidas**.
`npm run test:regras:e2e` — 111/111. `npx playwright test --list` — 329 em 10
arquivos. **A paridade agora pode divergir**: corrigir o app faz os dois lados
diferirem, e o README já registra que isso é resultado esperado, não regressão.
Meça e escreva o resultado.
