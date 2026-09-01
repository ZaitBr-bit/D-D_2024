// ============================================================
// Escolhas e concessões que uma característica de SUBCLASSE cria na subida
// de nível.
//
// Antes desta tabela, levelup.js reconhecia 15 tipos de pendência escritos
// um a um, e nenhum deles cobria estas 17 características -- o jogador
// terminava o nível sem aviso nenhum, e a regra do livro simplesmente não
// era aplicada em caminho nenhum do app. Escrever mais 12 ramos à mão
// repetiria o defeito; a tabela existe para que a próxima característica
// seja uma LINHA, não um ramo.
//
// Mesmo padrão declarativo de REGRAS_TALENTOS (regras-cobertura.js).
//
// NÃO entram aqui: as escolhas EM JOGO (alvo, direção, tipo de dano na hora
// do uso), as cosméticas, e as que já têm mecanismo próprio no app
// (Superioridade em Combate, Conjuração de Cavaleiro Místico/Trapaceiro
// Arcano, os quatro "Versado em ..." do Mago).
// ============================================================
import { PERICIAS_TODAS, FERRAMENTAS_ARTESAO } from './regras-cobertura.js';
// getMagiasClasse: a MESMA função que o fluxo de Iniciado em Magia e o
// truque substituto do Telecinético já usam para ler `lista_magias` de uma
// classe. As Descobertas Mágicas (Colégio do Conhecimento nv6) escolhem das
// listas de Clérigo, Druida e Mago, que só existem em dados/classes/ --
// por isso esta tabela, que é de regra, precisa de um carregador.
import { getMagiasClasse } from './db.js';

// Nomes canônicos dos dez Estilos de Luta (Classes.md:3798-3810). Ficam AQUI,
// na camada de regra, e não em levelup-cards.js: aquele módulo toca `window`
// no topo, e importá-lo daqui arrastaria uma dependência de navegador para
// dentro de levelup.js. A lista de lá (OPCOES_ESTILO_LUTA_BASE) guarda as
// DESCRIÇÕES, que são de tela; as duas são confrontadas entre si por
// `testes/regras/unidade/estilos-luta-coerencia.test.mjs`, para não
// divergirem em silêncio.
export const ESTILOS_LUTA_CANONICOS = [
  'Arquearia', 'Combate com Armas de Arremesso', 'Combate com Armas Grandes',
  'Combate com Duas Armas', 'Combate Desarmado', 'Defensivo',
  'Duelismo', 'Interceptação', 'Luta às Cegas', 'Protetivo',
];

// Listas literais do livro. Cada uma cita a passagem de onde saiu -- nenhuma
// opção é inventada nem adivinhada a partir do nome da característica.
const TIPOS_DANO_DRACONICO = ['Ácido', 'Elétrico', 'Gélido', 'Ígneo', 'Venenoso']; // Classes.md:3080
const ASPECTOS_SELVAGENS = ['Coruja', 'Pantera', 'Salmão'];                          // Classes.md:267
const PRESAS_CACADOR = ['Assassino de Colossos', 'Destruidor de Hordas'];            // Classes.md:3543
const TATICAS_DEFENSIVAS = ['Defesa Contra Ataques Múltiplos', 'Escapar de Hordas']; // Classes.md:3551
const COMPANHEIROS_PRIMAIS = ['Fera da Terra', 'Fera do Céu', 'Fera do Mar'];        // Classes.md:3573
const TERRENOS_CIRCULO_TERRA = ['Árido', 'Polar', 'Temperado', 'Tropical'];          // Classes.md:2406
const PERICIAS_GLAMOUR = ['Atuação', 'Enganação', 'Persuasão'];                      // Classes.md:3480

