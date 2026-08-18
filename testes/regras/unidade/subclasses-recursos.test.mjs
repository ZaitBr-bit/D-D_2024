// ============================================================
// Confronto de RECURSOS_SUBCLASSE / SEM_RECURSO_SUBCLASSE (Task 2 deste
// plano, catalogo/subclasses.mjs -- as 241 características das 48
// subclasses, com uso/recarga transcritos do livro) contra as três
// heurísticas ENTITY-AGNÓSTICAS que a ficha usa para decidir usos máximos,
// recarga e ativo/passivo de QUALQUER característica (de classe base ou de
// subclasse, o código não distingue):
//   - detectarUsosMaximos (site/js/sheet/habilidades.js:2390)
//   - detectarRecarga      (site/js/utils.js:509)
//   - ehHabilidadeAtiva    (site/js/utils.js:526)
//
// O QUE ESTE MOTOR PROVA: se cada heurística, rodando sobre o texto REAL de
// dados/classes/*.json (subclasses[].caracteristicas -- confirmado abaixo
// em bijeção 1:1 com o catálogo, sem contaminação de outra subclasse),
// reproduz o número/classificação que o catálogo transcreveu do livro. É um
// confronto de HEURÍSTICA CONTRA PROSA, igual aos motores irmãos
// (subclasses-magias.test.mjs, classes-passivas.test.mjs) -- NÃO é um
// confronto do comportamento do app com um personagem de verdade: nenhum
// estado de recurso é gravado, lido ou consumido aqui, e nenhuma das três
// funções recebe atributo, nível ou classe -- só a string de descrição (e,
// para ehHabilidadeAtiva, o nome).
//
// LIGAÇÃO COM O DOMÍNIO IRMÃO (achado vinculante da Task 1 deste plano, ver
// progress.md): detectarRecarga e ehHabilidadeAtiva são as MESMAS duas
// funções que classes-passivas.test.mjs já confrontou contra as 174
// características de CLASSE BASE -- elas não sabem se o texto que recebem
// veio de uma classe ou de uma subclasse, e de fato rodam sobre subclasse
// de verdade via renderSecaoSubclasse (site/js/sheet/caracteristicas.js:
// 57-80, chamando as duas em :64-65). CONSEQUÊNCIA: qualquer divergência
// encontrada aqui que seja o MESMO padrão textual já registrado como uma
// das 7 causas abertas em lacunas-conhecidas.mjs
// ('classes-passivas-ativa-no-turno', '...-recarga-troca-escolha',
// '...-clausula-lateral', '...-descanso-curto-janela',
// '...-acao-bonus-parte-de', '...-custo-verbo-rigido', '...-reacao-executar')
// NÃO abre causa nova neste domínio -- é a MESMA linha de código, só um call
// site novo para a MESMA entrada. Este arquivo CLASSIFICA cada divergência
// por escrito (mesma causa das 7 / causa nova / erro do motor de teste),
// mas não registra lacuna nenhuma em lacunas-conhecidas.mjs -- isso é
// Task 6 deste plano, não desta.
//
// A REGRA QUE DECIDE O QUE PODE SER AFIRMADO (ver cabeçalho de
// RECURSOS_SUBCLASSE em catalogo/subclasses.mjs): das 72 entradas, só 27 são
// `base` citável ('custo-declarado'/'ausência-de-custo') E NÃO `composta`
// -- só essas 27 sustentam uma alegação sozinhas e recebem `assert.equal`
// nos Grupos 2 e 3. As outras 45 (44 `composta: true` + a única
// `julgamento` -- Ilusionista|6|Criaturas Espectrais, que também é
// composta) RODAM a mesma comparação, mas registram o resultado via
// `t.skip` com a mensagem -- mesmo mecanismo de classes-passivas.test.mjs
// ('julgamento'/`composta`): a heurística roda de verdade e o resultado
// fica visível na mensagem do skip, nada fica escondido; só não vira
// alegação de "app errado" sobre uma leitura do livro que não é fato
// citável sozinho. O Grupo 4 (ativa/passiva) usa uma citabilidade PRÓPRIA
// (`ativaBase`, ver Fix report abaixo) -- é uma pergunta diferente da que
// `base`/`composta` respondem, com sua própria contagem de citáveis (22).
//
// ============================================================
// FIX REPORT (revisão independente de 2026-08-17/18) -- 16 das 24 reds
// originais eram acusação fabricada por expectativa inventada pelo próprio
// teste, não por comportamento errado do app. Corrigido em 4 pontos
// CRITICAL + 2 IMPORTANT, todos dentro deste arquivo e do catálogo
// (nenhuma edição em site/js/ nem dados/). Ver o relatório completo em
// `.superpowers/sdd/2026-08-18-regras-subclasses-4-recursos/task-3-report.md`,
// seção "Fix report", para a lista entrada-a-entrada.
//
//   CRITICAL 1 (Grupo 3) -- 'outro' não é sinônimo de "nenhum Descanso
//     recarrega isto", é só "o gatilho principal, escrito no `livro`, não é
//     um Descanso". Marés do Caos tem Descanso Longo como via ALTERNATIVA
//     citada no próprio texto ("...ou completar um Descanso Longo..."), e
//     detectarRecarga devolvendo 'longo' está CERTO, não errado. Corrigido
//     com o campo novo `recargaTambemPor` (catalogo/subclasses.mjs) -- só
//     Marés do Caos o tem, das 72 entradas.
//   CRITICAL 2/3 (Grupo 4) -- `ATIVA_ESPERADA = true` constante removida.
//     22 das 27 entradas citáveis (por `base`/`composta`) têm, ALÉM disso,
//     uma leitura citável própria para ativa/passiva (`ativaBase` custo-
//     declarado/ausência-de-custo, campo novo); as outras 5 são o MESMO
//     padrão "uma vez por turno, você pode causar/jogar X" que
//     `classes-passivas.mjs` já classifica como julgamento para Ataque
//     Furtivo/Golpes Abençoados -- não sustentam `assert.equal` sozinhas,
//     igual lá. Sentinela Imortal (gatilho automático, "Ao ser reduzido a 0
//     PV...", sem nenhum verbo de decisão do jogador) é a única das 22 com
//     `ativa: false` -- o app devolve `true` (curto-circuito de
//     ehHabilidadeAtiva em `detectarRecarga`, utils.js:535), um red GENUÍNO
//     que prova que o Grupo 4 agora falha nas duas direções (antes só
//     conseguia acusar "false quando deveria ser true"; agora também acusa
//     "true quando deveria ser false").
//   CRITICAL 4 (Grupo 2) -- fórmula com piso "(mín. 1)" ("mod. Sabedoria
//     (mín. 1)") tem esperado 1 quando o app devolve 1, não `null`: o app
//     não calculou o modificador do atributo (não tem acesso a ele), mas
//     acertou o PISO, que é um fato citável e independente do atributo. 11
//     das 18 reds originais do Grupo 2 eram exatamente essa acusação
//     fabricada. As outras 7 (implícito de 1 uso sem "X vezes" literal, 5
//     entradas; pool "quatro d12s", 1; multiplicador de PV "três vezes" lido
//     como contagem, 1 -- Sentinela Imortal) continuam reds genuínos.
//   IMPORTANT 1 (Grupo 3) -- Mapa Estelar (recarga) é o mesmo mecanismo da
//     causa aberta 'classes-passivas-descanso-curto-janela' (segunda menção
//     de Descanso, alheia ao gatilho real, capturada por busca cega de
//     substring) -- documentado como possível mesmo call site no próprio
//     catálogo, a confirmar na Task 6, não decidido aqui.
// ============================================================
// GRUPO 5 (Task 4 do plano 2026-08-18) -- restauração REAL no descanso,
// generalizada às 72 entradas
// ============================================================
// DIFERENÇA DECLARADA em relação a `recursos-restaurados.test.mjs` (o motor
// irmão, nascido do bug real do Campeão dos Deuses -- Bárbaro/Trilha do
// Fanático gravava `campeao_deuses_gastos` ao gastar um d12 e NENHUM ponto
// do app o zerava): aquele motor é SINTÁTICO e agnóstico de origem -- varre
// TODO campo `_usado/_usada/_gasto/_gastos` gravado em qualquer lugar de
// site/js/ e só confere que ele é MENCIONADO em sheet/hp-descanso.js (ou
// está em EXCECOES com o motivo do livro). Ele não sabe se o campo existe
// para o recurso CERTO, nem se está no descanso CERTO -- captura só "campo
// nunca mencionado". Este grupo parte do LADO OPOSTO: começa no LIVRO (cada
// entrada de RECURSOS_SUBCLASSE com `recarga` não-nula), deriva do
// CATÁLOGO qual Descanso deveria restaurá-la, e só then verifica se
// hp-descanso.js tem um ponto de restauração correspondente E no bloco
// certo (Curto vs. Longo). Ele pega dois casos que o motor irmão não pega:
// (a) um campo QUE O APP TEM e que a varredura sintática do irmão marcaria
// "mencionado, portanto ok", mas que está gravado no bloco de descanso
// ERRADO (ou dentro de uma guarda de subclasse QUEBRADA, ver achado
// abaixo) -- mencionado, mas no lugar errado, ou sob uma condição que
// nunca dispara; (b) quando NENHUM campo dedicado existe para o recurso,
// se o CAMINHO GENÉRICO de restauração (`restaurarHabilidades`,
// hp-descanso.js:333, ver correção abaixo) mesmo assim o alcança -- e, se
// alcançar, em qual Descanso. CORREÇÃO desta revisão (ver "FIX REPORT
// (GRUPO 5)" logo abaixo): a versão anterior deste motor tratava
// `campo: null` como sinônimo definitivo de "app nunca modelou este
// recurso", sem nunca consultar esse caminho genérico -- a alegação que
// esse "nunca modelou" sustentava era, ela mesma, curto-circuitada antes
// de examinar uma linha sequer de hp-descanso.js. Isso produziu uma
// acusação falsa (red #1, Ladrão de Magias) e dois skips com motivo falso
// (Implosão de Distorção, Cavalgada Mecânica) -- as três entradas SÃO
// restauradas, pelo caminho genérico, não por um campo dedicado.
//
// COMO ESTE GRUPO OBSERVA O APP -- escolha e limite, por escrito
// ------------------------------------------------------------
// A opção MAIS FORTE (`escadaDeNivel()` + gastar o recurso + chamar a
// função de descanso de verdade + ler o campo) foi tentada e descartada,
// por um motivo técnico concreto, não por preguiça: toda a lógica de
// restauração de sheet/hp-descanso.js vive DENTRO de closures de
// `document.getElementById('btn-descanso-curto'/'btn-descanso-longo')
// ?.addEventListener(...)` em `setupEventosDescanso()` -- não existe
// NENHUMA função exportada tipo `restaurarDescansoLongo(char)` para
// chamar diretamente. O stub de `document` que harness.mjs instala (e que
// esta tarefa NÃO pode editar -- só subclasses-recursos.test.mjs e
// catalogo/subclasses.mjs estão no escopo) devolve `getElementById() =>
// null` sempre; com isso `setupEventosDescanso()` roda e não registra
// NENHUM listener (o `?.` corta tudo em silêncio), e não sobra nenhuma
// referência de função para invocar. Rodar a opção forte exigiria: (1)
// monkey-patchar `globalThis.document.getElementById` a partir deste
// arquivo de teste para capturar os callbacks por id -- viável tecnicamente,
// mas MUTA UM GLOBAL COMPARTILHADO fora de harness.mjs, com risco de
// vazar para outros arquivos de teste rodando no mesmo processo; (2)
// reconstruir, para as 12 classes, o estado de personagem que cada bloco de
// descanso lê (`char`, `classeData`, `especiesCache` de sheet/estado.js,
// mais os `getEstadoRecursos<Classe>()` de cada sheet/classes/*.js) e o
// gasto de cada um dos 72 recursos pelo mecanismo exato do livro antes de
// testar a restauração -- essencialmente um harness comportamental novo do
// tamanho de hp-descanso.js inteiro. Dado o Fix Report acima (16 das 24
// reds da rodada anterior deste MESMO domínio eram fabricadas pelo próprio
// teste) e a regra 6 do guia (uma onda ampla de reds pede suspeita do
// código de teste primeiro), construir esse harness novo sob o prazo desta
// tarefa era o tipo de risco que o guia manda evitar -- por isso a opção
// forte foi descartada, com o motivo técnico acima, não por suposição.
//
// A opção usada é TEXTUAL, mas não é um `.includes()` ingênuo feito à mão
// (isso seria a mesma fraqueza do motor irmão, só que duplicada): o texto
// de hp-descanso.js é fatiado em dois blocos reais -- BLOCO_CURTO (do
// `getElementById('btn-descanso-curto')` até o `'btn-descanso-longo'`) e
// BLOCO_LONGO (deste até `'btn-excluir-char'`) -- e, para toda subclasse
// cujo reset é condicionado por `if (char.subclasse === '<nome>')`, a busca
// do campo é ESCOPADA ao trecho entre essa guarda EXATA (o nome vem sempre
// do catálogo, nunca lido do app) e a guarda seguinte, não ao bloco
// inteiro. Isso é o que torna o método capaz de flagrar um campo que está
// textualmente presente no bloco certo mas sob uma guarda que nunca
// dispara -- ACHADO CRITICAL desta tarefa (ver `CAMPOS_DESCANSO` abaixo,
// bloco "Paladino"): sheet/hp-descanso.js grava `char.subclasse ===
// 'Juramento de Devoção'/'Juramento de Glória'/'Juramento de Vingança'`
// (preposição "de") em vez de `'Juramento da Devoção'/'Juramento da
// Glória'/'Juramento da Vingança'` (o nome real -- confirmado em
// dados/classes/paladino.json, catalogo/subclasses.mjs,
// sheet/classes/paladino.js:61, sheet/combate.js:156 e
// sheet/habilidades.js:2713/2720/2732, todos com "da"). Só a guarda de
// 'Juramento dos Anciões' está certa. Como a busca aqui usa sempre o nome
// EXATO do catálogo, a guarda quebrada nunca "casa", e a ausência é
// relatada como divergência real -- não como coincidência textual (um
// `.includes()` sem escopo NÃO pegaria isso: o campo aparece em algum
// lugar do bloco Longo de qualquer forma, só que dentro do `if` morto).
//
// O LIMITE, por escrito: isolar por casamento EXATO de string de guarda
// prova que a guarda de subclasse bate, mas não avalia condições
// adicionais dentro dela. Domínio da Luz|3|Labareda Protetora e
// Domínio da Luz|6|Labareda Protetora Aprimorada COMPARTILHAM o mesmo
// campo (`labareda_protetora_usos_gastos`) e a mesma guarda de subclasse
// ('Domínio da Luz'); a diferença entre as duas entradas do catálogo é uma
// condição de NÍVEL dentro da guarda do Curto (`(char.nivel || 1) >= 6`,
// hp-descanso.js:502) que o mecanismo genérico não avalia -- por isso essa
// ÚNICA entrada (nível 3) tem uma anotação manual (`curtoOverride: false`)
// em `CAMPOS_DESCANSO`, documentada no próprio mapa, em vez de deixar o
// mecanismo genérico contá-la como restaurada no Curto (o que produziria
// uma acusação fabricada: a entrada de nível 3, sozinha, só promete
// Descanso Longo -- o Curto só passa a valer a partir do upgrade de nível
// 6, e o app está certo ao condicionar assim). Qualquer outra
// nível-condição escondida dentro de uma guarda de subclasse que este
// mecanismo não tenha sido apontado para procurar ficaria invisível da
// mesma forma -- esse é o limite real do método escolhido, não hipotético.
//
//   IMPORTANT 2 -- seis reds sobreviventes do Grupo 2 (Vingança Calcinante,
//     Marés do Caos [usos], Surto Controlado, Ladrão de Magias, O Terceiro
//     Olho, Campeão dos Deuses) têm expectativa legítima mas SEM
//     consequência medida: `temMultiplosUsos` (habilidades.js:2621) é falso
//     tanto para `usosMax ∈ {null, 1}` quanto para `usosMax = null`, então o
//     HTML renderizado é idêntico -- marcados aqui como "sem consequência
//     medida", não registrados como lacuna. Sentinela Imortal é a exceção
//     com consequência medida real (usosMax=3 incorretamente + recarga
//     'longo' → contador "3/3" numa característica de 1 uso só).
//
//     SEGUNDO FATO, faltante na primeira versão deste fix report (achado da
//     re-revisão de 2026-08-18): `temMultiplosUsos` colapsando `usosMax ∈
//     {null, 1}` no mesmo render não é o único motivo para ler um vermelho
//     do Grupo 2 com cautela. 11 das 27 entradas citáveis -- as mesmas 11
//     do CRITICAL 4 (piso "(mín. 1)": Passos Feéricos, A Sorte do Próprio
//     Tenebroso, Mapa Estelar, Andarilho Nebuloso, Sacerdote da Guerra,
//     Labareda Protetora, Coroa de Luz, Restaurar Equilíbrio, Defesa
//     Gloriosa, Integridade Corporal, Torrente de Cura e Dolo -- são
//     renderizadas por um RAMO DEDICADO por subclasse dentro de
//     `renderFeatureItem` (habilidades.js:2419 em diante), que sobrescreve
//     `usosHtmlSummary`/`usosHtmlBody` com um valor calculado do ESTADO DO
//     PERSONAGEM (não do texto) e NUNCA consulta a saída de
//     `detectarUsosMaximos`. Confirmado lendo os 11 ramos: Passos Feéricos
//     (habilidades.js:3238-3243, lê `estadoBruxoSub.passosFeericosMax`, de
//     `sheet/classes/bruxo.js:127,142` -- `modCar = Math.max(1,
//     calcMod(carisma))`); Mapa Estelar (habilidades.js:3454-3459, de
//     `sheet/classes/druida.js:60,76`); Sacerdote da Guerra/Labareda
//     Protetora/Coroa de Luz (habilidades.js:3599-3633, de
//     `sheet/classes/clerigo.js:83,86,89,92`) -- e os outros 8, cada um com
//     a mesma forma (`Math.max(1, calcMod(atributo))` num módulo
//     `sheet/classes/<classe>.js` próprio, ou -- caso de Defesa Gloriosa --
//     calculado inline no próprio ramo de `habilidades.js`), citados campo
//     a campo em `ramoDedicado` na entrada de cada uma
//     (catalogo/subclasses.mjs). MUDA A LEITURA: um vermelho do Grupo 2
//     numa dessas 11 não é "o app calcula os usos errado" -- o app NEM USA
//     o valor de `detectarUsosMaximos` ali, ele calcula do estado do
//     personagem com o piso do livro; a alegação certa, se houver, é sobre
//     a heurística GENÉRICA (o que `detectarUsosMaximos` devolveria se
//     fosse consultada em algum outro lugar), não sobre o que a ficha
//     mostra. Nenhuma das 11 é red hoje (todas batem 1↔1 depois do CRITICAL
//     4) -- a marca fica registrada para quando/se alguma delas voltar a
//     ficar vermelha.
// ============================================================
// FIX REPORT (GRUPO 5) -- revisão independente de 2026-08-17/18: red #1
// (Ladrão de Magias) era acusação FALSA, causada por um ponto cego
// estrutural de como este grupo observa o app -- corrigido em 3 pontos
// CRITICAL + 1 IMPORTANT, todos dentro deste arquivo (nenhuma edição em
// site/js/ nem dados/). red #2 (Juramento -- guarda de Paladino quebrada)
// foi CONFIRMADO real pela mesma revisão e não foi tocado.
//
//   CRITICAL 1 -- existe um SEGUNDO caminho de restauração, genérico e
//     agnóstico de origem, que este grupo nunca olhava:
//     `restaurarHabilidades(tipoDescanso)` (hp-descanso.js:333-390) varre
//     TODA característica de subclasse do personagem (:343-350, sem
//     filtrar por nome, key `subclasse_<nome do catálogo>`), roda
//     `detectarRecarga(descricao)` sobre ela (:371 -- a MESMA função de
//     utils.js que o Grupo 3 acima já testa) e zera
//     `char.usos_habilidades[key]`: no Descanso Longo para QUALQUER
//     recarga detectada, seja ela 'curto', 'longo' ou 'curto_ou_longo'
//     (:378-380, sem filtrar pelo valor -- um Descanso Longo restaura
//     tudo); no Descanso Curto só quando o valor é 'curto' ou
//     'curto_ou_longo' (:381-387). É chamada dentro dos dois blocos que
//     este arquivo fatia: `restaurarHabilidades('curto')` em :463 (dentro
//     de BLOCO_CURTO) e `restaurarHabilidades('longo')` em :771 (dentro de
//     BLOCO_LONGO). Medido contra a descrição REAL de
//     dados/classes/ladino.json: `detectarRecarga` devolve 'longo' para
//     Ladrão de Magias -- a característica RENDERIZA um toggle
//     "✓ Disponível/✗ Usado" (`renderFeatureItem`, habilidades.js:4750-
//     4756, ramo `!usosHtmlBody && ativa && recarga`, key
//     `subclasse_Ladrão de Magias`) e É restaurada no Descanso Longo. O
//     app NÃO deixou este recurso sem modelo -- modelou pelo caminho
//     genérico, não por um campo dedicado. Corrigido com a função nova
//     `coberturaGenerica()` (abaixo): para toda entrada com `campo: null`
//     em `CAMPOS_DESCANSO`, a observação deixou de ser um `false`/`null`
//     forçado e passou a ser o resultado REAL de rodar
//     `utils.detectarRecarga` sobre `feature.descricao` (a mesma
//     característica que o Grupo 3 lê), traduzido para curto/longo pela
//     MESMA assimetria que `restaurarHabilidades` usa (longo cobre
//     qualquer recarga truthy; curto só cobre 'curto'/'curto_ou_longo').
//     ARMADILHA EVITADA, por escrito: usar `detectarRecarga` para decidir
//     o ESPERADO compararia o app com ele mesmo -- por isso o esperado
//     continua vindo só do catálogo (`esperadoRestauracao`, inalterada); a
//     heurística é usada SÓ para responder "o caminho genérico alcança
//     esta característica, e em qual Descanso?", nunca para inventar o que
//     o livro exige. As duas perguntas usam funções diferentes e nunca se
//     misturam no código (ver `coberturaGenerica` vs. `esperadoRestauracao`
//     abaixo).
//   CRITICAL 2 -- a causa raiz do CRITICAL 1: `apareceRestauracao` fazia
//     curto-circuito em `if (!tabela || !tabela.campo) return false;`
//     ANTES de ler um caractere sequer de hp-descanso.js. Toda entrada
//     `campo: null` virava `observado: null` POR CONSTRUÇÃO, qualquer que
//     fosse o conteúdo real do app -- a alegação de que o método detecta
//     "um recurso que o livro concede mas o app NUNCA modelou (nenhum
//     campo em lugar nenhum)" (cabeçalho deste bloco, texto anterior) era
//     falsa: o método só conseguia enxergar um literal de nome de campo
//     hardcoded; não conseguia, estruturalmente, resolver uma chamada como
//     `restaurarHabilidades('longo')` sentada dentro do próprio bloco que
//     ele fatia. Corrigido junto com o CRITICAL 1 -- o cabeçalho deste
//     bloco (acima) foi reescrito para não alegar mais essa capacidade.
//   CRITICAL 3 -- mesmo erro presente em dois skips registrados: Implosão
//     de Distorção e Cavalgada Mecânica (Feiticeiro) foram reportadas como
//     "nunca modeladas" (comentários em `CAMPOS_DESCANSO`, linhas do bloco
//     Feiticeiro). As duas têm `campo: null` (nenhum campo DEDICADO existe
//     -- isso continua verdade) mas `detectarRecarga` devolve 'longo' para
//     as duas descrições reais, então as duas TAMBÉM recebem o toggle
//     genérico e são zeradas por `restaurarHabilidades('longo')` -- "nunca
//     modelado" era falso para as duas. Corrigido: os comentários dessas
//     três entradas (Implosão de Distorção, Cavalgada Mecânica, Ladrão de
//     Magias) em `CAMPOS_DESCANSO` foram reescritos para dizer "sem campo
//     dedicado, coberto pelo caminho genérico", não "nunca modelado".
//   IMPORTANT 1 -- 5 das 27 entradas citáveis (Concentração Fanática,
//     Surto de Magia Selvagem, Golpes Terríveis, Presa do Caçador Superior
//     e Implacável) têm `esperado = null` E, antes desta correção,
//     `campo: null` fazia `observado` valer `null` por construção --
//     `assert.equal(null, null)` sempre batia, qualquer que fosse o
//     conteúdo de hp-descanso.js: os verdes eram tautológicos, sem peso de
//     evidência. Depois da correção, `observado` para as 5 vem de
//     `coberturaGenerica`, que roda `detectarRecarga` de verdade sobre a
//     descrição real -- e o resultado, para as 5, é `null` (o caminho
//     genérico é genuinamente inerte para essas características: nenhuma
//     menciona "descanso" em lugar nenhum do texto). As 5 continuam
//     verdes, mas DEIXARAM de ser tautologia -- agora é uma medição real
//     que poderia ter divergido (como divergiu para Ladrão de Magias) e
//     não divergiu. Nenhuma das 5 permanece tautológica após a correção.
//     ACHADO LATERAL da mesma correção, fora do que este fix report pedia:
//     Presa do Caçador (Caçador nível 3, `composta: true`, não citável) é
//     um SEXTO caso do mesmo padrão que já não é tautológico -- seu
//     `esperado` também é `null` (o Descanso citado no livro é reset de
//     ESCOLHA, não recarga do limite "uma vez por turno", ver comentário
//     na entrada), mas `detectarRecarga` sobre sua descrição real devolve
//     'curto_ou_longo' (a cláusula de reset de escolha MENCIONA "Descanso
//     Curto ou Longo", e a heurística não distingue essa menção de uma
//     recarga de verdade) -- então o caminho genérico ALCANÇA esta
//     característica, na leitura ERRADA de Descanso. Como a entrada é
//     `composta`, isso não vira um `assert.equal` -- só muda a mensagem do
//     skip de "coincidem" para "divergem", exatamente o padrão "coberto,
//     mas no Descanso errado" que este fix report pediu para o método
//     conseguir expressar (distinto de "nunca restaurado").
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SUBCLASSES_CARACTERISTICAS, RECURSOS_SUBCLASSE, SEM_RECURSO_SUBCLASSE,
  CLASSE_DA_SUBCLASSE,
} from '../catalogo/subclasses.mjs';
// MODIFICADORES_ATRIBUTO/EVOLUCAO_PERSONAGEM entram para os Grupos 6/7
// (Task 5 deste plano) -- fonte independente do livro para o modificador
// de atributo e o Bônus de Proficiência, NUNCA utils.calcMod/
// utils.bonusProficiencia (mesma regra imposta pela revisão do domínio
// transversal, ver cabeçalho de ficha-transversal.test.mjs).
import { MODIFICADORES_ATRIBUTO, EVOLUCAO_PERSONAGEM } from '../catalogo/ficha-transversal.mjs';
import { modulosApp, lerClassesDados, RAIZ, comLacuna } from './harness.mjs';

