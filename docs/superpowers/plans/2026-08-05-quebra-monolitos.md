# Quebra mecânica dos monólitos — Plano de Implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para implementar tarefa a tarefa. Os passos usam `- [ ]` para acompanhamento.

**Goal:** Dividir `site/js/pages/sheet.js` (17.955 linhas) e `site/js/pages/creator.js` (4.627 linhas) em 39 módulos agrupados por assunto, sem alterar uma única linha de comportamento.

**Architecture:** Extração puramente mecânica. Cada módulo recebe blocos de código recortados byte a byte do original; o estado compartilhado fica em módulos donos, exportado por *live binding* de módulo ES, de modo que nenhuma referência dentro de corpo de função precisa mudar. Um verificador Python prova, a cada commit, que todo bloco extraído é idêntico ao do baseline.

**Tech Stack:** JavaScript puro com módulos ES nativos (sem build), Python 3 da biblioteca padrão para o verificador, git. **Node.js não é usado e não pode ser introduzido.**

Spec: `docs/superpowers/specs/2026-08-05-quebra-monolitos-design.md`

---

## Global Constraints

Estas regras valem para **todas** as tarefas. Toda tarefa as inclui implicitamente.

### GC1 — Regra de ouro

Nada além da posição do código pode mudar. É proibido, sem exceção:

- alterar qualquer byte de `dados/`, `site/css/`, `site/index.html`, `site/sw.js`, `site/manifest.json`, `site/img/`, `index.html`, ou de qualquer módulo JS fora de `site/js/pages/sheet.js`, `site/js/pages/creator.js`, `site/js/sheet/` e `site/js/creator/`;
- reescrever o corpo de uma função;
- alterar nome de classe CSS, estrutura de markup, texto de botão ou de rótulo;
- renomear função, parâmetro, variável ou constante;
- corrigir bug, remover código morto, reordenar declarações ou melhorar nomes;
- adicionar dependência, `package.json`, `node_modules` ou etapa de build.

As **únicas** edições de corpo permitidas em todo o plano são as 9 linhas de setter da Tarefa 32 e as 4 da Tarefa 42, ambas dentro dos coordenadores, ambas listadas explicitamente.

### GC2 — Registro de dúvidas

Dúvidas, bugs encontrados no original e decisões tomadas sem consulta vão para `PERGUNTAS-PARA-REVISAO.txt` na raiz do repositório, no formato:

```
[2026-08-05] Tarefa 10 — magias.js
Contexto: `aplicarEfeitoMagico` referencia `getEstadoRecursosBruxo`, que foi
para classes/bruxo.js na Tarefa 17.
Decisão: importar de '../classes/bruxo.js'. Ciclo de import aceito (spec §4).
```

Bugs do original **não são corrigidos** aqui. São anotados e viram trabalho próprio depois.

### GC3 — Procedimento padrão de extração

Toda tarefa de módulo (3 a 31 e 33 a 41) segue exatamente estes quatro passos.

**Nenhum byte de código passa por copiar-e-colar manual** — o recorte é feito pelo próprio script, o que torna impossível alterar um corpo de função sem querer.

1. **Mover.** Um único comando faz o recorte e a colagem:

   ```
   python scripts/verificar_extracao.py mover sheet site/js/sheet/<modulo>.js nome1 nome2 ...
   ```

   Ele lê o coordenador atual, particiona por declarações de coluna zero, remove os blocos nomeados, grava-os no módulo de destino na mesma ordem em que apareciam, e reescreve a origem sem eles. Cria o destino com um cabeçalho de três linhas se ele ainda não existir. Finais de linha CRLF são preservados.

2. **Resolver símbolos e exports.** Rodar `python scripts/verificar_extracao.py sheet` (ou `creator`). Para cada símbolo não resolvido ele imprime o nome, o módulo onde a declaração vive agora e a **linha `import` pronta**; e lista quais declarações do módulo novo precisam de `export`. Aplicar exatamente o que ele reportou — nada a mais.

   Enquanto o módulo novo não tiver nenhuma linha `import`, seu comentário de cabeçalho é absorvido pelo primeiro bloco e o verificador acusa `corpo alterado`. Isso é proposital: força resolver os imports antes de dar a extração por boa.

3. **Substituir o cabeçalho genérico.** Trocar o cabeçalho de três linhas criado pelo `mover` por um de 3 a 6 linhas explicando o que o módulo contém.

4. **Validar.** `python scripts/verificar_extracao.py sheet` (ou `creator`) tem de sair limpo, com código de saída 0 — presença, integridade byte a byte, duplicação, símbolos sem import e imports quebrados, todos zerados.

Para as duas funções que o plano autoriza editar (`renderSheet` na Tarefa 2 e `renderCreator` na Tarefa 42), depois da edição rodar:

```
python scripts/verificar_extracao.py excecao sheet renderSheet
```

que grava o bloco atual em `scripts/excecoes/` e passa a compará-lo contra esse arquivo em vez do baseline. Antes de gravar a exceção, conferir o diff contra o baseline e confirmar que **só** as linhas autorizadas mudaram.

### GC4 — Comandos de validação

```
python scripts/verificar_extracao.py sheet      # integridade de sheet.js e seus módulos
python scripts/verificar_extracao.py creator    # integridade de creator.js e seus módulos
python scripts/verificar_extracao.py tudo       # ambos
git -C . diff --stat                            # nenhum arquivo fora do escopo tocado
```

Conferência visual, quando a tarefa pedir: abrir `zaitbr-bit.github.io/D-D_2024/site/` e `zaitbr-bit.github.io/DeD_2024/site/` lado a lado, mesmo personagem, e comparar. Localmente, `.\iniciar_servidor.ps1` serve o repositório.

### GC5 — Commits

Um commit por tarefa, mensagem no formato `Extrai <modulo> de <origem>`. **Nunca commitar sem autorização explícita do usuário** — a regra do projeto é que commits só acontecem quando pedidos. Ao terminar cada tarefa, deixar as mudanças no working tree e relatar.

---

## Estrutura de arquivos

Criados por este plano:

```
scripts/verificar_extracao.py       verificador de integridade (Tarefa 1)
scripts/baseline/sheet.js           snapshot do original (Tarefa 1, removido na 43)
scripts/baseline/creator.js         snapshot do original (Tarefa 1, removido na 43)
PERGUNTAS-PARA-REVISAO.txt          registro de dúvidas (Tarefa 1)

site/js/sheet/estado.js             T2    site/js/sheet/classes/barbaro.js     T15
site/js/sheet/colapso.js            T3    site/js/sheet/classes/bardo.js       T16
site/js/sheet/pdf.js                T4    site/js/sheet/classes/bruxo.js       T17
site/js/sheet/impressao.js          T5    site/js/sheet/classes/clerigo.js     T18
site/js/sheet/detalhes.js           T6    site/js/sheet/classes/druida.js      T19
site/js/sheet/inventario.js         T7    site/js/sheet/classes/feiticeiro.js  T20
site/js/sheet/condicoes.js          T8    site/js/sheet/classes/guardiao.js    T21
site/js/sheet/grimorio.js           T9    site/js/sheet/classes/guerreiro.js   T22
site/js/sheet/magias.js             T10   site/js/sheet/classes/ladino.js      T23
site/js/sheet/caracteristicas.js    T11   site/js/sheet/classes/mago.js        T24
site/js/sheet/talentos.js           T12   site/js/sheet/classes/monge.js       T25
site/js/sheet/edicao.js             T13   site/js/sheet/classes/paladino.js    T26
site/js/sheet/maestrias.js          T14   site/js/sheet/combate.js             T27
site/js/sheet/hp-descanso.js        T28   site/js/sheet/habilidades.js         T29
site/js/sheet/migracoes.js          T30   site/js/sheet/ficha.js               T31

site/js/creator/comum.js            T33   site/js/creator/passo-atributos.js   T37
site/js/creator/passo-detalhes.js   T34   site/js/creator/passo-antecedente.js T38
site/js/creator/passo-magias.js     T35   site/js/creator/passo-especie.js     T39
site/js/creator/passo-equipamento.js T36  site/js/creator/passo-classe.js      T40
site/js/creator/wizard.js           T41
```

Modificados: `site/js/pages/sheet.js` (T2-T32), `site/js/pages/creator.js` (T33-T42), `README.md` (T43).

---

## Marco 1 — Rede de segurança

### Task 1: Baseline e verificador de extração

**Risk:** medium — o verificador é a única prova de que a extração não altera comportamento. Se ele estiver errado, todas as 41 tarefas seguintes ficam sem rede.

**Files:**
- Create: `scripts/baseline/sheet.js` (cópia de `site/js/pages/sheet.js`)
- Create: `scripts/baseline/creator.js` (cópia de `site/js/pages/creator.js`)
- Create: `scripts/verificar_extracao.py`
- Create: `PERGUNTAS-PARA-REVISAO.txt`

**Interfaces:**
- Produces: o CLI `python scripts/verificar_extracao.py <sheet|creator|tudo|extrair>` usado por todas as tarefas seguintes.

- [ ] **Step 1: Criar os snapshots do baseline**

```
mkdir -p scripts/baseline
cp site/js/pages/sheet.js   scripts/baseline/sheet.js
cp site/js/pages/creator.js scripts/baseline/creator.js
```

Criar `PERGUNTAS-PARA-REVISAO.txt` com o cabeçalho:

```
Registro de duvidas, bugs do original e decisoes tomadas sem consulta
durante a quebra mecanica dos monolitos (spec 2026-08-05).

Formato: [data] Tarefa N - modulo / Contexto / Decisao
------------------------------------------------------------------
```

- [ ] **Step 2: Escrever o particionador de declarações**

O verificador **não** conta chaves — o código usa template literals aninhados que quebram qualquer contador ingênuo. Ele particiona o arquivo por declarações de coluna zero.

