// ============================================================
// Acessores de multiclasse.
//
// Funções PURAS: recebem o personagem por parâmetro e nunca leem
// `char` nem `personagem` como global -- o criador usa um nome e a
// ficha usa o outro (docs/ARQUITETURA.md, "Estado compartilhado").
//
// char.classes é a fonte da verdade. char.classe, char.subclasse e
// char.nivel são ESPELHOS, escritos apenas por sincronizarEspelhos().
// ============================================================
import { CLASSES_INFO } from './dados-classes.js';

// Versão do schema do personagem. Sobe quando o formato muda de um jeito
// que um build antigo não saberia ler. 2 = modelo de multiclasse.
export const SCHEMA_VERSAO_ATUAL = 2;

/**
 * Devolve as classes do personagem no formato canônico.
 * Normaliza ficha legada (classe/subclasse/nivel escalares) para um
 * array de uma entrada, porque as migrações são preguiçosas e há
 * caminhos que leem o personagem sem abrir a ficha.
 * @param {object} p Personagem.
 * @returns {Array<{classe: string, subclasse: string, nivel: number, ordem: number}>}
 */
export function classesDe(p) {
  if (!p || typeof p !== 'object') return [];
  if (Array.isArray(p.classes) && p.classes.length) {
    return p.classes.map((c, i) => ({
      classe: c.classe || '',
      subclasse: c.subclasse || '',
      nivel: Number(c.nivel) || 0,
      ordem: Number.isFinite(c.ordem) ? c.ordem : i,
    }));
  }
  if (!p.classe) return [];
  return [{
    classe: p.classe,
    subclasse: p.subclasse || '',
    nivel: Number(p.nivel) || 0,
    ordem: 0,
  }];
}

/**
 * Nível do personagem naquela classe.
 * @returns {number} 0 se o personagem não tem a classe.
 */
export function nivelNa(p, nomeClasse) {
  const entrada = classesDe(p).find((c) => c.classe === nomeClasse);
  return entrada ? entrada.nivel : 0;
}

/**
 * Nível TOTAL do personagem -- a soma dos níveis de todas as classes.
 * É o número que manda em Bônus de Proficiência e XP (livro:2037, 2047).
 * @returns {number}
 */
export function nivelTotal(p) {
  return classesDe(p).reduce((soma, c) => soma + c.nivel, 0);
}

/** True se o personagem tem ao menos um nível naquela classe. */
export function temClasse(p, nomeClasse) {
  return nivelNa(p, nomeClasse) > 0;
}

/**
 * A classe INICIAL -- a de ordem 0. É dela que vêm as salvaguardas, as
 * perícias completas, o equipamento inicial e o dado de vida cheio do
 * 1º nível (livro:2041, 2049).
 * @returns {object|null}
 */
export function classeInicial(p) {
  const lista = classesDe(p);
  const entrada = lista.find((c) => c.ordem === 0);
  if (entrada) return entrada;
  if (!lista.length) return null;
  // Caminho degradado: a lista não é vazia, mas nenhuma entrada tem
  // ordem === 0 -- dado malformado que nenhum fluxo deste app deveria
  // produzir, mas nada nesta camada impede. Devolver a primeira entrada é
  // aceitável (a ficha continua abrindo em vez de travar), mas fazer isso
  // EM SILÊNCIO não é: a classe inicial dita salvaguardas, perícias
  // completas, equipamento inicial e o dado de vida cheio do 1º nível --
  // o jogador levaria números errados para a mesa sem nenhum sinal. O
  // aviso é o que torna a degradação rastreável.
  console.warn(
    `classeInicial: personagem "${p?.nome || '(sem nome)'}" tem ` +
    `${lista.length} classe(s) [${lista.map((c) => c.classe).join(', ')}] ` +
    `mas nenhuma com ordem === 0; elegendo "${lista[0].classe}" ` +
    `(primeira do array) como classe inicial.`);
  return lista[0];
}