const { utils, store } = await modulosApp();
// detectarUsosMaximos vive em sheet/habilidades.js, fora da lista de
// módulos que modulosApp() importa -- import DINÂMICO e DEPOIS de
// modulosApp() de propósito, mesmo padrão de classes-passivas.test.mjs
// (que importa sheet/combate.js do mesmo jeito): habilidades.js só pode ser
// carregado depois que instalarStubs() já rodou (window/document precisam
// existir antes do import, não depois).
const { detectarUsosMaximos } = await import('../../../site/js/sheet/habilidades.js');
const CLASSES_DADOS = lerClassesDados();

// ------------------------------------------------------------
// Acha a característica (nível, nome) dentro de dados/classes/<classe>.json,
// subclasses[].caracteristicas. Diferente de classes-passivas.test.mjs
// (que precisa filtrar contaminação de outras subclasses do array de
// classe base), o array de CADA subclasse já vem isolado -- confirmado
// abaixo em bijeção 1:1 (241 características do catálogo = 241 em
// dados/classes/*.json, 0 órfão, 0 faltante), então nenhum filtro extra é
// necessário aqui.
// ------------------------------------------------------------
function acharCaracteristica(subclasse, nivel, nome) {
  const classe = CLASSE_DA_SUBCLASSE[subclasse];
  const classeData = CLASSES_DADOS.get(classe);
  const subData = (classeData?.subclasses || []).find((s) => s.nome === subclasse);
  return (subData?.caracteristicas || []).find((f) => f.nivel === nivel && f.nome === nome) || null;
}