Uma linha inicia declaração de topo quando casa:

```python
import re

RE_DECL = re.compile(
    r'^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)'
    r'|^(?:const|let|var)\s+([A-Za-z_$][\w$]*)'
    r'|^window\.([A-Za-z_$][\w$]*)\s*='
)

def particionar(texto):
    """Divide o arquivo em (preambulo, [(nome, bloco), ...]).

    Um bloco vai do seu comentario de cabecalho (corrida contigua de linhas
    de comentario e linhas em branco logo acima da declaracao) ate a linha
    anterior ao cabecalho do bloco seguinte. A concatenacao de preambulo com
    todos os blocos reproduz o arquivo byte a byte.
    """
    linhas = texto.split('\n')
    inicios = []  # (linha_da_declaracao, nome)
    for i, l in enumerate(linhas):
        m = RE_DECL.match(l)
        if m:
            nome = m.group(1) or m.group(2) or m.group(3)
            inicios.append((i, nome))

    def inicio_cabecalho(idx_decl, limite):
        """Sobe a partir da declaracao juntando comentarios e linhas vazias."""
        i = idx_decl - 1
        while i > limite:
            s = linhas[i].strip()
            if s == '' or s.startswith('//') or s.startswith('/*') \
               or s.startswith('*') or s.endswith('*/'):
                i -= 1
            else:
                break
        return i + 1

    blocos = []
    limite = -1
    marcos = []
    for k, (idx, nome) in enumerate(inicios):
        ini = inicio_cabecalho(idx, limite)
        marcos.append((ini, nome))
        limite = idx
    for k, (ini, nome) in enumerate(marcos):
        fim = marcos[k + 1][0] if k + 1 < len(marcos) else len(linhas)
        blocos.append((nome, '\n'.join(linhas[ini:fim])))
    preambulo = '\n'.join(linhas[:marcos[0][0]]) if marcos else texto
    return preambulo, blocos
```

- [ ] **Step 3: Provar o particionador contra o próprio baseline**

Antes de qualquer outra checagem, o script tem de reconstruir o arquivo:

```python
def provar_particionamento(caminho):
    texto = open(caminho, encoding='utf-8').read()
    pre, blocos = particionar(texto)
    reconstruido = pre + '\n' + '\n'.join(b for _, b in blocos) if pre else \
                   '\n'.join(b for _, b in blocos)
    assert reconstruido == texto, f'particionamento perdeu bytes em {caminho}'
    return len(blocos)
```

Rodar: `python scripts/verificar_extracao.py autoteste`
Esperado, exatamente:

```
scripts/baseline/sheet.js ..... 224 blocos, reconstrucao byte a byte OK
scripts/baseline/creator.js ... 78 blocos, reconstrucao byte a byte OK
```

(224 = 195 funções + 27 constantes + 2 `window.`; 78 = 63 funções + 15 constantes.) Se a contagem divergir, o `RE_DECL` está errado — ajustar até bater, **sem** alterar os arquivos de origem.

- [ ] **Step 4: Escrever a checagem de integridade**

Para o alvo `sheet`, o verificador:

1. particiona `scripts/baseline/sheet.js` → dicionário `nome → bloco_baseline`;
2. particiona `site/js/pages/sheet.js` e todo `site/js/sheet/**/*.js` → dicionário `nome → (arquivo, bloco_atual)`;
3. **presença**: todo nome do baseline existe em exatamente um arquivo atual. Ausentes e duplicados são erro;
4. **integridade**: `bloco_atual == bloco_baseline` para cada nome, ignorando apenas o prefixo `export ` acrescentado na primeira linha da declaração. Diferente é **erro**, com `difflib.unified_diff` impresso;
5. **exceções declaradas**: os blocos de `renderSheet` (Tarefa 32) e `renderCreator` (Tarefa 42) são comparados contra uma versão esperada em `scripts/excecoes/`, gravada na própria tarefa. Enquanto o arquivo de exceção não existir, esses dois blocos são comparados normalmente contra o baseline.

- [ ] **Step 5: Escrever a checagem de símbolos**

Conjunto de nomes resolvíveis = os 224 nomes do baseline **mais** todos os nomes importados no preâmbulo do baseline (as 16 linhas `import` de `sheet.js`). Para cada arquivo atual:

```python
def simbolos_usados(texto, nomes_conhecidos):
    """Nomes conhecidos que aparecem no texto como identificador livre.

    Ignora ocorrencias precedidas por ponto (acesso a propriedade) e as que
    aparecem dentro de string ou comentario nao sao filtradas de proposito:
    um falso positivo custa um import a mais, um falso negativo custa um
    ReferenceError em producao.
    """
    achados = set()
    for nome in nomes_conhecidos:
        if re.search(r'(?<![.\w$])' + re.escape(nome) + r'(?![\w$])', texto):
            achados.add(nome)
    return achados
```

Um símbolo é **não resolvido** quando é usado no arquivo, não é declarado nele e não aparece em nenhuma linha `import` dele. Para cada não resolvido, imprimir o nome, o arquivo onde a declaração vive agora e a linha `import` pronta:

```
  X grimorio.js usa `renderSecaoMagias` sem import
    -> import { renderSecaoMagias } from './magias.js';
```

E o inverso, para o passo 5 do GC3 — declarações que precisam de `export`:

```
  ! magias.js: `renderSecaoMagias` e usada por grimorio.js, ficha.js
    -> marcar com `export`
```

- [ ] **Step 6: Escrever o subcomando `extrair`**

`python scripts/verificar_extracao.py extrair sheet nome1 nome2 ...` imprime os blocos do baseline correspondentes aos nomes dados, na ordem em que aparecem no baseline, separados por nada (concatenação direta). É o que o passo 1 do GC3 usa para recortar.

- [ ] **Step 7: Rodar a validação completa contra o estado atual**

Run: `python scripts/verificar_extracao.py tudo`
Esperado: `224/224` e `78/78` idênticos, 0 alterados, 0 duplicados, 0 símbolos sem import — porque nada foi extraído ainda e `sheet.js` é idêntico ao seu baseline. Código de saída 0.

- [ ] **Step 8: Confirmar que nada fora do escopo mudou**

Run: `git status --porcelain`
Esperado: apenas `scripts/baseline/sheet.js`, `scripts/baseline/creator.js`, `scripts/verificar_extracao.py` e `PERGUNTAS-PARA-REVISAO.txt` como arquivos novos. Nenhum arquivo modificado.

---

## Marco 2 — `sheet.js`

Todas as tarefas deste marco seguem o GC3. Cada uma lista as declarações exatas a mover.

### Task 2: `sheet/estado.js`

**Risk:** high — é o módulo do qual todos os outros dependem, e o único que introduz setters.

**Files:**
- Create: `site/js/sheet/estado.js`
- Modify: `site/js/pages/sheet.js`

**Interfaces:**
- Produces: `char`, `containerRef`, `classeData`, `indiceMagiasCache`, `talentosCache`, `especiesCache`, `magiasDominioCache`, `magiasSempreCache`, `passivosTalentosCache`, `ATRIBUTO_ESTILO`, `salvar()`, `campoEstaEditado(caminho)`, `seloEdicao(caminho)`, e os setters `definirChar`, `definirContainer`, `definirClasseData`, `definirIndiceMagias`, `definirTalentos`, `definirEspecies`, `definirMagiasDominio`, `definirMagiasSempre`, `definirPassivosTalentos`.

- [ ] **Step 1: Mover as declarações**

Constantes e variáveis: `ATRIBUTO_ESTILO`, `char`, `containerRef`, `classeData`, `indiceMagiasCache`, `talentosCache`, `especiesCache`, `magiasDominioCache`, `magiasSempreCache`, `passivosTalentosCache`.

Funções: `salvar`, `campoEstaEditado`, `seloEdicao`.

Os nove `let` passam a ser `export let`. Os três `function` passam a ser `export function`.

- [ ] **Step 2: Acrescentar os nove setters ao fim do módulo**

Estas funções são **novas** — são a exceção declarada da spec §3.1. Nenhuma outra linha nova é permitida.

```js
/** Define o personagem atual da ficha. Chamado só por renderSheet. */
export function definirChar(valor) { char = valor; }

/** Define o contêiner raiz da ficha. Chamado só por renderSheet. */
export function definirContainer(valor) { containerRef = valor; }

/** Define os dados da classe do personagem. Chamado só por renderSheet. */
export function definirClasseData(valor) { classeData = valor; }

/** Define o cache do índice de magias. Chamado só por renderSheet. */
export function definirIndiceMagias(valor) { indiceMagiasCache = valor; }

/** Define o cache de talentos. Chamado só por renderSheet. */
export function definirTalentos(valor) { talentosCache = valor; }

/** Define o cache de espécies. Chamado só por renderSheet. */
export function definirEspecies(valor) { especiesCache = valor; }

/** Define o cache de magias de domínio. Chamado só por renderSheet. */
export function definirMagiasDominio(valor) { magiasDominioCache = valor; }

/** Define o cache de magias sempre preparadas. Chamado só por renderSheet. */
export function definirMagiasSempre(valor) { magiasSempreCache = valor; }

/** Define o cache de passivos de talentos. Chamado só por renderSheet. */
export function definirPassivosTalentos(valor) { passivosTalentosCache = valor; }
```

- [ ] **Step 3: Ajustar as nove atribuições em `renderSheet`**

Em `site/js/pages/sheet.js`, dentro de `renderSheet`, trocar exatamente estas nove linhas — e **somente** estas:

