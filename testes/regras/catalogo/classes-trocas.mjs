// ============================================================
// Direitos de troca das 12 classes base, transcritos do livro.
// Cada entrada é uma frase do livro que concede ao jogador o direito
// de SUBSTITUIR uma escolha anterior — categoria que a suíte nunca
// tinha olhado, e onde mora o bug do Estilo de Luta do Guerreiro.
//
// Transcrito de `Informacoes Separadas/Classes.md`. Nada aqui veio de
// `dados/` nem de `site/js/`.
//
// Levantamento (2 rodadas — ver `task-1-report.md` para a lista completa
// de termos buscados e o que cada um trouxe):
//   1) `grep -n "pode substituir" "Informacoes Separadas/Classes.md"` — 34
//      ocorrências. Bom para achar cláusulas com esse verbo exato, mas
//      cego a variações ("alterar", "mudar", "definir... substituindo").
//   2) Varredura ampliada com outros verbos/formas ("alterar", "trocar",
//      "mudar", "escolher outr", "no lugar de", "em vez de") + busca
//      dirigida por cabeçalhos "**Mudando..."/"**Substituindo..." e por
//      "### Nível 1: Maestria em Arma" — achou 8 cláusulas de classe base
//      que a primeira rodada tinha perdido (Maestria em Arma de Bárbaro/
//      Guardião/Guerreiro/Ladino/Paladino, que usa "alterar" em vez de
//      "substituir"; e Magia Preparada de Clérigo/Druida/Mago, que usa
//      "pode definir/mudar... substituindo" em vez de "pode substituir").
//      LIÇÃO PARA A PRÓXIMA RODADA/DOMÍNIO: buscar cabeçalho característico
//      (`**Mudando`, `**Trocando`, `**Substituindo`) e título de seção
//      (`### Nível X: <Nome da Característica>`) achou tudo com muito
//      menos ruído do que testar verbos soltos — "em vez de"/"escolher
//      outr" deram 28 ocorrências e nenhuma era cláusula de troca.
// Cláusulas de subclasse e de combate/tempo real sem estado persistido
// foram descartadas — ver `task-1-report.md` para a classificação
// completa, linha a linha, de toda ocorrência de toda busca.
// ============================================================

