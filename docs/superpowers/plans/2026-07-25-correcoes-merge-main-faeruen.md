# Correções da integração main → faeruen

**Goal:** Corrigir as regressões introduzidas na resolução manual dos conflitos do merge de `main` (`f375750`) na branch `faeruen`, sem desfazer nada que veio de `main` nem do trabalho de faeruen.

**Architecture:** Aplicação web estática. Módulos ES em `site/js/`, dados em `dados/`, testes com o runner nativo do Node em `tests/`. A branch `faeruen` implementa a expansão *Heróis de Faerûn* (`frhof-2025`), cuja marca registrada é o objeto `fonte` carimbado em todo conteúdo novo e propagado por seleção, ficha, level up, salvamento e exportação.

**Tech Stack:** JavaScript ES modules, JSON, Node.js test runner

---

## Global Constraints

- **Nenhum commit, criação de branch ou worktree.** As correções ficam no working tree, não commitadas. `git add` é permitido apenas onde explicitamente instruído na Task 3.
- **Não desfazer mudanças de `main`.** Os 7 arquivos que só `main` alterou (`levelup-cards.js`, `levelup-flow.js`, `levelup-validations.js`, `levelup.js`, `store.js`, `talentos-effects.js`, `utils.js`) estão hoje idênticos a `f375750`. Salvo a alteração cirúrgica prevista na Task 2, devem continuar assim.
- **Identificador canônico da fonte:** `frhof-2025`; rótulo do selo: `Heróis de Faerûn`.
- **A `fonte` acompanha o conteúdo** por seleção, inventário, ficha, impressão, salvamento, exportação e importação. Uma entrada de magia sem `fonte` só é correta quando a magia é do conteúdo-base.
- **Validação de sintaxe deve ser feita em modo ES module:** `node --input-type=module --check < ARQUIVO`. `node --check ARQUIVO` trata `.js` como CommonJS e **não** detecta os erros relevantes aqui.
- **Comando de teste correto:** `node --test "tests/*.test.mjs"`. Passar o diretório (`node --test tests/`) falha com `MODULE_NOT_FOUND` e não é um defeito do código.
- **Baseline atual:** 48 de 50 testes passam. As 2 falhas (`itens-magicos-frhof.test.mjs:210`, `magias-frhof.test.mjs:349`) são endereçadas pela Task 4. Ao fim do plano, os 50 devem passar.
- `core.autocrlf=true` neste repositório: o working tree é CRLF e o repositório guarda LF. **Não** converter line endings de arquivo nenhum.
- Não fazer refatorações oportunistas ("while I'm here"). Cada task altera apenas o que está descrito.

---

## Task 1: Corrigir erro de sintaxe em `levelup-ui.js`

**Risco:** baixo — alteração mecânica de um caractere, em um arquivo, com verificação objetiva.

**Problema:** A resolução do conflito produziu uma interpolação de template mal formada em `site/js/levelup-ui.js`, linha 821. Falta a chave de fechamento de `${sufixoFonteOption(m)`. O arquivo inteiro deixa de carregar no browser (`SyntaxError: Missing } in template expression`), derrubando todo o fluxo de level up.

Linha 821 atual:

```js
                <input type="checkbox" class="levelup-im-truque" value="${m.nome}" ${restaurado ? 'checked' : ''} ${bloqueado ? 'disabled' : ''}> ${m.nome}${sufixoFonteOption(m)${bloqueado ? ' (já conhecido)' : ''}
```

**Correção:** fechar a interpolação após `sufixoFonteOption(m)`, resultando em `${m.nome}${sufixoFonteOption(m)}${bloqueado ? ' (já conhecido)' : ''}`.

Use como referência a linha 850 do mesmo arquivo, que é o caso análogo já correto:

```js
              return `<option value="${m.nome}" ${restaurada ? 'selected' : ''} ${bloqueada ? 'disabled' : ''}>${m.nome}${sufixoFonteOption(m)}${bloqueada ? ' (já conhecida)' : ''}</option>`;
```

**Steps:**