/** Subclasse daquela classe; string vazia se o personagem não a possui. */
export function subclasseDe(p, nomeClasse) {
  const entrada = classesDe(p).find((c) => c.classe === nomeClasse);
  return entrada ? entrada.subclasse : '';
}

/**
 * As reservas de Dado de Vida do personagem, uma por TIPO de dado.
 *
 * O livro (livro:2043) manda somar os dados de todas as classes,
 * COMBINANDO os do mesmo tipo e MANTENDO SEPARADOS os de tipos
 * diferentes: "um Guerreiro de nível 5 / Paladino de nível 5 tem dez
 * dados d10"; "um Clérigo de nível 5 / Paladino de nível 5 terá cinco
 * dados d8 e cinco dados d10".
 *
 * Deriva de classes[] a cada chamada em vez de ler p.dados_vida, porque
 * o TOTAL é sempre função dos níveis -- só o campo `usados` é estado do
 * jogador, e é esse que vem do armazenado. Assim uma ficha cujo
 * p.dados_vida esteja velho (subiu de nível sem sincronizar) ainda
 * mostra o total certo.
 *
 * Ordem DECRESCENTE por faces: o dado maior primeiro. Não é regra do
 * livro -- é a ordem em que o seletor da tela apresenta, e fixá-la aqui
 * evita que a tela dependa da ordem de iteração de um objeto.
 *
 * PRECEDÊNCIA escalar x estruturado, com EXATAMENTE uma reserva: a mesma
 * regra que sincronizarEspelhos aplica ao semear a reserva a partir do
 * escalar quando há uma reserva só (o bloco que testa
 * `chavesReservas.length === 1`, naquela função), e pelo mesmo motivo --
 * NÃO porque hp-descanso.js escreva `p.dados_vida_usados` fora deste
 * arquivo hoje (desde o sub-projeto 3e ele chama
 * gastarDadosVida()/restaurarTodosDadosVida(), abaixo, que escrevem os
 * DOIS modelos juntos), mas porque uma ficha salva por uma versão
 * ANTERIOR a essa conversão pode carregar um gasto que só existe no
 * escalar, e nem toda leitura passa por sincronizarEspelhos antes
 * (migrarParaMulticlasse retorna cedo quando a ficha já migrou e os
 * espelhos não divergem). Uma ficha de classe única/reserva única pode
 * chegar aqui com o escalar mais novo que o estruturado -- ler só o
 * estruturado apagaria esse gasto em silêncio, a mesma classe de perda
 * que esta rede existe para fechar, só que do lado da população seguindo
 * o caminho de uma reserva só. Com DUAS OU MAIS reservas um escalar não
 * tem como ser distribuído entre elas, então o estruturado é que manda,
 * sem mudança de comportamento.
 *
 * @param {object} p Personagem.
 * @returns {Array<{faces:number,total:number,usados:number,disponiveis:number}>}
 */
export function reservasDadosVida(p) {
  const lista = classesDe(p);
  const porFaces = new Map();
  for (const c of lista) {
    const faces = CLASSES_INFO[c.classe]?.dado_vida;
    if (!faces) continue;
    porFaces.set(faces, (porFaces.get(faces) || 0) + c.nivel);
  }
  const armazenadas = (p && typeof p.dados_vida === 'object' && p.dados_vida) || {};
  // Ver o docblock acima: com uma reserva só, o escalar lidera quando
  // presente. A guarda `!== undefined` evita tratar ausência de escalar
  // (personagem que nunca passou por um descanso) como gasto zero "mais
  // atualizado" que o estruturado.
  const escalarLidera = porFaces.size === 1 && p && p.dados_vida_usados !== undefined;
  const usadosEscalar = escalarLidera ? Math.max(0, Number(p.dados_vida_usados) || 0) : 0;
  return [...porFaces.entries()]
    .map(([faces, total]) => {
      // `usados` é o único campo que é ESTADO do jogador; satura no total
      // para o caso de a ficha ter perdido níveis desde o último gasto.
      const usadosBase = escalarLidera ? usadosEscalar : Number(armazenadas[faces]?.usados) || 0;
      const usados = Math.min(total, Math.max(0, usadosBase));
      return { faces, total, usados, disponiveis: total - usados };
    })
    .sort((a, b) => b.faces - a.faces);
}

