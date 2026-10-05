// ============================================================
// Efeitos mecânicos de itens: quais estão valendo agora.
//
// Regra pura, sem DOM e sem import de sheet/ ou creator/ (mesma regra de
// dependência de itens-seletor.js). Item do acervo do Livro do Mestre
// traz `dados.efeitos` (dados/livro-do-mestre/capitulo7); item
// customizado entra pelo adaptador efeitosDeCustomizado. CA, magia,
// salvaguarda e arma (utils.js, sheet/inventario.js) leem daqui.
// ============================================================

// Alvos passivos da 4C: defesas, deslocamento, sentidos e vantagens.
export const ALVOS_PASSIVOS = ['resistencia', 'imunidade', 'imunidade_condicao', 'deslocamento', 'deslocamento_minimo', 'sentido', 'vantagem'];
// Alvos da 4D: aumento de atributo até um teto (Pedras Ioun) e bônus ao mínimo do Cinturão (Martelo dos Trovões).
export const ALVOS_AUMENTO = ['atributo_bonus', 'atributo_minimo_bonus'];
export const ALVOS_EFEITO = ['ca', 'ca_base', 'ataque_arma', 'dano_arma', 'ataque_magia', 'cd_magia', 'salvaguarda', 'atributo', ...ALVOS_PASSIVOS, ...ALVOS_AUMENTO];
export const CONDICOES_EFEITO = ['sem_armadura', 'sem_escudo', 'sem_armadura_nem_escudo'];
// Alvos que pertencem à arma do próprio item, não ao personagem.
const ALVOS_DA_ARMA = ['ataque_arma', 'dano_arma'];

/** Armadura e escudo equipados (escudo pelo nome "Escudo" ou tipo "escudo"). */
export function equipamentoDeCA(personagem) {
  const inv = personagem?.inventario || [];
  return {
    armadura: inv.find(i => i.equipado && i.tipo === 'armadura' && i.nome !== 'Escudo'),
    escudo: inv.find(i => i.equipado && (i.nome === 'Escudo' || i.tipo === 'escudo')),
  };
}

/** Se o item conta para os efeitos do personagem: equipado, não destruído e, quando exige, sintonizado. */
export function itemAtivo(item) {
  if (!item?.equipado || item.destruido) return false;
  return !(item.dados?.requer_sintonizacao && item.sintonizado !== true);
}

/** Se a condição fechada vale para o personagem agora; condição desconhecida não vale. */
export function condicaoSatisfeita(condicao, personagem) {
  const { armadura, escudo } = equipamentoDeCA(personagem);
  if (condicao === 'sem_armadura') return !armadura;
  if (condicao === 'sem_escudo') return !escudo;
  if (condicao === 'sem_armadura_nem_escudo') return !armadura && !escudo;
  return false;
}

/** Adaptador: os campos de bônus do item customizado como lista de efeitos. */
export function efeitosDeCustomizado(item) {
  const d = item?.dados || {};
  const n = (v) => parseInt(v) || 0;
  const out = [];
  if (n(d.bonus_ca)) out.push({ alvo: 'ca', valor: n(d.bonus_ca) });
  if (n(d.ca_base)) out.push({ alvo: 'ca_base', valor: n(d.ca_base) });
  if (n(d.bonus_ataque_magia)) out.push({ alvo: 'ataque_magia', valor: n(d.bonus_ataque_magia) });
  if (n(d.bonus_cd_magia)) out.push({ alvo: 'cd_magia', valor: n(d.bonus_cd_magia) });
  // Só ataque, sem dano: é o sentido do campo "Bônus de Ataque" do formulário.
  if (d.categoria && n(d.bonus_ataque)) out.push({ alvo: 'ataque_arma', valor: n(d.bonus_ataque) });
  return out;
}

/** Efeitos declarados por um item: customizado pelo adaptador, os demais por `dados.efeitos`. */
export function efeitosDoItem(item) {
  if (!item) return [];
  if (item.tipo === 'customizado') return efeitosDeCustomizado(item);
  return Array.isArray(item.dados?.efeitos) ? item.dados.efeitos : [];
}

/**
 * Efeitos de um único item que valem agora para o personagem (sem os da arma
 * do próprio item), com a origem. As condições de equipamento (`condicao`)
 * são avaliadas contra o personagem completo, não só contra o item.
 */
export function efeitosAtivosDoItem(personagem, item) {
  const out = [];
  if (!itemAtivo(item)) return out;
  for (const ef of efeitosDoItem(item)) {
    if (ALVOS_DA_ARMA.includes(ef.alvo)) continue;
    // Em imunidade_condicao, `condicao` é a condição do jogo, não a restrição de equipamento.
    if (ef.alvo !== 'imunidade_condicao' && ef.condicao && !condicaoSatisfeita(ef.condicao, personagem)) continue;
    // `origem_magico_id` identifica o item do acervo de onde o efeito vem (só quando o item tem `magico_id`).
    out.push({ ...ef, origem: item.nome, ...(item.dados?.magico_id ? { origem_magico_id: item.dados.magico_id } : {}) });
  }
  return out;
}

/** Efeitos que valem agora para o personagem (sem os da arma do próprio item), com a origem. */
export function efeitosAtivos(personagem) {
  return (personagem?.inventario || []).flatMap(item => efeitosAtivosDoItem(personagem, item));
}

/** Soma dos valores dos efeitos ativos de um alvo (0 sem efeito). */
export function somaEfeitos(personagem, alvo) {
  return efeitosAtivos(personagem).filter(e => e.alvo === alvo).reduce((s, e) => s + (Number(e.valor) || 0), 0);
}

/** Maior valor entre os efeitos ativos de um alvo (0 sem efeito); usado por ca_base. */
export function maiorEfeito(personagem, alvo) {
  return efeitosAtivos(personagem).filter(e => e.alvo === alvo).reduce((m, e) => Math.max(m, Number(e.valor) || 0), 0);
}

/**
 * Bônus de ataque e dano da arma do próprio item. Não exige o item
 * equipado (a ficha mostra o ataque de toda arma do inventário), só a
 * sintonização quando o item pede.
 */
export function efeitosDaArma(item) {
  const out = { ataque: 0, dano: 0 };
  if (item?.destruido) return out;
  if (item?.dados?.requer_sintonizacao && item.sintonizado !== true) return out;
  for (const ef of efeitosDoItem(item)) {
    if (ef.alvo === 'ataque_arma') out.ataque += Number(ef.valor) || 0;
    if (ef.alvo === 'dano_arma') out.dano += Number(ef.valor) || 0;
  }
  return out;
}

/** Maior mínimo ativo de um atributo definido por item, ou null sem nenhum (aplicado na F4). */
export function atributoMinimoPorItens(personagem, atributo) {
  const minimos = efeitosAtivos(personagem)
    .filter(e => e.alvo === 'atributo' && e.atributo === atributo && Number.isInteger(e.minimo))
    .map(e => e.minimo);
  return minimos.length ? Math.max(...minimos) : null;
}