```js
containerRef = container;                    →  definirContainer(container);
char = getPersonagem(charId);                →  definirChar(getPersonagem(charId));
passivosTalentosCache = resolverPassivosTalentos(char);
                                             →  definirPassivosTalentos(resolverPassivosTalentos(char));
classeData = await getClasse(char.classe);   →  definirClasseData(await getClasse(char.classe));
indiceMagiasCache = indiceData?.magias || [];→  definirIndiceMagias(indiceData?.magias || []);
talentosCache = await getTalentos();         →  definirTalentos(await getTalentos());
especiesCache = await getEspecies();         →  definirEspecies(await getEspecies());
magiasDominioCache = await obterTodasMagiasDominio(char.classe, char.subclasse, char.nivel);
                                             →  definirMagiasDominio(await obterTodasMagiasDominio(char.classe, char.subclasse, char.nivel));
magiasSempreCache = await obterTodasMagiasSemprePreparadas(char.classe, char.subclasse, char.nivel);
                                             →  definirMagiasSempre(await obterTodasMagiasSemprePreparadas(char.classe, char.subclasse, char.nivel));
```

Gravar o bloco resultante de `renderSheet` em `scripts/excecoes/renderSheet.js`, para o verificador comparar contra ele em vez do baseline daqui em diante.

- [ ] **Step 4: Resolver imports e exports**

Run: `python scripts/verificar_extracao.py sheet`
Colar as linhas `import` que ele imprimir, em `estado.js` e em `pages/sheet.js`.

- [ ] **Step 5: Validar**

Run: `python scripts/verificar_extracao.py sheet`
Esperado: `224/224 presentes`, `223 idênticos + 1 exceção declarada (renderSheet)`, 0 duplicados, 0 símbolos sem import, saída 0.

- [ ] **Step 6: Conferir no navegador**

Servir localmente com `.\iniciar_servidor.ps1`, abrir uma ficha existente e confirmar que ela carrega, que os valores batem com a mesma ficha em `zaitbr-bit.github.io/D-D_2024/site/`, e que o console não tem erro.

---

### Task 3: `sheet/colapso.js`

**Risk:** low — cinco funções e três variáveis, todas contidas, sem setter novo.

**Files:**
- Create: `site/js/sheet/colapso.js`
- Modify: `site/js/pages/sheet.js`

**Interfaces:**
- Consumes: `char` de `estado.js`.
- Produces: `_secoesInvColapsadas`, `_detalhesColapsada`, `_truquesColapsados`, `_carregarEstadoColapso()`, `_salvarEstadoColapso()`, `setupEventosDetalhesColapso()`, `setupEventosTruquesColapso()`.

- [ ] **Step 1: Mover as declarações**

Variáveis: `_secoesInvColapsadas`, `_detalhesColapsada`, `_truquesColapsados`.
Funções: `_getCollapseStorageKey`, `_carregarEstadoColapso`, `_salvarEstadoColapso`, `setupEventosDetalhesColapso`, `setupEventosTruquesColapso`.

As duas últimas vão junto **de propósito**: são elas que reatribuem `_detalhesColapsada` e `_truquesColapsados`, e mantê-las aqui evita transformar essas atribuições em setters.

- [ ] **Step 2: Resolver imports e exports**

Run: `python scripts/verificar_extracao.py sheet` e colar o que ele imprimir.

- [ ] **Step 3: Validar**

Run: `python scripts/verificar_extracao.py sheet`
Esperado: saída limpa, código 0.

---

### Task 4: `sheet/pdf.js`

**Risk:** low — folha do grafo, ninguém depende dela além do botão de PDF.

**Files:**
- Create: `site/js/sheet/pdf.js`
- Modify: `site/js/pages/sheet.js`

**Interfaces:**
- Produces: `gerarPdfFicha()`, `baixarPdfFicha()`.

- [ ] **Step 1: Mover as declarações**

Variáveis: `_pdfLibPromise`, `_PDF_UNICODE_OK`.
Funções: `carregarPdfLib`, `_sanitizePdfText`, `_montarDadosCartao`, `_extrairBlocosDetalhe`, `_quebrarLinhas`, `_pdfTxt`, `_pdfCen`, `_pdfFit`, `_pdfSecHead`, `_pdfDot`, `_pdfWrap`, `_desenharCartao`, `_fluirBlocos`, `_renderizarPdf`, `gerarPdfFicha`, `baixarPdfFicha`.

- [ ] **Step 2: Resolver imports e exports**

Run: `python scripts/verificar_extracao.py sheet` e colar o que ele imprimir.

- [ ] **Step 3: Validar**

Run: `python scripts/verificar_extracao.py sheet`
Esperado: saída limpa, código 0.

---

### Task 5: `sheet/impressao.js`

**Risk:** low — folha do grafo.

**Files:**
- Create: `site/js/sheet/impressao.js`
- Modify: `site/js/pages/sheet.js`

**Interfaces:**
- Produces: `imprimirFicha()`, `gerarHtmlImpressao()`, `isStandaloneApp()`.

- [ ] **Step 1: Mover as declarações**

Variável: `_printOverlayAtivo`.
Funções: `carregarDescricoesMagias`, `htmlMagiaImpressao`, `htmlMagiaPersonalizadaImpressao`, `gerarHtmlImpressao`, `imprimirFicha`, `isStandaloneApp`.

- [ ] **Step 2: Resolver imports e exports**

Run: `python scripts/verificar_extracao.py sheet` e colar o que ele imprimir.

- [ ] **Step 3: Validar**

Run: `python scripts/verificar_extracao.py sheet`
Esperado: saída limpa, código 0.

- [ ] **Step 4: Conferir impressão e PDF no navegador**

Abrir uma ficha, acionar Imprimir e depois Baixar PDF. Comparar o resultado com o da mesma ficha no site original. São os dois primeiros módulos com tela própria — vale conferir agora.

---

### Task 6: `sheet/detalhes.js`

**Risk:** low — uma única função.

**Files:**
- Create: `site/js/sheet/detalhes.js`
- Modify: `site/js/pages/sheet.js`

**Interfaces:**
- Produces: `renderSecaoDetalhes()`.

- [ ] **Step 1: Mover a declaração**

Função: `renderSecaoDetalhes`.

- [ ] **Step 2: Resolver imports e exports**

Run: `python scripts/verificar_extracao.py sheet` e colar o que ele imprimir.

- [ ] **Step 3: Validar**

Run: `python scripts/verificar_extracao.py sheet`
Esperado: saída limpa, código 0.

---

### Task 7: `sheet/inventario.js`

**Risk:** medium — 11 funções, drag-and-drop e re-render parcial; é o módulo com mais estado visual local.

**Files:**
- Create: `site/js/sheet/inventario.js`
- Modify: `site/js/pages/sheet.js`

**Interfaces:**
- Consumes: `char`, `salvar` de `estado.js`; `_secoesInvColapsadas`, `_salvarEstadoColapso` de `colapso.js`.
- Produces: `renderSecaoInventario()`, `setupEventosInventarioSheet()`, `getEstadoCarga()`, `reRenderSheetInv()`.

- [ ] **Step 1: Mover as declarações**

Variável: `_cacheEquipSheet`.
Funções: `getEstadoCarga`, `renderSecaoInventario`, `renderSheetInvLista`, `renderSheetInvItem`, `setupEventosInventarioSheet`, `abrirModalEditarItemCustomizado`, `reRenderSheetInv`, `setupSheetDragDrop`, `carregarDadosEquipSheet`, `mostrarDetalheItemSheet`, `mostrarSeletorCategoria`.

- [ ] **Step 2: Resolver imports e exports**

Run: `python scripts/verificar_extracao.py sheet` e colar o que ele imprimir.

- [ ] **Step 3: Validar**

Run: `python scripts/verificar_extracao.py sheet`
Esperado: saída limpa, código 0.

---

### Task 8: `sheet/condicoes.js`

**Risk:** low — oito funções e três tabelas, todas contidas.

**Files:**
- Create: `site/js/sheet/condicoes.js`
- Modify: `site/js/pages/sheet.js`

**Interfaces:**
- Produces: `renderSecaoCondicoes()`, `renderSecaoDefesas()`, `renderSecaoSentidos()`, `setupEventosCondicoes()`, `setupEventosDefesas()`, `sheetTemProfArma(arma)`, `sheetTemProfArmadura(armadura)`, `sheetBadgeProf(proficiente)`.

- [ ] **Step 1: Mover as declarações**

Constantes: `CONDICOES_DD`, `CONDICOES_DESCRICAO`, `TIPOS_DANO`.
Funções: `sheetTemProfArma`, `sheetTemProfArmadura`, `sheetBadgeProf`, `renderSecaoCondicoes`, `renderSecaoDefesas`, `renderSecaoSentidos`, `setupEventosCondicoes`, `setupEventosDefesas`.

- [ ] **Step 2: Resolver imports e exports**

Run: `python scripts/verificar_extracao.py sheet` e colar o que ele imprimir.

- [ ] **Step 3: Validar**

Run: `python scripts/verificar_extracao.py sheet`
Esperado: saída limpa, código 0.

- [ ] **Step 4: Conferir inventário e condições no navegador**

Abrir uma ficha com itens, arrastar um item entre seções, colapsar e expandir as três seções do inventário, marcar e desmarcar uma condição, conferir defesas e sentidos. Comparar com a mesma ficha no site original.

---

### Task 9: `sheet/grimorio.js`

**Risk:** medium — seis modais assíncronos com callbacks de pós-troca.

**Files:**
- Create: `site/js/sheet/grimorio.js`
- Modify: `site/js/pages/sheet.js`

**Interfaces:**
- Produces: `mostrarBuscaMagia()`, `mostrarFormMagiaCustom(indiceEdicao)`, `mostrarBuscaGrimorio()`, `mostrarTrocaMagias(callbackPosTroca)`, `abrirPreenchimentoSlotMagia()`, `mostrarTrocaMagiaConhecida(callbackPosTroca)`.

- [ ] **Step 1: Mover as declarações**

Funções: `mostrarBuscaMagia`, `mostrarFormMagiaCustom`, `mostrarBuscaGrimorio`, `mostrarTrocaMagias`, `abrirPreenchimentoSlotMagia`, `mostrarTrocaMagiaConhecida`.