/**
 * Grava um mapa de reservas (faces -> {total, usados}) no personagem,
 * atualizando os DOIS modelos -- o estruturado (`p.dados_vida`) e as
 * somas escalares legadas (`p.dados_vida_total`, `p.dados_vida_usados`).
 * Ponto único de escrita para gastarDadosVida() e
 * restaurarTodosDadosVida(), para as duas invariantes abaixo valerem
 * para os dois sem duplicar a lógica.
 *
 * Guarda de reserva vazia -- a mesma guarda de sincronizarEspelhos, para
 * o mesmo `if (!Object.keys(reservas).length)` daquela função: se `novo`
 * chega vazio (nenhuma classe do personagem bateu com CLASSES_INFO --
 * classe fora do catálogo, ou nome acentuado em forma Unicode diferente),
 * não há como montar reserva nenhuma. `dados_vida_total`/`dados_vida_usados`
 * são LIDOS pelo jogador (a ficha mostra "X/Y dados de vida"); sobrescrever
 * com soma vazia faria a ficha mentir sobre o total e o gasto reais.
 * Preserva os escalares pré-existentes e não toca em `p.dados_vida`.
 *
 * @param {object} p Personagem, mutado no lugar.
 * @param {object} novo Mapa faces -> {total, usados}.
 */
function gravarReservas(p, novo) {
  if (!Object.keys(novo).length) {
    p.dados_vida_total = Number(p.dados_vida_total) || 0;
    p.dados_vida_usados = Number(p.dados_vida_usados) || 0;
    return;
  }
  p.dados_vida = novo;
  p.dados_vida_total = Object.values(novo).reduce((s, r) => s + r.total, 0);
  p.dados_vida_usados = Object.values(novo).reduce((s, r) => s + r.usados, 0);
}

/**
 * Gasta dados de vida de UMA reserva, pelo tipo de dado.
 *
 * Escritor AUTORIZADO dos campos de dado de vida -- ver o docblock de
 * sincronizarEspelhos. Antes desta função o gasto ia só para o escalar
 * legado `p.dados_vida_usados`, e num personagem com DOIS tipos de dado
 * ele era descartado na sincronização seguinte: a semeadura escalar ->
 * reserva só roda com UMA reserva, porque um escalar não tem como ser
 * distribuído entre duas. Medido: um Mago 5/Bárbaro 5 gastava 3 dados e
 * voltava a 0 na próxima sincronização, com o gasto perdido em silêncio.
 *
 * Escreve os DOIS modelos, e é por isso que fecha a rede: a reserva
 * estruturada (que sobrevive à sincronização) e o escalar legado (que os
 * consumidores ainda não convertidos continuam lendo).
 *
 * Satura no disponível em vez de recusar: o chamador é uma tela, e um
 * pedido acima do disponível é erro de entrada, não estado inválido.
 *
 * @param {object} p Personagem, mutado no lugar.
 * @param {number} faces Tipo de dado (6, 8, 10, 12).
 * @param {number} qtd Quantidade pedida.
 * @returns {number} Quantidade EFETIVAMENTE gasta; 0 se o tipo não existe.
 */
