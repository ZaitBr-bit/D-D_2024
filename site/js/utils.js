// ============================================================
// Utilitários de cálculo D&D 5.5 e helpers gerais
// ============================================================
import { ATRIBUTOS_KEYS, ATRIBUTO_NOME_PARA_KEY, PERICIAS, CLASSES_INFO } from './dados-classes.js';
import { magiaContaNoLimite } from './regras-origens-magia.js';
import { getAtributoConjuracaoSubclasse, getConjuracaoSubclasse } from './regras-conjuracao-subclasse.js';
// Acessores de multiclasse. Não há ciclo: regras-multiclasse.js importa
// apenas dados-classes.js, que utils.js já importa acima.
import { classesDe, temClasse } from './regras-multiclasse.js';

// --- Cálculos D&D ---

/** Calcula modificador de atributo */
export function calcMod(valor) {
  return Math.floor((valor - 10) / 2);
}

/** Formata modificador com sinal (+/-) */
export function fmtMod(mod) {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

/** Bônus de proficiência por nível do personagem */
export function bonusProficiencia(nivel) {
  return Math.ceil(nivel / 4) + 1;
}

/** Calcula PV máximo no nível 1 */
export function calcPVNivel1(dadoVida, modCon) {
  return dadoVida + modCon;
}

/** Calcula PV máximo total (nível 1 + subida simples) */
export function calcPVTotal(dadoVida, nivel, modCon) {
  // Nível 1: dado de vida máximo + mod CON
  // Níveis subsequentes: média do dado + mod CON por nível
  const mediaSubida = Math.floor(dadoVida / 2) + 1;
  return dadoVida + modCon + (nivel - 1) * (mediaSubida + modCon);
}

/**
 * PV máximo de um personagem, somando o dado de vida de CADA classe.
 *
 * O livro manda DUAS regras, não uma (livro:2039-2041):
 *   1. cada classe contribui com o PRÓPRIO dado de vida -- os PV da
 *      "nova classe" são os dela, não os da classe inicial;
 *   2. o dado CHEIO é pago uma vez só, no nível TOTAL 1, que pertence
 *      sempre à classe inicial. O PRIMEIRO nível de qualquer classe
 *      ADICIONAL usa a média, como qualquer outro nível.
 *
 * O defeito que ela corrige: calcPVTotal recebe UM dado de vida escalar
 * e o nível TOTAL, então um Mago 5/Bárbaro 5 dava 62 e um Bárbaro 5/Mago 5
 * dava 95, com CON +2 -- 33 PV de diferença entre dois personagens que o
 * livro diz serem idênticos (os dois valem 77 e 80 pela fórmula acima).
 *
 * A classe inicial sai da MESMA lista já materializada, e não de
 * classeInicial(), porque classesDe() devolve objetos novos a cada
 * chamada: comparar por identidade só funciona dentro de uma lista só.
 *
 * Classe fora de CLASSES_INFO não contribui, em vez de propagar NaN.
 *
 * @param {object} personagem Personagem; lê classes[], nunca os espelhos.
 * @param {number} modCon Modificador de Constituição.
 * @returns {number} PV máximo, nunca abaixo de 1.
 */
export function calcPVMulticlasse(personagem, modCon) {
  const lista = classesDe(personagem);
  if (!lista.length) return 1;
  const inicial = lista.find((c) => c.ordem === 0) || lista[0];
  const facesIniciais = CLASSES_INFO[inicial.classe]?.dado_vida;
  if (!facesIniciais) return 1;

  // Nível 1 do PERSONAGEM: dado cheio + modCon, uma vez só.
  //
  // O piso de 1 é POR NÍVEL, não sobre o total: livro:1963 manda somar o
  // ganho de cada nível "(mínimo de 1)" aos PV máximos, então um nível
  // isolado nunca subtrai. Aplicar o piso só no fim daria número menor
  // com Constituição muito baixa -- um Feiticeiro 5 com CON 1 (mod −5)
  // fecharia em 1 em vez de 5. `pvGanhoAoSubir`
  // (regras-multiclasse-progressao.js) já aplica o piso nos três ramos e
  // levelup.js:350/:368 também; as três implementações concordam de
  // propósito, e divergir aqui daria PV diferente conforme o caminho
  // (recálculo x subida de nível) que produziu a ficha.
  let pv = Math.max(1, facesIniciais + modCon);
  for (const c of lista) {
    const faces = CLASSES_INFO[c.classe]?.dado_vida;
    if (!faces) continue;
    const media = Math.floor(faces / 2) + 1;
    // A inicial já pagou o 1º nível acima; as demais pagam média em
    // TODOS os seus níveis, inclusive o primeiro (livro:2041).
    const niveisNaMedia = c === inicial ? c.nivel - 1 : c.nivel;
    pv += niveisNaMedia * Math.max(1, media + modCon);
  }
  // Inalcançável desde que o piso passou a ser por nível (todo termo da
  // soma é >= 1, e o primeiro já saiu de Math.max). Fica como rede: quem
  // mexer na soma acima não devolve PV negativo por descuido.
  return Math.max(1, pv);
}

/**
 * Verifica se uma magia registrada pelo nome pertence ao grimório do mago.
 *
 * `temClasse` em vez de `personagem?.classe !== 'Mago'`: aquele era o
 * espelho da classe INICIAL, e um Ladino 5/Mago 1 (Mago NÃO é a classe
 * inicial) sempre devolvia false aqui -- o portão do grimório (sheet/
 * grimorio.js, "Essa magia não está registrada no grimório") nunca
 * disparava para ele, e ele podia preparar qualquer magia de círculo da
 * lista de Mago sem ela estar no livro. `temClasse` lê `classes[]` (a
 * fonte da verdade) e cai para o mesmo espelho quando `classes[]` não
 * existe (ficha legada de classe única) -- mesmo resultado de antes nesse
 * caso, correto também no multiclasse.
 * @param {object} personagem
 * @param {string} nome
 * @returns {boolean}
 */
export function magiaMagoEstaNoGrimorio(personagem, nome) {
  if (!temClasse(personagem, 'Mago') || typeof nome !== 'string') return false;
  return Array.isArray(personagem.grimorio) && personagem.grimorio.some(m => m?.nome === nome);
}

/**
 * Retorna o conjunto de nomes de magias de 1º círculo que o personagem já
 * conhece por qualquer fonte: magias atualmente preparadas, magias conhecidas
 * de conjuradores espontâneos, e — para o Mago — todo o grimório (não apenas
 * as magias preparadas no momento).
 * @param {object} personagem
 * @returns {Set<string>}
 */
export function nomesMagiaCirculo1Conhecidas(personagem) {
  const nomes = new Set([
    ...(personagem?.magias_preparadas || []).filter(m => Number(m?.circulo) === 1).map(m => m.nome),
    ...(personagem?.magias_conhecidas || []).filter(m => Number(m?.circulo) === 1).map(m => m.nome)
  ]);
  if (personagem?.classe === 'Mago') {
    (personagem.grimorio || []).forEach(m => {
      if (Number(m?.circulo) === 1 && typeof m.nome === 'string') nomes.add(m.nome);
    });
  }
  return nomes;
}

/**
 * Normaliza o grimório de personagens Magos legados sem inventar magias.
 * Magias preparadas normais de 1º círculo ou superior também devem constar
 * no grimório; magias concedidas por outra origem não contam para essa regra.
 *
 * NÃO CONVERTIDA para multiclasse (Tarefa 3, sub-projeto "tela magias por
 * classe" -- decisão tomada, não esquecimento). O portão `personagem.classe
 * !== 'Mago'` lê o ESPELHO de propósito: ela empurra para dentro de
 * `personagem.grimorio` toda magia de `magias_preparadas` com círculo > 0
 * que passe em `magiaContaNoLimite` (linhas abaixo). Trocar o portão por
 * `temClasse(personagem, 'Mago')` faria um Clérigo 5/Mago 1 copiar as
 * magias PREPARADAS DO CLÉRIGO para dentro do grimório do Mago --
 * corrupção de ficha, não conversão de leitura.
 *
 * ATUALIZAÇÃO (sub-projeto "magia sabe a classe", que fechou o adiamento de
 * docs/PERGUNTAS-PENDENTES.txt "MAGIA PREPARADA NAO SABE DE QUE CLASSE E"):
 * `magias_preparadas[].classe` agora EXISTE, mas isso NÃO destrava o portão
 * acima. O campo é OPCIONAL -- ausente ou string não vazia, nunca chute --
 * e a migração só carimba o que dá para saber com certeza (RULING R-B, classe
 * única; ou lista de magias bater com exatamente uma classe do multiclasse).
 * O estado misto (parte carimbada, parte sem carimbo) é PERMANENTE por
 * decisão de projeto, não uma fase de transição: magia personalizada, lista
 * ausente do app, ou multiclasse ambíguo (ex.: Feiticeiro/Mago, que
 * compartilham 95% da lista menor) nunca recebem carimbo. Para essas
 * entradas sem `classe`, o perigo de empurrar a magia errada para o
 * grimório é IDÊNTICO ao de antes do campo existir.
 *
 * Ou seja: o campo novo resolve o problema só pela METADE. CONVERTER ESTE
 * PORTÃO MECANICAMENTE (`personagem.classe !== 'Mago'` ->
 * `!temClasse(personagem, 'Mago')`, sem tocar no laço de empurrar) CONTINUA
 * SENDO CORRUPÇÃO DE FICHA: um Clérigo 5/Mago 1 ainda teria as preparadas
 * SEM carimbo (e as carimbadas `'Clérigo'`) copiadas para o grimório do
 * Mago. Não destrave isto por causa desta atualização.
 *
 * Um destravamento seguro existe, mas exige as DUAS metades juntas, não só
 * o portão: (1) `temClasse(personagem, 'Mago')` no portão, E (2) o laço de
 * empurrar filtrando por `magia.classe === 'Mago'` (nunca `semClasse`, nunca
 * `deOutra`) -- exatamente `preparadasPorClasse(personagem, 'Mago').desta`,
 * de `regras-magia-classe.js`. Fica registrado aqui como possibilidade para
 * um sub-projeto futuro, não como pedido de mudança desta função.
 *
 * MAGIA PERSONALIZADA NÃO ENTRA POR AQUI (issue #42, achado da revisão da
 * Tarefa 7): esta função existe para migrar ficha LEGADA -- "magia
 * preparada normal já pertence ao grimório" -- mas magia personalizada
 * preparada (`magias_preparadas[].personalizada === true`, carimbo que
 * `sheet/grimorio.js` e `sheet/magias.js` sempre gravam ao preparar uma)
 * CONTA no limite de preparadas (`magiaContaNoLimite`, que não distingue
 * origem "personalizada" de origem "escolhida da lista da classe" -- as
 * duas são escolha do jogador) mas não pode ser tratada como "normal" AQUI:
 * ela nunca foi copiada, e copiar custa 50 PO / 2h por círculo -- o mesmo
 * preço que esta função pulava para toda magia customizada RECÉM-CRIADA
 * antes da Tarefa 7 corrigir `mostrarFormMagiaCustom`. Sem excluir
 * `personalizada` daqui, o mesmo defeito voltava por esta porta: criar a
 * magia (correto, fora do grimório), preparar pela grade ("+ Magia", isenta
 * do portão do grimório desde a Tarefa 6) e só reabrir a ficha bastava para
 * `listarPersonagens()` (store.js) ou o load da ficha (pages/sheet.js)
 * chamarem esta função e empurrar a magia para o grimório de graça.
 *
 * @param {object} personagem
 * @param {number} [limitePreparadas]
 * @returns {{alterado: boolean, pendentes: number}}
 */
export function normalizarGrimorioMago(personagem, limitePreparadas) {
  if (!personagem || typeof personagem !== 'object' || personagem.classe !== 'Mago') {
    return { alterado: false, pendentes: 0 };
  }

  let alterado = false;
  if (!Array.isArray(personagem.grimorio)) {
    // Formatos legados malformados ainda podem conter dados. Encapsulá-los
    // preserva a entrada e permite que a migração siga sem apagá-la.
    personagem.grimorio = personagem.grimorio == null ? [] : [personagem.grimorio];
    alterado = true;
  }

  const indicesPorNome = new Map();
  const grimorioNormalizado = [];
  for (const magia of personagem.grimorio) {
    const nome = magia?.nome;
    if (typeof nome !== 'string' || !nome) {
      grimorioNormalizado.push(magia);
      continue;
    }

    const indiceExistente = indicesPorNome.get(nome);
    if (indiceExistente == null) {
      indicesPorNome.set(nome, grimorioNormalizado.length);
      grimorioNormalizado.push(magia);
      continue;
    }

    // Em duplicatas legadas, manter a entrada com o menor círculo numérico
    // confiável e preservar todos os demais dados dessa entrada.
    const existente = grimorioNormalizado[indiceExistente];
    const valorCirculoExistente = existente?.circulo;
    const valorCirculoAtual = magia?.circulo;
    const existenteConfiavel = (typeof valorCirculoExistente === 'number' && Number.isFinite(valorCirculoExistente)) ||
      (typeof valorCirculoExistente === 'string' && valorCirculoExistente.trim() !== '' && Number.isFinite(Number(valorCirculoExistente)));
    const atualConfiavel = (typeof valorCirculoAtual === 'number' && Number.isFinite(valorCirculoAtual)) ||
      (typeof valorCirculoAtual === 'string' && valorCirculoAtual.trim() !== '' && Number.isFinite(Number(valorCirculoAtual)));
    const circuloExistente = Number(valorCirculoExistente);
    const circuloAtual = Number(valorCirculoAtual);
    if (atualConfiavel && (!existenteConfiavel || circuloAtual < circuloExistente)) {
      grimorioNormalizado[indiceExistente] = magia;
    }
    alterado = true;
  }
  if (grimorioNormalizado.length !== personagem.grimorio.length) {
    personagem.grimorio = grimorioNormalizado;
  }

  const preparadasNormais = (Array.isArray(personagem.magias_preparadas) ? personagem.magias_preparadas : [])
    .filter(magia => magia && typeof magia === 'object' && typeof magia.nome === 'string' && magia.nome && magiaContaNoLimite(magia) && Number(magia.circulo) > 0);

  for (const magia of preparadasNormais) {
    // issue #42: pula magia PERSONALIZADA -- ela conta no limite de
    // preparadas (por isso continua em `preparadasNormais`, usada também
    // para `pendentes` abaixo), mas não é "magia normal já pertencente ao
    // grimório" -- ela nunca foi copiada, e empurrá-la aqui é o mesmo
    // registro de graça que a Tarefa 7 fechou na criação. Ver o docblock
    // desta função para o caminho completo do defeito.
    if (magia.personalizada) continue;
    if (!magiaMagoEstaNoGrimorio(personagem, magia.nome)) {
      personagem.grimorio.push({ ...magia });
      alterado = true;
    }
  }

  const pendentes = typeof limitePreparadas === 'number' && Number.isFinite(limitePreparadas)
    ? Math.max(0, limitePreparadas - preparadasNormais.length)
    : 0;
  return { alterado, pendentes };
}

// ============================================================
// CA alternativa ("Defesa sem Armadura" e parentes)
// ============================================================
//
// As QUATRO fontes de CA base alternativa do livro, numa TABELA -- e não
// em quatro `if` sequenciais sobre `personagem.classe`, que era a forma
// anterior. `personagem.classe` é o ESPELHO da classe INICIAL: num
// personagem multiclasse no máximo um `if` casava, e a fórmula da outra
// classe simplesmente não existia para o app. O vencedor era a ORDEM DE
// CRIAÇÃO do personagem -- com Des+3/Con+4/Sab+1/Car+5, um
// Bárbaro 5/Monge 5 dava 17 (certo, por acaso) e o MESMO personagem
// criado como Monge 5/Bárbaro 5 dava 14.
//
// O ESCUDO NÃO É UNIFORME, e a diferença é do livro, de propósito:
//   Bárbaro, Defesa sem Armadura (Classes.md:91-93): "Você pode usar um
//     Escudo e ainda receber este benefício."            -> permite
//   Monge, Defesa sem Armadura (Classes.md:5174-5176): "Enquanto você não
//     estiver vestindo armadura OU EMPUNHANDO UM ESCUDO" -> NÃO permite
//   Bardo/Colégio da Dança, Ginga Fascinante (Classes.md:724-732):
//     "não estiver vestindo armadura ou empunhando um Escudo" -> NÃO permite
//   Feiticeiro/Feitiçaria Dracônica, Resiliência Dracônica
//     (Classes.md:3072-3076): "Enquanto não estiver vestindo armadura" --
//     o livro NÃO cita Escudo aqui                       -> permite
// Essa assimetria já custou um bug: o `!escudo` do Monge faltava e foi
// corrigido no commit 12a541b, com três oráculos em
// classes-passivas.test.mjs que continuam sendo o canário desta tabela.
//
// `nivelMinimo` é o nível NAQUELA CLASSE, nunca o total: um Monge 5/Bardo 2
// não ganha a CA do Colégio da Dança, que exige 3 níveis DE BARDO.
const FONTES_CA_ALTERNATIVA = [
  { classe: 'Bárbaro', subclasse: null, nivelMinimo: 1,
    atributo: 'constituicao', permiteEscudo: true, livro: 'Classes.md:91-93' },
  { classe: 'Monge', subclasse: null, nivelMinimo: 1,
    atributo: 'sabedoria', permiteEscudo: false, livro: 'Classes.md:5174-5176' },
  { classe: 'Bardo', subclasse: 'Colégio da Dança', nivelMinimo: 3,
    atributo: 'carisma', permiteEscudo: false, livro: 'Classes.md:724-732' },
  { classe: 'Feiticeiro', subclasse: 'Feitiçaria Dracônica', nivelMinimo: 3,
    atributo: 'carisma', permiteEscudo: true, livro: 'Classes.md:3072-3076' },
];

/**
 * O COLETOR: devolve TODAS as CAs alternativas aplicáveis ao personagem
 * no estado de equipamento informado, na ordem de FONTES_CA_ALTERNATIVA.
 *
 * Função PURA -- não lê estado de módulo, não toca no DOM, não muta o
 * personagem. É ela que torna o seletor da ficha testável SEM TELA: o
 * oráculo mede a LISTA, não o HTML. A ficha usa o tamanho da lista para
 * decidir se mostra o seletor (duas ou mais candidatas) ou nada (uma só,
 * que é o caso de todo personagem de classe única).
 *
 * @param {object} personagem Personagem (ficha nova ou legada -- classesDe
 *   normaliza as duas).
 * @param {{temArmadura?: boolean, temEscudo?: boolean}} [contexto] Estado de
 *   equipamento. Ausente = sem armadura e sem escudo.
 * @returns {Array<{classe: string, subclasse: string|null, valor: number,
 *   permiteEscudo: boolean, livro: string}>} Candidatas aplicáveis.
 */
export function coletarCAsAlternativas(personagem, contexto = {}) {
  if (!personagem || typeof personagem !== 'object') return [];
  const { temArmadura = false, temEscudo = false } = contexto;
  // As QUATRO fontes exigem "não estar vestindo armadura". Com armadura
  // equipada nenhuma é candidata -- quem manda é o bloco de armadura de
  // calcCA.
  if (temArmadura) return [];

  const atributos = personagem.atributos || {};
  const modDes = calcMod(atributos.destreza);
  const lista = classesDe(personagem);
  const candidatas = [];

  for (const fonte of FONTES_CA_ALTERNATIVA) {
    if (temEscudo && !fonte.permiteEscudo) continue;
    const entrada = lista.find(c => c.classe === fonte.classe);
    if (!entrada) continue;
    // Nível 0 não existe em D&D: uma ficha que traz a classe sem nível é
    // lida como nível 1 -- a mesma convenção `personagem.nivel || 1` que
    // os gates antigos usavam, preservada para não mudar o número de
    // nenhuma ficha existente.
    const nivelClasse = entrada.nivel || 1;
    if (nivelClasse < fonte.nivelMinimo) continue;
    if (fonte.subclasse && entrada.subclasse !== fonte.subclasse) continue;
    candidatas.push({
      classe: fonte.classe,
      subclasse: fonte.subclasse,
      valor: 10 + modDes + calcMod(atributos[fonte.atributo]),
      permiteEscudo: fonte.permiteEscudo,
      livro: fonte.livro,
    });
  }
  return candidatas;
}

/**
 * O ESCOLHEDOR: decide QUAL das candidatas do coletor vale.
 *
 * Regra decidida em 2026-08-22 (docs/PERGUNTAS-PENDENTES.txt:246-257,
 * a partir de livro:2067 -- "pode se beneficiar apenas de uma de cada
 * vez", e a escolha é do jogador): o MAIOR valor por padrão, e a escolha
 * manual (`personagem.ca_alternativa_escolhida`, que guarda a CLASSE DE
 * ORIGEM) vence quando aponta para uma candidata PRESENTE na lista.
 * Empate resolve pela ordem da tabela -- determinístico, e sem efeito no
 * número, já que o valor empatado é o mesmo.
 *
 * GUARDA DE COERÊNCIA: se a escolha apontar para uma classe que o
 * personagem NÃO TEM (perdeu níveis, importou ficha editada à mão), cai
 * no maior valor e AVISA. Nunca zera a CA alternativa em silêncio --
 * cálculo silencioso com dado ausente é o modo de falha que este projeto
 * mais paga para evitar. Se a classe EXISTE mas a candidata não está na
 * lista AGORA (o Monge que equipou um escudo), o silêncio é correto: é
 * estado normal de equipamento, não dado perdido.
 *
 * @param {object} personagem
 * @param {Array<object>} candidatas Saída de coletarCAsAlternativas().
 * @returns {object|null} A candidata vencedora, ou null se não houver nenhuma.
 */
export function escolherCAAlternativa(personagem, candidatas) {
  if (!Array.isArray(candidatas) || !candidatas.length) return null;
  const escolhida = personagem?.ca_alternativa_escolhida;
  if (escolhida) {
    const manual = candidatas.find(c => c.classe === escolhida);
    if (manual) return manual;
    if (!temClasse(personagem, escolhida)) {
      console.warn(
        `escolherCAAlternativa: personagem "${personagem?.nome || '(sem nome)'}" ` +
        `tem ca_alternativa_escolhida = "${escolhida}", mas não possui essa classe. ` +
        'Usando o maior valor entre ' +
        `[${candidatas.map(c => `${c.classe} ${c.valor}`).join(', ')}].`);
    }
  }
  return candidatas.reduce((maior, c) => (c.valor > maior.valor ? c : maior));
}

/**
 * A ARMADURA e o ESCUDO equipados, do jeito que calcCA os enxerga.
 *
 * Extraído de dentro de calcCA -- sem mudar predicado nenhum -- porque a
 * ficha PRECISA montar o mesmo `{ temArmadura, temEscudo }` para chamar
 * `coletarCAsAlternativas()` e decidir se mostra o seletor de CA. Uma
 * segunda cópia dos dois `find` na tela seria a receita exata do bug do
 * commit 12a541b: um coletor chamado SEM contexto oferece a Defesa sem
 * Armadura do Monge a um Monge de escudo, que o livro exclui
 * (Classes.md:5174-5176). Com uma leitura só, tela e cálculo não têm como
 * divergir.
 *
 * @param {object} personagem
 * @returns {{armadura: object|undefined, escudo: object|undefined}}
 */
export function equipamentoDeCA(personagem) {
  const inv = personagem?.inventario || [];
  return {
    armadura: inv.find(i => i.equipado && i.tipo === 'armadura' && i.nome !== 'Escudo'),
    escudo: inv.find(i => i.equipado && (i.nome === 'Escudo' || i.tipo === 'escudo')),
  };
}

/** Calcula CA baseado na armadura equipada */
export function calcCA(personagem, passivos = null) {
  // Constituição, Sabedoria e Carisma NÃO aparecem mais aqui: os três
  // modificadores que entravam nas Defesas sem Armadura agora são lidos
  // dentro de coletarCAsAlternativas(), a partir de FONTES_CA_ALTERNATIVA.
  const modDes = calcMod(personagem.atributos.destreza);
  const inv = personagem.inventario || [];

  // Verificar armadura equipada (mesma leitura que a ficha usa para o
  // seletor de CA alternativa -- ver equipamentoDeCA, logo acima).
  const { armadura, escudo } = equipamentoDeCA(personagem);

  let ca = 10 + modDes; // Sem armadura

  // CA alternativa (Defesa sem Armadura e parentes): coletor + escolhedor.
  // As quatro fontes, as citações do livro e a assimetria do escudo estão
  // em FONTES_CA_ALTERNATIVA, logo acima desta função.
  //
  // Substituiu quatro `if` sequenciais que sobrescreviam esta mesma `ca` e
  // liam `personagem.classe` -- o espelho da classe INICIAL. Num
  // multiclasse no máximo um deles casava, e a fórmula da outra classe não
  // existia para o app.
  const caAlternativa = escolherCAAlternativa(
    personagem,
    coletarCAsAlternativas(personagem, { temArmadura: !!armadura, temEscudo: !!escudo }));
  if (caAlternativa) {
    ca = caAlternativa.valor;
  }

  if (armadura) {
    const caStr = armadura.dados?.ca || '';
    const caBase = parseInt(caStr) || 0;

    if (armadura.dados?.categoria === 'Leve') {
      ca = caBase + modDes;
    } else if (armadura.dados?.categoria === 'Média') {
      const maxDes = passivos?.bonusCAArmaduraMediaMaxDes ?? 2;
      ca = caBase + Math.min(modDes, maxDes);
    } else if (armadura.dados?.categoria === 'Pesada') {
      ca = caBase;
    } else {
      // Tentar parsear formato "XX + modificador de Des"
      const match = caStr.match(/^(\d+)/);
      if (match) {
        const base = parseInt(match[1]);
        if (caStr.includes('máx. 2') || caStr.includes('max. 2')) {
          ca = base + Math.min(modDes, 2);
        } else if (caStr.includes('Des')) {
          ca = base + modDes;
        } else {
          ca = base;
        }
      }
    }
  }

  // CA BASE de item customizado: o item que DEFINE a CA.
  //
  // O campo "Bonus CA" SOMA, e e isso que ele sempre fez. Mas o item que a
  // mesa inventa vem escrito como a armadura do livro vem ("Armadura Negra
  // de Hades /Lendaria /CA 20"): um numero que SUBSTITUI a CA. Digitado no
  // campo de bonus, virava 12 + 20 = 32.
  //
  // E PISO, e nao substituicao cega: "esta armadura da CA 20" nunca quer
  // dizer "e piora a sua CA se ela ja for maior". Nao soma Destreza -- o
  // numero digitado E a CA, como nas armaduras Pesadas. E entra AQUI, antes
  // do escudo e do Defensivo, para que tudo o que soma sobre armadura do
  // livro continue somando sobre esta tambem.
  //
  // O app nao assume que o item e armadura: nao desliga a Defesa sem
  // Armadura do Barbaro/Monge nem liga o Defensivo. Item customizado nao tem
  // tipo -- "CA 20" tanto pode ser peitoral quanto amuleto -- e o piso ja da
  // o numero certo nos dois casos.
  const caBaseCustomizado = inv
    .filter(i => i.equipado)
    .reduce((maior, i) => Math.max(maior, parseInt(i.dados?.ca_base) || 0), 0);
  if (caBaseCustomizado > ca) {
    ca = caBaseCustomizado;
  }

  // Escudo: +2
  if (escudo) {
    ca += 2;
  }

  // Estilo de Luta: Defensivo (+1 CA enquanto usa armadura)
  //
  // TODAS as entradas, e nao so a primeira: o Campeao ganha um Estilo de Luta
  // ADICIONAL no nivel 7 (Classes.md:3904), que entra ao lado do primeiro na
  // mesma lista -- e `talentos-effects.js` (getEstiloAtivo) ja lia a lista
  // inteira pelo mesmo motivo. Lendo so [0], escolher Defensivo como o estilo
  // adicional dava um estilo que aparece na ficha e nao soma CA nenhuma.
  const estilosLuta = personagem.escolhas_classe?.estilo_luta;
  const listaEstilos = Array.isArray(estilosLuta) ? estilosLuta : [estilosLuta].filter(Boolean);
  if (listaEstilos.includes('Defensivo') && armadura) {
    ca += 1;
  }

  // Bônus de CA de itens customizados
  inv.filter(i => i.equipado && i.dados?.bonus_ca).forEach(i => {
    ca += parseInt(i.dados.bonus_ca) || 0;
  });

  // Efeitos mágicos ativos que afetam CA
  const efeitos = personagem.efeitos_magicos || [];
  for (const ef of efeitos) {
    if (ef.tipo_efeito === 'bonus') {
      ca += ef.valor || 0;
    } else if (ef.tipo_efeito === 'base') {
      // CA base substitui (ex: Armadura Arcana = 13 + Des)
      const caBase = (ef.valor || 13) + modDes;
      if (caBase > ca) ca = caBase;
    } else if (ef.tipo_efeito === 'minimo') {
      // CA mínima (ex: Pele-Casca = mín 17)
      if ((ef.valor || 0) > ca) ca = ef.valor;
    }
  }

  // Bônus genérico de CA de talentos
  ca += passivos?.bonusCA || 0;

  return ca;
}

/**
 * Nome do atributo de conjuração do personagem, ou null se ele não conjura.
 *
 * A classe manda quando é conjuradora. Quando não é, a subclasse pode
 * conjurar por tabela própria (Cavaleiro Místico e Trapaceiro Arcano) --
 * e aí o atributo vem dela. `getConjuracaoSubclasse` é consultada porque a
 * conjuração dessas subclasses só começa no nível 3: abaixo disso não há
 * CD a mostrar.
 */
function atributoConjuracaoDe(personagem) {
  const info = CLASSES_INFO[personagem?.classe];
  if (info?.atributo_conjuracao) return info.atributo_conjuracao;
  if (!getConjuracaoSubclasse(personagem?.classe, personagem?.subclasse, personagem?.nivel)) return null;
  return getAtributoConjuracaoSubclasse(personagem?.classe, personagem?.subclasse);
}

/** Calcula CD de magia */
export function calcCDMagia(personagem) {
  const atributo = atributoConjuracaoDe(personagem);
  if (!atributo) return 0;
  const key = ATRIBUTO_NOME_PARA_KEY[atributo];
  const modAttr = calcMod(personagem.atributos[key]);
  let cd = 8 + bonusProficiencia(personagem.nivel) + modAttr;

  // Feiticeiro: Feitiçaria Inata ativa aumenta CD em +1
  if (personagem.classe === 'Feiticeiro' && personagem?.recursos?.feiticeiro?.feiticaria_inata_ativa) {
    cd += 1;
  }

  return cd;
}

/** Calcula bônus de ataque de magia */
export function calcAtaqueMagia(personagem) {
  const atributo = atributoConjuracaoDe(personagem);
  if (!atributo) return 0;
  const key = ATRIBUTO_NOME_PARA_KEY[atributo];
  const modAttr = calcMod(personagem.atributos[key]);
  return bonusProficiencia(personagem.nivel) + modAttr;
}

/**
 * Uma entrada por classe que conjura, cada uma com o SEU atributo de
 * conjuração, a SUA CD e o SEU bônus de ataque de magia.
 *
 * POR QUE EXISTE. O livro:2075 é explícito: "Cada magia que você prepara
 * está associada a uma de suas classes, e você usa o atributo de
 * conjuração DESSA CLASSE quando conjura a magia." `calcCDMagia` e
 * `calcAtaqueMagia` (acima) resolvem UM atributo por personagem, lendo o
 * espelho `personagem.classe` -- a classe INICIAL. Num Clérigo 5/Mago 5
 * isso mostra uma CD só, a de Sabedoria, e as magias de Mago saem com
 * ela: com Sab 16 e Int 10, três pontos acima do certo, em toda
 * conjuração. Esta função devolve as duas, para a tela mostrar as duas.
 *
 * O QUE ELA NÃO RESOLVE SOZINHA. Qual das entradas vale para uma magia
 * ESPECÍFICA: o sub-projeto "magia sabe a classe" (docs/PERGUNTAS-PENDENTES.txt)
 * acrescentou `magias_preparadas[].classe` e resolve isso para toda entrada
 * CARIMBADA (via `preparadasPorClasse`, regras-magia-classe.js); para as
 * entradas sem carimbo -- estado permanente, não fase de transição -- a
 * pergunta continua indeterminada, e o jogador lê a caixa da classe certa,
 * que é o que uma ficha de papel também exige dele.
 *
 * Bônus de proficiência é do nível TOTAL nas duas colunas, por regra
 * (livro:2047) -- o que varia entre as entradas é só o modificador de
 * atributo, e o +1 de Feitiçaria Inata, que vale apenas nas magias de
 * Feiticeiro.
 *
 * Subclasse conjuradora (Cavaleiro Místico, Trapaceiro Arcano) entra
 * pelo nível NAQUELA classe, não pelo total: um Mago 5/Guerreiro 2 não
 * tem conjuração de Cavaleiro Místico, que só começa no 3º nível de
 * Guerreiro -- ler o total daria conjuração a quem não a tem.
 *
 * @param {object} personagem Personagem; lê classes[], nunca os espelhos.
 * @returns {Array<{classe: string, subclasse: string|null,
 *   atributo: string, cd: number, ataque: number}>} vazio se não conjura.
 */
export function conjuracoesPorClasse(personagem) {
  const prof = bonusProficiencia(personagem?.nivel);
  const saida = [];
  for (const c of classesDe(personagem)) {
    let atributo = CLASSES_INFO[c.classe]?.atributo_conjuracao || null;
    if (!atributo && getConjuracaoSubclasse(c.classe, c.subclasse, c.nivel)) {
      atributo = getAtributoConjuracaoSubclasse(c.classe, c.subclasse);
    }
    if (!atributo) continue;
    const modAttr = calcMod(personagem?.atributos?.[ATRIBUTO_NOME_PARA_KEY[atributo]]);
    // Feitiçaria Inata sobe a CD em +1 só das magias de FEITICEIRO
    // (Classes.md, característica de nível 7). Antes isto era
    // `personagem.classe === 'Feiticeiro'`, o espelho: num
    // Feiticeiro/Mago o +1 vazava para a CD do Mago, e num
    // Mago/Feiticeiro não chegava à do Feiticeiro.
    const inata = c.classe === 'Feiticeiro'
      && !!personagem?.recursos?.feiticeiro?.feiticaria_inata_ativa;
    saida.push({
      classe: c.classe,
      subclasse: c.subclasse || null,
      atributo,
      cd: 8 + prof + modAttr + (inata ? 1 : 0),
      ataque: prof + modAttr,
    });
  }
  return saida;
}

/** Calcula Percepção Passiva */
export function calcPercepcaoPassiva(personagem) {
  const modSab = calcMod(personagem.atributos.sabedoria);
  const prof = (personagem.pericias_proficientes || []).includes('Percepção');
  const exp = (personagem.pericias_expertise || []).includes('Percepção');
  let bonus = modSab;
  if (prof) bonus += bonusProficiencia(personagem.nivel);
  if (exp) bonus += bonusProficiencia(personagem.nivel);
  if (personagem.classe === 'Bardo' && (personagem.nivel || 1) >= 2 && !prof && !exp) {
    bonus += Math.floor(bonusProficiencia(personagem.nivel) / 2);
  }
  return 10 + bonus;
}

/** Calcula Intuicao Passiva (10 + bonus pericia Intuicao) */
export function calcIntuicaoPassiva(personagem) {
  return 10 + calcBonusPericia(personagem, 'Intuição');
}

/** Calcula Investigacao Passiva (10 + bonus pericia Investigacao) */
export function calcInvestigacaoPassiva(personagem) {
  return 10 + calcBonusPericia(personagem, 'Investigação');
}

/** Calcula bônus de uma perícia */
export function calcBonusPericia(personagem, nomePericia, opcoes = {}) {
  const pericia = PERICIAS.find(p => p.nome === nomePericia);
  if (!pericia) return 0;

  const emFuria = !!opcoes.emFuria;
  const forcaPrimordialAtiva = !!opcoes.forcaPrimordialAtiva;
  const periciasConhecimentoPrimordial = ['Acrobacia', 'Furtividade', 'Intimidação', 'Percepção', 'Sobrevivência'];

  const usarForcaPrimordial = emFuria && forcaPrimordialAtiva && periciasConhecimentoPrimordial.includes(nomePericia);
  const key = usarForcaPrimordial ? 'forca' : ATRIBUTO_NOME_PARA_KEY[pericia.atributo];
  const mod = calcMod(personagem.atributos[key]);
  const prof = (personagem.pericias_proficientes || []).includes(nomePericia);
  const exp = (personagem.pericias_expertise || []).includes(nomePericia);
  let bonus = mod;
  if (prof) bonus += bonusProficiencia(personagem.nivel);
  if (exp) bonus += bonusProficiencia(personagem.nivel);
  // Bardo: Pau pra Toda Obra (metade da proficiência em perícias sem proficiência)
  if (personagem.classe === 'Bardo' && (personagem.nivel || 1) >= 2 && !prof && !exp) {
    bonus += Math.floor(bonusProficiencia(personagem.nivel) / 2);
  }

  // Clérigo (Ordem Divina: Taumaturgo) - bônus em Arcanismo e Religião
  if (
    personagem.classe === 'Clérigo' &&
    personagem.ordem_divina === 'Taumaturgo' &&
    (nomePericia === 'Arcanismo' || nomePericia === 'Religião')
  ) {
    bonus += Math.max(1, calcMod(personagem.atributos.sabedoria));
  }

  // Druida (Ordem Primal: Xamã) - bônus em Arcanismo e Natureza
  const ordemPrimal = personagem.ordem_primal || personagem.escolhas_classe?.ordem_primal?.[0] || '';
  if (
    personagem.classe === 'Druida' &&
    ordemPrimal === 'Xamã' &&
    (nomePericia === 'Arcanismo' || nomePericia === 'Natureza')
  ) {
    bonus += Math.max(1, calcMod(personagem.atributos.sabedoria));
  }

  // Efeitos magicos: bonus numerico de pericia (ex: Passo Sem Rastro +10 Furtividade)
  const efMag = personagem.efeitos_magicos || [];
  for (const ef of efMag) {
    if (ef.tipo === 'bonus_pericia' && typeof ef.bonus === 'number' && ef.pericia === nomePericia) {
      bonus += ef.bonus;
    }
  }

  return bonus;
}

/** Calcula espaços de magia com base na tabela da classe */
export function getEspacosMagia(tabelaCaracteristicas, nivel) {
  if (!tabelaCaracteristicas || nivel < 1) return {};
  const row = tabelaCaracteristicas.find(r => parseInt(r['Nível']) === nivel);
  if (!row) return {};
  const espacos = {};
  for (let i = 1; i <= 9; i++) {
    const val = row[String(i)];
    if (val && val !== '—' && val !== '-') {
      espacos[i] = { total: parseInt(val) || 0, usados: 0 };
    }
  }
  return espacos;
}

/** Quantidade de truques por nível (da tabela da classe) */
export function getTruquesConhecidos(tabelaCaracteristicas, nivel) {
  if (!tabelaCaracteristicas) return 0;
  const row = tabelaCaracteristicas.find(r => parseInt(r['Nível']) === nivel);
  return row ? (parseInt(row['Truques']) || 0) : 0;
}

/**
 * Bônus de truques conhecidos concedido por escolha de classe (fora da
 * tabela): Ordem Divina "Taumaturgo" do Clérigo e Ordem Primal "Xamã" do
 * Druida dão +1 truque de classe (Classes.md:1568/2060). Fica FORA de
 * getTruquesConhecidos de propósito -- essa função é confrontada direto
 * contra a tabela do livro pelo motor de testes de classes/níveis e precisa
 * continuar refletindo só a tabela, sem bônus nenhum somado.
 *
 * Único lugar que decide o bônus, para os dois fluxos que precisam do total
 * (criador em creator/passo-magias.js e creator/wizard.js; ficha em
 * sheet/grimorio.js e sheet/magias.js; subida de nível em levelup-flow.js)
 * chamarem em vez de repetir a checagem `classe === 'Clérigo' && ordem_divina
 * === 'Taumaturgo'` em cada arquivo -- foi exatamente essa cópia manual,
 * faltando em 3 dos 5 fluxos, que deixava a ficha de um Taumaturgo/Xamã
 * recém-criado exibir "Truques: 4/3" (ver GUIA-PROXIMOS-DOMINIOS.md, "A
 * lição da rodada de correção").
 *
 * Aceita tanto o objeto do criador (`personagem`) quanto o da ficha (`char`)
 * -- os dois gravam a ordem escolhida do mesmo jeito, direto no campo
 * (ordem_divina/ordem_primal) ou em escolhas_classe.
 *
 * `nomeClasse` (Tarefa 3, sub-projeto "tela magias por classe"): a classe a
 * CONFRONTAR contra Clérigo/Druida, separada de `personagem` para os dois
 * chamadores da FICHA (sheet/grimorio.js, sheet/magias.js) poderem passar a
 * classe da SUPERFÍCIE de conjuração ativa (`sup.classe`) em vez do espelho
 * `personagem.classe` -- um Ladino 5/Clérigo 1 Taumaturgo não ganha o bônus
 * se a checagem só souber perguntar pela classe INICIAL. Sem argumento,
 * cai em `personagem?.classe` -- o mesmo comportamento de antes, exatamente
 * o que os dois chamadores do criador (creator/passo-magias.js,
 * creator/wizard.js, personagem de UMA classe só) e o de levelup-flow.js
 * (documentadamente um no-op ali, ordem_divina/ordem_primal não muda dentro
 * de uma mesma subida) continuam recebendo.
 */
export function getBonusTruquesOrdem(personagem, nomeClasse = personagem?.classe) {
  if (!personagem) return 0;
  const ordemDivina = personagem.ordem_divina || personagem.escolhas_classe?.ordem_divina?.[0] || '';
  if (nomeClasse === 'Clérigo' && ordemDivina === 'Taumaturgo') return 1;
  const ordemPrimal = personagem.ordem_primal || personagem.escolhas_classe?.ordem_primal?.[0] || '';
  if (nomeClasse === 'Druida' && ordemPrimal === 'Xamã') return 1;
  return 0;
}

/** Magias preparadas por nível (da tabela da classe) */
export function getMagiaPreparadas(tabelaCaracteristicas, nivel) {
  if (!tabelaCaracteristicas) return 0;
  const row = tabelaCaracteristicas.find(r => parseInt(r['Nível']) === nivel);
  return row ? (parseInt(row['Magias Preparadas']) || 0) : 0;
}

/**
 * Limites de truques e de magias preparadas/conhecidas, considerando as
 * subclasses conjuradoras.
 *
 * Existe porque Guerreiro e Ladino TÊM tabela de características, mas sem
 * colunas de magia: `getTruquesConhecidos`/`getMagiaPreparadas` devolvem 0
 * para eles, e um fallback do tipo "se veio 0 é porque não há tabela"
 * precisa ser escrito igual em todos os lugares que mostram o limite. Ele
 * NÃO estava: a seção Magias da ficha caía para a tabela da subclasse
 * quando o valor era 0, mas o modal "Consultar Magias" só caía quando não
 * havia tabela nenhuma -- o Trapaceiro Arcano via "Truques: 0/0" lá e a
 * grade inteira de magias aparecia bloqueada.
 *
 * @param {Array} tabelaCaracteristicas - Tabela da classe (pode ser nula)
 * @param {number} nivel - Nível do personagem
 * @param {Object|null} conjSubclasse - Tabela da subclasse conjuradora
 *   ({ truques, preparadas }), ou null quando não há
 */
export function getLimitesMagias(tabelaCaracteristicas, nivel, conjSubclasse = null) {
  const truquesTabela = getTruquesConhecidos(tabelaCaracteristicas, nivel);
  const preparadasTabela = getMagiaPreparadas(tabelaCaracteristicas, nivel);
  return {
    truques: truquesTabela || conjSubclasse?.truques || 0,
    preparadas: preparadasTabela || conjSubclasse?.preparadas || 0
  };
}

/** Deslocamento padrão da espécie (extraído do texto_completo) */
export function getDeslocamento(especieTexto) {
  if (!especieTexto) return '9 metros';
  const textoLimpo = especieTexto.replace(/\*\*/g, '');
  const match = textoLimpo.match(/Deslocamento:\s*(\d+(?:[\.,]\d+)?\s*metros?)/i);
  return match ? match[1].trim() : '9 metros';
}

/** Tamanho da espécie */
export function getTamanho(especieTexto) {
  if (!especieTexto) return 'Médio';
  const textoLimpo = especieTexto.replace(/\*\*/g, '');
  const match = textoLimpo.match(/Tamanho:\s*([^\n]+)/i);
  if (!match) return 'Médio';
  const linha = match[1].trim();

  if (/Médio\s*\(.+?\)\s*ou\s*Pequeno|Pequeno\s*\(.+?\)\s*ou\s*Médio/i.test(linha)) {
    return 'Médio ou Pequeno';
  }

  const tamanhoBase = linha.match(/\b(Pequeno|Médio|Grande)\b/i);
  return tamanhoBase ? tamanhoBase[1] : 'Médio';
}

// --- Renderizador simples de Markdown ---

/** Formata notação de dados (ex: 3d6, 2D8) como 🎲3d6🎲 */
export function formatarDados(texto) {
  if (!texto) return texto;
  return texto.replace(/(\d+)[dD](\d+)/g, '🎲$1d$2🎲');
}

/** Converte markdown básico para HTML */
export function mdParaHtml(texto) {
  if (!texto) return '';
  let html = texto
    // Escapar HTML
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    // Formatar dados (🎲XdY🎲) antes de outras transformações
    .replace(/(\d+)[dD](\d+)/g, '🎲$1d$2🎲')
    // Headers
    .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    // Negrito e itálico
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Listas
    .replace(/^[-•]\s+(.+)$/gm, '<li>$1</li>')
    // Tabelas simples (pipes)
    .replace(/\|(.+)\|/g, (match) => {
      const cells = match.split('|').filter(c => c.trim());
      if (cells.every(c => /^[\s-:]+$/.test(c))) return ''; // Separador
      const tag = cells.some(c => /^\*\*.+\*\*$/.test(c.trim())) ? 'th' : 'td';
      return '<tr>' + cells.map(c => `<${tag}>${c.trim().replace(/\*\*/g, '')}</${tag}>`).join('') + '</tr>';
    });

  // Agrupar <li> em <ul>
  html = html.replace(/((?:<li>.+<\/li>\n?)+)/g, '<ul>$1</ul>');
  // Agrupar <tr> em <table>
  html = html.replace(/((?:<tr>.+<\/tr>\n?)+)/g, '<div class="table-wrapper"><table>$1</table></div>');

  // Parágrafos (linhas que não são tags)
  html = html.split('\n').map(line => {
    const trimmed = line.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('<')) return trimmed;
    return `<p>${trimmed}</p>`;
  }).join('\n');

  return html;
}