- [ ] Aplicar a correção na linha 821 de `site/js/levelup-ui.js`. Não alterar mais nada na linha nem no arquivo.
- [ ] Validar: `node --input-type=module --check < site/js/levelup-ui.js` deve sair com código 0.
- [ ] Validar que nenhum outro arquivo tem o mesmo defeito, varrendo todos os módulos:
      para cada arquivo `.js` sob `site/js/` (exceto `*.orig`), rodar `node --input-type=module --check < ARQUIVO` e reportar qualquer falha.

**Verificação de conclusão:** todos os módulos sob `site/js/` passam na checagem de sintaxe em modo ES module.

---

## Task 2: Restaurar a propagação de `fonte` perdida no merge

**Risco:** alto — mudança de comportamento em dois módulos, uma delas em arquivo que veio intacto de `main`.

**Contexto:** `faeruen` havia adaptado todos os pontos que criam entradas de magia para carimbarem `fonte`. Dois desses pontos se perderam.

### 2a — Grimório do level up (`site/js/levelup.js`)

`main` reestruturou o fluxo: `confirmarLevelUp` (em `levelup-ui.js`) não popula mais o grimório; quem faz isso agora é `subirDeNivel`, em `site/js/levelup.js`. A montagem das entradas, na linha 1063, descarta a `fonte`:

```js
    magiasGrimorioSelecionadas = selecionadas.map(nome => {
      const magia = magiasPorNome.get(nome);
      return { nome: magia.nome, circulo: magia.circulo };
    });
```

`magiasPorNome` vem de `getIndiceMagias()` (`site/js/db.js:181`), que já mescla as magias FRHOF e preserva a `fonte` delas. Consequência do defeito: uma magia FRHOF adicionada ao grimório numa subida de nível de Mago perde o selo de origem.

**Correção:** preservar a `fonte` na entrada criada, usando `clonarFonte` de `site/js/fontes.js` — a mesma função que os demais construtores de entrada de magia usam. A entrada deve continuar tendo `nome` e `circulo`, e ganhar `fonte` **apenas quando** `clonarFonte` retornar um valor (magias do conteúdo-base não recebem o campo).

Referência do formato canônico — `criarEntradaMagiaLevelUp`, em `site/js/levelup-ui.js:57`:

```js
function criarEntradaMagiaLevelUp(magia, extras = {}) {
  if (!magia) return null;
  const nome = typeof magia === 'string' ? magia : magia.nome;
  const circulo = extras.circulo ?? (typeof magia === 'string' ? 0 : (magia.circulo || 0));
  const fonte = typeof magia === 'string' ? null : clonarFonte(magia.fonte);
  return {
    nome,
    circulo,
    ...(fonte ? { fonte } : {}),
    ...extras
  };
}
```

Note que `clonarFonte` (`site/js/fontes.js:30`) já retorna `null` para valores inválidos ou não registrados, então não é preciso validar antes de chamar.

Esta é a **única** alteração autorizada em `site/js/levelup.js`. Adicionar o import de `clonarFonte` caso ainda não exista no arquivo.

### 2b — Troca de magia no level up (`site/js/levelup-ui.js`)

Na linha 1249, dentro de `confirmarLevelUp`, a resolução do conflito manteve a versão de `main` e descartou a adaptação de faeruen:

```js
        char.magias_preparadas.push({ nome: state.trocarPara, circulo: state.trocarParaCirculo });
```

**Correção:** restaurar a versão de faeruen, que localiza a magia na lista da classe para recuperar sua `fonte` e cai no literal simples quando não a encontra:

```js
        const magiaNova = encontrarMagiaLevelUp(listaMagiasClasse, state.trocarPara, state.trocarParaCirculo);
        char.magias_preparadas.push(criarEntradaMagiaLevelUp(magiaNova || { nome: state.trocarPara, circulo: state.trocarParaCirculo }));
```

`encontrarMagiaLevelUp` e `criarEntradaMagiaLevelUp` já existem no arquivo (linhas 74 e 57). Confirmar que `listaMagiasClasse` está em escopo nesse ponto do código; se não estiver, **pare e reporte** em vez de improvisar uma fonte alternativa para a lista.

**Steps:**