- [ ] **Step 2: Resolver imports e exports**

Run: `python scripts/verificar_extracao.py sheet` e colar o que ele imprimir.

- [ ] **Step 3: Validar**

Run: `python scripts/verificar_extracao.py sheet`
Esperado: saída limpa, código 0.

---

### Task 10: `sheet/magias.js`

**Risk:** high — 30 funções, o maior módulo depois de `habilidades.js`, e o que mais cruza com classes e grimório.

**Files:**
- Create: `site/js/sheet/magias.js`
- Modify: `site/js/pages/sheet.js`

**Interfaces:**
- Produces: `renderSecaoMagias()`, `setupEventosEspacosMagia()`, `aplicarEfeitoMagico(nomeMagia, circ, opcoes)`, `getConcentracaoAtiva()`, `ehMagiaConcentracao(nomeMagia)`, `consumirEspacoMagiaDisponivel(circuloMinimo)`, `recuperarEspacoMagia(circulo)`, `obterMagiasDisponiveisClasseAtual()`, `achatarMagiasClasse(magiasClasseData)`, `magiaContaNoLimite(magia)`, `magiaEhEspecial(magia)`, `rotuloOrigemMagia(magia)`, `normalizarMagiaPersonalizada(m, indice)`, `renderLinhaMagiaPersonalizada(magia, indice, opts)`, `conjurarMagiaPersonalizada(indice, circuloSelecionado)`, `ehSubclasseConjuradora()`, `getSubclasseConjuradoraConjuracao()`.

- [ ] **Step 1: Mover as declarações — magias personalizadas**

Funções: `magiaContaNoLimite`, `magiaEhEspecial`, `rotuloOrigemMagia`, `normalizarMagiaPersonalizada`, `renderDetalhesMagiaPersonalizada`, `renderLinhaMagiaPersonalizada`, `magiaPersonalizadaEhConcentracao`, `registrarConcentracaoMagiaPersonalizada`, `conjurarMagiaPersonalizada`.

- [ ] **Step 2: Mover as declarações — espaços e conjuração**

Funções: `getSubclasseConjuradoraConjuracao`, `ehSubclasseConjuradora`, `consumirEspacoMagiaDisponivel`, `recuperarEspacoMagia`, `achatarMagiasClasse`, `obterMagiasDisponiveisClasseAtual`, `prioridadeConjuracao`, `badgesMagiaRapidos`, `renderSecaoMagias`.

- [ ] **Step 3: Mover as declarações — metamagia, concentração e efeitos**

Constantes: `OPCOES_METAMAGIA`, `MAGIAS_EFEITO`.
Funções: `getConcentracaoAtiva`, `ehMagiaConcentracao`, `getInfoMagiaParaMetamagia`, `mostrarModalMetamagiaConjuracao`, `_aplicarEfeitoMetamagia`, `_processarMetamagiasConjuracao`, `confirmarSubstituirConcentracao`, `aplicarEfeitoMagico`, `mostrarModalAlvoMagia`, `mostrarModalSelecaoMagia`, `mostrarModalCuraCondicao`, `setupEventosEspacosMagia`.

- [ ] **Step 4: Resolver imports e exports**

Run: `python scripts/verificar_extracao.py sheet` e colar o que ele imprimir. Este módulo vai gerar ciclos com `grimorio.js` e, mais tarde, com `classes/bruxo.js` e `ficha.js` — são esperados e seguros (spec §4). Registrar em `PERGUNTAS-PARA-REVISAO.txt` cada ciclo criado.

- [ ] **Step 5: Validar**

Run: `python scripts/verificar_extracao.py sheet`
Esperado: saída limpa, código 0.

- [ ] **Step 6: Conferir magias e grimório no navegador**

Com um personagem conjurador: abrir a seção de magias, gastar e recuperar um espaço, conjurar uma magia de concentração, trocar a concentração, abrir o grimório, buscar e adicionar uma magia, criar uma magia personalizada e conjurá-la. Com um Feiticeiro: aplicar uma metamagia. Comparar tudo com o site original.

---

### Task 11: `sheet/caracteristicas.js`

**Risk:** low — cinco funções e duas tabelas.

**Files:**
- Create: `site/js/sheet/caracteristicas.js`
- Modify: `site/js/pages/sheet.js`

**Interfaces:**
- Produces: `renderSecaoCaracteristicas()`, `renderSecaoSubclasse()`, `renderSecaoTracosEspecie()`, `renderTracoEspecie(traco, herdaAncestralidade, ehSubRevelacao)`, `gerarTracoSinteticoEspecie(especie, tracosEscolhidos, nivel)`.

- [ ] **Step 1: Mover as declarações**

Constantes: `SUBTRACOS_ESPECIE`, `TITULO_TRACO_PAI`.
Funções: `renderSecaoCaracteristicas`, `renderSecaoSubclasse`, `gerarTracoSinteticoEspecie`, `renderSecaoTracosEspecie`, `renderTracoEspecie`.

- [ ] **Step 2: Resolver imports e exports**

Run: `python scripts/verificar_extracao.py sheet` e colar o que ele imprimir.

- [ ] **Step 3: Validar**

Run: `python scripts/verificar_extracao.py sheet`
Esperado: saída limpa, código 0.

---

### Task 12: `sheet/talentos.js`

**Risk:** medium — 11 funções, inclui duas migrações de dados de talento e a recuperação de dádiva épica.

**Files:**
- Create: `site/js/sheet/talentos.js`
- Modify: `site/js/pages/sheet.js`

**Interfaces:**
- Produces: `renderSecaoTalentos()`, `sincronizarTalentosInvocacoes()`, `migrarIniciadoEmMagiaInstancias()`, `migrarAdeptoElementalTipos()`, `abrirModalAdicionarTalento()`, `abrirModalIniciadoEmMagiaFicha(restantes, aoSalvar)`, `abrirModalEditarIniciadoEmMagia(ordinal)`, `precisaRecuperarDadivaEpica()`, `abrirModalRecuperarDadivaEpica()`.

- [ ] **Step 1: Mover as declarações**

Funções: `renderSecaoTalentos`, `sincronizarTalentosInvocacoes`, `migrarIniciadoEmMagiaInstancias`, `migrarAdeptoElementalTipos`, `obterListasIniciadoEmMagiaUsadas`, `abrirModalIniciadoEmMagiaFicha`, `abrirModalEditarIniciadoEmMagia`, `abrirModalAdicionarTalento`, `obterTiposAdeptoElementalUsados`, `precisaRecuperarDadivaEpica`, `abrirModalRecuperarDadivaEpica`.

`precisaRecuperarDadivaEpica` e `abrirModalRecuperarDadivaEpica` estão fisicamente entre as funções de combate no original, mas pertencem a talentos por assunto. Registrar essa decisão em `PERGUNTAS-PARA-REVISAO.txt`.

- [ ] **Step 2: Resolver imports e exports**

Run: `python scripts/verificar_extracao.py sheet` e colar o que ele imprimir.

- [ ] **Step 3: Validar**

Run: `python scripts/verificar_extracao.py sheet`
Esperado: saída limpa, código 0.

---

### Task 13: `sheet/edicao.js`

**Risk:** medium — o modal de edição toca todos os campos da ficha e a validação de atributos.

**Files:**
- Create: `site/js/sheet/edicao.js`
- Modify: `site/js/pages/sheet.js`

**Interfaces:**
- Produces: `abrirModalEdicaoFicha(secaoInicial)`, `setupEventosEdicao()`, `abrirModalLevelUp()`, `obterFlagLevelUpFlowV2()`, `salvarFlagLevelUpFlowV2(ativo)`.

- [ ] **Step 1: Mover as declarações**

Constantes: `LEVELUP_FLOW_V2_DEFAULT`, `LEVELUP_FLOW_V2_STORAGE_KEY`.
Funções: `obterFlagLevelUpFlowV2`, `salvarFlagLevelUpFlowV2`, `abrirModalEdicaoFicha`, `setupEventosEdicao`, `abrirModalLevelUp`.

- [ ] **Step 2: Resolver imports e exports**

Run: `python scripts/verificar_extracao.py sheet` e colar o que ele imprimir.

- [ ] **Step 3: Validar**

Run: `python scripts/verificar_extracao.py sheet`
Esperado: saída limpa, código 0.

---

### Task 14: `sheet/maestrias.js`

**Risk:** low — duas funções, compartilhadas por Bárbaro, Guerreiro e Guardião.

**Files:**
- Create: `site/js/sheet/maestrias.js`
- Modify: `site/js/pages/sheet.js`

**Interfaces:**
- Produces: `abrirModalMaestrias()`, `abrirModalTrocaMaestriaDescanso(callbackPosTroca)`.

- [ ] **Step 1: Mover as declarações**

Funções: `abrirModalMaestrias`, `abrirModalTrocaMaestriaDescanso`.

- [ ] **Step 2: Resolver imports e exports**

Run: `python scripts/verificar_extracao.py sheet` e colar o que ele imprimir.

- [ ] **Step 3: Validar**

Run: `python scripts/verificar_extracao.py sheet`
Esperado: saída limpa, código 0.

---

### Task 15: `sheet/classes/barbaro.js`

**Risk:** low — quatro funções de uma classe só.

**Files:**
- Create: `site/js/sheet/classes/barbaro.js`
- Modify: `site/js/pages/sheet.js`

**Interfaces:**
- Produces: `getProgressaoBarbaro()`, `getEstadoFuria()`, `setupEventosSubclasseBarbaro()`.

- [ ] **Step 1: Mover as declarações**

Funções: `getProgressaoBarbaro`, `getEstadoFuria`, `_abrirEscolhaAnimalFuria`, `setupEventosSubclasseBarbaro`.

- [ ] **Step 2: Resolver imports e exports**

