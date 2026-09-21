# Backlog de Issues — ZaitBr-bit/D-D_2024

> Revalidado em 2026-09-20, a partir da API do GitHub (issues abertas, sem PRs).
> Ordenado por **tipo** (Bug / Melhoria) e depois por **complexidade**. Ticket
> aqui é a issue do GitHub — ver [`TRIAGEM-ISSUES.md`](TRIAGEM-ISSUES.md) para
> o procedimento de investigar e corrigir.
>
> Uso: marque `[x]` ao fechar uma issue, ou risque a linha. Atualize a
> complexidade se a investigação real divergir da estimativa.
>
> **Revalidação de 2026-09-20 (à tarde)**: #85, #86, #87, #89, #91, #37, #75,
> #82, #92 foram corrigidas e fechadas pelo commit `2e334ee` (`Closes #N`,
> versão 3.0.10) — removidas desta lista (issue fechada não fica aqui, ver
> nota no rodapé). Uma issue nova entrou desde a triagem da manhã: **#95**.
> Depois disso, #84, #90 e #77 também foram corrigidas e fechadas pelo
> commit `3006455` (versão 3.0.11) — ver notas de manutenção.
>
> **Revalidação de 2026-09-20 (à noite)**: seis issues novas — **#96 a
> #101**. #96 e #97 foram corrigidas e fechadas pelo commit `a0f9c53`
> (versão 3.0.12) — ver notas de manutenção. #100 e #101 continuam sendo
> follow-up direto da correção do #82/#37; #98 é do mesmo cluster geral
> "magia/truque personalizado", mas pedido novo, não follow-up de #75/#92.
>
> **Revalidação de 2026-09-20 (mais tarde)**: nenhuma issue nova desde a
> última checagem — só a confirmação de que #96/#97 fecharam de verdade
> no GitHub (28 issues abertas, contagem batendo uma a uma com esta lista).
>
> **#59 planejada e implementada em 2026-09-20**: multiclasse Clérigo/
> Druida ganhou o passo de Ordem Divina/Primal no assistente de subida
> (commit `daa8b9e`, versão 3.0.13). Um usuário externo comentou na issue
> ainda aberta relatando o comportamento antigo — era a versão publicada
> (3.0.12, sem a correção ainda), não um bug novo. O dono do produto testou
> a correção na hora e achou um segundo gap real: o auto-abrir de "Preparar
> Magias" só cobria ENTRADA NOVA via multiclasse, não subida de nível comum
> (ex.: Clérigo classe única indo do nível 1 pro 2) — corrigido na sequência
> (versão 3.0.14, sem commit ainda) — ver notas de manutenção.

---

## 🐛 Bugs

### Baixa