export const ESCOLHAS_SUBCLASSE_APP = [
  // ---------- Concessões automáticas: o livro concede sem perguntar ----------
  // O app corretamente NÃO pergunta nada aqui -- mas também nunca concedia.
  { subclasse: 'Colégio da Bravura', nivel: 3, caracteristica: 'Treinamento Marcial',
    livro: 'Classes.md:700',
    // "proficiência com armas Marciais, armaduras Médias e treinamento com
    // Escudos". `proficiencias_extra` é o campo que a ficha lê para mesclar
    // com as proficiências base da classe (sheet/ficha.js:579-590).
    automatica: { extras: ['Armas Marciais', 'Armadura Média', 'Escudo'] } },
  { subclasse: 'Combatente da Misericórdia', nivel: 3, caracteristica: 'Implementos de Misericórdia',
    livro: 'Classes.md:5330',
    // "proficiência nas perícias Intuição e Medicina e proficiência com o
    // Kit de Herbalismo".
    automatica: { pericias: ['Intuição', 'Medicina'], ferramentas: ['Kit de Herbalismo'] } },
  { subclasse: 'Assassino', nivel: 3, caracteristica: 'Ferramentas de Assassino',
    livro: 'Classes.md:4389',
    // "adquire um Kit de Disfarce e um Kit de Veneno, e tem proficiência com eles".
    automatica: { ferramentas: ['Kit de Disfarce', 'Kit de Veneno'] } },
  { subclasse: 'Vigilante das Sombras', nivel: 7, caracteristica: 'Mente de Ferro',
    livro: 'Classes.md:3734',
    // "proficiência em salvaguardas de Sabedoria". O livro oferece Carisma ou
    // Inteligência a quem JÁ tem Sabedoria -- caso que nenhum Guardião base
    // alcança (a classe não concede salvaguarda de Sabedoria), então a
    // concessão aqui é a simples, e o caso alternativo fica de fora de
    // propósito, não por esquecimento.
    automatica: { salvaguardas: ['Sabedoria'] } },
  { subclasse: 'Ilusionista', nivel: 3, caracteristica: 'Ilusões Aprimoradas',
    livro: 'Classes.md:5074',
    // "Você também conhece o truque *Ilusão Menor*."
    automatica: { truques: ['Ilusão Menor'] } },

  // ---------- Escolhas de construção: o livro manda o jogador escolher ----------
  { subclasse: 'Colégio do Conhecimento', nivel: 3, caracteristica: 'Proficiências Bônus',
    livro: 'Classes.md:766', tipo: 'subclasse_pericias_bonus', campo: 'subclasse_pericias_bonus',
    quantidade: 3, fonteOpcoes: 'pericias', destino: 'pericias_proficientes',
    rotulo: 'Proficiências Bônus — escolha 3 perícias' },
  { subclasse: 'Colégio do Conhecimento', nivel: 6, caracteristica: 'Descobertas Mágicas',
    livro: 'Classes.md:770', tipo: 'subclasse_descobertas_magicas', campo: 'subclasse_descobertas_magicas',
    quantidade: 2, fonteOpcoes: 'magias-qualquer', destino: 'magias_preparadas',
    rotulo: 'Descobertas Mágicas — escolha 2 magias' },
  { subclasse: 'Mestre da Batalha', nivel: 3, caracteristica: 'Estudioso da Guerra',
    livro: 'Classes.md:4061', tipo: 'subclasse_estudioso_ferramenta', campo: 'subclasse_estudioso_ferramenta',
    quantidade: 1, fonteOpcoes: 'ferramentas-artesao', destino: 'proficiencias_ferramentas',
    rotulo: 'Estudioso da Guerra — ferramenta de artesão' },
  { subclasse: 'Mestre da Batalha', nivel: 3, caracteristica: 'Estudioso da Guerra',
    livro: 'Classes.md:4061', tipo: 'subclasse_estudioso_pericia', campo: 'subclasse_estudioso_pericia',
    quantidade: 1, fonteOpcoes: 'pericias', destino: 'pericias_proficientes',
    rotulo: 'Estudioso da Guerra — perícia' },
  { subclasse: 'Andarilho Feérico', nivel: 3, caracteristica: 'Glamour Transcendental',
    livro: 'Classes.md:3480', tipo: 'subclasse_glamour_pericia', campo: 'subclasse_glamour_pericia',
    quantidade: 1, opcoes: PERICIAS_GLAMOUR, destino: 'pericias_proficientes',
    rotulo: 'Glamour Transcendental — perícia' },
  { subclasse: 'Campeão', nivel: 7, caracteristica: 'Estilo de Luta Adicional',
    livro: 'Classes.md:3904',
    // Tipo PROPRIO, e nao reuso de 'estilo_luta'. Reusar quebraria a
    // invariante que classes-progressao.test.mjs afirma e que continua
    // verdadeira: 'estilo_luta' e a escolha de CLASSE de Guardiao/Paladino no
    // nivel 2, e nunca dispara para Guerreiro. A do Campeao e outra escolha --
    // outra caracteristica, outro nivel, outro campo -- que por acaso oferece
    // a mesma lista.
    tipo: 'subclasse_estilo_luta_extra', campo: 'subclasse_estilo_luta_extra',
    quantidade: 1, fonteOpcoes: 'estilos-luta', destino: 'escolhas_classe.estilo_luta',
    rotulo: 'Estilo de Luta Adicional' },
  { subclasse: 'Círculo da Terra', nivel: 3, caracteristica: 'Magias do Círculo da Terra',
    livro: 'Classes.md:2406', tipo: 'subclasse_terreno', campo: 'subclasse_terreno',
    quantidade: 1, opcoes: TERRENOS_CIRCULO_TERRA, destino: 'escolhas_classe.circulo_terra_terreno',
    rotulo: 'Magias do Círculo da Terra — tipo de terreno' },
  { subclasse: 'Trilha do Coração Selvagem', nivel: 6, caracteristica: 'Aspecto dos Selvagens',
    livro: 'Classes.md:267', tipo: 'subclasse_aspecto_selvagem', campo: 'subclasse_aspecto_selvagem',
    quantidade: 1, opcoes: ASPECTOS_SELVAGENS, destino: 'recursos.aspecto_selvagem',
    rotulo: 'Aspecto dos Selvagens' },
  { subclasse: 'Feitiçaria Dracônica', nivel: 6, caracteristica: 'Afinidade Elemental',
    livro: 'Classes.md:3080', tipo: 'subclasse_afinidade_elemental', campo: 'subclasse_afinidade_elemental',
    quantidade: 1, opcoes: TIPOS_DANO_DRACONICO,
    destino: 'recursos.feiticeiro.subclasses.draconica.afinidade_elemental',
    rotulo: 'Afinidade Elemental — tipo de dano' },
  { subclasse: 'Caçador', nivel: 3, caracteristica: 'Presa do Caçador',
    livro: 'Classes.md:3543', tipo: 'subclasse_presa_cacador', campo: 'subclasse_presa_cacador',
    quantidade: 1, opcoes: PRESAS_CACADOR,
    destino: 'recursos.guardiao.subclasses.cacador.presa_escolha',
    rotulo: 'Presa do Caçador' },
  { subclasse: 'Caçador', nivel: 7, caracteristica: 'Táticas Defensivas',
    livro: 'Classes.md:3551', tipo: 'subclasse_taticas_defensivas', campo: 'subclasse_taticas_defensivas',
    quantidade: 1, opcoes: TATICAS_DEFENSIVAS,
    destino: 'recursos.guardiao.subclasses.cacador.taticas_escolha',
    rotulo: 'Táticas Defensivas' },
  { subclasse: 'Senhor das Feras', nivel: 3, caracteristica: 'Companheiro Primal',
    livro: 'Classes.md:3573', tipo: 'subclasse_companheiro_primal', campo: 'subclasse_companheiro_primal',
    quantidade: 1, opcoes: COMPANHEIROS_PRIMAIS,
    destino: 'recursos.guardiao.subclasses.feras.companheiro_tipo',
    rotulo: 'Companheiro Primal' },
];

