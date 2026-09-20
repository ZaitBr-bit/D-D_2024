# Backlog de Issues — ZaitBr-bit/D-D_2024

> Atualizado em 2026-09-20, a partir da API do GitHub (issues abertas, sem PRs).
> Ordenado por **tipo** (Bug / Melhoria) e depois por **complexidade**. Ticket
> aqui é a issue do GitHub — ver [`TRIAGEM-ISSUES.md`](TRIAGEM-ISSUES.md) para
> o procedimento de investigar e corrigir.
>
> Uso: marque `[x]` ao fechar uma issue, ou risque a linha. Atualize a
> complexidade se a investigação real divergir da estimativa.
>
> **12 issues novas desde a última atualização** (#82–#94, exceto #88 que não
> existe) entraram nesta revisão só por TÍTULO/descrição do relato — sem
> abrir o código ainda. Marcadas "não investigada" abaixo; tratar como
> estimativa solta, não como o veredito de 1-linha-ou-não que as demais têm.

---

## 🐛 Bugs

### Baixa (não investigada)

- [ ] **#87** — Talento Mestre das Armas: ao escolher a arma para maestria, os círculos de seleção ficam sobrepondo os botões. Cheiro de CSS (z-index/layout do dropdown), mas não confirmado.
- [ ] **#86** — Teto de PV máximo travado em 50 — muito baixo para personagem de nível alto (dano/cura também escalam). Cheiro de constante hardcoded num validador de edição manual.

### Média

- [ ] **#76** — Truques/magias concedidos por característica de classe/subclasse com uso gratuito limitado não tinham o botão "Grátis" na lista principal. **Corrigido em 2026-09-20** (sem commit ainda) — ver nota detalhada abaixo. Restam só Companheiro Dracônico (Feiticeiro, a magia não é concedida automaticamente) e Terceiro Olho (Mago, formato diferente — efeito temporário escolhido, não conjuração) — os dois deliberadamente fora desta rodada, ver nota.
- [ ] **#70** — PDF não gera no Android/Chrome. Sem print/personagem no relato; precisa reproduzir em dispositivo antes de diagnosticar (Blob + `<a download>` pode estar sendo bloqueado pelo navegador/PWA). Não iniciado — depende de informação do usuário.
- [ ] **#85** — Atributos manuais: um Bárbaro com Força 22 (base) não consegue editar NENHUM outro atributo, parece que o teto do personagem trava todos os campos pelo valor de um só. Não investigada.
- [ ] **#89** — Talento Vigoroso: o bônus de PV (2x nível + 2/nível) muda de valor dependendo de EM QUE NÍVEL o talento é pego — sugere que o cálculo usa o nível ATUAL no momento da escolha em vez de recalcular retroativo, como Constituição já faz. Não investigada, mas o padrão de correção (`aplicarPvRetroativoPorCon`) já existe no código para copiar.
- [ ] **#91** — Aasimar/Revelação Celestial: as opções aparecem todas com selo "Ativa", mas só uma tem botão de usar. Mesma família de bug do #76 (característica com escolha entre opções, card genérico não trata direito).

### Média–Alta

- [ ] **#59** — Multiclasse Clérigo não oferece a escolha de Ordem Divina (Protetor/Taumaturgo) nem deixa preparar magias ao entrar na classe. Investigado em 2026-09-18: **não é 1 linha**. A escolha de Ordem Divina/Ordem Primal só existe no CRIADOR (`creator/passo-classe.js`/`wizard.js`, via `CLASSES_ESCOLHAS`) — o fluxo de multiclasse (`subirDeNivel`, levelup.js) não tem NENHUM passo equivalente para quando a classe nova é Clérigo/Druida. Mesmo buraco confirmado em outras concessões de "classe nova" (`opcoes.pericia_classe_nova`/`instrumento_classe_nova` são lidos por `levelup.js` mas nunca escritos por UI nenhuma). Corrigir de verdade exige um STEP NOVO no assistente de subida (`STEP_DEFINITIONS`, levelup-flow.js + card em levelup-cards.js + bind em levelup-ui.js + pendência em levelup.js + aplicar o efeito via `escolhas_classe`/`proficiencias_extra`) — feature nova, não bugfix pontual. Não iniciado.
- [ ] **#61** — Magias de outra classe se misturam ao preparar num multiclasse. Investigado em 2026-09-18: **é decisão de produto documentada, não bug** (comentário "Achado 2 da rodada 1... Tarefa 4" em `sheet/magias.js`, acima do `.map` que desenha os cartões de Preparadas por círculo). A lista de cartões mostra as preparadas de TODAS as classes de propósito — filtrar pela classe ativa esconderia o botão "Conjurar" da magia de OUTRA classe. A mitigação é o rótulo de classe em cada cartão (só aparece com >1 superfície) — MAS esse rótulo só aparece para magia normal; magia "especial" (Domínio/sempre/legado, `magiaEhEspecial`) mostra `origemLabel` genérico ("Domínio") sem dizer de qual classe. Gap residual pequeno, cosmético — a correção da #62 (fechada na 3.0.8) já deve ter eliminado a maior parte do sintoma visível relatado (a mistura media magia que tinha ido para o grimório errado). Se voltar a ser relatado depois da 3.0.8, é o rótulo de "especial" que falta corrigir.

