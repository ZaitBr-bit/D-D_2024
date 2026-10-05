// ============================================================
// Itens mágicos do acervo (Livro do Mestre, capítulo 7) -> inventário.
//
// Regra pura, sem DOM e sem import de sheet/ ou creator/. Cumpre o
// "Contrato com o Plano 2" do spec
// (docs/superpowers/specs/2026-10-03-itens-magicos-no-site-design.md):
// efeitos da variante; base e sintonização do item-pai; tipo do inventário
// decidido pela base ('arma'/'armadura'/'escudo') ou 'magico'; Poção de
// Cura e Pergaminho Mágico do Livro do Jogador reaproveitados.
// ============================================================
import { condicaoSatisfeita, itemAtivo } from './regras-itens-magicos.js';
import { atributoEfetivo, fonteAtributoItem, temBaseDoMartelo } from './regras-atributos.js';
import { PASSIVOS_VERSAO, estadoInicialRecursos } from './regras-recursos-itens.js';
import { ROTULO_MODO, ROTULO_SENTIDO } from './regras-passivos-itens.js';
import { circuloDoPergaminho, magiaDoPergaminho, nomeDoPergaminho } from './regras-pergaminho.js';

export const RARIDADES_ORDEM = ['Comum', 'Incomum', 'Rara', 'Muito Rara', 'Lendária', 'Artefato'];
export const TIPOS_ACERVO = ['Anel', 'Arma', 'Armadura', 'Bastão', 'Cajado', 'Item Maravilhoso', 'Pergaminho', 'Poção', 'Varinha'];

const ROTULO_ALVO = { ca: 'CA', ataque_magia: 'Atq Magia', cd_magia: 'CD Magia', salvaguarda: 'Salv' };
const NOME_ATRIBUTO = { forca: 'Força', destreza: 'Destreza', constituicao: 'Constituição', inteligencia: 'Inteligência', sabedoria: 'Sabedoria', carisma: 'Carisma' };
const TEXTO_CONDICAO = { sem_armadura: 'só sem armadura', sem_escudo: 'só sem escudo', sem_armadura_nem_escudo: 'só sem armadura nem escudo' };

