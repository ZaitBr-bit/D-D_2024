// ============================================================
// Regras puras de ataque: atributo do modificador, dano versátil e mãos.
// Sem DOM e sem estado de tela: recebe o personagem e o item.
// ============================================================
import { calcMod } from './utils.js';
import { atributoEfetivo } from './regras-atributos.js';
import { livroEmpunhado } from './regras-necromante.js';

/** Atributos que o jogador pode escolher como modificador de uma arma ou armadura. */
export const ATRIBUTOS_MODIFICADOR = [
  { id: 'forca', sigla: 'FOR', nome: 'Força' },
  { id: 'destreza', sigla: 'DES', nome: 'Destreza' },
  { id: 'constituicao', sigla: 'CON', nome: 'Constituição' },
  { id: 'inteligencia', sigla: 'INT', nome: 'Inteligência' },
  { id: 'sabedoria', sigla: 'SAB', nome: 'Sabedoria' },
  { id: 'carisma', sigla: 'CAR', nome: 'Carisma' },
];

const IDS_ATRIBUTO = new Set(ATRIBUTOS_MODIFICADOR.map(a => a.id));

/** Texto minúsculo de uma propriedade do item (vazio se ausente). */
function minusculo(valor) {
  return String(valor || '').toLowerCase();
}

/** Indica se o item é arma de ataque: arma de catálogo ou personalizado com categoria de arma. */
export function ehArmaDeAtaque(item) {
  if (!item) return false;
  return item.tipo === 'arma' || (item.tipo === 'customizado' && !!item.dados?.categoria);
}

/** Indica se o item é escudo (catálogo ou personalizado do tipo Escudo). */
export function ehEscudoItem(item) {
  if (!item) return false;
  return item.tipo === 'escudo' || item.nome === 'Escudo'
    || (item.tipo === 'customizado' && item.dados?.tipo_armadura === 'Escudo');
}

/** Atributo escolhido pelo jogador em `dados.atributo`, ou null se ausente ou inválido. */
export function atributoExplicito(item) {
  const id = item?.dados?.atributo;
  return IDS_ATRIBUTO.has(id) ? id : null;
}

/** Nome curto do atributo usado no texto da CA do catálogo ("Des", "Int"...). */
const NOME_CURTO_CA = {
  forca: 'For', destreza: 'Des', constituicao: 'Con',
  inteligencia: 'Int', sabedoria: 'Sab', carisma: 'Car',
};

/**
 * Texto da CA da armadura para exibição: quando o jogador escolheu um atributo,
 * troca "modificador de Des" pelo atributo escolhido ("12 + modificador de Int").
 * Sem atributo escolhido ou sem a expressão no texto, devolve a CA original.
 */
export function textoCADaArmadura(item) {
  const ca = String(item?.dados?.ca || '');
  const id = atributoExplicito(item);
  if (!id || item?.tipo !== 'armadura') return ca;
  return ca.replace(/modificador de Des/i, `modificador de ${NOME_CURTO_CA[id]}`);
}

/**
 * Atributo padrão da arma: Acuidade usa o maior entre FOR e DES (empate = FOR);
 * arma à distância usa DES; as demais usam FOR.
 */
export function atributoPadraoArma(char, item) {
  const props = minusculo(item?.dados?.propriedades);
  const cat = minusculo(item?.dados?.categoria);
  if (props.includes('acuidade')) {
    const modFor = calcMod(atributoEfetivo(char, 'forca'));
    const modDes = calcMod(atributoEfetivo(char, 'destreza'));
    return modFor >= modDes ? 'forca' : 'destreza';
  }
  if (cat.includes('dist')) return 'destreza';
  return 'forca';
}

/** Atributo efetivo da arma: o escolhido pelo jogador ou, na falta, o padrão. */
export function atributoDaArma(char, item) {
  return atributoExplicito(item) || atributoPadraoArma(char, item);
}

/** Dado do dano versátil lido de "Versátil (1d10)" em `dados.propriedades`; null se a arma não é versátil. */
export function danoVersatil(item) {
  const m = String(item?.dados?.propriedades || '').match(/vers[áa]til\s*\(\s*(\d+d\d+)\s*\)/i);
  return m ? m[1] : null;
}

/**
 * Dano base da arma conforme a empunhadura: com `dados.empunhadura === 'duas'` e arma versátil,
 * troca o dado pelo versátil e mantém o resto ("1d8 Cortante" -> "1d10 Cortante").
 */
export function danoBaseEmpunhado(item) {
  const base = String(item?.dados?.dano || '');
  const versatil = danoVersatil(item);
  if (!versatil || item.dados.empunhadura !== 'duas') return base;
  return base.replace(/^\s*\d+d\d+/i, versatil);
}