Run: `python scripts/verificar_extracao.py sheet` e colar o que ele imprimir. Atenção ao caminho relativo: daqui os módulos irmãos são `../estado.js`, `../magias.js`, etc.

- [ ] **Step 3: Validar**

Run: `python scripts/verificar_extracao.py sheet`
Esperado: saída limpa, código 0.

---

### Task 16: `sheet/classes/bardo.js`

**Risk:** low — duas funções.

**Files:**
- Create: `site/js/sheet/classes/bardo.js`
- Modify: `site/js/pages/sheet.js`

**Interfaces:**
- Produces: `getProgressaoBardo()`, `getEstadoInspiracaoBardo()`.

- [ ] **Step 1: Mover as declarações**

Funções: `getProgressaoBardo`, `getEstadoInspiracaoBardo`.

`ehBardoComSegredosMagicos` **não** vem para cá — vai para `combate.js` na Tarefa 27, junto com as demais consultas de perícia e vantagem.

- [ ] **Step 2: Resolver imports e exports**

Run: `python scripts/verificar_extracao.py sheet` e colar o que ele imprimir.

- [ ] **Step 3: Validar**

Run: `python scripts/verificar_extracao.py sheet`
Esperado: saída limpa, código 0.

---

### Task 17: `sheet/classes/bruxo.js`

**Risk:** medium — 11 funções, incluindo dois modais grandes e a avaliação de pré-requisitos de invocação.

**Files:**
- Create: `site/js/sheet/classes/bruxo.js`
- Modify: `site/js/pages/sheet.js`

**Interfaces:**
- Produces: `getProgressaoBruxo()`, `getEstadoRecursosBruxo()`, `getCirculosArcanumDesbloqueados()`, `recuperarEspacosMagiaBruxo(parcial)`, `abrirModalRecursosBruxo()`, `abrirModalPactoDoTomo()`, `renderSecaoPactoBruxo()`, `extrairInvocacoesMagicasBruxo(invocacoesSelecionadas)`, `extrairOpcoesInvocacoesBruxo()`, `obterMagiasArcanumPorCirculo(circulo)`.

- [ ] **Step 1: Mover as declarações**

Funções: `getProgressaoBruxo`, `getCirculosArcanumDesbloqueados`, `getEstadoRecursosBruxo`, `recuperarEspacosMagiaBruxo`, `extrairOpcoesInvocacoesBruxo`, `obterMagiasArcanumPorCirculo`, `abrirModalRecursosBruxo`, `abrirModalPactoDoTomo`, `avaliarPrerequisitoInvocacaoBruxoComSel`, `renderSecaoPactoBruxo`, `extrairInvocacoesMagicasBruxo`.

- [ ] **Step 2: Resolver imports e exports**

Run: `python scripts/verificar_extracao.py sheet` e colar o que ele imprimir.

- [ ] **Step 3: Validar**

Run: `python scripts/verificar_extracao.py sheet`
Esperado: saída limpa, código 0.

---

### Task 18: `sheet/classes/clerigo.js`

**Risk:** low — três funções.

**Files:**
- Create: `site/js/sheet/classes/clerigo.js`
- Modify: `site/js/pages/sheet.js`

**Interfaces:**
- Produces: `getProgressaoClerigo()`, `getEstadoRecursosClerigo()`, `getEstadoSubclassesClerigo()`.

- [ ] **Step 1: Mover as declarações**

Funções: `getProgressaoClerigo`, `getEstadoRecursosClerigo`, `getEstadoSubclassesClerigo`.

- [ ] **Step 2: Resolver imports e exports**

Run: `python scripts/verificar_extracao.py sheet` e colar o que ele imprimir.

- [ ] **Step 3: Validar**

Run: `python scripts/verificar_extracao.py sheet`
Esperado: saída limpa, código 0.

---

### Task 19: `sheet/classes/druida.js`

**Risk:** low — quatro funções.

**Files:**
- Create: `site/js/sheet/classes/druida.js`
- Modify: `site/js/pages/sheet.js`

**Interfaces:**
- Produces: `getProgressaoDruida()`, `getEstadoRecursosDruida()`, `consumirUsoFormaSelvagem(qtd)`, `recuperarUmUsoFormaSelvagem()`.

- [ ] **Step 1: Mover as declarações**

Funções: `getProgressaoDruida`, `getEstadoRecursosDruida`, `consumirUsoFormaSelvagem`, `recuperarUmUsoFormaSelvagem`.

- [ ] **Step 2: Resolver imports e exports**

Run: `python scripts/verificar_extracao.py sheet` e colar o que ele imprimir.

- [ ] **Step 3: Validar**

Run: `python scripts/verificar_extracao.py sheet`
Esperado: saída limpa, código 0.

---

### Task 20: `sheet/classes/feiticeiro.js`

**Risk:** low — quatro funções.

**Files:**
- Create: `site/js/sheet/classes/feiticeiro.js`
- Modify: `site/js/pages/sheet.js`

**Interfaces:**
- Produces: `getProgressaoFeiticeiro()`, `getEstadoRecursosFeiticeiro()`, `gastarPontosFeiticaria(qtd)`, `recuperarPontosFeiticaria(qtd)`.

- [ ] **Step 1: Mover as declarações**

Funções: `getProgressaoFeiticeiro`, `getEstadoRecursosFeiticeiro`, `gastarPontosFeiticaria`, `recuperarPontosFeiticaria`.

`sincronizarBonusPvDraconico` **não** vem para cá — vai para `hp-descanso.js` na Tarefa 28, junto com as outras duas sincronizações de PV, porque as três compartilham o mesmo mecanismo de ajuste do PV máximo.

- [ ] **Step 2: Resolver imports e exports**

Run: `python scripts/verificar_extracao.py sheet` e colar o que ele imprimir.

- [ ] **Step 3: Validar**

Run: `python scripts/verificar_extracao.py sheet`
Esperado: saída limpa, código 0.

---

### Task 21: `sheet/classes/guardiao.js`

**Risk:** low — duas funções.

**Files:**
- Create: `site/js/sheet/classes/guardiao.js`
- Modify: `site/js/pages/sheet.js`

**Interfaces:**
- Produces: `getProgressaoGuardiao()`, `getEstadoRecursosGuardiao()`.

- [ ] **Step 1: Mover as declarações**

Funções: `getProgressaoGuardiao`, `getEstadoRecursosGuardiao`.

- [ ] **Step 2: Resolver imports e exports**

Run: `python scripts/verificar_extracao.py sheet` e colar o que ele imprimir.

- [ ] **Step 3: Validar**

Run: `python scripts/verificar_extracao.py sheet`
Esperado: saída limpa, código 0.

---

### Task 22: `sheet/classes/guerreiro.js`

**Risk:** low — três funções.

**Files:**
- Create: `site/js/sheet/classes/guerreiro.js`
- Modify: `site/js/pages/sheet.js`

**Interfaces:**
- Produces: `getProgressaoGuerreiro()`, `getEstadoRecursosGuerreiro()`, `getCavaleiroMisticoConjuracao()`.

- [ ] **Step 1: Mover as declarações**

Funções: `getProgressaoGuerreiro`, `getEstadoRecursosGuerreiro`, `getCavaleiroMisticoConjuracao`.

- [ ] **Step 2: Resolver imports e exports**

Run: `python scripts/verificar_extracao.py sheet` e colar o que ele imprimir.

- [ ] **Step 3: Validar**

Run: `python scripts/verificar_extracao.py sheet`
Esperado: saída limpa, código 0.

---

### Task 23: `sheet/classes/ladino.js`

**Risk:** low — três funções.

**Files:**
- Create: `site/js/sheet/classes/ladino.js`
- Modify: `site/js/pages/sheet.js`

**Interfaces:**
- Produces: `getProgressaoLadino()`, `getEstadoRecursosLadino()`, `getTrapaceiroArcanoConjuracao()`.

- [ ] **Step 1: Mover as declarações**

Funções: `getProgressaoLadino`, `getEstadoRecursosLadino`, `getTrapaceiroArcanoConjuracao`.

- [ ] **Step 2: Resolver imports e exports**

Run: `python scripts/verificar_extracao.py sheet` e colar o que ele imprimir.

- [ ] **Step 3: Validar**

Run: `python scripts/verificar_extracao.py sheet`
Esperado: saída limpa, código 0.

---

### Task 24: `sheet/classes/mago.js`

**Risk:** low — uma função.

**Files:**
- Create: `site/js/sheet/classes/mago.js`
- Modify: `site/js/pages/sheet.js`

**Interfaces:**
- Produces: `getEstadoRecursosMago()`.

- [ ] **Step 1: Mover a declaração**

Função: `getEstadoRecursosMago`.

- [ ] **Step 2: Resolver imports e exports**

Run: `python scripts/verificar_extracao.py sheet` e colar o que ele imprimir.

- [ ] **Step 3: Validar**

Run: `python scripts/verificar_extracao.py sheet`
Esperado: saída limpa, código 0.

---

### Task 25: `sheet/classes/monge.js`

**Risk:** low — duas funções.

**Files:**
- Create: `site/js/sheet/classes/monge.js`
- Modify: `site/js/pages/sheet.js`

**Interfaces:**
- Produces: `getProgressaoMonge()`, `getEstadoRecursosMonge()`.

- [ ] **Step 1: Mover as declarações**

Funções: `getProgressaoMonge`, `getEstadoRecursosMonge`.

- [ ] **Step 2: Resolver imports e exports**

Run: `python scripts/verificar_extracao.py sheet` e colar o que ele imprimir.

- [ ] **Step 3: Validar**

Run: `python scripts/verificar_extracao.py sheet`
Esperado: saída limpa, código 0.

---

### Task 26: `sheet/classes/paladino.js`

**Risk:** low — duas funções.

**Files:**
- Create: `site/js/sheet/classes/paladino.js`
- Modify: `site/js/pages/sheet.js`