/** Linhas que valem para (subclasse, nível). Vazio quando não há nenhuma. */
export function linhasDaSubclasseNoNivel(subclasse, nivel) {
  if (!subclasse) return [];
  return ESCOLHAS_SUBCLASSE_APP.filter((l) => l.subclasse === subclasse && l.nivel === nivel);
}

/**
 * Resolve a lista SÍNCRONA de opções de uma linha. `opcoes` literal tem
 * precedência; `fonteOpcoes` nomeia uma lista que já existe no app, para não
 * duplicar dado que outra parte já mantém.
 *
 * Devolve `[]` para as fontes que só existem em arquivo de dados
 * ('magias-qualquer'): essas têm RESOLVEDOR assíncrono declarado em
 * RESOLVEDORES_OPCOES, logo abaixo, e quem monta a tela chama
 * `opcoesDaLinhaAsync`. LIMITE CONHECIDO, dito aqui em voz alta: como a
 * guarda de `subirDeNivel` consulta ESTA função, a validação dessas linhas
 * continua sendo só de quantidade -- ela não confere se a magia escolhida
 * está mesmo nas três listas do livro. Quem oferece a lista certa é a tela.
 *
 * Uma lista vazia AQUI sem resolvedor lá é o defeito da issue #44 -- seletor
 * que nasce só com "— escolha —" e trava a subida de nível. É exatamente o
 * que `testes/regras/unidade/escolha-subclasse-viva.test.mjs` proíbe.
 */