export function gastarDadosVida(p, faces, qtd) {
  if (!p || typeof p !== 'object') return 0;
  const reservas = reservasDadosVida(p);
  const alvo = reservas.find((r) => r.faces === Number(faces));
  if (!alvo) return 0;
  const gasto = Math.max(0, Math.min(alvo.disponiveis, Math.floor(Number(qtd) || 0)));
  if (!gasto) return 0;

  // Reescreve o mapa inteiro a partir das reservas derivadas: assim um
  // p.dados_vida velho (total desatualizado) é corrigido de passagem, em
  // vez de o gasto ser gravado sobre um total errado.
  const novo = {};
  for (const r of reservas) {
    novo[r.faces] = {
      total: r.total,
      usados: r.faces === alvo.faces ? r.usados + gasto : r.usados,
    };
  }
  gravarReservas(p, novo);
  return gasto;
}

/**
 * Devolve TODOS os dados de vida gastos, de todas as reservas.
 *
 * Regra 2024 do Descanso Longo (Regras.md:379): "Você recupera todos os
 * Pontos de Vida perdidos e todos os Dados de Vida gastos" -- todos, não
 * metade. Escritor AUTORIZADO, mesmo motivo de gastarDadosVida.
 *
 * @param {object} p Personagem, mutado no lugar.
 */
export function restaurarTodosDadosVida(p) {
  if (!p || typeof p !== 'object') return;
  const reservas = reservasDadosVida(p);
  const novo = {};
  for (const r of reservas) novo[r.faces] = { total: r.total, usados: 0 };
  gravarReservas(p, novo);
  // Regras.md:379 é INCONDICIONAL: "Você recupera... todos os Dados de
  // Vida gastos" não depende de saber o TIPO do dado -- zerar `usados` é
  // sempre correto depois de um Descanso Longo. `dados_vida_total`, esse
  // sim, não pode ser recalculado sem o catálogo (é por isso que a guarda
  // de reserva vazia de gravarReservas() existe -- ver o docblock daquela
  // função). Aquela guarda conflacionava os dois campos e preservava
  // `usados` junto com `total` quando nenhuma classe resolve contra
  // CLASSES_INFO (`reservas` vazio): uma ficha nessa situação saía do
  // Descanso Longo com os dados ainda marcados como gastos -- o código
  // antigo (`dados_vida_usados = 0`, que não dependia de catálogo nenhum)
  // sempre restaurava. Corrige aqui, sem mexer na guarda compartilhada de
  // gravarReservas(): gastarDadosVida() depende dela como está.
  if (!reservas.length) p.dados_vida_usados = 0;
}

