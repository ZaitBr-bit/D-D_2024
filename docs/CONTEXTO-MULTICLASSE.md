# Contexto: issue #15 (multiclasse) — estado em 2026-08-24

Documento de handoff. Leia isto antes de retomar o trabalho de multiclasse em
sessão nova.

---

## Onde o trabalho vive

- **Worktree:** `C:/ControleVersaoGit/Pessoal/worktrees/D-D_2024-multiclasse`
- **Branch:** `multiclasse`, a partir de `34d8f2d` (main)
- **Nada foi mesclado no `main`.** São 7 commits na branch.
- **O livro** (`Informacoes Separadas/*.md`) é local e gitignored — está copiado
  na worktree.

---

## O que já foi entregue

| Commit | Sub-projeto | Versão |
|---|---|---|
| `7962878` | **3a** — contexto por classe; a seção de Características usa o nível NA classe | 2.2.17 |
| `d0c99fd` | **3b** — `renderFeatureItem` e os 12 módulos de classe; 144 conversões | 2.2.18 |
| `bc8c286` | Aposenta a suíte de paridade; cobre os 7 gatilhos que ela segurava | — |
| `365190f` | Oráculo de alcance do render: cobertura de 7/145 → 140/145 | — |
| `2dae403` | **3c** — handlers de clique; 61 conversões | 2.2.19 |
| `12a541b` | Monge com escudo perde a Defesa sem Armadura (**classe única**) | — |
| `a5812a9` | **3d** — combate e defesas: Ataque Extra, CA, Maestria, salvaguardas | 2.2.20 |

Antes disso, na mesma linha: `a2dd900` (fundação — `regras-multiclasse.js`,
migração, `proficiencias_multiclasse`) e `c0e8359` (motor de conjuração e
progressão).

**Estado dos testes:** unidade **3580 / 3323 pass / 0 fail**; e2e de regras
**289 / 0**. Os três guardas estáticos: render **25/0**, handlers **4/0**,
combate **15/0**.

---

## O defeito central, para quem chega agora

O personagem guarda `classes[]` (a fonte da verdade) **e** três espelhos que
apontam para a classe **inicial**: `char.classe`, `char.subclasse` e
`char.nivel` — este último é o **total**.

Quase todo o app lia os espelhos. Num Clérigo 5/Paladino 5, o bloco do Paladino
recebia a identidade do Clérigo.

As três funções que resolvem isso vivem em `site/js/regras-multiclasse.js`:

```js
temClasse(p, nome)      // o personagem tem essa classe?
nivelNa(p, nome)        // nivel NAQUELA classe; 0 se ausente
subclasseDe(p, nome)    // subclasse DAQUELA classe; '' se ausente
```

**`nivelNa` devolve 0 para classe ausente**, então `nivelNa(p,'X') >= 5` já é
falso sem guarda — **não acrescente `temClasse` junto**, foi medido.

---

## O que falta

| # | Sub-projeto | Estado |
|---|---|---|
| **3e** | PV, dados de vida e descansos | **spec escrito**, plano não |
| 4 | Magias e espaços | motor pronto desde `c0e8359`; falta ligar |
| 5 | Subida de nível com escolha de classe | **é o que torna multiclasse alcançável** |
| — | Proficiências reduzidas de multiclasse | menor do que parece — ver abaixo |

### A ordem importa, e há um pré-requisito bloqueante

**O sub-projeto 5 não pode entrar antes do 3e.** Medido no mapeamento do 3e:
`sincronizarEspelhos` **apaga dados de vida gastos** num multiclasse. Hoje não
dispara porque `migrarParaMulticlasse` retorna cedo com 2+ classes — mas o 5, ao
fazer a subida escrever em `classes[]`, vai chamá-la e perder o gasto do
jogador.

**Nada disso é alcançável por um jogador hoje.** Não existe fluxo de UI que crie
personagem multiclasse — só JSON forjado chega lá, e `_validarPersonagem`
(`store.js:234-236`) filtra os malformados. É o sub-projeto 5 que abre a porta.

---

## O próximo passo: 3e

**Spec:** `docs/superpowers/specs/2026-08-24-multiclasse-descansos-design.md`
**Mapa com as medições:** `.superpowers/sdd/2026-08-24-multiclasse-descansos/mapa-escopo.md`

**93 leituras**, mas o peso engana: 63 estão em **24 blocos** de restauração de
recurso (12 classes × 2 descansos) com a mesma forma, e cada bloco já é guardado
por um `getEstadoRecursos*` convertido. A unidade de trabalho é o **bloco**.

O que é profundo e pequeno: **PV e dados de vida, 11 leituras.**

**Quatro decisões de produto já tomadas** (estão no spec, com o porquê):

1. Dado de Vida gasto no Descanso Curto → **seletor por tipo**, só com mais de um
   tipo (precedente do seletor de CA do 3d).
2. Resiliência Dracônica → **corrigir a fórmula** (`+N`, não `+N+2`), e dizer na
   nota de versão que Feiticeiros Dracônicos existentes perdem 2 PV.
3. Cabeçalho da ficha → **mostrar todas as classes**.
4. Campos mortos da impressão (`pv_temp`, `dados_vida_disponiveis`) → **fechar**.

**O achado de PV, para dimensionar:** com CON +2, um Mago 5/Bárbaro 5 tem 62 no
app contra 77 no livro; invertendo a ordem, 95 contra 80. **33 PV de diferença
entre dois personagens que o livro diz serem idênticos.** A fórmula correta já
está escrita em `testes/regras/unidade/harness.mjs:394-405` e serve de referência
independente para o oráculo.

---

## Como este projeto trabalha — e por que