**Interfaces:**
- Produces: `getProgressaoPaladino()`, `getEstadoRecursosPaladino()`.

- [ ] **Step 1: Mover as declarações**

Funções: `getProgressaoPaladino`, `getEstadoRecursosPaladino`.

- [ ] **Step 2: Resolver imports e exports**

Run: `python scripts/verificar_extracao.py sheet` e colar o que ele imprimir.

- [ ] **Step 3: Validar**

Run: `python scripts/verificar_extracao.py sheet`
Esperado: saída limpa, código 0.

- [ ] **Step 4: Conferir as doze classes no navegador**

Abrir uma ficha de cada classe (ou pelo menos Bárbaro, Bruxo, Clérigo, Druida, Feiticeiro, Guerreiro, Ladino, Mago, Monge, Paladino, Guardião e Bardo) e conferir que a seção de recursos aparece igual ao site original: usos, contadores, botões de gastar e recuperar, e os modais próprios de Bruxo e Bárbaro.

---

### Task 27: `sheet/combate.js`

**Risk:** medium — 14 funções e as duas únicas globais `window.*` do arquivo.

**Files:**
- Create: `site/js/sheet/combate.js`
- Modify: `site/js/pages/sheet.js`

**Interfaces:**
- Produces: `getDeslocamentoFinal(baseDeslocamento)`, `getAtaquesPorAcao()`, `getModIniciativa()`, `calcVantagemDesvantagemPericia(nomePericia)`, `setupEventosVantagemDesvantagem()`, `forcaPrimordialAtiva()`, `ataqueImprudenteAtivo()`, `temArmaduraPesadaEquipada()`, `armaduraImpoeFurtividadeDesv()`, `ehBardoComSegredosMagicos()`, `getTruquesExtraEstiloLuta()`, `parseMetros(valor, fallback)`, `formatarMetros(valor)`, `addExtraVelocidade(extrasSet, tipo, metros, sufixo)`.

- [ ] **Step 1: Mover as declarações**

Funções: `ehBardoComSegredosMagicos`, `temArmaduraPesadaEquipada`, `armaduraImpoeFurtividadeDesv`, `calcVantagemDesvantagemPericia`, `getTruquesExtraEstiloLuta`, `parseMetros`, `formatarMetros`, `addExtraVelocidade`, `getDeslocamentoFinal`, `getAtaquesPorAcao`, `getModIniciativa`, `forcaPrimordialAtiva`, `ataqueImprudenteAtivo`, `setupEventosVantagemDesvantagem`.

Globais: `window.mostrarCalculoCarga`, `window.avisarSobrecargaDeslocamento`.

As duas atribuições a `window` são mantidas **exatamente** como estão — o HTML gerado usa `onclick` inline que depende delas. Mudá-las para listeners quebraria a tela.

- [ ] **Step 2: Resolver imports e exports**

Run: `python scripts/verificar_extracao.py sheet` e colar o que ele imprimir.

- [ ] **Step 3: Validar**

Run: `python scripts/verificar_extracao.py sheet`
Esperado: saída limpa, código 0.

- [ ] **Step 4: Verificar que as globais continuam registradas**

Abrir uma ficha, abrir o console do navegador e conferir `typeof window.mostrarCalculoCarga === 'function'` e `typeof window.avisarSobrecargaDeslocamento === 'function'`. Clicar no cálculo de carga e no aviso de sobrecarga para confirmar que os `onclick` inline continuam funcionando.

---

### Task 28: `sheet/hp-descanso.js`

**Risk:** medium — oito funções, inclui `restaurarHabilidades`, que toca recursos de todas as classes.

**Files:**
- Create: `site/js/sheet/hp-descanso.js`
- Modify: `site/js/pages/sheet.js`

**Interfaces:**
- Produces: `numberPickerHtml(id, valor, min, max, label)`, `setupNumberPicker(id)`, `setupEventosHP()`, `restaurarHabilidades(tipoDescanso)`, `setupEventosDescanso()`, `sincronizarBonusPvDraconico()`, `sincronizarBonusPvAnao()`, `sincronizarBonusPvVigoroso()`.

- [ ] **Step 1: Mover as declarações**

Funções: `sincronizarBonusPvDraconico`, `sincronizarBonusPvAnao`, `sincronizarBonusPvVigoroso`, `numberPickerHtml`, `setupNumberPicker`, `setupEventosHP`, `restaurarHabilidades`, `setupEventosDescanso`.

- [ ] **Step 2: Resolver imports e exports**

Run: `python scripts/verificar_extracao.py sheet` e colar o que ele imprimir. Este módulo vai importar de quase todas as 12 classes — `restaurarHabilidades` chama os recursos de cada uma.

- [ ] **Step 3: Validar**

Run: `python scripts/verificar_extracao.py sheet`
Esperado: saída limpa, código 0.

---

### Task 29: `sheet/habilidades.js`

**Risk:** high — 4.635 linhas em duas funções, o maior bloco único da refatoração.

**Files:**
- Create: `site/js/sheet/habilidades.js`
- Modify: `site/js/pages/sheet.js`

**Interfaces:**
- Produces: `renderFeatureItem(f, source)`, `setupEventosHabilidades()`, `detectarUsosMaximos(descricao)`, `detectarSubHabilidades(descricao)`.

- [ ] **Step 1: Mover as declarações**

Funções: `detectarUsosMaximos`, `detectarSubHabilidades`, `renderFeatureItem`, `setupEventosHabilidades`.

Estas duas funções grandes **não** são quebradas por classe. A spec §5.3 explica por quê: as flags por classe são calculadas no topo e costuradas dentro de um único template literal, de modo que separá-las exigiria reescrever a montagem do HTML — proibido pelo GC1.

- [ ] **Step 2: Resolver imports e exports**

Run: `python scripts/verificar_extracao.py sheet` e colar o que ele imprimir. Este é o módulo com mais imports do plano: ele usa recursos das 12 classes, magias, maestrias, HP e descanso.

- [ ] **Step 3: Validar**

Run: `python scripts/verificar_extracao.py sheet`
Esperado: saída limpa, código 0.

- [ ] **Step 4: Conferir habilidades, HP e descansos no navegador**

Abrir uma ficha, aplicar dano, aplicar cura, adicionar PV temporário, gastar dados de vida, fazer descanso curto e descanso longo, e usar pelo menos três habilidades ativas de classes diferentes. Comparar cada valor com o do site original.

---

### Task 30: `sheet/migracoes.js`

**Risk:** medium — 12 migrações que rodam na abertura da ficha; um erro aqui corrompe personagens salvos.

**Files:**
- Create: `site/js/sheet/migracoes.js`
- Modify: `site/js/pages/sheet.js`

**Interfaces:**
- Produces: `migrarMagiasDominio()`, `migrarSlotsMagiaLivre()`, `migrarMagiasSemprePreparadas()`, `migrarTruquesEspecie()`, `migrarMagiasLegadoEspecie()`, `obterTruquesEspecieFicha(especie, tracosEscolhidos)`, `migrarEscolhasClasseLegadas()`, `migrarNomePericiaLidarAnimais()`, `migrarTalentoVersatilHumano()`, `migrarPericiaEspecie()`, `migrarPericiasEspecie()`, `migrarPericiasTalentos()`.

- [ ] **Step 1: Mover as declarações**

Funções: `migrarMagiasDominio`, `migrarSlotsMagiaLivre`, `migrarMagiasSemprePreparadas`, `migrarTruquesEspecie`, `migrarMagiasLegadoEspecie`, `obterTruquesEspecieFicha`, `migrarEscolhasClasseLegadas`, `migrarNomePericiaLidarAnimais`, `migrarTalentoVersatilHumano`, `migrarPericiaEspecie`, `migrarPericiasEspecie`, `migrarPericiasTalentos`.

`salvarEstadoDetails` e `restaurarEstadoDetails` **não** vêm para cá, apesar de ficarem logo ao lado no original: elas guardam o estado aberto/fechado dos `<details>` e pertencem a `ficha.js` (Tarefa 31).

- [ ] **Step 2: Resolver imports e exports**

Run: `python scripts/verificar_extracao.py sheet` e colar o que ele imprimir.

- [ ] **Step 3: Validar**

Run: `python scripts/verificar_extracao.py sheet`
Esperado: saída limpa, código 0.

- [ ] **Step 4: Conferir com uma ficha antiga**

Abrir uma ficha criada antes desta refatoração — de preferência a mais antiga disponível — e confirmar que ela carrega, que os campos migrados aparecem corretos e que salvar não altera nada além do esperado. Comparar com a mesma ficha no site original.

---

### Task 31: `sheet/ficha.js`

**Risk:** high — `renderFichaCompleta` monta a página inteira e chama praticamente todos os módulos criados até aqui.

**Files:**
- Create: `site/js/sheet/ficha.js`
- Modify: `site/js/pages/sheet.js`

**Interfaces:**
- Consumes: todas as funções `renderSecao*` e `setupEventos*` dos módulos anteriores.
- Produces: `renderFichaCompleta()`, `salvarEstadoDetails()`, `restaurarEstadoDetails(estado)`.

- [ ] **Step 1: Mover as declarações**

Funções: `salvarEstadoDetails`, `restaurarEstadoDetails`, `renderFichaCompleta`.

- [ ] **Step 2: Resolver imports e exports**

Run: `python scripts/verificar_extracao.py sheet` e colar o que ele imprimir. Este módulo terá a maior lista de imports do plano, e fechará os ciclos com magias, inventário, condições, talentos e habilidades. Registrar os ciclos em `PERGUNTAS-PARA-REVISAO.txt`.

- [ ] **Step 3: Validar**

Run: `python scripts/verificar_extracao.py sheet`
Esperado: saída limpa, código 0.

---

### Task 32: Coordenador `pages/sheet.js`

**Risk:** medium — o que sobra tem de bater com o contrato da rota.