/**
 * Reescreve os campos ESPELHO a partir de char.classes.
 * É a única função autorizada a escrever char.classe, char.subclasse e
 * char.nivel. Para os três campos de dado de vida (char.dados_vida,
 * char.dados_vida_total, char.dados_vida_usados) os escritores
 * autorizados são gastarDadosVida() e restaurarTodosDadosVida(), acima --
 * o sub-projeto 3e fechou essa rede. Os três escritores legados de
 * site/js/sheet/hp-descanso.js (o gasto de dado de vida no descanso
 * curto, nas duas telas, e o zera-tudo do descanso longo) passaram a
 * chamar esses dois acessores na Tarefa 3 do sub-projeto 3e, em vez de
 * escrever o escalar direto -- não escrevem mais fora deste arquivo.
 * Ainda restam TRÊS escritores legados, escopo do sub-projeto 5,
 * rastreados em ESCRITAS_PERMITIDAS (multiclasse-fundacao.test.mjs):
 *   - site/js/creator/wizard.js:441 -- grava `dados_vida_total` na
 *     criação de personagem.
 *   - site/js/levelup.js:1414 -- grava `dados_vida_total` na subida de
 *     nível.
 *   - site/js/store.js:324-325 -- grava `dados_vida_total: 1` e
 *     `dados_vida_usados: 0` no literal de criarPersonagemVazio() --
 *     classe de risco diferente dos dois acima (é template de
 *     personagem NOVO, não mutação concorrente de ficha existente).
 *
 * O ramo de reconciliação de migrarParaMulticlasse() (ficha já carimbada,
 * mas com os espelhos p.nivel/p.subclasse divergindo de classes[] --
 * ver docblock daquela função) chama sincronizarEspelhos() em TODA
 * reabertura de ficha que subiu de nível desde a última migração -- não é
 * caminho raro: é o que acontece com qualquer ficha salva por uma versão
 * ANTERIOR ao sub-projeto 3e que tenha um gasto de descanso curto gravado
 * só no ESCALAR legado `p.dados_vida_usados` (de quando hp-descanso.js
 * ainda escrevia direto nele, antes de passar a chamar
 * gastarDadosVida()/restaurarTodosDadosVida()) seguido de uma subida de
 * nível (que só toca o espelho `p.nivel`) antes de a ficha ser reaberta --
 * a divergência de nível dispara a reconciliação, que chama
 * sincronizarEspelhos() de novo sobre uma ficha cujo gasto anterior só
 * existe no escalar. Por isso esta função NÃO PODE confiar cegamente no
 * objeto ESTRUTURADO (`p.dados_vida`) como se ele fosse sempre o mais
 * atual: se houver exatamente UMA reserva e o total de `usados` dela
 * discordar do ESCALAR legado (`p.dados_vida_usados`), o escalar é que
 * está atualizado -- NÃO porque hp-descanso.js o escreva hoje entre duas
 * chamadas a esta função (desde o sub-projeto 3e ele chama os dois
 * acessores acima, que escrevem os DOIS modelos juntos), mas porque a
 * ficha carrega um gasto anterior a essa conversão -- e a reserva é
 * semeada a partir do escalar (ver o bloco logo abaixo do `return` de
 * "nenhuma classe bateu"). Com DUAS OU MAIS reservas um escalar único não
 * tem como ser distribuído entre elas, então o estruturado é que manda e
 * nenhuma semeadura acontece.
 * @param {object} p Personagem, mutado no lugar.
 */