// ============================================================
// GRUPO 1 -- Higiene do catálogo (Step 1 do brief)
// ============================================================

test('sanity: SUBCLASSES_CARACTERISTICAS bate 1:1 com dados/classes/*.json (subclasses[].caracteristicas), sem órfão nem faltante', () => {
  const faltantes = []; // no catálogo, sem correspondente em dados/
  const orfaos = [];    // em dados/, sem correspondente no catálogo
  for (const [classe, subs] of Object.entries(SUBCLASSES_CARACTERISTICAS)) {
    const classeData = CLASSES_DADOS.get(classe);
    for (const [subclasse, entradas] of Object.entries(subs)) {
      const subData = (classeData.subclasses || []).find((s) => s.nome === subclasse);
      if (!subData) { faltantes.push(`subclasse inteira ausente de dados/: ${subclasse}`); continue; }
      for (const f of entradas) {
        const achou = (subData.caracteristicas || []).some((x) => x.nivel === f.nivel && x.nome === f.nome);
        if (!achou) faltantes.push(`${subclasse}|${f.nivel}|${f.nome}`);
      }
      for (const x of subData.caracteristicas || []) {
        const noCatalogo = entradas.some((f) => f.nivel === x.nivel && f.nome === x.nome);
        if (!noCatalogo) orfaos.push(`${subclasse}|${x.nivel}|${x.nome}`);
      }
    }
  }
  assert.deepEqual(faltantes, [], `característica(s) do catálogo sem correspondente em dados/classes/*.json: ${faltantes.join('; ')}`);
  assert.deepEqual(orfaos, [], `característica(s) em dados/classes/*.json sem correspondente no catálogo: ${orfaos.join('; ')}`);
});

test('RECURSOS_SUBCLASSE + SEM_RECURSO_SUBCLASSE cobrem exatamente as 241 características de SUBCLASSES_CARACTERISTICAS, sem sobra nem falta nem duplicata', () => {
  const vistos = [];
  for (const [subclasse, entradas] of Object.entries(RECURSOS_SUBCLASSE)) {
    for (const e of entradas) vistos.push(`${subclasse}|${e.nivel}|${e.caracteristica}`);
  }
  for (const chave of Object.keys(SEM_RECURSO_SUBCLASSE)) vistos.push(chave);

  // Duplicadas: mesma chave presente nas duas listas ao mesmo tempo -- as
  // duas precisam ser disjuntas (cada característica cai em EXATAMENTE uma).
  const contagem = new Map();
  for (const chave of vistos) contagem.set(chave, (contagem.get(chave) || 0) + 1);
  const duplicadas = [...contagem.entries()].filter(([, n]) => n > 1).map(([k]) => k);
  assert.deepEqual(duplicadas, [],
    `chave(s) presentes em RECURSOS_SUBCLASSE E SEM_RECURSO_SUBCLASSE ao mesmo tempo: ${duplicadas.join('; ')}`);

  const universo = [];
  for (const subs of Object.values(SUBCLASSES_CARACTERISTICAS)) {
    for (const [subclasse, entradas] of Object.entries(subs)) {
      for (const f of entradas) universo.push(`${subclasse}|${f.nivel}|${f.nome}`);
    }
  }
  assert.equal(universo.length, 241,
    `sanity: SUBCLASSES_CARACTERISTICAS deveria somar 241 características, soma ${universo.length}`);

  const universoSet = new Set(universo);
  const vistosSet = new Set(vistos);
  const faltando = universo.filter((c) => !vistosSet.has(c));
  const sobrando = vistos.filter((c) => !universoSet.has(c));
  assert.deepEqual(faltando, [],
    `característica(s) de SUBCLASSES_CARACTERISTICAS sem entrada em nenhuma das duas listas de recurso: ${faltando.join('; ')}`);
  assert.deepEqual(sobrando, [],
    `chave(s) de RECURSOS_SUBCLASSE/SEM_RECURSO_SUBCLASSE sem característica correspondente em SUBCLASSES_CARACTERISTICAS: ${sobrando.join('; ')}`);
  assert.equal(vistos.length, 241, `total das duas listas deveria ser 241, é ${vistos.length}`);
});

// base/recarga -- mesmo enum documentado no cabeçalho de RECURSOS_SUBCLASSE
// (catalogo/subclasses.mjs): base é 'custo-declarado'/'ausência-de-custo'/
// 'julgamento' (mesmo enum de classes-passivas.mjs); recarga é
// 'curto'/'longo'/'curto-ou-longo'/'outro'/null.
const BASE_VALIDOS = ['custo-declarado', 'ausencia-de-custo', 'julgamento'];
const RECARGA_VALIDOS = ['curto', 'longo', 'curto-ou-longo', 'outro', null];
const CITA_CLASSES_MD = /Classes\.md:\d+/;

for (const [subclasse, entradas] of Object.entries(RECURSOS_SUBCLASSE)) {
  for (const e of entradas) {
    test(`higiene: ${subclasse} nível ${e.nivel} "${e.caracteristica}" (RECURSOS_SUBCLASSE) -- cita Classes.md, base/recarga válidos, característica existe`, () => {
      assert.ok(CITA_CLASSES_MD.test(e.livro),
        `livro deveria citar "Classes.md:<linha>" da sentença decisiva, tem: "${e.livro}"`);
      assert.ok(BASE_VALIDOS.includes(e.base),
        `base "${e.base}" fora do enum válido (${BASE_VALIDOS.join('/')})`);
      assert.ok(RECARGA_VALIDOS.includes(e.recarga),
        `recarga "${e.recarga}" fora do enum válido (${RECARGA_VALIDOS.filter((v) => v !== null).join('/')}/null)`);
      const existe = (SUBCLASSES_CARACTERISTICAS[CLASSE_DA_SUBCLASSE[subclasse]]?.[subclasse] || [])
        .some((f) => f.nivel === e.nivel && f.nome === e.caracteristica);
      assert.ok(existe,
        `${subclasse} nível ${e.nivel} "${e.caracteristica}" não existe em SUBCLASSES_CARACTERISTICAS (nível/nome não batem)`);
    });
  }
}

for (const [chave, motivo] of Object.entries(SEM_RECURSO_SUBCLASSE)) {
  test(`higiene: SEM_RECURSO_SUBCLASSE "${chave}" -- cita Classes.md, característica existe`, () => {
    assert.ok(CITA_CLASSES_MD.test(motivo),
      `motivo deveria citar "Classes.md:<linha>" da sentença decisiva, tem: "${motivo}"`);
    const partes = chave.split('|');
    const nivel = parseInt(partes[1], 10);
    const subclasse = partes[0];
    const nome = partes.slice(2).join('|');
    const existe = (SUBCLASSES_CARACTERISTICAS[CLASSE_DA_SUBCLASSE[subclasse]]?.[subclasse] || [])
      .some((f) => f.nivel === nivel && f.nome === nome);
    assert.ok(existe, `"${chave}" não existe em SUBCLASSES_CARACTERISTICAS (nível/nome não batem)`);
  });
}

// ============================================================
// Base compartilhada dos Grupos 2-4: as 72 entradas de RECURSOS_SUBCLASSE
// achatadas com a subclasse embutida, e o filtro "citável" que decide
// assert.equal (27) vs t.skip (45) -- ver cabeçalho deste arquivo.
// ============================================================
const TODAS_ENTRADAS_RECURSO = Object.entries(RECURSOS_SUBCLASSE)
  .flatMap(([subclasse, entradas]) => entradas.map((e) => ({ subclasse, ...e })));

// Citável = base é 'custo-declarado'/'ausência-de-custo' (o livro tem frase
// citável) E não `composta` (o livro não empacota, sob o mesmo nome, uma
// segunda cláusula de natureza diferente). As duas condições, não uma só --
// mesma regra do cabeçalho de RECURSOS_SUBCLASSE.
function ehCitavel(e) {
  return (e.base === 'custo-declarado' || e.base === 'ausencia-de-custo') && !e.composta;
}

test('sanity: 72 entradas em RECURSOS_SUBCLASSE, 27 citáveis (base custo-declarado/ausência-de-custo, não composta)', () => {
  assert.equal(TODAS_ENTRADAS_RECURSO.length, 72,
    `sanity: RECURSOS_SUBCLASSE deveria somar 72 entradas, soma ${TODAS_ENTRADAS_RECURSO.length}`);
  const citaveis = TODAS_ENTRADAS_RECURSO.filter(ehCitavel);
  assert.equal(citaveis.length, 27,
    `sanity: deveriam existir 27 entradas citáveis, existem ${citaveis.length} -- se este número mudou, os ` +
    `Grupos 2-4 abaixo precisam ser revistos (é ele que decide assert.equal vs t.skip)`);
});

// ============================================================
// GRUPO 2 -- detectarUsosMaximos (site/js/sheet/habilidades.js:2390) × livro
// ============================================================
// O esperado vem do CATÁLOGO, nunca da função sob teste:
//   - `usos` NUMÉRICO (48 das 72) -- detectarUsosMaximos foi escrita para
//     reconhecer contagens fixas em texto ("duas vezes"=>2, ver o
//     comentário da própria função); o esperado é o número do catálogo.
//   - `usos` FÓRMULA com PISO CITÁVEL "(mín. 1)" (ex. "mod. Sabedoria
//     (mín. 1)") -- CRITICAL 4 do fix report (cabeçalho do arquivo): o
//     esperado é 1, não `null`. A heurística não calcula o modificador do
//     atributo (não tem acesso a ele), mas "(mínimo de uma vez)" no livro é
//     um FATO citável e independente do atributo -- 1 é o piso real,
//     documentado no próprio catálogo (`usos` sempre inclui "(mín. 1)"
//     nesses casos). A versão anterior deste teste mapeava toda fórmula
//     para `null` e acusava o app de errar ao "acertar o piso" -- 11 das 18
//     reds originais deste grupo eram exatamente essa acusação fabricada.
//   - `usos` FÓRMULA SEM piso citável (ex. "1 + nível de Bruxo (dados de
//     d6)") OU `null` (custo crescente sem teto, Sobrecarga do Evocador) --
//     aqui sim o único valor que a heurística PODE devolver sem estar
//     inventando um número é null ("não detectei uma contagem fixa"): não
//     há piso nem contagem fixa nenhuma para citar.
const TEM_PISO_MINIMO_UM = /\(mín\.\s*1\)/i;
function usosMaximosEsperado(e) {
  if (typeof e.usos === 'number') return e.usos;
  if (typeof e.usos === 'string' && TEM_PISO_MINIMO_UM.test(e.usos)) return 1;
  return null;
}

// ============================================================
// TASK 6 (registro de lacunas, lacunas-conhecidas.mjs) -- ligação entre um
// red específico deste arquivo (chave "subclasse|nivel|característica") e a
// entrada de LACUNAS que o explica. Mesmo padrão de
// CAUSA_DIVERGENCIA_ATIVO_PASSIVO em classes-passivas.test.mjs: `talento`/
// `teste` aqui precisam bater EXATAMENTE com os campos da entrada em
// lacunas-conhecidas.mjs (não são livres).
//
// Sentinela Imortal (Juramento dos Anciões nv15) -- MESMA causa já
// documentada em 'classes-passivas-descanso-curto-janela' (a nota sobre
// Fúria Implacável do Bárbaro, "duas vezes seu nível" lido como usosMax=2):
// aqui o livro diz "...recupera um número de Pontos de Vida igual a TRÊS
// VEZES o seu nível de Paladino..." (Classes.md:5889, fórmula de cura, não
// contagem de uso) e detectarUsosMaximos casa "três vezes" e devolve 3
// contra o catálogo (usos: 1) -- confirmado rodando a função de verdade
// sobre o texto real. MESMO mecanismo de falso positivo, mesma entrada.
//
// As outras 6 (Padrão B/C do relatório da Task 3 -- "você pode usar
// novamente após Descanso X" sem "X vezes" literal, ou pool descrito por
// adjetivo numeral "quatro d12s") viram uma causa NOVA, tipo
// 'limitacao-observabilidade': medido em habilidades.js que
// `temMultiplosUsos` (:2621, `usosMax && usosMax > 1 && recarga`) só é
// truthy quando usosMax > 1 -- para as 6, o catálogo já concorda que
// usosMax é 1 (implícito) ou 4 sem contagem citável, mas mesmo que
// detectarUsosMaximos acertasse, `usosMax === 1` cai no MESMO `else`
// (`!usosHtmlBody && ativa && recarga`, :4750, o toggle "✓ Disponível"/"✗
// Usado" sem contador) que `usosMax === null` já cai hoje -- o HTML
// renderizado é idêntico nos dois casos, então esta rota do teste (o valor
// BRUTO de detectarUsosMaximos) não observa nenhuma diferença que o
// jogador veja. Ver o motivo completo em lacunas-conhecidas.mjs.
const CAUSA_USOS_MAXIMOS = {
  'Juramento dos Anciões|15|Sentinela Imortal': { talento: 'Mago', teste: 'classes-passivas-descanso-curto-janela' },
  'Trilha do Fanático|3|Campeão dos Deuses': { talento: 'Feitiçaria Selvagem', teste: 'subclasses-recursos-usos-sem-consequencia' },
  'Patrono Celestial|14|Vingança Calcinante': { talento: 'Feitiçaria Selvagem', teste: 'subclasses-recursos-usos-sem-consequencia' },
  'Feitiçaria Selvagem|3|Marés do Caos': { talento: 'Feitiçaria Selvagem', teste: 'subclasses-recursos-usos-sem-consequencia' },
  'Feitiçaria Selvagem|18|Surto Controlado': { talento: 'Feitiçaria Selvagem', teste: 'subclasses-recursos-usos-sem-consequencia' },
  'Trapaceiro Arcano|17|Ladrão de Magias': { talento: 'Feitiçaria Selvagem', teste: 'subclasses-recursos-usos-sem-consequencia' },
  'Adivinhador|10|O Terceiro Olho': { talento: 'Feitiçaria Selvagem', teste: 'subclasses-recursos-usos-sem-consequencia' },
};