- [ ] Aplicar 2a em `site/js/levelup.js`.
- [ ] Aplicar 2b em `site/js/levelup-ui.js`.
- [ ] Validar sintaxe dos dois arquivos em modo ES module.
- [ ] Rodar `node --test "tests/*.test.mjs"` e registrar o resultado. A falha em `magias-frhof.test.mjs:349` pode persistir nesta task — ela cobre um assert desatualizado que a Task 4 corrige. Nenhuma **nova** falha pode aparecer.

**Verificação de conclusão:** ambos os pontos carimbam `fonte` quando a magia a possui; nenhuma falha de teste nova em relação ao baseline de 48/50.

---

## Task 3: Rastrear `site/js/regras-cobertura.js`

**Risco:** baixo — operação de indexação, sem alteração de conteúdo.

**Problema:** `site/js/regras-cobertura.js` é um arquivo **novo, vindo de `main`** (existe em `f375750`), mas está como untracked no working tree — nunca foi adicionado ao índice durante a resolução do merge. `site/js/pages/sheet.js` importa dele (`aplicarEfeitoTalento`, `getRegraTalento`, `obterEscolhasObrigatoriasTalento`, `restaurarRecursosTalentos`, `validarEscolhasTalento`). Se o merge for commitado no estado atual, o arquivo não entra no commit e a ficha quebra para qualquer clone do repositório.

O conteúdo em disco é idêntico ao de `main` a menos dos line endings (CRLF local, esperado com `core.autocrlf=true`). **Não** alterar o conteúdo do arquivo.

**Steps:**

- [ ] Confirmar que o conteúdo em disco é idêntico ao de `main`, ignorando line endings:
      `git show f375750:site/js/regras-cobertura.js | diff --strip-trailing-cr - site/js/regras-cobertura.js`
- [ ] Rodar `git add site/js/regras-cobertura.js`.
- [ ] Confirmar que o arquivo passou a ser rastreado: `git ls-files --error-unmatch site/js/regras-cobertura.js`.

**Verificação de conclusão:** o arquivo está no índice, com conteúdo inalterado.

---

## Task 4: Atualizar os dois testes desatualizados

**Risco:** médio — mexer em asserts pode mascarar regressões se feito sem critério.

**Contexto:** duas asserções falham hoje. Uma aponta uma regressão real (já corrigida na Task 2), a outra é frágil. **Nenhuma das duas deve ser simplesmente removida ou enfraquecida a ponto de não verificar mais nada.**

### 4a — `tests/itens-magicos-frhof.test.mjs:214` (assert frágil)

```js
  assert.match(sheet, /restaurarHabilidades\('longo'\);\s*\/\/ Itens mágicos com cargas recuperam todas as cargas no Descanso Longo\s*restaurarCargasItensMagicosDescansoLongo\(\);/);
```

Esta asserção exige **adjacência textual** entre `restaurarHabilidades('longo')` e `restaurarCargasItensMagicosDescansoLongo()`. `main` inseriu legitimamente `restaurarRecursosTalentos(char, 'longo');` entre as duas, em `site/js/pages/sheet.js:4661-4664`:

```js
    restaurarHabilidades('longo');
    restaurarRecursosTalentos(char, 'longo');
    // Itens mágicos com cargas recuperam todas as cargas no Descanso Longo
    restaurarCargasItensMagicosDescansoLongo();
```

O comportamento está **intacto** — a chamada continua no fluxo do descanso longo. O teste é que está acoplado a texto vizinho.

**Correção:** reformular a asserção para verificar o que ela realmente pretende — que `restaurarCargasItensMagicosDescansoLongo()` é chamada dentro do fluxo de descanso longo — sem depender de quais outras chamadas a cercam. O teste deve continuar falhando se a chamada for removida do fluxo. A linha 212, que verifica a existência da função, permanece como está.

### 4b — `tests/magias-frhof.test.mjs:382` (assert desatualizado)

```js
  assert.match(levelup, /char\.grimorio\.push\(criarEntradaMagiaLevelUp\(m\)\)/);
```

Esta asserção verificava o carimbo de `fonte` no grimório dentro de `site/js/levelup-ui.js`. `main` moveu essa responsabilidade para `site/js/levelup.js` (ver Task 2a), então o alvo do assert mudou de arquivo. A intenção do teste continua válida; o local que ele inspeciona é que ficou obsoleto.

