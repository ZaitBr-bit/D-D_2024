// ============================================================
// Classificação Ativa/Passiva de toda característica de CLASSE BASE
// das 12 classes, transcrita do livro (`Informacoes Separadas/Classes.md`),
// mais os efeitos numéricos que essas características concedem.
//
// REGRA DURA: cada classificação e cada `motivo` foram lidos do LIVRO,
// não de `site/js/utils.js` (a heurística `ehHabilidadeAtiva`,
// utils.js:499-511, que a Task 4 confronta contra este catálogo) nem de
// `dados/classes/*.json` (usado só para saber QUAIS características
// pertencem à classe base -- nunca para decidir se são ativas ou
// passivas). Um catálogo que espiasse a heurística do app produziria um
// teste que compara o app consigo mesmo.
//
// ESCOPO: só características de classe base (`dados/classes/<classe>.json`
// -> `caracteristicas`). Subclasses estão fora. Ver ARMADILHA DE DADOS
// abaixo -- o array bruto não é "classe base pura" em 10 das 12 classes.
//
// ------------------------------------------------------------
// O campo `base` -- por que existe e o que cada valor prova
// ------------------------------------------------------------
// O livro NÃO rotula características como "Ativa"/"Passiva" -- esse par
// é vocabulário do app (a seção da ficha), não do livro. Tratar as 174
// classificações abaixo como uma alegação direta sobre o livro faria
// toda discordância do app virar "o app está errado", quando boa parte
// não tem frase nenhuma para citar -- é leitura, não fato. `base` marca
// a força da evidência por trás de cada `ativa`, em três níveis:
//
//   'custo-declarado' -- o livro declara um custo preso à PRÓPRIA
//     característica: Ação, Ação Bônus, Reação, um recurso nomeado
//     ("você pode gastar N Pontos de Foco/Feitiçaria/Vida", "um custo em
//     dados", "gastar um espaço de magia"), ou uma recarga por descanso
//     ("você não pode usar esta característica novamente até completar
//     um Descanso Curto/Longo"). `motivo` aqui é o TRECHO LITERAL do
//     livro que declara esse custo -- não uma paráfrase. `ativa: true`.
//   'ausencia-de-custo' -- o livro descreve um benefício contínuo, sem
//     custo nem gatilho de decisão nenhum ("Seus instintos estão tão
//     apurados que você tem Vantagem nas jogadas de Iniciativa"), ou uma
//     concessão permanente (talento, subclasse, proficiência). `ativa:
//     false`.
//   'julgamento' -- o livro diz "você pode causar/adicionar/substituir/
//     escolher..." sem custo algum, e o benefício depende de o jogador
//     decidir aplicá-lo num momento específico, avaliando se compensa
//     (Ataque Furtivo, Golpes Abençoados/Golpe Divino, Mestre Tático).
//     Não existe frase para citar como prova de "ativa" nem de "passiva"
//     -- `ativa` carrega minha leitura mais razoável, não uma alegação.
//
// A distinção importa porque só os dois primeiros valores sustentam uma
// lacuna: se o app discordar de 'custo-declarado' ou 'ausencia-de-custo',
// há uma frase do livro para citar como prova de que o app errou. Se o
// app discordar de uma entrada 'julgamento', isso não é lacuna -- é
// limite declarado (duas leituras razoáveis do mesmo texto ambíguo), e
// a Task 4 não deve reportar como "app diverge do livro" sem qualificar.
//
// NOTA CRUZADA (achado da revisão independente de 2026-08-17): o catálogo
// irmão `subclasses.mjs` (Plano 4, RECURSOS_SUBCLASSE) lê a MESMA frase
// "uma vez em cada um dos seus turnos, você pode..." -- a que classifica
// Ataque Furtivo e Golpes Abençoados/Golpe Divino como 'julgamento' aqui
// embaixo -- como `custo-declarado` lá. Não é incoerência entre os dois
// catálogos: cada um responde a uma pergunta diferente sobre a MESMA
// frase. Este arquivo pergunta "há uma frase de CUSTO DE ATIVAÇÃO, para
// decidir ativa/passiva?" -- e "uma vez por turno" sozinho não declara
// nenhum custo de ativar, só um limite de frequência, por isso vira
// 'julgamento' aqui. `subclasses.mjs` pergunta "o livro nomeia um LIMITE
// (não necessariamente um CUSTO)?" -- e sua própria definição de
// `base: 'custo-declarado'` inclui explicitamente essa terceira forma
// ("uma Ação, um recurso nomeado, OU UM LIMITE"), então a mesma frase
// sustenta `custo-declarado` lá. Quem ler os dois catálogos lado a lado e
// estranhar a mesma frase virando 'julgamento' aqui e 'custo-declarado'
// (com `recarga: 'outro'`) lá deve ler esta nota antes de reportar
// contradição -- é leitura diferente por pergunta diferente, não erro de
// cópia em nenhum dos dois lados.
//
// ------------------------------------------------------------
// O campo `composta` -- a segunda forma de "não é uma alegação simples"
// ------------------------------------------------------------
// Em 10 das 174 entradas, o livro empacota, sob UM nome de característica,
// cláusulas que teriam `base` DIFERENTE se fossem entradas separadas --
// tipicamente uma concessão passiva incondicional ("Além disso, você não
// sofre níveis de Exaustão...") ao lado de uma cláusula com custo
// declarado ("...você pode gastar 1 Ponto de Foco..."), ou duas opções
// alternativas de naturezas diferentes ("Conjuração Poderosa" passiva vs.
// "Golpe Divino" por julgamento). Essas entradas ganham `composta: true` e
// um comentário ao lado listando as partes e a natureza de cada uma.
//
// O invariante `ativa === (base === 'custo-declarado')` continua valendo
// (a entrada como um todo classifica pela cláusula mais forte). A ordem de
// força, quando as partes de uma composta discordam: custo-declarado
// sempre vence (é evidência inequívoca, mesmo ao lado de uma parte
// passiva -- caso de Sobrevivente Disciplinado e Arquidruida); na
// ausência de qualquer parte custo-declarado, julgamento vence sobre
// ausência de custo (a presença de QUALQUER cláusula sem frase citável
// para decidir contamina a alegação "passiva, cite isto como prova" que
// ausencia-de-custo promete -- caso de Conhecimento Primordial, Golpes
// Abençoados e Fúria Elemental, abaixo). Mas **uma entrada composta não
// sustenta lacuna sozinha**, pelo mesmo
// motivo que 'julgamento' não sustenta: se o app modelar só a metade
// passiva (ou só a metade custeada), ou classificar o conjunto pela
// cláusula que domina o texto por tamanho, isso não é necessariamente o
// app errando -- pode ser só um recorte diferente do mesmo texto composto.
// A Task 4 precisa checar `composta` antes de reportar uma dessas dez como
// "app diverge do livro", pela mesma razão que precisa checar `julgamento`.
//
// ARMADILHA DE DADOS (achado desta rodada, ver task-3-report.md):
// em 10 das 12 classes, o array de nível superior `caracteristicas` de
// `dados/classes/*.json` NÃO contém só a classe base -- ele traz
// características de SUBCLASSE grudadas depois das de classe base (o
// mesmo texto que também aparece, corretamente isolado, dentro de
// `subclasses[].caracteristicas`). Só Bárbaro e Guerreiro escapam dessa
// duplicação. Este catálogo já filtra isso: cada entrada abaixo é
// classe base pura, obtida subtraindo de `caracteristicas` qualquer
// (nível, nome) que também apareça em algum `subclasses[].caracteristicas`
// da mesma classe -- o mesmo compromisso que a ficha resolve em tempo de
// execução em `site/js/sheet/caracteristicas.js:14-30` (filtra pelo nome
// de `char.subclasse`). Ver task-3-report.md para a tabela completa
// (contaminado_por_subclasse por classe) e a decisão de usar essa
// dedução em vez de aceitar o array bruto.
// ============================================================