for (const entrada of TODAS_ENTRADAS_RECURSO) {
  const { subclasse, nivel, caracteristica } = entrada;
  test(`detectarUsosMaximos: ${subclasse} nível ${nivel} "${caracteristica}" (${entrada.base}${entrada.composta ? ', composta' : ''})`, async (t) => {
    const feature = acharCaracteristica(subclasse, nivel, caracteristica);
    // Já confirmado pela bijeção do Grupo 1, mas repetir aqui é o que
    // impede este teste de comparar contra `undefined` com uma mensagem
    // sem sentido, caso este arquivo rode sozinho -- mesmo padrão de
    // classes-passivas.test.mjs.
    assert.ok(feature,
      `${subclasse} nível ${nivel} "${caracteristica}": sem característica correspondente em dados/classes/*.json`);

    const esperado = usosMaximosEsperado(entrada);
    const atual = detectarUsosMaximos(feature.descricao);
    // Metade faltante do CRITICAL 4 (fix da re-revisão de 2026-08-18, ver
    // IMPORTANT 2 no cabeçalho do arquivo): quando `ramoDedicado` existe no
    // catálogo, o valor REALMENTE exibido na ficha não vem de
    // `detectarUsosMaximos` -- um vermelho aqui seria sobre a heurística
    // genérica, não sobre o que o jogador vê. Anexado à mensagem (sucesso
    // ou falha) para quem lê o resultado deste teste especificamente,
    // sem depender de abrir o catálogo.
    const avisoRamoDedicado = entrada.ramoDedicado
      ? ` AVISO: a ficha usa ramo dedicado para o valor exibido, não esta heurística -- ${entrada.ramoDedicado}.`
      : '';

    if (!ehCitavel(entrada)) {
      const bateu = atual === esperado;
      const razao = entrada.base === 'julgamento' ? 'julgamento' : 'composta';
      t.skip(`${razao} (não é lacuna): catálogo usos=${JSON.stringify(entrada.usos)} (esperado do app: ` +
        `${JSON.stringify(esperado)}), detectarUsosMaximos devolveu ${JSON.stringify(atual)} ` +
        `(${bateu ? 'coincidem' : 'divergem'}) -- ${entrada.livro}${avisoRamoDedicado}`);
      return;
    }
    const rodarAsserção = () => assert.equal(atual, esperado,
      `${subclasse} nível ${nivel} "${caracteristica}" [${entrada.base}] -- livro (${entrada.livro}). ` +
      `Catálogo: usos=${JSON.stringify(entrada.usos)} (esperado do app: ${JSON.stringify(esperado)}). ` +
      `detectarUsosMaximos devolveu ${JSON.stringify(atual)}.${avisoRamoDedicado}`);
    const causa = CAUSA_USOS_MAXIMOS[`${subclasse}|${nivel}|${caracteristica}`];
    if (causa) {
      await comLacuna(causa.talento, causa.teste, rodarAsserção);
    } else {
      rodarAsserção();
    }
  });
}

// ============================================================
// GRUPO 3 -- detectarRecarga (site/js/utils.js:509) × livro
// ============================================================
// Tradução do VOCABULÁRIO do catálogo (hífen) para o vocabulário do app
// (underscore) -- não é uma alegação, só formato: 'curto-ou-longo'
// (catálogo) e 'curto_ou_longo' (detectarRecarga, utils.js:513/517)
// descrevem a MESMA classificação.
//
// 'outro' -- CRITICAL 1 do fix report (cabeçalho do arquivo). A versão
// anterior deste teste mapeava 'outro' cegamente para `null`, tratando-o
// como sinônimo de "nenhum Descanso recarrega isto". Mas 'outro' só
// documenta que o GATILHO PRINCIPAL não é um Descanso ("uma vez por
// turno", "uma vez por Fúria ativa" etc., ver "CHAMADA JULGADA" no
// cabeçalho de RECURSOS_SUBCLASSE) -- não que Descanso nenhum participa.
// Quando o próprio `livro` cita um Descanso como via ALTERNATIVA de
// recarga (Marés do Caos: "...ou completar um Descanso Longo..."), esse
// Descanso é real, e detectarRecarga encontrá-lo não é falso positivo --
// é o app lendo corretamente uma via que o livro de fato declara. Por
// isso o esperado, para 'outro', vem de `recargaTambemPor` (campo do
// catálogo, curado do `livro`) quando presente, e só cai para `null`
// quando essa via não existe (a maioria das entradas 'outro': nenhum
// Descanso aparece em lugar nenhum do texto, e null é o valor certo).
//
// Fora de 'outro': detectarRecarga só reconhece a SUBSTRING "descanso
// curto"/"descanso longo" em qualquer lugar do texto. Se a característica
// MENCIONA descanso em outra parte do texto (cláusula lateral sobre outra
// sub-habilidade, ou uma janela para uma ação alheia -- ver IMPORTANT 1 do
// fix report sobre Mapa Estelar), a busca cega por substring pode achar
// essa menção e devolver um valor diferente do `recarga` citado -- é
// exatamente esse tipo de achado que este grupo existe para expor (mesma
// família dos achados 2/4 já registrados para classe base).
const RECARGA_CATALOGO_PARA_APP = {
  'curto': 'curto',
  'longo': 'longo',
  'curto-ou-longo': 'curto_ou_longo',
};
function recargaEsperada(e) {
  if (e.recarga === null) return null;
  if (e.recarga === 'outro') return e.recargaTambemPor ?? null;
  return RECARGA_CATALOGO_PARA_APP[e.recarga];
}

// TASK 6 (lacunas-conhecidas.mjs) -- Mapa Estelar (Círculo das Estrelas nv3)
// é a MESMA causa 'classes-passivas-descanso-curto-janela': o texto tem DOIS
// parágrafos com Descanso -- o real (Raio Guia, "...Descanso Longo") e um
// TOTALMENTE ALHEIO ("Essa cerimônia [recriar o mapa] pode ser realizada
// durante um Descanso Curto ou Longo...") -- e detectarRecarga (utils.js:509)
// faz busca cega por substring, funde os dois e devolve 'curto_ou_longo'
// contra o catálogo 'longo'. Mesmo mecanismo de código (substring sem
// isolar cláusulas) que já explica Memorizar Magia/Fúria Implacável naquela
// entrada -- call site novo, não causa nova.
const CAUSA_RECARGA = {
  'Círculo das Estrelas|3|Mapa Estelar': { talento: 'Mago', teste: 'classes-passivas-descanso-curto-janela' },
};

for (const entrada of TODAS_ENTRADAS_RECURSO) {
  const { subclasse, nivel, caracteristica } = entrada;
  test(`detectarRecarga: ${subclasse} nível ${nivel} "${caracteristica}" (${entrada.base}${entrada.composta ? ', composta' : ''})`, async (t) => {
    const feature = acharCaracteristica(subclasse, nivel, caracteristica);
    assert.ok(feature,
      `${subclasse} nível ${nivel} "${caracteristica}": sem característica correspondente em dados/classes/*.json`);

    const esperado = recargaEsperada(entrada);
    const atual = utils.detectarRecarga(feature.descricao);

    if (!ehCitavel(entrada)) {
      const bateu = atual === esperado;
      const razao = entrada.base === 'julgamento' ? 'julgamento' : 'composta';
      t.skip(`${razao} (não é lacuna): catálogo recarga=${JSON.stringify(entrada.recarga)} (esperado do app: ` +
        `${JSON.stringify(esperado)}), detectarRecarga devolveu ${JSON.stringify(atual)} ` +
        `(${bateu ? 'coincidem' : 'divergem'}) -- ${entrada.livro}`);
      return;
    }
    const rodarAsserção = () => assert.equal(atual, esperado,
      `${subclasse} nível ${nivel} "${caracteristica}" [${entrada.base}] -- livro (${entrada.livro}). ` +
      `Catálogo: recarga=${JSON.stringify(entrada.recarga)} (esperado do app: ${JSON.stringify(esperado)}). ` +
      `detectarRecarga devolveu ${JSON.stringify(atual)}.`);
    const causa = CAUSA_RECARGA[`${subclasse}|${nivel}|${caracteristica}`];
    if (causa) {
      await comLacuna(causa.talento, causa.teste, rodarAsserção);
    } else {
      rodarAsserção();
    }
  });
}

// ============================================================
// GRUPO 4 -- ehHabilidadeAtiva (site/js/utils.js:526) × livro
// ============================================================
// CRITICAL 2/3 do fix report (cabeçalho do arquivo). A versão anterior
// deste grupo usava `ATIVA_ESPERADA = true`, uma CONSTANTE, sob a tese de
// que "declarar um limite de uso é, por definição, uma decisão custeada".
// Essa tese está errada em dois sentidos, os dois confirmados pela revisão
// independente de 2026-08-17:
//   1. "declarar um limite" (a pergunta que `base`/`composta` respondem,
//      para ADMISSÃO em RECURSOS_SUBCLASSE) e "ser uma decisão ativa do
//      jogador" (a pergunta que `ehHabilidadeAtiva` responde) são
//      perguntas DIFERENTES sobre o mesmo texto -- `classes-passivas.mjs`
//      já registra isso: o padrão "uma vez por turno, você pode causar X
//      dano" É um limite citável (custo-declarado LÁ, em subclasses.mjs)
//      mas NÃO é uma frase de custo de ativação (julgamento EM
//      classes-passivas.mjs, para Ataque Furtivo/Golpes Abençoados). Uma
//      constante não pode representar duas respostas diferentes para a
//      mesma pergunta -- por isso 4 das 27 citáveis (Concentração
//      Fanática, Golpes Terríveis, Presa do Caçador Superior, Implacável)
//      eram reds fabricados: o app concordando com a leitura do próprio
//      projeto (classes-passivas.mjs) virava "app errado".
//   2. Uma constante nunca pode capturar o app classificando ativo algo
//      que o livro concede PASSIVAMENTE (a direção oposta) -- e essa
//      direção é justamente a mais registrada no domínio irmão (8
//      características, causa `classes-passivas-ativa-no-turno`,
//      lacunas-conhecidas.mjs:425). `ehHabilidadeAtiva` tem um
//      curto-circuito (`if (recarga) return true`, utils.js:535) que torna
//      TODA entrada com recarga detectada "ativa" -- 22 das 23 entradas
//      citáveis antigas passavam só por causa desse curto-circuito, não
//      porque o texto tivesse mesmo um verbo de ativação. Sentinela
//      Imortal ("Ao ser reduzido a 0 Pontos de Vida...", gatilho
//      inteiramente automático, sem NENHUM verbo de decisão do jogador) é
//      o caso que expõe isso -- ver `ativa`/`ativaBase` abaixo.
//
// Correção: cada uma das 27 entradas antes citáveis (por `base`/
// `composta`) ganhou, no catálogo, um campo PRÓPRIO para esta pergunta --
// `ativa` (bool) e `ativaBase` ('custo-declarado'/'ausencia-de-custo'/
// 'julgamento', MESMO enum de `classes-passivas.mjs`, respondendo à MESMA
// pergunta daquele catálogo: há uma frase de CUSTO DE ATIVAÇÃO --
// Ação/Ação Bônus/Reação/verbo de decisão do jogador -- presa ao
// benefício?). Só `ativaBase` custo-declarado/ausência-de-custo sustenta
// `assert.equal` aqui -- 22 das 27; as outras 5 são 'julgamento' (mesmo
// padrão de Ataque Furtivo, não citável, igual lá). Citabilidade e
// esperado vêm inteiramente do catálogo -- nunca de `ehHabilidadeAtiva`.
//
// As 45 entradas compostas/julgamento (pela pergunta de usos/recarga) NÃO
// têm `ativaBase` curado -- curar as 27 já citáveis nesta pergunta foi o
// escopo deste fix; estender para as 45 é trabalho futuro, não deste
// arquivo. Para essas, o teste só registra o que `ehHabilidadeAtiva`
// devolveu de verdade, sem alegar um esperado que não foi curado.
function ehCitavelAtiva(e) {
  return e.ativaBase === 'custo-declarado' || e.ativaBase === 'ausencia-de-custo';
}

test('sanity: das 27 entradas citáveis (usos/recarga), 22 também sustentam ativa/passiva por conta própria (ativaBase custo-declarado/ausência-de-custo); 5 são julgamento (mesmo padrão de Ataque Furtivo/Golpes Abençoados)', () => {
  const citaveisUsosRecarga = TODAS_ENTRADAS_RECURSO.filter(ehCitavel);
  const citaveisAtiva = citaveisUsosRecarga.filter(ehCitavelAtiva);
  const julgamentoAtiva = citaveisUsosRecarga.filter((e) => e.ativaBase === 'julgamento');
  assert.equal(citaveisAtiva.length, 22,
    `sanity: deveriam existir 22 entradas citáveis para ativa/passiva, existem ${citaveisAtiva.length}`);
  assert.equal(julgamentoAtiva.length, 5,
    `sanity: deveriam existir 5 entradas julgamento (não citáveis) para ativa/passiva, existem ${julgamentoAtiva.length}`);
  assert.equal(citaveisAtiva.length + julgamentoAtiva.length, citaveisUsosRecarga.length,
    'sanity: toda entrada citável por usos/recarga precisa ter `ativaBase` curado (custo-declarado/ausência-de-custo/julgamento)');
});

// TASK 6 (lacunas-conhecidas.mjs) -- Sentinela Imortal (Juramento dos
// Anciões nv15) é causa NOVA, não uma das 7 abertas: o texto ("Ao ser
// reduzido a 0 Pontos de Vida...") não tem NENHUM verbo de decisão do
// jogador -- gatilho inteiramente automático -- mas ehHabilidadeAtiva
// (utils.js:526) devolve `true` só pelo curto-circuito `if (recarga) return
// true` (utils.js:535): detectarRecarga acerta 'longo' de verdade aqui (não
// é uma má-detecção de cláusula, ao contrário das 7 causas abertas), e o
// curto-circuito trata QUALQUER recarga confirmada como prova de ativação,
// mesmo quando o texto não tem verbo nenhum de escolha. Diferente em
// mecanismo das 7 (todas sobre detectarRecarga/a lista de frases casando
// TEXTO ERRADO); aqui a detecção está certa, e o defeito é o curto-circuito
// assumir "recarrega" implica "é decisão do jogador".
const CAUSA_ATIVA = {
  'Juramento dos Anciões|15|Sentinela Imortal': { talento: 'Juramento dos Anciões', teste: 'subclasses-recursos-ativa-curto-circuito-automatico' },
};

