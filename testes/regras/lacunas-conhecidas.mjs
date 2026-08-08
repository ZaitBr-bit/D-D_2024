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
      'sem estado persistido nem botão clicável.' },
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
      'escopo confirmado desta tarefa.' },
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
];

// Busca a lacuna registrada para um par (talento, teste), se houver.
export function lacuna(talento, teste) {
  return LACUNAS.find((l) => l.talento === talento && l.teste === teste) || null;
}