export const CLASSIFICACAO = {
  // Classes.md:44-183 (tabela + prosa). Bárbaro base = 20 características.
  'Bárbaro': [
    { nivel: 1, nome: 'Fúria', ativa: true, base: 'custo-declarado', livro: 'Classes.md:69',
      motivo: 'Você pode entrar em Fúria como uma Ação Bônus' },
    { nivel: 1, nome: 'Defesa sem Armadura', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:93',
      motivo: 'sua Classe de Armadura base é igual a 10 mais seus modificadores de Destreza e Constituição' },
    { nivel: 1, nome: 'Maestria em Arma', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:97',
      motivo: 'permite que você utilize as propriedades de maestria... à sua escolha (capacidade contínua; a troca de escolha em Descanso Longo não é um custo de ativação)' },
    // JULGAMENTO: "você pode decidir atacar de forma imprudente" -- sem
    // custo declarado, e o benefício (Vantagem ao atacar) tem uma
    // contrapartida real (Vantagem para quem ataca você também), então
    // é genuinamente uma decisão tática por turno, não um "sempre vale a
    // pena". Nenhuma frase do livro resolve se isso é "ativa"; leitura,
    // não alegação.
    { nivel: 2, nome: 'Ataque Imprudente', ativa: false, base: 'julgamento', livro: 'Classes.md:103',
      motivo: 'Ao realizar sua primeira jogada de ataque no seu turno, você pode decidir atacar de forma imprudente' },
    { nivel: 2, nome: 'Sentido de Perigo', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:107',
      motivo: 'Você tem Vantagem em salvaguardas de Destreza' },
    // COMPOSTA: duas partes de naturezas diferentes sob um nome só --
    // "Você adquire proficiência em outra perícia à sua escolha"
    // (Classes.md:111) é concessão incondicional (ausencia-de-custo,
    // independente de Fúria); só a segunda parte, a substituição de
    // atributo ("pode realizá-lo como um teste de Força"), é julgamento
    // -- não é piso incondicional, só compensa se Força for de fato
    // melhor que o modificador padrão da perícia naquele teste
    // específico. A classificação segue a parte sem frase para citar
    // (julgamento vence ausencia-de-custo na força da evidência).
    { nivel: 3, nome: 'Conhecimento Primordial', ativa: false, base: 'julgamento', composta: true, livro: 'Classes.md:113',
      motivo: 'enquanto sua Fúria estiver ativa, você pode canalizar poder primitivo... pode realizá-lo como um teste de Força, mesmo que normalmente utilize outro atributo' },
    { nivel: 3, nome: 'Subclasse de Bárbaro', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:117',
      motivo: 'Você adquire uma subclasse de Bárbaro à sua escolha (escolha permanente, não uma ativação)' },
    { nivel: 4, nome: 'Aumento no Valor de Atributo', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:121',
      motivo: 'Você adquire o talento Aumento no Valor de Atributo... ou outro talento à sua escolha (concessão permanente)' },
    { nivel: 5, nome: 'Ataque Extra', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:125',
      motivo: 'Você pode atacar duas vezes, em vez de uma, sempre que executar a ação Atacar (modifica a própria ação Atacar; não é um custo adicional nem uma decisão -- vale sempre)' },
    { nivel: 5, nome: 'Movimento Rápido', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:129',
      motivo: 'Seu Deslocamento aumenta em 3 metros enquanto você não estiver usando Armadura Pesada' },
    { nivel: 7, nome: 'Bote Instintivo', ativa: true, base: 'custo-declarado', livro: 'Classes.md:133',
      motivo: 'Como parte da Ação Bônus que você realiza para entrar em Fúria, você pode se mover' },
    { nivel: 7, nome: 'Instintos Primitivos', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:137',
      motivo: 'você tem Vantagem nas jogadas de Iniciativa' },
    // JULGAMENTO: os efeitos de Golpe Brutal ("você pode causar um
    // efeito... à sua escolha") não têm custo em dados nem recurso --
    // diferente do Golpe Astuto do Ladino, que declara custo em dados
    // explicitamente (ver Ladino, abaixo). Sem custo, a decisão de
    // aplicar (e qual efeito escolher) é julgamento tático puro.
    { nivel: 9, nome: 'Golpe Brutal', ativa: false, base: 'julgamento', livro: 'Classes.md:141',
      motivo: 'Se a jogada de ataque atingir o alvo... você pode causar um efeito de Golpe Brutal à sua escolha' },
    { nivel: 11, nome: 'Fúria Implacável', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:151',
      motivo: 'você pode realizar uma salvaguarda de Constituição CD 10 (gatilho automático ao cair a 0 PV, sem custo e sem alternativa real a pesar -- não há razão para recusar)' },
    { nivel: 13, nome: 'Golpe Brutal Aprimorado', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:157',
      motivo: 'Os seguintes efeitos agora estão entre suas opções de Golpe Brutal (upgrade contínuo, sem custo e sem "você pode" próprio)' }, // livro chama esta característica de "Golpe Brutal Fortalecido" (Classes.md:155); dados/classes/barbaro.json grafa "Golpe Brutal Aprimorado" -- divergência de nome, ver task-3-report.md
    // COMPOSTA: "Ao jogar Iniciativa, você pode recuperar todos os usos
    // gastos de Fúria... não pode fazê-lo novamente até completar um
    // Descanso Longo" é custo-declarado (recarga); "Além disso, sua Fúria
    // é tão feroz que agora dura 10 minutos sem a necessidade de estender"
    // (Classes.md:167) é uma extensão de duração incondicional, sem custo
    // -- ausencia-de-custo, e vale mesmo que a recuperação por Iniciativa
    // nunca seja usada. custo-declarado vence.
    { nivel: 15, nome: 'Fúria Persistente', ativa: true, base: 'custo-declarado', composta: true, livro: 'Classes.md:165',
      motivo: 'Após recuperar a Fúria deste modo, você não pode fazê-lo novamente até completar um Descanso Longo' },
    { nivel: 17, nome: 'Golpe Brutal Aprimorado', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:171',
      motivo: 'O dano adicional de seu Golpe Brutal aumenta para 2d10 pontos (upgrade contínuo, sem custo -- usar dois efeitos em vez de um nunca é pior)' }, // idem nível 13: livro grafa "Golpe Brutal Fortalecido" (Classes.md:169)
    { nivel: 18, nome: 'Força Indomável', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:175',
      motivo: 'você pode usar esse valor no lugar do resultado total (só se aplica quando já é estritamente melhor -- piso incondicional, não decisão)' },
    { nivel: 19, nome: 'Dádiva Épica', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:179',
      motivo: 'Você adquire um talento Dádiva Épica... (concessão permanente)' },
    { nivel: 20, nome: 'Campeão Primitivo', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:183',
      motivo: 'Seus valores de Força e Constituição aumentam em 4' },
  ],

  // Classes.md:400-486. Bardo base = 12 características.
  'Bardo': [
    { nivel: 1, nome: 'Inspiração de Bardo', ativa: true, base: 'custo-declarado', livro: 'Classes.md:404',
      motivo: 'Como uma Ação Bônus, você pode inspirar outra criatura' },
    { nivel: 1, nome: 'Conjuração', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:414',
      motivo: 'Você aprendeu a conjurar magias... (concede a capacidade; o custo de Ação pertence a cada magia conjurada, não a esta característica)' },
    { nivel: 2, nome: 'Especialista', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:438',
      motivo: 'Você adquire Especialização... em duas de suas perícias' },
    { nivel: 2, nome: 'Pau pra Toda Obra', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:444',
      motivo: 'Você pode adicionar metade do seu Bônus de Proficiência... a qualquer teste de atributo (bônus automático sempre que a condição vale -- sem custo, sem decisão real)' },
    { nivel: 3, nome: 'Subclasse de Bardo', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:450',
      motivo: 'Você adquire uma subclasse de Bardo à sua escolha' },
    { nivel: 4, nome: 'Aumento no Valor de Atributo', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:460',
      motivo: 'Você adquire o talento Aumento no Valor de Atributo... (concessão permanente)' },
    // COMPOSTA: "Você agora restaura todos os seus usos gastos de
    // Inspiração de Bardo ao completar um Descanso Curto ou Longo"
    // (Classes.md:464) é uma mudança de taxa de recuperação automática,
    // sem custo -- ausencia-de-custo, vale mesmo que você nunca gaste um
    // espaço de magia. A segunda frase é custo-declarado: o livro nomeia
    // um recurso gasto (um espaço de magia) mesmo dizendo "nenhuma ação
    // necessária" -- gastar um recurso é custo, mesmo sem custar ação
    // (mesmo padrão de "gastar N Pontos de Foco"). custo-declarado vence.
    { nivel: 5, nome: 'Fonte de Inspiração', ativa: true, base: 'custo-declarado', composta: true, livro: 'Classes.md:466',
      motivo: 'você pode gastar um espaço de magia (nenhuma ação necessária) para recuperar um uso gasto de Inspiração de Bardo' },
    { nivel: 7, nome: 'Contra-Encantamento', ativa: true, base: 'custo-declarado', livro: 'Classes.md:470',
      motivo: 'você pode executar uma Reação para jogar novamente a salvaguarda' },
    { nivel: 10, nome: 'Segredos Mágicos', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:474',
      motivo: 'você pode escolher qualquer uma das novas magias preparadas da lista de magias de Bardo, Clérigo, Druida e Mago (amplia a lista de Conjuração; sem custo, sem decisão em combate)' },
    { nivel: 18, nome: 'Inspiração Superior', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:478',
      motivo: 'Ao jogar Iniciativa, recupera usos gastos de Inspiração de Bardo (automático, sem custo e sem recarga própria declarada)' },
    { nivel: 19, nome: 'Dádiva Épica', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:482',
      motivo: 'Você adquire um talento Dádiva Épica... (concessão permanente)' },
    { nivel: 20, nome: 'Palavras de Criação', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:486',
      motivo: 'você sempre tem as magias... preparadas (concessão permanente; o custo de Ação pertence à magia conjurada, não a esta característica)' },
  ],

  // Classes.md:878-948. Bruxo base = 9 características.
  'Bruxo': [
    { nivel: 1, nome: 'Invocações Místicas', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:880',
      motivo: 'Você recebe uma invocação à sua escolha... uma habilidade mágica permanente' },
    { nivel: 1, nome: 'Magia de Pacto', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:892',
      motivo: 'a habilidade de conjurar magias (concede a capacidade; custo de Ação pertence a cada magia)' },
    { nivel: 2, nome: 'Astúcia Mágica', ativa: true, base: 'custo-declarado', livro: 'Classes.md:916',
      motivo: 'Você pode usar esta característica novamente após completar um Descanso Longo' },
    { nivel: 3, nome: 'Subclasse de Bruxo', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:920',
      motivo: 'Você adquire uma subclasse de Bruxo à sua escolha' },
    { nivel: 4, nome: 'Aumento no Valor de Atributo', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:924',
      motivo: 'Você adquire o talento Aumento no Valor de Atributo... (concessão permanente)' },
    { nivel: 9, nome: 'Contatar Patrono', ativa: true, base: 'custo-declarado', livro: 'Classes.md:930',
      motivo: 'Você pode conjurar a magia com esta característica novamente após completar um Descanso Longo' },
    { nivel: 11, nome: 'Arcana Mística', ativa: true, base: 'custo-declarado', livro: 'Classes.md:936',
      motivo: 'novamente desta forma após completar um Descanso Longo' },
    { nivel: 19, nome: 'Dádiva Épica', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:944',
      motivo: 'Você adquire o talento Dádiva Épica... (concessão permanente)' },
    { nivel: 20, nome: 'Mestre Místico', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:948',
      motivo: 'Ao usar sua característica Astúcia Mágica, você restaura todos os seus espaços de magia (modificador automático de outra característica; sem custo próprio)' },
  ],

  // Classes.md:1538-1622. Clérigo base = 11 características.
  'Clérigo': [
    { nivel: 1, nome: 'Conjuração', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:1540',
      motivo: 'Você aprendeu a conjurar magias por meio de oração e meditação (concede a capacidade)' },
    { nivel: 1, nome: 'Ordem Divina', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:1564',
      motivo: 'Você se dedicou a um dos seguintes papéis sagrados à sua escolha (escolha permanente)' },
    { nivel: 2, nome: 'Canalizar Divindade', ativa: true, base: 'custo-declarado', livro: 'Classes.md:1578',
      motivo: 'Como uma ação Usar Magia, você expõe seu Símbolo Sagrado' },
    { nivel: 3, nome: 'Subclasse de Clérigo', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:1586',
      motivo: 'Você adquire uma subclasse de Clérigo à sua escolha' },
    { nivel: 4, nome: 'Aumento no Valor de Atributo', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:1590',
      motivo: 'Você adquire o talento Aumento no Valor de Atributo... (concessão permanente)' },
    { nivel: 5, nome: 'Fulminar Mortos-Vivos', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:1594',
      motivo: 'Ao usar Expulsar Mortos-Vivos, você pode jogar... (modificador automático de outra característica, sem custo próprio)' },
    // COMPOSTA: duas opções ALTERNATIVAS (escolhidas uma vez, à sua
    // escolha) de naturezas diferentes -- "Conjuração Poderosa. Adicione
    // seu modificador de Sabedoria ao dano..." (Classes.md:1600) é
    // ausencia-de-custo (declarativo, sem "você pode"); "Golpe Divino"
    // (citado abaixo) é julgamento -- "você pode causar... adicionais"
    // sem custo declarado, diferente de Golpe Astuto do Ladino. Como
    // nenhuma das duas tem custo declarado, julgamento vence.
    { nivel: 7, nome: 'Golpes Abençoados', ativa: false, base: 'julgamento', composta: true, livro: 'Classes.md:1602',
      motivo: 'Golpe Divino: uma vez em cada um dos seus turnos, quando você atinge uma criatura com uma jogada de ataque usando uma arma, você pode causar ao alvo 1d8 pontos de dano... adicionais' },
    { nivel: 10, nome: 'Intervenção Divina', ativa: true, base: 'custo-declarado', livro: 'Classes.md:1606',
      motivo: 'Você não pode usar essa característica novamente até completar um Descanso Longo' },
    // COMPOSTA: herda o padrão do nível 7, mas invertido -- aqui é a
    // opção "Conjuração Poderosa" (citada abaixo) que virou julgamento
    // ("você pode conferir vitalidade..." sem custo declarado), enquanto
    // "Golpe Divino. O dano adicional... aumenta para 2d8" (Classes.md:1614)
    // é puramente numérico e automático -- ausencia-de-custo. Nenhuma das
    // duas tem custo declarado, então julgamento vence.
    { nivel: 14, nome: 'Golpes Abençoados Aprimorados', ativa: false, base: 'julgamento', composta: true, livro: 'Classes.md:1612',
      motivo: 'Conjuração Poderosa: você pode conferir vitalidade a si ou a outra criatura a até 18 metros de você, concedendo... Pontos de Vida Temporários' },
    { nivel: 19, nome: 'Dádiva Épica', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:1618',
      motivo: 'Você adquire o talento Dádiva Épica... (concessão permanente)' },
    { nivel: 20, nome: 'Intervenção Divina Maior', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:1622',
      motivo: 'Quando usar sua característica Intervenção Divina, você pode escolher Desejo (modificador do custo/recarga de outra característica, sem ativação própria)' },
  ],

  // Classes.md:2024-2144. Druida base = 13 características.
  'Druida': [
    { nivel: 1, nome: 'Conjuração', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:2026',
      motivo: 'Você aprendeu a conjurar magias através do estudo das forças místicas da natureza (concede a capacidade)' },
    { nivel: 1, nome: 'Idioma Druídico', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:2050',
      motivo: 'você sempre tem a magia Falar com Animais preparada... Você pode usar Druídico para deixar mensagens ocultas (capacidade contínua)' },
    { nivel: 1, nome: 'Ordem Primal', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:2056',
      motivo: 'Você se dedicou a uma das seguintes funções sagradas à sua escolha (escolha permanente)' },
    { nivel: 2, nome: 'Companheiro Selvagem', ativa: true, base: 'custo-declarado', livro: 'Classes.md:2064',
      motivo: 'Como uma ação Usar Magia, você pode gastar um espaço de magia ou um uso de Forma Selvagem para conjurar' },
    { nivel: 2, nome: 'Forma Selvagem', ativa: true, base: 'custo-declarado', livro: 'Classes.md:2070',
      motivo: 'Como uma Ação Bônus, você multimorfa para uma forma Animal' },
    { nivel: 3, nome: 'Subclasse de Druida', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:2102',
      motivo: 'Você adquire uma subclasse de Druida à sua escolha' },
    { nivel: 4, nome: 'Aumento no Valor de Atributo', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:2106',
      motivo: 'Você adquire o talento Aumento no Valor de Atributo... (concessão permanente)' },
    { nivel: 5, nome: 'Ressurgimento Selvagem', ativa: true, base: 'custo-declarado', livro: 'Classes.md:2112',
      motivo: 'você pode gastar um uso de Forma Selvagem (nenhuma ação é necessária)... mas não pode fazê-lo novamente até completar um Descanso Longo' },
    // COMPOSTA: duas opções ALTERNATIVAS de naturezas diferentes -- a
    // opção Ataque Primal (citada abaixo) é julgamento ("pode causar
    // 1d8... adicional", só "uma vez por turno" como limite de
    // frequência, sem custo -- mesmo padrão do Golpe Divino de Clérigo);
    // "Conjuração Poderosa. Adicione seu modificador de Sabedoria ao
    // dano..." (Classes.md:2120) é ausencia-de-custo (declarativo).
    // Nenhuma das duas tem custo declarado, então julgamento vence.
    { nivel: 7, nome: 'Fúria Elemental', ativa: false, base: 'julgamento', composta: true, livro: 'Classes.md:2118',
      motivo: 'Ataque Primal: uma vez em cada um dos seus turnos, ao atingir uma criatura..., pode causar 1d8 pontos de dano... adicional ao alvo' },
    { nivel: 15, nome: 'Fúria Elemental Aprimorada', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:2126',
      motivo: 'O dano adicional de seu Ataque Primal aumenta para 2d8 (upgrade puramente numérico, sem "você pode" nem custo)' },
    { nivel: 18, nome: 'Magias Bestiais', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:2132',
      motivo: 'Ao usar Forma Selvagem, você pode conjurar magias na forma Animal (modificador de outra característica, sem custo próprio)' },
    { nivel: 19, nome: 'Dádiva Épica', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:2136',
      motivo: 'Você adquire o talento Dádiva Épica... (concessão permanente)' },
    // COMPOSTA: TRÊS partes, não duas -- "Forma Selvagem Eterna"
    // (Classes.md:2142, gatilho automático ao rolar Iniciativa, sem
    // custo) e "Longevidade" (Classes.md:2146, "para cada dez anos que
    // passam, seu corpo envelhece apenas um" -- puramente passiva,
    // envelhecimento mais lento, sem relação nenhuma com Forma Selvagem)
    // são ambas ausencia-de-custo; só "Natureza Xamânica" (citada abaixo)
    // declara custo/recarga. custo-declarado vence sobre as outras duas.
    { nivel: 20, nome: 'Arquidruida', ativa: true, base: 'custo-declarado', composta: true, livro: 'Classes.md:2144',
      motivo: 'Após usar este benefício, você não pode fazê-lo novamente até completar um Descanso Longo' },
  ],

  // Classes.md:2633-2720. Feiticeiro base = 10 características.
  'Feiticeiro': [
    { nivel: 1, nome: 'Conjuração', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:2635',
      motivo: 'Através da sua magia inata, você pode conjurar magias (concede a capacidade)' },
    { nivel: 1, nome: 'Feitiçaria Inata', ativa: true, base: 'custo-declarado', livro: 'Classes.md:2657',
      motivo: 'Como uma Ação Bônus, você pode liberar essa magia por 1 minuto' },
    { nivel: 2, nome: 'Fonte de Magia', ativa: true, base: 'custo-declarado', livro: 'Classes.md:2674',
      motivo: 'Como uma Ação Bônus, você pode transformar Pontos de Feitiçaria não gastos em um espaço de magia' },
    { nivel: 2, nome: 'Metamagia', ativa: true, base: 'custo-declarado', livro: 'Classes.md:2690',
      motivo: 'Essas opções podem ser usadas para modificar temporariamente as magias que conjura, consumindo a quantidade correspondente de Pontos de Feitiçaria' },
    { nivel: 3, nome: 'Subclasse de Feiticeiro', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:2698',
      motivo: 'Você adquire uma subclasse de Feiticeiro à sua escolha' },
    { nivel: 4, nome: 'Aumento no Valor de Atributo', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:2702',
      motivo: 'Você adquire o talento Aumento no Valor de Atributo... (concessão permanente)' },
    { nivel: 5, nome: 'Restauração Feiticeira', ativa: true, base: 'custo-declarado', livro: 'Classes.md:2706',
      motivo: 'Você pode usar essa característica novamente após completar um Descanso Longo' },
    { nivel: 7, nome: 'Feitiçaria Encarnada', ativa: true, base: 'custo-declarado', livro: 'Classes.md:2710',
      motivo: 'você pode usá-la se gastar 2 Pontos de Feitiçaria ao executar a Ação Bônus para ativá-la' },
    { nivel: 19, nome: 'Dádiva Épica', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:2716',
      motivo: 'Você adquire o talento Dádiva Épica... (concessão permanente)' },
    { nivel: 20, nome: 'Apoteose Arcana', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:2720',
      motivo: 'você pode usar uma opção de Metamagia... sem gastar Pontos de Feitiçaria (isenta o custo de Metamagia; não introduz custo próprio)' },
  ],

  // Classes.md:3278-3375. Guardião base = 17 características.
  'Guardião': [
    { nivel: 1, nome: 'Conjuração', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:3280',
      motivo: 'Você aprendeu a canalizar a essência mágica da natureza para conjurar magias (concede a capacidade)' },
    { nivel: 1, nome: 'Inimigo Favorito', ativa: true, base: 'custo-declarado', livro: 'Classes.md:3298',
      motivo: 'restaura todos os usos gastos desta característica ao completar um Descanso Longo' },
    { nivel: 1, nome: 'Maestria em Arma', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:3304',
      motivo: 'permite que você use as propriedades de maestria... com as quais tem proficiência (capacidade contínua)' },
    { nivel: 2, nome: 'Estilo de Luta', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:3310',
      motivo: 'Você adquire um talento Estilo de Luta à sua escolha (concessão permanente)' },
    { nivel: 2, nome: 'Explorador Hábil', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:3318',
      motivo: 'Você obtém Especialização nessa perícia... Você conhece dois idiomas' },
    { nivel: 3, nome: 'Subclasse de Guardião', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:3324',
      motivo: 'Você adquire uma subclasse de Guardião à sua escolha' },
    { nivel: 4, nome: 'Aumento no Valor de Atributo', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:3328',
      motivo: 'Você adquire o talento Aumento no Valor de Atributo... (concessão permanente)' },
    { nivel: 5, nome: 'Ataque Extra', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:3332',
      motivo: 'Você pode atacar duas vezes, em vez de uma, sempre que executar a ação Atacar' },
    { nivel: 6, nome: 'Errante', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:3336',
      motivo: 'Seu Deslocamento aumenta em 3 metros... Você também tem um Deslocamento de Escalada e de Natação' },
    { nivel: 9, nome: 'Especialista', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:3340',
      motivo: 'Você obtém Especialização nessas perícias' },
    // COMPOSTA: "Pontos de Vida Temporários" (citada abaixo) é
    // custo-declarado (Ação Usar Magia); "Redução de Exaustão. Sempre que
    // completar um Descanso Curto, seu nível de Exaustão, se houver,
    // reduz em 1" (Classes.md:3348) é automática e sem custo -- vale mesmo
    // que a ação Usar Magia nunca seja usada. custo-declarado vence.
    { nivel: 10, nome: 'Incansável', ativa: true, base: 'custo-declarado', composta: true, livro: 'Classes.md:3346',
      motivo: 'Como uma ação Usar Magia, você pode conceder a si um número de Pontos de Vida Temporários' },
    { nivel: 13, nome: 'Predador Implacável', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:3352',
      motivo: 'Sofrer dano não quebra sua Concentração da Marca do Caçador' },
    { nivel: 14, nome: 'Véu da Natureza', ativa: true, base: 'custo-declarado', livro: 'Classes.md:3356',
      motivo: 'Como uma Ação Bônus, você pode conceder a si a condição Invisível' },
    { nivel: 17, nome: 'Caçador Preciso', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:3362',
      motivo: 'Você tem Vantagem em jogadas de ataque contra a criatura marcada' },
    { nivel: 18, nome: 'Sentidos Selvagens', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:3366',
      motivo: 'lhe concede Visão às Cegas com um alcance de 9 metros' },
    { nivel: 19, nome: 'Dádiva Épica', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:3370',
      motivo: 'Você adquire o talento Dádiva Épica... (concessão permanente)' },
    { nivel: 20, nome: 'Matador de Inimigos Favoritos', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:3374',
      motivo: 'O dado de dano da sua Marca do Caçador é um d10 em vez de um d6' },
  ],

  // Classes.md:3808-3878. Guerreiro base = 15 características.
  'Guerreiro': [
    { nivel: 1, nome: 'Estilo de Luta', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:3810',
      motivo: 'tem um talento de Estilo de Luta à sua escolha (concessão permanente)' },
    { nivel: 1, nome: 'Maestria em Arma', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:3816',
      motivo: 'permite que você utilize as propriedades de maestria com três tipos de armas... à sua escolha (capacidade contínua)' },
    { nivel: 1, nome: 'Recuperar Fôlego', ativa: true, base: 'custo-declarado', livro: 'Classes.md:3822',
      motivo: 'Como uma Ação Bônus, você pode usá-la para recuperar Pontos de Vida' },
    { nivel: 2, nome: 'Mente Tática', ativa: true, base: 'custo-declarado', livro: 'Classes.md:3830',
      motivo: 'você pode gastar um uso de seu Recuperar Fôlego para tentar alcançar a vitória' },
    { nivel: 2, nome: 'Surto de Ação', ativa: true, base: 'custo-declarado', livro: 'Classes.md:3836',
      motivo: 'você não pode usá-la novamente até completar um Descanso Curto ou Longo' },
    { nivel: 3, nome: 'Subclasse de Guerreiro', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:3840',
      motivo: 'Você adquire uma subclasse de Guerreiro à sua escolha' },
    { nivel: 4, nome: 'Aumento no Valor de Atributo', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:3844',
      motivo: 'Você adquire o talento Aumento no Valor de Atributo... (concessão permanente)' },
    { nivel: 5, nome: 'Ajuste Tático', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:3848',
      motivo: 'Sempre que executar uma Ação Bônus para seu Recuperar Fôlego, você pode mover-se (rider automático e sem downside sobre outra característica; não soma um custo próprio)' },
    { nivel: 5, nome: 'Ataque Extra', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:3852',
      motivo: 'Você pode atacar duas vezes, em vez de uma, sempre que executar a ação Atacar' },
    { nivel: 9, nome: 'Indomável', ativa: true, base: 'custo-declarado', livro: 'Classes.md:3856',
      motivo: 'não pode usar essa característica novamente até completar um Descanso Longo' },
    // JULGAMENTO: "você pode substituir essa propriedade" não tem custo
    // declarado -- decisão tática sobre qual propriedade de maestria vale
    // mais naquele ataque específico.
    { nivel: 9, nome: 'Mestre Tático', ativa: false, base: 'julgamento', livro: 'Classes.md:3862',
      motivo: 'Ao atacar com uma arma cuja propriedade de maestria você pode usar, você pode substituir essa propriedade pela propriedade Empurrar, Drenar ou Lentidão' },
    { nivel: 11, nome: 'Dois Ataques Extras', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:3866',
      motivo: 'Você pode atacar três vezes, em vez de uma, sempre que executar a ação Atacar' },
    { nivel: 13, nome: 'Ataques Estudados', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:3870',
      motivo: 'você tem Vantagem em sua próxima jogada de ataque contra essa criatura' },
    { nivel: 19, nome: 'Dádiva Épica', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:3874',
      motivo: 'Você adquire o talento Dádiva Épica... (concessão permanente)' },
    { nivel: 20, nome: 'Três Ataques Extras', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:3878',
      motivo: 'Você pode atacar quatro vezes, em vez de uma, sempre que executar a ação Atacar' },
  ],

  // Classes.md:4204-4300. Ladino base = 18 características.
  'Ladino': [
    // JULGAMENTO: "você pode causar 1d6... adicional" uma vez por turno,
    // sem custo em dados nem recurso -- diferente de Golpe Astuto,
    // abaixo, que declara custo em dados explicitamente.
    { nivel: 1, nome: 'Ataque Furtivo', ativa: false, base: 'julgamento', livro: 'Classes.md:4206',
      motivo: 'Uma vez por turno, ao atingir uma criatura com uma jogada de ataque em que tem Vantagem... você pode causar 1d6 pontos de dano adicional' },
    { nivel: 1, nome: 'Especialista', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:4214',
      motivo: 'Você obtém Especialização... em duas de suas perícias' },
    { nivel: 1, nome: 'Gíria do Ladrão', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:4220',
      motivo: 'Você conhece a Gíria dos Ladrões e outro idioma à sua escolha' },
    { nivel: 1, nome: 'Maestria em Arma', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:4224',
      motivo: 'permite que você use as propriedades de maestria de dois tipos de armas... com as quais você tem proficiência (capacidade contínua)' },
    { nivel: 2, nome: 'Ação Ardilosa', ativa: true, base: 'custo-declarado', livro: 'Classes.md:4230',
      motivo: 'você pode executar uma das seguintes ações... como uma Ação Bônus' },
    { nivel: 3, nome: 'Mira Firme', ativa: true, base: 'custo-declarado', livro: 'Classes.md:4234',
      motivo: 'Como uma Ação Bônus, você concede a si mesmo Vantagem' },
    { nivel: 3, nome: 'Subclasse de Ladino', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:4238',
      motivo: 'Você adquire uma subclasse de Ladino à sua escolha' },
    { nivel: 4, nome: 'Aumento no Valor de Atributo', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:4242',
      motivo: 'Você adquire o talento Aumento no Valor de Atributo... (concessão permanente)' },
    { nivel: 5, nome: 'Golpe Astuto', ativa: true, base: 'custo-declarado', livro: 'Classes.md:4246',
      motivo: 'você pode adicionar um dos seguintes efeitos de Golpe Astuto, cada um com um custo em dados que deve ser subtraído do dano total do Ataque Furtivo' },
    { nivel: 5, nome: 'Esquiva Sobrenatural', ativa: true, base: 'custo-declarado', livro: 'Classes.md:4260',
      motivo: 'você pode executar uma Reação para reduzir o dano' },
    { nivel: 7, nome: 'Evasão', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:4264',
      motivo: 'você não sofre dano se for bem-sucedido na salvaguarda e sofre apenas metade do dano se falhar' },
    { nivel: 7, nome: 'Talento Confiável', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:4268',
      motivo: 'você pode tratar uma jogada de d20 igual a 9 ou menos como se fosse 10 (piso incondicional, aplicado só quando já é melhor -- não há decisão real)' },
    { nivel: 11, nome: 'Golpe Astuto Aprimorado', ativa: true, base: 'custo-declarado', livro: 'Classes.md:4272',
      motivo: 'Você pode usar até dois efeitos de Golpe Astuto ao causar dano de Ataque Furtivo, pagando o custo do dado por cada efeito' },
    { nivel: 14, nome: 'Golpes Sujos', ativa: true, base: 'custo-declarado', livro: 'Classes.md:4278',
      motivo: 'Aturdir (Custo: 2d6). O alvo deve ser bem-sucedido em uma salvaguarda de Constituição' }, // as outras duas opções também declaram custo: Nocaute (Custo: 6d6, Classes.md:4280) e Obscurecer (Custo: 3d6, Classes.md:4282)
    { nivel: 15, nome: 'Mente Escorregadia', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:4286',
      motivo: 'Você adquire proficiência em salvaguardas de Sabedoria e Carisma' },
    { nivel: 18, nome: 'Elusivo', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:4290',
      motivo: 'Nenhuma jogada de ataque pode ter Vantagem contra você' },
    { nivel: 19, nome: 'Dádiva Épica', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:4294',
      motivo: 'Você adquire o talento Dádiva Épica... (concessão permanente)' },
    { nivel: 20, nome: 'Golpe de Sorte', ativa: true, base: 'custo-declarado', livro: 'Classes.md:4300',
      motivo: 'Após usar essa característica, você não pode usá-la novamente até completar um Descanso Curto ou Longo' },
  ],

  // Classes.md:4584-4660. Mago base = 10 características.
  'Mago': [
    { nivel: 1, nome: 'Adepto de Ritual', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:4586',
      motivo: 'Você pode conjurar qualquer magia como um Ritual se... (capacidade contínua; o tempo de conjuração de Ritual é regra própria de magia)' },
    { nivel: 1, nome: 'Conjuração', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:4590',
      motivo: 'você aprendeu a conjurar magias (concede a capacidade)' },
    { nivel: 1, nome: 'Recuperação Arcana', ativa: true, base: 'custo-declarado', livro: 'Classes.md:4630',
      motivo: 'Você pode usar esta característica novamente após completar um Descanso Longo' },
    { nivel: 2, nome: 'Acadêmico', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:4634',
      motivo: 'Você tem Especialização na perícia escolhida' },
    { nivel: 3, nome: 'Subclasse de Mago', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:4638',
      motivo: 'Você adquire uma subclasse de Mago à sua escolha' },
    { nivel: 4, nome: 'Aumento no Valor de Atributo', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:4642',
      motivo: 'Você adquire o talento Aumento no Valor de Atributo... (concessão permanente)' },
    { nivel: 5, nome: 'Memorizar Magia', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:4646',
      motivo: 'Ao completar um Descanso Curto, você pode... substituir uma das magias (sem limite de reuso próprio declarado, diferente de Recuperação Arcana)' },
    { nivel: 18, nome: 'Maestria de Magias', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:4650',
      motivo: 'Você sempre tem essas magias preparadas, e pode conjurá-las... sem gastar um espaço de magia (concessão permanente; custo de Ação pertence à magia)' },
    { nivel: 19, nome: 'Dádiva Épica', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:4656',
      motivo: 'Você adquire o talento Dádiva Épica... (concessão permanente)' },
    { nivel: 20, nome: 'Assinatura Mágica', ativa: true, base: 'custo-declarado', livro: 'Classes.md:4660',
      motivo: 'você não pode conjurá-las deste modo novamente até completar um Descanso Curto ou Longo' },
  ],

  // Classes.md:5159-5284. Monge base = 22 características.
  'Monge': [
    // COMPOSTA: TRÊS partes -- "Ataque Desarmado Adicional" (citada
    // abaixo) é custo-declarado (Ação Bônus); "Dado de Artes Marciais.
    // Você pode jogar 1d6 ao invés do dano normal" (Classes.md:5170) e
    // "Ataques com Destreza. Você pode usar seu modificador de Destreza
    // em vez de Força" (Classes.md:5172) são substituições livres, sem
    // custo, aplicadas a QUALQUER ataque com Ataque Desarmado ou arma de
    // Monge -- inclusive os da ação Atacar normal, não só o Ataque
    // Desarmado Adicional -- então são ausencia-de-custo, independentes
    // da Ação Bônus. custo-declarado vence.
    { nivel: 1, nome: 'Artes Marciais', ativa: true, base: 'custo-declarado', composta: true, livro: 'Classes.md:5168',
      motivo: 'Ataque Desarmado Adicional: Você pode realizar um Ataque Desarmado como uma Ação Bônus' },
    { nivel: 1, nome: 'Defesa sem Armadura', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:5176',
      motivo: 'sua Classe de Armadura base é igual a 10 mais seus modificadores de Destreza e Sabedoria' },
    { nivel: 2, nome: 'Foco do Monge', ativa: true, base: 'custo-declarado', livro: 'Classes.md:5188',
      motivo: 'Defesa Paciente: Você pode executar a ação Desengajar como uma Ação Bônus' },
    { nivel: 2, nome: 'Metabolismo Incomum', ativa: true, base: 'custo-declarado', livro: 'Classes.md:5198',
      motivo: 'Após usar essa característica, você não pode usá-la novamente até completar um Descanso Longo' },
    { nivel: 2, nome: 'Movimento sem Armadura', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:5202',
      motivo: 'Seu Deslocamento aumenta em 3 metros enquanto você não vestir armadura ou empunhar um Escudo' },
    { nivel: 3, nome: 'Defletir Ataques', ativa: true, base: 'custo-declarado', livro: 'Classes.md:5206',
      motivo: 'você pode executar uma Reação para reduzir o dano total do ataque' },
    { nivel: 3, nome: 'Subclasse de Monge', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:5212',
      motivo: 'Você adquire uma subclasse de Monge à sua escolha' },
    { nivel: 4, nome: 'Aumento no Valor de Atributo', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:5216',
      motivo: 'Você adquire o talento Aumento no Valor de Atributo... (concessão permanente)' },
    { nivel: 4, nome: 'Queda Lenta', ativa: true, base: 'custo-declarado', livro: 'Classes.md:5220',
      motivo: 'Você pode executar uma Reação ao estar em queda para reduzir qualquer dano recebido' },
    { nivel: 5, nome: 'Ataque Extra', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:5224',
      motivo: 'Você pode atacar duas vezes, em vez de uma, sempre que executar a ação Atacar' },
    { nivel: 5, nome: 'Golpe Atordoante', ativa: true, base: 'custo-declarado', livro: 'Classes.md:5228',
      motivo: 'você pode gastar 1 Ponto de Foco para tentar um golpe atordoante' },
    // JULGAMENTO: escolher o tipo de dano (Energético ou o normal) não
    // tem custo declarado -- decisão situacional (ex.: driblar
    // resistência a dano do alvo), sem recurso gasto.
    { nivel: 6, nome: 'Golpes Potencializados', ativa: false, base: 'julgamento', livro: 'Classes.md:5232',
      motivo: 'Ao causar dano com seu Ataque Desarmado, você escolhe entre causar dano Energético ou seu tipo de dano normal' },
    { nivel: 7, nome: 'Evasão', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:5236',
      motivo: 'você não recebe dano em caso de sucesso e sofre apenas metade do dano se falhar' },
    { nivel: 9, nome: 'Movimento Acrobático', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:5242',
      motivo: 'você adquire a capacidade de se mover... por superfícies verticais e por líquidos' },
    { nivel: 10, nome: 'Foco Aprimorado', ativa: true, base: 'custo-declarado', livro: 'Classes.md:5252',
      motivo: 'Torrente de Golpes: Você pode gastar 1 Ponto de Foco para usar Torrente de Golpes e realizar três Ataques Desarmados em vez de dois' },
    { nivel: 10, nome: 'Restauro Pessoal', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:5256',
      motivo: 'você pode remover uma das seguintes condições de si no final de cada um dos seus turnos (sem custo declarado; sempre vantajoso quando aplicável)' },
    { nivel: 13, nome: 'Defletir Energia', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:5262',
      motivo: 'Agora você pode usar sua característica Defletir Ataques contra ataques que causam qualquer tipo de dano (amplia o escopo de outra característica; sem custo próprio)' },
    // COMPOSTA: "Sua disciplina física e mental lhe concede proficiência
    // em todas as salvaguardas" (Classes.md:5266) é ausencia-de-custo
    // (concessão incondicional, vale mesmo sem nenhum Ponto de Foco); só
    // a rejogada (citada abaixo) é custo-declarado. custo-declarado
    // vence.
    { nivel: 14, nome: 'Sobrevivente Disciplinado', ativa: true, base: 'custo-declarado', composta: true, livro: 'Classes.md:5268',
      motivo: 'ao realizar uma salvaguarda e falhar, você pode gastar 1 Ponto de Foco para jogar novamente' },
    { nivel: 15, nome: 'Foco Perfeito', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:5272',
      motivo: 'Ao jogar Iniciativa... você recupera Pontos de Foco gastos até ter 4 (automático, sem custo e sem recarga própria declarada)' },
    { nivel: 18, nome: 'Defesa Superior', ativa: true, base: 'custo-declarado', livro: 'Classes.md:5276',
      motivo: 'você pode gastar 3 Pontos de Foco para se fortalecer contra danos' },
    { nivel: 19, nome: 'Dádiva Épica', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:5280',
      motivo: 'Você adquire o talento Dádiva Épica... (concessão permanente)' },
    { nivel: 20, nome: 'Corpo e Mente', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:5284',
      motivo: 'Seus valores de Destreza e Sabedoria aumentam em 4' },
  ],

  // Classes.md:5499-5607. Paladino base = 17 características.
  'Paladino': [
    { nivel: 1, nome: 'Conjuração', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:5501',
      motivo: 'Você aprendeu a conjurar magias por meio de oração e meditação (concede a capacidade)' },
    { nivel: 1, nome: 'Maestria em Arma', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:5519',
      motivo: 'permite que você use as propriedades de maestria de dois tipos de armas... com as quais você tem proficiência (capacidade contínua)' },
    { nivel: 1, nome: 'Mãos Consagradas', ativa: true, base: 'custo-declarado', livro: 'Classes.md:5527',
      motivo: 'Como uma Ação Bônus, você toca uma criatura... e extrair poder dessa reserva de cura' },
    { nivel: 2, nome: 'Destruição do Paladino', ativa: true, base: 'custo-declarado', livro: 'Classes.md:5533',
      motivo: 'não podendo conjurá-la dessa forma novamente antes de completar um Descanso Longo' },
    { nivel: 2, nome: 'Estilo de Luta', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:5537',
      motivo: 'Você adquire um talento Estilo de Luta à sua escolha (concessão permanente)' },
    { nivel: 3, nome: 'Canalizar Divindade', ativa: true, base: 'custo-declarado', livro: 'Classes.md:5549',
      motivo: 'Sentido Divino: Como uma Ação Bônus, você pode abrir sua consciência' },
    { nivel: 3, nome: 'Subclasse de Paladino', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:5553',
      motivo: 'Você adquire uma subclasse de Paladino à sua escolha' },
    { nivel: 4, nome: 'Aumento no Valor de Atributo', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:5565',
      motivo: 'Você adquire o talento Aumento no Valor de Atributo... (concessão permanente)' },
    { nivel: 5, nome: 'Ataque Extra', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:5569',
      motivo: 'Você pode atacar duas vezes, em vez de uma, sempre que executar a ação Atacar' },
    { nivel: 5, nome: 'Montaria Fiel', ativa: true, base: 'custo-declarado', livro: 'Classes.md:5575',
      motivo: 'restaura a capacidade de fazê-lo ao completar um Descanso Longo' },
    { nivel: 6, nome: 'Aura de Proteção', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:5581',
      motivo: 'Você e seus aliados na aura adquirem um bônus em salvaguardas igual ao seu modificador de Carisma' },
    { nivel: 9, nome: 'Repudiar Inimigos', ativa: true, base: 'custo-declarado', livro: 'Classes.md:5585',
      motivo: 'Como uma ação Usar Magia, você pode fazer um uso de Canalizar Divindade' },
    { nivel: 10, nome: 'Aura de Coragem', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:5591',
      motivo: 'Você e seus aliados têm Imunidade à condição Amedrontado enquanto estiverem em sua Aura de Proteção' },
    { nivel: 11, nome: 'Golpes Radiantes', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:5595',
      motivo: 'o alvo sofre 1d8 pontos de dano Radiante adicionais (automático ao atingir, declarado sem "você pode")' },
    { nivel: 14, nome: 'Toque Restaurador', ativa: true, base: 'custo-declarado', livro: 'Classes.md:5599',
      motivo: 'Você deve gastar 5 Pontos de Vida da reserva de cura de Mãos Consagradas para cada uma dessas condições que deseja remover' },
    { nivel: 18, nome: 'Aura Expandida', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:5603',
      motivo: 'Sua Aura de Proteção agora é uma Emanação de 9 metros' },
    { nivel: 19, nome: 'Dádiva Épica', ativa: false, base: 'ausencia-de-custo', livro: 'Classes.md:5607',
      motivo: 'Você adquire o talento Dádiva Épica... (concessão permanente)' },
  ],
};

