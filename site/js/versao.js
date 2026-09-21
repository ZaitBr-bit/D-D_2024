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
export const VERSAO_ATUAL = '3.0.14';

// Cada entrada é uma versão. `melhorias` e `correcoes` são listas de
// grupos, e cada grupo tem um título curto e seus itens. O emoji do
// grupo entra no próprio título -- é o que separa visualmente melhoria
// de correção sem depender de cor.
export const NOTAS_VERSAO = [
  {
    versao: '3.0.14',
    data: '2026-09-20',
    rotulo: 'Preparar Magias sempre',
    resumo: 'O modal "Preparar Magias" agora abre sozinho ao fechar '
      + 'qualquer subida de nível que dê vagas de magia preparada novas '
      + 'para uma classe preparadora (Clérigo/Druida/Paladino/Guardião) '
      + '-- não só ao entrar na classe pela primeira vez.',
    correcoes: [
      {
        grupo: '🐛 Correções',
        itens: [
          'A correção da 3.0.13 só abria "Preparar Magias" automaticamente '
            + 'quando a classe entrava NOVA via multiclasse -- uma subida '
            + 'de nível comum (mesma classe, inclusive classe única, ex.: '
            + 'Clérigo indo do nível 1 para o 2) não abria o modal, mesmo '
            + 'ganhando vagas de magia preparada novas. (#59)',
        ],
      },
    ],
  },
  {
    versao: '3.0.13',
    data: '2026-09-20',
    rotulo: 'Ordem Divina multiclasse',
    resumo: 'Multiclasse Clérigo/Druida passa a pedir a escolha de Ordem '
      + 'Divina/Primal ao entrar na classe, igual o criador sempre pediu. '
      + 'Além disso, entrar numa classe conjuradora preparadora nova '
      + '(Clérigo, Druida, Paladino ou Guardião) abre "Preparar Magias" '
      + 'automaticamente ao fechar o resumo da subida.',
    correcoes: [
      {
        grupo: '🐛 Correções',
        itens: [
          'Entrar em Clérigo ou Druida pela primeira vez num multiclasse '
            + 'nunca pedia a escolha de Ordem Divina/Ordem Primal (Protetor/'
            + 'Taumaturgo, Protetor/Xamã) — o criador sempre pediu isso para '
            + 'quem começa nessas classes, mas o assistente de subida de '
            + 'nível nunca oferecia a mesma escolha. Sem ela, o personagem '
            + 'ficava sem a proficiência do Protetor e sem o truque extra do '
            + 'Taumaturgo/Xamã. (#59)',
          'Como consequência da correção acima, o cálculo de truques '
            + 'ganhos no assistente agora soma corretamente o bônus do '
            + 'Taumaturgo/Xamã quando a Ordem é escolhida na MESMA subida '
            + 'que a classe entra — antes esse bônus só valia quando a '
            + 'Ordem já vinha da criação. (#59)',
        ],
      },
    ],
    melhorias: [
      {
        grupo: '✨ Melhorias',
        itens: [
          'Ao fechar o resumo de uma subida que trouxe uma classe '
            + 'conjuradora PREPARADORA nova (Clérigo, Druida, Paladino ou '
            + 'Guardião), o modal "Preparar Magias" abre sozinho, mirando a '
            + 'classe que acabou de entrar — antes o jogador tinha de '
            + 'lembrar de ir na ficha manualmente. (#59)',
        ],
      },
    ],
  },
  {
    versao: '3.0.12',
    data: '2026-09-20',
    rotulo: 'Truque e maestria',
    resumo: 'Descrição de Aprimoramento de Truque não mostra mais o rótulo '
      + 'de upcast de magia normal, e a badge de maestria de arma '
      + 'personalizada só aparece depois de escolhida de verdade no modal '
      + '"Definir Maestrias" -- a arma personalizada com categoria agora '
      + 'entra nessa lista. O detalhe de uma arma personalizada também '
      + 'ganhou a descrição formatada de propriedade e maestria, como uma '
      + 'arma do livro.',
    correcoes: [
      {
        grupo: '🐛 Correções',
        itens: [
          'A descrição de "Aprimoramento de Truque" vinha com o rótulo '
            + 'fixo "Em círculos superiores" na frente -- o mesmo rótulo '
            + 'de upcast que magia de círculo 1+ usa, contraditório pra '
            + 'truque, que não sobe de círculo. (#97)',
        ],
      },
    ],
    melhorias: [
      {
        grupo: '✨ Melhorias',
        itens: [
          'Arma personalizada com categoria (issue #82) agora entra na '
            + 'lista de escolha do modal "Definir Maestrias" -- a badge '
            + '"Maestria: X" deixou de aparecer incondicionalmente e só '
            + 'aparece depois de escolhida de verdade, igual a uma arma '
            + 'de catálogo. (#96)',
          'O detalhe de uma arma personalizada (clique no item, no '
            + 'inventário) passou a mostrar a descrição de cada '
            + 'propriedade e da maestria, formatada como a de uma arma '
            + 'do livro. (#96)',
        ],
      },
    ],
  },
  {
    versao: '3.0.11',
    data: '2026-09-20',
    rotulo: 'Grimório e rótulos',
    resumo: 'Botão de item personalizado com rótulo claro, opções de troca '
      + 'de truque/magia no level-up nascendo minimizadas, e magia '
      + 'personalizada "ocupa vaga" do Mago volta a ter caminho pago de '
      + 'cópia para o grimório quando sai dele.',
    melhorias: [
      {
        grupo: '✨ Melhorias',
        itens: [
          'O botão "+ Custom" do inventário passou a dizer "+ Item '
            + 'Personalizado" — rótulo mais claro, sem mudar o que o botão '
            + 'faz. (#84)',
          'As opções de "Trocar Magias"/"Trocar Truques" do assistente de '
            + 'level-up nascem minimizadas por padrão — antes ficavam '
            + 'sempre abertas, mesmo quando o jogador não ia trocar nada. '
            + '(#90)',
          'Mago: magia personalizada que "ocupa vaga" (não é sempre '
            + 'preparada) e caiu do grimório volta a aparecer na lista paga '
            + 'de "Copiar Magia para o Grimório" (50 PO/círculo, modelo da '
            + '3.0.1) — antes só voltava pelo toggle grátis do formulário '
            + 'de edição. A personalizada "sempre preparada" (nunca sai do '
            + 'grimório) continua fora dessa lista. (#77)',
        ],
      },
    ],
  },
  {
    versao: '3.0.10',
    data: '2026-09-20',
    rotulo: 'Item com bônus',
    resumo: 'Cinco correções (teto de atributo da Edição livre, scroll do '
      + 'PV Max, sub-modal por cima do rodapé, PV do talento Vigoroso '
      + 'atualizado na hora, e seletor de forma da Revelação Celestial do '
      + 'Aasimar) e duas melhorias: item personalizado agora pode ser uma '
      + 'arma de verdade (categoria/propriedades/maestria) e conceder '
      + 'bônus de ataque/CD de magia, e a lista de magias personalizadas '
      + 'não preparadas passa a nascer minimizada e organizada por círculo.',
    correcoes: [
      {
        grupo: '🐛 Correções',
        itens: [
          'Edição livre de atributos: o teto de validação ficava em 20, '
            + 'mesmo quando a própria tela pré-preenche o valor FINAL do '
            + 'atributo — um Bárbaro com Campeão Primitivo (Força/'
            + 'Constituição até 25, capstone de nível 20) não conseguia '
            + 'salvar edição nenhuma. Teto subiu para 30. (#85)',
          'Modais com lista de rolagem numérica (ex.: "PV Max"): o valor '
            + 'inicial acima do que o picker renderiza (min+49) era '
            + 'sobrescrito por engano ao abrir o modal, silenciosamente. '
            + 'Agora só um toque de verdade no picker altera o valor. (#86)',
          'Sub-modal "Configurar Talento" (ex.: escolher arma de Mestre '
            + 'das Armas): o círculo de seleção do último card vazava por '
            + 'cima dos botões fixos do rodapé. (#87)',
          'Talento Vigoroso: o PV máximo só recalculava no PRÓXIMO render '
            + 'da ficha, não na hora da subida de nível — a própria modal '
            + '"Subida de Nível Concluída" podia mostrar um total '
            + 'desatualizado antes de fechar. (#89)',
          'Revelação Celestial (Aasimar nível 3): a característica-mãe '
            + 'caía no toggle genérico, sem seletor para escolher entre '
            + 'Asas Celestiais/Manto Necrótico/Transfiguração Radiante — '
            + 'nenhuma das três aplicava efeito mecânico nenhum. Agora tem '
            + 'seletor de forma, e Asas Celestiais concede o deslocamento '
            + 'de voo. (#91)',
        ],
      },
    ],
    melhorias: [
      {
        grupo: '✨ Item personalizado com bônus mecânico',
        itens: [
          'Item personalizado ganhou categoria de arma (simples/marcial), '
            + 'propriedades e maestria — com isso, entra no MESMO cálculo '
            + 'de proficiência/ataque/dano que uma arma de catálogo, em '
            + 'vez de só mostrar o bônus bruto digitado. (#82, #37)',
          'Item personalizado ganhou bônus de ataque de magia e de CD de '
            + 'magia, que somam nos números da ficha quando o item está '
            + 'equipado (e sintonizado, se exigir sintonização). (#37)',
          'A lista de magias personalizadas não preparadas passa a '
            + 'agrupar por círculo, com um botão de minimizar por círculo '
            + '(mesmo padrão visual da lista de Preparadas), e a seção '
            + 'inteira nasce minimizada por padrão. (#75, #92)',
        ],
      },
    ],
  },
  {
    versao: '3.0.9',
    data: '2026-09-20',
    rotulo: 'Mais botões Grátis',
    resumo: 'Magias concedidas por Contatar Patrono, Destruição do '
      + 'Paladino, Montaria Fiel, Inimigo Favorito, Reforços Feéricos, '
      + 'Andarilho Nebuloso e Mapa Estelar ganham o botão "Grátis" na '
      + 'lista de Magias; Criaturas Espectrais (Ilusionista) e Manto de '
      + 'Majestade (Bardo) migram do botão próprio no painel de '
      + 'Características para o mesmo botão único.',
    correcoes: [
      {
        grupo: '🐛 Correções',
        itens: [
          'Truques/magias concedidos por características de classe ou '
            + 'subclasse com uso grátis limitado (Contatar Patrono do '
            + 'Bruxo, Destruição do Paladino, Montaria Fiel, Inimigo '
            + 'Favorito e Reforços Feéricos/Andarilho Nebuloso do '
            + 'Guardião, Mapa Estelar da Druida do Círculo das Estrelas) '
            + 'não tinham o botão "Grátis" na lista principal de Magias — '
            + 'agora têm, com contagem certa mesmo quando o uso é '
            + 'múltiplo ou escala pelo modificador de um atributo. (#76)',
          'Criaturas Espectrais (Ilusionista), Manto de Majestade (Bardo '
            + 'do Colégio do Glamour) e Destruição do Paladino tinham um '
            + 'botão PRÓPRIO no card de Características de Classe que só '
            + 'avisava "conjurado gratuitamente" sem conjurar de verdade '
            + 'nem concordar com o botão "Grátis" da lista de Magias — dava '
            + 'para clicar os dois e conjurar de graça mais vezes do que o '
            + 'livro permite. Os botões antigos foram removidos; o '
            + 'controle agora vive só na lista de Magias. (#76)',
        ],
      },
    ],
  },
  {
    versao: '3.0.8',
    data: '2026-09-18',
    rotulo: 'Correções da comunidade',
    resumo: 'Botão de item personalizado sem cortar no inventário, e o '
      + 'talento Aumento no Valor de Atributo pelo botão "+ Talento" da '
      + 'ficha volta a exigir os 2 pontos de distribuição do livro.',
    correcoes: [
      {
        grupo: '🐛 Correções',
        itens: [
          'Inventário: o botão "+ Custom" podia espremer e cortar texto em '
            + 'telas estreitas, disputando espaço com "+ Item" e a carteira '
            + 'na mesma linha sem quebrar. Agora o grupo de botões quebra '
            + 'linha quando necessário, e nenhum botão da ficha encolhe '
            + 'abaixo do próprio texto. (#81)',
          '"+ Talento" da ficha: adicionar Aumento no Valor de Atributo não '
            + 'pedia a distribuição de 2 pontos do livro (+2 num atributo, '
            + 'ou +1 em dois) — usava por engano o mesmo select de "+1 '
            + 'automático" de talentos como Resiliente, concedendo só a '
            + 'metade do que o talento dá. Agora exige e aplica a '
            + 'distribuição certa, igual à subida de nível. (#67)',
          'Mago: a magia personalizada escolhida para Maestria de Magias '
            + 'ou Assinatura Mágica não mostrava descrição ao clicar "ver '
            + 'detalhes" quando também ocupava vaga no grimório — o '
            + 'grimório guarda só nome e círculo, e a tela buscava a '
            + 'descrição no acervo real, que não conhece magia inventada. '
            + 'Agora usa a descrição da própria personalizada. (#78)',
          'Multiclasse: um Mago com Clérigo (ou qualquer outra classe '
            + 'conjuradora) tinha as magias preparadas PELA OUTRA classe '
            + 'copiadas para dentro do grimório do Mago — a limpeza da '
            + 'ficha varria toda magia preparada de círculo 1+ sem olhar '
            + 'de qual classe ela era. Agora só copia o que está '
            + 'carimbado com a classe certa. (#62)',
        ],
      },
    ],
  },
  {
    versao: '3.0.7',
    data: '2026-09-18',
    rotulo: 'Grátis e organização',
    resumo: 'Magias de Maestria de Magias e Assinatura Mágica ganham o '
      + 'botão "Grátis" direto na lista de Preparadas, a magia '
      + 'personalizada não preparada sai para uma seção própria, os '
      + 'traços de espécie ganham selo de nível, agora dá para liberar '
      + 'uma vaga na hora ao marcar uma magia (ou truque) personalizada '
      + 'para ocupar espaço, e o truque personalizado ganhou a mesma '
      + 'opção.',
    melhorias: [
      {
        grupo: '✨ Grátis na lista principal',
        itens: [
          'As magias escolhidas para Maestria de Magias e Assinatura '
            + 'Mágica agora têm o botão "Grátis" junto delas na lista '
            + 'principal de Preparadas — antes só dava para conjurá-las '
            + 'sem gastar espaço pelo painel de recursos do Mago, lá em '
            + 'cima da ficha, obrigando a rolar a tela toda vez. Maestria '
            + 'de Magias continua à vontade (nunca esgota); Assinatura '
            + 'Mágica continua esgotando por magia, 1x por Descanso Curto '
            + 'ou Longo — os dois lugares mostram sempre o mesmo estado. '
            + '(#68)',
        ],
      },
      {
        grupo: '✨ Personalizada não preparada, fora da lista principal',
        itens: [
          'A magia personalizada que ocupa vaga mas ainda não foi '
            + 'preparada (o Mago que ainda não a copiou do grimório, ou '
            + 'outra classe que a tirou pelo "x" das preparadas) saía '
            + 'misturada dentro da lista de círculo, marcada "Não '
            + 'preparada" — agora ela tem uma seção própria, separada do '
            + 'que está realmente pronto para conjurar, mantendo os '
            + 'botões de editar e remover. (#71)',
        ],
      },
      {
        grupo: '✨ Liberar vaga na hora para a magia personalizada',
        itens: [
          'Ao desmarcar "sempre preparada" numa magia personalizada sem '
            + 'ter vaga livre no limite da classe, a ficha não recusa mais '
            + 'de vez — abre um modal para você escolher qual magia '
            + 'preparada libera o lugar. A escolhida sai da lista, e a '
            + 'personalizada entra no lugar dela, sem precisar fechar o '
            + 'formulário e ir despreparar algo em outra tela primeiro. '
            + '(#74)',
        ],
      },
      {
        grupo: '✨ Traços de Espécie: nível e sem separação Ativa/Passiva',
        itens: [
          'Cada traço de espécie agora mostra o selo com o nível em que '
            + 'foi concedido, e o card parou de separar Habilidades '
            + 'Ativas/Passivas em duas seções — mesmo ajuste já feito nas '
            + 'Características de Classe (versão 3.0.6): a lista fica '
            + 'única, na ordem do livro, com o selo Ativa/Passiva mantido '
            + 'em cada card. (#73)',
        ],
      },
      {
        grupo: '✨ Truque personalizado também pode ocupar vaga',
        itens: [
          'O truque personalizado ganhou a mesma opção que a magia de '
            + 'círculo 1º ou superior já tinha: ao criar ou editar, '
            + 'escolha entre "sempre conhecido" (fora do limite de '
            + 'truques da classe, como hoje) ou "ocupa vaga" — ele entra '
            + 'na sua lista de truques conhecidos de verdade, contando no '
            + 'limite. Sem vaga livre, o mesmo modal de liberar vaga da '
            + 'magia aparece para truque também, oferecendo trocar por um '
            + 'truque conhecido. (comentário na #74)',
        ],
      },
    ],
  },
  {
    versao: '3.0.6',
    data: '2026-09-17',
    rotulo: 'Correções e idiomas',
    resumo: 'Nome de armadura corrigido, truque do Ilusionista deixa de '
      + 'sumir ao ser trocado, características ordenadas por nível na '
      + 'ficha, e agora dá para adicionar ou remover idiomas depois da '
      + 'criação.',
    correcoes: [
      {
        grupo: '🐛 Correções',
        itens: [
          'O catálogo de armaduras guardava "Placas" e "Placas Parcial" '
            + 'sem o prefixo "Armadura de", que é o nome completo do livro. '
            + 'Corrigido para "Armadura de Placas" e "Armadura de Placas '
            + 'Parcial". Personagens que já tinham a armadura equipada não '
            + 'mudam sozinhos — só armaduras adicionadas depois desta '
            + 'versão usam o nome novo. (#64)',
          'Ilusionista: o truque de Ilusões Aprimoradas (Ilusão Menor, ou '
            + 'o substituto escolhido por já conhecê-la) aparecia na aba '
            + '"Truques" como um truque de classe comum, sem o selo de '
            + 'travado que um truque de espécie tem. Clicar nele o '
            + 'removia da ficha para sempre, deixando o personagem com um '
            + 'truque a menos permanentemente. (#63)',
        ],
      },
    ],
    melhorias: [
      {
        grupo: '✨ Características por nível, não por seção',
        itens: [
          'O card "Características de Classe" (e o de Subclasse) parou de '
            + 'separar Habilidades Ativas e Habilidades Passivas em duas '
            + 'seções — a separação empurrava característica ativa de '
            + 'nível alto para cima de passiva de nível baixo (ex.: '
            + 'Assinatura Mágica do Mago, nível 20, aparecia acima de '
            + 'Acadêmico, nível 2). Agora é uma lista única, na ordem em '
            + 'que o livro apresenta; cada característica continua com o '
            + 'selo Ativa/Passiva. (#60)',
        ],
      },
      {
        grupo: '✨ Idiomas editáveis',
        itens: [
          'O modal "Editar ficha" ganhou uma aba "Idiomas": marque ou '
            + 'desmarque livremente qualquer idioma do catálogo do livro '
            + '(Comuns e Raros), ou adicione qualquer outro nome pelo '
            + 'campo de texto — útil para idiomas de suplementos ou '
            + 'homebrew que não estão no catálogo. Sem limite de '
            + 'quantidade: a regra de orçamento da criação vale só ali. '
            + '(#58)',
        ],
      },
    ],
  },
  {
    versao: '3.0.5',
    data: '2026-09-15',
    rotulo: 'Vaga opcional',
    resumo: 'A magia personalizada volta a poder ocupar vaga de verdade, se '
      + 'você quiser — e agora entra também na lista de Maestria de Magias e '
      + 'Assinatura Mágica do Mago.',
    correcoes: [
      {
        grupo: '🐛 Correções',
        itens: [
          'Mago: Maestria de Magias (nível 18) e Assinatura Mágica (nível '
            + '20) não enxergavam mais a sua magia personalizada depois que '
            + 'ela deixou de morar no grimório (versão 3.0.3). Agora ela '
            + 'aparece como candidata, junto das magias do seu grimório. (#49)',
          'Mago: renomear uma magia personalizada que já ocupava vaga e já '
            + 'estava preparada podia deixar uma cópia com o nome antigo '
            + 'presa na sua lista de preparadas, ocupando uma vaga fantasma. '
            + 'Agora o rename também atualiza essa cópia.',
        ],
      },
    ],
    melhorias: [
      {
        grupo: '✨ Magia personalizada: vaga opcional',
        itens: [
          'Ao criar ou editar uma magia personalizada de 1º círculo ou '
            + 'superior, você escolhe se ela fica sempre preparada e fora do '
            + 'limite (o padrão desde a 3.0.3) ou se ocupa uma vaga de '
            + 'verdade — entrando na lista de escolha do seu círculo, como '
            + 'uma magia do livro. Útil para magias de outros suplementos que '
            + 'não estão no catálogo do app. (#50, #54)',
          'Desmarcando "sempre preparada", a magia entra no seu grimório '
            + '(Mago) ou na sua lista de preparadas (demais classes '
            + 'conjuradoras), e passa a contar no limite normalmente. Com o '
            + 'limite de magias preparadas da classe já cheio, a troca é '
            + 'recusada com aviso — nada fica "ocupando vaga" sem realmente '
            + 'ocupar.',
          'Na ficha e no PDF ela aparece em UMA linha só, no bloco do seu '
            + 'círculo: com os botões de editar e remover de sempre, sem o '
            + 'selo de "sempre preparada" e sem a cópia duplicada que '
            + 'aparecia antes. Enquanto não estiver preparada (Mago que '
            + 'ainda não a preparou do grimório, por exemplo), a linha sai '
            + 'marcada como "Não preparada".',
        ],
      },
    ],
  },
  {
    versao: '3.0.4',
    data: '2026-09-09',
    rotulo: 'Consertos e melhorias',
    resumo: 'Três consertos antigos — os "?" ao redor dos dados no PDF, '
      + '"Trocar Maestrias" abrindo por cima da troca de magia no Descanso '
      + 'Longo, e a Fúria sem o selo de Vantagem nas perícias do Conhecimento '
      + 'Primordial — e um conjunto de melhorias: no PDF, a mochila e os '
      + 'detalhes do personagem saem organizados em blocos; e o item que você '
      + 'mesmo cria pode ter raridade, preço e sintonização, com o limite de '
      + 'três sintonizados na ficha.',
    correcoes: [
      {
        grupo: '🐛 Correções',
        itens: [
          'PDF: as expressões de dado (1d6, 2d8) apareciam cercadas de "?" em '
            + 'magias, talentos e características. O marcador que destaca o '
            + 'dado na tela não é codificável pela fonte do PDF, e agora sai '
            + 'do texto antes de gerar o arquivo. (#55)',
          'Descanso Longo: em Guardião, Paladino e Ladino — as classes que '
            + 'refazem todas as maestrias — clicar em "Trocar Maestrias" abria '
            + 'a troca de magia por cima do modal de maestria. Agora a cadeia '
            + 'só avança depois que você sai da tela de maestria, salvando ou '
            + 'cancelando. Em Bárbaro e Guerreiro, que trocam uma maestria por '
            + 'vez, quem não tinha maestria nenhuma definida também deixa de '
            + 'perder em silêncio as trocas de magia e truque seguintes. (#51)',
          'Bárbaro: durante a Fúria, Acrobacia, Furtividade, Intimidação, '
            + 'Percepção e Sobrevivência já usavam o modificador de Força '
            + 'pelo Conhecimento Primordial, mas não exibiam o selo "V" de '
            + 'Vantagem. Agora exibem, com a bolha explicando "Fúria '
            + '(Conhecimento Primordial)". (#48)',
        ],
      },
    ],
    melhorias: [
      {
        grupo: '✨ Melhorias',
        itens: [
          'PDF: cada item da mochila sai em Nome, Efeitos (dano, propriedades, '
            + 'CA, bônus) e Detalhes (custo, peso, raridade e sintonização), '
            + 'um bloco por item — em vez de a mochila inteira sair em um '
            + 'parágrafo só. Os equipamentos ganham o mesmo tratamento. (#57)',
          'PDF: Aparência, Personalidade, Ideais, Laços, Defeitos, História e '
            + 'Notas saem cada um em seu bloco, com as quebras de linha que '
            + 'você digitou preservadas — em vez de virarem um parágrafo único '
            + 'de dezenas de linhas. (#57)',
          'Item customizado: ao criar ou editar o seu, agora dá para marcar '
            + 'raridade (de Comum a Artefato, ou nenhuma para item não '
            + 'mágico), preço em texto livre ("150 PO", "de graça") e "requer '
            + 'sintonização" — os três aparecem como etiquetas no item. (#57)',
          'Sintonização: o item que pede sintonização ganha uma caixa na '
            + 'ficha, e o cabeçalho do inventário mostra "Sintonizados: X / '
            + '3". Ao chegar em três, as caixas dos outros itens ficam cinzas '
            + 'e não deixam marcar; desmarcar um libera as outras de novo. '
            + '(#57)',
        ],
      },
    ],
  },
  {
    versao: '3.0.3',
    data: '2026-09-02',
    rotulo: 'Magias personalizadas',
    resumo: 'Uma MUDANÇA DE REGRA, não só um conserto: o truque e a magia que '
      + 'você mesmo cria deixam de gastar vaga do limite e passam a estar '
      + 'sempre prontos, sem preparo nenhum. ATENÇÃO, muda o seu contador — '
      + 'quem já tinha uma delas vai ver o número CAIR sozinho na primeira '
      + 'abertura da ficha; nada foi apagado, e nenhuma magia sumiu. Veja '
      + 'abaixo o que isso muda em cada tela.',
    correcoes: [
      {
        grupo: '🪄 O que você inventa não custa vaga',
        itens: [
          'ATENÇÃO, muda o seu contador: truque e magia personalizados não '
            + 'gastam mais vaga do limite. Isto REVERTE uma decisão que veio '
            + 'em duas etapas: a 3.0.1 fez o truque personalizado passar a '
            + 'cobrar vaga, como a magia de círculo já cobrava, e a 3.0.2 '
            + 'reafirmou a cobrança ao arrumar o limite em multiclasse ("o '
            + 'truque continua contando como sempre contou — inclusive o '
            + 'personalizado"). Se você rolar até aquelas duas notas, é esta '
            + 'aqui que vale. O relato que trouxe a volta foi de uma ficha '
            + 'acusando "truques demais" por um truque que o próprio jogador '
            + 'inventou. Um Clérigo com dois truques do livro e um '
            + 'personalizado sai de "3 / 3" para "2 / 3 + 1 personalizado": o '
            + 'truque continua na ficha, só parou de custar vaga.',
          'As duas continuam à vista no contador, para o número que caiu não '
            + 'se ler como magia perdida: a seção de Magias mostra "Truques '
            + 'Personalizados" e "Personalizadas" ao lado do limite, com '
            + 'quantas ficaram fora da conta.',
          'Para quem CONHECE magias — Bardo, Bruxo, Feiticeiro e as '
            + 'subclasses conjuradoras — quem tinha uma personalizada '
            + 'preparada vai ver mais uma coisa na primeira abertura: a ficha '
            + 'oferece escolher uma magia nova. Você passou a contar uma '
            + 'magia a menos, então sobrou uma vaga da tabela da sua classe. '
            + 'A vaga é de verdade, não é engano do app: era a personalizada '
            + 'que a ocupava, e ela não ocupa mais. Preencha quando quiser — '
            + 'a sua magia continua na ficha e continua conjurável do mesmo '
            + 'jeito.',
          'Elas também estão SEMPRE prontas. O truque personalizado já era '
            + 'assim; a magia personalizada de 1º círculo ou superior '
            + 'precisava ser preparada, e agora não precisa mais — ela '
            + 'aparece direto no círculo dela, entre as Preparadas, com o '
            + 'botão de Conjurar e sem clique nenhum. O estado "Não '
            + 'preparada" deixou de existir para magia que você inventou.',
          'Como elas não ocupam vaga nem passam por preparo, saíram da lista '
            + 'de escolha do modal de preparar magias e da troca de magia do '
            + 'Descanso Longo. Para Bardo, Bruxo, Feiticeiro e as subclasses '
            + 'conjuradoras isso pesa mais: eles têm UMA troca por Descanso '
            + 'Longo, e oferecer a personalizada ali fazia você gastá-la para '
            + 'trazer o que já tinha, perdendo uma magia da classe em troca '
            + 'de nada.',
          'O botão "+ Magia" da seção Magias virou "Preparar Magias" (o modal '
            + 'que ele abre se chamava "Gerenciar Magias"). Os dois nomes '
            + 'antigos prometiam cadastrar magia ali dentro, e a magia que '
            + 'você inventa não passa mais por lá. Para quem PREPARA magia, o '
            + 'botão abre a tela de preparar, e preparar é tudo o que ela faz '
            + 'agora. Para quem CONHECE magia — Bardo, Bruxo, Feiticeiro e as '
            + 'subclasses conjuradoras — ele abre "Consultar Magias", que é '
            + 'tela de leitura: a lista dessas classes continua sendo '
            + 'definida na subida de nível e trocada no Descanso Longo. Criar '
            + 'a sua continua no botão ao lado, "Magia Personalizada".',
        ],
      },
      {
        grupo: '🧙 Mago — a cópia no grimório',
        itens: [
          'A magia personalizada que você tinha COPIADO para o grimório (o '
            + 'caminho de 50 PO e 2 horas por círculo, que a 3.0.1 passou a '
            + 'exigir) foi removida de lá. Aquela cópia existia para poder '
            + 'preparar a magia pelo grimório; com ela sempre pronta, a '
            + 'página não compra mais nada e ainda desenhava a mesma magia '
            + 'duas vezes, com um Preparar que não fazia efeito. A magia '
            + 'continua na ficha e continua conjurável.',
          'Os PO e as horas gastos naquela cópia NÃO são devolvidos: foram '
            + 'gastos na mesa, e o app não desfaz o que já aconteceu na sua '
            + 'sessão.',
          'Uma ressalva de segurança: se a sua magia personalizada tem o '
            + 'MESMO nome e o mesmo círculo de uma magia do livro, a página '
            + 'FICA no grimório. O grimório não guarda de qual das duas é a '
            + 'página, e apagar pelo nome removeria a cópia legítima da magia '
            + 'do livro, que você pagou para ter. Nesse caso a linha continua '
            + 'lá como magia do livro, e o "×" dela remove à mão se você '
            + 'quiser.',
        ],
      },
    ],
  },
  {
    versao: '3.0.2',
    data: '2026-09-01',
    rotulo: 'Classes e multiclasse',
    resumo: 'Sete correções: as que a multiclasse trouxe à tona, o Bruxo e o '
      + 'Bárbaro. A tela inicial mostra todas as suas classes; os Espaços de '
      + 'Magia de Pacto aparecem ao lado dos de Conjuração; o limite de '
      + 'truques volta a valer em multiclasse (ATENÇÃO, muda o seu contador — '
      + 'veja abaixo); as invocações que concedem magia passam a aplicar o '
      + 'efeito de verdade, as passivas dizem o que dão, e o Bárbaro nível 3 '
      + 'finalmente escolhe a perícia do Conhecimento Primordial.',
    correcoes: [
      {
        grupo: '🏠 Tela inicial — todas as classes',
        itens: [
          'O cartão da tela inicial mostrava só a PRIMEIRA classe, ao lado do '
            + 'nível total. Um Mago 5/Bruxo 3 aparecia como "Mago" e "Nv. 8", '
            + 'que se lê como um Mago de nível 8 — não era uma informação '
            + 'incompleta, era uma informação errada. Agora sai '
            + '"Mago (Evocação) 5 / Bruxo 3", com o nível de cada uma.',
          'O dado de vida do cartão também vinha só da primeira classe. Quem '
            + 'tem d6 e d8 via só o d6; agora vê os dois.',
        ],
      },
      {
        grupo: '🕯️ Bruxo — Espaços de Pacto na tela',
        itens: [
          'Os Espaços de Magia de Pacto sumiam da tela quando o mesmo círculo '
            + 'também era servido pela Conjuração de outra classe. Num Mago '
            + '5/Bruxo 3 os 2 espaços de pacto do 2º círculo não apareciam em '
            + 'lugar nenhum — embora existissem e pudessem ser gastos. Agora '
            + 'as duas reservas aparecem, e a de pacto se identifica: ela '
            + 'volta no Descanso Curto, a outra não.',
          'A ficha inteira do Bruxo sumia quando ele não era a sua PRIMEIRA '
            + 'classe: as marcas de invocação nos truques, os espaços de pacto '
            + 'e o Livro das Sombras na impressão. Tudo isso volta a aparecer '
            + 'para quem pegou Bruxo como segunda classe.',
        ],
      },
      {
        grupo: '✨ Bruxo — Invocações Místicas',
        itens: [
          'Conjurar pela invocação só mostrava um aviso na tela: usar Armadura '
            + 'Arcana por "Armadura de Sombras" não mexia na sua CA. Agora a '
            + 'conjuração acontece de verdade — alvo, efeito e concentração —, '
            + 'sem gastar espaço, que é o que o livro dispensa.',
          'Três magias de invocação estavam grafadas sem acento e não batiam '
            + 'com o catálogo: Levitação (Passo Ascendente) aparecia como 1º '
            + 'círculo em vez de 2º, e Respirar na Água (Presente das '
            + 'Profundezas) como 1º em vez de 3º. Corrigido.',
          'As invocações puramente passivas não diziam o que davam. Mente '
            + 'Mística (Vantagem em salvaguardas de Constituição para manter a '
            + 'Concentração), Visão da Bruxa, Visão Diabólica e Presente das '
            + 'Profundezas agora mostram o benefício no bloco de Recursos do '
            + 'Bruxo.',
        ],
      },
      {
        grupo: '🪓 Bárbaro — Conhecimento Primordial',
        itens: [
          'No nível 3 o Bárbaro ganha proficiência em mais uma perícia da '
            + 'lista dele, à escolha do jogador. O app anunciava a '
            + 'característica no resumo da subida e não fazia nada com ela: '
            + 'nem oferecia a escolha, nem concedia a perícia. Agora a '
            + 'subida ao nível 3 pede a perícia, e ela entra na ficha.',
          'A lista oferecida já exclui as perícias que você tem — Atletismo, '
            + 'Intimidação, Lidar com Animais, Natureza, Percepção e '
            + 'Sobrevivência, menos as suas.',
          'A outra metade da característica (usar Força no lugar do atributo '
            + 'normal em certas perícias durante a Fúria) já funcionava e não '
            + 'mudou.',
          'Se o seu Bárbaro já passou do nível 3 antes desta versão, a '
            + 'perícia não aparece sozinha: ela é escolha sua, e o app não '
            + 'escolhe por você. Dá para marcá-la na edição da ficha.',
        ],
      },
      {
        grupo: '🔢 Limite de truques em multiclasse',
        itens: [
          'Com duas classes conjuradoras o limite de truques simplesmente não '
            + 'valia: dava para marcar quantos quisesse (medimos 16 truques '
            + 'num limite de 4). Isso acontecia porque o app não sabia de qual '
            + 'classe era cada truque, e preferiu não travar a travar errado.',
          'ATENÇÃO, muda o seu contador: agora cada truque que você adicionar '
            + 'fica marcado com a classe pela qual você o pegou, e o contador '
            + 'passa a ser por classe. Nos truques que você JÁ tinha não há '
            + 'essa marca — em ficha multiclasse eles aparecem como '
            + '"+N sem classe" ao lado do contador, não somem e nada é '
            + 'apagado. Enquanto houver truque sem marca o app não bloqueia '
            + 'nada: ele prefere mostrar a dúvida a chutar de quem é o truque. '
            + 'Para acertar a conta, tire e ponha de novo o truque pela aba da '
            + 'classe certa.',
          'Quem tem uma classe só não muda em nada: sem duas classes não há '
            + 'dúvida possível, e o truque continua contando como sempre '
            + 'contou — inclusive o personalizado.',
        ],
      },
    ],
  },
  {
    versao: '3.0.1',
    data: '2026-09-01',
    rotulo: 'Correções da comunidade',
    resumo: 'Nove correções pontuais, uma para cada problema relatado no GitHub '
      + 'desde a 3.0.0: o Bardo do Colégio do Conhecimento volta a subir de '
      + 'nível, a rolagem de Pontos de Vida aceita qualquer valor do dado, o '
      + 'PDF mostra todas as classes do multiclasse, a magia sempre preparada '
      + 'que vem de talento passa a valer de verdade, magia customizada ganha '
      + 'os mesmos caminhos que as demais (descrição, preparo e cópia para o '
      + 'grimório), o Ilusionista que já sabe Ilusão Menor escolhe outro '
      + 'truque, e o peso de ferramentas e itens volta a ser contado certo.',
    correcoes: [
      {
        grupo: '🎓 Bardo — Descobertas Mágicas',
        itens: [
          'O Bardo do Colégio do Conhecimento não conseguia passar do nível '
            + '5: o card de Descobertas Mágicas pedia duas magias e nascia com '
            + 'os dois seletores vazios, sem nada para marcar, e a subida de '
            + 'nível ficava travada esperando uma escolha que não existia. '
            + 'Agora ele oferece magias de Clérigo, Druida e Mago do círculo '
            + 'disponível, e a subida segue normalmente.',
        ],
      },
      {
        grupo: '❤️ Pontos de Vida',
        itens: [
          'O campo de rolagem de Pontos de Vida da subida de nível só '
            + 'aceitava os valores 1 e 10 — qualquer outro número digitado '
            + 'era reescrito sozinho, sempre para um desses dois, no meio da '
            + 'digitação. Agora o campo aceita o valor real que caiu no dado.',
        ],
      },
      {
        grupo: '🖨️ Ficha impressa e PDF',
        itens: [
          'O PDF de um personagem multiclasse mostrava só a classe inicial '
            + 'no cabeçalho, como se as outras classes não existissem. Agora '
            + 'ele lista todas as classes do personagem, com o nível de cada '
            + 'uma — como a ficha e a impressão pelo navegador já faziam.',
        ],
      },
      {
        grupo: '✨ Magia sempre preparada por talento',
        itens: [
          'A magia de 1º círculo escolhida pelo Tocado Pelas Sombras ou pelo '
            + 'Tocado Por Fadas não ficava sempre preparada nem ganhava o uso '
            + 'grátis quando o personagem já tinha aquela magia preparada por '
            + 'outro caminho — só a magia fixa do talento (Invisibilidade) '
            + 'recebia o tratamento certo. Agora a magia escolhida também '
            + 'fica sempre preparada e com uso grátis, como o livro descreve.',
        ],
      },
      {
        grupo: '📖 Magias personalizadas',
        itens: [
          'Clicar numa magia customizada dentro do Grimório do Mago não '
            + 'abria a descrição — só funcionava na seção de Preparadas. '
            + 'Agora abre nos dois lugares.',
          'Uma magia customizada de 1º círculo ou superior não aparecia '
            + 'entre as preparáveis: ficava numa lista separada, sem botão '
            + 'de Preparar e sem Lançar. Agora ela entra na grade do modal '
            + '"+ Magia" e pode ser preparada por lá, em qualquer classe '
            + 'conjuradora. Bardo, Bruxo, Feiticeiro e as subclasses '
            + 'conjuradoras, que usam magias conhecidas, podem marcá-la e '
            + 'desmarcá-la por lá também, e trocá-la no Descanso Longo '
            + 'quando a lista já estiver cheia — a magia da lista da classe '
            + 'continua definida na subida de nível, como antes. A grade de '
            + 'magias da própria subida de nível ainda não lê magia '
            + 'customizada; use o "+ Magia" depois de subir.',
          'Uma magia customizada com o mesmo nome de uma magia da lista da '
            + 'classe não pode ficar preparada ao mesmo tempo que a '
            + 'homônima — magias preparadas são identificadas pelo nome em '
            + 'toda a ficha, e marcar uma com a outra já preparada mostra um '
            + 'aviso dizendo quem ocupa a vaga, em vez de preparar as duas.',
          'Magia customizada do Mago ia direto para o grimório ao ser '
            + 'criada, pulando o custo de copiar (50 PO e 2h por círculo) '
            + 'que toda outra magia paga. Agora ela precisa ser copiada como '
            + 'as demais, pelo botão "+ Copiar Magia para Grimório".',
          'ATENÇÃO, muda o seu contador: truque customizado passa a gastar '
            + 'vaga do limite de truques da classe, como a magia customizada '
            + 'de círculo já gastava vaga das preparadas. Antes o truque era '
            + 'de graça e a magia não, sem razão para a diferença. Se você já '
            + 'tem truque customizado, o contador sobe e pode ficar vermelho, '
            + 'acima do limite — nada é apagado, e nenhum truque some; você '
            + 'só não pega mais um da classe até acertar a conta.',
        ],
      },
      {
        grupo: '🧙 Mago Ilusionista',
        itens: [
          'Quem já conhecia Ilusão Menor — por talento, traço de espécie ou '
            + 'classe anterior — e escolhia a subclasse Ilusionista não '
            + 'ganhava truque nenhum no lugar, como o livro manda. Agora o '
            + 'Ilusionista escolhe outro truque de Mago quando já conhece '
            + 'Ilusão Menor. Vale para subidas de nível novas: personagem '
            + 'que já passou do nível 3 não recebe o truque substituto '
            + 'sozinho.',
        ],
      },
      {
        grupo: '🎒 Peso de itens',
        itens: [
          'Ferramentas, foco arcano, foco druídico e vários itens do '
            + 'equipamento inicial (como Roupas de Viagem) apareciam sem '
            + 'peso nenhum, e o peso de um item personalizado não podia mais '
            + 'ser alterado pelo botão Editar depois de criado. Agora o peso '
            + 'vem certo do livro, e o campo também aparece na edição.',
        ],
      },
    ],
  },
  {
    versao: '3.0.0',
    data: '2026-08-29',
    rotulo: 'Multiclasse',
    resumo: 'Chegou a multiclasse: dá para levar um personagem por mais de uma '
      + 'classe, e a ficha inteira calcula pela classe certa em cada caso — '
      + 'combate, Pontos de Vida, descansos, magias, proficiências e subida de '
      + 'nível. É um recurso grande e novo, que toca quase toda tela do app: '
      + 'conte com ajustes nas próximas versões, e avise pelo botão 🐛 quando '
      + 'algo não bater com o livro.',
    melhorias: [
      {
        grupo: '🧬 Uma segunda classe',
        itens: [
          'Ao subir de nível, escolha em qual classe o nível entra. O app '
            + 'aplica o pré-requisito de atributo que o livro exige para abrir '
            + 'uma classe nova.',
          'A ficha, o resumo e a versão impressa mostram todas as classes do '
            + 'personagem, com o nível de cada uma.',
          'Características, subclasse e recursos seguem o nível NA CLASSE. O '
            + 'bônus de proficiência, os pontos de experiência e o teto de '
            + 'nível 20 seguem o nível TOTAL, como manda o livro.',
        ],
      },
      {
        grupo: '⚔️ Combate, defesas e deslocamento',
        itens: [
          'Ataque Extra, Classe de Armadura, Maestria em Arma, deslocamento e '
            + 'iniciativa saem da classe certa.',
          'Quando mais de uma classe oferece uma forma de calcular a Classe de '
            + 'Armadura, um seletor deixa escolher qual usar.',
        ],
      },
      {
        grupo: '❤️ Pontos de Vida e descansos',
        itens: [
          'Os Pontos de Vida e os Dados de Vida somam pelo dado de cada '
            + 'classe, com o valor cheio do primeiro nível na classe inicial.',
          'O Descanso Curto e o Descanso Longo restauram os recursos pela '
            + 'classe a que cada um pertence.',
        ],
      },
      {
        grupo: '✨ Magias',
        itens: [
          'Os espaços de magia seguem a tabela de Conjurador Multiclasse '
            + 'quando duas ou mais classes conjuram. A Magia de Pacto do Bruxo '
            + 'continua sendo reserva própria, que volta num Descanso Curto.',
          'A CD e o bônus de Ataque de Magia aparecem por classe, cada um com '
            + 'o atributo de conjuração da sua.',
          'A tela de Magias traz a lista, os truques e o limite de preparo de '
            + 'cada classe que conjura, com um seletor para alternar entre '
            + 'elas.',
          'Cada magia preparada sabe de qual classe é, e o contador de '
            + 'preparadas é o da classe ativa.',
          'A troca de magia do Descanso Longo vale por classe conjuradora, em '
            + 'modais separados que dizem de qual classe é cada troca.',
        ],
      },
      {
        grupo: '🎓 Proficiências',
        itens: [
          'Entrar numa classe nova concede o subconjunto reduzido de '
            + 'proficiências que o livro dá ao multiclasse, não o conjunto '
            + 'completo da classe inicial.',
          'O talento Conjurador Ritualista cresce junto com o personagem.',
        ],
      },
      {
        grupo: '🚧 O que ainda falta',
        itens: [
          'A troca de truque do Descanso Longo é uma só por personagem, mesmo '
            + 'com duas classes que conjuram: a ficha ainda não guarda de qual '
            + 'classe é cada truque conhecido.',
          'A lista de armas oferecida no modal de Maestria em Arma vem só da '
            + 'primeira classe do personagem.',
          'A ficha em PDF ainda não acompanha tudo que a multiclasse traz, e '
            + 'vai receber ajustes nas próximas versões.',
          'Multiclasse é um recurso novo e amplo. Se algo não bater com o '
            + 'livro, use o botão 🐛 para avisar — é o que faz a próxima '
            + 'versão sair melhor.',
        ],
      },
    ],
    correcoes: [
      {
        grupo: '❤️ Pontos de Vida',
        itens: [
          'A Resiliência Dracônica do Feiticeiro (subclasse Feitiçaria '
            + 'Dracônica) dava 2 Pontos de Vida A MAIS do que o livro concede: '
            + 'ela vale +N no nível N de Feiticeiro, e o app calculava N+2. '
            + 'TODO FEITICEIRO DRACÔNICO EXISTENTE VAI PERDER 2 PONTOS DE VIDA '
            + 'MÁXIMOS; o ajuste acontece sozinho ao abrir a ficha, sem nada '
            + 'para o jogador fazer.',
          'O livro garante no mínimo 1 Ponto de Vida POR NÍVEL, e o recálculo '
            + 'aplicava esse mínimo só ao total. Um personagem de Constituição '
            + 'muito baixa terminava com 1 Ponto de Vida em vez do que a regra '
            + 'concede — um Feiticeiro 5 com Constituição 1 dava 1 e passa a '
            + 'dar 5.',
        ],
      },
      {
        grupo: '⚔️ Ataques e salvaguardas',
        itens: [
          'A invocação Lâmina Sedenta do Bruxo concede Ataque Extra com a arma '
            + 'de pacto, e a ficha não a contava: um Bruxo 5 com a invocação '
            + 'mostrava 1 ataque em vez de 2. A Lâmina Devoradora (Bruxo 12) '
            + 'leva a 3 ataques, como o livro descreve.',
          'Mente Escorregadia (Ladino 15) passa a marcar de fato a '
            + 'proficiência em salvaguardas de Sabedoria e Carisma na grade da '
            + 'ficha. O texto da característica já aparecia; a grade nunca '
            + 'marcava nada.',
        ],
      },
      {
        grupo: '🖨️ Ficha impressa e PDF',
        itens: [
          'A ficha impressa sempre mostrava "0" de PV Temporário e sempre '
            + 'mostrava a reserva de Dados de Vida cheia, mesmo depois de '
            + 'gastar dados. Os dois campos passam a mostrar o valor real.',
          'O PDF sempre mostrava "0" de PV Temporário pelo mesmo motivo, e '
            + 'passa a mostrar o valor real.',
        ],
      },
    ],
  },
  {
    versao: '2.2.16',
    data: '2026-08-22',
    rotulo: 'Resplendor Sagrado',
    resumo: 'O botão que devolve o Resplendor Sagrado do Paladino do '
      + 'Juramento da Devoção voltou a funcionar.',
    correcoes: [
      {
        grupo: '🛡️ Paladino — Juramento da Devoção',
        itens: [
          'Restaurar o Resplendor Sagrado gastando um espaço de magia de '
            + '5º círculo não fazia nada: o clique falhava em silêncio e o '
            + 'espaço nunca era debitado. Agora o espaço é gasto e a '
            + 'característica volta a ficar disponível.',
        ],
      },
    ],
  },
  {
    versao: '2.2.15',
    data: '2026-08-22',
    rotulo: 'Atributos editáveis',
    resumo: 'O modo Manual voltou para a criação de personagem, e a ficha '
      + 'pronta ganhou uma edição livre de atributos — com o ajuste feito à '
      + 'mão ficando visível na própria caixa do atributo.',
    melhorias: [
      {
        grupo: '✏️ Modo Manual na criação',
        itens: [
          'A opção "Manual" da tela de atributos voltou a funcionar. Quem '
            + 'rola os dados na mesa, ou usa outro sistema para gerar os '
            + 'atributos, digita os seis valores direto — sem precisar do '
            + 'inspetor do navegador.',
          'Cada campo aceita de 1 até 20 menos o bônus do antecedente '
            + 'naquele atributo, de modo que o total nunca passa de 20.',
        ],
      },
      {
        grupo: '🖊️ Edição manual na ficha pronta',
        itens: [
          'O botão "Editar ficha" ganhou a opção "Edição manual (sem '
            + 'regras)": digite o valor final que o atributo deve ter, entre '
            + '1 e 20. O método usado na criação continua registrado, a um '
            + 'toque de distância.',
          'O que foi ajustado à mão aparece na ficha, embaixo do atributo, '
            + 'como "✏️ +1 manual" — e o detalhe completo (base, bônus de '
            + 'antecedente, nível e a parte manual) fica no toque sobre a '
            + 'marca.',
          'O ajuste manual sobrevive à subida de nível: o +1 do nível soma '
            + 'ao total sem virar +2 de marca manual.',
          'Editar Constituição move o PV máximo pela mesma regra do livro '
            + 'que a subida de nível já usava, e reverter a distribuição '
            + 'devolve os PV junto.',
        ],
      },
    ],
  },
  {
    versao: '2.2.14',
    data: '2026-08-21',
    rotulo: 'Truques, CD, salvaguardas',
    resumo: 'O contador de truques parou de cobrar os truques que o livro '
      + 'dá de graça, quem conjura pela subclasse voltou a ter CD de '
      + 'magia na ficha, e o Monge de nível 14 finalmente ficou '
      + 'proficiente em todas as salvaguardas.',
    correcoes: [
      {
        grupo: '✨ Contador de truques',
        itens: [
          'O truque do talento Telecinético deixou de contar no limite de '
            + 'truques da classe. Um Bardo de nível 4 com o talento via '
            + '"Truques 4 / 3" em vermelho, como se tivesse escolhido '
            + 'truque demais.',
          'O truque que o Mago Ilusionista ganha da subclasse também parou '
            + 'de contar — o livro diz, com todas as letras, que ele "não '
            + 'conta para o seu número de truques conhecidos".',
          'Mãos Mágicas do Trapaceiro Arcano continua contando, como antes: '
            + 'o livro a inclui nos três truques da subclasse.',
        ],
      },
      {
        grupo: '🎯 CD e ataque de magia',
        itens: [
          'Cavaleiro Místico e Trapaceiro Arcano passaram a mostrar "CD '
            + 'Magia" e "Atq. Magia" na ficha, na folha impressa e no PDF. '
            + 'Os dois conjuram desde o nível 3 e as caixas simplesmente '
            + 'não eram montadas para eles.',
          'A conta usa Inteligência, como o livro manda para as duas '
            + 'subclasses. Nenhuma ficha precisa ser refeita.',
        ],
      },
      {
        grupo: '🛡️ Salvaguardas do Monge',
        itens: [
          'Sobrevivente Disciplinado passou a conceder de fato a '
            + 'proficiência em todas as salvaguardas no nível 14. A ficha '
            + 'já mostrava o texto da característica, mas as salvaguardas '
            + 'continuavam sem o bônus de proficiência — só as duas da '
            + 'classe estavam marcadas.',
          'Vale na ficha, na folha impressa e no PDF, e vale para as '
            + 'fichas que já estão no nível 14 ou acima: a proficiência é '
            + 'calculada na hora, não precisa subir de nível de novo.',
        ],
      },
    ],
  },
  {
    versao: '2.2.13',
    data: '2026-08-20',
    rotulo: 'Nível 20, magias',
    resumo: 'O Monge de nível 20 voltou a ganhar os +4 em Destreza e '
      + 'Sabedoria, e quem tem magia por talento sem ser conjurador voltou '
      + 'a ver essas magias na ficha.',
    correcoes: [
      {
        grupo: '🧘 Nível 20 do Monge',
        itens: [
          'Corpo e Mente passou a somar os +4 em Destreza e Sabedoria, até '
            + 'o máximo de 25. A característica aparecia na ficha com o '
            + 'texto certo e não mexia em atributo nenhum.',
          'Fichas que já estão no nível 20 precisam refazer a última subida '
            + 'para receber o aumento — ele é aplicado no momento em que se '
            + 'sobe para o nível 20.',
        ],
      },
      {
        grupo: '✨ Magias vindas de talento',
        itens: [
          'A seção de Magias passou a aparecer para quem não é conjurador '
            + 'mas tem magia por outro caminho. Um Monge com Tocado Por '
            + 'Fadas tinha a magia escolhida e Passo Nebuloso guardadas na '
            + 'ficha, e a seção inteira não era montada — a ficha pulava de '
            + 'Traços de Espécie direto para o Inventário.',
          'Vale para Tocado Por Fadas, Tocado Pelas Sombras, Conjurador '
            + 'Ritualista, Telecinético e para as magias de legado de '
            + 'espécie. Nenhuma ficha precisa ser refeita: as magias já '
            + 'estavam gravadas, só não apareciam.',
        ],
      },
      {
        grupo: '🪟 Botão "+ Talento" da ficha',
        itens: [
          'A lista de talentos deixou de ficar aberta por cima da ficha '
            + 'depois de adicionar um talento que pede configuração '
            + '(atributo, magia, perícia). Ela continuava lá cobrindo tudo, '
            + 'e era preciso clicar em Cancelar para chegar à ficha que '
            + 'acabara de mudar.',
          'Cancelar a configuração continua devolvendo para a lista, e uma '
            + 'escolha faltando continua mantendo a tela aberta para você '
            + 'corrigir.',
        ],
      },
      {
        grupo: '📖 Texto das características',
        itens: [
          'Corpo e Mente (Monge) e Golpe de Sorte (Ladino) mostravam, '
            + 'coladas no fim da descrição, o título "Subclasses de …" e o '
            + 'parágrafo de abertura daquela seção do livro. Sobrou só o '
            + 'texto da característica.',
        ],
      },
    ],
  },
  {
    versao: '2.2.12',
    data: '2026-08-19',
    rotulo: 'Talentos de treinamento',
    resumo: 'Os talentos que dão treinamento com armadura, com armas '
      + 'Marciais e com Utensílios de Cozinheiro voltaram a dar de verdade. '
      + 'Antes eles entravam na lista de talentos e não mudavam mais nada '
      + 'na ficha.',
    correcoes: [
      {
        grupo: '🛡️ Treinamento que o talento promete',
        itens: [
          'Especialista em Armaduras Leves, Médias e Pesadas passaram a '
            + 'conceder o treinamento na ficha. Antes o talento era gravado '
            + 'e a linha "Armaduras:" continuava igual — um Mago com o '
            + 'talento seguia sem proficiência nenhuma, e cada peça de '
            + 'armadura continuava marcada como "Sem Prof" no inventário.',
          'Especialista em Armaduras Leves passou a dar também os Escudos, '
            + 'como o livro manda. Sem eles, Mestre em Escudos ficava '
            + 'inalcançável para toda classe que não nasce com escudo.',
          'A escada de talentos voltou a subir: pegar Armaduras Leves agora '
            + 'libera Armaduras Médias, que libera Pesadas. Antes ela travava '
            + 'no primeiro degrau, porque o pré-requisito olhava um campo '
            + 'diferente do que o talento preenchia.',
          'Treinamento com Armas Marciais e Chef tinham o mesmo defeito e '
            + 'foram corrigidos junto.',
          'O Bardo do Colégio da Bravura, que já recebia treinamento com '
            + 'armas Marciais, armadura Média e Escudos pela subclasse, '
            + 'voltou a poder usar isso como pré-requisito de talento.',
          'Fichas já salvas recebem o treinamento sozinhas ao abrir — não '
            + 'precisa refazer o personagem.',
        ],
      },
    ],
  },
  {
    versao: '2.2.11',
    data: '2026-08-19',
    rotulo: 'Pactos do Bruxo',
    resumo: 'Os três Pactos do Bruxo voltaram a ser o que a edição de 2024 diz '
      + 'que são: invocações místicas comuns. Dá para levar mais de um, '
      + 'limitado só pela quantidade de invocações do seu nível.',
    correcoes: [
      {
        grupo: '🔮 Mais de um Pacto, como manda o livro',
        itens: [
          'Marcar o Pacto do Tomo desmarcava sozinho o Pacto da Lâmina que '
            + 'você já tinha — sem aviso nenhum. Era a regra de 2014 (a '
            + '"Dádiva de Pacto", que mandava escolher UMA) sobrevivendo no '
            + 'app: em 2024 os três pactos são invocações como as outras, sem '
            + 'pré-requisito e sem exclusividade entre elas.',
          'As invocações que EXIGEM um pacto passaram a olhar tudo que você '
            + 'escolheu. Quem tinha Pacto da Corrente e Pacto da Lâmina ao '
            + 'mesmo tempo via a Lâmina Sedenta ser recusada com "requer Pacto '
            + 'da Lâmina", mesmo com a Lâmina em mãos.',
          'As dádivas dos DOIS pactos aparecem na ficha. Antes só valiam as do '
            + 'primeiro pacto da lista: quem tinha Corrente e Tomo perdia o '
            + 'Livro das Sombras da tela, junto com o botão de escolher os '
            + 'truques e rituais dele.',
          'Fichas antigas entram sozinhas no formato novo — o pacto que você '
            + 'já tinha escolhido continua onde estava, agora contado como a '
            + 'invocação que ele é.',
        ],
      },
    ],
  },
  {
    versao: '2.2.10',
    data: '2026-08-19',
    rotulo: 'Magias personalizadas',
    resumo: 'O gatilho da Reação e o marcador de Ritual das magias que você '
      + 'cadastra pararam de sumir, conjurar de graça voltou a valer os '
      + 'efeitos da magia, e o Campeão finalmente escolhe o Estilo de Luta '
      + 'do nível 7 pela ficha.',
    melhorias: [
      {
        grupo: '⚔️ Estilo de Luta Adicional (Campeão)',
        itens: [
          'O Campeão de nível 7 ganha outro Estilo de Luta, e agora dá para '
            + 'escolher (e trocar) direto na ficha, no próprio cartão da '
            + 'característica. Antes o cartão só mostrava o texto do livro: '
            + 'quem já estava no nível 7 não tinha onde escolher.',
          'O estilo escolhido vale de verdade: o Defensivo, por exemplo, '
            + 'passou a somar +1 de CA mesmo quando é o estilo ADICIONAL — '
            + 'antes só o primeiro estilo da lista contava.',
        ],
      },
      {
        grupo: '🛡️ Item personalizado: CA que o item DEFINE',
        itens: [
          'Campo novo "CA Base", ao lado do "Bônus CA". O bônus SOMA (+1, +2); '
            + 'a CA base DEFINE — é o número que a armadura da sua mesa traz '
            + 'escrito ("CA 20"). Antes só existia o campo de bônus, e digitar '
            + '20 ali somava 20 à sua CA em vez de fixá-la.',
          'A CA base é um piso: um item de CA base menor que a sua CA atual não '
            + 'piora nada. E escudo, Estilo de Luta Defensivo, bônus de itens e '
            + 'efeitos mágicos continuam somando por cima, como somam sobre '
            + 'armadura do livro.',
          'A CA base não soma Destreza (o número digitado é a CA, como nas '
            + 'armaduras Pesadas), e o campo existe igual no criador e na ficha.',
        ],
      },
      {
        grupo: '🎒 Item personalizado sem teto',
        itens: [
          'O bônus de CA e o de ataque de item personalizado não têm mais '
            + 'limite. Uma armadura lendária da sua mesa com CA 20 era '
            + 'recusada inteira pelo formulário (o limite era -5 a +5), e o '
            + 'item não chegava a ser gravado — daí a impressão de que a CA '
            + 'não estava sendo contada.',
          'Com o item gravado e EQUIPADO, o bônus entra na CA normalmente.',
        ],
      },
    ],
    correcoes: [
      {
        grupo: '✨ Magias personalizadas',
        itens: [
          'O gatilho da Reação sumia ao salvar: o campo aparecia, você '
            + 'escrevia, e o texto não era gravado em lugar nenhum. Agora o '
            + 'gatilho fica junto do tempo de conjuração ("Reação, quando..."), '
            + 'que é o formato que a própria tela de edição já sabia ler.',
          'O selo de Ritual não aparecia no grimório do Mago para magia que '
            + 'você mesmo cadastrou — e o botão de conjurar como Ritual também '
            + 'não. A tela só sabia reconhecer ritual das magias do acervo.',
          'Abrir uma magia personalizada de Ritual para editar desmarcava '
            + 'sozinho a caixa "Pode ser conjurada como Ritual", e salvar '
            + 'qualquer outra alteração apagava o Ritual.',
        ],
      },
      {
        grupo: '🪄 Conjurar sem gastar espaço',
        itens: [
          'A Maestria de Magias (nível 18) e a Assinatura Mágica (nível 20) do '
            + 'Mago só mostravam um aviso na tela: conjurar Armadura Arcana '
            + 'por elas não mexia na CA. Agora passam pelo mesmo caminho da '
            + 'conjuração normal — efeito, alvo e Concentração — sem gastar '
            + 'espaço de magia.',
        ],
      },
      {
        grupo: '🥋 Dado de Artes Marciais do Monge',
        itens: [
          'A ficha mostrava "d16" no lugar de "1d6" (e "d110" no nível 11): a '
            + 'leitura da tabela colava a quantidade nas faces do dado. O '
            + 'número errado também aparecia na cura da Integridade Corporal.',
        ],
      },
    ],
  },
  {
    versao: '2.2.9',
    data: '2026-08-19',
    rotulo: 'Rituais e preparo',
    resumo: 'Magias com o marcador Ritual agora podem ser conjuradas sem '
      + 'gastar espaço, e trocar magia passou a valer igual para toda classe: '
      + 'uma no descanso, quantas quiser ao subir de nível.',
    melhorias: [
      {
        grupo: '📜 Conjurar como Ritual',
        itens: [
          'As 31 magias com o marcador Ritual ganharam o botão "Ritual" na '
            + 'ficha, que conjura sem gastar espaço de magia. Antes isso só '
            + 'existia para magia que você mesmo tivesse cadastrado à mão: um '
            + 'Mago com Detectar Magia preparada tinha de gastar um espaço, ou '
            + 'não conjurava.',
          'O botão "Ritual" do grimório do Mago dizia "conjurar sem gastar '
            + 'espaço" e não conjurava nada — só mostrava um aviso na tela. '
            + 'Agora funciona de verdade.',
          'A Concentração vale igual na versão Ritual: o que muda é só o '
            + 'espaço de magia, que não é gasto.',
        ],
      },
      {
        grupo: '🏷️ Selos na escolha de magia',
        itens: [
          'Na tela de escolher magias, o selo "Conc." não aparecia em 79 '
            + 'opções que exigem Concentração, e o selo de componente caro '
            + 'faltava em outras 81 — sempre nas magias que têm mais de um '
            + 'marcador, como Detectar Magia (Concentração e Ritual).',
          'O selo de Concentração passou a vir da duração da própria magia, '
            + 'que é o que o livro imprime.',
        ],
      },
    ],
    correcoes: [
      {
        grupo: '🎯 Avisos de Concentração',
        itens: [
          'Mover Terra exige Concentração e o app não avisava — você podia '
            + 'manter outra magia de Concentração ativa junto, o que o livro '
            + 'não permite.',
          'Projeção Astral, Criação, Sugestão em Massa e Piscar apareciam '
            + 'marcadas como Concentração sem precisarem.',
          'Pele-Casca ocupava a vaga de Concentração ao ser conjurada, '
            + 'bloqueando outra magia. A duração dela é "1 hora", sem '
            + 'Concentração nenhuma.',
        ],
      },
      {
        grupo: '🔢 Magia no círculo errado',
        itens: [
          'De Carne para Pedra é magia de 6º círculo e aparecia entre as de 5º '
            + 'para o Druida. Um Druida de nível 9 podia prepará-la dois '
            + 'níveis antes da hora.',
        ],
      },
      {
        grupo: '🔒 Magias que você sempre tem preparadas',
        itens: [
          'Um Mago de nível 18 ou 20 podia trocar fora, na subida de nível, as '
            + 'magias de Maestria de Magias e Assinatura Mágica — que o livro '
            + 'diz que ele sempre tem preparadas.',
          'Mãos Mágicas aparecia como truque trocável na subida de nível. O '
            + 'livro deixa trocar os truques da subclasse "exceto Mãos '
            + 'Mágicas", e o Descanso Longo já a protegia.',
          'As magias das Descobertas Mágicas do Colégio do Conhecimento '
            + 'estavam ocupando vagas do seu limite de preparadas. O livro diz '
            + 'que você sempre as tem preparadas, então elas não contam.',
          'A tela de subida de nível oferecia trocar essas magias, o que '
            + 'nenhuma delas permite.',
        ],
      },
      {
        grupo: '🌙 Trocar magia e truque: a mesma regra para todos',
        itens: [
          'A troca dependia da classe de um jeito que ninguém tinha decidido: '
            + 'Clérigo, Druida, Mago, Guardião e Paladino abriam a lista '
            + 'INTEIRA no Descanso Longo, e Bardo, Bruxo e Feiticeiro não '
            + 'tinham troca de magia nenhuma ali.',
          'Agora vale o mesmo para toda classe conjuradora: no Descanso Longo '
            + 'você troca UMA magia e UM truque.',
          'E ao subir de nível você troca QUANTAS quiser — magias e truques. '
            + 'Escolha uma troca, use o botão "+ Adicionar outra troca" e '
            + 'monte quantas precisar; cada uma aparece numa lista, com um '
            + '"desfazer". Antes o assistente aplicava uma só.',
          'A Memorizar Magia do Mago (nível 5) dizia trocar 1 magia preparada '
            + 'por outra do livro, e abria a lista inteira — dava para remontar '
            + 'tudo num Descanso Curto. Agora troca uma, como o texto diz.',
          'A janela de troca dizia "1 magia conhecida" mesmo para quem prepara '
            + 'magias, como o Guardião e o Paladino.',
          'Numa troca, o Mago podia acabar preparando magia que não está no '
            + 'livro dele. Agora a lista de substitutas vem do grimório, como '
            + 'já acontecia na subida de nível.',
        ],
      },
    ],
  },
  {
    versao: '2.2.8',
    data: '2026-08-18',
    rotulo: 'Traços por nível',
    resumo: 'O Draconato passa a ser avisado quando ganha o Voo Dracônico, e '
      + 'os traços de espécie mostram o texto do livro.',
    correcoes: [
      {
        grupo: '🐉 Avisos de traço de espécie',
        itens: [
          'Um Draconato que chegava ao nível 5 ganhava o Voo Dracônico, mas a '
            + 'tela de subida de nível não avisava nada — o traço só aparecia '
            + 'para quem abrisse a ficha depois e reparasse na lista.',
          'Agora ele é anunciado como já eram a Revelação Celestial do Aasimar '
            + '(nível 3) e a Forma Grande do Golias (nível 5).',
          'O aviso passou a mostrar o texto do livro. Antes, dois desses traços '
            + 'exibiam um resumo curto escrito à mão, que dizia menos do que a '
            + 'regra real.',
        ],
      },
    ],
  },
  {
    versao: '2.2.7',
    data: '2026-08-18',
    rotulo: 'Escolhas de subclasse',
    resumo: 'A subida de nível passou a pedir as escolhas que a sua subclasse '
      + 'exige, e a conceder o que ela dá de graça.',
    melhorias: [
      {
        grupo: '🎯 Escolhas que a subclasse exige',
        itens: [
          'Doze características de subclasse pediam uma escolha no livro e o '
            + 'app nunca perguntava nada: você terminava o nível sem aviso e '
            + 'sem o benefício. Agora a subida de nível mostra um card para '
            + 'cada uma, com as opções certas.',
          'Entre elas: as 3 perícias do Colégio do Conhecimento, a ferramenta '
            + 'e a perícia do Estudioso da Guerra, a perícia do Glamour '
            + 'Transcendental, o Estilo de Luta Adicional do Campeão, a Presa '
            + 'do Caçador, as Táticas Defensivas, o Companheiro Primal, o '
            + 'Aspecto dos Selvagens e a Afinidade Elemental.',
          'O Estilo de Luta Adicional do Campeão agora funciona de verdade: '
            + 'antes, mesmo escolhido, ele não aplicava efeito nenhum.',
        ],
      },
      {
        grupo: '🎁 O que a subclasse dá sem perguntar',
        itens: [
          'Cinco características concedem algo automaticamente no livro, e o '
            + 'app não concedia: Treinamento Marcial (Colégio da Bravura), '
            + 'Implementos de Misericórdia, Ferramentas de Assassino, Mente de '
            + 'Ferro (Vigilante das Sombras) e Ilusões Aprimoradas.',
          'Agora as proficiências e o truque entram na ficha ao subir de nível, '
            + 'sem você precisar fazer nada.',
        ],
      },
    ],
    correcoes: [
      {
        grupo: '📋 Habilidades na seção certa da ficha',
        itens: [
          'Trinta e cinco características apareciam na seção errada da ficha. '
            + 'Ataque Extra, Maestria em Arma e Defesa sem Armadura estavam em '
            + '"Habilidades Ativas" mesmo sem custar nada; Esquiva Sobrenatural, '
            + 'Queda Lenta e Golpe Astuto estavam em "Passivas" mesmo custando '
            + 'sua Reação ou dados.',
          'Algumas ainda ganhavam um botão de uso que o livro não prevê: a '
            + 'Fúria Implacável do Bárbaro mostrava "Usar / Esgotado" com 2 '
            + 'usos, e a Maestria em Arma exibia selo de "recarrega no Descanso '
            + 'Longo" — nenhuma das duas se esgota.',
        ],
      },
      {
        grupo: '🌿 Magias do Círculo da Terra',
        itens: [
          'Um Druida do Círculo da Terra recebia as magias dos QUATRO terrenos '
            + 'somadas — 24 magias até o nível 9, onde o livro concede 6 — e '
            + 'nunca era perguntado qual terreno havia escolhido.',
          'Agora o app pergunta o terreno na subida de nível e concede só as '
            + 'magias daquele terreno.',
        ],
      },
    ],
  },
  {
    versao: '2.2.6',
    data: '2026-08-18',
    rotulo: 'Magias de subclasse',
    resumo: 'Quatro subclasses que nunca recebiam as magias concedidas pelo '
      + 'livro passaram a recebê-las.',
    correcoes: [
      {
        grupo: '🌙 Magias que a subclasse concede',
        itens: [
          'Um Druida de Círculo da Lua, do Mar ou das Estrelas, e um Guardião '
            + 'Vigilante das Sombras, nunca recebiam as magias que a própria '
            + 'subclasse concede — chegavam ao nível 20 sem nenhuma delas.',
          'Agora as magias entram na ficha no nível certo: o Círculo da Lua '
            + 'recebe Curar Ferimentos, Fagulha Estelar e Raio Lunar já no '
            + 'nível 3, e assim por diante em cada nível de concessão.',
          'O Paladino de Juramento da Vingança era a única das quatro trilhas '
            + 'que não listava as magias do juramento no resumo da subida de '
            + 'nível; agora aparece como as outras três.',
        ],
      },
    ],
  },
  {
    versao: '2.2.5',
    data: '2026-08-18',
    rotulo: 'Descanso do Paladino',
    resumo: 'O Paladino volta a recuperar os recursos da sua subclasse no '
      + 'descanso — três das quatro trilhas de Juramento nunca recuperavam.',
    correcoes: [
      {
        grupo: '🛡️ Recursos de Juramento no descanso',
        itens: [
          'Um Paladino de Juramento da Glória, da Devoção ou da Vingança '
            + 'gastava os recursos da subclasse e o descanso não os '
            + 'devolvia: o contador continuava marcando tudo como gasto e o '
            + 'botão seguia desabilitado, por mais que você descansasse.',
          'Afetava Defesa Gloriosa e Lenda Viva (Glória), Resplendor Sagrado '
            + 'e Arma Sagrada (Devoção) e Anjo Vingador (Vingança). Juramento '
            + 'dos Anciões era a única trilha que funcionava.',
          'Agora as quatro trilhas recuperam normalmente, no Descanso Curto e '
            + 'no Longo. Se o seu Paladino estava com recursos presos como '
            + 'gastos, basta descansar uma vez para eles voltarem.',
        ],
      },
    ],
  },
  {
    versao: '2.2.4',
    data: '2026-08-18',
    rotulo: 'Relatar problemas',
    resumo: 'Relato de problemas agora pelo GitHub, e fichas recebidas de '
      + 'outras pessoas passaram a ser tratadas com segurança.',
    melhorias: [
      {
        grupo: '🐛 Relatar problema pelo GitHub',
        itens: [
          'O botão 🐛 do topo agora abre os formulários do projeto no '
            + 'GitHub: um para relatar problema e outro para sugerir '
            + 'melhoria. O formulário já pergunta o que costuma faltar '
            + '(o que você fez, o que esperava, qual aparelho).',
          'O link já vai com a sua versão preenchida — você não precisa '
            + 'procurar o número no topo da tela.',
          'Dá para ver o que já foi relatado antes de abrir um relato novo, '
            + 'e comentar no de alguém em vez de repetir.',
          'Quem não tem conta no GitHub continua com os contatos pelo '
            + 'Reddit, no mesmo lugar.',
        ],
      },
    ],
    correcoes: [
      {
        grupo: '🔒 Fichas recebidas de outras pessoas',
        itens: [
          'Um personagem importado podia trazer, escondido nos campos de '
            + 'texto — nome, aparência, notas, descrição de item, foto —, '
            + 'conteúdo que o app interpretava como parte da própria '
            + 'página em vez de como texto.',
          'Agora todo campo preenchido por você (ou por quem te mandou a '
            + 'ficha) aparece como texto, e só. Nada muda no que você vê: '
            + 'os textos continuam iguais.',
          'Isso vale na tela inicial, na ficha, na edição, na criação de '
            + 'personagem e no inventário.',
        ],
      },
      {
        grupo: '🧭 Endereços inválidos',
        itens: [
          'Alguns endereços digitados à mão deixavam a tela em branco em '
            + 'vez de mostrar "Página não encontrada". Agora caem na tela '
            + 'de erro, como deveriam.',
        ],
      },
    ],
  },
  {
    versao: '2.2.3',
    data: '2026-08-17',
    rotulo: 'Foto no PDF',
    resumo: 'A foto do personagem no PDF e na impressão, e os recursos do '
      + 'Mago à vista na ficha.',
    melhorias: [
      {
        grupo: '🖼️ Foto na ficha impressa e no PDF',
        itens: [
          'A foto que você carrega na ficha agora sai no PDF do botão '
            + '"Gerar PDF", ao lado do nome, no cabeçalho.',
          'Sai também na impressão direta do navegador, no mesmo lugar.',
          'Quem não tem foto continua com o cabeçalho como era, sem moldura '
            + 'vazia ocupando espaço.',
        ],
      },
      {
        grupo: '📖 Recursos do Mago à vista',
        itens: [
          'O painel do topo da ficha passou a mostrar QUAIS magias você '
            + 'escolheu para Maestria de Magias e Assinatura Mágica — antes '
            + 'os botões diziam só "Assinatura 1" e "Assinatura 2", e a '
            + 'escolha ficava escondida dentro do card recolhido.',
          'A Maestria de Magias ganhou os botões para conjurar as duas magias '
            + 'sem gastar espaço, à vontade. Antes só existia uma frase '
            + 'explicando a regra.',
          'Quando ainda não há magia escolhida, o painel avisa e leva direto '
            + 'para a tela de escolha.',
        ],
      },
    ],
  },
  {
    versao: '2.2.2',
    data: '2026-08-17',
    rotulo: 'Mago e Bárbaro',
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
    rotulo: 'Subclasses conjuradoras',
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
    rotulo: 'Seletor de itens',
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
    rotulo: 'Talentos na ficha',
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
    rotulo: 'Cards de escolha',
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
    rotulo: 'Perícias na criação',
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
    rotulo: 'Primeira versão',
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
