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
  // das oito funções de gatilho de levelup.js dispara para uma célula que o
  // livro marca como exigindo escolha, sem a restrição `apenas` que escondia
  // o caso do Ladino no laço original de GATILHOS.
  'classes-gatilho-ausente',
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
  // Duas causas-raiz, não três lacunas independentes -- ver
  // task-4-report.md, task-5-report.md e task-10-report.md
  // (.superpowers/sdd/2026-08-07-regras-classes-niveis/) para a
  // investigação completa. As entradas abaixo cobrem os 3 testes
  // vermelhos do motor estrutural (classes.test.mjs): a mesma entrada de
  // Clérigo é referenciada por DOIS pontos de comLacuna() -- o teste que
  // lê a célula bruta de dados/classes/clerigo.json ("tabela: Clérigo
  // nível 3") e o que passa pela função de produção que lê a mesma
  // célula ("obterCaracteristicasNivel × livro: Clérigo") -- porque é o
  // mesmo dado ruim visto por duas rotas, não um segundo defeito.

  // Causa 1 -- Clérigo nível 3: a célula da TABELA diverge da forma que
  // dados/classes/clerigo.json grava, sem consequência funcional (a
  // string só é exibida, nunca comparada).
  { talento: 'Clérigo', teste: 'classes-tabela',
    tipo: 'app-diverge-do-livro',
    motivo: 'A célula da tabela do livro (Classes.md:1515, coluna "Características" ' +
      'da linha do nível 3 da tabela "Características de Clérigo") traz "Subclasse ' +
      'Clérigo", sem "de". dados/classes/clerigo.json grava "Subclasse de Clérigo" ' +
      '(com "de") na mesma célula (tabela_caracteristicas[nível 3][\'Características\']) ' +
      'e no campo estruturado irmão caracteristicas[].nome do mesmo nível -- essa forma ' +
      'não foi inventada pelo app: é o texto exato do heading de prosa que abre a ' +
      'descrição da característica, Classes.md:1584 ("### Nível 3: Subclasse de ' +
      'Clérigo"), só que não é a forma da CÉLULA DA TABELA. É isolado ao Clérigo: ' +
      'Bárbaro e Ladino têm o mesmo padrão textual "Subclasse X" sem "de" na tabela do ' +
      'nível 3, e dados/ reproduz sem "de" corretamente nos dois. Observado por duas ' +
      'rotas de código: leitura direta da célula (dados/classes/clerigo.json) e ' +
      'obterCaracteristicasNivel (site/js/levelup.js:381-394, que lê ' +
      'row[\'Características de Classe\'] ?? row[\'Características\'] e faz ' +
      'split(\',\')) -- as duas leem o mesmo dado ruim, não são dois defeitos. ' +
      'Consequência real, medida no código (não suposta): nenhuma. O único consumidor ' +
      'de obterCaracteristicasNivel (site/js/levelup-flow.js:58 -> ' +
      'levelup-cards.js:51) só renderiza a lista recebida como ' +
      '`caracteristicas.map(c => `<li>${c}</li>`)` -- nunca compara nenhum elemento ' +
      'contra um literal. exigeSubclasse (site/js/levelup.js:421-439), que decide se a ' +
      'escolha de subclasse é obrigatória, usa uma tabela fixa {\'Clérigo\': 3, ...} ' +
      'indexada por nome de classe e nível, sem ler caracteristicas/ ' +
      'tabela_caracteristicas -- a divergência de texto não afeta essa decisão. O ' +
      'campo estruturado irmão (classeData.caracteristicas[].nome, consumido por ' +
      'site/js/sheet/caracteristicas.js:11,61, site/js/sheet/impressao.js:461, ' +
      'site/js/sheet/hp-descanso.js:338,346 e site/js/creator/passo-classe.js:157) só ' +
      'filtra por nivel e exibe nome/descricao -- nenhum desses locais compara nome ' +
      'contra um literal como \'Subclasse Clérigo\'; a busca por comparação literal de ' +
      'nome de característica em todo site/js/ não achou nenhuma. Efeito real, único: ' +
      'o card de level-up e a ficha/impressão do Clérigo no nível 3 exibem "Subclasse ' +
      'de Clérigo" em vez de "Subclasse Clérigo" -- diferença de exibição de uma ' +
      'palavra, sem efeito em nenhuma decisão do app.' },

  // Causa 2 -- Ladino, proficiência com Armas Marciais incompleta: falta
  // "Leve" ao lado de "Acuidade", com consequência funcional real e
  // medida (a única das duas causas com efeito no bônus de ataque).
  { talento: 'Ladino', teste: 'classes-info',
    tipo: 'app-diverge-do-livro',
    motivo: 'O livro (Classes.md:4152, tabela "Proficiências com Armas" do Ladino) ' +
      'concede proficiência com "Armas Simples e Armas Marciais que tem a propriedade ' +
      'Acuidade ou Leve" -- as duas propriedades, ligadas por "ou". ' +
      'site/js/dados-classes.js:105 codifica armas: [\'Simples\', \'Marcial ' +
      '(Acuidade)\'] -- só Acuidade; falta Leve. O campo TEM consumidores ativos que ' +
      'resolvem a string contra a propriedade de uma arma específica, não é só dado de ' +
      'referência exibido: site/js/creator/passo-equipamento.js:19-43 ' +
      '(temProficienciaArma) e site/js/sheet/condicoes.js:17-30 (sheetTemProfArma) ' +
      'fazem, ambos, `info.armas.some(a => a.includes(\'Leve\'))` -- falso para o ' +
      'Ladino, porque nenhuma entrada de [\'Simples\', \'Marcial (Acuidade)\'] contém a ' +
      'substring "Leve". Consequência real, medida com uma arma de verdade do jogo: a ' +
      'Besta de Mão (dados/equipamento/armas.json, "Marcial à Distância", propriedade ' +
      'leve, sem acuidade) é a ÚNICA arma Marcial do catálogo com Leve e sem Acuidade ' +
      '(Cimitarra e Espada Curta têm as duas propriedades; as demais armas Leves são ' +
      'Simples) -- um Ladino equipado com Besta de Mão é rotulado "Sem Prof" tanto na ' +
      'ficha (site/js/sheet/inventario.js:123,1067) quanto no assistente de criação ' +
      '(site/js/creator/passo-equipamento.js:535-536,715-729), e o bônus de ataque ' +
      'exibido na ficha (site/js/sheet/inventario.js:163-164: `bonusAtq = modAtq + ' +
      '(temProf ? prof : 0)`) omite o bônus de proficiência inteiro (+2 a +6 conforme o ' +
      'nível), apesar de Classes.md:4152 conceder essa proficiência explicitamente. O ' +
      'Monge, com a mesma FORMA de restrição mas exigindo só "Leve" no livro ' +
      '(Classes.md:5107), bate: dados-classes.js:128 codifica armas: [\'Simples\', ' +
      '\'Marcial (Leve)\'] exatamente a única propriedade que o livro pede -- a ' +
      'divergência é de CONTEÚDO, isolada ao Ladino, não um erro sistemático do ' +
      'formato "categoria (propriedade)".' },

  // ---------- Incremento de 2026-08-07: bug achado à mão por um humano ----------
  //
  // Ladino nível 6 "Especialista" (Classes.md:4188, célula da tabela
  // "Características de Ladino") nunca vira pendência de subida de nível --
  // o app esqueceu a característica INTEIRA, não implementou errado. Achado
  // fora desta suíte, usando o app: um Ladino subindo do nível 1 ao 20 termina
  // com pericias_expertise vazio. A suíte não pegou sozinha porque o motor de
  // gatilhos (classes.test.mjs, laço de GATILHOS) testa cada função na forma
  // "ela dispara só onde deveria?", e para exigeEspecializacaoGuardiao(classe,
  // nivel) o `apenas: ['Guardião']` do laço faz o ESPERADO virar `false` para
  // o Ladino -- a função também devolve `false`, os dois lados concordam, e o
  // teste passa verde sobre uma característica que não tem NENHUM mecanismo.
  // O 'classes-gatilho-ausente' (teste converso, mesmo arquivo) fecha esse
  // buraco: para toda célula em que o livro imprime um rótulo de escolha
  // (via os mesmos ROTULOS_GATILHO, sem `apenas`), exige que ALGUMA das oito
  // funções dispare -- e é o único caso que falha.
  { talento: 'Ladino', teste: 'classes-gatilho-ausente',
    tipo: 'app-diverge-do-livro',
    motivo: 'O livro concede Especialização (dobra o bônus de proficiência) em 2 ' +
      'perícias no nível 1 de Ladino (Classes.md:4183, célula da tabela ' +
      '"Características de Ladino"; prosa em Classes.md:4212-4214, "### Nível 1: ' +
      'Especialista") e em MAIS 2 perícias no nível 6 (Classes.md:4188, mesma ' +
      'tabela, célula "Especialista"; prosa em Classes.md:4216, "No nível 6 de ' +
      'Ladino, você obtém Especialização em mais duas perícias nas quais já seja ' +
      'proficiente à sua escolha"). O app implementa só a metade do nível 1: ' +
      'CLASSES_ESCOLHAS.Ladino.especialista (site/js/creator/comum.js:354-360) é ' +
      'renderizado no assistente de criação (site/js/creator/passo-classe.js:93-114) ' +
      'e consolidado em personagem.pericias_expertise por ' +
      'site/js/creator/wizard.js:466-473 -- essa parte funciona. O app NÃO implementa ' +
      'o nível 6 em lugar nenhum: site/js/levelup.js tem exigeEspecializacaoBardo ' +
      '(:444-446, Bardo níveis 2 e 9) e exigeEspecializacaoGuardiao (:451-453, ' +
      'Guardião nível 9), mas nenhuma exigeEspecializacaoLadino nem qualquer outro ' +
      'ramo que cite "Ladino" perto de Especialização/Especialista -- grep por ' +
      '"Ladino" em levelup.js, levelup-validations.js, levelup-ui.js, ' +
      'levelup-cards.js e levelup-flow.js não encontrou nenhuma ocorrência ligada a ' +
      'essa característica (as únicas 4 ocorrências de "Ladino" nesses arquivos são ' +
      'a lista de classes válidas, o ramo de Trapaceiro Arcano, a tabela de ASI e a ' +
      'tabela de nível de subclasse -- levelup.js:67,94,409,432). ' +
      'Confirmado dinamicamente chamando subirDeNivel(personagem, {}) direto (sem ' +
      'passar nenhuma opção de escolha), COM PRECONDIÇÃO: personagem.nivel = 5 e ' +
      'personagem.xp = levelup.XP_POR_NIVEL[6] (14000) -- sem XP suficiente a chamada ' +
      'devolve {sucesso:false, erro:"XP insuficiente..."} antes mesmo de chegar perto ' +
      'da característica, o que não reproduz nada sobre Especialização; quem for ' +
      'reproduzir precisa dar XP ao personagem primeiro. Com a precondição, do nível 5 ' +
      'para o 6 de um Ladino, o app devolve sucesso:true de primeira -- "caracteristicas":["Especialista"] aparece ' +
      'no resultado (a lista que o card de level-up exibe), mas nenhum campo de ' +
      'pendência (não pede resultado.pendente/tipo_pendencia, como pede para ' +
      'expertise_bardo_aplicada/expertise_guardiao_aplicada em Bardo/Guardião) -- e ' +
      'personagem.pericias_expertise continua [] depois da subida. Um Ladino subindo ' +
      'de 1 a 20 (escadaDeNivel, harness.mjs) termina com pericias_expertise contendo ' +
      'só as 2 perícias do nível 1 -- nunca ganha as 2 do nível 6. Consequência funcional, ' +
      'medida no código que lê o campo (não suposta): calcBonusPericia ' +
      '(site/js/utils.js:293-308) soma bonusProficiencia(nivel) DUAS VEZES quando a ' +
      'perícia está em pericias_expertise (uma pela proficiência, outra pela ' +
      'Especialização) -- para as 2 perícias que o Ladino deveria escolher no nível ' +
      '6 e nunca chega a escolher, o bônus exibido na ficha fica subestimado em ' +
      'exatamente bonusProficiencia(nivel) (+3 a partir do nível 5, subindo até +6 no ' +
      'nível 17+, conforme EVOLUCAO_PERSONAGEM). O efeito é menor do que "a ' +
      'característica não existe": as escolhas do nível 1 continuam corretas, e o ' +
      'campo pericias_expertise em si funciona (é lido por levelup-cards.js:217, ' +
      '244, 311, 352; levelup-ui.js:595, 608, 620, 633; site/js/sheet/edicao.js:132, ' +
      '252; site/js/sheet/ficha.js:727; site/js/sheet/impressao.js:347; ' +
      'site/js/sheet/pdf.js:91 -- todos consomem o campo normalmente, sem ramo ' +
      'quebrado) -- só nunca recebe as 2 entradas que o nível 6 do Ladino deveria ' +
      'adicionar. Nenhuma perda de proficiência simples (diferente do achado do ' +
      'Ladino em \'classes-info\', acima): as 2 perícias continuam com bônus de ' +
      'proficiência normal, só sem o dobro que a Especialização concederia.' },
];

// Busca a lacuna registrada para um par (talento, teste), se houver.
export function lacuna(talento, teste) {
  return LACUNAS.find((l) => l.talento === talento && l.teste === teste) || null;
}
