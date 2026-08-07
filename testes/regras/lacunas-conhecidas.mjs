// ============================================================
// Lista viva de lacunas do app em relação ao livro.
// Cada entrada faz o teste correspondente esperar FALHA; se o app
// for corrigido e o teste passar, o motor exige remover a entrada.
// Motivo em branco é erro (verificado em completude.test.mjs).
// ============================================================

// Nomes de teste que podem aparecer em `teste`. 'validacao' e
// 'validacao-negativa' são chaves DISTINTAS de propósito: em
// validacao.test.mjs, "aceita o exemplo do livro" (afirmação positiva)
// usa 'validacao' e "rejeita conjuntos inválidos" (afirmação negativa)
// usa 'validacao-negativa' — são duas alegações opostas sobre o mesmo
// talento, e uma chave só pode expressar uma alegação por vez (ver
// task-6-report.md, Achado 1, para a análise completa de por que
// compartilhar a chave quebra um dos dois subtestes sempre).
export const TESTES_VALIDOS = [
  'escolhas', 'aumento-atributo', 'validacao', 'validacao-negativa', 'passivos',
  'e2e-levelup', 'e2e-criador', 'e2e-criador-versatil', 'e2e-repetivel', 'e2e-ficha',
];

// Achado I4: o README chama esta lista de "o backlog real de correções do
// app" e diz que "cada entrada é uma alegação de que o app está errado" --
// mas quatro das doze entradas eram, na verdade, sobre o que o MOTOR DE
// TESTE não consegue observar, não sobre o app estar errado. `tipo`
// distingue as duas alegações, que são categoricamente diferentes:
//   - 'app-diverge-do-livro': o app faz algo diferente do que o livro
//     manda -- confirmado (por leitura de código e/ou empiricamente no
//     navegador). Isto é o backlog real.
//   - 'limitacao-observabilidade': o mecanismo que este teste confronta
//     não é o mecanismo que o app realmente usa aqui (ex.: a regra vive
//     num ramo hard-coded por nome, ou numa função module-private, fora
//     do que REGRAS_TALENTOS/talentoExigeEscolhas/obterAtributosASITalento/
//     validarEscolhasTalento conseguem ver). Não é uma alegação sobre o
//     app -- é um registro de que ESTA rota do teste é cega aqui; outra
//     rota (unidade ou e2e) pode já confirmar o comportamento real, do
//     jeito certo.
// completude.test.mjs rejeita qualquer entrada sem um `tipo` desta lista.
export const TIPOS_LACUNA = ['app-diverge-do-livro', 'limitacao-observabilidade'];