export function opcoesDaLinha(linha) {
  if (Array.isArray(linha.opcoes)) return linha.opcoes;
  switch (linha.fonteOpcoes) {
    case 'pericias': return PERICIAS_TODAS;
    case 'ferramentas-artesao': return FERRAMENTAS_ARTESAO;
    case 'estilos-luta': return ESTILOS_LUTA_CANONICOS;
    default: return [];
  }
}

// As três listas de classe de onde saem as Descobertas Mágicas
// (Classes.md:770): "Essas magias podem vir da lista de magias de Clérigo,
// Druida ou Mago, ou uma combinação dessas listas". O relator da issue #44
// falou em "clérigo ou mago"; o livro inclui Druida, e é o livro que manda.
const CLASSES_DESCOBERTAS_MAGICAS = ['Clérigo', 'Druida', 'Mago'];

/**
 * Círculo numérico a partir da chave de grupo de `lista_magias`
 * (dados/classes/magias_<classe>.json): 'Truques' vira 0, '3º Círculo' vira 3.
 * A chave é a ÚNICA fonte do círculo nesses arquivos -- as entradas trazem
 * só nome, escola e o marcador `especial`.
 */
function circuloDoGrupo(chave) {
  const numero = /^(\d+)/.exec(String(chave));
  return numero ? Number(numero[1]) : 0;
}

/**
 * Opções das Descobertas Mágicas: as magias das listas de Clérigo, Druida e
 * Mago que o Bardo pode escolher no nível em que ganha a característica.
 *
 * Regra do livro (Classes.md:770): "A magia escolhida deve ser um truque ou
 * uma magia para a qual você tenha espaços de magia disponíveis, conforme
 * mostrado na tabela Características de Bardo" -- daí o truque passar sempre
 * e a magia de círculo passar só até `circuloMaximo`.
 *
 * `circuloMaximo` sem valor devolve a lista COMPLETA de propósito: o teto é
 * um dado da tela (o `maxCirculoNovo` que `calcularConjuracao` já calcula
 * para todo o assistente), não desta camada, e inventar um padrão numérico
 * aqui esconderia um chamador que esqueceu de passá-lo. Quem monta o seletor
 * sempre passa o teto real, e o spec e2e
 * (bardo-conhecimento-descobertas.spec.mjs) mede isso na tela.
 *
 * `jaTem` exclui o que o personagem já possui. NÃO é refinamento cosmético:
 * a gravação deduplica por nome, então oferecer uma magia repetida faz o
 * jogador gastar UMA DAS DUAS Descobertas sem receber nada -- escolhe duas e
 * ganha uma, sem erro e sem aviso. É o mesmo princípio que
 * `testes/regras/unidade/escolha-morta.test.mjs` persegue do lado dos
 * talentos. Acontece de verdade em multiclasse com Clérigo/Druida/Mago
 * (listas sobrepostas), com o talento Iniciado em Magia e com magia de
 * domínio. Quem monta o conjunto é a tela, no mesmo formato `jaTem: Set` que
 * o resto de levelup-ui.js já usa.
 *
 * @param {{circuloMaximo?: number, jaTem?: Set<string>}} contexto
 * @returns {Promise<Array<{nome: string, circulo: number}>>} sem repetidas,
 *   ordenadas por círculo e depois por nome.
 */
async function resolverDescobertasMagicas({ circuloMaximo = Infinity, jaTem = new Set() } = {}) {
  const porNome = new Map();
  for (const classe of CLASSES_DESCOBERTAS_MAGICAS) {
    const dados = await getMagiasClasse(classe);
    for (const [grupo, lista] of Object.entries(dados?.lista_magias || {})) {
      const circulo = circuloDoGrupo(grupo);
      if (circulo > circuloMaximo) continue;
      for (const magia of lista || []) {
        // As entradas podem vir como string pura ou objeto -- mesma
        // normalização do fluxo de Iniciado em Magia (levelup-ui.js).
        const nome = typeof magia === 'string' ? magia : magia?.nome;
        if (!nome || jaTem.has(nome)) continue;
        // Uma magia em duas das três listas (Curar Ferimentos, por exemplo)
        // não pode aparecer duas vezes no mesmo seletor.
        if (!porNome.has(nome)) porNome.set(nome, { nome, circulo });
      }
    }
  }
  return [...porNome.values()]
    .sort((a, b) => a.circulo - b.circulo || a.nome.localeCompare(b.nome, 'pt-BR'));
}