// ============================================================
// Efeitos numéricos concedidos por característica de classe base.
// Cada entrada confirmada linha a linha no livro antes da transcrição
// (nenhuma copiada às cegas da lista de pré-voo do brief). A lista de
// pré-voo continha um item que o livro NÃO tem -- "Instinto Selvagem
// (Bárbaro)" -- ver task-3-report.md; não entrou aqui.
//
// Estilo de Luta é uma característica de classe base (Guardião nível 2,
// Guerreiro nível 1, Paladino nível 2) que concede um TALENTO da
// categoria "Estilo de Luta" -- os números das 10 variantes vivem em
// `Talentos.md`, não em `Classes.md` (a característica de classe só diz
// "você adquire um talento Estilo de Luta à sua escolha"). Por isso
// `livro` aponta para Talentos.md nessas 10 entradas.
// ============================================================
export const EFEITOS_NUMERICOS = [
  { classe: 'Bárbaro', caracteristica: 'Defesa sem Armadura', efeito: 'CA base = 10 + mod. Destreza + mod. Constituição (sem armadura)', livro: 'Classes.md:93' },
  { classe: 'Monge', caracteristica: 'Defesa sem Armadura', efeito: 'CA base = 10 + mod. Destreza + mod. Sabedoria (sem armadura/escudo)', livro: 'Classes.md:5176' },
  { classe: 'Bárbaro', caracteristica: 'Movimento Rápido', efeito: 'Deslocamento +3 metros enquanto não estiver usando Armadura Pesada', livro: 'Classes.md:129' },
  { classe: 'Monge', caracteristica: 'Movimento sem Armadura', efeito: 'Deslocamento +3 metros (escala em níveis superiores, ver tabela) enquanto não vestir armadura/escudo', livro: 'Classes.md:5202' },
  { classe: 'Guardião', caracteristica: 'Véu da Natureza', efeito: 'condição Invisível até o final do próximo turno; usos = mod. Sabedoria (mínimo 1), recarrega em Descanso Longo', livro: 'Classes.md:3356' },
  { classe: 'Bárbaro', caracteristica: 'Ataque Extra', efeito: 'ataca 2 vezes ao executar a ação Atacar', livro: 'Classes.md:125' },
  { classe: 'Guardião', caracteristica: 'Ataque Extra', efeito: 'ataca 2 vezes ao executar a ação Atacar', livro: 'Classes.md:3332' },
  { classe: 'Guerreiro', caracteristica: 'Ataque Extra', efeito: 'ataca 2 vezes ao executar a ação Atacar', livro: 'Classes.md:3852' },
  { classe: 'Guerreiro', caracteristica: 'Dois Ataques Extras', efeito: 'ataca 3 vezes ao executar a ação Atacar', livro: 'Classes.md:3866' },
  { classe: 'Guerreiro', caracteristica: 'Três Ataques Extras', efeito: 'ataca 4 vezes ao executar a ação Atacar', livro: 'Classes.md:3878' },
  { classe: 'Monge', caracteristica: 'Ataque Extra', efeito: 'ataca 2 vezes ao executar a ação Atacar', livro: 'Classes.md:5224' },
  { classe: 'Paladino', caracteristica: 'Ataque Extra', efeito: 'ataca 2 vezes ao executar a ação Atacar', livro: 'Classes.md:5569' },
  { classe: 'Feiticeiro', caracteristica: 'Feitiçaria Inata', efeito: 'CD para evitar suas magias de Feiticeiro +1; Vantagem nas jogadas de ataque de magia de Feiticeiro, por 1 minuto (2 usos, recarga em Descanso Longo)', livro: 'Classes.md:2659' },
  { classe: 'Bardo', caracteristica: 'Pau pra Toda Obra', efeito: 'metade do Bônus de Proficiência (arredondado para baixo) somada a qualquer teste de atributo sem proficiência', livro: 'Classes.md:444' },
  { classe: 'Clérigo', caracteristica: 'Ordem Divina (Taumaturgo)', efeito: 'bônus em testes de Inteligência (Arcanismo ou Religião) = mod. Sabedoria (mínimo +1)', livro: 'Classes.md:1568' },
  { classe: 'Druida', caracteristica: 'Ordem Primal (Xamã)', efeito: 'bônus em testes de Inteligência (Arcanismo ou Natureza) = mod. Sabedoria (mínimo +1)', livro: 'Classes.md:2060' },
  // Acrescentados ao levantamento de pré-voo (mesma família de efeito
  // já coberta acima -- bônus de deslocamento e bônus por modificador de
  // atributo -- ver task-3-report.md):
  { classe: 'Guardião', caracteristica: 'Errante', efeito: 'Deslocamento +3 metros enquanto não usar Armadura Pesada; Deslocamento de Escalada e de Natação iguais ao Deslocamento', livro: 'Classes.md:3336' },
  { classe: 'Paladino', caracteristica: 'Aura de Proteção', efeito: 'bônus em salvaguardas (você e aliados na Emanação de 3m) = mod. Carisma (mínimo +1)', livro: 'Classes.md:5581' },
  // Estilo de Luta -- as 10 variantes concedidas como talento por
  // Guardião (nível 2), Guerreiro (nível 1) e Paladino (nível 2).
  { classe: 'Guardião, Guerreiro, Paladino', caracteristica: 'Estilo de Luta: Arquearia', efeito: '+2 nas jogadas de ataque com armas à Distância', livro: 'Talentos.md:752' },
  { classe: 'Guardião, Guerreiro, Paladino', caracteristica: 'Estilo de Luta: Combate com Armas de Arremesso', efeito: '+2 na jogada de dano ao atingir à distância com arma de propriedade Arremesso', livro: 'Talentos.md:758' },
  { classe: 'Guardião, Guerreiro, Paladino', caracteristica: 'Estilo de Luta: Combate com Armas Grandes', efeito: 'trata qualquer 1 ou 2 em um dado de dano como 3 (arma Corpo a Corpo de duas mãos, propriedade Duas Mãos ou Versátil)', livro: 'Talentos.md:764' },
  { classe: 'Guardião, Guerreiro, Paladino', caracteristica: 'Estilo de Luta: Combate com Duas Armas', efeito: 'soma o modificador de atributo ao dano do ataque adicional de arma Leve', livro: 'Talentos.md:770' },
  { classe: 'Guardião, Guerreiro, Paladino', caracteristica: 'Estilo de Luta: Combate Desarmado', efeito: 'dano Contundente 1d6 + mod. Força no Ataque Desarmado (1d8 sem arma/Escudo); 1d4 contra alvo Imobilizado no início do turno', livro: 'Talentos.md:776' },
  { classe: 'Guardião, Guerreiro, Paladino', caracteristica: 'Estilo de Luta: Defensivo', efeito: '+1 na Classe de Armadura usando armadura Leve, Média ou Pesada', livro: 'Talentos.md:784' },
  { classe: 'Guardião, Guerreiro, Paladino', caracteristica: 'Estilo de Luta: Duelismo', efeito: '+2 nas jogadas de dano empunhando uma arma Corpo a Corpo em uma mão e nenhuma outra arma', livro: 'Talentos.md:790' },
  { classe: 'Guardião, Guerreiro, Paladino', caracteristica: 'Estilo de Luta: Interceptação', efeito: 'Reação: reduz o dano de um ataque contra aliado a até 1,5m em 1d10 + Bônus de Proficiência', livro: 'Talentos.md:796' },
  { classe: 'Guardião, Guerreiro, Paladino', caracteristica: 'Estilo de Luta: Luta às Cegas', efeito: 'Visão às Cegas com alcance de 3 metros', livro: 'Talentos.md:802' },
  { classe: 'Guardião, Guerreiro, Paladino', caracteristica: 'Estilo de Luta: Protetivo', efeito: 'Reação: impõe Desvantagem na jogada de ataque contra aliado a até 1,5m (e nas jogadas seguintes contra o alvo até o início do próximo turno)', livro: 'Talentos.md:808' },
];