export function sincronizarEspelhos(p) {
  if (!p || typeof p !== 'object') return;
  const lista = classesDe(p);
  if (!lista.length) return;

  const inicial = classeInicial(p);
  p.classe = inicial ? inicial.classe : '';
  p.subclasse = inicial ? inicial.subclasse : '';
  p.nivel = lista.reduce((soma, c) => soma + c.nivel, 0);

  // Reservas de dado de vida por TIPO. O livro manda mantê-las separadas
  // quando as classes têm dados diferentes, e combiná-las quando são do
  // mesmo tipo (livro:2043).
  const usadosAnteriores = p.dados_vida || {};
  const reservas = {};
  for (const c of lista) {
    const faces = CLASSES_INFO[c.classe]?.dado_vida;
    if (!faces) continue;
    if (!reservas[faces]) {
      reservas[faces] = { total: 0, usados: usadosAnteriores[faces]?.usados || 0 };
    }
    reservas[faces].total += c.nivel;
  }
  // Nenhuma classe do personagem bateu com CLASSES_INFO (classe fora do
  // catálogo, ou nome acentuado em forma Unicode diferente) -- não há como
  // montar reserva nenhuma. `dados_vida_usados` é LIDO pelo jogador (a
  // ficha mostra "X/Y dados de vida"); sobrescrever com soma vazia faria a
  // ficha voltar a exibir os dados de vida cheios, mentindo sobre o gasto
  // real. Preserva os escalares pré-existentes em vez de zerá-los.
  if (!Object.keys(reservas).length) {
    p.dados_vida_total = Number(p.dados_vida_total) || 0;
    p.dados_vida_usados = Number(p.dados_vida_usados) || 0;
    return;
  }
  // O escalar legado (`p.dados_vida_usados`) só diverge do "usados"
  // estruturado por causa de uma ficha salva por uma versão ANTERIOR ao
  // sub-projeto 3e -- NÃO porque hp-descanso.js escreva o escalar fora
  // desta função hoje. Desde o sub-projeto 3e, hp-descanso.js chama
  // gastarDadosVida()/restaurarTodosDadosVida() (acima, neste arquivo),
  // que atualizam os DOIS modelos juntos. Enquanto há UMA ÚNICA reserva,
  // escalar e estruturado descrevem a MESMA coisa; se discordarem, é
  // porque a ficha foi salva em disco por uma versão anterior a essa
  // conversão -- com um gasto que só existe no escalar -- e ainda não
  // passou por um descanso desde então. Com uma reserva só, a atribuição
  // é inequívoca: semeia a reserva a partir do escalar.
  //
  // NÃO REMOVA esta semeadura achando-a código morto porque
  // hp-descanso.js não escreve mais o escalar diretamente: ela é o que
  // protege qualquer ficha gravada ANTES desta conversão de perder gasto
  // de dado de vida em silêncio na primeira reabertura -- exatamente o
  // Critical que a revisão da Tarefa 2 mediu, numa ficha de classe única
  // (a população que a análise original dava como segura). Enquanto
  // existir uma ficha salva por uma versão anterior a este sub-projeto,
  // esta regra continua necessária, mesmo que hp-descanso.js não escreva
  // mais o escalar.
  //
  // A guarda `!== undefined` evita tratar um personagem que nunca passou
  // por um descanso (escalar ausente) como se tivesse um gasto zerado
  // "mais atualizado" que o estruturado.
  // Com DUAS OU MAIS reservas um escalar não tem como ser distribuído
  // entre elas, então o estruturado é que manda -- esta é a linha que
  // mudou de significado no sub-projeto 3e, quando o fluxo de descanso
  // passou a escrever direto na reserva certa.
  const chavesReservas = Object.keys(reservas);
  if (chavesReservas.length === 1 && p.dados_vida_usados !== undefined) {
    const unicaChave = chavesReservas[0];
    const usadosEscalar = Number(p.dados_vida_usados) || 0;
    if (usadosEscalar !== reservas[unicaChave].usados) {
      reservas[unicaChave].usados = usadosEscalar;
    }
  }
  // Gasto não pode passar do total -- acontece se o personagem perder níveis.
  for (const faces of Object.keys(reservas)) {
    if (reservas[faces].usados > reservas[faces].total) {
      reservas[faces].usados = reservas[faces].total;
    }
  }
  p.dados_vida = reservas;

  // Somas espelhadas, para os consumidores legados que leem um escalar.
  p.dados_vida_total = Object.values(reservas).reduce((s, r) => s + r.total, 0);
  p.dados_vida_usados = Object.values(reservas).reduce((s, r) => s + r.usados, 0);
}

/**
 * Converte uma ficha de classe única para o modelo de multiclasse.
 * Idempotente por schema_versao, não por p.classes: se p.classes já
 * existe MAS p.schema_versao ainda não é SCHEMA_VERSAO_ATUAL (uma ficha
 * pode chegar com classes[] por outro caminho, sem nunca ter passado por
 * esta função), carimba o schema e sincroniza os espelhos sem reconstruir
 * classes[] nem dados_vida -- já são a fonte da verdade. Sem esse
 * carimbo, a Tarefa 8 trataria essa ficha como schema 1 para sempre
 * (`Number(schema_versao) || 1`). Só devolve false quando não há mais
 * nada para carimbar.
 * Não destrutiva: p.classe, p.subclasse e p.nivel permanecem, agora
 * como espelhos mantidos por sincronizarEspelhos().
 * @param {object} p Personagem, mutado no lugar.
 * @returns {boolean} true se alterou o personagem.
 */