**Correção:** apontar a asserção para o novo local da lógica, verificando que a montagem das entradas do grimório em `site/js/levelup.js` preserva a `fonte`. Seguir o padrão que o próprio arquivo de teste já usa para carregar e inspecionar módulos. As asserções das linhas 376, 380 e 381 continuam válidas e não devem ser alteradas.

**Steps:**

- [ ] Aplicar 4a.
- [ ] Aplicar 4b, alinhado com a implementação entregue na Task 2a.
- [ ] Rodar `node --test "tests/*.test.mjs"`; os 50 testes devem passar.
- [ ] Verificar que cada asserção reformulada ainda detecta a regressão que a motivou: reverter mentalmente (ou temporariamente, revertendo depois) a chamada/carimbo correspondente e confirmar que o teste falha.

**Verificação de conclusão:** 50/50 testes passando, e ambas as asserções ainda falham se o comportamento coberto for removido.

---

## Task 5: Restaurar `2026-03-31-multiclasse.md`

**Risco:** baixo — restauração de arquivo a partir do histórico, sem edição.

**Problema:** `docs/superpowers/plans/2026-03-31-multiclasse.md` (1487 linhas) aparece como deletado no working tree. O arquivo existe tanto em `main` (`f375750`) quanto em `HEAD` (`f31be87`), e `main` não o removeu — a deleção não é justificada por nada no merge.

**Steps:**

- [ ] Confirmar que as versões em `HEAD` e em `f375750` são idênticas:
      `git diff HEAD f375750 -- docs/superpowers/plans/2026-03-31-multiclasse.md` (deve sair vazio).
- [ ] Restaurar o arquivo a partir de `HEAD`: `git checkout HEAD -- docs/superpowers/plans/2026-03-31-multiclasse.md`.
- [ ] Confirmar que `git status --short` não lista mais o arquivo como deletado.

**Verificação de conclusão:** o arquivo está de volta no working tree, idêntico à versão de `HEAD`, e não aparece mais como deleção pendente.

---

## Task 6: Limpar resíduos do merge

**Risco:** baixo — remoção de arquivos de scratch e um ajuste de indentação.

### 6a — Remover os arquivos `.orig`

A ferramenta de merge deixou três backups no working tree, e eles **não** estão cobertos pelo `.gitignore` — seriam commitados junto:

- `site/js/levelup-ui.js.orig`
- `site/js/pages/creator.js.orig`
- `site/js/pages/sheet.js.orig`

São scratch da resolução de conflito, sem valor no repositório. Removê-los. Não estão rastreados, então basta apagar do disco.

### 6b — Corrigir indentação em `site/js/pages/sheet.js:14051`

A resolução do conflito deixou uma linha indentada com TAB no meio de um bloco que usa espaços:

```js
	  char.magias_preparadas.push(criarEntradaMagiaFicha(nome, circ));
```

**Correção:** substituir o TAB pela indentação em espaços coerente com o bloco em volta (as linhas vizinhas dentro do mesmo `else` usam 10 espaços). Alterar **apenas** o whitespace inicial — o código da linha permanece idêntico.

**Steps:**

- [ ] Remover os três arquivos `.orig`.
- [ ] Corrigir a indentação da linha 14051 de `site/js/pages/sheet.js`.
- [ ] Confirmar que a correção foi só de whitespace: `git diff -w -- site/js/pages/sheet.js` não deve mostrar diferença introduzida por esta task além do que já existia antes dela.
- [ ] Validar sintaxe de `site/js/pages/sheet.js` em modo ES module.

**Verificação de conclusão:** nenhum `.orig` no working tree; linha 14051 indentada com espaços; sintaxe válida.

---

## Verificação final do plano

- [ ] Todos os módulos sob `site/js/` passam em `node --input-type=module --check`.
- [ ] `node --test "tests/*.test.mjs"` → 50/50.
- [ ] `git status --short` não lista deleções inesperadas nem arquivos `.orig`.
- [ ] `site/js/regras-cobertura.js` está rastreado.
- [ ] Os 7 arquivos que só `main` alterou continuam idênticos a `f375750`, exceto `levelup.js`, cuja única diferença é a preservação de `fonte` da Task 2a.
- [ ] Nada commitado.