for (const entrada of TODAS_ENTRADAS_RECURSO) {
  const { subclasse, nivel, caracteristica } = entrada;
  test(`ehHabilidadeAtiva: ${subclasse} nível ${nivel} "${caracteristica}" (${entrada.base}${entrada.composta ? ', composta' : ''})`, async (t) => {
    const feature = acharCaracteristica(subclasse, nivel, caracteristica);
    assert.ok(feature,
      `${subclasse} nível ${nivel} "${caracteristica}": sem característica correspondente em dados/classes/*.json`);

    const atual = utils.ehHabilidadeAtiva(feature.descricao, feature.nome);

    if (!ehCitavelAtiva(entrada)) {
      if (entrada.ativaBase) {
        // Curado, mas julgamento (mesmo padrão de Ataque Furtivo) -- roda a
        // comparação de verdade e registra o resultado, sem virar alegação.
        const bateu = atual === entrada.ativa;
        t.skip(`julgamento (ativa/passiva, não é lacuna): leitura do app (${entrada.ativaMotivo}) = ` +
          `${entrada.ativa}, ehHabilidadeAtiva devolveu ${atual} (${bateu ? 'coincidem' : 'divergem'}) -- ${entrada.livro}`);
      } else {
        // Sem curadoria própria nesta pergunta (composta/julgamento pela
        // pergunta de usos/recarga) -- só registra o que a heurística
        // devolveu de verdade, sem inventar um esperado.
        const razao = entrada.base === 'julgamento' ? 'julgamento (usos/recarga)' : 'composta';
        t.skip(`${razao}, sem \`ativaBase\` curado neste fix (fora de escopo): ehHabilidadeAtiva devolveu ` +
          `${atual} -- ${entrada.livro}`);
      }
      return;
    }
    const rodarAsserção = () => assert.equal(atual, entrada.ativa,
      `${subclasse} nível ${nivel} "${caracteristica}" [ativaBase: ${entrada.ativaBase}] -- ${entrada.ativaMotivo} ` +
      `Catálogo: ativa=${entrada.ativa}. ehHabilidadeAtiva devolveu ${atual}.`);
    const causa = CAUSA_ATIVA[`${subclasse}|${nivel}|${caracteristica}`];
    if (causa) {
      await comLacuna(causa.talento, causa.teste, rodarAsserção);
    } else {
      rodarAsserção();
    }
  });
}

// ============================================================
// GRUPO 5 -- restauração REAL no descanso (site/js/sheet/hp-descanso.js) ×
// livro. Ver cabeçalho do arquivo para a diferença declarada em relação a
// recursos-restaurados.test.mjs, o método de observação escolhido e o seu
// limite.
// ============================================================
const DESCANSO_TEXTO = readFileSync(RAIZ + '/site/js/sheet/hp-descanso.js', 'utf-8');
const IDX_CURTO = DESCANSO_TEXTO.indexOf("getElementById('btn-descanso-curto')");
const IDX_LONGO = DESCANSO_TEXTO.indexOf("getElementById('btn-descanso-longo')");
const IDX_EXCLUIR = DESCANSO_TEXTO.indexOf("getElementById('btn-excluir-char')");

test('sanity: os três marcadores usados para fatiar hp-descanso.js em blocos Curto/Longo existem e estão em ordem', () => {
  assert.ok(IDX_CURTO > -1, "marcador \"getElementById('btn-descanso-curto')\" não encontrado -- hp-descanso.js mudou de forma, ver cabeçalho do arquivo");
  assert.ok(IDX_LONGO > IDX_CURTO, "marcador \"getElementById('btn-descanso-longo')\" não encontrado depois do Curto");
  assert.ok(IDX_EXCLUIR > IDX_LONGO, "marcador \"getElementById('btn-excluir-char')\" não encontrado depois do Longo");
});

const BLOCO_CURTO = DESCANSO_TEXTO.slice(IDX_CURTO, IDX_LONGO);
const BLOCO_LONGO = DESCANSO_TEXTO.slice(IDX_LONGO, IDX_EXCLUIR);

// Devolve o sub-trecho de `blocoTexto` que fica sob `if (char.subclasse ===
// '<subclasse>'` -- da ocorrência EXATA desse literal (sempre o nome do
// CATÁLOGO, nunca lido do app) até a guarda de subclasse seguinte, ou até o
// fim do bloco. `null` se esse nome EXATO não aparece nenhuma vez no bloco
// -- é isto que expõe o achado CRITICAL desta tarefa: hp-descanso.js grava
// 'Juramento de Devoção'/'Juramento de Glória'/'Juramento de Vingança'
// (preposição errada) em vez do nome real ('da'/'da'/'da', ver cabeçalho) --
// buscar pelo nome CERTO nunca encontra a guarda quebrada, e a ausência é
// relatada como divergência real, não como coincidência textual.
function subBlocoDaSubclasse(blocoTexto, subclasse) {
  const marcador = `subclasse === '${subclasse}'`;
  const inicio = blocoTexto.indexOf(marcador);
  if (inicio === -1) return null;
  const proxima = blocoTexto.indexOf("subclasse === '", inicio + marcador.length);
  return blocoTexto.slice(inicio, proxima === -1 ? undefined : proxima);
}

// `entrada.semGuarda` -- true para as classes cujo reset de campos de
// subclasse em hp-descanso.js NÃO é condicionado por `char.subclasse` (a
// restauração roda para todo personagem da classe, sem checar qual
// subclasse -- inofensivo, porque o campo só existe se a subclasse certa o
// tiver criado): Bárbaro (Trilha do Berserker/Fanático, campos soltos em
// `char.recursos.<campo>`) e Feiticeiro (as quatro subclasses, campos em
// `char.recursos.feiticeiro.subclasses.<slug>.<campo>` mas sem `if
// (char.subclasse===...)`). `semGuardaCurto`/`semGuardaLongo` cobrem o caso
// de Clérigo, cujo Curto EXIGE a guarda mas o Longo reseta os campos de
// subclasse incondicionalmente (hp-descanso.js:848-852). `curtoOverride:
// false` é a ÚNICA anotação manual do mapa -- ver o limite do método no
// cabeçalho do arquivo (Domínio da Luz|3|Labareda Protetora).
// Só chamada quando `tabela.campo` existe (o chamador, no loop principal,
// decide entre esta função -- campo dedicado -- e `coberturaGenerica` --
// sem campo dedicado, ver função abaixo e FIX REPORT (GRUPO 5) no
// cabeçalho do arquivo).
function apareceRestauracao(blocoTexto, subclasse, tabela, semGuardaNesteBloco) {
  if (tabela.semGuarda || semGuardaNesteBloco) return blocoTexto.includes(tabela.campo);
  const sub = subBlocoDaSubclasse(blocoTexto, subclasse);
  return sub !== null && sub.includes(tabela.campo);
}

// CAMINHO GENÉRICO -- CRITICAL 1/2 do FIX REPORT (GRUPO 5, cabeçalho do
// arquivo). Quando NENHUM campo dedicado existe para um recurso (`campo:
// null` em CAMPOS_DESCANSO), a busca textual acima não tem o que procurar
// -- mas isso não significa que o app nunca restaura o recurso: existe um
// SEGUNDO mecanismo, genérico e agnóstico de origem, que este grupo
// deixava de olhar. `restaurarHabilidades(tipoDescanso)`
// (site/js/sheet/hp-descanso.js:333-390, chamada em :463 dentro de
// BLOCO_CURTO e em :771 dentro de BLOCO_LONGO) varre TODA característica
// de subclasse do personagem (:343-350, sem filtrar por nome) e roda
// `detectarRecarga(descricao)` (:371) sobre cada uma -- a MESMA função de
// utils.js que o Grupo 3 acima já testa, aqui invocada como
// `utils.detectarRecarga` (nunca uma reimplementação). A decisão de zerar
// é ASSIMÉTRICA entre os dois Descansos (hp-descanso.js:378-387): no Longo,
// QUALQUER recarga detectada (curto, longo OU curto_ou_longo) é zerada --
// um Descanso Longo restaura tudo, sem filtrar pelo valor; no Curto, só
// 'curto' ou 'curto_ou_longo' são zerados. Esta função replica exatamente
// essa assimetria, para UMA característica.
//
// ARMADILHA EVITADA, por escrito (pedida pela revisão): usar
// `detectarRecarga` aqui para decidir o ESPERADO compararia o app com ele
// mesmo. Isso NÃO faz isso -- o esperado continua vindo só do catálogo
// (`esperadoRestauracao`, abaixo, inalterada). Esta função responde a uma
// pergunta diferente: "o caminho genérico ALCANÇA esta característica, e
// em qual Descanso?" -- um fato sobre o app, não uma previsão do livro. As
// duas perguntas nunca se misturam: `esperadoRestauracao` só lê `entrada`
// (catálogo); `coberturaGenerica` só lê `descricao` (dados/classes/*.json)
// através de `utils.detectarRecarga` (a função sob teste).
function coberturaGenerica(descricao) {
  const r = utils.detectarRecarga(descricao);
  return { r, longo: !!r, curto: r === 'curto' || r === 'curto_ou_longo' };
}

