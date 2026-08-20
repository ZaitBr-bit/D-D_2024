# Triagem de issues do GitHub

Como sair de *"abriram uma issue"* até *"causa raiz identificada e confrontada
com o livro"* sem redescobrir o caminho toda vez.

Este documento cobre a **investigação**. A correção em si segue o fluxo normal
do repositório — oráculo vermelho, correção, versão, notas — e está resumida no
[passo 6](#passo-6--corrigir).

---

## Sumário

- [Ferramentas: o que existe nesta máquina](#ferramentas-o-que-existe-nesta-máquina)
- [Passo 1 — Puxar a issue](#passo-1--puxar-a-issue)
- [Passo 2 — Baixar as imagens anexadas](#passo-2--baixar-as-imagens-anexadas)
- [Passo 3 — As quatro camadas](#passo-3--as-quatro-camadas)
- [Passo 4 — Achar a causa raiz no código](#passo-4--achar-a-causa-raiz-no-código)
- [Passo 5 — Oráculo vermelho antes da correção](#passo-5--oráculo-vermelho-antes-da-correção)
- [Passo 6 — Corrigir](#passo-6--corrigir)
  - [A mensagem de commit que fecha a issue](#a-mensagem-de-commit-que-fecha-a-issue)
- [Modelo de laudo](#modelo-de-laudo)
- [Armadilhas conhecidas](#armadilhas-conhecidas)

---

## Ferramentas: o que existe nesta máquina

| Ferramenta | Situação | Consequência |
|---|---|---|
| `gh` (GitHub CLI) | **não instalado** | Use a API REST pública com `curl` — o repositório é público, não precisa de token |
| `curl` | disponível no Git Bash | é o transporte para tudo abaixo |
| `python` | disponível | usado para ler o JSON da API e os JSON de `dados/` |
| `Informacoes Separadas/` | **local, fora do Git** (`.gitignore:98`) | o livro só existe na máquina de quem tem a pasta; sem ela não dá para confrontar regra |

Repositório de produção: `ZaitBr-bit/D-D_2024` (o remoto `origin`). O
`BaseTeste` foi descontinuado — não abra issue nem procure issue lá.

> **Windows:** prefixe qualquer `python -c` que imprima acentos com
> `PYTHONIOENCODING=utf-8`. Sem isso o `print` estoura em `UnicodeEncodeError`
> ou devolve `Ã§`/`�` no lugar dos acentos, e você perde tempo achando que o
> dado está corrompido quando o corrompido é o terminal.

---

## Passo 1 — Puxar a issue

Defina a variável uma vez e reaproveite:

```bash
REPO=ZaitBr-bit/D-D_2024
N=19          # número da issue
```

**Listar as abertas:**

```bash
curl -s "https://api.github.com/repos/$REPO/issues?state=open&per_page=50" \
  | PYTHONIOENCODING=utf-8 python -c "
import json,sys
for i in json.load(sys.stdin):
    if 'pull_request' in i: continue          # a API mistura PRs com issues
    print(i['number'], '|', i['state'], '|', i['title'], '|', i['user']['login'])
"
```

**Ler uma issue com os comentários** (o comentário costuma trazer a metade que
falta do relato — na #19 foi ele que revelou que o personagem estava no nível
20):

```bash
mkdir -p /tmp/issue && cd /tmp/issue
curl -s "https://api.github.com/repos/$REPO/issues/$N" -o i.json
curl -s "https://api.github.com/repos/$REPO/issues/$N/comments" -o c.json
PYTHONIOENCODING=utf-8 python -c "
import json
d=json.load(open('i.json',encoding='utf-8'))
print('#%s [%s] %s' % (d['number'], d['state'], d['title']))
print('autor:', d['user']['login'], '| criada:', d['created_at'])
print('labels:', ', '.join(l['name'] for l in d['labels']))
print('-'*60); print(d['body'])
for c in json.load(open('c.json',encoding='utf-8')):
    print('-'*60); print('COMENTÁRIO —', c['user']['login'], c['created_at'])
    print(c['body'])
"
```

O corpo vem no formato do [template de bug](../.github/ISSUE_TEMPLATE/bug.yml),
com estas seções fixas — vale ler todas antes de concluir qualquer coisa:

| Seção | Para que serve na triagem |
|---|---|
| **Versão do app** | confirme contra `VERSAO_ATUAL` em `site/js/versao.js`; se for antiga, cheque se já foi corrigido |
| **Onde aconteceu** | aponta o módulo (ver [passo 4](#passo-4--achar-a-causa-raiz-no-código)) |
| **O que você fez / esperava / aconteceu** | frequentemente vêm como **imagem**, não texto — ver passo 2 |
| **Aparelho e navegador** | só importa se o sintoma for de layout ou de PWA/cache |
| **É uma regra aplicada errado?** | quando preenchido, já entrega qual regra confrontar no livro |

---

## Passo 2 — Baixar as imagens anexadas

O jogador quase sempre cola print em vez de escrever. As imagens ficam em
`https://github.com/user-attachments/assets/<uuid>` e, em repositório público,
**baixam sem autenticação**. Extraia os UUIDs do corpo e puxe todas:

```bash
PYTHONIOENCODING=utf-8 python -c "
import json,re
d=json.load(open('i.json',encoding='utf-8'))
texto=d['body'] or ''
try: texto+= ''.join((c['body'] or '') for c in json.load(open('c.json',encoding='utf-8')))
except FileNotFoundError: pass
for u in dict.fromkeys(re.findall(r'user-attachments/assets/([0-9a-fA-F-]{36})', texto)):
    print(u)
" > uuids.txt

i=1; while read u; do
  curl -sL "https://github.com/user-attachments/assets/$u" -o "img$i.png" \
       -w "img$i %{http_code} %{content_type} %{size_download}\n"
  i=$((i+1))
done < uuids.txt
```

Confira o `content_type` na saída: `image/png` ou `image/jpeg` significa
sucesso. `text/html` significa que veio a página de login — sinal de
repositório privado ou UUID errado.

Depois é só **abrir cada imagem e ler**. Elas costumam responder sozinhas o que
o texto não diz: na #19 o print mostrava `DES 20 / SAB 18` numa ficha de nível
20, o que fechou o diagnóstico antes de qualquer teste.

---

## Passo 3 — As quatro camadas

Este é o coração da triagem. Um relato de regra errada pode nascer em quatro
lugares diferentes, e **cada um tem um conserto diferente**. Percorra na ordem;
a primeira camada que divergir é a culpada.

| # | Camada | Onde mora | Como conferir |
|---|---|---|---|
| 1 | **Livro** | `Informacoes Separadas/*.md` | `grep -n` pelo nome da característica/magia/talento |
| 2 | **Dado do app** | `dados/**/*.json` | leia o campo `descricao` do item correspondente |
| 3 | **Código** | `site/js/**` | existe alguma implementação? o efeito é aplicado? |
| 4 | **Tela** | o print da issue | o que o jogador viu de fato |

Se 1 ≠ 2, é erro de extração → conserto no JSON (e possivelmente no
`scripts/verificar_extracao.py`). Se 1 = 2 mas o código não faz nada, é
**funcionalidade ausente** — o texto certo está sendo exibido e nada o executa,
que é o caso mais traiçoeiro porque a ficha *parece* correta.

### Onde procurar cada tipo de regra no livro

| Assunto | Arquivo |
|---|---|
| Característica de classe ou subclasse | `Informacoes Separadas/Classes.md` |
| Talento | `Informacoes Separadas/Talentos.md` |
| Magia (círculo, escola, listas) | `Informacoes Separadas/Magias.md` |
| Traço de espécie | `Informacoes Separadas/Espécies.md` |
| Antecedente | `Informacoes Separadas/Antecedente.md` |
| Item, arma, armadura | `Informacoes Separadas/Equipamento.md` |
| Condição, ação, definição | `Informacoes Separadas/Abreviações e Definição de Regras.md` |

```bash
cd "Informacoes Separadas"
grep -n "Corpo e Mente" Classes.md                    # acha o cabeçalho
sed -n '/### Nível 20: Corpo e Mente/,/^#/p' Classes.md   # lê o trecho inteiro
```

### Conferir a camada 2 sem se afogar

Os JSON de classe têm um campo `texto_completo` com o **capítulo inteiro numa
única linha**. Um `grep` ingênuo devolve 50 KB e não ajuda em nada. Leia o
array estruturado com Python:

```bash
PYTHONIOENCODING=utf-8 python -c "
import json
d=json.load(open('dados/classes/monge.json',encoding='utf-8'))
for c in d['caracteristicas']:
    if c['nome']=='Corpo e Mente': print(c['nivel'], '|', c['descricao'][:400])
"
```

Magias — círculo, escola e listas de classe:

```bash
PYTHONIOENCODING=utf-8 python -c "
import json
for m in json.load(open('dados/magias/_indice.json',encoding='utf-8')):
    if 'Marca do Ca' in m['nome']:
        print(m['nome'], '|', m['circulo'], '|', m['escola'], '|', m['classes'])
"
```

### Confirme que a escolha do jogador era legal

Antes de acusar o app, confira se o que o jogador fez o livro permite. Na #20 o
talento pedia *"magia de 1º círculo da escola Adivinhação ou Encantamento"* e o
jogador escolheu **Marca do Caçador** — que é da lista do Guardião, mas o
talento **não restringe por classe**, só por círculo e escola. Escolha legal,
bug real. Se a escolha fosse ilegal, o bug seria outro: o seletor não deveria
tê-la oferecido.

---

## Passo 4 — Achar a causa raiz no código

Comece pelo campo **"Onde aconteceu"** da issue:

| "Onde aconteceu" | Comece por |
|---|---|
| Ficha do personagem | `site/js/sheet/<assunto>.js` — o corte é por assunto (magias, combate, talentos…) |
| Subida de nível | `site/js/levelup.js` (aplicação), `levelup-ui.js` (telas), `regras-cobertura.js` (efeitos de talento) |
| Criação de personagem | `site/js/creator/passo-*.js` |
| Magias / grimório | `sheet/magias.js`, `sheet/grimorio.js`, `regras-origens-magia.js` |
| Inventário / equipamento | `sheet/inventario.js`, `itens-seletor.js` |
| PDF ou impressão | `sheet/pdf.js`, `sheet/impressao.js` |
| Login / sincronização | `auth.js`, `sync.js`, `db.js` |

Depois faça **a pergunta que mais economiza tempo**:

```bash
grep -rn "Nome Exato da Característica" site/js --include=*.js
```

**Zero ocorrências em `site/js/` é a resposta.** Significa que a regra existe no
dado (por isso a ficha mostra o texto) e ninguém a implementou. Foi exatamente
o que aconteceu na #19: `"Corpo e Mente"` aparecia em `dados/classes/monge.json`
e em `testes/regras/catalogo/`, e em lugar nenhum do código.

Se houver ocorrências, siga o dado ao contrário — da tela para a origem:

1. O valor chega ao objeto do personagem? (`char.magias_preparadas`, `char.atributos`…)
2. O render é chamado? Procure o **portão de renderização** — um `? render() : ''`
   condicional. Foi a causa da #20: a seção de Magias só era montada para
   conjuradores, então as magias de talento existiam no personagem e nunca
   apareciam.
3. Só então investigue o cálculo em si.

> Portões de renderização condicionais são o defeito mais frequente aqui, e o
> mais invisível: nada falha, nada dá erro, a seção simplesmente não existe.
> Ao encontrar um, **liste todas as origens que ele deveria aceitar** — se
> `tocado_por_fadas` faltava, é bem provável que `conjurador_ritualista`,
> `telecinetico` e `especie_legado` também faltassem. Um relato, uma família
> de bugs.

---

## Passo 5 — Oráculo vermelho antes da correção

**Conserte o que mede antes de medir.** Nenhuma correção entra sem um teste que
falhe *antes* dela — se o teste novo já nasce verde, ele não está medindo o que
você acha que mede.

| Tipo de defeito | Onde vai o teste |
|---|---|
| Regra de negócio (efeito não aplicado, valor errado) | `testes/regras/unidade/*.test.mjs` |
| Algo que aparece ou some da tela | `testes/e2e/regras/*.spec.mjs` — **com clique de verdade** |
| Divergência de extração (dado ≠ livro) | `scripts/verificar_extracao.py` ou o catálogo em `testes/regras/catalogo/` |

```bash
cd testes/e2e
npm run test:regras:unidade      # node --test ../regras/unidade/*.test.mjs
npm run test:regras:e2e          # playwright, specs de regra
npm test                         # paridade (não bloqueia correção de bug)
```

Se o oráculo existente **deveria** ter pego o bug e não pegou, o oráculo também
é defeito. Na #19 o catálogo classificava "Corpo e Mente" apenas como
`ativa: false, base: 'ausencia-de-custo'` — verificava a *classificação* da
característica, nunca o *efeito mecânico*. Nenhum teste poderia falhar. Anote
isso no laudo: são dois consertos, não um.

---

## Passo 6 — Corrigir

O fluxo normal do repositório, sem novidade:

1. Correção mínima, **uma causa raiz por vez** — nada de "já que estou aqui".
2. Rode as três suítes de novo; o teste do passo 5 tem de virar verde.
3. Suba `VERSAO_ATUAL` e a entrada no topo de `NOTAS_VERSAO`, ambos em
   `site/js/versao.js` — há teste que cobra que os dois batam.
4. Commit e push só quando pedido, e só para `origin`.
5. Escreva a mensagem de commit no formato abaixo, que é o que **fecha a issue
   sozinho** no push.

### A mensagem de commit que fecha a issue

Formato usado neste repositório (veja `d00b7b5`, que fechou a #16):

```
Pactos do Bruxo deixam de ser exclusivos; versao 2.2.11

Issue #16: o app impedia levar mais de um pacto. No PHB 2024 os tres --
Corrente, Lamina e Tomo -- sao entradas comuns de "Opcoes de Invocacoes
Misticas", as unicas da secao SEM linha de pre-requisito (...)

Closes #16
```

Três partes: **assunto** com a mudança e a versão; **corpo** abrindo com
`Issue #N:` e a causa raiz; e a **última linha** com a palavra-chave de
fechamento, sozinha.

**O que faz o fechamento funcionar** — e onde é fácil errar:

| Regra | Detalhe |
|---|---|
| A palavra-chave é **em inglês** | `close`/`closes`/`closed`, `fix`/`fixes`/`fixed`, `resolve`/`resolves`/`resolved`. **`Fecha`, `Corrige` e `Encerra` não funcionam** — o GitHub trata como texto comum e a issue fica aberta |
| Uma palavra-chave **por issue** | `Closes #19, closes #20`. Escrever `Closes #19, #20` fecha só a #19 |
| Uma linha por issue é mais seguro | duas issues, duas linhas: `Closes #19` e `Closes #20` |
| Só vale no branch padrão | o fechamento acontece quando o commit chega em `main` |
| `Issue #N:` no corpo **não fecha** | é só referência cruzada; quem fecha é a linha final |

> Aconteceu de verdade: o commit `a454a35` (versão 2.2.13) escreveu
> `Fecha #19:` e `Fecha #20:` achando que bastava. As duas issues continuaram
> abertas depois do push. `Resolve` funciona por coincidência — é a mesma
> palavra nas duas línguas —, mas não conte com isso: escreva `Closes`.

**Confira depois do push**, em vez de supor:

```bash
for n in 19 20; do
  curl -s "https://api.github.com/repos/$REPO/issues/$n" \
    | PYTHONIOENCODING=utf-8 python -c "
import json,sys
d=json.load(sys.stdin); print('#%s' % d['number'], '|', d['state'], '|', d.get('state_reason'))
"
done
```

`closed | completed` é o que se espera. Se voltar `open`, a palavra-chave não
pegou — feche pela API com o laudo como comentário (abaixo).

### Fechar pela API quando o commit não fechou

```bash
curl -s -X POST -H "Authorization: token $GITHUB_TOKEN" \
  "https://api.github.com/repos/$REPO/issues/$N/comments" \
  -d "$(PYTHONIOENCODING=utf-8 python -c "import json;print(json.dumps({'body':open('laudo.md',encoding='utf-8').read()}))")"

curl -s -X PATCH -H "Authorization: token $GITHUB_TOKEN" \
  "https://api.github.com/repos/$REPO/issues/$N" \
  -d '{"state":"closed","state_reason":"completed"}'
```

Escrever só `state: closed` marca a issue como *not planned* em alguns
clientes; `state_reason: completed` é o que registra "resolvida".

---

## Modelo de laudo

Serve tanto para responder no chat quanto para colar como comentário na issue.

```markdown
## #<N> — <título curto do sintoma> — CONFIRMADO / NÃO REPRODUZ / NÃO É BUG

**O que o print mostra:** <o estado concreto, com os números da tela>

**Regra do livro:** <citação> — `Informacoes Separadas/<arquivo>.md:<linha>`
**Dado do app:** idêntico / diverge — `dados/<caminho>.json:<linha>`
**Causa raiz:** <a frase única que explica o defeito> — `site/js/<arquivo>.js:<linha>`

**Alcance:** só o caso relatado / também atinge <lista>
**Por que os testes não pegaram:** <lacuna do oráculo>
```

Três veredictos possíveis, e vale ser explícito sobre qual é:

- **CONFIRMADO** — regra do livro batida, causa raiz no código apontada.
- **NÃO REPRODUZ** — falta informação ou o caminho descrito não leva ao
  sintoma; peça o **arquivo do personagem exportado**, não outro print.
- **NÃO É BUG** — o app está certo e o livro concorda com ele; responda com a
  citação do livro, que é o que encerra a discussão.

---

## Armadilhas conhecidas

| Armadilha | O que acontece | Saída |
|---|---|---|
| `gh` não existe aqui | `command not found` | API pública com `curl`, como no passo 1 |
| `python` no Windows | `UnicodeEncodeError` ou `Ã§`/`�` nos acentos | `PYTHONIOENCODING=utf-8` antes do comando |
| `grep` nos JSON de classe | devolve 50 KB de `texto_completo` numa linha | leia o array `caracteristicas` com Python |
| `Informacoes Separadas/` ausente | não dá para confrontar com o livro | a pasta é local e está no `.gitignore`; sem ela, pare e peça |
| API mistura PRs com issues | um "issue" que é PR | filtre por `'pull_request' in i` |
| `Fecha #N` na mensagem de commit | a issue **não fecha** — a palavra-chave só vale em inglês | `Closes #N`, uma linha por issue (passo 6) |
| Texto certo na tela | a ficha exibe a regra correta e não a executa | exibir ≠ aplicar; sempre `grep` o nome em `site/js/` |
| Capstones de nível 20 | implementados um a um, no braço | não existe mecanismo genérico; ao mexer num, confira os outros |
| Falha de paridade após corrigir | `testes/e2e/` acusa divergência | esperado — corrigir bug faz os dois lados divergirem; não bloqueia |

---

## Documentos relacionados

| Documento | Assunto |
|---|---|
| [ARQUITETURA.md](ARQUITETURA.md) | onde cada coisa mora em `site/js/` |
| [DEPLOY.md](DEPLOY.md) | publicar a correção, versionar, cache do PWA |
| [../testes/regras/README.md](../testes/regras/README.md) | a suíte que confronta o app com o livro |
| [../testes/regras/GUIA-PROXIMOS-DOMINIOS.md](../testes/regras/GUIA-PROXIMOS-DOMINIOS.md) | erros que rodadas anteriores cometeram |