/** Mãos que o item ocupa quando equipado: escudo 1; arma Duas Mãos 2; versátil 2 se empunhada com duas; demais armas 1; o resto 0. */
export function maosOcupadas(item) {
  if (!item) return 0;
  if (ehEscudoItem(item)) return 1;
  if (!ehArmaDeAtaque(item)) return 0;
  const props = minusculo(item.dados?.propriedades);
  if (props.includes('duas mãos')) return 2;
  if (props.includes('versátil') && item.dados?.empunhadura === 'duas') return 2;
  return 1;
}

/** Total de mãos do personagem: `char.maos.length` ou 2 quando a lista não existe. */
export function maosTotais(char) {
  return Array.isArray(char?.maos) && char.maos.length > 0 ? char.maos.length : 2;
}

/** Item que conta no limite: equipado, não destruído e com quantidade. */
function contaNasMaos(item) {
  return !!item?.equipado && !item.destruido && (item.quantidade ?? 1) > 0;
}

/** Soma das mãos ocupadas pelos itens equipados (e pelo livro de magias do Necromante), sem contar o item `ignorar`. */
export function maosEmUso(char, ignorar = null) {
  const livro = livroEmpunhado(char) ? 1 : 0;
  return livro + (char?.inventario || [])
    .filter(i => i !== ignorar && contaNasMaos(i))
    .reduce((s, i) => s + maosOcupadas(i), 0);
}

/**
 * Verifica se o item pode ser equipado sem passar do limite de mãos.
 * Devolve os nomes dos itens que ocupam mão quando recusa.
 */
export function verificarEquipar(char, item) {
  // Item destruído ou esgotado não ocupa mão ao equipar, igual aos já equipados.
  const custo = (item?.destruido || (item?.quantidade ?? 1) <= 0) ? 0 : maosOcupadas(item);
  if (custo === 0) return { ok: true };
  const emUso = maosEmUso(char, item);
  const total = maosTotais(char);
  if (emUso + custo <= total) return { ok: true };
  const bloqueadores = (char.inventario || [])
    .filter(i => i !== item && contaNasMaos(i) && maosOcupadas(i) > 0)
    .map(i => i.nome);
  if (livroEmpunhado(char)) bloqueadores.push('Livro de magias');
  return {
    ok: false,
    motivo: `Sem mãos livres (${emUso} de ${total} em uso): desequipe ${bloqueadores.join(' ou ')}.`,
    bloqueadores,
  };
}

/** Indica se a arma é versátil, sem a propriedade Duas Mãos, e está empunhada com duas mãos (pode voltar para uma). */
function versatilComDuasMaos(item) {
  return ehArmaDeAtaque(item) && !!danoVersatil(item)
    && !minusculo(item.dados?.propriedades).includes('duas mãos')
    && item.dados?.empunhadura === 'duas';
}

/**
 * Equipa o item aplicando o ajuste automático de mãos: armas versáteis empunhadas com duas mãos
 * (o próprio item, se tiver empunhadura residual, e depois as já equipadas) voltam para uma mão
 * na quantidade necessária para o item caber. Só altera `dados.empunhadura` (remove) quando o
 * ajuste faz o item caber; se não couber mesmo assim, recusa e não altera nada.
 * Não grava `equipado`: o chamador marca o item.
 * @returns {{ok:boolean, ajustados:string[], motivo?:string, bloqueadores?:string[]}}
 */
export function equiparComAjusteDeMaos(char, item) {
  const direto = verificarEquipar(char, item);
  if (direto.ok) return { ok: true, ajustados: [] };
  const custo = maosOcupadas(item);
  const falta = maosEmUso(char, item) + custo - maosTotais(char);
  const candidatas = [item, ...(char.inventario || []).filter(i => i !== item && contaNasMaos(i))]
    .filter(versatilComDuasMaos);
  if (falta > candidatas.length) return { ...direto, ajustados: [] };
  const alvos = candidatas.slice(0, falta);
  alvos.forEach(a => { delete a.dados.empunhadura; });
  return { ok: true, ajustados: alvos.map(a => a.nome) };
}

/** Indica se os itens equipados ocupam mais mãos do que o personagem tem (save antigo). */
export function excedeMaos(char) {
  return maosEmUso(char) > maosTotais(char);
}

/** Aviso quando há arma de uma mão com Munição equipada e nenhuma mão livre; null caso contrário. */
export function avisoRecarga(char) {
  if (maosEmUso(char) < maosTotais(char)) return null;
  const alvo = (char?.inventario || []).find(i =>
    contaNasMaos(i) && ehArmaDeAtaque(i) && maosOcupadas(i) === 1
    && minusculo(i.dados?.propriedades).includes('munição'));
  return alvo ? `Sem mão livre para recarregar ${alvo.nome}.` : null;
}