// --- Helpers gerais ---

/**
 * Detecta tipo de recarga de uma habilidade pela descrição.
 * Retorna 'curto', 'longo', 'curto_ou_longo' ou null (passiva).
 */
export function detectarRecarga(descricao) {
  if (!descricao) return null;
  const d = descricao.toLowerCase();
  // Só valem as frases em que o Descanso está preso a um USO -- restaurar,
  // recuperar, voltar a poder usar, esgotar. Sem esse escopo, uma cláusula
  // alheia no mesmo texto vira recarga: o Mapa Estelar (Círculo das
  // Estrelas) tem um parágrafo sobre recriar o mapa perdido "durante um
  // Descanso Curto ou Longo", que se fundia com a recarga real de Raio Guia
  // (Descanso Longo) e produzia o selo "☀🌙 Curto/Longo" no lugar de
  // "🌙 Desc. Longo". E a Maestria em Arma, cuja cláusula de Descanso Longo
  // é a TROCA de uma escolha permanente, ganhava selo de recarga sem nunca
  // se esgotar.
  const doUso = d.split(/(?<=\.)\s+/)
    .filter((f) => f.includes('descanso') && /restaur|recuper|novamente|usos? gastos?|esgotad/.test(f))
    .join(' ');
  if (!doUso) return null;
  if (doUso.includes('descanso curto ou longo') || doUso.includes('descanso longo ou curto'))
    return 'curto_ou_longo';
  const temCurto = doUso.includes('descanso curto');
  const temLongo = doUso.includes('descanso longo');
  if (temCurto && temLongo) return 'curto_ou_longo';
  if (temCurto) return 'curto';
  if (temLongo) return 'longo';
  return null;
}

