// ============================================================
// Regras puras do Artífice (Tasha's). Sem DOM: a ficha
// (sheet/classes/artifice.js), o criador e a subida de nível chamam
// estas funções e só desenham o resultado.
// ============================================================
import { CLASSES_INFO } from './dados-classes.js';
import { calcMod } from './utils.js';
import { atributoEfetivo } from './regras-atributos.js';
import { nivelNa, subclasseDe } from './regras-multiclasse.js';

export const CLASSE_ARTIFICE = 'Artífice';

/**
 * Truque concedido por característica ao ENTRAR na classe (Magia de
 * Funileiro: "Você conhece o truque Reparar"). Grava com origem
 * `caracteristica_classe`, que não conta no limite de truques nem entra
 * em troca. Devolve true quando gravou.
 */
export function concederTruquesDeEntrada(personagem, classe) {
  if (classe !== CLASSE_ARTIFICE) return false;
  if (!Array.isArray(personagem.magias_conhecidas)) personagem.magias_conhecidas = [];
  if (personagem.magias_conhecidas.some((m) => m.nome === 'Reparar')) return false;
  personagem.magias_conhecidas.push({ nome: 'Reparar', circulo: 0, origem: 'caracteristica_classe', classe: CLASSE_ARTIFICE });
  return true;
}

/** Grava as ferramentas fixas do Artífice e a de artesão escolhida no criador, sem repetir. */
export function aplicarFerramentasDaCriacao(personagem) {
  if (personagem.classe !== CLASSE_ARTIFICE) return;
  if (!Array.isArray(personagem.proficiencias_ferramentas)) personagem.proficiencias_ferramentas = [];
  const novas = [...(CLASSES_INFO[CLASSE_ARTIFICE].ferramentas || []), ...(personagem.escolhas_classe?.ferramenta_artesao || [])];
  for (const f of novas) if (!personagem.proficiencias_ferramentas.includes(f)) personagem.proficiencias_ferramentas.push(f);
}

/**
 * Teto de itens sintonizados dado o nível NA classe Artífice: 3 por padrão,
 * 4 (nível 10), 5 (nível 14) e 6 (nível 18).
 * @param {number} nivelArtifice Nível do personagem como Artífice (0 se não for).
 * @returns {number}
 */
export function tetoSintonizacaoArtifice(nivelArtifice) {
  if (nivelArtifice >= 18) return 6;
  if (nivelArtifice >= 14) return 5;
  if (nivelArtifice >= 10) return 4;
  return 3;
}

// Magia de Funileiro: os 31 itens do livro, pelo nome do catálogo do Livro do Jogador.
// "Vial" não existe em equipamento_aventura.json e entra como item genérico "Ampola".
export const ITENS_FUNILEIRO = [
  'Esferas de Metal', 'Cesta', 'Saco de Dormir', 'Sino', 'Cobertor', 'Roldana e Polias', 'Garrafa de Vidro (1 litro)',
  'Balde', 'Estrepes', 'Vela', 'Pé de Cabra', 'Frasco', 'Arpéu', 'Armadilha de Caça', 'Jarro (4 litros)', 'Lâmpada',
  'Grilhões', 'Rede', 'Óleo', 'Papel', 'Pergaminho', 'Baliza', 'Algibeira', 'Corda', 'Saca', 'Pá', 'Estacas de Ferro',
  'Cordão', 'Caixa para Fogo', 'Tocha', 'Ampola',
];

/** Estado dos recursos do Artífice em `p.recursos.artifice`, criado e completado na leitura. */
export function estadoArtifice(p) {
  if (!p.recursos) p.recursos = {};
  const e = p.recursos.artifice || (p.recursos.artifice = {});
  const padrao = { funileiro_gastos: 0, lampejo_gastos: 0, armazenar: null, planos: [], drenar_usado: false, transmutar_usado: false, espaco_temporario: null, companheiros: {}, reparar_defensor_gastos: 0, golpe_arcano_gastos: 0, canhao_gratis_usado: false, gratis: {}, armadura_arcana: null, modelo: '', armeiro_gastos: {}, atlas: null };
  for (const [k, v] of Object.entries(padrao)) if (!(k in e)) e[k] = v;
  return e;
}

/** Modificador de Inteligência em jogo (itens e edições incluídos). */
export function modInt(p) {
  return calcMod(atributoEfetivo(p, 'inteligencia'));
}

/**
 * Pronto para a Batalha (Ferreiro de Batalha 3+): em arma mágica ativa, o ataque e o
 * dano podem usar Int no lugar de For/Des. Devolve o maior dos dois e se a Int foi usada.
 * Arma mágica ativa espelha efeitosDaArma: destruída ou sem a sintonização exigida não vale.
 */
export function modAtaqueArmaArtifice(p, item, modAtual) {
  const ehMagica = !!item?.dados?.magico_id && !item.destruido && !(item.dados.requer_sintonizacao && item.sintonizado !== true);
  if (!ehMagica || subclasseDe(p, CLASSE_ARTIFICE) !== 'Ferreiro de Batalha' || (nivelNa(p, CLASSE_ARTIFICE) || 0) < 3) {
    return { mod: modAtual, usouInt: false };
  }
  const int = modInt(p);
  return int > modAtual ? { mod: int, usouInt: true } : { mod: modAtual, usouInt: false };
}

