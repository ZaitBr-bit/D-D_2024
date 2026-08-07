# Domínio Classes/Níveis da suíte de regras — desenho

Data: 2026-08-07
Domínio 4 da suíte `testes/regras/` (depois de Talentos, Antecedentes e
Regras Transversais da Ficha).

## A pergunta deste domínio

A mesma da suíte inteira, aplicada às 12 classes: **o app obedece ao livro
quando um personagem sobe de nível?** Bônus de Proficiência, Pontos de Vida,
espaços de magia, truques, magias preparadas, os recursos próprios de cada
classe (Fúrias, Dados de Inspiração, Pontos de Foco...) e as características
concedidas em cada um dos 20 níveis.

Fonte da verdade: `Informacoes Separadas/Classes.md` (5.904 linhas), que traz
uma tabela fechada de 20 linhas por classe.

## Achados do pré-voo

Cinco fatos medidos antes de desenhar, não supostos. Cada um mudou o desenho.

### 1. `subirDeNivel()` é dirigível em Node — confronto comportamental sem navegador

`site/js/db.js` carrega `dados/` por `fetch('../dados/...')`. Com um stub de
`fetch` que lê o disco (acréscimo ao `harness.mjs`, junto dos stubs de
`window`/`document`/`localStorage` que já existem), `db.getClasse()` resolve e
`levelup.subirDeNivel()` executa de verdade.

Verificado por spike: as 12 classes sobem, e a função devolve pendências
estruturadas em vez de falhar de forma opaca:

```
{ sucesso: false, pendente: true, tipo_pendencia: 'subclasse',
  mensagem: 'É necessário escolher uma subclasse para avançar para o nível 3' }
```

Um driver que trata apenas `subclasse` e `aumento_atributo` já levou
Bárbaro, Guerreiro, Ladino e Monge do nível 1 ao 18, parando exatamente em
`dadiva_epica` no nível 19 — que é o que o livro manda. `subirDeNivel` expõe
**15** valores distintos de `tipo_pendencia` (`site/js/levelup.js`, linhas
948-1187): `subclasse`, `dadiva_epica`, `aumento_atributo`, `talento_asi`,
`dadiva_proficiencia_pericia`, `dadiva_resistencia_energia`,
`escolhas_talento`, `bardo_expertise`, `guardiao_expertise`, `estilo_luta`,
`explorador_habil`, `manobras_guerreiro`, `grimorio`,
`subclasse_magias_arcana`, `academico`. O driver da suíte precisa ter uma
escolha canônica registrada para cada um dos 15 — um `default` mudo faria o
personagem parar de subir sem ninguém perceber.

