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
 * Reescreve os campos ESPELHO a partir de char.classes.
 * DEVERIA ser a única função autorizada a escrever char.classe,
 * char.subclasse, char.nivel, char.dados_vida, char.dados_vida_total e
 * char.dados_vida_usados -- mas essa rede AINDA NÃO EXISTE para os três
 * campos de dado de vida. Hoje há cinco escritores legados que mutam uma
 * ficha EXISTENTE, nenhum deles varrido por nenhum oráculo:
 *   - site/js/sheet/hp-descanso.js:304 e :698 -- gasto de dado de vida
 *     no descanso curto (`char.dados_vida_usados += qtd`).
 *   - site/js/sheet/hp-descanso.js:736 -- zera `dados_vida_usados` no
 *     descanso longo.
 *   - site/js/creator/wizard.js:441 -- grava `dados_vida_total` na
 *     criação de personagem.
 *   - site/js/levelup.js:1414 -- grava `dados_vida_total` na subida de
 *     nível.
 * Um SEXTO escritor, site/js/store.js:280-281, grava
 * `dados_vida_total: 1` e `dados_vida_usados: 0` no literal de
 * criarPersonagemVazio() -- classe de risco diferente dos cinco acima
 * (é template de personagem NOVO, não mutação concorrente de ficha
 * existente), mas fica registrado aqui para quem for fechar esta rede na
 * Tarefa 9 não precisar redescobri-lo.
 * O regex de guarda da Tarefa 9 (oráculo 6) é
 * `/(char|personagem)\.(classe|subclasse|nivel)\s*=[^=]/` -- cobre só
 * `classe`, `subclasse` e `nivel`; nenhum dos três campos de dado de
 * vida está protegido.
 *
 * O ramo de reconciliação de migrarParaMulticlasse() (ficha já carimbada,
 * mas com os espelhos p.nivel/p.subclasse divergindo de classes[] --
 * ver docblock daquela função) chama sincronizarEspelhos() em TODA
 * reabertura de ficha que subiu de nível desde a última migração -- não é
 * caminho raro, é o fluxo normal do jogador (abre a ficha, migra; gasta
 * dado de vida no descanso curto, que escreve só no ESCALAR legado
 * `p.dados_vida_usados`; sobe de nível; reabre a ficha; a divergência de
 * nível dispara a reconciliação, que chama sincronizarEspelhos() de novo
 * sobre uma ficha que o descanso já mexeu). Por isso esta função NÃO PODE
 * confiar cegamente no objeto ESTRUTURADO (`p.dados_vida`) como se ele
 * fosse sempre o mais atual: se houver exatamente UMA reserva e o total de
 * `usados` dela discordar do ESCALAR legado (`p.dados_vida_usados`), o
 * escalar é que está atualizado -- só hp-descanso.js o escreve entre duas
 * chamadas a esta função -- e a reserva é semeada a partir dele (ver o
 * bloco logo abaixo do `return` de "nenhuma classe bateu"). Com DUAS OU
 * MAIS reservas um escalar único não tem como ser distribuído entre elas,
 * então o estruturado é que manda e nenhuma semeadura acontece.
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
  // O escalar legado (`p.dados_vida_usados`) é escrito por hp-descanso.js
  // FORA desta função (ver docblock acima). Enquanto há UMA ÚNICA reserva,
  // ele e o "usados" estruturado descrevem a MESMA coisa; se discordarem,
  // é porque hp-descanso.js gravou no escalar depois da última
  // sincronização, e o escalar é que está atualizado -- só código legado o
  // escreve entre duas chamadas a sincronizarEspelhos(). Com uma reserva
  // só, a atribuição é inequívoca: semeia a reserva a partir do escalar.
  // A guarda `!== undefined` evita tratar um personagem que nunca passou
  // por um descanso (escalar ausente) como se tivesse um gasto zerado
  // "mais atualizado" que o estruturado.
  // Com DUAS OU MAIS reservas um escalar não tem como ser distribuído
  // entre elas, então o estruturado é que manda -- esta é a linha que
  // muda de significado no sub-projeto 3, quando o fluxo de descanso
  // passar a escrever direto na reserva certa.
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