/** Usos da Magia de Funileiro: mod. Int, mínimo 1 (Artífice 1+). */
export function usosMaxFunileiro(p) {
  return (nivelNa(p, CLASSE_ARTIFICE) || 0) >= 1 ? Math.max(1, modInt(p)) : 0;
}

/** Usos do Lampejo de Genialidade: mod. Int, mínimo 1 (Artífice 7+). */
export function usosMaxLampejo(p) {
  return (nivelNa(p, CLASSE_ARTIFICE) || 0) >= 7 ? Math.max(1, modInt(p)) : 0;
}

/** Cargas do Item de Armazenar Magia: 2x mod. Int, mínimo 2 (Artífice 11+). */
export function cargasMaxArmazenar(p) {
  return (nivelNa(p, CLASSE_ARTIFICE) || 0) >= 11 ? Math.max(2, 2 * modInt(p)) : 0;
}

/** Gasta um uso de 'funileiro' ou 'lampejo'; false quando esgotado. */
export function gastarUso(p, chave) {
  const e = estadoArtifice(p);
  const max = chave === 'funileiro' ? usosMaxFunileiro(p) : usosMaxLampejo(p);
  const campo = `${chave}_gastos`;
  if (e[campo] >= max) return false;
  e[campo] += 1;
  return true;
}

/** Descanso Curto: Gênio Renovado (14) devolve 1 Lampejo; Orientação Mágica (20) devolve todos se houver item sintonizado. */
export function descansoCurtoArtifice(p) {
  const nivel = nivelNa(p, CLASSE_ARTIFICE) || 0;
  if (nivel < 14) return;
  const e = estadoArtifice(p);
  // Não reutiliza itensSintonizados (regras-sintonizacao.js): esse módulo já importa este, e o filtro é uma linha.
  const sintonizado = (p.inventario || []).some((i) => i?.dados?.requer_sintonizacao && i.sintonizado === true);
  if (nivel >= 20 && sintonizado) e.lampejo_gastos = 0;
  else e.lampejo_gastos = Math.max(0, e.lampejo_gastos - 1);
}

/** Descanso Longo: restaura Funileiro, Lampejo, Drenar, Transmutar, Reparar do Defensor, Golpe Arcano, o canhão grátis e os usos grátis de magia das subclasses (`gratis`), os contadores do Armeiro (`armeiro_gastos`); o espaço temporário de Drenar some; o item armazenado continua até gastar ou ser trocado. */
export function descansoLongoArtifice(p) {
  if (!nivelNa(p, CLASSE_ARTIFICE)) return;
  const e = estadoArtifice(p);
  e.funileiro_gastos = 0;
  e.lampejo_gastos = 0;
  e.drenar_usado = false;
  e.transmutar_usado = false;
  e.espaco_temporario = null;
  // Companheiros (Ferreiro de Batalha, Artilheiro): contadores por Descanso Longo.
  // `e.companheiros` não é zerado: os cartões continuam (o Defensor não expira; o canhão some em 1 h, tratado pelo jogador).
  e.reparar_defensor_gastos = 0;
  e.golpe_arcano_gastos = 0;
  e.canhao_gratis_usado = false;
  e.gratis = {};
  e.armeiro_gastos = {};
}

/** Armazena uma magia num objeto (substitui o anterior). */
export function definirArmazenar(p, { objeto, magia, circulo }) {
  estadoArtifice(p).armazenar = { objeto: String(objeto || '').trim(), magia, circulo: Number(circulo), usos_gastos: 0 };
}

/**
 * Magias elegíveis ao Item de Armazenar Magia: lista do Artífice, 1º a 3º círculo,
 * tempo de conjuração de 1 Ação (inclui "Ação ou Ritual") e sem material que a magia consome.
 * @param {object} listaMagiasClasse Resultado de db.getMagiasClasse('Artífice').
 * @param {object} indice Resultado de db.getIndiceMagias().
 */
export function magiasArmazenaveis(listaMagiasClasse, indice) {
  const nomes = new Set(['1º Círculo', '2º Círculo', '3º Círculo']
    .flatMap((k) => (listaMagiasClasse?.lista_magias?.[k] || []).map((m) => m.nome)));
  return (indice?.magias || []).filter((m) => nomes.has(m.nome)
    && /^a[cç][aã]o(\s+ou\s+ritual)?$/i.test(String(m.tempo_conjuracao || '').trim())
    && !/consom|consum/i.test(String(m.componentes || '')))
    .sort((a, b) => a.circulo - b.circulo || a.nome.localeCompare(b.nome, 'pt-BR'));
}

/** Usa uma carga do item armazenado; false sem item ou sem carga. */
export function usarArmazenar(p) {
  const a = estadoArtifice(p).armazenar;
  if (!a || a.usos_gastos >= cargasMaxArmazenar(p)) return false;
  a.usos_gastos += 1;
  return true;
}