**Files:**
- Modify: `site/js/pages/sheet.js`

**Interfaces:**
- Produces: `export async function renderSheet(container, charId)` — mesma assinatura de sempre, chamada por `site/js/app.js`.

- [ ] **Step 1: Conferir o que restou**

Devem restar apenas: a variável `_syncSubscribed`, e as funções `renderSheet`, `_textoStatusSync`, `_renderSyncIndicadorHtml`, `_atualizarIndicadorSync`. Mais os imports.

- [ ] **Step 2: Limpar imports órfãos**

Remover do topo do arquivo apenas as linhas `import` cujos símbolos não são mais usados por nenhuma das quatro funções restantes. O verificador lista quais no relatório de símbolos.

- [ ] **Step 3: Validar tamanho e integridade**

Run: `python scripts/verificar_extracao.py sheet`
Esperado: `224/224 presentes`, `223 idênticos + 1 exceção declarada (renderSheet)`, saída 0.

Run: `wc -l site/js/pages/sheet.js`
Esperado: 300 ou menos.

- [ ] **Step 4: Conferir que nenhum arquivo fora do escopo mudou**

Run: `diff -r --exclude=.git ../D-D_2024/dados dados` — esperado: sem saída.
Run: `diff ../D-D_2024/site/css/app.css site/css/app.css` — esperado: sem saída.
Run: `diff ../D-D_2024/site/index.html site/index.html` — esperado: sem saída.
Run: `diff ../D-D_2024/site/sw.js site/sw.js` — esperado: sem saída.

- [ ] **Step 5: Conferência visual completa da ficha**

Percorrer a lista da spec §6.2 relativa à ficha, com as duas URLs lado a lado: HP e dados de vida, descansos, habilidades ativas, magias e espaços, grimório, inventário e drag-and-drop, moedas e compras, condições, defesas e sentidos, talentos, subir de nível, edição de campos, detalhes pessoais, impressão, PDF, importar e exportar, e recarregar offline.

---

## Marco 3 — `creator.js`

### Task 33: `creator/comum.js`

**Risk:** low — tabelas de dados e seis helpers, todos sem estado.

**Files:**
- Create: `site/js/creator/comum.js`
- Modify: `site/js/pages/creator.js`

**Interfaces:**
- Produces: `ESPECIES_TRACOS_ESCOLHA`, `FERRAMENTAS_TODAS`, `INSTRUMENTOS_MUSICAIS`, `FERRAMENTAS_ARTESAO`, `NIVEL_SUBCLASSE`, `CLASSES_ESCOLHAS`, `ANTECEDENTES_ESCOLHAS`, `KITS_EXPANSAO`, `obterTruquesEspecie(especie, tracosEscolhidos)`, `renderDescricaoTalento(td)`, `renderEscolhasTalentoHtml(talentoNome, contexto)`, `talentoExigeEscolhas(nome)`, `talentoNumEscolhas(nome)`, `configurarSelectsExclusivos(seletor)`.

- [ ] **Step 1: Mover as declarações**

Constantes: `ESPECIES_TRACOS_ESCOLHA`, `FERRAMENTAS_TODAS`, `INSTRUMENTOS_MUSICAIS`, `FERRAMENTAS_ARTESAO`, `NIVEL_SUBCLASSE`, `CLASSES_ESCOLHAS`, `ANTECEDENTES_ESCOLHAS`, `KITS_EXPANSAO`.
Funções: `obterTruquesEspecie`, `renderDescricaoTalento`, `renderEscolhasTalentoHtml`, `talentoExigeEscolhas`, `talentoNumEscolhas`, `configurarSelectsExclusivos`.

`STEPS` **não** vem para cá — vai para `wizard.js` na Tarefa 41.

- [ ] **Step 2: Resolver imports e exports**

Run: `python scripts/verificar_extracao.py creator` e colar o que ele imprimir.

- [ ] **Step 3: Validar**

Run: `python scripts/verificar_extracao.py creator`
Esperado: saída limpa, código 0.

---

### Task 34: `creator/passo-detalhes.js`

**Risk:** low — quatro funções e uma tabela.

**Files:**
- Create: `site/js/creator/passo-detalhes.js`
- Modify: `site/js/pages/creator.js`

**Interfaces:**
- Produces: `renderStepDetalhes(el)`, `coletarDetalhes()`, `obterRegraIdiomasAtual()`, `sanitizarIdiomasSelecionados()`.

- [ ] **Step 1: Mover as declarações**

Constante: `IDIOMAS_COMUNS_2024`.
Funções: `obterRegraIdiomasAtual`, `sanitizarIdiomasSelecionados`, `renderStepDetalhes`, `coletarDetalhes`.

- [ ] **Step 2: Resolver imports e exports**

Run: `python scripts/verificar_extracao.py creator` e colar o que ele imprimir.

- [ ] **Step 3: Validar**

Run: `python scripts/verificar_extracao.py creator`
Esperado: saída limpa, código 0.

---

### Task 35: `creator/passo-magias.js`

**Risk:** medium — 12 funções, inclui o subsistema multi-instância de Iniciado em Magia.

**Files:**
- Create: `site/js/creator/passo-magias.js`
- Modify: `site/js/pages/creator.js`

**Interfaces:**
- Produces: `renderStepMagias(el)`, `toggleMagia(nome, circulo, isTruque, maxTruques, maxPreparadas, magoNivel1, limiteGrimorio)`, `atualizarContadoresMagia(maxTruques, maxPrep, magoNivel1, limiteGrimorio)`, `mostrarDetalheMagia(nome, circulo)`, `_sincronizarInstanciasIM()`, `_renderIniciadoEmMagia(container, aoMudar)`, `_bindInstanciaIM(container, idx, aoMudar)`.

- [ ] **Step 1: Mover as declarações**

Funções: `renderStepMagias`, `_nomeBaseTalento`, `_listasFixasIM`, `_contarInstanciasIM`, `_sincronizarInstanciasIM`, `_renderIniciadoEmMagia`, `_nomesJaEscolhidosIM`, `_outrasInstanciasIMMagia`, `_bindInstanciaIM`, `toggleMagia`, `atualizarContadoresMagia`, `mostrarDetalheMagia`.

- [ ] **Step 2: Resolver imports e exports**

Run: `python scripts/verificar_extracao.py creator` e colar o que ele imprimir.

- [ ] **Step 3: Validar**

Run: `python scripts/verificar_extracao.py creator`
Esperado: saída limpa, código 0.

---

### Task 36: `creator/passo-equipamento.js`

**Risk:** medium — 16 funções, o maior módulo do criador, com drag-and-drop e quatro seletores.

**Files:**
- Create: `site/js/creator/passo-equipamento.js`
- Modify: `site/js/pages/creator.js`

**Interfaces:**
- Produces: `renderStepEquipamento(el)`, `renderListaInventario()`, `renderItemInventario(item, idx)`, `setupEventosInventario(containerEl)`, `setupDragDropInventario(containerEl)`, `adicionarItensEquipamentoInicial(opcao, tipoOrigem, nomeOrigem)`, `parseEquipamentoOpcoes(texto)`, `temProficienciaArma(arma)`, `temProficienciaArmadura(armadura)`, `atendeRequisitoForca(armadura)`, `badgeProficiencia(proficiente)`, `mostrarSeletorArma()`, `mostrarSeletorArmadura()`, `mostrarSeletorItem()`, `mostrarFormCustomItem()`, `mostrarDetalheItem(item)`.

- [ ] **Step 1: Mover as declarações**

Funções: `temProficienciaArma`, `temProficienciaArmadura`, `atendeRequisitoForca`, `badgeProficiencia`, `parseEquipamentoOpcoes`, `adicionarItensEquipamentoInicial`, `renderStepEquipamento`, `renderListaInventario`, `renderItemInventario`, `setupEventosInventario`, `setupDragDropInventario`, `mostrarSeletorArma`, `mostrarSeletorArmadura`, `mostrarSeletorItem`, `mostrarFormCustomItem`, `mostrarDetalheItem`.

- [ ] **Step 2: Resolver imports e exports**

Run: `python scripts/verificar_extracao.py creator` e colar o que ele imprimir.

- [ ] **Step 3: Validar**

Run: `python scripts/verificar_extracao.py creator`
Esperado: saída limpa, código 0.

---

### Task 37: `creator/passo-atributos.js`

**Risk:** medium — nove funções e os quatro métodos de distribuição.

**Files:**
- Create: `site/js/creator/passo-atributos.js`
- Modify: `site/js/pages/creator.js`

**Interfaces:**
- Produces: `renderStepAtributos(el)`, `renderDistribuicaoInline()`, `renderDistribuicaoAtributos(atributos)`, `rolar4d6()`, `renderRolagem4d6(el)`, `renderStandardArray(el)`, `renderPointBuy(el)`, `renderManual(el)`, `renderPericiasSeletor()`, `DISTRIBUICOES_SUGERIDAS`.

- [ ] **Step 1: Mover as declarações**

Constante: `DISTRIBUICOES_SUGERIDAS`.
Funções: `renderDistribuicaoInline`, `renderDistribuicaoAtributos`, `renderStepAtributos`, `rolar4d6`, `renderRolagem4d6`, `renderStandardArray`, `renderPointBuy`, `renderManual`, `renderPericiasSeletor`.

`renderDistribuicaoInline` e `renderDistribuicaoAtributos` ficam fisicamente no meio do passo de antecedente no original, mas pertencem a atributos por assunto. Registrar em `PERGUNTAS-PARA-REVISAO.txt`.

- [ ] **Step 2: Resolver imports e exports**

Run: `python scripts/verificar_extracao.py creator` e colar o que ele imprimir.

- [ ] **Step 3: Validar**

Run: `python scripts/verificar_extracao.py creator`
Esperado: saída limpa, código 0.

---

### Task 38: `creator/passo-antecedente.js`

**Risk:** low — três funções.

