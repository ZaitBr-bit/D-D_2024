# Criador de Ficha de Personagem — D&D 5.5 (2024)

**[▶ Abrir o app](https://zaitbr-bit.github.io/D-D_2024/)** &nbsp;·&nbsp;
**[🐛 Relatar um problema](https://github.com/ZaitBr-bit/D-D_2024/issues/new?template=bug.yml)** &nbsp;·&nbsp;
**[💡 Sugerir uma melhoria](https://github.com/ZaitBr-bit/D-D_2024/issues/new?template=sugestao.yml)** &nbsp;·&nbsp;
versão atual **2.2.4**

Aplicativo web **gratuito e em português** para criar e usar fichas de personagem
de **D&D 5.5 (edição de 2024)**. Roda no navegador do celular e do computador,
**funciona offline** e não precisa de cadastro: seus personagens ficam salvos no
próprio aparelho, e a conta Google é opcional, só para sincronizar entre
dispositivos.

O conteúdo de regras já está embutido: **12 classes**, **48 subclasses**,
**11 espécies**, **16 antecedentes**, **75 talentos**, **391 magias**, além de
armas, armaduras, equipamento de aventura, ferramentas, montarias e serviços.

> Este é um projeto de fã, feito por hobby. Não é um produto oficial e não tem
> vínculo com a Wizards of the Coast.

---

## Sumário

- [Para jogadores](#para-jogadores)
  - [Como abrir e instalar no celular](#como-abrir-e-instalar-no-celular)
  - [O que dá para fazer](#o-que-dá-para-fazer)
  - [Onde ficam salvos os seus personagens](#onde-ficam-salvos-os-seus-personagens)
  - [Relatar um problema ou pedir uma melhoria](#relatar-um-problema-ou-pedir-uma-melhoria)
  - [Perguntas frequentes](#perguntas-frequentes)
- [Para desenvolvedores](#para-desenvolvedores)
  - [Como rodar](#como-rodar)
  - [Mapa do repositório](#mapa-do-repositório)
  - [Onde mexer para…](#onde-mexer-para)
  - [Testes](#testes)
  - [Publicação](#publicação)
  - [Convenções do repositório](#convenções-do-repositório)
  - [Documentação de apoio](#documentação-de-apoio)

---

# Para jogadores

## Como abrir e instalar no celular

O app é um site: basta abrir **<https://zaitbr-bit.github.io/D-D_2024/>**. Não
há loja de aplicativos, download nem cadastro.

Para deixá-lo com cara de aplicativo, com ícone na tela inicial e sem a barra do
navegador:

- **Android (Chrome):** menu ⋮ → *Adicionar à tela inicial* / *Instalar app*.
- **iPhone (Safari):** botão Compartilhar → *Adicionar à Tela de Início*.

Depois de instalado, ele **abre e funciona sem internet**. A conexão só é
necessária para receber uma versão nova ou para sincronizar com a nuvem, se você
tiver entrado com o Google.

## O que dá para fazer

**Criar o personagem passo a passo** — um assistente de 7 passos: classe,
espécie, antecedente, atributos (rolagem, matriz padrão, compra por pontos ou
manual), equipamento inicial, magias e detalhes pessoais. As escolhas que o
livro pede em cada passo aparecem na hora, já filtradas pelo que aquele
personagem pode escolher.

**Usar a ficha na mesa** — pontos de vida, dados de vida, condições, iniciativa,
CA, perícias, salvaguardas, sentidos, proficiências, idiomas, resistências e
imunidades. As habilidades de classe e de subclasse ficam com os usos contados
(fúria, inspiração, canalizações, pontos de feitiçaria e afins).

**Descanso curto e descanso longo** com um botão, recuperando o que cada regra
manda recuperar.

**Subir de nível** pelo assistente, que apresenta as escolhas daquele nível
(subclasse, talentos, aumentos de atributo, novas magias, trocas permitidas).

**Magias** — lista completa por classe e por círculo, espaços de magia,
concentração, magias sempre preparadas da subclasse, metamagia, grimório do Mago
e a possibilidade de criar magias personalizadas.

**Inventário** — armas, armaduras, escudos e equipamento com peso e custo, itens
personalizados, controle de moedas, cálculo de capacidade de carga e
arrastar-e-soltar para reordenar.

**Levar a ficha para fora do app** — botão **Gerar PDF** e uma versão formatada
para **impressão**, ambos com a foto do personagem no cabeçalho. Também dá para
**exportar e importar** personagens em arquivo, para backup ou para passar
adiante.

**Ver o que mudou** — clicando no número da versão, ao lado do título na tela
inicial, abrem-se as notas da versão.

## Onde ficam salvos os seus personagens

Por padrão, **no seu próprio aparelho**, no armazenamento do navegador. Nada é
enviado para lugar nenhum enquanto você não entrar com uma conta.

Isso tem uma consequência prática importante: **limpar os dados do navegador
apaga os personagens.** Duas formas de se proteger:

1. **Exportar** — na tela inicial há o botão de exportar, que baixa um arquivo
   com seus personagens. Guarde-o onde quiser e use o botão de importar para
   trazê-los de volta, inclusive em outro aparelho.
2. **Entrar com o Google** (opcional) — aí os personagens também vão para a
   nuvem e aparecem em qualquer aparelho onde você entrar com a mesma conta.

## Relatar um problema ou pedir uma melhoria

Use a aba **[Issues](https://github.com/ZaitBr-bit/D-D_2024/issues)** deste
repositório — é preciso ter uma conta no GitHub (gratuita).

- **[🐛 Relatar um problema](https://github.com/ZaitBr-bit/D-D_2024/issues/new?template=bug.yml)**
- **[💡 Sugerir uma melhoria](https://github.com/ZaitBr-bit/D-D_2024/issues/new?template=sugestao.yml)**
- Antes, dê uma olhada nas
  **[issues já abertas](https://github.com/ZaitBr-bit/D-D_2024/issues)**: se
  alguém já relatou o mesmo, comentar lá ajuda mais do que abrir outra.

Os dois links abrem um formulário que já pergunta o essencial — é só preencher.
Dentro do app, o botão **🐛** leva aos mesmos formulários, já com a sua versão
preenchida. Quanto mais específico o relato, mais rápido o conserto:

| O quê | Exemplo |
|---|---|
| **Versão** | o número ao lado do título, no alto da tela (ex.: `2.2.4`) |
| **Onde aconteceu** | criação de personagem, ficha, subida de nível, PDF… |
| **O que você fez** | "criei um Bárbaro nível 5 e cliquei em Descanso Longo" |
| **O que esperava** | "a fúria deveria voltar para 3 usos" |
| **O que aconteceu** | "continuou marcando 0 usos" |
| **Aparelho e navegador** | "Android, Chrome" / "PC, Firefox" |
| **Print da tela** | ajuda muito — dá para arrastar a imagem para dentro da issue |
| **O personagem** | se puder, exporte o personagem e anexe o arquivo |

Sugestão de melhoria é bem-vinda na mesma aba: descreva o que gostaria de ver e,
se for regra do livro, diga onde ela aparece.

Sem conta no GitHub? O botão **🐛** dentro do app e a própria tela de abertura
de issue oferecem contato pelo Reddit.

## Perguntas frequentes

**Preciso pagar ou criar conta?** Não. O app é gratuito e a conta Google é
opcional, só para sincronizar entre aparelhos.

**Funciona sem internet?** Sim, depois da primeira abertura. Ele se instala no
navegador e continua funcionando offline.

**Serve para D&D 5e (2014)?** Não. O conteúdo segue a edição de 2024 (5.5).

**Meus dados são meus?** Ficam no seu aparelho. Se você entrar com o Google, uma
cópia vai para a nuvem para sincronizar; sem login, nada sai do aparelho.

**Achei uma regra aplicada errado.** É exatamente o tipo de relato mais útil —
abra uma issue dizendo qual regra, o que o app fez e o que o livro manda fazer.

---

# Para desenvolvedores

SPA estática em **JavaScript puro (ES modules)**, **sem build e sem bundler**.
Editar um arquivo e recarregar a página é o ciclo inteiro de desenvolvimento.
Funciona offline por Service Worker (PWA) e sincroniza opcionalmente com o
Firestore quando o usuário está logado.

| | |
|---|---|
| **Runtime** | Navegador. A aplicação não tem nenhuma dependência de Node |
| **Dados de jogo** | JSON estático em `dados/`, carregado sob demanda |
| **Persistência** | `localStorage` + fila de sincronização opcional (Firestore) |
| **Publicação** | GitHub Pages, por GitHub Actions |
| **Node** | só na suíte de testes (`testes/e2e/`), isolado, com `node_modules/` no `.gitignore` |
| **Python** | utilitários de extração de dados e verificação estrutural |

## Como rodar

```powershell
# servidor local, a partir da raiz do repositório
pwsh -File iniciar_servidor.ps1
```

Serve `site/index.html`. Não há etapa de build.

```bash
# verificação estrutural dos módulos (rápida, sem navegador)
python scripts/verificar_extracao.py tudo
```

## Mapa do repositório

```
D-D_2024/
├── index.html               # redireciona para site/
├── LICENSE                  # MIT — cobre o código, não o conteúdo de jogo
├── .github/
│   ├── workflows/deploy.yml # publicação no GitHub Pages
│   └── ISSUE_TEMPLATE/      # formulários de bug e de sugestão
├── iniciar_servidor.ps1     # servidor local de desenvolvimento
├── _extrair_json.py         # extração dos dados de jogo (gera dados/*.json)
├── site/                    # a aplicação servida
│   ├── index.html           # shell da SPA (header, #app-content, modal-overlay)
│   ├── manifest.json        # PWA
│   ├── sw.js                # Service Worker (cache offline)
│   ├── css/app.css          # estilos globais (CSS vars: --primary, --danger, …)
│   ├── img/, favicon.ico
│   └── js/                  # 67 módulos ES + vendor/pdf-lib.min.js
│       ├── app.js           # router por hash, init, registro do SW
│       ├── pages/           # home, creator, sheet (entradas de rota)
│       ├── creator/         # assistente de criação, um arquivo por passo
│       ├── sheet/           # ficha, um arquivo por assunto (+ classes/)
│       ├── levelup*.js      # fluxo, UI, cards e validações de subida de nível
│       ├── store.js db.js sync.js auth.js utils.js dados-classes.js
│       └── versao.js        # VERSAO_ATUAL + notas de versão (edição manual)
├── dados/                   # dados de jogo em JSON (fonte de verdade do conteúdo)
│   ├── classes/             # <classe>.json, magias_<classe>.json
│   ├── origens/             # especies.json, antecedentes.json
│   ├── talentos/  equipamento/  magias/  apendices/
│   └── capitulo*.json, _metadados.json, controle/
├── Informacoes Separadas/   # regras em Markdown, referência humana — LOCAL, não versionada
├── testes/
│   ├── e2e/                 # Playwright: paridade + specs de regra em regras/
│   └── regras/              # regras de negócio confrontadas com o livro
├── scripts/                 # verificar_extracao.py, excecoes/
└── docs/
    ├── ARQUITETURA.md       # aprofundamento técnico
    └── DEPLOY.md            # pipeline de publicação e diagnóstico
```

## Onde mexer para…

| Quero mexer em | Arquivo |
|---|---|
| Uma seção da ficha | `site/js/sheet/<assunto>.js` — o corte é **por assunto**, não por camada |
| Magias, espaços, concentração | `sheet/magias.js` · grimório do Mago em `sheet/grimorio.js` |
| PV, dados de vida, descansos | `sheet/hp-descanso.js` |
| Inventário, itens, peso | `sheet/inventario.js` · seletor unificado em `js/itens-seletor.js` |
| Recursos de uma classe | `sheet/classes/<classe>.js` |
| Um passo do assistente de criação | `site/js/creator/passo-*.js` |
| Subida de nível | `js/levelup-flow.js`, `levelup-cards.js`, `levelup-ui.js` |
| Cálculos compartilhados | `js/utils.js` (`calcMod`, `calcCA`, `bonusProficiencia`, …) |
| Conteúdo de jogo (classe, magia, item) | o JSON correspondente em `dados/` |
| Versão exibida e notas de versão | `site/js/versao.js` (a versão é **manual**) |

A ficha vive em módulos que agrupam render, eventos e regras do mesmo tema no
mesmo arquivo. Os detalhes — estado compartilhado por *live binding*, ciclos de
import, modelo de dados do personagem, padrões de UI e carregamento de dados —
estão em **[docs/ARQUITETURA.md](docs/ARQUITETURA.md)**.

## Testes

Três verificações independentes, que respondem perguntas diferentes:

| Verificação | Comando | Pergunta que responde |
|---|---|---|
| Estrutura dos módulos | `python scripts/verificar_extracao.py tudo` | "algum módulo tem símbolo sem import, import quebrado, declaração duplicada ou gravação em binding importado?" — estático, sem navegador |
| Regras de negócio | `cd testes/e2e && npm run test:regras` | "o app obedece ao **livro**?" |
| Paridade E2E | `cd testes/e2e && npm test` | "a tela é a mesma do repositório original?" — Playwright |

```bash
cd testes/e2e
npm run instalar              # uma vez: dependências + Chromium
npm run test:regras           # regras: unidade + navegador
npm run test:regras:unidade   # só node:test (segundos, sem navegador)
npm run test:regras:e2e       # só os specs de regra em Playwright
npm test                      # paridade (~6 min)
npm run test:esm ../..        # força o parser de módulo ES em todos os JS
```

- **Regras de negócio** (`testes/regras/`) é a suíte que importa hoje: confronta
  o app com o texto do livro a partir de catálogos curados à mão —
  talentos, antecedentes, classes, subclasses e as tabelas transversais da ficha
  —, cada entrada citando sua seção do livro. Um teste de completude cobra 100%
  do que existe em `dados/`: não há amostragem. As divergências já encontradas
  ficam registradas em `lacunas-conhecidas.mjs`, o que mantém a suíte verde sem
  esconder o defeito — corrigido o app, o teste passa a cobrar a remoção da
  entrada.
- **O oráculo dessa suíte não vem no clone.** Os catálogos citam seções de
  `Informacoes Separadas/*.md` — o texto de regras do livro, que **não é
  versionado** aqui. Sem essa pasta no disco, parte da suíte de regras não
  roda; o resto do projeto (app, paridade, verificação estrutural) não depende
  dela.
- **Quem for cobrir um domínio novo** deve ler antes o
  [GUIA-PROXIMOS-DOMINIOS.md](testes/regras/GUIA-PROXIMOS-DOMINIOS.md), que
  registra os erros das rodadas anteriores e traz um checklist de pré-voo.
- **Paridade** (`testes/e2e/`) nasceu para guardar a refatoração que quebrou os
  monólitos, comparando este repositório com uma cópia do original lado a lado
  (`../D-D_2024` por padrão, ou `REPO_ORIGINAL=/caminho`). Ela **não é mais
  restrição**: corrigir um bug faz os dois lados divergirem, e isso é o
  esperado. Continua útil como rede contra regressão de renderização naquilo que
  a correção não tocou — ver `testes/regras/README.md`.
- **`test.skip` sem motivo escrito é omissão silenciosa** — a regra do
  repositório é que todo skip carregue a justificativa no próprio arquivo.

## Publicação

GitHub Pages por `.github/workflows/deploy.yml`, disparado em `push` na `main`
(ou manualmente). O workflow monta `_dist/` com `index.html`, `site/` e `dados/`
como irmãos — a mesma estrutura do repositório —, gera por varredura os dois
manifestos de precache do Service Worker e injeta o número da build. Não há Node,
bundler nem reescrita de caminho.

A versão **visível** no cabeçalho é manual, em `site/js/versao.js`; o número da
build fica oculto e serve para diagnóstico. Pipeline completo, como conferir se
um deploy foi mesmo ao ar e o que fazer quando ele falha:
**[docs/DEPLOY.md](docs/DEPLOY.md)**.

## Convenções do repositório

- **Comentários e interface em pt-BR**, com acentuação correta.
- **Toda função criada leva um comentário** explicando o que ela faz.
- **Compatibilidade com fichas antigas:** campos novos são lidos com optional
  chaining (`char?.config?.x`) e escritos com guarda
  (`if (!char.config) char.config = {}`), porque personagens já salvos não têm o
  campo. Mudança de schema entra como migração em `sheet/migracoes.js`.
- **Escapar entrada do usuário** com `escHtml()` ao interpolar em HTML.
- **Não commitar automaticamente** — política do repositório.
- Ao lançar uma versão, `VERSAO_ATUAL` e a entrada no topo de `NOTAS_VERSAO`
  precisam bater; há teste que cobra isso.

## Documentação de apoio

| Documento | Assunto |
|---|---|
| [docs/ARQUITETURA.md](docs/ARQUITETURA.md) | módulos, estado, dados, padrões de UI, cálculos |
| [docs/DEPLOY.md](docs/DEPLOY.md) | pipeline, versionamento, precache, diagnóstico de falhas |
| [testes/regras/README.md](testes/regras/README.md) | suíte de regras de negócio |
| [testes/regras/GUIA-PROXIMOS-DOMINIOS.md](testes/regras/GUIA-PROXIMOS-DOMINIOS.md) | checklist antes de cobrir um domínio novo |
| [testes/e2e/README.md](testes/e2e/README.md) | suíte de paridade, arquivo por arquivo |

---

## Licença, créditos e conteúdo

O **código** deste repositório está sob a licença [MIT](LICENSE): pode usar,
modificar e redistribuir, mantendo o aviso de copyright.

A licença **não alcança o conteúdo de jogo** — as regras, tabelas e descrições
de D&D em `dados/` pertencem aos seus detentores
de direitos e estão aqui apenas para a aplicação funcionar. Projeto pessoal, sem
fins lucrativos, sem vínculo, patrocínio ou endosso da Wizards of the Coast.