// Fontes de opção que só existem em arquivo de dados, e por isso resolvem
// ASSÍNCRONO. Registrar aqui, e não espalhar um `if` por tela, é o que deixa
// o oráculo genérico perguntar "esta linha tem quem preencha o seletor?" sem
// conhecer característica nenhuma pelo nome.
const RESOLVEDORES_OPCOES = {
  'magias-qualquer': resolverDescobertasMagicas,
};

/**
 * Resolvedor assíncrono declarado por uma linha, ou `null` quando as opções
 * dela já saem prontas de `opcoesDaLinha`.
 */
export function resolvedorDaLinha(linha) {
  if (Array.isArray(linha?.opcoes)) return null;
  return RESOLVEDORES_OPCOES[linha?.fonteOpcoes] || null;
}

/**
 * Opções de uma linha de fonte ASSÍNCRONA, no formato `{ nome, circulo }`.
 * Quem monta a tela chama esta função só para as linhas com resolvedor; as
 * demais continuam sendo renderizadas direto de `opcoesDaLinha`, no HTML,
 * sem espera nenhuma.
 *
 * RECUSA linha sem resolvedor, em vez de cair num fallback síncrono: aquele
 * fallback era inalcançável (todo chamador confirma `resolvedorDaLinha`
 * antes) e, se um dia fosse alcançado, devolveria uma lista pela via errada
 * sem ninguém notar. Aqui um `undefined` mudo é justamente o que traz a
 * issue #44 de volta -- seletor vazio, sem explicação.
 *
 * @param {object} linha Linha de ESCOLHAS_SUBCLASSE_APP.
 * @param {object} [contexto] Repassado ao resolvedor (ex.: `circuloMaximo`).
 */
export async function opcoesDaLinhaAsync(linha, contexto = {}) {
  const resolvedor = resolvedorDaLinha(linha);
  if (!resolvedor) {
    throw new Error(`opcoesDaLinhaAsync: a linha "${linha?.rotulo || linha?.tipo}" não tem ` +
      'resolvedor assíncrono (fonteOpcoes: ' + JSON.stringify(linha?.fonteOpcoes) + ') -- ' +
      'as opções dela saem de opcoesDaLinha, na montagem do HTML.');
  }
  return resolvedor(contexto);
}

/** Le um valor num caminho pontilhado, sem criar nada. */
function lerDeCaminho(personagem, caminho) {
  return caminho.split('.').reduce((o, k) => (o == null ? undefined : o[k]), personagem);
}

/** Escreve um valor num caminho pontilhado, criando os objetos do meio. */
function gravarEmCaminho(personagem, caminho, valor) {
  const partes = caminho.split('.');
  let alvo = personagem;
  for (const parte of partes.slice(0, -1)) {
    if (!alvo[parte] || typeof alvo[parte] !== 'object') alvo[parte] = {};
    alvo = alvo[parte];
  }
  alvo[partes[partes.length - 1]] = valor;
}

/** Acrescenta a uma lista do personagem sem duplicar. */
function acrescentarNaLista(personagem, campo, valores) {
  if (!Array.isArray(personagem[campo])) personagem[campo] = [];
  for (const v of valores) {
    if (!personagem[campo].includes(v)) personagem[campo].push(v);
  }
}

/**
 * Aplica a escolha do jogador ao personagem. `valores` chega como lista ou
 * valor único; a função aceita os dois para o chamador não precisar saber a
 * quantidade da linha.
 *
 * @param {object} personagem Mutado no lugar.
 * @param {object} linha Linha de ESCOLHAS_SUBCLASSE_APP.
 * @param {string|string[]} valores O que o jogador escolheu.
 * @param {{circulos?: Object<string, number>}} [contexto] `circulos` é o
 *   mapa "nome da magia -> círculo real", montado por quem chama a partir do
 *   índice de magias (levelup.js). Só o destino `magias_preparadas` o usa --
 *   e é ele que decide entre `magias_preparadas` e `magias_conhecidas`, já
 *   que o livro deixa escolher truque (ver o comentário no corpo).
 */