**Consequência de desenho:** este domínio tem a camada comportamental que
Antecedentes só conseguiu no Playwright. A lição registrada no
`GUIA-PROXIMOS-DOMINIOS.md` ("não presuma que a divisão entre unidade e
navegador do domínio anterior vai se repetir") se aplica na direção oposta
aqui: em vez de empurrar tudo para o navegador, este domínio puxa quase tudo
para `node:test`.

### 2. Duas fontes de verdade paralelas para os traços básicos

O mesmo fato do livro está codificado em dois lugares que ninguém confronta
entre si nem com o livro:

- `dados/classes/*.json` → `tracos_basicos` (texto em prosa: `"Dado de Ponto
  de Vida": "D12 por nível de Bárbaro"`, `"Proficiência em Perícias": "Escolha
  2: Atletismo, Intimidação, ..."`).
- `site/js/dados-classes.js` → `CLASSES_INFO` (estruturado: `dado_vida: 12`,
  `pericias_opcoes: [...]`, `num_pericias: 2`, `salvaguardas: [...]`,
  `conjurador`, `atributo_conjuracao`).

`CLASSES_INFO` alimenta `calcularHPGanho`, `calcPVNivel1`, `calcPVTotal`,
`calcCDMagia` e `calcAtaqueMagia`. É a duplicação manual que o guia trata como
sintoma (erro 2, e a lição da rodada de correção de 2026-08-06): **as duas
precisam ser confrontadas com o livro**, não uma contra a outra.

### 3. Várias funções de gatilho são listas hard-coded sem confronto

`site/js/levelup.js` decide o que cada nível exige por listas escritas à mão,
independentes da tabela que o app já carrega:

- `concedeAumentoAtributo` (linha 399) — um array de níveis por classe.
- `exigeSubclasse` (linha 421) — um mapa classe→nível, todos `3`.
- `exigeEspecializacaoBardo` (444), `exigeEspecializacaoGuardiao` (451),
  `exigeEstiloLuta` (458), `exigeManobrasGuerreiro` (465),
  `getQuantidadeNovasManobras` (473), `exigeExploradorHabil` (482),
  `exigeAcademico` (489).

Nenhuma é derivada da coluna "Características de Classe". Se a lista discordar
da tabela, nada hoje percebe. Esse é o alvo de maior retorno do motor
estrutural.

### 4. Os headings de `Classes.md` são irregulares — o validador de citação precisa saber disso

Não há um nível de heading único por classe, ao contrário de `Talentos.md`
(`###`) e `Antecedente.md` (`##`):

| Padrão observado | Exemplo |
|---|---|
| `## Características de Classe de X` | Bárbaro (linha 38), Bruxo (851), Clérigo (1534) |
| `### Características de Classe de X` | Bardo (369) |
| `## Características de X` | Paladino (5469) — e é **este** que traz a tabela (linhas 5471-5493); o `## Características de Classe de Paladino` (5495) abre a prosa que descreve cada característica |
| `# Subclasses de X` | Bárbaro (185), Bardo (684) |
| `## Subclasses de Druida` | Druida (2333) |

O validador de citações deste domínio aceita `#`, `##` e `###`. Escrever um
regex de um nível só produziria falhas que pareceriam catálogo errado.

### 5. A tabela do livro tem ruído tipográfico que `dados/` já normalizou

`Classes.md:5474` (a linha de nível 1 da tabela, sob o heading 5469) lista as
características de nível 1 do Paladino como
`Conjuração, Maestria em Arma. Mãos Consagradas` — ponto final onde deveria
haver vírgula. `dados/classes/paladino.json` transcreveu com vírgula, e
`obterCaracteristicasNivel` (que divide por vírgula) devolve as três corretas.

O catálogo transcreve **três características**, com nota explicando que a
tabela do livro usa ponto ali. Sem a nota, um leitor futuro acha que a
transcrição foi desleixada; sem a normalização, o teste registraria uma lacuna
falsa contra um app que está certo.

## Escopo

### Dentro

- As 12 classes × 20 níveis: a tabela de progressão inteira, todas as colunas.
- Traços básicos das 12 classes (dado de vida, atributo primário, salvaguardas,
  perícias, armaduras, armas).
- Os nomes das 48 subclasses — apenas para provar bijeção com `dados/`.
- Confronto comportamental: subida 1→20 por classe via `subirDeNivel()`.
- As funções puras de leitura de tabela e de gatilho de escolha listadas acima.

### Fora, declarado (não omitido em silêncio)

- **Características de subclasse por nível** (48 subclasses × níveis 3/6/10/14,
  variando por classe). **É a dependência direta desta rodada**: o catálogo
  desta rodada já traz os nomes das subclasses, e a rodada seguinte pendura as
  características neles sem reprojetar nada. Registrado assim no README do
  domínio, não como escopo cortado.
- Listas de magias por classe (`lista_magias`, `dados/magias/por_classe/`) —
  domínio 6 (Magias).
- Os ramos de classe que `ficha-transversal` deixou anotados (`calcCA` de
  Bárbaro/Monge/Bardo-Dança/Feiticeiro-Dracônico, `calcBonusPericia` de
  Bárbaro em fúria e Clérigo Taumaturgo, `calcPercepcaoPassiva` de Bardo):
  dependem de característica de **subclasse** em três dos casos, então
  acompanham a rodada de subclasses. Entram nesta rodada apenas se caírem
  naturalmente no motor comportamental.
- Multiclasse. O app não a implementa; o livro a descreve. Registrar isso como
  lacuna seria alegação sobre uma funcionalidade inexistente, não sobre uma
  regra mal implementada.

### Tabela Evolução do Personagem: não duplicar

`bonusProficiencia` e `calcularNivelPorXP`/`XP_POR_NIVEL` já estão cobertos nos
20 níveis por `ficha-transversal.test.mjs`. Este domínio usa a coluna "Bônus de
Proficiência" das tabelas de classe apenas para confrontar que **cada classe
repete a mesma progressão** — que é uma afirmação diferente, e é a única
sobreposição admitida.

### O que a rodada faz com o que encontrar

**Só reportar.** Divergências viram entradas em `lacunas-conhecidas.mjs` com
`tipo` e `motivo` citando arquivo e linha dos dois lados. A correção é um
projeto separado, como foi em Talentos — não como em Antecedentes, onde relato
e correção couberam no mesmo dia.

## Arquitetura

Três arquivos novos, um alterado. A estrutura do domínio não muda: catálogo +
motor.

```
testes/regras/catalogo/classes.mjs           (novo)  — transcrição do livro
testes/regras/unidade/classes.test.mjs       (novo)  — motor estrutural
testes/regras/unidade/classes-progressao.test.mjs (novo) — motor comportamental
testes/regras/unidade/harness.mjs            (alterado) — stub de fetch + leitores + driver
```

Dois motores, não um: eles fazem perguntas diferentes (a tabela está certa? ×
o app aplica a tabela?) e falham por motivos diferentes. Um arquivo único
misturaria as duas leituras e cresceria além do que se segura em contexto.

### `catalogo/classes.mjs`

Segue `ficha-transversal.mjs`, não `talentos.mjs`: quando o livro traz tabela
fechada, o catálogo é **transcrição** e o confronto é **varredura exaustiva**,
não amostragem.

```js
export const CITACOES = {
  Bárbaro: 'Classes.md §Características de Classe de Bárbaro',
  // ... uma por classe
};

export const TRACOS_BASICOS = {
  'Bárbaro': {
    dadoVida: 12,
    atributoPrimario: 'Força',
    salvaguardas: ['Força', 'Constituição'],
    numPericias: 2,
    periciasOpcoes: ['Atletismo', 'Intimidação', 'Lidar com Animais',
                     'Natureza', 'Percepção', 'Sobrevivência'],
    armaduras: ['Leve', 'Média', 'Escudo'],
    armas: ['Simples', 'Marcial'],
    conjurador: false,
    atributoConjuracao: null,
  },
  // ... 12 entradas
};

export const PROGRESSAO = {
  'Bárbaro': [
    { nivel: 1, bonusProficiencia: 2,
      caracteristicas: ['Defesa sem Armadura', 'Fúria', 'Maestria em Arma'],
      colunas: { 'Fúrias': '2', 'Dano da Fúria': '+2', 'Maestria em Arma': '2' },
      espacos: null },
    // ... 20 linhas
  ],
  // ... 12 classes = 240 linhas
};

export const SUBCLASSES = {
  'Bárbaro': ['Trilha da Árvore do Mundo', 'Trilha do Berserker',
              'Trilha do Coração Selvagem', 'Trilha do Fanático'],
  // ... 12 × 4 = 48 nomes
};
```

**Restrição dura, e o motivo:** cada linha é transcrita lendo a tabela de
`Classes.md`. Nenhum valor pode ser gerado a partir de `dados/classes/*.json`
nem de `CLASSES_INFO`. Gerar do JSON faria os testes compararem o app consigo
mesmo — a lição "valor esperado não pode vir da função sob teste" registrada no
guia, aplicada à fonte inteira em vez de a um termo isolado. O catálogo carrega
essa nota no cabeçalho do arquivo, como `ficha-transversal.mjs` já faz.

`espacos: null` para as 4 classes sem conjuração (Bárbaro, Guerreiro, Ladino,
Monge) — distinto de `espacos: {}`, que significaria "conjura mas não tem
espaço neste nível". O schema de completude exige a distinção.

O Bruxo tem forma própria: sua tabela usa colunas `Espacos de Magia` e `Nivel
do Espaco` (Magia de Pacto), não as colunas 1-9. O catálogo transcreve como o
livro apresenta; o teste de espaços de magia trata o Bruxo à parte, com o
motivo escrito no teste.

### `unidade/classes.test.mjs` — motor estrutural

| # | Confronto | Volume |
|---|---|---|
| 1 | Completude: bijeção catálogo × `dados/classes/*.json` (12 classes), bijeção dos 48 nomes de subclasse, schema de toda entrada, citações resolvendo para headings reais | ~30 |
| 2 | As 240 linhas × `dados/classes/*.json`, coluna a coluna | 240 |
| 3 | `CLASSES_INFO` (`dados-classes.js`) × `TRACOS_BASICOS` do livro | 12 × ~8 campos |
| 4 | `getEspacosMagia` / `getTruquesConhecidos` / `getMagiaPreparadas` × catálogo | 12 × 20 × 3 |
| 5 | Gatilhos de escolha × coluna "Características de Classe" transcrita | 12 × 20 por função |
| 6 | `calcularHPGanho` × dado de vida do livro, mod. CON −5..+10 | 12 × 16 |
| 7 | `obterCaracteristicasNivel` × catálogo | 12 × 20 |

Confronto 5, em detalhe — é onde as listas hard-coded encontram a tabela pela
primeira vez. Para cada classe × cada nível, o **esperado** vem de procurar o
rótulo na coluna transcrita do livro, e o **observado** vem da função:

| Função do app | Rótulo procurado na coluna do livro |
|---|---|
| `concedeAumentoAtributo` | `Aumento no Valor de Atributo` |
| `exigeSubclasse` | `Subclasse de X` / `Subclasse X` |
| `exigeDadivaEpica` | `Dádiva Épica` |
| `exigeEspecializacaoBardo` | `Especialista` (nv 2), `Especialização` (nv 9) |
| `exigeEspecializacaoGuardiao` | `Especialista` |
| `exigeEstiloLuta` | `Estilo de Luta` |
| `exigeExploradorHabil` | `Explorador Hábil` |
| `exigeAcademico` | `Acadêmico` |
| `exigeManobrasGuerreiro` + `getQuantidadeNovasManobras` | característica de Mestre da Batalha; a quantidade vem do texto da subclasse, citado |

Onde o rótulo do livro e o nome da função não coincidirem literalmente, o
catálogo declara o mapeamento em um campo explícito, com a citação — nunca por
`includes()` improvisado dentro do teste.

### `unidade/classes-progressao.test.mjs` — motor comportamental

Para cada uma das 12 classes, `escadaDeNivel()` sobe do nível 1 ao 20
resolvendo cada `tipo_pendencia` com uma escolha canônica registrada, e a cada
nível confronta o personagem resultante contra a linha do catálogo:

- Bônus de Proficiência do personagem = coluna do livro.
- PV acumulado = PV do nível 1 + soma dos ganhos fixos (o dado de vida do
  livro, não `CLASSES_INFO`).
- `espacos_magia` = colunas 1-9 da linha do livro.
- Truques e magias preparadas = colunas do livro.
- Características ganhas no nível = coluna do livro.
- **Quais escolhas o app exigiu** = os níveis em que o livro concede a
  característica correspondente. Uma pendência a mais é o app inventando
  exigência; uma a menos é o app deixando passar sem escolher.

Esta última asserção é a que só existe porque `subirDeNivel` devolve
`tipo_pendencia` estruturado. Ela é o equivalente, aqui, do que os specs
Playwright fazem em Talentos.

### Perguntas que o livro não escreve

A lição do motor de escolha morta: além do que o livro afirma, o que um usuário
consideraria obviamente quebrado? Quatro asserções, no motor comportamental,
sem frase do livro para citar (e o teste diz isso por escrito):

1. Nenhum espaço de magia diminui ao subir de nível.
2. Nenhuma característica é concedida duas vezes ao longo dos 20 níveis.
3. Subclasse não é reoferecida depois de escolhida.
4. Subir além do nível 20 é recusado, e subir sem XP suficiente é recusado.

### `harness.mjs` — acréscimos

Tudo em `harness.mjs`, "AQUI e só aqui", como o arquivo já determina:

- **Stub de `fetch`** resolvendo `../dados/...` contra o disco. Instalado junto
  dos stubs existentes, com comentário explicando que `db.js:15` é quem exige.
- `lerClassesDados()` — as 12 classes de `dados/classes/*.json`, ignorando os 8
  `magias_*.json` (que são listas de magias, não classes).
- `lerHeadingsClasses()` — headings `#`, `##` e `###` de `Classes.md`.
- `escadaDeNivel(classe, opcoesPorPendencia)` — o driver 1→20.
- `importar('site/js/db.js')` acrescentado a `modulosApp()`.

O `escadaDeNivel` tem um limite de tentativas por nível e **falha com a
pendência não tratada nomeada** se estourar. Um driver que devolvesse "não
consegui subir" em silêncio produziria exatamente o teste-que-não-afirma-nada
do erro 3 do guia.

## Riscos e como o desenho responde

| Risco | Resposta |
|---|---|
| Transcrever 240 linhas à mão gera erro de digitação, e um erro de transcrição vira lacuna falsa | A transcrição é conferida por leitura contra o livro, e o teste de mutação (estragar um valor e ver vermelho) roda por classe, não uma vez só. Divergência isolada em uma célula é tratada como suspeita de transcrição até releitura do livro provar o contrário. |
| Tentação de gerar o catálogo a partir de `dados/` para poupar trabalho | Proibido pelo cabeçalho do catálogo e verificável na revisão: um catálogo gerado bate 240/240 no confronto 2 sem esforço, o que é o sintoma, não a prova. |
| Muitas falhas de uma vez lidas como muitos bugs (erro 6 do guia) | Se o motor comportamental vier vermelho em leva, o driver é suspeito primeiro. Nenhuma lacuna é registrada a partir de uma leva grande de falhas simultâneas. |
| Fixture irreal escondendo cobertura (erro 5) | A fixture de cada classe satisfaz os pré-requisitos do livro para aquela classe (atributo primário alto, perícias proficientes onde a Especialização exige) — não um personagem genérico de atributos 10. |
| Campo do catálogo sem consumidor (vício de relatório do guia) | Toda coluna transcrita tem consumidor: no mínimo o confronto 2 contra `dados/`. O teste de schema em `completude.test.mjs` valida todo campo que existir. |

## Critérios de pronto

- [ ] `npm run test:regras:unidade` verde, com o total novo registrado no README.
- [ ] Teste de mutação executado: um valor estragado no catálogo deixa o teste
      correspondente vermelho, em cada um dos dois motores.
- [ ] Nenhum `return` antecipado deixa um caso passar sem afirmar nada.
- [ ] Todo campo do catálogo tem teste que o consome e entra no schema de
      `completude.test.mjs`.
- [ ] Cobertura de 100% das 12 classes e dos 20 níveis — sem amostragem.
- [ ] Toda lacuna registrada com `tipo` e `motivo` citando arquivo e linha do
      que existe **e** do que falta.
- [ ] A suíte de paridade continua coletando 329 testes em 10 arquivos.
- [ ] README do domínio atualizado: o que foi coberto, o que ficou fora, e as
      subclasses registradas como dependência da rodada seguinte.