// Frases com que o livro declara que o benefício custa uma ECONOMIA DE
// AÇÃO do turno. A lista é de FORMAS do livro, não de sinônimos
// inventados: cada entrada saiu de uma característica real.
const _FRASES_ACAO = [
  'como uma ação', 'como ação bônus', 'como uma ação bônus',
  'como parte da ação bônus', 'como parte de uma ação bônus',
  'executar a ação bônus',
  'como uma reação', 'executar uma reação', 'realizar uma reação',
];

// Custo pago em DADOS do próprio dano, forma exclusiva do Ladino
// (Golpe Astuto "cada um com um custo em dados", Golpe Astuto Aprimorado
// "pagando o custo do dado", Golpes Sujos "**Aturdir (Custo: 2d6)**").
const _FRASES_CUSTO_DADOS = ['custo em dados', 'custo do dado', 'custo:'];

/**
 * Uso que se ESGOTA e volta num descanso -- custo real, porque o jogador
 * gasta um dos N usos. É o que separa Surto de Ação (ativa) de Maestria em
 * Arma (passiva): a cláusula de Descanso da Maestria fala em ALTERAR uma
 * escolha permanente, nunca em uso gasto.
 *
 * A checagem é por FRASE, não por ordem das palavras: o livro escreve tanto
 * "não pode usá-la novamente até completar um Descanso Curto ou Longo"
 * (Surto de Ação) quanto "completar um Descanso Longo antes de poder usar
 * esta característica novamente" (Marés do Caos, Feitiçaria Selvagem). Uma
 * regex de ordem fixa perdia a segunda forma.
 *
 * "usos gastos" sozinho não basta -- Inspiração Superior do Bardo diz "Ao
 * jogar Iniciativa, recupera usos gastos de Inspiração de Bardo", que é
 * restauração automática, não custo. Por isso a frase precisa falar também
 * em descanso.
 */