---

## ✨ Melhorias

### Baixa

- [ ] **#75** — Organizar as magias personalizadas "não preparadas" por círculo, com botão de minimizar por círculo (mesmo padrão visual dos blocos "Nº Círculo" que a lista de Preparadas já usa).
- [ ] **#92** — Mesmo pedido do #75, com um ângulo a mais: a lista de personalizadas não-preparadas deveria nascer MINIMIZADA por padrão (hoje só as outras seções nascem assim). **Consolidar com #75** — provável mesma correção.
- [ ] **#84** — Renomear o ícone/atalho "Custom" para "+ Item Personalizado" — clareza de rótulo, sem lógica nova.
- [ ] **#90** — Minimizar por padrão as opções de troca de truque/magia ao subir de nível (poluição visual no assistente de level-up).

### Baixa–Média

- [ ] **#77** — Voltar ao modelo da 3.0.1: magia personalizada do Mago, ao ser retirada do grimório, vai para a lista de "copiar para o grimório" (pagando PO/tempo) em vez de ficar só como candidata do toggle. Mesmo pedido de fundo do comentário de truque na #74 (**já resolvido para truque**) — este é o pedido simétrico para magia de círculo 1+ do Mago especificamente, tocando `mostrarBuscaGrimorio`.

### Média

- [ ] **#22** — Modo escuro. Nenhum `prefers-color-scheme`/`data-theme` hoje; exige tokenizar cores em CSS custom properties.
- [ ] **#37** — Itens customizados com bônus mecânicos (CD de magia, ataque de magia, propriedades, maestria de arma) — formulário já tem raridade/preço/sintonização; falta plugar no motor de cálculo.
- [ ] **#82** — Mesmo pedido do #37, focado em ARMAS: simples/marcial, propriedades, maestria, e qual modificador usar no cálculo automático de CD/ataque de magia. **Consolidar com #37**.

### Média–Alta

- [ ] **#80** — Linhas customizadas no inventário (além de Equipados/Mochila/Esgotados), com opção de a linha contar ou não no peso, e mover itens entre linhas. Modelo de dados novo (contêiner nomeado) + UI de mover item.
- [ ] **#83** — Modificar recursos temporariamente (CA, iniciativa, deslocamento etc.), inclusive quando o efeito vem de OUTRO personagem (ex.: Armadura Arcana lançada por um aliado). Precisa de um modelo de "efeito temporário com fonte" — expandir `char.efeitos_magicos` (já existe para concentração) para cobrir bônus numéricos genéricos.
- [ ] **#93** — Sentidos passivos (Visão no Escuro, Visão às Cegas, Sismoconsciência, Visão Verdadeira) concedidos por magia/traço/item não aparecem na ficha — só o efeito mecânico "solto", sem refletir no campo de sentidos. Precisa mapear cada fonte que concede sentido e escrever no bloco de sentidos da ficha, com prioridade entre fontes (ex.: dois "Visão no Escuro" de alcances diferentes).
- [ ] **#94** — Condições (Contido, Enfeitiçado, etc.) deveriam aplicar TODOS os efeitos mecânicos que a condição concede (ex.: Contido zera deslocamento, não só dá desvantagem em Destreza) — hoje só uma parte do efeito de cada condição é aplicada.

### Alta

- [ ] **#69** + **#65** + **#14** — Reduzir/retroceder nível com histórico de progressão. **Consolidar as três** — #14 já propõe o desenho técnico (snapshot por nível).
- [ ] **#38** + **#52** — Talentos customizados/criação de talentos. **Consolidar as duas.**
- [ ] **#41** — Antecedentes customizados (concede atributo + perícia + talento de origem + equipamento — 4 integrações no criador).
- [ ] **#53** — Montaria na ficha (entidade nova, bloco de estatísticas de criatura).
- [ ] **#23** + **#26** — Espécie customizada / Warforged. **Consolidar as duas** (espécie alimenta deslocamento, sentidos, truques, resistências).

### Muito alta

- [ ] **#40** — Classe e subclasse customizadas (núcleo do app: progressão, conjuração, dado de vida, características por nível).
- [ ] **#47** + **#32** — Homebrew geral com alteração de bônus / homebrew de raças-classes-origens + compartilhar. **Guarda-chuva de #23/#38/#40/#41** — considerar fechar como duplicata se as específicas cobrirem o pedido.

### Fora do escopo atual

