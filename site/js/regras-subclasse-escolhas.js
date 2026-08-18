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
 * Resolve a lista de opções de uma linha. `opcoes` literal tem precedência;
 * `fonteOpcoes` nomeia uma lista que já existe no app, para não duplicar
 * dado que outra parte já mantém.
 *
 * 'magias-qualquer' devolve lista vazia de propósito: as opções vêm do
 * índice de magias, carregado de forma assíncrona por quem monta a tela --
 * a validação de `subirDeNivel` para essa linha é só de quantidade, e isso
 * está declarado no README da suíte, não escondido.
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
 */
export function aplicarEscolhaSubclasse(personagem, linha, valores) {
  const lista = (Array.isArray(valores) ? valores : [valores]).filter(Boolean);
  if (!lista.length) return;
  if (linha.destino === 'pericias_proficientes' || linha.destino === 'proficiencias_ferramentas') {
    acrescentarNaLista(personagem, linha.destino, lista);
    return;
  }
  if (linha.destino === 'magias_preparadas') {
    if (!Array.isArray(personagem.magias_preparadas)) personagem.magias_preparadas = [];
    for (const nome of lista) {
      if (!personagem.magias_preparadas.some((m) => m.nome === nome)) {
        personagem.magias_preparadas.push({ nome, circulo: 1, origem: 'subclasse_escolha' });
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
