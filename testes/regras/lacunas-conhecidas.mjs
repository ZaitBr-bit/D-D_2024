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
  // Domínio Antecedentes (testes/regras/unidade/antecedentes.test.mjs):
  // as cinco partes do livro confrontadas contra dados/origens/antecedentes.json,
  // mais a coerência cruzada com o catálogo de talentos.
  'antecedentes-atributos', 'antecedentes-talento', 'antecedentes-pericias',
  'antecedentes-ferramenta', 'antecedentes-equipamento', 'antecedentes-coerencia-talento',
  // Domínio Antecedentes (testes/e2e/regras/antecedentes.spec.mjs): a
  // ferramenta/instrumento concedido pelo antecedente nunca vira
  // proficiência reconhecida (os 16), e o item do pacote de equipamento
  // que representa "a mesma ferramenta escolhida" não é resolvido para a
  // escolha real do jogador nos 5 antecedentes por categoria.
  'antecedentes-e2e-ferramenta-proficiencia', 'antecedentes-e2e-pacote-mesma-ferramenta',
  // Domínio Classes/Níveis (testes/regras/unidade/classes.test.mjs).
  // 'classes-tabela' cobre o confronto do catálogo contra
  // dados/classes/*.json; 'classes-info' é a SEGUNDA fonte de verdade
  // (site/js/dados-classes.js). Uma chave só entra nesta lista quando
  // já existe pelo menos um `comLacuna(`/`lacuna(` que a usa em
  // testes/regras/ ou testes/e2e/regras/ -- ver o teste "toda chave de
  // TESTES_VALIDOS tem consumidor" em completude.test.mjs, que rejeita
  // qualquer chave declarada aqui sem call site (achado I2 da revisão
  // final: 'classes-gatilho', 'classes-progressao' e 'classes-sanidade'
  // foram declaradas mas nunca referenciadas por nenhum comLacuna/lacuna
  // -- três chaves capazes de hospedar uma lacuna inventada e
  // indetectável, removidas nesta correção).
  'classes-tabela', 'classes-info',
  // Incremento de 2026-08-07 (Ladino nv6 "Especialista"): 'classes-gatilho-ausente'
  // é o TESTE CONVERSO em classes.test.mjs -- diferente de 'classes-tabela'/
  // 'classes-info' (que confrontam dado transcrito), este confronta se ALGUMA
  // das nove funções de gatilho de levelup.js dispara para uma célula que o
  // livro marca como exigindo escolha, sem a restrição `apenas` que escondia
  // o caso do Ladino no laço original de GATILHOS.
  'classes-gatilho-ausente',

  // ---------------------------------------------------------------------
  // Domínio Classes/Trocas (testes/regras/unidade/classes-trocas.test.mjs):
  // direitos de troca de escolha das 12 classes base. 'classes-trocas' cobre
  // as duas rotas (estática e comportamental) que observam o mesmo achado do
  // Guerreiro -- ver a entrada correspondente em LACUNAS.
  'classes-trocas',

  // Domínio Classes/Passivas (testes/regras/unidade/classes-passivas.test.mjs):
  // heurística Ativa/Passiva (ehHabilidadeAtiva) confrontada contra o
  // catálogo. As 7 chaves abaixo são as 7 CAUSAS DE CÓDIGO que agrupam as 28
  // divergências encontradas -- cada uma referenciada por várias entradas do
  // laço de teste (uma por característica), todas apontando para a MESMA
  // entrada em LACUNAS (mesmo padrão do Clérigo/'classes-tabela' acima: uma
  // causa, vários call sites).
          // As chaves 'classes-passivas-extras-classe-truque' (flag do bônus de
  // truque do Taumaturgo/Xamã sem consumidor) e
  // 'classes-passivas-vocabulario-estilo' (vocabulário de Estilo de Luta
  // divergente entre criador e ficha) viviam aqui, mas as duas lacunas
  // foram corrigidas e aposentadas na Task 7 -- ver o histórico
  // correspondente em LACUNAS, mais abaixo, e os testes de
  // classes-passivas.test.mjs que hoje afirmam o comportamento correto
  // sem nenhum wrap de comLacuna().

  // Domínio Subclasses / magias (testes/regras/unidade/subclasses-magias.test.mjs).
  // 'subclasses-magias' cobre a união dos mecanismos de concessão e a ficha
  // resultante da escada de nível; 'subclasses-magias-ficha' cobre a rota
  // separada dos acessores que site/js/pages/sheet.js chama.
  'subclasses-magias', 'subclasses-magias-ficha',

  // Domínio Subclasses / escolhas (testes/regras/unidade/subclasses-escolhas.test.mjs).
  // 'subclasses-escolha-ausente' cobre as duas direções que este motor
  // confronta sobre a MESMA pergunta ("o livro manda o app fazer algo aqui,
  // e o app faz?"): Direção 1 (Grupo 3 -- o livro exige uma escolha de
  // construção, o app levanta pendência?) e o converso (Grupo 6 -- alguma
  // coisa no personagem realmente mudou, com ou sem pendência?), mais as
  // concessões automáticas (Grupo 6 sobre CONCESSOES_AUTOMATICAS_SUBCLASSE
  // -- o livro concede sem perguntar, o app aplica?). As três perguntas
  // convergem na mesma alegação -- "o app não fez o que o livro manda" --
  // só a FORMA (pergunta vs. concede) muda; por isso uma chave só, não três.
  // 'subclasses-escolha-morta' (Direção 2 -- o app pede o que o livro NÃO
  // exige) NÃO está aqui: as 48 subclasses passam limpo nessa direção hoje
  // (Grupo 4, 100% verde) -- declarar a chave sem nenhum comLacuna() que a
  // use violaria a checagem de completude.test.mjs (achado I2, TESTES_VALIDOS
  // acima) e abriria uma porta para lacuna inventada e indetectável.
  'subclasses-escolha-ausente',

  // Domínio Subclasses / recursos (testes/regras/unidade/subclasses-recursos.test.mjs,
  // Grupos 2-5 -- Task 6 do plano 2026-08-18-regras-subclasses-4-recursos).
  // Confronta as MESMAS heurísticas entity-agnósticas do bloco Classes/
  // Passivas acima (detectarUsosMaximos, detectarRecarga, ehHabilidadeAtiva)
  // e a restauração real em hp-descanso.js contra as 72 características de
  // subclasse com uso/recarga citável no livro. Duas das dez divergências
  // encontradas são o MESMO código já coberto por 'classes-passivas-descanso-
  // curto-janela' (ver a entrada, acima) -- call sites novos, sem chave
  // nova. As outras três chaves abaixo são causas novas deste domínio, mas
  // DUAS delas COMPARTILHAM CÓDIGO com entradas já abertas de Classes/
  // Passivas, mesmo tendo chave própria -- ver a nota de correção em cada
  // uma ('subclasses-recursos-ativa-curto-circuito-automatico' compartilha
  // `utils.js:535` com 'classes-passivas-recarga-troca-escolha'; a nota de
  // conserto de acima, já falava
  // de detectarUsosMaximos antes desta tarefa). Só
  // 'subclasses-recursos-paladino-guarda-juramento' (guarda de subclasse do
  // Paladino) é código isolado, sem sobreposição com o bloco Classes/
  // Passivas.
    // A chave 'subclasses-recursos-paladino-guarda-juramento' vivia aqui, mas
  // a lacuna foi corrigida e aposentada em 2026-08-18 (Plano 1 da rodada de
  // correção) -- as quatro guardas de hp-descanso.js passaram a comparar
  // 'Juramento da X', o nome real de dados/classes/paladino.json. Ver o
  // histórico correspondente em LACUNAS, mais abaixo, e o motor novo
  // unidade/subclasse-nome-literal.test.mjs, que agora impede a
  // reintrodução do typo em qualquer das 48 subclasses.

  // A chave 'especies-anuncio-traco-nivel' (domínio Espécies) vivia aqui, mas a
  // lacuna foi corrigida e aposentada em 2026-08-18 -- os dois `if` por nome de
  // espécie de obterCaracteristicasEspecieNivel viraram uma varredura sobre o
  // DADO, e os três traços com nível passaram a ser anunciados. Ver o histórico
  // correspondente em LACUNAS, mais abaixo.
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
  // Entradas organizadas em blocos por domínio/rodada de trabalho (Task ou
  // data), na ordem em que cada motor de teste as encontrou -- não em
  // ordem alfabética nem por talento/classe. Lacunas corrigidas saem daqui
  // (ver comentário "Sem lacuna remanescente nesta chave" nos blocos
  // retirados, mantido como registro histórico de quando e como cada uma
  // foi fechada).

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
  //       (levelup-validations.js:112-113, além de validarDistribuicaoASI,
  //       function não exportada em levelup.js:136 — sem `export`, este
  //       motor não consegue importá-la para testar isoladamente), e o
  //       spec de level-up (Playwright) prova isso executando o fluxo
  //       real de ponta a ponta. `tipo: 'limitacao-observabilidade'`
  //       marca os casos, deste e de outros grupos, onde a lacuna é do
  //       MOTOR de teste, não do app — ver TIPOS_LACUNA acima.

  // Mestre das Armas: corrigido em 2026-08-06 (Tarefa C) — ganhou entrada em
  // REGRAS_TALENTOS (regras-cobertura.js), com validarEscolhasTalento agora
  // recusando a escolha vazia e exigindo uma arma Simples/Marcial válida
  // (ARMAS_SIMPLES_MARCIAIS) e aplicarEfeitoTalento gravando a arma em
  // maestrias_arma. Sem lacuna remanescente nesta chave.

  // Adepto Elemental / Analítico / Mente Aguçada: corrigidos em 2026-08-06
  // (Tarefa B) — os três ganharam entrada em REGRAS_TALENTOS
  // (regras-cobertura.js), com validarEscolhasTalento agora recusando a
  // escolha vazia (e, para Adepto Elemental, um tipo de dano repetido) e
  // aplicarEfeitoTalento gravando proficiência/Especialização (Analítico/
  // Mente Aguçada) ou o tipo de dano (Adepto Elemental). REGRAS_TALENTOS
  // é exatamente o mecanismo declarativo que este teste confronta — sem
  // lacuna remanescente nesta chave.

  // Aumento no Valor de Atributo: cai na rota "só atributo", mas
  // obterAtributosASITalento devolve lista vazia para ESTE talento
  // especificamente (seu benefício não segue o padrão textual "+1 a
  // X/Y/Z" que a função reconhece — o talento distribui 2 pontos, não
  // concede um "+1 embutido"). Verificado empiricamente: dos 45 talentos
  // "só atributo" do catálogo, obterAtributosASITalento cobre 44; só este
  // fica de fora.
  { talento: 'Aumento no Valor de Atributo', teste: 'escolhas',
    // Achado I4: o próprio motivo abaixo confirma que o app VALIDA a
    // distribuição (levelup-validations.js:112-113 + validarDistribuicaoASI
    // em levelup.js:136) -- só que por um mecanismo que esta rota do
    // teste (obterAtributosASITalento) não confronta, e que o motor de
    // unidade não consegue importar isolado (função module-private). É
    // limite de observabilidade, não uma alegação de bug -- o spec de
    // level-up (Playwright) já prova o comportamento real de ponta a
    // ponta, sem entrada de lacuna nenhuma lá.
    tipo: 'limitacao-observabilidade',
    motivo: 'não é (A)/(C) puros: a distribuição de 2 pontos É validada, mas ' +
      'por um TERCEIRO mecanismo — state.pontosDistribuidos!==2 em ' +
      'levelup-validations.js:112-113 e validarDistribuicaoASI em ' +
      'levelup.js:1005-1008 — plenamente observável por teste de unidade, só ' +
      'não é o que esta rota do teste confronta (obterAtributosASITalento, ' +
      'que devolve [] para este talento porque seu benefício não segue o ' +
      'padrão textual "+1 a X/Y/Z" que a função reconhece; nem REGRAS_TALENTOS ' +
      'nem talentoExigeEscolhas o cobrem). Confirmado empiricamente: dos 45 ' +
      'talentos "só atributo" do catálogo, obterAtributosASITalento cobre 44 — ' +
      'só este fica de fora.' },

  // Habilidoso / Artifista / Músico: 'escolhas' e 'validacao-negativa'
  // corrigidos em 2026-08-06 (Tarefa A) — REGRAS_TALENTOS ganhou entrada
  // para os três, validarEscolhasTalento agora rejeita quantidade errada,
  // duplicata e item fora da lista válida (regras-cobertura.js), e
  // aplicarEfeitoTalento grava as proficiências no campo certo. Sem
  // lacuna remanescente nessas duas chaves.

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

  // Mestre das Armas (e2e-levelup): corrigido em 2026-08-06 (Tarefa C) — a
  // tela agora renderiza um `.escolha-talento-levelup` com a lista de armas
  // Simples/Marciais (ARMAS_SIMPLES_MARCIAIS, regras-cobertura.js/
  // levelup-ui.js) e a escolha é exigida por REGRAS_TALENTOS antes de
  // concluir a subida de nível. Sem lacuna remanescente nesta chave.

  // Analítico / Adepto Elemental / Mente Aguçada (e2e-levelup): corrigidos
  // em 2026-08-06 (Tarefa B). Rótulos: Analítico agora oferece Intuição/
  // Investigação/Percepção (Talentos.md:268; era Investigação/Intuição/
  // Medicina), Adepto Elemental agora oferece Ácido/Elétrico/Gélido/Ígneo/
  // Trovejante (Talentos.md:244; era Ácido/Frio/Fogo/Elétrico/Trovão),
  // Mente Aguçada já batia com o livro. Escolha obrigatória: os três
  // ganharam entrada em REGRAS_TALENTOS + ramo em validarEscolhasTalento
  // (regras-cobertura.js), consultado por levelup-validations.js:validateAll
  // antes de liberar a confirmação — confirmar sem preencher o select agora
  // é bloqueado. Sem lacuna remanescente nessas três chaves.

  // ---------- Fix wave de 2026-08-06: quarto caminho de aquisição ----------
  //
  // O relatado original deste projeto foi "o talento Habilidoso, ao ser
  // selecionado não aparecem as opções de escolha", reproduzido na quarta
  // via de aquisição -- o botão "+ Talento" da FICHA
  // (abrirModalAdicionarTalento, site/js/sheet/talentos.js:586). Corrigido
  // na Tarefa A de 2026-08-06: Habilidoso/Artifista/Músico ganharam entrada
  // em REGRAS_TALENTOS (regras-cobertura.js), então
  // obterEscolhasObrigatoriasTalento(getRegraTalento(nome), char) volta a
  // devolver uma lista não-vazia e site/js/sheet/talentos.js:663-669 abre o
  // popup de configuração (renderEscolhasTalento/bindEscolhasTalento, os
  // mesmos ramos já usados pelo level-up) em vez de persistir direto.
  // Confirmado ao vivo por talentos-ficha.spec.mjs (teste 'e2e-ficha') para
  // os três. Sem lacuna remanescente nessa chave.

  // ---------- Domínio Antecedentes: e2e do criador (Playwright) ----------
  //
  // As 21 lacunas encontradas por antecedentes.spec.mjs (16 em
  // 'antecedentes-e2e-ferramenta-proficiencia' + 5 em
  // 'antecedentes-e2e-pacote-mesma-ferramenta') foram corrigidas na rodada de
  // 2026-08-07 -- ver docs/superpowers/plans/2026-08-07-regras-antecedentes.md
  // e .superpowers/sdd/antecedentes/correcao-report.md para o desenho da
  // correção e a evidência de execução.
  //
  // Achado (1) (16 entradas): a ferramenta/instrumento do antecedente nunca
  // virava proficiência reconhecida. Corrigido em passo-antecedente.js --
  // nova função _consolidarFerramentaAntecedente(), chamada na confirmação
  // do popup do antecedente, grava a ferramenta específica (ant.ferramentas)
  // ou a escolha por categoria (personagem.escolhas_antecedente[campo]) em
  // proficiencias_ferramentas/.proficiencias_instrumentos. Roteamento por
  // CAMPO conhecido (ANTECEDENTES_ESCOLHAS[...].campo), não por lista de
  // valores -- checar contra INSTRUMENTOS_MUSICAIS/FERRAMENTAS_TODAS (como o
  // bloco de escolhas_talento em wizard.js já faz) teria descartado em
  // silêncio as opções de Kit de Jogos (Baralho, Conjunto de Dados, Xadrez de
  // Dragão, Jogo de Três Dragões), que não pertencem a nenhuma das duas
  // listas.
  //
  // Achado (2) (5 entradas): o item do pacote de equipamento "(a mesma/o
  // mesmo que acima)" nunca era resolvido para a escolha real do jogador.
  // Corrigido em passo-equipamento.js -- novo ramo em
  // adicionarItensEquipamentoInicial() reconhece o marcador via regex e
  // substitui pelo valor em personagem.escolhas_antecedente[campo] do
  // antecedente de origem, ao lado do tratamento já existente de "à sua
  // escolha".

  // ---------- Domínio Classes/Níveis (2026-08-07) ----------
  //
  // Causa 1 (Clérigo nível 3, "Subclasse de Clérigo" x "Subclasse
  // Clérigo") corrigida na Task 8 (2026-08-08) -- dados/classes/clerigo.json,
  // tabela_caracteristicas[nível 3]['Características'] agora grava
  // "Subclasse Clérigo" (sem "de"), batendo com a célula da tabela do
  // livro (Classes.md:1515). O campo estruturado irmão
  // (caracteristicas[].nome do mesmo nível) foi MANTIDO com "de" de
  // propósito -- ele espelha o heading de prosa (Classes.md:1584, "###
  // Nível 3: Subclasse de Clérigo"), uma citação diferente que não tem
  // lacuna registrada. As duas rotas que liam a célula da tabela
  // ("tabela: Clérigo nível 3" em classes.test.mjs e "obterCaracteristicasNivel
  // × livro: Clérigo", mesma leitura por função de produção) confirmam a
  // correção. Sem lacuna remanescente nesta chave.

  // Causa 2 -- RETIRADA na Task 8 (2026-08-08). Ladino, proficiência com
  // Armas Marciais incompleta: faltava "Leve" ao lado de "Acuidade"
  // (Classes.md:4152). Corrigido em site/js/dados-classes.js: armas
  // agora é ['Simples', 'Marcial (Acuidade ou Leve)'] -- um único item,
  // texto do próprio livro; os dois consumidores
  // (creator/passo-equipamento.js:temProficienciaArma e
  // sheet/condicoes.js:sheetTemProfArma) já faziam
  // `info.armas.some(a => a.includes('Leve'))` (mesma checagem usada
  // para o Monge), então nenhum dos dois precisou mudar.
  //
  // O motor de teste também precisou de correção, não só o app: a
  // asserção de restrição (classes.test.mjs, corpoArmasRestricao)
  // empacotava o resultado do app como `[match[1]]` -- sempre um array
  // de 1 elemento -- e comparava contra `armasRestricao.Ladino.Marcial`
  // (2 elementos no catálogo, `['Acuidade', 'Leve']`) com
  // `assert.deepEqual`, que falha por COMPRIMENTO sempre que os dois
  // lados têm tamanhos diferentes -- nenhuma string possível em
  // `armas` teria feito essa asserção passar. Corrigido o parser para
  // separar as propriedades pelo conectivo "ou" do próprio livro
  // (`match[1].split(/\s+ou\s+/i)`) e comparar as duas listas
  // ordenadas. Confirmado com prova de reversão (ver task-8-report.md):
  // app revertido -> teste acusa a ausência de "Leve"; app restaurado ->
  // teste passa. Sem lacuna remanescente nesta chave.

  // ---------- Incremento de 2026-08-07: bug achado à mão por um humano ----------
  // RETIRADA na Task 8 (2026-08-08).
  //
  // Ladino nível 6 "Especialista" (Classes.md:4188, célula da tabela
  // "Características de Ladino") não virava pendência de subida de nível --
  // o app esquecia a característica INTEIRA. Corrigido em site/js/levelup.js:
  // nova exigeEspecializacaoLadino(classe, nivel), aplicada sem bloquear a
  // subida (opcoes.ladino_expertise quando o jogador escolhe; completada
  // automaticamente quando não escolhe -- ver o motivo da entrada de
  // Guerreiro/classes-trocas, acima, para por que esta escolha não podia
  // virar pendência bloqueante como bardo_expertise/guardiao_expertise).
  //
  // O motor de teste também ganhou o mecanismo que lhe faltava: GATILHOS
  // (classes.test.mjs) tinha 8 funções fixas porque eram as 8 que o app
  // tinha -- a Task 8 criou a nona (exigeEspecializacaoLadino) e a
  // registrou em GATILHOS (com rótulo próprio, especializacaoLadino, em
  // catalogo/classes.mjs -- mesmo regex de especializacaoGuardiao, já que
  // o rótulo do livro é idêntico, "Especialista"; o que diferencia as
  // duas é o `apenas: ['Ladino']`/`apenas: ['Guardião']` de cada entrada
  // em GATILHOS, não o rótulo) em vez de estender
  // exigeEspecializacaoBardo/exigeEspecializacaoGuardiao (que quebraria as
  // asserções por classe dessas duas, sem relação nenhuma com o Ladino).
  // O teste converso ('classes-gatilho-ausente') agora encontra a função
  // certa disparando para (Ladino, 6). Confirmado com prova de reversão
  // (ver task-8-report.md): app revertido -> teste acusa a característica
  // ausente; app restaurado -> teste passa. Sem lacuna remanescente nesta
  // chave.

  // ---------- Domínio Classes/Trocas (2026-08-07) ----------
  //
  // classes-trocas.test.mjs confronta os 26 direitos de troca de escolha
  // das 12 classes base (catalogo/classes-trocas.mjs) contra o app. Só 1
  // das 26 entradas é observável por teste de unidade
  // (observavelEmUnidade: true) -- as outras 25 aplicam a troca por um
  // caminho que subirDeNivel nunca vê (mutação direta de char em
  // levelup-ui.js:1392-1411, edição livre na ficha, ou Descanso Longo fora
  // do fluxo de nível), então não produzem teste algum aqui, positivo ou
  // negativo -- ver README, seção "Limites declarados". A única entrada
  // observável é exatamente onde mora o bug relatado por um usuário real.
  // RETIRADA na Task 8 (2026-08-08): a troca de Estilo de Luta do
  // Guerreiro (Classes.md:3812) agora existe de verdade (ver
  // site/js/levelup.js, exigeTrocaEstiloLutaGuerreiro + os pares
  // opcoes.estilo_luta_trocar_de/estilo_luta_trocar_para, aplicados sem
  // nunca bloquear a subida de nível, e exposta no card "Trocar Estilo de
  // Luta (opcional)" do level-up, site/js/levelup-cards.js).
  //
  // A asserção COMPORTAMENTAL de classes-trocas.test.mjs também foi
  // corrigida nesta tarefa (não só o app): a versão original exigia que
  // subirDeNivel devolvesse uma pendência bloqueante 'estilo_luta' em
  // algum nível da escada 1-20 -- mas isso media a coisa errada. O
  // direito do livro é OPCIONAL (o jogador pode simplesmente manter o
  // estilo), e o padrão de referência do próprio app (manobra_trocar_de/
  // manobra_trocar_para) nunca emite pendência quando as duas escolhas são
  // preenchidas corretamente -- só quando preenchidas pela metade. Exigir
  // uma pendência para uma troca bem-sucedida contradizia o brief desta
  // própria tarefa ("não a transforme em pendência bloqueante") e, por
  // isso, colidia com classes-progressao.test.mjs (PENDENCIAS_DE_CLASSE_UNICA,
  // que afirma, corretamente, que 'estilo_luta' nunca dispara fora de
  // Guardião/Paladino -- esses SIM têm uma escolha obrigatória naquele
  // nível). A asserção corrigida chama subirDeNivel com
  // estilo_luta_trocar_de/estilo_luta_trocar_para preenchidos e confere
  // que personagem.escolhas_classe.estilo_luta realmente mudou para o
  // novo valor -- mais forte que a versão anterior (prova que a troca
  // funciona, não só que ela seria "oferecida"), e sem colidir com nada.
  // As duas rotas (estática e comportamental) confirmam "Lacuna
  // corrigida" -- ver task-8-report.md para as saídas literais do
  // antes/depois (app revertido -> teste acusa; app restaurado -> teste
  // passa). Sem lacuna remanescente nesta chave.

  // ---------- Domínio Classes/Passivas: heurística Ativa/Passiva (2026-08-07) ----------
  //
  // classes-passivas.test.mjs confronta ehHabilidadeAtiva(descricao, nome)
  // (site/js/utils.js:499-511) -- a heurística por substring que decide em
  // qual das duas seções da ficha ("Habilidades Ativas"/"Habilidades
  // Passivas", site/js/sheet/caracteristicas.js:37-38,64-65) uma
  // característica de classe aparece -- contra as 174 características de
  // classe base, nas entradas cujo `base` do catálogo é 'custo-declarado'
  // ou 'ausencia-de-custo' (o livro tem frase citável; 'julgamento' e
  // `composta: true` não sustentam lacuna sozinhos, ver catálogo). 28
  // dessas entradas divergem -- agrupadas em 7 CAUSAS DE CÓDIGO (task-4-
  // report.md, "As 28 divergências, agrupadas por causa raiz"), não 28
  // lacunas independentes: um ajuste em ehHabilidadeAtiva/detectarRecarga
  // por causa resolveria todas as entradas daquela causa de uma vez. Na
  // maioria das 7 a consequência é só de EXIBIÇÃO (qual seção da ficha
  // mostra a característica -- nenhuma outra função do app lê
  // ehHabilidadeAtiva para decidir se um bônus se aplica). Em DUAS delas
  // (causas 2 e 4, abaixo) TAMBÉM há consequência interativa -- mas não em
  // TODA característica de cada uma: `recarga` (a mesma detecção de
  // detectarRecarga que alimenta ehHabilidadeAtiva) só alimenta, em
  // site/js/sheet/habilidades.js:4683 (`!usosHtmlBody && ativa && recarga`),
  // um controle INTERATIVO na ficha quando NENHUM ramo dedicado por
  // classe/característica já preencheu `usosHtmlBody` antes (o `!` na
  // condição). Corrigido em 2026-08-08 (achado da revisão final da Task 8):
  // a soma real de características com consequência interativa nas duas
  // causas juntas é 3, não as 6+2=8 que uma leitura apressada deste
  // preâmbulo sugeriria -- causa 2 tem só 1 das 6 (Mago/Maestria de
  // Magias; as outras 5 são "Maestria em Arma", que TÊM ramo dedicado, e
  // por isso nunca alcançam a condição de :4683) e causa 4 tem as 2 que já
  // tinha. Ver o motivo de cada uma para o detalhe medido.
  //
  // NOTA SOBRE O CAMPO `talento` NESTE BLOCO: quando uma causa afeta várias
  // classes, `talento` recebe UMA classe representativa (a de mais
  // entradas, ou a primeira em ordem alfabética) só para a mecânica de
  // chave de `comLacuna` funcionar -- não é uma alegação de que o bug é
  // específico daquela classe. Cada `motivo` abaixo lista TODAS as classes/
  // características realmente afetadas pela causa, por extenso.
  // As 7 causas de Classes/Passivas (28 características) e a causa
  // 'subclasses-recursos-ativa-curto-circuito-automatico' (Sentinela Imortal,
  // registrada mais abaixo) -- CORRIGIDAS em 2026-08-18 (Plano 3 da rodada de
  // correção). As oito eram o mesmo defeito de fundo: três funções tentavam
  // derivar fato estruturado (é ativa? recarrega? quantos usos?) procurando
  // substrings na prosa do livro, sem noção de a qual frase a substring
  // pertencia.
  //
  // `ehHabilidadeAtiva` (utils.js) deixou de perguntar "alguma frase da lista
  // aparece em algum lugar?" e passou a perguntar "o livro declara um CUSTO?"
  // -- economia de ação, recurso nomeado, custo em dados, ou uso que se esgota
  // e volta num descanso. Saíram da lista de gatilhos 'no seu turno' (que
  // qualifica QUANDO um benefício passivo vale) e 'você pode usar' (que casa
  // cláusula secundária), e saiu o curto-circuito `if (recarga) return true`
  // (recarga não é prova de ativação).
  //
  // `detectarRecarga` (utils.js) passou a exigir que a frase prenda o descanso
  // a um USO -- antes casava "descanso" em qualquer lugar, e fundia a cerimônia
  // de recriar o Mapa Estelar com a recarga real de Raio Guia.
  //
  // `detectarUsosMaximos` (sheet/habilidades.js) deixou de ler "X vezes seu
  // nível" (multiplicador de fórmula) como contagem de usos -- era o que dava
  // à Fúria Implacável um botão "Usar / ✗ Esgotado" com 2 usos.
  //
  // Medição: 28 divergências em 159 características citáveis viraram 0, e a
  // suíte inteira (2354 testes) não ganhou nenhuma falha real -- as 30 que
  // apareceram foram todas cobranças de remoção destas oito entradas. O
  // desenho saiu de SEIS iterações contra esse mesmo oráculo, e cada marcador
  // cita no código a característica real de onde saiu. Sem lacuna remanescente
  // nessas oito chaves.

  // ---------- Domínio Classes/Passivas: flag/campo sem consumidor,
  // vocabulário de Estilo de Luta e bônus de truque do Taumaturgo/Xamã
  // (2026-08-07) ----------
  //
  // As quatro lacunas que este bloco documentava --
  // 'classes-passivas-flag-armas-grandes', 'classes-passivas-flag-duas-armas',
  // 'classes-passivas-extras-classe-truque' e
  // 'classes-passivas-vocabulario-estilo' -- foram corrigidas na Task 7
  // (2026-08-07, .superpowers/sdd/2026-08-07-classes-trocas-passivas/
  // task-7-report.md): vocabulário único de Estilo de Luta (comum.js grava
  // os 10 nomes canônicos, habilidades.js:efeitosEstilo reindexado por eles,
  // com o texto de "Combate com Armas Grandes" corrigido para a regra de
  // 2024; talentos-effects.js:mapaEstilos virou normalizarEstiloLuta,
  // exportada, camada de compatibilidade só para fichas salvas antes da
  // correção -- coberta por teste próprio, ver classes-passivas.test.mjs
  // bloco "I3"); as duas flags mortas ganharam consumidor em
  // sheet/inventario.js (selo informativo na arma qualificada, não um
  // número dentro do cálculo de dano -- ver comentário no próprio arquivo
  // para o porquê -- e ver GUIA-PROXIMOS-DOMINIOS.md para o limite que
  // persiste: nenhuma das duas mecânicas chega a alterar uma rolagem de
  // dano de verdade, porque o app não tem motor de rolagem nenhum); e o
  // bônus de truque do Taumaturgo/Xamã foi centralizado em
  // utils.js:getBonusTruquesOrdem (coberta por teste do RETORNO da função,
  // não só da chamada -- ver bloco "I1"), chamado pelos 5 fluxos (criador,
  // ficha, subida de nível). Desses 5, só 4 mudam comportamento observável
  // (creator/passo-magias.js, creator/wizard.js -- já aplicavam antes --
  // mais sheet/grimorio.js e sheet/magias.js, que passaram a aplicar): a
  // chamada em levelup-flow.js é um NO-OP hoje para o único valor que seus
  // consumidores leem (a diferença truquesNovo-truquesAtual, onde o bônus
  // se cancela), mantida por defesa -- ver comentário em
  // levelup-flow.js:104-116 para o porquê.

  // ---------- Domínio Subclasses/Magias (2026-08-17) ----------
  //
  // subclasses-magias.test.mjs confronta a união de duas rotas do app --
  // obterMagiasDominioNivel/obterMagiasSemprePreparadasNivel (o "parser",
  // e a escada de nível real via subirDeNivel) mais os acessores separados
  // que a FICHA salva usa (obterTodasMagiasDominio/
  // obterTodasMagiasSemprePreparadas, site/js/pages/sheet.js:48-49) --
  // contra as 48 subclasses do livro. As 15 falhas desta rodada (5
  // subclasses × 3 rotas) caem em TRÊS causas de código -- a granularidade
  // abaixo é a do CONSERTO, não a das 15 falhas individuais. Nenhuma das 5
  // diverge entre rotas: as 3 rotas concordam sobre onde o app erra em
  // todas as 5 (ver task-5-report.md, tabela das falhas), então nenhum
  // motivo precisa nomear "duas rotas discordando".
  //
  // CORREÇÃO (2026-08-17, pós-revisão independente -- ver
  // task-6-report.md, seção "Correção pós-revisão"): a primeira versão
  // deste bloco tinha 2 causas (não 3) e 3 erros de mecanismo, todos por
  // ALEGAR sem RODAR (a mesma lição do guia que este projeto já registra
  // em outro domínio): (1)/(2) CRITICAL -- os dois motivos de Círculo da
  // Terra citavam obterMagiasDominioNivel como a função que soma as
  // quatro tabelas, mas essa função devolve [] para esta subclasse; as 12/
  // 4/4/4 magias medidas vêm da rota "sempre preparada"
  // (extrairMagiasSemprePreparadasTabela), que aqui PASSA da guarda
  // porque a frase do livro começa com "Sempre que completar um Descanso
  // Longo" -- corrigido citando a função e as linhas certas. (3) CRITICAL
  // -- Círculo das Estrelas estava agrupado com Lua/Mar/Vigilante sob a
  // mesma causa (mesmo `talento`), mas simular o conserto da Causa 1
  // (afrouxar a guarda "sempre") contra os dados reais mostra que Lua/Mar/
  // Vigilante passariam a bater e Estrelas continuaria falhando -- são
  // causas DIFERENTES; agrupá-las faria o dia em que alguém consertar a
  // Causa 1 acusar "Lacuna corrigida" sob um `talento` que ainda tem uma
  // divergência real (Estrelas) por trás. Separado em Causa 3, própria.
  //
  // `talento` de cada entrada é REPRESENTATIVO da causa quando ela afeta
  // mais de uma subclasse (Causa 1, abaixo) -- não é uma alegação de que o
  // bug é específico daquela subclasse; mesmo padrão de
  // CAUSA_DIVERGENCIA_ATIVO_PASSIVO em classes-passivas.test.mjs. O
  // `motivo` de cada entrada nomeia por extenso TODAS as subclasses/linhas
  // realmente afetadas pela causa.

  // Causa 1 (3 subclasses: Círculo da Lua, Círculo do Mar, Vigilante das
  // Sombras) -- rota "parser + escada de nível". Círculo das Estrelas NÃO
  // está aqui (ver Causa 3, mais abaixo, e o comentário de CORREÇÃO acima).
  // Círculo da Lua (Causa 1) e Círculo das Estrelas (Causa 3) -- CORRIGIDAS em
  // 2026-08-18 (Plano 2 da rodada de correção), nas duas rotas
  // ('subclasses-magias' e 'subclasses-magias-ficha'). A Causa 1 afetava três
  // subclasses sob a chave representativa 'Círculo da Lua' (ela mesma, Círculo
  // do Mar e Vigilante das Sombras): as duas rotas de concessão estavam mortas
  // pela mesma frase do livro. Cinco pontos de site/js/levelup.js mudaram:
  //   :498 e :533  exigiam a palavra "sempre" no texto -- o invariante real da
  //                concessão é "preparad" + nome de magia em itálico; "sempre"
  //                nem sempre aparece ("você tem a lista de magias preparadas")
  //                e, quando aparece, às vezes qualifica a FREQUÊNCIA de uma
  //                escolha, não a preparação ("Sempre que completar um Descanso
  //                Longo, escolha um tipo de terreno").
  //   :536         desistia diante de QUALQUER tabela markdown com número na
  //                primeira coluna -- virou discriminador de tabela DE NÍVEL
  //                (cabeçalho que diz "Nível"), o que deixa passar a tabela
  //                "1d6 | Formato do Mapa" do Mapa Estelar, que é aparência do
  //                objeto, não concessão de magia.
  //   :545         exigia "sempre" na MESMA FRASE da concessão -- a frase do
  //                Mapa Estelar começa com "Enquanto estiver segurando o mapa".
  //   :757         exigia "magias DE" no nome da característica -- passou a
  //                aceitar de/do/da/dos/das, o que reanima a rota de DOMÍNIO
  //                (a única que alimenta o card da tela de subida de nível).
  //
  // A Causa 3 (Círculo das Estrelas) era dada como trabalho separado no spec de
  // desenho; medido, ela fecha com as MESMAS mudanças -- ver o registro no
  // README. Medição da regressão, feita ANTES do conserto: varredura das 48
  // subclasses × 20 níveis, +14 linhas de concessão, 0 removidas, 0 alteradas.
  // Sem lacuna remanescente nessas duas chaves para estas subclasses.
  //
  // Círculo da Terra (Causa 2) CONTINUA aberto nas duas chaves, logo abaixo: o
  // app soma as quatro tabelas de terreno porque nunca pergunta qual o jogador
  // escolheu, e essa escolha é do Plano 4. A rota de domínio foi ensinada a
  // RECUSAR uma característica com mais de uma tabela de nível, em vez de somar
  // -- sem isso, o conserto de :757 teria feito a tela de nível passar a mostrar
  // 9 magias de terrenos misturados, onde antes mostrava nada.
  // Círculo da Terra (Causa 2 do domínio Magias) -- CORRIGIDA em 2026-08-18
  // (Plano 4 da rodada de correção), nas duas rotas. O app somava as QUATRO
  // tabelas de terreno (12 magias no nível 3 contra o teto 3 do livro) porque
  // nunca perguntava qual terreno o jogador escolheu. Agora pergunta: a
  // escolha entrou em regras-subclasse-escolhas.js como linha
  // 'subclasse_terreno', vira pendência de subida de nível com card próprio, e
  // grava em escolhas_classe.circulo_terra_terreno. O extrator de tabela
  // (extrairMagiasSemprePreparadasTabela) passou a RECORTAR o bloco do terreno
  // escolhido -- e, sem escolha em mãos, devolve vazio de propósito, em vez de
  // somar alternativas que o personagem nunca escolheu. Sem lacuna
  // remanescente nesta chave.

  // Causa 3 (1 subclasse: Círculo das Estrelas) -- NOVA nesta correção
  // (CRITICAL 3 da revisão independente). Não é a Causa 1: simular o
  // conserto da Causa 1 (afrouxar a guarda "sempre") contra os dados reais
  // mostra que Estrelas continua devolvendo [] -- três bloqueios próprios,
  // nenhum deles resolvido pelo fix da Causa 1.

  // As três causas, vistas pela rota separada dos acessores que a FICHA
  // salva usa (site/js/pages/sheet.js:48-49), não pela subida de nível em
  // si -- por isso 'subclasses-magias-ficha', não 'subclasses-magias' (ver
  // comentário de TESTES_VALIDOS acima).
  // Círculo da Terra (Causa 2 do domínio Magias) -- CORRIGIDA em 2026-08-18
  // (Plano 4 da rodada de correção), nas duas rotas. O app somava as QUATRO
  // tabelas de terreno (12 magias no nível 3 contra o teto 3 do livro) porque
  // nunca perguntava qual terreno o jogador escolheu. Agora pergunta: a
  // escolha entrou em regras-subclasse-escolhas.js como linha
  // 'subclasse_terreno', vira pendência de subida de nível com card próprio, e
  // grava em escolhas_classe.circulo_terra_terreno. O extrator de tabela
  // (extrairMagiasSemprePreparadasTabela) passou a RECORTAR o bloco do terreno
  // escolhido -- e, sem escolha em mãos, devolve vazio de propósito, em vez de
  // somar alternativas que o personagem nunca escolheu. Sem lacuna
  // remanescente nesta chave.

  // ---------- Domínio Subclasses/Escolhas (2026-08-17) ----------
  //
  // subclasses-escolhas.test.mjs confronta, para as 48 subclasses, se o
  // livro exige uma decisão de construção (ou concede algo automaticamente)
  // que o app não reconhece -- em DUAS rotas que precisam concordar: a
  // pendência que subirDeNivel levanta (Direção 1, Grupo 3) e se ALGUMA
  // coisa no personagem realmente mudou (o converso, Grupo 6 -- pega o app
  // que concede sem perguntar, o que a Direção 1 sozinha marcaria como
  // vermelho por arquitetura, não por comportamento). Os 32 vermelhos desta
  // rodada caem em QUATRO causas de código -- não 32 lacunas independentes.
  //
  // MÉTODO (Step 1 do brief): para cada divergência, `grep -rn` pelo CAMPO
  // (`campoEsperado` do catálogo) e pela CARACTERÍSTICA (nome exato do
  // livro) em site/js/ inteiro -- nunca só pelo nome da subclasse, que
  // aparece dezenas de vezes por razões alheias à escolha (listas de
  // magias, tabelas de progressão, textos de versão).
  //
  // CORREÇÃO (2026-08-18, pós-revisão independente -- ver
  // task-6-report.md, seção "Correção pós-revisão", para a análise
  // completa): a primeira versão deste bloco tinha TRÊS causas, e a Causa 1
  // classificava Cavaleiro Místico/Trapaceiro Arcano nv3 "Conjuração" como
  // "nenhum controle dedicado existe, em lugar nenhum" -- CRITICAL 1 da
  // revisão, e falso. A lição do guia (2026-08-07, citada na versão
  // anterior deste comentário: "a busca que importa acha os CONSUMIDORES
  // reais, não só a primeira ocorrência") não foi seguida até o fim -- a
  // leitura das 25/31 ocorrências de site/js/ parou no MECANISMO DE
  // ESPAÇOS DE MAGIA (regras-conjuracao-subclasse.js, que funciona) sem
  // seguir `truquesGanhos`/`magiasGanhas` (levelup-flow.js) até a CAMADA DO
  // ASSISTENTE de subida de nível, que pergunta, bloqueia e grava as duas
  // escolhas de verdade (ver a entrada própria, logo abaixo). Corrigido:
  // as duas saem da Causa 1 e ganham entrada própria com
  // `tipo: 'limitacao-observabilidade'` -- não é alegação de bug do app, é
  // registro de que esta rota do motor (que dirige só `subirDeNivel`) não
  // alcança a camada onde o controle mora. Ver LIMITE DECLARADO em
  // subclasses-escolhas.test.mjs (estendido nesta mesma correção).
  //
  // As quatro causas, na ordem em que aparecem abaixo:
  //   Causa 1 -- nenhum controle dedicado por característica existe em
  //     lugar NENHUM (nem levelup.js, nem a ficha, nem a camada do
  //     assistente de subida de nível): 6 características (7 entradas de
  //     ESCOLHAS_SUBCLASSE, porque Estudioso da Guerra tem duas escolhas
  //     de tipos diferentes na mesma característica). Em 3 das 6 (Colégio
  //     do Conhecimento nv3/nv6, Campeão) a ficha mostra um texto
  //     DECORATIVO (lembrete somente-leitura, sem controle nenhum); nas
  //     outras 3 (Estudioso da Guerra, Glamour Transcendental, Círculo da
  //     Terra), nada em site/js/ sequer menciona a característica.
  //   Causa 1-bis -- LIMITAÇÃO DE OBSERVABILIDADE, não alegação de bug:
  //     Cavaleiro Místico e Trapaceiro Arcano nv3 "Conjuração" TÊM controle
  //     dedicado, obrigatório e persistido -- só que na CAMADA DO
  //     ASSISTENTE (levelup-flow.js/levelup-cards.js/levelup-ui.js), fora
  //     do que este motor dirige (só `subirDeNivel`, ver LIMITE DECLARADO
  //     em subclasses-escolhas.test.mjs). 2 características, 4 entradas
  //     (cada uma soma a escolha de truques e a de magias de 1º círculo).
  //   Causa 2 -- o controle EXISTE, dedicado, específico da característica
  //     (um <select>/<input> em site/js/sheet/*.js que grava
  //     char.recursos.*) -- só que char.recursos nunca é criado pelo
  //     caminho subirDeNivel (nem por store.criarPersonagemVazio()), então
  //     o assistente de subida de nível nunca pergunta nem gate a escolha:
  //     o jogador só a encontra se souber abrir a ficha salva depois. 7
  //     características, 7 entradas -- DUAS delas (Resistência Ínfera, O
  //     Terceiro Olho) têm uma ressalva própria, ver o motivo da entrada:
  //     o LIVRO nasce a escolha num Descanso/uso, não no nível de
  //     aquisição, então "o assistente não pergunta NO NÍVEL" não é, por
  //     si só, uma violação de regra para essas duas.
  //   Causa 3 -- concessões AUTOMÁTICAS (o livro não pergunta nada, "você
  //     adquire X") que nenhum código em site/js/ jamais aplica -- nem
  //     subirDeNivel, nem a ficha, nem o assistente de criação. 5
  //     características, 5 entradas (só Grupo 6 -- CONCESSOES_AUTOMATICAS_SUBCLASSE
  //     não tem par na Direção 1 por definição, ver cabeçalho do catálogo).
  //
  // Aritmética: Causa 1 -- 7 (Direção 1) + 6 (converso; Círculo da Terra
  // não conta porque seu converso PASSA hoje, ver motivo) = 13. Causa 1-bis
  // -- 4 (Direção 1) + 4 (converso) = 8. Causa 2 -- 7 (só Direção 1; o
  // converso das 7 é SKIP, não FAIL, pelo mecanismo
  // RAIZES_FORA_DA_ROTA_SUBIRDENIVEL já existente no motor -- não precisa
  // de comLacuna). Causa 3 -- 5 (só converso). Total 13+8+7+5 = 33, batendo
  // com `1799 testes, 1728 pass, 0 fail, 71 skip` medido depois da correção
  // pós-revisão de 2026-08-18 (CRÍTICO 1: Treinamento Marcial, Colégio da
  // Bravura, saiu de `t.skip` indevido -- `campoEsperado` apontava para
  // `proficiencias_armaduras`, campo só LIDO em site/js/, nunca escrito --
  // e entrou na Causa 3, subindo o total de 32 para 33 e o skip count de 72
  // para 71; comLacuna converte o `not ok` em `ok`, então o `fail` do motor
  // continua 0). A correção anterior (Task 5, ver task-4-report.md para o
  // baseline `1798 testes, 1694 pass, 32 fail, 72 skip`) só RECLASSIFICOU 8
  // call sites (4 Direção 1 + 4 converso) de Causa 1 para Causa 1-bis; não
  // mudou o total de vermelhos nem o comportamento de nenhum teste.
  //
  // `talento` de cada entrada é REPRESENTATIVO da causa (mesmo padrão de
  // CAUSA_DIVERGENCIA_ATIVO_PASSIVO em classes-passivas.test.mjs e do bloco
  // Subclasses/Magias acima) -- o motor mapeia cada característica real
  // para a entrada certa via CAUSA_ESCOLHA_SUBCLASSE
  // (subclasses-escolhas.test.mjs); não é alegação de que o bug é
  // específico daquela subclasse. `motivo` nomeia por extenso todas as
  // características realmente afetadas.
  // Colégio do Conhecimento (Causa 1: 7 entradas sem controle em lugar nenhum
  // do app) e Assassino (Causa 4: as 5 concessões automáticas que o livro
  // concede sem perguntar e o app nunca aplicava) -- CORRIGIDAS em 2026-08-18
  // (Plano 4 da rodada de correção).
  //
  // O app não tinha mecanismo genérico para "esta característica de subclasse
  // exige uma decisão neste nível": levelup.js reconhecia 15 tipos de
  // pendência escritos um a um. Escrever mais 12 ramos à mão repetiria o
  // defeito, então entrou uma TABELA declarativa,
  // site/js/regras-subclasse-escolhas.js (17 linhas), mais um laço em
  // subirDeNivel e um card GENÉRICO no assistente
  // (levelup-cards.js:montarCardsEscolhaSubclasse). A próxima característica
  // que o livro mandar escolher é uma LINHA, não um ramo.
  //
  // A UI não era opcional aqui, diferente dos Planos 1-3: pendência sem card
  // TRAVA o jogador -- ele não sobe de nível e não tem onde responder.
  // Sem lacuna remanescente nessas chaves.
  { talento: 'Cavaleiro Místico', teste: 'subclasses-escolha-ausente',
    tipo: 'limitacao-observabilidade',
    motivo: 'Causa 1-bis desta rodada -- CRITICAL 1 da revisão independente de 2026-08-18: a versão ' +
      'anterior classificava Cavaleiro Místico e Trapaceiro Arcano nv3 "Conjuração" na Causa 1 ("nenhum ' +
      'controle dedicado existe, em lugar nenhum") -- falso. O app PERGUNTA, BLOQUEIA e GRAVA as duas ' +
      'escolhas da característica (2 truques à escolha, Classes.md:3932/:4459; 3 magias de 1º círculo, ' +
      'Classes.md:3962/:4467), só que numa camada que este motor de teste de unidade não dirige -- ver ' +
      'LIMITE DECLARADO em subclasses-escolhas.test.mjs (estendido nesta mesma correção). Evidência, ' +
      'ponto a ponto: (1) `levelup-flow.js:calcularConjuracao` (linhas 297-306, comentário explicativo em ' +
      ':285-296) recalcula a conjuração REATIVAMENTE à subclasse escolhida NESTA MESMA sessão do ' +
      'assistente -- existe precisamente porque Cavaleiro Místico/Trapaceiro Arcano ganham conjuração no ' +
      'MESMO nível (3) em que a subclasse é escolhida, e `char.subclasse` ainda não está gravado quando ' +
      'o contexto é montado. (2) `truquesGanhos` (levelup-flow.js:134) e `magiasGanhas` ' +
      '(levelup-flow.js:138) valem 2 e 3 no nível 3 -- confirmado contra ' +
      '`regras-conjuracao-subclasse.js:22` (`preparadas: 3` na linha do nível 3) e :41-52 (`truques: ' +
      '(nivel) => nivel >= 10 ? 3 : 2` para Cavaleiro Místico; Trapaceiro Arcano soma o truque fixo Mãos ' +
      'Mágicas por cima da mesma fórmula) -- exatamente as quantidades que o livro pede em ' +
      'Classes.md:3932/:3962 e :4459/:4467. (3) `levelup-cards.js:483-515` renderiza os cartões "Novos ' +
      'Truques (+2)" e "Novas Magias Conhecidas (+3)", com contador e estado de erro -- o segundo card é ' +
      'condicionado a `tipoConj === "conhecidas"` (levelup-cards.js:506), e `levelup-flow.js:50` computa ' +
      '`tipoConj` como "conhecidas" para as duas subclasses (nem Guerreiro nem Ladino têm ' +
      '`tipo_conjuracao` em CLASSES_INFO, e o fallback `ehSubConj ? "conhecidas" : "preparadas"` resolve ' +
      'para "conhecidas" quando a subclasse concede conjuração). (4) a escolha é OBRIGATÓRIA: ' +
      '`levelup-flow.js:462-463` e `levelup-validations.js:192-195` travam a confirmação até as duas ' +
      'listas estarem completas. (5) o resultado é GRAVADO exatamente nos campos que o catálogo declara ' +
      'como campoEsperado: `levelup-ui.js:1617-1636` grava em `char.magias_conhecidas` (truques) e ' +
      '`char.magias_preparadas` (magias de 1º círculo). (6) "nem concedidos" também é falso para Mãos ' +
      'Mágicas do Trapaceiro Arcano especificamente: `levelup.js:1274-1284` concede o truque ' +
      'automaticamente (origem: `subclasse_fixa`) -- essa concessão fixa em si fica fora do escopo de ' +
      'ESCOLHAS_SUBCLASSE (não é escolha do jogador), citada aqui só para reforçar que o mecanismo de ' +
      'conjuração desta subclasse é real de ponta a ponta, não só os espaços. Por que este motor não vê ' +
      'nada disso: dirige só `subirDeNivel` (site/js/levelup.js, via `escadaDeNivel`/harness.mjs), e ' +
      '`subirDeNivel` sozinho NUNCA levanta pendência para truques/magias de conjuração (`grep -n ' +
      '"tipo_pendencia:" site/js/levelup.js` não tem "truques" nem "magias_conhecidas" entre os 15 tipos) ' +
      '-- essa pendência (o array `requirements`) é montada por `buildLevelUpContext` (levelup-flow.js), ' +
      'da CAMADA DO ASSISTENTE que este motor não chama. Do mesmo jeito, a gravação em ' +
      '`char.magias_conhecidas`/`char.magias_preparadas` para estas duas escolhas acontece em ' +
      '`levelup-ui.js` ANTES de chamar `subirDeNivel` (comentário em levelup-ui.js:1604, "Processar ' +
      'magias antes de subirDeNivel"); `escadaDeNivel` nunca passa por esse código, só por ' +
      '`subirDeNivel` puro. Por isso a Direção 1 (nenhuma pendência específica de subclasse aparece) e o ' +
      'converso (`magias_conhecidas`/`magias_preparadas` não crescem) ficam vermelhos aqui mesmo com o ' +
      'app correto -- é o motor que é cego a esta camada, não o app que está errado.' },
  // ESTREITADA em 2026-08-18 (Plano 4 da rodada de correção). A alegação
  // original -- "o controle existe, mas só na ficha, nunca no assistente" --
  // valia para 7 características; 5 delas ganharam pendência de subida de
  // nível e fecharam. Sobram DUAS, e a alegação mudou de natureza: não é mais
  // sobre o app estar errado, é sobre o CATÁLOGO esperar pendência de nível
  // para uma escolha que o livro põe num DESCANSO.
  { talento: 'Caçador', teste: 'subclasses-escolha-ausente',
    tipo: 'limitacao-observabilidade',
    motivo: 'Resistência Ínfera (Patrono Ínfero nv10, Classes.md:1467 -- "Ao completar um Descanso ' +
      'Curto ou Longo, escolha um tipo de dano, exceto Energético") e O Terceiro Olho (Adivinhador ' +
      'nv10, Classes.md:5020 -- mesma forma). O motor (Grupo 3) espera, para as 14 escolhas de ' +
      'construção do catálogo, uma pendência de subida de NÍVEL. Cumprir isso nessas duas faria o ' +
      'app EXIGIR no nível uma escolha que o livro só pede no descanso seguinte -- inventar regra, ' +
      'que é o oposto do que esta suíte existe para fazer. O próprio motivo anterior desta entrada ' +
      'já registrava a ressalva ("para 2 das 7 o livro nasce a escolha só no primeiro Descanso/uso ' +
      'após a aquisição, não no nível em si, então a ausência na TELA DE NÍVEL não é, sozinha, ' +
      'violação"). O que o app FAZ hoje para as duas: subirDeNivel não bloqueia, e o controle ' +
      'dedicado da ficha (sheet/habilidades.js:375 para Resistência Ínfera; sheet/classes/mago.js:100 ' +
      'para O Terceiro Olho) continua sendo onde a escolha é feita -- que é onde o livro a coloca. ' +
      'A decisão está registrada em docs/PERGUNTAS-PENDENTES.txt, com o que muda se a preferência ' +
      'for uniformidade: são ~10 linhas na tabela de regras-subclasse-escolhas.js, ao custo de o app ' +
      'travar a subida de nível por uma escolha que o livro não pede ali. As outras 5 da alegação ' +
      'original (Aspecto dos Selvagens, Afinidade Elemental, Presa do Caçador, Táticas Defensivas, ' +
      'Companheiro Primal) fecharam: nascem no nível de aquisição e hoje têm pendência e card.' },

  // ---------- Domínio Subclasses/Recursos (2026-08-18) ----------
  //
  // subclasses-recursos.test.mjs (Grupos 2-5, Task 6 do plano
  // 2026-08-18-regras-subclasses-4-recursos) confronta detectarUsosMaximos/
  // detectarRecarga/ehHabilidadeAtiva (as MESMAS heurísticas do bloco
  // Classes/Passivas acima) e a restauração real de hp-descanso.js contra as
  // 27 características de subclasse citáveis (base custo-declarado/
  // ausência-de-custo, não composta). Dez divergências: DUAS são o mesmo
  // código das causas abertas de Classes/Passivas (call sites novos na
  // entrada acima -- Mapa Estelar
  // e Sentinela Imortal/detectarUsosMaximos); as outras oito caem nas três
  // chaves abaixo, na granularidade do CONSERTO (não das 8 divergências
  // individuais).
  //
  // MÉTODO (regra do brief desta tarefa -- "procurei pelo benefício ou só
  // pelo nome que eu inventei?"): para cada uma, `grep -rn` pelo CAMPO
  // dedicado e pelo NOME da função (detectarUsosMaximos/ehHabilidadeAtiva)
  // em site/js/sheet/habilidades.js inteiro -- nunca só pela característica.
  // Essa busca invalidou uma leitura herdada dos relatórios anteriores desta
  // mesma tarefa (task-3-report.md/task-4-report.md, que este arquivo
  // NÃO pode editar, mas cuja alegação de "consequência medida" para
  // Sentinela Imortal/Grupo 2 -- um contador "3/3" -- não sobreviveu a essa
  // busca; ver a chave 'subclasses-recursos-usos-sem-consequencia' e a nota
  // de correção na entrada 'classes-passivas-descanso-curto-janela' acima):
  // Sentinela Imortal tem ramo dedicado (habilidades.js:4379-4394) que nunca
  // lê usosMax, então o valor errado do Grupo 2 nunca chega à tela -- o
  // relatório anterior não tinha confirmado isso lendo o código, só citado
  // por analogia com Fúria Implacável (que tem consequência real, mas por um
  // caminho DIFERENTE, sem ramo dedicado). Este achado não é registrado como
  // lacuna própria (é sobre a QUALIDADE de um relatório anterior, não sobre
  // o app) -- só corrigido aqui e no texto do call site.
  //
  // `talento` de cada entrada é REPRESENTATIVO da causa quando ela afeta mais
  // de uma característica/subclasse (mesma convenção do bloco Subclasses/
  // Magias, acima) -- não é uma alegação de que o bug é específico daquela
  // subclasse. Em particular, 'subclasses-recursos-usos-sem-consequencia'
  // usa `talento: 'Feitiçaria Selvagem'` para SEIS características de CINCO
  // subclasses diferentes (Trilha do Fanático, Patrono Celestial,
  // Feitiçaria Selvagem ×2, Trapaceiro Arcano, Adivinhador) -- o `motivo`
  // nomeia as seis por extenso.
  // 'subclasses-recursos-usos-sem-consequencia' (6 características de 5
  // subclasses) -- CORRIGIDA em 2026-08-18, de carona no Plano 3. Era
  // `limitacao-observabilidade`: detectarUsosMaximos devolvia null contra um
  // número real do catálogo, mas sem consequência de tela (5 das 6 têm ramo
  // dedicado que nunca lê usosMax, e a 6ª tem valor real 1, abaixo do limiar
  // de temMultiplosUsos). O conserto veio junto do da Fúria Implacável: ao
  // parar de ler "X vezes seu nível" como contagem de usos, a função ficou
  // devendo os DOIS jeitos que o livro usa de verdade, e os dois entraram --
  // "uma reserva de quatro d12s" (adjetivo numeral antes do dado, Campeão dos
  // Deuses) e o limite implícito de 1 uso declarado por frase de descanso, em
  // qualquer ordem ou polaridade ("não pode utilizá-la novamente até",
  // "pode usar esta característica novamente após", "antes de poder usar esta
  // característica novamente"). Sem lacuna remanescente nesta chave.
  // Sentinela Imortal (Juramento dos Anciões, Paladino nv15) --
  // 'subclasses-recursos-ativa-curto-circuito-automatico' CORRIGIDA em
  // 2026-08-18, junto com as 7 causas de Classes/Passivas (ver o registro
  // histórico logo acima do bloco delas). Era o curto-circuito
  // `if (recarga) return true`: a característica dispara sozinha ao jogador
  // ser reduzido a 0 Pontos de Vida, mas tem uso limitado que recarrega em
  // Descanso Longo, e isso bastava para classificá-la como ativa. O que a
  // separa de Surto de Ação (que TEM custo, e também recarrega) é o verbo de
  // decisão: o único "pode" do texto dela está em "você NÃO pode utilizá-la
  // novamente".
  // Defesa Gloriosa (Juramento da Glória, Paladino, nível 15) -- CORRIGIDA em
  // 2026-08-18 (Plano 1 da rodada de correção). site/js/sheet/hp-descanso.js
  // guardava quatro blocos de restauração do Paladino com `char.subclasse ===
  // 'Juramento de X'` (:582 Devoção/Curto, :974 Glória/Longo, :979
  // Vingança/Longo, :988 Devoção/Longo), mas o nome real, gravado a partir de
  // dados/classes/paladino.json, é 'Juramento da X' -- os quatro `if` eram
  // código morto, e 3 das 4 trilhas de Juramento nunca restauravam recurso
  // nenhum em Descanso nenhum. Só :983 ('Juramento dos Anciões') estava
  // escrita certa, e é o contraste que provou ser grafia, não mecanismo.
  // Corrigidos os quatro literais. As outras 3 características atingidas pelo
  // mesmo typo (Resplendor Sagrado, Lenda Viva, Anjo Vingador -- `composta`,
  // sem chave própria) voltaram a restaurar junto, e a divergência sai do
  // `t.skip` correspondente.
  //
  // O conserto veio com instrumento novo, não só com o remendo:
  // unidade/subclasse-nome-literal.test.mjs confronta TODO literal
  // `subclasse === '...'` de site/js/ (154 ocorrências) contra os 48 nomes de
  // dados/classes/*.json. Nasceu vermelho apontando exatamente estes quatro e
  // mais nada -- medido, não suposto. Sem lacuna remanescente nesta chave.

  // ---------- Domínio Espécies (2026-08-18) ----------
  //
  // Voo Dracônico (Draconato, nível 5, Espécies.md:106) -- CORRIGIDA no mesmo
  // dia em que foi registrada. `obterCaracteristicasEspecieNivel`
  // (site/js/levelup.js) resolvia os traços com nível por DOIS `if` escritos à
  // mão -- Golias/Forma Grande (nv5) e Aasimar/Revelação Celestial (nv3) --
  // seguidos do comentário "Adicione outras espécies conforme necessário". O
  // Draconato nunca foi adicionado, e um ramo que não existe não falha: só não
  // anuncia nada.
  //
  // O conserto não acrescentou um terceiro `if`: trocou os dois por uma
  // varredura sobre o DADO, usando a MESMA regex de nível que a ficha já
  // aplicava para esconder o traço antes da hora
  // (sheet/caracteristicas.js:201). As duas telas passaram a concordar por
  // construção, em vez de por coincidência, e a próxima espécie com traço de
  // nível funciona sem tocar em levelup.js. Medido antes de trocar: a regex
  // casa em exatamente três traços nas 11 espécies de dados/ -- os dois que já
  // eram anunciados mais o que faltava, sem ruído.
  //
  // Efeito colateral bem-vindo: o card da subida de nível passou a mostrar o
  // texto do livro em vez das duas paráfrases curtas que os `if` traziam
  // escritas à mão. Sem lacuna remanescente nesta chave.
];

// Busca a lacuna registrada para um par (talento, teste), se houver.
export function lacuna(talento, teste) {
  return LACUNAS.find((l) => l.talento === talento && l.teste === teste) || null;
}
