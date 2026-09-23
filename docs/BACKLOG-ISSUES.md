# Backlog de Issues — ZaitBr-bit/D-D_2024

> Revalidado em 2026-09-22, a partir da API do GitHub (issues abertas, sem PRs).
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
> (versão 3.0.14, commit `743df4e`) — ver notas de manutenção. #59 e #94
> (3.0.15, commit `362cd36`) já estão fechadas no GitHub.
>
> **Revalidação de 2026-09-22**: treze issues novas — **#102 a #114** (39
> abertas no total, contagem batendo uma a uma com esta lista). Todas
> investigadas contra o código nesta revalidação e com **prioridade
> declarada** (só as novas; as antigas seguem ordenadas só por
> complexidade):
>
> - **P1** — fazer primeiro: bug que corrompe ficha ou impede backup.
> - **P2** — ganho alto por custo baixo, ou só resposta/fechamento na issue.
> - **P3** — melhoria real, sem urgência.
> - **P4** — depende de decisão do dono do produto ou fora do escopo.
>
> Ordem sugerida: #102, #110 e #106 (P2).
>
> **Mais tarde em 2026-09-22**: #114 corrigida na 3.0.16 (commit `8779e84`)
> e fechada no GitHub junto com a #70; #108 e #112 (já existiam no app)
> respondidas e fechadas — 35 abertas, contagem batendo com esta lista. Ver
> notas de manutenção.

---

## 🐛 Bugs

### Baixa