function _temUsoEsgotavel(descricaoMinuscula) {
  const frases = descricaoMinuscula.split(/(?<=\.)\s+/);
  // A frase de esgotamento tem de falar da PRÓPRIA característica. Sem isso,
  // Intervenção Divina Maior do Clérigo ("não pode usar Intervenção Divina
  // novamente até completar 2d4 Descansos Longos") entraria como ativa -- mas
  // ela só modifica o custo de OUTRA característica, não tem ativação própria.
  const seRefereASiMesma = (f) =>
    /\w+[áâêé]-l[ao]s?\b/.test(f)
    || /\b(esta|essa) característica\b/.test(f)
    || /\b(desta|dessa) forma\b/.test(f)
    || /\b(deste|desse) modo\b/.test(f);
  if (frases.some((f) => f.includes('novamente') && f.includes('descanso') && seRefereASiMesma(f))) return true;
  if (frases.some((f) => /usos?\s+gastos?/.test(f) && f.includes('descanso'))) return true;
  // "restaura a capacidade de fazê-lo" (Montaria Fiel), "recuperando a
  // capacidade de conjurá-la" (Companheiro Dracônico) -- mesma ideia.
  if (/(restaura|recupera|recuperando)[^.]{0,40}a capacidade/.test(descricaoMinuscula)) return true;
  return descricaoMinuscula.includes('antes de um descanso');
}

