# Deploy e manutenção

Publicação em GitHub Pages por [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml),
com a fonte do Pages configurada como **GitHub Actions** (não "deploy from a
branch"). Sem Node e sem bundler: o workflow usa apenas Python e `sed`.

Produção: **<https://zaitbr-bit.github.io/D-D_2024/>** (a raiz redireciona para
`/site/`).

---

## Gatilhos e permissões

| Item | Valor |
|---|---|
| Gatilhos | `push` em `main` e `workflow_dispatch` (execução manual) |
| Concorrência | grupo `pages`, `cancel-in-progress: false` — deploys enfileiram, não se cancelam |
| Permissões | `contents: read`, `pages: write`, `id-token: write` |
| Ambiente | `github-pages`, com a URL pública exposta como saída do job |

## Os 5 passos do workflow

| # | Passo | O que faz |
|---|---|---|
| 1 | `actions/checkout@v4` | Clona o repositório |
| 2 | `Prepare site` | Monta `_dist/`, gera os dois manifestos de precache e injeta o número da build |
| 3 | `actions/configure-pages@v5` | Lê a configuração do Pages do repositório |
| 4 | `actions/upload-pages-artifact@v3` | Empacota `_dist/` em `artifact.tar` e envia |
| 5 | `actions/deploy-pages@v4` | Cria o deployment e espera o backend do Pages publicar |

O passo 2 é o único com lógica própria:

1. `_dist/` recebe `index.html`, `site/` e `dados/` como irmãos — **a mesma
   estrutura do repositório**, que é o motivo de `BASE_PATH = '../dados'`
   funcionar igual em desenvolvimento e em produção. **Não há reescrita de
   caminho** em lugar nenhum do pipeline.
2. Um script Python varre `_dist/dados/**` e grava `site/dados-precache.json`
   com URLs `../dados/….json`.
3. Outro varre `_dist/site/js/**` e grava `site/js-precache.json` com URLs
   `./js/….js`, imprimindo a contagem no log.
4. Dois `sed` trocam `CACHE_VERSION = 0` no `sw.js` e `v0` no marcador
   `VERSION_AUTO` do `index.html` pelo `github.run_number`.

### Precache offline

Os manifestos que o Service Worker consome no `install` — `dados-precache.json`
e `js-precache.json` — são **artefatos de deploy e não são versionados**: uma
lista fixa no repositório ficaria desatualizada em relação à árvore, que é
exatamente o problema que eles resolvem.

## Duas versões, com papéis diferentes

Depois de 2026-08-08 o número que o usuário vê **não vem mais da build**:

- **Versão do produto** — `VERSAO_ATUAL` em [`site/js/versao.js`](../site/js/versao.js),
  editada à mão junto com a entrada correspondente em `NOTAS_VERSAO`. É o que
  aparece no cabeçalho e o que o usuário cita ao abrir uma issue. Há teste
  cobrando que as duas batam.
- **Número da build** — `github.run_number`, injetado pelos `sed` no `sw.js`
  (`CACHE_VERSION`) e no span oculto `#build-numero` do `index.html`. Governa a
  invalidação do cache do Service Worker e serve de diagnóstico; aparece no
  rodapé do modal de notas de versão.

No repositório os marcadores da build ficam **sempre** em zero —
`const CACHE_VERSION = 0; // AUTO` e `v0</span><!-- VERSION_AUTO -->`. Só o
artifact publicado carrega o número do run, e isso tem uma consequência prática
muito útil: **o número em produção diz exatamente qual run está no ar**, sem
depender do log do Actions.

Dois detalhes que já confundiram o diagnóstico:

- **Re-run preserva o `run_number`.** Re-executar o run #19 publica `v19` de
  novo, não `v20`. Se o número não avançou, não significa que o deploy falhou.
- **Os manifestos de precache não são versionados.** Se `js-precache.json`
  responde em produção, é prova de que o conteúdo veio do artifact do workflow —
  não há como ele existir servindo direto de uma branch.

## Conferir se um deploy realmente foi ao ar

Não confie só no status do Actions; pergunte à produção. Roda em qualquer
PowerShell:

```powershell
foreach ($u in @("site/index.html","site/sw.js","site/js-precache.json","site/js/versao.js")) {
  $r = Invoke-WebRequest -Uri "https://zaitbr-bit.github.io/D-D_2024/$u`?cb=$(Get-Random)" -UseBasicParsing
  if     ($u -like "*index.html") { "build     -> " + [regex]::Match($r.Content,'v\d+</span><!-- VERSION_AUTO -->').Value }
  elseif ($u -like "*sw.js")      { "sw.js     -> " + [regex]::Match($r.Content,'const CACHE_VERSION = \d+').Value }
  elseif ($u -like "*versao.js")  { "versao    -> " + [regex]::Match($r.Content,"VERSAO_ATUAL = '[^']+'").Value }
  else                            { "precache  -> " + ($r.Content | ConvertFrom-Json).Count + " modulos" }
}
```

O `?cb=` é obrigatório: sem ele o CDN do Pages pode devolver a versão anterior.
Os valores têm de bater entre si — mesmo número de run no `index.html` e no
`sw.js`, contagem de módulos igual à impressa no log do passo 2 e `VERSAO_ATUAL`
igual à do repositório.

Para acompanhar um deploy lento sem ficar recarregando a página, um poll simples
(Git Bash) que sai sozinho quando a versão mudar:

```bash
ATUAL=19   # build que já está no ar
for i in $(seq 1 40); do
  v=$(curl -s "https://zaitbr-bit.github.io/D-D_2024/site/sw.js?cb=$i" \
      | grep -o 'const CACHE_VERSION = [0-9]*' | grep -o '[0-9]*$')
  [ -n "$v" ] && [ "$v" != "$ATUAL" ] && { echo "publicado: v$v"; break; }
  echo "ainda v$v"; sleep 20
done
```

## Manutenção do precache offline

Os manifestos são **gerados por varredura**, então o caso comum não pede
manutenção nenhuma:

- Adicionar/remover JSON em `dados/` ou módulo em `site/js/**` → nada a fazer,
  entram sozinhos no próximo deploy.
- **Mover** `site/js/` ou `dados/` de lugar → aí sim, ajustar os `os.walk` e os
  `.replace(...)` no passo `Prepare site`, porque as URLs gravadas são relativas
  ao escopo do Service Worker (`/site/`).
- Mudar o texto `const CACHE_VERSION = 0; // AUTO` ou o marcador
  `v0</span><!-- VERSION_AUTO -->` → os `sed` deixam de casar **em silêncio**.
  Não há erro no log; o site publica com `v0` e o cache do SW para de invalidar.
  Se o build em produção mostrar `v0`, é isso.

## Diagnóstico de falhas

O log do run diz em qual fronteira quebrou. As mensagens do passo 5 são as que
importam:

| Sintoma no log | Significado | Ação |
|---|---|---|
| `Current status: deployment_queued` repetido até `Timeout reached, aborting!` | O deployment foi criado e aceito, mas o backend do Pages nunca pegou o job | Ambiente do GitHub. Re-executar o run |
| `deployment_in_progress` por vários minutos | O backend pegou o job, só está lento | Esperar; conferir produção pelo bloco acima |
| `Timeout reached, aborting!` seguido de `Canceled deployment with ID …` | A action desistiu **e cancelou** o deployment | Re-executar; ver "se o timeout precisar de folga" |
| Falha em `configure-pages` | Pages desabilitado ou fonte fora de "GitHub Actions" | Settings → Pages → Source = GitHub Actions |
| Deploy verde mas build em produção com `v0` | Os `sed` não casaram | Ver "manutenção do precache offline" |
| 404 em `dados/*.json` em produção | Arquivo fora do artifact | Conferir a listagem `Archive artifact` no log |

Vale saber o que **não** é gargalo aqui: o artifact tem cerca de 130 arquivos e
~1 MB, e os passos 1 a 4 levam poucos segundos no total. Quando um deploy
demora, o tempo está no passo 5, esperando o backend do Pages — não no build.

### Se o timeout precisar de folga

O `actions/deploy-pages@v4` espera **600000 ms (10 min)** por padrão, contados da
criação do deployment até a publicação. Hoje o workflow **não sobrescreve** esse
valor. Se as filas do Pages voltarem a passar de 10 min com frequência, dá para
alargar a janela:

```yaml
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
        with:
          timeout: 1200000   # 20 min em vez dos 10 min padrão
```

Isso não acelera nada — só evita abortar um deploy que ainda ia completar. Como
a causa é externa, é o único ajuste possível deste lado, e o custo é queimar mais
minutos de Actions quando a fila estiver de fato travada.

## Incidente de 2026-08-06 (registro)

Deploy do commit `fc27f30` falhou com `Timeout reached, aborting!` após 10 min
inteiros em `deployment_queued`, e o deployment foi cancelado.

Investigação: passos 1 a 4 todos verdes (artifact de 1.029.387 bytes enviado, 61
módulos no precache) e o deployment chegou a ser criado e aceito pela API. A
configuração foi descartada como causa por evidência de produção — o site servia
`v18`/`CACHE_VERSION = 18` e um `js-precache.json` que não existe no repositório,
provando que a fonte do Pages já era GitHub Actions e que o run anterior havia
publicado pelo mesmo pipeline. Também foram descartados limite de builds por
hora (o push anterior fora 88 min antes) e artifact problemático.

Re-executando, o deployment passou a `deployment_in_progress` e publicou em torno
dos 11 min do início do job. **Causa: ambiente do GitHub** — fila e publicação do
backend do Pages, fora do repositório. Nenhuma alteração de código foi
necessária, e nenhuma foi mantida.

Se repetir: re-executar o run é a primeira e normalmente única ação.
