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
    // "Você também conhece o truque *Ilusão Menor*. Se já o conhece, você
    // aprende um truque de Mago diferente à sua escolha. O truque não conta
    // para o seu número de truques conhecidos."
    automatica: { truques: ['Ilusão Menor'] },
    // A SEGUNDA frase da regra, que o app nunca implementou (issue #30):
    // quem chegava ao nível 3 já conhecendo Ilusão Menor -- por Iniciado em
    // Magia, por espécie (Gnomo do Bosque), ou por tê-la escolhido como
    // truque de classe -- não ganhava truque nenhum, e a subclasse não
    // gravava nada. O segundo sintoma saía do mesmo silêncio: trocar depois
    // a Ilusão Menor do talento por outra deixava o personagem sem ela por
    // completo, porque só aquela fonte a mantinha.
    //
    // `substituto` não é uma linha solta na tabela: é o OUTRO ramo DESTA
    // característica, e `linhasDaSubclasseNoNivel` troca um pelo outro
    // conforme o personagem. Como linha própria ela apareceria para todo
    // Ilusionista, cobrando uma escolha que o livro só pede a quem já
    // conhece o truque.
    substituto: {
      tipo: 'subclasse_truque_substituto', campo: 'subclasse_truque_substituto',
      quantidade: 1, fonteOpcoes: 'truques-mago', destino: 'truque_de_subclasse',
      rotulo: 'Ilusões Aprimoradas — truque de Mago substituto',
    } },

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

/**
 * Os truques que o personagem já conhece, por NOME.
 *
 * Só `magias_conhecidas`: é onde TODO truque do app mora, venha de espécie,
 * de talento, de classe ou de subclasse (ver o comentário de
 * `aplicarEscolhaSubclasse` sobre por que truque nunca entra em
 * `magias_preparadas`). Existe exportada para que quem chama
 * `linhasDaSubclasseNoNivel` não escreva a própria extração e acabe
 * perguntando a pergunta errada -- a de `origem`, por exemplo, que erraria
 * o truque escolhido na criação, que não tem origem nenhuma.
 */
export function truquesConhecidosDe(personagem) {
  return new Set((personagem?.magias_conhecidas || []).map((m) => m?.nome).filter(Boolean));
}

/**
 * A linha, trocada pelo ramo SUBSTITUTO quando a concessão automática dela
 * já não tem o que conceder a este personagem.
 *
 * Hoje só o Ilusionista (Classes.md:5074) tem os dois ramos: "Você também
 * conhece o truque Ilusão Menor. SE JÁ O CONHECE, você aprende um truque de
 * Mago diferente à sua escolha". Quando o truque já está lá, o ramo
 * automático viraria um `push` que a deduplicação por nome descarta -- ou
 * seja, silêncio -- e é esse silêncio que a linha substituta ocupa.
 */
function ramoDaLinha(linha, truquesConhecidos) {
  if (!linha.substituto || !truquesConhecidos) return linha;
  const concedidos = linha.automatica?.truques || [];
  if (!concedidos.length || !concedidos.every((t) => truquesConhecidos.has(t))) return linha;
  // `automatica` sai junto: o ramo substituto é uma ESCOLHA, e deixar os
  // dois na mesma linha faria a subida conceder e perguntar ao mesmo tempo.
  const { automatica, substituto, ...comum } = linha;
  return { ...comum, ...substituto };
}

/**
 * Linhas que valem para (subclasse, nível). Vazio quando não há nenhuma.
 *
 * `truquesConhecidos` (Set de nomes, de `truquesConhecidosDe`) é o que
 * decide entre os dois ramos de uma característica que o livro condiciona
 * ao que o personagem JÁ SABE -- hoje só as Ilusões Aprimoradas. Sem ele a
 * função devolve o ramo automático, que é o comportamento de sempre e o
 * certo para quem não tem personagem em mãos (sheet/habilidades.js, que só
 * quer a lista de opções do Estilo de Luta do Campeão).
 *
 * QUEM SOBE DE NÍVEL PRECISA PASSÁ-LO, e passar o MESMO conjunto na tela e
 * no motor: a tela que mostrasse a escolha sem o motor cobrá-la a jogaria
 * fora em silêncio, e o motor que a cobrasse sem a tela mostrá-la travaria
 * a subida numa pendência sem controle na página.
 */