/**
 * Custo em recurso nomeado (espaço de magia, Pontos de Feitiçaria, Pontos
 * de Vida da reserva). Quando o texto diz "sem gastar"/"sem consumir", o
 * benefício da característica é justamente ser DE GRAÇA -- qualquer verbo de
 * gasto no resto do texto descreve a alternativa, não ela. É o caso de
 * Maestria de Magias do Mago ("pode conjurá-las... sem gastar um espaço de
 * magia. Para conjurar... em um círculo superior, você DEVE GASTAR um espaço"),
 * de Apoteose Arcana do Feiticeiro e de Destruição do Paladino. As que ainda
 * assim custam algo chegam a `true` pelo uso esgotável, não por aqui.
 */
function _temCustoEmRecurso(descricaoMinuscula) {
  if (/sem\s+(gastar|consumir)/.test(descricaoMinuscula)) return false;
  return /\b(gastar|gasta|consumindo|consumir)\b/.test(descricaoMinuscula);
}

/**
 * O texto declara uma DECISÃO do jogador? "não pode" é o oposto disso -- é
 * o limite de uso --, então some antes da busca. É o que separa Surto de
 * Ação do Guerreiro ("No seu turno, você pode executar uma ação adicional")
 * de Sentinela Imortal do Paladino, cujo único "pode" está em "você não
 * pode utilizá-la novamente": a segunda dispara sozinha ao ser reduzido a 0
 * Pontos de Vida, sem escolha nenhuma. As duas têm uso limitado que
 * recarrega em Descanso Longo -- só o verbo de decisão as distingue.
 */