// `observavelEmUnidade: false` NÃO é escape: é o registro de que o app
// aplica essa troca por um caminho que o motor de unidade não enxerga
// (mutação direta de `char` em levelup-ui.js:1392-1411, ANTES da chamada
// a subirDeNivel, então `opcoes` nunca a vê), ou por um caminho de edição
// livre na ficha/descanso longo que nem passa pelo fluxo de subida de
// nível. Uma asserção ali seria cega por construção, e a lacuna que ela
// produzisse seria falsa.
//
// `formaDaDivergencia` distingue, para toda entrada (observável ou não),
// COMO o app se desvia da condição que o livro impõe para exercer o
// direito — sem essa distinção, um motivo "o app não implementa" vira
// superafirmação quando na verdade o app implementa demais, e "o app
// libera livre" vira superafirmação quando na verdade ele checa alguma
// coisa, só que a coisa errada. Quatro valores:
//   - 'conforme'                  → o app concede a troca pelo(s)
//     mesmo(s) gatilho(s) que o livro exige, nem mais nem menos. Sem
//     divergência.
//   - 'direito-sem-condicao'      → o app NÃO CHECA NADA: dá para trocar
//     a qualquer momento, sem nenhum gatilho/evento amarrado. Mais
//     PERMISSIVO que o livro.
//   - 'direito-com-condicao-errada' → o app CHECA alguma coisa — a troca
//     está amarrada a algum gatilho/evento — mas o gatilho não é (ou não
//     é só) o que o livro pede para aquela classe. Pode ser mais
//     permissivo (ex.: o livro só permite "ao subir de nível" e o app
//     TAMBÉM libera a cada Descanso Longo, um gatilho extra e mais
//     frequente) ou mais restritivo (ex.: o livro permite "a cada
//     Descanso Longo" e o único caminho do app só libera "ao subir de
//     nível", um gatilho mais raro). O `motivoSeNaoObservavel` de cada
//     entrada com este valor diz explicitamente qual das duas direções
//     se aplica.
//   - 'direito-ausente'           → o direito não existe no app por
//     NENHUM gatilho: ou não há campoApp nenhum (não há estado a que a
//     troca possa aderir), ou existe um campo mas nenhum caminho de
//     código jamais o exerce para aquela classe (código morto/excluído
//     por uma condição que nunca é satisfeita). Mais RESTRITIVO que o
//     livro — na prática, o direito não é exercível de jeito nenhum.
export const TROCAS = [
  // ---------------------------------------------------------------
  // Truques (só têm um caminho no app: a troca de char.magias_conhecidas
  // em levelup-ui.js:1402-1411, disparada só durante o fluxo de subida de
  // nível — não há duplicata via Descanso Longo, hp-descanso.js filtra
  // apenas magias_preparadas com circulo > 0). Para as classes cujo livro
  // condiciona a troca a "atingir um nível", esse único gatilho já é o
  // gatilho certo → 'conforme'. O Mago é exceção: seu truque é
  // condicionado no livro a Descanso Longo, não a nível.
  // ---------------------------------------------------------------
  {
    classe: 'Bardo',
    oQueTroca: 'Truque',
    quando: 'sempre que atinge um nível de Bardo',
    livro: 'Classes.md:418',
    campoApp: 'magias_conhecidas',
    observavelEmUnidade: false,
    motivoSeNaoObservavel: 'Troca de truque aplicada por mutação direta de char.magias_conhecidas em levelup-ui.js:1402-1411 (bloco "Troca de truque"), antes da chamada a subirDeNivel; opcoes nunca vê essa troca.',
    formaDaDivergencia: 'conforme',
  },
  {
    classe: 'Bruxo',
    oQueTroca: 'Truque',
    quando: 'ao alcançar um nível de Bruxo',
    livro: 'Classes.md:894',
    campoApp: 'magias_conhecidas',
    observavelEmUnidade: false,
    motivoSeNaoObservavel: 'Troca de truque aplicada por mutação direta de char.magias_conhecidas em levelup-ui.js:1402-1411, antes da chamada a subirDeNivel; opcoes nunca vê essa troca.',
    formaDaDivergencia: 'conforme',
  },
  {
    classe: 'Clérigo',
    oQueTroca: 'Truque',
    quando: 'sempre que alcança um nível de Clérigo',
    livro: 'Classes.md:1544',
    campoApp: 'magias_conhecidas',
    observavelEmUnidade: false,
    motivoSeNaoObservavel: 'Troca de truque aplicada por mutação direta de char.magias_conhecidas em levelup-ui.js:1402-1411, antes da chamada a subirDeNivel; opcoes nunca vê essa troca.',
    formaDaDivergencia: 'conforme',
  },
  {
    classe: 'Druida',
    oQueTroca: 'Truque',
    quando: 'sempre que alcança um nível de Druida',
    livro: 'Classes.md:2030',
    campoApp: 'magias_conhecidas',
    observavelEmUnidade: false,
    motivoSeNaoObservavel: 'Troca de truque aplicada por mutação direta de char.magias_conhecidas em levelup-ui.js:1402-1411, antes da chamada a subirDeNivel; opcoes nunca vê essa troca.',
    formaDaDivergencia: 'conforme',
  },
  {
    classe: 'Feiticeiro',
    oQueTroca: 'Truque',
    quando: 'ao alcançar um nível de Feiticeiro',
    livro: 'Classes.md:2637',
    campoApp: 'magias_conhecidas',
    observavelEmUnidade: false,
    motivoSeNaoObservavel: 'Troca de truque aplicada por mutação direta de char.magias_conhecidas em levelup-ui.js:1402-1411, antes da chamada a subirDeNivel; opcoes nunca vê essa troca.',
    formaDaDivergencia: 'conforme',
  },
  {
    classe: 'Guardião',
    oQueTroca: 'Truque de Combatente Druídico',
    quando: 'sempre que atingir um nível de Guardião (apenas se escolheu Combatente Druídico em vez de um talento de Estilo de Luta)',
    livro: 'Classes.md:3312',
    campoApp: 'magias_conhecidas',
    observavelEmUnidade: false,
    motivoSeNaoObservavel: 'Combatente Druídico concede truques de Druida pelo mesmo mecanismo genérico de truques da classe; a troca é aplicada por mutação direta de char.magias_conhecidas em levelup-ui.js:1402-1411, antes da chamada a subirDeNivel.',
    formaDaDivergencia: 'conforme',
  },
  {
    classe: 'Mago',
    oQueTroca: 'Truque',
    quando: 'ao completar um Descanso Longo',
    livro: 'Classes.md:4592',
    campoApp: 'magias_conhecidas',
    observavelEmUnidade: false,
    // Não é 'direito-ausente': o direito EXISTE e FUNCIONA no app, só que
    // amarrado ao gatilho errado. É 'direito-com-condicao-errada', e a
    // direção é RESTRITIVA: o livro condiciona a troca a qualquer
    // Descanso Longo; o único caminho do app (levelup-ui.js:1402-1411) só
    // dispara durante o fluxo de subida de nível. Um jogador que completa
    // um Descanso Longo sem subir de nível não consegue trocar o truque
    // do Mago no app, embora o livro permita.
    motivoSeNaoObservavel: 'Troca de truque aplicada por mutação direta de char.magias_conhecidas em levelup-ui.js:1402-1411, mas esse caminho só dispara durante a subida de nível — não a cada Descanso Longo como o livro exige para o Mago; opcoes nunca vê essa troca de qualquer forma.',
    formaDaDivergencia: 'direito-com-condicao-errada',
  },
  {
    classe: 'Paladino',
    oQueTroca: 'Truque de Combatente Abençoado',
    quando: 'sempre que atinge um nível de Paladino (apenas se escolheu Combatente Abençoado em vez de um talento de Estilo de Luta)',
    livro: 'Classes.md:5539',
    campoApp: 'magias_conhecidas',
    observavelEmUnidade: false,
    motivoSeNaoObservavel: 'Combatente Abençoado concede truques de Clérigo pelo mesmo mecanismo genérico de truques da classe; a troca é aplicada por mutação direta de char.magias_conhecidas em levelup-ui.js:1402-1411, antes da chamada a subirDeNivel.',
    formaDaDivergencia: 'conforme',
  },

  // ---------------------------------------------------------------
  // Magia Preparada: todas com DOIS caminhos no app, e nenhum dos dois é
  // "sem condição" — cada um está amarrado a um evento específico:
  //   (a) troca genérica de char.magias_preparadas em
  //       levelup-ui.js:1392-1411, só durante o fluxo de subida de nível
  //       (ctx.ehConjurador é checado para QUALQUER classe conjuradora,
  //       sem filtrar pelo gatilho que o livro pede para ela);
  //   (b) mostrarTrocaMagias/mostrarTrocaMagiaConhecida em
  //       site/js/sheet/grimorio.js, disparadas só por
  //       site/js/sheet/hp-descanso.js ao completar um Descanso Longo
  //       (também sem filtrar pela classe).
  // Ou seja: o app checa SIM alguma coisa (nunca é "a qualquer
  // momento") — mas checa os dois gatilhos ao mesmo tempo pra TODA
  // classe conjuradora, então toda classe ganha um gatilho extra além do
  // que o livro pede especificamente pra ela. Direção: sempre mais
  // PERMISSIVO (o app nunca fecha o gatilho certo, só adiciona um a
  // mais) → 'direito-com-condicao-errada' em todas, nunca
  // 'direito-sem-condicao' (isso exigiria zero gatilho, o que não é o
  // caso aqui) nem 'conforme' (isso exigiria só o gatilho do livro).
  // ---------------------------------------------------------------
  {
    classe: 'Bardo',
    oQueTroca: 'Magia Preparada',
    quando: 'sempre que atinge um nível de Bardo',
    livro: 'Classes.md:430',
    campoApp: 'magias_preparadas',
    observavelEmUnidade: false,
    motivoSeNaoObservavel: 'Troca de magia preparada aplicada por mutação direta de char.magias_preparadas em levelup-ui.js:1392-1411 (gatilho certo: subida de nível), antes da chamada a subirDeNivel; opcoes nunca vê essa troca. Mas o app TAMBÉM libera a mesma troca a cada Descanso Longo via mostrarTrocaMagiaConhecida (site/js/sheet/grimorio.js:1092, chamada só por hp-descanso.js) — gatilho extra que o livro não prevê para o Bardo. Direção: mais permissivo.',
    formaDaDivergencia: 'direito-com-condicao-errada',
  },
  {
    classe: 'Bruxo',
    oQueTroca: 'Magia de Pacto Preparada',
    quando: 'sempre que ganha um nível de Bruxo',
    livro: 'Classes.md:908',
    campoApp: 'magias_preparadas',
    observavelEmUnidade: false,
    motivoSeNaoObservavel: 'Troca de magia preparada aplicada por mutação direta de char.magias_preparadas em levelup-ui.js:1392-1411 (gatilho certo: subida de nível), antes da chamada a subirDeNivel; opcoes nunca vê essa troca. Mas o app TAMBÉM libera a mesma troca a cada Descanso Longo via mostrarTrocaMagiaConhecida (grimorio.js:1092, chamada só por hp-descanso.js) — gatilho extra que o livro não prevê para o Bruxo. Direção: mais permissivo.',
    formaDaDivergencia: 'direito-com-condicao-errada',
  },
  {
    classe: 'Clérigo',
    oQueTroca: 'Magia Preparada',
    quando: 'sempre que completa um Descanso Longo',
    livro: 'Classes.md:1556',
    campoApp: 'magias_preparadas',
    observavelEmUnidade: false,
    motivoSeNaoObservavel: 'Troca de magia preparada disponível via mostrarTrocaMagias (grimorio.js:712, chamada só por hp-descanso.js ao completar Descanso Longo) — gatilho certo. Mas o app TAMBÉM libera a mesma troca a cada subida de nível via mutação direta de char.magias_preparadas em levelup-ui.js:1392-1411, independente de ter descansado — gatilho extra que o livro não prevê para o Clérigo. opcoes nunca vê nenhum dos dois caminhos. Direção: mais permissivo.',
    formaDaDivergencia: 'direito-com-condicao-errada',
  },
  {
    classe: 'Druida',
    oQueTroca: 'Magia Preparada',
    quando: 'sempre que completa um Descanso Longo',
    livro: 'Classes.md:2042',
    campoApp: 'magias_preparadas',
    observavelEmUnidade: false,
    motivoSeNaoObservavel: 'Troca de magia preparada disponível via mostrarTrocaMagias (grimorio.js:712, chamada só por hp-descanso.js ao completar Descanso Longo) — gatilho certo. Mas o app TAMBÉM libera a mesma troca a cada subida de nível via mutação direta de char.magias_preparadas em levelup-ui.js:1392-1411, independente de ter descansado — gatilho extra que o livro não prevê para o Druida. opcoes nunca vê nenhum dos dois caminhos. Direção: mais permissivo.',
    formaDaDivergencia: 'direito-com-condicao-errada',
  },
  {
    classe: 'Feiticeiro',
    oQueTroca: 'Magia Preparada',
    quando: 'sempre que obtém um nível de Feiticeiro',
    livro: 'Classes.md:2649',
    campoApp: 'magias_preparadas',
    observavelEmUnidade: false,
    motivoSeNaoObservavel: 'Troca de magia preparada aplicada por mutação direta de char.magias_preparadas em levelup-ui.js:1392-1411 (gatilho certo: subida de nível), antes da chamada a subirDeNivel; opcoes nunca vê essa troca. Mas o app TAMBÉM libera a mesma troca a cada Descanso Longo via mostrarTrocaMagiaConhecida (grimorio.js:1092, chamada só por hp-descanso.js) — gatilho extra que o livro não prevê para o Feiticeiro. Direção: mais permissivo.',
    formaDaDivergencia: 'direito-com-condicao-errada',
  },
  {
    classe: 'Guardião',
    oQueTroca: 'Magia Preparada',
    quando: 'sempre que completa um Descanso Longo',
    livro: 'Classes.md:3290',
    campoApp: 'magias_preparadas',
    observavelEmUnidade: false,
    motivoSeNaoObservavel: 'Troca de magia preparada disponível via mostrarTrocaMagias (grimorio.js:712, chamada só por hp-descanso.js ao completar Descanso Longo) — gatilho certo. Mas o app TAMBÉM libera a mesma troca a cada subida de nível via mutação direta de char.magias_preparadas em levelup-ui.js:1392-1411, independente de ter descansado — gatilho extra que o livro não prevê para o Guardião. opcoes nunca vê nenhum dos dois caminhos. Direção: mais permissivo.',
    formaDaDivergencia: 'direito-com-condicao-errada',
  },
  {
    classe: 'Mago',
    oQueTroca: 'Magia Preparada',
    quando: 'ao completar um Descanso Longo',
    livro: 'Classes.md:4610',
    campoApp: 'magias_preparadas',
    observavelEmUnidade: false,
    motivoSeNaoObservavel: 'Troca de magia preparada disponível via mostrarTrocaMagias (grimorio.js:712, chamada só por hp-descanso.js ao completar Descanso Longo) — gatilho certo. Mas o app TAMBÉM libera a mesma troca a cada subida de nível via mutação direta de char.magias_preparadas em levelup-ui.js:1392-1411, independente de ter descansado — gatilho extra que o livro não prevê para o Mago. opcoes nunca vê nenhum dos dois caminhos. Direção: mais permissivo.',
    formaDaDivergencia: 'direito-com-condicao-errada',
  },
  {
    classe: 'Paladino',
    oQueTroca: 'Magia Preparada',
    quando: 'sempre que completa um Descanso Longo',
    livro: 'Classes.md:5511',
    campoApp: 'magias_preparadas',
    observavelEmUnidade: false,
    motivoSeNaoObservavel: 'Troca de magia preparada disponível via mostrarTrocaMagias (grimorio.js:712, chamada só por hp-descanso.js ao completar Descanso Longo) — gatilho certo. Mas o app TAMBÉM libera a mesma troca a cada subida de nível via mutação direta de char.magias_preparadas em levelup-ui.js:1392-1411, independente de ter descansado — gatilho extra que o livro não prevê para o Paladino. opcoes nunca vê nenhum dos dois caminhos. Direção: mais permissivo.',
    formaDaDivergencia: 'direito-com-condicao-errada',
  },

  // ---------------------------------------------------------------
  // Recursos editados livremente na ficha, ZERO gatilho de qualquer tipo
  // (confirmado lendo o código: nenhum dos três tem checagem de nível,
  // de descanso, nem `disabled` condicional no botão que abre o editor).
  // Por isso são 'direito-sem-condicao' de verdade, não
  // 'direito-com-condicao-errada' — não há condição nenhuma, certa ou
  // errada, para verificar.
  // ---------------------------------------------------------------
  {
    classe: 'Bruxo',
    oQueTroca: 'Invocação Mística',
    quando: 'ao alcançar um nível de Bruxo',
    livro: 'Classes.md:884',
    campoApp: 'recursos.bruxo.invocacoes',
    observavelEmUnidade: false,
    motivoSeNaoObservavel: 'Invocações são um array editado livremente na ficha (site/js/sheet/classes/bruxo.js), sem nenhum gate de nível ou descanso: o jogador adiciona/remove a qualquer momento, sem checagem de evento. Não existe opcoes.* para essa troca. Direção: mais permissivo (o livro condiciona a subir de nível; o app não condiciona a nada).',
    formaDaDivergencia: 'direito-sem-condicao',
  },
  {
    classe: 'Bruxo',
    oQueTroca: 'Magia de Arcana Mística',
    quando: 'ao alcançar um nível de Bruxo',
    livro: 'Classes.md:940',
    campoApp: 'recursos.bruxo.arcanum',
    observavelEmUnidade: false,
    motivoSeNaoObservavel: 'Cada círculo de Arcana Mística (6-9) é editado diretamente na ficha via <select> (site/js/sheet/classes/bruxo.js:581-585), fora do fluxo de subirDeNivel/opcoes, sem nenhum gate de nível ou descanso. Direção: mais permissivo.',
    formaDaDivergencia: 'direito-sem-condicao',
  },
  {
    classe: 'Feiticeiro',
    oQueTroca: 'Opção de Metamagia',
    quando: 'ao atingir um nível de Feiticeiro',
    livro: 'Classes.md:2694',
    campoApp: 'recursos.feiticeiro.metamagias',
    observavelEmUnidade: false,
    motivoSeNaoObservavel: 'Metamagias conhecidas são reconfiguradas via modal na ficha (site/js/sheet/habilidades.js:745-812), com botão sempre habilitado (site/js/sheet/ficha.js:279, sem `disabled` condicional) e sem checagem de nível/descanso dentro do modal — o jogador pode reabrir a qualquer momento. Direção: mais permissivo.',
    formaDaDivergencia: 'direito-sem-condicao',
  },

  // ---------------------------------------------------------------
  // Maestria em Arma — achada só na rodada ampliada (usa "alterar", não
  // "substituir"). Tem DOIS caminhos, um deles genuinamente sem gate: o
  // botão "Maestrias" da ficha (habilidades.js:2280) chama
  // abrirModalMaestrias() sem nenhuma checagem de nível/descanso — puro
  // grid de checkboxes com "Salvar". Como esse caminho já é irrestrito
  // por si só, a entrada é 'direito-sem-condicao' (não
  // 'direito-com-condicao-errada' — não importa que exista TAMBÉM um
  // segundo caminho corretamente gated ao Descanso Longo
  // (abrirModalTrocaMaestriaDescanso, hp-descanso.js): já que o botão
  // livre nunca é bloqueado, o direito é exercível a qualquer momento).
  // ---------------------------------------------------------------
  {
    classe: 'Bárbaro',
    oQueTroca: 'Tipo de Arma com Maestria',
    quando: 'sempre que completa um Descanso Longo',
    livro: 'Classes.md:97',
    campoApp: 'maestrias_arma',
    observavelEmUnidade: false,
    motivoSeNaoObservavel: 'char.maestrias_arma é editado via botão sempre disponível na ficha (abrirModalMaestrias, site/js/sheet/maestrias.js, chamado de habilidades.js:2280), sem nenhuma checagem de nível/descanso dentro do modal — puro grid de checkboxes. Também há abrirModalTrocaMaestriaDescanso, corretamente gated ao Descanso Longo (hp-descanso.js), mas o botão livre já basta para tornar a troca irrestrita. Nenhum dos caminhos passa por opcoes/subirDeNivel. Direção: mais permissivo.',
    formaDaDivergencia: 'direito-sem-condicao',
  },
  {
    classe: 'Guardião',
    oQueTroca: 'Tipo de Arma com Maestria',
    quando: 'sempre que completa um Descanso Longo',
    livro: 'Classes.md:3306',
    campoApp: 'maestrias_arma',
    observavelEmUnidade: false,
    motivoSeNaoObservavel: 'char.maestrias_arma é editado via botão sempre disponível na ficha (abrirModalMaestrias, site/js/sheet/maestrias.js, chamado de habilidades.js:2280), sem nenhuma checagem de nível/descanso dentro do modal — puro grid de checkboxes. Também há abrirModalTrocaMaestriaDescanso, corretamente gated ao Descanso Longo (hp-descanso.js), mas o botão livre já basta para tornar a troca irrestrita. Nenhum dos caminhos passa por opcoes/subirDeNivel. Direção: mais permissivo.',
    formaDaDivergencia: 'direito-sem-condicao',
  },
  {
    classe: 'Guerreiro',
    oQueTroca: 'Tipo de Arma com Maestria',
    quando: 'sempre que completa um Descanso Longo',
    livro: 'Classes.md:3816',
    campoApp: 'maestrias_arma',
    observavelEmUnidade: false,
    motivoSeNaoObservavel: 'char.maestrias_arma é editado via botão sempre disponível na ficha (abrirModalMaestrias, site/js/sheet/maestrias.js, chamado de habilidades.js:2280), sem nenhuma checagem de nível/descanso dentro do modal — puro grid de checkboxes. Também há abrirModalTrocaMaestriaDescanso, corretamente gated ao Descanso Longo (hp-descanso.js), mas o botão livre já basta para tornar a troca irrestrita. Nenhum dos caminhos passa por opcoes/subirDeNivel. Direção: mais permissivo.',
    formaDaDivergencia: 'direito-sem-condicao',
  },
  {
    classe: 'Ladino',
    oQueTroca: 'Tipo de Arma com Maestria',
    quando: 'ao completar um Descanso Longo',
    livro: 'Classes.md:4226',
    campoApp: 'maestrias_arma',
    observavelEmUnidade: false,
    motivoSeNaoObservavel: 'char.maestrias_arma é editado via botão sempre disponível na ficha (abrirModalMaestrias, site/js/sheet/maestrias.js, chamado de habilidades.js:2280), sem nenhuma checagem de nível/descanso dentro do modal — puro grid de checkboxes. Também há abrirModalTrocaMaestriaDescanso, corretamente gated ao Descanso Longo (hp-descanso.js), mas o botão livre já basta para tornar a troca irrestrita. Nenhum dos caminhos passa por opcoes/subirDeNivel. Direção: mais permissivo.',
    formaDaDivergencia: 'direito-sem-condicao',
  },
  {
    classe: 'Paladino',
    oQueTroca: 'Tipo de Arma com Maestria',
    quando: 'sempre que completa um Descanso Longo',
    livro: 'Classes.md:5521',
    campoApp: 'maestrias_arma',
    observavelEmUnidade: false,
    motivoSeNaoObservavel: 'char.maestrias_arma é editado via botão sempre disponível na ficha (abrirModalMaestrias, site/js/sheet/maestrias.js, chamado de habilidades.js:2280), sem nenhuma checagem de nível/descanso dentro do modal — puro grid de checkboxes. Também há abrirModalTrocaMaestriaDescanso, corretamente gated ao Descanso Longo (hp-descanso.js), mas o botão livre já basta para tornar a troca irrestrita. Nenhum dos caminhos passa por opcoes/subirDeNivel. Direção: mais permissivo.',
    formaDaDivergencia: 'direito-sem-condicao',
  },

  // ---------------------------------------------------------------
  // Direito ausente de fato: nenhum gatilho, de nenhum tipo, exerce a
  // troca. Ou não há campoApp (não há estado nenhum a que a troca possa
  // aderir), ou existe campo e caminho de código, mas uma condição que
  // nunca é satisfeita para essa classe exclui a atribuição permanentemente.
  // ---------------------------------------------------------------
  {
    classe: 'Druida',
    oQueTroca: 'Forma Selvagem Conhecida',
    quando: 'sempre que completa um Descanso Longo',
    livro: 'Classes.md:2076',
    // campoApp null NÃO é limitação de observabilidade: é o próprio
    // achado. O app não guarda em lugar nenhum QUAIS formas de Fera o
    // Druida conhece (só usos gastos: recursos.druida.forma_selvagem_usos_gastos
    // e forma_selvagem_ativa, em site/js/sheet/classes/druida.js;
    // confirmado por grep amplo em site/js/ por "formas", "forma_selvagem"
    // e "formas_conhecidas" — nenhuma outra ocorrência). Não há estado
    // para a troca aderir, logo não há o que testar.
    campoApp: null,
    observavelEmUnidade: false,
    motivoSeNaoObservavel: 'O app não rastreia quais formas de Fera são conhecidas — apenas usos gastos de Forma Selvagem. Não há estado nenhum para a troca aderir; a ausência do campo é o achado, não uma limitação de observabilidade. Direção: mais restritivo (o direito simplesmente não existe no app).',
    formaDaDivergencia: 'direito-ausente',
  },
  {
    classe: 'Guerreiro',
    oQueTroca: 'Estilo de Luta',
    quando: 'ao atingir um nível de Guerreiro',
    livro: 'Classes.md:3812',
    campoApp: 'escolhas_classe.estilo_luta',
    observavelEmUnidade: true,
    motivoSeNaoObservavel: null,
    // CORRIGIDO na Task 8 (era o bug relatado pelo usuário real que deu
    // origem a esta suíte — ver cabeçalho do arquivo). Até então,
    // exigeEstiloLuta(classe, nivel) só retornava true para
    // 'Guardião'/'Paladino' no nível 2, nunca para 'Guerreiro' em nível
    // nenhum, e o bloco de aplicação nunca rodava: opcoes.estilo_luta
    // chegava a ser lido, mas a atribuição não acontecia -- 'direito-
    // ausente'. A Task 8 acrescentou um mecanismo dedicado --
    // exigeTrocaEstiloLutaGuerreiro(classe, nivel) (levelup.js:470-472),
    // que retorna true para 'Guerreiro' && nivel >= 2, o mesmo gatilho
    // que o livro exige ("sempre que atinge um nível de Guerreiro"; o
    // nível 1 já é atendido no assistente de criação, fluxo separado).
    // Validação não bloqueante em levelup.js:1104-1115 (só reclama se o
    // jogador preencher só um dos dois lados de
    // opcoes.estilo_luta_trocar_de/estilo_luta_trocar_para); aplicação em
    // levelup.js:1583-1597. Por isso 'conforme', não mais
    // 'direito-ausente'. É exatamente isso que o teste de unidade
    // (observável, Step 1 e Step 2 de classes-trocas.test.mjs) prova ao
    // chamar subirDeNivel com o par trocar_de/trocar_para preenchido.
    formaDaDivergencia: 'conforme',
  },
];
