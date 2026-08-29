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
export const VERSAO_ATUAL = '2.2.27';

// Cada entrada é uma versão. `melhorias` e `correcoes` são listas de
// grupos, e cada grupo tem um título curto e seus itens. O emoji do
// grupo entra no próprio título -- é o que separa visualmente melhoria
// de correção sem depender de cor.
export const NOTAS_VERSAO = [
  {
    versao: '2.2.27',
    data: '2026-08-29',
    rotulo: 'Trocas por classe',
    resumo: 'A troca de magia do Descanso Longo passa a valer por classe '
      + 'conjuradora. Quem tem duas ou mais classes que conjuram ganha uma '
      + 'troca de magia de CADA uma, em modais separados que dizem de qual '
      + 'classe é cada troca.',
    melhorias: [
      {
        grupo: '🔄 Troca por classe no Descanso Longo',
        itens: [
          'Um personagem com duas ou mais classes conjuradoras (ex.: '
            + 'Clérigo 5/Druida 5) passa a poder trocar uma magia de CADA '
            + 'classe ao terminar um Descanso Longo, não mais só uma para '
            + 'o personagem inteiro. Cada modal da cadeia diz de qual '
            + 'classe é aquela troca.',
          'A troca de truque continua sendo uma só por personagem, mesmo '
            + 'com duas ou mais classes conjuradoras -- a ficha ainda não '
            + 'guarda de qual classe é cada truque conhecido.',
        ],
      },
    ],
  },
  {
    versao: '2.2.26',
    data: '2026-08-29',
    rotulo: 'Contador por classe',
    resumo: 'A magia preparada passa a saber de que classe é. O contador da '
      + 'classe ativa deixa de somar as magias das outras, fichas antigas '
      + 'são carimbadas sozinhas no que dá para saber com certeza, e o que '
      + 'for ambíguo num multiclasse fica marcado "sem classe" em vez de '
      + 'receber um palpite.',
    melhorias: [
      {
        grupo: '🏷️ Magia preparada sabe a classe',
        itens: [
          'Cada magia preparada pode agora guardar de qual classe ela é. '
            + 'Fichas antigas são carimbadas automaticamente ao abrir, sempre '
            + 'que dá para saber com certeza; quando não dá (magia '
            + 'personalizada, ou multiclasse com listas parecidas, como '
            + 'Feiticeiro/Mago), a magia fica marcada "sem classe" em vez de '
            + 'ganhar um chute.',
          'O contador de preparadas da classe ativa passa a contar só as '
            + 'magias DELA. Um Clérigo 5/Mago 1 via o limite do Clérigo somado '
            + 'às magias do Mago; agora os dois números não se misturam.',
        ],
      },
    ],
    correcoes: [
      {
        grupo: '🚪 Fluxos que abriam vazios',
        itens: [
          'O card "Trocar Magias" da subida de nível e o botão "Trocar '
            + 'Magia Preparada" do Mago (nível 5) podiam aparecer sem ter '
            + 'nenhuma magia para oferecer: contavam a ficha inteira, '
            + 'enquanto a lista por trás já filtrava pela classe certa. Os '
            + 'dois lados passam a concordar.',
          'O aviso "sem classe" do modal de gerenciar magias congelava o '
            + 'número depois de adicionar ou remover a última magia sem '
            + 'carimbo. Agora acompanha a mudança.',
          'O alarme de "limite excedido" do modal de gerenciar magias nunca '
            + 'aparecia -- uma checagem cobria a outra por engano. Corrigido.',
        ],
      },
    ],
  },
  {
    versao: '2.2.25',
    data: '2026-08-29',
    rotulo: 'Magias por classe',
    resumo: 'A tela de Magias passa a olhar a classe certa. Quem tem uma '
      + 'segunda classe que conjura via a lista, os truques e o limite de '
      + 'preparo da classe INICIAL — e um Ladino que virou Mago não via '
      + 'nada. Entram também as proficiências reduzidas ao abrir classe '
      + 'nova e o crescimento do talento Conjurador Ritualista.',
    melhorias: [
      {
        grupo: '📖 Tela de Magias por classe',
        itens: [
          'A lista de magias, os truques e o limite de preparo agora saem '
            + 'da classe que conjura, no nível DELA. Antes saíam da classe '
            + 'inicial no nível TOTAL: um Ladino 5/Mago 1 abria "Gerenciar '
            + 'Magias" e via a tela vazia, com 0 de limite.',
          'Quem tem DUAS classes que conjuram ganhou um seletor na seção '
            + 'de Magias para alternar entre elas. A tela inteira acompanha '
            + 'a escolha, inclusive o modal. Com uma classe só nada muda.',
          'O contador de preparadas continua sendo do personagem inteiro, '
            + 'porque a magia ainda não guarda de que classe é. Isso agora '
            + 'está ESCRITO na tela, ao lado do número, em vez de o número '
            + 'parecer ser de uma classe só.',
        ],
      },
      {
        grupo: '🛡️ Proficiências ao abrir uma classe nova',
        itens: [
          'Entrar numa classe diferente da inicial passa a conceder o '
            + 'subconjunto de proficiências que o livro define para '
            + 'multiclasse — e não mais nada, que era o que acontecia. '
            + 'Bardo, Guardião e Ladino pedem a escolha de perícia na '
            + 'própria tela de subida.',
          'Armadura e arma passaram a ser calculadas a partir de todas as '
            + 'classes do personagem. Fichas que já eram multiclasse se '
            + 'corrigem sozinhas ao abrir, sem migração.',
        ],
      },
      {
        grupo: '🔮 Conjurador Ritualista que cresce',
        itens: [
          'O talento diz que, sempre que o Bônus de Proficiência aumenta, '
            + 'o personagem escolhe mais uma magia ritual. Isso nunca tinha '
            + 'sido implementado: agora a subida de nível pergunta nos '
            + 'níveis 5, 9, 13 e 17, e quem já passou desses níveis é '
            + 'perguntado na próxima subida, recuperando o atraso.',
        ],
      },
    ],
    correcoes: [
      {
        grupo: '🚫 Bloqueios que não abriam',
        itens: [
          'O modal recusava adicionar magia e truque comparando o total do '
            + 'personagem inteiro com o limite de uma classe só. Num '
            + 'Clérigo 5/Mago 1 isso nunca liberava. As opções também '
            + 'apareciam pintadas de indisponíveis enquanto o clique '
            + 'funcionava.',
          'O modal cobrava truques de talento contra o orçamento da classe, '
            + 'enquanto a ficha não cobrava — as duas telas mostravam '
            + 'números diferentes para o mesmo personagem, inclusive em '
            + 'classe única. Agora usam a mesma regra.',
        ],
      },
      {
        grupo: '📚 Grimório do Mago em multiclasse',
        itens: [
          'O grimório sumia inteiro quando o Mago não era a classe '
            + 'inicial, e a trava que exige a magia estar no livro não '
            + 'valia para esse personagem.',
        ],
      },
    ],
  },
  {
    versao: '2.2.24',
    data: '2026-08-26',
    rotulo: 'Escolha de classe',
    resumo: 'A subida de nível ganha a multiclasse de verdade: dá para '
      + 'escolher a classe a cada nível novo, com o pré-requisito de '
      + 'atributo do livro entrando em cena e a ficha impressa mostrando '
      + 'todas as classes do personagem.',
    melhorias: [
      {
        grupo: '⬆️ Classe escolhida ao subir de nível',
        itens: [
          'A tela de subida de nível ganhou um seletor de classe. Quem já '
            + 'tem mais de uma classe, ou está abrindo uma nova, escolhe '
            + 'ali — os Pontos de Vida do nível saem do dado da classe '
            + 'escolhida, e as características que aparecem são as '
            + 'daquela classe, no nível que ela está alcançando.',
          'A subclasse passa a ser perguntada no 3º nível DAQUELA classe, '
            + 'não no nível total do personagem — um Guerreiro 5/Mago 3 '
            + 'escolhe a subclasse de Mago no terceiro nível de Mago, como '
            + 'o livro manda.',
        ],
      },
      {
        grupo: '🔒 Pré-requisito de atributo para classe nova',
        itens: [
          'O livro exige 13 ou mais no atributo principal para abrir uma '
            + 'classe nova. Quando o personagem não alcança, a subida de '
            + 'nível avisa e barra, com a opção de dispensar a regra para '
            + 'quem joga numa mesa que não a usa.',
          'Dispensar o pré-requisito deixa uma marca visível na ficha e '
            + 'na impressão, para lembrar depois que aquela classe entrou '
            + 'fora da exigência do livro.',
        ],
      },
      {
        grupo: '🖨️ Impressão com todas as classes',
        itens: [
          'A ficha impressa e o PDF passam a mostrar todas as classes do '
            + 'personagem no cabeçalho — "Mago 5 / Bárbaro 1" — em vez de '
            + 'só a primeira.',
        ],
      },
    ],
    correcoes: [
      {
        grupo: '🔮 Magias sempre preparadas da segunda classe',
        itens: [
          'Ao reabrir a ficha, as magias que a segunda classe deixa '
            + 'sempre preparadas eram apagadas — o Juramento de um '
            + 'Paladino num Mago/Paladino, por exemplo. A ficha só '
            + 'conhecia as magias automáticas da PRIMEIRA classe, e '
            + 'limpava as demais achando que estavam sobrando. Agora cada '
            + 'classe é consultada no nível DELA.',
          'Pelo mesmo motivo, e no sentido contrário, quem tinha a '
            + 'primeira classe conjuradora recebia magias de níveis que '
            + 'ainda não alcançou: um Paladino 5/Mago 4 era tratado como '
            + 'Paladino 9.',
        ],
      },
      {
        grupo: '✨ A classe recém-aberta aparece na hora',
        itens: [
          'Logo depois de abrir uma classe nova, a ficha mostrava a '
            + 'classe sem espaços de magia, sem características e sem '
            + 'subclasse até a página ser recarregada. Agora os dados da '
            + 'classe nova entram antes de a ficha ser redesenhada.',
        ],
      },
      {
        grupo: '💾 Formato de armazenamento',
        itens: [
          'Os níveis por classe, os dados de vida e os espaços de magia '
            + 'passaram a ser guardados por classe no arquivo do '
            + 'personagem. Fichas antigas são convertidas sozinhas ao '
            + 'abrir, e nada muda na tela.',
        ],
      },
    ],
  },
  {
    versao: '2.2.23',
    data: '2026-08-26',
    rotulo: 'Conjuração por classe',
    resumo: 'Revisão das regras de multiclasse contra o livro. A CD e o '
      + 'bônus de Ataque de Magia passam a ser mostrados por classe — '
      + 'quem tem duas classes que conjuram tinha um número só, e ele '
      + 'estava errado para uma delas. A seção de Magias volta a '
      + 'aparecer para quem conjura por uma classe que não é a primeira.',
    correcoes: [
      {
        grupo: '🔮 CD e Ataque de Magia por classe',
        itens: [
          'Cada classe que conjura tem o próprio atributo de conjuração, '
            + 'e o livro manda usar o da classe DONA da magia. A ficha '
            + 'mostrava uma CD só, a da primeira classe: um Clérigo '
            + '5/Mago 5 com Sabedoria 16 e Inteligência 10 exibia CD 15 '
            + 'para tudo, quando as magias de Mago valem CD 12. Agora '
            + 'aparecem as duas caixas, cada uma com o nome da classe.',
          'Quem tem uma classe conjuradora só continua vendo exatamente '
            + 'o que via: "CD Magia" e "Atq. Magia", sem nome de classe.',
          'O mesmo vale na impressão e no PDF.',
          'Nos Atributos, o selo 🔮 passa a marcar o atributo de '
            + 'conjuração de TODAS as classes do personagem, não só o da '
            + 'primeira.',
          'O +1 de CD da Feitiçaria Inata do Feiticeiro agora vale só '
            + 'nas magias de Feiticeiro. Num Feiticeiro/Mago ele vazava '
            + 'para as magias de Mago, e num Mago/Feiticeiro não chegava '
            + 'a nenhuma das duas.',
        ],
      },
      {
        grupo: '📖 Seção de Magias para quem conjura pela segunda classe',
        itens: [
          'A seção de Magias só aparecia se a PRIMEIRA classe do '
            + 'personagem conjurasse. Um Bárbaro 5/Mago 1 que ainda não '
            + 'tivesse registrado nenhuma magia não via a seção — e como '
            + 'é a única tela com o botão "+ Magia", não havia como '
            + 'registrar a primeira. Agora a seção aparece para quem '
            + 'conjura por qualquer uma de suas classes, Magia de Pacto '
            + 'do Bruxo incluída.',
          'A caixa de CD/Ataque de Magia e as páginas de magia da '
            + 'impressão sumiam pelo mesmo motivo, e voltam junto.',
        ],
      },
      {
        grupo: '⚔️ Lâmina Sedenta do Bruxo conta nos ataques',
        itens: [
          'A invocação Lâmina Sedenta concede Ataque Extra com a arma de '
            + 'pacto, mas a ficha não a contava: um Bruxo 5 com a '
            + 'invocação mostrava 1 ataque em vez de 2. Vale também para '
            + 'Bruxo de classe única.',
          'A Lâmina Devoradora (Bruxo 12) leva a 3 ataques, como o livro '
            + 'descreve.',
          'Como manda a regra de multiclasse, a Lâmina Sedenta NÃO soma '
            + 'com o Ataque Extra de outra classe: um Bruxo 5/Guerreiro 5 '
            + 'tem 2 ataques, não 3.',
        ],
      },
      {
        grupo: '❤️ Pontos de Vida com Constituição muito baixa',
        itens: [
          'O livro garante no mínimo 1 Ponto de Vida POR NÍVEL. O '
            + 'recálculo aplicava esse mínimo só ao total, então um '
            + 'personagem de Constituição muito baixa terminava com 1 '
            + 'Ponto de Vida em vez do que a regra concede — um '
            + 'Feiticeiro 5 com Constituição 1 dava 1 e passa a dar 5. '
            + 'Agora o recálculo e a subida de nível concordam.',
        ],
      },
    ],
  },
  {
    versao: '2.2.22',
    data: '2026-08-25',
    rotulo: 'Magias em multiclasse',
    resumo: 'Os espaços de magia de personagens com mais de uma classe '
      + 'passam a seguir a regra do livro: a tabela de Conjurador '
      + 'Multiclasse quando há duas ou mais classes que conjuram, e a '
      + 'Magia de Pacto do Bruxo como reserva própria, que volta num '
      + 'Descanso Curto.',
    melhorias: [
      {
        grupo: '🔮 Espaços de magia pela regra de multiclasse',
        itens: [
          'Com DUAS ou mais classes conjuradoras, os espaços de magia '
            + 'passam a sair da tabela de Conjurador Multiclasse, pelo '
            + 'nível de conjurador somado das classes — um Paladino '
            + '6/Mago 4 tem espaços de nível de conjurador 7 (metade do '
            + 'Paladino arredondada para cima, mais o nível cheio do '
            + 'Mago), não de nível 10.',
          'Com UMA classe conjuradora só, os espaços voltam a sair da '
            + 'tabela DELA, no nível DELA — um Mago 5/Bárbaro 5 tinha '
            + 'espaços de Mago no nível 10 (o total do personagem) e '
            + 'passa a ter de Mago no nível 5, o nível real da classe. '
            + 'Isso REDUZ os espaços de fichas assim, porque o valor '
            + 'antigo estava inflado.',
          'A Magia de Pacto do Bruxo vira uma reserva separada dos '
            + 'espaços de Conjuração normais. Ela volta ao completar um '
            + 'Descanso CURTO, sem devolver os espaços de Conjuração — '
            + 'que só voltam no Descanso Longo, como sempre.',
          'Quem tem as duas reservas (por exemplo um Bruxo/Mago) ganha '
            + 'um seletor para escolher de qual reserva sai o espaço ao '
            + 'conjurar. Quem tem só uma reserva não vê nada de novo.',
          'A ficha impressa e o PDF passam a mostrar os espaços de cada '
            + 'reserva separadamente.',
        ],
      },
    ],
  },
  {
    versao: '2.2.21',
    data: '2026-08-25',
    rotulo: 'PV em multiclasse',
    resumo: 'Pontos de Vida, Dados de Vida e os dois descansos passam a '
      + 'somar e restaurar pela classe certa em personagens com mais de '
      + 'uma classe — e a Resiliência Dracônica é corrigida: ela dava 2 '
      + 'Pontos de Vida a mais do que o livro concede.',
    melhorias: [
      {
        grupo: '❤️ Pontos de Vida somam cada classe',
        itens: [
          'A fórmula de Pontos de Vida máximos passa a somar o dado de '
            + 'vida de CADA classe, como o livro manda, em vez de usar só '
            + 'o dado da classe escolhida na criação para o nível total '
            + 'inteiro — um Mago 5/Bárbaro 5 calcularia 77 Pontos de Vida '
            + 'com a fórmula nova, contra 62 da antiga. A mudança vale a '
            + 'partir de agora para ficha corrompida (quando o app '
            + 'recalcula o PV do zero) e para criação e subida de nível '
            + 'quando esse cálculo chegar; fichas já criadas continuam '
            + 'com o valor gravado e não são recalculadas sozinhas.',
        ],
      },
      {
        grupo: '🎲 Dados de Vida por tipo',
        itens: [
          'Os Dados de Vida deixam de ser um número só e passam a ser '
            + 'reservas separadas por TIPO de dado. Um Clérigo 5/Paladino '
            + '5 vê cinco d8 e cinco d10, cada um com o próprio total — '
            + 'antes a ficha somava tudo como um único tipo de dado.',
          'Quando o personagem tem mais de um tipo de Dado de Vida, os '
            + 'modais de "Usar DV" e Descanso Curto ganham um seletor para '
            + 'escolher de qual reserva gastar. Quem tem um tipo só não vê '
            + 'nada de novo.',
          'O gasto de Dados de Vida deixa de se perder. Num personagem '
            + 'com dois tipos de dado, o gasto era descartado em silêncio '
            + 'na próxima vez que a ficha era aberta.',
        ],
      },
      {
        grupo: '🏕️ Descansos restauram a classe certa',
        itens: [
          'Os dois descansos passam a restaurar o recurso da classe '
            + 'dona dele, não só da classe escolhida na criação. Um '
            + 'Ladino 5/Monge 5 nunca recuperava os Pontos de Foco do '
            + 'Monge, e um Mago 5/Clérigo 5 ficava com "Canalizar '
            + 'Divindade 0/2" para sempre — os dois casos agora recarregam '
            + 'normalmente.',
        ],
      },
      {
        grupo: '🏷️ Cabeçalho com todas as classes',
        itens: [
          'O cabeçalho da ficha passa a mostrar todas as classes do '
            + 'personagem, não só a primeira: "Mago 5 / Bárbaro 5 · Nível '
            + '10", em vez de só "Mago 10".',
        ],
      },
    ],
    correcoes: [
      {
        grupo: '🐉 Resiliência Dracônica',
        itens: [
          'A Resiliência Dracônica do Feiticeiro (subclasse Feitiçaria '
            + 'Dracônica) dava 2 Pontos de Vida A MAIS do que o livro '
            + 'concede. Classes.md:3074 dá +3 no nível 3 de Feiticeiro e '
            + '+1 a cada nível de Feiticeiro depois — ou seja, +N Pontos '
            + 'de Vida no nível N de Feiticeiro —, e o app calculava N+2. '
            + 'TODO FEITICEIRO DRACÔNICO EXISTENTE VAI PERDER 2 PONTOS DE '
            + 'VIDA MÁXIMOS; o ajuste acontece sozinho, sem nada para o '
            + 'jogador fazer, na próxima vez que a ficha for aberta.',
          'Além do valor errado, num personagem em que o Feiticeiro não '
            + 'era a classe escolhida na criação o bônus simplesmente não '
            + 'aparecia — e, quando era, o app usava o nível total do '
            + 'personagem em vez do nível só de Feiticeiro.',
        ],
      },
      {
        grupo: '🖨️ Ficha impressa e PDF',
        itens: [
          'A ficha impressa sempre mostrava "0" de PV Temporário e '
            + 'sempre mostrava a reserva de Dados de Vida cheia, mesmo '
            + 'depois de gastar dados — os dois campos passam a mostrar '
            + 'o valor real da ficha.',
          'O PDF sempre mostrava "0" de PV Temporário, mesmo depois de '
            + 'gastar dados — o campo passa a mostrar o valor real da '
            + 'ficha. (O PDF nunca chegou a imprimir Dados de Vida, '
            + 'então não tinha o segundo defeito.)',
        ],
      },
    ],
  },
  {
    versao: '2.2.20',
    data: '2026-08-24',
    rotulo: 'Combate em multiclasse',
    resumo: 'Personagens com mais de uma classe passam a ter Ataque Extra, '
      + 'Classe de Armadura, Maestria em Arma, deslocamento e iniciativa '
      + 'calculados pela classe certa — e ganham um seletor novo para '
      + 'escolher a CA quando há mais de uma forma de calculá-la.',
    melhorias: [
      {
        grupo: '🛡️ Seletor de Classe de Armadura',
        itens: [
          'Quando o personagem tem mais de uma forma de calcular a CA (por '
            + 'exemplo, Defesa sem Armadura do Monge e Resiliência '
            + 'Dracônica do Feiticeiro), a caixa de CA da ficha ganhou um '
            + 'seletor com o nome da classe usada. Por padrão o app usa o '
            + 'maior valor; o seletor deixa escolher a outra classe.',
          'Vestir um Escudo pode reduzir as opções a uma só (o Monge, por '
            + 'exemplo, perde a Defesa sem Armadura com Escudo) — nesse '
            + 'caso o seletor some sozinho.',
          'Quem só tem uma forma de calcular a CA, com ou sem multiclasse, '
            + 'não vê nada de novo.',
        ],
      },
    ],
    correcoes: [
      {
        grupo: '⚔️ Ataque Extra',
        itens: [
          'Personagens com mais de uma classe que concede Ataque Extra '
            + '(Bárbaro, Guerreiro, Guardião, Paladino, Monge e o Bardo do '
            + 'Colégio da Bravura) agora usam o maior número de ataques '
            + 'entre as classes — nunca a soma. Antes, o app conferia o '
            + 'nível total misturado com a classe inicial, e o número de '
            + 'ataques podia sair errado para mais ou para menos, conforme '
            + 'a ordem em que as classes foram escolhidas.',
        ],
      },
      {
        grupo: '🥋 Maestria em Arma',
        itens: [
          'Quem tem mais de uma classe que concede Maestria em Arma '
            + '(Bárbaro, Guerreiro, Guardião, Paladino, Ladino) passa a '
            + 'ter um único número de maestrias na ficha inteira — o maior '
            + 'limite entre as classes, nunca a soma. Um Bárbaro 4 (3 '
            + 'maestrias) com Guerreiro 3 (3 maestrias) fica com 3, não 6. '
            + 'Antes, cada bloco da ficha mostrava o limite da sua própria '
            + 'classe, e podiam aparecer números diferentes e '
            + 'contraditórios na mesma tela.',
          'O botão de trocar maestrias no Descanso Longo passa a aparecer '
            + 'para quem tem qualquer classe que a conceda, não só a '
            + 'primeira escolhida. Um Mago 5/Guerreiro 5 nunca via a '
            + 'opção, porque o app só olhava a classe inicial (Mago).',
          'A lista de armas oferecidas no modal de Maestrias continua '
            + 'vindo só da classe inicial — esse ajuste fica para uma '
            + 'próxima versão.',
        ],
      },
      {
        grupo: '🛡️ Salvaguardas',
        itens: [
          'Sobrevivente Disciplinado (Monge 14) e Sentido de Perigo '
            + '(Bárbaro 2) passam a olhar o nível na própria classe, não o '
            + 'nível total do personagem. Um Monge 10/Ladino 4 ganhava '
            + 'essas proficiências antes da hora, e um Ladino 1/Monge 14 '
            + 'não as recebia — porque o app olhava a classe escolhida na '
            + 'criação.',
          'Mente Escorregadia (Ladino 15) passou a marcar de fato a '
            + 'proficiência em salvaguardas de Sabedoria e Carisma na '
            + 'grade da ficha. A ficha já mostrava o texto da '
            + 'característica; a grade nunca marcava nada — mesmo em '
            + 'personagem de classe única, sem relação com multiclasse.',
        ],
      },
      {
        grupo: '🏃 Deslocamento, iniciativa e subclasses',
        itens: [
          'Movimento Rápido (Bárbaro), Movimento sem Armadura (Monge), '
            + 'Errante e Aura de Vivacidade (Guardião e Paladino), '
            + 'Instintos Primitivos e Atleta Extraordinário (vantagem em '
            + 'Iniciativa) e características de subclasse ligadas a '
            + 'deslocamento passam a olhar o nível e a subclasse da classe '
            + 'certa em personagens com mais de uma classe. Antes, todas '
            + 'essas contas usavam a classe escolhida na criação, mesmo '
            + 'quando a característica pertencia à segunda classe.',
        ],
      },
    ],
  },
  {
    versao: '2.2.19',
    data: '2026-08-24',
    rotulo: 'Botões por classe',
    resumo: 'Num personagem com mais de uma classe, os botões do bloco da '
      + 'segunda classe voltaram a responder ao clique — era a promessa que '
      + 'a versão anterior deixou em aberto.',
    correcoes: [
      {
        grupo: '⚔️ Recursos de classe',
        itens: [
          'A ficha já mostrava, desde a versão anterior, o botão certo em '
            + 'cada bloco. Clicar nele não fazia nada: o app conferia o nível '
            + 'e a proficiência sempre pela primeira classe, então o botão da '
            + 'segunda classe recusava o uso ou usava o número errado. Agora '
            + 'cada clique olha para a classe (e o nível naquela classe) do '
            + 'próprio bloco.',
          'A caixa de resumo do topo da ficha também passou a contar pelo '
            + 'nível na classe: o aviso da Fúria Implacável anunciava um total '
            + 'de Pontos de Vida diferente do que a janela mostrava ao clicar, '
            + 'e os botões de Fúria Persistente, de Inspiração pela iniciativa '
            + 'e de Restauração Feiticeira apareciam antes da hora, só para '
            + 'não funcionar.',
          'No modal de Maestrias em Arma, o título e o número de maestrias '
            + 'já são os da classe certa, mas a lista de armas oferecidas '
            + 'ainda é a da primeira classe — isso fica para uma próxima '
            + 'versão.',
          'Para quem tem uma classe só, nada muda.',
        ],
      },
    ],
  },
  {
    versao: '2.2.18',
    data: '2026-08-23',
    rotulo: 'Recursos por classe',
    resumo: 'Num personagem com mais de uma classe, cada bloco da ficha passa '
      + 'a mostrar os recursos e botões da sua própria classe.',
    correcoes: [
      {
        grupo: '⚔️ Recursos de classe',
        itens: [
          'Quem tem duas classes via os botões da primeira classe repetidos no '
            + 'bloco da segunda. Agora cada bloco mostra só o que é dele. Os '
            + 'botões da segunda classe ainda não respondem ao clique; isso '
            + 'vem na próxima versão.',
          'Características que escalam por nível passam a usar o nível '
            + 'naquela classe, não o nível total do personagem.',
          'Para quem tem uma classe só, nada muda.',
        ],
      },
    ],
  },
  {
    versao: '2.2.17',
    data: '2026-08-23',
    rotulo: 'Características por classe',
    resumo: 'A ficha de um personagem com mais de uma classe passa a listar '
      + 'as características de cada classe separadamente, filtradas pelo '
      + 'nível naquela classe.',
    melhorias: [
      {
        grupo: '📚 Características de classe',
        itens: [
          'Quem tem mais de uma classe vê um bloco por classe, cada um com '
            + 'as características até o nível daquela classe. Antes, a ficha '
            + 'filtrava tudo pelo nível total e mostrava características que '
            + 'o personagem ainda não tinha.',
          'Para quem tem uma classe só, nada muda.',
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
