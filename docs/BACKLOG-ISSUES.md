# Backlog de Issues — ZaitBr-bit/D-D_2024

> Atualizado em 2026-09-20, a partir da API do GitHub (issues abertas, sem PRs).
> Ordenado por **tipo** (Bug / Melhoria) e depois por **complexidade**. Ticket
> aqui é a issue do GitHub — ver [`TRIAGEM-ISSUES.md`](TRIAGEM-ISSUES.md) para
> o procedimento de investigar e corrigir.
>
> Uso: marque `[x]` ao fechar uma issue, ou risque a linha. Atualize a
> complexidade se a investigação real divergir da estimativa.
>
> **As 12 issues novas (#82–#94, exceto #88) foram investigadas em
> 2026-09-20** — corpo, imagens anexadas e código lidos para as 5 marcadas
> como bug; as 7 melhorias tiveram o pedido conferido contra o código
> existente, sem investigação de causa raiz (não se aplica a pedido de
> feature nova). Nenhuma correção foi feita nesta rodada — só triagem.

---

## 🐛 Bugs

### Baixa

- [x] **#87** — CONFIRMADO. **Corrigido em 2026-09-20** (sem commit ainda). Modal "Configurar Talento" (Mestre das Armas escolhendo arma p/ maestria): a lista de cards (`montarSeletor`/`cardOpcaoHtml`, `ui-opcoes.js`) tem mais itens do que cabem na área visível do modal, e o container não recorta o `overflow` corretamente contra o rodapé de botões fixos (Cancelar/Adicionar) — o círculo de seleção (`.opcao-check`, absolute) do último card parcialmente visível vaza por cima dos botões. Não é o card em si (`.opcao-check` é absolute DENTRO do próprio card, não cruza cards) — é o container do modal que não contém o scroll. A mesma correção já tinha sido feita no modal PRIMÁRIO (2026-08-13) mas nunca sincronizada com o sub-modal (`utils.js`/`abrirModal`, clone com estilos inline) — o z-index inline ficou em `1`.
- [x] **#86** — CONFIRMADO, causa raiz achada. **Corrigido em 2026-09-20** (sem commit ainda). `numberPickerHtml`/`setupNumberPicker` (`sheet/hp-descanso.js:122-186`, usado pelo modal "PV Max" e outros) renderiza a lista de rolagem (scroll picker) só até `min + 49` por performance. O mecanismo de sincronização scroll→valor tratava QUALQUER evento `scroll` nativo, inclusive o disparado ao posicionar o scroll inicial, como toque real do usuário — sobrescrevendo silenciosamente o valor real (ex. 225) pelo último item renderizado (50). Corrigido gateando a escrita atrás de um toque de verdade (`pointerdown`/`touchstart` no picker).
- [x] **#85** — CONFIRMADO, causa raiz achada. **Corrigido em 2026-09-20** (sem commit ainda). `validarAtributosManuais` (`ficha-edicao-validacoes.js:35-44`) rejeitava a proposta inteira se QUALQUER atributo passasse de 20 — mas o campo de "Edição livre" (`sheet/edicao.js`, modo manual) pré-preenche o valor FINAL de cada atributo, incluindo bônus de característica de classe que legitimamente passam de 20 (ex.: Campeão Primitivo, capstone de nível 20 do Bárbaro, até 25). Teto subiu para `TETO_ATRIBUTO_MANUAL = 30` (constante única, antes hardcoded em três lugares: validador, `max` do HTML e clamp do JS).

### Média

- [ ] **#76** — Truques/magias concedidos por característica de classe/subclasse com uso gratuito limitado não tinham o botão "Grátis" na lista principal. **Corrigido em 2026-09-20** (sem commit ainda) — ver nota detalhada abaixo. Restam só Companheiro Dracônico (Feiticeiro, a magia não é concedida automaticamente) e Terceiro Olho (Mago, formato diferente — efeito temporário escolhido, não conjuração) — os dois deliberadamente fora desta rodada, ver nota.
- [ ] **#70** — PDF não gera no Android/Chrome. Sem print/personagem no relato; precisa reproduzir em dispositivo antes de diagnosticar (Blob + `<a download>` pode estar sendo bloqueado pelo navegador/PWA). Não iniciado — depende de informação do usuário.
- [x] **#89** — CONFIRMADO por teste isolado (`personagemMulticlasse`/`subirDeNivel` direto, SEM multiclasse). **Corrigido em 2026-09-20** (sem commit ainda). Bárbaro pegando Vigoroso no nível 4 vs. no nível 16 terminavam com PV MÁXIMO final DIFERENTE — 293 vs. 317 — antes de qualquer render da ficha. A fórmula (`sincronizarBonusPvVigoroso`, junto de Tenacidade Anã e Companheiro Dracônico) só rodava em `ficha.js`, no RENDER — nunca dentro do motor de subida de nível. Extraída para uma função pura em `levelup.js` (`sincronizarBonusPvNivel`), chamada tanto no fim de `subirDeNivel` (conserta a causa raiz) quanto no render (mantém o auto-reparo existente).
- [x] **#91** — CONFIRMADO, causa raiz achada, mesma família do #76. **Corrigido em 2026-09-20** (sem commit ainda). Revelação Celestial do Aasimar (`dados/origens/especies.json`) é UMA característica (nível 3, transformação por Ação Bônus, 1x/Descanso Longo) com ESCOLHA entre 3 sub-opções (Asas Celestiais/Manto Necrótico/Transfiguração Radiante), cada uma gravada como traço PRÓPRIO no catálogo — mas o PAI nunca teve o seletor de verdade, caindo no toggle genérico. Agora o card-pai tem um `<select>` de forma + botão "Transformar"/"Encerrar transformação", grava a escolha em `char.recursos.aasimar_revelacao_ativa`, e Asas Celestiais concede o deslocamento de voo (`sheet/combate.js`). Descanso Longo encerra a transformação (`sheet/hp-descanso.js`).

### Média–Alta

- [ ] **#59** — Multiclasse Clérigo não oferece a escolha de Ordem Divina (Protetor/Taumaturgo) nem deixa preparar magias ao entrar na classe. Investigado em 2026-09-18: **não é 1 linha**. A escolha de Ordem Divina/Ordem Primal só existe no CRIADOR (`creator/passo-classe.js`/`wizard.js`, via `CLASSES_ESCOLHAS`) — o fluxo de multiclasse (`subirDeNivel`, levelup.js) não tem NENHUM passo equivalente para quando a classe nova é Clérigo/Druida. Mesmo buraco confirmado em outras concessões de "classe nova" (`opcoes.pericia_classe_nova`/`instrumento_classe_nova` são lidos por `levelup.js` mas nunca escritos por UI nenhuma). Corrigir de verdade exige um STEP NOVO no assistente de subida (`STEP_DEFINITIONS`, levelup-flow.js + card em levelup-cards.js + bind em levelup-ui.js + pendência em levelup.js + aplicar o efeito via `escolhas_classe`/`proficiencias_extra`) — feature nova, não bugfix pontual. Não iniciado.
- [ ] **#61** — Magias de outra classe se misturam ao preparar num multiclasse. Investigado em 2026-09-18: **é decisão de produto documentada, não bug** (comentário "Achado 2 da rodada 1... Tarefa 4" em `sheet/magias.js`, acima do `.map` que desenha os cartões de Preparadas por círculo). A lista de cartões mostra as preparadas de TODAS as classes de propósito — filtrar pela classe ativa esconderia o botão "Conjurar" da magia de OUTRA classe. A mitigação é o rótulo de classe em cada cartão (só aparece com >1 superfície) — MAS esse rótulo só aparece para magia normal; magia "especial" (Domínio/sempre/legado, `magiaEhEspecial`) mostra `origemLabel` genérico ("Domínio") sem dizer de qual classe. Gap residual pequeno, cosmético — a correção da #62 (fechada na 3.0.8) já deve ter eliminado a maior parte do sintoma visível relatado (a mistura media magia que tinha ido para o grimório errado). Se voltar a ser relatado depois da 3.0.8, é o rótulo de "especial" que falta corrigir.

---

## ✨ Melhorias

### Baixa

- [x] **#75** — **Corrigido em 2026-09-20** (sem commit ainda). Magias personalizadas "não preparadas" agora agrupam por círculo, cada círculo com o mesmo `<details>`/botão de minimizar que os blocos "Nº Círculo" da lista de Preparadas já usam.
- [x] **#92** — **Corrigido em 2026-09-20** (sem commit ainda), junto do #75. A seção inteira ("Personalizadas não preparadas") passou a nascer SEM o atributo `open` — minimizada por padrão, como as outras.
- [ ] **#84** — Renomear o ícone/atalho "Custom" para "+ Item Personalizado" — clareza de rótulo, sem lógica nova.
- [ ] **#90** — Minimizar por padrão as opções de troca de truque/magia ao subir de nível (poluição visual no assistente de level-up).

### Baixa–Média

- [ ] **#77** — Voltar ao modelo da 3.0.1: magia personalizada do Mago, ao ser retirada do grimório, vai para a lista de "copiar para o grimório" (pagando PO/tempo) em vez de ficar só como candidata do toggle. Mesmo pedido de fundo do comentário de truque na #74 (**já resolvido para truque**) — este é o pedido simétrico para magia de círculo 1+ do Mago especificamente, tocando `mostrarBuscaGrimorio`.

### Média

- [ ] **#22** — Modo escuro. Nenhum `prefers-color-scheme`/`data-theme` hoje; exige tokenizar cores em CSS custom properties.
- [x] **#37** — **Corrigido em 2026-09-20** (sem commit ainda). Item customizado ganhou `bonus_ataque_magia`/`bonus_cd_magia`, somados em `calcAtaqueMagia`/`calcCDMagia`/`conjuracoesPorClasse` (utils.js) quando o item está equipado (e sintonizado, se exigir).
- [x] **#82** — **Corrigido em 2026-09-20** (sem commit ainda), junto do #37. Item customizado ganhou categoria de arma (simples/marcial × corpo a corpo/distância), propriedades e maestria — plugado no MESMO bloco de cálculo de proficiência/ataque/dano que uma arma de catálogo usa (`sheet/inventario.js`), em vez do bônus bruto fixo de antes. Maestria em item customizado é informativa (não entra na lista de escolha de maestria do personagem, que só lê o catálogo) — ver comentário em `inventario.js`.

### Média–Alta

- [ ] **#80** — Linhas customizadas no inventário (além de Equipados/Mochila/Esgotados), com opção de a linha contar ou não no peso, e mover itens entre linhas. Modelo de dados novo (contêiner nomeado) + UI de mover item.
- [ ] **#83** — Modificar recursos temporariamente (CA, iniciativa, deslocamento etc.), inclusive quando o efeito vem de OUTRO personagem (ex.: Armadura Arcana lançada por um aliado). Conferido: `char.efeitos_magicos` (`sheet/combate.js`, `sheet/condicoes.js`, `sheet/hp-descanso.js`) já existe e já tem pelo menos um tipo não-concentração implementado (`tipo: 'bonus_pv_max'`, hp-descanso.js:567-603) — a infra é menos nova do que parecia; falta estender os `tipo`s (CA, iniciativa, deslocamento) e a UI para atribuir um efeito a um alvo/fonte.
- [ ] **#93** — Sentidos passivos (Visão no Escuro, Visão às Cegas, Sismoconsciência, Visão Verdadeira) concedidos por magia/traço/item não aparecem na ficha. Conferido: não existe NENHUM campo `sentidos_passivos`/tratamento equivalente em `sheet/ficha.js`/`sheet/combate.js` hoje — gap real, não regressão. Precisa mapear cada fonte que concede sentido e escrever no bloco de sentidos da ficha, com prioridade entre fontes (ex.: dois "Visão no Escuro" de alcances diferentes).
- [ ] **#94** — CONFIRMADO por leitura de código, não só relato. `DESCRICOES_CONDICAO` (`sheet/condicoes.js:60-69`) já tem o TEXTO correto do livro para cada condição ("Contido: Deslocamento 0..."), mas é só rótulo exibido — `getDeslocamentoFinal` (`sheet/combate.js:153+`) nunca lê `char.condicoes`, só Amedrontado/Envenenado entram em desvantagem de perícia/ataque em outro ponto do mesmo arquivo. Confirma o padrão "texto certo, efeito não aplicado" (a armadilha mais comum do TRIAGEM-ISSUES.md) para deslocamento zerado (Contido/Paralisado/Petrificado/Inconsciente), quebra de concentração por Incapacitado, resistência/imunidade de Petrificado. Escopo grande — cada condição é um mini-mecanismo espalhado por várias funções (deslocamento, concentração, resistências, vantagem/desvantagem).

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
- **Cluster "magia/truque personalizado"**: #68, #71, #73, #74 fechados na 3.0.7; #78 fechado na 3.0.8; #75/#92 fechados na 3.0.10. #77 continua aberto, mesma área.
- **#59/#61**: mesmo cluster de multiclasse Clérigo que trouxe a #62 (já fechada). Investigadas a fundo em 2026-09-18 — ver os itens acima para o porquê de nenhuma das duas ser um bugfix de 1 linha.
- **Triagem de #82–#94 em 2026-09-20**: as 5 marcadas bug (#85, #86, #87, #89, #91) foram todas CONFIRMADAS com causa raiz no código — nenhuma virou "não reproduz" ou "não é bug". Duas (#91, e o #76 antes dela) compartilham o mesmo padrão: característica com escolha entre sub-opções, card genérico não oferece seletor. #89 foi confirmada por teste isolado (harness de unidade), sem precisar reproduzir em navegador. As 7 melhorias (#82-#84, #90, #92-#94) tiveram o pedido conferido contra o código (não é "bug", não tem causa raiz a achar) — duas boas candidatas a consolidar com issues já na lista (#82→#37, #92→#75).
- **Correção das 5 bugs + 2 melhorias, 2026-09-20** (sem commit ainda, versão 3.0.10): #85, #86, #87, #89, #91, #37/#82, #75/#92 — todas corrigidas com TDD (RED confirmado antes de cada GREEN) e e2e com clique real para toda mudança visível. Item customizado com categoria de arma decidiu mostrar a maestria como badge INFORMATIVO, não gated por `char.maestrias_arma` — esse array só aceita nomes de armas do catálogo (o modal de escolha de maestria, `sheet/maestrias.js`, nunca ofereceria um item customizado), gatear do mesmo jeito deixaria o campo sempre inerte. Regressão completa: 4279 testes de unidade (1 falha pré-existente e não relacionada, `druida-forma-acao=encerrar` em `gatilhos-ui-cobertos.test.mjs`, já presente antes desta rodada — não investigada, fora do escopo destas 7 issues), e2e sem falhas nas suítes tocadas (item-customizado, magia-personalizada, aasimar, modal-rodape, pv-max-override, vigoroso-levelup, edicao-manual-atributos, multiclasse-caracteristicas/handlers).
- Ao fechar uma issue por commit, o formato de mensagem e o `Closes #N` estão documentados em [`TRIAGEM-ISSUES.md`](TRIAGEM-ISSUES.md#a-mensagem-de-commit-que-fecha-a-issue).
- Esta lista não inclui issues fechadas nem Pull Requests. Para atualizar do zero, repita a consulta:
  ```bash
  curl -s "https://api.github.com/repos/ZaitBr-bit/D-D_2024/issues?state=open&per_page=100"
  ```