function _temVerboDeDecisao(descricaoMinuscula) {
  const semNegacao = descricaoMinuscula.replace(/n[ãa]o\s+(pode|podendo|poder)/g, ' ');
  return /\bpode\b|\bescolh/.test(semNegacao);
}

/**
 * Decide se uma característica é ATIVA (o jogador paga algo para usá-la)
 * ou PASSIVA (o benefício simplesmente vale). O critério é CUSTO
 * DECLARADO: economia de ação do turno, recurso nomeado, custo em dados,
 * ou um uso que se esgota e volta num descanso.
 *
 * NÃO usa `detectarRecarga`: recarga, sozinha, não é prova de ativação.
 * Sentinela Imortal (Paladino, Juramento dos Anciões) recarrega em Descanso
 * Longo e mesmo assim dispara sozinha, sem decisão nenhuma do jogador -- o
 * curto-circuito `if (recarga) return true` a classificava como ativa, e
 * junto as seis "Maestria em Arma"/"Maestria de Magias", cuja cláusula de
 * Descanso Longo é a TROCA de uma escolha permanente, não uso gasto.
 *
 * NÃO usa 'no seu turno' nem 'você pode usar' como gatilho: a primeira
 * qualifica QUANDO um benefício passivo vale ("sempre que executar a ação
 * Atacar no seu turno" -- Ataque Extra em cinco classes), a segunda casa
 * cláusulas SECUNDÁRIAS ("Você pode usar um Escudo e ainda receber este
 * benefício" -- Defesa sem Armadura), nunca a frase que define o benefício.
 */