_(nenhuma nesta faixa no momento — #114 fechada, ver notas de manutenção)_

### Média

_(nenhuma nesta faixa no momento — #70 fechada, ver notas de manutenção)_

### Média–Alta

_(nenhuma nesta faixa no momento — #105 e #61 fechadas, ver notas de manutenção)_

---

## ✨ Melhorias

### Baixa

- [ ] **#99** (NOVA, 2026-09-20, não investigada) — Textos antigos gravados sem acento/Ç ("descricao", "PRECO" etc., prints anexados na issue). Provável dado/rótulo legado de quando o campo não aceitava esses caracteres — precisa achar se é rótulo fixo na UI (troca de 1 linha por lugar) ou dado gravado no personagem (migração). Não investigado.
- [ ] **#102** (NOVA, 2026-09-22, **P2**) — Trocar o rótulo de upcast "Em círculos superiores:" pelo do PHB 2024, "**Usando um Espaço de Magia de Círculo Superior.**". Investigado: desde a #97 o rótulo vive num lugar só, `rotuloCirculoSuperiorHtml` (`utils.js`), usado pelos 8 pontos de exibição — troca de 1 linha, mais os testes que conferem o texto (`testes/regras/unidade/truque-rotulo-circulo-superior.test.mjs`, `testes/e2e/regras/truque-rotulo-circulo-superior.spec.mjs`, `magia-customizada-conhecidas.spec.mjs`). Conferir antes se o texto do `circulo_superior` no catálogo não repete o rótulo antigo no início.
- [ ] **#110** (NOVA, 2026-09-22, **P2**) — Grimório do Mago abre com todos os círculos expandidos. Investigado: na ficha (`sheet/magias.js`, bloco "Grimório do Mago"), o `<details>` externo nasce fechado, mas cada `<details data-details-id="grimorio-mago-circulo-N">` interno tem `open` fixo — basta tirar o `open` (o modal de busca do grimório, `mostrarBuscaGrimorio`, já nasce fechado). Mesmo padrão da #90. Precisa de e2e com clique no `<summary>`.

### Baixa–Média

- [ ] **#98** (NOVA, 2026-09-20, não investigada) — Pede um campo de "Círculo Superior" (texto livre) no formulário de magia personalizada, pro jogador descrever o efeito de upcast da própria magia — hoje o formulário não tem esse campo, então a magia personalizada nunca mostra a caixa "Em círculos superiores" que a magia do livro mostra (ver render em `sheet/grimorio.js`/`sheet/magias.js`, campo `circulo_superior`). Mesmo cluster de "magia/truque personalizado" das issues #68/#71/#73/#74/#75/#92 (todas fechadas) — cabe na mesma área de trabalho.
- [ ] **#106** (NOVA, 2026-09-21, **P2**) — Aasimar: as 3 formas da Revelação Celestial (Asas Celestiais, Manto Necrótico, Transfiguração Radiante) aparecem como 3 cards de traço separados, além do card da própria Revelação Celestial. Investigado: `renderSecaoTracosEspecie` (`sheet/caracteristicas.js`) já identifica as 3 por `TRACOS_REVELACAO_CELESTIAL` e as trata como "uso controlado pelo pai", mas renderiza cada uma como card próprio. Correção: não renderizá-las soltas e mostrar as 3 descrições dentro do card da Revelação Celestial (que já tem o seletor de forma da #91). Conferir também a impressão/PDF. O mesmo padrão existe para os 6 sub-traços de Ancestralidade Gigante (`TRACOS_HERDAM_ANCESTRALIDADE`) — decidir se entra junto.
- [ ] **#111** (NOVA, 2026-09-22, **P3**) — Campo "Fonte (livro)" na magia personalizada, para organizar e buscar (hoje o jogador escreve no nome). Comentário sugere ícone colorido no canto. Campo de texto livre novo no formulário + exibição como badge + busca considerar o campo. Mesmo cluster da #98 — fazer as duas juntas.

### Média

- [ ] **#22** — Modo escuro. Nenhum `prefers-color-scheme`/`data-theme` hoje; exige tokenizar cores em CSS custom properties.
- [ ] **#100** (NOVA, 2026-09-20, não investigada) — Pede mais categorias pro item personalizado além de arma (Armadura, Consumível, Munição, Equipamento, Item Mágico, Ferramenta), e trocar o rótulo "Não é arma" por um estilo mais parecido com o de Raridade (vazio = sem categoria). Extensão direta do #82/#37 (que só adicionou categoria de ARMA ao formulário) — mesma área, mesmo padrão de select.
- [ ] **#101** (NOVA, 2026-09-20, não investigada) — Pede reorganizar o formulário de item personalizado em seções colapsáveis (Nome/Descrição, Categoria+Propriedades+Maestria, Atributos, Raridade+Sintonização, Preço) — hoje tudo aparece junto, sem separação visual. Ficou mais denso depois do #82/#37 (que acrescentou 5 campos novos ao formulário) — o pedido provavelmente é uma reação direta a isso.
- [ ] **#104** (NOVA, 2026-09-21, **P3**) — Propriedades do item personalizado: trocar o campo de texto livre por botão "Adicionar Propriedade" com a lista padrão (Versátil, Duas Mãos, Leve…) e opção de propriedade personalizada com nome + descrição. Investigado: hoje `item.dados.propriedades` é uma string separada por vírgula, e `htmlPropriedadesEMaestria` (`sheet/inventario.js`) busca a descrição de cada nome no glossário `dados.propriedadesArmas` — propriedade personalizada precisa de lugar para guardar a própria descrição (mudança de formato com compatibilidade para a string antiga). Mesmo formulário de #100/#101 — as três pedem a mesma rodada.
- [ ] **#103** (NOVA, 2026-09-21, **P3**) — Pergaminho Mágico: (a) só existem "Pergaminho Mágico (Truque)" e "(1º Círculo)" no catálogo (`dados/equipamento/equipamento_aventura.json`); (b) não dá para escolher qual magia está no pergaminho. Investigado: (a) é fiel ao PHB 2024 — o capítulo de equipamento só lista esses dois; os de 2º a 9º círculo são itens mágicos do Guia do Mestre, fora do escopo atual. (b) é melhoria real: seletor de magia (filtrado pelo círculo do pergaminho) gravado na instância do item + exibição no detalhe. Fazer só (b), e responder (a) na issue.
- [ ] **#107** (NOVA, 2026-09-21, **P3**) — Aba de registro de campanha: missões realizadas, histórico de XP (comentário acrescenta criaturas encontradas). Investigado: hoje só existe `char.xp` numérico (editado em `sheet/edicao.js`), sem histórico. Seção nova de diário com entradas datadas; o log de XP pode alimentar `char.xp`.

### Média–Alta

- [ ] **#80** — Linhas customizadas no inventário (além de Equipados/Mochila/Esgotados), com opção de a linha contar ou não no peso, e mover itens entre linhas. Modelo de dados novo (contêiner nomeado) + UI de mover item.
- [ ] **#83** — Modificar recursos temporariamente (CA, iniciativa, deslocamento etc.), inclusive quando o efeito vem de OUTRO personagem (ex.: Armadura Arcana lançada por um aliado). Conferido: `char.efeitos_magicos` (`sheet/combate.js`, `sheet/condicoes.js`, `sheet/hp-descanso.js`) já existe e já tem pelo menos um tipo não-concentração implementado (`tipo: 'bonus_pv_max'`, hp-descanso.js:567-603) — a infra é menos nova do que parecia; falta estender os `tipo`s (CA, iniciativa, deslocamento) e a UI para atribuir um efeito a um alvo/fonte.
- [ ] **#93** — Sentidos passivos (Visão no Escuro, Visão às Cegas, Sismoconsciência, Visão Verdadeira) concedidos por magia/traço/item não aparecem na ficha. Conferido: não existe NENHUM campo `sentidos_passivos`/tratamento equivalente em `sheet/ficha.js`/`sheet/combate.js` hoje — gap real, não regressão. Precisa mapear cada fonte que concede sentido e escrever no bloco de sentidos da ficha, com prioridade entre fontes (ex.: dois "Visão no Escuro" de alcances diferentes).
- [ ] **#113** (NOVA, 2026-09-22, **P4 — decisão de produto**) — Pede que "Preparar Magias" fique DENTRO do assistente de subida, junto das outras escolhas, em vez de abrir depois de confirmar. Contraria a decisão tomada na #59 (3.0.13/3.0.14): classes preparadoras não escolhem preparadas no assistente, e "Preparar Magias" abre sozinho no `onClose` do modal "Subida de Nível Concluída". Implementar exige um step novo no motor (`levelup-flow.js`/`levelup-cards.js`/`levelup-validations.js`) reaproveitando a grade de `mostrarBuscaMagia` (`sheet/grimorio.js`), e decidir o multiclasse (uma grade por classe preparadora que subiu). Perguntar ao dono do produto antes de planejar.

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
- [ ] **#109** (NOVA, 2026-09-22, **P4 — fora do escopo**) — Conteúdo de "Tasha's Cauldron of Everything" (subclasses como Guerreiro Rúnico, talentos). Livro de 5e 2014, fora do PHB 2024, como #18/#28. Um comentário na issue já aponta o caminho: criação de subclasse/talento personalizado (#40, #38/#52) atende o pedido sem adicionar livro por livro. Responder apontando para #40 e fechar como duplicata do guarda-chuva #47/#32.
- [ ] **#56** — Compatibilidade com iOS 15. Falta diagnóstico: precisa saber qual API/recurso quebra no dispositivo antes de estimar.

---

## Notas de manutenção

- **Fechadas na versão 3.0.17 (2026-09-22)**: #105, #61. **Causa raiz**: truque e magia concedida gravados sem carimbo `classe` em vários pontos (criador, assistente de subida, troca de truque do grimório e ganho automático de magia de subclasse) — com uma única superfície de conjuração o contador tolerava o campo ausente (RULING R-B), mas ao ganhar a 2ª classe conjuradora todo truque/magia sem carimbo virava ambíguo entre as classes, zerando a contagem das duas em "Preparar Magias" e liberando escolher truques a mais. Três decisões do dono do produto fecharam o desenho: (1) truque/magia de ficha antiga sem `classe`, quando ambíguo entre as classes atuais do personagem, pergunta ao jogador em vez de adivinhar; (2) truque da outra classe aparece travado na grade, e o excedente (truque a mais já gravado) fica marcado em vermelho em vez de escondido; (3) em "Preparar Magias", cada classe mostra só as próprias, com a magia concedida por subclasse presa à classe dona e talento/espécie agrupados em "Outras origens". Regressão completa (Step 5 da Task 6): unidade 4357 testes, 4099 passaram, 1 falha pré-existente e não relacionada em `gatilhos-ui-cobertos.test.mjs` (a lista de gatilhos sem cobertura só pode encolher — 3 itens ainda pendentes, já presentes antes desta rodada: `druida-forma-acao=encerrar`, `sortudo-acao=vantagem`, `sortudo-acao=desvantagem`); e2e das suítes tocadas (multiclasse, levelup, magia, grimorio, truque, criador, preparar, issue105, trocas) — 260 specs, 0 falhas.
- **#76, fechada na versão 3.0.9** (commit `59dc133`, 2026-09-20): mapeadas 17 características de classe/subclasse com uso grátis limitado, em 9 classes. 8 corrigidas de verdade:
  - **Uso ÚNICO** (`gratis_usado` booleano, via `featureConcedeUsoGratisSemEspaco`/`_concederMagiaAutomatica` em levelup.js): Contatar Patrono (Bruxo 9), Destruição do Paladino (Paladino 2), Montaria Fiel (Paladino 5).
  - **Uso MÚLTIPLO/escalado por atributo** (adaptador novo, `site/js/regras-usos-gratis-magia.js`, lido por sheet/magias.js — lê/escreve o MESMO `char.recursos.<classe>.*` que os painéis de recursos já liam): Inimigo Favorito e Reforços Feéricos/Andarilho Nebuloso (Guardião), Mapa Estelar (Druida/Círculo das Estrelas).
  - **Migração de verdade** (não só correção nova): Criaturas Espectrais (Ilusionista), Manto de Majestade (Bardo/Glamour) e Destruição do Paladino tinham BOOKKEEPING PRÓPRIO com botão dedicado que só toastava "conjurado gratuitamente" sem tocar no `gratis_usado` real — achado em revisão, não no comentário original da issue. Os três botões antigos (e o estado que eles liam) foram APAGADOS, não só desligados; o card de Características de Classe agora mostra "Ver Magias" para essas, e o botão real vive só na lista de Magias.
  - Suprimido também o toggle/contador GENÉRICO do card (`data-toggle-uso`/`data-usar-habilidade`, `char.usos_habilidades`) para as 8 características acima — sem isso, o card abriria uma terceira/quarta UI, desincronizada, para o mesmo uso.
  - **Fora desta rodada, de propósito**: Companheiro Dracônico (Feiticeiro 18) — a magia (Invocar Dragão) não é concedida automaticamente, o bônus de uso grátis só existe SE o jogador já a escolheu por outro caminho; teria de ser um mecanismo novo (detectar se já conhece, marcar retroativo), não os dois já construídos. Terceiro Olho (Mago 10) — é um efeito temporário ESCOLHIDO por Ação Bônus (3 opções, só 1 é magia), não uma conjuração; não tem onde pendurar um botão "Grátis" de magia. Intervenção Divina (Clérigo) e Recuperação Natural (Druida) ficaram fora por decisão do dono do produto — "conjure qualquer magia que você já conheça" pede um seletor que não existe hoje.
  - Cobertura: 4257 testes de unidade (0 falhas), 456 specs e2e (0 falhas, 1 flake sob paralelismo confirmado — passa consistente isolado). 3 bugs reais de dupla-contabilidade encontrados e corrigidos em revisão ANTES do commit (Manto de Majestade, colisão de nome "Passo Nebuloso" com o talento Tocado Por Fadas, Destruição do Paladino) — nenhum chegou a ser publicado.
- **Fechadas na versão 3.0.8** (commit `ea43e7d`, 2026-09-18): #81, #67, #78, #62 (corrigidas com teste); #79 e #66 (investigadas, não reproduziram — fechadas com teste de regressão, sem alteração de produção). Histórico do que cada uma era fica só no commit e no GitHub a partir daqui; esta lista não guarda issue fechada.
- **Cluster "magia/truque personalizado"**: #68, #71, #73, #74 fechados na 3.0.7; #78 fechado na 3.0.8; #75/#92 fechados na 3.0.10; #77 fechado na 3.0.11. #98 (círculo superior em magia personalizada) e #111 (fonte/livro da magia personalizada) são os membros abertos do cluster.
- **Cluster "item personalizado"** (triagem de 2026-09-22): #100 (categorias), #101 (seções colapsáveis), #104 (seletor de propriedades) mexem no mesmo formulário — planejar como uma rodada só para não refazer o layout três vezes.
- **Triagem de #102–#114 em 2026-09-22**: dos dois bugs, #105 teve causa raiz confirmada no código (truque gravado sem carimbo `classe`) e #114 tinha hipótese forte sem reprodução em dispositivo (âncora de download revogada antes do navegador móvel ler o blob) — corrigida e fechada no mesmo dia, ver abaixo. Duas melhorias pedem algo que já existe (#108, #112) e uma é conteúdo de livro fora do escopo (#109).
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
- **Fechada na versão 3.0.14 (commit `743df4e`), 2026-09-20**: ampliação do gatilho de "Preparar Magias" da 3.0.13.
  - Um usuário externo comentou na issue #59 (ainda aberta na época) mostrando o comportamento antigo na versão publicada — não era bug novo, só a 3.0.13 ainda não tinha sido enviada/deployada. O dono do produto testou a correção na hora, criando um Clérigo e subindo de nível 1 pra 2 (classe única, sem multiclasse nenhum), e achou que "Preparar Magias" não abria sozinho ali.
  - Causa: a condição original só checava `ehPrimeiroNivelNaClasse && !ehPrimeiroNivelDoPersonagem` (entrada NOVA via multiclasse) — uma subida comum dentro da MESMA classe (o caso mais frequente de todos) nunca disparava, mesmo ganhando vagas de magia preparada novas (Clérigo nível 1→2: 4→5 magias preparadas, pela tabela do livro).
  - Corrigido trocando a condição por `calcularConjuracao(ctx, state).magiasNovo > magiasAtual` (com `tipoConj === 'preparadas'`) — a MESMA função que já decide o resto da tela de magia do assistente (`levelup-flow.js`), em vez de reimplementar "é entrada nova?" à parte. Cobre os dois casos (entrada nova E subida comum) com uma condição só.
  - **Achado durante o RED-check desta correção**: o primeiro teste e2e escrito pro caso "classe única sobe de nível" dava falso-negativo — o teste esquecia de clicar no botão "OK" do modal "Subida de Nível Concluída" antes de checar se "Preparar Magias" abriu, e o auto-abrir só dispara no `onClose` desse modal (ao fechá-lo), não antes. Log de depuração temporário confirmou que a condição já estava calculando certo (`magiasNovo:5 > magiasAtual:4`) — o bug era só do teste, não do código.
  - Regressão: unidade sem novas falhas (mesma 1 pré-existente de sempre, 4297 testes); e2e 137/137 nas mesmas suítes da 3.0.13, mais o 3º spec novo (classe única subindo de nível).
- **Fechada na versão 3.0.15 (commit `362cd36`), 2026-09-21**: #94, em 6 fases separadas, cada uma com TDD completo (RED confirmado antes do GREEN) e varredura e2e própria.
  - **Contexto**: `CONDICOES_DESCRICAO` (`sheet/condicoes.js`) já tinha o texto certo do livro pras 14 condições, mas quase nenhum efeito mecânico real era aplicado em cálculo nenhum — só o rótulo exibido ao marcar a condição. Revalidação desta rodada confirmou e ampliou a triagem original, inclusive um achado novo: não existia NENHUMA função de vantagem/desvantagem em jogadas de ATAQUE (ao contrário de perícia e salvaguarda).
  - **Fase 1 — Deslocamento zerado** (`getDeslocamentoFinal`, `sheet/combate.js`): Contido/Imobilizado/Paralisado/Petrificado/Inconsciente zeram o Deslocamento, posicionado depois de todo bônus de valor base e antes das velocidades derivadas (Voo/Escalada/Natação também zeram junto).
  - **Fase 2 — Falha automática em salvaguarda** (`calcVantagemDesvantagemSalvaguarda`, nova função extraída do bloco inline que existia em `ficha.js`): Atordoado/Inconsciente/Paralisado/Petrificado forçam falha automática em salvaguardas de Força e Destreza (a ÚNICA regra do livro escrita como trava fixa por atributo). Novo badge visual "Falha automática" (terceiro estado, além de Vantagem/Desvantagem). **Decisão consciente de escopo**: Cego/Surdo NÃO ganharam falha automática de perícia — o texto do livro ("testes que dependam de visão/audição") é situacional por teste concreto, não uma trava fixa por nome de perícia; aplicar isso como lista fixa seria inventar regra.
  - **Fase 3 — Resistências/imunidades de Petrificado** (`renderSecaoDefesas`, `sheet/condicoes.js`): resistência aos 13 tipos de dano + imunidade a Envenenado, badge "(Petrificado)", mesmo padrão que as resistências dinâmicas da Fúria já usavam.
  - **Fase 4 — Concentração quebrada automaticamente por Incapacitado**: `quebrarConcentracaoAtiva()` extraída do botão manual "Quebrar" (`sheet/hp-descanso.js`) e reusada por `sheet/condicoes.js` ao salvar o gerenciador de condições com Incapacitado recém-marcado (só na transição, não a cada salvamento com a condição já presente).
  - **Fase 5 — Iniciativa**: Invisível dá Vantagem (`getModIniciativa`, `sheet/combate.js`), mesmo campo booleano que Instintos Primitivos/Atleta Extraordinário já usavam. "Desvantagem se surpreso" (Incapacitado) ficou de fora — a ficha não modela o estado de "surpreso" no início do combate.
  - **Fase 6 — Vantagem/desvantagem em jogadas de ataque** (maior peça, infraestrutura nova): `calcVantagemDesvantagemAtaque()`, nova função em `sheet/combate.js` — Amedrontado/Envenenado/Caído/Contido/Imobilizado/Cego dão Desvantagem no ataque do próprio personagem, sem a ressalva por alvo que o livro faz em alguns casos (mesma simplificação que a perícia de Amedrontado já usava). Combinada em `sheet/inventario.js` com as fontes de vantagem que já existiam por arma (Ataque Imprudente, Caçador Preciso), com o mesmo padrão de anular V com D que perícia/salvaguarda usam. **Fora do escopo**: avisos de "ataques CONTRA você" (Atordoado/Cego/Contido/Inconsciente/Invisível/Paralisado/Petrificado) e a penalidade de Exaustão (-2×nível em d20) — a primeira exigiria uma UI nova sem lugar natural pra morar; a segunda é um malus numérico transversal a TODOS os d20, não uma condição no sentido desta issue.
  - Cobertura: 4338 testes de unidade (mesma 1 falha pré-existente e não relacionada, `druida-forma-acao=encerrar`), 491/491 e2e na varredura ampla final (mais 15 specs novos: 6 de unidade + 6 e2e específicos das fases, incluindo os contrastes de "condição errada não deveria mudar nada").
- **Fechadas em 2026-09-22**: #114 (corrigida na versão 3.0.16, commit `8779e84`) e #70 (fechada junto, mesmo tema de download no Android).
  - **#114**: os dois exports da home (`pages/home.js`) clicavam numa `<a download>` fora do documento e revogavam o blob logo após o `a.click()`. `baixarArquivo(blob, nome)` (`utils.js`, nova) concentra o padrão que o PDF já usava (âncora no documento, revoke 60 s depois), e os dois exports e `baixarPdfFicha` passam a chamá-la. Spec novo `home-exportar-download-robusto.spec.mjs` (toque real nos dois botões, `a.click()`/`revokeObjectURL` instrumentados) nasceu vermelho nos dois casos. O Chromium desktop tolera o padrão antigo, por isso `home-exportar-importar.spec.mjs` passava com o defeito. Não houve reprodução em aparelho: a validação no Opera GX Android ficou para produção.
  - **#70**: relatada na 3.0.4, quando o download do PDF já usava o padrão robusto (desde `f68f24d`) — causa diferente da #114, não encontrada. Na emulação Android o PDF gera e baixa. Se voltar a ser relatado, o caminho é teste em aparelho (`adb reverse` + `chrome://inspect`).
  - O commit saiu com `Refs #114` em vez de `Closes #114`; as duas foram fechadas à mão no GitHub.
  - Regressão: 19/19 e2e de export/PDF; unidade com a mesma 1 falha pré-existente (`druida-forma-acao=encerrar`).
- **Fechadas sem alteração de código em 2026-09-22**: #108 (talento Combate com Duas Armas já existe, como talento de Estilo de Luta) e #112 (trocar foto já existe em Editar ficha → Identidade). Pendência lateral registrada na triagem: o handler de `#btn-edit-header` (`sheet/edicao.js`) não tem botão renderizado — código morto.
- Ao fechar uma issue por commit, o formato de mensagem e o `Closes #N` estão documentados em [`TRIAGEM-ISSUES.md`](TRIAGEM-ISSUES.md#a-mensagem-de-commit-que-fecha-a-issue).
- Esta lista não inclui issues fechadas nem Pull Requests. Para atualizar do zero, repita a consulta:
  ```bash
  curl -s "https://api.github.com/repos/ZaitBr-bit/D-D_2024/issues?state=open&per_page=100"
  ```