// Campo DEDICADO de hp-descanso.js que corresponde ao BENEFÍCIO de cada
// entrada de RECURSOS_SUBCLASSE -- achado por leitura de site/js inteiro
// (nunca por um nome adivinhado a partir do nome da característica, ver
// "armadilha do nome de campo" no brief: Bárbaro, Mago e Monge têm blocos
// onde a mesma classe ora usa `.subclasses.<slug>.`, ora campos soltos).
// `campo: null` quando NENHUM campo DEDICADO existe em site/js inteiro
// (confirmado por busca própria, citada no comentário da entrada) -- CORREÇÃO
// do FIX REPORT (GRUPO 5, cabeçalho do arquivo): campo dedicado ausente NÃO
// é mais tratado como "app nunca modelou" -- o loop principal, abaixo,
// consulta `coberturaGenerica()` para essas entradas antes de concluir isso.
// Três delas (Implosão de Distorção, Cavalgada Mecânica, Ladrão de Magias)
// não têm campo dedicado mas SÃO restauradas pelo caminho genérico (ver
// comentário de cada uma); as demais `campo: null` (ex. "reinicia a cada
// turno seu") continuam sem nenhuma restauração por descanso, genérica ou
// dedicada -- essa é a leitura correta de "nunca modelado por descanso".
const CAMPOS_DESCANSO = {
  // ---- Bárbaro -- SEM guarda de subclasse (campos soltos em
  // char.recursos.<campo>, resetados dentro de `if (char.classe ===
  // 'Bárbaro')`, sem checar char.subclasse; Campeão dos Deuses é o campo
  // que originou o motor irmão -- ver hp-descanso.js:791). Nenhuma das
  // quatro aparece no bloco Curto.
  'Trilha da Árvore do Mundo|14|Percorrer a Árvore': { campo: null }, // reinicia a cada nova ativação da Fúria, não por descanso -- nenhum campo em hp-descanso.js
  'Trilha do Berserker|14|Presença Intimidante': { campo: 'presenca_intimidante_usada', semGuarda: true },
  'Trilha do Fanático|3|Campeão dos Deuses': { campo: 'campeao_deuses_gastos', semGuarda: true },
  'Trilha do Fanático|6|Concentração Fanática': { campo: null }, // reinicia ao ATIVAR a Fúria (sheet/habilidades.js) -- EXCECOES de recursos-restaurados.test.mjs
  'Trilha do Fanático|10|Presença Zelosa': { campo: 'presenca_zelosa_usada', semGuarda: true },
  'Trilha do Fanático|14|Fúria dos Deuses': { campo: 'furia_deuses_usada', semGuarda: true },

  // ---- Bardo (guarda: 'Colégio do Glamour')
  'Colégio do Glamour|3|Magia Fascinante': { campo: 'magia_fascinante_usada' },
  'Colégio do Glamour|6|Manto de Majestade': { campo: 'manto_majestade_usado' },
  'Colégio do Glamour|14|Majestade Inquebrável': { campo: 'majestade_inquebravel_usada' },

  // ---- Bruxo (guardas: 'Patrono Arquifada'/'Patrono Celestial'/'Patrono
  // O Grande Antigo'/'Patrono Ínfero'; só Grande Antigo aparece no Curto)
  'Patrono Arquifada|3|Passos Feéricos': { campo: 'passos_feericos_usos_gastos' },
  'Patrono Arquifada|10|Defesas Sedutoras': { campo: 'defesas_sedutoras_usada' },
  'Patrono Celestial|3|Luz Medicinal': { campo: 'luz_medicinal_dados_gastos' },
  'Patrono Celestial|6|Alma Radiante': { campo: null }, // reinicia a cada turno seu, não por descanso
  'Patrono Celestial|14|Vingança Calcinante': { campo: 'vinganca_calcinante_usada' },
  'Patrono O Grande Antigo|6|Combatente Clarividente': { campo: 'combatente_clarividente_usado' },
  'Patrono Ínfero|6|A Sorte do Próprio Tenebroso': { campo: 'sorte_tenebroso_usos_gastos' },
  'Patrono Ínfero|14|Lançar no Inferno': { campo: 'lancar_inferno_usado' },

  // ---- Clérigo -- Curto EXIGE guarda ('Domínio da Guerra'/'Domínio da
  // Luz'); Longo reseta os campos de subclasse SEM guarda (hp-descanso.js:
  // 848-852, incondicional para quem tiver os campos).
  'Domínio da Guerra|3|Sacerdote da Guerra': { campo: 'sacerdote_guerra_usos_gastos', semGuardaLongo: true },
  // curtoOverride: false -- ver LIMITE no cabeçalho do arquivo: o Curto de
  // Labareda Protetora só dispara com `(char.nivel||1) >= 6`
  // (hp-descanso.js:502), a mesma condição que define quando o personagem
  // já tem a Aprimorada (nível 6). Na entrada de nível 3, sozinha, o livro
  // só promete Descanso Longo -- por isso o Curto é forçado a `false` aqui,
  // em vez de deixar o mecanismo genérico (que só confere o NOME da
  // subclasse, não condições de nível dentro da guarda) contar como
  // restaurada uma via que essa entrada, no seu próprio nível, não tem.
  'Domínio da Luz|3|Labareda Protetora': { campo: 'labareda_protetora_usos_gastos', semGuardaLongo: true, curtoOverride: false },
  'Domínio da Luz|6|Labareda Protetora Aprimorada': { campo: 'labareda_protetora_usos_gastos', semGuardaLongo: true },
  'Domínio da Luz|17|Coroa de Luz': { campo: 'coroa_luz_usos_gastos', semGuardaLongo: true },

  // ---- Druida (guardas: 'Círculo da Lua'/'Círculo da Terra'/'Círculo das
  // Estrelas'; só no Longo -- Druida não tem bloco de subclasse no Curto)
  'Círculo da Lua|10|Passo Lunar': { campo: 'passo_lunar_usos_gastos' },
  'Círculo da Lua|14|Forma Lunar': { campo: null }, // reinicia a cada turno seu, não por descanso
  'Círculo da Terra|6|Recuperação Natural': { campo: 'recuperacao_natural_magia_usada' },
  'Círculo das Estrelas|3|Mapa Estelar': { campo: 'mapa_estelar_usos_gastos' },
  'Círculo das Estrelas|6|Presságio Cósmico': { campo: 'pressagio_cosmico_usos_gastos' },

  // ---- Feiticeiro -- SEM guarda de subclasse em nenhum dos dois blocos
  // (as quatro subclasses são resetadas incondicionalmente).
  'Feitiçaria Aberrante|18|Implosão de Distorção': { campo: null }, // NENHUM campo DEDICADO em site/js inteiro (grep confirmado) -- mas detectarRecarga('longo') sobre a descrição real ATIVA o caminho genérico (restaurarHabilidades), que zera pelo Descanso Longo -- ver coberturaGenerica() e FIX REPORT (GRUPO 5) no cabeçalho
  'Feitiçaria Dracônica|14|Asas de Dragão': { campo: 'asas_usada_desde_descanso', semGuarda: true },
  'Feitiçaria Dracônica|18|Companheiro Dracônico': { campo: 'companheiro_draconico_usado', semGuarda: true },
  'Feitiçaria Mecânica|3|Restaurar Equilíbrio': { campo: 'restaurar_equilibrio_usos_gastos', semGuarda: true },
  'Feitiçaria Mecânica|14|Transe da Ordem': { campo: 'transe_ordem_usado_desde_descanso', semGuarda: true },
  'Feitiçaria Mecânica|18|Cavalgada Mecânica': { campo: null }, // NENHUM campo DEDICADO em site/js inteiro (grep confirmado) -- mesmo caso de Implosão de Distorção acima: detectarRecarga('longo') ativa o caminho genérico, coberto no Longo
  'Feitiçaria Selvagem|3|Marés do Caos': { campo: 'mares_caos_disponivel', semGuarda: true },
  'Feitiçaria Selvagem|3|Surto de Magia Selvagem': { campo: null }, // reinicia a cada turno seu; 'surto_pendente_automatico' é outro mecanismo (fila de surto pendente), não o limite desta característica
  'Feitiçaria Selvagem|18|Surto Controlado': { campo: 'surto_controlado_usado', semGuarda: true },

  // ---- Guardião (guardas: 'Andarilho Feérico'/'Vigilante das Sombras';
  // só no Longo)
  'Andarilho Feérico|3|Golpes Terríveis': { campo: null }, // reinicia a cada turno seu, não por descanso
  'Andarilho Feérico|11|Reforços Feéricos': { campo: 'reforcos_feericos_usado' },
  'Andarilho Feérico|15|Andarilho Nebuloso': { campo: 'andarilho_nebuloso_usos_gastos' },
  'Caçador|3|Presa do Caçador': { campo: null }, // o Descanso citado no livro é RESET DE ESCOLHA entre as duas opções (ver `livro` da entrada), não recarga do limite "uma vez por turno"
  'Caçador|11|Presa do Caçador Superior': { campo: null }, // reinicia a cada turno seu, não por descanso
  'Vigilante das Sombras|3|Emboscador das Sombras': { campo: 'golpe_terrivel_usos_gastos' },

  // ---- Guerreiro (guardas: 'Mestre da Batalha'/'Combatente Psíquico',
  // nos dois blocos; Cavaleiro Místico usa o reset GENÉRICO de
  // `char.espacos_magia`, comum a todo conjurador, sem guarda de
  // subclasse -- por isso não precisa de uma)
  'Cavaleiro Místico|3|Conjuração': { campo: 'espacos_magia', semGuarda: true },
  'Combatente Psíquico|3|Poder Psiônico': { campo: 'dados_psionicos_gastos' },
  'Combatente Psíquico|7|Adepto Telecinético': { campo: 'salto_impulsao_usado' },
  'Combatente Psíquico|15|Baluarte de Energia': { campo: 'baluarte_usado' },
  'Combatente Psíquico|18|Mestre Telecinético': { campo: 'mestre_telecinetico_usado' },
  'Mestre da Batalha|3|Superioridade em Combate': { campo: 'dados_superioridade_gastos' },
  'Mestre da Batalha|7|Conheça Seu Inimigo': { campo: 'conheca_inimigo_usado' },
  'Mestre da Batalha|15|Implacável': { campo: null }, // reinicia a cada turno seu, não por descanso

  // ---- Ladino (guarda: 'Adaga Espiritual'; Trapaceiro Arcano usa o
  // mesmo reset genérico de espacos_magia do Cavaleiro Místico)
  'Adaga Espiritual|3|Poder Psiônico': { campo: 'dados_psionicos_gastos' },
  'Adaga Espiritual|13|Véu Psíquico': { campo: 'veu_psiquico_usado' },
  'Adaga Espiritual|17|Rasgar Mente': { campo: 'rasgar_mente_usado' },
  'Trapaceiro Arcano|3|Conjuração': { campo: 'espacos_magia', semGuarda: true },
  'Trapaceiro Arcano|17|Ladrão de Magias': { campo: null }, // NENHUM campo DEDICADO em site/js inteiro (grep confirmado) -- CRITICAL 1 do FIX REPORT (GRUPO 5): detectarRecarga('longo') sobre a descrição real de dados/classes/ladino.json ATIVA o caminho genérico (renderFeatureItem emite o toggle "subclasse_Ladrão de Magias", habilidades.js:4750-4756; restaurarHabilidades zera no Longo) -- red #1 da rodada anterior era acusação FALSA

  // ---- Mago (guardas: 'Abjurador'/'Adivinhador'/'Evocador'/'Ilusionista';
  // só Adivinhador e Ilusionista aparecem no Curto)
  'Abjurador|3|Proteção Arcana': { campo: 'protecao_criada' },
  'Adivinhador|3|Prodígio': { campo: 'prodigio_dado_1_usado' },
  'Adivinhador|10|O Terceiro Olho': { campo: 'terceiro_olho_usado' },
  'Adivinhador|14|Prodígio Maior': { campo: 'prodigio_dado_1_usado' }, // compartilha a reserva de Prodígio (nível 3)
  'Evocador|14|Sobrecarga': { campo: 'sobrecarga_usos' },
  'Ilusionista|6|Criaturas Espectrais': { campo: 'feerica_usada' },
  'Ilusionista|10|Autoimagem Ilusória': { campo: 'autoimagem_usada' },

  // ---- Monge (guardas: 'Combatente da Mão Espalmada'/'Combatente da
  // Misericórdia'/'Combatente dos Elementos'; só Elementos aparece no
  // Curto)
  'Combatente da Mão Espalmada|6|Integridade Corporal': { campo: 'integridade_usos_gastos' },
  'Combatente da Misericórdia|3|Mão de Dolo': { campo: null }, // reinicia a cada turno seu (o gasto de 1 Ponto de Foco é o recurso da classe base)
  'Combatente da Misericórdia|11|Torrente de Cura e Dolo': { campo: 'torrente_usos_gastos' },
  'Combatente da Misericórdia|17|Mão da Misericórdia Final': { campo: 'misericordia_final_usada' },
  'Combatente dos Elementos|17|Ápice Elemental': { campo: null }, // reinicia a cada turno seu, não por descanso

  // ---- Paladino -- ACHADO CRITICAL desta tarefa, ver cabeçalho do
  // arquivo: hp-descanso.js grava 'Juramento de Devoção'/'Juramento de
  // Glória'/'Juramento de Vingança' (preposição errada); só 'Juramento
  // dos Anciões' está certo. A busca abaixo usa sempre o nome EXATO do
  // catálogo (que é o nome real, conferido contra dados/classes/
  // paladino.json e três outros arquivos de site/js) -- a guarda quebrada
  // nunca "casa", e a divergência aparece legitimamente.
  'Juramento da Devoção|20|Resplendor Sagrado': { campo: 'resplendor_sagrado_usado' },
  'Juramento da Glória|15|Defesa Gloriosa': { campo: 'defesa_gloriosa_usos_gastos' },
  'Juramento da Glória|20|Lenda Viva': { campo: 'lenda_viva_usada' },
  'Juramento da Vingança|20|Anjo Vingador': { campo: 'anjo_vingador_usado' },
  'Juramento dos Anciões|15|Sentinela Imortal': { campo: 'sentinela_imortal_usada' },
  'Juramento dos Anciões|20|Campeão Ancestral': { campo: 'campeao_ancestral_usado' },
};

test('sanity: CAMPOS_DESCANSO cobre exatamente as 72 entradas de RECURSOS_SUBCLASSE, sem sobra nem falta (typo de acentuação apareceria aqui)', () => {
  const chaves = TODAS_ENTRADAS_RECURSO.map((e) => `${e.subclasse}|${e.nivel}|${e.caracteristica}`);
  const faltando = chaves.filter((c) => !(c in CAMPOS_DESCANSO));
  const sobrando = Object.keys(CAMPOS_DESCANSO).filter((c) => !chaves.includes(c));
  assert.deepEqual(faltando, [],
    `entrada(s) de RECURSOS_SUBCLASSE sem mapeamento em CAMPOS_DESCANSO: ${faltando.join('; ')}`);
  assert.deepEqual(sobrando, [],
    `chave(s) em CAMPOS_DESCANSO sem entrada correspondente em RECURSOS_SUBCLASSE (typo de acentuação?): ${sobrando.join('; ')}`);
});

// Tradução do vocabulário do catálogo para o vocabulário do app -- mesma
// tabela do Grupo 3 (RECARGA_CATALOGO_PARA_APP), reaproveitada aqui.
//
// Para 'outro' -- mesmo critério do Grupo 3 (CRITICAL 1 do fix report):
// 'outro' documenta que o gatilho PRINCIPAL não é um Descanso, não que
// nenhum Descanso participa. `recargaTambemPor` (só Marés do Caos) é usado
// quando presente. Das outras 13 entradas 'outro', a leitura de `livro`
// (feita à mão, citada abaixo) encontrou só DUAS com uma via de Descanso
// genuína e PRINCIPAL para o MESMO recurso (não incidental, não reset de
// escolha): "Poder Psiônico" de Combatente Psíquico (Guerreiro) e de Adaga
// Espiritual (Ladino), ambas "Você recupera um... ao completar um Descanso
// Curto, e restaura todos ao completar um Descanso Longo." (Classes.md:4019
// e 4345) -- por isso o valor aqui já é `curto_ou_longo` (vocabulário do
// app), não passa pela tradução de `RECARGA_CATALOGO_PARA_APP` (que só
// aceita os três valores do catálogo, sem essa forma composta). As outras
// 11 (Percorrer a Árvore, Concentração Fanática, Alma Radiante, Forma
// Lunar, Surto de Magia Selvagem, Golpes Terríveis, Presa do Caçador
// Superior, Implacável, Mão de Dolo, Ápice Elemental) citam só "reinicia a
// cada turno seu"/"a cada Fúria ativa", sem Descanso algum -- `null` é o
// valor certo. A ÚNICA exceção textual é Presa do Caçador (Caçador nível
// 3): seu `livro` CITA "Descanso Curto ou Longo", mas como RESET DE
// ESCOLHA entre Assassino de Colossos/Destruidor de Hordas -- o próprio
// catálogo já documenta essa leitura (ver comentário "CHAMADA JULGADA" no
// cabeçalho de RECURSOS_SUBCLASSE) -- não uma recarga do limite "uma vez
// por turno"; por isso continua `null`, não entra no mapa abaixo. Este
// mapa NÃO foi adicionado ao catálogo (catalogo/subclasses.mjs) porque as
// duas entradas que o usam são `composta: true` -- não sustentam
// `assert.equal` sozinhas, só o `t.skip` registra a leitura; mudar o
// catálogo mudaria também o Grupo 3 (recargaEsperada), fora do escopo
// desta tarefa.
const OUTRO_DESCANSO_TAMBEM_CURADO = {
  'Combatente Psíquico|3|Poder Psiônico': 'curto_ou_longo',
  'Adaga Espiritual|3|Poder Psiônico': 'curto_ou_longo',
};

function esperadoRestauracao(e) {
  if (e.recarga !== 'outro') return RECARGA_CATALOGO_PARA_APP[e.recarga];
  if (e.recargaTambemPor) return RECARGA_CATALOGO_PARA_APP[e.recargaTambemPor];
  return OUTRO_DESCANSO_TAMBEM_CURADO[`${e.subclasse}|${e.nivel}|${e.caracteristica}`] ?? null;
}

function observadoRestauracao(apareceCurto, apareceLongo) {
  if (apareceCurto && apareceLongo) return 'curto_ou_longo';
  if (apareceCurto) return 'curto';
  if (apareceLongo) return 'longo';
  return null;
}

// Sanity do FIX REPORT (GRUPO 5), CRITICAL 3 -- `ramoDedicado` (catálogo,
// Grupo 2) só faz sentido quando existe um campo PRÓPRIO fora de
// `char.usos_habilidades` (ver Defesa Gloriosa, habilidades.js:4282-4294,
// campo `char.recursos.paladino.subclasses.gloria.defesa_gloriosa_usos_gastos`)
// -- por isso `campo: null` (nenhum campo dedicado, condição que abre o
// caminho genérico no loop abaixo) e `ramoDedicado` curado nunca deveriam
// coexistir para a mesma entrada. Este teste protege essa suposição em vez
// de deixá-la implícita no `if` do loop principal.
test('sanity: nenhuma entrada de CAMPOS_DESCANSO com campo:null tem `ramoDedicado` curado no catálogo (ramo dedicado sempre implica campo próprio, fora do caminho genérico)', () => {
  const conflitos = TODAS_ENTRADAS_RECURSO
    .filter((e) => {
      const tabela = CAMPOS_DESCANSO[`${e.subclasse}|${e.nivel}|${e.caracteristica}`];
      return tabela && !tabela.campo && e.ramoDedicado;
    })
    .map((e) => `${e.subclasse}|${e.nivel}|${e.caracteristica}`);
  assert.deepEqual(conflitos, [],
    `entrada(s) com campo:null MAS ramoDedicado curado -- o loop principal trata isso como "caminho genérico nunca alcançado" (mesma razão do Paladino/red #2); confira se é intencional: ${conflitos.join('; ')}`);
});

