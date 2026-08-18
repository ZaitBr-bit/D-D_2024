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
  'classes-passivas-ativa-no-turno', 'classes-passivas-recarga-troca-escolha',
  'classes-passivas-clausula-lateral', 'classes-passivas-descanso-curto-janela',
  'classes-passivas-acao-bonus-parte-de', 'classes-passivas-custo-verbo-rigido',
  'classes-passivas-reacao-executar',
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
  // conserto de 'classes-passivas-descanso-curto-janela', acima, já falava
  // de detectarUsosMaximos antes desta tarefa). Só
  // 'subclasses-recursos-paladino-guarda-juramento' (guarda de subclasse do
  // Paladino) é código isolado, sem sobreposição com o bloco Classes/
  // Passivas.
  'subclasses-recursos-usos-sem-consequencia',
  'subclasses-recursos-ativa-curto-circuito-automatico',
  'subclasses-recursos-paladino-guarda-juramento',
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
  { talento: 'Guerreiro', teste: 'classes-passivas-ativa-no-turno',
    tipo: 'app-diverge-do-livro',
    motivo: 'ehHabilidadeAtiva (site/js/utils.js:499-511) inclui "no seu turno" na lista de frases ' +
      'que classificam uma característica como ativa. Em 8 características de classe base o livro usa ' +
      'essa frase para dizer QUANDO o benefício PASSIVO vale, não como ele é ativado -- todas ganham ' +
      '"Habilidades Ativas" na ficha quando o livro nunca condiciona nenhuma delas a uma decisão ' +
      'custeada: Ataque Extra de Bárbaro (Classes.md:125), Guardião (Classes.md:3332), Guerreiro ' +
      '(Classes.md:3852), Monge (Classes.md:5224) e Paladino (Classes.md:5569) -- "...sempre que ' +
      'executar a ação Atacar no seu turno", onde "você pode" é retórico (permissão de atacar duas ' +
      'vezes, não uma escolha com custo); Dois Ataques Extras (Guerreiro nível 11, Classes.md:3866) e ' +
      'Três Ataques Extras (Guerreiro nível 20, Classes.md:3878), mesma forma textual; Movimento ' +
      'Acrobático (Monge nível 9, Classes.md:5242) -- "...capacidade de se mover no seu turno ao longo ' +
      'de superfícies verticais...", "no seu turno" qualificando quando o movimento vale, não ' +
      'ativação. Consequência medida (site/js/sheet/caracteristicas.js:37-38): estas 8 características ' +
      'aparecem em "Habilidades Ativas" na ficha; o livro (nenhuma delas tem custo declarado) as ' +
      'colocaria em "Habilidades Passivas". Exibição apenas -- o texto do bônus não muda, e nenhuma ' +
      'delas tem `recarga` detectada (não entram no controle interativo das causas 2/4, abaixo).' },
  { talento: 'Bárbaro', teste: 'classes-passivas-recarga-troca-escolha',
    tipo: 'app-diverge-do-livro',
    motivo: 'detectarRecarga (site/js/utils.js:482-494) casa a substring "descanso longo" em ' +
      'qualquer lugar do texto, sem checar se ela está presa a um LIMITE DE USO -- e ehHabilidadeAtiva ' +
      '(utils.js:508, `if (recarga) return true`) trata qualquer recarga detectada como prova de ' +
      '"ativa". Em 6 características de classe base a cláusula de Descanso Longo não é recarga de uso ' +
      'limitado: é a TROCA de uma escolha permanente, regrada por Descanso Longo, e a característica ' +
      'em si é capacidade contínua. Maestria em Arma: Bárbaro (Classes.md:97) e Guerreiro ' +
      '(Classes.md:3816) usam a mesma frase, "Sempre que completar um Descanso Longo, você pode ' +
      'praticar movimentos com armas e alterar uma dessas escolhas de armas"; Guardião (Classes.md:3306) ' +
      'e Paladino (Classes.md:5521) usam uma frase parecida mas DIFERENTE, "Sempre que completar um ' +
      'Descanso Longo, você pode alterar os tipos de armas que escolheu"; Ladino (Classes.md:4226) usa ' +
      'a mesma frase de Guardião/Paladino, mas com "Ao completar" no lugar de "Sempre que completar". ' +
      'Maestria de Magias do Mago (nível 18, Classes.md:4652, "Ao completar um Descanso Longo, você ' +
      'pode estudar seu livro de magias e substituir uma dessas magias..."). Consequência medida ' +
      '(caracteristicas.js:37-38): as 6 aparecem em "Habilidades Ativas"; o livro (nenhuma delas tem ' +
      'Ação/Ação Bônus/Reação/recurso gasto) as colocaria em "Habilidades Passivas". ' +
      'CORRIGIDO em 2026-08-08 (achado da revisão final da Task 8, que este motivo superafirmava antes ' +
      'da correção): "as 6 têm `recarga` detectada e `ativa===true`" é verdade, mas isso NÃO significa ' +
      'que as 6 caem no controle interativo -- renderFeatureItem (habilidades.js) tem um ramo DEDICADO ' +
      'por classe para "Maestria em Arma" (ehMaestriaBarbaro :2748, ehMaestriaGuerreiro :3916, ' +
      'ehMaestriaGuardiao :3990, ehMaestriaPaladino :4000, ehMaestriaLadino :4010) que preenche ' +
      '`usosHtmlBody` com um botão "Definir Maestrias" (`data-config-maestrias`) ANTES de chegar na ' +
      'condição interativa -- e essa condição (`!usosHtmlBody && ativa && recarga`, habilidades.js:4683) ' +
      'é guardada por `!usosHtmlBody`, então nunca dispara para essas 5. Só a 6ª (Maestria de Magias do ' +
      'Mago, que não tem ramo dedicado por não ser "Maestria em Arma") cai no fallback e recebe o botão ' +
      '"✓ Disponível"/"✗ Usado" (`data-toggle-uso`, habilidades.js:4686); clicar nele grava ' +
      '`char.usos_habilidades[key] = !char.usos_habilidades[key]` e chama `salvar()` ' +
      '(habilidades.js:38-41) -- uma capacidade contínua (a Maestria de Magias nunca "se esgota") passa ' +
      'a ter um estado de uso marcável e persistido na ficha, que o livro não prevê. Confirmado ' +
      'executando renderFeatureItem/ehHabilidadeAtiva/detectarRecarga de verdade sobre as 6 descrições ' +
      'brutas de dados/classes/*.json: as 5 de "Maestria em Arma" produzem `data-config-maestrias`, só a ' +
      'do Mago produz `data-toggle-uso` (script ad hoc; a alegação anterior de que as 6 tinham sido ' +
      '"confirmadas" chamando a função de verdade não tinha, de fato, sido verificada -- rodar o script ' +
      'de novo mostra o resultado oposto ao que o motivo antigo descrevia para 5 das 6). Para as 5 sem o ' +
      'toggle, sobra uma consequência real mais modesta: `recargaBadge` ("🌙 Desc. Longo", ' +
      'habilidades.js:2727-2729, injetado no card em :4699) aparece do lado do nome da característica, ' +
      'rotulando como "recarrega no Descanso Longo" algo que na verdade nunca se esgota -- só o selo, ' +
      'sem estado persistido nem botão clicável. ' +
      'AVISO (revisão independente de 2026-08-18, ver \'subclasses-recursos-ativa-curto-circuito-' +
      'automatico\', domínio Subclasses/Recursos): o curto-circuito `if (recarga) return true` ' +
      '(utils.js:535, citado acima como `utils.js:508` numa versão anterior do código) é a MESMA linha ' +
      'que classifica Sentinela Imortal (subclasse) como ativa por engano na entrada irmã -- um patch em ' +
      '`utils.js:535` que passasse a checar um verbo de decisão do jogador mesmo com `recarga` verdadeiro ' +
      'resolveria as 6 características desta entrada E Sentinela Imortal ao mesmo tempo. As duas ' +
      'continuam causas SEPARADAS (aqui a detecção de `detectarRecarga` está ERRADA -- lê troca de escolha ' +
      'como recarga; lá a detecção está CERTA e só a conclusão do curto-circuito erra), mas quem for mexer ' +
      'em `utils.js:535` precisa reconferir as duas entradas, não só uma.' },
  { talento: 'Bárbaro', teste: 'classes-passivas-clausula-lateral',
    tipo: 'app-diverge-do-livro',
    motivo: 'A frase-gatilho "você pode usar" (lista de ehHabilidadeAtiva, utils.js:499-511) casa, ' +
      'em 6 características, uma cláusula SECUNDÁRIA do texto -- não a frase que define o benefício ' +
      'sendo classificado. Defesa sem Armadura de Bárbaro (Classes.md:93): benefício é o cálculo de ' +
      'CA (10+Des+Con), sem custo; a frase capturada é "Você pode usar um Escudo e ainda receber este ' +
      'benefício" -- aviso de compatibilidade, não custo. Golpe Brutal Aprimorado (Classes.md:171 -- ' +
      'o TÍTULO de prosa do livro chama esta característica de "Golpe Brutal Fortalecido", ' +
      'Classes.md:169; "Aprimorado" é a forma que dados/classes/barbaro.json usa, e é a que este ' +
      'catálogo segue por convenção com o restante da suíte, ver task-3-report.md): benefício é dano ' +
      'numérico maior; frase capturada é "você pode usar dois efeitos diferentes de Golpe Brutal" -- ' +
      'muda o ESCOPO de outra característica, não custo desta. Força Indomável (Classes.md:175): "você ' +
      'pode usar esse valor no lugar do resultado total" -- piso incondicional, sem decisão real, mas ' +
      'contém a frase literalmente. Idioma Druídico de Druida (Classes.md:2052): benefício é a magia ' +
      'sempre preparada; frase capturada é "Você pode usar Druídico para deixar mensagens ocultas" -- ' +
      'um USO do idioma, não ativação. Apoteose Arcana de Feiticeiro (Classes.md:2720): "você pode ' +
      'usar uma opção de Metamagia... sem gastar Pontos de Feitiçaria" -- isenta o custo de OUTRA ' +
      'característica, não introduz custo próprio. Defletir Energia de Monge (Classes.md:5262): "Agora ' +
      'você pode usar sua característica Defletir Ataques contra..." -- amplia o ESCOPO de outra ' +
      'característica, não custo desta. Consequência medida (caracteristicas.js:37-38): as 6 aparecem ' +
      'em "Habilidades Ativas"; o livro as colocaria em "Habilidades Passivas" (nenhuma tem custo ' +
      'próprio declarado). Exibição apenas -- nenhuma das 6 tem `recarga` detectada (não entram no ' +
      'controle interativo das causas 2/4).' },
  { talento: 'Mago', teste: 'classes-passivas-descanso-curto-janela',
    tipo: 'app-diverge-do-livro',
    motivo: 'detectarRecarga (site/js/utils.js:482-494) casa "descanso curto" como recarga de uso ' +
      'limitado em 2 características onde o Descanso Curto é uma JANELA/RESET sem limite de reuso, ' +
      'não uma recarga de usos gastos. Memorizar Magia do Mago (Classes.md:4646, "Ao completar um ' +
      'Descanso Curto, você pode... substituir uma das magias") -- o próprio catálogo nota que é ' +
      'diferente de Recuperação Arcana (que É recarga de verdade); a troca não tem limite de reuso, só ' +
      'a janela em que é permitida. Fúria Implacável do Bárbaro (Classes.md:153, "...Ao completar um ' +
      'Descanso Curto ou Longo, a CD volta para 10") -- é o RESET de uma CD escalonada por uso, não ' +
      'recarga de uma capacidade com usos limitados (a salvaguarda em si não tem limite de uso, só ' +
      'fica mais difícil a cada acionamento). Consequência medida (caracteristicas.js:37-38): as 2 ' +
      'aparecem em "Habilidades Ativas"; o livro as colocaria em "Habilidades Passivas". Consequência ' +
      'INTERATIVA (não só o selo, ver nota do bloco): confirmado com renderFeatureItem/ ' +
      'detectarUsosMaximos de verdade (task-6-report.md) que as duas divergem entre si -- Memorizar ' +
      'Magia (usosMax null) recebe o mesmo botão "✓ Disponível"/"✗ Usado" (habilidades.js:4683/4686, ' +
      '`data-toggle-uso`) da causa 2; Fúria Implacável NÃO recebe esse botão -- recebe um controle ' +
      'AINDA MAIS enganoso por uma causa DIFERENTE e não relacionada a esta: detectarUsosMaximos ' +
      '(habilidades.js:2359-2369) lê "duas vezes" em "seus Pontos de Vida mudam para um número igual a ' +
      'duas vezes seu nível de Bárbaro" (a fórmula de PV recuperado, não uma contagem de usos) e ' +
      'devolve usosMax=2, então a característica ganha o botão "Usar"/"✗ Esgotado" ' +
      '(habilidades.js:4674-4682, 2 usos) de uma capacidade que na verdade não tem limite de uso ' +
      'nenhum. Registrado aqui como observação da mesma investigação; a causa raiz é de ' +
      'detectarUsosMaximos, não de detectarRecarga/ehHabilidadeAtiva, e não tem chave própria nesta ' +
      'lista -- fica só documentada, para não inflar o número de causas registradas por algo fora do ' +
      'escopo confirmado desta tarefa. ' +
      'DOIS CALL SITES NOVOS (2026-08-18, Task 6 do domínio Subclasses/Recursos, ' +
      'subclasses-recursos.test.mjs) -- MESMO código, MESMOS dois mecanismos já descritos acima, agora ' +
      'confirmados também sobre características de SUBCLASSE (renderSecaoSubclasse chama as mesmas ' +
      'detectarRecarga/ehHabilidadeAtiva, caracteristicas.js:57-80/64-65 -- achado vinculante da Task 1 ' +
      'deste plano). (1) Mapa Estelar (Círculo das Estrelas, Druida, nível 3, detectarRecarga): o texto ' +
      'tem DOIS parágrafos com Descanso -- o real (Raio Guia, "...restaura todos os usos gastos ao ' +
      'completar um Descanso Longo", catálogo recarga=longo) e um TOTALMENTE ALHEIO sobre recriar o mapa ' +
      'se perdido ("Essa cerimônia pode ser realizada durante um Descanso Curto ou Longo...") -- ' +
      'detectarRecarga funde os dois e devolve curto_ou_longo. Consequência medida: recargaBadge ' +
      '(habilidades.js:2760, injetado sem condição em :4765-4766, ANTES de qualquer ramo dedicado por ' +
      'subclasse rodar -- confirmado lendo o código: o ramo de Mapa Estelar, ehEstrelasMapa ' +
      ':3454-3462, só sobrescreve usosHtmlBody/usosHtmlSummary, nunca recargaBadge) monta "☀🌙 ' +
      'Curto/Longo" em vez de "🌙 Desc. Longo" -- Druida Círculo das Estrelas nível 3+, card "Subclasse — ' +
      'Círculo das Estrelas". (2) Sentinela Imortal (Juramento dos Anciões, Paladino, nível 15, ' +
      'detectarUsosMaximos): o livro diz "...recupera um número de Pontos de Vida igual a TRÊS VEZES o ' +
      'seu nível de Paladino..." (Classes.md:5889, fórmula de cura, não contagem de uso) -- MESMO ' +
      'mecanismo de falso positivo do parágrafo de Fúria Implacável acima ("duas vezes" -> "três vezes"), ' +
      'confirmado rodando detectarUsosMaximos de verdade sobre o texto real: devolve 3 contra o catálogo ' +
      '(usos: 1). DIFERENTE de Fúria Implacável em consequência, e a correção deste motivo: Sentinela ' +
      'Imortal tem ramo PRÓPRIO em renderFeatureItem (ehAncioesSentinelaImortal, habilidades.js: ' +
      '4379-4394) que nunca lê usosMax/temMultiplosUsos -- usa seu campo dedicado ' +
      '(sentinela_imortal_usada, booleano) para montar usosHtmlBody/usosHtmlSummary ANTES da checagem ' +
      '`!usosHtmlBody && temMultiplosUsos` (:4741) rodar, então o valor errado (3) nunca chega à tela: o ' +
      'botão renderizado é "Usar Sentinela Imortal"/"disabled" (booleano), nunca um contador "3/3". ' +
      '**Sem consequência medida** para este call site -- mesma família dos 11 já anotados com ' +
      '`ramoDedicado` no catálogo (Passos Feéricos e outros, ver Grupo 2 de subclasses-recursos.test.mjs), ' +
      'só que Sentinela Imortal não tinha sido identificada como tal antes desta tarefa.' },
  { talento: 'Bárbaro', teste: 'classes-passivas-acao-bonus-parte-de',
    tipo: 'app-diverge-do-livro',
    motivo: 'ehHabilidadeAtiva (utils.js:499-511) reconhece "como ação bônus" (sem "uma") e "como uma ' +
      'ação" (que também casa como prefixo de "como uma ação bônus", quando o texto usa essa variante) ' +
      '-- mas não "como PARTE DA Ação Bônus" -- construção diferente para a mesma ideia (ação concedida ' +
      'dentro de outra ação bônus já em andamento). Bote Instintivo do Bárbaro (nível 7, ' +
      'Classes.md:133, "Como parte da Ação Bônus que você realiza para entrar em Fúria, você pode se ' +
      'mover") tem custo real (é parte de uma Ação Bônus), mas nenhuma frase da lista de gatilhos casa ' +
      'com "como parte da Ação Bônus". Consequência medida (caracteristicas.js:37-38): aparece em ' +
      '"Habilidades Passivas"; o livro (a característica só existe presa a uma Ação Bônus) a colocaria ' +
      'em "Habilidades Ativas". Exibição apenas -- é o único falso NEGATIVO isolado (as outras 5 ' +
      'entradas de falso negativo estão nas causas 6 e 7 abaixo).' },
  { talento: 'Ladino', teste: 'classes-passivas-custo-verbo-rigido',
    tipo: 'app-diverge-do-livro',
    motivo: 'ehHabilidadeAtiva (utils.js:499-511) só reconhece custo em recurso nomeado pelo verbo ' +
      'literal "você pode gastar" -- o livro declara o mesmo tipo de custo com pelo menos duas outras ' +
      'formas em 3 características. Golpe Astuto do Ladino (nível 5, Classes.md:4246) e Golpes Sujos ' +
      '(nível 14, Classes.md:4280): custo em dados nomeado por opção ("Custo: 1d6"/"2d6"/"3d6"/"6d6"), ' +
      'texto de ativação "você pode adicionar... com um custo em dados" -- não contém "você pode ' +
      'gastar". Toque Restaurador do Paladino (nível 14, Classes.md:5599): "Você DEVE gastar 5 Pontos ' +
      'de Vida da reserva de cura" -- usa "deve gastar", não "pode gastar". Consequência medida ' +
      '(caracteristicas.js:37-38): as 3 aparecem em "Habilidades Passivas"; o livro (as 3 têm custo em ' +
      'recurso declarado) as colocaria em "Habilidades Ativas". Exibição apenas.' },
  { talento: 'Ladino', teste: 'classes-passivas-reacao-executar',
    tipo: 'app-diverge-do-livro',
    motivo: 'A lista de gatilhos de ehHabilidadeAtiva (utils.js:499-511) cobre "como uma reação" mas ' +
      'não "executar uma reação" -- a construção mais comum no livro para Reações concedidas por ' +
      'característica de CLASSE. Esquiva Sobrenatural do Ladino (nível 5, Classes.md:4260, "você pode ' +
      'executar uma Reação para reduzir o dano") e Queda Lenta do Monge (nível 4, Classes.md:5220, ' +
      '"Você pode executar uma Reação ao estar em queda para reduzir qualquer dano recebido") têm ' +
      'custo real (gastam a Reação do turno), mas nenhuma frase da lista casa com "executar uma ' +
      'reação". Consequência medida (caracteristicas.js:37-38): as 2 aparecem em "Habilidades ' +
      'Passivas"; o livro (as 2 custam a Reação) as colocaria em "Habilidades Ativas". Exibição ' +
      'apenas.' },

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
  { talento: 'Círculo da Lua', teste: 'subclasses-magias',
    tipo: 'app-diverge-do-livro',
    motivo: 'Causa 1 de 3 desta rodada -- três subclasses de magia sempre preparada que o app não ' +
      'concede nenhuma. Raiz: extrairMagiasSemprePreparadasTabela (site/js/levelup.js:495-524) e ' +
      'extrairMagiasSemprePreparadasTexto (levelup.js:530-560) só processam a descrição da ' +
      'característica se `texto.includes(\'sempre\') && texto.includes(\'preparad\')` (levelup.js:498 e ' +
      ':533) -- nenhuma das três frases de concessão do livro usa a palavra "sempre" (dizem só "...você ' +
      'tem a lista de magias preparadas", sem "sempre" antes), então a guarda barra a extração INTEIRA ' +
      '(tabela) antes mesmo de tentar ler os nomes em itálico -- confirmado rodando ' +
      'obterMagiasSemprePreparadasNivel de verdade: devolve [] para as três em todo nível de concessão. ' +
      'As três TAMBÉM não passam por obterMagiasDominioNivel (levelup.js:746-788): o filtro de nome ' +
      '`/^magias?\\s+de/i` (levelup.js:757) exige "de" logo após "magia(s)", mas as três características ' +
      'se chamam "Magias DO Círculo da Lua"/"...DO Círculo do Mar"/"...DO Vigilante das Sombras" -- "do" ' +
      'não casa com o regex; confirmado rodando obterMagiasDominioNivel de verdade: também devolve [] ' +
      'para as três. As DUAS rotas mortas ao mesmo tempo, pela mesma frase do livro, é o que faz das três ' +
      'UMA causa: afrouxar só a guarda "sempre" (levelup.js:498/:533) já basta -- a rota de domínio pode ' +
      'continuar quebrada, porque o motor confronta a UNIÃO das duas rotas, não uma específica. Por ' +
      'subclasse, o que o livro concede (lido em Classes.md) contra o que o app entrega (medido chamando ' +
      'obterMagiasDominioNivel+obterMagiasSemprePreparadasNivel de verdade, nível a nível, script ad hoc ' +
      'sobre o app real): Círculo da Lua (Druida), Classes.md:2355-2368 ("Ao atingir um nível de Druida ' +
      'detalhado na tabela Magias do Círculo da Lua, você tem a lista de magias preparadas", tabela em ' +
      ':2361-2368, as quatro linhas de nível) -- nv3 Curar Ferimentos/Fagulha Estelar/Raio Lunar, nv5 ' +
      'Invocar Animais, nv7 Fonte do Luar, nv9 Curar Ferimentos em Massa; app entrega [] nos quatro ' +
      'níveis (dados/classes/druida.json transcreve a tabela do livro corretamente -- a divergência é só ' +
      'na LEITURA do app, não na transcrição). Círculo do Mar (Druida), Classes.md:2540-2551 (mesma frase ' +
      'de abertura, "Magias do Círculo do Mar") -- nv3 Despedaçar/Lufada de Vento/Névoa Obscurecente/ ' +
      'Onda Trovejante/Raio de Gelo, nv5 Relâmpago/Respirar na Água, nv7 Controlar Água/Tempestade ' +
      'Glacial, nv9 Invocar Elemental/Paralisar Monstro; app entrega [] nos quatro níveis. Vigilante das ' +
      'Sombras (Guardião), Classes.md:3712-3724 ("Magias do Vigilante das Sombras") -- nv3 Disfarçar-se, ' +
      'nv5 Corda Extradimensional, nv9 Medo, nv13 Invisibilidade Maior, nv17 Similaridade; app entrega [] ' +
      'nos cinco níveis. Consequência medida hoje, e o que mudaria só com o conserto da guarda (grep em ' +
      'site/js/ inteiro por obterMagiasDominioNivel/obterMagiasSemprePreparadasNivel -- três ' +
      'consumidores, não um: dois cobertos aqui, o terceiro em \'subclasses-magias-ficha\'): (1) na TELA ' +
      'de subida de nível, nada muda mesmo com o conserto -- o único card que renderiza magia lá é ' +
      '"Magias de Domínio — Automáticas" (site/js/levelup-cards.js:77-90), alimentado por ' +
      'magiasDominioNivel (levelup-flow.js:198-200), que continua vazio para as três por um bug ' +
      'INDEPENDENTE (o regex de nome "de"/"do" citado acima, que o conserto da guarda não toca); ' +
      'magiasSempreNivel (levelup-flow.js:201-203 -- a variável que o conserto da guarda tornaria ' +
      'não-vazia) NUNCA alimenta card nenhum: seu único consumidor em toda site/js/ é o Set de ' +
      'deduplicação em levelup-ui.js:1241-1245 (confirmado por grep, não há outro). (2) subirDeNivel ' +
      '(levelup.js:1303-1313, o bloco que grava a rota "sempre"; o bloco irmão de domínio, :1291-1297, ' +
      'permanece morto por causa do bug independente do regex "de"/"do") hoje não grava nenhuma dessas ' +
      'magias em personagem.magias_preparadas/magias_conhecidas -- confirmado dirigindo escadaDeNivel de ' +
      'verdade e contando por origem: um personagem real, subido do nível 1 ao 20 com qualquer uma das ' +
      'três subclasses, termina sem nenhuma delas, permanentemente. Depois do conserto da guarda, o ' +
      'efeito visível apareceria só na FICHA salva (via subirDeNivel gravando com origem \'sempre\'), ' +
      'nunca na tela de subida de nível.' },
  { talento: 'Círculo da Terra', teste: 'subclasses-magias',
    tipo: 'app-diverge-do-livro',
    motivo: 'Causa 2 de 3 desta rodada -- CORRIGIDO nesta revisão (a versão anterior deste motivo ' +
      'citava obterMagiasDominioNivel como a função que soma as quatro tabelas de terreno; essa função ' +
      'devolve [] para Círculo da Terra -- a rota de domínio está MORTA aqui, pelo MESMO bug da Causa 1: ' +
      'a característica se chama "Magias DO Círculo da Terra", e o regex de nome de obterMagiasDominioNivel ' +
      '(levelup.js:757) exige "DE". Confirmado rodando de verdade: ' +
      'obterMagiasDominioNivel(\'Druida\',\'Círculo da Terra\',3) = [] e ' +
      'obterTodasMagiasDominio(\'Druida\',\'Círculo da Terra\',20) = [] (0 itens). As 12/4/4/4 magias ' +
      'medidas (nos níveis 3/5/7/9) vêm da rota "sempre preparada": ' +
      'obterMagiasSemprePreparadasNivel(\'Druida\',\'Círculo da Terra\',3) tem 12 itens, e a escada até o ' +
      'nível 20 termina com {"sempre": 24} e ZERO com origem \'dominio\' (script ad hoc, saída no ' +
      'task-6-report.md, seção "Correção pós-revisão"). Por que a rota "sempre" extrai aqui e NÃO na ' +
      'Causa 1: a guarda `texto.includes(\'sempre\')` (levelup.js:498, dentro de ' +
      'extrairMagiasSemprePreparadasTabela) PASSA para Círculo da Terra, porque a frase de abertura do ' +
      'livro (Classes.md:2406) começa com "**Sempre** que completar um Descanso Longo, escolha um tipo ' +
      'de terreno..." -- tem a palavra "sempre", só que qualificando a FREQUÊNCIA da escolha (toda vez ' +
      'que descansa), não a preparação da magia; a guarda não distingue as duas leituras. Depois de ' +
      'passar a guarda, o laço de linhas de extrairMagiasSemprePreparadasTabela (levelup.js:503-521) ' +
      'varre TODAS as linhas da descrição (as quatro tabelas de terreno concatenadas num único campo de ' +
      'texto) procurando `| N | *Magia* |`, sem nenhuma noção de qual `**Terreno X**` cada linha pertence ' +
      'nem de qual terreno o jogador escolheu -- soma as quatro ocorrências do nível pedido. Esta é a ' +
      'causa raiz DIFERENTE da Causa 1: a extração ACONTECE (dentro da MESMA função, ' +
      'extrairMagiasSemprePreparadasTabela), só que aqui ela extrai CERTO e não sabe filtrar pela escolha ' +
      'do jogador -- na Causa 1 a guarda barra tudo e a função nem chega a rodar; aqui a guarda deixa ' +
      'passar e o problema é outro (soma em vez de escolher). Livro: Classes.md:2404-2442, "Nível 3: ' +
      'Magias do Círculo da Terra" -- Classes.md:2406 (citada acima), seguido de QUATRO tabelas ' +
      'alternativas (Terreno Árido Classes.md:2408-2415, Polar :2417-2424, Temperado :2426-2433, Tropical ' +
      ':2435-2442), cada uma concedendo 3 magias no nível 3 e 1 em cada um dos níveis 5/7/9 (6 magias no ' +
      'total de UMA tabela escolhida; 24 se as quatro forem somadas nos quatro níveis -- 12+4+4+4). ' +
      'Medido dirigindo o app de verdade nível a nível (obterMagiasSemprePreparadasNivel): nível 3, 12 ' +
      'magias contra o teto de 3 do livro (Bolha Ácida, Mãos Flamejantes, Névoa Obscurecente, Paralisar ' +
      'Pessoa, Passo Nebuloso, Raio Nauseante, Raio de Fogo, Raio de Gelo, Sono, Teia, Toque Chocante, ' +
      'Turvar); nível 5, 4 contra teto 1 (Bola de Fogo, Nevasca, Nuvem Fétida, Relâmpago); nível 7, 4 ' +
      'contra teto 1 (Malogro, Movimentação Livre, Polimorfia, Tempestade Glacial); nível 9, 4 contra ' +
      'teto 1 (Cone de Frio, Muralha de Pedra, Passo Arbóreo, Praga de Insetos). Consequência medida ' +
      '(CORRIGIDA -- a versão anterior citava um card de subida de nível que na verdade não mostra nada ' +
      'para esta subclasse): o card "Magias de Domínio — Automáticas" (levelup-cards.js:77-90), ' +
      'alimentado por magiasDominioNivel (levelup-flow.js:198-200), fica vazio (rota de domínio morta, ' +
      'ver acima) -- a TELA de subida de nível NÃO oferece as 12 magias do nível 3, nem pede ao jogador ' +
      'para escolher um terreno (magiasSempreNivel, a variável que teria as 12, nunca alimenta card ' +
      'nenhum -- seu único consumidor é o Set de deduplicação em levelup-ui.js:1241-1245). O efeito real ' +
      'aparece só depois, na FICHA: subirDeNivel (levelup.js:1303-1313, o bloco "sempre"; o bloco irmão ' +
      'de domínio, :1291-1297, não roda porque magiasDominio vem []) grava as magias em ' +
      'personagem.magias_preparadas com origem: \'sempre\' -- um Druida de Círculo da Terra termina o ' +
      'nível 9 com 24 magias com essa origem por esta característica (12+4+4+4, as quatro tabelas somadas ' +
      'nos quatro níveis de concessão), quando o livro concede no máximo 6 (3+1+1+1, uma tabela ' +
      'escolhida), e SEM NUNCA ter sido perguntado qual terreno escolher -- confirmado dirigindo ' +
      'escadaDeNivel de verdade e contando por origem (24 \'sempre\', 0 \'dominio\'). Corrigir isto exige ' +
      '(a) decidir o que fazer da rota de domínio morta (mesmo bug de nome "de"/"do" da Causa 1, ou ' +
      'aceitar que a extração continue pela rota "sempre") e (b) modelar a escolha de terreno do jogador ' +
      '-- não é resolvido só pelo conserto da guarda da Causa 1, porque aqui a guarda já deixa passar.' },

  // Causa 3 (1 subclasse: Círculo das Estrelas) -- NOVA nesta correção
  // (CRITICAL 3 da revisão independente). Não é a Causa 1: simular o
  // conserto da Causa 1 (afrouxar a guarda "sempre") contra os dados reais
  // mostra que Estrelas continua devolvendo [] -- três bloqueios próprios,
  // nenhum deles resolvido pelo fix da Causa 1.
  { talento: 'Círculo das Estrelas', teste: 'subclasses-magias',
    tipo: 'app-diverge-do-livro',
    motivo: 'Causa 3 de 3 desta rodada -- Círculo das Estrelas (Druida) NÃO compartilha a Causa 1, ' +
      'apesar do sintoma idêntico (app entrega [] onde o livro concede magia). Confirmado simulando o ' +
      'conserto que a Causa 1 prescreve (ler o código com a guarda de levelup.js:498/:533 mentalmente ' +
      'afrouxada, e testar cada bloqueio contra a descrição real da característica, ' +
      'dados/classes/druida.json): (1) extrairMagiasSemprePreparadasTexto desiste ANTES de extrair nomes ' +
      '-- levelup.js:536, `if (/\\|\\s*\\d+\\s*\\|/.test(descricao) ...) return [];` -- porque a ' +
      'descrição de "Mapa Estelar" contém uma tabela markdown (a tabela "1d6 | Formato do Mapa" que ' +
      'descreve a aparência física do mapa, nada a ver com magia); confirmado rodando o regex de verdade ' +
      'contra a descrição real: bate positivo. (2) mesmo com a guarda de :533 afrouxada, a guarda POR ' +
      'FRASE em levelup.js:545 (`if (!fl.includes(\'sempre\') || !fl.includes(\'preparad\')) continue;`, ' +
      'dentro do laço de frases) continua exigindo "sempre" NA MESMA FRASE que "preparad" -- e a frase ' +
      'de concessão, Classes.md:2493 ("Enquanto estiver segurando o mapa, você tem as magias Orientação ' +
      'e Raio Guia preparadas..."), não tem a palavra "sempre" em lugar nenhum dela (confirmado lendo o ' +
      'texto: "Enquanto" no lugar de "Sempre"). (3) SE alguém também afrouxasse a guarda de :498 ' +
      '(extrairMagiasSemprePreparadasTabela) para tentar cobrir Estrelas pela via de tabela, o resultado ' +
      'seria PIOR: a função passaria a ler a tabela "1d6 | Formato do Mapa" como se os resultados do dado ' +
      '(1-6) fossem níveis de Druida -- para nível 3 pedido, a linha `| 3 | Uma pele de urso-coruja ' +
      'trabalhada com símbolos estelares |` bateria no regex de linha (levelup.js:504) e essa frase ' +
      'viraria um "nome de magia" candidato; hoje esse lixo já é descartado em silêncio por não existir ' +
      'no índice de magias (levelup.js:629-634, `idx.find(x => x.nome === nome)` devolve undefined -> ' +
      'null -> filtrado) -- não é um bug ativo hoje, mas é um AVISO para quem for consertar a Causa 1: um ' +
      'conserto ingênuo que só remova "sempre" da guarda de tabela, sem também impedir a leitura de ' +
      'tabelas de formato/aparência como se fossem tabelas de nível, criaria uma categoria nova de lixo ' +
      'silencioso. Livro: Classes.md:2489-2493, "Mapa Estelar" (NÃO é uma tabela "Magias de/do X" -- é ' +
      'prosa, então obterMagiasDominioNivel nem tenta): "Enquanto estiver segurando o mapa, você tem as ' +
      'magias Orientação e Raio Guia preparadas..." -- concessão CONDICIONADA a segurar o objeto que a ' +
      'própria característica cria no nível 3 (e permite recriar via cerimônia de 1 hora se perdido); ' +
      'tratá-la como efetivamente permanente a partir do nível 3 é uma leitura defensável, mas a condição ' +
      'existe e este motivo não a omite. App entrega [] no nível 3 (único nível de concessão) -- ' +
      'confirmado rodando obterMagiasSemprePreparadasNivel(\'Druida\',\'Círculo das Estrelas\',3) de ' +
      'verdade. Consequência medida: mesma ausência de card estrutural da Causa 1 (magiasSempreNivel ' +
      'nunca alimenta card nenhum na tela de subida de nível, ver levelup-ui.js:1241-1245); a ficha salva ' +
      'de um Druida de Círculo das Estrelas de nível 3+ nunca ganha Orientação nem Raio Guia, em ' +
      'personagem.magias_preparadas nem personagem.magias_conhecidas -- confirmado dirigindo ' +
      'escadaDeNivel de verdade.' },

  // As três causas, vistas pela rota separada dos acessores que a FICHA
  // salva usa (site/js/pages/sheet.js:48-49), não pela subida de nível em
  // si -- por isso 'subclasses-magias-ficha', não 'subclasses-magias' (ver
  // comentário de TESTES_VALIDOS acima).
  { talento: 'Círculo da Lua', teste: 'subclasses-magias-ficha',
    tipo: 'app-diverge-do-livro',
    motivo: 'Mesma Causa 1 (ver a entrada \'subclasses-magias\' acima para a citação completa, por ' +
      'subclasse, do livro e do app) -- vista pela rota que a FICHA usa depois de salva. ' +
      'site/js/pages/sheet.js:48-49 monta a ficha chamando obterTodasMagiasDominio(classe, subclasse, ' +
      'nivel) (levelup.js:797-807) e obterTodasMagiasSemprePreparadas(classe, subclasse, nivel) ' +
      '(levelup.js:640-647) -- as duas, por dentro, chamam os MESMOS obterMagiasDominioNivel/ ' +
      'obterMagiasSemprePreparadasNivel bloqueados pela guarda "sempre" (levelup.js:498, :533) e pelo ' +
      'regex de nome (levelup.js:757) descritos na entrada acima -- confirmado rodando as duas de ' +
      'verdade para as três subclasses no nível 20: as duas devolvem [] (0 itens). Consequência medida: ' +
      'um Druida de Círculo da Lua/Mar ou um Guardião Vigilante das Sombras, em qualquer nível igual ou ' +
      'maior ao de concessão (3, e também 5/7/9 para Lua/Mar, e também 5/9/13/17 para Vigilante), abre a ' +
      'ficha salva e a aba de "Magias" não lista nenhuma dessas magias -- nem sob o rótulo "Domínio" nem ' +
      'sob "Sempre Preparada" (rotuloOrigemMagia, site/js/sheet/magias.js:36-39, chamado nos pontos de ' +
      'render em magias.js:574 e :632, sheet/grimorio.js:127 e sheet/impressao.js:624/687 -- confirmado ' +
      'por grep que estes são os consumidores reais do rótulo).' },
  { talento: 'Círculo das Estrelas', teste: 'subclasses-magias-ficha',
    tipo: 'app-diverge-do-livro',
    motivo: 'Mesma Causa 3 (ver a entrada própria de Círculo das Estrelas em \'subclasses-magias\' ' +
      'acima para a citação completa dos três bloqueios) -- vista pela rota dos acessores da ficha. ' +
      'site/js/pages/sheet.js:48-49 chama obterTodasMagiasDominio (levelup.js:797-807, não se aplica ' +
      'aqui -- Mapa Estelar não é uma tabela "Magias de/do X") e ' +
      'obterTodasMagiasSemprePreparadas(classe, \'Círculo das Estrelas\', nivel) (levelup.js:640-647), ' +
      'que varre 1..nivelAtual chamando obterMagiasSemprePreparadasNivel a cada nível -- bloqueada pelos ' +
      'três mecanismos descritos na entrada \'subclasses-magias\' (tabela de formato do mapa embutida, ' +
      'guarda por frase, e o risco de lixo se a guarda de tabela for afrouxada sem cuidado). Confirmado ' +
      'rodando de verdade: obterTodasMagiasSemprePreparadas(\'Druida\',\'Círculo das Estrelas\',20) não ' +
      'inclui Orientação nem Raio Guia. Consequência: a ficha de um Druida de Círculo das Estrelas de ' +
      'nível 3+ nunca mostra as duas magias na aba "Magias", em nenhum rótulo de origem.' },
  { talento: 'Círculo da Terra', teste: 'subclasses-magias-ficha',
    tipo: 'app-diverge-do-livro',
    motivo: 'Mesma Causa 2 (ver a entrada acima -- CORRIGIDA nesta revisão), vista pela rota dos ' +
      'acessores da ficha. site/js/pages/sheet.js:48 chama obterTodasMagiasDominio(classe, \'Círculo da ' +
      'Terra\', nivel) (levelup.js:797-807) -- que devolve [] (confirmado rodando de verdade, 0 itens no ' +
      'nível 20), porque soma obterMagiasDominioNivel para os níveis fixos [3,5,7,9] (levelup.js:801) e ' +
      'essa função individual já devolve [] para esta subclasse (rota de domínio morta, ver Causa 2 ' +
      'acima). A rota que REALMENTE traz as magias é a OUTRA chamada da mesma linha do arquivo, ' +
      'sheet.js:49, obterTodasMagiasSemprePreparadas(classe, \'Círculo da Terra\', nivel) ' +
      '(levelup.js:640-647), que varre 1..nivelAtual somando obterMagiasSemprePreparadasNivel -- ' +
      'confirmado rodando de verdade: obterTodasMagiasSemprePreparadas(\'Druida\',\'Círculo da ' +
      'Terra\',20) tem 25 itens (24 da característica de terreno, mais \'Falar com Animais\', concedida ' +
      'pela classe base Druida no nível 1, que este acessor também varre). Consequência medida ' +
      '(CORRIGIDA -- a versão anterior apontava para a função e para o rótulo errados): a ficha de um ' +
      'Druida de Círculo da Terra de nível 9+ mostra as 24 magias da característica sob o rótulo "Sempre ' +
      'Preparada" (rotuloOrigemMagia, site/js/sheet/magias.js:36-39 -- `if (magia?.origem === \'sempre\') ' +
      'return \'Sempre Preparada\';`), NÃO sob "Domínio" -- quem for reproduzir e olhar a lista "Magias ' +
      'de Domínio" não vai encontrar as 24; elas estão sob "Sempre Preparadas", quando o livro concede no ' +
      'máximo 6 magias de Domínio (a tabela do terreno escolhido a cada Descanso Longo -- não uma ' +
      'concessão fixa "sempre").' },

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
  { talento: 'Colégio do Conhecimento', teste: 'subclasses-escolha-ausente',
    tipo: 'app-diverge-do-livro',
    motivo: 'Causa 1 de 4 desta rodada -- nenhum controle dedicado existe, em lugar nenhum do app (nem ' +
      'levelup.js, nem a ficha, nem a camada do assistente de subida de nível), para 6 características ' +
      'de construção de subclasse (7 entradas do catálogo, porque Estudioso da Guerra tem duas escolhas ' +
      'de tipos diferentes na mesma característica). O app NÃO tem um ' +
      'mecanismo genérico "esta característica de subclasse exige uma decisão do jogador neste nível" -- ' +
      'levelup.js só reconhece 15 tipos de pendência (grep -n "tipo_pendencia:" site/js/levelup.js, ' +
      'linhas 948-1211), e nenhum deles corresponde a estas 6. Colégio do Conhecimento (Bardo) nv3 ' +
      '"Proficiências Bônus" (Classes.md:766 -- "Você adquire proficiência em três perícias à sua ' +
      'escolha") e nv6 "Descobertas Mágicas" (Classes.md:770 -- "Você aprende duas magias à sua ' +
      'escolha... Você sempre tem as magias escolhidas preparadas"): a ficha mostra um cartão ' +
      'DECORATIVO, só texto ("Escolha 3 perícias adicionais para se tornar proficiente"/"Aprenda 2 ' +
      'magias de qualquer lista... Sempre preparadas", site/js/sheet/habilidades.js:3087-3096 e ' +
      ':3097-3107, atrás das flags ehConhecimentoProficienciasBonus/ehConhecimentoDescobertasMagicas, ' +
      ':2667-2668) -- nenhum <select>, nenhum botão, nada que grave em pericias_proficientes/ ' +
      'magias_preparadas (os dois campos são GENÉRICOS, escritos por outras origens -- talentos, ' +
      'antecedentes -- não por esta característica). Mestre da Batalha (Guerreiro) nv3 "Estudioso da ' +
      'Guerra" (Classes.md:4061 -- ferramenta de artesão E perícia, duas escolhas na mesma ' +
      'característica): `grep -rn "Estudioso da Guerra" site/js/` => 0 ocorrências em todo o app (a ' +
      'string só existe em dados/classes/guerreiro.json) -- nem decorativo, nem funcional; contraste com ' +
      'a característica IRMÃ do mesmo nível, Superioridade em Combate, que TEM mecanismo real ' +
      '(manobras_guerreiro) e passa nas duas direções. Andarilho Feérico (Guardião) nv3 "Glamour ' +
      'Transcendental" (Classes.md:3480 -- perícia entre Atuação/Enganação/Persuasão): `grep -rn "Glamour ' +
      'Transcendental" site/js/` => 0 ocorrências. Campeão (Guerreiro) nv7 "Estilo de Luta Adicional" ' +
      '(Classes.md:3904 -- "Você adquire outro talento de Estilo de Luta à sua escolha"): mesmo padrão ' +
      'decorativo do Bardo (habilidades.js:4013-4022, "Passiva — Talento Adicional", flag ' +
      'ehEstiloLutaAdicional :2688). CORREÇÃO (revisão independente de 2026-08-18, IMPORTANTE 3): o ' +
      'campo real (escolhas_classe.estilo_luta) JÁ É um array -- levelup.js:1571 e :1588 gravam ' +
      '`personagem.escolhas_classe.estilo_luta = [opcoes.estilo_luta]` -- então nenhuma mudança de ' +
      'schema é necessária para guardar um segundo estilo, ao contrário do que uma versão anterior deste ' +
      'motivo afirmava ("nem a estrutura de dado suporta um segundo estilo sem mudança de schema"). O ' +
      'bloqueio real são SETE leitores que assumem um único slot, lendo sempre o índice 0 do array: ' +
      '`site/js/utils.js:212`, `site/js/sheet/combate.js:85`, `site/js/sheet/magias.js:281`, ' +
      '`site/js/sheet/habilidades.js:4693`, `site/js/talentos-effects.js:44`, ' +
      '`site/js/levelup-ui.js:1198` e `site/js/creator/passo-classe.js:25` (todos ' +
      '`estilo_luta?.[0]`/`estilo_luta[0]` ou equivalente, confirmado por grep) -- corrigir a ' +
      'característica exige tratar `estilo_luta` como lista nesses sete pontos, e levelup.js precisaria ' +
      'EMPILHAR em vez de SUBSTITUIR o array em :1571/:1588; mudar o tipo do campo não resolveria nada, ' +
      'porque o campo já é do tipo certo. Círculo da Terra (Druida) nv3 "Magias do Círculo da Terra", a ' +
      'parte da PENDÊNCIA de escolher o terreno (Classes.md:2406 -- "Sempre que completar um Descanso ' +
      'Longo, escolha um tipo de terreno: árido, polar, temperado ou tropical" -- diferente da entrada ' +
      'já registrada em \'subclasses-magias\', que cobre as MAGIAS concedidas, um bug independente já ' +
      'documentado): `grep -rn "terreno" site/js/` não acha nenhum campo de escolha de terreno (só um ' +
      'flag não relacionado, velocista_terreno_dificil, talentos-effects.js:296); hp-descanso.js:900-903 ' +
      'reseta recursos de OUTRA característica da mesma subclasse (Recuperação Natural, nível 6), não a ' +
      'escolha de terreno. Consequência medida, por personagem: um Bardo Colégio do Conhecimento de ' +
      'nível 3 vê um lembrete de texto mas precisa adicionar as 3 perícias por conta própria, sem ' +
      'controle nem validação; um Guerreiro Mestre da Batalha de nível 3 não recebe absolutamente nenhum ' +
      'aviso sobre a ferramenta/perícia de Estudioso da Guerra; um Guardião Andarilho Feérico de nível 3 ' +
      'idem para a perícia; um Guerreiro Campeão de nível 7 vê só um lembrete decorativo para o segundo ' +
      'Estilo de Luta, sem nenhum controle que grave ou exiba além do primeiro slot; um Druida Círculo ' +
      'da Terra de nível 3 nunca é perguntado qual terreno escolher (a tela de subida de nível não tem ' +
      'nenhum campo para isso). ' +
      'Ver também: Cavaleiro Místico / Trapaceiro Arcano nv3 "Conjuração" pertenciam a esta causa e ' +
      'foram reclassificadas como limitacao-observabilidade (entrada \'Cavaleiro Místico\'), porque o ' +
      'assistente de subida de nível implementa a escolha e este motor não o enxerga.' },
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
  { talento: 'Caçador', teste: 'subclasses-escolha-ausente',
    tipo: 'app-diverge-do-livro',
    motivo: 'Causa 2 de 4 desta rodada -- DIFERENTE da Causa 1: aqui o controle EXISTE, dedicado e ' +
      'funcional, só que só na FICHA salva, nunca no assistente de subida de nível -- fixo o dano da ' +
      'lição do brief ("uma escolha que a ficha permite editar à mão tem consequência diferente de uma ' +
      'que não existe em lugar nenhum"). 7 características, uma escolha cada. Trilha do Coração Selvagem ' +
      '(Bárbaro) nv6 "Aspecto dos Selvagens" (Classes.md:267): grava em ' +
      'char.recursos.aspecto_selvagem, site/js/sheet/classes/barbaro.js:245 ("char.recursos.aspecto_selvagem ' +
      '= e.target.value || null"). Patrono Ínfero (Bruxo) nv10 "Resistência Ínfera" (Classes.md:1467): ' +
      'char.recursos.bruxo.subclasses.infero.resistencia_infera_escolha, ' +
      'site/js/sheet/habilidades.js:375. Feitiçaria Dracônica (Feiticeiro) nv6 "Afinidade Elemental" ' +
      '(Classes.md:3080): char.recursos.feiticeiro.subclasses.draconica.afinidade_elemental, ' +
      'habilidades.js:880. Caçador (Guardião) nv3 "Presa do Caçador" (Classes.md:3543): ' +
      'char.recursos.guardiao.subclasses.cacador.presa_escolha, habilidades.js:428; nv7 "Táticas ' +
      'Defensivas" (Classes.md:3551): char.recursos.guardiao.subclasses.cacador.taticas_escolha, ' +
      'habilidades.js:432. Senhor das Feras (Guardião) nv3 "Companheiro Primal" (Classes.md:3573): ' +
      'char.recursos.guardiao.subclasses.feras.companheiro_tipo, habilidades.js:436. Adivinhador (Mago) ' +
      'nv10 "O Terceiro Olho" (Classes.md:5020): char.recursos.mago.subclasses.adivinhador.terceiro_olho_escolha, ' +
      'site/js/sheet/classes/mago.js:100,110 e habilidades.js:2068-2070. RESSALVA (revisão independente ' +
      'de 2026-08-18, IMPORTANTE 2): das sete, CINCO nascem inequivocamente no nível de aquisição -- o ' +
      'livro concede algo "à sua escolha" separado de qualquer cadência de descanso/uso -- Aspecto dos ' +
      'Selvagens (Classes.md:267, "Você recebe uma das seguintes opções à sua escolha"; a frase seguinte, ' +
      '"Sempre que completar um Descanso Longo, você pode alterar sua escolha", é uma TROCA opcional ' +
      'depois da escolha inicial, não o nascimento dela -- mesmo padrão em Presa do Caçador/Táticas ' +
      'Defensivas, Classes.md:3543/:3551), Afinidade Elemental (Classes.md:3080, "Escolha um desses ' +
      'tipos", sem cadência de descanso nenhuma) e Companheiro Primal (Classes.md:3573, escolha inicial ' +
      'que "persiste até ser trocada em um Descanso Longo"). As outras DUAS são diferentes: Resistência ' +
      'Ínfera (Classes.md:1467, "Ao completar um Descanso Curto ou Longo, escolha um tipo de dano...") e ' +
      'O Terceiro Olho (Classes.md:5020, "Como uma Ação Bônus, escolha um dos seguintes benefícios...") ' +
      'não têm frase de escolha inicial separada da cadência de descanso/uso -- o livro nasce a PRIMEIRA ' +
      'escolha só no primeiro descanso/uso depois da aquisição, não no nível em si. Para essas duas, "o ' +
      'assistente de subida de nível não pergunta NO NÍVEL" não é, por si só, uma violação de regra -- o ' +
      'livro não manda perguntar nesse momento; um controle na ficha (onde as duas moram hoje) é ' +
      'exatamente o lugar certo para uma escolha de cadência de descanso/uso, não uma lacuna. A causa ' +
      'raiz abaixo (char.recursos fora da rota subirDeNivel) continua real e documentada para as sete -- ' +
      'nenhuma delas é alcançada pelo assistente -- mas só CINCO representam uma escolha de NÍVEL que o ' +
      'assistente deveria perguntar e não pergunta; para Resistência Ínfera/O Terceiro Olho, a ausência ' +
      'na tela de subida de nível é esperada, e o que sobra de real é só "o controle vive só na ficha" ' +
      '(o que já é, por si, uma limitação: um jogador que nunca abre a ficha fora do fluxo de nível não ' +
      'encontra o controle nem quando o descanso chega). As sete têm a MESMA causa raiz técnica, ' +
      'confirmada por grep: `char.recursos` nunca é criado por store.criarPersonagemVazio() ' +
      '(site/js/store.js:236-317, sem a chave `recursos`) nem por nenhuma linha de site/js/levelup.js ' +
      '(`grep -n "personagem\\.recursos" site/js/levelup.js` => 0 ocorrências) -- só o handler da FICHA ' +
      '(cada um dos arquivos/linhas acima) cria `char.recursos = {}` sob demanda, quando o jogador já ' +
      'está interagindo com a ficha salva, fora do fluxo de subida de nível. Consequência medida, por ' +
      'personagem: um Bárbaro Trilha do Coração Selvagem de nível 6, um Bruxo Patrono Ínfero de nível 10, ' +
      'um Feiticeiro Feitiçaria Dracônica de nível 6, um Guardião Caçador de nível 3 e 7, um Guardião ' +
      'Senhor das Feras de nível 3 e um Mago Adivinhador de nível 10 terminam a tela de subida de nível ' +
      'sem NENHUM aviso de que uma escolha da subclasse ficou pendente -- o assistente deixa concluir ' +
      'normalmente. O jogador só encontra o controle real se souber abrir a ficha salva depois e procurar ' +
      'o menu de Habilidades da característica certa; nada na tela de subida de nível aponta para lá.' },
  { talento: 'Assassino', teste: 'subclasses-escolha-ausente',
    tipo: 'app-diverge-do-livro',
    motivo: 'Causa 4 de 4 desta rodada -- diferente das causas acima: aqui não há ESCOLHA nenhuma do ' +
      'jogador -- o livro concede automaticamente ("Você adquire proficiência em X", sem "à sua escolha") ' +
      '-- e mesmo assim nenhum código em site/js/ jamais aplica a concessão, em NENHUM caminho (nem ' +
      'subirDeNivel, nem a ficha, nem o assistente de criação). 5 características (a 5ª, Treinamento ' +
      'Marcial, acrescentada na correção pós-revisão de 2026-08-18, CRÍTICO 1 -- ver abaixo), medidas ' +
      'pelo converso (Grupo 6) sobre CONCESSOES_AUTOMATICAS_SUBCLASSE -- o Grupo 5 ("concessão automática ' +
      'não vira pendência") já confirma que o app corretamente NÃO pergunta nada aqui (comportamento ' +
      'certo, o livro não manda perguntar); o problema é que ele também não CONCEDE. Combatente da ' +
      'Misericórdia (Monge) nv3 "Implementos de Misericórdia" (Classes.md:5330 -- "proficiência nas ' +
      'perícias Intuição e Medicina e proficiência com o Kit de Herbalismo"): `grep -rn "Implementos de ' +
      'Misericórdia" site/js/` => 0 ocorrências. Assassino (Ladino) nv3 "Ferramentas de Assassino" ' +
      '(Classes.md:4389 -- ' +
      '"um Kit de Disfarce e um Kit de Veneno, e tem proficiência com eles"): a ficha mostra um cartão ' +
      'DECORATIVO (cabeçalho "Passiva — Proficiências", corpo "Proficiência com Kit de Disfarce e Kit de ' +
      'Veneno.", habilidades.js:4170-4178, flag ehFerramentasAssassino :2705) -- CORREÇÃO (revisão ' +
      'independente de 2026-08-18, MENOR 5): a versão anterior citava esse texto como uma única frase ' +
      'entre aspas ("Passiva — Proficiências: Kit de Disfarce e Kit de Veneno") -- paráfrase, não a ' +
      'citação literal; o cartão real tem os dois textos em `<div>`s separados, como citado acima -- ' +
      'mesmo padrão dos três decorativos da Causa 1, texto sem ' +
      'nenhuma gravação em proficiencias_ferramentas. Vigilante das Sombras (Guardião) nv7 "Mente de ' +
      'Ferro" (Classes.md:3734 -- "proficiência em salvaguardas de Sabedoria"): `grep -rn "Mente de ' +
      'Ferro" site/js/` => 0 ocorrências. Ilusionista (Mago) nv3 "Ilusões Aprimoradas" (Classes.md:5074 -- ' +
      '"Você também conhece o truque Ilusão Menor"): `grep -rn "Ilusões Aprimoradas" site/js/` => 0 ' +
      'ocorrências; as duas únicas ocorrências de "Ilusão Menor" em site/js/ (creator/comum.js:79, ' +
      'sheet/migracoes.js:202) são um truque concedido por um TRAÇO DE ESPÉCIE não relacionado (Gnomo do ' +
      'Bosque) -- confirmado lendo o código ao redor: nenhuma delas checa `subclasse === \'Ilusionista\'`. ' +
      'Colégio da Bravura (Bardo) nv3 "Treinamento Marcial" (Classes.md:704 -- "Você adquire proficiência ' +
      'com armas Marciais, armaduras Médias e treinamento com Escudos"): CORREÇÃO (revisão independente ' +
      'de 2026-08-18, CRÍTICO 1) -- até esta correção esta entrada não existia na Causa 4/lista de causas ' +
      'nenhuma; o converso ficava `t.skip` porque `campoEsperado` apontava para ' +
      '`proficiencias_armaduras`, tratado (por engano) como raiz fora do alcance da rota subirDeNivel. O ' +
      'campo real onde esta concessão apareceria é `proficiencias_extra` (criado por ' +
      '`store.criarPersonagemVazio()`, site/js/store.js:255, plenamente alcançável por `subirDeNivel`); ' +
      '`grep -rn "Treinamento Marcial" site/js/` => 0 ocorrências, e o único ponto que escreve em ' +
      '`proficiencias_extra` (site/js/creator/wizard.js:453-460) cobre só Clérigo Protetor/Druida Protetor ' +
      '-- nenhuma linha soma "Armas Marciais"/"Armadura Média"/"Escudo" para um Bardo Colégio da Bravura. ' +
      'Consequência medida, por personagem: um Monge Combatente da Misericórdia de nível 3 nunca ganha ' +
      'Intuição/Medicina nem o Kit de Herbalismo, em campo nenhum da ficha; um Ladino Assassino de nível ' +
      '3 vê um lembrete de texto que descreve a proficiência, mas proficiencias_ferramentas nunca é ' +
      'escrito; um Guardião Vigilante das Sombras de nível 7 nunca ganha salvaguardas_proficientes para ' +
      'Sabedoria; um Mago Ilusionista de nível 3 nunca ganha Ilusão Menor em magias_conhecidas; um Bardo ' +
      'Colégio da Bravura de nível 3 nunca ganha proficiência com armas Marciais, armadura Média nem ' +
      'Escudo em `proficiencias_extra` -- fica preso a armadura Leve/armas Simples (CLASSES_INFO[\'Bardo\'], ' +
      'site/js/dados-classes.js:21-22) pelo resto da progressão. Nos cinco casos o jogador não fez nada ' +
      'errado nem esqueceu nenhuma escolha -- é uma regra automática do livro que o app simplesmente ' +
      'nunca aplica.' },

  // ---------- Domínio Subclasses/Recursos (2026-08-18) ----------
  //
  // subclasses-recursos.test.mjs (Grupos 2-5, Task 6 do plano
  // 2026-08-18-regras-subclasses-4-recursos) confronta detectarUsosMaximos/
  // detectarRecarga/ehHabilidadeAtiva (as MESMAS heurísticas do bloco
  // Classes/Passivas acima) e a restauração real de hp-descanso.js contra as
  // 27 características de subclasse citáveis (base custo-declarado/
  // ausência-de-custo, não composta). Dez divergências: DUAS são o mesmo
  // código das causas abertas de Classes/Passivas (call sites novos na
  // entrada 'classes-passivas-descanso-curto-janela', acima -- Mapa Estelar
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
  {
    talento: 'Feitiçaria Selvagem', teste: 'subclasses-recursos-usos-sem-consequencia',
    tipo: 'limitacao-observabilidade',
    motivo: 'detectarUsosMaximos (site/js/sheet/habilidades.js:2390) só reconhece contagem FIXA em texto ' +
      '("X vezes"/"X vez") -- para 6 características citáveis de subclasse o livro expressa o limite de ' +
      'uso de uma forma que a heurística não reconhece (implícito num "não pode usar novamente até ' +
      'Descanso X", sem nunca dizer "uma vez" literalmente, OU um pool descrito por adjetivo numeral, ' +
      '"quatro d12s"), e detectarUsosMaximos devolve `null` contra um número real do catálogo. Isso é uma ' +
      'expectativa LEGÍTIMA (o livro de fato declara um limite citável) -- mas medida contra ' +
      'site/js/sheet/habilidades.js inteiro (grep pelo CAMPO dedicado de cada uma, não pelo nome da ' +
      'característica), nenhuma das 6 tem consequência observável pelo jogador, por DOIS mecanismos ' +
      'diferentes que levam à mesma tela: ' +
      '(1) RAMO DEDICADO, que nunca lê usosMax -- Campeão dos Deuses (Trilha do Fanático nv3, Classes.md:' +
      '299,301, "reserva de quatro d12s"; catálogo usos=4): ramo ehCampeaoDeuses ' +
      '(habilidades.js:2801-2814) calcula o teto a partir do NÍVEL do personagem (`dadosMax = nivel >= 17 ' +
      '? 7 : ... : 4`), nunca de detectarUsosMaximos -- mesmo mecanismo dos 11 já anotados com ' +
      '`ramoDedicado` no catálogo (Grupo 2 de subclasses-recursos.test.mjs), só que esta 12ª ocorrência ' +
      'não tinha sido identificada antes desta tarefa. Vingança Calcinante (Patrono Celestial nv14, ' +
      'Classes.md:1385; catálogo usos=1): ramo ehCelestialVinganca (habilidades.js:3314+) usa o campo ' +
      'booleano `vinganca_calcinante_usada`, nunca usosMax. Marés do Caos (Feitiçaria Selvagem nv3, ' +
      'Classes.md:3164; catálogo usos=1): ramo ehMaresCaos (habilidades.js:3820+) usa o campo booleano ' +
      '`mares_caos_disponivel`. Surto Controlado (Feitiçaria Selvagem nv18, Classes.md:3216; catálogo ' +
      'usos=1): ramo ehSurtoControlado (habilidades.js:3834+) usa o campo booleano ' +
      '`surto_controlado_usado`. O Terceiro Olho (Adivinhador nv10, Classes.md:5020; catálogo usos=1): ' +
      'ramo ehAdivinhadorTerceiroOlho (habilidades.js:4638-4654, condicionado a `estadoMagoSub.' +
      'terceiroOlhoAtivo`, verdadeiro para todo personagem que já tem a característica, nível 10+) usa o ' +
      'campo `terceiroOlhoUsado`. (2) SEM ramo dedicado, mas mesmo assim sem consequência -- Ladrão de ' +
      'Magias (Trapaceiro Arcano nv17, Classes.md:4518; catálogo usos=1): nenhum campo dedicado em ' +
      'site/js/ inteiro (grep confirmado), cai no caminho GENÉRICO de restaurarHabilidades/renderFeatureItem ' +
      '-- mas `temMultiplosUsos` (habilidades.js:2621, `usosMax && usosMax > 1 && recarga`) só é truthy ' +
      'quando usosMax>1; como o valor REAL do catálogo é 1 (não >1), mesmo que detectarUsosMaximos ' +
      'tivesse acertado, o resultado renderizado seria o MESMO ramo (`!usosHtmlBody && ativa && recarga`, ' +
      'habilidades.js:4750, o toggle "✓ Disponível"/"✗ Usado" sem contador) que já aparece hoje com o ' +
      'valor errado (`null`). Em nenhum dos 6 casos a correção da heurística mudaria um pixel da tela que ' +
      'o jogador vê -- por isso `limitacao-observabilidade`, não `app-diverge-do-livro`: esta rota de ' +
      'teste (o valor BRUTO de detectarUsosMaximos) não é o mecanismo que a ficha realmente usa para ' +
      'nenhuma das 6.' },
  {
    talento: 'Juramento dos Anciões', teste: 'subclasses-recursos-ativa-curto-circuito-automatico',
    tipo: 'app-diverge-do-livro',
    motivo: 'Sentinela Imortal (Juramento dos Anciões, Paladino, nível 15) -- causa NOVA, distinta das 7 ' +
      'causas abertas de Classes/Passivas por MECANISMO, não só por sintoma. O texto (Classes.md:5889, ' +
      '"Ao ser reduzido a 0 Pontos de Vida e não morto imediatamente, você fica com 1 Ponto de Vida e ' +
      'recupera... Após usar essa característica, você não pode utilizá-la novamente até completar um ' +
      'Descanso Longo.") não tem NENHUM verbo de decisão do jogador -- é uma salvaguarda automática contra ' +
      'a morte, não algo que o jogador escolhe ativar (mesmo raciocínio já aplicado a Sentinela Imortal no ' +
      'catálogo, testes/regras/catalogo/subclasses.mjs, `ativaBase: \'ausencia-de-custo\'`). Ainda assim, ' +
      'ehHabilidadeAtiva (site/js/utils.js:526) devolve `true`, e a causa NÃO é a lista de frases-gatilho ' +
      '(utils.js:536, "como uma ação"/"você pode usar"/etc. -- nenhuma casa aqui) nem uma má-detecção de ' +
      'detectarRecarga (que acerta \'longo\' de verdade, é a recarga real da característica): é o ' +
      'curto-circuito `if (recarga) return true` (utils.js:535), que trata QUALQUER recarga CONFIRMADA ' +
      'como prova de decisão do jogador, sem checar se existe algum verbo de escolha no texto. ' +
      'CORREÇÃO (revisão independente de 2026-08-18): `utils.js:535` NÃO é código exclusivo desta causa -- ' +
      '\'classes-passivas-recarga-troca-escolha\' (acima) já nomeia a MESMA linha (lá citada como ' +
      '"utils.js:508, if (recarga) return true"), e é por ELA, não pela lista de frases de `utils.js:536`, ' +
      'que as 6 características daquela entrada (Maestria em Arma de Bárbaro/Guerreiro/Guardião/Paladino/ ' +
      'Ladino, Maestria de Magias do Mago) também caem em "ativa": confirmado rodando a lista de frases ' +
      'contra as 6 descrições reais -- nenhuma das 6 strings de `utils.js:536` casa em nenhuma delas; as 6 ' +
      'só chegam a `true` pelo curto-circuito. O que DISTINGUE as duas causas não é o código (é o mesmo), ' +
      'é o TIPO de erro: em \'recarga-troca-escolha\', `detectarRecarga` erra a DETECÇÃO (lê uma cláusula ' +
      'de troca de escolha como recarga de uso limitado -- entrada errada no curto-circuito); aqui a ' +
      'detecção está CERTA (a recarga é real) e o curto-circuito erra a CONCLUSÃO (assume, sem checar ' +
      'verbo de decisão, que toda recarga confirmada implica ativação). Consequência de ' +
      '\'recarga-troca-escolha\' também sobrevive a um conserto do curto-circuito de um jeito que este ' +
      'caso não sobrevive: lá, mesmo sem o curto-circuito, o `recargaBadge` continua rotulando errado (a ' +
      'causa raiz é a detecção, não só a conclusão); aqui, corrigir o curto-circuito (checar verbo de ' +
      'decisão mesmo com `recarga` verdadeiro) resolveria as duas ao mesmo tempo -- Sentinela Imortal E as ' +
      '6 de \'recarga-troca-escolha\'. AVISO para quem for consertar: um patch em `utils.js:535` precisa ' +
      'reconferir a entrada \'classes-passivas-recarga-troca-escolha\' também, não só esta. Mantida como ' +
      'chave própria (não call site daquela) porque a ALEGAÇÃO PRIMÁRIA de cada uma é diferente -- lá é ' +
      'sobre `detectarRecarga` ler a cláusula errada, aqui é sobre a ausência de checagem de verbo -- mas o ' +
      'texto acima existe para que ninguém trate as duas como independentes na hora de corrigir. ' +
      'Consequência medida (site/js/sheet/caracteristicas.js:64-65, renderSecaoSubclasse): Sentinela ' +
      'Imortal aparece em "Habilidades Ativas" no card "Subclasse — Juramento dos Anciões" da ficha; o ' +
      'livro (gatilho inteiramente automático) a colocaria em "Habilidades Passivas". Mesma direção de ' +
      'erro (app diz Ativa, livro diz Passiva) já registrada para 8 características de classe base em ' +
      '\'classes-passivas-ativa-no-turno\' -- mesmo SINTOMA de exibição, mas aquela causa é sobre a lista ' +
      'de frases (`utils.js:536`), não sobre o curto-circuito de `:535`, por isso causa própria também em ' +
      'relação a ela.' },
  {
    talento: 'Juramento da Glória', teste: 'subclasses-recursos-paladino-guarda-juramento',
    tipo: 'app-diverge-do-livro',
    motivo: 'Defesa Gloriosa (Juramento da Glória, Paladino, nível 15) -- bug de produto confirmado por ' +
      'leitura direta de hp-descanso.js, achado desta rodada e o melhor resultado dela. O bloco de ' +
      'restauração de Descanso Longo do Paladino (site/js/sheet/hp-descanso.js:965-994) guarda a ' +
      'restauração de subclasse por `if (char.subclasse === \'Juramento de X\')` -- mas o nome real de ' +
      'TODAS as 4 trilhas usa "da"/"dos", nunca "de": "Juramento da Devoção"/"Juramento da Glória"/ ' +
      '"Juramento da Vingança"/"Juramento dos Anciões" (confirmado em dados/classes/paladino.json: ' +
      '443,473,508,538, e é esse valor de dados/, não um texto do app, que `char.subclasse` recebe -- ' +
      'levelup.js grava a característica pelo nome exato do JSON). Especificamente para Defesa Gloriosa: ' +
      'hp-descanso.js:974 testa `char.subclasse === \'Juramento de Glória\'` (preposição errada, "de" em ' +
      'vez de "da") -- essa comparação NUNCA é verdadeira para um Paladino real, então o `if` inteiro ' +
      '(:974-977) é código morto. `defesa_gloriosa_usos_gastos` -- lido e RENDERIZADO em ' +
      'site/js/sheet/habilidades.js:4282-4298 (botão "Usar Defesa Gloriosa", contador "disponível/máximo"), ' +
      'INCREMENTADO ao clicar em site/js/sheet/habilidades.js:1420-1429 (`case \'gloria_defesa_gloriosa\'`, ' +
      '`gastos + 1`) -- nunca é zerado por Descanso Longo -- o único ' +
      'reset que o livro concede para este recurso (Classes.md:5793, "...restaura todos os usos gastos ao ' +
      'completar um Descanso Longo") não acontece nunca. Consequência como o jogador encontra: um Paladino ' +
      'Juramento da Glória de nível 15+ usa Defesa Gloriosa (mod. Carisma vezes por dia, mínimo 1), ' +
      'descansa longamente, reabre a ficha -- e o contador na seção "Subclasse — Juramento da Glória" ' +
      'continua mostrando os usos como gastos (ex. "0/2" em vez de voltar a "2/2"); o botão "Usar Defesa ' +
      'Gloriosa" permanece desabilitado até o jogador editar o campo manualmente (fora do fluxo normal de ' +
      'descanso) ou reiniciar a ficha. CONTRASTE: o guard irmão da mesma classe, "Juramento dos Anciões" ' +
      '(hp-descanso.js:983, "dos" -- grafia correta, forma diferente das outras três de propósito, o livro ' +
      'não usa preposição "de"/"da" para esta trilha), FUNCIONA -- Sentinela Imortal e Campeão Ancestral ' +
      'restauram normalmente, confirmando que o mecanismo de guarda por nome funciona quando o nome bate. ' +
      'O MESMO typo ("Juramento de X" por "Juramento da X") aparece em mais 3 lugares de hp-descanso.js ' +
      '-- :582 (Devoção, Descanso Curto, campos arma_sagrada_ativa/resplendor_sagrado_ativo), :979 ' +
      '(Vingança, Descanso Longo, anjo_vingador_usado), :988 (Devoção, Descanso Longo, ' +
      'resplendor_sagrado_usado/arma_sagrada_ativa/resplendor_sagrado_ativo) -- afetando Resplendor ' +
      'Sagrado (Devoção nv20), Lenda Viva (Glória nv20) e Anjo Vingador (Vingança nv20) do mesmo jeito ' +
      '(3 das 4 trilhas do Paladino nunca restauram seus recursos de subclasse no descanso). Essas 3 não ' +
      'têm chave própria aqui porque são `composta: true` no catálogo (não sustentam `assert.equal` ' +
      'sozinhas -- mesma regra de citabilidade dos Grupos 2/3/5) -- a divergência delas aparece registrada ' +
      'na mensagem do `t.skip` correspondente em subclasses-recursos.test.mjs, não escondida, só não ' +
      'formalizada como lacuna própria.' },
];

// Busca a lacuna registrada para um par (talento, teste), se houver.
export function lacuna(talento, teste) {
  return LACUNAS.find((l) => l.talento === talento && l.teste === teste) || null;
}