**Files:**
- Create: `site/js/creator/passo-antecedente.js`
- Modify: `site/js/pages/creator.js`

**Interfaces:**
- Produces: `renderStepAntecedente(el)`, `abrirPopupAntecedente(nome)`, `_reconstruirTalentosBase()`.

- [ ] **Step 1: Mover as declarações**

Funções: `renderStepAntecedente`, `_reconstruirTalentosBase`, `abrirPopupAntecedente`.

- [ ] **Step 2: Resolver imports e exports**

Run: `python scripts/verificar_extracao.py creator` e colar o que ele imprimir.

- [ ] **Step 3: Validar**

Run: `python scripts/verificar_extracao.py creator`
Esperado: saída limpa, código 0.

---

### Task 39: `creator/passo-especie.js`

**Risk:** low — duas funções, uma delas grande.

**Files:**
- Create: `site/js/creator/passo-especie.js`
- Modify: `site/js/pages/creator.js`

**Interfaces:**
- Produces: `renderStepEspecie(el)`, `abrirPopupEspecie(nome)`.

- [ ] **Step 1: Mover as declarações**

Funções: `renderStepEspecie`, `abrirPopupEspecie`.

- [ ] **Step 2: Resolver imports e exports**

Run: `python scripts/verificar_extracao.py creator` e colar o que ele imprimir.

- [ ] **Step 3: Validar**

Run: `python scripts/verificar_extracao.py creator`
Esperado: saída limpa, código 0.

---

### Task 40: `creator/passo-classe.js`

**Risk:** low — duas funções.

**Files:**
- Create: `site/js/creator/passo-classe.js`
- Modify: `site/js/pages/creator.js`

**Interfaces:**
- Produces: `renderStepClasse(el)`, `abrirPopupClasse(nome)`.

- [ ] **Step 1: Mover as declarações**

Funções: `renderStepClasse`, `abrirPopupClasse`.

- [ ] **Step 2: Resolver imports e exports**

Run: `python scripts/verificar_extracao.py creator` e colar o que ele imprimir.

- [ ] **Step 3: Validar**

Run: `python scripts/verificar_extracao.py creator`
Esperado: saída limpa, código 0.

---

### Task 41: `creator/wizard.js`

**Risk:** high — dono do estado do criador e da montagem do shell; é onde o layout quebrou na tentativa anterior.

**Files:**
- Create: `site/js/creator/wizard.js`
- Modify: `site/js/pages/creator.js`

**Interfaces:**
- Produces: `STEPS`, `personagem`, `stepAtual`, `dadosCache`, `containerRef`, `definirPersonagem(valor)`, `definirStep(valor)`, `definirDadosCache(valor)`, `definirContainer(valor)`, `renderWizard()`, `renderStep(el)`, `avancar()`, `validarStep()`, `validarFinal()`, `finalizar()`, `limparDadosDoPasso(stepIndex)`, `limparPassosPosteriores(stepAlvo)`.

- [ ] **Step 1: Mover as declarações**

Constante: `STEPS`.
Variáveis: `personagem`, `stepAtual`, `dadosCache`, `containerRef` — as quatro passam a `export let`.
Funções: `limparDadosDoPasso`, `limparPassosPosteriores`, `renderWizard`, `renderStep`, `avancar`, `validarStep`, `validarFinal`, `finalizar`.

`renderWizard` e `avancar` continuam reatribuindo `stepAtual` diretamente — elas moram no mesmo módulo, então nenhuma vira setter.

- [ ] **Step 2: Acrescentar os quatro setters ao fim do módulo**

```js
/** Define o personagem em construção. Chamado só por renderCreator. */
export function definirPersonagem(valor) { personagem = valor; }

/** Define o passo atual do wizard. Chamado só por renderCreator. */
export function definirStep(valor) { stepAtual = valor; }

/** Define o cache de dados dos passos. Chamado só por renderCreator. */
export function definirDadosCache(valor) { dadosCache = valor; }

/** Define o contêiner raiz do criador. Chamado só por renderCreator. */
export function definirContainer(valor) { containerRef = valor; }
```

- [ ] **Step 3: Verificar o markup do shell contra o original**

Este é o passo que a tentativa anterior errou. Conferir que `renderWizard` continua emitindo exatamente:

```
<div class="wizard-steps wizard-steps-sticky">
<div class="wizard-step ${ativo} ${feito}" data-step="${i}">
<div class="wizard-step-num">
<div class="wizard-step-label">
<div id="wizard-content" class="wizard-content-area">
<div class="wizard-nav-fixed">
<div class="wizard-nav-inner">
botão "← Anterior"   (&#8592; Anterior)
botão "Próximo →"    (Próximo &#8594;)
botão "Criar Personagem ✓"  (Criar Personagem &#10003;)
```

Run: `diff <(sed -n '/^function renderWizard/,/^}/p' scripts/baseline/creator.js) <(sed -n '/^export function renderWizard/,/^}/p' site/js/creator/wizard.js)`
Esperado: apenas a linha da assinatura difere (`export ` acrescentado). Nenhuma outra linha.

- [ ] **Step 4: Resolver imports e exports**

Run: `python scripts/verificar_extracao.py creator` e colar o que ele imprimir.

- [ ] **Step 5: Validar**

Run: `python scripts/verificar_extracao.py creator`
Esperado: saída limpa, código 0.

---

### Task 42: Coordenador `pages/creator.js`

**Risk:** medium — as quatro linhas de setter e o contrato da rota.

**Files:**
- Modify: `site/js/pages/creator.js`

**Interfaces:**
- Produces: `export async function renderCreator(container)` — mesma assinatura de sempre, chamada por `site/js/app.js`.

- [ ] **Step 1: Ajustar as quatro atribuições em `renderCreator`**

Trocar exatamente estas quatro linhas — e **somente** estas:

```js
containerRef = container;             →  definirContainer(container);
personagem = criarPersonagemVazio();  →  definirPersonagem(criarPersonagemVazio());
dadosCache = {};                      →  definirDadosCache({});
stepAtual = 0;                        →  definirStep(0);
```

Gravar o bloco resultante de `renderCreator` em `scripts/excecoes/renderCreator.js`.

- [ ] **Step 2: Limpar imports órfãos**

Remover do topo apenas as linhas `import` cujos símbolos não são mais usados por `renderCreator`.

- [ ] **Step 3: Validar tamanho e integridade**

Run: `python scripts/verificar_extracao.py creator`
Esperado: `78/78 presentes`, `77 idênticos + 1 exceção declarada (renderCreator)`, saída 0.

Run: `wc -l site/js/pages/creator.js`
Esperado: 60 ou menos.

- [ ] **Step 4: Conferência visual completa do criador**

Criar dois personagens do zero com as duas URLs lado a lado — um não conjurador (Guerreiro ou Bárbaro) e um conjurador (Mago ou Clérigo) — passando pelos sete passos. Conferir em cada passo: a barra de passos no topo, a barra de navegação **fixa no rodapé**, os rótulos `← Anterior`, `Próximo →` e `Criar Personagem ✓`, e o conteúdo de cada tela. Ao final, abrir a ficha criada e comparar com a do site original.

---

## Marco 4 — Encerramento

### Task 43: Limpeza e documentação

**Risk:** low — remoção de andaimes e atualização de texto.

**Files:**
- Delete: `scripts/baseline/sheet.js`, `scripts/baseline/creator.js`, `scripts/excecoes/`
- Modify: `README.md`
- Modify: `scripts/verificar_extracao.py`

- [ ] **Step 1: Rodar a validação final completa**

Run: `python scripts/verificar_extracao.py tudo`
Esperado: `224/224` e `78/78`, apenas as 2 exceções declaradas, 0 símbolos sem import, saída 0.

- [ ] **Step 2: Provar que nada fora do escopo mudou**

```
diff -r ../D-D_2024/dados dados
diff -r ../D-D_2024/site/css site/css
diff -r ../D-D_2024/site/img site/img
diff ../D-D_2024/site/index.html site/index.html
diff ../D-D_2024/site/sw.js site/sw.js
diff ../D-D_2024/site/manifest.json site/manifest.json
diff ../D-D_2024/index.html index.html
for f in app auth db store sync utils moedas dados-classes levelup levelup-ui \
         levelup-cards levelup-flow levelup-validations talentos-effects \
         regras-cobertura ficha-edicoes ficha-edicao-validacoes manobras-ui; do
  diff "../D-D_2024/site/js/$f.js" "site/js/$f.js"
done
diff ../D-D_2024/site/js/pages/home.js site/js/pages/home.js
```

Esperado: nenhuma saída em nenhum dos comandos.

- [ ] **Step 3: Conferir os tamanhos finais**

Run: `find site/js/sheet site/js/creator site/js/pages -name '*.js' | xargs wc -l | sort -rn`
Esperado: `habilidades.js` em torno de 4.640 e `magias.js` em torno de 2.270 como os dois maiores; todos os demais abaixo de 2.100; `pages/sheet.js` ≤ 300 e `pages/creator.js` ≤ 60.

- [ ] **Step 4: Remover os andaimes**

Apagar `scripts/baseline/` e `scripts/excecoes/`. Ajustar `verificar_extracao.py` para, na ausência do baseline, rodar apenas as checagens de símbolo e duplicação, e imprimir um aviso claro de que a checagem de integridade exige o baseline (recuperável com `git show <commit-do-marco-1>:scripts/baseline/sheet.js`).

- [ ] **Step 5: Atualizar o README**

Acrescentar uma seção descrevendo a estrutura de `site/js/sheet/` e `site/js/creator/`, com uma linha por módulo, e apontando para esta spec e este plano.

- [ ] **Step 6: Revisar o registro de dúvidas**

Ler `PERGUNTAS-PARA-REVISAO.txt` de ponta a ponta e apresentar o conteúdo ao usuário para decisão sobre cada item registrado.