export const LACUNAS = [
  // Preenchida nas Tasks 6-10 conforme os motores rodarem.

  // ---------- Task 6: motor de escolhas / validação ----------
  //
  // escolhas.test.mjs (reframed) confronta cada talento pela via que o
  // app realmente usa para reconhecer a escolha:
  //   - só atributo (ASI embutido)      -> obterAtributosASITalento (levelup.js)
  //   - alguma escolha não-atributo     -> REGRAS_TALENTOS ou talentoExigeEscolhas
  // Cada motivo abaixo nomeia qual dos três estados se aplica:
  //   (A) o app não implementa a regra em NENHUM lugar;
  //   (B) o app implementa só via um ramo hard-coded por nome dentro de
  //       levelup-ui.js/levelup-validations.js, invisível para qualquer
  //       mecanismo declarativo (REGRAS_TALENTOS/talentoExigeEscolhas/
  //       obterAtributosASITalento) — só um teste Playwright (Task 9)
  //       pode confirmar se o controle de fato aparece e é exigido;
  //   (C) o app implementa via um mecanismo que este teste de unidade
  //       não tem como observar diretamente. Quase nenhum caso deste tipo
  //       sobrou depois do reframe — os 44 talentos "só atributo"
  //       cobertos por obterAtributosASITalento agora passam de verdade —
  //       MAS "Aumento no Valor de Atributo" é a exceção viva (achado I4,
  //       corrigindo a afirmação anterior de que não sobrava nenhum caso):
  //       sua distribuição de 2 pontos É validada pelo app
  //       (levelup-validations.js:98-99, além de validarDistribuicaoASI,
  //       function não exportada em levelup.js:136 — sem `export`, este
  //       motor não consegue importá-la para testar isoladamente), e o
  //       spec de level-up (Playwright) prova isso executando o fluxo
  //       real de ponta a ponta. `tipo: 'limitacao-observabilidade'`
  //       marca os casos, deste e de outros grupos, onde a lacuna é do
  //       MOTOR de teste, não do app — ver TIPOS_LACUNA acima.

  // Mestre das Armas: (A) não implementado em lugar nenhum. Sem entrada
  // em REGRAS_TALENTOS, sem talentoExigeEscolhas, e sem NENHUM ramo em
  // levelup-ui.js:renderEscolhasTalento para a escolha de arma da
  // "Propriedade de Maestria" (só o <select> de atributo ASI genérico é
  // renderizado, linhas 528-547) — verificado lendo o arquivo inteiro.
  // Confirmado contra o livro: Talentos.md:532 exige escolher um tipo de
  // arma Simples ou Marcial.
  { talento: 'Mestre das Armas', teste: 'escolhas',
    tipo: 'app-diverge-do-livro',
    motivo: '(A) não implementado em lugar nenhum: sem entrada em ' +
      'REGRAS_TALENTOS (regras-cobertura.js:28-75), sem talentoExigeEscolhas ' +
      '(creator/comum.js:196-198), e sem NENHUM ramo para "arma" em ' +
      'levelup-ui.js:renderEscolhasTalento (só o atributo ASI genérico, ' +
      'linhas 528-547, é renderizado) — a "Propriedade de Maestria" ' +
      '(Talentos.md:532, escolha de arma Simples/Marcial) não existe no app.' },

  // Adepto Elemental / Analítico / Mente Aguçada: (B) implementados só
  // via ramo hard-coded por nome em levelup-ui.js, invisível para
  // REGRAS_TALENTOS e talentoExigeEscolhas. Confirmei que a UI renderiza
  // um <select>, mas nenhuma checagem em levelup-validations.js/levelup.js
  // exige que ele seja preenchido antes de concluir — Task 9 (Playwright)
  // é quem pode provar empiricamente se o controle aparece/é exigido.
  { talento: 'Adepto Elemental', teste: 'escolhas',
    // Achado I4: esta entrada é sobre o que o MOTOR DE UNIDADE não
    // consegue enxergar (a escolha é real e a tela renderiza um select --
    // só que via ramo hard-coded, invisível para REGRAS_TALENTOS/
    // talentoExigeEscolhas). Não é, por si só, uma alegação de que o app
    // erra o livro -- essa alegação está na entrada gêmea de 'e2e-levelup'
    // abaixo, que confirma empiricamente o defeito real (rótulos trocados,
    // escolha não exigida).
    tipo: 'limitacao-observabilidade',
    motivo: '(B) implementado só via ramo hard-coded em levelup-ui.js:621-631 ' +
      '(sem entrada em REGRAS_TALENTOS nem talentoExigeEscolhas) — invisível ' +
      'para os dois mecanismos declarativos que este teste consegue observar. ' +
      'Nenhuma checagem em levelup-validations.js/levelup.js exige que a ' +
      'seleção seja preenchida antes de concluir o level-up; Task 9 confirma ' +
      'empiricamente se o <select> aparece e é exigido. Bug de livro à parte ' +
      '(capturado como dado, ver catálogo): a UI oferece \'Frio\',\'Fogo\' em ' +
      'vez de \'Gélido\',\'Ígneo\' (Talentos.md:244).' },
  { talento: 'Analítico', teste: 'escolhas',
    // Mesma razão de Adepto Elemental/escolhas acima (achado I4): registro
    // de que este motor não vê o ramo hard-coded, não uma alegação de bug
    // -- o bug real está em Analítico/e2e-levelup, abaixo.
    tipo: 'limitacao-observabilidade',
    motivo: '(B) implementado só via ramo hard-coded em levelup-ui.js:580-586 ' +
      '(sem entrada em REGRAS_TALENTOS nem talentoExigeEscolhas) — invisível ' +
      'para os dois mecanismos declarativos que este teste consegue observar. ' +
      'Nenhuma checagem exige que o <select> seja preenchido antes de concluir; ' +
      'Task 9 confirma empiricamente. Bug de livro à parte: a UI oferece ' +
      '\'Medicina\' em vez de \'Percepção\' (Talentos.md:268) — Percepção nem ' +
      'aparece como opção.' },
  { talento: 'Mente Aguçada', teste: 'escolhas',
    // Mesma razão de Adepto Elemental/Analítico acima (achado I4): registro
    // de limitação de observabilidade -- o bug real (escolha não exigida
    // para concluir) está em Mente Aguçada/e2e-levelup, abaixo.
    tipo: 'limitacao-observabilidade',
    motivo: '(B) implementado só via ramo hard-coded em levelup-ui.js:588-594 ' +
      '(sem entrada em REGRAS_TALENTOS nem talentoExigeEscolhas) — invisível ' +
      'para os dois mecanismos declarativos que este teste consegue observar. ' +
      'As opções da UI batem com o livro (Talentos.md §Mente Aguçada), mas ' +
      'nenhuma checagem exige que o <select> seja preenchido antes de concluir ' +
      'o level-up; Task 9 confirma empiricamente se isso é exigido na prática.' },

  // Aumento no Valor de Atributo: cai na rota "só atributo", mas
  // obterAtributosASITalento devolve lista vazia para ESTE talento
  // especificamente (seu benefício não segue o padrão textual "+1 a
  // X/Y/Z" que a função reconhece — o talento distribui 2 pontos, não
  // concede um "+1 embutido"). Verificado empiricamente: dos 45 talentos
  // "só atributo" do catálogo, obterAtributosASITalento cobre 44; só este
  // fica de fora.
  { talento: 'Aumento no Valor de Atributo', teste: 'escolhas',
    // Achado I4: o próprio motivo abaixo confirma que o app VALIDA a
    // distribuição (levelup-validations.js:98-99 + validarDistribuicaoASI
    // em levelup.js:136) -- só que por um mecanismo que esta rota do
    // teste (obterAtributosASITalento) não confronta, e que o motor de
    // unidade não consegue importar isolado (função module-private). É
    // limite de observabilidade, não uma alegação de bug -- o spec de
    // level-up (Playwright) já prova o comportamento real de ponta a
    // ponta, sem entrada de lacuna nenhuma lá.
    tipo: 'limitacao-observabilidade',
    motivo: 'não é (A)/(C) puros: a distribuição de 2 pontos É validada, mas ' +
      'por um TERCEIRO mecanismo — state.pontosDistribuidos!==2 em ' +
      'levelup-validations.js:98-99 e validarDistribuicaoASI em ' +
      'levelup.js:980-983 — plenamente observável por teste de unidade, só ' +
      'não é o que esta rota do teste confronta (obterAtributosASITalento, ' +
      'que devolve [] para este talento porque seu benefício não segue o ' +
      'padrão textual "+1 a X/Y/Z" que a função reconhece; nem REGRAS_TALENTOS ' +
      'nem talentoExigeEscolhas o cobrem). Confirmado empiricamente: dos 45 ' +
      'talentos "só atributo" do catálogo, obterAtributosASITalento cobre 44 — ' +
      'só este fica de fora.' },

  // Habilidoso / Artifista / Músico: 'escolhas' passa de verdade agora
  // (talentoExigeEscolhas reconhece os três — creator/comum.js:196-198),
  // então NÃO há mais lacuna nessa chave para eles. A lacuna real deles é
  // em 'validacao-negativa': (B) implementados só via checagem de
  // QUANTIDADE hard-coded em levelup-validations.js, que não fala com
  // validarEscolhasTalento (o motor que este teste confronta) — chamado
  // isoladamente, ele aceita qualquer conjunto, incluindo inválidos.
  { talento: 'Habilidoso', teste: 'validacao-negativa',
    // Achado I4: diferente das entradas 'escolhas' de Adepto
    // Elemental/Analítico/Mente Aguçada acima, esta NÃO é sobre o motor
    // não enxergar algo que o app faz certo em outro lugar -- o motivo
    // abaixo mostra que validarEscolhasTalento(char,'Habilidoso',...)
    // aceita QUALQUER conjunto, inclusive um com item removido ou
    // duplicado, quando chamado como o resto do app chama essa mesma
    // função para outros talentos. É uma alegação real: a função central
    // de validação do app não impõe a regra para estes três talentos.
    tipo: 'app-diverge-do-livro',
    motivo: '(B) a única checagem hard-coded em levelup-validations.js:114-119 ' +
      "(`['Habilidoso','Artifista','Músico'].includes(state.talento)` + " +
      '`escolhas.length!==3` + `new Set(escolhas).size!==3`) valida SÓ ' +
      'quantidade (exatamente 3) e distinção entre si (3 valores diferentes) — ' +
      'nunca confere se os 3 itens são de fato perícias/ferramentas válidas ' +
      '(um array de 3 strings inventadas passa), e essa checagem só roda no ' +
      'fluxo de level-up (validateAll), nunca dentro de validarEscolhasTalento ' +
      '(regras-cobertura.js), sem entrada em REGRAS_TALENTOS. Pior: a ficha ' +
      'tem uma QUARTA via de aquisição (botão "+ Talento", ' +
      'site/js/sheet/talentos.js:663-669, fora do criador e do level-up) que ' +
      'nem chega a chamar levelup-validations.js — lá, obterAtributosASITalento ' +
      'e obterEscolhasObrigatoriasTalento devolvem listas vazias para os três, ' +
      'o talento é persistido sem NENHUMA pergunta, e validarEscolhasTalento ' +
      '(char,"Habilidoso",escolhas) devolve {valido:true} para QUALQUER ' +
      'conjunto, inclusive vazio — confirmado ao vivo em ' +
      'talentos-ficha.spec.mjs (teste "e2e-ficha"): 0 controles de escolha na ' +
      'tela, talento gravado mesmo assim, nenhuma proficiência nova.' },
  { talento: 'Artifista', teste: 'validacao-negativa',
    tipo: 'app-diverge-do-livro',
    motivo: '(B) mesma causa de Habilidoso/validacao-negativa: a checagem ' +
      'hard-coded em levelup-validations.js:114-119 valida só quantidade e ' +
      'distinção entre si, nunca se os itens são ferramentas válidas, e só ' +
      'roda no fluxo de level-up — sem entrada em REGRAS_TALENTOS, ' +
      'validarEscolhasTalento(char,"Artifista",escolhas) aceita qualquer ' +
      'conjunto. E pela quarta via de aquisição (botão "+ Talento" da ficha, ' +
      'site/js/sheet/talentos.js:663-669) nem essa checagem de quantidade é ' +
      'alcançada: o talento é persistido sem pedir nada — confirmado em ' +
      'talentos-ficha.spec.mjs (teste "e2e-ficha").' },
  { talento: 'Músico', teste: 'validacao-negativa',
    tipo: 'app-diverge-do-livro',
    motivo: '(B) mesma causa de Habilidoso/validacao-negativa: a checagem ' +
      'hard-coded em levelup-validations.js:114-119 valida só quantidade e ' +
      'distinção entre si, nunca se os itens são instrumentos válidos, e só ' +
      'roda no fluxo de level-up — sem entrada em REGRAS_TALENTOS, ' +
      'validarEscolhasTalento(char,"Músico",escolhas) aceita qualquer ' +
      'conjunto. E pela quarta via de aquisição (botão "+ Talento" da ficha, ' +
      'site/js/sheet/talentos.js:663-669) nem essa checagem de quantidade é ' +
      'alcançada: o talento é persistido sem pedir nada — confirmado em ' +
      'talentos-ficha.spec.mjs (teste "e2e-ficha").' },

  // ---------- Task 9: e2e do level-up (Playwright) ----------
  //
  // talentos-levelup.spec.mjs dirige o assistente de subida de nível de
  // verdade: seleciona o talento, confere se a tela oferece os controles
  // de escolha que o livro exige (com as opções certas), tenta concluir
  // sem preenchê-los (deve travar) e, preenchendo, confirma que a
  // escolha persiste na ficha salva. Os quatro achados abaixo foram
  // observados na tela, não inferidos — rodar
  // `npx playwright test --config=regras/playwright.config.mjs talentos-levelup`
  // reproduz os quatro de novo a cada execução.

  // Mestre das Armas: a tela não renderiza NENHUM controle para a escolha
  // de arma -- confirma empiricamente o que a lacuna 'escolhas' já
  // apontava por leitura de código (nenhum ramo em
  // levelup-ui.js:renderEscolhasTalento para nome==='Mestre das Armas').
  { talento: 'Mestre das Armas', teste: 'e2e-levelup',
    tipo: 'app-diverge-do-livro',
    motivo: 'a tela de ASI/talento não oferece NENHUM controle para a escolha de ' +
      'arma da "Propriedade de Maestria": `.escolha-talento-levelup` conta 0 ' +
      'elementos onde o catálogo exige 1 (Talentos.md:532, escolha de arma ' +
      'Simples/Marcial), e a subida conclui mesmo assim — confirmado ao vivo ' +
      'selecionando o talento no `#levelup-talento-select` e inspecionando ' +
      '`#levelup-talento-escolhas`, que fica vazio além do atributo ASI ' +
      'genérico. Bate com o ramo ausente em levelup-ui.js:renderEscolhasTalento ' +
      'já documentado na lacuna \'escolhas\'.' },

  // Analítico: rótulo errado (Medicina no lugar de Percepção) E a escolha
  // não é exigida para concluir a subida.
  { talento: 'Analítico', teste: 'e2e-levelup',
    tipo: 'app-diverge-do-livro',
    motivo: 'dois problemas provados na tela: (1) o `<select>` renderizado por ' +
      'levelup-ui.js:580-585 oferece Investigação/Intuição/Medicina — Percepção ' +
      '(Talentos.md:268) nunca aparece como opção, confirmado lendo as ' +
      '`<option>` do select depois de escolher o talento; (2) confirmar a ' +
      'subida com o select "Perícia (1)" em branco NÃO é bloqueado — a tela ' +
      'sai de "Aumento de Atributo ou Talento" direto para o resumo de ' +
      'conclusão, mesmo sem a perícia escolhida (nem REGRAS_TALENTOS nem ' +
      'levelup-validations.js:validateAll têm uma checagem específica para ' +
      '"Analítico", então validarEscolhasTalento devolve {valido:true} sempre ' +
      'para ele — regras-cobertura.js:104-106).' },

  // Adepto Elemental: mesmos dois problemas de Analítico, com uma
  // terceira etiqueta trocada além das duas já conhecidas (Frio/Fogo).
  { talento: 'Adepto Elemental', teste: 'e2e-levelup',
    tipo: 'app-diverge-do-livro',
    motivo: 'dois problemas provados na tela: (1) o `<select>` de ' +
      'levelup-ui.js:621-630 oferece Ácido/Frio/Fogo/Elétrico/Trovão — o ' +
      'livro (Talentos.md:244) pede Ácido/Elétrico/Gélido/Ígneo/Trovejante, e a ' +
      'tela não oferece Gélido, Ígneo NEM Trovejante (a terceira etiqueta, ' +
      '"Trovão" em vez de "Trovejante", não estava anotada na lacuna ' +
      '\'escolhas\' — achado novo deste teste); (2) confirmar a subida com o ' +
      'select "Tipo de Dano" em branco não é bloqueado, pela mesma causa de ' +
      'Analítico (sem entrada em REGRAS_TALENTOS nem checagem própria em ' +
      'validateAll). Testado com um Paladino (nível 3→4): Adepto Elemental ' +
      'exige Característica de Conjuração no pré-requisito ' +
      '(talentoElegivelParaPersonagem, levelup.js:107-110), e com a semente de ' +
      'Guerreiro (não-conjurador) o talento nem aparece no dropdown — testar ' +
      'só com Guerreiro teria mascarado este achado por completo.' },

  // Mente Aguçada: rótulos batem com o livro (diferente de Analítico), mas
  // a escolha também não é exigida para concluir.
  { talento: 'Mente Aguçada', teste: 'e2e-levelup',
    tipo: 'app-diverge-do-livro',
    motivo: 'as opções do `<select>` (levelup-ui.js:588-593: Arcanismo, ' +
      'História, Investigação, Natureza, Religião) batem exatamente com o ' +
      'livro (Talentos.md §Mente Aguçada) — sem desvio de rótulo aqui. Mas ' +
      'confirmar a subida com esse select em branco NÃO é bloqueado: mesma ' +
      'causa de Analítico/Adepto Elemental (nem REGRAS_TALENTOS nem ' +
      'levelup-validations.js:validateAll checam "Mente Aguçada" ' +
      'especificamente, então validarEscolhasTalento devolve {valido:true} ' +
      'sempre). Só a Task 9 (Playwright) prova isso — o motor de unidade não ' +
      'tem como observar se a tela EXIGE o preenchimento antes de concluir.' },

  // ---------- Fix wave de 2026-08-06: quarto caminho de aquisição ----------
  //
  // O relatado original deste projeto foi "o talento Habilidoso, ao ser
  // selecionado não aparecem as opções de escolha". A rodada anterior
  // investigou só três vias de aquisição (antecedente no criador, Versátil,
  // level-up) e concluiu, incorretamente, que o sintoma não se reproduzia —
  // faltava a quarta via: o botão "+ Talento" da FICHA
  // (abrirModalAdicionarTalento, site/js/sheet/talentos.js:586), fora do
  // criador e fora do level-up. talentos-ficha.spec.mjs (teste 'e2e-ficha')
  // dirige essa via de verdade para Habilidoso, Artifista e Músico.
  //
  // Causa raiz, a mesma para os três: site/js/sheet/talentos.js:663-669
  // decide se abre o popup de configuração de escolhas checando só duas
  // fontes — `obterAtributosASITalento(talento)` (o "+1" embutido; vazio
  // para os três, cujo benefício não é um ASI) e
  // `obterEscolhasObrigatoriasTalento(getRegraTalento(nome), char)` (vazio
  // também, porque Habilidoso/Artifista/Músico não têm entrada em
  // REGRAS_TALENTOS, regras-cobertura.js:28-75). Com as duas listas vazias,
  // `persistirTalento(nome, talento)` roda direto — sem popup, sem
  // `renderEscolhasTalento`, sem nada. O reconhecimento que EXISTE no app
  // para estes três (`talentoExigeEscolhas`, creator/comum.js:196-198) fica
  // de fora: este botão nunca importa nem chama essa função — só o criador
  // (passo-antecedente.js/passo-especie.js) e levelup-validations.js o
  // fazem.
  { talento: 'Habilidoso', teste: 'e2e-ficha',
    tipo: 'app-diverge-do-livro',
    motivo: 'confirmado ao vivo: abrir "+ Talento" na ficha, categoria "de ' +
      'Origem", selecionar Habilidoso e clicar "Adicionar" NÃO abre nenhum ' +
      'popup de configuração — `.escolha-talento-levelup` conta 0 elementos ' +
      'onde o livro exige 3 (Talentos.md §Habilidoso: "proficiência em ' +
      'qualquer combinação de três perícias ou ferramentas à sua escolha"). O ' +
      'talento é gravado em personagem.talentos mesmo assim (toast de ' +
      'sucesso), e personagem.pericias_proficientes não ganha nenhuma entrada ' +
      'nova — a proficiência prometida pelo livro simplesmente não existe no ' +
      'personagem salvo. Causa: site/js/sheet/talentos.js:663-669 só consulta ' +
      'obterAtributosASITalento (vazio) e obterEscolhasObrigatoriasTalento ' +
      'via getRegraTalento (vazio, sem entrada em REGRAS_TALENTOS) — nunca ' +
      'talentoExigeEscolhas (creator/comum.js:196-198), que é quem reconhece ' +
      'este talento nas outras três vias.' },
  { talento: 'Artifista', teste: 'e2e-ficha',
    tipo: 'app-diverge-do-livro',
    motivo: 'mesma causa raiz de Habilidoso/e2e-ficha, confirmada ao vivo para ' +
      'Artifista: "+ Talento" → categoria "de Origem" → Artifista → ' +
      '"Adicionar" não abre popup de configuração (0 controles ' +
      '`.escolha-talento-levelup`, onde o livro exige 3 Ferramentas de ' +
      'Artesão — Talentos.md §Artifista). O talento é gravado em ' +
      'personagem.talentos mesmo assim, e personagem.proficiencias_ferramentas ' +
      'não ganha nenhuma entrada nova. site/js/sheet/talentos.js:663-669 não ' +
      'consulta talentoExigeEscolhas (creator/comum.js:196-198).' },
  { talento: 'Músico', teste: 'e2e-ficha',
    tipo: 'app-diverge-do-livro',
    motivo: 'mesma causa raiz de Habilidoso/e2e-ficha, confirmada ao vivo para ' +
      'Músico: "+ Talento" → categoria "de Origem" → Músico → "Adicionar" ' +
      'não abre popup de configuração (0 controles `.escolha-talento-levelup`, ' +
      'onde o livro exige 3 Instrumentos Musicais — Talentos.md §Músico). O ' +
      'talento é gravado em personagem.talentos mesmo assim, e ' +
      'personagem.proficiencias_instrumentos não ganha nenhuma entrada nova. ' +
      'site/js/sheet/talentos.js:663-669 não consulta talentoExigeEscolhas ' +
      '(creator/comum.js:196-198).' },
];

// Busca a lacuna registrada para um par (talento, teste), se houver.
export function lacuna(talento, teste) {
  return LACUNAS.find((l) => l.talento === talento && l.teste === teste) || null;
}