- [ ] **#18** — Subclasse Paladino Juramento dos Gênios Nobres (Heroes of Faerûn — fora do PHB 2024).
- [ ] **#28** — Subclasse Guerreiro do Eco (Wildemount, 5e 2014 — sem versão 2024).
- [ ] **#56** — Compatibilidade com iOS 15. Falta diagnóstico: precisa saber qual API/recurso quebra no dispositivo antes de estimar.

---

## Notas de manutenção

- **#76, estado em 2026-09-20 (sem commit ainda)**: mapeadas 17 características de classe/subclasse com uso grátis limitado, em 9 classes. 8 corrigidas de verdade:
  - **Uso ÚNICO** (`gratis_usado` booleano, via `featureConcedeUsoGratisSemEspaco`/`_concederMagiaAutomatica` em levelup.js): Contatar Patrono (Bruxo 9), Destruição do Paladino (Paladino 2), Montaria Fiel (Paladino 5).
  - **Uso MÚLTIPLO/escalado por atributo** (adaptador novo, `site/js/regras-usos-gratis-magia.js`, lido por sheet/magias.js — lê/escreve o MESMO `char.recursos.<classe>.*` que os painéis de recursos já liam): Inimigo Favorito e Reforços Feéricos/Andarilho Nebuloso (Guardião), Mapa Estelar (Druida/Círculo das Estrelas).
  - **Migração de verdade** (não só correção nova): Criaturas Espectrais (Ilusionista), Manto de Majestade (Bardo/Glamour) e Destruição do Paladino tinham BOOKKEEPING PRÓPRIO com botão dedicado que só toastava "conjurado gratuitamente" sem tocar no `gratis_usado` real — achado em revisão, não no comentário original da issue. Os três botões antigos (e o estado que eles liam) foram APAGADOS, não só desligados; o card de Características de Classe agora mostra "Ver Magias" para essas, e o botão real vive só na lista de Magias.
  - Suprimido também o toggle/contador GENÉRICO do card (`data-toggle-uso`/`data-usar-habilidade`, `char.usos_habilidades`) para as 8 características acima — sem isso, o card abriria uma terceira/quarta UI, desincronizada, para o mesmo uso.
  - **Fora desta rodada, de propósito**: Companheiro Dracônico (Feiticeiro 18) — a magia (Invocar Dragão) não é concedida automaticamente, o bônus de uso grátis só existe SE o jogador já a escolheu por outro caminho; teria de ser um mecanismo novo (detectar se já conhece, marcar retroativo), não os dois já construídos. Terceiro Olho (Mago 10) — é um efeito temporário ESCOLHIDO por Ação Bônus (3 opções, só 1 é magia), não uma conjuração; não tem onde pendurar um botão "Grátis" de magia. Intervenção Divina (Clérigo) e Recuperação Natural (Druida) ficaram fora por decisão do dono do produto — "conjure qualquer magia que você já conheça" pede um seletor que não existe hoje.
  - Cobertura: 4257 testes de unidade (0 falhas), 456 specs e2e (0 falhas, 1 flake sob paralelismo confirmado — passa consistente isolado). 3 bugs reais de dupla-contabilidade encontrados e corrigidos em revisão ANTES do commit (Manto de Majestade, colisão de nome "Passo Nebuloso" com o talento Tocado Por Fadas, Destruição do Paladino) — nenhum chegou a ser publicado.
- **Fechadas na versão 3.0.8** (commit `ea43e7d`, 2026-09-18): #81, #67, #78, #62 (corrigidas com teste); #79 e #66 (investigadas, não reproduziram — fechadas com teste de regressão, sem alteração de produção). Histórico do que cada uma era fica só no commit e no GitHub a partir daqui; esta lista não guarda issue fechada.
- **Cluster "magia/truque personalizado"**: #68, #71, #73, #74 fechados na 3.0.7; #78 fechado na 3.0.8. #75/#92 e #77 continuam abertos, mesma área — considerar uma janela de trabalho dedicada antes de passar para outro assunto.
- **#59/#61**: mesmo cluster de multiclasse Clérigo que trouxe a #62 (já fechada). Investigadas a fundo em 2026-09-18 — ver os itens acima para o porquê de nenhuma das duas ser um bugfix de 1 linha.
- **Issues novas não investigadas** (#82–#87, #89–#94): entraram nesta lista só por título/corpo do relato, sem abrir código. Investigar antes de estimar complexidade de verdade ou prometer prazo.
- Ao fechar uma issue por commit, o formato de mensagem e o `Closes #N` estão documentados em [`TRIAGEM-ISSUES.md`](TRIAGEM-ISSUES.md#a-mensagem-de-commit-que-fecha-a-issue).
- Esta lista não inclui issues fechadas nem Pull Requests. Para atualizar do zero, repita a consulta:
  ```bash
  curl -s "https://api.github.com/repos/ZaitBr-bit/D-D_2024/issues?state=open&per_page=100"
  ```
