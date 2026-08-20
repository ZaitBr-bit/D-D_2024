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
export const VERSAO_ATUAL = '2.2.13';

// Cada entrada é uma versão. `melhorias` e `correcoes` são listas de
// grupos, e cada grupo tem um título curto e seus itens. O emoji do
// grupo entra no próprio título -- é o que separa visualmente melhoria
// de correção sem depender de cor.
export const NOTAS_VERSAO = [
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