// TASK 6 (lacunas-conhecidas.mjs) -- Defesa Gloriosa (Juramento da Glória
// nv15) é causa NOVA e é o achado desta rodada: hp-descanso.js:974 guarda a
// restauração de Descanso Longo com `char.subclasse === 'Juramento DE
// Glória'`, mas o nome real (dados/classes/paladino.json:473 e todo o resto
// do app) é 'Juramento DA Glória' -- `char.subclasse` nunca bate com a
// guarda quebrada, o `if` é código morto, `defesa_gloriosa_usos_gastos`
// nunca zera. Mesmo typo em mais 3 guardas (:582 Devoção/Curto, :979
// Vingança/Longo, :988 Devoção/Longo) -- só Defesa Gloriosa é citável
// (`base: 'custo-declarado'`, não `composta`); as outras 3 (Resplendor
// Sagrado, Lenda Viva, Anjo Vingador) divergem só no `t.skip` (registradas
// lá, sem chave própria -- mesma regra de citabilidade dos Grupos 2-3).
const CAUSA_RESTAURACAO = {
  'Juramento da Glória|15|Defesa Gloriosa': { talento: 'Juramento da Glória', teste: 'subclasses-recursos-paladino-guarda-juramento' },
};

for (const entrada of TODAS_ENTRADAS_RECURSO) {
  const { subclasse, nivel, caracteristica } = entrada;
  test(`restauração no descanso: ${subclasse} nível ${nivel} "${caracteristica}" (${entrada.base}${entrada.composta ? ', composta' : ''})`, async (t) => {
    const chave = `${subclasse}|${nivel}|${caracteristica}`;
    const tabela = CAMPOS_DESCANSO[chave];
    assert.ok(tabela,
      `${chave}: sem entrada em CAMPOS_DESCANSO -- toda entrada de RECURSOS_SUBCLASSE com recarga não-nula precisa de um mapeamento (mesmo que campo:null, quando não existe campo dedicado para este recurso)`);

    const esperado = esperadoRestauracao(entrada);

    let apareceCurto, apareceLongo, avisoCaminho = '';
    if (tabela.campo) {
      // Campo dedicado -- busca textual escopada por guarda (inalterado).
      apareceCurto = tabela.curtoOverride === false
        ? false
        : apareceRestauracao(BLOCO_CURTO, subclasse, tabela, tabela.semGuardaCurto);
      apareceLongo = apareceRestauracao(BLOCO_LONGO, subclasse, tabela, tabela.semGuardaLongo);
    } else if (entrada.ramoDedicado) {
      // Não deveria acontecer (sanity acima), mas se acontecer: um ramo
      // dedicado em renderFeatureItem sobrescreve usosHtmlBody e lê um
      // campo PRÓPRIO fora de char.usos_habilidades -- o caminho genérico
      // (que só zera char.usos_habilidades[key]) nunca é alcançado, mesma
      // razão pela qual os campos do Paladino (red #2, campo dedicado com
      // guarda quebrada) não são resgatados por ele.
      apareceCurto = false;
      apareceLongo = false;
      avisoCaminho = ' AVISO: ramoDedicado curado apesar de campo:null -- caminho genérico tratado como inalcançável, ver sanity acima.';
    } else {
      // CRITICAL 1/2 do FIX REPORT (GRUPO 5) -- sem campo dedicado E sem
      // ramo dedicado, a única restauração possível é o caminho GENÉRICO
      // de restaurarHabilidades, avaliado sobre o texto REAL da
      // característica em dados/classes/*.json (nunca sobre um esperado
      // inventado -- `esperado`, acima, já foi calculado só do catálogo).
      const feature = acharCaracteristica(subclasse, nivel, caracteristica);
      assert.ok(feature,
        `${chave}: sem característica correspondente em dados/classes/*.json`);
      const cobertura = coberturaGenerica(feature.descricao);
      apareceCurto = cobertura.curto;
      apareceLongo = cobertura.longo;
      avisoCaminho = ` (sem campo dedicado -- caminho genérico de restaurarHabilidades, detectarRecarga="${cobertura.r}")`;
    }
    const observado = observadoRestauracao(apareceCurto, apareceLongo);

    if (!ehCitavel(entrada)) {
      const bateu = observado === esperado;
      const razao = entrada.base === 'julgamento' ? 'julgamento' : 'composta';
      t.skip(`${razao} (não é lacuna): catálogo recarga=${JSON.stringify(entrada.recarga)}` +
        `${entrada.recargaTambemPor ? ` (recargaTambemPor: ${entrada.recargaTambemPor})` : ''} ` +
        `(esperado do app: ${JSON.stringify(esperado)}), observado: ${JSON.stringify(observado)} ` +
        `(${bateu ? 'coincidem' : 'divergem'}) -- ${entrada.livro}${avisoCaminho}`);
      return;
    }
    const rodarAsserção = () => assert.equal(observado, esperado,
      `${subclasse} nível ${nivel} "${caracteristica}" [${entrada.base}] -- livro (${entrada.livro}). ` +
      `Catálogo: recarga=${JSON.stringify(entrada.recarga)}${entrada.recargaTambemPor ? ` (recargaTambemPor: ${entrada.recargaTambemPor})` : ''} ` +
      `(esperado do app: ${JSON.stringify(esperado)}). Observado: ${JSON.stringify(observado)}.${avisoCaminho}`);
    const causa = CAUSA_RESTAURACAO[chave];
    if (causa) {
      await comLacuna(causa.talento, causa.teste, rodarAsserção);
    } else {
      rodarAsserção();
    }
  });
}

// ============================================================
// Auxiliares dos Grupos 6/7 (Task 5 deste plano) -- fonte independente do
// livro para o modificador de atributo e o Bônus de Proficiência. NUNCA
// utils.calcMod/utils.bonusProficiencia aqui -- calcCA e calcBonusPericia
// (as duas funções SOB TESTE) chamam essas duas por dentro; usá-las também
// no lado esperado compararia o app com ele mesmo, exatamente o erro que a
// revisão do domínio transversal encontrou e corrigiu (ver cabeçalho de
// ficha-transversal.test.mjs e de classes-passivas.test.mjs, achado I5).
// Mesmo par de funções (nomes e forma) de classes-passivas.test.mjs:57-66,
// repetido aqui porque os dois arquivos de teste não compartilham módulo.
// ============================================================
function modAtributoIndependente(valor) {
  const entrada = MODIFICADORES_ATRIBUTO.find((m) => m.valor === valor);
  assert.ok(entrada, `sanity: MODIFICADORES_ATRIBUTO não cobre o valor de atributo ${valor}`);
  return entrada.modificador;
}
function bonusProficienciaIndependente(nivel) {
  const entrada = EVOLUCAO_PERSONAGEM.find((e) => e.nivel === nivel);
  assert.ok(entrada, `sanity: EVOLUCAO_PERSONAGEM não cobre o nível ${nivel}`);
  return entrada.bonusProficiencia;
}

// ============================================================
// GRUPO 6 (Task 5 deste plano) -- calcCA (site/js/utils.js:144-241), os
// dois ramos "Defesa sem Armadura"/"Resiliência Dracônica" herdados de
// SUBCLASSE: Bardo/Colégio da Dança (utils.js:165-167) e Feiticeiro/
// Feitiçaria Dracônica (utils.js:169-177). Estes dois ramos, junto com o
// bônus de perícia do Grupo 7 abaixo, foram DECLARADOS PENDENTES por duas
// rodadas anteriores deste domínio: ficha-transversal.test.mjs:281-291
// varre só Guerreiro, de propósito, "para nenhum dos quatro ramos de CA de
// classe poder interferir" e escreve por extenso que os quatro (Bárbaro,
// Monge, e os dois daqui) "ficam para o domínio de classes/níveis" -- um
// domínio que nunca foi escrito. Este grupo fecha a fronteira só para os
// DOIS ramos de subclasse (Bárbaro e Monge são de CLASSE BASE, fora do
// escopo desta tarefa, "Subclasses -- 4 Recursos").
//
// LIVRO -- as duas fórmulas, lidas em Classes.md ANTES de escrever
// qualquer expectativa (regra do brief desta tarefa):
//   Bardo, Colégio da Dança, Nível 3 "Ginga Fascinante" (Classes.md:724-
//   732): "Enquanto você não estiver vestindo armadura ou empunhando um
//   Escudo, adquire os seguintes benefícios [...] Defesa sem Armadura.
//   Sua Classe de Armadura base é igual a 10 mais seus modificadores de
//   Destreza e Carisma." -- SEM armadura E SEM Escudo, a partir do nível 3
//   (o nível do próprio cabeçalho).
//   Feiticeiro, Feitiçaria Dracônica, Nível 3 "Resiliência Dracônica"
//   (Classes.md:3072-3076): "[...] Partes da sua pele são cobertas por
//   finas escamas reluzentes [...] Enquanto não estiver vestindo
//   armadura, sua Classe de Armadura base é igual a 10 mais seus
//   modificadores de Destreza e Carisma." -- SEM armadura; o livro NÃO
//   cita Escudo aqui, diferente do Bardo acima -- confirmado abaixo (teste
//   de Escudo) que o app trata essa diferença de propósito: utils.js:166
//   tem `&& !escudo`, utils.js:173-176 não tem.
// As duas concedem a partir do nível 3 e continuam valendo em todo nível
// acima -- nenhuma das duas tem um segundo patamar que muda a fórmula
// (diferente de Domínio da Luz|Labareda Protetora no Grupo 5, que tem).
//
// O modificador esperado vem de modAtributoIndependente (acima), NUNCA de
// utils.calcMod.
// ============================================================
const CA_SEM_ARMADURA_SUBCLASSES = [
  {
    classe: 'Bardo', subclasse: 'Colégio da Dança', outraSubclasse: 'Colégio do Glamour',
    livro: 'Classes.md:724-732 (Nível 3: Ginga Fascinante -- Defesa sem Armadura)',
  },
  {
    classe: 'Feiticeiro', subclasse: 'Feitiçaria Dracônica', outraSubclasse: 'Feitiçaria Selvagem',
    livro: 'Classes.md:3072-3076 (Nível 3: Resiliência Dracônica)',
  },
];

// Varredura POSITIVA -- Destreza 1-30 × Carisma 1-30 × nível 1-20 (18.000
// combinações por subclasse), sem armadura nem escudo no inventário: a
// partir do nível 3, 10 + mod. Destreza + mod. Carisma; antes disso, a CA
// comum sem armadura (10 + mod. Destreza), porque nenhum outro ramo de
// calcCA (Bárbaro/Monge exigem outra classe; armadura/escudo estão
// ausentes aqui) poderia interferir.
for (const cfg of CA_SEM_ARMADURA_SUBCLASSES) {
  test(`calcCA: ${cfg.classe}/${cfg.subclasse} sem armadura -- 10 + mod. Destreza + mod. Carisma a partir do nível 3, CA comum antes disso (Destreza 1-30 × Carisma 1-30 × nível 1-20 = 18.000 combinações)`, () => {
    for (let nivel = 1; nivel <= 20; nivel++) {
      for (let destreza = 1; destreza <= 30; destreza++) {
        const modDes = modAtributoIndependente(destreza);
        for (let carisma = 1; carisma <= 30; carisma++) {
          const modCar = modAtributoIndependente(carisma);
          const p = store.criarPersonagemVazio();
          p.classe = cfg.classe;
          p.subclasse = cfg.subclasse;
          p.nivel = nivel;
          p.inventario = [];
          p.atributos.destreza = destreza;
          p.atributos.carisma = carisma;
          const esperado = nivel >= 3 ? 10 + modDes + modCar : 10 + modDes;
          assert.equal(utils.calcCA(p), esperado,
            `${cfg.classe}/${cfg.subclasse} nível ${nivel}, Destreza ${destreza}, Carisma ${carisma} ` +
            `(${cfg.livro}): esperado ${esperado}`);
        }
      }
    }
  });
}

// Negativa 1 -- OUTRA subclasse da MESMA classe (Colégio do Glamour para
// Bardo, Feitiçaria Selvagem para Feiticeiro, nenhuma das duas com um ramo
// de CA no livro) NÃO deveria acionar 10+Des+Car em nenhum ponto do mesmo
// domínio -- mesma varredura de 18.000 combinações, agora conferindo a CA
// comum (10+Des) em todo o domínio.
for (const cfg of CA_SEM_ARMADURA_SUBCLASSES) {
  test(`calcCA: ${cfg.classe}/${cfg.outraSubclasse} (outra subclasse, mesma classe) NÃO aciona o ramo -- CA comum sem armadura em todo o domínio (Destreza 1-30 × Carisma 1-30 × nível 1-20 = 18.000 combinações)`, () => {
    for (let nivel = 1; nivel <= 20; nivel++) {
      for (let destreza = 1; destreza <= 30; destreza++) {
        const modDes = modAtributoIndependente(destreza);
        for (let carisma = 1; carisma <= 30; carisma++) {
          const p = store.criarPersonagemVazio();
          p.classe = cfg.classe;
          p.subclasse = cfg.outraSubclasse;
          p.nivel = nivel;
          p.inventario = [];
          p.atributos.destreza = destreza;
          p.atributos.carisma = carisma;
          assert.equal(utils.calcCA(p), 10 + modDes,
            `${cfg.classe}/${cfg.outraSubclasse} nível ${nivel}, Destreza ${destreza}, Carisma ${carisma}: ` +
            `subclasse errada não deveria ativar 10+Des+Car, esperado CA comum ${10 + modDes}`);
        }
      }
    }
  });
}

// Negativa 2 -- armadura EQUIPADA desativa os dois ramos (os dois exigem
// `!armadura`) -- a CA passa a vir da fórmula de armadura (utils.js:183-
// 204), não de 10+Des+Car, mesmo com nível ≥ 3 e a subclasse certa.
// Varredura de Destreza 1-30 × Carisma 1-30 (900 combinações por
// subclasse) num nível fixo acima do patamar (10), com uma armadura Leve
// equipada (fórmula sem teto: CA base + mod. Destreza, utils.js:183-184).
for (const cfg of CA_SEM_ARMADURA_SUBCLASSES) {
  test(`calcCA: ${cfg.classe}/${cfg.subclasse} com armadura Leve equipada NÃO aciona o ramo -- usa a fórmula de armadura (Destreza 1-30 × Carisma 1-30, nível 10 = 900 combinações)`, () => {
    for (let destreza = 1; destreza <= 30; destreza++) {
      const modDes = modAtributoIndependente(destreza);
      for (let carisma = 1; carisma <= 30; carisma++) {
        const p = store.criarPersonagemVazio();
        p.classe = cfg.classe;
        p.subclasse = cfg.subclasse;
        p.nivel = 10;
        p.atributos.destreza = destreza;
        p.atributos.carisma = carisma;
        p.inventario = [{ equipado: true, tipo: 'armadura', nome: 'Colete de Couro', dados: { categoria: 'Leve', ca: '11' } }];
        const esperado = 11 + modDes; // fórmula de armadura Leve: CA base (11) + mod. Destreza, sem teto
        assert.equal(utils.calcCA(p), esperado,
          `${cfg.classe}/${cfg.subclasse} nível 10 com armadura Leve equipada, Destreza ${destreza}, ` +
          `Carisma ${carisma}: esperado ${esperado} (fórmula de armadura, não 10+Des+Car)`);
      }
    }
  });
}