Cada sub-projeto segue **spec → plano → execução por subagentes → revisão final
de branch**, com o skill `superpowers:subagent-driven-development`. O ledger de
cada um vive em `.superpowers/sdd/<plano>/progress.md` e registra rulings,
achados e erros.

### A lição que se repetiu em todos

> **A pergunta ao escrever um oráculo não é "este caso exercita a regra?" e sim
> "qual implementação errada sobreviveria a este caso?"**

Ela apareceu **treze vezes**. Os casos mais caros:

- um oráculo de CD passava com o **atributo errado**, porque o fixture tinha
  Força 15 e Carisma 15 — modificadores iguais;
- o caso óbvio de Ataque Extra (Guerreiro 5/Bárbaro 5) **acerta por acaso** hoje,
  e é exatamente o fixture que um teste de fumaça escolheria;
- um fixture de Maestria "Bárbaro 4 (3)/Guerreiro 3 (3) → 3" rejeita a soma e
  **mais nada** — as duas pontas dão 3.

**Quatro implementadores diferentes rejeitaram fixtures meus** por esse motivo,
antes de escrevê-los. É o comportamento certo.

### A segunda lição: confirmar que a mutação mutou

Provar um oráculo por mutação **exige confirmar que a mutação aconteceu** —
`print(alvo in texto)` antes, releitura do disco depois.

**Caí nisso duas vezes nesta sessão:** o trecho não casava (diferença de
terminador de linha), o script não avisava, e eu quase registrei "o oráculo
sobreviveu" como achado, com o instrumento cego.

### A terceira: guardas estáticos são sintáticos

Os três guardas (`*-alcance.test.mjs`) leem o arquivo e exigem zero leituras de
espelho, com exceções declaradas **por texto e com o motivo escrito**. Eles
pegaram 140/145 no 3b e 36/36 no 3d.

**Mas a revisão final do 3d mediu o que eles não pegam:** dos 19 defeitos
plausíveis, **4 escapavam de tudo** — porque reverter um valor calculado para um
literal **não reintroduz espelho nenhum**. Guarda estático mede um arquivo;
conserto de tela é medido por um **clique**. Os dois são necessários.

Série do esforço: **3b 7/145 presos → 3c 55/60 escapavam → 3d 4/19.**

---

## Armadilhas operacionais deste repositório

- **Terminadores de linha variam por arquivo.** `habilidades.js` e os módulos de
  classe são CRLF; `regras-salvaguardas.js` é LF. Use `python` com `newline=''`.
  **`sed -i` converte o arquivo inteiro para LF** e já causou ruído.
- **`grep -c $'\r'` MENTE** no Git Bash em modo texto. Use `file -b`, `od -c` ou
  Python com bytes.
- **`grep -o "char.nivel"` conta comentário**, e este projeto exige comentário em
  toda conversão. Exclua comentários antes de contar.
- **Use `git diff --ignore-cr-at-eol`** — os módulos têm CRLF no blob desde
  `f68f24d`.
- **Nunca `git checkout --` para desfazer mutação de teste** sem antes conferir
  que não há trabalho não commitado no arquivo. Um revisor reverteu arquivos
  inteiros ao HEAD assim.
- **`docs/PERGUNTAS-PENDENTES.txt` é CRLF e sem acentos.** Anexe com Python.

---

## Dívidas registradas

Todas estão em `docs/PERGUNTAS-PENDENTES.txt`, com fixture e medição. As que
mais pesam:

1. **A suíte de paridade foi aposentada** (`bc8c286`) e com ela o único
   instrumento **transversal** do projeto. O substituto são os guardas de
   alcance, que são por arquivo.
2. **O guarda de gatilhos tem ponto cego:** só enxerga `data-*-acao=`, então
   `data-config-maestrias` e `data-escolher-estilo-luta-extra` **escapam do
   inventário em silêncio**. Ampliar o extrator faria a lista de sem-cobertura
   **crescer**, o que colide com a regra "a lista só encolhe" — precisa de
   decisão própria.
3. **Proficiências reduzidas de multiclasse:** o dado
   (`proficiencias_multiclasse`) **já existe para as 12 classes** desde `a2dd900`,
   com oráculo. **Falta o consumo.** Pior caso medido: Ladino 5/Guerreiro 5
   esconde **19 de 38** armas no modal do Guerreiro.
4. **`inventario.js:350`** — a Fúria não é desligada por armadura pesada num
   Ladino 1/Bárbaro 5, enquanto o painel da ficha **avisa** que ela está
   equipada. O app avisa e não age.
5. **Flake pré-existente na e2e sob carga** (~1 em 24): `truques-contador-origens`,
   `antecedentes`, `talentos-levelup`, `subclasse-magias-levelup`. Se caírem,
   rode isolado antes de culpar a mudança.

---

## Erros meus, registrados porque o padrão importa

Vinte e cinco achados dos implementadores foram erros do **meu** material. Três
deles são do mesmo tipo, e vale nomear:

> **Descrevi como "o dado não existe" ou "o código contradiz o livro" coisas que
> eu não fui verificar na fonte.**

- `proficiencias_multiclasse` estava transcrito para as 12 classes desde o 3a —
  e eu adiei um sub-projeto inteiro supondo que era transcrição de catálogo.
- A condição do Bardo (Colégio da Dança) estava no livro **cinco linhas acima**
  de onde olhei; o código estava certo e eu registrei que estava errado.
- Escrevi numa nota `RESOLVIDO` que um oráculo "prova contra HEAD em 107.520
  combinações". Ele não prova — aquela foi medição **transitória**; o oráculo
  durável congela 2.016 combinações contra as **citações do livro**.

**Antes de escrever "falta X" num spec, faça `grep` por X.**