export function migrarParaMulticlasse(p) {
  if (!p || typeof p !== 'object') return false;

  if (Array.isArray(p.classes) && p.classes.length) {
    // Já está no formato novo. Mas enquanto o app for de classe única, o
    // fluxo normal de subida (levelup.js:1411 e :1429) escreve SÓ nos
    // espelhos (p.nivel, p.subclasse) -- classes[] nunca é tocado. Sem
    // reconciliar aqui, uma ficha migrada uma vez apodrece a cada subida
    // seguinte: os espelhos avançam e classes[0] fica parado no valor da
    // migração. Reconcilia ANTES do retorno antecipado por schema_versao,
    // porque com o carimbo já presente o retorno cedo é exatamente o que
    // impedia a divergência de ser corrigida.
    // Com DUAS OU MAIS classes, p.nivel é a SOMA de todas -- não há como
    // saber qual classe subiu a partir do espelho, então classes[] é que
    // manda e esta reconciliação não roda. (Esta linha vira no-op no
    // sub-projeto 5, quando o fluxo de subida passar a escrever em
    // classes[] diretamente também no caso multiclasse.)
    let divergiu = false;
    // Ausência de espelho não é divergência -- é ausência de informação.
    // Alcançável desde que _validarPersonagem passou a aceitar classes[]
    // sem o escalar p.nivel: uma ficha importada pode chegar com classes[]
    // válido e nenhum espelho ainda escrito. Sem esta guarda,
    // `Number(p.nivel) || 0` e `p.subclasse || ''` liam a ausência como
    // "nivel 0" e "subclasse vazia" e destruíam classes[0] na primeira
    // reconciliação. Quando o espelho falta, classes[] é que manda: não
    // escreve nele, mas ainda marca espelhoIncompleto para forçar a
    // sincronização adiante -- sem isso p.nivel/p.subclasse ficariam
    // undefined para sempre, porque o retorno antecipado abaixo nunca
    // chamaria sincronizarEspelhos() sobre uma ficha sem divergência real.
    let espelhoIncompleto = false;
    if (p.classes.length === 1) {
      const unica = p.classes[0];
      // Nivel só conta como espelho presente quando finito e >= 1 (nivel 0
      // não existe em D&D); subclasse conta como presente quando é string,
      // mesmo vazia, porque "" é um valor legítimo (personagem sem
      // subclasse ainda).
      const nivelEspelho = Number(p.nivel);
      if (Number.isFinite(nivelEspelho) && nivelEspelho >= 1) {
        if (unica.nivel !== nivelEspelho) { unica.nivel = nivelEspelho; divergiu = true; }
      } else {
        espelhoIncompleto = true;
      }
      if ('string' === typeof p.subclasse) {
        if (unica.subclasse !== p.subclasse) { unica.subclasse = p.subclasse; divergiu = true; }
      } else {
        espelhoIncompleto = true;
      }
    }
    // Só falta carimbar o schema se ainda não estiver carimbado -- ver
    // docblock acima. Sem divergência, sem espelho faltando e já carimbado,
    // não há nada a fazer: a idempotência tem de sobreviver a chamadas
    // repetidas.
    if (!divergiu && !espelhoIncompleto && p.schema_versao === SCHEMA_VERSAO_ATUAL) return false;
    p.schema_versao = SCHEMA_VERSAO_ATUAL;
    sincronizarEspelhos(p);
    return true;
  }
  if (!p.classe) return false;

  const usadosLegado = Number(p.dados_vida_usados) || 0;
  p.classes = [{
    classe: p.classe,
    subclasse: p.subclasse || '',
    nivel: Number(p.nivel) || 1,
    ordem: 0,
  }];
  // Preserva o gasto legado, que era um escalar único, na reserva do
  // único tipo de dado que a ficha de classe única podia ter.
  const faces = CLASSES_INFO[p.classe]?.dado_vida;
  if (faces) p.dados_vida = { [faces]: { total: 0, usados: usadosLegado } };
  p.schema_versao = SCHEMA_VERSAO_ATUAL;
  sincronizarEspelhos(p);
  return true;
}