export function linhasDaSubclasseNoNivel(subclasse, nivel, truquesConhecidos = null) {
  if (!subclasse) return [];
  return ESCOLHAS_SUBCLASSE_APP
    .filter((l) => l.subclasse === subclasse && l.nivel === nivel)
    .map((l) => ramoDaLinha(l, truquesConhecidos));
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

/**
 * Opções do truque substituto do Ilusionista: os TRUQUES da lista de Mago
 * que o personagem ainda não conhece.
 *
 * Regra do livro (Classes.md:5074): "você aprende um truque de Mago
 * DIFERENTE à sua escolha" -- daí a lista ser a de Mago e o filtro `jaTem`
 * ser da regra, não cosmético. Sem ele o seletor ofereceria a própria
 * Ilusão Menor, e escolhê-la gastaria a característica inteira sem conceder
 * nada (a gravação deduplica por nome) -- a mesma escolha morta que
 * `escolha-morta.test.mjs` persegue do lado dos talentos.
 *
 * Mesma fonte que o truque substituto do Telecinético e o fluxo de Iniciado
 * em Magia já leem (`getMagiasClasse('Mago').lista_magias.Truques`), e não
 * uma lista copiada para cá.
 *
 * @param {{jaTem?: Set<string>}} contexto
 * @returns {Promise<Array<{nome: string, circulo: number}>>} ordenadas por nome.
 */
async function resolverTruquesMago({ jaTem = new Set() } = {}) {
  const dados = await getMagiasClasse('Mago');
  const porNome = new Map();
  for (const magia of dados?.lista_magias?.['Truques'] || []) {
    // As entradas podem vir como string pura ou objeto -- mesma
    // normalização do fluxo de Iniciado em Magia (levelup-ui.js).
    const nome = typeof magia === 'string' ? magia : magia?.nome;
    // `circulo: 0` é forçado porque a lista por classe não traz o campo: é o
    // balde 'Truques' que diz o círculo, e quem monta o seletor precisa dele.
    if (nome && !jaTem.has(nome) && !porNome.has(nome)) porNome.set(nome, { nome, circulo: 0 });
  }
  return [...porNome.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

// Fontes de opção que só existem em arquivo de dados, e por isso resolvem
// ASSÍNCRONO. Registrar aqui, e não espalhar um `if` por tela, é o que deixa
// o oráculo genérico perguntar "esta linha tem quem preencha o seletor?" sem
// conhecer característica nenhuma pelo nome.
const RESOLVEDORES_OPCOES = {
  'magias-qualquer': resolverDescobertasMagicas,
  'truques-mago': resolverTruquesMago,
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

/**
 * Grava um truque concedido por característica de subclasse.
 *
 * Uma função só para os DOIS ramos das Ilusões Aprimoradas (o automático e o
 * substituto) porque o truque é o mesmo ganho da mesma característica: a
 * origem tem de ser a mesma nos dois, e escrevê-la duas vezes é como as
 * dez cópias de lista de origem que regras-origens-magia.js existe para
 * acabar. `subclasse_automatica` é a origem que `truqueContaNoLimite`
 * (regras-origens-magia.js) isenta do orçamento de truques da classe --
 * "O truque não conta para o seu número de truques conhecidos"
 * (Classes.md:5074), com todas as letras.
 */
function concederTruqueDeSubclasse(personagem, nome) {
  if (!Array.isArray(personagem.magias_conhecidas)) personagem.magias_conhecidas = [];
  if (personagem.magias_conhecidas.some((m) => m.nome === nome)) return;
  personagem.magias_conhecidas.push({ nome, circulo: 0, origem: 'subclasse_automatica' });
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
  // Truque concedido pela característica -- o ramo substituto do
  // Ilusionista. Destino PRÓPRIO, e não `magias_preparadas`: aquele ramo
  // decide o campo pelo círculo e grava `origem: 'subclasse_escolha'`, que é
  // a das Descobertas Mágicas; aqui o truque é o mesmo ganho da concessão
  // automática desta mesma característica, então passa pela mesma gravação
  // que ela (`concederTruqueDeSubclasse`) e sai com a mesma origem.
  if (linha.destino === 'truque_de_subclasse') {
    for (const nome of lista) concederTruqueDeSubclasse(personagem, nome);
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
    for (const nome of a.truques) concederTruqueDeSubclasse(personagem, nome);
  }
}