_(nenhuma nesta faixa no momento — #97 fechada, ver notas de manutenção)_

### Média

- [ ] **#70** — PDF não gera no Android/Chrome. Sem print/personagem no relato; precisa reproduzir em dispositivo antes de diagnosticar (Blob + `<a download>` pode estar sendo bloqueado pelo navegador/PWA). Não iniciado — depende de informação do usuário.

### Média–Alta

- [ ] **#61** — Magias de outra classe se misturam ao preparar num multiclasse. Investigado em 2026-09-18: **é decisão de produto documentada, não bug** (comentário "Achado 2 da rodada 1... Tarefa 4" em `sheet/magias.js`, acima do `.map` que desenha os cartões de Preparadas por círculo). A lista de cartões mostra as preparadas de TODAS as classes de propósito — filtrar pela classe ativa esconderia o botão "Conjurar" da magia de OUTRA classe. A mitigação é o rótulo de classe em cada cartão (só aparece com >1 superfície) — MAS esse rótulo só aparece para magia normal; magia "especial" (Domínio/sempre/legado, `magiaEhEspecial`) mostra `origemLabel` genérico ("Domínio") sem dizer de qual classe. Gap residual pequeno, cosmético — a correção da #62 (fechada na 3.0.8) já deve ter eliminado a maior parte do sintoma visível relatado (a mistura media magia que tinha ido para o grimório errado). Se voltar a ser relatado depois da 3.0.8, é o rótulo de "especial" que falta corrigir.

---

## ✨ Melhorias

### Baixa

- [ ] **#99** (NOVA, 2026-09-20, não investigada) — Textos antigos gravados sem acento/Ç ("descricao", "PRECO" etc., prints anexados na issue). Provável dado/rótulo legado de quando o campo não aceitava esses caracteres — precisa achar se é rótulo fixo na UI (troca de 1 linha por lugar) ou dado gravado no personagem (migração). Não investigado.

### Baixa–Média

- [ ] **#98** (NOVA, 2026-09-20, não investigada) — Pede um campo de "Círculo Superior" (texto livre) no formulário de magia personalizada, pro jogador descrever o efeito de upcast da própria magia — hoje o formulário não tem esse campo, então a magia personalizada nunca mostra a caixa "Em círculos superiores" que a magia do livro mostra (ver render em `sheet/grimorio.js`/`sheet/magias.js`, campo `circulo_superior`). Mesmo cluster de "magia/truque personalizado" das issues #68/#71/#73/#74/#75/#92 (todas fechadas) — cabe na mesma área de trabalho.

### Média

- [ ] **#22** — Modo escuro. Nenhum `prefers-color-scheme`/`data-theme` hoje; exige tokenizar cores em CSS custom properties.
- [ ] **#100** (NOVA, 2026-09-20, não investigada) — Pede mais categorias pro item personalizado além de arma (Armadura, Consumível, Munição, Equipamento, Item Mágico, Ferramenta), e trocar o rótulo "Não é arma" por um estilo mais parecido com o de Raridade (vazio = sem categoria). Extensão direta do #82/#37 (que só adicionou categoria de ARMA ao formulário) — mesma área, mesmo padrão de select.
- [ ] **#101** (NOVA, 2026-09-20, não investigada) — Pede reorganizar o formulário de item personalizado em seções colapsáveis (Nome/Descrição, Categoria+Propriedades+Maestria, Atributos, Raridade+Sintonização, Preço) — hoje tudo aparece junto, sem separação visual. Ficou mais denso depois do #82/#37 (que acrescentou 5 campos novos ao formulário) — o pedido provavelmente é uma reação direta a isso.

### Média–Alta

- [ ] **#80** — Linhas customizadas no inventário (além de Equipados/Mochila/Esgotados), com opção de a linha contar ou não no peso, e mover itens entre linhas. Modelo de dados novo (contêiner nomeado) + UI de mover item.
- [ ] **#83** — Modificar recursos temporariamente (CA, iniciativa, deslocamento etc.), inclusive quando o efeito vem de OUTRO personagem (ex.: Armadura Arcana lançada por um aliado). Conferido: `char.efeitos_magicos` (`sheet/combate.js`, `sheet/condicoes.js`, `sheet/hp-descanso.js`) já existe e já tem pelo menos um tipo não-concentração implementado (`tipo: 'bonus_pv_max'`, hp-descanso.js:567-603) — a infra é menos nova do que parecia; falta estender os `tipo`s (CA, iniciativa, deslocamento) e a UI para atribuir um efeito a um alvo/fonte.
- [ ] **#93** — Sentidos passivos (Visão no Escuro, Visão às Cegas, Sismoconsciência, Visão Verdadeira) concedidos por magia/traço/item não aparecem na ficha. Conferido: não existe NENHUM campo `sentidos_passivos`/tratamento equivalente em `sheet/ficha.js`/`sheet/combate.js` hoje — gap real, não regressão. Precisa mapear cada fonte que concede sentido e escrever no bloco de sentidos da ficha, com prioridade entre fontes (ex.: dois "Visão no Escuro" de alcances diferentes).

### Alta

- [ ] **#69** + **#65** + **#14** — Reduzir/retroceder nível com histórico de progressão. **Consolidar as três** — #14 já propõe o desenho técnico (snapshot por nível).
- [ ] **#38** + **#52** — Talentos customizados/criação de talentos. **Consolidar as duas.**
- [ ] **#41** — Antecedentes customizados (concede atributo + perícia + talento de origem + equipamento — 4 integrações no criador).
- [ ] **#53** — Montaria na ficha (entidade nova, bloco de estatísticas de criatura).
- [ ] **#23** + **#26** — Espécie customizada / Warforged. **Consolidar as duas** (espécie alimenta deslocamento, sentidos, truques, resistências).

### Muito alta

- [ ] **#40** — Classe e subclasse customizadas (núcleo do app: progressão, conjuração, dado de vida, características por nível).
- [ ] **#47** + **#32** — Homebrew geral com alteração de bônus / homebrew de raças-classes-origens + compartilhar. **Guarda-chuva de #23/#38/#40/#41** — considerar fechar como duplicata se as específicas cobrirem o pedido.
- [ ] **#95** (NOVA, 2026-09-20, não investigada) — Pede a classe Artificer (Tasha's/Eberron, fora do PHB 2024) OU uma forma de criar/editar classes próprias — o próprio pedido já dá as duas opções. **Provável duplicata de #40** (classe customizada resolveria o pedido de fundo sem exigir Artificer especificamente) — mas se o pedido for SÓ pela classe oficial, é conteúdo de livro fora de escopo, como #18/#28. Precisa perguntar ao autor qual das duas antes de agir.

### Fora do escopo atual

- [ ] **#18** — Subclasse Paladino Juramento dos Gênios Nobres (Heroes of Faerûn — fora do PHB 2024).
- [ ] **#28** — Subclasse Guerreiro do Eco (Wildemount, 5e 2014 — sem versão 2024).
- [ ] **#56** — Compatibilidade com iOS 15. Falta diagnóstico: precisa saber qual API/recurso quebra no dispositivo antes de estimar.

---

## Notas de manutenção

- **#76, fechada na versão 3.0.9** (commit `59dc133`, 2026-09-20): mapeadas 17 características de classe/subclasse com uso grátis limitado, em 9 classes. 8 corrigidas de verdade:
  - **Uso ÚNICO** (`gratis_usado` booleano, via `featureConcedeUsoGratisSemEspaco`/`_concederMagiaAutomatica` em levelup.js): Contatar Patrono (Bruxo 9), Destruição do Paladino (Paladino 2), Montaria Fiel (Paladino 5).
  - **Uso MÚLTIPLO/escalado por atributo** (adaptador novo, `site/js/regras-usos-gratis-magia.js`, lido por sheet/magias.js — lê/escreve o MESMO `char.recursos.<classe>.*` que os painéis de recursos já liam): Inimigo Favorito e Reforços Feéricos/Andarilho Nebuloso (Guardião), Mapa Estelar (Druida/Círculo das Estrelas).
  - **Migração de verdade** (não só correção nova): Criaturas Espectrais (Ilusionista), Manto de Majestade (Bardo/Glamour) e Destruição do Paladino tinham BOOKKEEPING PRÓPRIO com botão dedicado que só toastava "conjurado gratuitamente" sem tocar no `gratis_usado` real — achado em revisão, não no comentário original da issue. Os três botões antigos (e o estado que eles liam) foram APAGADOS, não só desligados; o card de Características de Classe agora mostra "Ver Magias" para essas, e o botão real vive só na lista de Magias.
  - Suprimido também o toggle/contador GENÉRICO do card (`data-toggle-uso`/`data-usar-habilidade`, `char.usos_habilidades`) para as 8 características acima — sem isso, o card abriria uma terceira/quarta UI, desincronizada, para o mesmo uso.
  - **Fora desta rodada, de propósito**: Companheiro Dracônico (Feiticeiro 18) — a magia (Invocar Dragão) não é concedida automaticamente, o bônus de uso grátis só existe SE o jogador já a escolheu por outro caminho; teria de ser um mecanismo novo (detectar se já conhece, marcar retroativo), não os dois já construídos. Terceiro Olho (Mago 10) — é um efeito temporário ESCOLHIDO por Ação Bônus (3 opções, só 1 é magia), não uma conjuração; não tem onde pendurar um botão "Grátis" de magia. Intervenção Divina (Clérigo) e Recuperação Natural (Druida) ficaram fora por decisão do dono do produto — "conjure qualquer magia que você já conheça" pede um seletor que não existe hoje.
  - Cobertura: 4257 testes de unidade (0 falhas), 456 specs e2e (0 falhas, 1 flake sob paralelismo confirmado — passa consistente isolado). 3 bugs reais de dupla-contabilidade encontrados e corrigidos em revisão ANTES do commit (Manto de Majestade, colisão de nome "Passo Nebuloso" com o talento Tocado Por Fadas, Destruição do Paladino) — nenhum chegou a ser publicado.
- **Fechadas na versão 3.0.8** (commit `ea43e7d`, 2026-09-18): #81, #67, #78, #62 (corrigidas com teste); #79 e #66 (investigadas, não reproduziram — fechadas com teste de regressão, sem alteração de produção). Histórico do que cada uma era fica só no commit e no GitHub a partir daqui; esta lista não guarda issue fechada.
- **Cluster "magia/truque personalizado"**: #68, #71, #73, #74 fechados na 3.0.7; #78 fechado na 3.0.8; #75/#92 fechados na 3.0.10; #77 fechado na 3.0.11. #98 (círculo superior em magia personalizada) é o membro novo do cluster, ainda aberto.
- **#61**: mesmo cluster de multiclasse Clérigo que trouxe a #62 (já fechada) e a #59 (fechada na 3.0.13). Investigada a fundo em 2026-09-18 — é decisão de produto documentada, não bug (ver entrada acima).
- **Triagem de #82–#94 em 2026-09-20**: as 5 marcadas bug (#85, #86, #87, #89, #91) foram todas CONFIRMADAS com causa raiz no código — nenhuma virou "não reproduz" ou "não é bug". Duas (#91, e o #76 antes dela) compartilham o mesmo padrão: característica com escolha entre sub-opções, card genérico não oferece seletor. #89 foi confirmada por teste isolado (harness de unidade), sem precisar reproduzir em navegador. As 7 melhorias (#82-#84, #90, #92-#94) tiveram o pedido conferido contra o código (não é "bug", não tem causa raiz a achar) — duas boas candidatas a consolidar com issues já na lista (#82→#37, #92→#75).
- **Fechadas na versão 3.0.10** (commit `2e334ee`, 2026-09-20): #85, #86, #87, #89, #91, #37, #82, #75, #92 — todas corrigidas com TDD (RED confirmado antes de cada GREEN) e e2e com clique real para toda mudança visível. Item customizado com categoria de arma decidiu mostrar a maestria como badge INFORMATIVO, não gated por `char.maestrias_arma` — esse array só aceita nomes de armas do catálogo (o modal de escolha de maestria, `sheet/maestrias.js`, nunca ofereceria um item customizado), gatear do mesmo jeito deixaria o campo sempre inerte. Regressão completa: 4279 testes de unidade (1 falha pré-existente e não relacionada, `druida-forma-acao=encerrar` em `gatilhos-ui-cobertos.test.mjs`, já presente antes desta rodada — não investigada, fora do escopo destas 9 issues), e2e sem falhas nas suítes tocadas (item-customizado, magia-personalizada, aasimar, modal-rodape, pv-max-override, vigoroso-levelup, edicao-manual-atributos, multiclasse-caracteristicas/handlers). `iniciar_servidor.ps1` ficou modificado no repo desde antes desta rodada, sem relação com nenhuma destas issues — não commitado de propósito.
- **Fechadas na versão 3.0.11** (commit `3006455`, 2026-09-20): #84, #90, #77 — as três "mais tranquilas" que sobraram depois da rodada anterior.
  - **#84**: renomeou só o texto do botão (`inventario.js`), sem lógica nova.
  - **#90**: os dois cards "Trocar Magias/Truques (Opcional)" do assistente de level-up (`levelup-cards.js`) viraram `<details>` sem `open` — nascem minimizados, clique real no `<summary>` revela o conteúdo. Dois specs e2e pré-existentes (`levelup-trocas-multiplas.spec.mjs`, `trocas-conjurador.spec.mjs`) precisaram de um clique de expansão a mais para continuar achando `.opcao-card` visível.
  - **#77**: reverteu PARCIALMENTE a decisão da #46 em `mostrarBuscaGrimorio` (`sheet/grimorio.js`) — a #46 excluiu TODA magia personalizada da lista paga de cópia, mas só tinha em mente a personalizada "sempre preparada" (nunca sai do grimório de verdade). A personalizada "ocupa vaga" (`sempre_preparada:false`, issue #71) PODE sair do grimório, e agora que sai, volta a aparecer na lista paga (50 PO/círculo), com uma badge "Personalizada" para não confundir com o acervo. A personalizada "sempre preparada" continua de fora (teste de contraste específico para isso). O caminho de volta GRÁTIS que já existia (re-marcar "sempre preparada" no formulário de edição) não foi removido — a issue pediu só para adicionar o caminho pago em `mostrarBuscaGrimorio`, não para fechar o outro; ver se o dono do produto quer essa segunda parte numa rodada futura.
  - Regressão: unidade sem novas falhas (mesma 1 pré-existente de sempre); e2e 61/61 nas suítes tocadas (levelup, troca, grimório, magia-customizada, item-customizado).
- **Fechadas na versão 3.0.12** (commit `a0f9c53`, 2026-09-20): #97, #96.
  - **#97**: `rotuloCirculoSuperiorHtml(circulo)` (utils.js, função pura, nova) decide o rótulo — vazio pra truque (círculo 0), "Em círculos superiores:" pra magia de círculo 1+. Substituído em OITO pontos que renderizavam `magia.circulo_superior` com o rótulo fixo hardcoded: `sheet/grimorio.js` (3×), `sheet/impressao.js`, `sheet/magias.js`, `levelup-ui.js`, `opcoes-dominio.js`, `creator/passo-magias.js` (achado ao conferir de novo depois do relatório de exploração inicial, que só tinha listado sete).
  - **#96**: dois pedidos na mesma issue. (a) o modal de detalhe de item do inventário (`mostrarDetalheItemSheet`) ganhou uma função extraída, `htmlPropriedadesEMaestria`, que já existia só pro bloco de arma de CATÁLOGO — agora reusada também pro bloco de item CUSTOMIZADO com categoria, então a arma personalizada mostra a descrição de cada propriedade e da maestria, formatada, igual a uma arma do livro. (b) a badge "Maestria: X" de uma arma customizada voltou a ser CONDICIONAL, gated por `char.maestrias_arma` (mesma regra da arma de catálogo, revertendo a decisão "informativa incondicional" tomada na correção do #82) — e pra essa condição fazer sentido de verdade, `armasCustomizadasDoInventario` (`regras-equipamento.js`, função pura, nova) faz a arma customizada com categoria ENTRAR na lista de escolha do modal "Definir Maestrias" (`sheet/maestrias.js`, dois call sites: o modal completo e a troca por Descanso Longo), filtrada pela MESMA regra de proficiência (`armasElegiveisMaestria`) que já decide isso pra arma de catálogo.
  - Achado durante a regressão: dois specs e2e pré-existentes quebraram por motivos NÃO relacionados a #96/#97, mas a rodadas anteriores do mesmo dia — `item-customizado-arma-magia.spec.mjs` (issue #96 mudou a regra da badge; atualizado pra refletir) e `magia-classe.spec.mjs` (issue #90, cedo mais hoje, não tinha pego esse terceiro lugar que checa `#levelup-troca-magia`; corrigido com o mesmo clique de expansão dos outros dois).
  - Regressão: unidade sem novas falhas (mesma 1 pré-existente de sempre, 4287 testes); e2e sem falhas nas suítes tocadas (maestria, grimório, magia-customizada, magia-classe, multiclasse-handlers, impressão, item-customizado, truque, pdf, criador).
- **Fechada na versão 3.0.13** (commit `daa8b9e`, 2026-09-20): #59.
  - Planejada em modo Plan antes de implementar (escopo tocava 6 arquivos do motor de level-up) — o plano copiou o padrão já pronto e funcional do step `proficiencias_classe_nova` (`levelup-flow.js`), que o próprio backlog tinha registrado errado como "buraco" numa triagem anterior: já estava corrigido.
  - Novo módulo puro `site/js/regras-ordem-classe.js` (`ORDEM_CLASSE`) extrai Ordem Divina/Primal de `creator/comum.js` — `levelup-flow.js` (roda dentro da FICHA) não podia importar `CLASSES_ESCOLHAS` direto do criador porque `creator/comum.js` importa `creator/wizard.js` de volta (import circular com efeito colateral de estado do criador). `creator/comum.js` passou a montar `CLASSES_ESCOLHAS.Clérigo.ordem_divina`/`Druida.ordem_primal` a partir do módulo novo — mesmos valores, testado byte a byte.
  - Novo step `ordem_classe_nova` (`levelup-flow.js`/`levelup-cards.js`/`levelup-ui.js`/`levelup-validations.js`/`levelup.js`), mesmo gate de `proficiencias_classe_nova` (só no primeiro nível NAQUELA classe, nunca no primeiro nível do personagem). Grava `escolhas_classe.ordem_divina`/`ordem_primal` e, para "Protetor", empurra `'Armas Marciais'`/`'Armadura Pesada'`(ou `'Armadura Média'` pra Druida) em `proficiencias_extra` — mesmo texto literal que `creator/wizard.js` já grava na criação, lido pelas mesmas `temProficienciaArma`/`temProficienciaArmadura` (`regras-equipamento.js`) que já existiam.
  - **Achado durante a implementação**: `montarConjuracao` (`levelup-flow.js`) tinha um comentário documentando `getBonusTruquesOrdem` como NO-OP no cálculo de truques ganhos, com a premissa explícita "ordem_divina/ordem_primal não muda dentro de uma mesma chamada de subirDeNivel" — a #59 quebra exatamente essa premissa (a Ordem passa a ser escolhida NA MESMA sessão que a classe entra). Corrigido: o lado "truques Novo" agora simula a escolha PENDENTE desta sessão (ainda não gravada no personagem); o lado "truques Atual" nunca recebe essa simulação (antes da subida a ordem realmente não existia). De quebra, corrigido um segundo defeito latente no mesmo trecho: a chamada não passava a classe QUE SOBE para `getBonusTruquesOrdem` (usava o default, o espelho da classe inicial) — um personagem cuja classe inicial tem Ordem mas está subindo noutra classe conjuradora checava a Ordem errada.
  - **Decisão do usuário** (pergunta feita antes de implementar): a metade "preparar magias" da issue não é bug — classes preparadoras nunca escolhem magias preparadas no assistente, em classe única ou multiclasse, isso é intencional. O usuário escolheu, em vez disso, abrir "Preparar Magias" automaticamente ao fechar o modal "Subida de Nível Concluída", para qualquer classe conjuradora PREPARADORA (Clérigo/Druida/Paladino/Guardião) que tenha entrado como classe nova nesta subida — usa o `onClose` nativo de `abrirModal` (`utils.js`) e a MESMA `mostrarBuscaMagia()` (`sheet/grimorio.js`) por trás do botão "Preparar Magias" da ficha.
  - Regressão: unidade sem novas falhas (mesma 1 pré-existente de sempre, 4297 testes); e2e 136/136 nas suítes de multiclasse/level-up/maestrias/magias/criador, mais os 2 specs novos desta issue.
- **Fechada na versão 3.0.14 (sem commit ainda), 2026-09-20**: ampliação do gatilho de "Preparar Magias" da 3.0.13.
  - Um usuário externo comentou na issue #59 (ainda aberta na época) mostrando o comportamento antigo na versão publicada — não era bug novo, só a 3.0.13 ainda não tinha sido enviada/deployada. O dono do produto testou a correção na hora, criando um Clérigo e subindo de nível 1 pra 2 (classe única, sem multiclasse nenhum), e achou que "Preparar Magias" não abria sozinho ali.
  - Causa: a condição original só checava `ehPrimeiroNivelNaClasse && !ehPrimeiroNivelDoPersonagem` (entrada NOVA via multiclasse) — uma subida comum dentro da MESMA classe (o caso mais frequente de todos) nunca disparava, mesmo ganhando vagas de magia preparada novas (Clérigo nível 1→2: 4→5 magias preparadas, pela tabela do livro).
  - Corrigido trocando a condição por `calcularConjuracao(ctx, state).magiasNovo > magiasAtual` (com `tipoConj === 'preparadas'`) — a MESMA função que já decide o resto da tela de magia do assistente (`levelup-flow.js`), em vez de reimplementar "é entrada nova?" à parte. Cobre os dois casos (entrada nova E subida comum) com uma condição só.
  - **Achado durante o RED-check desta correção**: o primeiro teste e2e escrito pro caso "classe única sobe de nível" dava falso-negativo — o teste esquecia de clicar no botão "OK" do modal "Subida de Nível Concluída" antes de checar se "Preparar Magias" abriu, e o auto-abrir só dispara no `onClose` desse modal (ao fechá-lo), não antes. Log de depuração temporário confirmou que a condição já estava calculando certo (`magiasNovo:5 > magiasAtual:4`) — o bug era só do teste, não do código.
  - Regressão: unidade sem novas falhas (mesma 1 pré-existente de sempre, 4297 testes); e2e 137/137 nas mesmas suítes da 3.0.13, mais o 3º spec novo (classe única subindo de nível).
- **Fechada na versão 3.0.15 (sem commit ainda), 2026-09-21**: #94, em 6 fases separadas, cada uma com TDD completo (RED confirmado antes do GREEN) e varredura e2e própria.
  - **Contexto**: `CONDICOES_DESCRICAO` (`sheet/condicoes.js`) já tinha o texto certo do livro pras 14 condições, mas quase nenhum efeito mecânico real era aplicado em cálculo nenhum — só o rótulo exibido ao marcar a condição. Revalidação desta rodada confirmou e ampliou a triagem original, inclusive um achado novo: não existia NENHUMA função de vantagem/desvantagem em jogadas de ATAQUE (ao contrário de perícia e salvaguarda).
  - **Fase 1 — Deslocamento zerado** (`getDeslocamentoFinal`, `sheet/combate.js`): Contido/Imobilizado/Paralisado/Petrificado/Inconsciente zeram o Deslocamento, posicionado depois de todo bônus de valor base e antes das velocidades derivadas (Voo/Escalada/Natação também zeram junto).
  - **Fase 2 — Falha automática em salvaguarda** (`calcVantagemDesvantagemSalvaguarda`, nova função extraída do bloco inline que existia em `ficha.js`): Atordoado/Inconsciente/Paralisado/Petrificado forçam falha automática em salvaguardas de Força e Destreza (a ÚNICA regra do livro escrita como trava fixa por atributo). Novo badge visual "Falha automática" (terceiro estado, além de Vantagem/Desvantagem). **Decisão consciente de escopo**: Cego/Surdo NÃO ganharam falha automática de perícia — o texto do livro ("testes que dependam de visão/audição") é situacional por teste concreto, não uma trava fixa por nome de perícia; aplicar isso como lista fixa seria inventar regra.
  - **Fase 3 — Resistências/imunidades de Petrificado** (`renderSecaoDefesas`, `sheet/condicoes.js`): resistência aos 13 tipos de dano + imunidade a Envenenado, badge "(Petrificado)", mesmo padrão que as resistências dinâmicas da Fúria já usavam.
  - **Fase 4 — Concentração quebrada automaticamente por Incapacitado**: `quebrarConcentracaoAtiva()` extraída do botão manual "Quebrar" (`sheet/hp-descanso.js`) e reusada por `sheet/condicoes.js` ao salvar o gerenciador de condições com Incapacitado recém-marcado (só na transição, não a cada salvamento com a condição já presente).
  - **Fase 5 — Iniciativa**: Invisível dá Vantagem (`getModIniciativa`, `sheet/combate.js`), mesmo campo booleano que Instintos Primitivos/Atleta Extraordinário já usavam. "Desvantagem se surpreso" (Incapacitado) ficou de fora — a ficha não modela o estado de "surpreso" no início do combate.
  - **Fase 6 — Vantagem/desvantagem em jogadas de ataque** (maior peça, infraestrutura nova): `calcVantagemDesvantagemAtaque()`, nova função em `sheet/combate.js` — Amedrontado/Envenenado/Caído/Contido/Imobilizado/Cego dão Desvantagem no ataque do próprio personagem, sem a ressalva por alvo que o livro faz em alguns casos (mesma simplificação que a perícia de Amedrontado já usava). Combinada em `sheet/inventario.js` com as fontes de vantagem que já existiam por arma (Ataque Imprudente, Caçador Preciso), com o mesmo padrão de anular V com D que perícia/salvaguarda usam. **Fora do escopo**: avisos de "ataques CONTRA você" (Atordoado/Cego/Contido/Inconsciente/Invisível/Paralisado/Petrificado) e a penalidade de Exaustão (-2×nível em d20) — a primeira exigiria uma UI nova sem lugar natural pra morar; a segunda é um malus numérico transversal a TODOS os d20, não uma condição no sentido desta issue.
  - Cobertura: 4338 testes de unidade (mesma 1 falha pré-existente e não relacionada, `druida-forma-acao=encerrar`), 491/491 e2e na varredura ampla final (mais 15 specs novos: 6 de unidade + 6 e2e específicos das fases, incluindo os contrastes de "condição errada não deveria mudar nada").
- Ao fechar uma issue por commit, o formato de mensagem e o `Closes #N` estão documentados em [`TRIAGEM-ISSUES.md`](TRIAGEM-ISSUES.md#a-mensagem-de-commit-que-fecha-a-issue).
- Esta lista não inclui issues fechadas nem Pull Requests. Para atualizar do zero, repita a consulta:
  ```bash
  curl -s "https://api.github.com/repos/ZaitBr-bit/D-D_2024/issues?state=open&per_page=100"
  ```
