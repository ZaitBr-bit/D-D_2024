// ============================================================
// Versão do app e notas de versão.
//
// A versão exibida no header é CONTROLADA À MÃO aqui -- não vem
// mais do número de build do GitHub Actions. O build continua
// existindo e continua governando a atualização automática
// (CACHE_VERSION em sw.js, substituído no deploy); ele só não é
// mais o que o usuário vê.
//
// Para lançar uma versão nova: acrescente a entrada NO TOPO de
// NOTAS_VERSAO e atualize VERSAO_ATUAL para a mesma string. As duas
// precisam bater -- há teste que cobra isso.
// ============================================================

/** Versão exibida no header e marcada como atual na lista de notas. */
export const VERSAO_ATUAL = '2.2.2';

// Cada entrada é uma versão. `melhorias` e `correcoes` são listas de
// grupos, e cada grupo tem um título curto e seus itens. O emoji do
// grupo entra no próprio título -- é o que separa visualmente melhoria
// de correção sem depender de cor.
export const NOTAS_VERSAO = [
  {
    versao: '2.2.2',
    data: '2026-08-17',
    resumo: 'Correções da 2.2.1: as duas assinaturas mágicas do Mago, e a '
      + 'reserva de d12 do Bárbaro Fanático voltando no Descanso Longo.',
    correcoes: [
      {
        grupo: '🐛 Correções',
        itens: [
          'Assinatura Mágica: dava para marcar a MESMA magia nas duas vagas, '
            + 'e o resultado ficava com uma assinatura só — parecia que o app '
            + 'deixava escolher apenas 1. Agora, ao escolher uma magia, ela '
            + 'fica bloqueada na outra vaga.',
          'Bárbaro Trilha do Fanático: a reserva de d12 do Campeão dos Deuses '
            + 'não voltava em Descanso Longo nenhum. Como o app também não '
            + 'tinha outro jeito de recuperar esses dados, na prática a '
            + 'reserva era de uso único por personagem.',
        ],
      },
    ],
  },
  {
    versao: '2.2.1',
    data: '2026-08-16',
    resumo: 'O Trapaceiro Arcano e o Cavaleiro Místico finalmente recebem '
      + 'magias e espaços ao chegar no nível 3.',
    melhorias: [
      {
        grupo: '✋ Mãos Mágicas automática',
        itens: [
          'O Trapaceiro Arcano recebe Mãos Mágicas junto com a Conjuração, '
            + 'como manda o livro, e escolhe só os outros 2 truques. Ela '
            + 'conta no seu limite de truques e não pode ser trocada.',
        ],
      },
      {
        grupo: '📖 Mago: as magias agora são escolhidas',
        itens: [
          'Assinatura Mágica (nível 20) pergunta QUAIS são as suas duas '
            + 'magias de 3º círculo. Antes havia só os botões "Assinatura 1" '
            + 'e "Assinatura 2", sem nunca escolher a magia; agora cada botão '
            + 'tem o nome da sua magia.',
          'Maestria de Magias (nível 18) pede a magia de 1º e a de 2º círculo '
            + 'do seu livro (só as de tempo de conjuração "Ação", como o livro '
            + 'exige). Antes não pedia nada.',
          'As magias das duas características entram como sempre preparadas e '
            + 'não ocupam vaga do seu limite de magias preparadas.',
          'Memorizar Magia (nível 5) aparece no Descanso Curto, com o botão '
            + 'para trocar 1 magia preparada por outra do seu livro. Antes era '
            + 'só um texto na ficha.',
        ],
      },
      {
        grupo: '🩹 Fichas que já estavam sem magia',
        itens: [
          'Quem já tinha subido para o nível 3 e ficou sem nada agora vê, na '
            + 'seção Magias, quantas vagas de truque e de magia conhecida '
            + 'estão em aberto, com um botão para escolher cada uma.',
        ],
      },
    ],
    correcoes: [
      {
        grupo: '🐛 Correções',
        itens: [
          'Ao escolher Trapaceiro Arcano ou Cavaleiro Místico no nível 3, a '
            + 'subida de nível não mostrava nenhuma tela de magias: o '
            + 'personagem chegava ao nível 3 sem truque e sem magia nenhuma. '
            + 'Agora a tela aparece assim que a subclasse é escolhida, já com '
            + 'a lista de Mago.',
          'O Trapaceiro Arcano não ganhava espaço de magia nenhum ao subir de '
            + 'nível, e o Cavaleiro Místico só ganhava a partir do nível 4.',
          'No modal "Consultar Magias" do Trapaceiro Arcano, os contadores '
            + 'mostravam "0/0" e a lista inteira aparecia bloqueada.',
          'O botão "Definir Maestrias" do Ladino não abria nada (nem pela '
            + 'ficha, nem pelo "Trocar Maestrias" do Descanso Longo): a tela '
            + 'quebrava ao ler as propriedades da arma.',
          'A lista de maestrias do Ladino deixava de fora as armas Marciais '
            + 'de propriedade Leve, como a Besta de Mão, que ele tem '
            + 'proficiência para usar.',
        ],
      },
    ],
  },
  {
    versao: '2.2.0',
    data: '2026-08-14',
    resumo: 'A tela de adicionar item ficou igual na criação e na ficha — e as '
      + 'duas ganharam o que só uma tinha.',
    melhorias: [
      {
        grupo: '🎒 Uma tela só para adicionar item',
        itens: [
          'Na criação de personagem, os botões "+ Arma", "+ Armadura" e '
            + '"+ Item" viraram um só: "+ Item", com as categorias Armas, '
            + 'Armaduras, Consumíveis, Munição e Equipamento — a mesma tela '
            + 'que a ficha já usava.',
          'Munição (flechas, virotes, agulhas, balas) agora existe na criação. '
            + 'Antes não havia como adicionar nenhuma antes de terminar o '
            + 'personagem.',
          'Dá para gastar o ouro inicial durante a criação: o "💰 Comprar" '
            + 'desconta da carteira. Ele começa desligado.',
          'Na criação, agora dá para escolher a quantidade, e itens repetidos '
            + 'se agrupam em vez de virar várias linhas.',
        ],
      },
      {
        grupo: '🔎 Achar o item certo ficou mais fácil',
        itens: [
          'A ficha ganhou o filtro de armas (Todas, Proficientes, Simples, '
            + 'Marcial), que só existia na criação.',
          'As armaduras ganharam filtro por tipo (Leve, Média, Pesada) nas '
            + 'duas telas.',
          'Armadura que exige mais Força do que você tem agora aparece '
            + 'marcada com um aviso — em vez de você descobrir depois. '
            + 'Continua sendo possível pegá-la.',
          'A busca deixou de olhar só o nome: procurar por "acuidade", '
            + '"versátil" ou "1d8" agora encontra.',
        ],
      },
    ],
    correcoes: [
      {
        grupo: '🐛 Correções',
        itens: [
          'As 20 flechas do equipamento inicial do Guardião e do Ladino '
            + 'entravam sem peso e não contavam na sua carga.',
          'Na criação, itens do inventário mostravam menos detalhe que na '
            + 'ficha: escudo aparecia sem a CA e arma sem as propriedades.',
        ],
      },
    ],
  },
  {
    versao: '2.1.1',
    data: '2026-08-13',
    resumo: 'Talento adicionado pelo "+ Talento" passa a valer na hora, e '
      + 'conjuradores podem trocar truque e magia em mais situações.',
    melhorias: [
      {
        grupo: '🔄 Trocar truque e magia',
        itens: [
          'No Descanso Longo, qualquer classe conjuradora agora pode trocar '
            + '1 truque por outro da lista da classe. Antes essa troca só '
            + 'existia na subida de nível.',
          'Ao subir de nível, a troca de 1 magia passou a aparecer também '
            + 'para Clérigo, Druida, Guardião, Mago e Paladino, e para o '
            + 'Cavaleiro Místico e o Trapaceiro Arcano. Antes era só para '
            + 'Bardo, Bruxo e Feiticeiro.',
          'O Mago troca a magia dentro do próprio grimório — não dá para '
            + 'preparar uma magia que não está no livro dele.',
        ],
      },
      {
        grupo: '✋ Telecinético',
        itens: [
          'Quem já conhece Mãos Mágicas e pega o talento Telecinético agora '
            + 'escolhe outro truque da lista de Mago no lugar. Antes o '
            + 'talento não concedia truque nenhum a esse personagem — o caso '
            + 'mais comum é o Trapaceiro Arcano, que já vem com Mãos Mágicas.',
        ],
      },
    ],
    correcoes: [
      {
        grupo: '🐛 Correções',
        itens: [
          'Talento adicionado pelo botão "+ Talento" da ficha não aplicava '
            + 'nenhum efeito até recarregar a página. O Alerta não somava o '
            + 'bônus na Iniciativa; o mesmo valia para a CA (Mestre em '
            + 'Armaduras Médias), o deslocamento (Velocista, Dádiva da '
            + 'Velocidade), a maestria extra do Mestre das Armas, o painel do '
            + 'Sortudo e as CDs de Envenenador e Telecinético.',
          'Em listas longas dentro de uma janela — o "Adicionar Talento", por '
            + 'exemplo — o círculo de seleção de um card aparecia solto por '
            + 'cima dos botões Cancelar/Adicionar e do "X" de fechar. Além de '
            + 'feio, o toque nesse ponto não chegava ao botão.',
        ],
      },
    ],
  },
  {
    versao: '2.1.0',
    data: '2026-08-13',
    resumo: 'Todas as escolhas viraram cards: dá para ler o que cada opção faz '
      + 'antes de escolher.',
    melhorias: [
      {
        grupo: '🎴 Escolher ficou mais fácil',
        itens: [
          'Talentos, estilos de luta, maestrias, manobras, magias e truques '
            + 'agora aparecem em cards, com o nome por extenso e um resumo. '
            + 'Antes eram listas e caixinhas sem explicação.',
          'Cada card tem "ver detalhes", que abre a descrição completa numa '
            + 'janela — sem empurrar o resto da tela para baixo.',
          'Listas grandes ganharam busca e filtros rápidos.',
          'Ao escolher perícia, agora aparece o atributo que ela usa.',
          'Os botões de cancelar e confirmar ficam fixos no rodapé, sem '
            + 'precisar rolar até o fim.',
          'Na subida de nível, escolher um talento recolhe a lista e deixa à '
            + 'vista o que ainda falta preencher.',
        ],
      },
    ],
    correcoes: [
      {
        grupo: '🐛 Correções',
        itens: [
          'O talento Conjurador Ritualista não deixava escolher as magias '
            + 'rituais: a lista aparecia vazia e não dava para concluir.',
          '"Ver detalhes" às vezes abria mais de uma janela ao mesmo tempo.',
        ],
      },
    ],
  },
  {
    versao: '2.0.1',
    data: '2026-08-12',
    resumo: 'Corrige a criação de personagem quando a classe e o antecedente '
      + 'disputam as mesmas perícias.',
    melhorias: [],
    correcoes: [
      {
        grupo: '🐛 Criação de personagem',
        itens: [
          'A criação podia travar de vez na etapa de atributos: quando as '
            + 'escolhas do antecedente tomavam as perícias de que a classe '
            + 'ainda precisava, sobravam menos opções do que o exigido e o '
            + 'botão de avançar nunca aceitava. Acontecia, por exemplo, com '
            + 'Clérigo e o antecedente Nobre, e não havia nada na tela '
            + 'explicando o motivo — só trocar de antecedente resolvia.',
          'A mesma perícia podia entrar duas vezes na ficha, uma pela classe e '
            + 'outra pelo antecedente, desperdiçando uma das escolhas da '
            + 'classe. A lista de perícias da classe agora só oferece o que '
            + 'você ainda não tem.',
          'As escolhas livres (talento Habilidoso, Hábil do Humano e Memória '
            + 'Kenku) deixaram de oferecer a última perícia de que a lista da '
            + 'classe ainda precisa, para que a classe nunca fique sem opções.',
          'O talento Habilidoso concedido por um antecedente oferecia as '
            + 'próprias perícias daquele antecedente (História e Persuasão, no '
            + 'Nobre), deixando gastar uma das três escolhas sem ganhar nada.',
          'As perícias do antecedente passaram a entrar na ficha assim que o '
            + 'antecedente é confirmado; antes só entravam depois que o '
            + 'jogador marcasse alguma perícia da classe.',
        ],
      },
    ],
  },
  {
    versao: '2.0.0',
    data: '2026-08-08',
    resumo: 'Primeira versão com numeração própria. Reúne tudo que mudou desde '
      + 'a reorganização interna do site.',
    melhorias: [
      {
        grupo: '✨ Confiabilidade das regras',
        itens: [
          'O site passou a ser conferido automaticamente contra o livro, e não '
            + 'só comparado com a versão antiga — erros que existiam nos dois '
            + 'lados passaram a aparecer.',
          'A conferência cobre talentos, antecedentes, as fórmulas da ficha e '
            + 'as 12 classes nos 20 níveis, sem amostragem.',
        ],
      },
      {
        grupo: '📴 Uso offline',
        itens: [
          'Todos os módulos do site passaram a ficar disponíveis offline. '
            + 'Antes, só 18,3% ficavam, e o site podia falhar sem internet.',
        ],
      },
      {
        grupo: '🧭 Notas de versão',
        itens: [
          'O site passou a ter numeração própria, controlada manualmente, e '
            + 'esta tela de notas para acompanhar o que muda a cada versão.',
        ],
      },
    ],
    correcoes: [
      {
        grupo: '🐛 Talentos',
        itens: [
          'Habilidoso, Artifista e Músico não abriam as opções de escolha ao '
            + 'serem adicionados pelo botão "+ Talento" da ficha — o talento '
            + 'era gravado sem conceder nenhuma proficiência.',
          'Mestre das Armas não oferecia a escolha de arma que o livro exige.',
          'Adepto Elemental oferecia tipos de dano com nomes errados '
            + '(Frio/Fogo/Trovão no lugar de Gélido/Ígneo/Trovejante).',
          'Analítico oferecia Medicina no lugar de Percepção.',
          'Adepto Elemental, Analítico e Mente Aguçada deixavam concluir a '
            + 'subida de nível sem preencher a escolha obrigatória.',
          'Talentos deixaram de reoferecer escolhas que não concederiam nada '
            + '— proficiência que o personagem já tem, por exemplo.',
        ],
      },
      {
        grupo: '🐛 Antecedentes',
        itens: [
          'A ferramenta ou instrumento concedido pelo antecedente nunca virava '
            + 'proficiência de verdade no personagem.',
          'O item do pacote de equipamento descrito como "o mesmo que acima" '
            + 'entrava no inventário com esse texto, em vez da ferramenta que '
            + 'o jogador escolheu.',
        ],
      },
      {
        grupo: '🐛 Classes e subida de nível',
        itens: [
          'O Guerreiro agora pode trocar o Estilo de Luta ao subir de nível, '
            + 'como o livro permite.',
          'O Ladino recebe a Especialização em mais duas perícias no nível 6.',
          'O Ladino passou a ter proficiência com armas Marciais de propriedade '
            + 'Leve, e não só Acuidade — na prática, a Besta de Mão deixou de '
            + 'aparecer como "Sem Prof".',
          'O Clérigo Taumaturgo e o Druida Xamã recebem o truque extra também '
            + 'na ficha e no grimório; antes a ficha mostrava "Truques: 4/3" e '
            + 'bloqueava a escolha.',
          'O card de subida de nível e a ficha do Clérigo no nível 3 exibiam '
            + '"Subclasse de Clérigo"; o texto correto (como na tabela do '
            + 'livro) é "Subclasse Clérigo".',
        ],
      },
      {
        grupo: '🐛 Estilos de Luta',
        itens: [
          'Cinco dos dez Estilos de Luta não mostravam efeito nenhum na ficha, '
            + 'porque o nome gravado e o nome exibido eram vocabulários '
            + 'diferentes.',
          'Combate com Armas Grandes exibia a regra antiga ("re-rolar 1 ou 2") '
            + 'em vez da atual ("tratar 1 ou 2 como 3").',
          'Combate com Armas Grandes e Combate com Duas Armas não indicavam o '
            + 'benefício em arma nenhuma da ficha.',
          'Luta às Cegas descrevia um alcance que o livro não concede.',
        ],
      },
      {
        grupo: '🐛 Magias',
        itens: [
          'O Mago deixava de conseguir copiar magias de círculos mais altos '
            + 'para o grimório quando o 1º e o 2º círculo já somavam muitas '
            + 'opções — o círculo simplesmente não aparecia na lista, mesmo '
            + 'com espaço de magia disponível para ele.',
        ],
      },
    ],
  },
];