export function ehHabilidadeAtiva(descricao, nome) {
  if (!descricao) return false;
  // Habilidades que sao descritivas por natureza (listas de magias, conjuracao), nao importa o conteudo
  if (nome) {
    const n = nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (n.includes('conjuracao') || n.includes('pacto magico') || n.includes('magia de pacto') || n.startsWith('magias d')) return false;
  }
  const d = descricao.toLowerCase();
  return _FRASES_ACAO.some(f => d.includes(f))
    || _FRASES_CUSTO_DADOS.some(f => d.includes(f))
    || (_temUsoEsgotavel(d) && _temVerboDeDecisao(d))
    || _temCustoEmRecurso(d);
}

/** Gera UUID v4 simples */
export function gerarId() {
  return 'xxxx-xxxx-xxxx'.replace(/x/g, () =>
    Math.floor(Math.random() * 16).toString(16)
  );
}

const _ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
/**
 * Escapa caracteres HTML especiais para prevenir XSS em innerHTML.
 * Nao adequado para contextos de atributos de evento ou URLs.
 * @param {*} str - Valor a escapar (null/undefined retorna '').
 * @returns {string} String com &, <, >, ", ' escapados.
 */
export function escHtml(str) {
  if (str == null) return '';
  return String(str).replace(/[&<>"']/g, c => _ESC_MAP[c]);
}

/** Formata data para exibição */
export function fmtData(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Mostra toast de notificação */
export function toast(msg, tipo = '') {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${tipo}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

/** Debounce simples */
export function debounce(fn, ms = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/** Remove acentos para busca */
export function semAcento(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/** Contador de sub-modais ativos */
let _subModalCount = 0;
/** Callback opcional ao fechar o modal principal */
let _onModalClose = null;

/** Abre modal global. onClose é chamado quando o modal principal é fechado. */
export function abrirModal(titulo, corpoHtml, acoesHtml = '', onClose = null) {
  const overlay = document.getElementById('modal-overlay');
  const tituloEl = document.getElementById('modal-titulo');
  const corpoEl = document.getElementById('modal-corpo');
  const acoesEl = document.getElementById('modal-acoes');

  // Se ja existe modal aberto, abrir como sub-modal (overlay empilhado)
  if (overlay.style.display === 'flex') {
    _subModalCount++;
    const sub = document.createElement('div');
    sub.className = 'modal-overlay sub-modal-overlay';
    sub.id = `sub-modal-overlay-${_subModalCount}`;
    sub.style.display = 'flex';
    sub.style.zIndex = 200 + _subModalCount;
    sub.innerHTML = `
      <div class="modal-container" style="animation:slideUp 0.2s">
        <div class="modal-header" style="position:sticky;top:0;background:var(--bg-card);z-index:1">
          <h2 style="font-size:1rem;font-weight:700">${escHtml(titulo)}</h2>
          <button class="modal-fechar" data-fechar-sub="true">&times;</button>
        </div>
        <div class="modal-corpo" style="padding:16px">${corpoHtml}</div>
        ${acoesHtml ? `<div class="modal-acoes" style="padding:12px 16px;display:flex;gap:8px;justify-content:flex-end;border-top:1px solid var(--border-light);position:sticky;bottom:0;background:var(--bg-card);z-index:1">${acoesHtml}</div>` : ''}
      </div>
    `;
    document.body.appendChild(sub);
    // Fechar sub-modal ao clicar fora ou no X
    sub.addEventListener('click', (e) => {
      if (e.target === sub || e.target.closest('[data-fechar-sub]')) {
        sub.remove();
        _subModalCount--;
      }
    });
    // Substituir onclick="fecharModal()" nos botões do sub-modal
    sub.querySelectorAll('[onclick*="fecharModal"]').forEach(btn => {
      btn.removeAttribute('onclick');
      btn.addEventListener('click', () => { sub.remove(); _subModalCount--; });
    });
    return;
  }

  tituloEl.textContent = titulo;
  corpoEl.innerHTML = corpoHtml;
  acoesEl.innerHTML = acoesHtml;
  overlay.style.display = 'flex';
  _onModalClose = onClose;
  document.getElementById('modal-container').scrollTop = 0;
}

/** Fecha modal global */
export function fecharModal() {
  // Se existem sub-modais, fechar o mais recente
  if (_subModalCount > 0) {
    const sub = document.getElementById(`sub-modal-overlay-${_subModalCount}`);
    if (sub) sub.remove();
    _subModalCount--;
    return;
  }
  document.getElementById('modal-overlay').style.display = 'none';
  if (_onModalClose) { const cb = _onModalClose; _onModalClose = null; cb(); }
}

/** Fecha todos os modais (principal + sub-modais) */
export function fecharModalTodos() {
  // Remover todos sub-modais
  document.querySelectorAll('.sub-modal-overlay').forEach(el => el.remove());
  _subModalCount = 0;
  document.getElementById('modal-overlay').style.display = 'none';
  if (_onModalClose) { const cb = _onModalClose; _onModalClose = null; cb(); }
}
// Expor para onclick inline
window.fecharModal = fecharModal;
window.fecharModalTodos = fecharModalTodos;

/** Extrai número base de uma string de CA (ex: "14 + Modificador de Des (máx. 2)" -> 14) */
export function parsearCA(caStr) {
  if (!caStr) return 10;
  const match = caStr.match(/^[+]?(\d+)/);
  return match ? parseInt(match[1]) : 10;
}

/**
 * Lê um arquivo de imagem, redimensiona (mantendo proporção, máximo maxDim
 * em qualquer lado) e retorna como data URL JPEG comprimido — pequeno o
 * bastante pra guardar direto no objeto do personagem (localStorage + sync
 * na nuvem) sem estourar limite de tamanho.
 * @param {File} file - arquivo escolhido pelo usuário (input type=file)
 * @param {number} maxDim - dimensão máxima em pixels (largura ou altura)
 * @returns {Promise<string|null>} data URL da imagem redimensionada, ou null se inválido
 */
export function processarImagemArquivo(file, maxDim = 300) {
  return new Promise((resolve) => {
    if (!file || !file.type || !file.type.startsWith('image/')) {
      resolve(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round(height * (maxDim / width));
            width = maxDim;
          } else {
            width = Math.round(width * (maxDim / height));
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = () => resolve(null);
      img.src = ev.target.result;
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

/** Converte string de peso ("0,5 kg", "250 g", "1 kg (saco)", "—", "Varia") em kg (number). */
export function parsePeso(pesoStr) {
  if (pesoStr == null) return 0;
  const txt = String(pesoStr).trim();
  if (!txt || txt === '—' || txt === '-' || /varia/i.test(txt)) return 0;
  // "kg" tem prioridade sobre "g" para não casar o 'g' de 'kg'
  const mkg = txt.match(/(\d+(?:[.,]\d+)?)\s*kg/i);
  if (mkg) return parseFloat(mkg[1].replace(',', '.'));
  const mg = txt.match(/(\d+(?:[.,]\d+)?)\s*g\b/i);
  if (mg) return parseFloat(mg[1].replace(',', '.')) / 1000;
  const m = txt.match(/(\d+(?:[.,]\d+)?)/);
  return m ? parseFloat(m[1].replace(',', '.')) : 0;
}

/** Formata kg com vírgula decimal (ex: 3.5 -> "3,5"). */
export function fmtPeso(kg) {
  const n = Math.round((Number(kg) || 0) * 100) / 100;
  return n.toString().replace('.', ',');
}

/** Multiplicador de capacidade de carregar por tamanho de criatura. */
export function getMultiplicadorCarga(tamanho) {
  const t = String(tamanho || 'Médio').trim();
  const mult = {
    'Minúsculo': 3.5, 'Pequeno': 7, 'Médio': 7,
    'Grande': 13.5, 'Enorme': 27, 'Colossal': 54.5
  };
  if (mult[t] != null) return mult[t];
  // "Médio ou Pequeno" e variações
  if (/Grande/i.test(t)) return 13.5;
  if (/Pequeno|Médio/i.test(t)) return 7;
  return 7;
}

/** Capacidade de carregar em kg: Força (valor) × multiplicador de tamanho. */
export function getCapacidadeCarga(forca, tamanho) {
  const f = parseInt(forca) || 0;
  return f * getMultiplicadorCarga(tamanho);
}

/** Descrição do cálculo real da capacidade (ex: "Força 15 × 7 (Pequeno) = 105 kg"). */
export function descreverCapacidadeCarga(forca, tamanho) {
  const f = parseInt(forca) || 0;
  const mult = getMultiplicadorCarga(tamanho);
  const total = f * mult;
  // O retorno SEMPRE vai para innerHTML (os tres chamadores, no passo de
  // detalhes do criador). A forca ja sai saneada por parseInt, mas o
  // tamanho vinha do valor de um <select> -- texto do DOM -- e entrava
  // cru. Trocado por um rotulo tirado desta lista fechada: o que sai daqui
  // e sempre uma das seis strings escritas neste arquivo, nunca o que
  // chegou. Alerta #7 do CodeQL (js/xss-through-dom), cujo caminho
  // terminava exatamente nesta interpolacao.
  return `Força ${f} × ${fmtPeso(mult)} (${rotuloDeTamanho(tamanho)}) = ${fmtPeso(total)} kg`;
}

/**
 * Devolve o nome canonico do tamanho, escolhido numa lista fechada.
 *
 * Qualquer coisa fora da lista vira 'Médio' -- inclusive as variacoes do
 * livro como "Médio ou Pequeno", que aqui interessam so pelo rotulo.
 * @param {string} tamanho - Texto de origem, possivelmente de fora do app
 */
export function rotuloDeTamanho(tamanho) {
  const CANONICOS = ['Minúsculo', 'Pequeno', 'Médio', 'Grande', 'Enorme', 'Colossal'];
  const t = String(tamanho || '').trim();
  return CANONICOS.includes(t) ? t : 'Médio';
}

/** Peso total do inventário em kg (peso × quantidade; ignora itens com qtd <= 0). */
export function getPesoTotalInventario(inventario) {
  if (!Array.isArray(inventario)) return 0;
  return inventario.reduce((total, item) => {
    const qtd = item.quantidade ?? 1;
    if (qtd <= 0) return total;
    const peso = parsePeso(item.dados?.peso ?? item.peso);
    return total + peso * qtd;
  }, 0);
}
