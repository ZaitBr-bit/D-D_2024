# Backlog de Issues — ZaitBr-bit/D-D_2024

> Revalidado em 2026-10-05, a partir da API do GitHub (issues abertas, sem PRs).
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
>
> **Revalidação de 2026-10-02**: dez issues novas — **#115 a #124**, todas
> abertas na 3.0.17 (42 abertas no total, contagem batendo uma a uma com esta
> lista). #113 foi fechada no GitHub como concluída, sem commit nem nota
> nossa (a pendência de decisão de produto some junto). Seis bugs e quatro
> melhorias, investigados contra o código nesta revalidação, com prioridade
> (mesma escala acima). Quatro bugs têm causa raiz confirmada no código
> (#116, #119, #121 e a hipótese forte de #115); #122, #117 e #124 não foram
> reproduzidos.
>
> Ordem sugerida: **#115** (P1, PV errado), **#122** (P1, investigar perda de
> dados), depois #121, #116 e #119 (P2, correções pequenas e certas).
>
> #115, #116, #117 e #121 foram corrigidas na 3.0.18, e #119, #122 e #124 na 3.0.19 — ver notas de manutenção. As melhorias #99, #102, #110, #118, #123, #98, #106 e #111 foram entregues na 3.0.20, e #120, #100, #104, #101, #80 e #83 na 3.0.21.
>
> **Revalidação de 2026-10-05**: 33 issues abertas (contagem conferida na API).
> Entraram **#125 a #138** (menos #132, que não está aberta), todas abertas na
> 3.0.21 e **ainda sem triagem** — ver a seção "Novas, sem triagem" abaixo.
> A **3.1.0 (itens mágicos)** foi uma melhoria do dono do produto, **sem issue
> própria**; ela toca duas issues antigas: **#103** (parte (a) respondida) e
> **#93** (parte dos sentidos por item entregue) — ver as entradas.
>
> **Triagem e correção de 2026-10-05 (tarde)**: backlog conferido na API (33
> abertas, lista batendo uma a uma; #126 ganhou dois comentários, sugerindo
> compartilhar magias/itens personalizados entre fichas da conta). Dos cinco
> bugs novos, quatro tinham causa raiz no código e foram corrigidos com oráculo
> vermelho antes (#130, #131, #135, #138); #129 não reproduziu. Sem commit e sem
> `versao.js` ainda (o dono diz a versão).

---

## 🐛 Bugs

### Baixa

_(nenhuma nesta faixa no momento — ver notas de manutenção)_

### Média

_(nenhuma nesta faixa no momento — ver notas de manutenção)_

### Média–Alta

_(nenhuma nesta faixa no momento — ver notas de manutenção)_

---

## 🆕 Novas, sem triagem (2026-10-05)

Abertas na 3.0.21 (ou 3.0.x); **nenhuma foi investigada contra o código** — o
que segue é o resumo do que o autor descreve, a confirmar na triagem.

**Bugs** — triados em 2026-10-05; #130, #131, #135 e #138 corrigidos (aguardam commit e versão), #129 não reproduzido.

- [ ] **#129** — Mago que adquire o talento Mestre das Armas perde o botão de trocar/preparar magias no Descanso Longo. **Não reproduzido**: Mago 5 com o talento e magias preparadas mostra os três botões (`mago-mestre-das-armas-descanso.spec.mjs`). O botão só some quando a ficha não tem nenhuma magia preparada de círculo 1+ (o portão de `hp-descanso.js` exige uma candidata a sair); nada no fluxo do talento esvazia `magias_preparadas`. Falta perguntar ao autor se o Mago dele tinha magias preparadas; ver `PERGUNTAS-PENDENTES.txt`.
- [x] **#130** — Nome de magia grande cortado pelo check. Causa: `.opcao-check` é absoluto (28 px) e o nome, filho direto do card denso, passava por baixo dele. `app.css`: `padding-right: 24px` e `overflow-wrap: anywhere` em `.opcao-grid.densa .opcao-card > .opcao-nome`. Teste: `grimorio-mago-personalizada-badge-e-nome-longo.spec.mjs`.
- [x] **#131** — Selo "Personalizada" no Mago. Causa: a grade do Mago é montada de `char.grimorio` (`{nome, circulo}`), sem a marca `personalizada`. `mostrarBuscaMagia` (`grimorio.js`) agora cruza a entrada sem par no acervo com `magias_customizadas` e acrescenta selo, escola e fonte. Mesmo spec do #130.
- [x] **#135** — Propriedade personalizada fora de arma. Causa: `htmlDetalheItem` (`inventario.js`) só chamava `htmlPropriedadesEMaestria` dentro de `if (d.categoria)`. Agora vale para todo item personalizado (o nome da propriedade também passou por `escHtml`). Teste: `item-customizado-propriedade-nao-arma.spec.mjs`.
- [x] **#138** — Reação recusada. Causa: o gatilho digitado ("...ataque com uma arma") passava pela lista negra `arma|ataque desarmado` de `tempoConjuracaoMagiaValido` (`grimorio.js`), feita para filtrar o índice. A validação agora olha só o trecho antes da primeira vírgula. Teste: `magia-personalizada-reacao-gatilho.spec.mjs`.

**Melhorias**

- [ ] **#125** — Comprar item personalizado (descontar moedas ao adicionar, como na loja).
- [ ] **#126** — Passar magias e itens de uma ficha para outra (hoje é um a um).
- [ ] **#127** — Campo "Conjuração como magia de Círculo" nas magias personalizadas e formulário de magia mais compacto (como o de item).
- [x] **#128** — Deixar claro que só o Mago troca de truque no Descanso Longo (o texto sugere que qualquer conjurador troca). Aguarda commit e versão. Causa: a troca de truque é regra da casa (o livro só permite ao Mago), e os dois modais não diziam isso. `avisoTrocaTruqueForaDoLivro` (`regras-preparo-magias.js`) gera o aviso; `hp-descanso.js` (modal do Descanso Longo, `<p class="aviso-regra-livro">`) e `grimorio.js` (modal de troca no grimório, dentro da info-box) o exibem para quem não é Mago. A regra da casa foi mantida; a decisão está em `PERGUNTAS-PENDENTES.txt`. Testes: `troca-truque-aviso.test.mjs`, `troca-truque-aviso-livro.spec.mjs`.
- [x] **#133** — Converter moedas também "para baixo" (platina → ouro). Aguarda commit e versão. Causa: a Carteira só convertia para cima. `moedas.js` ganhou `proximaDenominacaoMenor` e `converterParaMenor` (usam as taxas customizadas); `sheet/inventario.js` ganhou o botão "↓" (`data-moeda-conv-baixo`) em cada linha de moeda e o layout da linha foi ajustado para caber em 360 px. Testes: `moedas-converter-menor.test.mjs`, `carteira-converter-baixo.spec.mjs`.
- [x] **#134** — Item personalizado: tipo de armadura (leve/média/pesada) para a proficiência aparecer, e mostrar CA, requisito, desvantagem, custo e peso na descrição. Aguarda commit e versão. Causa: o item personalizado de categoria Armadura não guardava o tipo, então não havia selo de proficiência nem resumo. `item-customizado-form.js` ganhou `TIPOS_ARMADURA` e o bloco de tipo, requisito de Força e desvantagem em Furtividade (`tipo_armadura`, `requisito_forca`, `furtividade`, vazios fora de Armadura); `sheet/inventario.js` mostra o selo de proficiência (`badge-prof-sm`) e `htmlResumoItemCustomizado` no detalhe (CA, requisito, furtividade, custo e peso). CA e penalidades de armadura não mudaram. Testes: `item-customizado-armadura.test.mjs`, `item-customizado-armadura.spec.mjs`.
- [ ] **#136** — Modo escuro/noturno. **Duplicata de #22** (mesmo pedido): consolidar.
- [ ] **#137** — Pastas/grupos de fichas na página inicial.

---

## ✨ Melhorias

### Baixa

_(nenhuma nesta faixa no momento — ver notas de manutenção)_

### Baixa–Média

_(nenhuma nesta faixa no momento — ver notas de manutenção)_

### Média

- [ ] **#22** — Modo escuro. Nenhum `prefers-color-scheme`/`data-theme` hoje; exige tokenizar cores em CSS custom properties.
- [x] **#103** (NOVA, 2026-09-21, **P3**) — **Fechada em 2026-10-05**: a parte (b) foi entregue na versão 3.1.1 e a parte (a) foi respondida na issue (as 10 variantes existem em Itens Mágicos desde a 3.1.0); a issue foi fechada como concluída pelo GitHub, com comentário (o commit saiu com `Refs #103`). Parte (b): regra pura em `regras-pergaminho.js` (círculo, magia, tabela de CD/ataque); `pergaminho-ui.js` traz a grade de cards com "Em branco" fixo e busca (clicar no card abre os detalhes da magia; o círculo do card seleciona); o Pergaminho Mágico sai da listagem de Equipamento **só na ficha** (`ctx.permitirMagicos`; o criador continua listando) e é adicionado por Itens Mágicos; a magia pode ser trocada depois de adicionado (bloco e botão no detalhe, selo "Em branco" na linha); custo `consome` em `regras-magias-itens.js` (`consumirPergaminho` após conjuração confirmada, em `sheet/magias.js`). Testes: `pergaminho-magico.test.mjs`, `pergaminho-magico.spec.mjs`. Limitação: a grade usa o índice de todas as classes, sem filtrar pela lista de classe do leitor. Texto anterior: **Atualização 2026-10-05 (3.1.0): a parte (a) está respondida.** A categoria Itens Mágicos traz o *Pergaminho Mágico* do Guia do Mestre com as 10 variantes (Truque e 1º a 9º círculo); só falta responder na issue. **A parte (b) segue aberta**: o item entra no inventário sem magia (`magias: null` no acervo) e não há seletor. A infraestrutura nova ajuda: o bloco Magias de Itens (3.1.0) já sabe listar e conjurar uma magia gravada no item, então o seletor pode gravar `dados.magias` na instância (círculo da variante como teto). Texto original: Pergaminho Mágico: (a) só existem "Pergaminho Mágico (Truque)" e "(1º Círculo)" no catálogo (`dados/equipamento/equipamento_aventura.json`); (b) não dá para escolher qual magia está no pergaminho. Investigado: (a) é fiel ao PHB 2024 — o capítulo de equipamento só lista esses dois; os de 2º a 9º círculo são itens mágicos do Guia do Mestre, fora do escopo atual. (b) é melhoria real: seletor de magia (filtrado pelo círculo do pergaminho) gravado na instância do item + exibição no detalhe. Fazer só (b), e responder (a) na issue.
- [ ] **#107** (NOVA, 2026-09-21, **P3**) — Aba de registro de campanha: missões realizadas, histórico de XP (comentário acrescenta criaturas encontradas). Investigado: hoje só existe `char.xp` numérico (editado em `sheet/edicao.js`), sem histórico. Seção nova de diário com entradas datadas; o log de XP pode alimentar `char.xp`.

### Média–Alta

- [ ] **#93** — **Atualização 2026-10-05 (3.1.0): parcial.** Os sentidos concedidos por **item** (Visão no Escuro, Visão Verdadeira, Visão às Cegas; Óculos da Noite somam à base da espécie; o maior vale entre fontes) agora aparecem em Sentidos, na impressão e no PDF. **Seguem faltando** os concedidos por **magia** e por **traço/subclasse**, a Sismoconsciência (Sentido Sísmico) e o Guardião 18 só entra pela classe. Texto original: Sentidos passivos (Visão no Escuro, Visão às Cegas, Sismoconsciência, Visão Verdadeira) concedidos por magia/traço/item não aparecem na ficha. Conferido: não existe NENHUM campo `sentidos_passivos`/tratamento equivalente em `sheet/ficha.js`/`sheet/combate.js` hoje — gap real, não regressão. Precisa mapear cada fonte que concede sentido e escrever no bloco de sentidos da ficha, com prioridade entre fontes (ex.: dois "Visão no Escuro" de alcances diferentes).

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

- **Seletor de itens no celular (versão 3.1.2, 2026-10-05)** — pedido do dono, sem issue: modal "Adicionar Item" com altura fixa e categoria em dropdown, categoria "Todos" (busca em todas as categorias, limite de 80 resultados), ajuste ao teclado virtual (`site/js/modal-teclado.js`), destaque da raridade ativa e botões "Loja" e "Novo Espaço". Teclado virtual provado só por simulação de `visualViewport`; falta conferir em iPhone/Android reais.

- **Entregues em 2026-10-05 (rodada 2), versão 3.1.1**: #128, #133, #134, parte (b) da #103 e, sem issue própria, o preço informado ao adicionar item mágico e a auditoria de itens duplicados. Causas, arquivos e testes nas entradas das issues. **Preço informado**: o modal de item mágico (`itens-magicos-ui.js`) ganhou campo de preço no rodapé (`interpretarPrecoInformado` em `moedas.js`); cobra sempre que há valor, independe do flag Comprar e não grava nada no item; também ganhou trava contra abertura/confirmação em duplicidade. Testes: `preco-informado.test.mjs`, `item-magico-preco-informado.spec.mjs`. **Auditoria de duplicados**: `scripts/auditar_itens_duplicados.py` gera `docs/AUDITORIA-ITENS-DUPLICADOS.md` (o script regera A, B e C e preserva a seção D, escrita à mão); duplicatas reais: Pergaminho Mágico (Truque), Pergaminho Mágico (1º Círculo) e Poção de Cura; teste-guarda `itens-duplicados-catalogo.test.mjs`. **Pendente de aprovação do dono**: tirar a Poção de Cura da listagem de Equipamento (hoje continua listada); qualquer filtro generalizado deve valer só com `ctx.permitirMagicos`. #107 fora desta rodada. **Regressão**: 230 e2e nas suítes de troca de truque, carteira, item customizado, pergaminho, trocas, descanso, itens mágicos, loja, inventário e ficha (229 passaram na primeira rodada; `itens-magicos-atributo.spec.mjs` "Amuleto da Saúde: PV máximo sobe ao sintonizar" falhou uma vez sob carga e passou nas três reexecuções isoladas, uma delas só no retry: intermitente); unidade 5106 testes, 4848 passam, 1 falha antiga (`gatilhos-ui-cobertos`).

- **Corrigidas em 2026-10-05 (versão 3.0.22)**: #130, #131, #135, #138 (bugs abertos na 3.0.21). Causas e testes nas entradas da seção "Novas, sem triagem". Regressão: 208 e2e nas suítes de grimório, magia, item customizado, descanso, trocas e inventário (0 falhas); unidade 5065 testes, 1 falha antiga (`gatilhos-ui-cobertos`). #129 segue aberta, não reproduzida.

- **Entregue na versão 3.1.0 (2026-10-05)** — melhoria do dono do produto, **sem issue**: itens mágicos do Livro do Mestre (capítulo 7). 350 itens traduzidos e catalogados (`dados/livro-do-mestre/capitulo7/`, extração e curadoria em `scripts/livro-do-mestre/`); na ficha: categoria Itens Mágicos no Adicionar Item, bônus automáticos (CA, salvaguardas, ataque/CD de magia, ataque/dano de arma), atributo em jogo (Cinturão de Força do Gigante, Amuleto da Saúde, Pedras Ioun, aumentos permanentes de Manuais/Tomos/Livros), cargas e usos com recuperação no Descanso Longo, magias conjuradas pelo item, resistências/imunidades/deslocamento/sentidos/vantagens passivos e aviso de sintonização restrita. Dez planos de implementação (em `docs/superpowers/plans/`, não versionados). Corrigidos no caminho, sem issue: PV com o Amuleto da Saúde ao editar Constituição/reverter/ASI/talento/dádiva, rótulo "(Rolado: N)" do level-up, Exaustão nos Deslocamentos especiais fixos, Visão às Cegas do Guardião multiclasse e itens duplicados em Deslocamento/Condições. **Limitações de modelo conhecidas** (itens que exigem vocabulário novo: voo condicional do Manto do Morcego, imunidade à magia Mísseis Mágicos do Broche Protetor, Visão no Escuro a 30 cm dos Olhos de Visão Minuciosa, aliados em auras, restrições de uso das magias de itens, Túnica das Estrelas, Cubo de Invocação, Lâmina e Pedra da Boa Sorte, Cabras de Marfim, Elmo do Brilho) estão em `scripts/livro-do-mestre/GUIA-MECANICA.md`. Tocam as issues abertas **#103** (parte (a) respondida) e **#93** (sentidos por item entregues), registradas nas entradas delas.

- **Entregues na versão 3.0.21 (2026-10-03)**: #120, #100, #104, #101, #80, #83 — oráculo vermelho antes de cada uma.
  - **#120**: `equipamento_aventura.json` tinha 12 de 82 itens com descrição e `ferramentas.json` só a tabela. `scripts/extrair_descricoes_equipamento.py` preenche as descrições (só onde estavam vazias) e os `detalhes` (Usar Objeto, Fabricação, Variantes) a partir de `Equipamento.md`; a loja ganhou a categoria Ferramentas (`montarFerramentasLoja`, uma entrada por variante de Instrumento Musical e Kit de Jogos). Testes: `equipamento-descricoes.test.mjs`, `loja-ferramentas.spec.mjs`.
  - **#100**: categorias que não são arma ficam em `dados.tipo_item` (`TIPOS_ITEM`), separadas de `dados.categoria`, que continua só de arma (decide proficiência/ataque). Testes: `item-customizado-form.test.mjs`, `item-customizado-categoria.spec.mjs`.
  - **#104**: propriedades como chips (lista do livro + personalizada com nome/descrição); `dados.propriedades` segue string, `dados.propriedades_personalizadas` guarda as descrições. Testes: `item-customizado-propriedades.test.mjs` e `.spec.mjs`.
  - **#101**: Categoria, Atributos e Raridade/sintonização em `<details class="ic-secao">` (criação recolhida; edição abre a seção com dado; erro de dano abre Atributos). Nome, Descrição e Preço ficam fora. Helper de teste `abrirSecoesItemCustom`. Teste: `item-customizado-secoes.spec.mjs`.
  - **#80**: `char.inventario_locais[]` (`{id, nome, conta_peso}`) + `item.local`; seção por local, seletor "mover para" por item, editar/remover (itens voltam à Mochila); `getPesoTotalInventario(inventario, locais)` ignora local com `conta_peso:false`. O "peso da própria linha" do pedido é o do item-bolsa, que continua contando. Testes: `inventario-locais.test.mjs` e `.spec.mjs`.
  - **#83**: modal "Modificadores" no card de Condições; entradas manuais em `efeitos_magicos` (`modificador_manual` para CA, iniciativa, ataque e CD de magia; `tipo:'deslocamento'` para deslocamento, voo, natação e escalada), todas `temporario:true` (saem no Descanso Longo). Fora do escopo: bônus no ataque com arma e CA base de aliado. Testes: `modificadores-manuais.test.mjs` e `.spec.mjs`.
  - Texto: a guarda `ui-textos-acentuados.test.mjs` passou a olhar também texto antes de `${...}` e achou mais rótulos sem acento (Condições, Espécie, Nível...), corrigidos.
- **Entregues na versão 3.0.20 (2026-10-03)**: melhorias #102, #110, #118, #106, #99, #98, #111, #123 — oráculo vermelho antes de cada uma.
  - **#102**: o catálogo já traz "Usando um Espaço de Magia de Círculo Superior." no início do `circulo_superior` (134 magias), então trocar só o rótulo duplicaria a frase. `circuloSuperiorHtml(texto, circulo)` (`utils.js`) monta o bloco inteiro: frase do livro em negrito e depois a descrição (acrescenta a frase quando a magia personalizada não a tem; truque mantém "Aprimoramento de Truque."); substituiu `rotuloCirculoSuperiorHtml` nos 8 pontos de exibição. `dados/` não mudou.
  - **#110**: `open` fixo nos `<details data-details-id="grimorio-mago-circulo-N">` de `sheet/magias.js`. Spec: `grimorio-mago-recolhido.spec.mjs`.
  - **#118**: três telas já mostravam "Classes:"; `classesDaMagiaHtml` (`utils.js`) passou a servir todas e entrou no cartão expandido da ficha, nos dois modais de troca do Descanso Longo e no seletor da subida de nível.
  - **#106**: só o Aasimar (as 3 formas viram descrições dentro do card da Revelação Celestial; a impressão lista traços em linha e já os mostrava). Os 6 sub-traços da Ancestralidade Gigante ficaram como estão.
  - **#99**: não era dado gravado, eram ~85 rótulos fixos sem acento em ~20 arquivos de `site/js`. Guarda `ui-textos-acentuados.test.mjs` (varre só texto exibido: nós HTML, title/placeholder, toast, label/rotulo/titulo/texto/msg/erro/dica) e spec `textos-acentuados-ficha.spec.mjs`.
  - **#98/#111/#123**: campos opcionais `circulo_superior`, `fonte` (até 40 caracteres) e `classes` (só classes conjuradoras, `CLASSES_CONJURADORAS` em `dados-classes.js`) em `magias_customizadas[]`, normalizados por `normalizarMagiaPersonalizada`. `classes` vazio = todas (fichas antigas inalteradas); a grade de Preparar Magias filtra por classe da superfície ativa e a injeção ao salvar "ocupa vaga" só acontece se a classe da superfície estiver marcada. Testes: `magia-personalizada-campos-novos.test.mjs` e `.spec.mjs`.
- **Corrigidas na versão 3.0.19 (2026-10-03)**: #119, #124, #122 — todas com oráculo vermelho antes da correção.
  - **#119**: o passo de troca do Descanso Longo só existia para as cinco classes com Maestria em Arma, e `maestrias_arma` é um array único. O talento ganhou vaga própria (`char.maestria_talento`, gravada em `aplicarEfeitoTalento`) e passo próprio (`abrirModalTrocaMaestriaTalento`, botão "Trocar Arma do Talento"); ficha antiga sem o campo oferece todas as maestrias atuais como "a que sai". Testes: `maestria-talento-troca.test.mjs`, `mestre-das-armas-troca-descanso.spec.mjs`.
  - **#124**: desde a #46 a personalizada "ocupa vaga" não tinha cartão em nenhuma grade fora do Mago. `personalizadasOcupaVagaParaGrade` (`grimorio.js`) a põe na grade de círculos das superfícies `preparadas`, com badge "Personalizada"; "sempre preparada" continua fora. Na 3.0.20 o #123 entrou nesse mesmo ponto: com `classes` marcadas na magia, ela só aparece nas classes marcadas. Testes: `magia-personalizada-grade-preparadora.test.mjs`, `magia-customizada-preparar-preparadora.spec.mjs`.
  - **#122**: três causas. (1) `salvarPersonagem` carimbava `atualizado_em` mesmo sem mudança e `renderSheet` grava em várias migrações a cada abertura: agora conteúdo idêntico não carimba/envia, e a abertura da ficha grava com `preservarCarimbo`. (2) A exclusão era `deleteDoc`, e o outro aparelho recriava o personagem ("só local"): agora é lápide no mesmo documento (`removido`, `removido_em`), reconciliada por `site/js/sync-merge.js`. (3) A nuvem só era consultada ao renderizar a home: a ficha agora puxa o documento da nuvem antes de abrir (limite de 2,5 s) e a home sincroniza ao voltar ao primeiro plano. Sem merge por campo (ver `PERGUNTAS-PENDENTES.txt`). Testes: `store-salvar-sem-mudanca.test.mjs`, `sync-merge.test.mjs`, `ficha-abrir-nao-carimba.spec.mjs`. O caminho com Firebase real não tem prova automatizada: roteiro manual no plano `2026-10-03-bugs-media-e-media-alta-119-124-122.md` (Task 6, Step 5).
- **Corrigidas na versão 3.0.18 (2026-10-02)**: #121, #116, #115, #117 — todas com oráculo vermelho antes da correção.
  - **#121**: `pagarCusto` (`moedas.js`) sempre passava por `retirarValor`, que soma tudo em cobre e redistribui. Passou a delegar a `removerQuantidadeMoeda(moedas, c.tipo, c.qtd)` (só converte quando a pilha da denominação não cobre); custo de quantidade 0 continua com sucesso. Testes: `moedas-pagar-custo.test.mjs` (novo, nasceu com 2 falhas) e teste novo em `itens-seletor-ficha.spec.mjs` com clique em comprar (nasceu vermelho).
  - **#116**: a quebra automática de concentração só reconhecia a condição literal Incapacitado. Novo `site/js/regras-condicoes.js` (`estaIncapacitado`: Incapacitado, Atordoado, Inconsciente, Paralisado, Petrificado), usado na transição em `sheet/condicoes.js` (compara antes/depois, então trocar Paralisado por Atordoado não quebra de novo) e na exceção do Sentido de Perigo em `sheet/combate.js`. Testes: 3 de unidade em `condicao-concentracao.test.mjs` (nasceram vermelhos) e 2 e2e em `condicao-concentracao.spec.mjs` (Paralisado quebra, Caído não; vermelho confirmado revertendo só o gatilho). Sem teste da troca Paralisado→Atordoado, pois a transição está inline no handler do modal.
  - **#115**: hipótese confirmada. Em `subirDeNivel` (`levelup.js`) o PV retroativo era calculado antes de `aplicarASITalento`, então o +1 CON do talento (ex.: Resistente) ficava sem retroativo. Agora o delta restante de CON após o talento é aplicado uma vez e `modConDepois` é atualizado (o bloco da capstone não recontabiliza). Teste: `talento-asi-con-pv-retroativo.test.mjs` (novo; o caso do talento nasceu com `0 !== 12`, o caso de ASI padrão é guarda de regressão). Fichas que subiram de nível com esse talento antes da 3.0.18 continuam com o PV antigo (1 PV por nível para cada +1 de modificador que faltou); a nota de versão informa o fato sem apontar tela. Pendente: caminho de correção para fichas já afetadas — nenhum campo edita o PV máximo de forma permanente, e "⚙ PV Max" (`pv_max_override`) é um override temporário que não acompanha subidas de nível seguintes.
  - **#117**: reproduzida (a triagem dizia "não reproduzida"). Print da issue: modal "Descanso Longo Concluído" de Mago com três botões, "Manter Tudo" cortado na borda esquerda. Causa: `.modal-acoes` (`css/app.css`) é flex com `justify-content: flex-end` e `.btn` tem `white-space: nowrap`; a soma dos botões maior que a largura vaza pela esquerda, área sem rolagem. Medido `left` de -70 px em 360 px e -46 px em 384 px. Correção: `flex-wrap: wrap` em `.modal-acoes`, que vale para todo rodapé de modal. Teste: `modal-acoes-celular.spec.mjs` (novo, 3 viewports, clica em "Manter Tudo"; 3 falhas antes, 3 passam depois). Outros modais com muitos botões não foram conferidos um a um.
  - Regressão: unidade 4366 testes, 4108 passaram, 1 falha pré-existente e não relacionada (`gatilhos-ui-cobertos.test.mjs`, "a lista de gatilhos sem cobertura só encolhe": `druida-forma-acao=encerrar`, `sortudo-acao=vantagem`, `sortudo-acao=desvantagem`); e2e `itens-seletor-ficha`, `condicao-concentracao`, `modal-acoes-celular`, `notas-versao` e `reportar-problema` — 28 specs, 0 falhas. Não rodada a suíte e2e inteira.
- **Fechadas na versão 3.0.17 (2026-09-22)**: #105, #61. **Causa raiz**: truque e magia concedida gravados sem carimbo `classe` em vários pontos (criador, assistente de subida, troca de truque do grimório e ganho automático de magia de subclasse) — com uma única superfície de conjuração o contador tolerava o campo ausente (RULING R-B), mas ao ganhar a 2ª classe conjuradora todo truque/magia sem carimbo virava ambíguo entre as classes, zerando a contagem das duas em "Preparar Magias" e liberando escolher truques a mais. Três decisões do dono do produto fecharam o desenho: (1) truque/magia de ficha antiga sem `classe`, quando ambíguo entre as classes atuais do personagem, pergunta ao jogador em vez de adivinhar; (2) truque da outra classe aparece travado na grade, e o excedente (truque a mais já gravado) fica marcado em vermelho em vez de escondido; (3) em "Preparar Magias", cada classe mostra só as próprias, com a magia concedida por subclasse presa à classe dona e talento/espécie agrupados em "Outras origens". Regressão completa (Step 5 da Task 6): unidade 4357 testes, 4099 passaram, 1 falha pré-existente e não relacionada em `gatilhos-ui-cobertos.test.mjs` (a lista de gatilhos sem cobertura só pode encolher — 3 itens ainda pendentes, já presentes antes desta rodada: `druida-forma-acao=encerrar`, `sortudo-acao=vantagem`, `sortudo-acao=desvantagem`); e2e das suítes tocadas (multiclasse, levelup, magia, grimorio, truque, criador, preparar, issue105, trocas) — 260 specs, 0 falhas. **Correção posterior ao commit inicial (2026-09-23, achado de campo — ficha real do usuário, Bardo 3/Bruxo 1)**: caster do tipo "conhecidas" (Bardo, Bruxo, Feiticeiro — `tipo_conjuracao` em `dados-classes.js`) abre o modal em modo consulta (`somenteConsulta`), que nunca renderiza `data-truque-check` — truque desse tipo de classe é escolhido no assistente de subida, não marcado nesta tela. O excedente de truques (decisão 2, acima) também acontece numa classe assim, e sem check nenhum o jogador não tinha NENHUM caminho nesta tela para tirar o excedente ("não consigo nem selecionar nem desmarcar"). Corrigido em `sheet/grimorio.js`: o cartão selecionado E acima do limite libera o check para REMOVER (nunca para adicionar); fora do excedente, a classe "conhecidas" continua sem check nenhum, como sempre foi. Regressão: 263 e2e nas mesmas suítes (0 falhas), unidade sem falha nova.
- **#76, fechada na versão 3.0.9** (commit `59dc133`, 2026-09-20): mapeadas 17 características de classe/subclasse com uso grátis limitado, em 9 classes. 8 corrigidas de verdade:
  - **Uso ÚNICO** (`gratis_usado` booleano, via `featureConcedeUsoGratisSemEspaco`/`_concederMagiaAutomatica` em levelup.js): Contatar Patrono (Bruxo 9), Destruição do Paladino (Paladino 2), Montaria Fiel (Paladino 5).
  - **Uso MÚLTIPLO/escalado por atributo** (adaptador novo, `site/js/regras-usos-gratis-magia.js`, lido por sheet/magias.js — lê/escreve o MESMO `char.recursos.<classe>.*` que os painéis de recursos já liam): Inimigo Favorito e Reforços Feéricos/Andarilho Nebuloso (Guardião), Mapa Estelar (Druida/Círculo das Estrelas).
  - **Migração de verdade** (não só correção nova): Criaturas Espectrais (Ilusionista), Manto de Majestade (Bardo/Glamour) e Destruição do Paladino tinham BOOKKEEPING PRÓPRIO com botão dedicado que só toastava "conjurado gratuitamente" sem tocar no `gratis_usado` real — achado em revisão, não no comentário original da issue. Os três botões antigos (e o estado que eles liam) foram APAGADOS, não só desligados; o card de Características de Classe agora mostra "Ver Magias" para essas, e o botão real vive só na lista de Magias.
  - Suprimido também o toggle/contador GENÉRICO do card (`data-toggle-uso`/`data-usar-habilidade`, `char.usos_habilidades`) para as 8 características acima — sem isso, o card abriria uma terceira/quarta UI, desincronizada, para o mesmo uso.
  - **Fora desta rodada, de propósito**: Companheiro Dracônico (Feiticeiro 18) — a magia (Invocar Dragão) não é concedida automaticamente, o bônus de uso grátis só existe SE o jogador já a escolheu por outro caminho; teria de ser um mecanismo novo (detectar se já conhece, marcar retroativo), não os dois já construídos. Terceiro Olho (Mago 10) — é um efeito temporário ESCOLHIDO por Ação Bônus (3 opções, só 1 é magia), não uma conjuração; não tem onde pendurar um botão "Grátis" de magia. Intervenção Divina (Clérigo) e Recuperação Natural (Druida) ficaram fora por decisão do dono do produto — "conjure qualquer magia que você já conheça" pede um seletor que não existe hoje.
  - Cobertura: 4257 testes de unidade (0 falhas), 456 specs e2e (0 falhas, 1 flake sob paralelismo confirmado — passa consistente isolado). 3 bugs reais de dupla-contabilidade encontrados e corrigidos em revisão ANTES do commit (Manto de Majestade, colisão de nome "Passo Nebuloso" com o talento Tocado Por Fadas, Destruição do Paladino) — nenhum chegou a ser publicado.
- **Fechadas na versão 3.0.8** (commit `ea43e7d`, 2026-09-18): #81, #67, #78, #62 (corrigidas com teste); #79 e #66 (investigadas, não reproduziram — fechadas com teste de regressão, sem alteração de produção). Histórico do que cada uma era fica só no commit e no GitHub a partir daqui; esta lista não guarda issue fechada.
- **Cluster "magia/truque personalizado"**: #68, #71, #73, #74 fechados na 3.0.7; #78 fechado na 3.0.8; #75/#92 fechados na 3.0.10; #77 fechado na 3.0.11. #98 (círculo superior em magia personalizada), #111 (fonte/livro), #123 (classes com acesso) e #124 (aparecer em "Preparar Magias" do Clérigo) são os membros abertos do cluster — #123 é pré-requisito de #124 e #118; planejar como uma rodada só.
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
- **Triagem de #115–#124 em 2026-10-02**: todas abertas na 3.0.17. Dos seis bugs, #121 e #116 têm causa raiz lida no código (sem teste ainda); #119 é lacuna de gate (a troca de maestria só olha as 5 classes); #115 é hipótese forte de ordem de operações no level-up; #122, #117 e #124 não foram reproduzidos. #116 é efeito colateral da 3.0.15 (a quebra de concentração só reconhece a condição literal Incapacitado). Na #109 entraram três comentários (2026-09-22 a 09-27) que reforçam apontar para homebrew (#40/#38/#52) — a resposta e o fechamento como duplicata seguem pendentes. **#113 foi fechada no GitHub sem commit nosso**; se a decisão da #59 (Preparar Magias abre depois do assistente) for revista, reabrir.
- Ao fechar uma issue por commit, o formato de mensagem e o `Closes #N` estão documentados em [`TRIAGEM-ISSUES.md`](TRIAGEM-ISSUES.md#a-mensagem-de-commit-que-fecha-a-issue).
- Esta lista não inclui issues fechadas nem Pull Requests. Para atualizar do zero, repita a consulta:
  ```bash
  curl -s "https://api.github.com/repos/ZaitBr-bit/D-D_2024/issues?state=open&per_page=100"
  ```