/** Texto em minúsculas e sem acento, para busca. */
function normalizar(s) {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Raridades de um item do acervo: a dele, ou as das variantes quando é "Varia". */
export function raridadesDoItem(item) {
  if (item.raridade !== 'Varia') return [item.raridade];
  return [...new Set((item.variantes || []).map(v => v.raridade))];
}

/** Itens do acervo que casam o texto (nome do item ou da variante), a raridade e o tipo do livro. */
export function filtrarAcervo(itens, { texto = '', raridade = '', tipo = '' } = {}) {
  const t = normalizar(texto).trim();
  return (itens || []).filter(i =>
    (!t || normalizar(i.nome).includes(t) || (i.variantes || []).some(v => normalizar(v.nome).includes(t)))
    && (!raridade || raridadesDoItem(i).includes(raridade))
    && (!tipo || i.tipo === tipo));
}

/** Armas, armaduras ou escudo do catálogo que a `base` do item aceita (respeita `excluir`). */
export function opcoesDeBase(base, { armas = [], armaduras = [] } = {}) {
  if (!base) return [];
  if (base.tipo === 'escudo') return armaduras.filter(a => a.categoria === 'Escudo');
  const lista = base.tipo === 'arma' ? armas : armaduras.filter(a => a.categoria !== 'Escudo');
  const excluir = new Set(base.excluir || []);
  return lista.filter(a => !excluir.has(a.nome)
    && (Array.isArray(base.opcoes) ? base.opcoes.includes(a.nome) : (base.categorias || []).includes(a.categoria)));
}

/** Nome da arma/armadura do catálogo por trás de um item do inventário (o mágico guarda em dados.nome_base). */
export function nomeBaseDoItem(item) {
  return item?.dados?.nome_base || item?.nome || '';
}

/**
 * Nome gravado no inventário de um item mágico com arma/armadura-base:
 * `<Nome do item> (<base>)`. O sufixo não entra quando o item é escudo (a base
 * é sempre o próprio Escudo) nem quando o nome já contém o nome da base como
 * palavra inteira ("Espada Longa +1", "Cota de Malha Élfica"). Único ponto
 * que define o formato; itens já salvos mantêm o nome gravado.
 */
export function nomeDoItemComBase(nome, nomeBase, tipo = '') {
  if (!nomeBase || tipo === 'escudo') return nome;
  const escapada = nomeBase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const contem = new RegExp(`(?<![\\p{L}\\p{N}])${escapada}(?![\\p{L}\\p{N}])`, 'iu').test(nome);
  return contem ? nome : `${nome} (${nomeBase})`;
}

/** Campos mágicos do instantâneo gravado no inventário: efeitos da variante, sintonização do pai. */
function camposMagicos(item, variante) {
  const reg = variante || item;
  return {
    magico_id: reg.id,
    raridade: reg.raridade === 'Varia' ? '' : reg.raridade,
    requer_sintonizacao: !!item.requer_sintonizacao,
    // Variante sem `efeitos` herda os do item-pai (mesmo critério de campoDoAcervo);
    // variante que declara `efeitos` (inclusive vazio) usa só os próprios.
    efeitos: structuredClone((variante ? (variante.efeitos ?? item.efeitos) : item.efeitos) || []),
    linha_tipo: item.linha_tipo || '',
    descricao_magica: item.descricao || '',
    tabelas: structuredClone(item.tabelas || []),
    // Variante sem recursos próprios herda os do item-pai.
    recursos: structuredClone((variante ? (variante.recursos ?? item.recursos) : item.recursos) ?? null),
    // Variante sem magias próprias herda as do item-pai.
    magias: structuredClone((variante ? (variante.magias ?? item.magias) : item.magias) ?? null),
    requisito_sintonizacao: item.requisito_sintonizacao || '',
    // Variante sem aumento próprio herda o do item-pai.
    aumento_permanente: structuredClone((variante ? (variante.aumento_permanente ?? item.aumento_permanente) : item.aumento_permanente) ?? null),
    // Item novo já traz os efeitos passivos (4C), de aumento de atributo (4D) e o `efeito` dos usos do acervo: dispensa o preenchimento posterior.
    passivos_versao: PASSIVOS_VERSAO,
  };
}

/**
 * Item de inventário de um item mágico do acervo. Devolve null quando falta
 * uma escolha obrigatória (variante, se o item tem variantes; base, se tem
 * `base`). `equipamentoPHB` é a lista `itens` de equipamento_aventura.json.
 */
export function montarItemInventario({ item, variante = null, base = null, equipamentoPHB = [], magia = undefined }) {
  if (!item) return null;
  if ((item.variantes || []).length && !variante) return null;
  if (item.base && !base) return null;
  // Pergaminho Mágico: a etapa da magia é obrigatória. `undefined` = não feita;
  // `null` = "Em branco"; objeto = magia do círculo da variante (issue #103).
  const ehPergaminho = item.id === 'pergaminho-magico';
  const circuloPergaminho = ehPergaminho ? circuloDoPergaminho(variante) : null;
  if (ehPergaminho) {
    if (circuloPergaminho === null || magia === undefined) return null;
    if (magia !== null && Number(magia.circulo) !== circuloPergaminho) return null;
  }
  // Aplica nome com a magia, círculo guardado e `dados.magias` ao item do pergaminho; outros itens passam intactos.
  const comMagiaDoPergaminho = (novo) => (ehPergaminho
    ? {
        ...novo,
        nome: nomeDoPergaminho(novo.nome, magia),
        dados: { ...novo.dados, pergaminho: { circulo: circuloPergaminho, nome_base: novo.nome }, magias: magia ? [magiaDoPergaminho(magia)] : [] },
      }
    : novo);
  const ref = variante ? variante.livro_jogador : item.livro_jogador;
  if (ref) {
    const registro = equipamentoPHB.find(r => r.nome === ref.nome);
    if (registro) return comMagiaDoPergaminho({ nome: registro.nome, tipo: 'equipamento', quantidade: 1, equipado: false, descricao: '', dados: { ...registro } });
  }
  const nome = (variante || item).nome;
  const magicos = camposMagicos(item, variante);
  // Contador nasce cheio quando o item tem recursos.
  const estado = magicos.recursos ? { estado_recursos: estadoInicialRecursos(magicos.recursos) } : {};
  if (item.base) {
    const tipo = item.base.tipo === 'arma' ? 'arma' : (item.base.tipo === 'escudo' ? 'escudo' : 'armadura');
    const nomeFinal = nomeDoItemComBase(nome, base.nome, tipo);
    const descricao = tipo === 'arma' ? `${base.dano} - ${base.propriedades || ''}` : `CA: ${base.ca}`;
    // sem_penalidades (ex.: mitral): '—' é o marcador de "nenhum" que a ficha já lê.
    const semPenalidades = item.base.sem_penalidades === true && tipo === 'armadura' ? { furtividade: '—', requisito_forca: '—' } : {};
    return { nome: nomeFinal, tipo, quantidade: 1, equipado: false, descricao, dados: { ...base, nome_base: base.nome, ...semPenalidades, ...magicos }, ...estado };
  }
  return comMagiaDoPergaminho({ nome, tipo: 'magico', quantidade: 1, equipado: false, descricao: '', dados: { tipo_item: item.dados_ficha?.tipo_item || 'Item Mágico', ...magicos }, ...estado });
}

/**
 * Valor do atributo em jogo como se o item dado estivesse desequipado
 * (base, mínimos de item e bônus de outros itens). Item fora do inventário
 * não é removido.
 */
function valorSemEsteItem(personagem, item, chave) {
  return atributoEfetivo(semEsteItem(personagem, item), chave);
}

/** Cópia do personagem com o item dado desequipado; item fora do inventário não é removido. */
function semEsteItem(personagem, item) {
  const inventario = (personagem?.inventario || []).map(i => (i === item ? { ...i, equipado: false } : i));
  return { ...personagem, inventario };
}

/**
 * Motivo de um efeito `atributo` (mínimo) não valer em jogo; '' quando vale.
 * Vale só o item que determina o mínimo em jogo (fonteAtributoItem, que já
 * inclui o bônus do Martelo dos Trovões): o valor-base igual ou maior que esse
 * mínimo anula o efeito, e outro item com mínimo igual ou maior o cobre.
 */
function motivoAtributoSemEfeito(item, ef, personagem) {
  // atributo-base: o efeito só vale quando o mínimo supera o valor-base da ficha; a comparação é com o base
  const base = Number(personagem?.atributos?.[ef.atributo]);
  const fonte = fonteAtributoItem(personagem, ef.atributo);
  // Item fora do inventário (ou fora de jogo): só a comparação com o valor-base.
  if (!fonte) return base >= ef.minimo ? `sem efeito: seu valor já é ${base}` : '';
  // O vencedor é o primeiro item ativo do inventário com o nome da fonte (identidade, não só o nome: dois itens iguais).
  const venceEste = (personagem?.inventario || []).find(i => itemAtivo(i) && i.nome === fonte.origem) === item;
  if (base >= (venceEste ? fonte.minimo : ef.minimo)) return `sem efeito: seu valor já é ${base}`;
  if (!venceEste) return `sem efeito: ${fonte.origem} já dá ${fonte.minimo}`;
  return '';
}

/**
 * Selos dos efeitos de um item do inventário, com o estado de cada um.
 * Efeitos de arma não ganham selo (já estão no Atq/Dano da arma); o efeito
 * de atributo fica inativo ("sem efeito") quando o valor-base da ficha já é
 * igual ou maior que o mínimo do item. `visaoNoEscuroBase` é o alcance da
 * Visão no Escuro da espécie (0 sem ela): o selo de Visão no Escuro avisa
 * quando o item soma à base e fica inativo quando não a supera.
 */
export function selosDeEfeitos(item, personagem, { visaoNoEscuroBase = 0 } = {}) {
  const baseVE = Number(visaoNoEscuroBase) || 0;
  const out = [];
  for (const ef of item?.dados?.efeitos || []) {
    if (ef.alvo === 'ataque_arma' || ef.alvo === 'dano_arma') continue;
    // Modo de velocidade desconhecido não ganha selo.
    if (ef.alvo === 'deslocamento' && !Object.hasOwn(ROTULO_MODO, ef.modo)) continue;
    let texto;
    if (ef.alvo === 'atributo') texto = `${NOME_ATRIBUTO[ef.atributo] || ef.atributo} ${ef.minimo}`;
    else if (ef.alvo === 'atributo_bonus') texto = `${NOME_ATRIBUTO[ef.atributo] || ef.atributo} +${ef.valor} (até ${ef.maximo})`;
    else if (ef.alvo === 'atributo_minimo_bonus') texto = `${NOME_ATRIBUTO[ef.atributo] || ef.atributo} do Cinturão +${ef.valor} (até ${ef.maximo})`;
    else if (ef.alvo === 'ca_base') texto = `CA base ${ef.valor}`;
    else if (ef.alvo === 'resistencia') texto = ef.tipo_dano ? `Resist. ${ef.tipo_dano}` : (item.escolhas?.resistencia && ef.escolha?.includes(item.escolhas.resistencia) ? `Resist. ${item.escolhas.resistencia}` : 'Resist. (escolher)');
    else if (ef.alvo === 'imunidade') texto = `Imune ${ef.tipo_dano}`;
    else if (ef.alvo === 'imunidade_condicao') texto = `Imune: ${ef.condicao}`;
    else if (ef.alvo === 'deslocamento') texto = `${ROTULO_MODO[ef.modo] || ef.modo} ${ef.igual_deslocamento ? '= Desloc.' : `${ef.metros} m`}${ef.pairar ? ' (pairar)' : ''}`;
    else if (ef.alvo === 'deslocamento_minimo') texto = `Desloc. mín. ${ef.metros} m`;
    else if (ef.alvo === 'sentido') {
      // Visão no Escuro com `soma_se_tiver` e base na ficha: o item soma à base.
      const somaABase = ef.sentido === 'visao_no_escuro' && ef.soma_se_tiver && baseVE > 0;
      texto = somaABase
        ? `${ROTULO_SENTIDO[ef.sentido]} +${ef.soma_se_tiver} m (soma à base)`
        : `${ROTULO_SENTIDO[ef.sentido] || ef.sentido} ${ef.metros} m`;
    }
    // Vantagem com contexto leva "*": vale só na situação descrita.
    else if (ef.alvo === 'vantagem') texto = `Vant. ${ef.em === 'pericia' ? ef.pericia : ef.em === 'iniciativa' ? 'Iniciativa' : (ef.atributo ? `salv. ${ef.atributo}` : 'salvaguardas')}${ef.contexto ? '*' : ''}`;
    else texto = `${ROTULO_ALVO[ef.alvo] || ef.alvo} ${ef.valor > 0 ? '+' : ''}${ef.valor}`;
    let motivo = '';
    if (!item.equipado) motivo = 'não equipado';
    else if (item.dados.requer_sintonizacao && item.sintonizado !== true) motivo = 'requer sintonização';
    else if (ef.alvo !== 'imunidade_condicao' && ef.condicao && !condicaoSatisfeita(ef.condicao, personagem)) motivo = TEXTO_CONDICAO[ef.condicao] || ef.condicao;
    else if (ef.alvo === 'atributo') motivo = motivoAtributoSemEfeito(item, ef, personagem);
    // Visão no Escuro que não supera a base da espécie (e não soma) não muda nada.
    else if (ef.alvo === 'sentido' && ef.sentido === 'visao_no_escuro' && !ef.soma_se_tiver && baseVE >= ef.metros) {
      motivo = `sem efeito: sua base já é ${baseVE} m`;
    }
    // aumento passivo: o valor em jogo sem este item (base, mínimos de item e outros bônus) já no teto o torna inútil
    else if (ef.alvo === 'atributo_bonus' && valorSemEsteItem(personagem, item, ef.atributo) >= ef.maximo) {
      motivo = `sem efeito: já está em ${valorSemEsteItem(personagem, item, ef.atributo)}`;
    }
    // bônus ao mínimo só vale com Cinturão de Força do Gigante ou Manoplas de Poder do Ogro ativos
    else if (ef.alvo === 'atributo_minimo_bonus' && !temBaseDoMartelo(personagem, ef.atributo)) {
      motivo = 'sem efeito: requer Cinturão de Força do Gigante ou Manoplas de Poder do Ogro';
    }
    // com a base ativa: o valor em jogo sem este item já igual ao valor com ele (base acima do mínimo com o bônus, ou teto) o torna inútil
    else if (ef.alvo === 'atributo_minimo_bonus' && valorSemEsteItem(personagem, item, ef.atributo) >= atributoEfetivo(personagem, ef.atributo)) {
      motivo = `sem efeito: já está em ${valorSemEsteItem(personagem, item, ef.atributo)}`;
    }
    out.push({ texto, ativo: !motivo, motivo });
  }
  return out;
}