export function aplicarEscolhaSubclasse(personagem, linha, valores, contexto = {}) {
  const lista = (Array.isArray(valores) ? valores : [valores]).filter(Boolean);
  if (!lista.length) return;
  if (linha.destino === 'pericias_proficientes' || linha.destino === 'proficiencias_ferramentas') {
    acrescentarNaLista(personagem, linha.destino, lista);
    return;
  }
  if (linha.destino === 'magias_preparadas') {
    for (const nome of lista) {
      // Círculo REAL, e não um valor fixo: as Descobertas Mágicas escolhem
      // "um truque OU uma magia" (Classes.md:770), então não há círculo
      // único a supor. O 1 continua como último recurso para um nome que o
      // índice não conhece (magia personalizada), o mesmo padrão de
      // obterMagiasDominioNivel.
      const circulo = contexto.circulos?.[nome] ?? 1;
      // TRUQUE VAI PARA `magias_conhecidas`, não para as preparadas.
      //
      // No app, truque de círculo 0 mora em `magias_conhecidas` -- é de lá
      // que a seção de Truques da ficha lê (sheet/magias.js:553), e é assim
      // que TODAS as outras origens de truque gravam (`subclasse_automatica`
      // do Ilusionista, `telecinetico`, `especie`). Gravá-lo entre as
      // preparadas não é só arrumação: `sheet/magias.js:652` agrupa por
      // `m.circulo || 1` e jogaria o truque no grupo "1º Círculo", e o
      // filtro `Object.keys(espacos).filter(c => parseInt(c) >= m.circulo)`
      // casa TODOS os círculos quando o círculo é 0 -- o cartão sairia com
      // seletor de upcast e um botão "Conjurar" que GASTA espaço de magia
      // para lançar um truque. Este era o único ponto do app que escrevia
      // `circulo: 0` em `magias_preparadas`; a cadeia inteira só existia
      // por causa dele.
      //
      // Que o truque não gaste vaga do limite de truques da classe é decidido
      // por ORIGENS_TRUQUE_NAO_TROCAVEL (regras-origens-magia.js), onde
      // `subclasse_escolha` está declarada.
      const campo = circulo === 0 ? 'magias_conhecidas' : 'magias_preparadas';
      if (!Array.isArray(personagem[campo])) personagem[campo] = [];
      if (!personagem[campo].some((m) => m.nome === nome)) {
        personagem[campo].push({ nome, circulo, origem: 'subclasse_escolha' });
      }
    }
    return;
  }
  // Destino que ja e LISTA recebe acrescimo, nao substituicao: o Estilo de
  // Luta Adicional do Campeao entra ao lado do estilo que o personagem ja
  // tenha em escolhas_classe.estilo_luta, em vez de apagar o anterior.
  const atual = lerDeCaminho(personagem, linha.destino);
  if (Array.isArray(atual)) {
    for (const v of lista) if (!atual.includes(v)) atual.push(v);
    return;
  }
  if (atual === undefined && linha.destino === 'escolhas_classe.estilo_luta') {
    gravarEmCaminho(personagem, linha.destino, [...lista]);
    return;
  }
  gravarEmCaminho(personagem, linha.destino, linha.quantidade === 1 ? lista[0] : lista);
}

/**
 * Aplica uma concessão automática -- o livro concede sem perguntar nada, e o
 * app precisa conceder sem perguntar nada.
 */
export function aplicarConcessaoAutomatica(personagem, linha) {
  const a = linha.automatica;
  if (!a) return;
  if (a.pericias) acrescentarNaLista(personagem, 'pericias_proficientes', a.pericias);
  if (a.ferramentas) acrescentarNaLista(personagem, 'proficiencias_ferramentas', a.ferramentas);
  if (a.salvaguardas) acrescentarNaLista(personagem, 'salvaguardas_proficientes', a.salvaguardas);
  if (a.extras) acrescentarNaLista(personagem, 'proficiencias_extra', a.extras);
  if (a.truques) {
    if (!Array.isArray(personagem.magias_conhecidas)) personagem.magias_conhecidas = [];
    for (const nome of a.truques) {
      if (!personagem.magias_conhecidas.some((m) => m.nome === nome)) {
        personagem.magias_conhecidas.push({ nome, circulo: 0, origem: 'subclasse_automatica' });
      }
    }
  }
}
