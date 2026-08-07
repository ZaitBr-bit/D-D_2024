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
];

// Busca a lacuna registrada para um par (talento, teste), se houver.
export function lacuna(talento, teste) {
  return LACUNAS.find((l) => l.talento === talento && l.teste === teste) || null;
}