// Negativa 3 -- Escudo: o LIVRO trata os dois ramos de forma DIFERENTE
// (ver citação acima) -- Bardo/Colégio da Dança exige "não estiver [...]
// empunhando um Escudo" (Classes.md:726), Feiticeiro/Feitiçaria Dracônica
// não menciona Escudo (Classes.md:3076). Não é uma varredura exaustiva
// (a fórmula de CA não depende de Escudo de nenhum jeito não-linear que
// justifique 30×30 pontos) -- quatro valores de Destreza/Carisma bastam
// para confirmar a distinção nos dois sentidos, sem inventar combinações
// que o livro não distingue.
test('calcCA: Escudo desativa o ramo de Bardo/Colégio da Dança (livro cita "ou empunhando um Escudo", Classes.md:726) mas NÃO desativa o de Feiticeiro/Feitiçaria Dracônica (livro não menciona Escudo, Classes.md:3076) -- Escudo sempre soma +2 à parte (utils.js:207-209)', () => {
  for (const destreza of [1, 10, 20, 30]) {
    const modDes = modAtributoIndependente(destreza);
    for (const carisma of [1, 10, 20, 30]) {
      const modCar = modAtributoIndependente(carisma);

      const bardo = store.criarPersonagemVazio();
      bardo.classe = 'Bardo';
      bardo.subclasse = 'Colégio da Dança';
      bardo.nivel = 10;
      bardo.atributos.destreza = destreza;
      bardo.atributos.carisma = carisma;
      bardo.inventario = [{ equipado: true, nome: 'Escudo', tipo: 'escudo' }];
      assert.equal(utils.calcCA(bardo), 10 + modDes + 2,
        `Bardo/Colégio da Dança com Escudo, Destreza ${destreza}, Carisma ${carisma}: Escudo deveria ` +
        `desativar 10+Des+Car (Classes.md:726), esperado ${10 + modDes + 2}`);

      const feiticeiro = store.criarPersonagemVazio();
      feiticeiro.classe = 'Feiticeiro';
      feiticeiro.subclasse = 'Feitiçaria Dracônica';
      feiticeiro.nivel = 10;
      feiticeiro.atributos.destreza = destreza;
      feiticeiro.atributos.carisma = carisma;
      feiticeiro.inventario = [{ equipado: true, nome: 'Escudo', tipo: 'escudo' }];
      assert.equal(utils.calcCA(feiticeiro), 10 + modDes + modCar + 2,
        `Feiticeiro/Feitiçaria Dracônica com Escudo, Destreza ${destreza}, Carisma ${carisma}: Escudo NÃO ` +
        `deveria desativar 10+Des+Car (Classes.md:3076 não cita Escudo), esperado ${10 + modDes + modCar + 2}`);
    }
  }
});

// ============================================================
// GRUPO 7 (Task 5 deste plano) -- calcBonusPericia (site/js/utils.js:293-
// 342), o ramo do Clérigo com Ordem Divina "Taumaturgo" (utils.js:314-
// 321): bônus em Arcanismo e Religião.
//
// ACHADO, antes de escrever qualquer teste novo (auditoria do brief pedida
// pela regra "Antes de Reportar" -- ver relatório): calcBonusPericia NÃO
// está inteiramente sem teste, ao contrário do que o brief desta tarefa
// afirma ("Esta função nunca recebeu teste"). classes-passivas.test.mjs:
// 610-635 já varre Sabedoria 1-30 para o ramo Taumaturgo (e para o ramo
// irmão Xamã de Druida) nas perícias certas, já usa a mesma fonte
// independente (MODIFICADORES_ATRIBUTO, não calcMod) e já confere que uma
// perícia fora da lista (História) não ganha o bônus. O que aquele teste
// NÃO varre -- e que este Grupo 7 acrescenta, sem duplicar o que já existe
// -- são os dois eixos que faltam: os ESTADOS DE PROFICIÊNCIA da própria
// perícia (aquele teste fixa pericias_proficientes/pericias_expertise
// vazios sempre) e o NÍVEL (aquele teste fixa nível=4 sempre, e o Bônus de
// Proficiência muda com o nível e soma-se ao mesmo total que a ficha
// mostra). Este grupo também acrescenta as duas negativas que o brief
// desta tarefa pede e que não existiam em lugar nenhum: outra Ordem Divina
// (Protetor) e outra classe.
//
// LIVRO (Classes.md:1562-1568, "Nível 1: Ordem Divina"): "Você se dedicou
// a um dos seguintes papéis sagrados à sua escolha. Protetor. [...] adquire
// proficiência com armas Marciais e treinamento com Armadura Pesada.
// Taumaturgo. Você conhece um truque adicional da lista de magias de
// Clérigo. Além disso, sua conexão mística com o divino lhe dá um bônus em
// seus testes de Inteligência (Arcanismo ou Religião). O bônus é igual ao
// seu modificador de Sabedoria (mínimo de +1)." -- confirma a fórmula do
// app (utils.js:320: `Math.max(1, calcMod(sabedoria))`) e as duas perícias
// certas. SEM exigência de nível (a Ordem Divina é escolhida no nível 1 e
// vale desde então) -- bate com o app, que não tem checagem de nível neste
// ramo (diferente dos dois ramos de CA do Grupo 6, que exigem nível ≥ 3).
// "Protetor" (a outra Ordem Divina do livro, mesma seção) é usada abaixo
// como a negativa "outra ordem".
//
// Estados de proficiência: os TRÊS estados REAIS (mesma convenção da casa,
// ficha-transversal.test.mjs "Percepção Passiva bate com..." -- sem
// proficiência, com proficiência, com proficiência e Especialização; um
// quarto estado "Especialização sem proficiência" nunca ocorre num
// personagem que o app produz -- o livro, Abreviações e Definição de
// Regras.md:530, exige proficiência prévia para adquirir Especialização --
// mesma nota lá).
//
// Inteligência (o atributo da PRÓPRIA perícia Arcanismo/Religião,
// dados-classes.js:169/183) fica FIXA em 10 (mod. 0) em toda a varredura
// abaixo -- a fórmula genérica "mod. de atributo + Bônus de Proficiência"
// de uma perícia qualquer é comportamento TRANSVERSAL, fora do ramo
// declarado pendente por esta tarefa ("Subclasses -- 4 Recursos"); mantê-la
// fixa em 0 isola o termo que É o ramo sob teste (o bônus adicional de
// Sabedoria) sem deixar de somar o total real que a ficha mostra.
// ============================================================
const ESTADOS_PROFICIENCIA_PERICIA = [
  { prof: false, exp: false, rotulo: 'sem proficiência' },
  { prof: true, exp: false, rotulo: 'com proficiência' },
  { prof: true, exp: true, rotulo: 'com proficiência e Especialização' },
];

// Varredura POSITIVA -- Sabedoria 1-30 × nível 1-20 × 3 estados de
// proficiência (1.800 combinações por perícia, 3.600 no total das duas):
// o total devolvido bate com mod. Inteligência (fixo, 0) + Bônus de
// Proficiência (conforme o estado) + mod. Sabedoria com piso de +1.
for (const pericia of ['Arcanismo', 'Religião']) {
  test(`calcBonusPericia: Clérigo "Ordem Divina: Taumaturgo" em ${pericia} -- mod. Inteligência (0, fixo) + Bônus de Proficiência (conforme estado) + mod. Sabedoria (mín. +1) -- Sabedoria 1-30 × nível 1-20 × 3 estados de proficiência = 1.800 combinações`, () => {
    for (let nivel = 1; nivel <= 20; nivel++) {
      const bp = bonusProficienciaIndependente(nivel);
      for (let sabedoria = 1; sabedoria <= 30; sabedoria++) {
        const bonusTaumaturgo = Math.max(1, modAtributoIndependente(sabedoria));
        for (const { prof, exp, rotulo } of ESTADOS_PROFICIENCIA_PERICIA) {
          const p = store.criarPersonagemVazio();
          p.classe = 'Clérigo';
          p.ordem_divina = 'Taumaturgo';
          p.nivel = nivel;
          p.atributos.inteligencia = 10;
          p.atributos.sabedoria = sabedoria;
          p.pericias_proficientes = prof ? [pericia] : [];
          p.pericias_expertise = exp ? [pericia] : [];
          const esperado = (prof ? bp : 0) + (exp ? bp : 0) + bonusTaumaturgo;
          assert.equal(utils.calcBonusPericia(p, pericia), esperado,
            `Clérigo Taumaturgo, ${pericia}, Sabedoria ${sabedoria}, nível ${nivel}, ${rotulo} ` +
            `(Classes.md:1568): esperado ${esperado}`);
        }
      }
    }
  });
}

// Negativa 1 -- outra Ordem Divina (Protetor, Classes.md:1566) NÃO recebe
// o bônus de Taumaturgo em Arcanismo/Religião -- mesma varredura de 1.800
// combinações por perícia, agora sem o termo de Sabedoria no esperado.
for (const pericia of ['Arcanismo', 'Religião']) {
  test(`calcBonusPericia: Clérigo "Protetor" (outra Ordem Divina) NÃO recebe o bônus de Taumaturgo em ${pericia} -- 1.800 combinações`, () => {
    for (let nivel = 1; nivel <= 20; nivel++) {
      const bp = bonusProficienciaIndependente(nivel);
      for (let sabedoria = 1; sabedoria <= 30; sabedoria++) {
        for (const { prof, exp, rotulo } of ESTADOS_PROFICIENCIA_PERICIA) {
          const p = store.criarPersonagemVazio();
          p.classe = 'Clérigo';
          p.ordem_divina = 'Protetor';
          p.nivel = nivel;
          p.atributos.inteligencia = 10;
          p.atributos.sabedoria = sabedoria;
          p.pericias_proficientes = prof ? [pericia] : [];
          p.pericias_expertise = exp ? [pericia] : [];
          const esperado = (prof ? bp : 0) + (exp ? bp : 0); // sem o termo de Taumaturgo
          assert.equal(utils.calcBonusPericia(p, pericia), esperado,
            `Clérigo Protetor, ${pericia}, Sabedoria ${sabedoria}, nível ${nivel}, ${rotulo}: outra ordem não ` +
            `deveria somar o bônus de Taumaturgo, esperado ${esperado}`);
        }
      }
    }
  });
}

// Negativa 2 -- outra perícia (Furtividade, atributo Destreza, fora da
// lista do livro) para um Clérigo Taumaturgo de verdade NÃO recebe o
// bônus -- 1.800 combinações.
test('calcBonusPericia: Clérigo "Taumaturgo" NÃO recebe o bônus em Furtividade (perícia fora da lista do livro, Classes.md:1568 só cita Arcanismo/Religião) -- 1.800 combinações', () => {
  for (let nivel = 1; nivel <= 20; nivel++) {
    const bp = bonusProficienciaIndependente(nivel);
    for (let sabedoria = 1; sabedoria <= 30; sabedoria++) {
      for (const { prof, exp, rotulo } of ESTADOS_PROFICIENCIA_PERICIA) {
        const p = store.criarPersonagemVazio();
        p.classe = 'Clérigo';
        p.ordem_divina = 'Taumaturgo';
        p.nivel = nivel;
        p.atributos.destreza = 10; // Furtividade usa Destreza (dados-classes.js:173)
        p.atributos.sabedoria = sabedoria;
        p.pericias_proficientes = prof ? ['Furtividade'] : [];
        p.pericias_expertise = exp ? ['Furtividade'] : [];
        const esperado = (prof ? bp : 0) + (exp ? bp : 0);
        assert.equal(utils.calcBonusPericia(p, 'Furtividade'), esperado,
          `Clérigo Taumaturgo, Furtividade, Sabedoria ${sabedoria}, nível ${nivel}, ${rotulo}: Furtividade não ` +
          `está na lista do livro, esperado ${esperado}`);
      }
    }
  }
});

// Negativa 3 -- outra classe (Mago, com ordem_divina="Taumaturgo" no
// personagem -- campo que a criação real nunca preenche fora de Clérigo,
// mas o ramo em utils.js:316 checa `classe === 'Clérigo'` primeiro, e é
// essa checagem que este teste prova) NÃO recebe o bônus -- 1.800
// combinações por perícia.
for (const pericia of ['Arcanismo', 'Religião']) {
  test(`calcBonusPericia: outra classe (Mago) com ordem_divina="Taumaturgo" NÃO recebe o bônus em ${pericia} -- o ramo exige classe==="Clérigo" (utils.js:316) -- 1.800 combinações`, () => {
    for (let nivel = 1; nivel <= 20; nivel++) {
      const bp = bonusProficienciaIndependente(nivel);
      for (let sabedoria = 1; sabedoria <= 30; sabedoria++) {
        for (const { prof, exp, rotulo } of ESTADOS_PROFICIENCIA_PERICIA) {
          const p = store.criarPersonagemVazio();
          p.classe = 'Mago';
          p.ordem_divina = 'Taumaturgo';
          p.nivel = nivel;
          p.atributos.inteligencia = 10;
          p.atributos.sabedoria = sabedoria;
          p.pericias_proficientes = prof ? [pericia] : [];
          p.pericias_expertise = exp ? [pericia] : [];
          const esperado = (prof ? bp : 0) + (exp ? bp : 0);
          assert.equal(utils.calcBonusPericia(p, pericia), esperado,
            `Mago com ordem_divina=Taumaturgo, ${pericia}, Sabedoria ${sabedoria}, nível ${nivel}, ${rotulo}: ` +
            `classe errada não deveria somar o bônus, esperado ${esperado}`);
        }
      }
    }
  });
}
